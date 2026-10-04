<div id="contest_toolbar" class="table-toolbar">
    <div class="d-flex align-items-center gap-2" role="form">
        <button id="contest_refresh" type="button" class="btn btn-outline-secondary toolbar-btn" title="刷新 (Refresh)">
            <i class="bi bi-arrow-clockwise"></i>
        </button>
        <button id="contest_clear" type="button" class="btn btn-outline-secondary toolbar-btn" title="清空筛选条件 (Clear)">
            <i class="bi bi-eraser"></i>
        </button>
        {if $module != 'cpcsys'}
        <div class="toolbar-group">
            <span class="toolbar-label-inline"><span>类型</span><span class="toolbar-label en-text">Type</span></span>
            <select name="private" class="form-select toolbar-select contest_filter">
                <option value="-1">
                    全部 <span class="en-text">All</span>
                </option>
                <option value="0">
                    公开 <span class="en-text">Public</span>
                </option>
                <option value="5">
                    加密 <span class="en-text">Encrypted</span>
                </option>
                <option value="1">
                    私有 <span class="en-text">Private</span>
                </option>
                {if $module == 'admin'}
                <option value="2">
                    标准 <span class="en-text">Standard</span>
                </option>
                {/if}
            </select>
        </div>
        {/if}
        {if isset($is_admin) && $is_admin}
        <div class="toolbar-group">
            <span class="toolbar-label-inline"><span>公开状态</span><span class="toolbar-label en-text">Contest Status</span></span>
            <select name="defunct" class="form-select toolbar-select contest_filter">
                <option value="-1">
                    全部 <span class="en-text">All</span>
                </option>
                <option value="0">
                    公开 <span class="en-text">Public</span>
                </option>
                <option value="1">
                    隐藏 <span class="en-text">Hidden</span>
                </option>
            </select>
        </div>
        {/if}
        <div class="toolbar-group">
            <span class="toolbar-label-inline"><span>时间状态</span><span class="toolbar-label en-text">Time Status</span></span>
            <select name="status" class="form-select toolbar-select contest_filter">
                <option value="-1">
                    All
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
    class="{if isset($is_admin) && $is_admin}bootstraptable_refresh_local{/if}"
    data-toggle="table"
    data-url="/{$module}/{$controller}/contest_list_ajax"
    data-pagination="true"
    data-page-list="[25,50,100]"
    data-page-size="25"
    data-side-pagination="client"
    data-method="get"
    {if !isset($is_admin) || !$is_admin}data-striped="true"{/if}
    data-search="false"
    data-search-align="left"
    data-sort-name="contest_id"
    data-sort-order="desc"
    data-pagination-v-align="bottom"
    data-pagination-h-align="left"
    data-pagination-detail-h-align="right"
    {if !isset($is_admin) || !$is_admin}data-classes="table-no-bordered table table-hover"{/if}
    data-toolbar="#contest_toolbar"
    data-filter-control="true"
    data-filter-show-clear="true"

