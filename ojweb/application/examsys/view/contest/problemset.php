<div id="answer_sheet_div">
    <!-- 管理员/教师提示：选择题已开启乱序 -->
    {if isset($shuffle_choice) && intval($shuffle_choice) == 1 && ( (isset($isAdmin) && $isAdmin) || (isset($isTeacher) && $isTeacher) || (isset($isReviewer) && $isReviewer) )}
    <div class="exam-login-notice-container mb-3">
        <div class="alert alert-info alert-dismissible fade show mb-0" role="alert">
            <div class="d-flex align-items-start">
                <i class="bi bi-shuffle me-2 mt-1" style="font-size: 1.25rem; flex-shrink: 0;"></i>
                <div class="flex-grow-1">
                    <div class="cn-text"><strong>提示：</strong>本场考试已开启“单选/多选选项乱序显示”。（此信息仅管理员/教师/阅卷员可见）</div>
                    <div class="en-text text-muted small mt-1"><strong>Notice:</strong> Choice options are shuffled for this exam (Single/Multiple Choice).</div>
                </div>
                <button type="button" class="btn-close ms-2" data-bs-dismiss="alert" aria-label="Close"></button>
            </div>
        </div>
    </div>
    {/if}

    <!-- 未登录考试账号提示（仅管理员/reviewer可见） -->
    {if ($isAdmin || isset($isReviewer) && $isReviewer) && (!isset($login_teaminfo) || !$login_teaminfo)}
    <div class="exam-login-notice-container mb-3">
        <div class="alert alert-warning alert-dismissible fade show mb-0" role="alert">
            <div class="d-flex align-items-start">
                <i class="bi bi-exclamation-triangle-fill me-2 mt-1" style="font-size: 1.25rem; flex-shrink: 0;"></i>
                <div class="flex-grow-1">
                    <div class="cn-text"><strong>提示：</strong>登录考试账号后才能答题</div>
                    <div class="en-text text-muted small mt-1"><strong>Notice:</strong> Please login with an exam account to answer questions</div>
                </div>
                <button type="button" class="btn-close ms-2" data-bs-dismiss="alert" aria-label="Close"></button>
            </div>
        </div>
    </div>
    {/if}
    
    <!-- 工具栏 -->
    <div id="exam_problemset_toolbar" class="mb-3 d-flex align-items-center flex-wrap gap-2">
        <div class="btn-group" role="group">
            <button class="btn btn-warning button_fullscreen"><span class="cn-text"><i class="bi bi-box-arrow-up-right"></i>独立页</span><span class="en-text">Single Page</span></button>
            <button class="btn btn-success button_recover" title="所有内容置为已保存的版本 (Restore all content to saved version)">卷面恢复<span class="en-text">Restore</span></button>
            <button class="btn btn-primary button_save_all" title="提交所有答题有更改的题目（不推荐使用）(Save all changed answers, not recommended)">保存所有更改<span class="en-text">Save All</span></button>
            <button class="btn btn-danger button_exam_finish" title="交卷，结束考试 (Submit and finish exam)">结束考试！<span class="en-text">Finish Exam!</span></button>
        </div>
    </div>

    <!-- 题目列表容器 -->
    <div id="question_list_container" class="question-list-container">
        <!-- 题目将动态渲染到这里 -->
    </div>

    <!-- 加载提示 -->
    <div id="loading_div" class='overlay' style="display:none;">
        <div class="d-flex align-items-center" id="loading_spinner_div">
            <div id="loading_spinner" class="spinner-border ms-auto" aria-hidden="true"></div>
            <strong id="loading_text" role="status" class="bilingual-inline">&nbsp;加载中 ...<span class="en-text">Loading...</span></strong>
        </div>
    </div>
</div>

<!-- 右侧悬浮导航菜单 -->
<div id="question_nav_menu" class="question-nav-menu">
    <div class="question-nav-header">
        <strong class="bilingual-inline">题目导航<span class="en-text">Question Nav</span></strong>
        <button class="btn btn-sm btn-link p-0 text-white nav-menu-toggle-btn" id="nav_menu_toggle" title="收起/展开 (Collapse/Expand)">
            <i class="bi bi-arrows-angle-contract"></i>
        </button>
    </div>
    <div class="question-nav-content" id="question_nav_content">
        <!-- 导航项将动态生成 -->
    </div>
</div>

