{include file="../../csgoj/view/public/base_csg_switch" /}

<div class="admin-page-header">
    <div class="admin-page-header-left">
        <div class="admin-page-header-icon account-gen-icon-{$account_gen_type|default='student'}">
            <i class="bi {if $account_gen_type == 'proctor'}bi-shield-check{elseif $account_gen_type == 'reviewer' /}bi-pencil-square{else /}bi-person-plus-fill{/if}"></i>
        </div>
        <h1 class="admin-page-header-title">
            <div class="admin-page-header-title-main account-gen-title-{$account_gen_type|default='student'}">
                {$account_gen_title|default='考生生成'}
            </div>
            <div class="admin-page-header-title-right">
                <a href="/{$module}/contest/contest?cid={$contest['contest_id']}" class="admin-page-header-id">
                    <i class="bi bi-hash"></i> {$contest['contest_id']}
                </a>
                <span class="en-text">
                    {$account_gen_title_en|default='Student Generator'}
                </span>
            </div>
        </h1>
    </div>
    <div class="admin-page-header-right">
        <button type="button" class="btn btn-outline-info btn-sm" data-bs-toggle="collapse" data-bs-target="#teamgen_help_div" aria-expanded="false" aria-controls="navbar">
            <span class="cn-text"><i class="bi bi-question-circle me-1"></i>
            帮助</span><span class="en-text">Help</span>
        </button>
    </div>
