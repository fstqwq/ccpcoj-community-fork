/**
 * 通用代码渲染（行号 + highlight.js）
 * - 底层渲染逻辑，可被不同模块复用（考试板块、acm oj板块）
 * - 使用 textContent 写入代码，避免 <...> 被当作 HTML 解析，消除 highlight.js 安全警告
 *
 * 依赖：
 * - highlight.js（全局 hljs，可选）
 */

(function () {

    /**
     * 将语言名称转换为 highlight.js 能识别的名称
     * @param {string} lang - 原始语言名称
     * @returns {string} highlight.js 语言名称
     */
    function normalizeLanguage(lang) {
        if (!lang) return '';
        
        const langLower = lang.toLowerCase().trim();
        
        // 语言名称映射表（参考 code_show.js 和 question_render.js）
        const languageMap = {
            'c': 'c',
            'c++': 'cpp',
            'cpp': 'cpp',
            'java': 'java',
            'python': 'python',
            'python3': 'python',
            'py': 'python',
            'javascript': 'javascript',
            'js': 'javascript',
            'go': 'go',
            'rust': 'rust',
            'php': 'php',
            'ruby': 'ruby',
            'rb': 'ruby'
        };
        
        // 先尝试直接匹配
        if (languageMap[langLower]) {
            return languageMap[langLower];
        }
        
        // 尝试匹配大小写变体（如 Python3, PYTHON3 等）
        const langTitle = lang.charAt(0).toUpperCase() + langLower.slice(1);
        if (languageMap[langTitle]) {
            return languageMap[langTitle];
        }
        
        // 如果都不匹配，返回小写版本（highlight.js 可能支持）
        return langLower;
    }

    /**
     * @param {string} code
     * @param {Object} options
     * @param {boolean} options.enableHighlight
     * @param {boolean} options.enableLineNumber
     * @param {string|null} options.language - 语言（例如 cpp / java / python / Python3），null/'' 为不指定
     * @param {string|null} options.maxHeight - 例如 '400px'（已废弃，改用 cssClass）
     * @param {string|null} options.cssClass - CSS 类名（用于控制样式，替代 maxHeight 内联样式）
     * @returns {Array} jQuery 风格：返回 [container]
     */
    window.renderCode = function (code, options = {}) {
        // 规范化语言名称
        const normalizedLang = normalizeLanguage(options.language || '');
        
        const opts = {
            enableHighlight: options.enableHighlight !== false,
            enableLineNumber: options.enableLineNumber !== false,
            language: normalizedLang,
            maxHeight: options.maxHeight || null,
            cssClass: options.cssClass || null
        };

        // 处理空代码
        if (!code || (typeof code === 'string' && code.trim() === '')) {
            const emptyDiv = document.createElement('div');
            emptyDiv.className = 'code-viewer-container';
            emptyDiv.innerHTML = `
                <div class="text-center p-5 text-muted">
                    <i class="bi bi-code-slash fs-1"></i>
                    <p class="mt-2">暂无代码 / No Code</p>
                </div>
            `;
            return [emptyDiv];
        }

        const codeStr = String(code);
        const lines = codeStr.split('\n');
        const lineNumbersStr = lines.map((_, idx) => idx + 1).join('\n');

        // 容器
        const container = document.createElement('div');
        container.className = 'code-viewer-container';
        if (opts.cssClass) {
            container.classList.add(opts.cssClass);
        } else if (opts.maxHeight) {
            container.style.maxHeight = opts.maxHeight;
            container.style.overflowY = 'auto';
        }

        const wrapper = document.createElement('div');
        wrapper.className = 'code-viewer-content';
        container.appendChild(wrapper);

        if (opts.enableLineNumber) {
            // 使用 table td 方式实现行号，便于代码在宽度限制下折行时不会行号错乱
            const table = document.createElement('table');
            table.className = 'code-line-number-table';
            
            const tbody = document.createElement('tbody');
            
            // 为每一行创建 tr，包含行号 td 和代码内容 td
            lines.forEach((line, index) => {
                const tr = document.createElement('tr');
                tr.className = 'code-line-row';
                
                // 行号 td
                const lineNumberTd = document.createElement('td');
                lineNumberTd.className = 'code-line-number-td';
                const lineNumberPre = document.createElement('pre');
                lineNumberPre.className = 'code-line-number-pre';
                lineNumberPre.textContent = (index + 1).toString();
                lineNumberTd.appendChild(lineNumberPre);
                
                // 代码内容 td
                const codeContentTd = document.createElement('td');
                codeContentTd.className = 'code-line-content-td';
                const codePre = document.createElement('pre');
                codePre.className = 'code-line-content-pre';
                const codeEl = document.createElement('code');
                
                // 关键：用 textContent 写入，避免 HTML 注入/解析
                codeEl.textContent = line;
                
                if (opts.language) {
                    codeEl.className = `language-${opts.language}`;
                }
                
                codePre.appendChild(codeEl);
                codeContentTd.appendChild(codePre);
                
                tr.appendChild(lineNumberTd);
                tr.appendChild(codeContentTd);
                tbody.appendChild(tr);
            });
            
            table.appendChild(tbody);
            wrapper.appendChild(table);
            
            // highlight：对每一行的 code 元素进行高亮
            if (opts.enableHighlight && typeof hljs !== 'undefined') {
                try {
                    const codeElements = wrapper.querySelectorAll('code');
                    codeElements.forEach(codeEl => {
                        try {
                            hljs.highlightElement(codeEl);
                        } catch (e) {
                            console.warn('Code highlighting failed for line:', e);
                        }
                    });
                } catch (e) {
                    console.warn('Code highlighting failed:', e);
                }
            }
        } else {
            const pre = document.createElement('pre');
            const codeEl = document.createElement('code');

            // 关键：用 textContent 写入，避免 HTML 注入/解析
            codeEl.textContent = codeStr;

            if (opts.language) {
                codeEl.className = `language-${opts.language}`;
            }

            pre.appendChild(codeEl);
            wrapper.appendChild(pre);
            
            // highlight
            if (opts.enableHighlight && typeof hljs !== 'undefined') {
                try {
                    hljs.highlightElement(codeEl);
                } catch (e) {
                    console.warn('Code highlighting failed:', e);
                }
            }
        }

        return [container];
    };
})();


