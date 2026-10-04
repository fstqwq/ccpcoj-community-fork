<?php
use think\Controller;
use think\facade\Cache;

class Globalbasecontroller extends Controller
{
    var $OJ_MODE;
    var $OJ_STATUS;
    var $OJ_OPEN_OI;
    var $OJ_OPEN_ARCHIVE;
    var $OJ_NAME;
    var $OJ_SSO;
    var $OJ_SCLIENT_ID;
    var $ICP_RECORD;
    var $GA_CODE;
    var $BA_CODE;
    var $GIT_DISCUSSION;
    var $OJ_MODE_ALLOW_MODULE;
    var $OJ_SESSION_PREFIX;
    var $OJ_ADMIN;
    // for exp sys mode - 课程管理相关变量（仅在 OJ_STATUS == 'exp' 时使用）
    var $COURSE_ENV_CONFIG;     // env 默认配置
    var $NOW_COURSE_KEY;        // 当前课程组（course_key）
    var $NOW_COURSE_ID;         // 当前课程ID（course_id）
    var $OJ_COURSE_NOW;         // 当前课程信息
    var $COURSE_CACHE;          // 课程完整信息缓存（避免重复查询数据库）
    var $ALLOW_WA_INFO;
    var $ALLOW_TEST_DOWNLOAD;
    var $PLAGIARISM_SCORE;      // 被查重后得分比例
    var $PLAGIARISM_MIN_LEN;    // 最低查重代码长度
    var $PLAGIARISM_THRESHOLD;  // 查重扣分相似度阈值
    var $EXP_LEVEL_SCORE;       // 实验分层扣分
    var $OJ_TEST_DOWNLOAD_WAIT_TIME;
    var $isCourseAdmin = false;
    /** @var bool|null 来自 .env：null=未配置沿用系统默认，false=关闭自助注册，true=显式允许 */
    var $FLG_ALLOW_REGISTER;
    /** @var bool|null 来自 .env：null=未配置沿用系统默认，false=关闭网页登录（含 SSO 建立会话） */
    var $FLG_ALLOW_LOGIN;
    //////////
    var $module;
    var $action;
    var $controller;
    var $isAdmin = false;

    public function initialize()
    {
        $this->OJMode();
        $this->InitController();
    }
    
    /**
     * 检查用户初始化状态
     * 如果用户表为空，且当前访问的不是初始化页面，则跳转到初始化页面
     */
    protected function getInstallLockPath() {
        // 更标准的安装锁：写入 runtime 目录，作为“系统已初始化”的唯一标记
        // 这样系统稳定运行后不会每个请求都触发 users 表查询
        $base = defined('RUNTIME_PATH') ? RUNTIME_PATH : (dirname(__DIR__) . DIRECTORY_SEPARATOR . 'runtime' . DIRECTORY_SEPARATOR);
        $dir = rtrim($base, DIRECTORY_SEPARATOR) . DIRECTORY_SEPARATOR . 'csgoj' . DIRECTORY_SEPARATOR;
        if (!is_dir($dir)) {
            // @：避免因并发创建目录产生 warning
            @mkdir($dir, 0755, true);
        }
        return $dir . 'install.lock';
    }

    protected function isSystemInstalled() {
        return is_file($this->getInstallLockPath());
    }

