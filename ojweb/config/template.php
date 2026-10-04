<?php
// Author: CSGrandeur
// ThinkPHP 5.1.42 模板引擎配置文件
return [
    // 模板引擎类型 支持 php think 支持扩展
    'type'         => 'Think',
    // 默认模板渲染规则 1 解析为小写+下划线 2 全部转换小写 3 保持操作方法
    'auto_rule'    => 1,
    // 模板路径
    'view_path'    => '',
    // 模板后缀
    'view_suffix'  => 'php',
    // 模板文件名分隔符
    'view_depr'    => DIRECTORY_SEPARATOR,
    // 模板引擎普通标签开始标记
    'tpl_begin'    => '{',
    // 模板引擎普通标签结束标记
    'tpl_end'      => '}',
    // 标签库标签开始标记
    'taglib_begin' => '{',
    // 标签库标签结束标记
    'taglib_end'   => '}',
    // 开启layout
    'layout_on'    => true,
    // 模板替换字符串（原 view_replace_str，从 view_replace_str.php 迁移）
    'tpl_replace_string' => [
        '__STATIC__'    => '/static',
        '__CRPUBLIC__'  => '/static/cr',
        '__CSS__'       => '/static/css',
        '__JS__'        => '/static/js',
        '__IMG__'       => '/static/image',
        '__OJ__'        => '/csgoj',
        '__HOME__'      => '/index',
        '__ADMIN__'     => '/admin',
        '__CPC__'       => '/cpcsys',
        '__OJTOOL__'    => '/ojtool',
        '__CONTEST__'   => '/contest',
        '__OUTRANK__'   => '/outrank',
    ],
    // 默认过滤方法，设置为 'raw' 表示默认输出原始 HTML（不转义）
    // 如果需要转义，可以在模板中使用 |htmlspecialchars 或 |htmlentities
    'default_filter' => 'raw',
];
