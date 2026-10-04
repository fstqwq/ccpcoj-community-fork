<?php
namespace app\exadmin\controller;
use app\admin\controller\Judger as AdminJudger;

/**
 * exadmin Judger 控制器
 * 继承 admin/Judger，复用评测机管理逻辑
 */
class Judger extends AdminJudger
{
    // 无需重写任何方法，所有业务逻辑复用 admin/Judger
}
