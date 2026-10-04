<?php
namespace app\examsys\controller;
use \Expbasecontroller;
require_once(__DIR__ . "/../../common/traits/ContestExpTrait.php");
require_once(__DIR__ . "/../../common/traits/ContestActionTrait.php");
require_once(__DIR__ . "/../../common/traits/ExamTrait.php");
use app\common\traits\ContestExpTrait;
use app\common\traits\ContestActionTrait;
use app\common\traits\ExamTrait;
class Contest extends Expbasecontroller {
    use ContestExpTrait;  // ContestExpTrait 已包含 ContestBaseTrait
    use ContestActionTrait;  // ContestActionTrait 包含 contest()、contest_auth_ajax() 等方法
    use ExamTrait;  // 考试图片上传/搬运/清理通用方法

    // 注意：$isAdmin 和 $isReviewer 已在 ContestBaseTrait 中定义，无需重复定义
    public $ojProblem;
    public $contestUserInfo;
    public function index()
    {
        $this->assign('current_time', microtime(true));
        return $this->fetch();
    }
    public function initialize() {
        parent::initialize();
        // 该接口仅用于检查主系统登录态，不依赖 contest/cid，上游可能单独调用
        $action = strtolower($this->request->action());
        if ($action === 'system_login_status_ajax') {
            return;
        }

        $this->ContestInit();
        // 实验考试系统特有的初始化（在 ContestInit 之后）
        $this->ContestInitExp();
        // OJ_STATUS/OJ_MODE 检查已由统一的路由守卫系统处理
        $this->ExamInit();
    }

    // 查重权限逻辑已收敛到 StatusAjaxTrait::isStatusAjaxSimilarEnabled()
    // 比赛内的额外放行（比赛管理员/课程教师）由 ContestBaseTrait::statusAjaxSimilarExtraPermission() 提供
    /**
     * 重写 ContestAuthenticationBase - 考试模式
     */
    public function ContestAuthenticationBase()
    {
        // defunct=1：对普通考生/游客拦截；但课程管理员/超管、owner 教师、以及本课程的 teacher 需要可进入查看/管理
        // 注意：PrivCourse('admin') 已包含 super 权限的检查
        $isCourseAdmin = IsAdmin() || PrivCourse('admin', $this->NOW_COURSE_KEY);
        $isOwnerTeacher = function_exists('PrivItem') ? PrivItem('contest', intval($this->contest['contest_id']), 'owner') : false;
        $isCourseTeacher = function_exists('PrivCourse') ? PrivCourse('teacher', $this->NOW_COURSE_KEY) : false;
        if ($this->contest['defunct'] == '1' && !$this->IsContestAdmin() && !$isCourseAdmin && !$isOwnerTeacher && !$isCourseTeacher) {
            $this->error('You cannot open this contest.', null, '', 1);
        }
        if ($this->CanJoin() || $this->IsContestAdmin() || $this->IsContestAdmin('reviewer')) {
            $this->canJoin = true;
        }
        // owner 教师 / 课程管理员 / 本课程教师：允许直接看题（不等同于"考生参赛登录"）
        if ($isCourseAdmin || $isOwnerTeacher || $isCourseTeacher) {
            $this->canJoin = true;
        }
        // 考试模式下，reviewer 在开始前可以看题
        $action = strtolower($this->request->action());
        if ($this->contestStatus == -1 && $this->IsContestAdmin('reviewer') && in_array($action, ['problemset', 'problem'])) {
            $this->canJoin = true;
        }
        if ($this->contestStatus == -1 && !$this->IsContestAdmin() && !$this->IsContestAdmin('reviewer')) {
            if (!in_array($action, ['contest', 'contest_auth_ajax', 'contest_auth_passwordless_ajax', 'team_auth_type_ajax', 'system_login_status_ajax', 'contest_logout_ajax'])) {
                $this->redirect("contest?cid=" . $this->contest['contest_id']);
            }
        }
    }
    
    /**
     * 重写 ContestAuthentication - 考试模式
     */
    public function ContestAuthentication()
    {
        $this->ContestAuthenticationBase();
        // 统一的策略 enforce（集中化，减少散落 if/redirect）
        $this->enforceContestAccessPolicy();
    }
    
    /**
     * 解析 addition 字段中的 IP 信息
     * @param mixed $addition - addition 字段（可能是 JSON 字符串、数组或 null）
     * @return array {current_ip: string|null, previous_ips: string[]}
     */
    protected function parseIpFromAddition($addition) {
        $result = [
            'current_ip' => null,
            'previous_ips' => []
        ];
        
        if (empty($addition)) {
            return $result;
        }
        
        $additionData = null;
        if (is_string($addition)) {
            $additionData = Json2Array($addition);
        } elseif (is_array($addition)) {
            $additionData = $addition;
        }
        
        if ($additionData && is_array($additionData)) {
            $result['current_ip'] = isset($additionData['current_ip']) && !empty($additionData['current_ip']) ? strval($additionData['current_ip']) : null;
            $result['previous_ips'] = isset($additionData['previous_ips']) && is_array($additionData['previous_ips']) ? array_map('strval', $additionData['previous_ips']) : [];
        }
        
        return $result;
    }
    
    /**
     * 更新 addition 字段中的 IP 信息
     * @param mixed $addition - 原始 addition 字段
     * @param string|null $currentIp - 当前 IP（null 表示清除）
     * @param bool $addToPrevious - 是否将当前 IP 添加到历史列表
     * @return string - 更新后的 JSON 字符串
     */
    protected function updateIpInAddition($addition, $currentIp = null, $addToPrevious = false) {
        $additionData = [];
        
        // 解析现有 addition
        if (!empty($addition)) {
            if (is_string($addition)) {
                $additionData = Json2Array($addition);
            } elseif (is_array($addition)) {
                $additionData = $addition;
            }
        }
        
        if (!is_array($additionData)) {
            $additionData = [];
        }
        
        // 如果要将当前 IP 添加到历史列表
        if ($addToPrevious && isset($additionData['current_ip']) && !empty($additionData['current_ip'])) {
            $oldCurrentIp = strval($additionData['current_ip']);
            if (!isset($additionData['previous_ips']) || !is_array($additionData['previous_ips'])) {
                $additionData['previous_ips'] = [];
            }
            // 避免重复添加
            if (!in_array($oldCurrentIp, $additionData['previous_ips'])) {
                $additionData['previous_ips'][] = $oldCurrentIp;
            }
        }
        
        // 更新当前 IP
        if ($currentIp !== null) {
            $additionData['current_ip'] = strval($currentIp);
        } else {
            unset($additionData['current_ip']);
        }
        
        return json_encode($additionData, JSON_UNESCAPED_UNICODE);
    }
    
