{include file="../../csgoj/view/public/base_csg_switch" /}

<div class="admin-page-header{if $contestStatus == 2} admin-page-header--with-ended-notice{/if}">
    <div class="admin-page-header-left">
        <div class="admin-page-header-icon">
            <i class="bi bi-people-fill"></i>
        </div>
        <h1 class="admin-page-header-title">
            <div class="admin-page-header-title-main">
                {if $action == 'contest_staffgen'}
                    工作人员生成
                {else /}
                    队伍生成
                {/if}
            </div>
            <div class="admin-page-header-title-right">
                <a href="__CPC__/contest/contest?cid={$contest['contest_id']}" class="admin-page-header-id">
                    <i class="bi bi-hash"></i> {$contest['contest_id']}
                </a>
                <span class="en-text">
                    {if $action == 'contest_staffgen'}
                        Staff Generator
                    {else /}
                        Team Generator
                    {/if}
                </span>
            </div>
        </h1>
    </div>
    {if $contestStatus == 2}
    <div class="admin-page-header-ended-notice" role="status">
        <div class="admin-page-header-ended-notice__line-cn">
            <i class="bi bi-lock-fill me-1" aria-hidden="true"></i>比赛已结束，不允许调整{if $action == 'contest_staffgen'}工作人员{else /}队伍{/if}
        </div>
        <div class="admin-page-header-ended-notice__line-en en-text">
            Contest ended, {if $action == 'contest_staffgen'}staff{else /}team{/if} generation not allowed
        </div>
    </div>
    {/if}
    <div class="admin-page-header-right">
        <button type="button" class="btn btn-outline-info btn-sm" data-bs-toggle="collapse" data-bs-target="#teamgen_help_div" aria-expanded="false" aria-controls="teamgen_help_div">
            <span class="cn-text"><i class="bi bi-question-circle me-1"></i>帮助</span><span class="en-text">Help</span>
        </button>
    </div>
