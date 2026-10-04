#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
评测机调试工具：重置提交状态为 Pending

功能说明：
    将指定的提交（solution）状态重置为 Pending（待评测），用于测试评测流程。
    当需要反复测试某个提交的评测流程时，可以使用此工具将其状态重置为 Pending，
    然后通过 judge_host 或手动执行 judge_client 来重新评测。

调用方法：
    1. 在容器内执行（推荐）：
       docker exec -it <容器名> sh -c "cd /core && python debug/reset_solution.py <solution_id>"
    
    2. 直接执行（需要在容器内）：
       cd /core
       python debug/reset_solution.py <solution_id>
    
    3. 批量重置多个提交：
       for sid in 416550 416551 416552; do
           python debug/reset_solution.py $sid
       done

参数说明：
    solution_id: 要重置的提交ID（必填）

返回值：
    成功：返回 0，并输出成功消息
    失败：返回 1，并输出错误信息

使用示例：
    # 重置提交 416550 为 Pending 状态
    python debug/reset_solution.py 416550
    
    # 重置后，可以通过以下方式测试：
    # 1. 使用 judge_host 自动获取并评测
    #    python judge_host.py debug
    
    # 2. 手动执行 judge_client 评测（debug：保留工作目录、详细日志）
    #    python judge_client.py 416550 debug
    #    python judge_client.py 416550 debug --config /path/to/config.json
    
    # 仓库 pytest：从 status_ajax 拉真实提交、DB 置 Pending 后子进程跑 judge_client，
    # 见 deploy_files/unit_tests/judge2_core_local/test_04_status_ajax_rejudge_interactive.py

注意事项：
    1. 需要确保评测机已正确配置（config.json）
    2. 需要确保评测机账号有权限修改提交状态
    3. 重置后的提交会被 judge_host 自动获取并评测
    4. 建议在测试环境中使用，避免影响生产环境数据
"""

import sys
import os

# 将当前目录添加到Python路径，确保可以导入 core 目录下的模块
current_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if current_dir not in sys.path:
    sys.path.insert(0, current_dir)

from tools.web_client import WebClient
from tools.config_loader import ConfigLoader
from tools.debug_manager import setup_unified_logging


def reset_solution_to_pending(solution_id: int) -> bool:
    """
    将提交状态重置为 Pending
    
    Args:
        solution_id: 要重置的提交ID
    
    Returns:
        bool: 成功返回 True，失败返回 False
    """
    try:
        # 加载配置
        config_path = os.path.join(current_dir, "config.json")
        config = ConfigLoader.load_config(config_path)
        
        # 设置日志
        logger = setup_unified_logging("ResetSolution", config)
        
        # 创建 WebClient 实例
        client = WebClient(config)
        
        # 认证评测机
        logger.info(f"开始重置提交 {solution_id} 的状态...")
        if not client._authenticate():
            logger.error("评测机登录失败，请检查配置和网络连接")
            return False
        
        # 直接调用后端接口重置状态为 Pending
        # Pending 状态对应 result=0（在数据库中）
        data = {
            "solution_id": solution_id,
            "task_status": "pending",  # 任务状态
            "judge_result_data": {
                "judge_result": "Pending",
                "result": 0,  # 0 表示 Pending
                "time": 0,
                "memory": 0,
                "message": "手动重置为Pending状态"
            }
        }
        
        result = client._make_request('POST', 'updatesolution', json=data)
        success = result and result.get('code') == 1
        
        if success:
            logger.info(f"✓ 成功将提交 {solution_id} 重置为 Pending 状态")
            return True
        else:
            logger.error(f"✗ 重置提交 {solution_id} 状态失败")
            return False
            
    except Exception as e:
        print(f"重置提交状态时发生错误：{e}")
        import traceback
        traceback.print_exc()
        return False
    finally:
        # 关闭 WebClient 连接
        if 'client' in locals():
            client.close()


def main():
    """主函数：解析命令行参数并执行重置操作"""
    if len(sys.argv) < 2:
        print("用法: python debug/reset_solution.py <solution_id>")
        print("示例: python debug/reset_solution.py 416550")
        print("\n功能：将指定的提交状态重置为 Pending，用于测试评测流程")
        sys.exit(1)
    
    try:
        solution_id = int(sys.argv[1])
    except ValueError:
        print(f"错误：无效的提交ID '{sys.argv[1]}'，必须是数字")
        sys.exit(1)
    
    if solution_id <= 0:
        print(f"错误：提交ID必须大于0，当前值：{solution_id}")
        sys.exit(1)
    
    # 执行重置操作
    success = reset_solution_to_pending(solution_id)
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()

