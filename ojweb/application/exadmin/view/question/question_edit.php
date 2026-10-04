<div class="admin-page-header">
    <div class="admin-page-header-left">
        <div class="admin-page-header-icon">
            <i class="bi bi-question-circle"></i>
        </div>
        <h1 class="admin-page-header-title">
            <div>
                <div class="admin-page-header-title">
                    <div class="admin-page-header-title-main">
                        {if isset($draft_mode) && $draft_mode}
                            出题草稿
                        {elseif $edit_mode /}
                            编辑考题
                        {else /}
                            新增考题
                        {/if}
                    </div>
                    <div class="admin-page-header-title-right">
                        {if $edit_mode}
                        <a href="javascript:void(0);" class="question_display admin-page-header-id" ex_question_id="{$question['ex_question_id']}">
                            <i class="bi bi-hash"></i> {$question['ex_question_id']}
                        </a>
                        {/if}
                        {if isset($draft_mode) && $draft_mode}
                            <span class="en-text">Draft Question</span>
                        {elseif $edit_mode /}
                            <span class="en-text">Edit Question</span>
                        {else /}
                            <span class="en-text">Add Question</span>
                        {/if}
                    </div>
                </div>
                {if !$edit_mode && !(isset($draft_mode) && $draft_mode)}
                <div class="text-muted mt-1" style="font-size:12px; line-height:1.2;">
                    插图需添加考题后，再上传编辑
                    <span class="en-text">To add images, please create the question first, then upload and edit</span>
                </div>
                {/if}
            </div>
        </h1>
    </div>

    <div class="admin-page-header-actions">
        {if $edit_mode && !(isset($draft_mode) && $draft_mode)}
        <button type="button" class="btn btn-success btn-sm bilingual-button"
                data-modal-url="/exadmin/filemanager/filemanager?item=ex_question&id={$question['ex_question_id']}"
                data-modal-title="附件管理 - 考题 #{$question['ex_question_id']} - {$question['title']|mb_substr=0,150,'utf-8'}..."
                title="附件管理 (File Manager)">
            <span class="cn-text"><i class="bi bi-paperclip"></i> 附件</span>
            <span class="en-text">Attach</span>
        </button>
        {/if}
        {if isset($draft_mode) && $draft_mode}
        <a href="/exadmin/question/question_draft_list" class="btn btn-outline-secondary btn-sm">
            <span class="cn-text"><i class="bi bi-list-ul"></i> 草稿列表</span>
            <span class="en-text">Draft List</span>
        </a>
        <button type="button" class="btn btn-outline-primary btn-sm" id="draft_attach_btn">
            <span class="cn-text"><i class="bi bi-paperclip"></i> 本地附件</span>
            <span class="en-text">Local Attach</span>
        </button>
        <input type="file" id="draft_attach_input" class="d-none" multiple>
        <button type="button" class="btn btn-success btn-sm" id="save_local_draft_btn">
            <span class="cn-text"><i class="bi bi-cloud-arrow-down"></i> 保存草稿</span>
            <span class="en-text">Save Local</span>
        </button>
        {/if}
        <button type="button" class="btn btn-outline-info btn-sm" id="download_json_btn">
            <span class="cn-text"><i class="bi bi-download"></i> 下载配置</span>
            <span class="en-text">Download Config</span>
        </button>
        <button type="button" class="btn btn-outline-info btn-sm" id="upload_json_btn">
            <span class="cn-text"><i class="bi bi-upload"></i> 上传配置</span>
            <span class="en-text">Upload Config</span>
        </button>
        {if !isset($can_submit_db) || $can_submit_db}
            <button type="submit" form="question_edit_form" class="btn btn-primary btn-sm">
                <span class="cn-text"><i class="bi bi-save"></i> {if $edit_mode}保存修改{else /}提交{/if}</span>
                <span class="en-text">{if $edit_mode}Save Changes{else /}Submit{/if}</span>
            </button>
        {else /}
            {if isset($readonly_mode) && $readonly_mode}
                <button type="button" class="btn btn-secondary btn-sm" disabled>
                    <span class="cn-text"><i class="bi bi-lock"></i> 只读模式</span>
                    <span class="en-text">Read-only</span>
                </button>
            {/if}
        {/if}
        <button type="button" class="btn btn-outline-secondary btn-sm" id="reset_button_top">
            <span class="cn-text"><i class="bi bi-arrow-counterclockwise"></i> 重置</span>
            <span class="en-text">Reset</span>
        </button>
        <input type="file" id="json_file_input" accept=".json" class="d-none">
    </div>
