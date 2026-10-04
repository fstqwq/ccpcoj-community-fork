<?php
/**
 * Created by PhpStorm.
 * User: CSGrandeur
 * Date: 2017/3/2
 * Time: 20:26
 */
namespace app\admin\controller;
class Privilege extends Adminbase
{
	//***************************************************************//
	//Privilege
	//***************************************************************//
	var $ojAllPrivilege;
	public function initialize()
	{
		$this->OJMode();
		$this->AdminInit();
		$this->ojAllPrivilege = array_merge($this->ojAdminList, $this->OJ_ADMIN['OJ_PRIVILEGE']);
	}
	public function index()
	{
		$allowAdmin = [];
		foreach($this->ojAllPrivilege as $key=>$value) {
			// 为每个权限添加flg_allow字段
			$allowAdmin[$key] = $value;
			$allowAdmin[$key]['flg_allow'] = true; // 默认允许
			
			// 根据权限规则设置flg_allow
			if($key == 'administrator' && !IsAdmin('super_admin')) {
				$allowAdmin[$key]['flg_allow'] = false;
			}
			if($key == 'super_admin') {
				$allowAdmin[$key]['flg_allow'] = false;
			}
			if($key == 'judger') {
				$allowAdmin[$key]['flg_allow'] = false; // 不在此界面管理评测机
			}
		}
		$this->assign('allowAdmin', $allowAdmin);
		return $this->fetch();
	}
	public function privilege_list_ajax()
	{
		$Privilege = db('privilege');

		$map = [
			['pvrole', 'in', array_keys($this->ojAllPrivilege)],
			['pvrole', 'neq', 'judger']  // 排除 judger 权限，评测机不在 privilege 表管理
		];
		$list = $Privilege
			->alias('p')
			->join('users u', 'p.user_id = u.user_id', 'left')
			->field('p.privilege_id,p.user_id,p.pvrole,u.nick,u.school')
			->where($map)
			->order('p.user_id', 'asc')
			->select();
		foreach($list as &$privilege)
		{
			// 只返回原始数据，不进行HTML格式化
			$privilege['can_delete'] = false;
			if(IsAdmin('administrator') && $privilege['pvrole'] != 'super_admin' && ($privilege['pvrole'] != 'administrator' || IsAdmin('super_admin')))
			{
				// 是管理员、且管理对象不是超级管理员、且（管理对象不是管理员 或 自己是超级管理员）时，可以delete
				$privilege['can_delete'] = true;
			}
		}
		return $list;
	}
	private function privilege_Authentication()
	{
		$data = input('post.');
		$user_id = $data['user_id'];
		$pvrole = isset($data['pvrole']) ? $data['pvrole'] : [];
		if(count($pvrole) == 0)
			$this->error('No privilege submitted');
		if(in_array('super_admin', $pvrole))
			$this->error('Powerless');
		if(in_array('administrator', $pvrole) && !IsAdmin('super_admin'))
			$this->error('Powerless');
		if(!IsAdmin('administrator'))
			$this->error('Powerless');
		foreach($pvrole as $rs)
		{
			if(!array_key_exists($rs, $this->ojAllPrivilege))
				$this->error('Not valid admin string: '.$rs);
		}
		$userinfo = [];
        if(!($userinfo = db('users')->where('user_id', $user_id)->field('user_id')->find())) {

            if(input('enforce/d') !== 1) {
                $this->error('No such user', null, 'nouser');
            } else {
                // enforce=1 则允许在用户不存在的情况下强行处理
                $user_id_validated = preg_replace("/[^a-zA-Z0-9_]/", "", $user_id);
                $strlen = strlen($user_id_validated);
                if($strlen < 5 || $strlen > 20) {
                    $this->error("user_id length should be between 5 and 20");
                }
                $userinfo = [
                    'user_id' => $user_id_validated
                ];
            }
        }
		return ['user_id' => $userinfo['user_id'], 'pvrole' => $pvrole];
	}
	public function privilege_add_ajax()
	{
		$privilegeData = $this->privilege_Authentication();
		$Privilege = db('privilege');
		$Privilege->where('user_id', $privilegeData['user_id'])->where('pvrole', 'in', $privilegeData['pvrole'])->delete();
		foreach($privilegeData['pvrole'] as $pvrole)
		{
			$Privilege->insert(['user_id' => $privilegeData['user_id'], 'pvrole' => $pvrole]);
		}
		$this->success('Privilege added');
	}
	public function privilege_delete_ajax()
	{
		$privilegeData = $this->privilege_Authentication();
		db('privilege')->where('user_id', $privilegeData['user_id'])->where('pvrole', 'in', $privilegeData['pvrole'])->delete();
		$this->success('Privilege deleted');
	}
}