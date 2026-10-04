<div class="page-title-container">
    <h1 class="page-title">班级管理<span class="en-text">Class Management</span></h1>
    <div class="page-title-actions">
        <?php
            // 配置参数，传递给 include 的模板
            // 注意：PrivCourse('admin') 已包含 super 权限的检查
            // 对于 super_admin，即使没有选择课程也应该显示编辑列
            $now_course_key = isset($NOW_COURSE_KEY) ? $NOW_COURSE_KEY : null;
            $clss_list_show_modify = IsAdmin() || ($now_course_key && PrivCourse('admin', $now_course_key));
            $clss_list_show_delete = $now_course_key && PrivCourse('super', $now_course_key);
            $clss_list_show_archive = true; // 班级归档列（班级教师/管理员可操作）
            $clss_list_table_id = 'clss_list_table';
            $clss_list_page_size = 50;
            $clss_list_page_list = '[15, 50, 100, 200]';
            $clss_list_search = false; // 使用工具栏筛选，不使用内置搜索
            $clss_list_side_pagination = 'server'; // 使用服务器端分页以支持筛选
            $clss_list_table_classes = 'table table-borderless table-hover table-striped';
            $clss_list_thead_classes = 'table-light';
            $clss_list_toolbar_id = 'clss_toolbar';
            $clss_list_query_params = 'queryParamsClss';
            $clss_list_response_handler = 'clssResponseHandler'; // 处理 ThinkPHP success 格式的响应
            $clss_list_no_clss_js = true; // exadmin 使用自己的 clss.js
            $clss_list_show_checkbox = $clss_list_show_delete; // 有删除权限时显示 checkbox
            $clss_table_show_modify = $clss_list_show_modify; // 传递编辑列显示标志
            $clss_table_show_archive = $clss_list_show_archive; // 传递归档列显示标志
        ?>
        <!-- 参考 userrank：把筛选组件放到标题栏右侧；data-toolbar 使用隐藏空容器，避免 bootstrap-table 挪动 DOM -->
        <div class="d-flex align-items-center gap-2 flex-wrap" role="form">
            <button id="clss_refresh" type="button" class="btn btn-outline-secondary toolbar-btn" title="刷新 (Refresh)">
                <i class="bi bi-arrow-clockwise"></i>
            </button>
            <button id="clss_clear" type="button" class="btn btn-outline-secondary toolbar-btn" title="清空筛选条件 (Clear)">
                <i class="bi bi-eraser"></i>
            </button>
            <div class="toolbar-group">
                <input id="clss_id_input" name="clss_id" class="form-control toolbar-input clss_filter" type="text" placeholder="班级ID" title="班级ID (Class ID)">
            </div>
            <div class="toolbar-group">
                <input id="clss_title_input" name="clss_title" class="form-control toolbar-input clss_filter" type="text" placeholder="班级名称" title="班级名称 (Class Name)">
            </div>
            <div class="toolbar-group">
                <input id="clss_year_input" name="clss_year" class="form-control toolbar-input clss_filter" type="number" placeholder="年级" title="年级 (Year)">
            </div>
            <div class="toolbar-group">
                <input id="clss_semester_input" name="clss_semester" class="form-control toolbar-input clss_filter" type="text" placeholder="学期" title="学期 (Semester, 格式: 2023-2024-1)" pattern="\d{4}-\d{4}-\d">
            </div>
            <div class="toolbar-group">
                <input id="clss_teacher_input" name="teacher" class="form-control toolbar-input clss_filter" type="text" placeholder="教师(工号/姓名，逗号OR)" title="教师(工号/昵称，逗号分隔 OR)">
            </div>
            {if $clss_list_show_delete}
            <div class="toolbar-group">
                <button id="clss_export_btn" type="button" class="btn btn-outline-success btn-sm toolbar-btn" title="导出选中班级数据 (Export Selected Classes Data)">
                    <i class="bi bi-download"></i>
                </button>
            </div>
            <div class="toolbar-group">
                <button id="clss_batch_delete_btn" type="button" class="btn btn-outline-danger btn-sm toolbar-btn" title="批量删除选中班级 (Batch Delete Selected Classes)" disabled>
                    <i class="bi bi-trash"></i>
                </button>
            </div>
            {/if}
        </div>
    </div>
</div>

<!-- 空工具栏容器：仅用于 bootstrap-table 配置 data-toolbar，避免报错/避免挪动标题栏控件 -->
<div id="clss_toolbar" class="table-toolbar" style="display: none;"></div>

