{if isset($login_teaminfo) && $login_teaminfo}

<div class="contest-header-actions">
    <!-- 考生信息切换按钮 -->
    <button class="btn btn-outline-secondary btn-sm team-info-toggle" id="team_info_toggle" 
            title="考生信息 / Examinee Information">
        <i class="bi bi-person-circle"></i>
    </button>
    
    <!-- 登出按钮 -->
    <a href="#" class="btn btn-outline-danger btn-sm contest-logout-btn" id="contest_logout_button"
       title="登出 / Logout">
        <i class="bi bi-box-arrow-right"></i>
    </a>
    
    <!-- 考生信息展开面板 -->
    <div id="team_info_panel" class="card position-absolute team-info-panel">
        <div class="card-header d-flex align-items-center justify-content-between team-info-panel-header">
            <h5 class="card-title mb-0 bilingual-inline">
                <i class="bi bi-person-badge me-2"></i>
                我的状态 <span class="en-text">My Status</span>
            </h5>
            <div class="d-flex gap-1">
                <!-- 收起按钮 -->
                <button class="btn btn-sm btn-link p-0 text-secondary" 
                        id="team_info_close_btn"
                        title="收起面板 / Close Panel">
                    <i class="bi bi-x-lg"></i>
                </button>
            </div>
        </div>
        <div class="card-body team-info-panel-body">
            <!-- 考生ID -->
            <div class="team-info-item" title="考生ID / Examinee ID: {$login_teaminfo['team_id']}">
                <i class="bi bi-hash text-primary"></i>
                <div class="item-content">
                    <div class="main-text">{$login_teaminfo['team_id']}</div>
                </div>
            </div>
            
            <!-- 姓名 -->
            <div class="team-info-item" title="姓名 / Name: {$login_teaminfo['name']|htmlspecialchars}">
                <i class="bi bi-person-fill text-success"></i>
                <div class="item-content">
                    <div class="main-text">{$login_teaminfo['name']}</div>
                </div>
            </div>
            
            <!-- 单位 -->
            <div class="team-info-item" title="单位 / School: {$login_teaminfo['school']|htmlspecialchars}">
                <i class="bi bi-building text-info"></i>
                <div class="item-content">
                    <div class="main-text">{$login_teaminfo['school']}</div>
                </div>
            </div>
            
            <!-- 考场 -->
            {if isset($login_teaminfo['room']) && $login_teaminfo['room']}
            <div class="team-info-item" title="考场 / Room: {$login_teaminfo['room']}">
                <i class="bi bi-geo-alt text-warning"></i>
                <div class="item-content">
                    <div class="main-text">{$login_teaminfo['room']}</div>
                </div>
            </div>
            {/if}
        </div>
    </div>
</div>
<script>
    const timeStamp = $('#current_time_div').attr('time_stamp');
    let rank_time_diff = 0;
    if (timeStamp) {
        rank_time_diff = new Date(timeStamp * 1000).getTime() - new Date().getTime();
    }
    // 配置信息（考试系统不需要排名数据，但需要兼容 TeamInfoPanel 的接口）
    window.TEAM_INFO_PANEL_CONFIG = {
        key: '<?php echo $contest['contest_id']; ?>',
        contest_id: '<?php echo $contest['contest_id']; ?>',
        cid_list: '<?php echo $contest['contest_id']; ?>',
        api_url: '/<?php echo $module; ?>/contest/contest_data_ajax',
        module: '<?php echo $module; ?>',
        rank_mode: "team",
        flg_rank_cache: <?php echo isset($isContestAdmin) && $isContestAdmin ? 'false' : 'true'; ?>,
        team_id: '<?php echo $login_teaminfo['team_id']; ?>',
        backend_time_diff: rank_time_diff || 0,
    };
</script>
{include file="../../csgoj/view/public/js_rank"}
{js href="__STATIC__/csgoj/contest/contest_floating_panel.js" /}
{css file="__STATIC__/csgoj/contest/tinfo_panel.css" /}
{js file="__STATIC__/csgoj/contest/tinfo_panel.js" /}
<script>
    // 初始化考生信息面板系统（复用比赛系统的 TeamInfoPanel）
    // 注意：考试系统不需要排名功能，但 TeamInfoPanel 会处理这种情况
    // TeamInfoPanel 会自动绑定登出按钮事件
    TeamInfoPanelInit(window.TEAM_INFO_PANEL_CONFIG);
</script>
{/if}

