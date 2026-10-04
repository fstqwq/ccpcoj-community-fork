// 考试题目选择页面 JavaScript
// 注意：PAGE_MODULE 常量在 ex_global.js 中定义

// 页面初始化变量
let page_info = $('#page_info');
let edit_mode = page_info.attr('edit_mode');
let contest_id = parseInt(page_info.attr('contest_id'));

// Formatter 函数
function FormatterQuestionTitle(value, row, index, field) {
    // 与 table 的 data-width 对齐，避免撑出横向滚动
    const width = 200; // px（略小于 th data-width，预留 padding）
    const v = (value == null) ? '' : String(value);
    const escaped = v.replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return `<span class="d-inline-block text-truncate question-title-display question-title-list question_display"
                ex_question_id="${row.ex_question_id}"
                style="max-width:${width}px;"
                title="${escaped}">${escaped}</span>`;
}

function FormatterLabel(value, row, index, field) {
    const width = 55; // px
    const v = (value == null) ? '' : String(value);
    const escaped = v.replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return `<span class="d-inline-block text-truncate question-label-display"
                style="max-width:${width}px;"
                title="${escaped}">${escaped || '-'}</span>`;
}

function FormatterSource(value, row, index, field) {
    const width = 78; // px
    const v = (value == null) ? '' : String(value);
    const escaped = v.replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return `<span class="d-inline-block text-truncate"
                style="max-width:${width}px;"
                title="${escaped}">${escaped || '-'}</span>`;
}

function FormatterQuestionTitleSelected(value, row, index, field) {
    let title = question_all_map[row['ex_question_id']]['title'];
    return `<span class='question-title-display question-title-selected question_display' ex_question_id='${row.ex_question_id}' title='${title}'>${title}</span>`;
}

function FormatterAdd(value, row, index, field) {
    if(row['selected']) {
        return "<button type='button' class='btn btn-danger btn-sm' ex_question_id='" + row['ex_question_id'] + "'>RM</a>";
    } else {
        return "<button type='button' class='btn btn-success btn-sm' ex_question_id='" + row['ex_question_id'] + "'>Add</a>";
    }    
}

function FormatterPkind(value, row, index, field) {
    if(value == 0)          return '<span title="单选">SC</span>';
    else if(value == 1)     return '<span title="多选">MC</span>';
    else if(value == 5)     return '<span title="判断">TF</span>';
    else if(value == 10)    return '<span title="填空">FI</span>';
    else if(value == 15)    return '<span title="简答">SA</span>';
    else if(value == 20)    return '<span title="综合">CS</span>';
    else if(value == 25)    return '<span title="编程">PG</span>';
}

function FormatterIdx(value, row, index, field) {
    return index + 1;
}

function FormatterQuestionId(value, row, index, field) {
    return `<a href="#" class="question_display" ex_question_id="` + value + `">` + value + `</a>`;
}

function FormatterPrule(value, row, index, field) {
    const displayValue = value || '';
    const escapedValue = displayValue.replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return `<span class='d-inline-block text-truncate prule-editable' 
                   data-ex-question-id="${row.ex_question_id}" 
                   data-pkind="${row.pkind}"
                   data-current-value="${escapedValue}"
                   title="${escapedValue || '点击编辑评分规则 / Click to edit scoring rule'}">
                ${displayValue || '<span class="text-muted small"><span class="cn-text">点击编辑</span><span class="en-text">Click to edit</span></span>'}
            </span>`;
}

function FormatterPscore(value, row, index, field) {
    const displayValue = value || '0';
    return `<span class='d-inline-block pscore-editable' 
                   data-ex-question-id="${row.ex_question_id}" 
                   data-pkind="${row.pkind}"
                   data-current-value="${displayValue}"
                   title="点击编辑分数 / Click to edit score">
                ${displayValue}
            </span>`;
}

function FormatterRM(value, row, index, field) {
    return "<button type='button' class='btn btn-danger btn-sm' ex_question_id='" + row['ex_question_id'] + "'>RM</a>";
}

// 全局变量
let question_list_table = $("#question_list_table");
let question_filter_all = $("#question_filter_all");
let question_filter_clear = $("#question_filter_clear");
let question_filter_button = $("#question_filter_button");

