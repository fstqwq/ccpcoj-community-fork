package main

import (
	"fmt"
	"net"
	"sort"
	"strings"
)

// isDockerLikeInterface 排除常见「容器 / CNI / Docker 网桥」网卡名，避免把仅容器网段地址当成考场终端入口。
// 注意：名为 br0 的物理桥可能被误判，考场机若遇此情况可从本函数中去掉对应规则。
func isDockerLikeInterface(name string) bool {
	n := strings.ToLower(strings.TrimSpace(name))
	switch {
	case n == "docker0":
		return true
	case strings.HasPrefix(n, "br-"):
		return true // Linux docker network bridge，如 br-4e29d2b0c8e1
	case strings.HasPrefix(n, "veth"):
		return true
	case strings.HasPrefix(n, "cni"):
		return true
	case strings.HasPrefix(n, "flannel"), strings.HasPrefix(n, "calico"):
		return true
	case strings.HasPrefix(n, "kube-ipvs"):
		return true
	default:
		return false
	}
}

func hostHTTPURL(ip net.IP, port int) string {
	if four := ip.To4(); four != nil {
		return fmt.Sprintf("http://%s:%d/", four.String(), port)
	}
	return fmt.Sprintf("http://[%s]:%d/", ip.String(), port)
}

// osc8Hyperlink 终端 OSC 8 超链接（支持 Windows Terminal、iTerm2、多数现代终端）；不支持的终端会忽略控制序列仍显示文本。
func osc8Hyperlink(url, display string) string {
	return "\033]8;;" + url + "\033\\" + display + "\033]8;;\033\\"
}

type ipWithMeta struct {
	ip   net.IP
	prio int // 越小越靠前：私网 < 其它单播（回环不展示）
}

func ipPriority(ip net.IP) int {
	if ip.IsPrivate() {
		return 0
	}
	if ip.IsGlobalUnicast() {
		return 2
	}
	return 9
}

func shouldAnnounceIP(ip net.IP) bool {
	if ip == nil || ip.IsUnspecified() {
		return false
	}
	if ip.IsMulticast() {
		return false
	}
	// 回环仅本机可用，「局域网访问」列表不展示
	if ip.IsLoopback() {
		return false
	}
	// 链路本地（169.254.x.x）易误导，不展示
	if ip.IsLinkLocalUnicast() || ip.IsLinkLocalMulticast() {
		return false
	}
	if ip4 := ip.To4(); ip4 != nil {
		return true
	}
	// IPv6：仅展示全局单播，避免 fe80:: 等
	if ip.To16() != nil && ip.IsGlobalUnicast() {
		return true
	}
	return false
}

// LANAccessLines 生成「局域网访问」展示行（已含缩进与样式），在 cfg!=nil 时插入仪表盘。
func LANAccessLines(port int) []string {
	if port <= 0 || port > 65535 {
		return nil
	}
	ifaces, err := net.Interfaces()
	if err != nil {
		return []string{
			muted("  （无法枚举网卡: " + err.Error() + "）"),
		}
	}
	seen := make(map[string]struct{})
	var list []ipWithMeta
	for _, iface := range ifaces {
		if iface.Flags&net.FlagUp == 0 {
			continue
		}
		if isDockerLikeInterface(iface.Name) {
			continue
		}
		addrs, err := iface.Addrs()
		if err != nil {
			continue
		}
		for _, a := range addrs {
			var ip net.IP
			switch v := a.(type) {
			case *net.IPNet:
				ip = v.IP
			case *net.IPAddr:
				ip = v.IP
			default:
				continue
			}
			ip = ip.To16()
			if ip == nil || !shouldAnnounceIP(ip) {
				continue
			}
			key := ip.String()
			if _, ok := seen[key]; ok {
				continue
			}
			seen[key] = struct{}{}
			list = append(list, ipWithMeta{ip: ip, prio: ipPriority(ip)})
		}
	}
	sort.Slice(list, func(i, j int) bool {
		if list[i].prio != list[j].prio {
			return list[i].prio < list[j].prio
		}
		return list[i].ip.String() < list[j].ip.String()
	})

	const maxURLs = 8
	out := []string{
		bold + fgWhite + "局域网访问" + reset,
		muted("  下列地址供考场终端浏览器访问本代理（已排除常见虚拟网卡与本机回环）。"),
	}
	if len(list) == 0 {
		out = append(out, muted("  （未检测到可用 IPv4/IPv6 单播地址，请检查网卡是否已启用。）"))
		out = append(out, "")
		out = append(out, muted("  若经路由器端口映射或公网入口访问，本机无法自动得知该 URL，请咨询网管。"))
		return out
	}
	for i, m := range list {
		if i >= maxURLs {
			out = append(out, muted(fmt.Sprintf("  … 另有 %d 个地址已省略", len(list)-maxURLs)))
			break
		}
		u := hostHTTPURL(m.ip, port)
		line := "  " + osc8Hyperlink(u, fgGreen+u+reset)
		out = append(out, line)
	}
	out = append(out, "")
	out = append(out, muted("  若存在外层路由/NAT/端口映射，客户端实际入口可能不在上表，请以网管说明为准。"))
	return out
}
