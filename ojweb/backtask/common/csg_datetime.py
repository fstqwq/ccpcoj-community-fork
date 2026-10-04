"""
Worker 侧「当前时刻」与 naive 墙钟串的唯一入口。

- 须在 ``apply_oj_timezone_early()`` 之后使用（见 ``start_worker``），使 ``datetime.now()`` 与 PHP ``app.default_timezone`` 一致。
- **DATETIME 列语义**：库内仅存无时区墙钟串；**不依赖** MySQL ``time_zone`` / ``NOW()``。队列表写入、比较、清理一律用本模块生成的时间或从行内读出的 naive 串再解析。
- ``backtask.common.db.server_now()`` 仅为兼容旧名，**等同** ``oj_now()``，不向数据库取时钟。

若将来要做统一前/后处理（审计、冻结时钟等），只改本文件。
"""
from __future__ import annotations

import time
import uuid
from datetime import date, datetime
from typing import Callable, Optional

_clock_override: Optional[Callable[[], datetime]] = None


def set_clock_override(fn: Optional[Callable[[], datetime]]) -> None:
    """单测注入固定 ``datetime``；生产环境勿调用。"""
    global _clock_override
    _clock_override = fn


def oj_now() -> datetime:
    """应用时区下的当前墙钟（naive ``datetime``，与历史 ``datetime.now()`` 一致）。"""
    if _clock_override is not None:
        return _clock_override()
    return datetime.now()


def oj_today() -> date:
    return oj_now().date()


def oj_time() -> float:
    """单调时钟：Unix 秒浮点，语义同 ``time.time()``。"""
    return time.time()


def oj_now_naive_sql() -> str:
    """``YYYY-MM-DD HH:MM:SS``，与 MySQL DATETIME 常见字符串形态一致。"""
    return oj_now().strftime("%Y-%m-%d %H:%M:%S")


def oj_now_sql_digits14() -> str:
    """``YYYYMMDDHHMMSS``，用于导出 ZIP 文件名等。"""
    return oj_now().strftime("%Y%m%d%H%M%S")


def oj_now_workdir_tag() -> str:
    """``YYYY-MM-DD-H-MM-SS``，与历史导入/导出临时目录时间戳段一致。"""
    return oj_now().strftime("%Y-%m-%d-%H-%M-%S")


def oj_new_attach_style_folder_name() -> str:
    """与 PHP ``AttachFolderCalculation`` / 赛内约定一致：``yy-mm-dd-`` + UUIDv4。"""
    return oj_now().strftime("%y-%m-%d") + "-" + str(uuid.uuid4())
