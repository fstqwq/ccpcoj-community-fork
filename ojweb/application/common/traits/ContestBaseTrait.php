<?php
/**
 * 比赛系统基础 Trait
 * 提供比赛相关的通用方法，通过 $this->module 区分不同模块的行为
 * 用于 csgoj、cpcsys、expsys、examsys 等模块
 * 
 * ACM OJ 系统（csgoj、cpcsys、admin）使用此 trait，不包含任何 course 逻辑
 * exp 系统（expsys、examsys、exadmin）继承此 trait，并通过 ContestExpTrait 重载 hook 实现 course 筛选
 */
namespace app\common\traits;

use app\common\funcs\ContestAwardMath;
use app\common\funcs\ContestGroupId;
use app\common\funcs\ContestHeaderBanner;
use app\common\funcs\CsgOjWireInstant;
use app\common\funcs\CcpcRules;
use app\common\cross_module\contestlive\ContestliveDisplayAccess;

trait ContestBaseTrait
{
    // ========== 比赛系统通用变量 ==========
    var $contest;
    var $contestMeta;                   // contest 元信息（包含 group 配置）
    var $contestStatus;                 // -1表示未开始，1表示进行中，2表示已结束
    var $rankFrozen;                    // false表示正常，true表示封榜
    var $closeRankTime;                 // 封榜时间戳（int）
    var $frozenEndTime;                 // 封榜结束时间戳（int）
    var $outsideContestAction;          // Contest的比赛列表页和其对应的列表数据ajax页action名称
    var $allowPublicVisitAction;        // private比赛允许公开观看的页面，目前就是ranklist和对应的数据ajax页
    var $ojLang;                        // oj的允许编程语言表
    var $allowLanguage;                 // 比赛允许的编程语言，从contest的langmask读
    var $running;                       // 比赛是否正在进行，封榜没封榜都是true
    var $problemIdMap;                  // ['abc2id'=>//ABC->10xx题号映射, 'id2abc'=>//10xx->ABC题号映射, 'id2num'=>//10xx->0、1、2(num)]
    var $ojResults;                     // oj的所有判题结果
    var $ojResultsHtml;                 // 判题结果的显示方案
    var $allowResults;                  // statistic统计的判题结果
    var $canJoin;                       // 参赛权限
    var $needAuth;                      // 比赛加了密码（目前只Public比赛密码生效）
    var $contest_user;                  // 登录这个比赛的用户
    var $contest_user_dbfull;           // 比赛内用户在 solution/topic 等表中的实际字符串
    var $contest_problem_list;          // 比赛的题目列表
    // 注意：$isAdmin 已在 Globalbasecontroller 中定义，无需重复定义
    var $isContestAdmin;
    var $rankUseCache;
    /**
     * IsContestAdmin 请求级缓存（按 contest_id|privilegeName）
     *
     * 性能问题与必要性：
     *   IsContestAdmin 内部串联调用 IsAdmin / GetItemCourseKey(ORM cache 60s) /
     *   PrivCourse / CourseTeacherContestCheck / PrivItem(owner) / PrivItem(manage)，
     *   且 ContestInit + 各 ajax 接口循环里会被高频调用（实测单接口 N 行 → 90+ 次调用，每次 ~22ms）。
     *   单次请求内此结果是恒定的（contest_id + privilegeName + 当前用户三元组不变），
     *   因此在 controller 实例上做内存缓存可消除整批 file IO + session 多读。
     *
     * 注意：仅在请求生命周期内有效；新请求会重新构建实例，不会跨请求脏读。
     */
    protected $__isContestAdminCache = [];
    // TP5.1：统一使用“二维条件数组”形式，避免 ['field'=>['<>',...]] 这种 TP5.0 风格写法
    var $topicDefaultMap = [['public_show', '<>', -1]];               // topic 的默认过滤逻辑
    
    // ========== CPC 系统相关变量（cpcsys、examsys 使用，expsys 部分使用） ==========
    var $teamSessionName;       // team 的 session 字段名
    var $watcherUser;
    var $balloonManager;
    var $balloonSender;
    var $printManager;
    var $isReviewer;
    var $proctorAdmin = false;
    var $isContestStaff = false;
    var $isContestWorker = false;
    /** 仅按比赛内账号身份（cpc_team.privilege）是否为工作人员，不掺入系统管理员权限，用于 standard 提交等逻辑 */
    var $isContestAccountStaff = false;

    /**
     * 计算比赛应落在的目标模块。
     * @param int $contestType contest.private % 10
     * @return string
     */
    protected function ResolveContestTargetModule($contestType)
    {
        $contestType = intval($contestType);
        if ($contestType === 2) {
            return 'cpcsys';
        }
        if ($contestType === 4) {
            return 'expsys';
        }
        if ($contestType === 5) {
            $oj_mode = isset($this->OJ_MODE) ? $this->OJ_MODE : GetOjMode();
            return $oj_mode === 'cpcsys' ? 'examsys' : 'expsys';
        }
        return 'csgoj';
    }

    /**
     * 构建跨模块重定向 URL，保留当前全部查询参数并覆盖 cid。
     * 说明：
     * - 统一在这里做参数兼容，避免各分支手写 ?cid=... 导致参数丢失。
     * - 仅处理 query string；hash 由前端维护，服务端无法感知。
     *
     * @param string $targetModule 目标模块
     * @param int $contestId 比赛ID
     * @return string
     */
    protected function BuildContestCrossModuleUrl($targetModule, $contestId)
    {
        $targetModule = strval($targetModule);
        $contestId = intval($contestId);
        $controller = strval($this->controller);
        $action = strval($this->request->action());

        $query = $this->request->get();
        if (!is_array($query)) {
            $query = [];
        }
        $query['cid'] = $contestId;
        // 过滤空 key，避免异常 query 结构污染 URL
        foreach ($query as $k => $v) {
            if ($k === null || $k === '') {
                unset($query[$k]);
            }
        }
        $qs = http_build_query($query);
        $base = '/' . $targetModule . '/' . $controller . '/' . $action;
        return $qs === '' ? $base : ($base . '?' . $qs);
    }

    /**
     * 归档比赛禁止写入业务数据（赛内提交/澄清等；评测机侧见 Judge2::getpending）。
     */
    protected function assertContestNotArchivedForWrite()
    {
        if (!isset($this->contest['flg_archive']) || intval($this->contest['flg_archive']) === 0) {
            return;
        }
        // online-exp 班级练习：flg_archive 表示「练习模板」，不是 CPC 归档禁写
        if (isset($this->OJ_MODE, $this->OJ_STATUS) && $this->OJ_MODE === 'online' && $this->OJ_STATUS === 'exp'
            && isset($this->contest['private'])) {
            $p = intval($this->contest['private']) % 10;
            if ($p === 4 || $p === 14) {
                return;
            }
        }
        // contest_write_blocked：前端可特判（如徽标上传区双语提示）；值 archived 表示 flg_archive 禁写
        $this->errorBilingual(
            '比赛已归档，禁止此操作',
            'Contest is archived; this operation is disabled.',
            null,
            ['contest_write_blocked' => 'archived']
        );
    }

    // ========== Hook 方法（ACM OJ 返回空，exp 系统重载实现 course 筛选） ==========
    
    /**
     * 钩子方法：获取查询过滤条件
     * ACM OJ 返回 null（不使用 course_item 过滤）
     * exp 系统重载此方法返回 course_item 联查配置
     * @param string $tableName 表名
     * @return array|null 返回联查配置数组 ['join' => ..., 'where' => ...] 或 null（不使用联查）
     */
    protected function getQueryFilter($tableName = '')
    {
        // ACM OJ 系统：不进行 course 筛选
        return null;
    }
    
    /**
     * 钩子方法：自动应用查询过滤条件到查询对象
     * ACM OJ 直接应用 $map
     * exp 系统重载此方法应用 course_item 联查
     * @param \think\db\Query $query 查询对象
     * @param array $map 现有的查询条件
     * @param string $tableName 表名
     * @return \think\db\Query 处理后的查询对象
     */
    protected function applyQueryFilterToQuery($query, $map, $tableName = '')
    {
        // ACM OJ 系统：直接应用 $map
        $query->where($map);
        return $query;
    }
    
    /**
     * 钩子方法：在插入数据前添加额外字段
     * ACM OJ 返回原数据
     * exp 系统重载此方法注入 course_key 等字段
     * @param array $data 要插入的数据
     * @param string $tableName 表名
     * @return array 处理后的数据
     */
    protected function prepareInsertData($data, $tableName = '')
    {
        // ACM OJ 系统：返回原数据
        return $data;
    }
    
    /**
     * 钩子方法：在插入数据后添加 course_item 映射
     * ACM OJ 为空操作
     * exp 系统重载此方法插入 course_item 映射
     * @param array $data 插入的数据
     * @param string $tableName 表名
     * @param int $insertId 插入后返回的ID
     * @return void
     */
    protected function afterInsertData($data, $tableName = '', $insertId = null)
    {
        // ACM OJ 系统：空操作
    }
    
    /**
     * 钩子方法：在更新数据前添加额外字段（如果需要）
     * ACM OJ 返回原数据
     * exp 系统重载此方法注入额外字段
     * @param array $data 要更新的数据
     * @param string $tableName 表名
     * @return array 处理后的数据
     */
    protected function prepareUpdateData($data, $tableName = '')
    {
        // ACM OJ 系统：返回原数据
        return $data;
    }
    
    /**
     * 钩子方法：验证资源归属（用于验证 course_key 等）
     * ACM OJ 为空操作
     * exp 系统重载此方法验证 course_key
     * @param array $item 资源数据
     * @param string $itemType 资源类型
     * @return void
     */
    protected function validateItemBelong($item, $itemType = '')
    {
        // ACM OJ 系统：空操作
    }