    protected function ensureInstallLock() {
        $path = $this->getInstallLockPath();
        if (is_file($path)) {
            return true;
        }
        $payload = json_encode([
            'installed_at' => date('c'),
            'ip' => $this->request ? $this->request->ip() : null,
        ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

        // 写文件失败不应引发 fatal，但会降低“禁止重复初始化”的可靠性
        @file_put_contents($path, ($payload ?: 'installed') . "\n", LOCK_EX);
        return is_file($path);
    }

    protected function checkUserInitialization() {        
        // 如果是初始化页面本身（包括 AJAX 请求），则跳过检查，避免循环重定向
        if($this->module != 'ojtool' || $this->controller != 'userinit') {
            // 标准做法：优先检查 install.lock，避免每个请求都打数据库
            if ($this->isSystemInstalled()) {
                Cache::set('csgoj:users:has_any', 1, 86400 * 365);
                return;
            }

            // 性能优化：避免每个请求都 count(users)
            // - 用「是否存在任意一行」代替 count(*)（InnoDB 下 count 可能扫描索引）
            // - 用缓存把“已初始化（已有用户）”记住：初始化完成后几乎不再打 DB
            $cacheKey = 'csgoj:users:has_any';
            $hasUsersCached = Cache::get($cacheKey);
            if ($hasUsersCached === null) {
                // 只取一行即可
                $anyUserId = db('users')->field('user_id')->limit(1)->value('user_id');
                $hasUsersCached = $anyUserId ? 1 : 0;
                // 没有用户时短 TTL，避免初始化前高并发打爆 DB；有用户后长 TTL
                Cache::set($cacheKey, $hasUsersCached, $hasUsersCached ? 86400 * 365 : 5);
            }

            if((int)$hasUsersCached === 1) {
                // 自愈：存在用户但 install.lock 丢失时，自动补锁，防止误进入初始化流程
                $this->ensureInstallLock();
                return;
            }

            if((int)$hasUsersCached === 0) {
                // 重要：cache=0 只用短 TTL（5s），有可能在“刚完成初始化”后仍为 0
                // 为避免用户被错误跳转到初始化页并看到“已初始化”的等待/错误页面，这里在重定向前做一次轻量确认
                $anyUserId = db('users')->field('user_id')->limit(1)->value('user_id');
                if ($anyUserId) {
                    Cache::set($cacheKey, 1, 86400 * 365);
                    $this->ensureInstallLock();
                    return;
                }
                // 用户表确实为空，才跳转到初始化页面
                $this->redirect('/ojtool/userinit');
            }
            return;
        }
    }
    public function InitController() {}

    /**
     * 解析 .env 中的可选布尔开关：未设置/无法识别 → null（不覆盖系统原有逻辑）
     * 注意：ThinkPHP 用 parse_ini_file 加载 .env，无引号的 false 常被解析成空串 ''；
     * 对 FLG_ALLOW_* 调用时须 $emptyMeansExplicitFalse=true，使 '' 视为显式关闭（与线上写法一致）。
     * @param mixed $value
     * @param bool $emptyMeansExplicitFalse
     * @return bool|null
     */
    protected function normalizeOptionalFlgEnv($value, $emptyMeansExplicitFalse = false)
    {
        if ($value === null) {
            return null;
        }
        if ($value === '') {
            return $emptyMeansExplicitFalse ? false : null;
        }
        if (is_bool($value)) {
            return $value;
        }
        if (is_int($value) || is_float($value)) {
            return ((int)$value) !== 0;
        }
        $s = strtolower(trim((string)$value));
        if ($s === '' || $s === 'null' || $s === 'unset' || $s === '-') {
            return null;
        }
        if (in_array($s, ['0', 'false', 'off', 'no'], true)) {
            return false;
        }
        if (in_array($s, ['1', 'true', 'on', 'yes'], true)) {
            return true;
        }
        return null;
    }

    /** 新建登录会话（账号密码 / SSO）是否被环境开关禁止 */
    protected function assertFlgAllowNewLoginSession()
    {
        if ($this->FLG_ALLOW_LOGIN === false) {
            $this->errorBilingual(
                '当前站点已关闭网页登录，无法完成登录。',
                'Sign-in is disabled on this site.',
                null,
                ['code' => 403]
            );
        }
    }

    /** 自助注册是否被环境开关禁止 */
    protected function assertFlgAllowSelfRegister()
    {
        if ($this->FLG_ALLOW_REGISTER === false) {
            $this->errorBilingual(
                '当前站点已关闭自助注册。',
                'Self-service registration is disabled on this site.',
                null,
                ['code' => 403]
            );
        }
    }
    
    /**
     * 返回错误（双语），供前端 alerty 双参展示（中文在前、英文在后）
     * 约定：data 中含 flg_bilingual 且含 msg_cn、msg_en，前端用 alerty.error(ret.data.msg_cn, ret.data.msg_en)；msg 不重复。
     * 归档禁写等可附 data.contest_write_blocked（如 archived），供前端特判。
     * @param string $msg_cn 中文提示
     * @param string $msg_en 英文提示
     * @param string|null $url 跳转 URL
     * @param array $extraData 额外返回数据（会与 flg_bilingual/msg_cn/msg_en 合并）
     */
    protected function errorBilingual($msg_cn, $msg_en, $url = null, $extraData = []) {
        $data = array_merge($extraData, ['flg_bilingual' => true, 'msg_cn' => $msg_cn, 'msg_en' => $msg_en]);
        $this->error('', $url, $data);
    }
    
    /**
     * 返回成功（双语），供前端 alerty 双参展示（中文在前、英文在后）
     * 约定：data 中含 flg_bilingual 且含 msg_cn、msg_en 时，前端用 alerty.success(ret.data.msg_cn, ret.data.msg_en)；不重复写 msg
     */
    protected function successBilingual($msg_cn, $msg_en, $url = null, $data = []) {
        $data = array_merge($data, ['flg_bilingual' => true, 'msg_cn' => $msg_cn, 'msg_en' => $msg_en]);
        $this->success('', $url, $data);
    }
    
    /**
     * 检查当前路由是否在白名单中（无条件放通）
     * 白名单规则：
     * 1. 模块+控制器级别：['module' => 'xxx', 'controller' => 'xxx']
     * 2. 动作级别：['action' => ['action1', 'action2', ...]]
     * 3. 条件级别：['condition' => function() { return bool; }]
     * 
     * @param string $context 上下文类型，用于区分不同的使用场景
     *                        - 'route_guard': 路由守卫（最严格，包含所有白名单）
     *                        - 'course_system': 课程系统初始化（排除登录接口）
     *                        - 'course_selection': 课程选择检查（仅模块级别）
     * @return bool 是否在白名单中
     */
    protected function isWhitelistedRoute($context = 'route_guard')
    {
        // 定义白名单规则
        $whitelist = [
            // 模块+控制器级别白名单
            'module_controller' => [
                ['module' => 'ojtool', 'controller' => 'judge2'],      // 评测机接口
                ['module' => 'ojtool', 'controller' => 'userinit'],    // 初始化向导页面
                // 直播投屏：须允许仅 #cpcteam 赛内会话（watcher 等）访问；细粒度鉴权在 Contestlive + canManageLiveConsole / lvtk
                ['module' => 'ojtool', 'controller' => 'contestlive'],
            ],
            
            // 动作级别白名单（登录/登出接口）
            'actions' => [
                'login_ajax',
                'logout_ajax',
                'sso_start',
                'sso_callback',
                'sso_direct_ajax',
                'sso_logout',
            ],
            
            // 条件级别白名单
            'conditions' => [
                // OJ_MODE=online 时整个 ojtool 模块放通
                function() {
                    return $this->OJ_MODE == 'online' && $this->module == 'ojtool';
                },
                // OJ_STATUS=exp 且 OJ_MODE=cpc 的考试模式下，整个 ojtool 模块放通
                function() {
                    return $this->OJ_STATUS == 'exp' && $this->module == 'ojtool';
                },
            ],
        ];
        
        // 根据上下文调整白名单
        if ($context == 'course_system') {
            // 课程系统初始化时，排除动作级别的白名单（登录接口需要特殊处理）
            // 只保留模块+控制器级别和条件级别
        } elseif ($context == 'course_selection') {
            // 课程选择检查时，只检查模块级别
            $whitelist['module_controller'][] = ['module' => 'course', 'controller' => null];
            $whitelist['module_controller'][] = ['module' => 'exadmin', 'controller' => null];
            // 保留条件白名单（用于考试模式下放通 ojtool 模块）
            // 移除动作白名单
            $whitelist['actions'] = [];
        }
        
        // 检查模块+控制器级别白名单
        foreach ($whitelist['module_controller'] as $rule) {
            $moduleMatch = $rule['module'] == $this->module;
            $controllerMatch = $rule['controller'] === null || $rule['controller'] == $this->controller;
            if ($moduleMatch && $controllerMatch) {
                return true;
            }
        }
        
        // 检查动作级别白名单
        if (!empty($whitelist['actions']) && in_array($this->action, $whitelist['actions'])) {
            return true;
        }
        
        // 检查条件级别白名单
        foreach ($whitelist['conditions'] as $condition) {
            if (is_callable($condition) && $condition()) {
                return true;
            }
        }
        
        return false;
    }
    
    public function OJMode(){
        $this->OJ_MODE = GetOjMode();
        $this->OJ_STATUS = config('OJ_ENV.OJ_STATUS');
        $this->OJ_OPEN_OI = config('OJ_ENV.OJ_OPEN_OI');
        $this->OJ_OPEN_ARCHIVE = config('OJ_ENV.OJ_OPEN_ARCHIVE');
        $this->OJ_ADMIN = GetOjAdminConfig();
        $this->OJ_NAME = config('OJ_ENV.OJ_NAME');
        $this->OJ_SSO = config('OJ_ENV.OJ_SSO');
        if($this->OJ_SSO === 0 || strtolower($this->OJ_SSO) === 'false') {
            $this->OJ_SSO = false;
        }
        $this->FLG_ALLOW_REGISTER = $this->normalizeOptionalFlgEnv(config('OJ_ENV.FLG_ALLOW_REGISTER'), true);
        $this->FLG_ALLOW_LOGIN = $this->normalizeOptionalFlgEnv(config('OJ_ENV.FLG_ALLOW_LOGIN'), true);
        $this->OJ_SCLIENT_ID = config('OJ_ENV.OJ_SCLIENT_ID');
        $this->ICP_RECORD = config('OJ_ENV.ICP_RECORD');
        $this->GA_CODE = config('OJ_ENV.GA_CODE');
        $this->BA_CODE = config('OJ_ENV.BA_CODE');
        $git_discussion = config('OJ_ENV.GIT_DISCUSSION');
        // 如果 GIT_DISCUSSION 为空字符串或未定义，则设置为 null
        $this->GIT_DISCUSSION = (!empty($git_discussion) && trim($git_discussion) !== '') ? $git_discussion : null;
        $this->module = strtolower($this->request->module());
        $this->action = strtolower($this->request->action());
        $this->controller = strtolower($this->request->controller());
        $this->isAdmin = IsAdmin();
        
        // 如果 OJ_STATUS 是 exp，初始化课程管理系统
        // 评测机接口（ojtool/judge2）无条件跳过课程逻辑，减少不必要的计算压力
        if($this->OJ_STATUS == 'exp' && !($this->module == 'ojtool' && $this->controller == 'judge2')) {
            $this->InitCourseSystem();
        } else {
            // cpc 模式：只设置基础配置，不涉及课程管理
            // 从 CourseDefaultConfig 获取默认值
            $cfgAll = config('CourseDefaultConfig.');
            $defaultConfig = (is_array($cfgAll) && isset($cfgAll['config']) && is_array($cfgAll['config'])) ? $cfgAll['config'] : [];
            $this->ALLOW_WA_INFO = $defaultConfig['ALLOW_WA_INFO'] ?? false;
            $this->ALLOW_TEST_DOWNLOAD = $defaultConfig['ALLOW_TEST_DOWNLOAD'] ?? false;
            $this->PLAGIARISM_SCORE = $defaultConfig['PLAGIARISM_SCORE'] ?? 0.4;
            $this->assign('ALLOW_WA_INFO', $this->ALLOW_WA_INFO);
            $this->assign('ALLOW_TEST_DOWNLOAD', $this->ALLOW_TEST_DOWNLOAD);
            $this->assign('PLAGIARISM_SCORE', $this->PLAGIARISM_SCORE);
        }
        //////////
        $this->assign('OJ_MODE', $this->OJ_MODE);
        $this->assign('OJ_STATUS', $this->OJ_STATUS);
        $this->assign('OJ_OPEN_OI', $this->OJ_OPEN_OI);
        $this->assign('OJ_OPEN_ARCHIVE', $this->OJ_OPEN_ARCHIVE);
        $this->assign('OJ_NAME', $this->OJ_NAME);
        $this->assign('OJ_SSO', $this->OJ_SSO);
        $this->assign('OJ_SCLIENT_ID', $this->OJ_SCLIENT_ID);
        $this->assign('ICP_RECORD', $this->ICP_RECORD);
        $this->assign('GA_CODE', $this->GA_CODE);
        $this->assign('BA_CODE', $this->BA_CODE);
        $this->assign('GIT_DISCUSSION', $this->GIT_DISCUSSION);
        $this->assign('isAdmin', $this->isAdmin);
        // 检查 OJ_ADMIN 配置是否存在
        if (!empty($this->OJ_ADMIN) && is_array($this->OJ_ADMIN)) {
            $this->assign('ojAdminList', $this->OJ_ADMIN['OJ_ADMIN_LIST'] ?? []);
        } else {
            $this->assign('ojAdminList', []);
        }
        $this->assign('module', $this->module);
        $this->assign('controller', $this->controller);
        $this->assign('action', $this->action);
        $this->OJ_SESSION_PREFIX = config('OJ_ENV.OJ_SESSION') . '_';
        $this->assign('OJ_SESSION_PREFIX', $this->OJ_SESSION_PREFIX);
        $this->assign('OJ_ADDITION_LINK', config('OJ_ENV.OJ_ADDITION_LINK'));
        $this->assign('OJ_FLG_REGISTER_DISABLED', $this->FLG_ALLOW_REGISTER === false);
        $this->assign('OJ_FLG_LOGIN_DISABLED', $this->FLG_ALLOW_LOGIN === false);
        $this->OJ_MODE_ALLOW_MODULE = config('OjMode.OJ_MODE_ALLOW_MODULE');
        
        // 获取并传递用户类型到视图
        $this->assign('userType', $this->getUserType());

        
        $this->checkUserInitialization();   // 首用户逻辑
        
        // 统一的路由守卫系统
        $this->routeGuard();
    }
    
    /**
     * 统一的路由守卫系统
     * 根据 OJ_MODE、OJ_STATUS 和当前模块进行访问控制
     * 子类可以重写此方法或相关的守卫方法来添加额外的检查
     */
    protected function routeGuard()
    {
        // 检查白名单：无条件放通的路由（评测机接口、初始化向导、登录/登出接口等）
        if ($this->isWhitelistedRoute('route_guard')) {
            return;
        }
        
        // 0.1 严格检查课程选择（仅在 OJ_STATUS=exp 时）
        // 0.1.0 OJ_STATUS=exp 时，必须选择有效的课程组（DEFAULT 不算）
        // 注意：IsAdmin() 不受此限制，可以以 DEFAULT 课程自由访问
        // 特别地，administrator 和 super_admin 访问管理后台（exadmin）时，即使没有选择课程组也允许访问
        // 注意：白名单模块（如 ojtool 在考试模式下）已经在前面检查过了，如果匹配会直接 return，不会执行到这里
        if ($this->OJ_STATUS == 'exp') {
            // 排除 course 模块本身，允许访问课程选择页面
            if ($this->module != 'course') {
                // 管理员不受课程选择限制，可以自由访问
                if (!IsAdmin()) {
                    // 确保课程信息已初始化（如果还未初始化）
                    if (!isset($this->NOW_COURSE_KEY) || !isset($this->NOW_COURSE_ID)) {
                        // 先获取 now_course_key（不触发完整的 InitCourseNow，避免错误终止）
                        $now_course_key = session('?now_course_key') ? session('now_course_key') : null;
                        if(empty($now_course_key)) {
                            $now_course_key = 'DEFAULT';
                        }
                        
                        // 如果 now_course_key 是 DEFAULT，直接跳转
                        if($now_course_key == 'DEFAULT') {
                            $this->redirect('/course');
                            return;
                        }
                        
                        // 检查课程是否存在且可用（在调用 InitCourseNow 之前，使用缓存方法）
                        if(!$this->CourseExists($now_course_key, false)) {
                            // 课程不存在或不可用，清除session中的无效课程键，避免无限循环
                            session('now_course_key', 'DEFAULT');
                            cookie('now_course_key', 'DEFAULT');
                            // 跳转到课程选择页面
                            $this->redirect('/course');
                            return;
                        }
                        
                        // 课程存在，初始化课程信息
                        $this->InitCourseNow();
                    }
                    
                    // 严格检查：now_course_key 不能是 DEFAULT 或空，now_course_id 必须存在
                    if (empty($this->NOW_COURSE_KEY) || 
                        $this->NOW_COURSE_KEY == 'DEFAULT' || 
                        empty($this->NOW_COURSE_ID)) {
                        // 绝对跳转到课程选择页面
                        $this->redirect('/course');
                        return;
                    }
                } else {
                    // 管理员可以访问所有模块，即使没有选择有效的课程
                    // 只做基础初始化，不强制要求有效的课程
                    if (!isset($this->NOW_COURSE_KEY) || !isset($this->NOW_COURSE_ID)) {
                        // 获取 now_course_key，允许 DEFAULT
                        $now_course_key = session('?now_course_key') ? session('now_course_key') : 'DEFAULT';
                        if(empty($now_course_key)) {
                            $now_course_key = 'DEFAULT';
                        }
                        $this->NOW_COURSE_KEY = strtoupper($now_course_key);

                        // 如果不是 DEFAULT，尝试获取 course_id（不报错，使用缓存方法）
                        if($now_course_key != 'DEFAULT') {
                            $this->NOW_COURSE_ID = $this->GetCourseId($now_course_key);
                        } else {
                            $this->NOW_COURSE_ID = null;
                        }

                        // 设置默认课程信息
                        $this->OJ_COURSE_NOW = [
                            'course_title'  =>  '-未选择课程-',
                            'course_config' =>  null
                        ];

                        $this->assign('NOW_COURSE_KEY', $this->NOW_COURSE_KEY);
                        $this->assign('NOW_COURSE_ID', $this->NOW_COURSE_ID);
                        $this->assign('OJ_COURSE_NOW', $this->OJ_COURSE_NOW);
                    }
                }
            }
        }
        
        // 0.1.1 特殊路由重定向
        // 0.1.1.1 OJ_STATUS=exp 时，index 模块重定向到 exindex
        if ($this->OJ_STATUS == 'exp' && $this->module == 'index') {
            $this->redirect('/exindex');
            return;
        }
        
        // 0.2 后台模块路由重定向：根据 OJ_STATUS 确保访问正确的后台
        // OJ_STATUS=cpc 时，后台只能是 /admin，如果是 /exadmin 要跳转到 /admin
        if ($this->OJ_STATUS == 'cpc' && $this->module == 'exadmin') {
            $this->redirect('/admin');
            return;
        }
        // OJ_STATUS=exp 时，后台只能是 /exadmin，如果是 /admin 要跳转到 /exadmin
        if ($this->OJ_STATUS == 'exp' && $this->module == 'admin') {
            $this->redirect('/exadmin');
            return;
        }
        
        // 1. 检查模块特定的 OJ_MODE/OJ_STATUS 要求
        $moduleRequirement = $this->getModuleRequirement();
        if ($moduleRequirement !== null) {
            // 特殊处理：OJ_MODE=cpcsys 且 OJ_STATUS=exp 时，管理员和课程教师可以访问 expsys 模块
            // 即使不满足模块要求（expsys 要求 OJ_MODE=online，但当前是 cpcsys）
            $skipRequirementCheck = false;
            if ($this->OJ_MODE == 'cpcsys' && $this->OJ_STATUS == 'exp' && $this->module == 'expsys') {
                if (IsAdmin()) {
                    $skipRequirementCheck = true;
                } else {
                    // 检查是否是课程教师
                    $isCourseTeacher = $this->checkIsAnyCourseTeacher();
                    if ($isCourseTeacher) {
                        $skipRequirementCheck = true;
                    }
                }
            }
            
            if (!$skipRequirementCheck && !$this->checkModuleRequirement($moduleRequirement)) {
                $this->redirectToDefault();
                return;
            }
        }
        
        // 2. 检查基础模块访问控制（基于 OJ_MODE_ALLOW_MODULE）
        if (!$this->checkModuleAccess()) {
            $this->redirectToAllowedModule();
            return;
        }
        
        // 3. 子类可以添加额外的守卫检查
        $this->additionalRouteGuards();
    }
    
    /**
     * 获取模块特定的 OJ_MODE/OJ_STATUS 要求
     * 子类可以重写此方法来定义模块特定的要求
     * @return array|null 返回 ['oj_mode' => 'xxx', 'oj_status' => 'xxx'] 或 null（无要求）
     */
    protected function getModuleRequirement()
    {
        // 默认无特定要求，子类可以重写
        return null;
    }
    
    /**
     * 检查模块特定的 OJ_MODE/OJ_STATUS 要求
     * @param array $requirement ['oj_mode' => 'xxx', 'oj_status' => 'xxx']
     * @return bool 是否满足要求
     */
    protected function checkModuleRequirement($requirement)
    {
        $ojModeMatch = !isset($requirement['oj_mode']) || $this->OJ_MODE === $requirement['oj_mode'];
        $ojStatusMatch = !isset($requirement['oj_status']) || $this->OJ_STATUS === $requirement['oj_status'];
        return $ojModeMatch && $ojStatusMatch;
    }
    
    /**
     * 获取当前用户类型
     * 
     * 按照优先级顺序检查用户权限，返回最高级别的用户类型。
     * 注意：课程相关权限（course_super、course_admin、course_teacher）是跟随当前课程（NOW_COURSE_KEY）的，
     * 用户切换到其他课程时，这些权限会相应变化。
     * 
     * 优先级顺序（从高到低）：
     * 1. super_admin - 系统超级管理员（最高权限）
     * 2. administrator - 系统管理员（有任意管理员权限但不是超级管理员）
     * 3. course_super - 课程超级管理员（仅在 OJ_STATUS='exp' 时检查，针对当前课程）
     * 4. course_admin - 课程管理员（仅在 OJ_STATUS='exp' 时检查，针对当前课程）
     * 5. course_teacher - 课程教师（仅在 OJ_STATUS='exp' 时检查，针对当前课程）
     * 6. logged_in - 已登录的普通用户
     * 7. guest - 未登录用户（最低级别）
     * 
     * @return string 用户类型，可能的值：
     *                - 'super_admin': 系统超级管理员
     *                - 'administrator': 系统管理员
     *                - 'course_super': 课程超级管理员（仅 exp 模式）
     *                - 'course_admin': 课程管理员（仅 exp 模式）
     *                - 'course_teacher': 课程教师（仅 exp 模式）
     *                - 'logged_in': 已登录用户
     *                - 'guest': 未登录用户
     */
    protected function getUserType()
    {
        // 1. 检查是否是系统超级管理员（最高权限）
        if (IsAdmin('super_admin')) {
            return 'super_admin';
        }
        
        // 2. 检查是否是系统管理员（有任意管理员权限但不是超级管理员）
        if (IsAdmin()) {
            return 'administrator';
        }
        
        // 3. 检查课程相关权限（仅在 OJ_STATUS='exp' 教学模式下检查）
        // 注意：课程权限是跟随当前课程（NOW_COURSE_KEY）的，用户切换到其他课程时权限会变化
        if ($this->OJ_STATUS == 'exp') {
            // 3.1 检查是否是当前课程的超级管理员
            if (PrivCourse('super', $this->NOW_COURSE_KEY)) {
                return 'course_super';
            }
            // 3.2 检查是否是当前课程的管理员
            if (PrivCourse('admin', $this->NOW_COURSE_KEY)) {
                return 'course_admin';
            }
            // 3.3 检查是否是当前课程的教师
            if (PrivCourse('teacher', $this->NOW_COURSE_KEY)) {
                return 'course_teacher';
            }
        }
        
        // 4. 检查是否已登录（普通用户）
        if (session('?user_id')) {
            return 'logged_in';
        }
        
        // 5. 未登录用户（最低级别）
        return 'guest';
    }
    
    /**
     * 检查基础模块访问控制
     * 基于 MODULE_ACCESS_PERMISSION 配置
     * 支持模块级别和 controller 级别的权限控制
     * @return bool 是否允许访问
     */
    protected function checkModuleAccess()
    {
        // 大管理员（super_admin 和 administrator）可以访问所有模块（不受配置限制）
        if (IsAdmin('super_admin') || IsAdmin('administrator')) {
            return true;
        }
        
        // 获取用户类型
        $userType = $this->getUserType();
        
        // 获取权限配置
        $permissionConfig = config('OjMode.MODULE_ACCESS_PERMISSION');
        if (!isset($permissionConfig[$this->OJ_MODE][$this->OJ_STATUS][$userType])) {
            // 如果配置不存在，回退到旧的 OJ_MODE_ALLOW_MODULE 配置
            if (isset($this->OJ_MODE_ALLOW_MODULE[$this->OJ_MODE][$this->OJ_STATUS])) {
                $allowedModules = $this->OJ_MODE_ALLOW_MODULE[$this->OJ_MODE][$this->OJ_STATUS];
                return in_array($this->module, $allowedModules);
            }
            return false;
        }
        
        // 获取当前用户类型的权限配置
        $userPermission = $permissionConfig[$this->OJ_MODE][$this->OJ_STATUS][$userType];
        
        // 判断配置格式：字符串数组（旧格式）还是关联数组（新格式）
        if (is_array($userPermission) && !empty($userPermission) && !is_numeric(key($userPermission))) {
            // 新格式：关联数组，支持 controller 级别控制
            // 例如：['examsys' => true, 'csgoj' => ['faqs']]
            if (!isset($userPermission[$this->module])) {
                return false; // 模块不在允许列表中
            }
            
            $modulePermission = $userPermission[$this->module];
            
            // 如果值是 true，表示可以访问该模块的所有 controller
            if ($modulePermission === true) {
                return true;
            }
            
            // 如果值是数组，表示只能访问指定的 controller
            if (is_array($modulePermission)) {
                return in_array($this->controller, $modulePermission);
            }
            
            return false;
        } else {
            // 旧格式：字符串数组，可以访问该模块的所有 controller
            // 例如：['index', 'csgoj', 'user']
            return in_array($this->module, $userPermission);
        }
    }
    
    /**
     * 重定向到允许的模块（默认模块）
     */
    protected function redirectToAllowedModule()
    {
        // 获取用户类型
        $userType = $this->getUserType();
        
        // 获取权限配置
        $permissionConfig = config('OjMode.MODULE_ACCESS_PERMISSION');
        if (isset($permissionConfig[$this->OJ_MODE][$this->OJ_STATUS][$userType])) {
            $userPermission = $permissionConfig[$this->OJ_MODE][$this->OJ_STATUS][$userType];
            
            // 判断配置格式：字符串数组（旧格式）还是关联数组（新格式）
            if (is_array($userPermission) && !empty($userPermission) && !is_numeric(key($userPermission))) {
                // 新格式：关联数组，获取第一个允许的模块
                $allowedModules = array_keys($userPermission);
                if (!empty($allowedModules)) {
                    $defaultModule = $allowedModules[0];
                    // 如果该模块有 controller 限制，重定向到第一个允许的 controller
                    $modulePermission = $userPermission[$defaultModule];
                    if (is_array($modulePermission) && !empty($modulePermission)) {
                        $defaultController = $modulePermission[0];
                        $this->redirect('/' . $defaultModule . '/' . $defaultController);
                    } else {
                        $this->redirect('/' . $defaultModule);
                    }
                    return;
                }
            } else {
                // 旧格式：字符串数组
                if (!empty($userPermission)) {
                    $defaultModule = $userPermission[0];
                    $this->redirect('/' . $defaultModule);
                    return;
                }
            }
        }
        
        // 回退到旧的配置
        if (isset($this->OJ_MODE_ALLOW_MODULE[$this->OJ_MODE][$this->OJ_STATUS][0])) {
            $defaultModule = $this->OJ_MODE_ALLOW_MODULE[$this->OJ_MODE][$this->OJ_STATUS][0];
            $this->redirect('/' . $defaultModule);
        } else {
            $this->redirect('/');
        }
    }
    
    /**
     * 重定向到默认页面（通常是首页）
     */
    protected function redirectToDefault()
    {
        $this->redirect('/');
    }
    
    /**
     * 额外的路由守卫检查
     * 子类可以重写此方法来添加额外的检查逻辑
     */
    protected function additionalRouteGuards()
    {
        // 默认无额外检查，子类可以重写
        // 如果是 exp 模式，添加课程权限检查
        if($this->OJ_STATUS == 'exp') {
            $this->additionalExpRouteGuards();
        }
    }
    
    /**
     * exp 模式额外的路由守卫检查
     * 添加课程权限检查
     * 注意：基础模块访问控制（包括 controller 级别限制）已由 checkModuleAccess() 通过 MODULE_ACCESS_PERMISSION 配置处理
     * 这里主要处理课程相关的特殊逻辑
     */
    protected function additionalExpRouteGuards()
    {
        // course 模块不需要权限检查，允许访问
        if($this->module == 'course') {
            return;
        }
        
        // 特殊处理：OJ_MODE=cpcsys 时，expsys 模块需要管理员或课程教师权限
        if($this->OJ_MODE == 'cpcsys' && $this->module == 'expsys') {
            // 管理员可以访问（super_admin 或 administrator）
            if(IsAdmin('super_admin') || IsAdmin('administrator')) {
                return;
            }
            
            // 检查是否是任何课程的教师
            $isCourseTeacher = $this->checkIsAnyCourseTeacher();
            if(!$isCourseTeacher) {
                $this->redirectToAllowedModule();
                return;
            }
            // 是课程教师，允许访问
            return;
        }
        
        // 基础模块访问控制（包括 controller 级别限制）已由 checkModuleAccess() 处理，这里不再重复检查
        // 如果需要添加课程相关的额外检查，可以在这里添加
    }
    
    /**
     * 检查用户是否是任何课程的教师
     * @return bool
     */
    protected function checkIsAnyCourseTeacher()
    {
        return PrivCourse('teacher', null);
    }
    
    /**
     * 初始化实验考试系统的课程管理
     * 仅在 OJ_STATUS == 'exp' 时调用
     */
    protected function InitCourseSystem()
    {
        // 检查白名单：无条件放通的路由（评测机接口、初始化向导等）
        if ($this->isWhitelistedRoute('course_system')) {
            return;
        }
        
        // 确保 OJ_MODE 和 OJ_STATUS 已设置
        if(!isset($this->OJ_MODE) || !isset($this->OJ_STATUS) || $this->OJ_STATUS != 'exp') {
            return;
        }
        
        // 登录/登出接口无条件放通，不初始化课程（允许未选择课程）
        $loginActions = ['login_ajax', 'logout_ajax', 'sso_start', 'sso_callback', 'sso_direct_ajax', 'sso_logout'];
        if (in_array($this->action, $loginActions)) {
            // 登录接口只需要设置默认值，不进行课程检查
            $this->NOW_COURSE_KEY = session('?now_course_key') ? session('now_course_key') : 'DEFAULT';
            if(empty($this->NOW_COURSE_KEY)) {
                $this->NOW_COURSE_KEY = 'DEFAULT';
            }
            $this->NOW_COURSE_ID = null;
            $this->OJ_COURSE_NOW = [
                'course_title'  =>  '-未选择课程-',
                'course_config' =>  null
            ];
            $this->assign('NOW_COURSE_KEY', $this->NOW_COURSE_KEY);
            $this->assign('NOW_COURSE_ID', $this->NOW_COURSE_ID);
            $this->assign('OJ_COURSE_NOW', $this->OJ_COURSE_NOW);
            return;
        }
        
        $this->InitCourseNow();
        $this->isCourseAdmin = PrivCourse('admin', $this->NOW_COURSE_KEY);
        
        // 单独处理每个课程的配置信息
        // 从 CourseDefaultConfig 获取默认配置值
        $cfgAll = config('CourseDefaultConfig.');
        $defaultConfig = (is_array($cfgAll) && isset($cfgAll['config']) && is_array($cfgAll['config'])) ? $cfgAll['config'] : [];
        $this->COURSE_ENV_CONFIG = [
            'ALLOW_WA_INFO'                 =>  $defaultConfig['ALLOW_WA_INFO'] ?? false,
            'ALLOW_TEST_DOWNLOAD'           =>  $defaultConfig['ALLOW_TEST_DOWNLOAD'] ?? false,
            'OJ_TEST_DOWNLOAD_WAIT_TIME'    =>  $defaultConfig['OJ_TEST_DOWNLOAD_WAIT_TIME'] ?? 60,
            'PLAGIARISM_SCORE'              =>  $defaultConfig['PLAGIARISM_SCORE'] ?? 0.4,
            'PLAGIARISM_MIN_LEN'            =>  $defaultConfig['PLAGIARISM_MIN_LEN'] ?? 800,
            'PLAGIARISM_THRESHOLD'          =>  $defaultConfig['PLAGIARISM_THRESHOLD'] ?? 85,
            'EXP_LEVEL_SCORE'               =>  $defaultConfig['EXP_LEVEL_SCORE'] ?? 4,
        ];
        $this->assign('COURSE_ENV_CONFIG', $this->COURSE_ENV_CONFIG);
        
        // 从课程配置中获取实际配置值
        $this->ALLOW_WA_INFO                = $this->GetCourseConfig('ALLOW_WA_INFO', $this->OJ_COURSE_NOW['course_config']);
        $this->ALLOW_TEST_DOWNLOAD          = $this->GetCourseConfig('ALLOW_TEST_DOWNLOAD', $this->OJ_COURSE_NOW['course_config']);
        $this->PLAGIARISM_SCORE             = $this->GetCourseConfig('PLAGIARISM_SCORE', $this->OJ_COURSE_NOW['course_config']);
        $this->PLAGIARISM_MIN_LEN           = $this->GetCourseConfig('PLAGIARISM_MIN_LEN', $this->OJ_COURSE_NOW['course_config']);
        $this->PLAGIARISM_THRESHOLD         = $this->GetCourseConfig('PLAGIARISM_THRESHOLD', $this->OJ_COURSE_NOW['course_config']);
        $this->EXP_LEVEL_SCORE              = $this->GetCourseConfig('EXP_LEVEL_SCORE', $this->OJ_COURSE_NOW['course_config']);
        $this->OJ_TEST_DOWNLOAD_WAIT_TIME   = $this->GetCourseConfig('OJ_TEST_DOWNLOAD_WAIT_TIME', $this->OJ_COURSE_NOW['course_config']);
        
        // 赋值到视图
        $this->assign('ALLOW_WA_INFO', $this->ALLOW_WA_INFO);
        $this->assign('ALLOW_TEST_DOWNLOAD', $this->ALLOW_TEST_DOWNLOAD);
        $this->assign('PLAGIARISM_SCORE', $this->PLAGIARISM_SCORE);
        $this->assign('PLAGIARISM_MIN_LEN', $this->PLAGIARISM_MIN_LEN);
        $this->assign('PLAGIARISM_THRESHOLD', $this->PLAGIARISM_THRESHOLD);
        $this->assign('OJ_TEST_DOWNLOAD_WAIT_TIME', $this->OJ_TEST_DOWNLOAD_WAIT_TIME);
        $this->assign('isCourseAdmin', $this->isCourseAdmin);
        
        // 在课程系统初始化后，检查课程选择状态
        $this->checkCourseSelection();
    }
    
    // ========================================================================
    // 课程配置管理相关方法（Course Config Management）
    // ========================================================================
    
    /**
     * 获取课程完整信息（带缓存，避免重复查询数据库）
     * @param string $course_key 课程键名
     * @param bool $includeDefunct 是否包含已禁用的课程（管理员权限）
     * @return array|null 课程信息数组 ['course_id', 'course_title', 'course_config', 'defunct']
     */
    protected function GetCourseInfo($course_key, $includeDefunct = false)
    {
        // 如果已缓存且是当前课程，直接返回
        if (isset($this->COURSE_CACHE) && 
            isset($this->COURSE_CACHE[$course_key])) {
            return $this->COURSE_CACHE[$course_key];
        }
        
        // 初始化缓存数组
        if (!isset($this->COURSE_CACHE)) {
            $this->COURSE_CACHE = [];
        }
        
        // 使用缓存键
        $cacheKey = 'course_info_' . $course_key . ($includeDefunct ? '_all' : '_active');
        
        // 从缓存或数据库获取
        $courseInfo = \think\facade\Cache::remember($cacheKey, function() use ($course_key, $includeDefunct) {
            $map = ['course_key' => $course_key];
            if (!$includeDefunct) {
                $map['defunct'] = 0;
            }
            
            $course = db('course')->where($map)->field(['course_id', 'course_title', 'course_unit', 'course_config', 'defunct'])->find();
            return $course ?: null;
        }, 300); // 缓存5分钟
        
        // 保存到实例变量缓存
        if ($courseInfo) {
            $this->COURSE_CACHE[$course_key] = $courseInfo;
        }
        
        return $courseInfo;
    }
    
    /**
     * 检查课程是否存在（带缓存）
     * @param string $course_key 课程键名
     * @param bool $includeDefunct 是否包含已禁用的课程
     * @return bool
     */
    protected function CourseExists($course_key, $includeDefunct = false)
    {
        if (empty($course_key) || $course_key == 'DEFAULT') {
            return false;
        }
        
        $courseInfo = $this->GetCourseInfo($course_key, $includeDefunct);
        return $courseInfo !== null;
    }
    
    /**
     * 获取课程ID（带缓存）
     * @param string $course_key 课程键名
     * @return int|null
     */
    protected function GetCourseId($course_key)
    {
        if (empty($course_key) || $course_key == 'DEFAULT') {
            return null;
        }
        
        $courseInfo = $this->GetCourseInfo($course_key, true); // 管理员可以查看已禁用的课程
        return $courseInfo ? $courseInfo['course_id'] : null;
    }
    
    /**
     * 获取课程配置值
     * @param string $key 配置键名
     * @param array|null $course_config 课程配置数组
     * @return mixed 配置值
     */
    protected function GetCourseConfig($key, $course_config) {
        // 确保网站不会因为读取配置而崩溃
        try {
            if ($course_config && array_key_exists($key, $course_config)) {
                return $course_config[$key];
            }
        } catch (Exception $e) {
        }
        return isset($this->COURSE_ENV_CONFIG[$key]) ? $this->COURSE_ENV_CONFIG[$key] : null;
    }
    
    /**
     * 根据 OJ_MODE 和 OJ_STATUS 获取 course_config 的 key
     * @return string 配置键名
     */
    protected function CourseConfigKey()
    {
        // 根据 OJ_MODE 、 OJ_STATUS 获取 course_config 的 key
        // 需要先设置好 $this->OJ_MODE 和 $this->OJ_STATUS
        return 'status_' . $this->OJ_MODE . '_' . $this->OJ_STATUS;
    }
    
    /**
     * 根据 OJ_MODE 和 OJ_STATUS 获取对应的 course_config
     * @param string $course_key 课程键名
     * @param mixed $course_config 课程配置（可选，如果不提供则从缓存或数据库读取）
     * @return array|null 课程配置数组
     */
    protected function MakeCourseConfig($course_key, $course_config=null)
    {
        // 如果提供了 course_config，直接使用
        if($course_config !== null) {
            // course_config 可能是字符串或数组
            if (is_string($course_config)) {
                $course_config = json_decode($course_config, true);
            }
            $key = $this->CourseConfigKey();
            if (is_array($course_config) && array_key_exists($key, $course_config)) {
                return $course_config[$key];
            }
            return null;
        }
        
        // 如果没有提供，从缓存或数据库获取
        $courseInfo = $this->GetCourseInfo($course_key, true); // 允许查看已禁用的课程
        if (!$courseInfo) {
            return null;
        }
        
        $course_config = $courseInfo['course_config'];
        try {
            if (is_string($course_config)) {
                $course_config = json_decode($course_config, true);
            }
            $key = $this->CourseConfigKey();
            if (is_array($course_config) && array_key_exists($key, $course_config)) {
                return $course_config[$key];
            }
            return null;
        } catch (\Exception $e) {
            return null;
        }
    }
    
    // ========================================================================
    // 课程跳转和验证相关方法（Course Redirect & Validation）
    // ========================================================================
    
    /**
     * 根据登录状态生成课程组跳转 URL
     * @param string $course_key 目标课程组键名
     * @param string $cur_url 当前 URL
     * @return string 跳转 URL
     */
    protected function getCourseRedirectUrl($course_key, $cur_url)
    {
        // 如果用户已登录，使用 CourseReUrl 生成跳转 URL
        if (IsLogin()) {
            return CourseReUrl($course_key, $cur_url);
        }
        // 如果用户未登录，跳转到 exindex
        return '/exindex';
    }
    
    /**
     * 验证资源是否属于当前课程组
     * @param array $item 资源项（必须包含标识字段，如 contest_id、problem_id、news_id 等）
     * @param string $itemType 资源类型（如 'contest', 'problem', 'news', 'ex_question'），如果不提供则尝试从 item 中推断
     */
    protected function CourseBelongValidate($item, $itemType = '') {
        // 如果没有 NOW_COURSE_ID，跳过验证（兼容旧逻辑）
        if(!$this->NOW_COURSE_ID) {
            // 兼容旧逻辑：使用 course_key 验证
            if(isset($item['course_key'])) {
                if($item['course_key'] == '') {
                    $this->error("目标资源未关联课程组");
                }
                if($item['course_key'] != $this->NOW_COURSE_KEY) {
                    $this->error('将跳转至课程组 [' . $item['course_key'] . '] ', $this->getCourseRedirectUrl($item['course_key'], $this->request->url(true)), '', 1);
                }
            }
            return;
        }
        
        // 推断资源类型和ID字段
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
            } else if(isset($item['clss_id'])) {
                // clss 表仍然使用 course_key，不通过 course_item 表
                if(isset($item['course_key'])) {
                    if($item['course_key'] == '') {
                        $this->error("目标资源未关联课程组");
                    }
                    if($item['course_key'] != $this->NOW_COURSE_KEY) {
                        $this->error('将跳转至课程组 [' . $item['course_key'] . '] ', $this->getCourseRedirectUrl($item['course_key'], $this->request->url(true)), '', 1);
                    }
                }
                return;
            } else {
                // 无法推断，使用旧逻辑
                if(isset($item['course_key'])) {
                    if($item['course_key'] == '') {
                        $this->error("目标资源未关联课程组");
                    }
                    if($item['course_key'] != $this->NOW_COURSE_KEY) {
                        $this->error('将跳转至课程组 [' . $item['course_key'] . '] ', $this->getCourseRedirectUrl($item['course_key'], $this->request->url(true)), '', 1);
                    }
                }
                return;
            }
        } else {
            // 根据 itemType 获取 itemId
            $idFieldMap = [
                'contest' => 'contest_id',
                'problem' => 'problem_id',
                'news' => 'news_id',
                'ex_question' => 'ex_question_id'
            ];
            if(!isset($idFieldMap[$itemType]) || !isset($item[$idFieldMap[$itemType]])) {
                $this->error("无法验证资源归属：缺少必要的ID字段");
            }
            $itemId = $item[$idFieldMap[$itemType]];
        }
        
        // 使用 course_item 表验证
        $courseItem = db('course_item')->where([
            'course_id' => $this->NOW_COURSE_ID,
            'item' => $itemType,
            'item_id' => $itemId,
        ])
        // 兼容历史数据：pvrole 可能是 NULL 或空字符串（新插入统一为 ''）
        ->where(function($q) {
            $q->whereNull('pvrole')->whereOr('pvrole', '');
        })
        ->find();
        
        if(!$courseItem) {
            // 如果 course_item 表中没有记录，尝试从 course_key 获取 course_id（使用缓存方法）
            if(isset($item['course_key']) && $item['course_key'] != '') {
                $targetCourseId = $this->GetCourseId($item['course_key']);
                if($targetCourseId && $targetCourseId != $this->NOW_COURSE_ID) {
                    $this->error('将跳转至课程组 [' . $item['course_key'] . '] ', $this->getCourseRedirectUrl($item['course_key'], $this->request->url(true)), '', 1);
                }
            } else {
                $this->error("目标资源未关联课程组");
            }
        }
    }
    
