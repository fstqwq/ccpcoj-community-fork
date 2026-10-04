<div class="admin-page-header">
    <div class="admin-page-header-left">
        <div class="admin-page-header-icon">
            <i class="bi bi-book"></i>
        </div>
        <h1 class="admin-page-header-title">
            <div class="admin-page-header-title-main">
                {if $edit_mode}
                    编辑课程组
                {else /}
                    添加课程组
                {/if}
            </div>
            <div class="admin-page-header-title-right">
                {if $edit_mode}
                <a href="/course/index#course={$course['course_key']}" target="_blank" class="admin-page-header-id">
                    <i class="bi bi-hash"></i> {$course['course_id']}: {$course['course_key']}
                </a>
                {/if}
                {if $edit_mode}
                <span class="en-text">Edit Course Group</span>
                {else /}
                <span class="en-text">Add Course Group</span>
                {/if}
            </div>
        </h1>
    </div>
    {if $edit_mode}
    <div class="admin-page-header-actions">
        <button type="button" class="btn btn-success btn-sm bilingual-button"
                data-modal-url="/{$module}/filemanager/filemanager?item=course&id={$course['course_id']}"
                data-modal-title="附件管理 - 课程组 #{$course['course_id']} - {$course['course_title']|mb_substr=0,150,'utf-8'}..."
                title="附件管理 (File Manager)">
            <span class="cn-text"><i class="bi bi-paperclip"></i> 附件</span><span class="en-text">Attach</span>
        </button>
        {if IsAdmin()}
        <?php $defunct = $course['defunct']; $item_id = $course['course_id']; ?>
        {include file="../../admin/view/admin/changestatus_button" /}
        {/if}
    </div>
    {/if}
</div>

{include file="../../csgoj/view/public/base_csg_switch" /}

