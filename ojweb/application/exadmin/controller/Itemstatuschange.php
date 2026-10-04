<?php
/**
 * exadmin Itemstatuschange 控制器
 * 用于修改 defunct、private 等标记的 Controller
 */
namespace app\exadmin\controller;

class Itemstatuschange extends Exadminbase
{
    //用于修改defunct、private等标记的Controller
    var $itemInfo;
    var $changeInfo;
    var $allowField;
    
    public function initialize()
    {
        $this->OJMode();
        $this->allowField = [
            'defunct'	=> [
                [
                    'status_str'	=> 'Public',
                    'status_class'	=> 'success',
                ],
                [
                    'status_str'	=> 'Reserved',
                    'status_class'	=> 'warning',
                ],
            ],
            'private'	=> [
                [
                    'status_str'	=> 'Public',
                    'status_class'	=> 'success',
                ],
                [
                    'status_str'	=> 'Private',
                    'status_class'	=> 'primary',
                ],
            ],
            'archived' 	=> [
                [
                    'status_str'	=> 'UnArchive',
                    'status_class'	=> 'default',
                ],
                [
                    'status_str'	=> 'Archived',
                    'status_class'	=> 'info',
                ],
            ]
        ]; //以后扩展功能再改此配置
        $this->AdminInit();
        $this->ItemStatusAuthentication();
    }
    