</div>
<div class="container admin-import-container">
    <article id="teamgen_help_div" class="alert alert-info collapse csg-admin-help-collapse">
        {if $action == 'contest_staffgen'}
            <h5 class="bilingual-inline">
                文本输入模式
                <span class="en-text">Text Input Mode</span>
            </h5>
            <p>每行一个工作人员，该工作人员信息由制表符<code>\t</code>隔开。信息从左到右依次为：</p>
            <p>账号、姓名、房间、权限、密码{if isset($contestGroupContext) && intval($contestGroupContext['is_multi_group']) == 1}、分组{/if}，例如：</p>
            <p><code>admin01[\t]郭大侠[\t]A区[\t]admin[\t]123456{if isset($contestGroupContext) && intval($contestGroupContext['is_multi_group']) == 1}[\t]onsite{/if}</code></p>
            <p>可用权限如下：</p>
            <ul>
                <li><code>admin</code>: 监考员，可管理部分比赛配置</li>
                <li><code>printer</code>: 打印管理员，负责打印机</li>
                <li><code>balloon_manager</code>: 气球管理员，建议只设置一名</li>
                <li><code>balloon_sender</code>: 气球配送员，可查看气球队列和领取气球任务</li>
                <li><code>watcher</code>: 观察员，外榜、直播用</li>
                <li><code>ccs_reader</code>: CCS API 只读账号，供外部工具（记分板、CDS 等）对接</li>
            </ul>
            <p>对于 <code>printer</code>、<code>balloon_manager</code>、<code>balloon_sender</code>，如不指定房间，则由使用者在页面上自行筛选房间/区域。如指定房间（可多值，英文或中文逗号分隔），则气球总览、气球队列等页面会自动锁定为该范围，且后端拒绝处理范围外队伍的气球状态。</p>
            {if isset($contestGroupContext) && intval($contestGroupContext['is_multi_group']) == 1}
            <p>比赛存在多个分组时，<code>printer</code>、<code>balloon_manager</code>、<code>balloon_sender</code> 可填写分组；填写后对应赛务页面会自动锁定该分组。</p>
            {/if}
        {else /}
            <h5 class="bilingual-inline">
                文本输入模式
                <span class="en-text">Text Input Mode</span>
            </h5>
        <p>每行一个队伍，该队伍信息由制表符<code>\t</code>隔开（从Excel文档复制即可）。信息从左到右依次为：</p>
            <p>队号（纯数字）、队名、队名英文、学校、地区、队员、教练、房间（如果有的话）、队伍类型（0普通/1女队/2打星）、预设密码{if isset($contestGroupContext) && intval($contestGroupContext['is_multi_group']) == 1}、赛事归属（逗号分隔，对应导入字段 groups）{/if}，例如：</p>
            <p><code>001[\t]XX大学一队[\t]XX University Team 1[\t]XX大学[\t]中国[\t]队员一、队员二、队员三[\t]教练名[\t]机房A[\t]0[\t]123456{if isset($contestGroupContext) && intval($contestGroupContext['is_multi_group']) == 1}[\t]provincial,national{/if}</code></p>
            <p>队号、密码、房间、队名英文、地区可为空，由系统自动生成，但"<code>\t</code>"分隔符必须有，信息是以第几个分隔符来对应的。</p>
        <p>比如 <code>[\t][\t]测试[\t][\t]333[\t]</code>，即会自动生成一个这样的队伍：</p>
            <div class="table-responsive">
                <table class="table table-sm table-bordered">
                    <thead class="table-light">
                        <tr>
                            <th>Team ID</th><th>Team Name</th><th>Team Name EN</th><th>School</th><th>Region</th>
                            <th>Member</th><th>Coach</th><th>Room</th><th>Team Kind</th><th>Password</th>
                        </tr>
                    </thead>
            <tbody>
                        <tr><td>team0001</td><td>一队</td><td>null</td><td>测试</td><td>null</td><td>null</td><td>333</td><td></td><td>0</td><td>V395JKQB</td></tr>
            </tbody>
        </table>
            </div>
        <p>与报名系统导出的表格对应，可从excel表格复制对应的列直接粘贴在这里生成队伍。</p>
        {/if}
        
        <h5 class="bilingual-inline">
            Excel导入模式
            <span class="en-text">Excel Import Mode</span>
        </h5>
        <p>点击"下载模板"按钮下载Excel模板，填写信息后上传即可批量导入。</p>
        <p>模板包含所有必要字段；Excel 中部分枚举列提供下拉（选项见子表 A 列，说明见 B 列）：{if $action == 'contest_staffgen'}权限{else /}国家/地区（有地区数据时）、队伍类型{/if}。支持双语队名。</p>
        {if isset($contestGroupContext) && intval($contestGroupContext['is_multi_group']) == 1}
        <p class="bilingual-inline">多分组时，主表「{if $action == 'contest_staffgen'}分组{else /}赛事归属{/if}」列为手填，可填<strong>多个</strong> <code>group_id</code>，用英文逗号 <code>,</code> 或中文逗号 <code>，</code> 分隔；候选与释义见工作表「赛事归属」的 A、B 列（该列<strong>无</strong>下拉）。<span class="en-text">Multi-group: enter multiple <code>group_id</code> separated by <code>,</code> (ASCII) or <code>，</code> (U+FF0C). See sheet「赛事归属」columns A/B; no dropdown on this field.</span></p>
        {/if}
        {if $action != 'contest_staffgen'}
        <p class="bilingual-inline">队伍类型可填 <code>0</code> / <code>1</code> / <code>2</code>，或中文、英文关键词（如 正式、女队、打星、Regular、Girls、Star）；与「0 / 正式 …」等混写亦可，导入时会自动识别。Excel 主表「队伍类型」列的下拉<strong>仅列出数字</strong>，完整中英对照见工作表「队伍类型」的说明列，无需抄写整串展示文案。<span class="en-text">Team type: enter <code>0</code>/<code>1</code>/<code>2</code> or keywords (e.g. Regular, Girls, Star). The main-sheet dropdown lists digits only; open the hidden sheet「队伍类型」column B for full bilingual hints.</span></p>
        {/if}
    </article>
    
    {if $contestStatus != 2}
    
    
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
    <form id="contest_teamgen_form" method='post' action="__CPC__/admin/contest_teamgen_ajax?cid={$contest['contest_id']}">
                        <div class="mb-3">
                            <textarea id="team_description" class="form-control" 
                                placeholder="每行一个{if $action == 'contest_staffgen'}工作人员{else /}队伍{/if}，用制表符分隔... / One {if $action == 'contest_staffgen'}staff{else /}team{/if} per line, separated by tabs..." 
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
                                        重新生成所有{if $action == 'contest_staffgen'}工作人员{else /}队伍{/if}
                                        </span><span class="en-text">Regenerate All {if $action == 'contest_staffgen'}Staff{else /}Teams{/if}</span>
                                    </div>
                                    <div class="csg-switch-setting-subtitle">
                                        开启后，提交导入将清除所有现有{if $action == 'contest_staffgen'}工作人员{else /}队伍{/if}，重新生成新的{if $action == 'contest_staffgen'}工作人员{else /}队伍{/if}数据。
                                        <span class="en-text">When enabled, all existing {if $action == 'contest_staffgen'}staff{else /}teams{/if} will be cleared and new {if $action == 'contest_staffgen'}staff{else /}teams{/if} data will be generated when submitting data.</span>
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
                                               title="点击切换重新生成队伍设置">
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
                            <div >
                                设置种子可确保相同team_id的密码固定不变，留空则每次生成随机密码
                                <span class="en-text">Set seed to ensure consistent passwords for same team_id, leave empty for random passwords</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
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
            <div class="btn-group" id="export_teamgen_pageteam_group" role="group">
                <button type="button" class="btn btn-primary bilingual-button csg-btn-dropdown" data-bs-toggle="dropdown" aria-expanded="false" id="export_teamgen_pageteam_toggle" title="导出密码条 / Export password sheet">
                    <span class="cn-text"><i class="bi bi-download me-1"></i>导出密码条<i class="bi bi-chevron-down csg-btn-dropdown-chevron" aria-hidden="true"></i></span>
                    <span class="en-text">Export Password Sheet</span>
                </button>
                <ul class="dropdown-menu dropdown-menu-end csg-dropdown-menu-bilingual" aria-labelledby="export_teamgen_pageteam_toggle">
                    <li>
                        <button type="button" class="dropdown-item" id="export_teamgen_pageteam_item_single">
                            <span class="cn-text">导出全部（单文件 xlsx）</span>
                            <span class="en-text">Export all (single xlsx)</span>
                        </button>
                    </li>
                    <li>
                        <button type="button" class="dropdown-item" id="export_teamgen_pageteam_item_by_zone">
                            <span class="cn-text">按分区打包（多 xlsx + zip）</span>
                            <span class="en-text">By zone (multi xlsx in zip)</span>
                        </button>
                    </li>
                </ul>
                <button type="button" class="btn btn-info bilingual-button" id="export_standard_btn">
                    <span><i class="bi bi-download me-1"></i>导出标准数据</span>
                    <span class="en-text">Export Standard Data</span>
                </button>
            </div>
        </div>
    </div>
    <div id="error_summary" class="alert alert-warning mt-2" style="display: none;">
        <i class="bi bi-exclamation-triangle me-2"></i>
        <span id="error_count">0</span> 行数据有错误，请检查后重新导入
        <span class="en-text">rows have errors, please check and re-import</span>
    </div>
