<?php
/**
 * ICPC CCS Contest API Helper Functions
 *
 * Specification: https://ccs-specs.icpc.io/2026-01/contest_api
 *
 * Provides authentication, serialization, and utility functions
 * for the CCS standard API implementation on ThinkPHP 5.1.
 *
 * Loaded on-demand by IcpcApi controller (NOT in common.php).
 * Depends on common/funcs/{base,crypto,auth,privilege}.php being loaded.
 * All public functions prefixed with icpc_ to avoid collisions.
 */

// ================================================================
//  Constants
// ================================================================

define('ICPC_CCS_VERSION',     '2026-01');
define('ICPC_CCS_VERSION_URL', 'https://ccs-specs.icpc.io/2026-01/contest_api');
define('ICPC_CCS_PROVIDER',    'CSGOJ');

/**
 * CCS JSON 输出统一 flags：不转义 Unicode、不转义斜杠、非法 UTF-8 替换为 U+FFFD。
 * 避免题库/队名等字段含畸形字节时 json_encode 返回 false，进而破坏 NDJSON event-feed。
 */
function icpc_ccs_json_encode_flags()
{
    return JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_INVALID_UTF8_SUBSTITUTE;
}

/**
 * CCS Basic 鉴权链路上的查询缓存（秒）。仅减少 SELECT 往返；CkPasswd 仍每次执行。
 * 改密码、defunct、权限变更后最多滞后本秒数；与后台「比赛元数据」类短时缓存同量级。
 * 无绝对最优值：高频只读可 5–15；强一致敏感可改为 0/2。此值可由部署方改为一行 define。
 */
define('ICPC_CCS_AUTH_DB_CACHE_SECONDS', 5);

// ================================================================
//  HTTP Response Helpers
// ================================================================

function icpc_cors_headers()
{
    header('Access-Control-Allow-Origin: *');
    header('Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS');
    header('Access-Control-Allow-Headers: Authorization, Content-Type, Accept');
    header('Access-Control-Max-Age: 86400');
}

function icpc_json_response($data, $httpCode = 200)
{
    http_response_code($httpCode);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-cache, must-revalidate');
    icpc_cors_headers();
    echo json_encode($data, icpc_ccs_json_encode_flags());
    exit;
}

function icpc_error_response($httpCode, $message)
{
    http_response_code($httpCode);
    header('Content-Type: application/json; charset=utf-8');
    icpc_cors_headers();
    echo json_encode(['code' => $httpCode, 'message' => $message], icpc_ccs_json_encode_flags());
    exit;
}

function icpc_handle_options()
{
    if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
        http_response_code(204);
        icpc_cors_headers();
        exit;
    }
}

function icpc_require_get()
{
    if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
        icpc_error_response(405, 'Method not allowed');
    }
}

// ================================================================
//  Authentication
// ================================================================

function icpc_parse_basic_auth()
{
    $auth = $_SERVER['HTTP_AUTHORIZATION']
         ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION']
         ?? '';
    if (stripos($auth, 'Basic ') === 0) {
        $decoded = base64_decode(substr($auth, 6), true);
        if ($decoded !== false && strpos($decoded, ':') !== false) {
            $parts = explode(':', $decoded, 2);
            return ['username' => $parts[0], 'password' => $parts[1]];
        }
    }
    if (isset($_SERVER['PHP_AUTH_USER'])) {
        return ['username' => $_SERVER['PHP_AUTH_USER'], 'password' => $_SERVER['PHP_AUTH_PW'] ?? ''];
    }
    return null;
}

/**
 * Authenticate a CCS API request.
 * Returns an auth context array; never returns on bad credentials (sends 401).
 *
 * @param  int   $contestId  Internal contest_id (0 = no contest scope)
 * @return array {type, team_id, privilege, team_info, is_system_admin}
 */
function icpc_authenticate($contestId = 0)
{
    $anonymous = [
        'type'            => 'public',
        'team_id'         => null,
        'privilege'       => null,
        'team_info'       => null,
        'is_system_admin' => false,
    ];

    $creds = icpc_parse_basic_auth();
    if ($creds === null) {
        return $anonymous;
    }

    $username = trim($creds['username']);
    $password = $creds['password'];
    if ($username === '' || $password === '') {
        return $anonymous;
    }

    // 1. Contest-scoped: try cpc_team
    if ($contestId > 0) {
        $teamCacheKey = 'icpc_ccs_auth_team:' . intval($contestId) . ':' . md5($username);
        $team = db('cpc_team')
            ->where('team_id', $username)
            ->where('contest_id', $contestId)
            ->cache($teamCacheKey, ICPC_CCS_AUTH_DB_CACHE_SECONDS)
            ->find();

        if ($team && (!isset($team['defunct']) || $team['defunct'] !== 'Y')) {
            if (CkPasswd($password, $team['password'], true)) {
                $priv = trim($team['privilege'] ?? '');
                return [
                    'type'            => icpc_privilege_to_ccs_type($priv),
                    'team_id'         => $username,
                    'privilege'       => $priv,
                    'team_info'       => $team,
                    'is_system_admin' => false,
                ];
            }
        }
    }

    // 2. System admin fallback
    $sysAuth = icpc_try_system_admin($username, $password, $contestId);
    if ($sysAuth !== null) {
        return $sysAuth;
    }

    // Authentication failed
    header('WWW-Authenticate: Basic realm="ICPC CCS API"');
    icpc_error_response(401, 'Invalid credentials');
}

function icpc_try_system_admin($username, $password, $contestId)
{
    try {
        // 不对 users 行做查询缓存：密码变更后缓存会导致 CkPasswd 长期比对旧哈希（单测轮换口令、后台改密同理）。
        $user = db('users')->where('user_id', $username)->find();
        if (!$user) return null;
        if (!CkPasswd($password, $user['password'], false)) return null;

        $pvKey = 'icpc_ccs_auth_pvroles:' . md5($username);
        $privs = db('privilege')
            ->where('user_id', $username)
            ->where('defunct', 'N')
            ->cache($pvKey, ICPC_CCS_AUTH_DB_CACHE_SECONDS)
            ->column('pvrole');

        $isSuperOrAdmin = in_array('super_admin', $privs) || in_array('administrator', $privs);

        if (!$isSuperOrAdmin && $contestId > 0) {
            $cpiKey = 'icpc_ccs_auth_citem:' . intval($contestId) . ':' . md5($username);
            $contestPriv = db('privilege_item')
                ->where('user_id', $username)
                ->where('rightitem', 'contest')
                ->where('item_id', $contestId)
                ->cache($cpiKey, ICPC_CCS_AUTH_DB_CACHE_SECONDS)
                ->find();
            if (!$contestPriv) return null;
        }

        return [
            'type'            => 'admin',
            'team_id'         => $username,
            'privilege'       => 'admin',
            'team_info'       => null,
            'is_system_admin' => true,
        ];
    } catch (\Exception $e) {
        return null;
    }
}

function icpc_privilege_to_ccs_type($privilege)
{
    if (empty($privilege)) return 'team';
    static $map = [
        'admin'           => 'admin',
        'watcher'         => 'judge',
        'balloon_manager' => 'staff',
        'balloon_sender'  => 'staff',
        'printer'         => 'staff',
        'ccs_reader'      => 'staff',
    ];
    return $map[$privilege] ?? 'staff';
}

function icpc_is_privileged($auth)
{
    return in_array($auth['type'], ['admin', 'judge', 'staff']);
}

function icpc_is_admin_auth($auth)
{
    return $auth['type'] === 'admin';
}

// ================================================================
//  ID Mapping (internal ↔ CCS external)
// ================================================================

function icpc_contest_ext_id($id)    { return strval($id); }
function icpc_team_ext_id($id)       { return strval($id); }
function icpc_problem_ext_id($num)   { return chr(ord('A') + intval($num)); }
function icpc_submission_ext_id($id) { return strval($id); }
function icpc_judgement_ext_id($id)  { return 'j' . strval($id); }
function icpc_run_ext_id($id)         { return 'r' . strval($id); }

