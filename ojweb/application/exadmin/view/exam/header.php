
{/* 考题（question） */}
{if(IsAdmin('problem_editor') || PrivCourse('teacher', $NOW_COURSE_KEY)) }
<li class="nav-item dropdown">
    <a class="nav-link dropdown-toggle {if $controller == 'question' } active {/if}" data-bs-toggle="dropdown" href="#" role="button" aria-expanded="false">
        考题<span class="en-text">Question</span>
    </a>
    <ul class="dropdown-menu">
        <li><a class="dropdown-item" href="/{$module}/question/question_list">考题列表<span class="en-text">Question List</span></a></li>
        {/* 注意：PrivCourse('admin') 已包含 super 权限的检查 */}
        {if PrivCourse('admin', $NOW_COURSE_KEY) || IsAdmin() || IsAdmin('problem_editor') || IsAdmin('contest_editor')}
        <li><a class="dropdown-item" href="/{$module}/question/question_add">添加考题<span class="en-text">Question Add</span></a></li>
        {/if}
        {/* 注意：PrivCourse('admin') 已包含 super 权限的检查 */}
        {if PrivCourse('admin', $NOW_COURSE_KEY) || IsAdmin() || IsAdmin('problem_editor') || IsAdmin('contest_editor')}
        <li><a class="dropdown-item" href="/{$module}/question/question_export">考题导出<span class="en-text">Question Export</span></a></li>
        <li><a class="dropdown-item" href="/{$module}/question/question_import">考题导入<span class="en-text">Question Import</span></a></li>
        {/if}
        <li><a class="dropdown-item" href="/{$module}/question/question_draft_list">出题（本地草稿）<span class="en-text">Draft Questions (Local)</span></a></li>
    </ul>
</li>
{/if}

{/* 考试（exam） */}
{if(IsAdmin('contest_editor') || PrivCourse('teacher', $NOW_COURSE_KEY)) }
<li class="nav-item dropdown">
    <a class="nav-link dropdown-toggle {if $controller == 'exam' } active {/if}" data-bs-toggle="dropdown" href="#" role="button" aria-expanded="false">
        考试<span class="en-text">Exam</span>
    </a>
    <ul class="dropdown-menu">
        <li><a class="dropdown-item" href="/{$module}/exam/contest_list">考试列表<span class="en-text">Exam List</span></a></li>
        <li><a class="dropdown-item" href="/{$module}/exam/contest_add">添加考试<span class="en-text">Exam Add</span></a></li>
        {/* 注意：PrivCourse('admin') 已包含 super 权限的检查 */}
        {if PrivCourse('admin', $NOW_COURSE_KEY) || IsAdmin()}
        <li><a class="dropdown-item" href="/{$module}/exam/contest_examinee_status">考生状态<span class="en-text">Examinee Status</span></a></li>
        <li><a class="dropdown-item" href="/exadmin/exam/contest_global_account">考生账号<span class="en-text">Examinee Account</span></a></li>
        {/if}
    </ul>
</li>
{/if}