<?php
namespace app\common\traits;

/**
 * Clss 公共逻辑 Trait
 * 提取 exadmin 和 expsys 模块的班级管理公共逻辑
 */
trait ClssTrait
{
    /**
     * 初始化控制器（公共逻辑）
     */
    public function InitClssController()
    {
        $this->clss_query_field = [
            'c.clss_id',
            'c.clss_title',
            'c.clss_year',
            'c.clss_semester',
            'c.in_date',
            // clss 表不再保留 course_key；通过 course_item(item='clss') -> course 反查展示
            'crs.course_key course_key'
        ];
        $this->clss_default_map = []; // 课程过滤改由 course_item 联查实现
    }

    /**
     * 对 clss 查询应用当前课程过滤（基于 course_item 映射）
     * 兼容历史数据：course_item.pvrole 可能是 NULL 或空字符串
     */
    protected function applyCourseItemFilterToClssQuery($query, $clssAlias = 'c')
    {
        // 无课程上下文时也做 LEFT JOIN，以便展示 course_key / 支持按 course_key 筛选
        $has_course_ctx = (isset($this->NOW_COURSE_ID) && $this->NOW_COURSE_ID);
        $joinType = $has_course_ctx ? 'inner' : 'left';
        $query->join('course_item ci_clss', "ci_clss.item_id = {$clssAlias}.clss_id AND ci_clss.item = 'clss'", $joinType)
            ->where(function($q) {
                $q->whereNull('ci_clss.pvrole')->whereOr('ci_clss.pvrole', '');
            })
            ->join('course crs', 'crs.course_id = ci_clss.course_id', 'left');
        if ($has_course_ctx) {
            $query->where('ci_clss.course_id', $this->NOW_COURSE_ID);
        }
        return $query;
    }
    
    /**
     * 获取班级列表（带教师信息）
     * 通过 JOIN 查询 users 表获取教师的 name、school
     * 
     * @param array $map 额外的查询条件
     * @param bool $flg_self 是否只查询自己的班级（仅教师）
     * @return array 班级列表，每个班级包含 teachers 数组（结构化数据）
     */
    public function GetClssListWithTeachers($map = [], $flg_self = false)
    {
        $this->InitClssController();
        
        // 超级管理员和课程管理员拥有全部权限，不受 flg_self 限制
        // 注意：PrivCourse('admin') 已包含 super 权限的检查
        $is_admin_or_course_admin = false;
        if (IsLogin()) {
            $is_admin_or_course_admin = IsAdmin() || 
                                        (function_exists('PrivCourse') && PrivCourse('admin', $this->NOW_COURSE_KEY));
        }
        
        // 如果只查询自己的班级，使用 privilege_item 表（pvrole='teacher'）
        // 但超级管理员和课程管理员不受此限制
        if($flg_self && IsLogin() && !$is_admin_or_course_admin) {
            // 从配置获取 pvrole 值
            $pvrole_teacher = GetPvroleConfig('clss_teacher', 'teacher');
            
            $clss_ids = db('privilege_item')->where([
                'user_id' => session('user_id'),
                'rightitem' => 'clss',
                'pvrole' => $pvrole_teacher
            ])->column('item_id');
            if(empty($clss_ids)) {
                return [];
            }
            $map['clss_id'] = ['in', $clss_ids];
        }
        
        // 构建查询对象（课程过滤走 course_item）
        $query = db('clss')->alias('c')->where('c.defunct', 'C');
        $query = $this->applyCourseItemFilterToClssQuery($query, 'c');
        
        // 处理筛选条件：ThinkPHP 5.1 需要使用链式调用处理 like 查询
        foreach($map as $field => $condition) {
            if(is_array($condition) && count($condition) >= 2 && is_string($condition[0])) {
                // 数组格式：['like', '%value%'] 或 ['in', [1,2,3]]
                $op = strtolower($condition[0]);
                $value = $condition[1];
                // 若传入字段不带别名，默认作用于 clss 主表别名 c
                if (strpos($field, '.') === false) {
                    $field = 'c.' . $field;
                }
                $query->where($field, $op, $value);
            } else {
                // 普通条件
                if (strpos($field, '.') === false) {
                    $field = 'c.' . $field;
                }
                $query->where($field, $condition);
            }
        }
        
        // 查询班级列表（只查询未删除的班级）
        $ret = $query->field($this->clss_query_field)->select();
        
        if(empty($ret)) {
            return [];
        }
        
        // 提取班级ID列表
        $clss_ids = array_column($ret, 'clss_id');
        
        // 从配置获取 pvrole 值
        $pvrole_teacher = GetPvroleConfig('clss_teacher', 'teacher');
        
        // 批量获取所有班级的教师列表（通过 JOIN 查询 users 表获取详细信息）
        // 修复 ThinkPHP 5.1 IN 查询语法：使用链式调用
        $teachers_list = db('privilege_item')->alias('pi')
            ->join('users u', 'pi.user_id = u.user_id', 'left')
            ->join('clss c', 'pi.item_id = c.clss_id', 'inner')
            ->where([
                'pi.rightitem' => 'clss',
                'pi.pvrole' => $pvrole_teacher,
                'c.defunct' => 'C',
            ])
            // 课程过滤改由 course_item 联查实现（避免依赖 clss.course_key）
            ->join('course_item ci_clss', "ci_clss.item_id = c.clss_id AND ci_clss.item = 'clss'", 'inner')
            ->where('ci_clss.course_id', $this->NOW_COURSE_ID)
            ->where(function($q) {
                $q->whereNull('ci_clss.pvrole')->whereOr('ci_clss.pvrole', '');
            })
            ->where('pi.item_id', 'in', $clss_ids)
            ->field([
                'pi.item_id clss_id',
                'pi.user_id',
                'u.nick',
                'u.school'
            ])
            ->select();
        
        // 构建教师映射表
        $teachers_map = [];
        foreach($teachers_list as $teacher) {
            $clss_id = intval($teacher['clss_id']);
            if($clss_id <= 0) continue;
            
            if(!isset($teachers_map[$clss_id])) {
                $teachers_map[$clss_id] = [];
            }
            // 返回结构化数据：包含 user_id, nick, school
            $teachers_map[$clss_id][] = [
                'user_id' => $teacher['user_id'],
                'nick' => $teacher['nick'] ?: $teacher['user_id'],
                'school' => $teacher['school'] ?: ''
            ];
        }
        
        // 为每个班级添加 teachers 字段（结构化数据，用于 formatter）
        foreach($ret as &$clss) {
            $clss_id = $clss['clss_id'];
            if(isset($teachers_map[$clss_id]) && !empty($teachers_map[$clss_id])) {
                $clss['teachers'] = $teachers_map[$clss_id];
            } else {
                $clss['teachers'] = [];
            }
        }
        
        return $ret;
    }
    
