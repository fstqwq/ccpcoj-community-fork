<?php
/**
 * 实验考试系统比赛管理 Trait
 * 提供 expsys 和 examsys 模块的比赛管理特化功能
 * 
 * 使用 ContestAdminBaseTrait，重载部分方法实现 exp 系统特有的逻辑
 * 用于 expsys、examsys、exadmin 模块的 Admin 控制器
 */
namespace app\common\traits;

use think\Db;
use think\facade\Validate;

trait ContestAdminExpTrait
{
    use ContestAdminBaseTrait;  // 使用 ContestAdminBaseTrait，自动包含所有基础管理方法
    
    // ========== 重载权限管理钩子方法 ==========
    
    /**
     * 重载：比赛创建后处理（exp 系统：添加 owner 权限等）
     * @param int $contest_id 比赛ID
     * @param array $contest_data 比赛数据
     * @return void
     */
    protected function afterContestCreated($contest_id, $contest_data = [])
    {
        // exp 系统：如果用户是教师，添加 owner 权限
        if (session('user_id') && isset($this->NOW_COURSE_KEY) && PrivCourse('teacher', $this->NOW_COURSE_KEY)) {
            try {
                // exp 模式下创建新资源时，不检查权限（因为资源刚创建，还没有权限记录）
                $checkPrivilege = (isset($this->OJ_STATUS) && $this->OJ_STATUS != 'exp');
                AddPrivilege(session('user_id'), 'contest', $contest_id, $checkPrivilege, 'owner');
            } catch (\Throwable $e) {
                // ignore（可能权限已存在或其他错误）
            }
        } else if (session('?contest_editor')) {
            // 兼容旧代码：contest_editor 权限
            if (method_exists($this, 'AddPrivilege')) {
                $this->AddPrivilege(session('user_id'), 'contest', $contest_id);
            }
        }
    }
    
    // ========== 重载 Hook 方法，实现 course 筛选逻辑 ==========
    
    /**
     * 重载：获取查询过滤条件，使用 course_item 表联查
     * @param string $tableName 表名
     * @return array|null 返回联查配置数组 ['join' => ..., 'where' => ...] 或 null（不使用联查）
     */
    protected function getQueryFilter($tableName = '')
    {
        // 需要 course_item 过滤的表
        $courseItemTables = ['contest'];
        if(!in_array($tableName, $courseItemTables) || !isset($this->NOW_COURSE_ID) || !$this->NOW_COURSE_ID) {
            return null;
        }
        
        // 映射表名到 item 类型和主键字段名
        $itemTypeMap = [
            'contest' => ['item' => 'contest', 'id_field' => 'contest_id']
        ];
        
        if(!isset($itemTypeMap[$tableName])) {
            return null;
        }
        
        $itemType = $itemTypeMap[$tableName]['item'];
        $idField = $itemTypeMap[$tableName]['id_field'];
        
        // 返回联查配置
        return [
            'join' => [
                'course_item ci',
                'ci.item_id = ' . $tableName . '.' . $idField . ' AND ci.item = \'' . $itemType . '\'',
                'inner'
            ],
            'where' => [
                'ci.course_id' => $this->NOW_COURSE_ID,
            ],
            // 兼容历史数据：pvrole 可能是 NULL 或空字符串
            'where_func' => function($q) {
                $q->where(function($qq) {
                    $qq->whereNull('ci.pvrole')->whereOr('ci.pvrole', '');
                });
            }
        ];
    }
    
