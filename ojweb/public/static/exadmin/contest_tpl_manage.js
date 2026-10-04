/**
 * exadmin 练习模板管理
 * 模板选择 Modal：multiple-select-row=false 累加勾选；Shift 区间与勾选顺序见 csg_bstable_pickorder.js
 */
(function () {
    'use strict';

    const listUrl = '/' + (window.tplManageModule || 'exadmin') + '/contesttpl/template_list_ajax';
    const demoteUrl = '/' + (window.tplManageModule || 'exadmin') + '/contesttpl/template_demote_ajax';
    const sortDeltaUrl = '/' + (window.tplManageModule || 'exadmin') + '/contesttpl/template_sort_delta_ajax';
    const reindexUrl = '/' + (window.tplManageModule || 'exadmin') + '/contesttpl/template_reindex_ajax';
    const bulkReplaceUrl = '/' + (window.tplManageModule || 'exadmin') + '/contesttpl/template_bulk_title_replace_ajax';

    let tplFilterSidebarVisible = false;
    let tplFilterSidebarCollapsed = false;
    let tplFilterResizeTimer = null;

    /** Modal 内练习勾选顺序（contest_id），与 bootstrap-table 勾选状态独立维护 */
    if (typeof window.tplPickerCheckOrder === 'undefined') {
        window.tplPickerCheckOrder = [];
    }
    /** Shift 区间起点：上一次在前三列点击时的 data 行索引（-1 表示未设） */
    if (typeof window.tplPickerShiftAnchorIndex === 'undefined') {
        window.tplPickerShiftAnchorIndex = -1;
    }
    let tplPickerMouse = { shift: false, ctrl: false, index: -1 };
    let tplPickerApplyingRange = false;

    function getTplMainFilterTimestamp() {
        const pi = window.tplPickerContestPageInfo;
        if (pi && pi.timeStamp != null) {
            return parseFloat(pi.timeStamp);
        }
        return Date.now() / 1000;
    }

    /**
     * 模板主表客户端筛选：与 expsys contest_filter 练习列表一致（班级/年级/学期/教师/附加/状态/公开），
     * 并增加模板标题、标签、编号及关键词（源标题/模板标题/标签/ID/教师展示串）。
     */
    function customTplMainFilterAlgorithm(row, filters) {
        if (!filters) {
            return true;
        }
        if (filters.q && String(filters.q).trim() !== '') {
            const q = String(filters.q).trim().toLowerCase();
            const parts = [
                row.title,
                row.template_title,
                row.template_label,
                String(row.contest_id),
                row.teachers_text != null ? String(row.teachers_text) : ''
            ];
            let ok = parts.some(function (p) {
                return p != null && String(p).toLowerCase().indexOf(q) !== -1;
            });
            if (!ok && row.teachers && Array.isArray(row.teachers)) {
                ok = row.teachers.some(function (t) {
                    return (
                        (t.nick && String(t.nick).toLowerCase().indexOf(q) !== -1) ||
                        (t.user_id && String(t.user_id).toLowerCase().indexOf(q) !== -1)
                    );
                });
            }
            if (!ok) {
                return false;
            }
        }
        const keys = [
            'title',
            'clss',
            'year',
            'semester',
            'teachers',
            'attach',
            'defunct',
            'status',
            'template_title',
            'template_label',
            'template_sort'
        ];
        for (let i = 0; i < keys.length; i++) {
            const key = keys[i];
            const value = filters[key];
            if (!value || value === '' || value === '-1') {
                continue;
            }
            let flag;
            let field_content;
            switch (key) {
                case 'title':
                    if (!row.title || row.title.indexOf(value) === -1) {
                        return false;
                    }
                    break;
                case 'template_title':
                    if (!row.template_title || row.template_title.indexOf(value) === -1) {
                        return false;
                    }
                    break;
                case 'template_label':
                    if (!row.template_label || row.template_label.indexOf(value) === -1) {
                        return false;
                    }
                    break;
                case 'template_sort': {
                    const needle = String(value).trim();
                    const sortStr = row.template_sort != null ? String(row.template_sort) : '';
                    if (sortStr.indexOf(needle) === -1) {
                        return false;
                    }
                    break;
                }
                case 'year': {
                    const year_list = value
                        .split(/[,，]+/)
                        .map(function (y) {
                            return y.trim();
                        })
                        .filter(function (y) {
                            return y;
                        });
                    if (year_list.length === 0) {
                        break;
                    }
                    field_content = row.clss_year;
                    if (field_content == null || field_content === undefined || year_list.indexOf(field_content.toString()) === -1) {
                        return false;
                    }
                    break;
                }
                case 'semester':
                    flag = false;
                    field_content = row.clss_semester;
                    if (field_content == null || field_content === undefined) {
                        return false;
                    }
                    value.split(/[,，]+/).forEach(function (sm) {
                        if (field_content.indexOf(sm.trim()) !== -1) {
                            flag = true;
                        }
                    });
                    if (!flag) {
                        return false;
                    }
                    break;
                case 'teachers':
                    flag = false;
                    field_content = row.teachers;
                    if (!field_content || !Array.isArray(field_content)) {
                        return false;
                    }
                    {
                        const teacherIds = value
                            .split(/[,，]+/)
                            .map(function (t) {
                                return t.trim();
                            })
                            .filter(function (t) {
                                return t;
                            });
                        teacherIds.forEach(function (tc) {
                            if (
                                field_content.some(function (teacher) {
                                    return (
                                        teacher.user_id === tc ||
                                        teacher.nick === tc ||
                                        (teacher.user_id && teacher.user_id.indexOf(tc) !== -1) ||
                                        (teacher.nick && teacher.nick.indexOf(tc) !== -1)
                                    );
                                })
                            ) {
                                flag = true;
                            }
                        });
                    }
                    if (!flag) {
                        return false;
                    }
                    break;
                case 'clss':
                    if (!row.clss_title || row.clss_title.indexOf(value) === -1) {
                        return false;
                    }
                    break;
                case 'attach': {
                    const attachVal = parseInt(value, 10);
                    if (attachVal === 3) {
                        break;
                    }
                    const ckind = Math.floor(row.private / 10 + 1e-8);
                    if (!!attachVal !== !!ckind) {
                        return false;
                    }
                    break;
                }
                case 'defunct':
                    if (String(row.defunct || '') !== String(value || '')) {
                        return false;
                    }
                    break;
                case 'status': {
                    let now_time = getTplMainFilterTimestamp() * 1000;
                    if (typeof Timestamp2Time === 'function') {
                        now_time = Timestamp2Time(now_time);
                    }
                    let status = -1;
                    if (now_time < row.start_time) {
                        status = 0;
                    } else if (now_time <= row.end_time) {
                        status = 1;
                    } else {
                        status = 2;
                    }
                    if (status !== parseInt(value, 10)) {
                        return false;
                    }
                    break;
                }
                default:
                    break;
            }
        }
        return true;
    }

    function collectTplMainFilters() {
        const filters = {};
        $('.tpl_main_filter').each(function () {
            const name = this.getAttribute('name');
            if (!name) {
                return;
            }
            if (this.tagName === 'SELECT') {
                filters[name] = this.value;
            } else {
                filters[name] = (this.value || '').trim();
            }
        });
        const q = ($('#tpl_main_search').val() || '').trim();
        if (q) {
            filters.q = q;
        }
        return filters;
    }

    function applyTplMainFilter() {
        const $tbl = $('#tpl_manage_table');
        if (!$tbl.length || !$tbl.data('bootstrap.table')) {
            return;
        }
        const filters = collectTplMainFilters();
        $tbl.bootstrapTable('filterBy', filters, {
            filterAlgorithm: customTplMainFilterAlgorithm
        });
    }

    function clearTplMainFiltersUi() {
        $('.tpl_main_filter').each(function () {
            if (this.tagName === 'SELECT') {
                if (this.getAttribute('name') === 'attach') {
                    this.value = '3';
                } else {
                    this.value = '-1';
                }
            } else {
                this.value = '';
            }
        });
        $('#tpl_main_search').val('');
    }

    let tplMainFilterTimer = null;
    function scheduleApplyTplMainFilter() {
        if (tplMainFilterTimer) {
            clearTimeout(tplMainFilterTimer);
        }
        tplMainFilterTimer = setTimeout(function () {
            tplMainFilterTimer = null;
            applyTplMainFilter();
        }, 380);
    }

    /**
     * 与练习主表 FormatterContestDelete 一致：仅图标 + title（global.js 转 Tooltip）
     */
    function FormatterTplDemote(value, row) {
        const id = row.contest_id;
        const safeTitle = (row.title || '').replace(/"/g, '&quot;');
        const title = '取消模板标记，练习仍保留 (Remove template flag; practice remains)';
        return '<button type="button" class="btn btn-sm btn-danger tpl-demote-btn" data-contest-id="' + id + '" data-contest-title="' + safeTitle + '" title="' + title + '">' +
            '<i class="bi bi-journal-x" aria-hidden="true"></i>' +
            '<span class="visually-hidden">剔除模板</span></button>';
    }
    window.FormatterTplDemote = FormatterTplDemote;

    /**
     * 与主表编辑列一致：outline-primary + 铅笔图标；此处打开模板元数据 Modal（非 contest_edit 链接）
     */
    function FormatterTplEdit(value, row) {
        const id = row.contest_id;
        const title = '编辑模板标题、标签与编号 (Edit template title, label & order #)';
        return '<button type="button" class="btn btn-sm btn-outline-primary tpl-edit-btn" data-contest-id="' + id + '" title="' + title + '">' +
            '<i class="bi bi-pencil-square" aria-hidden="true"></i>' +
            '<span class="visually-hidden">编辑</span></button>';
    }
    window.FormatterTplEdit = FormatterTplEdit;

    /**
     * 模板列表「编号」列：当前值 + 快捷 ±1
     */
    function FormatterTplSortNo(value, row) {
        const v = row.template_sort != null ? parseInt(row.template_sort, 10) : 0;
        const cid = row.contest_id;
        const tDown = '编号 -1（不小于 0） (Decrease order #)';
        const tUp = '编号 +1 (Increase order #)';
        return (
            '<div class="d-inline-flex align-items-center justify-content-center gap-1 tpl-sort-cell flex-nowrap">' +
            '<button type="button" class="btn btn-sm btn-outline-secondary tpl-sort-delta py-0 px-1" data-contest-id="' +
            cid +
            '" data-delta="-1" title="' +
            tDown +
            '"><i class="bi bi-dash-lg" aria-hidden="true"></i></button>' +
            '<span class="tpl-sort-val mx-1">' +
            v +
            '</span>' +
            '<button type="button" class="btn btn-sm btn-outline-secondary tpl-sort-delta py-0 px-1" data-contest-id="' +
            cid +
            '" data-delta="1" title="' +
            tUp +
            '"><i class="bi bi-plus-lg" aria-hidden="true"></i></button>' +
            '</div>'
        );
    }
    window.FormatterTplSortNo = FormatterTplSortNo;

    /**
     * 添加模板 Modal：按勾选先后显示序号
     */
    function FormatterTplPickerSeq(value, row) {
        const arr = window.tplPickerCheckOrder || [];
        const i = arr.indexOf(row.contest_id);
        if (i === -1) {
            return '<span class="text-muted">—</span>';
        }
        return '<span class="badge bg-secondary">' + (i + 1) + '</span>';
    }
    window.FormatterTplPickerSeq = FormatterTplPickerSeq;

    function demoteRequest(contest_id) {
        return $.post(demoteUrl, { contest_id: contest_id });
    }

    function loadMainTable() {
        $.get(listUrl, function (ret) {
            const rows = Array.isArray(ret) ? ret : (ret && ret.data ? ret.data : []);
            const $tbl = $('#tpl_manage_table');
            $tbl.bootstrapTable('load', rows);
            applyTplMainFilter();
        }).fail(function () {
            if (typeof alerty !== 'undefined') {
                alerty.error('加载失败', 'Error');
            }
        });
    }

    function syncTplBatchActionButtons() {
        const $tbl = $('#tpl_manage_table');
        if (!$tbl.length) {
            return;
        }
        let n = 0;
        try {
            n = ($tbl.bootstrapTable('getSelections') || []).length;
        } catch (e) {
            n = 0;
        }
        $('#tpl_batch_demote').prop('disabled', n < 1);
        $('#btn_tpl_reindex_selected').prop('disabled', n < 1);
        $('#btn_tpl_bulk_replace').prop('disabled', n < 1);
    }

    function updateTplFilterSidebarToggleIcon() {
        const icon = $('#tpl_filter_sidebar_toggle').find('i');
        if (tplFilterSidebarCollapsed) {
            icon.removeClass('bi-chevron-right').addClass('bi-chevron-left');
        } else {
            icon.removeClass('bi-chevron-left').addClass('bi-chevron-right');
        }
    }

    function updateTplFilterSidebarPosition() {
        const sidebar = document.getElementById('tpl_filter_sidebar');
        const main = document.querySelector('main');
        if (!sidebar || !main) {
            return;
        }
        const mainRect = main.getBoundingClientRect();
        const sidebarWidth = sidebar.classList.contains('collapsed') ? 50 : sidebar.offsetWidth || 300;
        const gap = 20;
        const minRightMargin = 20;
        const mainRight = mainRect.right;
        const availableRight = window.innerWidth - mainRight;
        if (availableRight >= sidebarWidth + gap) {
            sidebar.style.left = `${mainRight + gap}px`;
            sidebar.style.right = 'auto';
        } else {
            sidebar.style.left = 'auto';
            sidebar.style.right = `${minRightMargin}px`;
        }
    }

    function toggleTplFilterSidebarCollapse() {
        if (!tplFilterSidebarVisible) {
            return;
        }
        const sidebar = document.getElementById('tpl_filter_sidebar');
        if (!sidebar) {
            return;
        }
        tplFilterSidebarCollapsed = !tplFilterSidebarCollapsed;
        if (tplFilterSidebarCollapsed) {
            sidebar.classList.add('collapsed');
        } else {
            sidebar.classList.remove('collapsed');
        }
        updateTplFilterSidebarToggleIcon();
        setTimeout(function () {
            updateTplFilterSidebarPosition();
        }, 300);
    }

    function toggleTplFilterSidebar() {
        const sidebar = document.getElementById('tpl_filter_sidebar');
        if (!sidebar) {
            return;
        }
        tplFilterSidebarVisible = !tplFilterSidebarVisible;
        if (tplFilterSidebarVisible) {
            sidebar.classList.add('show');
            if (!tplFilterSidebarCollapsed) {
                sidebar.classList.remove('collapsed');
            }
            updateTplFilterSidebarPosition();
        } else {
            sidebar.classList.remove('show');
        }
    }

    function countTplSidebarExtraFilters() {
        let n = 0;
        $('#tpl_filter_sidebar .tpl_main_filter').each(function () {
            if (this.tagName === 'SELECT') {
                const name = this.getAttribute('name');
                if (name === 'attach' && this.value !== '3') {
                    n += 1;
                } else if (name === 'defunct' && this.value !== '-1') {
                    n += 1;
                }
            } else if (String(this.value || '').trim() !== '') {
                n += 1;
            }
        });
        return n;
    }

    function updateTplMoreBadge() {
        const c = countTplSidebarExtraFilters();
        const $b = $('#tpl_filter_badge');
        const $btn = $('#tpl_toggle_filter_sidebar');
        if (!$b.length || !$btn.length) {
            return;
        }
        if (c > 0) {
            $b.text(String(c)).show();
            $btn.addClass('has-extra-filters');
        } else {
            $b.hide().text('0');
            $btn.removeClass('has-extra-filters');
        }
    }

    function clearTplFilterSidebarOnly() {
        $('#tpl_filter_sidebar .tpl_main_filter').each(function () {
            if (this.tagName === 'SELECT') {
                if (this.getAttribute('name') === 'attach') {
                    this.value = '3';
                } else {
                    this.value = '-1';
                }
            } else {
                this.value = '';
            }
        });
        applyTplMainFilter();
        updateTplMoreBadge();
    }

    function escapeHtml(str) {
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function initTplFilterSidebar() {
        const $side = $('#tpl_filter_sidebar');
        if (!$side.length) {
            return;
        }
        $('#tpl_toggle_filter_sidebar').on('click', function () {
            toggleTplFilterSidebar();
        });
        $('#tpl_filter_sidebar_toggle').on('click', function (e) {
            e.stopPropagation();
            toggleTplFilterSidebarCollapse();
        });
        $side.find('.filter-sidebar-header').on('click', function (e) {
            if ($(e.target).closest('button, .filter-tag-remove').length) {
                return;
            }
            toggleTplFilterSidebarCollapse();
        });
        $('#tpl_filter_sidebar_clear').on('click', function () {
            clearTplFilterSidebarOnly();
        });
        $('#tpl_filter_sidebar .tpl_main_filter').on('change input', function () {
            updateTplMoreBadge();
        });
        $(window).on('resize.tplFilterSb', function () {
            if (tplFilterResizeTimer) {
                clearTimeout(tplFilterResizeTimer);
            }
            tplFilterResizeTimer = setTimeout(function () {
                tplFilterResizeTimer = null;
                if (tplFilterSidebarVisible) {
                    updateTplFilterSidebarPosition();
                }
            }, 200);
        });
        updateTplFilterSidebarToggleIcon();
        updateTplFilterSidebarPosition();
        updateTplMoreBadge();
    }

    function initBulkReplaceModal() {
        const $modal = $('#tplBulkReplaceModal');
        if (!$modal.length) {
            return;
        }
        let lastPreviewHadChange = false;

        function resetBulkReplaceState() {
            lastPreviewHadChange = false;
            $('#tpl_bulk_submit').prop('disabled', true);
            $('#tpl_bulk_preview_body').empty();
        }

        $('#btn_tpl_bulk_replace').on('click', function () {
            const $tbl = $('#tpl_manage_table');
            let sel = [];
            try {
                sel = $tbl.bootstrapTable('getSelections') || [];
            } catch (e) {
                sel = [];
            }
            if (!sel.length) {
                return;
            }
            const el = document.getElementById('tplBulkReplaceModal');
            if (!el || !window.bootstrap || !bootstrap.Modal) {
                return;
            }
            resetBulkReplaceState();
            bootstrap.Modal.getOrCreateInstance(el).show();
        });

        $modal.on('hidden.bs.modal', function () {
            resetBulkReplaceState();
            $('#tpl_bulk_preset_wrap').removeClass('tpl-bulk-preset-wrap--focus');
        });

        $('#tpl_bulk_pattern, #tpl_bulk_replacement').on('input', function () {
            $('#tpl_bulk_submit').prop('disabled', true);
            lastPreviewHadChange = false;
        });

        /* 常用预设：须用 .attr('data-replacement')，避免 jQuery .data() 破坏 $1 等 */
        $modal.on('click', '.tpl-bulk-preset', function (e) {
            e.preventDefault();
            const $b = $(this);
            const p = $b.attr('data-pattern') || '';
            const rAttr = $b.attr('data-replacement');
            const r = rAttr === undefined || rAttr === null ? '' : String(rAttr);
            $('#tpl_bulk_pattern').val(p);
            $('#tpl_bulk_replacement').val(r);
            $('#tpl_bulk_pattern').trigger('input');
            $('#tpl_bulk_replacement').trigger('input');
        });

        $('#tpl_bulk_pattern').on('focus.tplBulkPreset', function () {
            $('#tpl_bulk_preset_wrap').addClass('tpl-bulk-preset-wrap--focus');
        });
        $('#tpl_bulk_pattern').on('blur.tplBulkPreset', function () {
            window.setTimeout(function () {
                $('#tpl_bulk_preset_wrap').removeClass('tpl-bulk-preset-wrap--focus');
            }, 180);
        });

        $('#tpl_bulk_test').on('click', function () {
            const pattern = ($('#tpl_bulk_pattern').val() || '').trim();
            const replacement =
                $('#tpl_bulk_replacement').val() != null ? String($('#tpl_bulk_replacement').val()) : '';
            const $tbl = $('#tpl_manage_table');
            let sel = [];
            try {
                sel = $tbl.bootstrapTable('getSelections') || [];
            } catch (e1) {
                sel = [];
            }
            const $body = $('#tpl_bulk_preview_body');
            $body.empty();
            lastPreviewHadChange = false;
            $('#tpl_bulk_submit').prop('disabled', true);

            if (!pattern) {
                if (typeof alerty !== 'undefined') {
                    alerty.warn('请输入正则表达式', 'Pattern required');
                }
                return;
            }
            let re;
            try {
                re = new RegExp(pattern, 'gu');
            } catch (e2) {
                if (typeof alerty !== 'undefined') {
                    alerty.error('正则无效：' + (e2 && e2.message ? e2.message : String(e2)), 'Invalid regex');
                }
                return;
            }
            sel.forEach(function (row) {
                const id = row.contest_id;
                const before = row.template_title != null ? String(row.template_title) : '';
                let after;
                try {
                    after = before.replace(re, replacement);
                } catch (e3) {
                    after = before;
                }
                $body.append(
                    '<tr><td>' +
                        id +
                        '</td><td class="small">' +
                        escapeHtml(before) +
                        '</td><td class="small">' +
                        escapeHtml(after) +
                        '</td></tr>'
                );
                if (after !== before) {
                    lastPreviewHadChange = true;
                }
            });
            if (!lastPreviewHadChange) {
                if (typeof alerty !== 'undefined') {
                    alerty.warn('预览：所选行均无变化（不匹配或与替换结果相同）', 'No changes');
                }
            } else {
                $('#tpl_bulk_submit').prop('disabled', false);
            }
        });

        $('#tpl_bulk_submit').on('click', function () {
            if ($('#tpl_bulk_submit').prop('disabled')) {
                return;
            }
            const pattern = ($('#tpl_bulk_pattern').val() || '').trim();
            const replacement =
                $('#tpl_bulk_replacement').val() != null ? String($('#tpl_bulk_replacement').val()) : '';
            const $tbl = $('#tpl_manage_table');
            let sel = [];
            try {
                sel = $tbl.bootstrapTable('getSelections') || [];
            } catch (e4) {
                sel = [];
            }
            const ids = sel.map(function (r) {
                return r.contest_id;
            });
            $.post(
                bulkReplaceUrl,
                {
                    pattern: pattern,
                    replacement: replacement,
                    contest_ids: JSON.stringify(ids)
                },
                function (res) {
                    if (res && res.code === 1) {
                        if (typeof alerty !== 'undefined') {
                            alerty.success(res.msg || '完成', 'OK');
                        }
                        const modalEl = document.getElementById('tplBulkReplaceModal');
                        if (modalEl && window.bootstrap) {
                            const inst = bootstrap.Modal.getInstance(modalEl);
                            if (inst) {
                                inst.hide();
                            }
                        }
                        loadMainTable();
                    } else if (typeof alerty !== 'undefined') {
                        alerty.error((res && res.msg) || '失败', 'Error');
                    }
                },
                'json'
            ).fail(function () {
                if (typeof alerty !== 'undefined') {
                    alerty.error('请求失败', 'Error');
                }
            });
        });
    }

    function initMainTable() {
        $('#tpl_manage_table').bootstrapTable({});
        loadMainTable();
        $('#tpl_refresh').on('click', function () {
            loadMainTable();
        });
        $('#tpl_main_clear').on('click', function () {
            clearTplMainFiltersUi();
            $('#tpl_manage_table').bootstrapTable('filterBy', {});
            updateTplMoreBadge();
        });
        $(document).on('change.tplMainFilter', '.tpl_main_filter', function () {
            applyTplMainFilter();
        });
        $(document).on('input.tplMainFilter', '.tpl_main_filter, #tpl_main_search', function () {
            scheduleApplyTplMainFilter();
        });
        const $tbl = $('#tpl_manage_table');
        $tbl.on(
            'check.bs.table uncheck.bs.table check-all.bs.table uncheck-all.bs.table load-success.bs.table',
            syncTplBatchActionButtons
        );
        syncTplBatchActionButtons();

        $('#tpl_batch_demote').on('click', function () {
            const sel = $tbl.bootstrapTable('getSelections') || [];
            if (!sel.length) {
                return;
            }
            const ids = sel.map(function (r) {
                return r.contest_id;
            });
            const doBatch = function () {
                let chain = $.Deferred().resolve().promise();
                let ok = 0;
                let lastErr = '';
                ids.forEach(function (cid) {
                    chain = chain.then(function () {
                        return demoteRequest(cid).then(function (res) {
                            if (res && res.code === 1) {
                                ok += 1;
                            } else {
                                lastErr = (res && res.msg) ? String(res.msg) : '失败';
                            }
                        });
                    });
                });
                chain.then(function () {
                    if (typeof alerty !== 'undefined') {
                        if (ok === ids.length) {
                            alerty.success('已剔除 ' + ok + ' 项', 'OK');
                        } else if (ok > 0) {
                            alerty.warn('部分完成：成功 ' + ok + ' / ' + ids.length + (lastErr ? ' ' + lastErr : ''), 'Partial');
                        } else {
                            alerty.error(lastErr || '全部失败', 'Error');
                        }
                    }
                    loadMainTable();
                }).fail(function () {
                    if (typeof alerty !== 'undefined') {
                        alerty.error('请求失败', 'Error');
                    }
                    loadMainTable();
                });
            };
            if (typeof alerty !== 'undefined' && alerty.confirm) {
                // 须用对象形式：若写成 confirm(正文, '确认', cb)，会被 alerty 误判为 (title, message, callback) 导致标题/正文对调
                alerty.confirm({
                    message:
                        '确定取消所选 ' +
                        ids.length +
                        ' 项的模板属性？<span class="en-text d-block mt-1">Remove template flag from ' +
                        ids.length +
                        ' selected practice(s)?</span>',
                    callback: doBatch,
                    callbackCancel: function () {}
                });
            } else if (window.confirm('确定批量剔除模板？')) {
                doBatch();
            }
        });
    }

    /** load + checkBy 会再次触发 check，若此处再调 refresh 会无限递归栈溢出 */
    let tplPickerSeqRefreshing = false;

    function tplPickerBuildPathIndices(anchorIdx, endIdx) {
        const C = typeof window.CsgBsTablePickOrder !== 'undefined' ? window.CsgBsTablePickOrder : null;
        if (C && typeof C.buildPathIndices === 'function') {
            return C.buildPathIndices(anchorIdx, endIdx);
        }
        const path = [];
        if (anchorIdx <= endIdx) {
            for (let i = anchorIdx; i <= endIdx; i++) {
                path.push(i);
            }
        } else {
            for (let j = anchorIdx; j >= endIdx; j--) {
                path.push(j);
            }
        }
        return path;
    }

    function tplPickerMergePathIds(pathIds) {
        const C = typeof window.CsgBsTablePickOrder !== 'undefined' ? window.CsgBsTablePickOrder : null;
        if (C && typeof C.mergePathIntoOrder === 'function') {
            window.tplPickerCheckOrder = C.mergePathIntoOrder(window.tplPickerCheckOrder || [], pathIds);
            return;
        }
        const set = {};
        (pathIds || []).forEach(function (id) {
            set[id] = true;
        });
        const rest = (window.tplPickerCheckOrder || []).filter(function (id) {
            return !set[id];
        });
        window.tplPickerCheckOrder = rest.concat(pathIds || []);
    }

    function updateTplPickerPickFooter() {
        if (!document.getElementById('tplPickerPickCount')) {
            return;
        }
        const order = window.tplPickerCheckOrder || [];
        $('#tplPickerPickCount').text(String(order.length));
        let text = order.length ? order.join(', ') : '—';
        const maxLen = 600;
        if (text.length > maxLen) {
            text = text.slice(0, maxLen) + '…';
        }
        $('#tplPickerPickIds').text(text);
    }
    window.updateTplPickerPickFooter = updateTplPickerPickFooter;

    /** 重绘 picker 勾选顺序列（不改变数据行，仅恢复勾选后刷新 body） */
    function refreshPickerSeqColumn() {
        const $t = $('#tpl_picker_table');
        if (!$t.length || !$t.data('bootstrap.table')) {
            return;
        }
        if (tplPickerSeqRefreshing) {
            return;
        }
        tplPickerSeqRefreshing = true;
        try {
            let selIds = [];
            try {
                selIds = ($t.bootstrapTable('getSelections') || []).map(function (r) {
                    return r.contest_id;
                });
            } catch (e) {
                selIds = [];
            }
            let data;
            try {
                // 必须用未筛选全量：getData() 在 filterBy 激活时返回 this.data（子集），
                // load 子集会覆盖 options.data，导致之后「去掉已应用筛选」也无法恢复被筛掉的行。
                data = $t.bootstrapTable('getData', { unfiltered: true }) || [];
            } catch (e2) {
                return;
            }
            $t.bootstrapTable('load', data.slice());
            if (selIds.length) {
                $t.bootstrapTable('checkBy', { field: 'contest_id', values: selIds });
            }
        } finally {
            tplPickerSeqRefreshing = false;
        }
    }

    /** 按 tplPickerCheckOrder 过滤当前勾选；顺序外多选项按 getData 顺序接在后 */
    function buildPromoteContestIdsInPickOrder(selRows) {
        const selSet = {};
        (selRows || []).forEach(function (r) {
            selSet[r.contest_id] = true;
        });
        const order = window.tplPickerCheckOrder || [];
        const out = [];
        order.forEach(function (cid) {
            if (selSet[cid] && out.indexOf(cid) === -1) {
                out.push(cid);
            }
        });
        (selRows || []).forEach(function (r) {
            const cid = r.contest_id;
            if (out.indexOf(cid) === -1) {
                out.push(cid);
            }
        });
        return out;
    }

    function initPickerModal() {
        $('#tplPickerModal').on('shown.bs.modal', function () {
            const $t = $('#tpl_picker_table');
            if ($t.length && $t.data('bootstrap.table')) {
                $t.bootstrapTable('resetView');
            }
            updateTplPickerPickFooter();
        });
        $('#tplPickerModal').on('hidden.bs.modal', function () {
            window.tplPickerCheckOrder = [];
            window.tplPickerShiftAnchorIndex = -1;
            updateTplPickerPickFooter();
        });
        $('#btn_tpl_add_open').on('click', function () {
            const el = document.getElementById('tplPickerModal');
            if (!el || !window.bootstrap || !bootstrap.Modal) {
                return;
            }
            window.tplPickerCheckOrder = [];
            window.tplPickerShiftAnchorIndex = -1;
            updateTplPickerPickFooter();
            if (typeof LoadContestData === 'function') {
                LoadContestData();
            }
            bootstrap.Modal.getOrCreateInstance(el).show();
        });
        const $picker = $('#tpl_picker_table');
        if ($picker.length) {
            $picker.on('mousedown', 'tbody tr', function (e) {
                const $td = $(e.target).closest('td');
                if (!$td.length) {
                    tplPickerMouse = {
                        shift: !!e.shiftKey,
                        ctrl: !!(e.ctrlKey || e.metaKey),
                        index: -1
                    };
                    return;
                }
                const ci = $td[0].cellIndex;
                if (ci === undefined || ci > 2) {
                    tplPickerMouse = {
                        shift: !!e.shiftKey,
                        ctrl: !!(e.ctrlKey || e.metaKey),
                        index: -1
                    };
                    return;
                }
                const $tr = $(this);
                const idx = $tr.data('index');
                if (idx === undefined || idx === null || idx === '') {
                    return;
                }
                tplPickerMouse = {
                    shift: !!e.shiftKey,
                    ctrl: !!(e.ctrlKey || e.metaKey),
                    index: parseInt(idx, 10)
                };
            });

            $picker.on('check.bs.table', function (e, row) {
                if (tplPickerSeqRefreshing || tplPickerApplyingRange) {
                    return;
                }
                const $t = $picker;
                let data;
                try {
                    data = $t.bootstrapTable('getData') || [];
                } catch (e0) {
                    return;
                }
                const curIdx = data.findIndex(function (r) {
                    return r.contest_id === row.contest_id;
                });
                if (curIdx < 0) {
                    return;
                }
                const anchor =
                    typeof window.tplPickerShiftAnchorIndex === 'number' ? window.tplPickerShiftAnchorIndex : -1;

                if (tplPickerMouse.shift && anchor >= 0) {
                    tplPickerApplyingRange = true;
                    try {
                        const pathIdx = tplPickerBuildPathIndices(anchor, curIdx);
                        const pathIds = pathIdx.map(function (i) {
                            return data[i].contest_id;
                        });
                        pathIdx.forEach(function (i) {
                            if (i !== curIdx) {
                                try {
                                    $t.bootstrapTable('check', i);
                                } catch (e1) {
                                    // ignore
                                }
                            }
                        });
                        tplPickerMergePathIds(pathIds);
                        window.tplPickerShiftAnchorIndex = curIdx;
                    } finally {
                        tplPickerApplyingRange = false;
                    }
                } else {
                    const cid = row.contest_id;
                    const ord = window.tplPickerCheckOrder || [];
                    if (ord.indexOf(cid) === -1) {
                        ord.push(cid);
                    }
                    window.tplPickerCheckOrder = ord;
                    window.tplPickerShiftAnchorIndex = curIdx;
                }
                refreshPickerSeqColumn();
                updateTplPickerPickFooter();
            });

            $picker.on('uncheck.bs.table', function (e, row) {
                if (tplPickerSeqRefreshing || tplPickerApplyingRange) {
                    return;
                }
                const cid = row.contest_id;
                window.tplPickerCheckOrder = (window.tplPickerCheckOrder || []).filter(function (x) {
                    return x !== cid;
                });
                let data;
                try {
                    data = $picker.bootstrapTable('getData') || [];
                } catch (e2) {
                    data = [];
                }
                const curIdx = data.findIndex(function (r) {
                    return r.contest_id === row.contest_id;
                });
                if (curIdx >= 0 && window.tplPickerShiftAnchorIndex === curIdx) {
                    window.tplPickerShiftAnchorIndex = -1;
                }
                refreshPickerSeqColumn();
                updateTplPickerPickFooter();
            });

            $picker.on('check-all.bs.table', function () {
                if (tplPickerSeqRefreshing) {
                    return;
                }
                const $t = $picker;
                let data;
                let sel;
                try {
                    data = $t.bootstrapTable('getData') || [];
                    sel = $t.bootstrapTable('getSelections') || [];
                } catch (e3) {
                    return;
                }
                const set = {};
                sel.forEach(function (r) {
                    set[r.contest_id] = true;
                });
                const ord = [];
                data.forEach(function (r) {
                    if (set[r.contest_id]) {
                        ord.push(r.contest_id);
                    }
                });
                window.tplPickerCheckOrder = ord;
                if (ord.length) {
                    const li = data.findIndex(function (r) {
                        return r.contest_id === ord[ord.length - 1];
                    });
                    window.tplPickerShiftAnchorIndex = li >= 0 ? li : -1;
                } else {
                    window.tplPickerShiftAnchorIndex = -1;
                }
                refreshPickerSeqColumn();
                updateTplPickerPickFooter();
            });

            $picker.on('uncheck-all.bs.table', function () {
                if (tplPickerSeqRefreshing) {
                    return;
                }
                window.tplPickerCheckOrder = [];
                window.tplPickerShiftAnchorIndex = -1;
                refreshPickerSeqColumn();
                updateTplPickerPickFooter();
            });
        }
        $('#tpl_picker_confirm').on('click', function () {
            const sel = $('#tpl_picker_table').bootstrapTable('getSelections') || [];
            if (!sel.length) {
                if (typeof alerty !== 'undefined') {
                    alerty.warn('请至少选择一项', 'Please select');
                }
                return;
            }
            const ids = buildPromoteContestIdsInPickOrder(sel);
            $.post('/' + (window.tplManageModule || 'exadmin') + '/contesttpl/template_promote_ajax', {
                contest_ids: ids
            }, function (res) {
                if (res.code === 1) {
                    if (typeof alerty !== 'undefined') {
                        alerty.success(res.msg || '完成', 'OK');
                    }
                    const modalEl = document.getElementById('tplPickerModal');
                    if (modalEl && window.bootstrap) {
                        const inst = bootstrap.Modal.getInstance(modalEl);
                        if (inst) {
                            inst.hide();
                        }
                    }
                    loadMainTable();
                } else if (typeof alerty !== 'undefined') {
                    alerty.error(res.msg || '失败', 'Error');
                }
            }).fail(function () {
                if (typeof alerty !== 'undefined') {
                    alerty.error('请求失败', 'Error');
                }
            });
        });
    }

    function bindSortDelta() {
        $(document).on('click', '.tpl-sort-delta', function (e) {
            e.preventDefault();
            e.stopPropagation();
            const $btn = $(this);
            const cid = parseInt($btn.data('contest-id'), 10);
            const delta = parseInt($btn.data('delta'), 10);
            if (!cid || (delta !== 1 && delta !== -1)) {
                return;
            }
            $.post(
                sortDeltaUrl,
                { contest_id: cid, delta: delta },
                function (res) {
                    if (res.code === 1 && res.data && res.data.template_sort != null) {
                        try {
                            $('#tpl_manage_table').bootstrapTable('updateByUniqueId', {
                                id: cid,
                                row: { template_sort: res.data.template_sort }
                            });
                        } catch (err) {
                            loadMainTable();
                        }
                    } else if (typeof alerty !== 'undefined') {
                        alerty.error((res && res.msg) || '失败', 'Error');
                    }
                },
                'json'
            ).fail(function () {
                if (typeof alerty !== 'undefined') {
                    alerty.error('请求失败', 'Error');
                }
            });
        });
    }

    function initReindex() {
        $('#btn_tpl_reindex_selected').on('click', function () {
            const $tbl = $('#tpl_manage_table');
            let sel = [];
            try {
                sel = $tbl.bootstrapTable('getSelections') || [];
            } catch (e) {
                sel = [];
            }
            if (!sel.length) {
                return;
            }
            const ids = sel.map(function (r) {
                return r.contest_id;
            });
            const msg =
                '将<strong>仅对当前勾选</strong>的模板：按编号升序，再按模板标题（空则用源标题）、练习 ID 排序，然后把它们的编号重排为连续整数 1…' +
                ids.length +
                '。是否继续？' +
                '<span class="en-text d-block mt-2">Renumber <strong>selected</strong> templates only to 1…N by current order #, then template title, then practice ID. Continue?</span>';
            const doPost = function () {
                $.post(
                    reindexUrl,
                    { contest_ids: JSON.stringify(ids) },
                    function (res) {
                        if (res.code === 1) {
                            if (typeof alerty !== 'undefined') {
                                alerty.success(res.msg || '完成', 'OK');
                            }
                            loadMainTable();
                        } else if (typeof alerty !== 'undefined') {
                            alerty.error((res && res.msg) || '失败', 'Error');
                        }
                    },
                    'json'
                ).fail(function () {
                    if (typeof alerty !== 'undefined') {
                        alerty.error('请求失败', 'Error');
                    }
                });
            };
            if (typeof alerty !== 'undefined' && alerty.confirm) {
                alerty.confirm({
                    message: msg,
                    callback: doPost,
                    callbackCancel: function () {}
                });
            } else if (window.confirm('按当前顺序重排所选模板编号？')) {
                doPost();
            }
        });
    }

    function bindDemote() {
        $(document).on('click', '.tpl-demote-btn', function (e) {
            e.preventDefault();
            e.stopPropagation();
            const cid = $(this).data('contest-id');
            const doPost = function () {
                demoteRequest(cid).then(function (res) {
                    if (res.code === 1) {
                        if (typeof alerty !== 'undefined') {
                            alerty.success(res.msg || '完成', 'OK');
                        }
                        $('#tpl_manage_table').bootstrapTable('remove', {
                            field: 'contest_id',
                            values: [cid]
                        });
                        syncTplBatchActionButtons();
                    } else if (typeof alerty !== 'undefined') {
                        alerty.error(res.msg || '失败', 'Error');
                    }
                }).fail(function () {
                    if (typeof alerty !== 'undefined') {
                        alerty.error('请求失败', 'Error');
                    }
                });
            };
            if (typeof alerty !== 'undefined' && alerty.confirm) {
                alerty.confirm({
                    message:
                        '确定取消该练习的模板属性？<span class="en-text d-block mt-1">Remove template flag from this practice?</span>',
                    callback: doPost,
                    callbackCancel: function () {}
                });
            } else {
                if (window.confirm('确定取消模板？')) {
                    doPost();
                }
            }
        });
    }

    function bindEdit() {
        $(document).on('click', '.tpl-edit-btn', function (e) {
            e.preventDefault();
            e.stopPropagation();
            const id = $(this).data('contest-id');
            const row = $('#tpl_manage_table').bootstrapTable('getRowByUniqueId', id);
            if (!row) {
                return;
            }
            $('#tpl_edit_contest_id').val(row.contest_id);
            $('#tpl_edit_title').val(row.title || '');
            $('#tpl_edit_template_title').val(row.template_title || '');
            $('#tpl_edit_template_label').val(row.template_label || '');
            $('#tpl_edit_template_sort').val(row.template_sort != null ? row.template_sort : 0);
            const el = document.getElementById('tplEditModal');
            if (el && window.bootstrap && bootstrap.Modal) {
                bootstrap.Modal.getOrCreateInstance(el).show();
            }
        });
        $('#tpl_edit_save').on('click', function () {
            const contest_id = $('#tpl_edit_contest_id').val();
            $.post('/' + (window.tplManageModule || 'exadmin') + '/contesttpl/template_meta_edit_ajax', {
                contest_id: contest_id,
                title: $('#tpl_edit_title').val(),
                template_title: $('#tpl_edit_template_title').val(),
                template_label: $('#tpl_edit_template_label').val(),
                template_sort: $('#tpl_edit_template_sort').val()
            }, function (res) {
                if (res.code === 1) {
                    if (typeof alerty !== 'undefined') {
                        alerty.success(res.msg || '已保存', 'OK');
                    }
                    const modalEl = document.getElementById('tplEditModal');
                    if (modalEl && window.bootstrap) {
                        const inst = bootstrap.Modal.getInstance(modalEl);
                        if (inst) {
                            inst.hide();
                        }
                    }
                    loadMainTable();
                } else if (typeof alerty !== 'undefined') {
                    alerty.error(res.msg || '失败', 'Error');
                }
            }).fail(function () {
                if (typeof alerty !== 'undefined') {
                    alerty.error('请求失败', 'Error');
                }
            });
        });
    }

    document.addEventListener('DOMContentLoaded', function () {
        if (!document.getElementById('tpl_manage_table')) {
            return;
        }
        window.tplManageModule = 'exadmin';
        initMainTable();
        initTplFilterSidebar();
        initBulkReplaceModal();
        initPickerModal();
        initReindex();
        bindSortDelta();
        bindDemote();
        bindEdit();
    });
})();
