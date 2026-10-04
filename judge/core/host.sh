#!/bin/bash
# CSGOJ judge2 评测机进程管理脚本
# 用法: ./host.sh {start|restart|stop|status}
# 注意：此脚本只管理当前容器内的 judge_host.py 进程

set -e

# 脚本所在目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
JUDGE_HOST_SCRIPT="$SCRIPT_DIR/judge_host.py"
LOG_DIR="/judge/logs"

# 获取当前容器标识
get_container_id() {
    # 方法1: 从 /proc/self/cgroup 获取容器 ID（最可靠）
    if [ -f /proc/self/cgroup ]; then
        local cgroup=$(grep -oP 'docker/\K[0-9a-f]{64}' /proc/self/cgroup 2>/dev/null | head -1)
        if [ -n "$cgroup" ]; then
            echo "$cgroup"
            return 0
        fi
        # 尝试其他格式（短ID）
        cgroup=$(grep -oP 'docker/\K[0-9a-f]{12}' /proc/self/cgroup 2>/dev/null | head -1)
        if [ -n "$cgroup" ]; then
            echo "$cgroup"
            return 0
        fi
    fi
    
    # 方法2: 从 hostname 获取（容器名称）
    if [ -f /etc/hostname ]; then
        local hostname=$(cat /etc/hostname 2>/dev/null)
        if [ -n "$hostname" ]; then
            echo "$hostname"
            return 0
        fi
    fi
    
    # 方法3: 从环境变量获取
    if [ -n "$HOSTNAME" ]; then
        echo "$HOSTNAME"
        return 0
    fi
    
    return 1
}

# 检查进程是否属于当前容器
is_process_in_container() {
    local pid="$1"
    local current_container_id="$2"
    
    if [ -z "$pid" ] || [ -z "$current_container_id" ]; then
        return 1
    fi
    
    # 方法1: 检查进程的 cgroup 信息
    if [ -f "/proc/$pid/cgroup" ]; then
        local proc_cgroup=$(grep -oP 'docker/\K[0-9a-f]+' "/proc/$pid/cgroup" 2>/dev/null | head -1)
        if [ -n "$proc_cgroup" ]; then
            # 检查是否匹配当前容器（支持完整ID或短ID匹配）
            if [[ "$proc_cgroup" == "$current_container_id"* ]] || [[ "$current_container_id" == "$proc_cgroup"* ]]; then
                return 0
            fi
        fi
    fi
    
    # 方法2: 检查进程的父进程链，看是否由当前容器的 entrypoint.sh 启动
    # entrypoint.sh 通常是 PID 1 或由 PID 1 启动
    local ppid="$pid"
    local max_depth=10
    local depth=0
    
    while [ $depth -lt $max_depth ] && [ "$ppid" != "1" ] && [ "$ppid" != "0" ]; do
        # 检查父进程的命令行
        if [ -f "/proc/$ppid/cmdline" ]; then
            local cmdline=$(cat "/proc/$ppid/cmdline" 2>/dev/null | tr '\0' ' ')
            if echo "$cmdline" | grep -q "entrypoint.sh\|/core/entrypoint.sh"; then
                # 检查父进程的 cgroup 是否匹配
                if [ -f "/proc/$ppid/cgroup" ]; then
                    local parent_cgroup=$(grep -oP 'docker/\K[0-9a-f]+' "/proc/$ppid/cgroup" 2>/dev/null | head -1)
                    if [ -n "$parent_cgroup" ]; then
                        if [[ "$parent_cgroup" == "$current_container_id"* ]] || [[ "$current_container_id" == "$parent_cgroup"* ]]; then
                            return 0
                        fi
                    fi
                fi
            fi
        fi
        # 获取父进程的 PID
        ppid=$(ps -o ppid= -p "$ppid" 2>/dev/null | tr -d ' ')
        depth=$((depth + 1))
    done
    
    # 方法3: 检查进程的工作目录（如果进程在 /core 目录下运行）
    if [ -f "/proc/$pid/cwd" ]; then
        local cwd=$(readlink "/proc/$pid/cwd" 2>/dev/null || true)
        if [ -n "$cwd" ] && [[ "$cwd" == "/core"* ]]; then
            # 进一步验证：检查进程的命令行是否匹配
            if [ -f "/proc/$pid/cmdline" ]; then
                local cmdline=$(cat "/proc/$pid/cmdline" 2>/dev/null | tr '\0' ' ')
                if echo "$cmdline" | grep -q "judge_host.py"; then
                    # 最后验证：检查进程的 cgroup
                    if [ -f "/proc/$pid/cgroup" ]; then
                        local proc_cgroup=$(grep -oP 'docker/\K[0-9a-f]+' "/proc/$pid/cgroup" 2>/dev/null | head -1)
                        if [ -n "$proc_cgroup" ]; then
                            # 如果 cgroup 存在，必须匹配；如果不存在，可能是宿主机进程，拒绝
                            if [[ "$proc_cgroup" == "$current_container_id"* ]] || [[ "$current_container_id" == "$proc_cgroup"* ]]; then
                                return 0
                            fi
                        fi
                    fi
                fi
            fi
        fi
    fi
    
    return 1
}

