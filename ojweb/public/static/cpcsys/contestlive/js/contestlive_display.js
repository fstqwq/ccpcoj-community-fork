/**
 * 综合 HUD：左上品牌与标题、左列数据、右侧内嵌 RankLiveSystem、底栏短消息与快捷键
 */
(function () {
    const cid = window.CONTEST_LIVE_CID;
    if (!cid) {
        return;
    }

    const isHud = !!document.querySelector('[data-live-hud="1"]');
    const clockEl = document.getElementById('contestlive_clock');
    const brandRow = document.getElementById('contestlive_brand_row');
    const mastheadRow = document.getElementById('contestlive_hud_masthead_row');
    const hudLeft = document.getElementById('contestlive_hud_left');
    const hudMast = document.getElementById('contestlive_hud_masthead');
    const hudRank = document.getElementById('contestlive_hud_rank_wrap');
    const hudBottom = document.getElementById('contestlive_hud_bottom');
    const hudRoot = document.getElementById('contestlive_display_root');
    const hudQueueWrap = document.getElementById('contestlive_hud_queue_wrap');
    const hudAcWrap = document.getElementById('contestlive_hud_ac_wrap');
    const hudProbStatsWrap = document.getElementById('contestlive_hud_prob_stats_wrap');

    /** 首帧关闭过渡，避免从 localStorage 恢复状态时整页「扫」一遍 */
    if (isHud && hudRoot) {
        hudRoot.classList.add('contestlive-hud--toggle-prime');
    }

    const storageKey = function (name) {
        return 'contestlive_hud_' + cid + '_' + name;
    };

    function readToggle(name, defVal) {
        try {
            const v = localStorage.getItem(storageKey(name));
            if (v === null) {
                return defVal;
            }
            return v === '1';
        } catch (e) {
            return defVal;
        }
    }

    function writeToggle(name, on) {
        try {
            localStorage.setItem(storageKey(name), on ? '1' : '0');
        } catch (e) {
            /* ignore */
        }
    }

    const HUD_OPACITY_STEPS = 4;

    function readOpacityStep() {
        try {
            const v = parseInt(localStorage.getItem(storageKey('opacityStep')), 10);
            if (Number.isNaN(v) || v < 0 || v >= HUD_OPACITY_STEPS) {
                return 1;
            }
            return v;
        } catch (e) {
            return 1;
        }
    }

    function writeOpacityStep(step) {
        try {
            localStorage.setItem(storageKey('opacityStep'), String(step));
        } catch (e) {
            /* ignore */
        }
    }

    function applyOpacityStep(step) {
        if (!isHud || !hudRoot) {
            return;
        }
        const s = Math.max(0, Math.min(HUD_OPACITY_STEPS - 1, step));
        hudRoot.setAttribute('data-contestlive-hud-opacity-step', String(s));
    }

    if (isHud && hudRoot) {
        applyOpacityStep(readOpacityStep());
    }

    function setHudAriaHidden(el, on) {
        if (!el) {
            return;
        }
        if (on) {
            el.removeAttribute('aria-hidden');
        } else {
            el.setAttribute('aria-hidden', 'true');
        }
    }

    function applyHudLayer(name, on) {
        if (name === 'leftCol' && hudLeft) {
            hudLeft.classList.toggle('contestlive-hud-toggle-off', !on);
            setHudAriaHidden(hudLeft, on);
        }
        if (name === 'rank' && hudRank) {
            hudRank.classList.toggle('contestlive-hud-toggle-off', !on);
            setHudAriaHidden(hudRank, on);
        }
        if (name === 'masthead' && hudMast) {
            hudMast.classList.toggle('contestlive-hud-toggle-off', !on);
            setHudAriaHidden(hudMast, on);
        }
        if (name === 'bottom' && hudBottom) {
            hudBottom.classList.toggle('contestlive-hud-toggle-off', !on);
            setHudAriaHidden(hudBottom, on);
        }
        if (name === 'queuePanel' && hudQueueWrap) {
            hudQueueWrap.classList.toggle('contestlive-hud-toggle-off', !on);
            setHudAriaHidden(hudQueueWrap, on);
        }
        if (name === 'acPanel' && hudAcWrap) {
            hudAcWrap.classList.toggle('contestlive-hud-toggle-off', !on);
            setHudAriaHidden(hudAcWrap, on);
        }
        if (name === 'probStatsPanel' && hudProbStatsWrap) {
            hudProbStatsWrap.classList.toggle('contestlive-hud-toggle-off', !on);
            setHudAriaHidden(hudProbStatsWrap, on);
        }
    }

    /** @type {Object.<string, boolean>|null} */
    const togglesHud = isHud ? {
        leftCol: readToggle('leftCol', true),
        rank: readToggle('rank', true),
        masthead: readToggle('masthead', true),
        bottom: readToggle('bottom', true),
        queuePanel: readToggle('queuePanel', true),
        acPanel: readToggle('acPanel', true),
        probStatsPanel: readToggle('probStatsPanel', true),
    } : null;

    if (isHud && togglesHud) {
        Object.keys(togglesHud).forEach(function (k) {
            applyHudLayer(k, togglesHud[k]);
        });
    }
    if (isHud && hudRoot) {
        window.requestAnimationFrame(function () {
            window.requestAnimationFrame(function () {
                hudRoot.classList.remove('contestlive-hud--toggle-prime');
            });
        });
    }

    function tickClock() {
        if (!clockEl) {
            return;
        }
        const now = new Date();
        function z2(x) {
            const n = String(x);
            return n.length >= 2 ? n : '0' + n;
        }
        clockEl.textContent = z2(now.getHours()) + ':' + z2(now.getMinutes()) + ':' + z2(now.getSeconds());
    }

    function appendBrandLogoTo(parentEl, src) {
        if (!parentEl || !src) {
            return;
        }
        const wrap = document.createElement('div');
        wrap.className = 'contestlive-brand-strip__item';
        const img = document.createElement('img');
        img.src = src;
        img.alt = '';
        img.decoding = 'async';
        img.loading = 'eager';
        wrap.appendChild(img);
        parentEl.appendChild(wrap);
    }

    function ensureHudPlainSnapshot(el) {
        if (!el || !el.dataset) {
            return '';
        }
        if (el.dataset.hudPlainSnapshot !== undefined) {
            return el.dataset.hudPlainSnapshot;
        }
        const fromPlain = el.getAttribute('data-csg-mq-plain');
        if (fromPlain != null && fromPlain !== '') {
            el.dataset.hudPlainSnapshot = fromPlain;
            return fromPlain;
        }
        const fromAttr = el.getAttribute('data-csg-mq-raw');
        if (fromAttr != null && fromAttr !== '') {
            el.dataset.hudPlainSnapshot = fromAttr;
            return fromAttr;
        }
        const inner = el.querySelector('.csg-mq-slot__inner');
        const s = (inner ? inner.textContent : el.textContent || '').trim();
        el.dataset.hudPlainSnapshot = s;
        return s;
    }

    let mastheadMqLayoutSig = '';

    function mastheadMqLayoutSignature() {
        const parts = [];
        const titleSlot = document.getElementById('contestlive_hud_title_slot');
        if (titleSlot) {
            parts.push('t:' + (titleSlot.clientWidth | 0) + ':' + ensureHudPlainSnapshot(titleSlot));
        }
        const subSlot = document.getElementById('contestlive_hud_subtitle_slot');
        if (subSlot) {
            parts.push('s:' + (subSlot.clientWidth | 0) + ':' + ensureHudPlainSnapshot(subSlot));
        }
        return parts.join('|');
    }

    function refreshHudTitleMarquees(force) {
        if (!isHud || !hudRoot || !hudMast) {
            return;
        }
        const M = window.CsgMarqueePlain;
        if (!M || typeof M.applyHudMastheadHeadlines !== 'function') {
            return;
        }
        const sig = mastheadMqLayoutSignature();
        const titleSlot = document.getElementById('contestlive_hud_title_slot');
        if (
            !force &&
            sig === mastheadMqLayoutSig &&
            titleSlot &&
            titleSlot.getAttribute('data-csg-mq-inter') === '1' &&
            titleSlot.querySelector('.csg-mq-inter-track')
        ) {
            return;
        }
        mastheadMqLayoutSig = sig;
        const entries = [];
        if (titleSlot) {
            entries.push({ el: titleSlot, raw: ensureHudPlainSnapshot(titleSlot) });
        }
        const subSlot = document.getElementById('contestlive_hud_subtitle_slot');
        if (subSlot) {
            entries.push({ el: subSlot, raw: ensureHudPlainSnapshot(subSlot) });
        }
        M.applyHudMastheadHeadlines(hudMast, entries, {
            overflowSlackRatio: 0.02,
            onHostsResize: function () {
                refreshHudTitleMarquees(false);
            }
        });
    }

    function renderBranding() {
        if (!brandRow) {
            return;
        }
        const base = (window.CONTEST_LIVE_BRAND_BASE || '').replace(/\/+$/, '');
        let man = window.CONTEST_LIVE_MANIFEST_INIT;
        if (typeof man === 'string') {
            try {
                man = JSON.parse(man);
            } catch (e) {
                man = { logos: [] };
            }
        }
        if (!man || !Array.isArray(man.logos)) {
            man = { logos: [] };
        }
        const L = window.CsgContestliveBrandLayout;
        const lay = L && typeof L.computeHudLayoutFromLogos === 'function' ? L.computeHudLayoutFromLogos(man.logos) : {};
        const brandSig = base + '\n' + JSON.stringify(man.logos) + '\n' + JSON.stringify(lay);
        if (brandSig === window.__contestliveHudBrandSig && brandRow.children.length > 0) {
            return;
        }
        window.__contestliveHudBrandSig = brandSig;
        if (mastheadRow) {
            mastheadRow.setAttribute('data-brand-title-below', lay.title_below ? '1' : '0');
            mastheadRow.setAttribute('data-brand-compact', lay.compact ? '1' : '0');
        }
        brandRow.innerHTML = '';
        brandRow.classList.remove('contestlive-hud__logos--brick-rows');
        let built = false;
        if (base) {
            const entries = [];
            man.logos.forEach(function (row) {
                const f = row && row.f ? String(row.f) : '';
                if (!f || f.indexOf('..') >= 0) {
                    return;
                }
                entries.push(base + '/' + encodeURI(f.split('/').pop()));
            });
            if (lay.compact && lay.fits_ok && entries.length > 0) {
                brandRow.classList.add('contestlive-hud__logos--brick-rows');
                const si = lay.brick_split_index | 0;
                const inset = lay.brick_row2_inset_px | 0;
                const rowTop = document.createElement('div');
                rowTop.className = 'contestlive-hud__brand-row';
                let idx;
                for (idx = 0; idx < si && idx < entries.length; idx++) {
                    appendBrandLogoTo(rowTop, entries[idx]);
                }
                brandRow.appendChild(rowTop);
                if (idx < entries.length) {
                    const rowBot = document.createElement('div');
                    rowBot.className = 'contestlive-hud__brand-row contestlive-hud__brand-row--brick-shift';
                    if (inset > 0) {
                        rowBot.style.paddingInlineStart = inset + 'px';
                    }
                    for (; idx < entries.length; idx++) {
                        appendBrandLogoTo(rowBot, entries[idx]);
                    }
                    brandRow.appendChild(rowBot);
                }
            } else if (entries.length) {
                entries.forEach(function (u) {
                    appendBrandLogoTo(brandRow, u);
                });
            }
        }
        if (isHud && brandRow.children.length === 0) {
            appendBrandLogoTo(brandRow, '/static/image/logos/ccpc.webp');
        }
        refreshHudTitleMarquees();
    }

    async function refreshBrandingFromServer() {
        const qs = { cid: cid };
        if (window.CONTEST_LIVE_LVTK) {
            qs.lvtk = window.CONTEST_LIVE_LVTK;
        }
        try {
            const ret = await csg.ajax('GET', '/ojtool/contestlive/live_branding_manifest_ajax', qs, {}, 'json');
            if (ret && parseInt(ret.code, 10) === 1 && ret.data && Array.isArray(ret.data.logos)) {
                window.CONTEST_LIVE_MANIFEST_INIT = ret.data;
                window.__contestliveHudBrandSig = '';
                renderBranding();
            }
        } catch (e) {
            console.error(e);
        }
    }

    function flipHud(name) {
        if (!togglesHud) {
            return;
        }
        togglesHud[name] = !togglesHud[name];
        writeToggle(name, togglesHud[name]);
        applyHudLayer(name, togglesHud[name]);
    }

    csg.docready(function () {
        if (clockEl) {
            tickClock();
            setInterval(tickClock, 1000);
        }
        renderBranding();
        setInterval(refreshBrandingFromServer, 15000);

        if (isHud) {
            var mqResizeTimer = null;
            window.addEventListener('resize', function () {
                if (mqResizeTimer) {
                    window.clearTimeout(mqResizeTimer);
                }
                mqResizeTimer = window.setTimeout(function () {
                    mqResizeTimer = null;
                    refreshHudTitleMarquees(false);
                }, 160);
            });
        }

        document.querySelectorAll('.contestlive-hud__tablewrap').forEach(function (el) {
            el.setAttribute('tabindex', '0');
        });

        document.addEventListener('keydown', function (ev) {
            if (!ev || ev.ctrlKey || ev.metaKey || ev.altKey) {
                return;
            }
            const t = ev.target && ev.target.tagName;
            if (t === 'INPUT' || t === 'TEXTAREA' || t === 'SELECT') {
                return;
            }
            const k = ev.key;
            if (!isHud) {
                return;
            }
            if (k === '1') {
                flipHud('leftCol');
                ev.preventDefault();
            } else if (k === '2') {
                flipHud('rank');
                ev.preventDefault();
            } else if (k === '3') {
                flipHud('masthead');
                ev.preventDefault();
            } else if (k === '4') {
                flipHud('bottom');
                ev.preventDefault();
            } else if (k === '5') {
                flipHud('queuePanel');
                ev.preventDefault();
            } else if (k === '6') {
                flipHud('acPanel');
                ev.preventDefault();
            } else if (k === '7') {
                flipHud('probStatsPanel');
                ev.preventDefault();
            } else if (k === 'o' || k === 'O') {
                if (hudRoot) {
                    const cur = readOpacityStep();
                    const next = (cur + 1) % HUD_OPACITY_STEPS;
                    writeOpacityStep(next);
                    applyOpacityStep(next);
                }
                ev.preventDefault();
            }
        });
    });
})();
