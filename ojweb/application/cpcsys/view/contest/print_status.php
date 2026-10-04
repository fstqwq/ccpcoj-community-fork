{include file="../../csgoj/view/public/pkg_code_highlight" /}
{include file="../../csgoj/view/public/base_csg_switch" /}

{if IsAdmin('contest', $contest['contest_id']) || $printManager || (!empty($lodop_manual_eligible) && $lodop_manual_eligible) }
<div id="print_status_env_alert" class="alert alert-info alert-dismissible fade show" role="alert">
    <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close" title="关闭提示&#10;Dismiss notice"></button>
    <div class="d-flex align-items-start pe-1">
        <i class="bi bi-info-circle me-2 mt-1 flex-shrink-0"></i>
        <div class="d-flex flex-column gap-2">
            <div>打印前需<strong><a href="__IMG__/tutorial/set_default_print.gif" target="_blank">参考链接</a></strong>设置默认打印机为目标打印机。第一次使用时，<strong>页面上方</strong>会提示安装打印控件，用来对接页面打印逻辑和系统打印机，打印前需下载安装。<span class="en-text">Before printing, please <strong><a href="__IMG__/tutorial/set_default_print.gif" target="_blank">refer to the link</a></strong> to set the default printer as the target printer. On first use, you will be prompted to install the print control at the <strong>top of the page</strong> to connect the page printing logic with the system printer. Please download and install it before printing.</span></div>
            <div><strong>请使用最新浏览器，建议使用Chrome。</strong><span class="en-text"><strong>Please use the latest browser, Chrome is recommended.</strong></span></div>
            <div class="mb-0">Chrome94之后禁止了本地网络请求设置，需<strong><a href="__IMG__/tutorial/lodop_chrome_cors.png" target="_blank">关闭该功能</a></strong>：在地址栏输入"chrome://flags"，找到"Block insecure private network requests."改为"Disabled"。<span class="en-text">Chrome 94+ blocks insecure private network requests. Please <strong><a href="__IMG__/tutorial/lodop_chrome_cors.png" target="_blank">disable this feature</a></strong>: Enter "chrome://flags" in the address bar, find "Block insecure private network requests." and set it to "Disabled".</span></div>
        </div>
    </div>
</div>
{/if}
{js href="__STATIC__/csgoj/contest/csg_print_job_queue.js" /}
{js href="__STATIC__/csgoj/contest/print_manager.js"}

