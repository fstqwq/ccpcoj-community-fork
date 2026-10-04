{if $controller == 'contest' && $action != 'index' || $controller=='admin'}
	{include file="../../examsys/view/contest/header" /}
    {if $controller=='admin' && ($isContestAdmin || isset($isReviewer) && $isReviewer || isset($proctorAdmin) && $proctorAdmin) }
        {include file="../../examsys/view/admin/header_contest_admin" /}
    {/if}
{/if}