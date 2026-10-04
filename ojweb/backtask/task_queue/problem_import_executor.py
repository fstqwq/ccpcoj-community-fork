"""
题目包解压后的入库与文件搬迁（仅由 Python worker 调用）。

使用独立 PyMySQL 连接，不经过 ``backtask.common.db`` 的表白名单（该模块仅允许 backtask 表写入）。

**CSGOJ 题包格式是严格的**：``problemlist.json`` 中每题必须含非空 ``problem_locales`` 数组，
缺失则该题被跳过并记入 failedList。外格式（Polygon / 酒井算协等）的兼容由前端转换层
（``polygon.js`` / ``thusaa.js``）负责——转换器必须输出完整合规的 CSGOJ 题包。

**旧版 CSGOJ 题包兼容**：在引入 ``problem_locales`` 多语言结构之前，系统导出的题包
将题面 Markdown 放在根级 ``*_md`` 字段（``description_md``、``input_md`` 等），不含
``problem_locales``。导入时由 ``_upgrade_legacy_row()`` 自动升级：从根级 ``*_md``
字段合成单条 ``locale_key="main"`` 的 locale，使旧包无需人工修改即可导入。
该升级仅针对 CSGOJ 自身旧版本导出的包，不影响外格式的严格性要求。

**字段同步点**（变更 ``problem_md`` / ``problem_locale`` / ``problem_locale_html`` 表列时须检查）：

- 题面 MD 段：``description`` / ``input`` / ``output`` / ``hint`` / ``source`` / ``author``
  → 须与 ``problem_md`` / ``problem_locale_html`` 表列、前端 ``polygon.js`` / ``thusaa.js`` locale 结构、
  ``problem_export.py`` 导出逻辑保持一致。
- locale 元数据：``locale_key`` / ``sort_order`` / ``locale_label`` / ``use_pdf`` / ``locale_visible``
  → 须与 ``problem_locale`` 表列一致。
- ``defunct``：**不参与题包约定**；若 zip 内 JSON 含该键（如旧导出），导入时**忽略**，``problem.defunct`` **一律写入** ``'1'``（隐藏），由管理员在后台再改为公开。
- 详见 **docs/guide/11.题包与比赛包ZIP格式.md** §2.2。

**附件目录**：若 ``{public_attach_root}/{attach}`` 已存在但库中无 ``problem.attach`` 对应行，视为可覆盖的孤立目录，继续导入并由 ``move_dir`` 清空目标后写入包内 ``ATTACH_*``（打 ``warning``）；与「库内已有同 attach 且未绑定合并」不同。
"""
from __future__ import annotations

import html
import json
import logging
import os
import re
import shutil
import subprocess
import tempfile
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

import pymysql
import pymysql.cursors

from backtask.common.csg_datetime import oj_new_attach_style_folder_name, oj_now_naive_sql
from backtask.common.csg_wire_time import read_sidecar_iana, wire_naive_sql_to_app_sql
from backtask.common.db import get_db_config
from backtask.common.dir_permissions import chmod_tree_rwx_materialized, makedirs_chmod_new_dir_chain
from backtask.common.oj_timezone import resolve_oj_timezone

logger = logging.getLogger("backtask.task_queue.problem_import_executor")

# ATTACH_* 根下仅允许扁平图片文件；在禁止路径/空白/控制字符与常见 URL/shell 特殊符前提下允许中文等 Unicode。
_ATTACH_IMAGE_EXT = re.compile(
    r"\.(jpg|jpeg|png|gif|bmp|svg|ico)$",
    re.IGNORECASE,
)
_ATTACH_NAME_FORBIDDEN = re.compile(r'[/\\\x00-\x1f\x7f\s<>:\"|?*%]')


