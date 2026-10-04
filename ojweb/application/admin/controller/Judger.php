<?php
/*
 * 评测机管理
 * 2025.10.26
 * CSGrandeur
*/
namespace app\admin\controller;
class Judger extends Adminbase{
    
    /**
     * 获取评测机配置（从 privilege.addition 读取）
     * @param string $user_id 评测机用户ID
     * @return array 配置数组
     */
    private function getJudgerConfig($user_id) {
        $defaultConfig = [
            'pro_list' => '',
            'flg_white' => 0,
            'similarity_check' => 0,
            'diff_enabled' => 0
        ];
        
        // 从 privilege.addition 读取配置
        $privilege = db('privilege')
            ->where(['user_id' => $user_id, 'pvrole' => 'judger'])
            ->field('addition')
            ->find();
        
        // 处理 null、空字符串、空数组等情况
        if ($privilege && isset($privilege['addition']) && $privilege['addition'] !== null && $privilege['addition'] !== '') {
            // 尝试解析 JSON
            $config = json_decode($privilege['addition'], true);
            
            // 检查 JSON 解析是否成功且结果是数组
            if (json_last_error() === JSON_ERROR_NONE && is_array($config)) {
                // 合并配置，确保所有默认字段都存在（向后兼容）
                return array_merge($defaultConfig, $config);
            }
            // 如果 JSON 解析失败或结果不是数组，记录错误但不影响功能（使用默认配置）
            if (config('app_debug')) {
                \think\facade\Log::warning("评测机 {$user_id} 的配置 JSON 解析失败: " . json_last_error_msg());
            }
        }
        
        // 返回默认配置（包括 addition 为 null、空、解析失败等情况）
        return $defaultConfig;
    }
    
    /**
     * 保存评测机配置（存储到 privilege.addition）
     * @param string $user_id 评测机用户ID
     * @param array $config 配置数组
     * @return bool 是否成功
     */
    private function saveJudgerConfig($user_id, $config) {
        // 确保配置包含所有必需字段
        $defaultConfig = [
            'pro_list' => '',
            'flg_white' => 0,
            'similarity_check' => 0,
            'diff_enabled' => 0
        ];
        $config = array_merge($defaultConfig, $config);
        
        // 存储到 privilege.addition
        $privilege = db('privilege')
            ->where(['user_id' => $user_id, 'pvrole' => 'judger'])
            ->find();
        
        if ($privilege) {
            return db('privilege')
                ->where(['user_id' => $user_id, 'pvrole' => 'judger'])
                ->update(['addition' => json_encode($config)]) !== false;
        } else {
            return db('privilege')->insert([
                'user_id' => $user_id,
                'pvrole' => 'judger',
                'addition' => json_encode($config)
            ]) !== false;
        }
    }
    
    /**
     * 验证密码格式
     * @param string $password 密码
     * @return array 返回验证结果
     */
    private function validatePassword($password) {
        if (empty($password)) {
            return ['valid' => true, 'message' => ''];
        }
        
        // 验证长度
        if (strlen($password) < 6 || strlen($password) > 30) {
            return ['valid' => false, 'message' => '密码长度必须在6-30位之间'];
        }
        
        // 验证字符类型（只允许数字和字母）
        if (!preg_match('/^[a-zA-Z0-9]+$/', $password)) {
            return ['valid' => false, 'message' => '密码只能包含数字和字母'];
        }
        
        return ['valid' => true, 'message' => ''];
    }
    
    /**
     * 处理密码（验证并哈希）
     * @param string $password 原始密码
     * @return array 返回处理结果
     */
    private function processPassword($password) {
        if (empty($password)) {
            return ['success' => true, 'hashed_password' => null, 'raw_password' => null];
        }
        
        // 验证密码格式
        $validation = $this->validatePassword($password);
        if (!$validation['valid']) {
            return ['success' => false, 'message' => $validation['message']];
        }
        
        // 哈希密码
        $hashedPassword = MkPasswd($password, true);
        
        return [
            'success' => true, 
            'hashed_password' => $hashedPassword, 
            'raw_password' => $password
        ];
    }
    
