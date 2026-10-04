/**
 * 投屏换肤解析顺序（供 boot / 快捷键 / 控制台共用）
 * 快捷键临时覆盖 > URL ?skin= > contest.addition.live_display（页内 CONTEST_LIVE_DISPLAY_CONFIG，页级 > 全局）> 旧版 localStorage 单页/全局 > default
 * 按 G 会 GET live_display 写回 CONTEST_LIVE_DISPLAY_CONFIG，并清除 [ ] 换肤临时覆盖、校徽墙布局 `,` 临时键（contestlive_layout_hotkey_live_schoolwall）、本机全局/各页皮肤缓存后再解析（与控制台保存后无需整页刷新一致；首屏嵌入对象否则不变）。
 */
(function (w) {
    var ORDER = ['default', 'dark_stage', 'light_macaron'];
    var VALID = { default: true, dark_stage: true, light_macaron: true };
    var KEY_HOTKEY = 'contestlive_skin_hotkey';
    var KEY_GLOBAL = 'contestlive_skin_global';
    var PREFIX_PAGE = 'contestlive_skin_page_';
    /** 与控制台矩阵、skin_ui.clearAllPageOverrides 一致（投屏「从服务器同步」时清空本机页级覆盖） */
    var DISPLAY_PAGE_IDS = [
        'live',
        'live_balloon',
        'live_schoolwall',
        'live_timer',
        'live_queue',
        'live_ac',
        'live_combo',
        'live_probstats',
        'live_rank',
    ];

    function lsGet(k) {
        try {
            return w.localStorage.getItem(k);
        } catch (e) {
            return null;
        }
    }

    function lsSet(k, v) {
        try {
            if (v === null || v === '') {
                w.localStorage.removeItem(k);
            } else {
                w.localStorage.setItem(k, v);
            }
        } catch (e) { /* ignore */ }
    }

    function pickValid(raw) {
        return raw && VALID[raw] ? raw : null;
    }

    function resolveFromServerConfig(pageId) {
        var cfg = w.CONTEST_LIVE_DISPLAY_CONFIG;
        if (!cfg || typeof cfg !== 'object') {
            return null;
        }
        var pages = cfg.skin_pages && typeof cfg.skin_pages === 'object' ? cfg.skin_pages : {};
        var pin = pickValid(pages[pageId]);
        if (pin) {
            return pin;
        }
        var gin = pickValid(cfg.skin_global);
        return gin || 'default';
    }

    /**
     * 不含快捷键临时覆盖：用于「]」恢复后按 URL ?skin=、服务器 addition、旧版 LS 顺序解析（最后才落到 default）
     */
    function resolveSkinWithoutHotkey(pageId, searchStr) {
        var sp = new URLSearchParams(searchStr != null ? searchStr : (w.location && w.location.search) || '');
        var u = pickValid(sp.get('skin'));
        if (u) {
            return u;
        }
        if (w.CONTEST_LIVE_DISPLAY_CONFIG && typeof w.CONTEST_LIVE_DISPLAY_CONFIG === 'object') {
            return resolveFromServerConfig(pageId);
        }
        var pin = pickValid(lsGet(PREFIX_PAGE + pageId));
        if (pin) {
            return pin;
        }
        var gin = pickValid(lsGet(KEY_GLOBAL));
        if (gin) {
            return gin;
        }
        return 'default';
    }

    /**
     * 完整解析（含快捷键临时覆盖）
     */
    function resolveSkin(pageId, searchStr) {
        var hk = pickValid(lsGet(KEY_HOTKEY));
        if (hk) {
            return hk;
        }
        return resolveSkinWithoutHotkey(pageId, searchStr);
    }

    function syncRankLiveRootDataRankSkin(skin) {
        var v = pickValid(skin) || 'default';
        try {
            var roots = w.document.querySelectorAll('.rank-live-root');
            for (var i = 0; i < roots.length; i++) {
                roots[i].setAttribute('data-rank-skin', v);
            }
        } catch (e) { /* ignore */ }
    }

    function applySkinToDom(skin) {
        var v = pickValid(skin) || 'default';
        w.document.documentElement.setAttribute('data-contestlive-skin', v);
        syncRankLiveRootDataRankSkin(v);
        try {
            w.document.documentElement.dispatchEvent(
                new w.CustomEvent('contestlive-skin-applied', { detail: { skin: v } })
            );
        } catch (e2) { /* ignore */ }
        return v;
    }

    function cycleSkinHotkey(pageId) {
        var current = resolveSkin(pageId, null);
        var idx = ORDER.indexOf(current);
        if (idx < 0) {
            idx = 0;
        }
        var next = ORDER[(idx + 1) % ORDER.length];
        lsSet(KEY_HOTKEY, next);
        return applySkinToDom(next);
    }

    function resetSkinHotkey(pageId) {
        lsSet(KEY_HOTKEY, null);
        var s = resolveSkinWithoutHotkey(pageId, null);
        return applySkinToDom(s);
    }

    /**
     * GET live_display（与首屏嵌入同源字段），写入 window.CONTEST_LIVE_DISPLAY_CONFIG，
     * 清除方括号换肤临时键、校徽墙布局逗号临时键、本机全局/各页皮肤缓存，再按当前页 addition 解析并应用到 DOM。
     * @returns {Promise<{skin:string,cfg:object}|null>}
     */
    function pullLiveDisplayConfigFromServerThenApply() {
        var pageId = typeof w.CONTEST_LIVE_PAGE === 'string' ? w.CONTEST_LIVE_PAGE : 'live';
        var cid = w.CONTEST_LIVE_CID;
        if (!cid || !w.csg || typeof w.csg.ajax !== 'function') {
            return Promise.resolve(null);
        }
        var qs = { cid: String(cid) };
        if (w.CONTEST_LIVE_LVTK) {
            qs.lvtk = String(w.CONTEST_LIVE_LVTK);
        }
        return w.csg.ajax('GET', '/ojtool/contestlive/live_display_config_get_ajax', qs, {}, 'json').then(function (ret) {
            if (!ret || parseInt(String(ret.code), 10) !== 1 || !ret.data) {
                return null;
            }
            var raw = ret.data;
            var pages = raw && typeof raw.skin_pages === 'object' && raw.skin_pages ? raw.skin_pages : {};
            var g0 = pickValid(raw.skin_global) || 'default';
            var swRaw = typeof raw.schoolwall_layout === 'string' ? raw.schoolwall_layout.trim() : '';
            var sw = 'grid';
            if (swRaw !== '') {
                if (w.ContestliveSchoolwallLayout && w.ContestliveSchoolwallLayout.VALID && w.ContestliveSchoolwallLayout.VALID[swRaw]) {
                    sw = swRaw;
                } else if (!w.ContestliveSchoolwallLayout) {
                    /** ContestliveSchoolwallLayout 尚未加载完成时的兜底白名单（与 ORDER 一致） */
                    var FALLBACK_SW = {
                        grid: true,
                        stagger_rows: true,
                        hex: true,
                        rhythm: true,
                        mosaic: true,
                        radial: true,
                        spiral: true,
                        arc_rings: true,
                        petals: true,
                        frame: true,
                        scatter: true,
                    };
                    if (FALLBACK_SW[swRaw]) {
                        sw = swRaw;
                    }
                }
            }
            w.CONTEST_LIVE_DISPLAY_CONFIG = {
                skin_global: g0,
                skin_pages: pages,
                hud_title: typeof raw.hud_title === 'string' ? raw.hud_title : '',
                schoolwall_layout: sw,
                ticker_fixed: typeof raw.ticker_fixed === 'string' ? raw.ticker_fixed : '',
            };
            lsSet(KEY_HOTKEY, null);
            lsSet(KEY_GLOBAL, g0);
            for (var i = 0; i < DISPLAY_PAGE_IDS.length; i++) {
                lsSet(PREFIX_PAGE + DISPLAY_PAGE_IDS[i], null);
            }
            lsSet('contestlive_layout_hotkey_live_schoolwall', null);
            var s = resolveFromServerConfig(pageId);
            applySkinToDom(s);
            try {
                w.document.documentElement.dispatchEvent(new w.CustomEvent('contestlive-display-config-synced'));
            } catch (eSync) {
                /* ignore */
            }
            return { skin: s, cfg: w.CONTEST_LIVE_DISPLAY_CONFIG };
        });
    }

    /**
     * 各投屏页在按「]」恢复外观后，将本页快捷键改动的布局一并恢复默认并写回 localStorage。
     * 键为 data-contestlive-page（如 live_timer）；由各页脚本注册 `resetters[pageId] = function () { ... }`。
     */
    w.ContestlivePageLayoutResetters = w.ContestlivePageLayoutResetters || {};

    w.ContestliveSkinLib = {
        ORDER: ORDER,
        VALID: VALID,
        KEY_HOTKEY: KEY_HOTKEY,
        KEY_GLOBAL: KEY_GLOBAL,
        PREFIX_PAGE: PREFIX_PAGE,
        DISPLAY_PAGE_IDS: DISPLAY_PAGE_IDS,
        lsGet: lsGet,
        lsSet: lsSet,
        resolveSkin: resolveSkin,
        resolveSkinWithoutHotkey: resolveSkinWithoutHotkey,
        resolveFromServerConfig: resolveFromServerConfig,
        applySkinToDom: applySkinToDom,
        cycleSkinHotkey: cycleSkinHotkey,
        resetSkinHotkey: resetSkinHotkey,
        pullLiveDisplayConfigFromServerThenApply: pullLiveDisplayConfigFromServerThenApply,
    };
})(window);
