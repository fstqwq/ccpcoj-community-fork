/**
 * 全局加载遮罩（Bootstrap 5 风格）
 *
 * 调用方式：
 * 1. 字符串（兼容旧代码）：showOverlay("文本")、updateOverlay("文本", ratio, additionText)
 * 2. 对象（推荐）：
 *    showOverlay({
 *      message, message_en,           // 主文案（双语，英文缺省时占位行高避免抖动）
 *      subtitle, subtitle_en,         // 副标题（同上；无内容时仍占位）
 *      detail, detail_en,             // 详情（等宽区，双语占位）
 *      type / subtitleType / detailType: 'text' | 'html'
 *      spinner: true | false,
 *      progressMode: 'hidden' | 'indeterminate' | 'determinate',
 *      progress: 0–100,
 *      cardWidth: 例如 'min(440px, 92vw)' 固定卡片宽度防抖动,
 *      overlayProgressSpinnerPolicy: 'both' | 'progress_only' — 后者在进度条可见时隐藏顶部转圈（须显式传入，非默认）
 *      theme: 'light' | 'dark' — 深色卡片与背景（PDF 导出等）
 *      titleIcon: 例如 'bi-cloud-arrow-down' — 与 Bootstrap Icons 文档一致的主图标类名片段（脚本写成 class=\"bi bi-cloud-arrow-down\"）
 *      progressAccent: 'auto'（默认按百分比变色）| 'gradient-blue'（线性渐变进度条）
 *      cardClass, backdropClass, backdropStyle, minWidth, zIndex
 *      cancelable: true — 显示取消按钮（须配合 abortController）
 *      abortController: AbortController — 点击取消时 abort()，业务侧监听 signal 中止打包/请求
 *      onCancel: () => void — 可选，在 abort() 之后调用
 *      cancelLabel, cancelLabel_en — 取消按钮文案（默认 取消 / Cancel）
 *    })
 *  说明：`updateOverlay` 传入**仅布局键**的对象补丁（见 **`OVERLAY_LAYOUT_PATCH_KEYS`**）时保留上次正文，避免只刷进度时标题被解析成空串。

 *  全局：overlayThrowIfAborted(signal)、overlayCreateAbortError()
 *
 * 布局：主/副/详情均为「两行槽位」（中文行 + 英文行），英文空时用占位避免高度变化；进度条区域
 * 在 progressMode:'hidden' 时仍占位（轨道不可见），切换到 determinate 时不抖动。
 * determinate 时进度条右侧显示百分比数字（与 aria-valuenow 一致），hidden/indeterminate 时隐藏。
 * 可取消时，取消按钮在详情区（detail）下方。
 */

var overlayRuntime = {
    progressMode: 'hidden',
    /** determinate 模式下最近一次百分比，便于只改文案时不丢进度 */
    lastRatio: null,
};

/**
 * updateOverlay 的对象补丁若仅含下列键（无任何正文槽位键），则视为「只改进度/主题」，
 * 保留上次 show/update 写入的正文快照（避免 Object.assign 进度补丁时把 message 解析成空串）。
 */
var OVERLAY_LAYOUT_PATCH_KEYS = new Set([
    'theme',
    'titleIcon',
    'progressAccent',
    'spinner',
    'progressMode',
    'progress',
    'cardClass',
    'backdropClass',
    'backdropStyle',
    'minWidth',
    'zIndex',
    'cardWidth',
    'overlayProgressSpinnerPolicy',
    'cancelable',
    'abortController',
    'onCancel',
    'cancelLabel',
    'cancelLabel_en',
]);

/**
 * @param {Object} mergedPatch
 * @returns {boolean}
 */
function isLayoutOnlyOverlayPatch(mergedPatch) {
    if (typeof mergedPatch !== 'object' || mergedPatch === null) {
        return false;
    }
    const keys = Object.keys(mergedPatch);
    if (keys.length === 0) {
        return false;
    }
    for (let i = 0; i < keys.length; i++) {
        if (!OVERLAY_LAYOUT_PATCH_KEYS.has(keys[i])) {
            return false;
        }
    }
    return true;
}

/**
 * @param {Object} config
 * @returns {Object}
 */
function snapshotOverlayLastTextConfig(config) {
    return {
        message: config.message,
        message_en: config.message_en,
        type: config.type,
        subtitle: config.subtitle,
        subtitle_en: config.subtitle_en,
        subtitleType: config.subtitleType,
        detail: config.detail,
        detail_en: config.detail_en,
        detailType: config.detailType,
        titleIcon: config.titleIcon || '',
    };
}

/**
 * @param {Object} mergedPatch
 * @param {Object} config — parseOverlayParam 的结果，将被就地修补
 * @param {Object|null|undefined} prev
 */
