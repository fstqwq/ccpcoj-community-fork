"""
比赛包解压后的入库（仅由 Python worker 调用）。与 ``problem_import_executor`` 相同使用 PyMySQL。
"""
from __future__ import annotations

import json
import logging
import os
import shutil
import zipfile
from typing import Any, Dict, List

import pymysql
import pymysql.cursors

from backtask.common.csg_datetime import oj_new_attach_style_folder_name
from backtask.common.csg_wire_time import (
    maybe_shift_wire_naive,
    read_sidecar_iana,
    require_consistent_iana,
)
from backtask.common.cpc_team_id_wire import db_prefixed_team_id
from backtask.common.db import get_db_config
from backtask.common.dir_permissions import chmod_tree_rwx_materialized, makedirs_chmod_new_dir_chain
from backtask.common.oj_timezone import resolve_oj_timezone
from backtask.task_queue.problem_import_executor import execute_problem_import

logger = logging.getLogger("backtask.task_queue.contest_import_executor")

MANIFEST_FORMAT = "csg_contest_archive"


def _new_contest_attach_folder_name() -> str:
    """与 PHP ``AttachFolderCalculation`` 一致：``yy-mm-dd`` + ``-`` + UUIDv4。"""
    return oj_new_attach_style_folder_name()


def _connect():
    cfg = get_db_config()
    return pymysql.connect(
        host=cfg["host"],
        port=cfg["port"],
        user=cfg["user"],
        password=cfg["password"],
        database=cfg["db"],
        charset="utf8mb4",
        cursorclass=pymysql.cursors.DictCursor,
        autocommit=False,
        connect_timeout=10,
        read_timeout=300,
        write_timeout=300,
    )


