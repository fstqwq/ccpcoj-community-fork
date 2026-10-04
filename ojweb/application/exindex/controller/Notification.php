<?php
namespace app\exindex\controller;
use app\index\controller\Notification as IndexNotification;
use app\common\traits\NewsBaseTrait;
use app\common\traits\NewsExpTrait;

/**
 * exindex Notification 控制器
 * 继承 index/Notification，使用 NewsBaseTrait + NewsExpTrait 提供 course_key 相关的查询过滤钩子方法
 */
class Notification extends IndexNotification
{
    use NewsBaseTrait, NewsExpTrait;
}

