<?php
namespace app\exindex\controller;
use app\index\controller\Cpcinfo as IndexCpcinfo;
use app\common\traits\NewsBaseTrait;
use app\common\traits\NewsExpTrait;

/**
 * exindex Cpcinfo 控制器
 * 继承 index/Cpcinfo，使用 NewsBaseTrait + NewsExpTrait 提供 course_key 相关的查询过滤钩子方法
 */
class Cpcinfo extends IndexCpcinfo
{
    use NewsBaseTrait, NewsExpTrait;
}

