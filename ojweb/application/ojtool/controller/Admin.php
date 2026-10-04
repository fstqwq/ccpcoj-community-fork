<?php
namespace app\ojtool\controller;
use think\Db;
use think\facade\Validate;
use app\ojtool\controller\Contest as Contestbase;
require_once(__DIR__ . "../../../common/traits/ContestAdminBaseTrait.php");
use app\common\traits\ContestAdminBaseTrait as AT;
class Admin extends Contestbase
{
    use AT;
    
}