    /**
     * 考试登录操作 - 设置 session
     */
    protected function contest_login_oper($teamInfo)
    {
        // 从 addition 字段解析 current_ip
        $currentIp = null;
        if (isset($teamInfo['addition']) && !empty($teamInfo['addition'])) {
            $ipInfo = $this->parseIpFromAddition($teamInfo['addition']);
            $currentIp = $ipInfo['current_ip'];
        }
        
        session($this->teamSessionName, [
            'team_id'   => $teamInfo['team_id'],
            'name'      => $teamInfo['name'],
            'name_en'   => isset($teamInfo['name_en']) ? $teamInfo['name_en'] : '',
            'tmember'   => isset($teamInfo['tmember']) ? $teamInfo['tmember'] : '',
            'coach'     => isset($teamInfo['coach']) ? $teamInfo['coach'] : '',
            'school'    => isset($teamInfo['school']) ? $teamInfo['school'] : '',
            'region'    => isset($teamInfo['region']) ? $teamInfo['region'] : '',
            'room'      => isset($teamInfo['room']) ? $teamInfo['room'] : '',
            'privilege' => isset($teamInfo['privilege']) ? $teamInfo['privilege'] : null,
            'current_ip' => $currentIp,
        ]);
    }
    
    /**
     * 考试登录日志
     */
    protected function contest_loginlog($team_id, $success)
    {
        if (isset($this->contest['flg_archive']) && intval($this->contest['flg_archive']) !== 0) {
            return;
        }
        $ip = GetRealIp();
        $time = date("Y-m-d H:i:s");
        db('loginlog')->insert([
            'user_id' => '#cpc' . $this->contest['contest_id'] . '_' . $team_id,
            'password' => '',
            'ip' => $ip,
            'time' => $time,
            'success' => $success,
        ]);
    }
    
    /**
     * 获取登录后的重定向URL
     */
    protected function getContestLoginRedirectUrl()
    {
        // 考试系统不需要榜单，所有用户登录后都重定向到 problemset
        $redirect_action = "problemset";
        return "/" . $this->module . "/contest/" . $redirect_action . "?cid=" . $this->contest['contest_id'];
    }
    
    /**
     * 检查队伍认证类型（是否需要密码或使用系统账号）
     */
    public function team_auth_type_ajax()
    {
        $cid = input('cid/d');
        $team_id = input('team_id/s');
        $team_item = db('cpc_team')->where([
            'contest_id' => $cid,
            'team_id' => $team_id
        ])->find();
        if($team_item != null && $team_item['password'] == '[SYS_PASS]') {
            return '[SYS_PASS]';
        }
        return 'password auth';
    }

    /**
     * 系统账号登录状态检查（给前端做“系统密码模式”最佳交互）
     * - logged_in: 是否已登录主系统账号（session user_id）
     * - match: 是否与输入的 team_id 同名（大小写不敏感）
     */
    public function system_login_status_ajax()
    {
        $team_id = trim(input('team_id/s', ''));
        $logged_in = session('?user_id');
        $user_id = $logged_in ? strval(session('user_id')) : '';
        $match = $logged_in && $team_id !== '' && strtolower($user_id) === strtolower($team_id);
        $this->success('ok', null, [
            'logged_in' => $logged_in ? 1 : 0,
            'user_id'   => $user_id,
            'team_id'   => $team_id,
            'match'     => $match ? 1 : 0,
        ]);
    }
    
    /**
     * 重写 contest_auth_ajax - 考试模式登录
     */
    public function contest_auth_ajax()
    {
        // 比赛账号（非OJ账号）登录验证
        if($this->GetSession('?')){
            $this->error('Already logged in. Try refreshing the page.', null, ['error_type' => 'already_logged_in']);
        }
        $team_id = trim(input('team_id/s'));
        $password = trim(input('password/s'));
        if($team_id == null || strlen($team_id) == 0) {
            $this->error('Query Data Invalid!', null, ['error_type' => 'invalid_data']);
        }
        $map = array(
            'contest_id' => $this->contest['contest_id'],
            'team_id' => $team_id,
        );
        $teamInfo = db('cpc_team')->where($map)->find();
        // 如果考试已结束，则不允许考生账号再登录
        if($this->contestStatus == 2 && ($teamInfo == null || $teamInfo['privilege'] == null || strlen(trim($teamInfo['privilege'])) == 0)) {
            $this->error('考试结束 / Exam Ended!', null, ['error_type' => 'exam_ended']);
        }
        // team不存在
        if($teamInfo == null) {
            $this->error('No such team', null, ['error_type' => 'team_not_found']);
        }
        // 如果考试是IP限制模式且已登记IP，则不允许考生再登录
        // 锁IP 仅对考生生效：监考(admin)、阅卷(reviewer) 等有 privilege 的账号不锁
        $ip = GetRealIp();
        $isIpLockMode = intdiv($this->contest['topteam'], 10000) === 1;
        $isExaminee = ($teamInfo['privilege'] === null || trim((string)($teamInfo['privilege'] ?? '')) === '');
        if ($isIpLockMode && $isExaminee && !PrivCourse('teacher', $this->NOW_COURSE_KEY)) {
            // 检查 IP 锁定：从 addition 字段读取 current_ip
            $ipInfo = $this->parseIpFromAddition($teamInfo['addition'] ?? null);
            if($ipInfo['current_ip'] && $ipInfo['current_ip'] !== $ip) {
                $this->error('IP locked.', null, ['error_type' => 'ip_locked']);
            }
        }
        // 已交卷
        if(($teamInfo['privilege'] === null || $teamInfo['privilege'] == '') && $teamInfo['defunct'] != 'N') {
            $this->error('Already submitted the exam.', null, ['error_type' => 'already_submitted']);
        }
        
        $checkPassRes = false;
        if($teamInfo['password'] == '[SYS_PASS]') {
            // 使用系统账号的密码
            if(session('?user_id') && strtolower(session('user_id')) == strtolower($team_id)) {
                $checkPassRes = true;
            } else {
                $this->error("请在考试外主系统中登入同ID账号.", null, ['error_type' => 'system_login_required']);
            }
        } else {
            $checkPassRes = CkPasswd($password, $teamInfo['password'], True);
        }
        
        $isArchived = isset($this->contest['flg_archive']) && intval($this->contest['flg_archive']) !== 0;
        if($checkPassRes) {
            if (!$isArchived) {
                // 无论是否设置了 IP 锁定，都记录当前登录的 IP 到 addition 字段
                $newAddition = $this->updateIpInAddition($teamInfo['addition'] ?? null, $ip, false);
                db('cpc_team')->where($map)->setField('addition', $newAddition);
                $teamInfo['addition'] = $newAddition;
            }
            $this->contest_login_oper($teamInfo);
            if (!$isArchived) {
                $this->contest_loginlog($teamInfo['team_id'], 1);
            }
        } else {
            if (!$isArchived) {
                $this->contest_loginlog($teamInfo['team_id'], 0);
            }
            $this->error('Password Error!', null, ['error_type' => 'password_error']);
        }
        $this->success('Verification passed', null, ['redirect_url' => "/" . $this->module . "/contest/problemset?cid=" . $this->contest['contest_id']]);
    }
    
