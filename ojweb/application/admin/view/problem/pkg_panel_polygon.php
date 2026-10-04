{/* Polygon 题包转换面板：专用片段，供 admin/pkg_convert、ojtool/problem_pkg_tool 引用（非 csgoj/public 通用组件） */}
<div class="pkg-panel-polygon pkg-parser-panel">
{if isset($problem_judge_type_options_json)}
<script>
window.PROBLEM_JUDGE_TYPE_OPTIONS = {$problem_judge_type_options_json|raw};
</script>
{else/}
<script>
window.PROBLEM_JUDGE_TYPE_OPTIONS = [
    {"value":"0","label_cn":"标准评测","label_en":"Standard Judge"},
    {"value":"1","label_cn":"特判评测","label_en":"Test Program Judge"},
    {"value":"2","label_cn":"交互评测","label_en":"Interactive Judge"}
];
</script>
{/if}
<div id="polygon_toolbar" class="table-toolbar mb-2 pkg-convert-toolbar">
    <div class="d-flex flex-wrap align-items-center gap-1 gap-md-2" role="form">
        <button type="button" class="btn btn-sm btn-primary bilingual-inline" id="polygon_convert_btn">
            <i class="bi bi-file-earmark-zip"></i> <span class="cn-text">解析题包</span><span class="en-text">Parse</span>
        </button>
        <button type="button" class="btn btn-sm btn-success bilingual-inline" id="download_selected_btn" disabled title="请先解析题包 / Parse a package first">
            <i class="bi bi-box-arrow-down"></i> <span class="cn-text">打包</span><span class="en-text">Pack</span>
        </button>
        {if isset($problem_pkg_import_enable) && $problem_pkg_import_enable}
        <button type="button" class="btn btn-sm btn-warning bilingual-inline" id="polygon_import_oj_btn" disabled title="请先解析题包 / Parse a package first">
            <i class="bi bi-cloud-upload"></i> <span class="cn-text">导入</span><span class="en-text">Import</span>
        </button>
        {/if}
        <span class="pkg-convert-toolbar-sep text-muted small d-none d-md-inline align-self-center" aria-hidden="true">|</span>
        <div class="btn-group btn-group-sm polygon-batch-pdf-group" role="group" aria-label="题面批量 PDF 或正文 / Batch statement PDF or LaTeX">
            <button type="button" class="btn btn-outline-secondary polygon-btn-stack" id="polygon_batch_pdf_latex" disabled title="请先解析题包 / Parse a package first">
                <span class="polygon-btn-stack-cn">正文</span>
                <span class="polygon-btn-stack-en">LaTeX</span>
            </button>
            <button type="button" class="btn btn-outline-secondary polygon-btn-stack" id="polygon_batch_pdf_on" disabled title="请先解析题包 / Parse a package first">
                <span class="polygon-btn-stack-cn">PDF</span>
                <span class="polygon-btn-stack-en">PDF</span>
            </button>
        </div>
        <button type="button" class="btn btn-sm btn-info bilingual-inline" id="help_btn" data-bs-toggle="modal" data-bs-target="#helpModal">
            <i class="bi bi-question-circle"></i> <span class="cn-text">帮助</span><span class="en-text">Help</span>
        </button>
    </div>
</div>