{include file="../../expsys/view/clss/clss_list" /}

{include file="../../exadmin/view/clss/clss_modify" /}

{include file="../../csgoj/view/public/base_select" /}

{include file="../../csgoj/view/public/js_exceljs" /}
{js href="__STATIC__/js/overlay.js" /}
{js href="__STATIC__/exadmin/clss.js" /}
{css href="__STATIC__/exadmin/clss.css" /}
{css href="__STATIC__/css/bilingual.css" /}
{js href="__STATIC__/js/bilingual.js" /}
{js href="__STATIC__/csgoj/general_formatter.js" /}

<script>
let page_module = '<?php echo $module; ?>';
let page_controller = '<?php echo $controller; ?>';

// queryParams 函数：将筛选条件传递给后端
// 参考 status 页面的实现：优先从筛选组件本身读取值，其次从 anchor 读取值
window.queryParamsClss = function(params) {
    // 优先从筛选组件本身读取值，其次从 anchor 读取值
    // 这确保了实时筛选功能，即使 anchor 还未更新
    const prefix = 'clss';
            const filterNames = ['clss_id', 'clss_title', 'clss_year', 'clss_semester', 'teacher'];

    filterNames.forEach(name => {
        let value = null;

        // 首先尝试从筛选组件本身读取值（包括 csg-select-input）
        const $filterElement = $(`select[name="${name}"], input[name="${name}"]`);
        if ($filterElement.length > 0) {
            value = $filterElement.val();
            // 如果值是默认值（空或 -1），则不传递
            if (value === '' || value === '-1' || value === null) {
                value = null;
            }
        }

        // 如果从筛选组件没获取到值，尝试从 anchor 读取
        if (value === null) {
            const anchorKey = `${prefix}_${name}`;
            const anchorVal = csg.GetAnchor(anchorKey);
            if (anchorVal != null && anchorVal !== '' && anchorVal !== '-1') {
                value = anchorVal;
            }
        }

        // 只传递有效的值给后端
        if (value !== null) {
            params[name] = value;
        }
    });

    return params;
};

// FormatterIdx - 序号格式化（exadmin 专用）
function FormatterIdx(value, row, index, field) {
    return index + 1;
}

// FormatterExpSemester 和 FormatterExpClssTeachers 已在 contest_filter.js 中定义，直接使用

// 覆盖 FormatterExpClssTitle：exadmin 中点击班级名称跳转到 expsys 的学生列表页面，并显示"我的"标记
function FormatterExpClssTitle(value, row, index, field) {
    if (!value) return '';
    
    // 使用全局 DomSantize 函数（来自 global.js）
    const title = DomSantize(value);
    
    // 判断是否是"我的"班级：检查当前用户是否是班级教师
    const nowUserId = window.NOW_USER_ID || '';
    let isMine = false;
    
    // 检查 row.is_mine 字段（如果后端返回了）
    if (row.is_mine === 1 || row.is_mine === "1" || row.is_mine === true) {
        isMine = true;
    } else if (row.teachers && Array.isArray(row.teachers)) {
        // 检查 teachers 数组中是否包含当前用户
        isMine = row.teachers.some(t => {
            const userId = (t && t.user_id) ? t.user_id : (typeof t === 'string' ? t : null);
            return userId === nowUserId;
        });
    }
    
    // 构建"我的"标记
    const mineBadge = isMine 
        ? `<span class="badge bg-warning text-dark ms-2">我的<span class="en-text">Mine</span></span>`
        : '';
    
    // exadmin 中总是跳转到 expsys 的学生列表页面
    if (row.clss_id) {
        return `<div class="d-flex align-items-center flex-wrap"><a href="/expsys/clss/stu?clss_id=${row.clss_id}" class="clss_title" title="${title}">${title}</a>${mineBadge}</div>`;
    }
    return `<div class="d-flex align-items-center flex-wrap"><span class="clss_title" title="${title}">${title}</span>${mineBadge}</div>`;
}

function FormatterClssModify(value, row, index, field) {
    return `<button class="btn btn-sm btn-outline-primary modify_button" data-clss-id="${row.clss_id}" title="修改班级信息 / Modify Class Information">
        <i class="bi bi-pencil-square"></i>
    </button>`;
}

function FormatterClssDelete(value, row, index, field) {
    return `<button class="btn btn-sm btn-outline-danger delete_button" data-clss-id="${row.clss_id}" title="双击删除 / Double Click to Delete">
        <i class="bi bi-trash"></i>
    </button>`;
}

