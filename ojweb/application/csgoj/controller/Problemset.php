<?php
namespace app\csgoj\controller;
use think\Controller;
use think\Db;
class Problemset extends Csgojbase
{

    // ========================================================================
    // EXP 模式 Hook 方法（ACM 模式返回默认值，EXP 模式执行 course 逻辑）
    // ========================================================================
    
    /**
     * Hook 方法：检查是否有权限查看题目（用于 hidden 题目访问控制）
     * ACM 模式：返回 false（仅管理员可查看 hidden 题目）
     * EXP 模式：检查课程教师是否有权限查看当前课程归属的 hidden 题目
     * 
     * @param int $problem_id 题目ID
     * @return bool 是否有权限
     */
    protected function checkCourseProblemViewPermission($problem_id)
    {
        // ========== ACM 模式：返回 false（仅管理员可查看 hidden 题目） ==========
        if($this->OJ_STATUS != 'exp') {
            return false;
        }
        // ========== EXP 模式：课程教师权限检查 ==========
        // 课程教师：允许查看"当前课程归属"的 hidden 题目（仅查看题面，不代表可提交/可管理）
        if(isset($this->NOW_COURSE_ID) && $this->NOW_COURSE_ID && function_exists('PrivCourse') &&
            (PrivCourse('teacher', $this->NOW_COURSE_KEY) || PrivCourse('admin', $this->NOW_COURSE_KEY))) {
            // 注意：PrivCourse('admin') 已包含 super 权限的检查
            // 检查题目是否属于该 course_id
            $courseItem = db('course_item')
                ->where([
                    'item' => 'problem',
                    'item_id' => $problem_id,
                    'course_id' => $this->NOW_COURSE_ID,
                ])
                // 兼容历史数据：pvrole 可能是 NULL 或空字符串
                ->where(function($q) {
                    $q->whereNull('pvrole')->whereOr('pvrole', '');
                })
                ->find();
            return $courseItem !== null;
        }
        return false;
        // ========== EXP 模式结束 ==========
    }
    
    /**
     * Hook 方法：检查是否有权限提交题目（用于 hidden 题目提交控制）
     * ACM 模式：返回 false（仅管理员可提交 hidden 题目）
     * EXP 模式：检查课程教师是否有权限提交当前课程归属的 hidden 题目
     * 
     * @param int $problem_id 题目ID
     * @return bool 是否有权限
     */
    protected function checkCourseProblemSubmitPermission($problem_id)
    {
        // ========== ACM 模式：返回 false（仅管理员可提交 hidden 题目） ==========
        if($this->OJ_STATUS != 'exp') {
            return false;
        }
        // ========== EXP 模式：课程教师权限检查 ==========
        // 课程教师：允许提交"当前课程归属"的 hidden 题目
        if(isset($this->NOW_COURSE_ID) && $this->NOW_COURSE_ID && function_exists('PrivCourse') &&
            (PrivCourse('teacher', $this->NOW_COURSE_KEY) || PrivCourse('admin', $this->NOW_COURSE_KEY))) {
            // 注意：PrivCourse('admin') 已包含 super 权限的检查
            // 检查题目是否属于该 course_id
            $courseItem = db('course_item')
                ->where([
                    'item' => 'problem',
                    'item_id' => $problem_id,
                    'course_id' => $this->NOW_COURSE_ID,
                ])
                // 兼容历史数据：pvrole 可能是 NULL 或空字符串
                ->where(function($q) {
                    $q->whereNull('pvrole')->whereOr('pvrole', '');
                })
                ->find();
            return $courseItem !== null;
        }
        return false;
        // ========== EXP 模式结束 ==========
    }
    
    /**
     * Hook 方法：对 solution 查询应用课程筛选
     * ACM 模式：空操作（不应用任何筛选）
     * EXP 模式：根据当前课程组筛选 solution
     * 
     * @param \think\db\Query $query 查询对象
     * @return void
     */
    protected function applyCourseFilterToSolutionQuery(&$query)
    {
        // ========== ACM 模式：空操作 ==========
        if($this->OJ_STATUS != 'exp') {
            return;
        }
        // ========== EXP 模式：应用课程筛选 ==========
        // 非管理员且 OJ_STATUS=exp 时，根据当前课程组筛选 solution
        if(!IsAdmin() && isset($this->NOW_COURSE_ID) && $this->NOW_COURSE_ID) {
            $query->where('course_id', $this->NOW_COURSE_ID);
        }
        // ========== EXP 模式结束 ==========
    }
    