    private function ItemStatusAuthentication()
    {
        //$status_item指 defunct 或 private(contest里的)
        //Admin ChangeDefunct管理的通用验证，$item = news、problem、contest、course
        $this->changeInfo = [
            'item' 		=> trim(input('item')),
            'field'		=> trim(input('field')),
            'id' 		=> trim(input('id')),
            'status'	=> trim(input('status'))
        ];

        if(!array_key_exists($this->changeInfo['field'], $this->allowField))
        {
            //只能修改允许的字段。比如defunct、private
            $this->error("You can't change this field");
        }
        
        $this->privilegeStr = $this->changeInfo['item']; //比如 problem、course
        
        // 特殊处理 course：需要检查是否是课程组管理员
        if($this->privilegeStr == 'course') {
            // 对于 course，需要检查是否是课程组管理员或超级管理员
            $course = db('course')->where('course_id', $this->changeInfo['id'])->field('course_key')->find();
            if(!$course) {
                $this->error('No such course.');
            }
            if(!IsAdmin('super_admin') && !PrivCourse('admin', $course['course_key'])) {
                $this->error("You don't have permission to manage this course group", '/'.$this->request->module(), '', 1);
            }
        } else {
            // 支持的资源类型：problem、contest、news
            $supported_items = ['problem', 'contest', 'news'];
            if(!in_array($this->privilegeStr, $supported_items))
            {
                //无此模块
                $this->error('No such work like "' . $this->changeInfo['item'] . '"');
            }
            
            // 检查是否是管理员（全局管理员或课程管理员）
            $is_global_admin = IsAdmin();
            // 注意：PrivCourse('admin') 已包含 super 权限的检查
            $is_course_admin = PrivCourse('admin', $this->NOW_COURSE_KEY);
            $is_teacher = PrivCourse('teacher', $this->NOW_COURSE_KEY);
            
            // 直接使用 {item}_editor 作为权限名称
            $this->privilegeName = $this->privilegeStr . '_editor';  // problem_editor, contest_editor, news_editor
            
            // 对于 contest 类型，特殊处理教师权限
            if($this->privilegeStr == 'contest') {
                // 先取 contest 基础信息 + 课程归属校验（防止跨课程误改）
                $contest = db('contest')->where('contest_id', $this->changeInfo['id'])->field('contest_id, clss_id')->find();
                if(!$contest) {
                    $this->error('No such contest.');
                }
                // 必须属于当前课程组
                $this->CourseBelongValidate($contest, 'contest');

                // 管理员/课程管理员/全局 contest_editor 允许改状态（不要求 per-contest PrivItem）
                if(IsAdmin($this->privilegeName) || $is_global_admin || $is_course_admin) {
                    // allowed
                }
                // 课程教师：
                // - 班级练习：允许改“自己班级”的练习状态（clss_id > 0 且为该班教师）
                // - 考试（clss_id <= 0）：允许改“自己负责(owner)”或“可管理(manage)”的考试状态
                else if($is_teacher) {
                    // 1) owner 或 manage（考试负责人/可管理人）：直接放行
                    if (function_exists('PrivItem') && (PrivItem('contest', intval($contest['contest_id']), 'owner') || PrivItem('contest', intval($contest['contest_id']), 'manage'))) {
                        // allowed
                    }
                    // 2) 班级练习：班级教师（clss_id > 0）
                    else if(isset($contest['clss_id']) && intval($contest['clss_id']) > 0) {
                        $clss_id = intval($contest['clss_id']);
                        $user_id = session('user_id');
                        $pvrole_teacher = GetPvroleConfig('clss_teacher', 'teacher');
                        $teacher_count = db('privilege_item')->where([
                            'rightitem' => 'clss',
                            'item_id' => $clss_id,
                            'user_id' => $user_id,
                            'pvrole' => $pvrole_teacher,
                            'defunct' => '0'
                        ])->count();
                        if($teacher_count == 0) {
                            $this->error("You don't own this item.");
                        }
                    }
                    // 3) 非班级 contest：非 owner 则无权限
                    else {
                        $this->error("You don't own this item.");
                    }
                } else {
                    $this->error("You don't have this privilege", '/'.$this->request->module(), '', 1);
                }
            } else {
                // 其他资源类型（problem、news）
                $idField = $this->changeInfo['item'] . '_id';
                $itemRow = db($this->changeInfo['item'])->where($idField, $this->changeInfo['id'])->field([$idField])->find();
                if(!$itemRow) {
                    $this->error('No such ' . $this->changeInfo['item'] . '.');
                }
                // 必须属于当前课程组（防止跨课程误改）
                $this->CourseBelongValidate($itemRow, $this->changeInfo['item']);

                // 课程管理员：允许改状态（不要求 per-item PrivItem）
                if($is_course_admin || $is_global_admin) {
                    // allowed
                } else {
                    // 兼容旧逻辑：需要 editor 权限 + item admin 权限
                    if(!IsAdmin($this->privilegeName)) {
                        $this->error("You don't have this privilege", '/'.$this->request->module(), '', 1);
                    }
                    if (!PrivItem($this->changeInfo['item'], $this->changeInfo['id'], 'admin')) {
                        $this->error("You don't own this item.");
                    }
                }
            }
        }
        
        // 获取当前状态
        $idField = $this->changeInfo['item'] . '_id';
        $this->itemInfo = db($this->changeInfo['item'])
            ->where($idField, $this->changeInfo['id'])
            ->field($this->changeInfo['field'])
            ->find();
        if (!$this->itemInfo) {
            //无此条目
            $this->error('No such ' . $this->changeInfo['item'] . '.');
        }
    }

    public function change_status_ajax()
    {
        // 统一使用 0/1（course 表也是按 defunct=0/1 使用）
        $this->itemInfo[$this->changeInfo['field']] = $this->changeInfo['status'];
        $idField = $this->changeInfo['item'] . '_id';
        
        // ThinkPHP 的 update 返回 0 表示未发生变化，不应当视为失败
        if (db($this->changeInfo['item'])->where($idField, $this->changeInfo['id'])->update($this->itemInfo) === false) {
            $this->error('Change '.$this->changeInfo['field'].' failed.');
        }

        $this->success(
            'Succesfully Changed.',
            null,
            [
                'status'=>$this->changeInfo['status'],
                'status_str'=>$this->allowField[$this->changeInfo['field']][$this->changeInfo['status']]['status_str'],
                'status_class_rmv'=>$this->allowField[$this->changeInfo['field']][!$this->changeInfo['status']]['status_class'],
                'status_class'=>$this->allowField[$this->changeInfo['field']][$this->changeInfo['status']]['status_class'],
            ]
        );
    }
}

