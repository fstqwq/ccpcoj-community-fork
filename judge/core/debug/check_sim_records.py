#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
检查查重记录脚本
用于验证查重结果是否正确保存到数据库
"""

import sys
import os
import requests

# 将当前目录添加到Python路径
current_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if current_dir not in sys.path:
    sys.path.insert(0, current_dir)

from tools.web_client import WebClient
from tools.config_loader import ConfigLoader

def check_sim_records(solution_ids):
    """检查查重记录"""
    config = ConfigLoader.load_config('config.json')
    web_client = WebClient(config)
    
    if not web_client._authenticate():
        print("认证失败")
        return
    
    print("=== 检查查重记录 ===\n")
    
    for solution_id in solution_ids:
        print(f"Solution {solution_id}:")
        
        # 获取提交信息
        solution_info = web_client.get_solution_info(solution_id)
        if solution_info:
            print(f"  状态: result={solution_info.get('result')}")
            print(f"  查重开关: {solution_info.get('similarity_check_enabled')}")
        else:
            print("  无法获取提交信息")
        
        # 注意：web_client 没有直接查询 sim 表的接口
        # 需要通过后端接口或直接查询数据库
        print("  查重记录: 需要通过数据库查询 sim 表")
        print()

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("用法: python debug/check_sim_records.py <solution_id1> [solution_id2] ...")
        print("示例: python debug/check_sim_records.py 416395 415326 415322")
        sys.exit(1)
    
    solution_ids = [int(sid) for sid in sys.argv[1:]]
    check_sim_records(solution_ids)

