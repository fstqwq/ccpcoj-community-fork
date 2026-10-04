"""
与 ThinkPHP `config/OjPath.php` 一致的 ojweb 根路径及常用子路径解析（供 worker 各模块复用）。
"""
import os


def ojweb_root() -> str:
    root = (os.environ.get("OJWEB_ROOT") or "").strip()
    if root:
        return os.path.abspath(root)
    # backtask/core/this_file.py -> backtask -> ojweb
    here = os.path.abspath(os.path.dirname(__file__))
    return os.path.dirname(os.path.dirname(os.path.dirname(here)))


def problem_export_paths():
    """export_problem、export_problem_temp、import_problem_temp 对应绝对路径。"""
    base = ojweb_root()
    return (
        os.path.join(base, "PROBLEM_EXPORT", "EXPORT"),
        os.path.join(base, "PROBLEM_EXPORT", "FILE_TEMP"),
        os.path.join(base, "PROBLEM_EXPORT", "IMPORT_TEMP"),
    )


def contest_export_paths():
    """与 config/OjPath.php 中 CONTEST_EXPORT 一致。"""
    base = ojweb_root()
    return (
        os.path.join(base, "CONTEST_EXPORT", "EXPORT"),
        os.path.join(base, "CONTEST_EXPORT", "FILE_TEMP"),
        os.path.join(base, "CONTEST_EXPORT", "IMPORT_TEMP"),
    )
