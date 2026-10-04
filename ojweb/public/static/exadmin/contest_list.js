/**
 * exadmin 考试列表 JavaScript
 * Contest List JavaScript for exadmin module
 */

// 防重复执行检查
if (window.ExadminContestList && window.ExadminContestList._initialized) {
    console.warn('ExadminContestList already initialized, skipping duplicate initialization');
} else {
    // 标记为已初始化
    if (window.ExadminContestList) {
        window.ExadminContestList._initialized = true;
    }

window.ExadminContestList = {
    // 初始化考试列表
    init: function() {
        // 检查是否已经初始化过
        if (this._initExecuted) {
            console.warn('ExadminContestList.init() already executed, skipping');
            return;
        }
        this._initExecuted = true;

        this.initContestList();
    },

    // 初始化考试列表表格
    initContestList: function() {
        // 初始化工具栏（客户端分页）
        initBootstrapTableClientToolbar({
            tableId: 'contest_table',
            prefix: 'contest',
            filterSelectors: [],
            searchInputId: 'contest_search_input',
            searchFields: {
                title: 'title',
                contest_id: 'contest_id'
            }
        });
        
        // 绑定删除按钮事件
        this.bindDeleteButton();
    },
    
    // 绑定删除按钮事件
    bindDeleteButton: function() {
        $(document).on('click', '.exam-delete-btn', function(e) {
            e.preventDefault();
            e.stopPropagation();
            
            const contestId = $(this).data('contest-id');
            const contestTitle = $(this).data('contest-title') || `考试 #${contestId}`;
            
            alerty.confirm(
                `确定要删除考试吗？<br><br>` +
                `<strong>考试ID：</strong>${contestId}<br>` +
                `<strong>考试标题：</strong>${contestTitle}<br><br>` +
                `<span class="text-danger">注意：只有在该考试没有任何提交记录、考生账号和答卷的情况下才能删除。删除后无法恢复！</span>`,
                '确认删除',
                function() {
                    // 确认删除，发送 AJAX 请求
                    $.post('/exadmin/exam/contest_delete_ajax', {
                        contest_id: contestId
                    }, function(response) {
                        if (response.code === 1) {
                            // 删除成功，直接从表格中移除该行
                            $('#contest_table').bootstrapTable('remove', {
                                field: 'contest_id',
                                values: [contestId]
                            });
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

// 页面加载完成后自动初始化
document.addEventListener('DOMContentLoaded', function() {
    // 检查是否在考试列表页面
    if (window.location.pathname.includes('/exadmin/exam/contest_list')) {
        if (window.ExadminContestList && !window.ExadminContestList._initExecuted) {
            window.ExadminContestList.init();
        }
    }
});

} // 结束防重复执行检查的 else 块

