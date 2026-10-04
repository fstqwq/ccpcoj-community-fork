/**
 * CPC rank 页：全场尚无提交时展示队伍卡片，轮询 contest_data_ajax（与 rank.js 同源），
 * 根据返回的 data.solution 是否非空切入 RankPageSystem。
 *
 * 依赖：window.RANK_CONFIG.api_url、cid、RankPageSystemInit、rank_page.js 已加载。
 */
(function (global) {
    'use strict';

    function contestDataHasSolution(json) {
        if (!json || typeof json !== 'object' || json.code !== 1) return false;
        var d = json.data;
        if (!d || typeof d !== 'object') return false;
        var sol = d.solution;
        return Array.isArray(sol) && sol.length > 0;
    }

    /**
     * 在 RANK_CONFIG.api_url 上追加/覆盖 cid 与仅拉 solution 的 info_need（减轻轮询体积）。
     */
    function buildContestDataPollUrl(apiUrl, cid) {
        var u = new URL(apiUrl, window.location.origin);
        u.searchParams.set('cid', String(cid));
        u.searchParams.delete('info_need[]');
        u.searchParams.delete('info_need');
        u.searchParams.append('info_need[]', 'solution');
        return u.pathname + u.search;
    }

    function CpcRankWaitBoot() {
        var root = document.getElementById('cpc-rank-unified-root');
        if (!root || !global.RANK_CONFIG || !global.RANK_CONFIG.api_url) return;

        var cid = global.RANK_CONFIG.key || global.RANK_CONFIG.cid_list;
        var pollUrl = buildContestDataPollUrl(String(global.RANK_CONFIG.api_url), cid);

        var done = false;
        var iv = null;

        function teardown() {
            if (iv) {
                clearInterval(iv);
                iv = null;
            }
        }

        function switchToRank() {
            if (done) return;
            done = true;
            teardown();
            root.innerHTML = '';
            var rc = document.createElement('div');
            rc.id = 'rank-container';
            root.appendChild(rc);
            if (typeof global.RankPageSystemInit === 'function') {
                global.RankPageSystemInit('rank-container', global.RANK_CONFIG);
            }
        }

        function pollOnce() {
            if (done) return;
            var bust = (pollUrl.indexOf('?') >= 0 ? '&' : '?') + '_=' + String(Date.now());
            fetch(pollUrl + bust, {
                method: 'GET',
                credentials: 'same-origin',
                cache: 'no-store',
                headers: {
                    'X-Requested-With': 'XMLHttpRequest',
                    'Content-Type': 'application/json',
                },
            })
                .then(function (r) {
                    if (!r.ok) throw new Error('http ' + r.status);
                    return r.json();
                })
                .then(function (j) {
                    if (contestDataHasSolution(j)) switchToRank();
                })
                .catch(function () {
                    /* 忽略单次失败 */
                });
        }

        pollOnce();
        iv = setInterval(pollOnce, 4000);
    }

    global.CpcRankWaitBoot = CpcRankWaitBoot;
})(window);