function mergeOverlayTextFromPreviousIfLayoutOnly(mergedPatch, config, prev) {
    if (!prev || !isLayoutOnlyOverlayPatch(mergedPatch)) {
        return;
    }
    config.message = prev.message;
    config.message_en = prev.message_en;
    config.type = prev.type;
    config.subtitle = prev.subtitle;
    config.subtitle_en = prev.subtitle_en;
    config.subtitleType = prev.subtitleType;
    config.detail = prev.detail;
    config.detail_en = prev.detail_en;
    config.detailType = prev.detailType;
    config.titleIcon = prev.titleIcon;
}

/**
 * @returns {DOMException}
 */
function overlayCreateAbortError() {
    return new DOMException('Cancelled', 'AbortError');
}

/**
 * @param {AbortSignal|undefined|null} signal
 */
function overlayThrowIfAborted(signal) {
    if (signal && signal.aborted) {
        throw overlayCreateAbortError();
    }
}

/**
 * @param {string|Object} param
 * @returns {Object|undefined|null} undefined = 未提及取消配置（update 时保持现状）；null 非法不用
 */
function extractCancelPatch(param) {
    if (typeof param !== 'object' || param === null) {
        return undefined;
    }
    const has =
        Object.prototype.hasOwnProperty.call(param, 'cancelable') ||
        Object.prototype.hasOwnProperty.call(param, 'abortController') ||
        Object.prototype.hasOwnProperty.call(param, 'onCancel') ||
        Object.prototype.hasOwnProperty.call(param, 'cancelLabel') ||
        Object.prototype.hasOwnProperty.call(param, 'cancelLabel_en');
    if (!has) {
        return undefined;
    }
    return {
        cancelable: param.cancelable === true,
        abortController: param.abortController || null,
        onCancel: typeof param.onCancel === 'function' ? param.onCancel : null,
        cancelLabel: param.cancelLabel != null ? String(param.cancelLabel) : '取消',
        cancelLabel_en: param.cancelLabel_en != null ? String(param.cancelLabel_en) : 'Cancel',
    };
}

/**
 * @param {HTMLElement} overlay
 * @param {string|Object} param
 * @param {boolean} isInitialShow
 */
function syncOverlayCancelUI(overlay, param, isInitialShow) {
    const row = document.getElementById('overlay-cancel-row');
    if (!row || !overlay) {
        return;
    }
    const patch = extractCancelPatch(param);
    let apply;
    if (patch === undefined) {
        apply = isInitialShow ? { cancelable: false, abortController: null, onCancel: null, cancelLabel: '取消', cancelLabel_en: 'Cancel' } : null;
    } else {
        apply = patch;
    }
    if (apply === null) {
        return;
    }
    if (!apply.cancelable || !apply.abortController || typeof apply.abortController.abort !== 'function') {
        row.style.display = 'none';
        row.innerHTML = '';
        overlay._overlayCancelState = null;
        return;
    }
    row.style.display = 'flex';
    row.innerHTML = '';
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn btn-link btn-sm overlay-cancel-btn';
    btn.setAttribute('aria-label', apply.cancelLabel + ' / ' + apply.cancelLabel_en);
    const cn = document.createElement('span');
    cn.className = 'cn-text';
    cn.textContent = apply.cancelLabel;
    const en = document.createElement('span');
    en.className = 'en-text';
    en.textContent = apply.cancelLabel_en;
    btn.appendChild(cn);
    btn.appendChild(en);
    const ac = apply.abortController;
    const onExtra = apply.onCancel;
    btn.addEventListener('click', function () {
        if (btn.disabled) {
            return;
        }
        btn.disabled = true;
        try {
            ac.abort();
        } catch (e) {
            /* ignore */
        }
        if (onExtra) {
            try {
                onExtra();
            } catch (e2) {
                /* ignore */
            }
        }
    });
    row.appendChild(btn);
    overlay._overlayCancelState = apply;
}

