#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
评测机调试工具：测试完整的评测流程

功能说明：
    模拟 judge_host 的完整评测流程，包括：
    1. 获取待评测任务（checkout，将状态改为 compiling）
    2. 执行 judge_client 进行评测
    3. 检查最终状态
    
    用于调试评测流程中的问题，特别是：
    - checkout 后状态是否正确更新
    - judge_client 是否正确执行
    - 评测结果是否正确反馈到后端
    - 状态更新是否及时

调用方法：
    1. 在容器内执行（推荐）：
       docker exec -it <容器名> sh -c "cd /core && python debug/test_judge_flow.py <solution_id>"
    
    2. 直接执行（需要在容器内）：
       cd /core
       python debug/test_judge_flow.py <solution_id>
    
    3. 测试多个提交：
       for sid in 416550 416551 416552; do
           python debug/test_judge_flow.py $sid
           sleep 2
       done

参数说明：
    solution_id: 要测试的提交ID（必填）
                注意：提交必须是 Pending 状态，否则无法 checkout

可选环境变量：
    CSGOJ_LOG_LEVEL=DEBUG: 启用详细日志输出
    CSGOJ_DEBUG=1: 启用调试模式

返回值：
    成功：返回 0
    失败：返回 1

使用示例：
    # 1. 先将提交重置为 Pending
    python debug/reset_solution.py 416550
    
    # 2. 测试评测流程
    python debug/test_judge_flow.py 416550
    
    # 3. 查看详细日志
    CSGOJ_LOG_LEVEL=DEBUG python debug/test_judge_flow.py 416550

输出说明：
    脚本会输出以下信息：
    - 获取到的任务信息
    - checkout 后的状态
    - judge_client 的执行结果
    - 最终的状态

注意事项：
    1. 需要确保评测机已正确配置（config.json）
    2. 需要确保评测机账号有权限访问评测接口
    3. 提交必须是 Pending 状态才能 checkout
    4. judge_client 的执行时间取决于题目复杂度和数据量
    5. 建议在测试环境中使用