    /**
     * 获取班级的教师列表（结构化数据）
     * 
     * @param array $clss_ids 班级ID数组
     * @return array 格式：['clss_id' => [['user_id' => 'xxx', 'nick' => 'xxx', 'school' => 'xxx'], ...], ...]
     */
    protected function GetClssTeachersMap($clss_ids)
    {
        if(empty($clss_ids)) {
            return [];
        }
        
        // 确保是纯整数数组
        $final_ids = [];
        foreach($clss_ids as $id) {
            $id_int = intval($id);
            if($id_int > 0) {
                $final_ids[] = $id_int;
            }
        }
        
        if(empty($final_ids)) {
            return [];
        }
        
        $final_ids = array_values(array_unique($final_ids));
        
        // 从配置获取 pvrole 值
        $pvrole_teacher = GetPvroleConfig('clss_teacher', 'teacher');
        
        // 联查 privilege_item 和 users 表，获取教师的详细信息
        $teachers_list = db('privilege_item')->alias('pi')
            ->join('users u', 'pi.user_id = u.user_id', 'left')
            ->join('clss c', 'pi.item_id = c.clss_id', 'inner')
            ->where([
                'pi.rightitem' => 'clss',
                'pi.pvrole' => $pvrole_teacher,
                'c.defunct' => 'C',
            ])
            ->join('course_item ci_clss', "ci_clss.item_id = c.clss_id AND ci_clss.item = 'clss'", 'inner')
            ->where('ci_clss.course_id', $this->NOW_COURSE_ID)
            ->where(function($q) {
                $q->whereNull('ci_clss.pvrole')->whereOr('ci_clss.pvrole', '');
            })
            ->where('pi.item_id', 'in', $final_ids)
            ->field([
                'pi.item_id clss_id',
                'pi.user_id',
                'u.nick',
                'u.school'
            ])
            ->select();
        
        $teachers_map = [];
        foreach($teachers_list as $teacher) {
            $clss_id = $teacher['clss_id'];
            if(!isset($teachers_map[$clss_id])) {
                $teachers_map[$clss_id] = [];
            }
            $teachers_map[$clss_id][] = [
                'user_id' => $teacher['user_id'],
                'nick' => $teacher['nick'] ?: $teacher['user_id'],
                'school' => $teacher['school'] ?: ''
            ];
        }
        
        return $teachers_map;
    }
    