let question_selected_table = $('#question_selected_table');
let total_score_span = $('#total_score_span');
let total_score_hint = $('#total_score_hint');
let question_json_text_real = $('#question_json_text_real');
let question_all_data = [];
let question_all_map = {};
let question_selected_data = {};

let totalScore = 0;
let attachScore = 0;
let has_attach_pro = parseInt($("input:radio[name='attach_pro']:checked").val());

// 下载配置
$('#download_config_btn').click(function(){
    const config = question_selected_real_to_show(question_selected_data);
    const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `exam_questions_config_${contest_id || 'new'}_${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    alerty.success('配置已下载 / Config downloaded');
});

// 上传配置
$('#upload_config_btn').click(function(){
    $('#config_file_input').click();
});

$('#config_file_input').change(function(e){
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(event) {
        try {
            const config = JSON.parse(event.target.result);
            const question_real = question_selected_show_to_real(config);
            
            // 清空当前选择
            question_selected_data = {};
            let pid_map = {};
            
            // 加载新配置
            for(let pkind in question_real) {
                if(!(pkind in question_default['pkind_table'])) {
                    continue;
                }
                for(let i in question_real[pkind]) {
                    let item = question_real[pkind][i];
                    if(!('ex_question_id' in item) || (item['ex_question_id'] in pid_map)) continue;
                    pid_map[item['ex_question_id']] = true;
                    AddItemToQuestionSelected(
                        item['ex_question_id'],
                        'prule' in item ? item['prule'] : '', 
                        'pscore' in item ? item['pscore'] : question_default['default_score'][pkind]
                    ); 
                }
            }
            
            // 更新选中状态
            for(let ex_question_id in question_all_map) {
                question_all_map[ex_question_id]['selected'] = ex_question_id in pid_map;
                let question_row = question_list_table.bootstrapTable('getRowByUniqueId', ex_question_id);
                if(question_row) {
                    question_row['selected'] = question_all_map[ex_question_id]['selected'];
                    SelectedRowUpdate(question_row);
                }
            }
            UpdateQuestionSelectedRes();
            
            alerty.success('配置已加载 / Config loaded');
        } catch(err) {
            console.error('JSON parse error:', err);
            alerty.error('配置文件格式错误 / Invalid config file format');
        }
    };
    reader.readAsText(file);
    // 清空文件输入，允许重复上传同一文件
    e.target.value = '';
});

question_filter_all.click(function(){
    $(".question_filter_check").prop('checked', true);
});

question_filter_clear.click(function(){
    $(".question_filter_check").prop('checked', false);
});

question_filter_button.click(function(){
    let pkind_filter = [];
    $(".question_filter_check").each(function(index, elem) {
        if(elem.checked) {
            pkind_filter.push(elem.getAttribute('pkind'));
        }
    });
    question_list_table.bootstrapTable('filterBy', {
        pkind: pkind_filter
    })
});

function TotalScoreSpanUpdate() {
    const TARGET_SCORE = 100;
    let baseScore = totalScore;
    let isOk = false;
    let diff = 0;

    if(has_attach_pro) {
        baseScore = (totalScore - attachScore);
        total_score_span.text(baseScore + '+' + attachScore);
        diff = baseScore - TARGET_SCORE;
        isOk = (diff === 0);
    } else {
        total_score_span.text(totalScore);
        diff = totalScore - TARGET_SCORE;
        isOk = (diff === 0);
    }

    // 颜色提示：满足 100 为 green，否则 red；并显示差值（少了/多了）
    total_score_span.removeClass('text-danger text-success').addClass(isOk ? 'text-success' : 'text-danger');
    if(!isOk) {
        const abs = Math.abs(diff);
        total_score_hint
            .removeClass('text-muted text-danger text-success')
            .addClass('text-danger')
            .text(diff < 0 ? (`少 ${abs}`) : (`多 ${abs}`))
            .attr('title', has_attach_pro ? '基础分需为 100（不含附加题）' : '总分需为 100');
    } else {
        total_score_hint
            .removeClass('text-muted text-danger text-success')
            .addClass('text-success')
            .text('OK')
            .attr('title', '总分满足要求');
    }
}

$("input:radio[name='attach_pro']").change(function(){
    has_attach_pro = parseInt($(this).val());
    TotalScoreSpanUpdate();
});

function UpdateQuestionSelectedRes() {
    let tmp_question_selected_table_data = [];
    totalScore = 0;
    let idx = 1;
    for(pkind in question_selected_data) {
        if(question_selected_data[pkind].length > 0) {
            for(i in question_selected_data[pkind]) {
                tmp_question_selected_table_data.push({
                    "idx": idx++,
                    "ex_question_id": question_selected_data[pkind][i]['ex_question_id'],
                    "pkind": question_all_map[question_selected_data[pkind][i]['ex_question_id']]['pkind'],
                    "prule": question_selected_data[pkind][i]['prule'] || '',
                    "pscore": question_selected_data[pkind][i]['pscore'] || 0,
                })
                let pscore = parseFloat(question_selected_data[pkind][i]['pscore']);
                totalScore += pscore;
                attachScore = pscore;
            }
        }
    }
    question_selected_table.bootstrapTable('load', tmp_question_selected_table_data);
    TotalScoreSpanUpdate();
    question_json_text_real.val(JSON.stringify(question_selected_data, null, 4));
}

function AddQuestionToSelected(row, ex_question_id) {
    if(row['selected'] == true) return false;
    if(!(ex_question_id in question_all_map)) {
        console.warn('Question not found in question_all_map:', ex_question_id);
        return false;
    }
    let question = question_all_map[ex_question_id];
    if(!(question['pkind'] in question_selected_data)) {
        question_selected_data[question['pkind']] = [];
    }
    question_selected_data[question['pkind']].push({
        'ex_question_id': ex_question_id,
        'prule': '',
        'pscore': question_default['default_score'][question['pkind']],
    });
    UpdateQuestionSelectedRes();
    row['selected'] = true;
    SelectedRowUpdate(row);
}

question_list_table.on('click-cell.bs.table', function(e, field, value, row, $element){
    if(field != 'selected') return;
    if(row['selected']) {
        RmQuestionToSelected(row['ex_question_id']);
    } else {
        AddQuestionToSelected(row, row['ex_question_id']);
    }
});

function RmQuestionToSelected(ex_question_id) {
    let question = question_all_map[ex_question_id];
    question_selected_data[question['pkind']] = question_selected_data[question['pkind']].filter(item => item['ex_question_id'] != ex_question_id);
    UpdateQuestionSelectedRes();
    
    let question_row = question_list_table.bootstrapTable('getRowByUniqueId', ex_question_id);
    question_row['selected'] = false;
    SelectedRowUpdate(question_row);
}

function SelectedRowUpdate(row) {
    question_list_table.bootstrapTable('updateByUniqueId', {
        id: row['ex_question_id'],
        row: row
    });
}

// 处理删除按钮点击
question_selected_table.on('click-cell.bs.table', function(e, field, value, row, $element){
    if(field === 'rm') {
        RmQuestionToSelected(row['ex_question_id']);
    }
});

// 处理 prule 和 pscore 的点击编辑
$(document).on('click', '.prule-editable, .pscore-editable', function(e){
    e.stopPropagation();
    const $target = $(this);
    const exQuestionId = $target.data('ex-question-id');
    const pkind = $target.data('pkind');
    const currentValue = $target.data('current-value') || '';
    const isPrule = $target.hasClass('prule-editable');
    
    // 找到对应的 row
    const rows = question_selected_table.bootstrapTable('getData');
    const row = rows.find(r => r.ex_question_id == exQuestionId);
    if (!row) return;
    
    // 显示编辑模态框
    showQuestionEditModal(isPrule, row, currentValue, pkind);
});

// 显示编辑模态框
function showQuestionEditModal(isPrule, row, currentValue, pkind) {
    const fieldName = isPrule ? 'prule' : 'pscore';
    const fieldLabel = isPrule ? '评分规则' : '题目分数';
    const fieldLabelEn = isPrule ? 'Scoring Rule' : 'Question Score';
    
    // 创建模态框 HTML
    const modalId = 'question_edit_modal';
    let existingModal = document.getElementById(modalId);
    if (existingModal) {
        existingModal.remove();
    }
    
    const modalHtml = `
        <div class="modal fade" id="${modalId}" tabindex="-1" aria-labelledby="${modalId}Label" aria-hidden="true">
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title" id="${modalId}Label">
                            <span class="cn-text">编辑${fieldLabel}</span>
                            <span class="en-text">Edit ${fieldLabelEn}</span>
                        </h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                    </div>
                    <div class="modal-body">
                        <div class="mb-3">
                            <label class="form-label bilingual-label">
                                ${fieldLabel}：<span class="en-text">${fieldLabelEn}</span>
                            </label>
                            ${isPrule ? 
                                `<textarea class="form-control" id="edit_field_input" rows="3" placeholder="请输入评分规则描述 / Enter scoring rule description"></textarea>` :
                                `<input type="number" class="form-control" id="edit_field_input" step="0.5" min="0" value="${currentValue || '0'}" placeholder="请输入分数 / Enter score">`
                            }
                        </div>
                        <div class="mb-2">
                            <small class="text-muted">
                                <span class="cn-text">题目ID: ${row.ex_question_id}</span>
                                <span class="en-text">Question ID: ${row.ex_question_id}</span>
                            </small>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">
                            <span class="cn-text">取消</span>
                            <span class="en-text">Cancel</span>
                        </button>
                        <button type="button" class="btn btn-warning" id="apply_to_same_type_btn">
                            <span class="cn-text">覆盖后续同类型</span>
                            <span class="en-text">Apply to Same Type</span>
                        </button>
                        <button type="button" class="btn btn-primary" id="confirm_edit_btn">
                            <span class="cn-text">确认</span>
                            <span class="en-text">Confirm</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    $('body').append(modalHtml);
    const modal = new bootstrap.Modal(document.getElementById(modalId));
    
    // 设置 textarea 的值（需要单独设置，避免 HTML 转义问题）
    if (isPrule) {
        $('#edit_field_input').val(currentValue || '');
    }
    
    // 确认按钮
    $('#confirm_edit_btn').off('click').on('click', function(){
        const newValue = isPrule ? $('#edit_field_input').val().trim() : RoundPscore($('#edit_field_input').val());
        updateQuestionField(row.ex_question_id, fieldName, newValue, false);
        modal.hide();
        {
            alerty.success(
                `${fieldLabel}已更新 / ${fieldLabelEn} updated<br>` +
                `<span class="text-danger fw-bold">尚未存入数据库，记得保存考试</span>`
            );
        }
    });
    
    // 覆盖后续同类型题按钮
    $('#apply_to_same_type_btn').off('click').on('click', function(){
        const newValue = isPrule ? $('#edit_field_input').val().trim() : RoundPscore($('#edit_field_input').val());
        updateQuestionField(row.ex_question_id, fieldName, newValue, true);
        modal.hide();
        {
            alerty.success(
                `已覆盖后续同类型题 / Applied to same type questions<br>` +
                `<span class="text-danger fw-bold">尚未存入数据库，记得保存考试</span>`
            );
        }
    });
    
    modal.show();
    
    // 模态框关闭时清理
    $(`#${modalId}`).on('hidden.bs.modal', function(){
        $(this).remove();
    });
}

// 更新题目字段
function updateQuestionField(exQuestionId, fieldName, newValue, applyToSameType) {
    const rows = question_selected_table.bootstrapTable('getData');
    const currentRowIndex = rows.findIndex(r => r.ex_question_id == exQuestionId);
    if (currentRowIndex === -1) return;
    
    const currentRow = rows[currentRowIndex];
    const pkind = currentRow.pkind;
    
    // 更新当前题目
    const questionIndex = question_selected_data[pkind].findIndex(item => item['ex_question_id'] === exQuestionId);
    if (questionIndex !== -1) {
        question_selected_data[pkind][questionIndex][fieldName] = newValue;
    }
    
    // 如果选择覆盖后续同类型题
    if (applyToSameType) {
        // 找到当前题目在表格中的位置，更新后续同类型的题目
        for (let i = currentRowIndex + 1; i < rows.length; i++) {
            if (rows[i].pkind == pkind) {
                const followExQuestionId = rows[i].ex_question_id;
                const followQuestionIndex = question_selected_data[pkind].findIndex(item => item['ex_question_id'] === followExQuestionId);
                if (followQuestionIndex !== -1) {
                    question_selected_data[pkind][followQuestionIndex][fieldName] = newValue;
                }
            }
        }
    }
    
    UpdateQuestionSelectedRes();
}

question_selected_table.on('reorder-row.bs.table', function(e, data, row, row_old_pos){
    let pkind_flag = {};
    for(let i in data) {
        if(!(data[i]['pkind'] in pkind_flag)) {
            question_selected_data[data[i]['pkind']].splice(0, question_selected_data[data[i]['pkind']].length);
            pkind_flag[data[i]['pkind']] = true;
        }
        question_selected_data[data[i]['pkind']].push({
            'ex_question_id': data[i]['ex_question_id'],
            'prule': data[i]['prule'],
            'pscore': data[i]['pscore']
        });
    }
    UpdateQuestionSelectedRes();
});

function AddItemToQuestionSelected(ex_question_id, prule, pscore) {
    if(!(ex_question_id in question_all_map)) {
        return false;
    }
    let pkind = question_all_map[ex_question_id]['pkind'];
    
    if(!(pkind in question_selected_data)) {
        question_selected_data[pkind] = [];
    }
    question_selected_data[pkind].push({
        "ex_question_id": ex_question_id,
        "prule": prule,
        "pscore": pscore
    })
    return true;
}

function question_selected_real_to_show(question_real) {
    let question_show = {};
    for(let numkey in question_real) {
        question_show[question_default['pkind_table'][numkey]] = question_real[numkey];
    }
    return question_show;
}

function question_selected_show_to_real(question_show) {
    let question_real = {};
    for(let alphakey in question_show) {
        question_real[question_default['pkind_reverse_table'][alphakey]] = question_show[alphakey];
        for(let i in question_real[question_default['pkind_reverse_table'][alphakey]]) {
            let item = question_real[question_default['pkind_reverse_table'][alphakey]][i];
            if('pscore' in item) {
                item['pscore'] = RoundPscore(item['pscore']);
            }
        }
    }
    return question_real;
}

function InitQuestionSelection() {
    // question_list_ajax 必须返回 {total, rows}
    $.get('/exadmin/question/question_list_ajax', function(q_data){
        if(!q_data || !Array.isArray(q_data.rows)) {
            throw new Error('Invalid response from /exadmin/question/question_list_ajax: expected {rows: []}');
        }
        const rows = q_data.rows;
        for(let i in rows) {
            if(rows[i] && typeof rows[i]['ex_question_id'] !== 'undefined') {
                question_all_map[rows[i]['ex_question_id']] = rows[i];
            }
        }
        if(contest_id != 0) {
            $.get('/exadmin/exam/contest_problem_ajax?contest_id=' + contest_id, function(ret){
                if(ret && ret.code == 1 && ret.data) {
                    // 兼容后端返回：
                    // - 新版：{ rows: [...], meta: {...} }
                    // - 旧版：直接数组
                    let cp_rows = [];
                    if(ret.data && Array.isArray(ret.data.rows)) cp_rows = ret.data.rows;
                    else if(Array.isArray(ret.data)) cp_rows = ret.data;
                    for(let i in cp_rows) {
                        // contest_problem 表中 title 字段存储的是 prule
                        let ex_question_id = cp_rows[i]['problem_id'] || cp_rows[i]['ex_question_id'];
                        if(ex_question_id && ex_question_id in question_all_map) {
                            AddItemToQuestionSelected(ex_question_id, cp_rows[i]['title'] || '', cp_rows[i]['pscore'] || 0);
                            question_all_map[ex_question_id]['selected'] = true;
                        }
                    }
                    UpdateQuestionSelectedRes();
                    for(let i in rows) {
                        let ex_question_id = rows[i]['ex_question_id'];
                        if(ex_question_id && ex_question_id in question_all_map) {
                            rows[i]['selected'] = question_all_map[ex_question_id]['selected'] === true;
                        }
                    }
                    question_list_table.bootstrapTable('load', rows);
                }
            });
        }
        question_list_table.bootstrapTable('load', rows);
    });
}

function RoundPscore(score) {
    let num = parseFloat(score);
    if(isNaN(num)) return 0;
    return Math.round(num * 2) / 2;
}

// 页面初始化
$(document).ready(function(){
    InitQuestionSelection();
});

