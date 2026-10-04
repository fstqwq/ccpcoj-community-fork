/**
 * exadmin 题目列表 JavaScript
 * Problem List JavaScript for exadmin module
 */

// 防重复执行检查
if (window.ExadminProblemList && window.ExadminProblemList._initialized) {
    console.warn('ExadminProblemList already initialized, skipping duplicate initialization');
} else {
    // 标记为已初始化
    if (window.ExadminProblemList) {
        window.ExadminProblemList._initialized = true;
    }

window.ExadminProblemList = {
    // 初始化题目列表
    init: function() {
        // 检查是否已经初始化过
        if (this._initExecuted) {
            console.warn('ExadminProblemList.init() already executed, skipping');
            return;
        }
        this._initExecuted = true;

        // 绑定删除按钮事件
        this.bindDeleteButton();
    },

    // 绑定删除按钮事件
    bindDeleteButton: function() {
        $(document).on('click', '.problem-delete-btn', function(e) {
            e.preventDefault();
            e.stopPropagation();
            
            const problemId = $(this).data('problem-id');
            const problemTitle = $(this).data('problem-title') || `题目 #${problemId}`;
            
            alerty.confirm(
                `确定要删除题目吗？<br><br>` +
                `<strong>题目ID：</strong>${problemId}<br>` +
                `<strong>题目标题：</strong>${problemTitle}<br><br>` +
                `<span class="text-danger">注意：只有在该题目没有任何提交记录且未被比赛引用的情况下才能删除。删除后无法恢复！</span>`,
                '确认删除',
                function() {
                    var deleteUrl = (window.PROBLEM_LIST_CONFIG && window.PROBLEM_LIST_CONFIG.deleteAjaxUrl)
                        ? window.PROBLEM_LIST_CONFIG.deleteAjaxUrl
                        : '/exadmin/problem/problem_delete_ajax';
                    if (!deleteUrl) {
                        alerty.error('未配置删除接口地址。', '错误');
                        return;
                    }
                    $.post(deleteUrl, {
                        problem_id: problemId
                    }, function(response) {
                        if (response.code === 1) {
                            // 删除成功，刷新表格
                            const tableId = window.PROBLEM_LIST_CONFIG ? window.PROBLEM_LIST_CONFIG.tableId : 'admin_problemlist_table';
                            $('#' + tableId).bootstrapTable('refresh');
                            alerty.success(response.msg || '删除成功！', '成功');
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
        });
    },

    // 标记为已初始化
    _initialized: true,
    _initExecuted: false
};

// 题目删除 formatter
function FormatterProblemDelete(value, row, index, field) {
    const problemId = row.problem_id;
    const title = (row.title || '').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
    const canDelete = row.can_delete == 1;
    // 转义 HTML 属性中的特殊字符：双引号、单引号、反引号
    const deleteReason = (row.delete_reason || '')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;')
        .replace(/`/g, '&#96;');
    
    if (!canDelete) {
        // 不能删除：显示灰色 outline 图标
        // 注意：Bootstrap 5 的 tooltip 在 disabled 元素上不会显示
        // 因此将 tooltip 绑定到包装容器上
        const defaultReason = '该题目有提交记录或已被比赛引用，无法删除';
        const tooltipText = deleteReason || defaultReason;
        return '<span class="d-inline-block" ' +
                    'title="' + tooltipText + '" ' +
                    'style="cursor: not-allowed;">' +
                    '<span class="btn btn-sm btn-outline-secondary disabled" style="pointer-events: none;">' +
                        '<i class="bi bi-trash"></i>' +
                    '</span>' +
                '</span>';
    }
    
    // 可以删除：显示红色删除按钮
    const defaultDeleteText = '删除 (Delete)';
    const tooltipText = deleteReason || defaultDeleteText;
    return '<button type="button" class="btn btn-danger btn-sm problem-delete-btn" ' +
                'data-problem-id="' + problemId + '" ' +
                'data-problem-title="' + title + '" ' +
                'title="' + tooltipText + '">' +
                '<i class="bi bi-trash"></i>' +
            '</button>';
}

// 将函数暴露到全局作用域
window.FormatterProblemDelete = FormatterProblemDelete;

// 页面加载完成后自动初始化
document.addEventListener('DOMContentLoaded', function() {
    var path = window.location.pathname || '';
    // 仅题目管理首页需要绑定删除（避免比赛题目选择器等复用列表页的误初始化）
    if (path.includes('/exadmin/problem/index') || path.includes('/admin/problem/index')) {
        if (window.ExadminProblemList && !window.ExadminProblemList._initExecuted) {
            window.ExadminProblemList.init();
        }
    }
});

} // 结束防重复执行检查的 else 块