</div>
<div class="container admin-import-container account-gen-container account-gen-{$account_gen_type|default='student'}">
    <article id="teamgen_help_div" class="alert alert-info collapse">
        <h5 class="bilingual-inline">
            文本输入模式
            <span class="en-text">Text Input Mode</span>
        </h5>
        <p>每行一个账号，由制表符<code>\t</code>或半角字符<code>#</code>隔开。信息从左到右依次为：</p>
        {if $account_gen_type == 'proctor'}
        <p><span class="text-danger">账号、姓名、学校/学院/班级、考场（如果需要的话）、预设密码</span></p>
        <p class="text-info"><strong>注意：监考生成会自动设置权限为 admin，无需在数据中指定权限字段。</strong></p>
        <p>例：<code>20201234#王老师#计算机学院#C5-360#123456</code></p>
        {elseif $account_gen_type == 'reviewer' /}
        <p><span class="text-danger">账号、姓名、学校/学院/班级（可选）、考场（可选）、预设密码</span></p>
        <p class="text-info"><strong>注意：阅卷生成会自动设置权限为 reviewer，无需在数据中指定权限字段。学校/学院/班级和考场可以为空。</strong></p>
        <p>例：<code>20201234#赵老师#计算机学院#C5-360#123456</code> 或 <code>20205678#钱老师##123456</code>（学校/考场为空）</p>
        {else /}
        <p><span class="text-danger">账号、姓名、学校/学院/班级、考场（如果需要的话）、考生类型编码、预设密码</span></p>
        <p class="text-info"><strong>注意：考生生成会自动设置权限为普通账号，无需在数据中指定权限字段。</strong></p>
        <p>考生类型编码：0正常考试、2打星、10初修常规、11缓考、12补考、20重修常规、21重修缓考、22重修补考，可以不设置</p>
        <p>例：<code>202000000000#张三#计算机2003#C5-360#0#123456</code></p>
        {/if}
        <p>除账号外其他内容可为空，其中密码为空则系统会自动生成，但"<code>\t</code>"或"<code>#</code>"分隔符必须有，信息是以第几个分隔符来对应的。</p>
        <p>比如 <code>202000000000##测试</code>，即会自动生成一个这样的账号：</p>
        <div class="table-responsive">
            <table class="table table-sm table-bordered">
                <thead class="table-light">
                    <tr>
                        <th>账号</th><th>姓名</th><th>所在单位</th><th>考场</th>{if $account_gen_type == 'student'}<th>类型</th>{/if}<th>密码</th>
                    </tr>
                </thead>
                <tbody>
                    {if $account_gen_type == 'proctor'}
                    <tr><td>20201234</td><td>王老师</td><td>计算机学院</td><td>C5-360</td><td>V395JKQB</td></tr>
                    {elseif $account_gen_type == 'reviewer' /}
                    <tr><td>20201234</td><td>赵老师</td><td>计算机学院</td><td>C5-360</td><td>V395JKQB</td></tr>
                    <tr><td>20205678</td><td>钱老师</td><td></td><td></td><td>V395JKQB</td></tr>
                    {else /}
                    <tr><td>202000000000</td><td>张三</td><td>计算机2003</td><td>C5-360</td><td>正常考试</td><td>V395JKQB</td></tr>
                    <tr><td>202000000001</td><td>李四</td><td>软件工程2001</td><td>C5-361</td><td>正常考试</td><td>V395JKQB</td></tr>
                    {/if}
                </tbody>
            </table>
        </div>
        
        <h5 class="bilingual-inline">
            Excel导入模式
            <span class="en-text">Excel Import Mode</span>
        </h5>
        <p>点击"下载模板"按钮下载Excel模板，填写信息后上传即可批量导入。</p>
        {if $account_gen_type == 'proctor'}
        <p>模板包含所有必要字段，权限会自动设置为 admin。</p>
        {elseif $account_gen_type == 'reviewer' /}
        <p>模板包含所有必要字段，权限会自动设置为 reviewer。</p>
        {else /}
        <p>模板包含所有必要字段，考生类型列提供下拉选择，权限会自动设置为普通账号。</p>
        {/if}
    </article>
    
    {if $contestStatus != 2 || $account_gen_type == 'reviewer'}
    
    <div class="row g-4">
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
                    <form id="contest_teamgen_form" method='post' action="/{$module}/admin/contest_teamgen_ajax?cid={$contest['contest_id']}">
                        <div class="mb-3">
                            <textarea id="team_description" class="form-control" 
                                placeholder="每行一个账号，用制表符或#分隔... / One account per line, separated by tabs or #..." 
                                rows="3" name="team_description"></textarea>
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
                        <button type="button" id="download_template_btn" class="btn btn-success w-100">
                            <span><i class="bi bi-download me-1"></i>下载模板</span>
                            <span class="en-text">Download Template</span>
                        </button>
                    </div>
                    <div class="mb-3">
                        <button type="button" id="excel_file_btn" class="btn btn-outline-primary w-100">
                            <span><i class="bi bi-file-earmark-excel me-1"></i>选择Excel文件</span>
                            <span class="en-text">Select Excel File</span>
                        </button>
                        <input type="file" id="excel_file_input" style="display: none;" accept=".xlsx,.xls" />
                        <div class="form-text">
                            <span class="bilingual-inline">
                                选择文件后将自动解析并预览数据
                                <span class="en-text">File will be parsed and previewed automatically after selection</span>
                            </span>
                        </div>
                    </div>
                    {if $account_gen_type == 'student'}
                    <div class="mb-3">
                        <button type="button" id="import_clss_btn" class="btn btn-warning w-100">
                            <span><i class="bi bi-people me-1"></i>导入班级</span>
                            <span class="en-text">Import Class</span>
                        </button>
                        <div class="form-text">
                            <span class="bilingual-inline">
                                从可管辖班级中导入全部学生为考生账号预览数据
                                <span class="en-text">Import all students from manageable classes into preview data</span>
                            </span>
                        </div>
                    </div>
                    {/if}
                </div>
            </div>
        </div>
    </div>
    
    <!-- 全局设置 -->
    <div class="card mb-4">
        <div class="card-header">
            <h5 class="card-title mb-0 bilingual-inline">
                <span class="cn-text"><i class="bi bi-gear me-2"></i>
                全局设置
                </span><span class="en-text">Global Settings</span>
            </h5>
        </div>
        <div class="card-body">
            <div class="row">
                <div class="col-md-6">
                    <div class="csg-switch-setting mb-4">
                        <div class="d-flex align-items-center justify-content-between">
                            <div class="csg-switch-setting-content">
                    <div class="csg-switch-setting-title">
                        <span class="cn-text"><i class="bi bi-exclamation-triangle me-1 text-warning"></i>
                        重新生成所有{if $account_gen_type == 'proctor'}监考{elseif $account_gen_type == 'reviewer' /}阅卷{else /}考生{/if}账号
                        </span><span class="en-text">Regenerate All {if $account_gen_type == 'proctor'}Proctor{elseif $account_gen_type == 'reviewer' /}Reviewer{else /}Student{/if} Accounts</span>
                    </div>
                    <div class="csg-switch-setting-subtitle">
                        {if $account_gen_type == 'proctor'}
                        开启后，提交数据时将清除所有现有监考账号（admin权限），重新生成新的监考账号数据。不会影响考生账号和阅卷账号。
                        <span class="en-text">When enabled, all existing proctor accounts (admin privilege) will be cleared and new proctor account data will be generated when submitting data. Student and reviewer accounts will not be affected.</span>
                        {elseif $account_gen_type == 'reviewer' /}
                        开启后，提交数据时将清除所有现有阅卷账号（reviewer权限），重新生成新的阅卷账号数据。不会影响考生账号和监考账号。
                        <span class="en-text">When enabled, all existing reviewer accounts (reviewer privilege) will be cleared and new reviewer account data will be generated when submitting data. Student and proctor accounts will not be affected.</span>
                        {else /}
                        开启后，提交数据时将清除所有现有考生账号（普通账号），重新生成新的考生账号数据。不会影响监考账号和阅卷账号。
                        <span class="en-text">When enabled, all existing student accounts (normal accounts) will be cleared and new student account data will be generated when submitting data. Proctor and reviewer accounts will not be affected.</span>
                        {/if}
                    </div>
                            </div>
                            <div class="csg-switch-setting-control">
                                <div class="csg-switch csg-switch-md">
                                    <input type="checkbox" 
                                           id="reset_team" 
                                           name="reset_team" 
                                           class="csg-switch-input"
                                           data-csg-storage="true"
                                           data-csg-storage-key="reset_team"
                                           title="点击切换重新生成账号设置">
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="csg-switch-setting mb-4">
                        <div class="d-flex align-items-center justify-content-between">
                            <div class="csg-switch-setting-content">
                                <div class="csg-switch-setting-title">
                                    <span class="cn-text"><i class="bi bi-key me-1 text-info"></i>
                                    使用系统密码
                                    </span><span class="en-text">Use System Password</span>
                                </div>
                                <div class="csg-switch-setting-subtitle">
                                    使用系统账号密码，需要输入的账号ID都在系统中存在。
                                    <span class="en-text">Use system account password, all account IDs must exist in the system.</span>
                                </div>
                            </div>
                            <div class="csg-switch-setting-control">
                                <div class="csg-switch csg-switch-md">
                                    <input type="checkbox" 
                                           id="use_system_pass" 
                                           name="use_system_pass" 
                                           class="csg-switch-input"
                                           data-csg-storage="true"
                                           data-csg-storage-key="use_system_pass"
                                           title="点击切换使用系统密码设置">
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="col-md-6">
                    <div class="mb-3">
                        <label for="password_seed" class="form-label bilingual-inline">
                            密码种子
                            <span class="en-text">Password Seed</span>
                        </label>
                        <input type="number" id="password_seed" name="password_seed" class="form-control" 
                            placeholder="留空使用随机种子 / Leave empty for random seed" 
                            min="1" max="999999999">
                    </div>
                    <div class="form-text">
                        <div>
                            设置种子可确保相同账号ID的密码固定不变，留空则每次生成随机密码
                            <span class="en-text">Set seed to ensure consistent passwords for same account ID, leave empty for random passwords</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
    {else /}
    <div class="alert alert-danger">
        <h3 class="bilingual-inline">
            <span class="cn-text"><i class="bi bi-exclamation-triangle me-2"></i>
            考试已结束，不允许调整账号
            </span><span class="en-text">Exam ended, account generation not allowed</span>
        </h3>
        <p class="mt-2 text-muted">
            <span class="cn-text">注意：阅卷账号可以在考试结束后生成，请使用"阅卷账号"页面。</span>
            <span class="en-text">Note: Reviewer accounts can be generated after exam ends, please use the "Reviewer Account" page.</span>
        </p>
    </div>
    {/if}

