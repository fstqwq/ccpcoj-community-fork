<?php
/**
 * 资源权限 / 课程权限相关函数
 *
 * 作用：
 * - 基于 `privilege_item` / `course_item` / `course` 等表进行权限判断
 * - 统一权限相关 session 命名空间（priv.*），便于 Logout 时清理
 * - course_key → course_id 转换及缓存
 *
 * 依赖：
 * - ThinkPHP：`db()`, `config()`, `session()`, `\think\facade\Cache`
 * - funcs 依赖：IsLogin（来自 `auth.php`）、GetPvroleConfig（来自 `auth.php`）
 *
 * 约束：
 * - 仅允许函数定义；禁止文件顶层执行任何逻辑。
 * - 由 `ojweb/application/common.php` 统一 require_once 引入。
 * - 注意加载顺序：本文件在运行时会调用 IsLogin/GetPvroleConfig，需保证 `auth.php` 已加载或调用发生在加载之后。
 *   当前做法：由 common.php 先加载 privilege，再加载 auth；由于这里都是函数体调用，运行期调用时 auth 已加载（可接受）。
 *
 * 导出函数：
 * - GetPrivCacheKey
 * - PrivItem
 * - PrivSession
 * - PrivCourse
 * - CourseReUrl
 * - CourseTeacherClssCheck, CourseTeacherContestCheck
 * - GetCourseKeyFromCourseItem, GetItemCourseKey
 * - AddPrivilege
 */

/**
 * 统一生成权限相关的缓存 key
 * 自动处理 user_id 的获取和验证，避免不同用户之间的缓存冲突
 * 
 * @param string $type 缓存类型：'is_admin', 'priv_item', 'priv_course'
 * @param array $params 参数数组，根据类型不同包含不同的参数
 *   - 'is_admin': ['item' => string, 'id' => int|null]
 *   - 'priv_item': ['item' => string, 'id' => int, 'pvrole' => string]
 *   - 'priv_course': ['priv' => string, 'key' => string]
 * @return string|false 返回缓存 key，如果 user_id 不存在则返回 false
 */
function GetPrivCacheKey($type, $params = []) {
    // 检查是否登录
    if(!IsLogin()) {
        // debug_priv=1 时记录一次原因（不依赖 app_debug 开关）
        try {
            if(isset($_REQUEST['debug_priv']) && intval($_REQUEST['debug_priv']) === 1) {
                \think\facade\Log::info('[CSGOJ_DEBUG][priv_cache_key] ' . json_encode([
                    'stage' => 'not_login',
                    'type' => strval($type),
                    'params' => $params,
                ], JSON_UNESCAPED_UNICODE));
            }
        } catch (\Throwable $e) {}
        return false;
    }
    
    // 获取 user_id
    $user_id = session('user_id');
    if(empty($user_id)) {
        return false;
    }
    
    // 根据类型生成不同的 cache key
    switch($type) {
        case 'is_admin':
            $item = isset($params['item']) ? $params['item'] : 'administrator';
            $id = isset($params['id']) ? $params['id'] : null;
            return 'is_admin_' . $user_id . '_' . $item . '_' . ($id !== null ? $id : '');
            
        case 'priv_item':
            $item = isset($params['item']) ? $params['item'] : '';
            $id = isset($params['id']) ? $params['id'] : '';
            $pvrole = isset($params['pvrole']) ? $params['pvrole'] : 'admin';
            return 'priv_item_' . $user_id . '_' . $item . '_' . $id . '_' . $pvrole;
            
        case 'priv_course':
            $priv = isset($params['priv']) ? $params['priv'] : 'admin';
            $key = isset($params['key']) ? $params['key'] : '';
            return 'priv_course_' . $user_id . '_' . $priv . '_' . $key;
            
        default:
            return false;
    }
}

/**
 * 将 pvrole 入参归一化为“去重后的字符串数组”（并排序），用于 IN 查询与缓存 key
 * @param string|array|null $pvrole
 * @param array $default 当 pvrole 为空时使用
 * @return array
 */
function CsgPrivNormalizePvroles($pvrole, $default = ['admin']) {
    $roles = [];
    if (is_array($pvrole)) {
        $roles = $pvrole;
    } else if ($pvrole === null) {
        $roles = [];
    } else {
        $roles = [strval($pvrole)];
    }
    $roles = array_values(array_filter(array_map(function($v) {
        $v = trim(strval($v));
        return $v === '' ? null : $v;
    }, $roles), function($v) { return $v !== null; }));
    if (empty($roles)) {
        $roles = $default;
    }
    $roles = array_values(array_unique($roles));
    sort($roles);
    return $roles;
}

