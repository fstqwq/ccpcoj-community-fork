<?php $_chb = isset($contest_header_banner) && is_array($contest_header_banner) ? $contest_header_banner : []; ?>
<?php if (!empty($_chb['url'])): ?>
<div class="contest-top-banner-outer" aria-hidden="true">
    <div class="contest-top-banner">
        <div class="contest-top-banner__frame">
            <img class="contest-top-banner__media" src="<?php echo htmlspecialchars((string) $_chb['url'], ENT_QUOTES, 'UTF-8'); ?>?v=<?php echo (int) ($_chb['mtime'] ?? 0); ?>" alt="" decoding="async" loading="eager" />
        </div>
    </div>
</div>
<?php endif; ?>
<div class="contest-header-container">
    <div class="contest-header-main">
        <div>
            <h1 class="contest-title">{$contest['contest_id']}: {$contest['title']}</h1>
            <div class="contest-info">
                <div class="contest-info__strip" role="group" aria-label="Contest meta">
                <span class="inline_span contest-info__cell">
                    <span class="contest-info__label bilingual-inline">
                        <span class="contest-info__label-cn">开始</span>
                        <span class="en-text contest-info__label-en">Start</span>
                    </span>
                    <div class="contest-info__body contest-info__body--clock text-info" id="start_time_span">&nbsp;</div>
                </span>
                <span class="inline_span contest-info__cell">
                    <span class="contest-info__label bilingual-inline">
                        <span class="contest-info__label-cn">结束</span>
                        <span class="en-text contest-info__label-en">End</span>
                    </span>
                    <div class="contest-info__body contest-info__body--clock text-info" id="end_time_span">&nbsp;</div>
                </span>
                <span class="inline_span contest-info__cell">
                    <span class="contest-info__label bilingual-inline">
                        <span class="contest-info__label-cn">当前</span>
                        <span class="en-text contest-info__label-en">Now</span>
                    </span>
                    <div class="contest-info__body contest-info__body--clock" id="current_time_div" time_stamp="<?php echo htmlspecialchars((string) microtime(true), ENT_QUOTES, 'UTF-8'); ?>">&nbsp;</div>
                </span>
                <span class="inline_span contest-info__cell">
                    <span class="contest-info__label bilingual-inline">
                        <span class="contest-info__label-cn">状态</span>
                        <span class="en-text contest-info__label-en">Status</span>
                    </span>
                    <div id="contest_status_display" class="contest-info__body contest-info__body--status">
                        <!-- 状态将通过 JavaScript 动态更新 -->
                    </div>
                </span>
                <span class="inline_span contest-info__cell">
                    <span class="contest-info__label bilingual-inline">
                        <span class="contest-info__label-cn">类型</span>
                        <span class="en-text contest-info__label-en">Type</span>
                    </span>
                    <div class="contest-info__body contest-info__body--type bilingual-inline">
                        {if $contest['private'] % 10 == 1}<span class="text-info">私有<span class="en-text">Private</span></span>
                        {elseif $contest['private'] % 10 == 2}<span class="text-primary">标准<span class="en-text">Standard</span></span>
                        {elseif $contest['password'] != null && strlen($contest['password']) > 0 /}<span class="text-warning">加密<span class="en-text">Encrypted</span></span>
                        {else /}<span class="text-success">公开<span class="en-text">Public</span></span>
                        {/if}
                    </div>
                </span>
                <span class="inline_span contest-info__cell">
                    <span class="contest-info__label bilingual-inline">
                        <span class="contest-info__label-cn">榜单</span>
                        <span class="en-text contest-info__label-en">Rank</span>
                    </span>
                    <div id="rank_status_display" class="contest-info__body contest-info__body--status">
                        <!-- 状态将通过 JavaScript 动态更新 -->
                    </div>
                </span>
                </div>
            </div>
        </div>
        <ul class="nav nav-tabs" id="contest_menu">
            <!-- 比赛首页 -->
            <li class="nav-item" {if $action=='contest'}class="nav-item"{/if}>
                <a class="nav-link{if $action=='contest'} active{/if}" href="/{$module}/{$contest_controller}/contest?cid={$contest['contest_id']}" title="比赛首页">
                    <span class="cn-text"><i class="bi bi-house-door"></i>首 </span><span class="en-text">Index</span>
                </a>
            </li>
            
            <!-- 题目列表：与可访问权限一致，有权限则显示（管理员始终显示，不受 isContestStaff 限制） -->
            {if $isContestAdmin || !isset($balloonSender) || !$balloonSender}
                {if (isset($contestPolicy) && $contestPolicy.canViewProblems) && (
                        $contestStatus > -1
                        || $isContestAdmin
                        || (isset($contestPolicy.meta.isCourseTeacherReadonly) && $contestPolicy.meta.isCourseTeacherReadonly)
                        || (isset($is_assis) && $is_assis)
                        || (isset($isReviewer) && $isReviewer)
                        || (isset($proctorAdmin) && $proctorAdmin)
                    ) && (!isset($isContestStaff) || !$isContestStaff || $isContestAdmin)}
                    <li class="nav-item">
                        <a class="nav-link{if strpos($action, 'problem')===0} active{/if}" href="/{$module}/{$contest_controller}/problemset?cid={$contest['contest_id']}" title="题目">
                            <span class="cn-text"><i class="bi bi-list-task"></i>题 </span><span class="en-text">Problems</span>
                        </a>
                    </li>
                {/if}
            {/if}
            
            <!-- 榜单页：赛前、赛中、赛后均显示 -->
            <li class="nav-item">
                <a class="nav-link{if $action=='rank'} active{/if}" href="/{$module}/{$contest_controller}/rank?cid={$contest['contest_id']}" title="排名">
                    <span class="cn-text"><i class="bi bi-trophy"></i>榜 </span><span class="en-text">Ranklist</span>
                </a>
            </li>
            {if $module=='cpcsys' && $contestStatus == -1}
                <li class="nav-item">
                    <a class="nav-link{if $action=='team_display'} active{/if}" href="/{$module}/{$contest_controller}/team_display?cid={$contest['contest_id']}" title="参赛队伍 / Teams">
                        <span class="cn-text"><i class="bi bi-people"></i>队 </span><span class="en-text">Teams</span>
                    </a>
                </li>
            {/if}
            
            <!-- 比赛进行中的菜单 -->
            {if $contestStatus > -1}
                <!-- 评测状态 -->
                {if isset($contestPolicy) && $contestPolicy.canViewStatus}
                    <li class="nav-item">
                        <a class="nav-link{if strpos($action, 'status')===0} active{/if}" href="/{$module}/{$contest_controller}/status?cid={$contest['contest_id']}{if !$isContestAdmin && !IsAdmin('source_browser') && (!isset($proctorAdmin) || !$proctorAdmin)}#user_id={$contest_user}{/if}" title="评测状态">
                            <span class="cn-text"><i class="bi bi-clock-history"></i>测 </span><span class="en-text">Status</span>
                        </a>
                    </li>
                {/if}
                {if $module=='cpcsys'}
                    <li class="nav-item">
                        <a class="nav-link{if $action=='team_display'} active{/if}" href="/{$module}/{$contest_controller}/team_display?cid={$contest['contest_id']}" title="参赛队伍 / Teams">
                            <span class="cn-text"><i class="bi bi-people"></i>队 </span><span class="en-text">Teams</span>
                        </a>
                    </li>
                {/if}
                
                <!-- 参赛者专用菜单 -->
                {if $canJoin==true}
                    <!-- 通知消息 -->
                    {if $controller == 'contest' && !$isContestAdmin && isset($contestPolicy) && $contestPolicy.canUseMessage}
                            <li class="nav-item">
                                <a class="nav-link" href="javascript:void(0)" id="show_msg_btn" title="通知">
                                    <i class="bi bi-bell"></i>通(<span id="msg_num">0</span>) <span class="en-text">Message</span>
                                </a>
                            </li>
                    {/if}
                    
                    <!-- 提问菜单 -->
                    {if ($isContestAdmin || $contest_user) && isset($contestPolicy) && $contestPolicy.canUseClarification}
                            {include file="../../csgoj/view/contest/topic_menu" /}
                    {/if}
                {/if}
            {/if}
            
            <!-- CPCSYS模块专用菜单 -->
            {if $module=='cpcsys' && ($isContestAdmin || $contest_user)}
                <!-- 打印菜单 -->
                {if $contestStatus > -1 || $isContestAdmin || $printManager}
                    {include file="../../cpcsys/view/contest/print_menu" /}
                {/if}
                
                <!-- 气球管理 -->
                {if $balloonManager || $isContestAdmin}
                    <!-- 有多个菜单项，使用下拉菜单 -->
                    <li class="nav-item dropdown {if $action=='balloon' || $action=='balloon_queue'} active {/if}" title="气球管理">
                        <a class="nav-link dropdown-toggle{if $action=='balloon' || $action=='balloon_queue'} active{/if}" href="#" id="balloonDropdown" role="button" data-bs-toggle="dropdown" aria-expanded="false">
                            <span class="contest-nav-dropdown-label">
                                <span class="cn-text"><i class="bi bi-balloon"></i>球 </span><span class="en-text">Balloon</span>
                            </span>
                        </a>
                        <ul class="dropdown-menu" aria-labelledby="balloonDropdown">
                            <li>
                                <a class="dropdown-item{if $action=='balloon'} active{/if}" href="/{$module}/{$contest_controller}/balloon_manager?cid={$contest['contest_id']}" title="气球总览">
                                    <span class="cn-text"><i class="bi bi-balloon me-2"></i> 气球总览 </span><span class="en-text">Balloon Manager</span>
                                </a>
                            </li>
                            <li>
                                <a class="dropdown-item{if $action=='balloon_queue'} active{/if}" href="/{$module}/{$contest_controller}/balloon_queue?cid={$contest['contest_id']}"  title="气球队列">
                                    <span class="cn-text"><i class="bi bi-list-check me-2"></i> 气球队列 </span><span class="en-text">Balloon Queue</span>
                                </a>
                            </li>
                        </ul>
                    </li>
                {elseif $balloonSender}
                    <!-- 只有气球队列，直接显示 -->
                    <li class="nav-item">
                        <a class="nav-link{if $action=='balloon_queue'} active{/if}" href="/{$module}/{$contest_controller}/balloon_queue?cid={$contest['contest_id']}" target="_blank" title="气球队列">
                            <span class="cn-text"><i class="bi bi-balloon"></i>球 </span><span class="en-text">Balloon</span>
                        </a>
                    </li>
                {/if}
            {/if}
            
            <!-- 直播 / CCS（与 contestPolicy 一致：赛管 + watcher 进控制台；CCS 仅赛管） -->
            {if isset($contestPolicy) && $contestPolicy.canAccessLiveConsole}
            <li class="nav-item dropdown {if $action=='contest_live' || $action=='ccs_api_console'}active{/if}" title="直播 Live">
                <a class="nav-link dropdown-toggle{if $action=='contest_live' || $action=='ccs_api_console'} active{/if}" href="#" id="contestLiveDropdown" role="button" data-bs-toggle="dropdown" aria-expanded="false">
                    <span class="contest-nav-dropdown-label">
                        <span class="cn-text"><i class="bi bi-broadcast"></i>播 </span><span class="en-text">Live</span>
                    </span>
                </a>
                <ul class="dropdown-menu" aria-labelledby="contestLiveDropdown">
                    <li>
                        <a class="dropdown-item{if $action=='contest_live'} active{/if}" href="/{$module}/{$contest_controller}/contest_live?cid={$contest['contest_id']}" title="直播控制台 Live control">
                            <span class="cn-text"><i class="bi bi-broadcast me-2"></i>直播控制台 </span><span class="en-text">Live control</span>
                        </a>
                    </li>
                    {if isset($contestPolicy) && $contestPolicy.canUseCcsApiConsole}
                    <li>
                        <a class="dropdown-item{if $action=='ccs_api_console'} active{/if}" href="/{$module}/{$contest_controller}/ccs_api_console?cid={$contest['contest_id']}" title="ICPC CCS Contest API">
                            <span class="cn-text"><i class="bi bi-braces me-2"></i>CCS API </span><span class="en-text">CCS API</span>
                        </a>
                    </li>
                    {/if}
                </ul>
            </li>
            {/if}
            
            <!-- 管理员菜单 -->
            {if $isContestAdmin || isset($proctorAdmin) && $proctorAdmin}
                <li class="nav-item" id="contest_admin" cid="{$contest['contest_id']}">
                    <a class="nav-link{if $controller=='admin'} active{/if}" href="/{$module}/admin?cid={$contest['contest_id']}" title="比赛管理">
                        <span class="cn-text"><i class="bi bi-gear"></i>管 </span><span class="en-text">Admin</span>
                    </a>
                </li>
            {/if}
        </ul>
    </div>
    
    {js href="__STATIC__/csgoj/contest/contest_floating_panel.js" /}
    <!-- 右上角队伍信息面板和公告栏 -->
    <div class="contest-header-actions-container">
        <div class="contest-header-actions">
        <!-- 公告栏切换按钮 -->
        <button class="btn btn-outline-secondary btn-sm contest-notification-toggle" id="contest_notification_toggle" 
                title="公告 / Announcement">
            <i class="bi bi-megaphone"></i>
        </button>
        {include file="../../csgoj/view/contest/team_info_panel" /}
        </div>
    </div>
