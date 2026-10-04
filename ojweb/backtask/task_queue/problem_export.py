"""
题目打包导出（入队型）。

task_params 见类 doc；由 PHP create_ajax 入队，poll_and_run 执行。

problemlist.json：每题含 ``problem_locales``（与 ``problem_md`` + ``problem_locale`` 一一对应，按 ``sort_order``），
不再写入 ``primary_locale_*`` 或根级 ``description_md``（导入以 ``problem_locales`` 为准）。

``solutions``（可选）：导出时可附带各评测结果最早 N 次提交的代码（AC 取 10 条，其他取 5 条），
每条代码带注释头（题目标题、结果、语言、耗时/内存），供目标 OJ 导入时可选自动提交验证。

比赛导出复用：``query_problems_for_export``、``apply_export_pdf_flags_from_disk``、``write_problem_package_to_zipfile`` / ``build_problem_export_zip_bytes``。
"""
import io
import json
import logging
import os
import re
import shutil
import zipfile
from collections import defaultdict
from datetime import datetime
from typing import Any, Callable, Dict, List, Optional

from backtask.core.base_task import BaseTask
from backtask.common import db
from backtask.common.csg_datetime import oj_now_sql_digits14, oj_now_workdir_tag
from backtask.common.csg_wire_time import CSG_EXPORT_TIMEZONE_FILENAME, export_sidecar_json_bytes
from backtask.common.dir_permissions import makedirs_chmod_new_dir_chain
from backtask.common.oj_constants import (
    OJ_LANGUAGE,
    OJ_RESULT_TAG,
    OJ_RESULT_FULL,
    FINAL_RESULT_CODES,
    SOLUTIONS_EXPORT_LIMIT_AC,
    SOLUTIONS_EXPORT_LIMIT_OTHER,
    PROBLEM_EXPORT_EXCLUDE_COLUMNS,
)

logger = logging.getLogger("backtask.task_queue.problem_export")


def _safe_problem_zip_segment(s: str, max_len: int = 96) -> str:
    """ZIP 文件名片段：仅保留安全字符，供 OJ-Problem-* 命名使用。"""
    t = re.sub(r"[^A-Za-z0-9_.-]+", "_", str(s or "").strip())
    t = re.sub(r"_+", "_", t).strip("._-")
    if not t:
        t = "x"
    return t[:max_len]


def _oj_problem_export_final_name(export_tag: str, created_by: str) -> str:
    """
    独立题包下载名：OJ-Problem-csgoj-{export_tag}-{user}{YYYYMMDDHHMMSS}.zip
    （时间与用户名之间无分隔符，时间为连续数字。）
    """
    tag = _safe_problem_zip_segment(str(export_tag), 80)
    user = _safe_problem_zip_segment(str(created_by), 40)
    ts = oj_now_sql_digits14()
    return f"OJ-Problem-csgoj-{tag}-{user}{ts}.zip"


def _bt_error_display(cn: str, en: str) -> Dict[str, Any]:
    return {"kind": "error", "lines": [{"cn": cn, "en": en}]}


def _bt_problem_export_download_display(count: int) -> Dict[str, Any]:
    en = "1 problem" if count == 1 else f"{count} problems"
    return {
        "kind": "download",
        "lines": [
            {"cn": "题目包", "en": "Problem package"},
            {"cn": f"{count} 题", "en": en},
        ],
    }


