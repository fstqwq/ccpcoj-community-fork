{css href="__STATIC__/csgoj/admin/admin_zip_pkg.css" /}

<div class="container admin-zip-pkg py-2">
    <div class="admin-page-header">
        <div class="admin-page-header-left">
            <div class="admin-page-header-icon">
                <i class="bi bi-box-seam"></i>
            </div>
            <h1 class="admin-page-header-title">
                <div class="admin-page-header-title-main">
                    题目导入/导出
                </div>
                <div class="admin-page-header-title-right">
                    <span class="en-text">Problem Import / Export</span>
                </div>
            </h1>
        </div>
        <div class="admin-page-header-actions">
            <a href="{$problem_pkg_backtask_url}" class="btn btn-outline-primary btn-sm" target="_blank" rel="noopener" title="后台任务 / Backtask">
                <i class="bi bi-list-task me-1"></i>
                <span class="cn-text">后台任务</span><span class="en-text">Backtask</span>
            </a>
        </div>
    </div>

    <div class="csg-perm-hint csg-perm-hint--info admin-zip-pkg-hint">
        <div class="csg-perm-hint-title">
            导出与导入均在后台执行，请到「<a href="{$problem_pkg_backtask_url}">后台任务</a>」查看进度与下载结果；下方表格上传 zip 后，在「导入」列可发起导入。
        </div>
        <div class="csg-perm-hint-desc en-text">
            Export and import run in the background; open <a href="{$problem_pkg_backtask_url}">Backtask</a> for progress. After uploading a ZIP, use the Import column to enqueue import.
        </div>
    </div>

    <div class="card shadow-sm border admin-zip-pkg-export-card mb-2">
        <div class="card-body py-2 px-3">
            <div class="admin-zip-pkg-form-heading">
                <span class="admin-zip-pkg-form-heading-cn">导出题目</span>
                <span class="admin-zip-pkg-form-heading-en en-text">Export problems</span>
            </div>
            <form id="problem_export_form" method="post" action="{$problem_export_ajax_url}" onsubmit="return false;">
                <div class="admin-zip-pkg-form-sheet admin-zip-pkg-form-sheet--problem-3x2">
                    <label class="admin-zip-pkg-form-opt admin-zip-pkg-form-g-opt1">
                        <span class="admin-zip-pkg-form-opt-lbl">
                            <span class="admin-zip-pkg-form-opt-lbl-cn">评测数据</span>
                            <span class="admin-zip-pkg-form-opt-lbl-en en-text">Test data</span>
                        </span>
                        <span class="csg-switch csg-switch-sm">
                            <input type="checkbox" id="test_data_check" name="test_data_check" class="csg-switch-input" checked
                                   title="包含评测数据、题面与样例等 / Include judge data and statements">
                        </span>
                    </label>
                    <label class="admin-zip-pkg-form-opt admin-zip-pkg-form-g-opt2">
                        <span class="admin-zip-pkg-form-opt-lbl">
                            <span class="admin-zip-pkg-form-opt-lbl-cn">题目附件</span>
                            <span class="admin-zip-pkg-form-opt-lbl-en en-text">Attachments</span>
                        </span>
                        <span class="csg-switch csg-switch-sm">
                            <input type="checkbox" id="attach_file_check" name="attach_file_check" class="csg-switch-input" checked
                                   title="包含题目附件文件 / Include problem attachment files">
                        </span>
                    </label>

                    <div class="admin-zip-pkg-form-g-tabs">
                        <ul class="nav admin-zip-pkg-form-seg mb-0" id="problem_pkg_method_tabs" role="tablist">
                            <li class="nav-item" role="presentation">
                                <button type="button" class="nav-link active" id="ppm-tab-range" data-bs-toggle="pill" data-bs-target="#ppm-pane-range" role="tab" aria-controls="ppm-pane-range" aria-selected="true">
                                    <span class="cn-text">范围</span><span class="en-text d-none d-sm-inline ms-1 small">Range</span>
                                </button>
                            </li>
                            <li class="nav-item" role="presentation">
                                <button type="button" class="nav-link" id="ppm-tab-list" data-bs-toggle="pill" data-bs-target="#ppm-pane-list" role="tab" aria-controls="ppm-pane-list" aria-selected="false">
                                    <span class="cn-text">列表</span><span class="en-text d-none d-sm-inline ms-1 small">List</span>
                                </button>
                            </li>
                            <li class="nav-item" role="presentation">
                                <button type="button" class="nav-link" id="ppm-tab-contest" data-bs-toggle="pill" data-bs-target="#ppm-pane-contest" role="tab" aria-controls="ppm-pane-contest" aria-selected="false">
                                    <span class="cn-text">比赛</span><span class="en-text d-none d-sm-inline ms-1 small">Contest</span>
                                </button>
                            </li>
                        </ul>
                    </div>

                    <div class="admin-zip-pkg-form-g-inputs">
                        <div class="tab-content" id="problem_pkg_method_tab_content">
                            <div class="tab-pane fade show active" id="ppm-pane-range" role="tabpanel" aria-labelledby="ppm-tab-range" tabindex="0">
                                <div class="input-group input-group-sm admin-zip-pkg-form-ig admin-zip-pkg-form-ig--range">
                                    <span class="input-group-text" title="起始题目 ID / Start problem ID">起</span>
                                    <input type="text" class="form-control" id="start_pid" name="start_pid" placeholder="1000" inputmode="numeric" autocomplete="off"
                                           title="起始题目 ID / Start problem ID" aria-label="起始题目 ID Start problem ID">
                                    <span class="input-group-text px-2 text-muted" title="至结束 ID（可空表示单题） / Through end ID (empty = single)">—</span>
                                    <input type="text" class="form-control" id="end_pid" name="end_pid" placeholder="可选" inputmode="numeric" autocomplete="off"
                                           title="留空则只导出起始一题 / Leave empty to export only the start ID" aria-label="结束题目 ID End problem ID">
                                </div>
                            </div>
                            <div class="tab-pane fade" id="ppm-pane-list" role="tabpanel" aria-labelledby="ppm-tab-list" tabindex="0">
                                <div id="problem_export_input" class="admin-zip-pkg-form-problem-id-list admin-zip-pkg-form-problem-id-list--export"></div>
                                <input type="hidden" id="pid_list" name="pid_list">
                            </div>
                            <div class="tab-pane fade" id="ppm-pane-contest" role="tabpanel" aria-labelledby="ppm-tab-contest" tabindex="0">
                                <div class="admin-zip-pkg-form-g-c-cid admin-zip-pkg-form-problem-export-contest-cid">
                                    <div class="admin-zip-pkg-cid-wrap position-relative">
                                        <input type="text" class="form-control" id="ex_cid" name="ex_cid" inputmode="numeric" pattern="[0-9]*" autocomplete="off"
                                               placeholder="点击或输入筛选比赛…"
                                               title="按比赛导出题目；候选含标准赛与实验课，不含考试 / By contest; includes standard &amp; lab, excludes exams"
                                               aria-label="比赛 ID，点击或输入筛选 Contest ID, type or pick from list">
                                        <div class="admin-zip-pkg-cid-suggest list-group shadow" id="ex_cid_suggest" role="listbox" hidden></div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="admin-zip-pkg-form-g-go">
                        <button type="submit" id="submit_button" class="btn btn-primary admin-zip-pkg-form-go-btn">
                            <span class="cn-text"><i class="bi bi-download me-1" aria-hidden="true"></i>提交导出</span><span class="en-text">Submit export</span>
                        </button>
                    </div>
                </div>
            </form>
        </div>
    </div>

    <div class="card shadow-sm admin-zip-pkg-files-card">
        <div class="card-header bg-light">
            <span class="fw-semibold">
                题包文件<span class="en-text text-muted fw-normal small ms-2">Package files</span>
            </span>
            <span class="text-muted small ms-2 d-none d-md-inline cn-text">上传 zip 后，在「导入」列点击导入</span>
        </div>
        <div class="card-body">
            {include file="../../admin/view/filemanager/js_upload" /}
        </div>
    </div>

    <script type="text/javascript">
        window.PROBLEM_EXPORT_AJAX_URL = '{$problem_export_ajax_url}';
        window.PROBLEM_BACKTASK_URL = '{$problem_pkg_backtask_url}';
        window.PROBLEMEXPORT_WEB_MODULE = '{$problemexport_module}';
        window.PROBLEM_EXPORT_CONTEST_SUGGEST_URL = '{$problem_export_contest_suggest_url|default=""}';
        window.NOW_COURSE_ID = {:json_encode($NOW_COURSE_ID)};
        window.NOW_COURSE_KEY = '{$NOW_COURSE_KEY|default=""|htmlspecialchars}';
    </script>
</div>

{include file="../../csgoj/view/public/base_csg_switch" /}
{include file="../../admin/view/contest/problem_selection" /}
{js href="__STATIC__/csgoj/admin/zip_pkg_contest_cid_suggest.js" /}
{js href="__STATIC__/csgoj/admin/problem_pkg_export.js" /}
{js href="__STATIC__/csgoj/admin/problem_export.js" /}