# 查找当前容器内的 judge_host.py 进程 PID
find_judge_pid() {
    local current_container_id=$(get_container_id)
    
    if [ -z "$current_container_id" ]; then
        echo "⚠️  警告: 无法确定容器标识，可能无法正确识别进程" >&2
    fi
    
    # 查找所有 judge_host.py 进程
    local all_pids=$(pgrep -f "python3.*judge_host.py" 2>/dev/null || true)
    
    if [ -z "$all_pids" ]; then
        # 备用方法
        all_pids=$(ps aux | grep "[p]ython3.*judge_host.py" | awk '{print $2}' | tr '\n' ' ')
    fi
    
    # 过滤出属于当前容器的进程
    local container_pids=""
    for pid in $all_pids; do
        if is_process_in_container "$pid" "$current_container_id"; then
            container_pids="$container_pids $pid"
        fi
    done
    
    echo "$container_pids" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//'
}

# 检查进程是否运行
is_running() {
    local pid="$1"
    if [ -z "$pid" ]; then
        return 1
    fi
    kill -0 "$pid" 2>/dev/null
}

# 显示进程状态
show_status() {
    local current_container_id=$(get_container_id)
    local container_name=""
    
    if [ -n "$current_container_id" ]; then
        # 尝试获取容器名称
        if [ -f /etc/hostname ]; then
            container_name=$(cat /etc/hostname)
        fi
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        if [ -n "$container_name" ]; then
            echo "  容器: $container_name"
        fi
        echo "  容器ID: ${current_container_id:0:12}..."
    else
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    fi
    
    local pids=$(find_judge_pid)
    if [ -z "$pids" ]; then
        echo "  状态: judge_host.py 未运行（当前容器）"
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        return 1
    else
        echo "  状态: judge_host.py 正在运行（当前容器）"
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        for pid in $pids; do
            if is_running "$pid"; then
                echo "  PID: $pid"
                # 显示进程信息
                ps -p "$pid" -o pid,ppid,cmd --no-headers 2>/dev/null | sed 's/^/    /' || true
            fi
        done
        echo ""
        return 0
    fi
}

# 启动 judge_host.py
start_judge() {
    local pids=$(find_judge_pid)
    
    # 检查是否已有进程在运行
    local running_pids=""
    for pid in $pids; do
        if is_running "$pid"; then
            running_pids="$running_pids $pid"
        fi
    done
    
    if [ -n "$running_pids" ]; then
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo "  ⚠️  judge_host.py 已在运行（当前容器）"
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        show_status
        return 1
    fi
    
    # 检查脚本是否存在
    if [ ! -f "$JUDGE_HOST_SCRIPT" ]; then
        echo "❌ 错误: 找不到 judge_host.py ($JUDGE_HOST_SCRIPT)" >&2
        return 1
    fi
    
    # 确保日志目录存在
    mkdir -p "$LOG_DIR" 2>/dev/null || true
    
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "  启动 judge_host.py（当前容器）"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    
    # 在后台启动进程
    cd "$SCRIPT_DIR"
    python3 "$JUDGE_HOST_SCRIPT" >/dev/null 2>&1 &
    local new_pid=$!
    
    # 等待一下，检查进程是否成功启动
    sleep 1
    if is_running "$new_pid"; then
        echo "  ✅ judge_host.py 已启动"
        echo "  PID: $new_pid"
        echo ""
        echo "💡 提示："
        echo "  • 查看日志: tail -f $LOG_DIR/tmp.log"
        echo "  • 查看状态: $0 status"
        echo "  • 停止进程: $0 stop"
        echo ""
        return 0
    else
        echo "  ❌ judge_host.py 启动失败"
        wait $new_pid 2>/dev/null || true
        return 1
    fi
}

