<?php
namespace app\common\traits;

/**
 * Admin contest helpers (shared between admin/exadmin).
 * - Parse problems input (supports problems[], problems_csv, legacy problems CSV)
 * - Insert contest_problem rows with dedupe/validation and auto pscore if needed
 * - (Optional) handle balloon colors & users
 */
trait AdminContestTrait
{
    /**
     * Parse problems from request.
     * Priority: problems[] (array) > problems_csv (string) > problems (string)
     * @return array list of raw tokens like ["1000", "1001:20", ...]
     */
    protected function CsgContestParseProblemTokensFromRequest()
    {
        // 强制按数组读取（problems[] 最佳实践）
        $rawArr = input('problems/a', null);
        if (is_array($rawArr)) {
            $tokens = [];
            foreach ($rawArr as $v) {
                $v = trim((string)$v);
                if ($v !== '') $tokens[] = $v;
            }
            return $tokens;
        }

        // problems_csv (new frontend best-practice) or legacy problems CSV
        $csv = input('problems_csv/s', '');
        if ($csv === '') {
            $csv = input('problems/s', '');
        }
        $csv = trim((string)$csv);
        if ($csv === '') return [];

        // Allow commas (half/full-width), newlines, spaces
        return preg_split('/[,\x{FF0C}\s]+/u', $csv, -1, PREG_SPLIT_NO_EMPTY);
    }

    /**
     * Insert contest_problem rows for a contest.
     *
     * Options:
     * - with_balloon_colors: bool (default false). If true, requires balloon_colors count match.
     * - balloon_colors: array|null (optional). If null and with_balloon_colors=true, reads from request.
     * - include_title: bool (default = with_balloon_colors). When true, sets 'title' in contest_problem rows.
     *
     * @param int $contest_id
     * @param array $contest contest row data (needs 'private' or 'protected')
     * @param array $options
     * @return string message (duplicate/not-exists hints)
     */
    protected function contest_outeritem_add_problems($contest_id, $contest, $options = [])
    {
        $withBalloon = isset($options['with_balloon_colors']) ? (bool)$options['with_balloon_colors'] : false;
        $includeTitle = isset($options['include_title']) ? (bool)$options['include_title'] : $withBalloon;

        $problemList = $this->CsgContestParseProblemTokensFromRequest();
        $balloonColorList = [];
        if ($withBalloon) {
            if (isset($options['balloon_colors']) && is_array($options['balloon_colors'])) {
                $balloonColorList = array_values(array_filter($options['balloon_colors'], function ($c) { return trim((string)$c) !== ''; }));
            } else {
                $raw = trim((string)input('balloon_colors/s', ''));
                $balloonColorList = $raw === '' ? [] : array_values(array_filter(array_map('trim', explode(",", $raw)), function ($c) { return $c !== ''; }));
            }
            if (count($problemList) !== count($balloonColorList)) {
                $this->error("The number not match between balloon colors and problems");
            }
        }

        db('contest_problem')->where('contest_id', $contest_id)->delete();

        $contest_problem_add = [];
        $num = 0;
        $problemSelected = [];
        $infoDuplicate = '';
        $infoNovalid = '';
        $nonZeroPscore = 0;

        // 性能优化：先用 IN 查询一次性拿到“存在的题号集合”，避免循环内 N 次查询
        // 同时避免 TP5.1 Query 对象 where 条件累积问题
        $pidSetForQuery = [];
        foreach ($problemList as $p0) {
            $pinfo0 = explode(":", trim((string)$p0));
            $pid0 = intval($pinfo0[0]);
            if ($pid0 >= 1000) {
                $pidSetForQuery[$pid0] = true;
            }
        }
        $existingPidSet = [];
        $pidListForQuery = array_keys($pidSetForQuery);
        if (!empty($pidListForQuery)) {
            // ThinkPHP 5.1：IN 查询使用链式 where('field','in',$arr)
            $existingPids = db('problem')->where('problem_id', 'in', $pidListForQuery)->column('problem_id');
            if (is_array($existingPids) && !empty($existingPids)) {
                $existingPidSet = array_fill_keys(array_map('intval', $existingPids), true);
            }
        }

        foreach ($problemList as $p) {
            // $p can be "1000:20"
            $pinfoList = explode(":", trim($p));
            $pid = intval($pinfoList[0]);
            $pscore = 0;
            if (count($pinfoList) > 1) {
                $pscore = intval($pinfoList[1]);
            }

            if ($pid < 1000) {
                continue;
            }
            if (array_key_exists($pid, $problemSelected)) {
                $infoDuplicate = 'Some duplicated problems are removed';
                continue;
            }
            // 不存在题目：跳过（保持原行为）
            if (!isset($existingPidSet[$pid])) {
                $infoNovalid = 'Some problem not exists';
                continue;
            }
            $problemSelected[$pid] = true;
            if ($pscore > 0) $nonZeroPscore++;

            $row = [
                'problem_id' => $pid,
                'contest_id' => $contest_id,
                'num'        => $num,
                'pscore'     => $pscore,
            ];
            if ($includeTitle) {
                $row['title'] = $balloonColorList[$num] ?? '';
            }
            $contest_problem_add[] = $row;
            $num++;
        }

        $pnum = count($contest_problem_add);
        if ($pnum > 0) {
            // attach problem count: private's tens digit (e.g. 14 => 1)
            $privateVal = (int)($contest['private'] ?? ($contest['protected'] ?? 0));
            $attachProblem = intdiv($privateVal, 10);

            if ($nonZeroPscore == 0) {
                $mainProNum = $pnum - $attachProblem;
                if ($mainProNum > 0) {
                    $averScore = floor(100 / $mainProNum);
                    $ithMore = 100 - $averScore * ($mainProNum);
                    for ($i = $mainProNum - 1; $i >= 0; $i--) {
                        $contest_problem_add[$i]['pscore'] = $averScore + ($i < $ithMore);
                    }
                }
            }
            if (!db('contest_problem')->insertAll($contest_problem_add)) {
                $this->error('Contest problems insert failed.');
            }
        }

        $ret = '';
        if (strlen(trim($infoDuplicate)) > 0) $ret .= $infoDuplicate;
        if (strlen(trim($infoNovalid)) > 0) {
            if (strlen($ret) > 0) $ret .= '<br/>';
            $ret .= $infoNovalid;
        }
        return $ret;
    }

