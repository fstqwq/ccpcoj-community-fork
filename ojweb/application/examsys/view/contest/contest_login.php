<!-- 考试登录框模板 -->
{if $needAuth /}
<?php $csg_login_variant = 'exam'; ?>
{include file="../../csgoj/view/contest/contest_login_table" /}
<script type="text/javascript">
    // 传递模板变量给JavaScript
    window.EXAM_AUTH_CONFIG = {
        authUrl: "/{$module}/contest/contest_auth_ajax",
        authTypeUrl: "/{$module}/contest/team_auth_type_ajax",
        systemStatusUrl: "/{$module}/contest/system_login_status_ajax",
        cid: "{$contest['contest_id']}"
    };
</script>
{css href="__STATIC__/csgoj/contest/contest_auth_index.css" /}
{js href="__STATIC__/csgoj/contest/contest_auth_index.js" /}
{/if}

