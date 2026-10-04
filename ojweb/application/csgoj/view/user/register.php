{if $OJ_FLG_REGISTER_DISABLED}
{css href="__STATIC__/csgoj/user/passback.css" /}
<?php
$csg_ph_icon_class = 'bi-person-plus';
$csg_ph_title = '注册不可用';
$csg_ph_en = 'Registration unavailable';
?>
{include file="../../csgoj/view/public/csg_page_header" /}
<div class="container passback-page register-closed-page">
    <div class="passback-card">
        <div class="passback-hint register-closed-hint">
            <p class="mb-2 cn-text">本站当前未开放自助注册。若您已有账号，请在站点开放登录后再进行登录。</p>
            <p class="mb-0 en-text">Self-service registration is not open. If you already have an account, please sign in when the site allows login.</p>
        </div>
        <div class="register-closed-actions">
            <a href="__OJ__/" class="btn btn-outline-primary btn-sm a_noline">
                <span class="cn-text"><i class="bi bi-house-door"></i> 返回首页</span>
                <span class="en-text">Back to home</span>
            </a>
        </div>
    </div>
</div>
<style type="text/css">
.register-closed-page .register-closed-actions { margin-top: 1rem; }
.register-closed-page .register-closed-hint p:last-child { margin-bottom: 0 !important; }
</style>
{else /}
{css href="__STATIC__/csgoj/user/passback.css" /}
{js href="__STATIC__/csgoj/user/passback.js" /}
<?php
$csg_ph_icon_class = 'bi-person-plus';
$csg_ph_title = '用户注册';
$csg_ph_en = 'Create account';
?>
{include file="../../csgoj/view/public/csg_page_header" /}

<div class="container passback-page register-page">
    <div class="passback-card">
        <form id="register_form" method="post" action="__OJ__/user/register_ajax" novalidate>
            <div class="mb-3 register-field">
                <div class="register-label-row">
                    <label for="register_user_id" class="form-label mb-0 register-form-label-stack">
                        <span class="cn-text">用户名 <span class="text-danger">*</span></span>
                        <span class="en-text">User ID</span>
                    </label>
                    <span class="register-field-hint">
                        <span class="cn-text">5～20 位；须以字母开头，其余可为字母、数字或下划线</span>
                        <span class="en-text">5–20 characters; letter first; then letters, digits or underscores</span>
                    </span>
                </div>
                <input type="text" class="form-control" id="register_user_id" name="user_id" placeholder="例如 Alex_team01 / e.g. Alex_team01" required autofocus maxlength="20" autocomplete="username">
            </div>
            <div class="mb-3 register-field">
                <div class="register-label-row">
                    <label for="register_nick" class="form-label mb-0 register-form-label-stack">
                        <span class="cn-text">昵称</span>
                        <span class="en-text">Nick</span>
                    </label>
                    <span class="register-field-hint">
                        <span class="cn-text">可不填，最多 32 个字符</span>
                        <span class="en-text">Optional; up to 32 characters</span>
                    </span>
                </div>
                <input type="text" class="form-control" id="register_nick" name="nick" maxlength="32" autocomplete="nickname">
            </div>
            <div class="mb-3 register-field">
                <div class="register-label-row">
                    <label for="register_school" class="form-label mb-0 register-form-label-stack">
                        <span class="cn-text">学校</span>
                        <span class="en-text">School</span>
                    </label>
                    <span class="register-field-hint">
                        <span class="cn-text">可不填，最多 32 个字符</span>
                        <span class="en-text">Optional; up to 32 characters</span>
                    </span>
                </div>
                <input type="text" class="form-control" id="register_school" name="school" maxlength="32" autocomplete="organization">
            </div>
            <div class="mb-3 register-field">
                <div class="register-label-row">
                    <label for="register_email" class="form-label mb-0 register-form-label-stack">
                        <span class="cn-text">邮箱 <span class="text-danger">*</span></span>
                        <span class="en-text">E-mail</span>
                    </label>
                    <span class="register-field-hint">
                        <span class="cn-text">请填常用邮箱，用于找回密码</span>
                        <span class="en-text">Use an inbox you can open — for password recovery</span>
                    </span>
                </div>
                <input type="email" class="form-control" id="register_email" name="email" placeholder="name@example.com" required maxlength="64" autocomplete="email">
            </div>
            <div class="mb-3 register-field">
                <div class="register-label-row">
                    <label for="register_password" class="form-label mb-0 register-form-label-stack">
                        <span class="cn-text">密码 <span class="text-danger">*</span></span>
                        <span class="en-text">Password</span>
                    </label>
                    <span class="register-field-hint">
                        <span class="cn-text">至少 6 位，建议包含字母与数字</span>
                        <span class="en-text">At least 6 characters; letters and digits recommended</span>
                    </span>
                </div>
                <input type="password" class="form-control" id="register_password" name="password" required minlength="6" maxlength="64" autocomplete="new-password">
            </div>
            <div class="mb-3 register-field">
                <div class="register-label-row">
                    <label for="register_confirm_password" class="form-label mb-0 register-form-label-stack">
                        <span class="cn-text">确认密码 <span class="text-danger">*</span></span>
                        <span class="en-text">Confirm password</span>
                    </label>
                    <span class="register-field-hint">
                        <span class="cn-text">请再次输入，须与上方密码一致</span>
                        <span class="en-text">Re-enter; must match the password above</span>
                    </span>
                </div>
                <input type="password" class="form-control" id="register_confirm_password" name="confirm_password" required minlength="6" maxlength="64" autocomplete="new-password">
            </div>
            <div class="mb-3 register-field">
                <label for="register_vcode" class="form-label register-form-label-stack">
                    <span class="cn-text">验证码 <span class="text-danger">*</span></span>
                    <span class="en-text">Verification code</span>
                </label>
                <div class="passback-captcha-row">
                    <div class="passback-captcha-input">
                        <input type="text" class="form-control" id="register_vcode" name="vcode" placeholder="图中字符 / Characters shown" required maxlength="32" autocomplete="off">
                    </div>
                    <label id="register_captcha_wrap" class="mb-0" data-captcha-base="{:url('/captcha')}" title="点击刷新验证码 / Click to refresh">
                        {:captcha_img()}
                    </label>
                </div>
            </div>

            <div class="passback-actions register-form-actions">
                <button type="submit" id="submit_button" class="btn btn-primary passback-bilingual-submit" title="提交注册 Create account">
                    <span class="cn-text"><i class="bi bi-person-check"></i> 提交注册</span>
                    <span class="en-text">Create account</span>
                </button>
                <span class="passback-back">
                    <a href="__OJ__/" class="a_noline" title="返回首页 / Back to home">
                        返回首页<span class="en-text">Back to home</span>
                    </a>
                </span>
            </div>
        </form>
    </div>
