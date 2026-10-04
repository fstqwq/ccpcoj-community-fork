#!/usr/bin/env python3
"""
容器启动时数据库初始化：建库（若不存在）、空库导入 /SQL 下基线 .sql、已有库则按需跑 db_update.sql。

DB 配置与 backtask 一致：环境变量优先，缺项时读 /ojweb/.env（ThinkPHP 风格）。
"""
from __future__ import annotations

import os
import re
import sys
import time
from pathlib import Path
from typing import List, Optional

import pymysql
from pymysql.constants import CLIENT
from pymysql.cursors import DictCursor

_ojweb = os.path.dirname(os.path.abspath(__file__))
if _ojweb not in sys.path:
    sys.path.insert(0, _ojweb)

from backtask.common.db import get_db_config  # noqa: E402

SQL_DIR = Path("/SQL")
_MAX_CONNECT_ATTEMPTS = 10
_CONNECT_RETRY_SEC = 10

_SQL_KEYWORD = re.compile(
    r"\b(CREATE|DROP|ALTER|INSERT|UPDATE|DELETE|SELECT|CALL|BEGIN|END|DECLARE|SET|IF|THEN|ELSE|"
    r"PROCEDURE|FUNCTION|TABLE|DATABASE|SCHEMA)\b",
    re.I,
)


def is_statement_complete(line: str, delimiter: str) -> bool:
    line_wo_comment = re.sub(r"\s*--.*$", "", line)
    trimmed = line_wo_comment.rstrip(" \t\r\n")
    if not trimmed:
        return False
    if delimiter == ";":
        return trimmed.endswith(";")
    if len(trimmed) < len(delimiter):
        return False
    return trimmed[-len(delimiter) :] == delimiter


def finish_statement(statement: str, delimiter: str) -> Optional[str]:
    stmt = statement.rstrip()
    if delimiter != ";":
        stmt = re.sub(re.escape(delimiter) + r"\s*$", "", stmt, flags=re.MULTILINE).rstrip()
    else:
        stmt = stmt.rstrip(";")

    trimmed = stmt.strip()
    if not trimmed:
        return None

    has_sql = _SQL_KEYWORD.search(trimmed)
    if has_sql:
        lines_out: List[str] = []
        for line in trimmed.split("\n"):
            lt = line.strip()
            if not lt:
                continue
            if not re.match(r"^\s*(--|/\*)", lt):
                lines_out.append(line)
            elif _SQL_KEYWORD.search(lt):
                lines_out.append(line)
        trimmed = "\n".join(lines_out).strip()
        if not trimmed:
            return None
    else:
        if re.match(r"^\s*(--|/\*)", trimmed):
            return None

    return trimmed + ";"


def process_delimiter(sql: str) -> str:
    current_delimiter = ";"
    statements: List[str] = []
    current_statement = ""

    for line in sql.split("\n"):
        trimmed_line = line.strip()
        m = re.match(r"^\s*DELIMITER\s+(\S+)\s*$", trimmed_line, re.I)
        if m:
            if current_statement.strip():
                fin = finish_statement(current_statement, current_delimiter)
                if fin:
                    statements.append(fin)
                current_statement = ""
            current_delimiter = m.group(1)
            continue

        current_statement += line + "\n"
        if is_statement_complete(line, current_delimiter):
            fin = finish_statement(current_statement, current_delimiter)
            if fin:
                statements.append(fin)
            current_statement = ""

    if current_statement.strip():
        fin = finish_statement(current_statement, current_delimiter)
        if fin:
            statements.append(fin)

    return "\n".join(statements)


def quote_ident(name: str) -> str:
    return "`" + name.replace("`", "``") + "`"


def _drain_cursor(cur: pymysql.cursors.Cursor) -> None:
    while True:
        if cur.description:
            cur.fetchall()
        if not cur.nextset():
            break


def run_multi_sql(conn: pymysql.Connection, sql_text: str, *, label: str) -> None:
    with conn.cursor() as cur:
        cur.execute(sql_text)
        _drain_cursor(cur)


