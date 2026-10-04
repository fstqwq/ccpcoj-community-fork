<?php
namespace app\cpcsys\controller;
use think\Db;
use think\Validate;
use app\csgoj\controller\Contest as Contestbase;
use phpDocumentor\Reflection\Types\Null_;
require_once(__DIR__ . "/../../common/traits/ContestBaseTrait.php");
use app\common\traits\ContestBaseTrait;
use app\common\funcs\ContestGroupId;
use app\common\funcs\CcpcRules;

class Contest extends Contestbase
{
    use ContestBaseTrait;
    
    // CPC 比赛系统相关变量已在 ContestBaseTrait 中定义
    public function initialize()
    {
        $this->OJMode();
        $this->ContestInit();
    }
    
    // SetAssignUser(), GetSession(), CanJoin(), IsContestAdmin() 方法已通过 ContestBaseTrait 提供
    protected function contest_login_oper($teamInfo)
    {
        session($this->teamSessionName, [
            'team_id'   => $teamInfo['team_id'],
            'name'      => $teamInfo['name'],
            'name_en'   => $teamInfo['name_en'],
            'tmember'   => $teamInfo['tmember'],
            'coach'     => $teamInfo['coach'],
            'school'    => $teamInfo['school'],
            'region'    => $teamInfo['region'],
            'room'      => $teamInfo['room'],
            'privilege' => $teamInfo['privilege'],
        ]);
    }
    protected function contest_loginlog($team_id, $success)
    {
        // 归档赛：不写 loginlog，避免导入快照被任何 DB 写入污染（管理员仍可仅 session 登录查看）
        if (isset($this->contest['flg_archive']) && intval($this->contest['flg_archive']) !== 0) {
            return;
        }
        $ip = GetRealIp();
        $time = date("Y-m-d H:i:s");
        db('loginlog')->insert(
            [
                'user_id'=>'#cpc' . $this->contest['contest_id'] . '_' . $team_id,
                //暂时用password字段作是否登录成功标记用。因为password计算依赖原密码salt，这里存储没有意义
                'password' => '',
                'ip' => $ip,
                'time'=> $time,
                'success'=> $success,
            ]);
    }
    
    /**
     * 比赛内登录后的重定向 URL
     *
     * 仅用于 contest_auth_ajax / contest_auth_passwordless_ajax 成功后的返回字段 redirect_url，
     * 由前端据此做一次跳转，不会在服务端形成循环重定向。
     *
     * 重要：只按「当前登录的比赛账号」身份（cpc_team.privilege / GetSession('privilege')）决定跳转，
     * 不使用 IsContestAdmin()，避免系统大管理员登录选手账号时被误判为职能账号而跳错页。
     *
     * 跳转规则（按优先级）：
     *
     *  | 优先级 | 身份说明（仅看比赛内 privilege） | 跳转目标        | 说明
     *  |--------|----------------------------------|-----------------|------------------------------------------
     *  | 1      | 气球管理员 / 气球配送员          | balloon_queue   | 无论未开始/进行中/已结束，均进职能页
     *  | 2      | 打印管理员                      | print_status    | 同上
     *  | 3      | 未开始(-1) 的其余人             | contest 首页    | 选手、监考等统一在首页等待
     *  | 4      | 已结束(2) 的其余人              | rank 榜单       | 统一看结果
     *  | 5      | 进行中(1) 比赛管理员/监考/直播员  | rank            | 监考看榜
     *  | 6      | 进行中(1) 选手                  | problemset      | 做题
     *
     * @return string 重定向 URL，带 cid 参数
     */
    protected function getContestLoginRedirectUrl()
    {
        $cid = $this->contest['contest_id'];
        $base = "/" . $this->module . "/contest/";

        // 仅按比赛内账号身份判断，不掺入系统管理员权限（避免大管理员登录选手账号被当成职能账号）
        $contestPriv = $this->GetSession('privilege');
        if ($contestPriv === 'balloon_manager' || $contestPriv === 'balloon_sender') {
            return $base . "balloon_queue?cid=" . $cid;
        }
        if ($contestPriv === 'printer') {
            return $base . "print_status?cid=" . $cid;
        }

        // 未开始：其余人（选手、监考等）统一到比赛首页
        if ($this->contestStatus == -1) {
            return $base . "contest?cid=" . $cid;
        }
        // 已结束：其余人统一到榜单
        if ($this->contestStatus == 2) {
            return $base . "rank?cid=" . $cid;
        }

        // 进行中：比赛管理员/监考/直播员 → rank，选手（privilege 为空等）→ problemset
        if ($contestPriv === 'admin' || $contestPriv === 'watcher') {
            return $base . "rank?cid=" . $cid;
        }
        return $base . "problemset?cid=" . $cid;
    }
    public function contest_logout_ajax()
    {
        if(!$this->GetSession('?')){
            $this->error('User already logged out.');
        }
        session($this->teamSessionName, null);
        $this->success('Logout Contest ' . $this->contest['contest_id'] . ' Successful!<br/>Reloading data.');
    }
    public function contest_auth_ajax(){
        // 比赛账号（非OJ账号）登录验证
        if($this->GetSession('?')){
            $this->error('Already logged in. Try refreshing the page.');
        }
        $team_id = trim(input('team_id/s'));
        $password = trim(input('password/s'));
        if($team_id == null || strlen($team_id) == 0) {
            $this->error('Query Data Invalid!');
        }
        $Team = db('cpc_team');
        $map = array(
            'contest_id' => $this->contest['contest_id'],
            'team_id' => $team_id,
        );
        $teamInfo = $Team->where($map)->find();
        // 如果比赛已结束，则不允许选手账号再登录
        if($this->contestStatus == 2 && ($teamInfo == null || $teamInfo['privilege'] == null || strlen(trim($teamInfo['privilege'])) == 0)) {
            $this->error('比赛结束 / Ended!');
        }
        if($teamInfo == null) {
            $this->error('No such team');
        }
        if(CkPasswd($password, $teamInfo['password'], True))
        {
            $this->contest_login_oper($teamInfo);
            $data['team_id'] = $teamInfo['team_id'];
            $data['name'] = $teamInfo['name'];
            $this->contest_loginlog($teamInfo['team_id'], 1);
        }
        else
        {
            $this->contest_loginlog($teamInfo['team_id'], 0);
            $this->error('Password Error!');
        }
        $this->success('ok', null, ['redirect_url' => $this->getContestLoginRedirectUrl()]);
    }
    
    /**
     * 免密登录接口（通过IP查询team_id_bind）
     */
    public function contest_auth_passwordless_ajax() {
        // 比赛账号免密登录验证（通过IP）
        if($this->GetSession('?')){
            $this->error('Already logged in. Try refreshing the page.');
        }
        
        $ip = GetRealIp();
        if (empty($ip)) {
            $this->error('无法获取IP地址 / Unable to get IP address');
        }
        
        // 查询该IP对应的client
        $client = db('cpc_client')->where([
            'contest_id' => $this->contest['contest_id'],
            'ip_bind' => $ip
        ])->find();
        
        if (!$client || empty($client['team_id_bind'])) {
            $this->error('该IP未绑定队伍，请联系管理员 / This IP is not bound to a team, please contact administrator');
        }
        
        $team_id = $client['team_id_bind'];
        
        // 查询team是否存在
        $Team = db('cpc_team');
        $map = array(
            'contest_id' => $this->contest['contest_id'],
            'team_id' => $team_id,
        );
        $teamInfo = $Team->where($map)->find();
        
        if($teamInfo == null) {
            $this->error('队伍不存在，请联系管理员 / Team not found, please contact administrator');
        }
        
        // 如果比赛已结束，则不允许选手账号再登录
        if($this->contestStatus == 2 && ($teamInfo['privilege'] == null || strlen(trim($teamInfo['privilege'])) == 0)) {
            $this->error('比赛结束 / Ended!');
        }
        
        // 执行登录
        $this->contest_login_oper($teamInfo);
        $this->contest_loginlog($teamInfo['team_id'], 1);
        
        $this->success('ok', null, ['redirect_url' => $this->getContestLoginRedirectUrl()]);
    }
    
