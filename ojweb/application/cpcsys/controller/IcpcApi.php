<?php
/**
 * ICPC CCS Contest API Controller
 *
 * Single controller implementing the CCS Contest API (2026-01) for Standard-mode contests.
 * Extends think\Controller directly to bypass Globalbasecontroller session/module logic.
 *
 * @see https://ccs-specs.icpc.io/2026-01/contest_api
 */
namespace app\cpcsys\controller;

use think\Controller;

class IcpcApi extends Controller
{
    protected function initialize()
    {
        parent::initialize();
        @session_write_close();

        require_once $this->app->getAppPath() . 'common/funcs/IcpcCcsHelper.php';
    }

    /**
     * Main dispatcher — parses the real path from REQUEST_URI and delegates.
     */
    public function dispatch()
    {
        icpc_handle_options();

        try {
            $segments = $this->parseApiPath();
            $segCount = count($segments);

            // /api  (0 segments after "api")
            if ($segCount === 0) {
                return $this->handleApiRoot();
            }

            // /api/contests
            if ($segCount === 1 && $segments[0] === 'contests') {
                return $this->handleContests();
            }

            // /api/contests/{cid}[/{endpoint}[/{sub_id}]]
            if ($segCount >= 2 && $segments[0] === 'contests') {
                $cid      = $segments[1];
                $endpoint = $segments[2] ?? null;
                $subId    = $segments[3] ?? null;

                $contestId = icpc_resolve_contest_id($cid);
                $contest   = icpc_get_standard_contest($contestId);
                if (!$contest) {
                    icpc_error_response(404, 'Contest not found or not a standard contest');
                }

                $auth = icpc_authenticate($contestId);
                // CCS raw submissions/event-feed expose the concealed problem mapping.
                if (\app\common\funcs\CcpcRules::enabled($contest) && !icpc_is_admin_auth($auth)) {
                    icpc_error_response(403, 'CCPC anonymous contests require referee credentials for the CCS API');
                }

                if ($segCount >= 5
                    && ($segments[2] ?? '') === 'submissions'
                    && ($segments[4] ?? '') === 'files'
                ) {
                    return $this->handleSubmissionFiles($contest, $auth, $segments[3]);
                }

                if ($endpoint === null) {
                    return $this->handleContest($contest, $auth);
                }

                switch ($endpoint) {
                    case 'access':          return $this->handleAccess($contest, $auth);
                    case 'state':           return $this->handleState($contest, $auth);
                    case 'judgement-types':  return $this->handleJudgementTypes($contest, $auth, $subId);
                    case 'languages':       return $this->handleLanguages($contest, $auth, $subId);
                    case 'problems':        return $this->handleProblems($contest, $auth, $subId);
                    case 'groups':          return $this->handleGroups($contest, $auth, $subId);
                    case 'organizations':   return $this->handleOrganizations($contest, $auth, $subId);
                    case 'teams':           return $this->handleTeams($contest, $auth, $subId);
                    case 'submissions':     return $this->handleSubmissions($contest, $auth, $subId);
                    case 'judgements':       return $this->handleJudgements($contest, $auth, $subId);
                    case 'runs':            return $this->handleRuns($contest, $auth, $subId);
                    case 'scoreboard':      return $this->handleScoreboard($contest, $auth);
                    case 'awards':          return $this->handleAwards($contest, $auth, $subId);
                    case 'event-feed':      return $this->handleEventFeed($contest, $auth);
                    case 'accounts':        return $this->handleAccounts($contest, $auth, $subId);
                    case 'account':         return $this->handleCurrentAccount($contest, $auth);
                    default:
                        icpc_error_response(404, 'Unknown endpoint: ' . $endpoint);
                }
            }

            icpc_error_response(404, 'Not found');
        } catch (\Exception $e) {
            icpc_error_response(500, 'Internal server error');
        }
    }

    /**
     * Parse the path segments after "/api/" from the actual REQUEST_URI.
     */
    private function parseApiPath()
    {
        $uri  = $_SERVER['REQUEST_URI'] ?? '';
        $path = parse_url($uri, PHP_URL_PATH);
        $path = rtrim($path, '/');

        $pos = strpos($path, '/api');
        if ($pos === false) return [];

        $apiPath = substr($path, $pos + 4);
        $apiPath = trim($apiPath, '/');
        if ($apiPath === '') return [];

        return explode('/', $apiPath);
    }

