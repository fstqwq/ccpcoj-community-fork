{__NOLAYOUT__}
<!DOCTYPE html>
<html lang="zh-CN" class="contestlive-rank-live-html contestlive-spa-html contestlive-page-opacity">
{include file="../../csgoj/view/public/global_head" /}
{include file="contestlive/rank_live_config" /}
{include file="contestlive/rank_live_assets" /}
<link rel="stylesheet" href="__STATIC__/cpcsys/contestlive/css/contestlive.css" />
<body class="contestlive-display contestlive-display--rank contestlive-display--rank-live">
<script>window.CONTEST_LIVE_DISPLAY_CONFIG={$live_display_config_json|raw};</script>
{js href="__STATIC__/cpcsys/contestlive/js/contestlive_skin_common.js" /}
<script id="contestlive-skin-boot" data-contestlive-page="live_rank" src="__STATIC__/cpcsys/contestlive/js/contestlive_skin_boot.js"></script>
<link rel="stylesheet" href="__STATIC__/cpcsys/contestlive/css/contestlive_skin.css" />
<link rel="stylesheet" href="__STATIC__/cpcsys/contestlive/css/contestlive_page_opacity.css" />
<div id="contestlive_rank_timer_host" class="contestlive-rank-timer-host" aria-live="polite">
    <div class="contestlive-rank-timer-host__wall" id="contestlive_rank_timer_wall"></div>
    <div class="contestlive-rank-timer-host__remain" id="contestlive_rank_timer_remain">--:--:--</div>
    <div class="contestlive-rank-timer-host__state" id="contestlive_rank_timer_state"></div>
</div>
<div id="contestlive_rank_live_stage" class="contestlive-rank-live-stage">
    <div id="rank-live-mount" class="rank-live-page-mount"></div>
</div>
<script type="text/javascript">
window.CONTEST_LIVE_PAGE = 'live_rank';
window.CONTEST_LIVE_CID = parseInt('{$contest.contest_id}', 10);
window.CONTEST_LIVE_CLOCK_TS = <?php echo json_encode(isset($live_clock_ts) && is_array($live_clock_ts) ? $live_clock_ts : [], JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT); ?>;
</script>
{js href="__STATIC__/cpcsys/contestlive/js/contestlive_spa_viewport_scale.js" /}
{js href="__STATIC__/cpcsys/contestlive/js/contestlive_contest_timer.js" /}
<script type="text/javascript">
csg.docready(function () {
    if (typeof RankLiveSystemInit === 'function') {
        RankLiveSystemInit('rank-live-mount', {});
    }
    if (window.ContestliveContestTimer && typeof window.ContestliveContestTimer.init === 'function') {
        var ts = window.CONTEST_LIVE_CLOCK_TS || {};
        window.ContestliveContestTimer.init({
            cid: window.CONTEST_LIVE_CID,
            start_ms: ts.start_ms || 0,
            end_ms: ts.end_ms || 0,
            now_ms: ts.now_ms || Date.now(),
            remain_el: document.getElementById('contestlive_rank_timer_remain'),
            state_el: document.getElementById('contestlive_rank_timer_state'),
            wall_el: document.getElementById('contestlive_rank_timer_wall')
        });
    }
});
</script>
{js href="__STATIC__/cpcsys/contestlive/js/contestlive_page_opacity.js" /}
{js href="__STATIC__/cpcsys/contestlive/js/contestlive_skin_hotkeys.js" /}
</body>
</html>
