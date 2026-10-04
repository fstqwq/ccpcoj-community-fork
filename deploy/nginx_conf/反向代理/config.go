package main

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"
)

// workDir 在 main 中设为可执行文件所在目录（支持 Windows 双击）。
var workDir string

const confFileName = "conf"

// 与 nginx / 反向代理 Basic 约定一致（不向终端提示具体用户名）。
const upstreamBasicUser = "csgoj_gate"

// AppConfig 持久化到当前目录 conf（JSON）。
type AppConfig struct {
	PublicURL string `json:"public_url"`
	ListenPort int   `json:"listen_port"`
	// UpstreamPassword 非空时，访问公网上游会带 Basic（与 nginx 门闩同一用户名常量）；明文存 conf，须控制 conf 权限。
	UpstreamPassword string `json:"upstream_password,omitempty"`
}

func configFilePath() string {
	return filepath.Join(workDir, confFileName)
}

func getenvFirst(keys ...string) string {
	for _, k := range keys {
		if v := strings.TrimSpace(os.Getenv(k)); v != "" {
			return v
		}
	}
	return ""
}

// loadConfigFromEnv 从环境变量加载配置（供 flg_env / 容器 -e 使用）。
// 变量：OJ_PROXY_PUBLIC_URL、OJ_PROXY_LISTEN_PORT、OJ_PROXY_UPSTREAM_PASSWORD；
// 或与 LANEXAM_PUBLIC_URL、LANEXAM_LISTEN_PORT、LANEXAM_UPSTREAM_PASSWORD 二选一（前者优先）。
func loadConfigFromEnv() (*AppConfig, error) {
	pub := getenvFirst("OJ_PROXY_PUBLIC_URL", "LANEXAM_PUBLIC_URL")
	portStr := getenvFirst("OJ_PROXY_LISTEN_PORT", "LANEXAM_LISTEN_PORT")
	pass := getenvFirst("OJ_PROXY_UPSTREAM_PASSWORD", "LANEXAM_UPSTREAM_PASSWORD")
	if pub == "" || portStr == "" {
		return nil, errors.New("环境变量不完整：需要 OJ_PROXY_PUBLIC_URL 与 OJ_PROXY_LISTEN_PORT（或 LANEXAM_* 同名）")
	}
	port, err := strconv.Atoi(portStr)
	if err != nil || port < 1 || port > 65535 {
		return nil, errors.New("OJ_PROXY_LISTEN_PORT / LANEXAM_LISTEN_PORT 无效")
	}
	cfg := &AppConfig{
		PublicURL:        pub,
		ListenPort:       port,
		UpstreamPassword: pass,
	}
	if err := canonPublicURLInConfig(cfg); err != nil {
		return nil, err
	}
	return cfg, nil
}

func loadConfig() (*AppConfig, error) {
	b, err := os.ReadFile(configFilePath())
	if err != nil {
		return nil, err
	}
	var c AppConfig
	if err := json.Unmarshal(b, &c); err != nil {
		return nil, err
	}
	c.PublicURL = strings.TrimSpace(c.PublicURL)
	c.UpstreamPassword = strings.TrimSpace(c.UpstreamPassword)
	if c.PublicURL == "" || c.ListenPort <= 0 || c.ListenPort > 65535 {
		return nil, errors.New("配置无效")
	}
	if err := canonPublicURLInConfig(&c); err != nil {
		return nil, err
	}
	return &c, nil
}

func canonPublicURLInConfig(c *AppConfig) error {
	u, err := normalizePublicURL(c.PublicURL)
	if err != nil {
		return err
	}
	c.PublicURL = publicURLString(u)
	return nil
}

func saveConfig(c *AppConfig) error {
	b, err := json.MarshalIndent(c, "", "  ")
	if err != nil {
		return err
	}
	tmp := configFilePath() + ".tmp"
	if err := os.WriteFile(tmp, b, 0600); err != nil {
		return err
	}
	return os.Rename(tmp, configFilePath())
}

