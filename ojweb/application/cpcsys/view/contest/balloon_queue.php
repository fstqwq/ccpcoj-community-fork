{css file="__STATIC__/csgoj/contest/balloon_manager.css" /}
{include file="../../csgoj/view/public/js_rank"}
{include file="../../csgoj/view/public/base_select" /}
{include file="../../csgoj/view/public/base_csg_switch" /}
{js href="__STATIC__/csgoj/contest/balloon_manager.js?v=20261004_ccpc1" /}

<!-- 气球队列：赛管统计在页头右侧；配送员统计在下方工作区（可与主表一同沉浸全屏） -->
<div class="admin-page-header admin-page-header--balloon-queue mb-2">
    <div class="admin-page-header-left">
        <div class="admin-page-header-icon">
            <i class="bi bi-balloon-heart-fill text-danger"></i>
        </div>
        <h1 class="admin-page-header-title">
            <div class="admin-page-header-title-main">气球队列</div>
            <div class="admin-page-header-title-right">
                <a href="__CPC__/contest/contest?cid={$contest['contest_id']}" class="admin-page-header-id">
                    <i class="bi bi-hash"></i> {$contest['contest_id']}
                </a>
                <span class="en-text">Balloon Queue</span>
            </div>
        </h1>
    </div>
    {if $balloonSender && !$balloonManager && !$isContestAdmin}
    <div class="admin-page-header-right balloon-queue-header-sender-actions">
        <button type="button"
                class="btn btn-sm btn-outline-secondary balloon-queue-sender-fs-enter-btn"
                id="balloon-queue-sender-fs-enter"
                title="全屏：统计与列表占满视窗，便于手机查看 / Fullscreen: stats and list fill the viewport for mobile">
            <i class="bi bi-arrows-fullscreen" aria-hidden="true"></i>
            <span class="ms-1">全屏</span><en-text>Fullscreen</en-text>
        </button>
    </div>
    {else /}
    <div class="admin-page-header-right balloon-queue-header-stats">
        <div class="balloon-global-stats balloon-global-stats--in-header" id="balloon-queue-stats">
            <div class="balloon-stat-item" data-status="0" title-cn="未发气球" title-en="Not Sent">
                <span class="balloon-stat-label">未处理<en-text>Not Sent</en-text></span>
                <span class="balloon-stat-value" id="balloon-stat-value-0">0</span>
            </div>
            <div class="balloon-stat-item" data-status="10" title-cn="已通知" title-en="Printed/Issued">
                <span class="balloon-stat-label">已通知<en-text>Printed</en-text></span>
                <span class="balloon-stat-value" id="balloon-stat-value-10">0</span>
            </div>
            <div class="balloon-stat-item" data-status="20" title-cn="已分配" title-en="Assigned">
                <span class="balloon-stat-label">已分配<en-text>Assigned</en-text></span>
                <span class="balloon-stat-value" id="balloon-stat-value-20">0</span>
            </div>
            <div class="balloon-stat-item" data-status="30" title-cn="已发放" title-en="Delivered">
                <span class="balloon-stat-label">已发放<en-text>Delivered</en-text></span>
                <span class="balloon-stat-value" id="balloon-stat-value-30">0</span>
            </div>
        </div>
    </div>
    {/if}