def _solution_comment_header(
    source: str, language: int, result: int,
    time_ms: int, memory_kb: int, in_date, title: str,
) -> str:
    """在代码前插入与 /csgoj/status 代码查看风格一致的注释头。"""
    lang_name = OJ_LANGUAGE.get(language, f"Lang({language})")
    tag = OJ_RESULT_TAG.get(result, "??")
    full = OJ_RESULT_FULL.get(result, tag)

    perf = f"Result: {tag} ({full})"
    if result == 4:
        perf += f" | Time: {time_ms}ms | Memory: {memory_kb}KB"

    date_str = str(in_date)[:19] if in_date else ""
    info = f"Language: {lang_name} | Submitted: {date_str}"

    if language == 6:  # Python
        header = (
            f"# [CSGOJ Export] {title}\n"
            f"# {perf}\n"
            f"# {info}\n"
            f"#\n"
        )
    else:
        header = (
            f"/*\n"
            f" * [CSGOJ Export] {title}\n"
            f" * {perf}\n"
            f" * {info}\n"
            f" */\n"
        )
    return header + source


def query_solutions_for_export(problem_ids: List[int], title_by_pid: Dict[int, str]) -> Dict[int, list]:
    """按题目 ID 查询各评测结果最早 N 条提交代码（AC=10，其他=5），返回 {pid: [solution_dict, ...]}。"""
    if not problem_ids:
        return {}
    ph = ",".join(["%s"] * len(problem_ids))
    rph = ",".join(["%s"] * len(FINAL_RESULT_CODES))
    rows = db.fetchall(
        f"SELECT solution_id, problem_id, result, language, `time`, memory, in_date, code_length "
        f"FROM solution WHERE problem_id IN ({ph}) AND result IN ({rph}) "
        f"ORDER BY problem_id, result, solution_id ASC",
        tuple(problem_ids) + FINAL_RESULT_CODES,
        table_hint="solution",
    )
    groups: Dict[tuple, list] = defaultdict(list)
    for r in rows:
        key = (r["problem_id"], r["result"])
        limit = SOLUTIONS_EXPORT_LIMIT_AC if r["result"] == 4 else SOLUTIONS_EXPORT_LIMIT_OTHER
        if len(groups[key]) < limit:
            groups[key].append(r)

    all_sids = [s["solution_id"] for sols in groups.values() for s in sols]
    if not all_sids:
        return {}
    sph = ",".join(["%s"] * len(all_sids))
    sc_rows = db.fetchall(
        f"SELECT solution_id, source FROM source_code WHERE solution_id IN ({sph})",
        tuple(all_sids),
        table_hint="source_code",
    )
    source_map = {r["solution_id"]: r["source"] for r in sc_rows}

    out: Dict[int, list] = defaultdict(list)
    for (pid, _res), sols in groups.items():
        for s in sols:
            src = source_map.get(s["solution_id"])
            if not src:
                continue
            title = title_by_pid.get(pid, "")
            commented = _solution_comment_header(
                src, s["language"], s["result"],
                int(s.get("time") or 0), int(s.get("memory") or 0),
                s.get("in_date"), title,
            )
            out[pid].append({
                "source": commented,
                "language": int(s["language"]),
                "result": int(s["result"]),
                "result_tag": OJ_RESULT_TAG.get(s["result"], "??"),
            })
    return dict(out)