    /**
     * Hook 方法：获取提交时使用的 course_id
     * ACM 模式：返回 null（公共题目集不属于任何课程）
     * EXP 模式：
     *   - 公开题目（defunct='0'）：返回 null（任何人都能提交，不需要 course_id 限制）
     *   - Hidden 题目（defunct='1'）：返回当前课程的 course_id（用于鉴权）
     * 
     * @param int $problem_id 题目ID
     * @param array|null $problem 题目数据（可选，如果提供则避免重复查询）
     * @return int|null 课程ID，null 表示不属于任何课程
     */
    protected function getSolutionCourseId($problem_id, $problem = null)
    {
        // ========== ACM 模式：始终返回 null ==========
        if($this->OJ_STATUS != 'exp') {
            return null;
        }
        // ========== EXP 模式：根据题目是否公开决定 course_id ==========
        // 如果没有提供 problem 数据，则查询数据库
        if($problem === null) {
            $problem = db('problem')->where('problem_id', $problem_id)->field('defunct')->find();
            if($problem == null) {
                return null;
            }
        }
        
        // 公开题目：返回 null（任何人都能提交，不需要 course_id 限制）
        if($problem['defunct'] == '0') {
            return null;
        }
        
        // Hidden 题目：返回当前课程的 course_id（用于鉴权）
        // 注意：调用此方法前应已通过 checkCourseProblemSubmitPermission 权限检查
        if($this->NOW_COURSE_ID) {
            return $this->NOW_COURSE_ID;
        }
        
        return null;
        // ========== EXP 模式结束 ==========
    }
    
    // ========================================================================
    // EXP 模式 Hook 方法结束
    // ========================================================================

