#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
CSGOJ judge2 Web交互基类
封装与Web后端的通用交互逻辑
"""

import os
import sys
import json
import time
import logging
import requests
import requests.utils
import tempfile
from functools import wraps
from typing import Dict, Any, Optional, List, Callable
from datetime import datetime
from urllib.parse import urljoin
import re

# 将当前目录和父目录添加到Python路径
current_dir = os.path.dirname(os.path.abspath(__file__))
parent_dir = os.path.dirname(current_dir)
if current_dir not in sys.path:
    sys.path.insert(0, current_dir)
if parent_dir not in sys.path:
    sys.path.insert(0, parent_dir)

from tools.debug_manager import is_debug_enabled, log_error_with_context
import json as json_module
from tools import status_constants as sc

def sanitize_error_info(error_info: Dict[str, Any]) -> Dict[str, Any]:
    """
    清理错误信息中的非打印控制字符和异常字符
    
    Args:
        error_info: 结构化的错误信息 {"data_type": "txt", "data": "..."}
    
    Returns:
        清理后的错误信息，包含额外的元数据字段
    """
    if not isinstance(error_info, dict):
        return error_info
    
    # 创建清理后的副本
    sanitized_info = error_info.copy()
    
    # 如果包含 data 字段，进行清理
    if 'data' in sanitized_info and isinstance(sanitized_info['data'], str):
        data = sanitized_info['data']
        
        # 移除或替换非打印控制字符
        # 保留常见的控制字符：\n, \r, \t
        # 移除其他控制字符（ASCII 0-31，除了 9, 10, 13）
        cleaned_data = ''
        for char in data:
            char_code = ord(char)
            if char_code == 9 or char_code == 10 or char_code == 13:  # \t, \n, \r
                cleaned_data += char
            elif char_code >= 32 and char_code <= 126:  # 可打印ASCII字符
                cleaned_data += char
            elif char_code >= 128:  # 扩展字符（包括中文等）
                cleaned_data += char
            else:
                # 替换其他控制字符为可见的占位符
                cleaned_data += f'[\\x{char_code:02x}]'
        
        # 检测常见的二进制文件头标识
        binary_headers = {
            b'\x7fELF': 'ELF可执行文件',
            b'PE\x00\x00': 'Windows PE可执行文件', 
            b'MZ': 'DOS/Windows可执行文件',
            b'\x89PNG': 'PNG图片文件',
            b'\xff\xd8\xff': 'JPEG图片文件',
            b'GIF8': 'GIF图片文件',
            b'PK\x03\x04': 'ZIP压缩文件',
            b'Rar!': 'RAR压缩文件',
            b'\x1f\x8b': 'GZIP压缩文件',
        }
        
        detected_binary = None
        for header, description in binary_headers.items():
            if header in data.encode('latin-1', errors='ignore'):
                detected_binary = {
                    'header_hex': header.hex(),
                    'description': description,
                    'header_bytes': list(header)
                }
                break
        
        # 如果检测到二进制文件头，添加到元数据中
        if detected_binary:
            sanitized_info['binary_detection'] = detected_binary
        
        # 限制长度，避免过长的错误信息
        if len(cleaned_data) > 10000:  # 10KB限制
            sanitized_info['truncated'] = True
            sanitized_info['original_length'] = len(cleaned_data)
            cleaned_data = cleaned_data[:10000] + "\n[错误信息过长，已截断...]"
        
        sanitized_info['data'] = cleaned_data
    
    return sanitized_info

def require_auth(func):
    """认证装饰器：确保方法调用前已认证"""
    @wraps(func)
    def wrapper(self, *args, **kwargs):
        # 强制显示调试信息
        if is_debug_enabled():
            self.logger.debug(f"  方法: {func.__name__}")
            self.logger.debug(f"  认证状态: {self.is_authenticated}")
            self.logger.debug(f"  参数: args={args}, kwargs={kwargs}")
        
        # 确保已认证
        if not self.is_authenticated:
            if is_debug_enabled():
                self.logger.debug(f"未认证，尝试重新登录...")
            if not self._authenticate():
                self.logger.warning(f"认证失败，无法调用方法: {func.__name__}，将返回默认值")
                # 根据函数返回类型返回适当的默认值
                if func.__annotations__.get('return') == bool:
                    return False
                elif 'Optional' in str(func.__annotations__.get('return', '')):
                    return None
                elif 'List' in str(func.__annotations__.get('return', '')):
                    return []
                else:
                    return None
        
        if is_debug_enabled():
            self.logger.debug(f"认证成功，调用方法: {func.__name__}")
        
        return func(self, *args, **kwargs)
    return wrapper

class WebClient:
    def __init__(self, config: Dict[str, Any]):
        """初始化Web客户端"""
        # 类型检查：确保 config 是字典
        if not isinstance(config, dict):
            error_msg = f"配置参数类型错误：期望 dict，实际为 {type(config).__name__}。值: {config}"
            raise TypeError(error_msg)
        
        self.config = config
        
        # 使用统一的日志系统
        from tools.debug_manager import get_debug_logger
        self.logger = get_debug_logger("WebClient")
        
        # 强制显示调试信息
        if is_debug_enabled():
            self.logger.debug(f"=== WebClient 初始化 ===")
            self.logger.debug(f"  配置: {config}")
        
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'CSGOJ-25-WebClient/1.0',
            'Content-Type': 'application/json',
            'X-Requested-With': 'XMLHttpRequest',    # ThinkPHP 的 ajax 判断依据
            'Accept-Encoding': 'gzip, deflate',      # 显式声明支持 gzip 与 deflate
            'Connection': 'keep-alive'               # 保持连接
        })
        
        # 配置HTTP连接池适配器，优化连接复用和错误处理
        from requests.adapters import HTTPAdapter
        from urllib3.util.retry import Retry
        
        # 配置重试策略
        retry_strategy = Retry(
            total=3,
            backoff_factor=0.3,
            status_forcelist=[500, 502, 503, 504],
            allowed_methods=["HEAD", "GET", "PUT", "DELETE", "OPTIONS", "TRACE", "POST"]
        )
        
        # 配置连接池适配器
        # 注意：urllib3的连接池默认会重用连接，但不会自动检测连接是否已失效
        # 我们需要通过定期回收和错误检测来确保连接的有效性
        adapter = HTTPAdapter(
            pool_connections=10,      # 连接池数量
            pool_maxsize=10,          # 每个连接池的最大连接数
            max_retries=retry_strategy,
            pool_block=False          # 连接池满时不阻塞
        )
        
        # 为HTTP和HTTPS协议挂载适配器
        self.session.mount('http://', adapter)
        self.session.mount('https://', adapter)
        
        if is_debug_enabled():
            self.logger.debug("HTTP连接池配置完成：pool_connections=10, pool_maxsize=10")
        
        # 设置基础URL
        self.base_url = config.get('server', {}).get('base_url', 'http://localhost')
        self.api_path = config.get('server', {}).get('api_path', '/ojtool/judge2')
        
        # 设置 cookie 缓存文件路径
        work_dir = config.get('judge', {}).get('work_dir', '/tmp')
        # if not os.path.isabs(work_dir):
        #     # 如果是相对路径，使用当前目录
        #     work_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), work_dir)
        cookie_dir = os.path.join(work_dir, '.webclient_cache')
        os.makedirs(cookie_dir, exist_ok=True)
        self.cookie_file = os.path.join(cookie_dir, 'cookies.json')
        
        # 认证状态
        self.is_authenticated = False
        self.max_retries = 3
        self.retry_delay = 1  # 秒
        self.max_retry_delay = 30  # 最大重试延迟（秒）
        self.consecutive_failures = 0  # 连续失败次数
        
        # 连接管理：记录连接创建时间，用于判断连接是否过期
        self.connection_created_at = time.time()  # 连接创建时间戳
        self.connection_max_age = 45 * 60  # 连接最大生存时间（45分钟，比1小时稍短，避免连接在1小时时被服务器关闭）
        self._connection_error_detected = False  # 连接错误检测标志
        
        # 加载缓存的 cookie
        self._load_cookies()
    
    def _load_cookies(self):
        """从文件加载缓存的 cookie"""
        try:
            if os.path.exists(self.cookie_file):
                with open(self.cookie_file, 'r', encoding='utf-8') as f:
                    cookies_dict = json.load(f)
                    # 使用 requests.utils.cookiejar_from_dict 将字典转换为 CookieJar
                    # 然后更新到 session 的 cookies
                    if cookies_dict:
                        cookie_jar = requests.utils.cookiejar_from_dict(cookies_dict)
                        self.session.cookies.update(cookie_jar)
                        # 如果成功加载了 cookie，乐观假设认证有效，避免不必要的登录请求
                        # 如果 cookie 已过期，后续请求会返回 AUTH_FAILED，届时会重新登录
                        self.is_authenticated = True
                        if is_debug_enabled():
                            self.logger.debug(f"已加载缓存的 cookie: {len(cookies_dict)} 个，设置认证状态为已认证")
        except json.JSONDecodeError as e:
            self.logger.warning(f"加载 cookie 文件失败（JSON格式错误）: {e}")
            self.is_authenticated = False
        except Exception as e:
            if is_debug_enabled():
                self.logger.debug(f"加载 cookie 文件失败: {e}")
            self.is_authenticated = False
    
    def _save_cookies(self):
        """保存 cookie 到文件"""
        try:
            # 将 session 的 cookie 转换为字典格式
            cookies_dict = {}
            for cookie in self.session.cookies:
                cookies_dict[cookie.name] = cookie.value
            
            # 确保目录存在
            os.makedirs(os.path.dirname(self.cookie_file), exist_ok=True)
            
            # 保存到文件
            with open(self.cookie_file, 'w', encoding='utf-8') as f:
                json.dump(cookies_dict, f, ensure_ascii=False, indent=2)
            
            if is_debug_enabled():
                self.logger.debug(f"已保存 cookie 到文件: {self.cookie_file} ({len(cookies_dict)} 个)")
        except Exception as e:
            self.logger.warning(f"保存 cookie 文件失败: {e}")
    
    def close(self):
        """关闭 Session，释放连接池和资源"""
        try:
            if hasattr(self, 'session') and self.session:
                # 记录关闭前的状态（简化版，不获取连接池信息，避免线程安全问题）
                connection_age = None
                if hasattr(self, 'connection_created_at') and self.connection_created_at:
                    connection_age = time.time() - self.connection_created_at
                
                # 只在有连接年龄信息时记录（说明是长时间运行的进程，如judge_host）
                if connection_age:
                    close_info = {
                        "连接年龄": f"{connection_age:.1f}秒 ({connection_age/60:.1f}分钟)",
                        "连续失败次数": getattr(self, 'consecutive_failures', 0),
                        "认证状态": "已认证" if getattr(self, 'is_authenticated', False) else "未认证"
                    }
                    self.logger.info(f"关闭 WebClient Session，关闭前状态: {close_info}")
                
                self.session.close()
                # 重置连接创建时间
                self.connection_created_at = None
                self.logger.info("WebClient Session 已关闭，连接池已清空")
        except Exception as e:
            self.logger.error(f"关闭 WebClient Session 时发生错误: {e}", exc_info=True)
    
    def is_connection_expired(self) -> bool:
        """检查连接是否已过期（超过最大生存时间）"""
        if not hasattr(self, 'connection_created_at') or self.connection_created_at is None:
            return False
        age = time.time() - self.connection_created_at
        return age >= self.connection_max_age
    
    def _get_exception_traceback(self, exception: Exception) -> str:
        """获取异常的堆栈跟踪信息"""
        import traceback
        try:
            return ''.join(traceback.format_exception(type(exception), exception, exception.__traceback__))
        except:
            return str(exception)
        
    def _make_request(self, method: str, endpoint: str, **kwargs) -> Optional[Dict[str, Any]]:
        """发起HTTP请求的通用方法（带重试机制和指数退避）"""
        request_start_time = time.time()
        
        # 检查连接是否已过期（在请求前检查）
        if self.is_connection_expired():
            connection_age = time.time() - self.connection_created_at
            self.logger.error(
                f"【连接过期检测】连接已过期，需要回收连接！"
                f" 连接年龄: {connection_age/60:.1f}分钟 (最大: {self.connection_max_age/60:.1f}分钟)"
                f" 方法: {method}, 端点: {endpoint}"
            )
            # 抛出特殊异常，让调用者知道需要回收连接
            raise requests.exceptions.ConnectionError("连接已过期，需要回收连接池")
        
        # 重置连接错误检测标志
        self._connection_error_detected = False
        
        # 记录请求开始信息
        connection_age = time.time() - self.connection_created_at if hasattr(self, 'connection_created_at') and self.connection_created_at else 0
        self.logger.info(
            f"【HTTP请求开始】方法: {method}, 端点: {endpoint}, "
            f"连接年龄: {connection_age/60:.1f}分钟, "
            f"连续失败: {self.consecutive_failures}"
        )
        
        for attempt in range(self.max_retries):
            try:
                # 使用封装的URL构建方法
                url = self._build_url(endpoint)
                
                # Debug模式：显示请求详情
                if is_debug_enabled():
                    request_details = {
                        "尝试次数": f"{attempt + 1}/{self.max_retries}",
                        "方法": method,
                        "URL": url
                    }
                    if 'params' in kwargs:
                        request_details["URL参数"] = kwargs['params']
                    if 'json' in kwargs:
                        request_details["JSON负载"] = kwargs['json']
                    if 'data' in kwargs:
                        request_details["表单数据"] = kwargs['data']
                    if 'headers' in kwargs:
                        request_details["请求头"] = kwargs['headers']
                    
                    # 分别显示每个部分，确保JSON负载清晰可见
                    self.logger.debug(f"发起HTTP请求:")
                    self.logger.debug(f"  方法: {method}")
                    self.logger.debug(f"  URL: {url}")
                    if 'params' in kwargs:
                        self.logger.debug(f"  URL参数: {kwargs['params']}")
                    if 'json' in kwargs:
                        # 输出标准JSON格式，方便复制使用
                        json_str = json_module.dumps(kwargs['json'], ensure_ascii=False, indent=2)
                        self.logger.debug(f"  JSON负载:\n{json_str}")
                    if 'data' in kwargs:
                        self.logger.debug(f"  表单数据: {kwargs['data']}")
                    if 'headers' in kwargs:
                        self.logger.debug(f"  请求头: {kwargs['headers']}")
                
                # 设置超时
                timeout = kwargs.pop('timeout', 30)
                
                response = self.session.request(method, url, timeout=timeout, **kwargs)
                
                # Debug模式：显示响应详情
                if is_debug_enabled():
                    response_details = {
                        "状态码": response.status_code,
                        "响应头": dict(response.headers)
                    }
                    if response.status_code == 200:
                        try:
                            response_json = response.json()
                            response_details["响应JSON"] = response_json
                        except json.JSONDecodeError:
                            response_details["响应文本"] = response.text[:500] + "..."
                    self.logger.debug(f"收到HTTP响应: {response_details}")
                
                if response.status_code == 200:
                    try:
                        result = response.json()
                        # 检查 result 是否为字典
                        if not isinstance(result, dict):
                            self.logger.error(
                                f"【响应格式错误】响应不是字典类型，实际类型: {type(result).__name__}。"
                                f"方法: {method}, 端点: {endpoint}"
                            )
                            self.consecutive_failures += 1
                            if attempt < self.max_retries - 1:
                                continue
                            return None
                        
                        # 检查认证失败：code=0且status_code='AUTH_FAILED'
                        if result.get('code') == 0 and result.get('status_code') == 'AUTH_FAILED':
                            self.logger.error(
                                f"【认证失败】收到AUTH_FAILED响应，尝试重新登录。"
                                f" 方法: {method}, 端点: {endpoint}, "
                                f"响应: {result}"
                            )
                            self.is_authenticated = False
                            if self._authenticate():
                                # 重新发起请求（不增加attempt计数）
                                self.logger.info("重新认证成功，继续请求")
                                continue
                            else:
                                self.logger.error("重新认证失败，请求终止")
                                self.consecutive_failures += 1
                                return None
                        # 请求成功，重置连续失败计数
                        request_duration = time.time() - request_start_time
                        self.logger.info(
                            f"【HTTP请求成功】方法: {method}, 端点: {endpoint}, "
                            f"耗时: {request_duration:.2f}秒, "
                            f"响应码: {result.get('code', 'N/A')}"
                        )
                        self.consecutive_failures = 0
                        return result
                    except json.JSONDecodeError:
                        # 如果不是JSON响应，返回文本内容（包装为字典格式）
                        self.consecutive_failures = 0
                        return {"success": True, "data": response.text, "code": 0, "msg": "响应不是JSON格式"}
                else:
                    # 详细的错误信息
                    error_details = {
                        "状态码": response.status_code,
                        "URL": url,
                        "方法": method,
                        "尝试次数": f"{attempt + 1}/{self.max_retries}",
                        "连接年龄": f"{(time.time() - self.connection_created_at)/60:.1f}分钟" if hasattr(self, 'connection_created_at') and self.connection_created_at else "未知"
                    }
                    
                    # 尝试获取响应内容
                    try:
                        response_text = response.text
                        error_details["响应内容"] = response_text[:500] + "..." if len(response_text) > 500 else response_text
                    except Exception as e:
                        error_details["响应内容"] = f"无法读取响应内容: {e}"
                    
                    # 尝试解析JSON错误信息
                    try:
                        error_json = response.json()
                        error_details["JSON错误"] = error_json
                    except:
                        pass
                    
                    # 强制记录错误，不使用log_error_with_context（它只在debug模式下记录详细信息）
                    self.logger.error(
                        f"【HTTP请求失败-状态码错误】"
                        f" 状态码: {response.status_code}, "
                        f"方法: {method}, 端点: {endpoint}, "
                        f"URL: {url}, "
                        f"尝试: {attempt + 1}/{self.max_retries}, "
                        f"错误详情: {error_details}"
                    )
                    
                    if attempt < self.max_retries - 1:
                        # 指数退避：延迟时间 = min(retry_delay * 2^attempt, max_retry_delay)
                        delay = min(self.retry_delay * (2 ** attempt), self.max_retry_delay)
                        self.logger.info(f"等待 {delay} 秒后重试（第 {attempt + 1}/{self.max_retries} 次尝试）...")
                        time.sleep(delay)
                        continue
                    self.consecutive_failures += 1
                    self.logger.error(f"【HTTP请求最终失败】所有重试均失败，方法: {method}, 端点: {endpoint}")
                    return None
                    
            except requests.exceptions.RequestException as e:
                # 详细的网络异常日志 - 强制记录完整信息
                error_type = type(e).__name__
                error_msg = str(e)
                connection_age = None
                if hasattr(self, 'connection_created_at') and self.connection_created_at:
                    connection_age = time.time() - self.connection_created_at
                
                # 记录详细的连接池和网络错误信息
                error_context = {
                    "错误类型": error_type,
                    "错误消息": error_msg,
                    "URL": url if 'url' in locals() else 'N/A',
                    "方法": method,
                    "端点": endpoint,
                    "尝试次数": f"{attempt + 1}/{self.max_retries}",
                    "连续失败次数": self.consecutive_failures,
                    "连接年龄": f"{connection_age:.1f}秒 ({connection_age/60:.1f}分钟)" if connection_age else "未知"
                }
                
                # 检查是否是连接相关的错误
                is_connection_error = ('Connection' in error_type or 'Timeout' in error_type or 
                                     'Connect' in error_type or 'Pool' in error_type)
                
                if is_connection_error:
                    error_context["可能原因"] = "连接池中的连接可能已失效，建议回收连接"
                    error_context["异常堆栈"] = self._get_exception_traceback(e)
                    self.logger.error(
                        f"【HTTP请求失败-连接异常】疑似连接池问题！"
                        f" 错误类型: {error_type}, "
                        f"方法: {method}, 端点: {endpoint}, "
                        f"连接年龄: {error_context['连接年龄']}, "
                        f"尝试: {attempt + 1}/{self.max_retries}, "
                        f"完整错误: {error_context}"
                    )
                    # 标记需要回收连接（由调用者处理）
                    self._connection_error_detected = True
                else:
                    error_context["异常堆栈"] = self._get_exception_traceback(e)
                    self.logger.error(
                        f"【HTTP请求失败-请求异常】"
                        f" 错误类型: {error_type}, "
                        f"方法: {method}, 端点: {endpoint}, "
                        f"尝试: {attempt + 1}/{self.max_retries}, "
                        f"完整错误: {error_context}"
                    )
                
                if attempt < self.max_retries - 1:
                    # 指数退避：延迟时间 = min(retry_delay * 2^attempt, max_retry_delay)
                    delay = min(self.retry_delay * (2 ** attempt), self.max_retry_delay)
                    self.logger.info(f"等待 {delay} 秒后重试（第 {attempt + 1}/{self.max_retries} 次尝试）...")
                    time.sleep(delay)
                    continue
                self.consecutive_failures += 1
                self.logger.error(f"【HTTP请求最终失败-异常】所有重试均失败，方法: {method}, 端点: {endpoint}, 错误: {error_type}")
                return None
            except Exception as e:
                # 捕获所有其他异常，强制记录
                import traceback
                self.logger.error(
                    f"【HTTP请求失败-未知异常】"
                    f" 异常类型: {type(e).__name__}, "
                    f"方法: {method}, 端点: {endpoint}, "
                    f"错误消息: {str(e)}, "
                    f"堆栈跟踪: {traceback.format_exc()}"
                )
                self.consecutive_failures += 1
                return None
        
        return None
    
    def _build_url(self, endpoint: str) -> str:
        """构建完整的请求URL，避免双斜杠题目"""
        from urllib.parse import urljoin
        
        # 清理所有路径组件的斜杠
        base_url = self.base_url.rstrip('/')
        api_path = self.api_path.strip('/')
        endpoint = endpoint.strip('/')
        
        # 构建路径组件列表，过滤空字符串
        path_parts = [part for part in [base_url, api_path] if part]
        
        # 使用join连接，然后添加斜杠
        base_path = '/'.join(path_parts) + '/'
        
        # 使用urljoin进行安全的URL拼接
        return urljoin(base_path, endpoint)
    
    def _handle_response(self, result: Optional[Dict[str, Any]], success_msg: str = "", error_msg: str = "") -> bool:
        """处理ThinkPHP响应，返回是否成功"""
        if result and result.get('code') == 1:
            if success_msg:
                self.logger.info(success_msg)
            return True
        else:
            error_text = result.get('msg', '未知错误') if result else '无响应'
            
            # 详细的错误调试信息
            if is_debug_enabled():
                error_details = {
                    "响应数据": result,
                    "错误代码": result.get('code') if result else None,
                    "状态代码": result.get('status_code') if result else None,
                    "错误消息": error_text,
                    "完整响应": result
                }
                log_error_with_context(self.logger, "处理响应", None, error_details)
            
            if error_msg:
                self.logger.error(f"{error_msg}：{error_text}")
            return False
    
    def _get_response_data(self, result: Optional[Dict[str, Any]], default_value=None):
        """从响应中提取数据"""
        if result and result.get('code') == 1:
            return result.get('data', default_value)
        return default_value
    
    def _authenticate(self) -> bool:
        """认证登录"""
        try:
            # 额外的类型检查，确保 config 是字典
            if not isinstance(self.config, dict):
                error_msg = (
                    f"配置类型错误：self.config 应该是 dict，实际为 {type(self.config).__name__}。"
                    f"值: {self.config}"
                )
                self.logger.error(error_msg)
                raise TypeError(error_msg)
            
            # 确保 server 配置存在且是字典
            server_config = self.config.get('server')
            if not isinstance(server_config, dict):
                error_msg = (
                    f"server 配置类型错误：应该是 dict，实际为 {type(server_config).__name__}。"
                    f"self.config 类型: {type(self.config).__name__}, "
                    f"self.config 内容: {self.config}"
                )
                self.logger.error(error_msg)
                raise TypeError(error_msg)
            
            user_id = server_config.get('user_id', '')
            password = server_config.get('password', '')
            
            # Debug模式：显示登录过程
            if is_debug_enabled():
                login_details = {
                    "用户名": user_id,
                    "密码": '*' * len(password) if password else '未设置',
                    "登录URL": f"{self.base_url}{self.api_path}/judge_login"
                }
                self.logger.debug(f"开始认证登录: {login_details}")
            
            if not user_id or not password:
                self.logger.error("未配置用户名或密码")
                return False
            
            data = {
                "user_id": user_id,
                "password": password
            }
            
            # Debug模式：显示登录请求详情
            if is_debug_enabled():
                self.logger.debug(f"发送登录请求: {data}")
            
            # Cached cookies are restored without domain metadata. After a Web
            # restart they can shadow the replacement session cookie indefinitely.
            self.session.cookies.clear()
            result = self._make_request('POST', 'judge_login', json=data)
            
            # Debug模式：显示登录响应详情
            if is_debug_enabled():
                # 检查 result 类型，确保是字典
                if isinstance(result, dict):
                    response_details = {
                        "响应数据": result,
                        "状态码": result.get('code', 'N/A'),
                        "消息": result.get('msg', 'N/A'),
                        "用户ID": result.get('data', {}).get('user_id', 'N/A') if isinstance(result.get('data'), dict) else 'N/A'
                    }
                else:
                    response_details = {
                        "响应数据": result,
                        "响应类型": type(result).__name__,
                        "响应内容": str(result)[:200] if result else 'None'
                    }
                self.logger.debug(f"收到登录响应: {response_details}")
            
            # 检查 result 类型，确保是字典
            if not isinstance(result, dict):
                error_msg = (
                    f"登录响应格式错误：期望 dict，实际为 {type(result).__name__}。"
                    f"响应内容: {str(result)[:200]}"
                )
                self.logger.error(error_msg)
                return False
            
            # 使用封装的响应处理方法
            if self._handle_response(result, "评测机登录成功", "登录失败"):
                self.is_authenticated = True
                # 登录成功后保存 cookie
                self._save_cookies()
                return True
            else:
                return False
                
        except Exception as e:
            # 输出详细的错误信息，包括堆栈跟踪
            import traceback
            error_details = {
                "错误类型": type(e).__name__,
                "错误消息": str(e),
                "self.config 类型": type(self.config).__name__ if hasattr(self, 'config') else 'N/A',
                "self.config 值": str(self.config)[:200] if hasattr(self, 'config') else 'N/A',
                "堆栈跟踪": traceback.format_exc()
            }
            self.logger.error(f"登录时发生错误：{e}")
            self.logger.error(f"详细错误信息：{error_details}")
            if is_debug_enabled():
                self.logger.debug(f"完整堆栈跟踪：\n{traceback.format_exc()}")
            return False
    
    @require_auth
    def get_pending_tasks(self, max_tasks: int = 1) -> List[Dict[str, Any]]:
        """获取待评测任务"""
        try:
            params = {"max_tasks": max_tasks}
            result = self._make_request('GET', 'getpending', params=params)
            return self._get_response_data(result, [])
                
        except Exception as e:
            self.logger.error(f"获取评测任务时发生错误：{e}")
            return []
    
    @require_auth
    def get_solution_info(self, solution_id: int) -> Optional[Dict[str, Any]]:
        """获取解决方案信息"""
        try:
            params = {"sid": solution_id}
            result = self._make_request('GET', 'getsolutioninfo', params=params)
            return self._get_response_data(result)
                
        except Exception as e:
            self.logger.error(f"获取解决方案信息时发生错误：{e}")
            return None
    
    @require_auth
    def get_solution_code(self, solution_id: int) -> Optional[str]:
        """获取解决方案代码"""
        try:
            params = {"sid": solution_id}
            result = self._make_request('GET', 'getsolution', params=params)
            return self._get_response_data(result)
                
        except Exception as e:
            self.logger.error(f"获取解决方案代码时发生错误：{e}")
            return None
    
    @require_auth
    def get_problem_info(self, problem_id: int) -> Optional[Dict[str, Any]]:
        """获取题目信息"""
        try:
            params = {"pid": problem_id}
            result = self._make_request('GET', 'getprobleminfo', params=params)
            return self._get_response_data(result)
                
        except Exception as e:
            self.logger.error(f"获取题目信息时发生错误：{e}")
            return None
    
    @require_auth
    def download_problem_data(self, problem_id: int, save_path: str) -> bool:
        """下载题目测试数据"""
        try:
            params = {"problem_id": problem_id}
            url = f"{self.base_url}{self.api_path}/getdata"
            
            # Debug模式：显示下载请求详情
            if self.logger.isEnabledFor(logging.DEBUG):
                self.logger.debug(f"发起数据下载请求:")
                self.logger.debug(f"  题目ID: {problem_id}")
                self.logger.debug(f"  URL: {url}")
                self.logger.debug(f"  参数: {params}")
                self.logger.debug(f"  保存路径: {save_path}")
            
            response = self.session.get(url, params=params, timeout=60, stream=True)
            # 确保对 gzip 等压缩内容进行透明解压
            try:
                if hasattr(response, 'raw') and hasattr(response.raw, 'decode_content'):
                    response.raw.decode_content = True
            except Exception:
                pass
            
            # Debug模式：显示下载响应详情
            if self.logger.isEnabledFor(logging.DEBUG):
                self.logger.debug(f"收到下载响应:")
                self.logger.debug(f"  状态码: {response.status_code}")
                self.logger.debug(f"  响应头: {dict(response.headers)}")
                if 'Content-Length' in response.headers:
                    self.logger.debug(f"  文件大小: {response.headers['Content-Length']} bytes")
            
            if response.status_code == 200:
                # 确保保存目录存在
                os.makedirs(os.path.dirname(save_path), exist_ok=True)
                
                # 保存数据文件
                downloaded_size = 0
                with open(save_path, 'wb') as f:
                    for chunk in response.iter_content(chunk_size=8192):
                        if chunk:
                            f.write(chunk)
                            downloaded_size += len(chunk)
                            
                            # Debug模式：显示下载进度
                            if self.logger.isEnabledFor(logging.DEBUG) and downloaded_size % (1024 * 1024) == 0:  # 每MB显示一次
                                self.logger.debug(f"  已下载: {downloaded_size / 1024 / 1024:.1f} MB")
                
                self.logger.info(f"题目 {problem_id} 数据下载完成：{save_path} ({downloaded_size} bytes)")
                return True
            else:
                self.logger.error(f"下载题目 {problem_id} 数据失败，状态码：{response.status_code}")
                return False
                
        except Exception as e:
            self.logger.error(f"下载题目 {problem_id} 数据时发生错误：{e}")
            return False
    
    @require_auth
    def get_problem_files(self, problem_id: int) -> List[Dict[str, Any]]:
        """获取问题文件列表和哈希"""
        try:
            params = {"problem_id": problem_id}
            result = self._make_request('GET', 'get_datafile_list', params=params)
            
            # 检查响应状态
            if result and result.get('code') == 1:
                return result.get('data', [])
            else:
                # 记录详细的错误信息
                error_msg = result.get('msg', '未知错误') if result else '无响应'
                self.logger.error(f"获取问题 {problem_id} 文件列表失败：{error_msg}")
                if is_debug_enabled():
                    self.logger.debug(f"完整响应：{result}")
                return []
                
        except Exception as e:
            self.logger.error(f"获取问题 {problem_id} 文件列表时发生错误：{e}")
            return []
    
    @require_auth
    def download_problem_file(self, problem_id: int, file_path: str, save_path: str) -> bool:
        """下载问题单个文件"""
        try:
            params = {
                "problem_id": problem_id,
                "file_path": file_path
            }
            url = self._build_url('getdatafile')
            
            # Debug模式：显示下载请求详情
            if self.logger.isEnabledFor(logging.DEBUG):
                self.logger.debug(f"发起单文件下载请求:")
                self.logger.debug(f"  问题ID: {problem_id}")
                self.logger.debug(f"  文件路径: {file_path}")
                self.logger.debug(f"  URL: {url}")
                self.logger.debug(f"  保存路径: {save_path}")
                self.logger.debug(f"  参数: {params}")
            
            response = self.session.get(url, params=params, timeout=60, stream=True)
            # 确保对 gzip 等压缩内容进行透明解压
            try:
                if hasattr(response, 'raw') and hasattr(response.raw, 'decode_content'):
                    response.raw.decode_content = True
            except Exception:
                pass
            
            # Debug模式：显示下载响应详情
            if self.logger.isEnabledFor(logging.DEBUG):
                self.logger.debug(f"收到单文件下载响应:")
                self.logger.debug(f"  状态码: {response.status_code}")
                self.logger.debug(f"  响应头: {dict(response.headers)}")
                if 'Content-Length' in response.headers:
                    self.logger.debug(f"  文件大小: {response.headers['Content-Length']} bytes")
            
            if response.status_code == 200:
                # 确保保存目录存在
                os.makedirs(os.path.dirname(save_path), exist_ok=True)
                
                # 保存文件
                with open(save_path, 'wb') as f:
                    for chunk in response.iter_content(chunk_size=8192):
                        if chunk:
                            f.write(chunk)
                
                self.logger.info(f"题目 {problem_id} 文件下载完成：{file_path} -> {save_path}")
                return True
            else:
                self.logger.error(f"题目 {problem_id} 下载文件 {file_path} 失败，状态码：{response.status_code}")
                return False
                
        except Exception as e:
            self.logger.error(f"题目 {problem_id} 下载文件 {file_path} 时发生错误：{e}")
            return False
    
    @require_auth
    def update_task_status(self, task_id: int, status: str, result: Dict[str, Any] = None) -> bool:
        """更新任务状态"""
        # 强制显示调试信息，确认方法被调用
        self.logger.debug(f"=== update_task_status 被调用 ===")
        self.logger.debug(f"task_id: {task_id}, status: {status}, result: {result}")
        
        try:
            data = {
                "solution_id": task_id,  # 修正参数名
                "task_status": status,   # 评测机任务状态
                "judge_result_data": result or {}  # 完整评测数据包
            }
            
            # Debug模式：显示发送的数据
            if is_debug_enabled():
                self.logger.debug(f"准备发送更新任务状态请求:")
                self.logger.debug(f"  任务ID: {task_id}")
                self.logger.debug(f"  状态: {status}")
                self.logger.debug(f"  结果: {result}")
                self.logger.debug(f"  完整数据: {data}")
            
            response = self._make_request('POST', 'updatesolution', json=data)
            
            # 根据状态和结果生成更清晰的日志信息
            if status == sc.TASK_COMPLETED:
                result_name = result.get('judge_result', sc.JUDGE_UNKNOWN) if result else sc.JUDGE_UNKNOWN
                success_msg = f"任务 {task_id} 评测完成，结果：{result_name}"
            elif status == sc.TASK_ERROR:
                result_name = result.get('judge_result', sc.JUDGE_UNKNOWN) if result else sc.JUDGE_UNKNOWN
                success_msg = f"任务 {task_id} 评测出错，结果：{result_name}"
            else:
                success_msg = f"任务 {task_id} 状态更新为 {status}"
            
            return self._handle_response(response, success_msg, "更新任务状态失败")
                
        except Exception as e:
            log_error_with_context(self.logger, "更新任务状态", e, {
                "task_id": task_id,
                "task_status": status,
                "judge_result_data": result
            })
            return False
    
    @require_auth
    def add_compile_error(self, solution_id: int, ce_info: Dict[str, Any]) -> bool:
        """添加编译错误信息（结构化数据）"""
        try:
            # 预处理错误信息，清理异常字符
            sanitized_ce_info = sanitize_error_info(ce_info)
            
            data = {
                "sid": solution_id,
                "ceinfo": sanitized_ce_info  # 清理后的结构化数据
            }
            
            response = self._make_request('POST', 'addceinfo', json=data)
            return self._handle_response(response, f"解决方案 {solution_id} 编译错误信息已添加", "添加编译错误信息失败")
                
        except Exception as e:
            self.logger.error(f"添加编译错误信息时发生错误：{e}")
            return False
    
    @require_auth
    def add_runtime_error(self, solution_id: int, re_info: Dict[str, Any]) -> bool:
        """添加运行时错误信息（结构化数据）"""
        try:
            # 预处理错误信息，清理异常字符
            sanitized_re_info = sanitize_error_info(re_info)
            
            data = {
                "sid": solution_id,
                "reinfo": sanitized_re_info  # 清理后的结构化数据
            }
            
            response = self._make_request('POST', 'addreinfo', json=data)
            return self._handle_response(response, f"解决方案 {solution_id} 运行时错误信息已添加", "添加运行时错误信息失败")
                
        except Exception as e:
            self.logger.error(f"添加运行时错误信息时发生错误：{e}")
            return False
    
    @require_auth
    def update_user_stats(self, user_id: str) -> bool:
        """更新用户统计信息"""
        try:
            data = {"user_id": user_id}
            response = self._make_request('POST', 'updateuser', json=data)
            return self._handle_response(response, f"用户 {user_id} 统计信息已更新", "更新用户统计信息失败")
                
        except Exception as e:
            self.logger.error(f"更新用户统计信息时发生错误：{e}")
            return False
    
    @require_auth
    def update_problem_stats(self, problem_id: int) -> bool:
        """更新题目统计信息"""
        try:
            data = {"problem_id": problem_id}
            response = self._make_request('POST', 'updateproblem', json=data)
            return self._handle_response(response, f"题目 {problem_id} 统计信息已更新", "更新题目统计信息失败")
                
        except Exception as e:
            self.logger.error(f"更新题目统计信息时发生错误：{e}")
            return False
    
    @require_auth
    def get_ac_solutions(self, problem_id: int, max_solution_id: int = 0, 
                        min_solution_id: int = 0, exclude_user_id: str = '', 
                        page: int = 1, page_size: int = 100) -> Optional[Dict[str, Any]]:
        """
        获取题目的AC代码列表（用于查重）
        
        Args:
            problem_id: 题目ID
            max_solution_id: 只获取比这个ID小的代码（0表示不限制）
            min_solution_id: 只获取比这个ID大的代码（用于增量同步，0表示不限制）
            exclude_user_id: 排除的用户ID
            page: 页码（从1开始）
            page_size: 每页数量
        
        Returns:
            包含代码列表的字典，格式：{'list': [...], 'total': xxx, 'page': xxx, 'page_size': xxx, 'has_more': bool}
        """
        try:
            params = {
                'problem_id': problem_id,
                'page': page,
                'page_size': page_size
            }
            if max_solution_id > 0:
                params['max_solution_id'] = max_solution_id
            if min_solution_id > 0:
                params['min_solution_id'] = min_solution_id
            if exclude_user_id:
                params['exclude_user_id'] = exclude_user_id
            
            result = self._make_request('GET', 'get_ac_solutions', params=params)
            return self._get_response_data(result)
                
        except Exception as e:
            self.logger.error(f"获取AC代码列表时发生错误：{e}")
            return None
    
    @require_auth
    def submit_similarity_info(self, solution_id: int, similarity_info: Optional[Dict[str, Any]] = None) -> bool:
        """
        提交查重信息（只提交最相似的一个结果，或通知无相似代码）
        
        Args:
            solution_id: 解决方案ID
            similarity_info: 最相似的代码信息 {solution_id: xxx, similarity: xxx}，如果为None表示无相似代码
        
        Returns:
            是否成功
        """
        try:
            # 将单个结果包装成列表格式（向后兼容后端接口）
            # 如果 similarity_info 为 None，表示无相似代码，传递空列表
            data = {
                'solution_id': solution_id,
                'similarities': [similarity_info] if similarity_info else []
            }
            response = self._make_request('POST', 'add_similarity_info', json=data)
            if similarity_info:
                success_msg = f"解决方案 {solution_id} 查重信息已提交（相似度: {similarity_info.get('similarity', 0)}%）"
            else:
                success_msg = f"解决方案 {solution_id} 查重信息已提交（无相似代码，已清除旧记录）"
            return self._handle_response(response, success_msg, "提交查重信息失败")
                
        except Exception as e:
            self.logger.error(f"提交查重信息时发生错误：{e}")
            return False
