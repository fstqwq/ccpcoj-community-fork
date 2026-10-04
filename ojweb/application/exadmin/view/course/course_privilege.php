<div class="admin-page-header">
    <div class="admin-page-header-left">
        <div class="admin-page-header-icon">
            <i class="bi bi-people"></i>
        </div>
        <h1 class="admin-page-header-title">
            <div class="admin-page-header-title-main">
                课程组教师
            </div>
            <div class="admin-page-header-title-right">
                <a href="/course/index#course={$course['course_key']}" target="_blank" class="admin-page-header-id">
                    <i class="bi bi-hash"></i> {$course['course_key']}
                </a>
                <span class="en-text">Course Group Teachers</span>
            </div>
        </h1>
    </div>
</div>

  <div class="container">
     {/* course_admin 也允许管理教师（teacher）；admin/super 的增删由后端再校验 */}
    {/* 注意：PrivCourse('admin') 已包含 super 权限的检查 */}
    {if PrivCourse('admin', $course['course_key']) || IsAdmin()}
    <form id="privilege_add_form" method='post' action="/{$module}/course/course_privilege_add_ajax">
        <!-- 权限数据存储 -->
        <input type="hidden" id="privilege_data" value='{$priv_list_ui|json_encode}'>
        <input type="hidden" name="key" value="{$course['course_key']}">
        
        <div class="row g-4">
            <!-- 用户ID输入区域 -->
            <div class="col-lg-4">
                <div class="card h-100">
                    <div class="card-header bg-light">
                        <h4 class="mb-0">用户信息<span class="en-text text-muted fs-6">User Information</span></h4>
                    </div>
                    <div class="card-body">
                        <div class="mb-3">
                            <label for="user_id" class="form-label">用户ID<span class="en-text text-muted d-block">User ID</span></label>
                            <input type="text" class="form-control" name="user_id" placeholder="输入用户ID / Enter User ID">
                        </div>
                        
                        <!-- 提交按钮 -->
                        <div class="d-grid">
                            <button type="submit" id="submit_button" class="btn btn-primary">
                                <span><i class="bi bi-plus-circle me-2"></i>添加权限</span>
                                <span class="en-text">Add Privilege</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- 权限选择区域 -->
            <div class="col-lg-8">
                <div class="card h-100">
                    <div class="card-header bg-light">
                        <div class="d-flex justify-content-between align-items-center">
                            <h4 class="mb-0">权限类型<span class="en-text text-muted fs-6">Privilege Types</span></h4>
                            <!-- 快速选择按钮 -->
                            <div class="btn-group privilege-quick-buttons" role="group">
                                <button type="button" class="btn btn-outline-primary btn-sm" id="check_priv_all" title="全选">
                                    <span><i class="bi bi-check-all"></i> 全选</span><span class="en-text">All</span>
                                </button>
                                <button type="button" class="btn btn-outline-success btn-sm" id="check_priv_non" title="清空">
                                    <span><i class="bi bi-x-square"></i> 清空</span><span class="en-text">None</span>
                                </button>
                                <button type="button" class="btn btn-outline-warning btn-sm" id="check_priv_rev" title="反选">
                                    <span><i class="bi bi-arrow-repeat"></i> 反选</span><span class="en-text">Reverse</span>
                                </button>
                            </div>
                        </div>
                    </div>
                    <div class="card-body" id="privilege_selection_area">
                        <!-- 权限选择区域将由JavaScript动态生成 -->
                    </div>
                </div>
            </div>
        </div>
    </form>
    {/if}
    
    <div id="privilege_toolbar" class="table-toolbar">
        <div class="d-flex align-items-center gap-2" role="form">
            <button id="privilege_refresh" type="submit" class="btn btn-outline-secondary toolbar-btn" title="刷新 (Refresh)">
                <i class="bi bi-arrow-clockwise"></i>
            </button>
            <button id="privilege_clear" type="submit" class="btn btn-outline-secondary toolbar-btn" title="清空筛选条件 (Clear)">
                <i class="bi bi-eraser"></i>
            </button>
            <div class="toolbar-group">
                <span class="toolbar-label-inline"><span>权限类型</span><span class="toolbar-label en-text">Privilege Type</span></span>
                <select id="privilege_type_filter" class="form-select toolbar-select" style="width: 180px;">
                    <option value="">全部权限</option>
                </select>
            </div>
            <div class="toolbar-group">
                <span class="toolbar-label-inline"><span>搜索</span><span class="toolbar-label en-text">Search</span></span>
                <input id="privilege_search_input" name="search" class="form-control toolbar-input privilege_filter" type="text" placeholder="用户ID/权限" style="width: 200px;">
            </div>
            <button id="privilege_export_excel" type="button" class="btn btn-outline-success toolbar-btn" title="导出Excel / Export Excel">
                <i class="bi bi-file-earmark-excel"></i>
            </button>
        </div>
    </div>
    
    <table
        class="bootstraptable_refresh_local"
        id="privilege_edit_table"
        data-toggle="table"
        data-url="/{$module}/course/course_privilege_list_ajax?key={$course['course_key']}"
        data-pagination="true"
        data-page-list="[15,50,100]"
        data-page-size="15"
        data-side-pagination="client"
        data-method="get"
        data-search="false"
        data-pagination-v-align="both"
        data-pagination-h-align="left"
        data-pagination-detail-h-align="right"
        data-toolbar="#privilege_toolbar"
        data-sortable="false"
        data-unique-id="privilege_id"
        data-classes="table table-hover table-striped"
    >
        <thead>
        <tr>
            <th data-field="serial" data-align="center" data-valign="middle" data-width="55" data-formatter="FormatterIndex">#<span class="en-text">#</span></th>
            <th data-field="user_id" data-align="left" data-valign="middle" data-width="180" data-formatter="FormatterUserId">用户信息<span class="en-text">User Info</span></th>
            <th data-field="pvrole" data-align="left" data-valign="middle" data-width="150" data-formatter="FormatterPrivilege">权限<span class="en-text">Privilege</span></th>
            {/* course_admin 可以删除 teacher；course_super/全局管理员可删更多，由后端校验 */}
            {/* 注意：PrivCourse('admin') 已包含 super 权限的检查 */}
    {if PrivCourse('admin', $course['course_key']) || IsAdmin()}
            <th data-field="delete" data-align="center" data-valign="middle" data-width="80" data-formatter="FormatterDelete">删除<span class="en-text">Delete</span></th>
            {/if}
        </tr>
        </thead>
    </table>
