<?php
/**
 * 比赛管理基础 Trait
 * 提供比赛管理相关的通用方法
 * 用于 csgoj、cpcsys、expsys、examsys 等模块的 Admin/Contestadmin 控制器
 * 
 * ACM OJ 系统（csgoj、cpcsys、admin）使用此 trait，不包含任何 course 逻辑
 * exp 系统（expsys、examsys、exadmin）继承此 trait，并通过 ContestAdminExpTrait 重载 hook 实现 course 相关逻辑
 */
namespace app\common\traits;

use app\common\funcs\ContestAwardMath;
use app\common\funcs\ContestAttachFile;
use app\common\funcs\ContestGroupId;
use think\Validate;
use think\Db;
use think\db\Expression;

trait ContestAdminBaseTrait
{
    var $TINFO_NAME_MAX = 100;
    var $TINFO_NAME_EN_MAX = 120;

    /**
     * 规范化 group_id 列表（逗号分隔或数组；分隔符支持英文逗号与中文逗号）
     * @param mixed $groupsRaw
     * @return array
     */
    protected function normalizeTeamGroups($groupsRaw, $contestId = null)
    {
        $groups = [];
        if (is_array($groupsRaw)) {
            $groups = $groupsRaw;
        } else if (is_string($groupsRaw) && trim($groupsRaw) !== '') {
            $groups = preg_split('/[,，]+/u', $groupsRaw);
        }
        $parsed = [];
        foreach ($groups as $gid) {
            $gid = trim(strval($gid));
            if ($gid === '') {
                continue;
            }
            $slashPos = strpos($gid, ' / ');
            if ($slashPos !== false) {
                $gid = trim(substr($gid, 0, $slashPos));
            }
            if ($gid === '') {
                continue;
            }
            if (strlen($gid) > 255) {
                $gid = substr($gid, 0, 255);
            }
            if (!preg_match('/^[A-Za-z0-9_]+$/', $gid)) {
                continue;
            }
            $parsed[] = $gid;
        }
        return ContestGroupId::normalizeList($parsed, $this->getContestGroupCanonicalMap($contestId));
    }

    /**
     * contest_group 规范 id 映射（小写键 → 规范 group_id）。
     *
     * @return array<string, string>
     */
    protected function getContestGroupCanonicalMap($contestId = null): array
    {
        $cid = intval($contestId ?? ($this->contest['contest_id'] ?? 0));
        if ($cid <= 0 || !method_exists($this, 'GetContestMeta')) {
            return [];
        }
        $meta = $this->GetContestMeta($cid, true);
        $groupList = is_array($meta['contest_group'] ?? null) ? $meta['contest_group'] : [];
        return ContestGroupId::buildCanonicalMap($groupList);
    }

    /**
     * 下发队伍生成 / 工作人员生成 / 滚榜照片等页用的 contestGroupContext。
     * cpcsys\controller\Contest::getContestGroupContext() 存在时优先使用（与气球、打印等赛务页一致：过滤空 group_id、按 group_id 去重）；
     * 否则回退 GetContestMeta。
     */
    protected function assignContestGroupContextForViews()
    {
        if (method_exists($this, 'getContestGroupContext')) {
            $ctx = $this->getContestGroupContext();
            $this->assign('contestGroupContext', [
                'groups' => is_array($ctx['groups'] ?? null) ? $ctx['groups'] : [],
                'is_multi_group' => !empty($ctx['is_multi_group']) ? 1 : 0,
            ]);
            return;
        }
        $meta = method_exists($this, 'GetContestMeta') ? $this->GetContestMeta($this->contest['contest_id'], true) : null;
        $this->assign('contestGroupContext', [
            'groups' => is_array($meta['contest_group'] ?? null) ? $meta['contest_group'] : [],
            'is_multi_group' => intval($meta['is_multi_group'] ?? 0),
        ]);
    }

