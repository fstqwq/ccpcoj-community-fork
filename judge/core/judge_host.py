#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
CSGOJ judge2 评测机主进程
基于seccomp的安全评测系统
"""

import configparser
import os
import sys
import time
import signal
import argparse
import subprocess
import requests
from typing import Dict, Any

# 将当前目录添加到Python路径
current_dir = os.path.dirname(os.path.abspath(__file__))
if current_dir not in sys.path:
    sys.path.insert(0, current_dir)

from tools.web_client import WebClient
from tools.config_loader import ConfigLoader
from tools.debug_manager import DebugManager, setup_unified_logging, is_debug_enabled

class JudgeHost:
    def __init__(self, config_path: str = None, initialize_config: bool = False):
        """初始化评测机主进程"""
        # 根据参数决定是否初始化配置
        if initialize_config:
            self.config = ConfigLoader.initialize_config(config_path)
        else:
            self.config = ConfigLoader.load_config(config_path)
        
        self.setup_logging()
        self.running = True
        self.judge_process = None
        
        # 初始化Web客户端
        self.web_client = WebClient(self.config)
        
        # 注册信号处理
        signal.signal(signal.SIGTERM, self.signal_handler)
        signal.signal(signal.SIGINT, self.signal_handler)
        
        self.logger.info("评测机主进程启动")
    
    def setup_logging(self):
        """设置日志系统"""
        self.logger = setup_unified_logging("JudgeHost", self.config)
    
    def signal_handler(self, signum, frame):
        """信号处理函数"""
        self.logger.info(f"收到信号 {signum}，正在停止评测机...")
        self.running = False
        
        if self.judge_process:
            self.logger.info("终止当前评测进程")
            self.judge_process.terminate()
            try:
                self.judge_process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                self.judge_process.kill()
        
        sys.exit(0)
    
    
    def get_pending_tasks(self) -> list:
        """获取待评测任务"""
        if is_debug_enabled():
            self.logger.debug("获取待评测任务...")
        
        try:
            tasks = self.web_client.get_pending_tasks(max_tasks=1)
            
            # 检查是否因为网络问题返回了空列表
            if tasks is None:
                # 记录详细的错误信息
                consecutive_failures = getattr(self.web_client, 'consecutive_failures', 0)
                is_authenticated = getattr(self.web_client, 'is_authenticated', False)
                
                error_info = {
                    "连续失败次数": consecutive_failures,
                    "认证状态": "已认证" if is_authenticated else "未认证",
                    "可能原因": "网络连接失败或连接池中的连接已失效"
                }
                
                self.logger.error(f"获取待评测任务失败（网络错误或认证失败）：{error_info}")
                return []
            
            if is_debug_enabled():
                self.logger.debug(f"获取到 {len(tasks)} 个待评测任务")
                for i, task in enumerate(tasks):
                    self.logger.debug(f"  任务 {i+1}: {task}")
            
            return tasks
        except requests.exceptions.ConnectionError as e:
            # 检查是否是连接过期异常
            if "连接已过期" in str(e) or "需要回收连接池" in str(e):
                self.logger.error(
                    f"【获取任务-连接过期】检测到连接过期异常，将在主循环中回收连接！"
                    f" 异常: {type(e).__name__}, "
                    f"消息: {str(e)}"
                )
                # 标记需要回收连接
                if hasattr(self.web_client, '_connection_error_detected'):
                    self.web_client._connection_error_detected = True
            else:
                import traceback
                self.logger.error(
                    f"【获取任务-连接异常】获取待评测任务时发生连接异常！"
                    f" 异常类型: {type(e).__name__}, "
                    f"异常消息: {str(e)}, "
                    f"堆栈跟踪: {traceback.format_exc()}"
                )
            return []
        except Exception as e:
            # 记录详细的异常信息 - 强制记录完整堆栈
            import traceback
            error_info = {
                "异常类型": type(e).__name__,
                "异常消息": str(e),
                "连续失败次数": getattr(self.web_client, 'consecutive_failures', 0),
                "认证状态": "已认证" if getattr(self.web_client, 'is_authenticated', False) else "未认证",
                "堆栈跟踪": traceback.format_exc()
            }
            self.logger.error(
                f"【获取任务-未知异常】获取待评测任务时发生异常！"
                f" 完整错误信息: {error_info}"
            )
            return []
    
    def run_judge_client(self, solution_id: int) -> int:
        """运行评测客户端
        
        Args:
            solution_id: 解决方案ID
            
        Returns:
            int: 返回码（0表示成功）
        """
        try:
            # 构建评测客户端命令（judge_client.py 接收 solution_id 作为位置参数）
            # judge_client.py 会自动查找配置文件，不需要传递 --config 参数
            cmd = ["python3", "judge_client.py", str(solution_id)]
            
            self.logger.info(f"启动评测客户端：{' '.join(cmd)}")
            
            # 启动评测进程
            self.judge_process = subprocess.Popen(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                cwd=current_dir  # 确保在正确的目录下运行
            )
            
            # 等待评测完成（设置超时，防止卡死）
            # 注意：judge_client可能执行很长时间，但通常不会超过1小时
            # 如果超过1小时，可能是卡死了，需要强制终止
            communicate_timeout = 3600  # 1小时超时
            try:
                stdout, stderr = self.judge_process.communicate(timeout=communicate_timeout)
                return_code = self.judge_process.returncode
            except subprocess.TimeoutExpired:
                # 强制终止进程
                self.judge_process.kill()
                stdout, stderr = self.judge_process.communicate()
                return_code = self.judge_process.returncode
                self.logger.error(
                    f"评测客户端执行超时，已强制终止，任务ID: {solution_id}, "
                    f"返回码: {return_code}"
                )
            
            self.logger.info(f"评测客户端完成，返回码：{return_code}")
            if is_debug_enabled():
                if stdout:
                    self.logger.debug(f"评测输出：{stdout}")
                if stderr:
                    self.logger.debug(f"评测错误：{stderr}")
            
            return return_code
            
        except Exception as e:
            self.logger.error(f"运行评测客户端时发生错误：{e}", exc_info=True)
            return -1
    
    def process_task(self, task: Dict[str, Any]):
        """处理单个评测任务
        
        注意：所有任务状态更新、数据下载、工作目录管理等都由 judge_client.py 负责处理
        主进程只负责启动评测客户端并等待其完成
        """
        solution_id = task["solution_id"]
        self.logger.info(f"开始处理任务 {solution_id}")
        
        try:
            # 运行评测客户端（所有逻辑都在 judge_client.py 中处理）
            result_code = self.run_judge_client(solution_id)
            
            if result_code == 0:
                self.logger.info(f"任务 {solution_id} 评测完成")
            else:
                self.logger.warning(f"任务 {solution_id} 评测失败，返回码：{result_code}")
                
        except Exception as e:
            self.logger.error(f"处理任务 {solution_id} 时发生错误：{e}")
        finally:
            # 每次任务后强制清理内存
            self._force_memory_cleanup()
    
    def _force_memory_cleanup(self):
        """暴力内存回收（评测机主进程）"""
        try:
            import gc
            collected = gc.collect()
            if collected > 0 and is_debug_enabled():
                self.logger.debug(f"GC 回收了 {collected} 个对象")
            
            self._force_cleanup_mounts()
            self._recycle_web_client()
        except Exception as e:
            if is_debug_enabled():
                self.logger.debug(f"暴力内存清理时发生错误: {e}")
    
    def _force_cleanup_mounts(self):
        """强制清理当前容器工作目录下的所有挂载点"""
        import subprocess
        work_dir_base = self.config.get("judge", {}).get("work_dir", "/judge/workspace")
        if not os.path.exists(work_dir_base):
            return
        try:
            result = subprocess.run(
                ["findmnt", "-n", "-o", "TARGET"],
                capture_output=True, text=True, timeout=5
            )
            if result.returncode == 0:
                unmount_count = 0
                for mount_point in result.stdout.split('\n'):
                    mount_point = mount_point.strip()
                    if mount_point and work_dir_base in mount_point:
                        try:
                            subprocess.run(["umount", "-l", mount_point], 
                                        timeout=2, capture_output=True)
                            unmount_count += 1
                        except Exception:
                            pass
                if unmount_count > 0 and is_debug_enabled():
                    self.logger.debug(f"清理了 {unmount_count} 个残留挂载点")
        except Exception as e:
            if is_debug_enabled():
                self.logger.debug(f"清理挂载点时发生错误: {e}")
    
    def _recycle_web_client(self):
        """关闭并重新创建 WebClient Session（释放连接池内存）"""
        try:
            if hasattr(self, 'web_client') and hasattr(self.web_client, 'session'):
                # 记录回收前的详细状态
                consecutive_failures_before = getattr(self.web_client, 'consecutive_failures', 0)
                connection_age_before = None
                if hasattr(self.web_client, 'connection_created_at') and self.web_client.connection_created_at:
                    connection_age_before = time.time() - self.web_client.connection_created_at
                is_authenticated_before = getattr(self.web_client, 'is_authenticated', False)
                
                recycle_info = {
                    "回收前连续失败次数": consecutive_failures_before,
                    "回收前连接年龄": f"{connection_age_before/60:.1f}分钟" if connection_age_before else "未知",
                    "回收前认证状态": "已认证" if is_authenticated_before else "未认证"
                }
                self.logger.info(f"【连接回收开始】回收前状态: {recycle_info}")
                
                try:
                    self.web_client.close()
                    self.logger.info("WebClient Session 已关闭，准备重新创建")
                except Exception as e:
                    self.logger.error(f"【连接回收错误】关闭 WebClient Session 时发生错误: {e}", exc_info=True)
                
                # 重新创建 WebClient（这会重置连接创建时间）
                self.web_client = WebClient(self.config)
                self.logger.info(
                    f"【连接回收完成】WebClient Session 已回收并重新创建。"
                    f" 回收前连续失败: {consecutive_failures_before}, "
                    f"回收前连接年龄: {recycle_info['回收前连接年龄']}"
                )
            else:
                self.logger.warning("【连接回收】WebClient 或 Session 不存在，跳过回收")
        except Exception as e:
            self.logger.error(f"【连接回收异常】回收 WebClient 时发生错误: {e}", exc_info=True)
    
    def main_loop(self):
        """主循环"""
        self.logger.info("开始主循环")
        sleep_time = 3
        try:
            sleep_time = int(self.config["judge"]["sleep_time"])
        except Exception:
            sleep_time = 3
            self.logger.warning("评测机配置文件中没有设置 sleep_time，使用默认值 3")
        
        consecutive_empty_cycles = 0  # 连续空循环次数
        max_consecutive_empty_cycles = 10  # 最大连续空循环次数（用于检测是否卡住）
        loop_count = 0  # 主循环计数器（用于定期回收连接）
        connection_recycle_interval = 100  # 每100次循环回收一次连接（约5分钟，假设sleep_time=3）
        
        # 基于时间的连接回收：记录上次回收时间
        last_connection_recycle_time = time.time()
        connection_recycle_interval_seconds = 45 * 60  # 每45分钟强制回收一次连接（比1小时稍短）
        
        while self.running:
            try:
                loop_count += 1
                
                # 基于时间的连接回收（优先于基于循环次数的回收）
                current_time = time.time()
                time_since_last_recycle = current_time - last_connection_recycle_time
                if time_since_last_recycle >= connection_recycle_interval_seconds:
                    self.logger.info(
                        f"【主循环-定时回收】基于时间的连接回收触发！"
                        f" 距离上次回收: {time_since_last_recycle/60:.1f}分钟, "
                        f"循环次数: {loop_count}"
                    )
                    self._recycle_web_client()
                    last_connection_recycle_time = current_time
                # 定期回收连接（即使没有任务，也要定期清理连接池）
                elif loop_count % connection_recycle_interval == 0:
                    self.logger.info(
                        f"【主循环-定期回收】基于循环次数的连接回收触发！"
                        f" 循环次数: {loop_count}, "
                        f"距离上次回收: {time_since_last_recycle/60:.1f}分钟"
                    )
                    self._recycle_web_client()
                    last_connection_recycle_time = current_time
                
                # 检查WebClient连接是否过期或检测到连接错误
                if hasattr(self.web_client, 'is_connection_expired') and self.web_client.is_connection_expired():
                    connection_age = time.time() - self.web_client.connection_created_at if hasattr(self.web_client, 'connection_created_at') and self.web_client.connection_created_at else 0
                    self.logger.error(
                        f"【主循环-连接过期检测】检测到连接已过期，立即回收连接！"
                        f" 连接年龄: {connection_age/60:.1f}分钟, "
                        f"循环次数: {loop_count}"
                    )
                    self._recycle_web_client()
                    last_connection_recycle_time = time.time()
                elif hasattr(self.web_client, '_connection_error_detected') and self.web_client._connection_error_detected:
                    self.logger.error(
                        f"【主循环-连接错误检测】检测到连接错误标志，立即回收连接！"
                        f" 循环次数: {loop_count}, "
                        f"连续失败: {getattr(self.web_client, 'consecutive_failures', 0)}"
                    )
                    self._recycle_web_client()
                    last_connection_recycle_time = time.time()
                
                # 获取待评测任务
                tasks = self.get_pending_tasks()
                
                if tasks:
                    consecutive_empty_cycles = 0  # 重置连续空循环计数
                    self.logger.info(f"获取到 {len(tasks)} 个待评测任务")
                    
                    # 处理第一个任务（单任务模式）
                    task = tasks[0]
                    self.process_task(task)
                    # 处理完成后立即进入下一次循环（不等待）
                else:
                    # 没有任务时休眠
                    consecutive_empty_cycles += 1
                    
                    # 如果连续多次空循环，记录日志（可能是网络问题或服务器问题）
                    if consecutive_empty_cycles >= max_consecutive_empty_cycles:
                        # 检查WebClient的连续失败次数
                        if hasattr(self.web_client, 'consecutive_failures') and self.web_client.consecutive_failures > 0:
                            self.logger.warning(
                                f"连续 {consecutive_empty_cycles} 次未获取到任务，"
                                f"WebClient连续失败 {self.web_client.consecutive_failures} 次，"
                                f"可能是网络问题或连接池问题。尝试回收连接..."
                            )
                            # 检测到连续失败时，主动回收连接
                            self._recycle_web_client()
                        else:
                            # 正常情况：没有待评测任务
                            if consecutive_empty_cycles == max_consecutive_empty_cycles:
                                self.logger.info(f"连续 {consecutive_empty_cycles} 次未获取到任务，继续等待...")
                    time.sleep(sleep_time)
                
            except KeyboardInterrupt:
                self.logger.info("收到中断信号，退出主循环")
                break
            except Exception as e:
                self.logger.error(f"主循环中发生错误：{e}", exc_info=True)
                # 错误后等待，但不要永久停止
                time.sleep(5)  # 错误后等待5秒再继续
                consecutive_empty_cycles = 0  # 重置计数，因为发生了异常
        
        self.logger.info("主循环结束")

def main():
    """主函数"""
    parser = argparse.ArgumentParser(description="CSGOJ judge2 评测机主进程")
    parser.add_argument("--work-dir", help="工作目录")
    
    # 使用统一的调试参数解析
    args = DebugManager.parse_debug_args(parser)
    
    # 设置工作目录
    if args.work_dir:
        os.chdir(args.work_dir)
    
    # 确定配置文件路径（与 judge_client.py 保持一致）
    if args.config:
        config_path = args.config
    else:
        # 使用默认配置文件路径（judge_host.py 所在目录的 config.json）
        config_path = os.path.join(current_dir, "config.json")
    print('use config:', config_path)
    # 确定是否初始化配置（非debug模式启动时初始化）
    initialize_config = not is_debug_enabled()
    
    # 创建评测机主进程
    judge_host = JudgeHost(config_path, initialize_config=initialize_config)
    
    # 启动主循环
    judge_host.main_loop()

if __name__ == "__main__":
    main()