def attach_top_filename_valid(name: str) -> bool:
    """题包 ``ATTACH_*`` 根目录允许的插图文件名（无子目录）。

    与历史仅 ASCII 白名单相比：允许中文等 Unicode，仍拒绝分隔符、空白、控制字符及 ``<>:"|?*%`` 等。"""
    if not name or name in (".", ".."):
        return False
    if ".." in name or name.startswith("."):
        return False
    if len(name) > 240 or len(name.encode("utf-8")) > 240:
        return False
    if _ATTACH_NAME_FORBIDDEN.search(name):
        return False
    if "/" in name or "\\" in name:
        return False
    m = _ATTACH_IMAGE_EXT.search(name)
    if not m:
        return False
    stem = name[: m.start()]
    return bool(stem)

# Polygon 题包转换：稳定指纹目录名（与前端 ``problem_pkg/polygon.js`` 一致）
# 旧：poly_ + 64 位 hex；新：与后台 ``yy-mm-dd-uuid`` 形态一致，由 SHA-256 前 38 个十六进制字符派生（内容固定则目录名固定）
POLY_ATTACH_LEGACY_RE = re.compile(r"^poly_[0-9a-f]{64}$", re.IGNORECASE)
POLY_ATTACH_DETERMINISTIC_RE = re.compile(
    r"^[0-9a-f]{2}-[0-9a-f]{2}-[0-9a-f]{2}-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",
    re.IGNORECASE,
)


def _is_polygon_package_attach_name(name: str) -> bool:
    s = (name or "").strip()
    return bool(POLY_ATTACH_LEGACY_RE.match(s) or POLY_ATTACH_DETERMINISTIC_RE.match(s))


def _pandoc_binary() -> str:
    exe = (os.environ.get("PANDOC_PATH") or "").strip()
    if exe and os.path.isfile(exe) and os.access(exe, os.X_OK):
        return exe
    w = shutil.which("pandoc")
    if w:
        return w
    raise RuntimeError("未找到 pandoc 可执行文件（可设置环境变量 PANDOC_PATH）")


def parse_markdown_to_html(md: Optional[str]) -> str:
    """
    与 PHP ``ParseMarkdown`` / ``Pandoc::convert`` 对齐：markdown 或首行 ``__LATEX__`` 的 latex，
    ``--to=html`` + ``--katex``；失败时回退为转义原文。
    """
    if md is None:
        return ""
    text = str(md)
    if not text.strip():
        return ""

    text = text.lstrip("\ufeff")
    first_line, sep, rest = text.partition("\n")
    if first_line.strip() == "__LATEX__":
        fmt_from = "latex"
        body = rest
    else:
        fmt_from = "markdown"
        body = text

    pandoc = _pandoc_binary()
    fd, path = tempfile.mkstemp(suffix=".md", text=False)
    os.close(fd)
    try:
        with open(path, "w", encoding="utf-8") as f:
            f.write(body)
        cmd = [pandoc, f"--from={fmt_from}", "--to=html", "--katex", path]
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
        out = (r.stdout or "").strip()
        err = (r.stderr or "").strip()
        if r.returncode != 0:
            logger.warning("pandoc exit=%s stderr=%s", r.returncode, err[:300])
            return html.escape(body)
        if not out and err and ("<p>" in err or "<span" in err):
            out = err
        if not out and body.strip():
            return html.escape(body)
        return out or ""
    except Exception as e:
        logger.warning("pandoc failed: %s", e)
        return html.escape(body)
    finally:
        try:
            os.unlink(path)
        except OSError:
            pass


def _field_html(row: Dict[str, Any], md_key: str, html_key: str) -> str:
    md = row.get(md_key)
    if md is not None and str(md).strip() != "":
        return parse_markdown_to_html(str(md))
    fallback = row.get(html_key)
    if fallback is not None and str(fallback).strip() != "":
        return str(fallback)
    return ""


def stem_valid(stem: str) -> bool:
    """与 PHP `problem_locale_pdf_stem_valid`、题包 `locale_key` 规范一致（ASCII 字母数字下划线连字符）。"""
    if not stem or len(stem) > 64 or stem.startswith("."):
        return False
    return bool(re.match(r"^[A-Za-z0-9_-]+$", stem))