<div id="print_status_toolbar" class="table-toolbar">
    <div class="d-flex align-items-center gap-2" role="form">
        <style>
        /* 规范比赛页工具栏的刷新/清空/过滤按钮颜色为与后台一致的 Bootstrap secondary 方案 */
        #print_status_toolbar .btn.btn-outline-secondary {
            --bs-btn-color: var(--bs-secondary);
            --bs-btn-border-color: var(--bs-secondary);
            --bs-btn-hover-bg: var(--bs-secondary);
            --bs-btn-hover-border-color: var(--bs-secondary);
            --bs-btn-active-bg: var(--bs-secondary);
            --bs-btn-active-border-color: var(--bs-secondary);
        }
        </style>
        <button id="print_status_refresh" type="submit" class="btn btn-outline-secondary toolbar-btn" title="刷新 (Refresh)">
            <i class="bi bi-arrow-clockwise"></i>
        </button>
        <button id="print_status_clear" type="submit" class="btn btn-outline-secondary toolbar-btn" title="清空筛选条件 (Clear)">
            <i class="bi bi-eraser"></i>
        </button>
        <!-- 仅赛管按需加载路径显示 -->
        {if !empty($lodop_manual_eligible) && $lodop_manual_eligible && empty($lodop_autoload)}
        <span id="print_lodop_load_btn_tooltip_host" class="d-inline-block align-middle print-btn-tooltip-host" data-csg-tooltip-preline="true" title="加载打印环境并检测是否可打印&#10;Load print environment and check if printing is available">
            <button id="print_lodop_load_btn" type="button" class="btn btn-outline-primary toolbar-btn" aria-label="加载打印环境并检测是否可打印。Load print environment and check if printing is available.">
                <i class="bi bi-plugin" aria-hidden="true"></i>
            </button>
        </span>
        {/if}
        <div class="toolbar-group">
            <span class="toolbar-label-inline"><span>队伍ID</span><span class="toolbar-label en-text">Team ID</span></span>
            <input id="team_id_input" name="team_id" class="form-control toolbar-input print_status_filter" type="text"
                   value="{if !$printManager /} {$contest_user} {/if}"
                   autocomplete="off"
            style="max-width:120px;" placeholder="Team ID" title="筛选队伍ID (Filter Team ID)">
        </div>
        <div class="toolbar-group">
            <span class="toolbar-label-inline"><span>分区</span><span class="toolbar-label en-text">Zone</span></span>
            {if isset($printStaffRoomLocked) && $printStaffRoomLocked}
            <input id="room_limit" class="form-control toolbar-input" title="<?php echo htmlspecialchars(implode(',', $printStaffRoomLock), ENT_QUOTES, 'UTF-8'); ?>" value="<?php echo htmlspecialchars(implode(',', $printStaffRoomLock), ENT_QUOTES, 'UTF-8'); ?>" disabled autocomplete="off" >
            <input id="room_ids" name="room_ids" type="hidden" class="form-control toolbar-input print_status_filter" value="<?php echo htmlspecialchars(implode(',', $printStaffRoomLock), ENT_QUOTES, 'UTF-8'); ?>" autocomplete="off">
            {else /}
            <input id="room_ids" name="room_ids" class="form-control toolbar-input print_status_filter" placeholder="房间1,房间2,房间3..." type="text" {if isset($room_ids)}value="{$room_ids}" {/if} autocomplete="off" style="width:220px;" title="半角逗号&quot;,&quot;隔开的不同区域 (Different zones separated by comma &quot;,&quot;)">
            {/if}
        </div>
        {if isset($contestGroupContext) && intval($contestGroupContext['is_multi_group']) == 1}
        <div class="toolbar-group">
            <span class="toolbar-label-inline"><span>分组</span><span class="toolbar-label en-text">Group</span></span>
            {if isset($printStaffGroupLocked) && $printStaffGroupLocked}
            <input type="text" id="print_group_ids_display" class="form-control toolbar-input" value="<?php echo implode(',', $printStaffGroupIds); ?>" disabled autocomplete="off" style="width:160px;">
            <input type="hidden" id="print_group_ids_hidden" value="<?php echo implode(',', $printStaffGroupIds); ?>" autocomplete="off">
            {else /}
            <select id="print_group_ids" name="group_ids" class="form-select toolbar-select print_status_filter" autocomplete="off">
                <option value="">全部 All</option>
                {foreach $contestGroupContext['groups'] as $g}
                {php}
                    $gid = strval($g['group_id'] ?? '');
                    $gname = strval($g['group_name'] ?? $gid);
                {/php}
                <option value="{$gid}">{$gname} ({$gid})</option>
                {/foreach}
            </select>
            {/if}
        </div>
        {/if}
        <div class="toolbar-group">
            <select name="print_status" class="form-select toolbar-select print_status_filter" autocomplete="off">
                <option value="-1" selected="true">
                    All
                </option>
            </select>
        </div>
        {if $isContestAdmin || $printManager }
        <div class="toolbar-group">
            <div class="toolbar-btn-group d-flex align-items-center gap-2">
                <div class="csg-switch">
                    <input type="checkbox" 
                           class="csg-switch-input" 
                           id="auto_print_box"
                           data-csg-size="md"
                           data-csg-theme="primary"
                           data-csg-animate="true"
                           data-csg-text-on="自动"
                           data-csg-text-on-en="Auto Print"
                           data-csg-text-off="手动"
                           data-csg-text-off-en="Manual Print">
                </div>
                <span class="text-info">(<strong id="auto_print_interval_span">10</strong>s)</span>
            </div>
        </div>
        {/if}
        {if $printManager && !$isContestAdmin }
        <div class="toolbar-group">
            <div class="toolbar-btn-group d-flex align-items-center gap-2">
                <div class="csg-switch">
                    <input type="checkbox" 
                           class="csg-switch-input" 
                           id="print_color_mode_box"
                           data-csg-size="md"
                           data-csg-theme="primary"
                           data-csg-animate="true"
                           data-csg-storage="true"
                           data-csg-storage-key="print_color_mode"
                           data-csg-text-on="彩色模式"
                           data-csg-text-on-en="Color Mode"
                           data-csg-text-off="黑白模式"
                           data-csg-text-off-en="B&W Mode"
                           checked>
                </div>
            </div>
        </div>
        {/if}
    </div>