>
    <thead>
    <tr>
        <th data-field="contest_id" data-align="center" data-valign="middle"  data-sortable="{if isset($is_admin) && $is_admin}true{else}false{/if}" data-width="55" {if isset($is_admin) && $is_admin}data-formatter="FormatterContestIdForBanner"{/if}>ID<span class="en-text">ID</span></th>
        <th data-field="title" data-align="left" data-valign="middle"  data-sortable="false" data-formatter="FormatterContestTitle">标题<span class="en-text">Title</span></th>
        {if isset($is_admin) && $is_admin}
        <th data-field="defunct" data-align="center" data-valign="middle"  data-formatter="FormatterDefunctContest"  data-width="60">状态<span class="en-text">Status</span></th>
        <th data-field="edit" data-align="center" data-valign="middle"  data-formatter="FormatterContestEdit"  data-width="60">编辑<span class="en-text">Edit</span></th>
        <th data-field="copy" data-align="center" data-valign="middle"  data-formatter="FormatterContestCopy"  data-width="60">复制<span class="en-text">Copy</span></th>
        <th data-field="attach" data-align="center" data-valign="middle"  data-formatter="FormatterContestAttach"  data-width="60">附件<span class="en-text">Attach</span></th>
        <th data-field="rejudge" data-align="center" data-valign="middle"  data-formatter="FormatterContestRejudge"  data-width="60">重判<span class="en-text">Rejudge</span></th>
        {if isset($contest_super_delete) && $contest_super_delete}
        <th data-field="delete" data-align="center" data-valign="middle" data-formatter="FormatterContestSuperDelete" data-width="60">删除<span class="en-text">Delete</span></th>
        {/if}
        {if isset($contest_archive_column) && $contest_archive_column}
        <th data-field="flg_archive" data-align="center" data-valign="middle" data-formatter="FormatterContestArchive" data-width="40"
            title="归档列：绿色空心盒=未归档，灰色实心盒=已归档；悬浮操作格可见当前状态与点击后状态。Archive: green outline=not archived, gray filled=archived; hover button for tooltip.">
            <i class="bi bi-archive" aria-hidden="true"></i><span class="visually-hidden">归档<span class="en-text">Archive</span></span>
        </th>
        {/if}
        {/if}
        <th data-field="status" data-align="center" data-valign="middle"  data-sortable="true" data-width="60" data-formatter="FormatterContestTimeStatus">状态<span class="en-text">Status</span></th>
        <th data-field="start_time" data-align="center" data-valign="middle"  data-sortable="true" data-width="70" data-formatter="FormatterDateTimeBoth">开始<span class="en-text">Start</span></th>
        <th data-field="end_time" data-align="center" data-valign="middle"  data-sortable="true" data-width="70" data-formatter="FormatterDateTimeBoth">结束<span class="en-text">End</span></th>
        <th data-field="private" data-align="center" data-valign="middle"  data-sortable="true" data-width="60" data-formatter="FormatterContestType">类型<span class="en-text">Type</span></th>
    </tr>
    </thead>
</table>
<input type="hidden" id="page_info" page_module="{$module}" time_stamp="<?php echo htmlspecialchars((string) microtime(true), ENT_QUOTES, 'UTF-8'); ?>">

{if isset($is_admin) && $is_admin}
<div class="modal fade" id="contest_header_banner_modal" tabindex="-1" aria-labelledby="contestHeaderBannerLabel">
    <div class="modal-dialog modal-lg modal-dialog-scrollable">
        <div class="modal-content">
            <div class="modal-header py-2">
                <h5 class="modal-title fs-6" id="contestHeaderBannerLabel">
                    <span class="cn-text"><i class="bi bi-image me-2"></i>比赛顶部图片</span><span class="en-text">Contest top banner</span>
                </h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div class="modal-body">
                <p class="text-muted small mb-2 contest-hb-hint bilingual-inline">
                    <span class="cn-text">展示在比赛页最上方。建议使用横向、主体清晰的图片，在宽屏下观感更佳。</span>
                    <span class="en-text">The image is shown at the top of this contest page. Prefer a wide, clear horizontal banner for large screens.</span>
                </p>
                <p class="text-muted small mb-3">
                    <a href="#" id="contest_hb_open_filemanager" class="text-decoration-none" target="_blank" rel="noopener"><span class="cn-text">管理比赛附件</span><span class="en-text">Manage contest attachments</span></a>
                </p>
                <input type="hidden" id="contest_hb_contest_id" value="">
                <div class="card bg-light border mb-3">
                    <div class="card-body p-2 p-md-3">
                        <div id="contest_hb_preview_empty" class="text-muted small py-4 text-center">
                            <span class="cn-text">当前未上传顶部图</span><span class="en-text d-block mt-1">No banner uploaded</span>
                        </div>
                        <div id="contest_hb_preview_wrap" class="d-none text-center">
                            <img id="contest_hb_preview_img" class="img-fluid contest-hb-preview-img" alt="" />
                        </div>
                    </div>
                </div>
                <input type="file" id="contest_hb_file" class="d-none" accept=".svg,.webp,.png,.jpg,.jpeg,image/svg+xml,image/webp,image/png,image/jpeg">
                <div class="d-flex flex-wrap gap-2 align-items-center">
                    <button type="button" class="btn btn-primary btn-sm" id="contest_hb_pick_btn">
                        <span class="cn-text"><i class="bi bi-upload me-1"></i>选择图片</span><span class="en-text">Choose image</span>
                    </button>
                    <button type="button" class="btn btn-outline-danger btn-sm" id="contest_hb_delete_btn" disabled>
                        <span class="cn-text">删除</span><span class="en-text">Remove</span>
                    </button>
                </div>
            </div>
            <div class="modal-footer py-2">
                <button type="button" class="btn btn-secondary btn-sm" data-bs-dismiss="modal"><span class="cn-text">关闭</span><span class="en-text">Close</span></button>
            </div>
        </div>
    </div>
