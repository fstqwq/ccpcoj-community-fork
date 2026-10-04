#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
将已有 nginx conf.d 中「CSGOJ OJ」server 块与仓库模板对齐。

**唯一事实来源**（须与仓库同步维护，脚本内不硬编码业务数值）：
  - nginx_base.conf（可选 --sync-base 写入生产 conf.d）
  - oj.http.conf.template
  - oj.ssl.singleport.conf.template
  - oj.ssl443.with80redir.conf.template

从上述文件解析：OJ root 行、php upstream 端口、各模板 PHP location 的 fastcgi 间隔超时、
以及 HTTP / SSL 单端口 / 443 三套「client_body_timeout → 注释 → root」同步区；
以及 ``# CSGOJ_OJ_LOC_SYNC_BEGIN/END`` 标记区内各 ``location``（路径 ``/var/www/public/csgoj/`` 按目标 conf 的 ``/upload/`` 实例名替换）。

用法（主流程）::

    python3 update_nginx_oj_confs.py <conf> [user@host[:端口]]
        [--pass PWD | -p PWD]
        [--clear-pass] [--clear-auth] [--clear-extra]
        [--extra PWD@USER]
        [--templates-dir DIR] [--dry-run] [--restart]

- 目标 conf：仅文件名时默认 ``/csgoj_data/nginx/nginx_conf.d/<文件名>``；否则按给定路径。
- 可选 ``--restart``：非 dry-run 时在目标机执行 ``docker restart nginx-server``（与 SSH/本地逻辑一致）。
- 若提供 ``user@host``（可选 ``:端口``，默认 22），经 scp/ssh 读写远端文件；否则改本地路径。
- **Basic / htpasswd**：``auth_basic_user_file`` 为标准 htpasswd，**支持多用户**。主账号行为固定系统名；``other:<口令>@<用户名>`` 中口令可含 ``@``，与用户名以**最后一个** ``@`` 分隔。
- **增量**（相对当前口令文件；未出现的参数表示不改该侧）：仅 ``pass:非空`` 不传 ``other:`` → 只改主口令、附加行保留；仅 ``other:…@…`` 不传 ``pass:`` → 只改附加用户、主行保留；仅 ``other:``（冒号后空）→ 删光附加行；``pass:`` 空且带 ``other:…`` → 删主行并按 ``other`` 写入；``pass:`` 空且**无** ``other:`` → 删门闩与文件（关鉴权）。省略二者则不碰门闩。
- 自检：``python3 update_nginx_oj_confs.py --self-test``

