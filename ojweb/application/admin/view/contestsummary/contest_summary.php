{include file="../../csgoj/view/public/base_csg_switch" /}

<div class="container-fluid px-3 pb-4 contest-summary-page">
    <div class="admin-page-header">
        <div class="admin-page-header-left">
            <div class="admin-page-header-icon">
                <i class="bi bi-archive"></i>
            </div>
            <h1 class="admin-page-header-title">
                <div class="admin-page-header-title-main">
                    比赛统计归档
                </div>
                <div class="admin-page-header-title-right">
                    <span class="en-text">Contest Summary Export</span>
                </div>
            </h1>
        </div>
    </div>

    <p class="small text-muted mb-3 bilingual-inline">
        单次最多 64 场，约 180 秒超时，文件按当前课程组存放。<span class="en-text">Max 64 contests, ~180s timeout, per course group.</span>
    </p>

    <div class="row g-3">
        <div class="col-12 col-lg-4">
            <div class="card shadow-sm border h-100">
                <div class="card-header bg-light py-2">
                    <span class="fw-semibold bilingual-inline">导出<span class="en-text text-muted small">Export</span></span>
                </div>
                <div class="card-body">
                    <form id="contest_summary_form" class="admin-form" method="post" action="/{$module}/contestsummary/contest_summary_ajax">
                        <div class="mb-3">
                            <label class="form-label mb-2 bilingual-inline" for="cid_list">
                                比赛 ID<span class="en-text text-muted small">Contest ID</span>
                            </label>
                            <textarea class="form-control font-monospace" id="cid_list" name="cid_list" rows="16"
                                      placeholder="1001&#10;1002&#10;1003" autocomplete="off"
                                      title="每行一个 ID，最多 51 行 · One ID per line, max 51"></textarea>
                        </div>
                        <button type="submit" id="submit_button" class="btn btn-primary w-100 bilingual-inline">
                            <i class="bi bi-download me-1" aria-hidden="true"></i>导出<span class="en-text">Export</span>
                        </button>
                    </form>
                </div>
            </div>
        </div>

        <div class="col-12 col-lg-8">
            <div class="card shadow-sm border h-100">
                <div class="card-header bg-light py-2 d-flex flex-wrap align-items-center justify-content-between gap-2">
                    <span class="fw-semibold bilingual-inline">归档文件<span class="en-text text-muted small">Archives</span></span>
                    <button type="button" id="contest_summary_refresh_btn" class="btn btn-outline-secondary btn-sm"
                            title="刷新 Refresh">
                        <i class="bi bi-arrow-clockwise" aria-hidden="true"></i>
                    </button>
                </div>
                <div class="card-body p-0 p-sm-2">
                    <table
                        class="bootstraptable_refresh_local"
                        id="contest_summary_file_table"
                        data-toggle="table"
                        data-url="/{$module}/contestsummary/summary_file_list_ajax"
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
                        data-classes="table table-hover table-striped table-sm mb-0"
                    >
                        <thead>
                        <tr>
                            <th data-field="file_serial" data-align="center" data-valign="middle" data-sortable="true" data-width="56" data-formatter="ContestSummaryAutoId">#</th>
                            <th data-field="file_name" data-align="left" data-valign="middle" data-sortable="true" data-formatter="ContestSummaryFilenameFormatter" title="文件名 File">文件名</th>
                            <th data-field="file_size" data-align="end" data-valign="middle" data-sortable="true" data-width="88" title="大小 Size (KB)">大小</th>
                            <th data-field="file_lastmodify" data-align="center" data-valign="middle" data-sortable="true" data-width="168" title="修改时间 Modified">时间</th>
                            <th data-field="file_delete" data-align="center" data-valign="middle" data-width="52" data-formatter="ContestSummaryFileDeleteFormatter" title="删除 Delete"></th>
                        </tr>
                        </thead>
                    </table>
                </div>
            </div>
        </div>
    </div>
</div>

