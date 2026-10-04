<?php
namespace app\expsys\controller;
use think\Db;
use think\facade\Validate;
use app\expsys\controller\Contest as Contestbase;
require_once(__DIR__ . "../../../common/traits/ContestAdminExpTrait.php");
use app\common\traits\ContestAdminExpTrait;

class Admin extends Contestbase
{
    use ContestAdminExpTrait;  // ContestAdminExpTrait 已包含 ContestAdminBaseTrait

    public function initialize()
    {
        // 走 Contestbase 的初始化（ContestInit + ExpInit），确保 contest/cid 已加载
        parent::initialize();
        // 小后台鉴权：必须是该练习的管理员/教师（由 ContestAdminBaseTrait::AdminInit 统一判断）
        if (method_exists($this, 'AdminInit')) {
            $this->AdminInit();
        }
    }
}