    /**
     * 考试登出
     */
    public function contest_logout_ajax()
    {
        if(!$this->GetSession('?')){
            $this->error('User already logged out.');
        }
        session($this->teamSessionName, null);
        $this->success('Logout Contest ' . $this->contest['contest_id'] . ' Successful!<br/>Reloading data.');
    }
    
    public function ExamInit() {
        $this->isAdmin = IsAdmin() || PrivCourse('admin', $this->NOW_COURSE_KEY);
        $this->assign('isAdmin', $this->isAdmin);
        // 课程教师（用于区分“管理员/教师”与“监考等考试内权限”）
        $isTeacher = PrivCourse('teacher', $this->NOW_COURSE_KEY);
        $this->assign('isTeacher', $isTeacher);
        
        // 只有在 contest 已初始化时才检查 reviewer 权限和查询用户信息
        if(isset($this->contest) && $this->contest !== null && isset($this->contest['contest_id'])) {
            $this->isReviewer = $this->IsContestAdmin('reviewer');
            $this->assign('isReviewer', $this->isReviewer);
            
            if(isset($this->contest_user)) {
                $this->contestUserInfo = db('cpc_team')->where([
                    'contest_id'    => $this->contest['contest_id'], 
                    'team_id'       => $this->contest_user
                ])->find();
                if($this->contestUserInfo != null) {
                    $this->contestUserInfo['password'] = '-';
                    $this->assign('contestUserInfo', $this->contestUserInfo);
                }
            }
        } else {
            // contest 未初始化时，设置默认值
            $this->isReviewer = false;
            $this->assign('isReviewer', false);
        }
    }
    public function contest_list_ajax() {
        //暂时bootstrap-table的pagination改为client side，即server直接返回所有比赛
        $columns = ["contest_id", "title", "start_time", "end_time", "defunct", "private", "langmask", "password", "topteam", "award_ratio", "frozen_minute", "frozen_after"];
        $search = trim(input('search/s'));

        // TP5.1：避免将 ['like', ...] 这类数组条件塞进 $map 再 where($map)（在某些场景会被 Builder 当作 IN 包装）
        // 前台列表：任何身份都只能看到 defunct=0 的考试（hidden 的 exam 不显示在列表中）
        // 但 teacher 可以通过直接访问 URL 进入 hidden 的 exam（由 ContestAuthenticationBase 控制）
        $map = ['defunct' => '0'];
        $ret = [];
        // 修复 ThinkPHP 5.1 IN 查询：将 IN 查询改为链式调用，避免数组格式解析错误
        // examsys 模块：只显示考试类的contest（private % 10 == 5）
        // 注意：每次独立调用 db('contest')，避免状态累积
        $query = db('contest')->where('private', 'in', [5, 15]);
        
        // 使用 applyQueryFilterToQuery hook 方法应用 course_item 表联查（exp 系统会自动处理）
        $query = $this->applyQueryFilterToQuery($query, $map, 'contest');

        if (strlen($search) > 0) {
            $kw = "%$search%";
            $query = $query->where(function($q) use ($kw) {
                $q->where('contest_id', 'like', $kw)
                  ->whereOr('title', 'like', $kw);
            });
        }
        
        $contestList = $query
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
    
    /**
     * 提交状态页面（重写 ContestActionTrait 的方法，设置 examsys 特有的配置）
     */
    public function status()
    {
        // 调用父 trait 的方法获取基础数据
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
    
    /**
     * 考生信息页面
     */
    public function teaminfo() {
        // 用户信息页
        $team_id = trim(input('team_id'));
        if($team_id == null || strlen($team_id) == 0)
            $team_id = $this->contest_user;
        if($team_id == null || strlen($team_id) == 0) {
            $this->error('You find a 404 ^_^');
        }
        $teaminfo = db('cpc_team')->where(['contest_id' => $this->contest['contest_id'], 'team_id' => $team_id])->find();
        if($teaminfo == null)
            $this->error('No such team.');
        
        // 设置 proctorAdmin 变量（用于判断是否显示登录日志）
        $proctorAdmin = $this->IsContestAdmin('admin') || $this->IsContestAdmin('reviewer');
        
        $this->assign([
            'teaminfo' => $teaminfo,
            'proctorAdmin' => $proctorAdmin
        ]);
        return $this->fetch();
    }
    
    /**
     * 考试登录日志 AJAX
     */
    public function contest_loginlog_ajax() {
        $team_id = input('team_id/s');
        if($team_id === null || $team_id === '') {
            $team_id = $this->contest_user;
        }
        
        // 权限检查：只有本人或管理员/reviewer可以查看登录日志
        $proctorAdmin = $this->IsContestAdmin('admin') || $this->IsContestAdmin('reviewer');
        if(!$proctorAdmin && $this->contest_user != $team_id) {
            $this->error("No permission to see login log");
        }
        
        // 查询登录日志（user_id 格式为 #cpc{contest_id}_{team_id}）
        $loginlog = db('loginlog')
            ->where('user_id', '#cpc' . $this->contest['contest_id'] . '_' . $team_id)
            ->field(['time', 'ip'])
            ->order('time', 'desc')
            ->select();
        
        // 添加索引字段（用于表格显示）
        $result = [];
        foreach($loginlog as $index => $log) {
            $result[] = [
                'index' => $index + 1,
                'time' => $log['time'],
                'ip' => $log['ip']
            ];
        }
        
        return $result;
    }
    
    /**
     * 考试题目页面
     */
    public function problemset() {
        $examinee_defunct = 'N';
        // 如果比赛未进行中，禁止答题
        if($this->contestStatus != 1) {
            $examinee_defunct = 'Y';
        }
        // 如果考生已交卷，禁止答题
        if(isset($this->contestUserInfo) && $this->contestUserInfo != null && isset($this->contestUserInfo['defunct']) && $this->contestUserInfo['defunct'] == 'Y') {
            $examinee_defunct = 'Y';
        }
        // 如果考生未登录或是管理员/reviewer，禁止答题
        if($this->contest_user == null || $this->GetSession('privilege') === 'admin' || $this->GetSession('privilege') === 'reviewer') {
            $examinee_defunct = 'Y';
        }
        $this->assign('examinee_defunct', $examinee_defunct);
        // contest.addition：是否打乱选择题选项顺序（可能为 null / 非法 JSON）
        $shuffle_choice = 0;
        try {
            if (isset($this->contest) && !empty($this->contest['addition'])) {
                $addition = Json2Array($this->contest['addition']);
                if ($addition && is_array($addition) && isset($addition['shuffle_choice'])) {
                    $shuffle_choice = intval($addition['shuffle_choice']) ? 1 : 0;
                }
            }
        } catch (\Throwable $e) {
            $shuffle_choice = 0;
        }
        $this->assign('shuffle_choice', $shuffle_choice);
        // 判断是否有附加题（参考 ContestBaseTrait：intdiv(private, 10) === 1 表示有附加题）
        $has_additional = 0;
        if (isset($this->contest) && isset($this->contest['private'])) {
            if (intdiv((int)$this->contest['private'], 10) === 1) {
                $has_additional = 1;
            }
        }
        $this->assign('has_additional', $has_additional);
        // 考试答题页：不显示答案和阅卷区域
        $this->assign('hide_answer_review', 1);
        return $this->fetch();
    }
    
    /**
     * 单页考试页面（独立页模式）
     */
    public function problemset_single_page() {
        $examinee_defunct = 'N';
        // 如果比赛未进行中，禁止答题
        if($this->contestStatus != 1) {
            $examinee_defunct = 'Y';
        }
        // 如果考生已交卷，禁止答题
        if(isset($this->contestUserInfo) && $this->contestUserInfo != null && isset($this->contestUserInfo['defunct']) && $this->contestUserInfo['defunct'] == 'Y') {
            $examinee_defunct = 'Y';
        }
        // 如果考生未登录或是管理员/reviewer，禁止答题
        if($this->contest_user == null || $this->GetSession('privilege') === 'admin' || $this->GetSession('privilege') === 'reviewer') {
            $examinee_defunct = 'Y';
        }
        $this->assign('examinee_defunct', $examinee_defunct);
        // contest.addition：是否打乱选择题选项顺序（单页模式不生效，但仍下发配置，便于前端统一读取）
        $shuffle_choice = 0;
        try {
            if (isset($this->contest) && !empty($this->contest['addition'])) {
                $addition = Json2Array($this->contest['addition']);
                if ($addition && is_array($addition) && isset($addition['shuffle_choice'])) {
                    $shuffle_choice = intval($addition['shuffle_choice']) ? 1 : 0;
                }
            }
        } catch (\Throwable $e) {
            $shuffle_choice = 0;
        }
        $this->assign('shuffle_choice', $shuffle_choice);
        // 判断是否有附加题（参考 ContestBaseTrait：intdiv(private, 10) === 1 表示有附加题）
        $has_additional = 0;
        if (isset($this->contest) && isset($this->contest['private'])) {
            if (intdiv((int)$this->contest['private'], 10) === 1) {
                $has_additional = 1;
            }
        }
        $this->assign('has_additional', $has_additional);
        return $this->fetch('problemset_single_page');
    }
    
    /**
     * 获取题目列表
     */
    public function problemset_ajax() {
        $field = [
            'p.ex_question_id ex_question_id',
            'p.title title',
            'p.pkind pkind',
            'p.description description',
            'p.content content',
            'cp.num num',
            'cp.pscore pscore'
        ];
        $with_answer = input('with_answer/d');
        if($with_answer == 1 && $this->isReviewer) {
            // reviewer可查看answer
            $field[] = 'p.answer answer';
            // reviewer可查看答案解析/评分建议（题库字段，前端会拆分展示）
            $field[] = 'p.answer_explain answer_explain';
            $field[] = 'cp.title prule';
            // 添加 attach 字段，用于显示答案图（简答题和综合题的答案图需要此字段）
            $field[] = 'p.attach attach';
        }
        $question_list = db('contest_problem')->alias('cp')
            ->join('ex_question p', 'p.ex_question_id = cp.problem_id', 'left')
            ->where('cp.contest_id', $this->contest['contest_id'])
            ->order('cp.num', 'asc')
            ->field($field)
            ->cache(20)
            ->select();
        return $question_list;
    }
    
    /**
     * 获取答卷数据
     */
    public function asheet_ajax() {
        // 获取特定考生的答卷数据
        $examinee_id = input('examinee_id/s');
        $fields = input('fields/a');
        $query_all = input('query_all/d');  // 管理员查询所有用
        if($examinee_id == null || !$this->isReviewer) {
            // 如果 examinee_id 为空，或者不是reviewer，则获取的是当前登录用户的答卷
            $examinee_id = $this->contest_user;
        }
        $map = [
            'exam_id' => $this->contest['contest_id']
        ];
        if(!$this->isReviewer && $examinee_id != $this->contest_user) {
            // 非reviewer且查询非本人
            $this->error("No permission to see other's answer sheet.");
        }
        if(!$this->isReviewer || $query_all == null || $query_all != 1) {
            // 非reviewer或并没有查询全部数据，则只查询特定人数据
            $map['examinee_id'] = $examinee_id;
        }
        $asheet_list = [];
        if(!$this->isReviewer || $fields == null) {
            $asheet_list = db('ex_asheet')->where($map)->field(['score', 'notes', 'reviewer'], true) // true 参数表示排除字段
            ->select();
        } else {
            $asheet_list = db('ex_asheet')->where($map)->field($fields)->select();
        }
        return $asheet_list;
    }
    
    /**
     * 获取编程题内容
     */
    public function oj_problemset_ajax() {
        // 获取所有 programming problem 的内容
        return db('problem')->alias('p')
        ->join([problem_md_join_default_subquery_sql() => 'pmd'], 'p.problem_id = pmd.problem_id', 'left')
        ->where('p.problem_id', 'in', $this->problemIdMap['problemset'])
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
            'p.time_limit time_limit',
            'p.memory_limit memory_limit',
            'p.attach attach',
            'pmd.description description_md',
            'pmd.input input_md',
            'pmd.output output_md',
            'pmd.hint hint_md',
            'pmd.source source_md',
            'pmd.author author_md',
        ])
        ->cache(20)->select();
    }
    