</div>
<style>
/* 学校列 hash tag：与 rank_team_image / teamgen 单元格对齐方式一致 */
#print_status_table.bootstrap_table_table tbody td[data-field="school"] .teamgen-hash-cell {
    display: flex;
    align-items: flex-start;
    box-sizing: border-box;
    width: 100%;
}
#print_status_table.bootstrap_table_table tbody td[data-field="school"] .teamgen-hash-cell--start {
    justify-content: flex-start;
}
#print_status_table .do_print.print-action-unavailable,
#print_code_show_modal .print-action-unavailable {
    opacity: 0.55;
    cursor: not-allowed;
}
/* 禁用按钮不接收悬停：提示绑在父级（与 global.js CsgSetTitleAndTooltip 说明一致） */
.print-btn-tooltip-host > .btn:disabled {
    pointer-events: none;
}
/* 打印预览 header：整栏垂直居中；时间两行微间距；队伍两行间距 */
#print_code_show_modal .modal-header {
    align-items: center;
}
#print_code_show_modal .print-code-modal-header-meta-row {
    flex: 1 1 14rem;
    min-width: 0;
}
#print_code_show_modal .print-meta-datetime-stack {
    display: inline-flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 0;
    line-height: 1.2;
}
#print_code_show_modal .print-meta-datetime-hms-tz-line {
    display: inline-flex;
    align-items: baseline;
    justify-content: flex-start;
    gap: 0.2rem;
    white-space: nowrap;
}
#print_code_show_modal .print-meta-datetime-hms-tz-line .csg-tz-tag--inline {
    font-size: 0.62em;
    padding: 0.04em 0.28em;
    line-height: 1.1;
    font-weight: 500;
}
#print_code_show_modal .print-code-modal-ellipsis-line {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    min-width: 0;
}
#print_code_show_modal .print-code-modal-team-cluster {
    min-width: 0;
    flex: 1 1 10rem;
    max-width: min(40rem, 100%);
}
/* 第一行：队号列随内容，队名占剩余。第二行：教练列至少 150px、上限约半屏内；队员列吃剩余；列间距收窄 */
#print_code_show_modal .print-code-modal-team-line1-grid {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    column-gap: 0.65rem;
    align-items: center;
}
#print_code_show_modal .print-code-modal-team-line2-grid {
    display: grid;
    grid-template-columns: minmax(150px, min(18rem, 50%)) minmax(0, 1fr);
    column-gap: 0.35rem;
    align-items: center;
}
#print_code_show_modal .print-code-modal-team-line1-grid > div,
#print_code_show_modal .print-code-modal-team-line2-grid > div {
    min-width: 0;
}
/* 图标固定宽，文案占满本列剩余宽度以便省略号生效 */
#print_code_show_modal .print-code-modal-team-line1-grid > div:last-child .print-code-modal-ellipsis-line,
#print_code_show_modal .print-code-modal-team-line2-grid .print-code-modal-ellipsis-line {
    flex: 1 1 auto;
    min-width: 0;
}
</style>
<div class="bootstrap_table_div">
<table
        class="bootstrap_table_table bootstraptable_refresh_local"
        id="print_status_table"
          data-url="__CPC__/contest/print_status_ajax?cid={$contest['contest_id']}"
          data-pagination="true"
          data-page-list="[20,50,100]"
          data-page-size="50"
          data-side-pagination="server"
          data-method="get"
          data-striped="true"
          data-sort-name="print_status"
          data-sort-order="asc"
          data-pagination-v-align="bottom"
          data-pagination-h-align="left"
          data-pagination-detail-h-align="right"
          data-toolbar="#print_status_toolbar"
          data-query-params="queryParams"
          data-response-handler="printStatusResponseHandler"
          data-classes="table table-hover table-striped table-bordered"
          data-cookie="true"
          data-cookie-id-table="{$OJ_SESSION_PREFIX}print-status-{$contest['contest_id']}-{$team_id}"
          data-cookie-expire="1m"
