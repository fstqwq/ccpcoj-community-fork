<ul class="nav nav-tabs">
    {include file="../../admin/view/public/url_modal"}
    <?php $controller = strtolower(request()->controller()); ?>
    <?php $action = strtolower(request()->action()); ?>

    {if $OJ_MODE == 'online'}
        {/* OJ_MODE=online 时的菜单：公告、OJ题、练习、班级、权限、课程组、评测机 */}
        
        {/* 公告 */}
        {if(IsAdmin('news_editor')) }
        <li class="nav-item dropdown">
            <a href="/{$module}/news/index" class="nav-link dropdown-toggle {if $controller == 'news' } active {/if}" data-bs-toggle="dropdown" role="button" aria-expanded="false">
                公告<span class="en-text">Article</span>
            </a>
            <ul class="dropdown-menu">
                <li>
                    <a href="/{$module}/news/index" class="dropdown-item">文章列表<span class="en-text">Article List</span></a>
                </li>
                <li>
                    <a href="/{$module}/news/news_add" class="dropdown-item">添加文章<span class="en-text">Article Add</span></a>
                </li>
                {if(IsAdmin('administrator'))}
                <li>
                    <a href="/{$module}/news/carousel" class="dropdown-item">轮播<span class="en-text">Carousel</span></a>
                </li>
                <li>
                    <a href="/{$module}/news/aboutus" class="dropdown-item">关于<span class="en-text">About Us</span></a>
                </li>
                <li>
                    <a href="/{$module}/news/oj_faq" class="dropdown-item">常见疑问<span class="en-text">OJ F.A.Qs</span></a>
                </li>
                {/if}
            </ul>
        </li>
        {/if}
        
        {/* OJ题：教师可查看列表，但无添加/重判/复制等权限 */}
        {if(IsAdmin('problem_editor') || PrivCourse('teacher', $NOW_COURSE_KEY)) }
        <li class="nav-item dropdown">
            <a href="/{$module}/problem/index" class="nav-link dropdown-toggle {if $controller == 'problem' || $controller == 'problemexport' } active {/if}" data-bs-toggle="dropdown" role="button" aria-expanded="false">
                OJ题<span class="en-text">Problem</span>
            </a>
            <ul class="dropdown-menu">
                <li>
                    <a href="/{$module}/problem/index" class="dropdown-item">OJ题列表<span class="en-text">Problem List</span></a>
                </li>
                {if(IsAdmin('problem_editor'))}
                <li>
                    <a href="/{$module}/problem/problem_add" class="dropdown-item">添加OJ题<span class="en-text">Problem Add</span></a>
                </li>
                <li>
                    <a href="/{$module}/problem/problem_rejudge" class="dropdown-item">OJ题重判<span class="en-text">Problem Rejudge</span></a>
                </li>
                {if(IsAdmin('administrator'))}
                <li>
                    <a href="/{$module}/problem/pkg_convert" class="dropdown-item">题包转换<span class="en-text">Package Convert</span></a>
                </li>
                <li>
                    <a href="/{$module}/problemexport/problem_export?item=problemexport" class="dropdown-item">OJ题导入/导出<span class="en-text">Problem Import / Export</span></a>
                </li>
                {/if}
                {/if}
            </ul>
        </li>
        {/if}
        
        {/* 练习 */}
        {if(IsAdmin('contest_editor') || PrivCourse('teacher', $NOW_COURSE_KEY)) }
        <li class="nav-item dropdown">
            <a class="nav-link dropdown-toggle {if $controller == 'contest' || $controller == 'contesttpl' } active {/if}" data-bs-toggle="dropdown" href="#" role="button" aria-expanded="false">
                练习<span class="en-text">Practice</span>
            </a>
            <ul class="dropdown-menu">
                <li><a class="dropdown-item" href="/{$module}/contest/contest_list">练习列表<span class="en-text">Practice List</span></a></li>
                <li><a class="dropdown-item" href="/{$module}/contest/contest_add">添加练习<span class="en-text">Add Practice</span></a></li>
                {if $OJ_STATUS == 'exp'}
                <li><a class="dropdown-item" href="#" id="exp_menu_from_tpl">从模板添加<span class="en-text">From template</span></a></li>
                {/if}
                {if $OJ_STATUS == 'exp' && (PrivCourse('admin', $NOW_COURSE_KEY) || IsAdmin('contest_editor') || IsAdmin('administrator'))}
                <li><a class="dropdown-item" href="/{$module}/contesttpl/template_manage">模板管理<span class="en-text">Templates</span></a></li>
                {/if}
                <li><hr class="dropdown-divider"></li>
                <li><a class="dropdown-item" href="/{$module}/contestsummary/contest_summary">统计归档<span class="en-text">Summary Export</span></a></li>
            </ul>
        </li>
        {/if}
        
        {/* 班级 */}
        {if(IsAdmin('contest_editor') || PrivCourse('teacher', $NOW_COURSE_KEY)) }
        <li class="nav-item dropdown">
            <a href="/{$module}/clss/index" class="nav-link dropdown-toggle {if $controller == 'clss' } active {/if}" data-bs-toggle="dropdown" role="button" aria-expanded="false">
                班级<span class="en-text">Class</span>
            </a>
            <ul class="dropdown-menu">
                <li>
                    <a href="/{$module}/clss/index" class="dropdown-item">班级列表<span class="en-text">Class List</span></a>
                </li>
                {if IsAdmin('administrator') && $OJ_STATUS == 'exp'}
                <li>
                    <a href="/{$module}/clss/clss_add" class="dropdown-item">批量添加/修改班级<span class="en-text">Batch Add/Modify Class</span></a>
                </li>
                {/if}
            </ul>
        </li>
        {/if}
        
    {elseif $OJ_MODE == 'cpcsys'}
        {/* OJ_MODE=cpcsys 时的菜单：OJ题、考题、考试、权限、课程组、评测机 */}
        
        {/* OJ题（problem） */}
        {if(IsAdmin('problem_editor')) }
        <li class="nav-item dropdown">
            <a href="/{$module}/problem/index" class="nav-link dropdown-toggle {if $controller == 'problem' || $controller == 'problemexport' } active {/if}" data-bs-toggle="dropdown" role="button" aria-expanded="false">
                OJ题<span class="en-text">Problem</span>
            </a>
            <ul class="dropdown-menu">
                <li>
                    <a href="/{$module}/problem/index" class="dropdown-item">OJ题列表<span class="en-text">Problem List</span></a>
                </li>
                <li>
                    <a href="/{$module}/problem/problem_add" class="dropdown-item">添加OJ题<span class="en-text">Problem Add</span></a>
                </li>
                <li>
                    <a href="/{$module}/problem/problem_rejudge" class="dropdown-item">OJ题重判<span class="en-text">Problem Rejudge</span></a>
                </li>
                {if(IsAdmin('administrator'))}
                <li>
                    <a href="/{$module}/problem/pkg_convert" class="dropdown-item">题包转换<span class="en-text">Package Convert</span></a>
                </li>
                <li>
                    <a href="/{$module}/problemexport/problem_export?item=problemexport" class="dropdown-item">OJ题导入/导出<span class="en-text">Problem Import / Export</span></a>
                </li>
                {/if}
            </ul>
        </li>
        {/if}
        {include file="../../exadmin/view/exam/header" /}
        
    {/if}
    
    {/* 权限（两个模式都有） */}
    {if(IsAdmin('administrator')) }
    <li class="nav-item">
        <a href="/{$module}/privilege/index" class="nav-link {if $controller == 'privilege' } active {/if}">
            权限<span class="en-text">Privilege</span>
        </a>
    </li>
    {/if}
    
    {/* 课程组（两个模式都有） */}
    {if(IsAdmin('administrator') || PrivCourse('teacher', $NOW_COURSE_KEY)) }
    <li class="nav-item dropdown">
        <a href="/{$module}/course/index" class="nav-link dropdown-toggle {if $controller == 'course' } active {/if}" data-bs-toggle="dropdown" role="button" aria-expanded="false">
            课程组<span class="en-text">Course Group</span>
        </a>
        <ul class="dropdown-menu">
            <li>
                <a href="/{$module}/course/index" class="dropdown-item">
                    <span class="cn-text">课程组列表</span>
                    <span class="en-text">Course Group List</span>
                </a>
            </li>
            {if IsAdmin()}
            <li>
                <a href="/{$module}/course/course_add" class="dropdown-item">
                    <span class="cn-text">添加课程组</span>
                    <span class="en-text">Add Course Group</span>
                </a>
            </li>
            {/if}
        </ul>
    </li>
    {/if}
    
    {/* 评测机（两个模式都有） */}
    {if(IsAdmin('administrator')) }
    <li class="nav-item">
        <a href="/{$module}/judger/index" class="nav-link {if $controller == 'judger' } active {/if}">
            评测机<span class="en-text">Judger</span>
        </a>
    </li>
    {/if}
    {/* 后台任务（两个模式都有） */}
    {if(IsAdmin('administrator')) }
    <li class="nav-item">
        <a href="/{$module}/backtask/index" class="nav-link {if $controller == 'backtask' } active {/if}">
            后台任务<span class="en-text">Tasks</span>
        </a>
    </li>
    {/if}
</ul>










