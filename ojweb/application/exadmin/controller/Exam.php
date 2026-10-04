<?php
namespace app\exadmin\controller;
use think\Db;
use app\common\traits\ContestDeleteTrait;

/**
 * exadmin Exam 控制器
 * 考试管理（cpcsys-exp 模式）
 * 虽然使用 contest 表，但逻辑与练习管理不同
 */
class Exam extends Exadminbase
{
    use ContestDeleteTrait;
    protected function isCourseExamManager($course_key): bool {
        $ck = $course_key ?: $this->NOW_COURSE_KEY;
        return IsAdmin()
            || (function_exists('PrivCourse') && PrivCourse('admin', $ck));
            // 注意：PrivCourse('admin') 已包含 super 权限的检查
    }

    protected function isExamOwner($contest_id): bool {
        // 基于 privilege_item：rightitem='contest', pvrole='owner'
        return function_exists('PrivItem') && PrivItem('contest', intval($contest_id), 'owner');
    }

    protected function isExamManage($contest_id): bool {
        return function_exists('PrivItem') && PrivItem('contest', intval($contest_id), 'manage');
    }

    /** 是否可编辑该考试的 manage 列表（仅 course admin 或 owner，manage 不可改） */
    protected function canEditManageList($contest_id): bool {
        return $this->isCourseExamManager($this->NOW_COURSE_KEY ?? '') || $this->isExamOwner($contest_id);
    }

    public function BaseAuth() {
        // 仅考试模式可用
        if($this->OJ_MODE != 'cpcsys' || $this->OJ_STATUS != 'exp') {
            $this->error('考试管理仅适用于考试模式', '/');
        }
        if(!IsAdmin('problem_editor') && !IsAdmin('contest_editor') && !PrivCourse('teacher', $this->NOW_COURSE_KEY)) {
            $this->error('无管理权限', '/');
        }
    }
    
    public function contest_list() {
        if($this->OJ_MODE == 'cpcsys' && $this->OJ_STATUS == 'exp') {
            $this->assign('pagetitle', "考试管理");
        } else {
            $this->error('无效的访问', '/');
        }
        return $this->fetch();
    }
    
    public function contest_list_ajax() {
        // 修复 ThinkPHP 5.1 IN 查询：使用 whereRaw 方法
        $Contest = db('contest');
        $Contest->whereRaw('private IN (5, 15)');  // 只显示exam类型的contest，十位的1表示有附加题
        
        // 使用 applyQueryFilterToQuery hook 方法应用 course_item 表联查（exp 系统会自动处理）
        $map = [];
        $Contest = $this->applyQueryFilterToQuery($Contest, $map, 'contest');
        
        $ret = $Contest->order('contest_id', 'desc')
            ->field('contest_id,title,private,defunct,start_time,end_time,teachers')
            ->select();
        
        // 确保返回的是数组格式
        if(is_object($ret) && method_exists($ret, 'toArray')) {
            $ret = $ret->toArray();
        }
        if(!is_array($ret)) {
            $ret = [];
        }
        
        // 批量计算 owner / manage 权限（privilege_item rightitem=contest pvrole=owner|manage）
        $now_user_id = session('user_id');
        $is_course_admin = $this->isCourseExamManager($this->NOW_COURSE_KEY);
        $owner_set = [];
        $manage_set = [];
        if ($now_user_id && !$is_course_admin && !empty($ret)) {
            $cid_list = array_column($ret, 'contest_id');
            $cid_list = array_values(array_filter(array_map('intval', $cid_list)));
            if (!empty($cid_list)) {
                try {
                    foreach (['owner', 'manage'] as $pvrole) {
                        $ids = db('privilege_item')->where([
                            'user_id' => $now_user_id,
                            'rightitem' => 'contest',
                            'pvrole' => $pvrole,
                            'defunct' => '0',
                        ])->where('item_id', 'in', $cid_list)->column('item_id');
                        $ids = array_map('intval', is_array($ids) ? $ids : []);
                        $set = ($pvrole === 'owner') ? $owner_set : $manage_set;
                        foreach ($ids as $cid) { $set[intval($cid)] = true; }
                        if ($pvrole === 'owner') $owner_set = $set; else $manage_set = $set;
                    }
                } catch (\Throwable $e) {
                    // ignore
                }
            }
        }

        // 将 private 字段重命名为 protected（兼容前端），并补齐前端权限字段
        foreach($ret as &$row) {
            if(isset($row['private'])) {
                $row['protected'] = $row['private'];
            }
            $cid = intval($row['contest_id'] ?? 0);
            $is_owner = $is_course_admin ? true : (isset($owner_set[$cid]) && $owner_set[$cid]);
            $is_manage = isset($manage_set[$cid]) && $manage_set[$cid];
            $row['is_owner'] = $is_owner ? 1 : 0;
            $row['can_write'] = ($is_course_admin || $is_owner || $is_manage) ? 1 : 0;
            $row['can_attach'] = $row['can_write'];
        }
        // 直接返回数组，ThinkPHP 5.1 会自动处理
        return $ret;
    }
    
