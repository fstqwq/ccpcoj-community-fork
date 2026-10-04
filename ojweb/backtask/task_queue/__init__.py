"""
入队型任务目录（PHP 写入 backtask 表，由 poll_and_run 认领执行）。

具体任务为同目录下各模块；每模块底部定义 ``QUEUED_TASK_REGISTRATION``，
并在 ``task_schedule_config`` 中按模块分别 import 登记。
"""
