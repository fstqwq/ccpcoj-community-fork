{include file="../../csgoj/view/public/base_select" /}

{css file="__STATIC__/csgoj/contest/rank_font_faces.css" /}
{css file="__STATIC__/csgoj/contest/rank.css" /}
{css file="__STATIC__/csgoj/contest/rank_skin_dark_stage.css" /}
{css file="__STATIC__/csgoj/contest/rank_skin_light_macaron.css" /}
{css file="__STATIC__/csgoj/contest/balloon_manager.css" /}
{include file="../../csgoj/view/public/base_csg_switch" /}

<!-- 气球管理头部 -->
<div class="balloon-header-section">
    <div class="container-fluid">
        <div class="balloon-header-row">
            <div class="balloon-title-compact">
                <div class="balloon-title-text">气球总览<en-text>Balloon Overview</en-text></div>
            </div>
            <div class="balloon-controls-group">
                <div class="csg-switch">
                    <input type="checkbox" 
                           class="csg-switch-input" 
                           id="balloon-auto-refresh-switch"
                           data-csg-size="md"
                           data-csg-theme="primary"
                           data-csg-animate="true"
                           data-csg-text-on="自动刷新"
                           data-csg-text-on-en="Auto Refresh"
                           data-csg-text-off="手动刷新"
                           data-csg-text-off-en="Manual Refresh">
                </div>
                <span class="balloon-refresh-countdown" id="balloon-refresh-countdown" style="display: none;">
                    <span id="balloon-countdown-text">10</span>
                </span>
            </div>
            <div class="balloon-global-stats" id="balloon-global-stats">
                <!-- 统计信息将在这里动态更新 -->
            </div>
        </div>
    </div>
</div>

{if $balloonManager || $isContestAdmin}
<div id="balloon-overview-toolbar" class="container-fluid table-toolbar mb-2">
    <div class="balloon-filter-container">
        <div class="balloon-filter-row">
            <div class="balloon-filter-group{if isset($balloonStaffRoomLock) && count($balloonStaffRoomLock) > 0} balloon-filter-group--zone-locked{/if}">
                <span class="balloon-filter-label" title="{if isset($balloonStaffRoomLock) && count($balloonStaffRoomLock) > 0}榜单仅显示您负责分区内的队伍&#10;Only teams in your assigned zones{else /}按房间/区域筛选&#10;Filter by room/area{/if}"><span>房间/区域</span><span class="en-text">Room/Area</span></span>
                {if isset($balloonStaffRoomLock) && count($balloonStaffRoomLock) > 0}
                <button type="button" id="balloon-overview-zone-lock-field" class="balloon-zone-lock-field" title="您负责的分区范围；点击可查看名称&#10;Your assigned zones; click to view names" aria-expanded="false" aria-haspopup="dialog">
                    <span class="balloon-zone-lock-field__count" aria-hidden="true"></span>
                    <span class="balloon-zone-lock-field__summary"></span>
                    <span class="balloon-zone-lock-field__lock" title="分区范围已指定，不可在此修改&#10;Zone scope is assigned and cannot be changed here" aria-hidden="true"><i class="bi bi-lock-fill"></i></span>
                </button>
                {else /}
                <select class="multiple-select" id="balloon-overview-filter-rooms" name="balloon-overview-filter-rooms" multiple>
                </select>
                {/if}
            </div>
        </div>
    </div>
</div>
{/if}

<!-- 榜单容器 -->
<div id="balloon-container"></div>

<script>
    const timeStamp = $('#current_time_div').attr('time_stamp');
    let rank_time_diff = 0;
    if (timeStamp) {
        rank_time_diff = new Date(timeStamp * 1000).getTime() - new Date().getTime();
    }
    // 配置信息
    window.RANK_CONFIG = {
        key: 'balloon_<?php echo $contest['contest_id']; ?>',
        cid_list: '<?php echo $contest['contest_id']; ?>',
        api_url: '/cpcsys/contest/balloon_data_ajax',
        contest_data_api_url: '/cpcsys/contest/contest_data_ajax',
        school_badge_url: '/static/image/school_badge',
        region_flag_url: '/static/image/region_flag',
        backend_time_diff: rank_time_diff || 0,
        flg_show_page_contest_title: false,
        flg_show_fullscreen_contest_title: false,
        flg_rank_cache: false,
        flg_show_time_progress: false,
        flg_show_controls_toolbar: false,
        flg_show_team_id: true,
    };
    window.BALLOON_OVERVIEW_CONFIG = {
        balloon_staff_room_tokens: <?php echo json_encode(isset($balloonStaffRoomLock) ? $balloonStaffRoomLock : [], JSON_UNESCAPED_UNICODE); ?>
    };
</script>
{js href="__STATIC__/js/csg_anim.js" /}
{js href="__STATIC__/cpcsys/contestlive/js/contestlive_contest_timer.js" /}
{js href="__STATIC__/csgoj/contest/rank_tool.js" /}
{js href="__STATIC__/csgoj/contest/rank.js?v=20261004_ccpc1" /}
{js href="__STATIC__/csgoj/contest/balloon_manager.js?v=20261004_ccpc1" /}
<script>
    // 初始化气球管理系统
    const balloonSystem = new BalloonManagerSystem('balloon-container', window.RANK_CONFIG);
    
    // 将 balloonSystem 保存到全局，方便调试
    window.balloonSystem = balloonSystem;
</script>