    /**
     * 删除考试（AJAX）
     */
    public function contest_delete_ajax() {
        $contest_id = intval(request()->post('contest_id', 0));
        
        // 权限检查：只有 course admin/super/global admin 或 contest owner 可以删除
        $is_course_admin = $this->isCourseExamManager($this->NOW_COURSE_KEY);
        $is_owner = $this->isExamOwner($contest_id);
        
        if (!$is_course_admin && !$is_owner) {
            return json(['code' => 0, 'msg' => '您没有权限删除该考试']);
        }
        
        // 调用 trait 中的通用删除方法（考试需要检查 asheet）
        $result = $this->deleteContest($contest_id, true);
        return json($result);
    }
    
    public function contest_add() {
        $now = time();
        // contest_add 复用 contest_edit 模板，但模板中会直接读取 $contest['langmask']
        // 因此这里必须提供一个默认 contest 结构，避免未定义变量报错。
        $ojLang = config('CsgojConfig.OJ_LANGUAGE');
        $default_langmask = 0;
        if (is_array($ojLang)) {
            foreach ($ojLang as $k => $val) {
                $kk = intval($k);
                if ($kk >= 0 && $kk < 31) {
                    $default_langmask |= (1 << $kk);
                }
            }
        }
        $default_contest = [
            'langmask' => $default_langmask,
            // topteam 在模板中用于 ip_rt（锁 IP）位判断，这里给默认值即可
            'topteam' => 0,
            // addition: 是否打乱选择题选项顺序（新建默认不打乱）
            'shuffle_choice' => 0,
        ];
        $this->assign([
            'start_year'    => date('Y', $now),
            'start_month'   => date('m', $now),
            'start_day'     => date('d', $now),
            'start_hour'    => date('H', $now),
            'start_minute'  => 0,
            'end_year'      => date('Y', $now + 7200),
            'end_month'     => date('m', $now + 7200),
            'end_day'       => date('d', $now + 7200),
            'end_hour'      => date('H', $now + 7200),
            'end_minute'    => 0,
            'protected'     => 5,
            'contest'       => $default_contest,
            'ojLang'        => $ojLang,
            'edit_mode'     => false,
            'teachers'      => session('user_id'),  // 记录添加考试的人
            'owner_list'    => [session('user_id')],
            'manage_list'   => [],
            'course_key_for_owners' => $this->NOW_COURSE_KEY ?? '',
            'can_write'     => true,
            'can_edit_manage_list'  => true,
        ]);
        return $this->fetch('contest_edit');
    }
    
    public function contest_edit($copy_mode=false) {
        $contest_id = input('id/d');
        if($contest_id == null) {
            $this->error("id should be given");
        }
        $item = db('contest')->where('contest_id', $contest_id)->find();
        if($item == null) {
            $this->error("No such Exam");
        }
        // 从 course_item 表获取 course_key（兼容旧数据）
        $course_key = GetItemCourseKey($item, 'contest');
        // teacher：可查看/复制他人的考试；但仅“自己发起的考试（owner）”可管理（写）
        // course admin/super：可管理全部考试
        if($course_key) {
            $can_view = $this->isCourseExamManager($course_key) || PrivCourse('teacher', $course_key);
            if(!$can_view) {
                $this->error("无该考试访问权限");
            }
        }
        $can_write = $this->isCourseExamManager($course_key) || $this->isExamOwner($contest_id) || $this->isExamManage($contest_id);
        $this->CourseBelongValidate($item, 'contest');
        $start = strtotime($item['start_time']);
        $end = strtotime($item['end_time']);
        // 复制考试：不复制原时间
        // 开始时间：距离现在最近且严格晚于现在的一个整半点（xx:00 或 xx:30）
        // 结束时间：开始后 2 小时
        if($copy_mode) {
            $now = time();
            $secOfHour = intval(date('i', $now)) * 60 + intval(date('s', $now));
            if($secOfHour < 30 * 60) {
                $delta = 30 * 60 - $secOfHour;
            } else {
                $delta = 60 * 60 - $secOfHour;
            }
            $start = $now + $delta;
            $end = $start + 2 * 3600;
        }
        $contest_md = db('contest_md')->where('contest_id', $contest_id)->find();
        if($contest_md != null) {
            if(isset($contest_md['description'])) {
                $item['description'] = $contest_md['description'];
            }
            if(isset($contest_md['notification'])) {
                $item['notification'] = $contest_md['notification'];
            }
        }
        // 数据库字段是 private，不是 protected
        $protected = $item['protected'] ?? $item['private'] ?? 5;

        // 读取 addition（可能为 null / 非法 JSON），用于“是否打乱选择题选项顺序”
        $shuffle_choice = 0;
        if (!empty($item['addition'])) {
            $addition = Json2Array($item['addition']);
            if ($addition && is_array($addition) && isset($addition['shuffle_choice'])) {
                $shuffle_choice = intval($addition['shuffle_choice']) ? 1 : 0;
            }
        }
        $item['shuffle_choice'] = $shuffle_choice;

        // owner 列表（用于前端排除：不能把 owner 设为 manage）
        $owner_list = [];
        $manage_list = [];
        $cid = intval($item['contest_id'] ?? 0);
        if ($copy_mode) {
            $owner_list = session('user_id') ? [session('user_id')] : [];
        } elseif ($cid) {
            $owner_rows = db('privilege_item')->where([
                'rightitem' => 'contest', 'item_id' => $cid, 'pvrole' => 'owner', 'defunct' => '0'
            ])->column('user_id');
            $owner_list = is_array($owner_rows) ? array_values(array_filter(array_map('trim', $owner_rows))) : [];
            $manage_rows = db('privilege_item')->where([
                'rightitem' => 'contest', 'item_id' => $cid, 'pvrole' => 'manage', 'defunct' => '0'
            ])->column('user_id');
            $manage_list = is_array($manage_rows) ? array_values(array_filter(array_map('trim', $manage_rows))) : [];
        }
        $course_key_for_owners = $course_key ?? ($this->NOW_COURSE_KEY ?? '');
        $can_edit_manage_list = $cid ? $this->canEditManageList($cid) : true;
        $this->assign([
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
            'protected'     => $protected,
            'contest'       => $item,
            'ojLang'        => config('CsgojConfig.OJ_LANGUAGE'),
            'edit_mode'     => true,
            'copy_mode'     => $copy_mode,
            'teachers'      => $copy_mode ? session('user_id') : ($item['teachers'] ?? session('user_id')),
            'can_write'     => $can_write,
            'owner_list'    => $owner_list,
            'manage_list'   => $manage_list,
            'course_key_for_owners' => $course_key_for_owners,
            'can_edit_manage_list'  => $can_edit_manage_list,
        ]);
        return $this->fetch('contest_edit');
    }
    
