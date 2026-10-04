"""
backtask / backtask_log 表维度的通用清理（仅操作允许写入的队列表）。
"""
from datetime import timedelta

from backtask.common import db
from backtask.common.csg_datetime import oj_now
from backtask.core import status as st

_ALLOWED_INTERVAL_UNITS = frozenset({"DAY", "HOUR", "MINUTE"})


def _normalize_age_unit(age: int, unit: str) -> tuple[int, str]:
    if age < 1:
        raise ValueError("age must be >= 1")
    u = unit.strip().upper()
    if u not in _ALLOWED_INTERVAL_UNITS:
        raise ValueError(
            f"unit must be one of {sorted(_ALLOWED_INTERVAL_UNITS)}, got {unit!r}"
        )
    return age, u


def purge_old_backtasks(age: int, unit: str = "DAY") -> int:
    """
    删除 created_at 早于「应用墙钟当前时刻 − age unit」的 backtask 行；
    backtask_log 由外键 ON DELETE CASCADE 一并删除。
    不删除执行中(10)与停止中(15)的任务。
    阈值在 worker 内用 ``oj_now()`` 计算，不依赖 MySQL ``NOW()`` / 会话时区。

    :param age: 正整数时间长度（与 unit 组合，例如 age=1, unit=HOUR 即约 1 小时前）
    :param unit: DAY（默认，兼容原按天清理）、HOUR、MINUTE（大小写不敏感）
    :return: 删除的行数（可能含表中其它符合条件的行，不仅限于某一类 task_type）
    """
    age_i, u = _normalize_age_unit(age, unit)
    now = oj_now()
    if u == "DAY":
        cutoff = now - timedelta(days=age_i)
    elif u == "HOUR":
        cutoff = now - timedelta(hours=age_i)
    else:
        cutoff = now - timedelta(minutes=age_i)
    cutoff_s = cutoff.strftime("%Y-%m-%d %H:%M:%S")
    n = db.execute(
        "DELETE FROM backtask WHERE created_at < %s "
        "AND status NOT IN (%s, %s)",
        (cutoff_s, st.RUNNING, st.STOPPING),
        table_hint="backtask",
    )
    return int(n or 0)
