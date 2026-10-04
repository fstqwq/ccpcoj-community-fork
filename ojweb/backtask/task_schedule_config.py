"""
后台任务「调度与注册」配置（易变项集中于此）。

- 各段在**使用处附近 import**，可读性与顶层 import 等价（模块加载时执行一次，无额外运行时开销）。
- **不做**自动发现；入队模块登记在 ``QUEUED_TASK_MODULES``，周期任务在 ``INTERVAL_JOBS`` / ``CRON_JOBS``。
"""
import logging
from types import ModuleType
from typing import Any, Callable, Dict, Tuple

from backtask.core.factory import register
from backtask.core.scheduler import SimpleScheduler

logger = logging.getLogger("backtask.task_schedule_config")

# ── 入队型（PHP create_ajax → poll_and_run 执行）────────────────────────────
from backtask.task_queue import problem_export as _mod_problem_export  # 题目 ZIP 导出
from backtask.task_queue import problem_import as _mod_problem_import  # 题目 ZIP 导入
from backtask.task_queue import contest_export as _mod_contest_export  # 比赛归档导出
from backtask.task_queue import contest_import as _mod_contest_import  # 比赛包导入

QUEUED_TASK_MODULES: Tuple[ModuleType, ...] = (
    _mod_problem_export,
    _mod_problem_import,
    _mod_contest_export,
    _mod_contest_import,
)

# ── 轮询：认领 pending / 超时与僵尸检查 ───────────────────────────────────
from backtask.core.runner import poll_and_run  # 从 DB 认领并入池执行入队任务
from backtask.core.cleanup import check_stopping_tasks, check_timeout_tasks

INTERVAL_JOBS: Tuple[Dict[str, Any], ...] = (
    {"func": poll_and_run, "seconds": 5},
    # 停止中单独高频：仅扫 status=15，SQL 轻；与 request_stop / 落库已取消 更跟手
    {"func": check_stopping_tasks, "seconds": 5},
    {"func": check_timeout_tasks, "seconds": 10},
)

# ── 定期：每日数据保留（队列表 + 题目包目录），默认凌晨跑一次 ─────────────
from backtask.task_regular.daily_retention import run_daily_retention  # 清过期 backtask 与包目录

CRON_JOBS: Tuple[Dict[str, Any], ...] = (
    {
        "func": run_daily_retention,
        "hour": 4,
        "minute": 0,
        "second": 0,
    },
)


def register_queued_tasks() -> None:
    for m in QUEUED_TASK_MODULES:
        meta = getattr(m, "QUEUED_TASK_REGISTRATION", None)
        if not isinstance(meta, dict):
            raise TypeError(f"{getattr(m, '__name__', m)} 须定义 dict QUEUED_TASK_REGISTRATION")
        register(
            task_type=meta["task_type"],
            module=meta["module"],
            class_name=meta["class_name"],
            method=meta.get("method", "run"),
            timeout_minutes=meta.get("timeout_minutes", 40),
            concurrency_mode=meta.get("concurrency_mode", "read"),
            queue_key_fn=meta.get("queue_key_fn"),
        )
        logger.info("已注册入队任务类型: %s", meta["task_type"])


def attach_scheduler_jobs(scheduler: SimpleScheduler) -> None:
    for job in INTERVAL_JOBS:
        fn: Callable[..., Any] = job["func"]
        scheduler.add_interval(fn, seconds=int(job["seconds"]))
    for job in CRON_JOBS:
        fn = job["func"]
        scheduler.add_cron(
            fn,
            hour=job.get("hour"),
            minute=job.get("minute"),
            second=job.get("second", 0),
            day_of_week=job.get("day_of_week"),
        )


def apply_worker_registration(scheduler: SimpleScheduler) -> None:
    register_queued_tasks()
    attach_scheduler_jobs(scheduler)
