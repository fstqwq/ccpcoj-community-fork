<?php
namespace app\exadmin\controller;
use app\common\traits\ClssTrait;

/**
 * exadmin Clss 控制器
 * 班级管理（仅练习模式 online-exp 使用）
 * 
 * @property array $clss_query_field 查询字段（由 ClssTrait::InitClssController 设置）
 * @property array $clss_default_map 默认查询条件（由 ClssTrait::InitClssController 设置）
 */
class Clss extends Exadminbase
{
    use ClssTrait;
    
    public function BaseAuth() {
        // 仅练习模式可用
        if($this->OJ_MODE != 'online' || $this->OJ_STATUS != 'exp') {
            $this->error('班级管理仅适用于练习模式', '/');
        }
        // 超级管理员和课程管理员拥有全部权限，教师需要具体班级权限
        // 注意：PrivCourse('admin') 已包含 super 权限的检查
        if(!IsAdmin() && !PrivCourse('admin', $this->NOW_COURSE_KEY) && 
           !IsAdmin('problem_editor') && !IsAdmin('contest_editor') && !PrivCourse('teacher', $this->NOW_COURSE_KEY)) {
            $this->error('无管理权限', '/');
        }
    }
    
    public function InitController() {
        $this->InitClssController();
    }
    
    public function index() {
        // 重定向到 clss_list 方法
        return $this->clss_list();
    }
    
    public function clss_list() {
        // 仅练习模式可用
        if($this->OJ_MODE != 'online' || $this->OJ_STATUS != 'exp') {
            $this->error('班级管理仅适用于练习模式', '/');
        }
        $this->InitController();
        
        // 获取课程列表（用于筛选下拉框，仅管理员可见）
        // 超级管理员和课程管理员都可以看到课程列表
        // 注意：PrivCourse('admin') 已包含 super 权限的检查
        $course_list = [];
        if(IsAdmin() || PrivCourse('admin', $this->NOW_COURSE_KEY)) {
            $course_list = db('course')->where('defunct', 'C')->field('course_key, course_title')->order('course_key')->select();
        }
        $this->assign('course_list', $course_list);
        
        $this->assign('pagetitle', "班级管理");
        return $this->fetch();
    }
    
    public function GetClsPrivilege($user_id) {
        $this->InitController();
        // 使用 privilege_item 表查询（pvrole='teacher'）
        return db('privilege_item')->alias('pi')
            ->join('clss c', 'pi.item_id = c.clss_id', 'inner')
            ->where([
                'pi.user_id' => $user_id,
                'pi.rightitem' => 'clss',
                'pi.pvrole' => 'teacher'
            ])
            ->join('course_item ci_clss', "ci_clss.item_id = c.clss_id AND ci_clss.item = 'clss'", 'inner')
            ->where('ci_clss.course_id', $this->NOW_COURSE_ID)
            ->where(function($q) {
                $q->whereNull('ci_clss.pvrole')->whereOr('ci_clss.pvrole', '');
            })
            ->column('pi.item_id');
    }
    
    public function clss_list_ajax() {
        $this->InitController();
        // 使用 Trait 的统一方法（exadmin 模式：支持筛选和分页）
        $result = $this->GetClssListAjax('admin');
        return $this->success('ok', null, $result);
    }
    
    public function clss_del_ajax() {
        $this->InitController();
        
        $clss_id = input('clss_id/d');
        if(!$clss_id) {
            $this->error("班级ID不能为空");
        }
        
        // 权限检查：超级管理员和课程管理员拥有全部权限
        // 从 course_item 获取班级所属课程
        $clss_course_key = GetCourseKeyFromCourseItem('clss', $clss_id);
        if(!$clss_course_key) {
            $this->error("班级不存在或未绑定课程");
        }
        
        // 超级管理员或课程管理员都可以删除
        // 注意：PrivCourse('admin') 已包含 super 权限的检查
        if(!IsAdmin() && !PrivCourse('admin', $clss_course_key)) {
            $this->error("删除班级需要管理员权限");
        }
        
        // 检查 privilege_item 表中是否有这个 clss 的元素
        $pvrole_teacher = GetPvroleConfig('clss_teacher', 'teacher');
        $pvrole_student = GetPvroleConfig('clss_student', 'student');
        
        $privilege_count = db('privilege_item')->where([
            'rightitem' => 'clss',
            'item_id' => $clss_id
        ])->where('pvrole', 'in', [$pvrole_teacher, $pvrole_student])->count();
        
        // 检查 contest 表中是否有 clss_id 是这个班的记录
        $contest_count = db('contest')->where('clss_id', $clss_id)->count();
        
        $errors = [];
        if($privilege_count > 0) {
            $errors[] = "存在 {$privilege_count} 个关联的教师或学生";
        }
        if($contest_count > 0) {
            $errors[] = "存在 {$contest_count} 个关联的练习或考试";
        }
        
        if(!empty($errors)) {
            $this->error("无法删除班级，存在关联数据：" . implode("；", $errors));
        }
        
        db('clss')->where('clss_id', $clss_id)->update(['defunct' => 'Y']);
        $this->success('删除成功');
    }
    