</div>

{include file="../../csgoj/view/public/js_exceljs" /}

<script type="text/javascript">
    var table = $('#privilege_edit_table');
    var page_module = '<?php echo $module; ?>';
    
    // Formatter函数
    function FormatterIndex(value, row, index, field) {
        return index + 1;
    }
    
    function FormatterUserId(value, row, index, field) {
        if (!value) return '-';
        let html = `<div class="d-flex flex-column">`;
        // exadmin 模块没有 User 控制器；用户信息统一跳转到前台用户模块（csgoj/user/userinfo）
        html += `<a href='/csgoj/user/userinfo?user_id=${value}' target='_blank' class="text-decoration-none fw-semibold">${value}</a>`;
        if (row.nick || row.school) {
            html += `<div class="mt-1">`;
            if (row.nick) {
                html += `<small class="text-muted d-block">${row.nick}</small>`;
            }
            if (row.school) {
                html += `<small class="text-secondary d-block"><i class="bi bi-building"></i> ${row.school}</small>`;
            }
            html += `</div>`;
        }
        html += `</div>`;
        return html;
    }
    
    function FormatterPrivilege(value, row, index, field) {
        // 从权限数据中获取显示信息
        const privilegeData = JSON.parse($('#privilege_data').val() || '{}');
        if (privilegeData[value]) {
            const privilegeName = privilegeData[value];
            // 解析权限名称，提取中文和英文描述
            let displayText = privilegeName;
            if (value === 'super') {
                displayText = '<span class="cn-text">超级管理员</span><span class="en-text text-muted">Super Admin</span>';
            } else if (value === 'admin') {
                displayText = '<span class="cn-text">普通管理员</span><span class="en-text text-muted">Admin</span>';
            } else if (value === 'teacher') {
                displayText = '<span class="cn-text">教师</span><span class="en-text text-muted">Teacher</span>';
            }
            return displayText;
        }
        return value || '-';
    }
    
    function FormatterDelete(value, row, index, field) {
        // PrivCourse 是后端 PHP 函数，前端不可调用；这里用后端已渲染的权限结果判断
        const isCourseSuper = <?php echo (PrivCourse('super', $course['course_key']) || IsAdmin()) ? 'true' : 'false'; ?>;
        const isCourseAdmin = <?php echo PrivCourse('admin', $course['course_key']) ? 'true' : 'false'; ?>;
        if (isCourseSuper) {
            return `<button class='delete_button btn btn-outline-danger btn-sm' title="双击删除 / Double Click to Delete">
                        <i class="bi bi-trash"></i>
                    </button>`;
        }
        // 课程管理员：仅允许删除 teacher
        if (isCourseAdmin && row && row.pvrole === 'teacher') {
            return `<button class='delete_button btn btn-outline-danger btn-sm' title="双击删除 / Double Click to Delete">
                        <i class="bi bi-trash"></i>
                    </button>`;
        }
        return '-';
    }
    
    // 初始化权限管理工具栏（客户端分页版本）
    initBootstrapTableClientToolbar({
        tableId: 'privilege_edit_table',
        prefix: 'privilege',
        filterSelectors: ['privilege_type_filter'],
        searchInputId: 'privilege_search_input',
        searchFields: {
            user_id: 'user_id',
            pvrole: 'pvrole'
        }
    });
    
    function AddPrivilege(form, enforce=0) {
        // 获取表单序列化数据
        var formDataStr = $(form).serialize();
        // 添加 enforce 参数
        if (formDataStr) {
            formDataStr += '&enforce=' + enforce;
        } else {
            formDataStr = 'enforce=' + enforce;
        }
        
        $.ajax({
            url: $(form).attr('action'),
            type: 'POST',
            data: formDataStr,
            dataType: 'json',
            success: function(ret) {
                if (ret.code == 1) {
                    // 立即刷新表格数据
                    table.bootstrapTable('refresh');
                    // 清空表单
                    $(form)[0].reset();
                    // 显示成功提示
                    alerty.success(ret['msg']);
                    button_delay($('#submit_button'), 3, '添加权限');
                }
                else {
                    if(ret.data == 'nouser') {
                        alerty.confirm({
                            message: "用户不存在，是否强制添加？",
                            message_en: "No such user. Force to add?",
                            callback: function() {
                                AddPrivilege(form, 1);
                            },
                            callbackCancel: function() {
                                alerty.message("操作已取消。", "Nothing Happened.");
                            }
                        });
                    } else {
                        alerty.error(ret.msg);
                    }                    
                }
                return false;
            },
            error: function(xhr, status, error) {
                alerty.error('请求失败：' + error);
            }
        });
    }
    
    // 动态生成权限选择界面
    function generatePrivilegeSelection() {
        const privilegeData = JSON.parse($('#privilege_data').val() || '{}');
        const selectionArea = $('#privilege_selection_area');
        
        let html = '<div class="row g-2">';
        
        // 遍历所有权限
        Object.keys(privilegeData).forEach(privilegeKey => {
            const privilegeName = privilegeData[privilegeKey];
            // 解析权限名称
            let displayName = privilegeName;
            let description = '';
            if (privilegeName.includes('[') && privilegeName.includes(']')) {
                const match = privilegeName.match(/\[([^\]]+)\]\s*(.+)/);
                if (match) {
                    displayName = match[1];
                    description = match[2];
                }
            }
            
            html += `
                <div class="col-md-6">
                    <div class="form-check form-check-sm">
                        <input class="form-check-input privilege_check" type="checkbox" value="${privilegeKey}" id="privilege_${privilegeKey}" name="privilege[]">
                        <label class="form-check-label" for="privilege_${privilegeKey}">
                            <strong>${displayName}</strong>
                            ${description ? `<span class="text-muted d-block small">${description}</span>` : ''}
                        </label>
                    </div>
                </div>
            `;
        });
        
        html += '</div>';
        selectionArea.html(html);
    }
    
    // 动态生成权限类型筛选器
    function generatePrivilegeTypeFilter() {
        const privilegeData = JSON.parse($('#privilege_data').val() || '{}');
        const filterSelect = $('#privilege_type_filter');
        
        // 清空现有选项（保留"全部权限"选项）
        filterSelect.find('option:not(:first)').remove();
        
        // 添加权限类型选项
        Object.keys(privilegeData).forEach(privilegeKey => {
            const privilegeName = privilegeData[privilegeKey];
            let displayName = privilegeName;
            if (privilegeName.includes('[') && privilegeName.includes(']')) {
                const match = privilegeName.match(/\[([^\]]+)\]\s*(.+)/);
                if (match) {
                    displayName = match[1] + ' - ' + match[2];
                }
            }
            filterSelect.append(`
                <option value="${privilegeKey}">${displayName}</option>
            `);
        });
    }
    
    $(document).ready(function() {
        // 生成权限选择界面
        generatePrivilegeSelection();
        
        // 生成权限类型筛选器
        generatePrivilegeTypeFilter();
        
        // 权限类型筛选器事件 - 使用标准筛选
        $('#privilege_type_filter').change(function() {
            const selectedType = $(this).val();
            if (selectedType === '') {
                // 清空筛选
                table.bootstrapTable('filterBy', {});
            } else {
                // 直接筛选pvrole字段
                table.bootstrapTable('filterBy', {
                    pvrole: selectedType
                });
            }
        });
        
        // 快速选择按钮事件
        $('#check_priv_all').click(function() {
            $('.privilege_check').each(function() {
                this.checked = true;
            });
        });
        
        $('#check_priv_non').click(function() {
            $('.privilege_check').each(function() {
                this.checked = false;
            });
        });
        
        $('#check_priv_rev').click(function() {
            $('.privilege_check').each(function() {
                this.checked = !this.checked;
            });
        });
        
        // 使用 form_validate_tip.js 进行表单验证
        FormValidationTip.initFormValidation('#privilege_add_form', {
            user_id: {
                rules: {
                    required: true
                }
            }
        }, function(form) {
            // 提交前对用户ID输入框进行trim处理
            const $userIdInput = $(form).find('input[name="user_id"]');
            $userIdInput.val($userIdInput.val().trim());
            
            // 检查是否至少勾选了一个权限
            const checkedPrivileges = $(form).find('.privilege_check:checked');
            if (checkedPrivileges.length === 0) {
                alerty.error('请至少选择一个权限类型', 'Please select at least one privilege type');
                return false;
            }
            
            AddPrivilege(form, 0);
        });

        // 导出 Excel（工号/姓名/学院）
        $('#privilege_export_excel').on('click', async function() {
            try {
                if (typeof ExcelJS === 'undefined') {
                    alerty.error('缺少 ExcelJS 依赖，请刷新页面重试', 'ExcelJS is not loaded. Please refresh and try again.');
                    return;
                }
                const rows = table.bootstrapTable('getData', { includeHiddenRows: true }) || [];
                // 去重：按 user_id 聚合（同一用户可能有多条权限）
                const map = {};
                rows.forEach(r => {
                    const uid = (r && r.user_id != null) ? String(r.user_id).trim() : '';
                    if (!uid) return;
                    if (!map[uid]) {
                        map[uid] = {
                            user_id: uid,
                            nick: (r.nick != null) ? String(r.nick) : '',
                            school: (r.school != null) ? String(r.school) : '',
                        };
                    } else {
                        // 补齐缺失信息
                        if (!map[uid].nick && r.nick) map[uid].nick = String(r.nick);
                        if (!map[uid].school && r.school) map[uid].school = String(r.school);
                    }
                });
                const data = Object.values(map).sort((a, b) => a.user_id.localeCompare(b.user_id, 'zh-CN'));

                const wb = new ExcelJS.Workbook();
                wb.creator = 'CSGOJ';
                const ws = wb.addWorksheet('课程权限');

                ws.columns = [
                    { header: '工号', key: 'user_id', width: 18 },
                    { header: '姓名', key: 'nick', width: 16 },
                    { header: '学院', key: 'school', width: 28 },
                ];

                // 表头样式
                const headerRow = ws.getRow(1);
                headerRow.height = 20;
                headerRow.eachCell((cell) => {
                    cell.font = { bold: true };
                    cell.alignment = { vertical: 'middle', horizontal: 'center' };
                    cell.fill = {
                        type: 'pattern',
                        pattern: 'solid',
                        fgColor: { argb: 'FFE6F3FF' },
                    };
                    cell.border = {
                        top: { style: 'thin' },
                        left: { style: 'thin' },
                        bottom: { style: 'thin' },
                        right: { style: 'thin' },
                    };
                });

                data.forEach((r) => {
                    const row = ws.addRow({
                        user_id: r.user_id || '',
                        nick: r.nick || '',
                        school: r.school || '',
                    });
                    row.eachCell((cell) => {
                        cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
                        cell.border = {
                            top: { style: 'thin' },
                            left: { style: 'thin' },
                            bottom: { style: 'thin' },
                            right: { style: 'thin' },
                        };
                    });
                });

                // 冻结表头
                ws.views = [{ state: 'frozen', ySplit: 1 }];

                const courseKey = '<?php echo addslashes($course["course_key"]); ?>';
                const ts = new Date();
                const pad2 = (n) => String(n).padStart(2, '0');
                const stamp = `${ts.getFullYear()}${pad2(ts.getMonth() + 1)}${pad2(ts.getDate())}${pad2(ts.getHours())}${pad2(ts.getMinutes())}${pad2(ts.getSeconds())}`;
                const filename = `课程权限_${courseKey}_${stamp}.xlsx`;

                const buffer = await wb.xlsx.writeBuffer();
                const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = filename;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
                alerty.success('已导出Excel', 'Excel exported');
            } catch (e) {
                console.error(e);
                alerty.error('导出失败：' + (e && e.message ? e.message : String(e)), 'Export failed');
            }
        });
    });
    
    table.on('click-cell.bs.table', function(e, field, td, row) {
        if (field == 'delete') {
            // 确认删除
            alerty.confirm({
                message: '确认删除权限？',
                message_en: 'Confirm to delete privilege?',
                callback: function() {
                    $.post(
                        `/${page_module}/course/course_privilege_del_ajax`,
                        {
                            'user_id': row['user_id'],
                            'pvrole': row['pvrole'],
                            'key': '<?php echo $course['course_key']; ?>'
                        },
                        function (ret) {
                            if (ret['code'] == 1) {
                                alerty.success(ret.msg);
                                table.bootstrapTable('refresh');
                            }
                            else {
                                alerty.error(ret['msg']);
                            }
                            return false;
                        }
                    );
                },
                callbackCancel: function() {
                    alerty.message('操作已取消', 'Operation cancelled');
                }
            });
        }
    });
