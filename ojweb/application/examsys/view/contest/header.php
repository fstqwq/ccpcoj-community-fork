<div class="contest-header-container">
    <div style="flex-grow: 1;">
        <div>
            <h1 class="contest-title">{$contest['contest_id']}: {$contest['title']}</h1>
            <div class="contest-info">
                <div class="contest-info__strip" role="group" aria-label="Exam meta">
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
                </div>
            </div>
        </div>
        <ul class="nav nav-tabs" id="contest_menu">
            <!-- 考试首页 -->
            <li class="nav-item" {if $action=='contest'}class="nav-item"{/if}>
                <a class="nav-link{if $action=='contest'} active{/if}" href="/{$module}/contest/contest?cid={$contest['contest_id']}" title="考试首页">
                    <span class="cn-text"><i class="bi bi-house-door"></i>信息</span><span class="en-text">Info</span>
                </a>
            </li>
            
            <!-- 考试题目 -->
            {if $canJoin==true && $contestStatus > -1 || $isContestAdmin }
            <li class="nav-item">
                <a class="nav-link{if $action == 'problemset'} active{/if}" href="/{$module}/contest/problemset?cid={$contest['contest_id']}" title="考试题目">
                    <span class="cn-text"><i class="bi bi-list-task"></i>考试</span><span class="en-text">Exam</span>
                </a>
            </li>
            {/if}
            
            <!-- 考试进行中的菜单 -->
            {if $contestStatus > -1}
                <!-- 代码状态 -->
                {if $canJoin}
                <li class="nav-item">
                    <a class="nav-link{if strpos($action, 'status') === 0} active{/if}" href="/{$module}/contest/status?cid={$contest['contest_id']}{if !$isContestAdmin && !IsAdmin('source_browser') }#user_id={$contest_user}{/if}" title="代码状态">
                        <span class="cn-text"><i class="bi bi-clock-history"></i>状态</span><span class="en-text">Status</span>
                    </a>
                </li>
                {/if}
            {/if}
            
            <!-- 管理员菜单 -->
            {if $isContestAdmin || isset($isReviewer) && $isReviewer || isset($proctorAdmin) && $proctorAdmin}
                <li class="nav-item" id="contest_admin" cid="{$contest['contest_id']}">
                    <a class="nav-link{if $controller=='admin'} active{/if}" href="/{$module}/admin?cid={$contest['contest_id']}" title="考试管理">
                        <span class="cn-text"><i class="bi bi-gear"></i>管理</span><span class="en-text">Admin</span>
                    </a>
                </li>
            {/if}
        </ul>
    </div>
    
    <!-- 右上角考生信息面板和公告按钮 -->
    <div class="contest-header-actions-container">
        <div class="contest-header-actions">
            <!-- 公告按钮（考试模式：只显示按钮，点击打开 modal） -->
            <button class="btn btn-outline-secondary btn-sm contest-notification-toggle" id="contest_notification_toggle" 
                    title="公告 / Announcement">
                <i class="bi bi-megaphone"></i>
            </button>
            {include file="../../examsys/view/contest/examinee_info_panel" /}
        </div>
    </div>
</div>
{js href="__STATIC__/examsys/exam_func.js" /}

<!-- 公告 Modal（考试模式：只使用 modal，不显示侧边栏） -->
<!-- 查看完整公告Modal -->
<div class="modal fade" id="announcement_view_modal" tabindex="-1" aria-labelledby="announcement_view_modal_label" aria-hidden="true">
    <div class="modal-dialog modal-xl">
        <div class="modal-content">
            <div class="modal-header">
                <h4 class="modal-title bilingual-inline" id="announcement_view_modal_label">
                    <span class="cn-text"><i class="bi bi-megaphone me-2"></i>公告详情</span>
                    <span class="en-text">Announcement Details</span>
                </h4>
                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div class="modal-body" id="announcement_view_modal_body">
                <article class="md_display_div">
                    {if isset($contest['notification']) && strlen($contest['notification']) > 0}
                        {$contest['notification']|raw}
                    {else /}
                        <div class="text-muted">暂无公告<span class="en-text">No announcement</span></div>
                    {/if}
                </article>
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-secondary bilingual-inline" data-bs-dismiss="modal">关闭<span class="en-text">Close</span></button>
            </div>
        </div>
    </div>
</div>

