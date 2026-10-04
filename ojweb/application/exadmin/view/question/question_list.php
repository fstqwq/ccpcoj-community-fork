<div class="admin-page-header">
    <div class="admin-page-header-left">
        <div class="admin-page-header-icon">
            <i class="bi bi-list-ul"></i>
        </div>
        <h1 class="admin-page-header-title">
            <div class="admin-page-header-title-main csg-bilingual-stack">
                <span class="cn-text">考题列表</span>
                <span class="en-text">Question List</span>
            </div>
            <div class="admin-page-header-title-meta-right">
                {if isset($can_manage_question_bank) && $can_manage_question_bank}
                    {assign name="perm_context" value="exadmin_question_list" /}
                    {assign name="perm_level" value="success" /}
                    {assign name="perm_role_cn" value="管理员" /}
                    {assign name="perm_role_en" value="Admin" /}
                    {assign name="perm_desc_cn" value="可新增/编辑/导入/导出题库" /}
                    {assign name="perm_desc_en" value="Can add/edit/import/export questions" /}
                {else /}
                    {assign name="perm_context" value="exadmin_question_list" /}
                    {assign name="perm_level" value="warning" /}
                    {assign name="perm_role_cn" value="教师（只读）" /}
                    {assign name="perm_role_en" value="Teacher (read-only)" /}
                    {assign name="perm_desc_cn" value="可查看题库；本地出题可使用“出题草稿”" /}
                    {assign name="perm_desc_en" value="Can view questions; use Draft Questions for local question creation" /}
                {/if}
                {include file="public/permission_hint" /}
            </div>
        </h1>
    </div>
    <div class="admin-page-header-actions">
        {if isset($can_manage_question_bank) && $can_manage_question_bank}
        <a href="/exadmin/question/question_add" class="btn btn-primary btn-sm">
            <i class="bi bi-plus-circle"></i>
            <span class="cn-text">添加考题</span>
            <span class="en-text">Add Question</span>
        </a>
        {/if}
    </div>
</div>

{assign name="toolbar_id" value="question_toolbar" /}
{assign name="toolbar_extra_class" value="" /}
{assign name="show_refresh_btn" value="1" /}
{assign name="btn_refresh_id" value="question_refresh" /}
{assign name="refresh_title" value="刷新 (Refresh)" /}
{assign name="btn_clear_id" value="question_clear" /}
{assign name="filter_check_class" value="question_filter_check" /}
{assign name="filter_id_prefix" value="question" /}
{assign name="filter_all_id" value="question_filter_all" /}
{assign name="filter_clear_id" value="question_filter_clear" /}
{assign name="search_input_id" value="question_search_input" /}
{assign name="search_input_name" value="search" /}
{assign name="search_input_class" value="question_filter" /}
{assign name="search_placeholder" value="题号/标题/来源/作者" /}
{assign name="search_width" value="200px" /}
{include file="public/question_filter_toolbar" /}

<div id="question_table_div">
    <table
        id="question_table"
        class="bootstraptable_refresh_local"
        data-toggle="table"
        data-url="/exadmin/question/question_list_ajax"
        data-pagination="true"
        data-page-list="[25,50,100]"
        data-page-size="25"
        data-side-pagination="server"
        data-query-params="queryParams"
        data-response-handler="responseHandler"
        data-method="get"
        data-search="false"
        data-search-align="left"
        data-sort-name="ex_question_id"
        data-sort-order="desc"
        data-pagination-v-align="bottom"
        data-pagination-h-align="left"
        data-pagination-detail-h-align="right"
        data-toolbar="#question_toolbar"
        data-classes="table table-bordered table-hover table-striped"
    >
        <thead>
        <tr>
            <th data-field="ex_question_id" data-align="center" data-valign="middle" data-sortable="true" data-width="80" data-formatter="FormatterQuestionId">ID<span class="en-text">ID</span></th>
            <th data-field="title" data-align="left" data-valign="middle" data-sortable="true" data-formatter="FormatterQuestionTitle">标题<span class="en-text">Title</span></th>
            <th data-field="pkind" data-align="center" data-valign="middle" data-sortable="true" data-width="100" data-formatter="FormatterQuestionType" data-cell-style="StyleQuestionType">题型<span class="en-text">Type</span></th>
            <th data-field="source" data-align="left" data-valign="middle" data-sortable="true" data-width="120">来源<span class="en-text">Source</span></th>
            <th data-field="author" data-align="center" data-valign="middle" data-sortable="true" data-width="100" data-formatter="FormatterQuestionAuthor">作者<span class="en-text">Author</span></th>
            <th data-field="label" data-align="left" data-valign="middle" data-sortable="false" data-width="150" data-formatter="FormatterQuestionLabel">标签<span class="en-text">Label</span></th>
            <th data-field="create_at" data-align="center" data-valign="middle" data-sortable="true" data-width="80" data-formatter="FormatterDate">创建<span class="en-text">Created</span></th>
            <th data-field="update_at" data-align="center" data-valign="middle" data-sortable="true" data-width="80" data-formatter="FormatterDate">更新<span class="en-text">Updated</span></th>
            {if isset($can_manage_question_bank) && $can_manage_question_bank}
            <th data-field="attach" data-align="center" data-valign="middle" data-sortable="false" data-width="60" data-formatter="FormatterExQuestionAttach">附件<span class="en-text">Attach</span></th>
            <th data-field="edit" data-align="center" data-valign="middle" data-sortable="false" data-width="60" data-formatter="FormatterQuestionEdit">编辑<span class="en-text">Edit</span></th>
            <th data-field="delete" data-align="center" data-valign="middle" data-sortable="false" data-width="60" data-formatter="FormatterQuestionDelete">删除<span class="en-text">Delete</span></th>
            {/if}
        </tr>
        </thead>
    </table>
</div>

{css href="__STATIC__/csgoj/oj_problem.css" /}
{css href="__STATIC__/exadmin/exadmin.css" /}
{css href="__STATIC__/examsys/examsys.css" /}
{include file="../../csgoj/view/public/pkg_code_highlight" /}
{css href="__STATIC__/csgoj/code_show.css" /}
{js href="__STATIC__/csgoj/oj_problem.js" /}
{js href="__STATIC__/csgoj/code_render.js" /}
{js href="__STATIC__/examsys/ex_global.js" /}
{js href="__STATIC__/examsys/question_md_utils.js" /}
{js href="__STATIC__/examsys/question_default.js" /}
{js href="__STATIC__/examsys/question_render.js" /}
{js href="__STATIC__/examsys/question_preview.js" /}
{js href="__STATIC__/exadmin/exadmin_formatter.js" /}
{js href="__STATIC__/exadmin/question_list.js" /}
{js href="__STATIC__/exadmin/permission_hint.js" /}

