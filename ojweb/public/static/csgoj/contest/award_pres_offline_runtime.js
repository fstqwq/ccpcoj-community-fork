/**
 * 颁奖全屏「单文件 HTML」离线浏览：由 award_deck 打包时内嵌本文件 + JSON 数据。
 * 依赖页面已存在的 #award_presentation_* DOM（与 award_deck.php 全屏结构一致）。
 */
(function awardPresOfflineMain() {
    "use strict";

    function awardPresEnableMarqueeIfNeeded(element, text, options) {
        options = options || {};
        const hasText = text != null && String(text).trim() !== "";
        if (!element) return;
        if (element.classList.contains("award-pres-fb-under-rank")) {
            return;
        }
        if (!hasText) {
            element.classList.remove("needs-marquee");
            const clearWrap = element.querySelector(".marquee-wrapper");
            if (clearWrap) clearWrap.remove();
            element.textContent = "";
            element.style.removeProperty("--marquee-duration");
            element.style.removeProperty("--marquee-translate");
            return;
        }
        element.classList.remove("needs-marquee");
        const oldWrapper = element.querySelector(".marquee-wrapper");
        if (oldWrapper) oldWrapper.remove();
        element.textContent = String(text);
        const minDur = options.marqueeAggressive ? 1.2 : 4;
        const baseSpeed = options.marqueeAggressive ? 155 : 80;
        requestAnimationFrame(() => {
            if (!element.parentNode) return;
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
            }
        });
    }

    const VISUAL_SUFFIXES = [
        "champion-school",
        "first-blood",
        "best-female",
        "tenacity",
        "medal-gold",
        "medal-silver",
        "medal-bronze",
        "champion-misc",
    ];

    const PACK = (function readPack() {
        const el = document.getElementById("award-pres-pack-data");
        if (!el || !el.textContent) {
            return { display: {}, snapshots: [] };
        }
        try {
            return JSON.parse(el.textContent);
        } catch (e) {
            console.warn("[award_pres_offline] bad pack json", e);
            return { display: {}, snapshots: [] };
        }
    })();

    const ASPECT_PRESET_LADDER = ["9:21", "9:16", "3:4", "4:3", "16:9", "21:9", "fullscreen"];

    function normalizeDisplay(raw) {
        const def = {
            aspect_mode: "16:9",
            pres_aspect_user: false,
            pres_stage_zoom: 1,
            team_grid_columns: "2",
            font_scale: 1,
            award_pres_theme: "honor",
            show_member_names: true,
            show_coach: true,
            show_school: true,
            show_team_name: true,
            show_team_name_en: false,
            show_team_id: false,
        };
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
            o.pres_aspect_user = true;
        }
        if (typeof o.pres_stage_zoom !== "number" || !Number.isFinite(o.pres_stage_zoom) || o.pres_stage_zoom <= 0) {
            o.pres_stage_zoom = def.pres_stage_zoom;
        } else {
            o.pres_stage_zoom = Math.min(4, Math.max(0.35, o.pres_stage_zoom));
        }
        let col = String(o.team_grid_columns || "2").trim();
        if (col === "auto") col = "2";
        o.team_grid_columns = ["1", "2", "3"].includes(col) ? col : "2";
        ["show_member_names", "show_coach", "show_school", "show_team_name", "show_team_name_en", "show_team_id"].forEach((k) => {
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

    let disp = normalizeDisplay(PACK.display || {});
    let index = 0;
    let presListDeckVisual = "";

    function suggestAspectModeFromViewport(Vw, Vh) {
        const ladder = ASPECT_PRESET_LADDER.filter((x) => x !== "fullscreen");
        const vr = Vw / Math.max(1, Vh);
        if (!Number.isFinite(vr) || vr <= 0) return "16:9";
        let best = "16:9";
        let bestD = Infinity;
        ladder.forEach((key) => {
            const segs = key.split(":");
            const w = parseFloat(segs[0]);
            const h = parseFloat(segs[1]);
            const r = w / h;
            const d = Math.abs(Math.log(vr / Math.max(1e-9, r)));
            if (d < bestD) {
                bestD = d;
                best = key;
            }
        });
        return best;
    }

    function nearestAspectLadderIndex(viewportRatio) {
        const ladder = ASPECT_PRESET_LADDER.filter((x) => x !== "fullscreen");
        let bestI = 0;
        let bestD = Infinity;
        ladder.forEach((key, i) => {
            const segs = key.split(":");
            const w = parseFloat(segs[0]);
            const h = parseFloat(segs[1]);
            const r = w / h;
            const d = Math.abs(Math.log(viewportRatio / Math.max(1e-9, r)));
            if (d < bestD) {
                bestD = d;
                bestI = i;
            }
        });
        return bestI;
    }

    function syncAspectToolbarFromDisplay() {
        const d = normalizeDisplay(disp);
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
        const segs = String(mode).split(":");
        const w = parseInt(segs[0], 10) || 16;
        const h = parseInt(segs[1], 10) || 9;
        wEl.value = String(w);
        hEl.value = String(h);
    }

    function maybeAutoPresentationAspectFromViewport() {
        const d = normalizeDisplay(disp);
        if (d.pres_aspect_user) {
            syncAspectToolbarFromDisplay();
            return;
        }
        const viewport = document.querySelector(".award-presentation-viewport");
        if (!viewport) return;
        const Vw = Math.max(1, viewport.clientWidth);
        const Vh = Math.max(1, viewport.clientHeight);
        const suggested = suggestAspectModeFromViewport(Vw, Vh);
        disp = normalizeDisplay({
            ...d,
            aspect_mode: suggested,
            pres_aspect_user: false,
        });
        syncAspectToolbarFromDisplay();
    }

    function readAspectFromToolbarInputs() {
        const wEl = document.getElementById("award_pres_aspect_w");
        const hEl = document.getElementById("award_pres_aspect_h");
        const wStr = `${wEl && wEl.value != null ? wEl.value : ""}`.trim();
        const hStr = `${hEl && hEl.value != null ? hEl.value : ""}`.trim();
        const w = parseInt(wStr, 10);
        const h = parseInt(hStr, 10);
        if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) {
            return null;
        }
        return `${Math.min(64, Math.max(1, w))}:${Math.min(64, Math.max(1, h))}`;
    }

    function commitAspectFromToolbarInputs() {
        const mode = readAspectFromToolbarInputs();
        if (!mode) return;
        disp = normalizeDisplay({ ...disp, aspect_mode: mode, pres_aspect_user: true });
        syncAspectToolbarFromDisplay();
        requestAnimationFrame(() => applyPresentationSlideLayout());
    }

    function stepPresentationAspect(delta) {
        const d = normalizeDisplay(disp);
        let idx = ASPECT_PRESET_LADDER.indexOf(d.aspect_mode);
        if (idx < 0) {
            const segs = String(d.aspect_mode || "").split(":");
            const w = parseFloat(segs[0]);
            const h = parseFloat(segs[1]);
            const vr = Number.isFinite(w) && Number.isFinite(h) && h > 0 ? w / h : 16 / 9;
            idx = nearestAspectLadderIndex(vr);
        }
        idx = Math.max(0, Math.min(ASPECT_PRESET_LADDER.length - 1, idx + delta));
        disp = normalizeDisplay({
            ...d,
            aspect_mode: ASPECT_PRESET_LADDER[idx],
            pres_aspect_user: true,
        });
        syncAspectToolbarFromDisplay();
        requestAnimationFrame(() => applyPresentationSlideLayout());
    }

    function presentationZoomStep(direction) {
        const d = normalizeDisplay(disp);
        const factor = direction > 0 ? 1.09 : 1 / 1.09;
        let z = typeof d.pres_stage_zoom === "number" && Number.isFinite(d.pres_stage_zoom) ? d.pres_stage_zoom : 1;
        z *= factor;
        disp = normalizeDisplay({ ...d, pres_stage_zoom: z });
        requestAnimationFrame(() => applyPresentationSlideLayout());
    }

    function applyPresentationShellUserZoom(viewport, shell) {
        if (!viewport || !shell) return;
        const d = normalizeDisplay(disp);
        let z = d.pres_stage_zoom;
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
        if (Math.abs(clamped - z) > 1e-4) {
            disp = normalizeDisplay({ ...d, pres_stage_zoom: clamped });
        }
        shell.style.setProperty("--pres-shell-zoom", String(clamped));
    }

    function presentationMeasurePresLayoutFits(card) {
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

    function presentationMaxTypeScale(slide, card, minScale, maxScale) {
        if (!slide || !card) return minScale;
        const cap = Math.min(Math.max(maxScale, minScale), 2.35);
        slide.style.setProperty("--pres-type-scale", String(cap));
        void card.offsetHeight;
        if (presentationMeasurePresLayoutFits(card)) {
            return cap;
        }
        slide.style.setProperty("--pres-type-scale", String(minScale));
        void card.offsetHeight;
        if (!presentationMeasurePresLayoutFits(card)) {
            return minScale;
        }
        let lo = minScale;
        let hi = cap;
        for (let i = 0; i < 26; i++) {
            const mid = (lo + hi) / 2;
            slide.style.setProperty("--pres-type-scale", String(mid));
            void card.offsetHeight;
            if (presentationMeasurePresLayoutFits(card)) {
                lo = mid;
            } else {
                hi = mid;
            }
        }
        return lo;
    }

    function choosePresentationColumnsAndTypeScale(slide, card, listEl, slideW, slideH, snap) {
        const rows = Math.max(1, snap.rowCount | 0);
        if (snap.soloChampion) {
            listEl.className = "award-pres-list award-pres-list--solo-champion award-pres-cols-1";
            listEl.style.removeProperty("--pres-list-rows");
            const minScale = 0.24;
            const maxScale = 1.38;
            const sm = presentationMaxTypeScale(slide, card, minScale, maxScale);
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
        const sm = presentationMaxTypeScale(slide, card, minScale, maxScale);
        const comfort = cols >= 3 ? 0.82 : 0.86;
        const damped = Math.max(minScale, Math.min(sm * comfort, 1.02));
        slide.style.setProperty("--pres-type-scale", String(damped));
        void card.offsetHeight;
        return cols;
    }

    function computePresentationSlideSize(stageW, stageH, aspectMode) {
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

    function syncPresentationListDeckVisualClass(listEl) {
        if (!listEl) return;
        VISUAL_SUFFIXES.forEach((s) => {
            listEl.classList.remove(`award-pres-deck-visual--${s}`);
        });
        if (presListDeckVisual) {
            listEl.classList.add(`award-pres-deck-visual--${presListDeckVisual}`);
        }
    }

    function fitPresentationTitleRow() {
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

    function squeezePresentationTypeScaleIfOverflow(slide, card) {
        if (!slide || !card) return;
        const minTs = 0.08;
        let ts = parseFloat(slide.style.getPropertyValue("--pres-type-scale"));
        if (!Number.isFinite(ts) || ts <= 0) {
            ts = 1;
        }
        for (let i = 0; i < 64; i++) {
            void card.offsetHeight;
            if (presentationMeasurePresLayoutFits(card)) {
                return;
            }
            ts = Math.max(minTs, ts * 0.94);
            slide.style.setProperty("--pres-type-scale", String(ts));
        }
    }

    function fitPresentationScaleToViewport() {
        const slide = document.getElementById("award_presentation_slide");
        const card = slide?.querySelector(".award-presentation-card");
        if (!slide || !card) return;
        const fits = () => presentationMeasurePresLayoutFits(card);
        const minFit = 0.08;
        slide.style.setProperty("--pres-fit-scale", "1");
        void card.offsetHeight;
        if (fits()) {
            squeezePresentationTypeScaleIfOverflow(slide, card);
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
        squeezePresentationTypeScaleIfOverflow(slide, card);
        void card.offsetHeight;
        if (!fits()) {
            let fit = Math.max(minFit, parseFloat(slide.style.getPropertyValue("--pres-fit-scale")) || minFit);
            for (let j = 0; j < 28 && !fits(); j++) {
                fit = Math.max(minFit, fit * 0.9);
                slide.style.setProperty("--pres-fit-scale", String(fit));
                void card.offsetHeight;
                squeezePresentationTypeScaleIfOverflow(slide, card);
                void card.offsetHeight;
            }
        }
    }

    function syncPresentationTailCluster(listEl, snap) {
        if (!listEl || !snap) return;
        listEl.querySelectorAll(":scope > .award-pres-tail-cluster").forEach((w) => {
            const parent = w.parentNode;
            if (!parent) return;
            while (w.firstChild) {
                parent.insertBefore(w.firstChild, w);
            }
            w.remove();
        });
        if (snap.soloChampion) return;
        let cols = parseInt(String(disp.team_grid_columns || "2"), 10);
        if (!Number.isFinite(cols) || cols < 1 || cols > 3) {
            cols = 2;
        }
        const n = snap.rowCount | 0;
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

    function refreshAwardPresentationMarquees(listEl) {
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

    function applyPresentationSlideLayout() {
        const viewport = document.querySelector(".award-presentation-viewport");
        const shell = document.getElementById("award_presentation_slide_shell");
        const slide = document.getElementById("award_presentation_slide");
        const listEl = document.getElementById("award_presentation_list");
        const card = slide?.querySelector(".award-presentation-card");
        const snaps = PACK.snapshots || [];
        if (!viewport || !shell || !slide || !snaps.length) return;
        const page = snaps[index];
        if (!page) return;
        presListDeckVisual = page.deckVisual || "";
        const d = normalizeDisplay(disp);
        const mode = d.aspect_mode || "16:9";
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
            const { sw, sh } = computePresentationSlideSize(Vw, Vh, mode);
            shell.style.width = `${sw}px`;
            shell.style.height = `${sh}px`;
            vw = sw;
            vh = sh;
        }
        slide.style.setProperty("--pres-type-scale", "1");
        slide.style.setProperty("--pres-fit-scale", "1");
        const fs = d.font_scale && d.font_scale > 0 ? d.font_scale : 1;
        slide.style.setProperty("--pres-font-scale", String(fs));
        if (listEl && card && listEl.innerHTML.trim()) {
            choosePresentationColumnsAndTypeScale(slide, card, listEl, vw, vh, page);
        } else {
            slide.style.setProperty("--pres-type-scale", "1");
        }
        syncPresentationListDeckVisualClass(listEl);
        fitPresentationTitleRow();
        fitPresentationScaleToViewport();
        applyPresentationShellUserZoom(viewport, shell);
        if (listEl) {
            requestAnimationFrame(() => {
                fitPresentationTitleRow();
                fitPresentationScaleToViewport();
                applyPresentationShellUserZoom(viewport, shell);
                requestAnimationFrame(() => {
                    fitPresentationTitleRow();
                    fitPresentationScaleToViewport();
                    applyPresentationShellUserZoom(viewport, shell);
                    requestAnimationFrame(() => {
                        fitPresentationTitleRow();
                        fitPresentationScaleToViewport();
                        applyPresentationShellUserZoom(viewport, shell);
                        refreshAwardPresentationMarquees(listEl);
                    });
                });
            });
        }
    }

    function applyThemeToStage(themeId) {
        const allowed = new Set(["mist", "night", "honor", "ruby", "ocean", "jade"]);
        const t = allowed.has(themeId) ? themeId : "honor";
        const stage = document.getElementById("award_presentation_stage");
        if (stage) stage.setAttribute("data-award-pres-theme", t);
    }

    function syncNav() {
        const n = (PACK.snapshots || []).length;
        const prevBtn = document.getElementById("award_presentation_prev");
        const nextBtn = document.getElementById("award_presentation_next");
        const atFirst = n <= 0 || index <= 0;
        const atLast = n <= 0 || index >= n - 1;
        if (prevBtn) prevBtn.disabled = atFirst;
        if (nextBtn) nextBtn.disabled = atLast;
        const pageInfo = document.getElementById("award_presentation_page_info");
        if (pageInfo) pageInfo.textContent = n ? `${index + 1} / ${n}` : "- / -";
    }

    function renderPresentation() {
        const snaps = PACK.snapshots || [];
        if (!snaps.length) return;
        const page = snaps[index];
        const titleEl = document.getElementById("award_presentation_title");
        const groupEl = document.getElementById("award_presentation_group");
        const subtitleEl = document.getElementById("award_presentation_subtitle");
        const listEl = document.getElementById("award_presentation_list");
        const fracEl = document.getElementById("award_presentation_award_fraction");
        if (titleEl) {
            titleEl.textContent = page.headline || "";
            titleEl.classList.toggle("award-presentation-title--medal", !!page.titleIsMedal);
        }
        if (fracEl) {
            const t = Math.max(1, page.awardPageTotal | 0);
            const x = Math.min(Math.max(1, page.awardPageNum | 0), t);
            fracEl.textContent = `${x}\u2009/\u2009${t}`;
        }
        if (groupEl) {
            const gl = page.groupLine != null ? String(page.groupLine) : "";
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
        const n = page.rowCount | 0;
        listEl.style.setProperty("--award-pres-rows", String(Math.max(n, 1)));
        listEl.innerHTML = page.listHtml || "";
        if (!page.soloChampion) {
            syncPresentationTailCluster(listEl, page);
        }
        requestAnimationFrame(() => {
            applyPresentationSlideLayout();
            requestAnimationFrame(() => applyPresentationSlideLayout());
        });
        syncNav();
    }

    function go(delta) {
        const snaps = PACK.snapshots || [];
        const n = snaps.length;
        const next = index + delta;
        if (next < 0 || next >= n) return;
        index = next;
        renderPresentation();
    }

    let awardPresOffToolbarTimer = null;
    let awardPresOffUiAbort = null;

    function clearAwardPresOffToolbarTimer() {
        if (awardPresOffToolbarTimer) {
            clearTimeout(awardPresOffToolbarTimer);
            awardPresOffToolbarTimer = null;
        }
    }

    function scheduleAwardPresOffToolbarHide() {
        clearAwardPresOffToolbarTimer();
        awardPresOffToolbarTimer = setTimeout(() => {
            const t = document.querySelector(".award-presentation-toolbar--overlay");
            if (t) t.classList.add("award-presentation-toolbar--hidden");
            awardPresOffToolbarTimer = null;
        }, 900);
    }

    function showAwardPresOffToolbar() {
        const t = document.querySelector(".award-presentation-toolbar--overlay");
        if (t) t.classList.remove("award-presentation-toolbar--hidden");
        clearAwardPresOffToolbarTimer();
    }

    function hideAwardPresOffToolbarImmediate() {
        clearAwardPresOffToolbarTimer();
        const t = document.querySelector(".award-presentation-toolbar--overlay");
        if (t) t.classList.add("award-presentation-toolbar--hidden");
    }

    function detachAwardPresOffPresentationUi() {
        clearAwardPresOffToolbarTimer();
        if (awardPresOffUiAbort) {
            awardPresOffUiAbort.abort();
            awardPresOffUiAbort = null;
        }
    }

    /** 与 award_deck 全屏一致：顶栏默认收起，指针移入顶部窄带或工具栏时展开 */
    function attachAwardPresOffPresentationUi() {
        detachAwardPresOffPresentationUi();
        const stage = document.getElementById("award_presentation_stage");
        const toolbar = stage?.querySelector(".award-presentation-toolbar--overlay");
        if (!stage) return;
        const ac = new AbortController();
        awardPresOffUiAbort = ac;
        const inRevealZone = (e) => {
            const r = stage.getBoundingClientRect();
            const ry = (e.clientY - r.top) / Math.max(r.height, 1);
            return ry < 0.14 || !!(toolbar && toolbar.contains(e.target));
        };
        stage.addEventListener("mousemove", (e) => {
            if (inRevealZone(e)) {
                showAwardPresOffToolbar();
            } else {
                scheduleAwardPresOffToolbarHide();
            }
        }, { signal: ac.signal });
        stage.addEventListener("touchstart", (e) => {
            if (inRevealZone(e)) showAwardPresOffToolbar();
            else scheduleAwardPresOffToolbarHide();
        }, { signal: ac.signal, passive: true });
        if (toolbar) {
            toolbar.addEventListener("mouseenter", () => clearAwardPresOffToolbarTimer(), { signal: ac.signal });
            toolbar.addEventListener("mouseleave", () => scheduleAwardPresOffToolbarHide(), { signal: ac.signal });
        }
    }

    function wireUi() {
        const prevBtn = document.getElementById("award_presentation_prev");
        const nextBtn = document.getElementById("award_presentation_next");
        const closeBtn = document.getElementById("award_presentation_close");
        const fsBtn = document.getElementById("award_presentation_fullscreen");
        if (prevBtn) prevBtn.addEventListener("click", () => go(-1));
        if (nextBtn) nextBtn.addEventListener("click", () => go(1));
        if (closeBtn) {
            closeBtn.addEventListener("click", () => {
                if (window.close) window.close();
            });
        }
        if (fsBtn) {
            fsBtn.addEventListener("click", () => {
                const stage = document.getElementById("award_presentation_stage");
                if (!stage) return;
                if (!document.fullscreenElement) {
                    stage.requestFullscreen?.();
                } else {
                    document.exitFullscreen?.();
                }
            });
        }
        const zIn = document.getElementById("award_presentation_zoom_in");
        const zOut = document.getElementById("award_presentation_zoom_out");
        if (zIn) zIn.addEventListener("click", () => presentationZoomStep(1));
        if (zOut) zOut.addEventListener("click", () => presentationZoomStep(-1));
        const aspNarrow = document.getElementById("award_pres_aspect_narrow");
        const aspWide = document.getElementById("award_pres_aspect_wide");
        if (aspNarrow) aspNarrow.addEventListener("click", () => stepPresentationAspect(-1));
        if (aspWide) aspWide.addEventListener("click", () => stepPresentationAspect(1));
        const commitAsp = () => commitAspectFromToolbarInputs();
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
        const presToolbar = document.querySelector(".award-presentation-toolbar--overlay");
        if (presToolbar) {
            presToolbar.addEventListener("click", (e) => {
                const it = e.target.closest("[data-award-pres-theme]");
                if (!it || !presToolbar.contains(it)) return;
                const theme = it.getAttribute("data-award-pres-theme");
                if (!theme) return;
                e.preventDefault();
                disp = normalizeDisplay({ ...disp, award_pres_theme: theme });
                applyThemeToStage(disp.award_pres_theme);
                if (typeof bootstrap !== "undefined" && bootstrap.Dropdown) {
                    const toggle = document.getElementById("award_pres_theme_menu_btn");
                    const inst = toggle && bootstrap.Dropdown.getInstance(toggle);
                    if (inst) inst.hide();
                }
                requestAnimationFrame(() => applyPresentationSlideLayout());
            });
        }
        window.addEventListener("resize", () => {
            requestAnimationFrame(() => applyPresentationSlideLayout());
        });
        document.addEventListener("fullscreenchange", () => {
            requestAnimationFrame(() => applyPresentationSlideLayout());
        });
        document.addEventListener("keydown", (e) => {
            if (e.key === "ArrowLeft") go(-1);
            else if (e.key === "ArrowRight") go(1);
            else if (e.key === "Escape" && document.fullscreenElement) {
                document.exitFullscreen?.();
            }
        });
    }

    applyThemeToStage(normalizeDisplay(disp).award_pres_theme);
    index = 0;
    wireUi();
    attachAwardPresOffPresentationUi();
    void document.body.offsetHeight;
    requestAnimationFrame(() => {
        maybeAutoPresentationAspectFromViewport();
        renderPresentation();
        hideAwardPresOffToolbarImmediate();
        requestAnimationFrame(() => {
            hideAwardPresOffToolbarImmediate();
        });
    });
})();