function ensureOverlayStableStyles() {
    if (document.getElementById('csgoj-overlay-stable-styles')) {
        return;
    }
    const s = document.createElement('style');
    s.id = 'csgoj-overlay-stable-styles';
    s.textContent =
        '.csgoj-overlay-card .overlay-stack-line{min-height:1.42em;line-height:1.42;word-break:break-word;}' +
        '.csgoj-overlay-card #overlay-text .overlay-stack-cn{font-weight:600;font-size:1.14rem;letter-spacing:0.01em;color:var(--bs-emphasis-color,#212529);}' +
        '.csgoj-overlay-card #overlay-text .overlay-stack-en{font-size:0.9rem;opacity:0.88;margin-top:3px;color:var(--bs-secondary-color,#6c757d);}' +
        '.csgoj-overlay-card #overlay-subtitle-slot .overlay-stack-cn{font-weight:500;font-size:0.98rem;opacity:0.95;color:var(--bs-emphasis-color,#212529);}' +
        '.csgoj-overlay-card #overlay-subtitle-slot .overlay-stack-en{font-size:0.84rem;opacity:0.86;margin-top:2px;color:var(--bs-secondary-color,#6c757d);}' +
        '.csgoj-overlay-card #overlay-detail-slot .overlay-stack-cn.overlay-detail-cn-ellipsis{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:100%;display:block;}' +
        '.csgoj-overlay-card #overlay-detail-slot .overlay-stack-en{font-size:0.86rem;opacity:0.85;margin-top:2px;color:var(--bs-secondary-color,#6c757d);}' +
        '.csgoj-overlay-card .overlay-en-slot:empty::before{content:"\\00a0";}' +
        '.csgoj-overlay-card #overlay-subtitle-slot{margin-top:0.35rem;}' +
        '.csgoj-overlay-card #overlay-detail-slot{margin-top:0.65rem;text-align:center;max-width:100%;max-height:5.5rem;overflow-y:auto;}' +
        '.csgoj-overlay-card #overlay-detail-slot .overlay-stack-cn,' +
        '.csgoj-overlay-card #overlay-detail-slot .overlay-stack-en{font-family:var(--bs-font-monospace);font-size:0.8rem;}' +
        '.csgoj-overlay-card .overlay-progress-slot{min-height:14px;margin-top:0.75rem;}' +
        '.csgoj-overlay-card .overlay-progress-row{display:flex;align-items:center;gap:0.7rem;width:100%;}' +
        '.csgoj-overlay-card .overlay-progress-row .progress{flex:1;min-width:0;margin-bottom:0;height:10px;background:var(--bs-secondary-bg,#e9ecef);}' +
        '.csgoj-overlay-card #overlay-progress-pct{display:none;flex:0 0 auto;min-width:2.65rem;text-align:right;font-weight:600;font-size:0.9rem;font-variant-numeric:tabular-nums;letter-spacing:0.02em;color:var(--bs-emphasis-color,#212529);line-height:1;}' +
        '.csgoj-overlay-card #overlay-progress-pct.overlay-progress-pct--visible{display:block;}' +
        '.csgoj-overlay-card #overlay-cancel-row{display:none;flex-direction:row;justify-content:center;align-items:center;width:100%;box-sizing:border-box;margin-top:0.55rem;padding-top:0.55rem;border-top:1px solid var(--bs-border-color-translucent,rgba(0,0,0,0.09));}' +
        '.csgoj-overlay-card .overlay-cancel-btn{display:inline-flex;flex-wrap:wrap;align-items:baseline;justify-content:center;column-gap:0.4rem;row-gap:0.08rem;font-size:0.875rem;font-weight:500;color:var(--bs-secondary-color,#6c757d);text-decoration:none;padding:0.28rem 0.7rem;border-radius:0.4rem;line-height:1.35;border:0;background:transparent;transition:color .15s ease,background-color .15s ease;}' +
        '.csgoj-overlay-card .overlay-cancel-btn .en-text{font-size:0.82rem;font-weight:400;opacity:0.9;}' +
        '.csgoj-overlay-card .overlay-cancel-btn:hover{color:var(--bs-danger,#dc3545);background:rgba(220,53,69,0.09);}' +
        '.csgoj-overlay-card .overlay-cancel-btn:focus-visible{box-shadow:0 0 0 0.2rem rgba(var(--bs-primary-rgb,13,110,253),0.35);outline:0;}' +
        '.csgoj-overlay-card .overlay-cancel-btn:disabled{opacity:0.55;pointer-events:none;}' +
        '.csgoj-overlay-card .overlay-subtitle-empty .overlay-stack-cn,' +
        '.csgoj-overlay-card .overlay-subtitle-empty .overlay-stack-en{visibility:hidden;}' +
        '.csgoj-overlay-card .overlay-detail-empty .overlay-stack-cn,' +
        '.csgoj-overlay-card .overlay-detail-empty .overlay-stack-en{visibility:hidden;}' +
        /* 浅色默认：圆角与阴影（取代 shadow-lg） */
        '.csgoj-overlay-card:not(.csgoj-overlay-card--dark){border-radius:0.75rem !important;box-shadow:0 12px 36px rgba(2,6,23,0.14) !important;}' +
        '.csgoj-overlay-card:not(.csgoj-overlay-card--dark) .overlay-progress-row .progress{height:8px;border-radius:999px;}' +
        /* 深色主题 */
        '.csgoj-overlay--dark{background-color:rgba(15,23,42,0.55) !important;backdrop-filter:blur(2px) !important;-webkit-backdrop-filter:blur(2px) !important;}' +
        '.csgoj-overlay-card--dark{background:rgba(33,37,41,0.92) !important;color:#fff !important;box-shadow:0 10px 32px rgba(0,0,0,0.35) !important;border-radius:0.75rem !important;}' +
        '.csgoj-overlay-card--dark #overlay-text .overlay-stack-cn,.csgoj-overlay-card--dark #overlay-text .overlay-stack-en{color:rgba(255,255,255,0.95) !important;}' +
        '.csgoj-overlay-card--dark #overlay-subtitle-slot .overlay-stack-cn,.csgoj-overlay-card--dark #overlay-subtitle-slot .overlay-stack-en{color:rgba(255,255,255,0.92) !important;}' +
        '.csgoj-overlay-card--dark #overlay-detail-slot .overlay-stack-cn,.csgoj-overlay-card--dark #overlay-detail-slot .overlay-stack-en{color:rgba(255,255,255,0.78) !important;}' +
        '.csgoj-overlay-card--dark #overlay-progress-pct{color:rgba(255,255,255,0.95) !important;}' +
        '.csgoj-overlay-card--dark #overlay-spinner{border-color:rgba(255,255,255,0.35) !important;border-right-color:rgba(252,211,77,0.95) !important;}' +
        '.csgoj-overlay-card--dark .overlay-cancel-btn{color:rgba(255,255,255,0.78) !important;}' +
        '.csgoj-overlay-card--dark .overlay-cancel-btn:hover{color:#fecaca !important;background:rgba(220,53,69,0.18) !important;}' +
        '.csgoj-overlay-card--dark #overlay-cancel-row{border-top-color:rgba(255,255,255,0.12) !important;}' +
        '.overlay-title-icon{display:inline-flex;margin-right:0.45rem;vertical-align:-0.12em;color:#fcd34d;font-size:1.1rem;}' +
        '.csgoj-overlay-card--dark .overlay-title-icon{color:#fcd34d !important;}' +
        '.csgoj-overlay-card:not(.csgoj-overlay-card--dark) .overlay-title-icon{color:#0d6efd;}' +
        /* 渐变进度条（与 progressAccent: gradient-blue 配套） */
        '.csgoj-overlay-card .progress-bar.overlay-bar--gradient-blue{background:linear-gradient(90deg,#38bdf8,#60a5fa) !important;background-image:linear-gradient(90deg,#38bdf8,#60a5fa) !important;border:0 !important;}' +
        '.csgoj-overlay-card .progress-bar.overlay-bar--gradient-blue.progress-bar-striped{background-image:linear-gradient(90deg,#38bdf8,#60a5fa) !important;}';
    document.head.appendChild(s);
}