"""

from __future__ import annotations

import argparse
import os
import re
import shlex
import shutil
import subprocess
import sys
import tempfile
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List, Optional, Tuple

SYNC_BEGIN = "# CSGOJ_OJ_NGINX_SYNC_BEGIN"
SYNC_END = "# CSGOJ_OJ_NGINX_SYNC_END"
LOC_SYNC_BEGIN = "# CSGOJ_OJ_LOC_SYNC_BEGIN"
LOC_SYNC_END = "# CSGOJ_OJ_LOC_SYNC_END"

# Basic 认证：用户名常量仅用于生成 htpasswd / 与反向代理一致，勿在用户可见文案中写出。
GATE_BASIC_REALM = "CSGOJ OJ"
GATE_BASIC_USER = "csgoj_gate"
AUTH_GATE_BEGIN = "# CSGOJ_OJ_GATE_BEGIN"
AUTH_GATE_END = "# CSGOJ_OJ_GATE_END"
DEFAULT_CONF_D = Path("/csgoj_data/nginx/nginx_conf.d")

RE_OTHER_GATE_USERNAME = re.compile(r"^[a-zA-Z0-9._-]+$")


@dataclass
class GateSpec:
    """CLI 解析后的门闩意图。``clear_all`` 时整单删除；否则在现有 htpasswd 上增量合并。"""

    clear_all: bool = False
    primary_remove: bool = False
    primary_set_to: Optional[str] = None
    other_clear_secondaries: bool = False
    other_set_password: Optional[str] = None
    other_set_username: Optional[str] = None

RE_AUTH_GATE_BLOCK = re.compile(
    r"[ \t]*" + re.escape(AUTH_GATE_BEGIN) + r".*?" + re.escape(AUTH_GATE_END) + r"\s*\n",
    re.DOTALL,
)

RE_SERVER_START = re.compile(r"(?m)^\s*server\s*\{")

# 固定仅为 nginx 语法标识，非业务配置；具体 root / 端口来自模板解析
RE_FPM_PASS_VAR = re.compile(r"fastcgi_pass\s+\$php_upstream\s*;")


def find_matching_brace(s: str, open_idx: int) -> int:
    depth = 0
    for j in range(open_idx, len(s)):
        c = s[j]
        if c == "{":
            depth += 1
        elif c == "}":
            depth -= 1
            if depth == 0:
                return j
    return -1


def extract_server_spans(content: str) -> List[Tuple[int, int, str]]:
    spans: List[Tuple[int, int, str]] = []
    for m in RE_SERVER_START.finditer(content):
        brace_open = m.end() - 1
        if brace_open < 0 or content[brace_open] != "{":
            continue
        close = find_matching_brace(content, brace_open)
        if close < 0:
            continue
        spans.append((m.start(), close + 1, content[m.start() : close + 1]))
    return spans


def split_top_level_locations(server_inner: str) -> List[str]:
    lines = server_inner.splitlines(keepends=True)
    result: List[str] = []
    buf: List[str] = []
    i = 0
    while i < len(lines):
        line = lines[i]
        if re.match(r"^\s*location\s+", line):
            if buf:
                result.append("".join(buf))
                buf = []
            loc_lines = [line]
            depth = line.count("{") - line.count("}")
            i += 1
            while i < len(lines) and depth > 0:
                loc_lines.append(lines[i])
                depth += lines[i].count("{") - lines[i].count("}")
                i += 1
            result.append("".join(loc_lines))
        else:
            buf.append(line)
            i += 1
    if buf:
        result.append("".join(buf))
    return result


@dataclass
class OjTemplateBundle:
    """从 deploy_files/nginx_conf 四文件加载的只读快照。"""

    templates_dir: Path
    nginx_base_text: str
    oj_http_text: str
    oj_ssl_single_text: str
    oj_ssl443_text: str
    canonical_root_line: str
    fpm_pass_host_re: re.Pattern[str]
    fcgi_send_timeout: str
    fcgi_read_timeout: str
    _comment_http: str
    _comment_ssl_single: str
    _comment_ssl443: str
    # 与 oj.http 模板 OJ server 对齐的标量指令（仅更新目标中已存在的同名指令，不删不改额外 location）
    align_scalars: Dict[str, str]
    # oj.http 模板 CSGOJ_OJ_LOC_SYNC 区内须随模板维护的顶层 location 块（有序）
    managed_location_blocks: List[str]

    @classmethod
    def load(cls, d: Path) -> "OjTemplateBundle":
        d = d.resolve()
        names = [
            "nginx_base.conf",
            "oj.http.conf.template",
            "oj.ssl.singleport.conf.template",
            "oj.ssl443.with80redir.conf.template",
        ]
        for n in names:
            if not (d / n).is_file():
                raise FileNotFoundError(f"缺少模板文件: {d / n}")

        nginx_base_text = (d / "nginx_base.conf").read_text(encoding="utf-8")
        oj_http_text = (d / "oj.http.conf.template").read_text(encoding="utf-8")
        oj_ssl_single_text = (d / "oj.ssl.singleport.conf.template").read_text(
            encoding="utf-8"
        )
        oj_ssl443_text = (d / "oj.ssl443.with80redir.conf.template").read_text(
            encoding="utf-8"
        )

        http_oj = cls._first_oj_server_block(oj_http_text, stage="oj.http.conf.template")
        ssl_sp_oj = cls._first_oj_server_block(
            oj_ssl_single_text, stage="oj.ssl.singleport.conf.template"
        )
        ssl443_oj = cls._first_oj_server_block_ssl443(oj_ssl443_text)

        mroot = re.search(r"^\s*(root\s+\S+;)", http_oj, re.MULTILINE)
        if not mroot:
            raise ValueError("oj.http.conf.template 的 OJ server 中无 root 指令")
        canonical_root_line = mroot.group(1).strip()

        mup = re.search(
            r"set\s+\$php_upstream\s+php-[a-zA-Z0-9_-]+:(\d+)\s*;",
            http_oj,
            re.MULTILINE,
        )
        if not mup:
            raise ValueError("oj.http.conf.template 中无 set $php_upstream php-…:port")
        fpm_port = mup.group(1)
        fpm_pass_host_re = re.compile(
            rf"fastcgi_pass\s+php-[a-zA-Z0-9_-]+:{re.escape(fpm_port)}\s*;"
        )

        t_http = cls._fcgi_timeouts_from_oj_server(http_oj)
        t_sp = cls._fcgi_timeouts_from_oj_server(ssl_sp_oj)
        t_443 = cls._fcgi_timeouts_from_oj_server(ssl443_oj)
        uniq = {t_http, t_sp, t_443}
        if len(uniq) != 1:
            raise ValueError(
                "各模板 OJ server 中 PHP location 的 fastcgi_send/read_timeout 不一致: "
                f"http={t_http}, ssl.singleport={t_sp}, ssl443={t_443}"
            )
        fcgi_send_timeout, fcgi_read_timeout = t_http

        c_http = cls._extract_sync_comment_inner(http_oj, "oj.http.conf.template")
        c_sp = cls._extract_sync_comment_inner(
            ssl_sp_oj, "oj.ssl.singleport.conf.template"
        )
        c_443 = cls._extract_sync_comment_inner(
            ssl443_oj, "oj.ssl443.with80redir.conf.template (OJ server)"
        )

        align_scalars = cls._extract_scalars_from_server_block(http_oj)
        managed_location_blocks = cls._extract_managed_location_blocks(http_oj)

        return cls(
            templates_dir=d,
            nginx_base_text=nginx_base_text,
            oj_http_text=oj_http_text,
            oj_ssl_single_text=oj_ssl_single_text,
            oj_ssl443_text=oj_ssl443_text,
            canonical_root_line=canonical_root_line,
            fpm_pass_host_re=fpm_pass_host_re,
            fcgi_send_timeout=fcgi_send_timeout,
            fcgi_read_timeout=fcgi_read_timeout,
            _comment_http=c_http,
            _comment_ssl_single=c_sp,
            _comment_ssl443=c_443,
            align_scalars=align_scalars,
            managed_location_blocks=managed_location_blocks,
        )

    @staticmethod
    def _extract_managed_location_blocks(server_block: str) -> List[str]:
        """解析模板 ``CSGOJ_OJ_LOC_SYNC`` 区内顶层 location 块（唯一登记入口）。"""
        m0 = RE_SERVER_START.search(server_block)
        if not m0:
            return []
        bopen = m0.end() - 1
        bclose = find_matching_brace(server_block, bopen)
        if bclose < 0:
            return []
        inner = server_block[m0.end() : bclose]
        pat = re.compile(
            re.escape(LOC_SYNC_BEGIN) + r"\n(.*?)\n\s*" + re.escape(LOC_SYNC_END),
            re.DOTALL,
        )
        m = pat.search(inner)
        if not m:
            return []
        region = m.group(1)
        blocks: List[str] = []
        for part in split_top_level_locations(region):
            line0 = part.splitlines()[0] if part.strip() else ""
            if re.match(r"^\s*location\s+", line0):
                blocks.append(part)
        return blocks

    @staticmethod
    def _extract_scalars_from_server_block(server_block: str) -> Dict[str, str]:
        out: Dict[str, str] = {}
        for key in ("client_body_timeout", "client_max_body_size", "keepalive_timeout"):
            m = re.search(rf"^\s*{key}\s+([^;]+);", server_block, re.MULTILINE)
            if m:
                out[key] = m.group(1).strip()
        return out

    @staticmethod
    def _server_blocks(full_text: str) -> List[str]:
        spans = extract_server_spans(full_text)
        return [b for _, _, b in spans]

    @classmethod
    def _first_oj_server_block(cls, text: str, stage: str) -> str:
        for blk in cls._server_blocks(text):
            if cls._raw_block_is_oj_template(blk):
                return blk
        raise ValueError(f"{stage} 中未找到含 root+php fastcgi 的 OJ server 块")

    @classmethod
    def _first_oj_server_block_ssl443(cls, text: str) -> str:
        """443 模板中第一个 server 为 80 跳转，OJ 在后续 server。"""
        for blk in cls._server_blocks(text):
            if cls._raw_block_is_oj_template(blk):
                return blk
        raise ValueError("oj.ssl443.with80redir.conf.template 中未找到 OJ server 块")

    @staticmethod
    def _raw_block_is_oj_template(block: str) -> bool:
        if not re.search(r"^\s*root\s+\S+;", block, re.MULTILINE):
            return False
        if not RE_FPM_PASS_VAR.search(block) and not re.search(
            r"fastcgi_pass\s+php-[a-zA-Z0-9_-]+:\d+\s*;", block
        ):
            return False
        return True

    @staticmethod
    def _fcgi_timeouts_from_oj_server(server_block: str) -> Tuple[str, str]:
        m0 = RE_SERVER_START.search(server_block)
        if not m0:
            raise ValueError("internal: empty server")
        bopen = m0.end() - 1
        bclose = find_matching_brace(server_block, bopen)
        if bclose < 0:
            raise ValueError("internal: unbalanced server")
        inner = server_block[m0.end() : bclose]
        parts = split_top_level_locations(inner)
        sends: List[str] = []
        reads: List[str] = []
        for part in parts:
            if not OjTemplateBundle._is_direct_php_fcgi_fragment(part):
                continue
            for ln in part.splitlines():
                sm = re.match(r"^\s*fastcgi_send_timeout\s+(\S+);", ln)
                if sm:
                    sends.append(sm.group(1))
                rm = re.match(r"^\s*fastcgi_read_timeout\s+(\S+);", ln)
                if rm:
                    reads.append(rm.group(1))
        if len(sends) != 2 or len(reads) != 2:
            raise ValueError(
                "OJ server 内应有两个 PHP location，各含 fastcgi_send/read_timeout"
            )
        if len(set(sends)) != 1 or len(set(reads)) != 1:
            raise ValueError("两个 PHP location 的 fastcgi 超时值须一致")
        return sends[0], reads[0]

    @staticmethod
    def _is_direct_php_fcgi_fragment(block: str) -> bool:
        line0 = block.splitlines()[0] if block.strip() else ""
        if not re.match(r"^\s*location\s+.+\.php", line0):
            return False
        if RE_FPM_PASS_VAR.search(block) or re.search(
            r"fastcgi_pass\s+php-[a-zA-Z0-9_-]+:\d+\s*;", block
        ):
            return True
        return False

    @staticmethod
    def _extract_sync_comment_inner(server_block: str, stage: str) -> str:
        """client_body_timeout 与 root 之间的 # 注释行（含换行）。"""
        m = re.search(
            r"^\s*client_body_timeout\s+[^;]+;\s*\n((?:[ \t]*#.*\n)+)\s*(root\s+\S+;)",
            server_block,
            re.MULTILINE,
        )
        if not m:
            raise ValueError(f"{stage}：无法在 client_body_timeout 与 root 之间解析注释区")
        return m.group(1)

    def matches_oj_php_server(self, block: str) -> bool:
        if not any(
            ln.strip() == self.canonical_root_line for ln in block.splitlines()
        ):
            return False
        if RE_FPM_PASS_VAR.search(block) or self.fpm_pass_host_re.search(block):
            return True
        return False

    def is_direct_php_fcgi_location(self, block: str) -> bool:
        line0 = block.splitlines()[0] if block.strip() else ""
        if not re.match(r"^\s*location\s+.+\.php", line0):
            return False
        if RE_FPM_PASS_VAR.search(block) or self.fpm_pass_host_re.search(block):
            return True
        return False

    @staticmethod
    def server_is_ssl(block: str) -> bool:
        if re.search(r"listen\s+[^;]*\bssl\b", block):
            return True
        if re.search(r"^\s*ssl_certificate\s+", block, re.MULTILINE):
            return True
        return False

    def sync_comment_block(self, prod_server_block: str) -> str:
        if not self.server_is_ssl(prod_server_block):
            inner = self._comment_http
        elif re.search(r"listen\s+443\s+ssl", prod_server_block):
            inner = self._comment_ssl443
        else:
            inner = self._comment_ssl_single
        return f"{SYNC_BEGIN}\n{inner}{SYNC_END}\n"


