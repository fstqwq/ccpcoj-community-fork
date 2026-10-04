#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
CSGOJ judge2 代码查重模块
支持代码同步和Winnowing快速查重（MOSS算法核心，5000份代码1秒内响应）
"""

import os
import sys
import json
import time
import subprocess
import tempfile
import shutil
import logging
import re
import hashlib
from typing import Dict, Any, List, Optional, Tuple, Set
from pathlib import Path
from collections import defaultdict

# 将当前目录添加到Python路径
current_dir = os.path.dirname(os.path.abspath(__file__))
parent_dir = os.path.dirname(current_dir)
if current_dir not in sys.path:
    sys.path.insert(0, current_dir)
if parent_dir not in sys.path:
    sys.path.insert(0, parent_dir)

from tools.web_client import WebClient
from tools.debug_manager import setup_unified_logging, is_debug_enabled, log_error_with_context
from tools.lock_manager import get_lock_manager
from tools.similarity_lang import get_lang_config

# =============================================================================
# 代码同步模块（独立，不与数据同步耦合）
# =============================================================================

class CodeSync:
    """代码同步器 - 从Web后端同步AC代码到本地"""
    
    def __init__(self, config: Dict[str, Any], web_client: WebClient):
        """
        初始化代码同步器
        
        Args:
            config: 评测机配置
            web_client: Web客户端实例
        """
        self.config = config
        self.web_client = web_client
        self.logger = setup_unified_logging("CodeSync", config)
        
        # 获取代码存储目录
        # 优先使用配置中的 code_dir，否则使用固定的 /judge/code（容器内路径）
        # 如果都不存在，则从评测数据目录的父目录计算
        code_dir = self.config.get("judge", {}).get("code_dir")
        if code_dir and os.path.isabs(code_dir):
            self.code_base_dir = code_dir
        elif code_dir:
            # 相对路径，从项目根目录计算
            base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
            self.code_base_dir = os.path.join(base_dir, code_dir)
        else:
            # 默认使用 /judge/code（容器内路径，由启动脚本映射）
            # 默认使用 /judge/code（容器内路径，由启动脚本映射）
            default_code_dir = "/judge/code"
            if os.path.exists(default_code_dir):
                self.code_base_dir = default_code_dir
            else:
                # 如果默认目录不存在，从评测数据目录的父目录计算
                data_dir = self.config.get("judge", {}).get("data_dir", "data")
                if not os.path.isabs(data_dir):
                    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
                    data_dir = os.path.join(base_dir, data_dir)
                data_parent = os.path.dirname(data_dir)
                self.code_base_dir = os.path.join(data_parent, "code")
        
        os.makedirs(self.code_base_dir, exist_ok=True)
        self.logger.info(f"代码存储目录：{self.code_base_dir}")
        
        # 初始化锁管理器（用于多容器文件写入保护）
        self.lock_manager = get_lock_manager(logger=self.logger)
        
        # 全量同步频率控制
        # 全量同步标记文件：记录每个题目的最后全量同步时间
        self.full_sync_marker_dir = os.path.join(self.code_base_dir, '.sync_markers')
        os.makedirs(self.full_sync_marker_dir, exist_ok=True)
        self.full_sync_interval = 3600  # 全量同步间隔：3600秒（1小时）
    
    
    def sync_ac_codes(self, problem_id: int, max_solution_id: int = 0, 
                     exclude_user_id: str = '', force_full_sync: bool = False) -> Tuple[bool, int]:
        """
        同步题目的AC代码（优化版本：优先增量同步，降低全量同步频率）
        
        Args:
            problem_id: 题目ID
            max_solution_id: 只同步比这个ID小的代码（0表示不限制）
            exclude_user_id: 排除的用户ID
            force_full_sync: 是否强制全量同步
        
        Returns:
            (是否成功, 同步的代码数量)
        """
        try:
            # 获取本地最大solution_id
            local_max_solution_id = self.get_local_max_solution_id(problem_id)
            
            # 判断是否需要全量同步
            need_full_sync = force_full_sync
            if not force_full_sync:
                if self.should_full_sync(problem_id):
                    self.logger.info(f"检测到需要全量同步（目录异常或超过全量同步间隔）")
                    need_full_sync = True
            
            # 优化：优先使用增量同步
            # 如果本地最大solution_id >= 当前max_solution_id，说明本地已经是最新的，不需要同步
            if not need_full_sync and local_max_solution_id > 0:
                if local_max_solution_id >= max_solution_id:
                    self.logger.info(f"本地代码已是最新（本地最大solution_id={local_max_solution_id} >= 当前max_solution_id={max_solution_id}），跳过同步")
                    return True, 0
                else:
                    # 增量同步：只同步从本地最大solution_id到当前max_solution_id之间的代码
                    # 注意：这里使用local_max_solution_id作为min_solution_id，但后端API只支持max_solution_id
                    # 所以仍然使用max_solution_id，但记录增量同步的起始点
                    self.logger.info(f"执行增量同步：从本地最大solution_id={local_max_solution_id}到max_solution_id={max_solution_id}")
            
            # 全量同步时，仍然需要限制max_solution_id，避免同步当前提交自己的代码
            # 但全量同步会同步所有历史代码（从0到max_solution_id）
            if need_full_sync:
                self.logger.info(f"执行全量同步（max_solution_id={max_solution_id}）")
            
            self.logger.info(f"开始同步题目 {problem_id} 的AC代码（max_solution_id={max_solution_id}, exclude_user_id={exclude_user_id}, force_full_sync={need_full_sync}, 本地最大solution_id={local_max_solution_id}）")
            
            synced_count = 0
            page = 1
            page_size = 100  # 每页100条
            
            # 增量同步优化：使用 min_solution_id 只获取新增的代码
            # 这样可以大幅减少网络传输量
            min_solution_id_for_sync = 0
            if not need_full_sync and local_max_solution_id > 0:
                min_solution_id_for_sync = local_max_solution_id
                self.logger.info(f"使用增量同步优化：只获取 solution_id > {min_solution_id_for_sync} 的代码")
            
            while True:
                # 获取AC代码列表
                params = {
                    'problem_id': problem_id,
                    'page': page,
                    'page_size': page_size
                }
                if max_solution_id > 0:
                    params['max_solution_id'] = max_solution_id
                if min_solution_id_for_sync > 0:
                    params['min_solution_id'] = min_solution_id_for_sync
                if exclude_user_id:
                    params['exclude_user_id'] = exclude_user_id
                
                result = self.web_client._make_request('GET', 'get_ac_solutions', params=params)
                if not result or result.get('code') != 1:
                    self.logger.error(f"获取AC代码列表失败：{result}")
                    break
                
                data = result.get('data', {})
                code_list = data.get('list', [])
                has_more = data.get('has_more', False)
                
                if not code_list:
                    break
                
                # 保存每份代码
                for code_item in code_list:
                        solution_id = code_item.get('solution_id')
                        user_id = code_item.get('user_id', '')
                        language_id = code_item.get('language')  # 这是语言ID，需要转换为语言名称
                        code_content = code_item.get('code', '')
                        
                        if not solution_id or not code_content:
                            continue
                        
                        # 将语言ID转换为语言名称
                        # 语言ID映射：0=c, 1=cpp, 3=java, 6=python, 17=go
                        lang_id_map = {
                            0: 'c',
                            1: 'cpp',
                            3: 'java',
                            6: 'python',
                            17: 'go'
                        }
                        language = lang_id_map.get(int(language_id), 'cpp')
                        
                        # 获取代码路径（包含user_id）
                        lang_ext_map = {
                            'c': '.c',
                            'cpp': '.cpp',
                            'c++': '.cpp',
                            'java': '.java',
                            'python': '.py',
                            'python3': '.py',
                            'go': '.go',
                            'golang': '.go'
                        }
                        ext = lang_ext_map.get(language.lower(), '.txt')
                        
                        # 第一级：problem_id
                        problem_dir = os.path.join(self.code_base_dir, str(problem_id))
                        
                        # 第二级：solution_id / 10000 向下取整，补齐5位
                        prefix = solution_id // 10000
                        prefix_str = f"{prefix:05d}"
                        prefix_dir = os.path.join(problem_dir, prefix_str)
                        
                        # 第三级：代码文件 solution_id_user_id.ext
                        filename = f"{solution_id}_{user_id}{ext}"
                        code_path = os.path.join(prefix_dir, filename)
                        
                        # 检查是否需要更新
                        # 优化：增量同步时，跳过已存在的文件和旧代码
                        if not need_full_sync:
                            # 增量同步：跳过已存在的文件
                            if os.path.exists(code_path):
                                continue
                            # 增量同步：跳过solution_id <= local_max_solution_id的代码（这些代码已经在本地）
                            if local_max_solution_id > 0 and solution_id <= local_max_solution_id:
                                continue
                        else:
                            # 全量同步：如果文件存在，跳过（避免重复下载，除非需要强制更新）
                            if os.path.exists(code_path):
                                continue
                        
                        # 确保目录存在
                        os.makedirs(os.path.dirname(code_path), exist_ok=True)
                        
                        # 使用文件锁保护写入操作（避免多容器竞争）
                        # 以代码文件路径作为资源标识
                        if self.lock_manager.acquire_write_lock(code_path, timeout=30):
                            try:
                                # 保存代码文件
                                with open(code_path, 'w', encoding='utf-8') as f:
                                    f.write(code_content)
                                
                                synced_count += 1
                            finally:
                                # 释放锁
                                self.lock_manager.release_write_lock(code_path)
                        else:
                            # 获取锁失败，记录警告但继续处理下一个文件
                            self.logger.warning(f"无法获取文件锁，跳过保存代码文件: {code_path}")
                            continue
                
                if not has_more:
                    break
                
                page += 1
                # 避免请求过快
                time.sleep(0.1)
            
            self.logger.info(f"题目 {problem_id} 的AC代码同步完成，共同步 {synced_count} 份代码")
            
            # 如果是全量同步，更新标记文件
            if need_full_sync:
                self.mark_full_sync(problem_id)
            
            return True, synced_count
            
        except Exception as e:
            log_error_with_context(self.logger, "同步AC代码", e, {
                "problem_id": problem_id,
                "max_solution_id": max_solution_id
            })
            return False, 0
    
    def get_local_max_solution_id(self, problem_id: int) -> int:
        """
        获取本地代码目录中的最大solution_id
        
        Args:
            problem_id: 题目ID
        
        Returns:
            最大solution_id，如果目录不存在或没有文件则返回0
        """
        problem_dir = os.path.join(self.code_base_dir, str(problem_id))
        if not os.path.exists(problem_dir):
            return 0
        
        max_solution_id = 0
        for root, dirs, files in os.walk(problem_dir):
            for file in files:
                if not file.endswith(('.c', '.cpp', '.java', '.py', '.go')):
                    continue
                try:
                    file_parts = file.split('_')
                    if len(file_parts) >= 2:
                        solution_id = int(file_parts[0])
                        if solution_id > max_solution_id:
                            max_solution_id = solution_id
                except (ValueError, IndexError):
                    continue
        
        return max_solution_id
    
    def should_full_sync(self, problem_id: int) -> bool:
        """
        判断是否需要进行全量同步
        
        判断条件：
        1. 代码目录不存在或为空
        2. 代码文件数量异常少（可能文件受损）
        3. 距离上次全量同步时间过长（超过全量同步间隔）
        
        Args:
            problem_id: 题目ID
        
        Returns:
            是否需要全量同步
        """
        problem_dir = os.path.join(self.code_base_dir, str(problem_id))
        
        # 如果目录不存在，需要全量同步
        if not os.path.exists(problem_dir):
            return True
        
        # 统计代码文件数量
        code_count = 0
        for root, dirs, files in os.walk(problem_dir):
            for file in files:
                if file.endswith(('.c', '.cpp', '.java', '.py', '.go')):
                    code_count += 1
        
        # 如果代码文件少于10个，可能需要全量同步
        if code_count < 10:
            return True
        
        # 检查距离上次全量同步的时间
        marker_file = os.path.join(self.full_sync_marker_dir, f"{problem_id}.marker")
        if os.path.exists(marker_file):
            try:
                last_full_sync_time = os.path.getmtime(marker_file)
                elapsed = time.time() - last_full_sync_time
                if elapsed >= self.full_sync_interval:
                    # 超过全量同步间隔，需要全量同步
                    return True
            except OSError:
                # 无法读取标记文件，执行全量同步
                return True
        else:
            # 标记文件不存在，需要全量同步
            return True
        
        return False
    
    def mark_full_sync(self, problem_id: int):
        """
        标记已执行全量同步（更新标记文件的时间戳）
        
        Args:
            problem_id: 题目ID
        """
        marker_file = os.path.join(self.full_sync_marker_dir, f"{problem_id}.marker")
        try:
            # 创建或更新标记文件
            with open(marker_file, 'w') as f:
                f.write(str(time.time()))
        except Exception as e:
            if self.logger:
                self.logger.warning(f"更新全量同步标记文件失败 {marker_file}: {e}")

# =============================================================================
# Winnowing 快速查重模块（毫秒级，基于MOSS算法核心）
# =============================================================================

class WinnowingChecker:
    """基于 Winnowing 算法的快速代码查重器（MOSS算法核心，毫秒级，支持增量缓存）"""
    
    # 算法版本号：当算法实现发生变化时，需要更新此版本号，以自动清除旧缓存
    # 版本历史：
    # - 1.0: 初始版本（SimHash）
    # - 2.0: Winnowing算法（初始实现）
    # - 2.1: 改进的token提取和注释移除逻辑
    # - 2.2: 降低对变量名和函数名的依赖，增强代码结构相似性识别
    # - 2.3: 完全移除变量名组合token，增强结构性特征
    # - 3.0: 多语言支持（C/C++、Java、Python、Go），使用语言配置模块
    # - 3.1: 多粒度特征（细粒度k=5 + 粗粒度k=3），增强算法模式识别
    # - 3.2: 统一使用hashlib哈希函数，确保所有环境（容器内/外）缓存兼容
    # - 3.3: 归一化换行符（CRLF/LF）以避免仅换行差异导致指纹不一致（当前版本）
    ALGORITHM_VERSION = "3.3"
    
    # 常见算法模式特征
    ALGORITHM_PATTERNS = {
        # 图论算法
        'floyd': {
            'features': ['pattern_nested_loop_3plus', 'pattern_heavy_array_access'],
            'description': 'Floyd最短路算法（三重循环+数组访问）'
        },
        'dijkstra': {
            'features': ['container_heap', 'pattern_heavy_comparison', 'loop_style_while'],
            'description': 'Dijkstra最短路算法（优先队列+比较操作）'
        },
        'dfs': {
            'features': ['pattern_recursion', 'pattern_heavy_array_access'],
            'description': '深度优先搜索（递归+数组访问）'
        },
        'bfs': {
            'features': ['container_queue', 'loop_style_while', 'pattern_heavy_array_access'],
            'description': '广度优先搜索（队列+while循环）'
        },
        # 动态规划
        'dp_1d': {
            'features': ['pattern_nested_loop_1', 'pattern_heavy_array_access', 'pattern_heavy_comparison'],
            'description': '一维动态规划'
        },
        'dp_2d': {
            'features': ['pattern_nested_loop_2', 'pattern_heavy_array_access', 'pattern_heavy_comparison'],
            'description': '二维动态规划'
        },
        # 排序算法
        'sort_builtin': {
            'features': ['call_sort_func'],
            'description': '使用内置排序函数'
        },
        'sort_manual': {
            'features': ['pattern_nested_loop_2', 'pattern_heavy_comparison', 'stmt_swap'],
            'description': '手写排序算法'
        },
        # 二分查找
        'binary_search': {
            'features': ['loop_style_while', 'pattern_mid_calculation', 'pattern_heavy_comparison'],
            'description': '二分查找'
        },
    }
    
    def __init__(self, k: int = 5, w: int = 4, cache_dir: str = None, 
                 use_multi_granularity: bool = True, coarse_k: int = 3, coarse_w: int = 2):
        """
        初始化 Winnowing 查重器
        
        Args:
            k: k-gram大小（细粒度，建议5-7，默认5）
            w: 窗口大小（细粒度，建议4-5，默认4）
            cache_dir: 缓存目录路径（用于存储指纹缓存）
            use_multi_granularity: 是否使用多粒度特征（默认True）
            coarse_k: 粗粒度k-gram大小（建议3-4，默认3）
            coarse_w: 粗粒度窗口大小（建议2-3，默认2）
        """
        self.k = k
        self.w = w
        self.use_multi_granularity = use_multi_granularity
        self.coarse_k = coarse_k
        self.coarse_w = coarse_w
        self.code_fingerprints = {}  # {solution_id: set of fingerprints}
        self.fingerprint_index = defaultdict(set)  # {fingerprint: set(solution_id, ...)} 倒排索引
        self.cache_dir = cache_dir
        self.logger = None
        self.lock_manager = None  # 将在使用时设置，用于缓存文件的并发保护
        self._lang_config_cache = {}  # 语言配置缓存
        
        # 智能缓存复用：记录当前已加载的缓存状态
        self._loaded_problem_id = None  # 当前加载的题目ID
        self._loaded_max_solution_id = 0  # 当前加载的最大solution_id限制
        self._loaded_language = None  # 当前加载的语言
        self._full_cache_fingerprints = {}  # 完整缓存（不过滤max_solution_id）
        self._full_cache_loaded = False  # 是否已加载完整缓存
        self._solution_user_map = {}  # {solution_id: user_id} 用于排除特定用户的代码
    
    def set_logger(self, logger):
        """设置日志记录器"""
        self.logger = logger
    
    def set_lock_manager(self, lock_manager):
        """设置锁管理器（用于缓存文件的并发保护）"""
        self.lock_manager = lock_manager
    
    def _get_lang_config(self, language: str):
        """获取语言配置（带缓存）"""
        if language not in self._lang_config_cache:
            self._lang_config_cache[language] = get_lang_config(language)
        return self._lang_config_cache[language]
    
    def _winnowing_core(self, tokens: List[str], k: int, w: int) -> Set[int]:
        """
        Winnowing算法核心实现
        
        Args:
            tokens: token序列
            k: k-gram大小
            w: 窗口大小
        
        Returns:
            指纹集合
        """
        if len(tokens) < k:
            return set()
        
        fingerprints = set()
        window = []  # 滑动窗口：[(position, hash), ...]
        
        for i in range(len(tokens) - k + 1):
            # 提取k-gram
            kgram = tokens[i:i+k]
            kgram_str = '|'.join(kgram)  # 使用分隔符连接
            kgram_hash = self._hash_string(kgram_str)
            
            window.append((i, kgram_hash))
            
            # 当窗口满时，选择最小哈希值
            if len(window) == w:
                # 选择窗口中哈希值最小的（如果有多个相同的最小值，选择最右边的）
                min_hash = min(window, key=lambda x: (x[1], -x[0]))
                fingerprints.add(min_hash[1])
                
                # 移除窗口中最左边的元素
                window.pop(0)
        
        # 处理窗口末尾的剩余元素
        if window:
            min_hash = min(window, key=lambda x: (x[1], -x[0]))
            fingerprints.add(min_hash[1])
        
        return fingerprints

    def _normalize_newlines(self, code: str) -> str:
        """
        归一化换行符：
        - 将 Windows CRLF (\r\n) / 旧 Mac CR (\r) 统一为 LF (\n)
        目的：避免仅换行差异导致 token/特征提取不一致，从而出现相似度异常（如 89%）。
        """
        if not code:
            return ""
        # 先处理 CRLF，再处理残留 CR
        return code.replace("\r\n", "\n").replace("\r", "\n")
    
    def compute_fingerprints(self, code: str, language: str = 'cpp') -> Set[int]:
        """
        使用Winnowing算法计算代码指纹集合（支持多粒度特征）
        
        Winnowing算法步骤：
        1. 将代码转换为token序列（只包含实现细节）
        2. 生成k-gram
        3. 计算每个k-gram的哈希值
        4. 使用滑动窗口选择最小哈希值（保证局部性）
        
        多粒度特征：
        - 细粒度（k=5, w=4）：捕捉代码细节
        - 粗粒度（k=3, w=2）：捕捉代码结构，降低对顺序敏感度
        
        Args:
            code: 源代码字符串
            language: 编程语言（用于正确移除注释）
            
        Returns:
            指纹集合（set of integers）
        """
        # 0. 归一化换行，避免 CRLF/LF 仅格式差异导致指纹不一致
        code = self._normalize_newlines(code)

        # 1. 提取结构特征token序列
        tokens = self._extract_structural_tokens(code, language=language)
        
        if not tokens:
            return set()
        
        # 2. 细粒度指纹（原有逻辑）
        fine_fingerprints = self._winnowing_core(tokens, self.k, self.w)
        
        # 3. 粗粒度指纹（可选，提升对顺序变化的鲁棒性）
        if self.use_multi_granularity and len(tokens) >= self.coarse_k:
            coarse_fingerprints = self._winnowing_core(tokens, self.coarse_k, self.coarse_w)
            # 为粗粒度指纹添加前缀以区分
            coarse_fingerprints = {fp | 0x80000000 for fp in coarse_fingerprints}
            fine_fingerprints.update(coarse_fingerprints)
        
        # 4. 添加算法模式指纹
        algorithm_fingerprints = self._detect_algorithm_patterns(tokens, code, language)
        fine_fingerprints.update(algorithm_fingerprints)
        
        return fine_fingerprints
    
    def _detect_algorithm_patterns(self, tokens: List[str], code: str, language: str) -> Set[int]:
        """
        检测代码中的算法模式
        
        Args:
            tokens: token序列
            code: 源代码
            language: 编程语言
        
        Returns:
            算法模式指纹集合
        """
        fingerprints = set()
        token_set = set(tokens)
        
        # 检测每种算法模式
        for algo_name, algo_info in self.ALGORITHM_PATTERNS.items():
            required_features = algo_info['features']
            match_count = sum(1 for f in required_features if f in token_set)
            
            # 如果匹配超过一半的特征，认为是该算法模式
            if len(required_features) > 0 and match_count >= len(required_features) * 0.6:
                # 生成算法模式指纹
                algo_fingerprint = self._hash_string(f"algo_pattern_{algo_name}")
                fingerprints.add(algo_fingerprint)
        
        # 额外检测：递归模式
        if self._detect_recursion(code, language):
            fingerprints.add(self._hash_string("pattern_recursion"))
        
        # 额外检测：二分查找模式
        if self._detect_binary_search(code):
            fingerprints.add(self._hash_string("pattern_binary_search"))
        
        return fingerprints
    
    def _detect_recursion(self, code: str, language: str) -> bool:
        """检测代码中是否有递归"""
        # 提取函数名
        lang_config = self._get_lang_config(language)
        
        # 简单检测：函数内调用自身
        # 匹配函数定义
        func_pattern = lang_config.function_def_pattern or r'(?:def|void|int|bool|double|float|long|char)\s+(\w+)\s*\('
        func_matches = re.findall(func_pattern, code)
        
        for func_name in func_matches:
            if isinstance(func_name, tuple):
                func_name = func_name[1] if len(func_name) > 1 else func_name[0]
            # 检查函数体内是否调用自身
            if re.search(rf'\b{re.escape(func_name)}\s*\(', code):
                # 需要确保调用点不是定义点
                # 简单判断：如果函数名出现超过1次，可能是递归
                occurrences = len(re.findall(rf'\b{re.escape(func_name)}\s*\(', code))
                if occurrences > 1:
                    return True
        
        return False
    
    def _detect_binary_search(self, code: str) -> bool:
        """检测代码中是否有二分查找模式"""
        # 二分查找特征：
        # 1. while 循环
        # 2. mid = (left + right) / 2 或类似
        # 3. 比较和更新 left/right
        
        has_while = 'while' in code
        has_mid = re.search(r'\bmid\b.*=.*[\+\-\/]', code) or re.search(r'[\/\>\>]\s*2', code)
        has_lr = ('left' in code.lower() and 'right' in code.lower()) or \
                 ('low' in code.lower() and 'high' in code.lower()) or \
                 (re.search(r'\bl\b', code) and re.search(r'\br\b', code))
        
        return has_while and has_mid and has_lr
    
    def _hash_string(self, s: str) -> int:
        """
        计算字符串的哈希值（使用稳定的哈希函数）
        
        注意：Python 内置的 hash() 函数启用了哈希随机化（PYTHONHASHSEED），
        每次启动进程时会生成不同的哈希种子，导致缓存失效。
        
        重要：必须使用 hashlib 而不是 mmh3，确保所有环境（容器内/外）产生相同的哈希值。
        mmh3 虽然速度快，但如果某些环境没有安装 mmh3，会导致缓存不兼容问题。
        """
        import hashlib
        # 使用 MD5 的前4字节作为哈希值（足够区分不同字符串）
        hash_bytes = hashlib.md5(s.encode('utf-8')).digest()[:4]
        return int.from_bytes(hash_bytes, 'little') & 0x7FFFFFFF
    
    def _remove_comments(self, code: str, language: str = 'cpp') -> str:
        """
        稳健地移除代码中的注释（使用状态机处理字符串、字符常量和注释）
        
        Args:
            code: 源代码字符串
            language: 编程语言（用于确定注释格式）
            
        Returns:
            移除注释后的代码
        """
        if not code:
            return ""
        
        result = []
        i = 0
        in_string = False
        in_char = False
        in_single_comment = False  # // 或 #
        in_block_comment = False  # /* */
        string_char = None  # ' 或 "
        
        # 根据语言确定注释格式
        language_lower = language.lower() if language else 'cpp'
        if language_lower in ['python', 'python3']:
            comment_chars = ['#']
            block_comment_start = None
            block_comment_end = None
        elif language_lower in ['java', 'c', 'cpp', 'c++']:
            comment_chars = ['//']
            block_comment_start = '/*'
            block_comment_end = '*/'
        elif language_lower in ['go', 'golang']:
            comment_chars = ['//']
            block_comment_start = '/*'
            block_comment_end = '*/'
        else:
            # 默认C/C++风格
            comment_chars = ['//']
            block_comment_start = '/*'
            block_comment_end = '*/'
        
        while i < len(code):
            char = code[i]
            next_char = code[i+1] if i+1 < len(code) else None
            
            # 处理字符串和字符常量（避免误识别字符串中的注释符号）
            if not in_single_comment and not in_block_comment:
                if char in ['"', "'"]:
                    # 检查是否是转义的引号
                    is_escaped = False
                    if i > 0:
                        # 检查前一个字符是否是转义符
                        backslash_count = 0
                        j = i - 1
                        while j >= 0 and code[j] == '\\':
                            backslash_count += 1
                            j -= 1
                        is_escaped = (backslash_count % 2 == 1)
                    
                    if not is_escaped:
                        if not in_string and not in_char:
                            # 开始字符串或字符常量
                            if char == '"':
                                in_string = True
                                string_char = '"'
                            else:
                                in_char = True
                                string_char = "'"
                            result.append(char)
                            i += 1
                            continue
                        elif (in_string and char == '"') or (in_char and char == "'"):
                            # 结束字符串或字符常量
                            in_string = False
                            in_char = False
                            string_char = None
                            result.append(char)
                            i += 1
                            continue
            
            # 如果在字符串或字符常量中，直接添加字符
            if in_string or in_char:
                result.append(char)
                i += 1
                continue
            
            # 处理单行注释
            if not in_block_comment:
                # C/C++/Java/Go 单行注释
                if '//' in comment_chars and char == '/' and next_char == '/':
                    in_single_comment = True
                    i += 2
                    continue
                # Python 单行注释
                elif '#' in comment_chars and char == '#':
                    in_single_comment = True
                    i += 1
                    continue
            
            # 处理块注释
            if not in_single_comment and block_comment_start:
                if char == '/' and next_char == '*':
                    in_block_comment = True
                    i += 2
                    continue
                elif in_block_comment and char == '*' and next_char == '/':
                    in_block_comment = False
                    i += 2
                    continue
            
            # 如果在注释中，跳过字符
            if in_single_comment or in_block_comment:
                # 单行注释遇到换行符时结束
                if in_single_comment and char == '\n':
                    in_single_comment = False
                    result.append(char)  # 保留换行符
                i += 1
                continue
            
            # 正常字符
            result.append(char)
            i += 1
        
        return ''.join(result)
    
    def _extract_structural_tokens(self, code: str, language: str = 'cpp') -> List[str]:
        """
        提取代码结构特征token序列（使用语言配置模块，完全不依赖变量名）
        
        特征类型：
        1. 函数定义模式（参数数量，不含函数名）
        2. 变量声明类型模式（类型，不含变量名）
        3. 控制流结构（循环、条件、分支）
        4. 代码复杂度特征
        5. 算法模式特征
        6. 语言特定特征
        
        Args:
            code: 源代码字符串
            language: 编程语言
        
        Returns:
            token序列列表
        """
        if not code:
            return []
        
        # 获取语言配置
        lang_config = self._get_lang_config(language)
        keywords = lang_config.keywords
        primitive_types = lang_config.primitive_types
        
        # 移除注释（使用稳健的方法）
        code_no_comments = self._remove_comments(code, language=language)
        
        # 按行处理
        lines = []
        for line in code_no_comments.split('\n'):
            line = line.strip()
            if line:
                lines.append(line)
        
        tokens = []
        variable_count = 0
        function_count = 0
        function_calls_count = 0
        
        # ===== 1. 逐行提取结构特征 =====
        for line in lines:
            # 1.1 函数定义检测
            is_func, param_count = lang_config.is_function_definition(line)
            if is_func and param_count is not None:
                function_count += 1
                tokens.append(f"func_def_{param_count}")
            
            # 1.2 变量声明检测
            is_var, var_type = lang_config.is_variable_declaration(line)
            if is_var and var_type:
                variable_count += 1
                tokens.append(f"var_decl_{var_type.lower()}")
            
            # 1.3 控制流结构
            if '=' in line and '==' not in line and '!=' not in line:
                tokens.append("stmt_assign")
            if '[' in line and ']' in line:
                tokens.append("stmt_array_access")
            if re.match(r'\s*if\s*[\(\:]', line):
                tokens.append("stmt_if")
            if re.match(r'\s*else\b', line):
                tokens.append("stmt_else")
            if re.match(r'\s*for\s*[\(\:]', line):
                tokens.append("stmt_for")
            if re.match(r'\s*while\s*[\(\:]', line):
                tokens.append("stmt_while")
            if re.match(r'\s*(switch|match)\s*[\(\:]', line):
                tokens.append("stmt_switch")
            if re.search(r'\breturn\b', line):
                tokens.append("stmt_return")
            if re.search(r'\bbreak\b', line):
                tokens.append("stmt_break")
            if re.search(r'\bcontinue\b', line):
                tokens.append("stmt_continue")
            
            # 1.4 函数调用（通用检测，不含具体函数名）
            # 检测括号调用模式，但排除控制流关键字
            call_matches = re.findall(r'\b(\w+)\s*\(', line)
            for call_name in call_matches:
                if call_name.lower() not in keywords and call_name.lower() not in {'if', 'for', 'while', 'switch', 'catch'}:
                    function_calls_count += 1
                    tokens.append("call_func")
                    # 检测是否调用排序函数
                    if call_name.lower() in {'sort', 'qsort', 'stable_sort', 'sorted', 'arrays.sort', 'collections.sort'}:
                        tokens.append("call_sort_func")
            
            # 1.5 运算符模式
            if re.search(r'\+\+|\-\-', line):
                tokens.append("op_increment")
            if re.search(r'[+\-*/%]=', line):
                tokens.append("op_compound_assign")
            if re.search(r'<<|>>', line):
                tokens.append("op_bitshift")
            if re.search(r'&&|\|\|', line):
                tokens.append("op_logical")
            
            # 1.6 swap 操作检测
            if 'swap' in line.lower() or re.search(r'(\w+)\s*=\s*(\w+)\s*;\s*\2\s*=', line):
                tokens.append("stmt_swap")
        
        # ===== 2. 全局代码特征 =====
        code_text = '\n'.join(lines)
        
        # 2.1 循环类型统计
        loop_counts = lang_config.count_loops(lines)
        has_for = loop_counts.get('for', 0) > 0
        has_while = loop_counts.get('while', 0) > 0
        has_do = loop_counts.get('do', 0) > 0
        
        if has_for:
            tokens.append("loop_style_for")
        if has_while:
            tokens.append("loop_style_while")
        if has_do:
            tokens.append("loop_style_do")
        if has_for and has_while:
            tokens.append("pattern_mixed_loops")
        
        # 2.2 条件语句统计
        cond_counts = lang_config.count_conditionals(lines)
        if_count = cond_counts.get('if', 0)
        switch_count = cond_counts.get('switch', 0)
        
        tokens.append(f"complexity_if_{min(if_count, 10)}")
        if switch_count > 0:
            tokens.append(f"complexity_switch_{min(switch_count, 5)}")
        
        # 2.3 循环嵌套深度检测（改进版：使用大括号计数）
        max_nested_depth = self._detect_loop_nesting(lines)
        if max_nested_depth >= 3:
            tokens.append("pattern_nested_loop_3plus")
        elif max_nested_depth == 2:
            tokens.append("pattern_nested_loop_2")
        elif max_nested_depth == 1:
            tokens.append("pattern_nested_loop_1")
        
        # 2.4 数组/容器操作模式
        array_access_count = sum(1 for line in lines if '[' in line and ']' in line)
        if array_access_count >= 10:
            tokens.append("pattern_heavy_array_access")
        elif array_access_count >= 5:
            tokens.append("pattern_moderate_array_access")
        
        # 2.5 比较操作模式
        comparison_count = sum(1 for line in lines for op in ['>', '<', '>=', '<=', '==', '!='] if op in line)
        if comparison_count >= 10:
            tokens.append("pattern_heavy_comparison")
        elif comparison_count >= 5:
            tokens.append("pattern_moderate_comparison")
        
        # 2.6 数学运算模式
        math_ops = sum(1 for line in lines for op in ['*', '/', '%'] if op in line)
        if math_ops >= 10:
            tokens.append("pattern_heavy_math")
        elif math_ops >= 5:
            tokens.append("pattern_moderate_math")
        
        # 2.7 mid 计算检测（二分查找特征）
        if re.search(r'\bmid\b.*=', code_text) or re.search(r'[\/\>\>]\s*2', code_text):
            tokens.append("pattern_mid_calculation")
        
        # 2.8 容器类型使用
        container_tokens = lang_config.detect_container_usage(lines)
        tokens.extend(container_tokens)
        
        # 检测队列（BFS特征）
        if any('queue' in line.lower() for line in lines):
            tokens.append("container_queue")
        # 检测优先队列/堆（Dijkstra特征）
        if any('priority' in line.lower() or 'heap' in line.lower() for line in lines):
            tokens.append("container_heap")
        
        # 2.9 语言特定特征
        lang_specific_tokens = lang_config.get_language_specific_tokens(lines)
        tokens.extend(lang_specific_tokens)
        
        # ===== 3. 统计特征（不依赖具体名称）=====
        # 3.1 代码规模
        code_length_range = len(code_no_comments) // 500
        tokens.append(f"code_length_range_{code_length_range}")
        
        # 3.2 函数数量范围
        if function_count > 0:
            tokens.append("code_style_function")
            tokens.append(f"func_count_{min(function_count, 10)}")
        else:
            tokens.append("code_style_inline")
        
        # 3.3 变量数量范围（每5个一档）
        if variable_count >= 2:
            var_count_range = variable_count // 5
            tokens.append(f"var_count_range_{var_count_range}")
        
        # 3.4 函数调用密度
        if function_calls_count > 0:
            tokens.append(f"func_call_count_{min(function_calls_count, 20)}")
        
        # 3.5 循环总数
        total_loops = sum(loop_counts.values())
        tokens.append(f"complexity_loop_{min(total_loops, 10)}")
        
        return tokens
    
    def _detect_loop_nesting(self, lines: List[str]) -> int:
        """
        检测循环嵌套深度（改进版）
        
        使用简化的大括号计数法检测嵌套深度
        
        Args:
            lines: 代码行列表
        
        Returns:
            最大嵌套深度
        """
        max_depth = 0
        current_depth = 0
        in_loop = False
        loop_depth = 0
        
        for line in lines:
            # 检测循环开始
            if re.match(r'\s*(for|while|do)\s*[\(\{]', line):
                loop_depth += 1
                max_depth = max(max_depth, loop_depth)
            
            # 检测大括号
            open_braces = line.count('{')
            close_braces = line.count('}')
            
            current_depth += open_braces - close_braces
            
            # 如果深度减少到0，重置循环深度
            if current_depth <= 0:
                loop_depth = 0
                current_depth = 0
        
        return max_depth
    
    def similarity_score(self, fp1: Set[int], fp2: Set[int]) -> float:
        """
        计算Jaccard相似度（交集/并集）
        Winnowing算法使用Jaccard相似度更准确
        
        Args:
            fp1: 第一个代码的指纹集合
            fp2: 第二个代码的指纹集合
            
        Returns:
            相似度分数（0-100，100表示完全相同）
        """
        if not fp1 or not fp2:
            return 0.0
        
        intersection = len(fp1 & fp2)
        union = len(fp1 | fp2)
        
        if union == 0:
            return 0.0
        
        # Jaccard相似度 = 交集 / 并集
        jaccard = intersection / union
        return jaccard * 100.0
    
    def find_similar_codes(self, new_code: str, threshold: float = 80.0, 
                          top_k: int = 10, language: str = 'cpp') -> List[Dict[str, Any]]:
        """
        在已存储的代码中查找与新代码相似的代码（高性能版本，支持倒排索引）
        
        Args:
            new_code: 新代码字符串
            threshold: 相似度阈值（0-100）
            top_k: 返回前 k 个最相似的代码
            language: 编程语言（用于正确移除注释）
            
        Returns:
            相似代码列表，格式：[{'solution_id': xxx, 'similarity': xxx}, ...]
        """
        import time
        import heapq
        start_time = time.time()
        
        # 1. 计算新代码的指纹集合
        new_fingerprints = self.compute_fingerprints(new_code, language=language)
        hash_time = time.time() - start_time
        
        if not new_fingerprints:
            return []
        
        # 2. 使用倒排索引快速筛选候选代码
        compare_start = time.time()
        candidate_solution_ids = set()
        
        # 通过倒排索引找到与新代码有共同指纹的候选代码
        for fp in new_fingerprints:
            candidate_solution_ids.update(self.fingerprint_index.get(fp, set()))
        
        # 如果候选集太大（超过总数的50%），回退到全量比较
        if len(candidate_solution_ids) > len(self.code_fingerprints) * 0.5:
            candidate_solution_ids = set(self.code_fingerprints.keys())
        
        bucket_filter_time = time.time() - compare_start
        
        # 3. 对候选代码进行精确比较
        similarities = []
        exact_compare_start = time.time()
        
        for solution_id in candidate_solution_ids:
            stored_fingerprints = self.code_fingerprints.get(solution_id)
            if not stored_fingerprints:
                continue
            
            # 计算Jaccard相似度
            similarity = self.similarity_score(new_fingerprints, stored_fingerprints)
            
            if similarity >= threshold:
                similarities.append({
                    'solution_id': solution_id,
                    'similarity': round(similarity, 2)
                })
        
        exact_compare_time = time.time() - exact_compare_start
        compare_time = time.time() - compare_start
        
        # 4. 按相似度排序，返回 top-k
        if len(similarities) > top_k * 2:
            # 使用堆排序只保留top_k
            heap = []
            for item in similarities:
                similarity = item['similarity']
                solution_id = item['solution_id']
                heap_item = (-similarity, solution_id, item)
                if len(heap) < top_k:
                    heapq.heappush(heap, heap_item)
                elif similarity > -heap[0][0]:
                    heapq.heapreplace(heap, heap_item)
            result = [item for _, _, item in sorted(heap, key=lambda x: (-x[0], x[1]))]
        else:
            similarities.sort(key=lambda x: (-x['similarity'], x['solution_id']))
            result = similarities[:top_k]
        
        total_time = time.time() - start_time
        
        if self.logger:
            self.logger.info(f"Winnowing 查重性能: 总耗时={total_time*1000:.2f}ms, "
                           f"指纹计算={hash_time*1000:.2f}ms, "
                           f"索引筛选={bucket_filter_time*1000:.2f}ms (候选: {len(candidate_solution_ids)}/{len(self.code_fingerprints)}), "
                           f"精确比较={exact_compare_time*1000:.2f}ms, "
                           f"找到{len(result)}个相似代码")
        
        return result
    
    def add_code(self, solution_id: int, code: str, language: str = 'cpp'):
        """添加代码到索引"""
        fingerprints = self.compute_fingerprints(code, language=language)
        self.code_fingerprints[solution_id] = fingerprints
        
        # 更新倒排索引
        for fp in fingerprints:
            self.fingerprint_index[fp].add(solution_id)
    
    def batch_add_codes(self, codes: Dict[int, str], language: str = 'cpp'):
        """批量添加代码"""
        for solution_id, code in codes.items():
            self.add_code(solution_id, code, language=language)
    
    def _load_cache(self, cache_file: str) -> Optional[Dict[str, Any]]:
        """加载指纹缓存文件"""
        if not os.path.exists(cache_file):
            return None
        
        try:
            with open(cache_file, 'r', encoding='utf-8') as f:
                cache_data = json.load(f)
            
            if not isinstance(cache_data, dict) or 'fingerprints' not in cache_data:
                if self.logger:
                    self.logger.warning(f"缓存文件格式无效: {cache_file}")
                return None
            
            # 检查版本
            if cache_data.get('version') != 2:
                if self.logger:
                    self.logger.warning(f"缓存文件版本不匹配: {cache_file}, 期望版本2，实际版本{cache_data.get('version')}")
                return None

            # 检查算法版本号（算法变更时必须自动失效旧缓存）
            if cache_data.get('algorithm_version') != self.ALGORITHM_VERSION:
                if self.logger:
                    self.logger.warning(
                        f"缓存文件算法版本不匹配: {cache_file}, "
                        f"期望{self.ALGORITHM_VERSION}，实际{cache_data.get('algorithm_version')}"
                    )
                return None

            # 检查关键参数（避免 k/w 变化但错误复用旧缓存）
            if int(cache_data.get('k', -1)) != int(self.k) or int(cache_data.get('w', -1)) != int(self.w):
                if self.logger:
                    self.logger.warning(
                        f"缓存文件参数不匹配: {cache_file}, "
                        f"期望k={self.k},w={self.w}，实际k={cache_data.get('k')},w={cache_data.get('w')}"
                    )
                return None
            
            return cache_data
        except (json.JSONDecodeError, IOError) as e:
            if self.logger:
                self.logger.warning(f"加载缓存文件失败 {cache_file}: {e}")
            return None
    
    def _save_cache(self, cache_file: str, solution_ids: List[int], 
                    fingerprints: Dict[int, Set[int]], fingerprint_index: Dict[int, List[int]]):
        """
        保存指纹缓存到文件（带并发保护）
        
        使用文件锁保护写入操作，避免多容器同时写入导致缓存文件损坏
        """
        try:
            os.makedirs(os.path.dirname(cache_file), exist_ok=True)
            
            cache_data = {
                'version': 2,  # 版本2：Winnowing算法
                'algorithm_version': self.ALGORITHM_VERSION,  # 算法版本号，用于检测算法变化
                'k': self.k,
                'w': self.w,
                'solution_ids': sorted(solution_ids),
                'fingerprints': {str(sid): sorted(list(fps)) for sid, fps in fingerprints.items()},
                'fingerprint_index': {str(fp): sorted(sids) for fp, sids in fingerprint_index.items()},
                'solution_user_map': {str(sid): uid for sid, uid in self._solution_user_map.items()},
                'last_updated': time.strftime('%Y-%m-%dT%H:%M:%S')
            }
            
            # 使用文件锁保护写入操作（避免多容器竞争）
            if self.lock_manager:
                if self.lock_manager.acquire_write_lock(cache_file, timeout=30):
                    try:
                        temp_file = cache_file + '.tmp'
                        with open(temp_file, 'w', encoding='utf-8') as f:
                            json.dump(cache_data, f, indent=2, ensure_ascii=False)
                        
                        os.replace(temp_file, cache_file)
                        
                        if self.logger:
                            self.logger.debug(f"Winnowing指纹缓存已保存: {cache_file}, {len(solution_ids)}个代码")
                    finally:
                        self.lock_manager.release_write_lock(cache_file)
                else:
                    if self.logger:
                        self.logger.warning(f"无法获取缓存文件写锁，跳过保存: {cache_file}")
            else:
                # 没有锁管理器，使用原子写入（临时文件+replace）
                temp_file = cache_file + '.tmp'
                with open(temp_file, 'w', encoding='utf-8') as f:
                    json.dump(cache_data, f, indent=2, ensure_ascii=False)
                
                os.replace(temp_file, cache_file)
                
                if self.logger:
                    self.logger.debug(f"Winnowing指纹缓存已保存: {cache_file}, {len(solution_ids)}个代码")
        except Exception as e:
            if self.logger:
                self.logger.warning(f"保存缓存文件失败 {cache_file}: {e}")
    
    def load_codes_from_directory(self, code_dir: str, problem_id: int, 
                                  max_solution_id: int = 0, exclude_user_id: str = '',
                                  language: str = ''):
        """
        从目录加载代码并计算指纹（支持增量缓存 + 智能复用）
        
        智能缓存复用策略：
        1. 如果 problem_id 和 language 相同，且 max_solution_id <= 已加载的值，直接复用内存中的过滤结果
        2. 如果 problem_id 和 language 相同，但 max_solution_id 增大，从完整缓存中增量加载
        3. 否则重新加载缓存
        
        Args:
            code_dir: 代码目录路径
            problem_id: 题目ID
            max_solution_id: 只加载比这个ID小的代码
            exclude_user_id: 排除的用户ID
            language: 编程语言（必须指定）
        """
        # 智能缓存复用检查
        can_reuse = False
        need_incremental_load = False
        
        if (self._loaded_problem_id == problem_id and 
            self._loaded_language == language and 
            self._full_cache_loaded):
            
            if max_solution_id <= self._loaded_max_solution_id and max_solution_id > 0:
                # 场景1：max_solution_id 变小或相等，可以直接复用当前内存数据
                # 只需重新过滤即可
                if self.logger:
                    self.logger.debug(f"智能缓存复用：max_solution_id从{self._loaded_max_solution_id}变为{max_solution_id}，重新过滤内存数据")
                can_reuse = True
                # 从完整缓存重新过滤
                self.code_fingerprints.clear()
                self.fingerprint_index.clear()
                for solution_id, fps in self._full_cache_fingerprints.items():
                    if max_solution_id > 0 and solution_id >= max_solution_id:
                        continue
                    if exclude_user_id and self._solution_user_map.get(solution_id) == exclude_user_id:
                        continue
                    self.code_fingerprints[solution_id] = fps
                    for fp in fps:
                        self.fingerprint_index[fp].add(solution_id)
                self._loaded_max_solution_id = max_solution_id
                
            elif max_solution_id > self._loaded_max_solution_id or max_solution_id == 0:
                # 场景2：max_solution_id 增大，需要增量加载新代码
                if self.logger:
                    self.logger.debug(f"智能缓存复用：max_solution_id从{self._loaded_max_solution_id}增大到{max_solution_id}，增量加载")
                need_incremental_load = True
                # 保留当前数据，只需要加载新增的部分
        
        if can_reuse and not need_incremental_load:
            if self.logger:
                self.logger.info(f"智能缓存复用成功：problem_id={problem_id}, max_solution_id={max_solution_id}, 内存中有{len(self.code_fingerprints)}份指纹")
            return
        
        if not need_incremental_load:
            # 完全重新加载
            self.code_fingerprints.clear()
            self.fingerprint_index.clear()
            self._full_cache_fingerprints.clear()
            self._full_cache_loaded = False
            self._loaded_problem_id = problem_id
            self._loaded_language = language
        
        if not os.path.exists(code_dir):
            if self.logger:
                self.logger.warning(f"代码目录不存在: {code_dir}")
            return
        
        # 必须指定语言
        if not language:
            if self.logger:
                self.logger.error(f"未指定编程语言，无法加载代码（problem_id={problem_id}）")
            return
        
        # 根据语言确定需要加载的文件扩展名（需要在缓存验证之前定义）
        language_lower = language.lower()
        if language_lower in ['python', 'python3']:
            allowed_extensions = ('.py',)
        elif language_lower == 'java':
            allowed_extensions = ('.java',)
        elif language_lower in ['c', 'cpp', 'c++']:
            allowed_extensions = ('.c', '.cpp')
        elif language_lower in ['go', 'golang']:
            allowed_extensions = ('.go',)
        else:
            if self.logger:
                self.logger.error(f"不支持的编程语言: {language}")
            return
        
        # 尝试加载缓存（带并发保护）
        cache_file = None
        cached_fingerprints = {}
        cached_solution_ids = set()
        if self.cache_dir:
            cache_dir_path = os.path.join(self.cache_dir, str(problem_id))
            cache_file = os.path.join(cache_dir_path, f'.winnowing_cache_{language.lower()}.json')
            
            # 使用读锁保护缓存读取（避免读取时文件被写入）
            cache_data = None
            if self.lock_manager and os.path.exists(cache_file):
                if self.lock_manager.acquire_read_lock(cache_file, timeout=10):
                    try:
                        cache_data = self._load_cache(cache_file)
                    finally:
                        self.lock_manager.release_read_lock(cache_file)
                else:
                    # 获取读锁失败，尝试不加锁读取（可能文件正在被写入）
                    if self.logger:
                        self.logger.debug(f"无法获取缓存文件读锁，尝试不加锁读取: {cache_file}")
                    cache_data = self._load_cache(cache_file)
            else:
                cache_data = self._load_cache(cache_file)
            if cache_data and cache_data.get('version') == 2:
                # 首先检查算法版本号（最严格的检查）
                cached_algorithm_version = cache_data.get('algorithm_version', '1.0')
                if cached_algorithm_version != self.ALGORITHM_VERSION:
                    if self.logger:
                        self.logger.warning(f"缓存算法版本不匹配（缓存: {cached_algorithm_version}, 当前: {self.ALGORITHM_VERSION}），清除缓存")
                    # 删除缓存文件，强制重新计算
                    try:
                        os.remove(cache_file)
                    except Exception as e:
                        if self.logger:
                            self.logger.warning(f"删除缓存文件失败: {e}")
                    # 清除缓存数据，跳过后续加载逻辑
                    cache_data = None
                    cached_fingerprints = {}
                    cached_solution_ids = set()
                # 验证k和w是否匹配
                elif cache_data.get('k') == self.k and cache_data.get('w') == self.w:
                    cached_fingerprints = {int(sid): set(int(fp) for fp in fps) 
                                         for sid, fps in cache_data.get('fingerprints', {}).items()}
                    cached_solution_ids = set(cached_fingerprints.keys())
                    
                    # 从缓存加载 solution_id → user_id 映射（用于排除用户过滤）
                    cached_user_map = cache_data.get('solution_user_map', {})
                    for sid_str, uid in cached_user_map.items():
                        try:
                            self._solution_user_map[int(sid_str)] = uid
                        except (ValueError, TypeError):
                            pass
                    
                    # 验证缓存有效性：随机选择几个代码文件，重新计算指纹，检查是否一致
                    # 如果缓存中的指纹与重新计算的不一致，说明算法有变化，需要清除缓存
                    cache_valid = True  # 标记缓存是否有效，用于后续的增量更新逻辑
                    if cached_solution_ids and os.path.exists(code_dir):
                        # 随机选择验证样本：至少3个，最多10个，或缓存总数的10%（取较大值）
                        import random
                        sample_size = max(3, min(10, max(5, len(cached_solution_ids) // 10)))
                        sample_size = min(sample_size, len(cached_solution_ids))
                        sample_sids = random.sample(list(cached_solution_ids), sample_size)
                        verified_count = 0
                        mismatch_count = 0
                        zero_common_count = 0  # 共同指纹为0的样本数（说明算法发生了重大变化）
                        
                        for sample_sid in sample_sids:
                            # 查找对应的文件
                            found_file = None
                            for root, dirs, files in os.walk(code_dir):
                                for file in files:
                                    if not file.endswith(allowed_extensions):
                                        continue
                                    try:
                                        file_parts = file.split('_')
                                        if len(file_parts) >= 2 and int(file_parts[0]) == sample_sid:
                                            found_file = os.path.join(root, file)
                                            break
                                    except (ValueError, IndexError):
                                        continue
                                if found_file:
                                    break
                            
                            if found_file and os.path.exists(found_file):
                                try:
                                    with open(found_file, 'r', encoding='utf-8', errors='ignore') as f:
                                        code = f.read()
                                    # 重新计算指纹
                                    new_fp = self.compute_fingerprints(code, language=language)
                                    cached_fp = cached_fingerprints.get(sample_sid, set())
                                    
                                    verified_count += 1
                                    if new_fp != cached_fp:
                                        mismatch_count += 1
                                        # 检查共同指纹数量
                                        common_fp = len(new_fp & cached_fp)
                                        if common_fp == 0:
                                            zero_common_count += 1
                                        if self.logger and mismatch_count == 1:
                                            self.logger.warning(f"缓存验证失败：solution_id={sample_sid} 的指纹不匹配（缓存: {len(cached_fp)}, 重新计算: {len(new_fp)}, 共同指纹: {common_fp}），缓存可能已失效")
                                except Exception as e:
                                    if self.logger:
                                        self.logger.debug(f"验证缓存时读取文件失败 {found_file}: {e}")
                        
                        # 如果所有样本的共同指纹都为0，说明算法发生了重大变化，直接清除缓存
                        if verified_count > 0 and zero_common_count == verified_count:
                            cache_valid = False
                            if self.logger:
                                self.logger.warning(f"缓存验证失败：所有 {verified_count} 个样本的共同指纹都为0，说明算法发生了重大变化，清除缓存")
                        # 如果超过20%的样本不匹配，认为缓存无效
                        elif verified_count > 0 and mismatch_count / verified_count > 0.2:
                            cache_valid = False
                            if self.logger:
                                self.logger.warning(f"缓存验证失败：{mismatch_count}/{verified_count} 个样本不匹配，缓存已失效，将重新计算所有指纹")
                    
                    if cache_valid:
                        # 缓存有效，倒排索引的恢复会在后面统一处理（确保与内存中的指纹一致）
                        if self.logger:
                            self.logger.info(f"缓存验证通过，将加载 {len(cached_fingerprints)} 个Winnowing指纹（增量更新模式）")
                    else:
                        # 缓存无效，清除
                        cached_fingerprints = {}
                        cached_solution_ids = set()
                        # 删除缓存文件，强制重新计算
                        try:
                            os.remove(cache_file)
                            if self.logger:
                                self.logger.info(f"已删除无效的缓存文件: {cache_file}")
                        except Exception as e:
                            if self.logger:
                                self.logger.warning(f"删除缓存文件失败: {e}")
                else:
                    # k或w不匹配，缓存无效，需要重新计算
                    if self.logger:
                        self.logger.warning(f"缓存文件参数不匹配（k={cache_data.get('k')}, w={cache_data.get('w')}），忽略缓存，将重新计算所有指纹")
                    cached_fingerprints = {}
                    cached_solution_ids = set()
        
        # 将缓存的指纹添加到内存
        # 策略：先保存完整缓存（用于智能复用），再按条件过滤到工作内存
        for solution_id, fps in cached_fingerprints.items():
            # 保存到完整缓存（不过滤）
            self._full_cache_fingerprints[solution_id] = fps
            
            # 按条件过滤后添加到工作内存
            if max_solution_id > 0 and solution_id >= max_solution_id:
                continue
            # exclude_user_id 的过滤在方法末尾统一执行（缓存保存之后），确保缓存保留完整数据
            self.code_fingerprints[solution_id] = fps
        
        # 增量更新：恢复倒排索引（确保与内存中的指纹一致）
        # 注意：这里统一重建倒排索引，而不是从缓存恢复，确保索引与内存中的指纹完全一致
        # 这样可以避免缓存中的索引与内存中的指纹不一致的问题
        if cached_fingerprints:
            # 从缓存的倒排索引恢复（快速路径）
            if cache_data and cache_data.get('version') == 2 and cache_valid:
                # 只恢复已加载到内存的指纹对应的索引
                for solution_id in self.code_fingerprints.keys():
                    fps = self.code_fingerprints[solution_id]
                    for fp in fps:
                        self.fingerprint_index[fp].add(solution_id)
            else:
                # 缓存无效或不存在，重新构建倒排索引
                self.fingerprint_index.clear()
                for solution_id, fps in self.code_fingerprints.items():
                    for fp in fps:
                        self.fingerprint_index[fp].add(solution_id)
        
        # 收集需要处理的文件（增量更新 + 缓存验证）
        files_to_process = []  # 新文件，需要计算
        files_to_verify = []  # 缓存中存在但需要验证的文件（文件可能已更新）
        cache_file_mtime = os.path.getmtime(cache_file) if cache_file and os.path.exists(cache_file) else 0
        
        for root, dirs, files in os.walk(code_dir):
            for file in files:
                if not file.endswith(allowed_extensions):
                    continue
                
                try:
                    file_parts = file.split('_')
                    if len(file_parts) < 2:
                        continue
                    
                    file_solution_id = int(file_parts[0])
                    file_path = os.path.join(root, file)
                    
                    # 从文件名提取 user_id（格式: {solution_id}_{user_id}.{ext}）
                    file_user_id = '_'.join(file_parts[1:])
                    dot_pos = file_user_id.rfind('.')
                    if dot_pos > 0:
                        file_user_id = file_user_id[:dot_pos]
                    self._solution_user_map[file_solution_id] = file_user_id
                    
                    if max_solution_id > 0 and file_solution_id >= max_solution_id:
                        continue
                    
                    if exclude_user_id and file_user_id == exclude_user_id:
                        continue
                    
                    # 如果文件在缓存中，检查文件是否被更新
                    if file_solution_id in cached_solution_ids:
                        # 检查文件是否存在
                        if not os.path.exists(file_path):
                            # 文件不存在，缓存中的记录无效，跳过（会在后面清理）
                            continue
                        
                        # 检查文件修改时间（使用更严格的条件：文件时间必须早于或等于缓存时间）
                        # 如果文件时间晚于缓存时间，说明文件在缓存生成后被更新
                        try:
                            file_mtime = os.path.getmtime(file_path)
                            # 允许1秒的时间误差（处理文件系统时间精度问题）
                            if file_mtime > cache_file_mtime + 1.0:
                                # 文件被更新了，需要重新计算
                                if self.logger:
                                    self.logger.debug(f"文件已更新（文件时间: {file_mtime}, 缓存时间: {cache_file_mtime}），需要重新计算指纹: {file_path}")
                                files_to_verify.append((file_path, file_solution_id))
                            else:
                                # 文件未更新，使用缓存中的指纹（不需要处理）
                                # 但需要确保指纹已加载到内存中（在后面的逻辑中处理）
                                pass
                        except OSError:
                            # 无法获取文件时间，保守处理：重新验证文件
                            if self.logger:
                                self.logger.debug(f"无法获取文件修改时间，重新验证: {file_path}")
                            files_to_verify.append((file_path, file_solution_id))
                        continue
                    
                    # 新文件，需要计算
                    files_to_process.append((file_path, file_solution_id))
                except (ValueError, IndexError, OSError) as e:
                    if self.logger:
                        self.logger.debug(f"处理文件时出错 {file}: {e}")
                    continue
        
        # 验证并重新计算已更新的文件
        for file_path, file_solution_id in files_to_verify:
            try:
                # 从缓存中移除旧的指纹
                if file_solution_id in self.code_fingerprints:
                    old_fps = self.code_fingerprints[file_solution_id]
                    # 从倒排索引中移除
                    for fp in old_fps:
                        if fp in self.fingerprint_index:
                            self.fingerprint_index[fp].discard(file_solution_id)
                            if not self.fingerprint_index[fp]:
                                del self.fingerprint_index[fp]
                    del self.code_fingerprints[file_solution_id]
                
                # 重新计算指纹
                with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                    code = f.read()
                self.add_code(file_solution_id, code, language=language)
                if self.logger:
                    self.logger.debug(f"重新计算了已更新文件的指纹: {file_path}")
            except Exception as e:
                if self.logger:
                    self.logger.warning(f"重新计算文件指纹失败 {file_path}: {e}")
        
        # 清理缓存中不存在的文件（文件被删除了）
        invalid_solution_ids = []
        for solution_id in cached_solution_ids:
            # 检查文件是否存在
            found = False
            for root, dirs, files in os.walk(code_dir):
                for file in files:
                    if not file.endswith(allowed_extensions):
                        continue
                    try:
                        file_parts = file.split('_')
                        if len(file_parts) < 2:
                            continue
                        file_solution_id = int(file_parts[0])
                        if file_solution_id == solution_id:
                            found = True
                            break
                    except (ValueError, IndexError):
                        continue
                if found:
                    break
            
            if not found:
                # 文件不存在，标记为无效
                invalid_solution_ids.append(solution_id)
        
        # 从内存中移除无效的缓存记录
        for solution_id in invalid_solution_ids:
            if solution_id in self.code_fingerprints:
                old_fps = self.code_fingerprints[solution_id]
                # 从倒排索引中移除
                for fp in old_fps:
                    if fp in self.fingerprint_index:
                        self.fingerprint_index[fp].discard(solution_id)
                        if not self.fingerprint_index[fp]:
                            del self.fingerprint_index[fp]
                del self.code_fingerprints[solution_id]
                if self.logger:
                    self.logger.debug(f"清理了缓存中不存在的文件记录: solution_id={solution_id}")
        
        # 增量计算：只处理新代码
        cached_count = len([sid for sid in cached_solution_ids if sid in self.code_fingerprints])
        computed_count = 0
        verified_count = len(files_to_verify)
        cleaned_count = len(invalid_solution_ids)
        
        for file_path, file_solution_id in files_to_process:
            try:
                with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                    code = f.read()
                self.add_code(file_solution_id, code, language=language)
                computed_count += 1
            except Exception as e:
                if self.logger:
                    self.logger.warning(f"读取代码文件失败 {file_path}: {e}")
        
        # 增量更新缓存：只计算新增/更新的代码，然后合并到现有缓存中
        # 核心逻辑：
        # 1. 从缓存加载已有的指纹（不重新计算）
        # 2. 只计算新增的代码（files_to_process）和更新的代码（files_to_verify）
        # 3. 合并到内存中（已有缓存 + 新计算的）
        # 4. 保存完整的缓存（包含所有有效的指纹）
        if cache_file and (computed_count > 0 or verified_count > 0 or cleaned_count > 0):
            # 增量更新：合并内存中的所有指纹
            # - cached_fingerprints: 从缓存加载的已有指纹（未重新计算）
            # - 新计算的指纹: computed_count 个
            # - 重新验证的指纹: verified_count 个
            # - 已清理的无效记录: cleaned_count 个
            all_solution_ids = list(self.code_fingerprints.keys())
            # 转换fingerprint_index为可序列化格式（确保索引与指纹一致）
            serializable_index = {fp: sorted(list(sids)) 
                                 for fp, sids in self.fingerprint_index.items()}
            
            # 使用文件锁保护写入操作（避免多容器竞争）
            self._save_cache(cache_file, all_solution_ids, self.code_fingerprints, serializable_index)
            
            if self.logger:
                # 明确显示增量更新的过程
                total_from_cache = cached_count
                total_new_computed = computed_count
                total_updated = verified_count
                total_cleaned = cleaned_count
                total_final = len(all_solution_ids)
                
                self.logger.info(f"缓存增量更新完成: 从缓存加载 {total_from_cache} 个（未重新计算），"
                               f"新计算 {total_new_computed} 个，重新验证 {total_updated} 个，"
                               f"清理 {total_cleaned} 个，最终缓存共 {total_final} 个代码的Winnowing指纹")
        elif cache_file and len(self.code_fingerprints) > 0:
            # 即使没有新变化，如果内存中有指纹（从缓存加载的），也应该确保缓存文件存在
            # 这可以处理缓存文件被意外删除的情况
            if not os.path.exists(cache_file):
                if self.logger:
                    self.logger.info(f"缓存文件不存在，重新保存缓存（共 {len(self.code_fingerprints)} 个指纹）")
                all_solution_ids = list(self.code_fingerprints.keys())
                serializable_index = {fp: sorted(list(sids)) 
                                     for fp, sids in self.fingerprint_index.items()}
                self._save_cache(cache_file, all_solution_ids, self.code_fingerprints, serializable_index)
        
        total_loaded = len(self.code_fingerprints)
        if self.logger:
            self.logger.info(f"从目录加载了 {total_loaded} 个代码的Winnowing指纹（缓存: {cached_count}, 新计算: {computed_count}, 语言过滤: {language}, 目录: {code_dir}）")
        
        # 更新智能缓存状态
        # 保存完整缓存（不过滤max_solution_id），用于后续快速复用
        self._full_cache_fingerprints = dict(self.code_fingerprints)
        # 如果有新文件需要处理（max_solution_id限制导致未加载到内存的），也添加到完整缓存
        if cached_fingerprints:
            for solution_id, fps in cached_fingerprints.items():
                if solution_id not in self._full_cache_fingerprints:
                    self._full_cache_fingerprints[solution_id] = fps
        self._full_cache_loaded = True
        self._loaded_max_solution_id = max_solution_id
        self._loaded_problem_id = problem_id
        self._loaded_language = language
        
        # 从比较集中排除指定用户的代码（在缓存保存之后执行，确保缓存保留完整数据）
        if exclude_user_id and self._solution_user_map:
            excluded_sids = [sid for sid, uid in self._solution_user_map.items() 
                             if uid == exclude_user_id and sid in self.code_fingerprints]
            for sid in excluded_sids:
                fps = self.code_fingerprints.pop(sid, set())
                for fp in fps:
                    if fp in self.fingerprint_index:
                        self.fingerprint_index[fp].discard(sid)
                        if not self.fingerprint_index[fp]:
                            del self.fingerprint_index[fp]
            if excluded_sids and self.logger:
                self.logger.info(f"已从比较集中排除用户 {exclude_user_id} 的 {len(excluded_sids)} 份代码"
                               f"（过滤后剩余 {len(self.code_fingerprints)} 份）")


# =============================================================================
# SimHash 快速查重模块（保留作为备用，已废弃）
# =============================================================================

class SimHashChecker:
    """基于 SimHash 的快速代码查重器（毫秒级，支持增量缓存和哈希桶索引）"""
    
    def __init__(self, hash_bits: int = 64, cache_dir: str = None):
        """
        初始化 SimHash 查重器
        
        Args:
            hash_bits: SimHash 指纹位数，默认64位（平衡速度和精度）
            cache_dir: 缓存目录路径（用于存储SimHash缓存）
        """
        self.hash_bits = hash_bits
        self.code_hashes = {}  # {solution_id: simhash_value}
        self.hash_buckets = defaultdict(list)  # {bucket_key: [solution_id, ...]} 哈希桶索引
        self.cache_dir = cache_dir  # 缓存目录
        self.logger = None  # 将在使用时设置
        self.bucket_bits = 16  # 哈希桶位数（使用SimHash的前16位）
    
    def set_logger(self, logger):
        """设置日志记录器"""
        self.logger = logger
    
    def compute_simhash(self, code: str) -> int:
        """
        计算代码的 SimHash 值（带权重机制，降低算法层面权重，提高实现细节权重）
        
        Args:
            code: 源代码字符串
            
        Returns:
            SimHash 值（整数）
        """
        try:
            import mmh3
        except ImportError:
            raise ImportError("mmh3 库未安装，请运行: pip install mmh3")

        # 0. 归一化换行，避免 CRLF/LF 仅格式差异造成 SimHash 波动
        if code:
            code = code.replace("\r\n", "\n").replace("\r", "\n")
        
        # 1. 将代码分词（带权重信息）
        token_weights = self._tokenize_code_with_weights(code)
        
        if not token_weights:
            # 如果代码为空或无法分词，返回0
            return 0
        
        # 2. 为每个 token 计算哈希（带权重）
        hash_values = []
        for token, weight in token_weights:
            # 使用 MurmurHash3 计算哈希
            hash_val = mmh3.hash(token, signed=False)
            # 根据权重重复添加（权重越高，对SimHash的影响越大）
            for _ in range(weight):
                hash_values.append(hash_val)
        
        # 3. 生成 SimHash 指纹
        simhash = 0
        for i in range(self.hash_bits):
            bit_sum = 0
            for hash_val in hash_values:
                if (hash_val >> i) & 1:
                    bit_sum += 1
                else:
                    bit_sum -= 1
            if bit_sum > 0:
                simhash |= (1 << i)
        
        return simhash
    
    def _tokenize_code_with_weights(self, code: str) -> List[Tuple[str, int]]:
        """
        代码分词（带权重版本）
        提取关键字、标识符、重要结构和代码结构特征
        权重机制：实现细节（变量名、函数名）> 代码结构 > 关键字和操作符
        目标：降低算法层面相似性的权重，提高实现细节的权重，减少误判
        
        Returns:
            [(token, weight), ...] 列表，weight越高表示该token越重要（对区分度贡献越大）
        """
        if not code:
            return []
        
        # 移除注释
        lines = []
        in_block_comment = False
        for line in code.split('\n'):
            line = line.strip()
            if not line:
                continue
            
            # 处理块注释
            if '/*' in line:
                in_block_comment = True
            if '*/' in line:
                in_block_comment = False
                continue
            if in_block_comment:
                continue
            
            # 移除行注释
            if '//' in line:
                line = line[:line.index('//')]
            
            if line.strip():
                lines.append(line.strip())
        
        tokens = []
        
        # 收集变量名和函数名（用于后续生成代码指纹）
        variable_names = set()
        function_names = set()
        
        # C++关键字列表（算法层面，降低权重）
        cpp_keywords = {'int', 'long', 'double', 'float', 'char', 'bool', 'string', 'vector', 
                       'if', 'else', 'for', 'while', 'do', 'switch', 'case', 'break', 'continue',
                       'return', 'void', 'const', 'static', 'inline', 'using', 'namespace', 'std',
                       'cin', 'cout', 'endl', 'include', 'algorithm', 'iostream', 'climits',
                       'pair', 'auto', 'true', 'false', 'null', 'main', 'min', 'max', 'swap',
                       'sort', 'stable_sort', 'reserve', 'emplace_back', 'sync_with_stdio', 'tie'}
        
        for line in lines:
            # 提取关键字和标识符
            words = re.findall(r'\b[a-zA-Z_][a-zA-Z0-9_]*\b', line)
            
            for word in words:
                word_lower = word.lower()
                if word_lower in cpp_keywords:
                    # 关键字：权重0（算法层面，完全忽略，因为解决同一问题必然使用相同关键字）
                    # 不添加到tokens中
                    pass
                else:
                    # 用户定义的标识符（变量名、函数名）：权重4（实现细节，提高权重）
                    tokens.append((word, 4))
                    variable_names.add(word)
            
            # 提取重要操作符和结构：权重0（算法层面，完全忽略）
            # 不添加到tokens中
            
            # 增加代码结构特征（提高区分度）
            # 1. 函数定义特征：函数名+参数数量，权重5（实现细节，高权重）
            func_match = re.match(r'\s*(?:inline\s+)?(?:static\s+)?(?:const\s+)?\w+\s+(\w+)\s*\([^)]*\)', line)
            if func_match:
                func_name = func_match.group(1)
                if func_name.lower() not in cpp_keywords:
                    function_names.add(func_name)
                    # 计算参数数量（简单统计逗号数量+1）
                    params = line[line.find('(')+1:line.find(')')]
                    param_count = len([p for p in params.split(',') if p.strip()]) if params.strip() else 0
                    tokens.append((f"func_{func_name}_{param_count}", 5))
            
            # 2. 控制流结构特征：if/while/for + 条件复杂度，权重1（代码结构，降低权重）
            if re.match(r'\s*if\s*\(', line):
                cond_match = re.search(r'if\s*\((.*?)\)', line)
                if cond_match:
                    cond = cond_match.group(1)
                    op_count = len(re.findall(r'[+\-*/%=<>!&|]+', cond))
                    tokens.append((f"if_cond_{min(op_count, 5)}", 1))
            
            # 3. 循环结构特征：for/while + 循环变量名，权重3（代码结构，提高权重，因为循环变量名是实现细节）
            for_match = re.match(r'\s*for\s*\([^;]*;\s*([^;]+);', line)
            if for_match:
                loop_var = for_match.group(1).strip()
                var_match = re.search(r'\b([a-zA-Z_][a-zA-Z0-9_]*)\b', loop_var)
                if var_match:
                    var_name = var_match.group(1)
                    # 如果循环变量是用户定义的（不是关键字），则权重更高
                    if var_name.lower() not in cpp_keywords:
                        tokens.append((f"for_var_{var_name}", 3))
                    else:
                        tokens.append((f"for_var_{var_name}", 1))
            
            # 4. 变量声明特征：类型+变量名，权重4（实现细节，高权重）
            var_decl_match = re.match(r'\s*(?:const\s+)?(?:inline\s+)?(?:static\s+)?(\w+)\s+(\w+)', line)
            if var_decl_match and var_decl_match.group(1) in ['int', 'long', 'double', 'float', 'char', 'bool', 'string', 'vector']:
                var_type = var_decl_match.group(1)
                var_name = var_decl_match.group(2)
                # 只记录重要的变量声明（避免噪声）
                if len(var_name) > 2 and var_name.lower() not in cpp_keywords:
                    tokens.append((f"var_{var_type}_{var_name}", 4))
        
        # 5. 代码指纹特征：变量名组合（用于区分不同的实现风格），权重10（实现细节，最高权重）
        if len(variable_names) >= 2:
            # 将变量名排序后组合，生成代码指纹
            sorted_vars = sorted(variable_names)
            # 生成变量名组合（每2个一组）
            for i in range(len(sorted_vars) - 1):
                var_pair = f"vars_{sorted_vars[i]}_{sorted_vars[i+1]}"
                tokens.append((var_pair, 10))
        
        # 6. 函数调用特征：函数名+调用位置，权重6（实现细节）
        for func_name in function_names:
            # 统计函数调用次数（作为特征）
            func_call_count = sum(1 for line in lines if func_name in line and '(' in line and func_name + '(' in line)
            if func_call_count > 0:
                tokens.append((f"call_{func_name}_{func_call_count}", 6))
        
        # 7. 代码组织特征：while vs for（用于区分不同的循环风格），权重5（实现细节）
        has_while = any('while' in line.lower() for line in lines)
        has_for_loop = any(re.match(r'\s*for\s*\(', line) for line in lines)
        if has_while:
            tokens.append(("loop_style_while", 5))
        if has_for_loop:
            tokens.append(("loop_style_for", 5))
        
        # 8. 代码组织特征：是否有独立函数（内联vs函数），权重6（实现细节）
        if function_names:
            tokens.append(("code_style_function", 6))
        else:
            tokens.append(("code_style_inline", 6))
        
        return tokens
    
    def hamming_distance(self, hash1: int, hash2: int) -> int:
        """
        计算两个 SimHash 值的汉明距离
        
        Args:
            hash1: 第一个 SimHash 值
            hash2: 第二个 SimHash 值
            
        Returns:
            汉明距离（0-64，值越小越相似）
        """
        return bin(hash1 ^ hash2).count('1')
    
    def similarity_score(self, hash1: int, hash2: int) -> float:
        """
        计算相似度分数（0-100）
        
        Args:
            hash1: 第一个 SimHash 值
            hash2: 第二个 SimHash 值
            
        Returns:
            相似度分数（0-100，100表示完全相同）
        """
        if hash1 == 0 and hash2 == 0:
            return 100.0
        
        distance = self.hamming_distance(hash1, hash2)
        
        # 如果汉明距离为0，说明SimHash完全相同，返回100%
        if distance == 0:
            return 100.0
        
        # 汉明距离转换为相似度（经验公式）
        # 64位 SimHash，距离1-64，相似度99.98-0
        similarity = max(0.0, 100.0 - (distance / self.hash_bits * 100.0))
        
        # 对于非常高的相似度（>=99.5%但<100%），保持原值
        # 只有完全相同的代码（汉明距离=0）才返回100%
        return similarity
    
    def find_similar_codes(self, new_code: str, threshold: float = 80.0, 
                          top_k: int = 10) -> List[Dict[str, Any]]:
        """
        在已存储的代码中查找与新代码相似的代码（高性能版本，支持哈希桶索引）
        
        Args:
            new_code: 新代码字符串
            threshold: 相似度阈值（0-100）
            top_k: 返回前 k 个最相似的代码
            
        Returns:
            相似代码列表，格式：[{'solution_id': xxx, 'similarity': xxx}, ...]
        """
        import time
        import heapq
        start_time = time.time()
        
        # 1. 计算新代码的 SimHash（一次性计算）
        new_hash = self.compute_simhash(new_code)
        hash_time = time.time() - start_time
        
        # 2. 使用哈希桶索引进行快速筛选（分层过滤）
        compare_start = time.time()
        
        # 性能优化：预计算阈值距离
        threshold_distance = int((100.0 - threshold) / 100.0 * self.hash_bits)
        
        # 第一阶段：通过哈希桶索引筛选候选代码
        # 计算新代码的哈希桶键
        new_bucket_key = self._get_bucket_key(new_hash)
        
        # 候选代码集合：包括同桶代码和相邻桶代码（汉明距离在阈值内的桶）
        candidate_solution_ids = set()
        
        # 添加同桶代码
        candidate_solution_ids.update(self.hash_buckets.get(new_bucket_key, []))
        
        # 添加相邻桶代码（前16位汉明距离<=2的桶）
        # 这样可以捕获更多潜在相似的代码，同时保持性能
        bucket_value = int(new_bucket_key, 16)
        for i in range(self.bucket_bits):
            # 翻转每一位，生成相邻桶
            neighbor_bucket = bucket_value ^ (1 << i)
            neighbor_key = f"{neighbor_bucket:04x}"
            candidate_solution_ids.update(self.hash_buckets.get(neighbor_key, []))
        
        # 如果候选集太大（超过总数的50%），回退到全量比较
        if len(candidate_solution_ids) > len(self.code_hashes) * 0.5:
            candidate_solution_ids = set(self.code_hashes.keys())
        
        bucket_filter_time = time.time() - compare_start
        
        # 第二阶段：对候选代码进行精确比较
        similarities = []
        exact_compare_start = time.time()
        
        for solution_id in candidate_solution_ids:
            stored_hash = self.code_hashes.get(solution_id)
            if stored_hash is None:
                continue
            
            # 直接计算汉明距离（比调用函数更快）
            distance = bin(new_hash ^ stored_hash).count('1')
            if distance <= threshold_distance:
                # 计算相似度（只在满足阈值时计算，减少计算量）
                if distance == 0:
                    # 汉明距离为0，说明SimHash完全相同，返回100%
                    similarity = 100.0
                else:
                    # 汉明距离>0，计算相似度
                    similarity = max(0.0, 100.0 - (distance / self.hash_bits * 100.0))
                similarities.append({
                    'solution_id': solution_id,
                    'similarity': round(similarity, 2)
                })
        
        exact_compare_time = time.time() - exact_compare_start
        compare_time = time.time() - compare_start
        
        # 3. 按相似度排序，返回 top-k（使用堆排序优化）
        if len(similarities) > top_k * 2:
            # 对于大量结果，使用堆排序只保留top_k
            # 注意：使用 (similarity, solution_id) 作为排序键，避免字典比较错误
            # 使用负相似度实现最大堆（heapq是最小堆）
            heap = []
            for item in similarities:
                similarity = item['similarity']
                solution_id = item['solution_id']
                # 使用 (-similarity, solution_id) 作为键：负相似度用于最大堆，solution_id作为第二排序键
                heap_item = (-similarity, solution_id, item)
                if len(heap) < top_k:
                    heapq.heappush(heap, heap_item)
                elif similarity > -heap[0][0]:  # 比较相似度（注意堆中是负数）
                    heapq.heapreplace(heap, heap_item)
            # 从堆中提取并排序（按相似度降序，相同相似度时按solution_id升序）
            result = [item for _, _, item in sorted(heap, key=lambda x: (-x[0], x[1]))]
        else:
            # 对于少量结果，直接排序更快
            # 按相似度降序，相同相似度时按solution_id升序
            similarities.sort(key=lambda x: (-x['similarity'], x['solution_id']))
            result = similarities[:top_k]
        
        total_time = time.time() - start_time
        
        if self.logger:
            self.logger.info(f"SimHash 查重性能: 总耗时={total_time*1000:.2f}ms, "
                           f"SimHash计算={hash_time*1000:.2f}ms, "
                           f"桶筛选={bucket_filter_time*1000:.2f}ms (候选: {len(candidate_solution_ids)}/{len(self.code_hashes)}), "
                           f"精确比较={exact_compare_time*1000:.2f}ms, "
                           f"找到{len(result)}个相似代码")
        
        return result
    
    def add_code(self, solution_id: int, code: str):
        """添加代码到索引"""
        simhash = self.compute_simhash(code)
        self.code_hashes[solution_id] = simhash
        # 更新哈希桶索引
        bucket_key = self._get_bucket_key(simhash)
        if solution_id not in self.hash_buckets[bucket_key]:
            self.hash_buckets[bucket_key].append(solution_id)
    
    def _get_bucket_key(self, simhash: int) -> str:
        """获取哈希桶键（使用SimHash的前16位）"""
        # 提取前16位（4个十六进制字符）
        bucket_value = (simhash >> (self.hash_bits - self.bucket_bits)) & ((1 << self.bucket_bits) - 1)
        return f"{bucket_value:04x}"  # 4位十六进制字符串
    
    def batch_add_codes(self, codes: Dict[int, str]):
        """批量添加代码"""
        for solution_id, code in codes.items():
            self.add_code(solution_id, code)
    
    def _load_cache(self, cache_file: str) -> Optional[Dict[str, Any]]:
        """
        加载SimHash缓存文件
        
        Args:
            cache_file: 缓存文件路径
            
        Returns:
            缓存数据字典，如果文件不存在或损坏则返回None
        """
        if not os.path.exists(cache_file):
            return None
        
        try:
            with open(cache_file, 'r', encoding='utf-8') as f:
                cache_data = json.load(f)
            
            # 验证缓存格式
            if not isinstance(cache_data, dict) or 'hashes' not in cache_data:
                return None
            
            return cache_data
        except (json.JSONDecodeError, IOError) as e:
            if self.logger:
                self.logger.warning(f"加载缓存文件失败 {cache_file}: {e}")
            return None
    
    def _save_cache(self, cache_file: str, solution_ids: List[int], 
                    hashes: Dict[int, int], hash_buckets: Dict[str, List[int]]):
        """
        保存SimHash缓存到文件
        
        Args:
            cache_file: 缓存文件路径
            solution_ids: 解决方案ID列表
            hashes: SimHash值字典 {solution_id: simhash}
            hash_buckets: 哈希桶索引 {bucket_key: [solution_id, ...]}
        """
        try:
            os.makedirs(os.path.dirname(cache_file), exist_ok=True)
            
            cache_data = {
                'version': 1,
                'solution_ids': sorted(solution_ids),
                'hashes': {str(sid): hash_val for sid, hash_val in hashes.items()},
                'hash_buckets': {key: sorted(sids) for key, sids in hash_buckets.items()},
                'last_updated': time.strftime('%Y-%m-%dT%H:%M:%S')
            }
            
            # 使用临时文件确保原子性写入
            temp_file = cache_file + '.tmp'
            with open(temp_file, 'w', encoding='utf-8') as f:
                json.dump(cache_data, f, indent=2, ensure_ascii=False)
            
            # 原子性替换
            os.replace(temp_file, cache_file)
            
            if self.logger:
                self.logger.debug(f"SimHash缓存已保存: {cache_file}, {len(solution_ids)}个代码")
        except Exception as e:
            if self.logger:
                self.logger.warning(f"保存缓存文件失败 {cache_file}: {e}")
    
    def load_codes_from_directory(self, code_dir: str, problem_id: int, 
                                  max_solution_id: int = 0, exclude_user_id: str = '',
                                  language: str = ''):
        """
        从目录加载代码并计算 SimHash（支持增量缓存）
        
        Args:
            code_dir: 代码目录路径
            problem_id: 题目ID
            max_solution_id: 只加载比这个ID小的代码
            exclude_user_id: 排除的用户ID
            language: 编程语言（用于过滤，python只看python，java只看java，c/c++都看）
        """
        if not os.path.exists(code_dir):
            if self.logger:
                self.logger.warning(f"代码目录不存在: {code_dir}")
            return
        
        # 尝试加载缓存
        cache_file = None
        cached_hashes = {}
        cached_solution_ids = set()
        if self.cache_dir:
            # 缓存文件路径：{cache_dir}/{problem_id}/.simhash_cache_{language}.json
            cache_dir_path = os.path.join(self.cache_dir, str(problem_id))
            cache_file = os.path.join(cache_dir_path, f'.simhash_cache_{language.lower()}.json')
            cache_data = self._load_cache(cache_file)
            if cache_data:
                # 从缓存加载SimHash值
                cached_hashes = {int(sid): int(hash_val) for sid, hash_val in cache_data.get('hashes', {}).items()}
                cached_solution_ids = set(cached_hashes.keys())
                
                # 恢复哈希桶索引
                for bucket_key, sids in cache_data.get('hash_buckets', {}).items():
                    self.hash_buckets[bucket_key] = [int(sid) for sid in sids]
                
                if self.logger:
                    self.logger.info(f"从缓存加载了 {len(cached_hashes)} 个SimHash值")
        
        # 将缓存的SimHash值添加到内存
        for solution_id, simhash in cached_hashes.items():
            # 检查是否满足过滤条件
            if max_solution_id > 0 and solution_id >= max_solution_id:
                continue
            self.code_hashes[solution_id] = simhash
        
        # 根据语言确定需要加载的文件扩展名
        # python/python3: 只看 .py
        # java: 只看 .java
        # c: 看 .c 和 .cpp
        # cpp/c++: 看 .c 和 .cpp
        # go/golang: 只看 .go
        language_lower = language.lower() if language else ''
        if language_lower in ['python', 'python3']:
            allowed_extensions = ('.py',)
        elif language_lower == 'java':
            allowed_extensions = ('.java',)
        elif language_lower in ['c', 'cpp', 'c++']:
            allowed_extensions = ('.c', '.cpp')
        elif language_lower in ['go', 'golang']:
            allowed_extensions = ('.go',)
        else:
            # 如果未指定语言，抛出错误（必须指定语言）
            if self.logger:
                self.logger.error(f"未指定编程语言，无法加载代码（problem_id={problem_id}）")
            return
        
        # 收集需要处理的文件（增量更新：跳过已缓存的代码）
        files_to_process = []
        for root, dirs, files in os.walk(code_dir):
            for file in files:
                # 根据语言过滤文件扩展名
                if not file.endswith(allowed_extensions):
                    continue
                
                # 从文件名提取solution_id（格式：solution_id_user_id.ext）
                try:
                    file_parts = file.split('_')
                    if len(file_parts) < 2:
                        continue
                    
                    file_solution_id = int(file_parts[0])
                    
                    # 检查是否超过最大ID
                    if max_solution_id > 0 and file_solution_id >= max_solution_id:
                        continue
                    
                    # 检查是否属于排除的用户
                    if exclude_user_id and exclude_user_id in file:
                        continue
                    
                    # 检查是否已在缓存中
                    if file_solution_id in cached_solution_ids:
                        continue  # 跳过已缓存的代码
                    
                    files_to_process.append((os.path.join(root, file), file_solution_id))
                except (ValueError, IndexError):
                    continue
        
        # 增量计算：只处理新代码
        cached_count = len(cached_hashes)  # 已从缓存加载的数量
        computed_count = 0
        for file_path, file_solution_id in files_to_process:
            try:
                with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                    code = f.read()
                self.add_code(file_solution_id, code)
                computed_count += 1
            except Exception as e:
                if self.logger:
                    self.logger.warning(f"读取代码文件失败 {file_path}: {e}")
        
        # 保存更新后的缓存（如果有新计算的代码）
        if cache_file and computed_count > 0:
            all_solution_ids = list(self.code_hashes.keys())
            self._save_cache(cache_file, all_solution_ids, self.code_hashes, self.hash_buckets)
            if self.logger:
                self.logger.info(f"增量更新缓存: 新增 {computed_count} 个代码的SimHash")
        
        if self.logger:
            self.logger.info(f"从目录加载了 {cached_count + computed_count} 个代码的SimHash（缓存: {cached_count}, 新计算: {computed_count}, 语言过滤: {language}）")

# =============================================================================
# 查重执行模块
# =============================================================================

class SimilarityChecker:
    """代码查重器 - 使用 Winnowing 快速查重方案（MOSS算法核心，毫秒级，5000份代码1秒内响应）"""
    
    def __init__(self, config: Dict[str, Any], web_client: WebClient):
        """
        初始化查重器
        
        Args:
            config: 评测机配置
            web_client: Web客户端实例
        """
        self.config = config
        self.web_client = web_client
        self.logger = setup_unified_logging("SimilarityChecker", config)
        
        # 初始化代码同步器
        self.code_sync = CodeSync(config, web_client)
        
        # 查重方案配置（使用 Winnowing，毫秒级，5000份代码1秒内响应）
        similarity_config = config.get("similarity", {})
        self.winnowing_threshold = similarity_config.get("winnowing_threshold", 80.0)  # Winnowing 相似度阈值
        self.winnowing_top_k = similarity_config.get("winnowing_top_k", 10)  # 返回前k个相似代码
        self.winnowing_k = similarity_config.get("winnowing_k", 5)  # k-gram大小
        self.winnowing_w = similarity_config.get("winnowing_w", 4)  # 窗口大小
        
        # 初始化 Winnowing 查重器（唯一查重方案）
        # 设置缓存目录为代码存储目录（用于增量缓存）
        cache_dir = self.code_sync.code_base_dir if hasattr(self.code_sync, 'code_base_dir') else None
        self.winnowing_checker = WinnowingChecker(k=self.winnowing_k, w=self.winnowing_w, cache_dir=cache_dir)
        self.winnowing_checker.set_logger(self.logger)
        # 设置锁管理器（用于缓存文件的并发保护）
        if hasattr(self.code_sync, 'lock_manager'):
            self.winnowing_checker.set_lock_manager(self.code_sync.lock_manager)
    
    def check_similarity(self, problem_id: int, solution_id: int, 
                        user_id: str, language: str) -> Tuple[bool, List[Dict[str, Any]]]:
        """
        执行代码查重（使用 Winnowing 快速查重方案）
        
        Args:
            problem_id: 题目ID
            solution_id: 当前解决方案ID
            user_id: 当前用户ID
            language: 编程语言
        
        Returns:
            (是否成功, 相似度列表 [{solution_id: xxx, similarity: xxx}, ...])
        """
        try:
            self.logger.info(f"开始查重：problem_id={problem_id}, solution_id={solution_id}, user_id={user_id}, language={language}, 方案=Winnowing")
            
            # 1. 同步AC代码（只同步比当前solution_id小的代码，排除当前用户）
            # 注意：必须同步成功，否则无法查重
            sync_success, sync_count = self.code_sync.sync_ac_codes(
                problem_id=problem_id,
                max_solution_id=solution_id,
                exclude_user_id=user_id,
                force_full_sync=False
            )
            
            if not sync_success:
                self.logger.warning(f"代码同步失败，但继续尝试查重（可能之前已同步过部分代码）")
            else:
                self.logger.info(f"代码同步成功，共同步 {sync_count} 份代码")
            
            # 2. 获取当前代码
            current_code = self.web_client.get_solution_code(solution_id)
            if not current_code:
                self.logger.error(f"无法获取当前解决方案 {solution_id} 的代码")
                return False, []
            
            # 3. 使用 Winnowing 进行快速查重（毫秒级，5000份代码1秒内响应）
            return self._check_similarity_winnowing(problem_id, solution_id, user_id, language, current_code)
                
        except Exception as e:
            log_error_with_context(self.logger, "代码查重", e, {
                "problem_id": problem_id,
                "solution_id": solution_id,
                "user_id": user_id
            })
            return False, []
    
    def _check_similarity_winnowing(self, problem_id: int, solution_id: int, 
                                  user_id: str, language: str, 
                                  current_code: str) -> Tuple[bool, List[Dict[str, Any]]]:
        """
        使用 Winnowing 进行快速查重（毫秒级）
        """
        try:
            # 1. 加载历史代码的指纹（按语言过滤）
            problem_code_dir = os.path.join(self.code_sync.code_base_dir, str(problem_id))
            self.winnowing_checker.load_codes_from_directory(
                problem_code_dir, 
                problem_id, 
                max_solution_id=solution_id,
                exclude_user_id=user_id,
                language=language  # 传递语言参数进行过滤
            )
            
            # 2. 如果没有历史代码，记录详细信息并返回
            if len(self.winnowing_checker.code_fingerprints) == 0:
                self.logger.warning(f"没有历史代码可比较，跳过查重（problem_id={problem_id}, solution_id={solution_id}, code_dir={problem_code_dir}, language={language}）")
                # 检查代码目录是否存在
                if not os.path.exists(problem_code_dir):
                    self.logger.warning(f"代码目录不存在: {problem_code_dir}")
                else:
                    # 列出目录中的文件，帮助调试
                    file_count = 0
                    for root, dirs, files in os.walk(problem_code_dir):
                        file_count += len([f for f in files if f.endswith(('.c', '.cpp', '.java', '.py', '.go'))])
                    self.logger.warning(f"代码目录存在，但找到 {file_count} 个代码文件（可能被过滤掉了）")
                return True, []
            
            # 3. 查找相似代码
            similarities = self.winnowing_checker.find_similar_codes(
                current_code,
                threshold=self.winnowing_threshold,
                top_k=self.winnowing_top_k,
                language=language
            )
            
            total_loaded = len(self.winnowing_checker.code_fingerprints)
            self.logger.info(f"Winnowing 查重完成，找到 {len(similarities)} 个相似代码（已加载 {total_loaded} 个历史代码指纹）")
            if similarities:
                for sim in similarities:
                    self.logger.info(f"  相似代码: solution_id={sim['solution_id']}, similarity={sim['similarity']:.2f}%")
            return True, similarities
            
        except Exception as e:
            log_error_with_context(self.logger, "Winnowing查重", e, {
                "problem_id": problem_id,
                "solution_id": solution_id
            })
            return False, []
    

# =============================================================================
# 查重模块主接口
# =============================================================================

def check_code_similarity(config: Dict[str, Any], web_client: WebClient,
                          problem_id: int, solution_id: int, user_id: str, 
                          language: str) -> Tuple[bool, Optional[Dict[str, Any]], str]:
    """
    执行代码查重（主接口）
    
    Args:
        config: 评测机配置
        web_client: Web客户端实例
        problem_id: 题目ID
        solution_id: 当前解决方案ID
        user_id: 当前用户ID
        language: 编程语言
    
    Returns:
        (是否成功, 最相似的代码信息 {solution_id: xxx, similarity: xxx} 或 None, 错误消息)
        注意：只返回一个结果，如果多个代码的相似度相同，选择solution_id最小的
    """
    try:
        checker = SimilarityChecker(config, web_client)
        success, similarities = checker.check_similarity(
            problem_id=problem_id,
            solution_id=solution_id,
            user_id=user_id,
            language=language
        )
        
        if not success:
            return False, None, "查重执行失败"
        
        if not similarities:
            # 没有相似代码
            return True, None, ""
        
        # 选择最相似的代码：相似度最高的，如果相同则选择solution_id最小的
        best_match = None
        max_similarity = 0
        min_solution_id = 0
        
        for sim_data in similarities:
            sim_solution_id = sim_data.get('solution_id', 0)
            similarity = sim_data.get('similarity', 0)
            
            if sim_solution_id <= 0 or similarity < 0:
                continue
            
            # 找到相似度最高的
            if similarity > max_similarity:
                max_similarity = similarity
                min_solution_id = sim_solution_id
                best_match = sim_data
            elif similarity == max_similarity:
                # 相似度相同，选择solution_id较小的
                if min_solution_id == 0 or sim_solution_id < min_solution_id:
                    min_solution_id = sim_solution_id
                    best_match = sim_data
        
        if best_match:
            logger = setup_unified_logging("SimilarityChecker", config)
            logger.info(f"选择最相似的代码：solution_id={best_match['solution_id']}, similarity={best_match['similarity']}")
            return True, best_match, ""
        else:
            return True, None, ""
            
    except Exception as e:
        error_msg = f"查重过程发生异常：{str(e)}"
        logger = setup_unified_logging("SimilarityChecker", config)
        log_error_with_context(logger, "代码查重", e, {
            "problem_id": problem_id,
            "solution_id": solution_id
        })
        return False, None, error_msg