<div id="teamgen_toolbar" class="mb-3">
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
        <div id="preview_import_tip" class="preview-import-tip toolbar-center-tip csg-bilingual-stack" style="display: none;">
            <span class="cn-text"><strong>【注意】</strong>当前仅为提交前数据预览，尚未提交到服务器，需点击「执行导入」按钮完成实际提交。</span>
            <span class="en-text"><strong>Important:</strong> This is pre-submit data preview only; data has not been submitted yet. Click "Execute Import" to submit.</span>
        </div>
        <div class="toolbar-right">
            <button type="button" class="btn btn-success bilingual-button" id="execute_import_btn" style="display: none;">
                <span><i class="bi bi-check-circle me-1"></i>执行导入</span>
                <span class="en-text">Execute Import</span>
            </button>
            <button type="button" class="btn btn-primary bilingual-button" id="export_teamgen_pageteam_btn">
                <span><i class="bi bi-download me-1"></i>导出密码条</span>
                <span class="en-text">Export Password Sheet</span>
            </button>
            <button type="button" class="btn btn-info bilingual-button" id="export_standard_btn">
                <span><i class="bi bi-download me-1"></i>导出标准数据</span>
                <span class="en-text">Export Standard Data</span>
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
    id="teamgen_table"
    data-toggle="table"
    data-buttons-align="left"
    data-sort-name="team_id"
    data-sort-order="asc"
    data-unique-id="row_index"
    data-toolbar="#teamgen_toolbar"
    data-toolbar-align="right"
    data-pagination="false"
    data-method="get"
    class="table table-striped table-hover"
    style="table-layout: fixed; word-wrap: break-word;"