    /**
     * 提交权限验证
     */
    public function QuestionSubmitAuth() {
        // 是否还在考试时间内
        if($this->contestStatus != 1) {
            $this->error("Exam is not running.");
        }
        // 判断该考生是否已交卷
        if(isset($this->contestUserInfo) && $this->contestUserInfo['defunct'] == 'Y') {
            $this->error("You've already finished the exam.");
        }
    }
    
    /**
     * 提交答案
     */
    public function ex_question_submit_ajax() {
        $this->QuestionSubmitAuth();
        $this->assertContestNotArchivedForWrite();
        $examinee_id = $this->contest_user;
        $ex_question_id = input('ex_question_id/d');

        // 兼容：前端可能用 JSON 字符串提交（用于保证二维数组/空数组行不丢失）
        $submission_raw = input('submission_raw/a', null);
        if($submission_raw === null || $submission_raw === []) {
            $rawJson = trim(input('submission_raw_json/s', ''));
            if($rawJson !== '') {
                $decoded = json_decode($rawJson, true);
                if(is_array($decoded)) {
                    $submission_raw = $decoded;
                }
            }
        }

        $tmp_images = input('tmp_images/a', []);
        if(empty($tmp_images)) {
            $tmpJson = trim(input('tmp_images_json/s', ''));
            if($tmpJson !== '') {
                $decodedTmp = json_decode($tmpJson, true);
                if(is_array($decodedTmp)) {
                    $tmp_images = $decodedTmp;
                }
            }
        }
        $tmp_uuid = trim(input('tmp_uuid/s', ''));
        
        if(!array_key_exists($ex_question_id, $this->problemIdMap['qid2num'])) {
            // 不是本场考试的题目
            $this->error('Not valid question.');
        }
        $question = db('ex_question')->where('ex_question_id', $ex_question_id)->find();
        if($question == null) {
            $this->error("No such question: " . $ex_question_id);
        }
        
        // 处理临时图片移动（在 ProcessSubmission 之前：先把 images URL 写回 submission_raw）
        if(!empty($tmp_images) && $this->validateTmpUuid($tmp_uuid)) {
            $this->moveTmpImagesToFinal($ex_question_id, $tmp_images, $tmp_uuid, $submission_raw);
        }
        
        $submission = $this->ProcessSubmission($submission_raw, $question);

        // ===== 保存完成后：按“最终 submission”清理不再引用的旧图（即使本次未上传 tmp 也清理）=====
        if (in_array(intval($question['pkind']), [15, 20], true)) {
            $ojPath = config('OjPath.');
            $attach = $this->contest['attach'];
            $uid = $this->contest_user;
            $finalBaseDir = rtrim($ojPath['PUBLIC'], '/') . $ojPath['contest_ATTACH'] . '/' . $attach . '/exam_image/' . $uid;
            $prefix = "/upload/contest_attach/{$attach}/exam_image/{$uid}/";
            $expectedFiles = [];
            if (isset($submission['images']) && is_array($submission['images'])) {
                foreach ($submission['images'] as $row) {
                    if (!is_array($row)) continue;
                    foreach ($row as $u) {
                        $u = strval($u);
                        if ($u !== '' && strpos($u, $prefix) === 0) {
                            $expectedFiles[] = basename($u);
                        }
                    }
                }
            }
            $this->cleanupExamQuestionFiles($finalBaseDir, $ex_question_id, $expectedFiles);
        }

        // 本次如果用了 tmp_uuid：仅在确实处理了 tmp_images 时才清理 tmp 目录
        // 否则可能出现前端漏传 tmp_images（或结构不完整）导致“已上传但未搬运”的临时文件被误删。
        if (!empty($tmp_images) && $this->validateTmpUuid($tmp_uuid)) {
            $this->cleanupTmpUuidDir($tmp_uuid);
        }

        $asheet_item = db('ex_asheet')->where([
            'examinee_id' => $examinee_id,
            'exam_id' => $this->contest['contest_id'],
            'ex_question_id' => $ex_question_id
        ])->find();
        if($asheet_item == null) {
            $asheet_item = [
                'examinee_id' => $examinee_id,
                'exam_id' => $this->contest['contest_id'],
                'ex_question_id' => $ex_question_id,
                'submission' => json_encode($submission),
                'create_at' => date('Y-m-d H:i:s'),
                'update_at' => date('Y-m-d H:i:s') // 手动设置避免mysql与系统时间不一致
            ];
            $asheet_item['ex_asheet_id'] = db('ex_asheet')->insertGetId($asheet_item);
        } else {
            $asheet_item['submission'] = json_encode($submission);
            $asheet_item['update_at'] = date('Y-m-d H:i:s');
            db('ex_asheet')->where([
                'examinee_id' => $examinee_id,
                'exam_id' => $this->contest['contest_id'],
                'ex_question_id' => $ex_question_id
            ])->update($asheet_item);
        }
        unset($asheet_item["create_at"]);
        unset($asheet_item["score"]);
        unset($asheet_item["notes"]);
        unset($asheet_item["reviewer"]);
        
        // 如果是编程题，从 submission 中提取 solution_id 并添加到返回数据
        $return_data = $asheet_item;
        if($question['pkind'] == 25 && isset($submission['solution_id'])) {
            $return_data['solution_id'] = $submission['solution_id'];
        }
        
        $this->success("Question " . ($this->problemIdMap['qid2num'][$ex_question_id]) . " answer sheet updated.", null, $return_data);
    }
    