def query_problems_for_export(problem_ids: List[int]):
    """按 ``problem_ids`` 顺序返回导出用题目行（含 ``problem_locales`` / ``problem_new_id``）。

    使用 ``SELECT *`` 以跟随数据库 schema 变化；不应出现在导出 JSON 中的列
    由 ``PROBLEM_EXPORT_EXCLUDE_COLUMNS``（见 ``oj_constants.py``）集中排除。
    """
    if not problem_ids:
        return []
    placeholders = ",".join(["%s"] * len(problem_ids))
    rows = db.fetchall(
        f"SELECT * FROM problem WHERE problem_id IN ({placeholders}) "
        f"ORDER BY FIELD(problem_id, {placeholders})",
        tuple(problem_ids) + tuple(problem_ids),
        table_hint="problem",
    )
    if PROBLEM_EXPORT_EXCLUDE_COLUMNS:
        rows = [
            {k: v for k, v in r.items() if k not in PROBLEM_EXPORT_EXCLUDE_COLUMNS}
            for r in rows
        ]
    md_rows = db.fetchall(
        f"SELECT problem_id, locale_key, description, `input`, `output`, hint, source, author "
        f"FROM problem_md WHERE problem_id IN ({placeholders})",
        tuple(problem_ids),
        table_hint="problem_md",
    )
    md_by = defaultdict(dict)
    for r in md_rows:
        pid = r["problem_id"]
        lk = r.get("locale_key")
        if lk:
            md_by[pid][lk] = r

    loc_rows = db.fetchall(
        f"SELECT problem_id, locale_key, sort_order, locale_label, use_pdf, locale_visible "
        f"FROM problem_locale WHERE problem_id IN ({placeholders}) "
        f"ORDER BY problem_id, sort_order ASC, locale_key ASC",
        tuple(problem_ids),
        table_hint="problem_locale",
    )
    loc_map = defaultdict(list)
    for r in loc_rows:
        pid = r["problem_id"]
        lk = r.get("locale_key")
        m = md_by[pid].get(lk, {})
        loc_map[pid].append(
            {
                "locale_key": lk,
                "sort_order": int(r.get("sort_order") or 0),
                "locale_label": r.get("locale_label", "") or "",
                "use_pdf": int(r.get("use_pdf") or 0),
                "locale_visible": int(r.get("locale_visible", 1) or 0),
                "description": m.get("description", "") or "",
                "input": m.get("input", "") or "",
                "output": m.get("output", "") or "",
                "hint": m.get("hint", "") or "",
                "source": m.get("source"),
                "author": m.get("author"),
            }
        )

    result = []
    for idx, row in enumerate(rows):
        pid = row["problem_id"]
        row["problem_locales"] = loc_map.get(pid, [])
        row["problem_new_id"] = idx + 1
        for k, v in row.items():
            if isinstance(v, datetime):
                row[k] = v.strftime("%Y-%m-%d %H:%M:%S")
        result.append(row)
    return result


def apply_export_pdf_flags_from_disk(problems: list, testdata_dir: str) -> None:
    """
    若 ``{testdata_dir}/{problem_id}/pdf_desc/{locale_key}.pdf`` 存在，则将该语言在
    ``problem_locales`` 中的 ``use_pdf`` 置为 1。

    磁盘打包路径（``_add_testdata_to_zip``）本就不看 ``use_pdf``；此处保证 **problemlist.json**
    与包内 PDF 一致，避免导入后「有题面 PDF 文件但语言仍标记为不用 PDF」。
    """
    root = (testdata_dir or "").strip()
    if not root or not problems:
        return
    for prob in problems:
        try:
            pid = int(prob.get("problem_id") or 0)
        except (TypeError, ValueError):
            continue
        if pid <= 0:
            continue
        pdf_dir = os.path.join(root, str(pid), "pdf_desc")
        if not os.path.isdir(pdf_dir):
            continue
        for loc in prob.get("problem_locales") or []:
            lk = str(loc.get("locale_key") or "").strip()
            if not lk:
                continue
            fp = os.path.join(pdf_dir, f"{lk}.pdf")
            if os.path.isfile(fp):
                loc["use_pdf"] = 1


def _add_testdata_to_zip(
    zf: zipfile.ZipFile,
    padded: str,
    pid: int,
    testdata_dir: str,
    full_test_data: bool,
) -> None:
    """写入 TEST_{padded}；``full_test_data`` 为假时仅打包 ``pdf_desc`` 子树。"""
    td = os.path.join(testdata_dir, str(pid))
    if not os.path.isdir(td):
        return
    prefix = f"TEST_{padded}"
    if full_test_data:
        for root, _, files in os.walk(td):
            for fn in files:
                fp = os.path.join(root, fn)
                zf.write(fp, os.path.join(prefix, os.path.relpath(fp, td)))
        return
    pdf_root = os.path.join(td, "pdf_desc")
    if os.path.isdir(pdf_root):
        for root, _, files in os.walk(pdf_root):
            for fn in files:
                fp = os.path.join(root, fn)
                arc = os.path.join(prefix, "pdf_desc", os.path.relpath(fp, pdf_root))
                zf.write(fp, arc)