</script>

<style type="text/css">
    /* 权限管理页面样式优化 - 与 privilege/index 保持一致 */
    
    /* 权限复选框样式增强 - 双列布局优化 */
    .form-check {
        margin-bottom: 0.5rem;
        padding-left: 1.5rem;
    }

    .form-check-sm {
        margin-bottom: 0.25rem;
        padding-left: 1.25rem;
    }

    .form-check-input {
        margin-top: 0.125rem;
        margin-left: -1.5rem;
    }

    .form-check-sm .form-check-input {
        margin-left: -1.25rem;
    }

    .form-check-label {
        cursor: pointer;
        font-weight: 500;
        transition: all 0.15s ease-in-out;
    }

    .form-check-sm .form-check-label {
        font-size: 0.9rem;
        line-height: 1.4;
    }

    .form-check-sm .en-text {
        font-size: 0.8rem;
    }

    .form-check-input:checked+.form-check-label {
        font-weight: 600;
    }

    /* 快速选择按钮组样式 */
    .btn-group .btn {
        border-radius: 0.375rem;
        margin-right: 0.25rem;
        transition: all 0.15s ease-in-out;
    }

    .btn-group .btn:last-child {
        margin-right: 0;
    }

    .btn-group .btn:hover {
        transform: translateY(-1px);
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    }

    /* 卡片样式增强 */
    .card {
        border: 1px solid rgba(0, 0, 0, 0.125);
        box-shadow: 0 0.125rem 0.25rem rgba(0, 0, 0, 0.075);
        transition: all 0.15s ease-in-out;
    }

    .card:hover {
        box-shadow: 0 0.5rem 1rem rgba(0, 0, 0, 0.15);
    }

    .card-header {
        background-color: #f8f9fa;
        border-bottom: 1px solid rgba(0, 0, 0, 0.125);
        font-weight: 600;
    }

    /* 响应式优化 */
    @media (max-width: 768px) {
        .btn-group {
            flex-direction: column;
        }

        .btn-group .btn {
            margin-right: 0;
            margin-bottom: 0.25rem;
        }

        .btn-group .btn:last-child {
            margin-bottom: 0;
        }

        .form-check {
            padding-left: 1.25rem;
        }

        .form-check-input {
            margin-left: -1.25rem;
        }

        /* 双列布局在小屏幕上变为单列 */
        .row.g-2 .col-md-6 {
            flex: 0 0 100%;
            max-width: 100%;
        }
    }

    /* 表格样式优化 */
    .table-hover tbody tr:hover {
        background-color: rgba(0, 0, 0, 0.075);
    }

    /* 删除按钮样式 */
    .btn-outline-danger.btn-sm {
        border-radius: 0.375rem;
        transition: all 0.15s ease-in-out;
    }

    .btn-outline-danger.btn-sm:hover {
        transform: translateY(-1px);
        box-shadow: 0 2px 4px rgba(220, 53, 69, 0.3);
    }

    /* 权限快速选择按钮样式 - 更小尺寸但保持字体大小 */
    .btn-group.privilege-quick-buttons .btn {
        line-height: 1.2;
        height: 40px;
    }

    .btn-group.privilege-quick-buttons .btn i {
        margin-right: 0.25rem;
    }

    /* 用户信息列样式优化 */
    #privilege_edit_table td[data-field="user_id"] {
        vertical-align: middle;
    }

    #privilege_edit_table td[data-field="user_id"] a {
        color: var(--bs-primary);
        transition: color 0.15s ease-in-out;
    }

    #privilege_edit_table td[data-field="user_id"] a:hover {
        color: var(--bs-primary-dark, #0a58ca);
    }

    #privilege_edit_table td[data-field="user_id"] small {
        font-size: 0.875rem;
        line-height: 1.4;
    }

    #privilege_edit_table td[data-field="user_id"] .bi-building {
        font-size: 0.75rem;
        margin-right: 0.25rem;
    }
</style>
