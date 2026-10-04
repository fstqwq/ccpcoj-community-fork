/**
 * 全屏投屏名单：超长单行文案跑马灯（逻辑对齐 rank_roll.enableMarqueeIfNeeded，独立实现避免依赖 RankRoll 实例）。
 * @param {HTMLElement|null} element
 * @param {string|null|undefined} text
 * @param {{ htmlWhenFit?: string, marqueeAggressive?: boolean }} [options]
 */
function awardPresEnableMarqueeIfNeeded(element, text, options) {
    options = options || {};
    const htmlWhenFit = options.htmlWhenFit;
    const hasText = text != null && String(text).trim() !== "";
    if (!element) {
        return;
    }
    /* 最快解题题号：字号在 .award-pres-fb-letters 子节点；勿 textContent 整段替换（会丢失缩放字号） */
    if (element.classList.contains("award-pres-fb-under-rank")) {
        return;
    }
    if (!hasText) {
        element.classList.remove("needs-marquee");
        const clearWrap = element.querySelector(".marquee-wrapper");
        if (clearWrap) {
            clearWrap.remove();
        }
        element.textContent = "";
        element.style.removeProperty("--marquee-duration");
        element.style.removeProperty("--marquee-translate");
        return;
    }
    element.classList.remove("needs-marquee");
    const oldWrapper = element.querySelector(".marquee-wrapper");
    if (oldWrapper) {
        oldWrapper.remove();
    }
    element.textContent = String(text);
    const minDur = options.marqueeAggressive ? 1.2 : 4;
    const baseSpeed = options.marqueeAggressive ? 155 : 80;
    requestAnimationFrame(() => {
        if (!element.parentNode) {
            return;
        }
        const containerWidth = element.clientWidth;
        const textWidth = element.scrollWidth;
        const isOverflowing = textWidth > containerWidth;
        if (isOverflowing && containerWidth > 0) {
            const separator = "    　    ";
            const computedStyle = window.getComputedStyle(element);
            const measureSeg = (seg) => {
                const t = document.createElement("span");
                t.style.visibility = "hidden";
                t.style.position = "absolute";
                t.style.whiteSpace = "nowrap";
                t.style.fontSize = computedStyle.fontSize;
                t.style.fontWeight = computedStyle.fontWeight;
                t.style.fontFamily = computedStyle.fontFamily;
                t.style.letterSpacing = computedStyle.letterSpacing;
                t.style.fontStyle = computedStyle.fontStyle;
                t.textContent = seg;
                document.body.appendChild(t);
                const w = t.offsetWidth;
                document.body.removeChild(t);
                return w;
            };
            const singleTextWidth = measureSeg(String(text));
            const sepWidth = measureSeg(separator);
            /* 无缝循环：平移恰好「第一拷贝 + 分隔」，与第二拷贝起点对齐（勿用 scrollWidth/2，会与 padding 等混算导致跳帧） */
            const translateDistance = Math.ceil(singleTextWidth + sepWidth);
            const duration = Math.max(minDur, translateDistance / baseSpeed);
            element.style.setProperty("--marquee-duration", duration + "s");
            element.style.setProperty("--marquee-translate", `-${translateDistance}px`);

            const wrapper = document.createElement("span");
            wrapper.className = "marquee-wrapper";
            wrapper.textContent = text + separator + text;
            element.textContent = "";
            element.appendChild(wrapper);
            element.classList.add("needs-marquee");
        } else {
            element.classList.remove("needs-marquee");
            if (htmlWhenFit) {
                element.innerHTML = htmlWhenFit;
            }
        }
    });
}

class AwardDeckPage extends AwardSystem {
    constructor() {
        super("award_deck_external");
        this.currentGroupId = "__global__";
        this.problemColorMap = {};
        this.dragPayload = null;
        this.presentationPages = [];
        this.presentationIndex = 0;
        this._awardPresDocScrollLocked = false;
        /** 打开编排 Modal 时深拷贝的已提交状态；关闭未保存时用于回滚 */
        this._awardPagerModalSnapshot = null;
        /** 为 true 时表示本次 hidden.bs.modal 由「保存应用」触发，不回滚 */
        this._awardPagerModalClosedBySubmit = false;
    }

    static deepCloneJson(obj) {
        if (obj == null) return null;
        try {
            return JSON.parse(JSON.stringify(obj));
        } catch (e) {
            return null;
        }
    }

    static get AWARD_DECK_PAGER_IDB_STORE() {
        return "award_deck_pager";
    }

    /** @returns {string[]} */
    static get AWARD_DECK_VISUAL_SUFFIXES() {
        return [
            "champion-school",
            "first-blood",
            "best-female",
            "tenacity",
            "medal-gold",
            "medal-silver",
            "medal-bronze",
            "champion-misc",
        ];
    }

    /** 窄 → 宽：与工具栏「更窄 / 更宽」步进顺序一致（含 fullscreen） */
    static getAspectPresetLadder() {
        return ["9:21", "9:16", "3:4", "4:3", "16:9", "21:9", "fullscreen"];
    }