<form id="course_edit_form" class="admin-form" method='post' action="/{$module}/course/course_edit_ajax">
    <div class="container">
            <div class="form-group mb-3">
                <label for="course_key" class="bilingual-label">
                    课程组缩写<span class="en-text">Course Key</span>
                    <small class="text-muted d-block mt-1">
                        <span class="bilingual-inline">
                            {if $edit_mode}
                                <span>（可修改；如修改将同时重命名附件目录，并在保存成功后自动跳转到新 key）</span>
                                <span class="en-text">(Editable; if changed, attachment folder will be renamed and page will redirect after saving)</span>
                            {else /}
                                <span>（设置后不可修改）</span>
                                <span class="en-text">(Cannot be changed after setting)</span>
                            {/if}
                        </span>
                    </small>
                </label>
                <input type="text" class="form-control" id="course_key" placeholder="英文字母 ..." name="course_key" {if $edit_mode}value="{$course['course_key']}"{/if}>
            </div>
            
            <div class="form-group mb-3">
                <label for="course_title" class="bilingual-label">
                    课程组标题<span class="en-text">Course Title</span>
                </label>
                <input type="text" class="form-control" id="course_title" placeholder="标题 ..." name="course_title" {if $edit_mode}value="{$course['course_title']}"{/if}>
            </div>
            
            <div class="form-group mb-3">
                <label for="course_unit" class="bilingual-label">
                    单位<span class="en-text">Unit</span>
                </label>
                <input type="text" class="form-control" id="course_unit" placeholder="如：人工智能学院" name="course_unit" {if $edit_mode}value="{if isset($course['course_unit'])}{$course['course_unit']}{/if}"{/if}>
                <div class="form-text">
                    <span class="bilingual-inline">
                        <span>例如：人工智能学院</span>
                        <span class="en-text">e.g., School of Health and Environmental Engineering</span>
                    </span>
                </div>
            </div>
            
            <!-- 课程组配置区域 -->
            <div class="form-group mb-3">
                <div class="card">
                    <div class="card-header bg-light d-flex justify-content-between align-items-center">
                        <div class="d-flex align-items-center">
                            <h5 class="mb-0 me-2">课程组配置<span class="en-text text-muted fs-6">Course Configuration</span></h5>
                            <small class="text-muted">
                                <span class="bilingual-inline">
                                    <span>({$OJ_MODE == 'online' ? "习题模式" : "考试模式"})</span>
                                    <span class="en-text">({$OJ_MODE == 'online' ? "Practice Mode" : "Exam Mode"})</span>
                                </span>
                            </small>
                        </div>
                        <div class="d-flex gap-2">
                            <button type="button" class="btn btn-outline-info btn-sm" id="export_config" title="下载配置 / Export Config">
                                <i class="bi bi-download"></i>
                            </button>
                            <button type="button" class="btn btn-outline-warning btn-sm" id="import_config" title="上传配置 / Import Config">
                                <i class="bi bi-upload"></i>
                            </button>
                            <button type="button" class="btn btn-outline-secondary btn-sm" id="get_default_config" title="获取默认配置 / Get Default Config">
                                <i class="bi bi-arrow-clockwise"></i>
                            </button>
                        </div>
                    </div>
                    <div class="card-body">
                        <!-- 注意：不要嵌套 form（HTML 不允许），这里用 div 作为容器 -->
                        <div id="course_config_form">
                            <!-- 配置数据存储 -->
                            <textarea id="course_config_data" style="display: none;">{if $edit_mode}{$course['course_config_json']|raw}{else}{$COURSE_ENV_CONFIG|json_encode}{/if}</textarea>
                            
                            <!-- 隐藏的文件输入框用于上传 -->
                            <input type="file" id="import_file_input" accept=".json" style="display: none;">
                            
                            <!-- 隐藏的配置字段（用于表单提交） -->
                            <input type="hidden" id="course_config_json" name="course_config_json">
                            
                            <!-- 动态生成的配置表单 -->
                            <div id="config_form_container">
                                <!-- 表单将由JavaScript动态生成 -->
                            </div>
                            
                        </div>
                    </div>
                </div>
            </div>
            
            <div class="form-group mb-3">
                <label for="course_description" class="bilingual-label">
                    课程介绍<span class="en-text">Course Description</span>
                    <small class="text-muted d-block mt-1">
                        <span class="bilingual-inline">
                            <span>（支持 Markdown）</span>
                            <span class="en-text">(Supports Markdown)</span>
                        </span>
                    </small>
                </label>
                <!-- Vditor 编辑器容器（由 csg_vditor.js 初始化） -->
                <div id="course_description_editor" class="border rounded"></div>
                <!-- 真实提交字段：保持在 DOM 中（不 display:none），供表单提交与验证使用 -->
                <textarea id="course_description" class="form-control visually-hidden" placeholder="介绍 ..." rows="10" name="course_description">{if $edit_mode}{$course['course_description']|htmlspecialchars}{/if}</textarea>
                <div class="form-text">
                    <span class="bilingual-inline">
                        <span>支持 Markdown 格式</span>
                        <span class="en-text">Markdown format supported</span>
                    </span>
                </div>
            </div>
            
            {if $edit_mode}
            <input type="hidden" value="{$course['course_key']}" name="key">
            {/if}
        </div>
        
        <!-- 提交按钮 -->
        <div class="admin-form-actions">
            <button type="submit" id="submit_button" class="btn btn-primary bilingual-button">
                <span><i class="bi bi-check-circle"></i>
                {if $edit_mode}
                修改课程组</span><span class="en-text">Update Course Group</span>
                {else /}
                添加课程组</span><span class="en-text">Add Course Group</span>
                {/if}
            </button>
        </div>
    </div>
</form>

<script>
    window.COURSE_EDIT_CONFIG = {
        edit_mode: <?php echo $edit_mode ? 1 : 0; ?>,
        module: "<?php echo $module; ?>"
    };
    var course_env_config = <?php echo json_encode(isset($COURSE_ENV_CONFIG) ? $COURSE_ENV_CONFIG : []); ?>;
    var courseDefaultConfig = <?php echo json_encode(isset($courseDefaultConfig) ? $courseDefaultConfig : ['config' => [], 'definitions' => ['fields' => []]], JSON_UNESCAPED_UNICODE); ?>;
</script>

{js href="__STATIC__/course/course.js" /}
{js href="__STATIC__/exadmin/course_admin.js" /}
{css href="__STATIC__/exadmin/course_admin.css" /}


<script>
$(document).ready(function() {
    // 初始化课程编辑页（只初始化一次）
    if (typeof window.CourseEditPage !== 'undefined' && typeof window.COURSE_EDIT_CONFIG !== 'undefined') {
        // 防止重复初始化
        if (!window.courseEditPageInstance) {
            window.courseEditPageInstance = new window.CourseEditPage(window.COURSE_EDIT_CONFIG);
            window.courseEditPageInstance.init();
        }
    }
});
</script>