    /**
     * 重载：自动应用查询过滤条件到查询对象
     * @param \think\db\Query $query 查询对象
     * @param array $map 现有的查询条件
     * @param string $tableName 表名
     * @return \think\db\Query 处理后的查询对象
     */
    protected function applyQueryFilterToQuery($query, $map, $tableName = '')
    {
        $filter = $this->getQueryFilter($tableName);
        if ($filter && is_array($filter)) {
            // 如果返回的是联查配置
            if(isset($filter['join']) && isset($filter['where'])) {
                // 先应用 $map 中的查询条件（包含 ThinkPHP 查询语法）
                $query->where($map);
                // 应用联查
                $joinConfig = $filter['join'];
                $query->join($joinConfig[0], $joinConfig[1], $joinConfig[2] ?? 'inner');
                // 应用 filter 的 where 条件（course_item 表的条件）
                foreach($filter['where'] as $key => $value) {
                    if($value === null) {
                        // ThinkPHP5.1：NULL 条件必须用 whereNull/whereRaw
                        if(strpos($key, '.') !== false) {
                            $query->whereRaw($key . ' IS NULL');
                        } else {
                            $query->whereNull($key);
                        }
                    } else {
                        $query->where($key, $value);
                    }
                }
                // 支持额外闭包条件（例如：pvrole 兼容 NULL 或空字符串）
                if (isset($filter['where_func']) && is_callable($filter['where_func'])) {
                    $func = $filter['where_func'];
                    $func($query);
                }
            } else {
                // 兼容旧逻辑：简单的 where 条件
                $map = array_merge($map, $filter);
                $query->where($map);
            }
        } else {
            // 没有 filter，直接应用 $map
            $query->where($map);
        }
        return $query;
    }
    
    /**
     * 重载：在插入数据后添加 course_item 映射
     * @param array $data 插入的数据
     * @param string $tableName 表名
     * @param int $insertId 插入后返回的ID
     * @return void
     */
    protected function afterInsertData($data, $tableName = '', $insertId = null)
    {
        // 需要 course_item 映射的表
        $courseItemTables = ['contest'];
        if(!in_array($tableName, $courseItemTables) || !isset($this->NOW_COURSE_ID) || !$this->NOW_COURSE_ID) {
            return;
        }
        
        // 映射表名到 item 类型和主键字段名
        $itemTypeMap = [
            'contest' => ['item' => 'contest', 'id_field' => 'contest_id']
        ];
        
        if(!isset($itemTypeMap[$tableName])) {
            return;
        }
        
        $itemType = $itemTypeMap[$tableName]['item'];
        $idField = $itemTypeMap[$tableName]['id_field'];
        
        // 获取插入的ID（优先使用参数，否则从数据中获取）
        $itemId = $insertId;
        if($itemId === null && isset($data[$idField])) {
            $itemId = $data[$idField];
        }
        
        if($itemId === null) {
            return;
        }
        
        // 插入 course_item 映射
        db('course_item')->insert([
            'course_id' => $this->NOW_COURSE_ID,
            'item' => $itemType,
            'item_id' => $itemId,
            'pvrole' => null
        ]);
    }
    
    /**
     * 重载：验证资源归属（用于验证 course_key 等）
     * @param array $item 资源数据
     * @param string $itemType 资源类型
     * @return void
     */
    protected function validateItemBelong($item, $itemType = '')
    {
        // exp 系统：验证资源是否属于当前课程
        if(!isset($this->NOW_COURSE_ID) || !$this->NOW_COURSE_ID) {
            return;
        }
        
        $courseItemTables = ['contest'];
        if(!in_array($itemType, $courseItemTables)) {
            return;
        }
        
        $itemTypeMap = [
            'contest' => ['item' => 'contest', 'id_field' => 'contest_id']
        ];
        
        if(!isset($itemTypeMap[$itemType])) {
            return;
        }
        
        $itemTypeName = $itemTypeMap[$itemType]['item'];
        $idField = $itemTypeMap[$itemType]['id_field'];
        
        if(!isset($item[$idField])) {
            return;
        }
        
        // 检查 course_item 映射是否存在
        $courseItem = db('course_item')->where([
            'course_id' => $this->NOW_COURSE_ID,
            'item' => $itemTypeName,
            'item_id' => $item[$idField],
        ])->where(function($q) {
            $q->whereNull('pvrole')->whereOr('pvrole', '');
        })->find();
        
        if(!$courseItem) {
            $this->error('资源不属于当前课程 / Resource does not belong to current course');
        }
    }
    
    // ========== 重载管理方法，实现 exp 系统特有逻辑 ==========
    
