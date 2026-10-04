<?php
/**
 * Created by PhpStorm.
 * User: CSGrandeur
 * Date: 2017/3/2
 * Time: 20:25
 */
namespace app\admin\controller;
use app\common\funcs\ContestAwardMath;
use app\common\funcs\ContestHeaderBanner;
use app\common\funcs\UploadChunkMerge;
use think\db\Expression;
use think\facade\Validate;
use app\common\traits\AdminContestTrait;
use app\common\traits\ContestDeleteTrait;
// ContestInfoTrait 已不再使用，已移除引用
class Contest extends Adminbase
{
    use AdminContestTrait;
    use ContestDeleteTrait;

    /**
     * 将 contest.award_ratio 解析为 [gold, silver, bronze]
     * @param array $contest
     * @return array
     */
    private function parseAwardRatioFromContest($contest)
    {
        $award_ratio = intval($contest['award_ratio'] ?? 0);
        $ratio_gold = $award_ratio % 1000; $award_ratio = intdiv($award_ratio, 1000);
        $ratio_silver = $award_ratio % 1000; $award_ratio = intdiv($award_ratio, 1000);
        $ratio_bronze = $award_ratio % 1000;
        return [$ratio_gold, $ratio_silver, $ratio_bronze];
    }

    /**
     * 读取比赛赛事归属（旧数据自动映射 default）
     * @param int $contest_id
     * @return array
     */
    private function getContestGroupListCompat($contest_id)
    {
        $contest_id = intval($contest_id);
        if ($contest_id <= 0) return [];
        $rows = db('contest_group')
            ->where(['contest_id' => $contest_id, 'defunct' => 'N'])
            ->order('group_order', 'asc')
            ->select();
        if (is_array($rows) && count($rows) > 0) return $rows;
        $contest = db('contest')->where('contest_id', $contest_id)->find();
        if (!$contest) return [];
        $ratio = $this->parseAwardRatioFromContest($contest);
        return [[
            'contest_id' => $contest_id,
            'group_id' => 'default',
            'group_name' => '默认赛事',
            'group_name_en' => 'Default Event',
            'group_order' => 0,
            'award_ratio_gold' => $ratio[0],
            'award_ratio_silver' => $ratio[1],
            'award_ratio_bronze' => $ratio[2],
            'flg_award_qty_mode' => ContestAwardMath::normalizeQtyMode($contest['flg_award_qty_mode'] ?? 0),
            'topteam' => max(1, min(20, intval($contest['topteam'] ?? 1))),
            'star_mode' => 0,
            'defunct' => 'N',
            'addition' => null,
        ]];
    }

    /**
     * 保存比赛赛事归属（空提交时自动落 default）。
     * Web 请求路径上 **`contest_group` 表仅由此方法**（经 `contest_edit_ajax` / `contest_add_ajax` 调用）写入；赛内简版走 **`ContestAdminBaseTrait::contest_edit_ajax`** 不触碰该表（见 guide/01 #harness-contest-edit-dual-admin）。
     * @param int $contest_id
     * @param array $contest
     * @param array $groups
     */
    private function saveContestGroupsCompat($contest_id, $contest, $groups)
    {
        $contest_id = intval($contest_id);
        if ($contest_id <= 0) return;
        db('contest_group')->where('contest_id', $contest_id)->delete();
        if (!is_array($groups)) $groups = [];
        $rows = [];
        $seen = [];
        $order = 0;
        foreach ($groups as $g) {
            $gid = trim(strval($g['group_id'] ?? ''));
            $gname = trim(strval($g['group_name'] ?? ''));
            if ($gid === '' || $gname === '') continue;
            if (!preg_match('/^[A-Za-z0-9_]+$/', $gid)) continue;
            if (isset($seen[$gid])) continue;
            $seen[$gid] = 1;
            $rows[] = [
                'contest_id' => $contest_id,
                'group_id' => mb_substr($gid, 0, 255),
                'group_name' => mb_substr($gname, 0, 255),
                'group_name_en' => mb_substr(strval($g['group_name_en'] ?? ''), 0, 255),
                'group_order' => isset($g['group_order']) ? intval($g['group_order']) : $order,
                'award_ratio_gold' => intval($g['award_ratio_gold'] ?? 10),
                'award_ratio_silver' => intval($g['award_ratio_silver'] ?? 15),
                'award_ratio_bronze' => intval($g['award_ratio_bronze'] ?? 20),
                'flg_award_qty_mode' => ContestAwardMath::normalizeQtyMode($g['flg_award_qty_mode'] ?? 0),
                'topteam' => max(1, min(20, intval($g['topteam'] ?? 1))),
                'star_mode' => 0,
                'defunct' => 'N',
                'addition' => isset($g['addition']) ? json_encode($g['addition'], JSON_UNESCAPED_UNICODE) : null,
            ];
            $order++;
        }
        if (count($rows) === 0) {
            $ratio = $this->parseAwardRatioFromContest($contest);
            $rows[] = [
                'contest_id' => $contest_id,
                'group_id' => 'default',
                'group_name' => '默认赛事',
                'group_name_en' => 'Default Event',
                'group_order' => 0,
                'award_ratio_gold' => $ratio[0],
                'award_ratio_silver' => $ratio[1],
                'award_ratio_bronze' => $ratio[2],
                'flg_award_qty_mode' => ContestAwardMath::normalizeQtyMode($contest['flg_award_qty_mode'] ?? 0),
                'topteam' => max(1, min(20, intval($contest['topteam'] ?? 1))),
                'star_mode' => 0,
                'defunct' => 'N',
                'addition' => null,
            ];
        }
        db('contest_group')->insertAll($rows, true);
    }