    /**
     * 收集账号接口
     */
    public function contest_collect_team_ajax() {
        // 判断是否是收集模式
        $contest = db('contest')->where('contest_id', input('cid/d'))->find();
        $addition = [];
        if (!empty($contest['addition'])) {
            $addition = Json2Array($contest['addition']);
            if (!$addition || !is_array($addition)) {
                $addition = [];
            }
        }
        
        $flg_collect_team_id = isset($addition['flg_collect_team_id']) ? intval($addition['flg_collect_team_id']) : 0;
        if ($flg_collect_team_id != 1) {
            $this->error('当前不是收集模式 / Not in collect mode');
        }
        if (intval($contest['flg_archive'] ?? 0) !== 0) {
            $this->errorBilingual(
                '比赛已归档，禁止此操作',
                'Contest is archived; this operation is disabled.',
                null,
                ['contest_write_blocked' => 'archived']
            );
        }

        // 判断是否在比赛前10分钟
        $now = time();
        $startTime = strtotime($contest['start_time']);
        $timeDiff = $startTime - $now;
        if ($timeDiff < 600) { // 600秒 = 10分钟
            $this->error('收集模式已自动关闭（比赛前10分钟） / Collect mode automatically disabled (10 minutes before contest)');
        }
        
        $team_id = trim(input('team_id/s'));
        if (empty($team_id)) {
            $this->error('队伍ID不能为空 / Team ID cannot be empty');
        }
        
        // 验证team_id合法性（参考teamgen的验证逻辑）
        $validate = new Validate(config('CpcSysConfig.teaminfo_rule'), config('CpcSysConfig.teaminfo_msg'));
        $teamData = [
            'team_id' => $team_id,
            'contest_id' => $contest['contest_id']
        ];
        
        if (!$validate->check($teamData)) {
            $this->error('队伍ID格式不正确：' . $validate->getError() . ' / Invalid Team ID format: ' . $validate->getError());
        }
        
        // 验证team_id是否存在
        $teamInfo = db('cpc_team')->where([
            'contest_id' => $contest['contest_id'],
            'team_id' => $team_id
        ])->find();
                
        $ip = GetRealIp();
        if (empty($ip)) {
            $this->error('无法获取IP地址 / Unable to get IP address');
        }
        
        // 查询该IP是否已有client记录
        $client = db('cpc_client')->where([
            'contest_id' => $contest['contest_id'],
            'ip_bind' => $ip
        ])->find();
        
        if ($client) {
            // 更新现有的client记录
            db('cpc_client')->where('client_id', $client['client_id'])->update([
                'team_id_bind' => $team_id
            ]);
        } else {
            // 新建client记录
            db('cpc_client')->insert([
                'contest_id' => $contest['contest_id'],
                'team_id_bind' => $team_id,
                'ip_bind' => $ip,
                'ssh_config' => null
            ]);
        }
        $rep_data = [
            'team_id' => $team_id,
            'ip' => $ip
        ];
        if (!$teamInfo) {
            $rep_data['team_warning_cn'] = '队伍 ' . $team_id . ' 尚未录入比赛，但仍然已完成绑定，如不是预期行为，请在客户端管理处处理';
            $rep_data['team_warning_en'] = 'Team ' . $team_id . ' has not been entered into the contest, but has already been bound. If this is not the expected behavior, please handle it in the client management';
        }
        $this->success('账号收集成功 / Account collected successfully', null, $rep_data);
    }
    
    /**
     * 比赛首页
     * client_ip / team_id_bind 已由 ContestInitCpcExtra() 写入视图，勿重复查 cpc_client。
     */
    public function contest() {
        return $this->fetch();
    }
    
    // SolutionUser(), RankUserList(), UserInfoUrl() 方法已通过 ContestBaseTrait 提供
	public function teaminfo()
	{
        // 用户信息页
        $team_id = trim(input('team_id'));
        if($team_id == null || strlen($team_id) == 0)
            $team_id = $this->GetSession('team_id');
        if($team_id == null || strlen($team_id) == 0) {
            $this->error('You find a 404 ^_^');
        }
		$teaminfo = db('cpc_team')->where(['contest_id' => $this->contest['contest_id'], 'team_id' => $team_id])->find();
		if($teaminfo == null)
			$this->error('No such team.');

        // 模板展示所需映射数据在控制器层组装，避免在模板中使用原生 PHP（TP5.1 推荐做法）
        $teamTypes = config('CpcSysConfig.TEAM_TYPE_LABEL');
        if(!is_array($teamTypes) || empty($teamTypes)) {
            $teamTypes = [0 => ['cn' => '正式队伍', 'en' => 'Regular Team']];
        }
        $privilegeTypes = config('CpcSysConfig.TEAM_PRIVILEGE_LABEL');
        if(!is_array($privilegeTypes)) {
            $privilegeTypes = [];
        }
        $tkind = intval($teaminfo['tkind'] ?? 0);
        $priv = strval($teaminfo['privilege'] ?? '');
        $currentType = $teamTypes[$tkind] ?? $teamTypes[0];
        $currentPrivilege = $privilegeTypes[$priv] ?? ['cn' => '未知', 'en' => 'Unknown'];

        // 多赛事归属（group）信息：仅在有效 group 数 > 1 时展示
        $meta = (isset($this->contestMeta) && is_array($this->contestMeta))
            ? $this->contestMeta
            : $this->GetContestMeta(intval($this->contest['contest_id']), true);
        $groupList = is_array($meta['contest_group'] ?? null) ? $meta['contest_group'] : [];
        $isMultiGroup = count($groupList) > 1;
        $teamGroups = [];
        if ($isMultiGroup) {
            $groupMap = [];
            foreach ($groupList as $g) {
                $gid = strval($g['group_id'] ?? '');
                if ($gid === '') {
                    continue;
                }
                $groupMap[$gid] = [
                    'group_id' => $gid,
                    'group_name' => strval($g['group_name'] ?? $gid),
                    'group_name_en' => strval($g['group_name_en'] ?? ''),
                ];
            }
            $rows = db('cpc_team_group')
                ->where([
                    'contest_id' => intval($this->contest['contest_id']),
                    'team_id' => $team_id,
                ])
                ->field(['group_id'])
                ->select();
            $teamGroupIds = [];
            foreach ($rows as $r) {
                $gid = strval($r['group_id'] ?? '');
                if ($gid !== '') {
                    $teamGroupIds[] = $gid;
                }
            }
            $teamGroupIds = array_values(array_unique($teamGroupIds));
            // 兼容默认归属：无显式映射时归入第一组
            if (count($teamGroupIds) === 0 && count($groupList) > 0) {
                $defaultGid = strval($groupList[0]['group_id'] ?? '');
                if ($defaultGid !== '') {
                    $teamGroupIds[] = $defaultGid;
                }
            }
            foreach ($teamGroupIds as $gid) {
                if (isset($groupMap[$gid])) {
                    $teamGroups[] = $groupMap[$gid];
                } else {
                    $teamGroups[] = [
                        'group_id' => $gid,
                        'group_name' => $gid,
                        'group_name_en' => '',
                    ];
                }
            }
        }

		$this->assign([
            'teaminfo' => $teaminfo,
            'currentType' => $currentType,
            'currentPrivilege' => $currentPrivilege,
            'isMultiGroup' => $isMultiGroup ? 1 : 0,
            'teamGroups' => $teamGroups,
        ]);
		return $this->fetch();
	}
    /**************************************************/
    //Printcode
    /**************************************************/
    public function PrintCodeAuth($watch_status=false)
    {
        if($this->contestStatus == -1 && !$this->IsContestAdmin('printer'))
            $this->error('Not started.');
        if($this->contestStatus == 2 && !$this->IsContestAdmin('printer') && !$watch_status)
            $this->error('Contest Ended.', null, '', 1);
        if(!$this->contest_user && !$this->IsContestAdmin('printer'))
            $this->error('Please login before print code', '/', '', 1);
    }