def _read_jsonl(path: str) -> List[Dict[str, Any]]:
    if not os.path.isfile(path):
        return []
    out: List[Dict[str, Any]] = []
    with open(path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            out.append(json.loads(line))
    return out


def _jsonl_dict_rows_sorted_by_int_field(path: str, field: str) -> List[Dict[str, Any]]:
    """按整型字段升序排列 jsonl 中的对象行，保证自增主键表导入后的相对顺序与源库一致（并兼容旧导出包行序）。"""

    def _sort_key(x: Dict[str, Any]) -> int:
        try:
            return int(x.get(field) or 0)
        except (TypeError, ValueError):
            return 0

    rows = [r for r in _read_jsonl(path) if isinstance(r, dict)]
    rows.sort(key=_sort_key)
    return rows


def _norm_private_for_import(pv: Any) -> int:
    try:
        v = int(pv)
    except (TypeError, ValueError):
        v = 2
    return (v // 10) * 10 + 2


def _sql_val_addition(v: Any) -> Any:
    if v is None:
        return None
    if isinstance(v, (dict, list)):
        return json.dumps(v, ensure_ascii=False)
    return v


def _solution_export_slot(
    s: Dict[str, Any], pid_to_export_index: Dict[str, int]
) -> int:
    """解析 solutions.jsonl 行对应的题包槽位（1-based problem_export_index）。

    优先 ``problem_export_index``；缺失时尝试 ``legacy_problem_id`` + manifest
    ``problem_id_to_export_index``（与导出端 ``contest_export`` 一致）。
    """
    raw = s.get("problem_export_index")
    if raw is not None and str(raw).strip() != "":
        try:
            v = int(raw)
        except (TypeError, ValueError):
            v = 0
        if v > 0:
            return v
    leg = s.get("legacy_problem_id")
    if leg is not None and str(leg).strip() != "":
        try:
            lp = int(leg)
        except (TypeError, ValueError):
            lp = 0
        if lp > 0:
            exp_i = pid_to_export_index.get(str(lp))
            if exp_i is not None:
                try:
                    return int(exp_i)
                except (TypeError, ValueError):
                    pass
    return 0


def _old_pid_to_new(
    old_pid: int,
    pid_to_export_index: Dict[str, int],
    slot_map: Dict[int, int],
) -> int:
    exp_i = pid_to_export_index.get(str(int(old_pid)))
    if exp_i is None:
        raise RuntimeError(f"题目旧 ID {old_pid} 不在比赛导出映射中")
    np = slot_map.get(int(exp_i))
    if not np:
        raise RuntimeError(f"题目槽位 {exp_i} 未映射到新 problem_id")
    return int(np)


def execute_contest_import(
    import_zip_path: str,
    work_extract_root: str,
    *,
    testdata_dir: str,
    public_attach_root: str,
    public_dir: str,
    contest_attach_rel: str,
    oj_status: str,
    regenerate_contest_attach: bool = False,
) -> Dict[str, Any]:
    if not os.path.isfile(import_zip_path):
        raise RuntimeError("比赛包不存在")
    makedirs_chmod_new_dir_chain(work_extract_root, exist_ok=True, log=logger)

    extracted: List[str] = []
    with zipfile.ZipFile(import_zip_path, "r") as zf:
        for n in zf.namelist():
            target = os.path.abspath(os.path.join(work_extract_root, n))
            base = os.path.abspath(work_extract_root)
            if target != base and not target.startswith(base + os.sep):
                raise RuntimeError("非法 zip 路径: " + n)
        zf.extractall(work_extract_root)
        extracted = zf.namelist()
    chmod_tree_rwx_materialized(work_extract_root, log=logger)
    outer_tz = read_sidecar_iana(work_extract_root)

    manifest_path = os.path.join(work_extract_root, "manifest.json")
    if not os.path.isfile(manifest_path):
        raise RuntimeError("包内缺少 manifest.json")
    with open(manifest_path, "r", encoding="utf-8") as f:
        manifest = json.load(f)
    if manifest.get("format") != MANIFEST_FORMAT:
        raise RuntimeError("manifest.format 不匹配")
    if int(manifest.get("version") or 0) != 1:
        raise RuntimeError("不支持的 manifest 版本")

    pid_to_export_index = {
        str(k): int(v) for k, v in (manifest.get("problem_id_to_export_index") or {}).items()
    }

    with open(os.path.join(work_extract_root, "contest.json"), "r", encoding="utf-8") as f:
        contest_row = json.load(f)

    zip_attach = str(contest_row.get("attach") or "").strip()
    ca = zip_attach
    if regenerate_contest_attach:
        ca = _new_contest_attach_folder_name()
        contest_row["attach"] = ca
    attach_fs_base = os.path.join(
        public_dir.rstrip("/\\"), contest_attach_rel.lstrip("/\\").replace("\\", "/")
    )

    conn = _connect()
    materialized: List[str] = []
    new_cid = 0
    try:
        with conn.cursor() as cur:
            if ca:
                cur.execute(
                    "SELECT contest_id FROM contest WHERE attach=%s AND attach<>'' LIMIT 1",
                    (ca,),
                )
                if cur.fetchone():
                    raise RuntimeError(f"比赛 attach 指纹已存在，拒绝导入: {ca}")
            cap = os.path.join(attach_fs_base, ca) if ca else ""
            if ca and os.path.isdir(cap):
                raise RuntimeError(f"比赛附件目录已存在: {cap}")

        inner_zip_name = None
        for name in extracted:
            if name.startswith("problems/") and name.lower().endswith(".zip"):
                inner_zip_name = name
                break
        if not inner_zip_name:
            raise RuntimeError("包内缺少 problems/*.zip")
        prob_dir = os.path.join(work_extract_root, "_problems_unpack")
        makedirs_chmod_new_dir_chain(prob_dir, exist_ok=True, log=logger)
        inner_path = os.path.join(work_extract_root, *inner_zip_name.split("/"))
        with zipfile.ZipFile(inner_path, "r") as pzf:
            pzf.extractall(prob_dir)
        chmod_tree_rwx_materialized(prob_dir, log=logger)

        inner_tz = read_sidecar_iana(prob_dir)
        require_consistent_iana(outer_tz, inner_tz)
        merged_tz = outer_tz or inner_tz
        app_wall = resolve_oj_timezone()
        contest_row["start_time"] = maybe_shift_wire_naive(
            contest_row.get("start_time"), merged_tz, app_wall
        )
        contest_row["end_time"] = maybe_shift_wire_naive(contest_row.get("end_time"), merged_tz, app_wall)

        try:
            pout = execute_problem_import(
                prob_dir,
                testdata_dir=testdata_dir,
                public_attach_root=public_attach_root,
                oj_status=oj_status,
                now_course_id=None,
                external_conn=conn,
                autocommit_each=False,
                bind_on_attach_duplicate=True,
                materialized_paths=materialized,
                package_wall_iana=merged_tz,
            )
        except Exception as e:
            raise RuntimeError("题目导入失败: " + str(e)) from e
        if pout.get("failedList"):
            raise RuntimeError("题目导入失败: " + "; ".join(pout["failedList"][:8]))
        slot_map = {int(k): int(v) for k, v in (pout.get("slotToProblemId") or {}).items()}

        cr = dict(contest_row)
        cr.pop("legacy_contest_id", None)
        cr.pop("contest_id", None)
        cr["private"] = _norm_private_for_import(cr.get("private"))
        # 导入即归档：冻结数据，评测机不派发该赛 pending（Judge2）、并配合 PHP 侧禁止赛内写操作
        cr["flg_archive"] = 1
        cr["clss_id"] = -1
        cr["addition"] = _sql_val_addition(cr.get("addition"))
        cr["flg_award_qty_mode"] = int(cr.get("flg_award_qty_mode") or 0)

        cols_c = [
            "title",
            "start_time",
            "end_time",
            "defunct",
            "description",
            "private",
            "langmask",
            "password",
            "clss_id",
            "attach",
            "topteam",
            "award_ratio",
            "flg_award_qty_mode",
            "frozen_minute",
            "frozen_after",
            "teachers",
            "addition",
            "flg_archive",
            "notification",
        ]
        ph = ",".join(["%s"] * len(cols_c))
        with conn.cursor() as cur:
            cur.execute(
                f"INSERT INTO contest ({','.join(cols_c)}) VALUES ({ph})",
                tuple(cr.get(c) for c in cols_c),
            )
            new_cid = int(cur.lastrowid)

        md_path = os.path.join(work_extract_root, "contest_md.json")
        if os.path.isfile(md_path):
            with open(md_path, "r", encoding="utf-8") as f:
                md = json.load(f)
            with conn.cursor() as cur:
                cur.execute(
                    "INSERT INTO contest_md (contest_id, description, notification) VALUES (%s,%s,%s)",
                    (new_cid, md.get("description"), md.get("notification")),
                )

        with open(os.path.join(work_extract_root, "teams.json"), "r", encoding="utf-8") as f:
            teams = json.load(f)
        if not isinstance(teams, list):
            teams = []
        cols_t = [
            "team_id",
            "contest_id",
            "defunct",
            "password",
            "name",
            "tmember",
            "tkind",
            "coach",
            "school",
            "room",
            "privilege",
            "team_global_code",
            "region",
            "addition",
            "name_en",
        ]
        ph_t = ",".join(["%s"] * len(cols_t))
        for t in teams:
            if not isinstance(t, dict):
                continue
            row = dict(t)
            row["contest_id"] = new_cid
            row["addition"] = _sql_val_addition(row.get("addition"))
            with conn.cursor() as cur:
                cur.execute(
                    f"INSERT INTO cpc_team ({','.join(cols_t)}) VALUES ({ph_t})",
                    tuple(row.get(c) for c in cols_t),
                )

        cg_path = os.path.join(work_extract_root, "contest_group.json")
        if os.path.isfile(cg_path):
            with open(cg_path, "r", encoding="utf-8") as f:
                contest_groups = json.load(f)
            if not isinstance(contest_groups, list):
                contest_groups = []
            cols_g = [
                "contest_id",
                "group_id",
                "group_name",
                "group_name_en",
                "group_order",
                "award_ratio_gold",
                "award_ratio_silver",
                "award_ratio_bronze",
                "flg_award_qty_mode",
                "topteam",
                "star_mode",
                "defunct",
                "addition",
            ]
            ph_g = ",".join(["%s"] * len(cols_g))
            for g in contest_groups:
                if not isinstance(g, dict):
                    continue
                gid = str(g.get("group_id") or "").strip()
                if not gid:
                    continue
                row_g = dict(g)
                row_g["contest_id"] = new_cid
                row_g["addition"] = _sql_val_addition(row_g.get("addition"))
                with conn.cursor() as cur:
                    cur.execute(
                        f"INSERT INTO contest_group ({','.join(cols_g)}) VALUES ({ph_g})",
                        tuple(row_g.get(c) for c in cols_g),
                    )

        tg_path = os.path.join(work_extract_root, "data/cpc_team_group.jsonl")
        if os.path.isfile(tg_path):
            cols_tg = ["contest_id", "team_id", "group_id", "in_date"]
            ph_tg = ",".join(["%s"] * len(cols_tg))
            for r in _read_jsonl(tg_path):
                if not isinstance(r, dict):
                    continue
                tid = str(r.get("team_id") or "").strip()
                gid = str(r.get("group_id") or "").strip()
                if not tid or not gid:
                    continue
                with conn.cursor() as cur:
                    cur.execute(
                        f"INSERT INTO cpc_team_group ({','.join(cols_tg)}) VALUES ({ph_tg})",
                        (
                            new_cid,
                            tid,
                            gid,
                            maybe_shift_wire_naive(r.get("in_date"), merged_tz, app_wall),
                        ),
                    )

        with open(os.path.join(work_extract_root, "contest_problem.json"), "r", encoding="utf-8") as f:
            cps = json.load(f)
        for cp in cps:
            if not isinstance(cp, dict):
                continue
            try:
                idx_i = int(cp.get("problem_export_index"))
            except (TypeError, ValueError):
                continue
            new_pid = slot_map.get(idx_i)
            if not new_pid:
                raise RuntimeError(f"contest_problem 缺少题目映射 slot={idx_i}")
            with conn.cursor() as cur:
                cur.execute(
                    "INSERT INTO contest_problem (problem_id, contest_id, title, num, pscore) "
                    "VALUES (%s,%s,%s,%s,%s)",
                    (
                        new_pid,
                        new_cid,
                        cp.get("title") or "",
                        int(cp.get("num") or 0),
                        float(cp.get("pscore") or 0),
                    ),
                )

        balloon_rows = [r for r in _read_jsonl(os.path.join(work_extract_root, "data/contest_balloon.jsonl")) if isinstance(r, dict)]
        balloon_rows.sort(
            key=lambda x: (int(x.get("problem_id") or 0), str(x.get("team_id") or ""))
        )
        for r in balloon_rows:
            opid = int(r.get("problem_id") or 0)
            npid = _old_pid_to_new(opid, pid_to_export_index, slot_map)
            with conn.cursor() as cur:
                cur.execute(
                    "INSERT INTO contest_balloon (contest_id, problem_id, team_id, room, ac_time, pst, bst, balloon_sender) "
                    "VALUES (%s,%s,%s,%s,%s,%s,%s,%s)",
                    (
                        new_cid,
                        npid,
                        r.get("team_id"),
                        r.get("room"),
                        int(r.get("ac_time") or 0),
                        int(r.get("pst") or 0),
                        int(r.get("bst") or 0),
                        r.get("balloon_sender"),
                    ),
                )

        for r in _jsonl_dict_rows_sorted_by_int_field(
            os.path.join(work_extract_root, "data/contest_msg.jsonl"), "msg_id"
        ):
            with conn.cursor() as cur:
                cur.execute(
                    "INSERT INTO contest_msg (contest_id, content, in_date, team_id, defunct) VALUES (%s,%s,%s,%s,%s)",
                    (
                        new_cid,
                        r.get("content"),
                        maybe_shift_wire_naive(r.get("in_date"), merged_tz, app_wall),
                        r.get("team_id"),
                        str(r.get("defunct") or "0")[:1],
                    ),
                )

        for r in _jsonl_dict_rows_sorted_by_int_field(
            os.path.join(work_extract_root, "data/contest_print.jsonl"), "print_id"
        ):
            print_team_id = db_prefixed_team_id(new_cid, r.get("team_id"))
            with conn.cursor() as cur:
                cur.execute(
                    "INSERT INTO contest_print (contest_id, team_id, source, print_status, in_date, ip, code_length, room) "
                    "VALUES (%s,%s,%s,%s,%s,%s,%s,%s)",
                    (
                        new_cid,
                        print_team_id,
                        r.get("source"),
                        int(r.get("print_status") or 0),
                        maybe_shift_wire_naive(r.get("in_date"), merged_tz, app_wall),
                        r.get("ip"),
                        int(r.get("code_length") or 0),
                        r.get("room"),
                    ),
                )

        # topic_id 升序：父帖先于回复；新库自增 topic_id 相对顺序与源库一致（兼容旧包任意行序）
        topic_rows = _jsonl_dict_rows_sorted_by_int_field(
            os.path.join(work_extract_root, "data/contest_topic.jsonl"), "topic_id"
        )
        old_to_new_topic: Dict[int, int] = {}
        for r in topic_rows:
            try:
                old_topic_id = int(r.get("topic_id") or 0)
            except (TypeError, ValueError):
                old_topic_id = 0
            raw_reply = r.get("reply")
            try:
                reply_val = int(raw_reply) if raw_reply is not None else 0
            except (TypeError, ValueError):
                reply_val = 0
            new_reply = reply_val
            if reply_val > 0:
                if reply_val not in old_to_new_topic:
                    raise RuntimeError(
                        f"contest_topic 数据异常：reply={reply_val} 指向的父帖尚未出现（请确认导出为 topic_id 升序）"
                    )
                new_reply = old_to_new_topic[reply_val]
            opid = r.get("problem_id")
            npid = None
            if opid is not None and str(opid).strip() != "":
                try:
                    oi = int(opid)
                except (TypeError, ValueError):
                    oi = 0
                if oi > 0:
                    npid = _old_pid_to_new(oi, pid_to_export_index, slot_map)
            topic_user_id = db_prefixed_team_id(new_cid, r.get("user_id"))
            with conn.cursor() as cur:
                cur.execute(
                    "INSERT INTO contest_topic (user_id, title, content, reply, public_show, contest_id, in_date, problem_id) "
                    "VALUES (%s,%s,%s,%s,%s,%s,%s,%s)",
                    (
                        topic_user_id,
                        r.get("title"),
                        r.get("content"),
                        new_reply,
                        int(r.get("public_show") or 0),
                        new_cid,
                        maybe_shift_wire_naive(r.get("in_date"), merged_tz, app_wall),
                        npid,
                    ),
                )
                new_topic_id = int(cur.lastrowid)
            if old_topic_id > 0:
                old_to_new_topic[old_topic_id] = new_topic_id

        for r in _jsonl_dict_rows_sorted_by_int_field(
            os.path.join(work_extract_root, "data/cpc_client.jsonl"), "client_id"
        ):
            row = dict(r)
            row.pop("client_id", None)
            row["contest_id"] = new_cid
            row["ssh_config"] = _sql_val_addition(row.get("ssh_config"))
            row["status"] = _sql_val_addition(row.get("status"))
            cols_cl = ["contest_id", "team_id_bind", "ip_bind", "ssh_config", "status"]
            with conn.cursor() as cur:
                cur.execute(
                    f"INSERT INTO cpc_client ({','.join(cols_cl)}) VALUES ({','.join(['%s']*len(cols_cl))})",
                    tuple(row.get(c) for c in cols_cl),
                )

        sol_path = os.path.join(work_extract_root, "data/solutions.jsonl")
        solutions = [s for s in _read_jsonl(sol_path) if isinstance(s, dict)]
        solutions.sort(
            key=lambda x: int(x.get("legacy_solution_id") or 0),
        )
        old_to_new_sid: Dict[int, int] = {}

        prefix = f"#cpc{new_cid}_"
        skipped_orphan_solutions = 0
        solutions_inserted = 0
        for s in solutions:
            legacy_sid = int(s.get("legacy_solution_id") or 0)
            team_id = str(s.get("team_id") or "")
            pidx = _solution_export_slot(s, pid_to_export_index)
            new_pid = int(slot_map.get(pidx) or 0)
            if new_pid <= 0:
                skipped_orphan_solutions += 1
                logger.warning(
                    "contest_import: 跳过无题目映射的提交 legacy_solution_id=%s team_id=%s "
                    "problem_export_index=%r legacy_problem_id=%r",
                    legacy_sid or None,
                    team_id,
                    s.get("problem_export_index"),
                    s.get("legacy_problem_id"),
                )
                continue
            uid = prefix + team_id
            cols_s = [
                "problem_id",
                "user_id",
                "nick",
                "time",
                "memory",
                "in_date",
                "result",
                "language",
                "ip",
                "contest_id",
                "valid",
                "num",
                "code_length",
                "judgetime",
                "pass_rate",
                "lint_error",
                "judger",
                "course_id",
            ]
            vals = [
                new_pid,
                uid,
                s.get("nick") or "",
                int(s.get("time") or 0),
                int(s.get("memory") or 0),
                maybe_shift_wire_naive(s.get("in_date"), merged_tz, app_wall),
                int(s.get("result") or 0),
                int(s.get("language") or 0),
                s.get("ip") or "",
                new_cid,
                int(s.get("valid") if s.get("valid") is not None else 1),
                int(s.get("num") if s.get("num") is not None else -1),
                int(s.get("code_length") or 0),
                maybe_shift_wire_naive(s.get("judgetime"), merged_tz, app_wall),
                s.get("pass_rate") if s.get("pass_rate") is not None else 0,
                int(s.get("lint_error") or 0),
                s.get("judger") or "LOCAL",
                s.get("course_id"),
            ]
            ph_s = ",".join(["%s"] * len(cols_s))
            with conn.cursor() as cur:
                cur.execute(
                    f"INSERT INTO solution ({','.join(cols_s)}) VALUES ({ph_s})",
                    tuple(vals),
                )
                nsid = int(cur.lastrowid)
            if legacy_sid > 0:
                old_to_new_sid[legacy_sid] = nsid
            solutions_inserted += 1

        sc_dir = os.path.join(work_extract_root, "source_code")
        ci_dir = os.path.join(work_extract_root, "compileinfo")
        ri_dir = os.path.join(work_extract_root, "runtimeinfo")
        for old_sid, new_sid in old_to_new_sid.items():
            sp = os.path.join(sc_dir, f"{old_sid}.txt")
            if os.path.isfile(sp):
                with open(sp, "r", encoding="utf-8", errors="replace") as sf:
                    src = sf.read()
                with conn.cursor() as cur:
                    cur.execute(
                        "INSERT INTO source_code (solution_id, source) VALUES (%s,%s)",
                        (new_sid, src),
                    )
            cp = os.path.join(ci_dir, f"{old_sid}.txt")
            if os.path.isfile(cp):
                with open(cp, "r", encoding="utf-8", errors="replace") as cf:
                    err = cf.read()
                with conn.cursor() as cur:
                    cur.execute(
                        "INSERT INTO compileinfo (solution_id, error) VALUES (%s,%s)",
                        (new_sid, err),
                    )
            rp = os.path.join(ri_dir, f"{old_sid}.txt")
            if os.path.isfile(rp):
                with open(rp, "r", encoding="utf-8", errors="replace") as rf:
                    rerr = rf.read()
                with conn.cursor() as cur:
                    cur.execute(
                        "INSERT INTO runtimeinfo (solution_id, error) VALUES (%s,%s)",
                        (new_sid, rerr),
                    )

        for r in _read_jsonl(os.path.join(work_extract_root, "data/sim.jsonl")):
            if not isinstance(r, dict):
                continue
            try:
                old_s = int(r.get("s_id") or 0)
            except (TypeError, ValueError):
                continue
            if old_s <= 0 or old_s not in old_to_new_sid:
                continue
            new_s = old_to_new_sid[old_s]
            new_sim_s = None
            raw_sim_s = r.get("sim_s_id")
            if raw_sim_s is not None and str(raw_sim_s).strip() != "":
                try:
                    old_pair = int(raw_sim_s)
                except (TypeError, ValueError):
                    old_pair = 0
                if old_pair > 0:
                    if old_pair not in old_to_new_sid:
                        continue
                    new_sim_s = old_to_new_sid[old_pair]
            sim_val = r.get("sim")
            try:
                sim_int = int(sim_val) if sim_val is not None else None
            except (TypeError, ValueError):
                sim_int = None
            with conn.cursor() as cur:
                cur.execute(
                    "INSERT INTO sim (s_id, sim_s_id, sim) VALUES (%s,%s,%s)",
                    (new_s, new_sim_s, sim_int),
                )

        for r in _read_jsonl(os.path.join(work_extract_root, "data/loginlog.jsonl")):
            uid = prefix + str(r.get("user_id") or "")
            with conn.cursor() as cur:
                cur.execute(
                    "INSERT INTO loginlog (user_id, password, success, ip, `time`) VALUES (%s,%s,%s,%s,%s)",
                    (uid, r.get("password"), int(r.get("success") or 0), r.get("ip"), r.get("time")),
                )

        conn.commit()

        if zip_attach:
            dest_attach = os.path.join(attach_fs_base, ca)
            src_attach = os.path.join(work_extract_root, "contest_attach", zip_attach)
            if os.path.isdir(src_attach):
                makedirs_chmod_new_dir_chain(os.path.dirname(dest_attach), exist_ok=True, log=logger)
                shutil.copytree(src_attach, dest_attach, dirs_exist_ok=True)
                chmod_tree_rwx_materialized(dest_attach, log=logger)
                materialized.append(dest_attach)

        out_summary: Dict[str, Any] = {
            "new_contest_id": new_cid,
            "problemsImported": len(slot_map),
            "problemsNewCount": int(pout.get("newCount") or 0),
            "problemsBoundCount": int(pout.get("boundCount") or 0),
            "solutionsImported": solutions_inserted,
            "skippedOrphanSolutions": skipped_orphan_solutions,
        }
        if regenerate_contest_attach and zip_attach:
            out_summary["contest_attach_regenerated"] = True
            out_summary["contest_attach_zip"] = zip_attach
            out_summary["contest_attach_new"] = ca
        return out_summary
    except Exception:
        conn.rollback()
        for p in reversed(materialized):
            shutil.rmtree(p, ignore_errors=True)
        raise
    finally:
        conn.close()
