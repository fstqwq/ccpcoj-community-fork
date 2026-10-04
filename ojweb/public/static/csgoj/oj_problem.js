// 确保在bootstrap-table初始化之前就有可用的queryParams函数
if (typeof window !== 'undefined' && typeof window.queryParams === 'undefined') {
    window.queryParams = function(params) { return params; };
}

var pro_sample_split_reg = /\n##CASE##\n/m;

/**
 * 解析样例数据，兼容新格式（包装对象）和旧格式（##CASE## 分隔）
 * @param {string} sample_str - 样例字符串
 *   - 新格式：{"data_type":"json","data":["样例1","样例2"]}
 *   - 旧格式："样例1\n##CASE##\n样例2"
 * @returns {Array<string>} - 解析后的样例数组
 */
function ParseSampleData(sample_str) {
    if (!sample_str || sample_str.trim() === '') {
        return [];
    }
    
    // 优先检查新格式：尝试解析为 JSON 格式
    try {
        const parsed = JSON.parse(sample_str);
        
        // 检查是否是新格式：有 data_type 字段且值为 'json'
        if (parsed && typeof parsed === 'object' && parsed.data_type === 'json') {
            // 新格式：返回 data 字段（应该是数组）
            if (Array.isArray(parsed.data)) {
                return parsed.data;
            }
            // data 字段不是数组，当作单个样例处理
            return [sample_str];
        }
        
        // 解析成功但不是新格式，继续检查旧格式
    } catch (e) {
        // 不是有效的 JSON，继续检查旧格式
    }
    
    // 其次检查旧格式：包含 ##CASE## 分隔符
    if (sample_str.includes('##CASE##')) {
        return sample_str.split(pro_sample_split_reg);
    }
    
    // 如果都不匹配，返回包含原始字符串的数组（单个样例）
    return [sample_str];
}

function ProblemSampleHtml(sample_in_str, sample_out_str, hlevel=4, is_input_dom=false, problemId=null) {
    let sample_in_list = ParseSampleData(sample_in_str);
    let sample_out_list = ParseSampleData(sample_out_str);
    let sample_num_max = Math.max(sample_in_list.length, sample_out_list.length);
    let sample_html = ``;
    for(let i = 0; i < sample_num_max; i ++) {
        sample_html += OneSample(
            i, 
            i < sample_in_list.length ? DomSantize(sample_in_list[i]) : '',
            i < sample_out_list.length ? DomSantize(sample_out_list[i]) : '',
            hlevel, 
            is_input_dom,
            problemId
        );
    }
    if(sample_num_max == 0) {
        sample_html = `<h${hlevel} class="bilingual-inline problem-sample-empty-placeholder">无样例<span class="en-text">No Sample</span></h${hlevel}>`
    }
    return sample_html;
}
/**
 * 按样例项统一刷新序号：每个 .sample-item 内的 # 序号与 data-sample-index 保持一致。
 * 避免上移/下移后出现输入#0、#2 与 输出#1、#3 错位。
 */
