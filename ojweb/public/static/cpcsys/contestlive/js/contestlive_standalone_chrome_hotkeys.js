/**
 * 小组件独立投屏页：默认隐藏页内顶栏（比赛名条），按 H 显示/再按隐藏。
 * 适用页由 CONTEST_LIVE_PAGE 白名单控制；须在 body 上默认带 class contestlive-hero-hidden。
 * H 状态写入 localStorage（按页 + cid）；「]」恢复外观时由 ContestlivePageLayoutResetters 一并恢复默认顶栏并写回 store。
 * 顶栏主标题与综合 HUD 同源：csg_marquee_plain · applyHudMastheadHeadlines（applyMastheadHeadlineSlot 单遍布局）。
 */
(function () {
    var w = window;
    var PAGES = {
        live_probstats: true,
        live_ac: true,
        live_queue: true,
    };

    function pageId() {
        return typeof w.CONTEST_LIVE_PAGE === 'string' ? w.CONTEST_LIVE_PAGE : '';
    }

    function cid() {
        return parseInt(String(w.CONTEST_LIVE_CID || 0), 10) || 0;
    }

    function storageKey() {
        return 'contestlive_standalone_hero_' + pageId() + '_' + cid();
    }

    /** '1' = 顶栏隐藏（默认），'0' = 顶栏显示 */
    function readHidden() {
        try {
            var v = w.localStorage.getItem(storageKey());
            if (v === '0') {
                return false;
            }
        } catch (e) {
            /* ignore */
        }
        return true;
    }

    function writeHidden(hidden) {
        try {
            w.localStorage.setItem(storageKey(), hidden ? '1' : '0');
        } catch (e) {
            /* ignore */
        }
    }

    function stopStandaloneHeroMarquee() {
        var hero = document.querySelector('header.contestlive-standalone-hero');
        var M = w.CsgMarqueePlain;
        if (hero && M && typeof M.stopIntermittentMarqueeGroup === 'function') {
            try {
                M.stopIntermittentMarqueeGroup(hero);
            } catch (e0) {
                /* ignore */
            }
        }
    }

    /** 仅在顶栏可见时刷新（HUD 同源间歇跑马灯） */
    function refreshStandaloneHeroMarquee() {
        var hero = document.querySelector('header.contestlive-standalone-hero');
        var slot = document.getElementById('contestlive_standalone_title_slot');
        var M = w.CsgMarqueePlain;
        if (!hero || !slot || !M || typeof M.applyHudMastheadHeadlines !== 'function') {
            return;
        }
        var b = document.body;
        if (b && b.classList && b.classList.contains('contestlive-hero-hidden')) {
            stopStandaloneHeroMarquee();
            return;
        }
        var fromPlain = slot.getAttribute('data-csg-mq-plain');
        var raw =
            fromPlain != null && String(fromPlain).trim() !== ''
                ? String(fromPlain).trim()
                : (function () {
                      var inner = slot.querySelector('.csg-mq-slot__inner');
                      return inner ? String(inner.textContent || '').trim() : String(slot.textContent || '').trim();
                  })();
        if (!raw) {
            return;
        }
        M.applyHudMastheadHeadlines(hero, [{ el: slot, raw: raw }], {
            overflowSlackRatio: 0.02,
            onHostsResize: function () {
                refreshStandaloneHeroMarquee();
            },
        });
    }

    function applyFromStore() {
        var bd = document.body;
        if (!bd || !PAGES[pageId()]) {
            return;
        }
        if (readHidden()) {
            bd.classList.add('contestlive-hero-hidden');
            stopStandaloneHeroMarquee();
        } else {
            bd.classList.remove('contestlive-hero-hidden');
        }
    }

    function isTypingTarget(el) {
        if (!el || !el.tagName) {
            return false;
        }
        var t = el.tagName;
        if (t === 'INPUT' || t === 'TEXTAREA') {
            return true;
        }
        if (el.isContentEditable) {
            return true;
        }
        return false;
    }

    function resetHeroDefaultPersist() {
        writeHidden(true);
        stopStandaloneHeroMarquee();
        var b = document.body;
        if (b) {
            b.classList.add('contestlive-hero-hidden');
        }
        if (pageId() === 'live_ac') {
            try {
                document.dispatchEvent(new Event('contestlive-standalone-time-reset'));
            } catch (e1) {
                /* ignore */
            }
        }
    }

    if (PAGES[pageId()]) {
        w.ContestlivePageLayoutResetters = w.ContestlivePageLayoutResetters || {};
        w.ContestlivePageLayoutResetters[pageId()] = resetHeroDefaultPersist;
    }

    csg.docready(function () {
        if (!PAGES[pageId()]) {
            return;
        }
        if (w.localStorage.getItem(storageKey()) === null) {
            writeHidden(true);
        }
        applyFromStore();
        if (!readHidden()) {
            w.requestAnimationFrame(function () {
                w.requestAnimationFrame(refreshStandaloneHeroMarquee);
            });
        }
    });

    document.addEventListener(
        'keydown',
        function (ev) {
            if (!ev || ev.ctrlKey || ev.metaKey || ev.altKey) {
                return;
            }
            if (isTypingTarget(ev.target)) {
                return;
            }
            if (!PAGES[pageId()]) {
                return;
            }
            if (ev.key !== 'h' && ev.key !== 'H') {
                return;
            }
            ev.preventDefault();
            ev.stopPropagation();
            var b = document.body;
            b.classList.toggle('contestlive-hero-hidden');
            var hid = b.classList.contains('contestlive-hero-hidden');
            writeHidden(hid);
            if (hid) {
                stopStandaloneHeroMarquee();
            } else {
                w.requestAnimationFrame(function () {
                    w.requestAnimationFrame(refreshStandaloneHeroMarquee);
                });
            }
        },
        true
    );
})();
