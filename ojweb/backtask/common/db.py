"""
PyMySQL 薄封装 —— 仅允许访问 backtask / backtask_log 两表。

连接参数从环境变量读取，与 ThinkPHP .env 同源：
  DB_HOSTNAME, DB_DATABASE, DB_USERNAME, DB_PASSWORD, DB_HOSTPORT
"""
import os
import json
import logging
import threading
import pymysql
import pymysql.cursors
from contextlib import contextmanager
from datetime import datetime
from typing import Optional, Dict, Any, List

from backtask.common.csg_datetime import oj_now, oj_now_naive_sql

logger = logging.getLogger("backtask.db")


class _UseAppWallNow:
    """仅供 update_task：该列写入 ``oj_now_naive_sql()``（应用墙钟 naive，与 MySQL 时区配置无关）。"""


USE_APP_WALL_NOW = _UseAppWallNow()
USE_MYSQL_NOW = USE_APP_WALL_NOW  # 兼容旧名；已不再使用 MySQL NOW()

ALLOWED_TABLES_WRITE = frozenset({"backtask", "backtask_log"})
ALLOWED_TABLES_READ = frozenset({
    "backtask", "backtask_log",
    "problem", "problem_md", "problem_locale", "problem_locale_html",
    "contest", "contest_balloon", "contest_md", "contest_msg", "contest_print",
    "contest_problem", "contest_topic", "contest_group",
    "solution", "source_code", "compileinfo", "runtimeinfo",
    "cpc_team", "cpc_team_group", "cpc_client", "users", "loginlog", "sim",
})

_local = threading.local()


def _read_env_file(path: str) -> dict:
    """解析 ThinkPHP 风格的 .env (key = value)."""
    env = {}
    try:
        with open(path, "r") as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#") or line.startswith(";"):
                    continue
                if "=" in line:
                    k, v = line.split("=", 1)
                    env[k.strip()] = v.strip()
    except FileNotFoundError:
        pass
    return env


def get_db_config() -> dict:
    """从环境变量 (优先) 或 /ojweb/.env 读取 DB 配置."""
    cfg = {
        "host": os.environ.get("DB_HOSTNAME", ""),
        "db": os.environ.get("DB_DATABASE", ""),
        "user": os.environ.get("DB_USERNAME", ""),
        "password": os.environ.get("DB_PASSWORD", ""),
        "port": int(os.environ.get("DB_HOSTPORT", "3306") or "3306"),
    }
    if not cfg["host"]:
        dotenv = _read_env_file("/ojweb/.env")
        cfg["host"] = dotenv.get("DB_HOSTNAME", "db")
        cfg["db"] = dotenv.get("DB_DATABASE", cfg["db"])
        cfg["user"] = dotenv.get("DB_USERNAME", cfg["user"])
        cfg["password"] = dotenv.get("DB_PASSWORD", cfg["password"])
        cfg["port"] = int(dotenv.get("DB_HOSTPORT", str(cfg["port"])))
    return cfg


def _connect() -> pymysql.Connection:
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
        read_timeout=60,
        write_timeout=60,
    )


def get_conn() -> pymysql.Connection:
    """线程安全：每个线程持有独立连接。"""
    conn = getattr(_local, "conn", None)
    if conn is None or not conn.open:
        conn = _connect()
        _local.conn = conn
        return conn
    try:
        conn.ping(reconnect=True)
    except Exception:
        conn = _connect()
        _local.conn = conn
    return conn


def close_conn():
    conn = getattr(_local, "conn", None)
    if conn and conn.open:
        try:
            conn.close()
        except Exception:
            pass
    _local.conn = None


@contextmanager
def transaction():
    """提供一个事务上下文，异常时自动 rollback。"""
    conn = get_conn()
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise


def _check_table(table: str, write: bool = False):
    allowed = ALLOWED_TABLES_WRITE if write else ALLOWED_TABLES_READ
    if table not in allowed:
        op = "写入" if write else "访问"
        raise PermissionError(f"backtask worker 禁止{op}表 '{table}'，仅允许 {allowed}")


def _safe_get_conn() -> pymysql.Connection:
    """获取连接，遇到坏连接时强制重建。"""
    try:
        return get_conn()
    except Exception:
        _local.conn = None
        return get_conn()


def execute(sql: str, args=None, table_hint: str = "") -> int:
    """执行写操作，返回 affected_rows。自动重连一次。"""
    if table_hint:
        _check_table(table_hint, write=True)
    for attempt in range(2):
        try:
            conn = _safe_get_conn()
            with conn.cursor() as cur:
                cur.execute(sql, args)
                rc = cur.rowcount
            conn.commit()
            return rc
        except (pymysql.OperationalError, pymysql.InterfaceError, OSError):
            close_conn()
            if attempt == 1:
                raise


def insert_get_id(sql: str, args=None, table_hint: str = "") -> int:
    """INSERT 后返回 lastrowid（仅允许 backtask / backtask_log）。"""
    if table_hint:
        _check_table(table_hint, write=True)
    for attempt in range(2):
        try:
            conn = _safe_get_conn()
            with conn.cursor() as cur:
                cur.execute(sql, args)
                new_id = cur.lastrowid
            conn.commit()
            return int(new_id)
        except (pymysql.OperationalError, pymysql.InterfaceError, OSError):
            close_conn()
            if attempt == 1:
                raise


