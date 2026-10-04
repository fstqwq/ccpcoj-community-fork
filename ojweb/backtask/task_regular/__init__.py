"""
定期任务目录（由 SimpleScheduler 按 task_schedule_config 调用，不经 PHP 入队）。

业务入口为各模块中的 ``run_*`` 等函数。
"""

from .daily_retention import (
    run_daily_retention,
    retention_days,
    purge_old_problem_packages,
)