def verify_attach_directory(path: str) -> Tuple[bool, str]:
    if not os.path.isdir(path):
        return True, ""
    try:
        names = os.listdir(path)
    except OSError as e:
        return False, str(e)
    for name in names:
        fp = os.path.join(path, name)
        if os.path.isdir(fp):
            return False, f"附件根目录不允许子目录: {name}"
        if not attach_top_filename_valid(name):
            return False, f"非法附件文件: {name}"
    return True, ""


def move_dir(src: str, dst: str) -> bool:
    if not os.path.isdir(src):
        return True
    parent = os.path.dirname(dst)
    try:
        makedirs_chmod_new_dir_chain(parent, exist_ok=True, log=logger)
    except OSError:
        return False
    if os.path.exists(dst) or os.path.lexists(dst):
        try:
            shutil.rmtree(dst, ignore_errors=True)
        except OSError:
            return False
    try:
        os.rename(src, dst)
        if os.path.isdir(dst):
            chmod_tree_rwx_materialized(dst, log=logger)
        return True
    except OSError:
        pass
    try:
        shutil.copytree(src, dst)
        shutil.rmtree(src, ignore_errors=True)
        if os.path.isdir(dst):
            chmod_tree_rwx_materialized(dst, log=logger)
        return os.path.isdir(dst)
    except OSError:
        return False


def _connect_import():
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
        read_timeout=120,
        write_timeout=120,
    )


def _norm_spj(v: Any) -> str:
    """与 ``problem.spj``、编辑页校验一致：仅允许 ``0`` / ``1`` / ``2``（标准 / 特判 TPJ / 交互）。"""
    if v is True:
        return "1"
    if v is False or v is None:
        return "0"
    s = str(v).strip()
    if s in ("0", "1", "2"):
        return s
    sl = s.lower()
    if sl == "true":
        return "1"
    return "0"


def _attach_folder_name() -> str:
    return oj_new_attach_style_folder_name()


# ── 旧版 CSGOJ 题包格式升级 ───────────────────────────────────────
# 多语言 problem_locales 结构引入之前，导出的 problemlist.json 每题
# 将 Markdown 内容放在根级 *_md 字段（description_md 等），不含
# problem_locales。此函数将其升级为当前格式。
_LEGACY_MD_FIELDS = ("description", "input", "output", "hint", "source", "author")


def _upgrade_legacy_row(row: Dict[str, Any]) -> bool:
    """若 *row* 是旧版 CSGOJ 题包条目，就地补充 ``problem_locales`` 并返回 True。

    判定条件（必须同时满足）：
    1. ``problem_locales`` 不存在或不是非空 list
    2. 存在至少一个根级 ``*_md`` 字段（``description_md`` 等）
    """
    locales = row.get("problem_locales")
    if isinstance(locales, list) and len(locales) > 0:
        return False

    has_any_md = any(
        row.get(f"{f}_md") is not None for f in _LEGACY_MD_FIELDS
    )
    if not has_any_md:
        return False

    locale_entry: Dict[str, Any] = {
        "locale_key": "main",
        "sort_order": 1,
        "locale_label": "",
        "use_pdf": 0,
        "locale_visible": 1,
    }
    for f in _LEGACY_MD_FIELDS:
        md_val = row.get(f"{f}_md")
        locale_entry[f] = str(md_val) if md_val is not None else ""

    row["problem_locales"] = [locale_entry]
    return True


