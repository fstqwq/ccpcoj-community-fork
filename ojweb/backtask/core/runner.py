"""
任务执行器 —— 原子认领 pending 任务，提交到并发池执行。

每次 poll_and_run() 调用:
  1. 检查池是否有空闲槽
  2. 有则原子认领一条 pending 任务
  3. 提交到 TaskPool（read 并行 / write 按 queue_key 串行）
"""
import os
import json
import logging
import traceback
from typing import Optional

from backtask.common import db
from backtask.core import status as st
from backtask.core.factory import create, get_concurrency_mode, get_queue_key
from backtask.core.pool import TaskPool

logger = logging.getLogger("backtask.runner")

_pool: Optional[TaskPool] = None


def get_pool() -> TaskPool:
    global _pool
    if _pool is None:
        _pool = TaskPool()
    return _pool


def _worker_id() -> str:
    return f"{os.uname().nodename}/{os.getpid()}"


def poll_and_run():
    """轮询并认领任务，尽量填满并发池的空闲槽。"""
    pool = get_pool()

    slots = pool.available_slots
    if slots <= 0:
        return

    claimed = 0
    for _ in range(slots):
        task = db.claim_pending_task(_worker_id())
        if task is None:
            break

        task_id = task["task_id"]
        task_type = task["task_type"]
        task_params = task["task_params"] or {}
        if isinstance(task_params, str):
            try:
                task_params = json.loads(task_params)
            except (json.JSONDecodeError, TypeError):
                task_params = {}

        mode = get_concurrency_mode(task_type)
        queue_key = get_queue_key(task_type, task_params)

        def _make_exec(tid, ttype, tparams):
            def _execute():
                _run_task(tid, ttype, tparams)
            return _execute

        submitted = pool.submit(
            task_id, _make_exec(task_id, task_type, task_params),
            concurrency_mode=mode,
            queue_key=queue_key,
        )
        if not submitted:
            logger.warning("[backtask] 池满，回退 task_id=%s 为 pending", task_id)
            db.update_task(task_id, status=st.PENDING,
                           locked_by=None, locked_at=None, started_at=None)
            break
        claimed += 1

    if claimed > 1:
        logger.info("[backtask] 本轮认领 %d 条任务 (pool active=%d/%d)",
                    claimed, pool.active_count, pool.max_workers)


def _run_task(task_id: int, task_type: str, task_params: dict):
    """在池线程中执行单个任务（完整生命周期）。"""
    logger.info("[backtask] 开始执行 task_id=%s type=%s (pool active=%d/%d)",
                task_id, task_type, get_pool().active_count, get_pool().max_workers)
    db.insert_log(task_id, db.LOG_LEVEL_INFO, f"任务开始执行, type={task_type}")

    pair = create(task_type, task_id, task_params)
    if pair is None:
        _fail(task_id, f"未知或无法创建的 task_type: {task_type}")
        return

    instance, execute = pair
    pool = get_pool()
    pool.register_running_instance(task_id, instance)
    try:
        execute()
        _finish(task_id, instance)
    except Exception as exc:
        tb = traceback.format_exc()
        _handle_error(task_id, exc, tb)
    finally:
        pool.unregister_running_instance(task_id)


def _fail(task_id: int, message: str, code: int = -1):
    db.update_task(task_id, status=st.FAILED,
                   finished_at=db.USE_APP_WALL_NOW,
                   last_code=code,
                   last_message=message[:255])
    db.insert_log(task_id, db.LOG_LEVEL_ERROR, message)
    logger.error("[backtask] task_id=%s 失败: %s", task_id, message)


def _finish(task_id: int, instance):
    """任务方法正常返回后，检查当前 DB 状态并收尾。"""
    row = db.find_task(task_id)
    if not row:
        return
    cur_status = row["status"]
    if cur_status == st.STOPPING:
        db.update_task(task_id, status=st.CANCELLED,
                       finished_at=db.USE_APP_WALL_NOW,
                       last_message="任务已取消")
        db.insert_log(task_id, db.LOG_LEVEL_INFO, "任务被用户取消")
        logger.info("[backtask] task_id=%s 已取消", task_id)
    elif cur_status == st.RUNNING:
        result_json = None
        if hasattr(instance, "result") and instance.result is not None:
            result_json = json.dumps(instance.result, ensure_ascii=False)
        db.update_task(task_id, status=st.COMPLETED,
                       finished_at=db.USE_APP_WALL_NOW,
                       last_code=0,
                       last_message="执行完成",
                       result=result_json)
        db.insert_log(task_id, db.LOG_LEVEL_INFO, "任务执行完成")
        logger.info("[backtask] task_id=%s 完成", task_id)


def _handle_error(task_id: int, exc: Exception, tb: str):
    row = db.find_task(task_id)
    if row and row["status"] == st.STOPPING:
        db.update_task(task_id, status=st.CANCELLED,
                       finished_at=db.USE_APP_WALL_NOW,
                       last_message="任务已取消")
        db.insert_log(task_id, db.LOG_LEVEL_INFO, "任务被用户取消(执行中断)")
        logger.info("[backtask] task_id=%s 已取消(异常)", task_id)
        return
    msg = str(exc)[:250]
    db.update_task(task_id, status=st.FAILED,
                   finished_at=db.USE_APP_WALL_NOW,
                   last_code=-1,
                   last_message=msg)
    db.insert_log(task_id, db.LOG_LEVEL_ERROR, msg,
                  detail={"traceback": tb[:4000]})
    logger.error("[backtask] task_id=%s 异常: %s", task_id, msg)
