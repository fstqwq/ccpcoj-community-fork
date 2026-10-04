{if $module=='exadmin' && $controller=='exam'}
<div class="admin-page-header">
    <div class="admin-page-header-left">
        <div class="admin-page-header-icon">
            <i class="bi bi-list-ul"></i>
        </div>
        <h1 class="admin-page-header-title">
            <div class="admin-page-header-title-main">
                考试列表
            </div>
            <div class="admin-page-header-title-right">
                <span class="en-text">Exam List</span>
            </div>
        </h1>
    </div>
    <div class="admin-page-header-actions">
        <a href="/exadmin/exam/contest_add" class="btn btn-primary btn-sm">
            <i class="bi bi-plus-circle"></i>
            <span class="cn-text">添加考试</span>
            <span class="en-text">Add Exam</span>
        </a>
    </div>
</div>

<div id="contest_toolbar" class="table-toolbar">
    <div class="d-flex align-items-center gap-2" role="form">
        <button id="contest_refresh" type="button" class="btn btn-outline-secondary toolbar-btn" title="刷新 (Refresh)">
            <i class="bi bi-arrow-clockwise"></i>
        </button>
        <button id="contest_clear" type="button" class="btn btn-outline-secondary toolbar-btn" title="清空筛选条件 (Clear)">
            <i class="bi bi-eraser"></i>
        </button>
        <div class="toolbar-group">
            <span class="toolbar-label-inline"><span>搜索</span><span class="toolbar-label en-text">Search</span></span>
            <input id="contest_search_input" name="search" class="form-control toolbar-input contest_filter" type="text" placeholder="标题/ID" style="width: 200px;">
        </div>
    </div>
</div>

<div id="contest_table_div">
    <table
        id="contest_table"
        class="bootstraptable_refresh_local"
        data-toggle="table"
        data-url="/exadmin/exam/contest_list_ajax"
        data-pagination="true"
        data-page-list="[25, 50, 100]"
        data-page-size="25"
        data-side-pagination="client"
        data-method="get"
        data-search="false"
        data-search-align="center"
        data-sort-name="contest_id"
        data-sort-order="desc"
        data-pagination-v-align="both"
        data-pagination-h-align="left"
        data-pagination-detail-h-align="right"
        data-toolbar="#contest_toolbar"
        
    >
        <thead>
        <tr>
            <th data-field="contest_id" data-align="center" data-valign="middle" data-sortable="true" data-width="55">ID<span class="en-text">ID</span></th>
            <th data-field="title"      data-align="left"   data-valign="middle" data-formatter="FormatterExpContestAdminTitle">标题<span class="en-text">Title</span></th>
            <th data-field="protected"    data-align="center" data-valign="middle"  data-width="80" data-formatter="FormatterExpContestAdminType">附加题<span class="en-text">Attach</span></th>
            <th data-field="contest_id"    data-align="center" data-valign="middle"  data-width="80"  data-formatter="FormatterDefunctExam">状态<span class="en-text">Status</span></th>
            <th data-field="edit"       data-align="center" data-valign="middle"  data-width="60" data-formatter="FormatterExpContestAdminEditExam">编辑<span class="en-text">Edit</span></th>
            <th data-field="copy"       data-align="center" data-valign="middle"  data-width="60" data-formatter="FormatterExpContestAdminCopyExam">复制<span class="en-text">Copy</span></th>
            <th data-field="attach"     data-align="center" data-valign="middle"  data-width="60" data-formatter="FormatterExpContestAdminAttachExam">附件<span class="en-text">Attach</span></th>
            <th data-field="delete"     data-align="center" data-valign="middle"  data-width="60" data-formatter="FormatterExpContestAdminDeleteExam">删除<span class="en-text">Delete</span></th>
            <th data-field="start_time" data-align="center" data-valign="middle"  data-sortable="true" data-width="70" data-formatter="FormatterDateTimeBoth">开始<span class="en-text">Start</span></th>
            <th data-field="end_time"   data-align="center" data-valign="middle"  data-sortable="true" data-width="70" data-formatter="FormatterDateTimeBoth">结束<span class="en-text">End</span></th>
        </tr>
        </thead>
    </table>