    /**
     * 重载：清空账号（实验考试系统专用）
     * @param bool $clearProctorAccounts 是否清空监考账号（true=清空admin权限账号，false=清空普通考生账号）
     * @param bool $clearReviewerAccounts 是否清空阅卷账号（true=清空reviewer权限账号）
     */
    public function ClearTeam($clearProctorAccounts=false, $clearReviewerAccounts=false) {
        $map = [
            'contest_id' => $this->contest['contest_id']
        ];
        
        if($clearProctorAccounts) {
            // 清空监考账号：privilege 为 'admin' 的账号（不包括 'reviewer'）
            db('cpc_team')->where($map)
                ->where('privilege', 'admin')
                ->delete();
        } else if($clearReviewerAccounts) {
            // 清空阅卷账号：privilege 为 'reviewer' 的账号
            db('cpc_team')->where($map)
                ->where('privilege', 'reviewer')
                ->delete();
        } else {
            // 清空普通考生账号：privilege 为 null 或空字符串的账号
            db('cpc_team')->where($map)->where(function($query) {
                $query->whereNull('privilege')->whereOr('privilege', '');
            })->delete();
        }
    }
    
    /**
     * 重载：比赛账号生成（实验考试系统专用，用于 exam contest）
     * 注意：examsys 模块需要确保 private % 10 == 5，expsys 模块也需要此检查
     */
    public function contest_teamgen_ajax() {
        // 检查是否是 exam 类型的比赛（private % 10 == 5）
        if($this->contest['private'] % 10 != 5) {
            $this->error("This is not an exam.");
        }
        if(!$this->IsContestAdmin()) {
            $this->error("You are not system administrator.");
        }
        
        // 获取POST数据
        $teamList = input('team_list');
        $reset_team = input('reset_team', false);
        $use_system_pass = input('use_system_pass', false);
        // 处理布尔值：可能是 'on', 'true', true, 1 等格式
        if($use_system_pass === 'on' || $use_system_pass === 'true' || $use_system_pass === true || $use_system_pass === 1 || $use_system_pass === '1') {
            $use_system_pass = true;
        } else {
            $use_system_pass = false;
        }
        $password_seed = input('password_seed', 0);
        $account_gen_type = input('account_gen_type', 'student'); // 获取生成类型
        
        // 判断是新格式（JSON）还是旧格式（文本）
        $isJsonFormat = !empty($teamList);
        
        // 判断账号类型
        $isProctor = ($account_gen_type === 'proctor' || $this->action === 'account_gen_proctor');
        $isReviewer = ($account_gen_type === 'reviewer' || $this->action === 'reviewer_manage');
        
        if($isJsonFormat) {
            // 新格式：JSON数据
            if (!$teamList) {
                $this->error('No account data provided');
            }
            
            // 解析JSON数据
            $teams = json_decode($teamList, true);
            if (!$teams || !is_array($teams)) {
                $this->error('Invalid account data format');
            }
            
            // 根据区分参数决定清空哪种类型的账号
            if($reset_team === 1 || $reset_team === true || $reset_team === 'on' || $reset_team === 'true') {
                if($isProctor) {
                    // 监考生成：只清空admin权限的账号
                    $this->ClearTeam(true);
                } else if($isReviewer) {
                    // 阅卷生成：只清空reviewer权限的账号
                    $this->ClearTeam(false, true);
                } else {
                    // 考生生成：只清空普通账号
                    $this->ClearTeam();
                }
            }
            
            if(count($teams) == 0) {
                $this->error('No accounts to generate');
            }
            if(count($teams) > 5000) {
                $this->error('Too many accounts');
            }
            
            $teamToInsert = [];
            $teamToShow = [];
            $validate = Validate::make(config('CpcSysConfig.teaminfo_rule'), config('CpcSysConfig.teaminfo_msg'));
            $validateNotList = '';
            
            // 检查team_id重复
            $teamIds = [];
            foreach($teams as $teamData) {
                $teamId = $teamData['team_id'] ?? '';
                if($teamId != '') {
                    if(in_array($teamId, $teamIds)) {
                        $this->error("Duplicate team_id found: " . $teamId);
                    }
                    $teamIds[] = $teamId;
                }
            }
            
            foreach($teams as $teamData) {
                $nowTeam = [];
                
                // 处理team_id（必须提供，不允许为空）
                $teamId = $teamData['team_id'] ?? '';
                if($teamId == '') {
                    $this->error('Account ID is required for all accounts');
                }
                $nowTeam['team_id'] = $teamId;
                
                // 处理其他字段
                $nowTeam['name'] = $teamData['name'] ?? '';
                $nowTeam['school'] = $teamData['school'] ?? '';
                $nowTeam['room'] = $teamData['room'] ?? '';
                $nowTeam['tkind'] = intval($teamData['tkind'] ?? 0);
                if(!in_array($nowTeam['tkind'], [0, 2, 10, 11, 12, 20, 21, 22])) {
                    $nowTeam['tkind'] = 0;
                }
                
                // 处理密码
                $password = $teamData['password'] ?? '';
                if($use_system_pass) {
                    $password = "[SYS_PASS]";
                } else if($password == '') {
                    $password = $this->generateSeededPassword($teamId, $password_seed);
                }
                $nowTeam['password'] = $password;
                
                // 处理权限（由代码自动设置，不从输入读取）
                if($isProctor) {
                    // 监考生成：自动设置为admin权限
                    $nowTeam['privilege'] = 'admin';
                } else if($isReviewer) {
                    // 阅卷生成：自动设置为reviewer权限
                    $nowTeam['privilege'] = 'reviewer';
                } else {
                    // 考生生成：自动设置为null（普通账号）
                    $nowTeam['privilege'] = null;
                }
                
                $nowTeam['contest_id'] = $this->contest['contest_id'];
                
                // 验证数据
                if(!$validate->check($nowTeam)) {
                    $validateNotList .= "<br/>" . $nowTeam['team_id'] . ': ' . $validate->getError();
                }
                
                if(strlen($validateNotList) == 0) {
                    // 保存原始密码用于显示（在加密之前）
                    $originalPassword = $nowTeam['password'];
                    $teamToShow[] = array_merge($nowTeam, ['_original_password' => $originalPassword]);
                    
                    // 加密密码用于存储（系统密码不需要加密）
                    if($nowTeam['password'] != "[SYS_PASS]") {
                        $nowTeam['password'] = MkPasswd($nowTeam['password'], true);
                    }
                    $teamToInsert[] = $nowTeam;
                }
            }
            
            if(strlen($validateNotList) > 0) {
                $addInfo = '<br/>Some account information is not valid. Please check.' . $validateNotList;
                $this->error('Account generation failed.' . $addInfo);
            }
            
            $success_num = db('cpc_team')->insertAll($teamToInsert, true);
            if(!$success_num) {
                $this->error('Account generation failed. Please check the data input.');
            }
            
            // 恢复密码用于显示
            foreach($teamToShow as &$team) {
                if(isset($team['_original_password'])) {
                    // 使用保存的原始密码
                    $team['password'] = $team['_original_password'];
                    unset($team['_original_password']);
                } else if($team['password'] != "[SYS_PASS]") {
                    // 如果没有原始密码，尝试恢复（旧格式兼容）
                    $team['password'] = RecoverPasswd($team['password']);
                }
            }
            
            $this->success('Account successfully generated. <br/>See the table below', null, ['rows' => $teamToShow, 'type' => 'teamgen', 'success_num'=> $success_num]);
        } else {
            // 旧格式：文本数据（保持向后兼容）
            $reset_team = input('reset_team', false) == 'on';
            $use_system_pass = input('use_system_pass', false) == 'on';
            if($reset_team) {
                // 旧格式默认为考生生成，只清空普通账号
                if($isProctor) {
                    // 监考生成：只清空admin权限的账号
                    $this->ClearTeam(true);
                } else if($isReviewer) {
                    // 阅卷生成：只清空reviewer权限的账号
                    $this->ClearTeam(false, true);
                } else {
                    // 考生生成：只清空普通账号
                    $this->ClearTeam();
                }
            }
            $teamDescription = trim(input('team_description'), "\n\r");
            if(strlen(trim($teamDescription)) == 0)
                $teamList = [];
            else
                $teamList = explode("\n", $teamDescription);
            $teamListLen = count($teamList);    //teamDescription的行数
            if($teamListLen == 0)
                $this->error('At least fill in one form of Account description or Account number');
            if($teamListLen > 5000)
                $this->error('Too many teams');
            $teamToInsert = [];
            $teamToShow = [];
            // 旧格式：根据类型决定字段列表（不再包含privilege字段）
            if($isProctor || $isReviewer) {
                // 监考/阅卷生成：team_id, name, school, room, password (5个字段)
                $fieldList = ['team_id', 'name', 'school', 'room', 'password'];
            } else {
                // 考生生成：team_id, name, school, room, tkind, password (6个字段)
                $fieldList = ['team_id', 'name', 'school', 'room', 'tkind', 'password'];
            }
            $fieldNum = count($fieldList);
            $validate = Validate::make(config('CpcSysConfig.teaminfo_rule'), config('CpcSysConfig.teaminfo_msg'));
            $validateNotList = '';
            
            foreach($teamList as $teamStr){
                $teamInput = preg_split("/[#\\t]/", $teamStr);
                $nowTeam = [];
                for($j = 0; $j < $fieldNum; $j ++)
                {
                    if(!array_key_exists($j, $teamInput))
                        $teamInput[$j] = '';
                    $field = trim($teamInput[$j]);
                    switch($fieldList[$j]) {
                        case 'team_id':
                            if($field == '' || strlen($field) > 24)
                                $validateNotList .= "<br/>[$teamStr] userid should be given.";
                            $nowTeam['team_id'] = $field;
                            break;
                        case 'password':
                            if($use_system_pass)
                                $field = "[SYS_PASS]";
                            else if($field == '')
                                $field = RandPass();
                            $nowTeam['password'] = $field;
                            break;
                        case 'contest_id':
                            $nowTeam['contest_id'] = $this->contest['contest_id'];
                            break;
                        case 'tkind':
                            $nowTeam['tkind'] = in_array(intval($field), [0, 2, 10, 11, 12, 20, 21, 22]) ? intval($field) : 0;
                            break;
                        default:
                            $nowTeam[$fieldList[$j]] = $field;
                    }
                }
                $nowTeam['contest_id'] = $this->contest['contest_id'];
                
                // 权限由代码自动设置，不从输入读取
                if($isProctor) {
                    // 监考生成：自动设置为admin权限
                    $nowTeam['privilege'] = 'admin';
                } else if($isReviewer) {
                    // 阅卷生成：自动设置为reviewer权限
                    $nowTeam['privilege'] = 'reviewer';
                } else {
                    // 考生生成：自动设置为null（普通账号）
                    $nowTeam['privilege'] = null;
                }
                if(!$validate->check($nowTeam)) {
                    $validateNotList .= "<br/>" . $nowTeam['team_id'] . ': ' . $validate->getError();
                }
                if(strlen($validateNotList) == 0) {
                    // 保存原始密码用于显示（在加密之前）
                    $originalPassword = $nowTeam['password'];
                    $teamToShow[] = array_merge($nowTeam, ['_original_password' => $originalPassword]);
                    
                    // 加密密码用于存储（系统密码不需要加密）
                    if($nowTeam['password'] != "[SYS_PASS]") {
                        $nowTeam['password'] =  MkPasswd($nowTeam['password'], True);
                    }
                    $teamToInsert[] = $nowTeam;
                }
            }
            if(strlen($validateNotList) > 0) {
                $addInfo = '<br/>Some accounts information is not valid. Please check.' . $validateNotList;
                $this->error('Account generation failed.' . $addInfo);
            }
            if(!db('cpc_team')->insertAll($teamToInsert, true)) {
                $this->error('Account generation failed. Please check the data input.');
            }
            
            // 恢复密码用于显示
            foreach($teamToShow as &$team) {
                if(isset($team['_original_password'])) {
                    // 使用保存的原始密码
                    $team['password'] = $team['_original_password'];
                    unset($team['_original_password']);
                } else if($team['password'] != "[SYS_PASS]") {
                    // 如果没有原始密码，尝试恢复（旧格式兼容）
                    $team['password'] = RecoverPasswd($team['password']);
                }
            }
            
            $this->success('Account successfully generated. <br/>See the table below', null, ['rows' => $teamToShow, 'type' => 'teamgen']);
        }
    }
    