def refresh_or_inject_sync_comment(server_block: str, comment_block: str) -> str:
    m0 = RE_SERVER_START.search(server_block)
    if not m0:
        return server_block
    bopen = m0.end() - 1
    bclose = find_matching_brace(server_block, bopen)
    if bclose < 0:
        return server_block
    prefix = server_block[: m0.end()]
    inner = server_block[m0.end() : bclose]
    suffix = server_block[bclose:]

    pat = re.compile(
        re.escape(SYNC_BEGIN) + r"\n.*?" + re.escape(SYNC_END) + r"\n",
        re.DOTALL,
    )
    if pat.search(inner):
        inner_new = pat.sub(comment_block, inner, count=1)
    else:
        cb_pat = re.compile(r"^([ \t]*client_body_timeout\s+[^;]+;)(\s*\n)", re.MULTILINE)
        m = cb_pat.search(inner)
        if m:
            inner_new = (
                inner[: m.end(1)] + m.group(2) + comment_block + inner[m.end() :]
            )
        else:
            inner_new = inner

    return prefix + inner_new + suffix


def patch_fcgi_timeouts_in_location(
    block: str, send_val: str, read_val: str
) -> Tuple[str, bool]:
    changed = False
    lines = block.splitlines(keepends=True)
    new_lines: List[str] = []
    has_send = any(re.match(r"^\s*fastcgi_send_timeout\s+", ln) for ln in lines)
    has_read = any(re.match(r"^\s*fastcgi_read_timeout\s+", ln) for ln in lines)
    insert_after_idx: Optional[int] = None
    for idx, ln in enumerate(lines):
        if re.match(r"^\s*fastcgi_connect_timeout\s+", ln):
            insert_after_idx = idx

    for ln in lines:
        if re.match(r"^\s*fastcgi_send_timeout\s+", ln):
            nl = re.sub(
                r"^(\s*)fastcgi_send_timeout\s+[^;]+;",
                rf"\1fastcgi_send_timeout {send_val};",
                ln,
            )
            if nl != ln:
                changed = True
            new_lines.append(nl)
            continue
        if re.match(r"^\s*fastcgi_read_timeout\s+", ln):
            nl = re.sub(
                r"^(\s*)fastcgi_read_timeout\s+[^;]+;",
                rf"\1fastcgi_read_timeout {read_val};",
                ln,
            )
            if nl != ln:
                changed = True
            new_lines.append(nl)
            continue
        new_lines.append(ln)

    body = "".join(new_lines)
    if not has_send or not has_read:
        m_pass = re.search(r"^(\s*)fastcgi_pass\s+", body, re.MULTILINE)
        if m_pass:
            indent = m_pass.group(1)
            chunk = ""
            if not has_send:
                chunk += f"{indent}fastcgi_send_timeout {send_val};\n"
                changed = True
            if not has_read:
                chunk += f"{indent}fastcgi_read_timeout {read_val};\n"
                changed = True
            pos = m_pass.start()
            body = body[:pos] + chunk + body[pos:]
        elif insert_after_idx is not None:
            acc: List[str] = []
            for idx, ln in enumerate(lines):
                acc.append(ln)
                if idx == insert_after_idx:
                    ind_m = re.match(r"^(\s*)", ln)
                    ind = ind_m.group(1) if ind_m else "        "
                    if not has_send:
                        acc.append(f"{ind}fastcgi_send_timeout {send_val};\n")
                        changed = True
                    if not has_read:
                        acc.append(f"{ind}fastcgi_read_timeout {read_val};\n")
                        changed = True
            body = "".join(acc)
    return body, changed


def detect_upload_belong_to(server_inner: str) -> Optional[str]:
    """从既有 ``location /upload/`` 的 alias 解析实例目录名（如 acm、fusion）。"""
    m = re.search(
        r"^\s*location\s+/upload/\s*\{[^}]*alias\s+/var/www/public/([a-zA-Z0-9_-]+)/upload/",
        server_inner,
        re.MULTILINE | re.DOTALL,
    )
    return m.group(1) if m else None


def location_block_key(block: str) -> str:
    """顶层 location 首行（用于匹配替换，如 ``location ^~ /upload/outrank_attach/ {``）。"""
    for ln in block.splitlines():
        s = ln.strip()
        if s:
            return s
    return ""


def ensure_block_trailing_newline(block: str) -> str:
    """LOC_SYNC 块写入 server 时须以换行结尾，避免 ``}    location`` 粘在同一行。"""
    if not block:
        return block
    return block if block.endswith("\n") else block + "\n"


def assert_no_location_glued_to_closing_brace(text: str) -> bool:
    """``}`` 与下一 ``location`` 不得在同一物理行（nginx 合法但可读性差且易误判）。"""
    return re.search(r"\}[^\n\r]+location\s", text) is None


def adapt_managed_blocks_for_belong_to(blocks: List[str], belong_to: str) -> List[str]:
    """模板占位 ``/var/www/public/csgoj/`` → 目标实例目录。"""
    prefix_tpl = "/var/www/public/csgoj/"
    prefix_dst = f"/var/www/public/{belong_to}/"
    return [b.replace(prefix_tpl, prefix_dst) for b in blocks]


def normalize_location_blocks_separated(inner: str) -> Tuple[str, bool]:
    """修复 ``}    location`` 粘在同一物理行（历史 LOC_SYNC 写入缺换行）。"""
    fixed = re.sub(r"\}([ \t]+)location\s", r"}\n\1location ", inner)
    return fixed, fixed != inner


def refresh_managed_locations(
    server_inner: str, template_blocks: List[str], belong_to: str
) -> Tuple[str, bool]:
    """
    将模板 LOC_SYNC 区内 location 注入或覆盖到目标 server（整组置于 ``location /upload/`` 之前）。
    按 location 首行匹配：先删目标内同 key 块，再插入模板现行版本。
    """
    if not template_blocks:
        return server_inner, False
    want_blocks = adapt_managed_blocks_for_belong_to(template_blocks, belong_to)
    want_keys = {location_block_key(b) for b in want_blocks}
    parts = split_top_level_locations(server_inner)
    kept: List[str] = []
    for part in parts:
        line0 = part.splitlines()[0] if part.strip() else ""
        if re.match(r"^\s*location\s+", line0) and location_block_key(part) in want_keys:
            continue
        kept.append(part)

    rebuilt: List[str] = []
    inserted = False
    for part in kept:
        line0 = part.splitlines()[0] if part.strip() else ""
        if not inserted and re.match(r"^\s*location\s+/upload/\s*\{", line0):
            rebuilt.extend(ensure_block_trailing_newline(b) for b in want_blocks)
            inserted = True
        rebuilt.append(part)
    if not inserted:
        return server_inner, False

    new_inner = "".join(rebuilt)
    return new_inner, new_inner != server_inner


def patch_oj_inner_scalars(inner: str, align: Dict[str, str]) -> Tuple[str, bool]:
    """仅替换目标 server 内已存在的指令取值，不新增行（避免覆盖机房自定义块）。"""
    changed = False
    out = inner
    for key, want in align.items():
        pat = re.compile(
            rf"^(\s*{re.escape(key)}\s+)([^;]+)(;)",
            re.MULTILINE,
        )

        def _sub(m: re.Match[str]) -> str:
            nonlocal changed
            cur = m.group(2).strip()
            if cur != want:
                changed = True
                return f"{m.group(1)}{want}{m.group(3)}"
            return m.group(0)

        out = pat.sub(_sub, out, count=1)
    return out, changed