/**
 * @param {string|Object} param
 * @returns {Object}
 */
function parseOverlayParam(param) {
    if (typeof param === 'string') {
        return {
            message: param,
            message_en: '',
            type: 'text',
            subtitle: '',
            subtitle_en: '',
            subtitleType: 'text',
            detail: '',
            detail_en: '',
            detailType: 'text',
            titleIcon: '',
        };
    }
    if (typeof param === 'object' && param !== null) {
        return {
            message: param.message || '',
            message_en: param.message_en || '',
            type: param.type || 'text',
            subtitle: param.subtitle || '',
            subtitle_en: param.subtitle_en || '',
            subtitleType: param.subtitleType || 'text',
            detail: param.detail || '',
            detail_en: param.detail_en || '',
            detailType: param.detailType || 'text',
            titleIcon: param.titleIcon ? String(param.titleIcon) : '',
        };
    }
    return {
        message: '扫描中... 发现 0 道题目, 0 组测试数据',
        message_en: '',
        type: 'text',
        subtitle: '',
        subtitle_en: '',
        subtitleType: 'text',
        detail: '',
        detail_en: '',
        detailType: 'text',
        titleIcon: '',
    };
}

/**
 * @param {string} text
 * @param {string} type
 * @returns {string}
 */
function overlayFormatLineRaw(text, type) {
    let t = text || '';
    if (type === 'text') {
        return DomSantize(String(t).replace(/\n/g, '<br>'));
    }
    if (t && !String(t).includes('<')) {
        t = String(t).replace(/\n/g, '<br>');
    }
    return t;
}

/**
 * 两行固定槽：中文行 + 英文行（英文空则占位，避免与双语文案切换时抖动）
 * @param {HTMLElement} el
 * @param {string} cn
 * @param {string} en
 * @param {string} type
 * @param {boolean} allowEmptySubtitleDetail - 副标题/详情无字时仍占两行高度
 */