    /**
     * 检查用户是否是班级教师
     * 
     * @param int|null $clss_id 班级ID
     * @param array|null $clss_item 班级信息（可选，用于减少查询）
     * @return bool
     */
    protected function IsClssTeacher($clss_id = null, $clss_item = null)
    {
        if(!IsLogin()) {
            return false;
        }
        
        $user_id = session('user_id');
        
        if($clss_id == null && $clss_item != null) {
            $clss_id = $clss_item['clss_id'];
        }
        
        if($clss_id == null) {
            return false;
        }
        
        // 检查是否是管理员
        if($clss_item == null) {
            $this->InitClssController();
            // 课程过滤改为 course_item，避免依赖 clss.course_key
            $q = db('clss')->alias('c')->where('c.clss_id', $clss_id)->cache(30);
            $q = $this->applyCourseItemFilterToClssQuery($q, 'c');
            $clss_item = $q->field(['crs.course_key course_key', 'c.clss_id'])->find();
        }
        if($clss_item && (IsAdmin() || PrivCourse('admin', $clss_item['course_key']))) {
            return true;
        }
        
        // 从配置获取 pvrole 值
        $pvrole_teacher = GetPvroleConfig('clss_teacher', 'teacher');
        
        // 使用 privilege_item 表查询（pvrole='teacher'）
        $teacher_count = db('privilege_item')->where([
            'rightitem' => 'clss',
            'item_id' => $clss_id,
            'user_id' => $user_id,
            'pvrole' => $pvrole_teacher
        ])->count();
        
        return $teacher_count > 0;
    }
    
    /**
     * 检查用户是否是班级学生
     * 
     * @param string $user_id 用户ID
     * @param int $clss_id 班级ID
     * @return bool
     */
    protected function IsUserClssStu($user_id, $clss_id)
    {
        // 从配置获取 pvrole 值，如果配置不存在则使用默认值
        $pvrole_student = GetPvroleConfig('clss_student', 'student');
        
        // 使用 privilege_item 表查询（pvrole='student' 表示学生）
        return db('privilege_item')->where([
            'user_id' => $user_id,
            'rightitem' => 'clss',
            'item_id' => $clss_id,
            'pvrole' => $pvrole_student
        ])->find() !== null;
    }
    
    /**
     * 解析班级筛选参数
     * 
     * @return array 筛选条件数组
     */
    protected function ParseClssFilterParams()
    {
        $map = [];
        
        // 筛选参数处理
        $clss_id = input('clss_id/d', 0);
        if ($clss_id !== null && intval($clss_id) > 0) {
            $map['clss_id'] = intval($clss_id);
        }
        
        $clss_title = input('clss_title/s');
        if ($clss_title !== null && $clss_title !== '') {
            $map['clss_title'] = ['like', '%' . $clss_title . '%'];
        }
        
        // 统一字段名：clss_year / clss_semester
        $clss_year = input('clss_year/d', 0);
        if ($clss_year !== null && intval($clss_year) > 0) {
            $map['clss_year'] = intval($clss_year);
        }
        
        $clss_semester = input('clss_semester/s', '');
        if ($clss_semester !== null && $clss_semester !== '') {
            $map['clss_semester'] = $clss_semester;
        }
        
        /**
         * 教师筛选（工号 / 昵称），逗号分隔，OR 逻辑
         * - 输入支持：user_id 或 nick（同一个输入框）
         * - 逗号分隔多个 token：token1,token2 => (teacher=user_id OR teacher=nick) OR ...
         */
        $teacher = trim(strval(input('teacher/s', '')));
        if ($teacher !== '') {
            $tokens = array_filter(array_map(function($x) {
                return trim(strtolower($x));
            }, explode(',', $teacher)));
            $tokens = array_values(array_unique($tokens));

            if (!empty($tokens)) {
                // 映射 token -> user_id（支持直接输入 user_id 或 nick）
                $teacher_user_ids = [];
                // 直接把 token 当作 user_id 候选
                foreach ($tokens as $t) {
                    if ($t !== '') $teacher_user_ids[$t] = true;
                }
                // nick 精确匹配映射
                $users = db('users')->where(function($q) use ($tokens) {
                    $q->where('user_id', 'in', $tokens)
                      ->whereOr('nick', 'in', $tokens);
                })->field(['user_id'])->select();
                foreach ($users as $u) {
                    if (!empty($u['user_id'])) {
                        $teacher_user_ids[strval($u['user_id'])] = true;
                    }
                }

                $teacher_user_ids = array_keys($teacher_user_ids);

                if (!empty($teacher_user_ids)) {
                    $pvrole_teacher = GetPvroleConfig('clss_teacher', 'teacher');
                    $teacher_clss_ids = db('privilege_item')->where([
                        'rightitem' => 'clss',
                        'pvrole' => $pvrole_teacher,
                        'defunct' => '0'
                    ])->where('user_id', 'in', $teacher_user_ids)->column('item_id');

                    $teacher_clss_ids = array_values(array_unique(array_map('intval', $teacher_clss_ids ?: [])));

                    // 将教师筛选落到 clss_id IN (...)，并与已有 clss_id 筛选做交集
                    if (!empty($teacher_clss_ids)) {
                        if (isset($map['clss_id']) && is_numeric($map['clss_id'])) {
                            $cid = intval($map['clss_id']);
                            $map['clss_id'] = in_array($cid, $teacher_clss_ids) ? $cid : ['in', [0]];
                        } else {
                            $map['clss_id'] = ['in', $teacher_clss_ids];
                        }
                    } else {
                        // 有教师筛选但没有匹配到任何班级 => 返回空
                        $map['clss_id'] = ['in', [0]];
                    }
                } else {
                    $map['clss_id'] = ['in', [0]];
                }
            }
        }

        $course_key = input('course_key/s');
        if ($course_key !== null && $course_key !== '' && $course_key !== '-1') {
            // clss 表不再保留 course_key：将 course_key 映射为 course_id，作用于 course_item 联查
            $course_id = db('course')->where('course_key', $course_key)->value('course_id');
            if ($course_id) {
                $map['ci_clss.course_id'] = intval($course_id);
            } else {
                // 课程不存在：直接返回空
                $map['clss_id'] = ['in', [0]];
            }
        }
        
        return $map;
    }
    
