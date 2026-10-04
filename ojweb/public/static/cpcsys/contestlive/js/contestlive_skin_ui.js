/**
 * 投屏页外观：三套皮肤 + 本页独立 / 全局 + 折叠 dock
 */
(function () {
    var SKINS = [
        { id: 'default', zh: '默认', en: 'Default' },
        { id: 'dark_stage', zh: '舞台暗色', en: 'Dark stage' },
        { id: 'light_macaron', zh: '马卡龙亮', en: 'Light' }
    ];
    var VALID = { default: true, dark_stage: true, light_macaron: true };
    var PAGE = typeof window.CONTEST_LIVE_PAGE === 'string' ? window.CONTEST_LIVE_PAGE : 'live';
    var GK = 'contestlive_skin_global';
    var PK = 'contestlive_skin_page_' + PAGE;
    var CK = 'contestlive_skin_dock_collapsed';

    function getSkin() {
        return document.documentElement.getAttribute('data-contestlive-skin') || 'default';
    }

    function setSkinAttr(s) {
        var v = VALID[s] ? s : 'default';
        document.documentElement.setAttribute('data-contestlive-skin', v);
        return v;
    }

    function readStore(k) {
        try {
            return window.localStorage.getItem(k);
        } catch (e) {
            return null;
        }
    }

    function writeStore(k, v) {
        try {
            if (v === null || v === '') {
                window.localStorage.removeItem(k);
            } else {
                window.localStorage.setItem(k, v);
            }
        } catch (e) { /* ignore */ }
    }

    function isIndependent() {
        return readStore(PK) !== null && readStore(PK) !== '';
    }

    function persistSkin(skin) {
        var inp = dockEl ? dockEl.querySelector('.contestlive-skin-dock__chk-input') : null;
        var ind = inp && inp.checked;
        if (ind) {
            writeStore(PK, skin);
        } else {
            writeStore(GK, skin);
            writeStore(PK, null);
        }
    }

    function clearAllPageOverrides() {
        var ids = window.ContestliveSkinLib && window.ContestliveSkinLib.DISPLAY_PAGE_IDS;
        if (ids && ids.length) {
            ids.forEach(function (p) {
                writeStore('contestlive_skin_page_' + p, null);
            });
            return;
        }
        [
            'live',
            'live_balloon',
            'live_schoolwall',
            'live_timer',
            'live_queue',
            'live_ac',
            'live_combo',
            'live_probstats',
            'live_rank',
        ].forEach(function (p) {
            writeStore('contestlive_skin_page_' + p, null);
        });
    }

    function buildDock() {
        var wrap = document.createElement('div');
        wrap.className = 'contestlive-skin-dock';
        wrap.setAttribute('role', 'region');
        wrap.setAttribute('aria-label', 'Contest live appearance');

        var collapsed = readStore(CK) === '1';
        if (collapsed) {
            wrap.classList.add('collapsed');
        }

        var toggle = document.createElement('button');
        toggle.type = 'button';
        toggle.className = 'contestlive-skin-dock__toggle';
        toggle.title = '外观 · Appearance';
        toggle.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
        toggle.innerHTML = '<i class="bi bi-palette-fill" aria-hidden="true"></i>';
        toggle.addEventListener('click', function () {
            wrap.classList.toggle('collapsed');
            var col = wrap.classList.contains('collapsed');
            toggle.setAttribute('aria-expanded', col ? 'false' : 'true');
            writeStore(CK, col ? '1' : '');
        });

        var panel = document.createElement('div');
        panel.className = 'contestlive-skin-dock__panel';

        var lab = document.createElement('div');
        lab.className = 'contestlive-skin-dock__label';
        lab.textContent = '外观 · Appearance';

        var row = document.createElement('div');
        row.className = 'contestlive-skin-dock__row';
        SKINS.forEach(function (s) {
            var b = document.createElement('button');
            b.type = 'button';
            b.className = 'contestlive-skin-dock__btn';
            b.textContent = s.zh;
            b.title = s.en;
            b.setAttribute('data-contestlive-skin-id', s.id);
            b.addEventListener('click', function () {
                var id = s.id;
                setSkinAttr(id);
                persistSkin(id);
                syncActiveButtons();
            });
            row.appendChild(b);
        });

        var chkWrap = document.createElement('label');
        chkWrap.className = 'contestlive-skin-dock__chk';
        var chk = document.createElement('input');
        chk.type = 'checkbox';
        chk.className = 'contestlive-skin-dock__chk-input';
        chk.checked = readStore(PK) !== null && readStore(PK) !== '';
        chk.addEventListener('change', function () {
            if (chk.checked) {
                writeStore(PK, getSkin());
            } else {
                writeStore(PK, null);
                var g = readStore(GK);
                if (g && VALID[g]) {
                    setSkinAttr(g);
                } else {
                    setSkinAttr('default');
                }
            }
            syncActiveButtons();
        });
        var sp = document.createElement('span');
        sp.textContent = '本页独立配色 / Per-page only';
        chkWrap.appendChild(chk);
        chkWrap.appendChild(sp);

        var syncBtn = document.createElement('button');
        syncBtn.type = 'button';
        syncBtn.className = 'contestlive-skin-dock__sync';
        syncBtn.textContent = '将当前方案设为「所有投屏页」默认 / Apply to all live pages';
        syncBtn.title = '所有机位统一为当前外观，并取消各页单独设置 / Use this look on every display page';
        syncBtn.addEventListener('click', function () {
            var cur = getSkin();
            writeStore(GK, cur);
            clearAllPageOverrides();
            writeStore(PK, null);
            if (dockEl) {
                var c = dockEl.querySelector('.contestlive-skin-dock__chk-input');
                if (c) {
                    c.checked = false;
                }
            }
            setSkinAttr(cur);
            syncActiveButtons();
        });

        var hint = document.createElement('p');
        hint.className = 'contestlive-skin-dock__hint';
        hint.textContent = '配色与正式成绩榜的三种风格一致；需要固定某一种时，请向本场负责人索取已配好外观的完整投屏链接。 / Same three themes as the official board; for a fixed look, ask your staff for the prepared display link.';

        panel.appendChild(lab);
        panel.appendChild(row);
        panel.appendChild(chkWrap);
        panel.appendChild(syncBtn);
        panel.appendChild(hint);

        wrap.appendChild(toggle);
        wrap.appendChild(panel);
        document.body.appendChild(wrap);
        return wrap;
    }

    var dockEl = null;

    function syncActiveButtons() {
        if (!dockEl) {
            return;
        }
        var cur = getSkin();
        dockEl.querySelectorAll('.contestlive-skin-dock__btn').forEach(function (b) {
            var id = b.getAttribute('data-contestlive-skin-id');
            b.classList.toggle('is-active', id === cur);
        });
    }

    function init() {
        dockEl = buildDock();
        syncActiveButtons();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    window.ContestliveSkin = {
        get: getSkin,
        set: function (s) {
            setSkinAttr(s);
            persistSkin(getSkin());
            syncActiveButtons();
        }
    };
})();