    // =====================================================================
    // Contest Access Policy（鉴权策略）——减少 exp/cpc 耦合的“集中化最佳实践”
    // ---------------------------------------------------------------------
    // 设计目标：
    // - 控制器/trait 负责“算策略 + enforce”，模板只读 contestPolicy 做展示
    // - 尽量不在模板/JS 里写 module/OJ_STATUS 分支，避免模式耦合扩散
    // - exp / cpc 的差异通过 override getContestAccessPolicy() 或 hook 扩展
    //
    // 约定：
    // - policy 只描述“能力”(capabilities)，不直接描述业务角色
    // - canJoin 仍保留为“参赛/参与权限”的旧变量，但真正的访问控制以 policy 为准
    // =====================================================================

    /**
     * 生成 contest 访问策略（默认实现：保持与旧逻辑一致）
     *
     * 子类/exp trait 可覆写本方法，收敛“差异化鉴权需求”到一个地方。
     *
     * @return array<string,mixed>
     */
    protected function getContestAccessPolicy()
    {
        // 注意：这里不要做复杂的 module 分支；需要差异时请覆写本方法
        $isContestAdmin = $this->IsContestAdmin();
        $canJoin = (bool)$this->canJoin;

        $cidPolicy = isset($this->contest['contest_id']) ? intval($this->contest['contest_id']) : 0;
        $canLiveConsole = false;
        if ($cidPolicy > 0) {
            $canLiveConsole = IsAdmin('administrator')
                || IsAdmin('contest', $cidPolicy)
                || $this->IsContestAdmin()
                || $this->IsContestAdmin('watcher');
        }
        $canCcsApi = (strval($this->module) === 'cpcsys')
            && isset($this->contest['contest_id'])
            && (bool) ($this->isContestAdmin ?? false);

        $policy = [
            // 题目列表/题面/题目列表 ajax
            'canViewProblems' => ($canJoin || $isContestAdmin),
            // 榜单/榜单 ajax（默认至少不低于 allowPublicVisitAction 的公开能力）
            'canViewRank' => true,
            // 状态页及其 ajax
            'canViewStatus' => ($canJoin || $isContestAdmin),
            // 比赛内通知/消息（参赛者）
            'canUseMessage' => ($canJoin && !$isContestAdmin),
            // 比赛内答疑/讨论（clarification/topic）
            'canUseClarification' => ($canJoin || $isContestAdmin),
            // contest 内“登出”按钮（仅 cpc_team 模式需要：cpcsys/examsys）
            'showContestLogoutButton' => in_array($this->module, ['cpcsys', 'examsys'], true),
            // 前台比赛页：直播控制台（与赛内 watcher / 赛管一致）
            'canAccessLiveConsole' => $canLiveConsole,
            // CPC 标准赛：CCS API 说明台（与原 admin/ccs_api_console 一致，仅 isContestAdmin 属性）
            'canUseCcsApiConsole' => $canCcsApi,
        ];

        // 给模板/调试用的扩展字段（默认为空）
        $policy['meta'] = [
            'module' => $this->module,
        ];
        return $policy;
    }

    /**
     * 是否可访问前台直播控制台（/contest/contest_live）及 ojtool 控台写接口。
     * 与 getContestAccessPolicy()['canAccessLiveConsole']、contest_header「播」菜单一致。
     */
    protected function hasContestLiveConsoleAccess()
    {
        $policy = $this->getContestAccessPolicy();
        return !empty($policy['canAccessLiveConsole']);
    }

    /**
     * 系统级本场赛管（privilege_item contest admin），可队伍/赛务批量生成等。
     * 赛内 cpc_team.privilege=admin 不等同于此项。
     */
    protected function isContestSysAdminForContest($contest = null)
    {
        if ($contest === null) {
            $contest = $this->contest ?? null;
        }
        if (!$contest || !isset($contest['contest_id'])) {
            return false;
        }
        return (bool) IsAdmin('contest', intval($contest['contest_id']));
    }

    /**
     * 是否按 cpc_team 赛内会话（#cpcteam{cid}）解析 privilege。
     * cpcsys / examsys 全场；ojtool 仅 contestlive（与 ContestInit 中 teamSessionName 约定一致）。
     */
    protected function contestResolvesCpcTeamPrivilege()
    {
        if (in_array($this->module, ['cpcsys', 'examsys'], true)) {
            return true;
        }
        return $this->module === 'ojtool'
            && strtolower((string) $this->controller) === 'contestlive';
    }

    /**
     * 与本站 ojtool/contestlive 签发之 lvtk 一致，用于榜单等只读页在「比赛未开始」时仍可被投屏打开。
     */
    protected function EvaluateContestliveDisplayToken()
    {
        if (!isset($this->contest['contest_id'])) {
            return false;
        }
        $lvtk = input('lvtk/s', '');
        if ($lvtk === '') {
            return false;
        }
        return ContestliveDisplayAccess::validateToken(intval($this->contest['contest_id']), $lvtk);
    }

    /**
     * @param string $action
     */
    protected function IsContestliveDisplayRankishAction($action)
    {
        return in_array(strtolower((string) $action), [
            'rank',
            'ranklist_ajax',
            'scorerank',
            'scorerank_ajax',
            'schoolrank',
            'schoolrank_ajax',
            'team_display',
        ], true);
    }

    /**
     * action -> capability 映射（集中管理）
     * @return array<string,string>
     */
    protected function contestActionCapabilityMap()
    {
        return [
            // problems
            'problemset' => 'canViewProblems',
            'problemset_ajax' => 'canViewProblems',
            'problem' => 'canViewProblems',

            // rank
            'rank' => 'canViewRank',
            'ranklist_ajax' => 'canViewRank',
            'scorerank' => 'canViewRank',
            'scorerank_ajax' => 'canViewRank',
            'schoolrank' => 'canViewRank',
            'schoolrank_ajax' => 'canViewRank',
            'contest_data_ajax' => 'canViewRank',
            'my_solve_ajax' => 'canViewProblems',
            'team_display' => 'canViewRank',

            // status
            'status' => 'canViewStatus',
            'status_ajax' => 'canViewStatus',
            'single_status_ajax' => 'canViewStatus',
            'status_code_compare' => 'canViewStatus',

            // message
            'msg' => 'canUseMessage',
            'msg_list_ajax' => 'canUseMessage',

            // clarification/topic
            'topic_num_ajax' => 'canUseClarification',
            'topic_list' => 'canUseClarification',
            'topic_list_ajax' => 'canUseClarification',
            'topic_detail' => 'canUseClarification',
            'topic_reply_ajax' => 'canUseClarification',
            'topic_del_ajax' => 'canUseClarification',
            'topic_add' => 'canUseClarification',
            'topic_add_ajax' => 'canUseClarification',
            'topic_change_status_ajax' => 'canUseClarification',

            // live / CCS（前台 contest 控制器）
            'contest_live' => 'canAccessLiveConsole',
            'ccs_api_console' => 'canUseCcsApiConsole',
        ];
    }

    /**
     * 判断某个 action 是否可访问（以 policy 为准，兼容 allowPublicVisitAction）
     */
    protected function canAccessContestActionByPolicy($action, $policy)
    {
        $action = strtolower((string)$action);
        if (in_array($action, $this->allowPublicVisitAction, true)) {
            return true;
        }
        $map = $this->contestActionCapabilityMap();
        if (isset($map[$action])) {
            $cap = $map[$action];
            return !empty($policy[$cap]);
        }
        // 未在映射中：保持旧行为（需要参赛/管理员）
        return ($this->canJoin || $this->IsContestAdmin());
    }

    /**
     * 统一 enforce：不再在各 action 里散落 if/redirect
     * - 非 ajax：重定向到 contest 首页
     * - ajax：返回 error
     */
    protected function enforceContestAccessPolicy()
    {
        // 重要：contestPolicy 只约束“比赛前台（contest 控制器）”的页面/接口。
        // expsys/examsys 的小后台使用 admin 控制器（且 action 名可能与前台重名，例如 msg），
        // 若在这里强制策略会导致错误重定向（典型：/expsys/admin/msg 被当成前台 msg）。
        if (strtolower((string)$this->controller) !== 'contest') {
            return true;
        }
        $policy = $this->getContestAccessPolicy();
        $action = strtolower($this->request->action());
        if (!$this->canAccessContestActionByPolicy($action, $policy)) {
            if ($this->request->isAjax()) {
                $this->error('Permission denied');
            } else {
                $this->redirect("contest?cid=" . $this->contest['contest_id']);
            }
            return false;
        }
        return true;
    }
    
    // ========== 比赛初始化 ==========
    
