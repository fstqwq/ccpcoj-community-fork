package main

import (
	"fmt"
	"os"
	"regexp"
	"strings"
	"sync"
	"time"

	"github.com/eiannone/keyboard"
	"golang.org/x/term"
)

// ANSI（Windows 10+ 在 main 中开启 VT；Linux 默认可用）。
const (
	reset = "\033[0m"
	bold  = "\033[1m"
	dim   = "\033[2m"

	fgCyan   = "\033[36m"
	fgGreen  = "\033[32m"
	fgYellow = "\033[33m"
	fgRed    = "\033[31m"
	fgWhite  = "\033[97m"
	fgGray   = "\033[90m"
)

func title(s string) string {
	return bold + fgCyan + s + reset
}

func okStyle(s string) string {
	return fgGreen + s + reset
}

func warnStyle(s string) string {
	return fgYellow + s + reset
}

func errStyle(s string) string {
	return fgRed + s + reset
}

func muted(s string) string {
	return dim + fgGray + s + reset
}

const (
	logScrollLines = 18
	doubleKeyWait  = 3 * time.Second
)

// 自 hint 首行起的固定偏移（与 paintDashboardFull 中 hint 之后的块顺序严格一致）。
const (
	relAfterHintBlank   = 2
	relStatus           = 3
	relAfterStatusBlank = 4
	relLogTitle         = 5
	relTopSep           = 6
	relLogBody0         = 7
)

func relBottomSep(hintRow, visibleLogLines int) int {
	return hintRow + relLogBody0 + visibleLogLines
}

// 常见 SGR 序列；用于测量「可见宽度」，避免超长行换行打乱 CUP 行号。
var reANSISGR = regexp.MustCompile(`\x1b\[[0-9;]*m`)

func stripANSISGR(s string) string {
	return reANSISGR.ReplaceAllString(s, "")
}

func terminalSize() (cols, rows int) {
	cols, rows, err := term.GetSize(int(os.Stdout.Fd()))
	if err != nil || cols < 40 {
		cols = 80
	}
	if err != nil || rows < 12 {
		rows = 30
	}
	return cols, rows
}

func termCols() int {
	cols, _ := terminalSize()
	return cols
}

func runeTerminalWidth(r rune) int {
	if r == 0 || r < 32 || (r >= 0x7f && r < 0xa0) {
		return 0
	}
	if r >= 0x1100 && (r <= 0x115f ||
		r == 0x2329 || r == 0x232a ||
		(r >= 0x2e80 && r <= 0xa4cf && r != 0x303f) ||
		(r >= 0xac00 && r <= 0xd7a3) ||
		(r >= 0xf900 && r <= 0xfaff) ||
		(r >= 0xfe10 && r <= 0xfe19) ||
		(r >= 0xfe30 && r <= 0xfe6f) ||
		(r >= 0xff00 && r <= 0xff60) ||
		(r >= 0xffe0 && r <= 0xffe6) ||
		(r >= 0x1f300 && r <= 0x1faff)) {
		return 2
	}
	return 1
}

func terminalTextWidth(s string) int {
	w := 0
	for _, r := range s {
		w += runeTerminalWidth(r)
	}
	return w
}

func truncateTerminalText(s string, maxWidth int) string {
	if maxWidth <= 0 {
		return ""
	}
	var b strings.Builder
	w := 0
	for _, r := range s {
		rw := runeTerminalWidth(r)
		if w+rw > maxWidth {
			break
		}
		b.WriteRune(r)
		w += rw
	}
	return b.String()
}

// fitOneTerminalRow 将一行限制在 cols 个可见字符宽内，防止自动换行导致「滚动区」与底部分隔线错位。
func fitOneTerminalRow(s string, cols int) string {
	if cols < 24 {
		cols = 80
	}
	usableCols := cols - 1 // 避免写满最后一列触发 Windows 控制台自动换行。
	plain := stripANSISGR(s)
	if terminalTextWidth(plain) <= usableCols {
		return s
	}
	head := truncateTerminalText(plain, usableCols-1)
	return dim + head + "…" + reset
}

func sepLine(cols int) string {
	if cols < 8 {
		cols = 80
	}
	n := cols - 2
	if n < 4 {
		n = 4
	}
	if n > 200 {
		n = 200
	}
	return dim + strings.Repeat("─", n) + reset
}

var paintStdoutMu sync.Mutex

func cup(row, col int) string {
	return fmt.Sprintf("\033[%d;%dH", row, col)
}

// writeRow 将光标置于 (row,1)，清行并写入单行内容（强制单行宽，避免换行破坏布局）。
func writeRow(row int, s string) {
	cols, rows := terminalSize()
	if row < 1 || row > rows {
		return
	}
	s = fitOneTerminalRow(s, cols)
	paintStdoutMu.Lock()
	defer paintStdoutMu.Unlock()
	_, _ = fmt.Fprint(os.Stdout, cup(row, 1), "\033[2K", s)
}

