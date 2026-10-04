(function () {
    'use strict';

    /** 全量模板行，供纯前端模糊筛选 */
    let expFromTplAllRows = [];
    let expFromTplSearchTimer = null;

    function modulePrefix() {
        const parts = window.location.pathname.split('/').filter(Boolean);
        return parts[0] || 'exadmin';
    }

    function expFromTplRowMatches(row, q) {
        const s = (q || '').trim().toLowerCase();
        if (!s) {
            return true;
        }
        const idStr = String(row.contest_id != null ? row.contest_id : '');
        const tt = String(row.template_title != null ? row.template_title : '').toLowerCase();
        return idStr.indexOf(s) !== -1 || tt.indexOf(s) !== -1;
    }

    function applyExpFromTplTableFilter() {
        const $t = $('#exp_from_tpl_table');
        if (!$t.length || !$t.data('bootstrap.table')) {
            return;
        }
        const q = ($('#exp_from_tpl_search').val() || '').trim();
        const filtered = (expFromTplAllRows || []).filter(function (r) {
            return expFromTplRowMatches(r, q);
        });
        $t.bootstrapTable('load', filtered);
        try {
            $t.bootstrapTable('selectPage', 1);
        } catch (e) {
            // ignore
        }
    }

    function scheduleExpFromTplSearch() {
        if (expFromTplSearchTimer) {
            clearTimeout(expFromTplSearchTimer);
        }
        expFromTplSearchTimer = setTimeout(function () {
            expFromTplSearchTimer = null;
            applyExpFromTplTableFilter();
        }, 200);
    }

    function openModal() {
        const el = document.getElementById('expFromTplModal');
        if (!el || !window.bootstrap || !bootstrap.Modal) {
            return;
        }
        const url = '/' + modulePrefix() + '/contest/template_options_ajax';
        $.get(url, function (rows) {
            const data = Array.isArray(rows) ? rows : [];
            expFromTplAllRows = data;
            const $search = $('#exp_from_tpl_search');
            if ($search.length) {
                $search.val('');
            }
            const $t = $('#exp_from_tpl_table');
            if ($t.data('bootstrap.table')) {
                $t.bootstrapTable('load', data);
            } else {
                $t.bootstrapTable({ data: data });
            }
        }).fail(function () {
            expFromTplAllRows = [];
            if (typeof alerty !== 'undefined') {
                alerty.error('加载模板列表失败', 'Error');
            }
        });
        bootstrap.Modal.getOrCreateInstance(el).show();
    }

    document.addEventListener('DOMContentLoaded', function () {
        $(document).on('click', '#exp_menu_from_tpl', function (e) {
            e.preventDefault();
            openModal();
        });
        $(document).on('input', '#exp_from_tpl_search', scheduleExpFromTplSearch);
        $('#exp_from_tpl_go').on('click', function () {
            const rows = $('#exp_from_tpl_table').bootstrapTable('getSelections') || [];
            if (!rows.length) {
                if (typeof alerty !== 'undefined') {
                    alerty.warn('请选择一个模板', 'Please select');
                }
                return;
            }
            const id = rows[0].contest_id;
            window.location.href = '/' + modulePrefix() + '/contest/contest_add?from_tpl_id=' + encodeURIComponent(String(id));
        });
    });
})();