    protected function getContestGroupContext()
    {
        $meta = (isset($this->contestMeta) && is_array($this->contestMeta))
            ? $this->contestMeta
            : $this->GetContestMeta(intval($this->contest['contest_id']), true);
        $groups = is_array($meta['contest_group'] ?? null) ? $meta['contest_group'] : [];
        $groupMap = [];
        $defaultGroupId = '';
        foreach ($groups as $g) {
            $gid = strval($g['group_id'] ?? '');
            if ($gid === '') {
                continue;
            }
            if ($defaultGroupId === '') {
                $defaultGroupId = $gid;
            }
            $groupMap[$gid] = $g;
        }
        return [
            'groups' => array_values($groupMap),
            'group_map' => $groupMap,
            'group_count' => count($groupMap),
            'is_multi_group' => count($groupMap) > 1,
            'default_group_id' => $defaultGroupId,
        ];
    }

    protected function resolveGroupIdsInContext($ids, $ctx)
    {
        $groupList = is_array($ctx['groups'] ?? null) ? $ctx['groups'] : [];
        $canonicalMap = ContestGroupId::buildCanonicalMap($groupList);
        return ContestGroupId::normalizeList(is_array($ids) ? $ids : [], $canonicalMap);
    }

    protected function getCurrentStaffGroupLock($privileges)
    {
        $ctx = $this->getContestGroupContext();
        if (!$ctx['is_multi_group'] || !$this->GetSession('?')) {
            return [];
        }
        $privilege = strval($this->GetSession('privilege'));
        if (!in_array($privilege, $privileges, true)) {
            return [];
        }
        $teamId = strval($this->GetSession('team_id'));
        if ($teamId === '') {
            return [];
        }
        $rows = db('cpc_team_group')
            ->where([
                'contest_id' => intval($this->contest['contest_id']),
                'team_id' => $teamId,
            ])
            ->field(['group_id'])
            ->select();
        $ret = [];
        $canonicalMap = ContestGroupId::buildCanonicalMap(is_array($ctx['groups'] ?? null) ? $ctx['groups'] : []);
        foreach ($rows as $row) {
            $gid = ContestGroupId::resolveCanonical(strval($row['group_id'] ?? ''), $canonicalMap);
            if ($gid !== '' && isset($ctx['group_map'][$gid])) {
                $ret[$gid] = 1;
            }
        }
        return array_keys($ret);
    }

    protected function normalizeRequestedGroupFilter($raw)
    {
        if (is_array($raw)) {
            $items = $raw;
        } else {
            $items = explode(',', strval($raw));
        }
        $ret = [];
        foreach ($items as $gid) {
            $gid = trim(strval($gid));
            if ($gid === '') {
                continue;
            }
            $ret[$gid] = 1;
        }
        return array_keys($ret);
    }

    protected function getEffectiveGroupFilterIds($staffPrivileges)
    {
        $ctx = $this->getContestGroupContext();
        if (!$ctx['is_multi_group']) {
            return [];
        }
        $staffLock = $this->getCurrentStaffGroupLock($staffPrivileges);
        if (count($staffLock) > 0) {
            return $staffLock;
        }
        $raw = input('group_ids/a', null);
        if ($raw === null) {
            $raw = input('group_id/s', input('groups/s', ''));
        }
        $requested = $this->normalizeRequestedGroupFilter($raw);
        return $this->resolveGroupIdsInContext($requested, $ctx);
    }

    protected function getTeamGroupMapCached($contestId, $ttl = 5)
    {
        $contestId = intval($contestId);
        $cacheKey = 'cpc_team_group_map_v1:' . $contestId;
        $cached = cache($cacheKey, '', $ttl);
        if (is_array($cached)) {
            return $cached;
        }
        $rows = db('cpc_team_group')
            ->where('contest_id', $contestId)
            ->field(['team_id', 'group_id'])
            ->select();
        $map = [];
        $ctx = $this->getContestGroupContext();
        $canonicalMap = ContestGroupId::buildCanonicalMap(is_array($ctx['groups'] ?? null) ? $ctx['groups'] : []);
        foreach ($rows as $row) {
            $tid = strval($row['team_id'] ?? '');
            $gid = ContestGroupId::resolveCanonical(strval($row['group_id'] ?? ''), $canonicalMap);
            if ($tid === '' || $gid === '') {
                continue;
            }
            if (!isset($map[$tid])) {
                $map[$tid] = [];
            }
            $map[$tid][ContestGroupId::key($gid)] = $gid;
        }
        foreach ($map as $tid => $gidSet) {
            $map[$tid] = array_values($gidSet);
        }
        cache($cacheKey, $map, $ttl);
        return $map;
    }

    protected function resolveTeamGroupIds($teamId, $teamGroupMap, $ctx)
    {
        $teamId = strval($teamId);
        $groups = isset($teamGroupMap[$teamId]) ? $teamGroupMap[$teamId] : [];
        if (count($groups) === 0 && $ctx['is_multi_group'] && $ctx['default_group_id'] !== '') {
            $groups = [$ctx['default_group_id']];
        }
        return array_values(array_unique($groups));
    }

    protected function teamMatchesGroupFilter($teamId, $groupIds, $teamGroupMap = null, $ctx = null)
    {
        if (!is_array($groupIds) || count($groupIds) === 0) {
            return true;
        }
        if ($ctx === null) {
            $ctx = $this->getContestGroupContext();
        }
        if (!$ctx['is_multi_group']) {
            return true;
        }
        if ($teamGroupMap === null) {
            $teamGroupMap = $this->getTeamGroupMapCached(intval($this->contest['contest_id']));
        }
        $teamGroups = $this->resolveTeamGroupIds($teamId, $teamGroupMap, $ctx);
        return ContestGroupId::listsOverlap($teamGroups, $groupIds);
    }

