<?php
// Author: CSGrandeur
// ThinkPHP 5.1.42 Cookie配置文件
use think\facade\Env;

return [
    // cookie 名称前缀
    'prefix'    => 'csgoj_' . Env::get('OJ_SESSION', 'CCPC'),
    // cookie 保存时间（秒），5小时
    'expire'    => 18000,
    // cookie 保存路径
    'path'      => '/',
    // cookie 有效域名
    'domain'    => '',
    //  cookie 启用安全传输
    'secure'    => false,
    // httponly设置
    'httponly'  => true,
    // 是否使用 setcookie
    'setcookie' => true,
];
