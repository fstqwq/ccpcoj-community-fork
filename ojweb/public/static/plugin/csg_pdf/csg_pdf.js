/**
 * CsgPdf：浏览器内 HTML→PDF 全局工具链（**矢量打印版**）
 *
 * 设计目标：
 * - 业务侧调用方只关心：「把这一段 DOM 排版到 A4 → 让 chrome 打印为矢量 PDF」。
 * - 不再做位图截图（删除了 html2canvas / jsPDF / pdf-lib），避免缩放后字模糊、文字不能复制；
 *   PDF 直通题面用 PDF.js 的 SVG 后端转成 inline `<svg>`，与 HTML 在同一打印流里输出，
 *   chrome 打印时即得到矢量 PDF。
 * - 第三方依赖（paged.polyfill / pdfjs）按需懒加载并缓存 Promise，避免重复 fetch。
 * - 加载与导出进度遮罩由页面引入的 overlay.js（showOverlay）提供，本模块不内置 DOM。
 *
 * 暴露 API：
 *   CsgPdf.ensureViewLoaded({ onProgress })          -> Promise<void>   只加载 paged.polyfill
 *   CsgPdf.ensurePdfRenderLoaded({ onProgress })     -> Promise<void>   只加载 pdfjs.min + 设置 workerSrc
 *   CsgPdf.renderPdfToSvgPages(url, { credentials })  -> Promise<SVGElement[]>
 *       PDF 每页 → 一个独立 inline SVG（含 viewBox），调用方负责把它放进自己的容器。
 *   CsgPdf.renderWithPagedJs({ sourceContent, sourceStyles, renderTo })
 *       封装 Paged.Previewer 的常规调用。
 *   CsgPdf.triggerPrint({ onBeforePrint, onAfterPrint })
 *       仅触发 window.print()；调用方自行用 CSS 限定打印区域。
 *
 * 模块范围：**比赛题册（contest2print）不加载本文件**；仓库内暂无其它内置引用。业务若复用请自行 `{js}` 引入并提供容器。
 */
