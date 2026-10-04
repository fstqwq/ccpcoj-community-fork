<?php
namespace app\ojtool\controller;

use app\common\funcs\ContestAttachFile;
use app\ojtool\library\ContestliveBrandingLayout;
use app\common\cross_module\contestlive\ContestliveDisplayAccess;
use app\common\cross_module\contestlive\ContestliveDisplayAddition;
use think\facade\Request;

class Contestlive extends Contest
{
    /** @var bool 本请求投屏已放行（会话或 lvtk） */
    protected $liveDisplayGranted = false;

    /**
     * 主 HUD 底栏左侧：仅展示「未撤回」且发送未逾此秒数的推送（与列表「过期」标记同源阈值）。
     */
    protected const LIVE_COMMAND_HUD_FRESH_SEC = 60;

    /** 控台「近期推送」最多保留条数（按时间保留最近若干条，超出删最旧）。 */
    protected const LIVE_COMMAND_LIST_MAX = 100;

    /**
     * ThinkPHP cache 整键 TTL（秒），须远大于 HUD 新鲜窗口，避免整表被驱动提前清空。
     */
    protected const LIVE_COMMAND_CACHE_TTL_SEC = 604800;

    public function initialize()
    {
        parent::initialize();
        $this->InitController();
    }

    public function InitController()
    {
        $this->liveDisplayGranted = false;
        $action = strtolower($this->request->action());
        $privateWriter = [
            'live_command_send_ajax',
            'live_command_revoke_ajax',
            'display_token_issue_ajax',
            'display_token_revoke_ajax',
            'live_logo_upload_ajax',
            'live_logo_delete_ajax',
            'live_logo_replace_ajax',
            'live_logo_reorder_ajax',
            'live_display_config_save_ajax',
        ];
        if (in_array($action, $privateWriter, true)) {
            if (!$this->canManageLiveConsole()) {
                $this->error('无访问权限', null, '', 1);
            }
        }

        $this->contest = null;
        if (input('?cid')) {
            $cid = input('cid/d');
            $this->contest = db('contest')->where('contest_id', $cid)->find();
            if ($this->contest == null) {
                $this->error('错误的比赛请求');
            }
        }

        if ($this->contest !== null) {
            $this->resolveLiveDisplayAccess();
        }

        if ($action === 'live_brand') {
            if ($this->contest === null) {
                $this->error('缺少比赛 cid');
            }
            $q = 'cid=' . intval($this->contest['contest_id']);
            if (input('?lvtk')) {
                $q .= '&lvtk=' . rawurlencode(input('lvtk/s', ''));
            }
            $this->redirect('/ojtool/contestlive/live?' . $q);
        }
    }

    /**
     * 控制台写权限：与 contestPolicy.canAccessLiveConsole / 前台 contest_live 一致。
     */
    protected function canManageLiveConsole()
    {
        return $this->hasContestLiveConsoleAccess();
    }

    /**
     * 投屏只读访问：hasContestLiveConsoleAccess（会话）或有效 lvtk（与比赛 cid 绑定）
     */
    protected function resolveLiveDisplayAccess()
    {
        $cid = intval($this->contest['contest_id']);
        if ($this->hasContestLiveConsoleAccess()) {
            $this->liveDisplayGranted = true;
            return;
        }
        $lvtk = input('lvtk/s', '');
        if ($lvtk !== '' && ContestliveDisplayAccess::validateToken($cid, $lvtk)) {
            $this->liveDisplayGranted = true;
            return;
        }
    }

    protected function requireLiveDisplayAccess()
    {
        if (!$this->liveDisplayGranted) {
            $this->error('无访问权限', null, '', 1);
        }
    }

    public function index()
    {
        $this->assign('pagetitle', 'Contest List');
        $this->assign('contest_controller', 'contestlive');
        $this->assign('module', 'contest');
        return $this->fetch();
    }

    public function live()
    {
        $this->requireLiveDisplayAccess();
        $this->assignLiveDisplayBasics();
        $this->assign('live_clock_ts', [
            'start_ms' => intval(strtotime($this->contest['start_time'])) * 1000,
            'end_ms' => intval(strtotime($this->contest['end_time'])) * 1000,
            'now_ms' => intval(microtime(true) * 1000),
        ]);
        $man = $this->buildBrandingManifestPayload();
        $this->assign('live_branding_manifest', $man);
        $this->assign('live_brand_public_base', $this->contestLivePublicBaseUrl());
        $this->assign('live_branding_manifest_json', json_encode($man, JSON_UNESCAPED_UNICODE | JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT));
        $this->assign('pagetitle', $this->contest['title'] . ' · 直播画面');
        $this->assign('pagetitle_en', 'Live display');
        $this->assign('oj_results_live', config('CsgojConfig.OJ_RESULTS'));
        $this->assignLiveHudTitleFromContest();
        $hudSub = trim(input('hud_subtitle/s', ''));
        if (strlen($hudSub) > 200) {
            $hudSub = function_exists('mb_substr') ? mb_substr($hudSub, 0, 200) : substr($hudSub, 0, 200);
        }
        $this->assign('live_hud_subtitle', $hudSub);
        $foot = trim(input('hud_footer/s', ''));
        if (strlen($foot) > 400) {
            $foot = function_exists('mb_substr') ? mb_substr($foot, 0, 400) : substr($foot, 0, 400);
        }
        $this->assign('live_hud_footer_static', $foot);
        $this->assignRankLivePageVars();
        return $this->fetch();
    }