def process_server_block(block: str, bundle: OjTemplateBundle) -> Tuple[str, List[str]]:
    msgs: List[str] = []
    if not bundle.matches_oj_php_server(block):
        return block, msgs
    original_block = block
    send_v, read_v = bundle.fcgi_send_timeout, bundle.fcgi_read_timeout
    comment_block = bundle.sync_comment_block(block)
    block_after_comment = refresh_or_inject_sync_comment(block, comment_block)
    m1 = RE_SERVER_START.search(block_after_comment)
    if not m1:
        return block, msgs
    bopen = m1.end() - 1
    bclose = find_matching_brace(block_after_comment, bopen)
    if bclose < 0:
        return block_after_comment, msgs
    head = block_after_comment[: m1.end()]
    inner_only = block_after_comment[m1.end() : bclose]
    tail = block_after_comment[bclose:]

    new_parts: List[str] = []
    fcgi_changed = False
    for part in split_top_level_locations(inner_only):
        if bundle.is_direct_php_fcgi_location(part):
            patched, ch = patch_fcgi_timeouts_in_location(part, send_v, read_v)
            new_parts.append(patched)
            if ch:
                fcgi_changed = True
        else:
            new_parts.append(part)
    inner_new = "".join(new_parts)
    inner_new, sc_changed = patch_oj_inner_scalars(inner_new, bundle.align_scalars)
    inner_new, glue_fixed = normalize_location_blocks_separated(inner_new)
    if glue_fixed:
        msgs.append("fixed glued '} location' line break")
    belong_to = detect_upload_belong_to(inner_new)
    if belong_to and bundle.managed_location_blocks:
        inner_new, loc_sync_changed = refresh_managed_locations(
            inner_new, bundle.managed_location_blocks, belong_to
        )
        if loc_sync_changed:
            keys = ", ".join(location_block_key(b) for b in bundle.managed_location_blocks)
            msgs.append(f"synced CSGOJ_OJ_LOC_SYNC location(s): {keys}")
    new_block = head + inner_new + tail
    if fcgi_changed:
        msgs.append("patched fastcgi_send/read_timeout in OJ php location(s)")
    if sc_changed:
        msgs.append(
            "aligned client_body_timeout / client_max_body_size / keepalive_timeout"
        )
    if new_block != original_block:
        msgs.append("updated OJ server block")
    return new_block, msgs


def _strip_auth_gate_block(server_block: str) -> str:
    return RE_AUTH_GATE_BLOCK.sub("", server_block)


def _gate_snippet(auth_basic_user_file_posix: str) -> str:
    # 不可用 try_files → @rewrite：@rewrite / index.php 会重新匹配 location ~ \.php$，继承 server 级
    # auth_basic，评测机仍 401。此处与 ThinkPHP 的 rewrite ^/(.*)$ /index.php?s=/$1 等效并直送 FastCGI。
    return (
        f"    {AUTH_GATE_BEGIN}\n"
        f'    auth_basic "{GATE_BASIC_REALM}";\n'
        f"    auth_basic_user_file {auth_basic_user_file_posix};\n"
        "    location ^~ /ojtool/judge2/ {\n"
        "        auth_basic off;\n"
        "        fastcgi_connect_timeout 2s;\n"
        "        fastcgi_send_timeout 3600s;\n"
        "        fastcgi_read_timeout 3600s;\n"
        "        fastcgi_pass $php_upstream;\n"
        "        include fastcgi_params;\n"
        "        fastcgi_param SCRIPT_FILENAME $document_root/index.php;\n"
        "        fastcgi_param SCRIPT_NAME /index.php;\n"
        "        set $j2_qs s=$uri;\n"
        '        if ($query_string != "") {\n'
        "            set $j2_qs s=$uri&$query_string;\n"
        "        }\n"
        "        fastcgi_param QUERY_STRING $j2_qs;\n"
        "    }\n"
        f"    {AUTH_GATE_END}\n"
    )


def _inject_auth_gate_after_server_name(server_block: str, pass_file_abs: str) -> str:
    m0 = RE_SERVER_START.search(server_block)
    if not m0:
        return server_block
    bopen = m0.end() - 1
    bclose = find_matching_brace(server_block, bopen)
    if bclose < 0:
        return server_block
    head = server_block[: m0.end()]
    inner = server_block[m0.end() : bclose]
    tail = server_block[bclose:]
    msn = re.search(r"^(\s*server_name\s+[^;]+;\s*\n)", inner, re.MULTILINE)
    if not msn:
        return server_block
    ins = _gate_snippet(pass_file_abs)
    new_inner = inner[: msn.end()] + ins + inner[msn.end() :]
    return head + new_inner + tail


def _apr1_htpasswd_line(user: str, password: str) -> str:
    p = subprocess.run(
        ["openssl", "passwd", "-apr1", "-stdin"],
        input=(password + "\n").encode("utf-8"),
        capture_output=True,
        check=True,
    )
    h = p.stdout.decode("utf-8").strip()
    if not h:
        raise RuntimeError("openssl passwd 未返回哈希")
    return f"{user}:{h}\n"


def _apr1_hash_for_user(user: str, password: str) -> str:
    """返回 ``user`` 在 htpasswd 行中的哈希段（不含用户名与冒号）。"""
    line = _apr1_htpasswd_line(user, password).rstrip("\n")
    return line.split(":", 1)[1]


def _load_htpasswd_user_hashes(path: Path) -> Dict[str, str]:
    """读取 htpasswd：用户名 → 哈希串（不含 ``user:`` 前缀）。"""
    if not path.is_file():
        return {}
    m: Dict[str, str] = {}
    for raw_ln in path.read_text(encoding="utf-8").splitlines():
        ln = raw_ln.strip()
        if not ln or ln.startswith("#"):
            continue
        if ":" not in ln:
            continue
        u, h = ln.split(":", 1)
        u, h = u.strip(), h.strip()
        if u and h:
            m[u] = h
    return m


def _format_htpasswd_user_hashes(user_hash: Dict[str, str]) -> str:
    """主账号行在前，其余用户名按字典序，便于稳定 diff。"""
    parts: List[str] = []
    if GATE_BASIC_USER in user_hash:
        parts.append(f"{GATE_BASIC_USER}:{user_hash[GATE_BASIC_USER]}\n")
    for u in sorted(k for k in user_hash if k != GATE_BASIC_USER):
        parts.append(f"{u}:{user_hash[u]}\n")
    return "".join(parts)


def _merge_gate_htpasswd(base: Dict[str, str], gate: GateSpec) -> Dict[str, str]:
    """在 ``base`` 上应用 ``gate``（非 ``clear_all``）。"""
    if gate.clear_all:
        return {}
    out = dict(base)
    if gate.other_clear_secondaries:
        out = {u: h for u, h in out.items() if u == GATE_BASIC_USER}
    if gate.primary_remove:
        out.pop(GATE_BASIC_USER, None)
    if gate.primary_set_to is not None:
        out[GATE_BASIC_USER] = _apr1_hash_for_user(GATE_BASIC_USER, gate.primary_set_to)
    if gate.other_set_username and gate.other_set_password is not None:
        out[gate.other_set_username] = _apr1_hash_for_user(
            gate.other_set_username, gate.other_set_password
        )
    return out


def attach_pass_file_path(logical_conf_path: Path) -> Path:
    """宿主机/数据卷侧路径：``<nginx>/nginx_conf.d/x.conf`` → ``<nginx>/attach/x-pass``。"""
    base = logical_conf_path.resolve().parent.parent / "attach"
    return base / f"{logical_conf_path.stem}-pass"


def nginx_container_auth_passfile_posix(logical_conf_path: Path) -> str:
    """容器内挂载约定：``auth_basic_user_file`` 一律为 ``/etc/nginx/attach/<主名>-pass``。"""
    return f"/etc/nginx/attach/{logical_conf_path.stem}-pass"