function icpc_org_ext_id($school)
{
    if (empty(trim($school ?? ''))) return 'org-unknown';
    return 'org-' . substr(md5($school), 0, 12);
}

function icpc_lang_ext_id($langNum)
{
    static $map = null;
    if ($map === null) {
        $map = config('CsgojConfig.OJ_LANGUAGE_NORMALIZED') ?: [0=>'c',1=>'cpp',3=>'java',6=>'python3'];
    }
    return $map[$langNum] ?? ('lang' . $langNum);
}

function icpc_resolve_contest_id($ext)  { return intval($ext); }
function icpc_resolve_team_id($ext)     { return $ext; }
function icpc_resolve_submission_id($e) { return intval($e); }

function icpc_resolve_problem_num($ext)
{
    if (strlen($ext) === 1 && ctype_alpha($ext)) {
        return ord(strtoupper($ext)) - ord('A');
    }
    return -1;
}

function icpc_resolve_judgement_id($ext)
{
    return (strpos($ext, 'j') === 0) ? intval(substr($ext, 1)) : -1;
}

/** CPC 场 submission 在 solution.user_id 中的虚拟账号：#cpc{contest_id}_{team_id} */
function icpc_cpc_solution_user_id($contestId, $teamId)
{
    return '#cpc' . intval($contestId) . '_' . strval($teamId);
}

/**
 * 与参赛队 team_id 对应的 solution.user_id 列表（含 #cpc 前缀形式与裸 team_id，兼容旧数据/单测）
 */
function icpc_cpc_solution_user_ids_for_contest_teams($contestId, array $teamIds)
{
    $mapped = [];
    foreach ($teamIds as $tid) {
        if ($tid === null || $tid === '') {
            continue;
        }
        $mapped[] = icpc_cpc_solution_user_id($contestId, $tid);
    }
    return array_values(array_unique(array_merge($mapped, $teamIds)));
}

/** 从 solution.user_id 还原 cpc_team.team_id（无 #cpc 前缀则原样返回） */
function icpc_solution_user_id_to_cpc_team_id($userId)
{
    $s = strval($userId);
    if (preg_match('/^#cpc\d+_(.+)$/', $s, $m)) {
        return $m[1];
    }
    return $s;
}

// ================================================================
//  Time Formatting
// ================================================================

function icpc_to_iso8601($datetime)
{
    if (empty($datetime)) return null;
    $ts = is_numeric($datetime) ? intval($datetime) : strtotime($datetime);
    if (!$ts || $ts <= 0) return null;
    return date('Y-m-d\TH:i:s', $ts) . date('P', $ts);
}

function icpc_to_reltime($seconds)
{
    if ($seconds === null) return null;
    $neg = ($seconds < 0);
    $s   = abs(intval(round($seconds)));
    return ($neg ? '-' : '') . sprintf('%d:%02d:%02d', intval($s/3600), intval(($s%3600)/60), $s%60);
}

function icpc_contest_reltime($startTime, $eventTime)
{
    if (empty($startTime) || empty($eventTime)) return null;
    $st = is_numeric($startTime) ? intval($startTime) : strtotime($startTime);
    $et = is_numeric($eventTime) ? intval($eventTime) : strtotime($eventTime);
    if (!$st || !$et) return null;
    return icpc_to_reltime($et - $st);
}

// ================================================================
//  Contest Helpers
// ================================================================

function icpc_get_standard_contest($contestId)
{
    // No query cache: CCS uses start_time for public /problems and state; stale rows break tests and spec.
    $c = db('contest')->where('contest_id', intval($contestId))->find();
    if (!$c) return null;
    if ($c['private'] % 10 !== 2) return null;
    return $c;
}

function icpc_list_standard_contests()
{
    return db('contest')
        ->whereRaw('(`private` % 10) = 2')
        ->where(function ($q) { $q->where('defunct', '<>', 'Y')->whereOr('defunct', null); })
        ->order('contest_id', 'desc')
        ->select() ?: [];
}

function icpc_get_freeze_info($contest)
{
    $startTs = strtotime($contest['start_time']);
    $endTs   = strtotime($contest['end_time']);
    $now     = time();

    $frozenMin   = intval($contest['frozen_minute'] ?? 0);
    $frozenAfter = intval($contest['frozen_after'] ?? 0);

    $freezeTs = null;
    $thawTs   = null;
    $isFrozen = false;

    if ($frozenMin > 0) {
        $freezeTs = $endTs - $frozenMin * 60;
        if ($now >= $freezeTs && $now < $endTs + ($frozenAfter > 0 ? $frozenAfter * 60 : PHP_INT_MAX)) {
            $isFrozen = true;
        }
        if ($frozenAfter > 0) {
            $thawTs = $endTs + $frozenAfter * 60;
            if ($now >= $thawTs) {
                $isFrozen = false;
            }
        }
    }

    return [
        'freeze_ts'   => $freezeTs,
        'thaw_ts'     => $thawTs,
        'is_frozen'   => $isFrozen,
        'freeze_secs' => $frozenMin > 0 ? $frozenMin * 60 : null,
    ];
}

// ================================================================
//  Language Helpers
// ================================================================

function icpc_get_language_map()
{
    static $cache = null;
    if ($cache !== null) return $cache;

    $ojLangs = config('CsgojConfig.OJ_LANGUAGE') ?: [0=>'C',1=>'C++',3=>'Java',6=>'Python3'];
    $norm    = config('CsgojConfig.OJ_LANGUAGE_NORMALIZED') ?: [0=>'c',1=>'cpp',3=>'java',6=>'python3'];
    $extMap  = ['c'=>['c'],'cpp'=>['cpp','cc','cxx'],'java'=>['java'],'python'=>['py'],'python3'=>['py'],'go'=>['go']];

    $cache = [];
    foreach ($ojLangs as $num => $name) {
        $id = $norm[$num] ?? ('lang'.$num);
        $cache[$num] = [
            'id'                   => $id,
            'name'                 => $name,
            'entry_point_required' => ($num == 3),
            'extensions'           => $extMap[$id] ?? [],
        ];
        if ($num == 3) $cache[$num]['entry_point_name'] = 'Main class';
    }
    return $cache;
}

function icpc_get_contest_languages($contest)
{
    $mask = intval($contest['langmask'] ?? -1);
    $all  = icpc_get_language_map();
    if ($mask <= 0) return $all;

    $result = [];
    foreach ($all as $num => $lang) {
        if (($mask >> $num) & 1) $result[$num] = $lang;
    }
    return $result;
}

function icpc_language_command_info($langId)
{
    // Informational only: read runtime config via OJ helper first.
    $judger = icpc_get_judger_runtime_config();
    $cStd = trim(strval($judger['c']['cc_std'] ?? '-std=c17'));
    $cOpt = trim(strval($judger['c']['cc_opt'] ?? '-O2'));
    $cppStd = trim(strval($judger['cpp']['cpp_std'] ?? '-std=c++17'));
    $cppOpt = trim(strval($judger['cpp']['cpp_opt'] ?? '-O2'));
    $javaXms = intval($judger['java']['xms'] ?? 1024);
    $javaXmx = intval($judger['java']['xmx'] ?? 1024);
    $javaXss = intval($judger['java']['xss'] ?? 64);

    $cArgs = trim($cOpt . ' ' . $cStd . ' {files}');
    $cppArgs = trim($cppOpt . ' ' . $cppStd . ' {files}');
    $javaCompileArgs = trim("-J-Xms{$javaXms}M -J-Xmx{$javaXmx}M -J-Xss{$javaXss}M -encoding UTF-8 {files}");
    $javaRunnerArgs = trim("-Dfile.encoding=UTF-8 -XX:+UseSerialGC -Xss{$javaXss}M -Xms{$javaXms}M -Xmx{$javaXmx}M -cp . {main}");

    $map = [
        'c' => [
            'compiler' => ['command' => 'gcc', 'args' => trim($cArgs . ' -Wall -Wextra -DONLINE_JUDGE -static -Wl,--no-relax -Wl,--no-pie -mcmodel=medium -o {executable}')],
            'runner'   => ['command' => './{executable}'],
        ],
        'cpp' => [
            'compiler' => ['command' => 'g++', 'args' => trim($cppArgs . ' -Wall -Wextra -DONLINE_JUDGE -static -Wl,--no-relax -Wl,--no-pie -mcmodel=medium -o {executable}')],
            'runner'   => ['command' => './{executable}'],
        ],
        'java' => [
            'compiler' => ['command' => 'javac', 'args' => $javaCompileArgs, 'version_command' => 'javac --version'],
            'runner'   => ['command' => 'java', 'args' => $javaRunnerArgs],
        ],
        'python' => [
            'compiler' => ['command' => 'python -m py_compile', 'args' => '{files}'],
            'runner'   => ['command' => 'python', 'args' => '{main_file}'],
        ],
        'python3' => [
            'compiler' => ['command' => 'python3 -m py_compile', 'args' => '{files}'],
            'runner'   => ['command' => 'python3', 'args' => '{main_file}'],
        ],
        'go' => [
            'compiler' => ['command' => 'go build', 'args' => '-o {executable} {files}'],
            'runner'   => ['command' => './{executable}'],
        ],
    ];
    return $map[$langId] ?? null;
}