/**
 * 课程权限层级展开（用于“至少拥有 X 权限”的判断）：
 * - super 覆盖一切（无论检查什么，都应当允许 super）
 * - admin 覆盖 teacher（检查 teacher 时，admin/super 也应返回 true）
 *
 * 规则：
 * - 总是把 'super' 加入候选集合（保证“任意参数时 super 都为 true”）
 * - 若检查 'teacher'：候选集合加入 ['teacher','admin']（再加 super）
 * - 若检查 'admin'：候选集合加入 ['admin']（再加 super）
 * - 若检查 'super'：候选集合加入 ['super']
 * - 其它未知 pvrole：保留原值（但仍会被 super 覆盖）
 *
 * @param array $requested_roles 已归一化/去重/排序的 pvrole 列表
 * @return array 归一化后的候选 pvrole 列表（已去重/排序）
 */
function CsgPrivExpandCourseRoles($requested_roles) {
    $req = CsgPrivNormalizePvroles($requested_roles, []);
    $expanded = $req;
    // super 覆盖一切
    $expanded[] = 'super';
    // admin 覆盖 teacher：当检查 teacher 时，应当允许 admin/super
    if (in_array('teacher', $req, true)) {
        $expanded[] = 'admin';
        $expanded[] = 'teacher';
    }
    // 当检查 admin 时，应当允许 super（已加入），这里保留 admin
    if (in_array('admin', $req, true)) {
        $expanded[] = 'admin';
    }
    // 当检查 super 时，仅 super（已加入）
    if (in_array('super', $req, true)) {
        $expanded[] = 'super';
    }
    $expanded = array_values(array_unique(array_map('strval', $expanded)));
    sort($expanded);
    return $expanded;
}

/**
 * 兼容 privilege_item.defunct 的历史取值：
 * - 新库通常用 '0'/'1'
 * - 旧库可能用 'N'/'Y' 或空字符串
 * 这里统一认为：['0','N','',NULL] 为“有效”，其它为无效
 * @param \think\db\Query $q
 * @param string $field
 * @return \think\db\Query
 */
function CsgPrivWhereActiveDefunct($q, $field = 'defunct') {
    if(!$q) return $q;
    try {
        // 避免 ThinkPHP 5.1 “闭包 where + cache(true)” 无法生成缓存 key 的问题：
        // 这里使用 whereRaw 实现等价逻辑（defunct IS NULL 或 in ('0','N','')）。
        $f = strval($field);
        // 仅允许安全字段名（含别名形态 a.b）
        if(!preg_match('/^[a-zA-Z0-9_\\.]+$/', $f)) {
            return $q;
        }
        $q->whereRaw("(" . $f . " IS NULL OR " . $f . " IN ('0','N',''))");
    } catch (\Throwable $e) {
        // ignore
    }
    return $q;
}

/**
 * 权限 debug 开关（仅 app_debug=true 且显式带 debug_priv=1 时开启）
 */
function CsgPrivDebugEnabled() {
    // 优先用超稳的全局变量（避免某些阶段 helper 未加载导致 input() 不可用）
    try {
        if(isset($_REQUEST) && isset($_REQUEST['debug_priv'])) {
            return intval($_REQUEST['debug_priv']) === 1;
        }
        if(isset($_GET) && isset($_GET['debug_priv'])) {
            return intval($_GET['debug_priv']) === 1;
        }
    } catch (\Throwable $e) {
        // ignore
    }
    // 兜底：用 ThinkPHP input()
    try {
        if(function_exists('input')) {
            return intval(input('debug_priv/d', 0)) === 1;
        }
    } catch (\Throwable $e) {
        // ignore
    }
    return false;
}

/**
 * 权限 debug 打点（仅 debug_priv=1 时生效，不依赖 app_debug）
 */
function CsgPrivDebugLog($tag, $payload = []) {
    if(!CsgPrivDebugEnabled()) return;
    try {
        \think\facade\Log::info('[CSGOJ_DEBUG][' . $tag . '] ' . json_encode($payload, JSON_UNESCAPED_UNICODE));
    } catch (\Throwable $e) {
        // ignore
    }
}

/**
 * 基于 privilege_item 表检查资源权限
 * @param string $item 资源类型（problem、contest、news、course、clss 等）
 * @param int $id 资源ID
 * @param string|array $pvrole 权限角色，默认 'admin'。可以是字符串或数组（使用 IN 查询）
 * @return bool
 */
