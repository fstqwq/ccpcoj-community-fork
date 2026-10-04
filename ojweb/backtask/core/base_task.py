"""
所有入队型后台任务的基类。

子类须实现 run() 方法。
执行期间可调用 self.check_stop() 检测用户取消信号,
可调用 self.log_info / log_error 写 backtask_log。
"""
import json
import logging
import threading
from typing import Any, Dict, Optional

from backtask.common import db
from backtask.core import status as st

logger = logging.getLogger("backtask.task")


class BaseTask:
    def __init__(self, task_id: int, task_params: Optional[Dict[str, Any]] = None):
        self.task_id = task_id
        self.task_params = task_params or {}
        self.result: Optional[Any] = None
        self._stop = threading.Event()

    # ── 生命周期 ──

    def run(self):
        raise NotImplementedError

    # ── 停止信号 ──

    def check_stop(self) -> bool:
        """检查是否收到取消信号，顺便更新心跳。"""
        if self._stop.is_set():
            return True
        row = db.find_task(self.task_id)
        if row and row["status"] == st.STOPPING:
            self._stop.set()
            return True
        db.heartbeat(self.task_id)
        return False

    def request_stop(self):
        self._stop.set()

    # ── 日志 ──

    def log_info(self, message: str, detail: Any = None):
        logger.info("[task %s] %s", self.task_id, message)
        try:
            db.insert_log(self.task_id, db.LOG_LEVEL_INFO, message, detail=detail)
        except Exception:
            logger.exception("写 backtask_log 失败")

    def log_warning(self, message: str, detail: Any = None):
        logger.warning("[task %s] %s", self.task_id, message)
        try:
            db.insert_log(self.task_id, db.LOG_LEVEL_WARNING, message, detail=detail)
        except Exception:
            logger.exception("写 backtask_log 失败")

    def log_error(self, message: str, detail: Any = None):
        logger.error("[task %s] %s", self.task_id, message)
        try:
            db.insert_log(self.task_id, db.LOG_LEVEL_ERROR, message, detail=detail)
        except Exception:
            logger.exception("写 backtask_log 失败")

    def update_progress(self, message: str, code: int = 0):
        """更新 backtask.last_message 作为进度展示。"""
        try:
            db.update_task(self.task_id, last_message=message[:255], last_code=code)
        except Exception:
            logger.exception("更新进度失败")