</div>
{if $balloonSender && !$balloonManager && !$isContestAdmin}
<div id="balloon-queue-sender-work-region" class="balloon-queue-sender-work-region">
{/if}
{if $balloonSender && !$balloonManager && !$isContestAdmin}
    <div class="balloon-queue-sender-fs-topbar" aria-hidden="true">
        <button type="button"
                class="btn btn-sm btn-outline-secondary"
                id="balloon-queue-sender-fs-exit"
                title="退出全屏（或按 Esc） / Exit fullscreen (or press Esc)">
            <i class="bi bi-fullscreen-exit" aria-hidden="true"></i>
            <span class="ms-1">退出全屏</span><en-text>Exit fullscreen</en-text>
        </button>
    </div>
    <div class="balloon-queue-sender-stats-row px-2 px-md-3 mb-2">
        <div class="balloon-global-stats balloon-global-stats--in-header" id="balloon-queue-stats">
            <div class="balloon-stat-item" data-status="0" title-cn="未发气球" title-en="Not Sent">
                <span class="balloon-stat-label">未处理<en-text>Not Sent</en-text></span>
                <span class="balloon-stat-value" id="balloon-stat-value-0">0</span>
            </div>
            <div class="balloon-stat-item" data-status="10" title-cn="已通知" title-en="Printed/Issued">
                <span class="balloon-stat-label">已通知<en-text>Printed</en-text></span>
                <span class="balloon-stat-value" id="balloon-stat-value-10">0</span>
            </div>
            <div class="balloon-stat-item" data-status="20" title-cn="已分配" title-en="Assigned">
                <span class="balloon-stat-label">已分配<en-text>Assigned</en-text></span>
                <span class="balloon-stat-value" id="balloon-stat-value-20">0</span>
            </div>
            <div class="balloon-stat-item" data-status="30" title-cn="已发放" title-en="Delivered">
                <span class="balloon-stat-label">已发放<en-text>Delivered</en-text></span>
                <span class="balloon-stat-value" id="balloon-stat-value-30">0</span>
            </div>
        </div>
    </div>
{/if}
{if $balloonSender && !$balloonManager && !$isContestAdmin}
<div class="container-fluid balloon-queue-page px-2 px-md-3 pb-3 balloon-queue-page--sender-touch">
{else /}
<div class="container-fluid balloon-queue-page px-2 px-md-3 pb-3">
{/if}
    
    <!-- 加载提示 -->
    <div id="balloon-queue-loading" class="text-center py-5" style="display: none;">
        <div class="spinner-border text-primary" role="status">
            <span class="visually-hidden">加载中...</span>
        </div>
        <div class="mt-2">加载中...<en-text>Loading...</en-text></div>
    </div>
    
    <!-- 配送员标签页 -->
    {if $balloonSender && !$balloonManager && !$isContestAdmin}
    <ul class="nav nav-tabs mb-2 nav-justified balloon-sender-tabs" role="tablist">
        <li class="nav-item" role="presentation">
            <button class="nav-link active" 
                    id="tab-queue" 
                    type="button" 
                    data-bs-toggle="tab"
                    data-bs-target="#tab-pane-queue"
                    aria-controls="tab-pane-queue"
                    aria-selected="true">
                气球队列<en-text>Balloon Queue</en-text>
            </button>
        </li>
        <li class="nav-item" role="presentation">
            <button class="nav-link" 
                    id="tab-my-balloons" 
                    type="button" 
                    data-bs-toggle="tab"
                    data-bs-target="#tab-pane-my-balloons"
                    aria-controls="tab-pane-my-balloons"
                    aria-selected="false">
                我的气球<en-text>My Balloons</en-text>
            </button>
        </li>
    </ul>
    {/if}
    
    <!-- 自动打印小票（与下方筛选条同一紧凑面板语言） -->
    {if $balloonManager || $isContestAdmin}
    <div class="balloon-ticket-toolbar balloon-queue-print-panel mb-2">
        <div class="balloon-ticket-toolbar__main">
            <div class="balloon-ticket-toolbar__strip">
                <div class="balloon-ticket-feature-stack">
                    <div class="balloon-ticket-feature-countdown text-info text-center"
                         id="balloon-print-countdown"
                         style="display:none;"
                         aria-live="polite">(<strong id="balloon-print-countdown-text">10</strong>s)</div>
                    <div class="csg-switch">
                        <input type="checkbox"
                               class="csg-switch-input"
                               id="balloon-ticket-feature-box"
                               data-csg-size="sm"
                               data-csg-theme="primary"
                               data-csg-animate="true"
                               data-csg-text-on="小票开"
                               data-csg-text-on-en="Tickets on"
                               data-csg-text-off="小票关"
                               data-csg-text-off-en="Tickets off">
                    </div>
                </div>
                <div class="balloon-ticket-inline-wrap" id="balloon-ticket-config" style="display:none;">
                <div class="balloon-ticket-config__row balloon-filter-row">
                <div class="balloon-filter-group">
                    <span class="balloon-filter-label" title="自动时达到每页数量后出票；手动时可双击题号出票。Auto prints when enough tickets are ready; manual mode prints by double-clicking the problem."><span>出票方式</span><span class="en-text">Print Mode</span></span>
                    <div class="d-flex align-items-center gap-1 flex-wrap">
                        <div class="csg-switch">
                            <input type="checkbox"
                                   class="csg-switch-input"
                                   id="balloon-auto-print-box"
                                   data-csg-size="sm"
                                   data-csg-theme="primary"
                                   data-csg-animate="true"
                                   data-csg-text-on="自动"
                                   data-csg-text-on-en="Auto"
                                   data-csg-text-off="手动"
                                   data-csg-text-off-en="Manual">
                        </div>
                    </div>
                </div>
                <div class="balloon-filter-group balloon-ticket-paper-dims">
                    <div class="balloon-ticket-paper-dims__controls">
                        <div class="balloon-filter-group balloon-ticket-mm-field">
                            <div class="balloon-ticket-field-label-with-help">
                                <span class="balloon-filter-label"><span>纸宽</span><span class="en-text">Width</span></span>
                                <i class="bi bi-question-circle text-info balloon-ticket-help-icon"
                                   title="纸宽（毫米）：与热敏卷/票据纸的物理宽度一致；小票上同一行字沿左右方向排布。Paper width (mm): physical roll width; one line of text runs left–right on the slip."
                                   aria-label="纸宽说明 Paper width hint"></i>
                            </div>
                            <input type="number"
                                   class="form-control form-control-sm balloon-ticket-toolbar-input"
                                   id="balloon-print-paper-width-mm"
                                   name="balloon-print-paper-width-mm"
                                   inputmode="decimal"
                                   min="10"
                                   max="500"
                                   step="1"
                                   value="57"
                                   aria-label="纸宽毫米 Paper width mm">
                        </div>
                        <button type="button"
                                class="btn btn-link balloon-print-paper-swap p-0 align-self-end text-decoration-none text-info"
                                id="balloon-print-paper-dim-swap"
                                title="交换纸宽与走纸 / Swap width and feed"
                                aria-label="交换纸宽与走纸 Swap paper width and feed">×</button>
                        <div class="balloon-filter-group balloon-ticket-mm-field">
                            <div class="balloon-ticket-field-label-with-help">
                                <span class="balloon-filter-label"><span>走纸</span><span class="en-text">Feed</span></span>
                                <i class="bi bi-question-circle text-info balloon-ticket-help-icon"
                                   title="走纸（毫米）：沿打印机送纸方向的尺寸；多行内容沿上下方向叠放。与纸宽一起决定小票版面比例。Feed length (mm): advance direction; multiple lines stack top–bottom. Together with width it sets the slip layout."
                                   aria-label="走纸说明 Feed length hint"></i>
                            </div>
                            <input type="number"
                                   class="form-control form-control-sm balloon-ticket-toolbar-input"
                                   id="balloon-print-paper-feed-mm"
                                   name="balloon-print-paper-feed-mm"
                                   inputmode="decimal"
                                   min="10"
                                   max="500"
                                   step="1"
                                   value="50"
                                   aria-label="走纸长度毫米 Feed length mm">
                        </div>
                        <div class="balloon-filter-group balloon-ticket-mm-field">
                            <div class="balloon-ticket-field-label-with-help">
                                <span class="balloon-filter-label"><span>纸宽缩减</span><span class="en-text">Width trim</span></span>
                                <i class="bi bi-question-circle text-info balloon-ticket-help-icon"
                                   title="纸宽缩减（毫米）：在左侧「纸宽」基础上再收紧一点排版宽度；「走纸」不变。57/58mm 等小卷纸若左右裁字，可先试 1～3；默认 0，最大 20。Width trim (mm): narrows layout vs the width above; feed unchanged. If text clips at the sides on narrow rolls, try 1–3; default 0, max 20."
                                   aria-label="纸宽缩减说明 Width trim hint"></i>
                            </div>
                            <input type="number"
                                   class="form-control form-control-sm balloon-ticket-toolbar-input"
                                   id="balloon-print-paper-width-trim-mm"
                                   name="balloon-print-paper-width-trim-mm"
                                   inputmode="decimal"
                                   min="0"
                                   max="20"
                                   step="0.5"
                                   value="0"
                                   aria-label="纸宽缩减毫米 Width trim mm">
                        </div>
                        <div class="balloon-filter-group balloon-ticket-preset-field">
                            <div class="balloon-ticket-field-label-with-help">
                                <span class="balloon-filter-label"><span>常见规格</span><span class="en-text">Presets</span></span>
                                <i class="bi bi-question-circle text-info balloon-ticket-help-icon"
                                   title="常见规格：选一项会同时填入左侧纸宽与走纸两格，随后下拉恢复为「—」以便再选其它规格。Presets: choosing one fills both width and feed, then the menu resets to “—” for another pick."
                                   aria-label="常见规格说明 Presets hint"></i>
                            </div>
                            <select class="form-select form-select-sm"
                                    id="balloon-print-paper-preset"
                                    name="balloon-print-paper-preset"
                                    title="选一项填入纸宽与走纸 / Pick a preset to fill width and feed">
                                <option value="">—</option>
                                <option value="57x30">57 × 30</option>
                                <option value="57x50">57 × 50</option>
                                <option value="58x80">58 × 80</option>
                                <option value="58x100">58 × 100</option>
                                <option value="76x130">76 × 130</option>
                                <option value="80x60">80 × 60</option>
                                <option value="80x80">80 × 80</option>
                                <option value="80x100">80 × 100</option>
                                <option value="80x120">80 × 120</option>
                                <option value="100x150">100 × 150</option>
                                <option value="148x210">148 × 210 (A5)</option>
                                <option value="210x297">210 × 297 (A4)</option>
                            </select>
                        </div>
                    </div>
                </div>
                <div class="balloon-filter-group">
                    <span class="balloon-filter-label"><span>每页数量</span><span class="en-text">Per Page</span></span>
                    <input type="number" class="form-control form-control-sm balloon-ticket-toolbar-input" id="balloon-print-per-page" placeholder="1" min="1" max="1" value="1">
                    <span id="balloon-print-max-count" class="visually-hidden" aria-hidden="true">1</span>
                </div>
                <div class="balloon-filter-group">
                    <span class="balloon-filter-label balloon-print-thermal-label" title="关闭：彩色题号与符号，适合屏幕预览或彩打。开启：热敏/单色优化（黑框、文字标记）。Unchecked: color badge &amp; marks. On: thermal-friendly layout."><span>样式</span><span class="en-text">Style</span></span>
                    <div class="csg-switch">
                        <input type="checkbox"
                               class="csg-switch-input"
                               id="balloon-print-thermal-mode"
                               checked
                               data-csg-size="sm"
                               data-csg-theme="secondary"
                               data-csg-animate="true"
                               data-csg-text-on="热敏优化"
                               data-csg-text-on-en="Thermal"
                               data-csg-text-off="彩色方案"
                               data-csg-text-off-en="Color">
                    </div>
                </div>
                </div>
                </div>
                </div>
        </div>
    </div>
    {/if}
    
    <!-- 筛选器：独占整行（不用 data-toolbar，避免与表格内置工具栏同一行留白） -->
    {if $balloonManager || $isContestAdmin}
    <div id="balloon-queue-toolbar" class="table-toolbar balloon-queue-toolbar-row mb-2">
        <div class="balloon-filter-container">
            <div class="balloon-filter-row">
                {if isset($contestGroupContext) && intval($contestGroupContext['is_multi_group']) == 1}
                <div class="balloon-filter-group">
                    <span class="balloon-filter-label"><span>分组</span><span class="en-text">Group</span></span>
                    <select class="multiple-select" id="filter-groups" name="filter-groups" multiple {if isset($balloonStaffGroupIds) && count($balloonStaffGroupIds) > 0}disabled{/if}>
                        {foreach $contestGroupContext['groups'] as $g}
                        {php}
                            $gid = strval($g['group_id'] ?? '');
                            $gname = strval($g['group_name'] ?? $gid);
                            $selected = (isset($balloonStaffGroupIds) && in_array($gid, $balloonStaffGroupIds, true)) ? 'selected' : '';
                        {/php}
                        <option value="{$gid}" {$selected}>{$gname} ({$gid})</option>
                        {/foreach}
                    </select>
                </div>
                {/if}
                <div class="balloon-filter-group">
                    <span class="balloon-filter-label"><span>配送员</span><span class="en-text">Balloon Sender</span></span>
                    <select class="multiple-select" id="filter-sender" name="filter-sender">
                        <option value="">全部 All</option>
                    </select>
                </div>
                <div class="balloon-filter-group{if isset($balloonStaffRoomLock) && count($balloonStaffRoomLock) > 0} balloon-filter-group--zone-locked{/if}">
                    <span class="balloon-filter-label" title="{if isset($balloonStaffRoomLock) && count($balloonStaffRoomLock) > 0}列表仅显示您负责分区内的气球&#10;Only balloons in your assigned zones{else /}按分区筛选气球&#10;Filter balloons by zone{/if}"><span>分区</span><span class="en-text">Zone</span></span>
                    {if isset($balloonStaffRoomLock) && count($balloonStaffRoomLock) > 0}
                    <button type="button" id="balloon-zone-lock-field" class="balloon-zone-lock-field" title="您负责的分区范围；点击可查看名称&#10;Your assigned zones; click to view names" aria-expanded="false" aria-haspopup="dialog">
                        <span class="balloon-zone-lock-field__count" aria-hidden="true"></span>
                        <span class="balloon-zone-lock-field__summary"></span>
                        <span class="balloon-zone-lock-field__lock" title="分区范围已指定，不可在此修改&#10;Zone scope is assigned and cannot be changed here" aria-hidden="true"><i class="bi bi-lock-fill"></i></span>
                    </button>
                    {else /}
                    <select class="multiple-select" id="filter-rooms" name="filter-rooms" multiple>
                        <!-- room筛选器将在这里动态生成 -->
                    </select>
                    {/if}
                </div>
                <div class="balloon-filter-group">
                    <span class="balloon-filter-label"><span>学校</span><span class="en-text">School</span></span>
                    <select class="multiple-select" id="filter-schools" name="filter-schools" multiple>
                        <!-- school筛选器将在这里动态生成 -->
                    </select>
                </div>
                <div class="balloon-filter-group">
                    <span class="balloon-filter-label"><span>题号</span><span class="en-text">Problem</span></span>
                    <select class="multiple-select" id="filter-problems" name="filter-problems" multiple>
                        <!-- problem筛选器将在这里动态生成 -->
                    </select>
                </div>
                <div class="balloon-filter-group balloon-filter-group--search">
                    <span class="balloon-filter-label"><span>搜索</span><span class="en-text">Search</span></span>
                    <input type="text" 
                           class="form-control form-control-sm balloon-filter-input" 
                           id="filter-search" 
                           name="filter-search"
                           placeholder="队伍ID/队名"
                           title="队伍ID/队名 Team ID/Name">
                </div>
                <div class="balloon-filter-group balloon-filter-group--actions">
                    <button type="button" 
                            class="btn btn-outline-secondary btn-sm" 
                            id="balloon-filter-clear"
                            title="清空所有筛选条件 Clear all filters">
                        <i class="bi bi-x-circle"></i> 清空<en-text>Clear</en-text>
                    </button>
                </div>
            </div>
        </div>
    </div>
    {/if}
    
    <!-- 表格容器（与 teamgen 预览表一致的紧凑密度） -->
    <div class="card balloon-queue-data-card border-0 shadow-sm">
        <div class="card-body p-0">
            <div class="table-responsive teamgen-table-wrap">
            <table id="balloon-queue-table" 
                    data-pagination="true"
                    data-page-list="[10, 25, 50{if $balloonManager || $isContestAdmin}, 100{/if}]"
                    data-page-size="25"
                    data-side-pagination="client"
                    data-sort-name="in_date"
                    data-sort-order="asc"
                    data-search="false"
                    data-classes="table table-sm table-striped table-hover balloon-queue-compact-table"
                    data-pagination-v-align="bottom"
                    data-pagination-h-align="left"
                    data-pagination-detail-h-align="right"
                    data-row-style="RowFormatterBalloonQueue">
                <thead>
                    <tr>
                        <th data-field="idx" data-align="center" data-valign="middle" data-sortable="true" data-width="44" data-formatter="FormatterIdx" data-cell-style="cellStyleBalloonQueueIdx" title="#"><span class="teamgen-th-stack"><span class="teamgen-th-cn">#</span><span class="teamgen-th-en en-text">#</span></span></th>
                        {if $balloonManager || $isContestAdmin}
                        <th data-field="school" data-align="left" data-valign="middle" data-sortable="true" data-formatter="FormatterBalloonQueueSchool" data-cell-style="cellStyleBalloonQueueSchool" title="学校/组织 / School"><span class="teamgen-th-stack"><span class="teamgen-th-cn">学校/组织</span><span class="teamgen-th-en en-text">School</span></span></th>
                        <th data-field="team_name" data-align="left" data-valign="middle" data-sortable="true" data-cell-style="cellStyleBalloonQueueTeamName" title="队名 / Team Name"><span class="teamgen-th-stack"><span class="teamgen-th-cn">队名</span><span class="teamgen-th-en en-text">Name</span></span></th>
                        <th data-field="room" data-align="left" data-valign="middle" data-sortable="true" data-width="120" data-formatter="FormatterBalloonRoom" data-cell-style="cellStyleBalloonQueueZones" title="分区 / Zone"><span class="teamgen-th-stack"><span class="teamgen-th-cn">分区</span><span class="teamgen-th-en en-text">Zone</span></span></th>
                        {elseif $balloonSender && !$balloonManager && !$isContestAdmin}
                        <th data-field="room" data-align="left" data-valign="middle" data-sortable="true" data-width="120" data-formatter="FormatterBalloonRoom" data-cell-style="cellStyleBalloonQueueZones" title="分区 / Zone"><span class="teamgen-th-stack"><span class="teamgen-th-cn">分区</span><span class="teamgen-th-en en-text">Zone</span></span></th>
                        {/if}
                        <th data-field="team_id" data-align="center" data-valign="middle" data-sortable="true" data-width="100" data-formatter="FormatterBalloonTeamId" data-cell-style="cellStyleBalloonQueueTeamId" title="队伍ID / Team ID"><span class="teamgen-th-stack"><span class="teamgen-th-cn">队伍ID</span><span class="teamgen-th-en en-text">Team ID</span></span></th>
                        <th data-field="problem_num" data-align="center" data-valign="middle" data-sortable="true" data-sorter="SorterBalloonQueueProblemNum" data-width="72" data-formatter="FormatterBalloonProblem" data-cell-style="cellStyleBalloonQueueProblem" title="题号 / Problem"><span class="teamgen-th-stack"><span class="teamgen-th-cn">题号</span><span class="teamgen-th-en en-text">Prob.</span></span></th>
                        {if $balloonManager || $isContestAdmin}
                        <th data-field="first_blood" data-align="center" data-valign="middle" data-sortable="false" data-width="72" data-formatter="FormatterBalloonFirstBlood" data-cell-style="cellStyleBalloonQueueFb" title="首答 / First Blood"><span class="teamgen-th-stack"><span class="teamgen-th-cn">首答</span><span class="teamgen-th-en en-text">FB</span></span></th>
                        {/if}
                        <th data-field="bst" data-align="center" data-valign="middle" data-sortable="true" data-width="136" data-formatter="FormatterBalloonStatus" data-cell-style="cellStyleBalloonQueueStatus" title="状态 / Status"><span class="teamgen-th-stack"><span class="teamgen-th-cn">状态</span><span class="teamgen-th-en en-text">Status</span></span></th>
                        {if $balloonManager || $isContestAdmin}
                        <th data-field="balloon_sender" data-align="center" data-valign="middle" data-sortable="true" data-width="108" data-formatter="FormatterBalloonSender" data-cell-style="cellStyleBalloonQueueSender" title="配送员 / Sender"><span class="teamgen-th-stack"><span class="teamgen-th-cn">配送员</span><span class="teamgen-th-en en-text">Sender</span></span></th>
                        {/if}
                        
                        <th data-field="in_date" data-align="center" data-valign="middle" data-sortable="true" data-width="120" data-formatter="FormatterTime" data-cell-style="cellStyleBalloonQueueTime" title="时间 / Time"><span class="teamgen-th-stack"><span class="teamgen-th-cn">时间</span><span class="teamgen-th-en en-text">Time</span></span></th>
                    </tr>
                </thead>
            </table>
            </div>
        </div>
    </div>