</div>

<div class="table-responsive teamgen-table-wrap">
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
        class="table table-striped table-hover teamgen-main-table"
        style="table-layout: auto; width: 100%;"
>
    <thead>
    <tr>
            <th data-field="idx" data-align="center" data-valign="middle" data-sortable="false" data-width="44" data-formatter="FormatterIndex" data-cell-style="cellStyleTeamgenIdx" title="#"><span class="teamgen-th-stack"><span class="teamgen-th-cn">#</span><span class="teamgen-th-en en-text">#</span></span></th>
            <th data-field="team_id" data-align="center" data-valign="middle" data-sortable="true" {if $action == 'contest_staffgen'}{else /}data-width="108" {/if}data-cell-style="cellStyleTeamId" title="账号 / ID"><span class="teamgen-th-stack"><span class="teamgen-th-cn">账号</span><span class="teamgen-th-en en-text">ID</span></span></th>
            <th data-field="name" data-align="left" data-valign="middle" data-cell-style="cellStyleTeamgenName" title="队名 / Name"><span class="teamgen-th-stack"><span class="teamgen-th-cn">队名</span><span class="teamgen-th-en en-text">Name</span></span></th>
            {if $action == 'contest_teamgen'}
            <th data-field="name_en" data-align="left" data-valign="middle" data-cell-style="cellStyleTeamgenNameEn" title="英文名 / EN"><span class="teamgen-th-stack"><span class="teamgen-th-cn">英文名</span><span class="teamgen-th-en en-text">EN</span></span></th>
            <th data-field="school" data-align="left" data-valign="middle" data-formatter="FormatterTeamgenSchool" data-cell-style="cellStyleTeamgenSchool" title="学校/组织 / School/Organization"><span class="teamgen-th-stack"><span class="teamgen-th-cn">学校/组织</span><span class="teamgen-th-en en-text">School / Org</span></span></th>
            <th data-field="region" data-align="center" data-valign="middle" data-formatter="FormatterTeamgenRegion" data-cell-style="cellStyleTeamgenRegion" title="地区 / Region"><span class="teamgen-th-stack"><span class="teamgen-th-cn">地区</span><span class="teamgen-th-en en-text">Region</span></span></th>
            <th data-field="tmember" data-align="left" data-valign="middle" data-cell-style="cellStyleTeamgenMembers" title="队员 / Members"><span class="teamgen-th-stack"><span class="teamgen-th-cn">队员</span><span class="teamgen-th-en en-text">Members</span></span></th>
            <th data-field="coach" data-align="left" data-valign="middle" data-width="72" data-cell-style="cellStyleTeamgenCoach" title="教练 / Coach"><span class="teamgen-th-stack"><span class="teamgen-th-cn">教练</span><span class="teamgen-th-en en-text">Coach</span></span></th>
            <th data-field="tkind" data-align="center" data-valign="middle" data-formatter="FormatterTkind" data-width="50" data-cell-style="cellStyleTeamgenTkind" title="类型 / Type"><span class="teamgen-th-stack"><span class="teamgen-th-cn">类型</span><span class="teamgen-th-en en-text">Type</span></span></th>
            {/if}
            {if isset($contestGroupContext) && intval($contestGroupContext['is_multi_group']) == 1}
            <th data-field="groups" data-align="center" data-valign="middle" data-formatter="FormatterContestGroupAffiliationColumn" data-cell-style="FormatterContestGroupAffiliationColumnCellStyle" data-width="100" title="分组 / Groups"><span class="teamgen-th-stack"><span class="teamgen-th-cn">分组</span><span class="teamgen-th-en en-text">Groups</span></span></th>
            {/if}
            <th data-field="room" data-align="center" data-valign="middle" data-formatter="FormatterTeamgenRoom" data-cell-style="cellStyleTeamgenRoom" title="分区 / Zone"><span class="teamgen-th-stack"><span class="teamgen-th-cn">分区</span><span class="teamgen-th-en en-text">Zone</span></span></th>
            {if $action == 'contest_staffgen'}
            <th data-field="privilege" data-align="center" data-valign="middle" data-width="120" data-formatter="FormatterTeamgenPrivilege" data-cell-style="cellStyleTeamgenPrivilege" title="权限 / Privilege"><span class="teamgen-th-stack"><span class="teamgen-th-cn">权限</span><span class="teamgen-th-en en-text">Priv</span></span></th>
            {/if}
            <th data-field="password" data-align="center" data-valign="middle" data-width="92" data-cell-style="cellStyleTeamgenPassword" title="密码 / Password"><span class="teamgen-th-stack"><span class="teamgen-th-cn">密码</span><span class="teamgen-th-en en-text">Pwd</span></span></th>
        <th data-field="validation_errors" data-align="center" data-valign="middle" data-width="52" data-formatter="FormatterValidationErrors" data-visible="false" data-sortable="true" data-cell-style="cellStyleTeamgenErrCol" title="校验 / Validation"><span class="teamgen-th-stack"><span class="teamgen-th-cn">校验</span><span class="teamgen-th-en en-text">Valid</span></span></th>
        {if ($action == 'contest_teamgen' || $action == 'contest_staffgen') && $contestStatus != 2}
        <th data-field="modify" data-align="center" data-valign="middle" data-width="56" data-formatter="FormatterModify" data-sortable="false" data-cell-style="cellStyleTeamgenAct" title="改 / Edit"><span class="teamgen-th-stack"><span class="teamgen-th-cn">改</span><span class="teamgen-th-en en-text">Edit</span></span></th>
        <th data-field="delete" data-align="center" data-valign="middle" data-width="52" data-formatter="FormatterDel" data-cell-style="cellStyleTeamgenAct" title="删 / Del"><span class="teamgen-th-stack"><span class="teamgen-th-cn">删</span><span class="teamgen-th-en en-text">Del</span></span></th>
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

