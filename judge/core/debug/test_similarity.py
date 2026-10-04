#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
评测机调试工具：测试查重逻辑

功能说明：
    测试指定提交的查重逻辑是否正常工作，包括：
    1. 检查提交的当前状态和查重信息
    2. 重置提交为 Pending 状态
    3. 重新评测并触发查重
    4. 验证查重结果是否正确反馈

调用方法：
    1. 在容器内执行（推荐）：
       docker exec -it <容器名> sh -c "cd /core && python debug/test_similarity.py <solution_id>"
    
    2. 直接执行（需要在容器内）：
       cd /core
       python debug/test_similarity.py <solution_id>
    
    3. 批量测试多个提交：
       for sid in 416549 416276 416381 416292; do
           python debug/test_similarity.py $sid
           sleep 2
       done

参数说明：
    solution_id: 要测试的提交ID（必填）

可选环境变量：
    CSGOJ_LOG_LEVEL=DEBUG: 启用详细日志输出
    CSGOJ_DEBUG=1: 启用调试模式

返回值：
    成功：返回 0
    失败：返回 1

使用示例：
    # 测试单个提交的查重逻辑
    python debug/test_similarity.py 416549
    
    # 启用详细日志
    CSGOJ_LOG_LEVEL=DEBUG python debug/test_similarity.py 416549

注意事项：
    1. 需要确保评测机的查重开关已开启（similarity_check=1）
    2. 提交必须是 AC 状态才会触发查重
    3. 查重需要同步历史AC代码，可能需要一些时间
    4. 建议在测试环境中使用