<!-- 公告编辑Modal -->
{if ($isAdmin || (isset($isReviewer) && $isReviewer)) }
<div class="modal fade" id="announcement_edit_modal" tabindex="-1" aria-labelledby="announcement_edit_modal_label" aria-hidden="true">
    <div class="modal-dialog modal-lg">
        <div class="modal-content">
            <div class="modal-header">
                <h4 class="modal-title bilingual-inline" id="announcement_edit_modal_label">
                    <span class="cn-text"><i class="bi bi-pencil-square me-2"></i>编辑公告</span><span class="en-text">Edit Announcement</span>
                </h4>
                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div class="modal-body">
                <input type="hidden" id="announcement_info" cid="{$contest['contest_id']}" field="notification">
                <textarea class="form-control" rows="20" id="announcement_edit_textarea" placeholder="输入公告内容（支持 Markdown）..."></textarea>
                <div class="form-text mt-2">
                    <span class="bilingual-inline">
                        <span>公告将在考试期间显示，用于实时通知</span>
                        <span class="en-text">Announcement will be displayed during the exam for real-time notifications</span>
                    </span>
                </div>
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">取消<span class="en-text">Cancel</span></button>
                <button type="button" class="btn btn-primary" id="announcement_edit_save_btn">保存更改<span class="en-text">Save Changes</span></button>
            </div>
        </div>
    </div>
</div>
{/if}

<!-- 顶栏相关资源 -->
{css href="__STATIC__/csgoj/contest/contest_header.css" /}
{css href="__STATIC__/csgoj/contest/contest_notification.css" /}
{js href="__STATIC__/csgoj/contest/contest_header.js" /}
{js href="__STATIC__/csgoj/contest/contest_notification.js" /}

<script type="text/javascript">
    <?php
    $__csg_ex_hdr_st = isset($contest['start_time']) ? strtotime((string) $contest['start_time']) : false;
    $__csg_ex_hdr_et = isset($contest['end_time']) ? strtotime((string) $contest['end_time']) : false;
    $__csg_ex_hdr_st_ms = ($__csg_ex_hdr_st !== false) ? (int) $__csg_ex_hdr_st * 1000 : null;
    $__csg_ex_hdr_et_ms = ($__csg_ex_hdr_et !== false) ? (int) $__csg_ex_hdr_et * 1000 : null;
    ?>
    // 传递模板变量给JavaScript
    window.contestHeaderConfig = {
        module: "{$module}",
        contest_controller: "{$controller}",
        contest_id: "{$contest['contest_id']}",
        contest_status: "{$contestStatus}",
        rank_frozen: "false", // 考试系统不需要封榜
        action: "{$action}",
        is_contest_admin: "{(isset($isContestAdmin) && $isContestAdmin) ? 'true' : 'false'}",
        proctor_admin: "{(isset($isReviewer) && $isReviewer) ? 'true' : 'false'}",
        // 考试时间信息（naive 为应用时区墙钟）
        start_time: <?php echo json_encode((string) ($contest['start_time'] ?? ''), JSON_HEX_TAG | JSON_HEX_APOS | JSON_UNESCAPED_UNICODE); ?>,
        end_time: <?php echo json_encode((string) ($contest['end_time'] ?? ''), JSON_HEX_TAG | JSON_HEX_APOS | JSON_UNESCAPED_UNICODE); ?>,
        start_time_ms: <?php echo json_encode($__csg_ex_hdr_st_ms); ?>,
        end_time_ms: <?php echo json_encode($__csg_ex_hdr_et_ms); ?>,
        frozen_minute: "0", // 考试系统不需要封榜
        frozen_after: "0", // 考试系统不需要封榜
        // 当前时间戳（用于计算时间差）
        current_timestamp: <?php echo microtime(true); ?>
    };
    
    // 考试模式：强制使用 modal 模式，不显示侧边栏
    window.CONTEST_NOTIFICATION_CONFIG = {
        contest_id: '{$contest["contest_id"]}',
        module: 'examsys',
        controller: 'contest',
        is_contest_admin: '<?php echo ($isAdmin || (isset($isReviewer) && $isReviewer)) ? "true" : "false"; ?>',
        proctor_admin: '<?php echo (isset($isReviewer) && $isReviewer) ? "true" : "false"; ?>',
        force_modal_mode: true, // 强制使用 modal 模式
    };
    
    $(document).ready(function(){
        // 初始化公告系统（考试模式：只使用 modal）
        ContestNotificationInit(window.CONTEST_NOTIFICATION_CONFIG);
    });
</script>