    /** @returns {{ w: number, h: number } | null} */
    static parseAspectModeToRatio(mode) {
        const m = String(mode || "").trim();
        if (m === "fullscreen") return null;
        const segs = m.split(":");
        const w = parseInt(segs[0], 10);
        const h = parseInt(segs[1], 10);
        if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) return null;
        return { w, h };
    }

    static suggestAspectModeFromViewport(Vw, Vh) {
        const vr = Vw / Math.max(1, Vh);
        if (!Number.isFinite(vr) || vr <= 0) return "16:9";
        const ladder = AwardDeckPage.getAspectPresetLadder().filter((x) => x !== "fullscreen");
        let best = "16:9";
        let bestD = Infinity;
        ladder.forEach((key) => {
            const p = AwardDeckPage.parseAspectModeToRatio(key);
            if (!p) return;
            const r = p.w / p.h;
            const d = Math.abs(Math.log(vr / Math.max(1e-9, r)));
            if (d < bestD) {
                bestD = d;
                best = key;
            }
        });
        return best;
    }

    static nearestAspectLadderIndexForRatio(viewportRatio) {
        const ladder = AwardDeckPage.getAspectPresetLadder().filter((x) => x !== "fullscreen");
        let bestI = 0;
        let bestD = Infinity;
        const vr = viewportRatio;
        ladder.forEach((key, i) => {
            const p = AwardDeckPage.parseAspectModeToRatio(key);
            if (!p) return;
            const r = p.w / p.h;
            const d = Math.abs(Math.log(vr / Math.max(1e-9, r)));
            if (d < bestD) {
                bestD = d;
                bestI = i;
            }
        });
        return bestI;
    }

    /** 全屏名单在 choosePresentationColumnsAndTypeScale 重写 className 之后，恢复按奖项类型的 accent class。 */
    _syncPresentationListDeckVisualClass(listEl) {
        if (!listEl) return;
        AwardDeckPage.AWARD_DECK_VISUAL_SUFFIXES.forEach((s) => {
            listEl.classList.remove(`award-pres-deck-visual--${s}`);
        });
        const dv = this._presListDeckVisual || "";
        if (dv) listEl.classList.add(`award-pres-deck-visual--${dv}`);
    }

    updateBootstrapTable() {}

    async afterRestoreAwardBundle() {
        const idbKey = this._awardFilterIdbStorageKey();
        if (!idbKey || !window.idb || typeof window.idb.get !== "function") return;
        let row;
        try {
            row = await window.idb.get(
                AwardSystem.AWARD_FILTER_IDB_DB,
                AwardDeckPage.AWARD_DECK_PAGER_IDB_STORE,
                idbKey
            );
        } catch (e) {
            console.warn("[AwardDeckPage] pager idb get", e);
            return;
        }
        if (!row || typeof row !== "object" || !row.pager_rules || typeof row.pager_rules !== "object") return;
        const merged = this.normalizePagerRules({ ...this.getDefaultPagerRules(), ...row.pager_rules });
        if (!this.bundleState) {
            this.bundleState = this.normalizeAwardBundle({});
        }
        this.bundleState.pager_rules = merged;
        this.bundleState = this.normalizeAwardBundle(this.bundleState);
    }

    async _saveAwardDeckPagerRulesToIdb(pagerRules) {
        const idbKey = this._awardFilterIdbStorageKey();
        if (!idbKey || !window.idb || typeof window.idb.set !== "function") return;
        const payload = {
            v: 1,
            saved_at: new Date().toISOString(),
            pager_rules: pagerRules || this.getDefaultPagerRules(),
        };
        try {
            await window.idb.set(
                AwardSystem.AWARD_FILTER_IDB_DB,
                AwardDeckPage.AWARD_DECK_PAGER_IDB_STORE,
                idbKey,
                payload
            );
        } catch (e) {
            console.warn("[AwardDeckPage] pager idb set", e);
        }
    }

    processAwardData() {
        super.processAwardData();
        this.applyPresentationDisplayToDom(this.bundleState?.display);
        this.buildProblemColorMap();
        this.ensureDeckForEdit();
        this.renderDeckEditor({ persist: true });
    }

    refreshDataShow() {
        super.refreshDataShow();
        this.ensureDeckForEdit();
        this.renderDeckEditor({ persist: true });
    }

    ensureDeckForEdit() {
        const current = this.bundleState?.deck;
        if (!Array.isArray(current) || current.length === 0) {
            const pager = this.bundleState?.pager_rules || {};
            const baseDeck = this.getAwardDeckFromCurrentData(pager);
            this.bundleState = this.normalizeAwardBundle({
                ...(this.bundleState || {}),
                deck: baseDeck,
            });
            this.saveAwardBundle();
        }
    }

    bindEvents() {
        super.bindEvents();
        const presToolbar = document.querySelector(".award-presentation-toolbar--overlay");
        if (presToolbar && !this._awardPresThemeToolbarBound) {
            this._awardPresThemeToolbarBound = true;
            presToolbar.addEventListener("click", (e) => {
                const it = e.target.closest("[data-award-pres-theme]");
                if (!it || !presToolbar.contains(it)) return;
                const theme = it.getAttribute("data-award-pres-theme");
                if (!theme) return;
                e.preventDefault();
                this.setPresentationTheme(theme);
                const toggle = document.getElementById("award_pres_theme_menu_btn");
                if (toggle && typeof bootstrap !== "undefined" && bootstrap.Dropdown) {
                    const inst = bootstrap.Dropdown.getInstance(toggle);
                    if (inst) inst.hide();
                }
                requestAnimationFrame(() => this.applyPresentationSlideLayout());
            });
        }

        const openBtn = document.getElementById("award_deck_pager_config_btn");
        if (openBtn) {
            openBtn.addEventListener("click", () => this.openAwardDeckPagerModal());
        }

        const pagerModal = document.getElementById("award_deck_pager_modal");
        if (pagerModal && !this._awardDeckPagerModalDelegated) {
            this._awardDeckPagerModalDelegated = true;
            pagerModal.addEventListener("click", (e) => {
                const t = e.target;
                if (!(t instanceof HTMLElement)) return;
                const btn = t.closest("[data-award-deck-special-cmd]");
                if (!btn || !pagerModal.contains(btn)) return;
                const cmd = btn.getAttribute("data-award-deck-special-cmd");
                if (cmd === "default") this.applySpecialRailOrderDefault();
                else if (cmd === "sort_cycle") this.cycleSpecialRailOrderPhase();
            });
            pagerModal.addEventListener("change", (e) => {
                const t = e.target;
                if (t && t.id && /^switch_deck_inc_/.test(t.id)) this.renderSpecialOrderRail();
                if (t && (t.id === "switch_pres_show_school" || t.id === "switch_deck_inc_champion_schools")) {
                    this.maybeAlertChampionSchoolPresentationSchoolLine();
                }
            });
            pagerModal.addEventListener("hidden.bs.modal", () => {
                if (this._awardPagerModalClosedBySubmit) {
                    this._awardPagerModalClosedBySubmit = false;
                    this._awardPagerModalSnapshot = null;
                    return;
                }
                if (!this._awardPagerModalSnapshot) return;
                this._restoreAwardPagerModalSnapshotToBundle();
                this.applyPresentationDisplayToDom(this.bundleState?.display);
                this.renderPagerRulesEditor();
                this.renderSpecialOrderRail();
                this.renderDeckPairedWorkbench();
                this._awardPagerModalSnapshot = null;
            });
        }

        const headerSave = document.getElementById("award_deck_pager_modal_header_save");
        if (headerSave && !this._awardDeckHeaderSaveBound) {
            this._awardDeckHeaderSaveBound = true;
            headerSave.addEventListener("click", () => this.submitAwardDeckPagerModal());
        }

        const submitBtn = document.getElementById("award_deck_pager_modal_submit");
        if (submitBtn) {
            submitBtn.addEventListener("click", () => this.submitAwardDeckPagerModal());
        }

        const syncAllBtn = document.getElementById("award_deck_sync_pager_sizes_all_groups_btn");
        if (syncAllBtn) {
            syncAllBtn.addEventListener("click", () => this.syncCurrentGroupPagerSizesToAllGroups());
        }

        const presentationBtn = document.getElementById("award_presentation_btn");
        if (presentationBtn) {
            presentationBtn.addEventListener("click", () => this.openPresentation());
        }
        const packBtn = document.getElementById("award_presentation_pack_btn");
        if (packBtn) {
            packBtn.addEventListener("click", () => this.downloadAwardPresentationPackZip());
        }
        const prevBtn = document.getElementById("award_presentation_prev");
        const nextBtn = document.getElementById("award_presentation_next");
        const closeBtn = document.getElementById("award_presentation_close");
        const fsBtn = document.getElementById("award_presentation_fullscreen");
        if (prevBtn) prevBtn.addEventListener("click", () => this.changePresentationPage(-1));
        if (nextBtn) nextBtn.addEventListener("click", () => this.changePresentationPage(1));
        if (closeBtn) closeBtn.addEventListener("click", () => this.closePresentation());
        if (fsBtn) fsBtn.addEventListener("click", () => this.togglePresentationFullscreen());
        const zIn = document.getElementById("award_presentation_zoom_in");
        const zOut = document.getElementById("award_presentation_zoom_out");
        if (zIn) zIn.addEventListener("click", () => this.presentationZoomStep(1));
        if (zOut) zOut.addEventListener("click", () => this.presentationZoomStep(-1));
        const aspNarrow = document.getElementById("award_pres_aspect_narrow");
        const aspWide = document.getElementById("award_pres_aspect_wide");
        if (aspNarrow) aspNarrow.addEventListener("click", () => this.stepPresentationAspect(-1));
        if (aspWide) aspWide.addEventListener("click", () => this.stepPresentationAspect(1));
        const commitAsp = () => this.commitPresentationAspectFromToolbarInputs();
        ["award_pres_aspect_w", "award_pres_aspect_h"].forEach((id) => {
            const el = document.getElementById(id);
            if (!el) return;
            el.addEventListener("change", commitAsp);
            el.addEventListener("keydown", (e) => {
                if (e.key === "Enter") {
                    e.preventDefault();
                    commitAsp();
                }
            });
        });
        document.addEventListener("keydown", (e) => {
            const modal = document.getElementById("award_presentation_modal");
            if (!modal || modal.style.display === "none") return;
            if (e.key === "ArrowLeft") {
                this.changePresentationPage(-1);
            }
            if (e.key === "ArrowRight" || e.key === " ") {
                e.preventDefault();
                this.changePresentationPage(1);
            }
            if (e.key === "Escape") this.closePresentation();
        });
        this._presentationLayoutResize = () => {
            const modal = document.getElementById("award_presentation_modal");
            if (!modal || modal.style.display === "none" || !this.presentationPages?.length) return;
            this.applyPresentationSlideLayout();
        };
        window.addEventListener("resize", this._presentationLayoutResize);
        document.addEventListener("fullscreenchange", this._presentationLayoutResize);
    }

    async importAwardBundle(e) {
        await super.importAwardBundle(e);
        this.applyPresentationDisplayToDom(this.bundleState?.display);
    }

    async resetAwardBundle() {
        await super.resetAwardBundle();
        this.applyPresentationDisplayToDom(this.getDefaultDisplayConfig());
    }

    getAwardDeckPagerModal() {
        const el = document.getElementById("award_deck_pager_modal");
        if (!el || typeof bootstrap === "undefined" || !bootstrap.Modal) return null;
        return bootstrap.Modal.getOrCreateInstance(el, { backdrop: "static" });
    }

    /** 编排配置 Modal 标题栏第二行：当前赛事归属（与顶栏归属 tab 一致）。 */
    updateAwardDeckPagerModalGroupLine() {
        const el = document.getElementById("award_deck_pager_modal_group_line");
        if (!el) return;
        const gid = String(this.currentGroupId || "__global__");
        const g = this.getGroupTargets().find((x) => String(x.group_id) === gid);
        const name = `${g?.group_name || ""}`.trim();
        let line = name || gid;
        if (name && name !== gid) {
            line = `${name} · ${gid}`;
        }
        el.textContent = line;
    }

    _captureAwardPagerModalSnapshot() {
        if (!this.bundleState) return;
        this._awardPagerModalSnapshot = {
            pager_rules: AwardDeckPage.deepCloneJson(this.normalizePagerRules(this.bundleState.pager_rules || {})),
            display: AwardDeckPage.deepCloneJson(this.normalizePresentationDisplay(this.bundleState.display || {})),
        };
    }

    _restoreAwardPagerModalSnapshotToBundle() {
        if (!this.bundleState || !this._awardPagerModalSnapshot) return;
        const s = this._awardPagerModalSnapshot;
        if (s.pager_rules) {
            this.bundleState.pager_rules = this.normalizePagerRules(s.pager_rules);
        }
        if (s.display) {
            this.bundleState.display = this.normalizePresentationDisplay(s.display);
        }
        this.bundleState = this.normalizeAwardBundle(this.bundleState);
    }

    /** 将 bundleState 同步到编排 Modal 表单（不 show Modal） */
    _fillAwardDeckPagerModalFromBundle() {
        const n = this.bundleState;
        if (n?.switches) {
            const withStar = document.getElementById("switch_with_star_team");
            const allTeam = document.getElementById("switch_all_team_based");
            const oneTwoThree = document.getElementById("switch_one_two_three");
            if (withStar) withStar.checked = !!n.switches.include_star;
            if (allTeam) allTeam.checked = !!n.switches.all_team_based;
            if (oneTwoThree) oneTwoThree.checked = !!n.switches.one_two_three;
            this._syncAwardToolbarSwitchesUi();
        }
        const pagerRules = this.normalizePagerRules({
            ...this.getDefaultPagerRules(),
            ...(this.bundleState?.pager_rules || {}),
        });
        const ordW = document.getElementById("switch_pager_within_award_rank_forward");
        if (ordW) ordW.checked = !!pagerRules.within_award_rank_forward;
        if (window.csgSwitch && typeof window.csgSwitch.syncSwitchState === "function") {
            if (ordW) window.csgSwitch.syncSwitchState(ordW);
        }
        const inc = pagerRules.deck_include || {};
        const incEls = [
            ["switch_deck_inc_champion_schools", "champion_schools"],
            ["switch_deck_inc_first_blood", "first_blood"],
            ["switch_deck_inc_best_female", "best_female"],
            ["switch_deck_inc_tenacity", "tenacity"],
        ];
        incEls.forEach(([id, key]) => {
            const el = document.getElementById(id);
            if (el) el.checked = !!inc[key];
            if (el && window.csgSwitch && typeof window.csgSwitch.syncSwitchState === "function") {
                window.csgSwitch.syncSwitchState(el);
            }
        });
        this.applyPresentationDisplayToDom(this.bundleState?.display);
        this.renderPagerRulesEditor(pagerRules);
        this.renderSpecialOrderRail();
        this.updateAwardDeckPagerModalGroupLine();
    }

    openAwardDeckPagerModal() {
        this._awardPagerModalClosedBySubmit = false;
        this._captureAwardPagerModalSnapshot();
        this._fillAwardDeckPagerModalFromBundle();
        const m = this.getAwardDeckPagerModal();
        if (m) m.show();
    }

    async submitAwardDeckPagerModal() {
        if (!this.bundleState) return;
        const rawPager = this.readPagerRulesFromInputs();
        if (!rawPager) {
            if (typeof alerty !== "undefined" && alerty.error) {
                alerty.error({ message: "分页表单未就绪", message_en: "Pager form not ready" });
            }
            return;
        }
        const pagerRules = this.normalizePagerRules(rawPager);
        this.bundleState.pager_rules = pagerRules;
        this.bundleState.display = this.readPresentationDisplayFromInputs();
        await this._saveAwardDeckPagerRulesToIdb(pagerRules);
        this.calculateAwards();
        this.bundleState.deck = this.getAwardDeckFromCurrentData(pagerRules);
        this.bundleState.switches = {
            include_star: this.getSwitchWithStarTeam(),
            all_team_based: !this.getSwitchAcTeamBased(),
            one_two_three: this.getSwitchOneTwoThree(),
        };
        this.bundleState = this.normalizeAwardBundle(this.bundleState);
        await this.saveAwardBundle();
        this.renderGroupTabs();
        this.renderPagerRulesEditor();
        this.renderDeckPairedWorkbench();
        this.updateBundleWarning();
        this._scheduleSaveAwardFiltersToIdb();
        this._awardPagerModalClosedBySubmit = true;
        const m = this.getAwardDeckPagerModal();
        if (m) m.hide();
        if (typeof alerty !== "undefined" && alerty.success) {
            alerty.success({
                message: "分页规则已保存并重新生成编排页",
                message_en: "Pager rules saved; deck pages regenerated",
            });
        }
    }

    buildProblemColorMap() {
        this.problemColorMap = {};
        const list = Array.isArray(this.data?.contest?.problem) ? this.data.contest.problem : [];
        list.forEach((p) => {
            const ch = RankToolConvertNumToString((p.num || p.id) - 1000);
            this.problemColorMap[ch] = this.pickProblemColor(p);
        });
    }

    pickProblemColor(problem) {
        const colorText = `${problem?.color || problem?.title_color || ""}`.toLowerCase();
        const map = {
            red: "#d64545", blue: "#2678d8", green: "#1f8b4c", yellow: "#bb8d00",
            purple: "#7d4cc9", orange: "#cf6a14", pink: "#cb3b87", cyan: "#15889b",
        };
        return map[colorText] || "#2f6fb8";
    }

    getGroupTargets() {
        const contest = this.data?.contest || {};
        let groups = Array.isArray(this.data?.contest_group)
            ? this.data.contest_group
            : (Array.isArray(contest.contest_group) ? contest.contest_group : []);
        groups = groups.filter((g) => g && g.group_id);
        if (groups.length === 0) {
            return [{ group_id: "__global__", group_name: "全局 / Global" }];
        }
        return groups.map((g) => ({
            group_id: g.group_id,
            group_name: g.group_name || g.group_id,
        }));
    }

    /**
     * @param {{ persist?: boolean }} [opts] persist 默认 true；切换赛事归属或未保存关闭 Modal 时不写库
     */
    renderDeckEditor(opts) {
        const persist = !opts || opts.persist !== false;
        this.renderGroupTabs();
        this.renderPagerRulesEditor();
        this.renderDeckPairedWorkbench();
        if (persist) {
            this.saveAwardBundle();
        }
    }

    getPagerAwardLevelKeys() {
        if (this.getSwitchOneTwoThree()) {
            return ["一等奖", "二等奖", "三等奖"];
        }
        return ["金奖", "银奖", "铜奖"];
    }

    setPagerLabelByLevel(levelCnId, levelEnId, levelName) {
        const cnMap = {
            "金奖": "金奖",
            "银奖": "银奖",
            "铜奖": "铜奖",
            "一等奖": "一等奖",
            "二等奖": "二等奖",
            "三等奖": "三等奖",
        };
        const enMap = {
            "金奖": "Gold",
            "银奖": "Silver",
            "铜奖": "Bronze",
            "一等奖": "One",
            "二等奖": "Two",
            "三等奖": "Three",
        };
        const cnEl = document.getElementById(levelCnId);
        const enEl = document.getElementById(levelEnId);
        if (cnEl) cnEl.textContent = cnMap[levelName] || levelName;
        if (enEl) enEl.textContent = enMap[levelName] || levelName;
    }

    /**
     * 将当前赛事归属下填写的基础每页队数、分奖每页队数复制到其他赛事归属（不复制翻页顺序开关）。
     */
    syncCurrentGroupPagerSizesToAllGroups() {
        const groups = this.getGroupTargets();
        if (groups.length <= 1) {
            if (typeof alerty !== "undefined" && alerty.warning) {
                alerty.warning({
                    message: "仅单一赛事归属，无需同步",
                    message_en: "Only one affiliation — nothing to sync",
                });
            }
            return;
        }
        const raw = this.readPagerRulesFromInputs();
        if (!raw) return;
        const pager = this.normalizePagerRules(raw);
        const gid = this.currentGroupId;
        const byGroup = { ...(pager.by_group || {}) };
        const byGroupAward = { ...(pager.by_group_award || {}) };
        const baseVal = byGroup[gid];
        const nestedRaw = byGroupAward[gid];
        const nested = nestedRaw && typeof nestedRaw === "object"
            ? JSON.parse(JSON.stringify(nestedRaw))
            : null;

        const baseNum = parseInt(baseVal, 10);
        const hasBase = Number.isFinite(baseNum) && baseNum > 0;
        const hasNested = nested && Object.keys(nested).length > 0;
        if (!hasBase && !hasNested) {
            if (typeof alerty !== "undefined" && alerty.warning) {
                alerty.warning({
                    message: "请先在当前赛事归属填写基础或分奖每页队数",
                    message_en: "Set base or per-award page sizes for the current affiliation first",
                });
            }
            return;
        }

        groups.forEach((g) => {
            if (g.group_id === gid) return;
            if (hasBase) {
                byGroup[g.group_id] = baseNum;
            }
            if (hasNested) {
                byGroupAward[g.group_id] = JSON.parse(JSON.stringify(nested));
            }
        });

        pager.by_group = byGroup;
        pager.by_group_award = byGroupAward;
        this.bundleState = this.bundleState || this.normalizeAwardBundle({});
        this.bundleState.pager_rules = pager;
        this.renderPagerRulesEditor(this.bundleState.pager_rules);
        this.saveAwardBundle();
        if (typeof alerty !== "undefined" && alerty.success) {
            alerty.success({
                message: "已将当前赛事归属的基础与分奖每页队数复制到其他赛事归属",
                message_en: "Copied base and per-award page sizes from the current affiliation to all other affiliations",
            });
        }
    }

    /**
     * @param {object|null} rulesBase 为 null 时使用 bundleState.pager_rules
     */
    renderPagerRulesEditor(rulesBase = null) {
        const byGroupSizeInput = document.getElementById("award_pager_by_group_page_size");
        const ordW = document.getElementById("switch_pager_within_award_rank_forward");
        if (!byGroupSizeInput || !ordW) return;

        const pagerRules = this.normalizePagerRules(
            rulesBase || this.bundleState?.pager_rules || {}
        );
        ordW.checked = !!pagerRules.within_award_rank_forward;
        if (window.csgSwitch && typeof window.csgSwitch.syncSwitchState === "function") {
            window.csgSwitch.syncSwitchState(ordW);
        }

        const gid = this.currentGroupId;
        const byGroup = pagerRules?.by_group || {};
        const byGroupVal = byGroup?.[gid];
        byGroupSizeInput.value = byGroupVal ? byGroupVal : "";

        const [lvl1, lvl2, lvl3] = this.getPagerAwardLevelKeys();
        this.setPagerLabelByLevel("award_pager_label_level_1_cn", "award_pager_label_level_1_en", lvl1);
        this.setPagerLabelByLevel("award_pager_label_level_2_cn", "award_pager_label_level_2_en", lvl2);
        this.setPagerLabelByLevel("award_pager_label_level_3_cn", "award_pager_label_level_3_en", lvl3);

        const byGroupAward = pagerRules?.by_group_award || {};
        const nested = byGroupAward?.[gid] || {};

        const l1Input = document.getElementById("award_pager_award_level_1_page_size");
        const l2Input = document.getElementById("award_pager_award_level_2_page_size");
        const l3Input = document.getElementById("award_pager_award_level_3_page_size");
        if (l1Input) l1Input.value = nested?.[lvl1] ? nested[lvl1] : "";
        if (l2Input) l2Input.value = nested?.[lvl2] ? nested[lvl2] : "";
        if (l3Input) l3Input.value = nested?.[lvl3] ? nested[lvl3] : "";

        const groups = this.getGroupTargets();
        const cur = groups.find((g) => g.group_id === gid);
        const cnEl = document.getElementById("award_deck_pager_cur_cn");
        const enEl = document.getElementById("award_deck_pager_cur_en");
        if (cnEl) cnEl.textContent = cur?.group_name || cur?.group_id || gid;
        if (enEl) enEl.textContent = cur?.group_id || gid;
        const syncBtn = document.getElementById("award_deck_sync_pager_sizes_all_groups_btn");
        if (syncBtn) {
            syncBtn.disabled = groups.length <= 1;
        }
    }

    /**
     * 编排配置里：已纳入「冠亚季军学校」且全屏「学校」关闭时，提示冠亚季军学校页仍会显示学校信息。
     */
    maybeAlertChampionSchoolPresentationSchoolLine() {
        const champ = !!document.getElementById("switch_deck_inc_champion_schools")?.checked;
        const showSch = !!document.getElementById("switch_pres_show_school")?.checked;
        if (!champ || showSch) return;
        if (typeof alerty === "undefined" || !alerty.success) return;
        alerty.success({
            message: "冠亚季军学校相关编排页在全屏展示中仍会显示学校信息（学校优先于队名）。",
            message_en: "Champion-school deck pages still show the school line in presentation (school over team name).",
        });
    }

    /** 是否为「冠军学校 / 亚军学校 / 季军学校」编排页（全屏须强制展示学校且学校优先）。 */
    isChampionSchoolPresentationPage(page) {
        if (!page || String(page.award_key || "") !== "冠亚季军") return false;
        const sr = `${page.school_remark || ""}`.trim();
        if (sr === "冠军学校" || sr === "亚军学校" || sr === "季军学校") return true;
        const slot = String(page.award_slot_key || "");
        return /^school_[123]$/.test(slot);
    }

    /**
     * 当前页槽位下参与分页的「最快解题奖」桶列表（与 award.js buildSpecialDeckPagesForUnit 过滤一致）。
     * @param {object} page bundle.deck 一页
     * @param {string} gid
     * @returns {object[]}
     */
    _fbBucketListForDeckPage(page, gid) {
        const awardKey = "最快解题奖";
        let list = this._awardDeckGetBucketList(gid, awardKey);
        const slot = String(page?.award_slot_key || "");
        if (slot === "first_blood") return list;
        const letter = (page.fb_letter || (slot.match(/^fb_([A-Z]+)$/i) || [])[1] || "").trim().toUpperCase();
        if (!letter) return [];
        if (letter.length > 1) {
            const chars = [...letter];
            return list.filter((e) => chars.includes(`${e?.remark || ""}`.trim().toUpperCase()));
        }
        return list.filter((e) => `${e?.remark || ""}`.trim().toUpperCase() === letter);
    }

    /**
     * 按当前分页规则重算该槽位的自动分页页序列（与 _awardDeckPaginateTeams 一致，含 fb_row_letters）。
     * @param {string} gid
     * @param {object} page
     * @param {object} pagerRules
     * @returns {object[]}
     */
    _regenerateFbPaginatedPagesForSlot(gid, page, pagerRules) {
        const rules = this.normalizePagerRules(pagerRules || {});
        const groupInfo = { group_id: gid, group_name: "" };
        const slot = String(page?.award_slot_key || "");
        if (!slot) return [];
        const list = this._fbBucketListForDeckPage(page, gid);
        return this._awardDeckPaginateTeams(groupInfo, "最快解题奖", slot, list, rules, () => "");
    }

    /**
     * 全屏「最快解题奖」单行题号：**每行只对应一道题**（remark），不把同一队在桶里多题聚成一串。
     * 优先本页 `fb_row_letters[rowIdx]`；缺省或与分页一致时按自动分页回填。
     *
     * @param {object} page bundle.deck 一页
     * @param {number} rowIdx
     * @param {string} gid
     * @param {object[]} fullDeck 当前归属下已过滤的 deck 数组（保序）
     * @param {object} pagerRules
     * @returns {string} 单题字母，如 "A"
     */
    _resolveFbProblemLetterForPresentationRow(page, rowIdx, gid, fullDeck, pagerRules) {
        const ids = page?.team_ids || [];
        const tid = ids[rowIdx];
        if (!tid || String(page?.award_key || "") !== "最快解题奖") return "";
        const rules = this.normalizePagerRules(pagerRules || {});
        const fbl = Array.isArray(page.fb_row_letters) ? page.fb_row_letters : null;
        if (fbl != null && fbl.length === ids.length) {
            const cell = `${fbl[rowIdx] ?? ""}`.trim();
            if (cell) return cell.toUpperCase();
        }
        const autoPages = this._regenerateFbPaginatedPagesForSlot(gid, page, pagerRules);
        const matched = autoPages.find((ap) => {
            const a = ap.team_ids || [];
            if (a.length !== ids.length) return false;
            return a.every((t, i) => String(t) === String(ids[i]));
        });
        if (matched && Array.isArray(matched.fb_row_letters) && matched.fb_row_letters.length === ids.length) {
            const fromAuto = `${matched.fb_row_letters[rowIdx] ?? ""}`.trim();
            if (fromAuto) return fromAuto.toUpperCase();
        }
        const list = this._fbBucketListForDeckPage(page, gid);
        const rankFwd = rules.within_award_rank_forward === true;
        const sorted = this._awardDeckSortBucketList(list, rankFwd, gid);
        const pageSize = this.resolvePageSize(rules, gid, "最快解题奖");
        if (pageSize <= 0) return "";
        const slot = String(page.award_slot_key || "");
        const fbLetter = String(page.fb_letter || "").toUpperCase();
        const siblings = (fullDeck || []).filter((p) => String(p.group_id || "__global__") === gid
            && String(p.award_key || "") === "最快解题奖"
            && String(p.award_slot_key || "") === slot
            && String((p.fb_letter || "")).toUpperCase() === fbLetter);
        const pidx = siblings.findIndex((p) => p.id === page.id);
        if (pidx < 0) return "";
        const g = pidx * pageSize + rowIdx;
        const ent = sorted[g];
        if (!ent) return "";
        const it = ent.item || ent;
        if (String(it?.team?.team_id || "") !== String(tid)) return "";
        return `${ent.remark || ""}`.trim().toUpperCase();
    }

    readPresentationDisplayFromInputs() {
        const keys = {
            show_member_names: "switch_pres_show_member_names",
            show_coach: "switch_pres_show_coach",
            show_school: "switch_pres_show_school",
            show_team_name: "switch_pres_show_team_name",
            show_team_name_en: "switch_pres_show_team_name_en",
            show_team_id: "switch_pres_show_team_id",
        };
        const partial = {};
        Object.keys(keys).forEach((k) => {
            const el = document.getElementById(keys[k]);
            if (el) partial[k] = !!el.checked;
        });
        const tgc = document.getElementById("award_pres_team_grid_columns");
        if (tgc) partial.team_grid_columns = tgc.value;
        const base = { ...(this.bundleState?.display || {}) };
        return this.normalizePresentationDisplay({ ...base, ...partial });
    }

    readDeckIncludeFromDom() {
        return {
            champion_schools: !!document.getElementById("switch_deck_inc_champion_schools")?.checked,
            first_blood: !!document.getElementById("switch_deck_inc_first_blood")?.checked,
            best_female: !!document.getElementById("switch_deck_inc_best_female")?.checked,
            tenacity: !!document.getElementById("switch_deck_inc_tenacity")?.checked,
        };
    }

    /** 从轨道 DOM 读取「奖牌 + 专项」线性段（data-row-key：m:0 / s:id）。 */
    readDeckOrderSegmentsFromRail() {
        const list = document.getElementById("award_deck_special_order_list");
        if (!list) return [];
        const rows = list.querySelectorAll(".award-deck-order-row[data-row-key]");
        return [...rows].map((row) => {
            const k = `${row.getAttribute("data-row-key") || ""}`.trim();
            if (k.startsWith("m:")) {
                const tier = parseInt(k.slice(2), 10);
                if (tier === 0 || tier === 1 || tier === 2) return { kind: "medal", tier };
            }
            if (k.startsWith("s:")) {
                try {
                    const id = decodeURIComponent(k.slice(2)).trim();
                    if (id) return { kind: "special", id };
                } catch (err) { /* ignore */ }
            }
            return null;
        }).filter(Boolean);
    }

    renderSpecialOrderRail() {
        const listEl = document.getElementById("award_deck_special_order_list");
        if (!listEl) return;
        const def = this.getDefaultPagerRules();
        const pr = this.normalizePagerRules({
            ...(this.bundleState?.pager_rules || {}),
            deck_include: { ...def.deck_include, ...this.readDeckIncludeFromDom() },
        });
        const gid = this.currentGroupId;
        const segs = this.resolveDeckOrderSegments(gid, pr);
        const esc = (s) => String(s)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/"/g, "&quot;");
        const labelForSpecial = (id) => {
            const pair = this.getSpecialDeckOrderBilingualPair(id);
            if (pair) {
                return `<span class="cn-text">${esc(pair.cn)}</span><span class="en-text">${esc(pair.en)}</span>`;
            }
            const m = id.match(/^fb_([A-Z]+)$/i);
            if (m) return `<span class="cn-text">最快解题 ${esc(m[1])}</span><span class="en-text">FB ${esc(m[1])}</span>`;
            return esc(id);
        };
        const rowToneSpecial = (id) => {
            if (id === "champion_1" || id === "champion_2" || id === "champion_3") return "award-deck-special-row--champion";
            if (id === "first_blood" || /^fb_/i.test(id)) return "award-deck-special-row--fb";
            if (id === "best_female") return "award-deck-special-row--best-female";
            if (id === "tenacity") return "award-deck-special-row--tenacity";
            return "award-deck-special-row--misc";
        };
        const medalLabels = this.getPagerAwardLevelKeys();
        const html = [];
        segs.forEach((seg) => {
            if (seg.kind === "medal" && [0, 1, 2].includes(seg.tier)) {
                const cn = medalLabels[seg.tier] || `L${seg.tier + 1}`;
                const en = ["Gold", "Silver", "Bronze"][seg.tier] || "";
                const oneTwo = this.getSwitchOneTwoThree();
                const enDisp = oneTwo ? ["One", "Two", "Three"][seg.tier] : en;
                html.push(
                    `<div class="award-deck-special-row award-deck-order-row award-deck-special-row--medal award-deck-special-row--medal-${seg.tier}" draggable="true" data-row-key="m:${seg.tier}">` +
                    `<div class="award-deck-special-row-grip" title="拖拽排序 / Drag to reorder"><i class="bi bi-grip-vertical" aria-hidden="true"></i></div>` +
                    `<div class="award-deck-special-row-body"><div class="award-deck-special-row-label">` +
                    `<span class="cn-text">${esc(cn)}</span><span class="en-text text-muted ms-1">${esc(enDisp)}</span>` +
                    `</div></div></div>`
                );
            } else if (seg.kind === "special" && seg.id) {
                const tone = rowToneSpecial(seg.id);
                const rk = `s:${encodeURIComponent(seg.id)}`;
                html.push(
                    `<div class="award-deck-special-row award-deck-order-row ${tone}" draggable="true" data-row-key="${rk}">` +
                    `<div class="award-deck-special-row-grip" title="拖拽排序 / Drag to reorder"><i class="bi bi-grip-vertical" aria-hidden="true"></i></div>` +
                    `<div class="award-deck-special-row-body"><div class="award-deck-special-row-label">${labelForSpecial(seg.id)}</div></div></div>`
                );
            }
        });
        listEl.innerHTML = html.length
            ? html.join("")
            : '<div class="text-muted small award-deck-special-rail-empty">' +
              '<span class="cn-text">当前无法生成编排段（请检查筛选与奖项数据）。</span>' +
              '<span class="en-text">No deck segments for this affiliation.</span></div>';
        if (html.length) this._wireSpecialOrderListDrag(listEl);
        this._syncSpecialSortPhaseHint();
    }

    _syncSpecialSortPhaseHint() {
        const el = document.getElementById("award_deck_special_sort_phase_label");
        if (!el || !this.bundleState) return;
        const ph = this.normalizePagerRules(this.bundleState.pager_rules || {}).deck_special_order_phase;
        const cn = ph === 0 ? "当前：规范正序" : ph === 1 ? "当前：规范逆序" : "当前：自定义拖拽顺序";
        const en = ph === 0 ? "Canonical" : ph === 1 ? "Reversed" : "Custom drag";
        el.innerHTML = `<span class="cn-text">${cn}</span><span class="en-text text-muted ms-1">${en}</span>`;
    }

    _wireSpecialOrderListDrag(listEl) {
        let dragKey = null;
        listEl.querySelectorAll(".award-deck-order-row").forEach((row) => {
            row.addEventListener("dragstart", (e) => {
                dragKey = row.getAttribute("data-row-key");
                row.classList.add("is-dragging");
                try {
                    e.dataTransfer.setData("text/plain", dragKey || "");
                    e.dataTransfer.effectAllowed = "move";
                } catch (err) { /* ignore */ }
            });
            row.addEventListener("dragend", () => {
                row.classList.remove("is-dragging");
                dragKey = null;
                listEl.querySelectorAll(".award-deck-order-row").forEach((r) => r.classList.remove("is-drop-target"));
            });
            row.addEventListener("dragover", (e) => {
                e.preventDefault();
                if (!dragKey || dragKey === row.getAttribute("data-row-key")) return;
                row.classList.add("is-drop-target");
                e.dataTransfer.dropEffect = "move";
            });
            row.addEventListener("dragleave", () => row.classList.remove("is-drop-target"));
            row.addEventListener("drop", (e) => {
                e.preventDefault();
                row.classList.remove("is-drop-target");
                const fromKey = dragKey || e.dataTransfer.getData("text/plain");
                const toKey = row.getAttribute("data-row-key");
                if (!fromKey || !toKey || fromKey === toKey) return;
                const rows = [...listEl.querySelectorAll(".award-deck-order-row[data-row-key]")];
                const keys = rows.map((r) => r.getAttribute("data-row-key"));
                const fi = keys.indexOf(fromKey);
                const ti = keys.indexOf(toKey);
                if (fi < 0 || ti < 0) return;
                const [movedKey] = keys.splice(fi, 1);
                keys.splice(ti, 0, movedKey);
                const frag = document.createDocumentFragment();
                keys.forEach((k) => {
                    const hit = rows.find((r) => r.getAttribute("data-row-key") === k);
                    if (hit) frag.appendChild(hit);
                });
                listEl.appendChild(frag);
                if (this.bundleState) {
                    const nextSegs = this.readDeckOrderSegmentsFromRail();
                    this.bundleState.pager_rules = this.normalizePagerRules({
                        ...(this.bundleState.pager_rules || {}),
                        deck_special_order_phase: 2,
                        deck_order_segments: nextSegs,
                        deck_special_units: this.deckSpecialUnitsFromOrderSegments(nextSegs),
                    });
                    this._syncSpecialSortPhaseHint();
                }
            });
        });
    }

    applySpecialRailOrderDefault() {
        const def = this.getDefaultPagerRules();
        const pr = this.normalizePagerRules({
            ...(this.bundleState?.pager_rules || {}),
            deck_include: { ...def.deck_include, ...this.readDeckIncludeFromDom() },
        });
        const segs = this.canonicalDeckOrderSegments(this.currentGroupId, pr);
        if (this.bundleState) {
            this.bundleState.pager_rules = this.normalizePagerRules({
                ...pr,
                deck_special_order_phase: 0,
                deck_order_segments: segs,
                deck_special_units: this.deckSpecialUnitsFromOrderSegments(segs),
            });
        }
        this.renderSpecialOrderRail();
    }

    /** 在规范正序、规范逆序、自定义（拖拽）之间循环，并同步 deck_order_segments。 */
    cycleSpecialRailOrderPhase() {
        if (!this.bundleState) return;
        const def = this.getDefaultPagerRules();
        const pr = this.normalizePagerRules({
            ...(this.bundleState.pager_rules || {}),
            deck_include: { ...def.deck_include, ...this.readDeckIncludeFromDom() },
        });
        const cur = pr.deck_special_order_phase === 1 || pr.deck_special_order_phase === 2 ? pr.deck_special_order_phase : 0;
        const next = (cur + 1) % 3;
        const gid = this.currentGroupId;
        let newSegs;
        if (next === 0) {
            newSegs = this.canonicalDeckOrderSegments(gid, pr);
        } else if (next === 1) {
            newSegs = this.canonicalDeckOrderSegments(gid, pr).slice().reverse();
        } else {
            newSegs = this.readDeckOrderSegmentsFromRail();
            if (!Array.isArray(newSegs) || newSegs.length < 3) {
                newSegs = this.canonicalDeckOrderSegments(gid, pr);
            }
        }
        this.bundleState.pager_rules = this.normalizePagerRules({
            ...pr,
            deck_special_order_phase: next,
            deck_order_segments: newSegs,
            deck_special_units: this.deckSpecialUnitsFromOrderSegments(newSegs),
        });
        this.renderSpecialOrderRail();
    }

    readPagerRulesFromInputs() {
        if (!this.bundleState) return null;
        const byGroupSizeInput = document.getElementById("award_pager_by_group_page_size");
        const ordW = document.getElementById("switch_pager_within_award_rank_forward");
        if (!byGroupSizeInput || !ordW) return null;

        const pagerRules = { ...(this.bundleState.pager_rules || this.getDefaultPagerRules()) };
        const gid = this.currentGroupId;
        pagerRules.award_order_forward = true;
        pagerRules.within_award_rank_forward = !!ordW.checked;
        pagerRules.deck_include = { ...this.getDefaultPagerRules().deck_include, ...this.readDeckIncludeFromDom() };
        const ordSegs = this.readDeckOrderSegmentsFromRail();
        pagerRules.deck_order_segments = ordSegs.length ? ordSegs : pagerRules.deck_order_segments;
        pagerRules.deck_special_units = this.deckSpecialUnitsFromOrderSegments(
            Array.isArray(pagerRules.deck_order_segments) && pagerRules.deck_order_segments.length
                ? pagerRules.deck_order_segments
                : this.buildDeckOrderSegmentsFromLegacyAnchorUnits(gid, pagerRules)
        );
        delete pagerRules.mode;
        const byGroup = { ...(pagerRules.by_group || {}) };
        const byGroupAward = { ...(pagerRules.by_group_award || {}) };

        const byGroupVal = parseInt(byGroupSizeInput.value, 10);
        if (Number.isFinite(byGroupVal) && byGroupVal > 0) {
            byGroup[gid] = byGroupVal;
        } else {
            delete byGroup[gid];
        }

        const [lvl1, lvl2, lvl3] = this.getPagerAwardLevelKeys();
        const l1Input = document.getElementById("award_pager_award_level_1_page_size");
        const l2Input = document.getElementById("award_pager_award_level_2_page_size");
        const l3Input = document.getElementById("award_pager_award_level_3_page_size");
        if (l1Input || l2Input || l3Input) {
            const nested = { ...(byGroupAward?.[gid] || {}) };
            const l1Val = l1Input ? parseInt(l1Input.value, 10) : NaN;
            const l2Val = l2Input ? parseInt(l2Input.value, 10) : NaN;
            const l3Val = l3Input ? parseInt(l3Input.value, 10) : NaN;

            if (Number.isFinite(l1Val) && l1Val > 0) nested[lvl1] = l1Val;
            else delete nested[lvl1];
            if (Number.isFinite(l2Val) && l2Val > 0) nested[lvl2] = l2Val;
            else delete nested[lvl2];
            if (Number.isFinite(l3Val) && l3Val > 0) nested[lvl3] = l3Val;
            else delete nested[lvl3];

            if (Object.keys(nested).length > 0) {
                byGroupAward[gid] = nested;
            } else {
                delete byGroupAward[gid];
            }
        }

        pagerRules.by_group = byGroup;
        pagerRules.by_group_award = byGroupAward;
        return pagerRules;
    }

    /** 将 bundle.display 同步到编排页上的展示开关（元素不存在则跳过）。 */
    applyPresentationDisplayToDom(display) {
        const d = this.normalizePresentationDisplay(display);
        const pairs = [
            ["switch_pres_show_member_names", d.show_member_names],
            ["switch_pres_show_coach", d.show_coach],
            ["switch_pres_show_school", d.show_school],
            ["switch_pres_show_team_name", d.show_team_name],
            ["switch_pres_show_team_name_en", d.show_team_name_en],
            ["switch_pres_show_team_id", d.show_team_id],
        ];
        pairs.forEach(([id, val]) => {
            const el = document.getElementById(id);
            if (!el) return;
            el.checked = !!val;
            if (window.csgSwitch && typeof window.csgSwitch.syncSwitchState === "function") {
                window.csgSwitch.syncSwitchState(el);
            }
        });
        const tgc = document.getElementById("award_pres_team_grid_columns");
        if (tgc && tgc.tagName === "SELECT") tgc.value = d.team_grid_columns;
        this.applyPresentationThemeToStage(d.award_pres_theme);
        this.syncPresentationAspectToolbarFromDisplay(d);
    }

    /** @param {string} [themeId] */
    applyPresentationThemeToStage(themeId) {
        const allowed = new Set(["mist", "night", "honor", "ruby", "ocean", "jade"]);
        const t = allowed.has(themeId) ? themeId : "honor";
        const stage = document.getElementById("award_presentation_stage");
        if (stage) stage.setAttribute("data-award-pres-theme", t);
    }

    /**
     * 编排左右栏 / 全屏名单条：与配置轨「专项+奖牌」同套色相（最快解题蓝、最佳女队紫等），非全屏皮肤背景。
     * @returns {string} 如 champion-school、first-blood、medal-gold；无则空串。
     */
    getDeckAwardVisualSuffix(page) {
        if (!page) return "";
        if (this.isChampionSchoolPresentationPage(page)) return "champion-school";
        const ak = String(page.award_key || "");
        if (ak === "最快解题奖") return "first-blood";
        if (ak === "最佳女队/女生奖") return "best-female";
        if (ak === "顽强拼搏奖") return "tenacity";
        if (ak === "金奖" || ak === "一等奖") return "medal-gold";
        if (ak === "银奖" || ak === "二等奖") return "medal-silver";
        if (ak === "铜奖" || ak === "三等奖") return "medal-bronze";
        if (ak === "冠亚季军") return "champion-misc";
        return "";
    }

    /** 写入 bundle.display 并落盘；用于全屏工具栏配色。 */
    setPresentationTheme(themeId) {
        const d = this.normalizePresentationDisplay({
            ...(this.bundleState?.display || {}),
            award_pres_theme: themeId,
        });
        if (this.bundleState) {
            this.bundleState.display = d;
            this.applyPresentationThemeToStage(d.award_pres_theme);
            this.saveAwardBundle();
        } else {
            this.applyPresentationThemeToStage(themeId);
        }
    }

    syncPresentationAspectToolbarFromDisplay(display) {
        const d = this.normalizePresentationDisplay(display || {});
        const mode = d.aspect_mode || "16:9";
        const wEl = document.getElementById("award_pres_aspect_w");
        const hEl = document.getElementById("award_pres_aspect_h");
        if (!wEl || !hEl) return;
        if (mode === "fullscreen") {
            wEl.value = "";
            hEl.value = "";
            wEl.placeholder = "—";
            hEl.placeholder = "FS";
            return;
        }
        wEl.placeholder = "";
        hEl.placeholder = "";
        const p = AwardDeckPage.parseAspectModeToRatio(mode);
        const w = p ? p.w : 16;
        const h = p ? p.h : 9;
        wEl.value = String(w);
        hEl.value = String(h);
    }

    _maybeAutoPresentationAspectFromViewport() {
        if (!this.bundleState) return;
        const disp = this.normalizePresentationDisplay(this.bundleState.display);
        if (disp.pres_aspect_user) {
            this.syncPresentationAspectToolbarFromDisplay(disp);
            return;
        }
        const viewport = document.querySelector("#award_presentation_modal .award-presentation-viewport")
            || document.querySelector(".award-presentation-viewport");
        if (!viewport) return;
        const Vw = Math.max(1, viewport.clientWidth);
        const Vh = Math.max(1, viewport.clientHeight);
        const suggested = AwardDeckPage.suggestAspectModeFromViewport(Vw, Vh);
        this.bundleState.display = this.normalizePresentationDisplay({
            ...disp,
            aspect_mode: suggested,
            ratio: suggested,
            pres_aspect_user: false,
        });
        this.syncPresentationAspectToolbarFromDisplay(this.bundleState.display);
    }

    _commitPresentationAspectMode(mode, opts) {
        const opt = opts && typeof opts === "object" ? opts : {};
        const markUser = opt.markUser !== false;
        if (!this.bundleState) return;
        const base = this.normalizePresentationDisplay(this.bundleState.display);
        const next = this.normalizePresentationDisplay({
            ...base,
            aspect_mode: mode,
            pres_aspect_user: markUser ? true : base.pres_aspect_user,
        });
        this.bundleState.display = next;
        this.syncPresentationAspectToolbarFromDisplay(next);
        this.saveAwardBundle();
        requestAnimationFrame(() => this.applyPresentationSlideLayout());
    }

    readPresentationAspectFromToolbarInputs() {
        const wEl = document.getElementById("award_pres_aspect_w");
        const hEl = document.getElementById("award_pres_aspect_h");
        const wStr = `${wEl?.value ?? ""}`.trim();
        const hStr = `${hEl?.value ?? ""}`.trim();
        const wU = wStr.toUpperCase();
        if (wU === "FS" || wU === "FULL" || (wStr === "" && hStr === "")) {
            return "fullscreen";
        }
        const w = parseInt(wStr, 10);
        const h = parseInt(hStr, 10);
        if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) {
            return null;
        }
        return `${Math.min(64, Math.max(1, w))}:${Math.min(64, Math.max(1, h))}`;
    }

    commitPresentationAspectFromToolbarInputs() {
        const mode = this.readPresentationAspectFromToolbarInputs();
        if (!mode) return;
        this._commitPresentationAspectMode(mode, { markUser: true });
    }

    stepPresentationAspect(delta) {
        const ladder = AwardDeckPage.getAspectPresetLadder();
        if (!this.bundleState || !delta) return;
        const d = this.normalizePresentationDisplay(this.bundleState.display);
        let idx = ladder.indexOf(d.aspect_mode);
        if (idx < 0) {
            const p = AwardDeckPage.parseAspectModeToRatio(d.aspect_mode);
            const vr = p ? p.w / p.h : 16 / 9;
            idx = AwardDeckPage.nearestAspectLadderIndexForRatio(vr);
        }
        idx = Math.max(0, Math.min(ladder.length - 1, idx + delta));
        this._commitPresentationAspectMode(ladder[idx], { markUser: true });
    }

    presentationZoomStep(direction) {
        if (!this.bundleState) return;
        const d = this.normalizePresentationDisplay(this.bundleState.display);
        const factor = direction > 0 ? 1.09 : 1 / 1.09;
        let z = (typeof d.pres_stage_zoom === "number" && Number.isFinite(d.pres_stage_zoom))
            ? d.pres_stage_zoom
            : 1;
        z *= factor;
        this.bundleState.display = this.normalizePresentationDisplay({ ...d, pres_stage_zoom: z });
        this.saveAwardBundle();
        requestAnimationFrame(() => this.applyPresentationSlideLayout());
    }

    /**
     * 幻灯壳 CSS 缩放：放大上限为贴齐视口一边；缩小有下限，避免信息区过小。
     */
    _applyPresentationShellUserZoom(viewport, shell) {
        if (!viewport || !shell) return;
        const disp = this.normalizePresentationDisplay(this.bundleState?.display || {});
        let z = disp.pres_stage_zoom;
        if (typeof z !== "number" || !Number.isFinite(z) || z <= 0) {
            z = 1;
        }
        const Vw = Math.max(0, viewport.clientWidth);
        const Vh = Math.max(0, viewport.clientHeight);
        const sw = Math.max(1, shell.offsetWidth);
        const sh = Math.max(1, shell.offsetHeight);
        const maxZ = Math.min(Vw / sw, Vh / sh) * 0.998;
        const minZ = Math.min(0.78, Math.max(0.52, maxZ * 0.58));
        const clamped = Math.max(minZ, Math.min(maxZ, z));
        if (Math.abs(clamped - z) > 1e-4 && this.bundleState) {
            this.bundleState.display = this.normalizePresentationDisplay({
                ...disp,
                pres_stage_zoom: clamped,
            });
        }
        shell.style.setProperty("--pres-shell-zoom", String(clamped));
    }

    /**
     * 名单在 flex 子项内裁剪时，card 的 scrollHeight 往往仍等于 clientHeight，导致「永远不认为溢出」。
     * 以 #award_presentation_list 与标题行的 scroll 尺寸为准，才能驱动 --pres-type-scale / --pres-fit-scale。
     * @param {HTMLElement} card .award-presentation-card
     */
    _presentationMeasurePresLayoutFits(card) {
        if (!card) return true;
        const tol = 8;
        const list = card.querySelector("#award_presentation_list");
        const titleRow = card.querySelector("#award_presentation_title_row");
        if (list && list.clientHeight > 2) {
            if (list.scrollHeight > list.clientHeight + tol) return false;
            if (list.scrollWidth > list.clientWidth + tol) return false;
        }
        if (titleRow && titleRow.clientWidth > 2 && titleRow.scrollWidth > titleRow.clientWidth + tol) {
            return false;
        }
        return true;
    }

    /**
     * 二分求最大 --pres-type-scale，使标题行 + 名单区不溢出（调用前须已将 --pres-fit-scale 置 1）。
     */
    _presentationMaxTypeScale(slide, card, minScale, maxScale) {
        if (!slide || !card) return minScale;
        const cap = Math.min(Math.max(maxScale, minScale), 2.35);
        slide.style.setProperty("--pres-type-scale", String(cap));
        void card.offsetHeight;
        if (this._presentationMeasurePresLayoutFits(card)) {
            return cap;
        }
        slide.style.setProperty("--pres-type-scale", String(minScale));
        void card.offsetHeight;
        if (!this._presentationMeasurePresLayoutFits(card)) {
            return minScale;
        }
        let lo = minScale;
        let hi = cap;
        for (let i = 0; i < 26; i++) {
            const mid = (lo + hi) / 2;
            slide.style.setProperty("--pres-type-scale", String(mid));
            void card.offsetHeight;
            if (this._presentationMeasurePresLayoutFits(card)) {
                lo = mid;
            } else {
                hi = mid;
            }
        }
        return lo;
    }

    /**
     * 按配置固定 1/2/3 列，二分求最大 --pres-type-scale 使整块卡片不溢出。
     * 冠/亚/季军学校每页仅 1 队：不做多列列表，用单列居中壳（见 award-pres-list--solo-champion）。
     * @returns {number} 最终列数
     */
    choosePresentationColumnsAndTypeScale(disp, slide, card, listEl, slideW, slideH, rowCount, soloChampionSchool) {
        const rows = Math.max(1, rowCount | 0);
        if (soloChampionSchool) {
            listEl.className = "award-pres-list award-pres-list--solo-champion award-pres-cols-1";
            listEl.style.removeProperty("--pres-list-rows");
            const minScale = 0.24;
            /* 单列居中信息少：略抬高默认字号上限，仍由 fit + squeeze 保证不溢出 */
            const maxScale = 1.38;
            const sm = this._presentationMaxTypeScale(slide, card, minScale, maxScale);
            const damped = Math.max(minScale, Math.min(sm * 0.94, 1.2));
            slide.style.setProperty("--pres-type-scale", String(damped));
            void card.offsetHeight;
            return 1;
        }
        let cols = parseInt(String(disp.team_grid_columns || "2"), 10);
        if (!Number.isFinite(cols) || cols < 1 || cols > 3) {
            cols = 2;
        }
        listEl.className = `award-pres-list award-pres-list--smart award-pres-cols-${cols}`;
        listEl.style.removeProperty("--pres-list-rows");
        const maxScale = cols >= 3 ? 1.06 : 1.18;
        const minScale = cols >= 3 ? 0.22 : 0.26;
        const sm = this._presentationMaxTypeScale(slide, card, minScale, maxScale);
        const comfort = cols >= 3 ? 0.82 : 0.86;
        const damped = Math.max(minScale, Math.min(sm * comfort, 1.02));
        slide.style.setProperty("--pres-type-scale", String(damped));
        void card.offsetHeight;
        return cols;
    }

    /**
     * 投屏名单列数（固定比例下确定性规则；fullscreen 尽力而为）。
     * @param {object} disp normalizePresentationDisplay 结果
     */
    resolvePresentationGridColumns(disp, rowCount, slideW, slideH) {
        const mode = String(disp.team_grid_columns || "2");
        if (mode === "1") return 1;
        if (mode === "2") return 2;
        if (mode === "3") return 3;
        return 2;
    }

    /**
     * 视口内 contain 计算幻灯像素尺寸（固定比例或全视口）。
     */
    computePresentationSlideSize(stageW, stageH, aspectMode) {
        const W = Math.max(0, stageW);
        const H = Math.max(0, stageH);
        const mode = aspectMode || "16:9";
        if (mode === "fullscreen") {
            return { sw: W, sh: H };
        }
        const segs = String(mode).split(":");
        const aw = Number.parseFloat(segs[0]) || 16;
        const ah = Number.parseFloat(segs[1]) || 9;
        const scale = Math.min(W / aw, H / ah);
        return {
            sw: Math.max(160, Math.floor(scale * aw)),
            sh: Math.max(120, Math.floor(scale * ah)),
        };
    }

    /**
     * 按所选画幅在容器内以 contain 定标幻灯区域；智能选列 + 二分求最大 --pres-type-scale 铺满版面。
     */
    applyPresentationSlideLayout() {
        const viewport = document.querySelector(".award-presentation-viewport");
        const shell = document.getElementById("award_presentation_slide_shell");
        const slide = document.getElementById("award_presentation_slide");
        const listEl = document.getElementById("award_presentation_list");
        const card = slide?.querySelector(".award-presentation-card");
        if (!viewport || !shell || !slide || !this.presentationPages?.length) return;
        const page = this.presentationPages[this.presentationIndex];
        if (!page) return;
        this._presListDeckVisual = this.getDeckAwardVisualSuffix(page);
        const disp = this.normalizePresentationDisplay(this.bundleState?.display || {});
        const mode = disp.aspect_mode || "16:9";
        const Vw = Math.max(0, viewport.clientWidth);
        const Vh = Math.max(0, viewport.clientHeight);
        slide.dataset.presAspect = mode;
        let vw = Vw;
        let vh = Vh;
        if (mode === "fullscreen") {
            shell.classList.add("award-presentation-slide-shell--fill");
            shell.style.width = "";
            shell.style.height = "";
        } else {
            shell.classList.remove("award-presentation-slide-shell--fill");
            const { sw, sh } = this.computePresentationSlideSize(Vw, Vh, mode);
            shell.style.width = `${sw}px`;
            shell.style.height = `${sh}px`;
            vw = sw;
            vh = sh;
        }
        slide.style.setProperty("--pres-type-scale", "1");
        /* 必须先复位 fit，再二分 type；否则上一页的 --pres-fit-scale 会让「是否装得下」误判为 true */
        slide.style.setProperty("--pres-fit-scale", "1");
        const fs = disp.font_scale && disp.font_scale > 0 ? disp.font_scale : 1;
        slide.style.setProperty("--pres-font-scale", String(fs));
        if (listEl && card && listEl.innerHTML.trim()) {
            const soloCs = this.isChampionSchoolPresentationPage(page) && page.rows.length === 1;
            this.choosePresentationColumnsAndTypeScale(disp, slide, card, listEl, vw, vh, page.rows.length, soloCs);
        } else {
            slide.style.setProperty("--pres-type-scale", "1");
        }
        this._syncPresentationListDeckVisualClass(listEl);
        /* 标题行影响卡片总高度，先收敛横向再压整体缩放 */
        this.fitPresentationTitleRow();
        this.fitPresentationScaleToViewport();
        this._applyPresentationShellUserZoom(viewport, shell);
        if (listEl) {
            /* 先多轮收敛 fit，最后再跑一次跑马灯，避免中途 refresh 拆掉 wrapper 造成动画重置/抖动 */
            requestAnimationFrame(() => {
                this.fitPresentationTitleRow();
                this.fitPresentationScaleToViewport();
                this._applyPresentationShellUserZoom(viewport, shell);
                requestAnimationFrame(() => {
                    this.fitPresentationTitleRow();
                    this.fitPresentationScaleToViewport();
                    this._applyPresentationShellUserZoom(viewport, shell);
                    requestAnimationFrame(() => {
                        this.fitPresentationTitleRow();
                        this.fitPresentationScaleToViewport();
                        this._applyPresentationShellUserZoom(viewport, shell);
                        this._refreshAwardPresentationMarquees(listEl);
                    });
                });
            });
        }
    }

    /**
     * 标题行：奖项名 + x/y 与右侧 group 同排；超宽时二分缩小 --award-pres-head-scale（标题、页码、group 同步）。
     */
    fitPresentationTitleRow() {
        const row = document.getElementById("award_presentation_title_row");
        if (!row || row.clientWidth < 8) return;
        row.style.setProperty("--award-pres-head-scale", "1");
        void row.offsetWidth;
        const fudge = 2;
        const fits = () => row.scrollWidth <= row.clientWidth + fudge;
        if (fits()) return;
        const minH = 0.42;
        let lo = minH;
        let hi = 1;
        for (let k = 0; k < 24; k++) {
            const mid = (lo + hi) / 2;
            row.style.setProperty("--award-pres-head-scale", String(mid));
            void row.offsetWidth;
            if (fits()) lo = mid;
            else hi = mid;
        }
        row.style.setProperty("--award-pres-head-scale", String(Math.max(minH, lo)));
    }

    /**
     * 在禁止滚动条的前提下，用 --pres-fit-scale 二分求**最大**可行整体缩放，使卡片（标题+名单）不溢出信息区。
     * 此前 ok 时误更新 hi 导致常停在 1 无法缩小；任意画幅比例均依赖 scroll 实测。
     */
    fitPresentationScaleToViewport() {
        const slide = document.getElementById("award_presentation_slide");
        const card = slide?.querySelector(".award-presentation-card");
        if (!slide || !card) return;
        const fits = () => this._presentationMeasurePresLayoutFits(card);
        const minFit = 0.08;
        slide.style.setProperty("--pres-fit-scale", "1");
        void card.offsetHeight;
        if (fits()) {
            this._squeezePresentationTypeScaleIfOverflow(slide, card);
            return;
        }
        let lo = minFit;
        let hi = 1;
        for (let i = 0; i < 36; i++) {
            const mid = (lo + hi) / 2;
            slide.style.setProperty("--pres-fit-scale", String(mid));
            void card.offsetHeight;
            if (fits()) lo = mid;
            else hi = mid;
        }
        slide.style.setProperty("--pres-fit-scale", String(Math.max(minFit, lo)));
        void card.offsetHeight;
        this._squeezePresentationTypeScaleIfOverflow(slide, card);
        void card.offsetHeight;
        if (!fits()) {
            let fit = Math.max(minFit, parseFloat(slide.style.getPropertyValue("--pres-fit-scale")) || minFit);
            for (let j = 0; j < 28 && !fits(); j++) {
                fit = Math.max(minFit, fit * 0.9);
                slide.style.setProperty("--pres-fit-scale", String(fit));
                void card.offsetHeight;
                this._squeezePresentationTypeScaleIfOverflow(slide, card);
                void card.offsetHeight;
            }
        }
    }

    /**
     * fit 之后若仍溢出，继续压低 --pres-type-scale（与 rank 投屏一致：禁止滚动条，只靠缩放）。
     */
    _squeezePresentationTypeScaleIfOverflow(slide, card) {
        if (!slide || !card) return;
        const minTs = 0.08;
        let ts = parseFloat(slide.style.getPropertyValue("--pres-type-scale"));
        if (!Number.isFinite(ts) || ts <= 0) {
            ts = 1;
        }
        for (let i = 0; i < 64; i++) {
            void card.offsetHeight;
            if (this._presentationMeasurePresLayoutFits(card)) {
                return;
            }
            ts = Math.max(minTs, ts * 0.94);
            slide.style.setProperty("--pres-type-scale", String(ts));
        }
    }

    _refreshAwardPresentationMarquees(listEl) {
        if (!listEl) return;
        listEl.querySelectorAll('[data-award-pres-marquee="1"]').forEach((el) => {
            const attr = el.getAttribute("data-award-pres-plain");
            let plain = "";
            if (attr != null && attr !== "") {
                try {
                    plain = decodeURIComponent(attr);
                } catch (err) {
                    plain = (el.textContent || "").trim();
                }
            } else {
                plain = (el.textContent || "").trim();
            }
            awardPresEnableMarqueeIfNeeded(el, plain, { marqueeAggressive: true });
        });
    }

    _lockAwardPresentationDocumentScroll() {
        if (this._awardPresDocScrollLocked) return;
        this._awardPresDocScrollLocked = true;
        this._awardPresPrevHtmlOverflow = document.documentElement.style.overflow;
        this._awardPresPrevBodyOverflow = document.body.style.overflow;
        document.documentElement.style.overflow = "hidden";
        document.body.style.overflow = "hidden";
        document.documentElement.classList.add("award-presentation-doc-lock");
        document.body.classList.add("award-presentation-doc-lock");
    }

    _unlockAwardPresentationDocumentScroll() {
        if (!this._awardPresDocScrollLocked) return;
        this._awardPresDocScrollLocked = false;
        document.documentElement.style.overflow = this._awardPresPrevHtmlOverflow || "";
        document.body.style.overflow = this._awardPresPrevBodyOverflow || "";
        document.documentElement.classList.remove("award-presentation-doc-lock");
        document.body.classList.remove("award-presentation-doc-lock");
    }

    _clearAwardPresentationToolbarTimer() {
        if (this._presentationToolbarHideTimer) {
            clearTimeout(this._presentationToolbarHideTimer);
            this._presentationToolbarHideTimer = null;
        }
    }

    _scheduleAwardPresentationToolbarHide() {
        this._clearAwardPresentationToolbarTimer();
        this._presentationToolbarHideTimer = setTimeout(() => {
            const t = document.querySelector(".award-presentation-toolbar--overlay");
            if (t) t.classList.add("award-presentation-toolbar--hidden");
            this._presentationToolbarHideTimer = null;
        }, 900);
    }

    showAwardPresentationToolbar() {
        const t = document.querySelector(".award-presentation-toolbar--overlay");
        if (t) t.classList.remove("award-presentation-toolbar--hidden");
        this._clearAwardPresentationToolbarTimer();
    }

    /** 进入全屏时默认收起；仅悬停顶区时再展开 */
    hideAwardPresentationToolbarImmediate() {
        this._clearAwardPresentationToolbarTimer();
        const t = document.querySelector(".award-presentation-toolbar--overlay");
        if (t) t.classList.add("award-presentation-toolbar--hidden");
    }

    _attachAwardPresentationUi() {
        this._detachAwardPresentationUi();
        const stage = document.getElementById("award_presentation_stage");
        const toolbar = stage?.querySelector(".award-presentation-toolbar--overlay");
        if (!stage) return;
        const ac = new AbortController();
        this._awardPresentationUiAbort = ac;
        const inRevealZone = (e) => {
            const r = stage.getBoundingClientRect();
            const ry = (e.clientY - r.top) / Math.max(r.height, 1);
            return ry < 0.14 || !!(toolbar && toolbar.contains(e.target));
        };
        stage.addEventListener("mousemove", (e) => {
            if (inRevealZone(e)) {
                this.showAwardPresentationToolbar();
            } else {
                this._scheduleAwardPresentationToolbarHide();
            }
        }, { signal: ac.signal });
        stage.addEventListener("touchstart", (e) => {
            if (inRevealZone(e)) this.showAwardPresentationToolbar();
            else this._scheduleAwardPresentationToolbarHide();
        }, { signal: ac.signal, passive: true });
        if (toolbar) {
            toolbar.addEventListener("mouseenter", () => this._clearAwardPresentationToolbarTimer(), { signal: ac.signal });
            toolbar.addEventListener("mouseleave", () => this._scheduleAwardPresentationToolbarHide(), { signal: ac.signal });
        }
    }

    _detachAwardPresentationUi() {
        this._clearAwardPresentationToolbarTimer();
        if (this._awardPresentationUiAbort) {
            this._awardPresentationUiAbort.abort();
            this._awardPresentationUiAbort = null;
        }
    }

    openPresentation() {
        this.presentationPages = this.buildPresentationPages();
        if (!this.presentationPages.length) {
            alerty.error("暂无可展示的获奖编排，请先确认榜单并生成编排。");
            return;
        }
        this.presentationIndex = 0;
        const disp = this.normalizePresentationDisplay(this.bundleState?.display || {});
        this.applyPresentationThemeToStage(disp.award_pres_theme);
        const modal = document.getElementById("award_presentation_modal");
        if (modal) modal.style.display = "block";
        this._lockAwardPresentationDocumentScroll();
        void modal?.offsetHeight;
        this._maybeAutoPresentationAspectFromViewport();
        this.renderPresentation();
        this.hideAwardPresentationToolbarImmediate();
        requestAnimationFrame(() => {
            this.applyPresentationSlideLayout();
            requestAnimationFrame(() => {
                this.applyPresentationSlideLayout();
                this.hideAwardPresentationToolbarImmediate();
            });
        });
        this._attachAwardPresentationUi();
    }

    closePresentation() {
        this._detachAwardPresentationUi();
        this._unlockAwardPresentationDocumentScroll();
        const tb = document.querySelector(".award-presentation-toolbar--overlay");
        if (tb) tb.classList.remove("award-presentation-toolbar--hidden");
        const modal = document.getElementById("award_presentation_modal");
        if (modal) modal.style.display = "none";
    }

    togglePresentationFullscreen() {
        const stage = document.getElementById("award_presentation_stage");
        if (!stage) return;
        if (!document.fullscreenElement) {
            stage.requestFullscreen?.();
        } else {
            document.exitFullscreen?.();
        }
    }

    changePresentationPage(delta) {
        if (!this.presentationPages.length) return;
        const n = this.presentationPages.length;
        const next = this.presentationIndex + delta;
        if (next < 0 || next >= n) return;
        this.presentationIndex = next;
        this.renderPresentation();
    }

    /** 首末页不循环：禁用上一页 / 下一页（与键盘一致）。 */
    syncPresentationNavButtons() {
        const n = this.presentationPages?.length | 0;
        const prevBtn = document.getElementById("award_presentation_prev");
        const nextBtn = document.getElementById("award_presentation_next");
        const i = this.presentationIndex | 0;
        const atFirst = n <= 0 || i <= 0;
        const atLast = n <= 0 || i >= n - 1;
        if (prevBtn) prevBtn.disabled = atFirst;
        if (nextBtn) nextBtn.disabled = atLast;
    }

    /**
     * 全屏展示单行 HTML（显隐由 bundle.display 控制；无内容时降级为一行占位）。
     * @param {object} item awardData 项
     * @param {object} disp normalizePresentationDisplay 结果
     * @param {{ isChampionSchoolPage?: boolean, soloChampionCentered?: boolean, presentationGroupId?: string }} [pageMeta]
     */
    buildPresentationRowHtml(item, disp, pageMeta) {
        const meta = pageMeta && typeof pageMeta === "object" ? pageMeta : {};
        const isChampionSchoolPage = !!meta.isChampionSchoolPage;
        const soloChampionCentered = !!meta.soloChampionCentered;
        const presGid = meta.presentationGroupId != null ? String(meta.presentationGroupId) : "";
        const team = item.team || {};
        const rankRaw = this.getAwardDisplayRankInGroup(item, presGid);
        const rank = rankRaw != null && rankRaw !== "" ? rankRaw : "—";
        const rankEsc = RankToolEscapeHtml(String(rank));
        const enc = (s) => encodeURIComponent(s == null ? "" : String(s));

        const nameEnRaw = disp.show_team_name_en ? `${team.name_en || ""}`.trim() : "";
        const demotedCls = isChampionSchoolPage ? " award-pres-primary--demoted" : "";
        const demotedEnCls = isChampionSchoolPage ? " award-pres-primary-en--demoted" : "";

        let namesHtml = "";
        if (disp.show_team_name) {
            const t = team.name != null && `${team.name}`.trim() !== "" ? String(team.name) : "—";
            namesHtml += `<div class="award-pres-primary award-pres-marquee-host${demotedCls}" data-award-pres-marquee="1" data-award-pres-plain="${enc(t)}">${RankToolEscapeHtml(t)}</div>`;
        }
        if (disp.show_team_name_en && nameEnRaw) {
            namesHtml += `<div class="award-pres-primary-en award-pres-marquee-host${demotedEnCls}" data-award-pres-marquee="1" data-award-pres-plain="${enc(nameEnRaw)}">${RankToolEscapeHtml(nameEnRaw)}</div>`;
        }

        const schoolStr = `${team.school || ""}`.trim();
        const schoolOk = schoolStr && schoolStr !== "-";
        const forceSchool = isChampionSchoolPage && schoolOk;
        const showSchoolLine = forceSchool || disp.show_school;

        let schoolHtml = "";
        if (showSchoolLine && schoolOk) {
            const leadCls = isChampionSchoolPage ? " award-pres-school-line--lead" : "";
            schoolHtml = `<div class="award-pres-school-line${leadCls}"><span class="award-pres-school-txt award-pres-marquee-host" data-award-pres-marquee="1" data-award-pres-plain="${enc(schoolStr)}">${RankToolEscapeHtml(schoolStr)}</span></div>`;
        }

        const lines = [];
        if (disp.show_member_names) {
            const m = `${team.tmember || ""}`.trim();
            if (m) {
                lines.push(`<div class="award-pres-detail-line award-pres-detail-line--members"><i class="bi bi-people-fill award-pres-line-ico" aria-hidden="true"></i><span class="award-pres-detail-txt award-pres-marquee-host" data-award-pres-marquee="1" data-award-pres-plain="${enc(m)}">${RankToolEscapeHtml(m)}</span></div>`);
            }
        }
        if (disp.show_coach) {
            const c = `${team.coach || ""}`.trim();
            if (c) {
                lines.push(`<div class="award-pres-detail-line award-pres-detail-line--coach"><i class="bi bi-person-fill award-pres-line-ico" aria-hidden="true"></i><span class="award-pres-detail-txt award-pres-marquee-host" data-award-pres-marquee="1" data-award-pres-plain="${enc(c)}">${RankToolEscapeHtml(c)}</span></div>`);
            }
        }
        const detailsHtml = lines.length ? `<div class="award-pres-details">${lines.join("")}</div>` : "";

        const fbLetters = `${item._pres_fb_problem_letters || ""}`.trim();
        const escL = fbLetters ? RankToolEscapeHtml(fbLetters) : "";
        /* 最快解题：题号放在名次列下方，更醒目；正文区不再重复题号行 */
        const fbUnderRankHtml = fbLetters
            ? `<div class="award-pres-fb-under-rank">` +
                `<span class="award-pres-fb-letters" aria-label="题号 / Problem">${escL}</span>` +
                `</div>`
            : "";

        let bodyBlock = "";
        const stackParts = isChampionSchoolPage
            ? [schoolHtml, namesHtml, detailsHtml]
            : [namesHtml, schoolHtml, detailsHtml];
        const stackInner = stackParts.filter(Boolean).join("");
        if (stackInner) {
            bodyBlock = `<div class="award-pres-stack">${stackInner}</div>`;
        }
        if (!bodyBlock.trim()) {
            if (forceSchool) {
                bodyBlock = `<div class="award-pres-stack">${schoolHtml}</div>`;
            }
            if (!bodyBlock.trim()) {
                const fbRaw = `${team.team_id || team.name || "—"}`;
                bodyBlock = `<div class="award-pres-stack"><div class="award-pres-primary award-pres-primary--fallback award-pres-marquee-host" data-award-pres-marquee="1" data-award-pres-plain="${enc(fbRaw)}">${RankToolEscapeHtml(fbRaw)}</div></div>`;
            }
        }

        const tid = `${team.team_id || ""}`.trim();
        const asideBlock = disp.show_team_id && tid
            ? `<div class="award-pres-aside"><span class="award-pres-teamid">${RankToolEscapeHtml(tid)}</span></div>`
            : "";

        const rowMods = ["award-pres-row"];
        if (!disp.show_team_id || !tid) rowMods.push("award-pres-row--no-aside");
        if (isChampionSchoolPage) {
            rowMods.push("award-pres-row--champion-school");
        }
        if (showSchoolLine && schoolOk) {
            rowMods.push("award-pres-row--has-school");
        }
        if (lines.length) {
            rowMods.push("award-pres-row--has-details");
        }
        if (fbLetters) {
            rowMods.push("award-pres-row--has-fb-problem");
        }
        if (disp.show_team_name_en && nameEnRaw) {
            rowMods.push("award-pres-row--has-en");
        }
        if (soloChampionCentered) {
            rowMods.push("award-pres-row--solo-champion-centered");
        }

        return `
            <div class="${rowMods.join(" ")}">
                <div class="award-pres-row-main">
                    <div class="award-pres-rank-col">
                        <div class="award-pres-rank" aria-label="rank"><span class="award-pres-rank-inner">#${rankEsc}</span></div>
                        ${fbUnderRankHtml}
                    </div>
                    <div class="award-pres-body">${bodyBlock}</div>
                </div>
                ${asideBlock}
            </div>
        `;
    }

    /**
     * 全屏头图：奖项名独占主标题；多赛事归属时单独展示 group（长名可换行）；单归属不展示 group。
     * @param {object} deckPage bundle.deck 中的页对象
     * @returns {{ headline: string, groupLine: string }}
     */
    getPresentationHeadParts(deckPage) {
        const groups = this.getGroupTargets();
        const multiAffiliation = groups.length > 1;
        const gid = String(deckPage?.group_id || "__global__");
        const g = groups.find((x) => String(x.group_id) === gid);
        const gname = `${g?.group_name || ""}`.trim();
        const raw = `${deckPage?.title || deckPage?.award_key || "获奖名单"}`.trim();
        let headline = raw;
        if (gname) {
            const sp = `${gname} `;
            const spw = `${gname}\u3000`;
            if (raw.startsWith(sp)) {
                headline = raw.slice(sp.length).trim();
            } else if (raw.startsWith(spw)) {
                headline = raw.slice(spw.length).trim();
            }
            if (!headline) {
                headline = `${deckPage?.award_key || ""}`.trim() || raw;
            }
        }
        const groupLine = multiAffiliation && gname ? gname : "";
        return { headline, groupLine };
    }

    /**
     * 二/三列且最后一行不满时，将末尾「零头」行包入横向居中的容器，与满行卡片同宽。
     * @param {HTMLElement} listEl
     * @param {object} page
     */
    _syncPresentationTailCluster(listEl, page) {
        if (!listEl || !page) return;
        listEl.querySelectorAll(":scope > .award-pres-tail-cluster").forEach((w) => {
            const parent = w.parentNode;
            if (!parent) return;
            while (w.firstChild) {
                parent.insertBefore(w.firstChild, w);
            }
            w.remove();
        });
        const isCs = this.isChampionSchoolPresentationPage(page);
        const soloCs = isCs && page.rows.length === 1;
        if (soloCs) return;
        const disp = this.normalizePresentationDisplay(this.bundleState?.display || {});
        let cols = parseInt(String(disp.team_grid_columns || "2"), 10);
        if (!Number.isFinite(cols) || cols < 1 || cols > 3) {
            cols = 2;
        }
        const n = page.rows.length;
        if (cols <= 1 || n <= 0) return;
        const rem = n % cols;
        if (rem === 0) return;
        const rows = [...listEl.children].filter((el) => el.classList && el.classList.contains("award-pres-row"));
        if (rows.length !== n) return;
        const cluster = document.createElement("div");
        cluster.className = "award-pres-tail-cluster";
        cluster.style.setProperty("--pres-tail-cols", String(cols));
        const tailRows = rows.slice(-rem);
        tailRows[0].before(cluster);
        tailRows.forEach((r) => cluster.appendChild(r));
    }

    renderPresentation() {
        if (!this.presentationPages.length) return;
        const page = this.presentationPages[this.presentationIndex];
        const disp = this.normalizePresentationDisplay(this.bundleState?.display || {});
        const pageInfo = document.getElementById("award_presentation_page_info");
        const titleEl = document.getElementById("award_presentation_title");
        const groupEl = document.getElementById("award_presentation_group");
        const subtitleEl = document.getElementById("award_presentation_subtitle");
        const listEl = document.getElementById("award_presentation_list");
        if (pageInfo) pageInfo.textContent = `${this.presentationIndex + 1} / ${this.presentationPages.length}`;
        if (titleEl) {
            const hl = page.headline != null && `${page.headline}`.trim() !== "" ? page.headline : page.title;
            titleEl.textContent = hl || "";
            const ak = `${page.award_key || ""}`.trim();
            const medalSet = new Set(["金奖", "银奖", "铜奖", "一等奖", "二等奖", "三等奖"]);
            titleEl.classList.toggle("award-presentation-title--medal", medalSet.has(ak));
        }
        const fracEl = document.getElementById("award_presentation_award_fraction");
        if (fracEl) {
            const t = Math.max(1, page.awardPageTotal | 0);
            const x = Math.min(Math.max(1, page.awardPageNum | 0), t);
            fracEl.textContent = `${x}\u2009/\u2009${t}`;
        }
        if (groupEl) {
            const gl = page.groupLine != null ? page.groupLine : "";
            if (gl) {
                groupEl.textContent = gl;
                groupEl.removeAttribute("hidden");
            } else {
                groupEl.textContent = "";
                groupEl.setAttribute("hidden", "");
            }
        }
        if (subtitleEl) subtitleEl.textContent = page.subtitle || "";
        if (!listEl) return;

        const n = page.rows.length;
        listEl.style.setProperty("--award-pres-rows", String(Math.max(n, 1)));
        listEl.className = "award-pres-list";
        const isCs = this.isChampionSchoolPresentationPage(page);
        const soloCs = isCs && n === 1;
        const presGid = String(page.group_id || this.currentGroupId || "__global__");
        const pageMeta = { isChampionSchoolPage: isCs, soloChampionCentered: soloCs, presentationGroupId: presGid };
        const rowsHtml = page.rows.map((item) => this.buildPresentationRowHtml(item, disp, pageMeta)).join("");
        listEl.innerHTML = soloCs
            ? `<div class="award-pres-solo-champion-wrap">${rowsHtml}</div>`
            : rowsHtml;
        if (!soloCs) {
            this._syncPresentationTailCluster(listEl, page);
        }

        requestAnimationFrame(() => {
            this.applyPresentationSlideLayout();
            requestAnimationFrame(() => this.applyPresentationSlideLayout());
        });
        this.syncPresentationNavButtons();
    }

    /**
     * 按 deck 顺序，将连续相同 award_key 的页打成一段，得到每页在该奖内的 x/y。
     */
    computeAwardPageSlots(deckPages) {
        const n = deckPages.length;
        const slots = new Array(n);
        let i = 0;
        while (i < n) {
            const p0 = deckPages[i] || {};
            const key = String(p0.award_slot_key || p0.award_key || p0.title || "");
            let j = i + 1;
            while (j < n) {
                const pj = deckPages[j] || {};
                const k2 = String(pj.award_slot_key || pj.award_key || pj.title || "");
                if (k2 !== key) break;
                j++;
            }
            const total = j - i;
            for (let k = 0; k < total; k++) {
                slots[i + k] = { awardPageNum: k + 1, awardPageTotal: total };
            }
            i = j;
        }
        return slots;
    }

    buildPresentationPages() {
        return this.buildPresentationPagesForGroup(this.currentGroupId || "__global__");
    }

    /**
     * 与 buildPresentationPages 相同逻辑，但指定赛事归属（用于打包下载等多 group 场景）。
     * @param {string} groupId
     */
    buildPresentationPagesForGroup(groupId) {
        const bundle = this.bundleState || this.collectAwardBundle();
        let deck = Array.isArray(bundle?.deck) && bundle.deck.length > 0
            ? bundle.deck.slice()
            : this.getAwardDeckFromCurrentData(bundle?.pager_rules || {});
        const gid = String(groupId || "__global__");
        deck = deck.filter((p) => String(p.group_id || "__global__") === gid);
        const slots = this.computeAwardPageSlots(deck);
        const pagerRules = bundle?.pager_rules || {};
        return deck.map((page, idx) => {
            const ids = page.team_ids || [];
            const teamRows = ids.map((tid, rowIdx) => {
                const row = this.teamIdMap[tid];
                if (!row) return null;
                if (String(page.award_key || "") !== "最快解题奖") return row;
                const letters = this._resolveFbProblemLetterForPresentationRow(page, rowIdx, gid, deck, pagerRules);
                return letters ? { ...row, _pres_fb_problem_letters: letters } : row;
            }).filter(Boolean);
            const fr = slots[idx] || { awardPageNum: 1, awardPageTotal: 1 };
            const head = this.getPresentationHeadParts(page);
            return {
                title: page.title || page.award_key || "获奖名单",
                headline: head.headline,
                groupLine: head.groupLine,
                subtitle: this.contestTitle || "",
                rows: teamRows,
                awardPageNum: fr.awardPageNum,
                awardPageTotal: fr.awardPageTotal,
                award_key: page.award_key || "",
                award_slot_key: page.award_slot_key || "",
                school_remark: page.school_remark || "",
                group_id: String(page.group_id || "__global__"),
            };
        }).filter((x) => x.rows.length > 0);
    }

    /**
     * 单页投屏 DOM 快照（供离线 HTML 使用，避免内嵌整套 AwardDeckPage）。
     * @param {object} page buildPresentationPages* 返回的页对象
     */
    buildPresentationPageSnapshot(page) {
        const disp = this.normalizePresentationDisplay(this.bundleState?.display || {});
        const n = page.rows.length;
        const isCs = this.isChampionSchoolPresentationPage(page);
        const soloCs = isCs && n === 1;
        const presGid = String(page.group_id || this.currentGroupId || "__global__");
        const pageMeta = { isChampionSchoolPage: isCs, soloChampionCentered: soloCs, presentationGroupId: presGid };
        const rowsHtml = page.rows.map((item) => this.buildPresentationRowHtml(item, disp, pageMeta)).join("");
        const listHtml = soloCs
            ? `<div class="award-pres-solo-champion-wrap">${rowsHtml}</div>`
            : rowsHtml;
        const ak = `${page.award_key || ""}`.trim();
        const medalSet = new Set(["金奖", "银奖", "铜奖", "一等奖", "二等奖", "三等奖"]);
        const hl = page.headline != null && `${page.headline}`.trim() !== "" ? page.headline : page.title;
        return {
            rowCount: n,
            soloChampion: !!soloCs,
            deckVisual: this.getDeckAwardVisualSuffix(page),
            headline: hl || "",
            groupLine: page.groupLine != null ? page.groupLine : "",
            subtitle: page.subtitle || "",
            awardPageNum: page.awardPageNum,
            awardPageTotal: page.awardPageTotal,
            listHtml,
            titleIsMedal: medalSet.has(ak),
        };
    }

    /** @returns {{ cid: string, title: string }} */
    getAwardPackContestMeta() {
        const cid = String(
            this.data?.contest?.contest_id
            ?? this.config?.cid_list
            ?? ""
        ).trim() || "contest";
        const titleRaw = `${this.contestTitle || this.data?.contest?.title || ""}`.trim() || "contest";
        return { cid, title: titleRaw };
    }

    static sanitizeFilenameSegment(raw) {
        return String(raw || "")
            .replace(/\s+/g, "_")
            .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_")
            .replace(/_+/g, "_")
            .replace(/^_+|_+$/g, "")
            .slice(0, 180) || "x";
    }

    static formatPackTimestamp(d) {
        const p = (n) => String(n).padStart(2, "0");
        return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
    }

    _resolvePackStaticBase() {
        const hit = [...document.querySelectorAll('link[rel="stylesheet"]')].find((l) => /\/award_admin\.css(\?|$)/i.test(l.href));
        if (hit) {
            return hit.href.replace(/\/csgoj\/contest\/award_admin\.css.*$/i, "");
        }
        return `${window.location.origin}/static`;
    }

    _bytesToBase64(buf) {
        const u8 = new Uint8Array(buf);
        let binary = "";
        const chunk = 8192;
        for (let i = 0; i < u8.length; i += chunk) {
            binary += String.fromCharCode.apply(null, u8.subarray(i, i + chunk));
        }
        return btoa(binary);
    }

    async _fetchPackDataUrl(absUrl) {
        const r = await fetch(absUrl, { credentials: "same-origin" });
        if (!r.ok) {
            throw new Error(`fetch ${absUrl} -> ${r.status}`);
        }
        const mime = (r.headers.get("content-type") || "application/octet-stream").split(";")[0].trim();
        const buf = await r.arrayBuffer();
        return `data:${mime};base64,${this._bytesToBase64(buf)}`;
    }

    async _fetchPackText(relFromStatic) {
        const base = this._resolvePackStaticBase();
        const url = relFromStatic.startsWith("http") ? relFromStatic : `${base}/${String(relFromStatic).replace(/^\//, "")}`;
        const r = await fetch(url, { credentials: "same-origin" });
        if (!r.ok) {
            throw new Error(`fetch ${url} -> ${r.status}`);
        }
        return r.text();
    }

    async _inlineUrlsInCss(cssText, cssFileUrl) {
        const cssDir = cssFileUrl.replace(/[^/]+$/, "");
        const re = /url\(\s*(['"]?)([^'")]+)\1\s*\)/gi;
        let out = "";
        let last = 0;
        let m;
        while ((m = re.exec(cssText)) !== null) {
            out += cssText.slice(last, m.index);
            const raw = m[2].trim();
            if (raw.startsWith("data:") || raw.startsWith("#")) {
                out += m[0];
            } else {
                try {
                    const abs = new URL(raw, cssDir).href;
                    const d = await this._fetchPackDataUrl(abs);
                    out += `url("${d}")`;
                } catch (e) {
                    out += m[0];
                }
            }
            last = m.index + m[0].length;
        }
        out += cssText.slice(last);
        return out;
    }

    async _loadAwardPresentationPackAssetBundle() {
        const base = this._resolvePackStaticBase();
        const awardPresCssUrl = `${base}/fonts/award_pres/award_pres.css`;
        const r0 = await fetch(awardPresCssUrl, { credentials: "same-origin" });
        if (!r0.ok) throw new Error(`fetch award_pres.css ${r0.status}`);
        let awardPresCss = await r0.text();
        awardPresCss = await this._inlineUrlsInCss(awardPresCss, awardPresCssUrl);
        const awardAdminCssUrl = `${base}/csgoj/contest/award_admin.css`;
        const rAdmin = await fetch(awardAdminCssUrl, { credentials: "same-origin" });
        if (!rAdmin.ok) throw new Error(`fetch award_admin.css ${rAdmin.status}`);
        let awardAdminCss = await rAdmin.text();
        awardAdminCss = await this._inlineUrlsInCss(awardAdminCss, awardAdminCssUrl);
        const bsCssUrl = `${base}/bootstrap-5.3.8/css/bootstrap.min.css`;
        const r1 = await fetch(bsCssUrl, { credentials: "same-origin" });
        if (!r1.ok) throw new Error(`fetch bootstrap.css ${r1.status}`);
        let bootstrapCss = await r1.text();
        bootstrapCss = await this._inlineUrlsInCss(bootstrapCss, bsCssUrl);
        const biCssUrl = `${base}/bootstrap-icons-1.13.1/font/bootstrap-icons.min.css`;
        const r2 = await fetch(biCssUrl, { credentials: "same-origin" });
        if (!r2.ok) throw new Error(`fetch bootstrap-icons.css ${r2.status}`);
        let bootstrapIconsCss = await r2.text();
        bootstrapIconsCss = await this._inlineUrlsInCss(bootstrapIconsCss, biCssUrl);
        const bootstrapJs = await this._fetchPackText("bootstrap-5.3.8/js/bootstrap.bundle.min.js");
        const offlineRuntime = await this._fetchPackText("csgoj/contest/award_pres_offline_runtime.js");
        return {
            awardPresCss,
            awardAdminCss,
            bootstrapCss,
            bootstrapIconsCss,
            bootstrapJs,
            offlineRuntime,
        };
    }

    _buildOfflineAwardPresentationStageHtml() {
        return `<div id="award_presentation_stage" class="award-presentation-stage" data-award-pres-theme="honor">
        <div class="award-presentation-toolbar award-presentation-toolbar--overlay">
            <div class="award-presentation-toolbar-inner">
                <div class="award-presentation-toolbar-cluster" role="group" aria-label="pager">
                    <button type="button" class="btn btn-sm btn-light award-pres-icon-btn" id="award_presentation_prev" title="上一页" aria-label="上一页">&lt;</button>
                    <div id="award_presentation_page_info" class="award-presentation-page-info">- / -</div>
                    <button type="button" class="btn btn-sm btn-light award-pres-icon-btn" id="award_presentation_next" title="下一页" aria-label="下一页">&gt;</button>
                </div>
                <div class="award-presentation-toolbar-cluster" role="group" aria-label="zoom">
                    <button type="button" class="btn btn-sm btn-outline-light award-pres-icon-btn" id="award_presentation_zoom_out" title="缩小信息区" aria-label="缩小">−</button>
                    <button type="button" class="btn btn-sm btn-outline-light award-pres-icon-btn" id="award_presentation_zoom_in" title="放大" aria-label="放大">+</button>
                </div>
                <div class="award-presentation-toolbar-cluster award-pres-aspect-toolbar" role="group" aria-label="aspect">
                    <button type="button" class="btn btn-sm btn-outline-light award-pres-icon-btn" id="award_pres_aspect_narrow" title="更窄画幅" aria-label="更窄">‹</button>
                    <input type="number" min="1" max="64" step="1" class="form-control form-control-sm award-pres-aspect-input" id="award_pres_aspect_w" inputmode="numeric" aria-label="比例宽" />
                    <span class="award-pres-aspect-colon" aria-hidden="true">:</span>
                    <input type="number" min="1" max="64" step="1" class="form-control form-control-sm award-pres-aspect-input" id="award_pres_aspect_h" inputmode="numeric" aria-label="比例高" />
                    <button type="button" class="btn btn-sm btn-outline-light award-pres-icon-btn" id="award_pres_aspect_wide" title="更宽画幅" aria-label="更宽">›</button>
                </div>
                <div class="dropdown award-pres-theme-dropdown">
                    <button class="btn btn-sm btn-outline-light dropdown-toggle" type="button" id="award_pres_theme_menu_btn" data-bs-toggle="dropdown" data-bs-auto-close="true" aria-expanded="false" title="配色">配色</button>
                    <ul class="dropdown-menu dropdown-menu-dark dropdown-menu-end shadow" aria-labelledby="award_pres_theme_menu_btn">
                        <li><button type="button" class="dropdown-item py-2" data-award-pres-theme="honor">红金表彰（默认）</button></li>
                        <li><button type="button" class="dropdown-item py-2" data-award-pres-theme="ruby">绯红礼赞</button></li>
                        <li><button type="button" class="dropdown-item py-2" data-award-pres-theme="mist">雾灰浅蓝</button></li>
                        <li><button type="button" class="dropdown-item py-2" data-award-pres-theme="night">深色夜境</button></li>
                        <li><button type="button" class="dropdown-item py-2" data-award-pres-theme="ocean">蔚蓝典礼</button></li>
                        <li><button type="button" class="dropdown-item py-2" data-award-pres-theme="jade">翠玉正式</button></li>
                    </ul>
                </div>
                <button type="button" class="btn btn-sm btn-outline-light" id="award_presentation_fullscreen" title="全屏">全屏</button>
            </div>
        </div>
        <div class="award-presentation-viewport">
            <div class="award-presentation-viewport-gutter award-presentation-viewport-gutter--left" aria-hidden="true"></div>
            <div id="award_presentation_slide_shell" class="award-presentation-slide-shell">
                <div id="award_presentation_slide" class="award-presentation-slide">
                    <div class="award-presentation-card">
                        <header class="award-presentation-head">
                            <div class="award-presentation-title-row" id="award_presentation_title_row">
                                <div class="award-presentation-title-cluster">
                                    <div id="award_presentation_title" class="award-presentation-title"></div>
                                    <div id="award_presentation_award_fraction" class="award-presentation-award-fraction" title="该奖项分页 / Pages within this award"></div>
                                </div>
                                <div id="award_presentation_group" class="award-presentation-group award-presentation-group--head-inline" hidden
                                     title="当前赛事归属 / Contest affiliation"></div>
                            </div>
                            <div id="award_presentation_subtitle" class="award-presentation-subtitle"></div>
                        </header>
                        <div class="award-presentation-card-list-vert">
                            <div id="award_presentation_list" class="award-pres-list" role="list"></div>
                        </div>
                    </div>
                </div>
            </div>
            <div class="award-presentation-viewport-gutter award-presentation-viewport-gutter--right" aria-hidden="true"></div>
        </div>
    </div>`;
    }

    _buildOfflineAwardPresentationHtmlDocument(packObj, assets) {
        const jsonSafe = JSON.stringify(packObj).replace(/</g, "\\u003c");
        const stage = this._buildOfflineAwardPresentationStageHtml();
        return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>颁奖投屏</title>
<style>${assets.bootstrapCss}</style>
<style>${assets.bootstrapIconsCss}</style>
<style>${assets.awardPresCss}</style>
<style>${assets.awardAdminCss}</style>
</head>
<body class="award-presentation-doc-lock">
<div id="award_presentation_modal" class="award-presentation-modal" style="display:block;">
${stage}
</div>
<script type="application/json" id="award-pres-pack-data">${jsonSafe}</script>
<script>${assets.bootstrapJs}</script>
<script>${assets.offlineRuntime}</script>
</body>
</html>`;
    }

    async downloadAwardPresentationPackZip() {
        if (typeof JSZip === "undefined") {
            if (typeof alerty !== "undefined" && alerty.error) {
                alerty.error("缺少 JSZip，无法打包（请确认已加载 /static/vendor/jszip-3.10.1.min.js）");
            } else {
                window.alert("缺少 JSZip，无法打包");
            }
            return;
        }
        const groups = this.getGroupTargets();
        if (!groups.length) {
            if (typeof alerty !== "undefined" && alerty.error) {
                alerty.error("无赛事归属数据，无法打包");
            }
            return;
        }
        const disp = this.normalizePresentationDisplay(this.bundleState?.display || {});
        const packBodies = [];
        for (let gi = 0; gi < groups.length; gi++) {
            const g = groups[gi];
            const gid = String(g.group_id || "__global__");
            const pages = this.buildPresentationPagesForGroup(gid);
            if (!pages.length) {
                continue;
            }
            const snapshots = pages.map((p) => this.buildPresentationPageSnapshot(p));
            packBodies.push({
                groupId: gid,
                groupName: `${g.group_name || gid}`.trim() || gid,
                pack: { display: disp, snapshots },
            });
        }
        if (!packBodies.length) {
            if (typeof alerty !== "undefined" && alerty.error) {
                alerty.error("暂无可导出的投屏页（各归属下无获奖名单页）");
            } else {
                window.alert("暂无可导出的投屏页");
            }
            return;
        }
        const meta = this.getAwardPackContestMeta();
        const stamp = AwardDeckPage.formatPackTimestamp(new Date());
        const cidSeg = AwardDeckPage.sanitizeFilenameSegment(meta.cid);
        const titleSeg = AwardDeckPage.sanitizeFilenameSegment(meta.title);
        const zipBase = `${cidSeg}-${titleSeg}-颁奖-${stamp}`;
        const singleGroup = groups.length === 1;
        const overlayReady = typeof showOverlay === "function"
            && typeof hideOverlay === "function"
            && typeof updateOverlay === "function";
        const packOverlayPayload = (extra) => ({
            message: "正在打包颁奖投屏…",
            message_en: "Building award presentation pack…",
            progressMode: "determinate",
            progress: 0,
            detail: "",
            detail_en: "",
            spinner: true,
            ...(extra && typeof extra === "object" ? extra : {}),
        });
        const showPackProgress = (extra) => {
            if (!overlayReady) return;
            updateOverlay(packOverlayPayload(extra));
        };
        try {
            if (overlayReady) {
                showOverlay({
                    message: "正在打包颁奖投屏…",
                    message_en: "Building award presentation pack…",
                    progressMode: "indeterminate",
                    spinner: true,
                });
            }
            const assets = await this._loadAwardPresentationPackAssetBundle();
            if (overlayReady) {
                showPackProgress({
                    progress: 22,
                    detail: "正在生成 HTML 页面…",
                    detail_en: "Generating HTML pages…",
                });
            }
            const zip = new JSZip();
            const nFiles = packBodies.length;
            for (let i = 0; i < nFiles; i++) {
                const b = packBodies[i];
                const gSeg = AwardDeckPage.sanitizeFilenameSegment(b.groupName);
                const htmlName = singleGroup
                    ? `${zipBase}.html`
                    : `${cidSeg}-${titleSeg}-颁奖-${gSeg}-${stamp}.html`;
                const doc = this._buildOfflineAwardPresentationHtmlDocument(b.pack, assets);
                zip.file(htmlName, doc);
                if (overlayReady) {
                    const pct = 22 + Math.round(((i + 1) / Math.max(1, nFiles)) * 48);
                    showPackProgress({
                        progress: Math.min(70, pct),
                        detail: `写入页面 ${i + 1} / ${nFiles}`,
                        detail_en: `Writing page ${i + 1} / ${nFiles}`,
                    });
                }
            }
            const onZipProgress = (meta) => {
                if (!overlayReady || !meta) return;
                const p = meta.percent;
                if (typeof p !== "number" || Number.isNaN(p)) return;
                const overall = 70 + Math.max(0, Math.min(100, p)) * 0.28;
                showPackProgress({
                    progress: Math.min(99, Math.round(overall)),
                    detail: "正在压缩 ZIP…",
                    detail_en: "Compressing ZIP…",
                });
            };
            const blob = await zip.generateAsync({ type: "blob" }, onZipProgress);
            const a = document.createElement("a");
            a.href = URL.createObjectURL(blob);
            a.download = `${zipBase}.zip`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            setTimeout(() => URL.revokeObjectURL(a.href), 4000);
            if (overlayReady) {
                showPackProgress({
                    progress: 100,
                    detail: "已开始下载",
                    detail_en: "Download started",
                    overlayProgressSpinnerPolicy: "progress_only",
                });
                setTimeout(() => hideOverlay(), 420);
            }
        } catch (e) {
            if (overlayReady) {
                hideOverlay();
            }
            console.warn("[AwardDeckPage] pack zip", e);
            const msg = (e && e.message) ? String(e.message) : String(e);
            if (typeof alerty !== "undefined" && alerty.error) {
                alerty.error(`打包失败：${msg}`);
            } else {
                window.alert(`打包失败：${msg}`);
            }
        }
    }

    renderGroupTabs() {
        const wrap = document.getElementById("award_deck_group_tabs");
        if (!wrap) return;
        const groups = this.getGroupTargets();
        if (!groups.some((g) => g.group_id === this.currentGroupId)) {
            this.currentGroupId = groups[0]?.group_id || "__global__";
        }
        wrap.innerHTML = "";
        const escapeHtml = (str) => String(str)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;");
        groups.forEach((g) => {
            const btn = document.createElement("button");
            btn.type = "button";
            btn.className = `btn btn-sm deck-group-tab ${g.group_id === this.currentGroupId ? "btn-dark" : "btn-outline-dark"}`;
            const cn = escapeHtml(g.group_name || g.group_id);
            const en = escapeHtml(g.group_id);
            btn.innerHTML = `<i class="bi bi-diagram-3 admin-subnav-icon" aria-hidden="true"></i>` +
                `<span class="admin-subnav-stack"><span class="admin-subnav-cn">${cn}</span>` +
                `<span class="en-text">${en}</span></span>`;
            btn.addEventListener("click", () => {
                const modalEl = document.getElementById("award_deck_pager_modal");
                const modalOpen = modalEl && modalEl.classList.contains("show");
                if (this._awardPagerModalSnapshot) {
                    this._restoreAwardPagerModalSnapshotToBundle();
                    this.applyPresentationDisplayToDom(this.bundleState?.display);
                    this._awardPagerModalSnapshot = null;
                }
                this.currentGroupId = g.group_id;
                this.renderDeckEditor({ persist: false });
                if (modalOpen) {
                    this._awardPagerModalClosedBySubmit = false;
                    this._captureAwardPagerModalSnapshot();
                    this._fillAwardDeckPagerModalFromBundle();
                }
            });
            wrap.appendChild(btn);
        });
        this.updateAwardDeckPagerModalGroupLine();
    }

    getDeckPagesByGroup() {
        const deck = Array.isArray(this.bundleState?.deck) ? this.bundleState.deck : [];
        return deck.filter((p) => p.group_id === this.currentGroupId);
    }

    /**
     * 专项轨道 data-row-key 对应的 id（champion_1 / first_blood / fb_A 等）→ 中英文案。
     * @param {string} id
     * @returns {{ cn: string, en: string } | null}
     */
    getSpecialDeckOrderBilingualPair(id) {
        const k = `${id || ""}`.trim();
        if (k === "champion_1") return { cn: "冠军学校", en: "Champion org" };
        if (k === "champion_2") return { cn: "亚军学校", en: "Runner-up org" };
        if (k === "champion_3") return { cn: "季军学校", en: "Third org" };
        if (k === "best_female") return { cn: "最佳女队或女生", en: "Best girls" };
        if (k === "tenacity") return { cn: "顽强拼搏", en: "Spirit" };
        if (k === "first_blood") return { cn: "最快解题", en: "First blood" };
        return null;
    }

    /**
     * 编排区 panel 标题：系统奖项中英；未知则返回 null（由调用方用 title 等回退）。
     * @param {object} page bundle.deck 单页
     * @returns {{ cn: string, en: string } | null}
     */
    getDeckSystemAwardBilingualPair(page) {
        if (!page) return null;
        const ak = `${page.award_key || ""}`.trim();
        const slot = `${page.award_slot_key || ""}`.trim();
        const medalEn = {
            金奖: "Gold",
            银奖: "Silver",
            铜奖: "Bronze",
            一等奖: "One",
            二等奖: "Two",
            三等奖: "Three",
        };
        if (medalEn[ak]) {
            return { cn: ak, en: medalEn[ak] };
        }
        if (ak === "最快解题奖") {
            if (slot === "first_blood") {
                return this.getSpecialDeckOrderBilingualPair("first_blood");
            }
            const letter = page.fb_letter || (slot.match(/^fb_([A-Z]+)$/i) || [])[1] || "";
            const L = `${letter}`.trim().toUpperCase();
            if (L) {
                return { cn: `最快解题 ${L}`, en: `FB ${L}` };
            }
            return { cn: "最快解题", en: "First blood" };
        }
        if (ak === "最佳女队/女生奖" && slot === "best_female") {
            return this.getSpecialDeckOrderBilingualPair("best_female");
        }
        if (ak === "顽强拼搏奖" && slot === "tenacity") {
            return this.getSpecialDeckOrderBilingualPair("tenacity");
        }
        if (ak === "冠亚季军") {
            const sr = `${page.school_remark || ""}`.trim();
            const schoolByRemark = {
                冠军学校: this.getSpecialDeckOrderBilingualPair("champion_1"),
                亚军学校: this.getSpecialDeckOrderBilingualPair("champion_2"),
                季军学校: this.getSpecialDeckOrderBilingualPair("champion_3"),
            };
            if (schoolByRemark[sr]) return schoolByRemark[sr];
            const mSch = slot.match(/^school_([123])$/);
            if (mSch) {
                return this.getSpecialDeckOrderBilingualPair(`champion_${mSch[1]}`);
            }
        }
        return null;
    }

    _escapeDeckHtml(str) {
        return String(str)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;");
    }

    /**
     * 左侧候选块 / 右侧编排页标题：组别名单行（非双语）+ 系统奖项中英；不展示 award_slot_key 内部值。
     * @param {object} page
     * @returns {string}
     */
    buildDeckPanelTitleHtml(page) {
        if (!page) return "";
        const esc = (s) => this._escapeDeckHtml(s);
        const pair = this.getDeckSystemAwardBilingualPair(page);
        let awardLine;
        if (pair) {
            awardLine = `<span class="cn-text">${esc(pair.cn)}</span><span class="en-text">${esc(pair.en)}</span>`;
        } else {
            const raw = `${page.title || page.award_key || page.award_slot_key || "获奖名单"}`.trim();
            awardLine = esc(raw);
        }
        const gid = String(page.group_id || "__global__");
        if (gid !== "__global__") {
            const g = this.getGroupTargets().find((x) => String(x.group_id) === gid);
            const gname = `${g?.group_name || gid}`.trim();
            return `<div class="deck-panel-title-stack">` +
                `<div class="deck-title-group-prefix">${esc(gname)}</div>` +
                `<div class="deck-title-award-line">${awardLine}</div></div>`;
        }
        return `<div class="deck-panel-title-stack"><div class="deck-title-award-line">${awardLine}</div></div>`;
    }

    /**
     * 右侧单页「编排预览」块 HTML（供配对行与旧逻辑复用）。
     * @param {object} p deck 页
     * @param {Record<string, object>} teamMap team_id -> 获奖行
     */
    buildDeckPageHtml(p, teamMap) {
        const pgid = String(p.group_id || this.currentGroupId || "__global__");
        const fbRows = Array.isArray(p.fb_row_letters) ? p.fb_row_letters : null;
        const rows = (p.team_ids || []).map((tid, idx) => {
            const it = teamMap[tid];
            if (!it) return "";
            const rnk = this.getAwardDisplayRankInGroup(it, pgid);
            const rnkDisp = rnk != null && rnk !== "" ? rnk : "—";
            const fbL = fbRows && `${fbRows[idx] || ""}`.trim();
            const fbAttr = fbL ? ` data-fb-remark="${String(fbL).replace(/"/g, "&quot;")}"` : "";
            const fbHint = fbL && String(p.award_key || "") === "最快解题奖"
                ? `<span class="deck-fb-letter-hint">题 ${fbL}</span>`
                : "";
            return `<div class="deck-slot-item" data-team-id="${tid}"${fbAttr}>
                    <div class="deck-team-main">${it.team?.name || tid}${fbHint}</div>
                    <div class="deck-team-sub">${it.team?.school || "-"} · #${rnkDisp}</div>
                </div>`;
        }).join("");
        const slot = p.award_slot_key || p.award_key || "";
        const vis = this.getDeckAwardVisualSuffix(p);
        const visCls = vis ? ` deck-award-visual--${vis}` : "";
        const headTitle = this.buildDeckPanelTitleHtml(p);
        return `<div class="deck-page${visCls}" data-page-id="${p.id}" data-award-key="${p.award_key}" data-award-slot="${slot}">
                <div class="deck-page-head"><div class="deck-page-head-title">${headTitle}</div></div>
                <div class="deck-dropzone" data-page-id="${p.id}" data-award-key="${p.award_key}" data-award-slot="${slot}">${rows}</div>
            </div>`;
    }

    /** 左右栏按奖项槽位对齐成行，行高取同槽候选块与预览页最大高度，便于拖拽对照。 */
    renderDeckPairedWorkbench() {
        const wrap = document.getElementById("award_deck_pair_rows");
        if (!wrap) return;
        const pages = this.getDeckPagesByGroup();
        const teamMap = {};
        this.awardData.forEach((x) => {
            if (x?.team?.team_id) teamMap[x.team.team_id] = x;
        });
        const slotOrder = [];
        const slotSeen = new Set();
        const bySlot = new Map();
        pages.forEach((p) => {
            const k = `${p.award_slot_key || p.award_key || ""}`.trim();
            if (!k) return;
            if (!bySlot.has(k)) bySlot.set(k, []);
            bySlot.get(k).push(p);
            if (!slotSeen.has(k)) {
                slotSeen.add(k);
                slotOrder.push(k);
            }
        });
        let html = "";
        slotOrder.forEach((slotKey) => {
            const rep = pages.find((p) => `${p.award_slot_key || p.award_key || ""}`.trim() === slotKey);
            if (!rep) return;
            const list = this.getCandidatesForDeckPage(rep);
            const title = this.buildDeckPanelTitleHtml(rep);
            const vis = this.getDeckAwardVisualSuffix(rep);
            const visCls = vis ? ` deck-award-visual--${vis}` : "";
            let leftBody = "";
            const repGid = String(rep.group_id || this.currentGroupId || "__global__");
            list.forEach((item) => {
                const tid = item.team?.team_id;
                const rnk = this.getAwardDisplayRankInGroup(item, repGid);
                const rnkDisp = rnk != null && rnk !== "" ? rnk : "—";
                const sub = `${item.team?.school || "-"} · #${rnkDisp}`;
                const slotAttr = `${rep.award_slot_key || rep.award_key || ""}`.replace(/"/g, "&quot;");
                const fbR = `${item._pres_deck_fb_remark || ""}`.trim();
                const fbAttr = fbR ? ` data-fb-remark="${fbR.replace(/"/g, "&quot;")}"` : "";
                const fbLab = fbR && String(rep.award_key || "") === "最快解题奖"
                    ? `<span class="deck-fb-letter-hint">题 ${fbR}</span>`
                    : "";
                leftBody += `<div class="deck-team-item" draggable="true" data-team-id="${tid}" data-award-key="${rep.award_key}" data-award-slot="${slotAttr}"${fbAttr}>
                    <div class="deck-team-main">${item.team?.name || tid}${fbLab}</div>
                    <div class="deck-team-sub">${sub}</div>
                </div>`;
            });
            const leftHtml = `<div class="deck-award-block${visCls}"><div class="deck-award-title">${title}</div>${leftBody}</div>`;
            const rightPages = bySlot.get(slotKey) || [];
            const rightHtml = rightPages.map((pg) => this.buildDeckPageHtml(pg, teamMap)).join("");
            const escSlot = slotKey.replace(/"/g, "&quot;");
            html += `<div class="deck-pair-row" data-award-slot="${escSlot}">
                <div class="deck-pair-cell deck-pair-cell--left">${leftHtml}</div>
                <div class="deck-pair-cell deck-pair-cell--right">${rightHtml}</div>
            </div>`;
        });
        wrap.innerHTML = html
            || "<div class=\"text-muted p-2 deck-pair-empty\">暂无编排页 / No deck pages</div>";
        wrap.querySelectorAll(".deck-team-item").forEach((el) => {
            el.addEventListener("dragstart", () => {
                this.dragPayload = {
                    team_id: el.dataset.teamId,
                    award_key: el.dataset.awardKey,
                    award_slot: el.dataset.awardSlot || el.dataset.awardKey,
                    fb_remark: `${el.dataset.fbRemark || ""}`.trim(),
                };
            });
        });
        wrap.querySelectorAll(".deck-dropzone").forEach((z) => {
            z.addEventListener("dragover", (e) => { e.preventDefault(); z.classList.add("is-over"); });
            z.addEventListener("dragleave", () => z.classList.remove("is-over"));
            z.addEventListener("drop", (e) => {
                e.preventDefault();
                z.classList.remove("is-over");
                this.handleDropToPage(z.dataset.pageId, z.dataset.awardKey, z.dataset.awardSlot);
            });
        });
    }

    getCandidatesForDeckPage(page) {
        if (!page) return [];
        const ak = page.award_key;
        const gid = this.currentGroupId;
        if (ak === "最快解题奖") {
            const raw = this._awardDeckGetBucketList(gid, "最快解题奖");
            if (page.award_slot_key === "first_blood") {
                return raw.map((e) => {
                    const it = e?.item || e;
                    if (!it) return null;
                    const R = `${e?.remark || ""}`.trim().toUpperCase();
                    return R ? { ...it, _pres_deck_fb_remark: R } : it;
                }).filter(Boolean);
            }
            const slot = `${page.award_slot_key || ""}`;
            const letter = page.fb_letter || (slot.match(/^fb_([A-Z]+)$/i) || [])[1] || "";
            if (letter) {
                const L = `${letter}`.trim().toUpperCase();
                const chars = L.length > 1 ? [...L] : [L];
                return raw
                    .filter((e) => chars.includes(`${e?.remark || ""}`.trim().toUpperCase()))
                    .map((e) => {
                        const it = e?.item || e;
                        if (!it) return null;
                        const R = `${e?.remark || ""}`.trim().toUpperCase();
                        return R ? { ...it, _pres_deck_fb_remark: R } : it;
                    })
                    .filter(Boolean);
            }
            return raw.map((e) => e?.item || e).filter(Boolean);
        }
        if (ak === "冠亚季军" && page.school_remark) {
            const sm = `${page.school_remark}`.trim();
            const raw = this._awardDeckGetBucketList(gid, "冠亚季军");
            return raw
                .filter((e) => `${e?.remark || ""}`.trim() === sm)
                .map((e) => e?.item || e)
                .filter(Boolean);
        }
        return this.getCandidatesByAward(ak);
    }

    getCandidatesByAward(awardKey) {
        const source = Array.isArray(this.mapAward?.[awardKey]) ? this.mapAward[awardKey] : [];
        const asItem = (entry) => entry?.item || entry;
        if (this.currentGroupId === "__global__") {
            return source.map(asItem).filter(Boolean);
        }
        return source
            .filter((entry) => {
                const item = asItem(entry);
                const gids = Array.isArray(item?.team?.group_ids) ? item.team.group_ids : [];
                return gids.includes(this.currentGroupId);
            })
            .map(asItem)
            .filter(Boolean);
    }

    handleDropToPage(pageId, awardKey, awardSlot) {
        if (!this.dragPayload?.team_id) return;
        const tid = this.dragPayload.team_id;
        const payloadAward = this.dragPayload.award_key;
        const payloadSlot = this.dragPayload.award_slot || payloadAward;
        const fbRemark = `${this.dragPayload.fb_remark || ""}`.trim();
        this.dragPayload = null;
        const deck = Array.isArray(this.bundleState?.deck) ? this.bundleState.deck : [];
        const dest = deck.find((p) => p.id === pageId);
        const slotKey = dest ? (dest.award_slot_key || dest.award_key) : (awardSlot || awardKey);
        if (payloadAward !== awardKey || `${payloadSlot}` !== `${slotKey}`) {
            alerty.error("拖拽校验失败：该队伍没有此页奖项 / Team has no award on this page");
            return;
        }
        const stripOne = (p) => {
            const ids = Array.isArray(p.team_ids) ? p.team_ids : [];
            const fbs = Array.isArray(p.fb_row_letters) ? p.fb_row_letters : null;
            let idx = -1;
            if (fbRemark && fbs && fbs.length === ids.length) {
                idx = ids.findIndex((id, i) => id === tid && `${fbs[i] || ""}`.trim() === fbRemark);
            }
            if (idx < 0) {
                idx = ids.indexOf(tid);
            }
            if (idx < 0) return;
            ids.splice(idx, 1);
            if (fbs && fbs.length > idx) {
                fbs.splice(idx, 1);
            }
            if (fbs && fbs.length === 0) {
                delete p.fb_row_letters;
            }
        };
        deck.forEach((p) => {
            if (p.group_id !== this.currentGroupId) return;
            if ((p.award_slot_key || p.award_key) !== slotKey) return;
            stripOne(p);
        });
        const page = deck.find((p) => p.id === pageId);
        if (!page) return;
        page.team_ids = Array.isArray(page.team_ids) ? page.team_ids : [];
        page.team_ids.push(tid);
        if (awardKey === "最快解题奖") {
            if (!Array.isArray(page.fb_row_letters)) {
                page.fb_row_letters = [];
            }
            while (page.fb_row_letters.length < page.team_ids.length - 1) {
                page.fb_row_letters.push("");
            }
            page.fb_row_letters.push(fbRemark || "");
        }
        this.bundleState.deck = deck;
        this.renderDeckPairedWorkbench();
        this.saveAwardBundle();
    }
}

window.AwardDeckPage = AwardDeckPage;