"""

import sys
import os
import subprocess
import time

# 将当前目录添加到Python路径，确保可以导入 core 目录下的模块
current_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if current_dir not in sys.path:
    sys.path.insert(0, current_dir)

from tools.web_client import WebClient
from tools.config_loader import ConfigLoader
from tools.debug_manager import setup_unified_logging


def test_judge_flow(solution_id: int) -> bool:
    """
    测试完整的评测流程
    
    Args:
        solution_id: 要测试的提交ID
    
    Returns:
        bool: 成功返回 True，失败返回 False
    """
    try:
        # 加载配置
        config_path = os.path.join(current_dir, "config.json")
        config = ConfigLoader.load_config(config_path)
        
        # 设置日志
        logger = setup_unified_logging("TestJudgeFlow", config)
        
        # 创建 WebClient 实例
        client = WebClient(config)
        
        # 认证评测机
        logger.info(f"=== 开始测试提交 {solution_id} 的评测流程 ===")
        if not client._authenticate():
            logger.error("评测机登录失败，请检查配置和网络连接")
            return False
        
        # 步骤1：检查提交当前状态
        logger.info("\n[步骤1] 检查提交当前状态...")
        solution_info = client.get_solution_info(solution_id)
        if solution_info:
            result = solution_info.get('result')
            logger.info(f"提交 {solution_id} 当前状态: result={result}")
            if result is not None and result != 0:
                logger.warning(f"警告：提交 {solution_id} 当前状态不是 Pending (0)，而是 {result}")
                logger.warning("建议先使用 reset_solution.py 重置为 Pending 状态")
        else:
            logger.warning(f"无法获取提交 {solution_id} 的信息")
        
        # 步骤2：获取待评测任务（checkout，会将状态改为 compiling）
        logger.info("\n[步骤2] 获取待评测任务（checkout）...")
        # 注意：get_pending_tasks 默认会 checkout（flg_checkout=1）
        # 这会改变提交状态为 compiling (result=2)
        # 通过直接调用 getpending 接口，传入 flg_checkout=1
        params = {"max_tasks": 1, "flg_checkout": 1}
        result = client._make_request('GET', 'getpending', params=params)
        if result and result.get('code') == 1:
            tasks = result.get('data', [])
        else:
            tasks = []
        
        if not tasks:
            logger.warning("没有获取到待评测任务")
            logger.info("可能原因：")
            logger.info("  1. 提交状态不是 Pending")
            logger.info("  2. 提交已被其他评测机 checkout")
            logger.info("  3. 提交不符合评测机的限制条件（题目列表、语言等）")
            return False
        
        task = tasks[0]
        actual_solution_id = task.get('solution_id')
        logger.info(f"获取到任务: solution_id={actual_solution_id}, problem_id={task.get('problem_id')}, language={task.get('language')}")
        
        # 如果获取到的任务不是指定的提交，给出提示
        if actual_solution_id != solution_id:
            logger.warning(f"注意：获取到的任务ID ({actual_solution_id}) 与指定的ID ({solution_id}) 不一致")
            logger.info("将继续测试获取到的任务")
            solution_id = actual_solution_id
        
        # 步骤3：检查 checkout 后的状态（应该变为 compiling）
        logger.info("\n[步骤3] 检查 checkout 后的状态...")
        time.sleep(0.5)  # 等待状态更新
        solution_info = client.get_solution_info(solution_id)
        if solution_info:
            result = solution_info.get('result')
            logger.info(f"checkout 后的状态: result={result}")
            if result == 2:
                logger.info("✓ 状态已正确更新为 compiling (2)")
            else:
                logger.warning(f"警告：状态不是 compiling (2)，而是 {result}")
        else:
            logger.warning(f"无法获取提交 {solution_id} 的信息")
        
        # 步骤4：启动 judge_client 进行评测
        logger.info("\n[步骤4] 启动 judge_client 进行评测...")
        judge_client_path = os.path.join(current_dir, "judge_client.py")
        cmd = ["python3", judge_client_path, str(solution_id)]
        
        # 如果设置了调试模式，添加 debug 参数
        if os.environ.get('CSGOJ_DEBUG') == '1' or os.environ.get('CSGOJ_LOG_LEVEL') == 'DEBUG':
            cmd.append("debug")
        
        logger.info(f"执行命令: {' '.join(cmd)}")
        logger.info(f"工作目录: {current_dir}")
        
        # 启动子进程
        process = subprocess.Popen(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            cwd=current_dir
        )
        
        logger.info(f"进程已启动，PID: {process.pid}")
        
        # 步骤5：等待执行完成
        logger.info("\n[步骤5] 等待 judge_client 执行完成...")
        logger.info("（执行时间取决于题目复杂度和数据量，请耐心等待）")
        
        try:
            # 设置超时时间（1小时，足够大多数评测完成）
            stdout, stderr = process.communicate(timeout=3600)
            return_code = process.returncode
            
            logger.info(f"执行完成，返回码: {return_code}")
            
            # 输出执行结果
            if stdout:
                # 只输出最后50行，避免输出过多
                lines = stdout.strip().split('\n')
                if len(lines) > 50:
                    logger.info("标准输出（最后50行）:")
                    for line in lines[-50:]:
                        print(line)
                else:
                    logger.info("标准输出:")
                    print(stdout)
            
            if stderr:
                logger.warning("标准错误:")
                print(stderr)
            
            if return_code != 0:
                logger.error(f"judge_client 执行失败，返回码: {return_code}")
                return False
                
        except subprocess.TimeoutExpired:
            logger.error("执行超时（1小时），终止进程...")
            process.kill()
            stdout, stderr = process.communicate()
            return_code = process.returncode
            logger.error(f"进程已终止，返回码: {return_code}")
            return False
        
        # 步骤6：检查最终状态
        logger.info("\n[步骤6] 检查最终状态...")
        time.sleep(1)  # 等待状态更新
        solution_info = client.get_solution_info(solution_id)
        if solution_info:
            result = solution_info.get('result')
            logger.info(f"最终状态: result={result}")
            
            # 根据结果给出说明
            result_map = {
                0: "Pending (待评测)",
                1: "Pending Rejudging (待重测)",
                2: "Compiling (编译中)",
                3: "Running & Judging (运行中)",
                4: "Accepted (通过)",
                5: "Presentation Error (格式错误)",
                6: "Wrong Answer (答案错误)",
                7: "Time Limit Exceeded (超时)",
                8: "Memory Limit Exceeded (内存超限)",
                9: "Output Limit Exceeded (输出超限)",
                10: "Runtime Error (运行时错误)",
                11: "Compile Error (编译错误)",
                90: "Judge Failed (评测失败)",
                -10: "Similarity Check (查重中)"
            }
            
            result_desc = result_map.get(result, f"未知状态 ({result})")
            logger.info(f"状态说明: {result_desc}")
            
            if result in [4, 5, 6, 7, 8, 9, 10, 11, 90]:
                logger.info("✓ 评测已完成")
            elif result == 2:
                logger.warning("警告：状态仍然是 compiling，可能评测结果未正确反馈")
            elif result == 3:
                logger.info("状态为 running，评测可能仍在进行中")
            else:
                logger.info(f"状态为 {result_desc}")
        else:
            logger.warning(f"无法获取提交 {solution_id} 的最终信息")
        
        logger.info("\n=== 评测流程测试完成 ===")
        return True
        
    except Exception as e:
        print(f"测试过程中发生错误：{e}")
        import traceback
        traceback.print_exc()
        return False
    finally:
        # 关闭 WebClient 连接
        if 'client' in locals():
            client.close()


def main():
    """主函数：解析命令行参数并执行测试"""
    if len(sys.argv) < 2:
        print("用法: python debug/test_judge_flow.py <solution_id>")
        print("示例: python debug/test_judge_flow.py 416550")
        print("\n功能：测试完整的评测流程（checkout -> judge_client -> 状态检查）")
        print("\n注意：提交必须是 Pending 状态才能 checkout")
        print("      建议先使用 reset_solution.py 重置为 Pending 状态")
        sys.exit(1)
    
    try:
        solution_id = int(sys.argv[1])
    except ValueError:
        print(f"错误：无效的提交ID '{sys.argv[1]}'，必须是数字")
        sys.exit(1)
    
    if solution_id <= 0:
        print(f"错误：提交ID必须大于0，当前值：{solution_id}")
        sys.exit(1)
    
    # 执行测试
    success = test_judge_flow(solution_id)
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()

