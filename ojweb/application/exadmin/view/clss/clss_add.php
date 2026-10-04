{include file="../../csgoj/view/public/base_csg_switch" /}

<div class="d-flex align-items-center justify-content-between mb-3">
    <h1 class="page-title bilingual-inline mb-0">
        批量添加/修改班级
        <span class="en-text">Batch Add/Modify Class</span>
    </h1>
    <div>
        <button type="button" class="btn btn-outline-info btn-sm" data-bs-toggle="collapse" data-bs-target="#clss_help_div" aria-expanded="false" aria-controls="clss_help_div">
            <span class="cn-text"><i class="bi bi-question-circle me-1"></i>
            帮助</span><span class="en-text">Help</span>
        </button>
    </div>
</div>

<article id="clss_help_div" class="alert alert-info collapse mb-4">
    <h5 class="bilingual-inline">
        文本输入模式
        <span class="en-text">Text Input Mode</span>
    </h5>
    <p>每行一个班级，该班级信息由制表符<code>\t</code>隔开（从Excel文档复制即可）。信息从左到右依次为：</p>
    <p>班级标题、年级、学期、教师（逗号分隔），例如：</p>
    <p><code>2024级计算机1班[\t]2024[\t]2024-2025-1[\t]teacher1,teacher2</code></p>
    <p>如果包含班级ID，则为修改模式，格式为：</p>
    <p><code>班级ID[\t]班级标题[\t]年级[\t]学期[\t]教师（逗号分隔）</code></p>
    <p>学期格式：YYYY-YYYY-N（如：2024-2025-1 表示2024-2025学年第一学期）</p>
    
    <h5 class="bilingual-inline mt-3">
        Excel导入模式
        <span class="en-text">Excel Import Mode</span>
    </h5>
    <p>点击"下载模板"按钮下载Excel模板，填写信息后上传即可批量导入。</p>
    <p>模板包含所有必要字段，支持批量添加和修改。</p>
</article>

<div class="row g-4 mb-4">
    <div class="col-lg-6">
        <div class="card h-100">
            <div class="card-header">
                <h5 class="card-title mb-0 bilingual-inline">
                    <span class="cn-text"><i class="bi bi-pencil-square me-2"></i>
                    文本输入模式
                    </span><span class="en-text">Text Input Mode</span>
                </h5>
            </div>
            <div class="card-body">
                <form id="clss_add_form" method='post' action="/{$module}/{$controller}/clss_batch_ajax">
                    <div class="mb-3">
                        <textarea id="clss_description" class="form-control" 
                            placeholder="每行一个班级，用制表符分隔... / One class per line, separated by tabs..." 
                            rows="8" name="clss_description"></textarea>
                    </div>
                    <button type="button" id="parse_data_btn" class="btn btn-outline-primary w-100">
                        <span><i class="bi bi-search me-1"></i>解析数据</span>
                        <span class="en-text">Parse Data</span>
                    </button>
                </form>
            </div>
        </div>
    </div>
    
    <div class="col-lg-6">
        <div class="card h-100">
            <div class="card-header">
                <h5 class="card-title mb-0 bilingual-inline">
                    <span class="cn-text"><i class="bi bi-file-earmark-excel me-2"></i>
                    Excel导入模式
                    </span><span class="en-text">Excel Import Mode</span>
                </h5>
            </div>
            <div class="card-body">
                <div class="mb-3">
                    <button type="button" id="download_template_add_btn" class="btn btn-success w-100 mb-2">
                        <span><i class="bi bi-download me-1"></i>模板-批量录入</span>
                        <span class="en-text">Batch Add Template</span>
                    </button>
                    <button type="button" id="download_template_modify_btn" class="btn btn-warning w-100">
                        <span><i class="bi bi-download me-1"></i>模板-批量修改</span>
                        <span class="en-text">Batch Modify Template</span>
                    </button>
                </div>
                <div class="mb-3">
                    <button type="button" id="excel_file_btn" class="btn btn-outline-primary w-100">
                        <span><i class="bi bi-file-earmark-excel me-1"></i>解析Excel文件</span>
                        <span class="en-text">Parse Excel File</span>
                    </button>
                    <input type="file" id="excel_file_input" style="display: none;" accept=".xlsx,.xls" />
                    <div class="form-text">
                        <span class="bilingual-inline">
                            选择文件后将自动解析并预览数据
                            <span class="en-text">File will be parsed and previewed automatically after selection</span>
                        </span>
                    </div>
                </div>
            </div>
        </div>
    </div>
</div>