    public function clss_modify_ajax() {
        $this->InitController();
        $clss_id = input('clss_id/d');
        if(!$clss_id) {
            $this->error("班级ID不能为空");
        }
        
        // 检查权限
        $clss_query = db('clss')->alias('c')
            ->where('c.clss_id', $clss_id);
        // 课程过滤：以 course_item(item='clss') 为准
        if ($this->NOW_COURSE_ID) {
            $clss_query->join('course_item ci_clss', "ci_clss.item_id = c.clss_id AND ci_clss.item = 'clss'", 'inner')
                ->where('ci_clss.course_id', $this->NOW_COURSE_ID)
                ->where(function($q) {
                    $q->whereNull('ci_clss.pvrole')->whereOr('ci_clss.pvrole', '');
                });
        }
        $clss = $clss_query->find();
        if(!$clss) {
            $this->error("班级不存在");
        }
        
        // 权限按班级所属课程判断（从 course_item 获取 course_key，避免依赖 clss.course_key）
        // 超级管理员和课程管理员拥有全部权限
        $clss_course_key = GetCourseKeyFromCourseItem('clss', $clss_id);
        if(!$clss_course_key) {
            $this->error("班级不存在或未绑定课程");
        }
        // 注意：PrivCourse('admin') 已包含 super 权限的检查
        if(!IsAdmin() && !PrivCourse('admin', $clss_course_key)) {
            $this->error("无管理该班级的权限");
        }
        
        // 获取提交的数据
        $clss_title = input('clss_title/s', '');
        $clss_year = input('clss_year/d', -1);
        $clss_semester = input('clss_semester/s', '');
        $teachers_str = input('teachers/s', '');
        
        // 验证数据
        if(strlen($clss_title) > 99 || strlen($clss_title) == 0) {
            $this->error("班级标题长度不正确");
        }
        
        if(!preg_match('/^\d{4}-\d{4}-\d$/', $clss_semester)) {
            $this->error("学期格式不正确");
        }
        
        // 解析教师列表
        $teachers_str = trim($teachers_str, ',');
        $teachers_array = [];
        if(!empty($teachers_str)) {
            $teachers_array = array_filter(array_map('trim', explode(',', $teachers_str)));
            if(count($teachers_array) > 100) {
                $this->error("教师数量过多（最多100个）");
            }
        }
        
        // 更新班级信息
        db('clss')->where('clss_id', $clss_id)->update([
            'clss_title' => $clss_title,
            'clss_year' => $clss_year,
            'clss_semester' => $clss_semester
        ]);
        
        // 更新教师关系
        $pvrole_teacher = GetPvroleConfig('clss_teacher', 'teacher');
        db('privilege_item')->where([
            'rightitem' => 'clss',
            'item_id' => $clss_id,
            'pvrole' => $pvrole_teacher
        ])->delete();
        
        if(!empty($teachers_array)) {
            $teacher_insert = [];
            foreach($teachers_array as $user_id) {
                $teacher_insert[] = [
                    'user_id' => $user_id,
                    'rightitem' => 'clss',
                    'item_id' => $clss_id,
                    'pvrole' => $pvrole_teacher,
                    'defunct' => '0'
                ];
            }
            db('privilege_item')->insertAll($teacher_insert);
        }
        
        // 返回更新后的数据
        $updated_query = db('clss')->alias('c')->where('c.clss_id', $clss_id);
        // clss 不再保留 course_key，统一通过 course_item(item='clss') -> course 联查
        $updated_query = $this->applyCourseItemFilterToClssQuery($updated_query, 'c');
        $updated_clss = $updated_query->field($this->clss_query_field)->find();
        
        // 获取教师列表
        $teachers = db('privilege_item')->where([
            'rightitem' => 'clss',
            'item_id' => $clss_id,
            'pvrole' => $pvrole_teacher
        ])->column('user_id');
        
        if(!empty($teachers)) {
            $updated_clss['teachers'] = ',' . implode(',', $teachers) . ',';
        } else {
            $updated_clss['teachers'] = ',';
        }
        
        $this->success('修改成功', null, $updated_clss);
    }
    