# 停止 judge_host.py（优雅停止）
stop_judge() {
    local pids=$(find_judge_pid)
    
    # 检查是否有进程在运行
    local running_pids=""
    for pid in $pids; do
        if is_running "$pid"; then
            running_pids="$running_pids $pid"
        fi
    done
    
    if [ -z "$running_pids" ]; then
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo "  ⚠️  judge_host.py 未运行（当前容器）"
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        return 0
    fi
    
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "  停止 judge_host.py（当前容器）"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    
    # 发送 SIGTERM 信号（优雅停止）
    for pid in $running_pids; do
        echo "  正在停止进程 PID: $pid..."
        kill -TERM "$pid" 2>/dev/null || true
    done
    
    # 等待进程退出（最多等待10秒）
    local max_wait=10
    local waited=0
    while [ $waited -lt $max_wait ]; do
        local still_running=false
        for pid in $running_pids; do
            if is_running "$pid"; then
                still_running=true
                break
            fi
        done
        
        if [ "$still_running" = false ]; then
            echo "  ✅ 所有进程已优雅退出"
            echo ""
            return 0
        fi
        
        sleep 1
        waited=$((waited + 1))
    done
    
    # 如果10秒后仍未退出，强制终止
    echo "  ⚠️  部分进程未在10秒内退出，强制终止..."
    for pid in $running_pids; do
        if is_running "$pid"; then
            kill -KILL "$pid" 2>/dev/null || true
            echo "    已强制终止 PID: $pid"
        fi
    done
    
    echo "  ✅ 所有进程已停止"
    echo ""
    return 0
}

# 重启 judge_host.py
restart_judge() {
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "  重启 judge_host.py（当前容器）"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    
    # 先停止
    stop_judge
    
    # 等待一下，确保进程完全退出
    sleep 1
    
    # 再启动
    start_judge
}

# 显示帮助信息
show_help() {
    cat << EOF
CSGOJ judge2 评测机进程管理脚本

用法:
  $0 {start|restart|stop|status}

命令:
  start     启动 judge_host.py 进程（当前容器）
  restart   重启 judge_host.py 进程（当前容器，先停止再启动）
  stop      停止 judge_host.py 进程（当前容器，优雅停止）
  status    显示 judge_host.py 进程状态（当前容器）

示例:
  $0 start      # 启动进程
  $0 stop       # 停止进程
  $0 restart    # 重启进程
  $0 status     # 查看状态

注意:
  • 此脚本只管理当前容器内的 judge_host.py 进程
  • 由于使用了 --pid=host，容器内能看到所有容器的进程
  • 脚本通过 cgroup 和进程树识别当前容器的进程
  • stop 命令会发送 SIGTERM 信号，允许进程优雅退出
  • 如果进程在10秒内未退出，会自动强制终止（SIGKILL）
  • 进程在后台运行，日志输出到 $LOG_DIR/tmp.log

EOF
}

# 主逻辑
case "${1:-}" in
    start)
        start_judge
        ;;
    stop)
        stop_judge
        ;;
    restart)
        restart_judge
        ;;
    status)
        show_status
        ;;
    help|--help|-h)
        show_help
        ;;
    "")
        echo "❌ 错误: 请指定命令 (start|restart|stop|status)" >&2
        echo ""
        show_help
        exit 1
        ;;
    *)
        echo "❌ 错误: 未知命令 '$1'" >&2
        echo ""
        show_help
        exit 1
        ;;
esac