    /**
     * 比赛初始化
     * 根据 $this->module 区分不同模块的行为
     */
    public function ContestInit()
    {
        $this->assign('pagetitle', 'Contest');
        
        // 根据模块设置不同的 outsideContestAction
        // contest_data_ajax 需要 cid 参数，但应该在方法内部处理，不在这里调用 GetContestInfo()
        if(in_array($this->module, ['cpcsys'])) {
            $this->outsideContestAction = ['index', 'contest_list_ajax', 'contest_collect_team_ajax', 'contest_data_ajax'];
        } else {
            $this->outsideContestAction = ['index', 'contest_list_ajax', 'contest_data_ajax'];
        }
        
        // 根据模块设置不同的 allowPublicVisitAction
        if(in_array($this->module, ['cpcsys'])) {
            $this->allowPublicVisitAction = ['contest_login', 'rank', 'ranklist_ajax', 'scorerank', 'scorerank_ajax', 'schoolrank', 'schoolrank_ajax', 'contest', 'contest_auth_ajax', 'contest_auth_passwordless_ajax', 'team_auth_type_ajax', 'contest_data_ajax', 'team_display'];
        } else {
            $this->allowPublicVisitAction = ['rank', 'ranklist_ajax', 'scorerank', 'scorerank_ajax', 'schoolrank', 'schoolrank_ajax', 'contest', 'contest_auth_ajax', 'contest_auth_passwordless_ajax', 'team_auth_type_ajax', 'contest_data_ajax'];
        }
        
        $this->ojLang = config('CsgojConfig.OJ_LANGUAGE');
        $color = config('CsgojConfig.OJ_LANGUAGE_COLOR');
        $this->ojLanguageColor = is_array($color) ? $color : [];
        $this->ojResults = config('CsgojConfig.OJ_RESULTS');
        $this->ojResultsHtml = config('CsgojConfig.OJ_RESULTS_HTML');
        $this->allowLanguage = $this->ojLang;
        $this->running = false;
        $this->canJoin = false;
        $this->allowResults = [4, 5, 6, 7, 8, 9, 10, 11];
        $this->needAuth = false;
        $this->contest_user = null;
        $this->contest_user_dbfull = null;
        $this->isAdmin = IsAdmin();
        $this->isContestAdmin = false;
        
        // 判断是否需要获取比赛信息
        $needGetContestInfo = false;
        // admin 和 contestadmin controller 总是需要获取比赛信息（因为它们需要 cid 参数）
        if($this->controller == 'admin') {
            $needGetContestInfo = true;
        } else if(in_array($this->module, ['cpcsys'])) {
            $needGetContestInfo = ($this->controller == 'contest' && !in_array($this->request->action(), $this->outsideContestAction));
        } else {
            $needGetContestInfo = !in_array($this->request->action(), $this->outsideContestAction);
        }
        
        if($needGetContestInfo) {
            $this->GetContestInfo();
            
            // 对于 examsys/expsys 模块，需要先设置 teamSessionName（在 ContestAuthentication 之前）
            // 因为 ContestAuthentication 中的 CanJoin() 依赖于 GetSession()，而 GetSession() 依赖于 teamSessionName
            if(in_array($this->module, ['examsys', 'expsys']) && isset($this->contest) && isset($this->contest['contest_id'])) {
                $this->teamSessionName = '#cpcteam' . $this->contest['contest_id'];
            }
            // cpcsys：比赛内账号会话；ojtool/contestlive：投播页需在 ojtool 模块下解析 watcher 等职能身份
            if(
                (in_array($this->module, ['cpcsys']) || ($this->module === 'ojtool' && strtolower($this->controller) === 'contestlive'))
                && isset($this->contest) && isset($this->contest['contest_id'])
            ) {
                $this->teamSessionName = '#cpcteam' . $this->contest['contest_id'];
            }
            
            // 计算 rankUseCache（cpcsys 有特殊逻辑）
            if(in_array($this->module, ['cpcsys'])) {
                $this->rankUseCache = !$this->IsContestAdmin('admin') && !$this->IsContestAdmin('balloon_manager') && !$this->IsContestAdmin('balloon_sender') && !$this->IsContestAdmin('watcher') ? 1 : 0;
                $this->isContestAdmin = $this->IsContestAdmin('admin');
            } else {
                $this->rankUseCache = !$this->IsContestAdmin() ? 1 : 0;
                $this->isContestAdmin = $this->IsContestAdmin();
            }
            $this->GetVars();
            $this->ContestAuthentication();
            $this->SetAssign();
            
            // CPC 系统特有的额外初始化（仅 cpcsys 模块）
            if(in_array($this->module, ['cpcsys'])) {
                $this->ContestInitCpcExtra();
            }
        }
        
        // 设置 contest_controller
        // expsys 已独立为独立模块，private % 10 == 4 的练习应使用 expsys/contest
        // private % 10 == 5 的考试应使用 examsys/contest
        if ($this->module == 'expsys') {
            $this->assign('contest_controller', 'contest');
        } else if ($this->module == 'examsys') {
            $this->assign('contest_controller', 'contest');
        } else {
            $this->assign('contest_controller', 'contest');
        }
    }
    
    /**
     * 获取比赛信息并进行模块跳转检查
     * 根据比赛的 private 类型和 OJ_MODE 决定应该使用哪个模块
     */
    public function GetContestInfo()
    {
        $cid = input('cid/d');
        if (!$cid) {
            $this->error('How did you find this page?', null, '', 1);
        }
        $meta = $this->GetContestMeta(intval($cid), true);
        if (!$meta || !isset($meta['contest'])) {
            $this->error("No such contest");
        }
        $this->contestMeta = $meta;
        $this->contest = $meta['contest'];
        
        // // 合并 contest_md 表中的数据（Markdown 格式）
        // // 注意：contest 表中的 description 和 notification 是 HTML 格式（已编译）
        // // contest_md 表中的 description 和 notification 是 Markdown 格式（原始）
        // // 在编辑页面需要使用 Markdown 格式，在显示页面使用 HTML 格式
        // $contest_md = db('contest_md')->where('contest_id', $cid)->find();
        // if ($contest_md) {
        //     // 只在需要 Markdown 格式时合并（编辑页面）
        //     // 显示页面直接使用 contest 表中的 HTML 格式
        //     // 这里不合并，保持 contest 表中的 HTML 格式用于显示
        // }
        
        // contestlive 控制器不需要跳转检查
        if ($this->controller == 'contestlive') {
            return;
        }
        
        $contestType = intval($this->contest['private']) % 10;
        $targetModule = $this->ResolveContestTargetModule($contestType);
        if ($this->module !== $targetModule) {
            $redirectUrl = $this->BuildContestCrossModuleUrl($targetModule, intval($this->contest['contest_id']));
            $this->redirect($redirectUrl);
        }
    }

    /**
     * 获取比赛 group 配置列表（仅有效数据）
     * @param int $contest_id
     * @return array
     */
    protected function GetContestGroupList($contest_id)
    {
        $contest_id = intval($contest_id);
        if ($contest_id <= 0) {
            return [];
        }
        $rows = db('contest_group')
            ->where([
                'contest_id' => $contest_id,
                'defunct' => 'N',
            ])
            ->order('group_order', 'asc')
            ->field([
                'contest_id',
                'group_id',
                'group_name',
                'group_name_en',
                'group_order',
                'award_ratio_gold',
                'award_ratio_silver',
                'award_ratio_bronze',
                'flg_award_qty_mode',
                'topteam',
                'addition',
            ])
            ->select();
        if (is_array($rows) && count($rows) > 0) {
            return $rows;
        }
        $contest = db('contest')->where('contest_id', $contest_id)->find();
        if (!$contest) {
            return [];
        }
        $award_ratio = intval($contest['award_ratio'] ?? 0);
        $ratio_gold = $award_ratio % 1000;
        $award_ratio = intdiv($award_ratio, 1000);
        $ratio_silver = $award_ratio % 1000;
        $award_ratio = intdiv($award_ratio, 1000);
        $ratio_bronze = $award_ratio % 1000;
        return [[
            'contest_id' => $contest_id,
            'group_id' => 'default',
            'group_name' => '默认赛事',
            'group_name_en' => 'Default Event',
            'group_order' => 0,
            'award_ratio_gold' => $ratio_gold,
            'award_ratio_silver' => $ratio_silver,
            'award_ratio_bronze' => $ratio_bronze,
            'flg_award_qty_mode' => ContestAwardMath::normalizeQtyMode($contest['flg_award_qty_mode'] ?? 0),
            'topteam' => max(1, min(20, intval($contest['topteam'] ?? 1))),
            'addition' => null,
        ]];
    }

    /**
     * 获取比赛元信息（contest + contest_group + is_multi_group）
     * @param int $contest_id
     * @param bool $useCache
     * @return array|null
     */
    protected function GetContestMeta($contest_id, $useCache = true)
    {
        $contest_id = intval($contest_id);
        if ($contest_id <= 0) {
            return null;
        }
        $module = isset($this->module) ? strval($this->module) : 'unknown';
        $cacheKey = 'contest_meta_v2:' . $module . ':' . $contest_id;
        $cacheTTL = 10;
        if ($useCache) {
            $cached = cache($cacheKey, '', $cacheTTL);
            if (is_array($cached) && isset($cached['contest'])) {
                return $cached;
            }
        }

        $contest = db('contest')->where('contest_id', $contest_id)->find();
        if (!$contest) {
            return null;
        }
        $groupList = $this->GetContestGroupList($contest_id);
        $groupCount = count($groupList);
        $meta = [
            'contest' => $contest,
            'contest_group' => $groupList,
            'group_count' => $groupCount,
            'is_multi_group' => $groupCount > 1 ? 1 : 0,
        ];
        if ($useCache) {
            cache($cacheKey, $meta, $cacheTTL);
        }
        return $meta;
    }

    /**
     * 失效比赛元信息缓存
     * @param int $contest_id
     * @return void
     */
    protected function InvalidateContestMetaCache($contest_id)
    {
        $contest_id = intval($contest_id);
        if ($contest_id <= 0) {
            return;
        }
        $modules = ['cpcsys', 'csgoj', 'expsys', 'examsys', 'admin', 'exadmin', 'ojtool'];
        foreach ($modules as $m) {
            cache('contest_meta_v2:' . $m . ':' . $contest_id, null);
        }
    }
    
