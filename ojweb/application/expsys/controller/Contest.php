<?php
namespace app\expsys\controller;
require_once(__DIR__ . "/../../common/traits/ContestExpTrait.php");
use app\common\traits\ContestExpTrait;
use app\common\traits\ContestActionTrait;

class Contest extends Expsysbase
{
    use ContestExpTrait;  // ContestExpTrait 已包含 ContestBaseTrait
    use ContestActionTrait;
    
    var $isAdmin;
    var $is_assis;  // 助教身份
    // 课程教师（非本班教师）只读访问：用于策略输出/模板展示（真正鉴权由 contestPolicy enforce）
    var $isCourseTeacherReadonly = false;
    var $user_id;
    var $clss_query_field;
    var $clss_default_map;
    
    public function index()
    {
        $this->assign('current_time', microtime(true));
        return $this->fetch();
    }
    
    public function initialize() {
        parent::initialize();
        $this->ContestInit();
        // 练习系统特有的初始化（在 ContestInit 之后）
        // expsys 是练习模式，不需要 ContestInitExp（不使用 cpc_team）
        // OJ_STATUS/OJ_MODE 检查已由统一的路由守卫系统处理
        $this->ExpInit();
    }

    // 查重权限逻辑已收敛到 StatusAjaxTrait::isStatusAjaxSimilarEnabled()
    // 比赛内的额外放行（比赛管理员/课程教师）由 ContestBaseTrait::statusAjaxSimilarExtraPermission() 提供
    
    /**
     * expsys 特有的初始化
     * 练习模式，使用 clss（班级）和普通 users 表
     */
    public function ExpInit() {
        // expsys：管理员判定 = 全局管理员 或 当前课程的 admin（已包含 super）
        // 注意：PrivCourse('admin') 已包含 super 权限的检查
        $this->isAdmin = IsAdmin() || PrivCourse('admin', $this->NOW_COURSE_KEY);
        $this->assign('isAdmin', $this->isAdmin);
        
        // 初始化班级相关变量
        if(!session('?user_id')) {
            $this->error("请先登录", '/', null, 1);
        }
        $this->user_id = session('user_id');
        $this->clss_query_field = [
            'clss_id clss_id',
            'clss_title title',
            'clss_year year',
            'clss_semester semester',
            'in_date'
        ];
        $this->clss_default_map = [
            'defunct'   => 'C',
            // 课程过滤改为 course_item(item='clss')，避免依赖 clss.course_key（course_key 可能会改名）
        ];
        $this->assign('contest_controller', 'contest');
        
        // 如果已获取比赛信息，初始化助教身份
        // 使用 PrivItem 函数检查用户是否有该班级的 ta 权限
        if(isset($this->contest) && isset($this->contest['clss_id'])) {
            $clss_id = $this->contest['clss_id'];
            $this->is_assis = PrivItem('clss', $clss_id, 'ta');
            $this->assign('is_assis', $this->is_assis);
        }
    }
    
    /**
     * 重写 CanJoin - 练习模式使用 PrivItem 函数检查学生权限
     * 检查用户是否有该 contest 所属班级的 student 或 ta 权限
     */
    public function CanJoin()
    {
        if(!isset($this->contest) || !isset($this->contest['clss_id'])) {
            return false;
        }
        
        if(!IsLogin()) {
            return false;
        }
        
        $clss_id = $this->contest['clss_id'];
        
        // 使用 PrivItem 函数检查用户是否有该班级的 student 或 ta 权限（使用数组参数，IN 查询更高效）
        return PrivItem('clss', $clss_id, ['student', 'ta']);
    }
    
