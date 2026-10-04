// **************************************************
// Markdown 工具函数
// 依赖：CsgVditor, DOMPurify
// 注意：已禁用 marked，只使用 Vditor
// 数学公式渲染请使用 math.js 中的 MathRender 函数
// **************************************************

/**
 * 异步版本的 Markdown 解析，使用 Vditor 渲染
 * @param {string|any} content - Markdown 字符串
 * @param {boolean} il - 是否为行内模式（默认 true，但 Vditor 不区分行内/块级）
 * @returns {Promise<string>} HTML 字符串的 Promise
 */
async function MarkdownParseAsync(content, il=true) {
    if(!((typeof content) == 'string')) {
        return content;
    }
    // 只使用 Vditor.md2html 异步渲染
    try {
        // 所有依赖已全局引入，直接使用
        const htmlPromise = CsgVditor.md2html(content);
        // 如果返回的是 Promise，等待它
        if (htmlPromise instanceof Promise) {
            const html = await htmlPromise;
            if (html !== null && html !== undefined && html !== '') {
                return html;
            }
        } else {
            // 如果直接返回字符串，直接返回
            if (htmlPromise !== null && htmlPromise !== undefined && htmlPromise !== '') {
                return htmlPromise;
            }
        }
    } catch (e) {
        console.error('Vditor.md2html failed:', e);
    }
    // 如果 Vditor 不可用，返回原始内容（不再使用 marked）
    return content;
}

/**
 * 同步版本的 Markdown 解析（兼容旧代码）
 * 注意：由于 Vditor.md2html 是异步的，此函数返回占位符，实际渲染需要异步完成
 * @param {string|any} content - Markdown 字符串
 * @param {boolean} il - 是否为行内模式（默认 true，Vditor 不区分）
 * @returns {string} 占位符 HTML 字符串
 */
function MarkdownParse(content, il=true) {
    if(!((typeof content) == 'string')) {
        return content;
    }
    // 由于 Vditor 是异步的，在同步上下文中返回占位符
    // 实际渲染需要在异步上下文中使用 MarkdownParseAsync
    // 这里返回一个带 data-md 属性的占位符，后续可以异步更新
    // 对 content 进行 HTML 转义，避免 XSS 和属性值问题
    const escaped = String(content)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    const preview = String(content).substring(0, 100).replace(/\n/g, ' ');
    return `<span class="vditor-placeholder" data-md="${escaped}">${preview}${content.length > 100 ? '...' : ''}</span>`;
}

/**
 * 将数组中的每个元素都进行 Markdown 解析（同步版本，返回占位符）
 * @param {Array} ar - 字符串数组
 */
function MarkdownConvertArray(ar) {
    for(let i in ar) {
        ar[i] = MarkdownParse(ar[i], false);
    }
}

/**
 * 异步版本的数组 Markdown 解析，使用 Vditor 渲染
 * @param {Array} ar - 字符串数组
 * @returns {Promise<Array>} 渲染后的 HTML 数组的 Promise
 */
async function MarkdownConvertArrayAsync(ar) {
    const promises = [];
    for(let i in ar) {
        promises.push(MarkdownParseAsync(ar[i], false));
    }
    return Promise.all(promises);
}

/**
 * HTML 安全处理，可选的 Markdown 转换
 * @param {string} content_str - 内容字符串
 * @param {boolean} markdown_convert - 是否进行 Markdown 转换
 * @returns {string} 处理后的 HTML 字符串
 */
function ConvertHtmlSafeProcess(content_str, markdown_convert=false) {
    if(markdown_convert) {
        content_str = MarkdownParse(content_str, false);
    }
    return $.trim(DOMPurify.sanitize(content_str));
}

// 数学公式处理函数已移至 math.js
// 请使用 MathRender, MathDomProcess, MathCodeProcess
// 兼容函数：MathjaxRender, MathjaxDomProcess, MathJaxCodeProcess 会自动调用 math.js 中的函数

// **************************************************
// Vditor 渲染函数（统一版本，供所有页面使用）
// **************************************************

/**
 * 渲染 Markdown 预览
 * @param {HTMLElement} previewEl - 预览元素
 * @param {string} mdText - Markdown 文本
 */
