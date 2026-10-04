<?php
namespace app\expsys\controller;
use think\Controller;
use think\facade\Validate;
use app\csgoj\controller\User as Userbase;

/**
 * expsys User 控制器
 * 继承 csgoj\User，复用用户登录、信息查看等功能
 * expsys 是练习模式，使用普通 users 表
 */
class User extends Userbase
{
    // 所有用户相关功能（登录、登出、用户信息等）复用 csgoj\User 的实现
    // expsys 是练习模式，不需要特殊处理
}

