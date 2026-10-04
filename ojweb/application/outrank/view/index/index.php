{css href="__STATIC__/csgoj/outrank/outrank_list.css" /}
{js href="__JS__/overlay.js" /}
{if IsAdmin()}
{include file="../../csgoj/view/public/js_zip" /}
{/if}

<div class="outrank-list-scope<?php if (IsAdmin('administrator')): ?> outrank-list-scope--batch<?php endif; ?>">
<div class="outrank-standalone-page-header">
{assign name="csg_ph_title" value="CCPCOJ 外榜系统" /}
{assign name="csg_ph_en" value="CCPCOJ Outrank System" /}
{assign name="csg_ph_icon_class" value="bi-list-ol" /}
{include file="../../csgoj/view/public/csg_page_header" /}
</div>

<div id="outrank_toolbar" class="table-toolbar">
    <div class="d-flex align-items-center gap-2" role="form">
        <button id="outrank_refresh" type="button" class="btn btn-outline-secondary toolbar-btn" title="刷新 (Refresh)">
            <i class="bi bi-arrow-clockwise"></i>
        </button>
        <button id="outrank_clear" type="button" class="btn btn-outline-secondary toolbar-btn" title="清空筛选条件 (Clear)">
            <i class="bi bi-eraser"></i>
        </button>
        {if IsAdmin()}
        <button type="button" class="btn btn-primary toolbar-btn" id="add_outrank_btn" title="添加外榜 (Add Outrank)">
            <span><i class="bi bi-plus-circle"></i> 添加</span> <span class="en-text">Add</span>
        </button>
        <button type="button" class="btn btn-outline-primary toolbar-btn" id="outrank_import_btn" title="导入整包 JSON 或多包 ZIP（见文档）(Import JSON or multi-pack ZIP — see docs)">
            <span><i class="bi bi-box-arrow-in-down"></i> 导入</span> <span class="en-text">Import</span>
        </button>
        <!-- title 在包裹层：global.js 会把禁用 button 的 title 提升到父节点；勿把 title 写在按钮上以免整行 d-flex 误绑 tooltip -->
        <span class="d-inline-block align-middle outrank-batch-zip-btn-wrap" title="将勾选的外榜整包 JSON 打成一个 ZIP；仅勾选一条时等价于原「单行导出」。(Zip selected full JSON packs; selecting one row replaces the old per-row export.)">
            <button type="button" class="btn btn-outline-success toolbar-btn" id="outrank_batch_zip_btn" disabled>
                <span><i class="bi bi-file-earmark-zip"></i> 打包 ZIP</span> <span class="en-text">Export ZIP</span>
            </button>
        </span>
        <span id="outrank_batch_sel_hint" class="text-muted small align-self-center ms-1 d-none d-md-inline" aria-live="polite"><span class="cn-text">已选 <span id="outrank_batch_sel_count">0</span> 条</span><span class="en-text">Selected: <span id="outrank_batch_sel_count_en">0</span></span></span>
        <?php if (IsAdmin('administrator')): ?>
        <div class="form-check form-check-inline align-middle ms-1 mb-0 outrank-show-deleted-wrap" title="勾选后列表包含已删除（defunct=2）的外榜；可点「恢复」回到禁用态。(Include soft-deleted outranks — use Restore to bring back as disabled.)">
            <input class="form-check-input" type="checkbox" id="outrank_show_deleted" value="1">
            <label class="form-check-label small" for="outrank_show_deleted"><span class="cn-text">显示已删除</span><span class="en-text">Show deleted</span></label>
        </div>
        <?php endif; ?>
        <input type="file" id="outrank_import_file" accept=".json,application/json,.zip,application/zip" class="d-none" aria-hidden="true">
        {/if}
        <div class="toolbar-group">
            <span class="toolbar-label-inline"><span>搜索</span><span class="toolbar-label en-text">Search</span></span>
            <input id="outrank_search_input" name="search" class="form-control toolbar-input outrank_filter" type="text" placeholder="标题/UUID/ID" style="width: 200px;">
        </div>
    </div>
</div>

<table
        id="outrank_list_table"
        class="bootstraptable_refresh_local"
        data-toggle="table"
        data-url="/outrank/index/outrank_list_ajax"
        data-pagination="true"
        data-page-list="[25,50,100]"
        data-page-size="25"
        data-side-pagination="client"
        data-method="get"
        data-striped="true"
        data-search="false"
        data-search-align="left"
        data-sort-name="outrank_id"
        data-sort-order="desc"
        data-pagination-v-align="bottom"
        data-pagination-h-align="left"
        data-pagination-detail-h-align="right"
        data-classes="table-no-bordered table table-hover"
        data-toolbar="#outrank_toolbar"
        data-query-params="outrankListQueryParams"
        data-filter-control="true"
        data-filter-show-clear="true"
        data-cookie="true"
        data-cookie-id-table="outrank-list"
        data-cookie-expire="5mi"
        <?php if (IsAdmin('administrator')): ?>
        data-checkbox-header="true"
        data-unique-id="outrank_id"
        <?php endif; ?>
>
    <thead>
    <tr>
        <?php if (IsAdmin('administrator')): ?>
        <th data-field="state" data-checkbox="true" data-align="center" data-valign="middle" data-width="52" title="勾选后可批量打包为 ZIP（与导入多包兼容）(Select rows to export as one ZIP — compatible with import)"></th>
        <?php endif; ?>
        <th data-field="outrank_id" data-align="center" data-valign="middle" data-sortable="true" data-width="156" data-formatter="FormatterOutrankId">ID</th>
        <th data-field="title" data-align="left" data-valign="middle" data-sortable="false" data-formatter="FormatterOutrankTitle">标题<span class="en-text">Title</span></th>
        <th data-field="_times_bundle" data-align="left" data-valign="middle" data-sortable="false" data-width="220" data-formatter="FormatterOutrankTimesBundle" title="开始 / 结束 / 更新（窄屏合并列）(Start / end / updated — merged on narrow screens)">时间<span class="en-text">Times</span></th>
        {if IsAdmin() }
        <th data-field="token" data-align="center" data-valign="middle" data-sortable="false" data-width="100" data-formatter="FormatterOutrankToken" title="推送接口鉴权密钥；列表仅显示摘要，请用复制按钮获取完整 Token。(Secret API credential; list shows a short preview only — use Copy for the full token.)">Token</th>
        {/if}
        <th data-field="start_time" data-align="center" data-valign="middle" data-sortable="true" data-width="80" data-formatter="FormatterDateTimeBoth">开始<span class="en-text">Start</span></th>
        <th data-field="end_time" data-align="center" data-valign="middle" data-sortable="true" data-width="80" data-formatter="FormatterDateTimeBoth">结束<span class="en-text">End</span></th>
        <th data-field="updated_at" data-align="center" data-valign="middle" data-sortable="true" data-width="80" data-formatter="FormatterOutrankUpdatedAt">更新<span class="en-text">Updated</span></th>
        <?php if(IsAdmin('administrator')): ?>
        <th data-field="_ops_bundle" data-align="center" data-valign="middle" data-sortable="false" data-width="168" data-formatter="FormatterOutrankOpsBundle" title="状态、推送与操作（窄屏合并列）(Status, push &amp; actions — merged on narrow screens)">管理<span class="en-text">Admin</span></th>
        <th data-field="defunct" data-align="center" data-valign="middle" data-formatter="FormatterOutrankStatus" data-width="108" title="0 启用 / 1 禁用（非管理员不可见观众页）/ 2 已删除；删除后默认不在列表，需勾选「显示已删除」恢复。(0 enabled / 1 disabled for guests / 2 deleted — check Show deleted to list and restore.)">状态<span class="en-text">Status</span></th>
        <th data-field="flg_allow" data-align="center" data-valign="middle" data-formatter="FormatterOutrankAllow" data-width="80" title="是否允许使用 Token 向本系统上传/更新榜单数据；禁止后推送请求将被拒绝。(Whether rank data uploads with the token are accepted; when denied the push API rejects.)">推送<span class="en-text">Push</span></th>
        <th data-field="edit" data-align="center" data-valign="middle" data-formatter="FormatterOutrankEdit" data-width="136">操作<span class="en-text">Action</span></th>
        <?php endif; ?>
    </tr>
    </thead>
</table>

<input type="hidden" id="page_info" page_module="outrank">
</div>

{if IsAdmin()}
<!-- Outrank Edit Modal（仅管理员：减少访客 HTML） -->
<div class="modal fade" id="outrank_edit_modal" tabindex="-1" aria-labelledby="outrankModalLabel" data-bs-backdrop="static">
    <div class="modal-dialog modal-lg">
        <div class="modal-content">
            <div class="modal-header">
                <h5 class="modal-title" id="outrankModalLabel">
                    <span class="cn-text"><i class="bi bi-list-ol me-2"></i>添加外榜</span><span class="en-text">Add Outrank</span>
                </h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div class="modal-body" id="outrank_edit_modal_body">
                {include file="../../outrank/view/index/outrank_edit_form"}
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">关闭<span class="en-text">Close</span></button>
                <button type="button" class="btn btn-primary" id="outrank_modal_submit_btn">保存<span class="en-text">Save</span></button>
            </div>
        </div>
    </div>
</div>

