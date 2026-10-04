"""
题目包导入（入队型）。

调度链：PHP Web 仅写入 ``backtask`` 表；Python worker 解压 ZIP 后读 ``problemlist.json``，
在 ``problem_import_executor`` 中写库并搬迁 ``TEST_*`` / ``ATTACH_*``（Pandoc 在 worker 进程内调用）。
"""
import logging
import os
import shutil
import zipfile

from backtask.core.base_task import BaseTask
from backtask.common.csg_datetime import oj_now_workdir_tag, oj_time
from backtask.common.dir_permissions import chmod_tree_rwx_materialized, makedirs_chmod_new_dir_chain
from backtask.task_queue.problem_import_executor import execute_problem_import

logger = logging.getLogger("backtask.task_queue.problem_import")


def _import_queue_key(params: dict) -> str:
    return str(params.get("import_temp_base") or params.get("target_dir") or "__default_import")


def _del_time_expire_folders(dir_path: str, expire_days: float) -> None:
    """与 PHP DelTimeExpireFolders 等效：删除目录下过期的子项。"""
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


class ProblemImportTask(BaseTask):

    def run(self):
        p = self.task_params
        import_file = p.get("import_file", "")
        import_temp_base = p.get("import_temp_base", "")
        keep_days = float(p.get("export_temp_keep_time", 7))
        user_id = int(p.get("user_id", 0))
        now_course_id = p.get("now_course_id")
        auto_submit_solutions = bool(p.get("auto_submit_solutions", False))
        submit_user_id = str(p.get("created_by") or p.get("user_id") or "")
        testdata_dir = (p.get("testdata_dir") or "").strip()
        public_attach_root = (p.get("public_attach_root") or "").strip()
        oj_status = str(p.get("oj_status") or "")

        if not import_file or not os.path.isfile(import_file):
            self.log_error(f"导入文件不存在: {import_file}")
            self.result = {"error": "import file not found"}
            return
        if not import_temp_base:
            self.log_error("task_params 缺少 import_temp_base")
            self.result = {"error": "missing import_temp_base"}
            return
        if not testdata_dir or not public_attach_root:
            self.log_error("task_params 缺少 testdata_dir 或 public_attach_root")
            self.result = {"error": "missing testdata_dir or public_attach_root"}
            return

        self.log_info(f"开始导入: {import_file}")
        self.update_progress("准备临时目录…")

        if not zipfile.is_zipfile(import_file):
            self.log_error("文件不是有效的 ZIP 格式")
            self.result = {"error": "not a valid zip file"}
            return

        _del_time_expire_folders(import_temp_base, keep_days)
        date_tag = oj_now_workdir_tag()
        import_temp_path = os.path.join(
            import_temp_base, f"{date_tag}-{user_id}-{self.task_id}"
        )
        makedirs_chmod_new_dir_chain(import_temp_path, exist_ok=True, log=logger)

        extracted_names = []
        try:
            self.update_progress("解压 ZIP…")
            with zipfile.ZipFile(import_file, "r") as zf:
                namelist = zf.namelist()
                if self.check_stop():
                    self.log_info("用户取消，导入中断")
                    shutil.rmtree(import_temp_path, ignore_errors=True)
                    return
                extracted_names = _safe_extract_zf(zf, import_temp_path, namelist, self)
                chmod_tree_rwx_materialized(import_temp_path, log=logger)
                if self.check_stop():
                    self.log_info("用户取消，导入中断")
                    shutil.rmtree(import_temp_path, ignore_errors=True)
                    return

            self.update_progress("题库入库与搬迁…")
            try:
                cid = int(now_course_id) if now_course_id not in (None, "", 0, "0") else None
            except (TypeError, ValueError):
                cid = None

            out = execute_problem_import(
                import_temp_path,
                testdata_dir=testdata_dir,
                public_attach_root=public_attach_root,
                oj_status=oj_status,
                now_course_id=cid,
                bind_on_attach_duplicate=True,
                auto_submit_solutions=auto_submit_solutions,
                submit_user_id=submit_user_id,
            )
            out["extracted_count"] = len(extracted_names)
            top_dirs = sorted(
                {e.split("/")[0] for e in extracted_names if "/" in e}
            )
            if not top_dirs:
                top_dirs = sorted({e for e in extracted_names if e})
            out["problem_dirs"] = list(top_dirs)
            self.result = out
            self.log_info(
                f"导入完成: 解压 {len(extracted_names)} 项, "
                f"成功 {len(out.get('addedList') or [])}"
            )
        except Exception as e:
            self.log_error(str(e))
            self.result = {
                "error": str(e)[:500],
                "extracted_count": len(extracted_names),
            }
        finally:
            if os.path.isdir(import_temp_path):
                shutil.rmtree(import_temp_path, ignore_errors=True)


def _safe_extract_zf(zf, import_temp_path, namelist, task) -> list:
    base = os.path.abspath(import_temp_path)
    extracted_names = []
    for i, entry in enumerate(namelist):
        if task.check_stop():
            return extracted_names
        target = os.path.abspath(os.path.join(base, entry))
        if target != base and not target.startswith(base + os.sep):
            logger.warning("跳过非法 zip 路径: %s", entry)
            continue
        zf.extract(entry, import_temp_path)
        extracted_names.append(entry)
        if (i + 1) % 50 == 0 or i + 1 == len(namelist):
            task.update_progress(f"解压 {i+1}/{len(namelist)}")
    return extracted_names


QUEUED_TASK_REGISTRATION = {
    "task_type": "problem_import",
    "module": "backtask.task_queue.problem_import",
    "class_name": "ProblemImportTask",
    "method": "run",
    "timeout_minutes": 60,
    "concurrency_mode": "write",
    "queue_key_fn": _import_queue_key,
}
