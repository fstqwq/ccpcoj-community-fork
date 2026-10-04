class AwardSystem extends RankSystem {
    constructor(containerId, config = {}) {
        // 使用不存在的容器ID触发外部模式，合并配置
        const mergedConfig = RankToolMergeConfig(window.RANK_CONFIG || {}, config);
        mergedConfig.flg_rank_cache = mergedConfig.flg_rank_cache !== undefined ? mergedConfig.flg_rank_cache : false;
        
        // 调用父类构造函数，使用不存在的容器ID触发外部模式
        super("award_external_mode", mergedConfig);
        
        // 获奖系统专用属性
        this.awardData = [];
        this.mapAward = {};
        this.awardToExport = [];
        this.contestTitle = "";
        this.teamIdMap = {}; // team_id 到 awardData item 的映射
        this.bundleKey = `${this.key}_award_bundle_v1`;
        this.bundleVersion = 1;
        this.bundleState = null;
        this.selectedAwardGroupIds = [];
        this._awardGroupMultiSelect = null;
        /** 多赛事归属时各赛事归属分项 map；单赛事归属时为 null */
        this.mapAwardByGroup = null;
        /** 与 rank_page 一致：window.idb.get/set(db, store, key)，key 含 cid */
        this._awardFilterSaveTimer = null;

        this.init();
    }

    static get AWARD_FILTER_IDB_DB() {
        return "csgoj_award_page";
    }

    static get AWARD_FILTER_IDB_STORE() {
        return "award_filter";
    }

    /** @returns {string} 如 cid:1001；无比赛 id 时返回空串 */
    _awardFilterIdbStorageKey() {
        const cfg = this.config || {};
        let raw = "";
        if (cfg.cid_list != null && String(cfg.cid_list).trim() !== "") {
            raw = String(cfg.cid_list).trim();
        } else if (this.data?.contest?.contest_id != null && String(this.data.contest.contest_id).trim() !== "") {
            raw = String(this.data.contest.contest_id).trim();
        } else if (cfg.key != null && String(cfg.key).trim() !== "") {
            raw = String(cfg.key).trim();
        }
        if (!raw) return "";
        return `cid:${raw}`;
    }

    _scheduleSaveAwardFiltersToIdb() {
        if (!window.idb || typeof window.idb.set !== "function") return;
        if (this._awardFilterSaveTimer) clearTimeout(this._awardFilterSaveTimer);
        this._awardFilterSaveTimer = setTimeout(() => {
            this._awardFilterSaveTimer = null;
            this._saveAwardFiltersToIdb();
        }, 200);
    }

    async _saveAwardFiltersToIdb() {
        if (!window.idb || typeof window.idb.set !== "function") return;
        const idbKey = this._awardFilterIdbStorageKey();
        if (!idbKey) return;
        const payload = {
            v: 1,
            groupIds: Array.isArray(this.selectedAwardGroupIds) ? this.selectedAwardGroupIds.map(String) : [],
            includeStar: !!this.getSwitchWithStarTeam(),
            allTeamBasedSwitch: (() => {
                const el = document.getElementById("switch_all_team_based");
                return el ? !!el.checked : false;
            })(),
            oneTwoThree: !!this.getSwitchOneTwoThree(),
        };
        try {
            await window.idb.set(
                AwardSystem.AWARD_FILTER_IDB_DB,
                AwardSystem.AWARD_FILTER_IDB_STORE,
                idbKey,
                payload
            );
        } catch (e) {
            console.warn("[AwardSystem] filter idb save", e);
        }
    }

    /**
     * 从 IndexedDB 恢复筛选（打星 / 基数 / 一二三、多赛事归属勾选），与榜单页 rank_page 同约定。
     * @returns {Promise<boolean>} 是否应用了任意字段
     */
    async _restoreAwardFiltersFromIdb() {
        if (!window.idb || typeof window.idb.get !== "function") return false;
        const idbKey = this._awardFilterIdbStorageKey();
        if (!idbKey) return false;
        let data;
        try {
            data = await window.idb.get(
                AwardSystem.AWARD_FILTER_IDB_DB,
                AwardSystem.AWARD_FILTER_IDB_STORE,
                idbKey
            );
        } catch (e) {
            console.warn("[AwardSystem] filter idb get", e);
            return false;
        }
        if (!data || typeof data !== "object") return false;

        let changed = false;
        const withStar = document.getElementById("switch_with_star_team");
        const allTeam = document.getElementById("switch_all_team_based");
        const oneTwoThree = document.getElementById("switch_one_two_three");

        if (typeof data.includeStar === "boolean" && withStar) {
            withStar.checked = data.includeStar;
            changed = true;
        }
        if (typeof data.allTeamBasedSwitch === "boolean" && allTeam) {
            allTeam.checked = data.allTeamBasedSwitch;
            changed = true;
        }
        if (typeof data.oneTwoThree === "boolean" && oneTwoThree) {
            oneTwoThree.checked = data.oneTwoThree;
            changed = true;
        }
        if (Array.isArray(data.groupIds) && data.groupIds.length) {
            const groups = this.GetContestGroups();
            const all = groups.map((g) => g.group_id).filter(Boolean);
            const sel = data.groupIds.map(String).filter((id) => RankToolGroupIdListHas(all, id));
            if (sel.length) {
                this.selectedAwardGroupIds = sel;
                changed = true;
            }
        }

        if (changed) {
            this._syncAwardToolbarSwitchesUi();
        }
        return changed;
    }

    _syncAwardToolbarSwitchesUi() {
        if (!window.csgSwitch || typeof window.csgSwitch.syncSwitchState !== "function") return;
        ["switch_with_star_team", "switch_all_team_based", "switch_one_two_three"].forEach((id) => {
            const el = document.getElementById(id);
            if (el) window.csgSwitch.syncSwitchState(el);
        });
    }

    async init() {
        this.createContainer();
        this.bindEvents();
        this.initSwitches();
        
        // 外部模式下，需要手动加载数据
        // 因为父类的 Init() 在外部模式下会直接返回，不会调用 LoadData()
        try {
            // 初始化缓存（如果还没有初始化）
            if (!this.cache) {
                this.cache = new IndexedDBCache('csgoj_rank', 'logotable');
                this.logoCache = new IndexedDBCache('csgoj_rank', 'logotable');
            }
            await this.cache.init();
            this.InitLazyLoaders();
            // 加载数据（仅 RankSystem 数据；获奖表格在 idb 恢复后再算）
            await this.LoadData();
            await this._restoreAwardFiltersFromIdb();
            await this.restoreAwardBundle();
            if (typeof this.afterRestoreAwardBundle === "function") {
                await this.afterRestoreAwardBundle();
            }
            this._syncAwardToolbarSwitchesUi();
            this.processAwardData();
            this.refreshDataShow();
            window.__awardSystemForFormatters = this;
        } catch (error) {
            console.error("加载获奖数据失败:", error);
            this.showError("加载获奖数据失败: " + error.message);
        }
    }

    /**
     * 重写 InitLazyLoaders：外部模式下不需要懒加载器
     */
    InitLazyLoaders() {
        // 外部模式下，没有容器，不需要初始化懒加载器
        if (this.externalMode || !this.container) {
            return;
        }
        // 调用父类方法
        super.InitLazyLoaders();
    }

    /**
     * 重写 OriInit：仅完成榜单侧数据；获奖筛选从 idb 恢复后再 processAwardData（见 init）。
     */
    OriInit(raw_data) {
        super.OriInit(raw_data);
    }

    createContainer() {
        // 表格已经在模板中定义，不需要创建容器
        // 只需要隐藏表格直到数据加载完成
        const table = document.getElementById("award_table");
        if (table) {
            table.style.display = "none";
        }
    }

    initSwitches() {
        // 初始化 csg-switch 组件
        if (window.csgSwitch) {
            const switches = document.querySelectorAll(".csg-switch-input");
            switches.forEach((switchEl) => {
                window.csgSwitch.initSwitch(switchEl);
            });
        }
    }

    bindEvents() {
        // 绑定开关事件
        const switchWithStarTeam = document.getElementById("switch_with_star_team");
        const switchAllTeamBased = document.getElementById("switch_all_team_based");
        const switchOneTwoThree = document.getElementById("switch_one_two_three");

        if (switchWithStarTeam) {
            switchWithStarTeam.addEventListener("change", () => {
                this.refreshDataShow();
            });
        }

        if (switchAllTeamBased) {
            switchAllTeamBased.addEventListener("change", () => {
                this.refreshDataShow();
            });
        }

        if (switchOneTwoThree) {
            switchOneTwoThree.addEventListener("change", () => {
                this.refreshDataShow();
            });
        }
        const groupFilter = document.getElementById("award_group_filter");
        if (groupFilter) {
            groupFilter.addEventListener("change", () => {
                const selected = Array.from(groupFilter.selectedOptions || []).map((op) => op.value);
                this.selectedAwardGroupIds = selected;
                this.refreshDataShow();
            });
        }

        // 绑定导出按钮
        const exportCsvBtn = document.getElementById("export_award_csv_btn");
        const exportXlsxBtn = document.getElementById("export_award_xlsx_btn");

        if (exportCsvBtn) {
            exportCsvBtn.addEventListener("click", () => {
                this.exportCSV();
            });
        }

        if (exportXlsxBtn) {
            exportXlsxBtn.addEventListener("click", () => {
                this.exportXLSX();
            });
        }
        const exportBundleBtn = document.getElementById("award_bundle_export_btn");
        const importBundleBtn = document.getElementById("award_bundle_import_btn");
        const resetBundleBtn = document.getElementById("award_bundle_reset_btn");
        const importFile = document.getElementById("award_bundle_import_file");
        if (exportBundleBtn) {
            exportBundleBtn.addEventListener("click", () => this.exportAwardBundle());
        }
        if (importBundleBtn && importFile) {
            importBundleBtn.addEventListener("click", () => importFile.click());
            importFile.addEventListener("change", (e) => this.importAwardBundle(e));
        }
        if (resetBundleBtn) {
            resetBundleBtn.addEventListener("click", () => this.resetAwardBundle());
        }
    }

    processAwardData() {
        // 处理数据并加载到table
        // 检查数据是否已加载
        if (!this.OuterIsDataLoaded()) {
            throw new Error("RankSystem data not loaded");
        }

        const contest = this.OuterGetContest();
        this.contestTitle = contest?.title || "";

        this.initAwardGroupFilter();
        this.calculateAwards();
        this.updateBootstrapTable();
    }
    initAwardGroupFilter() {
        const wrap = document.getElementById("award_group_filter_wrap");
        const select = document.getElementById("award_group_filter");
        const host = document.getElementById("award_group_multiselect");
        if (!select) return;
        const groups = this.GetContestGroups();
        if (!this.IsMultiGroupEnabled() || groups.length <= 1) {
            if (wrap) wrap.classList.add("d-none");
            this.selectedAwardGroupIds = groups.length ? [groups[0].group_id] : [];
            return;
        }
        if (wrap) wrap.classList.remove("d-none");
        select.classList.add("d-none");
        select.innerHTML = "";
        this.ensureAwardGroupSelection(groups);
        groups.forEach((g) => {
            const gid = g.group_id;
            if (!gid) return;
            const op = document.createElement("option");
            op.value = gid;
            op.textContent = g.group_name || gid;
            op.selected = this.selectedAwardGroupIds.includes(String(gid));
            select.appendChild(op);
        });
        if (host && window.csgMultiSelect) {
            if (this._awardGroupMultiSelect && typeof this._awardGroupMultiSelect.destroy === "function") {
                window.csgMultiSelect.destroy(host);
                this._awardGroupMultiSelect = null;
            }
            const opts = groups.map((g) => ({ value: g.group_id, label: g.group_name || g.group_id }));
            this._awardGroupMultiSelect = window.csgMultiSelect.create(host, {
                toggleLabel: { cn: "赛事归属", en: "Affiliations" },
                placeholder: "选择 / Pick",
                searchPlaceholder: "搜索赛事归属 / Search",
                selectedSuffix: "项",
                maxChips: 1,
                options: opts,
                selected: this.selectedAwardGroupIds.slice(),
                onChange: (values) => {
                    this.applyAwardGroupMultiValues(values, groups);
                },
            });
        } else {
            select.classList.remove("d-none");
            select.multiple = true;
            Array.from(select.options).forEach((op) => {
                op.selected = this.selectedAwardGroupIds.includes(op.value);
            });
        }
    }

    ensureAwardGroupSelection(groups) {
        const all = (groups || this.GetContestGroups()).map((g) => g.group_id).filter(Boolean);
        let sel = (this.selectedAwardGroupIds || []).filter((id) => RankToolGroupIdListHas(all, id));
        if (!sel.length && all.length) sel = all.slice();
        this.selectedAwardGroupIds = sel;
    }

    applyAwardGroupMultiValues(values, groups) {
        const all = (groups || this.GetContestGroups()).map((g) => g.group_id).filter(Boolean);
        let sel = (Array.isArray(values) ? values : []).filter((id) => all.includes(String(id))).map(String);
        if (!sel.length && all.length) sel = [String(all[0])];
        this.selectedAwardGroupIds = sel;
        const select = document.getElementById("award_group_filter");
        if (select) {
            Array.from(select.options).forEach((op) => {
                op.selected = sel.includes(String(op.value));
            });
        }
        this.refreshDataShow();
    }

    calculateAwards() {
        if (this.IsMultiGroupEnabled()) {
            this.ApplyContestGroupFilterForRanking(this.selectedAwardGroupIds);
        }
        const flg_include_star = this.getSwitchWithStarTeam();
        const flg_ac_team_base = this.getSwitchAcTeamBased();
        this.awardData = this.getAwardData();
        if (this.IsMultiGroupEnabled()) {
            this.mapAwardByGroup = {};
            this.calculateAwardsMultiGroup(flg_include_star, flg_ac_team_base);
            this.rebuildAwardFbLettersFromMapAward();
            return;
        }
        this.mapAwardByGroup = null;
        this.calculateAwardsSingleContest(flg_include_star, flg_ac_team_base);
        this.rebuildAwardFbLettersFromMapAward();
    }

    /** 从 mapAward「最快解题奖」桶的 remark 回填每队的题号字母列表，供表格 DOM 上色（文案不含括号） */
    rebuildAwardFbLettersFromMapAward() {
        const bucket = this.mapAward && Array.isArray(this.mapAward["最快解题奖"]) ? this.mapAward["最快解题奖"] : [];
        const byTeam = new Map();
        bucket.forEach((entry) => {
            const it = entry && entry.item ? entry.item : entry;
            if (!it || !it.team) return;
            const tid = it.team.team_id;
            const letter = entry && entry.remark != null && entry.remark !== "" ? String(entry.remark) : "";
            if (!letter) return;
            if (!byTeam.has(tid)) byTeam.set(tid, []);
            byTeam.get(tid).push(letter);
        });
        this.awardData.forEach((item) => {
            const tid = item.team?.team_id;
            item.awardFbLetters = tid && byTeam.has(tid) ? byTeam.get(tid).slice() : [];
        });
    }

    /** 单赛事归属或无多赛事归属元数据时：沿用全局名次与 contest 级获奖线 */
    calculateAwardsSingleContest(flg_include_star, flg_ac_team_base) {
        const awardRanks = this.GetAwardRanks({
            flg_ac_team_base: flg_ac_team_base,
            starMode: flg_include_star ? 2 : 0,
        });

        const rankGold = awardRanks.rankGold;
        const rankSilver = awardRanks.rankSilver;
        const rankBronze = awardRanks.rankBronze;

        this.mapAward = {};
        this.awardToExport = this.getSwitchOneTwoThree()
            ? ["一等奖", "二等奖", "三等奖"]
            : ["金奖", "银奖", "铜奖"];
        this.awardToExport.push("最快解题奖");
        this.awardToExport.push("最佳女队/女生奖");
        this.awardToExport.push("顽强拼搏奖");
        this.awardToExport.push("冠亚季军");

        for (let i = 0; i < this.awardToExport.length; i++) {
            this.mapAward[this.awardToExport[i]] = [];
        }

        let formalGirlTeamCount = 0;
        let bestGirlTeamItem = null;
        for (let i = 0; i < this.awardData.length; i++) {
            const item = this.awardData[i];
            const team = item.team;
            if (team && team.tkind === 1 && !item.isStar) {
                formalGirlTeamCount++;
                if (!bestGirlTeamItem || item.displayRank < bestGirlTeamItem.displayRank) {
                    bestGirlTeamItem = item;
                }
            }
        }

        const SchoolAwardSet = new Set();
        for (let i = 0; i < this.awardData.length; i++) {
            const item = this.awardData[i];
            const team = item.team;
            if (item.solved <= 0) continue;

            item.awards = [];

            if (item.displayRank <= rankGold) {
                const awardName = this.getSwitchOneTwoThree() ? "一等奖" : "金奖";
                item.awards.push(awardName);
                item.flg_award = 1;
                this.mapAward[awardName].push(item);
            } else if (item.displayRank <= rankSilver) {
                const awardName = this.getSwitchOneTwoThree() ? "二等奖" : "银奖";
                item.awards.push(awardName);
                item.flg_award = 2;
                this.mapAward[awardName].push(item);
            } else if (item.displayRank <= rankBronze) {
                const awardName = this.getSwitchOneTwoThree() ? "三等奖" : "铜奖";
                item.awards.push(awardName);
                item.flg_award = 3;
                this.mapAward[awardName].push(item);
            } else {
                item.flg_award = 0;
            }

            if (item?.displaySchoolCntNow === 1 && !SchoolAwardSet.has(1)) {
                SchoolAwardSet.add(1);
                item.awards.push("冠军学校");
                this.mapAward["冠亚季军"].push({ remark: "冠军学校", item: item });
            } else if (item?.displaySchoolCntNow === 2 && !SchoolAwardSet.has(2)) {
                SchoolAwardSet.add(2);
                item.awards.push("亚军学校");
                this.mapAward["冠亚季军"].push({ remark: "亚军学校", item: item });
            } else if (item?.displaySchoolCntNow === 3 && !SchoolAwardSet.has(3)) {
                SchoolAwardSet.add(3);
                item.awards.push("季军学校");
                this.mapAward["冠亚季军"].push({ remark: "季军学校", item: item });
            }

            const includeStar = this.getSwitchWithStarTeam();
            const fbData = includeStar
                ? this.map_fb.global
                : this.map_fb.regular;

            for (const problemId in fbData) {
                const fbTeam = fbData[problemId];
                if (fbTeam && fbTeam.team_id === team.team_id) {
                    const problem = this.problemMap[problemId];
                    const problemIndex = problem
                        ? RankToolGetProblemAlphabetIdx(problem.num)
                        : problemId;

                    item.awards.push("最快解题奖");
                    this.mapAward["最快解题奖"].push({
                        remark: problemIndex,
                        item: item,
                    });
                }
            }
        }

        if (formalGirlTeamCount >= 3 && bestGirlTeamItem && bestGirlTeamItem.displayRank <= rankBronze) {
            const team = bestGirlTeamItem.team;
            const isTeam =
                team.tmember &&
                (team.tmember.includes("、") ||
                    team.tmember.includes(",") ||
                    team.tmember.includes("，"));
            const awardName = isTeam ? "最佳女队奖" : "最佳女生奖";
            bestGirlTeamItem.awards.push(awardName);
            this.mapAward["最佳女队/女生奖"].push(bestGirlTeamItem);
        }

        this.calculateStruggleAward(rankBronze);
    }

    /**
     * 多赛事归属：各赛事归属内独立名次与金银铜线，专项奖在同一赛事归属内计算。
     */
    calculateAwardsMultiGroup(flg_include_star, flg_ac_team_base) {
        const groups = this.GetContestGroups();
        const starMode = flg_include_star ? 2 : 0;

        this.awardToExport = this.getSwitchOneTwoThree()
            ? ["一等奖", "二等奖", "三等奖"]
            : ["金奖", "银奖", "铜奖"];
        this.awardToExport.push("最快解题奖");
        this.awardToExport.push("最佳女队/女生奖");
        this.awardToExport.push("顽强拼搏奖");
        this.awardToExport.push("冠亚季军");

        this.mapAward = {};
        for (let i = 0; i < this.awardToExport.length; i++) {
            this.mapAward[this.awardToExport[i]] = [];
        }
        groups.forEach((g) => {
            const gid = g.group_id;
            this.mapAwardByGroup[gid] = {};
            this.awardToExport.forEach((name) => {
                this.mapAwardByGroup[gid][name] = [];
            });
        });

        this.awardData.forEach((item) => {
            item.awards = [];
            item.flg_award = 0;
            item.awardsByGroup = {};
            item.flg_award_by_group = {};
            item.displayRankByGroup = {};
            groups.forEach((g) => {
                item.awardsByGroup[g.group_id] = [];
                item.flg_award_by_group[g.group_id] = 0;
            });
        });

        const includeStarFb = this.getSwitchWithStarTeam();
        const fbData = includeStarFb ? this.map_fb.global : this.map_fb.regular;

        groups.forEach((group) => {
            const gid = group.group_id;
            const ranked = this.buildGroupRankListForAward(gid, starMode);
            const qtyMode = parseInt(group.flg_award_qty_mode, 10) === 1 ? 1 : 0;
            const gGold = parseInt(group.award_ratio_gold ?? 10, 10) || 0;
            const gSilv = parseInt(group.award_ratio_silver ?? 15, 10) || 0;
            const gBron = parseInt(group.award_ratio_bronze ?? 20, 10) || 0;
            const tmpList = ranked.filter((it) => {
                if (it.solved <= 0) return false;
                if (flg_ac_team_base) return !it.isStar;
                return true;
            });
            const validTeamNum = flg_ac_team_base
                ? tmpList.filter((x) => x.solved > 0 && !x.isStar).length
                : tmpList.filter((x) => !x.isStar).length;
            const awardRanks = RankToolGetAwardRank(validTeamNum, gGold, gSilv, gBron, qtyMode);
            const rankGold = awardRanks.rankGold;
            const rankSilver = awardRanks.rankSilver;
            const rankBronze = awardRanks.rankBronze;

            let formalGirlTeamCount = 0;
            let bestGirlTeamItem = null;
            ranked.forEach((item) => {
                const team = item.team;
                if (team && team.tkind === 1 && !item.isStar) {
                    formalGirlTeamCount++;
                    if (!bestGirlTeamItem || item.displayRank < bestGirlTeamItem.displayRank) {
                        bestGirlTeamItem = item;
                    }
                }
            });

            const SchoolAwardSet = new Set();
            const mapG = this.mapAwardByGroup[gid];

            for (let i = 0; i < ranked.length; i++) {
                const gItem = ranked[i];
                const team = gItem.team;
                const tid = team?.team_id;
                const item = tid ? this.teamIdMap[tid] : null;
                if (item) {
                    item.displayRankByGroup[gid] = gItem.displayRank;
                }
                if (!item || gItem.solved <= 0) continue;

                if (gItem.displayRank <= rankGold) {
                    const awardName = this.getSwitchOneTwoThree() ? "一等奖" : "金奖";
                    item.awardsByGroup[gid].push(awardName);
                    item.flg_award_by_group[gid] = 1;
                    mapG[awardName].push(item);
                } else if (gItem.displayRank <= rankSilver) {
                    const awardName = this.getSwitchOneTwoThree() ? "二等奖" : "银奖";
                    item.awardsByGroup[gid].push(awardName);
                    item.flg_award_by_group[gid] = 2;
                    mapG[awardName].push(item);
                } else if (gItem.displayRank <= rankBronze) {
                    const awardName = this.getSwitchOneTwoThree() ? "三等奖" : "铜奖";
                    item.awardsByGroup[gid].push(awardName);
                    item.flg_award_by_group[gid] = 3;
                    mapG[awardName].push(item);
                } else {
                    item.flg_award_by_group[gid] = 0;
                }

                if (gItem?.displaySchoolCntNow === 1 && !SchoolAwardSet.has(1)) {
                    SchoolAwardSet.add(1);
                    item.awardsByGroup[gid].push("冠军学校");
                    mapG["冠亚季军"].push({ remark: "冠军学校", item: item });
                } else if (gItem?.displaySchoolCntNow === 2 && !SchoolAwardSet.has(2)) {
                    SchoolAwardSet.add(2);
                    item.awardsByGroup[gid].push("亚军学校");
                    mapG["冠亚季军"].push({ remark: "亚军学校", item: item });
                } else if (gItem?.displaySchoolCntNow === 3 && !SchoolAwardSet.has(3)) {
                    SchoolAwardSet.add(3);
                    item.awardsByGroup[gid].push("季军学校");
                    mapG["冠亚季军"].push({ remark: "季军学校", item: item });
                }

                for (const problemId in fbData) {
                    const fbTeam = fbData[problemId];
                    if (fbTeam && fbTeam.team_id === team.team_id) {
                        const problem = this.problemMap[problemId];
                        const problemIndex = problem
                            ? RankToolGetProblemAlphabetIdx(problem.num)
                            : problemId;
                        item.awardsByGroup[gid].push("最快解题奖");
                        mapG["最快解题奖"].push({ remark: problemIndex, item: item });
                    }
                }
            }

            if (formalGirlTeamCount >= 3 && bestGirlTeamItem && bestGirlTeamItem.displayRank <= rankBronze) {
                const team = bestGirlTeamItem.team;
                const isTeam =
                    team.tmember &&
                    (team.tmember.includes("、") ||
                        team.tmember.includes(",") ||
                        team.tmember.includes("，"));
                const awardName = isTeam ? "最佳女队奖" : "最佳女生奖";
                const baseItem = this.teamIdMap[team.team_id];
                if (baseItem) {
                    baseItem.awardsByGroup[gid].push(awardName);
                    mapG["最佳女队/女生奖"].push(baseItem);
                }
            }

            this.calculateStruggleAwardForGroup(gid, rankBronze, ranked);
        });

        this.mergeMapAwardFromGroups();
        this.syncAwardsUnionForDeck();
    }

    buildGroupRankListForAward(groupId, starMode) {
        const out = [];
        for (const item of this.rankList) {
            const team = item.team;
            if (!team) continue;
            const gids = Array.isArray(team.group_ids) ? team.group_ids : [];
            if (!RankToolGroupIdsIncludes(gids, groupId)) continue;
            if (team.tkind === 2 && starMode === 1) continue;
            const copy = { ...item };
            if (team.tkind === 2) {
                copy.isStar = starMode === 0;
            } else {
                copy.isStar = false;
            }
            out.push(copy);
        }
        out.sort((a, b) => this.CompareTeamsForRanking(a, b));
        return this.CalculateRankInfo(out);
    }

    /**
     * 顽强拼搏奖候选：未得金银铜且非打星的队伍，按该队「最后一次 AC 时间」降序取前 maxCount 队。
     * @param {number} rankBronze 铜奖名次上限（含）
     * @param {(teamId: string) => { displayRank: number|string, isStar?: boolean }|null|undefined} getRankForTeam
     * @param {number} [maxCount=1]
     * @returns {object[]} awardData item 列表（已去重，至多 maxCount 条）
     */
    pickTenacityAwardItems(rankBronze, getRankForTeam, maxCount = 1) {
        const solutionMap = this.solutionMap;
        if (!solutionMap || typeof getRankForTeam !== "function") {
            return [];
        }
        const limit = Math.max(0, parseInt(maxCount, 10) || 0);
        if (limit === 0) {
            return [];
        }
        const candidates = [];
        for (const team_id in solutionMap) {
            const rankInfo = getRankForTeam(team_id);
            const item = this.teamIdMap[team_id];
            if (!rankInfo || !item || rankInfo.isStar) {
                continue;
            }
            const dr = rankInfo.displayRank;
            if (dr === "*" || dr === "" || dr == null) {
                continue;
            }
            const rankNum = typeof dr === "number" ? dr : parseInt(dr, 10);
            if (!Number.isFinite(rankNum) || rankNum <= rankBronze) {
                continue;
            }
            const teamSolutions = solutionMap[team_id];
            if (!teamSolutions || !teamSolutions.ac) {
                continue;
            }
            let lastAc = null;
            for (const problemId in teamSolutions.ac) {
                const acTime = teamSolutions.ac[problemId];
                if (!acTime) {
                    continue;
                }
                if (lastAc == null || acTime.localeCompare(lastAc) > 0) {
                    lastAc = acTime;
                }
            }
            if (lastAc) {
                candidates.push({ team_id, lastAc, item });
            }
        }
        candidates.sort((a, b) => {
            const cmp = b.lastAc.localeCompare(a.lastAc);
            if (cmp !== 0) {
                return cmp;
            }
            return a.team_id.localeCompare(b.team_id);
        });
        return candidates.slice(0, limit).map((c) => c.item);
    }

    calculateStruggleAwardForGroup(groupId, rankBronze, rankedList) {
        const rankByTeam = {};
        rankedList.forEach((r) => {
            if (r.team?.team_id) {
                rankByTeam[r.team.team_id] = r;
            }
        });
        const mapG = this.mapAwardByGroup[groupId];
        if (!mapG) {
            return;
        }
        const items = this.pickTenacityAwardItems(
            rankBronze,
            (teamId) => rankByTeam[teamId],
            1
        );
        items.forEach((item) => {
            const arr = item.awardsByGroup[groupId];
            if (!arr.includes("顽强拼搏奖")) {
                arr.push("顽强拼搏奖");
                mapG["顽强拼搏奖"].push(item);
            }
        });
    }

    mergeMapAwardFromGroups() {
        const groups = this.GetContestGroups();
        this.awardToExport.forEach((name) => {
            const merged = [];
            const seen = new Set();
            groups.forEach((g) => {
                const bucket = this.mapAwardByGroup[g.group_id]?.[name] || [];
                bucket.forEach((entry) => {
                    const item = entry?.item || entry;
                    const tid = item?.team?.team_id || item?.team_id;
                    const key = `${tid}|${name}|${entry?.remark || ""}`;
                    if (!seen.has(key)) {
                        seen.add(key);
                        merged.push(entry);
                    }
                });
            });
            this.mapAward[name] = merged;
        });
    }

    /** 合并各赛事归属奖项到 item.awards，供编排 bundle 等沿用 */
    syncAwardsUnionForDeck() {
        this.awardData.forEach((item) => {
            const nonFbSeen = new Set();
            const ordered = [];
            const gids = Object.keys(item.awardsByGroup || {});
            gids.forEach((gid) => {
                (item.awardsByGroup[gid] || []).forEach((a) => {
                    if (a === "最快解题奖") {
                        ordered.push(a);
                        return;
                    }
                    if (!nonFbSeen.has(a)) {
                        nonFbSeen.add(a);
                        ordered.push(a);
                    }
                });
            });
            item.awards = ordered;
            let best = 0;
            gids.forEach((gid) => {
                const v = parseInt(item.flg_award_by_group[gid], 10) || 0;
                if (v > 0 && (best === 0 || v < best)) best = v;
            });
            item.flg_award = best;
        });
    }

    calculateStruggleAward(rankBronze) {
        const items = this.pickTenacityAwardItems(
            rankBronze,
            (teamId) => {
                const item = this.teamIdMap[teamId];
                return item
                    ? { displayRank: item.displayRank, isStar: item.isStar }
                    : null;
            },
            1
        );
        items.forEach((item) => {
            if (!item.awards.includes("顽强拼搏奖")) {
                item.awards.push("顽强拼搏奖");
                this.mapAward["顽强拼搏奖"].push(item);
            }
        });
    }

    getSwitchWithStarTeam() {
        const switchEl = document.getElementById("switch_with_star_team");
        return switchEl ? switchEl.checked : false;
    }

    getSwitchAcTeamBased() {
        const switchEl = document.getElementById("switch_all_team_based");
        return switchEl ? !switchEl.checked : false;
    }

    getSwitchOneTwoThree() {
        const switchEl = document.getElementById("switch_one_two_three");
        return switchEl ? switchEl.checked : false;
    }

    getAwardData() {
        this.awardData = this.OuterGetRankList(
            this.getSwitchWithStarTeam() ? 2 : 0
        );
        // 更新 team_id 映射
        this.teamIdMap = {};
        this.awardData.forEach((item) => {
            if (item.team && item.team.team_id) {
                this.teamIdMap[item.team.team_id] = item;
            }
        });
        return this.awardData;
    }

    refreshDataShow() {
        // 重新获取处理后的数据

        this.calculateAwards(); // 会获取awardData
        this.updateBootstrapTable();
        this.updateBundleWarning();
        this.saveAwardBundle();
        this._scheduleSaveAwardFiltersToIdb();
    }
    getAwardSnapshotSignature() {
        const list = this.awardData
            .filter(item => item.solved > 0)
            .slice(0, 50)
            .map(item => `${item.team_id || item.team?.team_id}:${item.displayRank}:${item.solved}`);
        return `${this.data?.contest?.contest_id || ''}|${list.join('|')}`;
    }
    getDefaultPagerRules() {
        return {
            /**
             * 奖牌块顺序固定为 金→银→铜（或一二三等奖）；该字段仅兼容旧包，生成 deck 时恒视为 true。
             * @deprecated
             */
            award_order_forward: true,
            /** 同一奖项内按名次：true=升序；false=降序（默认逆序） */
            within_award_rank_forward: false,
            /** 无按赛事归属或分奖每页队数覆盖时的默认每页队数 */
            global_page_size: 16,
            by_group: {},
            by_group_award: {},
            /** 编排是否纳入对应专项（开且本场有队才生成页；顺序见 deck_special_units） */
            deck_include: {
                best_female: true,
                tenacity: true,
                first_blood: true,
                champion_schools: true,
            },
            /**
             * 专项奖条目的顺序与插入位置（相对金银铜四段间隙）。
             * 每项：{ id, anchor }；id 如 champion_1、fb_A、best_female、tenacity。
             * 与 deck_order_segments 并存时，生成 deck 以 deck_order_segments 为准；保存时会同步本字段。
             */
            deck_special_units: null,
            /**
             * 全编排段顺序（奖牌块 + 专项）：{ kind: "medal", tier: 0|1|2 } | { kind: "special", id }。
             * tier 0/1/2 对应金/银/铜（或一二三）；可与奖牌块任意穿插拖拽。
             */
            deck_order_segments: null,
            /** 专项顺序视图：0 规范正序 | 1 规范逆序 | 2 自定义（拖拽） */
            deck_special_order_phase: 0,
        };
    }

    static get DECK_SPECIAL_ANCHORS() {
        return ["before_gold", "after_gold", "after_silver", "after_bronze"];
    }

    /** @returns {{ id: string, anchor: string }[]} */
    buildDefaultDeckSpecialUnitsForGroup(groupId) {
        const rules = this.normalizePagerRules(this.bundleState?.pager_rules || {});
        const ids = Array.from(this.collectPresentSpecialDeckUnitIds(groupId, rules));
        return this.canonicalDeckSpecialUnitsOrder(ids).map((id) => ({
            id,
            anchor: this.defaultAnchorForSpecialUnitId(id),
        }));
    }

    /**
     * 当前赛事归属下，在 deck_include 开关为开时确有获奖者的专项单元 id 集合。
     * @param {string} groupId
     * @param {object} rules normalizePagerRules 结果
     */
    collectPresentSpecialDeckUnitIds(groupId, rules) {
        const inc = rules?.deck_include || {};
        const out = new Set();
        const hasBucket = (name) => this._awardDeckGetBucketList(groupId, name).length > 0;
        const fbLetters = () => {
            const list = this._awardDeckGetBucketList(groupId, "最快解题奖");
            const letters = new Set();
            list.forEach((entry) => {
                const L = `${entry?.remark || ""}`.trim().toUpperCase();
                if (L) letters.add(L);
            });
            return [...letters].sort();
        };
        if (inc.champion_schools && hasBucket("冠亚季军")) {
            const list = this._awardDeckGetBucketList(groupId, "冠亚季军");
            const remarks = new Set(list.map((e) => `${e?.remark || ""}`.trim()).filter(Boolean));
            if (remarks.has("冠军学校")) out.add("champion_1");
            if (remarks.has("亚军学校")) out.add("champion_2");
            if (remarks.has("季军学校")) out.add("champion_3");
        }
        if (inc.first_blood && fbLetters().length > 0) {
            out.add("first_blood");
        }
        if (inc.best_female && hasBucket("最佳女队/女生奖")) {
            out.add("best_female");
        }
        if (inc.tenacity && hasBucket("顽强拼搏奖")) {
            out.add("tenacity");
        }
        return out;
    }

    defaultAnchorForSpecialUnitId(id) {
        if (id === "champion_1" || id === "champion_2" || id === "champion_3") return "before_gold";
        return "after_bronze";
    }

    /** 规范顺序：冠校 → 最快解题（合并为一项）→ 最佳女队 → 顽强；兼容旧版 fb_* id */
    canonicalDeckSpecialUnitsOrder(ids) {
        const set = new Set(ids);
        const out = [];
        ["champion_1", "champion_2", "champion_3"].forEach((x) => {
            if (set.has(x)) out.push(x);
        });
        if (set.has("first_blood")) {
            out.push("first_blood");
        }
        const fbs = [...set].filter((x) => /^fb_[A-Z]+$/.test(x)).sort((a, b) => a.localeCompare(b));
        out.push(...fbs);
        if (set.has("best_female")) out.push("best_female");
        if (set.has("tenacity")) out.push("tenacity");
        [...set].forEach((x) => {
            if (!out.includes(x)) out.push(x);
        });
        return out;
    }

    /**
     * @param {string} groupId
     * @param {object} rules
     * @returns {{ id: string, anchor: string }[]}
     */
    resolveDeckSpecialUnitsForGroup(groupId, rules) {
        let units = this.mergePresentDeckSpecialUnits(groupId, rules);
        const phRaw = Number(rules.deck_special_order_phase);
        const ph = phRaw === 1 || phRaw === 2 ? phRaw : 0;
        const anchorBy = new Map(units.map((u) => [u.id, u.anchor]));
        const idSet = new Set(units.map((u) => u.id));
        let finalIds;
        if (ph === 0) {
            finalIds = this.canonicalDeckSpecialUnitsOrder(idSet);
        } else if (ph === 1) {
            finalIds = this.canonicalDeckSpecialUnitsOrder(idSet).slice().reverse();
        } else {
            finalIds = units.map((u) => u.id);
        }
        return finalIds.map((id) => ({
            id,
            anchor: anchorBy.has(id) ? anchorBy.get(id) : this.defaultAnchorForSpecialUnitId(id),
        }));
    }

    /**
     * 合并 present、legacy fb_*、去重后的专项列表（文件顺序），不含 phase 重排。
     * @returns {{ id: string, anchor: string }[]}
     */
    mergePresentDeckSpecialUnits(groupId, rules) {
        const inc = { ...this.getDefaultPagerRules().deck_include, ...(rules.deck_include || {}) };
        const rulesScoped = { ...rules, deck_include: inc };
        const present = this.collectPresentSpecialDeckUnitIds(groupId, rulesScoped);
        const anchors = new Set(AwardSystem.DECK_SPECIAL_ANCHORS);
        let units = Array.isArray(rules.deck_special_units) ? rules.deck_special_units.slice() : [];
        let mergedFbAnchor = null;
        const rawRows = [];
        units.forEach((u) => {
            const id = `${u?.id || ""}`.trim();
            if (/^fb_[A-Z]+$/i.test(id)) {
                const a = `${u?.anchor || ""}`;
                if (mergedFbAnchor == null && anchors.has(a)) mergedFbAnchor = a;
                return;
            }
            rawRows.push({
                id,
                anchor: anchors.has(`${u?.anchor || ""}`) ? u.anchor : "after_bronze",
            });
        });
        units = rawRows;
        if (present.has("first_blood") && !units.some((x) => x.id === "first_blood")) {
            units.push({
                id: "first_blood",
                anchor: mergedFbAnchor || this.defaultAnchorForSpecialUnitId("first_blood"),
            });
        }
        const seen = new Set();
        units = units
            .map((u) => ({
                id: `${u?.id || ""}`.trim(),
                anchor: anchors.has(`${u?.anchor || ""}`) ? u.anchor : "after_bronze",
            }))
            .filter((u) => u.id && present.has(u.id) && !seen.has(u.id) && (seen.add(u.id), true));
        const orderedIds = units.map((u) => u.id);
        present.forEach((id) => {
            if (!orderedIds.includes(id)) {
                units.push({ id, anchor: this.defaultAnchorForSpecialUnitId(id) });
                orderedIds.push(id);
            }
        });
        return units;
    }

    /**
     * 由带 anchor 的专项列表展开为「奖牌 + 专项」线性段（与旧 getAwardDeck 拼接顺序一致）。
     * @param {{ id: string, anchor: string }[]} units
     * @returns {{ kind: "medal", tier: number }|{ kind: "special", id: string }}[]
     */
    deckOrderSegmentsFromSpecialUnits(units) {
        const anchorKeys = new Set(AwardSystem.DECK_SPECIAL_ANCHORS);
        const byAnchor = { before_gold: [], after_gold: [], after_silver: [], after_bronze: [] };
        (units || []).forEach((u) => {
            const a = anchorKeys.has(`${u?.anchor || ""}`) ? u.anchor : "after_bronze";
            byAnchor[a].push(u);
        });
        const out = [];
        byAnchor.before_gold.forEach((u) => out.push({ kind: "special", id: u.id }));
        out.push({ kind: "medal", tier: 0 });
        byAnchor.after_gold.forEach((u) => out.push({ kind: "special", id: u.id }));
        out.push({ kind: "medal", tier: 1 });
        byAnchor.after_silver.forEach((u) => out.push({ kind: "special", id: u.id }));
        out.push({ kind: "medal", tier: 2 });
        byAnchor.after_bronze.forEach((u) => out.push({ kind: "special", id: u.id }));
        return out;
    }

    /** 从旧 anchor 规则迁移为线性段（无 deck_order_segments 时）。 */
    buildDeckOrderSegmentsFromLegacyAnchorUnits(groupId, rules) {
        const units = this.mergePresentDeckSpecialUnits(groupId, rules);
        return this.deckOrderSegmentsFromSpecialUnits(units);
    }

    /** 规范默认：专项用 defaultAnchor + canonical id 顺序，奖牌金→银→铜。 */
    canonicalDeckOrderSegments(groupId, rules) {
        const units = this.buildDefaultDeckSpecialUnitsForGroup(groupId);
        return this.deckOrderSegmentsFromSpecialUnits(units);
    }

    /**
     * @param {object[]} segments
     * @returns {object[]}
     */
    sanitizeDeckOrderSegments(segments, groupId, rules) {
        const inc = { ...this.getDefaultPagerRules().deck_include, ...(rules.deck_include || {}) };
        const rulesScoped = { ...rules, deck_include: inc };
        const present = this.collectPresentSpecialDeckUnitIds(groupId, rulesScoped);
        const out = [];
        const seenMedal = new Set();
        const seenSp = new Set();
        (Array.isArray(segments) ? segments : []).forEach((s) => {
            if (!s || typeof s !== "object") return;
            if (s.kind === "medal" && [0, 1, 2].includes(s.tier)) {
                if (seenMedal.has(s.tier)) return;
                seenMedal.add(s.tier);
                out.push({ kind: "medal", tier: s.tier });
            } else if (s.kind === "special") {
                const id = `${s.id || ""}`.trim();
                if (id && present.has(id) && !seenSp.has(id)) {
                    seenSp.add(id);
                    out.push({ kind: "special", id });
                }
            }
        });
        [0, 1, 2].forEach((tier) => {
            if (!seenMedal.has(tier)) {
                seenMedal.add(tier);
                out.push({ kind: "medal", tier });
            }
        });
        present.forEach((id) => {
            if (!seenSp.has(id)) {
                seenSp.add(id);
                out.push({ kind: "special", id });
            }
        });
        return out;
    }

    /** 由线性段反推 deck_special_units（锚点由段相对奖牌位置推断；同 id 多次出现时保留最后一次）。 */
    deckSpecialUnitsFromOrderSegments(segments) {
        const order = [];
        const byId = new Map();
        let lastMedalTier = -1;
        (segments || []).forEach((s) => {
            if (!s || typeof s !== "object") return;
            if (s.kind === "medal" && [0, 1, 2].includes(s.tier)) {
                lastMedalTier = s.tier;
                return;
            }
            if (s.kind !== "special" || !s.id) return;
            const id = `${s.id}`.trim();
            let anchor = "after_bronze";
            if (lastMedalTier < 0) anchor = "before_gold";
            else if (lastMedalTier === 0) anchor = "after_gold";
            else if (lastMedalTier === 1) anchor = "after_silver";
            else anchor = "after_bronze";
            if (!byId.has(id)) order.push(id);
            byId.set(id, { id, anchor });
        });
        return order.map((id) => byId.get(id)).filter(Boolean);
    }

    /**
     * 当前赛事归属下的编排段顺序（含奖牌）；结合 deck_special_order_phase。
     * @returns {{ kind: "medal", tier: number }|{ kind: "special", id: string }}[]
     */
    resolveDeckOrderSegments(groupId, rules) {
        const phRaw = Number(rules.deck_special_order_phase);
        const ph = phRaw === 1 || phRaw === 2 ? phRaw : 0;
        let base;
        if (Array.isArray(rules.deck_order_segments) && rules.deck_order_segments.length > 0) {
            base = this.sanitizeDeckOrderSegments(rules.deck_order_segments, groupId, rules);
        } else {
            base = this.buildDeckOrderSegmentsFromLegacyAnchorUnits(groupId, rules);
        }
        if (ph === 0) {
            return this.canonicalDeckOrderSegments(groupId, rules);
        }
        if (ph === 1) {
            return this.canonicalDeckOrderSegments(groupId, rules).slice().reverse();
        }
        return base;
    }

    /**
     * 多赛事归属下各归属内名次（与全局 displayRank 分离）；单归属或无映射时回落全局。
     * @param {object} item awardData 行
     * @param {string} [groupId] 编排/导出页所属 group_id，可为 __global__
     */
    getAwardDisplayRankInGroup(item, groupId) {
        if (!item) return undefined;
        const gid = groupId != null && `${groupId}`.trim() !== "" ? String(groupId) : "";
        if (gid && gid !== "__global__" && this.mapAwardByGroup && item.displayRankByGroup) {
            const v = item.displayRankByGroup[gid];
            if (v !== undefined && v !== null && v !== "") return v;
        }
        if (item.displayRank !== undefined && item.displayRank !== null) return item.displayRank;
        return item.rank;
    }

    _awardDeckRankVal(entry, groupId) {
        const it = entry?.item || entry;
        let r = this.getAwardDisplayRankInGroup(it, groupId);
        if (r === "*" || r === "—") return 999998;
        if (r != null && r !== "") {
            const n = typeof r === "number" ? r : parseInt(String(r), 10);
            if (Number.isFinite(n)) return n;
        }
        return 0;
    }

    _awardDeckGetBucketList(groupId, awardName) {
        let list = [];
        if (this.mapAwardByGroup && groupId !== "__global__") {
            const bucket = this.mapAwardByGroup[groupId];
            list = Array.isArray(bucket?.[awardName]) ? [...bucket[awardName]] : [];
        } else {
            list = Array.isArray(this.mapAward?.[awardName]) ? [...this.mapAward[awardName]] : [];
            if (groupId !== "__global__") {
                list = list.filter((entry) => {
                    const it = entry?.item || entry;
                    const gids = Array.isArray(it?.team?.group_ids) ? it.team.group_ids : [];
                    return RankToolGroupIdsIncludes(gids, groupId);
                });
            }
        }
        return list;
    }

    _awardDeckSortBucketList(list, rankFwd, groupId) {
        const gid = groupId;
        const arr = [...list];
        if (rankFwd) {
            arr.sort((a, b) => this._awardDeckRankVal(a, gid) - this._awardDeckRankVal(b, gid));
        } else {
            arr.sort((a, b) => this._awardDeckRankVal(b, gid) - this._awardDeckRankVal(a, gid));
        }
        return arr;
    }

    _awardDeckPaginateTeams(groupInfo, awardKey, awardSlotKey, list, rules, titleForChunk) {
        const deck = [];
        const pageSize = this.resolvePageSize(rules, groupInfo.group_id, awardKey);
        const rankFwd = rules.within_award_rank_forward === true;
        const sorted = this._awardDeckSortBucketList(list, rankFwd, groupInfo.group_id);
        for (let i = 0; i < sorted.length; i += pageSize) {
            const chunk = sorted.slice(i, i + pageSize);
            const pairs = chunk.map((x) => ({
                remark: `${x?.remark || ""}`.trim().toUpperCase(),
                it: x?.item || x,
            })).filter((p) => p.it?.team?.team_id);
            const rows = pairs.map((p) => p.it);
            if (rows.length === 0) continue;
            const pageIdx = Math.floor(i / pageSize) + 1;
            const pageTitle = typeof titleForChunk === "function"
                ? titleForChunk(chunk, pageIdx)
                : (titleForChunk || awardKey);
            const pageObj = {
                id: `${groupInfo.group_id}_${awardSlotKey}_${pageIdx}`.replace(/\s+/g, "_"),
                group_id: groupInfo.group_id,
                award_key: awardKey,
                award_slot_key: awardSlotKey,
                title: pageTitle,
                team_ids: rows.map((it) => it.team.team_id).filter(Boolean),
            };
            if (awardKey === "最快解题奖") {
                pageObj.fb_row_letters = pairs.map((p) => p.remark);
            }
            deck.push(pageObj);
        }
        return deck;
    }

    /**
     * @param {object} groupInfo { group_id, group_name }
     * @param {string} medalName 金奖 / 一等奖 等
     */
    buildMedalDeckPagesForGroup(groupInfo, medalName, rules) {
        const list = this._awardDeckGetBucketList(groupInfo.group_id, medalName);
        const titleBase = groupInfo.group_id === "__global__"
            ? medalName
            : `${groupInfo.group_name} ${medalName}`;
        return this._awardDeckPaginateTeams(
            groupInfo,
            medalName,
            medalName,
            list,
            rules,
            () => titleBase
        );
    }

    /**
     * @param {object} groupInfo
     * @param {{ id: string, anchor: string }} unit
     */
    buildSpecialDeckPagesForUnit(groupInfo, unit, rules) {
        const gid = groupInfo.group_id;

        if (unit.id === "best_female") {
            const list = this._awardDeckGetBucketList(gid, "最佳女队/女生奖");
            const slot = "best_female";
            const titleBase = gid === "__global__" ? "最佳女队/女生奖" : `${groupInfo.group_name} 最佳女队/女生奖`;
            return this._awardDeckPaginateTeams(groupInfo, "最佳女队/女生奖", slot, list, rules, () => titleBase);
        }
        if (unit.id === "tenacity") {
            const list = this._awardDeckGetBucketList(gid, "顽强拼搏奖");
            const slot = "tenacity";
            const titleBase = gid === "__global__" ? "顽强拼搏奖" : `${groupInfo.group_name} 顽强拼搏奖`;
            return this._awardDeckPaginateTeams(groupInfo, "顽强拼搏奖", slot, list, rules, () => titleBase);
        }
        const mCh = unit.id.match(/^champion_([123])$/);
        if (mCh) {
            const rank = mCh[1];
            const remarkMap = { 1: "冠军学校", 2: "亚军学校", 3: "季军学校" };
            const remark = remarkMap[rank];
            const full = this._awardDeckGetBucketList(gid, "冠亚季军").filter((e) => `${e?.remark || ""}`.trim() === remark);
            const slot = `school_${rank}`;
            const titleBase = gid === "__global__" ? remark : `${groupInfo.group_name} ${remark}`;
            return this._awardDeckPaginateTeams(
                groupInfo,
                "冠亚季军",
                slot,
                full,
                rules,
                () => titleBase
            ).map((p) => ({ ...p, school_remark: remark }));
        }
        if (unit.id === "first_blood") {
            const list = this._awardDeckGetBucketList(gid, "最快解题奖");
            const slot = "first_blood";
            const awardKey = "最快解题奖";
            const titleBase = gid === "__global__" ? "最快解题奖" : `${groupInfo.group_name} 最快解题奖`;
            return this._awardDeckPaginateTeams(
                groupInfo,
                awardKey,
                slot,
                list,
                rules,
                () => titleBase
            );
        }
        const mFb = unit.id.match(/^fb_([A-Z]+)$/i);
        if (mFb) {
            const letter = mFb[1].toUpperCase();
            const letterChars = letter.length > 1 ? [...letter] : [letter];
            const full = this._awardDeckGetBucketList(gid, "最快解题奖").filter((e) => {
                const L = `${e?.remark || ""}`.trim().toUpperCase();
                return letterChars.includes(L);
            });
            const slot = `fb_${letter}`;
            const awardKey = "最快解题奖";
            const titleBase = gid === "__global__"
                ? `最快解题奖 ${letter}`
                : `${groupInfo.group_name} 最快解题奖 ${letter}`;
            return this._awardDeckPaginateTeams(
                groupInfo,
                awardKey,
                slot,
                full,
                rules,
                () => titleBase
            ).map((p) => ({ ...p, fb_letter: letter }));
        }
        return [];
    }

    /**
     * 合并默认、迁移旧版 mode 字段，保证布尔维度完整。
     * @param {object|null|undefined} raw
     */
    normalizePagerRules(raw) {
        const def = this.getDefaultPagerRules();
        const merged = { ...def, ...(raw && typeof raw === "object" ? raw : {}) };
        merged.deck_include = { ...def.deck_include, ...(merged.deck_include && typeof merged.deck_include === "object" ? merged.deck_include : {}) };
        ["best_female", "tenacity", "first_blood", "champion_schools"].forEach((k) => {
            merged.deck_include[k] = !!merged.deck_include[k];
        });
        merged.award_order_forward = true;
        const ph0 = parseInt(merged.deck_special_order_phase, 10);
        merged.deck_special_order_phase = ph0 === 1 || ph0 === 2 ? ph0 : 0;
        return this.migrateLegacyPagerModeIfNeeded(merged);
    }

    migrateLegacyPagerModeIfNeeded(r) {
        const o = { ...r };
        o.award_order_forward = true;
        if (typeof o.within_award_rank_forward !== "boolean") {
            const m = o.mode;
            if (m === "forward_global" || m === "forward_by_level") {
                o.within_award_rank_forward = true;
            } else {
                o.within_award_rank_forward = false;
            }
        }
        delete o.mode;
        return o;
    }
    getDefaultDisplayConfig() {
        return {
            /** 投屏画幅：预设或自定义 w:h（1–64 整数）| fullscreen */
            aspect_mode: "16:9",
            /**
             * 用户是否明确保存过画幅。false 时打开全屏按视口建议；旧 bundle 无此字段时在 normalize 中视为 true。
             */
            pres_aspect_user: false,
            /** 幻灯壳用户缩放（布局时按视口夹紧） */
            pres_stage_zoom: 1,
            /** 名单列数：1 | 2（默认）| 3 */
            team_grid_columns: "2",
            show_member_names: true,
            show_coach: true,
            show_school: true,
            show_team_name: true,
            /** 第二语言队名（如 name_en），与主名分行 */
            show_team_name_en: false,
            show_team_id: false,
            font_scale: 1.0,
            skin: "default",
            /**
             * 全屏颁奖配色：mist 浅灰蓝 | night 深色 | honor 红金表彰（默认）| ocean 蔚蓝典礼 | jade 翠玉正式
             */
            award_pres_theme: "honor",
        };
    }

    /** 全屏展示显隐：与编排 Modal 勾选一致，兼容旧 bundle 缺字段。 */
    normalizePresentationDisplay(raw) {
        const def = this.getDefaultDisplayConfig();
        const o = { ...def, ...(raw && typeof raw === "object" ? raw : {}) };
        const allowedAspect = new Set(["4:3", "3:4", "16:9", "9:16", "9:21", "21:9", "fullscreen"]);
        const isCustomAspect = (s) => {
            const m = /^(\d{1,2}):(\d{1,2})$/.exec(String(s || "").trim());
            if (!m) return false;
            const w = parseInt(m[1], 10);
            const h = parseInt(m[2], 10);
            return w >= 1 && w <= 64 && h >= 1 && h <= 64;
        };
        if (o.ratio && (o.aspect_mode === undefined || o.aspect_mode === null || o.aspect_mode === "")) {
            o.aspect_mode = o.ratio;
        }
        const asp = String(o.aspect_mode || "").trim();
        if (asp === "fullscreen" || allowedAspect.has(asp) || isCustomAspect(asp)) {
            o.aspect_mode = asp === "fullscreen" ? "fullscreen" : asp;
        } else {
            o.aspect_mode = def.aspect_mode;
        }
        o.ratio = o.aspect_mode;
        if (raw && typeof raw === "object" && Object.prototype.hasOwnProperty.call(raw, "pres_aspect_user")) {
            o.pres_aspect_user = raw.pres_aspect_user === true;
        } else if (!raw || typeof raw !== "object" || Object.keys(raw).length === 0) {
            o.pres_aspect_user = def.pres_aspect_user;
        } else {
            /* 旧 bundle 的 display 无此字段：视为用户已定画幅，不在全屏打开时用视口覆盖 */
            o.pres_aspect_user = true;
        }
        if (typeof o.pres_stage_zoom !== "number" || !Number.isFinite(o.pres_stage_zoom) || o.pres_stage_zoom <= 0) {
            o.pres_stage_zoom = def.pres_stage_zoom;
        } else {
            o.pres_stage_zoom = Math.min(4, Math.max(0.35, o.pres_stage_zoom));
        }
        let col = String(o.team_grid_columns || "2").trim();
        if (col === "auto") {
            col = "2";
        }
        o.team_grid_columns = ["1", "2", "3"].includes(col) ? col : "2";
        [
            "show_member_names",
            "show_coach",
            "show_school",
            "show_team_name",
            "show_team_name_en",
            "show_team_id",
        ].forEach((k) => {
            o[k] = !!o[k];
        });
        if (typeof o.font_scale !== "number" || !Number.isFinite(o.font_scale) || o.font_scale <= 0) {
            o.font_scale = def.font_scale;
        }
        const allowedThemes = new Set(["mist", "night", "honor", "ruby", "ocean", "jade"]);
        const th = String(o.award_pres_theme || "").trim();
        o.award_pres_theme = allowedThemes.has(th) ? th : def.award_pres_theme;
        return o;
    }

    resolvePageSize(pagerRules, groupId, awardName) {
        const fallback = parseInt(pagerRules?.global_page_size || 16) || 16;
        const byGroup = pagerRules?.by_group || {};
        const byGroupAward = pagerRules?.by_group_award || {};
        const nestedGroupAward = byGroupAward[groupId];
        const nestedValue = nestedGroupAward && typeof nestedGroupAward === "object"
            ? nestedGroupAward[awardName]
            : null;
        const flatValue = byGroupAward[`${groupId}:${awardName}`];
        const groupValue = byGroup[groupId];
        const pick = [nestedValue, flatValue, groupValue, fallback].find(v => v !== undefined && v !== null);
        const parsed = parseInt(pick, 10);
        return Number.isFinite(parsed) && parsed > 0 ? parsed : 16;
    }
    getAwardDeckFromCurrentData(pagerRules = null) {
        const deck = [];
        const rules = this.normalizePagerRules(pagerRules || {});
        const medalNames = this.getSwitchOneTwoThree()
            ? ["一等奖", "二等奖", "三等奖"]
            : ["金奖", "银奖", "铜奖"];
        const contest = this.data?.contest || {};
        let contestGroups = Array.isArray(this.data?.contest_group)
            ? this.data.contest_group
            : (Array.isArray(contest.contest_group) ? contest.contest_group : []);
        contestGroups = contestGroups.filter((g) => g && g.group_id);
        const groupTargets = contestGroups.length > 0
            ? contestGroups.map((g) => ({ group_id: g.group_id, group_name: g.group_name || g.group_id }))
            : [{ group_id: "__global__", group_name: "全局" }];

        groupTargets.forEach((groupInfo) => {
            const gid = groupInfo.group_id;
            const orderSegs = this.resolveDeckOrderSegments(gid, rules);
            const seg = [];
            orderSegs.forEach((piece) => {
                if (piece.kind === "medal" && [0, 1, 2].includes(piece.tier)) {
                    const name = medalNames[piece.tier];
                    seg.push(...this.buildMedalDeckPagesForGroup(groupInfo, name, rules));
                } else if (piece.kind === "special" && piece.id) {
                    seg.push(...this.buildSpecialDeckPagesForUnit(groupInfo, { id: piece.id, anchor: "after_bronze" }, rules));
                }
            });
            deck.push(...seg);
        });
        return deck;
    }
    normalizeAwardBundle(rawBundle) {
        const bundle = rawBundle || {};
        return {
            version: this.bundleVersion,
            saved_at: bundle.saved_at || new Date().toISOString(),
            signature: bundle.signature || "",
            switches: {
                include_star: !!bundle?.switches?.include_star,
                all_team_based: !!bundle?.switches?.all_team_based,
                one_two_three: !!bundle?.switches?.one_two_three,
            },
            pager_rules: this.normalizePagerRules(bundle.pager_rules || {}),
            deck: Array.isArray(bundle.deck) ? bundle.deck : [],
            display: this.normalizePresentationDisplay(bundle.display || {}),
        };
    }
    validateAwardBundle(bundle) {
        if (!bundle || typeof bundle !== "object") return "文件内容不是有效的编排配置格式";
        if (!bundle.switches || typeof bundle.switches !== "object") return "配置缺少开关与模式信息";
        if (!bundle.pager_rules || typeof bundle.pager_rules !== "object") return "配置缺少分页与专项规则";
        if (!Array.isArray(bundle.deck)) return "配置缺少编排页数据";
        if (!bundle.display || typeof bundle.display !== "object") return "配置缺少展示设置";
        return "";
    }
    collectAwardBundle() {
        const prev = this.bundleState || {};
        const normalized = this.normalizeAwardBundle({
            version: this.bundleVersion,
            saved_at: new Date().toISOString(),
            signature: this.getAwardSnapshotSignature(),
            switches: {
                include_star: this.getSwitchWithStarTeam(),
                all_team_based: !this.getSwitchAcTeamBased(),
                one_two_three: this.getSwitchOneTwoThree()
            },
            pager_rules: prev.pager_rules || {},
            // 若用户已通过编排器修改了 deck，则保存其结果；否则使用当前规则自动生成的默认分页。
            deck: Array.isArray(prev.deck) && prev.deck.length > 0
                ? prev.deck
                : this.getAwardDeckFromCurrentData(prev.pager_rules || {}),
            display: this.normalizePresentationDisplay(prev.display || {}),
        });
        return normalized;
    }
    async saveAwardBundle() {
        if (!this.cache) return;
        try {
            const bundle = this.collectAwardBundle();
            this.bundleState = bundle;
            await this.cache.set(this.bundleKey, bundle, 0);
        } catch (e) {
            console.warn("saveAwardBundle failed", e);
        }
    }
    async restoreAwardBundle() {
        if (!this.cache) return;
        try {
            const bundle = await this.cache.get(this.bundleKey);
            if (!bundle || !bundle.switches) return;
            const normalized = this.normalizeAwardBundle(bundle);
            this.bundleState = normalized;
            const withStar = document.getElementById("switch_with_star_team");
            const allTeam = document.getElementById("switch_all_team_based");
            const oneTwoThree = document.getElementById("switch_one_two_three");
            if (withStar) withStar.checked = !!normalized.switches.include_star;
            if (allTeam) allTeam.checked = !!normalized.switches.all_team_based;
            if (oneTwoThree) oneTwoThree.checked = !!normalized.switches.one_two_three;
            if (window.csgSwitch && typeof window.csgSwitch.syncSwitchState === "function") {
                [withStar, allTeam, oneTwoThree].forEach((el) => {
                    if (el) window.csgSwitch.syncSwitchState(el);
                });
            }
        } catch (e) {
            console.warn("restoreAwardBundle failed", e);
        }
    }
    updateBundleWarning() {
        const warnEl = document.getElementById("award_bundle_warn");
        if (!warnEl || !this.cache) return;
        this.cache.get(this.bundleKey).then((bundle) => {
            if (!bundle || !bundle.signature) {
                warnEl.textContent = "";
                return;
            }
            const nowSig = this.getAwardSnapshotSignature();
            if (bundle.signature !== nowSig) {
                const diff = this.getBundleDeckDiff(bundle);
                warnEl.textContent = `检测到当前榜单与缓存编排不一致（缺失 ${diff.missing} / 新增 ${diff.added}），请在编排配置中点「保存应用」或检查配置。`;
            } else {
                warnEl.textContent = "";
            }
        }).catch(() => {});
    }
    getBundleDeckDiff(bundle) {
        const currentIds = new Set(
            this.awardData
                .filter(item => item.solved > 0)
                .map(item => item.team?.team_id)
                .filter(Boolean)
        );
        const deckIds = new Set();
        (bundle?.deck || []).forEach(page => {
            (page?.team_ids || []).forEach(tid => {
                if (tid) deckIds.add(tid);
            });
        });
        let missing = 0; // 在 deck 中但不在当前榜单
        let added = 0;   // 在当前榜单但不在 deck
        deckIds.forEach(tid => {
            if (!currentIds.has(tid)) missing++;
        });
        currentIds.forEach(tid => {
            if (!deckIds.has(tid)) added++;
        });
        return { missing, added };
    }
    exportAwardBundle() {
        const data = JSON.stringify(this.collectAwardBundle(), null, 2);
        const blob = new Blob([data], { type: "application/json;charset=utf-8" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `award_bundle_${this.data?.contest?.contest_id || "unknown"}.json`;
        a.click();
    }
    async importAwardBundle(e) {
        try {
            const file = e?.target?.files?.[0];
            if (!file) return;
            const text = await file.text();
            const bundle = this.normalizeAwardBundle(JSON.parse(text));
            const errMsg = this.validateAwardBundle(bundle);
            if (errMsg) throw new Error(`无效的编排配置文件：${errMsg}`);
            this.bundleState = bundle;
            const withStar = document.getElementById("switch_with_star_team");
            const allTeam = document.getElementById("switch_all_team_based");
            const oneTwoThree = document.getElementById("switch_one_two_three");
            if (withStar) withStar.checked = !!bundle.switches.include_star;
            if (allTeam) allTeam.checked = !!bundle.switches.all_team_based;
            if (oneTwoThree) oneTwoThree.checked = !!bundle.switches.one_two_three;
            if (window.csgSwitch && typeof window.csgSwitch.syncSwitchState === "function") {
                [withStar, allTeam, oneTwoThree].forEach((el) => {
                    if (el) window.csgSwitch.syncSwitchState(el);
                });
            }
            await this.cache.set(this.bundleKey, bundle, 0);
            this.refreshDataShow();
        } catch (err) {
            this.showError(err.message || "导入编排配置失败");
        } finally {
            if (e?.target) e.target.value = "";
        }
    }
    async resetAwardBundle() {
        if (!this.cache) return;
        await this.cache.delete(this.bundleKey);
        this.bundleState = null;
        const withStar = document.getElementById("switch_with_star_team");
        const allTeam = document.getElementById("switch_all_team_based");
        const oneTwoThree = document.getElementById("switch_one_two_three");
        if (withStar) withStar.checked = false;
        if (allTeam) allTeam.checked = false;
        if (oneTwoThree) oneTwoThree.checked = false;
        if (window.csgSwitch && typeof window.csgSwitch.syncSwitchState === "function") {
            [withStar, allTeam, oneTwoThree].forEach((el) => {
                if (el) window.csgSwitch.syncSwitchState(el);
            });
        }
        this.refreshDataShow();
    }

    updateBootstrapTable() {
        const groups = this.GetContestGroups();
        const groupNameMap = {};
        groups.forEach((g) => {
            if (g.group_id) groupNameMap[g.group_id] = g.group_name || g.group_id;
        });
        const metaMulti = this.IsMultiGroupEnabled();
        if (metaMulti && groups.length) {
            this.ensureAwardGroupSelection(groups);
        }
        const selectedIds = Array.isArray(this.selectedAwardGroupIds) ? this.selectedAwardGroupIds.filter((id) =>
            groups.some((g) => g.group_id === id)
        ) : [];
        /** 与 mergeMapAwardFromGroups 的赛事归属顺序一致，保证 award_fb_letters 与多赛事归属块消费顺序对齐 */
        const contestGroupOrderIds = groups.map((g) => g.group_id).filter(Boolean);
        const selectedIdSet = new Set(selectedIds.map((id) => String(id)));
        const selectedSet = metaMulti && selectedIds.length > 0 && selectedIds.length < groups.length
            ? new Set(selectedIds)
            : null;
        const showGroupedAwardUi = metaMulti && selectedIds.length > 1;

        let sourceList = this.awardData;
        if (metaMulti && selectedIds.length > 0 && selectedIds.length < groups.length) {
            sourceList = sourceList.filter((item) => {
                const gids = Array.isArray(item.team?.group_ids) ? item.team.group_ids : [];
                return RankToolGroupIdsOverlap(gids, selectedIds);
            });
        }

        const tableData = sourceList.map((item) => {
            const team = item.team;
            const gids = Array.isArray(team?.group_ids) ? team.group_ids : [];
            const filterIds = metaMulti && selectedIds.length
                ? contestGroupOrderIds.filter((id) => RankToolGroupIdListHas(selectedIds, id))
                : gids;
            const normalizedGids = gids.filter((gid) => filterIds.some((fid) => RankToolGroupIdKey(fid) === RankToolGroupIdKey(gid)));
            const groupLabels = normalizedGids.map((gid) => ({ id: gid, name: groupNameMap[gid] || gid }));

            let displayAwards = item.awards || [];
            const awardBlocks = [];
            if (metaMulti && item.awardsByGroup) {
                filterIds.forEach((gid) => {
                    if (!RankToolGroupIdsIncludes(gids, gid)) return;
                    const aw = (item.awardsByGroup[gid] || []).slice();
                    if (aw.length) {
                        awardBlocks.push({ id: gid, name: groupNameMap[gid] || gid, awards: aw });
                    }
                });
                if (selectedIds.length === 1) {
                    const only = selectedIds[0];
                    displayAwards = (item.awardsByGroup && item.awardsByGroup[only]) ? item.awardsByGroup[only].slice() : [];
                } else {
                    displayAwards = [];
                }
            }

            let flg = item.flg_award || 0;
            if (metaMulti && item.flg_award_by_group && filterIds.length) {
                let best = 0;
                filterIds.forEach((gid) => {
                    if (!RankToolGroupIdsIncludes(gids, gid)) return;
                    const v = parseInt(item.flg_award_by_group[gid], 10) || 0;
                    if (v > 0 && (best === 0 || v < best)) best = v;
                });
                flg = best;
            }

            const showMultiRankDots = showGroupedAwardUi && metaMulti;
            const rankGroupMedals = showMultiRankDots && filterIds.length
                ? filterIds.map((gid) => ({
                    group_id: gid,
                    group_name: groupNameMap[gid] || gid,
                    in_group: RankToolGroupIdsIncludes(gids, gid),
                    flg: RankToolGroupIdsIncludes(gids, gid) ? (parseInt(item.flg_award_by_group?.[gid], 10) || 0) : 0,
                }))
                : [];

            let rankForCol = item.displayRank;
            if (metaMulti && item.displayRankByGroup && filterIds.length) {
                const hitG = filterIds.find((x) => RankToolGroupIdsIncludes(gids, x) && item.displayRankByGroup[x] != null);
                if (hitG != null) rankForCol = item.displayRankByGroup[hitG];
            }

            return {
                rank: rankForCol,
                rank_order: item.rank_order,
                awards: displayAwards,
                award_fb_letters: Array.isArray(item.awardFbLetters) ? item.awardFbLetters.slice() : [],
                award_group_blocks: awardBlocks,
                show_grouped_award_ui: showGroupedAwardUi,
                show_multi_rank_dots: showMultiRankDots,
                rank_group_medals: rankGroupMedals,
                group_affiliations_csv: normalizedGids.join(","),
                group_labels: groupLabels,
                is_multi_group: showGroupedAwardUi,
                flg_award: flg,
                name: team?.name || "",
                name_en: team?.name_en || "",
                tkind: team?.tkind || 0,
                solved: item.solved || 0,
                penalty: this.validatePenalty(item.penalty),
                school: team?.school || "-",
                members: team?.tmember || "-",
                coach: team?.coach || "-",
                team_id: team?.team_id || "-",
            };
        });
        const table = document.getElementById("award_table");
        if (table) {
            table.style.display = "table";
        }
        $("#award_table").bootstrapTable("load", tableData);
    }

    /** @returns {{ mode: 'global'|'one'|'many', ids: string[] }} */
    getExportGroupMode() {
        const groups = this.GetContestGroups();
        if (!this.IsMultiGroupEnabled() || !groups.length) {
            return { mode: "global", ids: [] };
        }
        this.ensureAwardGroupSelection(groups);
        const ids = (this.selectedAwardGroupIds || []).filter((id) => groups.some((g) => g.group_id === id));
        if (ids.length <= 1) return { mode: "one", ids: ids.length ? ids : [groups[0].group_id] };
        return { mode: "many", ids };
    }

    getMapAwardForExportGroup(groupId) {
        if (this.mapAwardByGroup && groupId && this.mapAwardByGroup[groupId]) {
            return this.mapAwardByGroup[groupId];
        }
        return this.mapAward;
    }

    /**
     * 导出前确认弹窗（alerty 对象参数；正文为单块 HTML，每句中文下紧跟对应英文，与全站 csg-bilingual-stack 一致，勿传 message_en 以免 alerty 左右分栏）
     * @param {'csv'|'xlsx'} kind
     * @param {() => void} onConfirm
     */
    buildAwardExportConfirmAlertyOptions(kind, onConfirm) {
        const isCsv = kind === "csv";
        const labelCn = isCsv ? "CSV" : "Excel";
        const labelEn = isCsv ? "CSV" : "Excel";
        const message = `
<div class="award-export-confirm">
  <p class="award-export-confirm__lead small mb-3 csg-bilingual-stack">
    <span class="cn-text">导出前请确认以下条件均已满足：</span>
    <span class="en-text">Please confirm the following before exporting.</span>
  </p>
  <ul class="award-export-confirm__checks list-unstyled">
    <li>
      <span class="award-export-confirm__num" aria-hidden="true">1</span>
      <div class="award-export-confirm__body csg-bilingual-stack">
        <span class="cn-text">比赛已<strong class="text-danger">正式结束</strong>（未结束前导出可能产生误导）。</span>
        <span class="en-text">The contest has <strong class="text-danger">officially ended</strong>; exporting earlier may be misleading.</span>
      </div>
    </li>
    <li>
      <span class="award-export-confirm__num" aria-hidden="true">2</span>
      <div class="award-export-confirm__body csg-bilingual-stack">
        <span class="cn-text">评测队列已<strong class="text-danger">全部完成</strong>，无待判题目。</span>
        <span class="en-text">The judging queue is <strong class="text-danger">fully finished</strong> (no pending runs).</span>
      </div>
    </li>
    <li>
      <span class="award-export-confirm__num" aria-hidden="true">3</span>
      <div class="award-export-confirm__body csg-bilingual-stack">
        <span class="cn-text">已<strong class="text-primary">刷新本页</strong>，以加载最新榜单与获奖计算结果后再导出最终文件。</span>
        <span class="en-text">You have <strong class="text-primary">refreshed this page</strong> for the latest standings and award calculation before exporting.</span>
      </div>
    </li>
  </ul>
  <div class="award-export-confirm__foot small csg-bilingual-stack">
    <span class="cn-text">确认当前表格与开关无误后，点击下方按钮导出 <strong>${labelCn}</strong>。</span>
    <span class="en-text">If the table and switches look correct, click below to export <strong>${labelEn}</strong>.</span>
  </div>
</div>`;
        return {
            title: `导出 ${labelCn} 前确认<span class="en-text">Confirm before ${labelEn} export</span>`,
            size: "lg",
            message,
            okText: `确认导出 ${labelCn}<span class="en-text">Export ${labelEn}</span>`,
            cancelText: `取消<span class="en-text">Cancel</span>`,
            callback: onConfirm,
        };
    }

    exportCSV() {
        const opts = this.buildAwardExportConfirmAlertyOptions("csv", () => this.doExportCSV());
        alerty.confirm(opts);
    }

    doExportCSV() {
        const awardTitle = ["排名", "学校", "队名", "选手", "教练", "账号", "备注"];
        const blocks = this.buildAwardXlsxExportBlocks();
        const sections = [];
        blocks.forEach((b) => {
            const mapSrc = b.mapSrc;
            const lines = [];
            const secLabel = String(b.prefix || "").replace(/-+$/, "").trim();
            if (blocks.length > 1 || secLabel) {
                if (secLabel) lines.push(`\n【${secLabel}】\n`);
            }
            lines.push(`获奖名单-${this.contestTitle}`);
            for (let i = 0; i < this.awardToExport.length; i++) {
                const awardName = this.awardToExport[i];
                lines.push(`\n${awardName}\n`);
                lines.push(awardTitle.join(",") + "\n");
                const bucket = mapSrc[awardName] || [];
                const exportGid = b.exportRankGroupId || "";
                for (let j = 0; j < bucket.length; j++) {
                    const item = bucket[j];
                    const line = this.makeLineTeam(item, exportGid);
                    lines.push(line.join(",") + "\n");
                }
            }
            sections.push(lines.join(""));
        });

        const blob = new Blob(["\uFEFF" + sections.join("\n")], {
            type: "text/plain;charset=utf-8",
        });
        const downloadLink = document.createElement("a");
        downloadLink.href = URL.createObjectURL(blob);
        downloadLink.download = this.generateExportFilename('csv');
        downloadLink.click();
    }

    exportXLSX() {
        const opts = this.buildAwardExportConfirmAlertyOptions("xlsx", () => this.doExportXLSX());
        alerty.confirm(opts);
    }

    buildAwardXlsxExportBlocks() {
        const g = this.getExportGroupMode();
        const groups = this.GetContestGroups();
        const nm = {};
        groups.forEach((x) => {
            if (x.group_id) nm[x.group_id] = x.group_name || x.group_id;
        });
        if (g.mode === "many") {
            return g.ids.map((gid) => ({
                mapSrc: this.getMapAwardForExportGroup(gid),
                prefix: `${nm[gid] || gid}-`,
                rankRows: this.awardData.filter((r) => (r.team?.group_ids || []).includes(gid)),
                exportRankGroupId: gid,
            }));
        }
        if (g.mode === "one") {
            const gid = g.ids[0];
            const contestMultiGroup = groups.length > 1;
            return [{
                mapSrc: this.getMapAwardForExportGroup(gid),
                prefix: contestMultiGroup ? `${nm[gid] || gid}-` : "",
                rankRows: this.awardData,
                exportRankGroupId: contestMultiGroup ? gid : "",
            }];
        }
        return [{ mapSrc: this.mapAward, prefix: "", rankRows: this.awardData, exportRankGroupId: "" }];
    }

    async doExportXLSX() {
        try {
            const alignmentTitle = {
                vertical: "middle",
                horizontal: "center",
                wrapText: true,
            };

            const columnsWidth = [
                { width: 5 },
                { width: 16 },
                { width: 16 },
                { width: 25 },
                { width: 8 },
                { width: 8 },
                { width: 9 },
                { width: 22 },
            ];

            const titleRowStyle = {
                font: { bold: true, size: 16 },
                alignment: { horizontal: "center" },
            };

            const headerRowStyle = { font: { bold: true } };

            const wb = new ExcelJS.Workbook();
            wb.creator = "Me";
            wb.lastModifiedBy = "Me";
            wb.created = new Date();
            wb.modified = new Date();

            const awardTitle = [
                "排名",
                "学校",
                "队名",
                "选手",
                "教练",
                "账号",
                "备注",
            ];

            const cleanTitle = csg.sanitizeFilename(this.contestTitle);
            const sheetSafe = (base) => {
                let s = csg.sanitizeFilename(String(base || "")).replace(/[:\\/?*[\]]/g, "_");
                if (s.length > 31) s = s.slice(0, 31);
                return s || "Sheet";
            };

            const exportBlocks = this.buildAwardXlsxExportBlocks();
            for (let bi = 0; bi < exportBlocks.length; bi++) {
                const mapSrc = exportBlocks[bi].mapSrc;
                const prefix = exportBlocks[bi].prefix || "";
                const rankRows = exportBlocks[bi].rankRows || this.awardData;
                const exportRankGroupId = exportBlocks[bi].exportRankGroupId || "";

                const allAwardsSplitSheetData = [];
                const allAwardsMergedSheetData = [];
                const wsDataList = [];

                for (let i = 0; i < this.awardToExport.length; i++) {
                    const awardName = this.awardToExport[i];
                    const wsData = [];
                    wsData.push([`获奖名单-${cleanTitle}`]);
                    wsData.push([awardName]);
                    wsData.push(awardTitle);

                    const bucket = mapSrc[awardName] || [];
                    for (let j = 0; j < bucket.length; j++) {
                        const teamLine = this.makeLineTeam(bucket[j], exportRankGroupId);
                        wsData.push(teamLine);
                    }

                    allAwardsSplitSheetData.push(wsData);

                    for (let k = i === 0 ? 2 : 3; k < wsData.length; k++) {
                        allAwardsMergedSheetData.push(
                            wsData[k].concat([k === 2 ? "奖项" : awardName])
                        );
                    }
                    wsDataList.push(wsData);
                }

            // 添加所有奖项-分项 sheet
            const allAwardsSplitSheet = wb.addWorksheet(sheetSafe(`${prefix}所有奖项-分项`), {
                views: [{ xSplit: 1, ySplit: 1 }],
            });
            allAwardsSplitSheet.columns = columnsWidth;

            const allAwardsSplitSheetTitle = allAwardsSplitSheet.addRow([
                `获奖名单-${cleanTitle}`,
            ]);
            allAwardsSplitSheetTitle.height = 40;
            allAwardsSplitSheetTitle.eachCell((cell) => {
                Object.assign(cell.style, titleRowStyle);
            });
            allAwardsSplitSheetTitle.alignment = alignmentTitle;

            allAwardsSplitSheetData.forEach((wsData, index) => {
                for (let i = 1; i < wsData.length; i++) {
                    const row = wsData[i];
                    const excelRow = allAwardsSplitSheet.addRow(row);
                    if (i === 1) {
                        excelRow.eachCell((cell) => {
                            Object.assign(cell.style, titleRowStyle);
                        });
                        excelRow.alignment = alignmentTitle;
                        const rowNumber = excelRow.number;
                        const mergeRange = `A${rowNumber}:G${rowNumber}`;
                        allAwardsSplitSheet.mergeCells(mergeRange);
                        excelRow.height = 30;
                    } else {
                        if (i === 2) {
                            excelRow.eachCell((cell) => {
                                Object.assign(cell.style, headerRowStyle);
                            });
                        }
                        excelRow.eachCell((cell) => {
                            cell.border = {
                                top: { style: "thin" },
                                left: { style: "thin" },
                                bottom: { style: "thin" },
                                right: { style: "thin" },
                            };
                        });
                    }
                }
            });
            allAwardsSplitSheet.mergeCells("A1:G1");

            // 添加所有奖项-合并 sheet
            const allAwardsMergedSheet = wb.addWorksheet(sheetSafe(`${prefix}所有奖项-合并`), {
                views: [{ xSplit: 1, ySplit: 1 }],
            });
            allAwardsMergedSheet.columns = columnsWidth;

            const allAwardsMergedSheetTitle = allAwardsMergedSheet.addRow([
                `获奖名单-${cleanTitle}`,
            ]);
            allAwardsMergedSheetTitle.height = 40;
            allAwardsMergedSheetTitle.eachCell((cell) => {
                Object.assign(cell.style, titleRowStyle);
            });
            allAwardsMergedSheetTitle.alignment = alignmentTitle;

            allAwardsMergedSheetData.forEach((row, index) => {
                const excelRow = allAwardsMergedSheet.addRow(row);
                if (index === 0) {
                    excelRow.eachCell((cell) => {
                        Object.assign(cell.style, headerRowStyle);
                    });
                }
                excelRow.eachCell((cell) => {
                    cell.border = {
                        top: { style: "thin" },
                        left: { style: "thin" },
                        bottom: { style: "thin" },
                        right: { style: "thin" },
                    };
                    cell.alignment = "right";
                });
            });
            allAwardsMergedSheet.mergeCells("A1:H1");

            // 各奖项sheet
            for (let i = 0; i < wsDataList.length; i++) {
                const awardName = this.awardToExport[i];
                const wsData = wsDataList[i];
                const ws = wb.addWorksheet(sheetSafe(`${prefix}${awardName.replace(/[:\\/?*[\]]/g, "")}`));

                wsData.forEach((row, index) => {
                    const excelRow = ws.addRow(row);
                    if (index === 0) {
                        excelRow.height = 40;
                    } else if (index === 1) {
                        excelRow.height = 30;
                    }
                    if (index < 2) {
                        excelRow.eachCell((cell) => {
                            Object.assign(cell.style, titleRowStyle);
                        });
                        excelRow.alignment = alignmentTitle;
                    } else {
                        if (index === 2) {
                            excelRow.eachCell((cell) => {
                                Object.assign(cell.style, headerRowStyle);
                            });
                        }
                        excelRow.eachCell((cell) => {
                            cell.border = {
                                top: { style: "thin" },
                                left: { style: "thin" },
                                bottom: { style: "thin" },
                                right: { style: "thin" },
                            };
                        });
                    }
                });
                ws.mergeCells("A1:G1");
                ws.mergeCells("A2:G2");
                ws.columns = columnsWidth;
            }

            // 完整排名sheet
            const allRankSheet = wb.addWorksheet(sheetSafe(`${prefix}完整排名`));
            allRankSheet.columns = [
                { width: 5 },
                { width: 20 },
                { width: 20 },
                { width: 25 },
                { width: 6 },
                { width: 6 },
                { width: 6 },
                { width: 6 },
                { width: 6 },
                { width: 8 },
            ];

            const allRankSheetTitle = allRankSheet.addRow([
                `完整排名-${cleanTitle}`,
            ]);
            allRankSheetTitle.height = 40;
            allRankSheetTitle.eachCell((cell) => {
                Object.assign(cell.style, titleRowStyle);
            });
            allRankSheetTitle.alignment = alignmentTitle;

            const excelRow = allRankSheet.addRow([
                "排名",
                "学校",
                "队名",
                "选手",
                "教练",
                "类型",
                "题数",
                "罚时",
                "校排",
                "队号",
                "备注",
            ]);
            excelRow.eachCell((cell) => {
                Object.assign(cell.style, headerRowStyle);
                cell.border = {
                    top: { style: "thin" },
                    left: { style: "thin" },
                    bottom: { style: "thin" },
                    right: { style: "thin" },
                };
            });

            rankRows.forEach((row) => {
                const rankCell = exportRankGroupId
                    ? this.getAwardDisplayRankInGroup(row, exportRankGroupId)
                    : (row.displayRank || row.rank);
                const excelRow = allRankSheet.addRow([
                    rankCell,
                    row.team.school,
                    row.team.name,
                    row.team.tmember,
                    row.team.coach,
                    this.getTeamTypeText(row.team?.tkind || row.team.tkind),
                    row.solved,
                    row.penalty,
                    isNaN(parseInt(row.team?.school_rank || row.team.school_rank))
                        ? ""
                        : row.team?.school_rank || row.team.school_rank,
                    row.team?.team_id,
                    "",
                ]);
                excelRow.eachCell((cell) => {
                    cell.border = {
                        top: { style: "thin" },
                        left: { style: "thin" },
                        bottom: { style: "thin" },
                        right: { style: "thin" },
                    };
                });
            });
            allRankSheet.mergeCells("A1:K1");

            }

            // 导出文件
            const buffer = await wb.xlsx.writeBuffer();
            const blob = new Blob([buffer], {
                type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = this.generateExportFilename('xlsx');
            a.click();
        } catch (error) {
            console.error("导出Excel失败:", error);
            alerty.error("导出Excel失败，请检查数据");
        }
    }

    makeLineTeam(item, exportRankGroupId) {
        let remark = "";
        if ("remark" in item) {
            remark = item.remark;
            item = item.item;
        }
        const team = item.team;
        const gid = exportRankGroupId != null && `${exportRankGroupId}`.trim() !== ""
            ? String(exportRankGroupId)
            : "";
        const rankCell = gid ? this.getAwardDisplayRankInGroup(item, gid) : (item.displayRank ?? item.rank);
        return [
            rankCell,
            team.school,
            team.name,
            team.tmember,
            team.coach,
            team.team_id,
            remark,
        ];
    }

    validatePenalty(penalty) {
        if (!penalty) return 0;

        // 如果已经是数字（秒数），直接返回
        if (typeof penalty === "number") {
            return Math.floor(penalty);
        }

        // 如果是字符串，解析为秒数
        if (typeof penalty === "string") {
            // 处理 "HH:MM:SS" 格式
            if (penalty.includes(':')) {
                const parts = penalty.split(':');
                if (parts.length === 3) {
                    const hours = parseInt(parts[0]) || 0;
                    const minutes = parseInt(parts[1]) || 0;
                    const seconds = parseInt(parts[2]) || 0;
                    return hours * 3600 + minutes * 60 + seconds;
                } else if (parts.length === 2) {
                    // 处理 "MM:SS" 格式
                    const minutes = parseInt(parts[0]) || 0;
                    const seconds = parseInt(parts[1]) || 0;
                    return minutes * 60 + seconds;
                }
            }
            // 处理纯数字字符串
            const numValue = parseInt(penalty);
            return isNaN(numValue) ? 0 : numValue;
        }

        // 其他情况返回0
        return 0;
    }

    getTeamTypeText(tkind) {
        const typeMap = {
            0: "常规队",
            1: "女队",
            2: "打星队",
        };
        return typeMap[tkind] || "未知";
    }

    generateExportFilename(extension) {
        const isOneTwoThree = this.getSwitchOneTwoThree();
        const includeStar = this.getSwitchWithStarTeam();
        const acTeamBased = this.getSwitchAcTeamBased();
        const modeText = isOneTwoThree ? '一二三' : '金银铜';
        const starText = includeStar ? '含打星' : '不含打星';
        const baseText = acTeamBased ? '过题基数' : '总数基数';
        const now = new Date();
        const timestamp = now.getFullYear().toString() +
            (now.getMonth() + 1).toString().padStart(2, '0') +
            now.getDate().toString().padStart(2, '0') +
            now.getHours().toString().padStart(2, '0') +
            now.getMinutes().toString().padStart(2, '0') +
            now.getSeconds().toString().padStart(2, '0');
        const cleanTitle = csg.sanitizeFilename(this.contestTitle);
        const g = this.getExportGroupMode();
        let groupSeg = "";
        if (g.mode === "one" && g.ids[0]) {
            const groups = this.GetContestGroups();
            const hit = groups.find((x) => x.group_id === g.ids[0]);
            groupSeg = `-${csg.sanitizeFilename(hit?.group_name || g.ids[0])}`;
        } else if (g.mode === "many") {
            groupSeg = "-多赛事归属";
        }
        return `获奖名单-${cleanTitle}${groupSeg}-${modeText}-${starText}-${baseText}-${timestamp}.${extension}`;
    }

    showError(message) {
        // 显示错误信息，隐藏表格
        const table = document.getElementById("award_table");
        if (table) {
            table.style.display = "none";
        }

        // 在表格位置显示错误信息
        const tableContainer = table?.parentElement;
        if (tableContainer) {
            tableContainer.innerHTML = `
                <div class="alert alert-danger" role="alert">
                    <i class="bi bi-exclamation-triangle me-2"></i>${message}
                </div>
            `;
        }
    }
}

// 导出 AwardSystem 类供外部使用
window.AwardSystem = AwardSystem;

/** 奖项展示顺序：冠亚季军类 → 金银铜 → 最快解题等（数值越小越靠前） */
function AwardTagSortKey(s) {
    const a = `${s || ""}`.trim();
    if (!a) return 999;
    if (/季军学校/.test(a)) return 12;
    if (/亚军学校/.test(a)) return 11;
    if (/冠军学校/.test(a)) return 10;
    if (/季军/.test(a) && !/学校/.test(a)) return 15;
    if (/亚军/.test(a) && !/学校/.test(a)) return 14;
    if (/冠军/.test(a) && !/学校/.test(a)) return 13;
    if (/金奖|一等奖/.test(a)) return 20;
    if (/银奖|二等奖/.test(a)) return 21;
    if (/铜奖|三等奖/.test(a)) return 22;
    if (/最快解题奖/.test(a)) return 35;
    if (/最佳女队|女生奖/.test(a)) return 40;
    if (/顽强拼搏奖/.test(a)) return 90;
    return 50;
}

function SortAwardStringsForDisplay(arr) {
    const copy = (arr || []).map((x) => `${x || ""}`.trim()).filter(Boolean);
    copy.sort((a, b) => AwardTagSortKey(a) - AwardTagSortKey(b) || a.localeCompare(b, "zh"));
    return copy;
}

function FormatPlainAwardChipHtml(awardRaw) {
    const award = `${awardRaw || ""}`.trim();
    if (!award) return "";
    const cls = GetAwardTagClass(award);
    return `<span class="award-tag award-tag--compact ${cls}">${RankToolEscapeHtml(award)}</span>`;
}

function FormatMergedFirstBloodChipHtml(letterList) {
    const letters = (letterList || []).map((x) => `${x || ""}`.trim().toUpperCase()).filter(Boolean);
    if (!letters.length) return "";
    const inner = letters.map((pid) => {
        const color = ResolveProblemBalloonColorByAlpha(pid);
        return `<span class="award-problem-id" style="color:${RankToolEscapeHtml(color)}">${RankToolEscapeHtml(pid)}</span>`;
    }).join("");
    return `<span class="award-tag award-tag--compact award-tag-first-blood award-tag-fb-merged"><span class="award-tag-fb-label">最快解题奖</span><span class="award-tag-fb-letters">${inner}</span></span>`;
}

/**
 * @param {string[]} sortedList 已排序的奖项文案（含多条「最快解题奖」或 legacy 带括号）
 * @param {{ letters: string[], ptr: number }} fbQueue
 */
function BuildAwardChipsFromSortedList(sortedList, fbQueue) {
    const legacy = /^最快解题奖\(([A-Z]+)\)$/;
    const parts = [];
    let i = 0;
    const letters = fbQueue && Array.isArray(fbQueue.letters) ? fbQueue.letters : [];
    let ptr = typeof fbQueue?.ptr === "number" ? fbQueue.ptr : 0;
    while (i < sortedList.length) {
        const a = sortedList[i];
        const lm = typeof a === "string" && a.match(legacy);
        if (a === "最快解题奖" || lm) {
            const batch = [];
            while (i < sortedList.length) {
                const b = sortedList[i];
                const m = typeof b === "string" && b.match(legacy);
                if (b === "最快解题奖") {
                    const pid = letters[ptr++];
                    if (pid) batch.push(String(pid));
                    i++;
                } else if (m) {
                    batch.push(m[1]);
                    i++;
                } else {
                    break;
                }
            }
            const chip = FormatMergedFirstBloodChipHtml(batch);
            if (chip) parts.push(chip);
        } else {
            parts.push(FormatPlainAwardChipHtml(a));
            i++;
        }
    }
    if (fbQueue) fbQueue.ptr = ptr;
    return parts.join("");
}

// 全局格式化函数
function AwardGrpBlockHtml(blk, chips) {
    const gid = blk.id || blk.name || "";
    const gname = RankToolEscapeHtml(blk.name || blk.id || "");
    const colors =
        typeof csg !== "undefined" && csg.hashColorSchemeAffiliationPanel
            ? csg.hashColorSchemeAffiliationPanel(gid)
            : { headerStyle: "", dotStyle: "", nameStyle: "" };
    const hdStyle = colors.headerStyle ? ` style="${colors.headerStyle}"` : "";
    const dotStyle = colors.dotStyle ? ` style="${colors.dotStyle}"` : "";
    const nmStyle = colors.nameStyle ? ` style="${colors.nameStyle}"` : "";
    const body = chips || '<span class="text-muted small">—</span>';
    return (
        '<div class="award-grp-block">' +
        `<div class="award-grp-block__hd"${hdStyle}>` +
        `<span class="award-grp-block__dot"${dotStyle}></span>` +
        `<span class="award-grp-block__nm"${nmStyle}>${gname}</span>` +
        '</div>' +
        `<div class="award-grp-block__bd">${body}</div>` +
        '</div>'
    );
}

function FormatterAward(value, row, index) {
    const fbQueue = {
        letters: Array.isArray(row.award_fb_letters) ? row.award_fb_letters.slice() : [],
        ptr: 0,
    };
    const blocks = Array.isArray(row.award_group_blocks) ? row.award_group_blocks : [];
    if (row.show_grouped_award_ui && blocks.length) {
        const parts = blocks.map((blk) => {
            const raw = Array.isArray(blk.awards) ? blk.awards : [];
            const sorted = SortAwardStringsForDisplay(raw);
            const chips = BuildAwardChipsFromSortedList(sorted, fbQueue);
            return AwardGrpBlockHtml(blk, chips);
        });
        return `<div class="award-grp-stack">${parts.join("")}</div>`;
    }
    const list = Array.isArray(row.awards) ? row.awards : [];
    if (!list.length) return "-";
    const sorted = SortAwardStringsForDisplay(list);
    const chips = BuildAwardChipsFromSortedList(sorted, fbQueue);
    return `<div class="award-tag-wrap award-tag-wrap--lux">${chips}</div>`;
}

function FormatterAwardTeamName(value, row, index) {
    if(row?.name_en) {
        value += `<span class="en-text">${row?.name_en}</span>`;
    }
    return `<span class="bilingual-label award-cell-team">${value || "-"}</span>`;
}

function FormatterAwardTkind(value, row, index) {
    // 复用 rank.js 的 GetTeamTypeIcon 方法，flg_render=false 获取值后自定义
    if (window.rankSystem && window.rankSystem.GetTeamTypeIcon) {
        const iconKeyMap = {
            0: "team-regular", // 常规队
            1: "team-girl", // 女队
            2: "team-star", // 打星队
        };
        const iconKey = iconKeyMap[value] || "team-regular";

        // 配色：regular用primary，star用warning，girl用danger
        const colorMap = {
            0: "text-primary", // 常规队 - primary
            1: "text-danger", // 女队 - danger
            2: "text-warning", // 打星队 - warning
        };
        const colorClass = colorMap[value] || "text-primary";

        const iconMap = {
            0: "bi-flag-fill", // 常规队
            1: "bi-heart", // 女队
            2: "bi-star", // 打星队
        };
        const iconClass = iconMap[value] || "bi-flag-fill";

        return `<i class="bi ${iconClass} ${colorClass}" title="${value === 0 ? "常规队伍" : value === 1 ? "女队" : "打星队伍"
            }"></i>`;
    }

    // 降级方案
    const icons = {
        0: '<i class="bi bi-flag-fill text-primary" title="常规队伍"></i>',
        1: '<i class="bi bi-heart text-danger" title="女队"></i>',
        2: '<i class="bi bi-star text-warning" title="打星队伍"></i>',
    };
    return icons[value] || '<i class="bi bi-people text-muted"></i>';
}

function FormatterAwardPenalty(value, row, index) {
    const displayTime = RankToolFormatSecondsToMinutes(value);
    const fullTime = RankToolFormatSecondsToHMS(value);

    return `<span class="award-cell-penalty" title="完整时间: ${fullTime}">${displayTime}</span>`;
}

function FormatterAwardSchool(value, row, index) {
    return `<div class="award-cell-school">${value || "-"}</div>`;
}

function FormatterAwardMembers(value, row, index) {
    return `<div class="award-cell-members">${value || "-"}</div>`;
}

function FormatterAwardCoach(value, row, index) {
    return `<div class="award-cell-coach">${value || "-"}</div>`;
}

function FormatterAwardTeamId(value, row, index) {
    return value || "-";
}

function AwardRankDotTitleForGroup(d) {
    const gname = d.group_name || d.group_id || "";
    const gid = d.group_id || d.group_name || "";
    if (!d.in_group) {
        return `${gname}：本队未归入该赛事归属\n${gid}: team not in this affiliation`;
    }
    if (d.flg === 1) return `${gname}：金牌\n${gid}: Gold`;
    if (d.flg === 2) return `${gname}：银牌\n${gid}: Silver`;
    if (d.flg === 3) return `${gname}：铜牌\n${gid}: Bronze`;
    return `${gname}：该赛事归属内无金银铜\n${gid}: no medal in this affiliation`;
}

function FormatterAwardRank(value, row, index) {
    if (row.show_multi_rank_dots && Array.isArray(row.rank_group_medals) && row.rank_group_medals.length) {
        const dots = row.rank_group_medals.map((d) => {
            let dotClass = "award-rank-dot award-rank-dot--none";
            if (d.in_group && d.flg === 1) dotClass = "award-rank-dot award-rank-dot--gold";
            else if (d.in_group && d.flg === 2) dotClass = "award-rank-dot award-rank-dot--silver";
            else if (d.in_group && d.flg === 3) dotClass = "award-rank-dot award-rank-dot--bronze";
            const title = AwardRankDotTitleForGroup(d);
            const titleAttr =
                typeof csg !== "undefined" && csg.formatHtmlTitleAttr
                    ? csg.formatHtmlTitleAttr(title, { preline: true })
                    : RankToolEscapeHtml(title);
            return `<span class="${dotClass}" title="${titleAttr}" data-csg-tooltip-preline="true"></span>`;
        }).join("");
        const num = RankToolEscapeHtml(row.rank != null ? String(row.rank) : "");
        return `<span class="award-rank-cell"><span class="award-rank-num">${num}</span><span class="award-rank-dots">${dots}</span></span>`;
    }

    let rankClass = "";
    if (row.flg_award == 1) {
        rankClass = "bg-warning text-dark"; // 金色
    } else if (row.flg_award == 2) {
        rankClass = "bg-secondary text-white"; // 银色
    } else if (row.flg_award == 3) {
        rankClass = "bg-danger text-white"; // 铜色
    } else {
        rankClass = "bg-light text-dark"; // 其他 - 灰色
    }
    return `<span class="badge ${rankClass} award-rank-badge">${row.rank}</span>`;
}

function FormatterAwardSolved(value, row, index) {
    return `<span class="award-cell-solved">${value}</span>`;
}

function GetAwardTagClass(award) {
    if (/金奖|一等奖/.test(award)) return "award-tag-gold";
    if (/银奖|二等奖/.test(award)) return "award-tag-silver";
    if (/铜奖|三等奖/.test(award)) return "award-tag-bronze";
    if (/冠军/.test(award)) return "award-tag-champion";
    if (/亚军/.test(award)) return "award-tag-runnerup";
    if (/季军/.test(award)) return "award-tag-third";
    if (/最快解题奖/.test(award)) return "award-tag-first-blood";
    if (/最佳女队|女生奖/.test(award)) return "award-tag-girl";
    if (/顽强拼搏奖/.test(award)) return "award-tag-tenacity";
    return "award-tag-default";
}

function ConvertProblemAlphaToNum(alpha) {
    const s = String(alpha || "").trim().toUpperCase();
    if (!/^[A-Z]+$/.test(s)) return null;
    let n = 0;
    for (let i = 0; i < s.length; i++) {
        const v = s.charCodeAt(i) - 65; // A=0
        n = n * 26 + (v + 1);
    }
    // Excel 风格转零基：A=0, Z=25, AA=26
    return n - 1;
}

/** 与榜单题头气球一致：使用 contest.problem[].color + RankToolParseColor */
function ResolveProblemBalloonColorByAlpha(alpha) {
    const rs = window.__awardSystemForFormatters || window.rankSystem;
    const list = Array.isArray(rs?.data?.contest?.problem) ? rs.data.contest.problem : [];
    const zeroBased = ConvertProblemAlphaToNum(alpha);
    if (zeroBased === null) {
        return typeof RankToolParseColor === "function" ? RankToolParseColor("") : "#6b7280";
    }
    const idx = zeroBased + 1000;
    const p = list.find((x) => (x.num || x.id) === idx);
    const raw = p?.color || p?.title_color || "";
    if (typeof RankToolParseColor === "function") {
        return RankToolParseColor(raw);
    }
    return "#6b7280";
}

