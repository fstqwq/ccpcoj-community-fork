{/* 酒井算协 / THU 风格题包面板；与 Polygon 面板交互一致，供 admin/pkg_convert、ojtool 引用 */}
<div class="pkg-panel-thusaa pkg-parser-panel">
{if isset($problem_judge_type_options_json)}
<script>
if (typeof window.PROBLEM_JUDGE_TYPE_OPTIONS === 'undefined' || !window.PROBLEM_JUDGE_TYPE_OPTIONS) {
window.PROBLEM_JUDGE_TYPE_OPTIONS = {$problem_judge_type_options_json|raw};
}
</script>
{else/}
<script>
if (typeof window.PROBLEM_JUDGE_TYPE_OPTIONS === 'undefined' || !window.PROBLEM_JUDGE_TYPE_OPTIONS) {
window.PROBLEM_JUDGE_TYPE_OPTIONS = [
    {"value":"0","label_cn":"标准评测","label_en":"Standard Judge"},
    {"value":"1","label_cn":"特判评测","label_en":"Test Program Judge"},
    {"value":"2","label_cn":"交互评测","label_en":"Interactive Judge"}
];
}
</script>
{/if}
<div id="thusaa_toolbar" class="table-toolbar mb-2 pkg-convert-toolbar">
    <div class="d-flex flex-wrap align-items-center gap-1 gap-md-2" role="form">
        <button type="button" class="btn btn-sm btn-primary bilingual-inline" id="thusaa_convert_btn">
            <i class="bi bi-file-earmark-zip"></i> <span class="cn-text">解析题包</span><span class="en-text">Parse</span>
        </button>
        <button type="button" class="btn btn-sm btn-success bilingual-inline" id="thusaa_download_selected_btn" disabled title="请先解析题包 / Parse a package first">
            <i class="bi bi-box-arrow-down"></i> <span class="cn-text">打包</span><span class="en-text">Pack</span>
        </button>
        {if isset($problem_pkg_import_enable) && $problem_pkg_import_enable}
        <button type="button" class="btn btn-sm btn-warning bilingual-inline" id="thusaa_import_oj_btn" disabled title="请先解析题包 / Parse a package first">
            <i class="bi bi-cloud-upload"></i> <span class="cn-text">导入</span><span class="en-text">Import</span>
        </button>
        {/if}
        <button type="button" class="btn btn-sm btn-info bilingual-inline" id="thusaa_help_btn" data-bs-toggle="modal" data-bs-target="#thusaaHelpModal">
            <i class="bi bi-question-circle"></i> <span class="cn-text">帮助</span><span class="en-text">Help</span>
        </button>
    </div>
</div>

<table
    class="bootstraptable_refresh_local"
    id="thusaa_parse_table"
    data-toggle="table"
    data-pagination="true"
    data-toolbar="#thusaa_toolbar"
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
            <th data-field="idx" data-align="left" data-valign="middle" data-width="55" data-sortable="false" data-formatter="FormatterProParserIdx">索引<span class="en-text">Idx</span></th>
            <th data-field="title" data-align="left" data-valign="middle" data-sortable="false" data-formatter="FormatterProParserTitle">标题<span class="en-text">Title</span></th>
            <th data-field="testdata" data-align="left" data-valign="middle" data-width="120" data-sortable="false" data-formatter="FormatterProParserTestData">数据<span class="en-text">Data</span></th>
            <th data-field="spj" data-align="left" data-valign="middle" data-width="118" data-sortable="false" data-formatter="FormatterProParserSpj" title="与题目编辑页评测类型（spj）一致，影响打包是否含 tpj.cc">评测类型<span class="en-text">Judge</span></th>
            <th data-field="hash" data-align="left" data-valign="middle" data-width="72" data-sortable="false" data-formatter="FormatterProParserHash">哈希<span class="en-text">Hash</span></th>
            <th data-field="pkg_langs" data-align="center" data-valign="middle" data-width="88" data-sortable="false" data-formatter="FormatterProParserPkgLangs" title="有效题面语言个数；悬停徽章可看目录名；点击数字调整顺序（首项=导入主题面）。 Count of statement locales; hover for names; click count to reorder (first = primary).">语言<span class="en-text">Langs</span></th>
        </tr>
    </thead>
