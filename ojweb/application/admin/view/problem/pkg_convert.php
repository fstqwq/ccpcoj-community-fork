{css href="__STATIC__/css/problem_pkg_convert.css" /}
{css href="__STATIC__/csgoj/oj_problem.css" /}
{include file="../../csgoj/view/public/js_zip" /}
{js href="__JS__/overlay.js" /}
{if isset($problem_pkg_import_enable) && $problem_pkg_import_enable}
{js href="__JS__/chunk_upload.js" /}
{/if}
{js href="__STATIC__/js/problem_pkg/common.js" /}
{js href="__STATIC__/js/problem_pkg/pack_core.js" /}
{js href="__STATIC__/js/vendor/sha256-0.9.0.min.js" /}
{js href="__STATIC__/js/vendor/js-yaml-4.1.0.min.js" /}
{js href="__STATIC__/js/problem_pkg/polygon.js" /}
{js href="__STATIC__/js/problem_pkg/thusaa.js" /}
{js href="__STATIC__/js/csg_sortable_list.js" /}
{js href="__STATIC__/js/problem_pkg/table_formatters.js" /}
{if isset($problem_pkg_import_enable) && $problem_pkg_import_enable}
<div id="problem-pkg-import-config" class="d-none" aria-hidden="true"
    data-chunk-upload-url="{$problem_pkg_chunk_upload_url}"
    data-import-ajax="{$problem_pkg_import_ajax_url}"
    data-filemanager-url="{$problem_pkg_filemanager_url}"
    data-backtask-url="{$problem_pkg_backtask_url}"></div>
<script type="text/javascript">
window.PROBLEM_PKG_USERNAME = '{$problem_pkg_username_for_zip|default=""|htmlspecialchars}';
{if $pkg_convert_now_course_id}
window.NOW_COURSE_ID = {$pkg_convert_now_course_id};
window.NOW_COURSE_KEY = '{$pkg_convert_now_course_key|default=""|htmlspecialchars}';
{/if}
</script>
{js href="__STATIC__/js/problem_pkg/polygon_import_to_oj.js" /}
{/if}

{if isset($problem_pkg_public_tool) && $problem_pkg_public_tool}
<div class="page-title-container mb-3">
    <h1 class="page-title">题包解析工具<span class="en-text">Package Parser</span></h1>
</div>
{else/}
<div class="admin-page-header mb-3">
    <div class="admin-page-header-left">
        <div class="admin-page-header-icon">
            <i class="bi bi-arrow-left-right"></i>
        </div>
        <h1 class="admin-page-header-title">
            <div class="admin-page-header-title-main">
                题包转换
                <span class="en-text">Package Convert</span>
            </div>
            <div class="admin-page-header-title-meta-right text-muted small fw-normal">
                外格式题面与数据 → CSGOJ 导入包
                <span class="en-text">External packages → CSGOJ import ZIP</span>
            </div>
        </h1>
    </div>
</div>
{/if}

<ul class="nav nav-tabs pkg-convert-nav mb-0" id="pkgConvertTab" role="tablist">
    <li class="nav-item" role="presentation">
        <button class="nav-link active" id="pkg-tab-polygon-trigger" data-bs-toggle="tab" data-bs-target="#pkg-pane-polygon" type="button" role="tab" aria-controls="pkg-pane-polygon" aria-selected="true" data-pkg-tab="polygon">
            <i class="bi bi-pentagon me-1" aria-hidden="true"></i>
            Polygon
        </button>
    </li>
    <li class="nav-item" role="presentation">
        <button class="nav-link" id="pkg-tab-thusaa-trigger" data-bs-toggle="tab" data-bs-target="#pkg-pane-thusaa" type="button" role="tab" aria-controls="pkg-pane-thusaa" aria-selected="false" data-pkg-tab="thusaa" title="酒井算协（THUSAAC）题包">
            <i class="bi bi-mortarboard me-1" aria-hidden="true"></i>
            酒井算协<span class="en-text">THUSAAC</span>
        </button>
    </li>
</ul>
<div class="tab-content pkg-convert-tab-content border border-top-0 rounded-bottom bg-white" id="pkgConvertTabContent">
    <div class="tab-pane fade show active p-3" id="pkg-pane-polygon" role="tabpanel" aria-labelledby="pkg-tab-polygon-trigger" tabindex="0">
        <h2 class="h5 mb-3 bilingual-inline">Polygon<span class="en-text">Codeforces Polygon</span></h2>
        <p class="small text-muted mb-3">
            解析 Polygon 导出 zip，打包为题目导入任务可用的结构。
            <span class="en-text">Parse Polygon exports into CSGOJ problem-import ZIP layout.</span>
        </p>
        {include file="../../admin/view/problem/pkg_panel_polygon" /}
    </div>
    <div class="tab-pane fade p-3" id="pkg-pane-thusaa" role="tabpanel" aria-labelledby="pkg-tab-thusaa-trigger" tabindex="0">
        <h2 class="h5 mb-3 bilingual-inline">酒井算协<span class="en-text">THUSAAC / Jiujing-style</span></h2>
        <p class="small text-muted mb-3">
            解析清华酒井算协及 THU/CCPC 常见题包（<code>conf.yaml</code> + <code>statement</code> + <code>data</code>/<code>down</code>），打包为题目导入任务可用结构。
            <span class="en-text">Parse Jiujing-style packages into CSGOJ problem-import ZIP layout.</span>
        </p>
        {include file="../../admin/view/problem/pkg_panel_thusaa" /}
    </div>
</div>