</div>

<!-- 公告栏面板 -->
{include file="../../csgoj/view/contest/contest_notification" /}
<!-- 比赛消息通知 -->
{if $canJoin && !$isContestAdmin}
    {include file="../../csgoj/view/contest/contest_msg_timing" /}
{/if}


<script type="text/javascript">
    <?php
    $__csg_hdr_st = isset($contest['start_time']) ? strtotime((string) $contest['start_time']) : false;
    $__csg_hdr_et = isset($contest['end_time']) ? strtotime((string) $contest['end_time']) : false;
    $__csg_hdr_st_ms = ($__csg_hdr_st !== false) ? (int) $__csg_hdr_st * 1000 : null;
    $__csg_hdr_et_ms = ($__csg_hdr_et !== false) ? (int) $__csg_hdr_et * 1000 : null;
    ?>
    // 传递模板变量给JavaScript
    window.contestHeaderConfig = {
        module: "{$module}",
        contest_controller: "{$contest_controller}",
        contest_id: "{$contest['contest_id']}",
        contest_status: "{$contestStatus}",
        rank_frozen: "{$rankFrozen ? 'true' : 'false'}",
        action: "{$action}",
        is_contest_admin: "{$isContestAdmin ? 'true' : 'false'}",
        proctor_admin: "{(isset($proctorAdmin) && $proctorAdmin) ? 'true' : 'false'}",
        // 比赛时间信息（naive 为应用时区墙钟；毫秒供状态机与前端换算为浏览器本地）
        start_time: <?php echo json_encode((string) ($contest['start_time'] ?? ''), JSON_HEX_TAG | JSON_HEX_APOS | JSON_UNESCAPED_UNICODE); ?>,
        end_time: <?php echo json_encode((string) ($contest['end_time'] ?? ''), JSON_HEX_TAG | JSON_HEX_APOS | JSON_UNESCAPED_UNICODE); ?>,
        start_time_ms: <?php echo json_encode($__csg_hdr_st_ms); ?>,
        end_time_ms: <?php echo json_encode($__csg_hdr_et_ms); ?>,
        frozen_minute: "{$contest['frozen_minute']}",
        frozen_after: "{$contest['frozen_after']}",
        // 当前时间戳（用于计算时间差）
        current_timestamp: <?php echo microtime(true); ?>
    };
</script>
{css href="__STATIC__/csgoj/contest/contest_header.css" /}
{css href="__STATIC__/csgoj/contest/contest_notification.css" /}
{js href="__STATIC__/csgoj/contest/contest_header.js" /}

{css href="__STATIC__/csgoj/contest/contest_msg.css" /}
{js href="__STATIC__/csgoj/contest/contest_msg.js" /}