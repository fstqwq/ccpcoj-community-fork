/**
 * 题目格式转换 — 通用逻辑（题包转换页壳层、多标签与 URL、会话缓存等）。
 * 各来源（Polygon、THUSAAC…）使用独立脚本，可挂到 window.ProblemPkg.{来源} 下便于调试与复用。
 */
(function () {
    'use strict';

    window.ProblemPkg = window.ProblemPkg || {};
    window.ProblemPkg.common = window.ProblemPkg.common || {};

    var STORAGE_KEY = 'csgoj_pkg_convert_tab';
    /** @type {string[]} 新增标签时：在此追加，并同步模板中的 data-pkg-tab / pane id */
    var VALID = ['polygon', 'thusaa'];

    window.PKG_CONVERT_TAB_POLYGON = 'polygon';
    /** THUSAAC / 酒井算协题包标签（技术标识 thusaa，与 Polygon 并列） */
    window.PKG_CONVERT_TAB_THUSAAC = 'thusaa';

    window.ProblemPkg.common.STORAGE_KEY = STORAGE_KEY;
    window.ProblemPkg.common.validTabKeys = function () {
        return VALID.slice();
    };

    function normalizeHash() {
        var h = (location.hash || '').replace(/^#/, '').trim().toLowerCase();
        return VALID.indexOf(h) >= 0 ? h : null;
    }

    /** 与旧 thusaa_parser 路由兼容：?pkg_tab=polygon|thusaa */
    function readQueryTab() {
        try {
            var q = new URLSearchParams(location.search || '');
            var t = (q.get('pkg_tab') || '').trim().toLowerCase();
            return VALID.indexOf(t) >= 0 ? t : null;
        } catch (e) {
            return null;
        }
    }

    function readStorageTab() {
        try {
            var s = sessionStorage.getItem(STORAGE_KEY);
            if (s && VALID.indexOf(s) >= 0) {
                return s;
            }
        } catch (e) { /* ignore */ }
        return null;
    }

    function writeStorageTab(tabKey) {
        try {
            sessionStorage.setItem(STORAGE_KEY, tabKey);
        } catch (e) { /* ignore */ }
    }

    function replaceHash(tabKey) {
        var url = location.pathname + location.search + '#' + tabKey;
        if (history.replaceState) {
            history.replaceState(null, '', url);
        } else {
            location.hash = '#' + tabKey;
        }
    }

    function getTrigger(tabKey) {
        return document.querySelector(
            '#pkgConvertTab button[data-bs-toggle="tab"][data-pkg-tab="' + tabKey + '"]'
        );
    }

    function showTab(tabKey) {
        var el = getTrigger(tabKey);
        if (!el || !window.bootstrap || !window.bootstrap.Tab) {
            return;
        }
        var inst = window.bootstrap.Tab.getOrCreateInstance(el);
        inst.show();
    }

    function resolveInitialTab() {
        var fromQuery = readQueryTab();
        if (fromQuery) {
            return fromQuery;
        }
        var fromHash = normalizeHash();
        if (fromHash) {
            return fromHash;
        }
        var fromStore = readStorageTab();
        if (fromStore) {
            return fromStore;
        }
        return window.PKG_CONVERT_TAB_POLYGON;
    }

    function wireTabEvents() {
        var root = document.getElementById('pkgConvertTab');
        if (!root) {
            return;
        }
        root.querySelectorAll('button[data-bs-toggle="tab"][data-pkg-tab]').forEach(function (btn) {
            btn.addEventListener('shown.bs.tab', function () {
                var id = btn.getAttribute('data-pkg-tab');
                if (id && VALID.indexOf(id) >= 0) {
                    replaceHash(id);
                    writeStorageTab(id);
                }
            });
        });
    }

    window.ProblemPkg.common.initPkgConvertTabs = function () {
        if (!document.getElementById('pkgConvertTab')) {
            return;
        }
        wireTabEvents();
        var initial = resolveInitialTab();
        showTab(initial);
        if (!normalizeHash()) {
            replaceHash(initial);
        }
        window.addEventListener('hashchange', function () {
            var h = normalizeHash();
            if (h) {
                showTab(h);
                writeStorageTab(h);
            }
        });
    };

    document.addEventListener('DOMContentLoaded', function () {
        window.ProblemPkg.common.initPkgConvertTabs();
    });
})();