function fillOverlayBilingualSlot(el, cn, en, type, allowEmptySubtitleDetail, titleIcon) {
    const cnHtml = overlayFormatLineRaw(cn, type);
    const enRaw = en && String(en).trim() !== '' ? overlayFormatLineRaw(en, type) : '';
    const enInner = enRaw
        ? '<span class="en-text overlay-en-slot">' + enRaw + '</span>'
        : '<span class="en-text overlay-en-slot" aria-hidden="true">&nbsp;</span>';
    const cnShow = cnHtml && String(cnHtml).replace(/<[^>]+>/g, '').replace(/&nbsp;/g, '').trim() !== '';
    const cnInner = cnShow ? cnHtml : '&nbsp;';
    const ti = titleIcon && String(titleIcon).trim() !== '' ? String(titleIcon).trim() : '';
    const cnLineBody =
        ti && el.id === 'overlay-text'
            ? '<i class="bi ' + ti + ' overlay-title-icon" aria-hidden="true"></i>' + cnInner
            : cnInner;
    el.innerHTML =
        '<div class="overlay-stack-line overlay-stack-cn">' +
        cnLineBody +
        '</div><div class="overlay-stack-line overlay-stack-en">' +
        enInner +
        '</div>';
    if (allowEmptySubtitleDetail) {
        const has = (cn && String(cn).trim()) || (en && String(en).trim());
        el.classList.toggle('overlay-subtitle-empty', el.id === 'overlay-subtitle-slot' && !has);
        el.classList.toggle('overlay-detail-empty', el.id === 'overlay-detail-slot' && !has);
    }
    if (el.id === 'overlay-detail-slot' && type === 'text' && cn && String(cn).trim()) {
        const cnDiv = el.querySelector('.overlay-stack-cn');
        if (cnDiv) {
            cnDiv.classList.add('overlay-detail-cn-ellipsis');
            const plain = String(cn).replace(/\r?\n/g, ' ').trim();
            cnDiv.setAttribute('title', plain);
        }
    }
}

function applyOverlayTextBlocks(config) {
    const msgEl = document.getElementById('overlay-text');
    const subEl = document.getElementById('overlay-subtitle-slot');
    const detEl = document.getElementById('overlay-detail-slot');
    const ti = config.titleIcon || '';
    if (msgEl) {
        fillOverlayBilingualSlot(msgEl, config.message, config.message_en, config.type, false, ti);
    }
    if (subEl) {
        fillOverlayBilingualSlot(subEl, config.subtitle, config.subtitle_en, config.subtitleType, true, '');
    }
    if (detEl) {
        fillOverlayBilingualSlot(detEl, config.detail, config.detail_en, config.detailType, true, '');
    }
}

/**
 * @param {HTMLElement} progressContainer
 * @param {HTMLElement|null} progressBarInner
 * @param {string} mode hidden|indeterminate|determinate
 * @param {number|null} ratio
 */
function setOverlayProgressVisual(progressContainer, progressBarInner, mode, ratio) {
    const pctEl = document.getElementById('overlay-progress-pct');
    const overlayRoot = document.getElementById('overlay');
    function syncProgressPct(visible, pctRounded) {
        if (!pctEl) {
            return;
        }
        if (visible) {
            pctEl.textContent = String(pctRounded) + '%';
            pctEl.classList.add('overlay-progress-pct--visible');
        } else {
            pctEl.textContent = '';
            pctEl.classList.remove('overlay-progress-pct--visible');
        }
    }

    if (!progressContainer || !progressBarInner) {
        syncProgressPct(false, 0);
        refreshOverlaySpinnerVisibility();
        return;
    }
    const track = progressBarInner.parentElement;
    progressContainer.style.display = 'block';
    progressContainer.classList.add('overlay-progress-slot');

    if (mode === 'hidden') {
        track.style.visibility = 'hidden';
        progressBarInner.className = 'progress-bar';
        progressBarInner.style.width = '0%';
        syncProgressPct(false, 0);
        refreshOverlaySpinnerVisibility();
        return;
    }

    track.style.visibility = 'visible';
    progressBarInner.className = 'progress-bar';

    if (mode === 'indeterminate') {
        progressBarInner.classList.add('progress-bar-striped', 'progress-bar-animated', 'bg-primary');
        progressBarInner.style.width = '100%';
        progressBarInner.setAttribute('aria-valuenow', '100');
        progressBarInner.removeAttribute('aria-valuemax');
        progressBarInner.setAttribute('aria-valuemin', '0');
        syncProgressPct(false, 0);
        refreshOverlaySpinnerVisibility();
        return;
    }

    const r = Math.max(0, Math.min(100, ratio == null ? 0 : Number(ratio)));
    const rInt = Math.round(r);
    overlayRuntime.lastRatio = r;
    progressBarInner.style.width = `${r}%`;
    progressBarInner.setAttribute('aria-valuenow', String(rInt));
    progressBarInner.setAttribute('aria-valuemin', '0');
    progressBarInner.setAttribute('aria-valuemax', '100');
    const accent = (overlayRoot && overlayRoot.dataset && overlayRoot.dataset.overlayProgressAccent) || 'auto';
    if (accent === 'gradient-blue') {
        progressBarInner.className = 'progress-bar overlay-bar--gradient-blue';
        progressBarInner.classList.remove('progress-bar-striped', 'progress-bar-animated', 'bg-danger', 'bg-warning', 'bg-info', 'bg-success', 'bg-primary');
        syncProgressPct(true, rInt);
        refreshOverlaySpinnerVisibility();
        return;
    }
    progressBarInner.classList.add('progress-bar-striped', 'progress-bar-animated');
    if (r < 30) {
        progressBarInner.classList.add('bg-danger');
    } else if (r < 70) {
        progressBarInner.classList.add('bg-warning');
    } else if (r < 100) {
        progressBarInner.classList.add('bg-info');
    } else {
        progressBarInner.classList.add('bg-success');
        progressBarInner.classList.remove('progress-bar-animated');
    }
    syncProgressPct(true, rInt);
    refreshOverlaySpinnerVisibility();
}

