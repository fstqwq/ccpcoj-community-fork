<?php
namespace app\exadmin\controller;
use app\admin\controller\Contest as AdminContest;
use app\common\funcs\ContestAwardMath;
use app\common\traits\AdminContestTrait;

/**
 * exadmin Contest 控制器
 * 练习管理（online-exp 模式）
 * 继承 admin/Contest，但需要重写部分方法以适配练习模式的特殊逻辑
 */
class Contest extends AdminContest
{
    use AdminContestTrait;
    /**
     * exadmin：补齐 course_item 映射（因为本类继承自 admin/Contest，不经过 Exadminbase 的 afterInsertData）
     * @param array $data
     * @param string $tableName
     * @param int|null $insertId
     * @return void
     */
    protected function afterInsertData($data, $tableName = '', $insertId = null)
    {
        if($tableName !== 'contest' || !$this->NOW_COURSE_ID || $insertId === null) {
            return;
        }
        // course_item 有唯一键 (course_id,item,item_id,pvrole)，这里用 INSERT IGNORE 避免重复
        // pvrole：新数据统一用空字符串
        try {
            \think\Db::execute(
                "INSERT IGNORE INTO course_item (course_id,item,item_id,pvrole) VALUES (" .
                intval($this->NOW_COURSE_ID) . ",'contest'," . intval($insertId) . ",'' )"
            );
        } catch (\Throwable $e) {
            // 失败不应导致主流程 500（避免出现“练习添加成功但 course_item 缺失”的错误页）
            // 这里选择吞掉异常；如需排查可在 debug_priv 打点里记录
        }
    }

    /**
     * 重写 BaseAuthentication 方法，检查教师权限
     */
    public function BaseAuthentication($privilegeStr)
    {
        $this->BaseAuth();
    }
    
    /**
     * 权限检查方法（供其他方法调用）
     */
    protected function BaseAuth()
    {
        // 仅练习模式可用
        if($this->OJ_MODE != 'online' || $this->OJ_STATUS != 'exp') {
            $this->error('练习管理仅适用于练习模式', '/');
        }
        
        // 检查权限：全局管理员/编辑权限 或 当前课程的教师权限
        if(!IsAdmin('problem_editor') && !IsAdmin('contest_editor') && !PrivCourse('teacher', $this->NOW_COURSE_KEY)) {
            $this->error('无管理权限', '/');
        }
    }
    
    public function index() {
        $this->redirect('contest_list');
    }
    
    public function contest_list() {
        if($this->OJ_MODE == 'online' && $this->OJ_STATUS == 'exp') {
            $this->assign('pagetitle', '课程练习');
            $this->assign('pagetitle_en', 'Course Practice');
        } else {
            $this->error('无效的访问', '/');
        }
        return $this->fetch();
    }
    
    /**
     * 重写钩子方法：获取 contest 的 protected 过滤条件
     * 练习模式：protected % 10 == 4
     * @return array ThinkPHP 查询格式，如 ['in', [4, 14]]
     */
    protected function getContestProtectedFilter()
    {
        return ['in', [4, 14]];
    }
    
    /**
     * 重写钩子方法：获取 contest_list 的额外查询条件
     * 练习模式：添加 clss_id 条件
     */
    protected function getContestListExtraMap()
    {
        $extraMap = [];
        $clss_id = input('clss_id/d');
        if($clss_id !== null) {
            $extraMap['clss_id'] = $clss_id;
        }
        return $extraMap;
    }
    
    /**
     * 重写钩子方法：应用 contest_list 的额外 join
     * 练习模式：关联 clss 表
     */
    protected function applyContestListJoin($query)
    {
        // 练习模式关联 clss 表
        return $query->alias('c')
            ->join('clss cl', 'c.clss_id = cl.clss_id', 'left');
    }
    
    /**
     * 重写钩子方法：获取 contest_list 的字段列表
     * 练习模式：添加 clss 相关字段
     */
    protected function getContestListFields()
    {
        return [
            'c.*',
            'cl.clss_title clss_title',
            'cl.clss_year clss_year',
            'cl.clss_semester clss_semester',
        ];
    }

