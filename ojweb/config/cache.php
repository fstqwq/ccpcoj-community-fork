<?php
// Author: CSGrandeur
// ThinkPHP 5.1.42 缓存配置文件
use think\facade\Env;

return [
    // 驱动方式
    'type'   => 'File',
    // 缓存保存目录
    'path'   => Env::get('runtime_path') . 'cache' . DIRECTORY_SEPARATOR,
    // 缓存前缀
    'prefix' => '',
    // 缓存有效期 0表示永久缓存
    'expire' => 0,
];