function extractLayoutOptions(param) {
    if (typeof param !== 'object' || param === null) {
        return {};
    }
    return {
        spinner: param.spinner,
        progressMode: param.progressMode,
        progress: param.progress,
        cardClass: param.cardClass,
        backdropClass: param.backdropClass,
        backdropStyle: param.backdropStyle,
        minWidth: param.minWidth,
        zIndex: param.zIndex,
        cardWidth: param.cardWidth,
        overlayProgressSpinnerPolicy: param.overlayProgressSpinnerPolicy,
        theme: param.theme,
        titleIcon: param.titleIcon,
        progressAccent: param.progressAccent,
    };
}

function applyLayoutOptions(overlay, card, spinnerEl, opts) {
    if (opts.zIndex != null) {
        overlay.style.zIndex = String(opts.zIndex);
    }
    let backdropCls = 'position-fixed top-0 start-0 w-100 h-100 csgoj-overlay';
    if (opts.theme === 'dark') {
        backdropCls += ' csgoj-overlay--dark';
    }
    if (opts.backdropClass) {
        backdropCls += ' ' + opts.backdropClass;
    }
    overlay.className = backdropCls.trim();
    if (opts.backdropStyle && typeof opts.backdropStyle === 'object') {
        for (const k in opts.backdropStyle) {
            if (Object.prototype.hasOwnProperty.call(opts.backdropStyle, k)) {
                overlay.style[k] = opts.backdropStyle[k];
            }
        }
    }
    if (opts.minWidth && card) {
        card.style.minWidth = opts.minWidth;
    }
    if (opts.cardWidth && card) {
        card.style.width = opts.cardWidth;
        card.style.minWidth = opts.cardWidth;
        card.style.boxSizing = 'border-box';
    }
    let cardCls = 'card border-0 csgoj-overlay-card';
    if (opts.theme === 'dark') {
        cardCls += ' csgoj-overlay-card--dark';
    }
    if (opts.cardClass) {
        cardCls += ' ' + opts.cardClass;
    }
    if (card) {
        card.className = cardCls.trim();
    }
    if (overlay) {
        if (opts.overlayProgressSpinnerPolicy) {
            overlay.dataset.overlayProgressSpinnerPolicy = opts.overlayProgressSpinnerPolicy;
        }
        if (opts.spinner === false) {
            overlay.dataset.overlaySpinnerForcedOff = '1';
        } else if (opts.spinner === true) {
            delete overlay.dataset.overlaySpinnerForcedOff;
        }
        overlay.dataset.overlayTheme = opts.theme || '';
        overlay.dataset.overlayProgressAccent = opts.progressAccent || '';
        overlay.dataset.overlayTitleIcon = opts.titleIcon ? String(opts.titleIcon) : '';
    }
}

/**
 * 顶部转圈与进度条：默认可同时显示；progress_only 且进度非 hidden 时只保留进度条。
 */
function refreshOverlaySpinnerVisibility() {
    const overlay = document.getElementById('overlay');
    const spinner = document.getElementById('overlay-spinner');
    if (!spinner) {
        return;
    }
    if (!overlay) {
        spinner.style.display = 'block';
        return;
    }
    if (overlay.dataset.overlaySpinnerForcedOff === '1') {
        spinner.style.display = 'none';
        return;
    }
    const policy = overlay.dataset.overlayProgressSpinnerPolicy || 'both';
    const mode = overlayRuntime.progressMode;
    if (policy === 'progress_only' && mode !== 'hidden') {
        spinner.style.display = 'none';
    } else {
        spinner.style.display = 'block';
    }
}