    public function contest_copy() {
        return $this->contest_edit(true);
    }
    
    public function contest_edit_ajax() {
        $contest_id      = input('contest_id/d');
        $ip_rt = input('ip_rt/d');  // 是否限制单IP登录，即账号第一次登录后，更换IP需报批
        $private = input('attach_pro/d') * 10 + 5;
        // 是否打乱选择题选项顺序（存入 contest.addition JSON）
        $shuffle_choice = input('shuffle_choice/d', 0) ? 1 : 0;
        $contest_info = [
            'title'         => input('title/s'),
            'start_time'    =>
                input('start_year/d') . '-'.
                input('start_month/d') . '-'.
                input('start_day/d') . ' '.
                input('start_hour/d') . ':'.
                input('start_minute/d') . ':'.
                '0',
            'end_time'    =>
                input('end_year/d') . '-'.
                input('end_month/d') . '-'.
                input('end_day/d') . ' '.
                input('end_hour/d') . ':'.
                input('end_minute/d') . ':'.
                '0',
            // 数据库字段为 private（ThinkPHP 5.1 严格模式下禁止写入不存在的 protected 字段）
            'private'       => $private,
            'langmask'     => $this->CalLangMask(input('lang/a')), 
            'description' => trim(input('description/s')),
            'notification' => trim(input('notification/s', '')),
        ];
        $contest_md_info = [
            'description' => $contest_info['description'],
            'notification' => $contest_info['notification'],
        ];
        //插入contest表，描述字段和公告字段为md编译的html
        $contest_info['description']    = ParseMarkdown($contest_md_info['description']);
        $contest_info['notification']   = ParseMarkdown($contest_md_info['notification']);

        // 时间格式如果错误，直接插入mysql会抛出异常且暂时没找到方法catch异常，导致直接500而不ajax反馈错误。所以手动判断
        if(!strtotime($contest_info['start_time']) || !strtotime($contest_info['end_time'])) {
            $this->error('Time syntax error.');
        }
        $starttime = strtotime($contest_info['start_time']);
        $endtime = strtotime($contest_info['end_time']);
        if($starttime >= $endtime) {
            $this->error('Start Time should before End Time.');
        }
        //过滤时间格式，否则插入数据库可能出错
        $contest_info['start_time'] = date('Y-m-d H:i:s', $starttime);
        $contest_info['end_time'] = date('Y-m-d H:i:s', $endtime);
        
        // 处理 teachers 字段
        $teachers_input = input('teachers/s', '');
        $processed_teachers = $this->processTeachersInput($teachers_input, $contest_id);
        $contest_info['teachers'] = $processed_teachers;
        
        $Contest = db('contest');
        if($contest_id == null) {
            // 添加
            if(!$this->NOW_COURSE_ID) {
                $this->error("请在课程内操作（缺少 course 上下文）");
            }
            if(!IsAdmin('contest_editor') && !PrivCourse('admin', $this->NOW_COURSE_KEY) &&
                !PrivCourse('teacher', $this->NOW_COURSE_KEY)
            ) {
                $this->error("无课程管理权限");
            }
            // 添加考试时必须先有题目，避免插入 contest 后再报错导致前端停留在添加页、用户重复提交产生重复考试
            $this->getValidatedQuestionJson();
            $contest_info['defunct'] = '1';
            $contest_info['attach']     = $this->AttachFolderCalculation(session('user_id')); // 计算附件文件夹名称，固定后导入导出题目不会有路径变化问题
            $contest_info['topteam'] = $ip_rt * 10000 + 1;    // 借用topteam字段记录是否限制IP
            // addition：新建默认不打乱（shuffle_choice=0），若用户勾选则为 1
            $contest_info['addition'] = json_encode(['shuffle_choice' => $shuffle_choice], JSON_UNESCAPED_UNICODE);
            $contest_id = $Contest->insertGetId($contest_info);
            if(!$contest_id) {
                $this->error('Add contest failed, SQL error.');
            }
            
            // 插入到 course_item 表
            $this->afterInsertData($contest_info, 'contest', $contest_id);

            // 教师发起/复制考试：写入 owner 标记（privilege_item）
            // 使用全局 AddPrivilege 函数，pvrole='owner'（特殊权限类型）
            if (session('user_id') && PrivCourse('teacher', $this->NOW_COURSE_KEY)) {
                try {
                    // exp 模式下创建新资源时，不检查权限（因为资源刚创建，还没有权限记录）
                    $checkPrivilege = ($this->OJ_STATUS != 'exp');
                    AddPrivilege(session('user_id'), 'contest', $contest_id, $checkPrivilege, 'owner');
                } catch (\Throwable $e) {
                    // ignore（可能权限已存在或其他错误）
                }
            }
        } else {
            // 更新
            $contest_item = $Contest->where('contest_id', $contest_id)->find();
            if($contest_item == null) {
                $this->error("No such contest.");
            }
            $this->CourseBelongValidate($contest_item, 'contest');
            $can_write = $this->isCourseExamManager($this->NOW_COURSE_KEY) || $this->isExamOwner($contest_id) || $this->isExamManage($contest_id);
            if(!$can_write) {
                $this->error("无该考试管理权限");
            }
            $contest_info['topteam'] = $ip_rt * 10000 + $contest_item['topteam'] % 10000;    // 借用topteam字段记录是否限制IP

            // addition：只更新 shuffle_choice，不覆盖其它键
            $addition = [];
            if (!empty($contest_item['addition'])) {
                $tmp = Json2Array($contest_item['addition']);
                if ($tmp && is_array($tmp)) {
                    $addition = $tmp;
                }
            }
            $addition['shuffle_choice'] = $shuffle_choice;
            $contest_info['addition'] = json_encode($addition, JSON_UNESCAPED_UNICODE);

            $contest_item = array_merge($contest_item, $contest_info);
            $Contest->update($contest_item);
        }
        
        // 可管理人(manage)：仅 owner 或 course admin 可提交；不能把 owner 设为 manage
        $manage_ids_raw = input('manage_ids/a');
        if ($manage_ids_raw === null || $manage_ids_raw === '') {
            $manage_ids_raw = input('manage_ids/s', '');
        }
        if ($contest_id && $this->canEditManageList($contest_id) && $manage_ids_raw !== null && $manage_ids_raw !== '') {
            if (!is_array($manage_ids_raw)) {
                $manage_ids_raw = array_filter(array_map('trim', explode(',', $manage_ids_raw)));
            }
            $manage_ids = array_values(array_unique(array_filter($manage_ids_raw)));
            $course_key = $this->NOW_COURSE_KEY ?? '';
            $course_id = intval($this->NOW_COURSE_ID ?? 0);
            if ($course_id <= 0) {
                $ci = db('course_item')->where(['item' => 'contest', 'item_id' => $contest_id])->find();
                if ($ci && !empty($ci['course_id'])) {
                    $course_id = intval($ci['course_id']);
                    $c = db('course')->where('course_id', $course_id)->find();
                    if ($c && !empty($c['course_key'])) {
                        $course_key = $c['course_key'];
                    }
                }
            }
            if ($course_id > 0 && $course_key !== '') {
                $allowed = db('privilege_item')->where([
                    'rightitem' => 'course', 'item_id' => $course_id, 'defunct' => '0'
                ])->column('user_id');
                $allowed = array_flip(is_array($allowed) ? $allowed : []);
                $owner_ids_set = db('privilege_item')->where([
                    'rightitem' => 'contest', 'item_id' => $contest_id, 'pvrole' => 'owner', 'defunct' => '0'
                ])->column('user_id');
                $owner_ids_set = array_flip(is_array($owner_ids_set) ? array_map('trim', $owner_ids_set) : []);
                $valid_ids = [];
                foreach ($manage_ids as $uid) {
                    $uid = trim($uid);
                    if ($uid !== '' && isset($allowed[$uid]) && !isset($owner_ids_set[$uid])) {
                        $valid_ids[] = $uid;
                    }
                }
                db('privilege_item')->where([
                    'rightitem' => 'contest', 'item_id' => $contest_id, 'pvrole' => 'manage'
                ])->delete();
                foreach ($valid_ids as $uid) {
                    try {
                        AddPrivilege($uid, 'contest', $contest_id, false, 'manage');
                    } catch (\Throwable $e) {
                        // 忽略重复等
                    }
                }
            }
        }
        
        // contest已插入或更新，下面处理contest_md
        $Contest_md = db('contest_md');
        $contest_md_info['contest_id'] = $contest_id; //注意contest_md表要设置contest_id以和contest表对应。
        $contest_md = $Contest_md->where('contest_id', $contest_id)->find();
        //虽然新插数据基本不会发生contest_md已有此contest_id的情况，但以防万一contest表被删除过并修改过auto_increacement
        if($contest_md == null) {
            $Contest_md->insert($contest_md_info);
        }
        else {
            $Contest_md->update($contest_md_info);
        }
        $addmsg = $this->ContestProblemAdd($contest_id);
        $successmsg = 'Contest successfully added.' . ($addmsg == '' ? '' : '<br/>'.$addmsg);
        $this->success($successmsg, $successmsg, ['id' => $contest_id]);
    }
    
