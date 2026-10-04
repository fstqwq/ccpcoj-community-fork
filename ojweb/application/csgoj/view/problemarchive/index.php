{css href="__STATIC__/csgoj/oj_problem.css" /}
<style>
/* 作者列：表体默认 nowrap 时仍允许多作者 tag 折行排布 */
#problemarchive_table .fixed-table-body td.problemarchive-author-cell,
#problemarchive_table .fixed-table-body th.problemarchive-author-cell {
    white-space: normal !important;
    vertical-align: top;
}
</style>
<div class="page-title-container">
    <h1 class="page-title">{$page_title}<span class="en-text">{$page_title_en}</span></h1>
    <div class="page-title-actions">
        <div class="d-flex align-items-center gap-2 flex-wrap">
            <button id="problemarchive_refresh" type="button" class="btn btn-outline-secondary toolbar-btn" title="刷新 (Refresh)">
                <i class="bi bi-arrow-clockwise"></i>
            </button>
            <button id="problemarchive_clear" type="button" class="btn btn-outline-secondary toolbar-btn" title="清空筛选条件 (Clear)">
                <i class="bi bi-eraser"></i>
            </button>
            <div class="toolbar-btn-group">
                <span class="toolbar-label-inline"><span>页码</span><span class="toolbar-label en-text">Page</span></span>
                <input id="page_jump_input" name="page_jump" class="form-control toolbar-input" type="text" value="1" style="width: 80px;" placeholder="页码">
                <button id="problemarchive_jump" type="button" class="btn btn-outline-secondary toolbar-btn" title="跳转到指定页码 (Jump to Page)">
                    <i class="bi bi-arrow-right-circle"></i>
                </button>
            </div>
            <div class="input-group" style="width: 250px;">
                <input id="problemarchive_search_input" name="search" class="form-control page-title-search-input problemarchive_filter" type="text" placeholder="{$search_placeholder}">
                <button class="btn btn-outline-secondary" type="button" id="problemarchive_search_btn" title="搜索 (Search)">
                    <i class="bi bi-search"></i>
                </button>
            </div>
        </div>
    </div>
</div>
<div id="problemarchive_toolbar" class="table-toolbar" style="display: none;">
    <!-- 工具栏内容已移到 header，此处保留空容器以避免 Bootstrap Table 报错 -->
</div>
<table
    class="bootstraptable_refresh_local"
    id="problemarchive_table"
    data-toggle="table"
    data-url="__OJ__/problemarchive/problemarchive_ajax"
    data-pagination="true"
    data-page-list="[25,50,100]"
    data-page-size="50"
    data-side-pagination="client"
    data-method="get"
    data-striped="true"
    data-search="false"
    data-search-align="left"
    data-sort-name="in_date"
    data-sort-order="desc"
    data-pagination-v-align="both"
    data-pagination-h-align="left"
    data-pagination-detail-h-align="right"
    data-toolbar="#problemarchive_toolbar"
    data-classes="table table-no-bordered table-hover table-striped"
>
    <thead>
    <tr>
        <th data-field="Idx" data-align="center" data-valign="middle" data-sortable="false" data-width="30" data-formatter="FormatterIdx"></th>
        <th data-field="source" data-align="left" data-valign="middle" data-sortable="true" data-formatter="FormatterSource">来源<span class="en-text">Source</span></th>
        <th data-field="in_date" data-align="left" data-valign="middle" data-sortable="true" data-width="120" data-formatter="FormatterDate">归档日期<span class="en-text">Archived Date</span></th>
        <th data-field="author" data-align="left" data-valign="top" data-sortable="false" data-formatter="FormatterArchiveAuthor" data-class="text-wrap problemarchive-author-cell">作者<span class="en-text">Author(s)</span></th>
    </tr>
    </thead>
</table>

<script type="text/javascript">
function FormatterArchiveAuthor(value, row, index, field) {
    if (typeof FormatProblemAuthorsHtml === 'function') {
        var h = FormatProblemAuthorsHtml(value);
        if (h) {
            return h;
        }
    }
    return value ? String(value) : '';
}

function applyArchiveSearch() {
    var searchText = $('#problemarchive_search_input').val();
    if (searchText != null) searchText = searchText.trim();
    searchText = (searchText || '').toLowerCase();
    var table = $('#problemarchive_table');
    if (!window.problemarchiveAllRows || !Array.isArray(window.problemarchiveAllRows)) {
        return;
    }
    var filteredRows = !searchText ? window.problemarchiveAllRows : window.problemarchiveAllRows.filter(function(row) {
        var source = (row && row.source ? String(row.source) : '').toLowerCase();
        var author = (row && row.author ? String(row.author) : '').toLowerCase();
        return source.indexOf(searchText) !== -1 || author.indexOf(searchText) !== -1;
    });
    window.problemarchiveApplyingFilter = true;
    table.bootstrapTable('load', filteredRows);
    window.problemarchiveApplyingFilter = false;
    table.bootstrapTable('selectPage', 1);
}

initBootstrapTableToolbar({
    tableId: 'problemarchive_table',
    prefix: 'problemarchive',
    filterSelectors: [],
    searchInputId: 'problemarchive_search_input',
    enableAnchorSync: true,
    anchorKey: 'search',
    customHandlers: {
        clear: function() {
            $('.problemarchive_filter').val('');
            csg.SetAnchor('', 'search');
            $('#problemarchive_table').bootstrapTable('refreshOptions', { searchText: '' });
            $('#problemarchive_table').bootstrapTable('refresh');
        }
    }
});

$('#problemarchive_search_btn').on('click', function() {
    applyArchiveSearch();
});
$('#problemarchive_search_input').on('keypress', function(e) {
    if (e.keyCode === 13) {
        applyArchiveSearch();
    }
});
$('#problemarchive_search_input').on('input', function() {
    csg.SetAnchor($(this).val(), 'search');
});

initPageJump('problemarchive_table', 'problemarchive_jump', 'page_jump_input');

$(function() {
    window.problemarchiveAllRows = [];
    window.problemarchiveApplyingFilter = false;
    $('#problemarchive_table').on('load-success.bs.table', function(e, data) {
        if (window.problemarchiveApplyingFilter) return;
        if (Array.isArray(data)) {
            window.problemarchiveAllRows = data.slice();
            applyArchiveSearch();
        }
    });
    var opts = $('#problemarchive_table').bootstrapTable('getOptions');
    if (opts) {
        $('#page_jump_input').val(opts.pageNumber);
    }
});

$(window).keydown(function(e) {
    if (e.keyCode === 116 && !e.ctrlKey) {
        if (window.event) {
            try { e.keyCode = 0; } catch (err) {}
            e.returnValue = false;
        }
        e.preventDefault();
        $('#problemarchive_table').bootstrapTable('refresh');
    }
});
</script>
{js href="__STATIC__/csgoj/oj_problem.js" /}