function ResetSampleIdx(problem_sample_div) {
    problem_sample_div.find('.sample-item').each((idx, item) => {
        var $item = $(item);
        var idxStr = String(idx);
        $item.find('.ith_case').text(idxStr);
        $item.attr('data-sample-index', idxStr);
        $item.find('[data-sample-index]').attr('data-sample-index', idxStr);
    });
}
function OneSample(i, sample_in_item, sample_out_item, hlevel=4, is_input_dom=false, problemId=null) {
    let sample_txt_area_type = is_input_dom ? "textarea" : "pre";
    let clss = is_input_dom ? "form-control sample_text_input" : "";
    let problemIdAttr = problemId ? `data-problem-id="${problemId}"` : '';
    let sampleIdxAttr = `data-sample-index="${i}"`;
    
    let func_btn = is_input_dom ? `
        <div class="sample-dnd-handle flex-grow-1" draggable="true" title="拖拽调整顺序 (Drag to reorder)" role="button" tabindex="0">
            <i class="bi bi-grip-vertical" aria-hidden="true"></i>
            <span class="sample-dnd-handle-text bilingual-inline">拖拽调整顺序 <span class="en-text">Drag to reorder</span></span>
        </div>
        <div class="sample-controls">
            <div class="btn-group btn-group-sm" role="group">
                <button type="button" class="btn btn-outline-primary up_sample_btn" title="上移 (Move Up)">
                    <i class="bi bi-arrow-up"></i>
                </button>
                <button type="button" class="btn btn-outline-danger del_sample_btn" title="双击删除 (Double Click to Delete)">
                    <i class="bi bi-trash"></i>
                </button>
                <button type="button" class="btn btn-outline-primary down_sample_btn" title="下移 (Move Down)">
                    <i class="bi bi-arrow-down"></i>
                </button>
            </div>
        </div>
        ` : "";
    function CopyBtn(flg_in) {
        return `<button type="button" class="btn btn-outline-secondary btn-sm sample_copy" data-sample-type="${flg_in ? 'input' : 'output'}" ${sampleIdxAttr} ${problemIdAttr} title="复制 (Copy)">
                        <i class="bi bi-clipboard"></i>
                    </button>`;
    }
    
    return `
    <div class="sample-item mb-3" ${sampleIdxAttr} ${problemIdAttr}>
        <div class="card border">
            ${func_btn ? `<div class="card-header card-header-with-dnd bg-light py-2 px-3 d-flex align-items-center">
                ${func_btn}
            </div>` : ''}
            <div class="card-body p-0">
                <div class="row g-0">
                    <div class="col-6 border-end">
                        <div class="sample-section-header bg-light border-bottom px-3 py-2 d-flex justify-content-between align-items-center">
                            <div class="d-flex align-items-center gap-2">
                                <h4 class="mb-0 text-primary">输入 <span class="en-text">Input</span></h4>
                                <span class="sample-index">#<span class="ith_case">${i}</span></span>
                            </div>
                            ${CopyBtn(true)}
                        </div>
                        <div class="sample-content p-3">
                            <${sample_txt_area_type} class="sampledata sample_input_area ${clss}" ${sampleIdxAttr} ${problemIdAttr} data-sample-type="input" ${is_input_dom ? 'rows="4"' : ''}>${sample_in_item}</${sample_txt_area_type}>
                        </div>
                    </div>
                    <div class="col-6">
                        <div class="sample-section-header bg-light border-bottom px-3 py-2 d-flex justify-content-between align-items-center">
                            <div class="d-flex align-items-center gap-2">
                                <h4 class="mb-0 text-success">输出 <span class="en-text">Output</span></h4>
                                <span class="sample-index">#<span class="ith_case">${i}</span></span>
                            </div>
                            ${CopyBtn(false)}
                        </div>
                        <div class="sample-content p-3">
                            <${sample_txt_area_type} class="sampledata sample_output_area ${clss}" ${sampleIdxAttr} ${problemIdAttr} data-sample-type="output" ${is_input_dom ? 'rows="4"' : ''}>${sample_out_item}</${sample_txt_area_type}>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
    `;
}
// ========================================
// 题目列表表格 Formatter 函数
// ========================================

window.PROBLEM_LIST_QUICK_EDIT = false;

function problemListIsAdminTableScene() {
    return typeof PROBLEM_LIST_CONFIG !== 'undefined' && PROBLEM_LIST_CONFIG.scene === 'admin';
}