<!-- Markdown编辑器模态框 -->
<!-- backdrop=static：点击空白处不关闭；keyboard=false：按 ESC 不关闭 -->
<div class="modal fade" id="markdown_editor_modal" tabindex="-1" aria-hidden="true" data-bs-backdrop="static" data-bs-keyboard="false">
    <div class="modal-dialog modal-xl">
        <div class="modal-content">
            <div class="modal-header">
                <div class="d-flex justify-content-between align-items-center w-100">
                    <div class="d-flex align-items-center flex-wrap">
                        <h5 class="modal-title mb-0 me-3 d-flex align-items-center gap-2" id="md_editor_modal_title">
                            <i class="bi bi-markdown"></i>
                            <span class="bilingual-vertical">
                                <span class="cn-text">Markdown编辑器</span>
                                <span class="en-text">Markdown Editor</span>
                            </span>
                        </h5>
                        
                        <!-- 题目信息显示区域 -->
                        <div class="md-question-info d-flex align-items-center me-3" id="md_question_info" style="display: none !important;">
                            <i class="bi bi-puzzle me-1 text-primary"></i>
                            <span class="badge bg-primary bg-opacity-10 text-primary border border-primary border-opacity-25 px-2 py-1" id="md_question_num_badge" title="题目序号 (Question Number)">-</span>
                            <span class="ms-2 text-muted small" id="md_question_title_text" title="题目标题 (Question Title)">-</span>
                        </div>
                    </div>
                    
                    <div class="md-actions d-flex align-items-center">
                        <button type="button" class="btn btn-outline-info btn-sm me-2 bilingual-vertical" id="md_help_btn">
                            <span class="cn-text">Markdown 帮助</span>
                            <span class="en-text">Markdown Help</span>
                        </button>
                        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                    </div>
                </div>
            </div>
            <div class="modal-body">
                <div class="alert alert-info alert-dismissible fade show mb-3" role="alert">
                    <div class="d-flex align-items-start">
                        <i class="bi bi-info-circle me-2 mt-1" style="font-size: 1.1rem; flex-shrink: 0;"></i>
                        <div class="flex-grow-1">
                            <div class="cn-text">
                                <strong>提示：</strong>如不了解 Markdown 语法，请点击右上角<strong>"Markdown 帮助"</strong>按钮查看说明。
                                下方功能按钮可通过<strong>鼠标悬停</strong>查看详细说明。
                            </div>
                            <div class="en-text text-muted small mt-1">
                                <strong>Tip:</strong> If you're not familiar with Markdown syntax, please click the <strong>"Markdown Help"</strong> button in the top right corner.
                                Hover over the function buttons below to see detailed descriptions.
                            </div>
                        </div>
                        <button type="button" class="btn-close ms-2" data-bs-dismiss="alert" aria-label="Close"></button>
                    </div>
                </div>
                <div id="markdown_editor"></div>
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-primary bilingual-inline" id="md_editor_save_btn">确认<span class="en-text">Confirm</span></button>
                <button type="button" class="btn btn-secondary bilingual-inline" data-bs-dismiss="modal">关闭<span class="en-text">Close</span></button>
            </div>
        </div>
    </div>
</div>

<!-- 考试专属配置 -->
<script>
window.examProblemsetConfig = {
    page: "examsys_problemset",
    cid: "<?php echo htmlspecialchars($contest['contest_id'] ?? '', ENT_QUOTES, 'UTF-8'); ?>",
    contest_user: "<?php echo htmlspecialchars($contest_user ?? '', ENT_QUOTES, 'UTF-8'); ?>",
    examinee_defunct: "<?php echo htmlspecialchars($examinee_defunct ?? 'N', ENT_QUOTES, 'UTF-8'); ?>",
    shuffle_choice: "<?php echo isset($shuffle_choice) ? intval($shuffle_choice) : 0; ?>",
    is_admin: "<?php echo (isset($isAdmin) && $isAdmin) || (isset($isReviewer) && $isReviewer) ? '1' : '0'; ?>",
    hide_answer_review: "<?php echo isset($hide_answer_review) ? intval($hide_answer_review) : 0; ?>",
    has_additional: "<?php echo isset($has_additional) ? intval($has_additional) : 0; ?>",
    allow_lang_key: "<?php echo htmlspecialchars(implode(',', array_keys($allowLanguage ?? [])), ENT_QUOTES, 'UTF-8'); ?>",
    allow_lang_val: "<?php echo htmlspecialchars(implode(',', array_values($allowLanguage ?? [])), ENT_QUOTES, 'UTF-8'); ?>"
};

// 考试答题页：题目预览也不展示参考答案/答案解析（避免渲染答案区域）
window.questionPreviewConfig = window.questionPreviewConfig || {};
window.questionPreviewConfig.showAnswer = false;
</script>

{css href="__STATIC__/examsys/contest/ex_problemset.css" /}
{js href="__STATIC__/examsys/exam_func.js" /}
{js href="__STATIC__/examsys/question_nav_common.js" /}
{js href="__STATIC__/examsys/contest/ex_question_list.js" /}
{js href="__STATIC__/examsys/question_submit.js" /}
{js href="__STATIC__/examsys/md_help.js" /}

<a href="#" id="to_top_a"><i class="bi bi-arrow-bar-up"></i></a>