</div>

{include file="question/question_type_header" /}

<div class="container question-edit-surface {if isset($draft_mode) && $draft_mode}csg-draft-surface{/if}" id="question_edit_surface" data-pkind="{if $edit_mode}{$pkind}{else /}0{/if}">
    {if isset($readonly_mode) && $readonly_mode}
        <div class="alert alert-warning">
            当前为只读查看：你没有题库写入权限（教师请使用“出题草稿”功能）。
            <span class="en-text">Read-only: you don't have permission to write to the question bank. Teachers should use Draft Questions.</span>
        </div>
    {/if}
    {if isset($draft_mode) && $draft_mode}
        <div class="alert alert-info">
            草稿模式：不会写入数据库；请使用“保存到本地”或“下载配置(JSON)”。
            <span class="en-text">Draft mode: nothing will be saved to database. Use “Save Local” or “Download Config(JSON)”.</span>
        </div>
    {/if}
    <form id="question_edit_form" class="admin-form" method='post' action="{if isset($form_action)}{$form_action}{else /}/exadmin/question/question_edit_ajax{/if}">
        <input type="hidden" id="tpl_draft_mode" value="{if isset($draft_mode) && $draft_mode}1{else/}0{/if}">
        <input type="hidden" id="tpl_draft_id" value="{if isset($draft_id)}{$draft_id|htmlspecialchars}{else/}{/if}">
        <input type="hidden" id="tpl_now_course_key" value="{$NOW_COURSE_KEY|default=''|htmlspecialchars}">
        <div class="row g-4">
            <div class="col-lg-8">
                <div class="card mb-3 border-0 shadow-sm">
                    <div class="card-body">
                        <div class="form-group">
                            <label for="title" class="bilingual-label">标题：<span class="en-text">Question Title</span></label>
                            <input type="text" class="form-control" placeholder="请输入题目标题" name="title" id="question_title" {if $edit_mode}value="{$question['title']}" {/if}>
                        </div>
                        <div class="form-group">
                            <div class="d-flex align-items-center mb-2 gap-2">
                                <label class="bilingual-label mb-0">描述：<span class="en-text">Description</span></label>
                                <div class="d-flex flex-fill gap-2">
                                    <button type="button" class="btn btn-sm btn-outline-primary flex-fill text-start" id="edit_description_btn">
                                        <span class="d-inline-flex align-items-center gap-1"><i class="bi bi-pencil-square"></i>编辑</span>
                                        <span class="en-text">Edit</span>
                                    </button>
                                    <!-- 编程题：选择绑定的 OJ 题号（由 question_edit.js 控制显示/隐藏） -->
                                    <button type="button"
                                            class="btn btn-sm btn-outline-success flex-fill text-start d-none"
                                            id="choose_oj_problem_btn"
                                            {if isset($can_edit_prog_binding) && !$can_edit_prog_binding}disabled{/if}>
                                        <span class="d-inline-flex align-items-center gap-1"><i class="bi bi-link-45deg"></i>选择OJ题目</span>
                                        <span class="en-text">Bind OJ Problem</span>
                                    </button>
                                </div>
                            </div>
                            <!-- 编程题绑定权限提示（由 question_edit.js 控制显示/隐藏） -->
                            <div id="prog_oj_bind_hint" class="text-muted small mb-2 d-none">
                                {if isset($can_edit_prog_binding) && $can_edit_prog_binding}
                                    <span class="cn-text">编程题的“描述”字段用于绑定 OJ 题号；你可通过“选择OJ题目”修改绑定。</span>
                                    <span class="en-text">For programming questions, “Description” binds an OJ problem ID. You can change it via “Bind OJ Problem”.</span>
                                {else /}
                                    <span class="cn-text"><strong>提示：</strong>仅系统管理员或课程超级管理员可修改编程题绑定的 OJ 题号；当前账号只读。</span>
                                    <span class="en-text"><strong>Notice:</strong> Only system admin or course super can change the bound OJ problem ID. Read-only for current user.</span>
                                {/if}
                            </div>
                            <!-- 编程题：OJ 题目预览（由 question_edit.js 控制显示/隐藏） -->
                            <div id="oj_problem_preview" class="border rounded bg-light p-3 min-h-100 d-none"></div>
                            <div id="description_preview" class="border rounded bg-light p-3 min-h-100"></div>
                            <textarea class="form-control d-none" name="description" id="question_description">{if $edit_mode}{$question['description']|htmlspecialchars}{/if}</textarea>
                        </div>
                    </div>
                </div>

                <div class="card mb-3 border-0 shadow-sm" id="content_card">
                    <div class="card-body">
                        <div class="d-flex align-items-center mb-2 gap-2">
                            <label class="bilingual-label mb-0">内容：<span class="en-text">Content</span></label>
                            <div class="ms-auto d-flex gap-2" id="content_header_actions"></div>
                        </div>
                        <div id="content_edit_area" class="content-area"></div>
                        <textarea class="form-control d-none" name="content" id="question_content">{if $edit_mode}{$question['content']|htmlspecialchars}{/if}</textarea>
                    </div>
                </div>

                <div class="card mb-3 border-0 shadow-sm">
                    <div class="card-body">
                        <div class="d-flex align-items-center mb-2 gap-2">
                            <label class="bilingual-label mb-0">答案：<span class="en-text">Answer</span></label>
                            <div class="flex-fill" id="answer_header_placeholder"></div>
                        </div>
                        <div id="answer_edit_area" class="answer-area"></div>
                        <textarea class="form-control d-none" name="answer" id="question_answer">{if $edit_mode}{$question['answer']|htmlspecialchars}{/if}</textarea>
                    </div>
                </div>

                <div class="card mb-3 border-0 shadow-sm">
                    <div class="card-body">
                        <div class="d-flex align-items-center gap-2 mb-2">
                            <label class="bilingual-label mb-0">答案解析：<span class="en-text">Explanation</span></label>
                            <button type="button" class="btn btn-sm btn-outline-primary flex-fill text-start" id="answer_explain_edit_btn">
                                <span class="d-inline-flex align-items-center gap-1"><i class="bi bi-pencil-square"></i>编辑解析</span>
                                <span class="en-text">Edit Explanation</span>
                            </button>
                        </div>
                        <div id="answer_explain_preview" class="border rounded bg-light p-3 min-h-100"></div>
                        <textarea class="form-control d-none" name="answer_explain" id="question_answer_explain">{if $edit_mode && isset($question['answer_explain'])}{$question['answer_explain']|htmlspecialchars}{/if}</textarea>
                    </div>
                </div>
            </div>

            <div class="col-lg-4 d-flex flex-column">
                <div class="card mb-3 border-0 shadow-sm flex-grow-1">
                    <div class="card-body">
                        <div class="form-group">
                            <label class="bilingual-label" for="question_source">来源：<span class="en-text">Source</span></label>
                            <input type="text" class="form-control" placeholder="课程/书籍/出处" name="source" id="question_source" {if $edit_mode}value="{$question['source']|htmlspecialchars}" {/if}>
                        </div>
                        <div class="form-group">
                            <label class="bilingual-label" for="question_author">作者：<span class="en-text">Author</span></label>
                            <input type="text" class="form-control" placeholder="作者或录入者" name="author" id="question_author" {if $edit_mode}value="{$question['author']|htmlspecialchars}" {/if}>
                        </div>
                        <div class="form-group">
                            <label class="bilingual-label" for="question_label">标签：<span class="en-text">Label</span></label>
                            <input type="text" class="form-control" placeholder="用逗号分隔：算法,数据结构" name="label" id="question_label" {if $edit_mode}value="{$question['label']|htmlspecialchars}" {/if}>
                        </div>

                        <!-- 简答/综合：评分建议（写入 content JSON） -->
                        <div class="form-group" id="score_advice_group" style="display:none;">
                            <label class="bilingual-label" for="question_score_advice">评分建议：<span class="en-text">Scoring Advice</span></label>
                            <div class="text-muted mb-1" style="font-size:12px; line-height:1.2;">
                                务必按<span class="text-danger fw-bold">百分比</span>进行判分描述
                                <span class="en-text">Please describe grading strictly in percentage</span>
                            </div>
                            <textarea class="form-control" id="question_score_advice" rows="4" placeholder="例如：按步骤给分：关键点各占 20%，缺失则扣除对应百分比..."></textarea>
                        </div>
                    </div>
                </div>

                <div class="mt-auto d-grid gap-2">
                    {if isset($draft_mode) && $draft_mode}
                        <button type="button" id="submit_button" class="btn btn-success py-2 fs-6">
                            <span class="d-inline-flex align-items-center gap-1"><i class="bi bi-cloud-arrow-down"></i>保存草稿</span>
                            <span class="en-text">Save Draft</span>
                        </button>
                    {elseif !isset($can_submit_db) || $can_submit_db /}
                        <button type="submit" id="submit_button" class="btn btn-primary py-2 fs-6">
                            <span class="d-inline-flex align-items-center gap-1"><i class="bi bi-save"></i>{if $edit_mode}保存修改{else /}提交{/if}</span>
                            <span class="en-text">{if $edit_mode}Save Changes{else /}Submit{/if}</span>
                        </button>
                    {else /}
                        {if isset($readonly_mode) && $readonly_mode}
                            <button type="button" class="btn btn-secondary py-2 fs-6" disabled>
                                <span class="d-inline-flex align-items-center gap-1"><i class="bi bi-lock"></i>只读模式</span>
                                <span class="en-text">Read-only</span>
                            </button>
                        {/if}
                    {/if}
                    <button type="button" id="reset_button" class="btn btn-outline-secondary btn-sm">
                        <span class="d-inline-flex align-items-center gap-1"><i class="bi bi-arrow-counterclockwise"></i>重置</span>
                        <span class="en-text">Reset</span>
                    </button>
                </div>
            </div>
        </div>

        <!-- 隐藏字段 -->
        {if $edit_mode}
        <input type="hidden" value="{$question['ex_question_id']}" name="ex_question_id" id="ex_question_id">
        {/if}
        {if !$edit_mode}
        <input type="hidden" name="course_key" value="{$NOW_COURSE_KEY}">
        {/if}
        <input type="hidden" value="{if $edit_mode}{$pkind}{else /}0{/if}" id="pkind_input" name="pkind">
        <!-- 新增题目时：答案图临时上传工作目录标识（由后端首次上传返回） -->
        <input type="hidden" value="" id="tmp_uuid" name="tmp_uuid">
        <!-- 临时答案图信息：从 answer 字段提取的临时文件名（tmp_开头），用于后端从 /tmp 移动到 attach -->
        <input type="hidden" value="" id="tmp_answer_images" name="tmp_answer_images">
    </form>
