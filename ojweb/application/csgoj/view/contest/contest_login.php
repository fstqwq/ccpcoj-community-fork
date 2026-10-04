<!-- 公共比赛登录框模板 -->
{if $needAuth /}
<div class="alert alert-warning d-flex flex-column gap-3">
    <div class="d-flex align-items-center">
        <i class="bi bi-shield-lock me-2"></i>
        <span class="bilingual-inline">此比赛已加密，需要验证密码<span class="en-text">This contest is encrypted, you need to verify the password.</span></span>
    </div>
    
    <form id="contest_auth_form" method='post' action="/{$module}/{$contest_controller}/contest_auth_ajax" class="contest-auth-form" autocomplete="off">
        <input type="hidden" class="form-control" name="cid" value="{$contest['contest_id']}">
        
        <!-- 统一错误提示区域 - 复用登录页面的样式 -->
        <div id="contest_auth_error_alert" class="mb-2" style="display: none;"></div>
        
        <!-- 隐藏的假输入框，防止浏览器自动填充系统登录框的账号密码 -->
        <input type="text" name="contest_username_fake" autocomplete="off" style="position: absolute; left: -9999px; opacity: 0; pointer-events: none; tabindex: -1;" tabindex="-1" aria-hidden="true">
        <input type="password" name="contest_password_fake" autocomplete="new-password" style="position: absolute; left: -9999px; opacity: 0; pointer-events: none; tabindex: -1;" tabindex="-1" aria-hidden="true">
        
        <div class="form-group">
            <label for="contest_pass" class="form-label bilingual-inline">比赛密码<span class="en-text">Contest Password</span></label>
            <input type="text" id="contest_pass" name="contest_pass" class="form-control" placeholder="比赛密码 Contest Password..." required autocomplete="off" data-bs-toggle="tooltip" data-bs-placement="top" title="" />
        </div>
        
        <div class="form-group">
            <button type="submit" id="submit_button" class="btn btn-primary">提交<span class="en-text">Submit</span></button>
        </div>
    </form>
</div>
<script type="text/javascript">
    // 传递模板变量给JavaScript
    window.CONTEST_PASS_CONFIG = {
        authUrl: "/{$module}/{$contest_controller}/contest_auth_ajax",
        cid: "{$contest['contest_id']}"
    };
</script>
{css href="__STATIC__/csgoj/contest/contest_auth_index.css" /}
{js href="__STATIC__/csgoj/contest/contest_auth_index.js" /}
{/if}