(function (global) {
    'use strict';

    var BASE_PATH = '/static/plugin/csg_pdf/';
    var VENDOR_PATH = BASE_PATH + 'vendor/';

    var DEPS = {
        pagedjs: {
            id: 'pagedjs',
            /* 与 vendor 内魔改同步 bump，避免浏览器长期缓存旧 polyfill */
            url: VENDOR_PATH + 'paged.polyfill.js?v=20260509_autopreview2',
            checkLoaded: function () { return typeof Paged !== 'undefined' && Paged && (Paged.Previewer || Paged.Polyfill); },
            /**
             * 仍写入 auto:false；真正兜底见 vendor/paged.polyfill.js 末尾「仅 auto===true 才全局 preview」。
             */
            beforeLoad: function () {
                window.PagedConfig = Object.assign({}, window.PagedConfig || {}, { auto: false });
            }
        },
        pdfjs: {
            id: 'pdfjs',
            url: VENDOR_PATH + 'pdfjs.min.js',
            checkLoaded: function () {
                return !!(window.pdfjsLib || window['pdfjs-dist/build/pdf']);
            },
            afterLoad: function () {
                if (!window.pdfjsLib && window['pdfjs-dist/build/pdf']) {
                    window.pdfjsLib = window['pdfjs-dist/build/pdf'];
                }
                if (window.pdfjsLib && window.pdfjsLib.GlobalWorkerOptions
                    && !window.pdfjsLib.GlobalWorkerOptions.workerSrc) {
                    window.pdfjsLib.GlobalWorkerOptions.workerSrc = VENDOR_PATH + 'pdfjs.worker.min.js';
                }
            }
        }
    };

    /** 每个模块只加载一次的 Promise，避免并发触发多次 fetch */
    var depPromises = {};

    function appendCacheBust(url) {
        var t = window.__CSG_ASSET_T;
        if (t == null || t === '') {
            return url;
        }
        return url + (url.indexOf('?') >= 0 ? '&' : '?') + 't=' + encodeURIComponent(String(t));
    }

    function loadScript(url) {
        return new Promise(function (resolve, reject) {
            var s = document.createElement('script');
            s.src = appendCacheBust(url);
            s.async = false;
            s.onload = function () { resolve(); };
            s.onerror = function () { reject(new Error('Failed to load ' + url)); };
            document.head.appendChild(s);
        });
    }

    function loadDep(dep) {
        if (dep.checkLoaded && dep.checkLoaded()) {
            if (typeof dep.beforeLoad === 'function') {
                try { dep.beforeLoad(); } catch (e) { /* ignore */ }
            }
            if (typeof dep.afterLoad === 'function') {
                try { dep.afterLoad(); } catch (e) { /* ignore */ }
            }
            return Promise.resolve();
        }
        if (depPromises[dep.id]) {
            return depPromises[dep.id];
        }
        if (typeof dep.beforeLoad === 'function') {
            try { dep.beforeLoad(); } catch (e) { /* ignore */ }
        }
        depPromises[dep.id] = loadScript(dep.url).then(function () {
            if (dep.checkLoaded && !dep.checkLoaded()) {
                throw new Error('Dep loaded but symbol missing: ' + dep.id);
            }
            if (typeof dep.afterLoad === 'function') {
                try { dep.afterLoad(); } catch (e) { /* ignore */ }
            }
        }).catch(function (err) {
            delete depPromises[dep.id];
            throw err;
        });
        return depPromises[dep.id];
    }

    function loadDeps(depList, onProgress) {
        var fn = typeof onProgress === 'function' ? onProgress : function () {};
        var total = depList.length;
        var done = 0;
        function step() {
            done += 1;
            try { fn(done, total); } catch (e) { /* ignore */ }
        }
        var prom = Promise.resolve();
        depList.forEach(function (dep) {
            prom = prom.then(function () {
                return loadDep(dep).then(step);
            });
        });
        return prom;
    }

    /** 视图阶段：仅 paged.polyfill；首屏快。 */
    function ensureViewLoaded(opt) {
        opt = opt || {};
        return loadDeps([DEPS.pagedjs], opt.onProgress);
    }

    /** PDF 渲染阶段：pdfjs（用于 PDF 直通题面 / 封面 PDF 的 SVG 渲染） */
    function ensurePdfRenderLoaded(opt) {
        opt = opt || {};
        return loadDeps([DEPS.pdfjs], opt.onProgress);
    }

    /** A4 纵向（毫米 / 96dpi 下的 CSS 像素，与浏览器常规 px 换算一致） */
    var A4_W_MM = 210;
    var A4_H_MM = 297;
    var MM_PER_PT = 25.4 / 72;
    var A4_W_PX = (A4_W_MM * 96) / 25.4;
    var A4_H_PX = (A4_H_MM * 96) / 25.4;

    /** 等所有自定义字体加载完毕（防止字体未就绪导致字形 fallback） */
    function waitFontsReady() {
        if (document.fonts && document.fonts.ready && typeof document.fonts.ready.then === 'function') {
            return document.fonts.ready.catch(function () { return null; });
        }
        return Promise.resolve();
    }

    /**
     * 用 pdfjs 把一份 PDF 的每页渲染成 inline SVG（**矢量**）。
     *
     * 返回 Promise<SVGElement[]>：每个 SVG 自带 viewBox（pt 坐标），调用方按需把
     * width/height 设为 `100%` 即可在 A4 容器内 fit；CSS 走 preserveAspectRatio=xMidYMid meet。
     *
     * **重要**：3.x 的 SVGGraphics 在某些字体子集 / 透明度上会有视觉偏差，但对题册类
     * LaTeX-PDF（Type1/Type3 字体子集）足够好；不用位图截图链路，避免文字 raster 化。
     */
    function renderPdfToSvgPages(url, opt) {
        opt = opt || {};
        if (!window.pdfjsLib) {
            return Promise.reject(new Error('pdfjs not loaded'));
        }
        var lib = window.pdfjsLib;
        var task = lib.getDocument({
            url: url,
            withCredentials: opt.withCredentials !== false
        });
        return task.promise.then(function (doc) {
            var pages = [];
            var prom = Promise.resolve();
            for (var i = 1; i <= doc.numPages; i++) {
                (function (pageNum) {
                    prom = prom.then(function () {
                        return doc.getPage(pageNum).then(function (page) {
                            var viewport = page.getViewport({ scale: 1.0 });
                            return page.getOperatorList().then(function (opList) {
                                var gfx = new lib.SVGGraphics(page.commonObjs, page.objs);
                                gfx.embedFonts = true;
                                return gfx.getSVG(opList, viewport).then(function (svg) {
                                    pages.push(svg);
                                });
                            });
                        });
                    });
                })(i);
            }
            return prom.then(function () { return pages; });
        });
    }

    /**
     * 把一个完整内容容器交给 paged.js 排版，返回 Promise<{previewer, flow, renderTo}>。
     *
     * 注意：paged.js 会破坏性地操作传入的源 DOM（移走 / 克隆其子节点到自己的渲染器中）。
     * 调用方应把要排版的内容放在一个隐藏的 holder 中再传入。
     */
    function renderWithPagedJs(opt) {
        opt = opt || {};
        if (typeof Paged === 'undefined' || !Paged.Previewer) {
            return Promise.reject(new Error('Paged.js not loaded'));
        }
        var sourceContent = opt.sourceContent;
        var sourceStyles = opt.sourceStyles || [];
        var renderTo = opt.renderTo;
        if (!sourceContent || !renderTo) {
            return Promise.reject(new Error('renderWithPagedJs needs sourceContent + renderTo'));
        }
        var previewer = new Paged.Previewer();
        return previewer.preview(sourceContent, sourceStyles, renderTo).then(function (flow) {
            return { previewer: previewer, flow: flow, renderTo: renderTo };
        });
    }

    /**
     * 触发浏览器原生打印对话框（Chrome 中选「另存为 PDF」即为矢量 PDF）。
     * 返回 Promise&lt;void&gt;，在 `afterprint` 时 resolve。
     */
    function triggerPrint(opt) {
        opt = opt || {};
        return new Promise(function (resolve) {
            function done() {
                window.removeEventListener('afterprint', onAfter);
                if (typeof opt.onAfterPrint === 'function') {
                    try { opt.onAfterPrint(); } catch (e) { /* ignore */ }
                }
                resolve();
            }
            function onAfter() { done(); }
            window.addEventListener('afterprint', onAfter, { once: true });

            if (typeof opt.onBeforePrint === 'function') {
                try { opt.onBeforePrint(); } catch (e) { /* ignore */ }
            }
            window.print();
        });
    }

    global.CsgPdf = {
        ensureViewLoaded: ensureViewLoaded,
        ensurePdfRenderLoaded: ensurePdfRenderLoaded,
        renderPdfToSvgPages: renderPdfToSvgPages,
        renderWithPagedJs: renderWithPagedJs,
        triggerPrint: triggerPrint,
        waitFontsReady: waitFontsReady,
        constants: {
            A4_W_MM: A4_W_MM,
            A4_H_MM: A4_H_MM,
            MM_PER_PT: MM_PER_PT,
            A4_W_PX: A4_W_PX,
            A4_H_PX: A4_H_PX
        }
    };
})(window);