def attach_solutions_to_problems(problems: list, include_solutions: bool = False) -> None:
    """若 ``include_solutions``，按题查询最早 N 条代码并写入每题的 ``solutions`` 字段。"""
    if not include_solutions or not problems:
        return
    pids = [int(p["problem_id"]) for p in problems if p.get("problem_id")]
    title_map = {int(p["problem_id"]): (p.get("title") or "") for p in problems}
    sols_map = query_solutions_for_export(pids, title_map)
    for p in problems:
        pid = int(p.get("problem_id") or 0)
        p["solutions"] = sols_map.get(pid, [])


def write_problem_package_to_zipfile(
    zf: zipfile.ZipFile,
    problems: list,
    *,
    test_data: bool,
    attach: bool,
    testdata_dir: str,
    attach_base: str,
    progress_cb: Optional[Callable[[int, int], None]] = None,
    include_pdf_desc_without_testdata: bool = True,
    check_stop: Optional[Callable[[], bool]] = None,
    include_solutions: bool = False,
) -> bool:
    """
    将题目包写入已打开的 ZipFile（根级 ``problemlist.json`` + TEST_* / ATTACH_*）。

    - ``test_data=True``：打包完整评测目录。
    - ``test_data=False`` 且 ``include_pdf_desc_without_testdata=True``：仍打包各题 ``pdf_desc/``。

    若 ``check_stop`` 返回真则停止追加题目，返回 ``False``；否则返回 ``True``。

    写入 ``problemlist.json`` 前会调用 ``apply_export_pdf_flags_from_disk``，与磁盘 ``pdf_desc`` 一致。
    """
    apply_export_pdf_flags_from_disk(problems, testdata_dir)
    attach_solutions_to_problems(problems, include_solutions=include_solutions)
    zf.writestr(CSG_EXPORT_TIMEZONE_FILENAME, export_sidecar_json_bytes())
    zf.writestr("problemlist.json", json.dumps(problems, ensure_ascii=False))
    total = len(problems)
    full_td = bool(test_data)
    if not test_data and not include_pdf_desc_without_testdata:
        full_td = False
    for idx, prob in enumerate(problems):
        if check_stop and check_stop():
            return False
        pid = prob["problem_id"]
        padded = str(prob["problem_new_id"]).zfill(5)
        if test_data or include_pdf_desc_without_testdata:
            _add_testdata_to_zip(zf, padded, int(pid), testdata_dir, full_td)
        if attach and prob.get("attach"):
            ad = os.path.join(attach_base, prob["attach"])
            if os.path.isdir(ad):
                for root, _, files in os.walk(ad):
                    for fn in files:
                        fp = os.path.join(root, fn)
                        zf.write(fp, os.path.join(f"ATTACH_{padded}", os.path.relpath(fp, ad)))
        if progress_cb and ((idx + 1) % 5 == 0 or idx + 1 == total):
            progress_cb(idx + 1, total)
    return True


def build_problem_export_zip_bytes(
    problems: list,
    *,
    test_data: bool,
    attach: bool,
    testdata_dir: str,
    attach_base: str,
    include_pdf_desc_without_testdata: bool = True,
    include_solutions: bool = False,
) -> bytes:
    """内存中生成与独立题目导出相同内部结构的 ZIP 字节（用于比赛包内嵌）。"""
    bio = io.BytesIO()
    with zipfile.ZipFile(bio, "w", zipfile.ZIP_DEFLATED) as zf:
        write_problem_package_to_zipfile(
            zf,
            problems,
            test_data=test_data,
            attach=attach,
            testdata_dir=testdata_dir,
            attach_base=attach_base,
            include_pdf_desc_without_testdata=include_pdf_desc_without_testdata,
            check_stop=None,
            include_solutions=include_solutions,
        )
    return bio.getvalue()