</table>

<div class="modal fade" id="thusaaTestdataModal" tabindex="-1" aria-labelledby="thusaaTestdataModalLabel" aria-hidden="true">
    <div class="modal-dialog modal-dialog-centered polygon-testdata-modal-dialog">
        <div class="modal-content">
            <div class="modal-header py-2">
                <h5 class="modal-title fs-6 bilingual-inline" id="thusaaTestdataModalLabel">测例文件列表<span class="en-text">Test data files</span></h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="关闭 Close"></button>
            </div>
            <div class="modal-body py-2">
                <p class="small text-muted mb-2" id="thusaaTestdataModalHint">
                    列表按当前「评测类型」生成，与下载 ZIP 内容一致（.in/.out 及可选 tpj.cc）。
                    <span class="en-text">List matches the current judge type and the downloaded ZIP (.in/.out and optional tpj.cc).</span>
                </p>
                <div id="thusaaTestdataModalLoading" class="text-center py-3 text-muted small">
                    <span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                    正在生成预览…<span class="en-text">Building preview…</span>
                </div>
                <div id="thusaaTestdataModalError" class="alert alert-danger py-2 small d-none" role="alert"></div>
                <ul id="thusaaTestdataModalList" class="list-group list-group-flush polygon-testdata-file-list d-none"></ul>
            </div>
            <div class="modal-footer py-2 flex-wrap gap-2">
                <button type="button" class="btn btn-sm btn-secondary bilingual-inline" data-bs-dismiss="modal">关闭<span class="en-text">Close</span></button>
                <button type="button" class="btn btn-sm btn-primary bilingual-button" id="thusaaTestdataModalDownload" data-pid="">
                    <span class="cn-text">下载测试数据 ZIP</span><span class="en-text">Download testdata ZIP</span>
                </button>
            </div>
        </div>
    </div>
</div>

{if isset($problem_pkg_import_enable) && $problem_pkg_import_enable}
<div class="modal fade" id="thusaaImportOjModal" tabindex="-1" aria-labelledby="thusaaImportOjModalLabel" aria-hidden="true">
    <div class="modal-dialog modal-lg modal-dialog-centered">
        <div class="modal-content">
            <div class="modal-header">
                <h5 class="modal-title bilingual-inline" id="thusaaImportOjModalLabel">导入到 OJ<span class="en-text">Import To OJ</span></h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="关闭 Close"></button>
            </div>
            <div class="modal-body">
                <p class="small text-muted mb-3">
                    将当前勾选的酒井算协题目打成 CSGOJ 导入 ZIP，上传到「题目导入」目录；可选择仅上传或上传后立即提交后台导入任务。
                    <span class="en-text">Build a CSGOJ import ZIP from the selection, upload to the problem-import folder; upload only or submit a background import task.</span>
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
                <button type="button" class="btn btn-primary bilingual-button" id="thusaaImportOjBtnUploadOnly">
                    <span class="cn-text">仅上传到导入区</span><span class="en-text">Upload Only</span>
                </button>
                <button type="button" class="btn btn-success bilingual-button" id="thusaaImportOjBtnDirect">
                    <span class="cn-text">上传并提交后台导入</span><span class="en-text">Upload &amp; Import</span>
                </button>
            </div>
        </div>
    </div>
</div>
{/if}