function icpc_get_judger_runtime_config()
{
    static $cache = null;
    if ($cache !== null) return $cache;

    $cache = [];
    if (function_exists('GetJudgerConfig')) {
        $ret = GetJudgerConfig();
        if (is_array($ret) && isset($ret['config']) && is_array($ret['config'])) {
            $cache = $ret['config'];
            return $cache;
        }
    }

    $fallback = config('JudgeDefaultConfig.config');
    if (is_array($fallback)) $cache = $fallback;
    return $cache;
}

function icpc_problem_output_limit_mib()
{
    $judger = icpc_get_judger_runtime_config();
    $raw = $judger['common']['max_output_limit'] ?? null;
    if ($raw === null) $raw = 256;
    $n = intval($raw);
    return $n > 0 ? $n : 256;
}

function icpc_problem_code_limit_kib()
{
    $bytes = intval(config('CsgojConfig.OJ_SUBMIT_MAX_CODE_LENGTH') ?? 65536);
    if ($bytes <= 0) $bytes = 65536;
    return intval(ceil($bytes / 1024.0));
}

function icpc_problem_test_data_count($problemId)
{
    static $cache = [];
    $pid = intval($problemId);
    if ($pid <= 0) return 0;
    if (isset($cache[$pid])) return $cache[$pid];

    $root = rtrim(strval(config('OjPath.testdata') ?? ''), '/');
    if ($root === '') {
        $cache[$pid] = 0;
        return 0;
    }

    $dir = $root . '/' . $pid;
    if (!is_dir($dir)) {
        $cache[$pid] = 0;
        return 0;
    }

    $files = glob($dir . '/*.in');
    if ($files === false || !is_array($files)) {
        $cache[$pid] = 0;
        return 0;
    }

    $cache[$pid] = count($files);
    return $cache[$pid];
}

// ================================================================
//  Judgement Types
// ================================================================

function icpc_judgement_type_map()
{
    static $map = null;
    if ($map !== null) return $map;
    $map = [
        4  => ['id'=>'AC',  'name'=>'Accepted',              'penalty'=>false, 'solved'=>true],
        5  => ['id'=>'PE',  'name'=>'Presentation Error',    'penalty'=>true,  'solved'=>false],
        6  => ['id'=>'WA',  'name'=>'Wrong Answer',          'penalty'=>true,  'solved'=>false],
        7  => ['id'=>'TLE', 'name'=>'Time Limit Exceeded',   'penalty'=>true,  'solved'=>false],
        8  => ['id'=>'MLE', 'name'=>'Memory Limit Exceeded', 'penalty'=>true,  'solved'=>false],
        9  => ['id'=>'OLE', 'name'=>'Output Limit Exceeded', 'penalty'=>true,  'solved'=>false],
        10 => ['id'=>'RE',  'name'=>'Runtime Error',         'penalty'=>true,  'solved'=>false],
        11 => ['id'=>'CE',  'name'=>'Compilation Error',     'penalty'=>false, 'solved'=>false],
        90 => ['id'=>'JE',  'name'=>'Judging Error',         'penalty'=>false, 'solved'=>false],
    ];
    return $map;
}

function icpc_all_judgement_types()
{
    return array_values(icpc_judgement_type_map());
}

function icpc_result_to_jt_id($resultCode)
{
    $map = icpc_judgement_type_map();
    return isset($map[$resultCode]) ? $map[$resultCode]['id'] : null;
}

// ================================================================
//  Serializers: PHP data → CCS JSON structures
// ================================================================

function icpc_serialize_contest($c)
{
    $startTs  = strtotime($c['start_time']);
    $endTs    = strtotime($c['end_time']);
    $duration = $endTs - $startTs;
    $frzMin   = intval($c['frozen_minute'] ?? 0);

    $data = [
        'id'               => icpc_contest_ext_id($c['contest_id']),
        'name'             => $c['title'],
        'formal_name'      => $c['title'],
        'start_time'       => icpc_to_iso8601($c['start_time']),
        'duration'         => icpc_to_reltime($duration),
        'scoreboard_type'  => 'pass-fail',
        'penalty_time'     => icpc_to_reltime(20 * 60),
    ];
    if ($frzMin > 0) {
        $data['scoreboard_freeze_duration'] = icpc_to_reltime($frzMin * 60);
    }
    return $data;
}

function icpc_serialize_state($c)
{
    $now     = time();
    $startTs = strtotime($c['start_time']);
    $endTs   = strtotime($c['end_time']);
    $freeze  = icpc_get_freeze_info($c);

    $started   = ($now >= $startTs) ? icpc_to_iso8601($startTs) : null;
    $ended     = ($now >= $endTs)   ? icpc_to_iso8601($endTs)   : null;
    $frozen    = ($freeze['freeze_ts'] && $now >= $freeze['freeze_ts']) ? icpc_to_iso8601($freeze['freeze_ts']) : null;
    $thawed    = ($freeze['thaw_ts'] && $now >= $freeze['thaw_ts'])     ? icpc_to_iso8601($freeze['thaw_ts'])   : null;
    $finalized = null;
    if ($ended) {
        $finalized = $thawed ?: (!$frozen ? $ended : null);
    }

    return [
        'started'        => $started,
        'frozen'         => $frozen,
        'ended'          => $ended,
        'thawed'         => $thawed,
        'finalized'      => $finalized,
        'end_of_updates' => $finalized,
    ];
}

function icpc_color_name_to_rgb($name)
{
    $n = strtolower(trim(strval($name ?? '')));
    static $map = [
        'red' => '#ff0000', 'blue' => '#0000ff', 'green' => '#008000', 'yellow' => '#ffff00',
        'orange' => '#ffa500', 'purple' => '#800080', 'pink' => '#ffc0cb', 'gray' => '#808080',
        'grey' => '#808080', 'black' => '#000000', 'white' => '#ffffff', 'brown' => '#8b4513',
        'cyan' => '#00ffff', 'magenta' => '#ff00ff', 'lime' => '#00ff00', 'navy' => '#000080',
    ];
    if ($n !== '' && isset($map[$n])) return $map[$n];
    if (preg_match('/^#[0-9a-fA-F]{6}$/', $n)) return $n;
    return '#808080';
}

function icpc_serialize_problem($cp, $prob, $contest)
{
    $num   = intval($cp['num']);
    $label = chr(ord('A') + $num);
    $data  = [
        'id'      => icpc_problem_ext_id($num),
        'label'   => $label,
        'name'    => $prob['title'] ?? ('Problem ' . $label),
        'ordinal' => $num,
    ];
    if (isset($prob['time_limit']))   $data['time_limit']   = floatval($prob['time_limit']);
    // CCS：memory_limit 为整数 MiB；题库字段与后台一致，单位为 MB（按 MiB 对外输出）
    if (isset($prob['memory_limit'])) {
        $data['memory_limit'] = (int) max(0, (int) round((float) $prob['memory_limit']));
    }
    $data['output_limit'] = icpc_problem_output_limit_mib();
    $data['code_limit'] = icpc_problem_code_limit_kib();
    $data['test_data_count'] = icpc_problem_test_data_count($cp['problem_id'] ?? 0);
    if (!empty($cp['color'])) {
        $data['color'] = $cp['color'];
        $data['rgb']   = icpc_color_name_to_rgb($cp['color']);
    } else {
        $data['rgb'] = '#808080';
    }
    $data['statement']   = null;
    $data['attachments'] = [];
    return $data;
}

