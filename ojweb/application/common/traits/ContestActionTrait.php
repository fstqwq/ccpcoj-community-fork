<?php
/**
 * 比赛系统 Action Trait
 * 提供所有比赛相关的 action 方法（小写字母开头）
 * 用于 csgoj、cpcsys、expsys、examsys 等模块的 Contest 控制器
 * 
 * 注意：此 trait 只包含 action 方法（ThinkPHP 路由方法）
 * 常规方法（大写字母开头）应在 ContestBaseTrait 或其他 trait 中定义
 */
namespace app\common\traits;

use app\common\cross_module\contestlive\ContestliveDisplayAccess;
use app\common\cross_module\contestlive\ContestliveDisplayAddition;
use app\common\funcs\CcpcRules;

trait ContestActionTrait
{
    use StatusAjaxTrait;
    use TestdataFileTrait;
    // ========== 比赛列表相关 Action ==========
    
    /**
     * 比赛列表首页
     */
    public function index()
    {
        return $this->fetch();
    }
    
    /**
     * 比赛详情页
     */
    public function contest()
    {
        // 比赛首页
        return $this->fetch();
    }
    
    /**
     * 比赛认证（密码验证）
     * 使用钩子方法统一权限管理
     */
    public function contest_auth_ajax()
    {
        if (!$this->contest_user)
            $this->error('Please login first');
        $contest_pass = trim(input('contest_pass'));
        if ($contest_pass == $this->contest['password']) {
            $this->assertContestNotArchivedForWrite();
            // 使用钩子方法添加权限（pvrole='' 表示参与者）
            $user_id = session('user_id');
            $contest_id = $this->contest['contest_id'];
            
            // 检查是否可以添加（子类可重载实现特殊逻辑）
            if (method_exists($this, 'canAddContestUser') && !$this->canAddContestUser($contest_id)) {
                $this->error('No permission to join this contest');
            }
            
            // 使用钩子方法添加权限
            if (method_exists($this, 'addContestUserPrivilege')) {
                $this->addContestUserPrivilege($user_id, $contest_id, '');
            } else {
                // 兼容旧代码：直接插入（如果没有钩子方法）
                $map = [
                    'user_id' => $user_id,
                    'rightitem' => 'contest',
                    'item_id' => $contest_id,
                    'pvrole' => '',
                    'defunct' => '0'
                ];
                $privilege = db('privilege_item')->where($map)->find();
                if($privilege == null) {
                    db('privilege_item')->insert($map);
                }
            }
            
            $this->success('Verification passed', null, ['redirect_url' => "/" . $this->module . "/" . $this->controller . "/problemset?cid=" . $contest_id]);
        } else
            $this->error('Wrong password');
    }
    
    /**
     * 比赛列表数据
     */
    public function contest_list_ajax()
    {
        //暂时bootstrap-table的pagination改为client side，即server直接返回所有比赛
        $columns = ["contest_id", "title", "start_time", "end_time", "defunct", "private", "langmask", "password", "topteam", "award_ratio", "frozen_minute", "frozen_after", "flg_archive"];
        $search = trim(input('search/s'));

        // TP5.1：避免 where($map) 中混入 ['like', ...] 这类 TP5.0 风格数组条件（易被 Builder 误判为 IN）
        $map = ['defunct' => '0'];
        $ret = [];
        // 修复 ThinkPHP 5.1 IN 查询：将 IN 查询改为链式调用，避免数组格式解析错误
        // 注意：每次独立调用 db('contest')，避免状态累积
        $query = db('contest');
        if ($this->module == 'ojtool') {
            // nothing
        } else if ($this->module == 'cpcsys') {
            $query = $query->where('private', 'in', [2, 12]);
        } else {
            $query = $query->where('private', 'in', [0, 1, 10, 11]);
        }
        if (strlen($search) > 0) {
            $kw = "%$search%";
            $query = $query->where(function($q) use ($kw) {
                $q->where('contest_id', 'like', $kw)
                  ->whereOr('title', 'like', $kw);
            });
        }
        $contestList = $query
            ->where($map)
            ->order(['contest_id' => 'desc'])
            ->field($columns)
            ->select();
        foreach ($contestList as &$contest) {
            $contest['status']  =  $this->ContestStatus($contest);
            $contest['kind']    =  $this->ContestType($contest);
            $contest['has_pass'] = strlen(trim($contest['password'])) > 0;
            $contest['password'] = "";  // 隐藏密码
        }
        return $contestList;
    }
    
    // ========== 题目集相关 Action ==========
    
    /**
     * 题目集页面
     */
    public function problemset()
    {
        if (isset($this->isContestStaff) && $this->isContestStaff && !$this->isContestAdmin && !$this->proctorAdmin) {
            $this->redirect('/' . $this->module . '/' . $this->controller . '/contest?cid=' . $this->contest['contest_id']);
        }
        return $this->fetch();
    }
    
    /**
     * 题目集列表数据
     */
    public function problemset_ajax()
    {
        $summary_map = ['result' => 4, 'contest_id' => $this->contest['contest_id']];
        if ($this->rankFrozen) {
            // 如果不是比赛管理员，则统计ac数要按封榜时间
            $closeRankTimeStr = date('Y-m-d H:i:s', $this->closeRankTime);
            $summary_map['in_date'] = ['<', $closeRankTimeStr];
        }
        $contestProblemSql = db('contest_problem')->alias('cp')
            ->join('problem p', 'p.problem_id = cp.problem_id', 'left')
            ->where('cp.contest_id', $this->contest['contest_id'])
            ->field([
                'p.problem_id problem_id',
                'p.title title',
                'p.spj spj',
                'cp.num num',
                'cp.pscore pscore',
                'cp.title color'    // 不改数据库了，暂时用这个字段
            ])
            ->buildSql();
        $acSql = db('solution')
            ->field(['problem_id', 'count(1) accepted'])
            ->where($summary_map)
            ->group('problem_id')
            ->buildSql();
        $submitSql = db('solution')
            ->field(['problem_id', 'count(1) submit'])
            ->where(['contest_id' => $this->contest['contest_id']])
            ->group('problem_id')
            ->buildSql();
        $problemList = db()->table([$contestProblemSql => 'p'])
            ->join($acSql . ' a', 'p.problem_id = a.problem_id', 'left')
            ->join($submitSql . ' s', 'p.problem_id = s.problem_id', 'left')
            ->order('p.num', 'asc')
            ->field([
                'p.problem_id problem_id',
                'p.title title',
                'p.num num',
                'p.color color',
                'p.pscore pscore',
                'p.spj spj',
                'a.accepted accepted',
                's.submit submit'
            ])
            ->cache(20)
            ->select();

        // 与 ContestBaseTrait::ProblemIdMap、Contestsummary::SynScore 一致：private 十位为 1 表示「最后一题为附加题」
        $attach_extra_enabled = isset($this->contest['private']) && intdiv((int)$this->contest['private'], 10) === 1;
        $maxContestNum = null;
        foreach ($problemList as $pRow) {
            if ($pRow['problem_id'] == null) {
                continue;
            }
            $n = (int)$pRow['num'];
            if ($maxContestNum === null || $n > $maxContestNum) {
                $maxContestNum = $n;
            }
        }

        $solutionStatus = [];
        if ($this->contest_user) {
            $user_id = $this->SolutionUser($this->contest_user, true);
            $Solution = db('solution');
            //$solutionNormal指任意提交，$solutionAC只取AC了的提交，$solutionStatus标记哪些题过了哪些题没过，因为需要标记 没交、交了、AC了三种状态
            $solutionNormal = $Solution->where(['user_id' => $user_id, 'contest_id' => $this->contest['contest_id']])->field('problem_id')->group('problem_id')->select();
            $solutionAc = $Solution->where(['user_id' => $user_id, 'result' => 4, 'contest_id' => $this->contest['contest_id']])->field('problem_id')->group('problem_id')->select();
            foreach ($solutionNormal as $res) {
                $solutionStatus[$res['problem_id']] = '0';
            }
            foreach ($solutionAc as $res) {
                $solutionStatus[$res['problem_id']] = '1';
            }
        }
        $retList = [];
        foreach ($problemList as $problem) {
            if ($problem['problem_id'] == null) {
                //管理员弄错了题号，这里没有搜到这道题的情况下（多表联查，contest题目表left join problem，可能有problem不存在，虽然contest add时验证过）
                continue;
            }

            if ($this->contestStatus < 2 && !$this->IsContestAdmin()) {
                $problem['problem_id_show'] = $this->problemIdMap['id2abc'][$problem['problem_id']];
            } else {
                $problem['problem_id_show'] = $this->problemIdMap['id2abc'][$problem['problem_id']] . '(' . $problem['problem_id'] . ')';
            }
            if (CcpcRules::enabled($this->contest) && !$this->IsContestAdmin()) {
                $problem['color'] = '';
                $problem['accepted'] = '-';
                $problem['submit'] = '-';
            }
            $problem['ac'] = "";
            if (array_key_exists($problem['problem_id'], $solutionStatus))
                $problem['ac'] = $solutionStatus[$problem['problem_id']] == '0' ? "<span class='text-warning'>N</span>" : "<span class='text-success'>Y</span>";
            if ($problem['accepted'] == null)
                $problem['accepted'] = 0;
            if ($problem['submit'] == null)
                $problem['submit'] = 0;
            $problem['is_contest_attach_problem'] = ($attach_extra_enabled && $maxContestNum !== null && (int)$problem['num'] === $maxContestNum) ? 1 : 0;
            $retList[] = $problem;
        }
        return $retList;
    }
    
