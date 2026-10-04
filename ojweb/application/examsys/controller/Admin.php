<?php
namespace app\examsys\controller;
use think\Db;
use think\facade\Validate;
use app\examsys\controller\Contest as Contestbase;
require_once(__DIR__ . "/../../common/traits/ContestAdminExpTrait.php");
use app\common\traits\ContestAdminExpTrait;

/**
 * examsys Admin 控制器
 * 考试系统比赛管理后台（contest的小后台）
 * 继承 Contest 类，使用 ContestAdminExpTrait 提供管理功能
 */
class Admin extends Contestbase
{
    use ContestAdminExpTrait;  // ContestAdminExpTrait 已包含 ContestAdminBaseTrait
    
    var $isReviewer;

    /**
     * 返回当前账号可管辖的班级列表（用于“考生生成 -> 导入班级”）
     *
     * 规则：
     * - course admin/super 或全局管理员：可管理本课程全部班级
     * - course teacher：仅可管理本人负责的班级（privilege_item rightitem=clss, pvrole=clss_teacher）
     */
    public function clss_manage_list_ajax()
    {
        // Contest admin 小后台页面本身已由 Trait initialize() + AdminInit() 做过 contest 级鉴权
        $course_id = intval($this->NOW_COURSE_ID ?? 0);
        if ($course_id <= 0) {
            $this->error('No course selected.');
        }

        $user_id = session('user_id');
        if (!$user_id) {
            $this->error('Not logged in.');
        }

        // 注意：PrivCourse('admin') 已包含 super 权限的检查
        $isCourseAdmin = IsAdmin() || PrivCourse('admin', $this->NOW_COURSE_KEY);
        $isTeacher = PrivCourse('teacher', $this->NOW_COURSE_KEY);
        if (!$isCourseAdmin && !$isTeacher) {
            $this->error('Powerless');
        }

        $clss_query = db('clss')->alias('cl')
            ->join('course_item ci_clss', "ci_clss.item_id = cl.clss_id AND ci_clss.item = 'clss'", 'inner')
            ->where('ci_clss.course_id', $course_id)
            ->where(function($q) {
                $q->whereNull('ci_clss.pvrole')->whereOr('ci_clss.pvrole', '');
            })
            ->where('cl.defunct', 'C')
            ->field(['cl.clss_id', 'cl.clss_title', 'cl.clss_year', 'cl.clss_semester'])
            ->order('cl.clss_year desc, cl.clss_semester desc, cl.clss_id desc');

        if (!$isCourseAdmin) {
            $pvrole_teacher = GetPvroleConfig('clss_teacher', 'teacher');
            $clss_query
                ->join('privilege_item pi', "pi.item_id = cl.clss_id AND pi.rightitem = 'clss'", 'inner')
                ->where([
                    'pi.user_id' => $user_id,
                    'pi.pvrole' => $pvrole_teacher,
                    'pi.defunct' => 0
                ])
                ->field(Db::raw('1 AS is_mine'));
        } else {
            // admin/super：返回本课程全部班级，同时标注“我的班级”（本人为该班教师）
            $pvrole_teacher = GetPvroleConfig('clss_teacher', 'teacher');
            $uid = addslashes(strval($user_id));
            $pv = addslashes(strval($pvrole_teacher));
            $clss_query
                ->join(
                    ['privilege_item' => 'pi_my'],
                    "pi_my.item_id = cl.clss_id AND pi_my.rightitem = 'clss' AND pi_my.user_id = '{$uid}' AND pi_my.pvrole = '{$pv}' AND pi_my.defunct = 0",
                    'left'
                )
                ->field(Db::raw('IF(pi_my.user_id IS NULL, 0, 1) AS is_mine'));
        }

        $rows = $clss_query->select();
        return $this->success('ok', null, $rows);
    }