    public function live_queue()
    {
        $this->requireLiveDisplayAccess();
        $this->assignLiveDisplayBasics();
        $this->assignRankLivePageVars();
        $this->assignLiveHudTitleFromContest();
        $this->assign('oj_results_live', config('CsgojConfig.OJ_RESULTS'));
        $this->assign('pagetitle', $this->contest['title'] . ' · Live queue');
        $this->assign('pagetitle_en', 'Judge queue');
        return $this->fetch('contestlive/live_queue');
    }

    public function live_rank()
    {
        $this->requireLiveDisplayAccess();
        $this->assignLiveDisplayBasics();
        $this->assignRankLivePageVars();
        $this->assign('live_clock_ts', [
            'start_ms' => intval(strtotime($this->contest['start_time'])) * 1000,
            'end_ms' => intval(strtotime($this->contest['end_time'])) * 1000,
            'now_ms' => intval(microtime(true) * 1000),
        ]);
        $this->assign('pagetitle', $this->contest['title'] . ' · Live scoreboard');
        $this->assign('pagetitle_en', 'Scoreboard');
        return $this->fetch('contestlive/live_rank');
    }

    public function live_timer()
    {
        $this->requireLiveDisplayAccess();
        $this->assignLiveDisplayBasics();
        $this->assign('live_clock_ts', [
            'start_ms' => intval(strtotime($this->contest['start_time'])) * 1000,
            'end_ms' => intval(strtotime($this->contest['end_time'])) * 1000,
            'now_ms' => intval(microtime(true) * 1000),
        ]);
        $this->assign('pagetitle', $this->contest['title'] . ' · 比赛计时');
        $this->assign('pagetitle_en', 'Contest timer');
        return $this->fetch('contestlive/live_timer');
    }

    public function live_ac()
    {
        $this->requireLiveDisplayAccess();
        $this->assignLiveDisplayBasics();
        $this->assignRankLivePageVars();
        $this->assignLiveHudTitleFromContest();
        $this->assign('oj_results_live', config('CsgojConfig.OJ_RESULTS'));
        $this->assign('pagetitle', $this->contest['title'] . ' · 最新过题');
        $this->assign('pagetitle_en', 'Recent AC');
        return $this->fetch('contestlive/live_ac');
    }

    /**
     * 评测队列 + 最新过题 + 气球叠层（单页）；快捷键与综合 HUD 数字键对齐（5 / 6 / 7）。
     */
    public function live_combo()
    {
        $this->requireLiveDisplayAccess();
        $this->assignLiveDisplayBasics();
        $this->assignRankLivePageVars();
        $this->assign('oj_results_live', config('CsgojConfig.OJ_RESULTS'));
        $this->assign('pagetitle', $this->contest['title'] . ' · 队列·过题·气球');
        $this->assign('pagetitle_en', 'Queue · AC · balloons');
        return $this->fetch('contestlive/live_combo');
    }

    public function live_probstats()
    {
        $this->requireLiveDisplayAccess();
        $this->assignLiveDisplayBasics();
        $this->assignLiveHudTitleFromContest();
        $this->assign('oj_results_live', config('CsgojConfig.OJ_RESULTS'));
        $this->assign('pagetitle', $this->contest['title'] . ' · 各题统计');
        $this->assign('pagetitle_en', 'Verdicts by problem');
        return $this->fetch('contestlive/live_probstats');
    }

    public function live_balloon()
    {
        $this->requireLiveDisplayAccess();
        $this->assignLiveDisplayBasics();
        $this->assign('pagetitle', $this->contest['title'] . ' · Balloons');
        $this->assign('pagetitle_en', 'Balloons');
        return $this->fetch('contestlive/live_balloon');
    }

    public function live_schoolwall()
    {
        $this->requireLiveDisplayAccess();
        $this->assignLiveDisplayBasics();
        $this->assign('school_wall_schools', $this->buildSchoolWallSchools());
        $this->assign('pagetitle', $this->contest['title'] . ' · School wall');
        $this->assign('pagetitle_en', 'School badges');
        return $this->fetch('contestlive/live_schoolwall');
    }