    /**
     * 将临时图片移动到最终目录，并更新 submission_raw 中的图片 URL
     */
    private function moveTmpImagesToFinal($ex_question_id, $tmp_images, $tmp_uuid, &$submission_raw) {
        $ojPath = config('OjPath.');
        $attach = $this->contest['attach'];
        $uid = $this->contest_user;
        $maxDim = intval(config('CsgojConfig.OJ_IMAGE_MAX_DIM'));
        if($maxDim <= 0) $maxDim = 1024;
        
        // 最终目录
        $finalBaseDir = rtrim($ojPath['PUBLIC'], '/') . $ojPath['contest_ATTACH'] . '/' . $attach . '/exam_image/' . $uid;
        if(!MakeDirs($finalBaseDir)) {
            $this->error('Folder permission denied.');
        }
        
        // 临时目录
        $tmpDir = $this->getAnswerImageTmpBaseDir() . '/' . $tmp_uuid . '/exam_image';
        if(!is_dir($tmpDir)) {
            $this->error(
                "由于过久未保存，图片已失效，请重新上传后再保存。",
                null,
                [
                    'err_code' => 'TMP_IMAGE_EXPIRED',
                    'missing_files' => [],
                    'ex_question_id' => intval($ex_question_id),
                ]
            );
        }
        
        // 处理每个临时图片
        foreach($tmp_images as $tmpImg) {
            $subIdx = isset($tmpImg['sub_idx']) ? intval($tmpImg['sub_idx']) : 0;
            $reqIdx = isset($tmpImg['req_idx']) ? intval($tmpImg['req_idx']) : 0;
            $fileName = isset($tmpImg['file_name']) ? trim(strval($tmpImg['file_name'])) : '';
            
            if($fileName === '' || strpos($fileName, 'tmp_') !== 0) continue;
            
            $src = $tmpDir . '/' . $fileName;
            if(!is_file($src)) {
                $this->error(
                    "由于过久未保存，图片已失效，请重新上传后再保存。",
                    null,
                    [
                        'err_code' => 'TMP_IMAGE_EXPIRED',
                        'missing_files' => [$fileName],
                        'ex_question_id' => intval($ex_question_id),
                    ]
                );
            }
            
            // 生成最终文件名
            $dstName = $this->makeAnswerImageFilename($ex_question_id, ($subIdx + 1), ($reqIdx + 1));
            $dst = $finalBaseDir . '/' . $dstName;
            if(is_file($dst)) @unlink($dst);
            
            if(!$this->moveFile($src, $dst)) {
                $this->error("移动图片失败：{$fileName}");
            }
            
            // 验证图片
            $imgInfo = @getimagesize($dst);
            if(!$imgInfo) {
                @unlink($dst);
                $this->error("图片格式无效：{$dstName}");
            }
            if(intval($imgInfo[0]) > $maxDim || intval($imgInfo[1]) > $maxDim) {
                @unlink($dst);
                $this->error("图片尺寸过大：{$dstName}（要求长宽均不超过 {$maxDim}px）");
            }
            if(isset($imgInfo[2]) && intval($imgInfo[2]) !== $this->getWebpImageType()) {
                @unlink($dst);
                $this->error("图片格式不合法：{$dstName}（仅允许 WebP）");
            }
            
            // 生成最终 URL 并更新 submission_raw
            $finalUrl = "/upload/contest_attach/{$attach}/exam_image/{$uid}/{$dstName}";
            
            // 更新 submission_raw 中的图片 URL
            if(isset($submission_raw['images']) && is_array($submission_raw['images'])) {
                if(isset($submission_raw['images'][$subIdx]) && is_array($submission_raw['images'][$subIdx])) {
                    $submission_raw['images'][$subIdx][$reqIdx] = $finalUrl;
                }
            }
        }

        // tmp 目录清理与“旧图清理”在 ex_question_submit_ajax 里统一处理（更可靠：无 tmp 也会清理）
    }
    