    public function initialize()
    {
        $this->OJMode();
        $this->assign(['pagetitle' => 'Problem Set']);
    }
    public function index()
    {
        $this->assign([
            'prolist_mode' => 'frontend',
            'search_spj' => input('spj', -1),
            'table_prefix' => 'problemset',
            'table_id' => 'problemset_table',
            'ajax_url' => '/csgoj/problemset/problemset_ajax',
            'page_title' => '开放题目集',
            'page_title_en' => 'Public Problems',
            'search_placeholder' => '题号/标题/来源',
            'page_size' => 25,
            'cookie_expire' => '1m',
            'cookie_suffix' => session('?user_id') ? '-'.session('user_id') : '',
            'filter_selectors' => ['spj'],
            'custom_handlers' => 'initUrlSearch'
        ]);
        return $this->fetch();
    }
    public function problemset_ajax()
    {
        //暂时用get，不知道是bug还是设置不对，前端表格用post的ajax，后台获取不到数据
        $columns = ['problem_id', 'title', 'source', 'accepted', 'submit', 'spj'];
        $offset = intval(input('offset'));
        $limit  = intval(input('limit'));
        $sort   = trim(input('sort', ''));
        $sort   = validate_item_range($sort, ['problem_id', 'accepted', 'submit']);
        $order  = input('order');
        $search = trim(input('search/s'));
        
        // 新增筛选参数
        $spj_filter = input('spj', -1);

        $ret = [];
        $ordertype = [];
        if(strlen($sort) > 0)
        {
            $ordertype = [
                $sort => $order
            ];
        }
        $Problem = db('problem');

        // ThinkPHP 5.1 正确语法：使用链式调用构建查询条件
        if(strlen($search) > 0) {
            // problem_id 使用精确匹配，title|source 使用 LIKE 匹配（OR 关系）
            $Problem->where(function($query) use ($search) {
                $query->where('problem_id', $search)
                      ->whereOr('title', 'like', "%$search%")
                      ->whereOr('source', 'like', "%$search%");
            });
        }
        
        // defunct 筛选：只显示公开题目
        $Problem->where('defunct', '0');
        
        // 添加spj筛选
        if($spj_filter != -1) {
            $Problem->where('spj', $spj_filter);
        }
        
        $problemList = $Problem
            ->field(implode(",", $columns))
            ->limit($offset, $limit)
            ->order($ordertype)
            ->select();
        if(session('?user_id')) {
            $user_id = session('user_id');
            $solutionStatus = [];
            $Solution = db('solution');
            $solutionNormal = $Solution
                ->where(['user_id' => $user_id])
                ->where(function($query){
                    $query->whereNull('contest_id')
                        ->whereOr('contest_id', 0);
                })
                ->field('problem_id')
                ->group('problem_id')
                ->select();
            $solutionAc = $Solution
                ->where(['user_id' => $user_id, 'result' => 4])
                ->where(function ($query) {
                    $query->whereNull('contest_id')
                        ->whereOr('contest_id', 0);
                })
                ->field('problem_id')
                ->group('problem_id')
                ->select();
            foreach($solutionNormal as $res) {
                $solutionStatus[$res['problem_id']] = '0';
            }
            foreach($solutionAc as $res) {
                $solutionStatus[$res['problem_id']] = '1';
            }

            foreach($problemList as $key=>$problem) {
                if(array_key_exists($problem['problem_id'], $solutionStatus))
                    $problemList[$key]['ac'] = $solutionStatus[$problem['problem_id']] == '0' ? 0 : 1;
            }
        }
        // 重新创建查询对象计算 total，避免之前的查询状态影响
        $totalQuery = db('problem');
        if(strlen($search) > 0) {
            // 应用搜索条件
            $totalQuery->where(function($query) use ($search) {
                $query->where('problem_id', $search)
                      ->whereOr('title', 'like', "%$search%")
                      ->whereOr('source', 'like', "%$search%");
            });
        }
        // defunct 筛选：只显示公开题目
        $totalQuery->where('defunct', '0');
        // 添加spj筛选
        if($spj_filter != -1) {
            $totalQuery->where('spj', $spj_filter);
        }
        $ret['total'] = $totalQuery->count();
        $ret['rows'] = $problemList;
        return $ret;
    }
    private function GetProblem()
    {
        $Problem = db('problem');
        $pid = intval(input('get.pid'));
        $map = ['problem_id' => $pid];
        $problem = $Problem->where($map)->find();
        if($problem == null)
        {
            $this->error('No such problem.', null, '', 1);
        }
        // ========== ACM 模式：Hidden 题目访问控制 ==========
        // Hidden 题目访问控制：
        // - 题目管理员/编辑可见（沿用原逻辑）
        if($problem['defunct'] == '1' && !IsAdmin('problem', $pid)) {
            $allow_view_hidden = false;
            // 全局编辑权限
            if (IsAdmin('problem_editor') || IsAdmin('contest_editor') || IsAdmin('administrator') || IsAdmin('super_admin')) {
                $allow_view_hidden = true;
            }
            // ========== EXP 模式：课程教师权限检查（Hook 方法） ==========
            // 课程教师：允许查看"当前课程归属"的 hidden 题目（仅查看题面，不代表可提交/可管理）
            if (!$allow_view_hidden) {
                $allow_view_hidden = $this->checkCourseProblemViewPermission($pid);
            }
            // ========== EXP 模式 Hook 结束 ==========
            
            if (!$allow_view_hidden) {
                $this->error('You cannot open problem '. $pid, null, '', 1);
            }
        }
        // ========== ACM 模式结束 ==========
        return $problem;
    }
    public function problem()
    {
        $problem = $this->GetProblem();
        $problem['problem_id_show'] = $problem['problem_id'];
        $lang = trim(input('get.lang/s', ''));
        $pdfCtx = problem_locale_problemset_pdf_context(strtolower($this->request->module()), (int) $problem['problem_id']);
        $vs = problem_locale_view_state($problem, null, $lang, $pdfCtx['route_base'], $pdfCtx['query'], $pdfCtx['query']);
        $this->assign([
            'problem'               => $vs['problem'],
            'pagetitle'             => $problem['problem_id'] . ':' . $problem['title'],
            'desc_display_mode'     => $vs['desc_display_mode'],
            'problem_pdf_embed_url' => $vs['pdf_url'],
            'available_locales'     => $vs['available_locales'],
            'current_locale_key'    => $vs['current_locale_key'],
            'show_lang_bar'         => $vs['show_lang_bar'],
        ]);
        return $this->fetch();
    }

