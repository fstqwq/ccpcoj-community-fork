/**
 * 直播控制台（管理端）
 */
(function () {
    const cid = window.CONTEST_LIVE_CID;
    if (!cid) {
        return;
    }

    const LVKEY = 'contestlive_lvtk_' + cid;

    const sendBtn = document.getElementById('contestlive_command_send');
    const inputEl = document.getElementById('contestlive_command_input');
    const feedbackEl = document.getElementById('contestlive_send_feedback');
    const logList = document.getElementById('contestlive_log_list');
    const refreshBtn = document.getElementById('contestlive_log_refresh');
    const tickerFixedInput = document.getElementById('contestlive_ticker_fixed_input');
    const tickerFixedSaveBtn = document.getElementById('contestlive_ticker_fixed_save');
    const tickerFixedFeedback = document.getElementById('contestlive_ticker_fixed_feedback');
    const hubCopyOkEl = document.getElementById('contestlive_hub_copy_ok');

    const tokenIssueBtn = document.getElementById('contestlive_token_issue');
    const tokenRevokeBtn = document.getElementById('contestlive_token_revoke');
    const tokenTtl = document.getElementById('contestlive_token_ttl');
    const tokenMeta = document.getElementById('contestlive_token_meta');
    const tokenErr = document.getElementById('contestlive_token_err');

    const logoPick = document.getElementById('contestlive_logo_pick');
    const logoAddBtn = document.getElementById('contestlive_logo_add_btn');
    const logoGrid = document.getElementById('contestlive_logo_grid');
    const logoEmpty = document.getElementById('contestlive_logo_empty');
    const logoErr = document.getElementById('contestlive_logo_err');
    const logoReplacePick = document.getElementById('contestlive_logo_replace_pick');
    let logoReplaceTarget = null;
    let logoReorderTimer = null;
    let logoOrderSaving = false;

    const rowModalEl = document.getElementById('contestlive_row_modal');

    const SKIN_VALID = { default: true, dark_stage: true, light_macaron: true };
    const SKIN_LABEL_CN = { default: '默认', dark_stage: '暗色', light_macaron: '明亮' };
    const SKIN_LABEL_EN = { default: 'Default', dark_stage: 'Dark', light_macaron: 'Light' };
    /** 与 ContestliveDisplayAddition::SCHOOLWALL_LAYOUT_IDS、contestlive_schoolwall_layouts.js ORDER 一致 */
    const SCHOOLWALL_LAYOUT_IDS = [
        'grid',
        'stagger_rows',
        'hex',
        'rhythm',
        'mosaic',
        'radial',
        'spiral',
        'arc_rings',
        'petals',
        'frame',
        'scatter',
    ];
    const SCHOOLWALL_LAYOUT_VALID = {};
    for (let _si = 0; _si < SCHOOLWALL_LAYOUT_IDS.length; _si++) {
        SCHOOLWALL_LAYOUT_VALID[SCHOOLWALL_LAYOUT_IDS[_si]] = true;
    }
    const SCHOOLWALL_LAYOUT_LABEL_CN = {
        grid: '网格平铺',
        stagger_rows: '砖纹行错位',
        hex: '蜂窝',
        rhythm: '棋盘缩放',
        mosaic: '马赛克砖纹',
        radial: '向日葵螺旋',
        spiral: '阿基米德螺旋',
        arc_rings: '同心椭圆环',
        petals: '花瓣放射',
        frame: '相框围合',
        scatter: '随机散点',
    };
    const PAGE_LABEL_CN = {
        live: '主直播画面',
        live_timer: '比赛计时',
        live_queue: '评测队列',
        live_ac: '最新过题',
        live_combo: '队列·过题·气球',
        live_probstats: '各题统计',
        live_rank: '直播榜单',
        live_balloon: '气球层',
        live_schoolwall: '校徽墙',
    };
    const PAGE_LABEL_EN = {
        live: 'Main live display',
        live_timer: 'Contest timer',
        live_queue: 'Submissions',
        live_ac: 'Recent AC',
        live_combo: 'Queue · AC · balloons',
        live_probstats: 'Verdict chart',
        live_rank: 'Live scoreboard',
        live_balloon: 'Balloons',
        live_schoolwall: 'School badges',
    };

    function pageLabelCn(page) {
        return PAGE_LABEL_CN[page] || '该页面';
    }

    function pageLabelEn(page) {
        return PAGE_LABEL_EN[page] || 'This page';
    }

    function getDisplayConfig() {
        const c = window.CONTEST_LIVE_DISPLAY_CONFIG;
        if (c && typeof c === 'object') {
            return c;
        }
        return { skin_global: 'default', skin_pages: {}, hud_title: '', schoolwall_layout: 'grid', ticker_fixed: '' };
    }

    function applyLiveDisplayServerPayload(ld) {
        if (!ld || typeof ld !== 'object') {
            return;
        }
        const pages = ld.skin_pages && typeof ld.skin_pages === 'object' ? ld.skin_pages : {};
        const swRaw = typeof ld.schoolwall_layout === 'string' ? ld.schoolwall_layout.trim() : '';
        const sw = swRaw !== '' && SCHOOLWALL_LAYOUT_VALID[swRaw] ? swRaw : 'grid';
        window.CONTEST_LIVE_DISPLAY_CONFIG = {
            skin_global: SKIN_VALID[ld.skin_global] ? ld.skin_global : 'default',
            skin_pages: pages,
            hud_title: typeof ld.hud_title === 'string' ? ld.hud_title : '',
            schoolwall_layout: sw,
            ticker_fixed: typeof ld.ticker_fixed === 'string' ? ld.ticker_fixed : '',
        };
    }

    function currentStoredGlobalSkin() {
        const g = getDisplayConfig().skin_global;
        return g && SKIN_VALID[g] ? g : 'default';
    }

    function ensurePageSkinSelectOptions(sel) {
        if (sel.dataset.contestliveSkinInit === '2') {
            return;
        }
        sel.innerHTML = '';
        sel.dataset.contestliveSkinInit = '2';
        const opts = [
            { v: 'default', label: '默认' },
            { v: 'dark_stage', label: '暗色' },
            { v: 'light_macaron', label: '明亮' }
        ];
        for (let i = 0; i < opts.length; i++) {
            const o = document.createElement('option');
            o.value = opts[i].v;
            o.textContent = opts[i].label;
            sel.appendChild(o);
        }
    }

    function effectivePageSkin(page) {
        const cfg = getDisplayConfig();
        const g = SKIN_VALID[cfg.skin_global] ? cfg.skin_global : 'default';
        const pages = cfg.skin_pages || {};
        const raw = pages[page];
        return raw && SKIN_VALID[raw] ? raw : g;
    }

    function syncPageSkinSelects() {
        document.querySelectorAll('select.contestlive-ctrl-skin-page').forEach(function (sel) {
            ensurePageSkinSelectOptions(sel);
            const page = sel.getAttribute('data-live-page');
            if (!page) {
                return;
            }
            sel.value = effectivePageSkin(page);
        });
    }

    function storedSchoolwallLayout() {
        const cfg = getDisplayConfig();
        const v = cfg && typeof cfg.schoolwall_layout === 'string' ? cfg.schoolwall_layout.trim() : '';
        return v !== '' && SCHOOLWALL_LAYOUT_VALID[v] ? v : 'grid';
    }

    function ensureSchoolwallLayoutSelectOptions(sel) {
        if (sel.dataset.contestliveLayoutInit === '1') {
            return;
        }
        sel.dataset.contestliveLayoutInit = '1';
        sel.innerHTML = '';
        for (let i = 0; i < SCHOOLWALL_LAYOUT_IDS.length; i++) {
            const id = SCHOOLWALL_LAYOUT_IDS[i];
            const o = document.createElement('option');
            o.value = id;
            o.textContent = SCHOOLWALL_LAYOUT_LABEL_CN[id] || id;
            sel.appendChild(o);
        }
    }

    function syncSchoolwallLayoutSelects() {
        document.querySelectorAll('select.contestlive-ctrl-schoolwall-layout').forEach(function (sel) {
            ensureSchoolwallLayoutSelectOptions(sel);
            sel.value = storedSchoolwallLayout();
        });
    }

    function syncCtrlSkinButtons() {
        const cur = currentStoredGlobalSkin();
        document.querySelectorAll('.contestlive-ctrl-skin-batch').forEach(function (btn) {
            const id = btn.getAttribute('data-contestlive-skin');
            const on = id === cur;
            btn.classList.toggle('btn-primary', on);
            btn.classList.toggle('btn-outline-secondary', !on);
        });
        syncPageSkinSelects();
        syncSchoolwallLayoutSelects();
    }

    function escapeHtml(s) {
        return String(s || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function skinFeedback(msg) {
        const fb = document.getElementById('contestlive_ctrl_skin_feedback');
        if (fb) {
            fb.textContent = msg;
        }
    }

    function skinFeedbackBilingual(cn, en) {
        const fb = document.getElementById('contestlive_ctrl_skin_feedback');
        if (fb) {
            fb.innerHTML =
                '<span class="cn-text d-block">' +
                escapeHtml(cn) +
                '</span><span class="en-text d-block small text-muted">' +
                escapeHtml(en) +
                '</span>';
        }
    }

    async function batchUnifyDisplaySkin(skin) {
        const id = SKIN_VALID[skin] ? skin : 'default';
        try {
            const ret = await csg.ajax(
                'POST',
                '/ojtool/contestlive/live_display_config_save_ajax',
                { cid: cid, op: 'batch_skin', skin: id },
                {},
                'json',
                'form'
            );
            if (ret && parseInt(ret.code, 10) === 1 && ret.data && ret.data.live_display) {
                applyLiveDisplayServerPayload(ret.data.live_display);
                syncCtrlSkinButtons();
                skinFeedbackBilingual(
                    '已保存为「' + (SKIN_LABEL_CN[id] || id) + '」，各页外观已写入服务器。投屏页可按 <kbd>G</kbd> 从服务器同步，或整页刷新。',
                    'Saved as "' + (SKIN_LABEL_EN[id] || SKIN_LABEL_CN[id] || id) + '". On each display page press G to pull this config, or reload the tab.'
                );
            } else {
                skinFeedbackBilingual((ret && ret.msg) ? ret.msg : '保存失败', (ret && ret.msg) ? ret.msg : 'Save failed');
            }
        } catch (e) {
            skinFeedbackBilingual('网络错误', 'Network error');
            console.error(e);
        }
    }

    async function saveSchoolwallLayoutToServer(layoutId) {
        const id = SCHOOLWALL_LAYOUT_VALID[layoutId] ? layoutId : 'grid';
        try {
            const ret = await csg.ajax(
                'POST',
                '/ojtool/contestlive/live_display_config_save_ajax',
                { cid: cid, op: 'schoolwall_layout', schoolwall_layout: id },
                {},
                'json',
                'form'
            );
            if (ret && parseInt(ret.code, 10) === 1 && ret.data && ret.data.live_display) {
                applyLiveDisplayServerPayload(ret.data.live_display);
                syncSchoolwallLayoutSelects();
                skinFeedbackBilingual(
                    '已保存校徽墙布局为「' + (SCHOOLWALL_LAYOUT_LABEL_CN[id] || id) + '」。投屏页可按 <kbd>G</kbd> 同步，或整页刷新。',
                    'School wall layout saved. Press G on the display page to pull, or reload.'
                );
            } else {
                skinFeedbackBilingual((ret && ret.msg) ? ret.msg : '保存失败', (ret && ret.msg) ? ret.msg : 'Save failed');
            }
        } catch (e) {
            skinFeedbackBilingual('网络错误', 'Network error');
            console.error(e);
        }
    }

    async function savePageSkinToServer(page, skinVal) {
        try {
            const ret = await csg.ajax(
                'POST',
                '/ojtool/contestlive/live_display_config_save_ajax',
                { cid: cid, op: 'page_skin', page: page, skin: skinVal },
                {},
                'json',
                'form'
            );
            if (ret && parseInt(ret.code, 10) === 1 && ret.data && ret.data.live_display) {
                applyLiveDisplayServerPayload(ret.data.live_display);
                syncCtrlSkinButtons();
                skinFeedbackBilingual(
                    '已保存「' + pageLabelCn(page) + '」的外观。对应投屏页可按 <kbd>G</kbd> 同步，或整页刷新。',
                    'Saved appearance for "' + pageLabelEn(page) + '". Press G on that display page to pull, or reload.'
                );
            } else {
                skinFeedbackBilingual((ret && ret.msg) ? ret.msg : '保存失败', (ret && ret.msg) ? ret.msg : 'Save failed');
            }
        } catch (e) {
            skinFeedbackBilingual('网络错误', 'Network error');
            console.error(e);
        }
    }

    async function flushHudTitleToServer() {
        const inp = document.getElementById('contestlive_hud_title_for_url');
        const saveBtn = document.getElementById('contestlive_hud_title_save_btn');
        const v = inp ? String(inp.value || '').trim() : '';
        if (saveBtn) {
            saveBtn.disabled = true;
        }
        try {
            const ret = await csg.ajax(
                'POST',
                '/ojtool/contestlive/live_display_config_save_ajax',
                { cid: cid, op: 'hud_title', hud_title: v },
                {},
                'json',
                'form'
            );
            if (ret && parseInt(ret.code, 10) === 1 && ret.data && ret.data.live_display) {
                applyLiveDisplayServerPayload(ret.data.live_display);
                syncLiveDisplayUrls();
                skinFeedbackBilingual('显示标题已保存到比赛设置。', 'Display title saved to contest settings.');
            } else {
                skinFeedbackBilingual((ret && ret.msg) ? ret.msg : '保存失败', (ret && ret.msg) ? ret.msg : 'Save failed');
            }
        } catch (e) {
            skinFeedbackBilingual('网络错误', 'Network error');
            console.error(e);
        } finally {
            if (saveBtn) {
                saveBtn.disabled = false;
            }
        }
    }

    function formatTime(ts) {
        if (!ts) {
            return '';
        }
        const d = new Date(ts * 1000);
        return d.toLocaleString();
    }

    function flashErr(el, msg) {
        if (!el) {
            return;
        }
        if (msg) {
            el.textContent = msg;
            el.classList.remove('d-none');
        } else {
            el.textContent = '';
            el.classList.add('d-none');
        }
    }

    /** 徽标区等：与双语 Ajax 错误（data.msg_cn/msg_en）一致 */
    function flashErrBilingual(el, cn, en) {
        if (!el) {
            return;
        }
        const a = String(cn || '').trim();
        const b = String(en || '').trim();
        if (!a && !b) {
            flashErr(el, '');
            return;
        }
        el.innerHTML =
            '<span class="cn-text d-block">' +
            escapeHtml(a || b) +
            '</span><span class="en-text d-block small text-muted">' +
            escapeHtml(b || a) +
            '</span>';
        el.classList.remove('d-none');
    }

    async function revokeCommand(commandId, btn) {
        if (!commandId || !btn) {
            return;
        }
        btn.disabled = true;
        try {
            const ret = await csg.ajax(
                'POST',
                '/ojtool/contestlive/live_command_revoke_ajax',
                { cid: cid, command_id: commandId },
                {},
                'json',
                'form'
            );
            if (ret && parseInt(ret.code, 10) === 1) {
                await refreshLog();
            } else if (feedbackEl) {
                feedbackEl.textContent = (ret && ret.msg) ? ret.msg : '撤回失败';
            }
        } catch (e) {
            if (feedbackEl) {
                feedbackEl.textContent = '网络错误';
            }
            console.error(e);
        } finally {
            btn.disabled = false;
        }
    }

    function renderLog(rows) {
        if (!logList) {
            return;
        }
        logList.innerHTML = '';
        if (!rows || !rows.length) {
            const li = document.createElement('li');
            li.className = 'list-group-item text-muted border-0 px-0 py-2';
            li.innerHTML =
                '<span class="cn-text d-block lh-sm">（暂无）</span><span class="en-text d-block small text-muted lh-sm">None yet</span>';
            logList.appendChild(li);
            return;
        }
        for (let i = rows.length - 1; i >= 0; i--) {
            const row = rows[i];
            const li = document.createElement('li');
            li.className =
                'list-group-item border-0 px-0 py-1 d-flex align-items-center justify-content-between gap-2 contestlive-log-row';
            const left = document.createElement('div');
            left.className = 'flex-grow-1 min-w-0 d-flex align-items-baseline flex-wrap gap-2';
            const t = document.createElement('span');
            t.className = 'contestlive-log-time flex-shrink-0';
            t.textContent = formatTime(row.timestamp);
            const m = document.createElement('span');
            m.className = 'contestlive-log-msg';
            m.textContent = row.live_command || '';
            if (row.status === 'revoked') {
                m.classList.add('text-muted', 'text-decoration-line-through');
            }
            left.appendChild(t);
            left.appendChild(m);
            if (row.is_expired === true && row.status !== 'revoked') {
                const expBadge = document.createElement('span');
                expBadge.className =
                    'badge text-bg-secondary ms-1 align-middle contestlive-log-expired-badge contestlive-ctrl-bilingual-inline';
                expBadge.innerHTML =
                    '<span class="cn-text">过期</span>' +
                    '<span class="en-text contestlive-ctrl-bilingual-inline__en">Expired</span>';
                if (typeof CsgSetTitleAndTooltip === 'function') {
                    CsgSetTitleAndTooltip(
                        expBadge,
                        '已超过主画面底栏轮播时限，投屏左侧不再显示该条；仍可在列表中查看或撤回。 / Past the live ticker freshness window; not shown on overlay until revoked or superseded; you may still revoke.'
                    );
                }
                left.appendChild(expBadge);
            }
            li.appendChild(left);
            if (row.status !== 'revoked' && row.id) {
                const revokeBtn = document.createElement('button');
                revokeBtn.type = 'button';
                revokeBtn.className =
                    'btn btn-sm btn-outline-secondary flex-shrink-0 contestlive-log-revoke';
                revokeBtn.innerHTML =
                    '<span class="contestlive-ctrl-bilingual-inline">' +
                    '<span class="cn-text">撤回</span>' +
                    '<span class="en-text contestlive-ctrl-bilingual-inline__en">Revoke</span></span>';
                revokeBtn.setAttribute('data-command-id', String(row.id));
                if (typeof CsgSetTitleAndTooltip === 'function') {
                    CsgSetTitleAndTooltip(
                        revokeBtn,
                        '撤回该条底栏推送；主直播将显示下一条未撤回且未过期的近期推送，若均无则底栏清空（已过期的也可撤回）。 / Revoke; the display shows the latest non-revoked fresh push, or clears (expired lines may still be revoked).'
                    );
                }
                revokeBtn.addEventListener('click', function () {
                    revokeCommand(revokeBtn.getAttribute('data-command-id'), revokeBtn);
                });
                li.appendChild(revokeBtn);
            }
            logList.appendChild(li);
        }
    }

    async function refreshLog() {
        try {
            const ret = await csg.ajax(
                'GET',
                '/ojtool/contestlive/live_command_get_ajax',
                /** `_nc` 避免浏览器对同 URL 的 GET 复用缓存，导致推送后列表仍为空 */
                { cid: cid, _nc: Date.now() },
                {},
                'json'
            );
            if (ret && parseInt(ret.code, 10) === 1 && ret.data) {
                const rows = Array.isArray(ret.data)
                    ? ret.data
                    : Array.isArray(ret.data.commands)
                      ? ret.data.commands
                      : [];
                renderLog(rows);
            }
        } catch (e) {
            console.error(e);
        }
    }

    async function saveTickerFixedToServer() {
        const v = tickerFixedInput ? String(tickerFixedInput.value || '') : '';
        if (tickerFixedFeedback) {
            tickerFixedFeedback.textContent = '';
            tickerFixedFeedback.classList.remove('text-danger', 'text-success');
        }
        if (tickerFixedSaveBtn) {
            tickerFixedSaveBtn.disabled = true;
        }
        try {
            const ret = await csg.ajax(
                'POST',
                '/ojtool/contestlive/live_display_config_save_ajax',
                { cid: cid, op: 'ticker_fixed', ticker_fixed: v },
                {},
                'json',
                'form'
            );
            if (ret && parseInt(ret.code, 10) === 1 && ret.data) {
                const ld = ret.data.live_display;
                if (ld && typeof ld === 'object') {
                    applyLiveDisplayServerPayload(ld);
                }
                if (tickerFixedInput) {
                    tickerFixedInput.value = String(getDisplayConfig().ticker_fixed || '');
                }
                if (tickerFixedFeedback) {
                    tickerFixedFeedback.classList.add('text-success');
                    tickerFixedFeedback.innerHTML =
                        '<span class="cn-text d-block">已保存</span><span class="en-text d-block small">Saved</span>';
                }
            } else if (tickerFixedFeedback) {
                tickerFixedFeedback.classList.add('text-danger');
                const pair = csg.ajaxErrorBilingualPair(ret, '保存失败', 'Save failed');
                flashErrBilingual(tickerFixedFeedback, pair.cn, pair.en);
            }
        } catch (e) {
            if (tickerFixedFeedback) {
                tickerFixedFeedback.classList.add('text-danger');
                tickerFixedFeedback.textContent = '网络错误 / Network error';
            }
            console.error(e);
        } finally {
            if (tickerFixedSaveBtn) {
                tickerFixedSaveBtn.disabled = false;
            }
        }
    }

    async function sendCommand() {
        const text = (inputEl && inputEl.value) ? inputEl.value.trim() : '';
        if (!text) {
            if (feedbackEl) {
                feedbackEl.innerHTML =
                    '<span class="cn-text d-block">请输入内容</span><span class="en-text d-block small text-muted">Enter a message</span>';
            }
            return;
        }
        if (feedbackEl) {
            feedbackEl.textContent = '';
        }
        if (!sendBtn) {
            return;
        }
        sendBtn.disabled = true;
        try {
            const ret = await csg.ajax(
                'POST',
                '/ojtool/contestlive/live_command_send_ajax',
                { cid: cid, live_command: text },
                {},
                'json',
                'form'
            );
            if (ret && parseInt(ret.code, 10) === 1) {
                if (feedbackEl) {
                    feedbackEl.innerHTML =
                        '<span class="cn-text d-block">已发送</span><span class="en-text d-block small text-muted">Sent</span>';
                }
                if (inputEl) {
                    inputEl.value = '';
                }
                await refreshLog();
            } else if (feedbackEl) {
                feedbackEl.textContent = (ret && ret.msg) ? ret.msg : '发送失败';
            }
        } catch (e) {
            if (feedbackEl) {
                feedbackEl.textContent = '网络错误';
            }
            console.error(e);
        } finally {
            if (sendBtn) {
                sendBtn.disabled = false;
            }
        }
    }

    function liveBaseUrl() {
        return (window.location.origin || '') + '/ojtool/contestlive/';
    }

    function storedLvtk() {
        try {
            return sessionStorage.getItem(LVKEY) || '';
        } catch (e) {
            return '';
        }
    }

    function setStoredLvtk(t) {
        try {
            if (t) {
                sessionStorage.setItem(LVKEY, t);
            } else {
                sessionStorage.removeItem(LVKEY);
            }
        } catch (e) { /* ignore */ }
    }

    function readHudTitleForLiveUrl() {
        const inp = document.getElementById('contestlive_hud_title_for_url');
        if (inp) {
            return String(inp.value || '').trim();
        }
        return String(getDisplayConfig().hud_title || '').trim();
    }

    function buildLiveDisplayUrl(page) {
        let u = liveBaseUrl() + page + '?cid=' + encodeURIComponent(String(cid));
        const lvtk = storedLvtk();
        if (lvtk) {
            u += '&lvtk=' + encodeURIComponent(lvtk);
        }
        if (page === 'live') {
            const ht = readHudTitleForLiveUrl();
            if (ht) {
                u += '&hud_title=' + encodeURIComponent(ht);
            }
        }
        return u;
    }

    /** 更新各行的复制框 URL（含 lvtk、hud_title）；「页面」列通过 buildLiveDisplayUrl 即时打开 */
    function syncLiveDisplayUrls() {
        document.querySelectorAll('input.contestlive-hub-url-inp[data-live-page]').forEach(function (inp) {
            const page = inp.getAttribute('data-live-page');
            if (page) {
                inp.value = buildLiveDisplayUrl(page);
            }
        });
    }

    function flashHubCopyOk() {
        if (hubCopyOkEl) {
            hubCopyOkEl.classList.remove('d-none');
            setTimeout(function () {
                hubCopyOkEl.classList.add('d-none');
            }, 2000);
        }
    }

    /** 复制投屏 URL；ClipboardWrite 来自页面 layout 已加载的 global.js */
    async function copyHubUrlToClipboard(text) {
        const u = String(text || '').trim();
        if (!u) {
            return;
        }
        if (await ClipboardWrite(u)) {
            flashHubCopyOk();
        }
    }

    function bindHubMatrixCopyMenu() {
        if (window.__contestliveHubMatrixCopyBound) {
            return;
        }
        window.__contestliveHubMatrixCopyBound = 1;
        document.body.addEventListener('click', function (ev) {
            const btnPage = ev.target.closest('button.contestlive-hub-copy-page');
            if (btnPage) {
                const page = btnPage.getAttribute('data-live-page');
                const u = page ? buildLiveDisplayUrl(page) : '';
                if (!u) {
                    return;
                }
                ev.preventDefault();
                void copyHubUrlToClipboard(u);
                return;
            }
            const btnRow = ev.target.closest('button.contestlive-hub-copybtn');
            if (btnRow) {
                const wrap = btnRow.closest('.input-group');
                const inp = wrap ? wrap.querySelector('input.contestlive-hub-url-inp') : null;
                const u = inp && inp.value ? String(inp.value).trim() : '';
                if (!u) {
                    return;
                }
                ev.preventDefault();
                void copyHubUrlToClipboard(u);
            }
        });
    }

    function parseKeyTokens(keySpec) {
        const raw = String(keySpec || '').trim();
        if (!raw) {
            return [];
        }
        /** 快捷键本身为英文逗号时不能按逗号拆分，否则会得到空数组、不渲染 kbd */
        if (raw === ',') {
            return [','];
        }
        return raw.split(',').map(function (s) {
            return s.trim();
        }).filter(Boolean);
    }

    function renderShortcutBlock(keysEl, keysRaw) {
        if (!keysEl) {
            return;
        }
        keysEl.innerHTML = '';
        const trimmed = String(keysRaw || '').trim();
        if (!trimmed || trimmed === '—') {
            keysEl.appendChild(document.createTextNode('—'));
            return;
        }
        const wrap = document.createElement('div');
        wrap.className = 'contestlive-ctrl-roll-help-block';
        const chunks = trimmed.split(';');
        for (let i = 0; i < chunks.length; i++) {
            const part = chunks[i].trim();
            if (!part) {
                continue;
            }
            const segs = part.split('~');
            if (segs.length < 3) {
                continue;
            }
            const keySpec = segs[0].trim();
            const cn = segs[1].trim();
            const en = segs.slice(2).join('~').trim();
            const row = document.createElement('div');
            row.className = 'contestlive-ctrl-roll-help-item';
            const keysDiv = document.createElement('div');
            keysDiv.className = 'contestlive-ctrl-roll-help-keys';
            const toks = parseKeyTokens(keySpec);
            for (let j = 0; j < toks.length; j++) {
                const kbd = document.createElement('kbd');
                kbd.textContent = toks[j];
                keysDiv.appendChild(kbd);
            }
            const desc = document.createElement('div');
            desc.className = 'contestlive-ctrl-roll-help-desc';
            const cnSp = document.createElement('div');
            cnSp.className = 'cn-text';
            cnSp.textContent = cn;
            desc.appendChild(cnSp);
            const enSp = document.createElement('div');
            enSp.className = 'en-text text-muted';
            enSp.textContent = en;
            desc.appendChild(enSp);
            row.appendChild(keysDiv);
            row.appendChild(desc);
            wrap.appendChild(row);
        }
        keysEl.appendChild(wrap);
    }

    function openRowModal(tr) {
        if (!rowModalEl || !window.bootstrap) {
            return;
        }
        const titleZh = tr.getAttribute('data-title-zh') || '';
        const titleEn = tr.getAttribute('data-title-en') || '';
        const dZh = tr.getAttribute('data-desc-zh') || '';
        const dEn = tr.getAttribute('data-desc-en') || '';
        const keys = tr.getAttribute('data-keys') || '—';
        const titleEl = document.getElementById('contestlive_row_modal_title');
        const zhEl = document.getElementById('contestlive_row_modal_desc_zh');
        const enEl = document.getElementById('contestlive_row_modal_desc_en');
        const keysEl = document.getElementById('contestlive_row_modal_keys');
        if (titleEl) {
            titleEl.innerHTML = '';
            const cnT = document.createElement('span');
            cnT.className = 'cn-text d-block';
            cnT.textContent = titleZh;
            titleEl.appendChild(cnT);
            if (titleEn) {
                const enT = document.createElement('span');
                enT.className = 'en-text small text-muted d-block';
                enT.textContent = titleEn;
                titleEl.appendChild(enT);
            }
        }
        if (zhEl) {
            zhEl.textContent = dZh;
        }
        if (enEl) {
            enEl.textContent = dEn;
        }
        renderShortcutBlock(keysEl, keys);
        const m = new window.bootstrap.Modal(rowModalEl);
        m.show();
    }

    function bindHubRows() {
        document.querySelectorAll('tr.contestlive-hub-row').forEach(function (tr) {
            const pageTd = tr.querySelector('.contestlive-hub-td-page[data-live-page]');
            if (pageTd) {
                pageTd.setAttribute('role', 'button');
                pageTd.setAttribute('tabindex', '0');
                pageTd.addEventListener('click', function (ev) {
                    if (ev && ev.target && ev.target.closest && ev.target.closest('.contestlive-hub-page-extras')) {
                        return;
                    }
                    const page = pageTd.getAttribute('data-live-page');
                    if (!page) {
                        return;
                    }
                    const u = buildLiveDisplayUrl(page);
                    window.open(u, '_blank', 'noopener,noreferrer');
                });
                pageTd.addEventListener('keydown', function (ev) {
                    if (ev.key !== 'Enter' && ev.key !== ' ') {
                        return;
                    }
                    ev.preventDefault();
                    const page = pageTd.getAttribute('data-live-page');
                    if (!page) {
                        return;
                    }
                    window.open(buildLiveDisplayUrl(page), '_blank', 'noopener,noreferrer');
                });
            }
            const useTd = tr.querySelector('.contestlive-hub-td-use');
            if (useTd) {
                useTd.setAttribute('role', 'button');
                useTd.setAttribute('tabindex', '0');
                useTd.addEventListener('click', function () {
                    openRowModal(tr);
                });
                useTd.addEventListener('keydown', function (ev) {
                    if (ev.key !== 'Enter' && ev.key !== ' ') {
                        return;
                    }
                    ev.preventDefault();
                    openRowModal(tr);
                });
            }
        });
    }

    async function issueToken() {
        flashErr(tokenErr, '');
        const hours = tokenTtl ? parseInt(tokenTtl.value, 10) : 6;
        if (tokenIssueBtn) {
            tokenIssueBtn.disabled = true;
        }
        try {
            const ret = await csg.ajax(
                'POST',
                '/ojtool/contestlive/display_token_issue_ajax',
                { cid: cid, ttl_hours: hours },
                {},
                'json',
                'form'
            );
            if (ret && parseInt(ret.code, 10) === 1 && ret.data && ret.data.lvtk) {
                setStoredLvtk(ret.data.lvtk);
                syncLiveDisplayUrls();
                flashErr(tokenErr, '');
                if (tokenMeta) {
                    const exp = ret.data.expires_at ? new Date(ret.data.expires_at * 1000).toLocaleString() : '';
                    tokenMeta.classList.remove('d-none');
                    tokenMeta.innerHTML =
                        '<span class="cn-text d-block">已签发口令：下方矩阵「复制链接」与点击「页面」列打开已更新；有效期至 ' +
                        escapeHtml(exp) +
                        '</span><span class="en-text d-block small">Pass issued. Copy URLs and Page-column opens below are updated. Valid until: ' +
                        escapeHtml(exp) +
                        '</span>';
                }
            } else {
                flashErr(tokenErr, (ret && ret.msg) ? ret.msg : '签发失败');
            }
        } catch (e) {
            flashErr(tokenErr, '网络错误');
            console.error(e);
        } finally {
            if (tokenIssueBtn) {
                tokenIssueBtn.disabled = false;
            }
        }
    }

    async function revokeToken() {
        flashErr(tokenErr, '');
        if (tokenRevokeBtn) {
            tokenRevokeBtn.disabled = true;
        }
        try {
            const ret = await csg.ajax(
                'POST',
                '/ojtool/contestlive/display_token_revoke_ajax',
                { cid: cid },
                {},
                'json',
                'form'
            );
            if (ret && parseInt(ret.code, 10) === 1) {
                setStoredLvtk('');
                syncLiveDisplayUrls();
                flashErr(tokenErr, '');
                if (tokenMeta) {
                    tokenMeta.classList.remove('d-none');
                    tokenMeta.innerHTML =
                        '<span class="cn-text d-block">已重置：此前发出的投屏链接均已失效。请重新签发口令后再复制分发。</span>' +
                        '<span class="en-text d-block small">All previous display links are invalid. Issue a new pass, then copy again.</span>';
                }
            } else {
                flashErr(tokenErr, (ret && ret.msg) ? ret.msg : '重置失败');
            }
        } catch (e) {
            flashErr(tokenErr, '网络错误');
            console.error(e);
        } finally {
            if (tokenRevokeBtn) {
                tokenRevokeBtn.disabled = false;
            }
        }
    }

    /**
     * 非 SVG：按投屏徽标槽高度（与 ojtool/library/ContestliveBrandingLayout::SLOT_HEIGHT_PX 一致）等比缩放后输出 WebP。
     * @returns {Promise<{ blob: Blob, w: number, h: number }>}
     */
    function rasterFileToWebpBlobSlotHeight(file, targetHPx) {
        const th = Math.max(1, Math.round(targetHPx));
        return new Promise(function (resolve, reject) {
            const img = new Image();
            const u = URL.createObjectURL(file);
            img.onload = function () {
                URL.revokeObjectURL(u);
                const iw = img.naturalWidth || img.width;
                const ih = img.naturalHeight || img.height;
                if (!iw || !ih) {
                    reject(new Error('img'));
                    return;
                }
                const scale = th / ih;
                const w = Math.max(1, Math.round(iw * scale));
                const h = th;
                const c = document.createElement('canvas');
                c.width = w;
                c.height = h;
                const ctx = c.getContext('2d');
                if (!ctx) {
                    reject(new Error('canvas'));
                    return;
                }
                ctx.drawImage(img, 0, 0, w, h);
                c.toBlob(function (blob) {
                    if (blob) {
                        resolve({ blob: blob, w: w, h: h });
                    } else {
                        reject(new Error('webp'));
                    }
                }, 'image/webp', 0.88);
            };
            img.onerror = function () {
                URL.revokeObjectURL(u);
                reject(new Error('img'));
            };
            img.src = u;
        });
    }

    function brandSlotHeightPx() {
        const v = parseInt(String(window.CONTEST_LIVE_BRAND_SLOT_H_PX || '41'), 10);
        return Number.isFinite(v) && v > 0 ? v : 41;
    }

    /**
     * @returns {Promise<{ body: Blob|File, fname: string, probeW: number, probeH: number }>}
     */
    async function buildLogoUploadParts(file, replaceBasename) {
        const lower = file.name.toLowerCase();
        const rep = replaceBasename ? String(replaceBasename).toLowerCase() : '';
        const needSvg = rep.endsWith('.svg');
        if (needSvg) {
            if (!lower.endsWith('.svg')) {
                throw new Error('svg_only');
            }
            return { body: file, fname: String(replaceBasename).split('/').pop(), probeW: 240, probeH: 40 };
        }
        if (lower.endsWith('.svg')) {
            return { body: file, fname: file.name, probeW: 240, probeH: 40 };
        }
        const slotH = brandSlotHeightPx();
        const norm = await rasterFileToWebpBlobSlotHeight(file, slotH);
        const fname = replaceBasename
            ? String(replaceBasename).split('/').pop()
            : file.name.replace(/\.[^.]+$/, '') + '.webp';
        return {
            body: norm.blob,
            fname: fname,
            probeW: norm.w,
            probeH: norm.h,
        };
    }

    async function uploadLogoFilePrepared(parts) {
        const fd = new FormData();
        fd.append('cid', String(cid));
        fd.append('file', parts.body, parts.fname);
        return csg.ajax('POST', '/ojtool/contestlive/live_logo_upload_ajax', fd, {}, 'json', null);
    }

    async function uploadLogoFile(file) {
        const parts = await buildLogoUploadParts(file, '');
        return uploadLogoFilePrepared(parts);
    }

    async function replaceLogoFile(file, replaceBasename) {
        const parts = await buildLogoUploadParts(file, replaceBasename);
        const fd = new FormData();
        fd.append('cid', String(cid));
        fd.append('replace', String(replaceBasename).split('/').pop());
        fd.append('file', parts.body, parts.fname);
        return csg.ajax('POST', '/ojtool/contestlive/live_logo_replace_ajax', fd, {}, 'json', null);
    }

    async function deleteLogo(name) {
        const ret = await csg.ajax(
            'POST',
            '/ojtool/contestlive/live_logo_delete_ajax',
            { cid: cid, name: name },
            {},
            'json',
            'form'
        );
        return ret;
    }

    function updateLogoAddAvailability(manifest) {
        if (!logoAddBtn) {
            return;
        }
        const L = window.CsgContestliveBrandLayout;
        let full = false;
        if (L && manifest && Array.isArray(manifest.logos) && typeof L.computeHudLayoutFromLogos === 'function') {
            full = L.computeHudLayoutFromLogos(manifest.logos).can_add_typical_probe === false;
        }
        logoAddBtn.disabled = !!full;
        if (typeof CsgSetTitleAndTooltip === 'function') {
            if (full) {
                CsgSetTitleAndTooltip(
                    logoAddBtn,
                    '主直播画面左上角徽标区已满（按当前布局与典型尺寸预估），请删除或替换后再添加。 / The HUD logo strip is full for typical sizes; remove or replace a logo first.'
                );
            } else {
                CsgSetTitleAndTooltip(
                    logoAddBtn,
                    '选择赞助商或主办方的徽标类图片，将显示在主直播画面左上角。 / Pick sponsor or host logos for the main live HUD.'
                );
            }
        }
    }

    function renderLogoList(manifest) {
        if (!logoGrid) {
            return;
        }
        logoGrid.innerHTML = '';
        const logos = manifest && manifest.logos ? manifest.logos : [];
        const base = (window.CONTEST_LIVE_ATTACH_PATH || '').replace(/\/+$/, '');
        if (logoEmpty) {
            logoEmpty.classList.toggle('d-none', logos.length > 0);
        }
        logos.forEach(function (row) {
            const f = row && row.f ? String(row.f) : '';
            if (!f) {
                return;
            }
            const col = document.createElement('div');
            col.className = 'col contestlive-logo-card-col';
            col.setAttribute('draggable', 'true');
            col.setAttribute('data-logo-name', f);
            const card = document.createElement('div');
            card.className = 'contestlive-logo-card border rounded h-100 d-flex flex-column bg-body shadow-sm';
            const imgWrap = document.createElement('div');
            imgWrap.className = 'bg-light d-flex align-items-center justify-content-center rounded-top';
            imgWrap.style.minHeight = '6.5rem';
            const thumb = document.createElement('img');
            thumb.alt = '';
            thumb.className = 'img-fluid p-1';
            thumb.style.maxHeight = '100%';
            thumb.style.objectFit = 'contain';
            if (base) {
                thumb.src = base + '/' + encodeURI(f.split('/').pop());
            }
            imgWrap.appendChild(thumb);
            const cap = document.createElement('div');
            cap.className = 'p-2 small border-top flex-grow-1 d-flex flex-column';
            const nameEl = document.createElement('div');
            nameEl.className = 'text-truncate font-monospace text-muted';
            nameEl.title = f;
            nameEl.textContent = f;
            cap.appendChild(nameEl);
            const wh = row && row.w && row.h ? String(row.w) + '×' + String(row.h) : '';
            if (wh) {
                const dimEl = document.createElement('div');
                dimEl.className = 'text-muted';
                dimEl.textContent = wh;
                cap.appendChild(dimEl);
            }
            const btnRow = document.createElement('div');
            btnRow.className = 'd-flex gap-1 mt-1';
            const mod = document.createElement('button');
            mod.type = 'button';
            mod.className = 'btn btn-sm btn-outline-secondary flex-grow-1';
            mod.innerHTML =
                '<span class="contestlive-ctrl-bilingual-stack contestlive-ctrl-bilingual-stack--center">' +
                '<span class="cn-text contestlive-ctrl-bilingual-stack__cn">修改</span>' +
                '<span class="en-text contestlive-ctrl-bilingual-stack__en">Replace</span></span>';
            mod.addEventListener('click', function () {
                logoReplaceTarget = f;
                if (logoReplacePick) {
                    logoReplacePick.value = '';
                    logoReplacePick.click();
                }
            });
            const del = document.createElement('button');
            del.type = 'button';
            del.className = 'btn btn-sm btn-outline-danger flex-grow-1';
            del.innerHTML =
                '<span class="contestlive-ctrl-bilingual-stack contestlive-ctrl-bilingual-stack--center">' +
                '<span class="cn-text contestlive-ctrl-bilingual-stack__cn">移除</span>' +
                '<span class="en-text contestlive-ctrl-bilingual-stack__en">Remove</span></span>';
            del.addEventListener('click', async function () {
                del.disabled = true;
                try {
                    const ret = await deleteLogo(f);
                    if (ret && parseInt(ret.code, 10) === 1 && ret.data && ret.data.manifest) {
                        renderLogoList(ret.data.manifest);
                    } else if (ret && parseInt(ret.code, 10) !== 1) {
                        const pair = csg.ajaxErrorBilingualPair(ret, '移除失败', 'Remove failed');
                        flashErrBilingual(logoErr, pair.cn, pair.en);
                    }
                } catch (e) {
                    console.error(e);
                }
                del.disabled = false;
            });
            btnRow.appendChild(mod);
            btnRow.appendChild(del);
            cap.appendChild(btnRow);
            card.appendChild(imgWrap);
            card.appendChild(cap);
            col.appendChild(card);
            logoGrid.appendChild(col);
        });
        updateLogoAddAvailability(manifest);
    }

    function scheduleLogoReorderSave() {
        if (logoReorderTimer) {
            window.clearTimeout(logoReorderTimer);
        }
        logoReorderTimer = window.setTimeout(function () {
            logoReorderTimer = null;
            saveLogoOrderFromDom();
        }, 320);
    }

    async function saveLogoOrderFromDom() {
        if (!logoGrid || logoOrderSaving) {
            return;
        }
        const names = [];
        logoGrid.querySelectorAll('.contestlive-logo-card-col').forEach(function (col) {
            const n = col.getAttribute('data-logo-name');
            if (n) {
                names.push(n);
            }
        });
        if (names.length === 0) {
            return;
        }
        logoOrderSaving = true;
        try {
            const ret = await csg.ajax(
                'POST',
                '/ojtool/contestlive/live_logo_reorder_ajax',
                { cid: String(cid), order: JSON.stringify(names) },
                {},
                'json',
                'form'
            );
            if (ret && parseInt(ret.code, 10) === 1 && ret.data && ret.data.manifest) {
                window.CONTEST_LIVE_BRAND_MANIFEST = ret.data.manifest;
                renderLogoList(ret.data.manifest);
            } else if (ret && parseInt(ret.code, 10) !== 1) {
                const pair = csg.ajaxErrorBilingualPair(ret, '排序保存失败', 'Failed to save order');
                flashErrBilingual(logoErr, pair.cn, pair.en);
            }
        } catch (e) {
            console.error(e);
        } finally {
            logoOrderSaving = false;
        }
    }

    async function refreshManifest() {
        try {
            const ret = await csg.ajax('GET', '/ojtool/contestlive/live_branding_manifest_ajax', { cid: cid }, {}, 'json');
            if (ret && parseInt(ret.code, 10) === 1 && ret.data) {
                window.CONTEST_LIVE_BRAND_MANIFEST = ret.data;
                renderLogoList(ret.data);
            }
        } catch (e) {
            console.error(e);
        }
    }

    csg.docready(function () {
        syncCtrlSkinButtons();
        document.querySelectorAll('.contestlive-ctrl-skin-batch').forEach(function (btn) {
            btn.addEventListener('click', function () {
                const id = btn.getAttribute('data-contestlive-skin') || 'default';
                batchUnifyDisplaySkin(id);
            });
        });
        document.querySelectorAll('select.contestlive-ctrl-skin-page').forEach(function (sel) {
            sel.addEventListener('change', function () {
                const page = sel.getAttribute('data-live-page');
                if (!page) {
                    return;
                }
                const v = sel.value;
                const g = currentStoredGlobalSkin();
                const toSend = v === g ? '' : v;
                savePageSkinToServer(page, toSend);
            });
        });
        document.querySelectorAll('select.contestlive-ctrl-schoolwall-layout').forEach(function (sel) {
            sel.addEventListener('change', function () {
                saveSchoolwallLayoutToServer(sel.value);
            });
        });
        const tok0 = storedLvtk();
        if (tok0 && tokenMeta) {
            tokenMeta.classList.remove('d-none');
                    tokenMeta.innerHTML =
                        '<span class="cn-text d-block">本页已记录有效口令：下方矩阵各行的「复制」或链接已带口令。若需换新口令，请点「签发口令」。</span>' +
                        '<span class="en-text d-block small">A valid pass is active; copy boxes and links below include it. Use Issue pass to replace.</span>';
        }
        const hudTitleInp = document.getElementById('contestlive_hud_title_for_url');
        const hudTitleSaveBtn = document.getElementById('contestlive_hud_title_save_btn');
        if (hudTitleInp) {
            hudTitleInp.addEventListener('input', function () {
                syncLiveDisplayUrls();
            });
            hudTitleInp.addEventListener('keydown', function (ev) {
                if (ev.key === 'Enter') {
                    ev.preventDefault();
                    flushHudTitleToServer();
                }
            });
        }
        if (hudTitleSaveBtn) {
            hudTitleSaveBtn.addEventListener('click', function () {
                flushHudTitleToServer();
            });
        }
        syncLiveDisplayUrls();
        bindHubMatrixCopyMenu();
        bindHubRows();
        if (sendBtn) {
            sendBtn.addEventListener('click', sendCommand);
        }
        if (refreshBtn) {
            refreshBtn.addEventListener('click', refreshLog);
        }
        if (tickerFixedSaveBtn) {
            tickerFixedSaveBtn.addEventListener('click', saveTickerFixedToServer);
        }
        if (tokenIssueBtn) {
            tokenIssueBtn.addEventListener('click', issueToken);
        }
        if (tokenRevokeBtn) {
            tokenRevokeBtn.addEventListener('click', revokeToken);
        }
        if (typeof jQuery !== 'undefined' && logoGrid && window.CsgSortableList &&
            typeof window.CsgSortableList.attachDelegatedListReorder === 'function') {
            window.CsgSortableList.attachDelegatedListReorder('#contestlive_logo_grid', '> .contestlive-logo-card-col');
            jQuery(document).on('drop.contestliveLogoReorder', '#contestlive_logo_grid > .contestlive-logo-card-col', function () {
                scheduleLogoReorderSave();
            });
        }
        if (logoAddBtn && logoPick) {
            logoAddBtn.addEventListener('click', function () {
                logoPick.click();
            });
        }
        if (logoPick) {
            logoPick.addEventListener('change', async function () {
                const files = logoPick.files;
                if (!files || !files.length) {
                    return;
                }
                flashErr(logoErr, '');
                logoPick.disabled = true;
                for (let i = 0; i < files.length; i++) {
                    const f = files[i];
                    try {
                        const parts = await buildLogoUploadParts(f, '');
                        const Ly = window.CsgContestliveBrandLayout;
                        if (!Ly || typeof Ly.dimsFromLogoRows !== 'function' || typeof Ly.fitsWithAdditional !== 'function') {
                            flashErr(logoErr, '布局脚本未加载，请刷新页面重试。');
                            break;
                        }
                        const curM = window.CONTEST_LIVE_BRAND_MANIFEST;
                        const dims = Ly.dimsFromLogoRows(curM && curM.logos ? curM.logos : []);
                        const canAdd = Ly.fitsWithAdditional(dims, parts.probeW, parts.probeH);
                        if (!canAdd.ok) {
                            flashErr(logoErr, '当前徽标区无法容纳该尺寸，请删减或换更窄的图片再试。');
                            break;
                        }
                        const ret = await uploadLogoFilePrepared(parts);
                        if (!ret || parseInt(ret.code, 10) !== 1) {
                            const pair = csg.ajaxErrorBilingualPair(ret, '上传失败', 'Upload failed');
                            flashErrBilingual(logoErr, pair.cn, pair.en);
                            break;
                        }
                        if (ret.data && ret.data.manifest) {
                            window.CONTEST_LIVE_BRAND_MANIFEST = ret.data.manifest;
                            if (ret.data.brand_base) {
                                window.CONTEST_LIVE_ATTACH_PATH = String(ret.data.brand_base);
                            }
                            renderLogoList(ret.data.manifest);
                        }
                    } catch (e) {
                        flashErr(logoErr, '上传错误');
                        console.error(e);
                        break;
                    }
                }
                logoPick.value = '';
                logoPick.disabled = false;
            });
        }
        if (logoReplacePick) {
            logoReplacePick.addEventListener('change', async function () {
                const files = logoReplacePick.files;
                if (!files || !files.length) {
                    logoReplacePick.value = '';
                    return;
                }
                if (!logoReplaceTarget) {
                    logoReplacePick.value = '';
                    return;
                }
                flashErr(logoErr, '');
                logoReplacePick.disabled = true;
                const tgt = logoReplaceTarget;
                logoReplaceTarget = null;
                const f = files[0];
                try {
                    const ret = await replaceLogoFile(f, tgt);
                    if (!ret || parseInt(ret.code, 10) !== 1) {
                        const pair = csg.ajaxErrorBilingualPair(ret, '替换失败', 'Replace failed');
                        flashErrBilingual(logoErr, pair.cn, pair.en);
                    } else if (ret.data && ret.data.manifest) {
                        window.CONTEST_LIVE_BRAND_MANIFEST = ret.data.manifest;
                        if (ret.data.brand_base) {
                            window.CONTEST_LIVE_ATTACH_PATH = String(ret.data.brand_base);
                        }
                        renderLogoList(ret.data.manifest);
                    }
                } catch (e) {
                    if (e && e.message === 'svg_only') {
                        flashErr(logoErr, '替换 SVG 须选择 SVG 文件。 / Replace SVG with an SVG file.');
                    } else {
                        flashErr(logoErr, '替换错误');
                        console.error(e);
                    }
                }
                logoReplacePick.value = '';
                logoReplacePick.disabled = false;
            });
        }
        refreshLog();
        refreshManifest();
    });
})();
