{include file="../../csgoj/view/public/base_csg_switch" /}
{include file="../../csgoj/view/public/pkg_code_highlight" /}
{js href="__STATIC__/js/overlay.js" /}
<!-- 题册页不引入 oj_problem.css：未限定选择器会污染 contest layout；版心样式见 contest_print.css -->
<link rel="stylesheet" type="text/css" href="__STATIC__/csgoj/contest/contest_print.css?v=20260510_1" />
<script type="text/javascript" src="__STATIC__/csgoj/oj_problem.js?v=20260510_1"></script>

<div id="contest_print_scope" class="contest-print-scope">
<div class="admin-page-header admin-page-header--contest-print">
    <div class="admin-page-header-left">
        <div class="admin-page-header-icon"><i class="bi bi-file-earmark-pdf"></i></div>
        <h1 class="admin-page-header-title">
            <div class="admin-page-header-title-main">题目排版</div>
            <div class="admin-page-header-title-right">
                <a href="/{$module}/contest/contest?cid={$contest['contest_id']}" class="admin-page-header-id">
                    <i class="bi bi-hash"></i> {$contest['contest_id']}
                </a>
                <span class="en-text">Contest Print</span>
            </div>
        </h1>
    </div>
    <div class="admin-page-header-right d-flex flex-wrap align-items-center justify-content-end gap-2">
        <div class="contest-print-lang-wrap d-flex align-items-center gap-1" id="contest_print_lang_wrap">
            <i class="bi bi-translate text-muted" aria-hidden="true"></i>
            <select id="contest_print_lang_select" class="form-select form-select-sm contest-print-lang-select"
                    title="整体切换题面语言；某题缺失该语言时使用其默认语言 / Switch language; falls back per problem when missing">
            </select>
        </div>
        <div class="contest-print-pager d-flex align-items-center gap-1" id="contest_print_pager_toolbar">
            <button type="button" class="btn btn-outline-secondary btn-sm contest-print-iconbtn" id="contest_print_prev_btn"
                    title="上一页 / Previous page" aria-label="上一页"><i class="bi bi-chevron-left"></i></button>
            <span class="contest-print-page-indicator small text-muted" id="contest_print_page_indicator">- / -</span>
            <button type="button" class="btn btn-outline-secondary btn-sm contest-print-iconbtn" id="contest_print_next_btn"
                    title="下一页 / Next page" aria-label="下一页"><i class="bi bi-chevron-right"></i></button>
            <button type="button" class="btn btn-outline-secondary btn-sm contest-print-iconbtn" id="contest_print_fullscreen_btn"
                    title="全屏查看 / Fullscreen" aria-label="全屏"><i class="bi bi-arrows-fullscreen"></i></button>
        </div>
        <button type="button" class="btn btn-outline-primary btn-sm contest-print-tool-btn" id="contest_print_settings_btn"
                title="打开排版设置 / Print settings">
            <i class="bi bi-sliders me-1" aria-hidden="true"></i><span class="cn-text">设置</span><span class="en-text">Setup</span>
        </button>
        <button type="button" class="btn btn-success btn-sm contest-print-tool-btn" id="contest_print_export_btn"
                title="浏览器打印对话框中选「另存为 PDF」 / Print — choose Save as PDF">
            <i class="bi bi-printer me-1" aria-hidden="true"></i><span class="cn-text">打印 PDF</span><span class="en-text">Print</span>
        </button>
    </div>
</div>

<div id="contest_print_main">
    <div id="contest_print_viewport_wrap">
        <div id="contest_print_viewport" class="contest-print-viewport contest-print-native-host"></div>
        <div id="contest_print_loading" class="contest-print-loading">
            <div class="contest-print-loading-card">
                <div class="spinner-border text-primary me-2" role="status" aria-hidden="true"></div>
                <span class="cn-text">正在排版…</span><span class="en-text text-muted small ms-1">Laying out…</span>
            </div>
        </div>
    </div>