    public function live_clock()
    {
        $cid = input('cid/d', 0);
        $q = 'cid=' . intval($cid);
        if (input('?lvtk')) {
            $q .= '&lvtk=' . rawurlencode(input('lvtk/s', ''));
        }
        $this->redirect('/ojtool/contestlive/live_timer?' . $q);
    }

    public function live_brand()
    {
        $this->redirect('/ojtool/contestlive/live?cid=' . input('cid/d'));
    }

    public function ctrl()
    {
        $contestType = intval($this->contest['private']) % 10;
        $targetModule = $this->ResolveContestTargetModule($contestType);
        $this->redirect('/' . $targetModule . '/contest/contest_live?cid=' . $this->contest['contest_id']);
    }

    public function live_command_get_ajax()
    {
        $this->requireLiveDisplayAccess();
        $live_command_list = $this->OldLiveCommanClear(true);
        $now = time();
        $fresh = self::LIVE_COMMAND_HUD_FRESH_SEC;
        $annotated = [];
        foreach ($live_command_list as $row) {
            if (!is_array($row)) {
                continue;
            }
            $ts = isset($row['timestamp']) ? intval($row['timestamp']) : 0;
            unset($row['is_expired']);
            $row['is_expired'] = ($now - $ts) > $fresh;
            $annotated[] = $row;
        }
        $cfg = ContestliveDisplayAddition::normalizeFromAddition($this->contest['addition'] ?? null);
        $this->success('msg', null, [
            'commands' => array_reverse($annotated),
            'ticker_fixed' => ContestliveDisplayAddition::tickerFixedPlainOneLine($cfg['ticker_fixed'] ?? ''),
        ]);
    }

    public function live_command_send_ajax()
    {
        $live_command = input('live_command/s');
        if ($live_command === null) {
            $this->error('need parameter live command');
        } else if (strlen($live_command) > 2048) {
            $this->error('live command too long');
        }
        $timestamp = time();
        $live_command_list = $this->OldLiveCommanClear(false);
        try {
            $id = bin2hex(random_bytes(8));
        } catch (\Throwable $e) {
            $id = sha1((string) $timestamp . '|' . mt_rand());
        }
        $live_command_list[] = [
            'id' => $id,
            'timestamp' => $timestamp,
            'live_command' => $live_command,
            'status' => 'active',
        ];
        $this->SaveLiveCache($live_command_list);
        $this->success('ok');
    }

    /**
     * 将一条底栏推送标记为撤回（投屏端不再展示；可继续发新推送）
     */
    public function live_command_revoke_ajax()
    {
        $commandId = trim((string) input('command_id/s', ''));
        if ($commandId === '') {
            $this->error('need command_id');
        }
        $live_command_list = $this->OldLiveCommanClear(false);
        $found = false;
        foreach ($live_command_list as $idx => $row) {
            if (!is_array($row)) {
                continue;
            }
            $rid = isset($row['id']) ? (string) $row['id'] : '';
            if ($rid !== '' && $rid === $commandId) {
                $live_command_list[$idx]['status'] = 'revoked';
                $found = true;
                break;
            }
        }
        if (!$found) {
            $this->error('not found');
        }
        $this->SaveLiveCache($live_command_list);
        $this->success('ok');
    }

    /**
     * 签发/轮换免登录投屏令牌（单比赛仅保留一条活跃令牌；重新签发即废前任）
     */
    public function display_token_issue_ajax()
    {
        $cid = intval($this->contest['contest_id']);
        $ttlHours = min(720, max(1, intval(input('ttl_hours/d', 6))));
        $token = ContestliveDisplayAccess::generateOpaqueToken();
        $expires_at = time() + $ttlHours * 3600;
        ContestliveDisplayAccess::storeTokenForContest($cid, $token, $expires_at);
        $origin = rtrim(Request::instance()->domain(), '/');
        $tk = rawurlencode($token);
        $pages = [
            'live',
            'live_balloon',
            'live_schoolwall',
            'live_timer',
            'live_queue',
            'live_ac',
            'live_combo',
            'live_probstats',
            'live_rank',
        ];
        $example_pages = [];
        foreach ($pages as $p) {
            $example_pages[$p] = $origin . '/ojtool/contestlive/' . $p . '?cid=' . $cid . '&lvtk=' . $tk;
        }
        $this->success('ok', null, [
            'lvtk' => $token,
            'expires_at' => $expires_at,
            'example_url' => $example_pages['live'] ?? ($origin . '/ojtool/contestlive/live?cid=' . $cid . '&lvtk=' . $tk),
            'example_pages' => $example_pages,
        ]);
    }