function icpc_serialize_team($t)
{
    if (!empty(trim($t['privilege'] ?? ''))) return null;

    $data = [
        'id'      => icpc_team_ext_id($t['team_id']),
        'icpc_id' => null,
        'name'    => $t['name'] ?? $t['team_id'],
        'label'   => $t['team_id'],
    ];
    if (!empty($t['name_en']))  $data['display_name']    = $t['name_en'];
    if (!empty($t['school']))   $data['organization_id'] = icpc_org_ext_id($t['school']);
    if (!empty($t['region'])) {
        $data['group_ids'] = ['region-' . substr(md5($t['region']), 0, 8)];
    }
    return $data;
}

function icpc_serialize_organization($school)
{
    $s = trim($school ?? '');
    if ($s === '') return null;
    return [
        'id'          => icpc_org_ext_id($s),
        'icpc_id'     => null,
        'name'        => $s,
        'formal_name' => $s,
    ];
}

function icpc_serialize_group($name, $type = null)
{
    $id   = 'region-' . substr(md5($name), 0, 8);
    $data = ['id' => $id, 'icpc_id' => null, 'name' => $name];
    if ($type) $data['type'] = $type;
    return $data;
}

function icpc_serialize_language($langInfo)
{
    $data = [
        'id'                   => $langInfo['id'],
        'name'                 => $langInfo['name'],
        'entry_point_required' => $langInfo['entry_point_required'],
        'extensions'           => $langInfo['extensions'],
    ];
    if (!empty($langInfo['entry_point_name'])) {
        $data['entry_point_name'] = $langInfo['entry_point_name'];
    }
    $cmdInfo = icpc_language_command_info($langInfo['id']);
    if ($cmdInfo) {
        $data['compiler'] = $cmdInfo['compiler'];
        $data['runner'] = $cmdInfo['runner'];
    }
    return $data;
}

function icpc_may_view_submission_files($auth)
{
    return icpc_is_privileged($auth);
}

function icpc_guess_submission_entry_point($sol)
{
    $langNum = intval($sol['language'] ?? 0);
    $langMap = icpc_get_language_map();
    if (!empty($langMap[$langNum]['entry_point_required'])) {
        return 'Main';
    }
    return null;
}

function icpc_serialize_submission($sol, $contest, $probNumMap)
{
    $langMap = icpc_get_language_map();
    $langId  = isset($langMap[$sol['language']]) ? $langMap[$sol['language']]['id'] : 'unknown';
    $probNum = $probNumMap[$sol['problem_id']] ?? -1;

    return [
        'id'           => icpc_submission_ext_id($sol['solution_id']),
        'language_id'  => $langId,
        'problem_id'   => ($probNum >= 0) ? icpc_problem_ext_id($probNum) : 'unknown',
        'team_id'      => icpc_team_ext_id(icpc_solution_user_id_to_cpc_team_id($sol['user_id'])),
        'time'         => icpc_to_iso8601($sol['in_date']),
        'contest_time' => icpc_contest_reltime($contest['start_time'], $sol['in_date']),
    ];
}

function icpc_serialize_submission_full($sol, $contest, $probNumMap, $auth)
{
    $base = icpc_serialize_submission($sol, $contest, $probNumMap);
    if (!icpc_may_view_submission_files($auth)) {
        return $base;
    }
    $cid = icpc_contest_ext_id($contest['contest_id']);
    $sid = icpc_submission_ext_id($sol['solution_id']);
    $base['entry_point'] = icpc_guess_submission_entry_point($sol);
    $base['files']       = [
        ['href' => 'contests/' . $cid . '/submissions/' . $sid . '/files', 'mime' => 'application/zip'],
    ];
    return $base;
}

function icpc_serialize_judgement($sol, $contest)
{
    $result = intval($sol['result']);
    $jtId   = icpc_result_to_jt_id($result);
    if ($jtId === null) return null;

    $data = [
        'id'                  => icpc_judgement_ext_id($sol['solution_id']),
        'submission_id'       => icpc_submission_ext_id($sol['solution_id']),
        'judgement_type_id'   => $jtId,
        'start_time'          => icpc_to_iso8601($sol['in_date']),
        'start_contest_time'  => icpc_contest_reltime($contest['start_time'], $sol['in_date']),
        'end_time'            => icpc_to_iso8601($sol['in_date']),
        'end_contest_time'    => icpc_contest_reltime($contest['start_time'], $sol['in_date']),
    ];
    if (isset($sol['time']) && $sol['time'] > 0) {
        $data['max_run_time'] = round(floatval($sol['time']) / 1000.0, 3);
    }
    return $data;
}

function icpc_serialize_run($sol, $contest)
{
    $j = icpc_serialize_judgement($sol, $contest);
    if ($j === null) return null;
    $rt = isset($sol['time']) && floatval($sol['time']) > 0
        ? round(floatval($sol['time']) / 1000.0, 3) : 0.0;
    return [
        'id'                  => icpc_run_ext_id($sol['solution_id']),
        'judgement_id'        => $j['id'],
        'ordinal'             => 1,
        'judgement_type_id'   => $j['judgement_type_id'],
        'time'                => $j['end_time'],
        'contest_time'        => $j['end_contest_time'],
        'run_time'            => $rt,
    ];
}

function icpc_serialize_account($teamInfo, $auth)
{
    if ($auth['is_system_admin']) {
        return [
            'id'       => $auth['team_id'],
            'username' => $auth['team_id'],
            'type'     => 'admin',
            'name'     => $auth['team_id'],
        ];
    }
    if ($teamInfo === null) return null;
    $priv = trim($teamInfo['privilege'] ?? '');
    $type = icpc_privilege_to_ccs_type($priv);
    $data = [
        'id'       => icpc_team_ext_id($teamInfo['team_id']),
        'username' => $teamInfo['team_id'],
        'type'     => $type,
        'name'     => $teamInfo['name'] ?? $teamInfo['team_id'],
    ];
    if ($type === 'team') {
        $data['team_id'] = icpc_team_ext_id($teamInfo['team_id']);
    }
    return $data;
}

// ================================================================
//  Data Access Helpers (single-query, cacheable)
// ================================================================

function icpc_fetch_contest_problems($contestId)
{
    return db('contest_problem')->alias('cp')
        ->join('problem p', 'p.problem_id = cp.problem_id', 'left')
        ->where('cp.contest_id', intval($contestId))
        ->order('cp.num', 'asc')
        ->field('cp.problem_id, cp.num, cp.title as color, cp.pscore, p.title, p.time_limit, p.memory_limit')
        ->select() ?: [];
}

function icpc_fetch_teams($contestId)
{
    return db('cpc_team')
        ->where('contest_id', intval($contestId))
        ->where(function ($q) { $q->where('defunct', '<>', 'Y')->whereOr('defunct', null); })
        ->select() ?: [];
}

function icpc_fetch_contestant_teams($contestId)
{
    return db('cpc_team')
        ->where('contest_id', intval($contestId))
        ->where(function ($q) { $q->where('privilege', '')->whereOr('privilege', null); })
        ->where(function ($q) { $q->where('defunct', '<>', 'Y')->whereOr('defunct', null); })
        ->select() ?: [];
}

function icpc_fetch_solutions($contestId, $fields = '*')
{
    return db('solution')
        ->where('contest_id', intval($contestId))
        ->field($fields)
        ->order('solution_id', 'asc')
        ->select() ?: [];
}