    public function clss_add() {
        $this->InitController();
        // 权限：批量添加/修改班级仅允许课程管理员或全局管理员
        // 教师（非课程管理员）禁止访问该页面
        // 超级管理员和课程管理员拥有全部权限
        // 注意：PrivCourse('admin') 已包含 super 权限的检查
        if(!IsAdmin() && !PrivCourse('admin', $this->NOW_COURSE_KEY)) {
            $this->error("批量添加/修改班级需要管理员权限");
        }
        return $this->fetch();
    }
    
    public function clss_batch_ajax() {
        $this->InitController();
        
        // 解析前端发送的 JSON 字符串
        $clss_list_json = input('clss_list/s');
        if(empty($clss_list_json)) {
            $this->error("班级数据不能为空");
        }
        
        $clss_list = json_decode($clss_list_json, true);
        if(!is_array($clss_list) || empty($clss_list)) {
            $this->error("班级数据格式不正确");
        }
        
        // 从第一条数据获取 course_key（所有数据应该使用相同的 course_key）
        $course_key = isset($clss_list[0]['course_key']) ? trim($clss_list[0]['course_key']) : '';
        if(empty($course_key)) {
            $this->error("课程组不能为空");
        }
        
        // 权限检查：验证对指定 course_key 的管理权限
        // 超级管理员和课程管理员拥有全部权限
        // 注意：PrivCourse('admin') 已包含 super 权限的检查
        if(!IsAdmin() && !PrivCourse('admin', $course_key)) {
            $this->error("无管理课程 [" . $course_key . "] 的班级的权限");
        }
        $course_id = db('course')->where('course_key', $course_key)->value('course_id');
        if(!$course_id) {
            $this->error("课程组不存在：" . $course_key);
        }
        
        $data_insert = [];
        $data_update = [];
        $update_id_list = [];
        $teachers_data = []; // 存储教师关系数据：['clss_id' => ['user_id1', 'user_id2', ...]]
        
        foreach($clss_list as $val) {
            // 验证数据格式
            if(!is_array($val)) {
                $this->error("班级数据格式不正确");
            }
            
            // 验证所有数据的 course_key 是否一致
            $item_course_key = isset($val['course_key']) ? trim($val['course_key']) : '';
            if($item_course_key !== $course_key) {
                $this->error("所有班级必须属于同一个课程组");
            }
            
            // 验证标题（兼容旧格式 title 和新格式 clss_title）
            $clss_title = isset($val['clss_title']) ? trim($val['clss_title']) : (isset($val['title']) ? trim($val['title']) : '');
            if(strlen($clss_title) > 99 || strlen($clss_title) == 0) {
                $this->error("存在班级标题长度不正确");
            }
            
            // 解析 teachers 字段（可能是逗号分隔的字符串，格式如：",user1,user2," 或 "user1,user2"）
            $teachers_str = isset($val['teachers']) ? trim($val['teachers'], ',') : '';
            $teachers_array = [];
            if(!empty($teachers_str)) {
                $teachers_array = array_filter(array_map('trim', explode(',', $teachers_str)));
                if(count($teachers_array) > 100) {
                    $this->error("教师数量过多（最多100个）");
                }
            }
            
            // 验证学期格式（兼容旧格式 semester 和新格式 clss_semester）
            $clss_semester = isset($val['clss_semester']) ? trim($val['clss_semester']) : (isset($val['semester']) ? trim($val['semester']) : '');
            if(!preg_match('/^\d{4}-\d{4}-\d$/', $clss_semester)) {
                $this->error("学期格式不正确");
            }
            
            // 获取年级（兼容旧格式 year 和新格式 clss_year）
            $clss_year = isset($val['clss_year']) ? $val['clss_year'] : (isset($val['year']) ? $val['year'] : '-1');
            
            $item = [
                'clss_title'        => $clss_title,
                'clss_year'         => $clss_year,
                'clss_semester'     => $clss_semester,
                'in_date'           => date('Y-m-d H:i:s'),
                'defunct'           => 'C',
            ];
            
            if(array_key_exists('clss_id', $val)) {
                $item['clss_id'] = intval($val['clss_id']);
                $update_id_list[] = $item['clss_id'];
                $data_update[] = $item;
                $teachers_data[$item['clss_id']] = $teachers_array;
            } else {
                $data_insert[] = $item;
                // 为新插入的班级暂存教师数据，稍后处理
                $teachers_data['_new_' . count($data_insert)] = $teachers_array;
            }
        }
        
        if(count($update_id_list) > 0) {
            $update_num = db('clss')->where('clss_id', 'in', $update_id_list)->count();
            if($update_num != count($update_id_list)) {
                $this->error("存在不正确或重复的班级ID");
            }
        }
        
        // 更新现有班级
        if(!empty($data_update)) {
            // ThinkPHP5.1 Query 有状态：insertAll/max/select 等独立操作不要复用同一个 Query 对象
            db('clss')->insertAll($data_update, true);
            // 确保 course_item(item='clss') 映射存在（兼容老数据/重复执行）
            if(!empty($update_id_list)) {
                $vals = [];
                foreach($update_id_list as $id) {
                    $vals[] = '(' . intval($course_id) . ",'clss'," . intval($id) . ",'' )";
                }
                if(!empty($vals)) {
                    \think\Db::execute("INSERT IGNORE INTO course_item (course_id,item,item_id,pvrole) VALUES " . implode(',', $vals));
                }
            }
            // 从配置获取 pvrole 值
            $pvrole_teacher = GetPvroleConfig('clss_teacher', 'teacher');
            
            // 更新教师关系：先删除旧的，再插入新的（使用 privilege_item 表，pvrole='teacher'）
            foreach($update_id_list as $clss_id) {
                db('privilege_item')->where([
                    'rightitem' => 'clss',
                    'item_id' => $clss_id,
                    'pvrole' => $pvrole_teacher
                ])->delete();
                if(!empty($teachers_data[$clss_id])) {
                    $teacher_insert = [];
                    foreach($teachers_data[$clss_id] as $user_id) {
                        $teacher_insert[] = [
                            'user_id' => $user_id,
                            'rightitem' => 'clss',
                            'item_id' => $clss_id,
                            'pvrole' => $pvrole_teacher,
                            'defunct' => '0'
                        ];
                    }
                    if(!empty($teacher_insert)) {
                        db('privilege_item')->insertAll($teacher_insert);
                    }
                }
            }
        }
        
        // 插入新班级
        $data_update_result = [];
        if(!empty($update_id_list)) {
            $q = db('clss')->alias('c')->where('c.clss_id', 'in', $update_id_list);
            $q->join('course_item ci_clss', "ci_clss.item_id = c.clss_id AND ci_clss.item = 'clss'", 'inner')
                ->where('ci_clss.course_id', intval($course_id))
                ->where(function($qq) {
                    $qq->whereNull('ci_clss.pvrole')->whereOr('ci_clss.pvrole', '');
                });
            $q->join('course crs', 'crs.course_id = ci_clss.course_id', 'left');
            $data_update_result = $q->field($this->clss_query_field)->select();
        }
        
        $last_id = db('clss')->max('clss_id');
        if(!empty($data_insert)) {
            db('clss')->insertAll($data_insert);
            
            // 获取新插入的班级ID（通过比较插入前后的最大ID）
            $new_max_id = db('clss')->max('clss_id');
            $new_ids = [];
            if($new_max_id > $last_id) {
                // 获取所有新插入的班级ID
                $new_clss_ids = db('clss')
                    ->where('clss_id', '>', $last_id)
                    ->where('clss_id', '<=', $new_max_id)
                    ->column('clss_id');
                $new_ids = array_map('intval', $new_clss_ids);
            }
            
            // 为新插入的班级立即添加 course_item 映射（参照题目导入的逻辑）
            if(!empty($new_ids)) {
                try {
                    $vals = [];
                    foreach($new_ids as $id) {
                        // 检查是否已存在（避免重复插入）
                        $courseItemExists = db('course_item')->where([
                            'course_id' => $course_id,
                            'item' => 'clss',
                            'item_id' => $id,
                        ])->where(function($q) {
                            $q->whereNull('pvrole')->whereOr('pvrole', '');
                        })->count();
                        
                        if ($courseItemExists == 0) {
                            $vals[] = '(' . intval($course_id) . ",'clss'," . intval($id) . ",'' )";
                        }
                    }
                    if(!empty($vals)) {
                        \think\Db::execute("INSERT IGNORE INTO course_item (course_id,item,item_id,pvrole) VALUES " . implode(',', $vals));
                    }
                } catch (\Throwable $e) {
                    // 忽略重复插入错误（可能由并发导致）
                }
            }
            
            // 插入 course_item 后，再查询新插入的班级（使用 course_item join）
            $new_clss_list = [];
            if(!empty($new_ids)) {
            $new_clss_list = db('clss')->alias('c')
                    ->where('c.clss_id', 'in', $new_ids)
                ->join('course_item ci_clss', "ci_clss.item_id = c.clss_id AND ci_clss.item = 'clss'", 'inner')
                ->where('ci_clss.course_id', intval($course_id))
                ->where(function($q) {
                    $q->whereNull('ci_clss.pvrole')->whereOr('ci_clss.pvrole', '');
                })
                ->join('course crs', 'crs.course_id = ci_clss.course_id', 'left')
                ->field($this->clss_query_field)->select();
            }
            
            // 从配置获取 pvrole 值
            $pvrole_teacher = GetPvroleConfig('clss_teacher', 'teacher');
            
            // 为新插入的班级添加教师关系（使用 privilege_item 表，pvrole='teacher'）
            $new_index = 0;
            foreach($new_clss_list as $new_clss) {
                $key = '_new_' . ($new_index + 1);
                if(isset($teachers_data[$key]) && !empty($teachers_data[$key])) {
                    $teacher_insert = [];
                    foreach($teachers_data[$key] as $user_id) {
                        $teacher_insert[] = [
                            'user_id' => $user_id,
                            'rightitem' => 'clss',
                            'item_id' => $new_clss['clss_id'],
                            'pvrole' => $pvrole_teacher,
                            'defunct' => '0'
                        ];
                    }
                    if(!empty($teacher_insert)) {
                        db('privilege_item')->insertAll($teacher_insert);
                    }
                }
                $new_index++;
            }
            
            $data_insert_result = $new_clss_list;
        } else {
            $data_insert_result = [];
        }
        
        // 为返回的数据添加 teachers 字段和兼容字段（兼容前端格式）
        foreach($data_update_result as &$clss) {
            $clss_id = $clss['clss_id'];
            if(isset($teachers_data[$clss_id]) && !empty($teachers_data[$clss_id])) {
                $clss['teachers'] = ',' . implode(',', $teachers_data[$clss_id]) . ',';
            } else {
                $clss['teachers'] = ',';
            }
        }
        
        foreach($data_insert_result as &$clss) {
            $clss_id = $clss['clss_id'];
            // 从配置获取 pvrole 值
            $pvrole_teacher = GetPvroleConfig('clss_teacher', 'teacher');
            
            // 从数据库重新查询教师列表（使用 privilege_item 表，pvrole='teacher'）
            $teachers = db('privilege_item')->where([
                'rightitem' => 'clss',
                'item_id' => $clss_id,
                'pvrole' => $pvrole_teacher
            ])->column('user_id');
            if(!empty($teachers)) {
                $clss['teachers'] = ',' . implode(',', $teachers) . ',';
            } else {
                $clss['teachers'] = ',';
            }
        }
        
        $this->success('ok', null, ['insert' => $data_insert_result, 'update' => $data_update_result]);
    }
}