    /**
     * 按班级导入学生列表（用于生成考生账号预览）
     *
     * 映射：
     * - 账号 -> users.user_id
     * - 姓名 -> users.nick
     * - 学校/组织 -> users.school
     * - 考场 -> 空
     * - 密码 -> 前端按既有规则生成（种子/确定性随机），后端仅返回基础信息
     */
    public function clss_student_list_ajax()
    {
        $course_id = intval($this->NOW_COURSE_ID ?? 0);
        if ($course_id <= 0) {
            $this->error('No course selected.');
        }

        $user_id = session('user_id');
        if (!$user_id) {
            $this->error('Not logged in.');
        }

        $clss_id = input('clss_id/d', 0);
        if ($clss_id <= 0) {
            $this->error('clss_id required');
        }

        // 注意：PrivCourse('admin') 已包含 super 权限的检查
        $isCourseAdmin = IsAdmin() || PrivCourse('admin', $this->NOW_COURSE_KEY);
        $isTeacher = PrivCourse('teacher', $this->NOW_COURSE_KEY);
        if (!$isCourseAdmin && !$isTeacher) {
            $this->error('Powerless');
        }

        // 班级必须属于当前课程
        $clss = db('clss')->alias('cl')
            ->join('course_item ci_clss', "ci_clss.item_id = cl.clss_id AND ci_clss.item = 'clss'", 'inner')
            ->where([
                'cl.clss_id' => $clss_id,
                'cl.defunct' => 'C',
                'ci_clss.course_id' => $course_id
            ])
            ->where(function($q) {
                $q->whereNull('ci_clss.pvrole')->whereOr('ci_clss.pvrole', '');
            })
            ->field(['cl.clss_id'])
            ->find();
        if (!$clss) {
            $this->error('Class not found in current course.');
        }

        // 教师仅可导入自己负责的班
        if (!$isCourseAdmin) {
            $pvrole_teacher = GetPvroleConfig('clss_teacher', 'teacher');
            $own = db('privilege_item')->where([
                'rightitem' => 'clss',
                'item_id' => $clss_id,
                'user_id' => $user_id,
                'pvrole' => $pvrole_teacher,
                'defunct' => 0
            ])->find();
            if (!$own) {
                $this->error('Powerless');
            }
        }

        $pvrole_student = GetPvroleConfig('clss_student', 'student');
        $rows = db('privilege_item')->alias('pi')
            ->join('users u', 'u.user_id = pi.user_id', 'inner')
            ->where([
                'pi.rightitem' => 'clss',
                'pi.item_id' => $clss_id,
                'pi.pvrole' => $pvrole_student,
                'pi.defunct' => 0
            ])
            ->field([
                'u.user_id',
                'u.nick',
                'u.school'
            ])
            ->order('u.user_id asc')
            ->select();

        return $this->success('ok', null, $rows);
    }
    
    /**
     * 默认首页，重定向到考生状态页面
     */
    public function index() {
        $this->redirect("/$this->module/$this->controller/examinee_status?cid=" . input('get.cid'));
    }
    
    /**
     * 管理员初始化
     * 重载 ContestAdminBaseTrait 的 AdminInit 方法
     */
    public function AdminInit() {
        if(!$this->IsContestAdmin('admin') && !$this->IsContestAdmin('reviewer')) {
            $this->error("You are not admin.", '/' . $this->module . '/contest/contest?cid=' . $this->contest['contest_id'], '', 1);
        }
        $this->isReviewer = $this->IsContestAdmin('reviewer');
        $this->assign('isReviewer', $this->isReviewer);
    }
    
