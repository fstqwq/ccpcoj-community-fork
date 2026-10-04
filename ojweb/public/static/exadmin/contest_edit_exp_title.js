/**
 * exp 练习编辑页：自动组合总标题预览（学期、班级、实验序号、短标题均由前端拼接；落库 title 以表单为准）
 */
(function () {
    'use strict';

    /** 学期简称：YYYY-YYYY-1 → 起始年秋，-2 → 结束年春；不与入学年级直接拼接 */
    function formatClssTermForExpTitle(clss) {
        if (!clss) {
            return '';
        }
        const sem = (clss.clss_semester != null ? String(clss.clss_semester) : '').trim();
        const m = /^(\d{4})-(\d{4})-(\d)$/.exec(sem);
        if (m) {
            const yStart = m[1];
            const yEnd = m[2];
            const n = parseInt(m[3], 10);
            if (n === 1) {
                return yStart + '秋';
            }
            if (n === 2) {
                return yEnd + '春';
            }
            return sem;
        }
        const y = clss.clss_year != null && clss.clss_year !== '' ? String(clss.clss_year) : '';
        if (sem !== '') {
            return y !== '' ? y + '-' + sem : sem;
        }
        return y;
    }

    function cfg() {
        return window.expTitlePageConfig || {};
    }

    /** 实验序号展示：0～99 两位，100～999 三位 */
    function formatExpNoForTitle(n) {
        let v = parseInt(String(n), 10);
        if (isNaN(v) || v < 0) {
            v = 0;
        }
        if (v > 999) {
            v = 999;
        }
        if (v < 100) {
            return String(v).padStart(2, '0');
        }
        return String(v);
    }

    function readExpNoInt() {
        const raw = ($('#exp_no').val() || '').toString().replace(/\D/g, '');
        if (raw === '') {
            return null;
        }
        let v = parseInt(raw, 10);
        if (isNaN(v)) {
            return null;
        }
        if (v > 999) {
            v = 999;
        }
        if (v < 0) {
            v = 0;
        }
        return v;
    }

    function writeExpNoInt(v) {
        const el = document.getElementById('exp_no');
        if (!el) {
            return;
        }
        if (v === null || typeof v === 'undefined' || isNaN(v)) {
            el.value = '';
            return;
        }
        let n = parseInt(String(v), 10);
        if (isNaN(n)) {
            n = 0;
        }
        if (n < 0) {
            n = 0;
        }
        if (n > 999) {
            n = 999;
        }
        el.value = String(n);
    }

    function buildFullTitleFromClss(clss, expNoInput, titleSuffix) {
        const suf = (titleSuffix || '').trim();
        const n = expNoInput === null || typeof expNoInput === 'undefined' || isNaN(expNoInput)
            ? 1
            : Math.max(0, Math.min(999, parseInt(String(expNoInput), 10) || 0));
        const expDisp = formatExpNoForTitle(n);
        if (!clss) {
            return suf.slice(0, 255);
        }
        const term = formatClssTermForExpTitle(clss);
        const parts = [];
        if (term) {
            parts.push(term);
        }
        const ct = (clss.clss_title != null ? String(clss.clss_title) : '').trim();
        if (ct) {
            parts.push(ct);
        }
        parts.push('实验' + expDisp);
        if (suf) {
            parts.push(suf);
        }
        let s = parts.join('-');
        if (s.length > 255) {
            s = s.slice(0, 255);
        }
        return s;
    }

    function isAutoOn() {
        const sw = document.getElementById('exp_auto_title_switch');
        return sw && sw.checked;
    }

    function syncHiddenAuto() {
        const h = document.getElementById('exp_auto_title_hidden');
        if (h) {
            h.value = isAutoOn() ? '1' : '0';
        }
    }

    function getSelectorMap() {
        if (!window.clssSelector || typeof window.clssSelector.getSelectedClssIds !== 'function') {
            return { ids: [], map: null };
        }
        const ids = window.clssSelector.getSelectedClssIds();
        const map = window.clssSelector.selectedClssMap || null;
        return { ids: ids || [], map: map };
    }

    function syncTitleTooltip(titleEl, fullText, autoOn) {
        if (!titleEl) {
            return;
        }
        const tip = fullText != null ? String(fullText) : '';
        if (typeof CsgSetTitleAndTooltip === 'function') {
            if (autoOn && tip) {
                CsgSetTitleAndTooltip(titleEl, tip);
            } else {
                CsgSetTitleAndTooltip(titleEl, '');
            }
        } else if (autoOn && tip) {
            titleEl.setAttribute('title', tip);
        } else {
            titleEl.removeAttribute('title');
        }
    }

    function refreshPreview() {
        const titleEl = document.getElementById('title');
        if (!titleEl) {
            return;
        }
        if (!isAutoOn()) {
            titleEl.removeAttribute('disabled');
            titleEl.classList.remove('text-truncate');
            syncTitleTooltip(titleEl, '', false);
            return;
        }
        titleEl.setAttribute('disabled', 'disabled');
        titleEl.classList.add('text-truncate');
        const suf = ($('#title_suffix').val() || '').trim();
        const expNo = readExpNoInt();
        const expForBuild = expNo === null ? 1 : expNo;
        const { ids, map } = getSelectorMap();
        let built = '';
        if (!map || ids.length === 0) {
            titleEl.value = suf;
            built = suf;
        } else if (ids.length === 1) {
            const c = map.get(ids[0]);
            built = buildFullTitleFromClss(c, expForBuild, suf);
            titleEl.value = built;
        } else {
            built = '（将按所选班级分别生成总标题）';
            titleEl.value = built;
        }
        syncTitleTooltip(titleEl, built, true);
        $(document).trigger('exppractice:batch-refresh');
    }

    function initSwitch() {
        const sw = document.getElementById('exp_auto_title_switch');
        if (!sw || typeof window.CSGSwitch === 'undefined') {
            return;
        }
        if (!sw.dataset.csgInitialized) {
            window.CSGSwitch.initSwitch(sw);
        }
    }

    function bindExpNoStepper() {
        const $in = $('#exp_no');
        if (!$in.length) {
            return;
        }
        function clampInput() {
            const raw = $in.val().toString().replace(/\D/g, '').slice(0, 3);
            if (raw === '') {
                return;
            }
            let n = parseInt(raw, 10);
            if (isNaN(n)) {
                return;
            }
            if (n > 999) {
                n = 999;
            }
            if (n < 0) {
                n = 0;
            }
            $in.val(String(n));
        }
        $('#exp_no_dec').on('click', function () {
            let n = readExpNoInt();
            if (n === null) {
                n = 1;
            }
            writeExpNoInt(Math.max(0, n - 1));
            refreshPreview();
        });
        $('#exp_no_inc').on('click', function () {
            let n = readExpNoInt();
            if (n === null) {
                n = 0;
            }
            writeExpNoInt(Math.min(999, n + 1));
            refreshPreview();
        });
        $in.on('input', function () {
            const digits = $in.val().toString().replace(/\D/g, '').slice(0, 3);
            $in.val(digits);
            refreshPreview();
        });
        $in.on('change', function () {
            clampInput();
            refreshPreview();
        });
    }

    /**
     * 在 AJAX 序列化前必须调用：自动标题开启时 #title 为 disabled，serialize/ajaxSubmit 会丢字段；
     * FormValidationTip 在 capture 阶段 stopPropagation，submit 冒泡监听器可能不执行，故由 defaultSubmit 显式调用本函数。
     */
    function prepareExpContestFormForAjaxSubmit() {
        if (!document.getElementById('exp_title_block')) {
            return;
        }
        const c = window.CONTEST_EDIT_CONFIG || {};
        if (c.exadmin_add_batch && typeof window.ExpPracticeBatchUi !== 'undefined') {
            window.ExpPracticeBatchUi.finalizeForSubmit();
            syncHiddenAuto();
            return;
        }
        if (!isAutoOn()) {
            syncHiddenAuto();
            return;
        }
        const suf = ($('#title_suffix').val() || '').trim();
        let expNo = readExpNoInt();
        if (expNo === null) {
            expNo = 1;
        }
        const { ids, map } = getSelectorMap();
        const titleEl = document.getElementById('title');
        if (!titleEl) {
            syncHiddenAuto();
            return;
        }
        titleEl.removeAttribute('disabled');
        titleEl.classList.remove('text-truncate');
        syncTitleTooltip(titleEl, '', false);
        if (ids.length === 1 && map && map.get(ids[0])) {
            titleEl.value = buildFullTitleFromClss(map.get(ids[0]), expNo, suf);
        } else if (ids.length > 1) {
            titleEl.value = suf || ' ';
        } else {
            titleEl.value = suf || ' ';
        }
        syncHiddenAuto();
    }

    window.prepareExpContestFormForAjaxSubmit = prepareExpContestFormForAjaxSubmit;

    window.expTitleBuildUtils = {
        buildFullTitleFromClss: buildFullTitleFromClss,
        formatClssTermForExpTitle: formatClssTermForExpTitle,
        readExpNoInt: readExpNoInt,
        isAutoOn: isAutoOn,
    };

    function bindFormSubmit() {
        const form = document.getElementById('contest_edit_form');
        if (!form) {
            return;
        }
        form.addEventListener('submit', function () {
            prepareExpContestFormForAjaxSubmit();
        });
    }

    document.addEventListener('DOMContentLoaded', function () {
        if (!document.getElementById('exp_title_block')) {
            return;
        }
        const c = cfg();
        if (c.editMode && !c.copyMode && !c.defaultAuto) {
            const sw = document.getElementById('exp_auto_title_switch');
            if (sw) {
                sw.checked = false;
            }
            const h = document.getElementById('exp_auto_title_hidden');
            if (h) {
                h.value = '0';
            }
        }
        setTimeout(function () {
            initSwitch();
            syncHiddenAuto();
            bindExpNoStepper();
            refreshPreview();
        }, 200);
        $(document).on('change', '#exp_auto_title_switch', function () {
            syncHiddenAuto();
            refreshPreview();
        });
        $(document).on('input change', '#title_suffix,#exp_no', refreshPreview);
        $(document).on('change', '#clss_ids_input', refreshPreview);
        bindFormSubmit();
    });
})();