    protected function getTeamIdsByGroupFilter($groupIds, $onlyContestTeams = true)
    {
        $ctx = $this->getContestGroupContext();
        if (!$ctx['is_multi_group'] || !is_array($groupIds) || count($groupIds) === 0) {
            return null;
        }
        $contestId = intval($this->contest['contest_id']);
        $teamRows = db('cpc_team')
            ->where('contest_id', $contestId)
            ->where(function($query) use ($onlyContestTeams) {
                if ($onlyContestTeams) {
                    $query->whereNull('privilege')->whereOr('privilege', '');
                }
            })
            ->cache('cpc_team_ids_for_group_filter:' . $contestId . ':' . ($onlyContestTeams ? 'team' : 'all'), 5)
            ->field(['team_id'])
            ->select();
        $teamGroupMap = $this->getTeamGroupMapCached($contestId, 5);
        $ret = [];
        foreach ($teamRows as $row) {
            $teamId = strval($row['team_id'] ?? '');
            if ($teamId !== '' && $this->teamMatchesGroupFilter($teamId, $groupIds, $teamGroupMap, $ctx)) {
                $ret[] = $teamId;
            }
        }
        return $ret;
    }

    protected function filterContestDataByGroupIds($contestData, $groupIds)
    {
        $ctx = $this->getContestGroupContext();
        if (!$ctx['is_multi_group'] || !is_array($groupIds) || count($groupIds) === 0) {
            return $contestData;
        }
        $allowedTeamIds = $this->getTeamIdsByGroupFilter($groupIds, true);
        if ($allowedTeamIds === null) {
            return $contestData;
        }
        $allowed = array_fill_keys($allowedTeamIds, 1);
        if (isset($contestData['team']) && is_array($contestData['team'])) {
            $contestData['team'] = array_values(array_filter($contestData['team'], function($team) use ($allowed) {
                $teamId = is_array($team) ? strval($team[1] ?? '') : '';
                return $teamId !== '' && isset($allowed[$teamId]);
            }));
        }
        if (isset($contestData['solution']) && is_array($contestData['solution'])) {
            $contestData['solution'] = array_values(array_filter($contestData['solution'], function($solution) use ($allowed) {
                $teamId = is_array($solution) ? $this->SolutionUser(strval($solution[3] ?? ''), false) : '';
                return $teamId !== '' && isset($allowed[$teamId]);
            }));
        }
        if (isset($contestData['contest_balloon']) && is_array($contestData['contest_balloon'])) {
            $contestData['contest_balloon'] = array_values(array_filter($contestData['contest_balloon'], function($balloon) use ($allowed) {
                $teamId = is_array($balloon) ? strval($balloon[2] ?? '') : '';
                return $teamId !== '' && isset($allowed[$teamId]);
            }));
        }
        return $contestData;
    }

    /**
     * 解析房间/区域字段为去重后的 token 列表（与前端逗号/中文逗号分隔一致）。
     * @param string $roomRaw
     * @return string[]
     */
    protected function parseContestRoomTokens($roomRaw)
    {
        $roomRaw = trim(strval($roomRaw));
        if ($roomRaw === '') {
            return [];
        }
        $parts = preg_split('/[,，]+/u', $roomRaw);
        $ret = [];
        foreach ($parts as $p) {
            $t = trim(strval($p));
            if ($t !== '') {
                $ret[$t] = 1;
            }
        }
        return array_keys($ret);
    }

    /**
     * 当前登录职能账号在 cpc_team.room 上配置的分区 token（printer / balloon_manager / balloon_sender）。
     * 未配置或 privilege 不在列表内时返回空数组（表示不锁定）。
     * @param string[] $privileges
     * @return string[]
     */
    protected function getCurrentStaffRoomLockTokens($privileges)
    {
        $privilege = strval($this->GetSession('privilege'));
        if (!in_array($privilege, $privileges, true)) {
            return [];
        }
        $teamId = strval($this->GetSession('team_id'));
        if ($teamId === '') {
            return [];
        }
        $row = db('cpc_team')
            ->where([
                'contest_id' => intval($this->contest['contest_id']),
                'team_id' => $teamId,
            ])
            ->field(['room'])
            ->find();
        return $this->parseContestRoomTokens($row['room'] ?? '');
    }

    /**
     * room 字段（可含中英文逗号多值）与允许 token 列表是否有交集。
     * @param string $roomRaw
     * @param string[] $allowedTokens
     */
    protected function contestRoomFieldMatchesAllowedTokens($roomRaw, $allowedTokens)
    {
        if (!is_array($allowedTokens) || count($allowedTokens) === 0) {
            return true;
        }
        $fieldTokens = $this->parseContestRoomTokens($roomRaw);
        if (count($fieldTokens) === 0) {
            return false;
        }
        return count(array_intersect($fieldTokens, $allowedTokens)) > 0;
    }

    /**
     * 打印列表分区：printer 账号已配置 room 时仅用锁定 token；否则用请求 / cookie（须显式传入）。
     * @return string[]
     */
    protected function getEffectivePrintRoomFilterTokens()
    {
        $staffLock = $this->getCurrentStaffRoomLockTokens(['printer']);
        if (count($staffLock) > 0) {
            return $staffLock;
        }
        $roomIds = trim(input('room_ids/s'));
        if ($roomIds === '') {
            $roomIds = trim(strval(cookie('room_ids_c' . $this->contest['contest_id'])));
        }
        return $this->parseContestRoomTokens($roomIds);
    }

    /**
     * SQL：字段值（可含逗号多分区）与 token 列表存在交集（与前端 parseCommaRoomTokens 语义一致）。
     * @param \think\db\Query $query
     * @param string $field
     * @param string[] $allowedTokens
     */
    protected function applyDbRoomTokenMatchFilter($query, $field, array $allowedTokens)
    {
        $allowedTokens = array_values(array_filter(array_map('strval', $allowedTokens), function ($t) {
            return trim($t) !== '';
        }));
        if (count($allowedTokens) === 0) {
            return $query;
        }
        $query->where(function ($q) use ($field, $allowedTokens) {
            foreach ($allowedTokens as $token) {
                $token = trim($token);
                $q->whereOr($field, $token);
                foreach ([',', '，'] as $sep) {
                    $q->whereOr($field, 'like', $token . $sep . '%');
                    $q->whereOr($field, 'like', '%' . $sep . $token);
                    $q->whereOr($field, 'like', '%' . $sep . $token . $sep . '%');
                }
            }
        });
        return $query;
    }

    /**
     * 赛队 room 是否与给定 token 列表有交集（赛队 room 可多值）。
     * @param string $teamId
     * @param string[] $allowedRooms
     */
    protected function teamMatchesBalloonRoomTokens($teamId, $allowedRooms)
    {
        if (!is_array($allowedRooms) || count($allowedRooms) === 0) {
            return true;
        }
        $teamId = strval($teamId);
        if ($teamId === '') {
            return false;
        }
        $row = db('cpc_team')
            ->where([
                'contest_id' => intval($this->contest['contest_id']),
                'team_id' => $teamId,
            ])
            ->field(['room'])
            ->find();
        return $this->contestRoomFieldMatchesAllowedTokens($row['room'] ?? '', $allowedRooms);
    }