def apply_auth_gate_to_oj_server(
    block: str,
    bundle: OjTemplateBundle,
    logical_conf_path: Path,
    gate: Optional[GateSpec],
    dry_run: bool,
    htpasswd_write_path: Optional[Path] = None,
    htpasswd_merge_base: Optional[Dict[str, str]] = None,
) -> Tuple[str, List[str], bool]:
    """gate: ``None``=不改；``clear_all``=删门闩与文件；否则基于现有 htpasswd 合并后写回。

    ``htpasswd_merge_base``：非 ``None`` 时作为合并基线（SSH 预下载）；``None`` 时读 ``attach/…-pass`` 若存在。
    ``htpasswd_write_path``：SSH 时指向本地暂存文件；与 ``clear_all`` 或合并结果为空时的删除逻辑配合。
    """
    msgs: List[str] = []
    if gate is None:
        return block, msgs, False
    if not bundle.matches_oj_php_server(block):
        return block, msgs, False
    changed = False
    pfile_logical = attach_pass_file_path(logical_conf_path)
    pfile_write = htpasswd_write_path if htpasswd_write_path is not None else pfile_logical

    def _unlink_passfile() -> None:
        if dry_run:
            return
        if htpasswd_write_path is None and pfile_logical.is_file():
            try:
                pfile_logical.unlink()
                msgs.append(f"removed {pfile_logical}")
            except OSError as e:
                msgs.append(f"warn: could not remove {pfile_logical}: {e}")
        elif htpasswd_write_path is not None and htpasswd_write_path.is_file():
            try:
                htpasswd_write_path.unlink()
                msgs.append(f"removed staging htpasswd {htpasswd_write_path}")
            except OSError as e:
                msgs.append(f"warn: could not remove staging htpasswd: {e}")

    if gate.clear_all:
        nb = _strip_auth_gate_block(block)
        if nb != block:
            changed = True
            msgs.append("removed CSGOJ_OJ_GATE auth block")
        _unlink_passfile()
        return nb, msgs, changed

    base = htpasswd_merge_base
    if base is None:
        base = _load_htpasswd_user_hashes(pfile_logical)
    merged = _merge_gate_htpasswd(base, gate)
    if not merged:
        nb = _strip_auth_gate_block(block)
        if nb != block:
            changed = True
            msgs.append("removed CSGOJ_OJ_GATE auth block (no htpasswd entries)")
        _unlink_passfile()
        return nb, msgs, changed

    stripped = _strip_auth_gate_block(block)
    nb2 = _inject_auth_gate_after_server_name(
        stripped, nginx_container_auth_passfile_posix(logical_conf_path)
    )
    if nb2 != block:
        changed = True
        msgs.append("injected CSGOJ_OJ_GATE auth block")
    elif AUTH_GATE_BEGIN in block:
        msgs.append("CSGOJ_OJ_GATE block already present (htpasswd refreshed)")
    if not dry_run:
        pfile_write.parent.mkdir(parents=True, exist_ok=True)
        body = _format_htpasswd_user_hashes(merged)
        pfile_write.write_text(body, encoding="utf-8")
        msg_tail = f"{pfile_write}"
        if len(merged) > 1:
            msg_tail += " (multi-user htpasswd)"
        msgs.append(f"wrote htpasswd -> {msg_tail}")
    return nb2, msgs, changed


def _process_conf_file_rebuild(
    raw: str,
    spans: List[Tuple[int, int, str]],
    bundle: OjTemplateBundle,
    path: Path,
    dry_run: bool,
    logical_conf_path: Path,
    gate: Optional[GateSpec],
    htpasswd_write_path: Optional[Path] = None,
    htpasswd_merge_base: Optional[Dict[str, str]] = None,
) -> Tuple[bool, List[str]]:
    messages: List[str] = []
    pieces: List[str] = []
    last = 0
    changed = False
    for start, end, block in spans:
        pieces.append(raw[last:start])
        nb, msgs = process_server_block(block, bundle)
        nb2, gmsgs, gch = apply_auth_gate_to_oj_server(
            nb,
            bundle,
            logical_conf_path,
            gate,
            dry_run,
            htpasswd_write_path=htpasswd_write_path,
            htpasswd_merge_base=htpasswd_merge_base,
        )
        if nb != block:
            changed = True
            for m in msgs:
                messages.append(f"{path.name}: {m}")
        if gch or nb2 != nb:
            changed = True
            for m in gmsgs:
                messages.append(f"{path.name}: {m}")
        pieces.append(nb2)
        last = end
    pieces.append(raw[last:])
    new_raw = "".join(pieces)
    if changed and not dry_run:
        path.write_text(new_raw, encoding="utf-8")
    return changed, messages


def _process_conf_file_rebuild_no_gate(
    raw: str,
    spans: List[Tuple[int, int, str]],
    bundle: OjTemplateBundle,
    path: Path,
    dry_run: bool,
) -> Tuple[bool, List[str]]:
    return _process_conf_file_rebuild(
        raw, spans, bundle, path, dry_run, logical_conf_path=path, gate=None
    )


def default_templates_dir(script_path: Path) -> Path:
    env = os.environ.get("CSGOJ_REPO_ROOT")
    if env:
        p = Path(env) / "deploy_files" / "nginx_conf"
        if p.is_dir():
            return p
    d = script_path.resolve().parent
    if d.name == "nginx_conf" and (d / "oj.http.conf.template").exists():
        return d
    raise SystemExit("无法定位模板目录，请传 --templates-dir 或设置 CSGOJ_REPO_ROOT")


def sync_nginx_base(
    bundle: OjTemplateBundle, conf_dir: Path, dry_run: bool
) -> Tuple[bool, str]:
    """将模板 nginx_base.conf 写入 conf_dir/00-nginx-base.conf。"""
    target = conf_dir / "00-nginx-base.conf"
    new = bundle.nginx_base_text
    if target.exists() and target.read_text(encoding="utf-8") == new:
        return False, str(target)
    if not dry_run:
        target.write_text(new, encoding="utf-8")
    return True, str(target)


def run_self_test(bundle: OjTemplateBundle) -> int:
    repo = bundle.templates_dir.parent.parent
    sample = repo / "tests" / "nginx_conf_test"
    if not sample.is_dir():
        print(f"self-test: 缺少目录 {sample}", file=sys.stderr)
        return 1
    scratch = Path(tempfile.mkdtemp(prefix="csgoj_nginx_selftest_"))
    try:
        for f in sample.glob("*.conf"):
            shutil.copy2(f, scratch / f.name)
        for f in sorted(scratch.glob("*.conf")):
            raw = f.read_text(encoding="utf-8")
            spans = extract_server_spans(raw)
            _process_conf_file_rebuild_no_gate(raw, spans, bundle, f, dry_run=False)

        fe = (scratch / "oj-fusion-exam.conf").read_text(encoding="utf-8")
        if "fastcgi_read_timeout 3600s" not in fe or "fastcgi_send_timeout 3600s" not in fe:
            print("self-test: oj-fusion-exam.conf 未对齐模板超时", file=sys.stderr)
            return 1
        if SYNC_BEGIN not in fe:
            print("self-test: oj-fusion-exam.conf 缺少 SYNC 注释区", file=sys.stderr)
            return 1
        if not assert_no_location_glued_to_closing_brace(fe):
            print("self-test: oj-fusion-exam.conf 出现 } 与 location 同一行", file=sys.stderr)
            return 1

        u = (scratch / "udisys.conf").read_text(encoding="utf-8")
        if "fastcgi_" in u:
            print("self-test: udisys.conf 不应含 fastcgi_", file=sys.stderr)
            return 1

        d0 = (scratch / "00-default.conf").read_text(encoding="utf-8")
        if d0 != (sample / "00-default.conf").read_text(encoding="utf-8"):
            print("self-test: 00-default.conf 应未被改写", file=sys.stderr)
            return 1

        for f in sorted(scratch.glob("*.conf")):
            raw = f.read_text(encoding="utf-8")
            spans = extract_server_spans(raw)
            ch, _ = _process_conf_file_rebuild_no_gate(raw, spans, bundle, f, dry_run=False)
            if ch:
                print(f"self-test: 幂等失败 {f.name}", file=sys.stderr)
                return 1
    finally:
        shutil.rmtree(scratch, ignore_errors=True)
    print("self-test: OK")
    return 0