>
    <thead>
    <tr>
        <th data-field="print_id" data-align="center" data-valign="middle"  data-sortable="true" data-width="70">打印ID<span class="en-text">PrintID</span></th>
        {if $printManager || $isContestAdmin}
        <th data-field="school" data-align="left" data-valign="middle" data-sortable="true" data-formatter="FormatterPrintStatusSchool">学校<span class="en-text">School</span></th>
        <th data-field="name" data-align="left" data-valign="middle"  data-sortable="true">队名<span class="en-text">Team Name</span></th>
        {/if}
        <th data-field="code_length" data-align="right" data-valign="middle"  data-sortable="true" data-width="80">代码长度<span class="en-text">Code Length</span></th>
        <th data-field="in_date" data-align="center" data-valign="middle"  data-sortable="true"  data-width="100" data-formatter="FormatterTime">提交时间<span class="en-text">Submit Time</span></th>
        <th data-field="print_status" data-align="center" data-valign="middle"  data-sortable="true" data-width="70" data-formatter="FormatterPrintStatus">状态<span class="en-text">Status</span></th>
        {if $printManager || $isContestAdmin}
        <th data-field="room" data-align="center" data-valign="middle"  data-sortable="false"  >房间/区域<span class="en-text">Room/Area</span></th>
        {/if}
        <th data-field="team_id" data-align="center" data-valign="middle"  data-sortable="false" data-width="100" data-formatter="FormatterTeamId">队伍ID<span class="en-text">Team ID</span></th>
        {if($printManager && !$isContestAdmin)}
        <th data-field="do_print" data-align="center" data-valign="middle"  data-sortable="false" data-width="70" data-formatter="FormatterPrintAction">打印<span class="en-text">Print</span></th>
        {/if}
        {if $printManager}
        <th data-field="do_deny" data-align="center" data-valign="middle"  data-sortable="false" data-width="70" data-formatter="FormatterPrintDenyAction">拒绝<span class="en-text">Deny</span></th>
        {/if}
    </tr>
    </thead>
</table>
</div>
<input
    type="hidden"
    id="print_status_page_information"
    cid="{if(isset($contest))}{$contest['contest_id']}{else/}x{/if}"
    team_id="{$contest_user}"
    show_code_url="{$show_code_url}"
>