def _auto_submit_solutions(conn, row: Dict[str, Any], new_pid: int, user_id: str) -> int:
    """将 ``problemlist.json`` 中该题的 ``solutions`` 数组写入 solution + source_code，result=0 待评测。"""
    solutions = row.get("solutions")
    if not solutions or not isinstance(solutions, list):
        return 0
    count = 0
    now_str = oj_now_naive_sql()
    for sol in solutions:
        if not isinstance(sol, dict):
            continue
        source = sol.get("source")
        if not source or not str(source).strip():
            continue
        source = str(source)
        lang = int(sol.get("language") or 0)
        try:
            with conn.cursor() as cur:
                cur.execute(
                    "INSERT INTO solution "
                    "(problem_id, user_id, nick, `time`, memory, in_date, result, language, "
                    "ip, contest_id, valid, num, code_length, pass_rate, lint_error, judger) "
                    "VALUES (%s,%s,%s,0,0,%s,0,%s,'127.0.0.1',0,1,-1,%s,0,0,'LOCAL')",
                    (new_pid, user_id, "", now_str, lang, len(source)),
                )
                new_sid = int(cur.lastrowid)
                cur.execute(
                    "INSERT INTO source_code (solution_id, source) VALUES (%s,%s)",
                    (new_sid, source),
                )
            count += 1
        except Exception:
            logger.warning("auto_submit solution failed pid=%s", new_pid, exc_info=True)
    return count


