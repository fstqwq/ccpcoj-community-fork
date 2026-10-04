{css href="__STATIC__/csgoj/user/passback.css" /}
{js href="__STATIC__/csgoj/user/passback.js" /}
<?php
$csg_ph_icon_class = 'bi-shield-lock-fill';
$csg_ph_title = '重置密码';
$csg_ph_en = 'Reset password';
?>
{include file="../../csgoj/view/public/csg_page_header" /}

<div class="container passback-page">
	<div class="passback-card">
		{if !$authOk }
		<div class="alert alert-light border passback-hint passback-alert-invalid mb-0" role="alert">
			<strong>链接无效或已失效</strong>
			<span class="en-text d-block mt-1" style="font-weight: 600;">Invalid or expired link</span>
			<p class="mb-2 mt-2 small text-muted">
				可能原因：链接已过期、已使用过一次，或地址不完整。
				<span class="en-text">The link may have expired, already been used, or is incomplete.</span>
			</p>
			<a href="__OJ__/user/passback" class="btn btn-outline-primary btn-sm mt-1" title="重新申请找回密码 / Request password recovery again">
				<span class="cn-text">重新申请找回密码</span>
				<span class="en-text">Request password recovery again</span>
			</a>
		</div>
		{else /}
		<div class="passback-hint mb-3">
			正在重置账号 <strong>{$user_id}</strong> 的登录密码，请设置新密码并牢记。
			<span class="en-text">Set a new password for this account. Choose one you can remember.</span>
		</div>

		<form id="passback_retrieve_form" method="post" action="__OJ__/user/passback_retrieve_ajax" novalidate>
			<div class="mb-3">
				<label for="reset_password" class="form-label">
					新密码
					<span class="en-text">New password</span>
				</label>
				<input type="password" id="reset_password" class="form-control" name="password" placeholder="至少 6 位 At least 6 characters" required autocomplete="new-password" minlength="6" maxlength="64">
			</div>
			<div class="mb-3">
				<label for="confirm_password" class="form-label">
					确认密码
					<span class="en-text">Confirm password</span>
				</label>
				<input type="password" id="confirm_password" class="form-control" name="confirm_password" placeholder="再次输入新密码 Re-enter password" required autocomplete="new-password" minlength="6" maxlength="64">
			</div>
			<input type="hidden" name="user_id" value="{$user_id}">
			<input type="hidden" name="token" value="{$token}">
			<div class="passback-actions">
				<button type="submit" id="submit_button" class="btn btn-primary passback-bilingual-submit" title="保存新密码 Save new password">
					<span class="cn-text"><i class="bi bi-check2-circle"></i> 保存新密码</span>
					<span class="en-text">Save password</span>
				</button>
				<span class="passback-back">
					<a href="__OJ__/user/userinfo?user_id={$user_id}" class="a_noline" title="查看用户资料 / View profile">
						公开资料<span class="en-text">Public profile</span>
					</a>
				</span>
			</div>
		</form>
		{/if}
	</div>
</div>

{if $authOk }
<script type="text/javascript">
	$(document).ready(function () {
		var submit_button = $('#submit_button');
		function validatePasswordMatch(value, element) {
			var passwordField = document.getElementById('reset_password');
			return passwordField && value === passwordField.value;
		}
		window.FormValidationTip.initFormValidation('#passback_retrieve_form', {
			password: {
				rules: {
					required: true,
					minlength: 6,
					maxlength: 64
				},
				messages: {
					minlength: window.FormValidationTip.createBilingualMessage('密码至少 6 位', 'Password must be at least 6 characters'),
					maxlength: window.FormValidationTip.createBilingualMessage('密码至多 64 位', 'Password must be at most 64 characters')
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
			}
		}, function (form) {
			submit_button.data('original-html', submit_button.html());
			submit_button.attr('disabled', true);
			submit_button.html('<span class="cn-text">提交中</span><span class="en-text">Submitting</span>');
			$(form).ajaxSubmit({
				success: function (ret) {
					if (typeof window.csgPassbackAlertAjax === 'function') {
						window.csgPassbackAlertAjax(ret, {
							callback: function () {
								if (ret && ret.code === 1) {
									location.href = '__OJ__/';
								}
							}
						});
					}
					button_delay_auto(submit_button, 3, 'start');
					return false;
				}
			});
			return false;
		});
	});
</script>
{/if}