    /**
     * 比赛编辑页面
     * 重载 ContestAdminBaseTrait 的 contest_edit 方法，适配 exam 系统
     */
    public function contest_edit() {
        $item = $this->contest;
        $start = strtotime($item['start_time']);
        $end = strtotime($item['end_time']);
        $contest_md = db('contest_md')->where('contest_id', $item['contest_id'])->find();
        if($contest_md != null) {
            $item['description'] = $contest_md['description'] ?? '';
            $item['notification'] = $contest_md['notification'] ?? '';
        } else {
            $item['description'] = '';
            $item['notification'] = '';
        }
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
            'protected'     => $item['private'] ?? 0,  // examsys 视图使用 protected 作为变量名，实际对应 contest 表的 private 字段
            'contest'       => $item,
            'ojLang'        => config('CsgojConfig.OJ_LANGUAGE'),
            'edit_mode'     => true,
            'copy_mode'     => false
        ]);
        return $this->fetch();
    }
    
    /**
     * 比赛编辑提交
     * 重载 ContestAdminBaseTrait 的 contest_edit_ajax 方法，适配 exam 系统
     * 注意：使用父类的 contest_addedit_ajax_process 方法处理数据，确保 notification 字段被正确处理
     */
    public function contest_edit_ajax() {
        if(!$this->IsContestAdmin()) {
            $this->error('Powerless');
        }

        // examsys 前台编辑：仅允许修改时间、语言、说明/公告（不触碰题目选择信息等其它字段）
        $post = input('post.');
        $contest_edit = [
            'start_time' =>
                trim($post['start_year']).'-'.
                trim($post['start_month']).'-'.
                trim($post['start_day']).' '.
                trim($post['start_hour']).':'.
                trim($post['start_minute']).':'.
                '0',
            'end_time' =>
                trim($post['end_year']).'-'.
                trim($post['end_month']).'-'.
                trim($post['end_day']).' '.
                trim($post['end_hour']).':'.
                trim($post['end_minute']).':'.
                '0',
            // 兼容模板：统一使用 lang[] 传递语言
            'langmask'    => $this->CalLangMask(input('lang/a', [])),
            // contest 表存 HTML（兼容前台展示），contest_md 存 Markdown
            'description' => ParseMarkdown(trim($post['description'] ?? '')),
            'notification' => ParseMarkdown(trim($post['notification'] ?? '')),
        ];

        if(!strtotime($contest_edit['start_time']) || !strtotime($contest_edit['end_time'])) {
            $this->error('Time syntax error.');
        }
        $starttime = strtotime($contest_edit['start_time']);
        $endtime = strtotime($contest_edit['end_time']);
        if($starttime >= $endtime) {
            $this->error('Start Time should before End Time.');
        }
        // 过滤时间格式
        $contest_edit['start_time'] = date('Y-m-d H:i:s', $starttime);
        $contest_edit['end_time']   = date('Y-m-d H:i:s', $endtime);

        $contestinfo = array_replace($this->contest, $contest_edit);
        db('contest')->update($contestinfo);

        // 处理 contest_md（保留 Markdown 原文）
        $contest_md_edit = [
            'contest_id'   => $this->contest['contest_id'],
            'description'  => trim($post['description'] ?? ''),
            'notification' => trim($post['notification'] ?? ''),
        ];
        $contest_md = db('contest_md')->where('contest_id', $this->contest['contest_id'])->find();
        if(!$contest_md) {
            db('contest_md')->insert($contest_md_edit);
        } else {
            db('contest_md')->where('contest_id', $this->contest['contest_id'])->update($contest_md_edit);
        }
        $this->success("Exam Updated", null, ['id' => $contestinfo['contest_id']]);
    }
    
    // contest_teamgen_ajax, ClearTeam, generateSeededPassword, teamgen_list_ajax 方法已通过 ContestAdminExpTrait 提供
    
    /**
     * 考生状态页面
     */
    public function examinee_status() {
        $this->assign('contest_problem', db('contest_problem')->where('contest_id', $this->contest['contest_id'])->order('num', 'asc')->select());
        return $this->fetch();
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
     * 考生状态变更
     */
    public function examinee_status_change_ajax() {
        if(!$this->isContestAdmin && !$this->proctorAdmin) {
            $this->error('无监考权限.');
        }
        $team_id = input('team_id/s');
        $team = db('cpc_team')->where([
            'team_id'       => $team_id,
            'contest_id'    => $this->contest['contest_id'],
        ])->find();
        if($team == null) {
            $this->error("No such team");
        }
        $defunctNew = input('defunct/s');
        if($defunctNew !== null) {
            $team['defunct'] = $defunctNew == 'Y' ? 'Y' : 'N';
        }
        $ip_clear = input('ip_clear/d');
        if($ip_clear !== null) {
            // 解锁 IP：将当前 IP 添加到历史列表，并清除当前 IP
            $newAddition = $this->updateIpInAddition($team['addition'] ?? null, null, true);
            // 只更新 addition 字段，避免覆盖其他字段
            db('cpc_team')->where([
                'team_id' => $team_id,
                'contest_id' => $this->contest['contest_id'],
            ])->setField('addition', $newAddition);
            $team['addition'] = $newAddition;
        } else {
            // 非 IP 解锁操作，正常更新
            db('cpc_team')->update($team);
        }
        if($team['password'] != "[SYS_PASS]") {
            $team['password'] = RecoverPasswd($team['password']);
        }
        // 返回更新后的 addition 给前端
        $this->success("ok", null, $team);
    }
    
    // account_modify, account_gen, account_gen_student, account_gen_proctor, account_ipcheck,
    // reviewer_manage, reviewer_list_ajax, team_del_ajax 方法已通过 ContestAdminExpTrait 提供
    
    /**
     * 阅卷页面
     */
    public function review() {
        return $this->fetch();
    }
    
    /**
     * 单页阅卷页面
     */
    public function review_single_page() {
        return $this->fetch('review_single_page');
    }
    
    /**
     * 获取OJ提交代码（用于阅卷）
     */
    public function oj_solution_ajax() {
        $allowedLanguages = array_keys($this->allowLanguage);
        
        $max_pass_rate_sql = db('solution')
            ->where('contest_id', $this->contest['contest_id'])
            ->field(['user_id', 'MAX(pass_rate) pass_rate', 'problem_id'])
            ->group('user_id, problem_id')
            ->buildSql();
        $max_sol_id_sql = db('solution')->alias('s')
            ->where('s.contest_id', $this->contest['contest_id'])
            ->whereIn('s.language', $allowedLanguages)
            ->join([$max_pass_rate_sql => 'ms'], 's.pass_rate=ms.pass_rate AND s.user_id = ms.user_id AND s.problem_id = ms.problem_id')
            ->field(['MAX(s.solution_id) solution_id', 's.user_id user_id', 's.pass_rate pass_rate', 's.problem_id problem_id'])
            ->group('user_id, pass_rate, problem_id')
            ->buildSql();
        $res = db('solution')->alias('s')
            ->where('s.contest_id', $this->contest['contest_id'])
            ->whereIn('s.language', $allowedLanguages)
            ->join([$max_sol_id_sql => 'ms'], 's.solution_id=ms.solution_id')
            ->join(['source_code' => 'sc'], 's.solution_id=sc.solution_id')
            ->field(['s.solution_id solution_id', 's.user_id user_id', 's.language language', 's.pass_rate pass_rate', 's.problem_id problem_id', 's.result result', 'sc.source source'])
            ->cache(30)
            ->select();
        return $res;
    }
    
    /**
     * 设置分数
     */
    public function set_score_ajax() {
        if(!$this->isReviewer) {
            $this->error("You're not reviewer.");
        }
        $asheet = db('ex_asheet')->where([
            'exam_id'           => $this->contest['contest_id'],
            'examinee_id'       => input('examinee_id/s'),
            'ex_question_id'    => input('ex_question_id/d')
        ])->find();
        if($asheet == null) {
            $this->error("No such answer sheet.");
        }
        if($asheet['reviewer'] != null && $asheet['reviewer'] != '' && $asheet['reviewer'] != $this->contest_user && !$this->isContestAdmin) {
            // 已批改过，除管理员外他人不可修改
            $this->error("No permission to change other's score result.");
        }
        $score = input('score/f');
        $msg = "成绩已更新 / Score Updated.";
        if($score >= 0) {
            $asheet = array_merge($asheet, [
                'notes'     => input('notes/s'),
                'score'     => $score,     // 管理员接口，暂不作后端验证
                'reviewer'  => isset($this->contest_user) ? $this->contest_user : session('user_id') . "#SYS"
            ]);
        } else {
            // score=-1 信号表示删除批改信息
            $asheet = array_merge($asheet, [
                'notes'     => input('notes/s'),
                'score'     => null,    
                'reviewer'  => null
            ]);
            $msg = "成绩已清理 / Score Deleted.";
        }
        db('ex_asheet')->update($asheet);
        $this->success($msg, null, ['asheet_update'=> $asheet]);
    }

    /**
     * 批量设置分数（整卷提交）
     * - 批量查询 + 预处理 + 批量写入（单条 CASE UPDATE）
     * - 返回逐题提交结果，前端据此刷新 UI
     */
    public function set_score_batch_ajax() {
        if(!$this->isReviewer) {
            $this->error("You're not reviewer.");
        }
        $examinee_id = input('examinee_id/s');
        if($examinee_id === null || trim($examinee_id) === '') {
            $this->error("Query Data Invalid!");
        }
        // items：按 ThinkPHP 5.1 最佳实践，前端提交数组参数 items[]（items/a 读取）
        $items = input('items/a', null);
        if(!is_array($items) || count($items) === 0) {
            $this->error("No items found.");
        }
        if(count($items) > 1024) {
            $this->error("Too many items.");
        }
        
        $exam_id = intval($this->contest['contest_id']);
        $qids = [];
        foreach($items as $it) {
            $qid = isset($it['ex_question_id']) ? intval($it['ex_question_id']) : 0;
            if($qid > 0) $qids[] = $qid;
        }
        $qids = array_values(array_unique($qids));
        if(count($qids) === 0) {
            $this->error("No valid question id.");
        }
        
        // 批量查询答卷（一次）
        $asheets = db('ex_asheet')
            ->where('exam_id', $exam_id)
            ->where('examinee_id', $examinee_id)
            ->whereIn('ex_question_id', $qids)
            ->field(['ex_asheet_id', 'exam_id', 'examinee_id', 'ex_question_id', 'reviewer'])
            ->select();
        
        $asheetMap = [];
        foreach($asheets as $row) {
            $asheetMap[intval($row['ex_question_id'])] = $row;
        }
        
        $results = [];
        $updates = []; // keyed by qid => ['notes'=>..., 'score'=>..., 'reviewer'=>...]
        $reviewer_now = isset($this->contest_user) ? $this->contest_user : session('user_id') . "#SYS";
        
        foreach($items as $it) {
            $qid = isset($it['ex_question_id']) ? intval($it['ex_question_id']) : 0;
            if($qid <= 0) {
                $results[] = ['ok' => false, 'ex_question_id' => $qid, 'msg' => 'Invalid question id'];
                continue;
            }
            if(!isset($asheetMap[$qid])) {
                // 与单题接口一致：没有答卷记录则失败（不自动插入空记录，避免破坏 submission/create_at）
                $results[] = ['ok' => false, 'ex_question_id' => $qid, 'msg' => 'No such answer sheet.'];
                continue;
            }
            $oldReviewer = isset($asheetMap[$qid]['reviewer']) ? strval($asheetMap[$qid]['reviewer']) : '';
            if($oldReviewer !== '' && $oldReviewer !== $reviewer_now && !$this->isContestAdmin) {
                $results[] = ['ok' => false, 'ex_question_id' => $qid, 'msg' => "No permission to change other's score result."];
                continue;
            }
            $score = isset($it['score']) ? floatval($it['score']) : -1.0;
            $notes = isset($it['notes']) ? strval($it['notes']) : '';
            if($score >= 0) {
                $updates[$qid] = [
                    'notes' => $notes,
                    'score' => $score,
                    'reviewer' => $reviewer_now,
                ];
            } else {
                // score=-1 表示清理批改信息（但保留 notes 以便“评语/备注”仍可被保存）
                $updates[$qid] = [
                    'notes' => $notes,
                    'score' => null,
                    'reviewer' => null,
                ];
            }
            $results[] = ['ok' => true, 'ex_question_id' => $qid];
        }
        
        // 没有任何可写入项
        if(count($updates) === 0) {
            $this->success("Batch submit done.", null, ['results' => $results, 'updated' => []]);
        }
        
        // 批量写入：用 CASE WHEN 合并为一次 UPDATE
        // 注意：SQL 的占位符顺序是 “notes 全部 ?” -> “score 全部 ?” -> “reviewer 全部 ?”
        // 因此 bind 也必须按列分组，不能按 qid 交错追加，否则会错位写入，导致 score 列被写入 JSON 等严重错误。
        $notesBind = [];
        $scoreBind = [];
        $reviewerBind = [];
        $notesCase = "CASE ex_question_id ";
        $scoreCase = "CASE ex_question_id ";
        $reviewerCase = "CASE ex_question_id ";
        
        foreach($updates as $qid => $u) {
            $notesCase .= " WHEN {$qid} THEN ? ";
            $notesBind[] = $u['notes'];
            
            if($u['score'] === null) {
                $scoreCase .= " WHEN {$qid} THEN NULL ";
            } else {
                $scoreCase .= " WHEN {$qid} THEN ? ";
                $scoreBind[] = floatval($u['score']);
            }
            
            if($u['reviewer'] === null) {
                $reviewerCase .= " WHEN {$qid} THEN NULL ";
            } else {
                $reviewerCase .= " WHEN {$qid} THEN ? ";
                $reviewerBind[] = strval($u['reviewer']);
            }
        }
        $notesCase .= " ELSE notes END";
        $scoreCase .= " ELSE score END";
        $reviewerCase .= " ELSE reviewer END";
        
        // IN 列表使用数值拼接（qid 均为 int），避免生成过多占位符
        $qidListSql = implode(',', array_map('intval', array_keys($updates)));
        $sql = "UPDATE `ex_asheet` 
            SET `notes` = {$notesCase},
                `score` = {$scoreCase},
                `reviewer` = {$reviewerCase}
            WHERE `exam_id` = ? AND `examinee_id` = ? AND `ex_question_id` IN ({$qidListSql})";
        $bind = array_merge($notesBind, $scoreBind, $reviewerBind, [$exam_id, $examinee_id]);
        
        // 使用 Db::execute 执行预处理 SQL
        \think\Db::execute($sql, $bind);
        
        // 批量查询更新后的结果（一次）
        $updatedRows = db('ex_asheet')
            ->where('exam_id', $exam_id)
            ->where('examinee_id', $examinee_id)
            ->whereIn('ex_question_id', array_keys($updates))
            ->field(['ex_question_id', 'score', 'notes', 'reviewer'])
            ->select();
        
        $updatedMap = [];
        foreach($updatedRows as $row) {
            $qid = intval($row['ex_question_id']);
            $notesObj = null;
            try {
                $decoded = json_decode(strval($row['notes']), true);
                if(is_array($decoded)) $notesObj = $decoded;
            } catch(\Throwable $e) {
                $notesObj = null;
            }
            $updatedMap[$qid] = [
                'ex_question_id' => $qid,
                'score' => $row['score'],
                'notes' => $row['notes'],
                'notes_obj' => $notesObj,
                'reviewer' => $row['reviewer'],
            ];
        }
        
        // 将 ok 项补齐实际结果
        for($i = 0; $i < count($results); $i++) {
            if(!isset($results[$i]['ok']) || !$results[$i]['ok']) continue;
            $qid = intval($results[$i]['ex_question_id']);
            if(isset($updatedMap[$qid])) {
                $results[$i] = array_merge($results[$i], $updatedMap[$qid]);
            } else {
                $results[$i]['ok'] = false;
                $results[$i]['msg'] = 'Update failed.';
            }
        }
        
        $okCnt = 0;
        $failCnt = 0;
        foreach($results as $r) {
            if(isset($r['ok']) && $r['ok']) $okCnt++;
            else $failCnt++;
        }
        $this->success("Batch submit done: {$okCnt} ok, {$failCnt} failed.", null, [
            'results' => $results,
            'updated' => array_values($updatedMap),
        ]);
    }
    
    /**
     * 记录导出页面
     */
    public function record_export() {
        $this->assign('contest_problem', db('contest_problem')->where('contest_id', $this->contest['contest_id'])->order('num', 'asc')->select());
        return $this->fetch();
    }
    
    /**
     * 阅卷员记录列表
     */
    public function reviewer_recorded_list_ajax() {
        if(!$this->isReviewer) {
            $this->error("You're not reviewer.");
        }
        $reviewer_sys_list = input('reviewer_sys/a');
        $reviewer_exam_list = input('reviewer_exam/a');
        $reviewer_sys = db('users')->where('user_id', 'in', $reviewer_sys_list)->field(['user_id reviewer', 'nick name'])->select();
        // 修复 ThinkPHP 5.1 IN 查询：将 IN 查询改为链式调用，避免数组格式解析错误
        $reviewer_exam = db('cpc_team')
            ->where('team_id', 'in', $reviewer_exam_list)
            ->where('contest_id', $this->contest['contest_id'])
            ->field(['team_id reviewer', 'name'])
            ->select();
        $this->success('ok', null, [
            'reviewer_sys'  => $reviewer_sys,
            'reviewer_exam' => $reviewer_exam,
        ]);
    }
}