>
    <thead>
    <tr>
        <th data-field="idx" data-align="center" data-valign="middle" data-sortable="false" data-width="60" data-formatter="FormatterIndex" title="序号 / Index"><div style="display: flex; flex-direction: column; align-items: center;"><span>序号</span><span class="en-text" style="font-size: 0.85em; opacity: 0.7;">Index</span></div></th>
        <th data-field="team_id" data-align="center" data-valign="middle" data-sortable="true" data-width="120" data-cell-style="cellStyleTeamId" title="账号 / ID"><div style="display: flex; flex-direction: column; align-items: center;"><span>账号</span><span class="en-text" style="font-size: 0.85em; opacity: 0.7;">ID</span></div></th>
        <th data-field="name" data-align="left" data-valign="middle" data-width="160" title="姓名 / Name"><div style="display: flex; flex-direction: column; align-items: flex-start;"><span>姓名</span><span class="en-text" style="font-size: 0.85em; opacity: 0.7;">Name</span></div></th>
        <th data-field="school" data-align="center" data-valign="middle" data-width="150" title="学校/组织 / School/Organization"><div style="display: flex; flex-direction: column; align-items: center;"><span>学校/组织</span><span class="en-text" style="font-size: 0.85em; opacity: 0.7;">School/Organization</span></div></th>
        <th data-field="room" data-align="center" data-valign="middle" title="考场 / Room"><div style="display: flex; flex-direction: column; align-items: center;"><span>考场</span><span class="en-text" style="font-size: 0.85em; opacity: 0.7;">Room</span></div></th>
        {if $account_gen_type == 'student'}
        <th data-field="tkind" data-align="center" data-valign="middle" data-formatter="FormatterExamTkind" data-width="100" title="考生类型 / Exam Type"><div style="display: flex; flex-direction: column; align-items: center;"><span>考生类型</span><span class="en-text" style="font-size: 0.85em; opacity: 0.7;">Exam Type</span></div></th>
        {/if}
        <th data-field="password" data-align="center" data-valign="middle" data-width="100" data-formatter="FormatterPassword" title="密码 / Password"><div style="display: flex; flex-direction: column; align-items: center;"><span>密码</span><span class="en-text" style="font-size: 0.85em; opacity: 0.7;">Password</span></div></th>
        {if $account_gen_type == 'proctor' || $account_gen_type == 'reviewer'}
        <th data-field="privilege" data-align="center" data-valign="middle" data-width="100" title="权限 / Privilege"><div style="display: flex; flex-direction: column; align-items: center;"><span>权限</span><span class="en-text" style="font-size: 0.85em; opacity: 0.7;">Privilege</span></div></th>
        {/if}
        <th data-field="validation_errors" data-align="center" data-valign="middle" data-width="60" data-formatter="FormatterValidationErrors" data-visible="false" data-sortable="true" title="校验 / Validation"><div style="display: flex; flex-direction: column; align-items: center;"><span>校验</span><span class="en-text" style="font-size: 0.85em; opacity: 0.7;">Validation</span></div></th>
        {if $contestStatus != 2 || $account_gen_type == 'reviewer'}
        <th data-field="delete" data-align="center" data-valign="middle" data-width="60" data-formatter="FormatterDel" title="删除 / Del(Dbl Click)"><div style="display: flex; flex-direction: column; align-items: center;"><span>删除</span><span class="en-text" style="font-size: 0.85em; opacity: 0.7;">Del(Dbl Click)</span></div></th>
        {/if}
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

