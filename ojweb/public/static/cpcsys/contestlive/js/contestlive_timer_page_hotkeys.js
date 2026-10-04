/**
 * 比赛计时独立页 live_timer：
 * · H/S：标题与赛段状态显隐（写入 localStorage，按 cid）
 * · T：contestlive_contest_timer.js（计时套装切换，已持久化）
 * · - / =（及 +、小键盘）：七档相对 clamp 乘数，写入 localStorage；\ 恢复默认档并写入 0
 * · ]：由 contestlive_skin_hotkeys 触发本页 resetter，恢复外观 + 本页全部布局 store 默认值
 */
(function () {
    var w = window;
    if (typeof w.CONTEST_LIVE_PAGE !== 'string' || w.CONTEST_LIVE_PAGE !== 'live_timer') {
        return;
    }

    var CID = parseInt(String(w.CONTEST_LIVE_CID || 0), 10) || 0;
    var STORAGE_STEP = 'contestlive_timer_remain_step_' + CID;
    var STORAGE_TITLE = 'contestlive_timer_ui_title_' + CID;
    var STORAGE_STATE = 'contestlive_timer_ui_state_' + CID;
    var KEY_PACK = 'contestlive_timer_display_pack_' + CID;

    var STEP_TO_MUL = {
        '-3': '0.72',
        '-2': '0.82',
        '-1': '0.90',
        '1': '1.22',
        '2': '1.55',
        '3': '2.07',
    };

    function lsSet(k, v) {
        try {
            if (v === null || v === undefined || v === '') {
                w.localStorage.removeItem(k);
            } else {
                w.localStorage.setItem(k, String(v));
            }
        } catch (e) {
            /* ignore */
        }
    }

    function lsGet(k) {
        try {
            return w.localStorage.getItem(k);
        } catch (e) {
            return null;
        }
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

    function readStep() {
        var raw = lsGet(STORAGE_STEP);
        if (raw === null || raw === '') {
            return 0;
        }
        var n = parseInt(String(raw), 10);
        if (n >= -3 && n <= 3) {
            return n;
        }
        return 0;
    }

    /** 含 0 也写入，便于「]」后明确默认档在 store 中 */
    function writeStep(step) {
        lsSet(STORAGE_STEP, String(step));
    }

    function applyStep(step) {
        var root = document.getElementById('contestlive_display_root');
        if (!root) {
            return;
        }
        if (step === 0) {
            root.classList.remove('contestlive-timer-page--size-custom');
            root.style.removeProperty('--csg-live-remain-mul');
            root.style.removeProperty('--csg-live-remain-fs');
        } else {
            var mul = STEP_TO_MUL[String(step)];
            if (!mul) {
                return;
            }
            root.classList.add('contestlive-timer-page--size-custom');
            root.style.setProperty('--csg-live-remain-mul', mul);
        }
    }

    function bumpStep(delta) {
        var s = readStep();
        var next = Math.min(3, Math.max(-3, s + delta));
        if (next === s) {
            return;
        }
        writeStep(next);
        applyStep(next);
    }

    function resetStepOnly() {
        writeStep(0);
        applyStep(0);
    }

    /** '1' 显示标题 / 状态（对应 body 上的 contestlive-timer-ui-* class） */
    function readUiFlag(key) {
        return lsGet(key) === '1';
    }

    function writeUiFlag(key, on) {
        lsSet(key, on ? '1' : '0');
    }

    function applyTitleFromStore() {
        var b = document.body;
        if (!b) {
            return;
        }
        if (readUiFlag(STORAGE_TITLE)) {
            b.classList.add('contestlive-timer-ui-title');
        } else {
            b.classList.remove('contestlive-timer-ui-title');
        }
    }

    function applyStateFromStore() {
        var b = document.body;
        if (!b) {
            return;
        }
        if (readUiFlag(STORAGE_STATE)) {
            b.classList.add('contestlive-timer-ui-state');
        } else {
            b.classList.remove('contestlive-timer-ui-state');
        }
    }

    function syncTitleStoreFromDom() {
        var b = document.body;
        writeUiFlag(STORAGE_TITLE, !!(b && b.classList.contains('contestlive-timer-ui-title')));
    }

    function syncStateStoreFromDom() {
        var b = document.body;
        writeUiFlag(STORAGE_STATE, !!(b && b.classList.contains('contestlive-timer-ui-state')));
    }

    function resetAllToDefaultPersist() {
        if (typeof w.ContestliveTimerLayoutStoreResetForCid === 'function') {
            w.ContestliveTimerLayoutStoreResetForCid(CID);
        } else {
            writeUiFlag(STORAGE_TITLE, false);
            writeUiFlag(STORAGE_STATE, false);
            writeStep(0);
            lsSet(KEY_PACK, '0');
        }
        applyTitleFromStore();
        applyStateFromStore();
        applyStep(0);
        if (w.ContestliveContestTimer && typeof w.ContestliveContestTimer.refresh === 'function') {
            w.ContestliveContestTimer.refresh();
        }
    }

    w.ContestlivePageLayoutResetters = w.ContestlivePageLayoutResetters || {};
    w.ContestlivePageLayoutResetters.live_timer = resetAllToDefaultPersist;

    csg.docready(function () {
        if (!lsGet(STORAGE_TITLE)) {
            lsSet(STORAGE_TITLE, '0');
        }
        if (!lsGet(STORAGE_STATE)) {
            lsSet(STORAGE_STATE, '0');
        }
        applyTitleFromStore();
        applyStateFromStore();
        applyStep(readStep());
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
            var k = ev.key;
            if (k === 'h' || k === 'H' || k === 's' || k === 'S') {
                ev.preventDefault();
                ev.stopPropagation();
                var b = document.body;
                if (k === 'h' || k === 'H') {
                    b.classList.toggle('contestlive-timer-ui-title');
                    syncTitleStoreFromDom();
                } else {
                    b.classList.toggle('contestlive-timer-ui-state');
                    syncStateStoreFromDom();
                }
                return;
            }
            if (k === '-' || k === 'Minus' || k === 'NumpadSubtract') {
                ev.preventDefault();
                ev.stopPropagation();
                bumpStep(-1);
                return;
            }
            if (k === '=' || k === '+' || k === 'NumpadAdd' || k === 'Equal') {
                ev.preventDefault();
                ev.stopPropagation();
                bumpStep(1);
                return;
            }
            if (k === '\\') {
                ev.preventDefault();
                ev.stopPropagation();
                resetStepOnly();
            }
        },
        true
    );
})();