    /**
     * 获取用户关联的班级列表（expsys 模式：作为教师或学生）
     * 
     * @return array 班级列表，每个班级包含 teachers 数组（结构化数据）
     */
    protected function GetUserRelatedClss()
    {
        $this->InitClssController();
        
        if(!IsLogin()) {
            return [];
        }
        
        $user_id = session('user_id');
        
        // 一次性查询用户关联的班级信息（包括教师和学生）
        $clss_list_data = db('privilege_item')->alias('pi')
            ->join('clss c', 'pi.item_id = c.clss_id', 'inner')
            ->where([
                'pi.user_id' => $user_id,
                'pi.rightitem' => 'clss',
                'pi.defunct' => '0',
                'c.defunct' => 'C'
            ])
            ->join('course_item ci_clss', "ci_clss.item_id = c.clss_id AND ci_clss.item = 'clss'", 'inner')
            ->where('ci_clss.course_id', $this->NOW_COURSE_ID)
            ->where(function($q) {
                $q->whereNull('ci_clss.pvrole')->whereOr('ci_clss.pvrole', '');
            })
            ->join('course crs', 'crs.course_id = ci_clss.course_id', 'left')
            ->field([
                'c.clss_id',
                'c.clss_title',
                'c.clss_year',
                'c.clss_semester',
                'c.in_date',
                'crs.course_key course_key'
            ])
            // 去重（一个用户可能同时是教师和学生）；避免 only_full_group_by 下 GROUP BY 报错
            ->distinct(true)
            ->select();
        
        if(empty($clss_list_data)) {
            return [];
        }
        
        // 提取班级ID列表用于查询教师
        $clss_ids = array_column($clss_list_data, 'clss_id');
        $clss_ids = array_unique(array_map('intval', $clss_ids));
        
        // 使用 Trait 的公共方法批量获取教师列表（结构化数据）
        $teachers_map = $this->GetClssTeachersMap($clss_ids);
        
        // 为每个班级添加 teachers 字段（结构化数据，用于 formatter）
        foreach($clss_list_data as &$clss) {
            $clss_id = $clss['clss_id'];
            if(isset($teachers_map[$clss_id]) && !empty($teachers_map[$clss_id])) {
                $clss['teachers'] = $teachers_map[$clss_id];
            } else {
                $clss['teachers'] = [];
            }
        }
        
        return $clss_list_data;
    }
    
