/**
 * 综合 HUD 底栏：左侧短消息推送 + 右侧固定文案（与控台同源接口）。
 */
(function () {
    var ro = null;
    var layoutScheduled = false;

    function getCommandsAndFixed(ret) {
        var d = ret && ret.data;
        if (!d) {
            return { commands: [], fixed: '' };
        }
        if (Array.isArray(d)) {
            return { commands: d, fixed: '' };
        }
        var cmds = d.commands;
        if (!Array.isArray(cmds)) {
            cmds = [];
        }
        var fx = d.ticker_fixed != null ? String(d.ticker_fixed) : '';
        return { commands: cmds, fixed: fx };
    }

    function pickPushLine(commands) {
        var line = '';
        if (!Array.isArray(commands)) {
            return line;
        }
        for (var k = 0; k < commands.length; k++) {
            var row = commands[k];
            if (row && row.status !== 'revoked' && row.live_command && row.is_expired !== true) {
                line = String(row.live_command);
                break;
            }
        }
        return line;
    }

    function fixedFromWindowConfig() {
        try {
            var c = window.CONTEST_LIVE_DISPLAY_CONFIG;
            if (c && typeof c.ticker_fixed === 'string') {
                return c.ticker_fixed.replace(/\s+/g, ' ').trim();
            }
        } catch (e) {
            /* ignore */
        }
        return '';
    }

    /** ellipsis 下 scrollWidth 常贴近可视宽，需临时放开 overflow 再量 */
    function measureTextScrollWidth(el) {
        var o = el.style.overflow;
        var t = el.style.textOverflow;
        var mw = el.style.maxWidth;
        el.style.overflow = 'visible';
        el.style.textOverflow = 'clip';
        el.style.maxWidth = 'none';
        var w = el.scrollWidth;
        el.style.overflow = o;
        el.style.textOverflow = t;
        el.style.maxWidth = mw;
        return w;
    }

    function clearDualFlexStyles(pushWrap, pushInnerEl, fixedEl) {
        ['flex', 'flexGrow', 'flexShrink', 'flexBasis', 'maxWidth', 'minWidth', 'width'].forEach(function (k) {
            pushWrap.style[k] = '';
            fixedEl.style[k] = '';
        });
        pushInnerEl.style.maxWidth = '';
    }

    function layoutTickerDual(dualEl, pushInnerEl, fixedEl, sepEl) {
        if (!dualEl || !pushInnerEl || !fixedEl || !sepEl) {
            return;
        }
        var pushWrap = pushInnerEl.closest('.contestlive-hud__ticker-push');
        if (!pushWrap) {
            pushWrap = pushInnerEl.parentElement;
        }
        if (!pushWrap) {
            return;
        }

        var fixedText = (fixedEl.textContent || '').trim();
        if (!fixedText) {
            dualEl.classList.add('contestlive-hud__ticker-dual--solo');
            clearDualFlexStyles(pushWrap, pushInnerEl, fixedEl);
            pushWrap.style.flex = '1 1 auto';
            pushWrap.style.minWidth = '0';
            sepEl.style.display = '';
            return;
        }
        dualEl.classList.remove('contestlive-hud__ticker-dual--solo');
        sepEl.style.display = '';

        var gap = (sepEl.offsetWidth || 1) + 16;
        var W = dualEl.clientWidth;
        if (!W) {
            return;
        }

        clearDualFlexStyles(pushWrap, pushInnerEl, fixedEl);
        pushWrap.style.flex = '0 0 auto';
        pushWrap.style.maxWidth = 'none';
        pushWrap.style.minWidth = '0';
        fixedEl.style.flex = '0 0 auto';
        fixedEl.style.maxWidth = 'none';
        fixedEl.style.minWidth = '0';

        var pw = measureTextScrollWidth(pushInnerEl);
        var fw = measureTextScrollWidth(fixedEl);
        var total = pw + fw + gap;
        var inner = Math.max(0, W - gap);

        if (total <= W || inner < 8) {
            pushWrap.style.flex = '1 1 auto';
            pushWrap.style.minWidth = '0';
            fixedEl.style.flex = '0 0 auto';
            return;
        }

        var s = pw + fw;
        if (s < 1) {
            pushWrap.style.flex = '1 1 0';
            pushWrap.style.minWidth = '0';
            fixedEl.style.flex = '1 1 0';
            fixedEl.style.minWidth = '0';
            return;
        }

        /* 按内容宽度比例分配 flex 正空间，两侧均 min-width:0 以便在总宽不足时对称收缩，占满 ticker-dual */
        var g1 = Math.max(1, Math.round(1000 * (pw / s)));
        var g2 = Math.max(1, Math.round(1000 * (fw / s)));
        pushWrap.style.flex = g1 + ' 1 0px';
        pushWrap.style.minWidth = '0';
        fixedEl.style.flex = g2 + ' 1 0px';
        fixedEl.style.minWidth = '0';
    }

    function scheduleLayout(dualEl, pushInnerEl, fixedEl, sepEl) {
        if (layoutScheduled) {
            return;
        }
        layoutScheduled = true;
        requestAnimationFrame(function () {
            layoutScheduled = false;
            layoutTickerDual(dualEl, pushInnerEl, fixedEl, sepEl);
        });
    }

    function wireResize(dualEl, pushInnerEl, fixedEl, sepEl) {
        if (typeof ResizeObserver === 'undefined') {
            return;
        }
        if (ro) {
            try {
                ro.disconnect();
            } catch (e0) {
                /* ignore */
            }
            ro = null;
        }
        ro = new ResizeObserver(function () {
            scheduleLayout(dualEl, pushInnerEl, fixedEl, sepEl);
        });
        ro.observe(dualEl);
    }

    function poll(cid, pushInnerEl, fixedEl, sepEl, dualEl) {
        if (!pushInnerEl || !dualEl) {
            return;
        }
        var q = { cid: cid, _nc: Date.now() };
        if (window.CONTEST_LIVE_LVTK) {
            q.lvtk = String(window.CONTEST_LIVE_LVTK);
        }
        csg.ajax('GET', '/ojtool/contestlive/live_command_get_ajax', q, {}, 'json').then(function (ret) {
            if (!ret || parseInt(ret.code, 10) !== 1) {
                return;
            }
            var pack = getCommandsAndFixed(ret);
            var line = pickPushLine(pack.commands);
            if (line !== pushInnerEl.textContent) {
                pushInnerEl.textContent = line;
            }
            var fx = pack.fixed != null ? String(pack.fixed) : '';
            if (fx !== fixedEl.textContent) {
                fixedEl.textContent = fx;
            }
            try {
                if (window.CONTEST_LIVE_DISPLAY_CONFIG && typeof window.CONTEST_LIVE_DISPLAY_CONFIG === 'object') {
                    window.CONTEST_LIVE_DISPLAY_CONFIG.ticker_fixed = fx;
                }
            } catch (e1) {
                /* ignore */
            }
            scheduleLayout(dualEl, pushInnerEl, fixedEl, sepEl);
        }).catch(function (e) {
            console.error(e);
        });
    }

    csg.docready(function () {
        var cid = window.CONTEST_LIVE_CID;
        var pushInner = document.getElementById('contestlive_ticker_inner');
        var dual = document.getElementById('contestlive_ticker_dual');
        var fixed = document.getElementById('contestlive_ticker_fixed');
        var sep = document.getElementById('contestlive_ticker_sep');
        if (!cid || !pushInner || !dual) {
            return;
        }
        if (!fixed) {
            fixed = document.createElement('div');
            fixed.id = 'contestlive_ticker_fixed';
            fixed.className = 'contestlive-hud__ticker-fixed-slot';
            dual.appendChild(fixed);
        }
        if (!sep) {
            sep = document.createElement('div');
            sep.id = 'contestlive_ticker_sep';
            sep.className = 'contestlive-hud__ticker-sep';
            sep.setAttribute('aria-hidden', 'true');
            dual.insertBefore(sep, fixed);
        }
        var fx0 = fixedFromWindowConfig();
        if (fx0 && !fixed.textContent) {
            fixed.textContent = fx0;
        }
        wireResize(dual, pushInner, fixed, sep);
        document.addEventListener('contestlive-display-config-synced', function () {
            var f = fixedFromWindowConfig();
            if (f !== fixed.textContent) {
                fixed.textContent = f;
            }
            scheduleLayout(dual, pushInner, fixed, sep);
        });
        poll(cid, pushInner, fixed, sep, dual);
        setInterval(function () {
            poll(cid, pushInner, fixed, sep, dual);
        }, 1000);
    });
})();
