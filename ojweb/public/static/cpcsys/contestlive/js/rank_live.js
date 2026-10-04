/**
 * 直播投屏榜单：继承 RankSystem（复用 rank.js 数据/排名/题目格逻辑），
 * 独立 DOM 与样式（rank_live.css），不与 /contest/rank 共用页面结构。
 * 综合 HUD 右侧与 live_rank 投屏页仅展示「队伍榜」，不支持学校榜 / 滚榜视图（与左栏序·Σ 同源约定）。
 *
 * 数据刷新：`live_rank` 单页用 `setInterval(LoadData)`；HUD 嵌入由 `contestlive_hud_data` 每次
 * `contest_data_ajax` 成功后调用 `RankSystem.applyFreshContestData(data)`，与左列同源一包数据、无二次 HTTP。
 */
(function () {
    if (typeof RankSystem === 'undefined') {
        return;
    }
    // 须用 window.*：class RankLiveSystem 未声明完前不能 typeof RankLiveSystem（TDZ 会抛错）
    if (typeof window.RankLiveSystem !== 'undefined') {
        return;
    }

    /** 综合 HUD 调试：命名空间 `contestlive_hud`，见 `js/csg_debug.js` */
    function dbgHudRank(cat) {
        if (typeof window.CsgDbg !== 'function') {
            return;
        }
        const rest = Array.prototype.slice.call(arguments, 1);
        window.CsgDbg.apply(window, ['contestlive_hud', cat].concat(rest));
    }

    class RankLiveSystem extends RankSystem {
        constructor(containerId, config = {}) {
            const defaults = {
                flg_show_controls_toolbar: false,
                flg_show_time_progress: false,
                flg_show_page_contest_title: false,
                flg_show_fullscreen_contest_title: false,
                flg_award_lintel: false,
                flg_show_team_id: false,
                flg_rank_cache: true,
                rank_mode: 'team',
                rank_live_auto_refresh: true,
                /** 与综合 HUD `contestlive_hud_data` 拉 `contest_data_ajax` 周期同量级（毫秒） */
                rank_live_refresh_interval_ms: 5000,
            };
            const merged = RankToolMergeConfig(defaults, config);
            merged.rank_mode = 'team';
            if (containerId === 'rank-live-mount') {
                merged.flg_rank_cache = false;
            }
            super(containerId, merged);
            this.autoRefresh = merged.rank_live_auto_refresh !== false;
            this.flgAwardLintelEnabled = false;
            /**
             * 投屏榜（含综合 HUD 嵌入）：非全屏时 B 在「关闭 → 模式1 → 模式2 → 模式3」间循环，
             * 与正式榜全屏下「缓慢 / 半页 / 单行」语义对齐；模式2 为每次下移两条队伍（直播榜行 class 为 .rl-row）。
             */
            this._liveAutoScrollState = 0;
            this._liveSlowInterval = null;
            this._liveHalfInterval = null;
            this._liveHalfRaf = null;
            this._liveTwoRaf = null;
            this._liveTwoTimeout = null;
            if (typeof RankAwardLintel !== 'undefined') {
                RankAwardLintel.setEnabled(this, false);
            }
        }

        GetRankScrollEl() {
            return this.elements.rankGrid || null;
        }

        StopLiveRankAutoScrollAll() {
            if (this._liveSlowInterval) {
                clearInterval(this._liveSlowInterval);
                this._liveSlowInterval = null;
            }
            if (this._liveHalfInterval) {
                clearInterval(this._liveHalfInterval);
                this._liveHalfInterval = null;
            }
            if (this._liveHalfRaf != null) {
                cancelAnimationFrame(this._liveHalfRaf);
                this._liveHalfRaf = null;
            }
            if (this._liveTwoRaf != null) {
                cancelAnimationFrame(this._liveTwoRaf);
                this._liveTwoRaf = null;
            }
            if (this._liveTwoTimeout != null) {
                clearTimeout(this._liveTwoTimeout);
                this._liveTwoTimeout = null;
            }
        }

        _liveSlowScrollTick() {
            const el = this.GetRankScrollEl();
            if (!el || this._liveAutoScrollState !== 1) {
                return;
            }
            el.scrollTop += 1;
            if (el.scrollTop + el.clientHeight >= el.scrollHeight - 1) {
                el.scrollTop = 0;
            }
        }

        _startLiveAutoScrollSlow() {
            const delayMs = 49;
            this._liveSlowInterval = setInterval(() => this._liveSlowScrollTick(), delayMs);
        }

        _startLiveAutoScrollHalfPage() {
            const INTERVAL_MS = 8400;
            const ANIM_MS = 540;
            const runStep = () => {
                const el = this.GetRankScrollEl();
                if (!el || this._liveAutoScrollState !== 3) {
                    return;
                }
                const maxScroll = el.scrollHeight - el.clientHeight;
                if (maxScroll <= 0) {
                    return;
                }
                const startTop = el.scrollTop;
                let targetTop;
                if (startTop >= maxScroll - 2) {
                    targetTop = 0;
                } else {
                    const halfPage = Math.max(1, Math.floor(el.clientHeight * 0.5));
                    targetTop = Math.min(startTop + halfPage, maxScroll);
                }
                const startTime = performance.now();
                const animate = (now) => {
                    const el2 = this.GetRankScrollEl();
                    if (!el2 || this._liveAutoScrollState !== 3) {
                        this._liveHalfRaf = null;
                        return;
                    }
                    const elapsed = now - startTime;
                    const t = Math.min(1, elapsed / ANIM_MS);
                    const ease = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
                    el2.scrollTop = startTop + (targetTop - startTop) * ease;
                    if (t < 1) {
                        this._liveHalfRaf = requestAnimationFrame(animate);
                    } else {
                        this._liveHalfRaf = null;
                    }
                };
                this._liveHalfRaf = requestAnimationFrame(animate);
            };
            runStep();
            this._liveHalfInterval = setInterval(runStep, INTERVAL_MS);
        }

        _startLiveAutoScrollTwoRows() {
            const ANIM_MS = 420;
            const PX_PER_SEC = 18;
            const runStep = () => {
                const el = this.GetRankScrollEl();
                if (!el || this._liveAutoScrollState !== 2) {
                    return;
                }
                const maxScroll = el.scrollHeight - el.clientHeight;
                if (maxScroll <= 0) {
                    return;
                }
                const scrollTop = el.scrollTop;
                const rows = el.querySelectorAll('#rank-grid .rl-row');
                if (!rows.length) {
                    this._liveTwoTimeout = setTimeout(runStep, 1400);
                    return;
                }
                const containerRect = el.getBoundingClientRect();
                const rowTops = [];
                for (let i = 0; i < rows.length; i++) {
                    const r = rows[i].getBoundingClientRect();
                    rowTops.push(scrollTop + (r.top - containerRect.top));
                }
                const threshold = 2;
                let idx = -1;
                for (let j = 0; j < rowTops.length; j++) {
                    if (rowTops[j] > scrollTop + threshold) {
                        idx = j;
                        break;
                    }
                }
                let targetTop;
                if (idx < 0) {
                    targetTop = 0;
                } else if (idx + 1 < rowTops.length) {
                    targetTop = rowTops[idx + 1];
                } else {
                    targetTop = maxScroll;
                }
                targetTop = Math.min(targetTop, maxScroll);
                const startTop = scrollTop;
                const distance = Math.abs(targetTop - startTop);
                if (this._liveTwoRaf != null) {
                    cancelAnimationFrame(this._liveTwoRaf);
                    this._liveTwoRaf = null;
                }
                const startTime = performance.now();
                const animate = (now) => {
                    const el2 = this.GetRankScrollEl();
                    if (!el2 || this._liveAutoScrollState !== 2) {
                        this._liveTwoRaf = null;
                        return;
                    }
                    const elapsed = now - startTime;
                    const tt = Math.min(1, elapsed / ANIM_MS);
                    const ease = tt < 0.5 ? 2 * tt * tt : 1 - Math.pow(-2 * tt + 2, 2) / 2;
                    el2.scrollTop = startTop + (targetTop - startTop) * ease;
                    if (tt < 1) {
                        this._liveTwoRaf = requestAnimationFrame(animate);
                    } else {
                        this._liveTwoRaf = null;
                        const delayMs = Math.max(520, (distance / PX_PER_SEC) * 1000 - ANIM_MS);
                        this._liveTwoTimeout = setTimeout(runStep, delayMs);
                    }
                };
                this._liveTwoRaf = requestAnimationFrame(animate);
            };
            runStep();
        }

        /**
         * 非全屏投屏：B 循环 关 → 慢速到底回顶 → 每次下移两条 → 定时半页（再按回到关）。
         */
        CycleLiveRankAutoScroll() {
            const g = this.GetRankScrollEl();
            if (!g) {
                return;
            }
            if (g.scrollHeight <= g.clientHeight) {
                this.StopLiveRankAutoScrollAll();
                this._liveAutoScrollState = 0;
                this.ShowMessage('榜单无需滚动 · No vertical scroll needed');
                return;
            }
            this.StopLiveRankAutoScrollAll();
            this._liveAutoScrollState = (this._liveAutoScrollState + 1) % 4;
            const msgs = [
                '自动滚动：已关闭 · Auto-scroll off',
                '模式 1：缓慢匀速，到底回顶 · Slow scroll, loop to top',
                '模式 2：定时下移两条队伍 · Step: two rows',
                '模式 3：定时下移半屏 · Half-page steps',
            ];
            if (this._liveAutoScrollState === 1) {
                this._startLiveAutoScrollSlow();
            } else if (this._liveAutoScrollState === 2) {
                this._startLiveAutoScrollTwoRows();
            } else if (this._liveAutoScrollState === 3) {
                this._startLiveAutoScrollHalfPage();
            }
            this.ShowMessage(msgs[this._liveAutoScrollState]);
        }

        StopAutoScroll() {
            super.StopAutoScroll();
            this.StopLiveRankAutoScrollAll();
            this._liveAutoScrollState = 0;
        }

        HandleFullscreenChange() {
            super.HandleFullscreenChange();
            if (this.isFullscreen) {
                this.StopLiveRankAutoScrollAll();
                this._liveAutoScrollState = 0;
            }
        }

        /**
         * 表头、留白等不在 `#rank-grid` 内时，将滚轮增量转发到榜体（榜体自身由 overflow-y:auto 走浏览器默认滚动）。
         */
        HandleRankLiveWheel(e) {
            if (!e || this.currentMode === 'roll') {
                return;
            }
            const tag = e.target && e.target.tagName;
            if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
                return;
            }
            if (e.target && e.target.isContentEditable) {
                return;
            }
            if (e.ctrlKey || e.metaKey) {
                return;
            }
            const g = this.GetRankScrollEl();
            if (!g || g.scrollHeight <= g.clientHeight) {
                return;
            }
            if (g.contains(e.target)) {
                return;
            }
            if (!this.container || !this.container.contains(e.target)) {
                return;
            }
            let dy = e.deltaY;
            if (e.deltaMode === 1) {
                dy *= Math.round(Math.min(140, g.clientHeight * 0.14));
            } else if (e.deltaMode === 2) {
                dy *= g.clientHeight;
            }
            if (!dy) {
                return;
            }
            const maxScroll = g.scrollHeight - g.clientHeight;
            const next = Math.max(0, Math.min(maxScroll, g.scrollTop + dy));
            if (next === g.scrollTop && (g.scrollTop <= 0 || g.scrollTop >= maxScroll)) {
                e.preventDefault();
                return;
            }
            g.scrollTop = next;
            e.preventDefault();
        }

        HandleKeydown(e) {
            const tag = e.target && e.target.tagName;
            if (tag === 'INPUT' || tag === 'TEXTAREA') {
                return;
            }
            if (e.key === 'F5' && !e.ctrlKey) {
                e.preventDefault();
                this.RefreshData();
                return;
            }
            if (this.currentMode === 'roll') {
                return;
            }

            const g = this.GetRankScrollEl();
            if (g && g.scrollHeight > g.clientHeight && !e.ctrlKey && !e.metaKey && !e.altKey) {
                let dy = 0;
                if (e.key === 'ArrowDown') {
                    dy = Math.round(Math.min(140, g.clientHeight * 0.14));
                } else if (e.key === 'ArrowUp') {
                    dy = -Math.round(Math.min(140, g.clientHeight * 0.14));
                } else if (e.key === 'PageDown') {
                    dy = Math.round(g.clientHeight * 0.88);
                } else if (e.key === 'PageUp') {
                    dy = -Math.round(g.clientHeight * 0.88);
                }
                if (dy !== 0) {
                    e.preventDefault();
                    g.scrollBy({ top: dy, behavior: 'smooth' });
                    return;
                }
                if (e.key === 'Home') {
                    e.preventDefault();
                    g.scrollTop = 0;
                    return;
                }
                if (e.key === 'End') {
                    e.preventDefault();
                    g.scrollTop = g.scrollHeight;
                    return;
                }
            }

            if ((e.key === 'b' || e.key === 'B') && !e.ctrlKey && !e.metaKey) {
                if (!this.isFullscreen) {
                    e.preventDefault();
                    this.CycleLiveRankAutoScroll();
                    return;
                }
            }
            super.HandleKeydown(e);
        }

        Init() {
            super.Init();
            if (this.container) {
                this.container.classList.remove('rank-system');
                this.container.classList.add('rank-live-root');
            }
            this._syncContestliveSkinToRankRoot();
            this._wireRankLiveNameMarqueeResizeObserver();
            if (this.containerId === 'contestlive_rank_mount') {
                window.__contestliveHudRankLiveInstance = this;
            }
            this._ensureRankLiveAutoRefreshTimer();
            this._wireRankLiveWheelScroll();
        }

        _wireRankLiveWheelScroll() {
            if (this._rankLiveWheelWired || !this.container) {
                return;
            }
            this._rankLiveWheelWired = true;
            this._rankLiveWheelBound = (ev) => this.HandleRankLiveWheel(ev);
            this.container.addEventListener('wheel', this._rankLiveWheelBound, { passive: false });
        }

        ShouldScheduleAutoRefreshInterval() {
            return this.containerId === 'rank-live-mount';
        }

        GetAutoRefreshIntervalMs() {
            const v = this.config && this.config.rank_live_refresh_interval_ms;
            if (typeof v === 'number' && v > 0) {
                return v;
            }
            return 5000;
        }

        /**
         * `RankSystem` 仅在按 A 或 visibility 恢复时才会挂 `refreshInterval`；投屏直播榜默认应定时拉榜（与 HUD 观感一致）。
         */
        _ensureRankLiveAutoRefreshTimer() {
            if (!this.autoRefresh || this.externalMode || !this.container) {
                return;
            }
            if (!this.ShouldScheduleAutoRefreshInterval()) {
                return;
            }
            if (this.refreshInterval) {
                clearInterval(this.refreshInterval);
                this.refreshInterval = null;
            }
            const pollMs = this.GetAutoRefreshIntervalMs();
            this.refreshInterval = setInterval(() => {
                this.isInitialLoad = false;
                this.LoadData();
            }, pollMs);
        }

        /**
         * 与 RenderRank 末尾一致：间歇跑马灯绑定在 #rank-grid 上；须与 csg_marquee_plain 的 syncIntermittentMarqueeGroup 选项保持同步。
         */
        _syncRankLiveTeamNameMarquees() {
            const grid = this.elements.rankGrid;
            const M = window.CsgMarqueePlain;
            if (!grid || !M || typeof M.syncIntermittentMarqueeGroup !== 'function') {
                return;
            }
            M.syncIntermittentMarqueeGroup(grid, '.rl-name__primary', {
                speedPxPerSec: 70,
                pauseMs: 2600,
                minScrollMs: 1800,
                maxScrollMs: 32000,
                overflowSlackRatio: 0.02
            });
        }

        /** 综合 HUD 右侧等场景：首帧双 rAF 时列宽可能仍为 0，仅靠 RenderRank 一次 sync 会永久跳过跑马灯；随 #rank-grid 尺寸稳定后再测宽。 */
        _wireRankLiveNameMarqueeResizeObserver() {
            const grid = this.elements.rankGrid;
            if (!grid || typeof ResizeObserver === 'undefined') {
                return;
            }
            const self = this;
            let debounceTimer = null;
            this._rankGridMarqueeRo = new ResizeObserver(function () {
                if (debounceTimer) {
                    clearTimeout(debounceTimer);
                }
                debounceTimer = setTimeout(function () {
                    debounceTimer = null;
                    self._syncRankLiveTeamNameMarquees();
                }, 80);
            });
            this._rankGridMarqueeRo.observe(grid);
        }

        async IncrementalUpdate(list) {
            await super.IncrementalUpdate(list);
            this._syncRankLiveTeamNameMarquees();
        }

        /** 投屏仅队伍榜：忽略 URL / 外部配置中的 school、roll */
        GetInitialMode() {
            return 'team';
        }

        async LoadViewPrefs() {
            await super.LoadViewPrefs();
            this.currentMode = 'team';
        }

        /** 与 GetInitialMode 一致，禁止切入学校榜（IndexedDB 曾存 school 时也不生效） */
        SwitchMode(mode) {
            super.SwitchMode('team');
        }

        /** 与 html[data-contestlive-skin] 一致（boot 早于本类挂载时由 applySkinToDom 再写一次） */
        _syncContestliveSkinToRankRoot() {
            if (!this.container) {
                return;
            }
            const cur = document.documentElement.getAttribute('data-contestlive-skin');
            if (cur) {
                this.container.setAttribute('data-rank-skin', cur);
            } else if (window.ContestliveSkinLib && typeof window.ContestliveSkinLib.resolveSkin === 'function') {
                const page = typeof window.CONTEST_LIVE_PAGE === 'string' ? window.CONTEST_LIVE_PAGE : 'live';
                this.container.setAttribute('data-rank-skin', window.ContestliveSkinLib.resolveSkin(page, null));
            }
        }

        /** 不套用正式榜单表头的气球换肤逻辑（DOM 不同） */
        SyncRankSkinDependentHeaderBits() {}

        CreateHeader() {
            const header = document.createElement('div');
            header.className = 'rank-header rank-live-chrome-placeholder';
            header.style.display = 'none';
            header.setAttribute('aria-hidden', 'true');
            this.container.insertAdjacentElement('beforebegin', header);
        }

        ShouldShowProblemStats() {
            return false;
        }

        /**
         * 仅按打星规则过滤/标记队伍，不按 `contest_group` 归属筛除。
         * 综合 HUD 左栏「序 / Σ」数据来自全场 `contest_data_ajax` 最近提交，若右栏开启多归属筛选，
         * 仅用 `FilterByStarMode` 子集发布查找表会导致非选中归属队伍永远 miss（见 FilterByStarMode 内归属段）。
         */
        FilterStarTeamsOnly(list, starMode = null) {
            const tmp_star_mode = starMode === null ? this.starMode : starMode;
            return list.filter((item) => {
                const team = item.team;
                if (team.tkind === 2) {
                    if (tmp_star_mode === 0) {
                        item.isStar = true;
                    }
                    if (tmp_star_mode === 1) {
                        return false;
                    }
                    if (tmp_star_mode === 2) {
                        item.isStar = false;
                    }
                }
                return true;
            });
        }

        /**
         * 与 RankSystem 一致：已有 DOM 时用 IncrementalUpdate + FLIP（`CSGAnim.sortAnimate`），避免整表 innerHTML 闪烁。
         */
        UpdateRank(flg_render = true, starMode = null) {
            if (!this.rankList.length) {
                dbgHudRank('rankPublish', 'UpdateRank: rankList empty → clear HUD map', {
                    cid: this.config && (this.config.key || this.config.cid_list),
                });
                window.CONTEST_LIVE_HUD_RANK_BY_TEAM = {};
                try {
                    window.dispatchEvent(new CustomEvent('contestlive-hud-rank-refresh', { detail: { byTeamId: {} } }));
                } catch (e) { /* ignore */ }
                return [];
            }
            const filteredList = this.FilterByStarMode(this.rankList, starMode);
            let displayList;
            if (this.currentMode === 'school') {
                this._ReapplyMedalFlagsByGroupForCurrentView();
                this.CalculateRankInfo(filteredList);
                const schoolList = this.CalculateSchoolRank(filteredList);
                displayList = this.ApplyKeywordFilters(schoolList, 'school');
            } else {
                displayList = this.ApplyKeywordFilters(filteredList, 'team');
            }
            this.latestDisplayList = displayList;
            this.UpdateFilterQuickInfo(this.ApplyKeywordFilters(filteredList, 'team'));
            dbgHudRank('rankPublish', 'UpdateRank pipeline', {
                cid: this.config && (this.config.key || this.config.cid_list),
                rankListLen: this.rankList.length,
                filteredLen: filteredList.length,
                displayLen: displayList.length,
                currentMode: this.currentMode,
                starMode: starMode === null ? this.starMode : starMode,
                selectedGroupIds: this.selectedGroupIds,
                tagFilters: this.HasTagFilters ? this.HasTagFilters() : null,
                filterTeamsSize: this.filterTeams && this.filterTeams.size,
                filterSchoolsSize: this.filterSchools && this.filterSchools.size,
            });
            if (flg_render) {
                const grid = this.elements.rankGrid;
                if (grid && grid.children.length > 0) {
                    void this.IncrementalUpdate(displayList);
                } else {
                    void this.RenderRank(displayList);
                }
            }
            // 评测队列 / 最新过题：序·Σ 与「全场 + 打星 + 关键词标签」队伍维一致；右栏 DOM 仍用 displayList（可含多归属筛选）
            const hudBaseList =
                this.containerId === 'contestlive_rank_mount'
                    ? this.FilterStarTeamsOnly(this.rankList, starMode)
                    : filteredList;
            const teamHudSource = this.ApplyKeywordFilters(hudBaseList, 'team');
            dbgHudRank('rankPublish', 'HUD lookup base list', {
                hudMount: this.containerId === 'contestlive_rank_mount',
                hudBaseLen: hudBaseList.length,
                displayLen: displayList.length,
            });
            this._publishHudRankLookup(teamHudSource);
            return displayList;
        }

        async IncrementalUpdate(list) {
            await super.IncrementalUpdate(list);
            const grid = this.elements.rankGrid;
            if (!grid) {
                return;
            }
            grid.querySelectorAll('.rl-row--last').forEach(function (el) {
                el.classList.remove('rl-row--last');
            });
            const last = grid.querySelector('.rl-row:last-child');
            if (last) {
                last.classList.add('rl-row--last');
            }
            this.ReobserveFlags();
            this.ReobserveLogos();
            this._syncRankLiveTeamNameMarquees();
        }

        /** 与 CreateRankRow 内层 HTML 对齐，供增量更新替换 innerHTML（避免走错 `.solve-item` 等正式榜 selector） */
        _getRankLiveRowInnerHtml(item, rank, index) {
            const rankDisplay = item.isStar ? '*' : rank;
            const displayOrder = item.displayOrder;
            const rankClass = this.GetRankClassForDisplay(item, rank);
            const solved = item.solved;
            const penMin = RankjsFormatSecondsToMinutes(item.penalty);

            let nameBlock = '';
            if (this.currentMode === 'school') {
                const sch = RankToolEscapeHtml(item.school || '');
                const tc = item.teamCount != null ? String(item.teamCount) : '';
                nameBlock = `
                    <div class="rl-name rl-name--school">
                        <div class="rl-name__primary">${sch}</div>
                        ${tc ? `<div class="rl-name__meta">${tc} teams</div>` : ''}
                    </div>`;
            } else {
                const school = RankToolEscapeHtml((item.team && item.team.school) ? item.team.school : '');
                const cn = RankToolEscapeHtml((item.team && item.team.name) ? item.team.name : '');
                const en = RankToolEscapeHtml((item.team && item.team.name_en) ? item.team.name_en : '');
                nameBlock = `
                    <div class="rl-name">
                        ${school ? `<div class="rl-name__school">${school}</div>` : ''}
                        <div class="rl-name__primary">${cn}</div>
                        ${en ? `<div class="rl-name__en en-text">${en}</div>` : ''}
                    </div>`;
            }

            return `
                <div class="rl-row__main">
                    <div class="rl-cell rl-cell--rank">
                        <div class="rank-item ${rankClass}">
                            ${this.GetRankEmoji(rankClass)}
                            <span class="rank-number" order="${displayOrder != null ? displayOrder : ''}">${rankDisplay}</span>
                        </div>
                    </div>
                    <div class="rl-cell rl-cell--name">${nameBlock}</div>
                    <div class="rl-cell rl-cell--solv">${solved}</div>
                    <div class="rl-cell rl-cell--pen">${penMin}</div>
                </div>
                <div class="rl-row__problems">${this.CreateProblemGroup(item.problemStats, item)}</div>
            `;
        }

        async UpdateRankRow(item, rank, index) {
            const itemKey =
                item.item_key != null && item.item_key !== ''
                    ? String(item.item_key)
                    : item.team_id != null
                      ? String(item.team_id)
                      : '';
            if (!itemKey) {
                return;
            }
            const row = document.getElementById(`rank-grid-${itemKey}`);
            if (!row) {
                return;
            }
            row.className = `${this.GetRowClassName(index, row)} rl-row`;
            row.setAttribute('data-rank-mode', this.currentMode || 'team');
            row.innerHTML = this._getRankLiveRowInnerHtml(item, rank, index);
            this.BindIconTooltips(row);
        }

        /**
         * 供综合 HUD 左栏与右侧直播榜同源：键与 rank.js 榜单行 `data-row-id` 一致，即 `CalculateRank` 写入的 `item.item_key`
         *（队伍榜下与 `team_id` 同源，见 rank.js 中 `item_key: team_id`）。
         */
        _publishHudRankLookup(teamDisplayList) {
            if (!teamDisplayList || !teamDisplayList.length) {
                dbgHudRank('rankPublish', '_publishHudRankLookup: empty teamDisplayList → clear HUD map', {
                    argLen: teamDisplayList ? teamDisplayList.length : -1,
                });
                window.CONTEST_LIVE_HUD_RANK_BY_TEAM = {};
                try {
                    window.dispatchEvent(new CustomEvent('contestlive-hud-rank-refresh', { detail: { byTeamId: {} } }));
                } catch (e2) { /* ignore */ }
                return;
            }
            const ranked = this.CalculateRankInfo(teamDisplayList);
            const by = {};
            for (let i = 0; i < ranked.length; i++) {
                const it = ranked[i];
                const rowKey =
                    it.item_key != null && it.item_key !== ''
                        ? String(it.item_key)
                        : it.team_id != null && it.team_id !== ''
                          ? String(it.team_id)
                          : '';
                if (!rowKey) {
                    continue;
                }
                const lbl = it.displayRank != null && it.displayRank !== '' ? String(it.displayRank) : '—';
                by[rowKey] = {
                    rankLabel: lbl,
                    solved: typeof it.solved === 'number' ? it.solved : 0,
                    isStar: !!it.isStar
                };
            }
            window.CONTEST_LIVE_HUD_RANK_BY_TEAM = by;
            const sampleKeys = Object.keys(by).slice(0, 8);
            const sample0 = ranked[0];
            dbgHudRank('rankPublish', '_publishHudRankLookup: map written', {
                mapSize: Object.keys(by).length,
                sampleKeys,
                sampleRow0: sample0
                    ? {
                          item_key: sample0.item_key,
                          team_id: sample0.team_id,
                          displayRank: sample0.displayRank,
                          solved: sample0.solved,
                      }
                    : null,
            });
            try {
                window.dispatchEvent(new CustomEvent('contestlive-hud-rank-refresh', { detail: { byTeamId: by } }));
            } catch (e) { /* ignore */ }
        }

        async RenderRank(list) {
            const grid = this.elements.rankGrid;
            if (!grid) {
                return;
            }
            if (window.CsgMarqueePlain && typeof window.CsgMarqueePlain.stopIntermittentMarqueeGroup === 'function') {
                window.CsgMarqueePlain.stopIntermittentMarqueeGroup(grid);
            }
            grid.innerHTML = '';
            grid.setAttribute('data-rank-body-loading', '1');
            try {
                this._ReapplyMedalFlagsByGroupForCurrentView();
                const rankedList = this.CalculateRankInfo(list);
                const total = rankedList.length;
                const firstSyncBatch = 24;
                const batchSize = 180;
                let i = 0;
                const appendRows = async (from, toExclusive) => {
                    const frag = document.createDocumentFragment();
                    for (let j = from; j < toExclusive; j++) {
                        const item = rankedList[j];
                        try {
                            const row = await this.CreateRankRow(item, item.displayRank, j);
                            if (row && row.nodeType === Node.ELEMENT_NODE) {
                                frag.appendChild(row);
                            }
                        } catch (error) {
                            console.error('[RankLiveSystem] row', error);
                        }
                    }
                    if (frag.childNodes.length) {
                        grid.appendChild(frag);
                    }
                };
                const firstEnd = Math.min(firstSyncBatch, total);
                if (firstEnd > 0) {
                    await appendRows(0, firstEnd);
                    i = firstEnd;
                }
                while (i < total) {
                    await new Promise((resolve) => {
                        requestAnimationFrame(resolve);
                    });
                    const end = Math.min(i + batchSize, total);
                    await appendRows(i, end);
                    i = end;
                }
                this._syncRankLiveTeamNameMarquees();
                const lastRow = grid.querySelector('.rl-row:last-child');
                if (lastRow) {
                    lastRow.classList.add('rl-row--last');
                }
                this.ReobserveFlags();
                this.ReobserveLogos();
            } finally {
                grid.removeAttribute('data-rank-body-loading');
            }
        }

        /** live_rank 单页：顶栏计时 DOM 在替换表头前须移出，避免随旧 `.rank-header-row` 一并被销毁 */
        RecreateHeaderRow() {
            const host = document.getElementById('contestlive_rank_timer_host');
            if (host && this.containerId === 'rank-live-mount') {
                try {
                    document.body.appendChild(host);
                } catch (eMove) {
                    /* ignore */
                }
            }
            super.RecreateHeaderRow();
        }

        _attachLiveRankPageTimerToBanner(headerRow) {
            if (this.containerId !== 'rank-live-mount') {
                return;
            }
            const slot = headerRow.querySelector('.rl-head__banner-timer');
            const host = document.getElementById('contestlive_rank_timer_host');
            if (slot && host) {
                slot.appendChild(host);
            }
        }

        CreateHeaderRow() {
            if (window.CcpcRank && CcpcRank.active(this)) return RankSystem.prototype.CreateHeaderRow.call(this);
            const headerRow = document.createElement('div');
            headerRow.className = 'rank-header-row rl-head';
            headerRow.setAttribute('data-rank-mode', this.currentMode || 'team');
            const isLiveRankPage = this.containerId === 'rank-live-mount';

            if (!this.data || !this.data.problem || !this.problemMap || Object.keys(this.problemMap).length === 0) {
                if (isLiveRankPage) {
                    headerRow.innerHTML = `
                        <div class="rl-head__banner rl-head__banner--with-timer" role="heading" aria-level="2">
                            <div class="rl-head__banner-title"><div class="rl-head__loading">Loading…</div></div>
                            <div class="rl-head__banner-timer" aria-live="polite"></div>
                        </div>`;
                    this._attachLiveRankPageTimerToBanner(headerRow);
                } else {
                    headerRow.innerHTML = '<div class="rl-head__loading">Loading…</div>';
                }
                return headerRow;
            }

            const problemIds = Object.keys(this.problemMap).sort(
                (a, b) => this.problemMap[a].num - this.problemMap[b].num
            );
            const probCells = problemIds
                .map((pid) => {
                    const pr = this.problemMap[pid];
                    const letter = RankToolGetProblemAlphabetIdx(pr.num);
                    const color = RankToolParseColor(pr.color);
                    return `<div class="rl-prob-th" style="--rl-p:${color}">${RankToolEscapeHtml(letter)}</div>`;
                })
                .join('');
            const probCount = Math.max(1, problemIds.length);
            if (this.container) {
                this.container.style.setProperty('--rl-prob-count', String(probCount));
            }

            if (isLiveRankPage) {
                headerRow.innerHTML = `
                <div class="rl-head__banner rl-head__banner--with-timer" role="heading" aria-level="2">
                    <div class="rl-head__banner-title">${this.CreateBilingualText('实时榜单', 'Live standings')}</div>
                    <div class="rl-head__banner-timer" aria-live="polite"></div>
                </div>
                <div class="rl-head__problems" style="--rl-prob-count:${probCount}">${probCells}</div>
            `;
                this._attachLiveRankPageTimerToBanner(headerRow);
            } else {
                headerRow.innerHTML = `
                <div class="rl-head__banner" role="heading" aria-level="2">
                    ${this.CreateBilingualText('实时榜单', 'Live standings')}
                </div>
                <div class="rl-head__problems" style="--rl-prob-count:${probCount}">${probCells}</div>
            `;
            }
            return headerRow;
        }

        async CreateRankRow(item, rank, index) {
            const row = document.createElement('div');
            row.className = `${this.GetRowClassName(index)} rl-row`;
            row.setAttribute('data-row-id', item.item_key);
            row.setAttribute('data-rank-mode', this.currentMode || 'team');
            row.id = 'rank-grid-' + item.item_key;
            row.innerHTML = this._getRankLiveRowInnerHtml(item, rank, index);
            this.BindIconTooltips(row);
            return row;
        }
    }

    window.RankLiveSystem = RankLiveSystem;

    window.RankLiveSystemInit = function (containerId, config) {
        const merged = RankToolMergeConfig(window.RANK_CONFIG || {}, config || {});
        return new RankLiveSystem(containerId, merged);
    };
})();
