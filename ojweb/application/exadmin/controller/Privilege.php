<?php
namespace app\exadmin\controller;
use app\admin\controller\Privilege as AdminPrivilege;

/**
 * exadmin Privilege 控制器
 * 继承 admin/Privilege，复用权限管理逻辑
 */
class Privilege extends AdminPrivilege
{
    // 无需重写任何方法，所有业务逻辑复用 admin/Privilege
}
