/**
 * 评测队列独立投屏：contest_data_ajax（增量 + 定期全量核验）、封榜客户端兜底、时间 T 切换、队伍展示
 * 依赖：contestlive_queue_feed.js（须先于本文件加载）
 */
(function () {
    csg.docready(function () {
        const F = window.ContestliveQueueFeed;
        if (!F) {
            console.error('contestlive_queue_feed.js missing');
            return;
        }
        const cid = window.CONTEST_LIVE_CID;
        const mod = window.CONTEST_LIVE_DATA_MODULE || 'cpcsys';
        const tbody = document.getElementById('contestlive_queue_tbody');
        const resultsMap = window.OJ_RESULTS_LIVE || {};
        const startMs = parseInt(String(window.CONTEST_LIVE_START_MS || 0), 10) || 0;
        let contestRow = window.CONTEST_LIVE_CONTEST_ROW || null;
        let lastTeamById = {};
        let lastProbLabel = {};
        let lastProbColor = {};

        const mergedBySid = new Map();
        let maxSolutionId = 0;
        let pollTick = 0;
        const FULL_VERIFY_EVERY = 12;

        const acCode = window.CONTEST_LIVE_AC_CODE != null ? parseInt(String(window.CONTEST_LIVE_AC_CODE), 10) : 4;

        function resultLabel(code) {
            const c = parseInt(String(code), 10);
            if (c === -1) {
                return '—';
            }
            if (resultsMap[code] !== undefined) {
                return String(resultsMap[code]);
            }
            const k = String(code);
            if (resultsMap[k] !== undefined) {
                return String(resultsMap[k]);
            }
            return k;
        }

        function resultTone(code) {
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

        function ingestSolutions(solutionArr, replaceAll) {
            if (!Array.isArray(solutionArr)) {
                return;
            }
            if (replaceAll) {
                mergedBySid.clear();
            }
            for (let i = 0; i < solutionArr.length; i++) {
                const s = solutionArr[i];
                if (!Array.isArray(s) || s[0] == null) {
                    continue;
                }
                const sid = parseInt(String(s[0]), 10);
                if (!isFinite(sid)) {
                    continue;
                }
                mergedBySid.set(sid, s);
                if (sid > maxSolutionId) {
                    maxSolutionId = sid;
                }
            }
        }

        function renderTable(teamById, labelByPid, colorByPid) {
            if (!tbody) {
                return;
            }
            const nowMs = Date.now();
            const mode = F.getTimeMode();
            const sols = Array.from(mergedBySid.values()).sort(function (a, b) {
                return (b[0] || 0) - (a[0] || 0);
            }).slice(0, 40);

            tbody.innerHTML = '';
            for (let i = 0; i < sols.length; i++) {
                const s = sols[i];
                if (!Array.isArray(s)) {
                    continue;
                }
                const uid = s[3];
                const pid = s[2];
                const eff = F.effectiveResultForDisplay(s, contestRow, nowMs);
                const tone = resultTone(eff);
                const tr = document.createElement('tr');
                tr.className = 'contestlive-queue-row';
                if (tone === 'ac') {
                    tr.classList.add('contestlive-queue-row--tone-ac');
                } else if (tone === 'warn') {
                    tr.classList.add('contestlive-queue-row--tone-warn');
                }
                const tdT = document.createElement('td');
                tdT.className = 'col-time';
                tdT.textContent = F.formatInDateForDisplay(s[5] || '', startMs, mode);
                const tdTeam = document.createElement('td');
                tdTeam.className = 'col-team';
                tdTeam.appendChild(F.createTeamCellEl(uid, teamById, cid));
                const tdP = document.createElement('td');
                tdP.className = 'col-pr';
                tdP.appendChild(F.createProblemPillEl(pid, labelByPid, colorByPid));
                const tdR = document.createElement('td');
                tdR.className = 'col-res';
                const pill = document.createElement('span');
                pill.className = 'contestlive-queue-res-pill';
                pill.setAttribute('data-tone', tone);
                pill.textContent = resultLabel(eff);
                if (parseInt(String(eff), 10) === -1) {
                    pill.setAttribute('title', '封榜期间 / Frozen');
                }
                tdR.appendChild(pill);
                tr.appendChild(tdT);
                tr.appendChild(tdTeam);
                tr.appendChild(tdP);
                tr.appendChild(tdR);
                tbody.appendChild(tr);
            }
        }

        async function loadOnce() {
            if (!cid || !tbody) {
                return;
            }
            pollTick += 1;
            const fullVerify = pollTick === 1 || pollTick % FULL_VERIFY_EVERY === 0;

            const qs = new URLSearchParams();
            qs.set('cid', String(cid));
            if (window.CONTEST_LIVE_LVTK) {
                qs.set('lvtk', String(window.CONTEST_LIVE_LVTK));
            }
            if (fullVerify) {
                ['team', 'solution', 'problem', 'contest'].forEach(function (x) {
                    qs.append('info_need[]', x);
                });
            } else {
                qs.append('info_need[]', 'solution');
                if (maxSolutionId > 0) {
                    qs.set('min_solution_id', String(maxSolutionId + 1));
                }
            }
            const url = '/' + mod + '/contest/contest_data_ajax?' + qs.toString();
            try {
                const ret = await csg.ajax('GET', url, {}, {}, 'json');
                if (!ret || parseInt(ret.code, 10) !== 1 || !ret.data) {
                    return;
                }
                const d = ret.data;
                if (d.contest) {
                    contestRow = d.contest;
                }
                if (Array.isArray(d.team)) {
                    lastTeamById = F.buildTeamById(d.team);
                }
                if (Array.isArray(d.problem)) {
                    const pm = F.buildProblemMaps(d.problem);
                    lastProbLabel = pm.labelByPid;
                    lastProbColor = pm.colorByPid;
                }
                const teamById = lastTeamById;
                const labelByPid = lastProbLabel;
                const colorByPid = lastProbColor;
                if (fullVerify) {
                    ingestSolutions(d.solution, true);
                    maxSolutionId = 0;
                    mergedBySid.forEach(function (row) {
                        const sid = parseInt(String(row[0]), 10);
                        if (isFinite(sid) && sid > maxSolutionId) {
                            maxSolutionId = sid;
                        }
                    });
                } else if (Array.isArray(d.solution) && d.solution.length) {
                    ingestSolutions(d.solution, false);
                }
                renderTable(teamById, labelByPid, colorByPid);
            } catch (e) {
                console.error(e);
            }
        }

        document.addEventListener('keydown', function (ev) {
            if (!ev || ev.ctrlKey || ev.metaKey || ev.altKey) {
                return;
            }
            const t = ev.target && ev.target.tagName;
            if (t === 'INPUT' || t === 'TEXTAREA') {
                return;
            }
            if (ev.key === 't' || ev.key === 'T') {
                const next = F.getTimeMode() === 'rel' ? 'abs' : 'rel';
                F.setTimeMode(next);
                ev.preventDefault();
                renderTable(lastTeamById, lastProbLabel, lastProbColor);
            }
        });

        document.addEventListener('contestlive-queue-layout-reset', function () {
            F.setTimeMode('rel');
            renderTable(lastTeamById, lastProbLabel, lastProbColor);
        });

        if (window.CONTEST_LIVE_PAGE === 'live_queue' || window.CONTEST_LIVE_PAGE === 'live_combo') {
            window.ContestlivePageLayoutResetters = window.ContestlivePageLayoutResetters || {};
            window.ContestlivePageLayoutResetters[window.CONTEST_LIVE_PAGE] = function () {
                try {
                    document.dispatchEvent(new Event('contestlive-queue-layout-reset'));
                } catch (e) {
                    F.setTimeMode('rel');
                    renderTable(lastTeamById, lastProbLabel, lastProbColor);
                }
            };
        }

        loadOnce();
        setInterval(loadOnce, 5000);
    });
})();