def fetchone(sql: str, args=None, table_hint: str = "") -> Optional[Dict[str, Any]]:
    if table_hint:
        _check_table(table_hint)
    for attempt in range(2):
        try:
            conn = _safe_get_conn()
            with conn.cursor() as cur:
                cur.execute(sql, args)
                return cur.fetchone()
        except (pymysql.OperationalError, pymysql.InterfaceError, OSError):
            close_conn()
            if attempt == 1:
                raise


def fetchall(sql: str, args=None, table_hint: str = "") -> List[Dict[str, Any]]:
    if table_hint:
        _check_table(table_hint)
    for attempt in range(2):
        try:
            conn = _safe_get_conn()
            with conn.cursor() as cur:
                cur.execute(sql, args)
                return cur.fetchall()
        except (pymysql.OperationalError, pymysql.InterfaceError, OSError):
            close_conn()
            if attempt == 1:
                raise


# ─── backtask 表 helpers ─────────────────────────────────

def _worker_site_key() -> str:
    """与 PHP backtask_worker_site_key() 一致：多 PHP 容器同库时须一致，避免跨容器认领。"""
    for name in ("BACKTASK_SITE_KEY", "OJ_SESSION", "OJ_NAME"):
        v = (os.environ.get(name) or "").strip()
        if v:
            return v
    return "default"


def find_task(task_id: int) -> Optional[Dict[str, Any]]:
    return fetchone(
        "SELECT * FROM backtask WHERE task_id = %s",
        (task_id,), table_hint="backtask",
    )


def server_now() -> datetime:
    """应用时区下的当前墙钟（naive），与 ``csg_datetime.oj_now()`` 相同；不查询 MySQL。"""
    return oj_now()


def claim_pending_task(worker_id: str) -> Optional[Dict[str, Any]]:
    """
    原子认领一条 pending 任务（FOR UPDATE SKIP LOCKED）。
    返回被认领的行（已变为 running），无任务时返回 None。
    """
    for attempt in range(2):
        try:
            conn = _safe_get_conn()
            with conn.cursor() as cur:
                site_key = _worker_site_key()
                wall = oj_now_naive_sql()
                cur.execute(
                    "SELECT task_id FROM backtask "
                    "WHERE status = 0 AND (scheduled_at IS NULL OR scheduled_at <= %s) "
                    "AND %s = COALESCE(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(task_params, "
                    "'$.worker_site_key')), ''), 'default') "
                    "ORDER BY priority DESC, task_id ASC "
                    "LIMIT 1 "
                    "FOR UPDATE SKIP LOCKED",
                    (wall, site_key),
                )
                row = cur.fetchone()
                if not row:
                    conn.commit()
                    return None
                tid = row["task_id"]
                cur.execute(
                    "UPDATE backtask SET status = 10, locked_by = %s, "
                    "locked_at = %s, started_at = %s, attempt = attempt + 1 "
                    "WHERE task_id = %s AND status = 0",
                    (worker_id, wall, wall, tid),
                )
                if cur.rowcount != 1:
                    conn.commit()
                    return None
                conn.commit()
            return find_task(tid)
        except (pymysql.OperationalError, pymysql.InterfaceError, OSError):
            close_conn()
            if attempt == 1:
                raise


def update_task(task_id: int, **fields) -> int:
    """更新 backtask 表指定字段。"""
    if not fields:
        return 0
    app_wall_sql: Optional[str] = None
    if any(isinstance(v, _UseAppWallNow) for v in fields.values()):
        app_wall_sql = oj_now_naive_sql()
    parts: List[str] = []
    vals: List[Any] = []
    for k, v in fields.items():
        if isinstance(v, _UseAppWallNow):
            parts.append(f"{k} = %s")
            vals.append(app_wall_sql)
        else:
            parts.append(f"{k} = %s")
            vals.append(v)
    vals.append(task_id)
    return execute(
        f"UPDATE backtask SET {', '.join(parts)} WHERE task_id = %s",
        vals, table_hint="backtask",
    )


def heartbeat(task_id: int):
    execute(
        "UPDATE backtask SET heartbeat_at = %s WHERE task_id = %s",
        (oj_now_naive_sql(), task_id), table_hint="backtask",
    )


# ─── backtask_log 表 helpers ────────────────────────────

LOG_LEVEL_INFO = 10
LOG_LEVEL_WARNING = 20
LOG_LEVEL_ERROR = 30


def insert_log(task_id: int, level: int, message: str,
               status: int = 0, detail: Any = None):
    """往 backtask_log 插入一条日志。"""
    msg = message[:255] if message else ""
    detail_json = json.dumps(detail, ensure_ascii=False) if detail else None
    execute(
        "INSERT INTO backtask_log (task_id, level, status, message, detail) "
        "VALUES (%s, %s, %s, %s, %s)",
        (task_id, level, status, msg, detail_json),
        table_hint="backtask_log",
    )