    /**
     * 按房间 token 限制过滤 balloon_data 中的 team / solution / contest_balloon。
     * @param array $contestData
     * @param string[] $allowedRooms
     * @return array
     */
    protected function filterContestDataByBalloonRoomTokens($contestData, $allowedRooms)
    {
        if (!is_array($allowedRooms) || count($allowedRooms) === 0) {
            return $contestData;
        }
        $contestId = intval($this->contest['contest_id']);
        $teamRows = db('cpc_team')
            ->where('contest_id', $contestId)
            ->where(function($query) {
                $query->whereNull('privilege')->whereOr('privilege', '');
            })
            ->field(['team_id', 'room'])
            ->select();
        $allowed = [];
        foreach ($teamRows as $row) {
            $tid = strval($row['team_id'] ?? '');
            if ($tid === '') {
                continue;
            }
            if ($this->contestRoomFieldMatchesAllowedTokens($row['room'] ?? '', $allowedRooms)) {
                $allowed[$tid] = 1;
            }
        }
        if (isset($contestData['team']) && is_array($contestData['team'])) {
            $contestData['team'] = array_values(array_filter($contestData['team'], function($team) use ($allowed) {
                $teamId = is_array($team) ? strval($team[1] ?? '') : '';
                return $teamId !== '' && isset($allowed[$teamId]);
            }));
        }
        if (isset($contestData['solution']) && is_array($contestData['solution'])) {
            $contestData['solution'] = array_values(array_filter($contestData['solution'], function($solution) use ($allowed) {
                $teamId = is_array($solution) ? $this->SolutionUser(strval($solution[3] ?? ''), false) : '';
                return $teamId !== '' && isset($allowed[$teamId]);
            }));
        }
        if (isset($contestData['contest_balloon']) && is_array($contestData['contest_balloon'])) {
            $contestData['contest_balloon'] = array_values(array_filter($contestData['contest_balloon'], function($balloon) use ($allowed) {
                $teamId = is_array($balloon) ? strval($balloon[2] ?? '') : '';
                return $teamId !== '' && isset($allowed[$teamId]);
            }));
        }
        return $contestData;
    }

    public function print_code()
    {
        $this->PrintCodeAuth();
        $this->assign([
            'cid'         => $this->contest['contest_id'],
            'pagetitle' => 'Print Code',
            'team_id'    => $this->contest_user
        ]);
        return $this->fetch();
    }
    public function print_code_ajax()
    {
        $this->PrintCodeAuth();
        $this->assertContestNotArchivedForWrite();
        $source = trim(input('source'));
        $code_length = strlen($source);
        if($code_length < 6)
            $this->error('Code too short');
        else if($code_length > 16384)
            $this->error('Code too long');

        $teaminfo = db('cpc_team')->where(['team_id' => $this->contest_user, 'contest_id' => $this->contest['contest_id']])->field(['team_id', 'room'])->find();

        if(!$teaminfo)
            $this->error('No such team. Are you deleted by administrator?');
        db('contest_print')->insert([
            'contest_id'    => $this->contest['contest_id'],
            'team_id'       => $this->SolutionUser($teaminfo['team_id'], true),
            'source'        => $source,
            'in_date'       => date('Y-m-d H:i:s'),
            'ip'            => $this->request->ip(),
            'code_length'   => $code_length,
            'room'          => $teaminfo['room']
        ]);
        $this->success('Print request submitted', null, ['contest_id'=> $this->contest['contest_id'],'team_id'=> $this->contest_user, 'team_info' => $teaminfo]);
    }
    public function GetPrintCode($type='show')
    {
        $print_id = trim(input('print_id'));
        $printinfo = db('contest_print')->where('print_id', $print_id)->find();

        if(!$this->if_can_see_print($printinfo))
            $this->error('Permission denied to see this code.');

        if($type == 'show')
            $printinfo['source'] = htmlentities(str_replace("\r\n","\n",$printinfo['source']),ENT_QUOTES,"utf-8");
        $printinfo['auth'] =
            "\n/**********************************************************************".
            "\n\tContest: " . $this->contest['contest_id'] . '-' . $this->contest['title'].
            "\n\tTeam: " . $this->SolutionUser($printinfo['team_id'], false) . "\n".
            "**********************************************************************/\n";
        $printinfo['contest_title'] = $this->contest['title'];
        $printinfo['team_id'] = $this->SolutionUser($printinfo['team_id'], false);
        return $printinfo;
    }
    public function print_code_show_ajax()
    {
        //用于网页显示
        $printinfo = $this->GetPrintCode();
        $this->success('', null, $printinfo);
    }
    public function print_code_plain_content_ajax()
    {
        //用于打印
        $printinfo = $this->GetPrintCode('print');
        $this->success('', null, $printinfo);
    }
    public function if_can_see_print($printReq)
    {
        if(!isset($printReq['contest_id']) || $printReq['contest_id'] != $this->contest['contest_id'])
            return false;
        if($this->IsContestAdmin('printer')) {
            $groupLock = $this->getCurrentStaffGroupLock(['printer']);
            if (count($groupLock) > 0) {
                $teamId = $this->SolutionUser($printReq['team_id'], false);
                if (!$this->teamMatchesGroupFilter($teamId, $groupLock)) {
                    return false;
                }
            }
            $roomLock = $this->getCurrentStaffRoomLockTokens(['printer']);
            if (count($roomLock) > 0 && !$this->contestRoomFieldMatchesAllowedTokens($printReq['room'] ?? '', $roomLock)) {
                return false;
            }
            return true;
        }
        if(!$this->contest_user)
            return false;
        if($this->contest_user == $this->SolutionUser($printReq['team_id'], false))
            return true;
        return false;
    }

