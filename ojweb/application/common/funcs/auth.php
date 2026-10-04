<?php
/**
 * 登录 / 管理员 / 权限配置相关函数
 *
 * 作用：
 * - 登录态判断与登录用户获取
 * - 管理员/资源管理权限判断（IsAdmin）
 * - 登录/登出会话初始化与清理（LoginOper/LogoutOper）
 * - 登录日志记录（AddLoginlog）
 * - PrivilegeRole 配置读取（GetPvroleConfig）
 *
 * 依赖：
 * - ThinkPHP：`session()`, `config()`, `db()`
 * - funcs 依赖：GetRealIp（来自 `misc.php`）
 * - funcs 依赖：GetPrivCacheKey/PrivItem/PrivSession（来自 `privilege.php`）
 *
 * 约束：
 * - 仅允许函数定义；禁止文件顶层执行任何逻辑。
 * - 由 `ojweb/application/common.php` 统一 require_once 引入。
 *
 * 导出函数：
 * - IsLogin, GetLoginUser
 * - GetOjMode, GetOjAdminConfig
 * - IsAdmin
 * - LoginOper, LogoutOper, AddLoginlog
 * - GetPvroleConfig
 */

//管理员权限验证
function IsLogin() {
    // 判断是否登录
    return session('?user_id');
}

function GetLoginUser() {
    return session('user_id');
}

function GetOjMode() {
    return config('OJ_ENV.OJ_MODE');
}

function GetOjAdminConfig() {
    return config('OjAdmin.online');
}

function IsAdmin($item='administrator', $id=null)
{
    if(!IsLogin()) {
        return false;
    }
    $item = trim($item);
    
    // 生成缓存 key（自动处理 user_id 验证）
    $cache_key = GetPrivCacheKey('is_admin', ['item' => $item, 'id' => $id]);
    if($cache_key === false) {
        return false;
    }
    
    // 检查缓存
    if(PrivSession('?' . $cache_key)) {
        return PrivSession($cache_key);
    }
    // 从 session 读取 privilege 表的权限列表（使用字典，O(1) 查找）
    $hasPrivilege = function($pvrole) {
        $privilege_dict = session('?privilege_dict') ? session('privilege_dict') : [];
        
        return isset($privilege_dict[$pvrole]);
    };
    // 检查 super_admin 权限
    if($hasPrivilege('super_admin')) {
        $result = true;
        PrivSession($cache_key, $result);
        return $result;
    }
    
    // judger 特判，不允许其他账号哪怕是 administrator 进行评测
    if($item == 'judger') {
        $result = $hasPrivilege('judger');
        PrivSession($cache_key, $result);
        return $result;
    }
    
    if($item == 'super_admin') {
        $result = $hasPrivilege('super_admin');
        PrivSession($cache_key, $result);
        return $result;
    }
    
    $OJ_ADMIN = GetOjAdminConfig();
    // 检查配置是否存在
    if (empty($OJ_ADMIN) || !is_array($OJ_ADMIN)) {
        $result = false;
        PrivSession($cache_key, $result);
        return $result;
    }
    $ojAdminList    = $OJ_ADMIN['OJ_ADMIN_LIST'] ?? [];
    $ojAllPrivilegeList = array_merge($ojAdminList, $OJ_ADMIN['OJ_PRIVILEGE'] ?? []);
    $ret = false;
    
    if(array_key_exists($item, $ojAllPrivilegeList)) {
        // 如果 $item 存在于管理员列表中，直接验证
        if($ret = $hasPrivilege($item)) {
            PrivSession($cache_key, $ret);
            return $ret;
        }
    }
    
    // 如果有 id，使用 PrivItem 函数检查资源权限
    if($id != null) {
        // ex_question：归属由 course_item 维护，权限按 course 维度判断（teacher/admin/super）
        if($item === 'ex_question') {
            $ex_question_id = intval($id);
            if($ex_question_id > 0) {
                $cache_time = config('CsgojConfig.OJ_PRIVILEGE_CACHE_TIME');
                $course_id = db('course_item')->where([
                    'item' => 'ex_question',
                    'item_id' => $ex_question_id,
                ])
                // 兼容历史数据：pvrole 可能是 NULL 或空字符串
                ->where(function($q) {
                    $q->whereNull('pvrole')->whereOr('pvrole', '');
                })
                ->cache($cache_time)->value('course_id');
                if($course_id) {
                    // 允许：课程 teacher/admin/super 或全局题库/比赛编辑权限
                    if(
                        PrivItem('course', $course_id, ['super', 'admin', 'teacher']) ||
                        $hasPrivilege('problem_editor') ||
                        $hasPrivilege('contest_editor')
                    ) {
                        $result = true;
                        PrivSession($cache_key, $result);
                        return $result;
                    }
                }
            }
        } else {
            // 支持的资源类型（基于 privilege_item ）
            $supported_items = ['news', 'problem', 'contest', 'course'];
            if(in_array($item, $supported_items)) {
                // 对于 course，检查 admin 权限（PrivItem 内部会处理 super/admin）
                // 对于其他资源，检查 admin 权限
                $check_pvrole = 'admin';
                if(PrivItem($item, $id, $check_pvrole)) {
                    $result = true;
                    PrivSession($cache_key, $result);
                    return $result;
                }
            }
        }
    }
    
    // 检查是否有管理员或超级管理员权限
    if($hasPrivilege('administrator') || $hasPrivilege('super_admin')) {
        $result = true;
        PrivSession($cache_key, $result);
        return $result;
    }
    
    PrivSession($cache_key, $ret);
    return $ret;
}