    /**
     * exadmin 练习列表（返回 expsys/contest_filter.js 支持的新格式）
     * 返回：{ contest_list: [...], clss_list: [...], user_list: [...] }
     */
    public function contest_list_ajax()
    {
        $this->BaseAuth();

        // 筛选：公开状态（-1 表示全部）
        $defunct = input('defunct/d', -1);
        // 额外筛选：班级
        $clss_id = input('clss_id/d', 0);

        // 检查是否是管理员（全局管理员或课程管理员）
        $is_global_admin = IsAdmin();
        $is_course_admin = PrivCourse('admin', $this->NOW_COURSE_KEY);
        $is_teacher_only = !$is_global_admin && !$is_course_admin && PrivCourse('teacher', $this->NOW_COURSE_KEY);

        // 练习类型：4=练习，14=练习+附加题；排除「练习模板」（flg_archive 非 0）
        $Contest = db('contest')->alias('c')
            ->join('clss cl', 'c.clss_id = cl.clss_id', 'left')
            ->where('c.private', 'in', [4, 14])
            ->where([
                'cl.defunct' => 'C'
            ])
            ->where(function ($q) {
                $q->whereNull('c.flg_archive')->whereOr('c.flg_archive', 0);
            });
        
        // ThinkPHP 5.1: cache(10) 等同于 cache(true,10)，若查询 options 含闭包(where(function...)) 将无法自动生成缓存Key
        // 因此这里必须显式指定缓存 Key（按课程/身份隔离，避免串数据）
        $cacheKeyBase = 'exadmin:contest_list_ajax:' . intval($this->NOW_COURSE_ID) . ':' . ($is_global_admin ? 'admin' : ('u:' . strval(session('user_id'))))
            . ':d:' . strval($defunct) . ':c:' . strval($clss_id);

        // 课程过滤：必须有 NOW_COURSE_ID，不做任何回退/兼容旧行为
        $course_id = $this->NOW_COURSE_ID;
        if ($course_id) {
            $Contest->join('course_item ci_clss', "ci_clss.item_id = cl.clss_id AND ci_clss.item = 'clss'", 'inner')
                ->where('ci_clss.course_id', intval($course_id))
                ->where(function($q) {
                    $q->whereNull('ci_clss.pvrole')->whereOr('ci_clss.pvrole', '');
                });
        } else {
            $this->error('未选择课程组', '/course');
        }

        // 课程教师：可查看本课程全部练习；写权限由每行的 is_admin 决定（是否是该班级教师/课程管理员）

        if($defunct !== null && intval($defunct) !== -1) {
            $Contest->where('c.defunct', intval($defunct));
        }
        if($clss_id && intval($clss_id) > 0) {
            $Contest->where('c.clss_id', intval($clss_id));
        }

        // 只查询前端需要的字段（避免传输和处理开销）
        $contest_list = $Contest->field([
                'c.contest_id',
                'c.title',
                'c.start_time',
                'c.end_time',
                'c.defunct',
                'c.private',
                'c.clss_id',
                'cl.clss_title clss_title',
                'cl.clss_year clss_year',
                'cl.clss_semester clss_semester'
            ])
            ->order(['c.contest_id' => 'desc'])
            ->cache($cacheKeyBase . ':list', 2)
            ->select();

        // 提取 clss_id 列表
        $clss_ids = [];
        foreach($contest_list as $c) {
            if(isset($c['clss_id']) && intval($c['clss_id']) > 0) {
                $clss_ids[intval($c['clss_id'])] = true;
            }
        }
        $clss_ids = array_keys($clss_ids);

        // 批量获取教师（teachers 仅存 user_id 数组）
        $pvrole_teacher = GetPvroleConfig('clss_teacher', 'teacher');
        $teachers_map = [];
        $teacher_user_ids = [];
        if(!empty($clss_ids)) {
            $teachers_list = db('privilege_item')
                ->where([
                    'rightitem' => 'clss',
                    'pvrole' => $pvrole_teacher,
                    'defunct' => '0'
                ])
                ->where('item_id', 'in', $clss_ids)
                ->field(['item_id', 'user_id'])
                ->select();
            foreach($teachers_list as $t) {
                $cid = intval($t['item_id']);
                if(!isset($teachers_map[$cid])) $teachers_map[$cid] = [];
                $uid = strval($t['user_id']);
                $teachers_map[$cid][] = $uid;
                $teacher_user_ids[$uid] = true;
            }
        }

        // user_list：教师用户信息（供前端填充 teachers 的 nick/school）
        $user_list = [];
        if(!empty($teacher_user_ids)) {
            $uids = array_keys($teacher_user_ids);
            $users = db('users')->where('user_id', 'in', $uids)
                ->field(['user_id', 'nick', 'school'])
                ->select();
            foreach($users as $u) {
                $user_list[] = [
                    'user_id' => $u['user_id'],
                    'nick' => $u['nick'] ?: $u['user_id'],
                    'school' => $u['school'] ?: ''
                ];
            }
        }

        // 管理权限：全局管理员或课程管理员 => 可管理全部；否则仅班级教师可管理
        $now_user_id = session('user_id');
        $is_course_admin = function_exists('PrivCourse') ? PrivCourse('admin', $this->NOW_COURSE_KEY) : false;
        $is_global_admin = IsAdmin();
        foreach($contest_list as &$contest) {
            $cid = intval($contest['clss_id'] ?? 0);
            $contest['teachers'] = isset($teachers_map[$cid]) ? array_values(array_unique($teachers_map[$cid])) : [];
            $contest['is_admin'] = $is_global_admin || $is_course_admin || in_array($now_user_id, $contest['teachers']);
        }
        // 重要（PHP foreach 引用特性）：
        // - 上一个循环使用了 foreach ($contest_list as &$contest)（按引用遍历）；
        // - 在 PHP 中，循环结束后变量 $contest 仍然“引用”着 $contest_list 的最后一个元素；
        // - 如果后续再写 foreach ($contest_list as $contest)（非引用，但变量名相同），
        //   每轮给 $contest 赋值都会通过该“残留引用”改写最后一个元素；
        // - 典型表现是最后一项被前面某一项覆盖（例如末项重复、某一项看似丢失）。
        //
        // 因此这里必须 unset($contest) 主动断开引用，再进入后续 foreach。
        // 这是 PHP 的已知行为（非业务逻辑问题），属于引用遍历后的固定防御写法。
        unset($contest);

        // clss_list：从 contest_list 去重提取（teachers 只存 user_id 数组）
        $clss_list = [];
        $clss_seen = [];
        foreach($contest_list as $contest) {
            $cid = intval($contest['clss_id'] ?? 0);
            if($cid <= 0 || isset($clss_seen[$cid])) continue;
            $clss_seen[$cid] = true;
            $clss_list[] = [
                'clss_id' => $cid,
                'title' => $contest['clss_title'] ?? '',
                'year' => $contest['clss_year'] ?? null,
                'semester' => $contest['clss_semester'] ?? '',
                'teachers' => isset($teachers_map[$cid]) ? array_values(array_unique($teachers_map[$cid])) : []
            ];
        }

        return [
            'contest_list' => $contest_list,
            'clss_list' => $clss_list,
            'user_list' => $user_list
        ];
    }
    