CLI_EPILOG = """
常用示例 Examples
────────────────
  %(prog)s oj-http.conf -p mySecret           # 只改主账号口令 · set primary password
  %(prog)s oj-http.conf deploy@host -p 'x y' # 远端同上 · SSH
  %(prog)s oj-http.conf --clear-auth         # 关鉴权 · remove Basic gate entirely
  %(prog)s oj-http.conf --clear-pass --extra 'pwd@vip'   # 去掉主账号，只留附加 vip 用户
  %(prog)s oj-http.conf --clear-extra        # 删掉所有附加用户行 · drop extra users only

自检：%(prog)s --self-test

说明：未写某类门闩选项则不改该侧（按当前 attach 下 htpasswd 合并）。
主账号为系统固定名；--extra 格式为 口令@用户名（口令可含 @，以最后一个 @ 与用户名分界）。
完整选项见上方 --help 列表。
"""


def _classify_change_detail(detail: str) -> Optional[str]:
    """将内部英文说明转为报告用中文要点；返回 None 表示可省略（与其它要点重复）。"""
    d = detail.strip()
    if "patched fastcgi_send/read_timeout" in d:
        return "FastCGI send/read 超时已与模板对齐（3600s）"
    if "aligned client_body_timeout" in d:
        return "client_body_timeout / client_max_body_size / keepalive_timeout 已与模板对齐"
    if "removed CSGOJ_OJ_GATE auth block" in d:
        if "no htpasswd entries" in d:
            return "已移除 CSGOJ_OJ_GATE（无有效口令条目）"
        return "已移除 CSGOJ_OJ_GATE（Basic 门闩及 judge2 放行块）"
    if "injected CSGOJ_OJ_GATE auth block" in d:
        return "已注入 CSGOJ_OJ_GATE（Basic + /ojtool/judge2 免认证）"
    if "CSGOJ_OJ_GATE block already present" in d:
        return "门闩块已存在，已刷新 htpasswd"
    if d.startswith("wrote htpasswd ->"):
        tail = d.split("->", 1)[-1].strip()
        if "multi-user htpasswd" in tail:
            return f"已写入/更新 htpasswd（多用户）: {tail.replace('(multi-user htpasswd)', '').strip()}"
        return f"已写入/更新 htpasswd: {tail}"
    if d.startswith("removed ") and "warn" not in d:
        return f"已删除口令文件: {d.replace('removed ', '', 1).strip()}"
    if "warn: could not remove" in d:
        return f"⚠ 删除口令文件时警告: {d}"
    if d == "updated OJ server block":
        return None
    return d


def _group_messages_by_file(msgs: List[str]) -> Dict[str, List[str]]:
    out: Dict[str, List[str]] = {}
    for line in msgs:
        if ": " in line:
            fn, rest = line.split(": ", 1)
            out.setdefault(fn, []).append(rest)
        else:
            out.setdefault("", []).append(line)
    return out


def render_change_report(
    logical_conf: Path,
    ssh_spec: Optional[str],
    dry_run: bool,
    gate_spec: Optional[GateSpec],
    msgs: List[str],
    conf_changed: bool,
    deploy_notes: List[str],
) -> str:
    """生成 UTF-8 终端友好的多行报告（不依赖第三方库）。"""
    w = 56
    bar = "─" * w
    lines: List[str] = []
    lines.append(bar)
    lines.append("  CSGOJ · Nginx OJ conf 更新报告")
    lines.append(bar)
    if dry_run:
        lines.append("  ⚠ Dry-run：以下为预览，未实际写入/上传")
        lines.append(bar)

    lines.append(f"  目标: {logical_conf.as_posix()}")
    if ssh_spec:
        lines.append(f"  方式: SSH  {ssh_spec}")
    else:
        lines.append("  方式: 本地文件")
    if gate_spec is None:
        lines.append("  门闩: 未指定（不修改 Basic 相关配置）")
    elif gate_spec.clear_all:
        lines.append("  门闩: 已请求清除（删除门闩块与口令文件）")
    else:
        hints: List[str] = []
        if gate_spec.primary_set_to is not None:
            hints.append("更新主账号口令")
        if gate_spec.primary_remove:
            hints.append("移除主账号行")
        if gate_spec.other_clear_secondaries:
            hints.append("移除附加账号行")
        if gate_spec.other_set_username:
            hints.append(f"设置附加账号 {gate_spec.other_set_username}")
        if hints:
            lines.append(
                "  门闩: 已请求增量更新（"
                + "，".join(hints)
                + "；具体口令不写进报告）"
            )
        else:
            lines.append("  门闩: 已请求更新（口令不写进报告）")

    lines.append(bar)
    lines.append("  变更摘要")
    grouped = _group_messages_by_file(msgs)
    any_bullet = False
    for fname in sorted(grouped.keys(), key=lambda x: (x == "", x)):
        details = grouped[fname]
        bullets: List[str] = []
        seen: set[str] = set()
        for det in details:
            b = _classify_change_detail(det)
            if b and b not in seen:
                seen.add(b)
                bullets.append(b)
        if fname and bullets:
            any_bullet = True
            lines.append(f"    [{fname}]")
            for b in bullets:
                lines.append(f"      · {b}")
        elif not fname and details:
            any_bullet = True
            lines.append("    [其它]")
            for det in details:
                lines.append(f"      · {det}")
    if not any_bullet and not deploy_notes:
        if conf_changed or (gate_spec is not None):
            lines.append("      （无逐条说明，或仅为幂等重复写入）")
        else:
            lines.append("      （无：未发现 OJ server 块或无需改动）")
    for note in deploy_notes:
        lines.append(f"      · {note}")
    lines.append(bar)
    lines.append("  后续")
    if dry_run:
        lines.append("      去掉 --dry-run 后重跑以应用；然后 nginx -t && nginx -s reload")
    elif ssh_spec:
        lines.append("      请在目标机执行: nginx -t && nginx -s reload")
    else:
        lines.append("      请执行: nginx -t && nginx -s reload（或容器等价命令）")
    lines.append(bar)
    return "\n".join(lines) + "\n"


def resolve_target_conf_path(arg: str) -> Path:
    if arg.startswith("/") or arg.startswith("./") or arg.startswith("../"):
        return Path(arg)
    if "/" in arg or "\\" in arg:
        return Path(arg)
    return DEFAULT_CONF_D / arg


def parse_other_gate_payload(payload: str) -> Tuple[str, str]:
    """``口令@用户名`` → (口令, 用户名)；口令内可含 ``@``，与用户名的分界为最后一个 ``@``（与 ``--extra`` 相同）。"""
    payload = payload.strip()
    if "@" not in payload:
        raise ValueError(
            "--extra 须为 口令@用户名（口令可含 @，以最后一个 @ 与用户名分隔）"
        )
    password, username = payload.rsplit("@", 1)
    username = username.strip()
    if not username:
        raise ValueError("--extra 用户名不能为空（口令@用户名 格式的 @ 右侧）")
    if not RE_OTHER_GATE_USERNAME.match(username):
        raise ValueError(
            "other 用户名仅允许字母、数字、._- "
            "(与 htpasswd/nginx 惯例一致)，当前: {!r}".format(username)
        )
    if username == GATE_BASIC_USER:
        raise ValueError(f"附加账号不要使用主门闩系统名 “{GATE_BASIC_USER}”，请换一个用户名")
    if not password:
        raise ValueError("附加账号口令不能为空（--extra）")
    return password, username


class _StorePass(argparse.Action):
    def __call__(self, parser, namespace, values, option_string=None):
        setattr(namespace, self.dest + "_given", True)
        setattr(namespace, self.dest, values[0])

    def __init__(self, option_strings, dest, nargs=None, **kwargs):
        kwargs["nargs"] = 1
        super().__init__(option_strings, dest, **kwargs)


class _StoreExtra(argparse.Action):
    def __call__(self, parser, namespace, values, option_string=None):
        setattr(namespace, self.dest + "_given", True)
        setattr(namespace, self.dest, values[0])

    def __init__(self, option_strings, dest, nargs=None, **kwargs):
        kwargs["nargs"] = 1
        super().__init__(option_strings, dest, **kwargs)