</div>

<style type="text/css">
/* 注册表单略宽于找回密码页，便于右侧说明中英各一行 */
.register-page.passback-page {
	max-width: 46rem;
}
.register-page .register-label-row {
	display: flex;
	flex-wrap: nowrap;
	align-items: flex-start;
	justify-content: space-between;
	gap: 0.75rem 1.25rem;
	margin-bottom: 0.4rem;
}
.register-page .register-form-label-stack {
	display: flex;
	flex-direction: column;
	align-items: flex-start;
	gap: 0.15rem;
}
.register-page .register-field > .register-form-label-stack {
	margin-bottom: 0.35rem;
}
.register-page .register-form-label-stack > .en-text {
	margin-left: 0;
	margin-top: 0;
}
.register-page .passback-card {
	overflow-x: auto;
}
.register-page .register-label-row .form-label {
	flex: 0 0 auto;
	max-width: 40%;
	margin-bottom: 0;
}
.register-page .register-field-hint {
	flex: 0 1 auto;
	margin-left: auto;
	min-width: 0;
	display: flex;
	flex-direction: column;
	align-items: flex-end;
	gap: 0.12rem;
	font-size: 0.78rem;
	font-weight: 500;
	color: var(--csg-ph-muted, #64748b);
	line-height: 1.35;
	text-align: right;
}
.register-page .register-field-hint .cn-text {
	display: block;
	white-space: nowrap;
}
.register-page .register-field-hint .en-text {
	display: block;
	margin-left: 0;
	font-style: normal;
	font-weight: 500;
	font-size: 0.72rem;
	opacity: 0.9;
	line-height: 1.35;
	white-space: nowrap;
}
@media (max-width: 36rem) {
	.register-page.passback-page {
		max-width: 100%;
	}
	.register-page .register-label-row {
		flex-wrap: wrap;
	}
	.register-page .register-label-row .form-label {
		max-width: 100%;
	}
	.register-page .register-field-hint {
		margin-left: 0;
		align-items: flex-start;
		text-align: left;
		width: 100%;
	}
	.register-page .register-field-hint .cn-text,
	.register-page .register-field-hint .en-text {
		white-space: normal;
	}
}
.register-page .register-form-actions { margin-top: 0.5rem; }
</style>

<script type="text/javascript">
    $('#register_captcha_wrap').on('click', function () {
        var base = $(this).data('captcha-base') || '/captcha';
        var sep = base.indexOf('?') >= 0 ? '&' : '?';
        var ts = Date.now();
        var img = this.getElementsByTagName('img')[0];
        if (img) {
            img.src = base + sep + '_t=' + ts;
        }
    });

    $(document).ready(function () {
        function validatePasswordMatch(value, element) {
            var passwordField = document.getElementById('register_password');
            return passwordField && value === passwordField.value;
        }

        var submit_button = $('#submit_button');

        function registerResetSubmitButton() {
            var t = submit_button.data('delay-timer');
            if (t) {
                clearInterval(t);
                submit_button.removeData('delay-timer');
            }
            var oh = submit_button.data('original-html');
            if (oh) {
                submit_button.html(oh);
            }
            submit_button.removeAttr('disabled');
        }

        function registerRefreshCaptcha() {
            var base = $('#register_captcha_wrap').data('captcha-base') || '/captcha';
            var sep = base.indexOf('?') >= 0 ? '&' : '?';
            $('#register_captcha_wrap').find('img').attr('src', base + sep + '_t=' + Date.now());
        }

        window.FormValidationTip.initFormValidation('#register_form', {
            user_id: {
                rules: {
                    required: true,
                    minlength: 5,
                    maxlength: 20,
                    pattern: /^[a-zA-Z][a-zA-Z0-9_]*$/
                },
                messages: {
                    pattern: window.FormValidationTip.createBilingualMessage('须以字母开头，仅可使用字母、数字与下划线', 'Must start with a letter; only letters, digits and underscores after that')
                }
            },
            password: {
                rules: {
                    required: true,
                    minlength: 6,
                    maxlength: 64
                }
            },
            confirm_password: {
                rules: {
                    required: true,
                    minlength: 6,
                    maxlength: 64,
                    custom: [validatePasswordMatch]
                },
                messages: {
                    custom: window.FormValidationTip.createBilingualMessage('两次输入的密码不一致', 'Passwords do not match')
                }
            },
            school: {
                rules: {
                    maxlength: 32
                }
            },
            nick: {
                rules: {
                    maxlength: 32
                }
            },
            email: {
                rules: {
                    required: true,
                    email: true,
                    maxlength: 64
                }
            },
            vcode: {
                rules: {
                    required: true
                }
            }
        }, function (form) {
            submit_button.data('original-html', submit_button.html());
            submit_button.attr('disabled', true);
            submit_button.html('<span class="cn-text">提交中</span><span class="en-text">Submitting</span>');
            $(form).ajaxSubmit({
                success: function (ret) {
                    try {
                        if (ret === null || ret === undefined || typeof ret !== 'object' || Array.isArray(ret)) {
                            registerResetSubmitButton();
                            registerRefreshCaptcha();
                            if (window.alerty && typeof window.alerty.alert === 'function') {
                                window.alerty.alert({ message: '服务器返回异常，请稍后重试。 / Invalid server response. Please try again.' });
                            }
                            return false;
                        }
                        if (ret.code === 1) {
                            if (typeof window.csgPassbackAlertAjax === 'function') {
                                window.csgPassbackAlertAjax(ret, {
                                    callback: function () {
                                        registerResetSubmitButton();
                                        var uid = (ret.data && ret.data.user_id) ? ret.data.user_id : '';
                                        location.href = '__OJ__/user/userinfo?user_id=' + encodeURIComponent(uid);
                                    }
                                });
                            } else if (window.alerty && typeof window.alerty.alert === 'function') {
                                window.alerty.alert({
                                    message: ret.msg || (ret.data && ret.data.msg_cn) || '',
                                    callback: function () {
                                        registerResetSubmitButton();
                                        location.href = '__OJ__/user/userinfo?user_id=' + encodeURIComponent(ret.data.user_id);
                                    }
                                });
                            } else {
                                registerResetSubmitButton();
                            }
                            return false;
                        }
                        registerResetSubmitButton();
                        registerRefreshCaptcha();
                        if (typeof window.csgPassbackAlertAjax === 'function') {
                            window.csgPassbackAlertAjax(ret);
                        } else if (window.alerty && typeof window.alerty.alert === 'function') {
                            window.alerty.alert(ret.msg || '');
                        }
                    } catch (e) {
                        registerResetSubmitButton();
                        registerRefreshCaptcha();
                        if (typeof console !== 'undefined' && console.error) {
                            console.error(e);
                        }
                    }
                    return false;
                },
                error: function () {
                    registerResetSubmitButton();
                    registerRefreshCaptcha();
                    if (window.alerty && typeof window.alerty.alert === 'function') {
                        window.alerty.alert({ message: '网络或服务器错误，请稍后重试。 / Network or server error. Please try again.' });
                    }
                }
            });
            return false;
        });
    });
</script>
{/if}
