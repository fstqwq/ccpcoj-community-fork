<?php
/**
 * CSGOJ 评测机接口
 * CSGrandeur @ 2025-10-28
 */

namespace app\ojtool\controller;

class Judge2 extends Ojtoolbase
{
    var $judge_user;
    var $auto_rejudge_sec = 900;
    
    public function initialize(){
        $this->OJMode();
        $this->JudgeInit();
    }
    protected function AuthFail() {
        // judger 独立鉴权，不使用全局方案，确保评测权限控制的及时性
        if(IsAdmin('super_admin')) {
            return 0;    // 超管允许访问judge接口
        }
        if(!$this->IsLogin()) {
            return '未登录 / Need Login';
        }
        $user_id = $this->GetLoginJudger();
        $judger_privilege = db('privilege')->where(['user_id' => $user_id, 'pvrole' => 'judger'])->cache(30)->find();
        if(!$judger_privilege) {
            return '无权限 / No Permission';
        }
        $judger_defunct = db('users')->where('user_id', $user_id)->field(['user_id', 'defunct'])->cache(30)->find();
        if($judger_defunct['defunct'] == 1) {
            return '已停用 / Disabled';
        }
        return 0;
    }
    public function index() {
        return $this->response(true, "OK", null, 'OK');
    }
    protected function JudgeInit(){
        if($this->action == 'judge_login') {
            return;
        }
        // 同步Judge.php的鉴权逻辑
        $auth_fail_msg = $this->AuthFail();
        if($auth_fail_msg) {
            return $this->response(false, $auth_fail_msg, null, 'AUTH_FAILED');
        }
        $this->judge_user = $this->GetLoginJudger();
    }
    
    /**
     * 获取JSON请求体数据
     * ThinkPHP5.0最佳实践：使用input()方法自动解析JSON请求体
     * 支持调试工具发送的json_data参数
     */
    private function getJsonData()
    {
        // 优先检查调试工具发送的json_data参数
        $jsonData = $this->request->param('json_data');
        if (!empty($jsonData)) {
            $data = json_decode($jsonData, true);
            if ($data !== null) {
                // 调试信息（仅在开发环境）
                if (config('app_debug')) {
                    \think\facade\Log::info('调试工具JSON数据: ' . $jsonData);
                }
                return $data;
            }
        }
        
        // 检查Content-Type是否为application/json
        $contentType = $this->request->header('content-type');
        if (strpos($contentType, 'application/json') === false) {
            // 如果不是JSON请求，返回空数组
            return [];
        }
        
        // 直接读取原始请求体并解析JSON
        $rawData = $this->request->getContent();
        $data = json_decode($rawData, true);
        
        // 如果JSON解析失败，尝试使用ThinkPHP的input方法
        if ($data === null) {
            $data = input('param.');
        }
        
        // 调试信息（仅在开发环境）
        if (config('app_debug')) {
            \think\facade\Log::info('JSON请求数据: ' . json_encode($data));
            \think\facade\Log::info('原始请求体: ' . $rawData);
        }
        
        return $data ?: [];
    }
    
    /**
     * 语言编号转评测机支持的名称
     */
    private function getLanguageName($language_id){
        $lang_map = config('CsgojConfig.OJ_LANGUAGE_NORMALIZED');
        return $lang_map[$language_id] ?? 'unknown';
    }
    
    /**
     * 评测结果名称转编号
     */
    private function getResultId($result_name){
        $results = config('CsgojConfig.OJ_RESULTS');
        $result_map = array_flip($results);
        return $result_map[$result_name] ?? 90;  // 默认返回JF (90) - 评测失败
    }
    
    
    /**
     * 评测机登录接口
     */
    public function judge_login(){
        if($this->IsLogin()) {
            return $this->response(true, "已登录", ['user_id' => $this->GetLoginJudger()]);
        }
        
        // 从JSON请求体获取参数
        $data = $this->getJsonData();
        $user_id = trim($data['user_id'] ?? '');
        $password = trim($data['password'] ?? '');
        
        if (empty($user_id)) {
            return $this->response(false, "用户名不能为空", null, 'INVALID_PARAMS');
        }
        
        // 检查用户是否存在
        $userinfo = db('users')->where('user_id', $user_id)->find();
        if (!$userinfo) {
            return $this->response(false, "用户不存在", null, 'USER_NOT_FOUND');
        }
        
        // 验证密码
        // Bootstrap accounts use password_hash; older judge accounts use recoverable encryption.
        $password_info = password_get_info($userinfo['password']);
        $password_ok = !empty($password_info['algo'])
            ? password_verify($password, $userinfo['password'])
            : CkPasswd($password, $userinfo['password'], True);
        if (!$password_ok) {
            AddLoginlog($user_id, 0);
            return $this->response(false, "密码错误", null, 'PASSWORD_ERROR');
        }
        
        // 执行登录操作（同步Judge.php的LoginOper方法）
        $this->LoginOper($userinfo);
        AddLoginlog($user_id, 1);
        
        return $this->response(true, "登录成功", ['user_id' => $user_id]);
    }
    
