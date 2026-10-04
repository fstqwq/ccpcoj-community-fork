/**
 * 独立投屏页：快捷键 O、`?o=` / `?opacity_step=` 四档背板明暗（与主 HUD 语义一致）。
 * 须 `html.contestlive-page-opacity`；主直播 `live` 不加载本文件。
 */
(function () {
    var w = window;
    if (w.__CONTESTLIVE_PAGE_OPACITY_INIT) {
        return;
    }

    function pageId() {
        var sc = document.getElementById('contestlive-skin-boot');
        var p = (sc && sc.getAttribute('data-contestlive-page')) || w.CONTEST_LIVE_PAGE || '';
        return String(p).trim();
    }

    /** 仅主 HUD，由 contestlive_display.js 处理 O */
    if (pageId() === 'live') {
        return;
    }

    var elHtml = document.documentElement;
    if (!elHtml || !elHtml.classList || !elHtml.classList.contains('contestlive-page-opacity')) {
        return;
    }

    w.__CONTESTLIVE_PAGE_OPACITY_INIT = 1;

    var STEPS = 4;
    var DEFAULT_STEP = 1;

    function getCid() {
        var c = w.CONTEST_LIVE_CID;
        return parseInt(String(c != null ? c : '0'), 10) || 0;
    }

    function lsKey() {
        return 'contestlive_opacity_' + pageId() + '_' + (getCid() || '0');
    }

    function isTypingTarget(ev) {
        var t = ev && ev.target && ev.target.tagName;
        return t === 'INPUT' || t === 'TEXTAREA' || t === 'SELECT' || !!(ev.target && ev.target.isContentEditable);
    }

    function parseUrlStep() {
        try {
            var q = new URLSearchParams(w.location.search || '');
            var raw = q.get('o');
            if (raw == null || raw === '') {
                raw = q.get('opacity_step');
            }
            if (raw == null || raw === '') {
                return null;
            }
            var v = parseInt(String(raw), 10);
            if (!isFinite(v)) {
                return null;
            }
            if (v < 0 || v >= STEPS) {
                return null;
            }
            return v;
        } catch (e) {
            return null;
        }
    }

    function readStoredStep() {
        try {
            var raw = w.localStorage.getItem(lsKey());
            if (raw == null || raw === '') {
                return null;
            }
            var v = parseInt(String(raw), 10);
            if (!isFinite(v) || v < 0 || v >= STEPS) {
                return null;
            }
            return v;
        } catch (e) {
            return null;
        }
    }

    function writeStoredStep(s) {
        try {
            w.localStorage.setItem(lsKey(), String(s));
        } catch (e) {
            /* ignore */
        }
    }

    function applyOpacityStep(step) {
        var s =
            typeof step !== 'number' || !isFinite(step)
                ? DEFAULT_STEP
                : Math.max(0, Math.min(STEPS - 1, Math.floor(step)));
        elHtml.setAttribute('data-contestlive-page-opacity-step', String(s));
    }

    function resolveInitialStep() {
        var u = parseUrlStep();
        if (u !== null) {
            return u;
        }
        var st = readStoredStep();
        if (st !== null) {
            return st;
        }
        return DEFAULT_STEP;
    }

    var cur0 = resolveInitialStep();
    applyOpacityStep(cur0);
    if (parseUrlStep() !== null) {
        writeStoredStep(cur0);
    }

    document.addEventListener(
        'keydown',
        function (ev) {
            if (!ev || ev.ctrlKey || ev.metaKey || ev.altKey) {
                return;
            }
            if (isTypingTarget(ev)) {
                return;
            }
            var k = ev.key;
            if (k !== 'o' && k !== 'O') {
                return;
            }
            var cur = parseInt(String(elHtml.getAttribute('data-contestlive-page-opacity-step') || ''), 10);
            if (!isFinite(cur)) {
                cur = DEFAULT_STEP;
            }
            var next = (cur + 1) % STEPS;
            writeStoredStep(next);
            applyOpacityStep(next);
            ev.preventDefault();
            ev.stopPropagation();
        },
        true
    );

    /** `]` 换肤复位时由 contestlive_skin_hotkeys 调用：恢复档位 1 并写入 LS */
    w.ContestlivePageOpacityReset = function () {
        writeStoredStep(DEFAULT_STEP);
        applyOpacityStep(DEFAULT_STEP);
    };
})();