    public function contest_addedit_ajax_process() {
        $postData = input('post.');
        $title = trim(strval($postData['title'] ?? ''));
        $startStr =
            trim($postData['start_year'] ?? '').'-'.
            trim($postData['start_month'] ?? '').'-'.
            trim($postData['start_day'] ?? '').' '.
            trim($postData['start_hour'] ?? '').':'.
            trim($postData['start_minute'] ?? '').':0';
        $endStr =
            trim($postData['end_year'] ?? '').'-'.
            trim($postData['end_month'] ?? '').'-'.
            trim($postData['end_day'] ?? '').' '.
            trim($postData['end_hour'] ?? '').':'.
            trim($postData['end_minute'] ?? '').':0';
        return $this->contestExadminBuildRowWithTimes($postData, $title, $startStr, $endStr);
    }

    /**
     * 练习表单公共字段 + 指定的 title / 起止时间（title 仅信任入参，不做服务端拼接）。
     *
     * @param array  $postData    原始 POST
     * @param string $title       已裁剪的总标题
     * @param string $startTimeStr strtotime 可解析的字符串或 Y-m-d H:i:s
     * @param string $endTimeStr   同上
     * @return array{0: array, 1: array}
     */
    protected function contestExadminBuildRowWithTimes(array $postData, string $title, string $startTimeStr, string $endTimeStr): array
    {
        $exp_auto_title = intval($postData['exp_auto_title'] ?? 0);
        $title_suffix = trim(strval($postData['title_suffix'] ?? ''));
        $title = trim($title);
        $contest_info = [
            'title'         => $title,
            'start_time'    => trim($startTimeStr),
            'end_time'      => trim($endTimeStr),
            'langmask'      => $this->CalLangMask(isset($postData['language']) ? $postData['language'] : []),
            'password'      => trim($postData['password'] ?? ''),
            'description'   => trim(strval($postData['description'] ?? '')),
            'notification'  => trim(strval($postData['notification'] ?? '')),
        ];
        $contest_info['private'] = 4;
        $contest_info['frozen_minute'] = intval($postData['frozen_minute'] ?? 0);
        $contest_info['frozen_after'] = intval($postData['frozen_after'] ?? 0);

        if ($exp_auto_title) {
            if ($title_suffix === '') {
                $this->error('实验短标题不能为空');
            }
            if ($title === '') {
                $this->error('请填写总标题（或由前端自动组合后提交）');
            }
        } elseif ($title === '') {
            $this->error('Title should not be empty.');
        }
        $attach_pro = input('?attach_pro') ? input('attach_pro/d') : 0;
        $contest_info['topteam'] = intval($postData['topteam'] ?? 1);
        if ($contest_info['topteam'] > 20) {
            $contest_info['topteam'] = 20;
        }
        if ($contest_info['topteam'] < 1) {
            $contest_info['topteam'] = 1;
        }
        $contest_info['private'] = $attach_pro * 10 + $contest_info['private'];

        if ($contest_info['frozen_minute'] > 2592000 || $contest_info['frozen_after'] > 2592000) {
            $this->error('Frozen time too long.');
        }
        $passLen = strlen($contest_info['password']);
        if ($passLen > 15) {
            $this->error('Contest Password should NOT more than 15 characters');
        }
        $contest_md_info = [
            'description'  => $contest_info['description'],
            'notification' => $contest_info['notification'],
        ];
        $contest_info['description'] = ParseMarkdown($contest_md_info['description']);
        $contest_info['notification'] = ParseMarkdown($contest_md_info['notification']);

        if (!strtotime($contest_info['start_time']) || !strtotime($contest_info['end_time'])) {
            $this->error('Time syntax error.');
        }
        $starttime = strtotime($contest_info['start_time']);
        $endtime = strtotime($contest_info['end_time']);
        if ($starttime >= $endtime) {
            $this->error('Start Time should before End Time.');
        }
        $ratio_gold = intval($postData['ratio_gold'] ?? 0);
        $ratio_silver = intval($postData['ratio_silver'] ?? 0);
        $ratio_bronze = intval($postData['ratio_bronze'] ?? 0);
        $flg_award_qty_mode = ContestAwardMath::normalizeQtyMode($postData['flg_award_qty_mode'] ?? 0);
        $errAward = ContestAwardMath::validateAwardTripleI18n($ratio_gold, $ratio_silver, $ratio_bronze, $flg_award_qty_mode);
        if ($errAward !== null) {
            $this->errorBilingual($errAward['msg_cn'], $errAward['msg_en']);
        }
        $contest_info['award_ratio'] = ContestAwardMath::pack($ratio_gold, $ratio_silver, $ratio_bronze);
        $contest_info['flg_award_qty_mode'] = $flg_award_qty_mode;
        $contest_info['start_time'] = date('Y-m-d H:i:s', $starttime);
        $contest_info['end_time'] = date('Y-m-d H:i:s', $endtime);
        return [$contest_info, $contest_md_info];
    }

