<div class="admin-page-header">
    <div class="admin-page-header-left">
        <div class="admin-page-header-icon">
            <i class="bi bi-journal-text"></i>
        </div>
        <h1 class="admin-page-header-title">
            <div class="admin-page-header-title-main csg-bilingual-stack">
                <span class="cn-text">出题草稿</span>
                <span class="en-text">Local Draft Questions</span>
            </div>
            <div class="admin-page-header-title-meta-right">
                {assign name="perm_context" value="exadmin_question_draft_list" /}
                {assign name="perm_level" value="info" /}
                {assign name="perm_role_cn" value="教师" /}
                {assign name="perm_role_en" value="Teacher" /}
                {assign name="perm_desc_cn" value="草稿仅保存在浏览器；可导出 zip 交管理员导入" /}
                {assign name="perm_desc_en" value="Browser-only drafts; export zip for admin import" /}
                {include file="public/permission_hint" /}
            </div>
        </h1>
    </div>
    <div class="admin-page-header-actions">
        <a class="btn btn-primary btn-sm bilingual-button csg-btn-compact" href="/exadmin/question/question_draft_edit">
            <span class="cn-text"><i class="bi bi-plus-circle"></i> 新建草稿</span>
            <span class="en-text">New Draft</span>
        </a>
        <button type="button" class="btn btn-outline-primary btn-sm bilingual-button csg-btn-compact" id="draft_import_btn">
            <span class="cn-text"><i class="bi bi-upload"></i> 导入</span>
            <span class="en-text">Import</span>
        </button>
        <button type="button" class="btn btn-outline-success btn-sm bilingual-button csg-btn-compact" id="draft_export_selected_btn">
            <span class="cn-text"><i class="bi bi-file-earmark-zip"></i> 导出所选</span>
            <span class="en-text">Export Selected</span>
        </button>
        <button type="button" class="btn btn-outline-secondary btn-sm bilingual-button csg-btn-compact" id="draft_refresh_btn">
            <span class="cn-text"><i class="bi bi-arrow-repeat"></i> 刷新</span>
            <span class="en-text">Refresh</span>
        </button>
    </div>
</div>

<div class="container">
    <div class="alert alert-warning">
        <strong>重要：</strong>本页所有数据都仅保存在本机浏览器，不会写入服务器题库；清理浏览器数据/更换设备会导致丢失。建议及时导出 zip 交给课程管理员导入。
        <span class="en-text">Drafts are stored locally in your browser  and will NOT be saved to the database. Export a zip and send it to an admin for import.</span>
    </div>

    {css href="__STATIC__/exadmin/exadmin.css" /}
    {css href="__STATIC__/examsys/examsys.css" /}
    {include file="../../csgoj/view/public/pkg_code_highlight" /}
    {css href="__STATIC__/csgoj/code_show.css" /}

    <input type="hidden" id="tpl_now_course_key" value="{$NOW_COURSE_KEY|default=''}">
    <input type="file" id="draft_import_file" class="d-none" accept=".zip,.json,application/zip,application/json">

    {assign name="toolbar_id" value="draft_question_toolbar" /}
    {assign name="toolbar_extra_class" value="mb-2" /}
    {assign name="show_refresh_btn" value="0" /}
    {assign name="btn_clear_id" value="draft_question_clear" /}
    {assign name="filter_check_class" value="draft_question_filter_check" /}
    {assign name="filter_id_prefix" value="draft" /}
    {assign name="filter_all_id" value="draft_filter_all" /}
    {assign name="filter_clear_id" value="draft_filter_clear" /}
    {assign name="search_input_id" value="draft_search_input" /}
    {assign name="search_placeholder" value="标题/来源/作者/标签" /}
    {assign name="search_width" value="220px" /}
    {assign name="show_select_all" value="1" /}
    {assign name="select_all_id" value="draft_select_all" /}
    {assign name="select_all_label_cn" value="全选导出" /}
    {assign name="select_all_label_en" value="Select all" /}
    {assign name="pkind_default_checked" value="0" /}
    {include file="public/question_filter_toolbar" /}

    <div id="draft_question_table_div">
        <table
            id="draft_question_table"
            data-toggle="table"
            data-pagination="true"
            data-page-list="[25,50,100]"
            data-page-size="25"
            data-side-pagination="client"
            data-search="false"
            data-sort-name="update_at"
            data-sort-order="desc"
            data-toolbar="#draft_question_toolbar"
            data-classes="table table-bordered table-hover table-striped"
        >
            <thead>
            <tr>
                <th data-field="__sel" data-align="center" data-valign="middle" data-width="40" data-formatter="FormatterDraftSelect"></th>
                <th data-field="ex_question_id" data-align="center" data-valign="middle" data-width="90" data-formatter="FormatterDraftQuestionId">ID<span class="en-text">ID</span></th>
                <th data-field="title" data-align="left" data-valign="middle" data-formatter="FormatterDraftQuestionTitle">标题<span class="en-text">Title</span></th>
                <th data-field="pkind" data-align="center" data-valign="middle" data-width="100" data-formatter="FormatterQuestionType" data-cell-style="StyleQuestionType">题型<span class="en-text">Type</span></th>
                <th data-field="source" data-align="left" data-valign="middle" data-width="120">来源<span class="en-text">Source</span></th>
                <th data-field="author" data-align="center" data-valign="middle" data-width="100" data-formatter="FormatterQuestionAuthor">作者<span class="en-text">Author</span></th>
                <th data-field="label" data-align="left" data-valign="middle" data-width="150" data-formatter="FormatterQuestionLabel">标签<span class="en-text">Label</span></th>
                <th data-field="update_at" data-align="center" data-valign="middle" data-width="80" data-sortable="true" data-formatter="FormatterDate">更新<span class="en-text">Updated</span></th>
                <th data-field="operate" data-align="center" data-valign="middle" data-width="120" data-formatter="FormatterDraftOperate">操作<span class="en-text">Actions</span></th>
            </tr>
            </thead>
        </table>
    </div>
</div>

{css href="__STATIC__/csgoj/oj_problem.css" /}
{include file="../../csgoj/view/public/js_zip" /}
{js href="__STATIC__/csgoj/oj_problem.js" /}
{js href="__STATIC__/csgoj/code_render.js" /}
{js href="__STATIC__/examsys/ex_global.js" /}
{js href="__STATIC__/examsys/question_default.js" /}
{js href="__STATIC__/examsys/question_md_utils.js" /}
{js href="__STATIC__/examsys/question_render.js" /}
{js href="__STATIC__/examsys/question_preview.js" /}
{js href="__STATIC__/exadmin/exadmin_formatter.js" /}
{js href="__STATIC__/exadmin/question_list.js" /}
{js href="__STATIC__/exadmin/question_draft_table.js" /}
{js href="__STATIC__/exadmin/permission_hint.js" /}