    /**
     * 重载：账号列表（实验考试系统专用）
     */
    public function teamgen_list_ajax() {
        $ttype = input('ttype/d', 0);
        $account_gen_type = input('account_gen_type', 'student');
        
        // 构建查询条件
        $query = db('cpc_team')->where(['contest_id' => $this->contest['contest_id']]);
        
        // 根据类型筛选
        if($account_gen_type === 'reviewer') {
            // 阅卷账号：privilege 为 'reviewer'
            $query = $query->where('privilege', 'reviewer');
        } else if($account_gen_type === 'proctor') {
            // 监考账号：privilege 为 'admin'
            $query = $query->where('privilege', 'admin');
        } else {
            // 考生账号：privilege 为 null 或空字符串（兼容旧格式 ttype）
            if($ttype) {
                $query = $query->whereRaw('privilege is not null');
            } else {
                $query = $query->where(function($q){
                    $q->whereNull('privilege')->whereOr('privilege', '');
                });
            }
        }
        
        $teamList = $query->order('team_id', 'asc')->select();
        
        foreach($teamList as $key=>&$val) {
            if($val['password'] != "[SYS_PASS]") {
                $val['password'] = RecoverPasswd($val['password']);
            } else {
                $val['password'] = "[SYS_PASS]";
            }
        }
        return $teamList;
    }
    