// normalizePublicURL 解析完整 URL，去掉末尾路径，仅保留 scheme://host[:port]。
func normalizePublicURL(raw string) (*url.URL, error) {
	s := strings.TrimSpace(raw)
	if s == "" {
		return nil, errors.New("地址不能为空")
	}
	u, err := url.Parse(s)
	if err != nil {
		return nil, err
	}
	if u.Scheme != "http" && u.Scheme != "https" {
		return nil, errors.New("必须使用 http 或 https 协议")
	}
	if u.Host == "" {
		return nil, errors.New("缺少主机名")
	}
	host := u.Hostname()
	if host == "" {
		return nil, errors.New("主机名无效")
	}
	port := u.Port()
	if port == "" {
		if u.Scheme == "https" {
			port = "443"
		} else {
			port = "80"
		}
	}
	out := &url.URL{
		Scheme: u.Scheme,
		Host:   net.JoinHostPort(host, port),
	}
	return out, nil
}

func publicURLString(u *url.URL) string {
	return u.Scheme + "://" + u.Host
}

// ErrProbeInterrupted 表示用户在启动前检测阶段按 c c 主动中断。
var ErrProbeInterrupted = errors.New("公网检测已中断")

// probeUpstreamGETWithRetry 启动时用「校验规则」检测公网（间隔重试）；basicPass 为空表示不带 Basic。
func probeUpstreamGETWithRetry(u *url.URL, basicPass string, retries int, interval time.Duration) error {
	var lastErr error
	for i := 0; i < retries; i++ {
		if i > 0 {
			time.Sleep(interval)
		}
		if err := probeUpstreamValidated(u, basicPass); err == nil {
			return nil
		} else {
			lastErr = err
		}
	}
	if lastErr == nil {
		lastErr = errors.New("无法连接")
	}
	return lastErr
}

// probeUpstreamValidatedCtx 同 probeUpstreamValidated，但请求可被 ctx 取消（用于 c c 打断）。
func probeUpstreamValidatedCtx(ctx context.Context, u *url.URL, basicPass string) error {
	client := &http.Client{Timeout: 15 * time.Second}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, publicURLString(u)+"/", nil)
	if err != nil {
		return err
	}
	if basicPass != "" {
		req.SetBasicAuth(upstreamBasicUser, basicPass)
	}
	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	_, _ = io.Copy(io.Discard, resp.Body)
	_ = resp.Body.Close()
	sc := resp.StatusCode
	if basicPass != "" {
		if sc == http.StatusUnauthorized || sc == http.StatusForbidden {
			return fmt.Errorf("HTTP %d（密码错误或无权访问）", sc)
		}
		if sc < 200 || sc >= 400 {
			return fmt.Errorf("HTTP %d", sc)
		}
		return nil
	}
	if sc == http.StatusUnauthorized || sc == http.StatusProxyAuthRequired {
		return fmt.Errorf("HTTP %d（上游已启用访问密码，请填写或核对密码）", sc)
	}
	if sc >= 500 {
		return fmt.Errorf("HTTP %d", sc)
	}
	return nil
}

// probeUpstreamLenient 仅用于交互配置第一步：能连上、有 HTTP 响应即可（含 401，便于后续再填密码）。
func probeUpstreamLenient(u *url.URL) error {
	client := &http.Client{Timeout: 15 * time.Second}
	req, err := http.NewRequest(http.MethodGet, publicURLString(u)+"/", nil)
	if err != nil {
		return err
	}
	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	_, _ = io.Copy(io.Discard, resp.Body)
	_ = resp.Body.Close()
	if resp.StatusCode >= 200 && resp.StatusCode < 600 {
		return nil
	}
	return fmt.Errorf("HTTP %d", resp.StatusCode)
}