def build_arg_parser() -> argparse.ArgumentParser:
    prog_name = Path(sys.argv[0]).name if sys.argv else "update_nginx_oj_confs.py"
    p = argparse.ArgumentParser(
        prog=prog_name,
        description=(
            "将 CSGOJ OJ nginx conf.d 中与仓库模板对齐，并可选维护 Basic（htpasswd）门闩。"
            " 常用仅需 -p/--pass。"
        ),
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=CLI_EPILOG.strip(),
        add_help=True,
        allow_abbrev=False,
    )
    p.add_argument(
        "--self-test",
        action="store_true",
        help="用仓库内 nginx 样例仅跑模板对齐自检（不写生产路径）",
    )
    p.add_argument(
        "conf",
        nargs="?",
        default=None,
        metavar="CONF",
        help="nginx 业务 conf 路径；仅文件名时默认 /csgoj_data/nginx/nginx_conf.d/<名>",
    )
    p.add_argument(
        "ssh_target",
        nargs="?",
        default=None,
        metavar="SSH",
        help="可选，远端：user@host 或 user@host:SSH端口（字符串内须含 @）",
    )

    gw = p.add_argument_group(
        "门闩 htpasswd · gate",
        (
            "未列出的分支一律「不改」。主账号口令用 -p；附加用户少用时用 --extra / --clear-extra。"
            " 文件路径：<nginx>/attach/<conf stem>-pass，对应容器 /etc/nginx/attach/。"
        ),
    )
    gw.add_argument(
        "-p",
        "--pass",
        dest="gate_pass",
        action=_StorePass,
        metavar="PASSWORD",
        help="设置主账号（预留系统用户名）明文口令",
    )
    gw.add_argument(
        "--clear-pass",
        action="store_true",
        help="从 htpasswd 删除主账号行（可与 --extra 合用：只保留附加用户方案）",
    )
    gw.add_argument(
        "--clear-auth",
        action="store_true",
        help="关掉整页 Basic：删 CSGOJ_OJ_GATE 块并删口令文件",
    )
    gw.add_argument(
        "--clear-extra",
        action="store_true",
        help="删除所有附加 Basic 用户名行（主账号不变）",
    )
    gw.add_argument(
        "--extra",
        dest="gate_extra",
        action=_StoreExtra,
        metavar="PASSWORD@USERNAME",
        help="设置或覆盖一个附加 Basic 用户；口令中可含 @，以最后一个 @ 为与用户名分界",
    )

    p.add_argument(
        "--templates-dir",
        metavar="DIR",
        help="模板目录（默认同脚本旁 deploy_files/nginx_conf 或 CSGOJ_REPO_ROOT）",
    )
    p.add_argument(
        "--dry-run",
        action="store_true",
        help="只预览报告，不写 conf / attach / 不上传",
    )
    p.add_argument(
        "--restart",
        action="store_true",
        help="非 dry-run 时在目标机 docker restart nginx-server",
    )
    return p


def gate_spec_from_argparse(
    ns: argparse.Namespace, parser: argparse.ArgumentParser
) -> Optional[GateSpec]:
    """将 argparse 结果转为 ``GateSpec``；``None`` 表示不碰门闩。"""
    if ns.clear_auth:
        conflict = [
            getattr(ns, "gate_pass_given", False),
            ns.clear_pass,
            ns.clear_extra,
            getattr(ns, "gate_extra_given", False),
        ]
        if any(conflict):
            parser.error("--clear-auth 不可与 --pass / --clear-pass / --extra / --clear-extra 同时使用")
        return GateSpec(clear_all=True)

    gp_g = getattr(ns, "gate_pass_given", False)
    ex_g = getattr(ns, "gate_extra_given", False)

    if gp_g and ns.clear_pass:
        parser.error("--pass/-p 与 --clear-pass 不可同时使用")
    if gp_g and not (ns.gate_pass or "").strip():
        parser.error("-p/--pass 不能为空；删主账号请用 --clear-auth 或 --clear-pass")

    pass_provided = gp_g or ns.clear_pass
    other_provided = ns.clear_extra or ex_g

    if not pass_provided and not other_provided:
        return None

    g = GateSpec(clear_all=False)
    if gp_g:
        g.primary_set_to = (ns.gate_pass or "").strip()
    elif ns.clear_pass:
        g.primary_remove = True

    if ns.clear_extra:
        g.other_clear_secondaries = True
    if ex_g:
        body = (ns.gate_extra or "").strip()
        if not body:
            parser.error("--extra 参数不能为空；若只需删附加用户请用 --clear-extra")
        try:
            op, ou = parse_other_gate_payload(body)
        except ValueError as e:
            parser.error(str(e))
        g.other_set_password = op
        g.other_set_username = ou
    return g


def parse_ssh_target(spec: str) -> Tuple[str, str, int]:
    if "@" not in spec:
        raise ValueError("SSH 目标格式应为 user@host 或 user@host:端口")
    if re.search(r":\d+$", spec):
        left, ps = spec.rsplit(":", 1)
        if ps.isdigit():
            user_host, port_s = left, ps
            port = int(port_s)
        else:
            user_host, port_s = spec, "22"
            port = 22
    else:
        user_host, port = spec, 22
    user, host = user_host.split("@", 1)
    return user.strip(), host.strip(), port


def _ssh_base(user: str, host: str, port: int) -> List[str]:
    return [
        "ssh",
        "-p",
        str(port),
        "-o",
        "StrictHostKeyChecking=no",
        f"{user}@{host}",
    ]


def scp_download(user: str, host: str, port: int, remote: str, local: Path) -> None:
    subprocess.run(
        [
            "scp",
            "-P",
            str(port),
            "-o",
            "StrictHostKeyChecking=no",
            f"{user}@{host}:{remote}",
            str(local),
        ],
        check=True,
    )


# scp 在远端路径不存在时的典型输出（libc 文案随 locale 可能为英文或中文）
_SCP_REMOTE_MISSING_MARKERS = (
    "No such file or directory",
    "没有那个文件或目录",
)


def scp_download_htpasswd_merge_base(
    user: str, host: str, port: int, remote: str, local: Path
) -> Dict[str, str]:
    """下载远端 htpasswd 作为合并基线。远端尚无该文件时为正常情况，返回空映射且不刷屏式报错。"""
    local.unlink(missing_ok=True)
    r = subprocess.run(
        [
            "scp",
            "-P",
            str(port),
            "-o",
            "StrictHostKeyChecking=no",
            f"{user}@{host}:{remote}",
            str(local),
        ],
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
    )
    combined = (r.stdout or "") + (r.stderr or "")
    if r.returncode == 0:
        if not local.is_file():
            return {}
        return _load_htpasswd_user_hashes(local)
    local.unlink(missing_ok=True)
    if any(m in combined for m in _SCP_REMOTE_MISSING_MARKERS):
        stem = Path(remote).name
        print(
            f"[远端] 未发现既有口令文件「{stem}」。"
            "将按本次参数生成并上传；无历史 htpasswd 条目参与合并。",
            flush=True,
        )
        return {}
    raise RuntimeError(
        "拉取远端 htpasswd 失败（非「远端无此文件」）。"
        + _summarize_cmd_result(r, max_len=400)
    )


def scp_upload(user: str, host: str, port: int, local: Path, remote: str) -> None:
    subprocess.run(
        [
            "scp",
            "-P",
            str(port),
            "-o",
            "StrictHostKeyChecking=no",
            str(local),
            f"{user}@{host}:{remote}",
        ],
        check=True,
    )


def ssh_run(user: str, host: str, port: int, remote_cmd: str) -> None:
    subprocess.run(_ssh_base(user, host, port) + [remote_cmd], check=True)


def ssh_run_capture(
    user: str, host: str, port: int, remote_cmd: str
) -> subprocess.CompletedProcess:
    return subprocess.run(
        _ssh_base(user, host, port) + [remote_cmd],
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
    )