    private function CalLangMask($languages) {
        $ret = LangList2LangMask($languages);
        if($ret == -1) $this->error('Please select at least 1 language.');
        if($ret == -2) $this->error('Some languages are not allowed for this OJ.');
        return $ret;
    }
    
    // AttachFolderCalculation 已在 admin/Adminbase 中统一实现（UUIDv4），此处直接复用父类即可

    /**
     * 解析并校验 question_json_text_real（格式：{ "pkind": [ { "ex_question_id", "prule", "pscore" }, ... ], ... }）。
     * 无效或题目数为 0 时 error()，否则返回解析后的数组。
     * @return array
     */
    protected function getValidatedQuestionJson() {
        $question_json = json_decode(input('question_json_text_real/s'), true);
        if ($question_json === null || !is_array($question_json)) {
            $this->error("No question provided.");
        }
        $question_count = 0;
        foreach ($question_json as $question_list) {
            if (is_array($question_list)) {
                $question_count += count($question_list);
            }
        }
        if ($question_count < 1) {
            $this->error("No question provided.");
        }
        return $question_json;
    }
    
    private function ContestProblemAdd($contest_id) {
        $ContestProblem = db('contest_problem');
        $ContestProblem->where('contest_id', $contest_id)->delete();
        $question_json = $this->getValidatedQuestionJson();
        $contest_problem_add = [];
        $inum = 1;  // 让题号从 1 开始
        $pid_map = [];
        $attach_pro = input('attach_pro/d');
        $total_score = 0;
        $last_score = 0;
        foreach($question_json as $pkind=>$question_list) {
            foreach($question_list as $key=>$question) {
                if(array_key_exists($question['ex_question_id'], $pid_map)) continue;
                $pid_map[$question['ex_question_id']] = true;
                $contest_problem_add[] = [
                    'problem_id'    => $question['ex_question_id'],
                    'title'         => $question['prule'],
                    'contest_id'    => $contest_id,
                    'num'           => $inum ++,
                    'pscore'        => $question['pscore'],
                ];
                $total_score += $question['pscore'];
                $last_score = $question['pscore'];
            }
        }
        $pnum = count($contest_problem_add);
        if($pnum > 0) {
            if(!$ContestProblem->insertAll($contest_problem_add)) {
                $this->error('Contest problems insert failed.');
            }
        }
        if(!$attach_pro && $total_score != 100 || $attach_pro && $total_score - $last_score != 100) {
            return "Warning: Total Score is not 100";
        }
        return "";
    }
    