<!-- 导入前预览（ZIP / 单 JSON 多包） -->
<div class="modal fade outrank-import-preview-modal" id="outrank_import_preview_modal" tabindex="-1" aria-labelledby="outrankImportPreviewLabel" data-bs-backdrop="static">
    <div class="modal-dialog outrank-import-preview-dialog">
        <div class="modal-content shadow">
            <div class="modal-header border-bottom py-2">
                <h5 class="modal-title fs-6 mb-0" id="outrankImportPreviewLabel">
                    <span class="cn-text"><i class="bi bi-eye me-2"></i>导入预览</span><span class="en-text">Import preview</span>
                </h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div class="modal-body py-2 px-3">
                <p class="text-muted small mb-2 mb-md-3 outrank-import-preview-hint">
                    <span class="cn-text">请核对下列整包摘要；默认已全选，可取消勾选后仅导入所选条目。列表默认按比赛开始时间升序；可点击表头排序，确认导入时按当前表格顺序依次导入已勾选项。<strong>导入按 meta.outrank_uuid 判重</strong>：UUID 已存在则<strong>更新同一行</strong>并合并 meta；含 <code>rank_data</code> 时会<strong>整文件覆盖</strong> rank.json，<strong>省略该键则不改盘上榜单文件</strong>。</span>
                    <span class="en-text">Review summaries below. All are selected by default. Import uses <strong>meta.outrank_uuid</strong>: existing UUID <strong>updates the same row</strong> (meta merge). If <code>rank_data</code> is present, <strong>rank.json is fully replaced</strong>; <strong>if omitted, the on-disk rank file is left unchanged</strong>.</span>
                </p>
                <!-- 与 Polygon 解析表、后台任务表一致：列在 thead 上用 data-field 声明；勿包 table-responsive（与 bootstrap-table 自带布局冲突）；勿对此表用 bootstraptable_refresh_local（未打开过 modal 时未 init，F5 会报错） -->
                <div class="outrank-import-preview-scroll">
                    <table id="outrank_import_preview_table" class="outrank-import-preview-bs-table">
                        <thead>
                        <tr>
                            <th data-field="state" data-checkbox="true" data-align="center" data-valign="middle" data-width="52" class="outrank-import-preview-col-check"></th>
                            <th data-field="sortFilename" data-sortable="true" data-align="left" data-valign="middle" data-formatter="FormatterOutrankImportPreviewFilename" data-escape="false" class="outrank-import-preview-filename">
                                <span class="cn-text">文件</span><span class="en-text d-block small">File</span>
                            </th>
                            <th data-field="sortMetaTitle" data-sortable="true" data-align="left" data-valign="middle" data-formatter="FormatterOutrankImportPreviewMeta" data-escape="false" class="outrank-import-preview-col-meta">
                                <span class="cn-text">外榜信息</span><span class="en-text d-block small">Outrank</span>
                            </th>
                            <th data-field="sortProb" data-sortable="true" data-align="right" data-valign="middle" data-formatter="FormatterOutrankImportPreviewProb" data-escape="false" class="outrank-import-preview-num">
                                <span class="cn-text">题</span><span class="en-text d-block small">Prob.</span>
                            </th>
                            <th data-field="sortTeam" data-sortable="true" data-align="right" data-valign="middle" data-formatter="FormatterOutrankImportPreviewCount" data-escape="false" class="outrank-import-preview-num">
                                <span class="cn-text">队</span><span class="en-text d-block small">Teams</span>
                            </th>
                            <th data-field="sortSol" data-sortable="true" data-align="right" data-valign="middle" data-formatter="FormatterOutrankImportPreviewCount" data-escape="false" class="outrank-import-preview-num">
                                <span class="cn-text">交</span><span class="en-text d-block small">Sol.</span>
                            </th>
                            <th data-field="sortStartTs" data-sortable="true" data-align="left" data-valign="middle" data-formatter="FormatterOutrankImportPreviewTime" data-escape="false" class="outrank-import-preview-time-cell">
                                <span class="cn-text">时间</span><span class="en-text d-block small">Time</span>
                            </th>
                        </tr>
                        </thead>
                    </table>
                </div>
            </div>
            <div class="modal-footer border-top py-2">
                <button type="button" class="btn btn-sm btn-secondary" data-bs-dismiss="modal"><span class="cn-text">取消</span><span class="en-text">Cancel</span></button>
                <button type="button" class="btn btn-sm btn-primary" id="outrank_import_preview_confirm">
                    <span class="cn-text">确认导入所选</span><span class="en-text">Import selected</span>
                </button>
            </div>
        </div>
    </div>
</div>

<!-- 页眉赞助横幅（观众榜标题上方展示） -->
<div class="modal fade" id="outrank_sponsor_banner_modal" tabindex="-1" aria-labelledby="outrankSponsorBannerLabel" data-bs-backdrop="static">
    <div class="modal-dialog modal-lg modal-dialog-scrollable">
        <div class="modal-content">
            <div class="modal-header py-2">
                <h5 class="modal-title fs-6" id="outrankSponsorBannerLabel">
                    <span class="cn-text"><i class="bi bi-image me-2"></i>页眉图片</span><span class="en-text">Header image</span>
                </h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div class="modal-body">
                <p class="text-muted small mb-3 outrank-sb-hint">
                    <span class="cn-text">展示在<strong>观众榜 / 滚榜</strong>标题上方。建议<strong>偏横向</strong>、约 <strong>5:1</strong>（例如 1600×320），不宜过小（建议至少约 <strong>800×80</strong>）。支持 <strong>SVG</strong> 与 <strong>PNG、JPEG</strong> 等常见格式。</span>
                    <span class="en-text">Shown above the rank/roll title. Prefer a <strong>wide banner</strong>, about <strong>5:1</strong> (e.g. 1600×320), at least about <strong>800×80</strong> px. <strong>SVG</strong> and common formats such as <strong>PNG</strong> and <strong>JPEG</strong> are supported.</span>
                </p>
                <input type="hidden" id="outrank_sb_outrank_id" value="">
                <div class="outrank-sb-preview card bg-light border mb-3">
                    <div class="card-body p-2 p-md-3">
                        <div id="outrank_sb_preview_empty" class="text-muted small py-4 text-center">
                            <span class="cn-text">当前未上传横幅</span><span class="en-text d-block mt-1">No banner uploaded</span>
                        </div>
                        <div id="outrank_sb_preview_wrap" class="d-none text-center">
                            <img id="outrank_sb_preview_img" class="img-fluid outrank-sb-preview-img" alt="" />
                        </div>
                    </div>
                </div>
                <input type="file" id="outrank_sb_file" class="d-none" accept=".svg,.webp,.png,.jpg,.jpeg,image/svg+xml,image/webp,image/png,image/jpeg">
                <div class="d-flex flex-wrap gap-2 align-items-center">
                    <button type="button" class="btn btn-primary btn-sm" id="outrank_sb_pick_btn">
                        <span class="cn-text"><i class="bi bi-upload me-1"></i>选择图片</span><span class="en-text">Choose image</span>
                    </button>
                    <button type="button" class="btn btn-outline-danger btn-sm" id="outrank_sb_delete_btn" disabled>
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

{js href="__STATIC__/csgoj/common/image_upload_prepare.js" /}
{js href="__STATIC__/csgoj/outrank/outrank_sponsor_banner_admin.js" /}
{/if}

<script type="text/javascript">
window.OUTRANK_LOGO_BASE_URL = '/static/image/logos';
window.OUTRANK_LOGO_SLUGS = <?php echo json_encode(isset($outrank_logo_slugs) ? $outrank_logo_slugs : [], JSON_UNESCAPED_UNICODE); ?>;
window.OUTRANK_LIST_BIG_ADMIN = <?php echo IsAdmin('administrator') ? 1 : 0; ?>;

/** bootstrap-table 拉取列表时附带「显示已删除」开关（仅大管理员页面存在该勾选框） */
function outrankListQueryParams(params) {
    if (!params || typeof params !== 'object') {
        params = {};
    }
    var $cb = $('#outrank_show_deleted');
    if ($cb.length && $cb.prop('checked')) {
        params.show_deleted = 1;
    }
    return params;
}

// HTML转义函数：使用全局 DomSantize（来自 global.js）
function escapeHtml(text) {
    return DomSantize(text || '');
}

/** 管理端：页眉横幅上传入口（操作列 / 窄屏管理列共用） */
function OutrankSponsorBannerAdminBtnHtml(row) {
    var id = row.outrank_id;
    var uuid = escapeHtml(row.outrank_uuid != null ? String(row.outrank_uuid) : '');
    var kind = row.page_header_kind != null ? String(row.page_header_kind) : '';
    var cls = 'btn btn-sm btn-outline-secondary outrank-sponsor-banner-admin-btn' + (kind ? ' outrank-sponsor-banner-admin-btn--has' : '');
    return (
        '<button type="button" class="' + cls + '" data-id="' + id + '" data-uuid="' + uuid + '" ' +
        'title="页眉图片：上传、预览或删除（显示在观众榜标题上方）\n' +
        'Header image: upload, preview or remove (shown above rank page title)">' +
        '<i class="bi bi-image" aria-hidden="true"></i></button>'
    );
}

function OutrankResolveLogoSlug(ckind) {
    var slugs = window.OUTRANK_LOGO_SLUGS || [];
    var set = window._outrankLogoSlugSet;
    if (!set) {
        set = {};
        for (var i = 0; i < slugs.length; i++) {
            set[slugs[i]] = true;
        }
        window._outrankLogoSlugSet = set;
    }
    if (ckind == null || ckind === '') {
        return '';
    }
    var s = String(ckind).trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
    return set[s] ? s : '';
}

function OutrankUuidFirstSegment(uuid) {
    if (!uuid || typeof uuid !== 'string') {
        return '';
    }
    var u = uuid.trim();
    var idx = u.indexOf('-');
    if (idx > 0) {
        return u.slice(0, idx);
    }
    return u.length > 16 ? u.slice(0, 8) : u;
}

function OutrankReadFileAsText(file) {
    return new Promise(function(resolve, reject) {
        var fr = new FileReader();
        fr.onload = function() { resolve(fr.result); };
        fr.onerror = function() { reject(fr.error); };
        fr.readAsText(file, 'UTF-8');
    });
}

function OutrankIsValidPack(obj) {
    if (!obj || typeof obj !== 'object') {
        return false;
    }
    var env = obj.csg_outrank_export;
    if (!env || typeof env !== 'object') {
        return false;
    }
    if (env.format_version !== '1.0') {
        return false;
    }
    if (!obj.meta || typeof obj.meta !== 'object' || !obj.meta.outrank_uuid) {
        return false;
    }
    return true;
}

function OutrankPostImport(pack) {
    return $.ajax({
        url: '/outrank/index/outrank_import_ajax',
        method: 'POST',
        contentType: 'application/json; charset=utf-8',
        data: JSON.stringify(pack),
        dataType: 'json'
    });
}

/** 刷新外榜主列表（导入/保存后调用；延迟再刷一次避免与 modal、遮罩竞态） */
function outrankRefreshMainList() {
    var $t = $('#outrank_list_table');
    if (!$t.length || !$t.data('bootstrap.table')) {
        return;
    }
    try {
        $t.bootstrapTable('refresh');
    } catch (e1) { /* ignore */ }
}

/** updated_at 距现在在 days 天内（含未来时间则 false） */
function OutrankIsUpdatedWithinDays(updatedAt, days) {
    var d = days != null ? Number(days) : 7;
    if (!updatedAt || (typeof updatedAt !== 'string' && typeof updatedAt !== 'number')) {
        return false;
    }
    var str = String(updatedAt).trim();
    if (!str) {
        return false;
    }
    var normalized = str.indexOf('T') >= 0 ? str : str.replace(' ', 'T');
    var t = Date.parse(normalized);
    if (isNaN(t)) {
        return false;
    }
    var now = Date.now();
    if (t > now) {
        return false;
    }
    var ms = d * 24 * 60 * 60 * 1000;
    return (now - t) <= ms;
}

