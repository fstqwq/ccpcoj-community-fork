<?php
namespace app\expsys\controller;
use app\common\traits\ClssTrait;

/**
 * expsys Clss 控制器
 * 班级管理（练习模式 online-exp 使用）
 *
 * @property array $clss_query_field 查询字段（由 ClssTrait::InitClssController 设置）
 * @property array $clss_default_map 默认查询条件（由 ClssTrait::InitClssController 设置）
 */
class Clss extends Expsysbase
{
    use ClssTrait;
    
    // 注意：$clss_query_field 和 $clss_default_map 已在 ClssTrait::InitClssController() 中设置
    var $is_teacher;
    var $user_id;
    
    public function InitController() {
        if(!IsLogin()) {
            $this->error("请先登录", '/', null, 1);
        }
        $this->InitClssController();
        $this->user_id = session('user_id');
    }
    
    public function index() {
        $this->InitController();
        $this->assign('pagetitle', '我的班级');
        return $this->fetch();
    }
    
    public function GetClassRelated() {
        $this->InitController();
        // 使用 Trait 的统一方法（expsys 模式：返回用户关联的班级）
        return $this->GetUserRelatedClss();
    }
    
    public function clss_list_ajax() {
        $this->InitController();
        // 使用 Trait 的统一方法（expsys 模式：返回用户关联的班级）
        return $this->GetClssListAjax('user');
    }

    // **************************************************
    // students
    // **************************************************
    
    public function JudgeClss($clss_id=null) {
        $this->InitController();
        if($clss_id == null) {
            $clss_id = input('clss_id/d');
        }
        $q = db('clss')->alias('c')->where('c.clss_id', $clss_id);
        // clss 不再保留 course_key，统一通过 course_item(item='clss') -> course 联查
        $q = $this->applyCourseItemFilterToClssQuery($q, 'c');
        $clss_item = $q->field($this->clss_query_field)->find();
        if(!$clss_item) {
            $this->error("没有这个班级", null, null, 1);
        }
        $this->CourseBelongValidate($clss_item);
        $isClssTeacher = $this->IsClssTeacher($clss_item['clss_id'], $clss_item);
        $isClssStu = $this->IsUserClssStu($this->user_id, $clss_item['clss_id']);
        if(!IsAdmin() && !$isClssStu && !$isClssTeacher) {
            $this->error("非本班", null, null, 1);
        }
        return [
            'clss'          => $clss_item,
            'isClssTeacher' => $isClssTeacher,
            'isClssStu'     => $isClssStu,
        ];
    }
    
    /**
     * 判断学期是否已结束（超过结束时间2个月）
     * @param string $semester 学期字符串，格式：2023-2024-1, 2023-2024-2, 2023-2024-3
     * @return array ['is_expired' => bool, 'end_time' => int] 是否已过期，学期结束时间戳
     */
    protected function checkSemesterExpired($semester) {
        if(empty($semester) || !preg_match('/^(\d{4})-(\d{4})-(\d+)$/', $semester, $matches)) {
            return ['is_expired' => false, 'end_time' => 0];
        }
        
        $start_year = intval($matches[1]);
        $end_year = intval($matches[2]);
        $semester_num = intval($matches[3]);
        
        // 根据学期号确定结束时间
        // 1学期：9月~2月，结束时间：次年2月28日 23:59:59
        // 2学期：3月~6月，结束时间：当年6月30日 23:59:59
        // 3学期：7~8月，结束时间：当年8月31日 23:59:59
        if($semester_num == 1) {
            $end_time = mktime(23, 59, 59, 2, 28, $end_year);
        } elseif($semester_num == 2) {
            $end_time = mktime(23, 59, 59, 6, 30, $end_year);
        } elseif($semester_num == 3) {
            $end_time = mktime(23, 59, 59, 8, 31, $end_year);
        } else {
            return ['is_expired' => false, 'end_time' => 0];
        }
        
        // 学期结束时间 + 2个月
        $expire_time = strtotime('+2 months', $end_time);
        $now = time();
        
        return [
            'is_expired' => $now > $expire_time,
            'end_time' => $end_time
        ];
    }
    