</div>
<input type="hidden" id="page_item" value="contest">
<script>
// 设置全局变量供 formatter 函数使用
window.exadmin_flg_admin = <?php echo IsAdmin() || PrivCourse('admin', $NOW_COURSE_KEY) ? "true" : "false" ?>;
// teacher：可查看/复制本课程内所有考试（复制不等同于可编辑）
window.exadmin_flg_teacher = <?php echo PrivCourse('teacher', $NOW_COURSE_KEY) ? "true" : "false" ?>;
window.exadmin_now_user_id = <?php echo session('user_id') ?>;
window.exadmin_item_name = 'contest';
</script>
{css href="__STATIC__/exadmin/exadmin.css" /}
{js href="__STATIC__/exadmin/exadmin_formatter.js" /}
{js href="__STATIC__/exadmin/contest_list.js" /}
{include file="../../admin/view/admin/js_changestatus" /}

{elseif $module=='exadmin' && $controller=='contest'}
<!-- exadmin 练习管理列表页：筛选在页标题右侧（对齐 csgoj/status、csgoj/userrank） -->

<div class="page-title-container">
    <h1 class="page-title">课程练习<span class="en-text">Course Practice</span></h1>
    <div class="page-title-actions">
        <div class="d-flex align-items-center gap-2 flex-wrap" role="form">
            <button id="contest_refresh" type="button" class="btn btn-outline-secondary toolbar-btn" title="刷新 (Refresh)">
                <i class="bi bi-arrow-clockwise"></i>
            </button>
            <button id="contest_clear" type="button" class="btn btn-outline-secondary toolbar-btn" title="清空筛选条件 (Clear)">
                <i class="bi bi-eraser"></i>
            </button>
            <div class="toolbar-group">
                <span class="toolbar-label-inline"><span>时间状态</span><span class="toolbar-label en-text">Time Status</span></span>
                <select name="status" class="form-select toolbar-select contest_filter" title="时间状态 (Time Status)" style="min-width: 7.5rem;">
                    <option value="-1">全部 <span class="en-text">All</span></option>
                    <option value="0">未开始 <span class="en-text">Not Started</span></option>
                    <option value="1">进行中 <span class="en-text">Running</span></option>
                    <option value="2">已结束 <span class="en-text">Ended</span></option>
                </select>
            </div>
            <div class="toolbar-group">
                <span class="toolbar-label-inline"><span>搜索</span><span class="toolbar-label en-text">Search</span></span>
                <input id="contest_title_filter" name="title" class="form-control toolbar-input contest_filter" type="text" placeholder="标题 / Title" style="width: 200px;" autocomplete="off">
            </div>
            <button type="button" class="btn btn-outline-primary toolbar-btn btn-csg-filter-more" id="toggleFilterSidebar" title="打开或收起侧栏中的更多筛选条件；角标为侧栏内已填附加筛选项数 (Show or hide the sidebar for more filters; badge = count of extra conditions in the sidebar)" aria-label="更多筛选 (More filters)">
                <i class="bi bi-sliders" aria-hidden="true"></i>
                <span class="badge bg-primary ms-1 align-middle" id="filterBadge" style="display: none;">0</span>
            </button>
        </div>
    </div>
</div>

<div id="filterTagsContainer" class="mb-2" style="display: none;">
    <div class="d-flex align-items-center gap-2 flex-wrap">
        <small class="text-muted">已选筛选<span class="en-text">Selected</span></small>
        <div id="filterTags"></div>
    </div>
</div>

<table
    class="bootstraptable_refresh_local"
    id="contest_list_table"
    data-toggle="table"
    data-pagination="true"
    data-page-list="[25, 50, 100]"
    data-page-size="25"
    data-side-pagination="client"
    data-method="get"
    data-toolbar-align="right"
    data-buttons-align="left"
    data-unique-id="contest_id"
    data-sort-name="contest_id"
    data-sort-order="desc"
    data-pagination-v-align="both"
    data-pagination-h-align="left"
    data-pagination-detail-h-align="right"
    data-classes="table table-sm table-no-bordered table-hover table-striped"
