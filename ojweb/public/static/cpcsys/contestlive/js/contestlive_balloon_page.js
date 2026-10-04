/**
 * 投屏气球动效：导出 ContestliveBalloonFx（live_balloon / live_combo 共用）。
 * 运动：单 RAF 批量更新（与滚榜「整批同一帧写 transform」思路一致，不依赖 csg_anim.js），
 * 高初速竖直速度 + 逐颗随机加速度；横向正弦缓摆 + splay 斜坡；底边与左右更错落。
 */
(function () {
    var w = window;
    var PAGE = typeof w.CONTEST_LIVE_PAGE === 'string' ? w.CONTEST_LIVE_PAGE : '';
    var FX_HOST_ID = typeof w.CONTEST_LIVE_BALLOON_FX_HOST_ID === 'string' ? w.CONTEST_LIVE_BALLOON_FX_HOST_ID : 'contestlive_balloon_fx_host';

    var CID = parseInt(String(w.CONTEST_LIVE_CID || 0), 10) || 0;
    var STORAGE_CHROME = 'contestlive_balloon_chrome_' + CID;
    var ROOT_ID = 'contestlive_balloon_root';

    var FLAT_BALLOON_COLORS = [
        '#e53935',
        '#d81b60',
        '#8e24aa',
        '#5e35b1',
        '#3949ab',
        '#1e88e5',
        '#039be5',
        '#00acc1',
        '#00897b',
        '#43a047',
        '#7cb342',
        '#c0ca33',
        '#fdd835',
        '#ffb300',
        '#fb8c00',
        '#f4511e',
        '#6d4c41',
        '#546e7a',
    ];

    var BALLOON_PATH_D =
        'M50 12 C28 12 10 32 10 58 C10 84 30 104 50 110 C70 104 90 84 90 58 C90 32 72 12 50 12 Z';

    function lsSet(k, v) {
        try {
            if (v === null || v === undefined) {
                return;
            }
            w.localStorage.setItem(k, String(v));
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

    function rootEl() {
        return document.getElementById(ROOT_ID);
    }

    function resolveFxHost(hostOrId) {
        if (hostOrId && hostOrId.nodeType === 1) {
            return hostOrId;
        }
        var id = typeof hostOrId === 'string' && hostOrId ? hostOrId : FX_HOST_ID;
        return document.getElementById(id);
    }

    function readChromeOn() {
        return lsGet(STORAGE_CHROME) === '1';
    }

    function applyChromeFromStore() {
        var r = rootEl();
        if (!r) {
            return;
        }
        if (readChromeOn()) {
            r.classList.add('contestlive-balloon-page--chrome-on');
        } else {
            r.classList.remove('contestlive-balloon-page--chrome-on');
        }
    }

    function setChromeOn(on) {
        lsSet(STORAGE_CHROME, on ? '1' : '0');
        applyChromeFromStore();
    }

    function clearFxHost(hostOrId) {
        var h = resolveFxHost(hostOrId);
        if (!h) {
            return;
        }
        BalloonFxPhysics.purgeHost(h);
        h.classList.remove('contestlive-balloon-fx-host--physics');
        while (h.firstChild) {
            h.removeChild(h.firstChild);
        }
    }

    /** @returns {boolean} */
    function prefersBalloonReduceMotion() {
        try {
            return !!(w.matchMedia && w.matchMedia('(prefers-reduced-motion: reduce)').matches);
        } catch (e) {
            return false;
        }
    }

    /**
     * 单循环 RAF：同帧更新所有气球 transform/opacity。
     */
    var BalloonFxPhysics = (function () {
        /** @type {Array<Object>} */
        var items = [];
        var rafId = 0;
        var lastT = 0;

        function stopRafIfIdle() {
            if (!items.length && rafId) {
                try {
                    w.cancelAnimationFrame(rafId);
                } catch (e2) {
                    /* ignore */
                }
                rafId = 0;
                lastT = 0;
            }
        }

        function bump() {
            if (!rafId && items.length) {
                lastT = 0;
                rafId = w.requestAnimationFrame(tick);
            }
        }

        /**
         * @param {number} now
         */
        function tick(now) {
            rafId = 0;
            if (!items.length) {
                lastT = 0;
                return;
            }
            var dt = lastT ? Math.min(0.048, Math.max(0.001, (now - lastT) / 1000)) : 1 / 60;
            lastT = now;

            var i;
            var it;

            for (i = items.length - 1; i >= 0; i--) {
                it = items[i];
                if (!it || !it.unit || !it.lift || !it.cluster) {
                    items.splice(i, 1);
                    continue;
                }
                if (!it.unit.parentNode) {
                    items.splice(i, 1);
                    continue;
                }

                var elapsed = (now - it.t0Ms) / 1000;

                it.vy += it.ay * dt;
                if (it.vy < it.vyFloor) {
                    it.vy = it.vyFloor;
                }
                if (it.vyCap > 0 && it.vy > it.vyCap) {
                    it.vy = it.vyCap;
                }

                it.posY -= it.vy * dt;

                var splayFrac =
                    elapsed >= it.splayRampSec ? 1 : Math.max(0, Math.min(1, elapsed / it.splayRampSec));
                var splayPx = splayFrac * it.splayTargetPx;
                var wobX = Math.sin(elapsed * it.wobOmega + it.wobPhase) * it.wobAmpPx;
                var tx = wobX + splayPx;

                var tilt =
                    Math.sin(elapsed * it.tiltOmega + it.tiltPhase) * it.tiltDeg;

                var opIn = elapsed < it.fadeInSec ? Math.max(0, Math.min(1, elapsed / it.fadeInSec)) : 1;
                var travelled = -it.posY;
                var rem = it.travelKillPx - travelled;
                var opOut = rem >= it.fadeOutPx ? 1 : Math.max(0, rem / it.fadeOutPx);
                var op = opIn * opOut;

                it.lift.style.transform = 'translate3d(' + tx.toFixed(2) + 'px,' + it.posY.toFixed(2) + 'px,0)';
                it.lift.style.opacity = String(op);
                it.cluster.style.transform = 'rotate(' + tilt.toFixed(3) + 'deg)';

                if (it.posY <= -it.travelKillPx) {
                    if (it.unit.parentNode) {
                        it.unit.parentNode.removeChild(it.unit);
                    }
                    items.splice(i, 1);
                }
            }

            if (items.length) {
                rafId = w.requestAnimationFrame(tick);
            } else {
                lastT = 0;
            }
        }

        return {
            /**
             * @param {Object} state
             */
            add: function (state) {
                items.push(state);
                bump();
            },
            /**
             * @param {HTMLElement} host
             */
            purgeHost: function (host) {
                if (!host) {
                    return;
                }
                var k;
                for (k = items.length - 1; k >= 0; k--) {
                    if (items[k].host === host) {
                        var u = items[k].unit;
                        if (u && u.parentNode) {
                            u.parentNode.removeChild(u);
                        }
                        items.splice(k, 1);
                    }
                }
                stopRafIfIdle();
            },
        };
    })();

    function pickColor() {
        return FLAT_BALLOON_COLORS[Math.floor(Math.random() * FLAT_BALLOON_COLORS.length)];
    }

    function buildBalloonSvg(fill) {
        var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('class', 'contestlive-balloon-fx__silhouette');
        svg.setAttribute('viewBox', '0 0 100 116');
        svg.setAttribute('preserveAspectRatio', 'xMidYMin meet');
        var path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', BALLOON_PATH_D);
        path.setAttribute('fill', fill);
        path.setAttribute('class', 'contestlive-balloon-fx__balloon-path');
        svg.appendChild(path);
        return svg;
    }

    function buildStringSvg() {
        var wrap = document.createElement('div');
        wrap.className = 'contestlive-balloon-fx__string-wrap';
        wrap.setAttribute('aria-hidden', 'true');
        var upDur = (0.36 + Math.random() * 0.2).toFixed(2) + 's';
        var loDur = (0.3 + Math.random() * 0.18).toFixed(2) + 's';
        var loDelay = (Math.random() * 0.12).toFixed(2) + 's';
        wrap.style.setProperty('--csg-balloon-string-up-dur', upDur);
        wrap.style.setProperty('--csg-balloon-string-lo-dur', loDur);
        wrap.style.setProperty('--csg-balloon-string-lo-delay', loDelay);

        var ns = 'http://www.w3.org/2000/svg';
        var svg = document.createElementNS(ns, 'svg');
        svg.setAttribute('class', 'contestlive-balloon-fx__string-svg');
        svg.setAttribute('viewBox', '0 0 24 232');
        svg.setAttribute('preserveAspectRatio', 'xMidYMin meet');

        var rootT = document.createElementNS(ns, 'g');
        rootT.setAttribute('transform', 'translate(12, 6)');

        var upperRot = document.createElementNS(ns, 'g');
        upperRot.setAttribute('class', 'contestlive-balloon-fx__string-upper-rot');

        var pathU = document.createElementNS(ns, 'path');
        pathU.setAttribute('d', 'M0 0 C-0.55 24 0.55 46 0 64');
        pathU.setAttribute('fill', 'none');
        pathU.setAttribute('class', 'contestlive-balloon-fx__string-path contestlive-balloon-fx__string-path--upper');

        var jointG = document.createElementNS(ns, 'g');
        jointG.setAttribute('transform', 'translate(0, 64)');

        var lowerRot = document.createElementNS(ns, 'g');
        lowerRot.setAttribute('class', 'contestlive-balloon-fx__string-lower-rot');

        var pathL = document.createElementNS(ns, 'path');
        pathL.setAttribute('d', 'M0 0 C0.4 42 -0.35 96 0 148');
        pathL.setAttribute('fill', 'none');
        pathL.setAttribute('class', 'contestlive-balloon-fx__string-path contestlive-balloon-fx__string-path--lower');

        lowerRot.appendChild(pathL);
        jointG.appendChild(lowerRot);
        upperRot.appendChild(pathU);
        upperRot.appendChild(jointG);
        rootT.appendChild(upperRot);
        svg.appendChild(rootT);
        wrap.appendChild(svg);
        return wrap;
    }

    /**
     * @param {HTMLElement|null|undefined} hostOrId
     * @param {{ n?: number, batchDurSec?: number }} opts
     */
    function spawnBalloonBurstInto(hostOrId, opts) {
        var host = resolveFxHost(hostOrId);
        if (!host) {
            return;
        }
        opts = opts || {};
        host.classList.add('contestlive-balloon-fx-host--physics');

        var reduce = prefersBalloonReduceMotion();

        var n = typeof opts.n === 'number' && opts.n > 0 ? Math.floor(opts.n) : 18 + Math.floor(Math.random() * 12);
        var batchDurSec =
            typeof opts.batchDurSec === 'number' && opts.batchDurSec > 0
                ? opts.batchDurSec
                : 6.1 + Math.random() * 1.35;

        var vw = Math.max(w.innerWidth || 0, document.documentElement.clientWidth || 0);
        var vh = Math.max(w.innerHeight || 0, document.documentElement.clientHeight || 0);
        var hrLike = Math.max(vh, 720);

        var i;
        for (i = 0; i < n; i++) {
            (function () {
                var unit = document.createElement('div');
                unit.className = 'contestlive-balloon-fx__unit';
                unit.setAttribute('role', 'presentation');
                /* 横纵尽量铺满视口：left 为气球水平中心（translateX(-50%)），底边错落略扩大 */
                var leftPct = 2 + Math.random() * 96;
                unit.style.left = leftPct.toFixed(2) + '%';
                unit.style.transform = 'translateX(-50%)';
                var bottomPct = -(10 + Math.random() * 92);
                unit.style.bottom = bottomPct.toFixed(2) + '%';
                unit.style.zIndex = String(10 + Math.floor(Math.random() * 90));
                var sizeJitter = (0.9 + Math.random() * 0.34).toFixed(3);
                unit.style.setProperty('--csg-balloon-fx-size', sizeJitter);

                var lift = document.createElement('div');
                lift.className = 'contestlive-balloon-fx__lift';
                lift.style.transform = 'translate3d(0,0,0)';
                lift.style.opacity = '0';

                var cluster = document.createElement('div');
                cluster.className = 'contestlive-balloon-fx__cluster';
                cluster.style.transform = 'rotate(0deg)';

                var splay = document.createElement('div');
                splay.className = 'contestlive-balloon-fx__splay';
                splay.appendChild(buildBalloonSvg(pickColor()));
                splay.appendChild(buildStringSvg());
                cluster.appendChild(splay);

                lift.appendChild(cluster);
                unit.appendChild(lift);
                host.appendChild(unit);

                var rnd = Math.random();
                var centerT = (leftPct - 50) / 50;
                /* 像素级横向外飘目标，贴近原 vw keyframes 观感 */
                /* 靠边气球再略增强外飘，避免整体仍呈「朝中」观感 */
                var splayMul = reduce ? 0.055 : 0.098;
                var splayTargetPx =
                    centerT * vw * splayMul +
                    (Math.random() - 0.5) * (reduce ? 14 : 32) +
                    (Math.abs(centerT) > 0.55 ? (centerT > 0 ? 1 : -1) * vw * (reduce ? 0.018 : 0.028) : 0);

                var vyScale = reduce ? 0.52 : 1;
                var vy0 = hrLike * (0.95 + rnd * 0.65) * vyScale;
                /* 每颗不同的竖直加速度（可略为正或负），初速已大，无「从静止缓起」 */
                var ay = (-95 + Math.random() * 320) * (reduce ? 0.55 : 1);

                var travelKillPx = hrLike * (reduce ? 1.35 : 2.05 + Math.random() * 0.55) + 180;
                var fadeOutPx = Math.min(520, Math.max(160, hrLike * (reduce ? 0.2 : 0.33)));

                var splayRampSec = Math.max(1.2, batchDurSec * (0.78 + Math.random() * 0.28));

                BalloonFxPhysics.add({
                    host: host,
                    unit: unit,
                    lift: lift,
                    cluster: cluster,
                    t0Ms: w.performance && w.performance.now ? w.performance.now() : Date.now(),
                    posY: 0,
                    vy: vy0,
                    ay: ay,
                    vyFloor: reduce ? 120 : 220,
                    vyCap: reduce ? 2200 : 4200,
                    travelKillPx: travelKillPx,
                    fadeInSec: reduce ? 0.09 : 0.055,
                    fadeOutPx: fadeOutPx,
                    splayRampSec: splayRampSec,
                    splayTargetPx: splayTargetPx,
                    wobAmpPx: (14 + Math.random() * 36) * (reduce ? 0.45 : 1),
                    wobOmega: 0.85 + Math.random() * 2.6,
                    wobPhase: Math.random() * Math.PI * 2,
                    tiltDeg: (1.1 + Math.random() * 2.2) * (reduce ? 0.5 : 1),
                    tiltOmega: 0.55 + Math.random() * 1.9,
                    tiltPhase: Math.random() * Math.PI * 2,
                });
            })();
        }
    }

    w.ContestliveBalloonFx = {
        spawnBurst: function (opts) {
            opts = opts || {};
            spawnBalloonBurstInto(opts.host || opts.hostId, opts);
        },
        clearHost: function (opts) {
            clearFxHost((opts && (opts.host || opts.hostId)) || null);
        },
    };

    if (PAGE !== 'live_balloon') {
        return;
    }

    function spawnDebugBalloons() {
        spawnBalloonBurstInto(null, {});
    }

    function resetLayoutToDefault() {
        setChromeOn(false);
        clearFxHost(null);
    }

    w.ContestlivePageLayoutResetters = w.ContestlivePageLayoutResetters || {};
    w.ContestlivePageLayoutResetters.live_balloon = resetLayoutToDefault;

    csg.docready(function () {
        if (lsGet(STORAGE_CHROME) === null) {
            lsSet(STORAGE_CHROME, '0');
        }
        applyChromeFromStore();
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
            if (k === 'd' || k === 'D') {
                ev.preventDefault();
                ev.stopPropagation();
                spawnDebugBalloons();
                return;
            }
            if (k === 'i' || k === 'I') {
                ev.preventDefault();
                ev.stopPropagation();
                var r = rootEl();
                if (!r) {
                    return;
                }
                var next = !r.classList.contains('contestlive-balloon-page--chrome-on');
                setChromeOn(next);
            }
        },
        true
    );
})();