</div>

<!-- Vditor 编辑 Modal -->
<div class="modal fade" id="vditor_modal" tabindex="-1" aria-hidden="true">
    <div class="modal-dialog modal-xl">
        <div class="modal-content">
            <div class="modal-header">
                <h1 class="modal-title fs-5 bilingual-inline" id="vditor_modal_title">编辑内容<span class="en-text">Edit Content</span></h1>
                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div class="modal-body">
                <div id="vditor_editor"></div>
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">
                    <span class="d-inline-flex align-items-center gap-1">取消</span>
                    <span class="en-text">Cancel</span>
                </button>
                <button type="button" class="btn btn-primary" id="vditor_save_btn">
                    <span class="d-inline-flex align-items-center gap-1">确定</span>
                    <span class="en-text">Confirm</span>
                </button>
            </div>
        </div>
    </div>
</div>

<!-- 编程题：OJ 题目选择器 Modal -->
<div class="modal fade" id="oj_problem_selector_modal" tabindex="-1" aria-hidden="true">
    <div class="modal-dialog modal-xl modal-dialog-scrollable">
        <div class="modal-content">
            <div class="modal-header">
                <h1 class="modal-title fs-5 bilingual-inline">
                    选择绑定的 OJ 题目<span class="en-text">Bind OJ Problem</span>
                </h1>
                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div class="modal-body">
                <div class="d-flex align-items-center gap-2 mb-3 flex-wrap">
                    <input type="text" class="form-control" id="oj_problem_search_input" placeholder="题号/标题 模糊搜索" style="max-width: 420px;">
                    <button type="button" class="btn btn-outline-primary" id="oj_problem_search_btn">
                        <span class="d-inline-flex align-items-center gap-1"><i class="bi bi-search"></i>搜索</span>
                        <span class="en-text">Search</span>
                    </button>
                    <div class="text-muted small">
                        <span class="cn-text">提示：右侧“已绑定考题”可点题号预览</span>
                        <span class="en-text">Tip: click bound question IDs to preview</span>
                    </div>
                </div>
                <div class="table-responsive">
                    <table class="table table-sm table-hover align-middle">
                        <thead class="table-light">
                        <tr>
                            <th style="width: 90px;">题号<span class="en-text">PID</span></th>
                            <th style="width: 240px;">标题<span class="en-text">Title</span></th>
                            <th>简介<span class="en-text">Snippet</span></th>
                            <th style="width: 210px;">已绑定考题<span class="en-text">Bound QIDs</span></th>
                            <th style="width: 90px;">操作<span class="en-text">Action</span></th>
                        </tr>
                        </thead>
                        <tbody id="oj_problem_table_body">
                        <tr><td colspan="5" class="text-center text-muted">加载中...</td></tr>
                        </tbody>
                    </table>
                </div>
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">
                    <span class="d-inline-flex align-items-center gap-1">关闭</span>
                    <span class="en-text">Close</span>
                </button>
            </div>
        </div>
    </div>