    // ========== 题目相关 Action ==========
    
    /**
     * 题目详情页
     */
    public function problem()
    {
        if (isset($this->isContestWorker) && $this->isContestWorker && !$this->isContestAdmin) {
            $this->error("No permission", '/' . $this->module . '/contest?cid=' . $this->contest['contest_id'], '', 1);
        }
        $summary_map = ['result' => 4, 'contest_id' => $this->contest['contest_id']];
        if ($this->rankFrozen) {
            // 如果不是比赛管理员，则统计ac数要按封榜时间
            $closeRankTimeStr = date('Y-m-d H:i:s', $this->closeRankTime);
            $summary_map['in_date'] = ['<', $closeRankTimeStr];
        }
        $apid = trim(input('get.pid'));
        $problem_id = $this->problemIdMap['abc2id'][$apid];

        $contestProblemSql = db('contest_problem')->alias('cp')
            ->join('problem p', 'p.problem_id = cp.problem_id', 'left')
            ->where('cp.contest_id', $this->contest['contest_id'])
            ->field([
                'p.problem_id problem_id',
                'p.title title',
                'p.description description',
                'p.input input',
                'p.output output',
                'p.sample_input sample_input',
                'p.sample_output sample_output',
                'p.spj spj',
                'p.hint hint',
                'p.source source',
                'p.author author',
                'p.time_limit time_limit',
                'p.memory_limit memory_limit',
                'p.attach attach',
                'cp.num num',
                'cp.pscore pscore'
            ])
            ->buildSql();
        $acSql = db('solution')
            ->field(['problem_id', 'count(1) accepted'])
            ->where($summary_map)
            ->group('problem_id')
            ->buildSql();
        $submitSql = db('solution')
            ->field(['problem_id', 'count(1) submit'])
            ->where(['contest_id' => $this->contest['contest_id']])
            ->group('problem_id')
            ->buildSql();
        $problem = db()->table([$contestProblemSql => 'p'])
            ->join($acSql . ' a', 'p.problem_id = a.problem_id', 'left')
            ->join($submitSql . ' s', 'p.problem_id = s.problem_id', 'left')
            ->order('p.num', 'asc')
            ->where(['p.problem_id' => $problem_id])
            ->field([
                'p.problem_id problem_id',
                'p.title title',
                'p.description description',
                'p.input input',
                'p.output output',
                'p.sample_input sample_input',
                'p.sample_output sample_output',
                'p.spj spj',
                'p.hint hint',
                'p.source source',
                'p.author author',
                'p.time_limit time_limit',
                'p.memory_limit memory_limit',
                'p.attach attach',
                'p.num num',
                'a.accepted accepted',
                's.submit submit',
                'p.pscore pscore'
            ])
            ->find();
        if ($problem == null) {
            $this->error('No such problem.', null, '', 1);
        }
        if ($problem['submit'] === null)
            $problem['submit'] = 0;
        if ($problem['accepted'] === null)
            $problem['accepted'] = 0;

        // CCPC 2026 reveal rule: hide per-problem submit/accepted stats from
        // non-referee viewers while the problem is below the reveal threshold,
        // so the problem page cannot leak scoreboard-hidden progress.
        if (CcpcRulesEnabled($this->contest) && !$this->IsContestAdmin() && $this->contestStatus != 2) {
            $ccpcTeams = db('cpc_team')->where('contest_id', $this->contest['contest_id'])->count();
            $ccpcThreshold = CcpcRulesThreshold((int)$ccpcTeams, (string)($this->contest['ccpc_reveal_policy'] ?? 'min_50_20'));
            $ccpcAcTeams = db('solution')->where([
                'contest_id' => $this->contest['contest_id'],
                'problem_id' => $problem_id,
                'result'     => 4,
            ])->group('user_id')->count();
            if ($ccpcAcTeams < $ccpcThreshold) {
                $problem['submit'] = 0;
                $problem['accepted'] = 0;
            }
        }
        $problem['problem_id_show'] = $apid;
        if ($this->contestStatus == 2 || $this->IsContestAdmin())
            $problem['show_real_id'] = true;
        $problem['pagetitle'] = $apid . ': ' . $problem['title'];
        $lang = trim(input('get.lang/s', ''));
        $mod = strtolower($this->request->module());
        $ctrl = strtolower(\think\Loader::parseName($this->request->controller()));
        $pdfBase = '/' . $mod . '/' . $ctrl . '/problem_pdf';
        $pdfQ = ['cid' => $this->contest['contest_id'], 'pid' => $apid];
        $vs = problem_locale_view_state($problem, null, $lang, $pdfBase, $pdfQ, $pdfQ);
        $this->assign([
            'contest'               => $this->contest,
            'problem'               => $vs['problem'],
            'apid'                  => $apid,
            'desc_display_mode'     => $vs['desc_display_mode'],
            'problem_pdf_embed_url' => $vs['pdf_url'],
            'available_locales'     => $vs['available_locales'],
            'current_locale_key'    => $vs['current_locale_key'],
            'show_lang_bar'         => $vs['show_lang_bar'],
        ]);
        return $this->fetch();
    }

