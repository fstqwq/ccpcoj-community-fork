<?php
namespace app\exindex\controller;
use app\index\controller\News as IndexNews;
use app\common\traits\NewsBaseTrait;
use app\common\traits\NewsExpTrait;

/**
 * exindex News 控制器
 * 继承 index/News，使用 NewsBaseTrait + NewsExpTrait 提供 course_key 相关的查询过滤钩子方法
 */
class News extends IndexNews
{
    use NewsBaseTrait, NewsExpTrait;
}