    /**
     * 多班添加：前端 JSON 批次，顺序与 clss_ids 一致，每项含 clss_id/title/start_time/end_time。
     *
     * @param string $json
     * @param int[]  $clssIdsOrdered
     * @return array<int, array{clss_id:int,title:string,start_time:string,end_time:string}>
     */
    protected function parseExpPracticeBatchFromPost(string $json, array $clssIdsOrdered): array
    {
        $arr = json_decode($json, true);
        if (!is_array($arr) || $arr === []) {
            $this->error('练习批次数据格式错误');
        }
        if (count($arr) !== count($clssIdsOrdered)) {
            $this->error('批次与所选班级数量不一致');
        }
        $out = [];
        foreach ($clssIdsOrdered as $i => $expectCid) {
            $expectCid = intval($expectCid);
            $item = $arr[$i] ?? null;
            if (!is_array($item)) {
                $this->error('练习批次数据格式错误');
            }
            if (intval($item['clss_id'] ?? 0) !== $expectCid) {
                $this->error('批次班级与选择不一致，请刷新页面');
            }
            $t = trim(strval($item['title'] ?? ''));
            if ($t === '') {
                $this->error('每个班级均需填写练习标题');
            }
            if (mb_strlen($t, 'UTF-8') > 255) {
                $t = mb_substr($t, 0, 255, 'UTF-8');
            }
            $st = trim(strval($item['start_time'] ?? ''));
            $en = trim(strval($item['end_time'] ?? ''));
            if ($st === '' || $en === '') {
                $this->error('每个班级均需填写开始与结束时间');
            }
            if (!strtotime($st) || !strtotime($en)) {
                $this->error('时间格式错误');
            }
            $ts = strtotime($st);
            $te = strtotime($en);
            if ($ts >= $te) {
                $this->error('开始时间须早于结束时间');
            }
            $out[] = [
                'clss_id'    => $expectCid,
                'title'      => $t,
                'start_time' => date('Y-m-d H:i:s', $ts),
                'end_time'   => date('Y-m-d H:i:s', $te),
            ];
        }
        return $out;
    }
    
    public function contest_add() {
        $now = time();
        $assignData = [
            'start_year'    => date('Y', $now),
            'start_month'   => date('m', $now),
            'start_day'     => date('d', $now),
            'start_hour'    => date('H', $now),
            'start_minute'  => 0,
            'end_year'      => date('Y', $now + 18000),
            'end_month'     => date('m', $now + 18000),
            'end_day'       => date('d', $now + 18000),
            'end_hour'      => date('H', $now + 18000),
            'end_minute'    => 0,
            'edit_mode'     => false
        ];
        
        // 练习模式
        $assignData['protected'] = 4;
        $assignData['topteam'] = 1;
        $assignData['ratio_gold'] = 10;
        $assignData['ratio_silver'] = 15;
        $assignData['ratio_bronze'] = 20;
        $assignData['frozen_minute'] = 60;
        $assignData['frozen_after'] = 15;

        // 班级选择器权限：课程管理员可见本课程全部班级；否则仅可见自己管辖的班级
        $assignData['is_course_admin'] = PrivCourse('admin', $this->NOW_COURSE_KEY);
        
        $assignData['prefill_problems'] = '';
        $assignData['prefill_description'] = '';
        $assignData['prefill_title_suffix'] = '';
        $assignData['prefill_exp_no'] = 1;
        $assignData['exp_auto_title_default'] = 1;
        $from_tpl_id = input('from_tpl_id/d', 0);
        if ($from_tpl_id > 0) {
            $this->assertContestBelongsToNowCourse($from_tpl_id);
            $tpl = db('contest')->where('contest_id', $from_tpl_id)->field([
                'contest_id', 'title', 'private', 'addition', 'flg_archive',
            ])->find();
            if (!$tpl || intval($tpl['flg_archive'] ?? 0) === 0) {
                $this->error('无效的模板练习');
            }
            $p10 = intval($tpl['private']) % 10;
            if ($p10 !== 4 && $p10 !== 14) {
                $this->error('无效的模板练习');
            }
            $tplMd = db('contest_md')->where('contest_id', $from_tpl_id)->find();
            $descMd = $tplMd && isset($tplMd['description']) ? strval($tplMd['description']) : '';
            $add = [];
            if (!empty($tpl['addition'])) {
                if (is_string($tpl['addition'])) {
                    $add = Json2Array($tpl['addition']) ?: [];
                } elseif (is_array($tpl['addition'])) {
                    $add = $tpl['addition'];
                }
            }
            $ep = isset($add['exp_practice']) && is_array($add['exp_practice']) ? $add['exp_practice'] : [];
            $tt = isset($ep['template_title']) ? trim(strval($ep['template_title'])) : '';
            if ($tt === '') {
                $tt = trim(strval($tpl['title'] ?? ''));
            }
            $tplPrivate = intval($tpl['private']);
            $assignData['protected'] = $tplPrivate;
            $assignData['contest'] = ['private' => $tplPrivate, 'protected' => $tplPrivate];
            $assignData['prefill_description'] = $descMd;
            $assignData['prefill_title_suffix'] = $tt;
            $assignData['exp_auto_title_default'] = 1;
            $tplSort = isset($ep['template_sort']) ? intval($ep['template_sort']) : 0;
            $assignData['prefill_exp_no'] = max(0, min(999, $tplSort));
            $contestProblem = db('contest_problem')->where('contest_id', $from_tpl_id)->order('num')->select();
            $pids = [];
            foreach ($contestProblem as $cp) {
                $pids[] = intval($cp['problem_id']);
            }
            $assignData['prefill_problems'] = implode(',', array_filter($pids));
        }
        if (!isset($assignData['prefill_exp_no'])) {
            $assignData['prefill_exp_no'] = 1;
        }
        
        // 设置页面标题
        $this->assign('pagetitle', '添加练习');
        
        $this->assign($assignData);
        return $this->fetch('contest_edit');
    }
    
