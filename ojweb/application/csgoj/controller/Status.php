<?php
namespace app\csgoj\controller;
use think\Controller;
use think\Db;
use app\common\traits\StatusAjaxTrait;
use app\common\traits\TestdataFileTrait;

class Status extends Csgojbase
{
    use StatusAjaxTrait;
    use TestdataFileTrait;
    public function index()
    {
        $this->assign([
            'pagetitle' => 'Status',
            'user_id' => session('user_id'),
            'allowLanguage'    => config('CsgojConfig.OJ_LANGUAGE'),
            'ojLanguageColor'  => (function () { $v = config('CsgojConfig.OJ_LANGUAGE_COLOR'); return is_array($v) ? $v : []; })(),
            'ojResults'    => config('CsgojConfig.OJ_RESULTS'),
            'ojResultsHtml' => config('CsgojConfig.OJ_RESULTS_HTML'),
            'resdetail_authority' => IsAdmin('source_browser'),
            'search_problem_id' => input('problem_id'),
            'search_user_id' => input('user_id'),
            'search_solution_id' => input('solution_id'),
            'search_result' => intval(input('result', -1)),
            'single_status_url'     => '/' . $this->request->module() . '/status/single_status_ajax',
            'show_code_url'         => '/' . $this->request->module() . '/status/showcode_ajax',
            'show_res_url'             => '/' . $this->request->module() . '/status/resdetail_ajax',
            'controller' => strtolower($this->request->controller()), // 用于判断是全局还是比赛内
        ]);
        return $this->fetch();
    }
    // ========== StatusAjaxTrait 钩子方法实现 ==========
    
    /**
     * 应用 contest_id 筛选条件（全局需要筛选非比赛提交）
     */
    protected function applyStatusAjaxContestFilter(&$map)
    {
        // 对于非管理员，外部status不显示contest里的提交
        if (!IsAdmin()) {
            // 这个逻辑在 buildStatusAjaxQuery 中处理，因为需要 where 闭包
        }
    }
    
    /**
     * 构建查询对象（普通查询，无查重）
     */
    protected function buildStatusAjaxQuery($Solution, $map, $columns, $needSolutionIdIn, $solutionIdInValues, $needLanguageIn, $languageInValues, $ordertype)
    {
        // 单个 language 用显式 where，避免 ThinkPHP 5.1 字典式条件歧义
        $languageValue = null;
        if (isset($map['language']) && !$needLanguageIn) {
            $languageValue = $map['language'];
            unset($map['language']);
        }
        $query = $Solution->field($columns)->where($map);
        if ($languageValue !== null) {
            $query->where('language', '=', $languageValue);
        }
        if ($needSolutionIdIn) {
            $query->where('solution_id', 'in', $solutionIdInValues);
        }
        if ($needLanguageIn && !empty($languageInValues)) {
            $query->where('language', 'in', $languageInValues);
        }
        // 对于非管理员，外部status不显示contest里的提交
        if (!IsAdmin()) {
            $query->where(function ($q) {
                $q->whereNull('contest_id')
                  ->whereOr('contest_id', 0);
            });
        }
        
        // ========== EXP 模式课程筛选逻辑（与 ACMOJ 逻辑解耦） ==========
        // 非管理员且 OJ_STATUS=exp 时，根据当前课程组筛选 solution
        // 注意：此逻辑仅用于 exp 模式，与 ACMOJ 逻辑完全解耦，可随时移除
        if (!IsAdmin() && isset($this->OJ_STATUS) && $this->OJ_STATUS == 'exp' && isset($this->NOW_COURSE_ID) && $this->NOW_COURSE_ID) {
            $query->where('course_id', $this->NOW_COURSE_ID);
        }
        // ========== EXP 模式课程筛选逻辑结束 ==========
        
        return $query;
    }
    
