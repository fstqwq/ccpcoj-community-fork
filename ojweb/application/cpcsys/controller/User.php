<?php
namespace app\cpcsys\controller;
use app\csgoj\controller\User as Userbase;
class User extends Userbase
{
	// cpcsys 模式下无常规用户，且禁止访问 csgoj
	// 只有管理员可访问以及有修改信息需求，所以该模块代码理论上无法触及，无需访问
	public function modify()
	{
		if(!IsAdmin('administrator'))
		{
			$this->error('You cannot modify user without admin privilege', null, '', 1);
		}
		$userinfo = $this->modify_func();
		return $this->fetch();
	}
	public function modify_ajax()
	{
		if(!IsAdmin('administrator'))
		{
			$this->error('You cannot modify user without admin privilege', null, '', 1);
		}
		$this->modify_ajax_func(input('post.'));
	}
	public function register()
	{
		$this->error('Registration is prohibited.');
		return $this->fetch();
	}
	public function register_ajax()
	{
		$this->error('Registration is prohibited.');
	}

	/**
	 * cpcsys 不单独维护找回密码页；与 userinfo/modify 一致，复用 csgoj 视图（避免重复与旧 wrongcode 表单）。
	 */
	public function passback()
	{
		if(session('?user_id'))
		{
			$this->error('您已登录，无需使用找回密码。 / You are already logged in; password recovery is not needed.');
		}
		return $this->fetch('../../csgoj/view/user/passback');
	}
}