<script type="text/javascript">
    
    var TEAMGEN_CONFIG = {
        contest_id: "<?php echo $contest['contest_id']; ?>",
        contest_title: "<?php echo htmlspecialchars($contest['title'], ENT_QUOTES, 'UTF-8'); ?>",
        action: "<?php echo $action; ?>",
        ttype: "<?php echo $action == 'contest_staffgen' ? '1' : '0'; ?>",
        teamgen_data_url: "/cpcsys/admin/teamgen_list_ajax?cid=<?php echo $contest['contest_id']; ?>&ttype=<?php echo $action == 'contest_staffgen' ? '1' : '0'; ?>",
        is_multi_group: <?php echo (isset($contestGroupContext) && intval($contestGroupContext['is_multi_group']) == 1) ? 'true' : 'false'; ?>,
        contest_groups: <?php echo json_encode(isset($contestGroupContext['groups']) ? $contestGroupContext['groups'] : [], JSON_UNESCAPED_UNICODE); ?>
    }
    TextAllowTab('team_description');
    
    $(function() {
        // 初始化页面
        if (TEAMGEN_CONFIG.action === 'contest_staffgen') {
            StaffgenInit();
        } else {
            TeamgenInit();
        }
        
        // 数据加载已改为手动处理，无需监听事件
    });
