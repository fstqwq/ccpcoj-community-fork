/**
 * 投屏页：布局算法临时快捷键（与换肤 [`] / `]` 并列约定）。
 * `,` 按本页注册顺序循环切换布局（仅写 localStorage 临时覆盖，不写服务器）。
 * `.` 从服务器拉取当前 live_display，清除本页布局临时覆盖并按 contest.addition.live_display 恢复。
 * 当前仅校徽墙 live_schoolwall 注册；其它页面若有布局算法可复用同一键位与 ContestliveSchoolwallLayout.HOTKEY_KEY 命名模式。
 * 依赖：contestlive_schoolwall_layouts.js、contestlive_schoolwall.js（提供 __contestliveSchoolwallRelayout）
 */
(function (w) {
    var L = w.ContestliveSchoolwallLayout;
    if (!L || !L.ORDER || !L.HOTKEY_KEY) {
        return;
    }

    function isTypingTarget(el) {
        if (!el || !el.tagName) {
            return false;
        }
        var t = el.tagName;
        if (t === 'INPUT' || t === 'TEXTAREA' || t === 'SELECT') {
            return true;
        }
        if (el.isContentEditable) {
            return true;
        }
        return false;
    }

    function pageId() {
        return typeof w.CONTEST_LIVE_PAGE === 'string' ? w.CONTEST_LIVE_PAGE : '';
    }

    function clearLayoutOverrideAndRelayout() {
        try {
            w.localStorage.removeItem(L.HOTKEY_KEY);
        } catch (e1) {
            /* ignore */
        }
        if (typeof w.__contestliveSchoolwallRelayout === 'function') {
            w.__contestliveSchoolwallRelayout();
        }
    }

    function pullServerLayoutAndApply() {
        var skinLib = w.ContestliveSkinLib;
        if (skinLib && typeof skinLib.pullLiveDisplayConfigFromServerThenApply === 'function') {
            return skinLib.pullLiveDisplayConfigFromServerThenApply().then(function (res) {
                if (!res || !res.cfg) {
                    clearLayoutOverrideAndRelayout();
                }
                return res;
            }).catch(function () {
                clearLayoutOverrideAndRelayout();
                return null;
            });
        }
        clearLayoutOverrideAndRelayout();
        return Promise.resolve(null);
    }

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
            if (k !== ',' && k !== '.') {
                return;
            }
            if (pageId() !== 'live_schoolwall') {
                return;
            }
            ev.preventDefault();
            ev.stopPropagation();
            if (k === ',') {
                var cur = L.resolveLiveSchoolwall();
                var order = L.ORDER;
                var idx = order.indexOf(cur);
                if (idx < 0) {
                    idx = 0;
                }
                var next = order[(idx + 1) % order.length];
                try {
                    w.localStorage.setItem(L.HOTKEY_KEY, next);
                } catch (e0) {
                    /* ignore */
                }
            } else {
                pullServerLayoutAndApply();
                return;
            }
            clearLayoutOverrideAndRelayout();
        },
        true
    );

    w.ContestlivePageLayoutResetters = w.ContestlivePageLayoutResetters || {};
    w.ContestlivePageLayoutResetters.live_schoolwall = function () {
        clearLayoutOverrideAndRelayout();
    };
})(window);
