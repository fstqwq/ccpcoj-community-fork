{if isset($cpc_contest_has_solution) && !$cpc_contest_has_solution && ($contest['contest_rank_kind'] ?? 'icpc') != 'ccpc'}
{css file="__STATIC__/csgoj/contest/rank_font_faces.css" /}
{css file="__STATIC__/csgoj/contest/rank.css" /}
{css file="__STATIC__/csgoj/contest/rank_page.css" /}
{css file="__STATIC__/csgoj/contest/rank_skin_dark_stage.css" /}
{css file="__STATIC__/csgoj/contest/rank_skin_light_macaron.css" /}
{css file="__STATIC__/css/csg_ui_markers.css" /}
{css file="__STATIC__/cpcsys/contest/cpc_team_cards.css" /}

<div id="cpc-rank-unified-root" class="cpc-rank-unified-root">
    <div id="cpc-rank-wait-inner" class="cpc-rank-wait-inner">
        <p class="cpc-rank-wait-note text-muted bilingual-inline mb-3">
            本场尚未有任何提交，榜单将在首次提交后自动显示。
            <span class="en-text">No submissions yet. The ranklist appears automatically after the first submission.</span>
        </p>
        {include file="../../cpcsys/view/contest/team_cards_grid" /}
    </div>
</div>

<script>
    (function() {
        const tsFromConfig = window.contestHeaderConfig && window.contestHeaderConfig.current_timestamp;
        const tsFromDom = $('#current_time_div').attr('time_stamp');
        const ts = tsFromConfig || tsFromDom;
        let rank_time_diff = 0;
        if (ts) {
            const tsNum = Number(ts);
            if (!Number.isNaN(tsNum)) {
                rank_time_diff = new Date(tsNum * 1000).getTime() - new Date().getTime();
            }
        }
        window.RANK_CONFIG = {
            contest_rank_kind: <?php echo json_encode($contest['contest_rank_kind'] ?? 'icpc'); ?>,
            key: '<?php echo $contest['contest_id']; ?>',
            cid_list: '<?php echo $contest['contest_id']; ?>',
            rank_account_link_ctx: <?php echo json_encode([
                'module' => isset($module) ? (string) $module : 'cpcsys',
                'contest_id' => (string) ($contest['contest_id'] ?? ''),
                'contest_type' => (int) (intval($contest['private'] ?? 0) % 10),
            ], JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT | JSON_UNESCAPED_SLASHES); ?>,
            api_url: <?php echo json_encode(isset($rank_contest_data_api_url) ? (string) $rank_contest_data_api_url : '/' . $module . '/contest/contest_data_ajax', JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT | JSON_UNESCAPED_SLASHES); ?>,
            team_photo_url: '/upload/contest_attach/<?php echo $contest_attach ?? ""; ?>/team_photo',
            school_badge_url: '/static/image/school_badge',
            region_flag_url: '/static/image/region_flag',
            rank_mode: '<?php echo $rank_mode ?? ""; ?>',
            backend_time_diff: rank_time_diff || 0,
            flg_show_page_contest_title: false,
            flg_show_fullscreen_contest_title: true,
            flg_rank_cache: <?php echo $isContestAdmin || ($contest['contest_rank_kind'] ?? 'icpc') === 'ccpc' ? 'false' : 'true'; ?>,
            flg_show_team_id: true,
        };
    })();
</script>

{include file="../../csgoj/view/public/js_rank" /}
{js href="__STATIC__/js/csg_marquee_plain.js" /}
<script src="/static/cpcsys/contest/cpc_team_cards.js?v=20260524_1"></script>
<script>
    window.CPC_TEAM_CARD_CONFIG = window.CPC_TEAM_CARD_CONFIG || {};
    window.CPC_TEAM_CARD_CONFIG.school_badge_url = (window.RANK_CONFIG && window.RANK_CONFIG.school_badge_url) || '/static/image/school_badge';
    window.CPC_TEAM_CARD_CONFIG.region_flag_url = (window.RANK_CONFIG && window.RANK_CONFIG.region_flag_url) || '/static/image/region_flag';
    if (typeof CpcTeamCardsInit === 'function') {
        CpcTeamCardsInit(document.getElementById('cpc-rank-wait-inner'));
    }
