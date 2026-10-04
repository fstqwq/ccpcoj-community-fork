/**
 * 校徽墙：校名列表由 PHP 注入（与 contest_data_ajax 队伍源一致）。
 * 仅展示成功加载到静态校徽的学校；无 webp 文件的不占位、不占格。
 * 布局：ContestliveSchoolwallLayout（多算法 + 快捷键临时覆盖见 contestlive_layout_hotkeys.js）。
 */
(function () {
    var CACHE_DB = 'csgoj_rank';
    var CACHE_STORE = 'logotable';
    var TTL_OK_MS = 60 * 60 * 1000;
    var TTL_FAIL_MS = 10 * 60 * 1000;

    function schoolBadgeBaseUrl() {
        var cfg = window.CONTEST_LIVE_DISPLAY_CONFIG;
        if (cfg && typeof cfg.school_badge_url === 'string' && cfg.school_badge_url !== '') {
            return cfg.school_badge_url.replace(/\/+$/, '');
        }
        return '/static/image/school_badge';
    }

    function logoIdbKey(baseUrl, school) {
        if (typeof window.RankToolSchoolLogoIdbCacheKey === 'function') {
            return window.RankToolSchoolLogoIdbCacheKey(baseUrl, school);
        }
        return 'logo_' + baseUrl + '_' + encodeURIComponent(school);
    }

    /**
     * @param {InstanceType<typeof IndexedDBCache>} logoCache
     * @param {string} baseUrl
     * @param {string} school
     * @returns {Promise<{ school: string, displayUrl: string } | null>}
     */
    async function tryLoadSchoolBadgeForWall(logoCache, baseUrl, school) {
        var idbKey = logoIdbKey(baseUrl, school);
        var fileKey = baseUrl + '/' + encodeURIComponent(school);
        var cached = null;
        try {
            cached = await logoCache.get(idbKey);
        } catch (e0) {
            cached = null;
        }
        if (cached && cached.flg_success !== false && cached.dataUrl) {
            var d0 = cached.dataUrl;
            if (typeof window.RankToolLoadSchoolBadgeProcessedPack === 'function') {
                try {
                    var p0 = await window.RankToolLoadSchoolBadgeProcessedPack(fileKey, d0);
                    if (p0 && p0.displayUrl) {
                        d0 = p0.displayUrl;
                    }
                } catch (e1) {
                    /* keep dataUrl */
                }
            }
            return { school: school, displayUrl: d0 };
        }
        /** 30s 防抖：失败缓存只在短期内短路（避免 N 个 cell 同时炸 fetch），超期重试覆盖。 */
        if (cached && cached.flg_success === false && typeof cached.ts === 'number' && Date.now() - cached.ts < 30 * 1000) {
            return null;
        }
        var fetchFn = window.RankToolFetchSchoolLogoDataUrl;
        if (typeof fetchFn !== 'function') {
            return null;
        }
        try {
            var dataUrl = await fetchFn(fileKey, baseUrl);
            var okPayload = {
                dataUrl: dataUrl,
                fileKey: fileKey,
                ts: Date.now(),
                flg_success: true,
            };
            await logoCache.set(idbKey, okPayload, TTL_OK_MS);
            var displayUrl = dataUrl;
            if (typeof window.RankToolLoadSchoolBadgeProcessedPack === 'function') {
                try {
                    var pack = await window.RankToolLoadSchoolBadgeProcessedPack(fileKey, dataUrl);
                    if (pack && pack.displayUrl) {
                        displayUrl = pack.displayUrl;
                    }
                } catch (e2) {
                    /* keep dataUrl */
                }
            }
            return { school: school, displayUrl: displayUrl };
        } catch (err) {
            await logoCache.set(
                idbKey,
                {
                    dataUrl: null,
                    ts: Date.now(),
                    flg_success: false,
                    error: err && err.message ? err.message : 'Load failed',
                },
                TTL_FAIL_MS
            );
            return null;
        }
    }

    csg.docready(function () {
        var root = document.getElementById('contestlive_schoolwall_root');
        var grid = root ? root.querySelector('.contestlive-schoolwall__grid') : null;
        var schools = window.SCHOOL_WALL_SCHOOLS;
        var CacheCls = window.IndexedDBCache;
        var Lay = window.ContestliveSchoolwallLayout;
        if (!root || !grid || !Array.isArray(schools) || typeof CacheCls !== 'function' || !Lay || typeof Lay.apply !== 'function') {
            return;
        }
        var logoCache = new CacheCls(CACHE_DB, CACHE_STORE);
        logoCache.init().then(function () {
            var baseUrl = schoolBadgeBaseUrl();
            var list = [];
            var si;
            for (si = 0; si < schools.length; si++) {
                var s = schools[si];
                if (s && typeof s === 'string') {
                    list.push(s);
                }
            }
            var tasks = list.map(function (school, idx) {
                return tryLoadSchoolBadgeForWall(logoCache, baseUrl, school).then(function (got) {
                    return { idx: idx, got: got };
                });
            });
            return Promise.all(tasks).then(function (arr) {
                arr.sort(function (a, b) {
                    return a.idx - b.idx;
                });
                var loaded = [];
                var j;
                for (j = 0; j < arr.length; j++) {
                    if (arr[j].got) {
                        loaded.push(arr[j].got);
                    }
                }
                grid.innerHTML = '';
                var k;
                for (k = 0; k < loaded.length; k++) {
                    var item = loaded[k];
                    var cell = document.createElement('div');
                    cell.className = 'contestlive-schoolwall__cell';
                    cell.setAttribute('title', item.school);
                    var badge = document.createElement('div');
                    badge.className = 'contestlive-schoolwall__badge has-background';
                    badge.setAttribute('data-school', item.school);
                    badge.style.setProperty('--csg-schoolwall-badge-bg', 'url(' + JSON.stringify(item.displayUrl) + ')');
                    cell.appendChild(badge);
                    grid.appendChild(cell);
                }
                var nCells = loaded.length;
                function getCells() {
                    return [].slice.call(grid.querySelectorAll('.contestlive-schoolwall__cell'));
                }
                function relayout() {
                    var mode = Lay.resolveLiveSchoolwall();
                    Lay.apply(mode, root, grid, getCells(), nCells);
                }
                window.__contestliveSchoolwallRelayout = relayout;
                relayout();
                function onSync() {
                    relayout();
                }
                document.documentElement.addEventListener('contestlive-display-config-synced', onSync);
                window.addEventListener('resize', relayout);
                if (typeof ResizeObserver === 'function') {
                    var ro = new ResizeObserver(function () {
                        relayout();
                    });
                    ro.observe(root);
                }
            });
        });
    });
})();
