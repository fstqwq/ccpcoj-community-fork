{__NOLAYOUT__}
<!DOCTYPE html>
<html lang="zh-CN" class="contestlive-spa-html">
{include file="../../csgoj/view/public/global_head" /}
<link rel="stylesheet" href="__STATIC__/cpcsys/contestlive/css/contestlive.css" />
<body class="contestlive-display contestlive-display--hud">
<script>window.CONTEST_LIVE_DISPLAY_CONFIG={$live_display_config_json|raw};</script>
{js href="__STATIC__/cpcsys/contestlive/js/contestlive_skin_common.js" /}
<script id="contestlive-skin-boot" data-contestlive-page="live" src="__STATIC__/cpcsys/contestlive/js/contestlive_skin_boot.js"></script>
<link rel="stylesheet" href="__STATIC__/cpcsys/contestlive/css/contestlive_skin.css" />
<div id="contestlive_display_root" class="contestlive-hud" data-live-hud="1" data-contestlive-hud-opacity-step="1">
    <aside class="contestlive-hud__left" id="contestlive_hud_left">
        <header class="contestlive-hud__masthead" id="contestlive_hud_masthead">
            <div class="contestlive-hud__masthead-row" id="contestlive_hud_masthead_row">
                <div id="contestlive_brand_row" class="contestlive-hud__logos" role="presentation" aria-label="branding"></div>
                <div class="contestlive-hud__titles">
                    <h1 class="contestlive-hud__title cn-text" id="contestlive_hud_title_strip">
                        <span id="contestlive_hud_title_slot" class="contestlive-hud-title-slot csg-mq-slot--twoline" data-csg-mq-plain="{$live_hud_title|default=''}"><span class="csg-mq-slot__inner">{$live_hud_title|default=''}</span></span>
                    </h1>
                    {notempty name="live_hud_subtitle"}
                    <p class="contestlive-hud__subtitle cn-text mb-0">
                        <span id="contestlive_hud_subtitle_slot" class="contestlive-hud-subtitle-slot csg-mq-slot--twoline" data-csg-mq-plain="{$live_hud_subtitle}"><span class="csg-mq-slot__inner">{$live_hud_subtitle}</span></span>
                    </p>
                    {/notempty}
                </div>
            </div>
        </header>
        <section class="contestlive-hud__panel contestlive-hud__panel--queue" id="contestlive_hud_queue_wrap">
            <div class="contestlive-hud__panel-head contestlive-hud__panel-head--bilingual" role="heading" aria-level="2">
                <span class="contestlive-hud__panel-head-cn"><span class="cn-text">评测队列</span></span>
                <span class="contestlive-hud__panel-head-en"><span class="en-text">Queue</span></span>
            </div>
            <div class="contestlive-hud__tablewrap" aria-label="评测队列 · Judge queue">
                <div class="contestlive-hud-queue-surface contestlive-queue-panel">
                    <table class="contestlive-queue-table contestlive-queue-table--standalone contestlive-queue-table--hud-embed contestlive-queue-table--hud-broadcast" id="contestlive_queue_table">
                        <thead>
                            <tr>
                                <th class="col-rnk"><div class="contestlive-th-split-inner contestlive-th-split"><span class="contestlive-th-split__cn">序</span><span class="contestlive-th-split__en">Rank</span></div></th>
                                <th class="col-team"><div class="contestlive-th-split-inner contestlive-th-split"><span class="contestlive-th-split__cn">队伍</span><span class="contestlive-th-split__en">Team</span></div></th>
                                <th class="col-solv"><div class="contestlive-th-split-inner contestlive-th-split"><span class="contestlive-th-split__cn">解</span><span class="contestlive-th-split__en">Σ</span></div></th>
                                <th class="col-pr"><div class="contestlive-th-split-inner contestlive-th-split"><span class="contestlive-th-split__cn">题</span><span class="contestlive-th-split__en">Pr.</span></div></th>
                                <th class="col-res"><div class="contestlive-th-split-inner contestlive-th-split"><span class="contestlive-th-split__cn">结果</span><span class="contestlive-th-split__en">Result</span></div></th>
                            </tr>
                        </thead>
                        <tbody id="contestlive_queue_tbody"></tbody>
                    </table>
                </div>
            </div>
        </section>
        <section class="contestlive-hud__panel contestlive-hud__panel--ac" id="contestlive_hud_ac_wrap">
            <div class="contestlive-hud__panel-head contestlive-hud__panel-head--bilingual" role="heading" aria-level="2">
                <span class="contestlive-hud__panel-head-cn"><span class="cn-text">最新过题</span></span>
                <span class="contestlive-hud__panel-head-en"><span class="en-text">Recent AC</span></span>
            </div>
            <div class="contestlive-hud__tablewrap" aria-label="最新过题 · Recent accepted">
                <div class="contestlive-hud-queue-surface contestlive-queue-panel">
                    <table class="contestlive-queue-table contestlive-queue-table--standalone contestlive-queue-table--hud-embed contestlive-queue-table--hud-broadcast contestlive-queue-table--ac-strip" id="contestlive_ac_table">
                        <thead>
                            <tr>
                                <th class="col-rnk"><div class="contestlive-th-split-inner contestlive-th-split"><span class="contestlive-th-split__cn">序</span><span class="contestlive-th-split__en">Rank</span></div></th>
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
        </section>
        <section class="contestlive-hud__panel contestlive-hud__panel--prob-stats" id="contestlive_hud_prob_stats_wrap" aria-label="各题评测结果统计">
            <div class="contestlive-hud__panel-head contestlive-hud__panel-head--bilingual" role="heading" aria-level="2">
                <span class="contestlive-hud__panel-head-cn"><span class="cn-text">各题评测结果统计</span></span>
                <span class="contestlive-hud__panel-head-en"><span class="en-text">Verdicts by problem</span></span>
            </div>
            <div class="contestlive-hud__tablewrap contestlive-hud__tablewrap--prob-stats" tabindex="0">
                <div id="contestlive_prob_stats_mount" class="contestlive-hud-prob-stats-mount"></div>
            </div>
        </section>
    </aside>
    <div class="contestlive-hud__center-spacer" aria-hidden="true"></div>
    <div class="contestlive-hud__right contestlive-hud__rank-host" id="contestlive_hud_rank_wrap">
        <div id="contestlive_rank_mount" class="rank-live-embed" title="实时榜单 · Live standings"></div>
    </div>
    <footer class="contestlive-hud__bottom" id="contestlive_hud_bottom">
        <div class="contestlive-hud__clock" id="contestlive_clock" aria-live="polite">--:--:--</div>
        <div class="contestlive-hud__ticker" id="contestlive_ticker" aria-label="底栏短消息与固定文案">
            <div class="contestlive-hud__ticker-dual" id="contestlive_ticker_dual">
                <div class="contestlive-hud__ticker-push" aria-live="polite">
                    <div id="contestlive_ticker_inner" class="contestlive-hud__ticker-inner"></div>
                </div>
                <div class="contestlive-hud__ticker-sep" id="contestlive_ticker_sep" aria-hidden="true"></div>
                <div id="contestlive_ticker_fixed" class="contestlive-hud__ticker-fixed-slot" aria-label="固定底栏文案"></div>
            </div>
        </div>
    </footer>
