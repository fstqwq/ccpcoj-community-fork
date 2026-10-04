#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
对拍结果模块 - 用于生成WA/PE测试用例的差异对比
返回最简格式（仅选手输出片段 + 测试数据元信息），前端从评测数据目录读取 .out 并自行计算diff
"""

import os
import hashlib
import time
from typing import Dict, Any, List, Optional, Tuple
import logging

# 将当前目录添加到Python路径
current_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if current_dir not in __import__('sys').path:
    __import__('sys').path.insert(0, current_dir)

from tools import status_constants as sc


class DiffResultGenerator:
    """对拍结果生成器"""
    
    # 最大返回的差异数据组数
    MAX_DIFF_CASES = 5
    
    # 默认片段长度（字节）
    DEFAULT_SNIPPET_BYTES = 1024
    
    def __init__(self, logger: logging.Logger = None):
        """初始化对拍结果生成器"""
        self.logger = logger or logging.getLogger(__name__)
    
    def should_generate_diff(self, in_file: str, out_file: str, user_output: str) -> Tuple[bool, str]:
        """
        判断是否应该生成对拍结果
        
        Args:
            in_file: 输入文件路径
            out_file: 期望输出文件路径
            user_output: 用户输出文件路径
            
        Returns:
            (should_generate, reason): 是否应该生成对拍结果，以及原因
        """
        try:
            # 输入文件：只检查存在性（不读取内容，web 端按需拉取）
            if not os.path.exists(in_file):
                return False, "输入文件不存在"
            
            # 期望输出：只检查存在性（不读取内容，web 端按需拉取）
            if not os.path.exists(out_file):
                return False, "期望输出文件不存在"
            
            # 用户输出：只检查存在性（允许大文件，评测机仅回传片段）
            if not os.path.exists(user_output):
                return False, "用户输出文件不存在"
            
            return True, "符合对拍条件"
            
        except Exception as e:
            self.logger.warning(f"检查文件大小时发生错误: {e}")
            return False, f"检查文件时发生错误: {e}"
    
    def _read_file_snippet_bytes(self, file_path: str, max_bytes: int) -> Tuple[Optional[str], Dict[str, Any]]:
        """
        读取文件前 max_bytes 字节，并返回 utf-8 文本（errors=replace）以及元信息
        """
        meta: Dict[str, Any] = {
            "size": None,
            "mtime": None,
            "truncated": False,
            "max_bytes": int(max_bytes),
        }
        try:
            if not os.path.exists(file_path):
                return None, meta
            size = os.path.getsize(file_path)
            mtime = os.path.getmtime(file_path)
            meta["size"] = int(size)
            meta["mtime"] = int(mtime)
            meta["truncated"] = bool(size > max_bytes)
            with open(file_path, "rb") as f:
                data = f.read(int(max_bytes))
            text = data.decode("utf-8", errors="replace")
            return text, meta
        except Exception as e:
            self.logger.warning(f"读取文件片段失败 {file_path}: {e}")
            return None, meta

    def _sha256_file(self, file_path: str) -> Optional[str]:
        """计算文件 sha256（全量）。失败返回 None。"""
        try:
            if not os.path.exists(file_path):
                return None
            h = hashlib.sha256()
            with open(file_path, "rb") as f:
                for chunk in iter(lambda: f.read(1024 * 1024), b""):
                    h.update(chunk)
            return h.hexdigest()
        except Exception as e:
            self.logger.warning(f"计算 sha256 失败 {file_path}: {e}")
            return None
    
    def generate_diff_for_case(self, case_name: str, in_file: str, out_file: str,
                               user_output: str, snippet_bytes: int = None) -> Optional[Dict[str, Any]]:
        """
        为单个测试用例生成对拍结果
        
        Args:
            case_name: 测试用例名称
            in_file: 输入文件路径
            out_file: 期望输出文件路径
            user_output: 用户输出文件路径
            
        Returns:
            对拍结果字典，如果生成失败则返回None
        """
        try:
            snippet_bytes = int(snippet_bytes) if snippet_bytes is not None else self.DEFAULT_SNIPPET_BYTES
            if snippet_bytes <= 0:
                snippet_bytes = self.DEFAULT_SNIPPET_BYTES

            # 检查是否应该生成对拍
            should_generate, reason = self.should_generate_diff(in_file, out_file, user_output)
            if not should_generate:
                return {"case": case_name, "ok": False, "err": reason}
            
            # 只读取用户输出片段（按字节截断）
            user_text, user_meta = self._read_file_snippet_bytes(user_output, snippet_bytes)
            if user_text is None:
                return {"case": case_name, "ok": False, "err": "无法读取用户输出"}

            # 测试数据元信息：out 的 hash/mtime/size（用于 web 判断是否“过期”）
            out_hash = self._sha256_file(out_file)
            out_size = None
            out_mtime = None
            try:
                if os.path.exists(out_file):
                    out_size = int(os.path.getsize(out_file))
                    out_mtime = int(os.path.getmtime(out_file))
            except Exception:
                pass

            # 最简格式：只返回用户输出片段 + 截断信息 + out 元信息
            return {
                "case": case_name,
                "ok": True,
                "act": user_text,  # 兼容旧字段名：act = 用户输出
                "user_output_trunc": bool(user_meta.get("truncated", False)),
                "user_output_size": user_meta.get("size"),
                "user_output_max_bytes": user_meta.get("max_bytes"),
                "out_hash": out_hash,
                "out_mtime": out_mtime,
                "out_size": out_size,
            }
            
        except Exception as e:
            self.logger.error(f"为测试用例 {case_name} 生成对拍结果时发生错误: {e}")
            return {"case": case_name, "ok": False, "err": str(e)}
    
    def generate_diffs_for_cases(self, failed_cases: List[Dict[str, Any]], 
                                 test_cases_dir: str) -> Dict[str, Any]:
        """
        为多个失败的测试用例生成对拍结果
        
        Args:
            failed_cases: 失败的测试用例列表，每个元素包含：
                - test_case: 测试用例名称
                - judge_result: 评测结果（WA或PE）
                - in_file: 输入文件路径（可选）
                - out_file: 期望输出文件路径（可选）
                - user_output: 用户输出文件路径（可选）
            test_cases_dir: 测试用例目录
            
        Returns:
            对拍结果字典，包含：
                - diff_cases: 成功生成对拍的结果列表（最多MAX_DIFF_CASES个）
                - skipped_cases: 跳过的测试用例列表（包含原因）
                - total_failed: 总失败数
                - total_diff_generated: 成功生成对拍的数量
        """
        diff_results = []
        skipped_cases = []
        total_diff_generated = 0

        # 片段长度（字节）：默认 1KB；未来可由 web 端参数透传
        snippet_bytes = self.DEFAULT_SNIPPET_BYTES
        
        for case_info in failed_cases:
            case_name = case_info.get("test_case", "")
            judge_result = case_info.get("judge_result", "")
            
            # 只处理WA和PE的结果
            if judge_result not in [sc.JUDGE_WRONG_ANSWER, sc.JUDGE_PRESENTATION_ERROR]:
                skipped_cases.append({
                    "test_case": case_name,
                    "reason": f"评测结果不是WA或PE: {judge_result}"
                })
                continue
            
            # 如果已经生成了足够的对拍结果，跳过剩余的
            if len(diff_results) >= self.MAX_DIFF_CASES:
                skipped_cases.append({
                    "test_case": case_name,
                    "reason": f"已达到最大对拍数量限制 ({self.MAX_DIFF_CASES})"
                })
                continue
            
            # 获取文件路径
            in_file = case_info.get("in_file")
            out_file = case_info.get("out_file")
            user_output = case_info.get("user_output")
            
            # 如果文件路径不存在，尝试从test_cases_dir和case_name构建
            if not in_file:
                in_file = os.path.join(test_cases_dir, f"{case_name}.in")
            if not out_file:
                out_file = os.path.join(test_cases_dir, f"{case_name}.out")
            if not user_output:
                # 用户输出通常在work_dir中
                user_output = case_info.get("user_output_path", "")
            
            # 生成对拍结果
            diff_result = self.generate_diff_for_case(case_name, in_file, out_file, user_output, snippet_bytes=snippet_bytes)
            
            if diff_result:
                if diff_result.get("ok", False):
                    diff_results.append(diff_result)
                    total_diff_generated += 1
                else:
                    skipped_cases.append({"case": case_name, "err": diff_result.get("err", "未知")})
        
        return {
            "diffs": diff_results,
            "skipped": skipped_cases if skipped_cases else None,
            "total": total_diff_generated
        }


def get_diff_result_generator(logger: logging.Logger = None) -> DiffResultGenerator:
    """获取对拍结果生成器实例"""
    return DiffResultGenerator(logger)