{if $account_gen_type == 'student'}
<?php
    // 复用 expsys 班级选择器组件（更好的样式 + 搜索筛选 + “我的”标识）
    $clss_select_modal_id = 'importClssModal';
    $clss_select_modal_title_cn = '导入班级';
    $clss_select_modal_title_en = 'Import Class';
    $clss_select_table_id = 'import_clss_table';
    $clss_select_confirm_btn_id = 'import_clss_confirm_btn';
    $clss_select_ajax_url = "/examsys/admin/clss_manage_list_ajax?cid=" . $contest['contest_id'];
    $clss_select_show_only_mine = true;
?>
{include file="../../expsys/view/clss/clss_select_modal" /}
{/if}

{include file="../../csgoj/view/public/js_exceljs" /}
{css href="__STATIC__/css/import_overlay.css" /}
{js href="__STATIC__/examsys/contest/account_gen.js" /}

<script type="text/javascript">
    var TEAMGEN_CONFIG = {
        contest_id: "<?php echo $contest['contest_id']; ?>",
        contest_title: "<?php echo htmlspecialchars($contest['title'], ENT_QUOTES, 'UTF-8'); ?>",
        action: "<?php echo $action; ?>",
        account_gen_type: "<?php echo $account_gen_type ?? 'student'; ?>",
        ttype: "<?php echo ($account_gen_type ?? 'student') == 'proctor' ? '1' : '0'; ?>",
        teamgen_data_url: "/examsys/admin/teamgen_list_ajax?cid=<?php echo $contest['contest_id']; ?>&account_gen_type=<?php echo $account_gen_type ?? 'student'; ?>",
        clss_student_list_url: "/examsys/admin/clss_student_list_ajax?cid=<?php echo $contest['contest_id']; ?>"
    }
    TextAllowTab('team_description');
    
    $(function() {
        // 初始化页面
        TeamgenInit();
    });
</script>


