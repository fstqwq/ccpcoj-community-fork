package main

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"os"
	"os/signal"
	"path/filepath"
	"strings"
	"sync"
	"syscall"
	"time"
)

func exeDir() string {
	exe, err := os.Executable()
	if err != nil {
		return "."
	}
	return filepath.Dir(exe)
}

func hasEnvConfigFlag() bool {
	for _, a := range os.Args[1:] {
		if a == "flg_env" {
			return true
		}
	}
	return false
}

func runEnvMode() {
	if strings.TrimSpace(os.Getenv("OJ_PROXY_DOCKER_DEV_LOGS")) == "1" {
		enableMirrorLogToStderr()
	}
	cfg, err := loadConfigFromEnv()
	if err != nil {
		fmt.Fprintln(os.Stderr, errStyle("配置错误: "+err.Error()))
		os.Exit(1)
	}
	u, err := url.Parse(cfg.PublicURL)
	if err != nil {
		fmt.Fprintln(os.Stderr, errStyle("公网地址无效: "+err.Error()))
		os.Exit(1)
	}
	if err := probeUpstreamGETWithRetry(u, cfg.UpstreamPassword, 3, 2*time.Second); err != nil {
		fmt.Fprintln(os.Stderr, errStyle("上游检测失败: "+err.Error()))
		os.Exit(1)
	}
	if err := isPortAvailable(cfg.ListenPort); err != nil {
		fmt.Fprintln(os.Stderr, errStyle("监听端口不可用: "+err.Error()))
		os.Exit(1)
	}
	ui := &uiState{}
	srv, err := serveProxy(cfg, ui)
	if err != nil {
		fmt.Fprintln(os.Stderr, errStyle("启动代理失败: "+err.Error()))
		os.Exit(1)
	}
	writeInfoLine(fmt.Sprintf("flg_env 模式已启动 :%d -> %s", cfg.ListenPort, cfg.PublicURL))
	fmt.Fprintf(os.Stderr, "%s 监听 :%d，上游 %s（Ctrl+C 退出）\n", okStyle("oj-proxy"), cfg.ListenPort, cfg.PublicURL)

	sigCh := make(chan os.Signal, 2)
	signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)
	<-sigCh
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	_ = srv.Shutdown(ctx)
}