    /**
     * CPC 系统特有的额外初始化（仅 cpcsys 模块使用）
     */
    protected function ContestInitCpcExtra()
    {
        // 为contest_login.php模板准备变量
        $clientIp = GetRealIp();
        $this->assign('client_ip', $clientIp);
        
        // 查询该IP对应的client的team_id_bind
        $team_id_bind = null;
        if (!empty($clientIp)) {
            $client = db('cpc_client')->where([
                'contest_id' => $this->contest['contest_id'],
                'ip_bind' => $clientIp
            ])->find();
            
            if ($client && !empty($client['team_id_bind'])) {
                $team_id_bind = $client['team_id_bind'];
            }
        }
        $this->assign('team_id_bind', $team_id_bind);
        
        // 计算收集模式相关变量
        $addition = [];
        if (!empty($this->contest['addition'])) {
            $addition = Json2Array($this->contest['addition']);
            if (!$addition || !is_array($addition)) {
                $addition = [];
            }
        }
        $flg_collect_team_id = isset($addition['flg_collect_team_id']) ? intval($addition['flg_collect_team_id']) : 0;
        
        // 判断是否在比赛前10分钟
        $now = time();
        $startTime = strtotime($this->contest['start_time']);
        $timeDiff = $startTime - $now;
        $isBefore10Min = $timeDiff >= 600; // 600秒 = 10分钟
        
        // 判断是否是收集模式
        $isCollectMode = ($flg_collect_team_id == 1 && $isBefore10Min);
        
        $this->assign('flg_collect_team_id', $flg_collect_team_id);
        $this->assign('isCollectMode', $isCollectMode);

        // rank 首屏：服务端判定是否已有提交，避免有提交时先闪「队伍卡片」再切榜单
        $action = strtolower((string) $this->request->action());
        if ($action === 'rank') {
            $cid = intval($this->contest['contest_id']);
            $sid = $cid > 0 ? db('solution')->where('contest_id', $cid)->limit(1)->value('solution_id') : null;
            $hasSol = $sid !== null && $sid !== false && strval($sid) !== '';
            $this->assign('cpc_contest_has_solution', $hasSol);
            $pack = $this->fetchCpcTeamCardViewData();
            $this->assign('cpc_team_card_rows', $hasSol ? [] : $pack['rows']);
            $this->assign('cpc_contest_multi_group', $hasSol ? 0 : (int) $pack['is_multi_group']);
        }
    }

    /**
     * CPC 比赛「队伍卡片」数据：已填写队名的参赛账号、非工作人员账号；附分组标签（多分组赛时）。
     *
     * @return array{rows: array<int,array<string,mixed>>, is_multi_group: int}
     */
    protected function fetchCpcTeamCardViewData()
    {
        if ($this->module !== 'cpcsys' || !isset($this->contest['contest_id'])) {
            return ['rows' => [], 'is_multi_group' => 0];
        }
        $cid = intval($this->contest['contest_id']);
        if ($cid <= 0) {
            return ['rows' => [], 'is_multi_group' => 0];
        }
        $rows = db('cpc_team')
            ->where('contest_id', $cid)
            ->where(function ($q) {
                $q->whereNull('privilege')->whereOr('privilege', '');
            })
            ->whereRaw('CHAR_LENGTH(TRIM(`name`)) > 0')
            ->field([
                'team_id',
                'name',
                'name_en',
                'school',
                'room',
                'region',
                'tkind',
                'coach',
                'tmember',
            ])
            ->order('team_id', 'asc')
            ->select();
        if (!is_array($rows)) {
            $rows = [];
        }

        $meta = $this->GetContestMeta($cid, true);
        $groupList = (is_array($meta) && isset($meta['contest_group']) && is_array($meta['contest_group']))
            ? $meta['contest_group']
            : [];
        $isMultiGroup = count($groupList) > 1 ? 1 : 0;

        $gidToLabel = [];
        foreach ($groupList as $g) {
            if (!is_array($g)) {
                continue;
            }
            $gid = strval($g['group_id'] ?? '');
            if ($gid === '') {
                continue;
            }
            $gidToLabel[$gid] = [
                'group_name' => strval($g['group_name'] ?? ''),
                'group_name_en' => strval($g['group_name_en'] ?? ''),
            ];
        }

        $defaultGroupId = '';
        if (count($groupList) > 0 && is_array($groupList[0])) {
            $defaultGroupId = strval($groupList[0]['group_id'] ?? '');
        }
        $groupCanonicalMap = ContestGroupId::buildCanonicalMap($groupList);

        $teamToGids = [];
        $tgRows = db('cpc_team_group')
            ->where('contest_id', $cid)
            ->field(['team_id', 'group_id'])
            ->select();
        if (is_array($tgRows)) {
            foreach ($tgRows as $r) {
                if (!is_array($r)) {
                    continue;
                }
                $tid = strval($r['team_id'] ?? '');
                $gid = strval($r['group_id'] ?? '');
                if ($tid === '' || $gid === '') {
                    continue;
                }
                if (!isset($teamToGids[$tid])) {
                    $teamToGids[$tid] = [];
                }
                $teamToGids[$tid][] = $gid;
            }
        }

        foreach ($rows as &$one) {
            if (!is_array($one)) {
                continue;
            }
            $tid = strval($one['team_id'] ?? '');
            $gids = isset($teamToGids[$tid]) ? array_values(array_unique($teamToGids[$tid])) : [];
            if (count($gids) === 0 && $defaultGroupId !== '') {
                $gids = [$defaultGroupId];
            }
            $gids = ContestGroupId::normalizeList($gids, $groupCanonicalMap);
            $labels = [];
            foreach ($gids as $gid) {
                if (isset($gidToLabel[$gid])) {
                    $labels[] = $gidToLabel[$gid];
                }
            }
            $one['group_labels'] = $labels;
        }
        unset($one);

        return ['rows' => $rows, 'is_multi_group' => $isMultiGroup];
    }
    
    /**
     * 设置视图变量
     * 根据 $this->module 区分不同模块的行为
     */
    public function SetAssign()
    {
        //******在contest的各个页面assign的通用变量
        //比赛信息
        $this->assign('contest', $this->contest);
        //当前状态（-1未开始，1进行中，2已结束）
        $this->assign('contestStatus', $this->contestStatus);
        $this->assign('rankFrozen', $this->rankFrozen);
        //用于在contet_header初始化当前时间，之后由js计算本地时间差并继续显示动态时间
        $this->assign('now', date('Y-m-d H:i:s'));
        //旧数据可能有langmask没指定语言的情况，数据合法时才设置为比赛的langmask，否则为默认的系统允许语言
        $this->assign('allowLanguage', $this->allowLanguage);

        //为方便View中一个变量判断，加个running标识符
        $this->assign('running', $this->running);

        // 题号1xxx、ABCD、num的0123 题号的对应关系
        $this->assign('problemIdMap', $this->problemIdMap);
        $this->assign('pagetitle', 'Contest ' . $this->contest['contest_id'] . ' ' . $this->request->action());
        // 设置 action 变量（用于视图模板中的菜单高亮等）
        $this->assign('action', strtolower($this->request->action()));
        //参赛权限
        $this->assign('canJoin', $this->canJoin);
        $this->assign('needAuth', $this->needAuth);
        //******公共配置信息
        $this->assign('ojLang', $this->ojLang);
        $this->assign('ojLanguageColor', $this->ojLanguageColor); // 语言颜色配置
        $this->assign('ojResults', $this->ojResults);
        $this->assign('ojResultsHtml', $this->ojResultsHtml);
        // 设置比赛用户 id，根据模块使用不同的实现
        $this->SetAssignUser();
        $this->assign('isContestAdmin', $this->IsContestAdmin());
        $this->assign('isAdmin', IsAdmin());
        if (strtolower((string) $this->controller) === 'admin' && isset($this->contest['contest_id'])) {
            $this->assign('isContestSysAdmin', $this->isContestSysAdminForContest());
        }

        // 下发统一的 contestPolicy（模板只读它做展示，避免写 module/OJ_STATUS 分支）
        $contestPolicy = $this->getContestAccessPolicy();
        $this->assign('contestPolicy', $contestPolicy);
        // 兼容：部分模板可能直接用 showContestLogoutButton
        $this->assign('showContestLogoutButton', $contestPolicy['showContestLogoutButton'] ?? false);
        $attach = isset($this->contest['attach']) ? trim((string) $this->contest['attach']) : '';
        $banner = null;
        if ($attach !== '') {
            $ojPath = config('OjPath.');
            $banner = ContestHeaderBanner::resolvePublicMeta(
                rtrim((string) ($ojPath['PUBLIC'] ?? ''), '/'),
                (string) ($ojPath['contest_ATTACH'] ?? '/upload/contest_attach'),
                (string) ($ojPath['contest_ATTACH'] ?? '/upload/contest_attach'),
                $attach
            );
        }
        $this->assign('contest_header_banner', $banner ?: ['kind' => '', 'url' => '', 'mtime' => 0]);
    }
    