function OutrankParseExportFilenameFromCd(cd) {
    var fname = 'outrank_export.json';
    if (!cd) {
        return fname;
    }
    var mStar = cd.match(/filename\*=UTF-8''([^;\n]+)/i);
    if (mStar) {
        return decodeURIComponent(mStar[1].trim().replace(/^["']|["']$/g, ''));
    }
    var mQ = cd.match(/filename="([^"]+)"/i);
    if (mQ) {
        return mQ[1];
    }
    return fname;
}

function OutrankFetchExportBlob(id, signal) {
    var url = '/outrank/index/outrank_export_download?outrank_id=' + encodeURIComponent(id);
    var opts = { credentials: 'same-origin' };
    if (signal) {
        opts.signal = signal;
    }
    return fetch(url, opts).then(function(r) {
        var cd = r.headers.get('content-disposition');
        var ct = (r.headers.get('content-type') || '').toLowerCase();
        if (!r.ok) {
            return r.text().then(function(t) {
                try {
                    var j = JSON.parse(t);
                    throw new Error(j.msg || j.message || ('HTTP ' + r.status));
                } catch (ex) {
                    if (ex instanceof Error && ex.message && ex.message.indexOf('HTTP') === -1 && t) {
                        throw ex;
                    }
                    throw new Error('HTTP ' + r.status);
                }
            });
        }
        if (ct.indexOf('application/json') >= 0 && !cd) {
            return r.json().then(function(j) {
                throw new Error(j.msg || j.message || 'Export failed');
            });
        }
        return r.blob().then(function(blob) {
            return { blob: blob, filename: OutrankParseExportFilenameFromCd(cd) };
        });
    });
}

function OutrankZipEntryName(row, serverFilename) {
    var base = serverFilename || 'outrank_export.json';
    base = String(base).replace(/^.*[\\/]/, '').trim() || 'outrank_export.json';
    if (!/\.json$/i.test(base)) {
        base += '.json';
    }
    return 'outrank_id' + String(row.outrank_id) + '_' + base;
}

async function OutrankRunBatchZip(rows, signal) {
    if (!window.zip || !zip.ZipWriter || !zip.BlobWriter || !zip.BlobReader) {
        throw new Error('zip.js 未就绪 (zip.js not loaded)');
    }
    var n = rows.length;
    var zipWriter = new zip.ZipWriter(new zip.BlobWriter('application/zip'));
    var tzSide0 = CsgRequireAppTimezoneForWireExport();
    await zipWriter.add(
        'csg_export_timezone.json',
        new zip.TextReader(JSON.stringify({ iana: tzSide0, schema: 1 }))
    );
    var i;
    for (i = 0; i < n; i++) {
        overlayThrowIfAborted(signal);
        var row = rows[i];
        var id = row.outrank_id;
        var pctBefore = n ? Math.round(100 * i / n) : 0;
        var label = row.title ? String(row.title) : ('ID ' + id);
        updateOverlay({
            message: '正在拉取并打包… (' + (i + 1) + '/' + n + ')',
            message_en: 'Fetching & zipping… (' + (i + 1) + '/' + n + ')',
            detail: label,
            detail_en: label,
            progressMode: 'determinate',
            progress: pctBefore
        }, pctBefore, null);

        var res = await OutrankFetchExportBlob(id, signal);
        var entryName = OutrankZipEntryName(row, res.filename);
        await zipWriter.add(entryName, new zip.BlobReader(res.blob));

        var pctAfter = n ? Math.round(100 * (i + 1) / n) : 100;
        updateOverlay({
            message: '正在拉取并打包… (' + (i + 1) + '/' + n + ')',
            message_en: 'Fetching & zipping… (' + (i + 1) + '/' + n + ')',
            detail: entryName,
            detail_en: entryName,
            progressMode: 'determinate',
            progress: pctAfter
        }, pctAfter, null);
    }
    overlayThrowIfAborted(signal);
    updateOverlay({
        message: '正在完成 ZIP 文件…',
        message_en: 'Finalizing ZIP…',
        progressMode: 'determinate',
        progress: 100,
        detail: '',
        detail_en: ''
    }, 100, null);
    return zipWriter.close();
}

async function OutrankParseZipToPacks(file) {
    if (!window.zip || !zip.ZipReader || !zip.BlobReader || !zip.TextWriter) {
        throw new Error('zip.js 未就绪 (zip.js not loaded)');
    }
    var zipReader = new zip.ZipReader(new zip.BlobReader(file));
    var entries = await zipReader.getEntries();
    var zipLevelTz = null;
    var zi;
    for (zi = 0; zi < entries.length; zi++) {
        var ze = entries[zi];
        if (ze.directory) {
            continue;
        }
        var zfn = ze.filename || '';
        if (zfn !== 'csg_export_timezone.json' && !/\/csg_export_timezone.json$/i.test(zfn)) {
            continue;
        }
        try {
            var ztxt = await ze.getData(new zip.TextWriter());
            var zobj = JSON.parse(ztxt);
            if (zobj && zobj.iana) {
                zipLevelTz = String(zobj.iana).trim();
            }
        } catch (zerr) { /* ignore */ }
    }
    var jobs = [];
    var i;
    for (i = 0; i < entries.length; i++) {
        var e = entries[i];
        if (e.directory) {
            continue;
        }
        var fn = e.filename || '';
        if (fn === 'csg_export_timezone.json' || /\/csg_export_timezone.json$/i.test(fn)) {
            continue;
        }
        if (!/\.json$/i.test(fn)) {
            continue;
        }
        var text;
        try {
            text = await e.getData(new zip.TextWriter());
        } catch (err) {
            continue;
        }
        var obj;
        try {
            obj = JSON.parse(text);
        } catch (err2) {
            continue;
        }
        if (!OutrankIsValidPack(obj)) {
            continue;
        }
        if (zipLevelTz && obj.csg_export_timezone && obj.csg_export_timezone.iana) {
            var a = String(zipLevelTz).trim();
            var b = String(obj.csg_export_timezone.iana).trim();
            if (a && b && a !== b) {
                await zipReader.close();
                throw new Error(
                    'ZIP 根 csg_export_timezone.json 与包内 JSON 的 csg_export_timezone.iana 不一致 (Root sidecar IANA conflicts with JSON envelope)'
                );
            }
        }
        if (zipLevelTz && (!obj.csg_export_timezone || !obj.csg_export_timezone.iana)) {
            await zipReader.close();
            throw new Error(
                '包内 JSON 缺少 csg_export_timezone.iana，且禁止用 ZIP 根侧车自动补全 (Each pack must declare csg_export_timezone)'
            );
        }
        if (!zipLevelTz && (!obj.csg_export_timezone || !obj.csg_export_timezone.iana)) {
            await zipReader.close();
            throw new Error('包内 JSON 缺少 csg_export_timezone（整包必填）');
        }
        jobs.push({ filename: fn, pack: obj });
    }
    await zipReader.close();
    jobs.sort(function(a, b) { return a.filename.localeCompare(b.filename); });
    return jobs;
}

function OutrankProblemLetterFromNum(num) {
    if (num == null || isNaN(num)) {
        return '?';
    }
    return String.fromCharCode('A'.charCodeAt(0) + Number(num));
}

/**
 * 与 ContestBaseTrait::contest_data_ajax 及 rank_tool 一致：仅 rank_data.problem，
 * list 行 [0]problem_id [1]problem 表 title [2]num [3]气球色(contest_problem.title) [4]pscore — 勿将 [3] 当题名。
 */
function OutrankNormalizeProblemRowForPreview(p) {
    if (p == null) {
        return null;
    }
    if (Array.isArray(p)) {
        if (p.length < 3) {
            return null;
        }
        return {
            problem_id: p[0],
            title: p[1] != null ? String(p[1]) : '',
            num: p[2],
            color: p[3] != null ? String(p[3]) : ''
        };
    }
    if (typeof p === 'object') {
        return {
            problem_id: p.problem_id,
            title: p.title != null ? String(p.title) : '',
            num: p.num,
            color: p.color != null ? String(p.color) : ''
        };
    }
    return null;
}

function OutrankProblemPreviewLabel(norm, i) {
    if (!norm) {
        return '#' + (i + 1);
    }
    var letter = OutrankProblemLetterFromNum(norm.num != null ? norm.num : i);
    var t = (norm.title || '').trim();
    if (!t) {
        t = '题 #' + (norm.problem_id != null ? norm.problem_id : (i + 1));
    }
    return letter + '. ' + t;
}

/** 文件名中间省略，悬停用完整路径 */
function OutrankFilenameMiddleEllipsis(full, headLen, tailLen) {
    var s = full != null ? String(full) : '';
    var h = headLen > 0 ? headLen : 5;
    var t = tailLen > 0 ? tailLen : 7;
    if (s.length <= h + t + 1) {
        return { display: s, full: s };
    }
    return { display: s.slice(0, h) + '…' + s.slice(-t), full: s };
}

function OutrankRankDataPayload(pack) {
    if (!pack || typeof pack !== 'object') {
        return null;
    }
    if (!Object.prototype.hasOwnProperty.call(pack, 'rank_data')) {
        return undefined;
    }
    return pack.rank_data;
}

function OutrankSummarizeRankDataBlock(rd) {
    var out = {
        problemCount: 0,
        teamCount: 0,
        solutionCount: 0,
        problemTitles: [],
        contestInnerTitle: ''
    };
    if (rd === null || rd === undefined) {
        return out;
    }
    if (typeof rd !== 'object' || Array.isArray(rd)) {
        return out;
    }
    var contest = rd.contest;
    if (contest && typeof contest === 'object' && !Array.isArray(contest) && contest.title != null) {
        out.contestInnerTitle = String(contest.title);
    }
    var tk = ['team', 'teams'];
    var sk = ['solution', 'solutions'];
    var ki;
    /* 只认 rank_data.problem（赛内 problem 表行），不用 problems 别名以免与异构数据混淆 */
    if (Array.isArray(rd.problem)) {
        out.problemCount = rd.problem.length;
    }
    for (ki = 0; ki < tk.length; ki++) {
        if (Array.isArray(rd[tk[ki]])) {
            out.teamCount = rd[tk[ki]].length;
            break;
        }
    }
    for (ki = 0; ki < sk.length; ki++) {
        if (Array.isArray(rd[sk[ki]])) {
            out.solutionCount = rd[sk[ki]].length;
            break;
        }
    }
    var arr = Array.isArray(rd.problem) ? rd.problem : [];
    var i;
    var MAX_LINES = 80;
    for (i = 0; i < arr.length; i++) {
        if (out.problemTitles.length >= MAX_LINES) {
            break;
        }
        var norm = OutrankNormalizeProblemRowForPreview(arr[i]);
        out.problemTitles.push(OutrankProblemPreviewLabel(norm, i));
    }
    if (arr.length > MAX_LINES) {
        out.problemTitles.push('… 共 ' + arr.length + ' 题 / ' + arr.length + ' problems（预览仅列前 ' + MAX_LINES + ' 行）');
    }
    return out;
}

function OutrankSummarizePackForPreview(pack, sourceFilename) {
    var meta = pack && pack.meta ? pack.meta : {};
    var env = pack && pack.csg_outrank_export ? pack.csg_outrank_export : {};
    var rdPayload = OutrankRankDataPayload(pack);
    var rankKind;
    if (rdPayload === undefined) {
        rankKind = 'omit';
    } else if (rdPayload === null) {
        rankKind = 'delete';
    } else {
        rankKind = 'write';
    }
    var stats = rdPayload && typeof rdPayload === 'object' && !Array.isArray(rdPayload)
        ? OutrankSummarizeRankDataBlock(rdPayload)
        : { problemCount: 0, teamCount: 0, solutionCount: 0, problemTitles: [], contestInnerTitle: '' };
    if (rankKind !== 'write') {
        stats = { problemCount: '—', teamCount: '—', solutionCount: '—', problemTitles: [], contestInnerTitle: '' };
    }
    var pageHeaderKind = 'omit';
    if (pack && Object.prototype.hasOwnProperty.call(pack, 'page_header_image')) {
        if (pack.page_header_image === null) {
            pageHeaderKind = 'delete';
        } else if (pack.page_header_image && typeof pack.page_header_image === 'object') {
            pageHeaderKind = 'write';
        }
    }
    var pageHeaderMediaKind = '';
    if (pack && pack.page_header_image && typeof pack.page_header_image === 'object' && pack.page_header_image.kind != null) {
        pageHeaderMediaKind = String(pack.page_header_image.kind);
    }
    var descRaw = meta.description != null ? String(meta.description).trim() : '';
    var descShort = descRaw;
    if (descShort.length > 160) {
        descShort = descShort.slice(0, 160) + '…';
    }
    return {
        sourceFilename: sourceFilename || '—',
        metaTitle: meta.title != null ? String(meta.title) : '',
        metaUuid: meta.outrank_uuid != null ? String(meta.outrank_uuid) : '',
        metaCkind: meta.ckind != null ? String(meta.ckind) : '',
        metaDescriptionShort: descShort,
        metaDescriptionFull: descRaw,
        metaDefunct: meta.defunct,
        metaFlgAllow: meta.flg_allow,
        metaStart: meta.start_time != null ? String(meta.start_time) : '',
        metaEnd: meta.end_time != null ? String(meta.end_time) : '',
        exportedAt: env.exported_at != null ? String(env.exported_at) : '',
        rankKind: rankKind,
        pageHeaderKind: pageHeaderKind,
        pageHeaderMediaKind: pageHeaderMediaKind,
        problemCount: stats.problemCount,
        teamCount: stats.teamCount,
        solutionCount: stats.solutionCount,
        problemTitles: stats.problemTitles,
        contestInnerTitle: stats.contestInnerTitle
    };
}

/** 用于导入预览排序：meta.start_time → 毫秒时间戳，缺失或无法解析为 0 */
function OutrankPackMetaStartTimeTs(pack) {
    var meta = pack && pack.meta ? pack.meta : {};
    if (meta.start_time == null) {
        return 0;
    }
    var str = String(meta.start_time).trim();
    if (!str) {
        return 0;
    }
    var normalized = str.indexOf('T') >= 0 ? str : str.replace(' ', 'T');
    var t = Date.parse(normalized);
    return isNaN(t) ? 0 : t;
}

function OutrankImportPreviewMetaBlockHtml(s) {
    var statusBadges = '';
    var md = s.metaDefunct != null ? String(s.metaDefunct) : '0';
    if (md === '1') {
        statusBadges += '<span class="badge bg-warning text-dark me-1"><span class="cn-text">禁用</span><span class="en-text">Disabled</span></span>';
    } else if (md === '2') {
        statusBadges += '<span class="badge bg-secondary me-1"><span class="cn-text">已删除</span><span class="en-text">Deleted</span></span>';
    }
    if (String(s.metaFlgAllow) === '0') {
        statusBadges += '<span class="badge bg-secondary me-1"><span class="cn-text">禁止推送</span><span class="en-text">Push off</span></span>';
    }
    var descHtml = '';
    if (s.metaDescriptionShort) {
        var dtip = s.metaDescriptionFull && s.metaDescriptionFull !== s.metaDescriptionShort ? escapeHtml(s.metaDescriptionFull) : '';
        descHtml = '<div class="small text-muted text-break outrank-import-preview-desc"' + (dtip ? ' data-csg-tooltip-preline="true" title="' + dtip + '"' : '') + '>' + escapeHtml(s.metaDescriptionShort) + '</div>';
    }
    var metaTitleStr = String(s.metaTitle || '').trim();
    var contestDataStr = s.contestInnerTitle ? String(s.contestInnerTitle).trim() : '';
    var showContestInRank = contestDataStr && contestDataStr !== metaTitleStr;
    var exportedLine = '';
    if (s.exportedAt) {
        exportedLine = '<div class="small text-muted font-monospace mt-1" title="包内 csg_outrank_export.exported_at / Pack export timestamp">' +
            '<span class="cn-text">导出时间</span><span class="en-text"> / Exported:</span> ' + escapeHtml(s.exportedAt) + '</div>';
    }
    var rankJsonNote = '';
    if (s.rankKind === 'omit') {
        rankJsonNote = '<div class="small text-warning mt-1"><span class="cn-text">本包未含 rank.json 正文，导入后服务器上该文件不变。</span><span class="en-text">No rank payload in pack; server rank.json unchanged.</span></div>';
    } else if (s.rankKind === 'delete') {
        rankJsonNote = '<div class="small text-danger mt-1"><span class="cn-text">本包将删除服务器上的 rank.json。</span><span class="en-text">Pack will delete rank.json on server.</span></div>';
    }
    var pageHeaderNote = '';
    if (s.pageHeaderKind === 'delete') {
        pageHeaderNote = '<div class="small text-danger mt-1"><span class="cn-text">本包将删除服务器上的页眉横幅。</span><span class="en-text">Pack will remove header banner on server.</span></div>';
    } else if (s.pageHeaderKind === 'write') {
        pageHeaderNote = '<div class="small text-success mt-1"><span class="cn-text">本包含页眉横幅（' + escapeHtml(s.pageHeaderMediaKind || '?') + '）。</span><span class="en-text">Pack includes header banner (' + escapeHtml(s.pageHeaderMediaKind || '?') + ').</span></div>';
    }
    return '<div class="fw-semibold text-break outrank-import-preview-meta-title">' + escapeHtml(s.metaTitle || '（无标题）') + '</div>' +
        '<div class="small text-muted font-monospace text-break">' + escapeHtml(s.metaUuid) + '</div>' +
        (statusBadges ? '<div class="small mb-1">' + statusBadges + '</div>' : '') +
        (s.metaCkind ? '<div class="small"><span class="badge bg-light text-dark border">' + escapeHtml(s.metaCkind) + '</span></div>' : '') +
        descHtml +
        (showContestInRank ? '<div class="small text-muted text-break mt-1">榜单内赛名 <span class="en-text">/ Contest in data:</span> ' + escapeHtml(contestDataStr) + '</div>' : '') +
        exportedLine +
        rankJsonNote +
        pageHeaderNote;
}

function FormatterOutrankImportPreviewFilename(value, row) {
    var s = row.importSummary;
    var src = s && s.sourceFilename != null ? String(s.sourceFilename) : '';
    var fnEll = OutrankFilenameMiddleEllipsis(src, 5, 7);
    return '<span class="outrank-import-preview-filename-inner font-monospace text-muted" data-csg-tooltip-preline="true" title="' + escapeHtml(fnEll.full) + '">' +
        escapeHtml(fnEll.display) + '</span>';
}

function FormatterOutrankImportPreviewMeta(value, row) {
    return '<div class="small outrank-import-preview-meta-cell">' + OutrankImportPreviewMetaBlockHtml(row.importSummary) + '</div>';
}

function FormatterOutrankImportPreviewProb(value, row) {
    var s = row.importSummary;
    if (s.problemTitles && s.problemTitles.length) {
        var tip = s.problemTitles.join('\n');
        return '<span class="outrank-import-preview-prob" data-csg-tooltip-preline="true" title="' + escapeHtml(tip) + '">' + escapeHtml(String(s.problemCount)) + '</span>';
    }
    return '<span>' + escapeHtml(String(s.problemCount)) + '</span>';
}

function FormatterOutrankImportPreviewCount(value, row, index, field) {
    var s = row.importSummary;
    var raw = field === 'sortTeam' ? s.teamCount : s.solutionCount;
    return escapeHtml(String(raw));
}

function FormatterOutrankImportPreviewTime(value, row) {
    var s = row.importSummary;
    if (s.metaStart || s.metaEnd) {
        return '<div class="small text-break">' + escapeHtml(s.metaStart || '—') + '</div>' +
            '<div class="small text-muted text-break">' + escapeHtml(s.metaEnd || '—') + '</div>';
    }
    return '<span class="text-muted">—</span>';
}

function OutrankOpenImportPreviewModal(jobs) {
    var $modal = $('#outrank_import_preview_modal');
    var $t = $('#outrank_import_preview_table');
    if (!$modal.length || !$t.length) {
        return;
    }
    var sortedJobs = jobs.slice().sort(function(a, b) {
        var ta = OutrankPackMetaStartTimeTs(a.pack);
        var tb = OutrankPackMetaStartTimeTs(b.pack);
        if (ta !== tb) {
            return ta - tb;
        }
        return String(a.filename || '').localeCompare(String(b.filename || ''));
    });
    var rows = [];
    var idx;
    for (idx = 0; idx < sortedJobs.length; idx++) {
        var item = sortedJobs[idx];
        var s = OutrankSummarizePackForPreview(item.pack, item.filename);
        var sortProb = typeof s.problemCount === 'number' ? s.problemCount : -999999999;
        var sortTeam = typeof s.teamCount === 'number' ? s.teamCount : -999999999;
        var sortSol = typeof s.solutionCount === 'number' ? s.solutionCount : -999999999;
        rows.push({
            state: true,
            filename: item.filename,
            pack: item.pack,
            importSummary: s,
            sortFilename: s.sourceFilename || '',
            sortMetaTitle: String(s.metaTitle || '').trim().toLowerCase(),
            sortProb: sortProb,
            sortTeam: sortTeam,
            sortSol: sortSol,
            sortStartTs: OutrankPackMetaStartTimeTs(item.pack)
        });
    }
    if ($t.data('bootstrap.table')) {
        $t.bootstrapTable('destroy');
    }
    /* 列定义来自 thead（与 admin/backtask、pkg_panel_polygon 一致）；不设 height，避免固定表头克隆与 modal/外层 sticky 叠加成双表头，滚动交给 .outrank-import-preview-scroll */
    $t.bootstrapTable({
        data: rows,
        sortName: 'sortStartTs',
        sortOrder: 'asc',
        maintainMetaData: true,
        clickToSelect: false,
        pagination: false,
        sidePagination: 'client',
        search: false,
        showColumns: false,
        showToggle: false,
        checkboxHeader: true,
        classes: 'table table-sm table-striped table-hover align-middle outrank-import-preview-table table-no-bordered mb-0',
        undefinedText: '—'
    });
    $modal.one('shown.bs.modal', function() {
        if ($t.data('bootstrap.table')) {
            $t.bootstrapTable('resetView');
        }
    });
    var el = document.getElementById('outrank_import_preview_modal');
    if (el && typeof bootstrap !== 'undefined' && bootstrap.Modal) {
        var inst = bootstrap.Modal.getInstance(el) || new bootstrap.Modal(el);
        inst.show();
    }
}

async function OutrankExecuteImportJobs(jobs) {
    if (!jobs || !jobs.length) {
        return;
    }
    showOverlay({
        message: '正在导入外榜…',
        message_en: 'Importing outrank package(s)…',
        progressMode: 'determinate',
        progress: 0,
        detail: '',
        detail_en: ''
    });

    var errors = [];
    var successes = [];
    var j;
    for (j = 0; j < jobs.length; j++) {
        var item = jobs[j];
        var pctBefore = jobs.length ? Math.round(100 * j / jobs.length) : 0;
        updateOverlay({
            message: '正在导入外榜… (' + (j + 1) + '/' + jobs.length + ')',
            message_en: 'Importing… (' + (j + 1) + '/' + jobs.length + ')',
            detail: item.filename,
            detail_en: item.filename,
            progressMode: 'determinate',
            progress: pctBefore
        }, pctBefore, null);

        try {
            var res = await OutrankPostImport(item.pack);
            if (!(res.code == 1 || res.status == 'success')) {
                errors.push(item.filename + ': ' + (res.msg || 'failed'));
            } else {
                successes.push({ filename: item.filename, res: res });
            }
        } catch (xhr) {
            var msg = '请求失败';
            if (xhr.responseJSON && xhr.responseJSON.msg) {
                msg = xhr.responseJSON.msg;
            }
            errors.push(item.filename + ': ' + msg);
        }

        var pctAfter = jobs.length ? Math.round(100 * (j + 1) / jobs.length) : 100;
        updateOverlay({
            message: '正在导入外榜… (' + (j + 1) + '/' + jobs.length + ')',
            message_en: 'Importing… (' + (j + 1) + '/' + jobs.length + ')',
            detail: item.filename,
            detail_en: item.filename,
            progressMode: 'determinate',
            progress: pctAfter
        }, pctAfter, null);
    }

    hideOverlay();
    outrankRefreshMainList();
    setTimeout(outrankRefreshMainList, 200);
    setTimeout(outrankRefreshMainList, 500);

    if (errors.length) {
        var failMsg = errors.join('\n');
        var failMsgEn = failMsg;
        if (successes.length) {
            failMsg = '成功 ' + successes.length + ' 个、失败 ' + errors.length + ' 个。\n\n失败详情：\n' + failMsg;
            failMsgEn = successes.length + ' succeeded, ' + errors.length + ' failed.\n\nFailures:\n' + failMsgEn;
        } else {
            failMsg = '部分导入失败：\n' + failMsg;
            failMsgEn = 'Some imports failed:\n' + failMsgEn;
        }
        alerty.error({
            message: failMsg,
            message_en: failMsgEn
        });
    } else if (successes.length === 1) {
        var r0 = successes[0].res;
        var d0 = r0.data || {};
        alerty.success({
            message: r0.msg || '导入完成',
            message_en: d0.msg_en || r0.msg || 'Import finished'
        });
    } else {
        var msgLines = [];
        var msgLinesEn = [];
        var si;
        for (si = 0; si < successes.length; si++) {
            var sx = successes[si];
            var rx = sx.res;
            var dx = rx.data || {};
            msgLines.push('【' + sx.filename + '】' + (rx.msg || '成功'));
            msgLinesEn.push('[' + sx.filename + '] ' + (dx.msg_en || rx.msg || 'OK'));
        }
        alerty.success({
            message: '导入完成（共 ' + successes.length + ' 个包）：\n' + msgLines.join('\n'),
            message_en: 'Import finished (' + successes.length + ' pack(s)):\n' + msgLinesEn.join('\n')
        });
    }
}

async function OutrankRunImportFile(file) {
    var jobs = [];
    var name = file.name || '';
    showOverlay({
        message: '正在读取并解析文件…',
        message_en: 'Reading and parsing file…',
        progressMode: 'indeterminate',
        detail: name || '',
        detail_en: name || ''
    });
    try {
        if (/\.zip$/i.test(name)) {
            jobs = await OutrankParseZipToPacks(file);
            if (jobs.length === 0) {
                alerty.error({
                    message: 'ZIP 内无有效外榜整包 JSON（须含 csg_outrank_export.format_version 为 1.0）',
                    message_en: 'No valid outrank pack JSON in ZIP (need csg_outrank_export.format_version 1.0)'
                });
                return;
            }
        } else {
            var text = await OutrankReadFileAsText(file);
            var obj;
            try {
                obj = JSON.parse(text);
            } catch (e) {
                alerty.error({ message: 'JSON 解析失败', message_en: 'Invalid JSON' });
                return;
            }
            if (!OutrankIsValidPack(obj)) {
                alerty.error({
                    message: '不是有效的外榜整包（参见文档格式）',
                    message_en: 'Not a valid outrank pack (see documentation)'
                });
                return;
            }
            jobs = [{ filename: name || 'import.json', pack: obj }];
        }
    } finally {
        if (typeof hideOverlay === 'function') {
            hideOverlay();
        }
    }
    if (jobs.length) {
        OutrankOpenImportPreviewModal(jobs);
    }
}

/** 「更新」列：与大管理员列表一致的双语时间；近 7 天内更新且仅大管理员可见时左上角叠黄星 */
function FormatterOutrankUpdatedAt(value, row, index, field) {
    var inner = typeof FormatterDateTimeBoth === 'function'
        ? FormatterDateTimeBoth(value, row, index, field)
        : escapeHtml(value != null ? String(value) : '—');
    if (!row.is_admin || !OutrankIsUpdatedWithinDays(row.updated_at, 7)) {
        return inner;
    }
    return '<div class="outrank-updated-at-cell outrank-updated-at-cell--recent">' +
        '<span class="outrank-updated-at__star" title="更新时间在 7 天内&#10;Updated within 7 days">' +
        '<i class="bi bi-star-fill" aria-hidden="true"></i></span>' +
        '<div class="outrank-updated-at__inner">' + inner + '</div></div>';
}

/** 与列表 datetime 列一致：截年两位后拆日期/时间，用于窄屏卡片展示 */
function OutrankMobileDatetimeParts(value) {
    if (value == null || value === '') {
        return null;
    }
    var str = String(value).trim();
    if (!str) {
        return null;
    }
    var sliced = str.length >= 11 ? str.substring(2) : str;
    var parts = sliced.split(/\s+/);
    var title = escapeHtml(str);
    if (parts.length < 2) {
        return { title: title, mono: escapeHtml(sliced) };
    }
    return { title: title, date: escapeHtml(parts[0]), time: escapeHtml(parts[1]) };
}

function OutrankMobileClockHtml(value) {
    var p = OutrankMobileDatetimeParts(value);
    if (!p) {
        return '<span class="outrank-mtime-empty">—</span>';
    }
    if (p.mono) {
        return '<div class="outrank-mtime-val" title="' + p.title + '"><span class="outrank-mtime-val__mono">' + p.mono + '</span></div>';
    }
    return '<div class="outrank-mtime-val" title="' + p.title + '">' +
        '<span class="outrank-mtime-val__date">' + p.date + '</span>' +
        '<span class="outrank-mtime-val__time">' + p.time + '</span></div>';
}

/** 窄屏：三行时间，左端单图标 + 时间与图标同一行不换行；更新为空心星 / 近 7 日实心星 */
function FormatterOutrankTimesBundle(value, row, index, field) {
    var startH = OutrankMobileClockHtml(row.start_time);
    var endH = OutrankMobileClockHtml(row.end_time);
    var updH = OutrankMobileClockHtml(row.updated_at);
    var updRecent = OutrankIsUpdatedWithinDays(row.updated_at, 7);
    var updRowClass =
        'outrank-time-flow-row outrank-time-flow-row--upd' + (updRecent ? ' outrank-time-flow-row--upd-recent' : '');
    var tStart = '开始&#10;Start';
    var tEnd = '结束&#10;End';
    var tUpd = '更新&#10;Updated';
    var tUpdHot = '近 7 日内有更新&#10;Updated within 7 days';
    var updIconTitle = updRecent ? tUpdHot : tUpd;
    var updIconClass = updRecent ? 'bi bi-star-fill' : 'bi bi-star';
    return (
        '<div class="outrank-time-stack">' +
        '<div class="outrank-time-flow-row outrank-time-flow-row--start">' +
        '<span class="outrank-time-flow-row__icon" title="' +
        tStart +
        '"><i class="bi bi-play-circle-fill" aria-hidden="true"></i></span>' +
        '<div class="outrank-time-flow-row__clock">' +
        startH +
        '</div></div>' +
        '<div class="outrank-time-flow-row outrank-time-flow-row--end">' +
        '<span class="outrank-time-flow-row__icon" title="' +
        tEnd +
        '"><i class="bi bi-stop-circle-fill" aria-hidden="true"></i></span>' +
        '<div class="outrank-time-flow-row__clock">' +
        endH +
        '</div></div>' +
        '<div class="' +
        updRowClass +
        '">' +
        '<span class="outrank-time-flow-row__icon" title="' +
        updIconTitle +
        '"><i class="' +
        updIconClass +
        '" aria-hidden="true"></i></span>' +
        '<div class="outrank-time-flow-row__clock">' +
        updH +
        '</div></div>' +
        '</div>'
    );
}

/** 窄屏大管理员：Bootstrap 5 竖向按钮组（与桌面列同款 btn 语义色） */
function FormatterOutrankOpsBundle(value, row, index, field) {
    if (!row.is_admin) {
        return '<span class="text-muted small">—</span>';
    }
    var id = row.outrank_id;
    var d = row.defunct != null ? String(row.defunct) : '0';
    var parts = [];

    if (d === '2') {
        parts.push(
            '<div class="alert alert-secondary py-2 px-2 mb-0 d-flex flex-wrap align-items-center justify-content-between gap-2 outrank-ops-bs-alert">' +
            '<span class="small fw-semibold text-secondary"><i class="bi bi-archive me-1" aria-hidden="true"></i><span class="cn-text">已删除</span><span class="en-text">Deleted</span></span>' +
            '<button type="button" class="btn btn-sm btn-outline-secondary outrank-restore-deleted" data-id="' + id + '" title="恢复为禁用（可再点启用）(Restore as disabled)">' +
            '<span class="cn-text">恢复</span><span class="en-text">Restore</span></button></div>'
        );
    } else {
        var cur = d === '0' ? '启用' : '禁用';
        var nextEn = d === '0' ? 'Disabled' : 'Enabled';
        var stTitle = '点击更改为' + (d === '0' ? '禁用' : '启用') + ' / Tap for ' + nextEn;
        var stCls = d === '0' ? 'btn-success' : 'btn-warning';
        parts.push(
            '<button type="button" field="defunct" itemid="' + id + '" status="' + escapeHtml(d) + '" ' +
            'class="change_status btn btn-sm ' + stCls + ' w-100" title="' + escapeHtml(stTitle) + '">' +
            '<span class="cn-text">' + cur + '</span><span class="en-text">' + (d === '0' ? 'On' : 'Off') + '</span></button>'
        );
    }

    var fa = row.flg_allow == '1' ? '1' : '0';
    var pCur = fa === '1' ? '允许' : '禁止';
    var pNext = fa === '1' ? '禁止' : '允许';
    var pNextEn = fa === '1' ? 'Denied' : 'Allowed';
    var pCls = fa === '1' ? 'btn-success' : 'btn-danger';
    var pTitle = '点击更改为' + pNext + '推送(Click to change to ' + pNextEn + ')';
    parts.push(
        '<button type="button" field="flg_allow" itemid="' + id + '" status="' + fa + '" ' +
        'class="change_allow_status btn btn-sm ' + pCls + ' w-100" title="' + escapeHtml(pTitle) + '">' +
        '<span class="cn-text">' + pCur + '推送</span><span class="en-text">' + (fa === '1' ? 'Allowed' : 'Denied') + '</span></button>'
    );

    var isDel = d === '2';
    var delBtn = isDel
        ? '<span class="btn btn-sm btn-outline-secondary disabled" title="已删除 (Already deleted)"><i class="bi bi-trash"></i></span>'
        : '<button type="button" class="btn btn-sm btn-outline-danger delete-outrank" data-id="' + id + '" title="删除（标记为已删除）(Delete — mark as deleted)"><i class="bi bi-trash"></i></button>';
    parts.push(
        '<div class="btn-group w-100" role="group" aria-label="操作">' +
        '<button type="button" class="btn btn-sm btn-outline-primary edit-outrank-btn" data-id="' + id + '" title="编辑 (Edit)"><i class="bi bi-pencil-square"></i></button>' +
        OutrankSponsorBannerAdminBtnHtml(row) +
        delBtn +
        '</div>'
    );

    return '<div class="d-grid gap-2 w-100 outrank-ops-bs">' + parts.join('') + '</div>';
}

var OUTRANK_LIST_COL_BREAK = 992;
var outrankListColSyncTimer = null;

function syncOutrankListResponsiveColumns() {
    var wide = window.matchMedia('(min-width: ' + OUTRANK_LIST_COL_BREAK + 'px)').matches;
    var $t = $('#outrank_list_table');
    if (!$t.length || !$t.data('bootstrap.table')) {
        return;
    }
    function colVis(field, hidden) {
        try {
            $t.bootstrapTable(hidden ? 'hideColumn' : 'showColumn', field);
        } catch (e1) { /* 列不存在等 */ }
    }
    colVis('start_time', !wide);
    colVis('end_time', !wide);
    colVis('updated_at', !wide);
    colVis('_times_bundle', wide);
    if (window.OUTRANK_LIST_BIG_ADMIN) {
        colVis('defunct', !wide);
        colVis('flg_allow', !wide);
        colVis('edit', !wide);
        colVis('_ops_bundle', wide);
    }
    try {
        $t.bootstrapTable('resetView');
    } catch (e2) { /* ignore */ }
}

function scheduleSyncOutrankListCols() {
    clearTimeout(outrankListColSyncTimer);
    outrankListColSyncTimer = setTimeout(syncOutrankListResponsiveColumns, 120);
}

// Formatter函数
function FormatterOutrankId(value, row, index, field) {
    var slug = OutrankResolveLogoSlug(row.ckind);
    var base = window.OUTRANK_LOGO_BASE_URL || '/static/image/logos';
    var uuidSeg = escapeHtml(OutrankUuidFirstSegment(row.outrank_uuid || ''));
    var idStr = escapeHtml(String(value != null ? value : ''));
    var logoSpan;
    if (slug) {
        logoSpan = '<span class="outrank-type-logo" role="img" style="--outrank-logo-bg: url(\'' + base + '/' + slug + '.webp\')" title="' + escapeHtml(slug) + '"></span>';
    } else {
        logoSpan = '<span class="outrank-type-logo outrank-type-logo--placeholder" aria-hidden="true"></span>';
    }
    /* 始终保留左侧徽标槽位，与有 logo 行对齐 ID 数字与 UUID */
    var wrapCls = 'outrank-id-cell outrank-id-cell--has-logo';
    return '<div class="' + wrapCls + '" title="双击复制UUID (Double-click to copy UUID)">' + logoSpan +
        '<div class="outrank-id-cell__text">' +
        '<span class="outrank-id-cell__id">' + idStr + '</span>' +
        '<span class="outrank-id-cell__uuid">' + (uuidSeg || '—') + '</span>' +
        '</div></div>';
}

function FormatterOutrankTitle(value, row, index, field) {
    var safe = escapeHtml(value != null ? String(value) : '');
    var uuid = row.outrank_uuid || '';
    var href = '/outrank/rank?outrank_uuid=' + encodeURIComponent(uuid);
    return '<a class="outrank-title-link text-decoration-none text-primary" href="' + href + '" data-id="' + String(row.outrank_id) + '" title="' + safe + '">' + safe + '</a>';
}

function FormatterOutrankStatus(value, row, index, field) {
    var d = row.defunct != null ? String(row.defunct) : '0';
    if (d === '2') {
        return '<div class="d-flex flex-column align-items-center gap-1 outrank-status-deleted-cell">' +
            '<span class="badge bg-secondary"><span class="cn-text">已删除</span><span class="en-text">Deleted</span></span>' +
            '<button type="button" class="btn btn-sm btn-outline-secondary outrank-restore-deleted py-0 px-2" data-id="' + row.outrank_id + '" title="恢复为禁用（可再点启用）(Restore as disabled, then enable if needed)">' +
            '<span class="cn-text">恢复</span><span class="en-text">Restore</span></button></div>';
    }
    var currentStatus = d === '0' ? '启用' : '禁用';
    var nextStatus = d === '0' ? '禁用' : '启用';
    var currentStatusEn = d === '0' ? 'Enabled' : 'Disabled';
    var nextStatusEn = d === '0' ? 'Disabled' : 'Enabled';
    return '<button type="button" field="defunct" itemid="' + row.outrank_id + '" ' +
        'class="change_status btn btn-sm ' + (d === '0' ? 'btn-success' : 'btn-warning') + '" ' +
        'status="' + d + '" title="点击更改为' + nextStatus + '状态(Click to change to ' + nextStatusEn + ')">' +
        currentStatus + '<span class="en-text">' + currentStatusEn + '</span></button>';
}
function OutrankTokenSummary(token) {
    if (!token || typeof token !== 'string') return '—';
    const t = token.trim();
    if (t.length === 0) return '—';
    if (t.length <= 8) return '••••••••';
    return escapeHtml(t.slice(0, 4) + '…' + t.slice(-4));
}

function FormatterOutrankToken(value, row, index, field) {
    if (!value) return '';

    const summary = OutrankTokenSummary(value);
    return `
        <div class="d-flex align-items-center gap-1 justify-content-center flex-nowrap outrank-token-cell">
            <span class="text-muted font-monospace small user-select-none outrank-token-cell__preview" data-csg-tooltip-preline="true" title="双击本列任意处&#10;下载推送配置 JSON（含 api_url、uuid、token 等）&#10;Double-click anywhere in this column&#10;To download push config JSON (api_url, uuid, token, etc.)">${summary}</span>
            <button type="button" class="btn btn-sm btn-outline-secondary outrank-copy-token-btn py-0 px-1 flex-shrink-0" data-outrank-id="${row.outrank_id}" data-csg-tooltip-preline="true" title="点击复制完整 Token&#10;双击本列任意处可下载推送配置 JSON&#10;Click to copy the full token&#10;Double-click anywhere in the Token column to download push config JSON">
                <i class="bi bi-clipboard"></i>
            </button>
        </div>
    `;
}
function FormatterOutrankAllow(value, row, index, field) {
    if (!row.is_admin) {
        return `<span class="btn btn-sm btn-outline-secondary disabled" title="无权限 (No Permission)">
                    <i class="bi bi-lock"></i>
                </span>`;
    }
    
    let currentStatus = row.flg_allow == '1' ? "允许" : "禁止";
    let nextStatus = row.flg_allow == '1' ? "禁止" : "允许";
    let currentStatusEn = row.flg_allow == '1' ? "Allowed" : "Denied";
    let nextStatusEn = row.flg_allow == '1' ? "Denied" : "Allowed";
    
    return `
        <button type='button' field='flg_allow' itemid='${row.outrank_id}' 
            class='change_allow_status btn btn-sm ${row.flg_allow == '1' ? "btn-success" : "btn-danger"}' 
            status='${row.flg_allow}' title="点击更改为${nextStatus}状态(Click to change to ${nextStatusEn})">
            ${currentStatus}<span class='en-text'>${currentStatusEn}</span>
        </button>
    `;
}

function FormatterOutrankEdit(value, row, index, field) {
    if (row.is_admin) {
        var isDel = String(row.defunct) === '2';
        var delBtn = isDel
            ? '<span class="btn btn-sm btn-outline-secondary disabled py-0 px-2" title="已删除 (Already deleted)"><i class="bi bi-trash"></i></span>'
            : '<button type="button" class="btn btn-sm btn-outline-danger delete-outrank" data-id="' + row.outrank_id + '" title="删除（标记为已删除）(Delete — mark as deleted)"><i class="bi bi-trash"></i></button>';
        return `
            <div class="outrank-action-cell d-inline-flex align-items-center justify-content-center gap-1 flex-nowrap">
            <button type="button" class="btn btn-sm btn-outline-primary edit-outrank-btn" data-id="${row.outrank_id}" title="编辑 (Edit)">
                <i class="bi bi-pencil-square"></i>
            </button>
            ${OutrankSponsorBannerAdminBtnHtml(row)}
            ${delBtn}
            </div>
        `;
    } else {
        return `<span class="btn btn-sm btn-outline-secondary disabled" title="无权限 (No Permission)">
                    <i class="bi bi-lock"></i>
                </span>`;
    }
}

var OUTRANK_MODAL_SUBMIT_BTN_HTML = '保存<span class="en-text">Save</span>';

/** 恢复外榜编辑 modal 底部保存按钮（关闭 modal 或再次打开前须调用，避免停留在 Waiting...） */
function resetOutrankModalSubmitBtn(disabled) {
    var $btn = $('#outrank_modal_submit_btn');
    var timer = $btn.data('delay-timer');
    if (timer) {
        clearInterval(timer);
        $btn.removeData('delay-timer');
    }
    $btn.removeData('original-html');
    $btn.html(OUTRANK_MODAL_SUBMIT_BTN_HTML);
    if (disabled) {
        $btn.attr('disabled', true);
    } else {
        $btn.removeAttr('disabled');
    }
}

function setOutrankModalSubmitBtnWaiting() {
    $('#outrank_modal_submit_btn').html('<span class="cn-text">保存中</span><span class="en-text">Saving</span>...');
}

// 打开编辑 modal
function openOutrankEditModal(id) {
    const modal = new bootstrap.Modal(document.getElementById('outrank_edit_modal'));
    const modalTitle = $('#outrankModalLabel');
    
    // 设置标题
    if (id) {
        modalTitle.html('<span class="cn-text"><i class="bi bi-list-ol me-2"></i>编辑外榜</span><span class="en-text">Edit Outrank</span>');
    } else {
        modalTitle.html('<span class="cn-text"><i class="bi bi-list-ol me-2"></i>添加外榜</span><span class="en-text">Add Outrank</span>');
    }
    
    // 打开时先恢复按钮文案（上次保存成功后 modal 已关，按钮可能仍为 Waiting...）
    resetOutrankModalSubmitBtn(true);
    
    // 清空表单
    clearOutrankForm();
    
    // 加载数据
    if (id) {
        // 编辑模式：获取数据并填充表单
        $.get('/outrank/index/outrank_get_ajax', {id: id}, function(res) {
            if (res.code == 1 || res.status == 'success') {
                const data = res.data || {};
                fillOutrankForm(data);
                resetOutrankModalSubmitBtn(false);
                // 初始化表单（编辑模式）
                if (typeof initOutrankEditForm === 'function') {
                    initOutrankEditForm(true);
                }
            } else {
                alerty.error({
                    message: res.msg || '加载数据失败',
                    message_en: res.msg_en || 'Failed to load data'
                });
                modal.hide();
            }
        }, 'json').fail(function(xhr) {
            let errorMsg = '加载数据失败';
            if (xhr.responseJSON && xhr.responseJSON.msg) {
                errorMsg = xhr.responseJSON.msg;
            }
            alerty.error({
                message: errorMsg,
                message_en: 'Failed to load data'
            });
            modal.hide();
        });
    } else {
        // 新增模式：直接初始化表单
        resetOutrankModalSubmitBtn(false);
        if (typeof initOutrankEditForm === 'function') {
            initOutrankEditForm(false);
        }
    }
    
    // Modal 关闭时清理表单
    $('#outrank_edit_modal').off('hidden.bs.modal').on('hidden.bs.modal', function() {
        // 清理表单验证
        const form = $('#outrank_edit_form');
        if (form.length && form.data('formValidationTip')) {
            form.data('formValidationTip').destroy();
        }
        // 清空表单内容
        clearOutrankForm();
        resetOutrankModalSubmitBtn();
    });
    
    modal.show();
}

// 清空表单
function clearOutrankForm() {
    $('#outrank_edit_form')[0].reset();
    // 清除隐藏字段
    $('input[name="outrank_id"]').remove();
    // 隐藏 UUID 字段组
    $('#outrank_uuid_group').hide();
    // 清除验证状态
    $('#outrank_edit_form .is-invalid, #outrank_edit_form .is-valid').removeClass('is-invalid is-valid');
    $('#outrank_edit_form .invalid-feedback').remove();
}

// 填充表单数据
function fillOutrankForm(data) {
    if (!data) return;
    
    // 填充基本字段
    if (data.outrank_id) {
        // 添加隐藏字段
        if ($('input[name="outrank_id"]').length === 0) {
            $('#outrank_edit_form').prepend(`<input type="hidden" name="outrank_id" value="${data.outrank_id}">`);
        } else {
            $('input[name="outrank_id"]').val(data.outrank_id);
        }
    }
    
    if (data.title !== undefined) $('#title').val(data.title || '');
    if (data.outrank_uuid !== undefined) {
        $('#outrank_uuid').val(data.outrank_uuid || '');
        // 显示 UUID 字段组
        $('#outrank_uuid_group').show();
    }
    if (data.token !== undefined) $('#token').val(data.token || '');
    if (data.ckind !== undefined) $('#ckind').val(data.ckind || '');
    if (data.description !== undefined) $('#description').val(data.description || '');
    
    // 填充时间字段（数据库返回的是 datetime 字符串格式，如 '2024-01-01 12:00:00'）
    if (data.start_time) {
        // 将 datetime 字符串转换为 datetime-local 格式 (YYYY-MM-DDTHH:mm)
        const startTimeStr = data.start_time.replace(' ', 'T').slice(0, 16);
        $('#start_time').val(startTimeStr);
    }
    if (data.end_time) {
        // 将 datetime 字符串转换为 datetime-local 格式 (YYYY-MM-DDTHH:mm)
        const endTimeStr = data.end_time.replace(' ', 'T').slice(0, 16);
        $('#end_time').val(endTimeStr);
    }
}

// 初始化
$(document).ready(function() {
    var $outrankMainTable = $('#outrank_list_table');
    $outrankMainTable.on('load-success.bs.table post-header.bs.table', function() {
        scheduleSyncOutrankListCols();
    });
    $(window).on('resize.outrankListCols', scheduleSyncOutrankListCols);
    setTimeout(scheduleSyncOutrankListCols, 0);

    // 初始化工具栏筛选
    initBootstrapTableClientToolbar({
        tableId: 'outrank_list_table',
        prefix: 'outrank',
        filterSelectors: [],
        searchInputId: 'outrank_search_input',
        searchFields: {
            title: 'title',
            outrank_id: 'outrank_id',
            outrank_uuid: 'outrank_uuid'
        }
    });

    $('#outrank_show_deleted').on('change', function() {
        $('#outrank_list_table').bootstrapTable('refresh');
    });

    $(document).on('click', '.outrank-restore-deleted', function() {
        var id = $(this).data('id');
        var btn = $(this);
        btn.prop('disabled', true);
        $.post('/outrank/index/outrank_restore_deleted_ajax', { outrank_id: id }, function(res) {
            if (res.code == 1 || res.status == 'success') {
                $('#outrank_list_table').bootstrapTable('refresh');
                alerty.success({
                    message: '已恢复为禁用，可在状态中启用',
                    message_en: 'Restored as disabled; use Status to enable'
                });
            } else {
                alerty.error({ message: res.msg || '恢复失败', message_en: res.msg || 'Restore failed' });
                btn.prop('disabled', false);
            }
        }, 'json').fail(function(xhr) {
            var errorMsg = '恢复失败';
            if (xhr.responseJSON && xhr.responseJSON.msg) {
                errorMsg = xhr.responseJSON.msg;
            }
            alerty.error({ message: errorMsg, message_en: errorMsg });
            btn.prop('disabled', false);
        });
    });

    $('#outrank_import_preview_table').on('post-body.bs.table', function() {
        if (window.autoTooltips) {
            window.autoTooltips.refresh();
        }
    });

    // 添加按钮事件
    $('#add_outrank_btn').on('click', function() {
        openOutrankEditModal(null);
    });

    $('#outrank_import_btn').on('click', function() {
        $('#outrank_import_file').trigger('click');
    });
    $('#outrank_import_file').on('change', function() {
        var input = this;
        var f = input.files && input.files[0];
        input.value = '';
        if (!f) {
            return;
        }
        OutrankRunImportFile(f).catch(function(err) {
            if (typeof hideOverlay === 'function') {
                hideOverlay();
            }
            var m = err && err.message ? err.message : String(err);
            alerty.error({ message: m, message_en: m });
        });
    });

    $('#outrank_import_preview_modal').on('hidden.bs.modal', function() {
        var $tbl = $('#outrank_import_preview_table');
        if ($tbl.length && $tbl.data('bootstrap.table')) {
            $tbl.bootstrapTable('destroy');
        }
    });

    $('#outrank_import_preview_confirm').on('click', function() {
        var $tbl = $('#outrank_import_preview_table');
        var selected = [];
        if ($tbl.length && typeof $tbl.bootstrapTable === 'function' && $tbl.data('bootstrap.table')) {
            var data = $tbl.bootstrapTable('getData') || [];
            var i;
            for (i = 0; i < data.length; i++) {
                if (data[i].state) {
                    selected.push({ filename: data[i].filename, pack: data[i].pack });
                }
            }
        }
        if (!selected.length) {
            alerty.error({
                message: '请至少勾选一项',
                message_en: 'Select at least one package'
            });
            return;
        }
        var mel = document.getElementById('outrank_import_preview_modal');
        if (mel && typeof bootstrap !== 'undefined' && bootstrap.Modal) {
            var mi = bootstrap.Modal.getInstance(mel);
            if (mi) {
                mi.hide();
            }
        }
        OutrankExecuteImportJobs(selected);
    });

    // 编辑按钮事件
    $(document).on('click', '.edit-outrank-btn', function() {
        const id = $(this).data('id');
        openOutrankEditModal(id);
    });

    const table = $('#outrank_list_table');

    function syncOutrankBatchToolbar() {
        var $btn = $('#outrank_batch_zip_btn');
        if (!$btn.length) {
            return;
        }
        var n = 0;
        try {
            n = (table.bootstrapTable('getSelections') || []).length;
        } catch (e2) {
            n = 0;
        }
        $btn.prop('disabled', n === 0);
        $('#outrank_batch_sel_count').text(n);
        $('#outrank_batch_sel_count_en').text(n);
    }

    $('#outrank_batch_zip_btn').on('click', function() {
        var rows = table.bootstrapTable('getSelections') || [];
        if (!rows.length) {
            return;
        }
        var ac = new AbortController();
        showOverlay({
            message: '正在批量导出 ZIP…',
            message_en: 'Exporting ZIP…',
            progressMode: 'determinate',
            progress: 0,
            detail: '',
            detail_en: '',
            cancelable: true,
            abortController: ac,
            cancelLabel: '取消',
            cancelLabel_en: 'Cancel'
        });
        OutrankRunBatchZip(rows, ac.signal)
            .then(function(zipBlob) {
                var ts = new Date();
                function pad(x) {
                    return x < 10 ? '0' + x : String(x);
                }
                var fname = 'outrank_packs_' + ts.getFullYear() + pad(ts.getMonth() + 1) + pad(ts.getDate()) + '_' + pad(ts.getHours()) + pad(ts.getMinutes()) + pad(ts.getSeconds()) + '.zip';
                var a = document.createElement('a');
                a.href = URL.createObjectURL(zipBlob);
                a.download = fname;
                document.body.appendChild(a);
                a.click();
                URL.revokeObjectURL(a.href);
                document.body.removeChild(a);
                alerty.success({
                    message: 'ZIP 已开始下载',
                    message_en: 'ZIP download started'
                });
            })
            .catch(function(err) {
                if (err && err.name === 'AbortError') {
                    alerty.error({
                        message: '已取消打包',
                        message_en: 'Cancelled'
                    });
                } else {
                    var m = err && err.message ? err.message : String(err);
                    alerty.error({
                        message: m,
                        message_en: m
                    });
                }
            })
            .finally(function() {
                hideOverlay();
            });
    });

    table.on('check.bs.table uncheck.bs.table check-all.bs.table uncheck-all.bs.table load-success.bs.table refresh.bs.table', function() {
        syncOutrankBatchToolbar();
    });
    syncOutrankBatchToolbar();

    async function copyOutrankTokenToClipboard(row) {
        const token = row && row.token;
        if (!token) {
            alerty.error({
                message: 'Token不存在',
                message_en: 'Token not found'
            });
            return;
        }
        if (typeof ClipboardWrite === 'function') {
            const success = await ClipboardWrite(token);
            if (success) {
                alerty.success({
                    message: 'Token已复制到剪贴板',
                    message_en: 'Token copied to clipboard'
                });
            } else {
                alerty.error({
                    message: '复制失败，请手动复制',
                    message_en: 'Copy failed, please copy manually'
                });
            }
            return;
        }
        const textArea = document.createElement('textarea');
        textArea.value = token;
        textArea.style.position = 'fixed';
        textArea.style.opacity = '0';
        document.body.appendChild(textArea);
        textArea.select();
        try {
            document.execCommand('copy');
            alerty.success({
                message: 'Token已复制到剪贴板',
                message_en: 'Token copied to clipboard'
            });
        } catch (err) {
            alerty.error({
                message: '复制失败，请手动复制',
                message_en: 'Copy failed, please copy manually'
            });
        }
        document.body.removeChild(textArea);
    }

    $(document).on('click', '.outrank-copy-token-btn', function(e) {
        e.preventDefault();
        e.stopPropagation();
        const id = $(this).data('outrank-id');
        const rows = table.bootstrapTable('getData');
        const row = rows.find(function(r) { return String(r.outrank_id) === String(id); });
        if (!row) {
            alerty.error({
                message: '未找到该行数据，请刷新后重试',
                message_en: 'Row not found. Please refresh and try again.'
            });
            return;
        }
        copyOutrankTokenToClipboard(row);
    });
    
    // 绑定单元格双击事件的函数
    function bindCellEvents() {
        // 防止重复绑定
        table.off('dbl-click-cell.bs.table');
        
        // 双击事件处理
        table.on('dbl-click-cell.bs.table', function(e, field, td, row) {
            if (field === 'token') {
                // 双击Token列：下载配置
                const token = row.token;
                const uuid = row.outrank_uuid;
                
                if (!token || !uuid) {
                    alerty.error({
                        message: '暂时无法导出，请刷新页面后重试',
                        message_en: 'Cannot export right now. Please refresh and try again.'
                    });
                    return;
                }
                
                // 获取当前页面的基础URL
                const baseUrl = window.location.origin;
                const apiUrl = `${baseUrl}/outrank/index/receive_data`;
                
                // 生成配置JSON
                const config = {
                    api_url: apiUrl,
                    outrank_uuid: uuid,
                    outrank_token: token,
                    push_method: 'post',
                    use_zip: true,
                    use_gzip: true, // 兼容旧版本
                    jsonp_chunk_size: 'auto', // JSONP分包大小
                    version: '1.0',
                    export_time: new Date().toISOString()
                };
                
                // 下载JSON文件
                const jsonStr = JSON.stringify(config, null, 2);
                const blob = new Blob([jsonStr], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `outrank_config_${uuid.substring(0, 8)}_${Date.now()}.json`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
                
                alerty.success({
                    message: '配置已下载',
                    message_en: 'Configuration downloaded'
                });
            } else if (field === 'outrank_id') {
                // 双击ID列：复制UUID
                const uuid = row.outrank_uuid;
                if (!uuid) {
                    alerty.error({
                        message: 'UUID不存在',
                        message_en: 'UUID not found'
                    });
                    return;
                }
                
                // 使用 global.js 中的 ClipboardWrite 函数
                if (typeof ClipboardWrite === 'function') {
                    ClipboardWrite(uuid).then(success => {
                        if (success) {
                            alerty.success({
                                message: 'UUID已复制到剪贴板',
                                message_en: 'UUID copied to clipboard'
                            });
                        } else {
                            alerty.error({
                                message: '复制失败，请手动复制',
                                message_en: 'Copy failed, please copy manually'
                            });
                        }
                    });
                } else {
                    // 备用方法
                    const textArea = document.createElement('textarea');
                    textArea.value = uuid;
                    textArea.style.position = 'fixed';
                    textArea.style.opacity = '0';
                    document.body.appendChild(textArea);
                    textArea.select();
                    try {
                        document.execCommand('copy');
                        alerty.success({
                            message: 'UUID已复制到剪贴板',
                            message_en: 'UUID copied to clipboard'
                        });
                    } catch (err) {
                        alerty.error({
                            message: '复制失败，请手动复制',
                            message_en: 'Copy failed, please copy manually'
                        });
                    }
                    document.body.removeChild(textArea);
                }
            }
        });
    }
    
    // 初始化时绑定事件
    bindCellEvents();
    
    // 表格刷新后重新绑定事件
    table.on('refresh.bs.table', function() {
        bindCellEvents();
    });
    
    // 表格加载完成后重新绑定事件
    table.on('load-success.bs.table', function() {
        bindCellEvents();
    });

    // 删除按钮事件
    $(document).on('click', '.delete-outrank', function() {
        let id = $(this).data('id');
        alerty.confirm({
            message: '确定要删除此外榜吗？',
            message_en: 'Are you sure you want to delete this outrank?',
            callback: function() {
                $.post('/outrank/index/outrank_delete_ajax', {outrank_id: id}, function(res) {
                    if (res.code == 1 || res.status == 'success') {
                        $('#outrank_list_table').bootstrapTable('refresh');
                        alerty.success({
                            message: '删除成功',
                            message_en: 'Deleted successfully'
                        });
                    } else {
                        alerty.error({
                            message: res.msg || '删除失败',
                            message_en: res.msg || 'Delete failed'
                        });
                    }
                }, 'json').fail(function(xhr) {
                    let errorMsg = '删除失败';
                    if (xhr.responseJSON && xhr.responseJSON.msg) {
                        errorMsg = xhr.responseJSON.msg;
                    }
                    alerty.error({
                        message: errorMsg,
                        message_en: errorMsg
                    });
                });
            }
        });
    });

    // 状态切换（defunct）- 使用专用接口
    $(document).on('click', '.change_status', function() {
        let id = $(this).attr('itemid');
        let btn = $(this);
        
        // 禁用按钮，防止重复点击
        btn.prop('disabled', true);
        
        $.post('/outrank/index/outrank_toggle_status_ajax', {
            outrank_id: id
        }, function(res) {
            if (res.code == 1 || res.status == 'success') {
                $('#outrank_list_table').bootstrapTable('refresh');
                alerty.success({
                    message: '状态已更新',
                    message_en: 'Status updated'
                });
            } else {
                alerty.error({
                    message: res.msg || '操作失败',
                    message_en: res.msg || 'Operation failed'
                });
                btn.prop('disabled', false);
            }
        }, 'json').fail(function(xhr) {
            let errorMsg = '操作失败';
            if (xhr.responseJSON && xhr.responseJSON.msg) {
                errorMsg = xhr.responseJSON.msg;
            }
            alerty.error({
                message: errorMsg,
                message_en: errorMsg
            });
            btn.prop('disabled', false);
        });
    });

    // 允许推送状态切换（flg_allow）- 使用专用接口
    $(document).on('click', '.change_allow_status', function() {
        let id = $(this).attr('itemid');
        let currentStatus = $(this).attr('status');
        let statusText = currentStatus == '1' ? '禁止推送' : '允许推送';
        let statusTextEn = currentStatus == '1' ? 'Disable Push' : 'Allow Push';
        let btn = $(this);
        
        if (!confirm(`确定要更改为${statusText}吗？(Are you sure to change to ${statusTextEn}?)`)) {
            return;
        }
        
        // 禁用按钮，防止重复点击
        btn.prop('disabled', true);
        
        $.post('/outrank/index/outrank_toggle_allow_ajax', {
            outrank_id: id
        }, function(res) {
            if (res.code == 1 || res.status == 'success') {
                $('#outrank_list_table').bootstrapTable('refresh');
                alerty.success({
                    message: '推送状态已更新',
                    message_en: 'Push status updated'
                });
            } else {
                alerty.error({
                    message: res.msg || '操作失败',
                    message_en: res.msg || 'Operation failed'
                });
                btn.prop('disabled', false);
            }
        }, 'json').fail(function(xhr) {
            let errorMsg = '操作失败';
            if (xhr.responseJSON && xhr.responseJSON.msg) {
                errorMsg = xhr.responseJSON.msg;
            }
            alerty.error({
                message: errorMsg,
                message_en: errorMsg
            });
            btn.prop('disabled', false);
        });
    });

    // F5刷新处理
    $(window).keydown(function(e) {
        if (e.keyCode == 116 && !e.ctrlKey) {
            if(window.event){
                try{e.keyCode = 0;}catch(e){}
                e.returnValue = false;
            }
            e.preventDefault();
            $('#outrank_list_table').bootstrapTable('refresh');
        }
    });
});
</script>