<script type="text/javascript">
(function () {
    var contestSummaryModule = '{$module|htmlspecialchars}';
    var contestSummaryFileTable = $('#contest_summary_file_table');
    var submitButton = $('#submit_button');
    var submitButtonDefaultHtml = submitButton.html();
    var cidListPattern = /^\d{1,10}(\n\d{1,10}){0,50}$/;

    window.ContestSummaryAutoId = function (value, row, index) {
        return index + 1;
    };

    window.ContestSummaryFilenameFormatter = function (value) {
        if (!value) {
            return '';
        }
        var safeText = $('<div/>').text(value).html();
        var href = '/' + contestSummaryModule + '/contestsummary/download?file=' + encodeURIComponent(value);
        return '<a href="' + href + '" class="text-break">' + safeText + '</a>';
    };

    window.ContestSummaryFileDeleteFormatter = function () {
        return '<button type="button" class="delete_button btn btn-outline-danger btn-sm" title="删除 Delete">'
            + '<i class="bi bi-trash" aria-hidden="true"></i></button>';
    };

    contestSummaryFileTable.on('click-cell.bs.table', function (e, field, value, row) {
        if (field !== 'file_delete') {
            return;
        }
        alerty.confirm({
            message: '确定要删除该文件吗？',
            message_en: 'Delete this archive file?',
            callback: function () {
                $.get(
                    '/' + contestSummaryModule + '/contestsummary/delete',
                    { file: row.file_name },
                    function (ret) {
                        if (ret.code == 1) {
                            alerty.success({
                                message: ret.msg || '已删除',
                                message_en: ret.msg_en || 'Deleted'
                            });
                            contestSummaryFileTable.bootstrapTable('removeByUniqueId', row.file_name);
                        } else {
                            alerty.error({
                                message: ret.msg || '删除失败',
                                message_en: ret.msg_en || 'Delete failed'
                            });
                        }
                    }
                );
            }
        });
    });

    $('#contest_summary_refresh_btn').on('click', function () {
        contestSummaryFileTable.bootstrapTable('refresh');
    });

    FormValidationTip.initFormValidation('#contest_summary_form', {
        cid_list: {
            rules: {
                required: true,
                minlength: 1,
                maxlength: 200,
                custom: [function (value) {
                    var v = (value || '').trim();
                    if (!v) {
                        return true;
                    }
                    return cidListPattern.test(v);
                }]
            },
            messages: {
                required: FormValidationTip.createBilingualMessage(
                    '请输入比赛 ID 列表',
                    'Contest ID list is required'
                ),
                minlength: FormValidationTip.createBilingualMessage(
                    '请输入至少一个比赛 ID',
                    'Enter at least one contest ID'
                ),
                maxlength: FormValidationTip.createBilingualMessage(
                    '输入内容过长',
                    'Input is too long'
                ),
                custom: FormValidationTip.createBilingualMessage(
                    '比赛 ID 须换行分隔，每行为 1～10 位正整数，最多 51 行',
                    'Contest IDs must be newline-separated positive integers (1–10 digits per line, up to 51 lines)'
                )
            }
        }
    }, function (form) {
        SubmitExport(form);
    });

    function SubmitExport(form) {
        alerty.confirm({
            message: '比赛导出可能需要较长时间。若执行超过约 180 秒将自动停止。\n确定开始导出吗？',
            message_en: 'Export may take a while and will stop after about 180 seconds.\nStart export now?',
            callback: function () {
                DoExport(form);
            },
            callbackCancel: function () {
                alerty.message('已取消', 'Canceled');
            }
        });
    }

    function DoExport(form) {
        submitButton.prop('disabled', true);
        submitButton.addClass('bilingual-inline').html(
            '<i class="bi bi-hourglass-split me-1" aria-hidden="true"></i>导出中…<span class="en-text">…</span>'
        );
        $(form).ajaxSubmit({
            success: function (ret) {
                if (ret.code == 1) {
                    contestSummaryFileTable.bootstrapTable('refresh');
                    alerty.success({
                        message: ret.msg || '导出完成',
                        message_en: ret.msg_en || 'Export completed',
                        callback: function () {
                            var card = document.getElementById('contest_summary_file_table');
                            if (card && card.scrollIntoView) {
                                card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                            }
                        }
                    });
                } else {
                    alerty.error({
                        message: ret.msg || '导出失败',
                        message_en: ret.msg_en || 'Export failed'
                    });
                }
                button_delay(submitButton, 3, submitButtonDefaultHtml, null, 'Export');
                submitButton.addClass('bilingual-inline');
            },
            error: function () {
                alerty.error({
                    message: '请求失败，请稍后重试',
                    message_en: 'Request failed, please try again'
                });
                button_delay(submitButton, 3, submitButtonDefaultHtml, null, 'Export');
                submitButton.addClass('bilingual-inline');
            }
        });
    }
})();
</script>