    public function contest_add_ajax() {
        if (!$this->NOW_COURSE_ID) {
            $this->error('请在课程内操作（缺少 course 上下文）');
        }
        if (!PrivCourse('teacher', $this->NOW_COURSE_KEY)) {
            $this->error('无课程权限');
        }

        $postData = input('post.');
        $clss_ids_str = input('clss_ids/s', '');
        $clss_id_single = input('clss_id/d', 0);
        $clss_ids = [];
        if (!empty($clss_ids_str)) {
            $clss_ids = array_values(array_filter(array_map('intval', explode(',', $clss_ids_str))));
        } elseif ($clss_id_single > 0) {
            $clss_ids = [$clss_id_single];
        }
        if (empty($clss_ids)) {
            $this->error('请至少选择一个班级');
        }

        $is_course_admin = PrivCourse('admin', $this->NOW_COURSE_KEY);
        foreach ($clss_ids as $clss_id) {
            if (!$is_course_admin && !$this->CheckClssPriv($clss_id)) {
                $this->error("没有为班级 {$clss_id} 添加练习的权限");
            }
        }

        $exp_auto = intval($postData['exp_auto_title'] ?? 0);
        $title_suffix = trim(strval($postData['title_suffix'] ?? ''));
        $exp_no_raw = $postData['exp_no'] ?? '';
        if ($exp_auto && $title_suffix === '') {
            $this->error('实验短标题不能为空');
        }
        $exp_no_int = $exp_auto
            ? $this->parseExpNoFromPost($exp_no_raw, null)
            : $this->parseExpNoFromPost($exp_no_raw, 1);

        $batchJson = trim(strval($postData['exp_batch_json'] ?? ''));
        if ($batchJson === '') {
            $this->error('缺少练习批次数据，请刷新页面后重试');
        }
        $batch = $this->parseExpPracticeBatchFromPost($batchJson, $clss_ids);

        $attachFolder = $this->AttachFolderCalculation(session('user_id'));
        $created_ids = [];
        $addmsg_list = [];

        foreach ($batch as $it) {
            $ret = $this->contestExadminBuildRowWithTimes($postData, $it['title'], $it['start_time'], $it['end_time']);
            $contest_add = $ret[0];
            $contest_md_add = $ret[1];
            $contest_add['attach'] = $attachFolder;
            $contest_add['defunct'] = '1';
            $row = $contest_add;
            $row['clss_id'] = $it['clss_id'];
            $row['addition'] = $this->mergeExpNoIntoAddition($row['addition'] ?? null, $exp_no_int);

            $contest_id = db('contest')->insertGetId($row);
            if (!$contest_id) {
                $this->error('Add contest failed, SQL error.');
            }
            $created_ids[] = $contest_id;
            $this->afterInsertData($row, 'contest', $contest_id);

            $Contest_md = db('contest_md');
            $contest_md = $Contest_md->where('contest_id', $contest_id)->find();
            $mdRow = $contest_md_add;
            $mdRow['contest_id'] = $contest_id;
            if ($contest_md == null) {
                $Contest_md->insert($mdRow);
            } else {
                $Contest_md->update($mdRow);
            }

            $addmsg = $this->contest_outeritem_add($contest_id, $row);
            if ($addmsg) {
                $addmsg_list[] = $addmsg;
            }
            if (method_exists($this, 'afterContestCreated')) {
                $this->afterContestCreated($contest_id, $row);
            } elseif (session('?contest_editor')) {
                $this->AddPrivilege(session('user_id'), 'contest', $contest_id);
            }
        }

        $count = count($created_ids);
        $addmsg_combined = !empty($addmsg_list) ? '<br/>' . implode('<br/>', array_unique($addmsg_list)) : '';
        if ($count === 1) {
            $this->success('练习添加成功。' . $addmsg_combined, '', ['id' => $created_ids[0]]);
        }
        $this->success("已为 {$count} 个班级添加练习。" . $addmsg_combined, '', ['ids' => $created_ids, 'count' => $count]);
    }
    
    protected function CheckClssPriv($clss_id) {
        if(!$clss_id || !session('?user_id')) {
            return false;
        }
        
        // 检查是否是管理员
        // clss 表不再存 course_key，统一从 course_item(item='clss') 反查
        $clss_course_key = GetCourseKeyFromCourseItem('clss', $clss_id);
        if($clss_course_key && (IsAdmin() || PrivCourse('admin', $clss_course_key))) {
            return true;
        }
        
        // 从配置获取 pvrole 值
        $pvrole_teacher = GetPvroleConfig('clss_teacher', 'teacher');
        
        // 使用 privilege_item 表查询（pvrole='teacher'）
        $teacher_count = db('privilege_item')->where([
            'rightitem' => 'clss',
            'item_id' => $clss_id,
            'user_id' => session('user_id'),
            'pvrole' => $pvrole_teacher,
            'defunct' => '0'
        ])->count();
        
        return $teacher_count > 0;
    }
    
