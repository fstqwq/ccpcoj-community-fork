package main

import (
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"runtime"
	"strconv"
	"strings"
	"syscall"
	"time"

	"golang.org/x/term"
)

const (
	instanceLockFile = "instance.lock"
	instancePidFile  = "instance.pid"
)

// replaceExistingFlag 由命令行 --replace / --kill-existing 设置（见 parseReplaceFlags）。
var replaceExistingFlag bool

// envConfigMode 为 true 时表示 flg_env 环境变量配置模式（如容器内无 TTY，单实例冲突时等同 --replace）。
var envConfigMode bool

func parseReplaceFlags() {
	for _, a := range os.Args[1:] {
		switch a {
		case "--replace", "--kill-existing", "-replace":
			replaceExistingFlag = true
		}
	}
}

func instanceLockPath() string {
	return filepath.Join(workDir, instanceLockFile)
}

func instancePidPath() string {
	return filepath.Join(workDir, instancePidFile)
}

func readInstancePID() (int, error) {
	b, err := os.ReadFile(instancePidPath())
	if err != nil {
		return 0, err
	}
	s := strings.TrimSpace(string(b))
	if s == "" {
		return 0, errors.New("空 PID 文件")
	}
	return strconv.Atoi(s)
}

func writeInstancePID() error {
	tmp := instancePidPath() + ".tmp"
	pid := fmt.Sprintf("%d\n", os.Getpid())
	if err := os.WriteFile(tmp, []byte(pid), 0600); err != nil {
		return err
	}
	return os.Rename(tmp, instancePidPath())
}

func tryKillInstance(pid int) error {
	p, err := os.FindProcess(pid)
	if err != nil {
		return err
	}
	defer func() { _ = p.Release() }()

	if runtime.GOOS == "windows" {
		if err := p.Kill(); err != nil {
			return err
		}
		for i := 0; i < 40; i++ {
			time.Sleep(100 * time.Millisecond)
			if !pidAlive(pid) {
				return nil
			}
		}
		return errors.New("旧进程未在预期时间内退出")
	}
	if err := p.Signal(syscall.SIGTERM); err != nil {
		return err
	}
	for i := 0; i < 40; i++ {
		time.Sleep(100 * time.Millisecond)
		if !pidAlive(pid) {
			return nil
		}
	}
	if err := p.Signal(syscall.SIGKILL); err != nil {
		return err
	}
	for i := 0; i < 20; i++ {
		time.Sleep(100 * time.Millisecond)
		if !pidAlive(pid) {
			return nil
		}
	}
	return errors.New("旧进程未在预期时间内退出")
}

func removeInstanceArtifacts() {
	_ = os.Remove(instancePidPath())
	_ = os.Remove(instanceLockPath())
}

func printNonInteractiveConflictHelp(oldPID int) {
	prog := filepath.Base(os.Args[0])
	msg := fmt.Sprintf(`
%s 检测到已有实例在运行（PID %d），当前无法从本窗口读取键盘输入。

请任选其一：
  1) 在「命令提示符 / PowerShell / 终端」里再次运行本程序，按提示输入 1 或 2；
  2) 或运行（将自动结束旧进程后启动）：
       %s --replace

若已无旧进程，可删除程序同目录下遗留的锁与状态文件后重试。
`, title("  单实例冲突  "), oldPID, prog)
	fmt.Fprint(os.Stderr, msg)
}