def _summarize_cmd_result(r: subprocess.CompletedProcess, max_len: int = 160) -> str:
    parts = [f"exit={r.returncode}"]
    o = (r.stdout or "").strip()
    e = (r.stderr or "").strip()
    if o:
        parts.append("stdout=" + (o if len(o) <= max_len else o[: max_len - 3] + "…"))
    if e:
        parts.append("stderr=" + (e if len(e) <= max_len else e[: max_len - 3] + "…"))
    return ", ".join(parts)


def docker_restart_nginx_server_ssh(user: str, host: str, port: int) -> str:
    """执行远端 docker restart，打印明确状态行，返回摘要供写入报告。"""
    print("[远端] 正在执行: docker restart nginx-server", flush=True)
    r = ssh_run_capture(user, host, port, "docker restart nginx-server")
    summary = _summarize_cmd_result(r)
    print(f"[远端] docker restart 结果: {summary}", flush=True)
    if r.returncode != 0:
        raise subprocess.CalledProcessError(
            r.returncode,
            "ssh docker restart nginx-server",
            r.stdout,
            r.stderr,
        )
    return summary


def docker_restart_nginx_server_local() -> str:
    print("[本地] 正在执行: docker restart nginx-server", flush=True)
    r = subprocess.run(
        ["docker", "restart", "nginx-server"],
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
    )
    summary = _summarize_cmd_result(r)
    print(f"[本地] docker restart 结果: {summary}", flush=True)
    if r.returncode != 0:
        raise subprocess.CalledProcessError(
            r.returncode,
            "docker restart nginx-server",
            r.stdout,
            r.stderr,
        )
    return summary


def run_update_for_target(
    logical_conf: Path,
    ssh_spec: Optional[str],
    gate_spec: Optional[GateSpec],
    templates_dir: Path,
    dry_run: bool,
    do_restart: bool,
) -> int:
    try:
        bundle = OjTemplateBundle.load(templates_dir)
    except (OSError, ValueError) as e:
        print(f"模板加载失败: {e}", file=sys.stderr)
        return 2

    logical_conf = logical_conf.resolve()
    remote_conf = logical_conf.as_posix()
    remote_pass = attach_pass_file_path(logical_conf).as_posix()

    if ssh_spec:
        user, host, port = parse_ssh_target(ssh_spec)
        tmpd = Path(tempfile.mkdtemp(prefix="csgoj_nginx_upd_"))
        local_edit = tmpd / "edit.conf"
        staging_pass = tmpd / "passfile"
        try:
            scp_download(user, host, port, remote_conf, local_edit)
            raw = local_edit.read_text(encoding="utf-8")
            spans = extract_server_spans(raw)
            ht_write = staging_pass if (gate_spec and not gate_spec.clear_all) else None
            existing_map: Optional[Dict[str, str]] = None
            if gate_spec and not gate_spec.clear_all:
                exf = tmpd / "exist-pass"
                existing_map = scp_download_htpasswd_merge_base(
                    user, host, port, remote_pass, exf
                )
            ch, msgs = _process_conf_file_rebuild(
                raw,
                spans,
                bundle,
                local_edit,
                dry_run,
                logical_conf_path=logical_conf,
                gate=gate_spec,
                htpasswd_write_path=ht_write,
                htpasswd_merge_base=existing_map,
            )
            deploy_notes: List[str] = []
            if dry_run:
                if do_restart:
                    deploy_notes.append("（--restart 已在 dry-run 下跳过）")
                print(
                    render_change_report(
                        logical_conf,
                        ssh_spec,
                        dry_run,
                        gate_spec,
                        msgs,
                        ch,
                        deploy_notes,
                    )
                )
                return 0
            if ch:
                scp_upload(user, host, port, local_edit, remote_conf)
                deploy_notes.append(f"已上传 nginx conf → {remote_conf}")
            if gate_spec is not None:
                if gate_spec.clear_all:
                    ssh_run(user, host, port, f"rm -f {shlex.quote(remote_pass)}")
                    deploy_notes.append(
                        f"已在远端删除口令文件（若存在）: {remote_pass}"
                    )
                elif staging_pass.is_file():
                    ssh_run(
                        user,
                        host,
                        port,
                        f"mkdir -p {shlex.quote(str(Path(remote_pass).parent))}",
                    )
                    scp_upload(user, host, port, staging_pass, remote_pass)
                    deploy_notes.append(f"已上传 htpasswd → {remote_pass}")
                else:
                    ssh_run(user, host, port, f"rm -f {shlex.quote(remote_pass)}")
                    deploy_notes.append(
                        f"已在远端删除口令文件（合并后无条目）: {remote_pass}"
                    )
            if do_restart:
                dr_summary = docker_restart_nginx_server_ssh(user, host, port)
                deploy_notes.append(f"docker restart nginx-server → {dr_summary}")
            print(
                render_change_report(
                    logical_conf,
                    ssh_spec,
                    dry_run,
                    gate_spec,
                    msgs,
                    ch,
                    deploy_notes,
                )
            )
            return 0
        finally:
            shutil.rmtree(tmpd, ignore_errors=True)

    # 本地
    if not logical_conf.is_file():
        print(f"本地文件不存在: {logical_conf}", file=sys.stderr)
        return 2
    raw = logical_conf.read_text(encoding="utf-8")
    spans = extract_server_spans(raw)
    ch, msgs = _process_conf_file_rebuild(
        raw,
        spans,
        bundle,
        logical_conf,
        dry_run,
        logical_conf_path=logical_conf,
        gate=gate_spec,
        htpasswd_write_path=None,
    )
    # 本地写入由 _process 内完成，要点已在 msgs；不再追加 deploy_notes 以免与 msgs 重复。
    deploy_notes_local: List[str] = []
    if dry_run and do_restart:
        deploy_notes_local.append("（--restart 已在 dry-run 下跳过）")
    elif do_restart and not dry_run:
        dr_l = docker_restart_nginx_server_local()
        deploy_notes_local.append(f"docker restart nginx-server → {dr_l}")
    print(
        render_change_report(
            logical_conf,
            ssh_spec,
            dry_run,
            gate_spec,
            msgs,
            ch,
            deploy_notes_local,
        )
    )
    return 0


def main() -> int:
    script = Path(__file__).resolve()
    parser = build_arg_parser()
    try:
        args = parser.parse_args()
    except SystemExit as e:
        code = e.code
        return int(code) if isinstance(code, int) else 2

    if args.self_test:
        if args.conf or args.ssh_target:
            parser.error("--self-test 时不要写 conf 或 SSH 位置参数")
        try:
            templates_dir = (
                Path(args.templates_dir).resolve()
                if args.templates_dir
                else default_templates_dir(script)
            )
        except SystemExit as e_msg:
            print(str(e_msg), file=sys.stderr)
            return 2
        try:
            bundle = OjTemplateBundle.load(templates_dir)
        except (OSError, ValueError) as e:
            print(f"模板加载失败: {e}", file=sys.stderr)
            return 2
        return run_self_test(bundle)

    if not args.conf:
        print("未指定 nginx 业务 conf（第一个位置参数 CONF）。下面给出完整用法说明。\n", file=sys.stderr)
        parser.print_help(file=sys.stderr)
        return 2

    if args.ssh_target is not None and "@" not in args.ssh_target:
        parser.error(
            "第二个位置参数 SSH 须为 user@host 或 user@host:端口（须含 @）。"
            " 若只在本地改文件请省略该项，示例：{} oj.conf -p mypass".format(parser.prog)
        )

    try:
        templates_dir = (
            Path(args.templates_dir).resolve()
            if args.templates_dir
            else default_templates_dir(script)
        )
    except SystemExit as e_msg:
        print(str(e_msg), file=sys.stderr)
        return 2

    logical = resolve_target_conf_path(args.conf)

    gate_s = gate_spec_from_argparse(args, parser)

    try:
        return run_update_for_target(
            logical,
            args.ssh_target,
            gate_s,
            templates_dir,
            dry_run=args.dry_run,
            do_restart=args.restart,
        )
    except subprocess.CalledProcessError as e:
        print(f"外部命令失败: {e}", file=sys.stderr)
        return 1
    except RuntimeError as e:
        print(str(e), file=sys.stderr)
        return 1
    except FileNotFoundError as e:
        print(f"文件/命令缺失: {e}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