function PrivItem($item, $id, $pvrole='admin') {
    if(!IsLogin()) {
        return false;
    }

    $item = trim(strtolower(strval($item)));
    $id = intval($id);

    // 支持的资源类型
    $supported_items = ['news', 'problem', 'contest', 'course', 'clss'];
    if(!in_array($item, $supported_items, true)) {
        $cache_key = GetPrivCacheKey('priv_item', ['item' => $item, 'id' => $id, 'pvrole' => '']);
        if($cache_key !== false) {
            PrivSession($cache_key, false);
        }
        return false;
    }

    // pvrole 归一化（缓存 key 使用“最终候选集合”的 canonical key，避免同义请求产生多份缓存）
    $pvroles = CsgPrivNormalizePvroles($pvrole, ['admin']);
    if ($item === 'course') {
        $pvroles = CsgPrivExpandCourseRoles($pvroles);
    }
    $pvrole_key = implode(',', $pvroles);

    $cache_key = GetPrivCacheKey('priv_item', ['item' => $item, 'id' => $id, 'pvrole' => $pvrole_key]);
    if($cache_key === false) {
        return false;
    }
    
    // 检查缓存
    // 注意：当开启 debug_priv=1 时，为了避免“命中旧缓存导致看不到打点/看不到最新 DB 状态”，这里绕过 Session 缓存
    if(PrivSession('?' . $cache_key) && !CsgPrivDebugEnabled()) {
        return PrivSession($cache_key);
    }
    if(PrivSession('?' . $cache_key) && CsgPrivDebugEnabled()) {
        CsgPrivDebugLog('priv_item', [
            'stage' => 'cache_bypass',
            'cache_key' => $cache_key,
            'cached' => PrivSession($cache_key),
            'item' => $item,
            'item_id' => $id,
            'pvroles' => $pvroles,
        ]);
    }
    
    $user_id = session('user_id');
    
    // 先检查是否是全局管理员（不缓存这个结果，因为 IsAdmin 有自己的缓存）
    if(IsAdmin()) {
        $result = true;
        PrivSession($cache_key, $result);
        return $result;
    }

    if(CsgPrivDebugEnabled()) {
        CsgPrivDebugLog('priv_item', [
            'stage' => 'query_begin',
            'user_id' => strval($user_id),
            'item' => $item,
            'item_id' => $id,
            'pvroles' => $pvroles,
            'cache_key' => $cache_key,
        ]);
    }

    // 单次查询：pvrole IN (...)，并且 defunct 兼容旧值
    // 注意：不要用 Query::cache(true, ttl) / cache(ttl) 这种“自动 key”缓存，遇到闭包 where 会炸：
    // closure not support cache(true)。要么显式 key，要么用 Cache facade 自己存 bool。
    // 参考：ThinkPHP 5.1 文档 cache(10) 等同于 cache(true, 10)（自动 key）。
    // - https://doc.thinkphp.cn/v5_1/cache.html
    // - https://doc.thinkphp.cn/v5_1/huancun.html
    $cache_time = intval(config('CsgojConfig.OJ_PRIVILEGE_CACHE_TIME'));
    if($cache_time < 0) $cache_time = 0;
    // 鉴权缓存没必要太久，避免权限变更后长时间不生效；默认上限 10 秒
    if($cache_time > 10) $cache_time = 10;
    $q = db('privilege_item')->where([
        'user_id' => $user_id,
        'rightitem' => $item,
        'item_id' => $id,
    ]);
    // defunct 兼容：0/N/空/NULL 视为有效
    $q = CsgPrivWhereActiveDefunct($q, 'defunct');
    if (count($pvroles) === 1) {
        $q->where('pvrole', $pvroles[0]);
    } else {
        $q->where('pvrole', 'in', $pvroles);
    }
    // 用 Cache facade 做短期缓存（显式 key，缓存 bool），避免 Query::cache 自动 key 触发闭包序列化异常
    $cacheFacadeKey = 'csgoj:priv_item:' . $cache_key;
    if($cache_time > 0) {
        try {
            $cached = \think\facade\Cache::get($cacheFacadeKey, null);
            if($cached !== null) {
                $result = (intval($cached) === 1);
                if(CsgPrivDebugEnabled()) {
                    CsgPrivDebugLog('priv_item', [
                        'stage' => 'cache_hit_facade',
                        'cache_key' => $cacheFacadeKey,
                        'result' => $result,
                    ]);
                }
                // 写入 Session 缓存，保持原有行为一致（非 debug 模式下下次直接命中 PrivSession）
                PrivSession($cache_key, $result);
                return $result;
            }
        } catch (\Throwable $e) {
            // ignore cache exceptions
        }
    }

    $item_privilege = $q->find();
    $result = $item_privilege ? true : false;
    if($cache_time > 0) {
        try {
            \think\facade\Cache::set($cacheFacadeKey, ($result ? 1 : 0), $cache_time);
        } catch (\Throwable $e) {
            // ignore
        }
    }

    if(CsgPrivDebugEnabled()) {
        CsgPrivDebugLog('priv_item', [
            'stage' => 'query_end',
            'user_id' => strval($user_id),
            'item' => $item,
            'item_id' => $id,
            'pvroles' => $pvroles,
            'hit' => $result,
            'row' => $item_privilege ?: null,
            'cache_key' => $cache_key,
        ]);
    }
    
    // 缓存结果
    PrivSession($cache_key, $result);
    return $result;
}