type uiState struct {
	mu sync.Mutex

	onAppend func()

	cfg *AppConfig

	lines []string

	hint       string
	hintExpire time.Time

	serverRunning bool
	serverPaused  bool

	layMu          sync.Mutex
	hintRow        int // 双键提示第一行（1-based）
	logVisibleRows int
	layoutCols     int
	layoutRows     int
	layoutReady    bool
}

func (u *uiState) SetConfig(cfg *AppConfig) {
	u.mu.Lock()
	defer u.mu.Unlock()
	u.cfg = cfg
}

func (u *uiState) setLayout(row, logVisibleRows, cols, rows int) {
	u.layMu.Lock()
	defer u.layMu.Unlock()
	u.hintRow = row
	u.logVisibleRows = logVisibleRows
	u.layoutCols = cols
	u.layoutRows = rows
	u.layoutReady = true
}

func (u *uiState) readLayout() (hintRow, logVisibleRows, cols, rows int, ok bool) {
	u.layMu.Lock()
	defer u.layMu.Unlock()
	if !u.layoutReady || u.hintRow < 1 {
		return 0, 0, 0, 0, false
	}
	return u.hintRow, u.logVisibleRows, u.layoutCols, u.layoutRows, true
}

func (u *uiState) appendLine(msg string) {
	u.mu.Lock()
	ts := time.Now().Format("15:04:05")
	line := fgGray + ts + reset + " " + msg
	if len(u.lines) >= logScrollLines {
		u.lines = append(u.lines[1:], line)
	} else {
		u.lines = append(u.lines, line)
	}
	cb := u.onAppend
	u.mu.Unlock()
	if cb != nil {
		cb()
	}
}

func (u *uiState) setHint(s string, d time.Duration) {
	u.mu.Lock()
	defer u.mu.Unlock()
	u.hint = s
	if d <= 0 {
		u.hintExpire = time.Time{}
	} else {
		u.hintExpire = time.Now().Add(d)
	}
}

func (u *uiState) clearHint() {
	u.mu.Lock()
	defer u.mu.Unlock()
	u.hint = ""
	u.hintExpire = time.Time{}
}

func (u *uiState) snapshot() (cfg *AppConfig, lines []string, hint string, hintLeft time.Duration, running, paused bool) {
	u.mu.Lock()
	defer u.mu.Unlock()
	cfg = u.cfg
	lines = append([]string(nil), u.lines...)
	hint = u.hint
	if !u.hintExpire.IsZero() && time.Now().Before(u.hintExpire) {
		hintLeft = time.Until(u.hintExpire)
	}
	running = u.serverRunning
	paused = u.serverPaused
	return
}

func (u *uiState) SetServerState(running, paused bool) {
	u.mu.Lock()
	u.serverRunning = running
	u.serverPaused = paused
	u.mu.Unlock()
	if _, _, _, _, ok := u.readLayout(); ok {
		paintStatusRow(u)
	}
}

func clearScreen() {
	paintStdoutMu.Lock()
	defer paintStdoutMu.Unlock()
	_, _ = fmt.Fprint(os.Stdout, "\033[H\033[2J\033[3J")
}

// formatHintLines 固定两行（占位避免布局跳动）。
func formatHintLines(hint string, hintLeft time.Duration) (a, b string) {
	if hint == "" {
		return muted("—"), ""
	}
	if hintLeft > 0 {
		a = warnStyle(hint) + muted(fmt.Sprintf(" （%.1fs）", hintLeft.Seconds()))
	} else {
		a = warnStyle(hint)
	}
	b = ""
	return
}

func formatStatusLine(running, paused bool) string {
	st := muted("服务状态: ")
	if !running {
		return st + errStyle("未运行")
	}
	if paused {
		return st + warnStyle("已暂停")
	}
	return st + okStyle("运行中")
}

func visibleLogLineCount(hintRow, terminalRows int) int {
	start := hintRow + relLogBody0
	visible := terminalRows - start
	if visible < 0 {
		return 0
	}
	if visible > logScrollLines {
		return logScrollLines
	}
	return visible
}

func visibleLogLines(lines []string, count int) []string {
	if count <= 0 || len(lines) == 0 {
		return nil
	}
	if len(lines) <= count {
		return lines
	}
	return lines[len(lines)-count:]
}

func logTitleLine(visible int) string {
	if visible >= logScrollLines {
		return bold + fgWhite + "滚动日志" + reset + muted(fmt.Sprintf("（最近 %d 行，完整日志见 ./log/）", logScrollLines))
	}
	return bold + fgWhite + "滚动日志" + reset + muted(fmt.Sprintf("（窗口较矮，显示最近 %d/%d 行，完整日志见 ./log/）", visible, logScrollLines))
}

