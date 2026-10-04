/**
 * 比赛编辑通用表单校验（前台/后台均可调用）
 * - 根据页面存在的字段动态生成校验规则
 * - 允许调用方（后台）追加/覆盖规则
 * - 默认附带通用的提交处理与快捷键
 */

const LENGTH_LIMITS = {
    YEAR_MIN: 2000,
    YEAR_MAX: 2100,
    MONTH_MIN: 1,
    MONTH_MAX: 12,
    DAY_MIN: 1,
    DAY_MAX: 31,
    HOUR_MIN: 0,
    HOUR_MAX: 23,
    MINUTE_MIN: 0,
    MINUTE_MAX: 59,
    RATIO_MIN: 0,
    RATIO_MAX: 100,
    FROZEN_MIN: -1,
    FROZEN_MAX: 2592000,
    TOPTEAM_MIN: 1,
    TOPTEAM_MAX: 20,
    DESCRIPTION_MAX: 16384
};

function exists(sel) { return document.querySelector(sel) !== null; }

/**
 * 判奖比例：仅当存在「用户可直接编辑」的输入时才做 0–100 前端校验。
 * hidden 由赛事归属表（admin）或内联脚本同步提交，快捷编辑页（cpcsys/csgoj 等）不应因隐藏域触发校验。
 */
function shouldValidateAwardRatioField(id) {
    const el = document.getElementById(id);
    return !!(el && String(el.getAttribute('type') || '').toLowerCase() !== 'hidden');
}

function readIntById(id) {
    const el = document.getElementById(id);
    if (!el) return null;
    const v = String(el.value ?? '').trim();
    if (v === '') return null;
    const n = parseInt(v, 10);
    return Number.isFinite(n) ? n : null;
}

function buildDateFromInputs(prefix) {
    const y = readIntById(prefix + '_year');
    const m = readIntById(prefix + '_month');
    const d = readIntById(prefix + '_day');
    const hh = readIntById(prefix + '_hour');
    const mm = readIntById(prefix + '_minute');
    if ([y, m, d, hh, mm].some(v => v === null)) return null;

    // JS Date: month is 0-based
    const dt = new Date(y, m - 1, d, hh, mm, 0, 0);
    // 校验是否为“真实日期”（避免 2025-02-31 被 Date 自动进位）
    if (
        dt.getFullYear() !== y ||
        dt.getMonth() !== (m - 1) ||
        dt.getDate() !== d ||
        dt.getHours() !== hh ||
        dt.getMinutes() !== mm
    ) {
        return null;
    }
    return dt;
}

function validateStartEndTime() {
    // 只要页面存在时间字段就做校验
    if (!exists('#start_year') || !exists('#end_year')) return true;

    const start = buildDateFromInputs('start');
    const end = buildDateFromInputs('end');
    if (!start || !end) {
        alerty.alert({
            title: '错误',
            message: '时间格式不正确，请检查开始/结束时间',
            message_en: 'Invalid time format, please check start/end time'
        });
        return false;
    }
    if (start.getTime() >= end.getTime()) {
        alerty.alert({
            title: '错误',
            message: '开始时间必须早于结束时间',
            message_en: 'Start time must be earlier than end time'
        });
        return false;
    }
    return true;
}