</div>

<div class="modal fade" id="contest_print_settings_modal" tabindex="-1" aria-hidden="true" data-bs-backdrop="static">
    <div class="modal-dialog modal-dialog-centered modal-lg">
        <div class="modal-content">
            <div class="modal-header py-2 px-3">
                <h5 class="modal-title">
                    <span class="cn-text">排版设置</span>
                    <span class="en-text text-muted small ms-1">Print setup</span>
                </h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div class="modal-body py-3 px-3">
                <div class="mb-3 d-flex align-items-center justify-content-between flex-wrap gap-2">
                    <div>
                        <div class="fw-semibold"><span class="cn-text">包含目录页</span><span class="en-text text-muted small ms-1">Include TOC</span></div>
                        <div class="text-muted small">
                            <span class="cn-text">封面后插入一页目录，列出本场所有题目及页码。</span>
                            <span class="en-text">Insert one TOC sheet after the cover, listing all problems and page numbers.</span>
                        </div>
                    </div>
                    <div class="csg-switch csg-switch-md">
                        <input type="checkbox" id="contest_print_toc_switch" class="csg-switch-input"
                               data-csg-text-on="包含" data-csg-text-off="不含"
                               data-csg-text-on-en="On" data-csg-text-off-en="Off"
                               title="是否在封面后插入目录页 / Whether to insert TOC pages">
                    </div>
                </div>

                <div class="mb-3 d-flex align-items-center justify-content-between flex-wrap gap-2">
                    <div>
                        <div class="fw-semibold"><span class="cn-text">打印 PDF 显示页码</span><span class="en-text text-muted small ms-1">Show page numbers</span></div>
                        <div class="text-muted small">
                            <span class="cn-text">在打印（另存为 PDF）时每页底部居中显示「当前页 / 总页」；封面页不计页码。</span>
                            <span class="en-text">Footer shows current/total when printing to PDF; the cover page is not numbered.</span>
                        </div>
                    </div>
                    <div class="csg-switch csg-switch-md">
                        <input type="checkbox" id="contest_print_pageno_switch" class="csg-switch-input"
                               data-csg-text-on="显示" data-csg-text-off="隐藏"
                               data-csg-text-on-en="On" data-csg-text-off-en="Off"
                               title="打印为 PDF 时是否在页脚显示页码 / Show page numbers when printing to PDF">
                    </div>
                </div>

                <hr class="my-2">

                <div class="mb-3">
                    <div class="d-flex align-items-center justify-content-between mb-2 flex-wrap gap-2">
                        <div>
                            <div class="fw-semibold"><span class="cn-text">封面 Logo</span><span class="en-text text-muted small ms-1">Cover logo</span></div>
                            <div class="text-muted small">
                                <span class="cn-text">上传后将显示在封面正中央。支持 SVG / PNG / WebP / JPG，建议尺寸 1:1 或 4:3，最大 4 MB。</span>
                                <span class="en-text">Shown at the center of the cover. SVG / PNG / WebP / JPG, up to 4 MB.</span>
                            </div>
                        </div>
                        <div class="d-flex align-items-center gap-2">
                            <button type="button" class="btn btn-outline-primary btn-sm" id="contest_print_logo_upload_btn"
                                    title="选择封面 Logo 图片 / Select a logo image">
                                <i class="bi bi-upload me-1"></i><span class="cn-text">上传</span><span class="en-text">Upload</span>
                            </button>
                            <button type="button" class="btn btn-outline-danger btn-sm" id="contest_print_logo_delete_btn"
                                    title="移除当前封面 Logo / Remove the current logo">
                                <i class="bi bi-trash me-1"></i><span class="cn-text">删除</span><span class="en-text">Delete</span>
                            </button>
                            <input type="file" id="contest_print_logo_file_input" class="d-none" accept="image/png,image/jpeg,image/webp,image/svg+xml,.svg,.png,.jpg,.jpeg,.webp">
                        </div>
                    </div>
                    <div class="contest-print-asset-preview" id="contest_print_logo_preview" hidden>
                        <img id="contest_print_logo_preview_img" alt="Contest logo preview">
                    </div>
                    <div class="text-muted small contest-print-asset-empty" id="contest_print_logo_empty">
                        <span class="cn-text">尚未上传</span><span class="en-text">Not uploaded</span>
                    </div>
                </div>

                <div class="mb-1">
                    <div class="d-flex align-items-center justify-content-between mb-2 flex-wrap gap-2">
                        <div>
                            <div class="fw-semibold"><span class="cn-text">自定义封面 PDF</span><span class="en-text text-muted small ms-1">Custom cover PDF</span></div>
                            <div class="text-muted small">
                                <span class="cn-text">打印时用上传的 PDF 取代自动生成的封面（可多页），最大 32 MB。</span>
                                <span class="en-text">Replace the generated cover with the uploaded PDF when printing (multi-page allowed, up to 32 MB).</span>
                            </div>
                        </div>
                        <div class="d-flex align-items-center gap-2">
                            <button type="button" class="btn btn-outline-primary btn-sm" id="contest_print_cover_upload_btn"
                                    title="选择封面 PDF / Select a cover PDF">
                                <i class="bi bi-upload me-1"></i><span class="cn-text">上传</span><span class="en-text">Upload</span>
                            </button>
                            <button type="button" class="btn btn-outline-danger btn-sm" id="contest_print_cover_delete_btn"
                                    title="移除当前自定义封面 PDF / Remove the custom cover PDF">
                                <i class="bi bi-trash me-1"></i><span class="cn-text">删除</span><span class="en-text">Delete</span>
                            </button>
                            <input type="file" id="contest_print_cover_file_input" class="d-none" accept="application/pdf,.pdf">
                        </div>
                    </div>
                    <div class="contest-print-asset-preview contest-print-asset-preview--pdf" id="contest_print_cover_preview" hidden>
                        <a id="contest_print_cover_preview_link" href="#" target="_blank" rel="noopener">
                            <i class="bi bi-file-earmark-pdf"></i>
                            <span class="cn-text">预览封面 PDF</span>
                            <span class="en-text">Preview cover PDF</span>
                        </a>
                    </div>
                    <div class="text-muted small contest-print-asset-empty" id="contest_print_cover_empty">
                        <span class="cn-text">尚未上传</span><span class="en-text">Not uploaded</span>
                    </div>
                </div>
            </div>
            <div class="modal-footer py-2 px-3">
                <button type="button" class="btn btn-secondary btn-sm" data-bs-dismiss="modal">
                    <span class="cn-text">关闭</span><span class="en-text">Close</span>
                </button>
                <button type="button" class="btn btn-primary btn-sm" id="contest_print_settings_apply_btn">
                    <i class="bi bi-check-lg me-1"></i><span class="cn-text">应用并重排</span><span class="en-text">Apply</span>
                </button>
            </div>
        </div>
    </div>
</div>
</div>

<textarea id="contest_print_data_json" class="d-none" readonly>{:json_encode([
    'cid' => $contest['contest_id'],
    'contest_attach' => $contest['attach'] ?? '',
    'contest_title' => $contest['title'] ?? '',
    'contest_start' => $contest['start_time'] ?? '',
    'contest_end' => $contest['end_time'] ?? '',
    'contest_logo_url' => $contest_logo_url ?? '',
    'contest_logo_ext' => $contest_logo_ext ?? '',
    'cover_pdf_url' => $cover_pdf_url ?? '',
    'cover_pdf_mtime' => $cover_pdf_mtime ?? 0,
    'available_langs' => $available_langs,
    'problem_list' => $problem_list,
    'module' => $module,
    'controller' => $controller,
], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT)}</textarea>

<script type="text/javascript" src="__STATIC__/csgoj/contest/contest_print.js?v=20260510_1"></script>