    /**
     * 撤销该场所有已签发投屏令牌（使已复制链接全部立即失效）
     */
    public function display_token_revoke_ajax()
    {
        $cid = intval($this->contest['contest_id']);
        ContestliveDisplayAccess::clearTokenForContest($cid);
        $this->success('ok', null, ['revoked' => true]);
    }

    /**
     * 投屏端 / 控台读取 live_display（皮肤、HUD 标题等），存于 contest.addition
     */
    public function live_display_config_get_ajax()
    {
        $this->requireLiveDisplayAccess();
        $cfg = ContestliveDisplayAddition::normalizeFromAddition($this->contest['addition'] ?? null);
        $this->success('ok', null, $cfg);
    }

    /**
     * 直播控制台写入 live_display（仅管理员 / contest 权限 / watcher）
     */
    public function live_display_config_save_ajax()
    {
        if (!$this->canManageLiveConsole()) {
            $this->error('无访问权限', null, '', 1);
        }
        $this->assertContestNotArchivedForWrite();
        $cid = intval($this->contest['contest_id']);
        $op = trim((string) input('op/s', ''));
        $row = db('contest')->where('contest_id', $cid)->field(['contest_id', 'addition'])->find();
        if (!$row) {
            $this->error('比赛不存在', null, '', 1);
        }
        $addStr = $row['addition'] ?? null;
        if ($op === 'batch_skin') {
            $skin = ContestliveDisplayAddition::pickValidSkin(input('skin/s', ''));
            if ($skin === '') {
                $skin = 'default';
            }
            $newJson = ContestliveDisplayAddition::mergeLiveDisplayIntoAdditionJson($addStr, [
                'skin_global' => $skin,
                'skin_pages' => [],
            ]);
        } elseif ($op === 'page_skin') {
            $page = (string) input('page/s', '');
            if (!in_array($page, ContestliveDisplayAddition::PAGE_IDS, true)) {
                $this->error('bad page', null, '', 1);
            }
            $skin = trim((string) input('skin/s', ''));
            $newJson = ContestliveDisplayAddition::mergeLiveDisplayIntoAdditionJson($addStr, [
                'skin_pages' => [$page => $skin],
            ]);
        } elseif ($op === 'hud_title') {
            $t = input('hud_title/s', '');
            $newJson = ContestliveDisplayAddition::mergeLiveDisplayIntoAdditionJson($addStr, [
                'hud_title' => $t,
            ]);
        } elseif ($op === 'schoolwall_layout') {
            $sw = ContestliveDisplayAddition::pickValidSchoolwallLayout(input('schoolwall_layout/s', ''));
            if ($sw === '') {
                $sw = 'grid';
            }
            $newJson = ContestliveDisplayAddition::mergeLiveDisplayIntoAdditionJson($addStr, [
                'schoolwall_layout' => $sw,
            ]);
        } elseif ($op === 'ticker_fixed') {
            $tf = input('ticker_fixed/s', '');
            $newJson = ContestliveDisplayAddition::mergeLiveDisplayIntoAdditionJson($addStr, [
                'ticker_fixed' => $tf,
            ]);
        } else {
            $this->error('bad op', null, '', 1);
        }
        $upd = db('contest')->where('contest_id', $cid)->update(['addition' => $newJson]);
        if ($upd === false) {
            $this->error('保存失败', null, '', 1);
        }
        $this->contest['addition'] = $newJson;
        $out = ContestliveDisplayAddition::normalizeFromAddition($newJson);
        $this->success('ok', null, ['live_display' => $out]);
    }

    /**
     * 投屏端拉取左上角徽标清单（含令牌请求）
     */
    public function live_branding_manifest_ajax()
    {
        $this->requireLiveDisplayAccess();
        $this->success('ok', null, $this->buildBrandingManifestPayload());
    }