<table
    class="bootstraptable_refresh_local"
    id="polygon_parse_table"
    data-toggle="table"
    data-pagination="true"
    data-toolbar="#polygon_toolbar"
    data-page-size="100"
    data-side-pagination="client"
    data-method="get"
    data-search="true"
    data-pagination-v-align="bottom"
    data-pagination-h-align="left"
    data-pagination-detail-h-align="right"
    data-search-align="right"
    data-checkbox-header="true">
    <thead>
        <tr>
            <th data-field="state" data-checkbox="true"></th>
            <th data-field="idx" data-align="left" data-valign="middle" data-width="55" data-formatter="FormatterProParserIdx">索引<span class="en-text">Idx</span></th>
            <th data-field="title" data-align="left" data-valign="middle" data-sortable="false" data-formatter="FormatterProParserTitle">标题<span class="en-text">Title</span></th>
            <th data-field="author" data-align="left" data-valign="middle" data-sortable="false" data-formatter="FormatterProParserAuthor">作者<span class="en-text">Author</span></th>
            <th data-field="polygon_pdf_mode" data-align="left" data-valign="middle" data-width="108" data-sortable="false" data-formatter="FormatterProParserPolygonPdf" title="有 PDF 时可切换 PDF/LaTeX；无 PDF 时显示 LaTeX 标记；无有效题面 JSON 时显示「无题面」。 With package PDF: choose PDF vs LaTeX. Without PDF: LaTeX tag. No valid statement: shows None.">题面<span class="en-text">Stmt</span></th>
            <th data-field="testdata" data-align="left" data-valign="middle" data-width="120" data-sortable="false" data-formatter="FormatterProParserTestData">数据<span class="en-text">Data</span></th>
            <th data-field="spj" data-align="left" data-valign="middle" data-width="118" data-sortable="false" data-formatter="FormatterProParserSpj" title="与题目编辑页评测类型（spj）一致，影响打包是否含 tpj.cc">评测类型<span class="en-text">Judge</span></th>
            <th data-field="hash" data-align="left" data-valign="middle" data-width="72" data-sortable="false" data-formatter="FormatterProParserHash">哈希<span class="en-text">Hash</span></th>
            <th data-field="pkg_langs" data-align="center" data-valign="middle" data-width="88" data-sortable="false" data-formatter="FormatterProParserPkgLangs" title="有效题面语言个数；悬停徽章可看目录名；点击数字调整顺序（首项=导入主题面）。 Count of statement locales; hover for names; click count to reorder (first = primary).">语言<span class="en-text">Langs</span></th>
        </tr>
    </thead>
</table>

<div class="modal fade" id="polygonTestdataModal" tabindex="-1" aria-labelledby="polygonTestdataModalLabel" aria-hidden="true">
    <div class="modal-dialog modal-dialog-centered polygon-testdata-modal-dialog">
        <div class="modal-content">
            <div class="modal-header py-2">
                <h5 class="modal-title fs-6 bilingual-inline" id="polygonTestdataModalLabel">测例文件列表<span class="en-text">Test data files</span></h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="关闭 Close"></button>
            </div>
            <div class="modal-body py-2">
                <p class="small text-muted mb-2" id="polygonTestdataModalHint">
                    列表按当前「评测类型」生成，与下载 ZIP 内容一致（.in/.out 及可选 tpj.cc）。
                    <span class="en-text">List matches the current judge type and the downloaded ZIP (.in/.out and optional tpj.cc).</span>
                </p>
                <div id="polygonTestdataModalLoading" class="text-center py-3 text-muted small">
                    <span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                    正在生成预览…<span class="en-text">Building preview…</span>
                </div>
                <div id="polygonTestdataModalError" class="alert alert-danger py-2 small d-none" role="alert"></div>
                <p id="polygonTestdataModalEmpty" class="small text-muted mb-0 py-2 d-none polygon-testdata-empty" role="status">无测例文件（当前评测类型下）。<span class="en-text">No test files for the current judge type.</span></p>
                <ul id="polygonTestdataModalList" class="list-group list-group-flush polygon-testdata-file-list d-none"></ul>
            </div>
            <div class="modal-footer py-2 flex-wrap gap-2">
                <button type="button" class="btn btn-sm btn-secondary bilingual-inline" data-bs-dismiss="modal">关闭<span class="en-text">Close</span></button>
                <button type="button" class="btn btn-sm btn-primary bilingual-button" id="polygonTestdataModalDownload" data-pid="">
                    <span class="cn-text">下载测试数据 ZIP</span><span class="en-text">Download testdata ZIP</span>
                </button>
            </div>
        </div>
    </div>
</div>

