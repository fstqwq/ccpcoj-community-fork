"""
比赛归档包导出（入队型）。

仅允许 contest.private 个位为 0/1/2（公开、私有、标准）；拒绝 4（练习/实验）、5（考试）等。

task_params:
  contest_id, export_tag, test_data_check, attach_file_check,
  testdata_dir, attach_base_dir, export_dir, export_temp_dir,
  public_dir, contest_attach_rel, created_by

内嵌题包与独立 ``problem_export`` 任务共用 ``query_problems_for_export`` + ``build_problem_export_zip_bytes``
（``write_problem_package_to_zipfile``：problemlist.json、评测目录 / pdf_desc、附件规则一致）。
"""
from __future__ import annotations

import json
import logging
import os
import shutil
import zipfile
from datetime import date, datetime
from decimal import Decimal
from typing import Any, Dict, List

from backtask.core.base_task import BaseTask
from backtask.common import db
from backtask.common.cpc_team_id_wire import wire_plain_team_id
from backtask.common.csg_datetime import oj_now_workdir_tag
from backtask.common.csg_wire_time import CSG_EXPORT_TIMEZONE_FILENAME, export_sidecar_json_bytes
from backtask.common.dir_permissions import makedirs_chmod_new_dir_chain
from backtask.task_queue.problem_export import (
    build_problem_export_zip_bytes,
    query_problems_for_export,
)

logger = logging.getLogger("backtask.task_queue.contest_export")

MANIFEST_FORMAT = "csg_contest_archive"
MANIFEST_VERSION = 1

# 外层比赛归档包：contest-{id}-{时间戳}.zip（时间戳与 work_dir 前缀同源，避免同场多次导出覆盖）；
# 内嵌题包固定 problems/OJ-Problem-csgoj.zip（导入只要求 problems/*.zip）
CONTEST_ARCHIVE_ZIP_NAME_TMPL = "contest-{contest_id}-{ts}.zip"
CONTEST_INNER_PROBLEM_ZIP_NAME = "OJ-Problem-csgoj.zip"


def _bt_error_display(cn: str, en: str) -> Dict[str, Any]:
    return {"kind": "error", "lines": [{"cn": cn, "en": en}]}


def _bt_contest_export_download_display() -> Dict[str, Any]:
    return {
        "kind": "download",
        "lines": [
            {"cn": "比赛包", "en": "Contest package"},
            {"cn": "ZIP 归档", "en": "ZIP archive"},
        ],
    }


def _contest_pkg_export_allowed_private(private_val: Any) -> bool:
    """与 PHP contest_pkg_export_allowed_private 一致：仅 0/1/2 可导出。"""
    try:
        k = int(private_val) % 10
    except (TypeError, ValueError):
        return False
    return k in (0, 1, 2)


def _json_safe(v: Any) -> Any:
    if isinstance(v, datetime):
        return v.strftime("%Y-%m-%d %H:%M:%S")
    if isinstance(v, date):
        return v.strftime("%Y-%m-%d")
    if isinstance(v, Decimal):
        return float(v)
    if isinstance(v, bytes):
        return v.decode("utf-8", errors="replace")
    return v


def _row_json(r: Dict[str, Any]) -> Dict[str, Any]:
    return {k: _json_safe(v) for k, v in r.items()}


def _strip_cpc_user_prefix(user_id: str, contest_id: int) -> str:
    s = str(user_id or "")
    prefix = f"#cpc{int(contest_id)}_"
    if s.startswith(prefix):
        return s[len(prefix) :]
    return s


def _need_cpc_team(private_val: int, module_hint: str = "") -> bool:
    try:
        k = int(private_val) % 10
    except (TypeError, ValueError):
        return False
    return k in (2, 5) or module_hint == "examsys"


def _coerce_positive_contest_id(val: Any) -> int:
    if val is None or isinstance(val, bool):
        return 0
    if isinstance(val, int):
        return val if val > 0 else 0
    if isinstance(val, float):
        i = int(val)
        return i if i > 0 else 0
    if isinstance(val, str):
        s = val.strip()
        if s.isdigit():
            i = int(s)
            return i if i > 0 else 0
    try:
        i = int(val)
        return i if i > 0 else 0
    except (TypeError, ValueError):
        return 0