    /**
     * 重写 IsContestAdmin - 练习模式检查班级教师权限
     *
     * 性能：与 ContestBaseTrait::IsContestAdmin 同义——单请求内
     * (contest_id + privilegeName) 结果不变，加请求级内存缓存以避免
     * IsAdmin / GetItemCourseKey / PrivCourse / IsContestTeacher 链式
     * file-cache + session 重复读取（曾在循环里成为热点）。
     */
    protected function IsContestAdmin($privilegeName = null)
    {
        if (!isset($this->contest['contest_id'])) {
            return false;
        }
        $__cidKey = strval($this->contest['contest_id']);
        $__privKey = $privilegeName === null ? '__null__' : strval($privilegeName);
        if (isset($this->__isContestAdminCache[$__cidKey][$__privKey])) {
            return $this->__isContestAdminCache[$__cidKey][$__privKey];
        }

        $isAdmin = IsAdmin('contest', $this->contest['contest_id']);
        $ret = false;
        if($isAdmin) {
            $ret = true;
        } else {
            $course_key = GetItemCourseKey($this->contest, 'contest');
            if($course_key && PrivCourse('admin', $course_key)) {
                $ret = true;
            } elseif ($this->IsContestTeacher()) {
                $ret = true;
            }
        }
        if (!isset($this->__isContestAdminCache[$__cidKey])) {
            $this->__isContestAdminCache[$__cidKey] = [];
        }
        $this->__isContestAdminCache[$__cidKey][$__privKey] = $ret;
        return $ret;
    }
    
    /**
     * 是否是练习所属班级的教师
     */
    protected function IsContestTeacher() {
        if(!isset($this->contest['clss_id'])) {
            return false;
        }
        return $this->IsContestTeacherForClss($this->contest['clss_id']);
    }
    
    /**
     * 检查指定班级ID是否是当前用户的教师班级
     * 使用 privilege_item 表查询（pvrole='teacher'）
     */
    protected function IsContestTeacherForClss($clss_id) {
        if(!$clss_id || !session('?user_id')) {
            return false;
        }
        // 从配置获取 pvrole 值
        $pvrole_teacher = GetPvroleConfig('clss_teacher', 'teacher');
        
        // 使用 privilege_item 表查询（pvrole='teacher'）
        $cache_time = config('CsgojConfig.OJ_PRIVILEGE_CACHE_TIME');
        $teacher_count = db('privilege_item')->where([
            'rightitem' => 'clss',
            'item_id' => $clss_id,
            'user_id' => session('user_id'),
            'pvrole' => $pvrole_teacher
        ])->cache($cache_time)->count();
        return $teacher_count > 0;
    }
    
    /**
     * 重写 SetAssignUser - 练习模式使用普通 users 表
     */
    public function SetAssignUser()
    {
        // expsys 是练习模式，使用普通的 users 表，不是 cpc_team
        if (session('?user_id')) {
            $this->contest_user = session('user_id');
            $this->contest_user_dbfull = $this->SolutionUser($this->contest_user, true);
            $this->assign('contest_user', $this->contest_user);
            $this->assign('login_teaminfo', session('login_user_info'));
        } else {
            $this->contest_user = null;
            $this->contest_user_dbfull = null;
            $this->assign('contest_user', $this->contest_user);
            $this->assign('login_teaminfo', null);
        }
    }
    
    /**
     * 重写 ContestAuthenticationBase - 练习模式允许助教在开始前看题
     */
    public function ContestAuthenticationBase()
    {
        // 课程教师互相可见：PrivCourse('teacher') 可查看本课程内任意练习（只读，不授予提交/写权限）
        $course_key = GetItemCourseKey($this->contest, 'contest');
        $is_course_teacher = ($course_key && $course_key !== 'DEFAULT') ? PrivCourse('teacher', $course_key) : false;
        // 课程 teacher 跨班只读：仅用于 policy 计算（teacher 权限不应低于 public；但不授予“参赛者/本班”能力）
        $this->isCourseTeacherReadonly = ($is_course_teacher && !$this->IsContestTeacher() && !$this->IsContestAdmin());

        if ($this->contest['defunct'] == '1' && !$this->IsContestAdmin() && !$is_course_teacher) {
            $this->error('You cannot open this contest.', null, '', 1);
        }
        if ($this->CanJoin() || $this->IsContestAdmin()) {
            $this->canJoin = true;
        }
        // 助教在开始前可以看题
        if ($this->contestStatus == -1 && isset($this->is_assis) && $this->is_assis && in_array($this->action, ['problemset', 'problem'])) {
            $this->canJoin = true;
        }
        if ($this->contestStatus == -1 && !$this->IsContestAdmin() && (!isset($this->is_assis) || !$this->is_assis)) {
            $action = strtolower($this->request->action());
            $preStartAllow = ['contest', 'contest_auth_ajax', 'contest_auth_passwordless_ajax', 'team_auth_type_ajax', 'contest_logout_ajax'];
            // 课程 teacher 跨班只读：开始前也允许看题（只读）
            if ($this->isCourseTeacherReadonly) {
                $preStartAllow = array_merge($preStartAllow, ['problemset', 'problem', 'problemset_ajax']);
            }
            if (!in_array($action, $preStartAllow, true)) {
                $this->redirect("contest?cid=" . $this->contest['contest_id']);
            }
        }
    }
    
