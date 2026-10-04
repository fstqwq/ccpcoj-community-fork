/**
 * 全站通用调试输出：按「命名空间 + 分类」开关，对象参数 JSON 序列化便于 MCP/自动化读控制台。
 *
 * 开启命名空间（任一即可，可叠加）：
 *   - URL：`?csg_dbg=contestlive_hud` 或逗号分隔多个；`?csg_dbg=1` 或 `*` 表示全部命名空间
 *   - localStorage：`localStorage.setItem('csg_dbg','contestlive_hud')`；值为 `1` 或 `*` 同 URL 全开
 *   - 综合 HUD 兼容：`?huddbg=1` 或 `localStorage.setItem('hud_live_debug','1')` → 等价开启 `contestlive_hud`
 *
 * 代码中：`CsgDbg('contestlive_hud', 'patch', { ... })`（内部用 console['log']，便于 rg 清理）
 *
 * 分类降噪：`window.CsgDebugCategories = { contestlive_hud: { patch: false, ... } }`；某分类缺省为开。
 * 兼容旧控制台：`ContestliveHudDebug.enabled === true` 时强制开 `contestlive_hud`；
 *   `ContestliveHudDebug.categories` 对该命名空间分类仍生效（与 CsgDebugCategories 合并，任一为 false 则关）。
 */
(function (w) {
    'use strict';

    var HUD_NS = 'contestlive_hud';

    function formatDbgArg(v) {
        if (v === null || v === undefined) {
            return v;
        }
        var t = typeof v;
        if (t === 'string' || t === 'number' || t === 'boolean') {
            return v;
        }
        if (v instanceof Error) {
            return v.message || String(v);
        }
        try {
            return JSON.stringify(v);
        } catch (e) {
            return String(v);
        }
    }

    function parseList(s) {
        if (!s || typeof s !== 'string') {
            return [];
        }
        return s.split(',').map(function (x) {
            return String(x).trim();
        }).filter(Boolean);
    }

    function readUrlParam(name) {
        try {
            return new URLSearchParams(w.location.search || '').get(name);
        } catch (e) {
            return null;
        }
    }

    function readLs(key) {
        try {
            return w.localStorage ? w.localStorage.getItem(key) : null;
        } catch (e) {
            return null;
        }
    }

    function mergeUrlListInto(out, raw) {
        if (raw == null || raw === '') {
            return;
        }
        var s = String(raw).trim();
        if (s === '1' || s === '*') {
            out['*'] = true;
            return;
        }
        parseList(s).forEach(function (p) {
            out[p] = true;
        });
    }

    /** @returns {Object<string, boolean>} */
    function activeNamespaceFlags() {
        var out = Object.create(null);
        mergeUrlListInto(out, readUrlParam('csg_dbg'));
        var ls = readLs('csg_dbg');
        if (ls === '1' || ls === '*') {
            out['*'] = true;
        } else if (ls) {
            mergeUrlListInto(out, ls);
        }
        if (readUrlParam('huddbg') === '1') {
            out[HUD_NS] = true;
        }
        if (readLs('hud_live_debug') === '1') {
            out[HUD_NS] = true;
        }
        return out;
    }

    function namespaceIsOn(ns) {
        if (ns === HUD_NS && w.ContestliveHudDebug && w.ContestliveHudDebug.enabled === true) {
            return true;
        }
        var flags = activeNamespaceFlags();
        if (flags['*']) {
            return true;
        }
        return !!flags[ns];
    }

    function legacyHudCategoryOff(cat) {
        var h = w.ContestliveHudDebug;
        if (!h || !h.categories || typeof h.categories !== 'object') {
            return false;
        }
        return h.categories[cat] === false;
    }

    function configuredCategoryOff(ns, cat) {
        var root = w.CsgDebugCategories;
        if (!root || typeof root !== 'object') {
            return false;
        }
        var byNs = root[ns];
        if (!byNs || typeof byNs !== 'object') {
            return false;
        }
        return byNs[cat] === false;
    }

    function categoryAllowed(ns, cat) {
        if (legacyHudCategoryOff(cat) && ns === HUD_NS) {
            return false;
        }
        if (configuredCategoryOff(ns, cat)) {
            return false;
        }
        return true;
    }

    /**
     * @param {string} namespace
     * @param {string} category
     * @param {...*} rest
     */
    function CsgDbg(namespace, category) {
        var ns = namespace != null ? String(namespace) : '';
        var cat = category != null ? String(category) : 'misc';
        if (!ns || !namespaceIsOn(ns)) {
            return;
        }
        if (!categoryAllowed(ns, cat)) {
            return;
        }
        var c = w.console;
        if (!c) {
            return;
        }
        var fn = c['log'];
        if (typeof fn !== 'function') {
            return;
        }
        var ts = new Date().toISOString().slice(11, 23);
        var raw = Array.prototype.slice.call(arguments, 2);
        var args = raw.map(formatDbgArg);
        fn.apply(c, [ts + ' [CsgDbg:' + ns + ':' + cat + ']'].concat(args));
    }

    w.CsgDbg = CsgDbg;
})(typeof window !== 'undefined' ? window : this);