/**
 * 权限相关的 Session 操作函数
 * 支持 session 的所有功能，但统一存储在 priv 命名空间下，便于 LogoutOper 清空
 * 
 * @param string $key Session 键名
 * @param mixed $val 值，-1 表示读取，null 表示删除，其他值表示设置
 * @return mixed
 * 
 * 使用示例：
 * PrivSession('cache_key', 'value')  // 设置
 * PrivSession('cache_key')          // 读取
 * PrivSession('cache_key', null)     // 删除
 * PrivSession('?cache_key')          // 检查是否存在（返回 bool）
 */
function PrivSession($key, $val=-1) {
    // 支持 "?" 查询（检查是否存在）
    if(is_string($key) && strlen($key) > 0 && $key[0] === '?') {
        $real_key = 'priv.' . substr($key, 1);
        return session('?' . $real_key);
    }
    // 确保 priv 命名空间存在
    if(!session('?priv')) {
        session('priv', []);
    }
    
    $real_key = 'priv.' . $key;
    
    // 读取操作（$val === -1 表示默认读取）
    if($val === -1) {
        return session('?' . $real_key) ? session($real_key) : null;
    }
    
    // 删除操作
    if($val === null) {
        session($real_key, null);
        return null;
    }
    
    // 设置操作
    session($real_key, $val);
    return $val;
}

function PrivCourse($priv='admin', $key=null) {
   
    if($key === null) {
        $key = session('?now_course_key') ? session('now_course_key') : null;
    }
    if($key === null || $key === 'DEFAULT' || $key === '') {
        if(CsgPrivDebugEnabled()) {
            CsgPrivDebugLog('priv_course', [
                'stage' => 'invalid_key',
                'priv' => strval($priv),
                'key' => $key,
                'now_course_key' => session('?now_course_key') ? session('now_course_key') : null,
            ]);
        }
        return false;
    }
    // 生成缓存 key（自动处理 user_id 验证）
    $cache_key = GetPrivCacheKey('priv_course', ['priv' => $priv, 'key' => $key]);
    if($cache_key === false) {
        return false;
    }
    // debug_priv=1 时绕过 session 缓存，避免旧缓存掩盖真实权限/打点缺失
    if(PrivSession('?' . $cache_key) && !CsgPrivDebugEnabled()) {
        return PrivSession($cache_key);
    }
    if(PrivSession('?' . $cache_key) && CsgPrivDebugEnabled()) {
        CsgPrivDebugLog('priv_course', [
            'stage' => 'cache_bypass',
            'cache_key' => $cache_key,
            'cached' => PrivSession($cache_key),
            'priv' => strval($priv),
            'key' => strval($key),
        ]);
    }
    
    // 将 course_key 转换为 course_id（PrivItem 需要 course_id，不是 course_key）
    // 使用缓存避免重复查询
    // 管理员查询时不加 defunct=0 条件，可以查询到所有课程（包括已禁用的）
    $is_admin = IsAdmin();
    $course_id_cache_key = 'course_id_' . $key . ($is_admin ? '_admin' : '');
    $course_id = \think\facade\Cache::remember($course_id_cache_key, function() use ($key, $is_admin) {
        $where = ['course_key' => $key];
        // 管理员查询时不加 defunct=0 条件
        if(!$is_admin) {
            $where['defunct'] = 0;
        }
        $course = db('course')->where($where)->field('course_id')->find();
        if(CsgPrivDebugEnabled()) {
            CsgPrivDebugLog('priv_course_course_id_query', [
                'key' => $key,
                'is_admin' => $is_admin,
                'where' => $where,
                'found' => $course ? true : false,
                'course_id' => $course ? $course['course_id'] : null,
            ]);
        }
        return $course ? $course['course_id'] : null;
    }, 300); // 缓存5分钟
    
    if($course_id === null) {
        // 非管理员：课程不存在或已禁用，缓存 false 结果
        if(CsgPrivDebugEnabled()) {
            CsgPrivDebugLog('priv_course', [
                'stage' => 'course_id_not_found',
                'priv' => strval($priv),
                'key' => $key,
                'course_id_cache_key' => $course_id_cache_key,
            ]);
        }
        PrivSession($cache_key, false);
        return false;
    }
    
    // 说明：
    // - course 权限层级：super > admin > teacher
    // - super 覆盖一切：即使 $priv 是空/未知字符串，也应返回 true（若用户对该课程是 super）
    // 这里把“空/未知”视为“仅做 super 覆盖 + 精确匹配”，具体展开规则由 PrivItem(course) 统一处理
    $priv_norm = $priv;
    if($priv === null) $priv_norm = '';
    $result = PrivItem('course', $course_id, $priv_norm);
    PrivSession($cache_key, $result);
    if(CsgPrivDebugEnabled()) {
        CsgPrivDebugLog('priv_course', [
            'stage' => 'done',
            'priv' => strval($priv),
            'key' => $key,
            'course_id' => $course_id,
            'result' => $result,
            'cache_key' => $cache_key,
        ]);
    }
    return $result;
}

