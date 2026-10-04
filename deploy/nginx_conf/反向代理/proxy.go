package main

import (
	"bytes"
	"crypto/tls"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/http/httputil"
	"net/url"
	"path/filepath"
	"strings"
	"sync"
	"time"
)

const cacheTTL = time.Minute

const maxCacheBody = 20 << 20 // 20 MiB

// 常见静态资源扩展名（小写比较）。
// 不含 .html/.htm：页面常含登录态等会话相关内容，缓存键不含 Cookie，误缓存会导致登录后仍显示未登录。
var staticExt = map[string]struct{}{
	".js": {}, ".mjs": {}, ".cjs": {}, ".css": {}, ".json": {}, ".map": {},
	".webp": {}, ".png": {}, ".jpg": {}, ".jpeg": {}, ".gif": {}, ".svg": {}, ".ico": {}, ".bmp": {},
	".woff": {}, ".woff2": {}, ".ttf": {}, ".eot": {}, ".otf": {},
	".xml": {}, ".txt": {}, ".md": {},
	".wasm": {}, ".mp4": {}, ".webm": {}, ".mp3": {}, ".ogg": {}, ".pdf": {},
	".zip": {}, ".gz": {}, ".br": {}, ".avif": {},
}

func pathLooksStatic(p string) bool {
	ext := strings.ToLower(filepath.Ext(p))
	if ext == "" {
		return false
	}
	_, ok := staticExt[ext]
	return ok
}

type cacheEntry struct {
	status  int
	header  http.Header
	body    []byte
	expires time.Time
}

type responseCache struct {
	mu    sync.RWMutex
	items map[string]*cacheEntry
}

func newResponseCache() *responseCache {
	return &responseCache{items: make(map[string]*cacheEntry)}
}

func cacheKey(req *http.Request) string {
	return req.Method + " " + req.URL.RequestURI()
}

func (c *responseCache) get(key string) (*cacheEntry, bool) {
	c.mu.RLock()
	defer c.mu.RUnlock()
	e, ok := c.items[key]
	if !ok || time.Now().After(e.expires) {
		return nil, false
	}
	return e, true
}

func (c *responseCache) set(key string, e *cacheEntry) {
	c.mu.Lock()
	defer c.mu.Unlock()
	if len(c.items) > 8000 {
		c.items = make(map[string]*cacheEntry)
	}
	c.items[key] = e
}

func cloneHeader(h http.Header) http.Header {
	if h == nil {
		return nil
	}
	return h.Clone()
}

func buildCachedResponse(e *cacheEntry) *http.Response {
	h := cloneHeader(e.header)
	h.Set("X-Cache", "HIT")
	return &http.Response{
		StatusCode: e.status,
		Proto:      "HTTP/1.1",
		ProtoMajor: 1,
		ProtoMinor: 1,
		Header:     h,
		Body:       io.NopCloser(bytes.NewReader(e.body)),
	}
}

func clientIP(req *http.Request) string {
	host, _, err := net.SplitHostPort(req.RemoteAddr)
	if err == nil && host != "" {
		return host
	}
	if h := strings.TrimSpace(req.RemoteAddr); h != "" {
		return h
	}
	return "-"
}

type cachingRoundTripper struct {
	base  http.RoundTripper
	cache *responseCache
}

func (t *cachingRoundTripper) RoundTrip(req *http.Request) (*http.Response, error) {
	if req.Method == http.MethodGet && pathLooksStatic(req.URL.Path) {
		if e, ok := t.cache.get(cacheKey(req)); ok {
			return buildCachedResponse(e), nil
		}
	}
	resp, err := t.base.RoundTrip(req)
	if err != nil {
		return resp, err
	}
	if req.Method != http.MethodGet || !pathLooksStatic(req.URL.Path) {
		return resp, nil
	}
	if resp.StatusCode != http.StatusOK {
		return resp, nil
		// 304 等不写入整 body 缓存
	}
	ct := resp.Header.Get("Content-Type")
	if strings.HasPrefix(ct, "text/event-stream") {
		return resp, nil
	}
	body, err := io.ReadAll(resp.Body)
	resp.Body.Close()
	if err != nil {
		return nil, err
	}
	if int64(len(body)) > maxCacheBody {
		resp.Body = io.NopCloser(bytes.NewReader(body))
		return resp, nil
	}
	entry := &cacheEntry{
		status:  resp.StatusCode,
		header:  resp.Header.Clone(),
		body:    append([]byte(nil), body...),
		expires: time.Now().Add(cacheTTL),
	}
	t.cache.set(cacheKey(req), entry)
	resp.Body = io.NopCloser(bytes.NewReader(body))
	resp.Header.Set("X-Cache", "MISS")
	return resp, nil
}