    /**
     * 设置用户相关变量
     * 根据 $this->module 区分不同模块的行为
     */
    public function SetAssignUser()
    {
        // ========== 耦合 expsys/examsys 逻辑（必须：用户信息设置） ==========
        // expsys 是练习模式，使用普通 users 表（已在子类重写，这里不处理）
        if($this->module == 'expsys') {
            // expsys 使用普通 users 表，已在 expsys/controller/Contest.php 中重写 SetAssignUser()
            return;
        }
        // CPC 赛内账号会话（含 ojtool/contestlive）
        if ($this->contestResolvesCpcTeamPrivilege()) {
            if($this->GetSession('?')){
                $this->contest_user = $this->GetSession('team_id');
                $this->assign('contest_user', $this->contest_user);
                $this->assign('login_teaminfo', $this->GetSession());
            } else {
                $this->contest_user = null;
                $this->assign('contest_user', null);
                $this->assign('login_teaminfo', null);
            }
            
            // CPC 系统特有的权限设置（只在 contest 已初始化时设置）
            // expsys 是练习模式，不需要这些权限设置
            if ($this->contestResolvesCpcTeamPrivilege() && isset($this->contest) && $this->contest !== null && isset($this->contest['contest_id'])) {
                $this->proctorAdmin     =   $this->IsContestAdmin('admin');
                $this->watcherUser      =   $this->IsContestAdmin('watcher');
                $this->balloonManager   =   $this->IsContestAdmin('balloon_manager');
                $this->balloonSender    =   $this->IsContestAdmin('balloon_sender');
                $this->printManager     =   $this->IsContestAdmin('printer');
                // reviewer 只在 examsys（考试模式）中需要，expsys（练习模式）不需要
                if($this->module == 'examsys') {
                    $this->isReviewer       =   $this->IsContestAdmin('reviewer');
                } else {
                    $this->isReviewer       =   false;
                }
                $this->isContestStaff   =   $this->proctorAdmin || $this->balloonManager || $this->balloonSender || 
                                            $this->printManager || $this->isReviewer || $this->watcherUser;
                $this->isContestWorker  =   $this->balloonSender || $this->printManager;
                // 仅按比赛内账号 privilege 判断是否为工作人员（不掺入系统管理员），供 standard 提交等逻辑使用
                $contestPriv = $this->GetSession('privilege');
                $staffPrivs = ['admin', 'balloon_manager', 'balloon_sender', 'printer', 'watcher', 'ccs_reader'];
                if ($this->module == 'examsys') {
                    $staffPrivs[] = 'reviewer';
                }
                $this->isContestAccountStaff = ($contestPriv !== null && $contestPriv !== '' && in_array($contestPriv, $staffPrivs, true));
                $this->assign('proctorAdmin',       $this->proctorAdmin);
                $this->assign('watcherUser',        $this->watcherUser);
                $this->assign('balloonManager',     $this->balloonManager);
                $this->assign('balloonSender',      $this->balloonSender);
                $this->assign('printManager',       $this->printManager);
                $this->assign('isReviewer',         $this->isReviewer);
                $this->assign('isContestStaff',     $this->isContestStaff);
                $this->assign('isContestWorker',    $this->isContestWorker);
                $this->assign('isContestAccountStaff', $this->isContestAccountStaff);
            } else {
                // contest 未初始化时，设置默认值
                $this->proctorAdmin = false;
                $this->watcherUser = false;
                $this->balloonManager = false;
                $this->balloonSender = false;
                $this->printManager = false;
                $this->isReviewer = false;
                $this->isContestStaff = false;
                $this->isContestWorker = false;
                $this->isContestAccountStaff = false;
            }
        } else {
            // 普通 OJ 系统（csgoj）使用 session('user_id')
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
        // ========== 耦合 expsys/examsys 逻辑结束 ==========
    }
    
    /**
     * 检查是否可以参加比赛
     * 根据 $this->module 区分不同模块的行为
     */
    public function CanJoin()
    {
        // expsys 是练习模式，使用 session('clss_xxx')（已在子类重写）
        if($this->module == 'expsys') {
            // expsys 已在 expsys/controller/Contest.php 中重写 CanJoin()
            return false;
        }
        // CPC 赛内账号会话（含 ojtool/contestlive）
        if ($this->contestResolvesCpcTeamPrivilege()) {
            if(!$this->GetSession('?')){
                $this->needAuth = true;
                return false;
            }
            return true;
        } else {
            // 普通 OJ 系统（csgoj）使用 PrivItem 查询参与者权限（pvrole='' 表示参与者）
            if (!PrivItem('contest', $this->contest['contest_id'], '')) {
                if ($this->contest['private'] % 10 == 1) {
                    $this->needAuth = false;
                    return false;
                } else if ($this->contest['private'] % 10 == 0 && strlen(trim($this->contest['password'])) > 0) {
                    $this->needAuth = true;
                    return false;
                }
            }
            return true;
        }
    }
    
    /**
     * GET flg_rank_not_admin 非 0 为真；单次请求 memo。
     * 仅用于 ContestStatus（封榜豁免）与 contestRankDynamicUsesRankCache；勿写入 IsContestAdmin。
     */
    protected function flgRankNotAdminRequest()
    {
        static $memo = null;
        if ($memo !== null) {
            return $memo;
        }
        $memo = (intval(input('flg_rank_not_admin', 0), 10) !== 0);
        return $memo;
    }

    /**
     * contest_data_ajax / GetContestData4Rank 是否读写 OJ_RANKDYNAMIC 缓存。
     * 与 ContestInit 中 cpcsys 的 rank 缓存策略对齐，并增加：IsContestAdmin(null) 且 flg_rank_not_admin 时不走缓存（外榜等）。
     */
    protected function contestRankDynamicUsesRankCache(): bool
    {
        if ($this->IsContestAdmin('watcher')) {
            return false;
        }
        if (in_array($this->module, ['cpcsys'], true)) {
            if ($this->IsContestAdmin('admin')
                || $this->IsContestAdmin('balloon_manager')
                || $this->IsContestAdmin('balloon_sender')) {
                return false;
            }
        } elseif ($this->IsContestAdmin()) {
            return false;
        }
        if ($this->flgRankNotAdminRequest() && $this->IsContestAdmin()) {
            return false;
        }
        return true;
    }
    
    /**
     * 检查是否是比赛管理员
     * 根据 $this->module 区分不同模块的行为
     * @param string|null $privilegeName 权限名称
     * @param array|null $contest 比赛信息，如果为null则使用 $this->contest
     * @return bool
     */
    protected function IsContestAdmin($privilegeName = null, $contest = null)
    {
        // 如果没有传入 contest，使用 $this->contest
        if ($contest === null) {
            $contest = $this->contest;
        }
        
        // 如果 contest 为 null，无法检查管理员权限，返回 false
        if ($contest === null || !isset($contest['contest_id'])) {
            return false;
        }

        // 请求级缓存：单次请求中（contest_id + privilegeName + 当前用户）三元组结果不变。
        // 否则每次都会触发 IsAdmin/PrivItem 的 Session/File-Cache + ORM cache 文件 IO 链，
        // 在 ContestInit 与各 ajax 列表渲染中累计可达数百毫秒（实测）。
        $__cidKey = strval($contest['contest_id']);
        $__privKey = $privilegeName === null ? '__null__' : strval($privilegeName);
        if (isset($this->__isContestAdminCache[$__cidKey][$__privKey])) {
            return $this->__isContestAdminCache[$__cidKey][$__privKey];
        }
        
        $isAdmin = IsAdmin('contest', $contest['contest_id']);
        
        // ========== 耦合 expsys/examsys 逻辑（必须：权限检查） ==========
        // CPC 赛内 privilege + expsys 课程侧管理员
        $ret = null;
        if ($this->contestResolvesCpcTeamPrivilege() || $this->module === 'expsys') {
            // 检查课程管理员权限（从 course_item 表获取 course_key）
            $course_key = GetItemCourseKey($contest, 'contest');
            if($course_key && function_exists('PrivCourse') && PrivCourse('admin', $course_key)) {
                $isAdmin = true;
            }
            
            // 检查是否是课程教师（通过 contest 的 teachers 字段或 course_item 表）
            if(!$isAdmin && function_exists('CourseTeacherContestCheck') && session('?user_id')) {
                $isAdmin = CourseTeacherContestCheck($contest, session('user_id'));
            }

            // examsys/exadmin 的“考试负责人(owner)”与“可管理人(manage)”：基于 privilege_item(rightitem=contest, pvrole=owner|manage)
            // owner 与 manage 在考试内均视为管理员；仅 owner 可增删 manage 列表
            if(!$isAdmin && function_exists('PrivItem') && session('?user_id')) {
                try {
                    $cid = intval($contest['contest_id']);
                    if (PrivItem('contest', $cid, 'owner') || PrivItem('contest', $cid, 'manage')) {
                        $isAdmin = true;
                    }
                } catch (\Throwable $e) {
                    // ignore
                }
            }
            
            if($privilegeName === null) {
                // 比赛内 team 会话的 admin 与 IsContestAdmin('admin') 一致，须计入 null 分支；
                // 否则后台菜单（重判、CCS API 等）与 contest_rejudge 仅认 IsContestAdmin() 时会漏判。
                if ($this->contestResolvesCpcTeamPrivilege()
                    && $this->GetSession('?')
                    && $this->GetSession('privilege') === 'admin') {
                    $ret = true;
                } else {
                    $ret = $isAdmin;
                }
            }
            else {
                $ret = ($this->GetSession('privilege') === $privilegeName || $isAdmin);
            }
        } else {
            // 普通 OJ 系统（csgoj）只检查管理员权限
            $ret = $isAdmin;
        }
        // ========== 耦合 expsys/examsys 逻辑结束 ==========
        if (!isset($this->__isContestAdminCache[$__cidKey])) {
            $this->__isContestAdminCache[$__cidKey] = [];
        }
        $this->__isContestAdminCache[$__cidKey][$__privKey] = $ret;
        return $ret;
    }
    
    /**
     * 处理 solution 用户名
     * 根据 $this->module 区分不同模块的行为
     */
    public function SolutionUser($user_id, $appearprefix=null)
    {
        // ========== 耦合 expsys/examsys 逻辑（必须：用户ID处理） ==========
        // expsys 是练习模式，使用普通 users 表，不需要前缀处理（已在子类重写）
        if($this->module == 'expsys') {
            // expsys 已在 expsys/controller/Contest.php 中重写 SolutionUser()
            return $user_id;
        }
        // CPC 系统（cpcsys、examsys）需要前缀处理
        if(in_array($this->module, ['cpcsys', 'examsys'])) {
            if($appearprefix === null) {
                if($user_id != '' && $user_id[0] == '#') $user_id = substr(strrchr($user_id, "_"), 1);
                else $user_id = '#cpc' . $this->contest['contest_id'] . '_' . $user_id;
            }
            else if($appearprefix === true) {
                if($user_id != '' && $user_id[0] != '#') $user_id = '#cpc' . $this->contest['contest_id'] . '_' . $user_id;
            }
            else {
                if($user_id != '' && $user_id[0] == '#') $user_id = substr(strrchr($user_id, "_"), 1);
            }
        }
        // 普通 OJ 系统（csgoj）直接返回
        // ========== 耦合 expsys/examsys 逻辑结束 ==========
        return $user_id;
    }
    
    /**
     * 获取 session（CPC 系统专用：cpcsys、examsys）
     * expsys 是基于系统用户的，不使用此方法
     * @param string|null $sessionStr session 字段名
     * @return mixed
     */
    public function GetSession($sessionStr=null)
    {
        // ========== 耦合 expsys/examsys 逻辑（必须：Session 处理） ==========
        // CPC 赛内账号会话（含 ojtool/contestlive）；expsys 用系统用户，不走 teamSessionName
        if (!$this->contestResolvesCpcTeamPrivilege()) {
            return null;
        }
        if(!isset($this->teamSessionName) || $this->teamSessionName == '' || $this->teamSessionName == null)
            return null;
        if($sessionStr == '?') {
            return session('?' . $this->teamSessionName);
        }
        if($sessionStr === null) {
            $sessionStr = $this->teamSessionName;
        } else {
            $sessionStr = $this->teamSessionName . '.' . $sessionStr;
        }
        if(!session('?' . $sessionStr)) {
            return null;
        }
        // ========== 耦合 expsys/examsys 逻辑结束 ==========
        return session($sessionStr);
    }
    
    /**
     * 获取排名用户列表
     * 根据 $this->module 区分不同模块的行为
     */
    public function RankUserList($map, $with_star=true)
    {
        // cpcsys：contest_data_ajax / GetContestData4Rank 的 team 为客观全量（本场 cpc_team 参赛账号，不含工作人员）；是否只展示有提交等由前端或其它接口约定。
        if ($this->module === 'cpcsys') {
            $cmap = ['contest_id' => $this->contest['contest_id']];
            if (!$with_star) {
                $cmap['tkind'] = ['<>', 2];
            }
            return db('cpc_team')->alias('t')
                ->where($cmap)
                ->where(function ($query) {
                    $query->whereNull('privilege')->whereOr('privilege', '');
                })
                ->field([
                    't.team_id user_id',
                    't.name nick',
                    't.name_en',
                    't.school school',
                    't.tmember tmember',
                    't.tkind tkind',
                    't.coach coach',
                    't.room room',
                    't.region region',
                    't.privilege privilege',
                    't.team_global_code team_global_code',
                ])
                ->select();
        }
        // examsys：仍列出本场全部参赛账号（考试场景可能需零提交也可见）
        if ($this->module === 'examsys') {
            $cmap = ['contest_id' => $this->contest['contest_id']];
            if (!$with_star) {
                $cmap['tkind'] = ['<>', 2];
            }
            return db('cpc_team')
                ->where($cmap)
                ->where(function ($query) {
                    $query->whereNull('privilege')->whereOr('privilege', '');
                })
                ->field([
                    'team_id user_id',
                    'name nick',
                    'name_en',
                    'school',
                    'tmember',
                    'tkind',
                    'coach',
                    'room',
                    'region',
                    'privilege',
                    'team_global_code',
                ])
                ->select();
        }
        // 普通 OJ 系统（csgoj）：tmember/coach 仅占位，勿用 email 作选手名。
        return db('solution')->alias('s')
            ->join('users u', 'u.user_id = s.user_id', 'left')
            ->where($map)
            ->group('s.user_id,u.nick,u.school')
            ->field([
                's.user_id user_id',
                'u.nick nick',
                'u.school school',
                '"" tmember',
                '"" coach',
                '0 tkind'
            ])
            ->select();
    }
    
    /**
     * 获取用户信息URL
     * 根据 $this->module 区分不同模块的行为
     * @param string $user_id 用户ID
     * @param int $contest_id 比赛ID
     * @param bool $only_prefix 是否只返回前缀（兼容旧签名，等同于 $prefix）
     * @param int $sol_id 解决方案ID（兼容旧签名，未使用）
     */
    public function UserInfoUrl($user_id, $contest_id=0, $only_prefix=false, $sol_id=0)
    {
        // 兼容旧签名：$prefix 参数
        $prefix = $only_prefix;
        
        // ========== 耦合 expsys/examsys 逻辑（必须：用户信息URL） ==========
        // expsys 是练习模式，使用 user/userinfo（已在子类重写）
        if($this->module == 'expsys') {
            // expsys 已在 expsys/controller/Contest.php 中重写 UserInfoUrl()
            return '/expsys/user/userinfo?user_id=' . $user_id;
        }
        // CPC 系统（cpcsys、examsys）使用 teaminfo
        if(in_array($this->module, ['cpcsys', 'examsys'])) {
            if($prefix)
                return '/' . $this->module . '/' . $this->controller . '/teaminfo?cid=' . $contest_id . '&team_id=';
            else
                return '/' . $this->module . '/' . $this->controller . '/teaminfo?cid=' . $contest_id . '&team_id=' . $user_id;
        } else {
            // 普通 OJ 系统（csgoj）使用 user/userinfo
            if ($prefix)
                return '/' . $this->module . '/user/userinfo?user_id=';
            else
                return '/' . $this->module . '/user/userinfo?user_id=' . $user_id;
        }
        // ========== 耦合 expsys/examsys 逻辑结束 ==========
    }
    
    /**
     * 获取比赛相关变量
     */
    public function GetVars()
    {
        $this->contestStatus = $this->ContestStatus();
        $this->running = $this->contestStatus == 1;
        $allowLanguage = $this->FromLangMask($this->contest['langmask']);
        if (count($allowLanguage) > 0)
            $this->allowLanguage = $allowLanguage;
        $this->ProblemIdMap();
    }
    
    /**
     * 获取比赛状态
     * @param array|null $contest 比赛信息，如果为null则使用 $this->contest
     * @return int -1未开始，1进行中，2结束
     */
    public function ContestStatus($contest = null)
    {
        //-1未开始，1进行中，2结束
        if ($contest == null) {
            $contest = $this->contest;
        }
        $now = time();
        $start_time = strtotime($contest['start_time']);
        $end_time = strtotime($contest['end_time']);
        $this->closeRankTime = CcpcRules::enabled($contest) ? CcpcRules::freezeAt($contest) : $end_time - ($contest['frozen_minute'] > 0 ? $contest['frozen_minute'] : 0) * 60;
        $this->frozenEndTime = $end_time + ($contest['frozen_after'] > 0 ? $contest['frozen_after'] : 0) * 60;
        $ret = -1;
        $this->rankFrozen = false;
        if ($now < $start_time) {
            $ret = -1;
        }
        else if ($now < $end_time) {
            $ret = 1;
        }
        else {
            $ret = 2;
        }
        if ($now >= $this->closeRankTime && $now < $this->frozenEndTime) {  // [freeze, unfreeze)
            $this->rankFrozen = true;
        }
        // GET flg_rank_not_admin 非 0：不按管理端豁免封榜（外榜拉榜等仍按观众封榜视角）
        if (!$this->flgRankNotAdminRequest() && (
            $this->IsContestAdmin(null, $contest) || $this->IsContestAdmin('balloon_manager', $contest)
            || $this->IsContestAdmin('balloon_sender', $contest) || $this->IsContestAdmin('admin', $contest)
        )) {
            // 管理员、气球管理员、气球配送员 不封榜
            $this->rankFrozen = false;
        }
        // PS: 直播员 watcher 需要封榜
        return $ret;
    }
    
    /**
     * 比赛题目编号计算
     * @param int $ith 题目序号（0是A, 1是B，26是AA，类似Excel横轴命名规则）
     * @return string 题目编号（A, B, C, ..., Z, AA, AB, ...）
     */
    public function ContestProblemId($ith)
    {
        $ret = '';
        $ith = intval($ith) + 1;
        while ($ith > 0) {
            $ret = chr(($ith - 1) % 26 + ord('A')) . $ret;
            $ith = intval(($ith - 1) / 26);
        }
        return $ret;
    }
    
    /**
     * 从语言掩码解析允许的编程语言
     * @param int $langmask 语言掩码
     * @return array 允许的编程语言数组
     */
    public function FromLangMask($langmask)
    {
        $languages = [];
        foreach ($this->ojLang as $k => $la) {
            if (($langmask >> $k) & 1)
                $languages[$k] = $la;
        }
        ksort($languages);
        return $languages;
    }
    
    /**
     * 题号映射（需要在子类中重写，因为 expsys/examsys 有不同的实现）
     * 默认实现为 csgoj 的标准实现
     */
    public function ProblemIdMap()
    {
        // 题号1xxx、ABCD、num的0123 题号的对应关系
        $this->contest_problem_list = db('contest_problem')
            ->where('contest_id', $this->contest['contest_id'])
            ->field([
                'problem_id',
                'num',
                'title',
                'pscore'
            ])
            ->order('num', 'asc')
            ->cache(20)
            ->select();

        $this->problemIdMap = [
            'abc2id' => [],
            'id2abc' => [],
            'id2num' => [],
            'num2score' => [],
            'id2score' => [],
            'num2color' => [],
            'num2abc' => [],
        ];
        if ($this->contest_problem_list == null) {
            //这种情况一般不会发生，如果真的有，那是管理员操作不当，页面出问题也难免
            return;
        }
        $zeroScoreFlag = true;  // 是否所有题都没设置分数
        foreach ($this->contest_problem_list as $problemId) {
            if ($problemId['pscore'] > 0) {
                $zeroScoreFlag = false;
            }
        }
        // 如果有附加题，则计分题目个数减1
        $pnum = count($this->contest_problem_list) - (intdiv((int)$this->contest['private'], 10) === 1);
        $everScore = $pnum <= 0 ? 100 : (floor(100 / $pnum * 10) / 10);
        foreach ($this->contest_problem_list as $problemId) {
            $alphabetId = $this->ContestProblemId($problemId['num']);
            $this->problemIdMap['abc2id'][$alphabetId] = $problemId['problem_id'];
            $this->problemIdMap['id2abc'][$problemId['problem_id']] = $alphabetId;
            $this->problemIdMap['id2num'][$problemId['problem_id']] = $problemId['num'];
            if ($problemId['num'] < $pnum) {
                $this->problemIdMap['num2score'][$problemId['num']] = $zeroScoreFlag ? $everScore : $problemId['pscore'];
                $this->problemIdMap['id2score'][$problemId['problem_id']] = $zeroScoreFlag ? $everScore : $problemId['pscore'];
            } else {
                $this->problemIdMap['num2score'][$problemId['num']] = $problemId['pscore'];
                $this->problemIdMap['id2score'][$problemId['problem_id']] = $problemId['pscore'];
            }
            $this->problemIdMap['num2color'][$problemId['num']] = $problemId['title'];
            $this->problemIdMap['num2abc'][$problemId['num']] = $alphabetId;
        }
    }
    
    // ========== Problem Set Related ==========
    // 注意：problemset() 和 problemset_ajax() 方法已移至 ContestActionTrait.php
    
    // ========== Rank Related ==========
    // 注意：rank() 方法已移至 ContestActionTrait.php
    
    /**
     * 获取比赛数据（用于榜单）
     * 从 csgoj/controller/Contest.php 迁移而来
     */
    protected function GetContestData4Rank($param=[]) {
        // 确保 contest 已初始化
        if (!isset($this->contest) || !isset($this->contest['contest_id'])) {
            throw new \Exception('比赛信息未初始化');
        }
        
        // 确保 ContestStatus 已初始化（用于封榜判断）；
        if (!isset($this->rankFrozen)) {
            $this->ContestStatus();
        }
        
        $info_need = $param['info_need'] ?? [];
        $min_solution_id = $param['min_solution_id'] ?? 0;
        $solution_result = $param['solution_result'] ?? -1;  // 查询特定结果类型

        $ccpc = CcpcRules::enabled($this->contest);
        if ($ccpc) {
            // A reveal threshold must use a full authoritative snapshot, never a caller's filter.
            $info_need = ['all'];
            $min_solution_id = 0;
            $solution_result = -1;
        }

        if(!is_array($info_need) || count($info_need) == 0 || $info_need[0] == 'all') {
            $info_need = [
                'contest',
                'problem',
                'team', 
                'solution', 
                'contest_balloon'
            ];
        }
        sort($info_need);
        $query_param = implode('_', $info_need) . '_' . 
            ($min_solution_id == null ? '0' : $min_solution_id) . '_' .
            ($solution_result == null ? '0' : $solution_result) . '_' .
            $this->contest['contest_id'];

        $cache_option = config('CsgojConfig.OJ_RANKDYNAMIC_CACHE_OPTION');
        $cache_key = $this->OJ_MODE . '_drk_' . $query_param;
        $flg_use_cache = !$ccpc && $this->contestRankDynamicUsesRankCache();
        if($flg_use_cache) {
            //非管理员则使用cache
            $contest_data = cache($cache_key, '', $cache_option);
            if($contest_data) {
                $contest_data['flg_cache'] = true;
                if (!isset($contest_data['time_context']) || !is_array($contest_data['time_context'])) {
                    $contest_data['time_context'] = CsgOjWireInstant::rankAjaxTimeContext();
                }
                return $contest_data;
            }
        }
        // 参数验证和过滤
        $contest_id = intval($this->contest['contest_id']);
        $min_solution_id = $min_solution_id ? intval($min_solution_id) : 0;
        
        $contest_data = [];
        // ********************
        // solution
        if(in_array('solution', $info_need)) {
            $sol_map = [
                'contest_id' => $contest_id,
            ];
            if($solution_result >= 0) {
                $sol_map['result'] = $solution_result;
            }
            if ($min_solution_id > 0) {
                $sol_map['solution_id'] = ['>=', $min_solution_id];
            }
            $field = ['solution_id', 'contest_id', 'problem_id', 'user_id', 'result', 'in_date'];
            // 正常查询获取数据
            $solution_raw = db('solution')->where($sol_map)->field($field)->order('solution_id', 'asc')->select();
            
            // 转换为 list 格式
            // 字段顺序：[0]solution_id, [1]contest_id, [2]problem_id, [3]team_id（数据库是user_id）, [4]result, [5]in_date
            $solution = [];
            if ($solution_raw && is_array($solution_raw)) {
                foreach ($solution_raw as $item) {
                    $solution[] = [
                        $item['solution_id'],
                        $item['contest_id'],
                        $item['problem_id'],
                        $item['user_id'],
                        $item['result'],
                        $item['in_date']
                    ];
                }
            }
            // 检查封榜状态（如果 ContestStatus 已调用）
            if (!$ccpc && isset($this->rankFrozen) && $this->rankFrozen && isset($this->closeRankTime)) {
                $closeRankTimeStr = date('Y-m-d H:i:s', $this->closeRankTime);
                foreach ($solution as &$s) {
                    if ($s[5] >= $closeRankTimeStr) {
                        $s[4] = -1;
                    }
                }
            }
            $contest_data['solution'] = $solution;
        }
        // ********************
        // team
        if(in_array('team', $info_need)) {
            // 获取 team 信息
            // 使用 RankUserList 方法（各模块会重写此方法）
            $team_list = $this->RankUserList(['contest_id' => $contest_id]);
            $contest_data['team'] = [];
            $teamGroupMap = [];
            $defaultGroupId = '';
            $meta4Team = isset($this->contestMeta) && is_array($this->contestMeta)
                ? $this->contestMeta
                : $this->GetContestMeta($contest_id, true);
            $groupList4Team = is_array($meta4Team['contest_group'] ?? null) ? $meta4Team['contest_group'] : [];
            $groupCanonicalMap = ContestGroupId::buildCanonicalMap($groupList4Team);
            if (count($groupList4Team) > 0) {
                $defaultGroupId = strval($groupList4Team[0]['group_id'] ?? '');
            }
            if (in_array($this->module, ['cpcsys', 'examsys'])) {
                $teamGroupRows = db('cpc_team_group')
                    ->where('contest_id', $contest_id)
                    ->field(['team_id', 'group_id'])
                    ->select();
                foreach ($teamGroupRows as $row) {
                    $tid = $row['team_id'];
                    if (!isset($teamGroupMap[$tid])) {
                        $teamGroupMap[$tid] = [];
                    }
                    $teamGroupMap[$tid][] = $row['group_id'];
                }
            }
            foreach ($team_list as $team) {
                // 转换为 list 格式
                // 字段顺序：[0]contest_id, [1]team_id, [2]name, [3]name_en, [4]coach, [5]tmember, [6]school, [7]region, [8]tkind, [9]room, [10]privilege, [11]team_global_code, [12]group_ids, [13]group_ids_explicit
                // 注意：RankUserList 可能返回 user_id 或 team_id，需要兼容处理
                $team_id = $team['team_id'] ?? $team['user_id'] ?? '';
                $name = $team['name'] ?? $team['nick'] ?? $team_id;
                $teamGroupIds = isset($teamGroupMap[$team_id]) ? array_values(array_unique($teamGroupMap[$team_id])) : [];
                $groupIdsExplicit = 0;
                if (in_array($this->module, ['cpcsys', 'examsys'], true)) {
                    $groupIdsExplicit = (isset($teamGroupMap[$team_id]) && count($teamGroupMap[$team_id]) > 0) ? 1 : 0;
                }
                // 业务规则：若队伍未设置 team_group，则默认归属第一个 contest_group
                if (count($teamGroupIds) === 0 && $defaultGroupId !== '') {
                    $teamGroupIds = [$defaultGroupId];
                }
                $teamGroupIds = ContestGroupId::normalizeList($teamGroupIds, $groupCanonicalMap);
                $contest_data['team'][] = [
                    $contest_id,
                    $team_id,
                    $name,
                    $team['name_en'] ?? '',
                    $team['coach'] ?? '',
                    $team['tmember'] ?? '',
                    $team['school'] ?? '',
                    $team['region'] ?? '',
                    isset($team['tkind']) ? intval($team['tkind']) : 0,
                    $team['room'] ?? '',
                    $team['privilege'] ?? '',
                    $team['team_global_code'] ?? '',
                    $teamGroupIds,
                    $groupIdsExplicit,
                ];
            }
        }
        // ********************
        // problem
        if(in_array('problem', $info_need)) {
            $problem_list = db('contest_problem')->alias('cp')
                ->join('problem p', 'p.problem_id = cp.problem_id', 'left')
                ->where('cp.contest_id', $contest_id)
                ->order('cp.num', 'asc')
                ->field([
                    'p.problem_id problem_id',
                    'p.title title',
                    'cp.num num',
                    'cp.title color',  // contest_problem.title 字段存储的是 balloon color
                    'cp.pscore pscore'
                ])
                ->select();
            $contest_data['problem'] = [];
            foreach ($problem_list as $problem) {
                if ($problem['problem_id'] == null) {
                    // 题目不存在，跳过
                    continue;
                }
                // 转换为 list 格式
                // 字段顺序：[0]problem_id, [1]title, [2]num, [3]color, [4]pscore
                // color 字段来自 contest_problem.title（存储 balloon color）
                $contest_data['problem'][] = [
                    $problem['problem_id'],
                    $problem['title'],
                    $problem['num'],
                    $problem['color'] ?? '',  // contest_problem.title 作为 color
                    $problem['pscore'] ?? 0
                ];
            }
        }
        // ********************
        // contest
        if(in_array('contest', $info_need)) {
            $contest_data['contest'] = $this->contest;
            $meta = isset($this->contestMeta) && is_array($this->contestMeta) ? $this->contestMeta : $this->GetContestMeta($contest_id, true);
            $contest_data['contest_group'] = $meta['contest_group'] ?? [];
            $contest_data['group_count'] = intval($meta['group_count'] ?? 0);
            $contest_data['is_multi_group'] = intval($meta['is_multi_group'] ?? 0);
            $contest_data['contest_user'] = $this->contest_user ?? null;
            // 榜单多归属筛选：赛内/系统侧管理员默认「全归属」勾选（前端 GetDefaultSelectedGroupIds）
            $contest_data['rank_group_staff_default_all'] = $this->IsContestAdmin() ? 1 : 0;
        }
        // ********************
        // contest_balloon
        if(in_array('contest_balloon', $info_need)) {
            $contest_balloon = db('contest_balloon')->where(['contest_id' => $contest_id])->select();
            $contest_data['contest_balloon'] = [];
            foreach($contest_balloon as $item) {
                $contest_data['contest_balloon'][] = [
                    $item['contest_id'],
                    $item['problem_id'],
                    $item['team_id'],
                    $item['ac_time'],   // int时间戳
                    $item['pst'],       // int 0普通 10 正式队一血 20 全局一血
                    $item['bst'],       // int 0未发 10已通知 20已分配 30已发放
                    $item['balloon_sender'], // string 气球配送员
                ];
            }
        }
        $contest_data['time_context'] = CsgOjWireInstant::rankAjaxTimeContext();
        if($flg_use_cache) {
            cache($cache_key, $contest_data, $cache_option);
        }
        return $contest_data;
    }
    
    /**
     * Topic 权限检查
     */
    protected function TopicAuth() {
        if (!isset($this->contest_user) && !$this->IsContestAdmin('admin'))
            $this->error("Please login first", 'contest?cid=' . $this->contest['contest_id'], '', 1);
    }
    
    /**
     * 处理topic的problem_id显示逻辑
     * @param array $topic 包含problem_id的topic数组
     * @return array 返回处理后的topic数组，包含problem_id和pid_abc字段
     */
    protected function ProcessTopicProblemId($topic)
    {
        $realPid = isset($topic['problem_id']) ? $topic['problem_id'] : null;
        
        if ($realPid == null || $realPid == -1) {
            $topic['problem_id'] = ''; // 无权限情况下设为空字符串
            $topic['pid_abc'] = 'All';
        } else {
            // 根据权限决定是否显示真实ID
            if ($this->IsContestAdmin() && $realPid != -1) {
                $topic['problem_id'] = strval($realPid); // 保持真实ID
            } else {
                $topic['problem_id'] = ''; // 无权限情况下设为空字符串
            }
            
            // 设置字母ID
            if (isset($this->problemIdMap['id2abc']) && array_key_exists($realPid, $this->problemIdMap['id2abc'])) {
                $topic['pid_abc'] = $this->problemIdMap['id2abc'][$realPid];
            } else {
                $topic['pid_abc'] = strval($realPid); // 如果题目被移出比赛，显示原ID
            }
        }
        
        return $topic;
    }
    
    
    // ========== 辅助方法（protected，供 action trait 使用） ==========
    
    /**
     * 获取比赛类型
     * @param array $contest 比赛信息
     * @return int 比赛类型（private % 10）
     */
    protected function ContestType($contest)
    {
        return $contest['private'] % 10;
    }
    
    /**
     * 获取题目信息（用于测试数据下载等）
     * @param string $apid 题目字母ID（A, B, C...）
     * @return array 题目信息
     */
    protected function GetProblem($apid)
    {
        // 此处检查是否允许下载数据
        if (!$this->ALLOW_TEST_DOWNLOAD && !IsAdmin()) {
            $this->error("No permission to see test data.");
        }
        $problem_id = $this->problemIdMap['abc2id'][$apid];

        $problem = db('contest_problem')->alias('cp')
            ->join('problem p', 'p.problem_id = cp.problem_id', 'left')
            ->where('cp.contest_id', $this->contest['contest_id'])
            ->where(['p.problem_id' => $problem_id])
            ->field([
                'p.problem_id problem_id',
                'p.title title',
                'p.spj spj',
                'p.time_limit time_limit',
                'p.memory_limit memory_limit',
                'p.submit submit',
                'p.accepted accepted',
                'cp.num num',
                'cp.pscore pscore'
            ])
            ->cache(10)
            ->find();
        if ($problem == null) {
            $this->error('No such problem.', null, '', 1);
        }
        // 确保 accepted 和 submit 字段有默认值
        if (!isset($problem['submit']) || $problem['submit'] === null) {
            $problem['submit'] = 0;
        }
        if (!isset($problem['accepted']) || $problem['accepted'] === null) {
            $problem['accepted'] = 0;
        }
        $problem['problem_id_show'] = $apid;
        if ($this->contestStatus == 2 || $this->IsContestAdmin())
            $problem['show_real_id'] = true;
        $problem['pagetitle'] = $apid . ': ' . $problem['title'];
        return $problem;
    }
    
    /**
     * 获取结果显示信息
     * @param array &$solution 提交信息（引用传递，会被修改）
     * @return void
     */
    protected function GetResultShow(&$solution)
    {
        $solution['res_show'] = false;
        $oj_results_html = config('CsgojConfig.OJ_RESULTS_HTML');
        $oj_results_short = config('CsgojConfig.OJ_RESULTS_SHORT');
        // if_can_see_info 的前提下，【10 RE 或 11 CE】或者【5~9的结果且(为管理员或允许查看错误信息)】
        $solution['res_show'] = $this->IfCanSeeInfo($solution) && ($solution['result'] == 11 || (in_array($solution['result'], [5, 6, 7, 8, 9, 10, 90])  && ($this->IsContestAdmin('admin') || $this->ALLOW_WA_INFO)));
        $result_style = array_key_exists($solution['result'], $oj_results_html) ? $solution['result'] : 100;
        $solution['res_color'] = $oj_results_html[$result_style][0];
        $solution['res_text'] = $oj_results_html[$result_style][1];
        $solution['res_short'] = array_key_exists($solution['result'], $oj_results_short) ? $oj_results_short[$solution['result']] : 'Unknown';
    }
    
    /**
     * 检查是否可以查看提交信息
     * @param array $solution 提交信息
     * @return bool true 表示可以查看，false 表示不可以
     */
    protected function IfCanSeeInfo($solution) {
        if (isset($solution) && $solution != null && isset($solution['user_id'])) {
            $solution['user_id'] = $this->SolutionUser($solution['user_id'], false);
        }
        if (!isset($solution['contest_id']) || $solution['contest_id'] != $this->contest['contest_id']) {
            return false;
        } else if (IsAdmin('source_browser') || $this->IsContestAdmin('admin')) {
            return true;
        } else if (!$this->contest_user) {
            return false;
        } else if ($this->contest_user == $solution['user_id']) {
            return true;
        } else {
            return false;
        }
    }
    
    /**
     * Topic 提交延迟检查
     * @return void
     */
    protected function TopicSubmitDelay()
    {
        if (!$this->IsContestAdmin('admin') && session('?last_topic_submit')) {
            $now = time();
            $submitWaitTime = config('CsgojConfig.OJ_TOPIC_WAIT_TIME');
            if ($now - session('last_topic_submit') < $submitWaitTime)
                $this->error("回复过于频繁，请稍候。<br/>Reply too frequent, please wait.<br/>" . ($submitWaitTime - ($now - session('last_topic_submit'))) . " s");
        }
        session('last_topic_submit', time());
    }
    
    // ========== EXP 模式：课程权限检查函数（与 ACMOJ 逻辑解耦） ==========
    // 注意：以下方法是为 expsys/examsys 模块提供的，但放在 ContestBaseTrait 中以便所有模块可以访问
    // 这些方法在非 exp 模式下会返回兼容值，不会影响 ACM OJ 系统的功能
    
    /**
     * 检查 course_id 是否有权限提交某道题
     * 当前逻辑：检查题目是否属于该 course_id
     * 未来可扩展：支持多 course 共享题目等复杂逻辑
     * 
     * @param int $course_id 课程ID
     * @param int $problem_id 题目ID
     * @return bool 是否有权限
     */
    protected function CheckCourseProblemSubmitPermission($course_id, $problem_id)
    {
        // 如果 course_id 为空，不进行权限检查（兼容非 exp 模式）
        if(!$course_id) {
            return true;
        }
        
        // 当前逻辑：检查题目是否属于该 course_id
        // 通过 course_item 表查询：item='problem', item_id=problem_id, course_id=course_id, pvrole=NULL
        $courseItem = db('course_item')
            ->where([
                'item' => 'problem',
                'item_id' => $problem_id,
                'course_id' => $course_id,
            ])
            // 兼容历史数据：pvrole 可能是 NULL 或空字符串
            ->where(function($q) {
                $q->whereNull('pvrole')->whereOr('pvrole', '');
            })
            ->find();
        
        return $courseItem !== null;
    }
    
    /**
     * 获取 contest 的 course_id（从 course_item 表）
     * 
     * @param int $contest_id 比赛ID
     * @return int|null 返回 course_id，如果不存在则返回 null
     */
    protected function GetContestCourseId($contest_id)
    {
        if(!$contest_id) {
            return null;
        }
        
        $courseItem = db('course_item')
            ->where([
                'item' => 'contest',
                'item_id' => $contest_id,
            ])
            ->field('course_id')
            // 兼容历史数据：pvrole 可能是 NULL 或空字符串
            ->where(function($q) {
                $q->whereNull('pvrole')->whereOr('pvrole', '');
            })
            ->find();
        
        return $courseItem ? $courseItem['course_id'] : null;
    }
    // ========== EXP 模式：课程权限检查函数结束 ==========

    // 注意：status_ajax 的查重开关 isStatusAjaxSimilarEnabled() 定义在 StatusAjaxTrait 中。
    // 各模块如需自定义（例如比赛内允许课程教师查看查重），应在具体 Controller 中重写该方法，
    // 避免与其他 trait 产生同名方法冲突（PHP Trait Collision）。

    /**
     * status_ajax 查重权限钩子（供 StatusAjaxTrait 调用）
     * 比赛内：比赛管理员 / EXP 模式课程教师放行
     */
    protected function statusAjaxSimilarExtraPermission()
    {
        // 比赛管理员（基于 contest_id 的管理权限）
        if (isset($this->contest) && isset($this->contest['contest_id']) && IsAdmin('contest', $this->contest['contest_id'])) {
            return true;
        }

        // EXP 模式：课程教师（基于 course_item 获取比赛归属）
        if (isset($this->OJ_STATUS) && $this->OJ_STATUS == 'exp' && isset($this->contest) && function_exists('PrivCourse')) {
            $course_key = GetItemCourseKey($this->contest, 'contest');
            if ($course_key && PrivCourse('teacher', $course_key)) {
                return true;
            }
        }

        return false;
    }
}
