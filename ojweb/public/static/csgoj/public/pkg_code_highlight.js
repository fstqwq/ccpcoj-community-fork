/**
 * CSGOJ - highlight.js 通用封装
 * 目标：
 * - 统一 hljs 全局配置（含第三方安全告警 suppress）
 * - 提供“自动扫描高亮”和“手动高亮”的统一 API
 *
 * 约束：
 * - 不依赖 jQuery
 * - 可被重复引入（幂等）
 */
(function () {
    'use strict';

    if (typeof window !== 'undefined' && window.CsgCodeHighlight) return;

    function ensureHljsConfigured() {
        if (typeof hljs === 'undefined') return false;
        try {
            // highlight.js security wiki:
            // https://github.com/highlightjs/highlight.js/wiki/security
            hljs.configure({ ignoreUnescapedHTML: true, throwUnescapedHTML: false });
        } catch (e) {
            // ignore
        }
        return true;
    }

    function looksLikePandocPreHighlighted(codeEl) {
        if (!codeEl || !codeEl.classList) return false;
        if (codeEl.classList.contains('sourceCode')) return true;
        const p = codeEl.parentElement;
        return !!(p && p.classList && p.classList.contains('sourceCode'));
    }

    /**
     * 安全高亮单个 code 元素（避免 unescaped HTML 告警、避免重复高亮）
     * @param {HTMLElement} codeEl <code> 元素
     * @returns {boolean} 是否执行了高亮
     */
    function highlightElementSafe(codeEl) {
        if (!ensureHljsConfigured()) return false;
        if (!codeEl) return false;

        try {
            // 已高亮：跳过
            if (codeEl.dataset && codeEl.dataset.highlighted === 'yes') return false;
            if (codeEl.classList && codeEl.classList.contains('hljs')) return false;

            // Pandoc 预高亮（带 span 子节点）会输出带 class 的 HTML 结构，但在未加载 Pandoc 高亮 CSS 时看起来“没高亮”。
            // 这里统一“转回纯文本 + 用 hljs 高亮”，保证各模块展示一致。
            const hasElementChild = !!(codeEl.querySelector && codeEl.querySelector('*'));
            if (hasElementChild) {
                if (looksLikePandocPreHighlighted(codeEl)) {
                    // Pandoc：用 textContent 抹掉 span 结构
                    codeEl.textContent = codeEl.textContent;
                } else {
                    // 非 Pandoc：当作“未转义 HTML”注入，把 innerHTML 字面量化
                    codeEl.textContent = codeEl.innerHTML;
                }
            }

            hljs.highlightElement(codeEl);
            return true;
        } catch (e) {
            console.warn('CsgCodeHighlight.highlightElementSafe failed:', e);
            return false;
        }
    }

    /**
     * 自动扫描并高亮（默认扫描 root 下的 pre code）
     * @param {Document|HTMLElement} root
     * @returns {number} 高亮数量
     */
    function highlightAuto(root) {
        if (!ensureHljsConfigured()) return 0;
        const scope = root || document;
        const list = scope.querySelectorAll ? scope.querySelectorAll('pre code') : [];
        let cnt = 0;
        list.forEach((codeEl) => {
            if (highlightElementSafe(codeEl)) cnt++;
        });
        return cnt;
    }

    // 导出
    window.CsgCodeHighlight = {
        ensureHljsConfigured,
        highlightElementSafe,
        highlightAuto
    };

    // 默认行为：DOMReady 后自动扫描一次（覆盖原 code_highlight 的“自动高亮”语义）
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function () {
            highlightAuto(document);
        });
    } else {
        highlightAuto(document);
    }
})();