function FormatterClssArchive(value, row, index, field) {
    // 允许归档：课程管理员/全局管理员/班级教师
    const nowUserId = window.NOW_USER_ID || '';
    const isCourseAdmin = !!window.IS_COURSE_ADMIN;
    const isGlobalAdmin = !!window.IS_GLOBAL_ADMIN;
    const isTeacher = Array.isArray(row.teachers) && row.teachers.some(t => (t && t.user_id) ? (t.user_id === nowUserId) : false);
    const canArchive = isCourseAdmin || isGlobalAdmin || isTeacher;

    if(!canArchive) return '-';
    return `<button class="btn btn-sm btn-outline-primary clss_archive_btn" data-clss-id="${row.clss_id}" title="归档该班级全部公开练习 / Archive all public contests of this class">
        <i class="bi bi-archive"></i>
    </button>`;
}

// 响应处理函数：处理 ThinkPHP 的 success 格式
function clssResponseHandler(res) {
    // ThinkPHP 的 success 方法返回格式：{code: 1, msg: "ok", data: {total, rows}}
    if (res && typeof res === 'object' && res.code == 1 && res.data) {
        // 提取 data 字段
        return res.data;
    }
    // 如果已经是正确的格式，直接返回
    if (res && typeof res === 'object' && 'rows' in res) {
        return res;
    }
    // 兼容数组格式
    if (Array.isArray(res)) {
        return {
            total: res.length,
            rows: res
        };
    }
    // 默认返回空数据
    return {
        total: 0,
        rows: []
    };
}