</div>
<script type="text/javascript">
window.CONTEST_LIVE_PAGE = 'live';
window.CONTEST_LIVE_CID = parseInt('{$contest.contest_id}', 10);
window.CONTEST_LIVE_LVTK = <?php echo json_encode(isset($live_lvtk) ? (string) $live_lvtk : '', JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT | JSON_UNESCAPED_UNICODE); ?>;
window.CONTEST_LIVE_BRAND_BASE = <?php echo json_encode(isset($live_brand_public_base) ? (string) $live_brand_public_base : '', JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT | JSON_UNESCAPED_UNICODE); ?>;
window.CONTEST_LIVE_MANIFEST_INIT = <?php echo isset($live_branding_manifest_json) ? $live_branding_manifest_json : '[]'; ?>;
window.CONTEST_LIVE_DATA_MODULE = "{$live_data_module|default='cpcsys'}";
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
{js href="__STATIC__/cpcsys/contestlive/js/contestlive_ticker.js" /}
{js href="__STATIC__/cpcsys/contestlive/js/contestlive_queue_feed.js" /}
{js href="__STATIC__/cpcsys/contestlive/js/contestlive_hud_data.js" /}
{js href="__STATIC__/cpcsys/contestlive/js/contestlive_brand_layout.js" /}
{js href="__STATIC__/cpcsys/contestlive/js/contestlive_display.js" /}
<script type="text/javascript">
csg.docready(function () {
    if (typeof RankLiveSystemInit === 'function') {
        RankLiveSystemInit('contestlive_rank_mount', {});
    }
});
</script>
{js href="__STATIC__/cpcsys/contestlive/js/contestlive_skin_hotkeys.js" /}
</body>
</html>
