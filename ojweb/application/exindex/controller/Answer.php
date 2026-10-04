<?php
namespace app\exindex\controller;
use app\index\controller\Answer as IndexAnswer;
use app\common\traits\NewsBaseTrait;
use app\common\traits\NewsExpTrait;

/**
 * exindex Answer 控制器
 * 继承 index/Answer，使用 NewsBaseTrait + NewsExpTrait 提供 course_key 相关的查询过滤钩子方法
 */
class Answer extends IndexAnswer
{
    use NewsBaseTrait, NewsExpTrait;
}