function problemListQuickEditAttrEsc(s) {
    return String(s == null ? '' : s)
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

function problemListQuickEditPlainSourceForInput(raw) {
    if (raw == null || raw === '') {
        return '';
    }
    var processedValue = String(raw);
    var hasChanged = true;
    while (hasChanged) {
        var before = processedValue;
        processedValue = processedValue.replace(/<(?!\/?a\b)[^>]*\/?>/gi, '');
        hasChanged = before !== processedValue;
    }
    return processedValue.replace(/<[^>]*>/g, '');
}

// 前台题目列表标题formatter - 带spj配色，宽度由CSS控制；title 中体现评测模式
function FormatterProblemTitle(value, row, index, field) {
    if (window.PROBLEM_LIST_QUICK_EDIT && problemListIsAdminTableScene()) {
        var canEdit = !!(parseInt(row.edit, 10) || row.is_admin);
        if (canEdit) {
            var pid = row.problem_id;
            var v = problemListQuickEditAttrEsc(value == null ? '' : String(value));
            return '<input type="text" class="form-control form-control-sm problem-quick-in problem-quick-title" data-problem-id="' + pid + '" value="' + v + '" maxlength="200" title="标题 (Title)">';
        }
    }
    // 根据spj值确定颜色类与评测模式文案（与 title 一致）
    let colorClass = '';
    let spjTitle = '默认评测 / Default Judge';
    if (row['spj'] == '1') {
        colorClass = 'text-warning';
        spjTitle = '特判评测 / Special Judge';
    } else if (row['spj'] == '2') {
        colorClass = 'text-success';
        spjTitle = '交互评测 / Interactive Judge';
    } else {
        colorClass = 'text-primary';
    }
    const fullTitle = (value ? `${value}（${spjTitle}）` : spjTitle).replace(/&/g, '&amp;').replace(/"/g, '&quot;');
    return `<a class="text-decoration-none problem-title-link ${colorClass}" title="${fullTitle}" href="/csgoj/problemset/problem?pid=${row['problem_id']}">${value}</a>`;
}


// 来源formatter - 通用，宽度由CSS控制
function FormatterSource(value, row, index) {
    if (window.PROBLEM_LIST_QUICK_EDIT && problemListIsAdminTableScene()) {
        var canEdit = !!(parseInt(row.edit, 10) || row.is_admin);
        if (canEdit) {
            var pid = row.problem_id;
            var plain = problemListQuickEditPlainSourceForInput(value);
            var v = problemListQuickEditAttrEsc(plain);
            return '<input type="text" class="form-control form-control-sm problem-quick-in problem-quick-source" data-problem-id="' + pid + '" value="' + v + '" maxlength="255" title="来源 (Source)">';
        }
    }
    // 如果值为空或不是字符串，直接返回
    if (!value || typeof value !== 'string') {
        return value;
    }
    
    // 清理除了 a 标签之外的所有 HTML 标签
    let processedValue = value;
    let hasChanged = true;
    
    // 循环去除标签，直到没有变化为止
    while (hasChanged) {
        const before = processedValue;
        // 去除除了 a 标签之外的所有标签（包括自闭合标签）
        processedValue = processedValue.replace(/<(?!\/?a\b)[^>]*\/?>/gi, '');
        hasChanged = before !== processedValue;
    }
    
    // 检查最终结果是否只包含 a 标签和文本
    const cleanText = processedValue.replace(/<[^>]*>/g, '');
    
    // 若原串含 HTML：处理后与原串相同，表示没有可剥的非 <a> 标签（或本就仅文本+锚点），原样返回
    // 纯文本不含「<」时 processedValue === value 也成立，不能走此分支，否则无法生成下方搜索链接
    const hasOnlyATags = processedValue === value;
    if (hasOnlyATags && cleanText.trim() && value.indexOf('<') !== -1) {
        return value;
    }
    
    // 如果清理后的文本为空，返回原值
    if (!cleanText.trim()) {
        return value;
    }
    // 其他情况创建搜索链接
    const search_url = "/csgoj/problemset#search=" + encodeURIComponent(cleanText);
    return `<div class="problem-source-link" title="${cleanText}"><a href="${search_url}">${cleanText}</a></div>`;
}

// 出题列：管理端列表；快捷编辑模式下有权限行为 input
function FormatterProblemListAuthor(value, row, index, field) {
    if (window.PROBLEM_LIST_QUICK_EDIT && problemListIsAdminTableScene()) {
        var canEdit = !!(parseInt(row.edit, 10) || row.is_admin);
        if (canEdit) {
            var pid = row.problem_id;
            var plain = problemListQuickEditPlainSourceForInput(value);
            var v = problemListQuickEditAttrEsc(plain);
            return '<input type="text" class="form-control form-control-sm problem-quick-in problem-quick-author" data-problem-id="' + pid + '" value="' + v + '" maxlength="255" title="出题 (Author)">';
        }
    }
    if (value == null) {
        return '';
    }
    if (typeof FormatProblemAuthorsHtml === 'function') {
        var h = FormatProblemAuthorsHtml(value);
        if (h) {
            return h;
        }
    }
    var t = document.createElement('span');
    t.className = 'csg-author-tags-wrap';
    t.textContent = String(value);
    return t.outerHTML;
}

function FormatterProblemQuickSave(value, row, index, field) {
    if (!window.PROBLEM_LIST_QUICK_EDIT || !problemListIsAdminTableScene()) {
        return '';
    }
    var canEdit = !!(parseInt(row.edit, 10) || row.is_admin);
    if (!canEdit) {
        return '<span class="text-muted" title="无编辑权限 (No permission)">—</span>';
    }
    var saveBtnClass = (window.ADMIN_LIST_BTN && window.ADMIN_LIST_BTN.editClass)
        ? window.ADMIN_LIST_BTN.editClass
        : 'btn btn-sm btn-outline-primary';
    return '<button type="button" class="' + saveBtnClass + ' problem-quick-save-btn" data-problem-id="' + row.problem_id + '" title="保存本行 (Save row)">' +
        '<i class="bi bi-check-lg"></i></button>';
}

function problemListApplyQuickEditMode(on) {
    window.PROBLEM_LIST_QUICK_EDIT = !!on;
    if (typeof PROBLEM_LIST_CONFIG === 'undefined' || !PROBLEM_LIST_CONFIG.tableId) {
        return;
    }
    var $t = $('#' + PROBLEM_LIST_CONFIG.tableId);
    if (!$t.length || typeof $t.bootstrapTable !== 'function') {
        return;
    }
    var opts = $t.bootstrapTable('getOptions');
    if (!opts || !opts.columns || !opts.columns[0]) {
        return;
    }
    var hideWhenQuick = ['defunct', 'archived', 'edit', 'copy', 'attach', 'testdata', 'delete', 'in_date'];
    var i;
    if (on) {
        for (i = 0; i < hideWhenQuick.length; i++) {
            $t.bootstrapTable('hideColumn', hideWhenQuick[i]);
        }
        $t.bootstrapTable('showColumn', 'quick_save');
    } else {
        $t.bootstrapTable('hideColumn', 'quick_save');
        for (i = 0; i < hideWhenQuick.length; i++) {
            $t.bootstrapTable('showColumn', hideWhenQuick[i]);
        }
    }
}

/** 快捷保存成功：仅用 bootstrap-table 的 updateCellByUniqueId(..., reinit:false) 更新本行三列，不重载整表 */
function problemQuickEditUpdateSavedRowCells($table, problemId, payload) {
    if (!payload || payload.title === undefined) {
        $table.bootstrapTable('refresh');
        return;
    }
    var uid = parseInt(problemId, 10);
    var src = payload.source != null ? String(payload.source) : '';
    var auth = payload.author != null ? String(payload.author) : '';
    var opts = { id: uid, reinit: false };
    $table.bootstrapTable('updateCellByUniqueId', Object.assign({}, opts, { field: 'title', value: payload.title }));
    $table.bootstrapTable('updateCellByUniqueId', Object.assign({}, opts, { field: 'source', value: src }));
    $table.bootstrapTable('updateCellByUniqueId', Object.assign({}, opts, { field: 'author', value: auth }));
}

function problemQuickEditFindNeighborInputRow($tr, down) {
    var step = down ? 'next' : 'prev';
    var $cur = $tr;
    for (var guard = 0; guard < 300; guard++) {
        $cur = $cur[step]('tr');
        if (!$cur.length) {
            return null;
        }
        if ($cur.find('.problem-quick-in').length) {
            return $cur;
        }
    }
    return null;
}

function initProblemListQuickEdit() {
    if (typeof PROBLEM_LIST_CONFIG === 'undefined' || !PROBLEM_LIST_CONFIG.quickEditEnabled) {
        return;
    }
    $(document).off('keydown.problemListQuickArrow', '.problem-quick-in').on('keydown.problemListQuickArrow', '.problem-quick-in', function(e) {
        if (!window.PROBLEM_LIST_QUICK_EDIT) {
            return;
        }
        if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') {
            return;
        }
        if (e.altKey || e.ctrlKey || e.metaKey) {
            return;
        }
        if (e.isComposing) {
            return;
        }
        var el = e.target;
        if (!el || el.tagName !== 'INPUT' || !el.classList.contains('problem-quick-in')) {
            return;
        }
        var colSel = el.classList.contains('problem-quick-title') ? '.problem-quick-title'
            : el.classList.contains('problem-quick-source') ? '.problem-quick-source'
                : el.classList.contains('problem-quick-author') ? '.problem-quick-author' : null;
        if (!colSel) {
            return;
        }
        var $tr = $(el).closest('tr');
        if (!$tr.length) {
            return;
        }
        var $nextTr = problemQuickEditFindNeighborInputRow($tr, e.key === 'ArrowDown');
        if (!$nextTr) {
            return;
        }
        var $nextInput = $nextTr.find(colSel).filter('input').first();
        if (!$nextInput.length) {
            return;
        }
        e.preventDefault();
        $nextInput.trigger('focus');
    });
    var sid = '#' + PROBLEM_LIST_CONFIG.prefix + '_quick_edit_switch';
    $(document).off('change.problemListQuickEdit', sid).on('change.problemListQuickEdit', sid, function() {
        problemListApplyQuickEditMode(!!this.checked);
    });
    $(document).off('click.problemListQuickSave', '.problem-quick-save-btn').on('click.problemListQuickSave', '.problem-quick-save-btn', function(ev) {
        ev.preventDefault();
        var $btn = $(this);
        var pid = String($btn.data('problem-id') || '');
        if (!pid || !PROBLEM_LIST_CONFIG.quickSaveAjaxUrl) {
            return;
        }
        var $tr = $btn.closest('tr');
        var $qt = $tr.find('.problem-quick-title[data-problem-id="' + pid + '"]');
        var $qs = $tr.find('.problem-quick-source[data-problem-id="' + pid + '"]');
        var $qa = $tr.find('.problem-quick-author[data-problem-id="' + pid + '"]');
        var title = String($qt.val() || '').trim();
        var source = String($qs.val() || '').trim();
        var author = String($qa.val() || '').trim();
        $qt.val(title);
        $qs.val(source);
        $qa.val(author);
        if (!title) {
            if (typeof alerty !== 'undefined' && alerty.error) {
                alerty.error('标题不能为空<br/><span class="en-text">Title is required</span>', '错误');
            }
            return;
        }
        $btn.prop('disabled', true);
        $.post(PROBLEM_LIST_CONFIG.quickSaveAjaxUrl, {
            problem_id: pid,
            title: title,
            source: source,
            author: author
        }, function(res) {
            if (res && res.code === 1) {
                if (typeof alerty !== 'undefined' && alerty.success) {
                    alerty.success(res.msg || '已保存', '成功');
                }
                var $tb = $('#' + PROBLEM_LIST_CONFIG.tableId);
                if (window.PROBLEM_LIST_QUICK_EDIT && res.data) {
                    problemQuickEditUpdateSavedRowCells($tb, pid, res.data);
                } else {
                    $tb.bootstrapTable('refresh');
                }
            } else {
                if (typeof alerty !== 'undefined' && alerty.error) {
                    alerty.error((res && res.msg) ? res.msg : '保存失败', '错误');
                }
            }
        }).fail(function() {
            if (typeof alerty !== 'undefined' && alerty.error) {
                alerty.error('网络错误', '错误');
            }
        }).always(function() {
            $btn.prop('disabled', false);
        });
    });
    if (typeof window.csgSwitch !== 'undefined' && window.csgSwitch && typeof window.csgSwitch.autoInit === 'function') {
        window.csgSwitch.autoInit();
    }
}


// 归档状态 formatter - 管理后台专用，仅图标、固定宽度，title 为「当前状态，点击以更改为 xxx 状态」
function FormatterProArchive(value, row, index, field) {
    var hasPermission = row.is_admin || row.isadmin;
    var isArchived = row.archived == '1';
    var iconClass = isArchived ? 'bi bi-archive-fill' : 'bi bi-archive';
    var currentText = isArchived ? '已归档' : '未归档';
    var currentTextEn = isArchived ? 'Archived' : 'UnArchive';
    var nextText = isArchived ? '未归档' : '已归档';
    var nextTextEn = isArchived ? 'UnArchive' : 'Archived';
    var titleStr = '当前为' + currentText + '，点击改为' + nextText + ' (' + currentTextEn + ', click to change to ' + nextTextEn + ')';
    if (hasPermission) {
        return (
            '<div class="d-flex justify-content-center">' +
            '<button type="button" field="archived" item_name="problem" itemid="' + (row.problem_id || '') + '" ' +
            'class="change_status btn btn-sm change-status-icon-btn ' + (isArchived ? 'btn-info' : 'btn-outline-info') + '" ' +
            'status="' + (isArchived ? '1' : '0') + '" title="' + titleStr + '">' +
            '<i class="' + iconClass + '"></i>' +
            '</button></div>'
        );
    }
    return '<div class="d-flex justify-content-center">' +
        '<span class="change-status-icon-readonly ' + (isArchived ? 'text-info' : 'text-secondary') + '" title="' + titleStr + '">' +
        '<i class="' + iconClass + '"></i></span></div>';
}

// 附件formatter - 管理后台专用（复用统一样式）
function FormatterAttach(value, row, index, field) {
    var module = (window.ProblemConfig && window.ProblemConfig.module) || 'admin';
    var title = row.title ? (row.title.length > 150 ? row.title.substring(0, 150) + '...' : row.title) : '';
    var hasPermission = !!(parseInt(row.edit) || row.is_admin);
    return createAdminAttachBtn({
        disabled: !hasPermission,
        modalUrl: '/' + module + '/filemanager/filemanager?item=problem&id=' + row.problem_id,
        modalTitle: '附件管理 - 题目 #' + row.problem_id + ' - ' + title,
        title: '附件管理 (File Manager)'
    });
}

// 测试数据formatter - 管理后台专用（无权限时复用统一样式）
function FormatterTestData(value, row, index, field) {
    if (parseInt(value)) {
        var module = (window.ProblemConfig && window.ProblemConfig.module) || 'admin';
        var title = row.title ? (row.title.length > 150 ? row.title.substring(0, 150) + '...' : row.title) : '';
        return '<button type="button" class="btn btn-sm btn-outline-success" ' +
            'data-modal-url="/' + module + '/judge/judgedata_manager?item=problem&id=' + row.problem_id + '" ' +
            'data-modal-title="测试数据管理 - 题目 #' + row.problem_id + ' - ' + title + '" ' +
            'title="测试数据管理 (Test Data Manager)"><i class="bi bi-database"></i></button>';
    }
    return createAdminDisabledSpan('无权限管理(No Permission)');
}

// 编辑formatter - 管理后台专用（复用统一样式）
function FormatterEdit(value, row, index, field) {
    var module = (window.ProblemConfig && window.ProblemConfig.module) || 'admin';
    var hasPermission = !!(parseInt(value) || row.is_admin);
    return createAdminEditBtn({
        disabled: !hasPermission,
        url: '/' + module + '/problem/problem_edit?id=' + row.problem_id,
        title: '编辑题目(Edit Problem)'
    });
}

// 复制formatter - 管理后台专用（复用统一样式）
function FormatterCopy(value, row, index, field) {
    var module = (window.ProblemConfig && window.ProblemConfig.module) || 'admin';
    var hasPermission = !!(parseInt(row.edit) || row.is_admin);
    return createAdminCopyBtn({
        disabled: !hasPermission,
        url: '/' + module + '/problem/problem_copy?id=' + row.problem_id,
        title: '复制题目(Copy Problem)'
    });
}

// 题目AC状态formatter - 前台专用
function FormatterProblemAc(value, row, index, field) {
    if('ac' in row) {
        return row['ac'] == 1 ? "<span class='text-success'>Y</span>" : "<span class='text-warning'>N</span>";
    } else {
        return "";
    }
}


// ========================================
// 事件监听和初始化
// ========================================

document.addEventListener('click', (e) => {
    if(e.target.classList.contains("sample_copy") || e.target.closest(".sample_copy")) {
        let btn = e.target.classList.contains("sample_copy") ? e.target : e.target.closest(".sample_copy");
        
        // 获取样例类型和编号
        let sampleType = btn.getAttribute('data-sample-type');
        let sampleIndex = btn.getAttribute('data-sample-index');
        let problemId = btn.getAttribute('data-problem-id');
        
        if(!sampleType || sampleIndex === null) return;
        
        // 找到最近的 sample-item 容器作为查找范围
        let sampleItem = btn.closest('.sample-item');
        if(!sampleItem) return;
        
        // 在容器内查找对应的样例元素
        // 优先使用 problemId 进行精确匹配，如果没有则只使用 sample-type 和 sample-index
        let selector = `.sampledata[data-sample-type="${sampleType}"][data-sample-index="${sampleIndex}"]`;
        if(problemId) {
            selector += `[data-problem-id="${problemId}"]`;
        }
        let target_sample = sampleItem.querySelector(selector);
        
        if(!target_sample) return;
        
        // 复制内容
        let content = target_sample instanceof HTMLTextAreaElement ? target_sample.value : target_sample.innerText;
        if(ClipboardWrite(content)) {
            // 按钮短时特效提示复制成功
            let originalIcon = btn.innerHTML;
            let originalClass = btn.className;
            
            // 临时改变按钮样式和图标
            btn.innerHTML = '<i class="bi bi-check-circle-fill"></i>';
            btn.className = btn.className.replace('btn-outline-secondary', 'btn-success');
            btn.disabled = true;
            
            // 0.5秒后恢复原状
            setTimeout(() => {
                btn.innerHTML = originalIcon;
                btn.className = originalClass;
                btn.disabled = false;
            }, 500);
        }
    }
});

// 题目列表专用初始化函数 - 简化版，复用全局功能
function initProblemList() {
    if (typeof PROBLEM_LIST_CONFIG === 'undefined') return;
    // 使用全局的 initBootstrapTableToolbar 函数 general_formatter.js
    var toolbarConfig = {
        tableId: PROBLEM_LIST_CONFIG.tableId,
        prefix: PROBLEM_LIST_CONFIG.prefix,
        filterSelectors: PROBLEM_LIST_CONFIG.filterSelectors,
        searchInputId: PROBLEM_LIST_CONFIG.searchInputId,
        // 前台模式启用锚参数同步
        enableAnchorSync: PROBLEM_LIST_CONFIG.scene === 'frontend',
        anchorKey: 'search',
        // problem 相关页面不缓存搜索内容（传参 0 表示不缓存）
        searchCacheSeconds: 300
    };
    
    // 保留自定义处理器支持（向后兼容）
    if (PROBLEM_LIST_CONFIG.customHandlers) {
        toolbarConfig.customHandlers = PROBLEM_LIST_CONFIG.customHandlers;
    }
    
    initBootstrapTableToolbar(toolbarConfig);
    initProblemListQuickEdit();
}

/**
 * 是否尝试在题面页内嵌 PDF（桌面且未关闭内置 PDF 查看时；移动设备不尝试内嵌）。
 */
function problemPdfSupportsInlineEmbed() {
    var ua = navigator.userAgent || '';
    if (/Mobi|Android|webOS|iPhone|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua)) {
        return false;
    }
    if (/iPad/i.test(ua)) {
        return false;
    }
    if (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) {
        return false;
    }
    if (typeof navigator.pdfViewerEnabled === 'boolean') {
        return navigator.pdfViewerEnabled;
    }
    return true;
}