    // ================================================================
    //  /api  —  API Root
    // ================================================================

    protected function handleApiRoot()
    {
        icpc_require_get();
        icpc_json_response([
            'version'     => ICPC_CCS_VERSION,
            'version_url' => ICPC_CCS_VERSION_URL,
            'provider'    => [
                'name'    => ICPC_CCS_PROVIDER,
            ],
        ]);
    }

    // ================================================================
    //  /api/contests  —  Contest List
    // ================================================================

    protected function handleContests()
    {
        icpc_require_get();
        $contests = icpc_list_standard_contests();
        $result   = [];
        foreach ($contests as $c) {
            $result[] = icpc_serialize_contest($c);
        }
        icpc_json_response($result);
    }

    // ================================================================
    //  /api/contests/{cid}
    // ================================================================

    protected function handleContest($contest, $auth)
    {
        icpc_require_get();
        icpc_json_response(icpc_serialize_contest($contest));
    }

    // ================================================================
    //  /api/contests/{cid}/access
    // ================================================================

    protected function handleAccess($contest, $auth)
    {
        icpc_require_get();
        icpc_json_response(icpc_build_access($auth));
    }

    // ================================================================
    //  /api/contests/{cid}/state
    // ================================================================

    protected function handleState($contest, $auth)
    {
        icpc_require_get();
        icpc_json_response(icpc_serialize_state($contest));
    }

    // ================================================================
    //  /api/contests/{cid}/judgement-types[/{jtid}]
    // ================================================================

    protected function handleJudgementTypes($contest, $auth, $subId)
    {
        icpc_require_get();
        $all = icpc_all_judgement_types();

        if ($subId !== null && $subId !== '') {
            foreach ($all as $jt) {
                if ($jt['id'] === strtoupper($subId)) {
                    icpc_json_response($jt);
                }
            }
            icpc_error_response(404, 'Judgement type not found');
        }

        icpc_json_response($all);
    }

    // ================================================================
    //  /api/contests/{cid}/languages[/{lid}]
    // ================================================================

    protected function handleLanguages($contest, $auth, $subId)
    {
        icpc_require_get();
        $langs  = icpc_get_contest_languages($contest);
        $result = [];
        foreach ($langs as $num => $info) {
            $result[] = icpc_serialize_language($info);
        }

        if ($subId !== null && $subId !== '') {
            foreach ($result as $l) {
                if ($l['id'] === $subId) {
                    icpc_json_response($l);
                }
            }
            icpc_error_response(404, 'Language not found');
        }

        icpc_json_response($result);
    }

    // ================================================================
    //  /api/contests/{cid}/problems[/{pid}]
    // ================================================================

    protected function handleProblems($contest, $auth, $subId)
    {
        icpc_require_get();
        if (icpc_should_hide_problems_for_public($contest, $auth)) {
            icpc_json_response([]);
        }
        $rows   = icpc_fetch_contest_problems($contest['contest_id']);
        $result = [];
        foreach ($rows as $row) {
            $result[] = icpc_serialize_problem($row, $row, $contest);
        }

        if ($subId !== null && $subId !== '') {
            foreach ($result as $p) {
                if ($p['id'] === $subId) {
                    icpc_json_response($p);
                }
            }
            icpc_error_response(404, 'Problem not found');
        }

        icpc_json_response(icpc_apply_query_filters($result, ['id', 'label']));
    }

    // ================================================================
    //  /api/contests/{cid}/groups[/{gid}]
    // ================================================================

    protected function handleGroups($contest, $auth, $subId)
    {
        icpc_require_get();
        $teams   = icpc_fetch_contestant_teams($contest['contest_id']);
        $regions = [];
        foreach ($teams as $t) {
            $r = trim($t['region'] ?? '');
            if ($r !== '' && !isset($regions[$r])) {
                $regions[$r] = icpc_serialize_group($r);
            }
        }
        $result = array_values($regions);

        if ($subId !== null && $subId !== '') {
            foreach ($result as $g) {
                if ($g['id'] === $subId) icpc_json_response($g);
            }
            icpc_error_response(404, 'Group not found');
        }

        icpc_json_response($result);
    }

    // ================================================================
    //  /api/contests/{cid}/organizations[/{oid}]
    // ================================================================