    public function index() {
        // 获取评测机配置
        $judgerConfig = GetJudgerConfig();
        
        // 获取编程语言配置
        $ojLanguage = config('CsgojConfig.OJ_LANGUAGE');
        
        // 传递配置到前端
        $this->assign('judgerConfig', $judgerConfig);
        $this->assign('ojLanguage', $ojLanguage);
        
        return $this->fetch();
    }
    public function update_judger_config_ajax() {
        // 检查权限
        if (!IsAdmin('administrator')) {
            $this->error('权限不足');
        }
        
        // 获取JSON字符串
        $jsonString = input('post.judger_config');
        
        if (empty($jsonString)) {
            $this->error('没有接收到配置数据');
        }
        
        // 解析JSON字符串
        $configData = json_decode($jsonString, true);
        
        if (json_last_error() !== JSON_ERROR_NONE) {
            $this->error('配置数据格式错误：' . json_last_error_msg());
        }
        
        if (!is_array($configData)) {
            $this->error('配置数据必须是对象格式');
        }
        
        // 调试信息
        error_log('Judger config JSON: ' . $jsonString);
        error_log('Judger config data: ' . json_encode($configData));
        
        // 调用保存配置函数
        $result = SetJudgerConfig($configData);
        
        if ($result['success']) {
            $this->success($result['message'], '', $result['data']);
        } else {
            $this->error($result['message']);
        }
    }
    
    public function get_default_config_ajax() {
        // 检查权限
        if (!IsAdmin('administrator')) {
            $this->error('权限不足');
        }
        
        // 获取默认配置
        $defaultConfig = GetJudgerConfig(true);
        $this->success('获取默认配置成功', '', $defaultConfig['config']);
    }
    
    public function judger_list_ajax() {
        // 检查权限
        if (!IsAdmin('administrator')) {
            $this->error('权限不足');
        }
        
        // 两表联查：privilege表 left join users表
        $list = db('privilege')
            ->alias('p')
            ->join('users u', 'p.user_id = u.user_id', 'left')
            ->field([
                    'u.user_id',
                    'u.defunct',
                    'u.language as langmask',
                    'u.accesstime',
                    'u.ip',
                    'u.password',
                    'p.addition'  // 从 privilege.addition 读取配置
                ])
            ->where('p.pvrole', 'judger')
            ->order('p.user_id', 'asc')
            ->select();
        
        foreach($list as &$judger) {
            $user_id = $judger['user_id'];
            
            // 从 privilege.addition 读取配置
            $config = $this->getJudgerConfig($user_id);
            
            // 设置配置项
            $judger['pro_list'] = $config['pro_list'] ?? '';
            $judger['flg_white'] = $config['flg_white'] ?? 0;
            $judger['similarity_check'] = $config['similarity_check'] ?? 0;
            $judger['diff_enabled'] = $config['diff_enabled'] ?? 0;
            
            // 将langmask转换为langlist
            $langMask = intval($judger['langmask']);
            $judger['langlist'] = LangMask2LangList($langMask, 'origin'); // 不转小写，保持原样
            
            // 解密密码（如果存在）
            if (!empty($judger['password'])) {
                $judger['password'] = RecoverPasswd($judger['password']);
            }
            
            // 设置删除权限（管理员可以删除评测机权限）
            $judger['can_delete'] = true;
        }
        
        return $list;
    }
    