    /**
     * 账号修改（调用 team_modify）
     */
    public function account_modify() {
        return $this->team_modify();
    }
    
    /**
     * 账号生成（默认跳转到考生生成）
     */
    public function account_gen() {
        // 保持向后兼容，默认跳转到考生生成
        return $this->account_gen_student();
    }
    
    /**
     * 考生生成页面
     */
    public function account_gen_student() {
        $this->assign('account_gen_type', 'student');
        $this->assign('account_gen_title', '考生生成');
        $this->assign('account_gen_title_en', 'Student Generator');
        $this->assign('account_gen_color', 'primary'); // 蓝色
        return $this->fetch('account_gen');
    }
    
    /**
     * 监考生成页面
     */
    public function account_gen_proctor() {
        $this->assign('account_gen_type', 'proctor');
        $this->assign('account_gen_title', '监考生成');
        $this->assign('account_gen_title_en', 'Proctor Generator');
        $this->assign('account_gen_color', 'warning'); // 橙色/黄色
        return $this->fetch('account_gen');
    }
    
    /**
     * IP 检查（调用 ipcheck）
     */
    public function account_ipcheck() {
        return $this->ipcheck();
    }
    
    /**
     * 阅卷账号管理页面
     */
    public function reviewer_manage() {
        $this->assign('account_gen_type', 'reviewer');
        $this->assign('account_gen_title', '阅卷账号生成');
        $this->assign('account_gen_title_en', 'Reviewer Generator');
        $this->assign('account_gen_color', 'info'); // 蓝色/信息色
        return $this->fetch('account_gen');
    }
    
    /**
     * 阅卷账号列表（已合并到 teamgen_list_ajax，保持向后兼容）
     */
    public function reviewer_list_ajax() {
        $teamList = db('cpc_team')->where(['contest_id'=> $this->contest['contest_id'], 'privilege' => 'reviewer'])->select();
        foreach($teamList as $key=>&$val) {
            $val['password'] = RecoverPasswd($val['password']);
        }
        return $teamList;
    }
    
}