    public function contest_edit($copy_mode=false) {
        $contest_id = trim(input('id'));
        $contest = db('contest')->where('contest_id', $contest_id)->find();
        if($contest == null) {
            $this->error('No such contest.');
        }
        
        // 验证权限：
        // - 非 copy：允许“只读查看”，但不允许写（写权限由 contest_edit_ajax 再次校验）
        // - copy：允许所有课程教师复制（复用编辑页）
        $can_write = IsAdmin('contest', $contest_id) ||
            PrivCourse('admin', $this->NOW_COURSE_KEY) ||
            $this->CheckClssPriv($contest['clss_id']);
        $view_only = (!$copy_mode && !$can_write);
        
        if($copy_mode) {
            if(strtotime($contest['start_time']) <= time()) {
                $current_time = time();
                $minutes = date('i', $current_time);
                if($minutes <= 30) {
                    $new_start_time = mktime(date('H', $current_time), 30, 0, date('n', $current_time), date('j', $current_time), date('Y', $current_time));
                } else {
                    $new_start_time = mktime(date('H', $current_time) + 1, 0, 0, date('n', $current_time), date('j', $current_time), date('Y', $current_time));
                }
                $contest['start_time'] = date('Y-m-d H:i:s', $new_start_time);
                $contest['end_time'] = date('Y-m-d H:i:s', $new_start_time + 18000);
            }
        }
        
        $this->CourseBelongValidate($contest, 'contest');
        
        // 获取班级信息（用于只读模式显示）
        $clss_info = null;
        if(isset($contest['clss_id']) && $contest['clss_id'] > 0) {
            $clss_info = db('clss')->where('clss_id', $contest['clss_id'])
                ->field('clss_id, clss_title, clss_semester, clss_year')
                ->find();
        }
        
        $contest_md = db('contest_md')->where('contest_id', $contest_id)->find();
        if($contest_md != null) {
            $contest = array_replace($contest, $contest_md);
        }
        // 兼容字段：旧逻辑使用 protected，但表字段是 private
        if(!isset($contest['protected'])) {
            $contest['protected'] = $contest['private'] ?? 0;
        }
        
        // 添加班级信息到 contest 数组（用于视图显示）
        if($clss_info) {
            $contest['clss_title'] = $clss_info['clss_title'];
            $contest['clss_semester'] = $clss_info['clss_semester'];
            $contest['clss_year'] = $clss_info['clss_year'];
        }
        $start = strtotime($contest['start_time']);
        $end = strtotime($contest['end_time']);
        
        $assignData = [
            'start_year'    => date('Y', $start),
            'start_month'   => date('m', $start),
            'start_day'     => date('d', $start),
            'start_hour'    => date('H', $start),
            'start_minute'  => date('i', $start),
            'end_year'      => date('Y', $end),
            'end_month'     => date('m', $end),
            'end_day'       => date('d', $end),
            'end_hour'      => date('H', $end),
            'end_minute'    => date('i', $end),
            'protected'       => $contest['protected'] ?? ($contest['private'] ?? 0),
            'contest'       => $contest,
            'ojLang'        => config('CsgojConfig.OJ_LANGUAGE'),
            'edit_mode'     => true,
            'copy_mode'     => $copy_mode,
            'view_only'     => $view_only,
        ];
        
        // 练习模式：处理题目、用户、奖励比例
        $contestProblem = db('contest_problem')->where('contest_id', $contest_id)->order('num')->select();
        $problems = [];
        foreach($contestProblem as $problem) {
            $p = $problem['problem_id'];
            $problems[] = $p;
        }
        // exadmin 模块不需要查询参赛用户（练习模式通过班级管理用户）
        $award_ratio = $contest['award_ratio'];
        $ratio_gold = $award_ratio % 1000; $award_ratio /= 1000;
        $ratio_silver = $award_ratio % 1000; $award_ratio /= 1000;
        $ratio_bronze = $award_ratio % 1000; $award_ratio /= 1000;
        
        $assignData['topteam'] = $contest['topteam'];
        $assignData['ratio_gold'] = $ratio_gold;
        $assignData['ratio_silver'] = $ratio_silver;
        $assignData['ratio_bronze'] = $ratio_bronze;
        $assignData['frozen_minute'] = $contest['frozen_minute'];
        $assignData['frozen_after'] = $contest['frozen_after'];
        $assignData['problems'] = implode(",", $problems);
        $assignData['users'] = ''; // exadmin 模块不需要用户列表
        $assignData['item_priv'] = IsAdmin('contest', $contest['contest_id']);
        
        // 检查是否是课程管理员（用于班级选择权限控制）
        // 使用 PrivItem 检查：rightitem='course', item_id=course_id, pvrole='admin'
        $assignData['is_course_admin'] = PrivCourse('admin', $this->NOW_COURSE_KEY);
        $assignData['exp_auto_title_default'] = $copy_mode ? 1 : 0;
        $assignData['prefill_exp_no'] = $this->resolveExpNoForForm($contest);
        
        // 设置页面标题
        if($copy_mode) {
            $this->assign('pagetitle', '复制练习');
        } else if($view_only) {
            $this->assign('pagetitle', '查看练习');
        } else {
            $this->assign('pagetitle', '编辑练习');
        }
        
        $this->assign($assignData);
        return $this->fetch('contest_edit');
    }
    
    public function contest_copy() {
        return $this->contest_edit(true);
    }
    