    /**
     * Parse contest users from request (textarea, one user_id per line).
     * @return array unique non-empty user ids
     */
    protected function CsgContestParseUsersFromRequest()
    {
        $contestUsers = trim((string)input('users'));
        if ($contestUsers === '') return [];
        $userList = explode("\n", $contestUsers);
        $userList = array_map('trim', $userList);
        $userList = array_filter($userList, function($v){ return $v !== ''; });
        return array_values(array_unique($userList));
    }

    /**
     * Replace contest users in privilege_item（参赛者 pvrole 为 ''）for given contest.
     * Admin-only usage; exadmin typically doesn't call this.
     * 使用钩子方法统一权限管理
     * @param int $contest_id
     * @return void
     */
    protected function contest_outeritem_add_users($contest_id)
    {
        $row = db('contest')->where('contest_id', $contest_id)->field('private')->find();
        if (!$row) {
            return;
        }
        // 仅「私有」赛（private % 10 == 1）使用参赛白名单；其它类型忽略 users，并清理参赛白名单（pvrole 为 '' 或历史 NULL）
        if (intval($row['private']) % 10 !== 1) {
            db('privilege_item')->where([
                'rightitem' => 'contest',
                'item_id' => $contest_id,
            ])->where(function ($q) {
                $q->whereNull('pvrole')->whereOr('pvrole', '');
            })->delete();
            return;
        }

        $userList = $this->CsgContestParseUsersFromRequest();
        if (count($userList) === 0) {
            return;
        }

        if (!$this->canAddContestUser($contest_id)) {
            $this->error('No permission to add contest users');
        }

        if (!$this->addContestUsersPrivilege($userList, $contest_id, null)) {
            $this->error('Contest users insert failed.');
        }
    }

    /**
     * 批量写入 privilege_item（参赛白名单；pvrole 存 ''，与基线表 NOT NULL 一致）
     */
    protected function addContestUsersPrivilege($userList, $contest_id, $pvrole = null)
    {
        if (empty($userList)) {
            return true;
        }
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
                'user_id' => $u,
                'rightitem' => 'contest',
                'item_id' => $contest_id,
                'pvrole' => $pvroleStored,
                'defunct' => '0',
            ];
        }

        return db('privilege_item')->insertAll($contest_user_add) !== false;
    }

    /**
     * 是否允许为本场写入参赛白名单（子类可重载）
     */
    protected function canAddContestUser($contest_id)
    {
        return true;
    }
}