// appendShortcutHelp 绘制双键快捷键说明（与 paintDashboardFull 内顺序绑定）。
func appendShortcutHelp(prn func(string)) {
	prn(bold + fgWhite + "快捷键（连按两次同一键，" + fmt.Sprintf("%.0f", doubleKeyWait.Seconds()) + " 秒内）" + reset)
	prn("  " + fgCyan + "c c" + reset + muted(" — 停止服务并重新填写配置"))
	prn("  " + fgCyan + "t t" + reset + muted(" — 暂停接受新连接"))
	prn("  " + fgCyan + "s s" + reset + muted(" — 仅在暂停时：恢复服务"))
	prn("  " + fgCyan + "q q" + reset + muted(" — 退出程序"))
}

// paintDashboardFull 清屏并绘制整块 UI，记录 hint 区首行号供局部重绘。
func paintDashboardFull(u *uiState) {
	cfg, lines, hint, hintLeft, running, paused := u.snapshot()

	cols, rows := terminalSize()
	var outRows []string
	prn := func(s string) {
		outRows = append(outRows, s)
	}

	prn(title("CCPCOJ 内网代理服务"))
	prn("")

	if cfg != nil {
		prn(bold + fgWhite + "当前配置" + reset)
		prn("  " + bold + fgRed + "【务必保密】" + reset + " " + bold + fgYellow + "该公网上游地址切勿泄露，仅限授权环境使用。" + reset)
		prn(fmt.Sprintf("  %s %s", muted("公网上游:"), fgGreen+cfg.PublicURL+reset))
		if cfg.UpstreamPassword != "" {
			prn(fmt.Sprintf("  %s %s", muted("上游访问密码:"), fgGreen+"已配置（密码已隐藏）"+reset))
		} else {
			prn(fmt.Sprintf("  %s %s", muted("上游访问密码:"), fgGreen+"未配置"+reset))
		}
		prn(fmt.Sprintf("  %s %s", muted("内网监听:"), fgGreen+fmt.Sprintf("端口 %d（本机所有网卡）", cfg.ListenPort)+reset))
		// 快捷键放在「局域网访问」之前：多网卡时 URL 行多，终端较矮时若快捷键在后会被 paint 截断整段不显示。
		prn("")
		appendShortcutHelp(prn)
		prn("")
		for _, ln := range LANAccessLines(cfg.ListenPort) {
			prn(ln)
		}
	} else {
		prn(warnStyle("未加载配置"))
		prn(muted("  （请先完成交互配置）"))
		prn(muted("  "))
		prn(muted("  "))
	}
	prn("")

	if cfg == nil {
		appendShortcutHelp(prn)
		prn("")
	}

	hintStart := len(outRows) + 1
	h1, h2 := formatHintLines(hint, hintLeft)
	prn(h1)
	if h2 != "" {
		prn(h2)
	} else {
		prn(muted("—"))
	}
	prn("")
	prn(formatStatusLine(running, paused))
	prn("")
	logVisible := visibleLogLineCount(hintStart, rows)
	prn(logTitleLine(logVisible))
	prn(sepLine(cols))
	vLines := visibleLogLines(lines, logVisible)
	for i := 0; i < logVisible; i++ {
		if i < len(vLines) {
			prn(vLines[i])
		} else {
			prn(dim + "·" + reset)
		}
	}
	prn(sepLine(cols))

	paintStdoutMu.Lock()
	_, _ = fmt.Fprint(os.Stdout, "\033[H\033[2J\033[3J")
	for i, line := range outRows {
		row := i + 1
		if row > rows {
			break
		}
		_, _ = fmt.Fprint(os.Stdout, cup(row, 1), "\033[2K", fitOneTerminalRow(line, cols))
	}
	paintStdoutMu.Unlock()

	u.setLayout(hintStart, logVisible, cols, rows)
}

// paintHintRows 仅重绘双键提示两行（原地）。
func paintHintRows(u *uiState) {
	hR, _, _, _, ok := u.readLayout()
	if !ok {
		paintDashboardFull(u)
		return
	}
	_, _, hint, hintLeft, _, _ := u.snapshot()
	h1, h2 := formatHintLines(hint, hintLeft)
	writeRow(hR, h1)
	if h2 != "" {
		writeRow(hR+1, h2)
	} else {
		writeRow(hR+1, muted("—"))
	}
}

// paintStatusRow 仅重绘服务状态行。
func paintStatusRow(u *uiState) {
	hR, _, _, _, ok := u.readLayout()
	if !ok {
		paintDashboardFull(u)
		return
	}
	_, _, _, _, running, paused := u.snapshot()
	writeRow(hR+relStatus, formatStatusLine(running, paused))
}