    /**
     * 辅助方法：为查询对象应用公共的 where 条件
     * @param \think\db\Query $query 查询对象
     * @param array $map 查询条件
     * @param bool $needSolutionIdIn 是否需要 solution_id IN 查询
     * @param array $solutionIdInValues solution_id 值列表
     * @param bool $needLanguageIn 是否需要 language IN 查询
     * @param array $languageInValues language 值列表
     * @param int $similar 相似度阈值
     * @param string $tableAlias 表别名（默认 'sl'）
     * @param string $simAlias sim 表别名（默认 'si'）
     */
    private function applyStatusAjaxSimilarConditions($query, $map, $needSolutionIdIn, $solutionIdInValues, $needLanguageIn, $languageInValues, $similar, $tableAlias = 'sl', $simAlias = 'si')
    {
        // 设置基础 where 条件
        foreach ($map as $key => $value) {
            $query->where($tableAlias . '.' . $key, $value);
        }
        
        // 对于非管理员，外部status不显示contest里的提交（独立于 map，确保始终应用）
        if (!IsAdmin()) {
            $query->where(function ($q) use ($tableAlias) {
                $q->whereNull($tableAlias . '.contest_id')
                  ->whereOr($tableAlias . '.contest_id', 0);
            });
        }
        
        // 根据相似度筛选条件添加额外的 where
        // 注意：similar = 0 时相当于不查重，只在 similar > 0 时才添加 sim 相关条件
        if ($similar > 0) {
            // 查重筛选时，只查询AC的结果（因为只有AC的代码才会查重）
            // 并且 sim 值必须 >= similar，sim_s_id 必须存在
            // 注意：由于使用 INNER JOIN，sim 字段不会为 null，但 sim_s_id 可能为 null
            $query->where($tableAlias . '.result', 4)  // 4 = AC
                ->where($simAlias . '.sim', '>=', $similar)
                ->where($simAlias . '.sim_s_id', '<>', 'null')  // sim_s_id 不为 null
                ->where($simAlias . '.sim_s_id', '>', 0);  // sim_s_id 大于 0
        }
        
        // 添加其他筛选条件
        if ($needSolutionIdIn) {
            $query->where($tableAlias . '.solution_id', 'in', $solutionIdInValues);
        }
        if ($needLanguageIn) {
            $query->where($tableAlias . '.language', 'in', $languageInValues);
        }
        
        // ========== EXP 模式课程筛选逻辑（与 ACMOJ 逻辑解耦） ==========
        if (!IsAdmin() && isset($this->OJ_STATUS) && $this->OJ_STATUS == 'exp' && isset($this->NOW_COURSE_ID) && $this->NOW_COURSE_ID) {
            $query->where($tableAlias . '.course_id', $this->NOW_COURSE_ID);
        }
        // ========== EXP 模式课程筛选逻辑结束 ==========
        
        return $query;
    }
    
