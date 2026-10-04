<?php
namespace app\exadmin\controller;

/**
 * exadmin Course 控制器
 * 课程组管理（仅练习模式 online-exp 使用）
 */
class Course extends Exadminbase
{
    var $query_field;
    var $default_map;
    var $course;
    
    public function InitController() {
        if($this->OJ_STATUS != 'exp') {
            $this->error("OJ在该模式无此功能", '/');
        }
        $course_key = input('key/s');
        if($course_key) {
            if(!PrivCourse('teacher', $course_key)) {
                $this->error("无访问权限", '/');
            }
            $this->course = $this->GetCourse($course_key);
            if(!$this->course) {
                $this->error("无此课程组", '/');
            }
        }
    }
    
    public function index() {
        $this->InitController();
        $this->assign('pagetitle', '课程组管理');
        return $this->fetch();
    }
    
    public function course_add() {
        $this->InitController();
        // 获取默认配置（注意：config() 第二参是“写入值”，这里必须只读）
        $courseDefaultConfig = $this->getCourseDefaultConfig();
        $defaultConfig = $courseDefaultConfig['config'];
        
        $this->assign([
            'edit_mode' => false,
            'COURSE_ENV_CONFIG' => $defaultConfig, // 传递默认配置给视图
            'courseDefaultConfig' => $courseDefaultConfig
        ]);
        return $this->fetch('course_edit');
    }
    
    public function course_list_ajax() {
        $this->InitController();
        $course_list = db('course')->field(['course_description', 'course_config'], true)->select();
        foreach($course_list as &$course) {
            $course['edit'] = PrivCourse('admin', $course['course_key']);
            $course['privilege'] = PrivCourse('teacher', $course['course_key']);
            // 兼容附件体系：course 没有 attach 字段，这里约定 attach = course_key
            $course['attach'] = $course['course_key'];
        }
        return $course_list;
    }
    