    public function live_logo_upload_ajax()
    {
        $this->assertContestNotArchivedForWrite();
        $ens = ContestAttachFile::ensureContestAttachRecord($this->contest);
        if (!$ens['ok']) {
            $this->error($ens['err'] !== '' ? $ens['err'] : '无法分配比赛附件目录');
        }
        $resolved = ContestAttachFile::resolveDir($this->contest);
        if (!$resolved['ok']) {
            $this->error($resolved['err'] !== '' ? $resolved['err'] : '比赛附件目录不可用');
        }
        if (!\MakeDirs(rtrim($resolved['disk_dir'], '/\\') . '/live')) {
            $this->error('path error');
        }
        $file = Request::file('file');
        if ($file === null) {
            $this->error('no file');
        }
        $ext = strtolower(pathinfo((string) $file->getInfo('name'), PATHINFO_EXTENSION));
        $allowed = ['webp', 'svg', 'png', 'jpg', 'jpeg'];
        if (!in_array($ext, $allowed, true)) {
            $this->error('unsupported type');
        }
        $maxBytes = 3 * 1024 * 1024;
        $info = $file->getInfo();
        if (!empty($info['size']) && $info['size'] > $maxBytes) {
            $this->error('file too large');
        }
        $tmp = $file->getRealPath();
        if (!is_file($tmp)) {
            $this->error('Upload failed');
        }
        $raw = file_get_contents($tmp);
        if ($raw === false) {
            $this->error('Upload failed');
        }
        $manifest = $this->readBrandingManifestFromDisk();
        $dims = $this->hydrateLogoDimensionsFromDisk($manifest['logos'] ?? []);
        $newWh = ContestliveBrandingLayout::readImageDimensions($tmp);
        $fit = ContestliveBrandingLayout::fitsWithAdditional($dims, $newWh['w'], $newWh['h']);
        if (!$fit['ok']) {
            $this->error('徽标区横向容量已满（左栏固定宽度、单行或半高双行），请删除或更换较窄的徽标后再试。');
        }
        $safe = 'logo_' . date('YmdHis') . '_' . bin2hex(random_bytes(4));
        $basename = $safe . '.' . $ext;
        $written = ContestAttachFile::writeRel(
            $this->contest,
            'live/' . $basename,
            (string) $raw,
            $maxBytes,
            null
        );
        if (!$written['ok']) {
            $this->error($written['err']);
        }
        $manifest['logos'][] = [
            'f' => $basename,
            'w' => $newWh['w'],
            'h' => $newWh['h'],
        ];
        $this->saveBrandingManifest($manifest);
        $this->success('ok', null, [
            'url' => $written['web_url'],
            'manifest' => $this->buildBrandingManifestPayload(),
            'brand_base' => $this->contestLivePublicBaseUrl(),
        ]);
    }

    /**
     * 覆盖已有徽标文件（basename 不变），扩展名须与原文件一致。
     */
    public function live_logo_replace_ajax()
    {
        $this->assertContestNotArchivedForWrite();
        $ens = ContestAttachFile::ensureContestAttachRecord($this->contest);
        if (!$ens['ok']) {
            $this->error($ens['err'] !== '' ? $ens['err'] : '无法分配比赛附件目录');
        }
        $resolved = ContestAttachFile::resolveDir($this->contest);
        if (!$resolved['ok']) {
            $this->error($resolved['err'] !== '' ? $resolved['err'] : '比赛附件目录不可用');
        }
        if (!\MakeDirs(rtrim($resolved['disk_dir'], '/\\') . '/live')) {
            $this->error('path error');
        }
        $replace = basename((string) input('replace/s', ''));
        if ($replace === '' || strpos($replace, '..') !== false) {
            $this->error('bad replace');
        }
        $manifest = $this->readBrandingManifestFromDisk();
        $logos = isset($manifest['logos']) && is_array($manifest['logos']) ? $manifest['logos'] : [];
        $idx = -1;
        foreach ($logos as $i => $row) {
            if (is_array($row) && isset($row['f']) && (string) $row['f'] === $replace) {
                $idx = $i;
                break;
            }
        }
        if ($idx < 0) {
            $this->error('目标徽标不存在');
        }
        $file = Request::file('file');
        if ($file === null) {
            $this->error('no file');
        }
        $ext = strtolower(pathinfo((string) $file->getInfo('name'), PATHINFO_EXTENSION));
        $allowed = ['webp', 'svg', 'png', 'jpg', 'jpeg'];
        if (!in_array($ext, $allowed, true)) {
            $this->error('unsupported type');
        }
        $oldExt = strtolower(pathinfo($replace, PATHINFO_EXTENSION));
        if ($oldExt !== $ext) {
            $this->error('扩展名须与原徽标文件一致');
        }
        $maxBytes = 3 * 1024 * 1024;
        $info = $file->getInfo();
        if (!empty($info['size']) && $info['size'] > $maxBytes) {
            $this->error('file too large');
        }
        $tmp = $file->getRealPath();
        if (!is_file($tmp)) {
            $this->error('Upload failed');
        }
        $raw = file_get_contents($tmp);
        if ($raw === false) {
            $this->error('Upload failed');
        }
        $newWh = ContestliveBrandingLayout::readImageDimensions($tmp);
        $dims = $this->hydrateLogoDimensionsFromDisk($logos);
        $dims[$idx] = ['w' => $newWh['w'], 'h' => $newWh['h']];
        $fit = ContestliveBrandingLayout::fitsInHud($dims);
        if (!$fit['ok']) {
            $this->error('替换后徽标区超出容量，请换较窄的图片或先删除其它徽标。');
        }
        $written = ContestAttachFile::writeRel(
            $this->contest,
            'live/' . $replace,
            (string) $raw,
            $maxBytes,
            null
        );
        if (!$written['ok']) {
            $this->error($written['err']);
        }
        $logos[$idx]['w'] = $newWh['w'];
        $logos[$idx]['h'] = $newWh['h'];
        $logos[$idx]['f'] = $replace;
        $manifest['logos'] = array_values($logos);
        $this->saveBrandingManifest($manifest);
        $this->success('ok', null, [
            'url' => $written['web_url'],
            'manifest' => $this->buildBrandingManifestPayload(),
            'brand_base' => $this->contestLivePublicBaseUrl(),
        ]);
    }