function buildDynamicRules() {
    const rules = {};
    // 标题（仅后台通常存在）
    if (exists('#title')) {
        rules.title = { rules: { required: true, maxlength: 200 } };
    }
    // 描述
    if (exists('#contest_description')) {
        rules.description = { rules: { maxlength: LENGTH_LIMITS.DESCRIPTION_MAX } };
    }
    // 奖项比例（仅非 hidden：当前模板中均为 hidden，由 buildDynamicRules 跳过，避免与后台全量编辑逻辑混用）
    if (shouldValidateAwardRatioField('ratio_gold')) {
        rules.ratio_gold = { rules: { number: true, min: LENGTH_LIMITS.RATIO_MIN, max: LENGTH_LIMITS.RATIO_MAX } };
    }
    if (shouldValidateAwardRatioField('ratio_silver')) {
        rules.ratio_silver = { rules: { number: true, min: LENGTH_LIMITS.RATIO_MIN, max: LENGTH_LIMITS.RATIO_MAX } };
    }
    if (shouldValidateAwardRatioField('ratio_bronze')) {
        rules.ratio_bronze = { rules: { number: true, min: LENGTH_LIMITS.RATIO_MIN, max: LENGTH_LIMITS.RATIO_MAX } };
    }
    // 冻结时间
    if (exists('#frozen_minute'))rules.frozen_minute= { rules: { number: true, min: LENGTH_LIMITS.FROZEN_MIN, max: LENGTH_LIMITS.FROZEN_MAX } };
    if (exists('#frozen_after')) rules.frozen_after = { rules: { number: true, min: LENGTH_LIMITS.FROZEN_MIN, max: LENGTH_LIMITS.FROZEN_MAX } };
    // Top N
    if (exists('#topteam'))     rules.topteam      = { rules: { number: true, min: LENGTH_LIMITS.TOPTEAM_MIN, max: LENGTH_LIMITS.TOPTEAM_MAX } };
    // 语言
    if (exists('select[name="language[]"]')) rules['language[]'] = { rules: { required: true } };
    // 时间（存在就校验基本范围）
    const timeFields = [
        ['#start_year',   { min: LENGTH_LIMITS.YEAR_MIN,   max: LENGTH_LIMITS.YEAR_MAX }],
        ['#start_month',  { min: LENGTH_LIMITS.MONTH_MIN,  max: LENGTH_LIMITS.MONTH_MAX }],
        ['#start_day',    { min: LENGTH_LIMITS.DAY_MIN,    max: LENGTH_LIMITS.DAY_MAX }],
        ['#start_hour',   { min: LENGTH_LIMITS.HOUR_MIN,   max: LENGTH_LIMITS.HOUR_MAX }],
        ['#start_minute', { min: LENGTH_LIMITS.MINUTE_MIN, max: LENGTH_LIMITS.MINUTE_MAX }],
        ['#end_year',     { min: LENGTH_LIMITS.YEAR_MIN,   max: LENGTH_LIMITS.YEAR_MAX }],
        ['#end_month',    { min: LENGTH_LIMITS.MONTH_MIN,  max: LENGTH_LIMITS.MONTH_MAX }],
        ['#end_day',      { min: LENGTH_LIMITS.DAY_MIN,    max: LENGTH_LIMITS.DAY_MAX }],
        ['#end_hour',     { min: LENGTH_LIMITS.HOUR_MIN,   max: LENGTH_LIMITS.HOUR_MAX }],
        ['#end_minute',   { min: LENGTH_LIMITS.MINUTE_MIN, max: LENGTH_LIMITS.MINUTE_MAX }]
    ];
    timeFields.forEach(([sel, range]) => {
        const el = document.querySelector(sel);
        if (el) {
            const name = el.name;
            rules[name] = { rules: { required: true, number: true, min: range.min, max: range.max } };
        }
    });
    // 密码（仅加密模式显示）
    if (exists('#password')) {
        rules.password = { rules: { minlength: 6, maxlength: 15 } };
    }
    return rules;
}

