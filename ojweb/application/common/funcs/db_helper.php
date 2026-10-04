<?php
/**
 * 项目级 db() 助手（须在框架 helper.php 之前注册）
 *
 * ThinkPHP 5.1 自带 helper 中 db() 第三参 $force 默认为 true，等价于 Db::connect($config, true)，
 * 每次调用会新建 Connection/PDO，FPM 高并发下易打满 max_connections（见框架社区说明与 Issue #1672）。
 *
 * 加载顺序（think\App::init）：application/common.php → thinkphp/helper.php；
 * 此处用 function_exists 先定义 db()，框架段不再覆盖。
 *
 * 需要强制新连接时（极少）：db('table', [], true) 或 \think\Db::connect([], true)。
 * 官方亦推荐复杂场景直接用 \think\Db::name('table')（__callStatic → connect() 默认不 force）。
 */

if (!function_exists('db')) {
    /**
     * @param string              $name   表名（不含前缀）
     * @param array|string        $config 连接配置
     * @param bool                $force  是否强制重新连接（默认 false：同请求/同配置复用连接）
     * @return \think\db\Query
     */
    function db($name = '', $config = [], $force = false)
    {
        return \think\Db::connect($config, $force)->name($name);
    }
}