// 初始化工具栏和筛选功能
$(function() {
    window.NOW_USER_ID = "<?php echo session('user_id'); ?>";
    // 注意：PrivCourse('admin') 已包含 super 权限的检查
    window.IS_COURSE_ADMIN = <?php 
        $now_course_key = isset($NOW_COURSE_KEY) ? $NOW_COURSE_KEY : null;
        echo (IsAdmin() || ($now_course_key && PrivCourse('admin', $now_course_key))) ? 'true' : 'false'; 
    ?>;
    window.IS_GLOBAL_ADMIN = <?php echo IsAdmin('administrator') ? 'true' : 'false'; ?>;

    // 初始化 Bootstrap Table 工具栏
    initBootstrapTableToolbar({
        tableId: 'clss_list_table',
        prefix: 'clss',
        filterSelectors: ['clss_id', 'clss_title', 'clss_year', 'clss_semester', 'teacher'],
        searchInputId: null,
        customQueryParams: window.queryParamsClss,
        customHandlers: {
            clear: function() {
                // 清空所有筛选组件和anchor（确保绝对同步）
                const prefix = 'clss';
                $('.clss_filter').each(function() {
                    const $elem = $(this);
                    const name = $elem.attr('name');
                    if (!name) return;
                    
                    // 标记为正在清空，避免触发 anchor 更新事件
                    $elem.data('initializing-from-anchor', true);
                    
                    // 清空筛选组件值
                    if ($elem.is('input')) {
                        $elem.val('');
                    } else {
                        // 对于 select，需要触发 change 事件以同步 csg-select 的显示
                        if ($elem[0]) {
                            $elem[0].value = '-1';
                            // 触发 change 事件，让 csg-select 同步更新显示
                            const changeEvent = new Event('change', { bubbles: true, cancelable: true });
                            $elem[0].dispatchEvent(changeEvent);
                        } else {
                            $elem.val('-1').trigger('change');
                        }
                    }
                    
                    // 清空anchor（使用带namespace的anchor参数名）
                    const anchorKey = `${prefix}_${name}`;
                    const anchorVal = csg.GetAnchor(anchorKey);
                    if (anchorVal !== null && anchorVal !== '') {
                        csg.SetAnchor(null, anchorKey);
                    }
                    
                    // 延迟清除标记
                    setTimeout(function() {
                        $elem.removeData('initializing-from-anchor');
                    }, 100);
                });

                // 使用 Bootstrap Table 的 refresh 方法
                $('#clss_list_table').bootstrapTable('refresh', {pageNumber: 1});
            },
            refresh: function() {
                // 直接刷新表格，queryParams 会自动读取最新的 filter 值
                $('#clss_list_table').bootstrapTable('refresh');
            }
        },
        enableAnchorSync: true
    });
    
    // 监听行选择变化，更新批量删除按钮状态
    $('#clss_list_table').on('check.bs.table uncheck.bs.table check-all.bs.table uncheck-all.bs.table', function() {
        const selectedRows = $('#clss_list_table').bootstrapTable('getSelections');
        const hasSelection = selectedRows.length > 0;
        $('#clss_batch_delete_btn').prop('disabled', !hasSelection);
    });
    
    // 导出按钮事件
    $('#clss_export_btn').on('click', function() {
        const selectedRows = $('#clss_list_table').bootstrapTable('getSelections');
        if (selectedRows.length === 0) {
            window.alerty.warn('请先选择要导出的班级', 'Please select classes to export');
            return;
        }
        ClssExportBatchModifyTemplate(selectedRows);
    });
    
    // 批量删除按钮事件
    $('#clss_batch_delete_btn').on('click', function() {
        const selectedRows = $('#clss_list_table').bootstrapTable('getSelections');
        if (selectedRows.length === 0) {
            window.alerty.warn('请先选择要删除的班级', 'Please select classes to delete');
            return;
        }
        ClssBatchDelete(selectedRows);
    });
    
    // 双击删除功能
    $('#clss_list_table').on('dbl-click-cell.bs.table', function(e, field, value, row, $element){
        if(field == 'delete') {
            ClssDelete(row.clss_id);
        }
    });
    
    // 单击修改按钮
    $(document).on('click', '.modify_button', function() {
        let clss_id = $(this).data('clss-id');
        ClssOpenModifyModal(clss_id);
    });
    
    // 绑定修改表单提交
    $(document).on('click', '#clss_modify_submit_button', function() {
        const form = document.querySelector("#clss_modify_form");
        if (form) {
            // 简单验证
            const clss_title = $("#clss_modify_title").val().trim();
            const clss_semester = $("#clss_modify_semester").val().trim();
            
            if (!clss_title) {
                window.alerty.error("班级名称不能为空", "Class name cannot be empty");
                return;
            }
            
            if (!clss_semester || !/^\d{4}-\d{4}-\d$/.test(clss_semester)) {
                window.alerty.error("学期格式不正确", "Semester format is incorrect");
                return;
            }
            
            // 提交表单
            const submitButton = $(this);
            submitButton.prop("disabled", true);
            submitButton.html('<span class="spinner-border spinner-border-sm me-2"></span>提交中...');
            
            $.ajax({
                url: $("#clss_modify_form").attr("action"),
                type: "POST",
                data: $("#clss_modify_form").serialize(),
                success: function(ret) {
                    if (ret.code == 1) {
                        // 关闭Modal
                        const modal = bootstrap.Modal.getInstance(document.getElementById("clssModifyModal"));
                        if (modal) {
                            modal.hide();
                        }
                        
                        // 刷新表格
                        $('#clss_list_table').bootstrapTable('refresh');
                        
                        window.alerty.success("修改成功", "Modified successfully");
                    } else {
                        window.alerty.error(ret.msg || "修改失败", "Modify failed");
                    }
                    
                    // 恢复按钮状态
                    submitButton.prop("disabled", false);
                    submitButton.html('<span class="cn-text"><i class="bi bi-check-circle me-2"></i>提交修改</span><span class="en-text">Submit Changes</span>');
                },
                error: function() {
                    window.alerty.error("网络错误，请重试", "Network error, please try again");
                    submitButton.prop("disabled", false);
                    submitButton.html('<span class="cn-text"><i class="bi bi-check-circle me-2"></i>提交修改</span><span class="en-text">Submit Changes</span>');
                }
            });
        }
    });
    
    // Modal关闭时清理表单
    $('#clssModifyModal').on('hidden.bs.modal', function () {
        $("#clss_modify_form")[0].reset();
        $("#clss_modify_header_clss_id").html("");
    });
    
    // 单击删除按钮（显示提示）
    $(document).on('click', '.delete_button', function() {
        let clss_id = $(this).data('clss-id');
        if(!window.clss_delete_infoed) {
            window.alerty.info('请双击删除按钮以删除班级', 'Please double-click the delete button to delete the class');
            window.clss_delete_infoed = true;
        }
    });

    // 班级归档（事件代理）
    $('#clss_list_table').on('click', '.clss_archive_btn', function() {
        const clssId = parseInt($(this).attr('data-clss-id'), 10);
        if(!clssId) return;
        const row = $('#clss_list_table').bootstrapTable('getRowByUniqueId', clssId);
        if(!row) return;

        async function downloadByUrl(url) {
            if(!url) {
                alerty.error('下载地址为空', 'Download url is empty');
                throw new Error('Download url is empty');
            }
            // 从 url 中尽量解析文件名（/exadmin/contestsummary/download?file=xxx.zip）
            let filename = 'archive.zip';
            try {
                const u = new URL(url, window.location.origin);
                const f = u.searchParams.get('file');
                if (f) filename = decodeURIComponent(f);
            } catch (e) {}

            try {
                // 更新 overlay：正在下载
                updateOverlay({
                    message: '正在下载归档文件...',
                    message_en: 'Downloading archive file...',
                    type: 'text'
                }, 90);
                
                const resp = await fetch(url, { method: 'GET', credentials: 'same-origin' });
                if(!resp.ok) {
                    throw new Error(`HTTP ${resp.status}`);
                }
                const blob = await resp.blob();
                if(!blob || blob.size <= 0) {
                    throw new Error('Empty file');
                }
                
                // 更新 overlay：下载完成
                updateOverlay({
                    message: '下载完成',
                    message_en: 'Download completed',
                    type: 'text'
                }, 100);
                
                const blobUrl = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = blobUrl;
                a.download = filename;
                document.body.appendChild(a);
                a.click();
                a.remove();
                setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
            } catch (err) {
                alerty.error(`下载失败：${err?.message || err}`, 'Download failed');
                throw err; // 重新抛出错误，让调用者处理
            }
        }

        alerty.confirm({
            title: '确认归档<span class="en-text">Confirm</span>',
            message: `将归档该班级的公开练习（仅公开且"可用/可进入"状态，Available）。<br/><strong>${row.clss_title || ''}</strong>（ID: ${clssId}）`,
            message_en: `Archive public contests of this class (only public & "Available" status).<br/><strong>${row.clss_title || ''}</strong> (ID: ${clssId})`,
            callback: function() {
                // 显示 overlay：开始归档流程
                showOverlay({
                    message: '正在获取练习列表...',
                    message_en: 'Fetching contest list...',
                    type: 'text'
                });
                
                // 1) 拉取该班级公开练习列表
                $.get('/exadmin/contest/contest_list_ajax', {clss_id: clssId, defunct: 0}, function(ret) {
                    // contest_list_ajax 可能直接返回对象 {contest_list,...}，也可能是 ThinkPHP success 格式
                    let contestList = null;
                    if(ret && ret.code == 1 && ret.data && Array.isArray(ret.data.contest_list)) {
                        contestList = ret.data.contest_list;
                    } else if(ret && Array.isArray(ret.contest_list)) {
                        contestList = ret.contest_list;
                    }
                    if(!contestList) {
                        hideOverlay();
                        alerty.error(ret && ret.msg ? ret.msg : '获取练习列表失败');
                        return;
                    }

                    const ids = contestList.map(c => c && c.contest_id).filter(Boolean);
                    if(ids.length === 0) {
                        hideOverlay();
                        alerty.warn('该班级暂无可归档练习');
                        return;
                    }

                    // 更新 overlay：提交归档请求
                    updateOverlay({
                        message: `正在提交归档请求（${ids.length} 个练习）...`,
                        message_en: `Submitting archive request (${ids.length} contests)...`,
                        type: 'text'
                    }, 30);

                    // 2) 提交归档（复用自由归档接口）
                    $.post('/exadmin/contestsummary/contest_summary_ajax', {
                        cid_list: ids.join('\n'),
                        task_name_prefix: `class${clssId}`
                    }, function(ret2) {
                        if(ret2 && ret2.code == 1) {
                            // 更新 overlay：准备下载
                            updateOverlay({
                                message: '正在准备下载归档文件...',
                                message_en: 'Preparing archive file download...',
                                type: 'text'
                            }, 80);
                            
                            // 不跳转页面：由前端拉取文件并触发下载
                            downloadByUrl(ret2.url).then(() => {
                                // 下载完成后隐藏 overlay
                                hideOverlay();
                            }).catch((err) => {
                                hideOverlay();
                                // downloadByUrl 内部已经显示错误，这里不需要重复
                            });
                        } else {
                            hideOverlay();
                            alerty.error(ret2 && ret2.msg ? ret2.msg : '归档失败');
                        }
                    }, 'json').fail(function(xhr, status, error) {
                        hideOverlay();
                        alerty.error('归档请求失败：' + (error || status), 'Archive request failed');
                    });
                }, 'json').fail(function(xhr, status, error) {
                    hideOverlay();
                    alerty.error('获取练习列表失败：' + (error || status), 'Failed to fetch contest list');
                });
            }
        });
    });
});
</script>
