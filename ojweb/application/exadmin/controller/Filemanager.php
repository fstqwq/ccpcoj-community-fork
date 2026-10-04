<?php
namespace app\exadmin\controller;
use app\admin\controller\Filemanager as AdminFilemanager;

/**
 * exadmin Filemanager 控制器
 * 继承 admin/Filemanager，复用文件管理逻辑
 * 需要重写部分方法以修正 URL 路径
 */
class Filemanager extends AdminFilemanager
{
    /**
     * exadmin：放通班级教师管理其班级练习（contest.clss_id）的附件
     * 说明：
     * - 课程管理员/超管：可管理本课程所有练习附件
     * - 课程教师：仅可管理“自己管辖班级”的练习附件
     *
     * 注意：考试管理也复用 contest 表，但考试 contest 通常 clss_id=0（不绑定班级）。
     * 这类 contest 的附件管理应按“课程绑定 + owner”规则处理，而不是直接报错。
     */
    public function FileAuthentication()
    {
        // contest 附件：支持班级教师
        if (isset($this->inputInfo['item']) && $this->inputInfo['item'] === 'contest') {
            if (!IsLogin()) {
                $this->error('Please loggin first.', '/', null, 1);
            }

            $contest_id = intval($this->inputInfo['id']);
            if ($contest_id <= 0) {
                $this->error('No such contest.');
            }

            // 查询 contest（拿到 clss_id / attach / title）
            $contest = db('contest')->where('contest_id', $contest_id)
                ->field(['contest_id', 'clss_id', 'attach', 'title'])
                ->find();
            if (!$contest) {
                $this->error('No such contest.');
            }

            $clss_id = intval($contest['clss_id'] ?? 0);
            // 分支1：班级 contest（练习）
            if ($clss_id > 0) {
                // 校验：必须属于当前课程上下文
                // 注意：clss 表不再存 course_key，归属改由 course_item(item='clss') 维护
                if (!$this->NOW_COURSE_ID) {
                    $this->error("未选择课程组");
                }
                $clss = db('clss')->alias('cl')
                    ->join('course_item ci_clss', "ci_clss.item_id = cl.clss_id AND ci_clss.item = 'clss'", 'inner')
                    ->where([
                        'cl.clss_id' => $clss_id,
                        'cl.defunct' => 'C',
                        'ci_clss.course_id' => intval($this->NOW_COURSE_ID),
                    ])
                    ->where(function($q) {
                        // 兼容历史数据：pvrole 可能为 NULL 或空字符串
                        $q->whereNull('ci_clss.pvrole')->whereOr('ci_clss.pvrole', '');
                    })
                    ->field(['cl.clss_id'])
                    ->find();
                if (!$clss) {
                    $this->error("You don't have permission to manage this item in current course context");
                }

                // 权限：课程管理员/超管/全局管理员/编辑权限 => 放通
                // 注意：PrivCourse('admin') 已包含 super 权限的检查
                if (IsAdmin('administrator') || IsAdmin('super_admin') || IsAdmin('contest_editor') ||
                    PrivCourse('admin', $this->NOW_COURSE_KEY)) {
                    // allowed
                } else {
                    // 课程教师：必须是该班级教师
                    if (!PrivCourse('teacher', $this->NOW_COURSE_KEY)) {
                        $this->error("You don't own this item.");
                    }
                    $pvrole_teacher = GetPvroleConfig('clss_teacher', 'teacher');
                    $teacher_count = db('privilege_item')->where([
                        'rightitem' => 'clss',
                        'item_id' => $clss_id,
                        'user_id' => session('user_id'),
                        'pvrole' => $pvrole_teacher,
                        'defunct' => '0'
                    ])->count();
                    if ($teacher_count <= 0) {
                        $this->error("You don't own this item.");
                    }
                }
                // 临时调试：班级分支
                if (input('debug') === '1' || input('debug') === 'filemanager') {
                    $pvrole_teacher = GetPvroleConfig('clss_teacher', 'teacher');
                    $teacher_count_dbg = db('privilege_item')->where([
                        'rightitem' => 'clss', 'item_id' => $clss_id, 'user_id' => session('user_id'),
                        'pvrole' => $pvrole_teacher, 'defunct' => '0'
                    ])->count();
                    $dbg = [
                        'branch' => 'class(clss_id>0)',
                        'contest_id' => $contest_id,
                        'clss_id' => $clss_id,
                        'NOW_COURSE_ID' => $this->NOW_COURSE_ID,
                        'NOW_COURSE_KEY' => $this->NOW_COURSE_KEY ?? '(not set)',
                        'PrivCourse(admin)' => function_exists('PrivCourse') ? PrivCourse('admin', $this->NOW_COURSE_KEY) : 'N/A',
                        'PrivCourse(teacher)' => function_exists('PrivCourse') ? PrivCourse('teacher', $this->NOW_COURSE_KEY) : 'N/A',
                        'teacher_count' => $teacher_count_dbg,
                    ];
                    $this->error('[DEBUG] ' . json_encode($dbg, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));
                }
            } else {
                // 分支2：非班级 contest（典型：考试 contest，clss_id=0）
                // 严格鉴权：不依赖会话中的 NOW_COURSE_ID，先根据 contest 查所属课程，再校验 owner/manage/课程管理员
                $ci = db('course_item')->where([
                    'item' => 'contest',
                    'item_id' => intval($contest_id),
                ])->where(function($q) {
                    $q->whereNull('pvrole')->whereOr('pvrole', '');
                })->find();
                $contest_course_id = $ci ? intval($ci['course_id']) : 0;
                $contest_course_key = '';
                if ($contest_course_id > 0) {
                    $co = db('course')->where('course_id', $contest_course_id)->field('course_key')->find();
                    $contest_course_key = $co ? trim($co['course_key']) : '';
                }

                // 未绑定课程的 contest：仅全局管理员/contest_editor 可操作
                if ($contest_course_id <= 0 || $contest_course_key === '') {
                    if (!IsAdmin('administrator')) {
                        $this->error("This contest is not bound to any course.");
                    }
                } else {
                    // 已绑定课程：必须为以下之一 才允许
                    // - 该课程的 admin/super（PrivCourse）
                    // - 本场考试的 owner 或 manage（通过 PrivItem 鉴权）
                    $is_owner = function_exists('PrivItem') && PrivItem('contest', intval($contest_id), 'owner');
                    $is_manage = function_exists('PrivItem') && PrivItem('contest', intval($contest_id), 'manage');
                    $is_course_admin = function_exists('PrivCourse') && PrivCourse('admin', $contest_course_key);
                    // 考试附件：不含 contest_editor，仅允许全局管理员/课程管理员/本场 owner 或 manage
                    $allowed = IsAdmin('administrator') || IsAdmin('super_admin')
                        || $is_course_admin || $is_owner || $is_manage;

                    if (!$allowed) {
                        $this->error("You don't have permission to manage this exam's attachments.");
                    }
                }

                // 若当前课程与 contest 所属课程不一致，禁止操作（避免跨课程误用）
                if ($contest_course_id > 0 && $this->NOW_COURSE_ID !== $contest_course_id && !IsAdmin('administrator') && !IsAdmin('super_admin')) {
                    $this->error("You don't have permission to manage this item in current course context");
                }

                // 未绑定时由管理员/owner/manage 自动补齐 course_item（仅当有明确课程上下文时）
                $can_bind = IsAdmin() || IsAdmin('contest_editor');
                if (!$can_bind && function_exists('PrivItem')) {
                    $can_bind = PrivItem('contest', intval($contest_id), 'owner') || PrivItem('contest', intval($contest_id), 'manage');
                }
                if (!$ci && $contest_course_id <= 0 && $this->NOW_COURSE_ID && $can_bind) {
                    try {
                        db('course_item')->insert([
                            'course_id' => intval($this->NOW_COURSE_ID),
                            'item' => 'contest',
                            'item_id' => intval($contest_id),
                            'pvrole' => ''
                        ]);
                    } catch (\Throwable $e) {
                        // ignore
                    }
                }
            }

            // 兼容：补齐 attach
            if (!isset($contest['attach']) || strlen($contest['attach']) == 0) {
                $contest['attach'] = $this->AttachFolderCalculation(session('user_id'));
                db('contest')->where('contest_id', $contest_id)->update(['attach' => $contest['attach']]);
            }

            $this->itemInfo = [
                'attach' => $contest['attach'],
                'title' => $contest['title'] ?? ''
            ];
            return;
        }

        // 其他 item 复用父类逻辑
        return parent::FileAuthentication();
    }

    /**
     * 重写：修正 URL 路径为 exadmin 模块
     */
    public function filemanager() {
        $this->assign([
            'inputinfo'		=> $this->inputInfo,
            'iteminfo' 		=> $this->itemInfo,
            'file_url'		=> '/exadmin/filemanager/filemanager_ajax?item='.$this->inputInfo['item'].'&id='.$this->inputInfo['id'],
            'delete_url'	=> '/exadmin/filemanager/file_delete_ajax?item='.$this->inputInfo['item'].'&id='.$this->inputInfo['id'],
            'rename_url'	=> '/exadmin/filemanager/file_rename_ajax?item='.$this->inputInfo['item'].'&id='.$this->inputInfo['id'],
            'upload_url'	=> '/exadmin/filemanager/upload_ajax',
            'method_button'	=> 'CopyUrl',
            'file_regex'	=> $this->filenameRe,
            'attach_notify'	=> $this->filenameReMsg, // 上传按钮旁的提示信息
        ]);
        return $this->fetch();
    }
}
