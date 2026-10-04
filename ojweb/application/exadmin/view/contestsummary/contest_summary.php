<div class="page-title-container">
    <h1 class="page-title">
        <span class="cn-text">统计归档</span>
        <span class="en-text">Contest Summary Export</span>
    </h1>
</div>

<div class="container-fluid">
    <div class="row g-3">
        <div class="col-12 col-lg-4">
            <div class="card">
                <div class="card-header">
                    <div class="bilingual-inline">
                        <span class="cn-text">自由归档</span>
                        <span class="en-text">Free Export</span>
                    </div>
                </div>
                <div class="card-body">
                    <div class="text-muted small mb-2">
                        <span class="cn-text">输入 Contest ID（每行一个）。可选填“任务前缀”，用于区分不同归档。</span>
                        <span class="en-text">Enter contest IDs (one per line). Optional task prefix for naming.</span>
                    </div>

                    <div class="mb-2">
                        <label class="form-label bilingual-inline" for="task_name_prefix">
                            <span class="cn-text">任务前缀</span>
                            <span class="en-text">Task Prefix</span>
                        </label>
                        <input id="task_name_prefix" name="task_name_prefix" class="form-control form-control-sm" placeholder="例如：free / class52" maxlength="50">
                    </div>

                    <div class="mb-3">
                        <label class="form-label bilingual-inline" for="cid_list">
                            <span class="cn-text">Contest ID 列表</span>
                            <span class="en-text">Contest ID List</span>
                        </label>
                        <textarea class="form-control font-monospace" placeholder="1001&#10;1002&#10;..." rows="14" id="cid_list" name="cid_list"></textarea>
                    </div>

                    <button type="button" id="contest_summary_submit" class="btn btn-primary w-100">
                        <i class="bi bi-box-arrow-in-down me-1"></i>
                        <span class="cn-text">开始归档</span>
                        <span class="en-text">Export</span>
                    </button>
                </div>
            </div>
        </div>

        <div class="col-12 col-lg-8">
            <div class="card">
                <div class="card-header d-flex align-items-center justify-content-between gap-2 flex-wrap">
                    <div class="bilingual-inline">
                        <span class="cn-text">归档文件</span>
                        <span class="en-text">Exported Files</span>
                    </div>
                    <button type="button" class="btn btn-outline-secondary btn-sm" id="contest_summary_refresh">
                        <i class="bi bi-arrow-clockwise"></i>
                        <span class="cn-text">刷新</span>
                        <span class="en-text">Refresh</span>
                    </button>
                </div>
                <div class="card-body">
                    <table
                        id="contest_summary_file_table"
                        class="bootstraptable_refresh_local"
                        data-toggle="table"
                        data-url="/exadmin/contestsummary/summary_file_list_ajax"
                        data-method="get"
                        data-side-pagination="client"
                        data-pagination="true"
                        data-page-list="[10, 25, 50]"
                        data-page-size="25"
                        data-search="true"
                        data-search-align="left"
                        data-unique-id="file_name"
                        data-response-handler="ContestSummaryFileResponseHandler"
                    >
                        <thead class="table-light">
                        <tr>
                            <th data-field="file_serial" data-align="center" data-valign="middle" data-width="60" data-formatter="ContestSummaryFormatterIdx">#</th>
                            <th data-field="file_name" data-align="left" data-valign="middle" data-sortable="true" data-formatter="ContestSummaryFormatterFilename">
                                <span class="cn-text">文件名</span>
                                <span class="en-text">Name</span>
                            </th>
                            <th data-field="file_size" data-align="right" data-valign="middle" data-width="120" data-sortable="true">
                                <span class="cn-text">大小(KB)</span>
                                <span class="en-text">Size(KB)</span>
                            </th>
                            <th data-field="file_lastmodify" data-align="center" data-valign="middle" data-width="180" data-sortable="true">
                                <span class="cn-text">更新时间</span>
                                <span class="en-text">Last Modify</span>
                            </th>
                            <th data-field="file_delete" data-align="center" data-valign="middle" data-width="90" data-formatter="ContestSummaryFormatterFileDelete">
                                <span class="cn-text">删除</span>
                                <span class="en-text">Delete</span>
                            </th>
                        </tr>
                        </thead>
                    </table>
                </div>
            </div>
        </div>
    </div>