    protected function handleOrganizations($contest, $auth, $subId)
    {
        icpc_require_get();
        $teams  = icpc_fetch_contestant_teams($contest['contest_id']);
        $orgs   = [];
        foreach ($teams as $t) {
            $s = trim($t['school'] ?? '');
            if ($s !== '' && !isset($orgs[$s])) {
                $orgs[$s] = icpc_serialize_organization($s);
            }
        }
        $result = array_values(array_filter($orgs));

        if ($subId !== null && $subId !== '') {
            foreach ($result as $o) {
                if ($o['id'] === $subId) icpc_json_response($o);
            }
            icpc_error_response(404, 'Organization not found');
        }

        icpc_json_response($result);
    }

    // ================================================================
    //  /api/contests/{cid}/teams[/{tid}]
    // ================================================================

    protected function handleTeams($contest, $auth, $subId)
    {
        icpc_require_get();
        $teams  = icpc_fetch_contestant_teams($contest['contest_id']);
        $result = [];
        foreach ($teams as $t) {
            $s = icpc_serialize_team($t);
            if ($s !== null) $result[] = $s;
        }

        if ($subId !== null && $subId !== '') {
            foreach ($result as $item) {
                if ($item['id'] === $subId) icpc_json_response($item);
            }
            icpc_error_response(404, 'Team not found');
        }

        icpc_json_response(icpc_apply_query_filters($result, ['id', 'organization_id']));
    }

    // ================================================================
    //  /api/contests/{cid}/submissions[/{sid}]
    // ================================================================

    protected function handleSubmissions($contest, $auth, $subId)
    {
        icpc_require_get();
        $result = icpc_list_submissions_serialized($contest, $auth);

        if ($subId !== null && $subId !== '') {
            foreach ($result as $s) {
                if ($s['id'] === $subId) {
                    icpc_json_response($s);
                }
            }
            icpc_error_response(404, 'Submission not found');
        }

        icpc_json_response(icpc_apply_query_filters($result, ['id', 'language_id', 'problem_id', 'team_id']));
    }

    // ================================================================
    //  /api/contests/{cid}/judgements[/{jid}]
    // ================================================================

    protected function handleJudgements($contest, $auth, $subId)
    {
        icpc_require_get();
        $result = icpc_list_judgements_serialized($contest, $auth);

        if ($subId !== null && $subId !== '') {
            foreach ($result as $j) {
                if ($j['id'] === $subId) {
                    icpc_json_response($j);
                }
            }
            icpc_error_response(404, 'Judgement not found');
        }

        icpc_json_response(icpc_apply_query_filters($result, ['id', 'submission_id', 'judgement_type_id']));
    }

    // ================================================================
    //  /api/contests/{cid}/runs[/{rid}]
    // ================================================================

    protected function handleRuns($contest, $auth, $subId)
    {
        icpc_require_get();
        $all = icpc_list_runs_serialized($contest, $auth);

        if ($subId !== null && $subId !== '') {
            foreach ($all as $r) {
                if ($r['id'] === $subId) {
                    icpc_json_response($r);
                }
            }
            icpc_error_response(404, 'Run not found');
        }

        icpc_json_response(icpc_apply_query_filters($all, ['id', 'judgement_id', 'judgement_type_id']));
    }

    // ================================================================
    //  /api/contests/{cid}/event-feed
    // ================================================================

    protected function handleEventFeed($contest, $auth)
    {
        icpc_require_get();
        icpc_stream_event_feed($contest, $auth);
    }

    // ================================================================
    //  /api/contests/{cid}/submissions/{id}/files
    // ================================================================