    /**
     * 构建带查重的查询对象（全局状态页面支持查重）
     */
    protected function buildStatusAjaxQueryWithSimilar($Solution, $map, $columns, $needSolutionIdIn, $solutionIdInValues, $needLanguageIn, $languageInValues, $ordertype, $params, $offset, $limit)
    {
        $similar = intval($params['similar']);
        if ($similar < 0) {
            $similar = 0;
        } else if ($similar > 100) {
            $similar = 100;
        }
        
        // ========== 第一步：计算总数（使用独立的 count 查询，条件与数据查询一致） ==========
        $countQuery = db('solution')->alias('sl');
        // 只有在需要按相似度筛选时才 JOIN sim 表（similar > 0）
        // 使用 INNER JOIN 确保只返回有查重数据的记录
        if ($similar > 0) {
            $countQuery->join('sim si', 'si.s_id=sl.solution_id', 'inner');
        }
        // 应用公共条件
        $this->applyStatusAjaxSimilarConditions($countQuery, $map, $needSolutionIdIn, $solutionIdInValues, $needLanguageIn, $languageInValues, $similar);
        // 计算总数
        $total = $countQuery->count('sl.solution_id');
        
        // ========== 第二步：数据查询 ==========
        // 构建基础查询：join sim 表和被相似对象的 solution 表
        // 使用 INNER JOIN sim 表，确保只返回有查重数据的记录
        $query = db('solution')->alias('sl')
            ->join('sim si', 'si.s_id=sl.solution_id', 'inner')
            ->join('solution sr', 'sr.solution_id=si.sim_s_id', 'left');
        
        // 设置字段
        $fieldList = 'sl.*, si.sim, si.sim_s_id, sr.user_id sim_user_id, sr.in_date sim_in_date';
        $query->field($fieldList);
        
        // 应用公共条件
        $this->applyStatusAjaxSimilarConditions($query, $map, $needSolutionIdIn, $solutionIdInValues, $needLanguageIn, $languageInValues, $similar);
        
        // 处理排序字段：为排序字段添加表别名
        $ordertypeWithAlias = [];
        if (!empty($ordertype)) {
            foreach ($ordertype as $field => $direction) {
                // 如果字段名中没有点号（没有表别名），添加 sl. 前缀
                if (strpos($field, '.') === false) {
                    $ordertypeWithAlias['sl.' . $field] = $direction;
                } else {
                    $ordertypeWithAlias[$field] = $direction;
                }
            }
        }
        
        // 执行分页查询
        $solutionlist = $query->order($ordertypeWithAlias)->limit($offset, $limit)->select();
        
        // ========== 第三步：处理 sim 数据 ==========
        // 手动处理 sim 数据，剔除自己与自己相似的情况
        $sim_id_list = [];
        foreach ($solutionlist as $val) {
            if (isset($val['sim']) && $val['sim'] != null) {
                $sim_id_list[] = $val['sim_s_id'];
            }
        }
        
        // 批量查询被相似对象的 solution 信息
        $solBMap = [];
        $sim_user_name_map = [];
        if (!empty($sim_id_list)) {
            $solB = db('solution')->where('solution_id', 'in', $sim_id_list)->field(['user_id', 'solution_id', 'contest_id'])->select();
            $sim_user_ids_normal = []; // 常规用户列表
            
            foreach ($solB as $val) {
                $solBMap[$val['solution_id']] = [
                    'user_id' => $val['user_id'],
                    'contest_id' => $val['contest_id']
                ];
                
                // 全局状态页面，只处理常规用户（非 #cpc 用户）
                $user_id = $val['user_id'];
                if ($user_id && (strlen($user_id) < 4 || substr($user_id, 0, 4) !== '#cpc')) {
                    $sim_user_ids_normal[] = $user_id;
                }
            }
            
            // 批量查询用户信息
            if (!empty($sim_user_ids_normal)) {
                $users = db('users')
                    ->where('user_id', 'in', array_unique($sim_user_ids_normal))
                    ->field(['user_id', 'nick'])
                    ->select();
                foreach ($users as $user) {
                    $sim_user_name_map[$user['user_id']] = $user['nick'] ?: $user['user_id'];
                }
            }
        }
        
        // ========== 第四步：处理返回数据，剔除自己与自己相似的情况 ==========
        $solution_ret = [];
        foreach ($solutionlist as &$val) {
            // 获取被相似对象的用户名字（name）
            if (isset($val['sim_s_id']) && $val['sim_s_id'] != null && array_key_exists($val['sim_s_id'], $solBMap)) {
                $sim_solution_info = $solBMap[$val['sim_s_id']];
                $sim_user_id_original = $sim_solution_info['user_id'];
                
                // 检查是否是自己与自己的代码相似
                $current_user_id_original = $val['user_id'];
                if ($sim_user_id_original == $current_user_id_original) {
                    // 自己与自己的代码相似，跳过这条记录（不返回）
                    continue;
                }
                
                if (isset($sim_user_name_map[$sim_user_id_original])) {
                    $val['sim_user_name'] = $sim_user_name_map[$sim_user_id_original];
                } else {
                    $val['sim_user_name'] = null;
                }
            } else {
                $val['sim_user_name'] = null;
            }
            
            $solution_ret[] = $val;
        }
        
        return ['rows' => $solution_ret, 'total' => $total];
    }
    
