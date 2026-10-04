/**
 * CCS API 控制台：列表过滤、详情、同源 fetch 测试
 */
(function () {
    'use strict';

    var cfg = window.CCS_API_CONSOLE_CONFIG || {};
    var catalog = window.CCS_API_CATALOG || [];
    var listEl = document.getElementById('ccs_api_list');
    var searchEl = document.getElementById('ccs_api_search');
    var detailEl = document.getElementById('ccs_api_detail');
    var countBadge = document.getElementById('ccs_api_count_badge');
    if (!listEl || !detailEl) return;

    if (!catalog.length) {
        listEl.innerHTML = '<div class="p-3 small text-danger">' +
            '<span class="cn-text">未加载端点目录，请确认已引入 ccs_api_catalog.js</span><br>' +
            '<span class="en-text">Catalog missing; include ccs_api_catalog.js</span></div>';
        if (countBadge) countBadge.textContent = '0';
        return;
    }

    var selectedId = null;
    var currentDetailEntry = null;
    var abortCtrl = null;

    function escHtml(s) {
        if (s == null) return '';
        return String(s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    /** 去掉目录里「（必填）」「(required)」等，便于在句子中引用表单项名称 */
    function subLabelCnForSentence(entry) {
        var s = entry && entry.subLabelCn != null ? String(entry.subLabelCn) : '路径参数';
        s = s.replace(/（必填）\s*$/, '').replace(/（可选）\s*$/, '').trim();
        return s || '路径参数';
    }

    function subLabelEnForSentence(entry) {
        var s = entry && entry.subLabelEn != null ? String(entry.subLabelEn) : 'path field';
        s = s.replace(/\s*\(required\)\s*$/i, '').replace(/\s*\(optional\)\s*$/i, '').trim();
        return s || 'path field';
    }

    /** URL 预览条：缺路径段时的简短提示 */
    function missingSubUserPreviewHtml(entry) {
        var cn = escHtml(subLabelCnForSentence(entry));
        var en = escHtml(subLabelEnForSentence(entry));
        return '<span class="text-warning small"><span class="cn-text">请填写「' + cn +
            '」</span> / Fill <span class="en-text">' + en + '</span></span>';
    }

    /** 未填 Basic 且未勾选匿名时 */
    function missingAuthUserErrorHtml() {
        return '<span class="cn-text">请填写上方的 Basic 用户名与密码；若要不带登录试调，请勾选「匿名请求」。</span> ' +
            '<span class="en-text">Enter Basic username and password above, or check Anonymous to try without login.</span>';
    }

    /** 发送请求前校验失败：说明要填哪个框、可参照占位示例 */
    function missingSubUserErrorHtml(entry) {
        var cn = subLabelCnForSentence(entry);
        var en = subLabelEnForSentence(entry);
        var ph = entry && entry.subPlaceholder != null ? String(entry.subPlaceholder).trim() : '';
        var cnLine = '请先在上方的「' + cn + '」输入框中填入正确取值，再点击「发送请求」。';
        if (ph) {
            cnLine += '可参照输入框里的示例：' + ph + '。';
        }
        var enLine = 'Enter a value in the "' + en + '" field above, then click Send.';
        if (ph) {
            enLine += ' See the placeholder for an example: ' + ph + '.';
        }
        return '<span class="cn-text">' + escHtml(cnLine) + '</span> <span class="en-text">' +
            escHtml(enLine) + '</span>';
    }

    /** 路径段：有限枚举用 select（subOptional 时首项为空），否则 text */
    function buildSubFieldHtml(entry, fp) {
        if (!entry.subRequired && !entry.subOptional) return '';
        var opts = entry.subSelectOptions;
        if (opts && opts.length) {
            var allowEmpty = !!entry.subOptional;
            var cur = fp.sub != null ? String(fp.sub) : '';
            var seen = false;
            var i;
            var parts = [
                '<select class="form-select form-select-sm" id="ccs_req_sub" ',
                'title="', escHtml((entry.subLabelCn || '') + ' / ' + (entry.subLabelEn || '')), '">'
            ];
            if (allowEmpty) {
                parts.push('<option value="">' + escHtml('— 不选 / None —') + '</option>');
            }
            for (i = 0; i < opts.length; i++) {
                var o = opts[i];
                var v = String(o.value);
                var sel = (cur === v) ? ' selected' : '';
                if (cur === v) seen = true;
                var lab = o.label != null ? String(o.label) : v;
                parts.push('<option value="' + escHtml(v) + '"' + sel + '>' + escHtml(lab) + '</option>');
            }
            if (cur !== '' && !seen) {
                parts.push('<option value="' + escHtml(cur) + '" selected>' +
                    escHtml(cur + ' (custom)') + '</option>');
            }
            parts.push('</select>');
            return parts.join('');
        }
        var ph = entry.subPlaceholder != null && String(entry.subPlaceholder) !== ''
            ? String(entry.subPlaceholder) : '';
        return '<input type="text" class="form-control form-control-sm" id="ccs_req_sub" placeholder="' +
            escHtml(ph) + '" value="' + escHtml(fp.sub) + '">';
    }

    function basicAuthHeader(user, pass) {
        var pair = user + ':' + pass;
        var bytes = new TextEncoder().encode(pair);
        var bin = '';
        for (var i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
        return 'Basic ' + btoa(bin);
    }

    function entryNeedsCid(entry) {
        return !!(entry && entry.pathTpl && entry.pathTpl.indexOf('{cid}') >= 0);
    }

    function buildPath(entry, cid, subVal) {
        var p = entry.pathTpl;
        p = p.split('{cid}').join(encodeURIComponent(cid));
        if (p.indexOf('{subId}') >= 0) {
            p = p.split('{subId}').join(encodeURIComponent(subVal || ''));
        } else if (subVal) {
            p = p.replace(/\/$/, '') + '/' + encodeURIComponent(subVal);
        }
        return p;
    }

    function buildUrl(path, queryStr) {
        var q = (queryStr || '').trim();
        if (!q) return path;
        if (q[0] === '?') q = q.slice(1);
        return path + (path.indexOf('?') >= 0 ? '&' : '?') + q;
    }

    /** Bash 单引号安全包裹 */
    function shSingleQuote(s) {
        return "'" + String(s).replace(/'/g, "'\\''") + "'";
    }

    /**
     * 与 runRequest 一致的请求参数；valid 为 false 时含 reason
     */
    function collectRequestState(entry) {
        var cid = (document.getElementById('ccs_req_cid') && document.getElementById('ccs_req_cid').value.trim()) || '';
        var sub = document.getElementById('ccs_req_sub') ? document.getElementById('ccs_req_sub').value.trim() : '';
        var query = document.getElementById('ccs_req_query') ? document.getElementById('ccs_req_query').value.trim() : '';
        var anon = !!(document.getElementById('ccs_req_anon') && document.getElementById('ccs_req_anon').checked);
        var user = document.getElementById('ccs_req_user') ? document.getElementById('ccs_req_user').value : '';
        var pass = document.getElementById('ccs_req_pass') ? document.getElementById('ccs_req_pass').value : '';

        if (entry.subRequired && !sub) {
            return { valid: false, reason: 'sub' };
        }
        if (!anon && !user) {
            return { valid: false, reason: 'auth' };
        }

        var path = buildPath(entry, cid, sub);
        var urlPath = buildUrl(path, query);
        var fullUrl = window.location.origin + urlPath;
        var headers = {};
        if (!anon) {
            headers.Authorization = basicAuthHeader(user, pass);
        }
        if (entry.responseKind === 'ndjson') {
            headers.Accept = 'application/x-ndjson, application/json;q=0.9, */*;q=0.8';
        } else if (entry.responseKind !== 'blob') {
            headers.Accept = 'application/json, */*;q=0.1';
        }

        return {
            valid: true,
            cid: cid,
            sub: sub,
            query: query,
            anon: anon,
            user: user,
            pass: pass,
            path: path,
            urlPath: urlPath,
            fullUrl: fullUrl,
            headers: headers
        };
    }

    async function copyViaClipboardWrite(text) {
        if (typeof ClipboardWrite !== 'function') {
            if (window.alerty) {
                window.alerty.error('当前页面无法一键复制，请刷新后重试或手动选中复制', 'Copy unavailable; refresh or copy manually');
            }
            return false;
        }
        var ok = await ClipboardWrite(text);
        if (ok && window.alerty) {
            window.alerty.success('已复制到剪贴板', 'Copied to clipboard');
        } else if (!ok && window.alerty) {
            window.alerty.error('复制失败，请手动复制', 'Copy failed');
        }
        return ok;
    }

    /** 当前 #ccs_req_out 为「正文」模式时拼接状态行 + body，供复制 */
    function collectResponseCopyText() {
        var out = document.getElementById('ccs_req_out');
        if (!out || out.classList.contains('ccs-api-response--msg')) return '';
        var st = out.querySelector('.ccs-api-res-status');
        var code = out.querySelector('pre code');
        var parts = [];
        if (st) {
            var line = (st.textContent || '').replace(/\n+$/g, '').trim();
            if (line) parts.push(line);
        }
        if (code) {
            var body = code.textContent == null ? '' : String(code.textContent);
            if (body.length) parts.push(body);
        }
        if (!parts.length) return '';
        return parts.join('\n\n');
    }

    async function copyResponsePanelToClipboard(btn) {
        var text = collectResponseCopyText();
        if (!text) {
            if (window.alerty) {
                window.alerty.error('暂无可复制的响应正文', 'No response body to copy');
            }
            return;
        }
        var ok = await copyViaClipboardWrite(text);
        if (ok && btn) {
            var orig = btn.innerHTML;
            btn.innerHTML = '<i class="bi bi-clipboard-check" aria-hidden="true"></i>' +
                '<span class="visually-hidden"><span class="cn-text">已复制</span> Copied</span>';
            btn.classList.add('ccs-res-copy-btn--done');
            setTimeout(function () {
                btn.innerHTML = orig;
                btn.classList.remove('ccs-res-copy-btn--done');
            }, 650);
        }
    }

    function setResponseCopyBtnVisible(show) {
        var b = document.getElementById('ccs_res_copy_btn');
        if (!b) return;
        if (show) {
            b.classList.remove('d-none');
            b.removeAttribute('aria-hidden');
        } else {
            b.classList.add('d-none');
            b.setAttribute('aria-hidden', 'true');
        }
    }

    /**
     * ICPC Contest Utilities EventFeedUtil：--testFeed 会在 contest 基址后自动请求 /event-feed
     * （与 org.icpc.tools.contest.util.EventFeedUtil 一致）。
     */
    function buildEventFeedUtilCommand(st) {
        var cid = encodeURIComponent(st.cid);
        var base = window.location.origin + '/api/contests/' + cid;
        var u = st.anon ? '' : String(st.user || '');
        var p = st.anon ? '' : String(st.pass || '');
        return [
            '# ICPC Contest Utilities — https://tools.icpc.global/contest-utils',
            '# Unzip contestUtil under repo unit_tests/icpc_contest_util/ (gitignored) or set ICPC_CONTEST_UTIL.',
            '# Fix eventFeed.sh to use -cp "$libdir/*" if your zip only lists contestUtil.jar (see upstream ContestUtil/scripts/eventFeed.sh).',
            '# Requires Java. Replace <ICPC_CONTEST_UTIL> with the directory containing eventFeed.sh and lib/.',
            'bash "<ICPC_CONTEST_UTIL>/eventFeed.sh" --testFeed ' +
                shSingleQuote(base) + ' ' + shSingleQuote(u) + ' ' + shSingleQuote(p)
        ].join('\n');
    }

    function buildCurlCommand(st) {
        var parts = ['curl', '-sS', '-X', 'GET', shSingleQuote(st.fullUrl)];
        Object.keys(st.headers).forEach(function (k) {
            parts.push('-H', shSingleQuote(k + ': ' + st.headers[k]));
        });
        return parts.join(' ');
    }

    function buildWgetCommand(st) {
        var parts = ['wget', '-qO-'];
        Object.keys(st.headers).forEach(function (k) {
            parts.push('--header=' + shSingleQuote(k + ': ' + st.headers[k]));
        });
        parts.push(shSingleQuote(st.fullUrl));
        return parts.join(' ');
    }

    function buildHttpieCommand(st) {
        var args = ['http', 'GET', shSingleQuote(st.fullUrl)];
        Object.keys(st.headers).forEach(function (k) {
            args.push(shSingleQuote(k + ':' + st.headers[k]));
        });
        return args.join(' ');
    }

    function buildFetchSnippet(st) {
        var h = JSON.stringify(st.headers, null, 4);
        return 'fetch(' + JSON.stringify(st.fullUrl) + ', {\n' +
            '  method: \'GET\',\n' +
            '  headers: ' + h + '\n' +
            '})\n' +
            '  .then(r => r.text())\n' +
            '  .then(console.log)\n' +
            '  .catch(console.error);';
    }

    function buildPowerShellCommand(st) {
        var uri = String(st.fullUrl).replace(/'/g, "''");
        var lines = ["$uri = '" + uri + "'"];
        lines.push('$headers = @{');
        Object.keys(st.headers).forEach(function (k) {
            var v = String(st.headers[k]).replace(/'/g, "''");
            lines.push("    '" + k.replace(/'/g, "''") + "' = '" + v + "'");
        });
        lines.push('}');
        lines.push('Invoke-RestMethod -Uri $uri -Headers $headers -Method Get');
        return lines.join('\n');
    }

    function randomHex(len) {
        var s = '';
        for (var i = 0; i < len; i++) s += (Math.random() * 16 | 0).toString(16);
        return s;
    }

    function buildPostmanCollection(entry, st) {
        var hdrs = Object.keys(st.headers).map(function (k) {
            return { key: k, value: st.headers[k], type: 'text' };
        });
        return {
            info: {
                name: 'CCS — ' + entry.titleEn + ' (' + entry.id + ')',
                description: entry.descCn + '\n' + entry.descEn,
                schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
                _postman_id: randomHex(8) + '-' + randomHex(4) + '-' + randomHex(4) + '-' + randomHex(4) + '-' + randomHex(12)
            },
            item: [
                {
                    name: entry.titleCn + ' / ' + entry.titleEn,
                    request: {
                        method: 'GET',
                        header: hdrs,
                        url: st.fullUrl,
                        description: 'Imported from CSGOJ cpcsys CCS API console. Apifox: 导入 → Postman 集合.'
                    }
                }
            ]
        };
    }

    function buildHar(entry, st) {
        var headerArr = Object.keys(st.headers).map(function (name) {
            return { name: name, value: st.headers[name] };
        });
        return {
            log: {
                version: '1.2',
                creator: { name: 'CSGOJ CCS Console', version: '1' },
                entries: [
                    {
                        startedDateTime: new Date().toISOString(),
                        time: 0,
                        request: {
                            method: 'GET',
                            url: st.fullUrl,
                            httpVersion: 'HTTP/1.1',
                            headers: headerArr,
                            queryString: [],
                            cookies: [],
                            headersSize: -1,
                            bodySize: 0
                        },
                        response: {
                            status: 0,
                            statusText: '',
                            httpVersion: 'HTTP/1.1',
                            headers: [],
                            content: { size: 0, mimeType: 'application/octet-stream', text: '' },
                            redirectURL: '',
                            headersSize: -1,
                            bodySize: 0
                        },
                        cache: {},
                        timings: { wait: 0, receive: 0 }
                    }
                ]
            }
        };
    }

    function buildOpenApiFragment(entry, st) {
        var origin = window.location.origin;
        var pathKey = entry.pathTpl;
        var params = [];
        var re = /\{([^}]+)\}/g;
        var m;
        while ((m = re.exec(entry.pathTpl)) !== null) {
            params.push({
                name: m[1],
                in: 'path',
                required: true,
                schema: { type: 'string' },
                example: m[1] === 'cid' ? st.cid : (m[1] === 'subId' ? st.sub : '')
            });
        }
        var spec = {
            openapi: '3.0.3',
            info: {
                title: 'CCS — ' + entry.titleEn,
                description: entry.descCn + ' / ' + entry.descEn,
                version: '1.0.0'
            },
            servers: [{ url: origin }],
            paths: {},
            components: {}
        };
        spec.paths[pathKey] = {
            get: {
                summary: entry.titleCn,
                description: entry.descEn,
                parameters: params,
                responses: {
                    '200': { description: 'OK' }
                }
            }
        };
        if (!st.anon && st.headers.Authorization) {
            spec.paths[pathKey].get.security = [{ basicAuth: [] }];
            spec.components.securitySchemes = {
                basicAuth: { type: 'http', scheme: 'basic' }
            };
        }
        return spec;
    }

    function downloadJsonFile(filename, obj) {
        var blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json;charset=utf-8' });
        var a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(a.href);
        if (window.alerty) {
            window.alerty.success('已下载 ' + filename, 'Downloaded ' + filename);
        }
    }

    function handleExport(kind, entry) {
        var st = collectRequestState(entry);
        if (!st.valid) {
            if (window.alerty) {
                if (st.reason === 'sub') {
                    window.alerty.warning(
                        '请先填写「' + subLabelCnForSentence(entry) + '」再导出',
                        'Fill "' + subLabelEnForSentence(entry) + '" before export'
                    );
                } else {
                    window.alerty.warning(
                        '请填写 Basic 用户名与密码，或勾选「匿名请求」后再导出',
                        'Enter Basic credentials or check Anonymous before export'
                    );
                }
            }
            return;
        }

        if (kind === 'curl') {
            copyViaClipboardWrite(buildCurlCommand(st));
        } else if (kind === 'wget') {
            copyViaClipboardWrite(buildWgetCommand(st));
        } else if (kind === 'httpie') {
            copyViaClipboardWrite(buildHttpieCommand(st));
        } else if (kind === 'fetch') {
            copyViaClipboardWrite(buildFetchSnippet(st));
        } else if (kind === 'pwsh') {
            copyViaClipboardWrite(buildPowerShellCommand(st));
        } else if (kind === 'postman') {
            downloadJsonFile('ccs-' + entry.id + '-postman.json', buildPostmanCollection(entry, st));
        } else if (kind === 'har') {
            downloadJsonFile('ccs-' + entry.id + '.har', buildHar(entry, st));
        } else if (kind === 'openapi') {
            downloadJsonFile('ccs-' + entry.id + '-openapi.json', buildOpenApiFragment(entry, st));
        } else if (kind === 'eventfeed_util') {
            copyViaClipboardWrite(buildEventFeedUtilCommand(st));
        }
    }

    function entryHaystack(e) {
        var parts = [
            e.id, e.method, e.pathTpl, e.titleCn, e.titleEn, e.descCn, e.descEn,
            e.authNoteCn, e.authNoteEn, e.subLabelCn, e.subLabelEn
        ];
        if (e.queryDoc) {
            e.queryDoc.forEach(function (q) {
                parts.push(q.key, q.cn, q.en);
            });
        }
        return parts.join(' ').toLowerCase();
    }

    function matchesFilter(e, q) {
        if (!q) return true;
        var hay = entryHaystack(e);
        var terms = q.toLowerCase().trim().split(/\s+/).filter(Boolean);
        for (var i = 0; i < terms.length; i++) {
            if (hay.indexOf(terms[i]) === -1) return false;
        }
        return true;
    }

    /**
     * 锚参数：与 public/static/js/util.js 中 csg.GetAnchor / SetAnchor 一致，
     * 使用 #key=encode(val)#key2=val2 多段格式（见 oj_status / general_formatter）。
     * 写 URL 时用 history.replaceState，与 csgoj/contest/rank.js 更新 hash 方式一致，避免反复入栈。
     */
    var CCS_ANCHOR_KEYS = ['ccs_ep', 'ccs_cid', 'ccs_sub', 'ccs_q', 'ccs_anon'];
    var _ccsIgnoreHash = false;
    var _hashDebounce = null;
    var SESSION_EP_KEY = 'ccs_api_console_ep';

    function parseFullHashSegments() {
        var h = window.location.hash.slice(1);
        if (!h) return {};
        var o = {};
        h.split('#').forEach(function (seg) {
            if (!seg) return;
            var i = seg.indexOf('=');
            if (i <= 0) return;
            var k = seg.slice(0, i);
            var v = seg.slice(i + 1);
            try {
                o[k] = decodeURIComponent(v.replace(/\+/g, ' '));
            } catch (e0) {
                o[k] = v;
            }
        });
        return o;
    }

    function buildHashFromSegs(segs) {
        var parts = [];
        Object.keys(segs).forEach(function (k) {
            var v = segs[k];
            if (v === '' || v === null || v === undefined) return;
            parts.push(k + '=' + encodeURIComponent(String(v)));
        });
        return parts.length ? '#' + parts.join('#') : '';
    }

    function applyCcsStateToSegments(segs, state) {
        var out = Object.assign({}, segs);
        CCS_ANCHOR_KEYS.forEach(function (k) {
            delete out[k];
        });
        if (state.ep) out.ccs_ep = state.ep;
        if (state.cid) out.ccs_cid = state.cid;
        if (state.sub) out.ccs_sub = state.sub;
        if (state.q) out.ccs_q = state.q;
        if (state.anon) out.ccs_anon = '1';
        return out;
    }

    function readCcsStateFromUrl() {
        if (typeof csg !== 'undefined' && csg.GetAnchor) {
            var ep = csg.GetAnchor('ccs_ep') || '';
            var cid = csg.GetAnchor('ccs_cid');
            var sub = csg.GetAnchor('ccs_sub') || '';
            var qv = csg.GetAnchor('ccs_q') || '';
            var anon = csg.GetAnchor('ccs_anon') === '1';
            return { ep: ep, cid: cid, sub: sub, q: qv, anon: anon };
        }
        var segs = parseFullHashSegments();
        return {
            ep: segs.ccs_ep || '',
            cid: segs.ccs_cid != null ? segs.ccs_cid : null,
            sub: segs.ccs_sub || '',
            q: segs.ccs_q || '',
            anon: segs.ccs_anon === '1'
        };
    }

    function mergeUrlHashWithCcsState(state) {
        var segs = parseFullHashSegments();
        segs = applyCcsStateToSegments(segs, state);
        var h = buildHashFromSegs(segs);
        var target = window.location.pathname + window.location.search + h;
        var cur = window.location.pathname + window.location.search + window.location.hash;
        if (target === cur) return;
        _ccsIgnoreHash = true;
        window.history.replaceState(null, '', target);
        setTimeout(function () {
            _ccsIgnoreHash = false;
        }, 0);
        try {
            if (state.ep) sessionStorage.setItem(SESSION_EP_KEY, state.ep);
        } catch (e1) {}
    }

    function captureLiveFormState() {
        var cidEl = document.getElementById('ccs_req_cid');
        if (!cidEl || !currentDetailEntry) return null;
        var subEl = document.getElementById('ccs_req_sub');
        var qEl = document.getElementById('ccs_req_query');
        var anonEl = document.getElementById('ccs_req_anon');
        return {
            ep: currentDetailEntry.id,
            cid: cidEl.value.trim(),
            sub: subEl ? subEl.value.trim() : '',
            q: qEl ? qEl.value.trim() : '',
            anon: !!(anonEl && anonEl.checked)
        };
    }

    function scheduleHashPushFromForm() {
        clearTimeout(_hashDebounce);
        _hashDebounce = setTimeout(function () {
            var st = captureLiveFormState();
            if (st) mergeUrlHashWithCcsState(st);
        }, 280);
    }

    function normalizeFormPrefillFromState(st) {
        var cidDef = cfg.contestId || '';
        var cidVal = (st.cid != null && String(st.cid) !== '') ? String(st.cid) : cidDef;
        return {
            cid: cidVal,
            sub: st.sub != null ? String(st.sub) : '',
            q: st.q != null ? String(st.q) : '',
            anon: !!st.anon
        };
    }

    function renderList(q) {
        listEl.innerHTML = '';
        var n = 0;
        catalog.forEach(function (e) {
            if (!matchesFilter(e, q)) return;
            n++;
            var a = document.createElement('button');
            a.type = 'button';
            a.className = 'list-group-item list-group-item-action py-2 px-3 ccs-api-list-item' +
                (selectedId === e.id ? ' active' : '');
            a.setAttribute('role', 'option');
            a.dataset.id = e.id;
            a.innerHTML = '<div class="d-flex justify-content-between align-items-start gap-2">' +
                '<span class="small fw-semibold text-truncate" title="' + escHtml(e.pathTpl) + '">' +
                escHtml(e.titleCn) + '</span>' +
                '<code class="ccs-api-path-peek small text-muted text-truncate ms-1" style="max-width:45%">' +
                escHtml(e.pathTpl) + '</code></div>' +
                '<div class="small text-muted text-truncate mt-1">' +
                '<span class="en-text">' + escHtml(e.titleEn) + '</span></div>';
            listEl.appendChild(a);
        });
        if (countBadge) countBadge.textContent = String(n);
        if (n === 0) {
            var empty = document.createElement('div');
            empty.className = 'p-3 small text-muted text-center';
            empty.innerHTML = '<span class="cn-text">无匹配端点</span> <span class="en-text">No match</span>';
            listEl.appendChild(empty);
        } else if (selectedId) {
            requestAnimationFrame(function () {
                scrollSelectedListItemIntoView();
            });
        }
    }

    /** 锚点/缓存恢复选中后，列表滚动到当前项（与 renderList 末尾配合） */
    function scrollSelectedListItemIntoView() {
        if (!listEl || !selectedId) return;
        var el = listEl.querySelector('.ccs-api-list-item[data-id="' + selectedId + '"]');
        if (!el) return;
        el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }

    function renderDetail(entry, formPrefill) {
        currentDetailEntry = entry;
        if (!entry) {
            detailEl.innerHTML = '<p class="text-muted small mb-0">' +
                '<span class="cn-text">请选择端点。</span> <span class="en-text">Pick an endpoint.</span></p>';
            return;
        }
        var fp = normalizeFormPrefillFromState(formPrefill || {});
        var qRows = '';
        if (entry.queryDoc && entry.queryDoc.length) {
            qRows = '<tr><th colspan="2" class="small py-1">' +
                '<span class="cn-text">查询参数</span> / <span class="en-text">Query</span></th></tr>';
            entry.queryDoc.forEach(function (q) {
                qRows += '<tr><td><code>' + escHtml(q.key) + '</code></td><td class="small">' +
                    escHtml(q.cn) + ' <span class="en-text">' + escHtml(q.en) + '</span></td></tr>';
            });
        }
        var subHint = '';
        if (entry.subRequired || entry.subOptional) {
            subHint = '<label class="form-label form-label-sm mb-1 ccs-sub-param-label" for="ccs_req_sub">' +
                '<span class="ccs-sub-param-label-cn-req">' +
                escHtml(entry.subLabelCn || '路径后缀') +
                (entry.subRequired ? '<span class="text-danger">*</span>' : '') +
                '</span> ' +
                '<span class="en-text">' + escHtml(entry.subLabelEn || 'Path segment') + '</span>' +
                '</label>';
        }

        var kindNote = '';
        if (entry.responseKind === 'ndjson') {
            kindNote = '<div class="alert alert-info py-2 px-2 small mb-2">' +
                '<span class="cn-text">长流接口：本页只预览前面一小段（约 256KB 或 400 行）。若经常中断，请联系运维核对 PHP-FPM 与反向代理超时（详见开发文档 <code>docs/guide/07.ICPC与CCS比赛API.md</code> 第 10 节）。需要长时间完整接收时，可用下方「EventFeedUtil」复制命令在终端里测。</span> ' +
                '<span class="en-text">Stream preview only (~256KB or 400 lines). If it drops often, ask ops to check PHP-FPM and proxy timeouts (see doc section 10). For a full long run, use EventFeedUtil export below.</span></div>';
        } else if (entry.responseKind === 'blob') {
            kindNote = '<div class="alert alert-info py-2 px-2 small mb-2">' +
                '<span class="cn-text">本接口返回文件（如 zip）：成功时下方会出现下载按钮或显示大小。</span> ' +
                '<span class="en-text">File response (e.g. zip): a download button or size appears below when OK.</span></div>';
        }

        detailEl.innerHTML =
            kindNote +
            '<h6 class="mb-2">' + escHtml(entry.titleCn) + ' <span class="en-text text-muted">' +
            escHtml(entry.titleEn) + '</span></h6>' +
            '<p class="small mb-2">' + escHtml(entry.descCn) +
            ' <span class="en-text text-muted">' + escHtml(entry.descEn) + '</span></p>' +
            '<table class="table table-sm table-bordered mb-3 ccs-api-meta-table">' +
            '<tbody>' +
            '<tr><th class="w-25 small">Method</th><td><code>' + escHtml(entry.method) + '</code></td></tr>' +
            '<tr><th class="small"><span class="cn-text">路径模板</span><span class="en-text">Path</span></th>' +
            '<td><code class="small">' + escHtml(entry.pathTpl) + '</code></td></tr>' +
            '<tr><th class="small"><span class="cn-text">鉴权说明</span><span class="en-text">Auth</span></th>' +
            '<td class="small">' + escHtml(entry.authNoteCn) +
            ' <span class="en-text text-muted">' + escHtml(entry.authNoteEn) + '</span></td></tr>' +
            qRows +
            '</tbody></table>' +
            '<div class="card bg-light border-0 mb-2">' +
            '<div class="card-body p-2 p-md-3">' +
            '<div class="row g-2">' +
            (function () {
                var needsCid = entryNeedsCid(entry);
                var contestBlock = '';
                if (needsCid) {
                    contestBlock =
                        '<div class="col-md-4">' +
                        '<label class="form-label form-label-sm mb-1"><span class="cn-text">比赛 ID</span> <span class="en-text">Contest id</span></label>' +
                        '<input type="text" class="form-control form-control-sm" id="ccs_req_cid" value="' +
                        escHtml(fp.cid) + '">' +
                        '</div>';
                } else {
                    contestBlock =
                        '<input type="hidden" id="ccs_req_cid" value="' + escHtml(fp.cid) + '">' +
                        '<div class="col-12">' +
                        '<p class="small text-muted mb-2 mb-md-0">' +
                        '<span class="cn-text">本接口地址里不含比赛 ID，无需填写该项。</span> ' +
                        '<span class="en-text">No contest id in this URL.</span>' +
                        '</p></div>';
                }
                var subInner = subHint + buildSubFieldHtml(entry, fp);
                if (!subInner) return contestBlock;
                var subCol = needsCid ? 'col-md-8' : 'col-12';
                return contestBlock + '<div class="' + subCol + '">' + subInner + '</div>';
            })() +
            '<div class="col-12">' +
            '<label class="form-label form-label-sm mb-1"><span class="cn-text">查询参数</span> <span class="en-text">Query</span>' +
            ' <span class="text-muted small"><span class="cn-text">可选，拼在 URL 后，如</span> <code class="small">since_token=…</code>、<code class="small">team_id=…</code></span></label>' +
            '<input type="text" class="form-control form-control-sm" id="ccs_req_query" placeholder="since_token=..." value="' +
            escHtml(fp.q) + '">' +
            '</div>' +
            '<div class="col-12"><div class="form-check form-check-inline">' +
            '<input class="form-check-input" type="checkbox" id="ccs_req_anon"' + (fp.anon ? ' checked' : '') + '>' +
            '<label class="form-check-label small" for="ccs_req_anon">' +
            '<span class="cn-text">匿名请求（不传 Basic）</span> <span class="en-text">Anonymous (no Basic)</span>' +
            '</label></div></div>' +
            '<div class="col-md-6">' +
            '<label class="form-label form-label-sm mb-1">Basic <span class="cn-text">用户名</span> / user</label>' +
            '<input type="text" class="form-control form-control-sm" id="ccs_req_user" autocomplete="username">' +
            '</div>' +
            '<div class="col-md-6">' +
            '<label class="form-label form-label-sm mb-1">Basic <span class="cn-text">密码</span> / password</label>' +
            '<input type="password" class="form-control form-control-sm" id="ccs_req_pass" autocomplete="current-password">' +
            '</div>' +
            '<div class="col-12 d-flex flex-wrap gap-2 align-items-center pt-1">' +
            '<button type="button" class="btn btn-primary btn-sm" id="ccs_req_send">' +
            '<span class="cn-text">发送请求</span> <span class="en-text">Send</span></button>' +
            '<button type="button" class="btn btn-outline-secondary btn-sm" id="ccs_req_abort" disabled>' +
            '<span class="cn-text">中止</span> <span class="en-text">Abort</span></button>' +
            '<span class="small text-muted flex-grow-1 min-w-0" id="ccs_req_url_preview"></span>' +
            '</div>' +
            '<div class="col-12 ccs-export-toolbar">' +
            '<div class="small text-muted mb-1 text-nowrap">' +
            '<span class="cn-text">导出到其他工具</span> · <span class="en-text">Export to tools</span>' +
            '</div>' +
            '<div class="d-flex flex-wrap align-items-center gap-1">' +
            '<div class="btn-group btn-group-sm" role="group" title="终端 / Shell">' +
            '<button type="button" class="btn btn-outline-secondary" data-ccs-export="curl" title="复制 cURL 命令">cURL</button>' +
            '<button type="button" class="btn btn-outline-secondary" data-ccs-export="wget" title="复制 wget 命令">wget</button>' +
            '<button type="button" class="btn btn-outline-secondary" data-ccs-export="httpie" title="复制 HTTPie (http)">httpie</button>' +
            '</div>' +
            '<div class="btn-group btn-group-sm" role="group" title="脚本">' +
            '<button type="button" class="btn btn-outline-secondary" data-ccs-export="fetch" title="复制浏览器 fetch()">fetch</button>' +
            '<button type="button" class="btn btn-outline-secondary" data-ccs-export="pwsh" title="复制 PowerShell Invoke-RestMethod">PS</button>' +
            '</div>' +
            '<div class="btn-group btn-group-sm" role="group" title="下载 JSON 后导入">' +
            '<button type="button" class="btn btn-outline-primary" data-ccs-export="postman" ' +
            'title="Postman / Apifox（导入 → Postman）">Postman</button>' +
            '<button type="button" class="btn btn-outline-primary" data-ccs-export="openapi" ' +
            'title="OpenAPI 3（Apifox / Stoplight / Swagger UI）">OpenAPI</button>' +
            '<button type="button" class="btn btn-outline-primary" data-ccs-export="har" ' +
            'title="HAR 1.2（Chrome / Fiddler / 多工具）">HAR</button>' +
            '</div>' +
            (entry.id === 'event_feed'
                ? '<div class="btn-group btn-group-sm" role="group" title="ICPC Contest Utilities">' +
                  '<button type="button" class="btn btn-outline-secondary" data-ccs-export="eventfeed_util" ' +
                  'title="复制 EventFeedUtil bash --testFeed（替换 &lt;ICPC_CONTEST_UTIL&gt;）">' +
                  'EventFeedUtil</button></div>'
                : '') +
            '</div>' +
            '</div>' +
            '</div></div></div>' +
            '<div class="mb-1 d-flex align-items-center gap-1 flex-wrap">' +
            '<span class="small fw-semibold"><span class="cn-text">响应</span> <span class="en-text">Response</span></span>' +
            '<button type="button" class="btn btn-link btn-sm py-0 px-1 lh-1 ccs-res-copy-btn d-none" id="ccs_res_copy_btn" ' +
            'aria-hidden="true" title="复制响应（状态行与正文）/ Copy response (status + body)">' +
            '<i class="bi bi-clipboard" aria-hidden="true"></i>' +
            '<span class="visually-hidden"><span class="cn-text">复制响应</span> Copy response</span></button></div>' +
            '<div class="ccs-api-response border rounded small p-2 mb-0 ccs-api-response--msg" id="ccs_req_out">' +
            '<span class="text-muted">—</span></div>' +
            '<div class="mt-2" id="ccs_req_blob_actions"></div>';

        updateUrlPreview(entry);
        document.getElementById('ccs_req_send').addEventListener('click', function () { runRequest(entry); });
        document.getElementById('ccs_req_abort').addEventListener('click', function () {
            if (abortCtrl) abortCtrl.abort();
        });
        var anonEl = document.getElementById('ccs_req_anon');
        var uEl = document.getElementById('ccs_req_user');
        var pEl = document.getElementById('ccs_req_pass');
        function syncAuthFields() {
            var dis = anonEl && anonEl.checked;
            if (uEl) uEl.disabled = !!dis;
            if (pEl) pEl.disabled = !!dis;
        }
        if (anonEl) {
            anonEl.addEventListener('change', function () {
                syncAuthFields();
                scheduleHashPushFromForm();
            });
            syncAuthFields();
        }
        function bindPreviewAndHash(el) {
            if (!el) return;
            function h() {
                updateUrlPreview(entry);
                scheduleHashPushFromForm();
            }
            el.addEventListener('input', h);
            el.addEventListener('change', h);
        }
        bindPreviewAndHash(document.getElementById('ccs_req_cid'));
        bindPreviewAndHash(document.getElementById('ccs_req_sub'));
        bindPreviewAndHash(document.getElementById('ccs_req_query'));
        var resCopyBtn = document.getElementById('ccs_res_copy_btn');
        if (resCopyBtn) {
            resCopyBtn.addEventListener('click', function () {
                copyResponsePanelToClipboard(resCopyBtn);
            });
        }
    }

    function updateUrlPreview(entry) {
        var prev = document.getElementById('ccs_req_url_preview');
        if (!prev || !entry) return;
        var cid = (document.getElementById('ccs_req_cid') && document.getElementById('ccs_req_cid').value) || cfg.contestId || '';
        var sub = document.getElementById('ccs_req_sub') ? document.getElementById('ccs_req_sub').value.trim() : '';
        var query = document.getElementById('ccs_req_query') ? document.getElementById('ccs_req_query').value.trim() : '';
        if (entry.subRequired && !sub) {
            prev.innerHTML = missingSubUserPreviewHtml(entry);
            return;
        }
        var path = buildPath(entry, cid, sub);
        var url = buildUrl(path, query);
        prev.innerHTML = '<code class="small">' + escHtml(url) + '</code>';
    }

    function setOut(html, isError) {
        var out = document.getElementById('ccs_req_out');
        if (!out) return;
        setResponseCopyBtnVisible(false);
        out.classList.toggle('text-danger', !!isError);
        out.classList.add('ccs-api-response--msg');
        out.innerHTML = html;
    }

    /**
     * 解析是否为合法 JSON；失败则按原文展示（高亮为 plaintext），永不抛错到页面。
     */
    function safeClassifyJsonText(raw) {
        var text = raw == null ? '' : String(raw);
        var trimmed = text.replace(/^\uFEFF/, '').trim();
        if (!trimmed.length) {
            return { isJson: false, display: text };
        }
        var c0 = trimmed[0];
        if (c0 !== '{' && c0 !== '[') {
            return { isJson: false, display: text };
        }
        try {
            var obj = JSON.parse(trimmed);
            return { isJson: true, display: JSON.stringify(obj, null, 2) };
        } catch (e0) {
            return { isJson: false, display: text };
        }
    }

    function tryHighlightResponseCode(codeEl) {
        if (!codeEl) return;
        try {
            if (typeof CsgCodeHighlight !== 'undefined' &&
                typeof CsgCodeHighlight.highlightElementSafe === 'function') {
                CsgCodeHighlight.highlightElementSafe(codeEl);
            } else if (typeof hljs !== 'undefined' && typeof hljs.highlightElement === 'function') {
                try {
                    hljs.highlightElement(codeEl);
                } catch (e1) { /* 容错 */ }
            }
        } catch (e2) { /* 容错：无高亮仍显示原文 */ }
    }

    /**
     * 状态行 + 正文：正文用 pre/code + textContent，再走 CsgCodeHighlight（JSON 或 plaintext）
     */
    function setOutResponseBody(statusLine, bodyText, isError, lang) {
        var out = document.getElementById('ccs_req_out');
        if (!out) return;
        setResponseCopyBtnVisible(true);
        out.classList.remove('ccs-api-response--msg');
        out.classList.toggle('text-danger', !!isError);
        out.innerHTML = '';
        var line = (statusLine != null ? String(statusLine) : '').replace(/\n+$/g, '');
        if (line.length) {
            var st = document.createElement('div');
            st.className = 'ccs-api-res-status small text-muted mb-1 font-monospace';
            st.textContent = line;
            out.appendChild(st);
        }
        var body = bodyText == null ? '' : String(bodyText);
        var pre = document.createElement('pre');
        pre.className = 'mb-0 ccs-api-res-pre border-0';
        var code = document.createElement('code');
        code.className = lang === 'json' ? 'language-json' : 'language-plaintext';
        code.textContent = body;
        pre.appendChild(code);
        out.appendChild(pre);
        requestAnimationFrame(function () {
            tryHighlightResponseCode(code);
        });
    }

    function runRequest(entry) {
        var st = collectRequestState(entry);
        if (!st.valid) {
            if (st.reason === 'sub') {
                setOut(missingSubUserErrorHtml(entry), true);
            } else {
                setOut(missingAuthUserErrorHtml(), true);
            }
            return;
        }

        var fullUrl = st.fullUrl;
        var headers = st.headers;
        var sub = st.sub;

        if (abortCtrl) abortCtrl.abort();
        abortCtrl = new AbortController();
        var sendBtn = document.getElementById('ccs_req_send');
        var abortBtn = document.getElementById('ccs_req_abort');
        if (sendBtn) sendBtn.disabled = true;
        if (abortBtn) abortBtn.disabled = false;

        var blobDiv = document.getElementById('ccs_req_blob_actions');
        if (blobDiv) blobDiv.innerHTML = '';

        setOut('<span class="text-muted"><span class="cn-text">请求中…</span> Loading…</span>', false);

        if (entry.responseKind === 'ndjson') {
            fetchNdjsonPreview(fullUrl, headers, abortCtrl.signal, sendBtn, abortBtn);
            return;
        }

        fetch(fullUrl, { method: 'GET', headers: headers, signal: abortCtrl.signal })
            .then(function (res) {
                if (entry.responseKind === 'blob') {
                    return res.blob().then(function (blob) {
                        return { res: res, blob: blob };
                    });
                }
                return res.text().then(function (t) {
                    return { res: res, text: t };
                });
            })
            .then(function (data) {
                var res = data.res;
                if (entry.responseKind === 'blob') {
                    var blob = data.blob;
                    var ct = res.headers.get('Content-Type') || '';
                    var meta = 'Content-Type: ' + ct + '\nSize: ' + blob.size + ' bytes\n';
                    setOutResponseBody(res.status + ' ' + res.statusText, meta, !res.ok, 'plaintext');
                    if (blobDiv && blob.size > 0) {
                        var a = document.createElement('a');
                        a.className = 'btn btn-sm btn-outline-primary';
                        a.href = URL.createObjectURL(blob);
                        var safe = String(sub || 'files').replace(/[^\w.-]+/g, '_').slice(0, 80);
                        a.download = 'submission-' + safe + '.zip';
                        a.textContent = 'Download zip';
                        blobDiv.appendChild(a);
                    }
                    return;
                }
                var text = data.text;
                var classified = safeClassifyJsonText(text);
                setOutResponseBody(res.status + ' ' + res.statusText, classified.display, !res.ok,
                    classified.isJson ? 'json' : 'plaintext');
            })
            .catch(function (err) {
                if (err.name === 'AbortError') {
                    setOut('<span class="cn-text">已中止</span> Aborted', false);
                } else {
                    setOut(escHtml(String(err)), true);
                }
            })
            .then(function () {
                finishReq(sendBtn, abortBtn);
            });
    }

    function finishReq(sendBtn, abortBtn) {
        if (sendBtn) sendBtn.disabled = false;
        if (abortBtn) abortBtn.disabled = true;
        abortCtrl = null;
    }

    function fetchNdjsonPreview(fullUrl, headers, signal, sendBtn, abortBtn) {
        var maxBytes = 262144;
        var maxLines = 400;
        fetch(fullUrl, { method: 'GET', headers: headers, signal: signal })
            .then(function (res) {
                var statusLine = res.status + ' ' + res.statusText;
                if (!res.ok || !res.body) {
                    return res.text().then(function (t) {
                        var cl = safeClassifyJsonText(t);
                        setOutResponseBody(statusLine, cl.display, true, cl.isJson ? 'json' : 'plaintext');
                    });
                }
                var reader = res.body.getReader();
                var dec = new TextDecoder();
                var buf = '';

                function readChunk() {
                    return reader.read().then(function (chunk) {
                        if (chunk.done) {
                            setOutResponseBody(statusLine, buf + '\n\n[EOF]', false, 'plaintext');
                            return;
                        }
                        buf += dec.decode(chunk.value, { stream: true });
                        var lineCount = buf.split('\n').length - 1;
                        var bytes = new TextEncoder().encode(buf).length;
                        if (bytes >= maxBytes || lineCount >= maxLines) {
                            reader.cancel().catch(function () {});
                            setOutResponseBody(statusLine, buf + '\n\n---\n[Preview truncated / 预览截断]', false,
                                'plaintext');
                            return;
                        }
                        return readChunk();
                    });
                }
                return readChunk();
            })
            .catch(function (err) {
                if (err.name === 'AbortError') {
                    setOut('<span class="cn-text">已中止</span> Aborted', false);
                } else {
                    var msg = String(err);
                    if (/premature|chunked|network|failed to fetch|load failed/i.test(msg)) {
                        msg += '\n\n提示：长连接被中间层关闭时常见。请检查 PHP-FPM request_terminate_timeout、反向代理 read timeout / buffering，并确认已部署 event-feed 首字节保活与逐行 flush（见 docs/guide/07.ICPC与CCS比赛API.md §10）。';
                    }
                    setOut(escHtml(msg), true);
                }
            })
            .then(function () {
                finishReq(sendBtn, abortBtn);
            });
    }

    listEl.addEventListener('click', function (ev) {
        var btn = ev.target.closest('.ccs-api-list-item');
        if (!btn) return;
        var id = btn.dataset.id;
        var next = captureLiveFormState();
        if (!next) {
            next = {
                ep: id,
                cid: cfg.contestId || '',
                sub: '',
                q: '',
                anon: false
            };
        } else {
            next.ep = id;
        }
        mergeUrlHashWithCcsState(next);
        selectedId = id;
        renderList(searchEl ? searchEl.value : '');
        var entry = catalog.filter(function (e) { return e.id === id; })[0];
        renderDetail(entry, next);
    });

    if (searchEl) {
        searchEl.addEventListener('input', function () {
            renderList(searchEl.value);
        });
    }

    detailEl.addEventListener('click', function (ev) {
        var btn = ev.target.closest('[data-ccs-export]');
        if (!btn) return;
        ev.preventDefault();
        var kind = btn.getAttribute('data-ccs-export');
        if (!currentDetailEntry || !kind) return;
        handleExport(kind, currentDetailEntry);
    });

    window.addEventListener('hashchange', function () {
        if (_ccsIgnoreHash) return;
        var st = readCcsStateFromUrl();
        if (!st.ep || !catalog.some(function (e) { return e.id === st.ep; })) return;
        selectedId = st.ep;
        renderList(searchEl ? searchEl.value : '');
        var he = catalog.filter(function (e) { return e.id === st.ep; })[0];
        renderDetail(he, st);
    });

    renderList('');

    (function initFromAnchor() {
        var st = readCcsStateFromUrl();
        var ep = st.ep;
        if (!ep || !catalog.some(function (e) { return e.id === ep; })) {
            try {
                var sv = sessionStorage.getItem(SESSION_EP_KEY);
                if (sv && catalog.some(function (e) { return e.id === sv; })) {
                    ep = sv;
                    st.ep = ep;
                    st.cid = st.cid != null && String(st.cid) !== '' ? st.cid : (cfg.contestId || '');
                    mergeUrlHashWithCcsState({
                        ep: ep,
                        cid: st.cid || '',
                        sub: st.sub || '',
                        q: st.q || '',
                        anon: st.anon
                    });
                }
            } catch (e2) {}
        }
        if (ep && catalog.some(function (e) { return e.id === ep; })) {
            selectedId = ep;
            renderList(searchEl ? searchEl.value : '');
            var he = catalog.filter(function (e) { return e.id === ep; })[0];
            renderDetail(he, st);
        }
    })();
})();