function LoginOper($userinfo) {
    $OJ_ADMIN = GetOjAdminConfig();
    // 设置登录后的session
    session('user_id', $userinfo['user_id']);
    
    // 查询 privilege 表的所有权限并存储到 session
    $Privilege = db('privilege');
    $privilegelist = $Privilege->where('user_id', $userinfo['user_id'])
        ->field(['pvrole'])
        ->select();
    
    // 将所有 pvrole 值存储到 session 中（作为关联数组/字典，便于快速查找）
    $privilege_dict = [];
    foreach($privilegelist as $privilege) {
        $privilege_dict[$privilege['pvrole']] = true;
    }
    session('privilege_dict', $privilege_dict);
    
    // 只检查管理员权限（用于返回 $ret）
    $ret = [];
    foreach($privilegelist as $privilege) {
        if(array_key_exists($privilege['pvrole'], $OJ_ADMIN['OJ_ADMIN_LIST'])) {
            $ret[$privilege['pvrole']] = true;
        }
    }
    
    // 用户信息
    session('login_user_info', [
        'team_id'   => $userinfo['user_id'],
        'name'      => $userinfo['nick'],
        'tmember'   => '',
        'coach'     => '',
        'school'    => $userinfo['school'],
        'room'      => ''
    ]);
    return $ret;
}

function AddLoginlog($user_id, $success){
    // 添加登录日志
    $ip = GetRealIp();
    $time = date("Y-m-d H:i:s");
    db('loginlog')->insert(
        [
            'user_id'=>$user_id,
            'success' => $success,
            'ip' => $ip,
            'time'=> $time
        ]);
    db('users')
        ->where('user_id', $user_id)
        ->update(['ip'=>$ip, 'accesstime'=>$time]);
}

function LogoutOper() {
    session('login_user_info', null);
    session('user_id', null);
    // 清空所有 item 权限相关的 session（使用 PrivSession 存储的所有数据）
    session('priv', null);
    // 清空 privilege 表的权限列表
    session('privilege_dict', null);
}

/**
 * 安全获取 PrivilegeRole 配置值
 * 如果配置不存在，返回默认值
 * 
 * @param string $key 配置键名
 * @param mixed $default 默认值
 * @return mixed
 */
function GetPvroleConfig($key, $default = null) {
    $config = config('PrivilegeRole.');
    if(empty($config) || !is_array($config) || !isset($config[$key])) {
        return $default;
    }
    return $config[$key];
}