function defaultSubmit(form, options = {}) {
    const skipClssConfirm = !!options.skipClssConfirm;
    if (typeof window.CsgValidateContestGroups === 'function') {
        const ok = window.CsgValidateContestGroups();
        if (!ok) {
            const err = window._lastContestGroupCollectErr;
            if (window.alerty && typeof alerty.error === 'function') {
                alerty.error(err || {
                    message: '请完整填写赛事归属；归属标识仅允许数字/字母/下划线，且不得重复。',
                    message_en: 'Please complete all affiliations. Affiliation ID must be alphanumeric/underscore and unique.'
                });
            }
            return false;
        }
    }
    try {
        const cfg = window.CONTEST_EDIT_CONFIG || {};
        if (cfg.view_only) {
            alerty.alert({
                title: '只读模式',
                message: '你没有该练习的写权限。你可以“复制练习”后再修改。',
                message_en: 'Read-only. Please copy the practice to modify.'
            });
            return false;
        }
    } catch (e) {}

    // 班级绑定校验（表单验证的一部分：提示并拦截提交，但不禁用按钮）
    try {
        if (window.clssSelector && typeof window.clssSelector.validate === 'function') {
            const validation = window.clssSelector.validate();
            if (!validation.valid) {
                alerty.alert({
                    title: '提示',
                    message: validation.message || '请先选择要绑定的班级',
                    message_en: 'Please select a class to bind'
                });
                return false;
            }
            if (!skipClssConfirm && validation.needConfirm) {
                alerty.confirm({
                    title: '确认选择',
                    message: validation.message,
                    message_en: validation.message,
                    callback: function() {
                        // 继续走原提交流程
                        defaultSubmit(form, { skipClssConfirm: true });
                    }
                });
                return false;
            }
        }
    } catch (e) {}

    // 提交前时间校验：多班添加时由 ExpPracticeBatchUi 逐行校验，主表时间仅作默认模板
    const _cfg = window.CONTEST_EDIT_CONFIG || {};
    if (!_cfg.exadmin_add_batch && !validateStartEndTime()) {
        return false;
    }
    if (_cfg.exadmin_add_batch && window.ExpPracticeBatchUi && typeof window.ExpPracticeBatchUi.validateOrAlert === 'function') {
        if (!window.ExpPracticeBatchUi.validateOrAlert()) {
            return false;
        }
    }
    const submitButton = document.getElementById('submit_button');
    if (!submitButton) return;
    const $btn = $('#submit_button');
    // 读取原始中英文文本
    const bt = (window.Bilingual && typeof window.Bilingual.getBilingualText === 'function')
        ? window.Bilingual.getBilingualText($btn)
        : { chinese: $btn.text(), english: '' };
    // 提交中视觉反馈
    submitButton.disabled = true;
    submitButton.innerHTML = '<span class="cn-text"><i class="bi bi-hourglass-split me-1"></i> 提交中</span><span class="en-text">Submitting</span>';

    // 练习编辑页：自动总标题时 #title 可能为 disabled，且校验层在 capture 阶段拦截 submit，
    // 需在 ajaxSubmit 序列化前同步 title（与 contest_edit_exp_title.js 一致）。
    try {
        if (typeof window.prepareExpContestFormForAjaxSubmit === 'function') {
            window.prepareExpContestFormForAjaxSubmit();
        }
    } catch (e) { /* ignore */ }

    try {
        if (typeof window.CsgContestEditFlushLocalTimesToAppBeforeSubmit === 'function') {
            window.CsgContestEditFlushLocalTimesToAppBeforeSubmit();
        }
    } catch (e2) { /* ignore */ }

    const onSuccess = function(ret) {
        if (ret && ret.code == 1) {
            try {
                const cfg0 = window.CONTEST_EDIT_CONFIG || {};
                if (
                    cfg0.exadmin_add_batch &&
                    window.ExpPracticeTimeCache &&
                    typeof window.ExpPracticeTimeCache.recordFromBatch === 'function' &&
                    window.ExpPracticeBatchUi &&
                    typeof window.ExpPracticeBatchUi.collectBatchArray === 'function'
                ) {
                    window.ExpPracticeTimeCache.recordFromBatch(window.ExpPracticeBatchUi.collectBatchArray());
                }
            } catch (e) { /* ignore */ }
            // 所有依赖已全局引入，直接使用
            {
                if (ret.data && ret.data.alert === true) {
                    alerty.alert({ message: ret.msg, title: '提示' });
                } else {
                    alerty.success(ret.msg, 'Contest successfully modified');
                }
            }
            button_delay($btn, 3, bt.chinese, null, bt.english);

            try {
                if (typeof window.CsgContestEditTimeTzInit === 'function') {
                    window.CsgContestEditTimeTzInit();
                }
            } catch (eTz) { /* ignore */ }

            // 非编辑模式（添加成功）则按返回的 id 跳转到编辑页
            try {
                const cfg = window.CONTEST_EDIT_CONFIG || {};
                if (!cfg.edit_mode && ret.data) {
                    // 支持多班级添加：如果有 ids 数组，跳转到列表页；否则跳转到编辑页
                    if (ret.data.ids && Array.isArray(ret.data.ids) && ret.data.ids.length > 1) {
                        // 多个班级，跳转到列表页
                        setTimeout(function(){
                            window.location.href = '/exadmin/contest/contest_list';
                        }, 1000);
                    } else if (ret.data.id) {
                        // 单个班级，跳转到编辑页
                        setTimeout(function(){
                            window.location.href = 'contest_edit?id=' + encodeURIComponent(ret.data.id);
                        }, 500);
                    }
                }
            } catch (e) {}
        } else {
            // 所有依赖已全局引入，直接使用
            {
                alerty.alert({ message: (ret && ret.msg) || '修改失败', title: '错误' });
            }
            try {
                if (typeof window.CsgContestEditTimeTzInit === 'function') {
                    window.CsgContestEditTimeTzInit();
                }
            } catch (eTz3) { /* ignore */ }
            button_delay($btn, 3, bt.chinese, null, bt.english);
        }
    };
    $(form).ajaxSubmit({
        dataType: 'json',
        success: onSuccess,
        error: function(xhr, status, err) {
            try {
                const msg = (xhr && xhr.responseText) ? String(xhr.responseText).slice(0, 800) : '';
                alerty.alert({
                    title: '请求失败',
                    message: `网络/服务端错误（${status || 'error'}）。` + (msg ? `<br/><pre style="white-space:pre-wrap">${msg}</pre>` : ''),
                    message_en: `Request failed (${status || 'error'}).`
                });
            } catch (e) {
                alerty.alert({ title: '请求失败', message: '网络/服务端错误，请打开浏览器控制台查看 Network/Response。' });
            }
            try {
                if (typeof window.CsgContestEditTimeTzInit === 'function') {
                    window.CsgContestEditTimeTzInit();
                }
            } catch (eTz2) { /* ignore */ }
            button_delay($btn, 3, bt.chinese, null, bt.english);
        }
    });
    return false;
}