</div>
{/if}

{js href="__STATIC__/csgoj/common/image_upload_prepare.js" /}
{js href="__STATIC__/csgoj/oj_contest.js" /}
{if isset($is_admin) && $is_admin}
{js href="__STATIC__/js/overlay.js" /}
{js href="__STATIC__/js/chunk_upload.js" /}
{js href="__STATIC__/csgoj/contest/contest_header_banner_admin.js" /}
{css href="__STATIC__/csgoj/contest/contest_header_banner.css" /}
{/if}


<script type="text/javascript">
// 比赛管理配置
window.ContestConfig = <?php echo json_encode([
    'module' => isset($module) ? (string) $module : 'admin',
    'contest_attach_web_base' => isset($contest_attach_web_base) ? (string) $contest_attach_web_base : '/upload/contest_attach',
    'banner_basename' => 'contest_header_banner',
    'contest_super_delete' => isset($contest_super_delete) && $contest_super_delete,
], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG | JSON_HEX_AMP); ?>;

let page_info = $('#page_info');
var page_module = page_info.attr('page_module');

// 根据是否为管理后台决定筛选条件
var filterSelectors = ['private', 'status'];
<?php  if(isset($is_admin) && $is_admin){ ?>
filterSelectors.push('defunct');
<?php } ?>

// 比赛类型筛选：加密 = public(0) + 密码，公开 = public(0) 且无密码，需单独判断
function contestListFilterAlgorithm(row, filters) {
    if (!row || typeof row !== 'object') return false;
    if (!filters) return true;

    var searchMatch = true;
    var filterMatch = true;
    var searchText = (filters.search !== undefined && filters.search !== '') ? String(filters.search).trim().toLowerCase() : '';
    if (searchText) {
        searchMatch = false;
        ['title', 'contest_id'].forEach(function(field) {
            if (row[field] != null && String(row[field]).toLowerCase().indexOf(searchText) >= 0) searchMatch = true;
        });
        if (!searchMatch && row.contest_id != null && String(row.contest_id).indexOf(searchText) >= 0) searchMatch = true;
    }

    filterSelectors.forEach(function(selector) {
        var fv = filters[selector];
        if (fv === undefined || fv === '' || fv === '-1') return;
        if (selector === 'private') {
            var p = parseInt(row.private, 10) || 0;
            var ckind = p % 10;
            // 加密判断：csgoj 接口会清空 password 但返回 has_pass，admin 接口返回 password
            var hasPassword = (row.has_pass === true) || (row.password != null && String(row.password).trim() !== '');
            if (fv === '0') {
                if (!(ckind === 0 && !hasPassword)) filterMatch = false;
            } else if (fv === '5') {
                if (!(ckind === 0 && hasPassword)) filterMatch = false;
            } else {
                if (ckind !== parseInt(fv, 10)) filterMatch = false;
            }
        } else {
            var rowVal = row[selector];
            if (rowVal != null) {
                if (String(rowVal) !== String(fv)) filterMatch = false;
            } else {
                filterMatch = false;
            }
        }
    });

    return searchMatch && filterMatch;
}

// 初始化比赛列表工具栏（客户端筛选）
initBootstrapTableClientToolbar({
    tableId: 'contest_list_table',
    prefix: 'contest',
    filterSelectors: filterSelectors,
    searchInputId: 'contest_search_input',
    searchFields: {
        title: 'title',
        contest_id: 'contest_id'
    },
    customFilterAlgorithm: contestListFilterAlgorithm
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
