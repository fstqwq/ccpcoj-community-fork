#!/bin/bash
# 注意：不使用 set -e，允许主进程退出后容器继续运行

# 日志目录
LOG_DIR="/judge/logs"
TMP_LOG="$LOG_DIR/tmp.log"

# 确保日志目录存在
mkdir -p "$LOG_DIR"

# 启动 judge_host.py 的函数
start_judge_host() {
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "  启动 judge_host.py"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    python3 /core/judge_host.py &
    JUDGE_PID=$!
    echo "  judge_host.py 已启动，PID: $JUDGE_PID"
    echo ""
}

# 初始化变量
JUDGE_PID=""
TAIL_PID=""
SHOULD_EXIT=false

# 信号处理函数：仅在收到容器退出信号时才退出
cleanup() {
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "  收到容器退出信号，正在清理..."
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    SHOULD_EXIT=true
    # 停止 tail 进程（如果已启动）
    if [ -n "$TAIL_PID" ]; then
        kill $TAIL_PID 2>/dev/null || true
        wait $TAIL_PID 2>/dev/null || true
    fi
    # 转发信号给主进程（如果还在运行）
    if [ -n "$JUDGE_PID" ] && kill -0 $JUDGE_PID 2>/dev/null; then
        kill -TERM $JUDGE_PID 2>/dev/null || true
        wait $JUDGE_PID 2>/dev/null || true
    fi
    exit 0
}

trap cleanup SIGTERM SIGINT

# 启动 judge_host.py
start_judge_host

# 等待日志文件创建（最多30秒）
echo "等待日志文件创建..."
for i in {1..30}; do
    if [ -f "$TMP_LOG" ]; then
        echo "日志文件已创建: $TMP_LOG"
        break
    fi
    # 检查主进程是否还在运行
    if [ -n "$JUDGE_PID" ] && ! kill -0 $JUDGE_PID 2>/dev/null; then
        echo "⚠️  judge_host.py 进程已退出（退出码: $(wait $JUDGE_PID; echo $?)）"
        JUDGE_PID=""
        break
    fi
    sleep 1
done

# 如果日志文件仍然不存在，继续等待（可能日志级别设置导致延迟）
if [ ! -f "$TMP_LOG" ] && [ -n "$JUDGE_PID" ]; then
    echo "警告: tmp.log 文件未在预期时间内创建，继续等待..."
    # 继续等待，直到文件创建或进程退出
    while [ ! -f "$TMP_LOG" ] && [ -n "$JUDGE_PID" ]; do
        if ! kill -0 $JUDGE_PID 2>/dev/null; then
            echo "⚠️  judge_host.py 进程已退出（退出码: $(wait $JUDGE_PID; echo $?)），但日志文件未创建"
            JUDGE_PID=""
            break
        fi
        sleep 1
    done
    if [ -f "$TMP_LOG" ]; then
        echo "日志文件已创建: $TMP_LOG"
    fi
fi

# 如果日志文件存在，使用 tail -f 监控
if [ -f "$TMP_LOG" ]; then
    tail -f "$TMP_LOG" &
    TAIL_PID=$!
fi

# 主循环：监控 judge_host.py 进程
while true; do
    # 如果收到退出信号，退出循环
    if [ "$SHOULD_EXIT" = true ]; then
        break
    fi
    
    # 如果 judge_host.py 正在运行，等待它
    if [ -n "$JUDGE_PID" ] && kill -0 $JUDGE_PID 2>/dev/null; then
        wait $JUDGE_PID
        EXIT_CODE=$?
        echo ""
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo "  ⚠️  judge_host.py 进程已退出"
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo "  退出码: $EXIT_CODE"
        echo "  容器将继续运行，方便调试"
        echo ""
        echo "💡 提示："
        echo "  • 可以手动重启: python3 /core/judge_host.py &"
        echo "  • 查看日志: tail -f $TMP_LOG"
        echo "  • 进入容器调试: docker exec -it <容器名> /bin/bash"
        echo "  • 停止容器: docker stop <容器名>"
        echo ""
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo "  容器保持运行中..."
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo ""
        JUDGE_PID=""
        # 继续运行，保持容器活跃
        # 如果日志文件存在，继续 tail
        if [ -f "$TMP_LOG" ] && [ -z "$TAIL_PID" ]; then
            tail -f "$TMP_LOG" &
            TAIL_PID=$!
        elif [ -n "$TAIL_PID" ] && ! kill -0 $TAIL_PID 2>/dev/null; then
            # tail 进程已退出，重新启动
            if [ -f "$TMP_LOG" ]; then
                tail -f "$TMP_LOG" &
                TAIL_PID=$!
            fi
        fi
    fi
    
    # 如果 judge_host.py 未运行，保持容器运行（每10秒检查一次）
    sleep 10
done