    /**
     * 重写 ContestAuthentication - 练习模式
     */
    public function ContestAuthentication()
    {
        $this->ContestAuthenticationBase();

        // 统一的策略 enforce（集中化，减少散落 if/redirect）
        if ($this->enforceContestAccessPolicy() === false) {
            return;
        }
    }

    /**
     * expsys 覆写：课程 teacher 跨班只读仅看题（+必要 ajax），不授予“参赛者/本班”能力
     * - teacher 权限不能低于 public，因此 rank 仍按公共策略放开
     */
    protected function getContestAccessPolicy()
    {
        // 注意：这里不能用 parent::（parent 是 Expsysbase），要用 trait 别名调用 ContestBaseTrait 的默认实现
        $policy = $this->baseGetContestAccessPolicy();

        // 课程 teacher 跨班只读：仅增加“看题”能力，禁用 status/message/topic
        if ($this->isCourseTeacherReadonly) {
            $policy['canViewProblems'] = true;
            $policy['canViewStatus'] = false;
            $policy['canUseMessage'] = false;
            $policy['canUseClarification'] = false;
            $policy['meta']['isCourseTeacherReadonly'] = true;
        } else {
            $policy['meta']['isCourseTeacherReadonly'] = false;
        }
        // 兼容旧模板变量（逐步迁移中）：仍可用 isCourseTeacherReadonly 做展示，但鉴权以 policy 为准
        $this->assign('isCourseTeacherReadonly', $this->isCourseTeacherReadonly);
        return $policy;
    }
    
    /**
     * 获取班级相关的练习列表（仅返回ID）
     * 使用基类的公共方法
     */
    public function GetClassRelated($only_id=true) {
        $clss_ids = $this->GetUserRelatedClssIds();
        
        if(empty($clss_ids)) {
            return [];
        }
        
        if($only_id) {
            return $clss_ids;
        } else {
            // 优化：如果 $clss_ids 为空，直接返回空数组，避免无效查询
            if(empty($clss_ids)) {
                return [];
            }
            // 使用 IN 查询（这里 clss_ids 已经通过 JOIN 获取，无法进一步优化）
            return db('clss')->where($this->clss_default_map)
                ->where('clss_id', 'in', $clss_ids)
                ->field($this->clss_query_field)
                // 显式指定缓存 Key，避免 cache(true) 在包含闭包/复杂 options 时无法生成 key
                ->cache('expsys:GetClassRelated:' . intval($this->NOW_COURSE_ID) . ':u:' . strval(session('user_id')), 10)
                ->select();
        }
    }
    
