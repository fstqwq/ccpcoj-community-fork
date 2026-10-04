<?php
namespace app\ojtool\controller;

use think\facade\Cache;

class Userinit extends Ojtoolbase
{
    /**************************************************/
    //Init User (System Initialization)
    /**************************************************/
    public function index()
    {
        // 标准安装锁：一旦存在则视为已初始化（禁止重复初始化）
        if ($this->isSystemInstalled()) {
            $this->error('系统已初始化，无法重复初始化。<span class="en-text">System already initialized.</span>', '/');
        }

        // 自愈：若锁丢失但已存在用户，也应禁止并补锁
        $anyUserId = db('users')->field('user_id')->limit(1)->value('user_id');
        if($anyUserId) {
            $this->ensureInstallLock();
            Cache::set('csgoj:users:has_any', 1, 86400 * 365);
            $this->error('系统已初始化，无法重复初始化。<span class="en-text">System already initialized.</span>', '/');
        }
        return $this->fetch();
    }

    public function init_user_ajax()
    {
        // 标准安装锁：一旦存在则视为已初始化（禁止重复初始化）
        if ($this->isSystemInstalled()) {
            $this->error('系统已初始化，无法重复初始化。<span class="en-text">System already initialized.</span>');
        }

        // 自愈：若锁丢失但已存在用户，也应禁止并补锁
        $anyUserId = db('users')->field('user_id')->limit(1)->value('user_id');
        if($anyUserId) {
            $this->ensureInstallLock();
            Cache::set('csgoj:users:has_any', 1, 86400 * 365);
            $this->error('系统已初始化，无法重复初始化。<span class="en-text">System already initialized.</span>');
        }

        $user_id = trim(input('user_id'));
        $password = trim(input('password'));
        $confirm_password = trim(input('confirm_password'));

        if($user_id == null || strlen($user_id) == 0) {
            $this->error('用户名不能为空<span class="en-text">User ID required</span>');
        }

        if(strlen($user_id) < 5 || strlen($user_id) > 20) {
            $this->error('用户名长度应为5-20个字符<span class="en-text">User ID should be 5-20 characters</span>');
        }

        if($password == null || strlen($password) == 0) {
            $this->error('密码不能为空<span class="en-text">Password required</span>');
        }

        if(strlen($password) < 6 || strlen($password) > 255) {
            $this->error('密码长度应为6-255个字符<span class="en-text">Password should be 6-255 characters</span>');
        }

        if($password != $confirm_password) {
            $this->error('两次输入的密码不一致<span class="en-text">Password confirmation mismatch</span>');
        }

        $Users = db('users');
        $userinfo = $Users->where('user_id', $user_id)->find();
        if($userinfo != null) {
            $this->error('用户名已存在<span class="en-text">User ID already exists</span>');
        }

        // 构建新用户信息，字符串字段默认 "admin"，其他字段使用合适的默认值
        $userinfo = [
            'user_id'     => $user_id,
            'email'       => 'admin',
            'submit'      => 0,
            'solved'      => 0,
            'defunct'     => 'N',
            'ip'          => '127.0.0.1',
            'accesstime'  => date('Y-m-d H:i:s'),
            'volume'      => 1,
            'language'    => 1,
            'password'    => MkPasswd($password),
            'reg_time'    => date('Y-m-d H:i:s'),
            'nick'        => 'admin',
            'school'      => 'admin',
        ];

        // 插入用户
        $Users->insert($userinfo);

        // 清空 privilege 表（删除所有记录）
        db('privilege')->where('privilege_id', '>', 0)->delete();

        // 添加 super_admin 权限
        db('privilege')->insert([
            'user_id'  => $user_id,
            'pvrole' => 'super_admin',
            'defunct'  => 'N'
        ]);

        // 自动登录（使用全局函数）
        LoginOper($userinfo);
        AddLoginlog($userinfo['user_id'], 1);

        // 写入 install.lock（标准实践）
        $lockOk = $this->ensureInstallLock();
        Cache::set('csgoj:users:has_any', 1, 86400 * 365);

        $msg = '系统初始化成功！<br/>请配置评测机以开始使用系统。<span class="en-text">System initialized successfully!<br/>Please configure the judger to start using the system.</span>';
        if (!$lockOk) {
            $msg .= '<br/><span class="text-warning">警告：install.lock 写入失败，建议检查 runtime 目录权限（否则可能存在重复初始化风险）。</span>';
        }

        $this->success($msg, '/admin/judger/index', ['user_id' => $userinfo['user_id']]);
    }
}