    private function GetContest() {
        $contest_id = input('contest_id/d');
        if($contest_id == null) {
            $this->error("contest_id should be given.");
        }
        // 必须校验 contest 属于当前 course（不要导出/查询其它课程的考试）
        if(!$this->NOW_COURSE_ID) {
            $this->error("请在课程内操作（缺少 course 上下文）");
        }
        $Contest = db('contest');
        $Contest = $this->applyQueryFilterToQuery($Contest, ['contest_id' => $contest_id], 'contest');
        $contest = $Contest->find();
        if($contest == null) {
            $this->error("该考试不属于当前课程或不存在");
        }
        // 使用 private 字段（数据库实际字段名）
        if($contest['private'] != 5 && $contest['private'] != 15) {
            $this->error("This contest is not an exam.");
        }
        return $contest;
    }
    
    public function contest_problem_ajax() {
        $contest = $this->GetContest();
        // 先拿全量题单（用于 out_of_course 统计）
        $all_ids = db('contest_problem')->where('contest_id', $contest['contest_id'])->order('num', 'asc')->column('problem_id');
        $all_ids = array_values(array_unique(array_map('intval', $all_ids ?: [])));

        // 过滤：只返回本课程内的 ex_question（course_item 联查）
        $cp = db('contest_problem')->alias('cp')
            ->join('course_item ci', "ci.item_id = cp.problem_id AND ci.item = 'ex_question'", 'inner')
            ->where('ci.course_id', $this->NOW_COURSE_ID)
            ->where(function($q) {
                $q->whereNull('ci.pvrole')->whereOr('ci.pvrole', '');
            })
            ->where('cp.contest_id', $contest['contest_id'])
            ->order('cp.num', 'asc')
            ->field(['cp.problem_id', 'cp.title', 'cp.pscore', 'cp.num']);
        $contest_problem = $cp->select();
        if(is_object($contest_problem) && method_exists($contest_problem, 'toArray')) {
            $contest_problem = $contest_problem->toArray();
        }
        if(!is_array($contest_problem)) $contest_problem = [];
        $in_course_ids = array_values(array_unique(array_map('intval', array_column($contest_problem, 'problem_id'))));
        $out_of_course_ids = array_values(array_diff($all_ids, $in_course_ids));
        sort($out_of_course_ids);

        $this->success('OK', null, [
            'rows' => $contest_problem,
            'meta' => [
                'contest_id' => intval($contest['contest_id']),
                'course_id' => intval($this->NOW_COURSE_ID),
                'course_key' => strval($this->NOW_COURSE_KEY),
                'all_question_ids' => $all_ids,
                'in_course_question_ids' => $in_course_ids,
                'out_of_course_question_ids' => $out_of_course_ids,
            ]
        ]);
    }
    