    /**
     * 题面 PDF（内嵌展示，需与 GetProblem 相同的可见性）
     */
    public function problem_pdf()
    {
        $problem = $this->GetProblem();
        $lang = input('get.lang/s', 'main');
        $why = problem_locale_pdf_serve_allowed((int) $problem['problem_id'], $lang);
        if ($why !== null) {
            $this->error('PDF not available.', null, '', 1);
        }
        $stem = problem_locale_normalize_lang_stem($lang);
        $path = problem_locale_pdf_disk_path((int) $problem['problem_id'], $stem);
        header('Content-Type: application/pdf');
        header('Content-Disposition: inline; filename="' . $stem . '.pdf"');
        header('X-Content-Type-Options: nosniff');
        readfile($path);
        exit;
    }
    public function problem_ajax() {
        $problem = $this->GetProblem();
        $lang = trim(input('get.lang/s', ''));
        $pdfCtx = problem_locale_problemset_pdf_context(strtolower($this->request->module()), (int) $problem['problem_id']);
        $payload = problem_locale_ajax_enriched_problem($problem, $lang, $pdfCtx['route_base'], $pdfCtx['query']);
        return json($payload);
    }
    public function submit()
    {
        if(!session('?user_id'))
            $this->error('Please login before submit problem solution!', null, '', 1);
        $problem = $this->GetProblem();
        $problem['problem_id_show'] = $problem['problem_id'];
        // ========== ACM 模式：Hidden 题目提交控制 ==========
        // Hidden 题目提交控制：
        // - problem/contest editor：允许
        if($problem['defunct'] != '0' && !IsAdmin('problem_editor') && !IsAdmin('contest_editor')) {
            $allow_submit_hidden = false;
            // ========== EXP 模式：课程教师权限检查（Hook 方法） ==========
            // 课程教师：允许提交"当前课程归属"的 hidden 题目
            $allow_submit_hidden = $this->checkCourseProblemSubmitPermission(intval($problem['problem_id']));
            // ========== EXP 模式 Hook 结束 ==========
            
            if (!$allow_submit_hidden) {
                $this->error('Permission denied to submit this problem.', null, '', 1);
            }
        }
        // ========== ACM 模式结束 ==========
        $pid = intval(input('get.pid'));
        $this->assign([
            'problem' => $problem,
            'pagetitle' => 'Submit Problem ' . $problem['problem_id'] .':'. $problem['title'],
            'user_id' => session('user_id'),
            'allowLanguage' => config('CsgojConfig.OJ_LANGUAGE'),
        ]);
        return $this->fetch();
    }
    public function submit_ajax() {
        if(session('?lastsubmit')) {
            $now = time();
            $submitWaitTime = config('CsgojConfig.OJ_SUBMIT_WAIT_TIME');
            if($now - session('lastsubmit') < $submitWaitTime)
                $this->error("You should not submit more than twice in ".$submitWaitTime." seconds...");
        }
        $pid = trim(input('pid'));
        $ojLang = config('CsgojConfig.OJ_LANGUAGE');
        $language = intval(input('language'));
        if(!array_key_exists($language, $ojLang)) {
            $this->error('The submitted language is not allowed for this OnlineJudge.');
        }
        $source = input('source');
        if(!session('?user_id'))
        {
            $this->error('Please Login First!');
            return;
        }
        $problem = db('problem')->where(['problem_id'=>$pid])->find();
        if($problem == null)
        {
            //题目不存在
            $this->error('Problem not exist!');
            return;
        }
        // ========== ACM 模式：Hidden 题目提交控制 ==========
        if($problem['defunct'] != '0' && !IsAdmin('problem_editor') && !IsAdmin('contest_editor'))
        {
            $allow_submit_hidden = false;
            // ========== EXP 模式：课程教师权限检查（Hook 方法） ==========
            // 课程教师：允许提交"当前课程归属"的 hidden 题目
            $allow_submit_hidden = $this->checkCourseProblemSubmitPermission(intval($pid));
            // ========== EXP 模式 Hook 结束 ==========
            
            if(!$allow_submit_hidden) {
                $this->error('Permission denied to submit this problem.');
                return;
            }
        }
        // ========== ACM 模式结束 ==========
        $user_id = session('user_id');
        $code_length = strlen($source);
        if($code_length < 6)
        {
            $this->error('Code too short.');
            return;
        }
        else if($code_length > 65536)
        {
            $this->error('Code too long.');
            return;
        }
        // ========== ACM 模式：构建 solution 数据 ==========
        $solution_data = [
            'problem_id' => $pid,
            'user_id'    => $user_id,
            'in_date'    => Date('Y-m-d H:i:s'),
            'language'   => $language,
            'ip'         => request()->ip(),
            'code_length'=> $code_length
        ];
        
        // ========== EXP 模式：添加 course_id（Hook 方法） ==========
        // 公开题目：course_id 为 null（任何人都能提交）
        // Hidden 题目：course_id 为当前课程的 course_id（用于鉴权）
        $course_id = $this->getSolutionCourseId(intval($pid), $problem);
        if($course_id !== null) {
            $solution_data['course_id'] = $course_id;
        }
        // ========== EXP 模式 Hook 结束 ==========
        // ========== ACM 模式结束 ==========
        
        // 插入 solution 数据
        $solution_id = db('solution')->insertGetId($solution_data);
        if(!$solution_id) {
            $this->error('Failed to insert solution data.');
            return;
        }
        
        // 插入源代码
        $sourceInsertResult = db('source_code')->insert([
            'solution_id' => $solution_id,
            'source'      => $source
        ]);
        if(!$sourceInsertResult) {
            // 如果源代码插入失败，删除已插入的 solution 记录
            db('solution')->where('solution_id', $solution_id)->delete();
            $this->error('Failed to insert source code.');
            return;
        }
        
        session('lastsubmit', time());
        $this->success(
            'Submit successful! <br/>Redirecting to Status.',
            '',
            ['solution_id' => $solution_id, 'user_id' => $user_id]
        );
    }

