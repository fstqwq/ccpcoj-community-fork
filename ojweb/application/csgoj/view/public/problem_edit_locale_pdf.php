<style>
#problem_locale_pdf_card tr.problem-locale-row { cursor: pointer; }
/* 选中行：与后台 admin 区一致的浅色底 + 左侧主色条，避免粗网格+重阴影 */
#problem_locale_pdf_card tr.problem-locale-row-selected > td {
    box-shadow: none;
    background-color: color-mix(in srgb, var(--bs-primary) 7%, var(--bs-body-bg) 93%);
}
#problem_locale_pdf_card tr.problem-locale-row-selected > td:first-child {
    box-shadow: inset 3px 0 0 var(--bs-primary);
}
#problem_locale_table .locale-order-cell .d-inline-flex { gap: 0.2rem; }
#problem_locale_table .locale-drag-handle { cursor: grab; }
#problem_locale_table .locale-drag-handle:active { cursor: grabbing; }
#problem_locale_save_status.saved { color: var(--bs-success); }
#problem_locale_save_status.unsaved { color: var(--bs-danger); }
/* PDF 题面模式：按语言切换的文字题面块隐藏；样例在块外，全题唯一、不随语言切换 */
.problem-locale-text-fields-wrap.problem-locale-hidden-pdf {
    display: none !important;
}
#problem_locale_table .locale-row-edit-btn { min-width: 2.25rem; }
#problem_locale_table td.locale-pdf-action-cell { vertical-align: middle; white-space: nowrap; }
/* 语言表：与 basecss 中 course_info_table / 管理表单分隔线同系的浅横线，去掉 table-bordered 密网格 */
#problem_locale_pdf_card .problem-locale-table-wrap {
    border: 1px solid rgba(0, 0, 0, 0.08);
    border-radius: 0.4rem;
    overflow: hidden;
    background: var(--bs-body-bg, #fff);
}
#problem_locale_table {
    --problem-locale-table-line: #dee2e6;
    margin-bottom: 0;
}
#problem_locale_table thead th {
    font-weight: 600;
    color: var(--bs-secondary-color, #6c757d);
    border-bottom: 1px solid var(--problem-locale-table-line);
    background-color: var(--bs-light, #f8f9fa);
}
#problem_locale_table tbody td {
    border-bottom: 1px solid var(--problem-locale-table-line);
    border-left: none;
    border-right: none;
    vertical-align: middle;
}
#problem_locale_table tbody tr:last-child td {
    border-bottom: none;
}
#problem_locale_table tbody tr:hover:not(.problem-locale-row-selected) td {
    background-color: rgba(0, 0, 0, 0.02);
}
/* 题面编辑提示条：避免高饱和 primary 描边，与后台卡片边框一致 */
#problem_locale_md_editor_hint {
    border-color: rgba(0, 0, 0, 0.08) !important;
    background-color: rgba(248, 249, 250, 0.98) !important;
}
#problem_locale_table th.py-1,
#problem_locale_table td.py-1,
#problem_locale_table td.py-2 {
    padding-top: 0.28rem !important;
    padding-bottom: 0.28rem !important;
}
@supports not (background: color-mix(in srgb, red 50%, blue)) {
    #problem_locale_pdf_card tr.problem-locale-row-selected > td {
        background-color: rgba(13, 110, 253, 0.06);
    }
}
</style>
<div class="card border shadow-sm mb-3" id="problem_locale_pdf_card">
    <div class="card-header bg-light py-2 px-3 d-flex flex-wrap align-items-center justify-content-between gap-2">
        <div class="d-flex flex-wrap align-items-center gap-2">
            <span class="fw-semibold small">多语言题面与 PDF <span class="en-text text-muted">Locales &amp; PDF</span></span>
            <i id="problem_locale_dirty_icon" class="bi bi-exclamation-triangle-fill text-warning" style="display:none;" title="与数据库不一致 / Differs from database"></i>
            <span id="problem_locale_save_status" class="small fw-semibold saved" data-text-saved-cn="与数据库一致" data-text-saved-en="Matches DB" data-text-unsaved-cn="有修改未保存" data-text-unsaved-en="Unsaved vs DB"></span>
            <button type="button" class="btn btn-outline-secondary btn-sm py-0" id="problem_locale_reset_from_db_btn" style="display:none" title="丢弃本地草稿，恢复为打开页面时与数据库一致的内容 / Discard local draft and restore DB state from page load">
                <span class="cn-text">恢复为数据库一致</span><span class="en-text">Reset to DB</span>
            </button>
        </div>
    </div>
    <div class="card-body py-2 px-3">
        <p class="text-danger small fw-semibold mb-2 mb-0">
            <span class="cn-text">请随时使用 Ctrl+S 或页面底部按钮提交保存；题面 PDF 在提交成功后再上传，与数据库一次对齐。</span>
            <span class="en-text" style="font-size:0.9em;">Save with Ctrl+S or the submit button; statement PDFs upload after a successful save.</span>
        </p>
        <div class="small text-muted mb-2">
            <p class="mb-1">最多 <strong>10</strong> 行语言；<strong>排序第 1 行</strong>的题面写入题目主档（做题端默认语言仍按顺序与可见性解析）。拖拽左侧手柄排序。题面以<strong>草稿</strong>为准；<strong>样例全题唯一</strong>。各行的语言键可为 <code>main</code> 等，但<strong>不可重复</strong>。<strong>语言键</strong>仅英文字母、数字、下划线，1～64 字符。</p>
            <p class="mb-0 en-text" style="font-size:0.9em;">Up to <strong>10</strong> rows; the <strong>first row in order</strong> supplies the problem main statement row. Drag the handle to reorder. Locale keys must be unique (e.g. only one <code>main</code>).</p>
        </div>
        <datalist id="problem_locale_preset_labels">
            <option value="简体中文"></option>
            <option value="繁體中文"></option>
            <option value="English"></option>
            <option value="日本語"></option>
            <option value="한국어"></option>
        </datalist>
        <input type="hidden" name="problem_locales_pack_v" id="problem_locales_pack_v_field" value="3">
        <input type="hidden" name="problem_locales_json" id="problem_locales_json_field" value="">
        <input type="hidden" id="problem_locale_new_draft_id" value="{if isset($problem_locale_new_draft_id)}{$problem_locale_new_draft_id}{/if}">
        <textarea id="problem_locale_json_init" class="d-none" readonly>{$problem_locales_json_esc}</textarea>
        <textarea id="problem_pdf_exists_init" class="d-none" readonly>{$problem_pdf_exists_json_esc}</textarea>
        <div class="d-flex flex-wrap gap-1 align-items-center mb-2">
            <button type="button" class="btn btn-outline-primary btn-sm py-0" id="problem_locale_add_btn"><span class="cn-text">添加语言</span><span class="en-text">Add</span></button>
            <button type="button" class="btn btn-outline-secondary btn-sm py-0" id="problem_locale_pdf_all_on"><span class="cn-text">全用 PDF</span><span class="en-text">All PDF</span></button>
            <button type="button" class="btn btn-outline-secondary btn-sm py-0" id="problem_locale_pdf_all_off"><span class="cn-text">全用 MD</span><span class="en-text">All MD</span></button>
            <button type="button" class="btn btn-outline-warning btn-sm py-0" id="problem_pdf_delete_all_btn"><span class="cn-text">删全部 PDF</span><span class="en-text">Del all</span></button>
        </div>
        <div class="table-responsive problem-locale-table-wrap">
            <table class="table table-sm table-hover align-middle mb-0 small" id="problem_locale_table">
                <thead>
                    <tr>
                        <th class="py-1 text-center text-nowrap" style="width:4.75rem" title="拖拽排序；右侧按钮切换编辑题面 / Drag to reorder; button switches editor"><span class="cn-text">序</span><span class="en-text">#</span></th>
                        <th class="py-1" style="width:16%" title="1～64 字符，字母数字下划线；键不可重复 / 1–64 chars; keys must be unique">键<span class="en-text">Key</span></th>
                        <th class="py-1">显示名<span class="text-danger" title="必填">*</span><span class="en-text">Label</span></th>
                        <th class="py-1 text-center text-nowrap" style="width:1%" title="启用后做题端可见 / Visible when enabled">启用<span class="en-text">On</span></th>
                        <th class="py-1 text-center" style="width:1%">PDF</th>
                        <th class="py-1 text-center text-nowrap">预览<span class="en-text">View</span></th>
                        <th class="py-1 text-center text-nowrap">删PDF<span class="en-text">Del</span></th>
                        <th class="py-1 text-center text-nowrap">传pdf<span class="en-text">PDF</span></th>
                        <th class="py-1 text-center text-nowrap">删行<span class="en-text">Row</span></th>
                    </tr>
                </thead>
                <tbody id="problem_locale_tbody"></tbody>
            </table>
        </div>
    </div>