// paintLogWindow 仅重绘日志窗口（18 行 + 底部分隔线），实现原地滚动感。
func paintLogWindow(u *uiState) {
	hR, logVisible, layoutCols, layoutRows, ok := u.readLayout()
	if !ok {
		return
	}
	cols, rows := terminalSize()
	newVisible := visibleLogLineCount(hR, rows)
	if cols != layoutCols || rows != layoutRows || newVisible != logVisible {
		u.setLayout(hR, newVisible, cols, rows)
		if logVisible > newVisible {
			for i := newVisible; i < logVisible; i++ {
				writeRow(hR+relLogBody0+i, "")
			}
			writeRow(relBottomSep(hR, logVisible), "")
		}
		logVisible = newVisible
	}
	_, lines, _, _, _, _ := u.snapshot()
	vLines := visibleLogLines(lines, logVisible)
	start := hR + relLogBody0
	writeRow(hR+relLogTitle, logTitleLine(logVisible))
	writeRow(hR+relTopSep, sepLine(cols))
	for i := 0; i < logVisible; i++ {
		if i < len(vLines) {
			writeRow(start+i, vLines[i])
		} else {
			writeRow(start+i, dim+"·"+reset)
		}
	}
	writeRow(relBottomSep(hR, logVisible), sepLine(cols))
}

// paintInteractiveBand 重绘提示区 + 状态行及其间空行（双键倒计时或暂停时状态变化）。
func paintInteractiveBand(u *uiState) {
	hR, _, _, _, ok := u.readLayout()
	if !ok {
		paintDashboardFull(u)
		return
	}
	_, _, hint, hintLeft, running, paused := u.snapshot()
	h1, h2 := formatHintLines(hint, hintLeft)
	writeRow(hR+0, h1)
	if h2 != "" {
		writeRow(hR+1, h2)
	} else {
		writeRow(hR+1, muted("—"))
	}
	writeRow(hR+relAfterHintBlank, "")
	writeRow(hR+relStatus, formatStatusLine(running, paused))
	writeRow(hR+relAfterStatusBlank, "")
}

// drawDashboard 保留为全量重绘（兼容旧调用点）；日志防抖应使用 paintLogWindow。
func drawDashboard(u *uiState) {
	paintDashboardFull(u)
}

type keyLoopAction int

const (
	keyActNone keyLoopAction = iota
	keyActExit
	keyActReconfigure
)

func runKeyboardLoop(u *uiState, cb func(rl rune) (stop bool, act keyLoopAction)) keyLoopAction {
	_ = keyboard.Open()
	defer keyboard.Close()

	keyCh := make(chan rune, 64)
	errCh := make(chan error, 1)
	go func() {
		for {
			ch, key, err := keyboard.GetKey()
			if err != nil {
				errCh <- err
				return
			}
			r := rune(0)
			if ch != 0 {
				r = ch
			} else if key == keyboard.KeyCtrlC {
				r = 'q'
			} else {
				continue
			}
			keyCh <- r
		}
	}()

	var first rune
	var deadline time.Time
	tick := time.NewTicker(120 * time.Millisecond)
	defer tick.Stop()

	for {
		select {
		case err := <-errCh:
			u.appendLine(errStyle("键盘输入结束: " + err.Error()))
			return keyActExit
		case r := <-keyCh:
			rl := r
			if rl >= 'A' && rl <= 'Z' {
				rl = rl - 'A' + 'a'
			}
			if rl != 'c' && rl != 't' && rl != 's' && rl != 'q' {
				first = 0
				deadline = time.Time{}
				u.clearHint()
				paintHintRows(u)
				continue
			}
			if first == 0 {
				first = rl
				deadline = time.Now().Add(doubleKeyWait)
				u.setHint(fmt.Sprintf("已按下「%c」，请在倒计时内再按一次「%c」确认", rl, rl), doubleKeyWait)
				paintHintRows(u)
				continue
			}
			if rl != first {
				first = 0
				deadline = time.Time{}
				u.setHint("操作已取消（两次按键不一致）", 2*time.Second)
				paintHintRows(u)
				time.Sleep(1500 * time.Millisecond)
				u.clearHint()
				paintHintRows(u)
				continue
			}
			first = 0
			deadline = time.Time{}
			u.clearHint()
			stop, act := cb(rl)
			if stop {
				return act
			}
			paintInteractiveBand(u)
			paintLogWindow(u)
		case <-tick.C:
			if deadline.IsZero() {
				continue
			}
			if time.Now().After(deadline) {
				first = 0
				deadline = time.Time{}
				u.clearHint()
				paintHintRows(u)
			} else {
				paintHintRows(u)
			}
		}
	}
}
