<div class="admin-page-header">
    <div class="admin-page-header-left">
        <div class="admin-page-header-icon">
            <i class="bi bi-download"></i>
        </div>
        <h1 class="admin-page-header-title">
            <div class="admin-page-header-title-main">
                导出考题
            </div>
            <div class="admin-page-header-title-right">
                <span class="en-text">Question Export</span>
            </div>
        </h1>
    </div>
</div>

<div class="container" id="question_export_div">
    <div class="alert alert-info mb-3">
        将导出为 zip：包含 <code>question_list.json</code> 与附件文件夹。
        <span class="en-text">Export as a zip containing <code>question_list.json</code> and attachments.</span>
    </div>

    <div id="process_ratio_bar_div" class="card border-0 shadow-sm mb-3" style="display: none;">
        <div class="card-body">
            <div class="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-2">
                <div class="fw-semibold">导出进度<span class="en-text">Progress</span></div>
                <div class="text-muted small" id="progress_tip_span"></div>
            </div>
            <div class="progress" style="height: 18px;">
                <div class="progress-bar progress-bar-striped progress-bar-animated" id="process_ratio_bar"
                     role="progressbar" aria-valuenow="0" aria-valuemin="0" aria-valuemax="100" style="width: 0%;">
                    0%
                </div>
            </div>
        </div>
    </div>

    <div class="card border-0 shadow-sm">
        <div class="card-body">
            <div class="row g-3">
                <div class="col-12 col-lg-6">
                    <label for="qids_input" class="bilingual-label">
                        按考题 ID<span class="en-text">By Question ID</span>
                    </label>
                    <div class="input-group input-group-sm">
                        <span class="input-group-text"><i class="bi bi-hash"></i></span>
                        <input type="text" class="form-control export_form_item" id="qids_input" name="qids"
                               placeholder="例如：1-10 或 1,3,4,6 / e.g. 1-10 or 1,3,4,6">
                    </div>
                    <div class="form-text">
                        支持区间（最多 256 题）或逗号分隔列表；若填写本项，将优先按本项导出。
                        <span class="en-text">Range (max 256) or comma-separated list. If filled, this will be used.</span>
                    </div>
                </div>

                <div class="col-12 col-lg-6">
                    <label for="cid_input" class="bilingual-label">
                        按考试 ID<span class="en-text">By Exam ID</span>
                    </label>
                    <div class="input-group input-group-sm">
                        <span class="input-group-text"><i class="bi bi-journal-text"></i></span>
                        <input type="text" class="form-control export_form_item" id="cid_input" name="cid"
                               placeholder="例如：1930 / e.g. 1930">
                    </div>
                    <div class="form-text">
                        若未填写“考题ID”，将根据考试题单导出。
                        <span class="en-text">If Question ID is empty, export by exam's question list.</span>
                    </div>
                </div>
            </div>

            <div class="d-flex align-items-center gap-2 mt-3 flex-wrap">
                <button type="button" id="submit_button" class="btn btn-primary btn-sm export_form_item">
                    <span class="cn-text"><i class="bi bi-download"></i> 导出</span>
                    <span class="en-text">Export</span>
                </button>
                <button type="button" class="btn btn-outline-secondary btn-sm export_form_item" id="clear_button">
                    <span class="cn-text"><i class="bi bi-eraser"></i> 清空</span>
                    <span class="en-text">Clear</span>
                </button>
                <div id="question_export_download_div" style="display: none;"></div>
            </div>
        </div>
    </div>
</div>
{include file="../../csgoj/view/public/js_zip" /}
{js href="__STATIC__/examsys/question_default.js" /}
{js href="__STATIC__/examsys/question_export.js" /}