</script>


{include file="../../csgoj/view/public/js_exceljs" /}
{include file="../../csgoj/view/public/js_zip" /}
{css href="__STATIC__/css/bilingual.css" /}
{css href="__STATIC__/css/import_overlay.css" /}
{js href="__STATIC__/js/bilingual.js" /}
{js href="__STATIC__/csgoj/contest/teamgen.js" /}
{if $action == 'contest_teamgen'}
{include file="../../cpcsys/view/admin/team_modify" /}
{/if}
{if $action == 'contest_staffgen'}
{include file="../../cpcsys/view/admin/staff_modify" /}
{/if}

<style type="text/css">
    .teamgen-table-wrap {
        max-width: 100%;
    }
    #teamgen_table.teamgen-main-table {
        font-family: 'Simsun', 'Microsoft Yahei Mono', 'Lato', "PingFang SC", "Microsoft YaHei", sans-serif;
        font-size: 0.8125rem;
        word-wrap: break-word;
    }
    #teamgen_table.teamgen-main-table tbody td {
        vertical-align: middle;
    }
    #teamgen_table.teamgen-main-table thead th {
        font-size: 0.72rem;
        font-weight: 600;
        white-space: normal !important;
        word-break: keep-all;
        vertical-align: bottom !important;
        line-height: 1.12;
        padding: 0.32rem 0.28rem !important;
    }
    #teamgen_table.teamgen-main-table .teamgen-th-stack {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: flex-end;
        text-align: center;
        gap: 0.1rem;
        min-height: 2.1rem;
    }
    #teamgen_table.teamgen-main-table .teamgen-th-cn {
        display: block;
        line-height: 1.1;
    }
    #teamgen_table.teamgen-main-table .teamgen-th-en {
        display: block !important;
        font-size: 0.62rem !important;
        font-weight: 500 !important;
        opacity: 0.86;
        line-height: 1.05;
    }
    #teamgen_table.teamgen-main-table thead th[data-field="name"] .teamgen-th-stack,
    #teamgen_table.teamgen-main-table thead th[data-field="name_en"] .teamgen-th-stack,
    #teamgen_table.teamgen-main-table thead th[data-field="school"] .teamgen-th-stack,
    #teamgen_table.teamgen-main-table thead th[data-field="tmember"] .teamgen-th-stack,
    #teamgen_table.teamgen-main-table thead th[data-field="coach"] .teamgen-th-stack {
        align-items: flex-start;
        text-align: left;
    }
    #teamgen_table.teamgen-main-table thead th[data-field="region"] .teamgen-th-stack,
    #teamgen_table.teamgen-main-table thead th[data-field="groups"] .teamgen-th-stack,
    #teamgen_table.teamgen-main-table thead th[data-field="room"] .teamgen-th-stack {
        align-items: center;
        text-align: center;
    }
    #teamgen_table.teamgen-main-table tbody td[data-field="region"],
    #teamgen_table.teamgen-main-table tbody td[data-field="groups"],
    #teamgen_table.teamgen-main-table tbody td[data-field="room"],
    #teamgen_table.teamgen-main-table tbody td[data-field="privilege"] {
        text-align: center;
    }
    /* 地区 / 分组 / 分区 / 权限：同结构 flex 容器，内容居中（分组多 tag 布局见 bilingual.css .csg-contest-group-affiliation-cell） */
    #teamgen_table.teamgen-main-table tbody td[data-field="region"] .teamgen-hash-cell,
    #teamgen_table.teamgen-main-table tbody td[data-field="room"] .teamgen-hash-cell,
    #teamgen_table.teamgen-main-table tbody td[data-field="privilege"] .teamgen-hash-cell,
    #teamgen_table.teamgen-main-table tbody td[data-field="groups"] .csg-contest-group-affiliation-cell,
    #teamgen_table.teamgen-main-table tbody td[data-field="groups"] .teamgen-hash-cell {
        display: flex;
        align-items: center;
        justify-content: center;
        box-sizing: border-box;
        width: 100%;
    }
    /* 类型列 badge 等宽：见 bilingual.css .csg-badge-eq；字号与其它列 badge 一致 */
    #teamgen_table.teamgen-main-table tbody td[data-field="tkind"] {
        text-align: center;
    }
    #teamgen_table.teamgen-main-table .badge:not(.csg-badge-eq) {
        font-size: 0.65rem;
        font-weight: 600;
        padding: 0.18em 0.42em;
        line-height: 1.2;
    }
    #teamgen_table.teamgen-main-table .badge.csg-badge-eq {
        font-size: 0.65rem;
        font-weight: 600;
        padding: 0.18em 0.42em;
        line-height: 1.2;
    }
    #teamgen_table.teamgen-main-table .badge:not(.csg-badge-eq) .en-text,
    #teamgen_table.teamgen-main-table .badge.csg-badge-eq .en-text {
        font-size: 0.58rem;
        margin-left: 0;
    }
    #teamgen_table.teamgen-main-table .csg-hash-tag-list {
        gap: 0.2rem !important;
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
<style type="text/css">
    #teamgen_help_div {
        border: 0;
        border-radius: 0.75rem;
        color: var(--bs-body-color);
        background: var(--bs-body-bg);
        box-shadow: 0 0.4rem 1.2rem rgba(15, 23, 42, 0.08);
        padding: 1rem 1.1rem;
    }
    #teamgen_help_div h5 {
        margin-top: 0.35rem;
        margin-bottom: 0.55rem;
        font-weight: 700;
    }
    #teamgen_help_div p {
        margin-bottom: 0.45rem;
        line-height: 1.55;
    }
    #teamgen_help_div ul {
        margin-bottom: 0.65rem;
    }
    #teamgen_help_div code {
        color: #334155;
        background: #f1f5f9;
        border-radius: 0.35rem;
        padding: 0.08rem 0.32rem;
    }
</style>