"""

import sys
import os
import time

# 将当前目录添加到Python路径，确保可以导入 core 目录下的模块
current_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if current_dir not in sys.path:
    sys.path.insert(0, current_dir)

from tools.web_client import WebClient
from tools.config_loader import ConfigLoader
from tools.debug_manager import setup_unified_logging


def check_similarity_info(client: WebClient, solution_id: int) -> dict:
    """
    检查提交的查重信息（通过查询数据库）
    
    Args:
        client: WebClient 实例
        solution_id: 提交ID
    
    Returns:
        dict: 查重信息，包含 sim_s_id 和 sim 字段
    """
    # 注意：这里需要通过后端接口查询，或者直接查询数据库
    # 由于没有专门的接口，我们先检查基本信息
    solution_info = client.get_solution_info(solution_id)
    if not solution_info:
        return {}
    
    # 返回基本信息，实际查重信息需要通过数据库查询
    return {
        "solution_id": solution_id,
        "problem_id": solution_info.get("problem_id"),
        "user_id": solution_info.get("user_id"),
        "result": solution_info.get("result"),
        "note": "查重信息需要通过数据库查询 sim 表"
    }


def test_similarity_check(solution_id: int) -> bool:
    """
    测试查重逻辑
    
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
        logger = setup_unified_logging("TestSimilarity", config)
        
        # 创建 WebClient 实例
        client = WebClient(config)
        
        # 认证评测机
        logger.info(f"=== 开始测试提交 {solution_id} 的查重逻辑 ===")
        if not client._authenticate():
            logger.error("评测机登录失败，请检查配置和网络连接")
            return False
        
        # 步骤1：检查提交当前状态和查重信息
        logger.info("\n[步骤1] 检查提交当前状态...")
        solution_info = client.get_solution_info(solution_id)
        if not solution_info:
            logger.error(f"无法获取提交 {solution_id} 的信息")
            return False
        
        problem_id = solution_info.get("problem_id")
        user_id = solution_info.get("user_id")
        language = solution_info.get("language")
        result = solution_info.get("result")
        similarity_check_enabled = solution_info.get("similarity_check_enabled", 0)
        
        logger.info(f"提交信息:")
        logger.info(f"  题目ID: {problem_id}")
        logger.info(f"  用户ID: {user_id}")
        logger.info(f"  语言: {language}")
        logger.info(f"  当前状态: {result}")
        logger.info(f"  查重开关: {'开启' if similarity_check_enabled == 1 else '关闭'}")
        
        if similarity_check_enabled != 1:
            logger.warning("警告：评测机的查重开关未开启，查重不会执行")
            logger.warning("请在管理后台开启评测机的查重开关")
        
        # 步骤2：检查查重信息（如果有）
        logger.info("\n[步骤2] 检查现有查重信息...")
        sim_info = check_similarity_info(client, solution_id)
        logger.info(f"查重信息: {sim_info}")
        
        # 步骤3：重置提交为 Pending 状态
        logger.info("\n[步骤3] 重置提交为 Pending 状态...")
        data = {
            "solution_id": solution_id,
            "task_status": "pending",
            "judge_result_data": {
                "judge_result": "Pending",
                "result": 0,
                "time": 0,
                "memory": 0,
                "message": "手动重置为Pending状态（测试查重）"
            }
        }
        reset_result = client._make_request('POST', 'updatesolution', json=data)
        if reset_result and reset_result.get('code') == 1:
            logger.info("✓ 提交已重置为 Pending 状态")
        else:
            logger.error(f"✗ 重置失败: {reset_result}")
            return False
        
        # 步骤4：等待一下，然后通过 judge_host 获取任务
        logger.info("\n[步骤4] 等待 judge_host 获取任务...")
        time.sleep(1)
        
        # 步骤5：模拟 judge_host 的 checkout 流程
        logger.info("\n[步骤5] 执行 checkout（获取待评测任务）...")
        params = {"max_tasks": 1, "flg_checkout": 1}
        checkout_result = client._make_request('GET', 'getpending', params=params)
        if checkout_result and checkout_result.get('code') == 1:
            tasks = checkout_result.get('data', [])
            if tasks:
                task = tasks[0]
                actual_sid = task.get('solution_id')
                if actual_sid == solution_id:
                    logger.info(f"✓ 成功 checkout 提交 {solution_id}")
                else:
                    logger.warning(f"注意：checkout 到的是提交 {actual_sid}，不是 {solution_id}")
                    logger.info("将继续测试 checkout 到的提交")
                    solution_id = actual_sid
            else:
                logger.warning("没有获取到待评测任务")
        else:
            logger.error(f"✗ checkout 失败: {checkout_result}")
            return False
        
        # 步骤6：检查 checkout 后的状态
        logger.info("\n[步骤6] 检查 checkout 后的状态...")
        time.sleep(0.5)
        solution_info = client.get_solution_info(solution_id)
        if solution_info:
            result = solution_info.get('result')
            logger.info(f"checkout 后的状态: {result}")
            if result == 2:
                logger.info("✓ 状态已正确更新为 compiling (2)")
            else:
                logger.warning(f"警告：状态不是 compiling (2)，而是 {result}")
        
        # 步骤7：执行 judge_client 进行评测（这会触发查重）
        logger.info("\n[步骤7] 执行 judge_client 进行评测（将触发查重）...")
        logger.info("（如果提交是 AC 且查重开关开启，将自动执行查重）")
        
        import subprocess
        judge_client_path = os.path.join(current_dir, "judge_client.py")
        cmd = ["python3", judge_client_path, str(solution_id)]
        
        if os.environ.get('CSGOJ_DEBUG') == '1' or os.environ.get('CSGOJ_LOG_LEVEL') == 'DEBUG':
            cmd.append("debug")
        
        logger.info(f"执行命令: {' '.join(cmd)}")
        
        process = subprocess.Popen(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            cwd=current_dir
        )
        
        logger.info(f"进程已启动，PID: {process.pid}")
        logger.info("等待评测完成（包括查重）...")
        
        try:
            stdout, stderr = process.communicate(timeout=600)  # 10分钟超时
            return_code = process.returncode
            
            logger.info(f"执行完成，返回码: {return_code}")
            
            # 输出关键日志（包含查重相关）
            if stdout:
                lines = stdout.strip().split('\n')
                # 查找查重相关的日志
                similarity_logs = [line for line in lines if '查重' in line or 'similarity' in line.lower() or 'simhash' in line.lower() or 'jplag' in line.lower()]
                if similarity_logs:
                    logger.info("\n查重相关日志:")
                    for log in similarity_logs[-20:]:  # 最后20条
                        print(f"  {log}")
                else:
                    logger.info("未找到查重相关日志（可能查重未执行或日志在其他位置）")
            
            if stderr:
                logger.warning("标准错误:")
                print(stderr[:500])  # 只显示前500字符
            
            if return_code != 0:
                logger.error(f"judge_client 执行失败，返回码: {return_code}")
                return False
                
        except subprocess.TimeoutExpired:
            logger.error("执行超时（10分钟），终止进程...")
            process.kill()
            stdout, stderr = process.communicate()
            return_code = process.returncode
            logger.error(f"进程已终止，返回码: {return_code}")
            return False
        
        # 步骤8：检查最终状态和查重结果
        logger.info("\n[步骤8] 检查最终状态和查重结果...")
        time.sleep(1)
        solution_info = client.get_solution_info(solution_id)
        if solution_info:
            result = solution_info.get('result')
            logger.info(f"最终状态: {result}")
            
            if result == 4:  # AC
                logger.info("✓ 提交状态为 AC")
                logger.info("注意：查重信息需要通过数据库查询 sim 表来验证")
                logger.info("可以使用以下 SQL 查询:")
                logger.info(f"  SELECT * FROM sim WHERE s_id = {solution_id};")
            else:
                logger.warning(f"提交状态不是 AC ({result})，查重可能未执行")
        
        logger.info("\n=== 查重逻辑测试完成 ===")
        logger.info("提示：请检查数据库 sim 表确认查重结果是否正确保存")
        
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
        print("用法: python debug/test_similarity.py <solution_id>")
        print("示例: python debug/test_similarity.py 416549")
        print("\n功能：测试指定提交的查重逻辑是否正常工作")
        print("\n注意：需要确保评测机的查重开关已开启")
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
    success = test_similarity_check(solution_id)
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()