    public function judger_add_ajax() {
        // 检查权限
        if (!IsAdmin('administrator')) {
            $this->error('权限不足');
        }
        
        $user_id = input('post.user_id');
        if (empty($user_id)) {
            $this->error('用户ID不能为空');
        }
        
        // 验证用户ID格式：至多2位字母前缀，后跟至多2位数字
        if (!preg_match('/^[a-z]{1,2}\d{1,2}$/', $user_id)) {
            $this->error('用户ID格式不正确，应为1-2位小写字母+1-2位数字');
        }
        
        // 验证用户ID长度
        if (strlen($user_id) > 4) {
            $this->error('用户ID长度不能超过4位');
        }
        
        // 检查评测机总数限制（最多99个）
        $judgerCount = db('privilege')
            ->where('pvrole', 'judger')
            ->count();
        
        if ($judgerCount >= 99) {
            $this->error('评测机总数已达到上限（99个），无法继续添加');
        }
        
        // 获取自定义密码
        $customPassword = input('post.custom_password', '');
        
        // 处理密码
        if (!empty($customPassword)) {
            $passwordResult = $this->processPassword($customPassword);
            if (!$passwordResult['success']) {
                $this->error($passwordResult['message']);
            }
            $rawPassword = $passwordResult['raw_password'];
            $hashedPassword = $passwordResult['hashed_password'];
        } else {
            // 生成随机密码
            $rawPassword = RandPass(8);
            $hashedPassword = MkPasswd($rawPassword, true); // 使用可还原密码
        }
        
        // 获取配置数据（如果有的话）
        $pro_list = input('post.pro_list', '');
        $flg_white = input('post.flg_white', 0);
        $defunct = input('post.defunct', 0);
        $language = input('post.language', 0);
        $similarity_check = input('post.similarity_check', 0);  // 获取查重开关配置
        $diff_enabled = input('post.diff_enabled', 0);  // 获取对拍开关配置
        
        // 准备评测机配置（存储到 privilege.addition）
        $judgerConfig = [
            'pro_list' => $pro_list,
            'flg_white' => intval($flg_white),
            'similarity_check' => intval($similarity_check),  // 使用传入的查重开关配置
            'diff_enabled' => intval($diff_enabled)  // 使用传入的对拍开关配置
        ];
        
        // 准备用户数据（只存储用户基本信息，配置存储在 privilege.addition）
        $userData = [
            'user_id'   => $user_id,
            'defunct'   => $defunct,   // 启用状态
            'ip'        => 'localhost',
            'language'  => $language,  // 语言掩码
            'password'  => $hashedPassword,
            'reg_time'  => date('Y-m-d H:i:s'),
            'nick'      => 'judger',
            'school'    => 'CSGOJ'  // 恢复为默认值
        ];
        
        // 插入用户数据（使用insert方法，如果主键存在则更新）
        $userResult = db('users')->insert($userData, true); // true表示replace模式
        
        if (!$userResult) {
            $this->error('用户数据插入失败');
        }
        
        // 检查是否已有judger权限
        $existingPrivilege = db('privilege')
            ->where(['user_id' => $user_id, 'pvrole' => 'judger'])
            ->find();
        
        if (!$existingPrivilege) {
            // 插入judger权限，同时存储配置
            $privilegeResult = db('privilege')->insert([
                'user_id' => $user_id,
                'pvrole' => 'judger',
                'addition' => json_encode($judgerConfig)
            ]);
            
            if (!$privilegeResult) {
                $this->error('权限数据插入失败');
            }
        } else {
            // 更新现有权限的配置
            db('privilege')
                ->where(['user_id' => $user_id, 'pvrole' => 'judger'])
                ->update(['addition' => json_encode($judgerConfig)]);
        }
        
        // 准备返回的用户数据（使用前端友好的字段名）
        $returnData = [
            'user_id' => $userData['user_id'],
            'pro_list' => $judgerConfig['pro_list'],
            'flg_white' => $judgerConfig['flg_white'],
            'defunct' => $userData['defunct'],
            'langlist' => LangMask2LangList($userData['language'], 'origin'), // 转换语言掩码为语言列表
            'accesstime' => null,
            'ip' => $userData['ip'],
            'password' => $rawPassword, // 明文密码用于返回
            'similarity_check' => $judgerConfig['similarity_check'], // 返回查重开关配置
            'diff_enabled' => $judgerConfig['diff_enabled'], // 返回对拍开关配置
            'can_delete' => true
        ];
        
        $this->success('评测机添加成功', null, $returnData);
      
    }
    
    public function judger_delete_ajax() {
        // 检查权限
        if (!IsAdmin('administrator')) {
            $this->error('权限不足');
        }
        
        $user_id = input('post.user_id');
        if (empty($user_id)) {
            $this->error('用户ID不能为空');
        }
        // 首先检查该用户是否确实有judger权限
        $judgerPrivilege = db('privilege')
            ->where(['user_id' => $user_id, 'pvrole' => 'judger'])
            ->find();
            
        if (!$judgerPrivilege) {
            $this->error('非评测机，无法删除');
        }
        
        // 删除评测机权限
        $result = db('privilege')
            ->where(['user_id' => $user_id, 'pvrole' => 'judger'])
            ->delete();
        
        if ($result) {
            $this->success('评测机权限删除成功');
        } else {
            $this->error('评测机权限删除失败');
        }
    }
    