/**
 * iframe 内是否为「无法加载」类错误页（可访问 document 时）。
 */
function problemPdfProbeIframeFailed(iframe) {
    try {
        var doc = iframe.contentDocument;
        if (!doc || !doc.body) {
            return false;
        }
        var text = (doc.body.innerText || doc.body.textContent || '').toLowerCase();
        if (/couldn't load plugin|could not load plugin|failed to load pdf|unable to (open|load)|无法打开|未能加载|not supported/.test(text)) {
            return true;
        }
        var title = (doc.title || '').toLowerCase();
        if (title.indexOf('error') >= 0 && text.length < 160) {
            return true;
        }
    } catch (e) {
        return false;
    }
    return false;
}

/**
 * PDF 直通题面：页内 iframe 或通用 fallback（新窗口 / 下载）。
 */
function initProblemPdfEmbed() {
    var $wrap = $('.problem-pdf-embed-wrap[data-pdf-url]').first();
    if (!$wrap.length) {
        return;
    }
    var pdfUrl = ($wrap.attr('data-pdf-url') || '').trim();
    if (!pdfUrl) {
        return;
    }
    var $inlineHost = $wrap.find('.problem-pdf-inline-host');
    var $fallback = $wrap.find('.problem-pdf-fallback');
    var inlineConfirmed = false;
    var embedAborted = false;
    var failTimer = null;

    function clearFailTimer() {
        if (failTimer) {
            clearTimeout(failTimer);
            failTimer = null;
        }
    }

    function showFallback() {
        if (inlineConfirmed || embedAborted) {
            return;
        }
        embedAborted = true;
        clearFailTimer();
        $inlineHost.empty().attr('aria-hidden', 'true');
        $fallback.removeClass('d-none').attr('aria-hidden', 'false');
        $wrap.addClass('problem-pdf-embed-wrap--fallback');
    }

    function confirmInlineSuccess() {
        if (embedAborted || inlineConfirmed) {
            return;
        }
        inlineConfirmed = true;
        clearFailTimer();
        $fallback.addClass('d-none').attr('aria-hidden', 'true');
        $inlineHost.attr('aria-hidden', 'false');
        $wrap.removeClass('problem-pdf-embed-wrap--fallback');
    }

    $wrap.find('.problem-pdf-download').attr('href', pdfUrl);
    $wrap.on('click', '.problem-pdf-open-new', function() {
        window.open(pdfUrl, '_blank', 'noopener,noreferrer');
    });

    if (!problemPdfSupportsInlineEmbed()) {
        showFallback();
        return;
    }

    var iframe = document.createElement('iframe');
    iframe.className = 'problem-pdf-frame';
    iframe.setAttribute('title', '题面 PDF');
    iframe.src = pdfUrl;

    function armFailTimer(ms) {
        clearFailTimer();
        failTimer = setTimeout(function() {
            if (!inlineConfirmed) {
                showFallback();
            }
        }, ms);
    }

    iframe.addEventListener('load', function() {
        armFailTimer(900);
        setTimeout(function() {
            if (inlineConfirmed || embedAborted) {
                return;
            }
            if (problemPdfProbeIframeFailed(iframe)) {
                showFallback();
            } else {
                confirmInlineSuccess();
            }
        }, 450);
    });
    iframe.addEventListener('error', function() {
        showFallback();
    });

    $inlineHost.empty().append(iframe);
    armFailTimer(3600);
}