    /**
     * 处理提交数据
     */
    public function ProcessSubmission($submission_raw, $question) {
        // 将提交的submission字符串处理为存入数据库的submission
        if($submission_raw == null) {
            $this->error("No submission found.");
        }
        switch($question['pkind']) {
            case 0:     return $this->SubmissionSingleChoice($submission_raw, $question);
            case 1:     return $this->SubmissionMultiChoice($submission_raw, $question);
            case 5:     return $this->SubmissionTrueFalse($submission_raw, $question);
            case 10:    return $this->SubmissionFill($submission_raw, $question);
            case 15:    return $this->SubmissionShortAnswer($submission_raw, $question);
            case 20:    return $this->SubmissionComprehensive($submission_raw, $question);
            case 25:    return $this->SubmissionProgramming($submission_raw, $question);
        }
        $this->error("No such type of question.");
    }
    
    public function SubmissionSingleChoice($submission_raw, $question){
        if(count($submission_raw) != 1 || strlen($submission_raw[0]) != 1 || $submission_raw[0][0] < 'A' || $submission_raw[0][0] > 'Z') {
            $this->error("Not valid submission for single-choice.");
        }
        return $submission_raw;
    }
    
    public function SubmissionMultiChoice($submission_raw, $question){
        if(count($submission_raw) < 1 || count($submission_raw) > 26) {
            $this->error("Not valid submission for multi-choice.");
        }
        foreach($submission_raw as $key=>$val) {
            if(strlen($val) != 1 || $val[0] < 'A' || $val[0] > 'Z') {
                $this->error("Not valid submission for multi-choice.");
            }
        } 
        return $submission_raw;
    }
    
    public function SubmissionTrueFalse($submission_raw, $question){
        if(count($submission_raw) != 1 || ($submission_raw[0] != 'T' && $submission_raw[0] != 'F')) {
            $this->error("Not valid submission for true-false question.");
        }
        return $submission_raw;
    }
    
    public function SubmissionFill($submission_raw, $question){
        if(count($submission_raw) > 128) {
            $this->error("Too many blank fills.");
        }
        foreach($submission_raw as $val) {
            if(strlen($val) > 512){
                $this->error("Answer too long.");
            }
        }
        return $submission_raw;
    }
    
    public function SubmissionShortAnswer($submission_raw, $question){
        // 新结构：{ text: [md], images: [ [url1,url2,...] ] }
        // 允许纯图片答案：text 可以为空，但 text 与 images 不能同时全空
        if(!is_array($submission_raw) || !array_key_exists('text', $submission_raw) || !array_key_exists('images', $submission_raw)) {
            $this->error("Not valid submission for short answer.");
        }
        $text = $submission_raw['text'];
        $images = $submission_raw['images'];
        if(!is_array($text) || count($text) != 1) {
            $this->error("Not valid submission for short answer.");
        }
        $txt0 = trim(strval($text[0]));
        if(strlen($txt0) > 16384) {
            $this->error("Answer too long.");
        }

        // 读取题目定义的图片要求数量（简答题：content[0].image_reqs）
        $contentArr = json_decode(strval($question['content']), true);
        if(!is_array($contentArr)) $contentArr = [];
        $reqs = [];
        if(isset($contentArr[0]) && is_array($contentArr[0]) && isset($contentArr[0]['image_reqs']) && is_array($contentArr[0]['image_reqs'])) {
            $reqs = $contentArr[0]['image_reqs'];
        }
        if(count($reqs) > 10) $this->error("Too many image requirements.");

        if(!is_array($images) || count($images) != 1 || !is_array($images[0])) {
            $this->error("Not valid image submission.");
        }
        // 容错：前端可能因为序列化/旧数据导致长度不一致，这里按题目定义补齐/裁剪（空位用 ''）
        $img0 = array_values($images[0]);
        $reqCnt = count($reqs);
        if(count($img0) < $reqCnt) {
            $img0 = array_merge($img0, array_fill(0, $reqCnt - count($img0), ''));
        } else if(count($img0) > $reqCnt) {
            $img0 = array_slice($img0, 0, $reqCnt);
        }
        $images = [$img0];
        // 校验路径必须在本场考试 attach 下
        $attach = $this->contest['attach'];
        $uid = $this->contest_user;
        $prefix = "/upload/contest_attach/{$attach}/exam_image/{$uid}/";
        $hasAnyImg = false;
        foreach($images[0] as $idx => $u) {
            $u = strval($u);
            // 不强制要求“图片要求必须全部上传”：允许空字符串表示未上传
            if(trim($u) !== '' && strpos($u, $prefix) !== 0) $this->error("Image path not valid.");
            if(trim($u) !== '') $hasAnyImg = true;
            $images[0][$idx] = $u;
        }
        // text + images 不能同时为空（允许纯图片）
        if($txt0 === '' && !$hasAnyImg) {
            $this->error("answer should not empty");
        }
        return [
            'text' => [$txt0],
            'images' => $images
        ];
    }
    