<style type="text/css">
    /* 账号生成页面特有样式 - 复用全局 admin-page-header 样式，仅添加特定颜色 */
    
    /* 图标颜色样式 */
    .account-gen-icon-student {
        background: rgba(13, 110, 253, 0.1);
        border-color: rgba(13, 110, 253, 0.35);
    }
    
    .account-gen-icon-student i {
        color: #0d6efd;
    }
    
    .account-gen-icon-proctor {
        background: rgba(255, 152, 0, 0.12);
        border-color: rgba(255, 152, 0, 0.35);
    }
    
    .account-gen-icon-proctor i {
        color: #ff9800;
    }
    
    .account-gen-icon-reviewer {
        background: rgba(13, 202, 240, 0.12);
        border-color: rgba(13, 202, 240, 0.35);
    }
    
    .account-gen-icon-reviewer i {
        color: #0dcaf0;
    }
    
    /* 标题颜色样式 */
    .account-gen-title-student {
        color: #0d6efd;
    }
    
    .account-gen-title-proctor {
        color: #ff9800;
    }
    
    .account-gen-title-reviewer {
        color: #0dcaf0;
    }
    
    /* 页面容器样式 - 考生生成（蓝色主题） */
    .account-gen-container.account-gen-student {
        background: linear-gradient(135deg, rgba(13, 110, 253, 0.04) 0%, rgba(13, 110, 253, 0.01) 100%);
        border-radius: 0.75rem;
        padding: 1.5rem;
        margin-top: 1rem;
        margin-bottom: 2rem;
        box-shadow: 0 2px 8px rgba(13, 110, 253, 0.08);
    }
    
    /* 页面容器样式 - 监考生成（橙色主题） */
    .account-gen-container.account-gen-proctor {
        background: linear-gradient(135deg, rgba(255, 152, 0, 0.04) 0%, rgba(255, 152, 0, 0.01) 100%);
        border-radius: 0.75rem;
        padding: 1.5rem;
        margin-top: 1rem;
        margin-bottom: 2rem;
        box-shadow: 0 2px 8px rgba(255, 152, 0, 0.08);
    }
    
    /* 页面容器样式 - 阅卷生成（蓝色/信息色主题） */
    .account-gen-container.account-gen-reviewer {
        background: linear-gradient(135deg, rgba(13, 202, 240, 0.04) 0%, rgba(13, 202, 240, 0.01) 100%);
        border-radius: 0.75rem;
        padding: 1.5rem;
        margin-top: 1rem;
        margin-bottom: 2rem;
        box-shadow: 0 2px 8px rgba(13, 202, 240, 0.08);
    }
    
    /* 卡片在容器内的样式调整 */
    .account-gen-container .card {
        border-color: rgba(0, 0, 0, 0.08);
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
    }
    
    /* 考生生成页面的卡片头部 */
    .account-gen-container.account-gen-student .card-header {
        background-color: rgba(13, 110, 253, 0.06);
        border-bottom: 1px solid rgba(13, 110, 253, 0.12);
    }
    
    /* 监考生成页面的卡片头部 */
    .account-gen-container.account-gen-proctor .card-header {
        background-color: rgba(255, 152, 0, 0.06);
        border-bottom: 1px solid rgba(255, 152, 0, 0.12);
    }
    
    /* 阅卷生成页面的卡片头部 */
    .account-gen-container.account-gen-reviewer .card-header {
        background-color: rgba(13, 202, 240, 0.06);
        border-bottom: 1px solid rgba(13, 202, 240, 0.12);
    }
    
    .admin-page-header-title-right {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        margin-top: 0.25rem;
    }
    
    .admin-page-header-id {
        display: inline-flex;
        align-items: center;
        gap: 0.25rem;
        padding: 0.25rem 0.5rem;
        background-color: #f8f9fa;
        border: 1px solid #dee2e6;
        border-radius: 0.25rem;
        color: #6c757d;
        text-decoration: none;
        font-size: 0.875rem;
        transition: all 0.2s;
    }
    
    .admin-page-header-id:hover {
        background-color: #e9ecef;
        border-color: #adb5bd;
        color: #495057;
        text-decoration: none;
    }
    
    .admin-page-header-id i {
        font-size: 0.75rem;
    }
    
    .admin-page-header-title-right .en-text {
        font-size: 0.875rem;
        color: #6c757d;
        font-weight: normal;
    }
    
    .admin-page-header-right {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        flex-shrink: 0;
    }
    
    /* 双语文本样式 */
    .bilingual-inline {
        display: inline;
    }
    
    .bilingual-inline .en-text {
        margin-left: 0.5rem;
        color: #6c757d;
        font-size: 0.9em;
    }
    
    .cn-text, .en-text {
        display: inline;
    }
    
    /* 响应式设计 */
    @media (max-width: 768px) {
        .admin-page-header {
            flex-direction: column;
            gap: 1rem;
        }
        
        .admin-page-header-left {
            width: 100%;
        }
        
        .admin-page-header-right {
            width: 100%;
            justify-content: flex-end;
        }
        
        .admin-page-header-title-right {
            flex-wrap: wrap;
        }
    }
    
    #teamgen_table {
        font-family: 'Simsun', 'Microsoft Yahei Mono', 'Lato', "PingFang SC", "Microsoft YaHei", sans-serif;
        word-wrap: break-word;
    }
    
    /* 针对Bootstrap Table生成的工具栏结构进行修复 */
    .fixed-table-toolbar {
        margin: 0 !important;
        padding: 0 !important;
    }
    
    .fixed-table-toolbar .bs-bars {
        float: none !important;
        display: block !important;
        width: 100% !important;
    }
    
    .fixed-table-toolbar .bs-bars.float-right {
        float: none !important;
    }
    
    /* 自定义工具栏样式 - 强制左对齐 */
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
    
    /* 强制标题左对齐，移除所有默认间距 */
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
    
    /* 确保图标不产生额外间距 */
    #toolbar_title i {
        margin-right: 0.5rem;
    }
    
    /* 实际数据状态样式 */
    .toolbar-actual-data {
        background-color: rgba(13, 110, 253, 0.1) !important;
        border-left: 4px solid #0d6efd !important;
        padding: 0.75rem 1rem !important;
        border-radius: 0.375rem !important;
    }
    
    .toolbar-actual-data #toolbar_title {
        color: #0d6efd !important;
        font-size: 1.1rem !important;
        font-weight: 600 !important;
    }
    
    .toolbar-actual-data #toolbar_title i {
        color: #0d6efd !important;
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
</style>