{if isset($problem_pkg_import_enable) && $problem_pkg_import_enable}
<div class="modal fade" id="polygonImportOjModal" tabindex="-1" aria-labelledby="polygonImportOjModalLabel" aria-hidden="true">
    <div class="modal-dialog modal-lg modal-dialog-centered">
        <div class="modal-content">
            <div class="modal-header">
                <h5 class="modal-title bilingual-inline" id="polygonImportOjModalLabel">导入到 OJ<span class="en-text">Import To OJ</span></h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="关闭 Close"></button>
            </div>
            <div class="modal-body">
                <p class="small text-muted mb-3">
                    将当前勾选的题目打成 CSGOJ 导入 ZIP，上传到「题目导入」目录；可选择仅上传或上传后立即提交后台导入任务（与题目导出页导入行为一致）。
                    <span class="en-text">Build a CSGOJ import ZIP from the selection, upload to the problem-import folder; upload only or submit a background import task (same as the export/import file manager).</span>
                </p>
                <p class="small text-warning mb-0">
                    重复导入可能产生重复题目；直接导入前请确认包内容。
                    <span class="en-text">Re-import may duplicate problems; confirm the package before direct import.</span>
                </p>
            </div>
            <div class="modal-footer flex-wrap gap-2">
                <button type="button" class="btn btn-secondary bilingual-button" data-bs-dismiss="modal">
                    <span class="cn-text">取消</span><span class="en-text">Cancel</span>
                </button>
                <button type="button" class="btn btn-primary bilingual-button" id="polygonImportOjBtnUploadOnly">
                    <span class="cn-text">仅上传到导入区</span><span class="en-text">Upload Only</span>
                </button>
                <button type="button" class="btn btn-success bilingual-button" id="polygonImportOjBtnDirect">
                    <span class="cn-text">上传并提交后台导入</span><span class="en-text">Upload &amp; Import</span>
                </button>
            </div>
        </div>
    </div>
</div>
{/if}

<div class="modal fade" id="helpModal" tabindex="-1" aria-labelledby="helpModalLabel" aria-hidden="true">
    <div class="modal-dialog modal-xl">
        <div class="modal-content">
            <div class="modal-header">
                <h5 class="modal-title bilingual-inline" id="helpModalLabel">帮助<span class="en-text">Help</span></h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="关闭 Close"></button>
            </div>
            <div class="modal-body">
                <p>
                    <a href="https://polygon.codeforces.com" target="_blank" rel="noopener">Polygon</a> 导出的 zip 中，每道题目需要有如下结构：
                    <span class="en-text">You need to prepare files with this structure for each problem:</span>
                </p>
                <div class="directory">
                    <ul>
                        <li class="file">problem.xml</li>
                        <li class="file">check.cpp</li>
                        <li class="folder">statements
                            <ul>
                                <li class="folder">[language]
                                    <ul>
                                        <li class="file">problem-properties.json</li>
                                        <li class="img">[picture_name].[picture_extend] <span class="text-muted">(like a.png)</span></li>
                                        <li class="img">[picture_name].[picture_extend] <span class="text-muted">...</span></li>
                                    </ul>
                                </li>
                                <li class="folder">.pdf / [language] <span class="text-muted">（可选，Polygon 导出的 PDF 题面）</span>
                                    <ul>
                                        <li class="file">problem.pdf</li>
                                    </ul>
                                </li>
                            </ul>
                        </li>
                        <li class="folder">tests
                            <ul>
                                <li class="file">[data_name] <span class="text-muted">(as input)</span></li>
                                <li class="file">[data_name].a <span class="text-muted">(as output)</span></li>
                            </ul>
                        </li>
                    </ul>
                </div>
                <ul>
                    <li>
                        题目解析后，可勾选并打包为 CSGOJ 支持的导入格式。
                        <span class="en-text">After parsing the problem, you can select and pack it into a format supported by CSGOJ.</span>
                    </li>
                    <li>
                        评测类型下拉框与题目编辑页的 spj（标准 / 特判 / 交互）一致，决定打包测例时是否包含 tpj.cc（来自 check.cpp 或 interactor）。
                        <span class="en-text">The judge-type select matches problem edit spj (standard / special / interactive) and controls whether tpj.cc (from check.cpp or interactor) is included when packing test data.</span>
                    </li>
                    <li>
                        若存在 <code>statements/.pdf/&lt;语言&gt;/problem.pdf</code>，「题面」列可选导入后优先使用 <strong>PDF</strong> 或 <strong>LaTeX 正文</strong>（PDF 打入导入包内 <code>TEST_* / pdf_desc</code>，与评测数据同目录；仅 <code>use_pdf</code> 开关不同）。勾选题目后可用工具栏「正文 / PDF」组批量切换。
                        <span class="en-text">If <code>statements/.pdf/.../problem.pdf</code> exists, the Statement column chooses PDF vs LaTeX; PDFs are packed under <code>TEST_* / pdf_desc</code>. Select rows and use the LaTeX/PDF batch group.</span>
                    </li>
                    <li>
                        插图转换基于 <code>\includegraphics</code> 匹配，不保证全部成功，文件名需为数字、字母、下划线、减号，后跟常见图像扩展名，<span class="text-danger">不支持 PDF 格式的插图</span>，导入后注意检查。
                        <span class="en-text">Image conversion is based on <code>\includegraphics</code> matching and is not guaranteed to be fully successful. The file name should consist of numbers, letters, underscores, hyphens, and common image extensions. <span class="text-danger">PDF format images are not supported</span>. Please check after import.</span>
                    </li>
                </ul>
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-secondary bilingual-inline" data-bs-dismiss="modal">关闭<span class="en-text">Close</span></button>
            </div>
        </div>
    </div>