    public function course_edit() {
        $this->InitController();
        if(!PrivCourse('admin', $this->course['course_key'])) {
            $this->error("无编辑权限", '/');
        }
        $course = $this->course;
        $courseDefaultConfig = $this->getCourseDefaultConfig();
        $defaultConfig = $courseDefaultConfig['config'];

        // 获取当前课程的配置（用于交互式界面）
        $currentConfig = $this->MakeCourseConfig($this->course['course_key'], $this->course['course_config']);
        if (!$currentConfig) {
            // 如果没有配置，使用默认配置
            $currentConfig = $defaultConfig;
        }
        // 将配置保存为 JSON 字符串（用于前端 textarea，不需要再次 json_encode）
        $course['course_config_json'] = json_encode($currentConfig, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
        
        // 将修改后的副本传递给 assign 方法
        $this->assign([
            'edit_mode' => true,
            'course'    => $course,
            'COURSE_ENV_CONFIG' => $defaultConfig, // 传递默认配置给视图
            'courseDefaultConfig' => $courseDefaultConfig
        ]);
        return $this->fetch('course_edit');
    }
    
    public function course_edit_ajax() {
        $this->InitController();
        if($this->course && !PrivCourse('admin', $this->course['course_key'])) {
            $this->error("无编辑权限");
        }
        $course_new = [
            'course_title'          => input('course_title/s'),
            'course_description'    => input('course_description/s'),
            'course_unit'           => input('course_unit/s'),
        ];

        // 统一规范 course_key（新增/修改都允许提交）
        $submitted_course_key = strtoupper(trim(input('course_key/s', '')));
        
        // 处理课程配置（支持新的交互式配置界面）
        $course_config_submit = input('course_config/s', '');
        $modeKey = 'status_' . $this->OJ_MODE . '_' . $this->OJ_STATUS;
        // 生成配置版本号（年月日时分秒），并确保同一秒内重复保存也会变化
        $cfgVer = date('YmdHis');
        if (empty($course_config_submit)) {
            // 如果没有提交配置，尝试从 JSON 格式获取
            $course_config_json = input('post.course_config_json', '');
            if (!empty($course_config_json)) {
                $course_config_data = json_decode($course_config_json, true);
                if (json_last_error() === JSON_ERROR_NONE && is_array($course_config_data)) {
                    // 配置更新时间版本（年月日时分秒）
                    $course_config_data['__cfg_version'] = $cfgVer;
                    $course_config = [
                        $modeKey => $course_config_data
                    ];
                } else {
                    $this->error('配置数据格式错误：' . json_last_error_msg());
                }
            } else {
                // 使用默认配置
                $defaultConfig = $this->getCourseDefaultConfig()['config'];
                // 配置更新时间版本（年月日时分秒）
                $defaultConfig['__cfg_version'] = $cfgVer;
                $course_config = [
                    $modeKey => $defaultConfig
                ];
            }
        } else {
            $cfg = json_decode($course_config_submit, true);
            if (!is_array($cfg)) $cfg = [];
            // 配置更新时间版本（年月日时分秒）
            $cfg['__cfg_version'] = $cfgVer;
            $course_config = [$modeKey => $cfg];
        }
        if($this->course) {
            $old_course_key = $this->course['course_key'];
            $new_course_key = $submitted_course_key ?: $old_course_key;
            if(!$new_course_key) {
                $this->error('课程缩写不能为空');
            }

            // 仅当变更 course_key 时才做目录迁移与缓存清理；该分支统一显式 JSON 返回，避免出现“200 但空 body”
            try {
                // 允许修改 course_key：检查重名（排除自己）
                if($new_course_key !== $old_course_key) {
                    // 注意：ThinkPHP Query 对象是有状态的，不要复用同一个实例以免 where 条件串联导致 update 命中 0 行
                    $dup = db('course')->where('course_key', $new_course_key)
                        ->where('course_id', '<>', $this->course['course_id'])
                        ->field('course_id')
                        ->find();
                    if($dup) {
                        $this->error("已存在缩写为[{$new_course_key}]的课程");
                    }

                    // 先处理附件目录迁移：/upload/course_attach/OLD -> /upload/course_attach/NEW
                    $ojPath = config('OjPath.');
                    // 这些配置项在系统中是确定存在的，不做“兼容式”判断
                    $baseDir = $ojPath['PUBLIC'] . $ojPath['course_ATTACH'];
                    $oldDir = rtrim($baseDir, '/') . '/' . $old_course_key;
                    $newDir = rtrim($baseDir, '/') . '/' . $new_course_key;
                    // 挪动前先检查是否已存在目标目录名，存在则先删除再改名
                    if(file_exists($newDir)) {
                        if(DelWhatever($newDir) === false) {
                            $this->error("删除已存在的目标附件目录失败：{$new_course_key}");
                        }
                    }

                    // oldDir 不存在则创建 newDir；存在则 rename
                    if(file_exists($oldDir)) {
                        if(!@rename($oldDir, $newDir)) {
                            $this->error("附件目录重命名失败：{$old_course_key} -> {$new_course_key}");
                        }
                    } else {
                        if(!MakeDirs($newDir)) {
                            $this->error("创建附件目录失败：{$new_course_key}");
                        }
                    }
                }

                // 文件系统处理成功后，再修改数据库（如数据库失败，需要回滚文件系统）
                \think\Db::startTrans();
                $this->course = array_replace($this->course, $course_new);
                $this->course['course_key'] = $new_course_key;
            } catch (\Throwable $e) {
                $this->error('修改 course_key 失败：'.$e->getMessage());
            }
            $pre_course_config = [];
            try {
                if (is_string($this->course['course_config'])) {
                    $pre_course_config = json_decode($this->course['course_config'], true);
                } else if (is_array($this->course['course_config'])) {
                    $pre_course_config = $this->course['course_config'];
                }
            } catch (\Exception $e) {
                $pre_course_config = [];
            }
            // 确保 __cfg_version 同一秒重复保存也会变化：如旧值==新值，则 +1 秒（仍保持 YYYYMMDDHHMMSS 格式）
            $oldVer = '';
            if (isset($pre_course_config[$modeKey]) && is_array($pre_course_config[$modeKey]) && isset($pre_course_config[$modeKey]['__cfg_version'])) {
                $oldVer = strval($pre_course_config[$modeKey]['__cfg_version']);
            }
            if ($oldVer === $cfgVer) {
                $cfgVer = date('YmdHis', time() + 1);
                // 回写到将要保存的配置块
                if (isset($course_config[$modeKey]) && is_array($course_config[$modeKey])) {
                    $course_config[$modeKey]['__cfg_version'] = $cfgVer;
                }
            }

            $pre_course_config = array_merge($pre_course_config, $course_config);
            foreach ($this->COURSE_ENV_CONFIG as $key => $val) {
                // 清理旧版本内容：删除在第一级的配置key
                unset($pre_course_config[$key]);
            }
            $this->course['course_config'] = json_encode($pre_course_config);   // php 存 mysql json 需要encode

            try {
                // 使用明确的 where 更新，且只更新必要字段，避免 update(整行) 导致不可控行为
                $updateData = [
                    'course_key'         => $this->course['course_key'],
                    'course_title'       => $this->course['course_title'],
                    'course_description' => $this->course['course_description'],
                    'course_unit'        => $this->course['course_unit'],
                    'course_config'      => $this->course['course_config'],
                ];
                // 注意：不要复用之前做过 where/find 的 Query 实例
                $affected = db('course')->where('course_id', $this->course['course_id'])->update($updateData);

                // ThinkPHP 5.1：update() 返回影响行数，0 表示未更新（无变化或 where 未命中），false 表示失败
                // 这里如果“确实改了 course_key”但返回 0，属于异常情况，必须视为失败（否则会出现“成功但 DB 未改”）
                if ($affected === false || ($new_course_key !== $old_course_key && $affected === 0)) {
                    throw new \RuntimeException('DB update not applied (affected=' . var_export($affected, true) . ')');
                }

                // 再查一次确认数据库中的 course_key 已更新（防止出现 200 但实际没改的情况）
                $dbCourse = db('course')->where('course_id', $this->course['course_id'])->field(['course_key'])->find();
                $dbCourseKey = $dbCourse ? ($dbCourse['course_key'] ?? '') : '';
                if ($dbCourseKey !== $new_course_key) {
                    throw new \RuntimeException("DB verify failed: course_key={$dbCourseKey}, expected={$new_course_key}");
                }

                \think\Db::commit();
            } catch (\Throwable $e) {
                \think\Db::rollback();
                // 数据库失败：尽量回滚附件目录（NEW -> OLD）
                if(isset($new_course_key) && isset($old_course_key) && $new_course_key !== $old_course_key) {
                    $ojPath = config('OjPath.');
                    // 这些配置项在系统中是确定存在的，不做“兼容式”判断
                    $baseDir = $ojPath['PUBLIC'] . $ojPath['course_ATTACH'];
                    $oldDir = rtrim($baseDir, '/') . '/' . $old_course_key;
                    $newDir = rtrim($baseDir, '/') . '/' . $new_course_key;
                    if(file_exists($newDir) && !file_exists($oldDir)) {
                        @rename($newDir, $oldDir);
                    }
                }
                $this->error('更新数据库失败：'.$e->getMessage());
            }

            // 更新缓存：删除旧 key，写入新 key
            if(isset($old_course_key) && isset($new_course_key) && $old_course_key !== $new_course_key) {
                cache('course_now_' . $old_course_key, null);
                \think\facade\Cache::rm('course_info_' . $old_course_key . '_active');
                \think\facade\Cache::rm('course_info_' . $old_course_key . '_all');
            }
            cache('course_now_' . $new_course_key, [
                'course_title'  => $this->course['course_title'],
                'course_config' => json_decode($this->course['course_config'], true), // 将 JSON 字段转换为 PHP 数组
            ]);  // 更新全局配置cache
            \think\facade\Cache::rm('course_info_' . $new_course_key . '_active');
            \think\facade\Cache::rm('course_info_' . $new_course_key . '_all');

            // 返回成功（并且此处已通过 DB 二次校验，确保返回值与数据库一致）
            $this->success('updated', '', [
                'course_key' => $new_course_key,
                'course_key_changed' => ($new_course_key !== $old_course_key)
            ]);
        } else {
            $course_new['course_config'] = json_encode($course_config);
        }
        if(!IsAdmin()) {
            $this->error("无添加课程权限");
        }
        $course_new['course_key'] = $submitted_course_key;
        $course_new['defunct'] = 1;
        if(!$course_new['course_key']) {
            $this->error("课程缩写不能为空");
        }
        if(db('course')->where('course_key', $course_new['course_key'])->field('course_id')->find()) {
            $this->error("已存在缩写为[" . $course_new['course_key'] . "]的课程");
        }
        try {
            db('course')->insert($course_new);
            // 返回成功
            $this->success('added', '', ['course_key' => $course_new['course_key']]);
        } catch (\think\exception\PDOException $e) {
            $this->error('插入数据库出错' . $e->getMessage());
        }
    }
    
    /**
     * 获取课程默认配置（统一方法，确保数据格式正确）
     * @return array
     */
    protected function getCourseDefaultConfig() {
        // 注意：ThinkPHP 5.1 的 config() 第二参是“写入值”，这里必须只读
        // 这里必须用 “配置分组” 读取方式：CourseDefaultConfig.
        // 参考同项目里 JudgeDefaultConfig 的读取方式：config('JudgeDefaultConfig.')
        $cfg = config('CourseDefaultConfig.');
        if (!is_array($cfg)) {
            $cfg = [];
        }

        // 统一补齐结构（避免前端拿到空 definitions 导致无法渲染）
        $cfg['config'] = (isset($cfg['config']) && is_array($cfg['config'])) ? $cfg['config'] : [];
        $cfg['definitions'] = (isset($cfg['definitions']) && is_array($cfg['definitions'])) ? $cfg['definitions'] : [];
        $cfg['definitions']['fields'] = (isset($cfg['definitions']['fields']) && is_array($cfg['definitions']['fields']))
            ? $cfg['definitions']['fields']
            : [];

        return $cfg;
    }
    
    /**
     * 获取课程默认配置（AJAX接口）
     */
    public function get_default_config_ajax() {
        $this->InitController();
        if($this->course && !PrivCourse('admin', $this->course['course_key'])) {
            $this->error('权限不足');
        }
        
        // 获取默认配置
        $defaultConfig = $this->getCourseDefaultConfig()['config'];
        $this->success('获取默认配置成功', '', $defaultConfig);
    }
    
    /**
     * 更新课程配置
     */
    public function update_course_config_ajax() {
        $this->InitController();
        if(!$this->course || !PrivCourse('admin', $this->course['course_key'])) {
            $this->error('权限不足');
        }
        
        // 获取JSON字符串
        $jsonString = input('post.course_config');
        
        if (empty($jsonString)) {
            $this->error('没有接收到配置数据');
        }
        
        // 解析JSON字符串
        $configData = json_decode($jsonString, true);
        
        if (json_last_error() !== JSON_ERROR_NONE) {
            $this->error('配置数据格式错误：' . json_last_error_msg());
        }
        
        if (!is_array($configData)) {
            $this->error('配置数据必须是对象格式');
        }

        // 配置更新时间版本（年月日时分秒），用于确保每次保存都会产生变更
        // 同一秒内重复保存：如与当前库中版本相同，则 +1 秒（仍保持 YYYYMMDDHHMMSS 格式）
        $cfgVer = date('YmdHis');
        try {
            $modeKey = 'status_' . $this->OJ_MODE . '_' . $this->OJ_STATUS;
            $pre_course_config = [];
            if (is_string($this->course['course_config'])) {
                $pre_course_config = json_decode($this->course['course_config'], true);
            } else if (is_array($this->course['course_config'])) {
                $pre_course_config = $this->course['course_config'];
            }
            $oldVer = '';
            if (isset($pre_course_config[$modeKey]) && is_array($pre_course_config[$modeKey]) && isset($pre_course_config[$modeKey]['__cfg_version'])) {
                $oldVer = strval($pre_course_config[$modeKey]['__cfg_version']);
            }
            if ($oldVer === $cfgVer) {
                $cfgVer = date('YmdHis', time() + 1);
            }
        } catch (\Throwable $e) {
            // ignore
        }
        $configData['__cfg_version'] = $cfgVer;
        
        // 验证配置数据
        $courseDefaultConfig = $this->getCourseDefaultConfig();
        $defaultConfig = $courseDefaultConfig['config'];
        $definitions = $courseDefaultConfig['definitions']['fields'];
        
        // 验证所有必需字段
        foreach ($definitions as $key => $field) {
            if (!isset($configData[$key])) {
                $this->error("缺少必需字段：{$key}");
            }
            
            // 验证字段类型和范围
            if ($field['type'] === 'switch') {
                if (!is_bool($configData[$key])) {
                    $this->error("字段 {$key} 必须是布尔值");
                }
            } elseif ($field['type'] === 'number') {
                if (!is_numeric($configData[$key])) {
                    $this->error("字段 {$key} 必须是数字");
                }
                $value = floatval($configData[$key]);

                // 兼容：PLAGIARISM_SCORE 允许前端/导入传 0~100（视为百分比，需除以 100）
                if ($key === 'PLAGIARISM_SCORE' && $value > 1) {
                    $value = $value / 100.0;
                    $configData[$key] = $value;
                }
                if (isset($field['min']) && $value < $field['min']) {
                    $this->error("字段 {$key} 不能小于 {$field['min']}");
                }
                if (isset($field['max']) && $value > $field['max']) {
                    $this->error("字段 {$key} 不能大于 {$field['max']}");
                }
            }
        }
        
        // 更新课程配置
        $Course = db('course');
        $pre_course_config = [];
        try {
            if (is_string($this->course['course_config'])) {
                $pre_course_config = json_decode($this->course['course_config'], true);
            } else if (is_array($this->course['course_config'])) {
                $pre_course_config = $this->course['course_config'];
            }
        } catch (\Exception $e) {
            $pre_course_config = [];
        }
        
        $course_config = [
            'status_' . $this->OJ_MODE . '_' . $this->OJ_STATUS => $configData
        ];
        $pre_course_config = array_merge($pre_course_config, $course_config);
        
        // 清理旧版本内容
        foreach ($this->COURSE_ENV_CONFIG as $key => $val) {
            unset($pre_course_config[$key]);
        }
        
        $this->course['course_config'] = json_encode($pre_course_config);
        $Course->update($this->course);
        
        // 更新缓存
        cache('course_now_' . $this->course['course_key'], [
            'course_title'  => $this->course['course_title'],
            'course_config' => json_decode($this->course['course_config'], true),
        ]);
        
        $this->success('配置保存成功', '', $configData);
    }
    
    protected function GetCourse($key, $flg='key') {
        return db('course')->where('course_' . $flg, $key)->find();
    }
    
    public function course_privilege_list_ajax() {
        $this->InitController();
        // 从 privilege_item 表查询 course 权限
        $privilege_list = db('privilege_item')->alias('pi')
            ->where([
                'pi.rightitem' => 'course',
                'pi.item_id' => $this->course['course_id']
            ])
            ->join('users u', 'u.user_id = pi.user_id', 'left')
            ->field([
                'pi.user_id as user_id',
                'pi.privilege_item_id as privilege_id',
                'pi.pvrole as pvrole',
                'u.nick as nick',
                'u.school as school'
            ])
            ->select();
        
        return $privilege_list;
    }
    
    public function course_privilege() {
        $this->InitController();
        $priv_list = [
            'admin'     => '[普通管理员] 可维护课程各信息',
            'teacher'   => '[教师] 仅可管理本班练习'
        ];
        if(IsAdmin()) {
            $priv_list['super'] = '[超级管理员] 可增减管理权限';
        }
        
        // 前端交互权限：
        // - course_admin：只能增删 teacher（不允许改 admin/super）
        // - course_super / 全局管理员：可管理 admin（以及在全局管理员下可管理 super）
        // 注意：PrivCourse('admin') 已包含 super 权限的检查
        $course_key = $this->course['course_key'];
        $can_manage_teacher = PrivCourse('admin', $course_key) || IsAdmin();
        $can_manage_admin = PrivCourse('super', $course_key) || IsAdmin();  // 管理 admin 需要 super 权限
        $can_manage_super = IsAdmin();
        
        // 前端“可选权限列表”只下发允许操作的项（避免 course_admin 误选 admin/super）
        $priv_list_ui = [];
        if($can_manage_teacher) {
            $priv_list_ui['teacher'] = $priv_list['teacher'];
        }
        if($can_manage_admin) {
            $priv_list_ui['admin'] = $priv_list['admin'];
        }
        if($can_manage_super && isset($priv_list['super'])) {
            $priv_list_ui['super'] = $priv_list['super'];
        }
        $this->assign([
            'course'    => $this->course,
            'priv_list' => $priv_list,
            'priv_list_ui' => $priv_list_ui,
            'can_manage_teacher' => $can_manage_teacher,
            'can_manage_admin' => $can_manage_admin,
            'can_manage_super' => $can_manage_super,
        ]);
        return $this->fetch();
    }
    
    public function course_privilege_add_ajax() {
        $this->InitController();
        // 权限策略：
        // - 课程管理员（admin）：可为本课程增删“teacher”
        // - 课程超管（super）或全局管理员：可增删“admin”（以及在全局管理员允许下管理 super）
        // - “super” 权限仅全局管理员可操作（避免课程内提权）
        $PrivilegeItem = db('privilege_item');
        $privilege_new = input('privilege/a');
        $user_id = input('user_id/s');
        if($user_id != "") {
            $user_id = trim($user_id);
        }

        if(!is_array($privilege_new) || empty($privilege_new)) {
            $this->error("未提交权限数据");
        }
        $privilege_new = array_values(array_unique(array_map('strval', $privilege_new)));

        $course_key = $this->course['course_key'];
        $is_global_admin = IsAdmin();
        $is_course_super = PrivCourse('super', $course_key);
        $is_course_admin = PrivCourse('admin', $course_key);

        $only_teacher = (count($privilege_new) === 1 && $privilege_new[0] === 'teacher');
        if($only_teacher) {
            if(!$is_global_admin && !$is_course_super && !$is_course_admin) {
                $this->error("无权限为课程添加教师");
            }
        } else {
            // 包含 admin/super：需要课程超管或全局管理员
            if(!$is_global_admin && !$is_course_super) {
                $this->error("无权限进行权限管理");
            }
        }
        if(in_array('super', $privilege_new, true) && !$is_global_admin) {
            $this->error("存在不允许的权限");
        }
        $privilege_insert = [];
        foreach($privilege_new as &$val) {
            if(!in_array($val, ['super', 'admin', 'teacher'])) {
                $this->error("存在不允许的权限");
            }
            if($val == 'super' && !IsAdmin()) {
                $this->error("存在不允许的权限");
            }
            // 检查是否已存在相同的权限
            $existing = $PrivilegeItem->where([
                'user_id' => $user_id,
                'rightitem' => 'course',
                'item_id' => $this->course['course_id'],
                'pvrole' => $val,
                'defunct' => '0'
            ])->find();
            if($existing) {
                continue;  // 已存在，跳过
            }
            $privilege_insert[] = [
                'user_id'   => $user_id,
                'rightitem' => 'course',
                'item_id'   => $this->course['course_id'],
                'pvrole'    => $val,
                'defunct'   => '0'
            ];
        }
        if(empty($privilege_insert)) {
            $this->error("所有权限已存在");
        }
        $PrivilegeItem->insertAll($privilege_insert);
        $this->success("新增权限成功");
    }
    
    public function course_privilege_del_ajax() {
        $this->InitController();
        $user_id = input('user_id/s');
        $pvrole = input('pvrole/s');
        if(!in_array($pvrole, ['super', 'admin', 'teacher'])) {
            $this->error("提交内容不正确");
        }
        $course_key = $this->course['course_key'];
        $is_global_admin = IsAdmin();
        $is_course_super = PrivCourse('super', $course_key);
        $is_course_admin = PrivCourse('admin', $course_key);

        if($pvrole === 'teacher') {
            // 删除 teacher：课程管理员/课程超管/全局管理员均可
            if(!$is_global_admin && !$is_course_super && !$is_course_admin) {
                $this->error("无权限删除教师权限");
            }
        } else {
            // 删除 admin/super：需要课程超管或全局管理员
            if(!$is_global_admin && !$is_course_super) {
                $this->error("无权限进行权限管理");
            }
        }
        if(!$is_global_admin && $pvrole === 'super'){
            $this->error("无删除超管权限");
        }
        // 从 privilege_item 表删除
        db('privilege_item')->where([
            'user_id'   => $user_id,
            'rightitem' => 'course',
            'item_id'   => $this->course['course_id'],
            'pvrole'    => $pvrole
        ])->delete();
        $this->success("ok");
    }
    
    public function course_del_ajax() {
        $this->InitController();
        if(!IsAdmin('super_admin')) {
            $this->error("No permission to delete course");
        }
        $course_id = input('course_id/d');
        db('course')->where('course_id', $course_id)->delete();
        $this->success();
    }
}

