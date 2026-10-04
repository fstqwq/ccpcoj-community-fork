"""
任务状态码 —— 与 deploy_files/SQL/csg_oj_base.sql 中 backtask.status 定义一致。
"""

PENDING = 0
RUNNING = 10
STOPPING = 15
COMPLETED = 20
FAILED = 30
CANCELLED = 40

LABEL = {
    PENDING: "待执行",
    RUNNING: "执行中",
    STOPPING: "停止中",
    COMPLETED: "已完成",
    FAILED: "失败",
    CANCELLED: "已取消",
}

LABEL_EN = {
    PENDING: "Pending",
    RUNNING: "Running",
    STOPPING: "Stopping",
    COMPLETED: "Completed",
    FAILED: "Failed",
    CANCELLED: "Cancelled",
}

TERMINAL_STATES = frozenset({COMPLETED, FAILED, CANCELLED})
