
{css file="__STATIC__/csgoj/contest/rank_font_faces.css" /}
{css file="__STATIC__/csgoj/contest/rank.css" /}
{css file="__STATIC__/csgoj/contest/rank_page.css" /}
{css file="__STATIC__/csgoj/contest/rank_skin_dark_stage.css" /}
{css file="__STATIC__/csgoj/contest/rank_skin_light_macaron.css" /}
{css file="__STATIC__/csgoj/contest/rank_contest_page_density.css" /}
<!-- contest-rank-page-shell__body：换肤/松紧遮罩的 dim 仅盖此块，不把 .rank-header 压在下面 -->
<div class="contest-rank-page-shell" data-contest-rank-density="2">
<div class="contest-rank-page-shell__body">
<div id="rank-container"></div>
</div>
</div>

<script>
    // 使用 IIFE 避免 timeStamp / rank_time_diff 这类变量在同页多个模板中重复声明导致报错
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

        // 配置信息
        window.RANK_CONFIG = {
            key: '<?php echo $contest['contest_id']; ?>',
            cid_list: '<?php echo $contest['contest_id']; ?>',
            rank_account_link_ctx: <?php echo json_encode([
                'module' => isset($module) ? (string) $module : 'csgoj',
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
            flg_rank_cache: <?php echo $isContestAdmin ? 'false' : 'true'; ?>,
            flg_show_team_id: true,
        };
    })();
</script>

{include file="../../csgoj/view/public/js_rank"}
{include file="../../csgoj/view/public/base_csg_switch"}
{include file="../../csgoj/view/public/base_csg_multiselect"}
<script src="/static/csgoj/contest/rank_page.js?v=20261004_ccpc1"></script>
<script>
    RankPageSystemInit('rank-container', window.RANK_CONFIG);
</script>