"""
比赛包导入（入队型）。PHP Web 仅写 backtask；worker 解压后调用 ``contest_import_executor``。
"""
import logging
import os
import shutil
import zipfile

from backtask.core.base_task import BaseTask
from backtask.common.csg_datetime import oj_now_workdir_tag, oj_time
from backtask.common.dir_permissions import makedirs_chmod_new_dir_chain
from backtask.task_queue.contest_import_executor import execute_contest_import

logger = logging.getLogger("backtask.task_queue.contest_import")


def _del_time_expire_folders(dir_path: str, expire_days: float) -> None:
    if not dir_path or not os.path.isdir(dir_path):
        return
    now = oj_time()
    try:
        names = os.listdir(dir_path)
    except OSError:
        return
    for name in names:
        fp = os.path.join(dir_path, name)
        try:
            mtime = os.path.getmtime(fp)
        except OSError:
            continue
        if (now - mtime) / 86400.0 <= float(expire_days):
            continue
        try:
            if os.path.isfile(fp) or os.path.islink(fp):
                os.unlink(fp)
            elif os.path.isdir(fp):
                shutil.rmtree(fp, ignore_errors=True)
        except OSError:
            pass


def _import_queue_key(params: dict) -> str:
    return str(params.get("import_temp_base") or params.get("target_dir") or "__contest_import")


class ContestImportTask(BaseTask):
    def run(self):
        p = self.task_params
        import_file = p.get("import_file", "")
        import_temp_base = p.get("import_temp_base", "")
        keep_days = float(p.get("export_temp_keep_time", 7))
        testdata_dir = (p.get("testdata_dir") or "").strip()
        public_attach_root = (p.get("public_attach_root") or "").strip()
        public_dir = (p.get("public_dir") or "").strip()
        contest_attach_rel = (p.get("contest_attach_rel") or "/upload/contest_attach").strip()
        oj_status = str(p.get("oj_status") or "")

        if not import_file or not os.path.isfile(import_file):
            self.log_error(f"导入文件不存在: {import_file}")
            self.result = {"error": "import file not found"}
            return
        if not import_temp_base:
            self.log_error("task_params 缺少 import_temp_base")
            self.result = {"error": "missing import_temp_base"}
            return
        if not testdata_dir or not public_attach_root or not public_dir:
            self.log_error("task_params 缺少路径参数")
            self.result = {"error": "missing path params"}
            return

        if not zipfile.is_zipfile(import_file):
            self.log_error("文件不是有效的 ZIP")
            self.result = {"error": "not a valid zip file"}
            return

        _del_time_expire_folders(import_temp_base, keep_days)
        date_tag = oj_now_workdir_tag()
        uid = p.get("user_id", 0)
        work = os.path.join(import_temp_base, f"{date_tag}-cimport-{uid}-{self.task_id}")
        makedirs_chmod_new_dir_chain(work, exist_ok=True, log=logger)

        try:
            self.update_progress("解压并导入比赛…")
            out = execute_contest_import(
                import_file,
                work,
                testdata_dir=testdata_dir,
                public_attach_root=public_attach_root,
                public_dir=public_dir,
                contest_attach_rel=contest_attach_rel,
                oj_status=oj_status,
                regenerate_contest_attach=bool(p.get("regenerate_contest_attach")),
            )
            self.result = out
            self.log_info("比赛导入完成: %s", out)
        except Exception as e:
            self.log_error(str(e))
            self.result = {"error": str(e)[:800]}
        finally:
            shutil.rmtree(work, ignore_errors=True)


QUEUED_TASK_REGISTRATION = {
    "task_type": "contest_import",
    "module": "backtask.task_queue.contest_import",
    "class_name": "ContestImportTask",
    "method": "run",
    "timeout_minutes": 240,
    "concurrency_mode": "write",
    "queue_key_fn": _import_queue_key,
}
