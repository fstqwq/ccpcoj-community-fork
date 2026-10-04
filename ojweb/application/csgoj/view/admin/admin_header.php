<ul class="nav nav-tabs admin-menu-pills" role="navigation" aria-label="比赛后台导航 Contest admin">
    <?php $controller = strtolower(request()->controller()); ?>
    {if $isContestAdmin }
    <li class="nav-item">
        <a class="nav-link{if $action == 'contest_edit'} active{/if}" href="/{$module}/admin/contest_edit?cid={$contest['contest_id']}" role="button" aria-haspopup="true" aria-expanded="false" title="修改比赛 Modify Contest">
            <i class="bi bi-sliders2 admin-subnav-icon" aria-hidden="true"></i><span class="admin-subnav-stack"><span class="admin-subnav-cn">设置</span><span class="en-text">Modify</span></span>
        </a>
    </li>
    {if !isset($contest.flg_archive) || $contest.flg_archive == 0}
    <li class="nav-item">
        <a class="nav-link{if $action == 'contest_rejudge'} active{/if}" href="/{$module}/admin/contest_rejudge?cid={$contest['contest_id']}" role="button" aria-haspopup="true" aria-expanded="false" title="重判提交 Rejudge Submissions">
            <i class="bi bi-arrow-repeat admin-subnav-icon" aria-hidden="true"></i><span class="admin-subnav-stack"><span class="admin-subnav-cn">重判</span><span class="en-text">Rejudge</span></span>
        </a>
    </li>
    {/if}
    {/if}
    <li class="nav-item">
        <a class="nav-link{if $action == 'msg'} active{/if}" href="/{$module}/admin/msg?cid={$contest['contest_id']}" role="button" aria-haspopup="true" aria-expanded="false" title="弹窗通知 Contest Messages">
            <i class="bi bi-megaphone admin-subnav-icon" aria-hidden="true"></i><span class="admin-subnav-stack"><span class="admin-subnav-cn">弹窗</span><span class="en-text">Message</span></span>
        </a>
    </li>
    {if $module == 'cpcsys'}
        <li class="nav-item dropdown{if $action == 'contest_teamgen' || $action == 'contest_staffgen' || $action == 'client_manage' || $action == 'ipcheck'} active{/if}">
            <a class="nav-link dropdown-toggle{if $action == 'contest_teamgen' || $action == 'contest_staffgen' || $action == 'client_manage' || $action == 'ipcheck'} active{/if}" href="#" id="cpcsysAccountClientDropdown" role="button" data-bs-toggle="dropdown" aria-expanded="false" aria-label="账号、客户端与 IP Account, client and IP">
                <i class="bi bi-people admin-subnav-icon" aria-hidden="true"></i><span class="admin-subnav-stack"><span class="admin-subnav-cn">账号</span><span class="en-text">Account</span></span>
            </a>
            <ul class="dropdown-menu" aria-labelledby="cpcsysAccountClientDropdown">
                {if isset($isContestSysAdmin) && $isContestSysAdmin}
                <li><a class="dropdown-item{if $action == 'contest_teamgen'} active{/if}" href="/{$module}/admin/contest_teamgen?cid={$contest['contest_id']}"><i class="bi bi-diagram-3 admin-subnav-icon" aria-hidden="true"></i><span class="admin-subnav-stack"><span class="admin-subnav-cn">队伍</span><span class="en-text">TeamGen</span></span></a></li>
                <li><a class="dropdown-item{if $action == 'contest_staffgen'} active{/if}" href="/{$module}/admin/contest_staffgen?cid={$contest['contest_id']}"><i class="bi bi-person-badge admin-subnav-icon" aria-hidden="true"></i><span class="admin-subnav-stack"><span class="admin-subnav-cn">赛务</span><span class="en-text">StaffGen</span></span></a></li>
                {/if}
                {if $isContestAdmin}
                {if isset($isContestSysAdmin) && $isContestSysAdmin}<li><hr class="dropdown-divider" role="separator"></li>{/if}
                <li><a class="dropdown-item{if $action == 'client_manage'} active{/if}" href="/{$module}/admin/client_manage?cid={$contest['contest_id']}"><i class="bi bi-cpu admin-subnav-icon" aria-hidden="true"></i><span class="admin-subnav-stack"><span class="admin-subnav-cn">客户端管理</span><span class="en-text">Client Manage</span></span></a></li>
                {/if}
                <li><a class="dropdown-item{if $action == 'ipcheck'} active{/if}" href="/{$module}/admin/ipcheck?cid={$contest['contest_id']}"><i class="bi bi-geo-alt admin-subnav-icon" aria-hidden="true"></i><span class="admin-subnav-stack"><span class="admin-subnav-cn">IP检查</span><span class="en-text">IPCheck</span></span></a></li>
            </ul>
        </li>
    {/if}
    {if ($isContestAdmin || isset($proctorAdmin) && $proctorAdmin) && $module != 'expsys'}
        {if $module == 'cpcsys' || $module == 'csgoj'}
        <li class="nav-item dropdown{if $action == 'rank_roll' || $action == 'rank_team_image' || $action == 'outrank' || $action == 'award' || $action == 'award_deck'} active{/if}">
            <a class="nav-link dropdown-toggle{if $action == 'rank_roll' || $action == 'rank_team_image' || $action == 'outrank' || $action == 'award' || $action == 'award_deck'} active{/if}" href="#" id="standingsDropdown" role="button" data-bs-toggle="dropdown" aria-expanded="false" aria-label="榜单 Standings">
                <i class="bi bi-list-ol admin-subnav-icon" aria-hidden="true"></i><span class="admin-subnav-stack"><span class="admin-subnav-cn">榜单</span><span class="en-text">Standings</span></span>
            </a>
            <ul class="dropdown-menu" aria-labelledby="standingsDropdown">
                <li><a class="dropdown-item{if $action == 'rank_roll'} active{/if}" href="/{$module}/admin/rank_roll?cid={$contest['contest_id']}"><i class="bi bi-arrow-down-up admin-subnav-icon" aria-hidden="true"></i><span class="admin-subnav-stack"><span class="admin-subnav-cn">滚榜</span><span class="en-text">Rank Roll</span></span></a></li>
                {if intval($contest['private']) % 10 == 2}
                <li><a class="dropdown-item{if $action == 'rank_team_image'} active{/if}" href="/{$module}/admin/rank_team_image?cid={$contest['contest_id']}"><i class="bi bi-image admin-subnav-icon" aria-hidden="true"></i><span class="admin-subnav-stack"><span class="admin-subnav-cn">队伍图片</span><span class="en-text">Team Image</span></span></a></li>
                {/if}
                <li><a class="dropdown-item{if $action == 'outrank'} active{/if}" href="/{$module}/admin/outrank?cid={$contest['contest_id']}"><i class="bi bi-box-arrow-up-right admin-subnav-icon" aria-hidden="true"></i><span class="admin-subnav-stack"><span class="admin-subnav-cn">外榜</span><span class="en-text">Outer Rank</span></span></a></li>
                {if $isContestAdmin }
                <li><a class="dropdown-item{if $action == 'award'} active{/if}" href="/{$module}/admin/award?cid={$contest['contest_id']}" id="contest_award" cid="{$contest['contest_id']}"><i class="bi bi-trophy admin-subnav-icon" aria-hidden="true"></i><span class="admin-subnav-stack"><span class="admin-subnav-cn">奖项</span><span class="en-text">Award</span></span></a></li>
                <li><a class="dropdown-item{if $action == 'award_deck'} active{/if}" href="/{$module}/admin/award_deck?cid={$contest['contest_id']}"><i class="bi bi-easel admin-subnav-icon" aria-hidden="true"></i><span class="admin-subnav-stack"><span class="admin-subnav-cn">颁奖编排</span><span class="en-text">Award Deck</span></span></a></li>
                {/if}
            </ul>
        </li>
        {else}
        <li class="nav-item">
            <a class="nav-link{if $action == 'rank_roll'} active{/if}" href="/{$module}/admin/rank_roll?cid={$contest['contest_id']}" title="滚榜 Rank Roll">
                <i class="bi bi-bar-chart-steps admin-subnav-icon" aria-hidden="true"></i><span class="admin-subnav-stack"><span class="admin-subnav-cn">滚榜</span><span class="en-text">RankRoll</span></span>
            </a>
        </li>
        <li class="nav-item">
            <a class="nav-link{if $action == 'outrank'} active{/if}" href="/{$module}/admin/outrank?cid={$contest['contest_id']}" title="外榜 Outer Rank">
                <i class="bi bi-box-arrow-up-right admin-subnav-icon" aria-hidden="true"></i><span class="admin-subnav-stack"><span class="admin-subnav-cn">外榜</span><span class="en-text">OuterRank</span></span>
            </a>
        </li>
        {/if}
    {/if}
    {if $isContestAdmin }
    <li class="nav-item">
        <a class="nav-link{if $action == 'contest2print'} active{/if}" href="/{$module}/admin/contest2print?cid={$contest['contest_id']}" id="contest_printp" title="题册打印 Print booklet">
            <i class="bi bi-printer admin-subnav-icon" aria-hidden="true"></i><span class="admin-subnav-stack"><span class="admin-subnav-cn">题册</span><span class="en-text">Booklet</span></span>
        </a>
    </li>
    {if $module != 'expsys' && $module != 'cpcsys' && $module != 'csgoj'}
    <li class="nav-item">
        <a class="nav-link{if $action == 'award'} active{/if}" href="/{$module}/admin/award?cid={$contest['contest_id']}" id="contest_award" cid="{$contest['contest_id']}" title="奖项设置 Award Settings">
            <i class="bi bi-trophy admin-subnav-icon" aria-hidden="true"></i><span class="admin-subnav-stack"><span class="admin-subnav-cn">奖项</span><span class="en-text">Award</span></span>
        </a>
    </li>
    {/if}
    {/if}
    {if $module == 'cpcsys' && isset($contest['contest_id']) && IsAdmin('administrator') && isset($OJ_STATUS) && $OJ_STATUS == 'cpc'}
    <li class="nav-item">
        <button type="button" class="nav-link" id="cpcsys_contest_archive_export_btn" data-cid="{$contest['contest_id']}" title="系统管理员：归档导出比赛包 / Site admin: contest archive export">
            <i class="bi bi-archive admin-subnav-icon" aria-hidden="true"></i><span class="admin-subnav-stack"><span class="admin-subnav-cn">归档</span><span class="en-text">Archive</span></span>
        </button>
    </li>
    {/if}
</ul>
{css href="__STATIC__/csgoj/admin/admin.css" /}
{if $module == 'cpcsys' && isset($contest['contest_id']) && IsAdmin('administrator') && isset($OJ_STATUS) && $OJ_STATUS == 'cpc'}
{js href="__STATIC__/cpcsys/admin/contest_admin_archive_export.js" /}
{/if}