    public function stu() {
        $this->InitController();
        $info = $this->JudgeClss();
        
        // 检查学期是否已过期
        $semester_check = ['is_expired' => false, 'end_time' => 0];
        if(isset($info['clss']['clss_semester']) && !empty($info['clss']['clss_semester'])) {
            $semester_check = $this->checkSemesterExpired($info['clss']['clss_semester']);
        }
        
        // 检查是否是课程组管理员
        $is_course_admin = false;
        if(isset($info['clss']['course_key']) && !empty($info['clss']['course_key'])) {
            $is_course_admin = PrivCourse('admin', $info['clss']['course_key']);
        }
        
        // 是否允许修改：课程组管理员始终可以修改，否则需要学期未过期
        $allow_modify = $is_course_admin || !$semester_check['is_expired'];
        
        $this->assign('pagetitle', '班级学生');
        $this->assign($info);
        $this->assign('semester_check', $semester_check);
        $this->assign('is_course_admin', $is_course_admin);
        $this->assign('allow_modify', $allow_modify);
        return $this->fetch();
    }
    
    public function stu_list_ajax() {
        $this->InitController();
        $info = $this->JudgeClss();
        
        // 从配置获取 pvrole 值
        $member_roles = GetPvroleConfig('clss_member_roles', ['student', 'ta']);
        
        // 判断是否有权限查看学号（教师或管理员）
        $can_view_user_id = $info['isClssTeacher'] || IsAdmin();
        
        // 构建查询字段（始终查询 user_id，但根据权限决定是否返回）
        $fields = [
            'pi.user_id user_id',
            'pi.pvrole pvrole',
            'u.nick nick',
            'u.school school',
            // 'pi.defunct defunct',  // 暂时不处理 defunct 字段
        ];
        
        // 使用 privilege_item 表查询（pvrole='student' 表示学生，pvrole='ta' 表示助教）
        $stu_list = db('users')->alias('u')
            ->join('privilege_item pi', 'pi.user_id=u.user_id', 'right')
            ->where([
                'pi.rightitem' => 'clss',
                'pi.item_id' => $info['clss']['clss_id'],
                // 'pi.defunct' => '0'  // 暂时不处理 defunct 字段
            ])
            ->where('pi.pvrole', 'in', $member_roles)
            ->field($fields)
            ->select();
        
        // 如果不是教师或管理员，隐藏学号（设置为空字符串）
        if(!$can_view_user_id) {
            foreach($stu_list as &$stu) {
                $stu['user_id'] = '';
            }
        }
        
        return $stu_list;
    }
    
    public function stu_del_ajax() {
        $this->InitController();
        $info = $this->JudgeClss();
        if(!$info['isClssTeacher'] && !IsAdmin()) {
            $this->error("非本班教师或管理员");
        }
        
        // 检查学期时间限制
        $semester_check = ['is_expired' => false];
        if(isset($info['clss']['clss_semester']) && !empty($info['clss']['clss_semester'])) {
            $semester_check = $this->checkSemesterExpired($info['clss']['clss_semester']);
        }
        $is_course_admin = false;
        if(isset($info['clss']['course_key']) && !empty($info['clss']['course_key'])) {
            $is_course_admin = PrivCourse('admin', $info['clss']['course_key']);
        }
        if($semester_check['is_expired'] && !$is_course_admin) {
            $this->error("已结束的学期禁止修改班级成员");
        }
        
        // 从配置获取 pvrole 值
        $member_roles = GetPvroleConfig('clss_member_roles', ['student', 'ta']);
        
        // 使用 privilege_item 表删除（pvrole='student' 或 'ta'）
        db('privilege_item')->where([
            'user_id' => input('user_id/s'),
            'rightitem' => 'clss',
            'item_id' => $info['clss']['clss_id']
        ])
        ->where('pvrole', 'in', $member_roles)
        ->delete();
        $this->success('删除班级成员成功');
    }
    
