//go:build windows

package main

import "golang.org/x/sys/windows"

func enableWindowsANSI() {
	h, err := windows.GetStdHandle(windows.STD_OUTPUT_HANDLE)
	if err != nil {
		return
	}
	var mode uint32
	if err := windows.GetConsoleMode(h, &mode); err != nil {
		return
	}
	_ = windows.SetConsoleMode(h, mode|windows.ENABLE_VIRTUAL_TERMINAL_PROCESSING)
	// stderr
	h2, err := windows.GetStdHandle(windows.STD_ERROR_HANDLE)
	if err != nil {
		return
	}
	if err := windows.GetConsoleMode(h2, &mode); err != nil {
		return
	}
	_ = windows.SetConsoleMode(h2, mode|windows.ENABLE_VIRTUAL_TERMINAL_PROCESSING)
}