    public function GetPrintStatusShow($printReq)
    {
        $oj_print_status_html = config('CpcSysConfig.PRINT_STATUS_HTML');
        $ret = '';
        if(array_key_exists($printReq['print_status'], $oj_print_status_html))
        {
            $ret = $oj_print_status_html[$printReq['print_status']][1];
        }
        else
            $ret = 'Unknown';
        return $ret;
    }
    public function print_status() {
        $this->PrintCodeAuth(true);
        $groupContext = $this->getContestGroupContext();
        $printStaffGroupIds = $this->getCurrentStaffGroupLock(['printer']);
        $printStaffRoomLock = $this->getCurrentStaffRoomLockTokens(['printer']);
        $printStaffRoomLocked = count($printStaffRoomLock) > 0;
        $defaultRoomIds = cookie('room_ids_c' . $this->contest['contest_id']);
        if ($printStaffRoomLocked) {
            $defaultRoomIds = implode(',', $printStaffRoomLock);
        }
        // 专职 printer 比赛账号：整页静态加载 Lodop；与下方 manual 互斥，manual 侧不出现「按需加载」按钮。
        $lodopAutoload = $this->GetSession('?') && strval($this->GetSession('privilege')) === 'printer';
        $lodopManualEligible = !$lodopAutoload && (IsAdmin() || $this->IsContestAdmin('admin'));
        $tplRep = config('template.tpl_replace_string');
        $staticBase = (is_array($tplRep) && isset($tplRep['__STATIC__'])) ? $tplRep['__STATIC__'] : '/static';
        $this->assign([
            'cid'               => $this->contest['contest_id'],
            'pagetitle'         => 'Print Code Status',
            'search_team_id'    => input('team_id', ''),
            'team_id'           => $this->contest_user,
            'printStatus'       => config('CpcSysConfig.PRINT_STATUS'),
            'show_code_url'     => 'print_code_show_ajax',
            'room_ids'          => $defaultRoomIds,
            'contestGroupContext' => $groupContext,
            'printStaffGroupIds'  => $printStaffGroupIds,
            'printStaffGroupLocked' => count($printStaffGroupIds) > 0 ? 1 : 0,
            'printStaffRoomLock'    => $printStaffRoomLock,
            'printStaffRoomLocked'  => $printStaffRoomLocked ? 1 : 0,
            'lodop_autoload'          => $lodopAutoload,
            'lodop_manual_eligible'   => $lodopManualEligible,
            'lodop_funcs_js_url'      => $staticBase . '/lodop/LodopFuncs.js',
            'lodop_print_control_js_url' => $staticBase . '/csgoj/contest/print_control.js',
        ]);
        return $this->fetch();
    }
    public function print_status_ajax()
    {
        $this->PrintCodeAuth(true);
        $offset     = intval(input('offset'));
        $limit      = intval(input('limit'));
        $sort       = trim(input('sort'));
        $order      = input('order');
        $search     = trim(input('search/s'));
        $room_ids   = trim(input('room_ids/s'));
        $groupIds   = $this->getEffectiveGroupFilterIds(['printer']);
        $printStaffRoomLock = $this->getCurrentStaffRoomLockTokens(['printer']);
        $roomIdList = $this->getEffectivePrintRoomFilterTokens();

        //为了打开页面时即过滤room_ids，目前得在server端设置cookie，因为前端幺蛾子多
        // 职能 printer 已锁定分区时不写入 cookie，避免空请求清掉其他账号的筛选记忆
        if (count($printStaffRoomLock) === 0) {
            if ($room_ids === '') {
                cookie('room_ids_c' . $this->contest['contest_id'], null);
            } else {
                cookie('room_ids_c' . $this->contest['contest_id'], $room_ids);
            }
        }

        $team_id        = trim(input('team_id'));
        $print_status     = input('print_status');
        $map = [];

        if($team_id != null && strlen($team_id) > 0) {
            $map['cp.team_id'] = $this->SolutionUser($team_id, true);
        }
        // else if(!$this->IsContestAdmin('printer'))
        //     $map['team_id'] = $this->SolutionUser($this->contest_user, true);
        if($print_status != null && $print_status != -1) {
            $map['cp.print_status'] = $print_status;
        }
        $map['cp.contest_id'] = $this->contest['contest_id'];
        $ret = [];
        $ordertype = [];
        // 赛务默认：Waiting(0) 在前且 print_id 升序；已打印/已拒绝 print_id 降序（新近在前）
        $usePrintStatusIdealOrder = false;
        if (strlen($sort) > 0) {
            if($sort == 'print_status_show')
                $sort = 'print_status';
            $sortMap = [
                'print_id' => 'cp.print_id',
                'print_status' => 'cp.print_status',
                'code_length' => 'cp.code_length',
                'in_date' => 'cp.in_date',
                'team_id' => 'cp.team_id',
                'room' => 'cp.room',
                'school' => 't.school',
                'name' => 't.name',
            ];
            $sortField = isset($sortMap[$sort]) ? $sortMap[$sort] : 'cp.print_status';
            $order = strtolower($order) === 'desc' ? 'desc' : 'asc';
            if ($sort === 'print_status' && $order === 'asc') {
                $usePrintStatusIdealOrder = true;
            } else {
                $ordertype = [
                    $sortField => $order,
                ];
                // 如果按其他列排序，次键 print_id 升序（优先较早提交的 Waiting）
                if($sort != 'print_id')
                    $ordertype['cp.print_id'] = 'asc';
            }
        } else {
            $usePrintStatusIdealOrder = true;
        }
        $groupTeamIds = $this->getTeamIdsByGroupFilter($groupIds, true);
        $prefixedGroupTeamIds = null;
        if (is_array($groupTeamIds)) {
            $prefixedGroupTeamIds = [];
            foreach ($groupTeamIds as $gidTeamId) {
                $prefixedGroupTeamIds[] = $this->SolutionUser($gidTeamId, true);
            }
            if (count($prefixedGroupTeamIds) === 0) {
                $prefixedGroupTeamIds[] = '__NO_SUCH_TEAM__';
            }
        }
        $uidPrefix = '#cpc' . intval($this->contest['contest_id']) . '_';
        $printQuery = db('contest_print')
            ->alias('cp')
            ->join('cpc_team t', 't.contest_id = cp.contest_id AND cp.team_id = CONCAT("' . $uidPrefix . '", t.team_id)', 'left')
            ->where($map);
        $this->applyDbRoomTokenMatchFilter($printQuery, 'cp.room', $roomIdList);
        if (is_array($prefixedGroupTeamIds)) {
            $printQuery->where('cp.team_id', 'in', $prefixedGroupTeamIds);
        }
        $printQuery->field([
            'cp.*',
            't.team_id plain_team_id',
            't.school school',
            't.name name',
            't.tmember tmember',
            't.coach coach',
        ]);
        if ($usePrintStatusIdealOrder) {
            $printQuery->orderRaw('cp.print_status ASC, IF(cp.print_status = 0, cp.print_id, -cp.print_id) ASC');
        } else {
            $printQuery->order($ordertype);
        }
        $printList = $printQuery
            ->limit($offset, $limit)
            ->select();
        $teamGroupMap = $this->getTeamGroupMapCached(intval($this->contest['contest_id']), 5);
        $groupCtx = $this->getContestGroupContext();
        // 性能：把循环不变的鉴权/分组锁结果一次性求出来，避免每行重复调用
        // IsContestAdmin / getCurrentStaffGroupLock 中含 PrivSession + ORM cache(60) 文件 IO，
        // 在 N 行循环内反复调用会形成 N+1 级别的鉴权热点（实测 46 行 ~2s，主要在这里）
        $isAdminPriv = $this->IsContestAdmin('admin');
        $isPrinterPriv = $this->IsContestAdmin('printer');
        $canPrint = ($isAdminPriv || $isPrinterPriv);
        $printerGroupLock = $isPrinterPriv ? $this->getCurrentStaffGroupLock(['printer']) : [];
        $printerGroupLocked = count($printerGroupLock) > 0;
        $printerRoomLock = $isPrinterPriv ? $printStaffRoomLock : [];
        $printerRoomLocked = count($printerRoomLock) > 0;
        $contestIdCur = $this->contest['contest_id'];
        foreach($printList as &$printReq)
        {
            $printReq['team_id'] = $this->SolutionUser($printReq['team_id'], false);
            $printReq['group_ids'] = $this->resolveTeamGroupIds($printReq['team_id'], $teamGroupMap, $groupCtx);
            $printReq['groups'] = implode(',', $printReq['group_ids']);
            if($this->contest_user != $printReq['team_id'] && !$canPrint && $this->contestStatus != 2)
            {
                //不是该用户，不是管理员，且比赛没结束，不可以查看别人的code length
                $printReq['code_length'] = '-';
            }

            // 只返回数据，不返回HTML
            $printReq['print_status_show'] = $this->GetPrintStatusShow($printReq);
            $printReq['user_info_url'] = $this->UserInfoUrl($printReq['team_id'], $contestIdCur);
            $printReq['flg_can_print'] = $canPrint ? 1 : 0;
            $printReq['flg_can_deny'] = ($canPrint && $printReq['print_status'] == 0) ? 1 : 0;
            // if_can_see_print 等价内联（避免每行再次进入 IsContestAdmin/getCurrentStaffGroupLock）
            if (!isset($printReq['contest_id']) || $printReq['contest_id'] != $contestIdCur) {
                $canSee = false;
            } elseif ($isPrinterPriv) {
                $canSee = true;
                if ($printerGroupLocked && !$this->teamMatchesGroupFilter($printReq['team_id'], $printerGroupLock, $teamGroupMap, $groupCtx)) {
                    $canSee = false;
                }
                if ($canSee && $printerRoomLocked && !$this->contestRoomFieldMatchesAllowedTokens($printReq['room'] ?? '', $printerRoomLock)) {
                    $canSee = false;
                }
            } elseif (!$this->contest_user) {
                $canSee = false;
            } else {
                $canSee = ($this->contest_user == $printReq['team_id']);
            }
            $printReq['flg_showcode'] = $canSee ? 1 : 0;
        }
        unset($printReq);
        $countQuery = db('contest_print')->alias('cp')->where($map);
        $this->applyDbRoomTokenMatchFilter($countQuery, 'cp.room', $roomIdList);
        if (is_array($prefixedGroupTeamIds)) {
            $countQuery->where('cp.team_id', 'in', $prefixedGroupTeamIds);
        }
        $ret['total'] = $countQuery->count();
        $ret['order'] = $order;
        $ret['rows'] = $printList;
        return $ret;
    }
    public function print_deny_ajax()
    {
        $this->PrintCodeAuth();
        $this->assertContestNotArchivedForWrite();
        if(!$this->IsContestAdmin('printer') && !$this->IsContestAdmin('admin')) {
            $this->error("No permission to deny print task.");
        }
        $ContestPrint = db('contest_print');
        $print_id = trim(input('print_id'));
        $printinfo = $ContestPrint->where('print_id', $print_id)->find();
        if(!$printinfo)
            $this->error('No such print request, maybe you need refresh this page.');
        $groupLock = $this->getCurrentStaffGroupLock(['printer']);
        if (count($groupLock) > 0 && !$this->teamMatchesGroupFilter($this->SolutionUser($printinfo['team_id'], false), $groupLock)) {
            $this->error("No permission to deny print task in other group.");
        }
        $roomLock = $this->getCurrentStaffRoomLockTokens(['printer']);
        if (count($roomLock) > 0 && !$this->contestRoomFieldMatchesAllowedTokens($printinfo['room'] ?? '', $roomLock)) {
            $this->error("No permission to deny print task in other room/zone.");
        }
        $printinfo['print_status'] = 2;
        if(strtotime($printinfo['in_date']) < 0)
            $printinfo['in_date'] = date('Y-m-d H:i:s');
        $ContestPrint->update($printinfo);
        $this->success('Print request ' . $print_id . ' is denied');
    }
    public function print_do_ajax()
    {
        $this->PrintCodeAuth(true);
        $this->assertContestNotArchivedForWrite();
        if(!$this->IsContestAdmin('printer') && !$this->IsContestAdmin('admin')) {
            $this->error("No permission to do print task.");
        }
        $ContestPrint = db('contest_print');
        $print_id = trim(input('print_id'));
        $printinfo = $ContestPrint->where('print_id', $print_id)->find();
        if(!$printinfo)
            $this->error('No such print request, maybe you need refresh this page.');
        $groupLock = $this->IsContestAdmin('printer') ? $this->getCurrentStaffGroupLock(['printer']) : [];
        if (count($groupLock) > 0 && !$this->teamMatchesGroupFilter($this->SolutionUser($printinfo['team_id'], false), $groupLock)) {
            $this->error("No permission to print task in other group.");
        }
        $roomLock = $this->IsContestAdmin('printer') ? $this->getCurrentStaffRoomLockTokens(['printer']) : [];
        if (count($roomLock) > 0 && !$this->contestRoomFieldMatchesAllowedTokens($printinfo['room'] ?? '', $roomLock)) {
            $this->error("No permission to print task in other room/zone.");
        }
        if(strtotime($printinfo['in_date']) < 0)
            $printinfo['in_date'] = date('Y-m-d H:i:s');

        $printinfo['print_status'] = 1;
        $ContestPrint->update($printinfo);
        $this->success('Print request ' . $print_id . ' is started');
    }