<div id="clss_toolbar" class="mb-3">
    <div class="toolbar-container">
        <div class="toolbar-left">
            <h5 id="toolbar_title">
                <span class="cn-text"><i class="bi bi-table me-2"></i>
                数据预览</span><span class="en-text">Data Preview</span>
            </h5>
            <small class="text-muted" id="toolbar_subtitle">
                <span class="bilingual-inline">
                    请检查数据后执行导入
                    <span class="en-text">Please review data before importing</span>
                </span>
            </small>
        </div>
        <div class="toolbar-right">
            <button type="button" class="btn btn-success bilingual-button" id="execute_import_btn" style="display: none;">
                <span><i class="bi bi-check-circle me-1"></i>执行导入</span>
                <span class="en-text">Execute Import</span>
            </button>
        </div>
    </div>
    <div id="error_summary" class="alert alert-warning mt-2" style="display: none;">
        <i class="bi bi-exclamation-triangle me-2"></i>
        <span id="error_count">0</span> 行数据有错误，请检查后重新导入
        <span class="en-text">rows have errors, please check and re-import</span>
    </div>
</div>

<div class="table-responsive">
<table
    id="clss_table"
    data-toggle="table"
    data-buttons-align="left"
    data-sort-name="clss_id"
    data-sort-order="asc"
    data-unique-id="row_index"
    data-toolbar="#clss_toolbar"
    data-toolbar-align="right"
    data-pagination="false"
    data-method="get"
    class="table table-striped table-hover"
    style="table-layout: fixed; word-wrap: break-word;"
>
    <thead>
    <tr>
        <th data-field="idx" data-align="center" data-valign="middle" data-sortable="false" data-width="60" data-formatter="FormatterIndex" title="序号 / Index">序号<span class="en-text">Index</span></th>
        <th data-field="action_type" data-align="center" data-valign="middle" data-sortable="false" data-width="80" data-formatter="FormatterActionType" title="操作类型 / Action Type">操作类型<span class="en-text">Action Type</span></th>
        <th data-field="clss_id" data-align="center" data-valign="middle" data-sortable="true" data-width="80" title="班级ID / Class ID">班级ID<span class="en-text">Class ID</span></th>
        <th data-field="clss_title" data-align="left" data-valign="middle" data-width="200" title="班级名称 / Class Name">班级名称<span class="en-text">Class Name</span></th>
        <th data-field="clss_year" data-align="center" data-valign="middle" data-width="80" title="年级 / Year">年级<span class="en-text">Year</span></th>
        <th data-field="clss_semester" data-align="center" data-valign="middle" data-width="120" title="学期 / Semester">学期<span class="en-text">Semester</span></th>
        <th data-field="teachers" data-align="left" data-valign="middle" data-width="200" data-formatter="FormatterClssTeachersPreview" title="教师 / Teachers">教师<span class="en-text">Teachers</span></th>
        <th data-field="validation_errors" data-align="center" data-valign="middle" data-width="60" data-formatter="FormatterValidationErrors" data-visible="false" data-sortable="true" title="错误信息 / Validation Errors">错误信息<span class="en-text">Validation Errors</span></th>
    </tr>
    </thead>
</table>
</div>

<!-- 错误详情模态框 -->
<div class="modal fade" id="errorDetailModal" tabindex="-1" aria-labelledby="errorDetailModalLabel" aria-hidden="true">
    <div class="modal-dialog modal-lg">
        <div class="modal-content">
            <div class="modal-header">
                <h5 class="modal-title bilingual-inline" id="errorDetailModalLabel">
                    <span class="cn-text"><i class="bi bi-exclamation-triangle me-2"></i>
                    数据验证错误详情
                    </span><span class="en-text">Data Validation Error Details</span>
                </h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div class="modal-body">
                <div id="error_detail_content">
                    <!-- 错误详情内容将在这里动态填充 -->
                </div>
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">
                    <span class="cn-text"><i class="bi bi-x-circle me-1"></i>
                    关闭</span><span class="en-text">Close</span>
                </button>
            </div>
        </div>
    </div>
</div>

<script type="text/javascript">
    // 页面加载时保存当前的 course_key（页面打开时的 course_key）
    window.CLSS_PAGE_COURSE_KEY = '<?php echo isset($NOW_COURSE_KEY) ? $NOW_COURSE_KEY : ''; ?>';
    
    TextAllowTab('clss_description');
    
    $(function() {
        // 初始化页面状态 - 无数据状态
        ClssInitPreviewMode();
        
        // 绑定事件
        ClssBindAllEvents();
    });
</script>

{include file="../../csgoj/view/public/js_exceljs" /}
{css href="__STATIC__/css/bilingual.css" /}
{js href="__STATIC__/js/bilingual.js" /}
{css href="__STATIC__/expsys/contest_filter.css" /}
{js href="__STATIC__/expsys/contest_filter.js" /}
{js href="__STATIC__/exadmin/clss.js" /}
{css href="__STATIC__/exadmin/clss.css" /}

