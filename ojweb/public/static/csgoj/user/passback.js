/**
 * 找回密码 / 邮件链接重置页 — AJAX 返回统一用 alerty 双语提示（与 successBilingual / errorBilingual 约定一致）
 */
(function (window) {
	'use strict';

	/**
	 * @param {object} ret ThinkPHP JSON：code 1 成功，0 失败；data.flg_bilingual + msg_cn/msg_en 为双语
	 * @param {object} [options]
	 * @param {function} [options.callback] 用户关闭提示框后执行（成功/失败均可）
	 */
	window.csgPassbackAlertAjax = function (ret, options) {
		options = options || {};
		var A = window.alerty;
		var d = ret && ret.data ? ret.data : {};
		var hasBi = d.flg_bilingual && d.msg_cn !== undefined && d.msg_en !== undefined;
		var opts = {};
		if (typeof options.callback === 'function') {
			opts.callback = options.callback;
		}
		if (ret && ret.code === 1) {
			if (hasBi) {
				opts.message = d.msg_cn;
				opts.message_en = d.msg_en;
			} else {
				opts.message = ret.msg || '';
			}
		} else {
			if (hasBi) {
				opts.message = d.msg_cn;
				opts.message_en = d.msg_en;
			} else {
				opts.message = (ret && ret.msg) ? ret.msg : '';
			}
		}
		if (!opts.message && !opts.message_en) {
			opts.message = '操作失败，请稍后重试。';
			opts.message_en = 'Something went wrong. Please try again later.';
		}
		if (A && typeof A.alert === 'function') {
			A.alert(opts);
		}
	};
})(window);
