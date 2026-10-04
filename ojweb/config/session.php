<?php
// Author: CSGrandeur
// ThinkPHP 5.1.42 Session配置文件
use think\facade\Env;

return [
    'id'             => '',
    // SESSION_ID的提交变量,解决flash上传跨域
    'var_session_id' => '',
    // SESSION Cookie 名称（每个 OJ 实例使用不同的名称，避免同域名下多实例冲突）【特别注意检查 测试服 和 正式服 别重名】
    'name'           => 'PHPSESSID_' . Env::get('OJ_SESSION', 'CCPC'),
    // SESSION 前缀
    'prefix'         => 'csgoj_' . Env::get('OJ_SESSION', 'CCPC'),
    // 驱动方式 支持redis memcache memcached
    'type'           => '',
    // 是否自动开启 SESSION
    'auto_start'     => true,
    // SESSION 过期时间（秒）
    // 注意：此值会覆盖 php.ini 的 session.gc_maxlifetime / session.cookie_lifetime（见 think\\Session::init）
    // 建议 ≥ 6小时；当前设置为 6小时
    'expire'         => 21600,
    // httponly设置（安全）
    'httponly'       => true,
];
