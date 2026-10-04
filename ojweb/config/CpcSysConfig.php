<?php

return [
    'SCHOOL_RANK_TEAMNUM' => 4, //计算学校排名的队伍个数
    // cpcsys/teaminfo 视图展示映射（控制器读取后 assign，避免在模板内写业务映射）
    'TEAM_TYPE_LABEL' => [
        0 => ['cn' => '正式队伍', 'en' => 'Regular Team'],
        1 => ['cn' => '女队', 'en' => 'Girls Team'],
        2 => ['cn' => '打星队伍', 'en' => 'Star Team'],
    ],
    'TEAM_PRIVILEGE_LABEL' => [
        'admin' => ['cn' => '管理员', 'en' => 'Administrator'],
        'printer' => ['cn' => '打印员', 'en' => 'Printer'],
        'balloon_manager' => ['cn' => '气球管理员', 'en' => 'Balloon Manager'],
        'balloon_sender' => ['cn' => '气球发送员', 'en' => 'Balloon Sender'],
        'watcher' => ['cn' => '观察员', 'en' => 'Watcher'],
        'ccs_reader' => ['cn' => 'CCS接口', 'en' => 'CCS Reader'],
    ],
    'PRINT_STATUS'    =>[
        0    =>    'Waiting',
        1    =>    'Printed',
        2    =>    'Denied',
    ],
    'PRINT_STATUS_HTML'    =>[
        0    =>    ['info', 'Waiting'],
        1    =>    ['success', 'Printed'],
        2    =>    ['danger', 'Denied'],
    ],
    // userinfo_rule、userinfo_msg用于验证用户注册信息的预定义规则
    'teaminfo_rule'    => [
        'team_id'    => ['require', 'min:3', 'max:30', '/^[a-zA-Z0-9]+$/'],
        'name'         => 'max:100',
        'name_en'     => 'max:120',
        'region'      => 'max:100',
        'tmember'     => 'max:100',
        'school'     => 'max:64',
        'coach'     => 'max:32',
        'password'     => 'min:6|max:250'
    ],
    'teaminfo_msg' => [
        'team_id.require'             => 'User ID needed.',
        'team_id.min'                 => 'User ID should have more than 3 characters.',
        'team_id.max'                 => 'User ID should not exceed 30 characters.',
        'team_id./^[a-zA-Z0-9]+$/' => 'Only number and letters are allowed for User ID.',
        'name.max'                    => 'Team name should not exceed 100 characters.',
        'name_en.max'                 => 'English team name should not exceed 120 characters.',
        'region.max'                  => 'Region should not exceed 100 characters.',
        'tmember.max'                    => 'Members should not exceed 100 characters.',
        'school.max'                => 'School name should not exceed 64 characters.',
        'coach.max'                => 'Coach name should not exceed 32 characters.',
        'password.min'                => 'Password should have more than 6 characters.',
        'password.max'                => 'Password should have less than 250 characters.'
    ],
    'userinfo_rule'	=> [
		'user_id'	=> ['require', 'min:5', 'max:20', '/^[a-zA-Z][a-zA-Z0-9_]*$/'],
		'nick' 		=> 'max:32',
		'email' 	=> 'max:100',
		'school' 	=> 'max:64',
		'password' 	=> 'min:6|max:64'
	],
	'userinfo_msg' => [
		'user_id.require' 			=> 'User ID needed.',
		'user_id.min' 				=> 'User ID should have more than 5 characters.',
		'user_id.max' 				=> 'User ID should not exceed 20 characters.',
		'user_id./^[a-zA-Z][a-zA-Z0-9_]*$/' => 'User ID must start with a letter; only letters, digits and underscores are allowed after that.',
		'nick.max'					=> 'Team name should not exceed 30 characters.',
		'email.max'					=> 'Members should not exceed 100 characters.',
		'school.max'				=> 'School name should not exceed 64 characters.',
		'password.min'				=> 'Password should have more than 6 characters.',
		'password.max'				=> 'Password should have less than 64 characters.'
	],
    // 客户端管理：队伍号（team_id_bind）校验，与 cpc_client.team_id_bind varchar(64) 及字符规范一致（文案中文在前）
    'client_team_id_bind' => [
        'max'      => 32,
        'regex'    => '/^[a-zA-Z0-9_]+$/',
        'msg_max'  => '队伍号最多32个字符 / Team ID should not exceed 32 characters.',
        'msg_regex' => '队伍号仅允许字母、数字、下划线 / Only letters, numbers and underscores are allowed for Team ID.',
    ],
];