def import_all_sql_files(conn: pymysql.Connection, sql_dir: Path) -> None:
    names = sorted(f.name for f in sql_dir.iterdir() if f.is_file() and f.suffix.lower() == ".sql")
    for name in names:
        path = sql_dir / name
        sql_text = path.read_text(encoding="utf-8", errors="strict")
        try:
            run_multi_sql(conn, sql_text, label=name)
        except pymysql.Error as e:
            print(f"导入{name}失败: {e} (错误码: {e.args[0]})", file=sys.stderr)
            sys.exit(1)
        print(f"导入{name}")


def run_db_update_if_present(conn: pymysql.Connection, sql_dir: Path) -> None:
    update_file = sql_dir / "db_update.sql"
    if not update_file.is_file():
        return
    sql_raw = update_file.read_text(encoding="utf-8", errors="strict")
    processed = process_delimiter(sql_raw)
    if not re.search(r"CREATE\s+PROCEDURE\s+AddColumnIfNotExists", processed, re.IGNORECASE):
        preview = processed[:2000]
        stmt_count = processed.count(";")
        print(
            "错误：处理后的 SQL 中未找到存储过程定义，可能处理失败\n"
            f"处理后的 SQL 包含约 {stmt_count} 个分号片段\n"
            f"处理后的 SQL 预览（前2000字符）:\n{preview}",
            file=sys.stderr,
        )
        sys.exit(1)
    try:
        run_multi_sql(conn, processed, label="db_update.sql")
    except pymysql.Error as e:
        print(f"导入 db_update.sql 失败: {e} (错误码: {e.args[0]})", file=sys.stderr)
        sys.exit(1)
    print("导入 db_update.sql")
    print("导入 db_update.sql 完成")


def _connect_server(cfg: dict) -> pymysql.Connection:
    return pymysql.connect(
        host=cfg["host"],
        port=cfg["port"],
        user=cfg["user"],
        password=cfg["password"],
        charset="utf8mb4",
        autocommit=True,
        client_flag=CLIENT.MULTI_STATEMENTS,
        connect_timeout=10,
        read_timeout=3600,
        write_timeout=3600,
    )


def main() -> None:
    cfg = get_db_config()
    db_name = (cfg.get("db") or "").strip()
    if not cfg.get("host") or not db_name or not cfg.get("user"):
        print("缺少 DB 配置：需要 DB_HOSTNAME、DB_DATABASE、DB_USERNAME（及密码端口）", file=sys.stderr)
        sys.exit(1)

    conn: Optional[pymysql.Connection] = None
    for attempt in range(_MAX_CONNECT_ATTEMPTS):
        try:
            conn = _connect_server(cfg)
            print("连接数据库成功")
            break
        except pymysql.Error as e:
            if attempt >= _MAX_CONNECT_ATTEMPTS - 1:
                print(f"连接数据库失败: {e}", file=sys.stderr)
                sys.exit(1)
            print("等待数据库启动")
            time.sleep(_CONNECT_RETRY_SEC)

    assert conn is not None
    try:
        sql_dir = SQL_DIR
        with conn.cursor(DictCursor) as cur:
            cur.execute(
                "SELECT SCHEMA_NAME FROM INFORMATION_SCHEMA.SCHEMATA WHERE SCHEMA_NAME=%s",
                (db_name,),
            )
            schema_exists = cur.fetchone() is not None

        if not schema_exists:
            ddl = (
                f"CREATE DATABASE IF NOT EXISTS {quote_ident(db_name)} "
                "DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci"
            )
            try:
                with conn.cursor() as cur:
                    cur.execute(ddl)
            except pymysql.Error as e:
                print(f"建立数据库`{db_name}`失败: {e}", file=sys.stderr)
                sys.exit(1)
            conn.select_db(db_name)
            import_all_sql_files(conn, sql_dir)
        else:
            conn.select_db(db_name)
            with conn.cursor(DictCursor) as cur:
                cur.execute(
                    "SELECT COUNT(*) AS n FROM information_schema.tables WHERE table_schema=%s",
                    (db_name,),
                )
                row = cur.fetchone()
            table_count = int(row["n"]) if row and row.get("n") is not None else 0
            if table_count == 0:
                print("库已存在但无表，导入基线 SQL")
                import_all_sql_files(conn, sql_dir)
            run_db_update_if_present(conn, sql_dir)
        # Idempotent extension migration for existing 2.0.40 databases.
        from ccpc_migrate import migrate
        migrate(conn, db_name)
    finally:
        conn.close()

    print("数据库初始化完毕")


if __name__ == "__main__":
    main()
