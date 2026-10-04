/**
 * exadmin 练习添加/复制：按所选班级逐行填写总标题与起止时间，序列化为 exp_batch_json 提交。
 */
(function () {
    'use strict';

    function cfg() {
        return window.CONTEST_EDIT_CONFIG || {};
    }

    function masterPartsToSql(prefix) {
        const y = (document.getElementById(prefix + '_year') || {}).value;
        const m = (document.getElementById(prefix + '_month') || {}).value;
        const d = (document.getElementById(prefix + '_day') || {}).value;
        const h = (document.getElementById(prefix + '_hour') || {}).value;
        const mi = (document.getElementById(prefix + '_minute') || {}).value;
        if ([y, m, d, h, mi].some((v) => v === undefined || String(v).trim() === '')) {
            return '';
        }
        const pad = (n) => String(n).padStart(2, '0');
        const miNum = parseInt(mi, 10);
        const hNum = parseInt(h, 10);
        const dNum = parseInt(d, 10);
        const mNum = parseInt(m, 10);
        if ([miNum, hNum, dNum, mNum].some((x) => Number.isNaN(x))) {
            return '';
        }
        return `${String(y).trim()}-${pad(mNum)}-${pad(dNum)} ${pad(hNum)}:${pad(miNum)}:00`;
    }

    function sqlToDatetimeLocal(sql) {
        if (!sql) {
            return '';
        }
        if (typeof window.CsgAppNaiveSqlToDatetimeLocalValue === 'function') {
            const v0 = window.CsgAppNaiveSqlToDatetimeLocalValue(sql);
            if (v0) {
                return v0;
            }
        }
        const m = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):/.exec(String(sql).trim());
        if (!m) {
            return '';
        }
        return `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}`;
    }

    function datetimeLocalToSql(v) {
        if (!v) {
            return '';
        }
        if (typeof window.CsgDatetimeLocalValueToAppNaiveSql === 'function') {
            const s0 = window.CsgDatetimeLocalValueToAppNaiveSql(v);
            if (s0) {
                return s0;
            }
        }
        const d = new Date(v);
        if (Number.isNaN(d.getTime())) {
            return '';
        }
        const p = (n) => String(n).padStart(2, '0');
        return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:00`;
    }

    function getClssMap() {
        if (!window.clssSelector || typeof window.clssSelector.getSelectedClssIds !== 'function') {
            return { ids: [], map: null };
        }
        const ids = window.clssSelector.getSelectedClssIds() || [];
        const map = window.clssSelector.selectedClssMap || null;
        return { ids, map };
    }

    function defaultTitleForClss(clss) {
        const u = window.expTitleBuildUtils;
        if (!u || !u.isAutoOn() || !clss) {
            return '';
        }
        const suf = ($('#title_suffix').val() || '').trim();
        const expNo = u.readExpNoInt();
        const n = expNo === null ? 1 : expNo;
        return u.buildFullTitleFromClss(clss, n, suf).slice(0, 255);
    }

    const ExpPracticeBatchUi = {
        tbody: null,
        hiddenJson: null,

        init() {
            if (!cfg().exadmin_add_batch) {
                return;
            }
            this.tbody = document.querySelector('#exp_batch_table tbody');
            this.hiddenJson = document.getElementById('exp_batch_json');
            if (!this.tbody || !this.hiddenJson) {
                return;
            }
            const self = this;
            $(document).on('exppractice:batch-refresh', function () {
                self.refreshAutoTitles();
            });
            $('#clss_ids_input').on('change', function () {
                self.rebuildTable();
            });
            $(document).on('input change', '#title_suffix,#exp_no', function () {
                self.refreshAutoTitles();
            });
            $('#exp_batch_sync_default').on('click', function () {
                self.applyMasterTimesToAllRows();
            });
            this.tbody.addEventListener('input', function () {
                self.writeHiddenJson();
            });
            this.tbody.addEventListener('change', function () {
                self.writeHiddenJson();
            });
            setTimeout(function () {
                self.rebuildTable();
            }, 400);
        },

        rebuildTable() {
            if (!this.tbody) {
                return;
            }
            const prev = {};
            this.tbody.querySelectorAll('tr[data-clss-id]').forEach(function (tr) {
                const cid = parseInt(tr.dataset.clssId, 10);
                prev[cid] = {
                    title: (tr.querySelector('[data-f="title"]') || {}).value || '',
                    start: (tr.querySelector('[data-f="start"]') || {}).value || '',
                    end: (tr.querySelector('[data-f="end"]') || {}).value || '',
                };
            });
            const { ids, map } = getClssMap();
            this.tbody.innerHTML = '';
            if (!ids.length) {
                const tr = document.createElement('tr');
                tr.innerHTML = '<td colspan="5" class="exp-batch-empty-hint">请先选择班级，再为每个班填写标题与时间。</td>';
                this.tbody.appendChild(tr);
                this.writeHiddenJson();
                return;
            }
            const startSql = masterPartsToSql('start') || masterPartsToSql('end');
            const endSql = masterPartsToSql('end') || masterPartsToSql('start');
            const startLocal = sqlToDatetimeLocal(startSql);
            const endLocal = sqlToDatetimeLocal(endSql);
            ids.forEach(function (cid) {
                const clss = map && map.get(cid) ? map.get(cid) : null;
                const name = clss ? (clss.clss_title || '').trim() || ('#' + cid) : '#' + cid;
                const tr = document.createElement('tr');
                tr.dataset.clssId = String(cid);
                const kept = prev[cid];
                const titleVal = kept && kept.title
                    ? kept.title
                    : defaultTitleForClss(clss);
                tr.innerHTML =
                    '<td class="exp-batch-clss-name" title="' +
                    $('<div>').text(name).html() +
                    '">' +
                    $('<div>').text(name).html() +
                    '</td>' +
                    '<td><input type="text" class="form-control form-control-sm" data-f="title" maxlength="255" /></td>' +
                    '<td><input type="datetime-local" class="form-control form-control-sm" data-f="start" step="60" /></td>' +
                    '<td><input type="datetime-local" class="form-control form-control-sm" data-f="end" step="60" /></td>' +
                    '<td class="text-nowrap"><button type="button" class="btn btn-sm btn-outline-secondary exp-batch-row-sync">同步默认</button></td>';
                tr.querySelector('[data-f="title"]').value = titleVal;
                if (kept && kept.start) {
                    tr.querySelector('[data-f="start"]').value = kept.start;
                } else if (startLocal) {
                    tr.querySelector('[data-f="start"]').value = startLocal;
                }
                if (kept && kept.end) {
                    tr.querySelector('[data-f="end"]').value = kept.end;
                } else if (endLocal) {
                    tr.querySelector('[data-f="end"]').value = endLocal;
                }
                tr.querySelector('.exp-batch-row-sync').addEventListener('click', function () {
                    const st = masterPartsToSql('start');
                    const en = masterPartsToSql('end');
                    const sL = sqlToDatetimeLocal(st);
                    const eL = sqlToDatetimeLocal(en);
                    if (sL) {
                        tr.querySelector('[data-f="start"]').value = sL;
                    }
                    if (eL) {
                        tr.querySelector('[data-f="end"]').value = eL;
                    }
                    ExpPracticeBatchUi.writeHiddenJson();
                });
                ExpPracticeBatchUi.tbody.appendChild(tr);
            });
            if (window.ExpPracticeTimeCache && typeof window.ExpPracticeTimeCache.getSuggestion === 'function') {
                ids.forEach(function (cid) {
                    var cidNum = parseInt(cid, 10);
                    var kept = prev[cidNum];
                    if (kept && kept.start && kept.end) {
                        return;
                    }
                    window.ExpPracticeTimeCache.getSuggestion(cidNum).then(function (sug) {
                        if (!sug) {
                            return;
                        }
                        var trN = ExpPracticeBatchUi.tbody.querySelector('tr[data-clss-id="' + cidNum + '"]');
                        if (!trN) {
                            return;
                        }
                        var sl = window.ExpPracticeTimeCache.sqlToDatetimeLocal(sug.startSql);
                        var el = window.ExpPracticeTimeCache.sqlToDatetimeLocal(sug.endSql);
                        if (sl) {
                            trN.querySelector('[data-f="start"]').value = sl;
                        }
                        if (el) {
                            trN.querySelector('[data-f="end"]').value = el;
                        }
                        ExpPracticeBatchUi.writeHiddenJson();
                    }).catch(function () {});
                });
            }
            this.writeHiddenJson();
        },

        refreshAutoTitles() {
            if (!this.tbody) {
                return;
            }
            const { ids, map } = getClssMap();
            const idNums = ids.map(function (x) {
                return parseInt(x, 10);
            });
            const rows = this.tbody.querySelectorAll('tr[data-clss-id]');
            rows.forEach(function (tr) {
                const cid = parseInt(tr.dataset.clssId, 10);
                if (idNums.indexOf(cid) < 0) {
                    return;
                }
                const clss = map && map.get(cid) ? map.get(cid) : null;
                const inp = tr.querySelector('[data-f="title"]');
                if (!inp || !window.expTitleBuildUtils || !window.expTitleBuildUtils.isAutoOn()) {
                    return;
                }
                inp.value = defaultTitleForClss(clss);
            });
            this.writeHiddenJson();
        },

        applyMasterTimesToAllRows() {
            if (!this.tbody) {
                return;
            }
            const st = sqlToDatetimeLocal(masterPartsToSql('start'));
            const en = sqlToDatetimeLocal(masterPartsToSql('end'));
            this.tbody.querySelectorAll('tr[data-clss-id]').forEach(function (tr) {
                if (st) {
                    tr.querySelector('[data-f="start"]').value = st;
                }
                if (en) {
                    tr.querySelector('[data-f="end"]').value = en;
                }
            });
            this.writeHiddenJson();
        },

        collectBatchArray() {
            const out = [];
            if (!this.tbody) {
                return out;
            }
            this.tbody.querySelectorAll('tr[data-clss-id]').forEach(function (tr) {
                const cid = parseInt(tr.dataset.clssId, 10);
                const title = (tr.querySelector('[data-f="title"]') || {}).value || '';
                const st = datetimeLocalToSql((tr.querySelector('[data-f="start"]') || {}).value);
                const en = datetimeLocalToSql((tr.querySelector('[data-f="end"]') || {}).value);
                out.push({ clss_id: cid, title: title.trim(), start_time: st, end_time: en });
            });
            return out;
        },

        writeHiddenJson() {
            if (!this.hiddenJson) {
                return;
            }
            try {
                this.hiddenJson.value = JSON.stringify(this.collectBatchArray());
            } catch (e) {
                this.hiddenJson.value = '[]';
            }
        },

        validateOrAlert() {
            if (!cfg().exadmin_add_batch) {
                return true;
            }
            const { ids } = getClssMap();
            if (!ids.length) {
                alerty.alert({ title: '提示', message: '请先选择班级', message_en: 'Please select class(es)' });
                return false;
            }
            const arr = this.collectBatchArray();
            if (arr.length !== ids.length) {
                alerty.alert({ title: '提示', message: '班级与表格行不一致，请重选班级', message_en: 'Class selection mismatch' });
                return false;
            }
            for (let i = 0; i < arr.length; i++) {
                const it = arr[i];
                if (parseInt(it.clss_id, 10) !== parseInt(ids[i], 10)) {
                    alerty.alert({ title: '提示', message: '班级顺序异常，请刷新页面', message_en: 'Order mismatch' });
                    return false;
                }
                if (!it.title) {
                    alerty.alert({ title: '提示', message: '请为每个班级填写练习标题', message_en: 'Title required for each class' });
                    return false;
                }
                if (!it.start_time || !it.end_time) {
                    alerty.alert({ title: '提示', message: '请为每个班级填写开始与结束时间', message_en: 'Start/end time required' });
                    return false;
                }
                var stMs = typeof CsgNaiveAppTzToUtcMs === 'function' ? CsgNaiveAppTzToUtcMs(it.start_time) : NaN;
                var enMs = typeof CsgNaiveAppTzToUtcMs === 'function' ? CsgNaiveAppTzToUtcMs(it.end_time) : NaN;
                var badOrder = false;
                if (Number.isFinite(stMs) && Number.isFinite(enMs)) {
                    badOrder = stMs >= enMs;
                } else {
                    badOrder = new Date(it.start_time) >= new Date(it.end_time);
                }
                if (badOrder) {
                    alerty.alert({ title: '提示', message: '每个班级的开始时间须早于结束时间', message_en: 'Start must be before end' });
                    return false;
                }
            }
            return true;
        },

        finalizeForSubmit() {
            if (!cfg().exadmin_add_batch) {
                return;
            }
            this.writeHiddenJson();
            const arr = this.collectBatchArray();
            const titleEl = document.getElementById('title');
            if (titleEl && arr.length) {
                titleEl.removeAttribute('disabled');
                titleEl.value = arr[0].title || '';
            }
        }
    };

    window.ExpPracticeBatchUi = ExpPracticeBatchUi;
})();
