#!/usr/bin/env python3
"""
进入 PHP 容器后手动执行，检查 backtask worker 相关健康状态。

  python3 /ojweb/backtask/health_check.py

退出码：0 表示检查通过；1 表示存在问题（见输出中的 FAIL）。
当 CSGOJ_BACKTASK=0 时，不要求本机存在 worker 进程（副实例或未启 worker 属预期）。
"""
from __future__ import annotations

import os
import subprocess
import sys
from typing import Optional


def _ojweb_on_path() -> str:
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    if root not in sys.path:
        sys.path.insert(0, root)
    return root


def _print_kv(label: str, value: object, ok: Optional[bool] = None) -> None:
    if ok is True:
        tag = "OK"
    elif ok is False:
        tag = "FAIL"
    else:
        tag = "--"
    print(f"  [{tag}] {label}: {value}")


def _env_worker_expected() -> bool:
    if (os.environ.get("CSGOJ_BACKTASK") or "1").strip() in ("0", "false", "FALSE", "no", "NO"):
        return False
    belong = (os.environ.get("BELONG_TO") or "").strip()
    name = (os.environ.get("OJ_NAME") or "").strip()
    if belong and name and belong != name:
        if (os.environ.get("CSGOJ_BACKTASK_ON_SECONDARY") or "").strip() not in (
            "1", "true", "TRUE", "yes", "YES",
        ):
            return False
    return True


def _start_worker_pids() -> list[int]:
    try:
        proc = subprocess.run(
            ["ps", "aux"],
            capture_output=True,
            text=True,
            timeout=8,
            check=False,
        )
    except (FileNotFoundError, subprocess.TimeoutExpired):
        return []
    pids: list[int] = []
    for line in (proc.stdout or "").splitlines():
        if "backtask/start_worker.py" not in line:
            continue
        if "health_check.py" in line:
            continue
        parts = line.split(None, 10)
        if len(parts) < 2:
            continue
        try:
            pids.append(int(parts[1]))
        except ValueError:
            continue
    return pids


def main() -> int:
    _ojweb_on_path()
    print("backtask health_check")
    print("-" * 48)

    ok_all = True

    print("环境（与 entrypoint / worker 一致）")
    _print_kv("OJ_NAME", os.environ.get("OJ_NAME", "(未设置)"))
    _print_kv("BELONG_TO", os.environ.get("BELONG_TO", "(未设置)"))
    _print_kv("OJ_SESSION", os.environ.get("OJ_SESSION", "(未设置)"))
    _print_kv("BACKTASK_SITE_KEY", os.environ.get("BACKTASK_SITE_KEY", "(未设置)"))
    _print_kv("CSGOJ_BACKTASK", os.environ.get("CSGOJ_BACKTASK", "(未设置, 默认 1)"))
    _print_kv("CSGOJ_BACKTASK_ON_SECONDARY", os.environ.get("CSGOJ_BACKTASK_ON_SECONDARY", "(未设置)"))

    expect_worker = _env_worker_expected()
    _print_kv("本容器是否预期运行 worker", "是" if expect_worker else "否（仅 DB 等检查仍执行）")

    worker_script = os.path.join(os.path.dirname(__file__), "start_worker.py")
    script_exists = os.path.isfile(worker_script)
    _print_kv("start_worker.py 存在", worker_script, script_exists)
    ok_all = ok_all and script_exists

    pids = _start_worker_pids()
    if expect_worker:
        wp_ok = len(pids) > 0
        _print_kv(
            "start_worker 进程",
            f"pid={pids}" if pids else "未发现",
            wp_ok,
        )
        ok_all = ok_all and wp_ok
    else:
        _print_kv(
            "start_worker 进程（本容器不要求）",
            f"pid={pids}" if pids else "无",
            None,
        )

    print("-" * 48)
    print("数据库（backtask 表只读）")

    try:
        from backtask.common import db as dbmod
        from backtask.common.csg_datetime import oj_now_naive_sql
    except Exception as e:
        print(f"  [FAIL] 无法 import backtask.common.db: {e}")
        return 1

    cfg = dbmod.get_db_config()
    _print_kv("DB 目标", f"{cfg['user']}@{cfg['host']}:{cfg['port']}/{cfg['db']}")

    try:
        site_key = dbmod._worker_site_key()
        _print_kv("worker_site_key（与认领 SQL 一致）", site_key)

        row = dbmod.fetchone("SELECT 1 AS one", table_hint="backtask")
        if not row or row.get("one") != 1:
            print("  [FAIL] 连通性探测异常")
            ok_all = False
        else:
            _print_kv("MySQL 连通", "ping", True)

        wall = oj_now_naive_sql()
        pending = dbmod.fetchone(
            "SELECT COUNT(*) AS c FROM backtask WHERE status = 0 "
            "AND (scheduled_at IS NULL OR scheduled_at <= %s) "
            "AND %s = COALESCE(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(task_params, "
            "'$.worker_site_key')), ''), 'default')",
            (wall, site_key),
            table_hint="backtask",
        )
        n = int((pending or {}).get("c") or 0)
        _print_kv("待认领任务数（本 site_key）", n, True)

        running = dbmod.fetchone(
            "SELECT COUNT(*) AS c FROM backtask WHERE status = 10",
            table_hint="backtask",
        )
        rn = int((running or {}).get("c") or 0)
        _print_kv("执行中任务数（全站 status=10）", rn, True)
    except Exception as e:
        print(f"  [FAIL] 数据库: {e}")
        ok_all = False
    finally:
        try:
            dbmod.close_conn()
        except Exception:
            pass

    print("-" * 48)
    if ok_all:
        print("总结: OK")
        return 0
    print("总结: FAIL（见上文标记）")
    return 1


if __name__ == "__main__":
    sys.exit(main())
