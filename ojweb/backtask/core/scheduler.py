"""
轻量级调度器 —— 支持 interval 和 cron 任务。
不依赖 APScheduler 等外部库。
"""
import time
import logging
import threading
from datetime import datetime, timedelta
from typing import Callable, Optional, List

from backtask.common.csg_datetime import oj_now

logger = logging.getLogger("backtask.scheduler")


class _Task:
    __slots__ = ("func", "type", "seconds", "day_of_week",
                 "hour", "minute", "second", "last_run", "name")

    def __init__(self, func: Callable, **kw):
        self.func = func
        self.name = func.__name__
        self.type = kw.get("type", "interval")
        self.seconds = kw.get("seconds")
        self.day_of_week = kw.get("day_of_week")
        self.hour = kw.get("hour")
        self.minute = kw.get("minute")
        self.second = kw.get("second", 0)
        self.last_run: Optional[datetime] = None


class SimpleScheduler:
    def __init__(self):
        self._tasks: List[_Task] = []
        self._running = False
        self._thread: Optional[threading.Thread] = None

    def add_interval(self, func: Callable, seconds: int):
        self._tasks.append(_Task(func, type="interval", seconds=seconds))
        logger.info("注册 interval 任务: %s 每 %ds", func.__name__, seconds)

    def add_cron(self, func: Callable, day_of_week=None,
                 hour=None, minute=None, second=0):
        self._tasks.append(_Task(func, type="cron",
                                 day_of_week=day_of_week,
                                 hour=hour, minute=minute, second=second))
        logger.info("注册 cron 任务: %s", func.__name__)

    def _should_run(self, t: _Task, now: datetime) -> bool:
        if t.type == "interval":
            if t.last_run is None:
                return True
            return (now - t.last_run).total_seconds() >= (t.seconds or 60)
        if t.type == "cron":
            if t.day_of_week is not None and now.weekday() != t.day_of_week:
                return False
            if t.hour is not None and now.hour != t.hour:
                return False
            if t.minute is not None and now.minute != t.minute:
                return False
            if now.second < t.second:
                return False
            if t.last_run and (now - t.last_run).total_seconds() < 60:
                return False
            return True
        return False

    def _loop(self):
        logger.info("[backtask] 调度器启动")
        while self._running:
            now = oj_now()
            for t in self._tasks:
                if self._should_run(t, now):
                    t.last_run = now
                    th = threading.Thread(target=self._run_one,
                                          args=(t,), daemon=True,
                                          name=f"Task-{t.name}")
                    th.start()
            time.sleep(1)

    @staticmethod
    def _run_one(t: _Task):
        try:
            t.func()
        except Exception:
            logger.exception("任务 %s 执行异常", t.name)

    def start(self):
        if self._running:
            return
        self._running = True
        self._thread = threading.Thread(target=self._loop,
                                         daemon=True, name="Scheduler")
        self._thread.start()

    def stop(self):
        self._running = False
        if self._thread and self._thread.is_alive():
            self._thread.join(timeout=5)
        logger.info("[backtask] 调度器已停止")
