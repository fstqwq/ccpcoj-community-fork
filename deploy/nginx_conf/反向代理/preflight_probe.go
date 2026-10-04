package main

import (
	"context"
	"errors"
	"fmt"
	"net/url"
	"os"
	"strings"
	"sync"
	"time"
)

const preflightProbeAttempts = 3
const preflightRetryWait = 2 * time.Second

var (
	preflightHookMu sync.Mutex
	preflightHook   func() // 非 nil 时 SIGINT/SIGTERM 优先走此回调（用于启动前检测中断）
)

func registerPreflightInterrupt(fn func()) {
	preflightHookMu.Lock()
	preflightHook = fn
	preflightHookMu.Unlock()
}

func unregisterPreflightInterrupt() {
	preflightHookMu.Lock()
	preflightHook = nil
	preflightHookMu.Unlock()
}

// tryPreflightInterrupt 由信号 goroutine 调用；若当前处于预检阶段则执行回调并返回 true。
func tryPreflightInterrupt() bool {
	preflightHookMu.Lock()
	fn := preflightHook
	preflightHookMu.Unlock()
	if fn == nil {
		return false
	}
	fn()
	return true
}

func preflightClearLine() {
	_, _ = fmt.Fprint(os.Stderr, "\r\033[2K")
}

func shortProbeErr(err error) string {
	s := err.Error()
	if i := strings.Index(s, "（"); i > 0 {
		s = strings.TrimSpace(s[:i])
	}
	if len(s) > 32 {
		s = strings.TrimSpace(s[:29]) + "…"
	}
	return s
}

// runPreflightUpstreamProbeWithUI 启动前公网检测：简短文案、不闪烁；单次 Ctrl+C（SIGINT）即中断并返回 ErrProbeInterrupted。
func runPreflightUpstreamProbeWithUI(u *url.URL, basicPass string) error {
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	registerPreflightInterrupt(cancel)
	defer unregisterPreflightInterrupt()

	var lastErr error
	for attempt := 1; attempt <= preflightProbeAttempts; attempt++ {
		if attempt > 1 {
			preflightClearLine()
			_, _ = fmt.Fprintf(
				os.Stderr,
				"%s%d 秒后第 %d 次检测  %s\n",
				dim,
				int(preflightRetryWait.Seconds()),
				attempt,
				"（Ctrl+C 中断并重新填写）"+reset,
			)
			select {
			case <-ctx.Done():
				preflightClearLine()
				return ErrProbeInterrupted
			case <-time.After(preflightRetryWait):
			}
		}

		preflightClearLine()
		_, _ = fmt.Fprintf(
			os.Stderr,
			"%s检测公网 %d/%d  %s\n",
			dim,
			attempt,
			preflightProbeAttempts,
			"（Ctrl+C 中断并重新填写）"+reset,
		)

		errCh := make(chan error, 1)
		go func() {
			errCh <- probeUpstreamValidatedCtx(ctx, u, basicPass)
		}()

		select {
		case err := <-errCh:
			if err == nil {
				preflightClearLine()
				_, _ = fmt.Fprintln(os.Stderr, okStyle("公网检测通过。"))
				return nil
			}
			if errors.Is(err, context.Canceled) {
				preflightClearLine()
				return ErrProbeInterrupted
			}
			lastErr = err
			_, _ = fmt.Fprintln(os.Stderr, errStyle(shortProbeErr(err)))
		case <-ctx.Done():
			<-errCh
			preflightClearLine()
			return ErrProbeInterrupted
		}
	}

	preflightClearLine()
	if lastErr == nil {
		lastErr = errors.New("无法连接")
	}
	return lastErr
}
