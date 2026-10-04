"""
Worker 侧「目录权限」唯一实现入口（backtask 内其它模块禁止自写 ``os.chmod``/等价逻辑处理同类场景）。

典型背景：Python worker 与 PHP-FPM 不同 uid；umask 下新建目录可能导致 Web 无法写入导入落地路径。

对外 API：

- :func:`makedirs_chmod_new_dir_chain` — 创建目录链并仅对**本次新建**的目录逐级放宽权限。
- :func:`chmod_tree_rwx_materialized` — 对已有整棵目录树递归放宽（目录 777、普通文件 666），用于解压/搬迁后的物料路径。

常量 :data:`DIR_MODE_RWX_ALL` / :data:`FILE_MODE_RW_ALL` 仅供本模块与测试断言使用，业务请调用上述函数而非自行组合 mode。
"""
from __future__ import annotations

import logging
import os
import stat
from typing import Set

logger = logging.getLogger("backtask.common.dir_permissions")

DIR_MODE_RWX_ALL = stat.S_IRWXU | stat.S_IRWXG | stat.S_IRWXO
FILE_MODE_RW_ALL = (
    stat.S_IRUSR | stat.S_IWUSR | stat.S_IRGRP | stat.S_IWGRP | stat.S_IROTH | stat.S_IWOTH
)


def _chmod_one_dir(path: str, *, log: logging.Logger) -> None:
    try:
        if not os.path.isdir(path) or os.path.islink(path):
            return
        os.chmod(path, DIR_MODE_RWX_ALL, follow_symlinks=False)
    except OSError as e:
        log.warning("chmod 目录失败 %s: %s", path, e)


def makedirs_chmod_new_dir_chain(leaf: str, *, exist_ok: bool = True, log: logging.Logger | None = None) -> None:
    """
    ``os.makedirs(leaf)`` 后，自 ``leaf`` 向上对**创建前不存在**的目录逐级 chmod（:data:`DIR_MODE_RWX_ALL`）；
    遇到创建前已存在的目录则停止（不修改该层及更上层）。
    """
    log = log or logger
    if not leaf:
        return
    leaf = os.path.abspath(leaf)
    snapshot: Set[str] = set()
    p = leaf
    while True:
        pp = os.path.dirname(p)
        if p == pp:
            break
        try:
            if os.path.isdir(p):
                snapshot.add(p)
        except OSError:
            pass
        p = pp

    os.makedirs(leaf, exist_ok=exist_ok)

    p = leaf
    while True:
        pp = os.path.dirname(p)
        if p == pp:
            break
        if p in snapshot:
            break
        _chmod_one_dir(p, log=log)
        p = pp


def chmod_tree_rwx_materialized(root: str, *, log: logging.Logger | None = None) -> None:
    """
    将 ``root`` 及其子树中目录设为 :data:`DIR_MODE_RWX_ALL`、普通文件设为 :data:`FILE_MODE_RW_ALL`
   （跳过重解析的符号链接）。chmod 失败仅记日志，不抛异常。
    """
    log = log or logger
    if not root:
        return
    try:
        root = os.path.abspath(root)
    except OSError:
        return
    if not os.path.exists(root):
        return

    def _chmod_file_or_dir(path: str) -> None:
        try:
            if os.path.islink(path):
                return
            if os.path.isdir(path):
                os.chmod(path, DIR_MODE_RWX_ALL, follow_symlinks=False)
            elif os.path.isfile(path):
                os.chmod(path, FILE_MODE_RW_ALL, follow_symlinks=False)
        except OSError as e:
            log.warning("chmod 失败 %s: %s", path, e)

    for dirpath, _dirnames, filenames in os.walk(root, topdown=True):
        _chmod_file_or_dir(dirpath)
        for name in filenames:
            fp = os.path.join(dirpath, name)
            if os.path.isdir(fp):
                _chmod_file_or_dir(fp)
            else:
                _chmod_file_or_dir(fp)