// probeUpstreamValidated 启动前或保存配置前：无密码时若上游返回 401/407 则提示需填密码；有密码时 401/403 视为失败。
func probeUpstreamValidated(u *url.URL, basicPass string) error {
	client := &http.Client{Timeout: 15 * time.Second}
	req, err := http.NewRequest(http.MethodGet, publicURLString(u)+"/", nil)
	if err != nil {
		return err
	}
	if basicPass != "" {
		req.SetBasicAuth(upstreamBasicUser, basicPass)
	}
	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	_, _ = io.Copy(io.Discard, resp.Body)
	_ = resp.Body.Close()
	sc := resp.StatusCode
	if basicPass != "" {
		if sc == http.StatusUnauthorized || sc == http.StatusForbidden {
			return fmt.Errorf("HTTP %d（密码错误或无权访问）", sc)
		}
		if sc < 200 || sc >= 400 {
			return fmt.Errorf("HTTP %d", sc)
		}
		return nil
	}
	if sc == http.StatusUnauthorized || sc == http.StatusProxyAuthRequired {
		return fmt.Errorf("HTTP %d（上游已启用访问密码，请填写或核对密码）", sc)
	}
	if sc >= 500 {
		return fmt.Errorf("HTTP %d", sc)
	}
	return nil
}

func isPortAvailable(port int) error {
	ln, err := net.Listen("tcp", fmt.Sprintf(":%d", port))
	if err != nil {
		return err
	}
	_ = ln.Close()
	return nil
}

func readLine(prompt string) (string, error) {
	fmt.Print(prompt)
	var buf strings.Builder
	b := make([]byte, 1)
	for {
		n, err := os.Stdin.Read(b)
		if n == 0 && err != nil {
			return "", err
		}
		if n == 0 {
			continue
		}
		if b[0] == '\n' || b[0] == '\r' {
			if b[0] == '\r' {
				_, _ = os.Stdin.Read(make([]byte, 1))
			}
			break
		}
		buf.WriteByte(b[0])
	}
	return strings.TrimSpace(buf.String()), nil
}

func interactiveConfigure() (*AppConfig, error) {
	for {
		fmt.Print(dim + "公网服务地址（完整 URL，含 http/https）: " + reset)
		line, err := readLine("")
		if err != nil {
			return nil, err
		}
		u, err := normalizePublicURL(line)
		if err != nil {
			fmt.Println(warnStyle("格式错误: " + err.Error()))
			continue
		}
		fmt.Println(dim + "正在检测公网地址…" + reset)
		if err := probeUpstreamLenient(u); err != nil {
			fmt.Println(errStyle("无法访问公网服务: " + err.Error()))
			fmt.Println(warnStyle("请核对地址，并确认本机当前环境可访问该公网地址。"))
			continue
		}
		fmt.Println(okStyle("公网地址可用。"))
		var upstreamPass string
		for {
			fmt.Print(dim + "上游访问密码（" + bold + fgYellow + "留空=" + reset + dim + "上游未启用认证；勿泄露）: " + reset)
			psw, err := readLine("")
			if err != nil {
				return nil, err
			}
			upstreamPass = strings.TrimSpace(psw)
			fmt.Println(dim + "正在验证上游访问…" + reset)
			if err := probeUpstreamValidated(u, upstreamPass); err != nil {
				fmt.Println(errStyle("验证失败: " + err.Error()))
				fmt.Println(warnStyle("请重试：有认证则填写正确密码；无认证则保持留空。"))
				continue
			}
			fmt.Println(okStyle("验证通过。"))
			break
		}
		var port int
		for {
			fmt.Print(dim + "内网监听端口（1-65535）: " + reset)
			ps, err := readLine("")
			if err != nil {
				return nil, err
			}
			port, err = strconv.Atoi(ps)
			if err != nil || port < 1 || port > 65535 {
				fmt.Println(warnStyle("端口号无效。"))
				continue
			}
			if err := isPortAvailable(port); err != nil {
				fmt.Println(errStyle("端口不可用: " + err.Error()))
				fmt.Println(warnStyle("请更换端口或结束占用该端口的程序。"))
				continue
			}
			break
		}
		cfg := &AppConfig{
			PublicURL:        publicURLString(u),
			ListenPort:       port,
			UpstreamPassword: upstreamPass,
		}
		if err := saveConfig(cfg); err != nil {
			return nil, err
		}
		fmt.Println(okStyle("配置已保存"))
		return cfg, nil
	}
}