function icpc_build_problem_num_map($contestId)
{
    $rows = db('contest_problem')
        ->where('contest_id', intval($contestId))
        ->field('problem_id, num')
        ->select() ?: [];
    $map = [];
    foreach ($rows as $r) $map[$r['problem_id']] = intval($r['num']);
    return $map;
}

// ================================================================
//  Scoreboard
// ================================================================

/**
 * 聚合榜单数据（供 scoreboard / awards 复用，避免重复扫 solution）。
 * @return array{contest_id:int,start_ts:int,problems:array,teams:array,board:array,sorted:array,firstSolve:array,is_staff:bool,freeze:array}
 */
function icpc_contest_scoreboard_rollup($contest, $auth)
{
    $contestId = intval($contest['contest_id']);
    $startTs   = strtotime($contest['start_time']);
    $isStaff   = icpc_is_privileged($auth);
    $freeze    = icpc_get_freeze_info($contest);
    $jtMap     = icpc_judgement_type_map();

    $problems = db('contest_problem')
        ->where('contest_id', $contestId)
        ->field('problem_id, num')
        ->order('num', 'asc')
        ->select() ?: [];

    $probNums = [];
    foreach ($problems as $p) {
        $probNums[$p['problem_id']] = intval($p['num']);
    }

    $teams = icpc_fetch_contestant_teams($contestId);
    $teamSet = [];
    foreach ($teams as $t) {
        $teamSet[$t['team_id']] = true;
    }

    $solutions = db('solution')
        ->where('contest_id', $contestId)
        ->field('solution_id, problem_id, user_id, result, in_date')
        ->order('solution_id', 'asc')
        ->select() ?: [];

    $board = [];
    foreach ($teams as $t) {
        $tid = $t['team_id'];
        $board[$tid] = ['solved' => 0, 'penalty' => 0, 'probs' => []];
        foreach ($problems as $p) {
            $num = intval($p['num']);
            $board[$tid]['probs'][$num] = [
                'judged' => 0, 'pending' => 0, 'solved' => false,
                'time' => null, 'penalty_wrong' => 0,
            ];
        }
    }

    $firstSolve = [];

    foreach ($solutions as $sol) {
        $tid = icpc_solution_user_id_to_cpc_team_id($sol['user_id']);
        $pid = $sol['problem_id'];
        $res = intval($sol['result']);
        if (!isset($teamSet[$tid]) || !isset($probNums[$pid])) {
            continue;
        }
        $num   = $probNums[$pid];
        $solTs = strtotime($sol['in_date']);
        $ref   = &$board[$tid]['probs'][$num];

        if ($res >= 0 && $res <= 3) {
            $ref['pending']++;
            continue;
        }

        if (!$isStaff && $freeze['is_frozen'] && $freeze['freeze_ts'] && $solTs >= $freeze['freeze_ts']) {
            $ref['pending']++;
            continue;
        }

        if ($ref['solved']) {
            continue;
        }

        $ref['judged']++;
        if ($res === 4) {
            $ref['solved'] = true;
            $solveSec = $solTs - $startTs;
            $ref['time'] = $solveSec;
            $board[$tid]['solved']++;
            $board[$tid]['penalty'] += $solveSec + $ref['penalty_wrong'] * 20 * 60;

            if (!isset($firstSolve[$num])) {
                $firstSolve[$num] = $tid;
            }
        } else {
            if (isset($jtMap[$res]) && $jtMap[$res]['penalty']) {
                $ref['penalty_wrong']++;
            }
        }
    }

    $sorted = [];
    foreach ($teams as $t) {
        $tid = $t['team_id'];
        $sorted[] = ['tid' => $tid, 's' => $board[$tid]['solved'], 'p' => $board[$tid]['penalty']];
    }
    usort($sorted, function ($a, $b) {
        if ($a['s'] !== $b['s']) {
            return $b['s'] - $a['s'];
        }
        if ($a['p'] !== $b['p']) {
            return $a['p'] - $b['p'];
        }
        return strcmp($a['tid'], $b['tid']);
    });

    return [
        'contest_id'  => $contestId,
        'start_ts'    => $startTs,
        'problems'    => $problems,
        'teams'       => $teams,
        'board'       => $board,
        'sorted'      => $sorted,
        'firstSolve'  => $firstSolve,
        'is_staff'    => $isStaff,
        'freeze'      => $freeze,
    ];
}

function icpc_scoreboard_rows_from_rollup(array $roll, $contest)
{
    $problems   = $roll['problems'];
    $board      = $roll['board'];
    $sorted     = $roll['sorted'];
    $firstSolve = $roll['firstSolve'];

    $rows = [];
    $rank = 0;
    $prevS = -1;
    $prevP = -1;
    foreach ($sorted as $i => $item) {
        $tid = $item['tid'];
        if ($item['s'] !== $prevS || $item['p'] !== $prevP) {
            $rank = $i + 1;
        }
        $prevS = $item['s'];
        $prevP = $item['p'];

        $probArr = [];
        foreach ($problems as $p) {
            $num = intval($p['num']);
            $pd  = $board[$tid]['probs'][$num];
            $pe  = [
                'problem_id'  => icpc_problem_ext_id($num),
                'num_judged'  => $pd['judged'],
                'num_pending' => $pd['pending'],
                'solved'      => $pd['solved'],
            ];
            if ($pd['solved']) {
                $pe['time'] = icpc_to_reltime($pd['time']);
                if (isset($firstSolve[$num]) && $firstSolve[$num] === $tid) {
                    $pe['first_to_solve'] = true;
                }
            }
            $probArr[] = $pe;
        }

        $rows[] = [
            'rank'     => $rank,
            'team_id'  => icpc_team_ext_id($tid),
            'score'    => [
                'num_solved' => $board[$tid]['solved'],
                'total_time' => icpc_to_reltime($board[$tid]['penalty']),
            ],
            'problems' => $probArr,
        ];
    }

    return $rows;
}

function icpc_build_scoreboard($contest, $auth)
{
    $startTs = strtotime($contest['start_time']);
    $now     = time();
    $roll    = icpc_contest_scoreboard_rollup($contest, $auth);
    $rows    = icpc_scoreboard_rows_from_rollup($roll, $contest);
    $state   = icpc_serialize_state($contest);
    return [
        'time'         => icpc_to_iso8601($now),
        'contest_time' => ($now >= $startTs) ? icpc_contest_reltime($contest['start_time'], $now) : icpc_to_reltime(0),
        'state'        => $state,
        'rows'         => $rows,
    ];
}

// ================================================================
//  Awards（CCS Contest API：known ids + team_ids；奖牌线来自 contest.award_ratio + contest.flg_award_qty_mode）
// ================================================================

/** 解析 contest.award_ratio：bronze×1e6 + silver×1e3 + gold（与后台比赛编辑存库一致） */
function icpc_parse_contest_award_ratio($contest)
{
    $raw = intval($contest['award_ratio'] ?? 0);
    if ($raw === 0) {
        return ['gold' => 10, 'silver' => 20, 'bronze' => 30];
    }
    $g = $raw % 1000;
    $raw = intdiv($raw, 1000);
    $s = $raw % 1000;
    $raw = intdiv($raw, 1000);
    $b = $raw % 1000;
    return ['gold' => $g, 'silver' => $s, 'bronze' => $b];
}

/**
 * 由金/银/铜与 contest.flg_award_qty_mode 得「前 K 名（含）」截断线。
 * 与 rank_tool.js RankToolGetAwardRank 一致（百分比 / 个数两档）。
 */
function icpc_contest_award_rank_cutoffs($cntBase, $rawGold, $rawSilver, $rawBronze, $qtyMode = 0)
{
    return \app\common\funcs\ContestAwardMath::computeRankCutoffs(
        intval($cntBase),
        intval($rawGold),
        intval($rawSilver),
        intval($rawBronze),
        \app\common\funcs\ContestAwardMath::normalizeQtyMode($qtyMode)
    );
}

