"""导出 ZIP 侧车 ``csg_export_timezone.json`` 与 naive 墙钟换算（与 PHP ``CsgOjWireInstant`` 对齐）。

详见 ``docs/future_design/10.全系统时区体系与数据交换-wire与解析-20260511.md`` §3A、§7。
"""
from __future__ import annotations

import json
import os
import re
from datetime import datetime
from typing import Any, Optional

from zoneinfo import ZoneInfo

from backtask.common.oj_timezone import resolve_oj_timezone

CSG_EXPORT_TIMEZONE_FILENAME = "csg_export_timezone.json"
_EXPORT_SCHEMA = 1
_NAIVE_SQL = re.compile(r"^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$")


def export_sidecar_dict() -> dict[str, Any]:
    iana = resolve_oj_timezone()
    ZoneInfo(iana)
    return {"iana": iana, "schema": _EXPORT_SCHEMA}


def export_sidecar_json_bytes() -> bytes:
    return json.dumps(export_sidecar_dict(), ensure_ascii=False).encode("utf-8")


def read_sidecar_iana(extract_root: str) -> Optional[str]:
    fp = os.path.join(extract_root, CSG_EXPORT_TIMEZONE_FILENAME)
    if not os.path.isfile(fp):
        return None
    try:
        with open(fp, "r", encoding="utf-8") as f:
            data = json.load(f)
    except (OSError, ValueError, json.JSONDecodeError):
        return None
    if not isinstance(data, dict):
        return None
    iana = str(data.get("iana") or "").strip()
    if not iana:
        return None
    try:
        ZoneInfo(iana)
    except Exception:
        return None
    if int(data.get("schema") or 0) != _EXPORT_SCHEMA:
        return None
    return iana


def require_consistent_iana(a: Optional[str], b: Optional[str]) -> None:
    if a and b and a != b:
        raise RuntimeError(f"包内多份导出时区声明不一致（{a!r} vs {b!r}），拒绝导入")


def wire_naive_sql_to_app_sql(value: str, src_iana: Optional[str], app_iana: str) -> str:
    """将 ``YYYY-MM-DD HH:mm:ss`` 视为 ``src_iana`` 墙钟 → 换算为 ``app_iana`` 墙钟同形串。

    ``src_iana`` 为空或与 ``app_iana`` 相同：不换算（旧包 / 同区导出）。
    非 naive 形态：原样截断返回（避免误改非 DATETIME 字段）。
    """
    s = str(value).strip().replace("T", " ")
    if len(s) >= 19:
        s = s[:19]
    if _NAIVE_SQL.match(s) is None:
        return str(value)[:64] if value is not None else ""
    if not src_iana or src_iana == app_iana:
        return s
    dt = datetime.strptime(s, "%Y-%m-%d %H:%M:%S").replace(tzinfo=ZoneInfo(src_iana))
    return dt.astimezone(ZoneInfo(app_iana)).strftime("%Y-%m-%d %H:%M:%S")


def maybe_shift_wire_naive(val: Any, src_iana: Optional[str], app_iana: str) -> Any:
    """仅对符合 naive DATETIME 形态的字符串做换算；其余类型原样返回。"""
    if val is None or isinstance(val, (int, float)):
        return val
    if isinstance(val, datetime):
        val = val.strftime("%Y-%m-%d %H:%M:%S")
    s = str(val).strip().replace("T", " ")
    head = s[:19] if len(s) >= 19 else s
    if _NAIVE_SQL.match(head) is None:
        return val
    return wire_naive_sql_to_app_sql(head, src_iana, app_iana)