    //***************************************************************//
    //Contest
    //***************************************************************//
    public function index() {
        $this->assign('is_admin', true);
        $this->assign('contest_super_delete', IsAdmin('super_admin'));
        $this->assign('contest_archive_column', $this->OJ_STATUS === 'cpc');
        $ojPath = config('OjPath.');
        $this->assign(
            'contest_attach_web_base',
            (string) ($ojPath['contest_ATTACH'] ?? '/upload/contest_attach')
        );
        if($this->OJ_STATUS == 'cpc') {
            return $this->fetch();
        } else {
            return $this->fetch('index_clss');
        }
    }
    public function contest_list_ajax() {
        $map = [];
        $defunct = input('defunct/d');
        if($defunct !== null) {
            $map['defunct'] = $defunct;
        }
        
        // 通过钩子获取 protected/private 过滤条件（exadmin 可以重写此方法处理特殊逻辑）
        $protectedFilter = $this->getContestProtectedFilter();
        
        // 通过钩子获取额外的查询条件（如 clss_id 等）
        $extraMap = $this->getContestListExtraMap();
        $map = array_merge($map, $extraMap);
        
        // 应用查询过滤钩子（用于注入 course_item 联查等条件）
        $Contest = db('contest');
        $Contest = $this->applyQueryFilterToQuery($Contest, $map, 'contest');
        
        // 单独处理 protected/private 过滤条件（避免 ThinkPHP 5.1 解析错误）
        if($protectedFilter !== null) {
            // 检查是否是 ThinkPHP 查询格式（如 ['in', [4, 14]]）
            if(is_array($protectedFilter) && count($protectedFilter) == 2 && $protectedFilter[0] == 'in' && is_array($protectedFilter[1])) {
                // 使用链式调用方式应用 IN 查询
                $Contest->where('private', 'in', $protectedFilter[1]);
            } else {
                // 简单值，直接使用 where
                $Contest->where('private', $protectedFilter);
            }
        }
        
        // 通过钩子应用额外的 join（如 clss 表关联）
        $Contest = $this->applyContestListJoin($Contest);
        
        $column = input('column/s');
        if($column != null) {
            return $Contest->column($column);
        } else {
            // 通过钩子获取字段列表（exadmin 可以添加额外字段如 clss_title 等）
            $fields = $this->getContestListFields();
            $contest_list = $Contest->field($fields)->select();
            $ojPath = config('OjPath.');
            $publicRoot = rtrim((string) ($ojPath['PUBLIC'] ?? ''), '/');
            $contestAttachRel = (string) ($ojPath['contest_ATTACH'] ?? '/upload/contest_attach');
            foreach($contest_list as &$contest) {
                if(IsAdmin() || IsAdmin('con', $contest['contest_id'])) {
                    $contest['is_admin'] = true;
                }
                $attach = isset($contest['attach']) ? trim((string) $contest['attach']) : '';
                if ($attach !== '' && $publicRoot !== '') {
                    $meta = ContestHeaderBanner::resolvePublicMeta(
                        $publicRoot,
                        $contestAttachRel,
                        $contestAttachRel,
                        $attach
                    );
                    $contest['contest_header_banner_kind'] = $meta['kind'] ?? '';
                    $contest['contest_header_banner_mtime'] = intval($meta['mtime'] ?? 0);
                } else {
                    $contest['contest_header_banner_kind'] = '';
                    $contest['contest_header_banner_mtime'] = 0;
                }
            }
            unset($contest);

            if (IsAdmin('super_admin')) {
                $cid_list = [];
                foreach ($contest_list as $c) {
                    $cid_list[] = intval($c['contest_id'] ?? 0);
                }
                $cid_list = array_values(array_filter(array_unique($cid_list)));
                if (!empty($cid_list)) {
                    [$has_solution, $has_team, $has_asheet] = $this->contestDeleteBarrierMaps($cid_list, true);
                    foreach ($contest_list as &$contest) {
                        $this->contestDeleteApplyEligibilityToRow($contest, $has_solution, $has_team, $has_asheet, true);
                    }
                    unset($contest);
                }
            }

            return $contest_list;
        }
    }

    /**
     * 赛事归属配置接口（旧数据兼容）
     */
    public function contest_group_list_ajax()
    {
        $cid = intval(input('cid/d', 0));
        if ($cid <= 0) {
            return [];
        }
        if (!PrivItem($this->privilegeStr, $cid, 'admin')) {
            $this->error('Powerless');
        }
        return $this->getContestGroupListCompat($cid);
    }
    
    /**
     * 钩子方法：获取 contest 的 protected 过滤条件
     * exadmin 可以重写此方法处理 exp 相关的特殊逻辑
     * @return array|null 返回 protected 过滤条件（ThinkPHP 查询格式，如 ['in', [4, 14]]），null 表示不使用过滤
     */
    protected function getContestProtectedFilter()
    {
        // admin 模块：根据 OJ_STATUS 决定
        if($this->OJ_STATUS == 'cpc') {
            return ['in', [0, 1, 2, 10, 11, 12]];
        } else {
            return ['in', [4, 14]];
        }
    }
    
    /**
     * 钩子方法：获取 contest_list 的额外查询条件
     * exadmin 可以重写此方法添加额外条件（如 clss_id）
     * @return array 额外的查询条件
     */
    protected function getContestListExtraMap()
    {
        $extraMap = [];
        // admin 模块：exp 模式下处理 clss_id
        if($this->OJ_STATUS != 'cpc') {
            $clss_id = input('clss_id/d');
            if($clss_id !== null) {
                $extraMap['password'] = $clss_id;
            }
        }
        return $extraMap;
    }
    
    /**
     * 钩子方法：应用 contest_list 的额外 join
     * exadmin 可以重写此方法添加额外表关联（如 clss 表）
     * @param \think\db\Query $query 查询对象
     * @return \think\db\Query 处理后的查询对象
     */
    protected function applyContestListJoin($query)
    {
        // admin 模块：不添加额外 join
        return $query;
    }
    
    /**
     * 钩子方法：获取 contest_list 的字段列表
     * exadmin 可以重写此方法添加额外字段（如 clss_title 等）
     * @return string|array 字段列表，可以是字符串或数组
     */
    protected function getContestListFields()
    {
        // admin 模块：列出除 description、notification外的全部字段，避免列表接口返回大文本
        return 'contest_id,title,start_time,end_time,defunct,private,langmask,password,clss_id,attach,topteam,award_ratio,flg_award_qty_mode,frozen_minute,frozen_after,contest_rank_kind,ccpc_reveal_policy,teachers,addition,flg_archive';
    }