    public function judger_config_ajax() {
        // 检查权限
        if (!IsAdmin('administrator')) {
            $this->error('权限不足');
        }
        
        $user_id = input('post.user_id');
        
        if (empty($user_id)) {
            $this->error('用户ID不能为空');
        }
        
        // 验证用户是否有judger权限
        $judgerPrivilege = db('privilege')
            ->where(['user_id' => $user_id, 'pvrole' => 'judger'])
            ->find();
            
        if (!$judgerPrivilege) {
            $this->error('非评测机，无法配置');
        }
        
        // 读取现有配置
        $judgerConfig = $this->getJudgerConfig($user_id);
        
        // 准备更新的用户数据（只更新用户表字段）
        $userUpdateData = [];
        
        // 准备更新的评测机配置（存储到 privilege.addition）
        $configUpdateData = [];
        
        // 检查并处理题目列表
        if (input('?post.pro_list')) {
            $pro_list = input('post.pro_list', '');
            
            // 验证题目列表格式
            if (!empty($pro_list)) {
                $proArray = explode(',', $pro_list);
                foreach ($proArray as $proId) {
                    $proId = trim($proId);
                    if (!empty($proId) && !preg_match('/^\d{4}$/', $proId)) {
                        $this->error('题目ID格式不正确，应为4位数字：' . $proId);
                    }
                }
            }
            $configUpdateData['pro_list'] = $pro_list;
        }
        
        // 检查并处理黑白名单标志
        if (input('?post.flg_white')) {
            $flg_white = input('post.flg_white');
            
            // 验证黑白名单标志
            if (!in_array($flg_white, [0, 1])) {
                $this->error('黑白名单标志值无效');
            }
            $configUpdateData['flg_white'] = intval($flg_white);
        }
        
        // 检查并处理启用状态标志
        if (input('?post.defunct')) {
            $defunct = input('post.defunct');
            
            // 验证启用状态标志
            if (!in_array($defunct, [0, 1])) {
                $this->error('启用状态标志值无效');
            }
            $userUpdateData['defunct'] = intval($defunct);
        }
        
        // 检查并处理语言掩码
        if (input('?post.language')) {
            $language = input('post.language');
            
            // 验证语言掩码
            if (!is_numeric($language) || $language < 0) {
                $this->error('语言掩码值无效');
            }
            $userUpdateData['language'] = intval($language);
        }
        
        // 检查并处理密码修改
        if (input('?post.password')) {
            $password = input('post.password', '');
            
            if (!empty($password)) {
                $passwordResult = $this->processPassword($password);
                if (!$passwordResult['success']) {
                    $this->error($passwordResult['message']);
                }
                $userUpdateData['password'] = $passwordResult['hashed_password'];
            }
        }
        
        // 检查并处理查重开关
        if (input('?post.similarity_check')) {
            $similarity_check = input('post.similarity_check');
            
            // 验证查重开关值
            if (!in_array($similarity_check, [0, 1])) {
                $this->error('查重开关值无效');
            }
            
            $configUpdateData['similarity_check'] = intval($similarity_check);
        }
        
        // 检查并处理对拍开关
        if (input('?post.diff_enabled')) {
            $diff_enabled = input('post.diff_enabled');
            
            // 验证对拍开关值
            if (!in_array($diff_enabled, [0, 1])) {
                $this->error('对拍开关值无效');
            }
            
            $configUpdateData['diff_enabled'] = intval($diff_enabled);
        }
        
        // 如果没有要更新的字段，返回成功
        if (empty($userUpdateData) && empty($configUpdateData)) {
            $this->success('没有需要更新的配置');
        }
        
        // 更新用户表数据
        if (!empty($userUpdateData)) {
            $userResult = db('users')
                ->where('user_id', $user_id)
                ->update($userUpdateData);
            
            if ($userResult === false) {
                $this->error('用户配置更新失败');
            }
        }
        
        // 更新评测机配置（privilege.addition）
        if (!empty($configUpdateData)) {
            // 合并现有配置和新配置
            $newConfig = array_merge($judgerConfig, $configUpdateData);
            $saveResult = $this->saveJudgerConfig($user_id, $newConfig);
            
            if (!$saveResult) {
                $this->error('评测机配置保存失败');
            }
        }
        
        $this->success('评测机配置保存成功');
    }
    