    /**
     * 练习列表
     * 使用多表联查优化性能，避免先查询班级ID列表再使用IN查询
     * 使用 EXISTS 子查询直接在 WHERE 条件中筛选，减少查询次数
     */
    public function contest_list_ajax() {
        $Contest = db('contest');
        $column = input('column/s');
        
        // ThinkPHP 5.1: cache(10) 等同于 cache(true,10)，若查询 options 含闭包(where(function...)) 将无法自动生成缓存Key
        // 因此这里必须显式指定缓存 Key（按课程/用户隔离，避免串数据）
        // 前台练习列表：所有用户统一只看与自己有关的班级的练习，缓存key不再区分管理员身份
        $cacheKeyBase = 'expsys:contest_list_ajax:' . intval($this->NOW_COURSE_ID) . ':u:' . strval(session('user_id'));
        
        // 构建基础查询
        $Contest->alias('c')
            ->join('clss cl', 'c.clss_id = cl.clss_id', 'inner');
        
        // 构建基础查询条件
        $map = [
            'c.defunct'   => '0',
            'cl.defunct'   => 'C'  // 班级未归档
        ];
        
        // 课程过滤（expsys 练习模式）：以 course_item(item='clss') 为准，避免依赖 clss.course_key（course_key 可能会改名）
        if ($this->NOW_COURSE_ID) {
            $Contest->join('course_item ci_clss', "ci_clss.item_id = cl.clss_id AND ci_clss.item = 'clss'", 'inner')
                ->where('ci_clss.course_id', $this->NOW_COURSE_ID)
                ->where(function($q) {
                    $q->whereNull('ci_clss.pvrole')->whereOr('ci_clss.pvrole', '');
                });
        }
        
        // 前台练习列表：所有用户（包括管理员）统一只看与自己有关的班级的练习
        // 使用 EXISTS 子查询优化性能，避免先查询ID列表再使用IN查询
        $user_id = session('user_id');
        // 使用 EXISTS 子查询：检查用户是否有该班级的权限（teacher/student/ta 等）
        $Contest->where($map)
            ->where('c.private', 'in', [4, 14])  // 练习类型：4=练习, 14=练习+附加题
            ->where(function ($q) {
                $q->whereNull('c.flg_archive')->whereOr('c.flg_archive', 0);
            })
            ->whereRaw('(
                EXISTS (
                    SELECT 1 FROM privilege_item pi
                    WHERE pi.rightitem = \'clss\'
                    AND pi.item_id = c.clss_id
                    AND pi.user_id = :user_id
                    AND pi.defunct = \'0\'
                )
            )', ['user_id' => $user_id]);
        
        // 如果只需要某一列，直接返回
        if($column != null) {
            return $Contest->order(['c.contest_id' => 'desc'])
                ->cache($cacheKeyBase . ':col:' . strval($column), 10)
                ->column('c.' . $column);
        }
        
        // 需要完整数据时，关联班级表获取班级信息（用于前端筛选）
        // 只查询前端需要的字段，减少查询负担
        $contest_list = $Contest->field([
                'c.contest_id',
                'c.title',
                'c.start_time',
                'c.end_time',
                'c.defunct',
                'c.private',
                'c.clss_id',
                'cl.clss_title clss_title',
                'cl.clss_year clss_year',
                'cl.clss_semester clss_semester'
            ])
            ->order(['c.contest_id' => 'desc'])
            ->cache($cacheKeyBase . ':list', 10)
            ->select();
        
        // 批量获取所有班级的教师列表（使用基类的公共方法）
        // 优化：直接传入 contest_list，避免先提取 clss_ids 再使用 IN 查询
        $teachers_map = $this->GetClssTeachersMapFromContests($contest_list);
        
        // 收集所有涉及的 user_id（用于构建 user_list）
        $user_ids = [];
        foreach($teachers_map as $clss_id => $teachers) {
            foreach($teachers as $teacher) {
                if(isset($teacher['user_id']) && !in_array($teacher['user_id'], $user_ids)) {
                    $user_ids[] = $teacher['user_id'];
                }
            }
        }
        
        // 批量获取用户信息（构建 user_list）
        $user_list = [];
        if(!empty($user_ids)) {
            $users = db('users')->where('user_id', 'in', $user_ids)
                ->field(['user_id', 'nick', 'school'])
                ->select();
            foreach($users as $user) {
                $user_list[$user['user_id']] = [
                    'user_id' => $user['user_id'],
                    'nick' => $user['nick'] ?: $user['user_id'],
                    'school' => $user['school'] ?: ''
                ];
            }
        }
        
        // 处理比赛信息，teachers 只存储 user_id 数组
        foreach($contest_list as &$contest) {
            $clss_id = $contest['clss_id'];
            // teachers 只存储 user_id 数组，不包含详细信息
            if(isset($teachers_map[$clss_id])) {
                $contest['teachers'] = array_column($teachers_map[$clss_id], 'user_id');
            } else {
                $contest['teachers'] = [];
            }
            
            // 标记是否有管理权限（用于前端显示）
            // 优化：批量检查教师权限，避免多次查询数据库
            $contest['is_admin'] = false;
            if($this->isAdmin) {
                $contest['is_admin'] = true;
            } elseif(isset($contest['clss_id'])) {
                // 检查是否是班级教师（使用缓存避免重复查询）
                static $teacher_clss_cache = [];
                $clss_id = $contest['clss_id'];
                if(!isset($teacher_clss_cache[$clss_id])) {
                    $teacher_clss_cache[$clss_id] = $this->IsContestTeacherForClss($clss_id);
                }
                $contest['is_admin'] = $teacher_clss_cache[$clss_id];
            }
        }
        
        // 从 contest 数据中提取去重的班级信息（避免额外查询）
        // clss_list 中的 teachers 只存储 user_id 数组
        $clss_list = $this->ExtractClssFromContests($contest_list);
        
        // 返回三份数据：contest_list, clss_list, user_list
        return [
            'contest_list' => $contest_list,
            'clss_list' => $clss_list,
            'user_list' => array_values($user_list)  // 转换为索引数组
        ];
    }
    
