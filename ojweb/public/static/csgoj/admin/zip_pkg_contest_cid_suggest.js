/**
 * ZIP 包相关页：比赛 ID 输入框 + 候选列表
 * - 比赛归档：contest_export_suggest_ajax（仅 private%10∈0,1,2）
 * - 题目按比赛导出：problem_export_contest_suggest_ajax（含实验课 4，不含考试 5）
 */
(function (global) {
    'use strict';

    function setCidFeedback(feedbackSelector, data) {
        var el = feedbackSelector ? $(feedbackSelector) : $();
        if (!el.length) {
            return;
        }
        el.removeClass('text-success text-danger text-muted').empty();
        if (!data) {
            return;
        }
        if (data.exportable) {
            el.addClass('text-success');
            var cn = data.title ? '可导出：' + data.title : '该比赛可以导出。';
            var en = data.title ? 'OK to export: ' + data.title : 'This contest can be exported.';
            $('<span class="cn-text"/>').text(cn).appendTo(el);
            $('<span class="en-text d-block"/>').text(en).appendTo(el);
        } else {
            el.addClass('text-danger');
            if (data.msg_cn) {
                $('<span class="cn-text"/>').text(data.msg_cn).appendTo(el);
            }
            if (data.msg_en) {
                $('<span class="en-text d-block"/>').text(data.msg_en).appendTo(el);
            }
        }
    }

    /**
     * @param {object} opt
     * @param {string} opt.inputSelector
     * @param {string} opt.suggestBoxSelector
     * @param {string} [opt.feedbackSelector] 无则不做预检反馈
     * @param {string} opt.suggestUrl
     * @param {string} [opt.precheckUrl]
     * @param {string} [opt.closeNs] document 点击命名空间后缀，避免多实例冲突
     */
    function init(opt) {
        var o = opt || {};
        var inputSel = o.inputSelector || '';
        var suggestSel = o.suggestBoxSelector || '';
        var feedbackSel = o.feedbackSelector || '';
        var sgtUrl = o.suggestUrl || '';
        var preUrl = o.precheckUrl || '';
        var ns = String(o.closeNs || 'default');

        var $cid = $(inputSel);
        var $box = $(suggestSel);
        if (!$cid.length || !$box.length) {
            return;
        }

        function hideCidSuggest() {
            $box.removeClass('show').attr('hidden', true).empty();
        }

        function renderCidSuggest(rows) {
            $box.empty();
            if (!rows || !rows.length) {
                $box.append(
                    $(
                        '<div class="list-group-item admin-zip-pkg-cid-suggest-item text-muted small">无匹配项 / No matches</div>'
                    )
                );
            } else {
                rows.forEach(function (r) {
                    var id = r.contest_id;
                    var t = r.title_short != null ? String(r.title_short) : String(r.title || '');
                    var btn = $(
                        '<button type="button" class="list-group-item list-group-item-action admin-zip-pkg-cid-suggest-item" role="option"></button>'
                    );
                    btn.attr('data-cid', id);
                    btn.append($('<span class="admin-zip-pkg-cid-suggest-id"/>').text('#' + id));
                    btn.append($('<span class="admin-zip-pkg-cid-suggest-title"/>').text(t));
                    $box.append(btn);
                });
            }
            $box.removeAttr('hidden').addClass('show');
        }

        function fetchCidSuggest(q) {
            if (!sgtUrl) {
                return;
            }
            $.get(
                sgtUrl,
                { q: q, limit: 40 },
                function (ret) {
                    if (!ret || ret.code !== 1 || !ret.data) {
                        return;
                    }
                    renderCidSuggest(ret.data.rows || []);
                },
                'json'
            );
        }

        function runPrecheck(cid) {
            if (!preUrl || !feedbackSel || !cid || cid <= 0) {
                return;
            }
            $.get(preUrl, { contest_id: cid }, function (ret) {
                if (ret && ret.code === 1 && ret.data) {
                    setCidFeedback(feedbackSel, ret.data);
                }
            }, 'json');
        }

        var preTimer = null;
        var sugTimer = null;

        function scheduleSuggest() {
            if (!sgtUrl) {
                return;
            }
            clearTimeout(sugTimer);
            sugTimer = setTimeout(function () {
                fetchCidSuggest(String($cid.val() || '').trim());
            }, 220);
        }

        $cid.off('.zipPkgCid').on('focus.zipPkgCid click.zipPkgCid', function () {
            if (!sgtUrl) {
                return;
            }
            scheduleSuggest();
        });

        $cid.on('input.zipPkgCid', function () {
            clearTimeout(preTimer);
            setCidFeedback(feedbackSel, null);
            var raw = String($(this).val() || '').trim();
            scheduleSuggest();
            if (!preUrl || !feedbackSel || !/^\d+$/.test(raw)) {
                return;
            }
            var v = parseInt(raw, 10);
            if (!v || v <= 0) {
                return;
            }
            preTimer = setTimeout(function () {
                runPrecheck(v);
            }, 450);
        });

        $box.off('.zipPkgCid').on('mousedown.zipPkgCid', '.admin-zip-pkg-cid-suggest-item[data-cid]', function (e) {
            e.preventDefault();
            var cid = parseInt($(this).attr('data-cid'), 10);
            if (!cid || cid <= 0) {
                return;
            }
            $cid.val(String(cid));
            hideCidSuggest();
            runPrecheck(cid);
        });

        $(document).off('click.zipPkgCid_' + ns).on('click.zipPkgCid_' + ns, function (e) {
            if ($(e.target).closest('.admin-zip-pkg-cid-wrap').length) {
                return;
            }
            hideCidSuggest();
        });

        $cid.on('keydown.zipPkgCid', function (e) {
            if (e.key === 'Escape') {
                hideCidSuggest();
            }
        });
    }

    global.zipPkgContestCidSuggest = {
        init: init,
        setFeedback: setCidFeedback,
    };
})(window);
