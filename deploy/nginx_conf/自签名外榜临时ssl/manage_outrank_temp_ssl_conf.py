#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
由现有 HTTP OJ ``server{}`` conf 派生同内容、仅 ``listen`` 改为 ``<ssl_port> ssl`` 的 ``*-ssl.conf``，
并在 attach 目录生成自签名证书（浏览器会提示不受信任，仅用于临时外榜 HTTPS / 消除 Mixed Content）。

默认：``ssl_port = http_listen + 2``（可用 ``--ssl-port`` 覆盖）。

用法::

    python3 manage_outrank_temp_ssl_conf.py add oj-acm.conf [user@host[:端口]]
        [--conf-d DIR] [--attach DIR] [--ssl-port N] [--http-delta 2]
        [--dry-run] [--restart]

    python3 manage_outrank_temp_ssl_conf.py remove oj-acm-ssl.conf [user@host[:端口]]
        [--conf-d DIR] [--attach DIR] [--delete-certs] [--dry-run] [--restart]

- **CONF** 仅文件名时：默认 ``/csgoj_data/nginx/nginx_conf.d/<名>``；绝对路径则按给定路径。
- **证书**：``<attach>/outrank-temp-<stem>-<ssl_port>.{crt,key}``；容器内路径为 ``/etc/nginx/attach/``（与 Basic 口令同挂载）。
- **restart**：非 dry-run 时执行 ``docker restart nginx-server``（本地或经 SSH）。

