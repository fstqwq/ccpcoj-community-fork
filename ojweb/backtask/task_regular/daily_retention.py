"""
定期任务：按策略清理过期 backtask 记录与题目包目录（cron 调用）。

不写调度时刻（见 task_schedule_config.CRON_JOBS）。
默认在 Web 后台任务列表写入一条「执行中→已完成」记录，便于管理员看到清理已跑。
"""
import json
import logging
import os
from typing import Any, Dict, Optional

from backtask.common import db
from backtask.common.csg_datetime import oj_now_naive_sql
from backtask.core.backtask_retention import purge_old_backtasks
from backtask.core.fs_cleanup import purge_stale_entries
from backtask.core.ojweb_paths import contest_export_paths, problem_export_paths

logger = logging.getLogger("backtask.task_regular.daily_retention")

RETENTION_TASK_TYPE = "daily_retention"
DEFAULT_RETENTION_DAYS = 30


def retention_days() -> int:
    try:
        return max(1, int(os.environ.get("BACKTASK_RETENTION_DAYS", str(DEFAULT_RETENTION_DAYS))))
    except ValueError:
        return DEFAULT_RETENTION_DAYS


def purge_old_problem_packages(days: int) -> tuple:
    export_dir, temp_dir, import_dir = problem_export_paths()
    a = purge_stale_entries(export_dir, days)
    b = purge_stale_entries(temp_dir, days)
    c = purge_stale_entries(import_dir, days)
    ce, ct, ci = contest_export_paths()
    d = purge_stale_entries(ce, days)
    e = purge_stale_entries(ct, days)
    f = purge_stale_entries(ci, days)
    return (a, b, c, d, e, f)


def _cron_lock_tag() -> str:
    try:
        return f"{os.uname().nodename}/cron-retention"
    except Exception:
        return "cron-retention"


def _open_web_list_row(
    backtask_age: Optional[int], backtask_unit: str
) -> int:
    """插入 status=10 行，避免被 poll 认领（仅 pending 可被认领）。"""
    payload: Dict[str, Any] = {
        "source": "worker_cron",
        "trigger": "scheduled_retention",
    }
    if backtask_age is not None:
        payload["backtask_age"] = backtask_age
        payload["backtask_unit"] = backtask_unit
    params_json = json.dumps(payload, ensure_ascii=False)
    wall = oj_now_naive_sql()
    tid = db.insert_get_id(
        "INSERT INTO backtask (task_type, task_params, status, priority, last_message, "
        "started_at, locked_by, locked_at) VALUES (%s, %s, 10, 0, %s, %s, %s, %s)",
        (
            RETENTION_TASK_TYPE,
            params_json,
            "执行数据保留清理…",
            wall,
            _cron_lock_tag(),
            wall,
        ),
        table_hint="backtask",
    )
    try:
        db.insert_log(tid, db.LOG_LEVEL_INFO, "开始数据保留清理")
    except Exception:
        logger.debug("写入 retention 起始日志失败", exc_info=True)
    return tid


def _finish_web_list_row(
    task_id: int, ok: bool, last_message: str, result: Optional[Dict[str, Any]]
) -> None:
    st = 20 if ok else 30
    result_json = json.dumps(result, ensure_ascii=False) if result is not None else None
    db.execute(
        "UPDATE backtask SET status=%s, finished_at=%s, last_message=%s, result=%s "
        "WHERE task_id=%s",
        (st, oj_now_naive_sql(), last_message[:255], result_json, task_id),
        table_hint="backtask",
    )


def run_daily_retention(
    *,
    backtask_age: Optional[int] = None,
    backtask_unit: str = "DAY",
    record_in_web_list: bool = True,
) -> None:
    """
    cron 入口：DB 与题目包目录清理。

    :param record_in_web_list: 为 True 时写入 backtask/backtask_log，供 Web 列表展示（单测可关）。
    """
    days = retention_days()
    tid: Optional[int] = None
    if record_in_web_list:
        tid = _open_web_list_row(backtask_age, backtask_unit)

    result_summary: Dict[str, Any] = {"retention_days_threshold": days}
    n_task = 0
    fe = ft = fi = ce = ct = ci = 0

    try:
        if backtask_age is None:
            n_task = purge_old_backtasks(days, "DAY")
            if n_task:
                logger.info(
                    "保留策略: 已删除 %s 条早于 %s 天的后台任务（日志随外键级联删除）",
                    n_task, days,
                )
        else:
            n_task = purge_old_backtasks(backtask_age, backtask_unit)
            if n_task:
                logger.info(
                    "保留策略: 已删除 %s 条早于 %s %s 的后台任务（日志随外键级联删除）",
                    n_task, backtask_age, backtask_unit.strip().upper(),
                )

        fe, ft, fi, ce, ct, ci = purge_old_problem_packages(days)
        total_files = fe + ft + fi + ce + ct + ci
        if total_files:
            logger.info(
                "保留策略: 题目/比赛包目录清理 %s 项 "
                "(PROBLEM_EXPORT=%s/%s/%s CONTEST_EXPORT=%s/%s/%s), 阈值=%s 天",
                total_files, fe, ft, fi, ce, ct, ci, days,
            )

        result_summary.update(
            {
                "deleted_backtask_rows": n_task,
                "package_items_removed": {
                    "problem_export": fe,
                    "problem_file_temp": ft,
                    "problem_import_temp": fi,
                    "contest_export": ce,
                    "contest_file_temp": ct,
                    "contest_import_temp": ci,
                },
                "package_items_total": total_files,
            }
        )
        msg = (
            f"完成: 队列表删 {n_task} 条; 包目录清 {total_files} 项"
        )
        if tid is not None:
            _finish_web_list_row(tid, True, msg, result_summary)
            try:
                db.insert_log(tid, db.LOG_LEVEL_INFO, msg[:255])
            except Exception:
                logger.debug("写入 retention 完成日志失败", exc_info=True)
    except Exception:
        logger.exception("每日保留策略执行失败")
        if tid is not None:
            try:
                _finish_web_list_row(
                    tid,
                    False,
                    "数据保留清理失败，详见 worker 日志",
                    {"error": "exception", "partial": result_summary},
                )
            except Exception:
                logger.exception("更新 retention 失败状态写入 backtask 失败")
