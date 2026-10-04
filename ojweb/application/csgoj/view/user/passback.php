{css href="__STATIC__/csgoj/user/passback.css" /}
{js href="__STATIC__/csgoj/user/passback.js" /}
<?php
$csg_ph_icon_class = 'bi-key-fill';
$csg_ph_title = '找回密码';
$csg_ph_en = 'Password recovery';
?>
{include file="../../csgoj/view/public/csg_page_header" /}

<div class="container passback-page">
	<div class="passback-card">
		<div class="passback-hint">
			我们将向该账号绑定的邮箱发送重置链接，请确保邮箱可用并及时查收。
			<span class="en-text">We will send a reset link to the email on file. Make sure it is valid and check your inbox.</span>
		</div>

		<form id="passback_form" method="post" action="__OJ__/user/passback_ajax" novalidate>
			<div class="mb-3">
				<label for="passback_user_id" class="form-label">
					用户名
					<span class="en-text">User ID</span>
				</label>
				<input type="text" class="form-control" id="passback_user_id" name="user_id" placeholder="用户名 User ID" required autocomplete="username" maxlength="64">
			</div>
			<div class="mb-3">
				<label for="passback_vcode" class="form-label">
					验证码
					<span class="en-text">Verification code</span>
				</label>
				<div class="passback-captcha-row">
					<div class="passback-captcha-input">
						<input type="text" class="form-control" id="passback_vcode" name="vcode" placeholder="验证码 Code" required autocomplete="off" maxlength="32">
					</div>
					<label id="vcode" class="mb-0" data-captcha-base="{:url('/captcha')}" title="点击刷新验证码 / Click to refresh">
						{:captcha_img()}
					</label>
				</div>
			</div>
			<div class="passback-actions">
				<button type="submit" id="submit_button" class="btn btn-primary passback-bilingual-submit" title="发送重置邮件 Send reset email">
					<span class="cn-text"><i class="bi bi-envelope-arrow-up"></i> 发送重置邮件</span>
					<span class="en-text">Send reset email</span>
				</button>
				<span class="passback-back">
					<a href="__OJ__/" class="a_noline" title="首页侧栏可登录 / Login from sidebar">
						返回首页<span class="en-text">Back to home</span>
					</a>
				</span>
			</div>
		</form>

		<div class="passback-footnote">
			若邮箱不可用或一直收不到邮件，可加入 QQ 群 1065953958 在群内说明情况（请勿私聊管理员）。
			<span class="en-text">If your email is invalid or you never receive the message, join QQ group 1065953958 and ask in the group (do not DM admins).</span>
		</div>
	</div>
</div>

<script type="text/javascript">
	$('#vcode').on('click', function () {
		var base = $(this).data('captcha-base') || '/captcha';
		var sep = base.indexOf('?') >= 0 ? '&' : '?';
		var ts = Date.now();
		this.getElementsByTagName('img')[0].src = base + sep + '_t=' + ts;
	});
	$(document).ready(function () {
		var submit_button = $('#submit_button');
		window.FormValidationTip.initFormValidation('#passback_form', {
			user_id: {
				rules: {
					required: true,
					minlength: 3,
					maxlength: 64
				},
				messages: {
					minlength: window.FormValidationTip.createBilingualMessage('用户名至少 3 个字符', 'User ID must be at least 3 characters'),
					maxlength: window.FormValidationTip.createBilingualMessage('用户名至多 64 个字符', 'User ID must be at most 64 characters')
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
					if (typeof window.csgPassbackAlertAjax === 'function') {
						window.csgPassbackAlertAjax(ret);
					}
					button_delay_auto(submit_button, 3, 'start');
					var base = $('#vcode').data('captcha-base') || '/captcha';
					var sep = base.indexOf('?') >= 0 ? '&' : '?';
					$('#vcode').find('img').attr('src', base + sep + '_t=' + Date.now());
					return false;
				}
			});
			return false;
		});
	});
</script>