    public function SubmissionComprehensive($submission_raw, $question){
        // 新结构：{ text: [...], images: [ [..], [..], ... ] }
        if(!is_array($submission_raw) || !array_key_exists('text', $submission_raw) || !array_key_exists('images', $submission_raw)) {
            $this->error("Not valid submission for comprehensive.");
        }
        $text = $submission_raw['text'];
        $images = $submission_raw['images'];
        if(!is_array($text) || count($text) > 10) {
            $this->error("Too many sub questions.");
        }
        if(!is_array($images)) $this->error("Not valid image submission.");

        $contentArr = json_decode(strval($question['content']), true);
        if(!is_array($contentArr)) $contentArr = [];
        // 容错：允许前端只提交部分小题，其余补空
        $defCnt = count($contentArr);
        if(count($text) < $defCnt) {
            $text = array_merge(array_values($text), array_fill(0, $defCnt - count($text), ''));
        } else if(count($text) > $defCnt) {
            $text = array_slice(array_values($text), 0, $defCnt);
        } else {
            $text = array_values($text);
        }
        // images 也按定义长度补齐（每行按各自 reqs 补齐）
        if(!is_array($images)) $images = [];
        if(count($images) < $defCnt) {
            for($k = count($images); $k < $defCnt; $k++) $images[$k] = [];
        } else if(count($images) > $defCnt) {
            $images = array_slice(array_values($images), 0, $defCnt);
        }

        $allTextEmpty = true;
        for($i = 0; $i < count($text); $i++) {
            $t = trim(strval($text[$i]));
            if(strlen($t) > 16384) $this->error("Answer too long.");
            if($t !== '') $allTextEmpty = false;
            $text[$i] = $t;
        }

        $attach = $this->contest['attach'];
        $uid = $this->contest_user;
        $prefix = "/upload/contest_attach/{$attach}/exam_image/{$uid}/";
        $hasAnyImg = false;
        for($i = 0; $i < count($contentArr); $i++) {
            $reqs = [];
            if(isset($contentArr[$i]) && is_array($contentArr[$i]) && isset($contentArr[$i]['image_reqs']) && is_array($contentArr[$i]['image_reqs'])) {
                $reqs = $contentArr[$i]['image_reqs'];
            }
            if(count($reqs) > 10) $this->error("Too many image requirements.");
            $imgRow = isset($images[$i]) ? $images[$i] : null;
            if(!is_array($imgRow)) $this->error("Not valid image submission.");
            // 容错：按题目定义补齐/裁剪每小题图片数组长度（空位用 ''）
            $imgRow = array_values($imgRow);
            $reqCnt = count($reqs);
            if(count($imgRow) < $reqCnt) {
                $imgRow = array_merge($imgRow, array_fill(0, $reqCnt - count($imgRow), ''));
            } else if(count($imgRow) > $reqCnt) {
                $imgRow = array_slice($imgRow, 0, $reqCnt);
            }
            foreach($imgRow as $r => $u) {
                $u = strval($u);
                // 不强制要求“图片要求必须全部上传”：允许空字符串表示未上传
                if(trim($u) !== '' && strpos($u, $prefix) !== 0) $this->error("Image path not valid.");
                if(trim($u) !== '') $hasAnyImg = true;
                $imgRow[$r] = $u;
            }
            $images[$i] = $imgRow;
        }

        // text + images 不能同时为空（允许纯图片）
        if($allTextEmpty && !$hasAnyImg) $this->error("answer should not empty");

        return [
            'text' => $text,
            'images' => $images
        ];
    }

    /**
     * 考生上传答题图片（已在前端转换为 webp 并缩放至不超过 OJ_IMAGE_MAX_DIM）
     * 统一逻辑：上传到 /tmp 目录，保存答案时才移动到最终目录
     */
    public function exam_image_upload_ajax() {
        $this->QuestionSubmitAuth();
        $this->assertContestNotArchivedForWrite();
        $ex_question_id = input('ex_question_id/d');
        $sub_idx = input('sub_idx/d', 0);
        $req_idx = input('req_idx/d', 0);
        if($ex_question_id <= 0) $this->error('Not valid question.');
        if($sub_idx < 0 || $req_idx < 0) $this->error('Not valid idx.');
        if(!array_key_exists($ex_question_id, $this->problemIdMap['qid2num'])) {
            $this->error('Not valid question.');
        }

        $question = db('ex_question')->where('ex_question_id', $ex_question_id)->find();
        if($question == null) $this->error("No such question: " . $ex_question_id);
        if(intval($question['pkind']) != 15 && intval($question['pkind']) != 20) $this->error("Not image-upload question type.");

        $contentArr = json_decode(strval($question['content']), true);
        if(!is_array($contentArr)) $contentArr = [];
        $reqs = [];
        if(intval($question['pkind']) == 15) {
            $sub_idx = 0;
            if(isset($contentArr[0]) && is_array($contentArr[0]) && isset($contentArr[0]['image_reqs']) && is_array($contentArr[0]['image_reqs'])) {
                $reqs = $contentArr[0]['image_reqs'];
            }
        } else {
            if(!isset($contentArr[$sub_idx]) || !is_array($contentArr[$sub_idx])) $this->error("Not valid sub question.");
            if(isset($contentArr[$sub_idx]['image_reqs']) && is_array($contentArr[$sub_idx]['image_reqs'])) {
                $reqs = $contentArr[$sub_idx]['image_reqs'];
            }
        }
        if($req_idx >= count($reqs)) $this->error("Not valid requirement.");

        $file = request()->file('upload_file');
        if(!$file) $this->error('No file uploaded');

        $maxDim = intval(config('CsgojConfig.OJ_IMAGE_MAX_DIM'));
        if($maxDim <= 0) $maxDim = 1024;
        $ojPath = config('OjPath.');
        $uid = $this->contest_user;
        
        // 获取或生成 tmp_uuid（每个考生每个题目一个 tmp_uuid）
        $tmp_uuid = trim(input('tmp_uuid/s', ''));
        if($tmp_uuid === '') {
            // 尝试从 session 或缓存中获取，如果没有则生成新的
            $sessionKey = "exam_image_tmp_uuid_{$this->contest['contest_id']}_{$ex_question_id}_{$uid}";
            $tmp_uuid = session($sessionKey);
            if(empty($tmp_uuid) || !$this->validateTmpUuid($tmp_uuid)) {
                $tmp_uuid = GenerateUuidV4();
                session($sessionKey, $tmp_uuid);
            }
        }
        if(!$this->validateTmpUuid($tmp_uuid)) {
            $this->error('tmp_uuid not valid');
        }

        // 统一上传到临时目录
        $answerDir = $this->getAnswerImageTmpBaseDir() . '/' . $tmp_uuid . '/exam_image';
        if(!MakeDirs($answerDir)) $this->error('Folder permission denied.');

        $fname = $this->makeTmpAnswerImageFilename(($sub_idx + 1), ($req_idx + 1));
        $dest = $answerDir . '/' . $fname;
        if(is_file($dest)) @unlink($dest);

        $info = $file->validate([
            'size' => config('CsgojConfig.OJ_UPLOAD_ATTACH_MAXSIZE'),
            'ext'  => 'webp'
        ])->move($answerDir, $fname, true);
        if(!$info) $this->error("Upload failed: " . ($file->getError()));

        $finalPath = $answerDir . '/' . $fname;
        if(!is_file($finalPath)) {
            $this->error("Upload failed: file not saved to {$finalPath}");
        }

        $imgInfo = @getimagesize($finalPath);
        if(!$imgInfo) {
            @unlink($finalPath);
            $this->error('Invalid image');
        }
        if(intval($imgInfo[0]) > $maxDim || intval($imgInfo[1]) > $maxDim) {
            @unlink($finalPath);
            $this->error("Image too large: {$imgInfo[0]}x{$imgInfo[1]} (max {$maxDim}px)");
        }
        if(isset($imgInfo[2]) && intval($imgInfo[2]) !== $this->getWebpImageType()) {
            @unlink($finalPath);
            $this->error('Only WebP allowed');
        }

        // 返回临时文件名和 tmp_uuid（不返回最终 URL，因为还未移动到最终目录）
        $this->success('ok', null, [
            'file_name' => $fname,  // 临时文件名
            'tmp_uuid' => $tmp_uuid  // 临时目录 UUID
        ]);
    }
    