>
    <thead>
    <tr>
        <th data-field="contest_id" data-align="center" data-valign="middle" data-sortable="true" data-width="52">编号<span class="en-text">ID</span></th>
        <th data-field="title" data-align="left" data-valign="middle" data-formatter="FormatterContestTitle">标题<span class="en-text">Title</span></th>
        <th data-field="clss_title" data-align="left" data-valign="middle" data-formatter="FormatterExpClssTitle">班级<span class="en-text">Class</span></th>
        <th data-field="clss_year" data-align="center" data-valign="middle" data-width="76" data-formatter="FormatterExpYearSemester" data-sortable="false">年级学期<span class="en-text">Year / Term</span></th>
        <th data-field="private" data-align="center" data-valign="middle" data-formatter="FormatterExpContestAttachpro" data-width="44" title="是否包含附加题 (Has extra problems)">附加<span class="en-text">Extra</span></th>
        <th data-field="defunct" data-align="center" data-valign="middle" data-formatter="FormatterDefunctContest" data-width="56" title="启用或禁用该练习 (Enable or disable)">状态<span class="en-text">Status</span></th>
        <th data-field="edit" data-align="center" data-valign="middle" data-formatter="FormatterContestEdit" data-width="50">编辑<span class="en-text">Edit</span></th>
        <th data-field="copy" data-align="center" data-valign="middle" data-formatter="FormatterContestCopy" data-width="50">复制<span class="en-text">Copy</span></th>
        <th data-field="attach" data-align="center" data-valign="middle" data-formatter="FormatterContestAttach" data-width="50">附件<span class="en-text">Attach</span></th>
        <th data-field="rejudge" data-align="center" data-valign="middle" data-formatter="FormatterContestRejudge" data-width="50">重判<span class="en-text">Rejudge</span></th>
        <th data-field="delete" data-align="center" data-valign="middle" data-formatter="FormatterContestDelete" data-width="50">删除<span class="en-text">Delete</span></th>
        <th data-field="" data-align="center" data-valign="middle" data-formatter="FormatterExpContestTimeStatus" data-width="58" title="按开始与结束时间判断 (By start and end time)">时间状态<span class="en-text">Time Status</span></th>
        <th data-field="start_time" data-align="center" data-valign="middle" data-width="72" data-formatter="FormatterDate" data-sortable="true">开始<span class="en-text">Start</span></th>
        <th data-field="end_time" data-align="center" data-valign="middle" data-width="72" data-formatter="FormatterDate" data-sortable="true">结束<span class="en-text">End</span></th>
        <th data-field="teachers" data-align="left" data-valign="middle" data-formatter="FormatterExpClssTeachers" data-width="80">教师<span class="en-text">Teachers</span></th>
    </tr>
    </thead>
</table>

{css href="__STATIC__/exadmin/exadmin.css" /}

<script type="text/javascript">
// 比赛管理配置（供 oj_contest.js 使用）
window.ContestConfig = {
    module: "<?php echo $module; ?>"
};

// 设置页面信息变量（供 contest_filter.js 使用）
window.expContestPageInfo = {
    module: "<?php echo $module; ?>",
    controller: "<?php echo $controller; ?>",
    tableUrl: "/<?php echo $module; ?>/<?php echo $controller; ?>/contest_list_ajax",
    timeStamp: <?php echo microtime(true); ?>,
    courseKey: "<?php echo isset($NOW_COURSE_KEY) ? $NOW_COURSE_KEY : ''; ?>"
};
</script>

{js href="__STATIC__/csgoj/oj_contest.js"}
{include file="../../admin/view/admin/js_changestatus" /}
{include file="../../expsys/view/contest/contest_filter"}