    /**
     * 切换评测机开关（专用接口）
     */
    public function toggle_switch_ajax() {
        // 检查权限
        if (!IsAdmin('administrator')) {
            $this->error('权限不足');
        }
        
        $user_id = input('post.user_id');
        $switch_type = input('post.switch_type');
        $switch_value = input('post.switch_value');
        
        if (empty($user_id)) {
            $this->error('用户ID不能为空');
        }
        
        if (empty($switch_type)) {
            $this->error('开关类型不能为空');
        }
        
        // 验证开关类型
        $validSwitchTypes = ['defunct', 'similarity_check', 'diff_enabled'];
        if (!in_array($switch_type, $validSwitchTypes)) {
            $this->error('无效的开关类型');
        }
        
        // 验证开关值
        if (!in_array($switch_value, [0, 1])) {
            $this->error('开关值无效，必须为0或1');
        }
        
        // 验证用户是否有judger权限
        $judgerPrivilege = db('privilege')
            ->where(['user_id' => $user_id, 'pvrole' => 'judger'])
            ->find();
            
        if (!$judgerPrivilege) {
            $this->error('非评测机，无法操作');
        }
        
        // 根据开关类型更新相应的字段
        if ($switch_type === 'defunct') {
            // 更新用户表的 defunct 字段
            $result = db('users')
                ->where('user_id', $user_id)
                ->update(['defunct' => intval($switch_value)]);
            
            if ($result !== false) {
                $statusText = $switch_value == 0 ? '启用' : '停用';
                $this->success("评测机 {$user_id} 已{$statusText}");
            } else {
                $this->error('开关更新失败');
            }
        } else if ($switch_type === 'similarity_check') {
            // 更新 privilege.addition 中的 similarity_check
            $judgerConfig = $this->getJudgerConfig($user_id);
            $judgerConfig['similarity_check'] = intval($switch_value);
            $result = $this->saveJudgerConfig($user_id, $judgerConfig);
            
            if ($result) {
                $statusText = $switch_value == 1 ? '开启查重' : '关闭查重';
                $this->success("评测机 {$user_id} 已{$statusText}");
            } else {
                $this->error('开关更新失败');
            }
        } else if ($switch_type === 'diff_enabled') {
            // 更新 privilege.addition 中的 diff_enabled
            $judgerConfig = $this->getJudgerConfig($user_id);
            $judgerConfig['diff_enabled'] = intval($switch_value);
            $result = $this->saveJudgerConfig($user_id, $judgerConfig);
            
            if ($result) {
                $statusText = $switch_value == 1 ? '开启对拍' : '关闭对拍';
                $this->success("评测机 {$user_id} 已{$statusText}");
            } else {
                $this->error('开关更新失败');
            }
        }
    }
    
    public function judger_login_log_ajax() {
        // 检查权限
        if (!IsAdmin('administrator')) {
            $this->error('权限不足');
        }
        
        $user_id = input('get.user_id');
        
        if (empty($user_id)) {
            $this->error('用户ID不能为空');
        }
        
        // 验证用户是否有judger权限
        $judgerPrivilege = db('privilege')
            ->where(['user_id' => $user_id, 'pvrole' => 'judger'])
            ->find();
            
        if (!$judgerPrivilege) {
            $this->error('非评测机，无法查看登录日志');
        }
        
        // 查询最近20次登录日志
        $logList = db('loginlog')
            ->where('user_id', $user_id)
            ->field(['success', 'ip', 'time'])
            ->order('time', 'desc')
            ->limit(20)
            ->select();
        
        // 格式化时间显示
        foreach ($logList as &$log) {
            if ($log['time']) {
                $log['time'] = date('Y-m-d H:i:s', strtotime($log['time']));
            }
        }
        
        $this->success('获取登录日志成功', '', $logList);
    }
    
