"""
OJ 应用时区：与 PHP config/app.php 一致。

优先级：/ojweb/.env 的 app_timezone > 环境变量 APP_TIMEZONE > TZ > Asia/Shanghai
"""
from __future__ import annotations

import os
import time
from typing import Optional

DEFAULT_TZ = "Asia/Shanghai"
_DOTENV_PATH = "/ojweb/.env"


def _read_app_timezone_from_dotenv(path: str = _DOTENV_PATH) -> Optional[str]:
    if not os.path.isfile(path):
        return None
    try:
        with open(path, "r", encoding="utf-8", errors="replace") as f:
            for line in f:
                s = line.strip()
                if not s or s.startswith("#") or s.startswith(";"):
                    continue
                if "=" not in s:
                    continue
                k, v = s.split("=", 1)
                if k.strip().lower() != "app_timezone":
                    continue
                val = v.strip().strip('"').strip("'")
                if val:
                    return val
    except OSError:
        return None
    return None


def resolve_oj_timezone() -> str:
    v = _read_app_timezone_from_dotenv()
    if v:
        return v
    v = (os.environ.get("APP_TIMEZONE") or "").strip()
    if v:
        return v
    v = (os.environ.get("TZ") or "").strip()
    if v:
        return v
    return DEFAULT_TZ


def apply_oj_timezone_early() -> None:
    """在 worker 其它逻辑之前调用：统一进程 TZ，便于 datetime / 日志与 PHP 对齐。"""
    tz = resolve_oj_timezone()
    os.environ["TZ"] = tz
    if hasattr(time, "tzset"):
        try:
            time.tzset()
        except Exception:
            pass