    protected function handleSubmissionFiles($contest, $auth, $subId)
    {
        icpc_require_get();
        if (!icpc_may_view_submission_files($auth)) {
            icpc_error_response(403, 'Submission files require staff or admin access');
        }

        $contestId = intval($contest['contest_id']);
        $sid       = icpc_resolve_submission_id($subId);
        if ($sid <= 0) {
            icpc_error_response(404, 'Submission not found');
        }

        $sol = db('solution')->where('contest_id', $contestId)->where('solution_id', $sid)->find();
        if (!$sol) {
            icpc_error_response(404, 'Submission not found');
        }

        $teamIds = array_column(icpc_fetch_contestant_teams($contestId), 'team_id');
        if (!empty($teamIds)) {
            $plainTeam = icpc_solution_user_id_to_cpc_team_id($sol['user_id']);
            if (!in_array($plainTeam, $teamIds, true)) {
                icpc_error_response(404, 'Submission not found');
            }
        }

        $src = db('source_code')->where('solution_id', $sid)->value('source');
        if ($src === null || $src === '') {
            icpc_error_response(404, 'Source not available');
        }

        $langNum = intval($sol['language'] ?? 0);
        $langMap = icpc_get_language_map();
        $info    = $langMap[$langNum] ?? ['id' => 'txt', 'extensions' => ['txt']];
        $langId  = $info['id'];
        $ext     = $info['extensions'][0] ?? $langId;

        if ($langId === 'cpp' || $langId === 'c') {
            $filename = ($langId === 'cpp') ? 'main.cpp' : 'main.c';
        } elseif ($langId === 'java') {
            $ep = icpc_guess_submission_entry_point($sol) ?: 'Main';
            $filename = $ep . '.java';
        } elseif ($langId === 'python3' || $langId === 'python') {
            $filename = 'main.py';
        } elseif ($langId === 'go') {
            $filename = 'main.go';
        } else {
            $filename = 'main.' . preg_replace('/[^a-zA-Z0-9]/', '', $ext);
        }

        $zipPath = sys_get_temp_dir() . '/ccs_sub_' . $sid . '_' . mt_rand() . '.zip';
        $zip     = new \ZipArchive();
        if ($zip->open($zipPath, \ZipArchive::CREATE | \ZipArchive::OVERWRITE) !== true) {
            icpc_error_response(500, 'Cannot create archive');
        }
        $zip->addFromString($filename, $src);
        $zip->close();

        http_response_code(200);
        header('Content-Type: application/zip');
        header('Content-Disposition: attachment; filename="files.zip"');
        header('Cache-Control: no-cache, must-revalidate');
        icpc_cors_headers();
        readfile($zipPath);
        @unlink($zipPath);
        exit;
    }

    // ================================================================
    //  /api/contests/{cid}/scoreboard
    // ================================================================

    protected function handleScoreboard($contest, $auth)
    {
        icpc_require_get();
        icpc_json_response(icpc_build_scoreboard($contest, $auth));
    }

    // ================================================================
    //  /api/contests/{cid}/awards[/{aid}]
    // ================================================================

    protected function handleAwards($contest, $auth, $subId)
    {
        icpc_require_get();
        $awards = icpc_build_awards($contest, $auth);

        if ($subId !== null && $subId !== '') {
            foreach ($awards as $a) {
                if ($a['id'] === $subId) icpc_json_response($a);
            }
            icpc_error_response(404, 'Award not found');
        }

        icpc_json_response($awards);
    }

    // ================================================================
    //  /api/contests/{cid}/accounts[/{aid}]
    // ================================================================

    protected function handleAccounts($contest, $auth, $subId)
    {
        icpc_require_get();
        if (!icpc_is_privileged($auth)) {
            icpc_error_response(403, 'Accounts endpoint requires staff or admin access');
        }

        $allTeams = icpc_fetch_teams($contest['contest_id']);
        $result   = [];
        foreach ($allTeams as $t) {
            $priv = trim($t['privilege'] ?? '');
            $type = icpc_privilege_to_ccs_type($priv);
            $acc  = [
                'id'       => icpc_team_ext_id($t['team_id']),
                'username' => $t['team_id'],
                'type'     => $type,
                'name'     => $t['name'] ?? $t['team_id'],
            ];
            if ($type === 'team') $acc['team_id'] = icpc_team_ext_id($t['team_id']);
            $result[] = $acc;
        }

        if ($subId !== null && $subId !== '') {
            foreach ($result as $a) {
                if ($a['id'] === $subId) icpc_json_response($a);
            }
            icpc_error_response(404, 'Account not found');
        }

        icpc_json_response(icpc_apply_query_filters($result, ['id', 'username', 'type', 'team_id']));
    }

    // ================================================================
    //  /api/contests/{cid}/account  (current user)
    // ================================================================

    protected function handleCurrentAccount($contest, $auth)
    {
        icpc_require_get();
        if ($auth['type'] === 'public') {
            icpc_error_response(401, 'Authentication required');
        }
        $acc = icpc_serialize_account($auth['team_info'], $auth);
        if ($acc === null) {
            icpc_error_response(404, 'Account not found');
        }
        icpc_json_response($acc);
    }
}