function icpc_build_awards($contest, $auth)
{
    $roll = icpc_contest_scoreboard_rollup($contest, $auth);
    $rows = icpc_scoreboard_rows_from_rollup($roll, $contest);
    if ($rows === []) {
        return [];
    }

    $ratios = icpc_parse_contest_award_ratio($contest);
    $solvedRows = [];
    foreach ($rows as $r) {
        if (intval($r['score']['num_solved']) > 0) {
            $solvedRows[] = $r;
        }
    }
    $cntSolved = count($solvedRows);
    $qtyMode = \app\common\funcs\ContestAwardMath::normalizeQtyMode($contest['flg_award_qty_mode'] ?? 0);
    $cut = icpc_contest_award_rank_cutoffs(
        $cntSolved,
        $ratios['gold'],
        $ratios['silver'],
        $ratios['bronze'],
        $qtyMode
    );
    $limGold   = $cut['rankGold'];
    $limSilver = $cut['rankSilver'];
    $limBronze = $cut['rankBronze'];

    $awards = [];

    // winner：与 scoreboard 一致，rank 1 且榜顶有过题（CCS known award）
    if (intval($rows[0]['score']['num_solved']) > 0) {
        $winnerTeams = [];
        foreach ($rows as $r) {
            if (intval($r['rank']) !== 1) {
                break;
            }
            $winnerTeams[] = $r['team_id'];
        }
        if ($winnerTeams !== []) {
            $awards[] = ['id' => 'winner', 'citation' => 'Contest winner', 'team_ids' => $winnerTeams];
        }
    }

    $gold = [];
    $silver = [];
    $bronze = [];
    $idx = 0;
    foreach ($solvedRows as $r) {
        $idx++;
        if ($limGold > 0 && $idx <= $limGold) {
            $gold[] = $r['team_id'];
        } elseif ($limSilver > 0 && $idx <= $limSilver) {
            $silver[] = $r['team_id'];
        } elseif ($limBronze > 0 && $idx <= $limBronze) {
            $bronze[] = $r['team_id'];
        }
    }

    if ($gold !== []) {
        $awards[] = ['id' => 'gold-medal', 'citation' => 'Gold medal', 'team_ids' => $gold];
    }
    if ($silver !== []) {
        $awards[] = ['id' => 'silver-medal', 'citation' => 'Silver medal', 'team_ids' => $silver];
    }
    if ($bronze !== []) {
        $awards[] = ['id' => 'bronze-medal', 'citation' => 'Bronze medal', 'team_ids' => $bronze];
    }

    foreach ($rows as $r) {
        foreach ($r['problems'] as $pe) {
            if (!empty($pe['first_to_solve'])) {
                $awards[] = [
                    'id'         => 'first-to-solve-' . $pe['problem_id'],
                    'citation' => 'First to solve problem ' . $pe['problem_id'],
                    'team_ids' => [$r['team_id']],
                ];
            }
        }
    }

    return $awards;
}

// ================================================================
//  CCS System Requirements helpers (contest phase, queries)
// ================================================================

function icpc_contest_has_started($contest)
{
    $st = strtotime($contest['start_time'] ?? '');
    return $st && time() >= $st;
}

function icpc_should_hide_problems_for_public($contest, $auth)
{
    return ($auth['type'] ?? '') === 'public' && !icpc_contest_has_started($contest);
}

function icpc_query_submission_rows_for_contest($contestId, $auth)
{
    $isStaff = icpc_is_privileged($auth);
    $contestantTeams = icpc_fetch_contestant_teams($contestId);
    $teamIds = array_column($contestantTeams, 'team_id');
    $query = db('solution')->where('contest_id', intval($contestId));
    if (!empty($teamIds)) {
        $query = $query->whereIn('user_id', icpc_cpc_solution_user_ids_for_contest_teams($contestId, $teamIds));
    }
    if (!$isStaff && ($auth['type'] ?? '') === 'team') {
        $query = $query->whereIn(
            'user_id',
            icpc_cpc_solution_user_ids_for_contest_teams($contestId, [$auth['team_id']])
        );
    }
    return $query->field('solution_id, problem_id, user_id, result, language, in_date, time')
        ->order('solution_id', 'asc')->select() ?: [];
}

function icpc_query_judged_solution_rows($contest, $auth)
{
    $contestId = intval($contest['contest_id']);
    $isStaff   = icpc_is_privileged($auth);
    $freeze    = icpc_get_freeze_info($contest);
    $contestantTeams = icpc_fetch_contestant_teams($contestId);
    $teamIds = array_column($contestantTeams, 'team_id');
    $query = db('solution')->where('contest_id', $contestId)->where('result', '>', 3);
    if (!empty($teamIds)) {
        $query = $query->whereIn('user_id', icpc_cpc_solution_user_ids_for_contest_teams($contestId, $teamIds));
    }
    if (!$isStaff && ($auth['type'] ?? '') === 'team') {
        $query = $query->whereIn(
            'user_id',
            icpc_cpc_solution_user_ids_for_contest_teams($contestId, [$auth['team_id']])
        );
    }
    $solutions = $query->field('solution_id, problem_id, user_id, result, in_date, time')
        ->order('solution_id', 'asc')->select() ?: [];
    $out = [];
    foreach ($solutions as $sol) {
        if (!$isStaff && $freeze['is_frozen'] && $freeze['freeze_ts']) {
            $solTs = strtotime($sol['in_date']);
            if ($solTs >= $freeze['freeze_ts']) {
                continue;
            }
        }
        $out[] = $sol;
    }
    return $out;
}

function icpc_list_submissions_serialized($contest, $auth)
{
    $cid = intval($contest['contest_id']);
    $probNumMap = icpc_build_problem_num_map($cid);
    $rows       = icpc_query_submission_rows_for_contest($cid, $auth);
    $result     = [];
    foreach ($rows as $sol) {
        $result[] = icpc_serialize_submission_full($sol, $contest, $probNumMap, $auth);
    }
    return $result;
}

function icpc_list_judgements_serialized($contest, $auth)
{
    $result = [];
    foreach (icpc_query_judged_solution_rows($contest, $auth) as $sol) {
        $j = icpc_serialize_judgement($sol, $contest);
        if ($j !== null) {
            $result[] = $j;
        }
    }
    return $result;
}

function icpc_list_runs_serialized($contest, $auth)
{
    $result = [];
    foreach (icpc_query_judged_solution_rows($contest, $auth) as $sol) {
        $r = icpc_serialize_run($sol, $contest);
        if ($r !== null) {
            $result[] = $r;
        }
    }
    return $result;
}

function icpc_event_feed_make_token($contestId, $lastSid, $seq)
{
    $payload = json_encode([
        'c' => intval($contestId),
        's' => intval($lastSid),
        'q' => intval($seq),
        't' => time(),
    ], icpc_ccs_json_encode_flags());
    $secret = strval(config('OJ_ENV.OJ_SECRET') ?: 'icpc_ccs_feed');
    $sig    = hash_hmac('sha256', $payload, $secret);
    return rtrim(strtr(base64_encode($payload . "\n" . $sig), '+/', '-_'), '=');
}

function icpc_event_feed_parse_token($token, $expectedContestId)
{
    $raw = base64_decode(strtr(strval($token), '-_', '+/'), true);
    if ($raw === false || strpos($raw, "\n") === false) {
        return null;
    }
    list($payload, $sig) = explode("\n", $raw, 2);
    $secret = strval(config('OJ_ENV.OJ_SECRET') ?: 'icpc_ccs_feed');
    if (!hash_equals(hash_hmac('sha256', $payload, $secret), $sig)) {
        return null;
    }
    $data = json_decode($payload, true);
    if (!is_array($data) || !isset($data['c'], $data['s'], $data['t'])) {
        return null;
    }
    if (intval($data['c']) !== intval($expectedContestId)) {
        return null;
    }
    if (time() - intval($data['t']) > 900) {
        return null;
    }
    return [
        's' => intval($data['s']),
        'q' => intval($data['q'] ?? 0),
    ];
}

