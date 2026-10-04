<?php $controller = strtolower(request()->controller()); ?>
{include file="../../csgoj/view/problemset/problem_header" /}

<div class="testdata-container">
    <!-- 警告提示 -->
    <div class="alert alert-warning d-flex align-items-center mb-4" role="alert">
        <i class="bi bi-exclamation-triangle-fill me-2 fs-5"></i>
        <div>
            <span class="cn-text">每次只能下载<strong class="text-danger">一对</strong>测试数据，且每<strong class="text-danger">{$downloadWaitTime}分钟</strong>只能下载一次，请谨慎选择！</span>
            <span class="en-text">Only <strong class="text-danger">one pair</strong> of test data can be downloaded <strong class="text-danger">every {$downloadWaitTime} minutes</strong>, please consider carefully!</span>
        </div>
    </div>

    {if isset($attach_notify)}
    <div class="alert alert-info mb-3">
        {$attach_notify}
    </div>
    {/if}

    <!-- 测试数据表格 -->
    <div class="card shadow-sm">
        <div class="card-header bg-light">
            <h5 class="mb-0 bilingual-inline">
                <i class="bi bi-file-earmark-code me-2"></i>
                <span class="cn-text">测试数据列表</span>
                <span class="en-text">Test Data List</span>
            </h5>
        </div>
        <div class="card-body p-0">
            <table
                class="bootstraptable_refresh_local table table-hover mb-0"
                id="testdata_table"
                data-url="testdata_ajax?cid={$contest['contest_id']}&pid={$apid}"
                data-toggle="table"
                data-toolbar="#upload_toolbar"
                data-pagination="true"
                data-page-list="[10, 25, 50]"
                data-page-size="50"
                data-method="get"
                data-search="true"
                data-search-align="left"
                data-side-pagination="client"
                data-unique-id="file_name"
                data-pagination-v-align="bottom"
                data-pagination-h-align="left"
                data-pagination-detail-h-align="right"
            >
                <thead class="table-light">
                <tr>
                    <th data-field="file_serial" data-align="center" data-valign="middle" data-sortable="true" data-width="80" data-formatter="AutoId">
                        <span class="cn-text">序号</span>
                        <span class="en-text">ID</span>
                    </th>
                    <th data-field="file_name" data-align="left" data-valign="middle" data-sortable="true" data-formatter="FileDownload">
                        <span class="cn-text">文件名</span>
                        <span class="en-text">Name</span>
                    </th>
                    <th data-field="file_size" data-align="right" data-valign="middle" data-sortable="true" data-width="120">
                        <span class="cn-text">大小(KB)</span>
                        <span class="en-text">Size(KB)</span>
                    </th>
                    <th data-field="file_type" data-align="center" data-valign="middle" data-width="140">
                        <span class="cn-text">文件类型</span>
                        <span class="en-text">File Type</span>
                    </th>
                </tr>
                </thead>
            </table>
        </div>
    </div>
</div>

<input type="hidden" id="page_info" module="{$module}" controller="{$controller}">
<input type="hidden" id="contest_status" value="{$contestStatus}">

<script>
// 传递配置给 JavaScript
window.testdataConfig = {
    module_name: '{$module}',
    controller_name: '{$controller}',
    contest_id: <?php echo $contest['contest_id']; ?>,
    apid: <?php echo json_encode($apid); ?>,
    downloadWaitTime: <?php echo $downloadWaitTime; ?>,
    isAdmin: <?php echo IsAdmin() ? 'true' : 'false'; ?>
};
</script>

{css href="__STATIC__/csgoj/contest/testdata.css" /}
{js href="__STATIC__/csgoj/contest/testdata.js" /}