    /**
     * POST order：JSON 数组，元素为 manifest 中已有文件名的全排列。
     */
    public function live_logo_reorder_ajax()
    {
        $this->assertContestNotArchivedForWrite();
        $orderRaw = input('order/s', '');
        $order = json_decode($orderRaw, true);
        if (!is_array($order)) {
            $this->error('bad order');
        }
        $manifest = $this->readBrandingManifestFromDisk();
        $logos = isset($manifest['logos']) && is_array($manifest['logos']) ? $manifest['logos'] : [];
        $byName = [];
        foreach ($logos as $row) {
            if (!is_array($row) || empty($row['f'])) {
                continue;
            }
            $f = basename((string) $row['f']);
            if ($f === '' || strpos($f, '..') !== false) {
                continue;
            }
            $byName[$f] = $row;
        }
        $want = [];
        foreach ($order as $name) {
            $n = basename((string) $name);
            if ($n === '' || strpos($n, '..') !== false) {
                $this->error('bad name in order');
            }
            if (!isset($byName[$n])) {
                $this->error('order 与当前清单不一致');
            }
            $want[] = $byName[$n];
            unset($byName[$n]);
        }
        if (count($want) !== count($logos) || count($byName) > 0) {
            $this->error('order 须包含全部徽标且仅出现一次');
        }
        $manifest['logos'] = $want;
        $this->saveBrandingManifest($manifest);
        $this->success('ok', null, ['manifest' => $this->buildBrandingManifestPayload()]);
    }

    public function live_logo_delete_ajax()
    {
        $this->assertContestNotArchivedForWrite();
        $name = basename((string) input('name/s', ''));
        if ($name === '' || strpos($name, '..') !== false) {
            $this->error('bad name');
        }
        $r = ContestAttachFile::deleteRel($this->contest, 'live/' . $name);
        if (!$r['ok']) {
            $this->error($r['err']);
        }
        if (!$r['removed']) {
            $this->error('not found');
        }
        $manifest = $this->readBrandingManifestFromDisk();
        $manifest['logos'] = array_values(array_filter($manifest['logos'], function ($row) use ($name) {
            return isset($row['f']) && (string) $row['f'] !== $name;
        }));
        $this->saveBrandingManifest($manifest);
        $this->success('ok', null, ['manifest' => $this->buildBrandingManifestPayload()]);
    }

    protected function assignLiveDisplayBasics()
    {
        $contestType = intval($this->contest['private']) % 10;
        $this->assign('live_data_module', $this->ResolveContestTargetModule($contestType));
        $lvtk = input('lvtk/s', '');
        $this->assign('live_lvtk', $lvtk);
        $cfg = ContestliveDisplayAddition::normalizeFromAddition($this->contest['addition'] ?? null);
        $this->assign('live_display_config_json', json_encode($cfg, JSON_UNESCAPED_UNICODE | JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT));
    }

    /**
     * 综合 HUD / 独立投屏顶栏标题：URL ?hud_title= 优先，否则 contest addition，否则赛事标题。
     */
    protected function assignLiveHudTitleFromContest()
    {
        $hudTitle = trim(input('hud_title/s', ''));
        if ($hudTitle === '') {
            $ld = ContestliveDisplayAddition::normalizeFromAddition($this->contest['addition'] ?? null);
            $hudTitle = trim((string) ($ld['hud_title'] ?? ''));
        }
        if (strlen($hudTitle) > 160) {
            $hudTitle = function_exists('mb_substr') ? mb_substr($hudTitle, 0, 160) : substr($hudTitle, 0, 160);
        }
        $this->assign(
            'live_hud_title',
            $hudTitle !== '' ? $hudTitle : (string) ($this->contest['title'] ?? '')
        );
    }