def _write_jsonl(zf: zipfile.ZipFile, arc_base: str, rows: List[Dict[str, Any]]) -> None:
    lines = "\n".join(json.dumps(_row_json(r), ensure_ascii=False) for r in rows)
    zf.writestr(arc_base, lines + ("\n" if lines else ""))


def _contest_print_rows_for_wire(
    rows: List[Dict[str, Any]], source_contest_id: int
) -> List[Dict[str, Any]]:
    out: List[Dict[str, Any]] = []
    for r in rows:
        d = dict(r)
        d.pop("print_id", None)
        d.pop("contest_id", None)
        d["team_id"] = wire_plain_team_id(d.get("team_id"), source_contest_id)
        out.append(d)
    return out


def _contest_topic_rows_for_wire(
    rows: List[Dict[str, Any]], source_contest_id: int
) -> List[Dict[str, Any]]:
    out: List[Dict[str, Any]] = []
    for r in rows:
        d = dict(r)
        d.pop("contest_id", None)
        d["user_id"] = wire_plain_team_id(d.get("user_id"), source_contest_id)
        out.append(d)
    return out


def _contest_group_rows_for_wire(rows: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    out: List[Dict[str, Any]] = []
    for r in rows:
        d = dict(r)
        d.pop("contest_id", None)
        out.append(d)
    return out


def _cpc_team_group_rows_for_wire(rows: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    out: List[Dict[str, Any]] = []
    for r in rows:
        d = dict(r)
        d.pop("contest_id", None)
        out.append(d)
    return out


class ContestExportTask(BaseTask):
    def run(self):
        p = self.task_params
        contest_id = _coerce_positive_contest_id(p.get("contest_id"))
        export_tag = str(p.get("export_tag") or f"cid{contest_id}")
        test_data = bool(p.get("test_data_check", True))
        attach = bool(p.get("attach_file_check", True))
        testdata_dir = (p.get("testdata_dir") or "/home/judge/data").strip()
        attach_base = (p.get("attach_base_dir") or "").strip()
        export_dir = (p.get("export_dir") or "/tmp").strip()
        temp_dir = (p.get("export_temp_dir") or "/tmp").strip()
        created_by = str(p.get("created_by") or "unknown")
        public_dir = (p.get("public_dir") or "").rstrip("/\\")
        contest_attach_rel = (p.get("contest_attach_rel") or "/upload/contest_attach").strip()

        if contest_id <= 0:
            self.log_error("contest_id 无效")
            self.result = {
                "error": "invalid contest_id",
                "bt_display": _bt_error_display("比赛 ID 无效", "Invalid contest_id"),
            }
            return

        crow = db.fetchone(
            "SELECT * FROM contest WHERE contest_id=%s",
            (contest_id,),
            table_hint="contest",
        )
        if not crow:
            self.log_error("比赛不存在 contest_id=%s", contest_id)
            self.result = {
                "error": "contest not found",
                "contest_id": contest_id,
                "bt_display": _bt_error_display("比赛不存在", "Contest not found"),
            }
            return

        if not _contest_pkg_export_allowed_private(crow.get("private")):
            pk = 0
            try:
                pk = int(crow.get("private") or 0) % 10
            except (TypeError, ValueError):
                pk = -1
            self.log_error("比赛类型不允许导出比赛包 private%%10=%s", pk)
            self.result = {
                "error": "contest type not exportable",
                "private_kind": pk,
                "bt_display": _bt_error_display(
                    "该比赛类型不允许导出比赛包",
                    "Contest type not exportable",
                ),
            }
            return

        cprows = db.fetchall(
            "SELECT problem_id, contest_id, title, num, pscore FROM contest_problem "
            "WHERE contest_id=%s ORDER BY num ASC",
            (contest_id,),
            table_hint="contest_problem",
        )
        problem_ids = [int(x["problem_id"]) for x in cprows if int(x.get("problem_id") or 0) > 0]
        if not problem_ids:
            self.log_error("比赛无题目")
            self.result = {
                "error": "no problems in contest",
                "bt_display": _bt_error_display("比赛中无题目", "No problems in contest"),
            }
            return

        self.update_progress("查询题目与附属数据…")
        problems = query_problems_for_export(problem_ids)
        idx_by_pid = {int(p["problem_id"]): int(p["problem_new_id"]) for p in problems}

        need_team = _need_cpc_team(int(crow.get("private") or 0))
        teams: List[Dict[str, Any]]
        if need_team:
            teams = db.fetchall(
                "SELECT * FROM cpc_team WHERE contest_id=%s ORDER BY team_id ASC",
                (contest_id,),
                table_hint="cpc_team",
            )
        else:
            uid_rows = db.fetchall(
                "SELECT DISTINCT user_id FROM solution WHERE contest_id=%s",
                (contest_id,),
                table_hint="solution",
            )
            teams = []
            for ur in uid_rows:
                uid = str(ur.get("user_id") or "")
                if not uid:
                    continue
                u = db.fetchone(
                    "SELECT user_id, nick, school FROM users WHERE user_id=%s LIMIT 1",
                    (uid,),
                    table_hint="users",
                )
                nick = (u or {}).get("nick") or uid
                school = (u or {}).get("school") or ""
                teams.append(
                    {
                        "team_id": uid,
                        "contest_id": contest_id,
                        "defunct": "N",
                        "password": None,
                        "name": nick,
                        "tmember": "",
                        "tkind": 0,
                        "coach": None,
                        "school": school,
                        "room": None,
                        "privilege": None,
                        "team_global_code": "default",
                        "region": None,
                        "addition": None,
                        "name_en": None,
                    }
                )

        sol_rows = db.fetchall(
            "SELECT * FROM solution WHERE contest_id=%s ORDER BY solution_id ASC",
            (contest_id,),
            table_hint="solution",
        )
        old_sids = [int(s["solution_id"]) for s in sol_rows]

        md = db.fetchone(
            "SELECT * FROM contest_md WHERE contest_id=%s",
            (contest_id,),
            table_hint="contest_md",
        )

        makedirs_chmod_new_dir_chain(export_dir, exist_ok=True, log=logger)
        makedirs_chmod_new_dir_chain(temp_dir, exist_ok=True, log=logger)
        date_tag = oj_now_workdir_tag()
        work_dir = os.path.join(temp_dir, f"{date_tag}-{created_by}-c{contest_id}")
        makedirs_chmod_new_dir_chain(work_dir, exist_ok=True, log=logger)

        try:
            inner_name = CONTEST_INNER_PROBLEM_ZIP_NAME
            inner_zip_bytes = build_problem_export_zip_bytes(
                problems,
                test_data=test_data,
                attach=attach,
                testdata_dir=testdata_dir,
                attach_base=attach_base,
                include_pdf_desc_without_testdata=True,
            )

            contest_row = dict(crow)
            contest_row["legacy_contest_id"] = contest_id

            cp_out = []
            for r in cprows:
                d = dict(r)
                pid = int(d.get("problem_id") or 0)
                d["problem_export_index"] = idx_by_pid.get(pid)
                cp_out.append(d)

            manifest: Dict[str, Any] = {
                "format": MANIFEST_FORMAT,
                "version": MANIFEST_VERSION,
                "source_contest_id": contest_id,
                "export_tag": export_tag,
                "participants_model": "cpc_team" if need_team else "users",
                "options": {
                    "test_data_check": test_data,
                    "attach_file_check": attach,
                },
                "problem_id_to_export_index": {str(k): v for k, v in idx_by_pid.items()},
            }

            zip_name = CONTEST_ARCHIVE_ZIP_NAME_TMPL.format(
                contest_id=int(contest_id), ts=date_tag
            )
            zip_path = os.path.join(work_dir, zip_name)
            with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
                zf.writestr(CSG_EXPORT_TIMEZONE_FILENAME, export_sidecar_json_bytes())
                zf.writestr("manifest.json", json.dumps(manifest, ensure_ascii=False))
                zf.writestr("contest.json", json.dumps(_row_json(contest_row), ensure_ascii=False))
                if md:
                    zf.writestr("contest_md.json", json.dumps(_row_json(md), ensure_ascii=False))
                zf.writestr("contest_problem.json", json.dumps([_row_json(x) for x in cp_out], ensure_ascii=False))
                zf.writestr("teams.json", json.dumps([_row_json(x) for x in teams], ensure_ascii=False))

                cg_rows = db.fetchall(
                    "SELECT * FROM contest_group WHERE contest_id=%s ORDER BY group_order ASC, group_id ASC",
                    (contest_id,),
                    table_hint="contest_group",
                )
                zf.writestr(
                    "contest_group.json",
                    json.dumps(
                        [_row_json(x) for x in _contest_group_rows_for_wire(cg_rows)],
                        ensure_ascii=False,
                    ),
                )

                # jsonl 行序须与源库主键/插入序一致，便于导入时自增 id 与 reply 等外键语义对齐
                _contest_jsonl_order = {
                    "contest_balloon": " ORDER BY problem_id ASC, team_id ASC",
                    "contest_msg": " ORDER BY msg_id ASC",
                    "contest_print": " ORDER BY print_id ASC",
                    "contest_topic": " ORDER BY topic_id ASC",
                    "cpc_client": " ORDER BY client_id ASC",
                    "cpc_team_group": " ORDER BY team_id ASC, group_id ASC",
                }
                for tname, hint in (
                    ("contest_balloon", "contest_balloon"),
                    ("contest_msg", "contest_msg"),
                    ("contest_print", "contest_print"),
                    ("contest_topic", "contest_topic"),
                    ("cpc_client", "cpc_client"),
                    ("cpc_team_group", "cpc_team_group"),
                ):
                    order_sql = _contest_jsonl_order.get(tname, "")
                    rows = db.fetchall(
                        f"SELECT * FROM {tname} WHERE contest_id=%s{order_sql}",
                        (contest_id,),
                        table_hint=hint,
                    )
                    if tname == "contest_print":
                        rows = _contest_print_rows_for_wire(rows, contest_id)
                    elif tname == "contest_topic":
                        rows = _contest_topic_rows_for_wire(rows, contest_id)
                    elif tname == "cpc_team_group":
                        rows = _cpc_team_group_rows_for_wire(rows)
                    _write_jsonl(zf, f"data/{tname}.jsonl", rows)

                if not need_team:
                    uids = sorted(
                        {
                            str(s.get("user_id") or "")
                            for s in sol_rows
                            if s.get("user_id")
                        }
                    )
                    urows = []
                    for u in uids:
                        row = db.fetchone(
                            "SELECT * FROM users WHERE user_id=%s",
                            (u,),
                            table_hint="users",
                        )
                        if row:
                            urows.append(row)
                    _write_jsonl(zf, "data/users.jsonl", urows)

                log_rows = db.fetchall(
                    "SELECT * FROM loginlog WHERE user_id LIKE %s ORDER BY `time` ASC",
                    (f"#cpc{contest_id}_%",),
                    table_hint="loginlog",
                )
                for r in log_rows:
                    r["user_id"] = _strip_cpc_user_prefix(str(r.get("user_id") or ""), contest_id)
                _write_jsonl(zf, "data/loginlog.jsonl", log_rows)

                sol_out = []
                for s in sol_rows:
                    d = dict(s)
                    d["legacy_solution_id"] = int(d["solution_id"])
                    d["team_id"] = _strip_cpc_user_prefix(str(d.get("user_id") or ""), contest_id)
                    pid = int(d.get("problem_id") or 0)
                    d["legacy_problem_id"] = pid if pid > 0 else None
                    d["problem_export_index"] = idx_by_pid.get(pid)
                    if d["problem_export_index"] is None and pid > 0:
                        logger.warning(
                            "contest_export: solution_id=%s problem_id=%s 不在赛题 contest_problem 映射中，"
                            "problem_export_index 将为空（导入时该条提交会被跳过）",
                            d["legacy_solution_id"],
                            pid,
                        )
                    for k in ("solution_id", "user_id", "problem_id", "contest_id"):
                        d.pop(k, None)
                    sol_out.append(d)
                _write_jsonl(zf, "data/solutions.jsonl", sol_out)

                sc_map = {}
                ci_map = {}
                ri_map = {}
                if old_sids:
                    placeholders = ",".join(["%s"] * len(old_sids))
                    sc_rows = db.fetchall(
                        f"SELECT * FROM source_code WHERE solution_id IN ({placeholders})",
                        tuple(old_sids),
                        table_hint="source_code",
                    )
                    for r in sc_rows:
                        sid = int(r["solution_id"])
                        src = r.get("source") or ""
                        zf.writestr(f"source_code/{sid}.txt", str(src))
                        sc_map[sid] = f"source_code/{sid}.txt"
                    ci_rows = db.fetchall(
                        f"SELECT * FROM compileinfo WHERE solution_id IN ({placeholders})",
                        tuple(old_sids),
                        table_hint="compileinfo",
                    )
                    for r in ci_rows:
                        sid = int(r["solution_id"])
                        err = r.get("error") or ""
                        zf.writestr(f"compileinfo/{sid}.txt", str(err))
                        ci_map[sid] = f"compileinfo/{sid}.txt"
                    ri_rows = db.fetchall(
                        f"SELECT * FROM runtimeinfo WHERE solution_id IN ({placeholders})",
                        tuple(old_sids),
                        table_hint="runtimeinfo",
                    )
                    for r in ri_rows:
                        sid = int(r["solution_id"])
                        err = r.get("error") or ""
                        zf.writestr(f"runtimeinfo/{sid}.txt", str(err))
                        ri_map[sid] = f"runtimeinfo/{sid}.txt"

                zf.writestr(
                    "data/source_index.json",
                    json.dumps({str(k): v for k, v in sc_map.items()}, ensure_ascii=False),
                )
                zf.writestr(
                    "data/compileinfo_index.json",
                    json.dumps({str(k): v for k, v in ci_map.items()}, ensure_ascii=False),
                )
                zf.writestr(
                    "data/runtimeinfo_index.json",
                    json.dumps({str(k): v for k, v in ri_map.items()}, ensure_ascii=False),
                )

                if old_sids:
                    placeholders_sim = ",".join(["%s"] * len(old_sids))
                    sim_rows = db.fetchall(
                        f"SELECT s_id, sim_s_id, sim FROM sim WHERE s_id IN ({placeholders_sim})",
                        tuple(old_sids),
                        table_hint="sim",
                    )
                    _write_jsonl(zf, "data/sim.jsonl", sim_rows)

                zf.writestr(f"problems/{inner_name}", inner_zip_bytes)

                ca = str(crow.get("attach") or "").strip()
                if ca and public_dir:
                    cap = os.path.join(public_dir, contest_attach_rel.lstrip("/"), ca)
                    if os.path.isdir(cap):
                        for root, _, files in os.walk(cap):
                            for fn in files:
                                fp = os.path.join(root, fn)
                                arc = os.path.join(
                                    "contest_attach", ca, os.path.relpath(fp, cap)
                                )
                                zf.write(fp, arc)

            final_path = os.path.join(export_dir, zip_name)
            shutil.move(zip_path, final_path)
            try:
                os.chmod(final_path, 0o644)
            except OSError:
                pass
            self.log_info(f"比赛导出完成: {final_path}")
            self.result = {
                "zip_path": final_path,
                "filename": zip_name,
                "contest_id": contest_id,
                "bt_display": _bt_contest_export_download_display(),
            }
        finally:
            shutil.rmtree(work_dir, ignore_errors=True)


QUEUED_TASK_REGISTRATION = {
    "task_type": "contest_export",
    "module": "backtask.task_queue.contest_export",
    "class_name": "ContestExportTask",
    "method": "run",
    "timeout_minutes": 180,
    "concurrency_mode": "read",
    "queue_key_fn": None,
}
