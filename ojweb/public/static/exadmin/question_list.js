/**
 * exadmin 考题列表 JavaScript
 * Question List JavaScript for exadmin module
 */

// 防重复执行检查
if (window.ExadminQuestionList && window.ExadminQuestionList._initialized) {
    console.warn('ExadminQuestionList already initialized, skipping duplicate initialization');
} else {
    // 标记为已初始化
    if (window.ExadminQuestionList) {
        window.ExadminQuestionList._initialized = true;
    }

window.ExadminQuestionList = {
    // 初始化考题列表
    init: function() {
        // 检查是否已经初始化过
        if (this._initExecuted) {
            console.warn('ExadminQuestionList.init() already executed, skipping');
            return;
        }
        this._initExecuted = true;

        this.initQuestionList();
    },

    // 初始化考题列表表格
    initQuestionList: function() {
        // 查询参数处理：使用 makeQueryParams 工厂函数，并添加题型筛选
        window.queryParams = window.makeQueryParams('question', 'question_search_input', function(params) {
            // 处理题型筛选（复选框）
            let pkind_filter = [];
            $(".question_filter_check").each(function(index, elem) {
                if(elem.checked) {
                    pkind_filter.push(parseInt(elem.getAttribute('pkind')));
                }
            });
            // 如果选择了题型，传递数组给后端
            if(pkind_filter.length > 0) {
                params.pkind = pkind_filter;
            }
            return params;
        });

        // 初始化工具栏（服务器端分页）
        initBootstrapTableToolbar({
            tableId: 'question_table',
            prefix: 'question',
            filterSelectors: [], // 题型筛选通过自定义 queryParams 处理，不使用 filterSelectors
            searchInputId: 'question_search_input',
            customQueryParams: null, // 使用全局的 queryParams 函数
            customHandlers: {
                clear: function() {
                    // 清空题型筛选复选框（全部选中）
                    $('.question_filter_check').prop('checked', true);
                    // 清空搜索框
                    $('#question_search_input').val('');
                    // 刷新表格
                    $('#question_table').bootstrapTable('refresh', {pageNumber: 1});
                }
            }
        });

        // 题型筛选按钮事件
        $('#question_filter_all').on('click', function(){
            $(".question_filter_check").prop('checked', true);
            $('#question_table').bootstrapTable('refresh', {pageNumber: 1});
        });

        $('#question_filter_clear').on('click', function(){
            $(".question_filter_check").prop('checked', false);
            $('#question_table').bootstrapTable('refresh', {pageNumber: 1});
        });

        // 题型筛选复选框点击时直接触发筛选
        $('.question_filter_check').on('change', function(){
            $('#question_table').bootstrapTable('refresh', {pageNumber: 1});
        });
    },

    // 标记为已初始化
    _initialized: true,
    _initExecuted: false
};

// ========================================
// 考题列表表格 Formatter 函数
// ========================================

// 考题ID formatter
function FormatterQuestionId(value, row, index, field) {
    return `<a href="/exadmin/question/question_edit?ex_question_id=${value}" class="text-decoration-none">${value}</a>`;
}
const MAX_QUESTION_TITLE_CHAR_NUM = 30;
// 考题标题 formatter - 支持点击预览
function FormatterQuestionTitle(value, row, index, field) {
    if (!value) return '-';
    const ex_question_id = row.ex_question_id;
    const title = value.length > MAX_QUESTION_TITLE_CHAR_NUM ? value.substring(0, MAX_QUESTION_TITLE_CHAR_NUM) + '...' : value;
    // 支持点击预览（复用 examsys 的 show_question 函数）
    // 使用 exadmin 模块的 question_ajax 接口
    const previewUrl = '/exadmin/question/question_ajax';
    // 所有依赖已全局引入，直接使用 show_question
    return `<span class="question_display cursor-pointer text-primary" ex_question_id="${ex_question_id}" data-preview-url="${previewUrl}" style="cursor: pointer; text-decoration: underline;" title="点击预览题目 / Click to preview: ${value.replace(/"/g, '&quot;')}">${title}</span>`;
}

// 考题题型 formatter - 中英双语显示
function FormatterQuestionType(value, row, index, field) {
    // 所有依赖已全局引入，直接使用 question_default
    const pkindTable = question_default.pkind_table;
    const pkindTableCn = question_default.pkind_table_cn;
    
    const cnName = pkindTableCn[value] || '';
    const enName = pkindTable[value] || '';
    
    // 如果有中英文名称，显示中英双语
    if (cnName && enName) {
        return `<span class="cn-text">${cnName}</span><span class="en-text">${enName}</span>`;
    }
    
    // 如果仍然没有找到，使用 question_default 中的默认值
    const defaultName = pkindTable[value] || String(value);
    return `<span class="badge bg-secondary">${defaultName}</span>`;
}

// 题型样式 formatter - 复用 examsys 的 StylePkind
function StyleQuestionType(value, row, index, field) {
    // 所有依赖已全局引入，直接使用 StylePkind
    return StylePkind(value, row, index, field);
}

// 考题作者列：与题目管理列表一致（逗号分隔 + 哈希色标签）
function FormatterQuestionAuthor(value, row, index, field) {
    if (typeof FormatProblemAuthorsHtml === 'function') {
        var h = FormatProblemAuthorsHtml(value);
        if (h) {
            return h;
        }
    }
    if (value == null || String(value).trim() === '') {
        return '<span class="text-muted">-</span>';
    }
    var t = document.createElement('span');
    t.className = 'csg-author-tags-wrap';
    t.textContent = String(value);
    return t.outerHTML;
}

// 考题编辑 formatter
function FormatterQuestionEdit(value, row, index, field) {
    const ex_question_id = row.ex_question_id;
    return `<a href="/exadmin/question/question_edit?ex_question_id=${ex_question_id}" class="btn btn-primary btn-sm" title="编辑 (Edit)">
                <i class="bi bi-pencil-square"></i>
            </a>`;
}

// 考题删除 formatter
function FormatterQuestionDelete(value, row, index, field) {
    const ex_question_id = row.ex_question_id;
    const title = (row.title || '').replace(/"/g, '&quot;');
    return `<button type="button" class="btn btn-danger btn-sm question-delete-btn"
                data-question-id="${ex_question_id}"
                data-question-title="${title}"
                title="删除 (Delete)">
                <i class="bi bi-trash"></i>
            </button>`;
}

// 考题附件 formatter - 管理后台专用（弹出 iframe modal）
function FormatterExQuestionAttach(value, row, index, field) {
    const ex_question_id = row.ex_question_id;
    const title = row && row.title ? String(row.title) : '';
    const shortTitle = title.length > 150 ? (title.substring(0, 150) + '...') : title;
    const modalTitle = `附件管理 - 考题 #${ex_question_id} - ${shortTitle}`;
    return `<button type="button" class="btn btn-sm btn-info"
                data-modal-url="/exadmin/filemanager/filemanager?item=ex_question&id=${ex_question_id}"
                data-modal-title="${modalTitle.replace(/"/g, '&quot;')}"
                title="附件管理 (File Manager)">
                <i class="bi bi-paperclip"></i>
            </button>`;
}

// 标签 formatter - 紧凑布局、小字体
function FormatterQuestionLabel(value, row, index, field) {
    if (!value || value.trim() === '') {
        return '<span class="text-muted small">-</span>';
    }
    // 将标签字符串分割（假设用逗号或分号分隔）
    const labels = String(value).split(/[,;，；]/).map(l => l.trim()).filter(l => l.length > 0);
    if (labels.length === 0) {
        return '<span class="text-muted small">-</span>';
    }
    // 使用小字体、紧凑的 badge 显示
    return labels.map(label => {
        const escapedLabel = label.replace(/"/g, '&quot;').replace(/'/g, '&#039;');
        return `<span class="badge bg-secondary small" style="font-size: 0.7rem; padding: 0.2rem 0.4rem; margin: 0.1rem;" title="${escapedLabel}">${escapedLabel}</span>`;
    }).join(' ');
}

// 删除考题函数
function deleteQuestion(ex_question_id, title) {
    const displayTitle = title || `考题 #${ex_question_id}`;
    
    alerty.confirm(
        `确定要删除考题吗？<br><br>` +
        `<strong>考题ID：</strong>${ex_question_id}<br>` +
        `<strong>考题标题：</strong>${displayTitle}<br><br>` +
        `<span class="text-danger">注意：只有在该考题没有答卷记录且未被考试引用的情况下才能删除。删除后无法恢复！</span>`,
        '确认删除',
        function() {
            // 确认删除，发送 AJAX 请求
            $.post('/exadmin/question/question_delete_ajax', {
                ex_question_id: ex_question_id
            }, function(response) {
                if (response.code === 1) {
                    alerty.success(response.msg || '删除成功！', '成功');
                    $('#question_table').bootstrapTable('refresh');
                } else {
                    alerty.error(response.msg || '删除失败！', '错误');
                }
            }).fail(function(xhr, status, error) {
                alerty.error('网络错误，请稍后重试。', '错误');
            });
        },
        function() {
            // 取消删除
        }
    );
}

// 绑定删除按钮事件（使用事件委托）
$(document).on('click', '.question-delete-btn', function(e) {
    e.preventDefault();
    e.stopPropagation();
    
    const questionId = $(this).data('question-id');
    const questionTitle = $(this).data('question-title') || `考题 #${questionId}`;
    
    deleteQuestion(questionId, questionTitle);
});

// 响应处理函数
function responseHandler(res) {
    // 如果返回的是数组，转换为 bootstrapTable 需要的格式
    if (Array.isArray(res)) {
        return {
            total: res.length,
            rows: res
        };
    }
    // 如果已经是对象格式，直接返回
    if (res && typeof res === 'object' && 'rows' in res) {
        return res;
    }
    // 兼容其他格式
    return {
        total: 0,
        rows: []
    };
}

// 将函数暴露到全局作用域
window.FormatterQuestionId = FormatterQuestionId;
window.FormatterQuestionTitle = FormatterQuestionTitle;
window.FormatterQuestionType = FormatterQuestionType;
window.StyleQuestionType = StyleQuestionType;
window.FormatterQuestionAuthor = FormatterQuestionAuthor;
window.FormatterQuestionLabel = FormatterQuestionLabel;
window.FormatterQuestionEdit = FormatterQuestionEdit;
window.FormatterQuestionDelete = FormatterQuestionDelete;
window.FormatterExQuestionAttach = FormatterExQuestionAttach;
window.deleteQuestion = deleteQuestion;
window.responseHandler = responseHandler;

// 标题点击预览事件处理（在表格渲染后绑定）
function bindQuestionTitlePreview() {
    // 使用事件委托处理动态添加的元素
    // 注意：使用命名空间事件，避免与 question_default.js 中的事件冲突
    $(document).off('click.question_list', '.question_display[data-preview-url]').on('click.question_list', '.question_display[data-preview-url]', function(e) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation(); // 阻止同一元素上的其他事件处理器
        const ex_question_id = $(this).attr('ex_question_id');
        const previewUrl = $(this).attr('data-preview-url') || '/exadmin/question/question_ajax';
        // 所有依赖已全局引入，直接使用
        show_question(ex_question_id, previewUrl);
    });
}

// 页面加载完成后自动初始化
document.addEventListener('DOMContentLoaded', function() {
    // 检查是否在考题列表页面
    if (window.location.pathname.includes('/exadmin/question/question_list')) {
        if (window.ExadminQuestionList && !window.ExadminQuestionList._initExecuted) {
            window.ExadminQuestionList.init();
        }
        // 绑定标题预览事件
        bindQuestionTitlePreview();
        
        // 表格刷新后重新绑定事件
        $('#question_table').on('post-body.bs.table', function() {
            bindQuestionTitlePreview();
        });
    }
});

} // 结束防重复执行检查的 else 块