</div>
{if $balloonSender && !$balloonManager && !$isContestAdmin}
</div>
{/if}
<script>
    // 配置信息（需要包含父类RankSystem所需的所有配置）
    window.RANK_CONFIG = {
        key: 'balloon_queue_<?php echo $contest['contest_id']; ?>',
        cid_list: '<?php echo $contest['contest_id']; ?>',
        api_url: '/cpcsys/contest/balloon_data_ajax',
        contest_data_api_url: '/cpcsys/contest/contest_data_ajax',
        school_badge_url: '/static/image/school_badge',
        region_flag_url: '/static/image/region_flag',
        backend_time_diff: 0,
        flg_show_page_contest_title: false,
        flg_show_fullscreen_contest_title: false,
        flg_rank_cache: false,
        flg_show_time_progress: false,
        flg_show_controls_toolbar: false,
    };
    
    window.BALLOON_QUEUE_CONFIG = {
        is_balloon_manager: <?php echo ($balloonManager || $isContestAdmin) ? 'true' : 'false'; ?>,
        is_balloon_sender: <?php echo $balloonSender ? 'true' : 'false'; ?>,
        current_user: <?php echo $contest_user ? "'" . addslashes($contest_user) . "'" : 'null'; ?>,
        team_room: <?php echo isset($teaminfo['room']) && $teaminfo['room'] ? "'" . addslashes($teaminfo['room']) . "'" : 'null'; ?>,
        change_status_url: '/cpcsys/contest/balloon_change_status_ajax',
        is_multi_group: <?php echo (isset($contestGroupContext) && intval($contestGroupContext['is_multi_group']) == 1) ? 'true' : 'false'; ?>,
        staff_group_ids: <?php echo json_encode(isset($balloonStaffGroupIds) ? $balloonStaffGroupIds : [], JSON_UNESCAPED_UNICODE); ?>,
        staff_room_tokens: <?php echo json_encode(isset($balloonStaffRoomLock) ? $balloonStaffRoomLock : [], JSON_UNESCAPED_UNICODE); ?>,
        contest_groups: <?php echo json_encode(isset($contestGroupContext['groups']) ? $contestGroupContext['groups'] : [], JSON_UNESCAPED_UNICODE); ?>
    };
</script>
<script>
    // 初始化气球队列系统（external mode，不依赖容器）
    const queueSystem = new BalloonQueueSystem(null, window.BALLOON_QUEUE_CONFIG);
    window.balloonQueueSystem = queueSystem;
</script>
