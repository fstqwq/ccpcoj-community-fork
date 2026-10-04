<!-- 公告栏 - 独立面板 -->
<div id="contest_notification_panel" class="card position-absolute contest-notification-panel">
    <div class="card-header d-flex align-items-center justify-content-between contest-notification-panel-header">
        <h5 class="card-title mb-0 bilingual-inline">
            <i class="bi bi-megaphone me-2"></i>
            公告 <span class="en-text">Announcement</span>
        </h5>
        <div class="d-flex gap-1">
            <!-- 查看完整公告按钮 -->
            <button class="btn btn-sm btn-link p-0 text-info" 
                    id="contest_notification_view_full_btn"
                    data-bs-toggle="modal" 
                    data-bs-target="#announcement_view_modal"
                    title="查看完整公告 / View Full Announcement">
                <i class="bi bi-arrows-fullscreen"></i>
            </button>
            {if $isContestAdmin || isset($proctorAdmin) && $proctorAdmin }
            <button class="btn btn-sm btn-link p-0 text-primary" 
                    data-bs-toggle="modal" 
                    data-bs-target="#announcement_edit_modal"
                    title="编辑公告 (Edit Announcement)">
                <i class="bi bi-pencil-square"></i>
            </button>
            {/if}
            <!-- 收起按钮 -->
            <button class="btn btn-sm btn-link p-0 text-secondary" 
                    id="contest_notification_close_btn"
                    title="收起公告 / Close Announcement">
                <i class="bi bi-x-lg"></i>
            </button>
        </div>
    </div>
    <div class="card-body contest-notification-panel-body" id="contest_notification_content">
        <article class="md_display_div" id="contest_notification_div">
            {if isset($contest['notification']) && strlen($contest['notification']) > 0}
                {$contest['notification']|raw}
            {else /}
                <div class="text-muted">暂无公告<span class="en-text">No announcement</span></div>
            {/if}
        </article>
    </div>
</div>

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
{if $isContestAdmin || isset($proctorAdmin) && $proctorAdmin }
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
                        <span>公告将在右侧显示，用于比赛期间的持久公告</span>
                        <span class="en-text">Announcement will be displayed on the right for persistent notifications during the contest</span>
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

<script>
    // 配置信息
    window.CONTEST_NOTIFICATION_CONFIG = {
        contest_id: '<?php echo $contest['contest_id']; ?>',
        module: '<?php echo $module; ?>',
        controller: '<?php echo $contest_controller; ?>',
        is_contest_admin: '<?php echo isset($isContestAdmin) && $isContestAdmin ? 'true' : 'false'; ?>',
        proctor_admin: '<?php echo (isset($proctorAdmin) && $proctorAdmin) ? 'true' : 'false'; ?>',
    };
</script>
{js href="__STATIC__/csgoj/contest/contest_notification.js" /}
<script>
    // 初始化公告栏面板系统
    ContestNotificationInit(window.CONTEST_NOTIFICATION_CONFIG);
</script>