    public function problem_ajax() {
        // 获取 OJ 编程题
        $problem_id = input('problem_id/d');
        if($problem_id == null) {
            $this->error("problem_id should be given");
        }
        // 使用 course_item 表联查过滤课程
        $problemQuery = db('problem')->alias('p');
        if($this->NOW_COURSE_ID) {
            $problemQuery->join('course_item ci', 'ci.item_id = p.problem_id AND ci.item = \'problem\'', 'inner')
                ->where('ci.course_id', $this->NOW_COURSE_ID)
                // 兼容历史数据：pvrole 可能是 NULL 或空字符串
                ->where(function($q) {
                    $q->whereNull('ci.pvrole')->whereOr('ci.pvrole', '');
                });
        }
        $problem = $problemQuery->where('problem_id', $problem_id)->find();
        if($problem == null) {
            $this->error("No such problem in current course.");
        }
        $lang = trim(input('get.lang/s', ''));
        $pdfBase = problem_locale_exam_oj_problem_pdf_base();
        $pq = ['pid' => (int) $problem['problem_id']];
        $payload = problem_locale_ajax_enriched_problem($problem, $lang, $pdfBase, $pq);
        $this->success('ok', null, $payload);
    }
    
    /**
     * 获取OJ题目列表（用于编程题选择器）
     */
    public function prog_problem_list_ajax() {
        $offset = input('offset/d', 0);
        $limit = input('limit/d', 100);
        $search = trim(input('search/s', ''));
        
        // 构建子查询 SQL
        $subQuerySql = db('ex_question')->alias('eq');
        if($this->NOW_COURSE_ID) {
            $subQuerySql->join('course_item ci', 'ci.item_id = eq.ex_question_id AND ci.item = \'ex_question\'', 'inner')
                ->where('ci.course_id', $this->NOW_COURSE_ID)
                // 兼容历史数据：pvrole 可能是 NULL 或空字符串
                ->where(function($q) {
                    $q->whereNull('ci.pvrole')->whereOr('ci.pvrole', '');
                })
                ->where('eq.pkind', 25);
        } else {
            $subQuerySql->where('eq.pkind', 25);
        }
        $subQuery = $subQuerySql->field(['eq.description' => 'pid', 'GROUP_CONCAT(eq.ex_question_id) as qlist'])
            ->group('eq.description')
            ->buildSql(true);
        
        // 使用 course_item 表联查过滤 problem 表的课程
        $Problem = db('problem')->alias('p');
        if($this->NOW_COURSE_ID) {
            $Problem->join('course_item ci', 'ci.item_id = p.problem_id AND ci.item = \'problem\'', 'inner')
                ->where('ci.course_id', $this->NOW_COURSE_ID)
                // 兼容历史数据：pvrole 可能是 NULL 或空字符串
                ->where(function($q) {
                    $q->whereNull('ci.pvrole')->whereOr('ci.pvrole', '');
                });
        }
        
        // 搜索条件（使用闭包构建 OR 查询，兼容 ThinkPHP 5.1）
        if(strlen($search) > 0) {
            $Problem->where(function($query) use ($search) {
                $query->whereOr('p.title', 'like', "%$search%")
                    ->whereOr('p.problem_id', 'like', "%$search%");
            });
        }
        
        $list = $Problem->join([$subQuery => 'q'], 'q.pid = p.problem_id', 'left')
            ->order('p.problem_id', 'desc')
            ->limit($offset, $limit)
            ->field(['p.problem_id', 'p.title', 'p.description', 'q.qlist'])
            ->select();
        
        // 计算总数（使用相同的查询条件）
        $ProblemTotal = db('problem')->alias('p');
        if($this->NOW_COURSE_ID) {
            $ProblemTotal->join('course_item ci', 'ci.item_id = p.problem_id AND ci.item = \'problem\'', 'inner')
                ->where('ci.course_id', $this->NOW_COURSE_ID)
                // 兼容历史数据：pvrole 可能是 NULL 或空字符串
                ->where(function($q) {
                    $q->whereNull('ci.pvrole')->whereOr('ci.pvrole', '');
                });
        }
        if(strlen($search) > 0) {
            $ProblemTotal->where(function($query) use ($search) {
                $query->whereOr('p.title', 'like', "%$search%")
                    ->whereOr('p.problem_id', 'like', "%$search%");
            });
        }
        $total = $ProblemTotal->count();
        
        $this->success('ok', null, ['rows' => $list, 'total' => $total]);
    }
    
