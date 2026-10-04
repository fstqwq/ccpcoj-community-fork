
{css file="__STATIC__/csgoj/contest/rank_font_faces.css" /}
{css file="__STATIC__/csgoj/contest/rank.css" /}
{css file="__STATIC__/csgoj/contest/rank_skin_dark_stage.css" /}
{css file="__STATIC__/csgoj/contest/rank_skin_light_macaron.css" /}
{css file="__STATIC__/csgoj/contest/rank_page.css" /}
{css file="__STATIC__/csgoj/contest/roll_award_overlay.css" /}
<link rel="preload" href="__STATIC__/fonts/csg_rank/noto-sans-sc-chinese-simplified-500-normal.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="__STATIC__/fonts/csg_rank/noto-sans-sc-chinese-simplified-700-normal.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="__STATIC__/fonts/csg_rank/plus-jakarta-sans-latin-600-normal.woff2" as="font" type="font/woff2" crossorigin>
{include file="../../csgoj/view/public/base_csg_multiselect" /}
<!-- contest-rank-page-shell__body：换肤 dim 仅盖榜单块；滚榜工具条在 __body 外，不被遮罩挡点击 -->
<div class="contest-rank-page-shell contest-rank-page-shell--roll-admin">
<div class="contest-rank-page-shell__body">
<div id="rank-container"></div>
</div>
</div>

<script>
    // 使用 IIFE 避免 timeStamp / rank_time_diff 变量在同页多个模板中重复声明导致报错
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
        // 配置信息 - 滚榜页面专用配置
        window.RANK_CONFIG = {
            key: '<?php echo $contest['contest_id']; ?>_roll',
            cid_list: '<?php echo $contest['contest_id']; ?>',
            rank_account_link_ctx: <?php echo json_encode([
                'module' => isset($module) ? (string) $module : 'csgoj',
                'contest_id' => (string) ($contest['contest_id'] ?? ''),
                'contest_type' => (int) (intval($contest['private'] ?? 0) % 10),
            ], JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT | JSON_UNESCAPED_SLASHES); ?>,
            api_url: '/<?php echo $module; ?>/contest/contest_data_ajax',
            team_photo_url: '/upload/contest_attach/<?php echo $contest['attach'] ?? ""; ?>/team_photo',
            school_badge_url: '/static/image/school_badge',
            region_flag_url: '/static/image/region_flag',
            rank_mode: 'roll',                                    // 强制滚榜模式
            flg_show_page_contest_title: false,
            backend_time_diff: rank_time_diff || 0,
            flg_show_time_progress: false,                        // 隐藏时间进度条
            flg_show_controls_toolbar: false,                    // 隐藏按钮功能区
            flg_show_export_offline_roll: true                   // 显示导出离线滚榜按钮（服务器端默认显示）
        };
    })();
</script>
{include file="../../csgoj/view/public/js_zip" /}
{include file="../../csgoj/view/public/js_rank" /}
{js href="__STATIC__/js/csg_marquee_plain.js" /}
{js href="__STATIC__/csgoj/contest/roll_award_overlay.js" /}
{js href="__STATIC__/csgoj/contest/rank_roll.js" /}
<script>
    // 初始化滚榜系统
    // RankRollSystem 继承自 RankSystem，构造函数会自动调用 Init()
    // OriInit() 会在数据加载完成后自动初始化滚榜状态并渲染
    const rollSystem = new RankRollSystem('rank-container', window.RANK_CONFIG);
    
    // 将 rollSystem 保存到全局，方便调试
    window.rollSystem = rollSystem;
</script>

