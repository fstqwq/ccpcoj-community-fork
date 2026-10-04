/**
 * 投屏「队列 + 过题 + 气球」合页 live_combo：
 * 5 / 6 / 7 与综合 HUD 一致：评测队列区、最新过题区、气球叠层显隐（本页无各题统计故 7 用于气球）；
 * D 试播气球；新 AC 出现时自动飘气球（由 contestlive-ac-new-solutions 触发）。
 */
(function () {
    var w = window;
    if (typeof w.CONTEST_LIVE_PAGE !== 'string' || w.CONTEST_LIVE_PAGE !== 'live_combo') {
        return;
    }

    var ROOT = document.getElementById('contestlive_combo_root');
    var FX = w.ContestliveBalloonFx;

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

    function toggleClass(name) {
        if (!ROOT) {
            return;
        }
        ROOT.classList.toggle(name);
    }

    function resetComboLayout() {
        if (ROOT) {
            ROOT.classList.remove(
                'contestlive-combo-page--hide-queue',
                'contestlive-combo-page--hide-ac',
                'contestlive-combo-page--hide-balloons'
            );
        }
        if (FX && typeof FX.clearHost === 'function') {
            FX.clearHost({});
        }
        try {
            document.dispatchEvent(new Event('contestlive-standalone-time-reset'));
        } catch (e1) {
            /* ignore */
        }
        try {
            document.dispatchEvent(new Event('contestlive-queue-layout-reset'));
        } catch (e2) {
            /* ignore */
        }
    }

    w.ContestlivePageLayoutResetters = w.ContestlivePageLayoutResetters || {};
    w.ContestlivePageLayoutResetters.live_combo = resetComboLayout;

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
            if (k === '5') {
                ev.preventDefault();
                ev.stopPropagation();
                toggleClass('contestlive-combo-page--hide-queue');
                return;
            }
            if (k === '6') {
                ev.preventDefault();
                ev.stopPropagation();
                toggleClass('contestlive-combo-page--hide-ac');
                return;
            }
            if (k === '7') {
                ev.preventDefault();
                ev.stopPropagation();
                toggleClass('contestlive-combo-page--hide-balloons');
                return;
            }
            if (k === 'd' || k === 'D') {
                if (!FX || typeof FX.spawnBurst !== 'function') {
                    return;
                }
                ev.preventDefault();
                ev.stopPropagation();
                FX.spawnBurst({});
                return;
            }
        },
        true
    );

    document.addEventListener('contestlive-ac-new-solutions', function (e) {
        if (!FX || typeof FX.spawnBurst !== 'function') {
            return;
        }
        if (ROOT && ROOT.classList.contains('contestlive-combo-page--hide-balloons')) {
            return;
        }
        var d = e && e.detail;
        var n = 10;
        if (d && Array.isArray(d.sids)) {
            n = Math.min(28, 6 + d.sids.length * 4);
        }
        FX.spawnBurst({ n: n });
    });
})();