    public function contest_examinee_status() {
        // 仅 course admin/super（或全局管理员）可访问
        if (!$this->isCourseExamManager($this->NOW_COURSE_KEY)) {
            $this->error('无权限访问该页面', '/');
        }
        return $this->fetch();
    }
    
    public function contest_examinee_status_ajax() {
        // 仅 course admin/super（或全局管理员）可访问
        if (!$this->isCourseExamManager($this->NOW_COURSE_KEY)) {
            $this->error('无权限', '/');
        }
        $cid_list = input('cid_list/a');
        if($cid_list === null || count($cid_list) == 0) {
            $this->error("请提供考试ID列表");
        } 
        if(count($cid_list) > 64) {
            $this->error("考试过多");
        }
        $ret = [];
        $contest_list = db('contest')->where('contest_id', 'in', $cid_list)->whereRaw('MOD(private, 10)=5')->field(['contest_id', 'title'])->select();
        $ret['contest_list'] = is_array($contest_list) ? $contest_list : $contest_list->toArray();
        $valid_contest_list = array_column($ret['contest_list'], 'contest_id');
        $ret['team_list'] = db('cpc_team')
            ->where('contest_id', 'in', $valid_contest_list)
            ->whereRaw('privilege IS NULL')
            ->order(['room' => 'asc', 'contest_id' => 'desc', 'team_id' => 'asc'])
            ->field('password', true)
            ->select();

        $this->success('ok', null, $ret);
    }
    
    /**
     * 全局考生账号管理页面
     * 权限：仅 PrivCourse('admin', ...) 可访问
     */
    public function contest_global_account() {
        // 仅 course admin/super（或全局管理员）可访问
        if (!$this->isCourseExamManager($this->NOW_COURSE_KEY)) {
            $this->error('无权限访问该页面', '/');
        }
        return $this->fetch();
    }
    
