<div id="contest_toolbar" class="table-toolbar">
    <div class="d-flex align-items-center gap-2" role="form">
        <button id="contest_refresh" type="button" class="btn btn-outline-secondary toolbar-btn" title="刷新 (Refresh)">
            <i class="bi bi-arrow-clockwise"></i>
        </button>
        <button id="contest_clear" type="button" class="btn btn-outline-secondary toolbar-btn" title="清空筛选条件 (Clear)">
            <i class="bi bi-eraser"></i>
        </button>
        <div class="toolbar-group">
            <span class="toolbar-label-inline"><span>时间状态</span><span class="toolbar-label en-text">Time Status</span></span>
            <select name="status" class="form-select toolbar-select contest_filter">
                <option value="-1">
                    全部 <span class="en-text">All</span>
                </option>
                <option value="0">
                    未开始 <span class="en-text">Not Started</span>
                </option>
                <option value="1">
                    进行中 <span class="en-text">Running</span>
                </option>
                <option value="2">
                    已结束 <span class="en-text">Ended</span>
                </option>
            </select>
        </div>
        <div class="toolbar-group">
            <span class="toolbar-label-inline"><span>搜索</span><span class="toolbar-label en-text">Search</span></span>
            <input id="contest_search_input" name="search" class="form-control toolbar-input contest_filter" type="text" placeholder="标题/ID" style="width: 200px;">
        </div>
    </div>
</div>

<table
    id="contest_list_table"
    class="bootstraptable_refresh_local"
    data-toggle="table"
    data-url="/{$module}/{$controller}/contest_list_ajax"
    data-pagination="true"
    data-page-list="[25,50,100]"
    data-page-size="25"
    data-side-pagination="client"
    data-method="get"
    data-striped="true"
    data-search="false"
    data-search-align="left"
    data-sort-name="contest_id"
    data-sort-order="desc"
    data-pagination-v-align="bottom"
    data-pagination-h-align="left"
    data-pagination-detail-h-align="right"
    data-classes="table-no-bordered table table-hover"
    data-toolbar="#contest_toolbar"
    data-filter-control="true"
    data-filter-show-clear="true"
>
    <thead>
    <tr>
        <th data-field="contest_id" data-align="center" data-valign="middle"  data-sortable="false" data-width="55">ID<span class="en-text">ID</span></th>
        <th data-field="title"      data-align="left"   data-valign="middle"  data-sortable="false" data-formatter="FormatterContestTitle">考试标题<span class="en-text">Exam Title</span></th>
        <th data-field="status"     data-align="center" data-valign="middle"  data-sortable="false" data-width="40" data-formatter="FormatterContestTimeStatus">状态<span class="en-text">Status</span></th>
        <th data-field="start_time" data-align="center" data-valign="middle"  data-sortable="false" data-width="180" data-formatter="FormatterDate">开始<span class="en-text">Start</span></th>
        <th data-field="end_time"   data-align="center" data-valign="middle"  data-sortable="false" data-width="180" data-formatter="FormatterDate">结束<span class="en-text">End</span></th>
    </tr>
    </thead>
</table>

<input type="hidden" id="page_info" page_module="{$module}" page_controller="{$controller}" current_time="{$current_time}">

{js href="__STATIC__/csgoj/oj_contest.js"}

<script type="text/javascript">
// 比赛管理配置
window.ContestConfig = {
    module: "<?php echo $module; ?>"
};

let page_info = $('#page_info');
let current_time = page_info.attr('current_time');
let front_backend_time_diff = new Date(current_time * 1000).getTime()-new Date().getTime();
let page_module = page_info.attr('page_module');

// 初始化比赛列表工具栏（客户端筛选）
initBootstrapTableClientToolbar({
    tableId: 'contest_list_table',
    prefix: 'contest',
    filterSelectors: ['status'],
    searchInputId: 'contest_search_input',
    searchFields: {
        title: 'title',
        contest_id: 'contest_id'
    }
});

// F5刷新处理
$(window).keydown(function(e) {
    if (e.keyCode == 116 && !e.ctrlKey) {
        if(window.event){
            try{e.keyCode = 0;}catch(e){}
            e.returnValue = false;
        }
        e.preventDefault();
        $('#contest_list_table').bootstrapTable('refresh');
    }
});
</script>