function InitContestFormValidation(formSelector, extendRules) {
    let rules = buildDynamicRules();
    if (typeof extendRules === 'function') {
        rules = extendRules(rules) || rules;
    }
    window.FormValidationTip.initCommonFormValidation(formSelector, rules, function(form) {
        // 添加比赛且未添加题目时，二次确认后再提交
        const cfg = window.CONTEST_EDIT_CONFIG || {};
        if (!cfg.edit_mode) {
            const problems = (typeof window.getContestProblemListFromForm === 'function')
                ? window.getContestProblemListFromForm()
                : [];
            if (problems.length === 0) {
                alerty.confirm({
                    message: '未添加题目，是否仍要添加比赛？',
                    message_en: 'No problems added. Still add this contest?',
                    callback: function() {
                        defaultSubmit(form);
                    }
                });
                return false;
            }
        }
        return defaultSubmit(form);
    }, { scrollToFirstError: true });
};


$(document).ready(function() {
    if (typeof window.CsgContestEditTimeTzInit === 'function') {
        window.CsgContestEditTimeTzInit();
    }
    // ========================================
    // 页面元素引用
    // ========================================
    const page_info = window.CONTEST_EDIT_CONFIG;
    const edit_mode = page_info.edit_mode;
    const submit_button = $('#submit_button');
    const submit_button_texts = window.Bilingual.getBilingualText(submit_button);
    const submit_button_text = submit_button_texts.chinese;
    const submit_button_en_text = submit_button_texts.english;
    const problems_input = $('input[name="problems_csv"]'); // 题号组件隐藏输入（CSV，仅调试/兼容）

    // 只读模式：禁用提交按钮（仍允许查看/复制）
    try {
        const cfg = window.CONTEST_EDIT_CONFIG || {};
        if (cfg.view_only) {
            submit_button.prop('disabled', true);
            submit_button.removeClass('btn-primary').addClass('btn-outline-secondary');
            submit_button.html('<span><i class="bi bi-eye"></i> 只读</span><span class="en-text">Read-only</span>');
        }
    } catch (e) {}
    // ========================================
    // 表单验证配置（复用通用校验）
    // ========================================
    /**
     * 与 buildDynamicRules() 互补：此处仅放「历史上在 $(ready) 里写死」且仍被部分变体依赖的规则。
     * 注意：ratio_* 不得在此强制合并——全站模板已改为 hidden 同步，与 admin 赛事归属表同源，由 buildDynamicRules + shouldValidateAwardRatioField 决定是否校验。
     */
    const staticFieldRulePatches = {
        title: { rules: { required: true, maxlength: 200 } },
        description: { rules: { maxlength: LENGTH_LIMITS.DESCRIPTION_MAX } },
        password: { rules: { minlength: 6, maxlength: 15 } },
        frozen_minute: { rules: { number: true, range: [LENGTH_LIMITS.FROZEN_MIN, LENGTH_LIMITS.FROZEN_MAX] } },
        frozen_after: { rules: { number: true, range: [LENGTH_LIMITS.FROZEN_MIN, LENGTH_LIMITS.FROZEN_MAX] } },
        'language[]': { rules: { required: true } },
    };
    InitContestFormValidation('#contest_edit_form', function(rules) {
        return Object.assign({}, rules, staticFieldRulePatches);
    });
    // ========================================
    // 键盘快捷键
    // ========================================
    // 键盘快捷键：Ctrl+S 保存表单
    $(window).keydown(function(e) {
        if (e.keyCode == 83 && e.ctrlKey) {
            e.preventDefault();
            const clickEvent = new MouseEvent('click', { bubbles: true, cancelable: true });
            $('#submit_button')[0].dispatchEvent(clickEvent);
        }
    });
});
