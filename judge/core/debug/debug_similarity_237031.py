#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
调试脚本：详细分析提交 237031 的查重问题

功能说明：
    1. 获取提交 237031 的代码
    2. 获取题目的所有历史AC代码
    3. 逐个比较相似度，找出最相似的代码
    4. 分析为什么查重没有检测到相似代码

调用方法：
    docker exec <judge-container> sh -c "cd /core && python debug/debug_similarity_237031.py"
"""

import os
import sys
import json

# 将当前目录添加到Python路径
current_dir = os.path.dirname(os.path.abspath(__file__))
parent_dir = os.path.dirname(current_dir)
if current_dir not in sys.path:
    sys.path.insert(0, current_dir)
if parent_dir not in sys.path:
    sys.path.insert(0, parent_dir)

from tools.similarity_checker import WinnowingChecker, SimilarityChecker
from tools.web_client import WebClient
from tools.config_loader import ConfigLoader
from tools.debug_manager import setup_unified_logging

def main():
    solution_id = 237031
    
    # 初始化
    config = ConfigLoader.load_config()
    logger = setup_unified_logging("DebugSimilarity", config)
    web_client = WebClient(config)
    web_client._authenticate()
    
    # 获取提交信息
    logger.info(f"=== 调试提交 {solution_id} 的查重问题 ===\n")
    
    # 先尝试从数据库获取提交信息
    current_code = web_client.get_solution_code(solution_id)
    if not current_code:
        logger.error(f"无法获取提交代码")
        return 1
    
    # 获取提交的其他信息（从数据库或通过其他方式）
    # 先尝试getsolutioninfo
    result = web_client._make_request('GET', 'getsolutioninfo', params={'solution_id': solution_id})
    if result and result.get('code') == 1:
        data = result.get('data', {})
        problem_id = data.get('problem_id')
        user_id = data.get('user_id')
        language = data.get('language')
    else:
        # 如果getsolutioninfo失败，尝试从数据库查询
        logger.warning("getsolutioninfo失败，尝试从数据库查询...")
        # 这里需要知道problem_id，先假设是1213（从之前的日志看到）
        problem_id = 1213
        user_id = '202200202161'  # 从之前的日志看到
        language = 'cpp'  # 从之前的日志看到
        logger.info(f"使用默认值: problem_id={problem_id}, user_id={user_id}, language={language}")
    
    logger.info(f"提交信息:")
    logger.info(f"  problem_id: {problem_id}")
    logger.info(f"  user_id: {user_id}")
    logger.info(f"  language: {language}")
    logger.info(f"  code_length: {len(current_code)}")
    logger.info("")
    
    # 获取历史AC代码
    logger.info("获取历史AC代码...")
    all_solutions = []
    page = 1
    page_size = 100
    
    while True:
        result = web_client._make_request('GET', 'get_ac_solutions', params={
            'problem_id': problem_id,
            'max_solution_id': solution_id,
            'exclude_user_id': user_id,
            'page': page,
            'page_size': page_size
        })
        
        if not result or result.get('code') != 1:
            break
        
        data = result.get('data', {})
        solutions = data.get('list', [])
        if not solutions:
            break
        
        all_solutions.extend(solutions)
        has_more = data.get('has_more', False)
        if not has_more:
            break
        
        page += 1
    
    logger.info(f"找到 {len(all_solutions)} 个历史AC代码（排除当前用户）\n")
    
    # 初始化查重器
    similarity_checker = SimilarityChecker(config, web_client)
    winnowing_checker = similarity_checker.winnowing_checker
    
    # 计算当前代码的指纹
    logger.info("计算当前代码的指纹...")
    current_fingerprints = winnowing_checker.compute_fingerprints(current_code, language=language)
    logger.info(f"当前代码指纹数量: {len(current_fingerprints)}\n")
    
    # 逐个比较相似度
    logger.info("逐个比较相似度（找出最相似的代码）...")
    similarities = []
    
    for sol in all_solutions:
        sol_id = sol.get('solution_id')
        sol_code = sol.get('code', '')
        sol_user = sol.get('user_id', '')
        
        if not sol_code:
            continue
        
        # 计算相似度
        sol_fingerprints = winnowing_checker.compute_fingerprints(sol_code, language=language)
        similarity = winnowing_checker.similarity_score(current_fingerprints, sol_fingerprints)
        
        similarities.append({
            'solution_id': sol_id,
            'user_id': sol_user,
            'similarity': similarity,
            'code_length': len(sol_code)
        })
    
    # 排序
    similarities.sort(key=lambda x: -x['similarity'])
    
    # 输出结果
    logger.info(f"\n相似度排名（前20个）:")
    logger.info(f"{'排名':<6} {'solution_id':<12} {'user_id':<15} {'相似度':<10} {'代码长度':<10}")
    logger.info("-" * 60)
    
    for i, sim in enumerate(similarities[:20], 1):
        logger.info(f"{i:<6} {sim['solution_id']:<12} {sim['user_id']:<15} {sim['similarity']:.2f}%{'':<5} {sim['code_length']:<10}")
    
    # 检查阈值
    threshold = config.get('similarity', {}).get('winnowing_threshold', 80.0)
    logger.info(f"\n当前阈值: {threshold}%")
    
    above_threshold = [s for s in similarities if s['similarity'] >= threshold]
    logger.info(f"超过阈值的代码数量: {len(above_threshold)}")
    
    if above_threshold:
        logger.info(f"\n超过阈值的代码:")
        for sim in above_threshold[:10]:
            logger.info(f"  solution_id={sim['solution_id']}, similarity={sim['similarity']:.2f}%")
    else:
        logger.warning(f"\n没有找到超过阈值({threshold}%)的相似代码！")
        logger.warning("可能的原因:")
        logger.warning("  1. 阈值设置过高")
        logger.warning("  2. 算法实现有问题")
        logger.warning("  3. 代码确实不相似（但用户认为有雷同）")
        
        # 显示最相似的几个
        if similarities:
            logger.info(f"\n最相似的代码（即使未超过阈值）:")
            for sim in similarities[:5]:
                logger.info(f"  solution_id={sim['solution_id']}, similarity={sim['similarity']:.2f}%")
    
    # 使用查重器的find_similar_codes方法测试
    logger.info(f"\n使用查重器的find_similar_codes方法测试...")
    
    # 先加载历史代码到查重器
    code_sync = similarity_checker.code_sync
    problem_code_dir = os.path.join(code_sync.code_base_dir, str(problem_id))
    
    winnowing_checker.load_codes_from_directory(
        problem_code_dir,
        problem_id,
        max_solution_id=solution_id,
        exclude_user_id=user_id,
        language=language
    )
    
    logger.info(f"已加载 {len(winnowing_checker.code_fingerprints)} 个历史代码指纹")
    
    # 查找相似代码
    similar_codes = winnowing_checker.find_similar_codes(
        current_code,
        threshold=threshold,
        top_k=10,
        language=language
    )
    
    logger.info(f"查重器找到 {len(similar_codes)} 个相似代码:")
    for sim in similar_codes:
        logger.info(f"  solution_id={sim['solution_id']}, similarity={sim['similarity']:.2f}%")
    
    return 0

if __name__ == '__main__':
    try:
        sys.exit(main())
    except KeyboardInterrupt:
        print("\n用户中断")
        sys.exit(1)
    except Exception as e:
        print(f"发生错误: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

