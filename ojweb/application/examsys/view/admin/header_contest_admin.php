<ul class="nav nav-pills">
    <li class="nav-item">
        <a class="nav-link {if $action == 'examinee_status' }active{/if}" href="/{$module}/admin/examinee_status?cid={$contest['contest_id']}">
            考试状态
        </a>
    </li>
    {if $isContestAdmin }
    <li class="nav-item">
        <a class="nav-link {if $action == 'contest_edit' }active{/if}" href="/{$module}/admin/contest_edit?cid={$contest['contest_id']}">
            修改设置
        </a>
    </li>
    <li class="nav-item">
        <a class="nav-link {if $action == 'contest_rejudge' }active{/if}" href="/{$module}/admin/contest_rejudge?cid={$contest['contest_id']}">
            重判代码
        </a>
    </li>
    {/if}
    {if $isContestAdmin || isset($proctorAdmin) && $proctorAdmin}
    <li class="nav-item dropdown">
            <a class="nav-link dropdown-toggle {if (strpos($action, 'account') === 0 || $action == 'account_gen_student' || $action == 'account_gen_proctor') } active {/if}" data-bs-toggle="dropdown" href="#" role="button" aria-expanded="false">
                账号管理
            </a>
            <ul class="dropdown-menu">
                {if $isContestAdmin}
                <li><a class="dropdown-item" href="/{$module}/admin/account_gen_student?cid={$contest['contest_id']}">考生生成</a></li>
                <li><a class="dropdown-item" href="/{$module}/admin/account_gen_proctor?cid={$contest['contest_id']}">监考生成</a></li>
                {/if}
                <li><a class="dropdown-item" href="/{$module}/admin/account_modify?cid={$contest['contest_id']}">账号修改</a></li>
                <li><a class="dropdown-item" href="/{$module}/admin/account_ipcheck?cid={$contest['contest_id']}">IP侦测</a></li>
            </ul>
        </li>
    {/if}
    {if $isReviewer }
        <li class="nav-item dropdown">
            <a class="nav-link dropdown-toggle {if (strpos($action, 'review') === 0) } active {/if}" data-bs-toggle="dropdown" href="#" role="button" aria-expanded="false">
                阅卷
            </a>
            <ul class="dropdown-menu">
                {if $isContestAdmin}
                <li><a class="dropdown-item" href="/{$module}/admin/reviewer_manage?cid={$contest['contest_id']}">阅卷账号</a></li>
                {/if}
                <li><a class="dropdown-item" href="/{$module}/admin/review?cid={$contest['contest_id']}">阅卷</a></li>
            </ul>
        </li>
    <li class="nav-item">
        <a class="nav-link {if $action == 'record_export' }active{/if}" href="/{$module}/admin/record_export?cid={$contest['contest_id']}">
            归档
        </a>
    </li>
    {/if}
</ul>