<!-- 保留原有的监考人员表和账号表（用于显示已生成的账号） -->
<div id="print_pass_toolbar" style="display: none;">
    <div class="btn-group input-group">
        <button class="btn btn-outline-success" id="print_as_table"><i class="bi bi-printer"></i>打印密码-按表格</button>
        <button class="btn btn-outline-success" id="print_as_page"><i class="bi bi-printer"></i>打印密码-按页</button>
    </div>
</div>
<div id="admin_title_div" style="display: none;">
    <h2>监考人员表</h2>
</div>
<table
    id="admingen_table"
    data-toggle="table"
    data-toolbar="#admin_title_div"
    data-buttons-align="right"
    data-search="true"
    data-search-align="right"
    data-sort-name="team_id"
    data-sort-order="asc"
    data-show-export="true"
    data-unique-id="team_id"
    data-url="/{$module}/admin/teamgen_list_ajax?cid={$contest['contest_id']}&ttype=1"
    data-pagination="false"
    data-method="get"
    data-export-types="['csv', 'excel', 'json', 'png']"
    data-export-options='{"fileName": "Team_Generated"}'
    style="display: none;"
>
    <thead>
    <tr>
        <th data-field="team_id" data-align="center" data-valign="middle" data-sortable="true" data-width="55">账号</th>
        <th data-field="name" data-align="left" data-valign="middle" data-width="160" >姓名</th>
        <th data-field="school" data-align="center" data-valign="middle" data-sortable="true"  data-width="200">所在单位</th>
        <th data-field="room" data-align="center" data-valign="middle" data-sortable="true"  >考场</th>
        <th data-field="password" data-align="center" data-valign="middle"  data-width="60" >密码</th>
        <th data-field="privilege" data-align="center" data-valign="middle"  data-width="60" >权限</th>
        <th data-field="delete" data-align="center" data-valign="middle"  data-width="60" data-formatter="FormatterDel">删除</th>
    </tr>
    </thead>
</table>

<script>
// 格式化序号
function FormatterIndex(value, row, index) {
    return index + 1;
}

// 格式化密码列
function FormatterPassword(value, row, index, field) {
    if (!value || value === '' || value === null) {
        return '<span class="text-muted">-</span>';
    }
    if (value === '[SYS_PASS]' || value === '[SYS_PASS]') {
        return '<span class="badge bg-info"><i class="bi bi-key me-1"></i>系统密码</span>';
    }
    return '<code class="text-primary">' + escapeHtml(value) + '</code>';
}

// ID列样式函数 - 强制不换行
function cellStyleTeamId(value, row, index, field) {
    return {
        classes: "text-nowrap",
        css: {
            "white-space": "nowrap",
            overflow: "hidden",
            "text-overflow": "ellipsis",
        },
    };
}

let admingen_table = $('#admingen_table');
let delete_infoed = false;

// 保留原有的删除功能（用于监考人员表）
admingen_table.on('click-cell.bs.table', function(e, field, td, row){
    if(field == 'delete') {
        if(!delete_infoed) {
            alerty.message("双击删除.")
            delete_infoed = true;
        }
    }
});

admingen_table.on('dbl-click-cell.bs.table', function(e, field, td, row){
    if(field == 'delete') {
        $.post('team_del_ajax?cid=' + TEAMGEN_CONFIG.contest_id, {'team_id': row.team_id}, function(ret) {
            if(ret.code == 1) {
                admingen_table.bootstrapTable('removeByUniqueId', row.team_id);
                alerty.success(`${row.team_id}.${row.name} ${ret.msg}`);
            } else {
                alerty.error(`${row.team_id}.${row.name} ${ret.msg}`);
            }
        });
    }
});
</script>