自检：``python3 manage_outrank_temp_ssl_conf.py --self-test``
"""

from __future__ import annotations

import argparse
import re
import shlex
import subprocess
import sys
import tempfile
from pathlib import Path
from typing import List, Optional, Tuple

DEFAULT_CONF_D = Path("/csgoj_data/nginx/nginx_conf.d")
DEFAULT_ATTACH = Path("/csgoj_data/nginx/attach")
NGINX_ATTACH_IN_CONTAINER = "/etc/nginx/attach"

RE_FIRST_LISTEN = re.compile(
    r"(?m)^(\s*)listen\s+(\d+)((?:\s+\S+)+)?\s*;\s*$",
)
RE_SERVER_NAME_LINE = re.compile(r"(?m)^(\s*server_name\s+[^;]+;\s*)$")


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


def ssh_run(user: str, host: str, port: int, remote_cmd: str) -> None:
    subprocess.run(_ssh_base(user, host, port) + [remote_cmd], check=True)


def docker_restart(user: Optional[str], host: Optional[str], port: int) -> None:
    cmd = ["docker", "restart", "nginx-server"]
    if user and host:
        ssh_run(user, host, port, " ".join(shlex.quote(c) for c in cmd))
    else:
        subprocess.run(cmd, check=True)


def resolve_conf_path(name: str, conf_d: Path) -> Path:
    p = Path(name)
    if p.is_absolute():
        return p
    return conf_d / name


def stem_from_conf_name(conf_path: Path) -> str:
    name = conf_path.name
    if name.endswith("-ssl.conf"):
        return name[: -len("-ssl.conf")]
    if name.endswith(".conf"):
        return name[: -len(".conf")]
    return conf_path.stem


def ssl_conf_path_for_source(http_conf: Path) -> Path:
    stem = stem_from_conf_name(http_conf)
    return http_conf.parent / f"{stem}-ssl.conf"


def cert_base_name(stem: str, ssl_port: int) -> str:
    return f"outrank-temp-{stem}-{ssl_port}"


def first_listen_port(http_text: str) -> int:
    m = RE_FIRST_LISTEN.search(http_text)
    if not m:
        raise ValueError("未在 conf 中找到首条 listen <端口>; 行")
    return int(m.group(2))


def build_ssl_conf_text(
    http_text: str,
    ssl_port: int,
    cert_base: str,
) -> str:
    if " ssl;" in http_text and re.search(r"listen\s+\d+\s+ssl\s*;", http_text):
        raise ValueError("内容已含 listen … ssl，请勿对 SSL conf 再执行 add")

    def repl_first_listen(m: re.Match[str]) -> str:
        indent = m.group(1)
        return f"{indent}listen {ssl_port} ssl;"

    new_text, n = RE_FIRST_LISTEN.subn(repl_first_listen, http_text, count=1)
    if n != 1:
        raise ValueError("替换首条 listen 失败")

    m2 = RE_SERVER_NAME_LINE.search(new_text)
    if not m2:
        raise ValueError("未找到 server_name …; 行")

    indent = re.match(r"(\s*)", m2.group(1))
    ind = indent.group(1) if indent else "    "
    crt = f"{NGINX_ATTACH_IN_CONTAINER}/{cert_base}.crt"
    key = f"{NGINX_ATTACH_IN_CONTAINER}/{cert_base}.key"
    ssl_block = (
        f"{m2.group(1)}\n"
        f"{ind}ssl_certificate {crt};\n"
        f"{ind}ssl_certificate_key {key};\n"
        f"{ind}ssl_session_timeout 5m;\n"
        f"{ind}ssl_protocols TLSv1.2 TLSv1.3;\n"
        f"{ind}ssl_prefer_server_ciphers on;\n"
        f"{ind}error_page 497 https://$host:{ssl_port}$request_uri;\n"
    )
    return new_text[: m2.start()] + ssl_block + new_text[m2.end() :]


def openssl_cmd(host_attach: Path, cert_base: str, cn: str) -> str:
    crt = host_attach / f"{cert_base}.crt"
    key = host_attach / f"{cert_base}.key"
    return (
        f"mkdir -p {shlex.quote(str(host_attach))} && "
        f"openssl req -x509 -nodes -days 3650 -newkey rsa:2048 "
        f"-keyout {shlex.quote(str(key))} "
        f"-out {shlex.quote(str(crt))} "
        f"-subj {shlex.quote('/CN=' + cn)}"
    )


def extract_cert_base_from_ssl_conf(text: str) -> Optional[str]:
    m = re.search(
        r"ssl_certificate\s+" + re.escape(NGINX_ATTACH_IN_CONTAINER) + r"/([^;\s]+)\.crt\s*;",
        text,
    )
    return m.group(1) if m else None


def cmd_add(
    source_name: str,
    ssh_spec: Optional[str],
    conf_d: Path,
    attach: Path,
    ssl_port: Optional[int],
    http_delta: int,
    dry_run: bool,
    do_restart: bool,
) -> int:
    src = resolve_conf_path(source_name, conf_d)
    dst = ssl_conf_path_for_source(src)
    stem = stem_from_conf_name(src)
    if dst.name.endswith("-ssl.conf") and src.resolve() == dst.resolve():
        print("add 的输入应为 HTTP conf（如 oj-acm.conf），不是 *-ssl.conf", file=sys.stderr)
        return 2

    if ssh_spec:
        user, host, port = parse_ssh_target(ssh_spec)
        tmp = Path(tempfile.mkdtemp(prefix="csgoj_outrank_ssl_"))
        local_src = tmp / "http.conf"
        try:
            scp_download(user, host, port, src.as_posix(), local_src)
            raw = local_src.read_text(encoding="utf-8")
        finally:
            subprocess.run(["rm", "-rf", str(tmp)], check=False)
    else:
        raw = src.read_text(encoding="utf-8")

    http_port = first_listen_port(raw)
    sp = ssl_port if ssl_port is not None else (http_port + http_delta)
    cb = cert_base_name(stem, sp)
    cn = cb.replace(".", "-")
    ssl_text = build_ssl_conf_text(raw, sp, cb)

    print(f"[信息] HTTP listen={http_port} → SSL listen={sp}，证书前缀={cb}", flush=True)

    if dry_run:
        print("[dry-run] 将写入:", dst, flush=True)
        print("[dry-run] openssl:", openssl_cmd(attach, cb, cn), flush=True)
        if do_restart:
            print("[dry-run] 跳过 docker restart", flush=True)
        return 0

    if ssh_spec:
        user, host, port = parse_ssh_target(ssh_spec)
        ssh_run(user, host, port, openssl_cmd(attach, cb, cn))
        tmpf = Path(tempfile.mkdtemp(prefix="csgoj_ssl_upload_")) / "ssl.conf"
        tmpf.write_text(ssl_text, encoding="utf-8")
        try:
            scp_upload(user, host, port, tmpf, dst.as_posix())
        finally:
            subprocess.run(["rm", "-rf", str(tmpf.parent)], check=False)
    else:
        attach.mkdir(parents=True, exist_ok=True)
        subprocess.run(
            openssl_cmd(attach, cb, cn),
            shell=True,
            check=True,
        )
        dst.write_text(ssl_text, encoding="utf-8")

    print(f"[完成] 已部署: {dst}", flush=True)
    if do_restart:
        if ssh_spec:
            u, h, p = parse_ssh_target(ssh_spec)
            docker_restart(u, h, p)
        else:
            docker_restart(None, None, 22)
        print("[完成] 已执行 docker restart nginx-server", flush=True)
    return 0


def cmd_remove(
    ssl_conf_name: str,
    ssh_spec: Optional[str],
    conf_d: Path,
    attach: Path,
    delete_certs: bool,
    dry_run: bool,
    do_restart: bool,
) -> int:
    path = resolve_conf_path(ssl_conf_name, conf_d)
    if not str(path.name).endswith("-ssl.conf"):
        print("remove 请传入 *-ssl.conf 文件名", file=sys.stderr)
        return 2

    cert_base: Optional[str] = None
    if delete_certs:
        if ssh_spec:
            user, host, port = parse_ssh_target(ssh_spec)
            tmp = Path(tempfile.mkdtemp(prefix="csgoj_outrank_rm_"))
            lf = tmp / "ssl.conf"
            try:
                scp_download(user, host, port, path.as_posix(), lf)
                cert_base = extract_cert_base_from_ssl_conf(lf.read_text(encoding="utf-8"))
            except subprocess.CalledProcessError:
                cert_base = None
            finally:
                subprocess.run(["rm", "-rf", str(tmp)], check=False)
        elif path.is_file():
            cert_base = extract_cert_base_from_ssl_conf(path.read_text(encoding="utf-8"))

    if dry_run:
        print("[dry-run] 将删除:", path, flush=True)
        if delete_certs and cert_base:
            print("[dry-run] 将删除证书:", attach / f"{cert_base}.crt", attach / f"{cert_base}.key")
        return 0

    if ssh_spec:
        user, host, port = parse_ssh_target(ssh_spec)
        ssh_run(user, host, port, f"rm -f {shlex.quote(path.as_posix())}")
        if delete_certs and cert_base:
            ssh_run(
                user,
                host,
                port,
                f"rm -f {shlex.quote(str(attach / (cert_base + '.crt')))} "
                f"{shlex.quote(str(attach / (cert_base + '.key')))}",
            )
    else:
        path.unlink(missing_ok=True)
        if delete_certs and cert_base:
            (attach / f"{cert_base}.crt").unlink(missing_ok=True)
            (attach / f"{cert_base}.key").unlink(missing_ok=True)

    print(f"[完成] 已删除: {path}", flush=True)
    if do_restart:
        if ssh_spec:
            u, h, p = parse_ssh_target(ssh_spec)
            docker_restart(u, h, p)
        else:
            docker_restart(None, None, 22)
        print("[完成] 已执行 docker restart nginx-server", flush=True)
    return 0


def self_test() -> int:
    sample = """server {
    listen 20100;
    server_name localhost;

    root /x;
}
"""
    out = build_ssl_conf_text(sample, 20102, "outrank-temp-oj-acm-20102")
    assert "listen 20102 ssl;" in out
    assert "ssl_certificate /etc/nginx/attach/outrank-temp-oj-acm-20102.crt" in out
    assert "error_page 497 https://$host:20102$request_uri" in out
    assert "listen 20100" not in out
    print("self-test OK")
    return 0


def main() -> int:
    if "--self-test" in sys.argv:
        return self_test()

    p = argparse.ArgumentParser(
        description="外榜临时 SSL：由 HTTP conf 生成 *-ssl.conf + attach 自签名证书",
    )
    p.add_argument("action", choices=["add", "remove"])
    p.add_argument("conf", help="add 时传 HTTP conf 名（如 oj-acm.conf）；remove 时传 *-ssl.conf")
    p.add_argument(
        "ssh",
        nargs="?",
        default=None,
        help="可选 user@host 或 user@host:端口，经 scp/ssh 操作远端默认路径",
    )
    p.add_argument("--conf-d", type=Path, default=DEFAULT_CONF_D, help="conf.d 目录")
    p.add_argument("--attach", type=Path, default=DEFAULT_ATTACH, help="宿主机 attach 目录")
    p.add_argument("--ssl-port", type=int, default=None, help="SSL 监听端口（默认 HTTP+http-delta）")
    p.add_argument("--http-delta", type=int, default=2, help="未指定 --ssl-port 时：ssl = http + 本值")
    p.add_argument("--delete-certs", action="store_true", help="remove 时同时删 attach 下对应 crt/key")
    p.add_argument("--dry-run", action="store_true")
    p.add_argument("--restart", action="store_true", help="成功后 docker restart nginx-server")
    args = p.parse_args()
    if args.action == "add":
        return cmd_add(
            args.conf,
            args.ssh,
            args.conf_d,
            args.attach,
            args.ssl_port,
            args.http_delta,
            args.dry_run,
            args.restart,
        )
    return cmd_remove(
        args.conf,
        args.ssh,
        args.conf_d,
        args.attach,
        args.delete_certs,
        args.dry_run,
        args.restart,
    )


if __name__ == "__main__":
    sys.exit(main())