// 题目详情页专用功能 - 样例处理
function initProblemDetail() {
    // 从 hidden textarea 获取样例数据（只兼容旧的数据格式，不兼容旧的 HTML 结构）
    if ($('.sample_div').length > 0) {
        let sample_div = $('.sample_div');
        let sample_in_str = $('#sample_input_hidden').val() || '';
        let sample_out_str = $('#sample_output_hidden').val() || '';
        
        // ParseSampleData 函数会兼容旧的数据格式（##CASE## 分隔）和新格式（JSON 包装对象）
        if (sample_in_str || sample_out_str) {
            sample_div.html(ProblemSampleHtml(sample_in_str, sample_out_str));
            // 样例更新后，math.js 的 MutationObserver 会自动检测并渲染数学公式
        }
    }
    // 注意：数学公式渲染已由 math.js 自动处理，无需手动调用
}

// 窗口大小变化时重新计算标题宽度 - 复用全局防抖机制
$(document).ready(function() {
    let resizeTimeout;
    $(window).on('resize', function() {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(function() {
            // 重新刷新表格以应用新的标题宽度
            if (typeof PROBLEM_LIST_CONFIG !== 'undefined' && typeof $('#' + PROBLEM_LIST_CONFIG.tableId).bootstrapTable !== 'undefined') {
                $('#' + PROBLEM_LIST_CONFIG.tableId).bootstrapTable('refresh');
            }
        }, 300); // 防抖，300ms后执行
    });
    
    // 初始化题目列表（如果存在配置）
    initProblemList();
    
    // 初始化题目详情页（如果存在样例）
    initProblemDetail();
    initProblemPdfEmbed();

    $(document).on('change', '#problem_desc_lang_select', function() {
        var url = $(this).val();
        if (url) {
            window.location.href = url;
        }
    });
});
