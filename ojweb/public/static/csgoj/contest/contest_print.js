/**
 * 比赛题册（contest2print）：`.cp-print-stack` + `article.cp-sheet`（A4）+ `window.print()`。
 * 维护说明：docs/guide/18.比赛题册contest2print.md
 */
(function () {
    'use strict';

    var dataEl = document.getElementById('contest_print_data_json');
    if (!dataEl) {
        return;
    }
    var DATA = {};
    try {
        DATA = JSON.parse(dataEl.value || '{}');
    } catch (e) {
        DATA = {};
    }
    if (!DATA || typeof DATA !== 'object' || !DATA.cid) {
        return;
    }

    var URLS = {
        logoUpload: '/' + DATA.module + '/' + DATA.controller + '/contest_print_logo_upload_ajax?cid=' + DATA.cid,
        logoDelete: '/' + DATA.module + '/' + DATA.controller + '/contest_print_logo_delete_ajax?cid=' + DATA.cid,
        coverUpload: '/' + DATA.module + '/' + DATA.controller + '/contest_print_cover_upload_ajax?cid=' + DATA.cid,
        coverDelete: '/' + DATA.module + '/' + DATA.controller + '/contest_print_cover_delete_ajax?cid=' + DATA.cid
    };

    var STATE = {
        currentLang: '',
        includeToc: true,
        showPageNumber: true,
        contestLogoUrl: DATA.contest_logo_url || '',
        contestLogoExt: DATA.contest_logo_ext || '',
        coverPdfUrl: DATA.cover_pdf_url || '',
        coverPdfMtime: DATA.cover_pdf_mtime || 0
    };

    function escapeHtml(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    function pickEffectiveLangKey(problem, langKey) {
        var loc = problem.locales || {};
        if (langKey && Object.prototype.hasOwnProperty.call(loc, langKey)) {
            return langKey;
        }
        if (problem.default_locale_key && Object.prototype.hasOwnProperty.call(loc, problem.default_locale_key)) {
            return problem.default_locale_key;
        }
        var keys = Object.keys(loc);
        return keys[0] || '';
    }

    function pickEffectiveEntry(problem, langKey) {
        var k = pickEffectiveLangKey(problem, langKey);
        return { key: k, entry: (problem.locales || {})[k] || null };
    }

    function buildSampleHtml(input, output) {
        if ((input == null || input === '') && (output == null || output === '')) {
            return '';
        }
        if (typeof window.ProblemSampleHtml !== 'function') {
            return '';
        }
        try {
            return window.ProblemSampleHtml(String(input || ''), String(output || ''), 4) || '';
        } catch (e) {
            return '';
        }
    }

    function buildJudgeChipHtml(spj) {
        var v = String(spj || '0');
        var kind = (v === '1') ? 'special' : (v === '2' ? 'interactive' : 'standard');
        var labelCn = '标准评测';
        var labelEn = 'Standard Judge';
        if (kind === 'special') { labelCn = '特判评测'; labelEn = 'Special Judge'; }
        else if (kind === 'interactive') { labelCn = '交互评测'; labelEn = 'Interactive Judge'; }
        return '<span class="cp-judge-chip cp-judge-chip--' + kind + '" '
            + 'title="' + escapeHtml(labelCn) + ' / ' + escapeHtml(labelEn) + '">'
            +   '<span class="cn-text">' + labelCn + '</span>'
            +   '<span class="cp-bilingual-sep"> / </span>'
            +   '<span class="en-text">' + labelEn + '</span>'
            + '</span>';
    }

    function buildSectionTitleHtml(titleCn, titleEn) {
        return '<h3 class="cp-section-title">'
            + '<span class="cn-text">' + titleCn + '</span>'
            + '<span class="cp-bilingual-sep"> / </span>'
            + '<span class="en-text">' + titleEn + '</span>'
            + '</h3>';
    }

    function buildSectionHtml(titleCn, titleEn, html) {
        return '<div class="cp-section">'
            + buildSectionTitleHtml(titleCn, titleEn)
            + '<div class="cp-section-content marked_math_div">' + html + '</div>'
            + '</div>';
    }

    function buildProblemHeadHtml(problem, entry, apidLabel) {
        var titleText = (entry && entry.title) || problem.title || '';
        var head = '<h2 class="cp-problem-title">' + escapeHtml(apidLabel) + '. ' + escapeHtml(titleText) + '</h2>';
        var chip = buildJudgeChipHtml(problem.spj);
        var tlVal = '<span class="csg-no-break">' + escapeHtml(problem.time_limit) + ' s</span>';
        var mlVal = '<span class="csg-no-break">' + escapeHtml(problem.memory_limit) + ' MB</span>';
        function metaItem(cn, en, valueHtml) {
            return '<span class="cp-meta-item">'
                + '<span class="cp-meta-label">'
                +   '<span class="cn-text">' + cn + '</span>'
                +   '<span class="cp-bilingual-sep"> / </span>'
                +   '<span class="en-text">' + en + '</span>'
                + '</span>'
                + '<span class="cp-meta-colon">：</span>'
                + valueHtml
                + '</span>';
        }
        var meta = '<div class="cp-problem-meta">'
            + chip
            + metaItem('时限', 'TL', tlVal)
            + metaItem('内存', 'ML', mlVal)
            + '</div>';
        return head + meta;
    }

    function renderProblemBlockMd(problem, entry, apidLabel) {
        var head = buildProblemHeadHtml(problem, entry, apidLabel);
        var body = '';
        if (entry.description) body += buildSectionHtml('题目描述', 'Description', entry.description);
        if (entry.input) body += buildSectionHtml('输入', 'Input', entry.input);
        if (entry.output) body += buildSectionHtml('输出', 'Output', entry.output);
        var sampleHtml = buildSampleHtml(problem.sample_input, problem.sample_output);
        if (sampleHtml) body += buildSectionHtml('样例', 'Sample', sampleHtml);
        if (entry.hint) body += buildSectionHtml('提示', 'Hint', entry.hint);

        return '<section class="cp-problem cp-problem--md" data-cp-page-kind="md" '
            + 'id="cp-problem-' + escapeHtml(apidLabel) + '" data-cp-apid="' + escapeHtml(apidLabel) + '">'
            + head + body
            + '</section>';
    }

    function renderProblemBlockPdf(problem, entry, apidLabel) {
        var pdfUrl = entry.pdf_url || '';
        var head = buildProblemHeadHtml(problem, entry, apidLabel);
        var frame = pdfUrl
            ? ('<div class="cp-pdf-frame-wrap"><iframe class="cp-pdf-frame" src="' + escapeHtml(pdfUrl)
                + '" title="PDF"></iframe></div>')
            : '<div class="cp-pdf-frame-wrap cp-pdf-frame-empty"><span class="cn-text">无 PDF</span>'
                + '<span class="en-text text-muted">No PDF</span></div>';
        return '<section class="cp-problem cp-problem--pdf" data-cp-page-kind="pdf" '
            + 'id="cp-problem-' + escapeHtml(apidLabel) + '" data-cp-apid="' + escapeHtml(apidLabel) + '">'
            + head + frame
            + '</section>';
    }

    function renderCoverHtml() {
        var titleParts = (DATA.contest_title || '').split('#');
        var mainTitle = titleParts[0] || '';
        var subTitle = titleParts[1] || '';
        var bottomLines = [];
        for (var i = 2; i < titleParts.length; i++) {
            bottomLines.push(titleParts[i]);
        }
        var dateStr = '';
        if (DATA.contest_start) {
            var d = new Date((DATA.contest_start || '').replace(/-/g, '/'));
            if (!isNaN(d.getTime())) {
                dateStr = d.getFullYear() + '年' + (d.getMonth() + 1) + '月' + d.getDate() + '日';
            }
        }
        var hours = '';
        try {
            var s = new Date((DATA.contest_start || '').replace(/-/g, '/'));
            var e = new Date((DATA.contest_end || '').replace(/-/g, '/'));
            if (!isNaN(s.getTime()) && !isNaN(e.getTime())) {
                var diff = Math.abs(e.getTime() - s.getTime()) / 3600000;
                hours = (Math.round(diff * 10) / 10) + '';
            }
        } catch (e0) { /* ignore */ }
        var probCount = (DATA.problem_list || []).length;
        var logoHtml = '';
        if (STATE.contestLogoUrl) {
            logoHtml = '<img src="' + escapeHtml(STATE.contestLogoUrl) + '" alt="logo">';
        }
        var bottomBlocks = bottomLines.map(function (t) {
            return '<div class="cp-cover-meta-row"><span>' + escapeHtml(t) + '</span></div>';
        }).join('');
        function metaRow(cn, en, valueHtml) {
            return '<div class="cp-cover-meta-row">'
                + '<span class="key">'
                +   '<span class="cn-text">' + cn + '</span>'
                +   '<span class="cp-bilingual-sep"> / </span>'
                +   '<span class="en-text">' + en + '</span>'
                +   '<span class="cp-cover-meta-colon">：</span>'
                + '</span>'
                + '<span class="value">' + valueHtml + '</span>'
                + '</div>';
        }
        var hoursValue = '';
        if (hours !== '') {
            hoursValue = '<span class="csg-no-break">' + escapeHtml(hours) + ' '
                + '<span class="cn-text">小时</span><span class="en-text">h</span></span>';
        }
        return ''
            + '<section class="cp-cover" data-cp-page-kind="cover">'
            +   '<h1 class="cp-cover-title">' + escapeHtml(mainTitle) + '</h1>'
            +   (subTitle ? '<div class="cp-cover-subtitle">' + escapeHtml(subTitle) + '</div>' : '')
            +   '<div class="cp-cover-logo-wrap">' + logoHtml + '</div>'
            +   '<div class="cp-cover-meta">'
            +     metaRow('题数', 'Problems', String(probCount))
            +     (hoursValue ? metaRow('时长', 'Duration', hoursValue) : '')
            +   '</div>'
            +   '<div class="cp-cover-bottom">' + bottomBlocks + (dateStr ? '<div class="cp-cover-meta-row"><span>' + escapeHtml(dateStr) + '</span></div>' : '') + '</div>'
            + '</section>';
    }

    function renderExternalCoverSheet() {
        var u = STATE.coverPdfUrl || '';
        var inner = u
            ? ('<section class="cp-cover cp-cover--external-pdf" data-cp-page-kind="cover">'
                + '<iframe class="cp-cover-pdf-iframe" src="' + escapeHtml(u) + '" title="Cover PDF"></iframe>'
                + '</section>')
            : '<section class="cp-cover" data-cp-page-kind="cover"><p class="text-muted">Cover PDF</p></section>';
        return sheetWrap('coverpdf', inner);
    }

    function renderTocHtml(items) {
        var listHtml = items.map(function (it) {
            var pdfFlag = it.usePdf
                ? '<span class="cp-toc-pdf-flag" title="PDF">PDF</span>'
                : '';
            var anchor = '#cp-problem-' + it.apid;
            return ''
                + '<li class="cp-toc-item">'
                +   '<a class="cp-toc-link" href="' + escapeHtml(anchor) + '" data-cp-toc-target="' + escapeHtml(anchor) + '">'
                +     '<span class="cp-toc-apid">' + escapeHtml(it.apid) + '.</span>'
                +     '<span class="cp-toc-title-text">' + escapeHtml(it.title) + '</span>'
                +     pdfFlag
                +     '<span class="cp-toc-leader" aria-hidden="true"></span>'
                +     '<span class="cp-toc-page" aria-label="page number"></span>'
                +   '</a>'
                + '</li>';
        }).join('');
        return ''
            + '<section class="cp-toc" data-cp-page-kind="toc">'
            +   '<h1 class="cp-toc-title">'
            +     '<span class="cn-text">目录</span>'
            +     '<span class="cp-bilingual-sep"> / </span>'
            +     '<span class="en-text">Table of Contents</span>'
            +   '</h1>'
            +   '<ol class="cp-toc-list">' + listHtml + '</ol>'
            + '</section>';
    }

    function sheetWrap(sheetKind, innerHtml) {
        return '<article class="cp-sheet" data-cp-sheet-kind="' + escapeHtml(sheetKind) + '">' + innerHtml + '</article>';
    }

    function buildBookletHtml(langKey) {
        var probs = DATA.problem_list || [];
        var parts = [];
        if (STATE.coverPdfUrl) {
            parts.push(renderExternalCoverSheet());
        } else {
            parts.push(sheetWrap('cover', renderCoverHtml()));
        }
        if (STATE.includeToc) {
            var tocItems = probs.map(function (p) {
                var pe = pickEffectiveEntry(p, langKey);
                var t = (pe.entry && pe.entry.title) ? pe.entry.title : (p.title || '');
                return {
                    apid: p.apid,
                    title: t,
                    usePdf: !!(pe.entry && pe.entry.kind === 'pdf')
                };
            });
            parts.push(sheetWrap('toc', renderTocHtml(tocItems)));
        }
        probs.forEach(function (p) {
            var pe = pickEffectiveEntry(p, langKey);
            if (!pe.entry) {
                return;
            }
            var sk = pe.entry.kind === 'pdf' ? 'pdf' : 'md';
            if (pe.entry.kind === 'pdf') {
                parts.push(sheetWrap(sk, renderProblemBlockPdf(p, pe.entry, p.apid)));
            } else {
                parts.push(sheetWrap(sk, renderProblemBlockMd(p, pe.entry, p.apid)));
            }
        });
        return '<div class="cp-doc"><div class="cp-print-stack">' + parts.join('') + '</div></div>';
    }

    function renderMathInViewport(viewport) {
        if (!viewport) return;
        if (typeof window.MathRender !== 'function') return;
        try {
            window.MathRender('.marked_math_div, .md_display_div', viewport, true);
        } catch (e) { /* ignore */ }
    }

    function fillTocPageNumbers(viewport) {
        if (!viewport) return;
        var links = viewport.querySelectorAll('.cp-toc-link[data-cp-toc-target]');
        if (!links || links.length === 0) return;
        var sheets = Array.prototype.slice.call(viewport.querySelectorAll('.cp-sheet'));
        if (sheets.length === 0) return;
        var displayNoMap = new Map();
        var counter = 0;
        for (var i = 0; i < sheets.length; i++) {
            var sh = sheets[i];
            var sk = sh.getAttribute('data-cp-sheet-kind') || '';
            if (sk === 'cover' || sk === 'coverpdf') {
                displayNoMap.set(sh, 0);
            } else {
                counter += 1;
                displayNoMap.set(sh, counter);
            }
        }
        Array.prototype.forEach.call(links, function (a) {
            var sel = a.getAttribute('data-cp-toc-target') || '';
            var pageNo = '';
            if (sel) {
                try {
                    var target = viewport.querySelector(sel);
                    var sheetEl = target && target.closest && target.closest('.cp-sheet');
                    if (sheetEl && displayNoMap.has(sheetEl)) {
                        var n = displayNoMap.get(sheetEl);
                        pageNo = n > 0 ? String(n) : '';
                    }
                } catch (e) { /* ignore */ }
            }
            var slot = a.querySelector('.cp-toc-page');
            if (slot) slot.textContent = pageNo || '';
        });
    }

    function preparePrintAttributes(scopeEl) {
        var vp = document.getElementById('contest_print_viewport');
        var sheets = vp ? vp.querySelectorAll('.cp-sheet') : [];
        var numberedTotal = 0;
        for (var i = 0; i < sheets.length; i++) {
            var sh = sheets[i];
            var sk = sh.getAttribute('data-cp-sheet-kind') || '';
            if (sk === 'cover' || sk === 'coverpdf') {
                sh.classList.add('cp-page-cover');
            } else {
                sh.classList.remove('cp-page-cover');
                numberedTotal++;
            }
        }
        scopeEl.style.setProperty('--cp-print-total', String(numberedTotal));
        scopeEl.setAttribute('data-cp-print-pageno', STATE.showPageNumber ? '1' : '0');
        scopeEl.setAttribute('data-cp-print-skip-cover', '1');
    }

    function renderToViewport(langKey) {
        var loadingEl = document.getElementById('contest_print_loading');
        var viewport = document.getElementById('contest_print_viewport');
        if (!viewport) {
            return Promise.reject(new Error('viewport missing'));
        }
        if (loadingEl) loadingEl.hidden = false;
        try {
            viewport.innerHTML = buildBookletHtml(langKey);
            fillTocPageNumbers(viewport);
            renderMathInViewport(viewport);
            var scope = document.getElementById('contest_print_scope');
            if (scope) preparePrintAttributes(scope);
            refreshPagerUi();
        } catch (e) {
            if (loadingEl) loadingEl.hidden = true;
            return Promise.reject(e);
        }
        if (loadingEl) loadingEl.hidden = true;
        return Promise.resolve();
    }

    function bindPreviewScale() {
        var wrap = document.getElementById('contest_print_viewport_wrap');
        var vp = document.getElementById('contest_print_viewport');
        if (!wrap || !vp || typeof ResizeObserver === 'undefined') {
            return;
        }
        var a4Px = (210 * 96) / 25.4;
        var pad = 32;
        function apply() {
            var w = Math.max(0, wrap.clientWidth - pad);
            var s = w <= 0 ? 1 : Math.min(1, w / a4Px);
            vp.style.setProperty('--cp-preview-scale', String(s));
        }
        apply();
        var ro = new ResizeObserver(apply);
        ro.observe(wrap);
    }

    function getRenderedPages() {
        var viewport = document.getElementById('contest_print_viewport');
        if (!viewport) return [];
        return Array.from(viewport.querySelectorAll('.cp-sheet'));
    }

    function refreshPagerUi() {
        var pages = getRenderedPages();
        var ind = document.getElementById('contest_print_page_indicator');
        if (!ind) return;
        if (pages.length === 0) {
            ind.textContent = '- / -';
            return;
        }
        var current = currentVisiblePageIndex();
        ind.textContent = (current + 1) + ' / ' + pages.length;
    }

    function currentVisiblePageIndex() {
        var viewport = document.getElementById('contest_print_viewport');
        if (!viewport) return 0;
        var pages = getRenderedPages();
        var stack = viewport.querySelector('.cp-print-stack');
        var offsetTop = stack ? stack.offsetTop : 0;
        var vt = viewport.scrollTop;
        var vh = viewport.clientHeight;
        var center = vt + vh / 2;
        var bestIdx = 0;
        var bestDist = Infinity;
        for (var i = 0; i < pages.length; i++) {
            var p = pages[i];
            var pt = p.offsetTop + offsetTop;
            var pc = pt + p.offsetHeight / 2;
            var d = Math.abs(pc - center);
            if (d < bestDist) {
                bestDist = d;
                bestIdx = i;
            }
        }
        return bestIdx;
    }

    function gotoPageDelta(delta) {
        var pages = getRenderedPages();
        if (pages.length === 0) return;
        var idx = currentVisiblePageIndex();
        var next = Math.max(0, Math.min(pages.length - 1, idx + delta));
        pages[next].scrollIntoView({ behavior: 'smooth', block: 'start' });
        setTimeout(refreshPagerUi, 250);
    }

    function bindPagerEvents() {
        document.getElementById('contest_print_prev_btn').addEventListener('click', function () {
            gotoPageDelta(-1);
        });
        document.getElementById('contest_print_next_btn').addEventListener('click', function () {
            gotoPageDelta(1);
        });
        document.getElementById('contest_print_fullscreen_btn').addEventListener('click', function () {
            var v = document.getElementById('contest_print_viewport');
            if (!document.fullscreenElement) {
                if (v.requestFullscreen) {
                    v.requestFullscreen();
                } else if (v.webkitRequestFullscreen) {
                    v.webkitRequestFullscreen();
                }
            } else if (document.exitFullscreen) {
                document.exitFullscreen();
            }
        });
        var viewport = document.getElementById('contest_print_viewport');
        if (viewport) {
            var t = null;
            viewport.addEventListener('scroll', function () {
                if (t) clearTimeout(t);
                t = setTimeout(refreshPagerUi, 80);
            }, { passive: true });
        }
    }

    function bindLangSwitch() {
        var sel = document.getElementById('contest_print_lang_select');
        if (!sel) return;
        var langs = DATA.available_langs || [];
        if (langs.length === 0) {
            langs = [{ key: '__main__', label: '默认 / Default' }];
        }
        var defaultKey = (langs[0] && langs[0].key) || '__main__';
        STATE.currentLang = defaultKey;
        sel.innerHTML = langs.map(function (l) {
            return '<option value="' + escapeHtml(l.key) + '">' + escapeHtml(l.label) + ' (' + escapeHtml(l.key) + ')</option>';
        }).join('');
        sel.value = defaultKey;
        sel.addEventListener('change', function () {
            STATE.currentLang = sel.value || defaultKey;
            renderToViewport(STATE.currentLang).catch(function (err) {
                console.error('[contest_print]', err);
            });
        });
    }

    function pdfPrintOverlayBase() {
        return {
            theme: 'dark',
            titleIcon: 'bi-printer',
            progressAccent: 'gradient-blue',
            spinner: false,
            overlayProgressSpinnerPolicy: 'progress_only',
            zIndex: 2080
        };
    }

    function bindSettings() {
        var settingsBtn = document.getElementById('contest_print_settings_btn');
        var modalEl = document.getElementById('contest_print_settings_modal');
        var tocSwitch = document.getElementById('contest_print_toc_switch');
        var pageNoSwitch = document.getElementById('contest_print_pageno_switch');
        var applyBtn = document.getElementById('contest_print_settings_apply_btn');
        var logoUploadBtn = document.getElementById('contest_print_logo_upload_btn');
        var logoFileInput = document.getElementById('contest_print_logo_file_input');
        var logoDeleteBtn = document.getElementById('contest_print_logo_delete_btn');
        var coverUploadBtn = document.getElementById('contest_print_cover_upload_btn');
        var coverFileInput = document.getElementById('contest_print_cover_file_input');
        var coverDeleteBtn = document.getElementById('contest_print_cover_delete_btn');
        if (!settingsBtn || !modalEl) return;

        function initOneSwitch(el, checked) {
            if (!el) return;
            if (window.csgSwitch && typeof window.csgSwitch.initSwitch === 'function') {
                window.csgSwitch.initSwitch(el);
            }
            el.checked = !!checked;
            if (window.csgSwitch && typeof window.csgSwitch.syncSwitchState === 'function') {
                window.csgSwitch.syncSwitchState(el);
            }
        }
        initOneSwitch(tocSwitch, STATE.includeToc);
        initOneSwitch(pageNoSwitch, STATE.showPageNumber);

        function refreshAssetsUi() {
            var logoEmpty = document.getElementById('contest_print_logo_empty');
            var logoPrev = document.getElementById('contest_print_logo_preview');
            var logoImg = document.getElementById('contest_print_logo_preview_img');
            if (STATE.contestLogoUrl) {
                logoEmpty.hidden = true;
                logoPrev.hidden = false;
                logoImg.src = STATE.contestLogoUrl;
            } else {
                logoEmpty.hidden = false;
                logoPrev.hidden = true;
                logoImg.src = '';
            }
            var coverEmpty = document.getElementById('contest_print_cover_empty');
            var coverPrev = document.getElementById('contest_print_cover_preview');
            var coverLink = document.getElementById('contest_print_cover_preview_link');
            if (STATE.coverPdfUrl) {
                coverEmpty.hidden = true;
                coverPrev.hidden = false;
                coverLink.href = STATE.coverPdfUrl;
            } else {
                coverEmpty.hidden = false;
                coverPrev.hidden = true;
                coverLink.href = '#';
            }
        }
        refreshAssetsUi();

        settingsBtn.addEventListener('click', function () {
            initOneSwitch(tocSwitch, STATE.includeToc);
            initOneSwitch(pageNoSwitch, STATE.showPageNumber);
            refreshAssetsUi();
            var m = bootstrap.Modal.getOrCreateInstance(modalEl);
            m.show();
        });

        applyBtn.addEventListener('click', function () {
            var prevToc = STATE.includeToc;
            STATE.includeToc = !!tocSwitch.checked;
            STATE.showPageNumber = !!pageNoSwitch.checked;
            var m = bootstrap.Modal.getOrCreateInstance(modalEl);
            m.hide();
            var scope = document.getElementById('contest_print_scope');
            if (STATE.includeToc !== prevToc) {
                renderToViewport(STATE.currentLang).catch(function (err) { console.error('[contest_print]', err); });
            } else if (scope) {
                preparePrintAttributes(scope);
            }
        });

        logoUploadBtn.addEventListener('click', function () { logoFileInput.click(); });
        logoFileInput.addEventListener('change', function () {
            var f = logoFileInput.files && logoFileInput.files[0];
            logoFileInput.value = '';
            if (!f) return;
            if (f.size > 4 * 1024 * 1024) {
                alerty.error({ message: 'Logo 文件过大（最大 4MB）', message_en: 'Logo too large (max 4MB)' });
                return;
            }
            var fr = new FileReader();
            fr.onload = function () {
                var dataUrl = String(fr.result || '');
                $.post(URLS.logoUpload, { logo_data: dataUrl }, null, 'json').then(function (res) {
                    if (!res || res.code != 1) {
                        alerty.error({ message: (res && res.msg) || '上传失败', message_en: 'Upload failed' });
                        return;
                    }
                    STATE.contestLogoUrl = (res.data && res.data.logo_url) || '';
                    STATE.contestLogoExt = (res.data && res.data.ext) || '';
                    alerty.success({ message: 'Logo 已更新', message_en: 'Logo updated' });
                    refreshAssetsUi();
                    renderToViewport(STATE.currentLang).catch(function (err) { console.error('[contest_print]', err); });
                }, function () {
                    alerty.error({ message: '上传失败', message_en: 'Upload failed' });
                });
            };
            fr.readAsDataURL(f);
        });
        logoDeleteBtn.addEventListener('click', function () {
            if (!STATE.contestLogoUrl) return;
            alerty.confirm({
                message: '确定删除 Logo？',
                message_en: 'Delete the logo?',
                callback: function () {
                    $.post(URLS.logoDelete, {}, null, 'json').then(function (res) {
                        if (!res || res.code != 1) {
                            alerty.error({ message: (res && res.msg) || '删除失败', message_en: 'Delete failed' });
                            return;
                        }
                        STATE.contestLogoUrl = '';
                        STATE.contestLogoExt = '';
                        alerty.success({ message: 'Logo 已删除', message_en: 'Logo deleted' });
                        refreshAssetsUi();
                        renderToViewport(STATE.currentLang).catch(function (err) { console.error('[contest_print]', err); });
                    });
                }
            });
        });

        coverUploadBtn.addEventListener('click', function () { coverFileInput.click(); });
        coverFileInput.addEventListener('change', function () {
            var f = coverFileInput.files && coverFileInput.files[0];
            coverFileInput.value = '';
            if (!f) return;
            if (f.size > 32 * 1024 * 1024) {
                alerty.error({ message: '封面 PDF 过大（最大 32MB）', message_en: 'Cover PDF too large (max 32MB)' });
                return;
            }
            var fd = new FormData();
            fd.append('pdf_file', f, 'contest_print_cover.pdf');
            $.ajax({
                url: URLS.coverUpload,
                type: 'POST',
                data: fd,
                processData: false,
                contentType: false,
                dataType: 'json'
            }).then(function (res) {
                if (!res || res.code != 1) {
                    alerty.error({ message: (res && res.msg) || '上传失败', message_en: 'Upload failed' });
                    return;
                }
                STATE.coverPdfUrl = (res.data && res.data.cover_pdf_url) || '';
                alerty.success({ message: '封面 PDF 已更新', message_en: 'Cover PDF updated' });
                refreshAssetsUi();
                renderToViewport(STATE.currentLang).catch(function (err) { console.error('[contest_print]', err); });
            }, function () {
                alerty.error({ message: '上传失败', message_en: 'Upload failed' });
            });
        });
        coverDeleteBtn.addEventListener('click', function () {
            if (!STATE.coverPdfUrl) return;
            alerty.confirm({
                message: '确定删除自定义封面 PDF？删除后打印时将使用排版生成的封面。',
                message_en: 'Delete custom cover PDF? Will fall back to generated cover when printing.',
                callback: function () {
                    $.post(URLS.coverDelete, {}, null, 'json').then(function (res) {
                        if (!res || res.code != 1) {
                            alerty.error({ message: (res && res.msg) || '删除失败', message_en: 'Delete failed' });
                            return;
                        }
                        STATE.coverPdfUrl = '';
                        alerty.success({ message: '封面 PDF 已删除', message_en: 'Cover PDF deleted' });
                        refreshAssetsUi();
                        renderToViewport(STATE.currentLang).catch(function (err) { console.error('[contest_print]', err); });
                    });
                }
            });
        });
    }

    function waitFontsReady() {
        if (document.fonts && document.fonts.ready && typeof document.fonts.ready.then === 'function') {
            return document.fonts.ready.catch(function () { return null; });
        }
        return Promise.resolve();
    }

    function bindPrint() {
        var btn = document.getElementById('contest_print_export_btn');
        if (!btn) return;
        btn.addEventListener('click', function () {
            doPrint();
        });
    }

    function doPrint() {
        var scope = document.getElementById('contest_print_scope');
        if (!scope) return;
        var ov = typeof window.showOverlay === 'function';
        if (ov) {
            window.showOverlay(Object.assign({}, pdfPrintOverlayBase(), {
                progressMode: 'indeterminate',
                message: '准备打印…',
                message_en: 'Preparing print…',
                subtitle: '<span class="cn-text">等待字体就绪…</span><span class="en-text text-muted ms-1">Waiting for fonts…</span>',
                subtitleType: 'html'
            }));
        }
        waitFontsReady().then(function () {
            document.body.classList.add('csg-contest-print-active');
            preparePrintAttributes(scope);
            if (ov) {
                window.updateOverlay(Object.assign({}, pdfPrintOverlayBase(), {
                    progressMode: 'indeterminate'
                }), null, '打印对话框…');
            }
            var cleanup = function () {
                document.body.classList.remove('csg-contest-print-active');
                if (ov) window.hideOverlay();
            };
            window.addEventListener('afterprint', cleanup, { once: true });
            window.print();
            setTimeout(cleanup, 800);
        }).catch(function (err) {
            console.error(err);
            document.body.classList.remove('csg-contest-print-active');
            if (ov) window.hideOverlay();
            alerty.error({ message: '打印准备失败', message_en: 'Print preparation failed' });
        });
    }

    document.addEventListener('DOMContentLoaded', function () {
        bindPreviewScale();
        bindLangSwitch();
        bindPagerEvents();
        bindSettings();
        bindPrint();
        renderToViewport(STATE.currentLang).catch(function (err) {
            console.error('[contest_print] renderToViewport', err);
            var le = document.getElementById('contest_print_loading');
            if (le) {
                le.hidden = false;
                var cn = le.querySelector('.cn-text');
                var en = le.querySelector('.en-text');
                if (cn) cn.textContent = '排版失败，请刷新重试';
                if (en) en.textContent = 'Layout failed. Please refresh.';
            }
        });
    });
})();
