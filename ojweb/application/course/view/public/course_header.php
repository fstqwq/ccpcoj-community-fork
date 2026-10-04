<div class="course-sidebar"
     data-course-title="{$OJ_COURSE_NOW['course_title']}"
     data-course-unit="{$OJ_COURSE_NOW['course_unit']|default=''}">
    <a href="/course/index" class="course-sidebar-link" title="当前课程组，点击更换">
        <div class="course-sidebar-content">
            <i class="bi bi-book-fill course-sidebar-icon"></i>
            <span class="course-sidebar-title">{$OJ_COURSE_NOW['course_title']}</span>
            {if !empty($OJ_COURSE_NOW['course_unit'])}
                <span class="course-sidebar-unit">{$OJ_COURSE_NOW['course_unit']}</span>
            {/if}
            <i class="bi bi-arrow-down-circle course-sidebar-arrow"></i>
        </div>
    </a>
</div>


{css href='__STATIC__/course/course.css' /}
{js href='__STATIC__/course/course.js' /}