function showOverlay(initialText) {
    const existingOverlay = document.getElementById('overlay');
    if (existingOverlay) {
        existingOverlay.remove();
    }

    ensureOverlayStableStyles();

    const layoutOpts = extractLayoutOptions(initialText);
    const config = parseOverlayParam(initialText);

    let initialMode = layoutOpts.progressMode;
    if (initialMode == null) {
        if (typeof layoutOpts.progress === 'number' && !Number.isNaN(layoutOpts.progress)) {
            initialMode = 'determinate';
        } else {
            initialMode = 'hidden';
        }
    }
    overlayRuntime.progressMode = initialMode;
    if (initialMode === 'determinate' && typeof layoutOpts.progress === 'number' && !Number.isNaN(layoutOpts.progress)) {
        overlayRuntime.lastRatio = layoutOpts.progress;
    } else {
        overlayRuntime.lastRatio = null;
    }

    const overlay = document.createElement('div');
    overlay.id = 'overlay';
    overlay.className = 'position-fixed top-0 start-0 w-100 h-100 csgoj-overlay';
    if (layoutOpts.theme === 'dark') {
        overlay.style.backgroundColor = 'rgba(15, 23, 42, 0.55)';
        overlay.style.backdropFilter = 'blur(2px)';
    } else {
        overlay.style.backgroundColor = 'rgba(15, 23, 42, 0.48)';
        overlay.style.backdropFilter = 'blur(3px)';
    }
    overlay.style.zIndex = layoutOpts.zIndex != null ? String(layoutOpts.zIndex) : '10000';

    overlay.style.display = 'flex';
    overlay.style.justifyContent = 'center';
    overlay.style.alignItems = 'center';

    const card = document.createElement('div');
    card.className = 'card border-0 csgoj-overlay-card';
    if (!layoutOpts.cardWidth) {
        card.style.minWidth = 'min(92vw, 420px)';
        card.style.maxWidth = '560px';
    }

    const cardBody = document.createElement('div');
    cardBody.className = 'card-body text-center px-4 py-4';

    const spinner = document.createElement('div');
    spinner.id = 'overlay-spinner';
    spinner.className = 'spinner-border text-primary mb-3 mx-auto';
    spinner.setAttribute('role', 'status');
    spinner.style.width = '2.75rem';
    spinner.style.height = '2.75rem';

    const spinnerText = document.createElement('span');
    spinnerText.className = 'visually-hidden';
    spinnerText.textContent = '加载中...';
    spinner.appendChild(spinnerText);

    const textContainer = document.createElement('div');
    textContainer.id = 'overlay-text';
    textContainer.className = 'text-start px-1';

    const subtitleEl = document.createElement('div');
    subtitleEl.id = 'overlay-subtitle-slot';

    const progressContainer = document.createElement('div');
    progressContainer.id = 'overlay-progress';

    const progressRow = document.createElement('div');
    progressRow.className = 'overlay-progress-row';

    const progressBar = document.createElement('div');
    progressBar.className = 'progress rounded-pill';

    const progressBarInner = document.createElement('div');
    progressBarInner.className = 'progress-bar';
    progressBarInner.setAttribute('role', 'progressbar');
    progressBar.appendChild(progressBarInner);

    const progressPct = document.createElement('span');
    progressPct.id = 'overlay-progress-pct';
    progressPct.setAttribute('aria-hidden', 'true');

    progressRow.appendChild(progressBar);
    progressRow.appendChild(progressPct);
    progressContainer.appendChild(progressRow);

    const detailEl = document.createElement('div');
    detailEl.id = 'overlay-detail-slot';

    const cancelRow = document.createElement('div');
    cancelRow.id = 'overlay-cancel-row';
    cancelRow.style.display = 'none';

    cardBody.appendChild(spinner);
    cardBody.appendChild(textContainer);
    cardBody.appendChild(subtitleEl);
    cardBody.appendChild(progressContainer);
    cardBody.appendChild(detailEl);
    /* 取消按钮放在详情（等宽信息区）下方，避免插在进度条与路径之间 */
    cardBody.appendChild(cancelRow);
    card.appendChild(cardBody);
    overlay.appendChild(card);

    document.body.appendChild(overlay);

    applyLayoutOptions(overlay, card, spinner, layoutOpts);

    applyOverlayTextBlocks(config);
    overlay.__overlayLastTextConfig = snapshotOverlayLastTextConfig(config);

    const ratioForBar =
        typeof layoutOpts.progress === 'number' && !Number.isNaN(layoutOpts.progress) ? layoutOpts.progress : null;
    setOverlayProgressVisual(progressContainer, progressBarInner, overlayRuntime.progressMode, ratioForBar);

    overlay.style.opacity = '0';
    overlay.style.transition = 'opacity 0.25s ease-in';
    setTimeout(function () {
        overlay.style.opacity = '1';
    }, 10);

    syncOverlayCancelUI(overlay, initialText, true);
}

/**
 * update 时合并上次 show 写入的 theme / titleIcon / progressAccent，避免只更新进度时丢失样式。
 * @param {string|Object} initialText
 * @returns {string|Object}
 */
