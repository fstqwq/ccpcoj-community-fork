/**
 * 气球管理系统
 * 继承自 RankSystem，用于管理气球发放状态
 */

/**
 * contest_balloon.bst 合法值为 0/10/20/30。
 * 空串、非数字、枚举外旧数据按 0（未发）处理，避免「灰按钮 + 未处理文案」与自动打印（只打 bst=0）不一致。
 * @param {*} v
 * @returns {0|10|20|30}
 */
function NormalizeContestBalloonBst(v) {
    const n = Number(v);
    if (!Number.isFinite(n)) {
        return 0;
    }
    const t = Math.trunc(n);
    return [0, 10, 20, 30].includes(t) ? t : 0;
}

/**
 * 气球队列配送员：底部轻提示（不占用大块视口，替代 alerty 大窗）
 * @param {"ok"|"err"|"info"} kind
 */
function BalloonQueueShowMiniToast(kind, messageCn, messageEn) {
    let host = document.getElementById("balloon-queue-mini-toast-host");
    if (!host) {
        host = document.createElement("div");
        host.id = "balloon-queue-mini-toast-host";
        host.className = "balloon-queue-mini-toast-host";
        document.body.appendChild(host);
    }
    const esc =
        typeof RankToolEscapeHtml === "function"
            ? RankToolEscapeHtml
            : (s) =>
                  String(s || "")
                      .replace(/&/g, "&amp;")
                      .replace(/</g, "&lt;")
                      .replace(/>/g, "&gt;")
                      .replace(/"/g, "&quot;");
    host.className =
        "balloon-queue-mini-toast-host balloon-queue-mini-toast-host--" +
        (kind === "err" ? "err" : kind === "info" ? "info" : "ok") +
        " show";
    const en = messageEn ? String(messageEn) : "";
    host.innerHTML =
        '<div class="balloon-queue-mini-toast__cn">' +
        esc(String(messageCn || "")) +
        "</div>" +
        (en
            ? '<div class="balloon-queue-mini-toast__en en-text">' +
              esc(en) +
              "</div>"
            : "");
    clearTimeout(host._bqToastT);
    host._bqToastT = setTimeout(() => {
        host.classList.remove("show");
    }, 2600);
}

/** URL 加 `&csg_dbg_balloon_confirm=1` 时输出配送员二次确认相关日志（控制台过滤 BalloonSenderConfirm） */
function BalloonSenderConfirmDbg() {
    try {
        if (typeof window === "undefined" || !window.location) return false;
        return /(?:\?|&)csg_dbg_balloon_confirm=1(?:&|$)/.test(
            String(window.location.search || "")
        );
    } catch (e) {
        return false;
    }
}

function BalloonSenderConfirmLog(tag, payload) {
    if (!BalloonSenderConfirmDbg()) return;
    try {
        const p =
            payload !== undefined &&
            payload !== null &&
            typeof payload === "object"
                ? JSON.stringify(payload)
                : payload;
        console.info("[BalloonSenderConfirm]", tag, p !== undefined ? p : "");
    } catch (e) {}
}

const BQ_SENDER_DD_PORTAL_ATTR = "data-bq-sender-dd-portal-listeners";

/**
 * 将配送员状态列下拉菜单挂到 body，脱离 bootstrap-table .fixed-table-body 的 overflow，
 * 仅 1 行时也不会在表体内撑出纵向滚动条（与 Popper 朝上/朝下无关）。
 */
function BqSenderDdMenuPortalToBody(ddEl, toggleEl, menuEl) {
    if (!ddEl || !toggleEl || !menuEl) return;
    if (menuEl.dataset.bqDdPortaled === "1") return;
    if (menuEl.parentElement === document.body) return;
    const ph = document.createComment("bq-sender-dd-menu-ph");
    menuEl._bqDdPortalPlaceholder = ph;
    ddEl.insertBefore(ph, menuEl);
    document.body.appendChild(menuEl);
    menuEl.dataset.bqDdPortaled = "1";
    toggleEl._bqDdPortalRestore = {
        menu: menuEl,
        ph,
        parent: ddEl,
    };
}

function BqSenderDdMenuPortalRestore(toggleEl) {
    const r = toggleEl && toggleEl._bqDdPortalRestore;
    if (!r || !r.menu || r.menu.dataset.bqDdPortaled !== "1") return;
    try {
        if (r.ph && r.ph.parentNode === r.parent) {
            r.parent.insertBefore(r.menu, r.ph);
            r.parent.removeChild(r.ph);
        } else if (r.parent) {
            r.parent.appendChild(r.menu);
        }
    } catch (e) {
        try {
            r.menu.remove();
        } catch (e2) {}
    }
    delete r.menu.dataset.bqDdPortaled;
    delete r.menu._bqDdPortalPlaceholder;
    delete toggleEl._bqDdPortalRestore;
}

/** 表格刷新前：已挂到 body 的菜单若对应 toggle 已不在文档中则移除，否则先移回再刷新 */
function BqSenderDdCleanupOrphanMenus() {
    if (typeof document === "undefined") return;
    document
        .querySelectorAll(
            "ul.balloon-queue-sender-dd-menu[data-bq-dd-portaled=\"1\"]"
        )
        .forEach((menu) => {
            const tid = menu.getAttribute("data-bq-dd-toggle-id");
            const toggle = tid ? document.getElementById(tid) : null;
            if (toggle && toggle.isConnected) {
                BqSenderDdMenuPortalRestore(toggle);
            } else {
                try {
                    menu.remove();
                } catch (e) {}
            }
        });
}

function EnsureBalloonSenderBstDropdownPortalListeners() {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    if (root.getAttribute(BQ_SENDER_DD_PORTAL_ATTR) === "1") return;
    root.setAttribute(BQ_SENDER_DD_PORTAL_ATTR, "1");
    document.addEventListener(
        "show.bs.dropdown",
        function BqSenderDdPortalOnShowCapture(ev) {
            const t = ev.target;
            if (!t || !t.matches || !t.matches('[data-bs-toggle="dropdown"]')) {
                return;
            }
            if (!t.classList.contains("balloon-queue-sender-dd-toggle")) {
                return;
            }
            const dd = t.closest(".balloon-queue-sender-bst-dd");
            if (!dd) return;
            const menu = dd.querySelector(".balloon-queue-sender-dd-menu");
            if (!menu) return;
            BqSenderDdMenuPortalToBody(dd, t, menu);
        },
        true
    );
    document.addEventListener(
        "hidden.bs.dropdown",
        function BqSenderDdPortalOnHidden(ev) {
            const t = ev.target;
            if (!t || !t.matches || !t.matches('[data-bs-toggle="dropdown"]')) {
                return;
            }
            if (!t.classList.contains("balloon-queue-sender-dd-toggle")) {
                return;
            }
            BqSenderDdMenuPortalRestore(t);
        },
        false
    );
}

if (typeof BalloonManagerSystem === "undefined") {
    class BalloonManagerSystem extends RankSystem {
        constructor(containerId, config = {}) {
            // 调用父类构造函数
            super(containerId, config);

            // 气球管理特定配置
            this.autoRefreshInterval = 10000; // 默认10秒刷新一次
            this.refreshTimer = null;
            this.countdownTimer = null;
            this.countdownSeconds = 0;
            this.autoRefreshEnabled = false;

            // 气球状态映射
            this.balloonStatusMap = {
                0: { cn: "未处理", en: "Not Sent", color: "#dc3545" }, // 红色 - 未发
                10: { cn: "已通知", en: "Printed/Issued", color: "#ffc107" }, // 黄色 - 已通知
                20: { cn: "已分配", en: "Assigned", color: "#0dcaf0" }, // 青色 - 已分配
                30: { cn: "已发放", en: "Delivered", color: "#198754" }, // 绿色 - 已发放
            };

            // 气球状态统计
            this.balloonStats = {
                0: 0, // 未发气球
                10: 0, // 已通知
                20: 0, // 已分配
                30: 0, // 已发放
            };

            // 注册problem-item的特殊tooltip处理函数
            this.specialTooltipHandlers = {
                "problem-item": this.GenerateProblemItemTooltip.bind(this),
            };

            this._initBalloonOverviewRoomState();
            /** 与 rank 页一致的全场首答（contest_data_ajax）；勿用分区裁剪后的 solution 重算 */
            this._globalMapFb = null;
        }

        usesBalloonScopedDataApi() {
            const api = String((this.config && this.config.api_url) || "");
            return api.indexOf("balloon_data_ajax") >= 0;
        }

        resolveContestDataApiUrlForBalloon() {
            const explicit = this.config && this.config.contest_data_api_url;
            if (explicit) {
                return String(explicit);
            }
            const api = String((this.config && this.config.api_url) || "");
            if (api.indexOf("balloon_data_ajax") >= 0) {
                return api.replace("balloon_data_ajax", "contest_data_ajax");
            }
            return "/cpcsys/contest/contest_data_ajax";
        }

        buildContestLoadParams(infoNeedList) {
            const params = {};
            let cidValue = null;
            if (
                this.config.cid_list !== undefined &&
                this.config.cid_list !== null &&
                this.config.cid_list !== ""
            ) {
                cidValue = String(this.config.cid_list);
            } else if (
                this.config.key !== undefined &&
                this.config.key !== null &&
                this.config.key !== ""
            ) {
                cidValue = String(this.config.key);
            }
            if (!cidValue) {
                return null;
            }
            params.cid = cidValue;
            if (this.config.lvtk) {
                params.lvtk = String(this.config.lvtk);
            }
            params["info_need[]"] = infoNeedList;
            return params;
        }

        applyGlobalMapFbForBalloon() {
            if (!this._globalMapFb) {
                return;
            }
            this.map_fb = {
                global: Object.assign({}, this._globalMapFb.global || {}),
                regular: Object.assign({}, this._globalMapFb.regular || {}),
            };
        }

        _initBalloonOverviewRoomState() {
            const oc =
                typeof window !== "undefined" && window.BALLOON_OVERVIEW_CONFIG
                    ? window.BALLOON_OVERVIEW_CONFIG
                    : {};
            const arr = oc.balloon_staff_room_tokens;
            this.staffBalloonRoomLockedTokens = Array.isArray(arr)
                ? arr.map((t) => String(t).trim()).filter(Boolean)
                : [];
            this.overviewRoomFilterTokens = [];
            this._balloonOverviewRankListFull = null;
            this._balloonOverviewApplyRoomToStats = false;
            this._balloonOverviewRoomToolbarInitialized = false;
        }

        parseCommaRoomTokens(raw) {
            if (raw == null || raw === "") return [];
            return String(raw)
                .split(/[,，]+/)
                .map((r) => r.trim())
                .filter((r) => r);
        }

        getQueueEffectiveRoomTokens() {
            if (this.staffRoomLockTokens.length > 0) {
                return this.staffRoomLockTokens.slice();
            }
            return null;
        }

        /** 气球队列：职责分区已锁定，用静态 chip 区替代 filter-rooms 下拉 */
        usesRoomLockStaticZoneUi() {
            return (
                this.roomLocked &&
                !!document.getElementById("balloon-zone-lock-field")
            );
        }

        /** 气球总览：职责分区已锁定 */
        usesOverviewRoomLockStaticZoneUi() {
            return (
                this.staffBalloonRoomLockedTokens.length > 0 &&
                !!document.getElementById("balloon-overview-zone-lock-field")
            );
        }

        normalizeRoomLockTokens(tokens) {
            const list = Array.isArray(tokens)
                ? tokens.map((t) => String(t).trim()).filter(Boolean)
                : [];
            const uniq = [];
            const seen = new Set();
            list.forEach((t) => {
                if (!seen.has(t)) {
                    seen.add(t);
                    uniq.push(t);
                }
            });
            uniq.sort();
            return uniq;
        }

        buildRoomLockSummaryText(tokens) {
            const uniq = this.normalizeRoomLockTokens(tokens);
            return uniq.join(", ");
        }

        /** 职责分区锁定控件：面向用户的提示文案（不含完整分区列表） */
        getRoomLockFieldUserHints(zoneCount) {
            const n = Math.max(0, Number(zoneCount) || 0);
            const nCn = n > 0 ? "共 " + n + " 个分区，" : "";
            const nEn = n > 0 ? n + " zone(s), " : "";
            return {
                labelTitle:
                    "列表仅显示您负责分区内的气球\nOnly balloons in your assigned zones",
                buttonTitle:
                    nCn +
                    "点击可查看全部分区名称\n" +
                    nEn +
                    "click to view all zone names",
                ariaLabel:
                    n > 0
                        ? "您负责的 " +
                          n +
                          " 个分区，点击可查看名称列表"
                        : "您负责的分区，点击可查看名称列表",
                lockTitle:
                    "分区范围已指定，不可在此修改\nZone scope is assigned and cannot be changed here",
            };
        }

        ensureRoomLockPopoverListeners() {
            if (BalloonManagerSystem._roomLockPopoverListenersBound) {
                return;
            }
            BalloonManagerSystem._roomLockPopoverListenersBound = true;
            document.addEventListener("click", (e) => {
                const pop = document.getElementById("balloon-zone-lock-popover");
                if (!pop || !pop.classList.contains("is-open")) {
                    return;
                }
                if (pop.contains(e.target)) {
                    return;
                }
                if (e.target.closest(".balloon-zone-lock-field")) {
                    return;
                }
                this.closeRoomLockZonePopover();
            });
            document.addEventListener("keydown", (e) => {
                if (e.key === "Escape") {
                    this.closeRoomLockZonePopover();
                }
            });
        }

        ensureRoomLockPopoverEl() {
            let pop = document.getElementById("balloon-zone-lock-popover");
            if (pop) {
                return pop;
            }
            pop = document.createElement("div");
            pop.id = "balloon-zone-lock-popover";
            pop.className = "balloon-zone-lock-popover";
            pop.setAttribute("role", "dialog");
            pop.setAttribute("aria-modal", "false");
            document.body.appendChild(pop);
            return pop;
        }

        closeRoomLockZonePopover() {
            const pop = document.getElementById("balloon-zone-lock-popover");
            if (!pop) {
                return;
            }
            pop.classList.remove("is-open");
            const anchorId = pop.dataset.anchorId || "";
            if (anchorId) {
                const anchor = document.getElementById(anchorId);
                if (anchor) {
                    anchor.setAttribute("aria-expanded", "false");
                }
            }
            delete pop.dataset.anchorId;
        }

        positionRoomLockZonePopover(pop, anchor) {
            if (!pop || !anchor) {
                return;
            }
            const rect = anchor.getBoundingClientRect();
            const margin = 8;
            const gap = 4;
            let left = rect.left;
            const maxW = Math.min(320, window.innerWidth - margin * 2);
            pop.style.maxWidth = maxW + "px";
            const popW = pop.offsetWidth;
            if (left + popW > window.innerWidth - margin) {
                left = Math.max(margin, window.innerWidth - margin - popW);
            }
            let top = rect.bottom + gap;
            const popH = pop.offsetHeight;
            if (top + popH > window.innerHeight - margin) {
                top = Math.max(margin, rect.top - gap - popH);
            }
            pop.style.left = left + "px";
            pop.style.top = top + "px";
        }

        fillRoomLockPopoverContent(pop, tokens) {
            const uniq = this.normalizeRoomLockTokens(tokens);
            pop.replaceChildren();
            const title = document.createElement("div");
            title.className = "balloon-zone-lock-popover__title";
            title.innerHTML =
                "您负责的分区 (" +
                uniq.length +
                ')<span class="en-text">Your zones (' +
                uniq.length +
                ")</span>";
            pop.appendChild(title);
            const chips = document.createElement("div");
            chips.className = "balloon-zone-lock-popover__chips";
            uniq.forEach((t) => {
                const chip = document.createElement("span");
                chip.className = "balloon-zone-lock-chip";
                chip.textContent = t;
                chip.title = t;
                chips.appendChild(chip);
            });
            pop.appendChild(chips);
        }

        toggleRoomLockZonePopover(anchor, tokens) {
            this.ensureRoomLockPopoverListeners();
            const pop = this.ensureRoomLockPopoverEl();
            const anchorId = anchor.id || "";
            if (
                pop.classList.contains("is-open") &&
                pop.dataset.anchorId === anchorId
            ) {
                this.closeRoomLockZonePopover();
                return;
            }
            this.fillRoomLockPopoverContent(pop, tokens);
            pop.dataset.anchorId = anchorId;
            pop.classList.add("is-open");
            anchor.setAttribute("aria-expanded", "true");
            window.requestAnimationFrame(() => {
                this.positionRoomLockZonePopover(pop, anchor);
            });
        }

        bindRoomLockZoneFieldPopover(host, tokens) {
            if (!host) {
                return;
            }
            const uniq = this.normalizeRoomLockTokens(tokens);
            host._balloonZoneTokens = uniq;
            if (!host._balloonZonePopoverClick) {
                host._balloonZonePopoverClick = (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    this.toggleRoomLockZonePopover(
                        host,
                        host._balloonZoneTokens || []
                    );
                };
                host.addEventListener("click", host._balloonZonePopoverClick);
            }
        }

        renderRoomLockStaticZoneField(fieldId, tokens) {
            const host = document.getElementById(fieldId);
            if (!host) {
                return;
            }
            const uniq = this.normalizeRoomLockTokens(tokens);
            const n = uniq.length;
            const summaryText = uniq.join(", ");
            let countEl = host.querySelector(".balloon-zone-lock-field__count");
            let summaryEl = host.querySelector(".balloon-zone-lock-field__summary");
            if (!summaryEl) {
                host.replaceChildren();
                countEl = document.createElement("span");
                countEl.className = "balloon-zone-lock-field__count";
                countEl.setAttribute("aria-hidden", "true");
                host.appendChild(countEl);
                summaryEl = document.createElement("span");
                summaryEl.className = "balloon-zone-lock-field__summary";
                host.appendChild(summaryEl);
                const lock = document.createElement("span");
                lock.className = "balloon-zone-lock-field__lock";
                lock.setAttribute("aria-hidden", "true");
                const icon = document.createElement("i");
                icon.className = "bi bi-lock-fill";
                lock.appendChild(icon);
                host.appendChild(lock);
            }
            const hints = this.getRoomLockFieldUserHints(n);
            if (countEl) {
                countEl.textContent = String(n);
                countEl.removeAttribute("title");
            }
            summaryEl.textContent = summaryText;
            summaryEl.removeAttribute("title");
            host.title = hints.buttonTitle;
            host.setAttribute("aria-label", hints.ariaLabel);
            const lockEl = host.querySelector(".balloon-zone-lock-field__lock");
            if (lockEl) {
                lockEl.title = hints.lockTitle;
            }
            const filterGroup = host.closest(".balloon-filter-group");
            if (filterGroup) {
                const lbl = filterGroup.querySelector(".balloon-filter-label");
                if (lbl) {
                    lbl.title = hints.labelTitle;
                }
            }
            if (!host.getAttribute("aria-haspopup")) {
                host.setAttribute("aria-haspopup", "dialog");
            }
            if (!host.getAttribute("aria-expanded")) {
                host.setAttribute("aria-expanded", "false");
            }
            this.bindRoomLockZoneFieldPopover(host, uniq);
        }

        snapshotFullRankListForBalloonOverview() {
            const el = document.getElementById("balloon-container");
            if (!el) {
                this._balloonOverviewRankListFull = null;
                return;
            }
            this._balloonOverviewRankListFull = Array.isArray(this.rankList)
                ? this.rankList.slice()
                : [];
        }

        applyBalloonOverviewRoomFilter() {
            if (!this._balloonOverviewRankListFull) {
                return;
            }
            let tokens = [];
            if (this.staffBalloonRoomLockedTokens.length > 0) {
                tokens = this.staffBalloonRoomLockedTokens;
            } else if (this.overviewRoomFilterTokens.length > 0) {
                tokens = this.overviewRoomFilterTokens;
            }
            if (tokens.length === 0) {
                this.rankList = this._balloonOverviewRankListFull.slice();
                return;
            }
            this.rankList = this._balloonOverviewRankListFull.filter((row) =>
                this.teamMatchesOverviewRoomTokens(row.team, tokens)
            );
        }

        teamMatchesOverviewRoomTokens(team, tokens) {
            if (!tokens || tokens.length === 0) return true;
            const teamRooms = this.parseCommaRoomTokens(team?.room || "");
            return teamRooms.some((r) => tokens.includes(r));
        }

        InitBalloonOverviewRoomToolbarDeferred() {
            const roomSel = document.getElementById("balloon-overview-filter-rooms");
            const zoneLock = document.getElementById("balloon-overview-zone-lock-field");
            if (!roomSel && !zoneLock) return;
            window.setTimeout(() => this.InitBalloonOverviewRoomToolbar(), 0);
        }

        InitBalloonOverviewRoomToolbar() {
            if (this.usesOverviewRoomLockStaticZoneUi()) {
                this.renderRoomLockStaticZoneField(
                    "balloon-overview-zone-lock-field",
                    this.staffBalloonRoomLockedTokens
                );
                this._balloonOverviewRoomToolbarInitialized = true;
                return;
            }

            const roomSel = document.getElementById("balloon-overview-filter-rooms");
            if (!roomSel || !this.teamMap) return;

            const roomSet = new Set();
            for (const tid in this.teamMap) {
                const t = this.teamMap[tid];
                if (!this.IsContestantTeam(t)) continue;
                this.parseCommaRoomTokens(t.room || "").forEach((r) => roomSet.add(r));
            }
            const allRooms = Array.from(roomSet).sort();
            let html = "";
            if (allRooms.length === 0) {
                html = '<option value="">无分区<en-text>No zones</en-text></option>';
            } else {
                allRooms.forEach((room) => {
                    html += `<option value="${RankToolEscapeHtml(room)}">${RankToolEscapeHtml(room)}</option>`;
                });
            }
            roomSel.innerHTML = html;

            const locked = this.staffBalloonRoomLockedTokens.length > 0;
            const tokensToSelect = locked
                ? this.staffBalloonRoomLockedTokens
                : this.overviewRoomFilterTokens;
            const toApply = (tokensToSelect || []).filter((r) =>
                allRooms.includes(String(r))
            );

            const $roomSel = $(roomSel);
            if ($roomSel.data("multipleSelect")) {
                try {
                    $roomSel.multipleSelect("destroy");
                } catch (e) {}
                $roomSel.removeData("multipleSelect");
            }
            $roomSel.multipleSelect({
                filter: true,
                filterPlaceholder: "搜索...",
                maxHeight: 800,
                onClick: () => {
                    if (locked) return;
                    this.overviewRoomFilterTokens = $roomSel.multipleSelect("getSelects") || [];
                    this.applyBalloonOverviewRoomFilterFromToolbar();
                },
            });
            $roomSel.off("change").on("change", () => {
                if (locked) return;
                this.overviewRoomFilterTokens = Array.from(roomSel.selectedOptions)
                    .map((o) => o.value)
                    .filter(Boolean);
                this.applyBalloonOverviewRoomFilterFromToolbar();
            });
            if (toApply.length > 0) {
                try {
                    $roomSel.multipleSelect("setSelects", toApply);
                } catch (e) {}
            }
            if (locked) {
                try {
                    $roomSel.multipleSelect("disable");
                } catch (e) {
                    roomSel.disabled = true;
                }
            } else {
                try {
                    $roomSel.multipleSelect("enable");
                } catch (e) {
                    roomSel.disabled = false;
                }
            }
            this._balloonOverviewRoomToolbarInitialized = true;
        }

        applyBalloonOverviewRoomFilterFromToolbar() {
            if (!document.getElementById("balloon-container")) return;
            if (!this._balloonOverviewRankListFull) {
                this.snapshotFullRankListForBalloonOverview();
            }
            this.applyBalloonOverviewRoomFilter();
            const balloonGrid = document.getElementById("balloon-container");
            this._balloonOverviewApplyRoomToStats =
                !!balloonGrid &&
                this._balloonOverviewRankListFull &&
                this.rankList.length < this._balloonOverviewRankListFull.length;
            this.CalculateBalloonStats();
            this.UpdateGlobalStats();
            this.UpdateRank();
        }

        /**
         * 重写 Init 方法，确保容器添加balloon-manager-system类
         */
        Init() {
            // 调用父类Init
            super.Init();

            // 为容器添加balloon-manager-system类，用于CSS选择器
            if (this.container) {
                this.container.classList.add("balloon-manager-system");
            }
        }

        /**
         * 重写 CreateHeader 方法，隐藏默认header（模板中已有自定义header）
         */
        CreateHeader() {
            // 不调用父类方法，因为我们使用模板中的自定义header
            // 初始化自动刷新开关
            setTimeout(() => {
                this.InitAutoRefreshSwitch();
            }, 100);
        }

        /**
         * 初始化自动刷新开关
         */
        InitAutoRefreshSwitch() {
            const switchEl = document.querySelector("#balloon-auto-refresh-switch");
            if (!switchEl) return;

            // 初始化 csg-switch
            if (window.csgSwitch) {
                window.csgSwitch.initSwitch(switchEl, {
                    onChange: (checked) => {
                        this.OnAutoRefreshToggle(checked);
                    },
                });
            }
        }

        /**
         * 处理自动刷新开关切换
         */
        OnAutoRefreshToggle(checked) {
            this.autoRefreshEnabled = checked;

            if (checked) {
                // 开启自动刷新
                this.StartAutoRefresh();
            } else {
                // 关闭自动刷新
                this.StopAutoRefresh();
            }
        }

        /**
         * 启动自动刷新
         */
        StartAutoRefresh() {
            // 清除已有定时器
            this.StopAutoRefresh();

            // 重置倒计时
            this.countdownSeconds = Math.floor(this.autoRefreshInterval / 1000);
            this.UpdateCountdownDisplay();

            // 显示倒计时
            const countdownEl = document.getElementById("balloon-refresh-countdown");
            if (countdownEl) {
                countdownEl.style.display = "inline-block";
            }

            // 启动倒计时定时器
            this.countdownTimer = setInterval(() => {
                this.countdownSeconds--;
                this.UpdateCountdownDisplay();

                if (this.countdownSeconds <= 0) {
                    // 倒计时结束，刷新数据
                    this.RefreshData();
                    // 重置倒计时
                    this.countdownSeconds = Math.floor(this.autoRefreshInterval / 1000);
                }
            }, 1000);
        }

        /**
         * 停止自动刷新
         */
        StopAutoRefresh() {
            if (this.refreshTimer) {
                clearInterval(this.refreshTimer);
                this.refreshTimer = null;
            }

            if (this.countdownTimer) {
                clearInterval(this.countdownTimer);
                this.countdownTimer = null;
            }

            // 隐藏倒计时
            const countdownEl = document.getElementById("balloon-refresh-countdown");
            if (countdownEl) {
                countdownEl.style.display = "none";
            }

            this.countdownSeconds = 0;
        }

        /**
         * 更新倒计时显示
         */
        UpdateCountdownDisplay() {
            const countdownTextEl = document.getElementById("balloon-countdown-text");
            if (countdownTextEl) {
                countdownTextEl.textContent = this.countdownSeconds;
            }
        }

        /**
         * 重写 HandleKeydown 方法
         * 只允许 F5 刷新数据，禁用其他所有快捷键
         */
        HandleKeydown(e) {
            // 允许 F5 刷新数据（阻止默认刷新行为）
            if (e.key === "F5" && !e.ctrlKey) {
                e.preventDefault();
                this.RefreshData();
                return;
            }

            // 其他所有快捷键都被禁用
            // 不调用父类方法
            return;
        }

        /**
         * 同一队伍同一题目仅保留「首次 AC」一条提交记录。
         * RankSystem.ProcessData 在 ac 已存在时会忽略后续提交，但不会从 data.solution 中剔除；
         * 气球统计 / 队列 / 自动打印若直接遍历 data.solution 会重复计数，故在此处与榜单逻辑对齐。
         * 排序规则与 rank.js ProcessData 一致：in_date 升序，相同时 solution_id 升序。
         * @param {Array} solutions 已限定为 AC（result===4）时效果与榜单首 AC 一致
         */
        DeduplicateSolutionsFirstAcPerProblem(solutions) {
            if (!solutions || solutions.length === 0) {
                return solutions;
            }
            const sorted = solutions.slice().sort((a, b) => {
                const cmp = String(a.in_date || "").localeCompare(
                    String(b.in_date || "")
                );
                if (cmp !== 0) return cmp;
                return (Number(a.solution_id) || 0) - (Number(b.solution_id) || 0);
            });
            const seen = new Set();
            const out = [];
            for (const s of sorted) {
                if (Number(s.result) !== 4) continue;
                const k = `${s.team_id}_${s.problem_id}`;
                if (seen.has(k)) continue;
                seen.add(k);
                out.push(s);
            }
            return out;
        }

        /**
         * 气球页：并行拉取 balloon_data_ajax（分区视野）与 contest_data_ajax（全场首答）。
         */
        async LoadData() {
            if (!this.usesBalloonScopedDataApi()) {
                return super.LoadData();
            }
            try {
                this.ShowLoading();
                const balloonParams = this.buildContestLoadParams([
                    "solution",
                    "team",
                    "problem",
                    "contest",
                    "contest_balloon",
                ]);
                if (!balloonParams) {
                    this.ShowError("缺少比赛ID参数");
                    return;
                }
                const balloonUrl = String(this.config.api_url);
                const rankUrl = this.resolveContestDataApiUrlForBalloon();
                const rankParams = this.buildContestLoadParams([
                    "solution",
                    "team",
                    "problem",
                    "contest",
                ]);
                const [balloonResult, rankResult] = await Promise.all([
                    this.GetRequest(balloonUrl, balloonParams),
                    rankParams
                        ? this.GetRequest(rankUrl, rankParams)
                        : Promise.resolve(null),
                ]);
                this._globalMapFb = null;
                if (rankResult && rankResult.code === 1 && rankResult.data) {
                    this._globalMapFb = RankSystem.buildMapFbFromContestPayload(
                        rankResult.data,
                        this.config
                    );
                }
                if (balloonResult && balloonResult.code === 1) {
                    this.OriInit(balloonResult.data);
                } else {
                    this.ShowError(
                        (balloonResult && balloonResult.msg) || "数据加载失败"
                    );
                }
            } catch (error) {
                console.error("气球数据加载错误:", error);
                this.ShowError("网络错误，请检查连接");
            }
        }

        /**
         * 重写 ProcessData 方法，处理气球数据
         */
        ProcessData(flg_real_rank = false) {
            if (!this.data) return;

            // 过滤solution，只保留AC结果（result=4）
            if (this.data.solution) {
                this.data.solution = this.data.solution.filter(
                    (solution) => solution.result === 4
                );
            }

            // 构建contest_balloon映射表，方便后续查找
            this.balloonMap = new Map();
            if (
                this.data.contest_balloon &&
                Array.isArray(this.data.contest_balloon)
            ) {
                this.data.contest_balloon.forEach((item) => {
                    // item格式: [contest_id, problem_id, team_id, ac_time, pst, bst, balloon_sender]
                    const key = `${item[2]}_${item[1]}`; // team_id_problem_id
                    this.balloonMap.set(key, {
                        team_id: item[2],
                        problem_id: item[1],
                        ac_time: item[3],
                        pst: item[4],
                        bst: NormalizeContestBalloonBst(item[5]), // 0/10/20/30，非法值按 0
                        balloon_sender: item[6],
                    });
                });
            }

            // 调用父类方法处理数据
            super.ProcessData(flg_real_rank);

            // 父类不裁剪重复 AC；气球侧只认每队每题首次 AC
            if (this.data.solution && this.data.solution.length) {
                this.data.solution = this.DeduplicateSolutionsFirstAcPerProblem(
                    this.data.solution
                );
            }

            this.applyGlobalMapFbForBalloon();

            this.snapshotFullRankListForBalloonOverview();
            this.applyBalloonOverviewRoomFilter();

            const balloonGrid = document.getElementById("balloon-container");
            this._balloonOverviewApplyRoomToStats =
                !!balloonGrid &&
                this._balloonOverviewRankListFull &&
                this.rankList.length < this._balloonOverviewRankListFull.length;

            // 统计气球状态
            this.CalculateBalloonStats();

            // 更新全局统计显示
            this.UpdateGlobalStats();

            if (balloonGrid) {
                this.InitBalloonOverviewRoomToolbarDeferred();
            }
        }

        /**
         * 计算气球状态统计
         */
        CalculateBalloonStats() {
            // 重置统计
            this.balloonStats = {
                0: 0, // 未发气球
                10: 0, // 已通知
                20: 0, // 已分配
                30: 0, // 已发放
            };

            if (!this.data || !this.data.solution) return;

            let visibleTeam = null;
            if (this._balloonOverviewApplyRoomToStats && Array.isArray(this.rankList)) {
                visibleTeam = new Set(this.rankList.map((r) => r.team_id));
            }

            // 统计所有AC的solution（这些都应该有气球）
            // 对于每个AC，如果在contest_balloon中有记录，使用记录中的bst状态
            // 如果没有记录，则默认为0（未发气球）
            this.data.solution.forEach((solution) => {
                const teamId = solution.team_id;
                if (visibleTeam && !visibleTeam.has(teamId)) {
                    return;
                }
                const problemId = solution.problem_id;
                const key = `${teamId}_${problemId}`;

                // 从balloonMap中获取气球状态，如果没有记录则默认为0（未发气球）
                const balloon = this.balloonMap?.get(key);
                const bst = balloon ? balloon.bst || 0 : 0;
                if (this.balloonStats.hasOwnProperty(bst)) {
                    this.balloonStats[bst]++;
                } else {
                    // 未知状态，归入未发气球
                    this.balloonStats[0]++;
                }
            });
        }

        /**
         * 更新全局统计信息显示
         */
        UpdateGlobalStats() {
            // 计算全局统计
            this.CalculateBalloonStats();

            // 更新DOM中的统计数值（不重新生成HTML）
            const statValue0 = document.getElementById("balloon-stat-value-0");
            const statValue10 = document.getElementById("balloon-stat-value-10");
            const statValue20 = document.getElementById("balloon-stat-value-20");
            const statValue30 = document.getElementById("balloon-stat-value-30");

            if (statValue0) statValue0.textContent = this.balloonStats[0] || 0;
            if (statValue10) statValue10.textContent = this.balloonStats[10] || 0;
            if (statValue20) statValue20.textContent = this.balloonStats[20] || 0;
            if (statValue30) statValue30.textContent = this.balloonStats[30] || 0;

            // 绑定点击事件（只需要绑定一次）
            this.BindGlobalStatsClickEvents();
        }

        /**
         * 绑定全局统计点击事件（只绑定一次）
         */
        BindGlobalStatsClickEvents() {
            const statsContainer =
                document.getElementById("balloon-global-stats") ||
                document.getElementById("balloon-queue-stats");
            if (!statsContainer) return;

            if (
                this instanceof BalloonQueueSystem &&
                this.isBalloonSender &&
                !this.isBalloonManager
            ) {
                if (statsContainer.dataset.eventsBound === "true") return;
                statsContainer.dataset.eventsBound = "true";
                statsContainer.classList.add("balloon-queue-stats--sender-readonly");
                return;
            }

            // 防止重复绑定
            if (statsContainer.dataset.eventsBound === "true") return;

            const statItems = statsContainer.querySelectorAll(".balloon-stat-item");
            statItems.forEach((statItem) => {
                statItem.addEventListener("click", (e) => {
                    e.stopPropagation();
                    const status = parseInt(statItem.getAttribute("data-status"));

                    // 如果是队列系统，使用筛选功能；否则使用滚动功能
                    if (this instanceof BalloonQueueSystem) {
                        this.OnStatClick(status);
                    } else {
                        this.ScrollToFirstBalloonStatus(null, status);
                    }
                });
            });

            // 标记已绑定
            statsContainer.dataset.eventsBound = "true";
        }

        /**
         * 滚动到第一个符合指定气球状态的行
         * @param {string|null} problemId - 题目ID，null表示所有题目
         * @param {number} targetStatus - 目标状态
         */
        ScrollToFirstBalloonStatus(problemId, targetStatus) {
            if (!this.rankList || !this.data) return;

            // 查找第一个符合状态的队伍
            for (const rankItem of this.rankList) {
                const teamId = rankItem.team_id;

                if (problemId) {
                    // 指定题目
                    const balloonStatus = this.GetProblemBalloonStatus(teamId, problemId);
                    if (balloonStatus === targetStatus) {
                        this.ScrollToTeamAndHighlight(teamId, problemId);
                        return;
                    }
                } else {
                    // 所有题目中查找第一个符合状态的
                    if (this.data.problem) {
                        for (const problem of this.data.problem) {
                            const balloonStatus = this.GetProblemBalloonStatus(
                                teamId,
                                problem.problem_id
                            );
                            if (balloonStatus === targetStatus) {
                                this.ScrollToTeamAndHighlight(teamId, problem.problem_id);
                                return;
                            }
                        }
                    }
                }
            }
        }

        /**
         * 滚动到队伍并高亮题目
         */
        ScrollToTeamAndHighlight(teamId, problemId) {
            const row = document.getElementById(`rank-grid-${teamId}`);
            if (row) {
                // 滚动到该行
                row.scrollIntoView({ behavior: "smooth", block: "center" });

                // 高亮显示该题目
                if (problemId && this.problemMap[problemId]) {
                    const problemAlphabetIdx = RankToolGetProblemAlphabetIdx(
                        this.problemMap[problemId].num
                    );
                    const problemItem = row.querySelector(
                        `[d-pro-idx="${problemAlphabetIdx}"]`
                    );
                    if (problemItem) {
                        problemItem.style.transition = "all 0.3s ease";
                        problemItem.style.transform = "scale(1.1)";
                        problemItem.style.boxShadow = "0 0 20px rgba(13, 110, 253, 0.5)";

                        setTimeout(() => {
                            problemItem.style.transform = "";
                            problemItem.style.boxShadow = "";
                        }, 2000);
                    }
                }
            }
        }

        /**
         * 重写 CreateProblemGroup 方法，显示气球状态边框
         */
        CreateProblemGroup(problemStats, item = null) {
            let html = "";

            if (!this.problemMap || Object.keys(this.problemMap).length === 0) {
                return '<div class="problem-group"><!-- 题目数据加载中 --></div>';
            }

            const problemIds = Object.keys(this.problemMap).sort(
                (a, b) => this.problemMap[a].num - this.problemMap[b].num
            );

            problemIds.forEach((problemId) => {
                const stats = problemStats[problemId] || {
                    status: "none",
                    submitCount: 0,
                    lastSubmitTime: "",
                    problemAlphabetIdx: RankToolGetProblemAlphabetIdx(
                        this.problemMap[problemId].num
                    ),
                };

                // 检查一血状态（保留一血效果）
                let isGlobalFirstBlood = false;
                let isRegularFirstBlood = false;

                // 直接比较team_id
                isGlobalFirstBlood =
                    this.map_fb?.global?.[problemId]?.team_id === item?.team_id;
                isRegularFirstBlood =
                    this.map_fb?.regular?.[problemId]?.team_id === item?.team_id;

                // 构建一血相关的CSS类
                let firstBloodClasses = "";
                if (isRegularFirstBlood) {
                    firstBloodClasses += " pro-first-blood-regular";
                }
                if (isGlobalFirstBlood) {
                    firstBloodClasses += " pro-first-blood-global";
                }

                // 只在有AC时才获取气球状态和添加边框
                let balloonBorderClass = "";
                let balloonBorderStyle = "";

                if (stats.status === "ac") {
                    // 获取该题目的气球状态
                    const balloonStatus = this.GetProblemBalloonStatus(
                        item.team_id,
                        problemId
                    );
                    const balloonStatusInfo =
                        this.balloonStatusMap[balloonStatus] || this.balloonStatusMap[0];

                    // 构建气球状态边框类名
                    balloonBorderClass = `balloon-status-${balloonStatus}`;

                    // 构建气球状态边框样式（使用outline，不占DOM空间，更粗的边框）
                    balloonBorderStyle = `outline: 6px solid ${balloonStatusInfo.color}; outline-offset: -6px;`;
                }

                // 计算总分钟数
                let briefMinute = "";
                if (
                    stats.status === "ac" &&
                    stats.lastSubmitTime &&
                    /^(\d{1,2}:)?\d{1,2}:\d{2}$/.test(stats.lastSubmitTime)
                ) {
                    const timeParts = stats.lastSubmitTime.split(":");
                    let totalMinutes = 0;
                    if (timeParts.length === 3) {
                        const hours = parseInt(timeParts[0]) || 0;
                        const minutes = parseInt(timeParts[1]) || 0;
                        totalMinutes = hours * 60 + minutes;
                    } else if (timeParts.length === 2) {
                        totalMinutes = parseInt(timeParts[0]) || 0;
                    }
                    briefMinute = totalMinutes + "'";
                }

                // 存储额外信息用于tooltip（通过data属性）
                const teamId = item?.team_id || "";
                const globalFB = this.map_fb?.global?.[problemId];
                const regularFB = this.map_fb?.regular?.[problemId];
                const globalFBTeamId = globalFB?.team_id || "";
                const regularFBTeamId = regularFB?.team_id || "";
                const balloonStatus =
                    stats.status === "ac"
                        ? this.GetProblemBalloonStatus(teamId, problemId)
                        : null;
                const balloonStatusInfo =
                    balloonStatus !== null
                        ? this.balloonStatusMap[balloonStatus] || this.balloonStatusMap[0]
                        : null;

                html += `
                    <div class="rank-col rank-col-problem">
                        <div class="${this.GetProblemStatusClass(
                    stats
                )}${firstBloodClasses} ${balloonBorderClass}" 
                            ${balloonBorderStyle
                        ? `style="${balloonBorderStyle}"`
                        : ""
                    }
                            d-pro-idx="${stats.problemAlphabetIdx}"
                            d-sub-cnt="${stats.submitCount || 0}"
                            d-last-sub="${this.GetLastSubmitTimeDisplay(stats)}"
                            d-team-id="${teamId}"
                            d-problem-id="${problemId}"
                            d-global-fb-team="${globalFBTeamId}"
                            d-regular-fb-team="${regularFBTeamId}"
                            d-balloon-status="${balloonStatus !== null ? balloonStatus : ""
                    }">
                            <div class="problem-content balloon-problem-content">
                                ${briefMinute
                        ? `<span class="time-brief">${briefMinute}</span>`
                        : '<span class="time-brief"></span>'
                    }
                            </div>
                        </div>
                    </div>
                `;
            });

            return html;
        }

        /**
         * 重写 CreateHeaderRow 方法，移除罚时列
         */
        CreateHeaderRow() {
            const headerRow = super.CreateHeaderRow();
            // 移除罚时列
            const penaltyCol = headerRow.querySelector(".rank-col-penalty");
            if (penaltyCol) {
                penaltyCol.remove();
            }
            return headerRow;
        }

        /**
         * 重写 CreateRankRow 方法，在校名前面加上team_id，并移除罚时列
         */
        async CreateRankRow(item, rank, index) {
            // 调用父类方法创建基础行
            const row = await super.CreateRankRow(item, rank, index);

            // 移除罚时列
            const penaltyCol = row.querySelector(".rank-col-penalty");
            if (penaltyCol) {
                penaltyCol.remove();
            }

            // team_id 现在由基类 CreateSchoolName 方法处理，不需要额外操作

            return row;
        }

        /**
         * 重写 GenerateProblemItemTooltip 方法，显示完整的气球管理信息
         */
        GenerateProblemItemTooltip(element) {
            // 从data属性中提取信息
            const problemAlphabetIdx = element.getAttribute("d-pro-idx") || "?";
            const teamId = element.getAttribute("d-team-id") || "";
            const problemId = element.getAttribute("d-problem-id") || "";
            const globalFBTeamId = element.getAttribute("d-global-fb-team") || "";
            const regularFBTeamId = element.getAttribute("d-regular-fb-team") || "";
            const balloonStatus = element.getAttribute("d-balloon-status");

            // 构建tooltip内容，使用更好的排版
            let titlecn = "";
            let titleen = "";

            // 分隔线
            const separator = "─".repeat(15);

            // 题号（第一行）
            titlecn += `题目 ${problemAlphabetIdx}`;
            titleen += `Problem ${problemAlphabetIdx}`;

            // 分隔线
            titlecn += `\n${separator}`;
            titleen += `\n${separator}`;

            // 队伍ID
            if (teamId) {
                titlecn += `\n队伍ID：${teamId}`;
                titleen += `\nTeam ID: ${teamId}`;
            }

            // 气球状态（仅在有AC时显示）
            if (balloonStatus !== null && balloonStatus !== "") {
                const balloonStatusInfo =
                    this.balloonStatusMap[balloonStatus] || this.balloonStatusMap[0];
                titlecn += `\n气球状态：${balloonStatusInfo.cn}`;
                titleen += `\nBalloon Status: ${balloonStatusInfo.en}`;
            }

            // 分隔线
            titlecn += `\n${separator}`;
            titleen += `\n${separator}`;

            // 正式队首答
            if (regularFBTeamId) {
                const isRegularFB = regularFBTeamId === teamId;
                if (isRegularFB) {
                    titlecn += `\n正式队首答：✓ 是`;
                    titleen += `\nRegular First Blood: ✓ Yes`;
                } else {
                    titlecn += `\n正式队首答：${regularFBTeamId}`;
                    titleen += `\nRegular First Blood: ${regularFBTeamId}`;
                }
            } else {
                titlecn += `\n正式队首答：—`;
                titleen += `\nRegular First Blood: —`;
            }

            // 全场首答
            if (globalFBTeamId) {
                const isGlobalFB = globalFBTeamId === teamId;
                if (isGlobalFB) {
                    titlecn += `\n全场首答：★ 是`;
                    titleen += `\nGlobal First Blood: ★ Yes`;
                } else {
                    titlecn += `\n全场首答：${globalFBTeamId}`;
                    titleen += `\nGlobal First Blood: ${globalFBTeamId}`;
                }
            } else {
                titlecn += `\n全场首答：—`;
                titleen += `\nGlobal First Blood: —`;
            }

            return { titlecn, titleen };
        }

        /**
         * 获取指定队伍在指定题目的气球状态
         */
        GetProblemBalloonStatus(teamId, problemId) {
            if (!this.balloonMap) return 0;

            // 从contest_balloon映射表中查找
            const key = `${teamId}_${problemId}`;
            const balloon = this.balloonMap.get(key);

            if (balloon) {
                return balloon.bst || 0;
            }

            // 如果没有对应的contest_balloon条目，等同于bst为0（未发气球）
            return 0;
        }

        /**
         * 重写 UpdatePageTitle 方法
         */
        UpdatePageTitle() {
            if (!this.data) return;

            const shouldShowTitle = this.isFullscreen
                ? this.config.flg_show_fullscreen_contest_title
                : this.config.flg_show_page_contest_title;

            if (!shouldShowTitle) return;

            const title = this.data.contest.title;
            const modeText = "气球总览";

            if (this.elements.pageTitle) {
                // 更新标题，保持双语结构
                const pageTitleEl = document.getElementById("balloon-page-title");
                if (pageTitleEl) {
                    pageTitleEl.innerHTML = `${title} - 气球总览<en-text>${title} - Balloon Overview</en-text>`;
                } else if (this.elements.pageTitle) {
                    this.elements.pageTitle.innerHTML = `${title} - 气球总览<en-text>${title} - Balloon Overview</en-text>`;
                }
            }
        }

        /**
         * 重写 Cleanup 方法，清理定时器
         */
        Cleanup() {
            // 停止自动刷新
            this.StopAutoRefresh();

            // 调用父类清理方法
            super.Cleanup();
        }

        /**
         * 重写 RefreshData 方法，保持自动刷新状态
         */
        async RefreshData() {
            const wasAutoRefreshEnabled = this.autoRefreshEnabled;
            
            // 调用父类刷新方法
            await super.RefreshData();

            // 如果之前开启了自动刷新，重新启动
            if (wasAutoRefreshEnabled) {
                this.StartAutoRefresh();
            }
        }
    }

    // #########################################
    //  BalloonQueueSystem - 气球队列系统
    //  继承自 BalloonManagerSystem
    // #########################################

    class BalloonQueueSystem extends BalloonManagerSystem {
        constructor(containerId, config = {}) {
            // 合并全局配置和传入配置
            const globalConfig = window.RANK_CONFIG || {};
            const mergedConfig = Object.assign({}, globalConfig, config);

            // 在调用 super() 之前，先读取队列配置（因为 super() 会立即触发 Init()）
            const queueConfig = window.BALLOON_QUEUE_CONFIG || {};

            // 调用父类构造函数（传入合并后的配置）
            // 注意：父类构造函数会立即调用 this.Init()，所以需要在 Init() 中也能访问这些配置
            super(containerId, mergedConfig);

            // 队列系统特定配置（从window.BALLOON_QUEUE_CONFIG获取）
            // 优先判断是管理员，如果是管理员就不再判断is_balloon_sender
            this.isBalloonManager = queueConfig.is_balloon_manager || false;
            this.isBalloonSender = this.isBalloonManager
                ? false
                : queueConfig.is_balloon_sender || false;
            this.currentUser = queueConfig.current_user || null;
            this.teamRoom = queueConfig.team_room || null;
            this.staffRoomLockTokens = Array.isArray(queueConfig.staff_room_tokens)
                ? queueConfig.staff_room_tokens.map((t) => String(t).trim()).filter(Boolean)
                : [];
            this.roomLocked = this.staffRoomLockTokens.length > 0;
            this.changeStatusUrl =
                queueConfig.change_status_url ||
                "/cpcsys/contest/balloon_change_status_ajax";
            this.isMultiGroup = !!queueConfig.is_multi_group;
            this.staffGroupIds = Array.isArray(queueConfig.staff_group_ids)
                ? queueConfig.staff_group_ids.map((gid) => String(gid))
                : [];
            this.contestGroups = Array.isArray(queueConfig.contest_groups)
                ? queueConfig.contest_groups
                : [];
            this.groupLocked = this.isMultiGroup && this.staffGroupIds.length > 0;
            if (this.groupLocked && this.filters) {
                this.filters.groups = [...this.staffGroupIds];
            }

            // 获取 contest_id（用于 localStorage key）
            this.contestId = mergedConfig.cid_list || globalConfig.cid_list || "";

            // 从 localStorage 读取筛选条件
            this.filters = this.LoadFiltersFromStorage();
            if (this.roomLocked) {
                this.filters.rooms = this.staffRoomLockTokens.slice();
            }

            // 当前标签页（仅balloonSender使用）
            this.currentTab = "queue"; // 'queue' 或 'my_balloons'

            // 数据缓存
            this.balloonList = []; // 处理后的气球列表
            this.rooms = []; // 所有room列表
            this.senders = []; // 所有配送员列表
            this.schools = []; // 所有学校列表
            this.problems = []; // 所有题号列表

            // 自动打印相关（client 全量表 + 本地排序；勿按 contest_print 服务端分页模型实现）
            this.autoPrintEnabled = false;
            this.auto_print_busy = false;
            this.auto_print_inflight_solution_ids = null;
            this.auto_print_confirmed_idle = false;
            this.auto_print_tick_timer = null;
            this.auto_print_retry_timer = null;
            /** 倒计时 UI：printing | poll-idle | poll-busy */
            this._bqCountdownUiMode = null;
            this.autoPrintCountdown = 10;
            this.autoPrintPrintableCount = 0;
            /** 与 bootstrap-table 表头一致；默认时间升序 + 未处理优先（见 SortBalloonWorkQueueInPlace） */
            this.queueSortField = "in_date";
            this.queueSortOrder = "asc";
            this._bqTableSortHandlerBound = false;

            // 🔥 状态更新频率控制
            this.statusChangeCallCount = 0; // 连续调用 ChangeBalloonStatus 的次数
            this.statusChangeWaitTimer = null; // 等待定时器
            this.statusChangeWaitCountdown = 0; // 等待倒计时（秒）
            this.statusChangeWaitCountdownTimer = null; // 等待倒计时定时器
            
            /** 配送员：气球队列抢单 — 状态按钮内 2 秒二次确认（不占额外 DOM 条） */
            this.senderQueueConfirm = null;
        }

        /**
         * 重写 Init 方法（external mode，不依赖容器）
         */
        Init() {
            // 初始化缓存管理器（如果还没有初始化）
            // 注意：父类 RankSystem.Init() 在 externalMode 时会提前返回，不会初始化缓存
            // 所以我们需要自己初始化缓存
            if (!this.cache) {
                this.cache = new IndexedDBCache("csgoj_rank", "logotable");
                this.logoCache = new IndexedDBCache("csgoj_rank", "logotable");
            }

            // external mode：不依赖容器ID
            this.externalMode = true;
            this.container = null;

            // 清理之前的状态（调用父类方法）
            this.Cleanup();

            // 从 window.BALLOON_QUEUE_CONFIG 读取配置（因为构造函数可能还没执行完）
            // 这样可以确保在 Init() 中也能正确判断 isBalloonManager 和 isBalloonSender
            const queueConfig = window.BALLOON_QUEUE_CONFIG || {};
            const isBalloonManager = queueConfig.is_balloon_manager || false;
            const isBalloonSender = isBalloonManager
                ? false
                : queueConfig.is_balloon_sender || false;
            if (this.isMultiGroup === undefined) {
                this.isMultiGroup = !!queueConfig.is_multi_group;
                this.staffGroupIds = Array.isArray(queueConfig.staff_group_ids)
                    ? queueConfig.staff_group_ids.map((gid) => String(gid))
                    : [];
                this.contestGroups = Array.isArray(queueConfig.contest_groups)
                    ? queueConfig.contest_groups
                    : [];
                this.groupLocked = this.isMultiGroup && this.staffGroupIds.length > 0;
                this.ticketFeatureEnabled = false;
                this.autoPrintControlsInitialized = false;
                this.printAssetsLoadingPromise = null;
            }

            // 如果构造函数已经初始化了这些属性，使用实例属性；否则使用配置中的值
            // 这样可以兼容构造函数执行前后的两种情况
            const finalIsBalloonManager =
                this.isBalloonManager !== undefined
                    ? this.isBalloonManager
                    : isBalloonManager;
            const finalIsBalloonSender =
                this.isBalloonSender !== undefined
                    ? this.isBalloonSender
                    : isBalloonSender;

            // 初始化标签页事件（如果是配送员）
            if (finalIsBalloonSender) {
                this.InitTabs();
                this.InitSenderImmersiveFullscreen();
                EnsureBalloonSenderBstDropdownPortalListeners();
            }

            // 初始化筛选器事件（如果是管理员）
            if (finalIsBalloonManager) {
                this.InitFilters();
                this.InitTicketFeatureSwitch();
            }

            // 绑定键盘事件（F5刷新数据）
            // 注意：父类 RankSystem.BindEvents() 在 externalMode 时不会执行
            // 所以我们需要自己绑定 keydown 事件
            document.addEventListener("keydown", (e) => this.HandleKeydown(e));

            // 先初始化缓存，然后加载数据
            // 注意：父类 RankSystem.Init() 在 externalMode 时会提前返回，不会执行这部分
            // 所以我们需要自己处理
            this.cache.init().then(() => {
                this.LoadData();
            });
        }

        /**
         * 初始化小票功能总开关。关闭时不加载 Lodop 相关脚本，避免浏览器触发客户端检查。
         */
        InitTicketFeatureSwitch() {
            const featureSwitch = document.getElementById("balloon-ticket-feature-box");
            const configWrap = document.getElementById("balloon-ticket-config");
            if (!featureSwitch) return;
            const contestId = this.config.cid_list || "";
            const storageKey = `${contestId}_balloon_ticket_feature_on`;
            const savedEnabled = csg.store(storageKey);
            if (savedEnabled !== null && savedEnabled !== undefined) {
                featureSwitch.checked = savedEnabled === true || savedEnabled === "true";
            }

            const applyState = (checked) => {
                this.ticketFeatureEnabled = checked;
                csg.store(storageKey, checked);
                if (configWrap) {
                    /* 与总开关同在 strip 内 flex 一行，避免换行时开关单独占上一行 */
                    configWrap.style.display = checked ? "flex" : "none";
                }
                if (!checked) {
                    const autoSwitch = document.getElementById("balloon-auto-print-box");
                    if (autoSwitch && autoSwitch.checked && window.csgSwitch) {
                        window.csgSwitch.setChecked(autoSwitch, false);
                    }
                    this.StopAutoPrint();
                    return;
                }
                this.InitAutoPrint();
            };

            if (window.csgSwitch) {
                window.csgSwitch.initSwitch(featureSwitch, {
                    onChange: applyState,
                });
            }
            applyState(featureSwitch.checked === true);
        }

        EnsurePrintAssetsLoaded() {
            if (window.BalloonPrint && typeof window.BalloonPrint.printBalloons === "function") {
                return Promise.resolve();
            }
            if (this.printAssetsLoadingPromise) {
                return this.printAssetsLoadingPromise;
            }
            const ensureLodopObject = () => {
                if (document.getElementById("LODOP_OB")) return;
                const obj = document.createElement("object");
                obj.id = "LODOP_OB";
                obj.setAttribute("classid", "clsid:2105C259-1E0C-4534-8141-A753534CB4CA");
                obj.width = 0;
                obj.height = 0;
                const embed = document.createElement("embed");
                embed.id = "LODOP_EM";
                embed.type = "application/x-print-lodop";
                embed.width = 0;
                embed.height = 0;
                obj.appendChild(embed);
                document.body.appendChild(obj);
            };
            const loadScript = (src) => new Promise((resolve, reject) => {
                const existing = document.querySelector(`script[src="${src}"]`);
                if (existing) {
                    resolve();
                    return;
                }
                const script = document.createElement("script");
                script.src = src;
                script.onload = resolve;
                script.onerror = reject;
                document.head.appendChild(script);
            });

            ensureLodopObject();
            this.printAssetsLoadingPromise = loadScript("/static/lodop/LodopFuncs.js")
                .then(() => loadScript("/static/csgoj/contest/csg_print_job_queue.js"))
                .then(() => loadScript("/static/csgoj/contest/balloon_print.js?v=20261004_ccpc1"))
                .catch((error) => {
                    this.printAssetsLoadingPromise = null;
                    throw error;
                });
            return this.printAssetsLoadingPromise;
        }

        EnsureBalloonPrintReady() {
            return this.EnsurePrintAssetsLoaded().then(() => {
                if (typeof window.csgWaitForBalloonLodopReady === "function") {
                    return window.csgWaitForBalloonLodopReady();
                }
                return Promise.resolve();
            });
        }

        /**
         * 初始化自动打印功能
         */
        InitAutoPrint() {
            if (!this.ticketFeatureEnabled) {
                return;
            }
            if (this.autoPrintControlsInitialized) {
                return;
            }
            this.autoPrintControlsInitialized = true;
            const contestId = this.config.cid_list || "";
            const storageKeyPaperW = `${contestId}_balloon_print_paper_width_mm`;
            const storageKeyPaperFeed = `${contestId}_balloon_print_paper_feed_mm`;
            const storageKeyPaperTrim = `${contestId}_balloon_print_paper_width_trim_mm`;
            const storageKeyPerPage = `${contestId}_balloon_print_per_page`;
            const storageKeyThermal = `${contestId}_balloon_print_thermal_mode`;
            const storageKeyPageSizeLegacy = `${contestId}_balloon_print_page_size`;
            const storageKeyCustomWLegacy = `${contestId}_balloon_print_custom_width`;
            const storageKeyCustomHLegacy = `${contestId}_balloon_print_custom_height`;

            const readPaperMm = (v, fallback) => {
                const n = parseFloat(v);
                return !isNaN(n) && n > 0 ? n : fallback;
            };
            const readTrimMm = (v) => {
                const n = parseFloat(v);
                if (isNaN(n) || n < 0) {
                    return 0;
                }
                return Math.min(20, n);
            };

            // 初始化自动打印开关（参考 print_manager.js 的实现）
            const switchEl = document.getElementById("balloon-auto-print-box");
            if (switchEl && window.csgSwitch) {
                window.csgSwitch.initSwitch(switchEl, {
                    onChange: (checked) => {
                        this.OnAutoPrintToggle(checked);
                    },
                });
            }

            const paperWInput = document.getElementById("balloon-print-paper-width-mm");
            const paperFeedInput = document.getElementById("balloon-print-paper-feed-mm");
            const presetSelect = document.getElementById("balloon-print-paper-preset");

            if (paperWInput && paperFeedInput) {
                let w = csg.store(storageKeyPaperW);
                let f = csg.store(storageKeyPaperFeed);
                const hasNew =
                    w !== null &&
                    w !== undefined &&
                    w !== "" &&
                    f !== null &&
                    f !== undefined &&
                    f !== "";
                if (!hasNew) {
                    const oldPage = csg.store(storageKeyPageSizeLegacy);
                    const legacyPageRe = /^(\d+(?:\.\d+)?)\s*x\s*(\d+(?:\.\d+)?)$/i;
                    if (typeof oldPage === "string" && legacyPageRe.test(oldPage.trim())) {
                        const m = oldPage.trim().match(legacyPageRe);
                        w = readPaperMm(m[1], 57);
                        f = readPaperMm(m[2], 50);
                    } else {
                        w = readPaperMm(csg.store(storageKeyCustomWLegacy), 57);
                        f = readPaperMm(csg.store(storageKeyCustomHLegacy), 50);
                    }
                    csg.store(storageKeyPaperW, w);
                    csg.store(storageKeyPaperFeed, f);
                } else {
                    w = readPaperMm(w, 57);
                    f = readPaperMm(f, 50);
                }
                paperWInput.value = String(w);
                paperFeedInput.value = String(f);

                const persistPaperMm = () => {
                    const nw = readPaperMm(paperWInput.value, 57);
                    const nf = readPaperMm(paperFeedInput.value, 50);
                    paperWInput.value = String(nw);
                    paperFeedInput.value = String(nf);
                    csg.store(storageKeyPaperW, nw);
                    csg.store(storageKeyPaperFeed, nf);
                    this.CalculateMaxPerPage();
                };
                paperWInput.addEventListener("input", persistPaperMm);
                paperWInput.addEventListener("blur", persistPaperMm);
                paperFeedInput.addEventListener("input", persistPaperMm);
                paperFeedInput.addEventListener("blur", persistPaperMm);

                const swapBtn = document.getElementById("balloon-print-paper-dim-swap");
                if (swapBtn) {
                    swapBtn.addEventListener("click", () => {
                        const tmp = paperWInput.value;
                        paperWInput.value = paperFeedInput.value;
                        paperFeedInput.value = tmp;
                        persistPaperMm();
                    });
                }
            }

            if (presetSelect && paperWInput && paperFeedInput) {
                presetSelect.addEventListener("change", () => {
                    const raw = presetSelect.value;
                    if (!raw) return;
                    const parts = raw.toLowerCase().split("x");
                    if (parts.length < 2) return;
                    const nw = readPaperMm(parts[0], 57);
                    const nf = readPaperMm(parts[1], 50);
                    paperWInput.value = String(nw);
                    paperFeedInput.value = String(nf);
                    csg.store(storageKeyPaperW, nw);
                    csg.store(storageKeyPaperFeed, nf);
                    presetSelect.value = "";
                    this.CalculateMaxPerPage();
                    this.OnPerPageChange();
                });
            }

            const trimInput = document.getElementById("balloon-print-paper-width-trim-mm");
            if (trimInput) {
                const stTrim = csg.store(storageKeyPaperTrim);
                const trimInitial =
                    stTrim !== null && stTrim !== undefined && stTrim !== ""
                        ? readTrimMm(stTrim)
                        : 0;
                trimInput.value = String(trimInitial);
                const persistTrimMm = () => {
                    const t = readTrimMm(trimInput.value);
                    trimInput.value = String(t);
                    csg.store(storageKeyPaperTrim, t);
                    this.CalculateMaxPerPage();
                };
                trimInput.addEventListener("input", persistTrimMm);
                trimInput.addEventListener("blur", persistTrimMm);
            }

            // 初始化每页数量输入
            const perPageInput = document.getElementById("balloon-print-per-page");
            if (perPageInput) {
                // 从 localStorage 读取保存的值
                const savedPerPage = csg.store(storageKeyPerPage);
                if (savedPerPage) {
                    perPageInput.value = savedPerPage;
                }

                // 输入时实时验证
                perPageInput.addEventListener("input", () => {
                    this.OnPerPageChange();
                });
                // 失去焦点时验证并修正
                perPageInput.addEventListener("blur", () => {
                    this.OnPerPageChange();
                });
                // 键盘事件：Enter 键时验证
                perPageInput.addEventListener("keydown", (e) => {
                    if (e.key === "Enter") {
                        e.preventDefault();
                        this.OnPerPageChange();
                        perPageInput.blur();
                    }
                });
            }

            const thermalInput = document.getElementById("balloon-print-thermal-mode");
            const stThermal = csg.store(storageKeyThermal);
            const thermalExplicitOff =
                stThermal === false ||
                stThermal === "false" ||
                stThermal === 0 ||
                stThermal === "0" ||
                stThermal === "off";
            /* 无缓存或非显式关闭：默认热敏优化（与 balloon_queue 勾选初值一致） */
            const thermalOn = !thermalExplicitOff;
            if (thermalInput && window.csgSwitch) {
                thermalInput.checked = thermalOn;
                window.csgSwitch.initSwitch(thermalInput, {
                    onChange: (checked) => {
                        csg.store(storageKeyThermal, checked ? "1" : "0");
                    },
                });
                window.csgSwitch.setChecked(thermalInput, thermalOn);
            } else if (thermalInput) {
                thermalInput.checked = thermalOn;
                thermalInput.addEventListener("change", () => {
                    csg.store(storageKeyThermal, thermalInput.checked ? "1" : "0");
                });
            }

            // 初始计算最大数量和显示状态
            // 使用 setTimeout 确保 multiple-select 已完全初始化，并且值已设置完成
            // 注意：这里只计算最大数量，不触发 change 事件（因为值已经在上面设置过了）
            setTimeout(() => {
                // 只计算最大数量，不保存到 localStorage（避免重复保存）
                this.CalculateMaxPerPage();
                // 验证并保存每页数量（确保值在有效范围内）
                this.OnPerPageChange();
            }, 100);
        }

        /**
         * 处理自动打印开关切换
         */
        OnAutoPrintToggle(checked) {
            this.autoPrintEnabled = checked;

            if (checked) {
                this.EnsureBalloonPrintReady()
                    .then(() => {
                        if (this.autoPrintEnabled) {
                            this.StartAutoPrint();
                        }
                    })
                    .catch((error) => {
                        this.autoPrintEnabled = false;
                        const switchInput = document.getElementById("balloon-auto-print-box");
                        if (switchInput && window.csgSwitch) {
                            window.csgSwitch.setChecked(switchInput, false);
                        }
                        alerty.error({
                            message: `小票打印组件未就绪：${error.message || error}`,
                            message_en: `Ticket printing is not ready: ${error.message || error}`,
                        });
                    });
            } else {
                // 关闭自动打印
                this.StopAutoPrint();
            }
        }

        getBalloonAutoPrintBusyPollSec() {
            if (
                typeof CSG_AUTO_PRINT_BUSY_POLL_SEC === "number" &&
                !isNaN(CSG_AUTO_PRINT_BUSY_POLL_SEC)
            ) {
                return CSG_AUTO_PRINT_BUSY_POLL_SEC;
            }
            return 5;
        }

        getBalloonAutoPrintIdlePollSec() {
            if (
                typeof CSG_AUTO_PRINT_IDLE_POLL_SEC === "number" &&
                !isNaN(CSG_AUTO_PRINT_IDLE_POLL_SEC)
            ) {
                return CSG_AUTO_PRINT_IDLE_POLL_SEC;
            }
            return 10;
        }

        releaseBalloonAutoPrintSlot(reason) {
            this.auto_print_busy = false;
            this.auto_print_inflight_solution_ids = null;
        }

        clearBalloonAutoPrintTick() {
            if (this.auto_print_tick_timer) {
                clearTimeout(this.auto_print_tick_timer);
                this.auto_print_tick_timer = null;
            }
            if (this.auto_print_retry_timer) {
                clearTimeout(this.auto_print_retry_timer);
                this.auto_print_retry_timer = null;
            }
        }

        /**
         * 自动打印状态区（与逻辑一致：连打 / 闲时拉表 / 同步拉表）
         * @param {"printing"|"poll-idle"|"poll-busy"} mode
         * @param {number} [seconds] poll 模式下的剩余秒数
         */
        setBalloonAutoPrintCountdownUi(mode, seconds) {
            const wrap = document.getElementById("balloon-print-countdown");
            const strongId = "balloon-print-countdown-text";
            if (!wrap) {
                return;
            }
            this._bqCountdownUiMode = mode;
            if (mode === "printing") {
                wrap.innerHTML =
                    '(<strong id="' +
                    strongId +
                    '">打印中...</strong>)';
                wrap.setAttribute(
                    "title",
                    "正在连打小票（下一单由打印队列驱动，非下方秒数） / Printing tickets"
                );
                return;
            }
            const n =
                seconds != null && !isNaN(seconds)
                    ? seconds
                    : this.autoPrintCountdown;
            if (mode === "poll-idle") {
                wrap.innerHTML =
                    '(<strong id="' +
                    strongId +
                    '">闲时 ' +
                    n +
                    "</strong>s)";
                wrap.setAttribute(
                    "title",
                    "队列暂无待打小票，" +
                        n +
                        " 秒后拉取新提交 / Idle: refresh in " +
                        n +
                        "s"
                );
            } else {
                wrap.innerHTML =
                    '(<strong id="' + strongId + '">' + n + "</strong>s)";
                wrap.setAttribute(
                    "title",
                    "待打队列已空，" +
                        n +
                        " 秒后同步数据 / Sync data in " +
                        n +
                        "s"
                );
            }
        }

        scheduleBalloonAutoPrintTick() {
            this.clearBalloonAutoPrintTick();
            if (!this.autoPrintEnabled) {
                return;
            }
            this.auto_print_tick_timer = setTimeout(() => {
                this.tickBalloonAutoPrint();
            }, 1000);
        }

        tickBalloonAutoPrint() {
            if (!this.autoPrintEnabled || this.auto_print_busy) {
                return;
            }
            if (
                this._bqCountdownUiMode !== "poll-idle" &&
                this._bqCountdownUiMode !== "poll-busy"
            ) {
                return;
            }
            this.autoPrintCountdown--;
            this.setBalloonAutoPrintCountdownUi(
                this._bqCountdownUiMode,
                this.autoPrintCountdown
            );
            if (this.autoPrintCountdown <= 0) {
                this.RefreshData().then(() => {
                    if (!this.autoPrintEnabled) {
                        return;
                    }
                    this.auto_print_confirmed_idle =
                        (this.autoPrintPrintableCount || 0) === 0;
                    this.DoAutoPrint();
                });
                return;
            }
            this.scheduleBalloonAutoPrintTick();
        }

        /**
         * 启动自动打印
         */
        StartAutoPrint() {
            this.StopAutoPrint();
            this.auto_print_confirmed_idle = false;
            this.autoPrintPrintableCount = 0;
            this.autoPrintCountdown = this.getBalloonAutoPrintBusyPollSec();
            const countdownEl = document.getElementById("balloon-print-countdown");
            if (countdownEl) {
                countdownEl.style.display = "block";
            }
            (async () => {
                try {
                    await this.LoadData();
                    this.DoAutoPrint();
                } catch (error) {
                    this.StopAutoPrint();
                    const switchInput = document.getElementById("balloon-auto-print-box");
                    if (switchInput && window.csgSwitch) {
                        window.csgSwitch.setChecked(switchInput, false);
                    }
                }
            })();
        }

        /**
         * 停止自动打印
         */
        StopAutoPrint() {
            this.clearBalloonAutoPrintTick();
            if (this.statusChangeWaitTimer) {
                clearTimeout(this.statusChangeWaitTimer);
                this.statusChangeWaitTimer = null;
            }
            this.HideStatusChangeWaitCountdown();
            this.releaseBalloonAutoPrintSlot("stop");
            const countdownEl = document.getElementById("balloon-print-countdown");
            if (countdownEl) {
                countdownEl.style.display = "none";
            }
            this.autoPrintCountdown = this.getBalloonAutoPrintIdlePollSec();
            this.auto_print_confirmed_idle = false;
            this.autoPrintPrintableCount = 0;
        }

        /**
         * 检查并提示过滤条件（除房间外）
         */
        CheckAndNotifyFilters() {
            // 检查是否有除房间外的过滤条件
            const hasNonRoomFilters =
                (this.filters.status && this.filters.status.length > 0) ||
                this.filters.balloon_sender !== null ||
                (this.filters.schools && this.filters.schools.length > 0) ||
                (this.filters.problems && this.filters.problems.length > 0) ||
                (this.filters.searchText && this.filters.searchText.trim() !== "");

            if (!hasNonRoomFilters) {
                return; // 没有过滤条件，不提示
            }

            // 检查 localStorage，避免重复提示
            const contestId = this.config.cid_list || "";
            const storageKey = `${contestId}_balloon_print_filter_notified`;
            const hasNotified = csg.store(storageKey);

            if (hasNotified) {
                return; // 已经提示过，不再提示
            }

            // 提示用户
            alerty.notify({
                message: "当前筛选条件可能导致没有可打印的气球，请检查筛选设置",
                message_en:
                    "Current filter conditions may result in no printable balloons, please check filter settings",
                type: "warning",
                duration: 5000,
            });

            // 记录到 localStorage
            csg.store(storageKey, true);
        }

        /**
         * 更新拉表倒计时数字（仅 poll 模式；连打时勿调用）
         */
        UpdateAutoPrintCountdown() {
            const mode = this._bqCountdownUiMode;
            if (mode === "poll-idle" || mode === "poll-busy") {
                this.setBalloonAutoPrintCountdownUi(mode, this.autoPrintCountdown);
            }
        }

        /**
         * 处理每页数量变化
         */
        OnPerPageChange() {
            const perPageInput = document.getElementById("balloon-print-per-page");
            const maxCount = parseInt(
                document.getElementById("balloon-print-max-count")?.textContent || "1"
            );

            if (perPageInput) {
                let value = parseInt(perPageInput.value);

                // 如果输入为空或无效，设为1
                if (isNaN(value) || value === "") {
                    value = 1;
                }

                // 限制在有效范围内
                if (value > maxCount) {
                    value = maxCount;
                }
                if (value < 1) {
                    value = 1;
                }

                // 更新输入框值
                perPageInput.value = value;

                // 保存到 localStorage
                const contestId = this.config.cid_list || "";
                const storageKeyPerPage = `${contestId}_balloon_print_per_page`;
                csg.store(storageKeyPerPage, value.toString());

                // 添加视觉反馈：如果值被修正，短暂高亮
                if (
                    parseInt(perPageInput.value) !==
                    parseInt(perPageInput.getAttribute("data-last-value") || "1")
                ) {
                    perPageInput.style.backgroundColor = "#fff3cd";
                    setTimeout(() => {
                        perPageInput.style.backgroundColor = "";
                    }, 500);
                }

                // 记录当前值
                perPageInput.setAttribute("data-last-value", value);
            }
        }

        /**
         * 计算每页最大数量（根据纸张尺寸）
         */
        CalculateMaxPerPage() {
            const paperWInput = document.getElementById("balloon-print-paper-width-mm");
            const paperFeedInput = document.getElementById("balloon-print-paper-feed-mm");
            const trimInput = document.getElementById("balloon-print-paper-width-trim-mm");
            const maxCountEl = document.getElementById("balloon-print-max-count");

            if (!paperWInput || !paperFeedInput || !maxCountEl) return;

            const readPaperMm = (v, fallback) => {
                const n = parseFloat(v);
                return !isNaN(n) && n > 0 ? n : fallback;
            };
            const readTrimMm = (v) => {
                const n = parseFloat(v);
                if (isNaN(n) || n < 0) {
                    return 0;
                }
                return Math.min(20, n);
            };
            const width = readPaperMm(paperWInput.value, 57);
            const height = readPaperMm(paperFeedInput.value, 50);
            const trimMm = trimInput ? readTrimMm(trimInput.value) : 0;
            const effWidth = Math.max(10, width - trimMm);

            // 每个小票需要的最小尺寸（估算：58mm x 80mm）
            const minTicketWidth = 58;
            const minTicketHeight = 80;

            // 计算可以放置的数量（横向和纵向）
            const cols = Math.floor(effWidth / minTicketWidth);
            const rows = Math.floor(height / minTicketHeight);
            const maxCount = Math.max(1, cols * rows);

            // 更新最大数量显示
            maxCountEl.textContent = maxCount;

            // 更新每页数量输入的最大值（联动更新）
            const perPageInput = document.getElementById("balloon-print-per-page");
            if (perPageInput) {
                // 更新 max 属性（HTML 属性和 JavaScript 属性）
                perPageInput.setAttribute("max", maxCount);
                perPageInput.max = maxCount;

                // 获取当前值
                const currentValue = parseInt(perPageInput.value) || 1;

                // 如果当前值超过新的最大值，自动调整为最大值
                if (currentValue > maxCount) {
                    perPageInput.value = maxCount;
                    // 触发验证，确保值正确
                    this.OnPerPageChange();
                } else if (currentValue < 1) {
                    // 如果当前值小于1，设为1
                    perPageInput.value = 1;
                }

                // 如果当前值为空或无效，设为1
                if (!perPageInput.value || isNaN(parseInt(perPageInput.value))) {
                    perPageInput.value = 1;
                }
            }
        }
        getBalloonQueueTableBodyEl() {
            const wrap = $("#balloon-queue-table").closest(".bootstrap-table");
            if (!wrap.length) {
                return null;
            }
            const body = wrap.find(".fixed-table-body")[0];
            return body || null;
        }

        /** 保存窗口与表体滚动位置（打印后 refresh 时恢复，避免被 BST initBody 拉到顶部） */
        captureBalloonQueueScrollContext() {
            const body = this.getBalloonQueueTableBodyEl();
            const active = document.activeElement;
            return {
                winX: window.scrollX || 0,
                winY: window.scrollY || 0,
                tbl: body ? body.scrollTop : 0,
                active:
                    active &&
                    active !== document.body &&
                    typeof active.blur === "function"
                        ? active
                        : null,
            };
        }

        restoreBalloonQueueScrollContext(ctx) {
            if (!ctx) {
                return;
            }
            const body = this.getBalloonQueueTableBodyEl();
            if (body) {
                body.scrollTop = ctx.tbl;
            }
            window.scrollTo(ctx.winX, ctx.winY);
            if (
                ctx.active &&
                ctx.active.isConnected &&
                typeof ctx.active.focus === "function"
            ) {
                try {
                    ctx.active.focus({ preventScroll: true });
                } catch (e) {
                    try {
                        ctx.active.focus();
                    } catch (e2) {
                        /* ignore */
                    }
                }
            }
        }

        scheduleRestoreBalloonQueueScroll(ctx) {
            if (!ctx) {
                return;
            }
            const run = () => this.restoreBalloonQueueScrollContext(ctx);
            run();
            if (typeof requestAnimationFrame === "function") {
                requestAnimationFrame(() => {
                    run();
                    requestAnimationFrame(run);
                });
            } else {
                setTimeout(run, 0);
                setTimeout(run, 50);
            }
        }

        ensureBalloonQueueTableScrollHook() {
            if (this._bqTableScrollHookBound) {
                return;
            }
            const table = $("#balloon-queue-table");
            if (!table.length) {
                return;
            }
            this._bqTableScrollHookBound = true;
            table.on("sort.bs.table", () => {
                this._bqPendingScrollRestore =
                    this.captureBalloonQueueScrollContext();
            });
            table.on("post-body.bs.table", () => {
                if (this._bqPendingScrollRestore) {
                    this.scheduleRestoreBalloonQueueScroll(
                        this._bqPendingScrollRestore
                    );
                    this._bqPendingScrollRestore = null;
                }
            });
        }

        getBalloonTableSortSpec() {
            const table = $("#balloon-queue-table");
            if (table.length && table.data("bootstrap.table")) {
                try {
                    const opt = table.bootstrapTable("getOptions");
                    const field = opt.sortName || this.queueSortField || "in_date";
                    const order = opt.sortOrder || this.queueSortOrder || "asc";
                    this.queueSortField = field;
                    this.queueSortOrder = order;
                    return { field, order };
                } catch (e) {
                    /* ignore */
                }
            }
            return {
                field: this.queueSortField || "in_date",
                order: this.queueSortOrder || "asc",
            };
        }

        /**
         * client 全量队列：筛选 + 与表头一致的复合排序（打印与表格共用）
         */
        getBalloonWorkQueueRows() {
            const filtered = this.GetFilteredBalloonList();
            const rows = filtered.slice();
            const spec = this.getBalloonTableSortSpec();
            SortBalloonWorkQueueInPlace(rows, spec.field, spec.order);
            this.autoPrintPrintableCount = CountBalloonPrintableItems(rows);
            return rows;
        }

        ensureBalloonQueueTableSortHandler() {
            if (this._bqTableSortHandlerBound) {
                return;
            }
            const table = $("#balloon-queue-table");
            if (!table.length) {
                return;
            }
            this._bqTableSortHandlerBound = true;
            this.ensureBalloonQueueTableScrollHook();
            table.on("sort.bs.table", (e, name, order) => {
                this.queueSortField = name;
                this.queueSortOrder = order;
                try {
                    const data = table.bootstrapTable("getData") || [];
                    this.autoPrintPrintableCount = CountBalloonPrintableItems(data);
                } catch (err) {
                    /* ignore */
                }
            });
        }

        /**
         * 刷新 client 表：重排筛选结果并 load（所见即所得，与自动打印队列一致）
         */
        refreshBalloonQueueView(opts = {}) {
            const preserveScroll = opts.preserveScroll !== false;
            const spec = this.getBalloonTableSortSpec();
            const rows = this.GetFilteredBalloonList().slice();
            SortBalloonWorkQueueInPlace(rows, spec.field, spec.order);
            const table = $("#balloon-queue-table");
            let pageNumber = 1;
            let prevPage = 1;
            if (opts.keepPage && table.length && table.data("bootstrap.table")) {
                try {
                    prevPage = table.bootstrapTable("getOptions").pageNumber || 1;
                    pageNumber = prevPage;
                } catch (e) {
                    pageNumber = 1;
                    prevPage = 1;
                }
            }
            const scrollCtx = preserveScroll
                ? this.captureBalloonQueueScrollContext()
                : null;
            if (preserveScroll) {
                this._bqPendingScrollRestore = scrollCtx;
            }
            this.TableLoadData(rows, spec, {
                preserveScroll,
                pageNumber: opts.keepPage ? pageNumber : undefined,
            });
            if (table.length && table.data("bootstrap.table")) {
                try {
                    const opt = table.bootstrapTable("getOptions");
                    const totalPages = opt.totalPages || 1;
                    const target = Math.min(pageNumber, totalPages || 1) || 1;
                    if (target !== prevPage) {
                        table.bootstrapTable("selectPage", target);
                    }
                    const data = table.bootstrapTable("getData") || [];
                    this.autoPrintPrintableCount = CountBalloonPrintableItems(data);
                } catch (e2) {
                    /* ignore */
                }
            } else {
                this.autoPrintPrintableCount = CountBalloonPrintableItems(rows);
            }
            if (preserveScroll && scrollCtx) {
                this.scheduleRestoreBalloonQueueScroll(scrollCtx);
            }
            this.ensureBalloonQueueTableSortHandler();
            this.BindTableClickEvents();
        }

        TableLoadData(data, sortSpec, loadOpts = {}) {
            if (!Array.isArray(data)) {
                console.warn("TableLoadData data is not an array");
            }
            const spec = sortSpec || this.getBalloonTableSortSpec();
            const rows = Array.isArray(data) ? data : [];
            SortBalloonWorkQueueInPlace(rows, spec.field, spec.order);
            const table = $("#balloon-queue-table");
            if (!table.length) return;

            const preserveScroll = loadOpts.preserveScroll !== false;
            const layoutReset = !!loadOpts.layoutReset;

            const resetBalloonQueueTableLayout = () => {
                if (!table.data("bootstrap.table") || !layoutReset) {
                    return;
                }
                try {
                    table.bootstrapTable("refreshOptions", { height: null });
                } catch (e0) {
                    /* ignore */
                }
                try {
                    table.bootstrapTable("resetView");
                } catch (e1) {
                    /* ignore */
                }
            };

            const tableOpts = {
                data: rows,
                uniqueId: "solution_id",
                sortName: spec.field,
                sortOrder: spec.order,
                customSort: BalloonQueueCustomSort,
                fixedScroll: true,
            };
            if (table.data("bootstrap.table")) {
                BqSenderDdCleanupOrphanMenus();
                if (preserveScroll) {
                    this._bqPendingScrollRestore =
                        this.captureBalloonQueueScrollContext();
                }
                try {
                    const ro = {
                        sortName: spec.field,
                        sortOrder: spec.order,
                        customSort: BalloonQueueCustomSort,
                        fixedScroll: true,
                    };
                    if (
                        loadOpts.pageNumber !== undefined &&
                        loadOpts.pageNumber !== null
                    ) {
                        ro.pageNumber = loadOpts.pageNumber;
                    }
                    table.bootstrapTable("refreshOptions", ro);
                } catch (eOpt) {
                    /* ignore */
                }
                rows.fixedScroll = true;
                table.bootstrapTable("load", rows);
                resetBalloonQueueTableLayout();
            } else {
                BqSenderDdCleanupOrphanMenus();
                table.bootstrapTable(tableOpts);
                resetBalloonQueueTableLayout();
            }
        }

        collectNextBalloonPrintBatch(perPage) {
            const rows = this.getBalloonWorkQueueRows();
            const inflight = this.auto_print_inflight_solution_ids;
            const batch = [];
            for (let i = 0; i < rows.length; i++) {
                const row = rows[i];
                if ((Number(row.bst) || 0) !== 0) {
                    continue;
                }
                const sid = String(row.solution_id || "");
                if (inflight && inflight.has(sid)) {
                    continue;
                }
                batch.push(row);
                if (batch.length >= perPage) {
                    break;
                }
            }
            return batch;
        }

        showBalloonAutoPrintSuccess(balloons) {
            const scrollCtx = this.captureBalloonQueueScrollContext();
            (balloons || []).forEach((b) => {
                const teamId = b.team_id || "";
                const teamName = b.team_name || "";
                const prob = b.problem_alphabet || b.problem_num || "";
                const zone = b.room || "";
                const cnTeam =
                    teamName && String(teamName) !== String(teamId)
                        ? `${teamId} ${teamName}`
                        : String(teamId);
                alerty.success({
                    message: `小票已打印<br/>队伍：${cnTeam}<br/>题目：${prob}<br/>分区：${zone}`,
                    message_en: `Ticket printed<br/>Team: ${cnTeam}<br/>Problem: ${prob}<br/>Zone: ${zone}`,
                });
            });
            this.scheduleRestoreBalloonQueueScroll(scrollCtx);
        }

        /**
         * 自动模式调度（client 队列；拉数节奏对齐 csg_print_job_queue 闲时/忙时秒数）
         */
        DoAutoPrint() {
            if (!this.autoPrintEnabled) {
                return;
            }
            this.clearBalloonAutoPrintTick();
            const started = this.tryStartAutoPrintBalloon();
            const hasPending = (this.autoPrintPrintableCount || 0) > 0;

            if (this.auto_print_busy || started) {
                this.auto_print_confirmed_idle = false;
                this.setBalloonAutoPrintCountdownUi("printing");
                return;
            }

            if (hasPending) {
                this.auto_print_confirmed_idle = false;
                this.setBalloonAutoPrintCountdownUi("printing");
                this.auto_print_retry_timer = setTimeout(() => {
                    this.auto_print_retry_timer = null;
                    if (this.autoPrintEnabled) {
                        this.DoAutoPrint();
                    }
                }, 1000);
                return;
            }

            if (!started && !hasPending && !this.auto_print_busy) {
                this.CheckAndNotifyFilters();
            }

            const pollMode = this.auto_print_confirmed_idle
                ? "poll-idle"
                : "poll-busy";
            this.autoPrintCountdown =
                pollMode === "poll-idle"
                    ? this.getBalloonAutoPrintIdlePollSec()
                    : this.getBalloonAutoPrintBusyPollSec();
            this.setBalloonAutoPrintCountdownUi(pollMode, this.autoPrintCountdown);
            this.scheduleBalloonAutoPrintTick();
        }

        tryStartAutoPrintBalloon() {
            if (!this.autoPrintEnabled || this.auto_print_busy) {
                return false;
            }
            const perPageInput = document.getElementById("balloon-print-per-page");
            const perPage = Math.max(1, parseInt(perPageInput?.value || 1, 10) || 1);
            const batch = this.collectNextBalloonPrintBatch(perPage);
            if (batch.length === 0) {
                return false;
            }
            this.auto_print_busy = true;
            this.auto_print_inflight_solution_ids = new Set(
                batch.map((b) => String(b.solution_id || ""))
            );
            this.executeAutoPrintBatch(batch, perPage);
            return true;
        }

        executeAutoPrintBatch(balloonsToPrint, perPage) {
            this.EnsureBalloonPrintReady()
                .then(() => {
                    if (
                        !window.BalloonPrint ||
                        typeof window.BalloonPrint.printBalloons !== "function"
                    ) {
                        throw new Error("BalloonPrint is not available");
                    }
                    const balloonsToPrintWithPadding =
                        balloonsToPrint.length < perPage
                            ? [
                                  ...balloonsToPrint,
                                  ...Array(perPage - balloonsToPrint.length).fill(
                                      null
                                  ),
                              ]
                            : balloonsToPrint;

                    window.BalloonPrint.printBalloons(
                        balloonsToPrintWithPadding,
                        perPage,
                        (printError) => {
                            if (printError) {
                                const errorMsg = printError.message || printError;
                                const balloonCount = balloonsToPrint.length;
                                alerty.alert({
                                    title:
                                        '自动打印失败<span class="en-text">Auto Print Failed</span>',
                                    message: `共 ${balloonCount} 个气球打印失败<br/><br/>错误: ${errorMsg}<br/><br/>自动打印已停止`,
                                    message_en: `${balloonCount} balloons failed to print<br/><br/>Error: ${errorMsg}<br/><br/>Auto print stopped`,
                                    width: "500px",
                                });
                                this.releaseBalloonAutoPrintSlot("print-error");
                                this.StopAutoPrint();
                                const switchInput = document.getElementById(
                                    "balloon-auto-print-box"
                                );
                                if (switchInput && window.csgSwitch) {
                                    window.csgSwitch.setChecked(switchInput, false);
                                }
                                return;
                            }

                            const solutionIds = balloonsToPrint
                                .map((b) => b.solution_id)
                                .filter((id) => id);
                            solutionIds.forEach((solutionId) => {
                                this.UpdateBalloonItem(solutionId, { bst: 10 }, false);
                            });

                            const updatedBalloons = this.balloonList.filter((item) =>
                                solutionIds.includes(item.solution_id)
                            );
                            const finishBatch = () => {
                                this.releaseBalloonAutoPrintSlot("batch-done");
                                if (this.autoPrintEnabled) {
                                    this.DoAutoPrint();
                                }
                            };
                            const runAfterWrite = async () => {
                                if (updatedBalloons.length > 0) {
                                    await this.UpdateBalloonsStatus(updatedBalloons, 10, {
                                        skipRateLimit: true,
                                    });
                                }
                                this.showBalloonAutoPrintSuccess(balloonsToPrint);
                                this.refreshBalloonQueueView({
                                    keepPage: true,
                                    preserveScroll: true,
                                });
                                finishBatch();
                            };
                            runAfterWrite().catch((updateError) => {
                                const balloonCount = balloonsToPrint.length;
                                alerty.alert({
                                    title:
                                        '部分失败<span class="en-text">Partial Failure</span>',
                                    message: `共 ${balloonCount} 个气球打印成功，但更新状态失败: ${updateError.message || updateError}<br/>请手动检查`,
                                    message_en: `${balloonCount} balloons printed successfully, but status update failed: ${updateError.message || updateError}<br/>Please check manually`,
                                    width: "500px",
                                });
                                this.releaseBalloonAutoPrintSlot("status-error");
                                if (this.autoPrintEnabled) {
                                    this.DoAutoPrint();
                                }
                            });
                        }
                    );
                })
                .catch((error) => {
                    alerty.alert({
                        title:
                            '自动打印失败<span class="en-text">Auto Print Failed</span>',
                        message: `打印组件未就绪<br/><br/>错误: ${error.message || error}<br/><br/>自动打印已停止`,
                        message_en: `Print component is not ready<br/><br/>Error: ${error.message || error}<br/><br/>Auto print stopped`,
                        width: "500px",
                    });
                    this.releaseBalloonAutoPrintSlot("not-ready");
                    this.StopAutoPrint();
                    const switchInput = document.getElementById("balloon-auto-print-box");
                    if (switchInput && window.csgSwitch) {
                        window.csgSwitch.setChecked(switchInput, false);
                    }
                });
        }

        /**
         * 打印单个气球的小票
         * @param {Object} row - 表格行数据
         */
        PrintSingleBalloon(row) {
            if (!row) {
                alerty.error({
                    message: "无法获取气球信息",
                    message_en: "Unable to get balloon information",
                });
                return;
            }
            if (!this.ticketFeatureEnabled) {
                alerty.info({
                    message: "请先开启小票功能",
                    message_en: "Please enable ticket printing first",
                });
                return;
            }

            // 从 row 构建打印所需的气球对象
            // 打印函数需要的字段：team_id, team (包含 room), problem_alphabet, is_global_fb, is_regular_fb
            const balloon = {
                team_id: row.team_id || "",
                team: row.team || { room: row.room || "" },
                problem_id: row.problem_id,
                ccpc_freeze_at: row.ccpc_freeze_at,
                ccpc_clock_offset: row.ccpc_clock_offset,
                problem_alphabet: row.problem_alphabet || "",
                is_global_fb: row.is_global_fb || false,
                is_regular_fb: row.is_regular_fb || false,
                solution_id: row.solution_id,
                bst: row.bst,
            };

            this.EnsureBalloonPrintReady()
                .then(() => {
                    if (
                        !window.BalloonPrint ||
                        typeof window.BalloonPrint.printBalloons !== "function"
                    ) {
                        throw new Error("BalloonPrint is not available");
                    }
                    window.BalloonPrint.printBalloons([balloon], 1, () => {
                        // 打印成功后的回调
                        // 如果当前状态是 0（未处理），自动更新为 10（已通知）
                        if (row.bst === 0) {
                            // ChangeBalloonStatus 内部会显示成功/失败消息，这里只显示打印成功消息
                            this.ChangeBalloonStatus(row, 10, null, "");
                        } else {
                            alerty.success({
                                message: "小票打印成功",
                                message_en: "Ticket printed successfully",
                            });
                        }
                    });
                })
                .catch((error) => {
                    alerty.error({
                        message: `打印功能未初始化：${error.message || error}`,
                        message_en: `Print function not initialized: ${error.message || error}`,
                    });
                });
        }

        /**
         * 更新气球状态（批量）
         */
        async UpdateBalloonsStatus(balloons, newStatus, opts = {}) {
            const skipRateLimit = !!(opts && opts.skipRateLimit);
            for (const balloon of balloons) {
                try {
                    // 🔥 先更新数据源（立即生效，避免重复打印）
                    // 注意：ChangeBalloonStatus 会再次调用 UpdateBalloonItem，但这里先更新可以避免重复打印
                    // 如果数据源已经更新过（bst=10），这里可以跳过，避免重复更新
                    if (balloon.bst !== newStatus) {
                        this.UpdateBalloonItem(balloon.solution_id, { bst: newStatus }, false);
                    }
                    
                    // 然后调用后端更新（会再次调用 UpdateBalloonItem 更新视图）
                    await this.ChangeBalloonStatus(
                        balloon,
                        newStatus,
                        null,
                        "",
                        false,
                        skipRateLimit
                    );
                } catch (error) {
                    // 更新气球状态失败，静默处理
                }
            }

            // 只需要更新统计（如果批量更新时统计没更新）
            this.UpdateQueueStats();
            // 不再需要全量刷新，因为 ChangeBalloonStatus 已经用 updateByUniqueId 更新了
        }

        /**
         * 初始化标签页事件
         */
        InitTabs() {
            const tabQueue = document.getElementById("tab-queue");
            const tabMy = document.getElementById("tab-my-balloons");

            // 设置初始标签页状态
            if (tabQueue && tabQueue.classList.contains("active")) {
                this.currentTab = "queue";
            } else if (tabMy && tabMy.classList.contains("active")) {
                this.currentTab = "my_balloons";
            }

            // 监听标签页切换事件
            if (tabQueue) {
                tabQueue.addEventListener("shown.bs.tab", () => {
                    this.SwitchTab("queue");
                });
            }

            if (tabMy) {
                tabMy.addEventListener("shown.bs.tab", () => {
                    this.SwitchTab("my_balloons");
                });
            }
        }

        /**
         * 配送员：统计 + 主表沉浸全屏（固定层，非 Fullscreen API，避免 body 上轻提示/alerty 被裁到层下）
         */
        InitSenderImmersiveFullscreen() {
            const root = document.getElementById(
                "balloon-queue-sender-work-region"
            );
            const enterBtn = document.getElementById(
                "balloon-queue-sender-fs-enter"
            );
            const exitBtn = document.getElementById(
                "balloon-queue-sender-fs-exit"
            );
            if (!root || !enterBtn || !exitBtn) return;
            if (root.dataset.bqFsInit === "1") return;
            root.dataset.bqFsInit = "1";
            enterBtn.addEventListener("click", () =>
                this.SetBalloonQueueSenderWorkFullscreen(true)
            );
            exitBtn.addEventListener("click", () =>
                this.SetBalloonQueueSenderWorkFullscreen(false)
            );
        }

        SetBalloonQueueSenderWorkFullscreen(on) {
            const root = document.getElementById(
                "balloon-queue-sender-work-region"
            );
            if (!root) return;
            const next = !!on;
            root.classList.toggle(
                "balloon-queue-sender-work-region--fs",
                next
            );
            document.body.classList.toggle(
                "balloon-queue-sender-fs-active",
                next
            );
            const topbar = root.querySelector(
                ".balloon-queue-sender-fs-topbar"
            );
            if (topbar) {
                topbar.setAttribute("aria-hidden", next ? "false" : "true");
            }
            window.setTimeout(() => {
                try {
                    const table = document.getElementById(
                        "balloon-queue-table"
                    );
                    if (
                        table &&
                        typeof window.$ === "function" &&
                        window.$.fn &&
                        window.$.fn.bootstrapTable &&
                        window.$(table).data("bootstrap.table")
                    ) {
                        window.$(table).bootstrapTable("resetView");
                    }
                } catch (err) {}
            }, 0);
        }

        HandleKeydown(e) {
            const workRoot = document.getElementById(
                "balloon-queue-sender-work-region"
            );
            if (
                e.key === "Escape" &&
                workRoot &&
                workRoot.classList.contains(
                    "balloon-queue-sender-work-region--fs"
                )
            ) {
                this.SetBalloonQueueSenderWorkFullscreen(false);
                e.preventDefault();
                return;
            }
            super.HandleKeydown(e);
        }

        /**
         * 从 localStorage 加载筛选条件
         */
        LoadFiltersFromStorage() {
            if (!this.contestId) return this.getDefaultFilters();

            const baseKey = `${this.contestId}_balloon_filter`;
            const savedStatus = csg.store(`${baseKey}_status`);
            const savedSender = csg.store(`${baseKey}_balloon_sender`);
            const savedRooms = csg.store(`${baseKey}_rooms`);
            const savedSchools = csg.store(`${baseKey}_schools`);
            const savedProblems = csg.store(`${baseKey}_problems`);
            const savedGroups = csg.store(`${baseKey}_groups`);
            const savedSearchText = csg.store(`${baseKey}_searchText`);

            return {
                status: Array.isArray(savedStatus)
                    ? [...new Set(
                        savedStatus
                            .map((s) => NormalizeContestBalloonBst(s))
                            .filter((n) => [0, 10, 20, 30].includes(n))
                    )]
                    : [],
                balloon_sender: savedSender || null,
                rooms: Array.isArray(savedRooms) ? savedRooms : [],
                schools: Array.isArray(savedSchools) ? savedSchools : [],
                problems: Array.isArray(savedProblems) ? savedProblems : [],
                groups: Array.isArray(savedGroups) ? savedGroups : [],
                searchText: typeof savedSearchText === "string" ? savedSearchText : "",
            };
        }

        /**
         * 保存筛选条件到 localStorage
         */
        SaveFiltersToStorage() {
            if (!this.contestId || !this.filters) return;

            const baseKey = `${this.contestId}_balloon_filter`;
            csg.store(`${baseKey}_status`, this.filters.status);
            csg.store(`${baseKey}_balloon_sender`, this.filters.balloon_sender);
            csg.store(`${baseKey}_rooms`, this.filters.rooms);
            csg.store(`${baseKey}_schools`, this.filters.schools);
            csg.store(`${baseKey}_problems`, this.filters.problems);
            csg.store(`${baseKey}_groups`, this.filters.groups);
            csg.store(`${baseKey}_searchText`, this.filters.searchText);
        }

        /**
         * 获取默认筛选条件
         */
        getDefaultFilters() {
            return {
                status: [],
                balloon_sender: null,
                rooms: [],
                schools: [],
                problems: [],
                groups: [],
                searchText: "",
            };
        }

        /**
         * 初始化筛选器事件
         */
        InitFilters() {
            // 注意：multiple-select 的事件绑定需要在插件初始化时通过回调函数设置
            // 原生 change 事件可能不会正确触发，所以我们在 UpdateFilters 中初始化时绑定

            // 绑定搜索框的输入事件
            const searchInput = document.getElementById("filter-search");
            if (searchInput) {
                // 使用 input 事件支持实时搜索，debounce 避免频繁触发
                let searchTimeout = null;
                searchInput.addEventListener("input", (e) => {
                    clearTimeout(searchTimeout);
                    searchTimeout = setTimeout(() => {
                        this.OnSearchChange(e.target.value);
                    }, 300); // 300ms 延迟
                });
            }

            // 绑定清空按钮事件
            const clearButton = document.getElementById("balloon-filter-clear");
            if (clearButton) {
                clearButton.addEventListener("click", () => {
                    this.ClearAllFilters();
                });
            }
        }

        /**
         * 重写 ShowLoading 方法
         */
        ShowLoading() {
            if (this.externalMode) return;
            const loadingEl = document.getElementById("balloon-queue-loading");
            if (loadingEl) {
                loadingEl.style.display = "block";
            }
        }

        /**
         * 重写 HideLoading 方法
         */
        HideLoading() {
            if (this.externalMode) return;
            const loadingEl = document.getElementById("balloon-queue-loading");
            if (loadingEl) {
                loadingEl.style.display = "none";
            }
        }

        /**
         * 切换标签页
         */
        SwitchTab(tab) {
            if (this.isBalloonSender && !this.isBalloonManager) {
                this.CancelSenderQueueConfirm({ skipTableRefresh: true });
            }
            this.currentTab = tab;

            // 重新渲染列表
            this.RenderQueueList();
        }

        /**
         * 配送员专用：是否为「仅配送员」队列视角（非气球管理员）
         */
        IsSenderBalloonQueueUi() {
            return !!(this.isBalloonSender && !this.isBalloonManager);
        }

        CancelSenderQueueConfirm(opts) {
            const p = this.senderQueueConfirm;
            if (!p) {
                return;
            }
            if (p.expireTimer) {
                clearTimeout(p.expireTimer);
            }
            if (p.tickTimer) {
                clearInterval(p.tickTimer);
            }
            this.senderQueueConfirm = null;
            if (opts && opts.skipTableRefresh) {
                return;
            }
            this.RenderQueueList();
        }

        InvalidateSenderQueueConfirmIfStale() {
            if (!this.IsSenderBalloonQueueUi()) return;
            const p = this.senderQueueConfirm;
            if (!p) return;
            const item = this.balloonList.find(
                (x) => String(x.solution_id) === String(p.solutionId)
            );
            if (!item || NormalizeContestBalloonBst(item.bst) !== p.bst) {
                this.CancelSenderQueueConfirm();
            }
        }

        StartSenderQueueConfirm(row, td) {
            this.CancelSenderQueueConfirm();
            const tableEl = document.getElementById("balloon-queue-table");
            const su = String(row.solution_id);
            const tdEl =
                !td
                    ? null
                    : td.nodeType === 1
                      ? td
                      : td[0] || null;
            let btn = null;
            let targetTd = null;
            // bootstrap-table 的 tbody <td> 默认不带 data-field（仅表头有）；click-cell 的 td 为 jQuery 对象，须取 [0]。
            if (tdEl && tdEl.isConnected) {
                btn = tdEl.querySelector(".balloon-queue-status-btn");
                if (btn) {
                    targetTd = tdEl;
                }
            }
            if (!btn && tableEl) {
                const tr = Array.from(
                    tableEl.querySelectorAll("tbody tr[data-uniqueid]")
                ).find(
                    (r) => String(r.getAttribute("data-uniqueid")) === su
                );
                BalloonSenderConfirmLog("resolve-tr", {
                    solutionId: su,
                    found: !!tr,
                    uniqueid: tr ? tr.getAttribute("data-uniqueid") : null,
                });
                if (tr) {
                    btn = tr.querySelector(".balloon-queue-status-btn");
                    if (btn) {
                        targetTd = btn.closest("td");
                    }
                }
            }
            BalloonSenderConfirmLog("resolve-btn", {
                solutionId: su,
                hasTd: !!targetTd,
                hasBtn: !!btn,
            });
            if (!btn) {
                return;
            }
            btn.removeAttribute("title");
            btn.className =
                "btn btn-sm w-100 balloon-queue-status-btn balloon-queue-status-btn--sender-confirm";
            const sid = row.solution_id;
            const bst = NormalizeContestBalloonBst(row.bst);
            const ARM_MS = 2000;
            const expireAt = Date.now() + ARM_MS;
            const state = {
                solutionId: sid,
                bst,
                expireAt,
                tickTimer: null,
                expireTimer: null,
            };
            this.senderQueueConfirm = state;
            const tick = () => {
                if (!this.senderQueueConfirm || this.senderQueueConfirm !== state) {
                    return;
                }
                if (
                    String(this.senderQueueConfirm.solutionId) !== String(sid)
                ) {
                    return;
                }
                const left = Math.max(0, Math.ceil((expireAt - Date.now()) / 1000));
                const secLabel = left > 0 ? `${left}s` : "…";
                btn.innerHTML =
                    '<span class="balloon-queue-sender-confirm-line1">' +
                    '<span class="balloon-queue-sender-confirm-cn">再点此确认</span>' +
                    '<span class="balloon-queue-sender-confirm-count" aria-live="polite">' +
                    RankToolEscapeHtml(secLabel) +
                    "</span></span>" +
                    '<span class="balloon-queue-sender-confirm-en en-text">Tap again to confirm</span>';
            };
            tick();
            state.tickTimer = setInterval(tick, 200);
            state.expireTimer = setTimeout(() => {
                this.CancelSenderQueueConfirm();
            }, ARM_MS);
            BalloonSenderConfirmLog("armed", {
                solutionId: sid,
                bst,
                className: btn.className,
            });
        }

        OnBalloonSenderQueueStatusClick(row, td) {
            if (!this.IsSenderBalloonQueueUi()) return;
            if (this.currentTab === "my_balloons") {
                const b = NormalizeContestBalloonBst(row.bst);
                if (b === 20 || b === 30) {
                    return;
                }
            }
            const sid = row.solution_id;
            const bst = NormalizeContestBalloonBst(row.bst);
            const now = Date.now();
            const p = this.senderQueueConfirm;
            if (
                p &&
                String(p.solutionId) === String(sid) &&
                p.bst === bst &&
                now < p.expireAt
            ) {
                const live = this.balloonList.find(
                    (x) => String(x.solution_id) === String(sid)
                );
                if (
                    !live ||
                    NormalizeContestBalloonBst(live.bst) !== bst
                ) {
                    this.CancelSenderQueueConfirm();
                    BalloonQueueShowMiniToast(
                        "info",
                        "数据已更新，请重新操作",
                        "Data changed; try again"
                    );
                    return;
                }
                this.CancelSenderQueueConfirm({ skipTableRefresh: true });
                this.ExecuteSenderConfirmableAction(live).finally(() => {
                    this.RenderQueueList();
                });
                return;
            }
            if (this.currentTab === "queue" && bst !== 0) {
                BalloonQueueShowMiniToast(
                    "info",
                    "仅待领取任务可抢",
                    "Only pending tasks can be grabbed"
                );
                return;
            }
            if (this.currentTab === "my_balloons" && bst === 0) {
                BalloonQueueShowMiniToast(
                    "info",
                    "当前状态不可在此变更",
                    "No change here"
                );
                return;
            }
            this.StartSenderQueueConfirm(row, td);
        }

        /**
         * 配送员：队列抢单，或「我的气球」中非下拉状态（如已通知）退回未发放
         */
        ExecuteSenderConfirmableAction(row) {
            if (this.currentTab === "queue") {
                return this.ChangeBalloonStatus(row, 20, null, "grab", true);
            }
            const bst = NormalizeContestBalloonBst(row.bst);
            if (bst !== 0) {
                return this.ChangeBalloonStatus(row, 0, null, "", true);
            }
            return Promise.resolve();
        }

        ExecuteSenderDeliver(row) {
            return this.ChangeBalloonStatus(row, 30, row.balloon_sender, "", true);
        }

        ExecuteSenderWithdraw(row) {
            return this.ChangeBalloonStatus(row, 20, row.balloon_sender, "", true);
        }

        ExecuteSenderReturn(row) {
            return this.ChangeBalloonStatus(row, 0, null, "", true);
        }

        /**
         * 重写 OriInit 方法（数据加载完成后调用）
         */
        OriInit(raw_data) {
            this.data = raw_data;
            // 将 list 格式转换为 dict 格式（父类方法）
            this.ConvertListToDict();
            // 处理数据
            this.ProcessData();
            // 隐藏加载提示
            this.HideLoading();
            this.isInitialLoad = false;
        }

        /**
         * 重写 ProcessData 方法，处理队列数据
         */
        ProcessData(flg_real_rank = false) {
            // 调用父类方法处理数据（会过滤AC、构建balloonMap等）
            super.ProcessData(flg_real_rank);

            // 构建气球列表
            this.BuildBalloonList();

            if (this.isBalloonSender && !this.isBalloonManager) {
                this.InvalidateSenderQueueConfirmIfStale();
            }

            // 提取rooms和senders
            this.ExtractRoomsAndSenders();

            // 更新筛选器
            this.UpdateFilters();

            // client 表：筛选 + 复合排序（与自动打印队列一致）
            this.refreshBalloonQueueView();

            // 更新统计
            this.UpdateQueueStats();
        }

        /**
         * 构建气球列表（包含所有需要的字段，避免在渲染时重复计算）
         */
        IsFrozen(solution) {
            // 仅用于队列展示 flg_frozen（标封榜、不隐藏 AC、不阻断操作）；全场首答见 applyGlobalMapFbForBalloon
            const inDate = solution.in_date;
            const submitTime = new Date(inDate).getTime();
            const endTime = new Date(this.data.contest.end_time).getTime();
            const frozenMinutes = this.data.contest.frozen_minute || 0;
            const frozenAfter = this.data.contest.frozen_after || 0;
            const frozenStartTime = endTime - frozenMinutes * 60 * 1000;
            const frozenEndTime = endTime + frozenAfter * 60 * 1000;
            // 不在封榜时间内的提交
            if (submitTime <= frozenStartTime) {
                return false;
            }
            // 在封榜期间，且当前时间仍在封榜或揭晓期间内
            const now = this.GetActualCurrentTime().getTime();
            return frozenStartTime <= now && now <= frozenEndTime;
        }
        BuildBalloonList() {
            this.balloonList = [];

            if (
                !this.data ||
                !this.data.solution ||
                !this.data.team ||
                !this.data.problem
            )
                return;

            // 构建team和problem映射（数据已经是dict格式，由父类ConvertListToDict转换）
            const teamMap = {};
            this.data.team.forEach((team) => {
                // 数据已经是dict格式，使用team_id作为key
                teamMap[team.team_id] = team;
            });

            const problemMap = {};
            this.data.problem.forEach((prob) => {
                problemMap[prob.problem_id] = prob;
            });

            // 遍历所有AC提交（父类ProcessData已经过滤为AC），构建气球列表
            this.data.solution.forEach((solution) => {
                // 数据已经是dict格式
                const teamId = solution.team_id;
                const problemId = solution.problem_id;
                const key = `${teamId}_${problemId}`;

                // 获取气球状态（确保是数字类型）
                const balloon = this.balloonMap.get(key);
                const bst = balloon ? NormalizeContestBalloonBst(balloon.bst) : 0;
                const pst = balloon ? Number(balloon.pst) || 0 : 0;
                const balloonSender = balloon ? balloon.balloon_sender || "" : "";

                // 获取队伍和题目信息
                const team = teamMap[teamId];
                const problem = problemMap[problemId];

                if (!team || !problem) return;

                // 计算首答信息（map_fb 已在父类 ProcessData 中填充）
                const regularFB = this.map_fb?.regular?.[problemId];
                const globalFB = this.map_fb?.global?.[problemId];
                const isRegularFB = regularFB && regularFB.team_id === teamId;
                const isGlobalFB = globalFB && globalFB.team_id === teamId;

                // 构建气球项（包含所有需要的字段）
                const balloonItem = {
                    solution_id: solution.solution_id,
                    team_id: teamId,
                    problem_id: problemId,
                    bst: bst,
                    pst: pst,
                    balloon_sender: balloonSender,
                    // 与表头 data-field="room" 对齐，供 bootstrap-table 客户端排序取值（实际展示仍用 team.room）
                    room: team.room || "",
                    in_date: solution.in_date,
                    team: team,
                    problem: problem,
                    flg_frozen: this.IsFrozen(solution),
                    // 预计算的字段，避免在渲染时重复计算
                    problem_num: problem.num,
                    problem_alphabet: RankToolGetProblemAlphabetIdx(problem.num),
                    school: team.school || "",
                    team_name: team.name || teamId,
                    is_regular_fb: isRegularFB,
                    is_global_fb: isGlobalFB,
                };

                const ccpc = this.data.ccpc_balloon_assignments;
                if (ccpc) {
                    const assignment = ccpc[String(solution.solution_id)];
                    if (!assignment || this.data.ccpc_balloon_stopped) return;
                    balloonItem.problem = Object.assign({}, problem, {color:assignment.color});
                    balloonItem.problem_alphabet = assignment.label;
                    balloonItem.is_global_fb = assignment.first_blood;
                    balloonItem.is_regular_fb = false;
                    balloonItem.ccpc_label = assignment.label;
                    balloonItem.ccpc_freeze_at = this.data.ccpc_freeze_at;
                    balloonItem.ccpc_clock_offset = this.data.ccpc_server_time - Date.now();
                }
                this.balloonList.push(balloonItem);
            });
        }

        /**
         * 提取rooms、senders、schools和problems列表
         */
        ExtractRoomsAndSenders() {
            this.rooms = [];
            this.senders = [];
            this.schools = [];
            this.problems = [];

            // 从team中提取rooms（数据已经是dict格式）
            const roomSet = new Set();
            this.balloonList.forEach((item) => {
                const room = item.team.room; // room字段（dict格式）
                if (room && room.trim()) {
                    const rooms = room
                        .split(",")
                        .map((r) => r.trim())
                        .filter((r) => r);
                    rooms.forEach((r) => roomSet.add(r));
                }
            });
            this.rooms = Array.from(roomSet).sort();

            // 从balloonList中提取senders
            const senderSet = new Set();
            this.balloonList.forEach((item) => {
                if (item.balloon_sender && item.balloon_sender.trim()) {
                    senderSet.add(item.balloon_sender);
                }
            });
            this.senders = Array.from(senderSet).sort();

            // 从team中提取schools
            const schoolSet = new Set();
            this.balloonList.forEach((item) => {
                const school = item.team.school; // school字段
                if (school && school.trim()) {
                    schoolSet.add(school.trim());
                }
            });
            this.schools = Array.from(schoolSet).sort();

            // 从problem中提取problems（题号）
            const problemSet = new Set();
            this.balloonList.forEach((item) => {
                if (item.problem_alphabet) {
                    problemSet.add(item.problem_alphabet);
                }
            });
            this.problems = Array.from(problemSet).sort();
        }

        /**
         * 更新筛选器
         */
        UpdateFilters() {
            const groupSelect = document.getElementById("filter-groups");
            if (groupSelect) {
                const groups = this.contestGroups && this.contestGroups.length > 0
                    ? this.contestGroups
                    : (Array.isArray(this.data?.contest_group) ? this.data.contest_group : []);
                let html = "";
                groups.forEach((g) => {
                    const gid = String(g.group_id || "");
                    if (!gid) return;
                    const name = String(g.group_name || gid);
                    html += `<option value="${RankToolEscapeHtml(gid)}">${RankToolEscapeHtml(name)} (${RankToolEscapeHtml(gid)})</option>`;
                });
                groupSelect.innerHTML = html;
                if (this.groupLocked) {
                    this.filters.groups = [...this.staffGroupIds];
                    groupSelect.disabled = true;
                }
                const $groupSelect = $(groupSelect);
                const groupsToRestore = this.groupLocked
                    ? this.staffGroupIds
                    : (this.filters.groups || []).filter((gid) => groups.some((g) => String(g.group_id || "") === gid));
                if ($groupSelect.data("multipleSelect")) {
                    try {
                        $groupSelect.multipleSelect("refresh");
                    } catch (e) {
                        try {
                            $groupSelect.multipleSelect("destroy");
                            $groupSelect.removeData("multipleSelect");
                        } catch (e2) {}
                    }
                }
                if (!$groupSelect.data("multipleSelect")) {
                    $groupSelect.multipleSelect({
                        filter: true,
                        filterPlaceholder: "搜索...",
                        maxHeight: 800,
                        onClick: () => this.OnGroupFilterChange(),
                    });
                    $groupSelect.on("change", () => this.OnGroupFilterChange());
                }
                if (groupsToRestore.length > 0) {
                    $groupSelect.multipleSelect("setSelects", groupsToRestore);
                }
                if (this.groupLocked) {
                    $groupSelect.multipleSelect("disable");
                }
            }

            // 更新sender筛选器
            if (this.isBalloonManager) {
                const senderSelect = document.getElementById("filter-sender");
                if (senderSelect) {
                    // 保存当前选中的值（安全获取）
                    const $senderSelect = $(senderSelect);
                    let currentSender = [];
                    try {
                        if ($senderSelect.data("multipleSelect")) {
                            currentSender = $senderSelect.multipleSelect("getSelects") || [];
                        } else {
                            // 如果未初始化，直接从原生 select 获取
                            currentSender = senderSelect.value ? [senderSelect.value] : [];
                        }
                    } catch (e) {
                        // 如果获取失败，使用空数组
                        currentSender = [];
                    }

                    senderSelect.innerHTML =
                        '<option value="">全部<en-text>All</en-text></option>';
                    this.senders.forEach((sender) => {
                        const option = document.createElement("option");
                        option.value = sender;
                        option.textContent = sender;
                        senderSelect.appendChild(option);
                    });

                    // 如果已经初始化，使用 refresh() 方法更新选项
                    if ($senderSelect.data("multipleSelect")) {
                        try {
                            // 保存当前选中值
                            const savedSender = this.filters.balloon_sender;
                            const senderToRestore =
                                savedSender && this.senders.includes(savedSender)
                                    ? [savedSender]
                                    : currentSender.length > 0 &&
                                        currentSender[0] !== "" &&
                                        this.senders.includes(currentSender[0])
                                        ? currentSender
                                        : [];

                            // 使用 refresh() 方法刷新选项（会从更新后的 DOM 读取选项）
                            $senderSelect.multipleSelect("refresh");

                            // 恢复选中值
                            if (senderToRestore.length > 0) {
                                $senderSelect.multipleSelect("setSelects", senderToRestore);
                            }
                        } catch (e) {
                            // 如果 refresh 失败，回退到 destroy + 重建
                            console.warning("刷新 MultipleSelect 失败");
                            try {
                                const currentOptions =
                                    $senderSelect.multipleSelect("getOptions");
                                currentOptions.onClick = () => {
                                    this.OnFilterChange();
                                };
                                $senderSelect.multipleSelect("destroy");
                                $senderSelect.removeData("multipleSelect");
                                $senderSelect.multipleSelect(currentOptions);
                                $senderSelect.off("change").on("change", () => {
                                    this.OnFilterChange();
                                });
                                const savedSender = this.filters.balloon_sender;
                                if (savedSender && this.senders.includes(savedSender)) {
                                    $senderSelect.multipleSelect("setSelects", [savedSender]);
                                } else if (
                                    currentSender.length > 0 &&
                                    currentSender[0] !== "" &&
                                    this.senders.includes(currentSender[0])
                                ) {
                                    $senderSelect.multipleSelect("setSelects", currentSender);
                                }
                            } catch (e2) {
                                // 重新初始化失败，静默处理
                            }
                        }
                    } else {
                        // 如果未初始化，直接设置选中值（从 localStorage 恢复）
                        const savedSender = this.filters.balloon_sender;
                        if (savedSender) {
                            senderSelect.value = savedSender;
                        }
                    }
                }
            }

            if (this.usesRoomLockStaticZoneUi()) {
                this.filters.rooms = this.staffRoomLockTokens.slice();
                this.renderRoomLockStaticZoneField(
                    "balloon-zone-lock-field",
                    this.staffRoomLockTokens
                );
            }

            // 更新room筛选器（使用multiple-select）
            const roomSelect = document.getElementById("filter-rooms");
            if (roomSelect && !this.usesRoomLockStaticZoneUi()) {
                // balloonSender 且 teamRoom 为空时，显示筛选器
                // balloonManager 总是显示筛选器
                if (!this.isBalloonSender || !this.teamRoom) {
                    // 保存当前选中的值（安全获取）
                    const $roomSelect = $(roomSelect);
                    let currentRooms = [];
                    try {
                        if ($roomSelect.data("multipleSelect")) {
                            currentRooms = $roomSelect.multipleSelect("getSelects") || [];
                        } else {
                            // 如果未初始化，直接从原生 select 获取
                            currentRooms = Array.from(roomSelect.selectedOptions)
                                .map((opt) => opt.value)
                                .filter((v) => v);
                        }
                    } catch (e) {
                        // 如果获取失败，使用空数组
                        currentRooms = [];
                    }

                    let html = "";
                    if (this.rooms.length === 0) {
                        html =
                            '<option value="">无分区<en-text>No zones</en-text></option>';
                    } else {
                        this.rooms.forEach((room) => {
                            html += `<option value="${room}">${room}</option>`;
                        });
                    }
                    roomSelect.innerHTML = html;

                    // 如果已经初始化，使用 refresh() 方法更新选项
                    if ($roomSelect.data("multipleSelect")) {
                        try {
                            // 保存要恢复的选中值（优先使用保存的值，否则使用当前值）
                            const savedRooms = this.filters.rooms || [];
                            const roomsToRestore =
                                savedRooms.length > 0
                                    ? savedRooms.filter((r) => this.rooms.includes(r))
                                    : currentRooms.filter((r) => this.rooms.includes(r));

                            // 使用 refresh() 方法刷新选项（会从更新后的 DOM 读取选项）
                            $roomSelect.multipleSelect("refresh");

                            // 恢复选中值（只恢复仍然存在的选项）
                            if (roomsToRestore.length > 0) {
                                $roomSelect.multipleSelect("setSelects", roomsToRestore);
                            }
                        } catch (e) {
                            // 如果 refresh 失败，回退到 destroy + 重建
                            try {
                                const currentOptions = $roomSelect.multipleSelect("getOptions");
                                currentOptions.onClick = () => {
                                    this.OnRoomFilterChange();
                                };
                                const savedRooms = this.filters.rooms || [];
                                const roomsToRestore =
                                    savedRooms.length > 0
                                        ? savedRooms.filter((r) => this.rooms.includes(r))
                                        : currentRooms.filter((r) => this.rooms.includes(r));
                                $roomSelect.multipleSelect("destroy");
                                $roomSelect.removeData("multipleSelect");
                                $roomSelect.multipleSelect(currentOptions);
                                $roomSelect.off("change").on("change", () => {
                                    this.OnRoomFilterChange();
                                });
                                if (roomsToRestore.length > 0) {
                                    $roomSelect.multipleSelect("setSelects", roomsToRestore);
                                }
                            } catch (e2) {
                                // 重新初始化失败，静默处理
                            }
                        }
                    } else {
                        // 如果未初始化，直接设置选中值（从 localStorage 恢复）
                        const savedRooms = this.filters.rooms || [];
                        if (savedRooms.length > 0) {
                            Array.from(roomSelect.options).forEach((opt) => {
                                opt.selected = savedRooms.includes(opt.value);
                            });
                        }
                    }

                    // 更新按钮文本
                    this.UpdateRoomFilterText();

                    if (this.roomLocked) {
                        this.filters.rooms = this.staffRoomLockTokens.slice();
                    }
                }
            }

            // 更新school筛选器
            const schoolSelect = document.getElementById("filter-schools");
            if (schoolSelect) {
                // 保存当前选中的值（安全获取）
                const $schoolSelect = $(schoolSelect);
                let currentSchools = [];
                try {
                    if ($schoolSelect.data("multipleSelect")) {
                        currentSchools = $schoolSelect.multipleSelect("getSelects") || [];
                    } else {
                        // 如果未初始化，直接从原生 select 获取
                        currentSchools = Array.from(schoolSelect.selectedOptions)
                            .map((opt) => opt.value)
                            .filter((v) => v);
                    }
                } catch (e) {
                    // 如果获取失败，使用空数组
                    currentSchools = [];
                }

                let html = "";
                if (this.schools.length === 0) {
                    html =
                        '<option value="">无学校<en-text>No schools</en-text></option>';
                } else {
                    this.schools.forEach((school) => {
                        html += `<option value="${school}">${school}</option>`;
                    });
                }
                schoolSelect.innerHTML = html;

                // 如果已经初始化，使用 refresh() 方法更新选项
                if ($schoolSelect.data("multipleSelect")) {
                    try {
                        // 保存要恢复的选中值（优先使用保存的值，否则使用当前值）
                        const savedSchools = this.filters.schools || [];
                        const schoolsToRestore =
                            savedSchools.length > 0
                                ? savedSchools.filter((s) => this.schools.includes(s))
                                : currentSchools.filter((s) => this.schools.includes(s));

                        // 使用 refresh() 方法刷新选项（会从更新后的 DOM 读取选项）
                        $schoolSelect.multipleSelect("refresh");

                        // 恢复选中值（只恢复仍然存在的选项）
                        if (schoolsToRestore.length > 0) {
                            $schoolSelect.multipleSelect("setSelects", schoolsToRestore);
                        }
                    } catch (e) {
                        // 如果 refresh 失败，回退到 destroy + 重建
                        try {
                            const currentOptions = $schoolSelect.multipleSelect("getOptions");
                            currentOptions.onClick = () => {
                                this.OnSchoolFilterChange();
                            };
                            const savedSchools = this.filters.schools || [];
                            const schoolsToRestore =
                                savedSchools.length > 0
                                    ? savedSchools.filter((s) => this.schools.includes(s))
                                    : currentSchools.filter((s) => this.schools.includes(s));
                            $schoolSelect.multipleSelect("destroy");
                            $schoolSelect.removeData("multipleSelect");
                            $schoolSelect.multipleSelect(currentOptions);
                            $schoolSelect.off("change").on("change", () => {
                                this.OnSchoolFilterChange();
                            });
                            if (schoolsToRestore.length > 0) {
                                $schoolSelect.multipleSelect("setSelects", schoolsToRestore);
                            }
                        } catch (e2) {
                            // 重新初始化失败，静默处理
                        }
                    }
                } else {
                    // 如果未初始化，直接设置选中值（从 localStorage 恢复）
                    const savedSchools = this.filters.schools || [];
                    if (savedSchools.length > 0) {
                        Array.from(schoolSelect.options).forEach((opt) => {
                            opt.selected = savedSchools.includes(opt.value);
                        });
                    }
                }
            }

            // 更新problem筛选器
            const problemSelect = document.getElementById("filter-problems");
            if (problemSelect) {
                // 保存当前选中的值（安全获取）
                const $problemSelect = $(problemSelect);
                let currentProblems = [];
                try {
                    if ($problemSelect.data("multipleSelect")) {
                        currentProblems = $problemSelect.multipleSelect("getSelects") || [];
                    } else {
                        // 如果未初始化，直接从原生 select 获取
                        currentProblems = Array.from(problemSelect.selectedOptions)
                            .map((opt) => opt.value)
                            .filter((v) => v);
                    }
                } catch (e) {
                    // 如果获取失败，使用空数组
                    currentProblems = [];
                }

                let html = "";
                if (this.problems.length === 0) {
                    html =
                        '<option value="">无题号<en-text>No problems</en-text></option>';
                } else {
                    this.problems.forEach((problem) => {
                        html += `<option value="${problem}">${problem}</option>`;
                    });
                }
                problemSelect.innerHTML = html;

                // 如果已经初始化，使用 refresh() 方法更新选项
                if ($problemSelect.data("multipleSelect")) {
                    try {
                        // 保存要恢复的选中值（优先使用保存的值，否则使用当前值）
                        const savedProblems = this.filters.problems || [];
                        const problemsToRestore =
                            savedProblems.length > 0
                                ? savedProblems.filter((p) => this.problems.includes(p))
                                : currentProblems.filter((p) => this.problems.includes(p));

                        // 使用 refresh() 方法刷新选项（会从更新后的 DOM 读取选项）
                        $problemSelect.multipleSelect("refresh");

                        // 恢复选中值（只恢复仍然存在的选项）
                        if (problemsToRestore.length > 0) {
                            $problemSelect.multipleSelect("setSelects", problemsToRestore);
                        }
                    } catch (e) {
                        // 如果 refresh 失败，回退到 destroy + 重建
                        try {
                            const currentOptions =
                                $problemSelect.multipleSelect("getOptions");
                            currentOptions.onClick = () => {
                                this.OnProblemFilterChange();
                            };
                            const savedProblems = this.filters.problems || [];
                            const problemsToRestore =
                                savedProblems.length > 0
                                    ? savedProblems.filter((p) => this.problems.includes(p))
                                    : currentProblems.filter((p) => this.problems.includes(p));
                            $problemSelect.multipleSelect("destroy");
                            $problemSelect.removeData("multipleSelect");
                            $problemSelect.multipleSelect(currentOptions);
                            $problemSelect.off("change").on("change", () => {
                                this.OnProblemFilterChange();
                            });
                            if (problemsToRestore.length > 0) {
                                $problemSelect.multipleSelect("setSelects", problemsToRestore);
                            }
                        } catch (e2) {
                            // 重新初始化失败，静默处理
                        }
                    }
                } else {
                    // 如果未初始化，直接设置选中值（从 localStorage 恢复）
                    const savedProblems = this.filters.problems || [];
                    if (savedProblems.length > 0) {
                        Array.from(problemSelect.options).forEach((opt) => {
                            opt.selected = savedProblems.includes(opt.value);
                        });
                    }
                }
            }

            // 初始化所有 multiple-select（排除已经初始化过的元素）
            // 注意：balloon-print-paper-preset 为普通 select；纸宽/走纸/纸宽缩减为独立 number 输入
            const self = this;
            $(".multiple-select").each(function () {
                const $el = $(this);
                const elId = $el.attr("id");

                if (elId === "filter-rooms" && self.usesRoomLockStaticZoneUi()) {
                    return;
                }

                // 检查是否已经初始化过（通过检查是否有 multipleSelect 数据）
                // 如果已经初始化，先销毁再重新初始化（防止重复实例化）
                if ($el.data("multipleSelect")) {
                    try {
                        $el.multipleSelect("destroy");
                        $el.removeData("multipleSelect");
                    } catch (e) {
                        // 即使销毁失败，也清除数据，强制重新初始化
                        $el.removeData("multipleSelect");
                    }
                }

                // 现在可以安全地初始化
                if (!$el.data("multipleSelect")) {
                    // 根据不同的筛选器设置不同的回调
                    let onClickCallback = null;
                    let savedValues = [];

                    if (elId === "filter-sender") {
                        onClickCallback = function () {
                            self.OnFilterChange();
                        };
                        savedValues = self.filters.balloon_sender
                            ? [self.filters.balloon_sender]
                            : [];
                    } else if (elId === "filter-rooms") {
                        onClickCallback = function () {
                            self.OnRoomFilterChange();
                        };
                        savedValues = self.filters.rooms || [];
                    } else if (elId === "filter-schools") {
                        onClickCallback = function () {
                            self.OnSchoolFilterChange();
                        };
                        savedValues = self.filters.schools || [];
                    } else if (elId === "filter-problems") {
                        onClickCallback = function () {
                            self.OnProblemFilterChange();
                        };
                        savedValues = self.filters.problems || [];
                    } else if (elId === "filter-groups") {
                        onClickCallback = function () {
                            self.OnGroupFilterChange();
                        };
                        savedValues = self.groupLocked
                            ? self.staffGroupIds
                            : self.filters.groups || [];
                    }

                    $el.multipleSelect({
                        filter: true,
                        filterPlaceholder: "搜索...",
                        maxHeight: 800,
                        onClick: onClickCallback || undefined,
                    });

                    // 恢复保存的选中值
                    if (savedValues.length > 0) {
                        try {
                            $el.multipleSelect("setSelects", savedValues);
                        } catch (e) {
                            // 恢复选中值失败，静默处理
                        }
                    }

                    // 如果使用 onClick 回调，也需要监听原生 change 事件作为备用
                    if (onClickCallback) {
                        $el.on("change", onClickCallback);
                    }
                }
            });

            // 恢复搜索框的值
            const searchInput = document.getElementById("filter-search");
            if (searchInput && this.filters.searchText) {
                searchInput.value = this.filters.searchText;
            }
        }

        /**
         * 更新room筛选器按钮文本
         */
        UpdateRoomFilterText() {
            const roomText = document.getElementById("filter-rooms-text");
            if (!roomText) return;

            if (this.filters.rooms.length === 0) {
                roomText.innerHTML = "全部<en-text>All</en-text>";
            } else if (this.filters.rooms.length === 1) {
                roomText.textContent = this.filters.rooms[0];
            } else {
                roomText.innerHTML = `已选 ${this.filters.rooms.length} 个<en-text>Selected ${this.filters.rooms.length}</en-text>`;
            }
        }

        /**
         * Room筛选变更事件
         */
        OnRoomFilterChange() {
            if (this.roomLocked) {
                return;
            }
            const roomSelect = document.getElementById("filter-rooms");
            if (roomSelect) {
                // 从原生 select 元素获取选中的值（multiple-select 会更新原生 select 的 selectedOptions）
                this.filters.rooms = Array.from(roomSelect.selectedOptions)
                    .map((option) => option.value)
                    .filter((value) => value !== ""); // 排除空值
            }

            // 保存到 localStorage
            this.SaveFiltersToStorage();

            // 更新按钮文本
            this.UpdateRoomFilterText();

            // 重新渲染列表
            this.RenderQueueList();
        }

        /**
         * School筛选变更事件
         */
        OnSchoolFilterChange() {
            const schoolSelect = document.getElementById("filter-schools");
            if (schoolSelect) {
                // 从原生 select 元素获取选中的值
                this.filters.schools = Array.from(schoolSelect.selectedOptions)
                    .map((option) => option.value)
                    .filter((value) => value !== ""); // 排除空值
            }

            // 保存到 localStorage
            this.SaveFiltersToStorage();

            // 重新渲染列表
            this.RenderQueueList();
        }

        /**
         * Problem筛选变更事件
         */
        OnProblemFilterChange() {
            const problemSelect = document.getElementById("filter-problems");
            if (problemSelect) {
                // 从原生 select 元素获取选中的值
                this.filters.problems = Array.from(problemSelect.selectedOptions)
                    .map((option) => option.value)
                    .filter((value) => value !== ""); // 排除空值
            }

            // 保存到 localStorage
            this.SaveFiltersToStorage();

            // 重新渲染列表
            this.RenderQueueList();
        }

        OnGroupFilterChange() {
            if (this.groupLocked) {
                this.filters.groups = [...this.staffGroupIds];
            } else {
                const groupSelect = document.getElementById("filter-groups");
                if (groupSelect) {
                    this.filters.groups = Array.from(groupSelect.selectedOptions)
                        .map((option) => option.value)
                        .filter((value) => value !== "");
                }
            }
            this.SaveFiltersToStorage();
            this.RenderQueueList();
        }

        /**
         * 搜索文本变更事件
         */
        OnSearchChange(searchText) {
            this.filters.searchText = (searchText || "").trim();

            // 保存到 localStorage
            this.SaveFiltersToStorage();

            // 重新渲染列表
            this.RenderQueueList();
        }

        /**
         * 筛选变更事件
         */
        OnFilterChange() {
            // 更新筛选状态
            if (this.isBalloonManager) {
                const senderSelect = document.getElementById("filter-sender");
                if (senderSelect) {
                    this.filters.balloon_sender = senderSelect.value || null;
                }
            }

            // 保存到 localStorage
            this.SaveFiltersToStorage();

            // 重新渲染列表
            this.RenderQueueList();
        }

        ItemMatchesGroupFilter(item) {
            if (!this.isMultiGroup) return true;
            const selectedGroups = this.groupLocked
                ? this.staffGroupIds
                : (this.filters.groups || []);
            if (!selectedGroups || selectedGroups.length === 0) return true;
            const teamGroups = Array.isArray(item.team?.group_ids) ? item.team.group_ids : [];
            return teamGroups.some((gid) => selectedGroups.includes(String(gid)));
        }

        /**
         * 获取筛选后的气球列表
         */
        GetFilteredBalloonList() {
            let filtered = [...this.balloonList];
            if (this.isMultiGroup) {
                filtered = filtered.filter((item) => this.ItemMatchesGroupFilter(item));
            }

            // balloonSender模式：根据标签页筛选
            if (this.isBalloonSender) {
                if (this.currentTab === "queue") {
                    // 气球队列：只显示bst=0的
                    filtered = filtered.filter((item) => NormalizeContestBalloonBst(item.bst) === 0);
                } else if (this.currentTab === "my_balloons") {
                    // 我的气球：显示bst!=0且balloon_sender是自己的
                    filtered = filtered.filter(
                        (item) =>
                            NormalizeContestBalloonBst(item.bst) !== 0 &&
                            item.balloon_sender === this.currentUser
                    );
                }

                // room筛选（固定或自由）
                const senderRoomTok = this.getQueueEffectiveRoomTokens();
                if (senderRoomTok && senderRoomTok.length > 0) {
                    filtered = filtered.filter((item) => {
                        const teamRooms = this.parseCommaRoomTokens(item.team.room || "");
                        return teamRooms.some((r) => senderRoomTok.includes(r));
                    });
                } else if (this.filters.rooms.length > 0) {
                    // 自由筛选（与锁定分区一致：支持中英文逗号多值）
                    filtered = filtered.filter((item) => {
                        const teamRooms = this.parseCommaRoomTokens(item.team.room || "");
                        return teamRooms.some((r) => this.filters.rooms.includes(r));
                    });
                }

                // 学校筛选（balloonSender模式也支持）
                if (this.filters.schools.length > 0) {
                    filtered = filtered.filter((item) => {
                        const school = (item.team.school || "").trim();
                        return school && this.filters.schools.includes(school);
                    });
                }

                // 题号筛选（balloonSender模式也支持）
                if (this.filters.problems.length > 0) {
                    filtered = filtered.filter((item) => {
                        return (
                            item.problem_alphabet &&
                            this.filters.problems.includes(item.problem_alphabet)
                        );
                    });
                }

                // 搜索文本筛选（balloonSender模式也支持）
                if (this.filters.searchText) {
                    const searchLower = this.filters.searchText.toLowerCase();
                    filtered = filtered.filter((item) => {
                        const teamId = String(item.team_id || "").toLowerCase();
                        const teamName = (item.team_name || "").toLowerCase();
                        return (
                            teamId.includes(searchLower) || teamName.includes(searchLower)
                        );
                    });
                }
            } else {
                // balloonManager模式：应用所有筛选
                if (this.filters.status.length > 0) {
                    filtered = filtered.filter((item) =>
                        this.filters.status.some(
                            (s) => NormalizeContestBalloonBst(s) === NormalizeContestBalloonBst(item.bst)
                        )
                    );
                }

                if (this.filters.balloon_sender !== null) {
                    filtered = filtered.filter(
                        (item) => item.balloon_sender === this.filters.balloon_sender
                    );
                }

                const mgrRoomTok = this.getQueueEffectiveRoomTokens();
                if (mgrRoomTok && mgrRoomTok.length > 0) {
                    filtered = filtered.filter((item) => {
                        const teamRooms = this.parseCommaRoomTokens(item.team.room || "");
                        return teamRooms.some((r) => mgrRoomTok.includes(r));
                    });
                } else if (this.filters.rooms.length > 0) {
                    filtered = filtered.filter((item) => {
                        const teamRooms = this.parseCommaRoomTokens(item.team.room || "");
                        return teamRooms.some((r) => this.filters.rooms.includes(r));
                    });
                }

                // 学校筛选
                if (this.filters.schools.length > 0) {
                    filtered = filtered.filter((item) => {
                        const school = (item.team.school || "").trim();
                        return school && this.filters.schools.includes(school);
                    });
                }

                // 题号筛选
                if (this.filters.problems.length > 0) {
                    filtered = filtered.filter((item) => {
                        return (
                            item.problem_alphabet &&
                            this.filters.problems.includes(item.problem_alphabet)
                        );
                    });
                }

                // 搜索文本筛选（队伍ID、队名模糊匹配）
                if (this.filters.searchText) {
                    const searchLower = this.filters.searchText.toLowerCase();
                    filtered = filtered.filter((item) => {
                        const teamId = String(item.team_id || "").toLowerCase();
                        const teamName = (item.team_name || "").toLowerCase();
                        return (
                            teamId.includes(searchLower) || teamName.includes(searchLower)
                        );
                    });
                }
            }

            return filtered;
        }

        /**
         * 渲染队列列表（使用bootstrap-table）
         */
        RenderQueueList() {
            this.refreshBalloonQueueView();
        }

        /**
         * 绑定表格点击事件（统一管理所有列的点击）
         */
        BindTableClickEvents() {
            const table = $("#balloon-queue-table");

            // 防止重复绑定
            table.off("click-cell.bs.table");
            table.off("dbl-click-cell.bs.table");
            $(document).off("click.balloonSenderDd");

            table.on("click-cell.bs.table", (e, field, value, row, $td) => {
                if (this.isBalloonSender && !this.isBalloonManager && field !== "bst") {
                    this.CancelSenderQueueConfirm();
                }
                if (field === "team_id") {
                    // 点击队伍ID：显示队伍详情
                    this.ShowTeamDetails(row);
                } else if (field === "bst") {
                    // 点击状态列
                    BalloonSenderConfirmLog("bst-click-route", {
                        isBalloonManager: this.isBalloonManager,
                        isBalloonSender: this.isBalloonSender,
                        isSenderUi: this.IsSenderBalloonQueueUi(),
                        currentTab: this.currentTab,
                    });
                    if (this.isBalloonManager) {
                        // 管理员模式：弹出模态框编辑
                        this.ShowManagerModal(row);
                    } else if (this.isBalloonSender) {
                        // bootstrap-table：参数为 field, value, item, $td（勿把 value 当成 td）
                        this.OnBalloonSenderQueueStatusClick(row, $td);
                    } else {
                        this.ShowStatusExplanation(row);
                    }
                }
            });

            if (this.IsSenderBalloonQueueUi()) {
                EnsureBalloonSenderBstDropdownPortalListeners();
                $(document).on(
                    "click.balloonSenderDd",
                    ".balloon-queue-sender-dd-menu [data-sender-dd-action]",
                    (ev) => {
                        if (
                            !window.balloonQueueSystem ||
                            !window.balloonQueueSystem.IsSenderBalloonQueueUi()
                        ) {
                            return;
                        }
                        ev.preventDefault();
                        ev.stopPropagation();
                        const el = ev.currentTarget;
                        const action = el.getAttribute("data-sender-dd-action");
                        const sid = el.getAttribute("data-solution-id");
                        if (!action || !sid) return;
                        const data = table.bootstrapTable("getData") || [];
                        const row = data.find(
                            (r) => String(r.solution_id) === String(sid)
                        );
                        if (!row) {
                            BalloonQueueShowMiniToast(
                                "info",
                                "未找到该行，请刷新",
                                "Row not found; refresh"
                            );
                            return;
                        }
                        const menu = el.closest(".balloon-queue-sender-dd-menu");
                        const tid = menu
                            ? menu.getAttribute("data-bq-dd-toggle-id")
                            : null;
                        const toggle = tid
                            ? document.getElementById(tid)
                            : null;
                        if (toggle && window.bootstrap && bootstrap.Dropdown) {
                            const inst = bootstrap.Dropdown.getInstance(toggle);
                            if (inst) inst.hide();
                        }
                        let p = Promise.resolve();
                        if (action === "deliver") {
                            p = this.ExecuteSenderDeliver(row);
                        } else if (action === "withdraw") {
                            p = this.ExecuteSenderWithdraw(row);
                        } else if (action === "return") {
                            p = this.ExecuteSenderReturn(row);
                        }
                        p.finally(() => {
                            this.RenderQueueList();
                        });
                    }
                );
            }

            // 双击：仅气球管理员（小票预览/打印）；配送员不使用 dblclick，避免手机浏览器缩放抢手势
            if (this.isBalloonManager) {
                table.on("dbl-click-cell.bs.table", (e, field, value, row, $td) => {
                    if (field === "idx") {
                        // 双击序号列：预览打印
                        this.PreviewSingleBalloon(row);
                    } else if (field === "problem_num") {
                        // 双击题号列：实际打印并更新状态
                        this.PrintSingleBalloonWithStatusUpdate(row);
                    }
                });
            }
        }

        /**
         * 状态列单击兜底说明（非管理员、非配送员账号；正常赛务不会落到此分支）
         */
        ShowStatusExplanation(row) {
            const statusInfo =
                this.balloonStatusMap[row.bst] || this.balloonStatusMap[0];
            const problemAlphabet = row.problem_alphabet;
            const teamId = row.team_id;

            BalloonQueueShowMiniToast(
                "info",
                `队伍 ${teamId} · ${problemAlphabet} · ${statusInfo.cn}`,
                `Team ${teamId} · ${problemAlphabet} · ${statusInfo.en}`
            );
        }

        /**
         * 生成队伍信息HTML（水平布局：label在左，内容在右，每条一行）
         * @param {Object} team - 队伍数据对象
         * @param {string} teamId - 队伍ID
         * @param {string} problemAlphabet - 题号（可选）
         * @returns {string} HTML字符串
         */
        GenerateTeamInfoHTML(team, teamId, problemAlphabet = null) {
            const teamIdHtml = RankToolEscapeHtml(String(teamId));
            const teamName = RankToolEscapeHtml(team.name || teamId);
            const teamNameEn = team.name_en ? RankToolEscapeHtml(team.name_en) : null;
            const schoolName = RankToolEscapeHtml(team.school || "-");
            const tmember = RankToolEscapeHtml(team.tmember || "-");
            const room = RankToolEscapeHtml(team.room || "-");
            const coach = team.coach ? RankToolEscapeHtml(team.coach) : null;

            // 水平布局：label在左，内容在右，每条一行
            let html = '<div class="team-info-template">';

            // 队伍ID - 非常突出
            html +=
                '<div class="team-info-item team-info-highlight"><i class="bi bi-hash text-primary"></i><span class="label-text">队伍ID <span class="en-text">Team ID</span></span><span class="main-text">' +
                teamIdHtml +
                "</span></div>";

            // 区域 - 非常突出
            if (room && room !== "-") {
                html +=
                    '<div class="team-info-item team-info-highlight"><i class="bi bi-geo-alt text-warning"></i><span class="label-text">分区 <span class="en-text">Zone</span></span><span class="main-text">' +
                    room +
                    "</span></div>";
            }

            // 题号（如果有）
            if (problemAlphabet) {
                html +=
                    '<div class="team-info-item"><i class="bi bi-file-earmark-text text-info"></i><span class="label-text">题号 <span class="en-text">Problem</span></span><span class="main-text"><span class="badge bg-primary">' +
                    problemAlphabet +
                    "</span></span></div>";
            }

            // 队名
            if (teamName && teamName !== "-") {
                html +=
                    '<div class="team-info-item"><i class="bi bi-flag-fill text-success"></i><span class="label-text">队名 <span class="en-text">Team Name</span></span><span class="main-text">' +
                    teamName;
                if (teamNameEn) {
                    html += ' <span class="sub-text">(' + teamNameEn + ")</span>";
                }
                html += "</span></div>";
            }

            // 学校
            if (schoolName && schoolName !== "-") {
                html +=
                    '<div class="team-info-item"><i class="bi bi-building text-info"></i><span class="label-text">学校 <span class="en-text">School</span></span><span class="main-text">' +
                    schoolName +
                    "</span></div>";
            }

            // 选手
            if (tmember && tmember !== "-") {
                html +=
                    '<div class="team-info-item"><i class="bi bi-people text-secondary"></i><span class="label-text">选手 <span class="en-text">Members</span></span><span class="main-text">' +
                    tmember +
                    "</span></div>";
            }

            // 教练（如果有）
            if (coach) {
                html +=
                    '<div class="team-info-item"><i class="bi bi-person-badge text-secondary"></i><span class="label-text">教练 <span class="en-text">Coach</span></span><span class="main-text">' +
                    coach +
                    "</span></div>";
            }

            html += "</div>";
            return html;
        }

        /**
         * 预览单个气球小票
         */
        PreviewSingleBalloon(row) {
            if (!row) return;
            if (!this.ticketFeatureEnabled) {
                alerty.info({
                    message: "请先开启小票功能",
                    message_en: "Please enable ticket printing first",
                });
                return;
            }

            this.EnsureBalloonPrintReady()
                .then(() => {
                    if (
                        window.BalloonPrint &&
                        typeof window.BalloonPrint.previewBalloon === "function"
                    ) {
                        window.BalloonPrint.previewBalloon(row);
                    } else {
                        throw new Error("Preview function is not available");
                    }
                })
                .catch((error) => {
                    alerty.info({
                        message: `预览功能未初始化：${error.message || error}`,
                        message_en: `Preview function not initialized: ${error.message || error}`,
                    });
                });
        }

        /**
         * 打印单个气球并更新状态
         */
        PrintSingleBalloonWithStatusUpdate(row) {
            if (!row) return;
            if (!this.ticketFeatureEnabled) {
                alerty.info({
                    message: "请先开启小票功能",
                    message_en: "Please enable ticket printing first",
                });
                return;
            }

            this.EnsureBalloonPrintReady()
                .then(() => {
                    if (
                        window.BalloonPrint &&
                        typeof window.BalloonPrint.printSingleBalloonWithStatusUpdate ===
                        "function"
                    ) {
                        window.BalloonPrint.printSingleBalloonWithStatusUpdate(row, this);
                    } else {
                        throw new Error("Print function is not available");
                    }
                })
                .catch((error) => {
                    alerty.info({
                        message: `打印功能未初始化：${error.message || error}`,
                        message_en: `Print function not initialized: ${error.message || error}`,
                    });
                });
        }

        /**
         * 显示队伍详细信息
         */
        ShowTeamDetails(row) {
            const teamInfoHTML = this.GenerateTeamInfoHTML(
                row.team,
                row.team_id,
                row.problem_alphabet
            );

            const content = `
                <div class="card border">
                    <div class="card-body" style="padding: 0.75rem;">
                        ${teamInfoHTML}
                    </div>
                </div>
            `;

            alerty.notify({
                title: '队伍信息<span class="en-text">Team Information</span>',
                message: content,
                message_en: "",
                width: 400,
            });
        }

        /**
         * 显示管理员模态框（编辑气球状态和选择配送员）
         */
        async ShowManagerModal(row) {
            const problemAlphabet = row.problem_alphabet;
            const teamId = RankToolEscapeHtml(String(row.team_id));
            const schoolName = RankToolEscapeHtml(row.school);
            const currentStatus = row.bst;
            const currentSender = row.balloon_sender || "";

            // 获取balloon_sender列表
            let senderOptions =
                '<option value="">（留空）<en-text>(Empty)</en-text></option>';
            try {
                const contestId = this.config.cid_list || "";
                const result = await $.ajax({
                    url: `/cpcsys/admin/team_list_ajax?cid=${contestId}&ttype=1`,
                    method: "GET",
                    dataType: "json",
                });
                if (result.code === 1 && result.data && result.data.team_list) {
                    result.data.team_list.forEach((sender) => {
                        const selected = sender.team_id === currentSender ? "selected" : "";
                        const name = RankToolEscapeHtml(sender.name || sender.team_id);
                        const room = RankToolEscapeHtml(sender.room || "");
                        const displayText = `${sender.team_id} - ${name}${room ? ` (${room})` : ""
                            }`;
                        senderOptions += `<option value="${RankToolEscapeHtml(
                            sender.team_id
                        )}" ${selected}>${displayText}</option>`;
                    });
                }
            } catch (error) {
                // 加载配送员列表失败，静默处理
            }

            // 生成状态按钮（四个按钮，点击直接提交）
            let statusButtonsHTML = "";
            const btnClassMap = {
                0: "btn-danger", // 未处理 - 红色
                10: "btn-warning", // 已通知 - 黄色
                20: "btn-info", // 已分配 - 青色
                30: "btn-success", // 已发放 - 绿色
            };
            const iconMap = {
                0: "bi-x-circle-fill",
                10: "bi-printer-fill",
                20: "bi-person-check-fill",
                30: "bi-check-circle-fill",
            };

            Object.keys(this.balloonStatusMap).forEach((status) => {
                const statusNum = parseInt(status);
                const info = this.balloonStatusMap[statusNum];
                const btnClass = btnClassMap[statusNum] || "btn-secondary";
                const icon = iconMap[statusNum] || "bi-question-circle-fill";
                const isActive = currentStatus === statusNum ? "active" : "";
                const bilingualText = `<span><i class="bi ${icon}"></i>${info.cn}</span><span class="en-text">${info.en}</span>`;

                statusButtonsHTML += `
                    <button type="button" title="点击设为此状态 / Click to set this status"
                            class="btn btn-sm ${btnClass} status-btn ${isActive}" 
                            data-status="${statusNum}"
                            style="flex: 1; min-width: 120px;">
                         ${bilingualText}
                    </button>
                `;
            });

            // 使用统一的队伍信息生成函数
            const teamInfoHTML = this.GenerateTeamInfoHTML(
                row.team,
                row.team_id,
                problemAlphabet
            );

            // 创建模态框HTML（符合系统UI风格）
            const modalHtml = `
                <div class="modal fade" id="balloon-manager-modal" tabindex="-1" aria-labelledby="balloonManagerModalLabel" aria-hidden="true">
                    <div class="modal-dialog modal-dialog-centered">
                        <div class="modal-content">
                            <div class="modal-header">
                                <h5 class="modal-title bilingual-inline" id="balloonManagerModalLabel">
                                    编辑气球状态<span class="en-text">Edit Balloon Status</span>
                                </h5>
                                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                            </div>
                            <div class="modal-body">
                                <!-- 队伍信息卡片 -->
                                <div class="mb-4">
                                    <label class="form-label fw-bold mb-2 bilingual-inline">
                                        队伍信息<span class="en-text">Team Info</span>
                                    </label>
                                    <div class="card border">
                                        <div class="card-body" style="padding: 0.75rem;">
                                            ${teamInfoHTML}
                                        </div>
                                    </div>
                                </div>
                                
                                <!-- 气球状态选择（四个按钮，点击直接提交） -->
                                <div class="mb-3">
                                    <label class="form-label bilingual-inline mb-2">
                                        气球状态<span class="en-text">Balloon Status</span>
                                    </label>
                                    <div class="d-flex gap-2 flex-wrap" id="modal-balloon-status-buttons">
                                        ${statusButtonsHTML}
                                    </div>
                                </div>
                                
                                <!-- 配送员选择 -->
                                <div class="mb-3">
                                    <label class="form-label bilingual-inline" for="modal-balloon-sender">
                                        配送员<span class="en-text">Balloon Sender</span>
                                    </label>
                                    <select class="form-select" id="modal-balloon-sender">
                                        ${senderOptions}
                                    </select>
                                    <div class="form-text">
                                        选择配送员或留空 <span class="en-text">Select sender or leave empty</span>
                                    </div>
                                </div>
                            </div>
                            <div class="modal-footer">
                                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">
                                    取消<span class="en-text">Cancel</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            `;

            // 移除旧的模态框（如果存在）
            const oldModal = document.getElementById("balloon-manager-modal");
            if (oldModal) {
                oldModal.remove();
            }

            // 添加新模态框到body
            document.body.insertAdjacentHTML("beforeend", modalHtml);

            // 初始化Bootstrap模态框
            const modalElement = document.getElementById("balloon-manager-modal");
            const modal = new bootstrap.Modal(modalElement);

            // 绑定状态按钮事件（点击直接提交）
            const statusButtons = modalElement.querySelectorAll(".status-btn");
            const handleStatusChange = (newStatus) => {
                const newSender =
                    document.getElementById("modal-balloon-sender").value.trim() || null;

                // 只有管理员将状态设为20时，op才是'set_sender'，其他情况留空
                const op = newStatus == 20 ? "set_sender" : "";

                // 调用API更新状态
                this.ChangeBalloonStatus(row, newStatus, newSender, op);

                // 关闭模态框
                modal.hide();
            };

            statusButtons.forEach((btn) => {
                btn.addEventListener("click", () => {
                    const newStatus = parseInt(btn.getAttribute("data-status"));
                    handleStatusChange(newStatus);
                });
            });

            // 快捷键映射：N->0(未处理), P->10(已通知), A->20(已分配), D->30(已发放)
            const keyStatusMap = {
                n: 0, // 未处理
                p: 10, // 已通知
                a: 20, // 已分配
                d: 30, // 已发放
            };

            // 快捷键处理函数
            const handleKeydown = (e) => {
                // 检查模态框是否存在且显示
                if (!modalElement || !document.body.contains(modalElement)) {
                    return;
                }

                // 检查模态框是否显示（Bootstrap 5 模态框显示时会有 show class）
                if (!modalElement.classList.contains("show")) {
                    return;
                }

                // 如果焦点在输入框、文本框或下拉框中，不处理快捷键
                const activeElement = document.activeElement;
                if (
                    activeElement &&
                    (activeElement.tagName === "INPUT" ||
                        activeElement.tagName === "TEXTAREA" ||
                        activeElement.tagName === "SELECT" ||
                        activeElement.isContentEditable)
                ) {
                    return;
                }

                // 检查按键是否匹配（不区分大小写）
                const key = e.key.toLowerCase();
                if (keyStatusMap.hasOwnProperty(key)) {
                    e.preventDefault();
                    e.stopPropagation();
                    const newStatus = keyStatusMap[key];
                    handleStatusChange(newStatus);
                }
            };

            // 绑定快捷键事件（在模态框打开时）
            document.addEventListener("keydown", handleKeydown);

            // 模态框关闭时移除快捷键事件和DOM
            modalElement.addEventListener("hidden.bs.modal", () => {
                // 移除快捷键事件
                document.removeEventListener("keydown", handleKeydown);
                // 移除DOM
                modalElement.remove();
            });

            // 显示模态框
            modal.show();
        }

        /**
         * 统一的数据更新方法（核心方法）
         * 更新单个气球项（统一更新数据源和视图）
         * @param {String} solutionId - solution_id
         * @param {Object} updates - 要更新的字段 { bst, pst, balloon_sender, ... }
         * @param {Boolean} updateView - 是否更新视图（默认true）
         */
        UpdateBalloonItem(solutionId, updates, updateView = true) {
            const upd = { ...updates };
            if (upd.bst !== undefined) {
                upd.bst = NormalizeContestBalloonBst(upd.bst);
            }
            // 1. 更新 balloonList（数据源）
            const balloonItem = this.balloonList.find(item => item.solution_id === solutionId);
            if (!balloonItem) return;
            
            // 🔥 记录更新前的 bst 值（用于统计可打印数量）
            const oldBst = Number(balloonItem.bst) || 0;
            const wasPrintable = (oldBst === 0);
            
            // 更新数据
            Object.assign(balloonItem, upd);
            
            // 🔥 更新可打印数量统计（如果 bst 发生变化）
            if (upd.bst !== undefined) {
                const newBst = Number(upd.bst) || 0;
                const isPrintable = (newBst === 0);
                
                if (wasPrintable && !isPrintable) {
                    // 从可打印变为不可打印，计数 -1
                    this.autoPrintPrintableCount--;
                    if (this.autoPrintPrintableCount < 0) {
                        this.autoPrintPrintableCount = 0;
                    }
                } else if (!wasPrintable && isPrintable) {
                    // 从不可打印变为可打印，计数 +1
                    this.autoPrintPrintableCount++;
                }
            }
            
            // 2. 更新 balloonMap（用于统计）
            if (this.balloonMap) {
                const key = `${balloonItem.team_id}_${balloonItem.problem_id}`;
                const balloon = this.balloonMap.get(key);
                if (balloon) {
                    Object.assign(balloon, upd);
                } else {
                    // 如果不存在，创建新记录
                    this.balloonMap.set(key, {
                        team_id: balloonItem.team_id,
                        problem_id: balloonItem.problem_id,
                        ...upd
                    });
                }
            }
            
            // 3. 更新 client 表视图（bst 变更须重排，与自动打印队列一致）
            if (updateView) {
                if (
                    upd.bst !== undefined &&
                    typeof this.refreshBalloonQueueView === "function"
                ) {
                    this.refreshBalloonQueueView({
                        keepPage: true,
                        preserveScroll: true,
                    });
                    return;
                }
                const table = $("#balloon-queue-table");
                if (table.length && table.data("bootstrap.table")) {
                    const updatedItem = this.balloonList.find(
                        (item) => item.solution_id === solutionId
                    );
                    if (updatedItem) {
                        const filteredList = this.GetFilteredBalloonList();
                        const filteredItem = filteredList.find(
                            (item) => item.solution_id === solutionId
                        );
                        if (filteredItem) {
                            table.bootstrapTable("updateByUniqueId", {
                                id: solutionId,
                                row: updatedItem,
                            });
                        } else {
                            table.bootstrapTable("removeByUniqueId", solutionId);
                        }
                    }
                }
            }
        }

        ChangeBalloonStatus(
            row,
            bst,
            balloonSender,
            op,
            flg_show_success = true,
            flg_skip_rate_limit = false
        ) {
            const self = this;
            
            // 🔥 频率控制：手动/配送员连续改状态时限速；自动打小票流水线须跳过（skipRateLimit）
            if (!flg_skip_rate_limit) {
            this.statusChangeCallCount++;
            if (this.statusChangeCallCount >= 10) {
                // 重置计数器
                this.statusChangeCallCount = 0;
                // 显示等待倒计时
                this.statusChangeWaitCountdown = 3;
                this.ShowStatusChangeWaitCountdown();
                
                // 等待 3 秒后再执行
                return new Promise((resolve) => {
                    if (this.statusChangeWaitTimer) {
                        clearTimeout(this.statusChangeWaitTimer);
                    }
                    this.statusChangeWaitTimer = setTimeout(() => {
                        this.statusChangeWaitTimer = null;
                        this.HideStatusChangeWaitCountdown();
                        // 递归调用，继续执行
                        this.ChangeBalloonStatus(
                            row,
                            bst,
                            balloonSender,
                            op,
                            flg_show_success,
                            flg_skip_rate_limit
                        ).then(resolve);
                    }, 3000);
                });
            }
            }
            
            const contestId = this.config.cid_list || "";
            const params = {
                cid: contestId,
                solution_id: row.solution_id,
                pst: row.is_global_fb ? 20 : row.is_regular_fb ? 10 : 0,
                bst: bst,
                op: op,
            };

            if (balloonSender) {
                params.balloon_sender = balloonSender;
            }

            return new Promise((resolve, reject) => {
                $.ajax({
                    url: this.changeStatusUrl,
                    method: "POST",
                    data: params,
                    dataType: "json",
                    success: function (rep) {
                        if (rep.code === 1) {
                            const statusInfo =
                                self.balloonStatusMap[rep.data.bst] || self.balloonStatusMap[0];
                            if (flg_show_success) {
                                if (self.IsSenderBalloonQueueUi()) {
                                    BalloonQueueShowMiniToast(
                                        "ok",
                                        `已更新为 ${statusInfo.cn}（${rep.data.team_id} · ${row.problem_alphabet}）`,
                                        `Updated to ${statusInfo.en} (${rep.data.team_id} · ${row.problem_alphabet})`
                                    );
                                } else {
                                    alerty.success(
                                        `队伍：${rep.data.team_id}  题目: ${row.problem_alphabet} \n成功更新为 ${statusInfo.cn}`,
                                        `Team ${rep.data.team_id}   Problem ${row.problem_alphabet} \nUpdated to ${statusInfo.en} successfully`
                                    );
                                }
                            }

                            // 🔥 使用统一更新方法
                            const updates = {
                                bst: parseInt(rep.data.bst),
                                pst: parseInt(rep.data.pst)
                            };
                            if (rep.data.balloon_sender !== undefined) {
                                updates.balloon_sender = rep.data.balloon_sender || "";
                            }
                            
                            // 统一更新数据源和视图
                            self.UpdateBalloonItem(row.solution_id, updates, true);
                            
                            // 同时更新 row 对象（保持兼容性）
                            Object.assign(row, updates);

                            // 更新统计框
                            self.CalculateBalloonStats();
                            self.UpdateGlobalStats();
                            resolve(rep);
                        } else {
                            if (self.IsSenderBalloonQueueUi()) {
                                BalloonQueueShowMiniToast(
                                    "err",
                                    rep.msg || "操作失败",
                                    rep.msg || "Operation failed"
                                );
                            } else {
                                alerty.alert({
                                    message: rep.msg || "操作失败",
                                    message_en: "",
                                });
                            }
                            reject(new Error(rep.msg || "操作失败"));
                        }
                    },
                    error: function (xhr, status, error) {
                        if (self.IsSenderBalloonQueueUi()) {
                            BalloonQueueShowMiniToast(
                                "err",
                                "操作失败，请重试",
                                "Operation failed, please retry"
                            );
                        } else {
                            alerty.alert({
                                message: "操作失败，请重试",
                                message_en: "Operation failed, please try again",
                            });
                        }
                        reject(new Error(error || "操作失败"));
                    }
                });
            });
        }

        /**
         * 显示状态更新等待倒计时
         */
        ShowStatusChangeWaitCountdown() {
            const countdownTextEl = document.getElementById("balloon-print-countdown-text");
            if (countdownTextEl) {
                countdownTextEl.textContent = "等待 " + this.statusChangeWaitCountdown + " 秒";
                countdownTextEl.setAttribute("data-wait-type", "status-change");
            }
            
            // 启动倒计时显示
            if (this.statusChangeWaitCountdownTimer) {
                clearInterval(this.statusChangeWaitCountdownTimer);
            }
            this.statusChangeWaitCountdownTimer = setInterval(() => {
                this.statusChangeWaitCountdown--;
                const countdownTextEl = document.getElementById("balloon-print-countdown-text");
                if (countdownTextEl) {
                    countdownTextEl.textContent = "等待 " + this.statusChangeWaitCountdown + " 秒";
                }
                if (this.statusChangeWaitCountdown <= 0) {
                    clearInterval(this.statusChangeWaitCountdownTimer);
                    this.statusChangeWaitCountdownTimer = null;
                }
            }, 1000);
        }

        /**
         * 隐藏状态更新等待倒计时
         */
        HideStatusChangeWaitCountdown() {
            if (this.statusChangeWaitCountdownTimer) {
                clearInterval(this.statusChangeWaitCountdownTimer);
                this.statusChangeWaitCountdownTimer = null;
            }
            this.statusChangeWaitCountdown = 0;
            const countdownTextEl = document.getElementById("balloon-print-countdown-text");
            if (countdownTextEl) {
                countdownTextEl.removeAttribute("data-wait-type");
            }
        }

        /**
         * 显示排序筛选等待倒计时
         */
        ShowSortWaitCountdown() {
            const countdownTextEl = document.getElementById("balloon-print-countdown-text");
            if (countdownTextEl) {
                countdownTextEl.textContent = "排序等待 " + this.sortWaitCountdown + " 秒";
                countdownTextEl.setAttribute("data-wait-type", "sort");
            }
            
            // 启动倒计时显示
            if (this.sortWaitCountdownTimer) {
                clearInterval(this.sortWaitCountdownTimer);
            }
            this.sortWaitCountdown = 3;
            this.sortWaitCountdownTimer = setInterval(() => {
                this.sortWaitCountdown--;
                const countdownTextEl = document.getElementById("balloon-print-countdown-text");
                if (countdownTextEl) {
                    countdownTextEl.textContent = "排序等待 " + this.sortWaitCountdown + " 秒";
                }
                if (this.sortWaitCountdown <= 0) {
                    clearInterval(this.sortWaitCountdownTimer);
                    this.sortWaitCountdownTimer = null;
                    this.HideSortWaitCountdown();
                }
            }, 1000);
        }

        /**
         * 隐藏排序筛选等待倒计时
         */
        HideSortWaitCountdown() {
            if (this.sortWaitCountdownTimer) {
                clearInterval(this.sortWaitCountdownTimer);
                this.sortWaitCountdownTimer = null;
            }
            this.sortWaitCountdown = 0;
            const countdownTextEl = document.getElementById("balloon-print-countdown-text");
            if (countdownTextEl) {
                countdownTextEl.removeAttribute("data-wait-type");
            }
        }

        /**
         * 更新队列统计（更新DOM，不重新生成HTML）
         */
        UpdateQueueStats() {
            // 使用父类的统计方法（统计所有AC，而不是只统计balloonList）
            this.CalculateBalloonStats();

            // 更新DOM中的统计数值（不重新生成HTML）
            const statValue0 = document.getElementById("balloon-stat-value-0");
            const statValue10 = document.getElementById("balloon-stat-value-10");
            const statValue20 = document.getElementById("balloon-stat-value-20");
            const statValue30 = document.getElementById("balloon-stat-value-30");

            if (statValue0) statValue0.textContent = this.balloonStats[0] || 0;
            if (statValue10) statValue10.textContent = this.balloonStats[10] || 0;
            if (statValue20) statValue20.textContent = this.balloonStats[20] || 0;
            if (statValue30) statValue30.textContent = this.balloonStats[30] || 0;

            // 绑定点击事件（只需要绑定一次，但每次更新时检查）
            this.BindGlobalStatsClickEvents();

            // 更新选中状态（支持多选）
            const statItems = document.querySelectorAll(
                "#balloon-queue-stats .balloon-stat-item"
            );
            statItems.forEach((statItem) => {
                const status = parseInt(statItem.getAttribute("data-status"));
                const isSelected = this.filters.status.includes(status);
                if (isSelected) {
                    statItem.classList.add("active", "stat-selected");
                } else {
                    statItem.classList.remove("active", "stat-selected");
                }
            });
        }

        /**
         * 统计项点击事件
         */
        OnStatClick(status) {
            // 支持多选：如果已选中则移除，否则添加
            const index = this.filters.status.indexOf(status);
            if (index > -1) {
                // 已选中，移除
                this.filters.status.splice(index, 1);
            } else {
                // 未选中，添加
                this.filters.status.push(status);
            }

            // 保存到 localStorage
            this.SaveFiltersToStorage();

            // 更新统计显示
            this.UpdateQueueStats();

            // 重新渲染列表
            this.RenderQueueList();
        }

        /**
         * 清理所有筛选条件
         */
        ClearAllFilters() {
            this.filters = this.getDefaultFilters();
            if (this.groupLocked) {
                this.filters.groups = [...this.staffGroupIds];
            }
            if (this.roomLocked) {
                this.filters.rooms = this.staffRoomLockTokens.slice();
            }
            if (this.usesRoomLockStaticZoneUi()) {
                this.renderRoomLockStaticZoneField(
                    "balloon-zone-lock-field",
                    this.staffRoomLockTokens
                );
            }

            // 清空所有筛选器UI
            const groupSelect = document.getElementById("filter-groups");
            if (groupSelect) {
                const $groupSelect = $(groupSelect);
                const groupsToSet = this.groupLocked ? this.staffGroupIds : [];
                if ($groupSelect.data("multipleSelect")) {
                    $groupSelect.multipleSelect("setSelects", groupsToSet);
                } else {
                    Array.from(groupSelect.options).forEach(
                        (opt) => (opt.selected = groupsToSet.includes(opt.value))
                    );
                }
            }

            const senderSelect = document.getElementById("filter-sender");
            if (senderSelect) {
                senderSelect.value = "";
                const $senderSelect = $(senderSelect);
                if ($senderSelect.data("multipleSelect")) {
                    $senderSelect.multipleSelect("setSelects", []);
                }
            }

            const roomSelect = document.getElementById("filter-rooms");
            if (roomSelect && !this.usesRoomLockStaticZoneUi()) {
                const $roomSelect = $(roomSelect);
                if ($roomSelect.data("multipleSelect")) {
                    $roomSelect.multipleSelect("setSelects", []);
                } else {
                    Array.from(roomSelect.options).forEach(
                        (opt) => (opt.selected = false)
                    );
                }
            }

            const schoolSelect = document.getElementById("filter-schools");
            if (schoolSelect) {
                const $schoolSelect = $(schoolSelect);
                if ($schoolSelect.data("multipleSelect")) {
                    $schoolSelect.multipleSelect("setSelects", []);
                } else {
                    Array.from(schoolSelect.options).forEach(
                        (opt) => (opt.selected = false)
                    );
                }
            }

            const problemSelect = document.getElementById("filter-problems");
            if (problemSelect) {
                const $problemSelect = $(problemSelect);
                if ($problemSelect.data("multipleSelect")) {
                    $problemSelect.multipleSelect("setSelects", []);
                } else {
                    Array.from(problemSelect.options).forEach(
                        (opt) => (opt.selected = false)
                    );
                }
            }

            const searchInput = document.getElementById("filter-search");
            if (searchInput) {
                searchInput.value = "";
            }

            // 保存到 localStorage（清空状态）
            this.SaveFiltersToStorage();

            // 更新统计显示
            this.UpdateQueueStats();

            // 重新渲染列表
            this.RenderQueueList();
        }

        /**
         * 重写 UpdateGlobalStats，使用队列统计
         */
        UpdateGlobalStats() {
            // 检查是否有全局统计容器（balloon全览页面）
            const globalStatsContainer = document.getElementById(
                "balloon-global-stats"
            );
            if (globalStatsContainer) {
                // 如果有全局统计容器，使用父类的统计方法（统计所有AC）
                super.UpdateGlobalStats();
            }

            // 更新队列统计（队列页面自己的统计）
            this.UpdateQueueStats();
        }

        /**
         * 重写 RefreshData 方法，跳过父类中需要容器的部分（external mode）
         */
        async RefreshData() {
            try {
                // 刷新时不是初始加载
                this.isInitialLoad = false;
                // external mode 下不需要显示刷新按钮加载状态
                // 直接加载数据
                await this.LoadData();
            } catch (error) {
                // 刷新数据失败，静默处理
            }
        }
    }

    // 导出到全局
    window.BalloonManagerSystem = BalloonManagerSystem;
    window.BalloonQueueSystem = BalloonQueueSystem;
}

// ========================================
// 气球队列系统 Formatter
// ========================================

/** 题号列背景色：仅允许 hex / 简短 CSS 色名，防 style 注入 */
function BalloonQueueSanitizeProblemBadgeBg(rawColor) {
    const p =
        typeof RankToolParseColor === "function"
            ? RankToolParseColor(rawColor)
            : "#6b7280";
    const s = String(p || "").trim();
    if (/^#[0-9A-Fa-f]{6}$/i.test(s)) return s;
    if (/^[0-9A-Fa-f]{6}$/i.test(s)) return "#" + s;
    if (/^[a-z]{2,20}$/i.test(s)) return s.toLowerCase();
    return "#6b7280";
}

/** 题号徽章：题目配色 + 根据亮度选深/浅字（浅底用深色字，避免白底白字） */
function BalloonQueueProblemBadgeStyle(bgCss) {
    const bg = BalloonQueueSanitizeProblemBadgeBg(bgCss);
    let fg = "#ffffff";
    let textShadow = "0 1px 2px rgba(0,0,0,0.45)";
    let border = "1px solid rgba(0,0,0,0.2)";
    if (/^#[0-9A-Fa-f]{6}$/i.test(bg) && typeof csg !== "undefined" && csg.getContrastTextColor) {
        fg = csg.getContrastTextColor(bg);
        if (String(fg).toLowerCase() === "#ffffff") {
            textShadow = "0 1px 2px rgba(0,0,0,0.5)";
            border = "1px solid rgba(255,255,255,0.18)";
        } else {
            textShadow = "none";
            border = "1px solid rgba(0,0,0,0.12)";
        }
    }
    return {
        bg: bg,
        fg: fg,
        textShadow: textShadow,
        border: border,
    };
}

function cellStyleBalloonQueueIdx() {
    return { css: { fontSize: "0.78rem", padding: "0.28rem 0.2rem" } };
}
function cellStyleBalloonQueueSchool() {
    return {
        css: {
            fontSize: "0.8rem",
            padding: "0.3rem 0.35rem",
            verticalAlign: "middle",
            maxWidth: "13rem",
        },
    };
}
function cellStyleBalloonQueueTeamName() {
    return {
        css: {
            fontSize: "0.8rem",
            lineHeight: "1.35",
            whiteSpace: "normal",
            wordBreak: "break-word",
            verticalAlign: "middle",
            padding: "0.3rem 0.35rem",
            maxWidth: "14rem",
        },
    };
}
function cellStyleBalloonQueueZones() {
    return {
        css: {
            fontSize: "0.8rem",
            padding: "0.3rem 0.35rem",
            verticalAlign: "middle",
            maxWidth: "11rem",
        },
    };
}
function cellStyleBalloonQueueTeamId() {
    return { css: { fontSize: "0.8rem", padding: "0.3rem 0.28rem" } };
}
function cellStyleBalloonQueueProblem() {
    return { css: { padding: "0.28rem 0.25rem", verticalAlign: "middle" } };
}
function cellStyleBalloonQueueFb() {
    return { css: { padding: "0.28rem 0.2rem", verticalAlign: "middle" } };
}
function cellStyleBalloonQueueStatus() {
    return { css: { padding: "0.28rem 0.25rem", verticalAlign: "middle" } };
}
function cellStyleBalloonQueueSender() {
    return { css: { fontSize: "0.78rem", padding: "0.3rem 0.28rem" } };
}
function cellStyleBalloonQueueTime() {
    return { css: { fontSize: "0.78rem", padding: "0.3rem 0.28rem" } };
}

// 根据封榜情况处理行样式
function RowFormatterBalloonQueue(row, index) {
    let ret = {};
    if (row.flg_frozen) {
        ret.classes = "bg-info-subtle";
    }
    return ret;
}

// 气球队列 - 队伍ID formatter（可点击显示详情）
function FormatterBalloonTeamId(value, row, index, field) {
    return `<a href="#" class="text-primary">${RankToolEscapeHtml(
        String(value)
    )}</a>`;
}

// 气球队列 - 学校列（与 contest_teamgen / 打印状态页一致：多色 hash tag）
function FormatterBalloonQueueSchool(value, row, index, field) {
    const s = value != null ? String(value).trim() : "";
    if (typeof csg === "undefined" || !csg.hashTagBadgeHtml) {
        return s
            ? RankToolEscapeHtml(s)
            : '<span class="text-muted">—</span>';
    }
    const inner = !s
        ? csg.hashTagBadgeHtml("", "", {})
        : csg.hashTagBadgeHtml(s, s, { allowWrap: true, maxWidth: "12rem" });
    return (
        '<div class="teamgen-hash-cell teamgen-hash-cell--start">' +
        inner +
        "</div>"
    );
}

// 气球队列 - 题号 formatter（题目气球色 + 可读字母；双击可打印小票）
function FormatterBalloonProblem(value, row, index, field) {
    const alphabet = String(row.problem_alphabet || "?");
    const rawColor =
        row.problem?.color ?? row.problem?.title_color ?? "";
    const st = BalloonQueueProblemBadgeStyle(rawColor);
    const safeBg = BalloonQueueSanitizeProblemBadgeBg(rawColor);
    const qs = window.balloonQueueSystem;
    const ticketTitle =
        qs?.isBalloonManager
            ? "双击打印小票 / Double-click to print ticket"
            : qs?.isBalloonSender && !qs?.isBalloonManager
              ? ""
              : "题号 / Problem";
    const titleAttr = ticketTitle
        ? ` title="${RankToolEscapeHtml(ticketTitle)}"`
        : "";
    return (
        `<span class="balloon-queue-problem-badge" 
             style="cursor:pointer;background:${safeBg};color:${st.fg};text-shadow:${st.textShadow};border:${st.border};" 
             ${titleAttr}>` +
        RankToolEscapeHtml(alphabet) +
        `</span>`
    );
}

function SorterBalloonQueueProblemNum(a, b, rowA, rowB) {
    const numA = Number(rowA?.problem_num ?? a);
    const numB = Number(rowB?.problem_num ?? b);
    if (!isNaN(numA) && !isNaN(numB) && numA !== numB) {
        return numA - numB;
    }
    return String(rowA?.problem_alphabet || "").localeCompare(
        String(rowB?.problem_alphabet || "")
    );
}

/** 气球队列：单列比较（不含方向；方向由 SortBalloonWorkQueueInPlace 施加） */
function CompareBalloonQueueUserField(a, b, field) {
    switch (field) {
        case "problem_num":
            return SorterBalloonQueueProblemNum(
                a.problem_num,
                b.problem_num,
                a,
                b
            );
        case "in_date": {
            const ta = new Date(a.in_date).getTime();
            const tb = new Date(b.in_date).getTime();
            if (isNaN(ta) || isNaN(tb)) {
                return 0;
            }
            return ta - tb;
        }
        case "bst":
            return (Number(a.bst) || 0) - (Number(b.bst) || 0);
        case "idx":
            return (Number(a.idx) || 0) - (Number(b.idx) || 0);
        case "team_id":
            return String(a.team_id || "").localeCompare(
                String(b.team_id || ""),
                undefined,
                { numeric: true }
            );
        default: {
            const va = a[field];
            const vb = b[field];
            if (typeof va === "number" && typeof vb === "number") {
                return va - vb;
            }
            return String(va ?? "").localeCompare(String(vb ?? ""), undefined, {
                numeric: true,
            });
        }
    }
}

/** 未处理 = contest_balloon.bst 0（与统计「未处理」一致） */
function BalloonQueuePendingRank(row) {
    return NormalizeContestBalloonBst(row && row.bst) === 0 ? 0 : 1;
}

/**
 * 气球队列工作顺序（client 全量数据）：
 * - 除按「状态」列排序外：先按未处理(bst=0) 分组（未处理永远在前），组内再按用户列 asc/desc；
 * - 仅按「状态」列：纯 bst 序，不再强加未处理优先；
 * - 默认等价于时间列 + 未处理优先。
 */
function SortBalloonWorkQueueInPlace(rows, sortField, sortOrder) {
    const field = sortField || "in_date";
    const pendingFirst = field !== "bst";
    const dir = sortOrder === "desc" ? -1 : 1;
    rows.sort((a, b) => {
        if (pendingFirst) {
            const wa = BalloonQueuePendingRank(a);
            const wb = BalloonQueuePendingRank(b);
            if (wa !== wb) {
                return wa - wb;
            }
        }
        let c = CompareBalloonQueueUserField(a, b, field);
        if (c === 0 && field !== "in_date") {
            c = CompareBalloonQueueUserField(a, b, "in_date");
        }
        if (c === 0) {
            return String(a.solution_id || "").localeCompare(
                String(b.solution_id || "")
            );
        }
        return c * dir;
    });
}

/**
 * bootstrap-table client 排序唯一入口。
 * 注意：BST 的 customSort 不接收返回值，必须在传入的 data 引用上原地排序。
 */
function BalloonQueueCustomSort(sortName, sortOrder, data) {
    if (!Array.isArray(data)) {
        return data;
    }
    SortBalloonWorkQueueInPlace(
        data,
        sortName || "in_date",
        sortOrder || "asc"
    );
    return data;
}

function CountBalloonPrintableItems(rows) {
    let count = 0;
    for (let i = 0; i < rows.length; i++) {
        if ((Number(rows[i].bst) || 0) === 0) {
            count++;
        }
    }
    return count;
}

// 气球队列 - 首答 formatter（图标显示）
function FormatterBalloonFirstBlood(value, row, index, field) {
    let html = "";
    if (row.is_global_fb) {
        html +=
            '<i class="bi bi-star-fill text-warning" title="全场首答 / Global First Blood"></i> ';
    }
    if (row.is_regular_fb) {
        html +=
            '<i class="bi bi-check-circle-fill text-info" title="正式队首答 / Regular First Blood"></i>';
    }
    if (!html) {
        html = '<span class="text-muted">—</span>';
    }
    return html;
}

// 气球队列 - 状态 formatter（中英双语风格，参考系统统一样式）
function FormatterBalloonStatus(value, row, index, field) {
    if (!window.balloonQueueSystem) return value;

    const bst = NormalizeContestBalloonBst(row.bst);
    const statusMap = window.balloonQueueSystem.balloonStatusMap || {};
    const statusInfo = statusMap[bst] ||
        statusMap[0] || { cn: "未知", en: "Unknown", color: "#6c757d" };

    const iconMap = {
        0: "bi bi-x-circle-fill",
        10: "bi bi-printer-fill",
        20: "bi bi-person-check-fill",
        30: "bi bi-check-circle-fill",
    };
    const icon = iconMap[bst] || "bi bi-question-circle-fill";

    const btnClassMap = {
        0: "btn-danger",
        10: "btn-warning",
        20: "btn-info",
        30: "btn-success",
    };
    const btnClass = btnClassMap[bst] || "btn-secondary";

    const qs = window.balloonQueueSystem;
    const bilingualText = `<span><i class="${icon}"></i>${statusInfo.cn}</span><span class="en-text">${statusInfo.en}</span>`;

    if (qs.isBalloonManager) {
        const titleText = `点击管理气球状态 / Click to manage balloon status`;
        return (
            `<button type="button" class="btn btn-sm ${btnClass} balloon-queue-status-btn" ` +
            `style="cursor: pointer;" title="${titleText}">${bilingualText}</button>`
        );
    }

    if (qs.isBalloonSender && !qs.isBalloonManager) {
        const tab = qs.currentTab || "queue";
        const sid = RankToolEscapeHtml(String(row.solution_id));
        const tid =
            "balloonSenderDd_" +
            String(row.solution_id).replace(/[^a-zA-Z0-9_-]/g, "_");

        if (tab === "my_balloons" && bst === 20) {
            return (
                `<div class="btn-group dropdown balloon-queue-sender-bst-dd w-100" role="group">` +
                `<button type="button" class="btn btn-sm ${btnClass} dropdown-toggle balloon-queue-sender-dd-toggle w-100" ` +
                `id="${tid}" data-bs-toggle="dropdown" aria-expanded="false">` +
                bilingualText +
                `</button>` +
                `<ul class="dropdown-menu dropdown-menu-end balloon-queue-sender-dd-menu" aria-labelledby="${tid}" data-bq-dd-toggle-id="${tid}">` +
                `<li><a class="dropdown-item" href="#" data-solution-id="${sid}" data-sender-dd-action="deliver">标记已发放 <span class="en-text">Delivered</span></a></li>` +
                `<li><a class="dropdown-item" href="#" data-solution-id="${sid}" data-sender-dd-action="return">退回未发放 <span class="en-text">Return (not sent)</span></a></li>` +
                `</ul></div>`
            );
        }
        if (tab === "my_balloons" && bst === 30) {
            return (
                `<div class="btn-group dropdown balloon-queue-sender-bst-dd w-100" role="group">` +
                `<button type="button" class="btn btn-sm ${btnClass} dropdown-toggle balloon-queue-sender-dd-toggle w-100" ` +
                `id="${tid}" data-bs-toggle="dropdown" aria-expanded="false">` +
                bilingualText +
                `</button>` +
                `<ul class="dropdown-menu dropdown-menu-end balloon-queue-sender-dd-menu" aria-labelledby="${tid}" data-bq-dd-toggle-id="${tid}">` +
                `<li><a class="dropdown-item" href="#" data-solution-id="${sid}" data-sender-dd-action="withdraw">转回已分配 <span class="en-text">Back to assigned</span></a></li>` +
                `<li><a class="dropdown-item" href="#" data-solution-id="${sid}" data-sender-dd-action="return">退回未发放 <span class="en-text">Return (not sent)</span></a></li>` +
                `</ul></div>`
            );
        }

        return (
            `<button type="button" class="btn btn-sm ${btnClass} balloon-queue-status-btn" ` +
            `style="cursor: pointer;">${bilingualText}</button>`
        );
    }

    return (
        `<button type="button" class="btn btn-sm ${btnClass} balloon-queue-status-btn" ` +
        `style="cursor: pointer;" title="单击查看详情 / Click for details">${bilingualText}</button>`
    );
}

// 气球队列 - 配送员 formatter
function FormatterBalloonSender(value, row, index, field) {
    return RankToolEscapeHtml(row.balloon_sender || "-");
}

// 气球队列 - 分区（原房间字段；多值逗号分隔时多枚 hash tag，与 teamgen 分区列一致）
function FormatterBalloonRoom(value, row, index, field) {
    const room = row.team?.room || value || "";
    const raw = String(room || "").trim();
    if (typeof csg !== "undefined" && csg.hashTagBadgeHtml) {
        const inner = !raw
            ? csg.hashTagBadgeHtml("", "", {})
            : typeof csg.hashTagBadgeListHtml === "function"
              ? csg.hashTagBadgeListHtml(raw, /[,，]+/, { allowWrap: true })
              : csg.hashTagBadgeHtml(raw, raw, { allowWrap: true, maxWidth: "10rem" });
        return (
            '<div class="teamgen-hash-cell teamgen-hash-cell--start">' +
            inner +
            "</div>"
        );
    }
    if (!raw) return '<span class="text-muted">—</span>';
    return RankToolEscapeHtml(raw);
}
