{if isset($login_teaminfo) && $login_teaminfo}

    <!-- 队伍信息切换按钮 -->
    <button class="btn btn-outline-secondary btn-sm team-info-toggle" id="team_info_toggle" 
            title="队伍信息 / Team Information">
        <i class="bi bi-person-circle"></i>
    </button>
    
    <!-- 登出按钮（由 contestPolicy 决定：仅 cpcsys/examsys 的 cpc_team 比赛需要） -->
    {if isset($contestPolicy) && $contestPolicy.showContestLogoutButton}
            <a href="#" class="btn btn-outline-danger btn-sm contest-logout-btn" id="contest_logout_button"
               title="登出 / Logout">
                <i class="bi bi-box-arrow-right"></i>
            </a>
    {/if}
    
    <!-- 队伍信息展开面板 -->
    <div id="team_info_panel" class="card position-absolute team-info-panel">
        <div class="card-header d-flex align-items-center justify-content-between team-info-panel-header">
            <h5 class="card-title mb-0 bilingual-inline">
                <i class="bi bi-people-fill me-2"></i>
                {if $module == 'cpcsys' || (isset($contest['private']) && $contest['private'] % 10 == 2)}
                    队伍面板 <span class="en-text">Team Panel</span>
                {elseif $module == 'expsys' || $module == 'examsys'}
                    我的状态 <span class="en-text">My Status</span>
                {else /}
                    队伍面板 <span class="en-text">Team Panel</span>
                {/if}
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
            <!-- 队伍ID -->
            <div class="team-info-item" title="队伍ID / Team ID: {$login_teaminfo['team_id']}">
                <i class="bi bi-hash text-primary"></i>
                <div class="item-content">
                    <div class="main-text">{$login_teaminfo['team_id']}</div>
                </div>
            </div>
            
            <!-- 队伍名称 -->
            <div class="team-info-item" title="队伍名称 / Team Name: {$login_teaminfo['name']|htmlspecialchars}{if isset($login_teaminfo['name_en']) && $login_teaminfo['name_en']} | 副语言队名 / Secondary Language: {$login_teaminfo['name_en']|htmlspecialchars}{/if}">
                <i class="bi bi-flag-fill text-success"></i>
                <div class="item-content">
                    <div class="main-text">{$login_teaminfo['name']}</div>
                    {if isset($login_teaminfo['name_en']) && $login_teaminfo['name_en']}
                    <div class="sub-text">{$login_teaminfo['name_en']}</div>
                    {/if}
                </div>
            </div>
            
            <!-- 学校 -->
            <div class="team-info-item" title="学校 / School: {$login_teaminfo['school']|htmlspecialchars}">
                <i class="bi bi-building text-info"></i>
                <div class="item-content">
                    <div class="main-text">{$login_teaminfo['school']}</div>
                </div>
            </div>
            
            <!-- 机房/区域 -->
            {if isset($login_teaminfo['room']) && $login_teaminfo['room']}
            <div class="team-info-item" title="机房/区域 / Room/Zone: {$login_teaminfo['room']}">
                <i class="bi bi-geo-alt text-warning"></i>
                <div class="item-content">
                    <div class="main-text">{$login_teaminfo['room']}</div>
                </div>
            </div>
            {/if}
            
            <!-- 教练信息 -->
            {if isset($login_teaminfo['coach']) && $login_teaminfo['coach']}
            <div class="team-info-item" title="教练 / Coach: {$login_teaminfo['coach']}">
                <i class="bi bi-person-badge text-secondary"></i>
                <div class="item-content">
                    <div class="main-text">{$login_teaminfo['coach']}</div>
                </div>
            </div>
            {/if}
            
            <!-- 选手信息 -->
            {if isset($login_teaminfo['tmember']) && $login_teaminfo['tmember']}
            <div class="team-info-item" title="选手 / Players: {$login_teaminfo['tmember']|htmlspecialchars}">
                <i class="bi bi-people text-secondary"></i>
                <div class="item-content">
                    <div class="main-text">{$login_teaminfo['tmember']}</div>
                </div>
            </div>
            {/if}
            
            {if !isset($isContestStaff) || !$isContestStaff }
            <!-- 成绩信息 -->
            <div class="team-info-item team-score-section">
                <div class="item-content team-score-content">
                    {include file="../../csgoj/view/contest/team_score_panel" /}
                </div>
            </div>
            {/if}
        </div>
    </div>
<script>
    // 使用 IIFE 避免与同页其他模板的变量名冲突（例如 rank.php 也会计算时间差）
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
            default_no_cache_expanded: <?php echo (isset($isContestAccountStaff) && $isContestAccountStaff) ? 'false' : 'true'; ?>,
        };
    })();
</script>
{include file="../../csgoj/view/public/js_rank"}
{css file="__STATIC__/csgoj/contest/tinfo_panel.css" /}
{js file="__STATIC__/csgoj/contest/tinfo_panel.js" /}
<script>
    // 初始化队伍信息面板系统
    TeamInfoPanelInit(window.TEAM_INFO_PANEL_CONFIG);
</script>
{/if}