function CourseReUrl($course_key, $cur_url) {    
    // 解析 URL 并获取参数
    $urlComponents = parse_url($cur_url);
    $queryParams = [];
    if(array_key_exists('query', $urlComponents)) {
        parse_str($urlComponents['query'], $queryParams);
    }
    $queryParams['now_course_key'] = $course_key;
    $newQuery = http_build_query($queryParams);
    return $urlComponents['path'] . '?' . $newQuery;
}

function CourseTeacherClssCheck($item, $user_id=null) {
    if(!$user_id) {
        $user_id = session('user_id');
    }
    if(!$user_id) {
        return false;
    }
    
    // 通过 clss_id 查询 privilege_item 表
    if(!isset($item['clss_id']) || !$item['clss_id']) {
        return false;
    }
    
    // 从配置获取 pvrole 值
    $pvrole_teacher = GetPvroleConfig('clss_teacher', 'teacher');
    
    // 使用 privilege_item 表查询（pvrole='teacher'）
    $cache_time = intval(config('CsgojConfig.OJ_PRIVILEGE_CACHE_TIME'));
    if($cache_time < 0) $cache_time = 0;
    if($cache_time > 10) $cache_time = 10;
    $q = db('privilege_item')->where([
        'rightitem' => 'clss',
        'item_id' => $item['clss_id'],
        'user_id' => $user_id,
        'pvrole' => $pvrole_teacher,
    ]);
    $q = CsgPrivWhereActiveDefunct($q, 'defunct');
    // 同 PrivItem：使用 Cache facade 显式 key（缓存 count，避免 Query::cache 自动 key）
    $ck = 'csgoj:priv_clss_teacher:' . strval($user_id) . ':' . strval($item['clss_id']) . ':' . strval($pvrole_teacher);
    if($cache_time > 0) {
        try {
            $cachedCnt = \think\facade\Cache::get($ck, null);
            if($cachedCnt !== null) {
                return intval($cachedCnt) > 0;
            }
        } catch (\Throwable $e) {}
    }
    $teacher_count = $q->count();
    if($cache_time > 0) {
        try {
            \think\facade\Cache::set($ck, intval($teacher_count), $cache_time);
        } catch (\Throwable $e) {}
    }
    
    return $teacher_count > 0;
}

function CourseTeacherContestCheck($item, $user_id=null) {
    // contest 数据可能包含 clss_id，使用 CourseTeacherClssCheck 检查
    return CourseTeacherClssCheck($item, $user_id);
}

/**
 * 从 course_item 表获取资源的 course_key
 * @param string $itemType 资源类型（'contest', 'problem', 'news', 'ex_question'）
 * @param int $itemId 资源ID
 * @return string|null 返回 course_key，如果不存在则返回 null
 */
