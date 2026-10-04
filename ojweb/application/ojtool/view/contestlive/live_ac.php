{__NOLAYOUT__}
<!DOCTYPE html>
<html lang="zh-CN" class="contestlive-spa-html contestlive-page-opacity">
{include file="../../csgoj/view/public/global_head" /}
<link rel="stylesheet" href="__STATIC__/cpcsys/contestlive/css/contestlive.css" />
<body class="contestlive-display contestlive-display--hud contestlive-display--ac-only contestlive-hero-hidden">
<script>window.CONTEST_LIVE_DISPLAY_CONFIG={$live_display_config_json|raw};</script>
{js href="__STATIC__/cpcsys/contestlive/js/contestlive_skin_common.js" /}
<script id="contestlive-skin-boot" data-contestlive-page="live_ac" src="__STATIC__/cpcsys/contestlive/js/contestlive_skin_boot.js"></script>
<link rel="stylesheet" href="__STATIC__/cpcsys/contestlive/css/contestlive_skin.css" />
<link rel="stylesheet" href="__STATIC__/cpcsys/contestlive/css/contestlive_page_opacity.css" />
<div id="contestlive_display_root" class="contestlive-ac-page">
    <header class="contestlive-queue-hero contestlive-standalone-hero contestlive-ac-page__hero" aria-label="比赛信息">
        <div class="contestlive-queue-hero__accent" aria-hidden="true"></div>
        <div class="contestlive-queue-hero__inner">
            <div class="contestlive-queue-hero__titles">
                <span class="contestlive-queue-hero__badge"><span class="cn-text">投屏 · 最新过题</span><span class="en-text"> · Recent AC</span></span>
                <h1 class="contestlive-queue-hero__title">
                    <span id="contestlive_standalone_title_slot" class="contestlive-hud-title-slot csg-mq-slot--twoline" data-csg-mq-plain="{$live_hud_title}"><span class="csg-mq-slot__inner">{$live_hud_title}</span></span>
                </h1>
            </div>
            <div class="contestlive-queue-hero__meta">
                <span class="contestlive-queue-hero__cid">#{$contest.contest_id}</span>
                <span class="contestlive-queue-hero__hint cn-text">首次揭晓 AC</span>
                <span class="contestlive-queue-hero__hint en-text">First revealed AC per team/problem</span>
            </div>
        </div>
    </header>
    <div class="contestlive-ac-page__tablewrap contestlive-queue-panel">
        <div class="contestlive-hud-queue-surface contestlive-queue-panel">
            <table class="contestlive-queue-table contestlive-queue-table--standalone contestlive-queue-table--hud-embed contestlive-queue-table--hud-broadcast contestlive-queue-table--ac-strip" id="contestlive_ac_table">
                <thead>
                    <tr>
                        <th class="col-rnk"><div class="contestlive-th-split-inner contestlive-th-split"><span class="contestlive-th-split__cn">序</span><span class="contestlive-th-split__en">Rnk</span></div></th>
                        <th class="col-team"><div class="contestlive-th-split-inner contestlive-th-split"><span class="contestlive-th-split__cn">队伍</span><span class="contestlive-th-split__en">Team</span></div></th>
                        <th class="col-solv"><div class="contestlive-th-split-inner contestlive-th-split"><span class="contestlive-th-split__cn">解</span><span class="contestlive-th-split__en">Σ</span></div></th>
                        <th class="col-pr"><div class="contestlive-th-split-inner contestlive-th-split"><span class="contestlive-th-split__cn">题</span><span class="contestlive-th-split__en">Pr.</span></div></th>
                        <th class="col-time"><div class="contestlive-th-split-inner contestlive-th-split"><span class="contestlive-th-split__cn">时间</span><span class="contestlive-th-split__en">Time</span></div></th>
                    </tr>
                </thead>
                <tbody id="contestlive_ac_tbody"></tbody>
            </table>
        </div>
    </div>
    <aside id="contestlive_ac_rank_sink" class="contestlive-combo-rank-sink" aria-hidden="true">
        <div id="contestlive_rank_mount" class="rank-live-embed" title=""></div>
    </aside>
</div>
<script type="text/javascript">
window.CONTEST_LIVE_HUD_BOOT_MODE = 'ac_only';
window.CONTEST_LIVE_PAGE = 'live_ac';
window.CONTEST_LIVE_CID = parseInt('{$contest.contest_id}', 10);
window.CONTEST_LIVE_DATA_MODULE = "{$live_data_module|default='cpcsys'}";
window.CONTEST_LIVE_LVTK = <?php echo json_encode(isset($live_lvtk) ? (string) $live_lvtk : '', JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT | JSON_UNESCAPED_UNICODE); ?>;
window.OJ_RESULTS_LIVE = <?php echo json_encode(isset($oj_results_live) && is_array($oj_results_live) ? $oj_results_live : [], JSON_UNESCAPED_UNICODE); ?>;
window.CONTEST_LIVE_AC_CODE = 4;
window.CONTEST_LIVE_START_MS = <?php echo json_encode(intval(strtotime($contest['start_time'] ?? '')) * 1000, JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT); ?>;
window.CONTEST_LIVE_CONTEST_ROW = <?php echo json_encode([
    'frozen_minute' => intval($contest['frozen_minute'] ?? 0),
    'frozen_after' => intval($contest['frozen_after'] ?? 0),
    'start_time' => $contest['start_time'] ?? '',
    'end_time' => $contest['end_time'] ?? '',
], JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT | JSON_UNESCAPED_UNICODE); ?>;
</script>
{js href="__STATIC__/cpcsys/contestlive/js/contestlive_spa_viewport_scale.js" /}
{include file="contestlive/rank_live_config" /}
{include file="contestlive/rank_live_assets" /}
{js href="__STATIC__/cpcsys/contestlive/js/contestlive_queue_feed.js" /}
<script type="text/javascript">
csg.docready(function () {
    if (typeof RankLiveSystemInit === 'function') {
        RankLiveSystemInit('contestlive_rank_mount', {});
    }
});
</script>
{js href="__STATIC__/cpcsys/contestlive/js/contestlive_hud_data.js" /}
{js href="__STATIC__/js/csg_marquee_plain.js" /}
{js href="__STATIC__/cpcsys/contestlive/js/contestlive_page_opacity.js" /}
{js href="__STATIC__/cpcsys/contestlive/js/contestlive_skin_hotkeys.js" /}
{js href="__STATIC__/cpcsys/contestlive/js/contestlive_standalone_chrome_hotkeys.js" /}
</body>
</html>