    /**************************************************/
    //Balloon
    /**************************************************/
    protected function BalloonAuth() {
        if(!$this->balloonManager && !$this->balloonSender && !$this->isContestAdmin) {
            $this->error('Permission denied to manage balloon', '/', '', 1);
        }
    }
    public function balloon_manager() {
        $this->BalloonAuth();
        $balloonStaffRoomLock = $this->getCurrentStaffRoomLockTokens(['balloon_manager']);
        $this->assign([
            'contestGroupContext' => $this->getContestGroupContext(),
            'balloonStaffGroupIds' => $this->getCurrentStaffGroupLock(['balloon_manager']),
            'balloonStaffRoomLock' => $balloonStaffRoomLock,
        ]);
        return $this->fetch();
    }
    public function balloon_queue() {
        $this->BalloonAuth();
        // 获取当前用户信息（如果是balloonSender）
        if(($this->balloonSender || $this->balloonManager) && $this->contest_user) {
            $teaminfo = db('cpc_team')->where(['contest_id' => $this->contest['contest_id'], 'team_id' => $this->contest_user])->find();
            $this->assign('teaminfo', $teaminfo ? $teaminfo : null);
        }
        $this->assign([
            'contestGroupContext' => $this->getContestGroupContext(),
            'balloonStaffGroupIds' => $this->getCurrentStaffGroupLock(['balloon_manager', 'balloon_sender']),
            'balloonStaffRoomLock' => $this->getCurrentStaffRoomLockTokens(['balloon_manager', 'balloon_sender']),
        ]);
        return $this->fetch();
    }
    public function balloon_data_ajax() {
        $this->BalloonAuth();
        $groupIds = $this->getEffectiveGroupFilterIds(['balloon_manager', 'balloon_sender']);
        $contest_data = $this->GetContestData4Rank([
            'info_need' => null,    // 表示所有信息都需要
            'solution_result' => 4, // 只查询 AC 的题目
        ]);
        if (CcpcRules::enabled($this->contest)) {
            header('Cache-Control: private, no-store');
            $contest_data['ccpc_balloon_assignments'] = CcpcRules::balloonAssignments($contest_data, time(), (string)getenv('CCPC_HMAC_KEY'), CcpcRules::palette());
            $stopped = time() >= CcpcRules::freezeAt($this->contest);
            $contest_data['ccpc_balloon_stopped'] = $stopped;
            $contest_data['ccpc_freeze_at'] = CcpcRules::freezeAt($this->contest) * 1000;
            $contest_data['ccpc_server_time'] = time() * 1000;
            $allowed = $contest_data['ccpc_balloon_assignments'];
            $contest_data['solution'] = $stopped ? [] : array_values(array_filter($contest_data['solution'], function ($s) use ($allowed) { return isset($allowed[(string)$s[0]]); }));
        }
        $contest_data = $this->filterContestDataByGroupIds($contest_data, $groupIds);
        $roomTokens = $this->getCurrentStaffRoomLockTokens(['balloon_manager', 'balloon_sender']);
        $contest_data = $this->filterContestDataByBalloonRoomTokens($contest_data, $roomTokens);
        $this->success("ok", null, $contest_data);
    }
    public function balloon_change_status_ajax() {
        $this->BalloonAuth();
        $this->assertContestNotArchivedForWrite();
        // 将气球分配给 balloon sender
        $balloon_sender = trim(input('balloon_sender/s'));
        $contest_id = $this->contest['contest_id']; // 由 get 参数的 cid 提供，controller 会自动赋值
        $solution_id = trim(input('solution_id/d'));
        $balloon_sender = $this->SolutionUser($balloon_sender, false);
        $op = trim(input('op/s')); // set_sender / grab， 区分 管理员设置 和 配送员抢任务
        $pst = trim(input('pst/d'));
        $bst = trim(input('bst/d'));
        if($pst === null) {
            $this->error('首答状态不能为空\nFirst blood status cannot be empty.');
        }
        if(!in_array($pst, [0, 10, 20])) {
            $this->error('不存在的首答状态\nNo such first blood status.');
        }
        if($bst === null) {
            $this->error('气球状态不能为空\nBalloon status cannot be empty.');
        }
        if(!in_array($bst, [0, 10, 20, 30])) {
            $this->error('不存在的气球状态\nNo such balloon status.');
        }
        // 处理 solution 信息
        $solution = db('solution')->where(['solution_id' => $solution_id])->find();
        if(!$solution) {
            $this->error('不存在的提交\nNo such solution.');
        }
        if($solution['contest_id'] != $contest_id) {
            $this->error('提交不属于当前比赛\nSolution does not belong to current contest.');
        }
        if (CcpcRules::enabled($this->contest)) {
            if ((int)$bst !== 0 && time() >= CcpcRules::freezeAt($this->contest)) $this->error('CCPC 封榜后停止发放气球 / Balloon delivery stopped');
            $raw = $this->GetContestData4Rank(['info_need'=>['all']]);
            $assignments = CcpcRules::balloonAssignments($raw, time(), (string)getenv('CCPC_HMAC_KEY'), CcpcRules::palette());
            if (!isset($assignments[(string)$solution_id])) $this->error('Not the first eligible AC for this team and problem');
            $pst = $assignments[(string)$solution_id]['first_blood'] ? 20 : 0;
        }
        if($solution['result'] != 4 && $bst !== 0) { // 没AC且行为不是退回
            $this->error('提交不是 AC\nSolution is not AC.');
        }
        $team_id = $this->SolutionUser($solution['user_id'], false);
        $problem_id = $solution['problem_id'];
        $groupLock = $this->getCurrentStaffGroupLock(['balloon_manager', 'balloon_sender']);
        if (count($groupLock) > 0 && !$this->teamMatchesGroupFilter($team_id, $groupLock)) {
            $this->error('没有权限处理非本分组队伍的气球.\nNo permission to handle balloons outside your group.');
        }
        $roomLock = $this->getCurrentStaffRoomLockTokens(['balloon_manager', 'balloon_sender']);
        if (count($roomLock) > 0 && !$this->teamMatchesBalloonRoomTokens($team_id, $roomLock)) {
            $this->error('没有权限处理非本房间/区域队伍的气球.\nNo permission to handle balloons outside your room/area.');
        }

        if($op == 'grab') {
            if(!$this->balloonSender && !$this->balloonManager) {
                $this->error('没有权限抢任务\nNo permission to grab task.');
            }
            $balloon_sender = $this->SolutionUser($this->contest_user, false);
            $bst = 20; // grab 模式只能设为"已分配"
        } else if($op == 'set_sender') {
            // set_sender 模式：只有管理员将状态设为20时才是set_sender
            if(!$this->IsContestAdmin('balloon_manager')) {
                $this->error('没有权限设置配送员\nNo permission to set sender.');
            }
            if($bst != 20) {
                $this->error('set_sender 模式只能将状态设为20（已分配）\nset_sender mode can only set status to 20 (Assigned).');
            }
            if(!$balloon_sender) {
                $this->error('配送员不能为空\nBalloon sender cannot be empty.');
            }
        }
        $new_contest_balloon = [
            'contest_id' => $contest_id,
            'problem_id' => $problem_id,
            'team_id' => $team_id,
            'room' => '',
            'ac_time' => strtotime($solution['in_date']),
            'pst' => $pst,
            'bst' => $bst,
        ];
        if($balloon_sender) {
            // 确认 balloon_sender 身份合法性
            // 修复 ThinkPHP 5.1 IN 查询：将 IN 查询改为链式调用，避免数组格式解析错误
            $sender = db('cpc_team')
                ->where('contest_id', $contest_id)
                ->where('team_id', $balloon_sender)
                ->where('privilege', 'in', ['balloon_sender', 'balloon_manager'])
                ->find();
            if(!$sender) {
                $this->error($balloon_sender . ' 不是气球配送员\n"' . $balloon_sender . '" is not a balloon sender.');
            }
            $senderLock = [];
            $senderGroupRows = db('cpc_team_group')
                ->where([
                    'contest_id' => $contest_id,
                    'team_id' => $balloon_sender,
                ])
                ->field(['group_id'])
                ->select();
            $ctx = $this->getContestGroupContext();
            if ($ctx['is_multi_group']) {
                $canonicalMap = ContestGroupId::buildCanonicalMap(is_array($ctx['groups'] ?? null) ? $ctx['groups'] : []);
                foreach ($senderGroupRows as $senderGroupRow) {
                    $gid = ContestGroupId::resolveCanonical(strval($senderGroupRow['group_id'] ?? ''), $canonicalMap);
                    if ($gid !== '' && isset($ctx['group_map'][$gid])) {
                        $senderLock[$gid] = 1;
                    }
                }
            }
            $senderLock = array_keys($senderLock);
            if (count($senderLock) > 0 && !$this->teamMatchesGroupFilter($team_id, $senderLock, null, $ctx)) {
                $this->error('配送员不属于该队伍分组\nBalloon sender does not belong to this team group.');
            }
            $new_contest_balloon['balloon_sender'] = $balloon_sender;
        }
        if (CcpcRules::enabled($this->contest) && (int)$bst !== 0 && time() >= CcpcRules::freezeAt($this->contest)) $this->error('CCPC balloon delivery stopped');
        $contest_balloon = db('contest_balloon')->where(['contest_id' => $contest_id, 'problem_id' => $problem_id, 'team_id' => $team_id])->find();
        if($contest_balloon) {
            // 已存在的 balloon 记录
            if(!$this->IsContestAdmin('balloon_manager')) {
                // 非气球管理员情况
                if($contest_balloon['balloon_sender'] != $this->contest_user) {
                    $this->error('没有权限处理此气球.\nNo permission to handle this balloon.');
                }
                if($new_contest_balloon['bst'] == 10) {
                    $this->error('不能将气球状态设为“已通知”.\nCannot set balloon status to “Printed/Issued”.');
                }
            }
            db('contest_balloon')->where([
                    'contest_id' => $contest_balloon['contest_id'],
                    'problem_id' => $contest_balloon['problem_id'],
                    'team_id' => $contest_balloon['team_id']
                ])->update($new_contest_balloon);
        } else {
            db('contest_balloon')->insert($new_contest_balloon);
        }
        return $this->success('ok', null, $new_contest_balloon);
    }

    /**
     * ICPC CCS Contest API 说明与请求测试（前台比赛头「播」入口；原 admin/ccs_api_console）
     */
    public function ccs_api_console()
    {
        if (!$this->isContestAdmin) {
            $this->error('Permission denied', '/' . $this->module . '/contest/contest?cid=' . $this->contest['contest_id'], '', 1);
        }
        $this->assign('ccs_api_standard', (int)($this->contest['private'] % 10) === 2);
        return $this->fetch('admin/ccs_api_console');
    }

    /**
     * 参赛队伍卡片单页（队名 trim 后非空）
     */
    public function team_display()
    {
        $this->enforceContestAccessPolicy();
        $pack = $this->fetchCpcTeamCardViewData();
        $this->assign('cpc_team_card_rows', $pack['rows']);
        $this->assign('cpc_contest_multi_group', (int) $pack['is_multi_group']);
        return $this->fetch('contest/team_display');
    }

}