function renderMdPreview(previewEl, mdText) {
    if (!previewEl) return;
    // mdText 在不同页面/题型下可能是 string / number / array / object
    // 这里统一做一次安全规范化，避免出现 `(mdText || '').trim is not a function`
    const normalizeMdText = (v) => {
        if (v === undefined || v === null) return '';
        if (typeof v === 'string') return v;
        if (typeof v === 'number' || typeof v === 'boolean') return String(v);
        if (Array.isArray(v)) {
            return v.map((x) => {
                if (x === undefined || x === null) return '';
                if (typeof x === 'string') return x;
                if (typeof x === 'number' || typeof x === 'boolean') return String(x);
                if (typeof x === 'object') {
                    if (typeof x.markdown === 'string') return x.markdown;
                    if (typeof x.md === 'string') return x.md;
                    if (typeof x.content === 'string') return x.content;
                    if (typeof x.text === 'string') return x.text;
                    try { return JSON.stringify(x); } catch (e) { return String(x); }
                }
                try { return String(x); } catch (e) { return ''; }
            }).join('\n');
        }
        if (typeof v === 'object') {
            // 常见字段兼容：{markdown}/{md}/{content}/{text}
            if (typeof v.markdown === 'string') return v.markdown;
            if (typeof v.md === 'string') return v.md;
            if (typeof v.content === 'string') return v.content;
            if (typeof v.text === 'string') return v.text;
            try { return JSON.stringify(v); } catch (e) { return String(v); }
        }
        try { return String(v); } catch (e) { return ''; }
    };

    // 非字符串输入仅告警一次，便于定位 state.content/source 数据结构问题
    if (typeof mdText !== 'string' && typeof window !== 'undefined') {
        if (!window.__csg_renderMdPreview_warned) {
            window.__csg_renderMdPreview_warned = true;
            try {
                console.warn('[renderMdPreview] mdText 非字符串，已自动转换为字符串预览：', mdText);
            } catch (e) {}
        }
    }

    let text = normalizeMdText(mdText).trim();
    if (!text) {
        previewEl.innerHTML = '<span class="text-muted bilingual-inline">尚未填写<span class="en-text">Not filled</span></span>';
        return;
    }
    
    // 修复数学公式边界识别问题：
    // Lute 引擎在识别 $...$ 时，如果 $ 前后紧贴其他字符（尤其是中文标点），可能会误判边界
    // 例如：$a$。$b$ 可能被识别为一个公式 $a$。$b$
    // 解决方案：统一在所有单个 $ 的前后添加空格（但不影响 $$ 显示公式）
    
    const originalText = text;
    
    // 分步处理，确保所有单个 $ 前后都有空格：
    
    // 1. 先处理 $ 前面：如果前面不是空白或 $，添加空格
    // 注意：$1 = 捕获组1，$$ = 字面量$，所以 $$$ = $+捕获组，$$$$ = $$
    const step1 = text.replace(/([^\s\$])\$([^\$])/g, '$1 $$$2');  // $1 + 空格 + $ + $2
    
    // 2. 再处理 $ 后面：如果后面不是空白或 $，添加空格
    text = step1.replace(/([^\$])\$([^\s\$])/g, '$1$$ $2');  // $1 + $ + 空格 + $2
    
    // 所有依赖已全局引入，直接使用
    CsgVditor.render({
        el: previewEl,
        markdown: text
    });

    // 为渲染出来的图片添加缺失兜底（避免附件丢失时页面出现大片破图）
    attachImageMissingFallback(previewEl);
    
    // 强制渲染数学公式（包括纯数字的公式，如 $25,15,10$）
    // 使用 KaTeX auto-render 扩展确保所有 $...$ 格式都被正确渲染
    if (typeof renderMathInElement !== 'undefined' && typeof katex !== 'undefined') {
        setTimeout(() => {
            try {
                renderMathInElement(previewEl, {
                    delimiters: [
                        {left: "$$", right: "$$", display: true},
                        {left: "$", right: "$", display: false},
                        {left: "\\[", right: "\\]", display: true},
                        {left: "\\(", right: "\\)", display: false}
                    ],
                    throwOnError: false,
                    ignoredTags: ["script", "noscript", "style", "textarea", "pre", "code"]
                });
            } catch (e) {
                console.warn('KaTeX auto-render failed:', e);
            }
        }, 100);
    }
}

/**
 * 图片缺失兜底：图片 404 时隐藏破图，并显示“附件不存在”提示（带链接）
 * @param {HTMLElement} container
 */
function attachImageMissingFallback(container) {
    if (!container) return;
    const imgs = Array.from(container.querySelectorAll('img'));
    imgs.forEach((img) => {
        if (!img || img.dataset?.csgImgFallbackBound === '1') return;
        img.dataset.csgImgFallbackBound = '1';
        img.addEventListener('error', () => {
            // 防止重复处理
            if (img.dataset.csgImgFailed === '1') return;
            img.dataset.csgImgFailed = '1';

            const src = img.getAttribute('src') || '';
            // 隐藏破图
            img.style.display = 'none';

            // 插入提示
            const tip = document.createElement('div');
            tip.className = 'alert alert-warning py-2 px-3 my-2';
            tip.style.fontSize = '0.875rem';
            tip.innerHTML = `
                <div class="d-flex align-items-center gap-2 flex-wrap">
                    <strong class="bilingual-inline">附件不存在<span class="en-text">Attachment missing</span></strong>
                    ${src ? `<a class="small text-decoration-underline" href="${src}" target="_blank" rel="noopener">打开链接</a>` : ''}
                </div>
            `;

            // 插到图片位置
            if (img.parentNode) {
                img.parentNode.insertBefore(tip, img.nextSibling);
            }
        });
    });
}

/**
 * 处理 vditor 占位符，异步渲染 Markdown
 * @param {HTMLElement} container - 容器元素
 */
function processVditorPlaceholders(container) {
    if (!container) return;
    
    const placeholders = Array.from(container.querySelectorAll('.vditor-placeholder'));
    placeholders.forEach((placeholder) => {
        const encodedMd = placeholder.getAttribute('data-md');
        if (!encodedMd) return;
        
        // 解码 HTML 实体
        const decodeHtml = (str) => {
            if (!str) return '';
            return str
                .replace(/&lt;/g, '<')
                .replace(/&gt;/g, '>')
                .replace(/&amp;/g, '&')
                .replace(/&quot;/g, '"')
                .replace(/&#39;/g, "'");
        };
        
        const md = decodeHtml(encodedMd);
        if (!md || md.trim() === '') return;
        
        const tempDiv = document.createElement('div');
        tempDiv.className = 'vditor-preview-container';
        if (!placeholder.parentNode) return;
        placeholder.parentNode.replaceChild(tempDiv, placeholder);
        
        renderMdPreview(tempDiv, md);
    });
}

// 确保全局可用
if (typeof window !== 'undefined') {
    window.renderMdPreview = renderMdPreview;
    window.processVditorPlaceholders = processVditorPlaceholders;
}

