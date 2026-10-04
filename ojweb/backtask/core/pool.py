"""
并发任务池 —— 根据 CPU 核心数自动计算并行上限。

策略:
  - 总并行槽 = max(1, cpu_count // 2)，不超过 CPU 50%
  - 可通过环境变量 BACKTASK_MAX_WORKERS 覆盖
  - 读任务（read）: 共享全局信号量，互不阻塞
  - 写任务（write）: 除全局信号量外，同 queue_key 串行（防冲突）
"""
import os
import logging
import threading
from typing import Any, Callable, Dict, Optional

logger = logging.getLogger("backtask.pool")

# ── 最小/最大硬边界 ──
_MIN_WORKERS = 1
_MAX_WORKERS_CAP = 16


def _calc_max_workers() -> int:
    env_val = os.environ.get("BACKTASK_MAX_WORKERS", "").strip()
    if env_val.isdigit() and int(env_val) >= 1:
        return min(int(env_val), _MAX_WORKERS_CAP)
    cpus = os.cpu_count() or 2
    return max(_MIN_WORKERS, min(cpus // 2, _MAX_WORKERS_CAP))


class TaskPool:
    """
    线程池式并发控制。

    用法:
        pool = TaskPool()
        pool.submit(task_id, func, concurrency_mode="read")
        pool.submit(task_id, func, concurrency_mode="write", queue_key="problem:123")
    """

    def __init__(self):
        self.max_workers = _calc_max_workers()
        self._global_sem = threading.Semaphore(self.max_workers)
        self._write_locks: Dict[str, threading.Lock] = {}
        self._write_locks_guard = threading.Lock()
        self._active: Dict[int, threading.Thread] = {}
        self._active_lock = threading.Lock()
        # 运行中任务实例（用于 STOPPING 时 request_stop；与 task_id 一一对应）
        self._instances: Dict[int, Any] = {}
        self._instances_lock = threading.Lock()
        logger.info("TaskPool 初始化: max_workers=%d (CPU=%s)",
                     self.max_workers, os.cpu_count())

    @property
    def active_count(self) -> int:
        with self._active_lock:
            return len(self._active)

    @property
    def available_slots(self) -> int:
        return max(0, self.max_workers - self.active_count)

    def register_running_instance(self, task_id: int, instance: object) -> None:
        with self._instances_lock:
            self._instances[task_id] = instance

    def unregister_running_instance(self, task_id: int) -> None:
        with self._instances_lock:
            self._instances.pop(task_id, None)

    def get_running_instance(self, task_id: int) -> Optional[Any]:
        with self._instances_lock:
            return self._instances.get(task_id)

    def is_task_thread_active(self, task_id: int) -> bool:
        """池内是否仍有该 task_id 的执行线程（且线程仍存活）。"""
        with self._active_lock:
            th = self._active.get(task_id)
            if th is None:
                return False
            return th.is_alive()

    def _get_write_lock(self, key: str) -> threading.Lock:
        with self._write_locks_guard:
            if key not in self._write_locks:
                self._write_locks[key] = threading.Lock()
            return self._write_locks[key]

    def _cleanup_write_locks(self):
        """定期清理不再使用的写锁（避免内存泄漏）。"""
        with self._write_locks_guard:
            to_del = [k for k, v in self._write_locks.items()
                      if not v.locked()]
            for k in to_del:
                del self._write_locks[k]

    def submit(self, task_id: int, func: Callable,
               concurrency_mode: str = "read",
               queue_key: Optional[str] = None) -> bool:
        """
        提交一个任务到池中。

        返回 True 表示已提交（异步执行），False 表示池满拒绝。
        """
        if not self._global_sem.acquire(blocking=False):
            return False

        def _wrapper():
            wlock = None
            try:
                if concurrency_mode == "write" and queue_key:
                    wlock = self._get_write_lock(queue_key)
                    wlock.acquire()
                func()
            finally:
                if wlock is not None:
                    try:
                        wlock.release()
                    except RuntimeError:
                        pass
                self._global_sem.release()
                with self._active_lock:
                    self._active.pop(task_id, None)
                if len(self._write_locks) > 100:
                    self._cleanup_write_locks()

        th = threading.Thread(target=_wrapper, daemon=True,
                               name=f"BT-{task_id}")
        with self._active_lock:
            self._active[task_id] = th
        th.start()
        return True

    def is_queue_key_busy(self, queue_key: str) -> bool:
        """检查某个 queue_key 是否正被写任务占用。"""
        with self._write_locks_guard:
            lock = self._write_locks.get(queue_key)
            if lock is None:
                return False
            return lock.locked()