    /**
     * status_ajax 查重权限钩子（供 StatusAjaxTrait 调用）
     * 全局状态页：不向课程权限显示查重信息（仅管理员可见）
     */
    protected function statusAjaxSimilarExtraPermission()
    {
        // 全局状态页面不向课程权限开放查重功能，仅管理员可见
        return false;
    }
    
    /**
     * ========== EXP 模式：处理 contest 信息（与 ACMOJ 逻辑解耦） ==========
     * 全局状态页面且 OJ_STATUS=exp 时，需要批量查询 contest 信息
     */
    protected function processStatusAjaxExpContestInfo($solutionlist)
    {
        // 只在 EXP 模式下处理
        if (!isset($this->OJ_STATUS) || $this->OJ_STATUS != 'exp') {
            return $solutionlist;
        }
        
        // 提取所有 contest_id（非空且大于0）
        $contestIdsToQuery = [];
        foreach ($solutionlist as $solution) {
            if (isset($solution['contest_id']) && $solution['contest_id'] != null && $solution['contest_id'] > 0) {
                $contestIdsToQuery[] = $solution['contest_id'];
            }
        }
        
        // 批量查询 contest 信息（最多20个）
        if (!empty($contestIdsToQuery)) {
            $contestIdsToQuery = array_unique($contestIdsToQuery);
            $contestIdsToQuery = array_slice($contestIdsToQuery, 0, 20);
            
            // 查询 contest 表获取 private（用于判断类型）和 contest_id
            $contests = db('contest')
                ->where('contest_id', 'in', $contestIdsToQuery)
                ->field('contest_id, private')
                ->select();
            
            // 查询 course_item 和 course 表获取 course 信息
            $courseItems = db('course_item')->alias('ci')
                ->join('course c', 'ci.course_id = c.course_id', 'left')
                ->where('ci.item', 'contest')
                ->where('ci.item_id', 'in', $contestIdsToQuery)
                // 兼容历史数据：pvrole 可能是 NULL 或空字符串
                ->where(function($q) {
                    $q->whereNull('ci.pvrole')->whereOr('ci.pvrole', '');
                })
                ->field('ci.item_id contest_id, c.course_id, c.course_key, c.course_title, c.course_unit')
                ->select();
            
            // 构建 contest_id => course 信息映射
            $contestCourseMap = [];
            foreach ($courseItems as $item) {
                $contestCourseMap[$item['contest_id']] = [
                    'course_id' => $item['course_id'],
                    'course_key' => $item['course_key'],
                    'course_title' => $item['course_title'],
                    'course_unit' => $item['course_unit']
                ];
            }
            
            // 构建完整的 contest 信息映射
            $contestInfoMap = [];
            foreach ($contests as $contest) {
                $contestId = $contest['contest_id'];
                $private = $contest['private'];
                $contestType = $private % 10; // 0=普通, 2=CPC标准, 4=练习, 5=考试
                
                $contestInfoMap[$contestId] = [
                    'contest_id' => $contestId,
                    'private' => $private,
                    'contest_type' => $contestType,
                    'is_exam' => ($contestType == 5), // 考试类型
                    'is_practice' => ($contestType == 4), // 练习类型
                    'course' => isset($contestCourseMap[$contestId]) ? $contestCourseMap[$contestId] : null
                ];
            }
            
            // 添加到 solution 数据中
            foreach ($solutionlist as &$solution) {
                if (isset($solution['contest_id']) && $solution['contest_id'] > 0) {
                    if (isset($contestInfoMap[$solution['contest_id']])) {
                        $solution['contest_info'] = $contestInfoMap[$solution['contest_id']];
                    }
                }
            }
        }
        
        return $solutionlist;
    }
    