</div>
<script type="text/javascript">
(function() {
    var pid = '{$problem_id_for_locale_pdf|default=""}';
    var previewPid = '{$problem_locale_pdf_preview_pid|default=""}';
    if (!previewPid) {
        previewPid = pid;
    }
    var pageLocaleCopy = {if isset($problem_locale_page_copy_mode) && $problem_locale_page_copy_mode}true{else /}false{/if};
    var hadServerPidAtLoad = !!pid;
    var newDraftId = ($('#problem_locale_new_draft_id').val() || '').trim();
    var idbMod = '{$module|default="admin"}';
    var IDB_TABLE = 'problem_locale_draft';
    var uploadUrl = '{$problem_pdf_upload|default=""}';
    var deleteUrl = '{$problem_pdf_delete|default=""}';
    var previewBase = '{$problem_pdf_preview|default=""}';
    /** previewBase 可能已含 ?now_course_key=（exp），后续参数用 & 衔接 */
    function problemPdfUrlAppendQuery(base, queryStr) {
        if (!base || !queryStr) return base;
        return base + (base.indexOf('?') >= 0 ? '&' : '?') + queryStr;
    }
    var MD_FIELDS = ['description', 'input', 'output', 'hint', 'source', 'author'];
    /** 与后端 problem_locale_pdf_stem_valid / DB varchar(64) 一致 */
    var LOCALE_KEY_MAX_LEN = 64;
    var LOCALE_KEY_RE = /^[A-Za-z0-9_]+$/;

    function normalizeLocaleKeyString(raw) {
        return String(raw || '').replace(/[^A-Za-z0-9_]/g, '').slice(0, LOCALE_KEY_MAX_LEN);
    }

    /** 提交后再上传的 PDF（按行 sid 存，避免用户改语言键后串文件） */
    var pendingPdfFileBySid = {};
    var pendingPdfBlobUrlBySid = {};
    var pendingServerPdfDeleteStems = {};
    var pendingServerPdfDeleteAll = false;
    var serverPdfBaseline = {};

    /** 去掉红/绿框与错误 Tooltip，不强行标 is-valid（动态行 .locale-label 专用，对齐 form_validate_tip 视觉） */
    function neutralizeLocaleLabelField(el) {
        if (!el) {
            return;
        }
        el.classList.remove('is-invalid', 'is-valid');
        if (typeof window.FormValidationTip !== 'undefined' && typeof window.FormValidationTip.disposeBootstrapTooltipSafe === 'function') {
            window.FormValidationTip.disposeBootstrapTooltipSafe(el);
        }
    }

    function clearAllLocaleLabelValidationUi() {
        $('#problem_locale_tbody .locale-label').each(function() {
            neutralizeLocaleLabelField(this);
        });
    }

    var pdfExistsMap = {};
    try {
        pdfExistsMap = JSON.parse($('#problem_pdf_exists_init').text() || '{}');
    } catch (e0) {
        pdfExistsMap = {};
    }
    if (!pdfExistsMap || typeof pdfExistsMap !== 'object') {
        pdfExistsMap = {};
    }
    Object.keys(pdfExistsMap).forEach(function(k) {
        serverPdfBaseline[k] = !!pdfExistsMap[k];
    });

    var initial = [];
    try {
        initial = JSON.parse($('#problem_locale_json_init').text() || '[]');
    } catch (e) {
        initial = [];
    }
    if (!Array.isArray(initial)) initial = [];

    var rows = [];
    initial.forEach(function(r) {
        var row = Object.assign({}, r);
        var rawKey = String(row.locale_key != null ? row.locale_key : '').trim();
        /* db_locale_key 保持服务端原值，供 prev_locale_key；展示与编辑用规范化后的键 */
        row.db_locale_key = rawKey;
        row.locale_key = normalizeLocaleKeyString(rawKey);
        if (!row._sid) row._sid = 'k_' + (row.locale_key || rawKey || ('t' + String(Date.now()).slice(-8)));
        if (row.locale_visible === undefined || row.locale_visible === null) {
            row.locale_visible = 1;
        }
        rows.push(row);
    });
    if (rows.length === 0) {
        rows.push({
            _sid: 'p0',
            locale_key: 'main',
            db_locale_key: 'main',
            locale_label: '主语言',
            use_pdf: 0,
            locale_visible: 1,
            sort_order: 0
        });
    }

    var localeDrafts = {};
    var currentSid = rows[0]._sid;
    /** 打开页面时（或上次保存成功后）与数据库一致的快照串，用于「有修改」与提交灰显 */
    var serverBaselineJson = '';
    /** 与 serverBaselineJson 对应的完整可恢复快照（用于「恢复为数据库一致」） */
    var serverSnapshot = null;
    var initialBaselineJson = '';
    /** 样例区初始化完成并调用 Seal 之前，勿用 serverBaselineJson 参与 dirty/IDB 判断 */
    var baselineSealed = false;
    var dirtyTimer = null;
    var idbPersistTimer = null;

    function emptyDraft() {
        return { description: '', input: '', output: '', hint: '', source: '', author: '' };
    }

    rows.forEach(function(r) {
        localeDrafts[r._sid] = {
            description: r.description != null ? String(r.description) : '',
            input: r.input != null ? String(r.input) : '',
            output: r.output != null ? String(r.output) : '',
            hint: r.hint != null ? String(r.hint) : '',
            source: r.source != null ? String(r.source) : '',
            author: r.author != null ? String(r.author) : ''
        };
    });

    function syncCsgSwitch(el) {
        if (!el || !window.csgSwitch || typeof window.csgSwitch.syncSwitchState !== 'function') return;
        window.csgSwitch.syncSwitchState(el);
    }

    function getFirstRowSid() {
        return rows.length && rows[0]._sid ? rows[0]._sid : '';
    }

    function setAllLocalePdfChecked(on) {
        $('#problem_locale_tbody tr.problem-locale-row .problem-locale-pdf-cb').each(function() {
            this.checked = !!on;
            syncCsgSwitch(this);
        });
    }

    function initNewRowSwitches() {
        if (!window.csgSwitch || typeof window.csgSwitch.initSwitch !== 'function') return;
        document.querySelectorAll('#problem_locale_tbody .csg-switch-input:not([data-csg-initialized])').forEach(function(el) {
            window.csgSwitch.initSwitch(el);
        });
    }

    function getProblemEditForm() {
        return document.getElementById('problem_edit_form');
    }

    /** 可见编辑器 → localeDrafts[currentSid]（不依赖带 name 的 POST 字段） */
    function readDraftFromVisibleMdEditors() {
        var d = emptyDraft();
        var form = getProblemEditForm();
        if (!form) return d;
        MD_FIELDS.forEach(function(f) {
            var el = form.querySelector('.problem-locale-md-editor[data-locale-md="' + f + '"]');
            d[f] = el ? String(el.value || '') : '';
        });
        return d;
    }

    function writeDraftToVisibleMdEditors(d) {
        if (!d) d = emptyDraft();
        var form = getProblemEditForm();
        if (!form) return;
        MD_FIELDS.forEach(function(f) {
            var el = form.querySelector('.problem-locale-md-editor[data-locale-md="' + f + '"]');
            if (el) el.value = d[f] != null ? d[f] : '';
        });
    }

    /** 将当前可见区内容写入对应语言的草稿 */
    function pushCurrentViewToModel() {
        var d = readDraftFromVisibleMdEditors();
        if (currentSid) {
            localeDrafts[currentSid] = d;
        }
    }

    /** 首行草稿 → 隐藏域（供校验与 POST，与当前选中语言无关） */
    function syncMainDraftToPostMirrors() {
        var form = getProblemEditForm();
        if (!form) return;
        var fsid = getFirstRowSid();
        var d = (fsid && localeDrafts[fsid]) ? localeDrafts[fsid] : emptyDraft();
        MD_FIELDS.forEach(function(f) {
            var el = form.querySelector('#problem_locale_post_' + f);
            if (el) el.value = d[f] != null ? d[f] : '';
        });
    }

    function applyDraft(sid) {
        var d = localeDrafts[sid];
        writeDraftToVisibleMdEditors(d || emptyDraft());
    }

    function currentRowPdfOn() {
        var $tr = $('#problem_locale_tbody tr[data-sid="' + currentSid + '"]');
        if (!$tr.length) return false;
        var cb = $tr.find('.problem-locale-pdf-cb').get(0);
        return cb ? !!cb.checked : false;
    }

    function updateMdFieldsVisibility() {
        var els = document.querySelectorAll('.problem-locale-text-fields-wrap');
        if (!els.length) return;
        var pdfOn = currentRowPdfOn();
        els.forEach(function(el) {
            el.classList.toggle('problem-locale-hidden-pdf', pdfOn);
            if (pdfOn) {
                el.setAttribute('hidden', '');
                el.setAttribute('aria-hidden', 'true');
            } else {
                el.removeAttribute('hidden');
                el.removeAttribute('aria-hidden');
            }
        });
    }

    function updateRowSelectionUi() {
        $('#problem_locale_tbody tr').removeClass('problem-locale-row-selected');
        $('#problem_locale_tbody tr[data-sid="' + currentSid + '"]').addClass('problem-locale-row-selected');
    }

    function editorHintHtml() {
        var pdfOn = currentRowPdfOn();
        var pdfNote = '';
        if (pdfOn) {
            pdfNote = '<div class="mt-2 text-info small"><strong>PDF 题面</strong>：本题面以 PDF 为准，文字题面已隐藏；<strong>来源、出题</strong>请在下方填写；<strong>样例</strong>在下方，全题共用。<span class="en-text"><strong>PDF</strong>: text statement is hidden. Fill in <strong>source</strong> and <strong>author</strong> below. <strong>Samples</strong> below apply to the whole problem.</span></div>';
        }
        var $tr = $('#problem_locale_tbody tr[data-sid="' + currentSid + '"]');
        var k = ($tr.find('.locale-key').val() || '').trim();
        var lbl = ($tr.find('.locale-label').val() || '').trim();
        var show = lbl || k || currentSid;
        var pos = $tr.index() === 0
            ? '<span class="badge bg-primary-subtle text-primary border border-primary-subtle ms-1" style="font-size:0.7rem">首行</span>'
            : '';
        return '<div class="mb-0"><strong>编辑</strong>：' + $('<span/>').text(show).html() + ' <span class="text-muted">(' + $('<span/>').text(k || '—').html() + ')</span>' + pos + '<span class="en-text"><strong>Editing</strong>: ' + $('<span/>').text(show).html() + '</span></div>' + pdfNote;
    }

    function refreshEditorHint() {
        var $b = $('#problem_locale_md_editor_hint');
        if ($b.length) $b.html(editorHintHtml());
    }

    function switchLocale(sid) {
        if (!sid || sid === currentSid) {
            updateRowSelectionUi();
            refreshEditorHint();
            updateMdFieldsVisibility();
            return;
        }
        pushCurrentViewToModel();
        currentSid = sid;
        applyDraft(sid);
        updateRowSelectionUi();
        refreshEditorHint();
        updateMdFieldsVisibility();
        scheduleDirtyCheck();
    }

    function rowStem($tr) {
        return ($tr.find('.locale-key').val() || '').trim();
    }

    /** 首行：已选未提交的待传 PDF 或磁盘/映射上视为已有 PDF */
    function mainHasStatementPdf() {
        var $tr = $('#problem_locale_tbody tr.problem-locale-row').first();
        if (!$tr.length) return false;
        return localeRowHasStatementPdf($tr);
    }

    /**
     * 附加语言行：待传 PDF 按行 sid 绑定；pdfExistsMap 按语言键。二者任一满足即视为已有题面 PDF。
     */
    function localeRowHasStatementPdf($tr) {
        if (!$tr || !$tr.length) return false;
        var sid = $tr.attr('data-sid') || '';
        if (sid && pendingPdfFileBySid[sid]) return true;
        var stem = rowStem($tr);
        return !!(stem && pdfExistsMap[stem]);
    }

    /**
     * 用户修改语言键后，把 pdfExistsMap 上的 true 从旧键挪到新键，避免「伪上传后改键/未失焦」导致保存误报。
     */
    function syncPdfExistsMapStemForRow($tr) {
        if (!$tr || !$tr.length) return;
        var sid = $tr.attr('data-sid') || '';
        var nowTrim = rowStem($tr);
        var prevRaw = $tr.data('pdfStemTracked');
        var prev = (prevRaw === undefined || prevRaw === null) ? '' : String(prevRaw).trim();
        if (prev === nowTrim) return;
        var hadPending = !!(sid && pendingPdfFileBySid[sid]);
        var hadMapOld = !!(prev && pdfExistsMap[prev]);
        if (hadPending || hadMapOld) {
            if (prev && prev !== nowTrim) {
                pdfExistsMap[prev] = false;
            }
            if (nowTrim) {
                pdfExistsMap[nowTrim] = true;
            }
        }
        $tr.data('pdfStemTracked', nowTrim);
    }

    /** 与表头「序」单列对齐：手柄 + 编辑，避免多出一列导致整表错位 */
    function makeOrderCellTd(sid) {
        var $inner = $('<div class="d-inline-flex align-items-center justify-content-center flex-nowrap"/>');
        $inner.append(
            $('<span class="locale-drag-handle d-inline-flex align-items-center justify-content-center" draggable="true" role="button" tabindex="0"/>')
                .attr('title', '拖拽调整语言顺序（首行=默认题面主档）/ Drag to reorder (first row = primary)')
                .html('<i class="bi bi-grip-vertical" aria-hidden="true"></i>')
        );
        $inner.append(
            $('<button type="button" class="btn btn-sm btn-outline-primary locale-row-edit-btn py-0 px-1"/>')
                .attr('data-sid', sid)
                .attr('title', '切换到此语言编辑题面 / Switch to edit this language')
                .html('<i class="bi bi-pencil" aria-hidden="true"></i>')
        );
        return $('<td class="text-center py-2 locale-pdf-action-cell locale-order-cell"/>').append($inner);
    }

    function revokeSidBlobUrl(sid) {
        if (pendingPdfBlobUrlBySid[sid]) {
            try {
                URL.revokeObjectURL(pendingPdfBlobUrlBySid[sid]);
            } catch (eRev) { /* ignore */ }
            delete pendingPdfBlobUrlBySid[sid];
        }
    }

    function clearPendingPdfForSid(sid) {
        delete pendingPdfFileBySid[sid];
        revokeSidBlobUrl(sid);
    }

    function makePreviewTd($tr) {
        var stem = rowStem($tr);
        var sid = $tr.attr('data-sid') || '';
        var td = $('<td class="text-center py-2 locale-pdf-action-cell locale-pdf-preview-cell"/>');
        var blobU = sid && pendingPdfBlobUrlBySid[sid];
        if (blobU) {
            td.append(
                $('<a class="btn btn-sm btn-outline-info locale-pdf-preview py-1 px-2" target="_blank" rel="noopener"/>')
                    .attr('href', blobU)
                    .attr('title', '预览待上传 PDF / Preview pending PDF')
                    .html('<i class="bi bi-eye" aria-hidden="true"></i>')
            );
            return td;
        }
        var has = !!(stem && pdfExistsMap[stem]);
        if (has && previewPid && previewBase) {
            var url = problemPdfUrlAppendQuery(previewBase, 'problem_id=' + encodeURIComponent(previewPid) + '&lang=' + encodeURIComponent(stem));
            td.append(
                $('<a class="btn btn-sm btn-outline-info locale-pdf-preview py-1 px-2" target="_blank" rel="noopener"/>')
                    .attr('href', url)
                    .attr('title', '新标签页预览 PDF / Preview PDF in new tab')
                    .html('<i class="bi bi-eye" aria-hidden="true"></i>')
            );
        } else {
            td.append($('<span class="text-muted user-select-none" title="尚无 PDF / No PDF">—</span>'));
        }
        return td;
    }

    function makeDelPdfTd($tr) {
        var stem = rowStem($tr);
        var sid = $tr.attr('data-sid') || '';
        var td = $('<td class="text-center py-2 locale-pdf-action-cell locale-pdf-delete-cell"/>');
        /* pdfExistsMap 按语言键；待传文件按 sid。改键后可能不同步，故二者任一成立即视为「有 PDF 可删」 */
        var hasPending = !!(sid && pendingPdfFileBySid[sid]);
        var has = hasPending || !!(stem && pdfExistsMap[stem]);
        if (has) {
            td.append(
                $('<button type="button" class="btn btn-sm btn-outline-danger locale-pdf-delete py-1 px-2"/>')
                    .attr('title', '移除题面 PDF（保存后同步服务器）/ Remove PDF (applied when you save)')
                    .html('<i class="bi bi-trash" aria-hidden="true"></i>')
            );
        } else {
            td.append($('<span class="text-muted user-select-none">—</span>'));
        }
        return td;
    }

    function makeUploadTd(isFirstRow) {
        var td = $('<td class="text-center py-2 locale-pdf-action-cell"/>');
        var $lab = $('<label class="btn btn-sm btn-outline-secondary py-1 px-2 mb-0 locale-pdf-upload-label"/>')
            .attr('title', '传pdf / Upload PDF')
            .html('<i class="bi bi-upload" aria-hidden="true"></i>');
        var $inp = $('<input type="file" accept="application/pdf,.pdf" class="d-none locale-pdf-file"/>');
        if (isFirstRow) $inp.attr('id', 'problem_pdf_upload_main');
        $lab.append($inp);
        td.append($lab);
        return td;
    }

    function refreshPdfActionCells($tr) {
        if (!$tr || !$tr.length) return;
        $tr.find('td.locale-pdf-preview-cell').replaceWith(makePreviewTd($tr));
        $tr.find('td.locale-pdf-delete-cell').replaceWith(makeDelPdfTd($tr));
    }

    function buildLocaleRow(r, rowIndex, totalRows) {
        var stem = (r.locale_key || '').trim();
        var tr = $('<tr class="problem-locale-row"/>');
        var persistedDbKey = (Object.prototype.hasOwnProperty.call(r, 'db_locale_key') && String(r.db_locale_key || '').trim() !== '')
            ? String(r.db_locale_key).trim() : '';
        tr.data('dbKey', persistedDbKey);
        tr.attr('data-sid', r._sid);
        tr.attr('data-row-index', String(rowIndex));
        tr.append(makeOrderCellTd(r._sid));
        var keyTitle = '语言键：A–Z a–z 0–9 与下划线，1～' + LOCALE_KEY_MAX_LEN + '；不可重复 / Locale key; unique';
        var $lk = $('<input type="text" class="form-control form-control-sm py-0 locale-key" maxlength="' + LOCALE_KEY_MAX_LEN + '" autocomplete="off"/>')
            .attr('title', keyTitle)
            .val(normalizeLocaleKeyString(r.locale_key || ''));
        tr.append($('<td class="py-1"/>').append($lk));
        tr.append($('<td class="py-1"/>').append($('<input type="text" class="form-control form-control-sm py-0 locale-label" list="problem_locale_preset_labels" autocomplete="off"/>').attr('title', '填写语言键时显示名必填 / Label required when key set').val(r.locale_label || '')));
        var visWrap = $('<div class="csg-switch"/>');
        var visInp = $('<input type="checkbox" class="csg-switch-input problem-locale-visible-cb"/>');
        visInp.attr({
            'data-csg-size': 'sm',
            'data-csg-theme': 'success',
            'data-csg-text-on': '开',
            'data-csg-text-on-en': 'On',
            'data-csg-text-off': '关',
            'data-csg-text-off-en': 'Off',
            'data-csg-title-on': '已启用，做题端可见 / Enabled, visible to contestants',
            'data-csg-title-off': '未启用，做题端隐藏 / Disabled, hidden from contestants'
        });
        if (r.locale_visible === undefined || r.locale_visible === null || parseInt(r.locale_visible, 10) !== 0) {
            visInp.prop('checked', true);
        }
        visWrap.append(visInp);
        tr.append($('<td class="text-center py-1"/>').append(visWrap));
        var wrap = $('<div class="csg-switch"/>');
        var inp = $('<input type="checkbox" class="csg-switch-input problem-locale-pdf-cb"/>');
        inp.attr({
            'data-csg-size': 'sm',
            'data-csg-theme': 'info',
            'data-csg-text-on': 'PDF',
            'data-csg-text-on-en': 'PDF',
            'data-csg-text-off': 'MD',
            'data-csg-text-off-en': 'MD',
            'data-csg-title-on': '该语言题面使用 PDF / PDF statement',
            'data-csg-title-off': '该语言题面使用文字 / Text statement'
        });
        if (r.use_pdf) inp.prop('checked', true);
        wrap.append(inp);
        tr.append($('<td class="text-center py-1"/>').append(wrap));
        tr.append(makePreviewTd(tr));
        tr.append(makeDelPdfTd(tr));
        tr.append(makeUploadTd(rowIndex === 0));
        if (totalRows <= 1) {
            tr.append($('<td class="text-center py-2 text-muted locale-pdf-action-cell" title="至少保留一行 / Keep at least one row">—</td>'));
        } else {
            tr.append($('<td class="text-center py-2 locale-pdf-action-cell"/>').append(
                $('<button type="button" class="btn btn-sm btn-outline-danger locale-del py-1 px-2"/>')
                    .attr('title', '删除此语言行 / Remove this locale row')
                    .html('<i class="bi bi-x-lg" aria-hidden="true"></i>')
            ));
        }
        tr.data('pdfStemTracked', stem);
        return tr;
    }

    function reorderRowsBySid(fromSid, toSid) {
        var fi = -1;
        var ti = -1;
        for (var i = 0; i < rows.length; i++) {
            if (rows[i]._sid === fromSid) fi = i;
            if (rows[i]._sid === toSid) ti = i;
        }
        if (fi < 0 || ti < 0 || fi === ti) return;
        var item = rows.splice(fi, 1)[0];
        rows.splice(ti, 0, item);
        render();
        if (currentSid) {
            applyDraft(currentSid);
        }
        updateRowSelectionUi();
        refreshEditorHint();
        updateMdFieldsVisibility();
        scheduleDirtyCheck();
    }

    function render() {
        var tb = $('#problem_locale_tbody');
        var n = rows.length;
        tb.empty();
        for (var i = 0; i < n; i++) {
            tb.append(buildLocaleRow(rows[i], i, n));
        }
        initNewRowSwitches();
        updateRowSelectionUi();
        updateMdFieldsVisibility();
    }

    function rowToObj($tr) {
        var sid = $tr.attr('data-sid');
        var key = $tr.find('.locale-key').val().trim();
        var dbKey = $tr.data('dbKey') || '';
        var label = $tr.find('.locale-label').val().trim();
        var d = localeDrafts[sid] || emptyDraft();
        var visCb = $tr.find('.problem-locale-visible-cb');
        var vis = visCb.length ? (visCb.is(':checked') ? 1 : 0) : 1;
        var o = {
            locale_key: key,
            locale_label: label,
            use_pdf: $tr.find('.problem-locale-pdf-cb').is(':checked') ? 1 : 0,
            locale_visible: vis,
            description: d.description,
            input: d.input,
            output: d.output,
            hint: d.hint,
            source: d.source,
            author: d.author
        };
        if (dbKey && key !== dbKey) o.prev_locale_key = dbKey;
        return o;
    }

    function collectOrderedLocalesForSubmit() {
        var out = [];
        var order = 0;
        $('#problem_locale_tbody tr.problem-locale-row').each(function() {
            var $tr = $(this);
            var o = rowToObj($tr);
            if (!o.locale_key) return;
            o.sort_order = order++;
            out.push(o);
        });
        return out;
    }

    /** 客户端「题目描述」必填；PDF 模式下若为空则填占位符，不覆盖已有内容 */
    function padRequiredMarkdownForPdfDraft(d) {
        var out = Object.assign({}, d || emptyDraft());
        if (!String(out.description || '').trim()) {
            out.description = '-';
        }
        return out;
    }

    function stableStringify(obj) {
        if (obj === null || typeof obj !== 'object') return JSON.stringify(obj);
        if (Array.isArray(obj)) return '[' + obj.map(stableStringify).join(',') + ']';
        var keys = Object.keys(obj).sort();
        return '{' + keys.map(function(k) { return JSON.stringify(k) + ':' + stableStringify(obj[k]); }).join(',') + '}';
    }

    function getCaptureObject() {
        pushCurrentViewToModel();
        if (typeof UpdateRealSample === 'function' && window.__problemEditSamplesReady) UpdateRealSample();
        var $fr = $('#problem_locale_tbody tr.problem-locale-row').first();
        var frSid = $fr.length ? ($fr.attr('data-sid') || '') : '';
        var visFr = $fr.find('.problem-locale-visible-cb');
        var firstRow = {
            sid: frSid,
            key: ($fr.find('.locale-key').val() || '').trim(),
            label: ($fr.find('.locale-label').val() || '').trim(),
            use_pdf: $fr.find('.problem-locale-pdf-cb').is(':checked') ? 1 : 0,
            locale_visible: visFr.length ? (visFr.is(':checked') ? 1 : 0) : 1,
            draft: localeDrafts[frSid] || emptyDraft()
        };
        var extras = [];
        $('#problem_locale_tbody tr.problem-locale-row').each(function(ix) {
            if (ix === 0) return;
            var $tr = $(this);
            var sid = $tr.attr('data-sid');
            var visCb = $tr.find('.problem-locale-visible-cb');
            extras.push({
                sid: sid,
                key: ($tr.find('.locale-key').val() || '').trim(),
                label: ($tr.find('.locale-label').val() || '').trim(),
                use_pdf: $tr.find('.problem-locale-pdf-cb').is(':checked') ? 1 : 0,
                locale_visible: visCb.length ? (visCb.is(':checked') ? 1 : 0) : 1,
                draft: localeDrafts[sid] || emptyDraft()
            });
        });
        var frs = getFirstRowSid();
        return {
            spj: $('#spj_value').val(),
            title: ($('input[name="title"]').val() || ''),
            time_limit: ($('input[name="time_limit"]').val() || ''),
            memory_limit: ($('input[name="memory_limit"]').val() || ''),
            firstRow: firstRow,
            mainDraft: localeDrafts[frs] || emptyDraft(),
            extras: extras,
            sample_in: ($('#sample_input_hidden').val() || ''),
            sample_out: ($('#sample_output_hidden').val() || '')
        };
    }

    function captureFullFormState() {
        return stableStringify(getCaptureObject());
    }

    function buildPersistPayload() {
        pushCurrentViewToModel();
        if (typeof UpdateRealSample === 'function' && window.__problemEditSamplesReady) UpdateRealSample();
        return {
            rows: JSON.parse(JSON.stringify(rows)),
            initial: JSON.parse(JSON.stringify(initial)),
            localeDrafts: JSON.parse(JSON.stringify(localeDrafts)),
            currentSid: currentSid,
            pdfExistsMap: JSON.parse(JSON.stringify(pdfExistsMap)),
            form: {
                spj: $('#spj_value').val(),
                title: ($('input[name="title"]').val() || ''),
                time_limit: ($('input[name="time_limit"]').val() || ''),
                memory_limit: ($('input[name="memory_limit"]').val() || '')
            },
            samples: {
                in: ($('#sample_input_hidden').val() || ''),
                out: ($('#sample_output_hidden').val() || '')
            }
        };
    }

    function applyPersistPayload(p) {
        if (!p || typeof p !== 'object') return;
        Object.keys(pendingPdfBlobUrlBySid).forEach(function(sid) {
            revokeSidBlobUrl(sid);
        });
        pendingPdfFileBySid = {};
        pendingServerPdfDeleteStems = {};
        pendingServerPdfDeleteAll = false;
        rows = p.rows || [];
        initial = p.initial || [];
        localeDrafts = p.localeDrafts && typeof p.localeDrafts === 'object' ? p.localeDrafts : {};
        currentSid = p.currentSid || '';
        if (!currentSid && rows.length && rows[0]._sid) {
            currentSid = rows[0]._sid;
        }
        if (!localeDrafts[currentSid]) localeDrafts[currentSid] = emptyDraft();
        pdfExistsMap = p.pdfExistsMap && typeof p.pdfExistsMap === 'object' ? p.pdfExistsMap : {};
        var fm = p.form || {};
        $('#spj_value').val(fm.spj != null ? fm.spj : '0');
        $('input[name="title"]').val(fm.title != null ? fm.title : '');
        $('input[name="time_limit"]').val(fm.time_limit != null ? fm.time_limit : '');
        $('input[name="memory_limit"]').val(fm.memory_limit != null ? fm.memory_limit : '');
        var sm = p.samples || {};
        $('#sample_input_hidden').val(sm.in != null ? sm.in : '');
        $('#sample_output_hidden').val(sm.out != null ? sm.out : '');
        if (typeof ProblemSampleHtml === 'function' && $('#fake_sample_div').length) {
            var hl = typeof hlevel !== 'undefined' ? hlevel : 5;
            $('#fake_sample_div').html(ProblemSampleHtml(sm.in || '', sm.out || '', hl, true));
        }
        $('.judge-type-btn').removeClass('active').attr('aria-pressed', 'false');
        $('.judge-type-btn[data-spj="' + String(fm.spj != null ? fm.spj : '0') + '"]').addClass('active').attr('aria-pressed', 'true');
        render();
        applyDraft(currentSid);
        syncMainDraftToPostMirrors();
        initNewRowSwitches();
        var _cbApply = $('#problem_locale_tbody tr.problem-locale-row').first().find('.problem-locale-pdf-cb').get(0);
        if (_cbApply) syncCsgSwitch(_cbApply);
        $('#problem_locale_tbody tr.problem-locale-row').each(function() {
            refreshPdfActionCells($(this));
        });
        refreshEditorHint();
        updateMdFieldsVisibility();
    }

    function idbDraftKey() {
        if (pid) {
            return { pid: String(pid), mod: String(idbMod) };
        }
        if (newDraftId) {
            return { draft: String(newDraftId), mod: String(idbMod), newp: 1 };
        }
        return { mod: String(idbMod), newp: 1, tmp: '1' };
    }

    function scheduleIdbPersist() {
        if (!pid && !newDraftId) return;
        if (idbPersistTimer) clearTimeout(idbPersistTimer);
        idbPersistTimer = setTimeout(function() {
            idbPersistTimer = null;
            idbWriteDraft();
        }, 500);
    }

    function idbWriteDraft() {
        if (!pid && !newDraftId) return;
        var cap = captureFullFormState();
        if (cap === serverBaselineJson) {
            window.idb.DelIdbTableByKey(IDB_TABLE, idbDraftKey());
            return;
        }
        window.idb.SetIdbTableByKey(IDB_TABLE, idbDraftKey(), {
            v: 3,
            baselineWhenSaved: serverBaselineJson,
            captureJson: cap,
            payload: buildPersistPayload()
        });
    }

    function idbClearDraft() {
        if (!pid && !newDraftId) return;
        window.idb.DelIdbTableByKey(IDB_TABLE, idbDraftKey());
    }

    function updateDirtyUi() {
        var $st = $('#problem_locale_save_status');
        var $ic = $('#problem_locale_dirty_icon');
        var $resetBtn = $('#problem_locale_reset_from_db_btn');
        if (!baselineSealed) {
            if ($resetBtn.length) {
                $resetBtn.hide();
            }
            if (pid) {
                $('#submit_button').prop('disabled', true);
                return;
            }
        }
        var dirty = captureFullFormState() !== serverBaselineJson;
        if (!$st.length) return;
        if (dirty) {
            $st.removeClass('saved').addClass('unsaved');
            $st.html('<span class="cn-text">' + $st.data('text-unsaved-cn') + '</span> <span class="en-text">(' + $st.data('text-unsaved-en') + ')</span>');
            $ic.show();
            if ($resetBtn.length) {
                $resetBtn.show();
            }
        } else {
            $st.removeClass('unsaved').addClass('saved');
            $st.html('<span class="cn-text">' + $st.data('text-saved-cn') + '</span> <span class="en-text">(' + $st.data('text-saved-en') + ')</span>');
            $ic.hide();
            if ($resetBtn.length) {
                $resetBtn.hide();
            }
        }
        if (pid) {
            $('#submit_button').prop('disabled', !dirty);
        }
        if (dirty && (pid || newDraftId)) scheduleIdbPersist();
    }

    function scheduleDirtyCheck() {
        if (dirtyTimer) clearTimeout(dirtyTimer);
        dirtyTimer = setTimeout(updateDirtyUi, 200);
    }

    /** 保存成功后把各行的 db_locale_key 与 DOM 对齐，避免下次改名误判为「新插入」 */
    window.ProblemLocaleSyncPersistedKeysAfterSave = function() {
        $('#problem_locale_tbody tr.problem-locale-row').each(function() {
            var $tr = $(this);
            var sid = $tr.attr('data-sid');
            var k = ($tr.find('.locale-key').val() || '').trim();
            for (var i = 0; i < rows.length; i++) {
                if (rows[i]._sid === sid) {
                    rows[i].locale_key = k;
                    rows[i].db_locale_key = k;
                    $tr.data('dbKey', k);
                    break;
                }
            }
        });
    };

    function firstRowPdfCheckboxChecked() {
        var el = $('#problem_locale_tbody tr.problem-locale-row').first().find('.problem-locale-pdf-cb').get(0);
        return !!(el && el.checked);
    }

    /**
     * 与后端 problem_locale_sync_from_post / 首行校验一致。
     */
    window.ProblemLocaleValidateForSubmit = function() {
        if (typeof window.FormValidationTip === 'undefined') {
            return { ok: true };
        }
        clearAllLocaleLabelValidationUi();
        var $all = $('#problem_locale_tbody tr.problem-locale-row');
        if (!$all.length || !($all.first().find('.locale-key').val() || '').trim()) {
            alerty.error({
                message: '请填写首行语言键（可为 main）',
                message_en: 'Please set the first row locale key (may be main)'
            });
            return { ok: false };
        }
        var badKeyInput = null;
        $all.each(function() {
            var $tr = $(this);
            var key = ($tr.find('.locale-key').val() || '').trim();
            if (!key) {
                return;
            }
            if (!LOCALE_KEY_RE.test(key) || key.length > LOCALE_KEY_MAX_LEN) {
                badKeyInput = $tr.find('.locale-key')[0];
                return false;
            }
        });
        if (badKeyInput) {
            var kmsg = window.FormValidationTip.createBilingualMessage(
                '语言键须为 1～' + LOCALE_KEY_MAX_LEN + ' 位英文字母、数字或下划线',
                'Keys: letters, digits, underscore; length 1–' + LOCALE_KEY_MAX_LEN
            );
            window.FormValidationTip.showFieldError(badKeyInput, kmsg);
            badKeyInput.focus({ preventScroll: true });
            try {
                badKeyInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
            } catch (eK) { /* ignore */ }
            return { ok: false };
        }
        var seenK = {};
        var dupEl = null;
        $all.each(function() {
            var key = (($(this).find('.locale-key').val() || '').trim()).toLowerCase();
            if (!key) return;
            if (seenK[key]) {
                dupEl = $(this).find('.locale-key')[0];
                return false;
            }
            seenK[key] = true;
        });
        if (dupEl) {
            var dm = window.FormValidationTip.createBilingualMessage('语言键不能重复', 'Duplicate locale keys are not allowed');
            window.FormValidationTip.showFieldError(dupEl, dm);
            dupEl.focus({ preventScroll: true });
            return { ok: false };
        }
        var badInput = null;
        $all.each(function() {
            var $tr = $(this);
            var key = ($tr.find('.locale-key').val() || '').trim();
            if (!key) {
                return;
            }
            var $inp = $tr.find('.locale-label');
            if (!($inp.val() || '').trim()) {
                badInput = $inp[0];
                return false;
            }
        });
        if (badInput) {
            var msg = window.FormValidationTip.createBilingualMessage(
                '各语言行的显示名不能为空',
                'Display name is required for each locale row'
            );
            window.FormValidationTip.showFieldError(badInput, msg);
            badInput.focus({ preventScroll: true });
            try {
                badInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
            } catch (eScroll) { /* ignore */ }
            return { ok: false };
        }
        $all.each(function() {
            syncPdfExistsMapStemForRow($(this));
        });
        if (firstRowPdfCheckboxChecked() && !mainHasStatementPdf()) {
            alerty.error({
                message: '首行已开启 PDF 题面，请选取或保留对应文件名的 PDF（首行为 main 时为 main.pdf）',
                message_en: 'First row uses PDF; upload or keep the matching PDF (main.pdf if key is main)'
            });
            return { ok: false };
        }
        var badKey = null;
        $all.each(function() {
            var $tr = $(this);
            var key = ($tr.find('.locale-key').val() || '').trim();
            if (!key) {
                return;
            }
            if ($tr.find('.problem-locale-pdf-cb').is(':checked') && !localeRowHasStatementPdf($tr)) {
                badKey = key;
                return false;
            }
        });
        if (badKey) {
            alerty.error({
                message: '语言「' + badKey + '」已开启 PDF，请选取或保留对应 PDF 文件',
                message_en: 'Locale "' + badKey + '" uses PDF; please choose or keep its PDF file'
            });
            return { ok: false };
        }
        return { ok: true };
    };

    /**
     * 在 FormValidationTip 整表校验前调用：把可见编辑器写入草稿，首行 PDF 模式下为空的 Markdown 填占位，
     * 再同步到带 name 的隐藏域，避免「描述必填」误报及 Tooltip 锚在 .visually-hidden 上错位。
     */
    window.ProblemLocalePrepareForFormValidation = function() {
        pushCurrentViewToModel();
        var fsid = getFirstRowSid();
        if (firstRowPdfCheckboxChecked() && fsid) {
            localeDrafts[fsid] = padRequiredMarkdownForPdfDraft(Object.assign({}, localeDrafts[fsid] || emptyDraft()));
        }
        syncMainDraftToPostMirrors();
    };

    window.ProblemLocalePdfBeforeSubmit = function() {
        pushCurrentViewToModel();
        var fsid = getFirstRowSid();
        var mainPdf = firstRowPdfCheckboxChecked();
        if (mainPdf && fsid) {
            localeDrafts[fsid] = padRequiredMarkdownForPdfDraft(Object.assign({}, localeDrafts[fsid] || emptyDraft()));
        }
        syncMainDraftToPostMirrors();
        $('#problem_locales_pack_v_field').val('3');
        var list = collectOrderedLocalesForSubmit();
        list.forEach(function(o) {
            if (o.use_pdf && !String(o.description || '').trim()) {
                o.description = '-';
            }
        });
        $('#problem_locales_json_field').val(JSON.stringify(list));
    };

    /** 样例区就绪后锁定「与数据库一致」基线，再尝试从 IDB 恢复未提交草稿 */
    window.ProblemLocaleSealServerBaseline = function() {
        pushCurrentViewToModel();
        syncMainDraftToPostMirrors();
        serverBaselineJson = captureFullFormState();
        serverSnapshot = JSON.parse(JSON.stringify(buildPersistPayload()));
        initialBaselineJson = serverBaselineJson;
        baselineSealed = true;
        updateDirtyUi();
    };

    window.ProblemLocaleBootstrapFromIdb = function() {
        function finish() {
            updateDirtyUi();
            var _cbIdb = $('#problem_locale_tbody tr.problem-locale-row').first().find('.problem-locale-pdf-cb').get(0);
            if (_cbIdb) syncCsgSwitch(_cbIdb);
            updateMdFieldsVisibility();
            requestAnimationFrame(function() {
                updateMdFieldsVisibility();
            });
        }
        if (!pid && !newDraftId) {
            finish();
            return;
        }
        window.idb.GetIdbTableByKey(IDB_TABLE, idbDraftKey()).then(function(row) {
            if (row && row.v === 3 && row.baselineWhenSaved === serverBaselineJson && row.captureJson !== serverBaselineJson && row.payload) {
                applyPersistPayload(row.payload);
            }
        }).finally(function() {
            finish();
        });
    };

    /** 提交成功后：新基线 + 清 IDB */
    window.ProblemLocaleResetDirtyBaseline = function() {
        pushCurrentViewToModel();
        syncMainDraftToPostMirrors();
        serverBaselineJson = captureFullFormState();
        serverSnapshot = JSON.parse(JSON.stringify(buildPersistPayload()));
        initialBaselineJson = serverBaselineJson;
        idbClearDraft();
        updateDirtyUi();
    };

    $('#problem_locale_reset_from_db_btn').on('click', function() {
        if (captureFullFormState() === serverBaselineJson) {
            alerty.info({ message: '当前已与数据库一致', message_en: 'Already matches database' });
            return;
        }
        alerty.confirm({
            message: '确定丢弃本地修改，恢复为打开页面时与数据库一致的内容？未提交到服务器的修改将丢失。',
            message_en: 'Discard local changes and restore state from when this page was loaded?',
            callback: function() {
                if (serverSnapshot) {
                    applyPersistPayload(JSON.parse(JSON.stringify(serverSnapshot)));
                }
                idbClearDraft();
                updateDirtyUi();
            }
        });
    });

    $('#problem_locale_add_btn').on('click', function() {
        if (rows.length >= 10) {
            alerty.error({ message: '语言行最多 10 个（含首行）', message_en: 'At most 10 locale rows' });
            return;
        }
        var k = 'lang_' + Date.now();
        var sid = 'n_' + Date.now();
        rows.push({ _sid: sid, locale_key: k, locale_label: '', use_pdf: 0, locale_visible: 1 });
        localeDrafts[sid] = emptyDraft();
        render();
        switchLocale(sid);
    });

    $('#problem_locale_pdf_all_on, #problem_locale_pdf_all_off').on('click', function() {
        var on = $(this).attr('id').indexOf('all_on') >= 0;
        setAllLocalePdfChecked(on);
        refreshEditorHint();
        updateMdFieldsVisibility();
        scheduleDirtyCheck();
    });

    $(document).on('click', '.locale-del', function(e) {
        e.stopPropagation();
        if (rows.length <= 1) {
            alerty.error({ message: '至少保留一行语言', message_en: 'Keep at least one locale row' });
            return;
        }
        var tr = $(this).closest('tr');
        var sid = tr.attr('data-sid');
        var dk = tr.data('dbKey') || tr.find('.locale-key').val().trim();
        rows = rows.filter(function(r) { return r._sid !== sid; });
        initial = initial.filter(function(r) { return r.locale_key !== dk; });
        delete localeDrafts[sid];
        if (sid) clearPendingPdfForSid(sid);
        var needSwitch = (currentSid === sid);
        render();
        if (needSwitch && rows.length) {
            currentSid = rows[0]._sid;
            applyDraft(currentSid);
        }
        updateRowSelectionUi();
        refreshEditorHint();
        updateMdFieldsVisibility();
        scheduleDirtyCheck();
    });

    $(document).on('click', '.locale-row-edit-btn', function(e) {
        e.stopPropagation();
        var sid = $(this).attr('data-sid');
        if (sid) switchLocale(sid);
    });

    $(document).on('click', '#problem_locale_tbody tr.problem-locale-row', function(e) {
        if ($(e.target).closest('.locale-drag-handle,input,button,label,.csg-switch,.csg-switch-track,textarea,a').length) return;
        var sid = $(this).attr('data-sid');
        if (sid) switchLocale(sid);
    });

    $(document).on('blur', '.locale-key', function() {
        var $tr = $(this).closest('tr');
        syncPdfExistsMapStemForRow($tr);
        refreshPdfActionCells($tr);
    });

    $(document).on('input', '#problem_locale_tbody .locale-key', function() {
        var el = this;
        var n = normalizeLocaleKeyString(el.value);
        if (n !== el.value) {
            el.value = n;
        }
        var $tr = $(el).closest('tr');
        syncPdfExistsMapStemForRow($tr);
        refreshPdfActionCells($tr);
        refreshEditorHint();
        scheduleDirtyCheck();
    });

    $(document).on('click', '.locale-pdf-delete', function(e) {
        e.stopPropagation();
        var $tr = $(this).closest('tr');
        var key = rowStem($tr);
        if (!key || !localeRowHasStatementPdf($tr)) return;
        alerty.confirm({
            message: '确定移除该语言的题面 PDF？保存题目后将同步到服务器。',
            message_en: 'Remove this PDF? It will be applied after you save the problem.',
            callback: function() {
                var rowSid = $tr.attr('data-sid') || '';
                if (rowSid && pendingPdfFileBySid[rowSid]) {
                    clearPendingPdfForSid(rowSid);
                } else if ((hadServerPidAtLoad || pageLocaleCopy) && serverPdfBaseline[key]) {
                    pendingServerPdfDeleteStems[key] = true;
                }
                pdfExistsMap[key] = false;
                pendingServerPdfDeleteAll = false;
                var cb = $tr.find('.problem-locale-pdf-cb')[0];
                if (cb) {
                    cb.checked = false;
                    syncCsgSwitch(cb);
                }
                refreshPdfActionCells($tr);
                refreshEditorHint();
                updateMdFieldsVisibility();
                scheduleDirtyCheck();
            }
        });
    });

    $(document).on('change', '.locale-key, .locale-label, .problem-locale-pdf-cb, .problem-locale-visible-cb', function() {
        if ($(this).hasClass('locale-key')) {
            syncPdfExistsMapStemForRow($(this).closest('tr'));
            refreshPdfActionCells($(this).closest('tr'));
        }
        refreshEditorHint();
        updateMdFieldsVisibility();
        scheduleDirtyCheck();
    });

    $('#problem_pdf_delete_all_btn').on('click', function() {
        alerty.confirm({
            message: '确定移除全部题面 PDF？保存题目后将同步到服务器。',
            message_en: 'Remove all statement PDFs? Applied after you save the problem.',
            callback: function() {
                Object.keys(pendingPdfFileBySid).forEach(function(sid) {
                    clearPendingPdfForSid(sid);
                });
                pendingServerPdfDeleteStems = {};
                if ((hadServerPidAtLoad && pid) || pageLocaleCopy) {
                    pendingServerPdfDeleteAll = true;
                } else {
                    pendingServerPdfDeleteAll = false;
                }
                setAllLocalePdfChecked(false);
                Object.keys(pdfExistsMap).forEach(function(k) {
                    pdfExistsMap[k] = false;
                });
                $('#problem_locale_tbody tr.problem-locale-row').each(function() {
                    refreshPdfActionCells($(this));
                });
                refreshEditorHint();
                updateMdFieldsVisibility();
                scheduleDirtyCheck();
            }
        });
    });

    $(document).on('change', '.locale-pdf-file', function() {
        var input = this;
        var f = input.files && input.files[0];
        input.value = '';
        if (!f) return;
        var tr = $(input).closest('tr');
        var rowSid = tr.attr('data-sid') || '';
        var key = rowStem(tr);
        if (!key) {
            alerty.error({ message: '请先填写语言键', message_en: 'Please enter the language key first' });
            return;
        }
        if (!rowSid) {
            return;
        }
        var reader = new FileReader();
        reader.onload = function() {
            var buf = new Uint8Array(reader.result);
            var sig = String.fromCharCode(buf[0], buf[1], buf[2], buf[3], buf[4]);
            if (sig !== '%PDF-') {
                alerty.error({ message: '请选择有效的 PDF 文件', message_en: 'Please choose a valid PDF file' });
                return;
            }
            clearPendingPdfForSid(rowSid);
            pendingPdfFileBySid[rowSid] = f;
            var u = URL.createObjectURL(f);
            pendingPdfBlobUrlBySid[rowSid] = u;
            pdfExistsMap[key] = true;
            tr.data('pdfStemTracked', key);
            delete pendingServerPdfDeleteStems[key];
            pendingServerPdfDeleteAll = false;
            var cb = tr.find('.problem-locale-pdf-cb')[0];
            if (cb) {
                cb.checked = true;
                syncCsgSwitch(cb);
            }
            refreshPdfActionCells(tr);
            refreshEditorHint();
            updateMdFieldsVisibility();
            scheduleDirtyCheck();
        };
        reader.readAsArrayBuffer(f.slice(0, 5));
    });

    /**
     * 题目主表保存成功后：删除队列 + 上传待传 PDF（顺序执行）
     */
    window.runProblemLocalePostSaveTasks = function(serverPid) {
        serverPid = String(serverPid || '').trim();
        if (!serverPid || !uploadUrl || !deleteUrl) {
            return $.Deferred().resolve().promise();
        }
        var prom = $.Deferred().resolve().promise();
        if (pendingServerPdfDeleteAll) {
            prom = prom.then(function() {
                return $.post(deleteUrl, { problem_id: serverPid, all: 1 }, null, 'json');
            }).then(function(res) {
                if (!res || res.code != 1) {
                    throw new Error(res && res.msg ? res.msg : 'delete all PDF failed');
                }
                pendingServerPdfDeleteAll = false;
                pendingServerPdfDeleteStems = {};
            });
        } else {
            Object.keys(pendingServerPdfDeleteStems).forEach(function(stem) {
                if (!pendingServerPdfDeleteStems[stem]) return;
                prom = prom.then(function() {
                    return $.post(deleteUrl, { problem_id: serverPid, locale_key: stem, all: 0 }, null, 'json');
                }).then(function(res) {
                    if (!res || res.code != 1) {
                        throw new Error(res && res.msg ? res.msg : ('delete PDF ' + stem));
                    }
                    delete pendingServerPdfDeleteStems[stem];
                });
            });
        }
        Object.keys(pendingPdfFileBySid).forEach(function(rowSid) {
            var file = pendingPdfFileBySid[rowSid];
            if (!file) return;
            prom = prom.then(function() {
                var $row = $('#problem_locale_tbody tr').filter(function() {
                    return String($(this).attr('data-sid') || '') === String(rowSid);
                }).first();
                var stem = $row.length ? rowStem($row) : '';
                if (!stem) {
                    throw new Error('pending PDF row missing');
                }
                var fd = new FormData();
                fd.append('pdf_file', file, stem + '.pdf');
                fd.append('problem_id', serverPid);
                fd.append('locale_key', stem);
                return $.ajax({
                    url: uploadUrl,
                    type: 'POST',
                    data: fd,
                    processData: false,
                    contentType: false,
                    dataType: 'json'
                }).then(function(res) {
                    if (!res || res.code != 1) {
                        throw new Error(res && res.msg ? res.msg : ('upload PDF ' + stem));
                    }
                    delete pendingPdfFileBySid[rowSid];
                    revokeSidBlobUrl(rowSid);
                    pdfExistsMap[stem] = true;
                });
            });
        });
        return prom.then(function() {
            $('#problem_locale_tbody tr.problem-locale-row').each(function() {
                refreshPdfActionCells($(this));
            });
            Object.keys(pdfExistsMap).forEach(function(k) {
                serverPdfBaseline[k] = !!pdfExistsMap[k];
            });
        });
    };

    render();

    if (window.CsgSortableList && typeof window.CsgSortableList.attachDelegatedTableRowReorder === 'function') {
        window.CsgSortableList.attachDelegatedTableRowReorder({
            tbodySelector: '#problem_locale_tbody',
            rowSelector: 'tr.problem-locale-row',
            handleSelector: '#problem_locale_table .locale-drag-handle',
            onReorder: function(fromTr, toTr) {
                var fromSid = $(fromTr).attr('data-sid') || '';
                var toSid = $(toTr).attr('data-sid') || '';
                if (fromSid && toSid) {
                    reorderRowsBySid(fromSid, toSid);
                }
            }
        });
    } else {
        var dragReorderSidFallback = null;
        $(document).on('dragstart.localePdfFallback', '.locale-drag-handle', function(ev) {
            var e = ev.originalEvent;
            dragReorderSidFallback = $(this).closest('tr').attr('data-sid') || '';
            if (e && e.dataTransfer) {
                e.dataTransfer.effectAllowed = 'move';
                try {
                    e.dataTransfer.setData('text/plain', dragReorderSidFallback);
                } catch (e1) { /* ignore */ }
            }
        });
        $(document).on('dragend.localePdfFallback', '.locale-drag-handle', function() {
            dragReorderSidFallback = null;
        });
        $(document).on('dragover.localePdfFallback', '#problem_locale_tbody tr.problem-locale-row', function(ev) {
            ev.preventDefault();
        });
        $(document).on('drop.localePdfFallback', '#problem_locale_tbody tr.problem-locale-row', function(ev) {
            ev.preventDefault();
            var toSid = $(this).attr('data-sid') || '';
            if (dragReorderSidFallback && toSid && dragReorderSidFallback !== toSid) {
                reorderRowsBySid(dragReorderSidFallback, toSid);
            }
            dragReorderSidFallback = null;
        });
    }

    $(function() {
        var peForm = document.getElementById('problem_edit_form');
        if (peForm) {
            peForm.addEventListener('submit', function() {
                pushCurrentViewToModel();
                syncMainDraftToPostMirrors();
            }, true);
        }
        var fs = getFirstRowSid();
        if (fs) {
            var fromEditors = readDraftFromVisibleMdEditors();
            localeDrafts[fs] = Object.assign(localeDrafts[fs] || emptyDraft(), fromEditors);
            currentSid = fs;
            applyDraft(fs);
        }
        syncMainDraftToPostMirrors();
        refreshEditorHint();

        if (pid) {
            $('#submit_button').prop('disabled', true);
        }

        $('#problem_edit_form').on('input change', 'input,textarea,select', function() {
            scheduleDirtyCheck();
        });
        $('#problem_edit_form').on('blur', '.problem-locale-md-editor', function() {
            pushCurrentViewToModel();
            syncMainDraftToPostMirrors();
        });
        $(document).on('click', '.judge-type-btn', function() {
            scheduleDirtyCheck();
        });

        $(document).on('input', '#problem_locale_tbody .locale-label', function() {
            if (typeof window.FormValidationTip === 'undefined') {
                return;
            }
            var el = this;
            if (String($(el).val() || '').trim()) {
                window.FormValidationTip.clearFieldError(el);
            } else {
                neutralizeLocaleLabelField(el);
            }
        });

        var cbInit = $('#problem_locale_tbody tr.problem-locale-row').first().find('.problem-locale-pdf-cb').get(0);
        if (cbInit) syncCsgSwitch(cbInit);
        updateMdFieldsVisibility();
        requestAnimationFrame(function() {
            updateMdFieldsVisibility();
        });
    });
})();
</script>