</div>

<script>
    function polygonEscapeAttr(s) {
        return String(s)
            .replace(/&/g, '&amp;')
            .replace(/"/g, '&quot;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    }
    /** Polygon 独有列；其余 FormatterProParser* 见 static/js/problem_pkg/table_formatters.js */
    function FormatterProParserPolygonPdf(value, row, index, field) {
        if (row.pkg_no_statement) {
            const t = '包内无有效题面（无实质 problem-properties.json 等），与语言列 0 一致 / No valid statement JSON in package';
            return `<span class="polygon-stmt-badge polygon-stmt-badge--none" title="${polygonEscapeAttr(t)}">` +
                `<span class="polygon-stmt-badge-cn">无题面</span>` +
                `<span class="polygon-stmt-badge-en">None</span>` +
                `</span>`;
        }
        const poly = window.ProblemPkg && window.ProblemPkg.polygon;
        const hasPdf = poly && typeof poly.rowHasAnyPdf === 'function' && poly.rowHasAnyPdf(row);
        if (!hasPdf) {
            const t = '包内无 PDF 题面，导入后仅 LaTeX 正文 / No PDF in package; import uses LaTeX only';
            return `<span class="polygon-stmt-tag polygon-stmt-tag--latex" title="${polygonEscapeAttr(t)}">LaTeX</span>`;
        }
        const v = row.polygon_pdf_mode === 'pdf' ? 'pdf' : 'latex';
        const pid = row.idx || (index + 1);
        const title = '导入时优先 PDF 或 LaTeX 正文（仅包内有 PDF 的语言生效） / Prefer PDF or LaTeX (only locales with package PDF)';
        let html = `<select class="form-select form-select-sm polygon-pdf-mode-select py-0" data-pid="${pid}" title="${polygonEscapeAttr(title)}">`;
        html += `<option value="latex"${v === 'latex' ? ' selected' : ''}>LaTeX</option>`;
        html += `<option value="pdf"${v === 'pdf' ? ' selected' : ''}>PDF</option>`;
        html += '</select>';
        return html;
    }
    function openPolygonTestdataModal(pid) {
        const modalEl = document.getElementById('polygonTestdataModal');
        if (!modalEl || !window.bootstrap) return;
        modalEl.dataset.pid = String(pid);
        const downBtn = document.getElementById('polygonTestdataModalDownload');
        if (downBtn) downBtn.setAttribute('data-pid', String(pid));
        bootstrap.Modal.getOrCreateInstance(modalEl).show();
    }
    function polygonApplyToolbarTitles(ok, hasRows) {
        const needParse = '请先解析题包 / Parse a package first';
        const needCheck = '须先勾选表格中的题目后再使用 / Check one or more rows first';
        const tPack = '将勾选题目打成 CSGOJ 导入 ZIP 并下载 / Pack selected as CSGOJ import ZIP';
        const tImp = '上传勾选题目的导入 ZIP / Upload import ZIP for selected problems';
        const tLat = '勾选题目中，含 PDF 的题面改为 LaTeX / LaTeX for PDF locales in selection';
        const tPdf = '勾选题目中，含 PDF 的题面改为 PDF / PDF for PDF locales in selection';
        const dis = !hasRows ? needParse : needCheck;
        const setEl = function (id, text) {
            const el = document.getElementById(id);
            if (!el) return;
            if (typeof CsgSetTitleAndTooltip === 'function') {
                CsgSetTitleAndTooltip(el, text);
            } else {
                el.setAttribute('title', text);
            }
        };
        if (ok) {
            setEl('download_selected_btn', tPack);
            setEl('polygon_import_oj_btn', tImp);
            setEl('polygon_batch_pdf_latex', tLat);
            setEl('polygon_batch_pdf_on', tPdf);
        } else {
            const msg = dis;
            setEl('download_selected_btn', msg);
            setEl('polygon_import_oj_btn', msg);
            setEl('polygon_batch_pdf_latex', msg);
            setEl('polygon_batch_pdf_on', msg);
        }
    }
    /** 打包 / 导入 / 题面批量：仅在有解析结果且至少勾选一行时可用 */
    function polygonUpdateToolbarFromSelection() {
        const hasRows = typeof list_problem !== 'undefined' && Array.isArray(list_problem) && list_problem.length > 0;
        let n = 0;
        try {
            if (polygon_parse_table && polygon_parse_table.length) {
                n = polygon_parse_table.bootstrapTable('getSelections').length;
            }
        } catch (e) {
            n = 0;
        }
        const ok = hasRows && n > 0;
        $('#download_selected_btn').prop('disabled', !ok);
        const imp = $('#polygon_import_oj_btn');
        if (imp.length) {
            imp.prop('disabled', !ok);
        }
        $('#polygon_batch_pdf_latex').prop('disabled', !ok);
        $('#polygon_batch_pdf_on').prop('disabled', !ok);
        polygonApplyToolbarTitles(ok, hasRows);
    }
    function polygonApplyBatchPdfMode(mode) {
        const poly = window.ProblemPkg && window.ProblemPkg.polygon;
        if (!poly || typeof poly.applyPdfMode !== 'function' || typeof poly.rowHasAnyPdf !== 'function') {
            return;
        }
        if (typeof list_problem === 'undefined' || !polygon_parse_table) return;
        const sel = polygon_parse_table.bootstrapTable('getSelections');
        if (!sel.length) return;
        const selectedIdxSet = new Set(sel.map((r) => String(r.idx)));
        let changed = 0;
        for (let i = 0; i < list_problem.length; i++) {
            const p = list_problem[i];
            if (!selectedIdxSet.has(String(p.idx))) continue;
            if (!poly.rowHasAnyPdf(p)) continue;
            poly.applyPdfMode(p, mode);
            changed++;
        }
        if (changed === 0) {
            if (window.alerty && typeof window.alerty.info === 'function') {
                window.alerty.info(
                    '勾选行中没有可切换的题面（无包内 PDF），未修改。',
                    'No selected row has package PDF; nothing changed.'
                );
            }
            return;
        }
        const fresh = list_problem.map((r) => ({ ...r }));
        polygon_parse_table.bootstrapTable('load', fresh);
        const data = polygon_parse_table.bootstrapTable('getData');
        for (let di = 0; di < data.length; di++) {
            if (selectedIdxSet.has(String(data[di].idx))) {
                polygon_parse_table.bootstrapTable('check', di);
            }
        }
        polygonUpdateToolbarFromSelection();
    }
    let polygon_parse_table = null;
    $(document).ready(() => {
        polygon_parse_table = $("#polygon_parse_table");
        polygonUpdateToolbarFromSelection();
        $('#polygon_convert_btn').click(() => {
            let fileInput = $('<input type="file" accept=".zip">');
            fileInput.on('change', async function(event) {
                var file = event.target.files[0];
                if (file && file.name.toLowerCase().endsWith('.zip')) {
                    const tableData = await HandlePolygonZipFile(file);
                    const rows = Array.isArray(tableData) ? tableData : [];
                    polygon_parse_table.bootstrapTable("load", rows);
                    polygonUpdateToolbarFromSelection();
                } else if (file) {
                    alerty.error('仅支持 .zip 文件', 'Only .zip files are supported');
                }
            });
            fileInput.click();
        });
        $('#download_selected_btn').click(() => {
            DownloadSelectedProblems();
        });
        $('#polygon_batch_pdf_latex').on('click', () => polygonApplyBatchPdfMode('latex'));
        $('#polygon_batch_pdf_on').on('click', () => polygonApplyBatchPdfMode('pdf'));
        $(document).on('change', '#polygon_parse_table select.polygon-pdf-mode-select', function () {
            const pid = parseInt($(this).data('pid'), 10);
            const mode = String($(this).val()) === 'pdf' ? 'pdf' : 'latex';
            const poly = window.ProblemPkg && window.ProblemPkg.polygon;
            if (!poly || typeof poly.applyPdfMode !== 'function') return;
            if (typeof list_problem === 'undefined') return;
            const p = list_problem.find((x) => String(x.idx) === String(pid));
            if (p) {
                poly.applyPdfMode(p, mode);
            }
        });
        const testdataModalEl = document.getElementById('polygonTestdataModal');
        if (testdataModalEl) {
            testdataModalEl.addEventListener('shown.bs.modal', async function () {
                const pid = testdataModalEl.dataset.pid;
                const loadEl = document.getElementById('polygonTestdataModalLoading');
                const listEl = document.getElementById('polygonTestdataModalList');
                const errEl = document.getElementById('polygonTestdataModalError');
                const emptyEl = document.getElementById('polygonTestdataModalEmpty');
                if (!loadEl || !listEl || !errEl || !window.PolygonConvertUi) return;
                loadEl.classList.remove('d-none');
                listEl.classList.add('d-none');
                if (emptyEl) emptyEl.classList.add('d-none');
                errEl.classList.add('d-none');
                errEl.textContent = '';
                listEl.innerHTML = '';
                const r = await window.PolygonConvertUi.fetchTestdataPackedNamesForPid(pid);
                loadEl.classList.add('d-none');
                if (!r.ok) {
                    errEl.textContent =
                        r.err === 'not_found'
                            ? '未找到题目数据（请重新解析压缩包） / Problem not found (re-parse the zip)'
                            : r.err === 'no_testdata'
                              ? '测例元数据缺失 / Test metadata missing'
                              : r.err || '预览失败 / Preview failed';
                    errEl.classList.remove('d-none');
                    return;
                }
                const names = r.names || [];
                if (names.length === 0) {
                    if (emptyEl) emptyEl.classList.remove('d-none');
                    return;
                }
                const frag = document.createDocumentFragment();
                names.forEach((name) => {
                    const li = document.createElement('li');
                    li.className = 'list-group-item py-1 px-2 small font-monospace text-truncate polygon-testdata-file-item';
                    li.textContent = name;
                    li.setAttribute('title', name);
                    frag.appendChild(li);
                });
                listEl.appendChild(frag);
                listEl.classList.remove('d-none');
            });
        }
        $('#polygonTestdataModalDownload').on('click', function () {
            const pid = parseInt($(this).attr('data-pid'), 10);
            const modalEl = document.getElementById('polygonTestdataModal');
            if (modalEl && window.bootstrap) {
                const inst = bootstrap.Modal.getInstance(modalEl);
                if (inst) inst.hide();
            }
            if (pid) handleDownloadTestData(pid);
        });
        polygon_parse_table.on('click-cell.bs.table', function (e, field) {
            if (field === 'spj' || field === 'testdata' || field === 'hash' || field === 'polygon_pdf_mode') {
                e.stopPropagation();
            }
        });
        polygon_parse_table.on(
            'check.bs.table uncheck.bs.table check-all.bs.table uncheck-all.bs.table load-success.bs.table',
            function () {
                polygonUpdateToolbarFromSelection();
            }
        );
    });
</script>
</div>