</div>

<!-- 转码工具 Modal -->
<div class="modal fade" id="transcoding_modal" tabindex="-1" aria-hidden="true">
    <div class="modal-dialog modal-xl">
        <div class="modal-content">
            <div class="modal-header">
                <h1 class="modal-title fs-5 bilingual-inline">特殊符号内容转码器<span class="en-text">Transcoding Tool</span></h1>
                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div class="modal-body">
                <form>
                    <div class="mb-3">
                        <label for="transcoding_text" class="col-form-label bilingual-inline">内容<span class="en-text">Contents</span></label>
                        <textarea type="text" rows="30" class="form-control" id="transcoding_text"></textarea>
                    </div>
                </form>
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">
                    <span class="d-inline-flex align-items-center gap-1">关闭</span>
                    <span class="en-text">Close</span>
                </button>
                <button type="button" class="btn btn-success" id="encode_do">
                    <span class="d-inline-flex align-items-center gap-1">编码</span>
                    <span class="en-text">Encode</span>
                </button>
                <button type="button" class="btn btn-primary" id="decode_do">
                    <span class="d-inline-flex align-items-center gap-1">解码</span>
                    <span class="en-text">Decode</span>
                </button>
            </div>
        </div>
    </div>
</div>

<!-- 引入 CSS 文件 -->
{css href="__STATIC__/examsys/examsys.css" /}
{css href="__STATIC__/examsys/question_edit.css" /}

<!-- 引入 JS 文件 -->
{js href="__STATIC__/examsys/question_edit.js" /}
{js href="__STATIC__/examsys/question_md_utils.js" /}
{js href="__STATIC__/csgoj/oj_problem.js" /}
{js href="__STATIC__/examsys/question_render.js" /}
{js href="__STATIC__/examsys/question_preview.js" /}
{js href="__STATIC__/examsys/question_default.js" /}