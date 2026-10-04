<?php
// Author: CSGrandeur
// ThinkPHP 5.1.42 配置文件
use think\facade\Env;

return [
    'SCHOOL_RANK_TEAMNUM' => 1, //contest school rank 计算学校排名的队伍个数
    // userinfo_rule、userinfo_msg用于验证用户注册信息的预定义规则
    'userinfo_rule' => [
        'user_id'   => ['require', 'min:5', 'max:20', '/^[a-zA-Z][a-zA-Z0-9_]*$/'],
        'nick'      => 'max:32',
        'email'     => 'require|email|max:64',
        'school'    => 'max:32',
        'password'  => 'min:6|max:64'
    ],
    'userinfo_msg' => [
        'user_id.require'               => 'User ID needed.',
        'user_id.min'                   => 'User ID should have at least 5 characters.',
        'user_id.max'                   => 'User ID should not exceed 20 characters.',
        'user_id./^[a-zA-Z][a-zA-Z0-9_]*$/' => 'User ID must start with a letter; only letters, digits and underscores are allowed after that.',
        'nick.max'                      => 'Nick should not exceed 30 characters.',
        'email.require'                 => 'Email address needed.',
        'email.email'                   => 'Please enter a valid E-mail address.',
        'email.max'                     => 'Email should not exceed 64 characters.',
        'school.max'                    => 'School name should not exceed 32 characters.',
        'password.min'                  => 'Password should have more than 6 characters.',
        'password.max'                  => 'Password should have less than 64 characters.'
    ],
    'EMAIL_VERIFY_WAIT'     => 20,
    'OJ_LANGUAGE'    =>[
        0   => 'C',
        1   => 'C++',
        3   => 'Java',
        6   => 'Python3',
        // 17  => 'Go',
        // 2    => 'Pascal'
    ],
    // 语言颜色配置：格式 [颜色类, '显示名称']
    // C/C++ 使用相同颜色（primary），Java 使用 warning，Python3 使用 success
    'OJ_LANGUAGE_COLOR' => [
        0   => ['primary', 'C'],      // C - primary（蓝色）
        1   => ['primary', 'C++'],     // C++ - primary（蓝色，与C相同）
        3   => ['warning', 'Java'],     // Java - warning（黄色）
        6   => ['success', 'Python3'],  // Python3 - success（绿色）
        // 17  => ['info', 'Go'],       // Go - info（青色）
        // 2    => ['secondary', 'Pascal'], // Pascal - secondary（灰色）
    ],
    'OJ_LANGUAGE_NORMALIZED' => [
        // 对接评测机支持的名称，兼容旧代码
        0   => 'c',
        1   => 'cpp',
        3   => 'java',
        6   => 'python',
        17  => 'go'
    ],
    'OJ_RESULTS'    =>[
        4   =>  'AC',
        5   =>  'PE',
        6   =>  'WA',
        7   =>  'TLE',
        8   =>  'MLE',
        9   =>  'OLE',
        10  =>  'RE',
        11  =>  'CE',
        90  =>  'JF',  // Judge Failed - 评测失败
        13  =>  'Tested',
        0   =>  'PD',
        1   =>  'PR',
        2   =>  'CI',
        3   =>  'RJ',
        -10 =>  'SC',  // Similarity Check - 查重中
    ],
    'OJ_RESULTS_HTML'    =>[
        // 格式：[颜色类, '英文全称', '英文缩写', '中文名称']（中文名称统一为4个字）
        4       =>  ['success', 'Accepted', 'AC', '答案正确'],
        5       =>  ['danger' , 'Presentation Error', 'PE', '格式错误'],
        6       =>  ['danger' , 'Wrong Answer', 'WA', '答案错误'],
        7       =>  ['warning', 'Time Limit Exceed', 'TLE', '时间超限'],
        8       =>  ['warning', 'Memory Limit Exceed', 'MLE', '内存超限'],
        9       =>  ['warning', 'Output Limit Exceed', 'OLE', '输出超限'],
        10      =>  ['warning', 'Runtime Error', 'RE', '运行错误'],
        11      =>  ['info', 'Compile Error', 'CE', '编译错误'],  // CE不再罚时，故换成info颜色
        90      =>  ['info', 'Judge Failed', 'JF', '评测失败'],  // 评测失败
        13      =>  ['default', 'Tested', 'TD', '测试完成'],
        100     =>  ['default', 'Unknown', 'UN', '未知状态'],
        0       =>  ['default res_running', 'Pending', 'PD', '等待评测'],
        1       =>  ['default res_running', 'Pending Rejudging', 'PR', '等待重测'],
        2       =>  ['default res_running', 'Compiling', 'CI', '正在编译'],
        3       =>  ['default res_running', 'Running&Judging', 'RJ', '正在评测'],
        -10     =>  ['secondary res_running', 'Similarity Check', 'SC', '正在查重'],  // 查重中，使用secondary颜色（比default深）
    ],
    'OJ_RESULTS_SHORT'    =>[
        4       =>  'AC',
        5       =>  'PE',
        6       =>  'WA',
        7       =>  'TLE',
        8       =>  'MLE',
        9       =>  'OLE',
        10      =>  'RE',
        11      =>  'CE',
        90      =>  'JF',
        13      =>  'TD',
        100     =>  'UN',
        0       =>  'PD',
        1       =>  'PR',
        2       =>  'CI',
        3       =>  'RJ',
        -10     =>  'SC',  // Similarity Check
    ],
    'OJ_CONFIG' => [
        'user_id_maxlen' => 30
    ],
    // 提交代码最大长度（字节），用于 Web 提交限制与对外 API 信息保持一致
    'OJ_SUBMIT_MAX_CODE_LENGTH'     => 65536,           // 目前仅在 CCS API 中使用
    'OJ_UPLOAD_ATTACH_MAXSIZE'      => 1073741824,      // 一般文件上传尺寸限制，比如题目描述的插图
    'OJ_UPLOAD_TESTDATA_MAXSIZE'    => 1073741824,      // 判题数据的尺寸限制
    'OJ_UPLOAD_IMPORT_MAXSIZE'      => 1073741824,      // 导入题目最大尺寸
    'OJ_UPLOAD_MAXNUM'              => 20,              // 一次最多上传多少个文件

    // 图像上传统一约束（前端会预处理为 jpg，并缩放到不超过该尺寸；后端仅做检查）
    'OJ_IMAGE_MAX_DIM'              => 1024,

    'OJ_RANKDYNAMIC_CACHE_OPTION'   => ['type'=>'File', 'expire'=>10, 'path'=>Env::get('runtime_path') . 'cache' . DIRECTORY_SEPARATOR, 'prefix'=>'csgoj'],  //新版Rank的cache配置
    'OJ_SUBMIT_WAIT_TIME'           => 5,       //两次提交code时间间隔
    'OJ_TOPIC_WAIT_TIME'            => 5,       //两次提交topic时间间隔
    'OJ_TEST_DOWNLOAD_WAIT_TIME'    => 720,     //两次下载测试数据时间间隔
    'OJ_CLSS_STU_BATCH_WAIT_TIME'   => 15,      //两次批量修改班级学生时间间隔（秒）
    'OJ_PRIVILEGE_CACHE_TIME'       => 20,      //权限查询缓存时长（秒）

    'OJ_PASSBACK_CACHE_OPTION' => ['type'=>'File', 'expire'=>1200, 'path'=>Env::get('runtime_path') . 'cache' . DIRECTORY_SEPARATOR, 'prefix'=>'csgoj'],  //密码找回的cache配置
];