func newReverseProxy(target *url.URL, cfg *AppConfig, ui *uiState) http.Handler {
	cache := newResponseCache()
	base := &http.Transport{
		Proxy:                 http.ProxyFromEnvironment,
		ForceAttemptHTTP2:     true,
		MaxIdleConns:          512,
		MaxIdleConnsPerHost:   128,
		IdleConnTimeout:       90 * time.Second,
		TLSHandshakeTimeout:   12 * time.Second,
		ExpectContinueTimeout: 1 * time.Second,
		TLSClientConfig:       &tls.Config{MinVersion: tls.VersionTLS12},
	}
	rt := &cachingRoundTripper{base: base, cache: cache}

	proxy := httputil.NewSingleHostReverseProxy(target)
	proxy.Transport = rt
	proxy.FlushInterval = -1
	orig := proxy.Director
	proxy.Director = func(req *http.Request) {
		orig(req)
		req.Host = target.Host
		req.Header.Set("X-Forwarded-Host", req.Host)
		if cip := req.Header.Get("X-Real-IP"); cip == "" {
			req.Header.Set("X-Real-IP", clientIP(req))
		}
		if cfg != nil && cfg.UpstreamPassword != "" {
			req.SetBasicAuth(upstreamBasicUser, cfg.UpstreamPassword)
		}
	}

	proxy.ErrorHandler = func(w http.ResponseWriter, r *http.Request, err error) {
		msg := fmt.Sprintf("来源IP=%s 上游错误 %s %v", clientIP(r), r.URL.Path, err)
		writeErrorLine(msg)
		ui.appendLine(errStyle(msg))
		http.Error(w, "Bad Gateway", http.StatusBadGateway)
	}

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		wrap := &statusWriter{ResponseWriter: w, code: http.StatusOK}
		defer func() {
			d := time.Since(start)
			line := fmt.Sprintf("来源IP=%s %s %s %d %v", clientIP(r), r.Method, r.URL.RequestURI(), wrap.code, d)
			if wrap.code >= 400 {
				writeErrorLine(line)
				if wrap.code >= 500 {
					ui.appendLine(errStyle(line))
				} else {
					ui.appendLine(warnStyle(line))
				}
			} else {
				writeInfoLine(line)
				ui.appendLine(okStyle(line))
			}
		}()
		proxy.ServeHTTP(wrap, r)
	})
}

type statusWriter struct {
	http.ResponseWriter
	code int
}

func (s *statusWriter) WriteHeader(code int) {
	s.code = code
	s.ResponseWriter.WriteHeader(code)
}

func (s *statusWriter) Write(b []byte) (int, error) {
	if s.code == 0 {
		s.code = http.StatusOK
	}
	return s.ResponseWriter.Write(b)
}

func serveProxy(cfg *AppConfig, ui *uiState) (*http.Server, error) {
	u, err := url.Parse(cfg.PublicURL)
	if err != nil {
		return nil, err
	}
	h := newReverseProxy(u, cfg, ui)
	addr := fmt.Sprintf(":%d", cfg.ListenPort)
	ln, err := net.Listen("tcp", addr)
	if err != nil {
		return nil, err
	}
	srv := &http.Server{
		Handler:           h,
		ReadHeaderTimeout: 20 * time.Second,
		ReadTimeout:       0,
		WriteTimeout:      0,
		IdleTimeout:       120 * time.Second,
		MaxHeaderBytes:    1 << 20,
	}
	go func() {
		if err := srv.Serve(ln); err != nil && err != http.ErrServerClosed {
			msg := "监听退出: " + err.Error()
			writeErrorLine(msg)
			ui.appendLine(errStyle(msg))
		}
	}()
	return srv, nil
}
