package main

import (
	"fmt"
	"os"
	"path/filepath"
	"sync"
	"time"
)

const logDirName = "log"

var (
	logMu    sync.Mutex
	infoHour string
	errHour  string
	infoFile *os.File
	errFile  *os.File
	logRoot  string
	// 容器内 flg_env + OJ_PROXY_DOCKER_DEV_LOGS=1 时，将写入文件的同一行再打到 stderr，便于 docker logs 查看。
	mirrorLogLinesToStderr bool
)

// enableMirrorLogToStderr 由 main 在解析环境后调用；与文件日志共用 writeInfoLine/writeErrorLine 路径。
func enableMirrorLogToStderr() {
	mirrorLogLinesToStderr = true
}

func initLogFiles(root string) error {
	logRoot = filepath.Join(root, logDirName)
	return os.MkdirAll(logRoot, 0755)
}

func hourlyPath(kind string) string {
	h := time.Now().Format("2006010215")
	return filepath.Join(logRoot, fmt.Sprintf("%s_%s.log", kind, h))
}

func rotateIfNeeded(kind string, hour *string, f **os.File) error {
	h := time.Now().Format("2006010215")
	if *f != nil && *hour == h {
		return nil
	}
	if *f != nil {
		_ = (*f).Close()
		*f = nil
	}
	path := hourlyPath(kind)
	ff, err := os.OpenFile(path, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644)
	if err != nil {
		return err
	}
	*f = ff
	*hour = h
	return nil
}

func writeInfoLine(msg string) {
	ts := time.Now().Format("2006-01-02 15:04:05")
	line := ts + " " + msg + "\n"
	logMu.Lock()
	defer logMu.Unlock()
	if err := rotateIfNeeded("info", &infoHour, &infoFile); err != nil {
		return
	}
	_, _ = infoFile.WriteString(line)
	if mirrorLogLinesToStderr {
		_, _ = os.Stderr.WriteString(line)
	}
}

func writeErrorLine(msg string) {
	ts := time.Now().Format("2006-01-02 15:04:05")
	line := ts + " " + msg + "\n"
	logMu.Lock()
	defer logMu.Unlock()
	if err := rotateIfNeeded("error", &errHour, &errFile); err != nil {
		return
	}
	_, _ = errFile.WriteString(line)
	if mirrorLogLinesToStderr {
		_, _ = os.Stderr.WriteString(line)
	}
}

func closeLogFiles() {
	logMu.Lock()
	defer logMu.Unlock()
	if infoFile != nil {
		_ = infoFile.Close()
		infoFile = nil
	}
	if errFile != nil {
		_ = errFile.Close()
		errFile = nil
	}
}
