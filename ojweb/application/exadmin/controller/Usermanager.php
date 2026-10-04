<?php
namespace app\exadmin\controller;
use app\admin\controller\Usermanager as AdminUsermanager;

/**
 * exadmin Usermanager 控制器
 * 继承 admin/Usermanager，复用用户管理逻辑
 */
class Usermanager extends AdminUsermanager
{
    // 无需重写任何方法，所有业务逻辑复用 admin/Usermanager
}