// acquireSingleInstance 保证工作目录下仅一个实例；返回退出时调用的清理函数。
func acquireSingleInstance() (cleanup func()) {
	parseReplaceFlags()
	lockPath := instanceLockPath()

retryLock:
	for {
		lf, err := os.OpenFile(lockPath, os.O_CREATE|os.O_EXCL, 0600)
		if err == nil {
			_ = lf.Close()
			if err := writeInstancePID(); err != nil {
				removeInstanceArtifacts()
				fmt.Fprintln(os.Stderr, errStyle("无法写入运行状态: "+err.Error()))
				os.Exit(1)
			}
			return func() {
				removeInstanceArtifacts()
			}
		}

		if !errors.Is(err, os.ErrExist) {
			fmt.Fprintln(os.Stderr, errStyle("无法创建启动锁: "+err.Error()))
			os.Exit(1)
		}

		oldPID, readErr := readInstancePID()
		if readErr != nil || oldPID <= 0 || !pidAlive(oldPID) {
			removeInstanceArtifacts()
			continue retryLock
		}

		if oldPID == os.Getpid() {
			removeInstanceArtifacts()
			continue retryLock
		}

		pidPath := instancePidPath()

		// 无交互环境（如双击 / Docker）：读 stdin 会立刻 EOF → 原先会直接 os.Exit(1) 像「闪退」
		if replaceExistingFlag || (envConfigMode && !term.IsTerminal(int(os.Stdin.Fd()))) {
			fmt.Fprintln(os.Stderr, dim+"已指定 --replace，正在结束旧进程 PID "+strconv.Itoa(oldPID)+" …"+reset)
			if ke := tryKillInstance(oldPID); ke != nil {
				fmt.Fprintln(os.Stderr, errStyle("无法结束进程: "+ke.Error()))
				os.Exit(1)
			}
			if pidAlive(oldPID) {
				fmt.Fprintln(os.Stderr, errStyle("进程仍在运行。"))
				os.Exit(1)
			}
			removeInstanceArtifacts()
			fmt.Fprintln(os.Stderr, okStyle("旧进程已结束，继续启动…"))
			continue retryLock
		}

		if !term.IsTerminal(int(os.Stdin.Fd())) {
			printNonInteractiveConflictHelp(oldPID)
			fmt.Fprintln(os.Stderr, warnStyle("窗口将在 12 秒后关闭…"))
			time.Sleep(12 * time.Second)
			os.Exit(1)
		}

		fmt.Println()
		fmt.Println(dim + strings.Repeat("─", 56) + reset)
		fmt.Println(title("  已有实例正在运行  "))
		fmt.Println(dim + strings.Repeat("─", 56) + reset)
		fmt.Printf("  %s %s\n", muted("工作目录:"), fgGreen+workDir+reset)
		fmt.Printf("  %s %s\n", muted("PID 文件:"), fgGreen+pidPath+reset)
		fmt.Printf("  %s %s\n", muted("进程 PID:"), bold+fgYellow+strconv.Itoa(oldPID)+reset)
		fmt.Println()
		fmt.Println(muted("  同一程序目录下仅允许一个进程，避免端口与配置冲突。"))
		fmt.Println(muted("  若旧窗口已关仍出现本提示，可选 2 清理残留锁并结束僵尸进程。"))
		fmt.Println()
		fmt.Println("  " + fgCyan + "1" + reset + muted(" — 退出，保留当前实例（另一窗口仍在用时选此项）"))
		fmt.Println("  " + fgCyan + "2" + reset + muted(" — 强制结束上述 PID，并由本窗口继续启动"))
		fmt.Println("       " + warnStyle("旧实例会立即断开，未保存操作将丢失。"))
		fmt.Println("  " + muted("（双击无终端时可用命令行加参数：") + fgCyan + "--replace" + muted("）"))
		fmt.Println()

		for {
			fmt.Print(dim + "请输入 1 或 2: " + reset)
			choice, e := readLine("")
			if e != nil {
				fmt.Fprintln(os.Stderr, errStyle("读取输入失败: "+e.Error()))
				fmt.Fprintln(os.Stderr, muted("若从资源管理器双击启动，请改用终端运行，或追加参数 --replace"))
				os.Exit(1)
			}
			switch strings.TrimSpace(choice) {
			case "1", "q", "Q", "exit", "no", "n":
				fmt.Println(muted("已取消启动。"))
				os.Exit(0)
			case "2", "y", "Y", "yes", "force", "kill":
				fmt.Println(dim + "正在结束旧进程…" + reset)
				if ke := tryKillInstance(oldPID); ke != nil {
					fmt.Println(errStyle("无法结束进程: " + ke.Error()))
					fmt.Println(warnStyle("请手动结束 PID " + strconv.Itoa(oldPID) + " 后重试，或检查权限。"))
					os.Exit(1)
				}
				if pidAlive(oldPID) {
					fmt.Println(errStyle("进程仍在运行，请稍后重试或手动结束。"))
					os.Exit(1)
				}
				removeInstanceArtifacts()
				fmt.Println(okStyle("旧进程已结束，继续启动本实例…"))
				fmt.Println()
				continue retryLock
			default:
				fmt.Println(warnStyle("请输入 1 或 2。"))
			}
		}
	}
}
