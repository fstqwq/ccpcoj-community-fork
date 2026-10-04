{__NOLAYOUT__}
<!DOCTYPE html>
<html lang="zh-CN" class="contestlive-page-opacity">
{include file="../../csgoj/view/public/global_head" /}
<link rel="stylesheet" href="__STATIC__/cpcsys/contestlive/css/contestlive.css" />
<body class="contestlive-display contestlive-display--timer">
<script>window.CONTEST_LIVE_DISPLAY_CONFIG={$live_display_config_json|raw};</script>
{js href="__STATIC__/cpcsys/contestlive/js/contestlive_skin_common.js" /}
<script id="contestlive-skin-boot" data-contestlive-page="live_timer" src="__STATIC__/cpcsys/contestlive/js/contestlive_skin_boot.js"></script>
<link rel="stylesheet" href="__STATIC__/cpcsys/contestlive/css/contestlive_skin.css" />
<link rel="stylesheet" href="__STATIC__/cpcsys/contestlive/css/contestlive_page_opacity.css" />
<div id="contestlive_display_root" class="contestlive-timer-page">
    <div class="contestlive-timer-page__stage" aria-hidden="false">
        <h1 class="contestlive-timer-page__title" id="contestlive_clock_title">{$contest.title}</h1>
        <div class="contestlive-timer-page__remain" id="contestlive_clock_remain" aria-live="polite">--:--:--</div>
        <div class="contestlive-timer-page__state" id="contestlive_clock_state"></div>
    </div>
</div>
<script type="text/javascript">
window.CONTEST_LIVE_PAGE = 'live_timer';
window.CONTEST_LIVE_CID = parseInt('{$contest.contest_id}', 10);
window.CONTEST_LIVE_LVTK = <?php echo json_encode(isset($live_lvtk) ? (string) $live_lvtk : '', JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT | JSON_UNESCAPED_UNICODE); ?>;
window.CONTEST_LIVE_CLOCK_TS = <?php echo json_encode(isset($live_clock_ts) && is_array($live_clock_ts) ? $live_clock_ts : [], JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT); ?>;
</script>
{js href="__STATIC__/cpcsys/contestlive/js/contestlive_contest_timer.js" /}
<script type="text/javascript">
csg.docready(function () {
    if (!window.ContestliveContestTimer || typeof window.ContestliveContestTimer.init !== 'function') {
        return;
    }
    var ts = window.CONTEST_LIVE_CLOCK_TS || {};
    window.ContestliveContestTimer.init({
        cid: window.CONTEST_LIVE_CID,
        start_ms: ts.start_ms || 0,
        end_ms: ts.end_ms || 0,
        now_ms: ts.now_ms || Date.now(),
        remain_el: document.getElementById('contestlive_clock_remain'),
        state_el: document.getElementById('contestlive_clock_state'),
        wall_el: null
    });
});
</script>
{js href="__STATIC__/cpcsys/contestlive/js/contestlive_timer_page_hotkeys.js" /}
{js href="__STATIC__/cpcsys/contestlive/js/contestlive_page_opacity.js" /}
{js href="__STATIC__/cpcsys/contestlive/js/contestlive_skin_hotkeys.js" /}
</body>
</html>