    public function summary()
    {
        $problem = $this->GetProblem();
        $problem['problem_id_show'] = $problem['problem_id'];
        if($problem == null)
            $this->error('No such problem.', null, 1);
        $Solution = db('solution');
        $map = [
            'problem_id' => $problem['problem_id'],
        ];

        $ojResultsHtml = config('CsgojConfig.OJ_RESULTS_HTML');
        $statistic = [
            'total_submissions'    =>
                $Solution->where($map)->where(function($query){
                    $query->whereNull('contest_id')
                        ->whereOr('contest_id', 0);
                })->count(),
            'users_submitted'    =>
                $Solution
                    ->where($map)
                    ->where(function($query){
                        $query->whereNull('contest_id')
                            ->whereOr('contest_id', 0);
                    })
                    ->count('DISTINCT user_id'),
            'users_solved'        =>
                $Solution
                    ->where($map)
                    ->where(function($query){
                        $query->whereNull('contest_id')
                            ->whereOr('contest_id', 0);
                    })
                    ->where('result', 4)
                    ->count('DISTINCT user_id'),
        ];

        foreach($ojResultsHtml as $key=>$value)
        {
            if($key == 13)
                break;
            $statistic[$key] = $Solution
                ->where($map)
                ->where(function($query){
                    $query->whereNull('contest_id')
                        ->whereOr('contest_id', 0);
                })
                ->where('result', $key)
                ->count();
        }
        $this->assign([
            'problem'         => $problem,
            'statistic'        => $statistic,
            'pagetitle'     => $problem['problem_id'] .':'. $problem['title'],
            'ojResultsHtml' => $ojResultsHtml,
            'allowLanguage'    => config('CsgojConfig.OJ_LANGUAGE'),
        ]);
        return $this->fetch();
    }
    private function GetSolutionScoreStr($oderType)
    {
        $scoreConf = [
            'time'             => '000000',
            'memory'         => '00000000',
            'code_length'     => '00000',
            'solution_id'     => '00000',
        ];
        $retQuery = 'CONCAT(';
        $firstFlag = true;
        foreach($oderType as $key=>$value)
        {
            if(!$firstFlag)
                $retQuery .= ", ";
            $retQuery .= "RIGHT(CONCAT('" . $scoreConf[$key] . "', " . ($value == 'asc' ? "" : "1" . $scoreConf[$key] . " - 1 - ") . $key . "), " . strlen($scoreConf[$key]) .")";
            $firstFlag = false;
        }
        $retQuery .= ")";
        return $retQuery;
    }
    public function summary_ajax()
    {
        $pid = input('pid', -1);
        $offset = intval(input('offset'));
        $limit = 20; //intval(input('limit'));
        $sort = input('sort', 'time');
        $orderConfig = ['time', 'memory', 'code_length', 'solution_id'];
        $sort = validate_item_range($sort, $orderConfig);
        $order = input('order', 'asc');
        $language = input('language');

        //在前台设置的排序列优先之后，剩下的内容按优先顺序做次级排序
        $orderType = [$sort => $order];
        foreach($orderConfig as $oc)
        {
            if($oc != $sort)
                $orderType[$oc] = 'asc';
        }
        $scoreQuery = $this->GetSolutionScoreStr($orderType);
        $map = ['problem_id' => $pid, 'result' => 4];
        if($language != null && $language != -1) {
            $map['language'] = $language;
        }
        $Solution = db('solution');
        
        // ========== ACM 模式：构建查询对象 ==========
        // 第一步：找出每个用户的最佳 score（用于排序和分页）
        $userDistinctQuery = $Solution->where($map);
        // 对于非管理员，外部status不显示contest里的提交
        if(!IsAdmin()) {
            $userDistinctQuery = $userDistinctQuery->where(function($query){
                $query->whereNull('contest_id')
                    ->whereOr('contest_id', 0);
            });
        }
        // ========== EXP 模式：应用课程筛选（Hook 方法） ==========
        $this->applyCourseFilterToSolutionQuery($userDistinctQuery);
        // ========== EXP 模式 Hook 结束 ==========
        $userDistinct = $userDistinctQuery
            ->field(['user_id', 'count(*) acnum', 'MIN(' . $scoreQuery . ') score'])
            ->group('user_id')
            ->order('score')
            ->limit($offset, $limit)
            ->buildSql();
        
        // 第二步：找出所有符合条件的 solution（通过 JOIN 条件匹配每个用户的最佳提交）
        $solutionInfoQuery = db('solution')
            ->field(['solution_id', 'user_id', 'memory', 'time', 'language', 'code_length', 'in_date', $scoreQuery . ' score'])
            ->where($map);
        // 对于非管理员，外部status不显示contest里的提交
        if(!IsAdmin()) {
            $solutionInfoQuery = $solutionInfoQuery->where(function($query){
                $query->whereNull('contest_id')
                    ->whereOr('contest_id', 0);
            });
        }
        // ========== EXP 模式：应用课程筛选（Hook 方法） ==========
        $this->applyCourseFilterToSolutionQuery($solutionInfoQuery);
        // ========== EXP 模式 Hook 结束 ==========
        $solutionInfo = $solutionInfoQuery->buildSql();
        
        // 第三步：JOIN 两个子查询，获取分页后的用户及其最佳提交
        $solutionList = db()->table([$userDistinct => 'ud'])
            ->join([$solutionInfo => 's'], 'ud.user_id = s.user_id AND ud.score = s.score', 'inner')
            ->field([
                's.solution_id solution_id',
                's.user_id user_id',
                's.memory memory',
                's.time time',
                's.language language',
                's.code_length code_length',
                's.in_date in_date',
                'ud.acnum acnum'
            ])
            ->select();

        // 确保 $solutionList 是数组
        if (!is_array($solutionList)) {
            $solutionList = [];
        }

        $allowLanguage = config('CsgojConfig.OJ_LANGUAGE');
        $i = 1;
        foreach($solutionList as &$solution)
        {
            $solution['rank'] = $offset + $i;
            $i ++;
            if(array_key_exists($solution['language'], $allowLanguage))
                $solution['language'] = $allowLanguage[$solution['language']];
            else
                $solution['language'] = 'unknown';
            // 保存原始 solution_id 和 user_id，由前端 formatter 处理
            // solution_id 和 user_id 保持原始值，不生成 HTML
        }
        // ========== ACM 模式：计算总数 ==========
        // 重新创建查询对象计算 total，避免之前的查询状态影响
        // 与 status_ajax 保持一致的过滤规则
        $totalCountQuery = db('solution')->where($map);
        if(IsAdmin()) {
            // 管理员可以看到所有提交
        } else {
            // 非管理员只能看到非比赛提交
            $totalCountQuery->where(function($query){
                $query->whereNull('contest_id')
                    ->whereOr('contest_id', 0);
            });
        }
        // ========== EXP 模式：应用课程筛选（Hook 方法） ==========
        $this->applyCourseFilterToSolutionQuery($totalCountQuery);
        // ========== EXP 模式 Hook 结束 ==========
        // ========== ACM 模式结束 ==========
        $totalCount = $totalCountQuery->count('DISTINCT user_id');
        
        return [
            'rows' => $solutionList,
            'total' => $totalCount
        ];
    }
}