    /**
     * 确认当前的 course_key，存入 session
     * 如果 course_key 发生变化，根据登录状态决定跳转
     */
    protected function ConfirmCourseKey()
    {
        // 记录之前的 course_key
        $old_course_key = session('?now_course_key') ? session('now_course_key') : null;
        
        // 确定当前的 course_key，存入 session('now_course_key')
        if(input('?get.now_course_key')) {
            $new_course_key = strtoupper(input('get.now_course_key/s'));
            session('now_course_key', $new_course_key);
            cookie('now_course_key', $new_course_key);
            
            // 如果 course_key 发生变化，根据登录状态决定跳转
            if($old_course_key !== null && $old_course_key !== $new_course_key) {
                // course_key 变化了，需要跳转
                $redirectUrl = $this->getCourseRedirectUrl($new_course_key, $this->request->url(true));
                // 如果未登录，跳转到 /exindex
                if (!IsLogin()) {
                    $this->redirect('/exindex');
                } else {
                    // 已登录，使用 CourseReUrl 生成的 URL
                    $this->redirect($redirectUrl);
                }
            }
        }
        if(!session('?now_course_key')) {
            if(cookie('?now_course_key')) {
                try {
                    session('now_course_key', strtoupper(cookie('now_course_key')));
                } catch (\Exception $e) {
                    session('now_course_key', 'DEFAULT');
                    cookie('now_course_key', 'DEFAULT');
                }
            } else {
                session('now_course_key', 'DEFAULT');
            }
        }
    }
    
