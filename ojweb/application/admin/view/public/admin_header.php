<ul class="nav nav-tabs">
    {include file="../../admin/view/public/url_modal"}
    <?php $controller = strtolower(request()->controller()); ?>

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
    {if(IsAdmin('problem_editor')) }
    <li class="nav-item dropdown">
        <a href="/{$module}/problem/index" class="nav-link dropdown-toggle {if $controller == 'problem' || $controller == 'problemexport' } active {/if}" data-bs-toggle="dropdown" role="button" aria-expanded="false">
            题目<span class="en-text">Problem</span>
        </a>
        <ul class="dropdown-menu">
            <li>
                <a href="/{$module}/problem/index" class="dropdown-item">题目列表<span class="en-text">Problem List</span></a>
            </li>
            <li>
                <a href="/{$module}/problem/problem_add" class="dropdown-item">添加题目<span class="en-text">Problem Add</span></a>
            </li>
            <li>
                <a href="/{$module}/problem/problem_rejudge" class="dropdown-item">题目重判<span class="en-text">Problem Rejudge</span></a>
            </li>
            {if(IsAdmin('administrator'))}
            <li>
                <a href="/{$module}/problem/pkg_convert" class="dropdown-item">题包转换<span class="en-text">Package Convert</span></a>
            </li>
            <li>
                <a href="/{$module}/problemexport/problem_export?item=problemexport" class="dropdown-item">题目导入/导出<span class="en-text">Problem Import / Export</span></a>
            </li>
            {/if}
        </ul>
    </li>
    {/if}
    {if(IsAdmin('contest_editor')) }
    <li class="nav-item dropdown">
        <a href="/{$module}/contest/index" class="nav-link dropdown-toggle {if $controller == 'contest' } active {/if}" data-bs-toggle="dropdown" role="button" aria-expanded="false">
            比赛<span class="en-text">Contest</span>
        </a>
        <ul class="dropdown-menu">
            <li>
                <a href="/{$module}/contest/index" class="dropdown-item">比赛列表<span class="en-text">Contest List</span></a>
            </li>
            <li>
                <a href="/{$module}/contest/contest_add" class="dropdown-item">添加比赛<span class="en-text">Contest Add</span></a>
            </li>
            {if isset($OJ_STATUS) && $OJ_STATUS == 'cpc' && IsAdmin('administrator')}
            <li>
                <a href="/{$module}/contest/contest_pkg" class="dropdown-item">比赛打包归档<span class="en-text">Contest Import/Export</span></a>
            </li>
            {/if}
            {if !isset($OJ_STATUS) || $OJ_STATUS != 'cpc'}
            <li>
                <a href="/{$module}/contestsummary/contest_summary" class="dropdown-item">统计归档<span class="en-text">Summary Export</span></a>
            </li>
            {/if}
        </ul>
    </li>
    {/if}
    {if(IsAdmin('administrator')) }
    <li class="nav-item">
        <a href="/{$module}/privilege/index" class="nav-link {if $controller == 'privilege' } active {/if}">
            权限<span class="en-text">Privilege</span>
        </a>
    </li>
    {/if}
    {if(IsAdmin('password_setter')) }
        {if $OJ_SSO == false}
        <li class="nav-item dropdown">
            <a href="/{$module}/usermanager/index" class="nav-link dropdown-toggle {if $controller == 'usermanager' } active {/if}" data-bs-toggle="dropdown" role="button" aria-expanded="false">
                用户<span class="en-text">User</span>
            </a>
            <ul class="dropdown-menu">
                <li>
                    <a href="/{$module}/usermanager/index" class="dropdown-item">用户列表<span class="en-text">User List</span></a>
                </li>
                {if $OJ_STATUS=='exp' && IsAdmin('administrator') || IsAdmin('super_admin') }
                <li>
                    <a href="/{$module}/usermanager/usergen" class="dropdown-item">用户生成<span class="en-text">User Generator</span></a>
                </li>
                {/if}
            </ul>
        </li>
        {/if}
    {/if}
    {if(IsAdmin('administrator')) }
    <li class="nav-item">
        <a href="/{$module}/judger/index" class="nav-link {if $controller == 'judger' } active {/if}">
            评测机<span class="en-text">Judger</span>
        </a>
    </li>
    {/if}
    {if(IsAdmin('administrator')) }
    <li class="nav-item">
        <a href="/{$module}/backtask/index" class="nav-link {if $controller == 'backtask' } active {/if}">
            后台任务<span class="en-text">Tasks</span>
        </a>
    </li>
    {/if}
</ul>