{else}
<div class="d-flex align-items-center justify-content-between mb-3">
    <h1 class="page-title">课程练习<span class="en-text">Course Practice</span></h1>
    <div class="d-flex align-items-center gap-2 flex-shrink-0">
        <!-- 常用筛选：时间状态 -->
        <div class="toolbar-group">
            <select name="status" class="form-select form-select-sm contest_filter" title="时间状态 (Time Status)" style="min-width: 120px;">
                <option value="-1">全部 <span class="en-text">All</span></option>
                <option value="0">未开始 <span class="en-text">Not Started</span></option>
                <option value="1">进行中 <span class="en-text">Running</span></option>
                <option value="2">已结束 <span class="en-text">Ended</span></option>
            </select>
        </div>
        
        <!-- 搜索框 -->
        <div class="toolbar-group">
            <input id="contest_title_filter" name="title" class="form-control form-control-sm contest_filter" type="text" placeholder="搜索标题" style="width: 200px;" autocomplete="off">
        </div>
        
        <!-- 刷新按钮 -->
        <button id="contest_refresh" type="button" class="btn btn-outline-secondary btn-sm" title="刷新 (Refresh)">
            <i class="bi bi-arrow-clockwise"></i>
        </button>
        
        <!-- 清空筛选条件按钮 -->
        <button id="contest_clear" type="button" class="btn btn-outline-secondary btn-sm" title="清空筛选条件 (Clear)">
            <i class="bi bi-eraser"></i>
        </button>
        
        <!-- 切换侧边栏筛选按钮 -->
        <button type="button" class="btn btn-outline-primary btn-sm btn-csg-filter-more" id="toggleFilterSidebar" title="打开或收起侧栏中的更多筛选条件；角标为侧栏内已填附加筛选项数 (Show or hide the sidebar for more filters; badge = count of extra conditions in the sidebar)" aria-label="更多筛选">
            <i class="bi bi-sliders" aria-hidden="true"></i>
            <span class="badge bg-primary ms-1 align-middle" id="filterBadge" style="display: none;">0</span>
        </button>
    </div>
</div>

<!-- 已选筛选标签显示区域 -->
<div id="filterTagsContainer" class="mb-2" style="display: none;">
    <div class="d-flex align-items-center gap-2 flex-wrap">
        <small class="text-muted">已选筛选：</small>
        <div id="filterTags"></div>
    </div>
</div>

<table
    class="bootstraptable_refresh_local"
    id="contest_list_table"
    data-toggle="table"
    data-pagination="true"
    data-page-list="[15, 50, 100]"
    data-page-size="15"
    data-side-pagination="client"
    data-method="get"
    data-toolbar-align="right"
    data-buttons-align="left"
    data-unique-id="contest_id"
    data-sort-name="contest_id"
    data-sort-order="desc"
    data-pagination-v-align="bottom"
    data-pagination-h-align="left"
    data-pagination-detail-h-align="right"
>
    <thead>
    <tr>
        <th data-field="contest_id"     data-align="center" data-valign="middle"  data-sortable="true" data-width="55">ID</th>
        <th data-field="title"          data-align="left"   data-valign="middle"  data-formatter="FormatterExpContestTitle"  >标题</th>
        <th data-field="clss_title"     data-align="left" data-valign="middle"  data-formatter="FormatterExpClssTitle"  data-width="60">教学班级</th>
        <th data-field="clss_year"      data-align="left" data-valign="middle"      data-width="50" data-formatter="FormatterExpClssYear">年级</th>
        <th data-field="clss_semester"  data-align="left" data-valign="middle"      data-width="50" data-formatter="FormatterExpContestClssSemester">学期</th>
        <th data-field="private"        data-align="center" data-valign="middle"  data-formatter="FormatterExpContestAttachpro"  data-width="50">附加</th>
        <th data-field=""               data-align="center" data-valign="middle"  data-formatter="FormatterExpContestTimeStatus"  data-width="70">状态</th>
        <th data-field="start_time"     data-align="center" data-valign="middle"  data-width="80" data-formatter="FormatterDate">开始</th>
        <th data-field="end_time"       data-align="center" data-valign="middle"  data-width="80" data-formatter="FormatterDate">结束</th>
        <th data-field="teachers"  data-align="left" data-valign="middle"  data-formatter="FormatterExpClssTeachers"  data-width="60">教师</th>
    </tr>
    </thead>
</table>

<script type="text/javascript">
// 设置页面信息变量（替代 page_info hidden input）
window.expContestPageInfo = {
    module: "<?php echo $module; ?>",
    controller: "<?php echo $controller; ?>",
    tableUrl: "/<?php echo $module; ?>/<?php echo $controller; ?>/contest_list_ajax",
    timeStamp: <?php echo microtime(true); ?>,
    courseKey: "<?php echo isset($NOW_COURSE_KEY) ? $NOW_COURSE_KEY : ''; ?>"
};
</script>

{include file="../../expsys/view/contest/contest_filter"}
{/if}