    public function stu_add_ajax() {
        $this->InitController();
        $info = $this->JudgeClss();
        if(!$info['isClssTeacher'] && !IsAdmin()) {
            $this->error("非本班教师或管理员");
        }
        
        // Session 防抖控制：限制修改同一个班级学生的频率
        $clss_id = $info['clss']['clss_id'];
        $session_key = 'last_clss_stu_batch_' . $clss_id;
        $now = time();
        if(session('?' . $session_key)) {
            $batchWaitTime = config('CsgojConfig.OJ_CLSS_STU_BATCH_WAIT_TIME');
            if($now - session($session_key) < $batchWaitTime) {
                $remaining_time = $batchWaitTime - ($now - session($session_key));
                $this->error("操作过于频繁，请等待 {$remaining_time} 秒后再试");
            }
        }
        
        // 检查学期时间限制
        $semester_check = ['is_expired' => false];
        if(isset($info['clss']['clss_semester']) && !empty($info['clss']['clss_semester'])) {
            $semester_check = $this->checkSemesterExpired($info['clss']['clss_semester']);
        }
        $is_course_admin = false;
        if(isset($info['clss']['course_key']) && !empty($info['clss']['course_key'])) {
            $is_course_admin = PrivCourse('admin', $info['clss']['course_key']);
        }
        if($semester_check['is_expired'] && !$is_course_admin) {
            $this->error("已结束的学期禁止修改班级成员");
        }
        $stu_add_list = input('stu_add_list/a');
        if($stu_add_list == null) {
            $stu_add_list = [];
        }
        
        // 检查学生数量上限（512个）
        if(count($stu_add_list) > 512) {
            $this->error("学生数量不能超过512个");
        }
        
        // 从配置获取 pvrole 值
        $pvrole_student = GetPvroleConfig('clss_student', 'student');
        $pvrole_ta = GetPvroleConfig('clss_ta', 'ta');
        $member_roles = GetPvroleConfig('clss_member_roles', ['student', 'ta']);
        
        // 构建新的学生列表（user_id => pvrole），去重并验证
        $new_stu_map = [];
        $dup_map = [];
        foreach($stu_add_list as $val) {
            if(array_key_exists($val['user_id'], $dup_map)) {
                continue; // 跳过重复的
            }
            $len = strlen($val['user_id']);
            if($len > 32 || $len < 3) {
                $this->error("存在ID长度不正确：" . $val['user_id']);
            }
            if(!preg_match('/^[a-zA-Z0-9_]+$/', $val['user_id'])) {
                $this->error("存在ID格式不正确：" . $val['user_id']);
            }
            $dup_map[$val['user_id']] = true;
            
            // 使用 pvrole 字段：如果前端传入了 pvrole='ta'，则为助教，否则为学生
            // 兼容旧格式：如果传入了 defunct 字段，则根据 defunct & 1 判断
            $pvrole = $pvrole_student;  // 默认为学生
            if(isset($val['pvrole']) && $val['pvrole'] === 'ta') {
                $pvrole = $pvrole_ta;
            }
            // 暂时不处理 defunct 字段
            // elseif(isset($val['defunct']) && (intval($val['defunct']) & 1) == 1) {
            //     // 兼容旧格式：defunct & 1 == 1 表示助教
            //     $pvrole = $pvrole_ta;
            // }
            
            $new_stu_map[$val['user_id']] = $pvrole;
        }
        
        // 获取当前数据库中的学生列表（user_id => pvrole）
        $current_stu_list = db('privilege_item')->where([
            'rightitem' => 'clss',
            'item_id' => $info['clss']['clss_id']
            // 'defunct' => '0'  // 暂时不处理 defunct 字段
        ])
        ->where('pvrole', 'in', $member_roles)
        ->column('pvrole', 'user_id');
        
        // 对比找出需要新增、删除、更新的学生
        $to_insert = [];  // 需要新增的
        $to_delete_user_ids = [];  // 需要删除的 user_id
        $to_update = [];  // 需要更新 pvrole 的 (user_id => new_pvrole)
        
        // 找出需要新增和更新的
        foreach($new_stu_map as $user_id => $new_pvrole) {
            if(!isset($current_stu_list[$user_id])) {
                // 不在当前列表中，需要新增
                $to_insert[] = [
                    'user_id'   => $user_id,
                    'rightitem' => 'clss',
                    'item_id'   => $info['clss']['clss_id'],
                    'pvrole'    => $new_pvrole,
                    // 'defunct'   => '0'  // 暂时不处理 defunct 字段
                ];
            } elseif($current_stu_list[$user_id] !== $new_pvrole) {
                // 在当前列表中但 pvrole 不同，需要更新
                $to_update[$user_id] = $new_pvrole;
            }
            // 如果 user_id 和 pvrole 都相同，则不需要任何操作
        }
        
        // 找出需要删除的（在当前列表中但不在新列表中）
        foreach($current_stu_list as $user_id => $old_pvrole) {
            if(!isset($new_stu_map[$user_id])) {
                $to_delete_user_ids[] = $user_id;
            }
        }
        
        // 验证最终学生数量不超过512（增量更新后的数量）
        $final_stu_count = count($new_stu_map);
        if($final_stu_count > 512) {
            $this->error("学生数量不能超过512个（当前尝试设置{$final_stu_count}个）");
        }
        
        // 执行批量操作
        $db = db('privilege_item');
        $db->startTrans();
        
        // 1. 批量删除需要删除的学生
        if(!empty($to_delete_user_ids)) {
            $db->where([
                'rightitem' => 'clss',
                'item_id' => $info['clss']['clss_id']
            ])
            ->where('pvrole', 'in', $member_roles)
            ->where('user_id', 'in', $to_delete_user_ids)
            ->delete();
        }
        
        // 2. 批量插入需要新增的学生
        if(!empty($to_insert)) {
            $db->insertAll($to_insert);
        }
        
        // 3. 批量更新需要更新 pvrole 的学生
        // 按 pvrole 分组批量更新，减少更新次数（最多2次：student 和 ta）
        if(!empty($to_update)) {
            $update_by_pvrole = [];
            foreach($to_update as $user_id => $new_pvrole) {
                if(!isset($update_by_pvrole[$new_pvrole])) {
                    $update_by_pvrole[$new_pvrole] = [];
                }
                $update_by_pvrole[$new_pvrole][] = $user_id;
            }
            
            // 按 pvrole 分组批量更新（每个 pvrole 值只执行一次更新）
            foreach($update_by_pvrole as $new_pvrole => $user_ids) {
                $db->where([
                    'rightitem' => 'clss',
                    'item_id' => $info['clss']['clss_id']
                ])
                ->where('pvrole', 'in', $member_roles)
                ->where('user_id', 'in', $user_ids)
                ->update(['pvrole' => $new_pvrole]);
            }
        }
        
        $db->commit();
        
        // 构建返回信息
        $info_parts = [];
        if(count($dup_map) != count($stu_add_list)) {
            $info_parts[] = '已去除重复学号';
        }
        if(!empty($to_insert)) {
            $info_parts[] = '新增' . count($to_insert) . '个学生';
        }
        if(!empty($to_delete_user_ids)) {
            $info_parts[] = '删除' . count($to_delete_user_ids) . '个学生';
        }
        if(!empty($to_update)) {
            $info_parts[] = '更新' . count($to_update) . '个学生的角色';
        }
        
        $info = empty($info_parts) ? '处理完毕（无变化）' : '处理完毕：' . implode('，', $info_parts);
        
        // 更新 session，记录本次操作时间
        session($session_key, time());
        
        $this->success($info);
    }
}
