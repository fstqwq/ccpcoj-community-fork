#!/usr/bin/env python3
"""
backtask worker 进程入口 —— 由 entrypoint.sh 启动。

只做生命周期：日志、路径、信号、启动调度器主循环。
任务类型元数据在 ``task_<类型>/`` 包内；节奏与注册表在 ``task_schedule_config``：

  - ``task_schedule_config.apply_worker_registration(scheduler)``
      读取各 ``task_*`` 包的 ``QUEUED_TASK_REGISTRATION`` 注册入队型任务；
      再按 ``INTERVAL_JOBS`` / ``CRON_JOBS`` 挂载轮询与定期任务。

增删任务或改间隔：改对应 ``task_*`` 包与/或 ``task_schedule_config.py``，勿改本文件。

并发策略（线程池）:
  - max_workers = max(1, cpu_count // 2)，可通过 BACKTASK_MAX_WORKERS 覆盖
  - 读任务并行，写任务按 queue_key 串行防冲突
"""
import os
import sys
import signal
import time
import logging

_ojweb = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _ojweb not in sys.path:
    sys.path.insert(0, _ojweb)

from backtask.common.oj_timezone import apply_oj_timezone_early

apply_oj_timezone_early()

from backtask.core.scheduler import SimpleScheduler
from backtask.core.runner import get_pool
from backtask.task_schedule_config import apply_worker_registration

logging.basicConfig(
    level=logging.INFO,
    format="[backtask] %(asctime)s %(levelname)s %(name)s - %(message)s",
    stream=sys.stdout,
)
logger = logging.getLogger("backtask")

# 线程池单例；实际「拉活」在 poll_and_run 里发生，此处提前初始化便于 main() 打日志
pool = get_pool()

scheduler = SimpleScheduler()
# 入队型工厂注册 + interval/cron 均由 task_schedule_config 驱动
apply_worker_registration(scheduler)


def _shutdown(signum, frame):
    logger.info("收到信号 %s, 正在停止...", signum)
    scheduler.stop()
    from backtask.common.db import close_conn
    close_conn()
    sys.exit(0)


signal.signal(signal.SIGTERM, _shutdown)
signal.signal(signal.SIGINT, _shutdown)


def main():
    logger.info("=" * 60)
    logger.info("backtask worker 启动")
    logger.info("  CPU cores: %s", os.cpu_count())
    logger.info("  max_workers: %d (并行任务上限)", pool.max_workers)
    logger.info("  BACKTASK_MAX_WORKERS env: %s",
                os.environ.get("BACKTASK_MAX_WORKERS", "(未设置, 自动计算)"))
    logger.info("=" * 60)
    scheduler.start()
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        _shutdown(None, None)


if __name__ == "__main__":
    main()