    /**
     * 比赛内题面 PDF（与 problem 可见性一致）
     */
    public function problem_pdf()
    {
        if (isset($this->isContestWorker) && $this->isContestWorker && !$this->isContestAdmin) {
            $this->error("No permission", '/' . $this->module . '/contest?cid=' . $this->contest['contest_id'], '', 1);
        }
        $cid = intval(input('get.cid', 0));
        if ($cid !== (int) $this->contest['contest_id']) {
            $this->error('Invalid contest.', null, '', 1);
        }
        $apid = trim(input('get.pid'));
        if (!isset($this->problemIdMap['abc2id'][$apid])) {
            $this->error('No such problem.', null, '', 1);
        }
        $problem_id = $this->problemIdMap['abc2id'][$apid];
        $problem = db('problem')->where('problem_id', $problem_id)->field(['problem_id', 'attach'])->find();
        if ($problem == null) {
            $this->error('No such problem.', null, '', 1);
        }
        $inContest = db('contest_problem')
            ->where(['contest_id' => $this->contest['contest_id'], 'problem_id' => $problem_id])
            ->count() > 0;
        if (!$inContest) {
            $this->error('No such problem.', null, '', 1);
        }
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
    
    /**
     * 提交代码页面
     */
    public function submit()
    {
        if (!$this->contest_user) {
            $this->error('Please login before submit problem solution!', null, '', 1);
        }
        $this->assertContestNotArchivedForWrite();
        // standard 类型：仅按比赛内账号身份拒绝 staff，不认系统权限
        if (isset($this->contest['private']) && ($this->contest['private'] % 10) === 2 && !empty($this->isContestAccountStaff)) {
            $this->error('Contest staff cannot submit. Please login with a contest team account.');
        }
        if ($this->contestStatus == -1)
            $this->error('Not started.');
        if ($this->contestStatus == 2)
            $this->error('Contest Ended.', null, '', 1);

        $apid = trim(input('get.pid')); //这里传入的是ABCD的题号
        $this->assign([
            'cid'         => $this->contest['contest_id'],
            'apid'         => $apid,
            'pagetitle' => 'Submit Problem ' . $apid,
            'user_id'     => $this->contest_user
        ]);
        return $this->fetch();
    }
    
    /**
     * 提交代码处理
     */
    public function submit_ajax()
    {
        if (!$this->contest_user) {
            $this->error('Please Login First!');
        }
        $this->assertContestNotArchivedForWrite();
        // standard 类型：仅按比赛内账号身份拒绝 staff 提交，不认系统权限（避免大管理员用选手账号被拒）
        if (isset($this->contest['private']) && ($this->contest['private'] % 10) === 2 && !empty($this->isContestAccountStaff)) {
            $this->error('Contest staff cannot submit. Please login with a contest team account.');
        }
        if (session('?lastsubmit')) {
            $now = time();
            $submitWaitTime = config('CsgojConfig.OJ_SUBMIT_WAIT_TIME');
            if ($now - session('lastsubmit') < $submitWaitTime)
                $this->error("You should not submit more than twice in " . $submitWaitTime . " seconds...");
        }
        $apid = trim(input('pid')); //ABCD
        if (!array_key_exists($apid, $this->problemIdMap['abc2id']))
            $this->error('No such problem!');
        $problem_id = $this->problemIdMap['abc2id'][$apid];
        $language = intval(input('language'));
        if (!array_key_exists($language, $this->allowLanguage))
            $this->error('The submitted language is not allowed for this contest');
        $source = input('source');
        $now = time();

        if ($this->contestStatus == -1)
            $this->error('Contest Not started');
        if ($this->contestStatus == 2)
            $this->error('Contest Ended');
        $problem = db('problem')->where(['problem_id' => $problem_id])->find();
        if (!$problem) {
            //题目不存在
            $this->error('No such problem!');
        }
        $user_id = $this->contest_user;
        $code_length = strlen($source);
        if ($code_length < 6) {
            $this->error('Code too short.');
        } else if ($code_length > 65536) {
            $this->error('Code too long.');
        }
        
        // ========== 耦合 expsys/examsys 逻辑（必须） ==========
        // EXP 模式：获取 course_id 并检查权限（与 ACMOJ 逻辑解耦）
        // Contest 提交：使用 contest 所属的 course_id，而不是 now_course_id
        $course_id = null;
        if(isset($this->OJ_STATUS) && $this->OJ_STATUS == 'exp') {
            // Contest 提交：从 contest 获取 course_id
            $contest_course_id = $this->GetContestCourseId($this->contest['contest_id']);
            if($contest_course_id) {
                $course_id = $contest_course_id;
            }
            
            // 如果获取到 course_id，检查权限
            if($course_id && !$this->CheckCourseProblemSubmitPermission($course_id, $problem_id)) {
                $this->error('Permission denied: This problem does not belong to the contest\'s course.');
            }
        }
        // ========== 耦合 expsys/examsys 逻辑结束 ==========
        
        $solution_data = [
            'problem_id' => $problem_id,
            'user_id'    => $this->SolutionUser($user_id, true),
            'in_date'    => date('Y-m-d H:i:s'),
            'language'   => $language,
            'ip'         => request()->ip(),
            'code_length' => $code_length,
            'contest_id' => $this->contest['contest_id']
        ];
        
        // ========== 耦合 expsys/examsys 逻辑（必须：course_id 添加） ==========
        // EXP 模式：添加 course_id（与 ACMOJ 逻辑解耦）
        if($course_id !== null) {
            $solution_data['course_id'] = $course_id;
        }
        // ========== 耦合 expsys/examsys 逻辑结束 ==========
        
        $solution_id = db('solution')->insertGetId($solution_data);
        if (!$solution_id) {
            $this->error('Failed to insert solution data.');
        }
        $sourceInsertResult = db('source_code')->insert([
            'solution_id' => $solution_id,
            'source'      => $source
        ]);
        if (!$sourceInsertResult) {
            db('solution')->where('solution_id', $solution_id)->delete();
            $this->error('Failed to insert source code.');
        }
        session('lastsubmit', time());
        $this->success(
            'Submit successful! <br/>Redirecting to Status.',
            '',
            ['solution_id' => $solution_id, 'user_id' => $user_id, 'contest_id' => $this->contest['contest_id']]
        );
    }
    
    /**
     * 获取比赛描述 Markdown 内容（比赛说明/考试说明/练习说明）
     */
    public function description_md_ajax() {
        if (!$this->IsContestAdmin('admin')) {
            $this->error('Permission denied to get contest description markdown contents');
        }
        $contest_md = db('contest_md')->where('contest_id', $this->contest['contest_id'])->find();
        if ($contest_md && isset($contest_md['description']))
            $description = $contest_md['description'];
        else
            $description = $this->contest['description'] ?? '';
        $this->success('OK', null, $description);
    }
    
    /**
     * 修改比赛描述 Markdown 内容（比赛说明/考试说明/练习说明）
     */
    public function description_change_ajax() {
        if (!$this->IsContestAdmin('admin')) {
            $this->error('Permission denied to change contest description markdown contents');
        }
        $this->assertContestNotArchivedForWrite();
        $description_md = input('description_md/s', '');
        if (strlen($description_md) > 16384)
            $this->error('Description too long');
        db('contest_md')->where('contest_id', $this->contest['contest_id'])->setField('description', $description_md);
        $description = ParseMarkdown($description_md);
        db('contest')->where('contest_id', $this->contest['contest_id'])->setField('description', $description);
        $this->success('Description updated', null, $description);
    }
    
    /**
     * 获取比赛公告 Markdown 内容
     */
    public function notification_md_ajax() {
        if (!$this->IsContestAdmin('admin')) {
            $this->error('Permission denied to get contest notification markdown contents');
        }
        $contest_md = db('contest_md')->where('contest_id', $this->contest['contest_id'])->find();
        if ($contest_md && isset($contest_md['notification']))
            $notification = $contest_md['notification'];
        else
            $notification = $this->contest['notification'] ?? '';
        $this->success('OK', null, $notification);
    }
    
    /**
     * 修改比赛公告 Markdown 内容
     */
    public function notification_change_ajax() {
        if (!$this->IsContestAdmin('admin')) {
            $this->error('permission_denied');
        }
        $this->assertContestNotArchivedForWrite();
        $notification_md = input('notification_md/s', '');
        if (strlen($notification_md) > 16384)
            $this->error('too_long');
        db('contest_md')->where('contest_id', $this->contest['contest_id'])->setField('notification', $notification_md);
        $notification = ParseMarkdown($notification_md);
        db('contest')->where('contest_id', $this->contest['contest_id'])->setField('notification', $notification);
        $this->success('success', null, $notification);
    }
    
    // ========== 测试数据相关 Action ==========
    
    /**
     * 测试数据列表页
     */
    public function testdata()
    {
        $apid = trim(input('get.pid'));
        $problem = $this->GetProblem($apid);
        // 从课程配置获取下载等待时间（如果可用），否则从默认配置获取
        if (isset($this->OJ_TEST_DOWNLOAD_WAIT_TIME)) {
            $downloadWaitTime = $this->OJ_TEST_DOWNLOAD_WAIT_TIME;
        } else {
            $cfgAll = config('CourseDefaultConfig.');
            $defaultConfig = (is_array($cfgAll) && isset($cfgAll['config']) && is_array($cfgAll['config'])) ? $cfgAll['config'] : [];
            $downloadWaitTime = $defaultConfig['OJ_TEST_DOWNLOAD_WAIT_TIME'] ?? 60;
        }
        $this->assign([
            'contest' => $this->contest,
            'problem' => $problem,
            'apid' => $problem['problem_id_show'],
            'downloadWaitTime' => $downloadWaitTime
        ]);
        return $this->fetch();
    }
    
    /**
     * 测试数据列表数据
     */
    public function testdata_ajax()
    {
        $apid = trim(input('get.pid'));
        $problem = $this->GetProblem($apid);
        $testdataPath = config('OjPath.testdata');
        if (!$testdataPath || empty($testdataPath)) {
            $this->error('OjPath.testdata configuration is missing.');
        }
        $dataPath = $testdataPath . '/' . $problem['problem_id'];
        
        // 检查目录是否存在
        if (!is_dir($dataPath)) {
            // 如果目录不存在，返回空列表而不是错误（允许题目没有测试数据）
            return [];
        }
        
        $filelist = GetDir($dataPath, ['in', 'out']);
        return $filelist;
    }
    
    /**
     * 测试数据下载
     */
    public function testdata_download()
    {
        // ========== 耦合 expsys/examsys 逻辑（必须：测试数据下载权限） ==========
        // 权限检查：OJ_STATUS 必须是 'exp'，且（允许下载 或 是管理员）
        if ($this->OJ_STATUS != 'exp' || (!$this->ALLOW_TEST_DOWNLOAD && !IsAdmin())) {
            // 强制返回 JSON 响应（用于 fetch 请求）
            header('Content-Type: application/json; charset=utf-8');
            echo json_encode(['code' => 0, 'msg' => 'No permission to download data'], JSON_UNESCAPED_UNICODE);
            exit;
        }
        // 辅助函数：返回 JSON 错误响应
        $returnJsonError = function($msg) {
            header('Content-Type: application/json; charset=utf-8');
            echo json_encode(['code' => 0, 'msg' => $msg], JSON_UNESCAPED_UNICODE);
            exit;
        };
        
        $downNum = session('?last_test_download_num') ? session('last_test_download_num') : 0;
        if (!IsAdmin()) {
            if (session('?last_test_download_time')) {
                $now = time();
                // 从课程配置获取下载等待时间（如果可用），否则从默认配置获取
                // 注意：配置值单位是分钟，需要转换为秒
                if (isset($this->OJ_TEST_DOWNLOAD_WAIT_TIME)) {
                    $downloadWaitTime = $this->OJ_TEST_DOWNLOAD_WAIT_TIME * 60; // 转换为秒
                } else {
                    $cfgAll = config('CourseDefaultConfig.');
                    $defaultConfig = (is_array($cfgAll) && isset($cfgAll['config']) && is_array($cfgAll['config'])) ? $cfgAll['config'] : [];
                    $downloadWaitTime = ($defaultConfig['OJ_TEST_DOWNLOAD_WAIT_TIME'] ?? 60) * 60; // 转换为秒
                }
                if ($downNum >= 2 && $now - session('last_test_download_time') < $downloadWaitTime) {
                    $returnJsonError("Don't download test data too frequently.");
                }
                if ($now - session('last_test_download_time') > $downloadWaitTime) {
                    $downNum = 0;
                }
                $downNum++;
            } else {
                $downNum = 1;
            }
        }
        $apid = trim(input('get.pid'));
        $problem = $this->GetProblem($apid);
        $filename = input('get.filename');

        if (strpos($filename, '..') !== false || !preg_match('/^[A-Za-z0-9._()-]+$/i', $filename) || !in_array(pathinfo($filename, PATHINFO_EXTENSION), ['in', 'out'])) {
            // 防止传入目录级参数，非法读取父级目录
            $returnJsonError("Not a valid filename.");
        }
        $testdataPath = config('OjPath.testdata');
        if (!$testdataPath || empty($testdataPath)) {
            $returnJsonError('OjPath.testdata configuration is missing.');
        }
        $dataPath = $testdataPath . '/' . $problem['problem_id'];
        
        // 检查目录是否存在
        if (!is_dir($dataPath)) {
            $returnJsonError('Test data directory does not exist.');
        }
        
        // 检查文件是否存在
        $filepath = $dataPath . '/' . $filename;
        if (!file_exists($filepath)) {
            $returnJsonError('File not found: ' . $filename);
        }
        
        // 检查文件是否可读
        if (!is_readable($filepath)) {
            $returnJsonError('File is not readable (permission denied): ' . $filename);
        }
        
        // 检查文件大小（如果无法读取文件大小，可能是权限问题）
        $filesize = @filesize($filepath);
        if ($filesize === false) {
            $returnJsonError('Cannot read file size (permission denied): ' . $filename);
        }

        session('last_test_download_time', time());
        session('last_test_download_num', $downNum);
        
        // 在输出 header 之前进行所有检查，确保可以返回 JSON 错误响应
        // 测试数据文件通常不大，不需要压缩，使用 compress=false 避免配置问题
        try {
            downloads($dataPath, $filename, $problem['problem_id'] . '_' . $filename, false);
            // downloads() 成功执行后会直接输出文件并 exit，不会执行到这里
        } catch (\Exception $e) {
            // 记录错误日志
            \think\facade\Log::error('Test data download error: ' . $e->getMessage(), [
                'filepath' => $filepath,
                'filename' => $filename,
                'problem_id' => $problem['problem_id'],
                'contest_id' => $this->contest['contest_id'] ?? 'N/A',
                'trace' => $e->getTraceAsString()
            ]);
            // 强制返回 JSON 错误响应
            $returnJsonError('Download failed: ' . $e->getMessage() . ' (File: ' . $filename . ')');
        } catch (\Error $e) {
            // 捕获 PHP 7+ 的 Error 异常
            \think\facade\Log::error('Test data download fatal error: ' . $e->getMessage(), [
                'filepath' => $filepath,
                'filename' => $filename,
                'problem_id' => $problem['problem_id'],
                'contest_id' => $this->contest['contest_id'] ?? 'N/A',
                'trace' => $e->getTraceAsString()
            ]);
            // 强制返回 JSON 错误响应
            $returnJsonError('Download failed: ' . $e->getMessage() . ' (File: ' . $filename . ')');
        }
    }
    
    // ========== 排行榜相关 Action ==========
    
    /**
     * 排行榜页面
     */
    public function rank() {
        // 为 status_table_modal 模板准备必要的变量（与 status() 方法保持一致）
        $data = [
            'user_id'               => $this->contest_user,
            'resdetail_authority'   => $this->IsContestAdmin(),
            'single_status_url'     => 'single_status_ajax',
            'show_code_url'         => 'showcode_ajax',
            'show_res_url'          => 'resdetail_ajax',
        ];
        $apiUrl = '/' . $this->module . '/contest/contest_data_ajax';
        $lvtk = input('lvtk/s', '');
        if ($lvtk !== '' && isset($this->contest['contest_id']) && ContestliveDisplayAccess::validateToken(intval($this->contest['contest_id']), $lvtk)) {
            $apiUrl .= '?lvtk=' . rawurlencode($lvtk);
        }
        $data['rank_contest_data_api_url'] = $apiUrl;
        $this->assign($data);
        return $this->fetch();
    }
    
    /**
     * 比赛数据 AJAX 接口（用于榜单）
     */
    public function contest_data_ajax(){
        // contest_data_ajax 在 outsideContestAction 中，需要自己获取比赛信息
        $cid = input('cid/d');
        if (!$cid) {
            $this->error('How did you find this page?', null, '', 1);
        }
        
        // 获取比赛元信息（不进行模块跳转检查，因为已经在正确的模块中）
        $meta = $this->GetContestMeta(intval($cid), true);
        if (!$meta || !isset($meta['contest'])) {
            $this->error("No such contest");
        }
        $this->contestMeta = $meta;
        $this->contest = $meta['contest'];
        
        // ========== 耦合 expsys/examsys 逻辑（必须：teamSessionName 设置） ==========
        // 初始化必要的变量
        // 对于 examsys/cpcsys 模块，需要设置 teamSessionName 以便 IsContestAdmin() 能正常工作
        // expsys 是基于系统用户的，不需要 teamSessionName
        if(in_array($this->module, ['examsys', 'cpcsys'])) {
            $this->teamSessionName = '#cpcteam' . $this->contest['contest_id'];
        }
        // ========== 耦合 expsys/examsys 逻辑结束 ==========
        
        // 初始化必要的变量（简化版）；封榜视角：flg_rank_not_admin 在 ContestStatus；榜单动态缓存见 contestRankDynamicUsesRankCache。
        $this->GetVars();
        
        $info_need = input('info_need/a');
        $min_solution_id = input('min_solution_id/d');
        $solution_result = input('solution_result/d');  // 查询特定结果类型
        $contest_data = $this->GetContestData4Rank([
            'info_need' => $info_need,
            'min_solution_id' => $min_solution_id,
            'solution_result' => $solution_result,
        ]);
        if (CcpcRules::enabled($this->contest)) {
            header('Cache-Control: private, no-store');
            if ($this->IsContestAdmin() && !$this->flgRankNotAdminRequest()) {
                [$problems, $teams, $solutions] = CcpcRules::normalize($contest_data);
                $contest_data['solution'] = array_map(function ($s) {
                    return [$s['solution_id'], $s['contest_id'], $s['problem_id'], $s['team_id'], $s['result'], $s['in_date']];
                }, CcpcRules::eligible($solutions, $this->contest, time()));
                $contest_data['contest']['frozen_minute'] = 60;
                $contest_data['ccpc_meta'] = ['view'=>'referee', 'frozen_show_all'=>true];
            } else {
                $contest_data = CcpcRules::project($contest_data, time(), (string)getenv('CCPC_HMAC_KEY'));
            }
        }
        // 响应里不下发大字段与敏感列（鉴权仍用上方完整 $this->contest）
        if (isset($contest_data['contest']) && is_array($contest_data['contest'])) {
            foreach (['notification', 'flg_archive', 'teachers', 'clss_id', 'description', 'password'] as $k) {
                unset($contest_data['contest'][$k]);
            }
        }
        $this->success("ok", null, $contest_data);
    }

    /**
     * 队伍面板：本队每题首次 AC 时间（真实结果，含封榜后）。
     * 走 ContestInit 常规链路（非 outsideContestAction）：须登录参赛队，由 ContestAuthentication + canViewProblems 约束。
     */
    public function my_solve_ajax()
    {
        if (!$this->contest_user) {
            $this->error('Please login first');
        }
        $contest_id = intval($this->contest['contest_id']);
        $user_id_db = $this->SolutionUser($this->contest_user, true);
        $rows = db('solution')->where([
            'contest_id' => $contest_id,
            'user_id' => $user_id_db,
            'result' => 4,
        ])->field('problem_id, min(in_date) as ac_date')->group('problem_id')->select();
        $ac = [];
        if ($rows && is_array($rows)) {
            foreach ($rows as $row) {
                $ac[strval($row['problem_id'])] = $row['ac_date'];
            }
        }
        $this->success('ok', null, [
            'ac' => $ac,
            'close_rank_time' => date('Y-m-d H:i:s', $this->closeRankTime),
        ]);
    }
    
    // ========== 提交状态相关 Action ==========
    
    /**
     * 提交状态页面
     */
    public function status()
    {
        $data = [
            'user_id'               => $this->contest_user,
            'resdetail_authority'   => $this->IsContestAdmin(),
            'search_problem_id'     => input('problem_id'),
            'search_user_id'        => input('user_id'),
            'search_solution_id'    => input('solution_id'),
            'single_status_url'     => 'single_status_ajax',
            'show_code_url'         => 'showcode_ajax',
            'show_res_url'          => 'resdetail_ajax',
            'search_result' => intval(input('result', -1)),
        ];
        $this->assign($data);
        return $this->fetch();
    }
    
    // 注意：CheckCourseProblemSubmitPermission() 和 GetContestCourseId() 方法已移至 ContestBaseTrait.php
    
    // ========== StatusAjaxTrait 钩子方法实现 ==========
    
    /**
     * 转换 problem_id（比赛内：字母转数字）
     */
    protected function convertStatusAjaxProblemId($problem_id)
    {
        if (array_key_exists($problem_id, $this->problemIdMap['abc2id'])) {
            return $this->problemIdMap['abc2id'][$problem_id];
        }
        return '';
    }
    
    /**
     * 转换 user_id（比赛内：需要转换格式）
     */
    protected function convertStatusAjaxUserId($user_id, $toDbFormat = true)
    {
        return $this->SolutionUser($user_id, $toDbFormat);
    }
    
    /**
     * 应用 result 筛选条件（比赛内：处理封榜逻辑）
     */
    protected function applyStatusAjaxResultFilter(&$map, $params)
    {
        // 如果已封榜，且搜索特定类型，则只返回封榜前内容
        if ($this->rankFrozen && ($params['user_id'] === null || $this->SolutionUser($params['user_id'], true) != $this->contest_user)) {
            $closeRankTimeStr = date('Y-m-d H:i:s', $this->closeRankTime);
            $map['in_date'] = ['<', $closeRankTimeStr];
        }
    }
    
    /**
     * 应用 contest_id 筛选条件（比赛内：固定 contest_id）
     */
    protected function applyStatusAjaxContestFilter(&$map)
    {
        $map['contest_id'] = $this->contest['contest_id'];
        if (CcpcRules::enabled($this->contest) && !$this->IsContestAdmin()) {
            // Other teams' submission IDs/timestamps would undo anonymous scoreboard cells.
            $map['user_id'] = $this->contest_user ? $this->SolutionUser($this->contest_user, true) : '__ccpc_no_team__';
        }
    }
    
    /**
     * 获取允许的语言列表（比赛内：使用比赛允许的语言）
     */
    protected function getStatusAjaxAllowedLanguages()
    {
        return $this->allowLanguage;
    }
    
    /**
     * 构建查询对象（比赛内：需要 JOIN 用户表）
     */
    protected function buildStatusAjaxQuery($Solution, $map, $columns, $needSolutionIdIn, $solutionIdInValues, $needLanguageIn, $languageInValues, $ordertype)
    {
        // ========== 耦合 expsys/examsys 逻辑（必须：用户表选择） ==========
        // 判断是否需要 join 用户信息表
        $contestType = $this->contest['private'] % 10;
        // examsys 模块的考试模式（private % 10 == 5）使用 cpc_team
        // 标准比赛模式（private % 10 == 2）也使用 cpc_team
        // 其他模式使用 users 表
        $needJoinCpcTeam = ($contestType == 2 || $contestType == 5 || $this->module == 'examsys');
        $needJoinUsers = !$needJoinCpcTeam; // 非 cpc_team 模式时 join users 表
        // ========== 耦合 expsys/examsys 逻辑结束 ==========
        
        $contest_id = $this->contest['contest_id'];
        $query = $Solution->alias('sl');
        
        if ($needJoinCpcTeam) {
            $query->join('cpc_team ct', "ct.team_id = sl.user_id AND ct.contest_id = {$contest_id}", 'left')
                ->field('sl.*, ct.name team_name');
        } else if ($needJoinUsers) {
            $query->join('users u', 'u.user_id = sl.user_id', 'left')
                ->field('sl.*, u.nick team_name');
        }
        
        // 设置基础 where 条件，明确指定表别名以避免歧义
        $query->where('sl.contest_id', $contest_id);
        
        // 逐个添加 where 条件，明确指定表别名
        $whereMap = $map;
        unset($whereMap['contest_id']); // 移除 contest_id，已单独处理
        
        if (isset($whereMap['problem_id'])) {
            $query->where('sl.problem_id', $whereMap['problem_id']);
        }
        if (isset($whereMap['user_id'])) {
            $query->where('sl.user_id', $whereMap['user_id']);
        }
        if (isset($whereMap['solution_id'])) {
            $query->where('sl.solution_id', $whereMap['solution_id']);
        }
        if (isset($whereMap['language'])) {
            $query->where('sl.language', $whereMap['language']);
        }
        if (isset($whereMap['result'])) {
            $query->where('sl.result', $whereMap['result']);
        }
        if (isset($whereMap['in_date'])) {
            $query->where('sl.in_date', $whereMap['in_date'][0], $whereMap['in_date'][1]);
        }
        
        if ($needSolutionIdIn) {
            $query->where('sl.solution_id', 'in', $solutionIdInValues);
        }
        if ($needLanguageIn) {
            $query->where('sl.language', 'in', $languageInValues);
        }
        
        return $query;
    }
    
    /**
     * 构建带查重的查询对象（比赛内）
     */
    protected function buildStatusAjaxQueryWithSimilar($Solution, $map, $columns, $needSolutionIdIn, $solutionIdInValues, $needLanguageIn, $languageInValues, $ordertype, $params, $offset, $limit)
    {
        $similar = $params['similar'];
        if ($similar < 0) {
            $similar = 0;
        } else if ($similar > 100) {
            $similar = 100;
        }
        
        $contest_id = $this->contest['contest_id'];
        
        // ========== 耦合 expsys/examsys 逻辑（必须：用户表选择） ==========
        $contestType = $this->contest['private'] % 10;
        $needJoinCpcTeam = ($contestType == 2 || $contestType == 5 || $this->module == 'examsys');
        $needJoinUsers = !$needJoinCpcTeam;
        // ========== 耦合 expsys/examsys 逻辑结束 ==========
        
        // 构建基础查询：join sim 表和被相似对象的 solution 表
        $query = $Solution->alias('sl')
            ->join('sim si', 'si.s_id=sl.solution_id', 'left')
            ->join('solution sr', 'sr.solution_id=si.sim_s_id', 'left');
        
        // 根据条件 join 用户信息表并设置 field
        $fieldList = 'sl.*, si.sim, si.sim_s_id, sr.user_id sim_user_id, sr.in_date sim_in_date';
        if ($needJoinCpcTeam) {
            $query->join('cpc_team ct', "ct.team_id = sl.user_id AND ct.contest_id = {$contest_id}", 'left');
            $fieldList .= ', ct.name team_name';
        } else if ($needJoinUsers) {
            $query->join('users u', 'u.user_id = sl.user_id', 'left');
            $fieldList .= ', u.nick team_name';
        }
        $query->field($fieldList);
        
        // 设置基础 where 条件
        $query->where('sl.contest_id', $contest_id);
        
        // 逐个添加 where 条件
        $whereMap = $map;
        unset($whereMap['contest_id']);
        
        if (isset($whereMap['problem_id'])) {
            $query->where('sl.problem_id', $whereMap['problem_id']);
        }
        if (isset($whereMap['user_id'])) {
            $query->where('sl.user_id', $whereMap['user_id']);
        }
        if (isset($whereMap['solution_id'])) {
            $query->where('sl.solution_id', $whereMap['solution_id']);
        }
        if (isset($whereMap['language'])) {
            $query->where('sl.language', $whereMap['language']);
        }
        if (isset($whereMap['result'])) {
            $query->where('sl.result', $whereMap['result']);
        }
        if (isset($whereMap['in_date'])) {
            $query->where('sl.in_date', $whereMap['in_date'][0], $whereMap['in_date'][1]);
        }
        
        // 根据相似度筛选条件添加额外的 where
        if ($similar > 0) {
            // 相似度筛选时，只查询AC的结果（因为只有AC的代码才会查重）
            $query->where('sl.result', 4)  // 4 = AC
                ->where('si.sim', 'exp', \think\Db::raw('is not null'))
                ->where('si.sim', '>=', $similar);
        }
        
        // 添加其他筛选条件
        if ($needSolutionIdIn) {
            $query->where('sl.solution_id', 'in', $solutionIdInValues);
        }
        if ($needLanguageIn) {
            $query->where('sl.language', 'in', $languageInValues);
        }
        
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
        
        // 【重要】查重查询需要在 PHP 中过滤自己与自己相似的情况，所以需要多查一些数据
        // 为了避免查询所有数据导致性能问题，我们查询 offset + limit * 3 条数据
        // 这样可以在过滤后仍然有足够的数据返回
        $queryLimit = ($offset + $limit) * 3;
        $solutionlist = $query->order($ordertypeWithAlias)->limit(0, $queryLimit)->select();
        
        // 手动处理 sim 数据，剔除自己与自己相似的情况
        $sim_id_list = [];
        foreach ($solutionlist as $val) {
            if (isset($val['sim']) && $val['sim'] != null) {
                $sim_id_list[] = $val['sim_s_id'];
            }
        }
        
        // 批量查询被相似对象的 solution 信息
        $solB = db('solution')->where('solution_id', 'in', $sim_id_list)->field(['user_id', 'solution_id', 'contest_id'])->select();
        $solBMap = [];
        $sim_user_ids_cpc = []; // #cpc 用户列表
        $sim_user_ids_normal = []; // 常规用户列表
        $sim_contest_ids = []; // 需要查询 cpc_team 的 contest_id 列表
        
        foreach ($solB as $val) {
            $solBMap[$val['solution_id']] = [
                'user_id' => $val['user_id'],
                'contest_id' => $val['contest_id']
            ];
            
            // 判断是 #cpc 用户还是常规用户
            $user_id = $val['user_id'];
            if ($user_id && strlen($user_id) >= 4 && substr($user_id, 0, 4) === '#cpc') {
                $sim_user_ids_cpc[] = $user_id;
                if ($val['contest_id'] && !in_array($val['contest_id'], $sim_contest_ids)) {
                    $sim_contest_ids[] = $val['contest_id'];
                }
            } else {
                $sim_user_ids_normal[] = $user_id;
            }
        }
        
        // 批量查询用户信息
        $sim_user_name_map = [];
        
        // 查询 #cpc 用户（从 cpc_team 表）
        if (!empty($sim_user_ids_cpc) && !empty($sim_contest_ids)) {
            $cpc_teams = db('cpc_team')
                ->where('team_id', 'in', array_unique($sim_user_ids_cpc))
                ->where('contest_id', 'in', $sim_contest_ids)
                ->field(['team_id', 'name', 'contest_id'])
                ->select();
            foreach ($cpc_teams as $team) {
                $key = $team['team_id'] . '|' . $team['contest_id'];
                $sim_user_name_map[$key] = $team['name'];
            }
        }
        
        // 查询常规用户（从 users 表）
        if (!empty($sim_user_ids_normal)) {
            $users = db('users')
                ->where('user_id', 'in', array_unique($sim_user_ids_normal))
                ->field(['user_id', 'nick'])
                ->select();
            foreach ($users as $user) {
                $sim_user_name_map[$user['user_id']] = $user['nick'] ?: $user['user_id'];
            }
        }
        
        $solution_ret = [];
        $cnt = 0;
        foreach ($solutionlist as &$val) {
            // 处理被相似对象的 user_id（需要转换格式）
            if (isset($val['sim_user_id']) && $val['sim_user_id'] != null) {
                $val['sim_user_id'] = $this->SolutionUser($val['sim_user_id'], false);
            }
            
            // 获取被相似对象的用户名字（name）
            if (isset($val['sim_s_id']) && $val['sim_s_id'] != null && array_key_exists($val['sim_s_id'], $solBMap)) {
                $sim_solution_info = $solBMap[$val['sim_s_id']];
                $sim_user_id_original = $sim_solution_info['user_id'];
                $sim_contest_id = $sim_solution_info['contest_id'];
                
                // 从批量查询的结果中获取用户名字
                $name_key = $sim_user_id_original;
                if ($sim_user_id_original && strlen($sim_user_id_original) >= 4 && substr($sim_user_id_original, 0, 4) === '#cpc' && $sim_contest_id) {
                    $name_key = $sim_user_id_original . '|' . $sim_contest_id;
                }
                
                if (isset($sim_user_name_map[$name_key])) {
                    $val['sim_user_name'] = $sim_user_name_map[$name_key];
                } else {
                    $val['sim_user_name'] = null;
                }
                
                // 检查是否是自己与自己的代码相似
                $current_user_id_original = $val['user_id'];
                $sim_user_id_display = $this->SolutionUser($sim_user_id_original, false);
                $current_user_id_display = $this->SolutionUser($current_user_id_original, false);
                
                if ($sim_user_id_display == $current_user_id_display) {
                    // 自己与自己的代码相似
                    if ($similar > 0) {
                        continue;
                    } else {
                        $val['sim_s_id'] = $val['sim'] = $val['sim_user_id'] = $val['sim_in_date'] = $val['sim_user_name'] = null;
                    }
                }
            } else {
                $val['sim_user_name'] = null;
            }
            
            if ($cnt >= $offset && $cnt < $offset + $limit) {
                $solution_ret[] = $val;
            }
            $cnt++;
        }
        
        return ['rows' => $solution_ret, 'total' => $cnt];
    }
    
    /**
     * 是否启用查重功能（比赛内）
     * 系统在任何状态下，只要是管理员或教师身份，都查询查重结果
     */
    protected function c()
    {
        // 比赛管理员或源码浏览权限
        if ($this->IsContestAdmin('admin') || IsAdmin('source_browser')) {
            return true;
        }
        
        // 检查是否是比赛所属课程的教师（EXP 模式）
        if (isset($this->OJ_STATUS) && $this->OJ_STATUS == 'exp' && function_exists('PrivCourse')) {
            // 获取比赛所属的 course_key
            $contest_id = $this->contest['contest_id'];
            $course_id = $this->GetContestCourseId($contest_id);
            if ($course_id) {
                // 查询 course 表获取 course_key
                $course = db('course')->where('course_id', $course_id)->field('course_key')->find();
                if ($course && isset($course['course_key'])) {
                    // 检查是否是该课程的教师
                    return PrivCourse('teacher', $course['course_key']);
                }
            }
        }
        
        return false;
    }
    
    /**
     * 处理用户信息（比赛内：从 JOIN 的结果中获取 team_name）
     */
    protected function processStatusAjaxUserInfo($solutionlist)
    {
        // 比赛内：team_name 已经在 JOIN 时获取，直接映射到 name
        foreach ($solutionlist as &$solution) {
            if (isset($solution['team_name'])) {
                $solution['name'] = $solution['team_name'];
            } else {
                $solution['name'] = null;
            }
        }
        return $solutionlist;
    }
    
    /**
     * 处理每条 solution 数据（比赛内）
     */
    protected function processStatusAjaxSolution(&$solution)
    {
        $solution['contest_type'] = $this->contest['private'] % 10;
        $solution['user_id'] = $this->SolutionUser($solution['user_id'], false);
        
        // 将 team_name 映射到 name 字段，供前端使用
        if (isset($solution['team_name'])) {
            $solution['name'] = $solution['team_name'];
        }
        
        // 权限检查：隐藏非自己的 memory、time 等
        if ($this->contest_user != $solution['user_id'] && !$this->IsContestAdmin() && !IsAdmin('source_browser') && $this->contestStatus != 2) {
            $solution['memory'] = '-';
            $solution['time'] = '-';
            $solution['pass_rate'] = '-';
            $solution['code_length'] = '-';
        }
        
        $solution_id = $solution['solution_id'];
        
        // ========== 耦合 expsys/examsys 逻辑（必须：examsys qid 处理） ==========
        // 保存原始的 problem_id（数字ID），用于 examsys 模块显示
        $original_problem_id = $solution['problem_id'];
        
        if (!array_key_exists($solution['problem_id'], $this->problemIdMap['id2abc'])) {
            // 处理比赛开始后删除题目
            $solution['problem_id'] .= '(DEL)';
        } else {
            $solution['problem_id'] = $this->problemIdMap['id2abc'][$solution['problem_id']];
        }
        
        // examsys 模块：添加 qid（考试题目序号）和 problem_id（OJ 题目ID）字段
        if ($this->module == 'examsys') {
            $qid = null;
            if (array_key_exists($original_problem_id, $this->problemIdMap['qid2num'])) {
                $qid = $this->problemIdMap['qid2num'][$original_problem_id];
            } else if (array_key_exists($original_problem_id, $this->problemIdMap['pid2qid'])) {
                $ex_question_id = $this->problemIdMap['pid2qid'][$original_problem_id];
                if (array_key_exists($ex_question_id, $this->problemIdMap['qid2num'])) {
                    $qid = $this->problemIdMap['qid2num'][$ex_question_id];
                }
            }
            
            $solution['qid'] = $qid !== null ? $qid : $solution['problem_id'];
            $solution['problem_id_oj'] = $original_problem_id;
        }
        // ========== 耦合 expsys/examsys 逻辑结束 ==========
        
        $solution['language'] = $this->allowLanguage[$solution['language']];
        $solution['code_show'] = $this->IfCanSeeInfo($solution);
        
        // 封榜处理
        if (strtotime($solution['in_date']) > $this->closeRankTime && $this->rankFrozen && $this->contest_user != $solution['user_id']) {
            $solution['result'] = '-';
            $solution['result_show'] = '-';
        } else {
            $this->GetResultShow($solution);
        }
    }
    
    /**
     * 获取总数（比赛内）
     */
    protected function getStatusAjaxTotal($map, $needSolutionIdIn, $solutionIdInValues, $needLanguageIn, $languageInValues)
    {
        $Solution = db('solution');
        $contest_id = $this->contest['contest_id'];
        $countQuery = $Solution->alias('sl')->where('sl.contest_id', $contest_id);
        
        $whereMap = $map;
        unset($whereMap['contest_id']);
        
        if (isset($whereMap['problem_id'])) {
            $countQuery->where('sl.problem_id', $whereMap['problem_id']);
        }
        if (isset($whereMap['user_id'])) {
            $countQuery->where('sl.user_id', $whereMap['user_id']);
        }
        if (isset($whereMap['solution_id'])) {
            $countQuery->where('sl.solution_id', $whereMap['solution_id']);
        }
        if (isset($whereMap['language'])) {
            $countQuery->where('sl.language', $whereMap['language']);
        }
        if (isset($whereMap['result'])) {
            $countQuery->where('sl.result', $whereMap['result']);
        }
        if (isset($whereMap['in_date'])) {
            $countQuery->where('sl.in_date', $whereMap['in_date'][0], $whereMap['in_date'][1]);
        }
        
        if ($needSolutionIdIn) {
            $countQuery->where('sl.solution_id', 'in', $solutionIdInValues);
        }
        if ($needLanguageIn) {
            $countQuery->where('sl.language', 'in', $languageInValues);
        }
        
        return $countQuery->count();
    }
    
    /**
     * 获取单个提交状态数据（比赛内）
     */
    protected function getSingleStatusAjaxSolution($solution_id)
    {
        $map = ['solution_id' => $solution_id];
        return db('solution')->where($map)
            ->field(['solution_id', 'user_id', 'in_date', 'contest_id', 'result', 'memory', 'time', 'pass_rate'])
            ->find();
    }
    
    /**
     * 检查是否可以查看单个提交状态（比赛内）
     */
    protected function canSeeSingleStatusAjax($solution)
    {
        if (CcpcRules::enabled($this->contest) && !$this->IsContestAdmin()
            && (!$this->contest_user || $this->SolutionUser($solution['user_id'], false) !== (string)$this->contest_user)) return false;
        // 检查是否是当前比赛的提交
        if ($solution['contest_id'] == null || $solution['contest_id'] != $this->contest['contest_id']) {
            $this->error('Not a submission of this contest');
            return false;
        }
        return true;
    }
    
    /**
     * 处理单个提交状态数据（比赛内）
     */
    protected function processSingleStatusAjaxSolution(&$solution)
    {
        $solution['user_id'] = $this->SolutionUser($solution['user_id'], false);
        
        // 权限检查：隐藏非自己的 memory、time 等
        if (
            (!$this->contest_user || $this->contest_user != $solution['user_id']) &&
            !$this->IsContestAdmin() &&
            !IsAdmin('source_browser') &&
            $this->contestStatus != 2
        ) {
            $solution['memory'] = '-';
            $solution['time'] = '-';
            $solution['pass_rate'] = '-';
            $solution['code_length'] = '-';
        }
        
        // 封榜处理
        if (strtotime($solution['in_date']) > $this->closeRankTime && $this->rankFrozen && $this->contest_user != $solution['user_id']) {
            $solution['result'] = '-';
            $solution['result_show'] = '-';
            return;
        }
        
        $this->GetResultShow($solution);
    }
    
    /**
     * 检查是否可以查看比赛解决方案详情（比赛内）
     */
    protected function canSeeContestSolutionDetails($solution)
    {
        return $this->IsContestAdmin() || IsAdmin('source_browser') || $this->contestStatus == 2;
    }
    
    /**
     * 是否应该隐藏结果（封榜处理）（比赛内）
     */
    protected function shouldHideResultForFrozen($solution)
    {
        if (strtotime($solution['in_date']) > $this->closeRankTime && $this->rankFrozen && $this->contest_user != $solution['user_id']) {
            return true;
        }
        return false;
    }
    
    /**
     * 检查是否可以查看比赛提交（比赛内：始终允许）
     */
    protected function canSeeContestSolution($contest_id)
    {
        // 比赛内：只要是当前比赛的提交就可以查看
        return $contest_id == $this->contest['contest_id'];
    }
    
    
    // ========== StatusAjaxTrait 钩子方法重写：代码对比页面（比赛内） ==========
    
    /**
     * 检查是否可以访问代码对比页面（比赛内）
     */
    protected function canAccessStatusCodeCompare()
    {
        // 比赛内：检查比赛管理员权限或源码浏览权限
        return $this->IsContestAdmin() || IsAdmin('source_browser');
    }
    
    /**
     * 转换用户ID（比赛内需要转换格式）
     */
    protected function convertStatusCodeCompareUserId($user_id)
    {
        // 比赛内使用 SolutionUser 方法转换用户ID格式
        return $this->SolutionUser($user_id, false);
    }
    
    /**
     * 获取比赛ID（比赛内）
     */
    protected function getStatusCodeCompareContestId()
    {
        // 比赛内返回当前比赛的 contest_id
        return isset($this->contest['contest_id']) ? $this->contest['contest_id'] : 0;
    }
    
    /**
     * 获取用户信息URL（比赛内）
     */
    protected function getStatusCodeCompareUserInfoUrl($user_id, $contest_id=0, $only_prefix=false)
    {
        // 比赛内使用 UserInfoUrl 方法（来自 ContestBaseTrait）
        return $this->UserInfoUrl($user_id, $contest_id, $only_prefix);
    }
    
    /**
     * 获取视图路径（比赛内）
     */
    protected function getStatusCodeCompareViewPath()
    {
        // 比赛内使用 contest/status_code_compare 视图
        return 'contest/status_code_compare';
    }
    
    /**
     * 获取提交结果详情
     */
    public function resdetail_ajax(){
        $solution_id = trim(input('solution_id'));
        $solution = db('solution')->where('solution_id', $solution_id)->find();
        $flg_can_see_special = IsAdmin('source_browser') || $this->IsContestAdmin('admin') || $this->ALLOW_WA_INFO;
        if ($this->IfCanSeeInfo($solution)) {
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
            $can_see_input = $flg_can_see_special || IsAdmin('source_browser');
            // ========== 耦合 expsys/examsys 逻辑（必须：教师权限检查） ==========
            // EXP 模式：教师权限检查（与 ACMOJ 逻辑隔离）
            if(isset($this->OJ_STATUS) && $this->OJ_STATUS == 'exp' && isset($this->NOW_COURSE_KEY) && function_exists('PrivCourse')) {
                $can_see_input = $can_see_input || PrivCourse('teacher', $this->NOW_COURSE_KEY);
            }
            // ========== 耦合 expsys/examsys 逻辑结束 ==========
            $data['can_see_input'] = $can_see_input;
            $this->success('', null, $data);
            
        } else {
            $this->error('Permission denied to see this infomation.');
        }
    }

    /**
     * 从评测数据目录读取单个测试数据文件（.in/.out），用于 runinfo 展示（比赛内）
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
        $flg_can_see_special = IsAdmin('source_browser') || $this->IsContestAdmin('admin') || $this->ALLOW_WA_INFO;
        $can_see_input = $flg_can_see_special || IsAdmin('source_browser');
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
     * 批量获取多个测试点的 in/out 尺寸（用于 runinfo 收起表格一次性填充，比赛内）
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
        if (count($cases) > 300) {
            $cases = array_slice($cases, 0, 300);
        }

        $solution = db('solution')->where('solution_id', $solution_id)->find();
        if (!$solution) {
            $this->error('No such solution.');
            return;
        }

        // 权限：与 resdetail_ajax 的 can_see_input 一致（比赛内）
        $flg_can_see_special = IsAdmin('source_browser') || $this->IsContestAdmin('admin') || $this->ALLOW_WA_INFO;
        $can_see_input = $flg_can_see_special || IsAdmin('source_browser');
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
    
    /**
     * 获取提交代码
     */
    public function showcode_ajax()
    {
        $data = [];
        $solution_id = trim(input('solution_id'));
        $solution = db('solution')->where('solution_id', $solution_id)->find();
        if (!$solution) {
            $this->error('Solution not found.');
        }
        $solution['user_id'] = $this->SolutionUser($solution['user_id'], false);
        $oj_language = config('CsgojConfig.OJ_LANGUAGE');
        $oj_results = config('CsgojConfig.OJ_RESULTS');
        if (!$this->IfCanSeeInfo($solution))
            $this->error('Permission denied to see this code.');

        $source = db('source_code')->where('solution_id', $solution_id)->find();
        if (!$source || !isset($source['source'])) {
            $this->error('Source code not found.');
        }
        // 最佳实践：API 返回原始源码（JSON 会安全编码），前端使用 textContent 渲染即可避免 XSS。
        // 保留标记字段供前端兼容：source_escaped = 0 表示未进行 HTML 实体转义
        $data['source'] = str_replace("\r\n", "\n", $source['source']);
        $data['source_escaped'] = 0;
        $data['result'] = array_key_exists($solution['result'], $oj_results) ? $oj_results[$solution['result']] : 'Unknown';
        $this->success('', null, $data);
    }
    
    
    // ========== Topic/Clarification 相关 Action ==========
    
    /**
     * 比赛 Clarification/Topic 数量 AJAX 接口
     * 返回 contest_topic 表的数量（讨论/澄清数量）
     */
    public function topic_num_ajax() {
        // 权限检查（参考 TopicAuth）
        if (!isset($this->contest_user) && !$this->IsContestAdmin('admin')) {
            $this->error("Please login first", 'contest?cid=' . $this->contest['contest_id'], '', 1);
        }
        
        // 构建查询器
        $query = db('contest_topic')
            ->where('contest_id', '=', $this->contest['contest_id'])
            ->where('reply', '<=', 0)  // reply <= 0 表示主话题（非回复）
            ->where($this->topicDefaultMap);  // 过滤删除标记的topic
        
        // 如果不是管理员，添加额外的权限限制
        if (!$this->IsContestAdmin('admin')) {
            $query->where(function($query) {
                $user_id_dbfull = isset($this->contest_user) ? $this->SolutionUser($this->contest_user, true) : null;
                if ($user_id_dbfull) {
                    $query->where('user_id', '=', $user_id_dbfull)
                          ->whereOr('public_show', '=', 1);
                } else {
                    $query->where('public_show', '=', 1);
                }
            });
        }
        
        $result = $query->field('COUNT(*) as count, SUM(reply) as reply_sum')->find();
        
        $result['reply_sum'] = $result['reply_sum'] ?? 0;
        $this->success('ok', null, $result);
    }
    
    /**
     * Topic 列表页面
     */
    public function topic_list()
    {
        $this->TopicAuth();
        $this->assign('abc2id', $this->problemIdMap['abc2id']);
        $this->assign('action', strtolower($this->request->action()));
        return $this->fetch();
    }
    
    /**
     * Topic 列表数据 AJAX
     */
    public function topic_list_ajax()
    {
        $this->TopicAuth();
        $sort       = trim(input('sort', 'topic_id'));
        $fields     = ['topic_id', 'user_id', 'title', 'public_show', 'contest_id', 'in_date', 'problem_id', 'reply'];
        $sort       = validate_item_range($sort, $fields);
        $order      = input('order', 'desc');

        $baseTopicQuery = db('contest_topic')
            ->where('contest_id', '=', $this->contest['contest_id'])
            ->where('reply', '<=', 0);

        $ordertype = [];
        if (strlen($sort) > 0) {
            $ordertype[$sort] = $order;
        }
        if (!$this->IsContestAdmin('admin')) {
            $list = $baseTopicQuery
                ->where($this->topicDefaultMap) // 过滤删除标记的topic
                ->where(function ($query) {
                    $user_id_dbfull = $this->SolutionUser($this->contest_user, true);
                    $query->where('user_id', '=', $user_id_dbfull)
                          ->whereOr('public_show', '=', 1);
                })
                ->field($fields)
                ->order($ordertype)
                ->select();
        } else {
            $list = $baseTopicQuery
                ->field($fields)
                ->order($ordertype)
                ->select();
        }

        foreach ($list as &$item) {
            $item['user_id'] = $this->SolutionUser($item['user_id'], false);
            
            // 使用统一的problem_id处理逻辑
            $item = $this->ProcessTopicProblemId($item);
            
            $item['reply'] = -$item['reply']; // 负数表示被回复次数
            // 添加管理员标识，供前端formatter使用
            $item['is_admin'] = $this->IsContestAdmin('admin');
        }
        return $list;
    }
    
    /**
     * Topic 详情页
     */
    public function topic_detail()
    {
        $topic_id = input('topic_id/d');
        $Topic = db('contest_topic');
        $topic = $Topic->where(['topic_id' => $topic_id, 'contest_id' => $this->contest['contest_id']])
            ->where($this->topicDefaultMap)
            ->find();
        if (!$topic || $topic['reply'] > 0)
            $this->error("No such topic");
        $topic['user_id'] = $this->SolutionUser($topic['user_id'], false);
        if ($topic['public_show'] != 1 && $topic['user_id'] != $this->contest_user && !$this->IsContestAdmin('admin')) {
            $this->error("Permission denied to see this topic");
        }
        // 使用新的查询对象查询回复列表，避免复用 $Topic 对象导致查询条件叠加
        $replyList = db('contest_topic')
            ->where(['contest_id' => $this->contest['contest_id'], 'reply' => $topic_id])
            ->where($this->topicDefaultMap)
            ->order('topic_id', 'asc')
            ->select();
        foreach ($replyList as $key => &$rep) {
            $rep['user_id'] = $this->SolutionUser($rep['user_id'], false);
        }
        
        // 使用统一的problem_id处理逻辑
        $topic = $this->ProcessTopicProblemId($topic);
        
        if ($topic['public_show'] == 1 && !$this->IsContestAdmin('admin')) {
            $this->assign('replyAvoid', true);
        }

        $this->assign(['topic' => $topic, 'replyList' => $replyList, 'userInfoUrlPrefix' => $this->UserInfoUrl('', $this->contest['contest_id'], true)]);
        return $this->fetch();
    }
    
    /**
     * Topic 回复
     */
    public function topic_reply_ajax()
    {
        $this->TopicAuth();
        $this->assertContestNotArchivedForWrite();
        if (!$this->running)
            $this->error("Contest is not running");
        $this->TopicSubmitDelay();
        $topic_id = input('topic_id/d');
        $Topic = db('contest_topic');
        $topic = $Topic->where(['topic_id' => $topic_id, 'contest_id' => $this->contest['contest_id']])
            ->where($this->topicDefaultMap)
            ->find();
        if (!$topic)
            $this->error("No such topic");
        $topicUserID = $this->SolutionUser($topic['user_id'], false);
        if ($topicUserID != $this->contest_user && !$this->IsContestAdmin('admin')) {
            $this->error("Permission denied to reply to this topic");
        }
        if ($topic['public_show'] == 1 && !$this->IsContestAdmin('admin')) {
            $this->error("This topic has been changed to public, reply is forbidden to avoid information change between teams.");
        }
        $topic_reply = [
            'content'       => trim(input('topic_content', '')),
            'user_id'       => $this->SolutionUser($this->contest_user, true),
            'reply'         => $topic_id,
            'public_show'   => 0,
            'contest_id'    => $this->contest['contest_id'],
            'in_date'       => date('Y-m-d H:i:s')
        ];
        if (strlen($topic_reply['content']) < 3)
            $this->error('Topic content too short.');
        if (strlen($topic_reply['content']) > 16384)
            $this->error('Topic content too long.');
        
        // 使用新的查询对象插入，避免复用 $Topic 对象导致查询条件影响
        $reply_topic_id = db('contest_topic')->insertGetId($topic_reply);
        $topic['reply']--; //负数表示回复数
        // 使用新的查询对象更新，避免之前查询设置的 WHERE 条件影响
        db('contest_topic')->where(['topic_id' => $topic['topic_id'], 'contest_id' => $this->contest['contest_id']])->update($topic);
        $this->success(
            "Topic submitted",
            null,
            [
                'contest_id'    => $this->contest['contest_id'],
                'topic_id'      => $reply_topic_id,
                'content'       => nl2br(htmlspecialchars($topic_reply['content'])),
                'user_id'       => $this->SolutionUser($this->contest_user, false),
                'in_date'       => $topic_reply['in_date'],
                'module'        => $this->module,
            ]
        );
    }
    
    /**
     * Topic 删除
     */
    public function topic_del_ajax()
    {
        $this->TopicAuth();
        $this->assertContestNotArchivedForWrite();
        if (!$this->IsContestAdmin('admin')) {
            $this->error("Permission denied to delete this topic item");
        }
        $topic_id = input('topic_id/d');
        $Topic = db('contest_topic');
        $topic_reply = $Topic->where(['topic_id' => $topic_id])->find();
        if (!$topic_reply) {
            $this->error("No such topic");
        }
        // 改为标记 'public_show' => -1 作为删除，以便保持数据在档
        // 使用新的查询对象更新，避免复用 $Topic 对象导致查询条件影响
        db('contest_topic')->where(['topic_id' => $topic_id, 'contest_id' => $this->contest['contest_id']])->update([
            'public_show' => -1
        ]);
        if ($topic_reply['reply'] > 0) {
            // 使用新的查询对象查询和更新，避免复用 $Topic 对象导致查询条件影响
            $topic = db('contest_topic')->where('topic_id', $topic_reply['reply'])->find();
            if ($topic) {
                $topic['reply']++; // 负数表示被回复个数
                db('contest_topic')->where(['topic_id' => $topic['topic_id'], 'contest_id' => $this->contest['contest_id']])->update($topic);
            }
        }
        $this->success("Topic " . $topic_id . " deleted");
    }
    
    /**
     * Topic 添加页面
     */
    public function topic_add()
    {
        $this->TopicAuth();
        if (!$this->running)
            $this->error("Contest is not running");
        $this->assign('abc2id', $this->problemIdMap['abc2id']);
        return $this->fetch();
    }
    
    /**
     * Topic 添加处理
     */
    public function topic_add_ajax()
    {
        $this->TopicAuth();
        $this->assertContestNotArchivedForWrite();
        if (!$this->running)
            $this->error("Contest is not running");
        $this->TopicSubmitDelay();
        $topic_add = [
            'title'         => trim(input('topic_title', '')),
            'content'       => trim(input('topic_content', '')),
            'user_id'       => $this->SolutionUser($this->contest_user, true),
            'reply'         => 0,
            'public_show'   => 0,
            'contest_id'    => $this->contest['contest_id'],
            'in_date'       => date('Y-m-d H:i:s'),
            'problem_id'    => trim(input('apid')),
        ];
        if (strlen($topic_add['title']) > 72)
            $this->error('Topic title too long.');
        if (strlen($topic_add['title']) < 1)
            $this->error('Topic title too short.');
        if (strlen($topic_add['content']) > 16384)
            $this->error('Topic content too long.');
        if (array_key_exists($topic_add['problem_id'], $this->problemIdMap['abc2id']))
            $topic_add['problem_id'] = $this->problemIdMap['abc2id'][$topic_add['problem_id']];
        else
            $topic_add['problem_id'] = -1;
        $topic_id = db('contest_topic')->insertGetId($topic_add);
        $this->success("Topic submitted", null, ['contest_id' => $this->contest['contest_id'], 'topic_id' => $topic_id]);
    }
    
    /**
     * Topic 状态变更
     */
    public function topic_change_status_ajax()
    {
        $this->TopicAuth();
        $this->assertContestNotArchivedForWrite();
        if (!$this->IsContestAdmin('admin')) {
            $this->error("Permission denied");
        }
        $topic_id = input('topic_id/d');
        $Topic = db('contest_topic');
        $topic = $Topic->where(['topic_id' => $topic_id, 'contest_id' => $this->contest['contest_id']])->find();
        if (!$topic || $topic['reply'] > 0) {
            $this->error("No such topic");
        }
        $topic['public_show'] = input('status/d') == 1 ? 1 : 0;
        // 使用新的查询对象更新，避免复用 $Topic 对象导致查询条件影响
        db('contest_topic')->where(['topic_id' => $topic_id, 'contest_id' => $this->contest['contest_id']])->update($topic);
        $this->success("Topic " . $topic['topic_id'] . " status changed", null, ['status' => $topic['public_show']]);
    }
    
    // ========== 比赛导出相关 Action ==========
    /**
     * 兼容旧书签：`/…/contest/contest2print` → 比赛后台 `admin/contest2print`（题册排版已迁至 Admin）。
     */
    public function contest2print()
    {
        $cid = intval($this->contest['contest_id'] ?? input('cid/d', 0));
        if ($cid <= 0) {
            $this->error('invalid contest');
        }
        $this->redirect('/' . strtolower((string) $this->request->module()) . '/admin/contest2print?cid=' . $cid);
    }

    // ========== 比赛消息相关 Action ==========
    
    /**
     * 比赛消息页面
     */
    public function msg() {
        return $this->fetch();
    }
    
    /**
     * 比赛消息列表数据
     */
    public function msg_list_ajax() {
        return db('contest_msg')->where(['contest_id' => $this->contest['contest_id'], 'defunct' => 0])->cache(10)->select();
    }

    /**
     * 直播控制台（前台比赛头「播」；与旧 /admin/contest_live 同一模板）
     */
    public function contest_live()
    {
        $this->assign('pagetitle', $this->contest['title'] . ' · 直播控制台');
        $this->assign('pagetitle_en', 'Live control');
        $attach = isset($this->contest['attach']) ? trim((string) $this->contest['attach']) : '';
        $brandBase = '';
        if ($attach !== '' && $attach !== '-') {
            $sub = trim((string) config('OjPath.contest_ATTACH'), '/');
            $brandBase = '/' . $sub . '/' . $attach . '/live';
        }
        $this->assign('contest_live_brand_base', $brandBase);
        // 固定 41px：与 app\ojtool\library\ContestliveBrandingLayout::SLOT_HEIGHT_PX、`contestlive_brand_layout.js` 对齐（common Trait 勿 use 单模块 library）
        $this->assign('contest_live_brand_slot_h_px', 41);
        $ldCfg = ContestliveDisplayAddition::normalizeFromAddition($this->contest['addition'] ?? null);
        $this->assign('live_display_config_json', json_encode($ldCfg, JSON_UNESCAPED_UNICODE | JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT));
        $this->assign('contest_live_hud_title_value', isset($ldCfg['hud_title']) ? (string) $ldCfg['hud_title'] : '');
        $this->assign('contest_live_ticker_fixed_value', isset($ldCfg['ticker_fixed']) ? (string) $ldCfg['ticker_fixed'] : '');
        return $this->fetch('admin/contest_live');
    }
}

if (!function_exists('CcpcRulesEnabled')) {
    function CcpcRulesEnabled(array $contest): bool
    {
        return \app\common\funcs\CcpcRules::enabled($contest);
    }
    function CcpcRulesThreshold(int $teams, string $policy = 'min_50_20'): int
    {
        return \app\common\funcs\CcpcRules::threshold($teams, $policy);
    }
}