    /**
     * 获取总数（全局状态页面）
     */
    protected function getStatusAjaxTotal($map, $needSolutionIdIn, $solutionIdInValues, $needLanguageIn, $languageInValues)
    {
        $languageValue = null;
        if (isset($map['language']) && !$needLanguageIn) {
            $languageValue = $map['language'];
            unset($map['language']);
        }
        $Solution = db('solution');
        $countQuery = $Solution->alias('s')->where($map);
        if ($languageValue !== null) {
            $countQuery->where('s.language', '=', $languageValue);
        }
        if ($needSolutionIdIn) {
            $countQuery->where('s.solution_id', 'in', $solutionIdInValues);
        }
        if ($needLanguageIn && !empty($languageInValues)) {
            $countQuery->where('s.language', 'in', $languageInValues);
        }
        // 对于非管理员，外部status不显示contest里的提交
        if (!IsAdmin()) {
            $countQuery->where(function ($q) {
                $q->whereNull('s.contest_id')
                  ->whereOr('s.contest_id', 0);
            });
        }
        
        // ========== EXP 模式课程筛选逻辑（与 ACMOJ 逻辑解耦） ==========
        if (!IsAdmin() && isset($this->OJ_STATUS) && $this->OJ_STATUS == 'exp' && isset($this->NOW_COURSE_ID) && $this->NOW_COURSE_ID) {
            $countQuery->where('s.course_id', $this->NOW_COURSE_ID);
        }
        // ========== EXP 模式课程筛选逻辑结束 ==========
        
        return $countQuery->count();
    }
    
    /**
     * 应用单个提交状态的 contest_id 筛选
     */
    protected function applySingleStatusAjaxContestFilter(&$query)
    {
        // 对于非管理员，外部status不显示contest里的提交
        if (!IsAdmin()) {
            $query->where(function ($q) {
                $q->whereNull('contest_id')
                  ->whereOr('contest_id', 0);
            });
        }
    }
    
    /**
     * 检查是否可以查看比赛提交
     */
    protected function canSeeContestSolution($contest_id)
    {
        // 全局状态页面：只有比赛管理员可以查看比赛提交
        return PrivItem('contest', $contest_id);
    }
    public function GetResultShow(&$solution) {
        $solution['res_show'] = false;
        $oj_results_html = config('CsgojConfig.OJ_RESULTS_HTML');
        $oj_results_short = config('CsgojConfig.OJ_RESULTS_SHORT');
        // if_can_see_info 的前提下，【10 RE 或 11 CE】或者【5~9的结果且(为管理员或允许查看错误信息)】
        $solution['res_show'] = $this->IfCanSeeInfo($solution) && (($solution['result'] == 10 || $solution['result'] == 11) || 
            (in_array($solution['result'], [5, 6, 7, 8, 9, 10, 90]) && (IsAdmin('source_browser') || $this->ALLOW_WA_INFO)));
        $result_style = array_key_exists($solution['result'], $oj_results_html) ? $solution['result'] : 100;
        $solution['res_color'] = $oj_results_html[$result_style][0];
        $solution['res_text'] = $oj_results_html[$result_style][1];
        $solution['res_short'] = array_key_exists($solution['result'], $oj_results_short) ? $oj_results_short[$solution['result']] : 'Unknown';
    }
    protected function IfCanSeeInfo($solution)
    {
        if(!session('?user_id'))
            return false;
        if(session('user_id') == $solution['user_id'])
            return true;
        if(IsAdmin('source_browser'))
            return true;
        if($solution['contest_id'] != null && $solution['contest_id'] > 0)
        {
            if(!IsAdmin('contest', $solution['contest_id']))
                return false;
        }
        return false;
    }
    public function resdetail_ajax(){
        $solution_id = trim(input('solution_id'));
        $solution = db('solution')->where('solution_id', $solution_id)->find();
        $solution_related_admin = IsAdmin('source_browser') || $solution['contest_id'] != null && $solution['contest_id'] > 0 && IsAdmin('contest', $solution['contest_id']);
        $flg_can_see_special = $solution_related_admin || $this->ALLOW_WA_INFO;
        if($this->IfCanSeeInfo($solution)) {
            if($solution['result'] == 11) {
                // Compile Error
                $table_name = 'compileinfo';
            }
            else if(in_array($solution['result'], [5, 6, 7, 8, 9, 10, 90]) && $flg_can_see_special) {
                // PE || WA || TLE || MLE || OLE || RE 暂时只允许管理员查看
                $table_name = 'runtimeinfo';
            }
            else {
                $this->error('No infomation.');
            }
            
            $info_item = db($table_name)->where('solution_id', $solution_id)->find();
            $info = $info_item ? $info_item['error'] : '';

            $data = Json2Array($info);
            if(!$data) {
                $data = ['data_type' => 'text', 'data' => $info];
            }
            // 添加权限信息：是否允许查看输入数据（管理员/教师可以查看）
            $can_see_input = $solution_related_admin || IsAdmin('source_browser');
            // ========== EXP 模式：教师权限检查（与 ACMOJ 逻辑隔离） ==========
            if(isset($this->OJ_STATUS) && $this->OJ_STATUS == 'exp' && isset($this->NOW_COURSE_KEY) && function_exists('PrivCourse')) {
                $can_see_input = $can_see_input || PrivCourse('teacher', $this->NOW_COURSE_KEY);
            }
            // ========== EXP 模式：教师权限检查结束 ==========
            $data['can_see_input'] = $can_see_input;
            $this->success('', null, $data);
        }
        else {
            $this->error('Permission denied to see this infomation.');
        }
    }

