/**
 * 综合 HUD：评测队列 + 最新过题（contest_data_ajax）
 * 与独立队列页共用 ContestliveQueueFeed：封榜、相对时间、题号气球色、结果色 pill；
 * HUD 专用：学校+队名、序/Σ 与右侧 RankLiveSystem 榜单同源（CONTEST_LIVE_HUD_RANK_BY_TEAM）。
 * 「最新过题」与 rank.js ProcessData 一致：每队每题只认时间序上首次揭晓的 AC，同题后续 AC 重交不进入该列表。
 * 「各题评测结果统计」：`#contestlive_prob_stats_mount`，与本次拉取同源的 solution 聚合（`renderProbStatsMount`，堆叠柱状图）。
 *
 * 调试：`?huddbg=1` / `hud_live_debug`，或通用 `?csg_dbg=contestlive_hud` / `localStorage csg_dbg`，见 `js/csg_debug.js`。
 * `CONTEST_LIVE_HUD_BOOT_MODE === 'queue_only'`：评测队列独立页（无最新过题表），可选 `CONTEST_LIVE_HUD_QUEUE_ROW_CAP` 覆盖队列行数，默认 40。
 */
(function () {
    function dbgHud(cat) {
        if (typeof window.CsgDbg !== 'function') {
            return;
        }
        const rest = Array.prototype.slice.call(arguments, 1);
        window.CsgDbg.apply(window, ['contestlive_hud', cat].concat(rest));
    }
    /** solution list 行 [1] 为 contest_id；缺省或非正时退回当前 HUD 页 cid。 */
    function rowContestId(solutionRow, pageCid) {
        const v = parseInt(String(solutionRow && solutionRow[1]), 10);
        if (v > 0) {
            return v;
        }
        const p = parseInt(String(pageCid), 10);
        return p > 0 ? p : 0;
    }

    function resultLabel(code, map) {
        const c = parseInt(String(code), 10);
        if (c === -1) {
            return '—';
        }
        const k = String(code);
        if (map && map[code] !== undefined) {
            return String(map[code]);
        }
        if (map && map[k] !== undefined) {
            return String(map[k]);
        }
        return k;
    }

    function resultTone(code, acCode) {
        const c = parseInt(String(code), 10);
        if (c === -1) {
            return 'pending';
        }
        if (c === acCode) {
            return 'ac';
        }
        if (c === 5 || c === 6) {
            return 'bad';
        }
        if (c === 7 || c === 8 || c === 9 || c === 10) {
            return 'warn';
        }
        if (c === 11 || c === 90) {
            return 'info';
        }
        return 'pending';
    }

    /** 与 `RankLiveSystem._publishHudRankLookup` 写入的键一致（同 rank 行 `data-row-id` / `item_key`）。 */
    function hudRankLookup(teamKey) {
        const map = window.CONTEST_LIVE_HUD_RANK_BY_TEAM;
        if (!map || typeof map !== 'object') {
            return null;
        }
        const id = teamKey != null ? String(teamKey).trim() : '';
        if (!id) {
            return null;
        }
        return map[id] || null;
    }

    /**
     * 与右侧直播榜 `item.item_key`（`data-row-id`）对齐：先按 contest_data 队伍表解析 uid，再对该条 solution 所属场次的 cid 做一次 normalizeContestTeamKey
     *（与 contestlive_queue_feed 注释及 rank 内 `teamMap` 键约定一致，不做多键兜底）。
     */
    function hudRankTeamKeyForRow(F, contestId, uid, tMap) {
        const scid = parseInt(String(contestId), 10) || 0;
        const meta = F.resolveTeamMetaForSolution(uid, tMap, scid);
        const idFromTeam = meta && meta.id != null ? String(meta.id).trim() : '';
        const raw = idFromTeam || (uid != null ? String(uid) : '');
        return F.normalizeContestTeamKey(raw, scid);
    }

    function fillRankCells(tr, teamKey) {
        const inf = hudRankLookup(teamKey);
        const tdRnk = tr.querySelector('td.col-rnk');
        const tdSolv = tr.querySelector('td.col-solv');
        if (tdRnk) {
            tdRnk.textContent = '';
            const sp = document.createElement('span');
            sp.className = 'contestlive-hud-rankcell';
            sp.textContent = inf && inf.rankLabel != null && inf.rankLabel !== '' ? String(inf.rankLabel) : '—';
            tdRnk.appendChild(sp);
        }
        if (tdSolv) {
            tdSolv.textContent = inf && typeof inf.solved === 'number' ? String(inf.solved) : '—';
        }
    }

    function patchHudRankColumns(tbody) {
        if (!tbody) {
            return;
        }
        const rows = tbody.querySelectorAll('tr[data-team-id]');
        const map = window.CONTEST_LIVE_HUD_RANK_BY_TEAM;
        const mapKeys = map && typeof map === 'object' ? Object.keys(map) : [];
        let hit = 0;
        let miss = 0;
        const missTids = [];
        for (let i = 0; i < rows.length; i++) {
            const tr = rows[i];
            const tid = tr.getAttribute('data-team-id');
            const inf = hudRankLookup(tid);
            if (inf) {
                hit += 1;
            } else {
                miss += 1;
                if (missTids.length < 6) {
                    missTids.push(tid);
                }
            }
            fillRankCells(tr, tid);
        }
        dbgHud('patch', 'patchHudRankColumns', {
            tbodyId: tbody.id || '',
            rowCount: rows.length,
            mapSize: mapKeys.length,
            mapSampleKeys: mapKeys.slice(0, 10),
            hit,
            miss,
            missTids,
        });
    }

    function reflowQueueTeamMarquees(root) {
        var scope = root && root.querySelectorAll ? root : document.getElementById('contestlive_display_root');
        if (!scope || !scope.querySelectorAll) {
            return;
        }
        var M = window.CsgMarqueePlain;
        if (!M || typeof M.applyHudMqLineIntermittentGroup !== 'function') {
            return;
        }
        M.applyHudMqLineIntermittentGroup(scope, {
            overflowSlackRatio: 0.02,
            speedPxPerSec: 72,
            pauseMs: 2600,
            minScrollMs: 1800,
            maxScrollMs: 32000
        });
    }

    /**
     * 与 rank.js ProcessData 一致：队+题在已有首次 AC 后，同题后续提交不参与「最新过题」。
     * @param {Array[]} solsDesc 按 solution_id 降序（新→旧）
     */
    function pickHudAcRowsDeduped(F, solsDesc, contestRowNow, pageCid, teamById, acCodeWant, nowMs) {
        const firstAcByKey = new Map();
        for (let i = solsDesc.length - 1; i >= 0; i--) {
            const s = solsDesc[i];
            if (!Array.isArray(s)) {
                continue;
            }
            if (parseInt(String(F.effectiveResultForDisplay(s, contestRowNow, nowMs)), 10) !== acCodeWant) {
                continue;
            }
            const scid = rowContestId(s, pageCid);
            const uid = s[3];
            const pid = s[2];
            const teamKey = hudRankTeamKeyForRow(F, scid, uid, teamById);
            const k = teamKey + '\x1e' + String(pid != null ? pid : '');
            if (!firstAcByKey.has(k)) {
                firstAcByKey.set(k, s);
            }
        }
        const out = Array.from(firstAcByKey.values());
        out.sort(function (a, b) {
            return (b[0] || 0) - (a[0] || 0);
        });
        return out.slice(0, 14);
    }

    /**
     * 各题 × 当前揭晓结果（与 HUD 队列相同的 effectiveResultForDisplay）提交次数堆叠柱状图；数据指纹不变则跳过 DOM。
     */
    function renderProbStatsMount(mountEl, d, contestRowNow, nowMs, labelByPid, colorByPid, F, resultsMap, acWant) {
        if (!mountEl) {
            return;
        }
        const problems = Array.isArray(d.problem) ? d.problem : [];
        const sols = Array.isArray(d.solution) ? d.solution : [];
        const codeSet = new Set();
        const countByPid = {};
        for (let i = 0; i < sols.length; i++) {
            const s = sols[i];
            if (!Array.isArray(s)) {
                continue;
            }
            const pid = s[2];
            if (pid == null) {
                continue;
            }
            const pk = String(pid);
            const eff = F.effectiveResultForDisplay(s, contestRowNow, nowMs);
            const c = parseInt(String(eff), 10);
            const ck = Number.isNaN(c) ? String(eff) : c;
            codeSet.add(ck);
            if (!countByPid[pk]) {
                countByPid[pk] = {};
            }
            const rowM = countByPid[pk];
            rowM[ck] = (rowM[ck] || 0) + 1;
        }
        const codes = Array.from(codeSet);
        codes.sort(function (a, b) {
            if (a === acWant && b !== acWant) {
                return -1;
            }
            if (b === acWant && a !== acWant) {
                return 1;
            }
            const na = typeof a === 'number' ? a : parseInt(String(a), 10);
            const nb = typeof b === 'number' ? b : parseInt(String(b), 10);
            if (!Number.isNaN(na) && !Number.isNaN(nb)) {
                return na - nb;
            }
            return String(a).localeCompare(String(b));
        });
        const norm = { c: codes, rows: {} };
        for (let rp = 0; rp < problems.length; rp++) {
            const p = problems[rp];
            if (!Array.isArray(p) || p[0] == null) {
                continue;
            }
            const pk = String(p[0]);
            norm.rows[pk] = {};
            for (let hc = 0; hc < codes.length; hc++) {
                const ck = codes[hc];
                const rowM = countByPid[pk];
                const n =
                    rowM && Object.prototype.hasOwnProperty.call(rowM, ck) && typeof rowM[ck] === 'number'
                        ? rowM[ck]
                        : 0;
                norm.rows[pk][String(ck)] = n;
            }
        }
        const normKey = JSON.stringify(norm);
        if (mountEl.dataset.hudStatsFp === normKey) {
            return;
        }
        mountEl.dataset.hudStatsFp = normKey;
        mountEl.textContent = '';
        if (!problems.length) {
            const em = document.createElement('div');
            em.className = 'contestlive-hud-prob-stats__empty cn-text';
            em.textContent = '暂无题目数据';
            mountEl.appendChild(em);
            return;
        }
        if (!codes.length) {
            const em = document.createElement('div');
            em.className = 'contestlive-hud-prob-stats__empty cn-text';
            em.textContent = '暂无提交';
            mountEl.appendChild(em);
            return;
        }
        const prColorMap = colorByPid && typeof colorByPid === 'object' ? colorByPid : {};
        const scroll = document.createElement('div');
        scroll.className = 'contestlive-hud-prob-stats-scroll';
        const root = document.createElement('div');
        root.className = 'csg-hud-statchart';
        const legend = document.createElement('div');
        legend.className = 'csg-hud-statchart__legend';
        legend.setAttribute('role', 'list');
        for (let h = 0; h < codes.length; h++) {
            const ck = codes[h];
            const lab = resultLabel(ck, resultsMap);
            const tone = resultTone(ck, acWant);
            const item = document.createElement('div');
            item.className = 'csg-hud-statchart__legitem';
            item.setAttribute('role', 'listitem');
            item.setAttribute('title', lab);
            const sw = document.createElement('span');
            sw.className = 'csg-hud-statchart__sw csg-hud-statchart__sw--' + tone;
            sw.setAttribute('aria-hidden', 'true');
            const tx = document.createElement('span');
            tx.className = 'csg-hud-statchart__legtext';
            tx.textContent = lab;
            item.appendChild(sw);
            item.appendChild(tx);
            legend.appendChild(item);
        }
        root.appendChild(legend);
        const plot = document.createElement('div');
        plot.className = 'csg-hud-statchart__plot';
        let maxTotal = 0;
        for (let r0 = 0; r0 < problems.length; r0++) {
            const p0 = problems[r0];
            if (!Array.isArray(p0) || p0[0] == null) {
                continue;
            }
            const pk0 = String(p0[0]);
            const rowM0 = countByPid[pk0];
            let t0 = 0;
            for (let hc0 = 0; hc0 < codes.length; hc0++) {
                const ck0 = codes[hc0];
                const n0 =
                    rowM0 &&
                    Object.prototype.hasOwnProperty.call(rowM0, ck0) &&
                    typeof rowM0[ck0] === 'number'
                        ? rowM0[ck0]
                        : 0;
                t0 += n0;
            }
            maxTotal = Math.max(maxTotal, t0);
        }
        if (maxTotal < 1) {
            maxTotal = 1;
        }
        for (let r = 0; r < problems.length; r++) {
            const p = problems[r];
            if (!Array.isArray(p)) {
                continue;
            }
            const pid = p[0];
            const pk = pid != null ? String(pid) : '';
            const letter = labelByPid[pid] != null ? String(labelByPid[pid]) : pk || '?';
            const rowMap = countByPid[pk] || {};
            let total = 0;
            for (let hi = 0; hi < codes.length; hi++) {
                const ckx = codes[hi];
                total +=
                    rowMap && Object.prototype.hasOwnProperty.call(rowMap, ckx) && typeof rowMap[ckx] === 'number'
                        ? rowMap[ckx]
                        : 0;
            }
            const col = document.createElement('div');
            col.className = 'csg-hud-statchart__col';
            const track = document.createElement('div');
            track.className = 'csg-hud-statchart__bartrack';
            const bar = document.createElement('div');
            bar.className = 'csg-hud-statchart__bar';
            const hFrac = total === 0 ? 0.1 : Math.min(1, total / maxTotal);
            bar.style.height = Math.round(hFrac * 10000) / 100 + '%';
            if (total === 0) {
                bar.classList.add('csg-hud-statchart__bar--empty');
            } else {
                for (let h = 0; h < codes.length; h++) {
                    const ck = codes[h];
                    const n =
                        rowMap &&
                        Object.prototype.hasOwnProperty.call(rowMap, ck) &&
                        typeof rowMap[ck] === 'number'
                            ? rowMap[ck]
                            : 0;
                    if (n < 1) {
                        continue;
                    }
                    const seg = document.createElement('div');
                    const tone = resultTone(ck, acWant);
                    seg.className = 'csg-hud-statchart__seg csg-hud-statchart__seg--' + tone;
                    seg.style.flexGrow = String(Math.max(1, n));
                    seg.setAttribute('title', resultLabel(ck, resultsMap) + ' · ' + n);
                    bar.appendChild(seg);
                }
            }
            track.appendChild(bar);
            col.appendChild(track);
            const letterEl = document.createElement('div');
            letterEl.className = 'csg-hud-statchart__letter';
            const ptitle = p[1] != null ? String(p[1]).trim() : '';
            if (ptitle) {
                letterEl.setAttribute('title', ptitle);
            }
            const prc = prColorMap[pid] != null ? String(prColorMap[pid]).trim() : '';
            if (prc) {
                letterEl.style.setProperty('--contestlive-pr-color', prc);
            }
            letterEl.textContent = letter;
            col.appendChild(letterEl);
            plot.appendChild(col);
        }
        root.appendChild(plot);
        scroll.appendChild(root);
        mountEl.appendChild(scroll);
    }

    function bootContestliveHudData() {
        if (window.__CONTESTLIVE_HUD_DATA_INIT) {
            dbgHud('boot', 'bootContestliveHudData skip: already inited');
            return;
        }
        const F = window.ContestliveQueueFeed;
        const cid = window.CONTEST_LIVE_CID;
        const mod = window.CONTEST_LIVE_DATA_MODULE || 'cpcsys';
        const tbody = document.getElementById('contestlive_queue_tbody');
        const acBody = document.getElementById('contestlive_ac_tbody');
        const probStatsMount = document.getElementById('contestlive_prob_stats_mount');
        const hudBootScope = window.CONTEST_LIVE_HUD_BOOT_MODE || 'full';
        const queueOnly = hudBootScope === 'queue_only';
        const resultsMap = window.OJ_RESULTS_LIVE || {};
        const acCode = parseInt(window.CONTEST_LIVE_AC_CODE, 10);
        const acWant = Number.isNaN(acCode) ? 4 : acCode;
        const startMs = parseInt(String(window.CONTEST_LIVE_START_MS || 0), 10) || 0;
        let contestRow = window.CONTEST_LIVE_CONTEST_ROW || null;

        dbgHud('boot', 'bootContestliveHudData', {
            readyState: document.readyState,
            cid,
            mod,
            hasF: !!F,
            hasTbody: !!tbody,
            hasAcBody: !!acBody,
            queueOnly,
            hasProbStats: !!probStatsMount,
        });

        if (!cid || !tbody || !F) {
            dbgHud('boot', 'bootContestliveHudData aborted (missing deps)');
            return;
        }
        if (!queueOnly && !acBody) {
            dbgHud('boot', 'bootContestliveHudData aborted (missing ac tbody)');
            return;
        }
        window.__CONTESTLIVE_HUD_DATA_INIT = 1;

        window.addEventListener('contestlive-hud-rank-refresh', function () {
            dbgHud('event', 'contestlive-hud-rank-refresh');
            patchHudRankColumns(tbody);
            if (acBody) {
                patchHudRankColumns(acBody);
            }
            window.requestAnimationFrame(function () {
                window.requestAnimationFrame(function () {
                    patchHudRankColumns(tbody);
                    if (acBody) {
                        patchHudRankColumns(acBody);
                    }
                });
            });
        });

        /**
         * 相对时间：仅替换 .col-time，避免整行重建打断队伍列跑马灯动画。
         */
        function patchAcTimeCellsOnly(acs, startMs, timeMode) {
            const trs = acBody.querySelectorAll('tr.contestlive-queue-row[data-solution-id]');
            if (!trs.length || trs.length !== acs.length) {
                return false;
            }
            for (let j = 0; j < acs.length; j++) {
                if (trs[j].getAttribute('data-solution-id') !== String(acs[j][0])) {
                    return false;
                }
            }
            for (let j = 0; j < acs.length; j++) {
                const oldTd = trs[j].querySelector('td.col-time');
                if (!oldTd) {
                    return false;
                }
                const newTd = F.createHudAcTimeCellEl(acs[j][5] || '', startMs, timeMode);
                oldTd.replaceWith(newTd);
            }
            return true;
        }

        function fetchAndRenderQueue() {
            const nowMs = Date.now();
            const mode = F.getTimeMode();
            const qs = new URLSearchParams();
            qs.set('cid', String(cid));
            if (window.CONTEST_LIVE_LVTK) {
                qs.set('lvtk', String(window.CONTEST_LIVE_LVTK));
            }
            ['team', 'solution', 'problem', 'contest'].forEach(function (x) {
                qs.append('info_need[]', x);
            });
            const url = '/' + mod + '/contest/contest_data_ajax?' + qs.toString();
            return csg.ajax('GET', url, {}, {}, 'json').then(function (ret) {
                if (!ret || parseInt(ret.code, 10) !== 1 || !ret.data) {
                    dbgHud('fetch', 'contest_data_ajax bad response', { code: ret && ret.code, hasData: !!(ret && ret.data) });
                    return;
                }
                const d = ret.data;
                const teamArr = Array.isArray(d.team) ? d.team : [];
                const solArr = Array.isArray(d.solution) ? d.solution : [];
                dbgHud('fetch', 'contest_data_ajax ok', {
                    teamCount: teamArr.length,
                    solutionCount: solArr.length,
                    sampleTeamRow0: teamArr[0],
                    sampleSolutionRow0: solArr[0],
                });
                if (d.contest) {
                    contestRow = d.contest;
                }
                const tMap = F.buildTeamById(d.team);
                const hudRankSys = window.__contestliveHudRankLiveInstance;
                if (hudRankSys && typeof hudRankSys.applyFreshContestData === 'function') {
                    try {
                        hudRankSys.applyFreshContestData(d);
                    } catch (eRank) {
                        dbgHud('fetch', 'hud embedded rank applyFreshContestData failed', {
                            err: eRank && eRank.message ? String(eRank.message) : String(eRank),
                        });
                    }
                }
                const pm = F.buildProblemMaps(d.problem);
                const labelByPid = pm.labelByPid;
                const colorByPid = pm.colorByPid;
                if (probStatsMount) {
                    renderProbStatsMount(probStatsMount, d, contestRow, nowMs, labelByPid, colorByPid, F, resultsMap, acWant);
                }
                const sols = Array.isArray(d.solution) ? d.solution.slice() : [];
                sols.sort(function (a, b) {
                    return (b[0] || 0) - (a[0] || 0);
                });
                const capRaw = parseInt(String(window.CONTEST_LIVE_HUD_QUEUE_ROW_CAP || ''), 10);
                const queueRowCap =
                    Number.isFinite(capRaw) && capRaw > 0 ? capRaw : queueOnly ? 40 : 18;
                const rows = sols.slice(0, queueRowCap);
                const acs = acBody ? pickHudAcRowsDeduped(F, sols, contestRow, cid, tMap, acWant, nowMs) : [];

                const queueFp = rows
                    .map(function (s) {
                        if (!Array.isArray(s)) {
                            return '';
                        }
                        return [
                            String(s[0]),
                            String(s[3] != null ? s[3] : ''),
                            String(s[2] != null ? s[2] : ''),
                            String(F.effectiveResultForDisplay(s, contestRow, nowMs)),
                        ].join(':');
                    })
                    .join('|');
                const acBodyKey = acBody
                    ? mode +
                      '\x1e' +
                      acs
                          .map(function (s) {
                              if (!Array.isArray(s)) {
                                  return '';
                              }
                              return [
                                  String(s[0]),
                                  String(s[3] != null ? s[3] : ''),
                                  String(s[2] != null ? s[2] : ''),
                                  String(s[5] != null ? s[5] : ''),
                              ].join(':');
                          })
                          .join('|')
                    : '';

                const needRebuildQueue = queueFp !== window.__contestliveHudQueueFp;
                const needRebuildAc = !!acBody && acBodyKey !== window.__contestliveHudAcBodyKey;

                const prevQ = window.__contestliveHudPrevQueueSids;
                const curQ = [];
                for (let iq = 0; iq < rows.length; iq++) {
                    if (Array.isArray(rows[iq]) && rows[iq][0] != null) {
                        curQ.push(String(rows[iq][0]));
                    }
                }
                const newQ = new Set();
                if (prevQ instanceof Set) {
                    for (let k = 0; k < curQ.length; k++) {
                        if (!prevQ.has(curQ[k])) {
                            newQ.add(curQ[k]);
                        }
                    }
                }
                window.__contestliveHudPrevQueueSids = new Set(curQ);

                const prevA = window.__contestliveHudPrevAcSids;
                const curA = [];
                for (let ia = 0; ia < acs.length; ia++) {
                    if (Array.isArray(acs[ia]) && acs[ia][0] != null) {
                        curA.push(String(acs[ia][0]));
                    }
                }
                const newA = new Set();
                if (prevA instanceof Set) {
                    for (let ka = 0; ka < curA.length; ka++) {
                        if (!prevA.has(curA[ka])) {
                            newA.add(curA[ka]);
                        }
                    }
                }
                if (acBody && window.CONTEST_LIVE_COMBO_LAYERS && prevA instanceof Set && newA.size > 0) {
                    try {
                        document.dispatchEvent(
                            new CustomEvent('contestlive-ac-new-solutions', {
                                detail: { sids: Array.from(newA) },
                            })
                        );
                    } catch (eComboEv) {
                        /* ignore */
                    }
                }
                if (acBody) {
                    window.__contestliveHudPrevAcSids = new Set(curA);
                }

                function buildAcRowsIntoBody() {
                    if (!acBody) {
                        return;
                    }
                    acBody.innerHTML = '';
                    for (let j = 0; j < acs.length; j++) {
                        const s = acs[j];
                        const sidA = String(s[0]);
                        const uid = s[3];
                        const scid = rowContestId(s, cid);
                        const teamKey = hudRankTeamKeyForRow(F, scid, uid, tMap);
                        if (j === 0) {
                            dbgHud('keys', 'ac rebuild row0', {
                                uid,
                                scid,
                                teamKey,
                                mapHit: !!hudRankLookup(teamKey),
                            });
                        }
                        const pid = s[2];
                        const tr = document.createElement('tr');
                        tr.className = 'contestlive-queue-row contestlive-queue-row--tone-ac';
                        tr.setAttribute('data-solution-id', sidA);
                        tr.setAttribute('data-solution-cid', String(scid));
                        tr.setAttribute('data-team-id', teamKey);
                        const tdRnk = document.createElement('td');
                        tdRnk.className = 'col-rnk';
                        const tdTeam = document.createElement('td');
                        tdTeam.className = 'col-team';
                        tdTeam.appendChild(F.createBroadcastTeamCellEl(uid, tMap, scid));
                        const tdSolv = document.createElement('td');
                        tdSolv.className = 'col-solv';
                        const tdP = document.createElement('td');
                        tdP.className = 'col-pr';
                        tdP.appendChild(F.createHudProblemCellEl(pid, labelByPid, colorByPid));
                        const tdT = F.createHudAcTimeCellEl(s[5] || '', startMs, mode);
                        tr.appendChild(tdRnk);
                        tr.appendChild(tdTeam);
                        tr.appendChild(tdSolv);
                        tr.appendChild(tdP);
                        tr.appendChild(tdT);
                        fillRankCells(tr, teamKey);
                        if (prevA instanceof Set && newA.has(sidA)) {
                            tr.classList.add('contestlive-queue-row--slide-in');
                        }
                        acBody.appendChild(tr);
                    }
                }

                let rebuiltMarqueeHosts = false;

                if (needRebuildQueue) {
                    window.__contestliveHudQueueFp = queueFp;
                    tbody.innerHTML = '';
                    for (let i = 0; i < rows.length; i++) {
                        const s = rows[i];
                        if (!Array.isArray(s)) {
                            continue;
                        }
                        const sid = String(s[0]);
                        const uid = s[3];
                        const scid = rowContestId(s, cid);
                        const teamKey = hudRankTeamKeyForRow(F, scid, uid, tMap);
                        if (i === 0) {
                            dbgHud('keys', 'queue rebuild row0', {
                                uid,
                                scid,
                                teamKey,
                                mapHit: !!hudRankLookup(teamKey),
                            });
                        }
                        const pid = s[2];
                        const eff = F.effectiveResultForDisplay(s, contestRow, nowMs);
                        const tone = resultTone(eff, acWant);
                        const tr = document.createElement('tr');
                        tr.className = 'contestlive-queue-row';
                        tr.setAttribute('data-solution-id', sid);
                        tr.setAttribute('data-solution-cid', String(scid));
                        tr.setAttribute('data-team-id', teamKey);
                        if (tone === 'ac') {
                            tr.classList.add('contestlive-queue-row--tone-ac');
                        } else if (tone === 'warn') {
                            tr.classList.add('contestlive-queue-row--tone-warn');
                        }
                        const tdRnk = document.createElement('td');
                        tdRnk.className = 'col-rnk';
                        const tdTeam = document.createElement('td');
                        tdTeam.className = 'col-team';
                        tdTeam.appendChild(F.createBroadcastTeamCellEl(uid, tMap, scid));
                        const tdSolv = document.createElement('td');
                        tdSolv.className = 'col-solv';
                        const tdP = document.createElement('td');
                        tdP.className = 'col-pr';
                        tdP.appendChild(F.createHudProblemCellEl(pid, labelByPid, colorByPid));
                        const tdR = document.createElement('td');
                        tdR.className = 'col-res';
                        const pill = document.createElement('span');
                        pill.className = 'contestlive-queue-res-pill';
                        pill.setAttribute('data-tone', tone);
                        pill.textContent = resultLabel(eff, resultsMap);
                        if (parseInt(String(eff), 10) === -1) {
                            pill.setAttribute('title', '封榜期间 / Frozen');
                        }
                        tdR.appendChild(pill);
                        tr.appendChild(tdRnk);
                        tr.appendChild(tdTeam);
                        tr.appendChild(tdSolv);
                        tr.appendChild(tdP);
                        tr.appendChild(tdR);
                        fillRankCells(tr, teamKey);
                        if (prevQ instanceof Set && newQ.has(sid)) {
                            tr.classList.add('contestlive-queue-row--slide-in');
                        }
                        tbody.appendChild(tr);
                    }
                    rebuiltMarqueeHosts = true;
                }

                if (acBody) {
                    if (needRebuildAc) {
                        window.__contestliveHudAcBodyKey = acBodyKey;
                        buildAcRowsIntoBody();
                        rebuiltMarqueeHosts = true;
                    } else if (mode === 'rel') {
                        if (!patchAcTimeCellsOnly(acs, startMs, mode)) {
                            window.__contestliveHudAcBodyKey = acBodyKey;
                            buildAcRowsIntoBody();
                            rebuiltMarqueeHosts = true;
                        }
                    }
                }

                patchHudRankColumns(tbody);
                if (acBody) {
                    patchHudRankColumns(acBody);
                }
                if (rebuiltMarqueeHosts) {
                    reflowQueueTeamMarquees(document.getElementById('contestlive_display_root'));
                }
            });
        }

        function load() {
            fetchAndRenderQueue().catch(function (e) {
                console.error(e);
            });
        }

        document.addEventListener('keydown', function (ev) {
            if (!ev || ev.ctrlKey || ev.metaKey || ev.altKey) {
                return;
            }
            const t = ev.target && ev.target.tagName;
            if (t === 'INPUT' || t === 'TEXTAREA' || t === 'SELECT') {
                return;
            }
            if (ev.key === 't' || ev.key === 'T') {
                const next = F.getTimeMode() === 'rel' ? 'abs' : 'rel';
                F.setTimeMode(next);
                ev.preventDefault();
                load();
            }
        });

        load();
        setInterval(load, 5000);
    }

    function bootContestliveProbStatsOnly() {
        if (window.__CONTESTLIVE_PROB_STATS_INIT) {
            return;
        }
        const F = window.ContestliveQueueFeed;
        const cid = window.CONTEST_LIVE_CID;
        const mod = window.CONTEST_LIVE_DATA_MODULE || 'cpcsys';
        const probStatsMount = document.getElementById('contestlive_prob_stats_mount');
        const resultsMap = window.OJ_RESULTS_LIVE || {};
        const acCode = parseInt(window.CONTEST_LIVE_AC_CODE, 10);
        const acWant = Number.isNaN(acCode) ? 4 : acCode;
        let contestRow = window.CONTEST_LIVE_CONTEST_ROW || null;
        if (!cid || !probStatsMount || !F) {
            return;
        }
        window.__CONTESTLIVE_PROB_STATS_INIT = 1;

        function load() {
            const nowMs = Date.now();
            const qs = new URLSearchParams();
            qs.set('cid', String(cid));
            if (window.CONTEST_LIVE_LVTK) {
                qs.set('lvtk', String(window.CONTEST_LIVE_LVTK));
            }
            ['team', 'solution', 'problem', 'contest'].forEach(function (x) {
                qs.append('info_need[]', x);
            });
            const url = '/' + mod + '/contest/contest_data_ajax?' + qs.toString();
            csg.ajax('GET', url, {}, {}, 'json').then(function (ret) {
                if (!ret || parseInt(ret.code, 10) !== 1 || !ret.data) {
                    return;
                }
                const d = ret.data;
                if (d.contest) {
                    contestRow = d.contest;
                }
                const pm = F.buildProblemMaps(d.problem);
                renderProbStatsMount(probStatsMount, d, contestRow, nowMs, pm.labelByPid, pm.colorByPid, F, resultsMap, acWant);
            });
        }

        load();
        setInterval(load, 5000);
    }

    function bootContestliveAcOnly() {
        if (window.__CONTESTLIVE_AC_PAGE_INIT) {
            return;
        }
        const F = window.ContestliveQueueFeed;
        const cid = window.CONTEST_LIVE_CID;
        const mod = window.CONTEST_LIVE_DATA_MODULE || 'cpcsys';
        const acBody = document.getElementById('contestlive_ac_tbody');
        const resultsMap = window.OJ_RESULTS_LIVE || {};
        const acCode = parseInt(window.CONTEST_LIVE_AC_CODE, 10);
        const acWant = Number.isNaN(acCode) ? 4 : acCode;
        const startMs = parseInt(String(window.CONTEST_LIVE_START_MS || 0), 10) || 0;
        let contestRow = window.CONTEST_LIVE_CONTEST_ROW || null;
        if (!cid || !acBody || !F) {
            return;
        }
        window.__CONTESTLIVE_AC_PAGE_INIT = 1;
        if (!window.CONTEST_LIVE_HUD_RANK_BY_TEAM) {
            window.CONTEST_LIVE_HUD_RANK_BY_TEAM = {};
        }

        window.addEventListener('contestlive-hud-rank-refresh', function () {
            dbgHud('event', 'contestlive-hud-rank-refresh (ac_only)');
            patchHudRankColumns(acBody);
            window.requestAnimationFrame(function () {
                window.requestAnimationFrame(function () {
                    patchHudRankColumns(acBody);
                });
            });
        });

        function marqueeReflowRootEl() {
            return document.getElementById('contestlive_display_root');
        }

        function patchAcTimeCellsOnly(acs, timeMode) {
            const trs = acBody.querySelectorAll('tr.contestlive-queue-row[data-solution-id]');
            if (!trs.length || trs.length !== acs.length) {
                return false;
            }
            for (let j = 0; j < acs.length; j++) {
                if (trs[j].getAttribute('data-solution-id') !== String(acs[j][0])) {
                    return false;
                }
            }
            for (let j = 0; j < acs.length; j++) {
                const oldTd = trs[j].querySelector('td.col-time');
                if (!oldTd) {
                    return false;
                }
                const newTd = F.createHudAcTimeCellEl(acs[j][5] || '', startMs, timeMode);
                oldTd.replaceWith(newTd);
            }
            return true;
        }

        function fetchAndRenderAc() {
            const nowMs = Date.now();
            const mode = F.getTimeMode();
            const qs = new URLSearchParams();
            qs.set('cid', String(cid));
            if (window.CONTEST_LIVE_LVTK) {
                qs.set('lvtk', String(window.CONTEST_LIVE_LVTK));
            }
            ['team', 'solution', 'problem', 'contest'].forEach(function (x) {
                qs.append('info_need[]', x);
            });
            const url = '/' + mod + '/contest/contest_data_ajax?' + qs.toString();
            return csg.ajax('GET', url, {}, {}, 'json').then(function (ret) {
                if (!ret || parseInt(ret.code, 10) !== 1 || !ret.data) {
                    return;
                }
                const d = ret.data;
                if (d.contest) {
                    contestRow = d.contest;
                }
                const hudRankSys = window.__contestliveHudRankLiveInstance;
                if (hudRankSys && typeof hudRankSys.applyFreshContestData === 'function') {
                    try {
                        hudRankSys.applyFreshContestData(d);
                    } catch (eRank) {
                        dbgHud('fetch', 'ac_only applyFreshContestData failed', {
                            err: eRank && eRank.message ? String(eRank.message) : String(eRank),
                        });
                    }
                }
                const tMap = F.buildTeamById(d.team);
                const pm = F.buildProblemMaps(d.problem);
                const labelByPid = pm.labelByPid;
                const colorByPid = pm.colorByPid;
                const sols = Array.isArray(d.solution) ? d.solution.slice() : [];
                sols.sort(function (a, b) {
                    return (b[0] || 0) - (a[0] || 0);
                });
                const acs = pickHudAcRowsDeduped(F, sols, contestRow, cid, tMap, acWant, nowMs);
                const acBodyKey =
                    mode +
                    '\x1e' +
                    acs
                        .map(function (s) {
                            if (!Array.isArray(s)) {
                                return '';
                            }
                            return [
                                String(s[0]),
                                String(s[3] != null ? s[3] : ''),
                                String(s[2] != null ? s[2] : ''),
                                String(s[5] != null ? s[5] : ''),
                            ].join(':');
                        })
                        .join('|');
                const needRebuildAc = acBodyKey !== window.__contestliveAcOnlyBodyKey;
                const prevA = window.__contestliveAcOnlyPrevSids;
                const curA = [];
                for (let ia = 0; ia < acs.length; ia++) {
                    if (Array.isArray(acs[ia]) && acs[ia][0] != null) {
                        curA.push(String(acs[ia][0]));
                    }
                }
                const newA = new Set();
                if (prevA instanceof Set) {
                    for (let ka = 0; ka < curA.length; ka++) {
                        if (!prevA.has(curA[ka])) {
                            newA.add(curA[ka]);
                        }
                    }
                }
                if (window.CONTEST_LIVE_COMBO_LAYERS && prevA instanceof Set && newA.size > 0) {
                    try {
                        document.dispatchEvent(
                            new CustomEvent('contestlive-ac-new-solutions', {
                                detail: { sids: Array.from(newA) },
                            })
                        );
                    } catch (eComboEv) {
                        /* ignore */
                    }
                }
                window.__contestliveAcOnlyPrevSids = new Set(curA);

                function buildAcRowsIntoBody() {
                    acBody.innerHTML = '';
                    for (let j = 0; j < acs.length; j++) {
                        const s = acs[j];
                        const sidA = String(s[0]);
                        const uid = s[3];
                        const scid = rowContestId(s, cid);
                        const teamKey = hudRankTeamKeyForRow(F, scid, uid, tMap);
                        const pid = s[2];
                        const tr = document.createElement('tr');
                        tr.className = 'contestlive-queue-row contestlive-queue-row--tone-ac';
                        tr.setAttribute('data-solution-id', sidA);
                        tr.setAttribute('data-solution-cid', String(scid));
                        tr.setAttribute('data-team-id', teamKey);
                        const tdRnk = document.createElement('td');
                        tdRnk.className = 'col-rnk';
                        const tdTeam = document.createElement('td');
                        tdTeam.className = 'col-team';
                        tdTeam.appendChild(F.createBroadcastTeamCellEl(uid, tMap, scid));
                        const tdSolv = document.createElement('td');
                        tdSolv.className = 'col-solv';
                        const tdP = document.createElement('td');
                        tdP.className = 'col-pr';
                        tdP.appendChild(F.createHudProblemCellEl(pid, labelByPid, colorByPid));
                        const tdT = F.createHudAcTimeCellEl(s[5] || '', startMs, mode);
                        tr.appendChild(tdRnk);
                        tr.appendChild(tdTeam);
                        tr.appendChild(tdSolv);
                        tr.appendChild(tdP);
                        tr.appendChild(tdT);
                        fillRankCells(tr, teamKey);
                        if (prevA instanceof Set && newA.has(sidA)) {
                            tr.classList.add('contestlive-queue-row--slide-in');
                        }
                        acBody.appendChild(tr);
                    }
                }

                if (needRebuildAc) {
                    window.__contestliveAcOnlyBodyKey = acBodyKey;
                    buildAcRowsIntoBody();
                    reflowQueueTeamMarquees(marqueeReflowRootEl());
                } else if (mode === 'rel') {
                    if (!patchAcTimeCellsOnly(acs, mode)) {
                        window.__contestliveAcOnlyBodyKey = acBodyKey;
                        buildAcRowsIntoBody();
                        reflowQueueTeamMarquees(marqueeReflowRootEl());
                    }
                }
            });
        }

        function load() {
            fetchAndRenderAc().catch(function (e) {
                console.error(e);
            });
        }

        document.addEventListener('keydown', function (ev) {
            if (!ev || ev.ctrlKey || ev.metaKey || ev.altKey) {
                return;
            }
            const t = ev.target && ev.target.tagName;
            if (t === 'INPUT' || t === 'TEXTAREA' || t === 'SELECT') {
                return;
            }
            if (ev.key === 't' || ev.key === 'T') {
                const next = F.getTimeMode() === 'rel' ? 'abs' : 'rel';
                F.setTimeMode(next);
                ev.preventDefault();
                load();
            }
        });

        document.addEventListener('contestlive-standalone-time-reset', function () {
            F.setTimeMode('rel');
            load();
        });

        load();
        setInterval(load, 5000);
    }

    const __hudBootMode = window.CONTEST_LIVE_HUD_BOOT_MODE || 'full';

    function routeHudDataBoot() {
        if (__hudBootMode === 'prob_stats_only') {
            if (document.readyState === 'loading') {
                csg.docready(bootContestliveProbStatsOnly);
            } else {
                bootContestliveProbStatsOnly();
            }
            return;
        }
        if (__hudBootMode === 'ac_only') {
            if (document.readyState === 'loading') {
                csg.docready(bootContestliveAcOnly);
            } else {
                bootContestliveAcOnly();
            }
            return;
        }
        if (__hudBootMode === 'queue_only') {
            if (document.readyState === 'loading') {
                csg.docready(bootContestliveHudData);
            } else {
                bootContestliveHudData();
            }
            return;
        }
        if (document.readyState === 'loading') {
            csg.docready(bootContestliveHudData);
        } else {
            bootContestliveHudData();
        }
    }

    routeHudDataBoot();
})();
