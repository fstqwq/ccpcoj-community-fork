<?php
/**
 * expsys 模块基类控制器
 * 练习模式，使用普通 users 表，关联 clss（班级）
 */
namespace app\expsys\controller;
use \Expbasecontroller;

class Expsysbase extends Expbasecontroller
{
    public function initialize()
    {
        parent::initialize();
        $this->ExpInit();
    }
    
    /**
     * 重写：获取模块特定的 OJ_MODE/OJ_STATUS 要求
     * expsys 是练习模式，需要 OJ_STATUS='exp' 且 OJ_MODE='online'
     */
    protected function getModuleRequirement()
    {
        return [
            'oj_mode' => 'online',
            'oj_status' => 'exp'
        ];
    }
    
    /**
     * expsys 初始化
     * 练习模式不需要 exam 相关功能
     */
    public function ExpInit() {
        // expsys：管理员判定 = 全局管理员 或 当前课程的 super/admin
        // 否则会走班级 privilege_item 过滤，导致“课程超级管理员但非课程管理员”看不到任何班级练习列表
        // 注意：PrivCourse('admin') 已包含 super 权限的检查
        $this->isAdmin = IsAdmin() || PrivCourse('admin', $this->NOW_COURSE_KEY);
        $this->assign('isAdmin', $this->isAdmin);
    }
    
    /**
     * 获取当前用户关联的班级ID列表
     * 包括：1. 用户作为教师的班级（pvrole='teacher'） 2. 用户有权限访问的班级（pvrole=NULL）
     * 
     * @return array 班级ID数组
     */
    protected function GetUserRelatedClssIds() {
        if(!session('?user_id')) {
            return [];
        }
        
        $user_id = session('user_id');
        
        // 使用 privilege_item 表查询用户关联的班级（包括教师和学生）
        // 课程过滤改为 course_item（item='clss'），避免依赖 clss.course_key（course_key 可能会改名）
        $clss_list = db('privilege_item')->alias('pi')
            ->join('clss c', 'pi.item_id = c.clss_id', 'inner')
            ->where([
                'pi.user_id' => $user_id,
                'pi.rightitem' => 'clss',
                'c.defunct' => 'C'
            ])
            ->join('course_item ci_clss', "ci_clss.item_id = c.clss_id AND ci_clss.item = 'clss'", 'inner')
            ->where('ci_clss.course_id', $this->NOW_COURSE_ID)
            ->where(function($q) {
                $q->whereNull('ci_clss.pvrole')->whereOr('ci_clss.pvrole', '');
            })
            ->column('pi.item_id');
        
        // 去重并确保都是整数
        if(empty($clss_list)) {
            return [];
        }
        
        $clss_list = array_unique(array_map('intval', $clss_list));
        return array_values($clss_list); // 重新索引数组
    }
    
    /**
     * 批量获取班级的教师列表（结构化数据）
     * 联查 privilege_item 和 users 表，获取教师的详细信息
     * 优化：使用 JOIN 查询，性能优于先查询再使用 IN
     * 
     * @param array $clss_ids 班级ID数组（纯整数数组，或 ['in', [...]] 格式）
     * @return array 格式：['clss_id' => [['user_id' => 'xxx', 'nick' => 'xxx', 'school' => 'xxx'], ...], ...]
     */
    protected function GetClssTeachersMap($clss_ids) {
        if(empty($clss_ids)) {
            return [];
        }
        
        // 处理 ['in', [...]] 格式（ThinkPHP 查询结果可能返回这种格式）
        if(is_array($clss_ids) && count($clss_ids) == 2 && isset($clss_ids[0]) && $clss_ids[0] === 'in' && is_array($clss_ids[1])) {
            $clss_ids = $clss_ids[1];
        }
        
        // 确保是数组
        if(!is_array($clss_ids)) {
            $clss_ids = [$clss_ids];
        }
        
        // 强制转换为纯整数数组，展平所有嵌套结构
        $final_ids = [];
        foreach($clss_ids as $value) {
            if(is_array($value)) {
                // 如果是 ['in', [...]] 格式，提取数组部分
                if(count($value) == 2 && isset($value[0]) && $value[0] === 'in' && is_array($value[1])) {
                    foreach($value[1] as $id) {
                        $id_int = intval($id);
                        if($id_int > 0) {
                            $final_ids[] = $id_int;
                        }
                    }
                } else {
                    // 递归处理嵌套数组
                    foreach($value as $id) {
                        $id_int = intval($id);
                        if($id_int > 0) {
                            $final_ids[] = $id_int;
                        }
                    }
                }
            } else {
                // 直接处理标量值
                $id_int = intval($value);
                if($id_int > 0) {
                    $final_ids[] = $id_int;
                }
            }
        }
        
        // 去重并重新索引，确保是纯整数数组
        $final_ids = array_values(array_unique($final_ids));
        
        if(empty($final_ids)) {
            return [];
        }
        
        // 最终验证：确保是纯整数数组
        foreach($final_ids as $id) {
            if(!is_int($id) && !is_numeric($id)) {
                \think\Log::error('GetClssTeachersMap: Invalid clss_id type', [
                    'id' => $id,
                    'type' => gettype($id),
                    'original_clss_ids' => $clss_ids,
                    'final_ids' => $final_ids
                ]);
                return [];
            }
        }
        
        $teachers_map = [];
        // 联查 privilege_item 和 users 表，获取教师的详细信息（pvrole='teacher'）
        // 优化：使用 whereIn 方法，避免数组格式问题，同时 JOIN clss 表确保数据一致性
        $teachers_list = db('privilege_item')->alias('pi')
            ->join('users u', 'pi.user_id = u.user_id', 'left')
            ->join('clss c', 'pi.item_id = c.clss_id', 'inner')
            ->where([
                'pi.rightitem' => 'clss',
                'pi.pvrole' => 'teacher',
                'c.defunct' => 'C',
            ])
            ->join('course_item ci_clss', "ci_clss.item_id = c.clss_id AND ci_clss.item = 'clss'", 'inner')
            ->where('ci_clss.course_id', $this->NOW_COURSE_ID)
            ->where(function($q) {
                $q->whereNull('ci_clss.pvrole')->whereOr('ci_clss.pvrole', '');
            })
            ->whereIn('pi.item_id', $final_ids)  // 使用 whereIn 方法，避免数组格式问题
            ->field([
                'pi.item_id clss_id',
                'pi.user_id',
                'u.nick',
                'u.school'
            ])
            ->select();
        
        foreach($teachers_list as $teacher) {
            $clss_id = $teacher['clss_id'];
            if(!isset($teachers_map[$clss_id])) {
                $teachers_map[$clss_id] = [];
            }
            // 返回结构化数据：包含 user_id, nick, school
            $teachers_map[$clss_id][] = [
                'user_id' => $teacher['user_id'],
                'nick' => $teacher['nick'] ?: $teacher['user_id'],  // 如果没有昵称，使用 user_id
                'school' => $teacher['school'] ?: ''
            ];
        }
        
        return $teachers_map;
    }
    