    /**
     * 从评测数据目录读取单个测试数据文件（.in/.out），用于 runinfo 展示
     *
     * 参数：
     * - solution_id: 提交ID（用于权限校验 + 推导 problem_id）
     * - case: 测试点名（如 test0 / sample）
     * - kind: in/out
     * - max_bytes: 截断长度（字节，默认 1024）
     */
    public function testdatafile_ajax()
    {
        $solution_id = intval(input('solution_id/d', 0));
        $case = trim(input('case/s', ''));
        $kind = strtolower(trim(input('kind/s', '')));
        $max_bytes = intval(input('max_bytes/d', 1024));
        if ($max_bytes <= 0) $max_bytes = 1024;

        if ($solution_id <= 0 || $case === '' || !in_array($kind, ['in', 'out'])) {
            $this->error('Invalid params.');
            return;
        }

        $solution = db('solution')->where('solution_id', $solution_id)->find();
        if (!$solution) {
            $this->error('No such solution.');
            return;
        }

        // 权限：与 resdetail_ajax 的 can_see_input 一致（管理员/教师/比赛管理员）
        $solution_related_admin = IsAdmin('source_browser') || ($solution['contest_id'] != null && $solution['contest_id'] > 0 && IsAdmin('contest', $solution['contest_id']));
        $can_see_input = $solution_related_admin || IsAdmin('source_browser');
        if(isset($this->OJ_STATUS) && $this->OJ_STATUS == 'exp' && isset($this->NOW_COURSE_KEY) && function_exists('PrivCourse')) {
            $can_see_input = $can_see_input || PrivCourse('teacher', $this->NOW_COURSE_KEY);
        }
        if (!$can_see_input) {
            $this->error('Permission denied.');
            return;
        }

        $problem_id = intval($solution['problem_id']);
        $data = $this->readTestdataFileWithMeta($problem_id, $case, $kind, $max_bytes);
        $this->success('ok', null, $data);
    }

