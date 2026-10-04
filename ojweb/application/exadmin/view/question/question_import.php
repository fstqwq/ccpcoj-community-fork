<div class="admin-page-header">
    <div class="admin-page-header-left">
        <div class="admin-page-header-icon">
            <i class="bi bi-upload"></i>
        </div>
        <h1 class="admin-page-header-title">
            <div class="admin-page-header-title-main csg-bilingual-stack">
                <span class="cn-text">导入考题</span>
                <span class="en-text">Question Import</span>
            </div>
        </h1>
    </div>
</div>

<div class="container" id="question_import_div">
    <input type="hidden" id="tpl_now_course_key" value="{$NOW_COURSE_KEY|default=''|htmlspecialchars}">
    <div class="alert alert-info mb-3">
        上传导出的 zip 文件，系统将自动解析并预览题目列表，您可以选择要导入的题目。
        <span class="en-text">Upload the exported zip file, the system will automatically parse and preview the question list, you can select questions to import.</span>
    </div>

    <div id="process_ratio_bar_div" class="card border-0 shadow-sm mb-3" style="display: none;">
        <div class="card-body">
            <div class="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-2">
                <div class="fw-semibold">导入进度<span class="en-text">Progress</span></div>
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

    <div class="card border-0 shadow-sm mb-3">
        <div class="card-body">
            <label class="bilingual-label mb-2">
                上传导出的zip文件<span class="en-text">Upload the exported zip file</span>
            </label>
            <div class="d-flex align-items-center gap-2 flex-wrap">
                <label for="question_import_file" class="btn btn-primary btn-sm mb-0 csg-bilingual-stack">
                    <span class="cn-text"><i class="bi bi-upload"></i> 选择文件</span>
                    <span class="en-text">Choose File</span>
                </label>
                <input class="form-control import_form_item" id="question_import_file" type="file" accept=".zip" style="display: none;">
                <span id="selected_file_name" class="text-muted small"></span>
            </div>
        </div>
    </div>
    
    <div id="question_preview_section" style="display: none;">
        <div class="card border-0 shadow-sm">
            <div class="card-body">
                <div class="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
                    <h5 class="mb-0 csg-bilingual-stack">
                        <span class="cn-text">预览题目列表</span>
                        <span class="en-text">Question Preview</span>
                    </h5>
                    <div class="btn-group btn-group-sm">
                        <button type="button" id="import_selected_btn_top" class="btn btn-success csg-bilingual-stack">
                            <span class="cn-text"><i class="bi bi-upload"></i> 导入选中题目</span>
                            <span class="en-text">Import Selected</span>
                        </button>
                        <button type="button" id="select_all_btn" class="btn btn-outline-primary csg-bilingual-stack">
                            <span class="cn-text"><i class="bi bi-check-all"></i> 全选</span>
                            <span class="en-text">Select All</span>
                        </button>
                        <button type="button" id="deselect_all_btn" class="btn btn-outline-secondary csg-bilingual-stack">
                            <span class="cn-text"><i class="bi bi-x-square"></i> 清空</span>
                            <span class="en-text">Clear</span>
                        </button>
                    </div>
                </div>
                <div id="question_preview_table_div">
                    <table
                        id="question_preview_table"
                        data-toggle="table"
                        data-click-to-select="true"
                        data-maintain-meta-data="true"
                        data-side-pagination="client"
                        data-pagination="true"
                        data-page-size="50"
                        data-page-list="[50, 100, 1000]"
                        data-classes="table table-bordered table-hover table-striped"
                    >
                        <thead>
                            <tr>
                                <th data-field="state" data-checkbox="true" data-width="50"></th>
                                <th data-field="idx" data-align="center" data-valign="middle" data-width="50" data-formatter="FormatterImportIdx">序号<span class="en-text">Idx</span></th>
                                <th data-field="pkind" data-align="center" data-valign="middle" data-width="80" data-sortable="true" data-formatter="FormatterQuestionType">题型<span class="en-text">Type</span></th>
                                <th data-field="title" data-align="left" data-valign="middle" data-sortable="true" data-formatter="FormatterImportQuestionTitle">题目<span class="en-text">Title</span></th>
                                <th data-field="attach" data-align="center" data-valign="middle" data-width="80" data-formatter="FormatterImportQuestionAttach">附件<span class="en-text">Attach</span></th>
                            </tr>
                        </thead>
                    </table>
                </div>
                <div class="d-flex align-items-center gap-2 mt-3 flex-wrap">
                    <button type="button" id="import_selected_btn" class="btn btn-success btn-sm csg-bilingual-stack">
                        <span class="cn-text"><i class="bi bi-upload"></i> 导入选中题目</span>
                        <span class="en-text">Import Selected</span>
                    </button>
                    <span id="selected_count_span" class="text-muted small"></span>
                </div>
            </div>
        </div>
    </div>
</div>

{include file="../../csgoj/view/public/js_zip" /}
{js href="__STATIC__/examsys/question_default.js" /}
{js href="__STATIC__/exadmin/question_list.js" /}
{js href="__STATIC__/exadmin/question_import.js" /}
