<?php
/**
 * 应用公共文件（聚合入口）
 *
 * 说明：
 * - 本文件只负责“统一加载”公共函数集合，不再承载任何函数定义。
 * - 所有公共函数均拆分在 `ojweb/application/common/funcs/*.php` 中，按功能分区维护。
 *
 * 约束：
 * - `common/funcs/*.php` 文件内原则上以“函数定义”为主；亦可放 **`namespace app\common\funcs` 的 `final class` 静态方法**（由 Composer 自动加载，与 **`ContestAwardMath`** 等一致）。禁止文件顶层执行逻辑（避免隐式副作用）。
 * - `funcs` 文件之间不互相 require_once；依赖顺序由本文件统一管理。
 *
 * 依赖顺序（从底层到上层）：
 * - db_helper（须在框架 helper.php 之前注册 db()）→ base → … → auth
 */

// ThinkPHP 5.1：项目 db() 默认复用连接（不修改 thinkphp/ 框架源码）
require_once __DIR__ . '/common/funcs/db_helper.php';

// 按功能拆分：基础工具（最底层）
require_once __DIR__ . '/common/funcs/base.php';
// 按功能拆分：杂项（Markdown/IP/Carousel 等）
require_once __DIR__ . '/common/funcs/misc.php';
// 按功能拆分：自定义 debug 统一口子（仅 app_debug=true 时生效）
require_once __DIR__ . '/common/funcs/debug.php';
// 按功能拆分：密码/加密/邮件
require_once __DIR__ . '/common/funcs/crypto.php';
// 按功能拆分：文件/目录/下载
require_once __DIR__ . '/common/funcs/file_utils.php';
// 按功能拆分：压缩/解压（Zippy）
require_once __DIR__ . '/common/funcs/archive.php';
// 按功能拆分：HTTP 请求
require_once __DIR__ . '/common/funcs/http.php';
// 按功能拆分：评测机配置与 JSON 工具
require_once __DIR__ . '/common/funcs/judger_config.php';
// 按功能拆分：资源权限/课程权限
require_once __DIR__ . '/common/funcs/privilege.php';
// 按功能拆分：登录/管理员/权限配置
require_once __DIR__ . '/common/funcs/auth.php';
// 后台任务：多实例同库时的 worker 认领隔离键
require_once __DIR__ . '/common/funcs/backtask_site.php';
// 题目多语言 / PDF 题面
require_once __DIR__ . '/common/funcs/problem_locale.php';
// 题目评测类型（spj 0/1/2）选项，供题包转换等注入前端
require_once __DIR__ . '/common/funcs/problem_judge_types.php';
require_once __DIR__ . '/common/funcs/contest_export_policy.php';