    /**
     * 统一的班级列表查询方法（支持 exadmin 和 expsys 两种模式）
     * 
     * @param string $mode 模式：'admin' (exadmin模式，支持筛选和分页) 或 'user' (expsys模式，返回用户关联的班级)
     * @return array|mixed 返回数据格式：服务器端分页返回 {total, rows}，客户端分页或 user 模式返回数组
     */
    protected function GetClssListAjax($mode = 'admin')
    {
        $this->InitController();
        
        // expsys 模式：返回用户关联的班级
        if($mode === 'user') {
            return $this->GetUserRelatedClss();
        }
        
        // exadmin 模式：支持筛选和分页
        $map = $this->ParseClssFilterParams();
        $flg_self = input('flg_self/d');
        
        // 获取排序参数（bootstrap-table 在 queryParamsType='limit' 模式下发送 sort 和 order）
        $sort = input('sort/s');
        $order = input('order/s', 'asc');
        
        // Bootstrap Table 服务器端分页需要返回 {total: 总数, rows: 数据数组}
        // 客户端分页直接返回数组
        $limit = input('limit/d');
        $offset = input('offset/d');
        
        // 先获取总数（在筛选条件下，但不包含教师关联查询）
        $total_query = db('clss')->alias('c')->where($this->clss_default_map)->where('c.defunct', 'C');
        $total_query = $this->applyCourseItemFilterToClssQuery($total_query, 'c');
        
        // 处理筛选条件：ThinkPHP 5.1 需要使用链式调用处理 like 查询
        foreach($map as $field => $condition) {
            if(is_array($condition) && count($condition) >= 2 && is_string($condition[0])) {
                // 数组格式：['like', '%value%'] 或 ['in', [1,2,3]]
                $op = strtolower($condition[0]);
                $value = $condition[1];
                if (strpos($field, '.') === false) {
                    $field = 'c.' . $field;
                }
                $total_query->where($field, $op, $value);
            } else {
                // 普通条件
                if (strpos($field, '.') === false) {
                    $field = 'c.' . $field;
                }
                $total_query->where($field, $condition);
            }
        }
        
        // 超级管理员和课程管理员拥有全部权限，不受 flg_self 限制
        // 注意：PrivCourse('admin') 已包含 super 权限的检查
        $is_admin_or_course_admin = false;
        if (IsLogin()) {
            $is_admin_or_course_admin = IsAdmin() || 
                                        (function_exists('PrivCourse') && PrivCourse('admin', $this->NOW_COURSE_KEY));
        }
        
        if ($flg_self == 1 && IsLogin() && !$is_admin_or_course_admin) {
            // 非管理员用户：只查询自己的班级（通过 privilege_item 表）
            $pvrole_teacher = GetPvroleConfig('clss_teacher', 'teacher');
            $clss_ids = db('privilege_item')->where([
                'user_id' => session('user_id'),
                'rightitem' => 'clss',
                'pvrole' => $pvrole_teacher
            ])->column('item_id');
            if (!empty($clss_ids)) {
                $total_query->where('clss_id', 'in', $clss_ids);
            } else {
                // 如果没有自己的班级，总数为0
                if ($limit !== null && $offset !== null) {
                    return [
                        'total' => 0,
                        'rows' => []
                    ];
                } else {
                    return [];
                }
            }
        }
        
        // 使用 Trait 的公共方法获取班级列表（带教师信息）
        $ret = $this->GetClssListWithTeachers($map, $flg_self == 1);
        
        // 应用排序
        if (!empty($sort) && !empty($ret)) {
            // 验证排序字段是否合法（防止 SQL 注入）
            $allowed_sort_fields = ['clss_id', 'clss_title', 'clss_year', 'clss_semester', 'in_date'];
            if (in_array($sort, $allowed_sort_fields)) {
                $order = strtolower($order);
                if ($order !== 'asc' && $order !== 'desc') {
                    $order = 'asc';
                }
                
                // 对数组进行排序
                usort($ret, function($a, $b) use ($sort, $order) {
                    $val_a = isset($a[$sort]) ? $a[$sort] : null;
                    $val_b = isset($b[$sort]) ? $b[$sort] : null;
                    
                    // 处理 null 值
                    if ($val_a === null && $val_b === null) return 0;
                    if ($val_a === null) return $order === 'asc' ? -1 : 1;
                    if ($val_b === null) return $order === 'asc' ? 1 : -1;
                    
                    // 数值比较
                    if (is_numeric($val_a) && is_numeric($val_b)) {
                        $result = $val_a <=> $val_b;
                    } else {
                        // 字符串比较
                        $result = strcmp((string)$val_a, (string)$val_b);
                    }
                    
                    return $order === 'asc' ? $result : -$result;
                });
            }
        }
        
        if ($limit !== null && $offset !== null) {
            // 服务器端分页模式
            // 避免 course_item 重复映射导致计数偏大
            $total = $total_query->distinct(true)->count('c.clss_id');
            
            // 获取分页数据（排序已在上面完成，这里只需要分页）
            $ret = array_slice($ret, $offset, $limit);
            
            return [
                'total' => $total,
                'rows' => $ret
            ];
        } else {
            // 客户端分页，直接返回数组
            return $ret;
        }
    }
}

