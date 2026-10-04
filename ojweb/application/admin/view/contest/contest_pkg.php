{css href="__STATIC__/csgoj/admin/admin_zip_pkg.css" /}

<div class="container admin-zip-pkg py-2">
    <div class="admin-page-header">
        <div class="admin-page-header-left">
            <div class="admin-page-header-icon">
                <i class="bi bi-box-seam"></i>
            </div>
            <h1 class="admin-page-header-title">
                <div class="admin-page-header-title-main">
                    比赛打包归档
                </div>
                <div class="admin-page-header-title-right">
                    <span class="en-text">Contest Import / Export</span>
                </div>
            </h1>
        </div>
        <div class="admin-page-header-actions">
            <a href="{$contest_pkg_backtask_url}" class="btn btn-outline-primary btn-sm" target="_blank" rel="noopener" title="后台任务 / Backtask">
                <i class="bi bi-list-task me-1"></i>
                <span class="cn-text">后台任务</span><span class="en-text">Backtask</span>
            </a>
        </div>
    </div>

    <div class="csg-perm-hint csg-perm-hint--info admin-zip-pkg-hint">
        <div class="csg-perm-hint-title">
            任务在后台执行，请到「<a href="{$contest_pkg_backtask_url}">后台任务</a>」查看进度与下载结果；下方表格上传 zip 后，在「导入」列可导入为新比赛。
        </div>
        <div class="csg-perm-hint-desc en-text">
            Export and import run in the background; open <a href="{$contest_pkg_backtask_url}">Backtask</a> for progress. After uploading a ZIP, use the Import column to import as a new contest.
        </div>
    </div>

    <div class="card shadow-sm border admin-zip-pkg-export-card mb-2">
        <div class="card-body py-2 px-3">
            <div class="admin-zip-pkg-form-heading">
                <span class="admin-zip-pkg-form-heading-cn">导出比赛</span>
                <span class="admin-zip-pkg-form-heading-en en-text">Export contest</span>
            </div>
            <form id="contest_export_form" class="admin-zip-pkg-export-form" onsubmit="return false;">
                <div class="admin-zip-pkg-form-sheet admin-zip-pkg-form-sheet--contest-3x2">
                    <label class="admin-zip-pkg-form-opt admin-zip-pkg-form-g-c-opt1">
                        <span class="admin-zip-pkg-form-opt-lbl">
                            <span class="admin-zip-pkg-form-opt-lbl-cn">评测数据</span>
                            <span class="admin-zip-pkg-form-opt-lbl-en en-text">Test data</span>
                        </span>
                        <span class="csg-switch csg-switch-sm">
                            <input type="checkbox" id="ce_test" class="csg-switch-input" checked
                                   title="包含评测数据、样例等；题面与 PDF 始终随包导出 / Judge data &amp; samples; statements/PDF always included">
                        </span>
                    </label>
                    <label class="admin-zip-pkg-form-opt admin-zip-pkg-form-g-c-opt2">
                        <span class="admin-zip-pkg-form-opt-lbl">
                            <span class="admin-zip-pkg-form-opt-lbl-cn">题目附件</span>
                            <span class="admin-zip-pkg-form-opt-lbl-en en-text">Attachments</span>
                        </span>
                        <span class="csg-switch csg-switch-sm">
                            <input type="checkbox" id="ce_attach" class="csg-switch-input" checked
                                   title="包含题目附件文件 / Include problem attachment files">
                        </span>
                    </label>
                    <div class="admin-zip-pkg-form-g-c-cid">
                        <label class="admin-zip-pkg-cid-label" for="ce_cid">
                            <span class="admin-zip-pkg-cid-cn">比赛 ID</span>
                            <span class="admin-zip-pkg-cid-en en-text">Contest ID</span>
                        </label>
                        <div class="admin-zip-pkg-cid-wrap position-relative">
                            <input type="text" class="form-control" id="ce_cid" inputmode="numeric" pattern="[0-9]*" autocomplete="off" placeholder="点击或输入筛选…">
                            <div class="admin-zip-pkg-cid-suggest list-group shadow" id="ce_cid_suggest" role="listbox" hidden></div>
                        </div>
                    </div>
                    <div class="admin-zip-pkg-form-g-c-go">
                        <button type="button" class="btn btn-primary admin-zip-pkg-form-go-btn" id="ce_btn">
                            <span class="cn-text"><i class="bi bi-download me-1" aria-hidden="true"></i>提交导出</span><span class="en-text">Submit export</span>
                        </button>
                    </div>
                </div>
                <div class="admin-zip-pkg-cid-feedback" id="ce_cid_feedback" role="status" aria-live="polite"></div>
            </form>
        </div>
    </div>

    <div class="card shadow-sm admin-zip-pkg-files-card">
        <div class="card-header bg-light">
            <span class="fw-semibold">
                比赛包文件<span class="en-text text-muted fw-normal small ms-2">Package files</span>
            </span>
            <span class="text-muted small ms-2 d-none d-md-inline cn-text">上传 zip 后，在「导入」列点击按钮可导入为新比赛</span>
        </div>
        <div class="card-body">
            {include file="../../admin/view/filemanager/js_upload" /}
        </div>
    </div>

    <script type="text/javascript">
        window.CONTEST_PKG_EXPORT_URL = '{$contest_pkg_export_ajax_url}';
        window.CONTEST_PKG_PRECHECK_URL = '{$contest_pkg_precheck_ajax_url}';
        window.CONTEST_PKG_SUGGEST_URL = '{$contest_pkg_suggest_ajax_url}';
        window.CONTEST_PKG_BACKTASK_URL = '{$contest_pkg_backtask_url}';
        window.CONTEST_PKG_ZIP_READ_URL = '{$contest_pkg_zip_read_url}';
        window.CONTEST_PKG_ZIP_METADATA_URL = '{$contest_pkg_zip_metadata_ajax_url}';
        window.CONTEST_PKG_ATTACH_CHECK_URL = '{$contest_pkg_attach_check_url}';
    </script>
</div>
{include file="../../csgoj/view/public/base_csg_switch" /}
{js href="__STATIC__/csgoj/admin/zip_pkg_contest_cid_suggest.js" /}
{js href="__STATIC__/csgoj/admin/contest_pkg.js" /}