    /**
     * 直播专用榜单（RankLiveSystem）：与标准 rank 页共享 rank.js 数据逻辑，独立 DOM/CSS
     */
    protected function assignRankLivePageVars()
    {
        $dm = isset($this->contest['private'])
            ? $this->ResolveContestTargetModule(intval($this->contest['private']) % 10)
            : 'cpcsys';
        $attach = isset($this->contest['attach']) ? trim((string) $this->contest['attach']) : '';
        $attachSeg = ($attach !== '' && $attach !== '-') ? $attach : '';
        $lvtk = trim((string) input('lvtk/s', ''));
        $this->assign('rank_contest_data_api_url', '/' . $dm . '/contest/contest_data_ajax');
        $this->assign('rank_team_photo_url', '/upload/contest_attach/' . $attachSeg . '/team_photo');
        $this->assign('rank_lvtk_json', json_encode($lvtk, JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT | JSON_UNESCAPED_UNICODE));
        $this->assign('rank_backend_time_diff', 0);
        $this->assign('rank_live_flg_cache', true);
        $this->assign('rank_account_link_json', json_encode([
            'module' => $dm,
            'contest_id' => (string) ($this->contest['contest_id'] ?? ''),
            'contest_type' => (int) (intval($this->contest['private'] ?? 0) % 10),
        ], JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT | JSON_UNESCAPED_SLASHES));
    }

    /**
     * 投屏徽标文件 Web 根路径（比赛 attach 下 live 子目录），与 ContestAttachFile::resolveDir 一致。
     */
    protected function contestLivePublicBaseUrl()
    {
        $r = ContestAttachFile::resolveDir($this->contest);
        if (!$r['ok']) {
            return '';
        }
        $w = trim(str_replace('\\', '/', (string) $r['web_dir']), '/');
        return '/' . $w . '/live';
    }

    protected function brandingManifestPath()
    {
        $r = ContestAttachFile::resolveDir($this->contest);
        if (!$r['ok']) {
            return null;
        }
        return $r['disk_dir'] . 'live/branding_manifest.json';
    }

    /**
     * 从磁盘读取 branding_manifest.json（不含 layout 派生字段）。
     *
     * @return array{logos: array<int, array<string, mixed>>}
     */
    protected function readBrandingManifestFromDisk()
    {
        $p = $this->brandingManifestPath();
        $default = ['logos' => []];
        if ($p === null || !is_file($p)) {
            return $default;
        }
        $raw = @file_get_contents($p);
        $j = json_decode($raw ?: '[]', true);
        if (!is_array($j) || !isset($j['logos']) || !is_array($j['logos'])) {
            return $default;
        }
        unset($j['layout']);

        return $j;
    }

    /**
     * 供投屏页 / 控台 / Ajax：仅徽标清单（f、w、h）。**紧凑/换行等布局由前端 `contestlive_brand_layout.js` 根据本数组计算**。
     *
     * @return array{logos: array<int, array{f: string, w: int, h: int}>}
     */
    protected function buildBrandingManifestPayload()
    {
        $raw = $this->readBrandingManifestFromDisk();

        return $this->hydrateBrandingManifestLogos($raw);
    }

    /**
     * @param array{logos?: array<int, mixed>} $manifest
     * @return array{logos: array<int, array{f: string, w: int, h: int}>}
     */
    protected function hydrateBrandingManifestLogos(array $manifest)
    {
        $logosIn = isset($manifest['logos']) && is_array($manifest['logos']) ? $manifest['logos'] : [];
        $resolved = ContestAttachFile::resolveDir($this->contest);
        $outLogos = [];
        if ($resolved['ok']) {
            $base = rtrim($resolved['disk_dir'], '/\\') . '/live/';
            foreach ($logosIn as $row) {
                if (!is_array($row) || empty($row['f'])) {
                    continue;
                }
                $f = basename((string) $row['f']);
                if ($f === '' || strpos($f, '..') !== false) {
                    continue;
                }
                $path = $base . $f;
                if (is_file($path)) {
                    $wh = ContestliveBrandingLayout::readImageDimensions($path);
                } else {
                    $jw = intval($row['w'] ?? 0);
                    $jh = intval($row['h'] ?? 0);
                    $wh = ['w' => $jw > 0 ? $jw : 200, 'h' => $jh > 0 ? $jh : 40];
                }
                $outLogos[] = ['f' => $f, 'w' => $wh['w'], 'h' => $wh['h']];
            }
        }

        return ['logos' => $outLogos];
    }

    /**
     * @param array<int, mixed> $logosRows
     * @return array<int, array{w: int, h: int}>
     */
    protected function hydrateLogoDimensionsFromDisk(array $logosRows)
    {
        $resolved = ContestAttachFile::resolveDir($this->contest);
        $dims = [];
        if (!$resolved['ok']) {
            return $dims;
        }
        $base = rtrim($resolved['disk_dir'], '/\\') . '/live/';
        foreach ($logosRows as $row) {
            if (!is_array($row) || empty($row['f'])) {
                continue;
            }
            $f = basename((string) $row['f']);
            if ($f === '' || strpos($f, '..') !== false) {
                continue;
            }
            $path = $base . $f;
            if (is_file($path)) {
                $dims[] = ContestliveBrandingLayout::readImageDimensions($path);
            } else {
                $jw = intval($row['w'] ?? 0);
                $jh = intval($row['h'] ?? 0);
                $dims[] = ['w' => $jw > 0 ? $jw : 200, 'h' => $jh > 0 ? $jh : 40];
            }
        }

        return $dims;
    }

