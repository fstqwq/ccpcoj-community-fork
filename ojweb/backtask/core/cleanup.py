"""
超时与僵尸任务清理；停止中(STOPPING) 任务与池内线程协同收尾。
"""
import errno
import logging
import os
from datetime import timedelta

from backtask.common import db
from backtask.core import status as st
from backtask.core.factory import get_timeout_minutes

logger = logging.getLogger("backtask.cleanup")

STOPPING_TIMEOUT_MINUTES = 20


def check_process_exists(pid: int) -> bool:
    if pid is None:
        return False
    try:
        os.kill(pid, 0)
        return True
    except ProcessLookupError:
        return False
    except OSError as e:
        return getattr(e, "errno", None) != errno.ESRCH
    except Exception:
        return True


def check_stopping_tasks():
    """仅处理停止中：由调度器高频调用；与池内线程协同 request_stop / 落库已取消。"""
    try:
        from backtask.core.runner import get_pool

        rows = db.fetchall(
            "SELECT task_id, updated_at FROM backtask WHERE status = %s",
            (st.STOPPING,),
            table_hint="backtask",
        )
        if not rows:
            return

        now = db.server_now()
        pool = get_pool()
        for row in rows:
            _check_stopping(row, row["task_id"], now, pool)
    except Exception:
        logger.exception("check_stopping_tasks 异常")


def check_timeout_tasks():
    """检查运行中超时（停止中见 ``check_stopping_tasks``）。"""
    try:
        rows = db.fetchall(
            "SELECT task_id, task_type, status, locked_by, started_at, "
            "       heartbeat_at, updated_at, task_params "
            "FROM backtask WHERE status = %s",
            (st.RUNNING,),
            table_hint="backtask",
        )
        if not rows:
            return

        now = db.server_now()

        for row in rows:
            task_id = row["task_id"]
            task_type = row["task_type"] or ""
            locked_by = row.get("locked_by") or ""

            pid = _extract_pid(locked_by)
            process_alive = check_process_exists(pid) if pid else False

            _check_running(row, task_id, task_type, now, process_alive, pid)
    except Exception:
        logger.exception("check_timeout_tasks 异常")


def _extract_pid(locked_by: str):
    """locked_by 格式: hostname/pid（主 worker 进程，非任务线程）。"""
    if "/" in locked_by:
        try:
            return int(locked_by.rsplit("/", 1)[1])
        except (ValueError, IndexError):
            return None
    return None


def _check_running(row, task_id, task_type, now, process_alive, pid):
    start = row.get("started_at") or row.get("updated_at")
    if not start:
        return
    timeout_min = get_timeout_minutes(task_type)
    elapsed = now - start
    if process_alive and elapsed <= timedelta(minutes=timeout_min):
        return
    if not process_alive:
        msg = f"任务进程已不存在 (pid={pid})"
    else:
        msg = f"任务运行超过 {timeout_min} 分钟，强制标记失败"
    db.update_task(task_id, status=st.FAILED,
                   finished_at=db.USE_APP_WALL_NOW, last_message=msg[:255])
    db.insert_log(task_id, db.LOG_LEVEL_ERROR, msg)
    logger.warning("[backtask] task_id=%s %s", task_id, msg)


def _check_stopping(row, task_id, now, pool):
    """
    停止中：池内仍有执行线程则反复 request_stop（协作退出）；
    线程已结束则立即将库中仍为 STOPPING 的行标为已取消；
    长时间仍不退出则超时标为已取消（线程可能仍僵跑，库状态不再阻塞展示）。
    """
    updated = row.get("updated_at")
    elapsed = (now - updated) if updated else timedelta(0)

    thread_alive = pool.is_task_thread_active(task_id)
    if thread_alive:
        inst = pool.get_running_instance(task_id)
        if inst is not None and hasattr(inst, "request_stop"):
            try:
                inst.request_stop()
            except Exception:
                logger.exception("[backtask] task_id=%s request_stop 异常", task_id)
        if elapsed <= timedelta(minutes=STOPPING_TIMEOUT_MINUTES):
            return
        msg = "停止超时(执行线程仍未结束，已标记已取消)"
    else:
        row2 = db.find_task(task_id)
        if not row2 or int(row2.get("status", 0)) != st.STOPPING:
            return
        msg = "任务执行线程已退出，已标记为已取消"

    db.update_task(
        task_id,
        status=st.CANCELLED,
        finished_at=db.USE_APP_WALL_NOW,
        last_message=msg[:255],
    )
    db.insert_log(task_id, db.LOG_LEVEL_INFO, f"任务标记为已取消: {msg}")
    logger.info("[backtask] task_id=%s 停止中 → 已取消: %s", task_id, msg)