    /**
     * 检查是否可以查看代码信息
     */
    protected function IfCanSeeInfo($solution) {
        if(isset($solution) && $solution != null && isset($solution['user_id'])) {
            $solution['user_id'] = $this->SolutionUser($solution['user_id'], false);
        }
        if(!isset($solution['contest_id']) || $solution['contest_id'] != $this->contest['contest_id']) {
            return false;
        }
        if(IsAdmin('source_browser') || $this->IsContestAdmin() || $this->is_assis) {
            return true;
        }
        if(!isset($this->contest_user) || !$this->contest_user) {
            return false;
        }
        if($this->contest_user == $solution['user_id']) {
            return true;
        }
        return false;
    }
    
    /**
     * 重写 RankUserList - 练习模式使用普通 users 表
     */
    public function RankUserList($map, $with_star=true)
    {
        // expsys 是练习模式，使用普通 users 表（通过 privilege_item 表的 clss 权限查询学生）
        if(!isset($this->contest) || !isset($this->contest['clss_id']) || empty($this->contest['clss_id'])) {
            return [];
        }
        
        // 从配置获取学生角色的 pvrole 值
        $pvrole_student = GetPvroleConfig('clss_student', 'student');
        
        // 优化：使用 JOIN 直接查询，避免先查询 user_id_list 再使用 IN 查询
        $cache_time = config('CsgojConfig.OJ_PRIVILEGE_CACHE_TIME');
        return db('privilege_item')->alias('pi')
            ->join('users u', 'pi.user_id = u.user_id', 'inner')
            ->where([
                'pi.rightitem' => 'clss',
                'pi.item_id' => $this->contest['clss_id'],
                'pi.pvrole' => $pvrole_student
            ])
            ->field([
                'u.user_id user_id',
                'u.nick nick',
                'u.school school',
                'u.email tmember',
                '"" coach',
                '0 tkind'
            ])->cache($cache_time)->select();
        
        // 使用 fetchSql(true) 获取 SQL（不执行查询，只返回 SQL 字符串）
     
        
        // 如果需要执行查询并获取结果，使用以下代码：
        // $res = $query->select();
        // return $res;
    }
    
    /**
     * 重写 UserInfoUrl - 练习模式使用 user/userinfo
     */
    public function UserInfoUrl($user_id, $contest_id=0, $only_prefix=false, $sol_id=0)
    {
        $prefix = $only_prefix;
        // expsys 是练习模式，使用 user/userinfo
        if ($prefix)
            return '/expsys/user/userinfo?user_id=';
        else
            return '/expsys/user/userinfo?user_id=' . $user_id;
    }
    
    /**
     * 重写 SolutionUser - 练习模式不使用 #cpc 前缀
     */
    protected function SolutionUser($user_id, $appearprefix=null)
    {
        // expsys 是练习模式，使用普通 users 表，不需要前缀处理
        return $user_id;
    }
    
    // ProblemIdMap() 使用 ContestBaseTrait 中的默认实现（普通比赛逻辑，不使用 ex_question 表）
}