    /**
     * 批量写入队伍分组映射
     * @param int $contestId
     * @param array $teamGroupRows
     * @return void
     */
    protected function saveTeamGroupRows($contestId, $teamGroupRows, $teamIds = null)
    {
        $contestId = intval($contestId);
        if ($contestId <= 0) {
            return;
        }
        if (is_array($teamIds)) {
            $teamIds = array_values(array_unique(array_filter(array_map('strval', $teamIds), function($teamId) {
                return trim($teamId) !== '';
            })));
            if (count($teamIds) > 0) {
                db('cpc_team_group')
                    ->where('contest_id', $contestId)
                    ->where('team_id', 'in', $teamIds)
                    ->delete();
            }
        } else {
            db('cpc_team_group')->where('contest_id', $contestId)->delete();
        }
        if (!is_array($teamGroupRows) || count($teamGroupRows) === 0) {
            cache('cpc_team_group_map_v1:' . $contestId, null);
            cache('cpc_team_ids_for_group_filter:' . $contestId . ':team', null);
            cache('cpc_team_ids_for_group_filter:' . $contestId . ':all', null);
            return;
        }
        db('cpc_team_group')->insertAll($teamGroupRows, true);
        cache('cpc_team_group_map_v1:' . $contestId, null);
        cache('cpc_team_ids_for_group_filter:' . $contestId . ':team', null);
        cache('cpc_team_ids_for_group_filter:' . $contestId . ':all', null);
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
    
    // ========== 权限管理钩子方法 ==========
    
    /**
     * 钩子方法：比赛创建后处理（用于添加权限等）
     * ACM OJ 默认添加管理员权限
     * exp 系统可重载此方法添加 owner 权限等
     * @param int $contest_id 比赛ID
     * @param array $contest_data 比赛数据
     * @return void
     */
    protected function afterContestCreated($contest_id, $contest_data = [])
    {
        // ACM OJ 系统：默认给创建者添加管理员权限
        if (method_exists($this, 'AddPrivilege') && IsLogin()) {
            $this->AddPrivilege(session('user_id'), 'contest', $contest_id);
        }
    }
    
    /**
     * 钩子方法：添加比赛用户权限（用于统一权限管理）
     * ACM OJ 直接插入 privilege_item
     * exp 系统可重载此方法实现特殊逻辑
     * @param string $user_id 用户ID
     * @param int $contest_id 比赛ID
     * @param string|null $pvrole 权限角色（null 表示参与者，'' 也表示参与者）
     * @return bool 是否成功
     */
    protected function addContestUserPrivilege($user_id, $contest_id, $pvrole = null)
    {
        $pvroleStored = ($pvrole === null || $pvrole === '') ? '' : $pvrole;
        $map = [
            'user_id' => $user_id,
            'rightitem' => 'contest',
            'item_id' => $contest_id,
            'pvrole' => $pvroleStored,
            'defunct' => '0'
        ];
        $privilege = db('privilege_item')->where($map)->find();
        if($privilege == null) {
            return db('privilege_item')->insert($map) !== false;
        }
        return true;
    }
    
    /**
     * 钩子方法：批量添加比赛用户权限
     * @param array $userList 用户ID列表
     * @param int $contest_id 比赛ID
     * @param string|null $pvrole 权限角色
     * @return bool 是否成功
     */
    protected function addContestUsersPrivilege($userList, $contest_id, $pvrole = null)
    {
        if (empty($userList)) {
            return true;
        }
        // privilege_item.pvrole 为 NOT NULL：参赛者统一写 ''；入参 null/'' 均视为参赛白名单
        $isParticipant = ($pvrole === null || $pvrole === '');
        $pvroleStored = $isParticipant ? '' : $pvrole;

        $del = db('privilege_item')->where([
            'rightitem' => 'contest',
            'item_id' => $contest_id,
        ]);
        if ($isParticipant) {
            $del->where(function ($q) {
                $q->whereNull('pvrole')->whereOr('pvrole', '');
            });
        } else {
            $del->where('pvrole', $pvroleStored);
        }
        $del->delete();

        $contest_user_add = [];
        foreach ($userList as $u) {
            if (strlen($u) > 30) {
                $this->error('User name "' . $u . '" too long');
            }
            $contest_user_add[] = [
                'user_id'    => $u,
                'rightitem'  => 'contest',
                'item_id'    => $contest_id,
                'pvrole'     => $pvroleStored,
                'defunct'    => '0'
            ];
        }
        
        if (count($contest_user_add) > 0) {
            return db('privilege_item')->insertAll($contest_user_add) !== false;
        }
        
        return true;
    }
    
    /**
     * 钩子方法：检查是否可以添加比赛用户
     * @param int $contest_id 比赛ID
     * @return bool
     */
    protected function canAddContestUser($contest_id)
    {
        // 默认允许（子类可重载实现权限检查）
        return true;
    }
    
    // ========== 初始化方法 ==========
    
    /**
     * 初始化方法
     */
    public function initialize()
    {
        $this->OJMode();
        $this->ContestInit();
        $this->AdminInit();
    }
    
    /**
     * 管理员初始化
     */
    public function AdminInit() {
        $action = strtolower($this->request->action());
        // 直播控制台：允许赛管 IsAdmin('contest') 或比赛内 watcher（与其它后台项的 IsContestAdmin 组合不同）
        if ($action === 'contest_live') {
            if (IsAdmin('contest', $this->contest['contest_id']) || $this->IsContestAdmin('watcher')) {
                return;
            }
        }
        if(!$this->IsContestAdmin() && !$this->IsContestAdmin('admin')) {
            $this->error("You are not admin.", '/' . $this->module . '/contest/contest?cid=' . $this->contest['contest_id'], '', 1);
        }
    }
    
    /**
     * 默认首页，重定向到比赛编辑页面
     */
    public function index()
    {
        $this->redirect("/$this->module/$this->controller/contest_edit?cid=" . input('get.cid'));
    }

    /**
     * 兼容入口：/module/admin/contest
     *
     * 历史上某些页面/按钮（例如“弹窗”）会跳到 /admin/contest，
     * 但本 Trait 实际的管理首页是 contest_edit。
     *
     * 若不提供该方法，ThinkPHP 会走 Controller::__call() 尝试渲染 admin/contest.php，
     * 从而触发 TemplateNotFoundException。
     */
    public function contest()
    {
        $cid = input('cid/d');
        if (!$cid) {
            $cid = input('get.cid/d');
        }
        if (!$cid) {
            $this->error('How did you find this page?', null, '', 1);
        }
        $this->redirect("/$this->module/$this->controller/contest_edit?cid=" . $cid);
    }
    
    /**
     * 滚榜页面
     */
    public function rank_roll() {
        return $this->fetch();
    }

    /**
     * 直播控制台（已迁至前台 /contest/contest_live，此处仅保留兼容重定向）
     */
    public function contest_live() {
        $cid = intval($this->contest['contest_id'] ?? 0);
        if ($cid <= 0) {
            $this->error('invalid contest');
        }
        $this->redirect('/' . $this->module . '/contest/contest_live?cid=' . $cid);
    }
    
    // ========== Contest Edit ==========
    
    /**
     * 比赛编辑页面
     */
    public function contest_edit() {
        $contest = $this->contest;
        $contest_md = db('contest_md')->where('contest_id', $contest['contest_id'])->find();
        if($contest_md != null) {
            // 合并 contest_md 中的 description 和 notification（Markdown 格式）
            if(isset($contest_md['description'])) {
                $contest['description'] = $contest_md['description'];
            }
            if(isset($contest_md['notification'])) {
                $contest['notification'] = $contest_md['notification'];
            }
        }
        $start = strtotime($contest['start_time']);
        $end = strtotime($contest['end_time']);
        $award_ratio = $contest['award_ratio'];
        $ratio_gold = $award_ratio % 1000; $award_ratio /= 1000;
        $ratio_silver = $award_ratio % 1000; $award_ratio /= 1000;
        $ratio_bronze = $award_ratio % 1000; $award_ratio /= 1000;
        
        $this->assign([
            'start_year'    => date('Y', $start),
            'start_month'   => date('m', $start),
            'start_day'     => date('d', $start),
            'start_hour'    => date('H', $start),
            'start_minute'  => date('i', $start),
            'end_year'      => date('Y', $end),
            'end_month'     => date('m', $end),
            'end_day'       => date('d', $end),
            'end_hour'      => date('H', $end),
            'end_minute'    => date('i', $end),
            'topteam'       => $contest['topteam'],
            'flg_award_qty_mode' => ContestAwardMath::normalizeQtyMode($contest['flg_award_qty_mode'] ?? 0),
            'ratio_gold'    => $ratio_gold,
            'ratio_silver'  => $ratio_silver,
            'ratio_bronze'  => $ratio_bronze,
            'frozen_minute' => $contest['frozen_minute'],
            'frozen_after'  => $contest['frozen_after'],
            'contest'       => $contest
        ]);

        // expsys：该页面语义是“练习设置”，不要显示默认的 "Contest {cid} contest_edit"
        if ($this->module === 'expsys') {
            $this->assign('pagetitle', '修改练习设置');
        }
        // cpcsys / csgoj（online）：覆盖 SetAssign 的「Contest {cid} {action}」，与 contest_edit 模板中英配对
        if ($this->module === 'cpcsys' || $this->module === 'csgoj') {
            $this->assign('pagetitle', '比赛设置');
        }
        return $this->fetch();
    }

    /**
     * 获取比赛分组配置
     */
    public function contest_group_list_ajax()
    {
        $rows = $this->GetContestGroupList($this->contest['contest_id']);
        return $rows ?: [];
    }
    
    /**
     * 计算语言掩码
     */
    public function CalLangMask($languages)
    {
        $ret = LangList2LangMask($languages);
        if($ret == -1) $this->error('Please select at least 1 language.');
        if($ret == -2) $this->error('Some languages are not allowed for this OJ.');
        return $ret;
    }
    
    /**
     * 比赛添加/编辑：从 POST 抽出「简版 contest_edit 表单」覆盖的列。
     *
     * 故意不包含 title/private/password 等大后台字段 —— contest_edit_ajax 用 array_replace(库中整行, 本数组)
     * 再 UPDATE，未列出的列保持原值。新增比赛若走 contest_add_ajax，须在 Trait 外补全默认列。
     */
    public function contest_addedit_ajax_process()
    {
        $postData = input('post.');
        $contest_info = [
            'start_time'    =>
                trim($postData['start_year']).'-'.
                trim($postData['start_month']).'-'.
                trim($postData['start_day']).' '.
                trim($postData['start_hour']).':'.
                trim($postData['start_minute']).':'.
                '0',
            'end_time'    =>
                trim($postData['end_year']).'-'.
                trim($postData['end_month']).'-'.
                trim($postData['end_day']).' '.
                trim($postData['end_hour']).':'.
                trim($postData['end_minute']).':'.
                '0',
            'langmask'    => $this->CalLangMask(isset($postData['language']) ? $postData['language'] : []), 
            'description' => trim($postData['description'] ?? ''),
            'notification' => trim($postData['notification'] ?? ''),
            'frozen_minute' => intval($postData['frozen_minute']),
            'frozen_after' => intval($postData['frozen_after'])
        ];
        try {
            $contest_info = array_replace($contest_info, \app\common\funcs\CcpcRules::settings($postData, $this->contest ?? []));
        } catch (\InvalidArgumentException $e) { $this->error($e->getMessage()); }
        if($contest_info['frozen_minute'] > 2592000 || $contest_info['frozen_after'] > 2592000)
            $this->error('Frozen time too long.');
        $contest_md_info = [
            'description' => $contest_info['description'],
            'notification' => $contest_info['notification'],
        ];
        //插入contest表，描述字段和公告字段为md编译的html
        $contest_info['description'] = ParseMarkdown($contest_md_info['description']);
        $contest_info['notification'] = ParseMarkdown($contest_md_info['notification']);
        if(!strtotime($contest_info['start_time']) || !strtotime($contest_info['end_time']))
            $this->error('Time syntax error.');
        $starttime = strtotime($contest_info['start_time']);
        $endtime = strtotime($contest_info['end_time']);
        if($starttime >= $endtime) {
            $this->error('Start Time should before End Time.');
        }
        $contest_info['topteam'] = intval($postData['topteam']);
        if($contest_info['topteam'] > 20) {
            $contest_info['topteam'] = 20;
        }
        if($contest_info['topteam'] < 1){
            $contest_info['topteam'] = 1;
        }
        $ratio_gold = intval($postData['ratio_gold']);
        $ratio_silver = intval($postData['ratio_silver']);
        $ratio_bronze = intval($postData['ratio_bronze']);
        $flg_award_qty_mode = ContestAwardMath::normalizeQtyMode($postData['flg_award_qty_mode'] ?? 0);
        $errAward = ContestAwardMath::validateAwardTripleI18n($ratio_gold, $ratio_silver, $ratio_bronze, $flg_award_qty_mode);
        if ($errAward !== null) {
            $this->errorBilingual($errAward['msg_cn'], $errAward['msg_en']);
        }
        $contest_info['award_ratio'] = ContestAwardMath::pack($ratio_gold, $ratio_silver, $ratio_bronze);
        $contest_info['flg_award_qty_mode'] = $flg_award_qty_mode;
        //过滤时间格式，否则插入数据库可能出错
        $contest_info['start_time'] = date('Y-m-d H:i:s', $starttime);
        $contest_info['end_time'] = date('Y-m-d H:i:s', $endtime);
        return [$contest_info, $contest_md_info];
    }
    
    /**
     * 比赛编辑提交（赛内小后台 / csgoj Admin / ojtool 等走本 Trait）。
     *
     * 职责边界：`contest` 主表 + `contest_md`。**不**读写 `contest_group`。
     * `contest_group` 仅由大后台 **`admin\controller\Contest::contest_edit_ajax` / `contest_add_ajax`**
     * 内 **`saveContestGroupsCompat`** 落库（与 `$module == 'admin'` 的 `contest_edit` 表单同源）。
     */
    public function contest_edit_ajax()
    {
        if(!$this->IsContestAdmin()) {
            $this->error('Powerless');
        }
        $this->assertContestNotArchivedForWrite();
        
        $ret = $this->contest_addedit_ajax_process();
        $contest_edit = $ret[0];
        $contest_md_edit = $ret[1];

        $contestinfo = array_replace($this->contest, $contest_edit);

        db('contest')->update($contestinfo);
        // contest已更新，下面处理contest_md（description 和 notification）
        $contest_md = db('contest_md')->where('contest_id', $this->contest['contest_id'])->find();
        $contest_md_edit['contest_id'] = $this->contest['contest_id'];
        if(!$contest_md) {
            db('contest_md')->insert($contest_md_edit);
        }
        else
        {
            db('contest_md')->where('contest_id', $this->contest['contest_id'])->update($contest_md_edit);
        }
        if (method_exists($this, 'InvalidateContestMetaCache')) {
            $this->InvalidateContestMetaCache($this->contest['contest_id']);
        }
        $this->success('Contest successfully modified.');
    }
    
    // ========== Contest Rejudge ==========
    
    /**
     * 比赛重判页面
     */
    public function contest_rejudge() {
        if(!$this->IsContestAdmin()) {
            $this->error("No privilege to rejudge");
        }
        if (isset($this->contest['flg_archive']) && intval($this->contest['flg_archive']) !== 0) {
            $this->errorBilingual(
                '比赛已归档，不提供重判',
                'Contest is archived; rejudge is disabled.',
                null,
                ['contest_write_blocked' => 'archived']
            );
        }
        $contestKind = $this->contest['private'] % 10;
        $assign = [
            'rejudge_type' => 'contest', 
            'cid' => $this->contest['contest_id'], 
            'submit_url' => '/' . $this->module . '/' . $this->controller . '/contest_rejudge_ajax?cid=' . $this->contest['contest_id'],
            // 题号输入模式：传统比赛用 ABC；考试用 Qid（Q1,Q2... 或 1,2...）
            'rejudge_problem_id_mode' => ($contestKind == 5 ? 'exam_qid' : 'alphabet'),
            // 按语言重判：语言列表与比赛标题（提交号与题号都为空时需用户输入确认）
            'rejudge_language_list' => config('CsgojConfig.OJ_LANGUAGE'),
            'contest_title' => isset($this->contest['title']) ? $this->contest['title'] : '',
        ];
        
        // 标题支持按模块定制（默认：比赛重判）
        if($this->module === 'examsys') {
            $assign['rejudge_title_cn'] = '考试编程题重测';
            $assign['rejudge_title_en'] = 'Exam Problem Rejudge';
        }
        
        $this->assign($assign);
        return $this->fetch();
    }
    
    /**
     * 比赛重判提交
     */
    public function contest_rejudge_ajax() {
        // 比赛内题目重判
        if(!$this->IsContestAdmin()) {
            $this->error("No privilege to rejudge");
        }
        $this->assertContestNotArchivedForWrite();
        $solution_id = trim(input('solution_id'));
        $problem_alphabet_id = trim(input('problem_id'));
        $rejudge_res_check = input('rejudge_res_check/a');
        $rejudge_language_ids = input('rejudge_language_ids/a');
        $map = ['contest_id' => $this->contest['contest_id']];
        if($rejudge_res_check === null) {
            $rejudge_res_check = [];
        }
        if($rejudge_language_ids === null || !is_array($rejudge_language_ids)) {
            $rejudge_language_ids = [];
        }
        $rejudge_language_ids = array_values(array_filter(array_map('intval', $rejudge_language_ids), function($v){ return $v >= 0; }));
        $oj_language_keys = array_keys(config('CsgojConfig.OJ_LANGUAGE') ?: []);
        $rejudge_language_ids = array_intersect($rejudge_language_ids, $oj_language_keys);
        $addUrl = '';
        $contestKind = $this->contest['private'] % 10;
        
        // 构建更新条件
        $updateMap = ['contest_id' => $this->contest['contest_id']];
        
        // 修复 ThinkPHP 5.1 IN 查询：将 IN 查询改为链式调用，避免数组格式解析错误
        if(!in_array('any', $rejudge_res_check)) {
            $updateMap['result'] = ['in', $rejudge_res_check];
        }
        
        if($solution_id != '') {
            $solutionIdList = explode(',', $solution_id);
            $updateMap['solution_id'] = ['in', $solutionIdList];
            $addUrl = '#solution_id=' . $solutionIdList[0];
        }
        else if($problem_alphabet_id != null && strlen($problem_alphabet_id) > 0) {
            $problemAlphabetIdList = array_filter(array_map('trim', explode(',', $problem_alphabet_id)), function($v){ return $v !== ''; });
            $problemNumIdList = [];
            if($contestKind == 5) {
                // exam
                foreach($problemAlphabetIdList as $qid) {
                    // 支持 Q1/Q2... 或 1/2...（忽略大小写 Q 前缀）
                    $qid = preg_replace('/^[Qq]/', '', $qid);
                    if($qid === '' || !ctype_digit($qid)) {
                        return $this->error("考试模式题号请使用 Qid（如 Q1,Q2 或 1,2）<br/>Invalid Qid in exam mode.");
                    }
                    $problemNumIdList[] = intval($qid);
                }
            } else {
                // tradition contest
                foreach($problemAlphabetIdList as $pAID) {
                    $problemNumIdList[] = Alphabet2Num($pAID);
                }
            }
            // 修复 ThinkPHP 5.1 IN 查询格式问题：使用链式调用避免数组格式解析错误
            $problemList = db('contest_problem')
                ->where('contest_id', $this->contest['contest_id'])
                ->where('num', 'in', $problemNumIdList)
                ->field('problem_id')
                ->select();
            $problemIdList = [];
            
            foreach($problemList as $prob) {
                $problemIdList[] = $prob['problem_id'];
            }
            if($contestKind == 5) {
                // exam：
                // contest_problem.problem_id 存的是“题目/考题”的数值 ID（ex_question_id 或 problem_id），
                // 重判必须使用数值 ID 去匹配 solution.problem_id。
                // 旧逻辑把 problem_id 错误替换为 ex_question.description（中文题干），会导致 SQL 变成：
                //   WHERE problem_id = 算法指的是（ ）
                // 从而触发数据库报错。
                $problemIdList = array_values(array_filter(array_map('intval', $problemIdList), function($v){ return $v > 0; }));
            }
            if(empty($problemIdList)) {
                return $this->error("未找到对应题目<br/>No matched problem.");
            }
            $updateMap['problem_id'] = ['in', $problemIdList];
            $addUrl = '#problem_id=' . $problemAlphabetIdList[0];
        } else {
            // 提交号与题号都为空：仅支持按语言重判，且必须至少选择一种语言
            if(empty($rejudge_language_ids)) {
                return $this->error("提交号与题号都为空时，请至少选择一种语言进行重判<br/>When both solution_id and problem_id are empty, please select at least one language.");
            }
            $addUrl = '#by_language';
        }
        
        // 按语言筛选：若前端传了语言列表则只重判这些语言（未传或空表示全部语言）
        if(!empty($rejudge_language_ids)) {
            $updateMap['language'] = ['in', $rejudge_language_ids];
        }
        
        // 构建查询对象并执行更新
        $Solution = db('solution');
        foreach($updateMap as $key => $value) {
            if(is_array($value) && count($value) == 2 && $value[0] == 'in') {
                $Solution->where($key, 'in', $value[1]);
            } else {
                $Solution->where($key, $value);
            }
        }
        $Solution->update([
            'result'    => 1,
            'memory'    => 0,
            'time'      => 0,
            'pass_rate' => 0
        ]);
        $jumpurl = '/' . ($this->OJ_MODE == 'online' ? 'csgoj' : 'cpcsys') . '/contest/status?cid=' . $this->contest['contest_id'] . $addUrl;
        return $this->success('Rejudge started', '', $jumpurl);
    }
    
    // ========== Award Related ==========

    /**
     * 解析 contest.award_ratio（bronze * 1000000 + silver * 1000 + gold）
     * @return array [ratio_gold, ratio_silver, ratio_bronze]
     */
    protected function GetAwardRatio() {
        $contest = isset($this->contest) ? $this->contest : null;
        $award_ratio_raw = is_array($contest) && array_key_exists('award_ratio', $contest) ? $contest['award_ratio'] : 0;
        $award_ratio = intval($award_ratio_raw);

        $ratio_gold = $award_ratio % 1000; $award_ratio = intdiv($award_ratio, 1000);
        $ratio_silver = $award_ratio % 1000; $award_ratio = intdiv($award_ratio, 1000);
        $ratio_bronze = $award_ratio % 1000;
        return [$ratio_gold, $ratio_silver, $ratio_bronze];
    }
    
    /**
     * 奖项页面
     */
    public function award() {
        if(!$this->IsContestAdmin()) {
            $this->error('Permission denied to see award', '/', '', 1);
        }
        $award_ratio = $this->GetAwardRatio();
        $meta = $this->GetContestMeta(intval($this->contest['contest_id']), true);
        $isMultiGroup = intval($meta['is_multi_group'] ?? 0) === 1;
        //设置school筛选表数据
        $this->assign([
            'contest'       => $this->contest,
            // 'user_id'       => $this->contest_user,
            'ratio_gold'    => $award_ratio[0],
            'ratio_silver'  => $award_ratio[1],
            'ratio_bronze'  => $award_ratio[2],
            'award_is_multi_group' => $isMultiGroup ? 1 : 0,
        ]);
        return $this->fetch();
    }

    /**
     * 颁奖编排页面（独立于奖项主表）
     */
    public function award_deck() {
        if(!$this->IsContestAdmin()) {
            $this->error('Permission denied to see award deck', '/', '', 1);
        }
        $award_ratio = $this->GetAwardRatio();
        $this->assign([
            'contest'       => $this->contest,
            'ratio_gold'    => $award_ratio[0],
            'ratio_silver'  => $award_ratio[1],
            'ratio_bronze'  => $award_ratio[2],
        ]);
        return $this->fetch('admin/award_deck');
    }
    
    // ========== Contest Message ==========
    
    /**
     * 消息权限验证
     */
    protected function MsgAuth() {
        if(!$this->IsContestAdmin('admin')) {
            $this->error("No Privilege to Send Message");
        }
    }
    
    /**
     * 消息页面
     */
    public function msg() {
        $this->MsgAuth();
        return $this->fetch();
    }
    
    /**
     * 消息列表
     */
    public function msg_ajax() {
        $this->MsgAuth();
        return db('contest_msg')->where(['contest_id' => $this->contest['contest_id']])->select();
    }
    
    /**
     * 消息添加/编辑
     */
    public function msg_add_edit_ajax() {
        $this->MsgAuth();
        $this->assertContestNotArchivedForWrite();
        $msg_id = input('msg_id/d');
        $content = input('content/s');
        if (strlen($content) > 255) {
            $this->error("消息过长<br/>Message too long");
        }
        $ContestMsg = db('contest_msg');
        if(!$msg_id) {
            $ContestMsg->insert([
                'content'       => $content,
                'contest_id'    => $this->contest['contest_id'],
                'in_date'       => date('Y-m-d H:i:s'),
                'defunct'       => 1,
                'team_id'       => $this->contest_user ? $this->SolutionUser($this->contest_user, true) : session('user_id')
            ]);
        } else {
            $msg = $ContestMsg->where('msg_id', $msg_id)->find();
            if(!$msg || $msg['contest_id'] != $this->contest['contest_id']) {
                $this->error("no such message");
            }
            $msg['content'] = $content;
            $msg['team_id'] = $this->contest_user ? $this->SolutionUser($this->contest_user, true) : session('user_id');
            $msg['in_date'] = date('Y-m-d H:i:s');
            $ContestMsg->update($msg);
        }
        $this->success('ok');
    }
    
    /**
     * 消息状态变更
     */
    public function msg_status_change_ajax() {
        $this->MsgAuth();
        $this->assertContestNotArchivedForWrite();
        $msg_id = input('msg_id/d');
        $msg = db('contest_msg')->where(['msg_id' => $msg_id,  'contest_id' => $this->contest['contest_id']])->find();
        if(!$msg) {
            $this->error("no such message");
        }
        $msg['defunct'] = input('defunct/d');
        if($msg['defunct'] == 0) {
            $msg['in_date'] = date('Y-m-d H:i:s');
        }
        db('contest_msg')->update($msg);
        $this->success('Status to ' . ($msg['defunct'] == 1 ? 'Prepared' : 'Sent'), null, $msg);
    }

    // ========== 外榜 ==========
    
    /**
     * 外榜页面
     */
    public function outrank() {
        return $this->fetch();
    }

    /**
     * 下载外榜命令行推送工具可执行文件（仅二进制；ZIP 与 config.json 由管理端外榜页面前端组装，其中 app_timezone 读 #csg-app-tz-root，与 global.js 一致）
     * GET /{module}/admin/outrank_push_tool_binary?cid=...&os=linux|windows
     */
    public function outrank_push_tool_binary()
    {
        if (!$this->isContestAdmin && !IsAdmin('administrator')) {
            $this->error('Permission denied', null, '', 1);
        }
        $os = strtolower(trim(input('os/s', '')));
        if (!in_array($os, ['linux', 'windows'], true)) {
            $this->error('Invalid os', null, '', 1);
        }
        $cid = intval($this->contest['contest_id'] ?? 0);
        if ($cid <= 0) {
            $this->error('Invalid contest', null, '', 1);
        }
        $root = \think\facade\App::getRootPath() . 'public' . DIRECTORY_SEPARATOR . 'static' . DIRECTORY_SEPARATOR . 'plugin' . DIRECTORY_SEPARATOR . 'outrank' . DIRECTORY_SEPARATOR;
        if ($os === 'linux') {
            $binName = 'csg_outrank_push_linux_amd64';
        } else {
            $binName = 'csg_outrank_push_windows_amd64.exe';
        }
        $binPath = $root . $binName;
        if (!is_file($binPath)) {
            $this->error('Tool binary not found: ' . $binName, null, '', 1);
        }
        $data = file_get_contents($binPath);
        if ($data === false) {
            $this->error('Tool binary read failed', null, '', 1);
        }

        return response($data, 200, [
            'Content-Type' => 'application/octet-stream',
            'Content-Disposition' => 'attachment; filename="' . $binName . '"',
            'Cache-Control' => 'no-store',
        ]);
    }
    
    // ========== CPC 系统通用管理方法（cpcsys 模块使用） ==========
    
    /**
     * 获取队伍列表（CPC 系统专用）
     */
    public function teamgen_list_ajax() {
        $ttype = input('ttype/d');
        $whereRaw = $ttype ? 'privilege is not null' : 'privilege is null';
        $teamList = db('cpc_team')->where(['contest_id' => $this->contest['contest_id']])
        ->where(function($query){
            $query->whereNull('privilege')->whereOr('privilege', '<>', 'reviewer');
        })
        ->whereRaw($whereRaw)
        ->order('team_id', 'asc')->select();
        foreach($teamList as $key=>&$val) {
            $val['password'] = RecoverPasswd($val['password']);
        }
        $teamGroupRows = db('cpc_team_group')
            ->where('contest_id', $this->contest['contest_id'])
            ->field(['team_id', 'group_id'])
            ->select();
        $teamGroupMap = [];
        foreach ($teamGroupRows as $row) {
            $tid = $row['team_id'];
            if (!isset($teamGroupMap[$tid])) {
                $teamGroupMap[$tid] = [];
            }
            $teamGroupMap[$tid][] = $row['group_id'];
        }
        $canonicalMap = $this->getContestGroupCanonicalMap($this->contest['contest_id']);
        foreach ($teamList as &$val) {
            $gidList = isset($teamGroupMap[$val['team_id']]) ? $teamGroupMap[$val['team_id']] : [];
            $gidList = ContestGroupId::normalizeList($gidList, $canonicalMap);
            $val['group_ids'] = $gidList;
            $val['groups'] = implode(',', $gidList);
        }
        return $teamList;
    }
    
    /**
     * 获取气球配送员列表（staff，privilege为balloon_sender）
     */
    public function team_list_ajax() {
        // 检查权限（需要balloonManager或isContestAdmin）
        if (!$this->balloonManager && !$this->isContestAdmin) {
            $this->error('Permission denied');
        }
        
        $ttype = input('ttype/d', 0);
        $cid = input('cid/d');
        
        if (!$cid) {
            $this->error('Missing contest ID');
        }
        
        // 如果ttype=1，筛选privilege为balloon_sender的staff
        if ($ttype == 1) {
            $teamList = db('cpc_team')->where([
                'contest_id' => $cid,
                'privilege' => 'balloon_sender'
            ])->field(['team_id', 'name', 'room'])->order('team_id', 'asc')->select();
        } else {
            $teamList = [];
        }
        
        $this->success('', null, ['team_list' => $teamList]);
    }
    
    /**
     * 队伍信息修改页面
     */
    public function team_modify() {
        return $this->fetch();
    }
    
    /**
     * 获取队伍信息
     */
    public function teaminfo_ajax() {
        $team_id = input('team_id');
        $teamInfo = db('cpc_team')->where(['team_id' => $team_id, 'contest_id' => $this->contest['contest_id']])->find();
        if(!$teamInfo) {
            $this->error("No such team.");
        }
        $teamInfo['password'] = '';
        $this->success('', null, ['teaminfo' => $teamInfo]);
    }
    
    /**
     * 修改队伍信息
     */
    public function team_modify_ajax() {
        $this->assertContestNotArchivedForWrite();
        $team_id = input('team_id');
        $teamInfo = db('cpc_team')->where(['team_id' => $team_id, 'contest_id' => $this->contest['contest_id']])->find();
        if(!$teamInfo) {
            $this->error("No such team.");
        }
        if($teamInfo['privilege'] == 'admin' && !IsAdmin('contest', $this->contest['contest_id'])) {
            $this->error("Information of administrator could not be modified.");
        }
        $staffModifyMode = input('staff_modify_mode') === '1' || input('staff_modify_mode/b', false);
        $isStaffAccount = ($teamInfo['privilege'] !== null && $teamInfo['privilege'] !== '' && $teamInfo['privilege'] !== 'reviewer');

        if ($staffModifyMode) {
            if (!$isStaffAccount) {
                $this->error('Not a staff account.');
            }
            $teamUpdate = [
                'name' => input('name'),
                'room' => input('room'),
                'password' => input('password'),
            ];
            if (strlen($teamUpdate['name']) > $this->TINFO_NAME_MAX) {
                $this->error("team name too long");
            }
            if (trim($teamUpdate['password']) == '') {
                unset($teamUpdate['password']);
            } else {
                $teamUpdate['password'] = MkPasswd($teamUpdate['password'], True);
            }
            $privIn = trim((string)input('privilege/s', ''));
            if ($privIn !== '') {
                $allowedPriv = ['admin', 'printer', 'balloon_manager', 'balloon_sender', 'watcher', 'ccs_reader'];
                if (!in_array($privIn, $allowedPriv, true)) {
                    $this->error('Invalid privilege value.');
                }
                if ($privIn === 'admin' && !IsAdmin('contest', $this->contest['contest_id'])) {
                    $this->error("Can't set administrator privilege.");
                }
                $teamUpdate['privilege'] = $privIn;
            }
            $teamInfo = array_replace($teamInfo, $teamUpdate);
        } else {
            $teamUpdate = [
                'name'      => input('name'),
                'name_en'   => input('name_en'),
                'tmember'   => input('tmember'),
                'coach'     => input('coach'),
                'school'    => input('school'),
                'region'    => input('region'),
                'password'  => input('password'),
                'room'      => input('room'),
                'tkind'     => intval(input('tkind')),
            ];
            if(strlen($teamUpdate['name']) > $this->TINFO_NAME_MAX) {
                $this->error("team name too long");
            }
            if(strlen($teamUpdate['name_en']) > $this->TINFO_NAME_EN_MAX) {
                $this->error("team name_en too long");
            }
            if(trim($teamUpdate['password']) == '') {
                unset($teamUpdate['password']);
            }
            else {
                $teamUpdate['password'] = MkPasswd($teamUpdate['password'], True);
            }
            if($teamUpdate['tkind'] > 2 || $teamUpdate['tkind'] < 0) {
                $teamUpdate['tkind'] = 0;
            }
            $teamInfo = array_replace($teamInfo, $teamUpdate);
        }
        db('cpc_team')->where(['team_id' => $team_id, 'contest_id' => $this->contest['contest_id']])->update($teamInfo);
        $groupIds = $this->normalizeTeamGroups(input('group_ids/a', input('groups/s', '')));
        db('cpc_team_group')->where([
            'contest_id' => $this->contest['contest_id'],
            'team_id' => $team_id,
        ])->delete();
        if (count($groupIds) > 0) {
            $rows = [];
            foreach ($groupIds as $gid) {
                $rows[] = [
                    'contest_id' => $this->contest['contest_id'],
                    'team_id' => $team_id,
                    'group_id' => $gid,
                    'in_date' => date('Y-m-d H:i:s'),
                ];
            }
            db('cpc_team_group')->insertAll($rows, true);
        }
        if (method_exists($this, 'InvalidateContestMetaCache')) {
            $this->InvalidateContestMetaCache($this->contest['contest_id']);
        }
        cache('cpc_team_group_map_v1:' . intval($this->contest['contest_id']), null);
        cache('cpc_team_ids_for_group_filter:' . intval($this->contest['contest_id']) . ':team', null);
        cache('cpc_team_ids_for_group_filter:' . intval($this->contest['contest_id']) . ':all', null);
        $teamInfo['group_ids'] = $groupIds;
        $teamInfo['groups'] = implode(',', $groupIds);
        $teamInfo['password'] = RecoverPasswd($teamInfo['password']);
        $this->success("ok", null, $teamInfo);
    }
    
    /**
     * IP 检查权限验证
     */
    public function IpCheckAuth()
    {
        if(!$this->isContestAdmin && !$this->proctorAdmin)
            $this->error('Permission denied to see ipcheck', '/', '', 1);
    }
    
    /**
     * IP 检查页面
     */
    public function ipcheck()
    {
        $this->IpCheckAuth();
        $this->assign('ipcheck');
        return $this->fetch();
    }
    
    /**
     * IP 检查数据
     */
    public function ipcheck_ajax()
    {
        $this->IpCheckAuth();
        $lgCheckStart = date("Y-m-d H:i:s", strtotime("-1 hour", strtotime($this->contest['start_time'])));
        $lgCheckEnd = date("Y-m-d H:i:s", strtotime("+10 minute", strtotime($this->contest['end_time'])));
        $cid = $this->contest['contest_id'];
        $uidPrefix = '#cpc' . $cid . '_';
        $contestUserLog = db('loginlog')->alias('lg')
            ->join('cpc_team', 'CONCAT("' . $uidPrefix . '",cpc_team.team_id) = lg.user_id')
            ->where('cpc_team.contest_id', $this->contest['contest_id'])
            ->whereBetween('lg.time', [$lgCheckStart, $lgCheckEnd])
            ->group('lg.user_id, lg.ip, cpc_team.name')
            ->field([
                'lg.user_id team_id',
                'lg.ip ip',
                'Max(lg.time) time',
                'cpc_team.name name',
            ])
            ->order('time', 'asc')
            ->select();
        $userIps = [];
        $ipUsers = [];
        foreach($contestUserLog as $userLog)
        {
            $userLog['team_id'] = $this->SolutionUser($userLog['team_id'], false);
            if(!array_key_exists($userLog['team_id'], $userIps))
                $userIps[$userLog['team_id']] = [
                    'name' => $userLog['name'],
                    'ips' => []
                ];
            $userIps[$userLog['team_id']]['ips'][] = [
                'ip' => $userLog['ip'],
                'time' => $userLog['time']
            ];
            if(!array_key_exists($userLog['ip'], $ipUsers))
                $ipUsers[$userLog['ip']] = [];
            $ipUsers[$userLog['ip']][] = [
                'team_id' => $userLog['team_id'],
                'name' => $userLog['name'],
                'time' => $userLog['time']
            ];
        }
        foreach($userIps as $k=>$v) {
            if(count($v['ips']) <= 1)
                unset($userIps[$k]);
        }
        foreach($ipUsers as $k=>$v) {
            if(count($v) <= 1)
                unset($ipUsers[$k]);
        }
        $this->success("Successful", null, ['userIps' => $userIps, 'ipUsers'=>$ipUsers]);
    }
    
    /**
     * 比赛队伍生成页面
     */
    public function contest_teamgen() {
        if(!$this->isContestAdmin) {
            $this->error('Permission denied to gen teams', '/', '', 1);
        }
        if(!in_array($this->contest['private'] % 10, [2, 5])) {
            // 2是standard，5是exam
            $this->error("This contest could not generate teams.");
        }
        if (!$this->isContestSysAdminForContest()) {
            $this->error("You are not system administrator.");
        }
        if($this->contestStatus == 2 && !IsAdmin('super_admin')) {
            $this->error("You'd better not modify teams after contest ended.");
        }
        $this->assignContestGroupContextForViews();
        $this->assign('action', 'contest_teamgen');
        return $this->fetch();
    }
    
    /**
     * 比赛工作人员生成页面
     */
    public function contest_staffgen() {
        if(!$this->isContestAdmin) {
            $this->error('Permission denied to gen staffs', '/', '', 1);
        }
        if(!in_array($this->contest['private'] % 10, [2, 5])) {
            // 2是standard，5是exam
            $this->error("This contest could not generate staffs.");
        }
        if (!$this->isContestSysAdminForContest()) {
            $this->error("You are not system administrator.");
        }
        if($this->contestStatus == 2 && !IsAdmin('super_admin')) {
            $this->error("You'd better not modify staffs after contest ended.");
        }
        $this->assignContestGroupContextForViews();
        return $this->fetch('contest_teamgen');
    }
    
    /**
     * 比赛队伍生成（CPC 系统专用，用于 standard contest）
     * 注意：exp 系统会重载此方法实现不同的逻辑
     */
    public function contest_teamgen_ajax() {
        if(!$this->isContestAdmin) {
            $this->error('Permission denied to gen teams', '/', '', 1);
        }
        $this->assertContestNotArchivedForWrite();
        if($this->contest['private'] % 10 != 2) {
            $this->error("This contest could not generate teams.");
        }
        if (!$this->isContestSysAdminForContest()) {
            $this->error("You are not system administrator.");
        }
        if($this->contestStatus == 2 && !IsAdmin('super_admin')) {
            $this->error("You'd better not modify teams after contest ended.");
        }
        
        // 获取POST数据
        $teamList = input('team_list');
        $reset_team = input('reset_team', false);
        $password_seed = input('password_seed', 0);
        
        // 获取区分参数：staff=1 或 ttype=1 表示工作人员生成，否则为队伍生成
        $isStaff = input('staff', 0) == 1 || input('ttype', 0) == 1;
        
        if (!$teamList) {
            $this->error('No team data provided');
        }
        
        // 解析JSON数据
        $teams = json_decode($teamList, true);
        if (!$teams || !is_array($teams)) {
            $this->error('Invalid team data format');
        }
        
        // 根据区分参数决定清空哪种类型的账号
        if($reset_team === 1 || $reset_team === true || $reset_team === 'on' || $reset_team === 'true') {
            // isStaff=true 时清空工作人员账号（privilege不为null），否则清空普通队伍（privilege为null）
            $this->ClearTeam($isStaff);
        }
        
        $teamPrefix = "team";
        
        if(count($teams) == 0) {
            $this->error('No teams to generate');
        }
        if(count($teams) > 5000) {
            $this->error('Too many teams');
        }
        
        $teamToInsert = [];
        $teamToShow = [];
        $teamGroupRows = [];
        $teamGroupTeamIds = [];
        $validate = new Validate(config('CpcSysConfig.teaminfo_rule'), config('CpcSysConfig.teaminfo_msg'));
        $validateNotList = '';
        
        // 检查team_id重复
        $teamIds = [];
        foreach($teams as $teamData) {
            $teamId = $teamData['team_id'] ?? '';
            if($teamId != '') {
                if(in_array($teamId, $teamIds)) {
                    $this->error("Duplicate team_id found: " . $teamId);
                }
                $teamIds[] = $teamId;
            }
        }

        // TP5.1：避免 where(['field'=>['like', ...]]) 这种 TP5.0 风格数组写法，统一使用显式 where
        $i = db('cpc_team')->where('team_id', 'like', 'team%')
            ->where('contest_id', '=', $this->contest['contest_id'])
            ->count() + 1;
        
        foreach($teams as $teamData) {
            $nowTeam = [];
            
            // 处理team_id（必须提供，不允许为空）
            $teamId = $teamData['team_id'] ?? '';
            if($teamId == '') {
                $this->error('Team ID is required for all teams');
            }
            $nowTeam['team_id'] = $teamId;
            
            // 处理其他字段
            $nowTeam['name'] = $teamData['name'] ?? '';
            $nowTeam['name_en'] = $teamData['name_en'] ?? '';
            $nowTeam['school'] = $teamData['school'] ?? '';
            $nowTeam['region'] = $teamData['region'] ?? '';
            $nowTeam['tmember'] = $teamData['tmember'] ?? '';
            $nowTeam['coach'] = $teamData['coach'] ?? '';
            $nowTeam['room'] = $teamData['room'] ?? '';
            $nowTeam['tkind'] = intval($teamData['tkind'] ?? 0);
            if($nowTeam['tkind'] > 2 || $nowTeam['tkind'] < 0) {
                $nowTeam['tkind'] = 0;
            }
            
            // 处理密码
            $password = $teamData['password'] ?? '';
            if($password == '') {
                $password = $this->generateSeededPassword($teamId, $password_seed);
            }
            $nowTeam['password'] = $password;
            
            $nowTeam['contest_id'] = $this->contest['contest_id'];
            // 处理privilege字段（工作人员权限）
            $nowTeam['privilege'] = $teamData['privilege'] ?? null;
            $nowTeam['group_ids'] = $this->normalizeTeamGroups($teamData['groups'] ?? ($teamData['group_ids'] ?? []));
            
            // 验证数据
            if(!$validate->check($nowTeam)) {
                $validateNotList .= "<br/>" . $nowTeam['team_id'] . ': ' . $validate->getError();
            }
            
            if(strlen($validateNotList) == 0) {
                $teamToShow[] = $nowTeam;
                $nowTeam['password'] = MkPasswd($nowTeam['password'], true);
                $teamGroupTeamIds[] = $nowTeam['team_id'];
                foreach ($nowTeam['group_ids'] as $gid) {
                    $teamGroupRows[] = [
                        'contest_id' => $this->contest['contest_id'],
                        'team_id' => $nowTeam['team_id'],
                        'group_id' => $gid,
                        'in_date' => date('Y-m-d H:i:s'),
                    ];
                }
                unset($nowTeam['group_ids']);
                $teamToInsert[] = $nowTeam;
            }
            $i++;
        }
        
        if(strlen($validateNotList) > 0) {
            $addInfo = '<br/>Some team information is not valid. Please check.' . $validateNotList;
            $this->error('Team generation failed.' . $addInfo);
        }
        
        $success_num = db('cpc_team')->insertAll($teamToInsert, true);
        if(!$success_num) {
            $this->error('Team generation failed. Please check the data input.');
        }
        $this->saveTeamGroupRows($this->contest['contest_id'], $teamGroupRows, $teamGroupTeamIds);
        if (method_exists($this, 'InvalidateContestMetaCache')) {
            $this->InvalidateContestMetaCache($this->contest['contest_id']);
        }
        $this->success('Team successfully generated. <br/>See the table below', null, ['rows' => $teamToShow, 'type' => 'teamgen', 'success_num'=> $success_num]);
    }
    
    /**
     * 基于种子的确定性密码生成
     */
    protected function generateSeededPassword($teamId, $seed) {
        $chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
        $password = '';
        
        // 如果没有种子，使用随机种子
        if ($seed == 0) {
            $seed = mt_rand(1, 999999);
        }
        
        // 使用种子和team_id生成确定性随机数
        $combinedSeed = $seed + strlen($teamId) + ord($teamId[0] ?? 'A');
        for ($i = 0; $i < strlen($teamId); $i++) {
            $combinedSeed = ($combinedSeed * 31 + ord($teamId[$i])) % 2147483647;
        }
        
        // 简单的线性同余生成器
        for ($i = 0; $i < 8; $i++) {
            $combinedSeed = ($combinedSeed * 16807) % 2147483647;
            $random = $combinedSeed / 2147483647;
            $password .= $chars[floor($random * strlen($chars))];
        }
        
        return $password;
    }
    
    /**
     * 清空队伍（CPC 系统专用）
     * 注意：exp 系统会重载此方法实现不同的逻辑
     */
    public function ClearTeam($helperAccounts=false) {
        $map = [
            'contest_id' => $this->contest['contest_id']
        ];
        if($helperAccounts) {
            $teamRows = db('cpc_team')->where($map)->whereRaw('privilege is not null')->where('privilege', '<>', 'reviewer')->field(['team_id'])->select();
            $teamIds = array_map(function($row) {
                return $row['team_id'];
            }, is_array($teamRows) ? $teamRows : []);
            if (count($teamIds) > 0) {
                db('cpc_team_group')->where($map)->where('team_id', 'in', $teamIds)->delete();
            }
            db('cpc_team')->where($map)->whereRaw('privilege is not null')->where('privilege', '<>', 'reviewer')->delete();
        } else {
            $teamRows = db('cpc_team')->where($map)->where(function($query) {
                $query->whereNull('privilege')->whereOr('privilege', '');
            })->field(['team_id'])->select();
            $teamIds = array_map(function($row) {
                return $row['team_id'];
            }, is_array($teamRows) ? $teamRows : []);
            if (count($teamIds) > 0) {
                db('cpc_team_group')->where($map)->where('team_id', 'in', $teamIds)->delete();
            }
            db('cpc_team')->where($map)->where(function($query) {
                $query->whereNull('privilege')->whereOr('privilege', '');
            })->delete();
        }
        cache('cpc_team_group_map_v1:' . intval($this->contest['contest_id']), null);
        cache('cpc_team_ids_for_group_filter:' . intval($this->contest['contest_id']) . ':team', null);
        cache('cpc_team_ids_for_group_filter:' . intval($this->contest['contest_id']) . ':all', null);
    }
    
    /**
     * 删除队伍
     */
    public function team_del_ajax() {
        if(!$this->isContestAdmin) {
            $this->error("No privilege");
        }
        $this->assertContestNotArchivedForWrite();
        $team_id = input('team_id/s');
        if($team_id == null || trim($team_id) == '') {
            $this->error("Invalid account.");
        }
        // 检查是否是当前用户（防止删除自己）
        if(isset($this->contest_user) && $team_id == $this->contest_user) {
            $this->error("Don't delete yourself");
        }
        db('cpc_team')->where([
                'team_id'       => $team_id,
                'contest_id'    => $this->contest['contest_id']
            ])->delete();
        if (method_exists($this, 'InvalidateContestMetaCache')) {
            $this->InvalidateContestMetaCache($this->contest['contest_id']);
        }
        $this->success($team_id . " Deleted");
    }
    
    /**
     * 比赛滚榜用队伍照片管理（仅 Standard 赛，private % 10 == 2）
     */
    public function rank_team_image() {
        if (intval($this->contest['private']) % 10 !== 2) {
            $this->error('该比赛类型不支持队伍图片管理。', '/' . $this->module . '/admin/rank_roll?cid=' . intval($this->contest['contest_id']));
        }
        $this->assignContestGroupContextForViews();
        $this->assign('contest', $this->contest);
        return $this->fetch();
    }

    /**
     * 队伍照片接口仅 Standard 赛可用（与 rank_team_image 菜单口径一致）
     */
    protected function assertStandardContestForTeamImage() {
        if (intval($this->contest['private']) % 10 !== 2) {
            $this->error('该比赛类型不支持队伍图片管理。');
        }
    }
    
    /**
     * 队伍照片列表
     */
    public function team_image_list_ajax() {
        $this->assertStandardContestForTeamImage();
        $ojPath = config('OjPath.');
        $team_photo_path = $ojPath['PUBLIC'] . $ojPath['contest_ATTACH'] . '/' . $this->contest['attach'] . '/team_photo';
        if(!MakeDirs($team_photo_path)) {
			$this->error('队伍图片列表读取失败.');
        }
        return $this->success('ok', null, GetDir($team_photo_path));
    }
    
    /**
     * 上传队伍照片
     */
    public function team_image_upload_ajax() {
        $this->assertStandardContestForTeamImage();
        if(!IsAdmin('contest', $this->contest['contest_id']) && !$this->IsContestAdmin('admin')) {
            $this->error("仅管理员有权上传", '/ojtool', null, 1);
        }
        $this->assertContestNotArchivedForWrite();
        $team_id = input('team_id');
        $team = null;
        if(in_array($this->contest['private'], [2, 12])) {
            $team = db('cpc_team')->where(['contest_id' => $this->contest['contest_id'], 'team_id' => $team_id])->find();
        } else {
            $team = db('users')->join('solution', 'users.user_id=solution.user_id')->where(['solution.contest_id' => $this->contest['contest_id'], 'users.user_id' => $team_id])->field('users.user_id team_id')->find();
        }
        if($team == null) {
            $this->error("没有这个队伍");
        }
        
        $dataURL = input("team_photo/s");
        if($dataURL) {
            $ojPath = config('OjPath.');
            $file_folder = $ojPath['PUBLIC'] . $ojPath['contest_ATTACH'] . '/' . $this->contest['attach'] . '/team_photo/';
            MakeDirs($file_folder);
            $tid = $team['team_id'];
            if (!preg_match('#^data:(image/[^;]+);base64,(.+)$#s', $dataURL, $m)) {
                $this->error('非法的图片数据');
            }
            $mime = strtolower(trim($m[1]));
            $raw = base64_decode($m[2], true);
            if ($raw === false) {
                $this->error('非法的图片数据');
            }
            if (strlen($raw) > 524288) {
                $this->error("图片过大");
            }
            // 新默认 WebP；旧浏览器 canvas 回传 JPEG 时仍存 .jpg 以兼容
            $ext = 'webp';
            if (strpos($mime, 'webp') === false) {
                if (strpos($mime, 'jpeg') !== false || strpos($mime, 'jpg') !== false) {
                    $ext = 'jpg';
                } else {
                    $this->error('仅支持 WebP 或 JPEG');
                }
            }
            $filename = $tid . '.' . $ext;
            // 避免同队双扩展名残留（列表与前端只按 team_id 键一条）
            DelWhatever($file_folder . $tid . '.jpg');
            DelWhatever($file_folder . $tid . '.webp');
            file_put_contents($file_folder . $filename, $raw);
            $file_url = $ojPath['contest_ATTACH'] . '/' . $this->contest['attach'] . '/team_photo/' . $filename;
            $this->success('OK', null, [
                'file_url' => $file_url
            ]);
        }
        $this->error('未获取到文件');;
    }
    
    /**
     * 删除队伍照片
     */
    public function team_image_del_ajax() {
        $this->assertStandardContestForTeamImage();
        if(!IsAdmin('contest', $this->contest['contest_id']) && !$this->IsContestAdmin('admin')) {
            $this->error("仅管理员有权删除", '/ojtool', null, 1);
        }
        $this->assertContestNotArchivedForWrite();
        $ojPath = config('OjPath.');
        $team_id = input('team_id/s');
        if($team_id === null || trim($team_id) === '' || ($team_id = preg_replace('/[^A-Za-z0-9_]/', '', $team_id)) === '') {
            $this->error("team_id not valid");
        }
        $dir = $ojPath['PUBLIC'] . $ojPath['contest_ATTACH'] . '/' . $this->contest['attach'] . '/team_photo/';
        DelWhatever($dir . $team_id . '.jpg');
        DelWhatever($dir . $team_id . '.webp');
        $this->success('ok');
    }
    
    /**
     * 客户端管理页面
     */
    public function client_manage() {
        if(!$this->isContestAdmin) {
            $this->error('Permission denied to manage clients', '/', '', 1);
        }
        if(!in_array($this->contest['private'] % 10, [2, 5])) {
            $this->error("This contest does not support client management.");
        }
        
        // 计算收集模式状态
        $addition = [];
        if (!empty($this->contest['addition'])) {
            $addition = Json2Array($this->contest['addition']);
            if (!$addition || !is_array($addition)) {
                $addition = [];
            }
        }
        $flg_collect_team_id = isset($addition['flg_collect_team_id']) ? intval($addition['flg_collect_team_id']) : 0;
        
        // 判断收集模式是否已无效化（比赛前10分钟内）
        $isCollectModeInvalid = false;
        if ($flg_collect_team_id == 1) {
            $now = time();
            $startTime = strtotime($this->contest['start_time']);
            $timeDiff = $startTime - $now;
            $isCollectModeInvalid = $timeDiff < 600; // 600秒 = 10分钟
        }
        
        $this->assign('flg_collect_team_id', $flg_collect_team_id);
        $this->assign('is_collect_mode_invalid', $isCollectModeInvalid);
        
        return $this->fetch();
    }
    
    /**
     * 读取 Python 记录文件
     */
    private function readClientRecord($contest_id) {
        $ojPath = config('OjPath.');
        $recordPath = $ojPath['cpc_client_record'] . '/' . $contest_id . '/record.json';
        
        if (!file_exists($recordPath)) {
            return [];
        }
        
        $content = file_get_contents($recordPath);
        if ($content === false) {
            return [];
        }
        
        $data = Json2Array($content);
        return $data ? $data : [];
    }
    
    /**
     * 获取比赛客户端列表
     */
    public function contest_client_list_ajax() {
        if(!$this->isContestAdmin) {
            $this->error('Permission denied');
        }
        
        $clientList = db('cpc_client')
            ->where('contest_id', $this->contest['contest_id'])
            ->order('client_id', 'asc')
            ->select();
        
        // 读取 Python 记录文件
        $recordData = $this->readClientRecord($this->contest['contest_id']);
        
        // 将记录数据按 ip_bind 索引
        $recordMap = [];
        if (is_array($recordData)) {
            foreach ($recordData as $ipBind => $record) {
                if (is_string($ipBind) && is_array($record)) {
                    $recordMap[$ipBind] = $record;
                } elseif (is_array($record) && isset($record['ip_bind'])) {
                    $recordMap[$record['ip_bind']] = $record;
                }
            }
        }
        
        // 合并数据
        foreach ($clientList as &$client) {
            // 解析 ssh_config
            $sshConfig = [];
            if (!empty($client['ssh_config'])) {
                $sshConfig = Json2Array($client['ssh_config']);
                if (!$sshConfig) {
                    $sshConfig = [];
                }
            }
            
            // 设置 SSH 字段与客户端类型
            $client['ssh_user'] = $sshConfig['user'] ?? '';
            $client['ssh_pass'] = $sshConfig['pass'] ?? '';
            $client['ssh_rsa'] = $sshConfig['rsa'] ?? '';
            $client['ssh_port'] = $sshConfig['port'] ?? '22';
            $client['client_type'] = isset($sshConfig['client_type']) && in_array($sshConfig['client_type'], ['ssh', 'client'], true)
                ? $sshConfig['client_type'] : 'ssh';
            
            // 合并记录数据
            if (isset($client['ip_bind']) && isset($recordMap[$client['ip_bind']])) {
                $record = $recordMap[$client['ip_bind']];
                $client['last_connect_time'] = $record['last_connect_time'] ?? null;
                $client['connect_status'] = $record['connect_status'] ?? 'unknown';
                $client['lock_status'] = $record['lock_status'] ?? 'unlock';
                $client['lock_time'] = $record['lock_time'] ?? null;
            } else {
                $client['last_connect_time'] = null;
                $client['connect_status'] = 'unknown';
                $client['lock_status'] = 'unlock';
                $client['lock_time'] = null;
            }
        }
        
        return $clientList;
    }
    
    /**
     * 验证IP地址格式（简单验证，仅格式）
     */
    private function isValidIpAddress($ip) {
        if (empty($ip) || !is_string($ip)) {
            return false;
        }
        return preg_match('/^(\d{1,3}\.){3}\d{1,3}$/', $ip) === 1;
    }
    
    /**
     * 验证 IPv4 每段在 0-255
     */
    private function isIpAddressOctetsValid($ip) {
        if (!$this->isValidIpAddress($ip)) {
            return false;
        }
        $parts = explode('.', $ip);
        foreach ($parts as $p) {
            $n = (int) $p;
            if ($n < 0 || $n > 255 || (string) $n !== $p) {
                return false;
            }
        }
        return true;
    }
    
    /**
     * 验证 SSH 配置
     */
    private function validateSshConfig($sshUser, $sshPass, $sshRsa, $sshPort) {
        if (empty($sshUser)) {
            return ['valid' => true];
        }
        
        if ($this->isValidIpAddress($sshUser)) {
            return ['valid' => false, 'error' => 'SSH用户名不能是IP地址格式，请检查数据列顺序是否正确 / SSH user cannot be an IP address format, please check if the column order is correct'];
        }
        
        if (empty($sshPort)) {
            return ['valid' => false, 'error' => '提供SSH用户名时，SSH端口为必填项 / SSH port is required when SSH user is provided'];
        }
        
        if (empty($sshPass) && empty($sshRsa)) {
            return ['valid' => false, 'error' => '提供SSH用户名时，SSH密码或RSA密钥至少需要提供一个 / SSH password or RSA key is required when SSH user is provided'];
        }
        
        return ['valid' => true];
    }
    
    /**
     * 保存或更新客户端
     */
    public function contest_client_save_ajax() {
        if(!$this->isContestAdmin) {
            $this->errorBilingual('无权限', 'Permission denied');
        }
        $this->assertContestNotArchivedForWrite();
        
        $clientList = input('client_list');
        $insertOnly = input('insert_only', 0);
        if (!$clientList) {
            $this->errorBilingual('未提供客户端数据', 'No client data provided');
        }
        
        $clients = json_decode($clientList, true);
        if (!$clients || !is_array($clients)) {
            $this->errorBilingual('客户端数据格式无效', 'Invalid client data format');
        }
        
        // 一次性查询该 contest_id 的所有 client
        $existingClients = db('cpc_client')->where('contest_id', $this->contest['contest_id'])->select();
        
        // 创建基于 team_id_bind 的 map（忽略大小写，key 使用小写）
        $teamIdMap = [];
        foreach ($existingClients as $client) {
            $teamIdBind = trim($client['team_id_bind'] ?? '');
            if (!empty($teamIdBind)) {
                $teamIdKey = strtolower($teamIdBind);
                $teamIdMap[$teamIdKey] = $client;
            }
        }
        
        // 创建基于 ip_bind 的 map
        $ipMap = [];
        foreach ($existingClients as $client) {
            $ipBind = trim($client['ip_bind'] ?? '');
            if (!empty($ipBind)) {
                $ipMap[$ipBind] = $client;
            }
        }
        
        $successCount = 0;
        $errorList = [];
        $insertList = [];
        $updateList = [];
        
        foreach ($clients as $idx => $clientData) {
            // 处理 SSH 配置与客户端类型
            $sshUser = trim($clientData['ssh_user'] ?? '');
            $sshPass = trim($clientData['ssh_pass'] ?? '');
            $sshRsa = trim($clientData['ssh_rsa'] ?? '');
            $sshPort = trim($clientData['ssh_port'] ?? '22');
            $clientType = trim($clientData['client_type'] ?? 'ssh');
            if (!in_array($clientType, ['ssh', 'client'], true)) {
                $clientType = 'ssh';
            }
            
            // 验证 SSH 配置
            $sshValidation = $this->validateSshConfig($sshUser, $sshPass, $sshRsa, $sshPort);
            if (!$sshValidation['valid']) {
                $errorList[] = "Row " . ($idx + 1) . ": " . $sshValidation['error'];
                continue;
            }
            
            // 构建 SSH 配置 JSON（含客户端类型，用于后续按类型控制客户端方式）
            $sshConfig = ['client_type' => $clientType];
            if (!empty($sshUser)) {
                $sshConfig['user'] = $sshUser;
                $sshConfig['port'] = $sshPort ?: '22';
                if (!empty($sshPass)) {
                    $sshConfig['pass'] = $sshPass;
                }
                if (!empty($sshRsa)) {
                    $sshConfig['rsa'] = $sshRsa;
                }
            }
            
            // 获取数据
            $teamIdBind = trim($clientData['team_id_bind'] ?? '');
            $ipBind = trim($clientData['ip_bind'] ?? '');
            
            // team_id_bind 不应该是IP地址格式（中文在前）
            if (!empty($teamIdBind) && $this->isValidIpAddress($teamIdBind)) {
                $errorList[] = "Row " . ($idx + 1) . ": 队伍号不能是IP地址格式，请检查数据列顺序是否正确 / team_id_bind cannot be an IP address format, please check if the column order is correct";
                continue;
            }
            
            // team_id_bind 长度与字符校验（参考 CpcSysConfig.client_team_id_bind，文案中文在前）
            if (!empty($teamIdBind)) {
                $tibCfg = config('CpcSysConfig.client_team_id_bind');
                if (mb_strlen($teamIdBind) > $tibCfg['max']) {
                    $errorList[] = "Row " . ($idx + 1) . ": 队伍号最多64个字符 / Team ID should not exceed 64 characters.";
                    continue;
                }
                if (!preg_match($tibCfg['regex'], $teamIdBind)) {
                    $errorList[] = "Row " . ($idx + 1) . ": 队伍号仅允许字母、数字、下划线 / Only letters, numbers and underscores are allowed for Team ID.";
                    continue;
                }
            }
            
            // 判断是更新还是插入（insert_only=1 时仅插入，不允许覆盖已有 IP/队伍号）
            $existingClient = null;
            $isUpdate = false;
            
            if (!empty($ipBind) && isset($ipMap[$ipBind])) {
                $existingClient = $ipMap[$ipBind];
                $isUpdate = true;
            }
            
            if (!$isUpdate && empty($ipBind) && !empty($teamIdBind)) {
                $teamIdKey = strtolower($teamIdBind);
                if (isset($teamIdMap[$teamIdKey])) {
                    $existingClient = $teamIdMap[$teamIdKey];
                    $isUpdate = true;
                }
            }
            
            // 添加模式（insert_only）：同 IP 或同队伍号时不添加也不更新，直接返回错误供前端提示（中文在前）
            if ($insertOnly && $isUpdate) {
                if (!empty($ipBind) && isset($ipMap[$ipBind])) {
                    $errorList[] = "Row " . ($idx + 1) . ": 该IP已被占用，不添加不更新，请使用修改功能或更换IP / This IP is already in use; no add and no update. Use Modify to change or use another IP";
                } else {
                    $errorList[] = "Row " . ($idx + 1) . ": 该队伍号已存在，不添加不更新，请使用修改功能 / This Team ID already exists; no add and no update. Use Modify to change";
                }
                continue;
            }
            
            if ($isUpdate) {
                $updateData = [
                    'client_id' => $existingClient['client_id'],
                    'contest_id' => $this->contest['contest_id']
                ];
                
                if (!empty($teamIdBind)) {
                    $updateData['team_id_bind'] = $teamIdBind;
                } else {
                    $updateData['team_id_bind'] = $existingClient['team_id_bind'] ?? '';
                }
                
                if (!empty($ipBind)) {
                    $updateData['ip_bind'] = $ipBind;
                } else {
                    $updateData['ip_bind'] = $existingClient['ip_bind'] ?? '';
                }
                
                $updateData['ssh_config'] = json_encode($sshConfig, JSON_UNESCAPED_UNICODE);
                
                $updateList[] = $updateData;
            } else {
                if (empty($teamIdBind)) {
                    $errorList[] = "Row " . ($idx + 1) . ": 队伍号不能为空 / team_id_bind is required for new client";
                    continue;
                }
                
                if (empty($ipBind)) {
                    $errorList[] = "Row " . ($idx + 1) . ": IP地址不能为空 / ip_bind is required for new client";
                    continue;
                }
                
                $clientInfo = [
                    'contest_id' => $this->contest['contest_id'],
                    'team_id_bind' => $teamIdBind,
                    'ip_bind' => $ipBind,
                    'ssh_config' => json_encode($sshConfig, JSON_UNESCAPED_UNICODE)
                ];
                
                $insertList[] = $clientInfo;
            }
        }
        
        // 批量插入新数据
        if (!empty($insertList)) {
            $insertResult = db('cpc_client')->insertAll($insertList, true);
            if ($insertResult !== false) {
                $successCount += count($insertList);
            } else {
                $errorList[] = "批量插入失败 / Batch insert failed";
            }
        }
        
        // 批量更新现有数据
        if (!empty($updateList)) {
            $updateResult = db('cpc_client')->insertAll($updateList, true);
            if ($updateResult !== false) {
                $successCount += count($updateList);
            } else {
                $errorList[] = "批量更新失败 / Batch update failed";
            }
        }
        
        if (!empty($errorList)) {
            $msgCn = '部分客户端保存失败：' . implode('；', array_map(function ($s) {
                return (strpos($s, ' / ') !== false) ? trim(explode(' / ', $s, 2)[0]) : $s;
            }, $errorList));
            $msgEn = 'Some clients failed to save: ' . implode('; ', array_map(function ($s) {
                return (strpos($s, ' / ') !== false) ? trim(explode(' / ', $s, 2)[1]) : $s;
            }, $errorList));
            $this->errorBilingual($msgCn, $msgEn);
        }
        
        $this->successBilingual('客户端保存成功', 'Clients saved successfully', null, ['success_count' => $successCount]);
    }
    
    /**
     * 删除客户端
     */
    public function contest_client_del_ajax() {
        if(!$this->isContestAdmin) {
            $this->error('Permission denied');
        }
        $this->assertContestNotArchivedForWrite();
        
        $clientId = input('client_id/d');
        if (!$clientId) {
            $this->errorBilingual('缺少 client_id', 'client_id is required');
        }
        
        $result = db('cpc_client')->where([
            'client_id' => $clientId,
            'contest_id' => $this->contest['contest_id']
        ])->delete();
        
        if ($result) {
            $this->successBilingual('客户端已删除', 'Client deleted successfully');
        } else {
            $this->errorBilingual('删除客户端失败', 'Failed to delete client');
        }
    }
    
    /**
     * 更新单个客户端（按 client_id + contest_id 定位，队伍号不可更改）
     */
    public function contest_client_update_ajax() {
        if (!$this->isContestAdmin) {
            $this->errorBilingual('无权限', 'Permission denied');
        }
        $this->assertContestNotArchivedForWrite();
        
        $clientId = input('client_id/d');
        if (!$clientId) {
            $this->errorBilingual('缺少 client_id', 'client_id is required');
        }
        
        $client = db('cpc_client')->where([
            'client_id' => $clientId,
            'contest_id' => $this->contest['contest_id']
        ])->find();
        
        if (!$client) {
            $this->errorBilingual('未找到该客户端', 'Client not found');
        }
        
        $ipBind = trim(input('ip_bind/s', ''));
        if (empty($ipBind)) {
            $this->errorBilingual('IP地址不能为空', 'IP address is required');
        }
        if (!$this->isIpAddressOctetsValid($ipBind)) {
            $this->errorBilingual('IP地址格式不正确（每段须为0-255）', 'Invalid IP address format (each octet must be 0-255)');
        }
        
        $sshUser = trim(input('ssh_user/s', ''));
        $sshPass = trim(input('ssh_pass/s', ''));
        $sshRsa = trim(input('ssh_rsa/s', ''));
        $sshPort = trim(input('ssh_port/s', '22'));
        $clientType = trim(input('client_type/s', 'ssh'));
        if (!in_array($clientType, ['ssh', 'client'], true)) {
            $clientType = 'ssh';
        }
        
        $sshValidation = $this->validateSshConfig($sshUser, $sshPass, $sshRsa, $sshPort);
        if (!$sshValidation['valid']) {
            $err = $sshValidation['error'];
            if (strpos($err, ' / ') !== false) {
                $parts = explode(' / ', $err, 2);
                $this->errorBilingual(trim($parts[0]), trim($parts[1]));
            } else {
                $this->error($err);
            }
        }
        
        $sshConfig = ['client_type' => $clientType];
        if (!empty($sshUser)) {
            $sshConfig['user'] = $sshUser;
            $sshConfig['port'] = $sshPort ?: '22';
            if (!empty($sshPass)) {
                $sshConfig['pass'] = $sshPass;
            }
            if (!empty($sshRsa)) {
                $sshConfig['rsa'] = $sshRsa;
            }
        }
        $sshConfig = json_encode($sshConfig, JSON_UNESCAPED_UNICODE);
        
        $updateData = [
            'ip_bind' => $ipBind,
            'ssh_config' => $sshConfig
        ];
        
        $result = db('cpc_client')->where([
            'client_id' => $clientId,
            'contest_id' => $this->contest['contest_id']
        ])->update($updateData);
        
        if ($result === false) {
            $this->errorBilingual('更新客户端失败', 'Failed to update client');
        }
        
        // 返回更新后的单条记录（与 list 结构一致，供前端更新表格）
        $updated = db('cpc_client')->where([
            'client_id' => $clientId,
            'contest_id' => $this->contest['contest_id']
        ])->find();
        
        $recordData = $this->readClientRecord($this->contest['contest_id']);
        $recordMap = [];
        if (is_array($recordData)) {
            foreach ($recordData as $ipBindKey => $record) {
                if (is_string($ipBindKey) && is_array($record)) {
                    $recordMap[$ipBindKey] = $record;
                } elseif (is_array($record) && isset($record['ip_bind'])) {
                    $recordMap[$record['ip_bind']] = $record;
                }
            }
        }
        
        $sshConfigArr = [];
        if (!empty($updated['ssh_config'])) {
            $sshConfigArr = Json2Array($updated['ssh_config']) ?: [];
        }
        $updated['ssh_user'] = $sshConfigArr['user'] ?? '';
        $updated['ssh_pass'] = $sshConfigArr['pass'] ?? '';
        $updated['ssh_rsa'] = $sshConfigArr['rsa'] ?? '';
        $updated['ssh_port'] = $sshConfigArr['port'] ?? '22';
        $updated['client_type'] = isset($sshConfigArr['client_type']) && in_array($sshConfigArr['client_type'], ['ssh', 'client'], true)
            ? $sshConfigArr['client_type'] : 'ssh';
        
        if (isset($updated['ip_bind']) && isset($recordMap[$updated['ip_bind']])) {
            $record = $recordMap[$updated['ip_bind']];
            $updated['last_connect_time'] = $record['last_connect_time'] ?? null;
            $updated['connect_status'] = $record['connect_status'] ?? 'unknown';
            $updated['lock_status'] = $record['lock_status'] ?? 'unlock';
            $updated['lock_time'] = $record['lock_time'] ?? null;
        } else {
            $updated['last_connect_time'] = null;
            $updated['connect_status'] = 'unknown';
            $updated['lock_status'] = 'unlock';
            $updated['lock_time'] = null;
        }
        
        $this->successBilingual('客户端更新成功', 'Client updated successfully', null, ['row' => $updated]);
    }
    
    /**
     * 更新 contest 表的 addition JSON 字段
     */
    protected function updateContestAddition($updateFields, $flg_update = true) {
        $contest = db('contest')->where('contest_id', $this->contest['contest_id'])->find();
        if (!$contest) {
            $this->errorBilingual('未找到该比赛', 'Contest not found');
        }
        
        $addition = [];
        if (!empty($contest['addition'])) {
            $addition = Json2Array($contest['addition']);
            if (!$addition || !is_array($addition)) {
                $addition = [];
            }
        }
        
        if ($flg_update) {
            $addition = array_merge($addition, $updateFields);
        } else {
            $addition = $updateFields;
        }
        
        $result = db('contest')->where('contest_id', $this->contest['contest_id'])->update([
            'addition' => json_encode($addition, JSON_UNESCAPED_UNICODE)
        ]);
        
        return $result !== false;
    }
    
    /**
     * 切换账号收集模式状态
     */
    public function contest_collect_mode_toggle_ajax() {
        if(!$this->isContestAdmin) {
            $this->error('Permission denied');
        }
        $this->assertContestNotArchivedForWrite();
        
        $addition = [];
        if (!empty($this->contest['addition'])) {
            $addition = Json2Array($this->contest['addition']);
            if (!$addition || !is_array($addition)) {
                $addition = [];
            }
        }
        
        $currentStatus = isset($addition['flg_collect_team_id']) ? intval($addition['flg_collect_team_id']) : 0;
        $newStatus = $currentStatus == 1 ? 0 : 1;
        
        if ($this->updateContestAddition(['flg_collect_team_id' => $newStatus], true)) {
            $statusCn = $newStatus == 1 ? '已开启' : '已关闭';
            $statusEn = $newStatus == 1 ? 'Enabled' : 'Disabled';
            $this->successBilingual('账号收集模式' . $statusCn, 'Collect mode ' . $statusEn, null, [
                'flg_collect_team_id' => $newStatus,
                'status_str' => $statusCn . ' / ' . $statusEn
            ]);
        } else {
            $this->errorBilingual('更新失败', 'Update failed');
        }
    }

    // -----------------------------------------------------------------------
    // 比赛题册排版（admin/contest2print）：多语言 HTML + 前端自研 cp-sheet；Logo/封面 PDF 附件 Ajax。见 docs/guide/18.比赛题册contest2print.md
    // -----------------------------------------------------------------------

    /**
     * 比赛题目排版页（比赛后台 Admin 控制器；`/cpcsys/admin/contest2print`、`/csgoj/admin/contest2print` 等）。
     * 题面数据与 `/contest/problem` 同源（`problem_locale_view_state` + preload）；PDF 路由固定走 `contest/problem_pdf`。
     */
    public function contest2print()
    {
        if (!$this->isContestAdmin) {
            $this->error("You are not administrator!");
        }

        $problem_list_export = [];
        foreach ($this->problemIdMap['id2abc'] as $key => $val) {
            $problem_list_export[] = intval($key);
        }
        $problem_list_export = array_unique($problem_list_export);
        if (count($problem_list_export) == 0) {
            $this->error("Cannot find problems for contest " . $this->contest['contest_id']);
        }

        $orderMap = new Expression("field(problem_id," . implode(",", $problem_list_export) . ")");

        $problem_rows = db('problem')
            ->where('problem_id', 'in', $problem_list_export)
            ->order($orderMap)
            ->field([
                'problem_id', 'title', 'sample_input', 'sample_output',
                'spj', 'time_limit', 'memory_limit',
                'description', 'input', 'output', 'hint',
                'source', 'author',
                'attach',
            ])
            ->select();
        if (!is_array($problem_rows)) {
            $problem_rows = [];
        }

        $locale_rows = db('problem_locale')
            ->where('problem_id', 'in', $problem_list_export)
            ->order('problem_id asc, sort_order asc, locale_key asc')
            ->select();
        if (!is_array($locale_rows)) {
            $locale_rows = [];
        }

        $loc_rows_by_pid = [];
        foreach ($locale_rows as $lr0) {
            $pid0 = intval($lr0['problem_id']);
            if (!isset($loc_rows_by_pid[$pid0])) {
                $loc_rows_by_pid[$pid0] = [];
            }
            $loc_rows_by_pid[$pid0][] = $lr0;
        }

        $html_by_pid = [];
        if (count($problem_list_export) > 0) {
            $html_all = db('problem_locale_html')
                ->where('problem_id', 'in', $problem_list_export)
                ->select();
            if (is_array($html_all)) {
                foreach ($html_all as $hr) {
                    $hp = intval($hr['problem_id']);
                    $hk = (string) $hr['locale_key'];
                    if (!isset($html_by_pid[$hp])) {
                        $html_by_pid[$hp] = [];
                    }
                    $html_by_pid[$hp][$hk] = $hr;
                }
            }
        }

        $loc_by_pid = [];
        $default_key_by_pid = [];
        $union_lang_meta = [];
        $union_first_seen_order = [];
        $orderCounter = 0;
        foreach ($locale_rows as $lr) {
            $pid = intval($lr['problem_id']);
            $k = (string) $lr['locale_key'];
            if (!problem_locale_row_visible_to_user($lr)) {
                continue;
            }
            if (!isset($loc_by_pid[$pid])) {
                $loc_by_pid[$pid] = [];
            }
            $loc_by_pid[$pid][$k] = $lr;
            if (!isset($default_key_by_pid[$pid])) {
                $default_key_by_pid[$pid] = $k;
            }
            if (!isset($union_lang_meta[$k])) {
                $union_lang_meta[$k] = [
                    'key'   => $k,
                    'label' => trim((string) ($lr['locale_label'] ?? '')) !== '' ? (string) $lr['locale_label'] : $k,
                    'sort'  => intval($lr['sort_order'] ?? 0),
                ];
                $union_first_seen_order[$k] = $orderCounter++;
            } else {
                $union_lang_meta[$k]['sort'] = min($union_lang_meta[$k]['sort'], intval($lr['sort_order'] ?? 0));
            }
        }

        $mod = strtolower((string) $this->request->module());
        $pdfBase = '/' . $mod . '/contest/problem_pdf';
        $problemHtmlBase = '/' . $mod . '/contest/problem';
        $cid = (int) $this->contest['contest_id'];

        $problem_list = [];
        foreach ($problem_rows as $row) {
            $pid = intval($row['problem_id']);
            $apid = isset($this->problemIdMap['id2abc'][$pid]) ? $this->problemIdMap['id2abc'][$pid] : '';
            $problem = [
                'problem_id'     => $pid,
                'apid'           => $apid,
                'title'          => (string) ($row['title'] ?? ''),
                'time_limit'     => $row['time_limit'] ?? '',
                'memory_limit'   => $row['memory_limit'] ?? '',
                'spj'            => $row['spj'] ?? '0',
                'sample_input'   => (string) ($row['sample_input'] ?? ''),
                'sample_output'  => (string) ($row['sample_output'] ?? ''),
            ];

            $defaultKey = $default_key_by_pid[$pid] ?? '';
            $localesForProblem = isset($loc_by_pid[$pid]) ? $loc_by_pid[$pid] : [];
            $perLang = [];

            if (empty($localesForProblem)) {
                $perLang['__main__'] = [
                    'kind'        => 'md',
                    'use_pdf'     => 0,
                    'title'       => (string) ($row['title'] ?? ''),
                    'description' => (string) ($row['description'] ?? ''),
                    'input'       => (string) ($row['input'] ?? ''),
                    'output'      => (string) ($row['output'] ?? ''),
                    'hint'        => (string) ($row['hint'] ?? ''),
                ];
                if (!isset($union_lang_meta['__main__'])) {
                    $union_lang_meta['__main__'] = [
                        'key' => '__main__', 'label' => '默认 / Default', 'sort' => -1,
                    ];
                    $union_first_seen_order['__main__'] = -1;
                }
                $defaultKey = '__main__';
            } else {
                $problemBase = [
                    'problem_id'     => $pid,
                    'title'          => (string) ($row['title'] ?? ''),
                    'description'    => (string) ($row['description'] ?? ''),
                    'input'          => (string) ($row['input'] ?? ''),
                    'output'         => (string) ($row['output'] ?? ''),
                    'hint'           => (string) ($row['hint'] ?? ''),
                    'source'         => (string) ($row['source'] ?? ''),
                    'author'         => (string) ($row['author'] ?? ''),
                    'sample_input'   => (string) ($row['sample_input'] ?? ''),
                    'sample_output'  => (string) ($row['sample_output'] ?? ''),
                    'spj'            => $row['spj'] ?? '0',
                    'time_limit'     => $row['time_limit'] ?? '',
                    'memory_limit'   => $row['memory_limit'] ?? '',
                    'attach'         => (string) ($row['attach'] ?? ''),
                ];
                $pdfQ = ['cid' => $cid, 'pid' => $apid];
                $preloadVs = [
                    'loc_rows'       => $loc_rows_by_pid[$pid] ?? [],
                    'html_by_locale' => $html_by_pid[$pid] ?? [],
                    'default_key'    => $defaultKey,
                ];
                foreach ($localesForProblem as $k => $lr) {
                    $vs = problem_locale_view_state($problemBase, null, $k, $pdfBase, $pdfQ, $pdfQ, $preloadVs, $problemHtmlBase);
                    if (($vs['desc_display_mode'] ?? '') === 'pdf' && !empty($vs['pdf_url'])) {
                        $perLang[$k] = [
                            'kind'    => 'pdf',
                            'use_pdf' => 1,
                            'title'   => (string) ($vs['problem']['title'] ?? $row['title'] ?? ''),
                            'pdf_url' => (string) $vs['pdf_url'],
                        ];
                    } else {
                        $p = $vs['problem'];
                        $perLang[$k] = [
                            'kind'        => 'md',
                            'use_pdf'     => 0,
                            'title'       => (string) ($p['title'] ?? ''),
                            'description' => (string) ($p['description'] ?? ''),
                            'input'       => (string) ($p['input'] ?? ''),
                            'output'      => (string) ($p['output'] ?? ''),
                            'hint'        => (string) ($p['hint'] ?? ''),
                        ];
                    }
                }
            }
            $problem['locales'] = $perLang;
            $problem['default_locale_key'] = $defaultKey;
            $problem_list[] = $problem;
        }

        $union_keys = array_keys($union_lang_meta);
        usort($union_keys, function ($a, $b) use ($union_lang_meta, $union_first_seen_order) {
            if ($a === '__main__' && $b !== '__main__') {
                return 1;
            }
            if ($b === '__main__' && $a !== '__main__') {
                return -1;
            }
            $sa = $union_lang_meta[$a]['sort'];
            $sb = $union_lang_meta[$b]['sort'];
            if ($sa !== $sb) {
                return $sa < $sb ? -1 : 1;
            }
            return $union_first_seen_order[$a] - $union_first_seen_order[$b];
        });
        $available_langs = [];
        foreach ($union_keys as $k) {
            $available_langs[] = [
                'key'   => $k,
                'label' => $union_lang_meta[$k]['label'],
            ];
        }

        $ojPath = config('OjPath.');
        $contest_attach = isset($this->contest['attach']) ? trim((string) $this->contest['attach']) : '';
        $logo_url = '';
        $logo_ext = '';
        $cover_pdf_url = '';
        $cover_pdf_mtime = 0;
        if ($contest_attach !== '' && $contest_attach !== '-') {
            $attachPub = $ojPath['PUBLIC'] . $ojPath['contest_ATTACH'] . '/' . $contest_attach;
            $attachWeb = $ojPath['contest_ATTACH'] . '/' . $contest_attach;
            $printPub = $attachPub . '/contest_print';
            $printWeb = $attachWeb . '/contest_print';
            foreach (['svg', 'png', 'webp', 'jpg'] as $ext) {
                $cand = $printPub . '/contest_logo.' . $ext;
                if (is_file($cand)) {
                    $logo_url = $printWeb . '/contest_logo.' . $ext . '?v=' . filemtime($cand);
                    $logo_ext = $ext;
                    break;
                }
            }
            if ($logo_url === '') {
                foreach (['svg', 'png', 'webp', 'jpg'] as $ext) {
                    $cand = $attachPub . '/contest_logo.' . $ext;
                    if (is_file($cand)) {
                        $logo_url = $attachWeb . '/contest_logo.' . $ext . '?v=' . filemtime($cand);
                        $logo_ext = $ext;
                        break;
                    }
                }
            }
            $coverPathPrint = $printPub . '/contest_print_cover.pdf';
            $coverPathLegacy = $attachPub . '/contest_print_cover.pdf';
            if (is_file($coverPathPrint)) {
                $cover_pdf_url = $printWeb . '/contest_print_cover.pdf?v=' . filemtime($coverPathPrint);
                $cover_pdf_mtime = filemtime($coverPathPrint);
            } elseif (is_file($coverPathLegacy)) {
                $cover_pdf_url = $attachWeb . '/contest_print_cover.pdf?v=' . filemtime($coverPathLegacy);
                $cover_pdf_mtime = filemtime($coverPathLegacy);
            }
        }

        $this->assign([
            'pagetitle'         => 'Contest Problem Print',
            'contest'           => $this->contest,
            'problem_list'      => $problem_list,
            'available_langs'   => $available_langs,
            'contest_logo_url'  => $logo_url,
            'contest_logo_ext'  => $logo_ext,
            'cover_pdf_url'     => $cover_pdf_url,
            'cover_pdf_mtime'   => $cover_pdf_mtime,
            'module'            => $mod,
            'controller'        => 'admin',
        ]);
        return $this->fetch('admin/contest2print');
    }

    /**
     * 比赛排版：上传/替换比赛 logo（写到 {contest_attach}/contest_print/contest_logo.<ext>）
     */
    public function contest_print_logo_upload_ajax()
    {
        if (!$this->isContestAdmin) {
            $this->error('Permission denied');
        }
        $this->assertContestNotArchivedForWrite();

        $allowedExts = ['svg', 'png', 'webp', 'jpg'];
        $decoded = ContestAttachFile::decodeImageDataUrl((string) input('logo_data/s', ''), $allowedExts);
        if (!$decoded['ok']) {
            $this->error($decoded['err']);
        }
        $written = ContestAttachFile::writeBaseWithExt(
            $this->contest,
            'contest_print/contest_logo',
            $decoded['ext'],
            $decoded['raw'],
            4 * 1024 * 1024,
            $allowedExts
        );
        if (!$written['ok']) {
            $this->error($written['err']);
        }
        $this->success('OK', null, ['logo_url' => $written['web_url'], 'ext' => $written['ext']]);
    }

    /**
     * 比赛排版：删除比赛 logo
     */
    public function contest_print_logo_delete_ajax()
    {
        if (!$this->isContestAdmin) {
            $this->error('Permission denied');
        }
        $this->assertContestNotArchivedForWrite();

        $r = ContestAttachFile::deleteByBaseExts($this->contest, 'contest_print/contest_logo', ['svg', 'png', 'webp', 'jpg']);
        if (!$r['ok']) {
            $this->error($r['err']);
        }
        $this->success('OK', null, ['removed' => $r['removed']]);
    }

    /**
     * 比赛排版：上传/替换自定义封面 PDF
     */
    public function contest_print_cover_upload_ajax()
    {
        if (!$this->isContestAdmin) {
            $this->error('Permission denied');
        }
        $this->assertContestNotArchivedForWrite();

        $maxBytes = 32 * 1024 * 1024;
        $raw = null;
        $file = $this->request->file('pdf_file');
        if ($file) {
            $info = $file->getInfo();
            if (!empty($info['size']) && $info['size'] > $maxBytes) {
                $this->error('Cover PDF too large (max 32MB)');
            }
            $tmp = $file->getRealPath();
            if (!is_file($tmp)) {
                $this->error('Upload failed');
            }
            $raw = file_get_contents($tmp);
        } else {
            $decoded = ContestAttachFile::decodePdfDataUrl((string) input('pdf_data/s', ''));
            if (!$decoded['ok']) {
                $this->error($decoded['err']);
            }
            $raw = $decoded['raw'];
        }
        $written = ContestAttachFile::writeRel(
            $this->contest,
            'contest_print/contest_print_cover.pdf',
            (string) $raw,
            $maxBytes,
            '%PDF-'
        );
        if (!$written['ok']) {
            $this->error($written['err']);
        }
        $this->success('OK', null, ['cover_pdf_url' => $written['web_url']]);
    }

    /**
     * 比赛排版：删除自定义封面 PDF
     */
    public function contest_print_cover_delete_ajax()
    {
        if (!$this->isContestAdmin) {
            $this->error('Permission denied');
        }
        $this->assertContestNotArchivedForWrite();

        $r = ContestAttachFile::deleteRel($this->contest, 'contest_print/contest_print_cover.pdf');
        if (!$r['ok']) {
            $this->error($r['err']);
        }
        $this->success('OK', null, ['removed' => $r['removed']]);
    }
}