</div>

<script type="text/javascript">
let contest_summary_file_table = $('#contest_summary_file_table');

function ContestSummaryFileResponseHandler(res) {
    // exadmin 接口返回：{code: 1, msg: 'ok', data: [...]}
    if(res && res.code == 1 && Array.isArray(res.data)) {
        return res.data.map((row, idx) => ({...row, file_serial: idx + 1}));
    }
    // 兼容直接数组
    if(Array.isArray(res)) {
        return res.map((row, idx) => ({...row, file_serial: idx + 1}));
    }
    return [];
}

function ContestSummaryFormatterIdx(value, row, index) {
    return index + 1;
}

function ContestSummaryFormatterFilename(value, row) {
    if(!value) return '';
    const safe = encodeURIComponent(value);
    return `<a href="/exadmin/contestsummary/download?file=${safe}" target="_blank" rel="noopener">${value}</a>`;
}

function ContestSummaryFormatterFileDelete(value, row) {
    return `<button type="button" class="btn btn-outline-danger btn-sm" data-csg-file="${encodeURIComponent(row.file_name)}" title="删除 / Delete">
        <i class="bi bi-trash"></i>
    </button>`;
}

function validateCidList(text) {
    const cid_list = (text || '').trim();
    if(cid_list.length === 0) return {ok: false, msg: '请填写 Contest ID 列表'};
    if(!/^\d{1,10}(\n\d{1,10}){0,63}$/.test(cid_list)) {
        return {ok: false, msg: 'Contest ID 应为每行一个正整数，最多 64 行'};
    }
    return {ok: true, cid_list};
}

async function doExport() {
    const cid_list_text = $('#cid_list').val();
    const check = validateCidList(cid_list_text);
    if(!check.ok) {
        alerty.warn(check.msg);
        return;
    }

    const task_name_prefix = ($('#task_name_prefix').val() || '').trim();
    const $btn = $('#contest_summary_submit');
    $btn.prop('disabled', true);

    try {
        const ret = await new Promise((resolve) => {
            $.post('/exadmin/contestsummary/contest_summary_ajax', {
                cid_list: check.cid_list,
                task_name_prefix: task_name_prefix
            }, function(resp){ resolve(resp); }, 'json');
        });

        if(ret && ret.code == 1) {
            alerty.success('任务完成，开始下载');
            if(ret.url) {
                window.open(ret.url, '_blank', 'noopener');
            }
            contest_summary_file_table.bootstrapTable('refresh');
        } else {
            alerty.error(ret && ret.msg ? ret.msg : '导出失败');
        }
    } finally {
        $btn.prop('disabled', false);
    }
}

$(document).ready(function() {
    $('#contest_summary_submit').on('click', function() {
        alerty.confirm({
            title: '确认<span class="en-text">Confirm</span>',
            message: "确认开始归档？<br/>归档可能耗时较长（约 180 秒超时上限），请耐心等待。",
            message_en: "Start export now?<br/>This may take a while (about 180s timeout limit). Please wait.",
            callback: function(){ doExport(); }
        });
    });

    $('#contest_summary_refresh').on('click', function() {
        contest_summary_file_table.bootstrapTable('refresh');
    });

    // 删除按钮（使用事件代理）
    contest_summary_file_table.on('click', 'button[data-csg-file]', function() {
        const file = $(this).attr('data-csg-file');
        if(!file) return;
        alerty.confirm({
            title: '确认删除<span class="en-text">Confirm Delete</span>',
            message: '删除后不可恢复。',
            message_en: 'This action cannot be undone.',
            callback: function() {
                $.get('/exadmin/contestsummary/delete', {file: decodeURIComponent(file)}, function(ret) {
                    if(ret && ret.code == 1) {
                        alerty.success(ret.msg || 'Deleted');
                        contest_summary_file_table.bootstrapTable('refresh');
                    } else {
                        alerty.error(ret && ret.msg ? ret.msg : '删除失败');
                    }
                }, 'json');
            }
        });
    });
});
</script>
