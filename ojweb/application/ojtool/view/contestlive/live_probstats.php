{__NOLAYOUT__}
<!DOCTYPE html>
<html lang="zh-CN" class="contestlive-spa-html contestlive-page-opacity">
{include file="../../csgoj/view/public/global_head" /}
<link rel="stylesheet" href="__STATIC__/cpcsys/contestlive/css/contestlive.css" />
<body class="contestlive-display contestlive-display--hud contestlive-display--probstats-only contestlive-hero-hidden">
<script>window.CONTEST_LIVE_DISPLAY_CONFIG={$live_display_config_json|raw};</script>
{js href="__STATIC__/cpcsys/contestlive/js/contestlive_skin_common.js" /}
<script id="contestlive-skin-boot" data-contestlive-page="live_probstats" src="__STATIC__/cpcsys/contestlive/js/contestlive_skin_boot.js"></script>
<link rel="stylesheet" href="__STATIC__/cpcsys/contestlive/css/contestlive_skin.css" />
<link rel="stylesheet" href="__STATIC__/cpcsys/contestlive/css/contestlive_page_opacity.css" />
<div id="contestlive_display_root" class="contestlive-probstats-page">
    <header class="contestlive-queue-hero contestlive-standalone-hero contestlive-probstats-page__hero" aria-label="比赛信息">
        <div class="contestlive-queue-hero__accent" aria-hidden="true"></div>
        <div class="contestlive-queue-hero__inner">
            <div class="contestlive-queue-hero__titles">
                <span class="contestlive-queue-hero__badge"><span class="cn-text">投屏 · 各题评测结果统计</span><span class="en-text"> · Verdicts by problem</span></span>
                <h1 class="contestlive-queue-hero__title">
                    <span id="contestlive_standalone_title_slot" class="contestlive-hud-title-slot csg-mq-slot--twoline" data-csg-mq-plain="{$live_hud_title}"><span class="csg-mq-slot__inner">{$live_hud_title}</span></span>
                </h1>
            </div>
            <div class="contestlive-queue-hero__meta">
                <span class="contestlive-queue-hero__cid">#{$contest.contest_id}</span>
            </div>
        </div>
    </header>
    <div class="contestlive-probstats-page__mount contestlive-hud__tablewrap contestlive-hud__tablewrap--prob-stats" tabindex="0">
        <div id="contestlive_prob_stats_mount" class="contestlive-hud-prob-stats-mount"></div>
    </div>
</div>
<script type="text/javascript">
window.CONTEST_LIVE_HUD_BOOT_MODE = 'prob_stats_only';
window.CONTEST_LIVE_PAGE = 'live_probstats';
window.CONTEST_LIVE_CID = parseInt('{$contest.contest_id}', 10);
window.CONTEST_LIVE_DATA_MODULE = "{$live_data_module|default='cpcsys'}";
window.CONTEST_LIVE_LVTK = <?php echo json_encode(isset($live_lvtk) ? (string) $live_lvtk : '', JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT | JSON_UNESCAPED_UNICODE); ?>;
window.OJ_RESULTS_LIVE = <?php echo json_encode(isset($oj_results_live) && is_array($oj_results_live) ? $oj_results_live : [], JSON_UNESCAPED_UNICODE); ?>;
window.CONTEST_LIVE_AC_CODE = 4;
window.CONTEST_LIVE_CONTEST_ROW = <?php echo json_encode([
    'frozen_minute' => intval($contest['frozen_minute'] ?? 0),
    'frozen_after' => intval($contest['frozen_after'] ?? 0),
    'start_time' => $contest['start_time'] ?? '',
    'end_time' => $contest['end_time'] ?? '',
], JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT | JSON_UNESCAPED_UNICODE); ?>;
</script>
{js href="__STATIC__/cpcsys/contestlive/js/contestlive_spa_viewport_scale.js" /}
{js href="__STATIC__/cpcsys/contestlive/js/contestlive_queue_feed.js" /}
{js href="__STATIC__/cpcsys/contestlive/js/contestlive_hud_data.js" /}
{js href="__STATIC__/js/csg_marquee_plain.js" /}
{js href="__STATIC__/cpcsys/contestlive/js/contestlive_page_opacity.js" /}
{js href="__STATIC__/cpcsys/contestlive/js/contestlive_skin_hotkeys.js" /}
{js href="__STATIC__/cpcsys/contestlive/js/contestlive_standalone_chrome_hotkeys.js" /}
</body>
</html>