func main() {
	if err := os.Chdir(exeDir()); err != nil {
		fmt.Fprintln(os.Stderr, "切换工作目录失败:", err)
		os.Exit(1)
	}
	workDir, _ = os.Getwd()

	if hasEnvConfigFlag() {
		envConfigMode = true
	}

	cleanupInstance := acquireSingleInstance()
	defer cleanupInstance()

	enableWindowsANSI()

	if err := initLogFiles(workDir); err != nil {
		fmt.Fprintln(os.Stderr, "创建 log 目录失败:", err)
		os.Exit(1)
	}
	defer closeLogFiles()

	if hasEnvConfigFlag() {
		runEnvMode()
		return
	}

	ui := &uiState{}
	var debMu sync.Mutex
	var debTimer *time.Timer
	ui.onAppend = func() {
		debMu.Lock()
		defer debMu.Unlock()
		if debTimer != nil {
			debTimer.Stop()
		}
		debTimer = time.AfterFunc(180*time.Millisecond, func() {
			paintLogWindow(ui)
		})
	}

	var srvMu sync.Mutex
	var curSrv *http.Server

	stopSrv := func() {
		srvMu.Lock()
		defer srvMu.Unlock()
		if curSrv != nil {
			ctx, cancel := context.WithTimeout(context.Background(), 4*time.Second)
			_ = curSrv.Shutdown(ctx)
			cancel()
			curSrv = nil
		}
	}
	closeSrvNow := func() {
		srvMu.Lock()
		defer srvMu.Unlock()
		if curSrv != nil {
			_ = curSrv.Close()
			curSrv = nil
		}
	}
	startSrv := func(cfg *AppConfig) error {
		stopSrv()
		s, err := serveProxy(cfg, ui)
		if err != nil {
			return err
		}
		srvMu.Lock()
		curSrv = s
		srvMu.Unlock()
		return nil
	}

	sigCh := make(chan os.Signal, 8)
	signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)
	go func() {
		for range sigCh {
			if tryPreflightInterrupt() {
				continue
			}
			closeSrvNow()
		}
	}()

	runDashboard := func(cfg *AppConfig, hadConf bool) keyLoopAction {
		ui.SetConfig(cfg)
		u, err := url.Parse(cfg.PublicURL)
		if err != nil {
			fmt.Fprintln(os.Stderr, errStyle("配置中公网地址无效: "+err.Error()))
			fmt.Fprintln(os.Stderr, warnStyle("将进入交互式重新配置（不会退出程序）。"))
			return keyActReconfigure
		}
		if hadConf {
			if err := runPreflightUpstreamProbeWithUI(u, cfg.UpstreamPassword); err != nil {
				if errors.Is(err, ErrProbeInterrupted) {
					fmt.Fprintln(os.Stderr, warnStyle("公网检测已中断（Ctrl+C），将进入重新配置。"))
					return keyActReconfigure
				}
				fmt.Fprintln(os.Stderr, errStyle("公网不可达: "+err.Error()))
				fmt.Fprintln(os.Stderr, warnStyle("将进入交互式重新配置（可修正地址、访问密码或网络后重试）。"))
				return keyActReconfigure
			}
		} else {
			if err := probeUpstreamValidated(u, cfg.UpstreamPassword); err != nil {
				fmt.Fprintln(os.Stderr, errStyle("公网不可达: "+err.Error()))
				fmt.Fprintln(os.Stderr, warnStyle("将进入交互式重新配置。"))
				return keyActReconfigure
			}
		}
		if err := isPortAvailable(cfg.ListenPort); err != nil {
			fmt.Fprintln(os.Stderr, errStyle("监听端口不可用: "+err.Error()))
			fmt.Fprintln(os.Stderr, warnStyle("将进入交互式重新配置（可更换监听端口）。"))
			return keyActReconfigure
		}

		clearScreen()
		ui.SetServerState(true, false)
		if err := startSrv(cfg); err != nil {
			ui.SetServerState(false, false)
			fmt.Fprintln(os.Stderr, errStyle("启动代理失败: "+err.Error()))
			fmt.Fprintln(os.Stderr, warnStyle("将进入交互式重新配置。"))
			return keyActReconfigure
		}
		paintDashboardFull(ui)

		act := runKeyboardLoop(ui, func(rl rune) (stop bool, act keyLoopAction) {
			switch rl {
			case 'q':
				closeSrvNow()
				ui.SetServerState(false, false)
				return true, keyActExit
			case 'c':
				closeSrvNow()
				ui.SetServerState(false, false)
				return true, keyActReconfigure
			case 't':
				srvMu.Lock()
				s := curSrv
				srvMu.Unlock()
				if s == nil {
					ui.appendLine(warnStyle("服务已处于暂停或未启动。"))
					return false, keyActNone
				}
				ui.SetServerState(true, true)
				_ = s.Close()
				srvMu.Lock()
				if curSrv == s {
					curSrv = nil
				}
				srvMu.Unlock()
				writeErrorLine("服务已暂停")
				ui.appendLine(warnStyle("服务已暂停，可按 s s 恢复，或 c c 重新配置。"))
				return false, keyActNone
			case 's':
				srvMu.Lock()
				noSrv := curSrv == nil
				srvMu.Unlock()
				if !noSrv {
					ui.appendLine(warnStyle("当前未处于暂停状态，无需恢复。"))
					return false, keyActNone
				}
				if err := isPortAvailable(cfg.ListenPort); err != nil {
					ui.appendLine(errStyle("无法恢复: 端口被占用 — " + err.Error()))
					return false, keyActNone
				}
				if err := startSrv(cfg); err != nil {
					ui.appendLine(errStyle("恢复失败: " + err.Error()))
					ui.SetServerState(false, false)
					return false, keyActNone
				}
				ui.SetServerState(true, false)
				writeInfoLine("服务已恢复")
				ui.appendLine(okStyle("服务已恢复。"))
				return false, keyActNone
			}
			return false, keyActNone
		})

		stopSrv()
		ui.SetServerState(false, false)
		return act
	}

	var cfg *AppConfig
	for {
		hadConf := false
		if cfg == nil {
			if _, err := os.Stat(configFilePath()); err == nil {
				loaded, err := loadConfig()
				if err != nil {
					fmt.Println(warnStyle("读取本地配置失败: " + err.Error() + "，将进入交互配置。"))
				} else {
					cfg = loaded
					hadConf = true
				}
			}
			if cfg == nil {
				fmt.Println(title("  首次配置 / 交互配置  "))
				fmt.Println(muted("请按提示输入；公网地址须为本机当前可访问的完整 URL。"))
				fmt.Println()
				c, err := interactiveConfigure()
				if err != nil {
					fmt.Println(errStyle("配置失败: " + err.Error()))
					os.Exit(1)
				}
				cfg = c
				hadConf = false
			}
		}

		act := runDashboard(cfg, hadConf)
		if act == keyActExit {
			return
		}
		if act == keyActReconfigure {
			clearScreen()
			fmt.Println(title("  重新配置 / 启动检测未通过  "))
			fmt.Println(muted("请按提示修正公网地址、上游访问密码或内网监听端口；完成后将重新检测并启动。"))
			fmt.Println()
			c2, err := interactiveConfigure()
			if err != nil {
				fmt.Println(errStyle("配置失败: " + err.Error()))
				os.Exit(1)
			}
			cfg = c2
			continue
		}
	}
}