    /**
     * 初始化当前课程信息
     * 确保 NOW_COURSE_KEY 在所有情况下都能被正确设置
     */
    protected function InitCourseNow()
    {
        // 获取当前课程信息
        $this->ConfirmCourseKey();
        $this->OJ_COURSE_NOW = [
            'course_title'  =>  '-未选择课程-',
            'course_unit'   =>  '',
            'course_config' =>  null
        ];
        $now_course_key = session('now_course_key');
        if(empty($now_course_key)) {
            $now_course_key = 'DEFAULT';
        }
        
        // 最后统一设置 NOW_COURSE_KEY（参考旧代码逻辑，在所有检查和错误处理之后）
        $this->NOW_COURSE_KEY = strtoupper($now_course_key);
        
        if($now_course_key != 'DEFAULT') {
            // 使用缓存方法获取课程完整信息（一次性获取，避免多次查询）
            $isAdmin = IsAdmin('super_admin') || IsAdmin('administrator');
            $courseInfo = $this->GetCourseInfo($now_course_key, $isAdmin);
            
            if($courseInfo) {
                // 设置课程ID
                $this->NOW_COURSE_ID = $courseInfo['course_id'];
                
                // 设置课程信息（使用缓存的配置）
                $cache_key = $now_course_key . '_' . $this->CourseConfigKey();
                $course_now = \think\facade\Cache::remember('course_now_' . $cache_key, function() use ($now_course_key, $courseInfo) {
                    return [
                        'course_title'  => $courseInfo['course_title'],
                        'course_unit'   => $courseInfo['course_unit'] ?? '',
                        'course_config' => $this->MakeCourseConfig($now_course_key, $courseInfo['course_config']),
                    ];
                }, 300); // 缓存5分钟
                
                $this->OJ_COURSE_NOW = $course_now;
            } else {
                // 课程不存在时，先清除session中的无效课程键，避免无限循环
                session('now_course_key', 'DEFAULT');
                cookie('now_course_key', 'DEFAULT');
                $this->NOW_COURSE_ID = null;
                // 直接重定向到课程选择页面，不携带任何课程参数，避免循环
                $this->redirect('/course');
                return;
            }
        } else {
            $this->NOW_COURSE_ID = null;
        }
        
        $this->assign('NOW_COURSE_KEY', $this->NOW_COURSE_KEY);
        $this->assign('NOW_COURSE_ID', $this->NOW_COURSE_ID);
        $this->assign('OJ_COURSE_NOW', $this->OJ_COURSE_NOW);
    }
    
