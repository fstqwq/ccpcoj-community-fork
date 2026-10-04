"""
CPC 比赛包线格式与库内 team_id / solution user_id 前缀互转。

- 库内 contest_print.team_id、solution.user_id、contest_topic.user_id 等为 ``#cpc{contest_id}_{plain}``。
- 比赛包 jsonl _wire_ 使用 plain team_id（与 solutions.jsonl 的 team_id 一致），导入时按**新** contest_id 重套前缀。
"""
from __future__ import annotations

import re
from typing import Any

_CPC_PREFIX_RE = re.compile(r"^#cpc(\d+)_(.+)$", re.IGNORECASE)


def wire_plain_team_id(team_id: Any, source_contest_id: int = 0) -> str:
    """包内 / 线格式：去掉 ``#cpc{cid}_``，得到 cpc_team.team_id 明文。"""
    s = str(team_id or "").strip()
    if not s:
        return ""
    cid = int(source_contest_id or 0)
    if cid > 0:
        pref = f"#cpc{cid}_"
        if s.startswith(pref):
            return s[len(pref) :]
    m = _CPC_PREFIX_RE.match(s)
    if m:
        return m.group(2)
    return s


def db_prefixed_team_id(contest_id: int, team_id_wire: Any) -> str:
    """写入库：按目标 contest_id 生成 ``#cpc{cid}_{plain}``（不以包内旧 cid 为准）。"""
    plain = wire_plain_team_id(team_id_wire, 0)
    if not plain:
        return ""
    cid = int(contest_id)
    return f"#cpc{cid}_{plain}"
