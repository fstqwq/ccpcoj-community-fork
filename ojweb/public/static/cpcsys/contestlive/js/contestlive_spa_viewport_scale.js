/**
 * 投屏单页统一视口字号体系：`<html class="contestlive-spa-html">` + `--contestlive-spa-html-mul`，
 * vmin 基底与旧 `live_rank`（原 contestlive_rank_live_ui_scale.js）一致；按比赛 cid 写 localStorage。
 * − / + / =（及小键盘 ±）缩放，\ 恢复默认；与 `]` 换肤恢复联动（见 contestlive_skin_hotkeys.js）。
 *
 * @see contestlive.css 中 html.contestlive-spa-html
 */
(function () {
    var w = window;
    if (w.__CONTESTLIVE_SPA_HTML_SCALE_INIT) {
        return;
    }
    w.__CONTESTLIVE_SPA_HTML_SCALE_INIT = 1;

    var LS_UNIFIED = 'contestlive_spa_html_mul_';
    /** 旧键：曾为 live_rank 专用，首次读统一到新房 */
    var LS_LEGACY_RANK = 'contestlive_rank_live_html_mul_';
    var DEFAULT_MUL = 1.18;
    var MIN_MUL = 0.72;
    var MAX_MUL = 1.72;
    var STEP = 0.92;
    var DOC = document;
    var HTML = DOC.documentElement;

    function getCid() {
        var c = w.CONTEST_LIVE_CID;
        return parseInt(String(c != null ? c : '0'), 10) || 0;
    }

    function lsUnifiedKey() {
        return LS_UNIFIED + (getCid() || '0');
    }

    function lsLegacyRankKey() {
        return LS_LEGACY_RANK + (getCid() || '0');
    }

    function isTypingTarget(el) {
        if (!el || !el.tagName) {
            return false;
        }
        var t = el.tagName;
        if (t === 'INPUT' || t === 'TEXTAREA' || t === 'SELECT') {
            return true;
        }
        return !!el.isContentEditable;
    }

    function clampNum(n, a, b) {
        return Math.max(a, Math.min(b, n));
    }

    function readStoredUnified() {
        try {
            var raw = w.localStorage.getItem(lsUnifiedKey());
            if (raw == null || raw === '') {
                return null;
            }
            var v = parseFloat(raw);
            return isFinite(v) ? clampNum(v, MIN_MUL, MAX_MUL) : null;
        } catch (e) {
            return null;
        }
    }

    function readStoredLegacyRank() {
        try {
            var raw = w.localStorage.getItem(lsLegacyRankKey());
            if (raw == null || raw === '') {
                return null;
            }
            var v = parseFloat(raw);
            return isFinite(v) ? clampNum(v, MIN_MUL, MAX_MUL) : null;
        } catch (e) {
            return null;
        }
    }

    function writeStoredUnified(v) {
        try {
            w.localStorage.setItem(lsUnifiedKey(), String(clampNum(v, MIN_MUL, MAX_MUL)));
        } catch (e) {
            /* ignore */
        }
    }

    function isSpaHtmlPage() {
        return HTML && HTML.classList && HTML.classList.contains('contestlive-spa-html');
    }

    function applyMul(mul) {
        if (!isSpaHtmlPage()) {
            return;
        }
        var m = clampNum(typeof mul === 'number' ? mul : DEFAULT_MUL, MIN_MUL, MAX_MUL);
        HTML.style.setProperty('--contestlive-spa-html-mul', String(m));
    }

    function resolveInitialMul() {
        var u = readStoredUnified();
        if (u != null) {
            return u;
        }
        var leg = readStoredLegacyRank();
        return leg != null ? leg : null;
    }

    function initFromStorage() {
        if (!isSpaHtmlPage()) {
            return;
        }
        var s = resolveInitialMul();
        applyMul(s != null ? s : DEFAULT_MUL);
    }

    function persistAndApply(mul) {
        if (!isSpaHtmlPage()) {
            return;
        }
        var m = clampNum(mul, MIN_MUL, MAX_MUL);
        writeStoredUnified(m);
        applyMul(m);
    }

    function bump(dir) {
        var cur = readStoredUnified();
        if (cur == null) {
            cur = readStoredLegacyRank();
        }
        if (cur == null) {
            cur = DEFAULT_MUL;
        }
        var next = dir > 0 ? cur / STEP : cur * STEP;
        persistAndApply(next);
    }

    function resetDefault() {
        if (!isSpaHtmlPage()) {
            return;
        }
        try {
            w.localStorage.removeItem(lsUnifiedKey());
            w.localStorage.removeItem(lsLegacyRankKey());
        } catch (e) {
            /* ignore */
        }
        applyMul(DEFAULT_MUL);
    }

    w.ContestliveSpaViewportScaleReset = resetDefault;
    /** @deprecated 与 ContestliveSpaViewportScaleReset 相同，兼容旧脚本名 */
    w.ContestliveRankLiveUiScaleReset = resetDefault;

    initFromStorage();

    DOC.addEventListener(
        'keydown',
        function (ev) {
            if (!isSpaHtmlPage()) {
                return;
            }
            if (!ev || ev.ctrlKey || ev.metaKey || ev.altKey) {
                return;
            }
            if (isTypingTarget(ev.target)) {
                return;
            }
            var code = ev.code;
            var k = ev.key;
            var zoomOut = k === '-' || code === 'Minus' || code === 'NumpadSubtract';
            var zoomIn =
                k === '=' || k === '+' || code === 'Equal' || code === 'NumpadAdd';
            var resetKey = k === '\\' || code === 'Backslash' || code === 'IntlBackslash';
            if (!zoomOut && !zoomIn && !resetKey) {
                return;
            }
            ev.preventDefault();
            ev.stopPropagation();
            if (resetKey) {
                resetDefault();
                return;
            }
            if (zoomIn) {
                bump(1);
            } else {
                bump(-1);
            }
        },
        true
    );
})();