function GetCourseKeyFromCourseItem($itemType, $itemId) {
    $courseItem = db('course_item')->alias('ci')
        ->join('course c', 'ci.course_id = c.course_id', 'inner')
        ->where([
            'ci.item' => $itemType,
            'ci.item_id' => $itemId,
        ])
        // 兼容历史数据：pvrole 可能是 NULL 或空字符串
        ->where(function($q) {
            $q->whereNull('ci.pvrole')->whereOr('ci.pvrole', '');
        })
        ->field('c.course_key')
        ->cache('course_item_course_key_' . $itemType . '_' . $itemId, 60)
        ->find();
    return $courseItem ? $courseItem['course_key'] : null;
}

/**
 * 获取资源的 course_key（优先从 course_item 表，兼容旧数据）
 * @param array $item 资源项（包含 contest_id、problem_id、news_id、ex_question_id 等字段）
 * @param string $itemType 资源类型（'contest', 'problem', 'news', 'ex_question'）
 * @return string|null 返回 course_key，如果不存在则返回 null
 */
function GetItemCourseKey($item, $itemType = '') {    
    // 推断 itemType 和 itemId
    if(empty($itemType)) {
        if(isset($item['contest_id'])) {
            $itemType = 'contest';
            $itemId = $item['contest_id'];
        } else if(isset($item['problem_id'])) {
            $itemType = 'problem';
            $itemId = $item['problem_id'];
        } else if(isset($item['news_id'])) {
            $itemType = 'news';
            $itemId = $item['news_id'];
        } else if(isset($item['ex_question_id'])) {
            $itemType = 'ex_question';
            $itemId = $item['ex_question_id'];
        } else {
            return null;
        }
    } else {
        $idFieldMap = [
            'contest' => 'contest_id',
            'problem' => 'problem_id',
            'news' => 'news_id',
            'ex_question' => 'ex_question_id'
        ];
        if(!isset($idFieldMap[$itemType]) || !isset($item[$idFieldMap[$itemType]])) {
            return null;
        }
        $itemId = $item[$idFieldMap[$itemType]];
    }
    
    // 从 course_item 表获取 course_key
    return GetCourseKeyFromCourseItem($itemType, $itemId);
}

/**
 * 添加资源权限到 privilege_item 表
 * 统一管理权限添加逻辑，供所有模块复用
 * 
 * @param int|string $user_id 用户ID
 * @param string $item 资源类型（'problem', 'contest', 'news', 'course', 'clss'）
 * @param int $id 资源ID
 * @param bool $checkPrivilege 是否检查当前用户是否有权限添加（默认 true）
 *    - true: 严格模式，检查 PrivItem 权限后再添加（适用于已有资源）
 *    - false: 宽松模式，直接添加不检查（适用于新创建的资源，如 exp 模式下刚创建的题目）
 * @param string $pvrole 权限角色，默认 'admin'
 * @return bool 成功返回 true，失败返回 false
 * 
 * @throws \Exception 如果资源类型不支持或权限检查失败
 */
function AddPrivilege($user_id, $item, $id, $checkPrivilege = true, $pvrole = 'admin') {
    // 检查是否登录
    if(!IsLogin()) {
        return false;
    }
    
    // 全局管理员不需要添加单个条目权限（如果当前用户是全局管理员）
    if($user_id == session('user_id') && IsAdmin('administrator')){
        return true; // 返回 true 表示"已拥有权限"，不需要添加
    }
    
    // 支持的资源类型
    $supported_items = ['problem', 'contest', 'news', 'course', 'clss'];
    $item = trim(strtolower(strval($item)));
    if(!in_array($item, $supported_items, true)) {
        throw new \Exception("Unsupported item type: " . $item);
    }
    
    $id = intval($id);
    if($id <= 0) {
        return false;
    }
    
    // 严格模式：检查当前用户是否有权限添加
    if($checkPrivilege) {
        // 检查当前用户是否有该资源的权限（用于验证是否有权限给他人添加权限）
        if(!PrivItem($item, $id, 'admin')) {
            throw new \Exception("You don't have privilege of " . $item . " (id: " . $id . ")");
        }
    }
    
    // 插入到 privilege_item 表
    $PrivilegeItem = db('privilege_item');
    $map = [
        'user_id' => $user_id,
        'rightitem' => $item,
        'item_id' => $id,
        'pvrole' => $pvrole,
        'defunct' => '0'  // 新添加的权限统一设置为有效
    ];
    
    // 检查是否已存在
    $privilege = $PrivilegeItem->where($map)->find();
    if($privilege == null) {
        $PrivilegeItem->insert($map);
    }
    
    return true;
}