    public function contest_edit_ajax() {
        $contest_id = trim(input('contest_id'));
        $Contest = db('contest');
        $contestinfo = $Contest->where('contest_id', $contest_id)->find();
        if(!$contestinfo) {
            $this->error('No such contest.');
        }
        
        // 验证权限
        if(!IsAdmin('contest', $contest_id) && 
            !PrivCourse('admin', $this->NOW_COURSE_KEY) &&
            !$this->CheckClssPriv($contestinfo['clss_id'])) {
            $this->error('无该练习的编辑权限 contest_id=' . $contest_id);
        }
        
        $ret = $this->contest_addedit_ajax_process();
        $contest_edit = $ret[0];
        $contest_md_edit = $ret[1];
        $contestinfo = array_replace($contestinfo, $contest_edit);
        
        $is_course_admin = PrivCourse('admin', $this->NOW_COURSE_KEY);

        // 编辑练习时：仅课程管理员允许“更换绑定班级”，且只能绑定 1 个班级
        if($is_course_admin) {
            $clss_ids_str = input('clss_ids/s', '');
            $clss_id_single = input('clss_id/d', 0);
            $clss_ids = [];
            if (!empty($clss_ids_str)) {
                $clss_ids = array_values(array_filter(array_map('intval', explode(',', $clss_ids_str))));
            } elseif ($clss_id_single > 0) {
                $clss_ids = [$clss_id_single];
            }
            if (!empty($clss_ids)) {
                if (count($clss_ids) !== 1) {
                    $this->error("编辑练习时只能绑定一个班级");
                }
                $new_clss_id = intval($clss_ids[0]);
                if ($new_clss_id > 0 && intval($contestinfo['clss_id']) !== $new_clss_id) {
                    // 限制：只能切换到当前课程下的有效班级
                    $clss_query = db('clss')->alias('cl')
                        ->where([
                            'cl.clss_id' => $new_clss_id,
                            'cl.defunct' => 'C'
                        ]);
                    if ($this->NOW_COURSE_ID) {
                        $clss_query->join('course_item ci_clss', "ci_clss.item_id = cl.clss_id AND ci_clss.item = 'clss'", 'inner')
                            ->where('ci_clss.course_id', $this->NOW_COURSE_ID)
                            ->where(function($q) {
                                $q->whereNull('ci_clss.pvrole')->whereOr('ci_clss.pvrole', '');
                            });
                    }
                    $clss_info = $clss_query->field('cl.clss_id')->find();
                    if(!$clss_info) {
                        $this->error("目标班级不可用或不属于当前课程");
                    }
                    $contestinfo['clss_id'] = $new_clss_id;
                }
            }
        } else {
            // 非课程管理员：不允许更换绑定班级，只要仍对原班级有权限即可
            if(!$this->CheckClssPriv($contestinfo['clss_id'])) {
                $this->error("没有修改班级练习的权限");
            }
        }

        $exp_auto = intval(input('post.exp_auto_title', 0));
        $exp_no_raw = input('post.exp_no/s', '');
        if ($exp_auto) {
            $ts = trim(strval(input('post.title_suffix/s', '')));
            if ($ts === '') {
                $this->error('实验短标题不能为空');
            }
        }
        $exp_no_int = $exp_auto
            ? $this->parseExpNoFromPost($exp_no_raw, null)
            : $this->parseExpNoFromPost($exp_no_raw, $this->resolveExpNoForForm($contestinfo));
        $contestinfo['addition'] = $this->mergeExpNoIntoAddition($contestinfo['addition'] ?? null, $exp_no_int);
        
        $Contest->update($contestinfo);
        $Contest_md = db('contest_md');
        $contest_md = $Contest_md->where('contest_id', $contest_id)->find();
        $contest_md_edit['contest_id'] = $contest_id;
        if(!$contest_md) {
            $Contest_md->insert($contest_md_edit);
        } else {
            $contest_md_edit['contest_id'] = $contest_id;
            $Contest_md->update($contest_md_edit);
        }
        
        $addmsg = $this->contest_outeritem_add($contest_id, $contestinfo);
        
        $successmsg = 'Contest successfully edited.' . (isset($addmsg) && $addmsg != '' ? '<br/>'.$addmsg : '');
        $this->success($successmsg);
    }
    
    protected function CalLangMask($languages) {
        $ret = LangList2LangMask($languages);
        if($ret == -1) $this->error('Please select at least 1 language.');
        if($ret == -2) $this->error('Some languages are not allowed for this OJ.');
        return $ret;
    }
    
    public function AttachFolderCalculation($randStr = '') {
        $day = date('y-m-d');
        $uuid = GenerateUuidV4();
        return $day . '-' . $uuid;
    }
    
    /**
     * 练习模式：处理题目和用户
     */
    protected function contest_outeritem_add($contest_id, $contest) {
        $ret = $this->contest_outeritem_add_problems($contest_id, $contest, [
            'with_balloon_colors' => false,
            'include_title' => false,
        ]);
        
        // exadmin 模块不需要处理参赛用户（练习模式通过班级管理用户）
        // 跳过 Contest Users 处理
        
        return $ret;
    }
    
    /**
     * 重写 AddPrivilege 方法，使用全局函数（统一管理）
     * 在 OJ_STATUS=exp 模式下，创建新资源时不检查权限（checkPrivilege=false）
     */
    public function AddPrivilege($user_id, $item, $id) {
        // exp 模式下创建新资源时，不检查权限（因为资源刚创建，还没有权限记录）
        $checkPrivilege = ($this->OJ_STATUS != 'exp');
        try {
            AddPrivilege($user_id, $item, $id, $checkPrivilege, 'admin');
        } catch (\Exception $e) {
            $this->error($e->getMessage());
        }
    }

    /**
     * 当前课程 course_item 是否包含该 contest
     */
    protected function assertContestBelongsToNowCourse($contest_id)
    {
        $contest_id = intval($contest_id);
        if ($contest_id <= 0 || empty($this->NOW_COURSE_ID)) {
            $this->error('无效的练习');
        }
        $n = db('course_item')->where([
            'course_id' => intval($this->NOW_COURSE_ID),
            'item' => 'contest',
            'item_id' => $contest_id,
        ])->where(function ($q) {
            $q->whereNull('pvrole')->whereOr('pvrole', '');
        })->count();
        if ($n < 1) {
            $this->error('练习不属于当前课程');
        }
    }