</script>
{include file="../../csgoj/view/public/base_csg_switch" /}
{include file="../../csgoj/view/public/base_csg_multiselect" /}
<script src="/static/csgoj/contest/rank_page.js?v=20261004_ccpc1"></script>
<script src="/static/cpcsys/contest/cpc_rank_wait.js?v=20260510_2"></script>
<script>
    if (typeof CpcRankWaitBoot === 'function') {
        CpcRankWaitBoot();
    }
</script>

{else /}
{css file="__STATIC__/csgoj/contest/rank_font_faces.css" /}
{css file="__STATIC__/csgoj/contest/rank.css" /}
{css file="__STATIC__/csgoj/contest/rank_page.css" /}
{css file="__STATIC__/csgoj/contest/rank_skin_dark_stage.css" /}
{css file="__STATIC__/csgoj/contest/rank_skin_light_macaron.css" /}
{css file="__STATIC__/csgoj/contest/rank_contest_page_density.css" /}
<div class="contest-rank-page-shell" data-contest-rank-density="2">
<div class="contest-rank-page-shell__body">
<div id="rank-container"></div>
</div>
</div>

<script>
    (function() {
        const tsFromConfig = window.contestHeaderConfig && window.contestHeaderConfig.current_timestamp;
        const tsFromDom = $('#current_time_div').attr('time_stamp');
        const ts = tsFromConfig || tsFromDom;
        let rank_time_diff = 0;
        if (ts) {
            const tsNum = Number(ts);
            if (!Number.isNaN(tsNum)) {
                rank_time_diff = new Date(tsNum * 1000).getTime() - new Date().getTime();
            }
        }
        window.RANK_CONFIG = {
            contest_rank_kind: <?php echo json_encode($contest['contest_rank_kind'] ?? 'icpc'); ?>,
            key: '<?php echo $contest['contest_id']; ?>',
            cid_list: '<?php echo $contest['contest_id']; ?>',
            rank_account_link_ctx: <?php echo json_encode([
                'module' => isset($module) ? (string) $module : 'cpcsys',
                'contest_id' => (string) ($contest['contest_id'] ?? ''),
                'contest_type' => (int) (intval($contest['private'] ?? 0) % 10),
            ], JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT | JSON_UNESCAPED_SLASHES); ?>,
            api_url: <?php echo json_encode(isset($rank_contest_data_api_url) ? (string) $rank_contest_data_api_url : '/' . $module . '/contest/contest_data_ajax', JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT | JSON_UNESCAPED_SLASHES); ?>,
            team_photo_url: '/upload/contest_attach/<?php echo $contest_attach ?? ""; ?>/team_photo',
            school_badge_url: '/static/image/school_badge',
            region_flag_url: '/static/image/region_flag',
            rank_mode: '<?php echo $rank_mode ?? ""; ?>',
            backend_time_diff: rank_time_diff || 0,
            flg_show_page_contest_title: false,
            flg_show_fullscreen_contest_title: true,
            flg_rank_cache: <?php echo $isContestAdmin || ($contest['contest_rank_kind'] ?? 'icpc') === 'ccpc' ? 'false' : 'true'; ?>,
            flg_show_team_id: true,
        };
    })();
</script>

{include file="../../csgoj/view/public/js_rank" /}
{include file="../../csgoj/view/public/base_csg_switch" /}
{include file="../../csgoj/view/public/base_csg_multiselect" /}
<script src="/static/csgoj/contest/rank_page.js?v=20261004_ccpc1"></script>
<script>
    RankPageSystemInit('rank-container', window.RANK_CONFIG);
</script>
{/if}