    /**
     * 全局考生账号管理数据接口
     * 权限：仅 PrivCourse('admin', ...) 可访问
     */
    public function contest_global_account_ajax() {
        // 仅 course admin/super（或全局管理员）可访问
        if (!$this->isCourseExamManager($this->NOW_COURSE_KEY)) {
            $this->error('无权限', '/');
        }
        $cid_list = input('cid_list/a');
        if($cid_list === null || count($cid_list) == 0) {
            $this->error("请提供考试ID列表");
        } 
        if(count($cid_list) > 64) {
            $this->error("考试过多");
        }
        $ret = [];
        $contest_list = db('contest')->where('contest_id', 'in', $cid_list)->whereRaw('MOD(private, 10)=5')->field(['contest_id', 'title'])->select();
        $ret['contest_list'] = is_array($contest_list) ? $contest_list : $contest_list->toArray();
        $valid_contest_list = array_column($ret['contest_list'], 'contest_id');
        
        // 获取所有考生账号（包含密码）
        $team_list = db('cpc_team')
            ->where('contest_id', 'in', $valid_contest_list)
            ->whereRaw('privilege IS NULL')
            ->order(['contest_id' => 'desc', 'room' => 'asc', 'team_id' => 'asc'])
            ->select();
        
        // 恢复密码（如果有）
        foreach($team_list as &$team) {
            if (isset($team['password']) && $team['password'] != "[SYS_PASS]") {
                $team['password'] = RecoverPasswd($team['password']);
            }
        }
        
        $ret['team_list'] = $team_list;
        $this->success('ok', null, $ret);
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
     * 全局考生状态变更（exadmin 专用）
     * 说明：用于 /exadmin/exam/contest_examinee_status 页面
     * 权限：仅 course admin/super（或全局管理员）
     */
    public function contest_examinee_status_change_ajax() {
        if (!$this->isCourseExamManager($this->NOW_COURSE_KEY)) {
            $this->error('无权限');
        }

        $cid = input('cid/d');
        if (!$cid) {
            $this->error('cid should be given');
        }

        $contest = db('contest')->where('contest_id', $cid)->find();
        if (!$contest) {
            $this->error('No such Exam');
        }

        // 必须属于当前课程上下文
        $this->CourseBelongValidate($contest, 'contest');

        // 必须是考试类型（MOD(private,10)=5）
        $private = intval($contest['private'] ?? 0);
        if (($private % 10) !== 5) {
            $this->error('Not an exam contest.');
        }

        $team_id = input('team_id/s');
        if (!$team_id) {
            $this->error('team_id should be given');
        }

        $team = db('cpc_team')->where([
            'team_id' => $team_id,
            'contest_id' => $cid,
        ])->find();
        if (!$team) {
            $this->error('No such team');
        }

        $defunctNew = input('defunct/s', null);
        if ($defunctNew !== null) {
            $team['defunct'] = ($defunctNew === 'Y') ? 'Y' : 'N';
        }

        $ip_clear = input('ip_clear/d', null);
        if ($ip_clear !== null) {
            // 解锁 IP：将当前 IP 添加到历史列表，并清除当前 IP
            $newAddition = $this->updateIpInAddition($team['addition'] ?? null, null, true);
            // 只更新 addition 字段，避免覆盖其他字段
            db('cpc_team')->where([
                'team_id' => $team_id,
                'contest_id' => $cid,
            ])->setField('addition', $newAddition);
            $team['addition'] = $newAddition;
        } else {
            // 非 IP 解锁操作，正常更新
            db('cpc_team')->update($team);
        }

        // 返回给前端（兼容密码显示逻辑）
        if (isset($team['password']) && $team['password'] != "[SYS_PASS]") {
            $team['password'] = RecoverPasswd($team['password']);
        }

        $this->success('ok', null, $team);
    }
    
    /**
     * 处理 teachers 输入字段
     * @param string $teachers_input 输入的教师字符串
     * @param int|null $contest_id 考试ID，null表示新增
     * @return string 处理后的教师字符串，格式为 ,user1,user2,user3,
     */
    private function processTeachersInput($teachers_input, $contest_id = null) {
        // 如果输入为空，根据是新增还是更新来处理
        if (empty($teachers_input)) {
            if ($contest_id === null) {
                // 新增：只包含当前用户
                return ',' . session('user_id') . ',';
            } else {
                // 更新：获取数据库中的原始数据
                $contest_item = db('contest')->where('contest_id', $contest_id)->find();
                if ($contest_item && !empty($contest_item['teachers']) && is_string($contest_item['teachers'])) {
                    return $contest_item['teachers'];
                } else {
                    // 如果数据库数据不合法，使用当前用户
                    return ',' . session('user_id') . ',';
                }
            }
        }
        
        // 以英文逗号分隔，去除空字符串，去重
        $teachers_array = array_filter(array_map('trim', explode(',', $teachers_input)), function($item) {
            return !empty($item);
        });
        $teachers_array = array_unique($teachers_array);
        
        // 检查数量限制
        if (count($teachers_array) > 10) {
            $this->error('合作教师数量不能超过10个，当前：' . count($teachers_array) . '个');
        }
        
        // 检查每个用户ID的长度限制
        foreach ($teachers_array as $teacher_id) {
            if (strlen($teacher_id) > 64) {
                $this->error('用户ID长度不能超过64个字符：' . $teacher_id);
            }
        }
        
        // 检查总长度限制
        $total_length = strlen(',' . implode(',', $teachers_array) . ',');
        if ($total_length > 200) {
            $this->error('合作教师字段总长度不能超过200个字符，当前：' . $total_length . '个字符');
        }
        
        // 验证用户ID是否存在
        if (!empty($teachers_array)) {
            $existing_users = db('users')->where('user_id', 'in', $teachers_array)->column('user_id');
            $non_existing_users = array_diff($teachers_array, $existing_users);
            if (!empty($non_existing_users)) {
                $this->error('以下用户ID不存在：' . implode(', ', $non_existing_users));
            }
        }
        
        // 确定第一个用户
        $first_user = null;
        if ($contest_id === null) {
            // 新增：确保当前用户在第一个
            $first_user = session('user_id');
        } else {
            // 更新：确保数据库原始数据的第一个用户保留在第一个
            $contest_item = db('contest')->where('contest_id', $contest_id)->find();
            if ($contest_item && !empty($contest_item['teachers']) && is_string($contest_item['teachers'])) {
                $old_teachers = array_filter(array_map('trim', explode(',', $contest_item['teachers'])), function($item) {
                    return !empty($item);
                });
                if (!empty($old_teachers)) {
                    $first_user = reset($old_teachers); // 使用 reset() 获取第一个元素
                }
            }
            // 如果无法从数据库获取第一个用户，使用当前用户
            if (empty($first_user)) {
                $first_user = session('user_id');
            }
        }
        
        // 确保第一个用户在列表中
        if (!in_array($first_user, $teachers_array)) {
            array_unshift($teachers_array, $first_user);
        } else {
            // 如果第一个用户已在列表中，将其移到第一位
            $teachers_array = array_values(array_diff($teachers_array, [$first_user]));
            array_unshift($teachers_array, $first_user);
        }
        
        // 拼接成逗号分隔的字符串，开头和结尾都要有逗号
        return ',' . implode(',', $teachers_array) . ',';
    }
}