    /**
     * 添加比赛时表单默认比赛类型（private 基值：0=公开 1=私有 2=标准）
     * OJ_MODE=cpcsys 且 OJ_STATUS=cpc 时默认 Standard(2)；OJ_MODE=online 时默认 Private(1)；其它默认 Standard(2)
     * @return int
     */
    protected function getDefaultContestPrivateForAdd()
    {
        if ($this->OJ_MODE === 'cpcsys' && $this->OJ_STATUS === 'cpc') {
            return 2; // Standard
        }
        if ($this->OJ_MODE === 'online') {
            return 1; // Private
        }
        return 2; // Standard（其它情况）
    }

	public function contest_addedit_ajax_process()
	{
        $postData = input('post.');
        $contest_info = [
            'title'         => trim($postData['title']),
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
            'private'     => intval($postData['private']),
            'langmask'    => $this->CalLangMask(isset($postData['language']) ? $postData['language'] : []), //这里用input('post.language')不行，可能是ThinkPHP当前版本bug
            'password'    => trim($postData['password'] ?? ""),
            'description' => trim($postData['description'] ?? ''),
            'notification' => trim($postData['notification'] ?? ''),
            'frozen_minute' => intval($postData['frozen_minute']),
            'frozen_after' => intval($postData['frozen_after'])
        ];
        if(strlen($contest_info['title']) == 0) {
            $this->error("Title should not be empty.");
        }
        $attach_pro = input('?attach_pro') ? input('attach_pro/d') : 0;  // 是否有附加题（是否将最后一题计入总分），有则不计，没有则计
        // 以最高多少队总分为学校排名
        $contest_info['topteam'] = intval($postData['topteam']);
        if($contest_info['topteam'] > 20) {
            $contest_info['topteam'] = 20;
        }
        if($contest_info['topteam'] < 1){
            $contest_info['topteam'] = 1;
        }
        $contest_info['private'] = $attach_pro * 10 + $contest_info['private'];
        try {
            $contest_info = array_replace($contest_info, \app\common\funcs\CcpcRules::settings($postData, $this->contest ?? []));
        } catch (\InvalidArgumentException $e) { $this->error($e->getMessage()); }
        if($contest_info['frozen_minute'] > 2592000 || $contest_info['frozen_after'] > 2592000)
            $this->error('Frozen time too long.');
        $passLen = strlen($contest_info['password']);
        // if($passLen > 0 && $passLen < 3) {
        //     $this->error("Contest Password should more than 6 characters");
        // }
        if($passLen > 15) {
            $this->error("Contest Password should NOT more than 15 characters");
        }
        $contest_md_info = [
            'description' => $contest_info['description'],
            'notification' => $contest_info['notification'],
        ];
        //插入contest表，描述字段和公告字段为md编译的html
        $contest_info['description'] = ParseMarkdown($contest_md_info['description']);
        $contest_info['notification'] = ParseMarkdown($contest_md_info['notification']);

        // 时间格式如果错误，直接插入mysql会抛出异常且暂时没找到方法catch异常，导致直接500而不ajax反馈错误。所以手动判断
        if(!strtotime($contest_info['start_time']) || !strtotime($contest_info['end_time']))
            $this->error('Time syntax error.');
        $starttime = strtotime($contest_info['start_time']);
        $endtime = strtotime($contest_info['end_time']);
        if($starttime >= $endtime) {
            $this->error('Start Time should before End Time.');
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
    public function contest_add()
    {
        $now = time();
        $this->assign([
            'start_year'    => date('Y', $now),
            'start_month'   => date('m', $now),
            'start_day'     => date('d', $now),
            'start_hour'    => date('H', $now),
            'start_minute'  => 0,
            'end_year'      => date('Y', $now + 18000),
            'end_month'     => date('m', $now + 18000),
            'end_day'       => date('d', $now + 18000),
            'end_hour'      => date('H', $now + 18000),
            'end_minute'    => 0,
            'private'       => $this->getDefaultContestPrivateForAdd(),
            'topteam'       => 1,   // 每个学校前topteam个正式队伍计入学校排名
            'ratio_gold'    => 10,
            'ratio_silver'  => 20,
            'ratio_bronze'  => 30,
            'flg_award_qty_mode' => 0,
            'frozen_minute' => 60,
            'frozen_after'  => 300,
            'edit_mode'     => false,
            'pagetitle'     => '添加比赛',
        ]);
        return $this->fetch('contest_edit');
    }
    public function contest_add_ajax(){
		$ret = $this->contest_addedit_ajax_process();
		$contest_add = $ret[0];
		$contest_md_add = $ret[1];
        $contest_groups = [];
        $groupsRaw = input('contest_groups_json/s', '');
        if ($groupsRaw !== '') {
            $decoded = json_decode($groupsRaw, true);
            if (is_array($decoded)) $contest_groups = $decoded;
        }
        if (count($contest_groups) > 10) {
            $this->error('赛事归属最多 10 个');
        }
        if (count($contest_groups) > 0) {
            $errG = ContestAwardMath::validateAllGroups($contest_groups);
            if ($errG !== null) {
                $this->errorBilingual($errG['msg_cn'], $errG['msg_en']);
            }
            ContestAwardMath::applyFirstGroupToContestRow($contest_add, $contest_groups);
        }

        $contest_add['attach']     = $this->AttachFolderCalculation(session('user_id')); // 计算附件文件夹名称，固定后导入导出题目不会有路径变化问题
		$contest_add['defunct'] = '1';  // 默认隐藏防泄漏
		
        // 应用插入数据钩子（用于注入 course_key 等字段）
        $contest_add = $this->prepareInsertData($contest_add, 'contest');
        $contest_id = db('contest')->insertGetId($contest_add);
        if(!$contest_id)
            $this->error('Add contest failed, SQL error.');
        
        // 插入后处理 course_item 映射
        $this->afterInsertData($contest_add, 'contest', $contest_id);
			
        // contest已插入，下面处理contest_md
        $contest_md = db('contest_md')->where('contest_id', $contest_id)->find();
        $contest_md_add['contest_id'] = $contest_id; //注意contest_md表要设置contest_id以和contest表对应。
        //虽然新插数据基本不会发生contest_md已有此contest_id的情况，但以防万一contest表被删除过并修改过auto_increacement
        if($contest_md == null) {
            db('contest_md')->insert($contest_md_add);
        }
        else {
			$contest_md_add['contest_id'] = $contest_id;
            db('contest_md')->update($contest_md_add);
        }
        $this->saveContestGroupsCompat($contest_id, $contest_add, $contest_groups);
        $addmsg = $this->contest_outeritem_add($contest_id, $contest_add);
        
        // 使用钩子方法处理比赛创建后的逻辑（权限添加等）
        if (method_exists($this, 'afterContestCreated')) {
            $this->afterContestCreated($contest_id, $contest_add);
        } else {
            // 兼容旧代码：直接添加权限（如果没有钩子方法）
            //由于该用户添加的，给该用户管理该比赛的权限（用于不同比赛分权）
            $this->AddPrivilege(session('user_id'), 'contest', $contest_id);
        }
        
        $successmsg = 'Contest successfully added.' . ($addmsg == '' ? '' : '<br/>'.$addmsg);
        
        //处理cooperator
        $cooperator = input('cooperator/s');
        $cooperatorList = explode(",", $cooperator);
        $cooperatorFailList = $this->SaveCooperator($cooperatorList, $contest_id);
        $alert = false;
        if(strlen($cooperatorFailList) > 0) {
            $alert = true;
        }
        $this->success($successmsg, '', ['id' => $contest_id, 'alert' => $alert]);
    }
    public function contest_edit($copy_mode=false) {
        $contest_id = trim(input('id'));
        if(!PrivItem($this->privilegeStr, $contest_id, 'admin'))
        {
            $this->error('Powerless');
        }
        $contest = db('contest')->where('contest_id', $contest_id)->find();
        if($contest == null)
        {
            $this->error('No such contest.');
        }
        // 验证资源归属（用于验证 course_key 等）
        $this->validateItemBelong($contest, 'contest');
        $contest_md = db('contest_md')->where('contest_id', $contest_id)->find();
        if($contest_md != null)
        {
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
        // 比赛的题目列表
        $contestProblem = db('contest_problem')->where('contest_id', $contest_id)->order('num')->select();
        $problems = [];
        $balloon_colors = [];
        foreach($contestProblem as $problem) {
            $p = $problem['problem_id'];
            // if($this->OJ_OPEN_OI && $problem['pscore'] > 0) {
            //     $p .= ":" . $problem['pscore'];
            // }
            $problems[] = $p;
            $balloon_colors[] = $problem['title'];
        }
        // 参赛白名单：pvrole 为空串（表 NOT NULL）；兼容历史 NULL
        $contestUser = db('privilege_item')->where([
            'rightitem' => 'contest',
            'item_id' => $contest_id,
            'defunct' => '0'
        ])->where(function ($q) {
            $q->whereNull('pvrole')->whereOr('pvrole', '');
        })->order('user_id')->select();
        $users = [];
        foreach($contestUser as $user)
            $users[] = $user['user_id'];
        $cooperator = $this->GetCooperator($contest['contest_id']);
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
            'private'       => $contest['private'],
            'topteam'       => $contest['topteam'],
            'ratio_gold'    => $ratio_gold,
            'ratio_silver'  => $ratio_silver,
            'ratio_bronze'  => $ratio_bronze,
            'flg_award_qty_mode' => ContestAwardMath::normalizeQtyMode($contest['flg_award_qty_mode'] ?? 0),
            'frozen_minute' => $contest['frozen_minute'],
            'frozen_after'  => $contest['frozen_after'],
            'contest'       => $contest,
            'problems'      => implode(",", $problems),
            'balloon_colors'=> implode(",", $balloon_colors),
            'users'         => implode("\n", $users),
            'cooperator'    => implode(",", $cooperator),
            'item_priv'     => PrivItem($this->privilegeStr, $contest['contest_id'], 'admin'),
            'edit_mode'     => true,
            'copy_mode'     => $copy_mode,
            'pagetitle'     => $copy_mode ? '复制比赛' : '编辑比赛',
        ]);
        return $this->fetch('contest_edit');
    }
    public function contest_copy() {
        return $this->contest_edit(true);
    }

    /**
     * 大后台全量比赛保存：`contest` / `contest_md` / **`contest_group`**（`contest_groups_json`）/ 题目与白名单等。
     */
    public function contest_edit_ajax()
    {
        $contest_id = trim(input('contest_id'));
        if(!PrivItem($this->privilegeStr, $contest_id, 'admin'))
        {
            $this->error('Powerless');
        }
        // ThinkPHP5.1 Query 有状态：find/update 等独立操作不要复用同一个 Query 对象
        $contestinfo = db('contest')->where('contest_id', $contest_id)->find();
        if(!$contestinfo)
        {
            $this->error('No such contest.');
        }
        // 验证资源归属（用于验证 course_key 等）
        $this->validateItemBelong($contestinfo, 'contest');
		
		$ret = $this->contest_addedit_ajax_process();
		$contest_edit = $ret[0];
		$contest_md_edit = $ret[1];
        $contest_groups = [];
        $groupsRaw = input('contest_groups_json/s', '');
        if ($groupsRaw !== '') {
            $decoded = json_decode($groupsRaw, true);
            if (is_array($decoded)) $contest_groups = $decoded;
        }
        if (count($contest_groups) > 10) {
            $this->error('赛事归属最多 10 个');
        }
        if (count($contest_groups) > 0) {
            $errG = ContestAwardMath::validateAllGroups($contest_groups);
            if ($errG !== null) {
                $this->errorBilingual($errG['msg_cn'], $errG['msg_en']);
            }
            ContestAwardMath::applyFirstGroupToContestRow($contest_edit, $contest_groups);
        }

		
        $contestinfo = array_replace($contestinfo, $contest_edit);
        // 应用更新数据钩子（如果需要）
        $contestinfo = $this->prepareUpdateData($contestinfo, 'contest');

        db('contest')->update($contestinfo);
        // contest已插入，下面处理contest_md
        $contest_md = db('contest_md')->where('contest_id', $contest_id)->find();
        $contest_md_edit['contest_id'] = $contest_id;
        if(!$contest_md) {
            db('contest_md')->insert($contest_md_edit);
        }
        else {
			$contest_md_edit['contest_id'] = $contest_id;
            db('contest_md')->update($contest_md_edit);
        }
        $this->saveContestGroupsCompat($contest_id, $contestinfo, $contest_groups);
        $addmsg = $this->contest_outeritem_add($contest_id, $contestinfo);
        $successmsg = 'Contest successfully edited.' . ($addmsg == '' ? '' : '<br/>'.$addmsg);
        //处理cooperator
        $cooperator = input('cooperator/s');
        $cooperatorList = explode(",", $cooperator);
        $cooperatorFailList = $this->SaveCooperator($cooperatorList, $contest_id);
        $alert = false;
        if(strlen($cooperatorFailList) > 0)
        {
            $alert = true;
        }
        $this->success($successmsg . $cooperatorFailList, '', ['alert' => $alert]);
    }
    private function CalLangMask($languages)
    {
        $ret = LangList2LangMask($languages);
        if($ret == -1) $this->error('Please select at least 1 language.');
        if($ret == -2) $this->error('Some languages are not allowed for this OJ.');
        return $ret;
    }
    private function contest_outeritem_add($contest_id, $contest)
    {
        /***********/
        // 处理Contest Problems
        $ret = $this->contest_outeritem_add_problems($contest_id, $contest, [
            'with_balloon_colors' => true,
            'include_title' => true,
        ]);
        /***********/
        // 处理Contest Users
        $this->contest_outeritem_add_users($contest_id);
        return $ret;
    }

    /**
     * CPC：切换 flg_archive（系统管理员或该赛管理员）。
     */
    /**
     * 超级管理员删除比赛（与 ContestDeleteTrait::deleteContest 校验一致，含答卷检查）
     */
    public function contest_delete_ajax()
    {
        if (!$this->request->isPost()) {
            return json(['code' => 0, 'msg' => 'POST required']);
        }
        if (!IsAdmin('super_admin')) {
            return json(['code' => 0, 'msg' => '权限不足']);
        }
        $contest_id = intval(request()->post('contest_id', 0));
        $result = $this->deleteContest($contest_id, true);
        return json($result);
    }

    public function contest_archive_toggle_ajax()
    {
        if (!$this->request->isPost()) {
            $this->error('POST required');
        }
        if ($this->OJ_STATUS !== 'cpc') {
            $this->errorBilingual('当前站点未开放此功能', 'This feature is not available on this site');
        }
        $cid = intval(input('post.cid', 0));
        if ($cid <= 0) {
            $this->error('Invalid contest');
        }
        if (!IsAdmin('administrator') && !IsAdmin('con', $cid)) {
            $this->error('Permission denied');
        }
        $v = intval(input('post.flg_archive', 0)) !== 0 ? 1 : 0;
        db('contest')->where('contest_id', $cid)->update(['flg_archive' => $v]);
        $this->success('ok', null, ['flg_archive' => $v]);
    }

    /**
     * CPC：比赛包导入/导出入口页（大管理员）。
     */
    public function contest_pkg()
    {
        if ($this->OJ_STATUS !== 'cpc' || !IsAdmin('administrator')) {
            $this->error('Permission denied');
        }
        $ojPath = config('OjPath.');
        if (!MakeDirs($ojPath['export_contest']) || !MakeDirs($ojPath['import_contest_temp'])) {
            $this->error('Folder permission denied.');
        }
        $maxFileSize = config('CsgojConfig.OJ_UPLOAD_IMPORT_MAXSIZE');
        $maxFileNum = config('CsgojConfig.OJ_UPLOAD_MAXNUM');
        $exportKeepDays = intval($ojPath['export_keep_time'] ?? 30);
        $this->assign([
            'inputinfo'     => [
                'item'     => 'contestpkg',
                'id'       => '0',
                'filename' => '',
                'rename'   => '',
                'path'     => '',
                'key'      => '',
            ],
            'itemInfo'      => ['attach' => '', 'title' => ''],
            'file_url'      => '/admin/contest/contest_pkg_filemanager_ajax',
            'delete_url'    => '/admin/contest/contest_pkg_file_delete_ajax',
            'rename_url'    => '#',
            'upload_url'    => '/admin/contest/chunk_upload_contest_pkg_ajax',
            'fire_url'      => '/admin/contest/contest_import_ajax',
            'attach_notify' => '比赛包 zip 将保留约 ' . $exportKeepDays . ' 天，详见后台任务与清理策略。',
            'attach_notify_en' => 'Contest ZIP files are kept for about ' . $exportKeepDays . ' days. See Backtask for progress and retention.',
            'maxfilesize'   => $maxFileSize,
            'maxFileNum'    => $maxFileNum,
            'contest_pkg_export_ajax_url'   => '/admin/contest/contest_export_enqueue_ajax',
            'contest_pkg_precheck_ajax_url' => '/admin/contest/contest_export_precheck_ajax',
            'contest_pkg_suggest_ajax_url'  => '/admin/contest/contest_export_suggest_ajax',
            'contest_pkg_backtask_url'      => '/admin/backtask?item=backtask',
            'contest_pkg_zip_read_url'      => '/admin/contest/contest_pkg_downloaddata',
            'contest_pkg_zip_metadata_ajax_url' => '/admin/contest/contest_pkg_zip_metadata_ajax',
            'contest_pkg_attach_check_url' => '/admin/contest/contest_import_attach_check_ajax',
            'action'                      => 'contest_pkg',
            'filemanager_embed'           => true,
            'filemanager_ui_compact'      => true,
            'filemanager_type_column_cn'  => '导入',
            'filemanager_type_column_en' => 'Import',
            // 与 contest_pkg_file_delete_ajax 等后端校验一致，供 upload_page.js / re_checkfile
            'file_regex'                  => '/^[0-9a-zA-Z-_.()]+\.(zip)$/i',
        ]);
        return $this->fetch('contest/contest_pkg');
    }

    public function contest_pkg_file_delete_ajax()
    {
        if ($this->OJ_STATUS !== 'cpc' || !IsAdmin('administrator')) {
            $this->error('Permission denied');
        }
        $filename = trim(input('filename', ''));
        if (!preg_match('/^[0-9a-zA-Z-_.()]+\.(zip)$/i', $filename)) {
            $this->error('Invalid filename');
        }
        $path = config('OjPath.')['export_contest'] . '/' . $filename;
        if (!is_file($path)) {
            $this->error('Not found');
        }
        if (!DelWhatever($path)) {
            $this->error('Delete failed');
        }
        $this->success('Deleted');
    }

    public function contest_pkg_filemanager_ajax()
    {
        if ($this->OJ_STATUS !== 'cpc' || !IsAdmin('administrator')) {
            $this->error('Permission denied');
        }
        $ojPath = config('OjPath.');
        $path = $ojPath['export_contest'];
        if (!MakeDirs($path)) {
            $this->error('Folder permission denied.');
        }
        DelTimeExpireFolders($path, $ojPath['export_keep_time']);
        $filelist = [];
        if (is_dir($path) && ($handle = opendir($path))) {
            while (($file = readdir($handle)) !== false) {
                if ($file === '.' || $file === '..') {
                    continue;
                }
                $full = $path . '/' . $file;
                if (is_dir($full)) {
                    continue;
                }
                $mt = (int) filemtime($full);
                $filelist[] = [
                    'file_lastmodify' => date('Y-m-d H:i:s', $mt),
                    'file_name'       => $file,
                    'file_size'       => round(filesize($full) / 1024, 2),
                    'file_type'       => 'ContestImport',
                    /* upload_page.js FormatterFileName / FormatterFileType 依赖，与 contest_pkg_downloaddata 一致 */
                    'file_url'        => '/admin/contest/contest_pkg_downloaddata?filename=' . rawurlencode($file),
                    '_sort_mtime'     => $mt,
                ];
            }
            closedir($handle);
        }
        usort($filelist, function ($a, $b) {
            return ($b['_sort_mtime'] ?? 0) <=> ($a['_sort_mtime'] ?? 0);
        });
        foreach ($filelist as &$row) {
            unset($row['_sort_mtime']);
        }
        unset($row);

        return $filelist;
    }

    public function chunk_upload_contest_pkg_ajax()
    {
        if ($this->OJ_STATUS !== 'cpc' || !IsAdmin('administrator')) {
            $this->error('Permission denied');
        }
        $ojPath = config('OjPath.');
        $finalDir = $ojPath['export_contest'];
        if (!MakeDirs($finalDir)) {
            $this->error('Folder permission denied.');
        }
        $fileName = trim((string) request()->post('fileName', ''));
        if (!preg_match('/^[0-9a-zA-Z-_.()]+\.(zip)$/i', $fileName)) {
            $this->error('文件名不合法');
        }
        $ret = UploadChunkMerge::receiveChunk(
            request()->file('upload_file'),
            request()->post('index'),
            request()->post('totalChunks'),
            $fileName,
            $finalDir,
            $ojPath['chunk_file_temp']
        );
        if (!$ret['ok']) {
            $this->error($ret['err']);
        }
        if ($ret['merged']) {
            $this->success('OK', '', ['saved_files' => $ret['saved_files']]);
        }
        $this->success(
            '分片上传成功(Chunk uploaded successfully)',
            '',
            ['fileName' => $ret['fileName'], 'index' => $ret['index'], 'total' => $ret['total']]
        );
    }

    /**
     * 比赛包导入前：检查包内 contest.attach 是否已占用（库中已有比赛或盘上已有附件目录）。
     */
    public function contest_import_attach_check_ajax()
    {
        if ($this->OJ_STATUS !== 'cpc' || !IsAdmin('administrator')) {
            $this->error('Permission denied');
        }
        $attach = trim((string) input('attach', ''));
        if ($attach === '') {
            $this->success('', null, ['exists' => false]);
        }
        if (!preg_match('/^[A-Za-z0-9._-]{1,200}$/', $attach)) {
            $this->error('Invalid attach');
        }
        $exists = false;
        $row = db('contest')->where('attach', $attach)->field('contest_id')->find();
        if ($row) {
            $exists = true;
        }
        if (!$exists) {
            $ojPath = config('OjPath.');
            $rel = trim(str_replace('\\', '/', (string) ($ojPath['contest_ATTACH'] ?? '/upload/contest_attach')), '/');
            $cap = rtrim((string) ($ojPath['PUBLIC'] ?? ''), "/\\") . '/' . $rel . '/' . $attach;
            if (is_dir($cap)) {
                $exists = true;
            }
        }
        $this->success('', null, ['exists' => $exists]);
    }

    public function contest_import_ajax()
    {
        if ($this->OJ_STATUS !== 'cpc' || !IsAdmin('administrator')) {
            $this->error('Permission denied');
        }
        $filename = trim(input('filename', ''));
        if (!preg_match('/^[0-9a-zA-Z-_.()]+\.(zip)$/i', $filename)) {
            $this->error('Invalid file');
        }
        $ojPath = config('OjPath.');
        $full = $ojPath['export_contest'] . '/' . $filename;
        if (!is_file($full)) {
            $this->error('No such file');
        }
        $bad = '';
        if (!MakeDirs($ojPath['testdata']) || !is_writable($ojPath['testdata'])) {
            $bad .= 'testdata ';
        }
        $pa = $ojPath['PUBLIC'] . '/' . $ojPath['problem_ATTACH'];
        if (!MakeDirs($pa) || !is_writable($pa)) {
            $bad .= 'problem_attach ';
        }
        if (!MakeDirs($ojPath['import_contest_temp']) || !is_writable($ojPath['import_contest_temp'])) {
            $bad .= 'import_contest_temp ';
        }
        if ($bad !== '') {
            $this->error('路径不可写: ' . $bad);
        }
        $regenRaw = trim((string) input('regenerate_contest_attach', ''));
        $regenFlag = ($regenRaw === '1' || strcasecmp($regenRaw, 'true') === 0);
        $taskParams = [
            'import_file'           => $full,
            'import_temp_base'      => $ojPath['import_contest_temp'],
            'export_temp_keep_time' => floatval($ojPath['export_temp_keep_time'] ?? 7),
            'testdata_dir'          => $ojPath['testdata'],
            'public_attach_root'    => $pa,
            'public_dir'            => $ojPath['PUBLIC'],
            'contest_attach_rel'    => $ojPath['contest_ATTACH'],
            'oj_status'             => strval(config('CsgojConfig.OJ_STATUS') ?? ''),
            'user_id'               => intval(session('user_id')),
            'created_by'            => session('user_id'),
        ];
        if ($regenFlag) {
            $taskParams['regenerate_contest_attach'] = true;
        }
        session_write_close();
        $taskParams = backtask_params_with_site_key($taskParams);
        $taskId = db('backtask')->insertGetId(array_merge(backtask_naive_wall_timestamps_for_insert(), [
            'task_type'   => 'contest_import',
            'task_params' => json_encode($taskParams, JSON_UNESCAPED_UNICODE),
            'status'      => 0,
            'priority'    => 0,
        ]));
        $this->success(
            '比赛导入任务已提交',
            null,
            ['task_id' => $taskId, 'url' => '/admin/backtask?item=backtask']
        );
    }

    /**
     * 比赛包导出页：可导出比赛的 ID + 标题摘要候选（仅 private%10∈0,1,2），供输入框启发式筛选。
     */
    public function contest_export_suggest_ajax()
    {
        if ($this->OJ_STATUS !== 'cpc' || !IsAdmin('administrator')) {
            $this->error('Permission denied');
        }
        $q = trim((string) input('get.q', ''));
        $limit = intval(input('limit', 30));
        if ($limit < 5) {
            $limit = 5;
        }
        if ($limit > 80) {
            $limit = 80;
        }

        $query = db('contest')
            ->field('contest_id,title,private')
            ->whereRaw('(`private` % 10) IN (0, 1, 2)');

        if ($q !== '') {
            if (preg_match('/^\d+$/', $q)) {
                $query->where('contest_id', 'like', $q . '%');
            } else {
                $like = '%' . addcslashes($q, '%_\\') . '%';
                $query->where('title', 'like', $like);
            }
        }

        $rows = $query->order('contest_id', 'desc')->limit($limit)->select();
        $out = [];
        foreach ($rows as $r) {
            $pv = intval($r['private'] ?? 0);
            if (!contest_pkg_export_allowed_private($pv)) {
                continue;
            }
            $cid = intval($r['contest_id']);
            $title = isset($r['title']) ? (string) $r['title'] : '';
            if (function_exists('mb_strlen') && function_exists('mb_substr')) {
                $short = mb_strlen($title, 'UTF-8') > 52
                    ? mb_substr($title, 0, 52, 'UTF-8') . '…'
                    : $title;
            } else {
                $short = strlen($title) > 52 ? substr($title, 0, 52) . '…' : $title;
            }
            $out[] = [
                'contest_id'  => $cid,
                'title'       => $title,
                'title_short' => $short,
            ];
        }
        $this->success('ok', null, ['rows' => $out]);
    }

    /**
     * 导出前预检：比赛是否存在、类型是否允许打包导出（排除练习/实验、考试等）。
     */
    public function contest_export_precheck_ajax()
    {
        if ($this->OJ_STATUS !== 'cpc' || !IsAdmin('administrator')) {
            $this->error('Permission denied');
        }
        $cid = intval(input('contest_id', 0));
        if ($cid <= 0) {
            $this->success('', null, [
                'exportable'    => false,
                'flg_bilingual' => true,
                'msg_cn'        => '请输入有效的比赛 ID。',
                'msg_en'        => 'Please enter a valid contest ID.',
            ]);
        }
        $row = db('contest')->field('contest_id,title,private')->where('contest_id', $cid)->find();
        if (!$row) {
            $this->success('', null, [
                'exportable'    => false,
                'flg_bilingual' => true,
                'msg_cn'        => '未找到该比赛。',
                'msg_en'        => 'Contest not found.',
            ]);
        }
        $pv = intval($row['private']);
        $deny = contest_pkg_export_deny_bilingual($pv);
        if ($deny !== null) {
            $this->success('', null, [
                'exportable'    => false,
                'flg_bilingual' => true,
                'msg_cn'        => $deny[0],
                'msg_en'        => $deny[1],
                'title'         => $row['title'],
                'private_kind'  => contest_pkg_export_private_kind($pv),
            ]);
        }
        $this->success('', null, [
            'exportable'   => true,
            'title'        => $row['title'],
            'private_kind' => contest_pkg_export_private_kind($pv),
        ]);
    }

    public function contest_export_enqueue_ajax()
    {
        if ($this->OJ_STATUS !== 'cpc' || !IsAdmin('administrator')) {
            $this->error('Permission denied');
        }
        $cid = intval(input('contest_id', 0));
        if ($cid <= 0) {
            $this->errorBilingual('请填写比赛 ID。', 'Contest ID is required.');
        }
        $crow = db('contest')->field('contest_id,private')->where('contest_id', $cid)->find();
        if (!$crow) {
            $this->errorBilingual('未找到该比赛。', 'Contest not found.');
        }
        $deny = contest_pkg_export_deny_bilingual(intval($crow['private']));
        if ($deny !== null) {
            $this->errorBilingual($deny[0], $deny[1]);
        }
        $test = input('test_data_check', 'true');
        $att = input('attach_file_check', 'true');
        $testOn = ($test === 'on' || $test === 'true' || $test === '1' || $test === true);
        $attOn = ($att === 'on' || $att === 'true' || $att === '1' || $att === true);
        $ojPath = config('OjPath.');
        if (!MakeDirs($ojPath['export_contest']) || !MakeDirs($ojPath['export_contest_temp'])) {
            $this->error('Folder permission denied.');
        }
        $taskParams = [
            'contest_id'          => $cid,
            'export_tag'          => 'cid' . $cid,
            'test_data_check'     => $testOn,
            'attach_file_check'   => $attOn,
            'testdata_dir'        => $ojPath['testdata'],
            'attach_base_dir'     => $ojPath['PUBLIC'] . '/' . $ojPath['problem_ATTACH'],
            'export_dir'          => $ojPath['export_contest'],
            'export_temp_dir'     => $ojPath['export_contest_temp'],
            'public_dir'          => $ojPath['PUBLIC'],
            'contest_attach_rel'  => $ojPath['contest_ATTACH'],
            'created_by'          => session('user_id'),
        ];
        session_write_close();
        $taskParams = backtask_params_with_site_key($taskParams);
        $taskId = db('backtask')->insertGetId(array_merge(backtask_naive_wall_timestamps_for_insert(), [
            'task_type'   => 'contest_export',
            'task_params' => json_encode($taskParams, JSON_UNESCAPED_UNICODE),
            'status'      => 0,
            'priority'    => 0,
        ]));
        $this->success(
            '比赛导出任务已提交',
            null,
            ['task_id' => $taskId, 'url' => '/admin/backtask?item=backtask']
        );
    }

    /**
     * 读取比赛包内用于导入前校验的简要信息（仅服务端读取，不向浏览器传整包）。
     */
    public function contest_pkg_zip_metadata_ajax()
    {
        if ($this->OJ_STATUS !== 'cpc' || !IsAdmin('administrator')) {
            $this->errorBilingual('无此操作权限。', 'You don’t have permission for this action.');
        }
        $filename = trim((string) input('filename', ''));
        if (!preg_match('/^[0-9a-zA-Z-_.()]+\.(zip)$/i', $filename)) {
            $this->errorBilingual(
                '请在本页文件列表中选择要校验的比赛包。',
                'Choose a contest package from the list on this page.'
            );
        }
        $ojPath = config('OjPath.');
        $dir = rtrim(strval($ojPath['export_contest'] ?? ''), "/\\");
        if ($dir === '' || !is_dir($dir)) {
            $this->errorBilingual(
                '暂时无法读取比赛包，请稍后重试。',
                'Can’t read packages right now. Please try again later.'
            );
        }
        $full = $dir . DIRECTORY_SEPARATOR . $filename;
        if (!is_file($full) || !is_readable($full)) {
            $this->errorBilingual(
                '未找到该文件，请刷新列表后重试。',
                'File not found. Refresh the list and try again.'
            );
        }
        if (!class_exists('ZipArchive')) {
            $this->errorBilingual(
                '无法读取该压缩包，请稍后再试。',
                'Can’t read this archive. Please try again later.'
            );
        }
        $maxJsonBytes = 2 * 1024 * 1024;
        $zip = new \ZipArchive();
        if ($zip->open($full, \ZipArchive::RDONLY) !== true) {
            $this->errorBilingual(
                '压缩包无法打开，请重新导出后再试。',
                'Can’t open the archive. Export again and retry.'
            );
        }
        $idx = $zip->locateName('contest.json', \ZipArchive::FL_NOCASE | \ZipArchive::FL_NODIR);
        if ($idx === false) {
            $zip->close();
            $this->errorBilingual(
                '不是有效的比赛包，请使用本站导出的归档文件。',
                'Not a valid contest package. Use a file exported from this site.'
            );
        }
        $stat = $zip->statIndex($idx);
        if (!is_array($stat) || !isset($stat['size']) || (int) $stat['size'] > $maxJsonBytes) {
            $zip->close();
            $this->errorBilingual(
                '包内数据异常，请重新导出后再试。',
                'The package data looks invalid. Export again and retry.'
            );
        }
        $raw = $zip->getFromIndex($idx);
        $zip->close();
        if ($raw === false) {
            $this->errorBilingual(
                '读取失败，请检查文件是否完整。',
                'Read failed. Check that the file is complete.'
            );
        }
        $o = json_decode($raw, true);
        if (!is_array($o)) {
            $this->errorBilingual(
                '包内数据无效，请使用未改动的导出文件。',
                'Invalid data in the package. Use an unmodified export file.'
            );
        }
        /* attach 可为空：表示包内未带指纹，导入流程仍允许，由后续确认框与后台任务校验整包 */
        $attach = isset($o['attach']) ? trim((string) $o['attach']) : '';
        $this->success('ok', null, ['attach' => $attach]);
    }

    /**
     * 下载比赛包导出产物（与 contest_export 任务 result.filename 一致；供脚本/验收拉取 ZIP）。
     */
    public function contest_pkg_downloaddata()
    {
        if ($this->OJ_STATUS !== 'cpc' || !IsAdmin('administrator')) {
            $this->error('Permission denied');
        }
        $filename = trim((string) input('filename', ''));
        if (!preg_match('/^[0-9a-zA-Z-_.()]+\.(zip)$/i', $filename)) {
            $this->error('Invalid filename');
        }
        $ojPath = config('OjPath.');
        $dir = rtrim(strval($ojPath['export_contest'] ?? ''), "/\\");
        if ($dir === '' || !is_dir($dir)) {
            $this->error('Export folder not available');
        }
        $full = $dir . DIRECTORY_SEPARATOR . $filename;
        if (!is_file($full)) {
            $this->error('Not found');
        }
        // 大文件流式下载前释放会话锁，避免长时间占锁；与 downloads() 内清空输出缓冲配合
        if (function_exists('session_write_close')) {
            @session_write_close();
        }
        try {
            downloads($dir, $filename);
        } catch (\Throwable $e) {
            $this->errorBilingual(
                '文件读取失败：' . $e->getMessage(),
                'Download failed: ' . $e->getMessage()
            );
        }
    }

}