class ProblemExportTask(BaseTask):

    def run(self):
        problem_ids = self.task_params.get("problem_ids", [])
        export_tag = self.task_params.get("export_tag", "notag")
        test_data = self.task_params.get("test_data_check", False)
        attach = self.task_params.get("attach_file_check", False)
        include_solutions = bool(self.task_params.get("include_solutions", True))
        testdata_dir = self.task_params.get("testdata_dir", "/home/judge/data")
        attach_base = self.task_params.get("attach_base_dir", "")
        export_dir = self.task_params.get("export_dir", "/tmp")
        temp_dir = self.task_params.get("export_temp_dir", "/tmp/export_temp")
        created_by = self.task_params.get("created_by", "unknown")

        if not problem_ids:
            self.log_error("problem_ids 为空")
            self.result = {
                "error": "empty problem_ids",
                "count": 0,
                "bt_display": _bt_error_display("题目 ID 为空", "Empty problem_ids"),
            }
            return

        self.update_progress(f"查询 {len(problem_ids)} 道题目...")
        problems = query_problems_for_export(problem_ids)
        if not problems:
            self.log_error("未查询到任何题目")
            self.result = {
                "error": "no problems found",
                "count": 0,
                "bt_display": _bt_error_display("未找到题目", "No problems found"),
            }
            return

        total = len(problems)
        self.log_info(f"开始导出 {total} 道题 (test_data={test_data}, attach={attach})")

        makedirs_chmod_new_dir_chain(export_dir, exist_ok=True, log=logger)
        makedirs_chmod_new_dir_chain(temp_dir, exist_ok=True, log=logger)
        date_tag = oj_now_workdir_tag()
        work_dir = os.path.join(temp_dir, f"{date_tag}-{created_by}")
        makedirs_chmod_new_dir_chain(work_dir, exist_ok=True, log=logger)

        try:
            zip_name = "export-inner.zip"
            zip_path = os.path.join(work_dir, zip_name)

            with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
                completed = write_problem_package_to_zipfile(
                    zf,
                    problems,
                    test_data=bool(test_data),
                    attach=bool(attach),
                    testdata_dir=str(testdata_dir),
                    attach_base=str(attach_base),
                    progress_cb=lambda cur, tot: self.update_progress(f"打包 {cur}/{tot}"),
                    include_pdf_desc_without_testdata=True,
                    check_stop=lambda: self.check_stop(),
                    include_solutions=include_solutions,
                )
                if not completed:
                    self.log_info("用户取消")
                    return

            final_name = _oj_problem_export_final_name(str(export_tag), str(created_by))
            final_path = os.path.join(export_dir, final_name)
            shutil.move(zip_path, final_path)
            try:
                os.chmod(final_path, 0o644)
            except OSError:
                logger.warning("chmod export zip failed: %s", final_path, exc_info=True)
            try:
                if hasattr(os, "geteuid") and os.geteuid() == 0:
                    import grp
                    import pwd

                    uid = pwd.getpwnam("www-data").pw_uid
                    gid = grp.getgrnam("www-data").gr_gid
                    os.chown(final_path, uid, gid)
            except Exception:
                pass

            self.log_info(f"导出完成: {total} 道 → {final_name}")
            self.result = {
                "zip_path": final_path,
                "count": total,
                "filename": final_name,
                "bt_display": _bt_problem_export_download_display(total),
            }
        finally:
            shutil.rmtree(work_dir, ignore_errors=True)


QUEUED_TASK_REGISTRATION = {
    "task_type": "problem_export",
    "module": "backtask.task_queue.problem_export",
    "class_name": "ProblemExportTask",
    "method": "run",
    "timeout_minutes": 60,
    "concurrency_mode": "read",
    "queue_key_fn": None,
}