function icpc_event_feed_emit_line(&$seq, $lastSid, $contestId, $type, $id, $data)
{
    $seq++;
    $line = [
        'type'  => $type,
        'id'    => $id,
        'data'  => $data,
        'token' => icpc_event_feed_make_token($contestId, $lastSid, $seq),
    ];
    $flags = icpc_ccs_json_encode_flags();
    $json  = json_encode($line, $flags);
    if ($json === false) {
        @error_log('icpc_event_feed_emit_line json_encode failed: ' . json_last_error_msg());
        $line['data'] = null;
        $json         = json_encode($line, $flags);
        if ($json === false) {
            $json = '{"type":' . json_encode((string) $type, $flags)
                . ',"id":null,"data":null,"token":' . json_encode($line['token'], $flags) . '}';
        }
    }
    echo $json . "\n";
    if (function_exists('ob_flush')) {
        @ob_flush();
    }
    flush();
    return $seq;
}

/**
 * Internal snapshot step: not a JSON event — stream handler writes a bare newline
 * and flushes so nginx/fastcgi read timeouts do not fire during long PHP work
 * (e.g. building the submissions array) with zero bytes on the wire.
 */
if (!defined('ICPC_EVENT_FEED_SNAPSHOT_HEARTBEAT')) {
    define('ICPC_EVENT_FEED_SNAPSHOT_HEARTBEAT', '_icpc_ndjson_hb');
}

function icpc_event_feed_keepalive_flush()
{
    echo "\n";
    if (function_exists('ob_flush')) {
        @ob_flush();
    }
    flush();
}

/**
 * Same membership as iterating icpc_query_judged_solution_rows(), but loads in
 * pages and flushes keepalive newlines between queries so a huge judged set
 * cannot stall the stream for one long select().
 *
 * @return array<int, true>
 */
function icpc_stream_event_feed_load_emitted_judgements($contest, $auth)
{
    icpc_event_feed_keepalive_flush();
    $emittedJ  = [];
    $contestId = intval($contest['contest_id']);
    $isStaff   = icpc_is_privileged($auth);
    $freeze    = icpc_get_freeze_info($contest);
    $teamIds   = array_column(icpc_fetch_contestant_teams($contestId), 'team_id');
    $pageSize  = 400;
    $lastId    = 0;

    while (true) {
        icpc_event_feed_keepalive_flush();
        $query = db('solution')->where('contest_id', $contestId)->where('result', '>', 3);
        if (!empty($teamIds)) {
            $query = $query->whereIn('user_id', icpc_cpc_solution_user_ids_for_contest_teams($contestId, $teamIds));
        }
        if (!$isStaff && ($auth['type'] ?? '') === 'team') {
            $query = $query->whereIn(
                'user_id',
                icpc_cpc_solution_user_ids_for_contest_teams($contestId, [$auth['team_id']])
            );
        }
        $chunk = $query->where('solution_id', '>', $lastId)
            ->field('solution_id, problem_id, user_id, result, in_date, time')
            ->order('solution_id', 'asc')
            ->limit($pageSize)
            ->select() ?: [];
        if (empty($chunk)) {
            break;
        }
        $maxSid = $lastId;
        foreach ($chunk as $sol) {
            $sid = intval($sol['solution_id']);
            $maxSid = max($maxSid, $sid);
            if (!$isStaff && $freeze['is_frozen'] && $freeze['freeze_ts']) {
                $solTs = strtotime($sol['in_date']);
                if ($solTs >= $freeze['freeze_ts']) {
                    continue;
                }
            }
            $emittedJ[$sid] = true;
        }
        $lastId = $maxSid;
        if (count($chunk) < $pageSize) {
            break;
        }
    }

    return $emittedJ;
}

/**
 * Generator: yield snapshot events one at a time so early NDJSON lines are
 * flushed before building bulk submissions/judgements (avoids proxy/FCGI
 * timeouts when no body bytes were sent for a long time).
 *
 * @return \Generator
 */
function icpc_build_event_feed_snapshot($contest, $auth)
{
    $cid = intval($contest['contest_id']);

    yield ['contest', null, icpc_serialize_contest($contest)];
    yield ['judgement-types', null, icpc_all_judgement_types()];

    $langs = [];
    foreach (icpc_get_contest_languages($contest) as $num => $info) {
        $langs[] = icpc_serialize_language($info);
    }
    yield ['languages', null, $langs];

    $problems = [];
    if (!icpc_should_hide_problems_for_public($contest, $auth)) {
        $rows = icpc_fetch_contest_problems($cid);
        foreach ($rows as $row) {
            $problems[] = icpc_serialize_problem($row, $row, $contest);
        }
    }
    yield ['problems', null, $problems];

    $teams = icpc_fetch_contestant_teams($cid);
    $regions = [];
    foreach ($teams as $t) {
        $r = trim($t['region'] ?? '');
        if ($r !== '' && !isset($regions[$r])) {
            $regions[$r] = icpc_serialize_group($r);
        }
    }
    yield ['groups', null, array_values($regions)];

    $orgs = [];
    foreach ($teams as $t) {
        $s = trim($t['school'] ?? '');
        if ($s !== '' && !isset($orgs[$s])) {
            $orgs[$s] = icpc_serialize_organization($s);
        }
    }
    yield ['organizations', null, array_values(array_filter($orgs))];

    $teamObjs = [];
    foreach ($teams as $t) {
        $s = icpc_serialize_team($t);
        if ($s !== null) {
            $teamObjs[] = $s;
        }
    }
    yield ['teams', null, $teamObjs];

    yield ['state', null, icpc_serialize_state($contest)];
    yield [ICPC_EVENT_FEED_SNAPSHOT_HEARTBEAT, null, null];

    $probNumMap = icpc_build_problem_num_map($cid);
    yield [ICPC_EVENT_FEED_SNAPSHOT_HEARTBEAT, null, null];
    $subRows    = icpc_query_submission_rows_for_contest($cid, $auth);
    yield [ICPC_EVENT_FEED_SNAPSHOT_HEARTBEAT, null, null];
    $subs       = [];
    $subHb      = time();
    foreach ($subRows as $sol) {
        $subs[] = icpc_serialize_submission_full($sol, $contest, $probNumMap, $auth);
        if (time() - $subHb >= 8) {
            yield [ICPC_EVENT_FEED_SNAPSHOT_HEARTBEAT, null, null];
            $subHb = time();
        }
    }
    yield ['submissions', null, $subs];

    $judges = [];
    $runs   = [];
    $judHb  = time();
    foreach (icpc_query_judged_solution_rows($contest, $auth) as $sol) {
        $j = icpc_serialize_judgement($sol, $contest);
        if ($j !== null) {
            $judges[] = $j;
        }
        $r = icpc_serialize_run($sol, $contest);
        if ($r !== null) {
            $runs[] = $r;
        }
        if (time() - $judHb >= 8) {
            yield [ICPC_EVENT_FEED_SNAPSHOT_HEARTBEAT, null, null];
            $judHb = time();
        }
    }
    yield ['judgements', null, $judges];
    yield ['runs', null, $runs];
    yield ['awards', null, icpc_build_awards($contest, $auth)];
}