function mergeOverlayUpdatePatch(initialText) {
    const overlayEl = document.getElementById('overlay');
    if (typeof initialText !== 'object' || initialText === null || !overlayEl) {
        return initialText;
    }
    const out = Object.assign({}, initialText);
    if (out.theme == null && overlayEl.dataset.overlayTheme) {
        out.theme = overlayEl.dataset.overlayTheme;
    }
    if ((out.titleIcon == null || out.titleIcon === '') && overlayEl.dataset.overlayTitleIcon) {
        out.titleIcon = overlayEl.dataset.overlayTitleIcon;
    }
    if ((out.progressAccent == null || out.progressAccent === '') && overlayEl.dataset.overlayProgressAccent) {
        out.progressAccent = overlayEl.dataset.overlayProgressAccent;
    }
    if (out.spinner !== false && overlayEl.dataset.overlaySpinnerForcedOff === '1') {
        out.spinner = false;
    }
    if (out.zIndex == null && overlayEl.style.zIndex) {
        const zi = parseInt(overlayEl.style.zIndex, 10);
        if (!Number.isNaN(zi)) {
            out.zIndex = zi;
        }
    }
    if (out.overlayProgressSpinnerPolicy == null && overlayEl.dataset.overlayProgressSpinnerPolicy) {
        out.overlayProgressSpinnerPolicy = overlayEl.dataset.overlayProgressSpinnerPolicy;
    }
    return out;
}

/**
 * @param {string|Object} initialText
 * @param {number|null} ratio
 * @param {string|null} additionText  写入 detail（纯文本）
 */
function updateOverlay(initialText, ratio, additionText) {
    const progressContainer = document.getElementById('overlay-progress');
    const progressBarInner = progressContainer ? progressContainer.querySelector('.progress-bar') : null;

    const mergedPatch = mergeOverlayUpdatePatch(initialText);
    const overlayBefore = document.getElementById('overlay');
    const prevText = overlayBefore && overlayBefore.__overlayLastTextConfig;

    let config = parseOverlayParam(mergedPatch);
    mergeOverlayTextFromPreviousIfLayoutOnly(mergedPatch, config, prevText);

    if (additionText !== null && additionText !== undefined) {
        config.detail = String(additionText);
        config.detail_en = '';
        config.detailType = 'text';
    }

    applyOverlayTextBlocks(config);

    const overlayAfterText = document.getElementById('overlay');
    if (overlayAfterText) {
        overlayAfterText.__overlayLastTextConfig = snapshotOverlayLastTextConfig(config);
    }

    const layoutOpts = extractLayoutOptions(mergedPatch);

    if (layoutOpts.progressMode === 'hidden') {
        overlayRuntime.progressMode = 'hidden';
        overlayRuntime.lastRatio = null;
    } else if (layoutOpts.progressMode === 'indeterminate') {
        overlayRuntime.progressMode = 'indeterminate';
    } else if (layoutOpts.progressMode === 'determinate' && typeof layoutOpts.progress === 'number' && !Number.isNaN(layoutOpts.progress)) {
        overlayRuntime.progressMode = 'determinate';
        overlayRuntime.lastRatio = layoutOpts.progress;
    }

    if (ratio !== null && ratio !== undefined && typeof ratio === 'number' && !Number.isNaN(ratio)) {
        overlayRuntime.progressMode = 'determinate';
        overlayRuntime.lastRatio = ratio;
    }

    const mode = overlayRuntime.progressMode;
    let effRatio = null;
    if (mode === 'determinate') {
        if (ratio !== null && ratio !== undefined && typeof ratio === 'number' && !Number.isNaN(ratio)) {
            effRatio = ratio;
        } else if (typeof layoutOpts.progress === 'number' && !Number.isNaN(layoutOpts.progress)) {
            effRatio = layoutOpts.progress;
        } else if (overlayRuntime.lastRatio != null && !Number.isNaN(overlayRuntime.lastRatio)) {
            effRatio = overlayRuntime.lastRatio;
        } else {
            effRatio = 0;
        }
    }

    setOverlayProgressVisual(progressContainer, progressBarInner, mode, effRatio);

    const card = document.querySelector('#overlay .csgoj-overlay-card');
    if (layoutOpts.cardWidth && card) {
        card.style.width = layoutOpts.cardWidth;
        card.style.minWidth = layoutOpts.cardWidth;
        card.style.boxSizing = 'border-box';
    }
    const overlayEl = overlayAfterText;
    if (overlayEl && layoutOpts.overlayProgressSpinnerPolicy) {
        overlayEl.dataset.overlayProgressSpinnerPolicy = layoutOpts.overlayProgressSpinnerPolicy;
    }

    if (overlayEl) {
        syncOverlayCancelUI(overlayEl, mergedPatch, false);
    }
}

function hideOverlay() {
    overlayRuntime.progressMode = 'hidden';
    overlayRuntime.lastRatio = null;
    const overlay = document.getElementById('overlay');
    if (overlay) {
        overlay._overlayCancelState = null;
        overlay.style.transition = 'opacity 0.25s ease-out';
        overlay.style.opacity = '0';
        setTimeout(function () {
            if (overlay.parentNode) {
                document.body.removeChild(overlay);
            }
        }, 260);
    }
}

if (typeof window !== 'undefined') {
    window.overlayCreateAbortError = overlayCreateAbortError;
    window.overlayThrowIfAborted = overlayThrowIfAborted;
}