    /**
     * 批量获取班级的教师列表（结构化数据）- 从 contest_list 直接获取
     * 优化：直接传入 contest_list，避免先提取 clss_ids 再使用 IN 查询
     * 通过 JOIN 查询获取教师信息，避免使用 IN 查询
     * 
     * @param array $contest_list 比赛列表，必须包含 clss_id 字段
     * @return array 格式：['clss_id' => [['user_id' => 'xxx', 'nick' => 'xxx', 'school' => 'xxx'], ...], ...]
     */
    protected function GetClssTeachersMapFromContests($contest_list) {
        if(empty($contest_list)) {
            return [];
        }
        
        // 提取所有唯一的 clss_id
        $clss_ids = [];
        foreach($contest_list as $contest) {
            if(isset($contest['clss_id']) && $contest['clss_id'] > 0) {
                $clss_ids[intval($contest['clss_id'])] = true;
            }
        }
        
        if(empty($clss_ids)) {
            return [];
        }
        
        $clss_ids = array_keys($clss_ids);
        
        // 使用 JOIN 查询，通过 clss_id 关联，避免使用 IN 查询
        // 使用 whereIn 方法，避免数组格式问题
        $teachers_list = db('privilege_item')->alias('pi')
            ->join('users u', 'pi.user_id = u.user_id', 'left')
            ->join('clss c', 'pi.item_id = c.clss_id', 'inner')
            ->where([
                'pi.rightitem' => 'clss',
                'pi.pvrole' => 'teacher',
                'c.defunct' => 'C',
            ])
            ->join('course_item ci_clss', "ci_clss.item_id = c.clss_id AND ci_clss.item = 'clss'", 'inner')
            ->where('ci_clss.course_id', $this->NOW_COURSE_ID)
            ->where(function($q) {
                $q->whereNull('ci_clss.pvrole')->whereOr('ci_clss.pvrole', '');
            })
            ->whereIn('pi.item_id', $clss_ids)  // 使用 whereIn 方法，避免数组格式问题
            ->field([
                'pi.item_id clss_id',
                'pi.user_id',
                'u.nick',
                'u.school'
            ])
            ->select();
        
        $teachers_map = [];
        foreach($teachers_list as $teacher) {
            $clss_id = intval($teacher['clss_id']);
            if(!isset($teachers_map[$clss_id])) {
                $teachers_map[$clss_id] = [];
            }
            // 返回结构化数据：包含 user_id, nick, school
            $teachers_map[$clss_id][] = [
                'user_id' => $teacher['user_id'],
                'nick' => $teacher['nick'] ?: $teacher['user_id'],  // 如果没有昵称，使用 user_id
                'school' => $teacher['school'] ?: ''
            ];
        }
        
        return $teachers_map;
    }
    
    /**
     * 从 contest 数据中提取去重的班级信息
     * 
     * @param array $contest_list 比赛列表
     * @return array 去重后的班级列表，teachers 只存储 user_id 数组
     */
    protected function ExtractClssFromContests($contest_list) {
        if(empty($contest_list)) {
            return [];
        }
        
        $clss_map = [];
        
        foreach($contest_list as $contest) {
            if(!isset($contest['clss_id']) || isset($clss_map[$contest['clss_id']])) {
                continue;
            }
            
            $clss_id = $contest['clss_id'];
            // teachers 只存储 user_id 数组，不包含详细信息
            $teachers = $contest['teachers'] ?? [];
            // 确保 teachers 是数组格式（如果已经是 user_id 数组，直接使用；否则提取 user_id）
            if(!empty($teachers) && isset($teachers[0]) && is_array($teachers[0])) {
                // 如果是结构化数据，提取 user_id
                $teachers = array_column($teachers, 'user_id');
            }
            
            $clss_map[$clss_id] = [
                'clss_id' => $clss_id,
                'title' => $contest['clss_title'] ?? '',
                'year' => $contest['clss_year'] ?? null,
                'semester' => $contest['clss_semester'] ?? '',
                'teachers' => $teachers  // 只存储 user_id 数组
            ];
        }
        
        return array_values($clss_map);
    }
}