<style type="text/css">
    #clss_table {
        font-family: 'Simsun', 'Microsoft Yahei Mono', 'Lato', "PingFang SC", "Microsoft YaHei", sans-serif;
        word-wrap: break-word;
    }
    
    /* 工具栏样式 */
    .toolbar-container {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        width: 100%;
        margin: 0;
        padding: 0;
    }
    
    .toolbar-left {
        flex: 1;
        margin: 0;
        padding: 0;
        text-align: left;
    }
    
    .toolbar-right {
        flex-shrink: 0;
        display: flex;
        gap: 0.5rem;
        align-items: center;
        margin: 0;
        padding: 0;
    }
    
    #toolbar_title {
        margin: 0 !important;
        padding: 0 !important;
        text-align: left !important;
        line-height: 1.2;
    }
    
    #toolbar_subtitle {
        margin: 0 !important;
        padding: 0 !important;
        text-align: left !important;
        display: block;
        margin-top: 0.25rem !important;
    }
    
    #toolbar_title i {
        margin-right: 0.5rem;
    }
    
    /* 数据预览状态样式 */
    .toolbar-preview-data {
        background-color: rgba(255, 193, 7, 0.1) !important;
        border-left: 4px solid #ffc107 !important;
        padding: 0.75rem 1rem !important;
        border-radius: 0.375rem !important;
    }
    
    .toolbar-preview-data #toolbar_title {
        color: #b45309 !important;
        font-size: 1.1rem !important;
        font-weight: 600 !important;
    }
    
    .toolbar-preview-data #toolbar_title i {
        color: #b45309 !important;
    }
    
    /* 提交成功状态样式 */
    .toolbar-success-data {
        background-color: rgba(25, 135, 84, 0.1) !important;
        border-left: 4px solid #198754 !important;
        padding: 0.75rem 1rem !important;
        border-radius: 0.375rem !important;
    }
    
    .toolbar-success-data #toolbar_title {
        color: #0f5132 !important;
        font-size: 1.1rem !important;
        font-weight: 600 !important;
    }
    
    .toolbar-success-data #toolbar_title i {
        color: #0f5132 !important;
    }
</style>

<script>
function FormatterIndex(value, row, index, field) {
    return index + 1;
}

function FormatterActionType(value, row, index, field) {
    // 如果是提交结果，根据 _action_type 显示
    if (row._is_result) {
        if (row._action_type === 'update') {
            return '<span class="badge bg-warning">更新</span><span class="en-text"><span class="badge bg-warning">Update</span></span>';
        } else {
            return '<span class="badge bg-success">新增</span><span class="en-text"><span class="badge bg-success">Add</span></span>';
        }
    }
    
    // 预览模式：根据是否有 clss_id 判断
    if (row.clss_id && row.clss_id > 0) {
        return '<span class="badge bg-warning">更新</span><span class="en-text"><span class="badge bg-warning">Update</span></span>';
    } else {
        return '<span class="badge bg-success">新增</span><span class="en-text"><span class="badge bg-success">Add</span></span>';
    }
}

function FormatterClssTeachersPreview(value, row, index, field) {
    // 如果 teachers 是数组格式（提交结果可能已转换）
    if (Array.isArray(value) && value.length > 0) {
        // 使用 FormatterExpClssTeachers（如果已加载）
        if (typeof FormatterExpClssTeachers === 'function') {
            return FormatterExpClssTeachers(value, row, index, field);
        }
        // 否则简单显示
        const teacherNames = value.map(t => t.nick || t.user_id || t).join(', ');
        return `<span class="text-muted">${escapeHtml(teacherNames)}</span>`;
    }
    
    // 如果 teachers 是字符串格式（",user1,user2,"）
    if (typeof value === 'string') {
        const teachersStr = value.trim().replace(/^,|,$/g, '');
        if (teachersStr) {
            const teacherIds = teachersStr.split(',').filter(t => t.trim());
            if (teacherIds.length > 0) {
                // 转换为数组格式，尝试使用 FormatterExpClssTeachers
                const teachersArray = teacherIds.map(user_id => ({
                    user_id: user_id.trim(),
                    nick: user_id.trim(),
                    school: ''
                }));
                if (typeof FormatterExpClssTeachers === 'function') {
                    return FormatterExpClssTeachers(teachersArray, row, index, field);
                }
                // 否则简单显示
                return `<span class="text-muted">${escapeHtml(teacherIds.join(', '))}</span>`;
            }
        }
    }
    
    return '<span class="text-muted">-</span>';
}

// HTML转义函数：使用全局 DomSantize（来自 global.js）
function escapeHtml(text) {
    return DomSantize(text);
}
</script>

