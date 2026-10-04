<!-- 标准比赛登录框模板 -->
{if $needAuth /}
{if $isCollectMode /}
<!-- 收集模式界面 -->
<div class="alert alert-danger border-danger mb-3" style="background-color: #f8d7da; border-left: 4px solid #dc3545 !important;">
    <div class="d-flex align-items-start">
        <i class="bi bi-exclamation-triangle-fill me-2" style="color: #dc3545; font-size: 1.2rem;"></i>
        <div>
            <strong style="color: #721c24;">此界面为赛务工作界面，如果您是选手，请勿操作，并联系管理员处理</strong>
            <div class="en-text" style="color: #721c24; font-size: 0.9em; margin-top: 0.25rem;">
                <strong>This is a contest management interface. If you are a contestant, please do not operate and contact the administrator.</strong>
            </div>
        </div>
    </div>
</div>
<div class="alert alert-info d-flex flex-column gap-2">
    <div class="d-flex align-items-center">
        <i class="bi bi-person-plus me-2"></i>
        <span>账号收集<span class="en-text">Account Collection</span></span>
    </div>
    
    <form id="contest_collect_form" method='post' action="/{$module}/contest/contest_collect_team_ajax" class="contest-auth-form">
        <input type="hidden" name="cid" value="{$contest['contest_id']}">
        
        <div class="form-group">
            <label class="form-label">
                <span>请输入队伍ID<span class="en-text">Please enter Team ID</span></span>
            </label>
            <input type="text" id="collect_team_id" name="team_id" class="form-control" placeholder="队伍ID(Team ID)" required autofocus />
        </div>
        
        {if $team_id_bind != null /}
        <div class="alert alert-success">
            <span>已登记队伍：<strong>{$team_id_bind}</strong><span class="en-text">Registered Team: <strong>{$team_id_bind}</strong></span></span>
        </div>
        {/if}
        
        <div class="form-group">
            <button type="submit" id="collect_submit_button" class="btn btn-primary">提交<span class="en-text">Submit</span></button>
        </div>
        
        <div class="text-muted small">
            <span>当前IP：<code>{$client_ip}</code><span class="en-text">Current IP: <code>{$client_ip}</code></span></span>
        </div>
    </form>
</div>
{else /}
<!-- 正常登录界面 -->
<?php $csg_login_variant = 'contest'; ?>
{include file="../../csgoj/view/contest/contest_login_table" /}
{/if}
<script type="text/javascript">
    // 传递模板变量给JavaScript（两种模式都需要）
    window.CONTEST_AUTH_CONFIG = {
        authUrl: "/{$module}/contest/contest_auth_ajax",
        passwordlessUrl: "/{$module}/contest/contest_auth_passwordless_ajax",
        collectUrl: "/{$module}/contest/contest_collect_team_ajax",
        cid: "{$contest['contest_id']}",
        teamIdBind: {if isset($team_id_bind) && $team_id_bind != null}"{$team_id_bind}"{else/}null{/if}
    };
</script>
{css href="__STATIC__/csgoj/contest/contest_auth_index.css" /}
{js href="__STATIC__/csgoj/contest/contest_auth_index.js" /}
{/if}