    protected function IsLogin() {
        return session('?judger_user_id');
    }
    protected function GetLoginJudger() {
        return session('judger_user_id');
    }
    /**
     * 登录操作（同步Judge.php的LoginOper方法）
     */
    protected function LoginOper($userinfo){
        // 设置登录后的session
        session('judger_user_id', $userinfo['user_id']);
        // 简化登录，权限将实时检测
    }
    
    /**
     * 获取评测机配置（从 privilege.addition 读取）
     * @param string $user_id 评测机用户ID
     * @return array 配置数组
     */
    private function getJudgerConfig($user_id) {
        $defaultConfig = [
            'pro_list' => '',
            'flg_white' => 0,
            'similarity_check' => 0
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
     * 获取待评测任务
     */
    public function getpending() {
        try {
        $max_tasks = input('max_tasks/d', 1);
        $flg_checkout = input('flg_checkout/d', 1);  // 默认值为1，表示需要checkout，即获取的pending会变更为编译中，不再被其它评测机获取

        $max_tasks = min(5, $max_tasks); // 至多一次check 5 个
        $OJ_LANGUAGE = config('CsgojConfig.OJ_LANGUAGE');
        $OJ_LANGUAGE_ID_LIST = array_keys($OJ_LANGUAGE);

        $judger_id = $this->GetLoginJudger();
        if (!$judger_id) {
            return $this->response(false, "评测机未登录", null, 'INTERNAL_ERROR');
        }
        
        // **********
        // 评测机特殊限制
        // 获取用户基本信息
        $judger = db('users')->where('user_id', $judger_id)->field([
            'defunct',
            'language as langmask',
            'accesstime',
            'ip'
        ])->cache('getpending_' . $judger_id, 10)->find();
        
        if (!$judger) {
            \think\facade\Log::error("getpending: 评测机 {$judger_id} 不存在");
            return $this->response(false, "评测机不存在", null, 'INTERNAL_ERROR');
        }
        
        // 获取评测机配置（从 privilege.addition 读取）
        $judgerConfig = $this->getJudgerConfig($judger_id);
        
        // 刷新accesstime
        db('users')->where('user_id', $judger_id)->update(['accesstime' => date('Y-m-d H:i:s')]);
        
        // **********
        // 查询
        // 修复 whereTime 用法：在 ThinkPHP 5.1 中，whereTime 用于日期表达式，这里应该使用 where 配合时间戳
        $rejudge_time = date('Y-m-d H:i:s', time() - $this->auto_rejudge_sec);
        
        // 构建查询：待评测任务 = (result < 2) OR (result < 4 AND judgetime < rejudge_time)
        // ThinkPHP 5.1 语法：使用 whereOr 连接 OR 条件
        $query = db('solution')
            ->where(function ($subQuery) use ($rejudge_time) {
                // 条件1：待评测或编译中 (result < 2)
                $subQuery->where('result', '<', 2)
                         // 条件2：超过 auto_rejudge_sec 秒未判完的题目 (result < 4 AND judgetime < rejudge_time)
                         ->whereOr(function ($orQuery) use ($rejudge_time) {
                             $orQuery->where('result', '<', 4)
                                     ->where('judgetime', '<', $rejudge_time);
                         });
            });
        
        // 应用评测机限制条件（使用链式调用，避免数组格式问题）
        if (!empty($judgerConfig['pro_list'])) {
            $pro_list = explode(',', $judgerConfig['pro_list']);
            // 过滤空字符串
            $pro_list = array_filter($pro_list, function($v) { return $v !== ''; });
            if (!empty($pro_list)) {
                if ($judgerConfig['flg_white'] == 0) {
                    $query->where('problem_id', 'in', $pro_list);
                } else {
                    $query->where('problem_id', 'not in', $pro_list);
                }
            }
        }
        
        if(isset($judger['langmask']) && $judger['langmask']) {
            $lang_list = LangMask2LangList($judger['langmask'], 'id');
            $intersect_lang = array_intersect($OJ_LANGUAGE_ID_LIST, $lang_list);
            if (!empty($intersect_lang)) {
                $query->where('language', 'in', $intersect_lang);
            } else {
                // 如果交集为空，返回空任务列表
                return $this->response(true, "没有匹配的语言", []);
            }
        } else {
            $query->where('language', 'in', $OJ_LANGUAGE_ID_LIST);
        }

        // 归档比赛：不向评测机派发该赛提交（子查询，避免逐行 JOIN）
        $query->where(function ($q) {
            $q->whereNull('contest_id')
                ->whereOr('contest_id', 0)
                ->whereOr(function ($q2) {
                    $q2->where('contest_id', '>', 0)
                        ->whereRaw(
                            'NOT EXISTS (SELECT 1 FROM `contest` `c` WHERE `c`.`contest_id` = `solution`.`contest_id` '
                            . 'AND IFNULL(`c`.`flg_archive`,0) <> 0)'
                        );
                });
        });
        
        $solutions = $query
            ->order(['result' => 'asc', 'solution_id' => 'asc'])
            ->limit($max_tasks)
            ->select();
        
        $tasks = [];

        foreach ($solutions as $solution) {
            // 根据flg_checkout参数决定是否更新状态为编译中
            if ($flg_checkout) {
                // 参考Judge.php的checkout逻辑：更新状态为编译中
                db('solution')->where('solution_id', $solution['solution_id'])->update([
                    'result'    => 2,  // 编译中
                    'time'      => 0,
                    'memory'    => 0,
                    'judgetime' => date('Y-m-d H:i:s'),
                    'judger'    => $this->GetLoginJudger()
                ]);
            }
            
            $tasks[] = [
                'solution_id'   => $solution['solution_id'],
                'problem_id'    => $solution['problem_id'],
                'user_id'       => $solution['user_id'],
                'language'      => $this->getLanguageName($solution['language']),  // 返回语言名称
                'contest_id'    => $solution['contest_id']
            ];
        }
        
        return $this->response(true, $flg_checkout ? "checkout" : 'get', $tasks);
            
        } catch (\Exception $e) {
            $msg = "getpending 异常: " . $e->getMessage() . "\n" . $e->getTraceAsString();
            \think\facade\Log::error($msg);
            return $this->response(false, $msg, null, 'INTERNAL_ERROR');
        }
    }
    
    /**
     * 获取 solution 的信息
     */
    public function getsolutioninfo(){
        $solution_id = input('sid/d');
        $flg_with_result = input('flg_with_result/d', 0);  // 默认值为0，表示不返回 result，只有调试时候才用得上
        
        if ($solution_id <= 0) {
            return $this->response(false, " solution ID无效");
        }
        
        $solution = db('solution')->where('solution_id', $solution_id)->find();
        if (!$solution) {
            return $this->response(false, " solution 不存在");
        }
        
        // 读取评测机配置（只需实际配置数据）
        // 返回格式示例：
        // {
        //   code: 1,
        //   data: {
        //     solution_id: 1001,
        //     problem_id: 1000,
        //     user_id: "tester",
        //     language: "cpp",
        //     contest_id: 0,
        //     // 评测机参数（供评测端使用）：
        //     judge_common: { max_time_limit: 10000, max_memory_limit: 2048, stack_limit_mb: 1024, max_output_limit: 256, ... },
        //     judge_lang_cfg:   { cpp_std: "-std=c++17", cpp_opt: "-O2" }  // 与 language 对应分组
        //   }
        // }
        $judgeConfigPack = GetJudgerConfig(false);
        $judgeConfig = $judgeConfigPack['config'];
        
        // 确保 common 配置存在，如果不存在则使用默认值（向后兼容）
        if (!isset($judgeConfig['common']) || !is_array($judgeConfig['common'])) {
            // 获取默认配置作为后备
            $defaultConfigPack = GetJudgerConfig(true);
            $defaultConfig = $defaultConfigPack['config'];
            $judgeCommon = $defaultConfig['common'] ?? [
                'flg_stop_when_not_ac' => true,
                'flg_use_max_time' => true,
                'max_time_limit' => 10000,
                'max_memory_limit' => 2048,
                'stack_limit_mb' => 1024,
                'max_output_limit' => 256
            ];
        } else {
            $judgeCommon = $judgeConfig['common'];
        }
        
        // 将语言ID映射为配置分组键名
        $langName = $this->getLanguageName($solution['language']);
        $langKey = strtolower($langName);
        if ($langKey === 'c++') $langKey = 'cpp';
        if ($langKey === 'golang') $langKey = 'go';
        
        // 确保语言配置存在，如果不存在则尝试使用默认值或降级处理（向后兼容）
        if (!isset($judgeConfig[$langKey]) || !is_array($judgeConfig[$langKey])) {
            // 获取默认配置作为后备
            $defaultConfigPack = GetJudgerConfig(true);
            $defaultConfig = $defaultConfigPack['config'];
            
            // 尝试从默认配置中获取
            if (isset($defaultConfig[$langKey]) && is_array($defaultConfig[$langKey])) {
                $langCfg = $defaultConfig[$langKey];
            } else {
                // 如果默认配置中也没有，尝试使用 cpp 配置作为降级方案
                if (isset($judgeConfig['cpp']) && is_array($judgeConfig['cpp'])) {
                    $langCfg = $judgeConfig['cpp'];
                } elseif (isset($defaultConfig['cpp']) && is_array($defaultConfig['cpp'])) {
                    $langCfg = $defaultConfig['cpp'];
                } else {
                    // 最后的降级方案：返回错误，但提供更详细的错误信息
                    return $this->response(false, "评测语言配置不存在或无效: {$langKey} (语言: {$langName})，且无法找到降级配置");
                }
            }
        } else {
            $langCfg = $judgeConfig[$langKey];
        }
        
        // 获取评测机的查重开关和对拍开关配置（从 privilege.addition 读取）
        $judger_id = $this->GetLoginJudger();
        $similarity_check_enabled = 0;  // 默认关闭
        $diff_enabled = 0;  // 默认关闭
        if ($judger_id) {
            $judgerConfig = $this->getJudgerConfig($judger_id);
            $similarity_check_enabled = $judgerConfig['similarity_check'] ?? 0;
            $diff_enabled = $judgerConfig['diff_enabled'] ?? 0;
        }
        
        // 将对拍开关合并到 judge_common 配置中
        $judgeCommon['flg_diff_enabled'] = $diff_enabled == 1;
        
        $solution_info = [
            'solution_id' => $solution['solution_id'],
            'problem_id' => $solution['problem_id'],
            'user_id' => $solution['user_id'],
            'language' => $this->getLanguageName($solution['language']),  // 返回语言名称
            'contest_id' => $solution['contest_id'],
            'judge_common' => $judgeCommon,
            'judge_lang_cfg' => $langCfg,
            'similarity_check_enabled' => $similarity_check_enabled  // 查重开关
        ];
        if($flg_with_result) {
            $solution_info['result'] = $solution['result'];
        }
        
        return $this->response(true, "获取 solution 信息成功", $solution_info);
    }
    
    /**
     * 获取 solution 代码
     */
    public function getsolution()
    {
        $solution_id = input('sid/d');
        
        if ($solution_id <= 0) {
            return $this->response(false, " solution ID无效");
        }
        
        $solution = db('solution')->where('solution_id', $solution_id)->find();
        if (!$solution) {
            return $this->response(false, " solution 不存在");
        }
        
        // 获取源代码
        $source = db('source_code')->where('solution_id', $solution_id)->find();
        if (!$source) {
            return $this->response(false, "源代码不存在");
        }
        
        return $this->response(true, "获取源代码成功", $source['source']);
    }
    
    /**
     * 获取问题信息
     */
    public function getprobleminfo()
    {
        $problem_id = input('pid/d');
        
        if ($problem_id <= 0) {
            return $this->response(false, "问题ID无效");
        }
        
        $problem = db('problem')->where('problem_id', $problem_id)->find();
        if (!$problem) {
            return $this->response(false, "问题不存在");
        }
        
        $problem_info = [
            'time_limit' => $problem['time_limit'],
            'memory_limit' => $problem['memory_limit'],
            'spj' => $problem['spj']
        ];
        
        return $this->response(true, "获取问题信息成功", $problem_info);
    }
    
    /**
     * 获取评测数据
     */
    public function getdata(){
        $problem_id = input('problem_id/d');
        
        if ($problem_id <= 0) {
            return $this->response(false, "问题ID无效");
        }
        
        // 参考Judge.php的配置获取方式
        $path_judge_data = config('OjPath.testdata') . DIRECTORY_SEPARATOR . $problem_id;
        if (!is_dir($path_judge_data)) {
            return $this->response(false, "评测数据目录不存在");
        }
        
        // 创建临时压缩文件
        $temp_file = tempnam(sys_get_temp_dir(), 'judge_data_');
        $tar_file = $temp_file . '.tar.gz';
        
        // 使用tar指令直接筛选文件：只打包 .in、.out、tpj.cc 三种文件
        // 使用 ExecuteCommand (proc_open) 替代 exec，因为 exec 可能被禁用
        $command = "cd " . escapeshellarg(dirname($path_judge_data)) . " && tar -czf " . escapeshellarg($tar_file) . " --include='*.in' --include='*.out' --include='tpj.cc' " . escapeshellarg(basename($path_judge_data));
        $output = [];
        $return_code = 0;
        if (!ExecuteCommand($command, null, $output, $return_code)) {
            return $this->response(false, "打包评测数据失败: " . implode("\n", $output));
        }
        
        // 检查是否生成了有效文件
        if (!file_exists($tar_file) || filesize($tar_file) === 0) {
            return $this->response(false, "没有找到符合条件的评测数据文件");
        }
        
        // 输出压缩文件
        header('Content-Type: application/gzip');
        header('Content-Disposition: attachment; filename="data.tar.gz"');
        readfile($tar_file);
        
        // 清理临时文件
        unlink($tar_file);
        unlink($temp_file);
    }
    
    /**
     * 更新任务状态
     */
    public function updatesolution()
    {
        // 从JSON请求体获取参数
        $data = $this->getJsonData();
        $solution_id = $data['solution_id'] ?? 0;
        $task_status = $data['task_status'] ?? '';
        $judge_result_data = $data['judge_result_data'] ?? [];
        
        if ($solution_id <= 0 || empty($task_status)) {
            return $this->response(false, "参数无效");
        }
        
        // 参考Judge.php的字段名称和逻辑
        $update_data = [
            'judger' => $this->judge_user        // 评测机用户名
        ];
        
        // 支持结果名称和编号两种方式
        $result_code = null;
        if (isset($judge_result_data['judge_result'])) {
            if (is_numeric($judge_result_data['judge_result'])) {
                // 如果是数字，直接使用
                $result_code = intval($judge_result_data['judge_result']);
            } else {
                // 如果是字符串，转换为编号
                $result_code = $this->getResultId($judge_result_data['judge_result']);
            }
        }
        
        // 根据评测机执行状态设置结果（基于新版评测机逻辑）
        switch ($task_status) {
            case 'running':
                // 评测机正在运行
                // 如果传入的 judge_result 是 SC（查重中），则使用 SC；否则使用 RJ（正在评测）
                if ($result_code !== null && $result_code == -10) {
                    // SC - Similarity Check（查重中）
                    $update_data['result'] = -10;
                } else {
                    // RJ - Running&Judging（正在评测）
                    $update_data['result'] = 3;
                }
                // 如果有时间、内存信息，也更新（查重时可能需要显示评测时间和内存）
                if (isset($judge_result_data['time'])) {
                    $update_data['time'] = intval($judge_result_data['time']);
                }
                if (isset($judge_result_data['memory'])) {
                    $update_data['memory'] = intval($judge_result_data['memory']);
                }
                break;
            case 'completed':
                // 评测机任务完成，使用传入的评测结果
                $update_data['result'] = $result_code ?? 90;  // 使用传入的结果或默认JF（评测失败）
                $update_data['time'] = intval($judge_result_data['time'] ?? 0);
                $update_data['memory'] = intval($judge_result_data['memory'] ?? 0);
                // 处理通过率
                $this->processPassRate($update_data, $judge_result_data);
                break;
            case 'error':
                // 评测机执行出错，检查是否是评测机问题
                $result_name = $judge_result_data['judge_result'] ?? '';
                if (in_array($result_name, ['AC', 'WA', 'TLE', 'MLE', 'RE', 'CE', 'PE', 'OLE'])) {
                    // 这是正常的评测结果，使用传入的结果
                    $update_data['result'] = $result_code ?? 90;  // 使用传入的结果或默认JF（评测失败）
                    $update_data['time'] = intval($judge_result_data['time'] ?? 0);
                    $update_data['memory'] = intval($judge_result_data['memory'] ?? 0);
                    // 处理通过率
                    $this->processPassRate($update_data, $judge_result_data);
                } else {
                    // 这是评测机问题，设为评测失败
                    $update_data['result'] = 90;  // JF - Judge Failed
                }
                break;
            default:
                // 未知状态，设为评测失败
                $update_data['result'] = 90;  // JF - Judge Failed
                break;
        }
        
        $updated = db('solution')->where('solution_id', $solution_id)->update($update_data);
        $result_code = $result_code ?? 90;
        if($result_code >= 4) {
            // 更新评测结果时清理旧的 ce/re info
            db('compileinfo')->where('solution_id', $solution_id)->delete();
            db('runtimeinfo')->where('solution_id', $solution_id)->delete();
        }
        
        return $this->response(true, $updated ? "任务状态更新成功" : "任务状态没有变化", $update_data);
        
    }
    
    /**
     * 添加编译错误信息
     */
    public function addceinfo()
    {
        return $this->addErrorInfo('ceinfo', 'compileinfo', '编译错误信息');
    }
    
    /**
     * 添加运行时错误信息
     */
    public function addreinfo()
    {
        return $this->addErrorInfo('reinfo', 'runtimeinfo', '运行时错误信息');
    }
    
    /**
     * 处理通过率字段
     * 将评测机传来的 pass_ratio (0.0-1.0) 转换为数据库的 pass_rate (decimal(3,2))
     * 
     * @param array &$update_data 更新数据引用
     * @param array $judge_result_data 评测结果数据
     */
    protected function processPassRate(&$update_data, $judge_result_data)
    {
        if (isset($judge_result_data['pass_ratio'])) {
            $pass_ratio = floatval($judge_result_data['pass_ratio']);
            // 确保范围在 0.00 到 1.00 之间（数据库是 decimal(3,2) UNSIGNED）
            $pass_ratio = max(0.0, min(1.0, $pass_ratio));
            $update_data['pass_rate'] = round($pass_ratio, 2);
        }
    }
    
    /**
     * 通用错误信息添加方法
     * 
     * @param string $data_key JSON数据中的键名
     * @param string $table_name 数据库表名
     * @param string $error_type_name 错误类型名称（用于日志）
     * @return array 响应结果
     */
    private function addErrorInfo($data_key, $table_name, $error_type_name)
    {
        // 从JSON请求体获取参数
        $data = $this->getJsonData();
        $solution_id = $data['sid'] ?? 0;
        $error_data = $data[$data_key] ?? [];
        
        if ($solution_id <= 0) {
            return $this->response(false, " solution ID无效");
        }
        
        // 处理结构化错误信息
        $error_text = $this->processStructuredErrorInfo($error_data);
        
        // 数据库操作：查找现有记录
        $item = db($table_name)->where('solution_id', $solution_id)->find();
        if($item == null) {
            // 插入新记录
            $inserted = db($table_name)->insert(['solution_id' => $solution_id, 'error' => $error_text]);
        } else {
            // 更新现有记录
            $item['error'] = $error_text;
            $inserted = db($table_name)->update($item);
        }
        
        if ($inserted !== false) {
            return $this->response(true, "{$error_type_name}添加成功");
        } else {
            return $this->response(false, "{$error_type_name}添加失败");
        }
    }
    
    /**
     * 处理结构化错误信息
     * 将结构化的错误信息转换为JSON字符串存储到数据库
     */
    private function processStructuredErrorInfo($error_data)
    {
        // 直接转换为格式化的JSON字符串
        return json_encode($error_data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
    }
        
    /**
     * 更新问题统计信息
     */
    public function updateproblem()
    {
        // 从JSON请求体获取参数
        $data = $this->getJsonData();
        $problem_id = $data['problem_id'] ?? 0;
        
        if ($problem_id <= 0) {
            return $this->response(false, "问题ID无效");
        }
        
        // 重新计算问题统计信息
        $this->recalculateProblemStats($problem_id);
        
        return $this->response(true, "问题统计信息更新成功", ['problem_id' => $problem_id]);
    }
    
    /**
     * rejudge 统计信息
     */
    private function recalculateProblemStats($problem_id)
    {
        // 参考Judge.php的实现，区分contest和非contest状态
        $cid = input('cid/d');
        if($cid != null && $cid > 0) {
            // contest题目不需要更新统计
            return true;
        }
        
        $accepted = db('solution')->where('problem_id', $problem_id)->where('result', 4)
            ->where(function ($subQuery) {
                $subQuery->whereNull('contest_id')
                         ->whereOr('contest_id', 0);
            })->count();
        $submit = db('solution')->where('problem_id', $problem_id)
            ->where(function ($subQuery) {
                $subQuery->whereNull('contest_id')
                         ->whereOr('contest_id', 0);
            })
            ->count();
        
        $ret = db('problem')->where('problem_id', $problem_id)->update(['accepted' => $accepted, 'submit' => $submit]);
        return $ret;
    }
        
    // **************************************************
    // 全量数据同步相关接口
    /**
     * 获取问题列表
     */
    public function getproblemlist()
    {
        // 获取所有问题ID
        $problem_ids = db('problem')->column('problem_id');
        // $problem_ids = array_column($problems, 'problem_id');
        
        return $this->response(true, "获取问题列表成功", $problem_ids);
    }
    
    /**
     * 获取所有问题的数据信息
     */
    public function getallproblemsinfo()
    {
        // 从JSON请求体获取参数
        $data = $this->getJsonData();
        $problem_ids = $data['problem_ids'] ?? [];
        
        if (empty($problem_ids)) {
            return $this->response(false, "问题ID列表不能为空");
        }
        
        $problems_info = [];
        
        foreach ($problem_ids as $problem_id) {
            // 计算评测数据目录路径
            $data_dir = config('OjPath.testdata') . DIRECTORY_SEPARATOR . $problem_id;
            
            // 只计算同步必需的信息
            $size = 0;
            $hash = '';
            
            if (is_dir($data_dir)) {
                // 计算目录大小
                $size = $this->calculateDirectorySize($data_dir);
                
                // 计算目录哈希
                $hash = $this->calculateDirectoryHash($data_dir);
            }
            
            $problems_info[$problem_id] = [
                'problem_id' => $problem_id,
                'size' => $size,
                'hash' => $hash,
                'has_data' => is_dir($data_dir) && count(scandir($data_dir)) > 2
            ];
        }
        
        return $this->response(true, "获取问题数据信息成功", $problems_info);
    }
    
    /**
     * 获取数据哈希
     */
    public function getdatahash()
    {
        $problem_id = input('problem_id/d');
        
        if ($problem_id <= 0) {
            return $this->response(false, "问题ID无效");
        }
        
        // 参考Judge.php的配置获取方式
        $path_judge_data = config('OjPath.testdata') . DIRECTORY_SEPARATOR . $problem_id;
        if (!is_dir($path_judge_data)) {
            return $this->response(false, "评测数据目录不存在");
        }
        
        // 计算目录哈希
        $hash = $this->calculateDirectoryHash($path_judge_data);
        
        return $this->response(true, "获取数据哈希成功", $hash);
    }
    
    /**
     * 获取题目文件列表和哈希
     */
    public function get_datafile_list()
    {
        $problem_id = input('problem_id/d');
        
        if ($problem_id <= 0) {
            return $this->response(false, "问题ID无效");
        }
        
        // 参考Judge.php的配置获取方式
        $path_judge_data = config('OjPath.testdata') . DIRECTORY_SEPARATOR . $problem_id;
        if (!is_dir($path_judge_data)) {
            return $this->response(false, "评测数据目录不存在");
        }
        
        $files_info = [];
        
        // 扫描目录，只收集评测相关文件
        $iterator = new \RecursiveIteratorIterator(new \RecursiveDirectoryIterator($path_judge_data));
        foreach ($iterator as $file) {
            if ($file->isFile()) {
                $filename = $file->getFilename();
                $extension = strtolower(pathinfo($filename, PATHINFO_EXTENSION));
                
                // 只包含评测相关文件：.in, .out, .tpj.cc
                if ($extension === 'in' || $extension === 'out' || $filename === 'tpj.cc') {
                    $rel_path = str_replace($path_judge_data . DIRECTORY_SEPARATOR, '', $file->getPathname());
                    $file_hash = hash_file('sha256', $file->getPathname());
                    $file_size = $file->getSize();
                    $file_mtime = $file->getMTime();  // 获取文件修改时间
                    
                    $files_info[] = [
                        'path' => $rel_path,
                        'hash' => $file_hash,
                        'size' => $file_size,
                        'mtime' => $file_mtime
                    ];
                }
            }
        }
        
        return $this->response(true, "获取文件列表成功", $files_info);
    }
    
    /**
     * 获取单个文件内容
     */
    public function getdatafile()
    {
        $problem_id = input('problem_id/d');
        $file_path = input('file_path/s');
        
        if ($problem_id <= 0 || empty($file_path)) {
            return $this->response(false, "参数无效");
        }
        
        // 参考Judge.php的配置获取方式
        $path_judge_data = config('OjPath.testdata') . DIRECTORY_SEPARATOR . $problem_id;
        $full_file_path = $path_judge_data . DIRECTORY_SEPARATOR . $file_path;
        
        if (!file_exists($full_file_path)) {
            return $this->response(false, "文件不存在");
        }
        
        // 安全检查：确保文件在题目目录内
        $real_path = realpath($full_file_path);
        $real_data_dir = realpath($path_judge_data);
        if (strpos($real_path, $real_data_dir) !== 0) {
            return $this->response(false, "文件路径不安全");
        }
        
        // 输出文件内容
        $ext = strtolower(pathinfo($file_path, PATHINFO_EXTENSION));
        if (in_array($ext, ['in', 'out', 'c', 'cc', 'cpp', 'md', 'txt'])) {
            header('Content-Type: text/plain; charset=utf-8');
        } else {
            // 其他类型使用二进制流
            header('Content-Type: application/octet-stream');
        }
        header('Content-Disposition: attachment; filename="' . basename($file_path) . '"');
        readfile($full_file_path);
    }
    
    /**
     * 计算评测数据大小（只包含评测相关文件）
     */
    private function calculateDirectorySize($dir)
    {
        $size = 0;
        if (is_dir($dir)) {
            $iterator = new \RecursiveIteratorIterator(new \RecursiveDirectoryIterator($dir));
            foreach ($iterator as $file) {
                if ($file->isFile()) {
                    $filename = $file->getFilename();
                    $extension = strtolower(pathinfo($filename, PATHINFO_EXTENSION));
                    
                    // 只计算评测相关文件的大小：.in, .out, .tpj.cc
                    if ($extension === 'in' || $extension === 'out' || $filename === 'tpj.cc') {
                        $size += $file->getSize();
                    }
                }
            }
        }
        return $size;
    }
    
    /**
     * 计算评测数据哈希（只包含评测相关文件）
     */
    private function calculateDirectoryHash($dir)
    {
        $hash = hash_init('sha256');
        
        if (is_dir($dir)) {
            // 只处理评测相关的文件
            $judge_files = [];
            
            // 扫描目录，只收集评测相关文件
            $iterator = new \RecursiveIteratorIterator(new \RecursiveDirectoryIterator($dir));
            foreach ($iterator as $file) {
                if ($file->isFile()) {
                    $filename = $file->getFilename();
                    $extension = strtolower(pathinfo($filename, PATHINFO_EXTENSION));
                    
                    // 只包含评测相关文件：.in, .out, .tpj.cc
                    if ($extension === 'in' || $extension === 'out' || $filename === 'tpj.cc') {
                        $judge_files[] = $file->getPathname();
                    }
                }
            }
            
            // 按文件名排序确保一致性
            sort($judge_files);
            
            foreach ($judge_files as $file) {
                $rel_path = str_replace($dir . DIRECTORY_SEPARATOR, '', $file);
                hash_update($hash, $rel_path);
                
                if (is_readable($file)) {
                    hash_update_file($hash, $file);
                }
            }
        }
        
        return hash_final($hash);
    }
    
    /**
     * 获取题目的AC代码列表（用于查重）
     * 只返回AC（result=4）的代码
     */
    public function get_ac_solutions()
    {
        $problem_id = input('problem_id/d');
        $max_solution_id = input('max_solution_id/d', 0);  // 只获取比这个ID小的代码
        $min_solution_id = input('min_solution_id/d', 0);  // 只获取比这个ID大的代码（用于增量同步）
        $exclude_user_id = input('exclude_user_id/s', '');  // 排除的用户ID
        $page = input('page/d', 1);  // 页码，从1开始
        $page_size = input('page_size/d', 100);  // 每页数量，默认100
        
        if ($problem_id <= 0) {
            return $this->response(false, "问题ID无效");
        }
        
        // 构建查询条件（使用链式调用，与代码库其他部分保持一致）
        $query = db('solution')
            ->where('problem_id', $problem_id)
            ->where('result', 4);  // 只查询AC的代码
        
        // 只查询比 max_solution_id 小的代码
        if ($max_solution_id > 0) {
            $query->where('solution_id', '<', $max_solution_id);
        }
        
        // 只查询比 min_solution_id 大的代码（增量同步优化）
        if ($min_solution_id > 0) {
            $query->where('solution_id', '>', $min_solution_id);
        }
        
        // 排除指定用户
        if (!empty($exclude_user_id)) {
            $query->where('user_id', '<>', $exclude_user_id);
        }
        
        // 查询总数
        $total = $query->count();
        
        // 分页查询
        $offset = ($page - 1) * $page_size;
        $solutions = $query
            ->field(['solution_id', 'user_id', 'language', 'in_date'])
            ->order('solution_id', 'asc')
            ->limit($offset, $page_size)
            ->select();
        
        // 获取对应的源代码
        $solution_ids = array_column($solutions, 'solution_id');
        $source_codes = [];
        if (!empty($solution_ids)) {
            $source_list = db('source_code')
                ->where('solution_id', 'in', $solution_ids)
                ->select();
            foreach ($source_list as $source) {
                $source_codes[$source['solution_id']] = $source['source'];
            }
        }
        
        // 组装返回数据
        $result = [];
        foreach ($solutions as $solution) {
            $solution_id = $solution['solution_id'];
            if (isset($source_codes[$solution_id])) {
                $result[] = [
                    'solution_id' => $solution_id,
                    'user_id' => $solution['user_id'],
                    'language' => $solution['language'],
                    'code' => $source_codes[$solution_id],
                    'in_date' => $solution['in_date']
                ];
            }
        }
        
        return $this->response(true, "获取AC代码列表成功", [
            'list' => $result,
            'total' => $total,
            'page' => $page,
            'page_size' => $page_size,
            'has_more' => $offset + count($result) < $total
        ]);
    }
    
    /**
     * 提交查重信息
     */
    public function add_similarity_info()
    {
        // 从JSON请求体获取参数
        $data = $this->getJsonData();
        $solution_id = $data['solution_id'] ?? 0;
        $similarities = $data['similarities'] ?? [];  // [{solution_id: xxx, similarity: xxx}, ...]
        
        if ($solution_id <= 0) {
            return $this->response(false, "solution ID无效");
        }
        
        // 验证 solution_id 是否存在
        $solution = db('solution')->where('solution_id', $solution_id)->find();
        if (!$solution) {
            return $this->response(false, "solution 不存在");
        }
        
        // 评测机已经选择了最相似的一个结果（相似度最高的，如果相同则solution_id最小的）
        // Web后端只需要接收并保存这个结果即可
        // 如果 similarities 为空，表示没有相似代码，需要删除旧的sim记录（重测后可能不再相似）
        if (empty($similarities) || !is_array($similarities)) {
            // 检查是否存在旧的sim记录，如果存在则删除
            $existing = db('sim')->where('s_id', $solution_id)->find();
            if ($existing) {
                $deleted = db('sim')->where('s_id', $solution_id)->delete();
                if ($deleted) {
                    \think\facade\Log::info("查重信息已清除：solution_id={$solution_id}（重测后不再相似）");
                }
            }
            return $this->response(true, "查重信息提交成功（无相似代码，已清除旧记录）", [
                'success_count' => 0,
                'fail_count' => 0,
                'total' => 0,
                'deleted_old_record' => $existing ? true : false
            ]);
        }
        
        // 取第一个结果（评测机已经确保这是最相似的一个）
        $sim_data = $similarities[0];
        $sim_solution_id = intval($sim_data['solution_id'] ?? 0);
        $similarity = intval($sim_data['similarity'] ?? 0);
        
        // 验证数据有效性
        if ($sim_solution_id <= 0 || $similarity < 0 || $similarity > 100) {
            return $this->response(false, "相似度数据无效");
        }
        
        $max_similarity = $similarity;
        $max_sim_solution_id = $sim_solution_id;
        
        // 检查是否已存在记录
        $existing = db('sim')->where('s_id', $solution_id)->find();
        
        if ($existing) {
            // 已存在记录：检查数据是否有变化
            $old_sim_s_id = intval($existing['sim_s_id'] ?? 0);
            $old_similarity = intval($existing['sim'] ?? 0);
            
            // 只有数据不同时才更新（避免无效的数据库操作）
            // 重新评测后的结果应该以最新为准（查重算法可能已更新）
            if ($max_sim_solution_id != $old_sim_s_id || $max_similarity != $old_similarity) {
                $update_data = [
                    'sim_s_id' => $max_sim_solution_id,
                    'sim' => $max_similarity
                ];
                $result = db('sim')->where('s_id', $solution_id)->update($update_data);
                \think\facade\Log::info("查重信息已更新：solution_id={$solution_id}, 旧值: sim_s_id={$old_sim_s_id}, sim={$old_similarity}, 新值: sim_s_id={$max_sim_solution_id}, sim={$max_similarity}");
            } else {
                // 数据完全相同，无需更新
                $result = true;
            }
        } else {
            // 插入新记录
            $insert_data = [
                's_id' => $solution_id,
                'sim_s_id' => $max_sim_solution_id,
                'sim' => $max_similarity
            ];
            $result = db('sim')->insert($insert_data);
        }
        
        if ($result !== false) {
            // 验证数据是否真的保存成功
            $verify = db('sim')->where('s_id', $solution_id)->find();
            if ($verify) {
                \think\facade\Log::info("查重信息已保存：solution_id={$solution_id}, sim_s_id={$max_sim_solution_id}, sim={$max_similarity}");
            } else {
                \think\facade\Log::warning("查重信息提交成功但验证失败：solution_id={$solution_id}");
            }
            
            return $this->response(true, "查重信息提交成功", [
                'solution_id' => $solution_id,
                'sim_solution_id' => $max_sim_solution_id,
                'similarity' => $max_similarity,
                'total_candidates' => count($similarities),
                'verified' => $verify ? true : false
            ]);
        } else {
            \think\facade\Log::error("查重信息提交失败：solution_id={$solution_id}, error=" . db()->getError());
            return $this->response(false, "查重信息提交失败");
        }
    }
    
}
