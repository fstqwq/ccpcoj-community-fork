/** CCPC presentation for recovered 2.0.40. Server snapshots own all concealment decisions. */
(function (global) {
    'use strict';
    const esc = value => String(value == null ? '' : value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    const CcpcRank = {
        active(instance) { return !!(instance.data && instance.data.ccpc_rows); },
        process(instance) {
            const data = instance.data;
            instance.teamMap = Object.create(null);
            (data.team || []).forEach(team => { instance.teamMap[String(team.team_id)] = team; });
            instance.teamIdsWithAnySolutionRow = new Set(Object.keys(instance.teamMap));
            instance.problemMap = Object.create(null);
            (data.problem || []).forEach(p => { instance.problemMap[String(p.problem_id)] = p; });
            instance.solutionMap = {};
            instance.map_fb = data.ccpc_meta.map_fb || {global:{},regular:{}};
            instance.rankList = data.ccpc_rows.map(row => Object.assign({}, row, {team:instance.teamMap[row.team_id]}));
            instance.rankList.sort((a,b) => instance.CompareTeamsForRanking(a,b));
            instance.timeReplayMode = false;
            instance.replayTime = null;
            instance.config.flg_rank_cache = false;
            instance.config.flg_show_time_progress = false;
            const header = instance.GetHeaderElement && instance.GetHeaderElement();
            if (header) {
                const slider = header.querySelector('#time-progress-slider');
                if (slider) { slider.disabled = true; slider.title = 'CCPC 公开榜为服务器快照 / Server snapshot'; }
            }
        },
        header(instance) {
            let cells = '';
            (instance.data.problem || []).forEach(p => {
                const stat = instance.data.ccpc_meta.problem_stats[String(p.problem_id)] || {};
                cells += '<div class="rank-col rank-col-problem"><div class="problem-header-content"><div class="problem-header-title">' + esc(RankToolGetProblemAlphabetIdx(p.num)) + '</div><div class="problem-header-stats">' + (stat.acTeams || 0) + '/' + (stat.totalTeams || 0) + '</div></div></div>';
            });
            const hidden = !instance.data.ccpc_meta.frozen_show_all;
            return '<div class="pro-header-group"><div class="ccpc-public-zone">' + cells + '</div>' + (hidden ? '<div class="ccpc-zone-split" aria-hidden="true"></div><div class="ccpc-private-zone-head">未公开题目 / Hidden problems</div>' : '') + '</div>';
        },
        group(instance, stats, item) {
            const order = instance.currentMode === 'school'
                ? (instance.data.problem || []).map(p => String(p.problem_id))
                : ((item && item.problemOrder) || Object.keys(stats || {}));
            let pub = '', hidden = '';
            for (const key of order) {
                const st = stats[key] || {status:'none',submitCount:0,lastSubmitTime:'',problemAlphabetIdx:''};
                const status = ['none','ac','wa','pending'].includes(st.status) ? st.status : 'none';
                const count = Number(st.submitCount) || 0;
                const label = st.problemAlphabetIdx || '';
                const time = st.lastSubmitTime || '';
                const parts = time.split(':').map(Number);
                const minute = parts.length === 3 ? (parts[0]*60+parts[1]) + "'" : '';
                let fb = '';
                if (status === 'ac' && label && item) {
                    if ((instance.map_fb.global[key] || {}).team_id === item.team_id) fb += ' pro-first-blood-global';
                    if ((instance.map_fb.regular[key] || {}).team_id === item.team_id) fb += ' pro-first-blood-regular';
                }
                const cell = '<div class="rank-col rank-col-problem"><div class="problem-item pro-' + status + fb + '" d-pro-idx="' + esc(label) + '" d-sub-cnt="' + count + '" d-last-sub="' + esc(time) + '"><div class="problem-content"><span class="pro-submit-cnt">' + (count || esc(label)) + '</span>' + (count && time ? '<span class="problem-separator">|</span>' : '') + '<span class="time-brief">' + esc(minute) + '</span><span class="time-full">' + esc(time) + '</span></div></div></div>';
                if (label) pub += cell; else hidden += cell;
            }
            return '<div class="ccpc-public-zone">' + pub + '</div>' + (hidden ? '<div class="ccpc-zone-split" aria-hidden="true"></div><div class="ccpc-private-zone">' + hidden + '</div>' : '');
        },
        pageClass(Base) {
            if (!global.RankCcpcPageSystem) global.RankCcpcPageSystem = class RankCcpcPageSystem extends Base {};
            return global.RankCcpcPageSystem;
        }
    };
    global.CcpcRank = CcpcRank;
    if (typeof module !== 'undefined' && module.exports) module.exports = CcpcRank;
})(typeof window !== 'undefined' ? window : globalThis);