<div class="modal fade" id="thusaaHelpModal" tabindex="-1" aria-labelledby="thusaaHelpModalLabel" aria-hidden="true">
    <div class="modal-dialog modal-xl">
        <div class="modal-content">
            <div class="modal-header">
                <h5 class="modal-title bilingual-inline" id="thusaaHelpModalLabel">帮助<span class="en-text">Help</span></h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="关闭 Close"></button>
            </div>
            <div class="modal-body">
                <p>
                    酒井算协 / THU 常见公开结构（如 CCPC 北京、THUPC 资料库）：根目录或 <code>day0/</code>、<code>day1/</code> 下每题一目录，内含 <code>conf.yaml</code>、<code>statement/zh-cn.md</code>、<code>down/</code>（样例）、<code>data/</code>（正式测例，<code>.in</code> / <code>.ans</code>）。
                    <span class="en-text">Typical Jiujing / THU layout: per-problem folder with <code>conf.yaml</code>, <code>statement/zh-cn.md</code>, <code>down/</code> (samples), <code>data/</code> (tests as <code>.in</code> / <code>.ans</code>).</span>
                </p>
                <div class="directory">
                    <ul>
                        <li class="folder">PROBLEM_DIR
                            <ul>
                                <li class="file">conf.yaml</li>
                                <li class="folder">statement
                                    <ul>
                                        <li class="file">zh-cn.md <span class="text-muted">(或 en.md)</span></li>
                                    </ul>
                                </li>
                                <li class="folder">down
                                    <ul>
                                        <li class="file">1.in / 1.ans <span class="text-muted">(样例，与 conf.samples 对应)</span></li>
                                    </ul>
                                </li>
                                <li class="folder">data
                                    <ul>
                                        <li class="file">*.in / *.ans <span class="text-muted">(正式数据；打包为 .out)</span></li>
                                        <li class="file">chk.cpp <span class="text-muted">(可选，特判 → tpj.cc)</span></li>
                                    </ul>
                                </li>
                                <li class="folder">resources
                                    <ul>
                                        <li class="img">附件… <span class="text-muted">(可选)</span></li>
                                    </ul>
                                </li>
                            </ul>
                        </li>
                    </ul>
                </div>
                <ul>
                    <li>
                        支持仓库根级 <code>conf.yaml</code>（<code>folder: contest</code>）与多层子目录；仅含 <code>data.cases</code> 的题目目录会被识别为题。
                        <span class="en-text">Contest-level <code>conf.yaml</code> is ignored; only problem folders with <code>data.cases</code> are listed.</span>
                    </li>
                    <li>
                        题面中的 <code>{{ img('…') }}</code> 会转为 CSGOJ 附件路径；解析后请检查插图是否在 <code>resources/</code> 中。
                        <span class="en-text"><code>{{ img('…') }}</code> macros are rewritten to attach paths; verify files under <code>resources/</code>.</span>
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
    function openThusaaTestdataModal(pid) {
        var modalEl = document.getElementById('thusaaTestdataModal');
        if (!modalEl || !window.bootstrap) return;
        modalEl.dataset.pid = String(pid);
        var downBtn = document.getElementById('thusaaTestdataModalDownload');
        if (downBtn) downBtn.setAttribute('data-pid', String(pid));
        bootstrap.Modal.getOrCreateInstance(modalEl).show();
    }
    function thusaaApplyToolbarTitles(ok, hasRows) {
        var needParse = '请先解析题包 / Parse a package first';
        var needCheck = '须先勾选表格中的题目后再使用 / Check one or more rows first';
        var tPack = '将勾选题目打成 CSGOJ 导入 ZIP 并下载 / Pack selected as CSGOJ import ZIP';
        var tImp = '上传勾选题目的导入 ZIP / Upload import ZIP for selected problems';
        var dis = !hasRows ? needParse : needCheck;
        var setEl = function (id, text) {
            var el = document.getElementById(id);
            if (!el) return;
            if (typeof CsgSetTitleAndTooltip === 'function') {
                CsgSetTitleAndTooltip(el, text);
            } else {
                el.setAttribute('title', text);
            }
        };
        if (ok) {
            setEl('thusaa_download_selected_btn', tPack);
            setEl('thusaa_import_oj_btn', tImp);
        } else {
            setEl('thusaa_download_selected_btn', dis);
            setEl('thusaa_import_oj_btn', dis);
        }
    }
    function thusaaUpdateToolbarFromSelection() {
        var hasRows = typeof window.list_thusaa_problem !== 'undefined' && Array.isArray(window.list_thusaa_problem) && window.list_thusaa_problem.length > 0;
        var n = 0;
        try {
            if (thusaa_parse_table && thusaa_parse_table.length) {
                n = thusaa_parse_table.bootstrapTable('getSelections').length;
            }
        } catch (e) {
            n = 0;
        }
        var ok = hasRows && n > 0;
        $('#thusaa_download_selected_btn').prop('disabled', !ok);
        var imp = $('#thusaa_import_oj_btn');
        if (imp.length) {
            imp.prop('disabled', !ok);
        }
        thusaaApplyToolbarTitles(ok, hasRows);
    }
    var thusaa_parse_table = null;
    $(document).ready(function () {
        thusaa_parse_table = $('#thusaa_parse_table');
        thusaaUpdateToolbarFromSelection();
        $('#thusaa_convert_btn').on('click', function () {
            var fileInput = $('<input type="file" accept=".zip">');
            fileInput.on('change', async function (event) {
                var file = event.target.files[0];
                if (file && file.name.toLowerCase().endsWith('.zip')) {
                    var tableData = await window.HandleThusaaZipFile(file);
                    var rows = Array.isArray(tableData) ? tableData : [];
                    thusaa_parse_table.bootstrapTable('load', rows);
                    thusaaUpdateToolbarFromSelection();
                } else if (file) {
                    alerty.error('仅支持 .zip 文件', 'Only .zip files are supported');
                }
            });
            fileInput.click();
        });
        $('#thusaa_download_selected_btn').on('click', function () {
            window.DownloadSelectedThusaaProblems();
        });
        var testdataModalEl = document.getElementById('thusaaTestdataModal');
        if (testdataModalEl) {
            testdataModalEl.addEventListener('shown.bs.modal', async function () {
                var pid = testdataModalEl.dataset.pid;
                var loadEl = document.getElementById('thusaaTestdataModalLoading');
                var listEl = document.getElementById('thusaaTestdataModalList');
                var errEl = document.getElementById('thusaaTestdataModalError');
                if (!loadEl || !listEl || !errEl || !window.ThusaaConvertUi) return;
                loadEl.classList.remove('d-none');
                listEl.classList.add('d-none');
                errEl.classList.add('d-none');
                errEl.textContent = '';
                listEl.innerHTML = '';
                var r = await window.ThusaaConvertUi.fetchTestdataPackedNamesForPid(pid);
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
                var frag = document.createDocumentFragment();
                (r.names || []).forEach(function (name) {
                    var li = document.createElement('li');
                    li.className = 'list-group-item py-1 px-2 small font-monospace text-truncate polygon-testdata-file-item';
                    li.textContent = name;
                    li.setAttribute('title', name);
                    frag.appendChild(li);
                });
                listEl.appendChild(frag);
                listEl.classList.remove('d-none');
            });
        }
        $('#thusaaTestdataModalDownload').on('click', function () {
            var pid = parseInt($(this).attr('data-pid'), 10);
            var modalEl = document.getElementById('thusaaTestdataModal');
            if (modalEl && window.bootstrap) {
                var inst = bootstrap.Modal.getInstance(modalEl);
                if (inst) inst.hide();
            }
            if (pid) window.handleThusaaDownloadTestData(pid);
        });
        thusaa_parse_table.on('click-cell.bs.table', function (e, field) {
            if (field === 'spj' || field === 'testdata' || field === 'hash') {
                e.stopPropagation();
            }
        });
        thusaa_parse_table.on(
            'check.bs.table uncheck.bs.table check-all.bs.table uncheck-all.bs.table load-success.bs.table',
            function () {
                thusaaUpdateToolbarFromSelection();
            }
        );
    });
</script>
</div>