    /**
     * 批量获取多个测试点的 in/out 尺寸（用于 runinfo 收起表格一次性填充）
     *
     * 参数：
     * - solution_id
     * - cases: 逗号分隔字符串（如 "test0,test1"），或数组（兼容 cases[]=）
     */
    public function testdatafilesizes_ajax()
    {
        $solution_id = intval(input('solution_id/d', 0));
        $cases_arr = input('cases/a', null);
        $cases_str = trim(input('cases/s', ''));

        if ($solution_id <= 0) {
            $this->error('Invalid params.');
            return;
        }

        // cases 兼容：
        // - cases=sample,test0
        // - cases[]=sample&cases[]=test0
        // - cases[]=sample,test0（某些前端会把逗号串塞进数组里）
        $cases = [];
        if (is_array($cases_arr) && count($cases_arr) > 0) {
            foreach ($cases_arr as $c) {
                if (!is_string($c)) continue;
                $parts = explode(',', $c);
                foreach ($parts as $p) $cases[] = $p;
            }
        }
        if (count($cases) === 0 && $cases_str !== '') {
            $cases = explode(',', $cases_str);
        }
        // 限制数量，避免滥用
        if (count($cases) > 300) {
            $cases = array_slice($cases, 0, 300);
        }

        $solution = db('solution')->where('solution_id', $solution_id)->find();
        if (!$solution) {
            $this->error('No such solution.');
            return;
        }

        // 权限：与 resdetail_ajax 的 can_see_input 一致
        $solution_related_admin = IsAdmin('source_browser') || ($solution['contest_id'] != null && $solution['contest_id'] > 0 && IsAdmin('contest', $solution['contest_id']));
        $can_see_input = $solution_related_admin || IsAdmin('source_browser');
        if(isset($this->OJ_STATUS) && $this->OJ_STATUS == 'exp' && isset($this->NOW_COURSE_KEY) && function_exists('PrivCourse')) {
            $can_see_input = $can_see_input || PrivCourse('teacher', $this->NOW_COURSE_KEY);
        }
        if (!$can_see_input) {
            $this->error('Permission denied.');
            return;
        }

        $problem_id = intval($solution['problem_id']);
        $data = $this->readTestdataSizesForCases($problem_id, $cases);
        $this->success('ok', null, $data);
    }
    public function showcode_ajax()
    {
        $data = [];
        $solution_id = trim(input('solution_id'));
        $solution = db('solution')->where('solution_id', $solution_id)->find();
        
        if(!$solution) {
            $this->error('No such solution.');
            return;
        }

        $oj_language = config('CsgojConfig.OJ_LANGUAGE');
        $oj_results = config('CsgojConfig.OJ_RESULTS');
        if($this->IfCanSeeInfo($solution))
        {
            if(array_key_exists($solution['language'], $oj_language))
                $language = $oj_language[$solution['language']];
            else
                $language = "Unknown";
            $source = db('source_code')->where('solution_id', $solution_id)->find();
            
            if(!$source || !isset($source['source'])) {
                $this->error('Source code not found.');
                return;
            }
            
            // 最佳实践：API 返回原始源码（JSON 会安全编码），前端使用 textContent 渲染即可避免 XSS。
            // 保留标记字段供前端兼容：source_escaped = 0 表示未进行 HTML 实体转义
            $data['source'] = str_replace("\r\n", "\n", $source['source']);
            $data['source_escaped'] = 0;
            $data['language'] = $language;
            $data['problem_id'] = $solution['problem_id'];
            $data['user_id'] = $solution['user_id'];
            $data['result'] = $oj_results[$solution['result']];
            $data['submit_time'] = $solution['in_date'];
            $data['code_length'] = $solution['code_length'];
            
            // 如果AC，添加时间和内存信息
            if ($solution['result']==4) {
                $data['time'] = $solution['time'];
                $data['memory'] = $solution['memory'];
            }
        }
        else
        {
            $this->error('Permission denied to see this code.');
            return;
        }
        $this->success('', null, $data);
    }
    
    // status_code_compare 方法已由 StatusAjaxTrait 提供
}