<!-- 打印代码预览：与 contest/status 代码查看器同一套布局（Bootstrap modal 纵向滚动 + header position:sticky，正文不限高在 modal-body 内滚动） -->
<div class="modal fade" id="print_code_show_modal" tabindex="-1" aria-labelledby="print_code_show_modal_label" aria-hidden="true">
    <div class="modal-dialog modal-xl">
        <div class="modal-content">
            <div class="modal-header">
                <div class="d-flex justify-content-between align-items-center w-100 flex-wrap gap-2">
                    <div class="d-flex align-items-center flex-wrap gap-3 min-w-0 flex-grow-1">
                        <h5 class="modal-title mb-0 flex-shrink-0 me-lg-2" id="print_code_show_modal_label">
                            <i class="bi bi-printer me-2"></i>
                            <span id="print_code_show_modal_title">打印请求代码<span class="en-text">Print Request Code</span></span>
                        </h5>
                        <div class="d-none d-lg-flex align-items-center gap-3 min-w-0 print-code-modal-header-meta-row">
                            <div class="code-meta-compact d-flex align-items-center text-muted small flex-shrink-0" id="print_code_meta_compact">
                                <div class="me-3 d-flex align-items-center" title="提交时间 (Submit time)">
                                    <i class="bi bi-clock me-1 flex-shrink-0"></i>
                                    <div class="print-meta-datetime-stack text-body">
                                        <span id="print_meta_in_date_line_compact" class="print-meta-datetime-date">-</span>
                                        <span class="print-meta-datetime-hms-tz-line">
                                            <span id="print_meta_in_time_line_compact" class="fw-semibold print-meta-datetime-hms">-</span>
                                            <span id="print_meta_in_tz_inline_compact"></span>
                                        </span>
                                    </div>
                                </div>
                                <div class="d-flex align-items-center" title="代码长度 (Code length)">
                                    <i class="bi bi-file-text me-1 flex-shrink-0"></i>
                                    <div id="print_meta_code_len_compact" class="csg-bilingual-stack lh-sm text-body">-</div>
                                </div>
                            </div>
                            <div class="print-code-modal-team-cluster d-flex flex-column gap-1 min-w-0">
                                <div class="print-code-modal-team-line1-grid min-w-0 w-100">
                                    <div class="d-flex align-items-center gap-1 text-body">
                                        <i class="bi bi-person-vcard flex-shrink-0 text-muted" title="队伍ID&#10;Team ID" aria-hidden="true"></i>
                                        <span class="fw-semibold font-monospace small flex-shrink-0" id="print_meta_team_id_header">—</span>
                                    </div>
                                    <div class="d-flex align-items-center gap-1 min-w-0 text-body">
                                        <i class="bi bi-flag-fill flex-shrink-0 text-muted" title="队名&#10;Team name" aria-hidden="true"></i>
                                        <span class="print-code-modal-ellipsis-line small fw-medium" id="print_meta_team_name_line">—</span>
                                    </div>
                                </div>
                                <div class="print-code-modal-team-line2-grid min-w-0 w-100">
                                    <div class="d-flex align-items-center gap-1 text-muted">
                                        <i class="bi bi-person flex-shrink-0" title="教练&#10;Coach" aria-hidden="true"></i>
                                        <span class="print-code-modal-ellipsis-line small" id="print_meta_coach_line">—</span>
                                    </div>
                                    <div class="d-flex align-items-center gap-1 text-muted">
                                        <i class="bi bi-people flex-shrink-0" title="选手&#10;Members" aria-hidden="true"></i>
                                        <span class="print-code-modal-ellipsis-line small" id="print_meta_member_line">—</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="code-actions d-flex align-items-center">
                        <div class="dropdown d-lg-none me-2" data-bs-popper="static">
                            <button class="btn btn-outline-secondary btn-sm dropdown-toggle" type="button" id="print_meta_dropdown_btn" data-bs-toggle="dropdown" aria-expanded="false" title="详细信息 (Details)">
                                <i class="bi bi-info-circle"></i>
                            </button>
                            <ul class="dropdown-menu dropdown-menu-end" aria-labelledby="print_meta_dropdown_btn" id="print_meta_dropdown_menu">
                                <li><h6 class="dropdown-header">打印请求 (Print request)</h6></li>
                                <li><span class="dropdown-item-text d-flex align-items-start gap-2" title="提交日期 (Submit date)">
                                    <i class="bi bi-calendar3 mt-1 flex-shrink-0"></i>
                                    <span><strong>日期</strong><span class="en-text">Date</span><br><span id="print_meta_date_dd">-</span></span>
                                </span></li>
                                <li><span class="dropdown-item-text d-flex align-items-start gap-2" title="提交时间 (Submit time)">
                                    <i class="bi bi-clock mt-1 flex-shrink-0"></i>
                                    <span><strong>时间</strong><span class="en-text">Time</span><br><span class="print-meta-datetime-hms-tz-line d-inline-flex"><span id="print_meta_time_dd">-</span><span id="print_meta_in_tz_inline_dd"></span></span></span>
                                </span></li>
                                <li><span class="dropdown-item-text d-flex align-items-start gap-2" title="代码长度 (Code length)">
                                    <i class="bi bi-file-text mt-1 flex-shrink-0"></i>
                                    <span id="print_meta_code_len_dd" class="csg-bilingual-stack small"></span>
                                </span></li>
                                <li><span class="dropdown-item-text" title="队名 (Team name)"><strong>队名</strong><span class="en-text">Team</span><br><span id="print_meta_team_name_dd">-</span></span></li>
                                <li><span class="dropdown-item-text" title="教练 (Coach)"><strong>教练</strong><span class="en-text">Coach</span><br><span id="print_meta_coach_dd">-</span></span></li>
                                <li><span class="dropdown-item-text" title="选手 (Members)"><strong>选手</strong><span class="en-text">Members</span><br><span id="print_meta_member_dd">-</span></span></li>
                                <li><span class="dropdown-item-text" title="房间或区域 (Room)"><strong>房间</strong><span class="en-text">Room</span><br><span id="print_meta_room_dd">-</span></span></li>
                                <li><span class="dropdown-item-text" title="队伍ID (Team ID)"><strong>队伍ID</strong><span class="en-text">Team ID</span><br><span id="print_meta_team_id_dd">-</span></span></li>
                                <li><span class="dropdown-item-text" title="打印ID (Print ID)"><strong>打印ID</strong><span class="en-text">Print ID</span><br><span id="print_meta_print_id_dd">-</span></span></li>
                            </ul>
                        </div>
                        <span id="print_code_modal_print_tooltip_host" class="d-inline-block align-middle me-2 print-btn-tooltip-host d-none" data-csg-tooltip-preline="true" title="打印本请求&#10;Print this request">
                            <button type="button" class="btn btn-success btn-sm d-none" id="print_code_modal_print_btn">
                                <i class="bi bi-printer"></i>
                            </button>
                        </span>
                        <button type="button" class="btn btn-danger btn-sm me-2 d-none" id="print_code_modal_deny_btn" title="拒绝该打印请求&#10;Deny this print request">
                            <i class="bi bi-x-circle"></i>
                        </button>
                        <button type="button" class="btn btn-outline-secondary btn-sm me-2" id="print_code_copy_btn" title="复制代码 (Copy code)">
                            <i class="bi bi-clipboard"></i>
                        </button>
                        <button type="button" class="btn btn-outline-secondary btn-sm" id="print_code_download_btn" title="下载代码 (Download code)">
                            <i class="bi bi-download"></i>
                        </button>
                    </div>
                </div>
            </div>
            <div class="modal-body p-0" style="margin-bottom: 10px">
                <div class="code-viewer-container">
                    <div class="code-viewer-content" id="print_code_viewer_content">
                        <div class="text-center p-5 text-muted">
                            <i class="bi bi-code-slash fs-1"></i>
                            <p class="mt-2 mb-0">加载中…</p>
                            <p class="en-text mb-0">Loading…</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</div>

