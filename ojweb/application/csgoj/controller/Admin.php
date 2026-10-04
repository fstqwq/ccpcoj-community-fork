<?php
namespace app\csgoj\controller;
use think\Db;
use think\facade\Validate;
use app\csgoj\controller\Contest as Contestbase;
require_once(__DIR__ . "../../../common/traits/ContestAdminBaseTrait.php");
use app\common\traits\ContestAdminBaseTrait;
class Admin extends Contestbase
{
    use ContestAdminBaseTrait;
}