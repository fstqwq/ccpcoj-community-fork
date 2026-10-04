"""
任务工厂 —— 根据 task_type 创建可执行的任务实例。

每个注册条目含:
  - module / class_name / method: 定位任务类
  - timeout_minutes: 超时阈值
  - concurrency_mode: "read" | "write" —— 读任务可并行，写任务按 queue_key 串行
  - queue_key_fn: 可选函数 (task_params) -> str，提取写冲突键
"""
import importlib
import logging
from typing import Optional, Tuple, Callable, Any, Dict

logger = logging.getLogger("backtask.factory")

_REGISTRY: Dict[str, Dict[str, Any]] = {}


def register(task_type: str, module: str, class_name: str, method: str = "run",
             timeout_minutes: int = 40,
             concurrency_mode: str = "read",
             queue_key_fn: Optional[Callable[[dict], str]] = None):
    """
    注册一个任务类型。

    Args:
        concurrency_mode: "read" 可完全并行; "write" 同 queue_key 串行
        queue_key_fn: 写模式下，从 task_params 提取冲突键的函数;
                      为 None 时写任务全局串行
    """
    _REGISTRY[task_type] = {
        "module": module,
        "class_name": class_name,
        "method": method,
        "timeout_minutes": timeout_minutes,
        "concurrency_mode": concurrency_mode,
        "queue_key_fn": queue_key_fn,
    }


def get_timeout_minutes(task_type: str) -> int:
    cfg = _REGISTRY.get(task_type)
    return cfg["timeout_minutes"] if cfg else 40


def get_concurrency_mode(task_type: str) -> str:
    cfg = _REGISTRY.get(task_type)
    return cfg["concurrency_mode"] if cfg else "read"


def get_queue_key(task_type: str, task_params: dict) -> Optional[str]:
    """返回写冲突键；读任务或无 queue_key_fn 时返回 None。"""
    cfg = _REGISTRY.get(task_type)
    if not cfg or cfg["concurrency_mode"] != "write":
        return None
    fn = cfg.get("queue_key_fn")
    if fn is None:
        return f"__global_write_{task_type}"
    try:
        return fn(task_params)
    except Exception:
        return f"__global_write_{task_type}"


def create(task_type: str, task_id: int, task_params: dict
           ) -> Optional[Tuple[object, Callable]]:
    """返回 (task_instance, execute_callable) 或 None。"""
    cfg = _REGISTRY.get(task_type)
    if cfg is None:
        logger.warning("未注册的 task_type: %s", task_type)
        return None
    try:
        mod = importlib.import_module(cfg["module"])
        cls = getattr(mod, cfg["class_name"])
        instance = cls(task_id=task_id, task_params=task_params)
        method = getattr(instance, cfg["method"])
        if not callable(method):
            logger.error("task_type=%s 的方法 %s 不可调用", task_type, cfg["method"])
            return None
        return instance, method
    except Exception:
        logger.exception("创建 task_type=%s 实例失败", task_type)
        return None
