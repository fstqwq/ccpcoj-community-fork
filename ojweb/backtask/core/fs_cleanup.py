"""
文件系统通用清理：按目录项 mtime 删除过期子文件/子目录（与 PHP DelTimeExpireFolders 语义一致）。
"""
import os
import shutil
import logging

from backtask.common.csg_datetime import oj_time

logger = logging.getLogger("backtask.fs_cleanup")


def purge_stale_entries(root: str, days: int) -> int:
    """
    删除 root 下直接子项中 mtime 早于 N 天的文件或目录。
    返回删除的项数。
    """
    if not root or not os.path.isdir(root):
        return 0
    now = oj_time()
    threshold_sec = days * 86400
    removed = 0
    try:
        names = os.listdir(root)
    except OSError as e:
        logger.warning("无法列举目录 %s: %s", root, e)
        return 0
    for name in names:
        if name in (".", ".."):
            continue
        path = os.path.join(root, name)
        try:
            mtime = os.path.getmtime(path)
        except OSError as e:
            logger.warning("无法读取 mtime %s: %s", path, e)
            continue
        if now - mtime <= threshold_sec:
            continue
        try:
            if os.path.isfile(path) or os.path.islink(path):
                os.remove(path)
            else:
                shutil.rmtree(path, ignore_errors=True)
            removed += 1
        except OSError as e:
            logger.warning("删除失败 %s: %s", path, e)
    return removed