    /**
     * POST 实验序号：0～999 非负整数；空串时用 $default（保存非自动标题时允许缺省）。
     */
    protected function parseExpNoFromPost($raw, $default = null)
    {
        $s = trim(strval($raw ?? ''));
        if ($s === '') {
            if ($default !== null) {
                return intval($default);
            }
            $this->error('请填写实验序号（0～999）');
        }
        if (!ctype_digit($s)) {
            $this->error('实验序号须为0～999的整数');
        }
        $n = intval($s);
        if ($n > 999) {
            $this->error('实验序号须为0～999的整数');
        }
        return $n;
    }

    /**
     * 写入 addition.exp_practice.exp_no（整数），保留其它 JSON 键。
     *
     * @param mixed $rawAddition
     */
    protected function mergeExpNoIntoAddition($rawAddition, int $expNo): string
    {
        $arr = [];
        if (!empty($rawAddition)) {
            if (is_string($rawAddition)) {
                $arr = Json2Array($rawAddition) ?: [];
            } elseif (is_array($rawAddition)) {
                $arr = $rawAddition;
            }
        }
        if (!isset($arr['exp_practice']) || !is_array($arr['exp_practice'])) {
            $arr['exp_practice'] = [];
        }
        $arr['exp_practice']['exp_no'] = max(0, min(999, $expNo));
        return json_encode($arr, JSON_UNESCAPED_UNICODE);
    }

    /**
     * 编辑页：实验序号优先读 addition，否则从标题片段解析。
     *
     * @param array $contest
     */
    protected function resolveExpNoForForm(array $contest): int
    {
        $raw = $contest['addition'] ?? null;
        $add = [];
        if (!empty($raw)) {
            if (is_string($raw)) {
                $add = Json2Array($raw) ?: [];
            } elseif (is_array($raw)) {
                $add = $raw;
            }
        }
        $ep = isset($add['exp_practice']) && is_array($add['exp_practice']) ? $add['exp_practice'] : [];
        if (array_key_exists('exp_no', $ep)) {
            $v = $ep['exp_no'];
            if ($v !== null && $v !== '' && ctype_digit(strval($v))) {
                return max(0, min(999, intval($v)));
            }
        }
        $title = strval($contest['title'] ?? '');
        if ($title !== '' && preg_match('/(?:^|-)实验(\d{1,3})(?:-|$)/u', $title, $m)) {
            return max(0, min(999, intval($m[1])));
        }
        return 1;
    }

    /**
     * 教师选模板：当前课程下的模板列表（只读）
     */
    public function template_options_ajax()
    {
        $this->BaseAuth();
        if (empty($this->NOW_COURSE_ID)) {
            $this->error('未选择课程组', '/course');
        }
        $list = db('contest')->alias('c')
            ->join('course_item ci', "ci.item_id = c.contest_id AND ci.item = 'contest'", 'inner')
            ->where('ci.course_id', intval($this->NOW_COURSE_ID))
            ->where(function ($q) {
                $q->whereNull('ci.pvrole')->whereOr('ci.pvrole', '');
            })
            ->where('c.private', 'in', [4, 14])
            ->whereRaw('IFNULL(c.flg_archive,0) <> 0')
            ->field(['c.contest_id', 'c.title', 'c.addition'])
            ->order('c.contest_id', 'desc')
            ->select();
        $out = [];
        foreach ($list as $r) {
            $add = [];
            if (!empty($r['addition'])) {
                if (is_string($r['addition'])) {
                    $add = Json2Array($r['addition']) ?: [];
                } elseif (is_array($r['addition'])) {
                    $add = $r['addition'];
                }
            }
            $ep = isset($add['exp_practice']) && is_array($add['exp_practice']) ? $add['exp_practice'] : [];
            $tt = isset($ep['template_title']) ? trim(strval($ep['template_title'])) : '';
            if ($tt === '') {
                $tt = strval($r['title'] ?? '');
            }
            $sort = isset($ep['template_sort']) ? intval($ep['template_sort']) : 0;
            $out[] = [
                'contest_id' => intval($r['contest_id']),
                'template_title' => $tt,
                'template_sort' => $sort,
            ];
        }
        usort($out, function ($a, $b) {
            if ($a['template_sort'] !== $b['template_sort']) {
                return $a['template_sort'] - $b['template_sort'];
            }
            return $a['contest_id'] - $b['contest_id'];
        });
        return $out;
    }
    
    /**
     * 删除练习（AJAX）
     */
    public function contest_delete_ajax() {
        $contest_id = intval(request()->post('contest_id', 0));
        
        if ($contest_id <= 0) {
            return json(['code' => 0, 'msg' => '无效的练习ID']);
        }
        
        // 获取练习信息以检查权限
        $contest = db('contest')->where('contest_id', $contest_id)->find();
        if (!$contest) {
            return json(['code' => 0, 'msg' => '练习不存在']);
        }
        
        // 权限检查：只有 course admin/global admin 或班级教师可以删除
        $is_global_admin = IsAdmin();
        $is_course_admin = PrivCourse('admin', $this->NOW_COURSE_KEY);
        $is_clss_teacher = $this->CheckClssPriv($contest['clss_id']);
        
        if (!$is_global_admin && !$is_course_admin && !$is_clss_teacher) {
            return json(['code' => 0, 'msg' => '您没有权限删除该练习']);
        }
        
        // 调用 trait 中的通用删除方法（练习不需要检查 asheet）
        $result = $this->deleteContest($contest_id, false);
        return json($result);
    }
}
