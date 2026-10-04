<?php

namespace app\csgoj\controller;

use think\db\Expression;
use think\facade\Request;
use think\Controller;
use think\Db;
require_once(__DIR__ . "../../../common/traits/ContestBaseTrait.php");
use app\common\traits\ContestBaseTrait;
use app\common\traits\ContestActionTrait;

class Contest extends Csgojbase
{
    use ContestBaseTrait;
    use ContestActionTrait;
    var $contest;
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
    var $isAdmin;
    var $isContestAdmin;
    var $rankUseCache;
    // TP5.1：统一使用“二维条件数组”形式，避免 ['field'=>['<>',...]] 这种 TP5.0 风格写法
    var $topicDefaultMap = [['public_show', '<>', -1]];               // topic 的默认过滤逻辑
    
    var $isContestStaff=false;      // cpcsys使用，是否是包含proctor（contest内部admin）在内的工作人员
    var $isContestWorker=false;     // cpcsys使用，是否是balloon等无任何管理特权的工作人员
    var $proctorAdmin=false;        // cpcsys使用，是否是contest内部admin
    /** @var bool 合法 lvtk（直播投屏令牌）用于放行星榜等只读页面 */
    var $contestliveDisplayTokenOk = false;
    public function InitController()
    {
        // expsys 已独立为独立模块，不再需要重定向到 contestexp
        $this->ContestInit();
    }
    // ContestInit() 和 GetContestInfo() 方法已通过 ContestBaseTrait 提供
    // CanJoin() 和 IsContestAdmin() 方法已通过 ContestBaseTrait 提供
    public function ContestAuthenticationBase()
    {
        $this->contestliveDisplayTokenOk = $this->EvaluateContestliveDisplayToken();
        if ($this->contest['defunct'] == '1' && !$this->IsContestAdmin() && !$this->hasContestLiveConsoleAccess()) {
            // 比赛隐藏：赛管 / 赛内 admin / 观察员（直播）可进，其余拒绝
            $this->error('You cannot open this contest.', null, '', 1);
        }
        if ($this->CanJoin() || $this->IsContestAdmin() || $this->IsContestAdmin('admin')) {
            // 有参赛权或是该比赛管理员
            $this->canJoin = true;
        }
        if ($this->contestStatus == -1 && !$this->IsContestAdmin() && !$this->IsContestAdmin('admin')) {
            // 比赛尚未开始，且不是该比赛管理员
            $action = strtolower($this->request->action());
            // 处理printer和balloon的特殊情况，在cpcsys里有重载IsContestAdmin
            if ($action == "balloon" && $this->IsContestAdmin('balloon_manager') || $action == "print_status" && $this->IsContestAdmin('printer')) {
                $this->canJoin = true;
            } else if ($this->contestliveDisplayTokenOk && $this->IsContestliveDisplayRankishAction($action)) {
                // 有效直播投屏令牌：允许打开榜单相关只读页（嵌入投屏 iframe / 免登录）
            } else if ($action === 'contest_live' && $this->hasContestLiveConsoleAccess()) {
                // 赛前可进直播控制台（watcher / 赛管；与 contestPolicy.canAccessLiveConsole 一致）
            } else if (strtolower((string) $this->controller) === 'contestlive' && $this->hasContestLiveConsoleAccess()) {
                // ojtool 投屏页（live / 签发口令 Ajax 等）赛前放行，与 canAccessLiveConsole 一致
            } else if (!in_array($action, ['contest', 'contest_auth_ajax', 'contest_auth_passwordless_ajax', 'team_auth_type_ajax', 'contest_logout_ajax'])) {
                // ****** 除了 allowPublicVisitAction 外，这里还有个特殊处理， TODO：后续规范化
                $this->redirect("contest?cid=" . $this->contest['contest_id']);
            }
        }
    }
    public function ContestAuthentication()
    {
        $this->ContestAuthenticationBase();
        // 统一的策略 enforce（集中化，减少散落 if/redirect）
        $this->enforceContestAccessPolicy();
    }
    // GetVars(), ContestStatus(), ContestProblemId(), ProblemIdMap(), ContestType() 等方法已通过 ContestBaseTrait 提供
    // problemset(), problemset_ajax(), GetProblem(), GetResultShow(), IfCanSeeInfo() 等方法已通过 ContestBaseTrait 和 ContestActionTrait 提供
    // rank(), GetContestTeam(), GetContestData4Rank(), RankUserList(), FromLangMask() 等方法已通过 ContestBaseTrait 和 ContestActionTrait 提供
    // 注意：GetAwardRatio() 不在 ContestBaseTrait 或 ContestActionTrait 中，它只在 ContestAdminBaseTrait 中（用于 Admin 控制器）
    // TopicAuth(), topic_detail(), topic_del_ajax(), topic_add(), TopicSubmitDelay(), topic_add_ajax(), 
    // topic_change_status_ajax(), topic_list(), topic_num_ajax(), topic_list_ajax(), ProcessTopicProblemId() 等方法已通过 ContestBaseTrait 和 ContestActionTrait 提供

    // contest2print 旧 URL 重定向、msg()、msg_list_ajax() 等见 ContestActionTrait / ContestAdminBaseTrait
    
}