    public function del_judger_pro_ajax() {
        // 检查权限
        if (!IsAdmin('administrator')) {
            $this->error('权限不足');
        }
        
        $user_id = input('post.user_id');
        $problem_id = input('post.problem_id');
        
        if (empty($user_id)) {
            $this->error('用户ID不能为空');
        }
        
        if (empty($problem_id)) {
            $this->error('题号不能为空');
        }
        
        // 验证题号格式（4位数字）
        if (!preg_match('/^\d{4}$/', $problem_id)) {
            $this->error('题号格式不正确，应为4位数字');
        }
        
        // 验证评测机权限
        $this->validateJudger($user_id);
        
        // 获取题目列表
        $judgerConfig = $this->getJudgerConfig($user_id);
        $currentProList = $judgerConfig['pro_list'] ?? '';
        
        if (empty($currentProList)) {
            $this->error('该评测机没有题目限制');
        }
        
        // 解析题目列表
        $problemList = $this->parseProblemList($currentProList);
        
        // 检查题号是否存在
        if (!in_array($problem_id, $problemList)) {
            $this->error('题目列表中不存在该题号');
        }
        
        // 从列表中移除指定题号
        $problemList = array_values(array_filter($problemList, function($id) use ($problem_id) {
            return $id !== $problem_id;
        }));
        
        // 更新题目列表
        $newProList = implode(',', $problemList);
        
        // 更新到 privilege.addition
        $judgerConfig = $this->getJudgerConfig($user_id);
        $judgerConfig['pro_list'] = $newProList;
        $result = $this->saveJudgerConfig($user_id, $judgerConfig);
        
        if ($result !== false) {
            $data = [
                'user_id' => $user_id,
                'problem_id' => $problem_id,
                'remaining_problems' => $problemList,
                'remaining_count' => count($problemList)
            ];
            $this->success('题目删除成功', '', $data);
        } else {
            $this->error('题目删除失败');
        }
    }
    
    /**
     * 获取评测机题目列表
     */
    public function get_judger_pro_list_ajax() {
        // 检查权限
        if (!IsAdmin('administrator')) {
            $this->error('权限不足');
        }
        
        $user_id = input('post.user_id');
        
        if (empty($user_id)) {
            $this->error('用户ID不能为空');
        }
        
        // 验证评测机权限
        $this->validateJudger($user_id);
        
        // 获取题目列表
        $judgerConfig = $this->getJudgerConfig($user_id);
        $proList = $judgerConfig['pro_list'] ?? '';
        
        if (empty($proList)) {
            $data = [
                'user_id' => $user_id,
                'pro_list' => [],
                'problem_titles' => [],
                'count' => 0
            ];
        } else {
            // 解析题目列表
            $problemList = $this->parseProblemList($proList);
            
            // 查询题目标题
            $problemTitles = $this->getProblemTitles($problemList);
            
            $data = [
                'user_id' => $user_id,
                'pro_list' => $problemList,
                'problem_titles' => $problemTitles,
                'count' => count($problemList)
            ];
        }
        
        $this->success('获取题目列表成功', '', $data);
    }
    
    /**
     * 验证评测机权限
     */
    private function validateJudger($user_id) {
        // 验证用户是否有judger权限
        $judgerPrivilege = db('privilege')
            ->where(['user_id' => $user_id, 'pvrole' => 'judger'])
            ->find();
            
        if (!$judgerPrivilege) {
            $this->error('非评测机，无法操作');
        }
        
        // 验证用户是否存在
        $user = db('users')
            ->where('user_id', $user_id)
            ->find();
            
        if (!$user) {
            $this->error('评测机不存在');
        }
        
        return true;
    }
    
    /**
     * 解析题目列表字符串为数组
     */
    private function parseProblemList($proListStr) {
        $problemList = array_map('trim', explode(',', $proListStr));
        return array_filter($problemList); // 移除空值
    }
    
    /**
     * 获取题目标题
     */
    private function getProblemTitles($problemList) {
        $problemTitles = [];
        if (!empty($problemList)) {
            $validProblemIds = array_filter($problemList, function($id) {
                return preg_match('/^\d{4}$/', $id);
            });
            
            if (!empty($validProblemIds)) {
                $titles = db('problem')
                    ->where('problem_id', 'in', $validProblemIds)
                    ->field(['problem_id', 'title'])
                    ->select();
                
                foreach ($titles as $title) {
                    $problemTitles[$title['problem_id']] = $title['title'];
                }
            }
        }
        return $problemTitles;
    }
}