    protected function saveBrandingManifest(array $manifest)
    {
        $p = $this->brandingManifestPath();
        if ($p === null) {
            return;
        }
        $d = dirname($p);
        if (!\MakeDirs($d)) {
            return;
        }
        unset($manifest['layout']);
        $logos = isset($manifest['logos']) && is_array($manifest['logos']) ? $manifest['logos'] : [];
        $clean = [];
        foreach ($logos as $row) {
            if (!is_array($row) || empty($row['f'])) {
                continue;
            }
            $f = basename((string) $row['f']);
            if ($f === '' || strpos($f, '..') !== false) {
                continue;
            }
            $clean[] = [
                'f' => $f,
                'w' => max(0, intval($row['w'] ?? 0)),
                'h' => max(0, intval($row['h'] ?? 0)),
            ];
        }
        file_put_contents($p, json_encode(['logos' => $clean], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));
    }

    /**
     * 校徽墙：校名来自本场 cpc_team（打星排除 tkind=2、privilege 空），不按是否提交筛选。
     * 校徽文件是否存在由前端按 rank.js 同源路径 `/static/image/school_badge/{encodeURIComponent(校名)}.webp` 拉取并配合 IndexedDB 缓存判定。
     *
     * @return string[]
     */
    protected function buildSchoolWallSchools()
    {
        $cid = intval($this->contest['contest_id']);
        $ctype = intval($this->contest['private']) % 10;
        $dm = $this->ResolveContestTargetModule($ctype);
        $schools = [];
        if (in_array($dm, ['cpcsys', 'examsys'], true)) {
            $rows = db('cpc_team')
                ->where('contest_id', $cid)
                ->where(function ($q) {
                    $q->whereNull('tkind')->whereOr('tkind', '<>', 2);
                })
                ->where(function ($q) {
                    $q->whereNull('privilege')->whereOr('privilege', '');
                })
                ->column('school');
            foreach ($rows as $s) {
                $s = trim((string) $s);
                if ($s !== '') {
                    $schools[] = $s;
                }
            }
        } else {
            $teams = db('solution')->alias('s')
                ->join('users u', 'u.user_id = s.user_id', 'left')
                ->where(['contest_id' => $cid])
                ->group('s.user_id,u.nick,u.school,u.email')
                ->field(['u.school school'])
                ->select();
            foreach ($teams as $team) {
                $schools[] = isset($team['school']) ? trim((string) $team['school']) : '';
            }
        }
        $seen = [];
        $uniq = [];
        foreach ($schools as $school) {
            if ($school === '' || isset($seen[$school])) {
                continue;
            }
            $seen[$school] = true;
            $uniq[] = $school;
        }
        sort($uniq, SORT_STRING);

        return $uniq;
    }

    protected function OldLiveCommanClear($save = false)
    {
        $cache_name = 'live_command_' . $this->contest['contest_id'];
        $live_commond_list = cache($cache_name);
        if ($live_commond_list === null) {
            $live_commond_list = [];
        } else if (!is_array($live_commond_list)) {
            $live_commond_list = [];
        }
        foreach ($live_commond_list as $idx => &$row) {
            if (!is_array($row)) {
                continue;
            }
            unset($row['is_expired']);
            if (!isset($row['status']) || $row['status'] === '') {
                $row['status'] = 'active';
            }
            if (!isset($row['id']) || (string) $row['id'] === '') {
                $row['id'] = 'm_' . (isset($row['timestamp']) ? (string) $row['timestamp'] : '0') . '_' . $idx;
            }
        }
        unset($row);
        $live_commond_list = array_values($live_commond_list);
        $n = count($live_commond_list);
        if ($n > self::LIVE_COMMAND_LIST_MAX) {
            $live_commond_list = array_slice($live_commond_list, -self::LIVE_COMMAND_LIST_MAX);
            $live_commond_list = array_values($live_commond_list);
        }
        if ($save) {
            $this->SaveLiveCache($live_commond_list);
        }
        return $live_commond_list;
    }

    protected function SaveLiveCache($live_command_list)
    {
        $cache_name = 'live_command_' . $this->contest['contest_id'];
        if (!is_array($live_command_list)) {
            $live_command_list = [];
        }
        $n = count($live_command_list);
        if ($n > self::LIVE_COMMAND_LIST_MAX) {
            $live_command_list = array_slice($live_command_list, -self::LIVE_COMMAND_LIST_MAX);
            $live_command_list = array_values($live_command_list);
        }
        cache($cache_name, $live_command_list, self::LIVE_COMMAND_CACHE_TTL_SEC);
    }
}