    /**
     * 检查课程选择状态
     * 如果课程未选择且需要课程，则重定向到课程选择页面
     * 注意：严格的课程检查已在 routeGuard() 中完成，这里主要用于兼容性检查
     */
    protected function checkCourseSelection()
    {
        // 检查白名单：无条件放通的路由（course模块、exadmin模块、初始化向导等）
        if ($this->isWhitelistedRoute('course_selection')) {
            return;
        }
        
        // 如果 OJ_STATUS=exp，严格的检查已在 routeGuard() 中完成
        // 这里保留作为额外的兼容性检查（主要用于旧逻辑兼容）
        if($this->OJ_STATUS == 'exp') {
            // 如果课程未选择，且不是登录/登出操作，且不是 ojtool/admin/exadmin 模块，且不是管理员
            // 注意：须用括号包住「课程未选」条件；否则 && 与 || 优先级会导致大管理员仍被重定向到 /course
            if (!(IsAdmin('super_admin') || IsAdmin('administrator')) &&
                (empty($this->NOW_COURSE_KEY) ||
                $this->NOW_COURSE_KEY == 'DEFAULT' ||
                empty($this->NOW_COURSE_ID))) {
                // 检查是否已经在重定向过程中，避免死循环
                $currentUrl = $this->request->url(true);
                if(strpos($currentUrl, '/course') === false) {
                    $this->redirect("/course");
                }
            }
        }
    }
}