def execute_problem_import(
    import_temp_path: str,
    *,
    testdata_dir: str,
    public_attach_root: str,
    oj_status: str,
    now_course_id: Optional[int],
    external_conn: Any = None,
    autocommit_each: bool = True,
    bind_on_attach_duplicate: bool = False,
    materialized_paths: Optional[List[str]] = None,
    auto_submit_solutions: bool = False,
    submit_user_id: str = "",
    package_wall_iana: Optional[str] = None,
) -> Dict[str, Any]:
    """
    读取 ``import_temp_path/problemlist.json``，写 ``problem`` / ``problem_md`` / ``problem_locale_html`` / ``problem_locale``，
    搬迁 ``TEST_*`` / ``ATTACH_*``。返回与历史 PHP worker 兼容的 result 字段。

    成功条目在 ``addedList`` 中：新插入题为 ``{slot}:{title}``；因重复标识绑定已有题为 ``{slot}:bind:{problem_id}``。
    ``newCount`` / ``boundCount`` 为对应条数（便于前台展示「新增 / 与已有题目合并」而无需解析 ``addedList``）。

    - ``external_conn``：外部 PyMySQL 连接（与比赛导入同事务时传入）；不传则自建并在函数结束时关闭。
    - ``autocommit_each``：每题成功后是否 ``commit``（比赛导入应传 False，由外层统一提交）。
    - ``bind_on_attach_duplicate``：attach 指纹已在库中时绑定已有 ``problem_id``，不导新题、不搬迁文件。
    - ``materialized_paths``：成功创建的题目评测目录、附件目录绝对路径会 append，供失败时清理。
    - ``auto_submit_solutions``：为真时将 ``problemlist.json`` 中每题 ``solutions`` 写入 ``solution`` / ``source_code``，
      以 ``result=0``（Pending）触发评测。**比赛导入禁止传 True**。
    - ``submit_user_id``：自动提交代码时使用的用户 ID（通常为发起导入的管理员）。
    - ``package_wall_iana``：显式包级 IANA（如比赛包外层侧车）；默认读 ``import_temp_path`` 根侧车。
    """
    pl_path = os.path.join(import_temp_path, "problemlist.json")
    if not os.path.isfile(pl_path):
        raise RuntimeError("包内缺少 problemlist.json")

    with open(pl_path, "r", encoding="utf-8") as f:
        raw_problems: List[Dict[str, Any]] = json_load_list(f)

    pkg_wall_iana = package_wall_iana if package_wall_iana is not None else read_sidecar_iana(import_temp_path)
    app_wall_iana = resolve_oj_timezone()

    added_list: List[str] = []
    failed_list: List[str] = []
    new_count = 0
    bound_count = 0
    judge_ok = True
    attach_ok = True
    slot_to_problem_id: Dict[int, int] = {}

    def sort_key(t: Tuple[int, Dict[str, Any]]) -> int:
        i, r = t
        try:
            return int(r.get("problem_new_id") or i + 1)
        except (TypeError, ValueError):
            return i + 1

    problems = [p for _, p in sorted(enumerate(raw_problems), key=sort_key)]

    is_exp = str(oj_status or "").lower() == "exp"
    course_id = int(now_course_id or 0) if now_course_id else 0

    conn = external_conn if external_conn is not None else _connect_import()
    own_conn = external_conn is None
    try:
        for idx, row in enumerate(problems):
            slot = int(row.get("problem_new_id") or idx + 1)
            padded = str(slot).zfill(5)
            test_src = os.path.join(import_temp_path, f"TEST_{padded}")
            attach_src = os.path.join(import_temp_path, f"ATTACH_{padded}")
            title = (row.get("title") or "")[:200]

            attach_raw = row.get("attach")
            attach_str = str(attach_raw).strip() if attach_raw is not None else ""
            bound_pid: Optional[int] = None
            attach_name = ""

            if attach_str and _is_polygon_package_attach_name(attach_str):
                attach_name = attach_str
                attach_probe = os.path.join(public_attach_root.rstrip(os.sep), attach_name)
                with conn.cursor() as cur_dup:
                    cur_dup.execute(
                        "SELECT problem_id FROM problem WHERE attach=%s LIMIT 1",
                        (attach_name,),
                    )
                    hit = cur_dup.fetchone()
                if hit and bind_on_attach_duplicate:
                    bound_pid = int(hit["problem_id"])
                elif hit:
                    failed_list.append(
                        f"{slot}:{title!r} 跳过：attach 指纹已在题库中存在（防重复导入）"
                    )
                    continue
                elif os.path.exists(attach_probe):
                    # 无 DB 绑定时的目录多为上次导入失败/删题遗留；继续导入并由 move_dir 覆盖目标目录
                    logger.warning(
                        "题包导入: attach=%s 目录已存在但题库无绑定，将覆盖写入（slot=%s title=%r）",
                        attach_name,
                        slot,
                        (title or "")[:120],
                    )
            else:
                if attach_str:
                    attach_name = attach_str
                    with conn.cursor() as cur_dup:
                        cur_dup.execute(
                            "SELECT problem_id FROM problem WHERE attach=%s LIMIT 1",
                            (attach_name,),
                        )
                        hit2 = cur_dup.fetchone()
                    if hit2 and bind_on_attach_duplicate:
                        bound_pid = int(hit2["problem_id"])
                    elif hit2:
                        failed_list.append(
                            f"{slot}:{title!r} 跳过：attach 已在题库存在 {attach_name}"
                        )
                        continue
                    else:
                        attach_probe_np = os.path.join(
                            public_attach_root.rstrip(os.sep), attach_name
                        )
                        if os.path.exists(attach_probe_np):
                            logger.warning(
                                "题包导入: attach=%s 目录已存在但题库无绑定，将覆盖写入（slot=%s title=%r）",
                                attach_name,
                                slot,
                                (title or "")[:120],
                            )
                else:
                    attach_name = _attach_folder_name()

            if bound_pid is not None:
                slot_to_problem_id[slot] = bound_pid
                added_list.append(f"{slot}:bind:{bound_pid}")
                bound_count += 1
                if autocommit_each:
                    conn.commit()
                continue

            if _upgrade_legacy_row(row):
                logger.info("旧版 CSGOJ 题包自动升级 slot=%s title=%r", slot, title)

            locales_raw = row.get("problem_locales") or []
            if not isinstance(locales_raw, list) or len(locales_raw) < 1:
                failed_list.append(f"{slot}:{title!r} 跳过：problemlist 缺少 problem_locales")
                continue
            loc_items = [x for x in locales_raw if isinstance(x, dict)]

            def _loc_sort_key(item: Dict[str, Any]) -> int:
                try:
                    v = item.get("sort_order")
                    if v is None:
                        return 10**9
                    return int(v)
                except (TypeError, ValueError):
                    return 10**9

            loc_items.sort(key=_loc_sort_key)
            first_loc = loc_items[0]
            merged = dict(row)
            merged["description_md"] = first_loc.get("description")
            merged["input_md"] = first_loc.get("input")
            merged["output_md"] = first_loc.get("output")
            merged["hint_md"] = first_loc.get("hint")
            merged["source_md"] = first_loc.get("source")
            merged["author_md"] = first_loc.get("author")
            desc_h = _field_html(merged, "description_md", "description")
            in_h = _field_html(merged, "input_md", "input")
            out_h = _field_html(merged, "output_md", "output")
            hint_h = _field_html(merged, "hint_md", "hint")
            src_h = _field_html(merged, "source_md", "source")
            auth_h = _field_html(merged, "author_md", "author")

            in_date = row.get("in_date")
            use_now = not in_date
            if use_now:
                in_date = oj_now_naive_sql()
            elif isinstance(in_date, datetime):
                in_date = in_date.strftime("%Y-%m-%d %H:%M:%S")
            else:
                in_date = str(in_date)[:19]
            if not use_now:
                in_date = wire_naive_sql_to_app_sql(in_date, pkg_wall_iana, app_wall_iana)

            try:
                mem = int(row.get("memory_limit") or 256)
            except (TypeError, ValueError):
                mem = 256
            try:
                tl = float(row.get("time_limit") or 1)
            except (TypeError, ValueError):
                tl = 1.0

            # 公开/隐藏仅由库内管理；题包 defunct 不参与导入（新题一律隐藏）
            defunct = "1"
            sample_in = row.get("sample_input") or ""
            sample_out = row.get("sample_output") or ""

            try:
                with conn.cursor() as cur:
                    cur.execute(
                        """
                        INSERT INTO problem (
                          title, description, `input`, `output`, sample_input, sample_output,
                          spj, hint, source, in_date, time_limit, memory_limit, defunct,
                          accepted, submit, solved, author, attach, archived
                        ) VALUES (
                          %s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,0,0,0,%s,%s,0
                        )
                        """,
                        (
                            title,
                            desc_h,
                            in_h,
                            out_h,
                            sample_in,
                            sample_out,
                            _norm_spj(row.get("spj")),
                            hint_h,
                            _trunc_str(src_h, 255),
                            in_date,
                            tl,
                            mem,
                            defunct,
                            _trunc_str(auth_h, 255),
                            attach_name,
                        ),
                    )
                    new_pid = int(cur.lastrowid)

                    seen_lk: set[str] = set()
                    for i, loc in enumerate(loc_items):
                        lk = str(loc.get("locale_key") or "").strip()
                        if not lk:
                            raise RuntimeError("problem_locales 中存在空的 locale_key")
                        if lk in seen_lk:
                            raise RuntimeError("locale_key 重复: " + lk)
                        seen_lk.add(lk)
                        err = _locale_key_validate(lk)
                        if err:
                            raise RuntimeError(err)
                        try:
                            sort_order = (
                                int(loc.get("sort_order"))
                                if loc.get("sort_order") is not None
                                else i + 1
                            )
                        except (TypeError, ValueError):
                            sort_order = i + 1
                        if sort_order < 0 or sort_order > 255:
                            sort_order = i + 1
                        md_desc = loc.get("description")
                        if md_desc is None:
                            md_desc = ""
                        md_in = loc.get("input") if loc.get("input") is not None else ""
                        md_out = loc.get("output") if loc.get("output") is not None else ""
                        md_hint = loc.get("hint") if loc.get("hint") is not None else ""
                        md_source = loc.get("source")
                        md_author = loc.get("author")
                        cur.execute(
                            """
                            INSERT INTO problem_md (
                              problem_id, locale_key, description, `input`, `output`, hint, source, author
                            ) VALUES (%s,%s,%s,%s,%s,%s,%s,%s)
                            """,
                            (
                                new_pid,
                                lk[:64],
                                str(md_desc),
                                str(md_in),
                                str(md_out),
                                str(md_hint),
                                _trunc_str(_nullable_str(md_source), 255),
                                _trunc_str(_nullable_str(md_author), 255),
                            ),
                        )
                        h_desc = parse_markdown_to_html(str(md_desc))
                        h_in = parse_markdown_to_html(str(md_in))
                        h_out = parse_markdown_to_html(str(md_out))
                        h_hint = parse_markdown_to_html(str(md_hint))
                        h_src = parse_markdown_to_html(
                            str(md_source) if md_source is not None else ""
                        )
                        h_auth = parse_markdown_to_html(
                            str(md_author) if md_author is not None else ""
                        )
                        cur.execute(
                            """
                            INSERT INTO problem_locale_html (
                              problem_id, locale_key, description, `input`, `output`, hint, source, author
                            ) VALUES (%s,%s,%s,%s,%s,%s,%s,%s)
                            """,
                            (
                                new_pid,
                                lk[:64],
                                h_desc,
                                h_in,
                                h_out,
                                h_hint,
                                _trunc_str(h_src, 255),
                                _trunc_str(h_auth, 255),
                            ),
                        )
                        cur.execute(
                            """
                            INSERT INTO problem_locale (
                              problem_id, locale_key, sort_order, locale_label, use_pdf, locale_visible
                            ) VALUES (%s,%s,%s,%s,%s,%s)
                            """,
                            (
                                new_pid,
                                lk[:64],
                                sort_order,
                                str(loc.get("locale_label") or "")[:128],
                                int(loc.get("use_pdf") or 0),
                                0 if int(loc.get("locale_visible", 1) or 0) == 0 else 1,
                            ),
                        )

                    if is_exp and course_id > 0:
                        cur.execute(
                            """
                            INSERT IGNORE INTO course_item (course_id, item, item_id, pvrole)
                            VALUES (%s, 'problem', %s, '')
                            """,
                            (course_id, new_pid),
                        )

                if autocommit_each:
                    conn.commit()
            except Exception as e:
                if autocommit_each:
                    conn.rollback()
                failed_list.append(f"{slot}:{title!r} {e}")
                logger.exception("import problem slot %s failed", slot)
                continue

            slot_to_problem_id[slot] = new_pid
            added_list.append(f"{slot}:{title}")
            new_count += 1

            if auto_submit_solutions and submit_user_id:
                _auto_submit_solutions(conn, row, new_pid, submit_user_id)

            test_dst = os.path.join(testdata_dir, str(new_pid))
            if os.path.isdir(test_src):
                if not move_dir(test_src, test_dst):
                    judge_ok = False
                    failed_list.append(f"评测数据搬迁失败 TEST_{padded} -> {test_dst}")
                elif materialized_paths is not None:
                    materialized_paths.append(test_dst)

            attach_dst = os.path.join(public_attach_root.rstrip(os.sep), attach_name)
            if os.path.isdir(attach_src):
                if not move_dir(attach_src, attach_dst):
                    attach_ok = False
                    failed_list.append(f"附件搬迁失败 ATTACH_{padded}")
                else:
                    ok_v, msg_v = verify_attach_directory(attach_dst)
                    if not ok_v:
                        attach_ok = False
                        failed_list.append(f"附件校验失败: {msg_v}")
                    elif materialized_paths is not None:
                        materialized_paths.append(attach_dst)

    finally:
        if own_conn:
            conn.close()

    return {
        "addedList": added_list,
        "failedList": failed_list,
        "newCount": new_count,
        "boundCount": bound_count,
        "judgeDataFolderPermission": judge_ok,
        "attachFolderPermission": attach_ok,
        "attachFailedList": [],
        "slotToProblemId": slot_to_problem_id,
        "autoSubmitEnabled": auto_submit_solutions,
    }


def _nullable_str(v: Any) -> Optional[str]:
    if v is None:
        return None
    s = str(v).strip()
    return s if s else None


def _trunc_str(s: Optional[str], n: int) -> Optional[str]:
    if not s:
        return None
    s = str(s)
    return s if len(s) <= n else s[:n]


def _locale_key_validate(key: str) -> Optional[str]:
    if not stem_valid(key):
        return "locale_key 格式不合法"
    return None


def json_load_list(f) -> List[Dict[str, Any]]:
    raw = json.load(f)
    if not isinstance(raw, list):
        raise RuntimeError("problemlist.json 必须是数组")
    out = []
    for item in raw:
        if isinstance(item, dict):
            out.append(item)
    return out