<script>
    // 配置信息
    window.PRINT_STATUS_CONFIG = {
        cid: <?php echo intval($contest['contest_id']); ?>,
        print_status_ajax_url: '__CPC__/contest/print_status_ajax?cid=<?php echo intval($contest['contest_id']); ?>',
        contest_data_url: '__CPC__/contest/contest_data_ajax',
        is_print_manager: <?php echo ($printManager) ? 'true' : 'false'; ?>,
        is_contest_admin: <?php echo ($isContestAdmin) ? 'true' : 'false'; ?>,
        lodop_autoload: <?php echo (!empty($lodop_autoload) && $lodop_autoload) ? 'true' : 'false'; ?>,
        lodop_manual_eligible: <?php echo (!empty($lodop_manual_eligible) && $lodop_manual_eligible) ? 'true' : 'false'; ?>,
        lodop_funcs_js_url: <?php echo json_encode(isset($lodop_funcs_js_url) ? $lodop_funcs_js_url : '/static/lodop/LodopFuncs.js', JSON_UNESCAPED_SLASHES); ?>,
        lodop_print_control_js_url: <?php echo json_encode(isset($lodop_print_control_js_url) ? $lodop_print_control_js_url : '/static/csgoj/contest/print_control.js', JSON_UNESCAPED_SLASHES); ?>,
        disable_team_preload: true
    };
</script>

{include file="contest/print_control" /}