function icpc_stream_event_feed($contest, $auth)
{
    $cid = intval($contest['contest_id']);
    if (isset($_GET['since_token']) && $_GET['since_token'] !== '') {
        $resume = icpc_event_feed_parse_token($_GET['since_token'], $cid);
        if ($resume === null) {
            icpc_error_response(400, 'Invalid or expired since_token');
        }
        $cursorSid  = $resume['s'];
        $seq         = $resume['q'];
        $doSnapshot = false;
    } else {
        $cursorSid  = 0;
        $seq         = 0;
        $doSnapshot = true;
    }

    while (ob_get_level()) {
        @ob_end_clean();
    }
    @ini_set('output_buffering', 'off');
    @ini_set('zlib.output_compression', '0');

    http_response_code(200);
    header('Content-Type: application/x-ndjson; charset=utf-8');
    header('Cache-Control: no-cache, no-store, must-revalidate');
    header('X-Accel-Buffering: no');
    icpc_cors_headers();

    // Spec allows keep-alive as a bare newline; primes chunked body so proxies
    // see immediate upstream activity before the first snapshot line is built.
    echo "\n";
    if (function_exists('ob_flush')) {
        @ob_flush();
    }
    flush();

    set_time_limit(0);
    ignore_user_abort(false);

    $lastSidForToken = $cursorSid;
    $emittedJ        = [];

    if ($doSnapshot) {
        foreach (icpc_build_event_feed_snapshot($contest, $auth) as $ev) {
            list($type, $id, $data) = $ev;
            if ($type === ICPC_EVENT_FEED_SNAPSHOT_HEARTBEAT) {
                echo "\n";
                if (function_exists('ob_flush')) {
                    @ob_flush();
                }
                flush();
                continue;
            }
            $seq = icpc_event_feed_emit_line($seq, $lastSidForToken, $cid, $type, $id, $data);
        }
        // Keep proxy/FastCGI read alive: snapshot ended but DB bookkeeping + first usleep
        // would otherwise send zero bytes long enough for nginx to close the chunk stream.
        echo "\n";
        if (function_exists('ob_flush')) {
            @ob_flush();
        }
        flush();

        icpc_event_feed_keepalive_flush();
        $maxRow = db('solution')->where('contest_id', $cid)->max('solution_id');
        $lastSidForToken = $maxRow ? intval($maxRow) : 0;
        $emittedJ        = icpc_stream_event_feed_load_emitted_judgements($contest, $auth);
    } else {
        $rows = icpc_query_judged_solution_rows($contest, $auth);
        foreach ($rows as $sol) {
            if (intval($sol['solution_id']) <= $cursorSid) {
                $emittedJ[intval($sol['solution_id'])] = true;
            }
        }
        $lastSidForToken = $cursorSid;
        $st = icpc_serialize_state($contest);
        $seq = icpc_event_feed_emit_line($seq, $lastSidForToken, $cid, 'state', null, $st);
    }

    echo "\n";
    if (function_exists('ob_flush')) {
        @ob_flush();
    }
    flush();

    $lastStateJson = json_encode(icpc_serialize_state($contest), icpc_ccs_json_encode_flags());

    while (!connection_aborted()) {
        // 每轮轮询前先输出空行，避免首轮在 usleep/DB 前长时间零字节导致 nginx fastcgi 读超时断流
        icpc_event_feed_keepalive_flush();

        $fresh = db('contest')->where('contest_id', $cid)->find();
        if ($fresh && (intval($fresh['private'] ?? 0) % 10 === 2)) {
            $contest = $fresh;
        }

        $st = icpc_serialize_state($contest);
        $sj = json_encode($st, icpc_ccs_json_encode_flags());
        if ($sj !== $lastStateJson) {
            $seq = icpc_event_feed_emit_line($seq, $lastSidForToken, $cid, 'state', null, $st);
            $lastStateJson = $sj;
        }

        $probNumMap = icpc_build_problem_num_map($cid);
        $isStaff    = icpc_is_privileged($auth);
        $teamIds    = array_column(icpc_fetch_contestant_teams($cid), 'team_id');

        $newSolsQ = db('solution')
            ->where('contest_id', $cid)
            ->where('solution_id', '>', $lastSidForToken)
            ->order('solution_id', 'asc');
        if (!empty($teamIds)) {
            $newSolsQ = $newSolsQ->whereIn('user_id', icpc_cpc_solution_user_ids_for_contest_teams($cid, $teamIds));
        }
        $newSols = $newSolsQ->select() ?: [];

        foreach ($newSols as $sol) {
            if (!$isStaff && ($auth['type'] ?? '') === 'team'
                && icpc_solution_user_id_to_cpc_team_id($sol['user_id']) !== $auth['team_id']) {
                continue;
            }
            $sid = intval($sol['solution_id']);
            $seq = icpc_event_feed_emit_line(
                $seq,
                $sid,
                $cid,
                'submissions',
                icpc_submission_ext_id($sid),
                icpc_serialize_submission_full($sol, $contest, $probNumMap, $auth)
            );
            $lastSidForToken = max($lastSidForToken, $sid);
        }

        foreach (icpc_query_judged_solution_rows($contest, $auth) as $sol) {
            $sid = intval($sol['solution_id']);
            if (isset($emittedJ[$sid])) {
                continue;
            }
            $j = icpc_serialize_judgement($sol, $contest);
            if ($j === null) {
                continue;
            }
            $seq = icpc_event_feed_emit_line($seq, $lastSidForToken, $cid, 'judgements', $j['id'], $j);
            $r = icpc_serialize_run($sol, $contest);
            if ($r !== null) {
                $seq = icpc_event_feed_emit_line($seq, $lastSidForToken, $cid, 'runs', $r['id'], $r);
            }
            $emittedJ[$sid] = true;
            $lastSidForToken = max($lastSidForToken, $sid);
        }

        usleep(1500000);
    }
    exit;
}

// ================================================================
//  Access Endpoint Builder
// ================================================================

function icpc_build_access($auth)
{
    $caps = [];

    $endpoints = [
        ['type' => 'contest', 'properties' => [
            'id', 'name', 'formal_name', 'start_time', 'duration',
            'scoreboard_freeze_duration', 'scoreboard_type', 'penalty_time',
        ]],
        ['type' => 'judgement-types', 'properties' => ['id', 'name', 'penalty', 'solved']],
        ['type' => 'languages', 'properties' => [
            'id', 'name', 'entry_point_required', 'entry_point_name', 'extensions',
            'compiler.command', 'compiler.args', 'runner.command', 'runner.args',
        ]],
        ['type' => 'problems', 'properties' => [
            'id', 'label', 'name', 'ordinal', 'rgb', 'color', 'time_limit', 'memory_limit',
            'output_limit', 'code_limit', 'test_data_count', 'statement', 'attachments',
        ]],
        ['type' => 'groups', 'properties' => ['id', 'icpc_id', 'name']],
        ['type' => 'organizations', 'properties' => ['id', 'icpc_id', 'name', 'formal_name']],
        ['type' => 'teams', 'properties' => [
            'id', 'icpc_id', 'label', 'name', 'display_name', 'organization_id', 'group_ids',
        ]],
        ['type' => 'state', 'properties' => [
            'started', 'frozen', 'ended', 'thawed', 'finalized', 'end_of_updates',
        ]],
        ['type' => 'submissions', 'properties' => [
            'id', 'language_id', 'problem_id', 'team_id', 'time', 'contest_time', 'entry_point', 'files',
        ]],
        ['type' => 'judgements', 'properties' => [
            'id', 'submission_id', 'judgement_type_id', 'start_time', 'start_contest_time',
            'end_time', 'end_contest_time', 'max_run_time',
        ]],
        ['type' => 'runs', 'properties' => [
            'id', 'judgement_id', 'ordinal', 'judgement_type_id', 'time', 'contest_time', 'run_time',
        ]],
        ['type' => 'scoreboard', 'properties' => ['time', 'contest_time', 'state', 'rows']],
        ['type' => 'awards', 'properties' => ['id', 'citation', 'team_ids']],
        ['type' => 'event-feed', 'properties' => []],
        ['type' => 'account', 'properties' => ['id', 'username', 'type', 'name', 'team_id']],
    ];

    if (icpc_is_privileged($auth)) {
        $endpoints[] = ['type' => 'accounts', 'properties' => ['id', 'username', 'type', 'name', 'team_id']];
    }

    return ['capabilities' => $caps, 'endpoints' => $endpoints];
}

// ================================================================
//  Collection Filtering
// ================================================================

function icpc_apply_query_filters($items, $allowedKeys)
{
    $filters = [];
    foreach ($allowedKeys as $key) {
        $val = $_GET[$key] ?? null;
        if ($val !== null) $filters[$key] = $val;
    }
    if (empty($filters)) return $items;

    return array_values(array_filter($items, function ($item) use ($filters) {
        foreach ($filters as $k => $v) {
            $iv = $item[$k] ?? null;
            if (is_array($iv)) {
                if (!in_array($v, $iv)) return false;
            } else {
                if (strval($iv) !== strval($v)) return false;
            }
        }
        return true;
    }));
}