    public function SubmissionProgramming($submission_raw, $question){
        if(!array_key_exists('lang', $submission_raw) || !array_key_exists('code', $submission_raw)) {
            $this->error("Answer style not valid.");
        }
        $ret = [
            'lang'=> $submission_raw['lang'],
            'code'=> $submission_raw['code'],
        ];
        $solution_id = $this->SubmitProgramming2Oj($ret['lang'], $ret['code'], $question['description'], $this->contest_user);
        $ret['solution_id'] = $solution_id; // 添加 solution_id 到返回结果
        return $ret;
    }
    
    /**
     * 提交编程题到OJ
     */
    public function SubmitProgramming2Oj($language, $source, $problem_id, $user_id) {
        if(!$user_id) {
            $this->error('Please Login First!');
        }
        $this->assertContestNotArchivedForWrite();
        $now = time();
        if(session('?lastsubmit')) {
            $submitWaitTime = config('CsgojConfig.OJ_SUBMIT_WAIT_TIME');
            if($now - session('lastsubmit') < $submitWaitTime) {
                $this->error("You should not submit more than twice in ".$submitWaitTime." seconds...");
            }
        }
        if(!array_key_exists($problem_id, $this->problemIdMap['pid2qid'])) {
            $this->error('No such problem!');
        }
        if(!array_key_exists($language, $this->allowLanguage)) {
            $this->error('The submitted language is not allowed for this contest');
        }
        $problem = db('problem')->where(['problem_id'=>$problem_id])->find();
        if($problem == null) {
            $this->error('No such problem in OJ!');
        }
        $code_length = strlen($source);
        if($code_length < 6) {
            $this->error('Code too short.');
        }
        else if($code_length > 16384)
        {
            $this->error('Code too long.');
        }
        $solution_id = db('solution')->insertGetId([
            'problem_id' => $problem_id,
            'user_id' => $this->SolutionUser($user_id, true),
            'in_date' => date('Y-m-d H:i:s'),
            'language' => $language,
            'ip' => request()->ip(),
            'code_length' => $code_length,
            'contest_id' => $this->contest['contest_id']
        ]);
        if(!$solution_id) {
            $this->error('Failed to insert solution data.');
        }
        $sourceInsertResult = db('source_code')->insert([
            'solution_id' => $solution_id,
            'source' => $source
        ]);
        if(!$sourceInsertResult) {
            // 如果源代码插入失败，删除已插入的 solution 记录，避免数据不一致
            db('solution')->where('solution_id', $solution_id)->delete();
            $this->error('Failed to insert source code.');
        }
        session('lastsubmit', time());
        return $solution_id; // 返回 solution_id 供前端使用
    }
    
    /**
     * 交卷
     */
    public function submit_exam_ajax() {
        $this->assertContestNotArchivedForWrite();
        $team_id = $this->contest_user;
        $team = db('cpc_team')->where([
            'contest_id' => $this->contest['contest_id'], 
            'team_id' => $team_id
        ])->find();
        if($team == null) {
            $this->error("No such examinee.");
        }
        $team['defunct'] = 'Y';
        db('cpc_team')->update($team);
        $this->success("Now you can leave.");
    }
    
    /**
     * 心跳保持登录
     */
    public function heartbeat_ajax() {
        // PHP默认session 约24分钟回收，heart beat 保持登陆状态
        $this->success("ok");
    }
    
    /**
     * 重写 notification_change_ajax - 允许 reviewer 编辑公告
     */
    public function notification_change_ajax() {
        // 考试系统：允许 admin 和 reviewer 编辑公告
        if (!$this->IsContestAdmin('admin') && !$this->IsContestAdmin('reviewer')) {
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
    
    /**
     * 重写 notification_md_ajax - 允许 reviewer 获取公告
     */
    public function notification_md_ajax() {
        // 考试系统：允许 admin 和 reviewer 获取公告
        if (!$this->IsContestAdmin('admin') && !$this->IsContestAdmin('reviewer')) {
            $this->error('Permission denied to get contest notification markdown contents');
        }
        $contest_md = db('contest_md')->where('contest_id', $this->contest['contest_id'])->find();
        if ($contest_md && isset($contest_md['notification']))
            $notification = $contest_md['notification'];
        else
            $notification = $this->contest['notification'] ?? '';
        $this->success('OK', null, $notification);
    }
    
    public function ProblemIdMap() {
        // 重载 ProblemIdMap ，针对 exam 设置 question题号、probolem题号、num 0123、题目分数 等关系
        $contestProList = db('contest_problem')->alias('cp')
            ->join('ex_question eq', 'eq.ex_question_id = cp.problem_id')
            ->where('cp.contest_id', $this->contest['contest_id'])
            ->order('cp.num', 'asc')
            ->field([
                'cp.problem_id problem_id',
                'cp.contest_id contest_id',
                'cp.num num',
                'cp.pscore pscore',
                'eq.ex_question_id ex_question_id',
                'eq.pkind pkind',
                'eq.description description',
            ])
            ->cache(20)
            ->select();
        $this->problemIdMap = [
            'abc2id' => [],         // examsys中不使用abc，对应 num 到 OJ 的 problem_id
            'id2abc' => [],         // examsys中不使用abc，对应 OJ 的 problem_id 到 num
            'qid2pid'       => [],  // ex_question_id 映射 problem_id， 仅Programming 题目有
            'pid2qid'       => [],  // problem_id 映射 ex_question_id， 仅Programming 题目有
            'qid2num'       => [],  // ex_question_id 与 考试题目序号 num 的对应关系
            'num2qid'       => [],  // 考试题目序号 num 与 ex_question_id 的对应关系
            'num2score'     => [],  // 题目序号 num 与分数关系
            'qid2score'     => [],  // ex_question_id 与分数对应关系
            'problemset'    => [],  // probramming 题目的 problem 题号   
        ];
        if($contestProList == null) {
            return null;
        }
        foreach($contestProList as $contestPro) {
            $this->problemIdMap['qid2num'][$contestPro['problem_id']] = $contestPro['num'];
            $this->problemIdMap['num2qid'][$contestPro['num']] = $contestPro['problem_id'];
            $this->problemIdMap['num2score'][$contestPro['num']] = $contestPro['pscore'];
            $this->problemIdMap['qid2score'][$contestPro['problem_id']] = $contestPro['pscore'];
            if($contestPro['pkind'] == 25) {  // Programming 题目
                $this->problemIdMap['problemset'][] = $contestPro['description'];   // ex_question的description存储 programming problem的题号
                $this->problemIdMap['qid2pid'][$contestPro['problem_id']] = $contestPro['description'];
                $this->problemIdMap['pid2qid'][$contestPro['description']] = $contestPro['problem_id'];
                $this->problemIdMap['abc2id'][$contestPro['num']] = $contestPro['description'];
                $this->problemIdMap['id2abc'][$contestPro['description']] = $contestPro['num'];
            }
        }
    }
}

