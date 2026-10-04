// **************************************************
// 题目预览功能
// 依赖：question_md_utils.js (renderMdPreview), question_default, QuestionRender, alerty, MathRender (from math.js), jQuery
// 注意：PAGE_MODULE 常量在 ex_global.js 中定义
// 注意：renderMdPreview 函数已移至 question_md_utils.js
// **************************************************

// 防重复加载：如果已定义则跳过
if (typeof show_question === 'undefined') {
/**
 * 显示题目预览
 * @param {number|string} ex_question_id - 题目ID
 * @param {string} url - 请求URL（默认 "/exadmin/question/question_ajax"）
 */
function show_question(ex_question_id, url="/exadmin/question/question_ajax") {
    $.get(url, { ex_question_id: ex_question_id }, function(ret) {
        if(ret.code == 1) {
            const showAnswer = !window.questionPreviewConfig || window.questionPreviewConfig.showAnswer !== false;
            let pkind_name = question_default['pkind_table'][ret['data']['pkind']];
            let question_show_html;
            if(pkind_name == 'Programming') {
                // 编程题需要异步加载 OJ 题目
                // 根据传入的 URL 推断 problem_ajax 的路径
                // 从 /exadmin/question/question_ajax 转换为 /exadmin/exam/problem_ajax
                let problemUrl = '/exadmin/exam/problem_ajax';
                if (url.includes('/question/question_ajax')) {
                    problemUrl = url.replace('/question/question_ajax', '/exam/problem_ajax');
                } else if (url.includes('/exam/question_ajax')) {
                    problemUrl = url.replace('/question_ajax', '/problem_ajax');
                }
                // 预览模式：始终使用 show=true（只读预览 UI）；参考代码/解析是否展示由全局开关控制
                QuestionRender.html.Programming_async(ret['data'], null, true, problemUrl).then(function(html) {
                    renderQuestionPreview(html, ret.data, ex_question_id, url);
                });
                return;
            } else {
                // show=true：只读预览 UI；参考答案/解析是否展示由全局开关控制
                question_show_html = QuestionRender.html[pkind_name](ret['data'], null, true);
            }
            renderQuestionPreview(question_show_html, ret.data, ex_question_id, url);
        } else {
            alerty.error(ret['msg']);
        }
    }, 'json').fail(function() {
        alerty.error('加载题目失败');
    });
}

/**
 * 渲染题目预览内容
 * @param {string} question_show_html - 题目 HTML 字符串
 * @param {Object} question_data - 题目数据
 * @param {number|string} ex_question_id - 题目ID
 * @param {string} url - 请求URL（用于构建 usage_ajax 路径）
 */
function renderQuestionPreview(question_show_html, question_data, ex_question_id, url='/exadmin/question/question_ajax') {
    const pkindType = question_default['pkind_table'][question_data.pkind];
    let q_div = $(question_show_html)[0];
    // 先渲染答案（会包含占位符）——监考等“考试内权限”不展示参考答案/解析
    const showAnswer = !window.questionPreviewConfig || window.questionPreviewConfig.showAnswer !== false;
    if (showAnswer) {
        QuestionRender.ans.Render(question_data, q_div);
    }
    // 使用列表（独立接口获取）
    // 对监考等“考试内权限”（非管理员/非教师）隐藏该区块
    const showUsage = (window.questionPreviewConfig && window.questionPreviewConfig.showUsage === false) ? false : true;
    let usageWrap = null;
    if (showUsage) {
        usageWrap = document.createElement('div');
        usageWrap.className = 'mt-3';
        usageWrap.setAttribute('data-usage', '1');
        usageWrap.innerHTML = `
            <div class="d-flex align-items-center justify-content-between mb-1">
                <div><strong>使用该题的考试<span class="en-text">Contests Using This Question</span></strong></div>
                <div class="text-muted small usage-count">加载中...</div>
            </div>
            <div class="text-muted small">加载中...</div>
        `;
        q_div.appendChild(usageWrap);
    }
    // 直接创建 Bootstrap5 Modal 进行预览（不使用 alerty.modal，避免出现确认按钮）
    const modalPlaceholder = '<div class="question-preview-holder"></div>';
    // HTML 转义辅助函数：使用全局 DomSantize（来自 global.js）
    const escapeHtml = (text) => DomSantize(text);
    
    // 获取题目类型信息
    // question_default 在 question_default.js 中定义
    const pkind = question_data.pkind || 0;
    const pkindName = question_default.pkind_table_cn[pkind];
    const pkindNameEn = question_default.pkind_table_en[pkind];
    const pkindColor = question_default.pkind_color[pkind];
    const badgeTextColor = question_default.pkind_contrast_color[pkind];
    
    // 生成题目类型 badge
    const typeBadge = `<span class="question-preview-type-badge" style="background-color: ${pkindColor}; color: ${badgeTextColor};" title="${pkindName} / ${pkindNameEn}">${pkindName}</span>`;
    
    const modalId = 'question-preview-modal-' + Date.now();
    const modalHtml = `
        <div class="modal fade" id="${modalId}" tabindex="-1" aria-labelledby="${modalId}Label" aria-hidden="true" data-bs-backdrop="true" data-bs-keyboard="true">
            <div class="modal-dialog modal-xl question-preview-modal" style="max-width: 1200px;">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title d-flex align-items-center gap-2" id="${modalId}Label">
                            ${typeBadge}
                            <span>题目预览：${ex_question_id}-${escapeHtml(question_data.title)}</span>
                        </h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                    </div>
                    <div class="modal-body question-preview-body">
                        ${modalPlaceholder}
                    </div>
                </div>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    const modalElement = document.getElementById(modalId);
    const modal = new bootstrap.Modal(modalElement, {
        backdrop: true,
        keyboard: false // 手动监听 ESC，避免焦点问题
    });
    // 手动捕获 ESC，确保无论焦点在哪都能关闭
    const escHandler = (e) => {
        if (e.key === 'Escape') {
            modal.hide();
        }
    };
    document.addEventListener('keydown', escHandler, true);
    modalElement.addEventListener('hidden.bs.modal', () => {
        document.removeEventListener('keydown', escHandler, true);
    });
    modal.show();
    
    // 渲染占位符 & 加载使用列表（在 modal 挂载后执行）
    setTimeout(() => {
        const modalBody = modalElement.querySelector('.modal-body');

        // 将真实内容 DOM 插入到 modal body（避免字符串被转义）
        const holder = modalBody.querySelector('.question-preview-holder');
        if (holder) {
            holder.innerHTML = '';
            // 为预览模式添加特殊类名
            q_div.classList.add('question-preview-mode');
            holder.appendChild(q_div);
        }

        // 使用与编辑页一致的渲染方式：直接 CsgVditor.render 到容器
        const decodeHtml = (str) => {
            if (!str) return '';
            return str
                .replace(/&lt;/g, '<')
                .replace(/&gt;/g, '>')
                .replace(/&amp;/g, '&')
                .replace(/&quot;/g, '"')
                .replace(/&#39;/g, "'");
        };

        // 处理所有占位符（题目描述、答案等区域的占位符）
        // 注意：答案解析/评分建议区域如果被截断，不会有占位符（显示纯文本）
        const placeholders = Array.from(modalBody.querySelectorAll('.vditor-placeholder'));
        placeholders.forEach((placeholder) => {
            const encodedMd = placeholder.getAttribute('data-md');
            if (!encodedMd) return;
            const md = decodeHtml(encodedMd);
            if (!md || md.trim() === '') return;

            const tempDiv = document.createElement('div');
            tempDiv.className = 'vditor-preview-container';
            if (!placeholder.parentNode) return;
            placeholder.parentNode.replaceChild(tempDiv, placeholder);

            renderMdPreview(tempDiv, md);
        });

        // 加载"使用该题的考试"列表：仅 showUsage 时执行
        const usageTarget = showUsage ? (modalBody.querySelector('[data-usage="1"]') || usageWrap) : null;
        if (usageTarget) {
            // 根据传入的 URL 推断 usage_ajax 的路径
            // 支持多种 URL 格式：/exadmin/question/question_ajax 或 /exadmin/exam/question_ajax
            let usageUrl = '/exadmin/question/question_usage_ajax';
            if (url.includes('/question/question_ajax')) {
                usageUrl = url.replace('/question_ajax', '/question_usage_ajax');
            } else if (url.includes('/exam/question_ajax')) {
                usageUrl = url.replace('/question_ajax', '/question_usage_ajax');
            }
            $.get(usageUrl, { ex_question_id: ex_question_id }, function(uRet) {
                const list = Array.isArray(uRet?.data) ? uRet.data : [];
                // 按 contest_id 倒序排列（新的考试在前）
                list.sort((a, b) => (b.contest_id || 0) - (a.contest_id || 0));
                const container = usageTarget;
                const countEl = container.querySelector('.usage-count');
                if (countEl) countEl.textContent = `共 ${list.length} 场`;
                if (list.length === 0) {
                    container.innerHTML = `
                        <div class="d-flex align-items-center justify-content-between mb-1">
                            <div><strong>使用该题的考试<span class="en-text">Contests Using This Question</span></strong></div>
                            <div class="text-muted small usage-count">共 0 场</div>
                        </div>
                        <div class="text-muted small">无</div>
                    `;
                    return;
                }
                const ul = document.createElement('ul');
                ul.className = 'list-group list-group-flush mb-0';
                list.forEach((c) => {
                    const li = document.createElement('li');
                    li.className = 'list-group-item px-0 py-1 d-flex justify-content-between align-items-center';
                    const link = document.createElement('a');
                    link.href = `/${PAGE_MODULE}/contest/contest?cid=${c.contest_id}`;
                    link.target = '_blank';
                    link.textContent = `${c.contest_id} - ${c.title || '未命名考试'}`;
                    const extra = document.createElement('span');
                    extra.className = 'text-muted small ms-2';
                    extra.textContent = c.start_time ? c.start_time : '';
                    li.appendChild(link);
                    li.appendChild(extra);
                    ul.appendChild(li);
                });
                container.innerHTML = `
                    <div class="d-flex align-items-center justify-content-between mb-1">
                        <div><strong>使用该题的考试<span class="en-text">Contests Using This Question</span></strong></div>
                        <div class="text-muted small usage-count">共 ${list.length} 场</div>
                    </div>
                `;
                container.appendChild(ul);
            }, 'json').fail(function() {
                const container = usageTarget;
                container.innerHTML = `
                    <div class="d-flex align-items-center justify-content-between mb-1">
                        <div><strong>使用该题的考试<span class="en-text">Contests Using This Question</span></strong></div>
                        <div class="text-muted small usage-count">-</div>
                    </div>
                    <div class="text-danger small">加载失败</div>
                `;
            });
        }

        // 处理答案解析和评分建议的展开链接
        const handleExpandLink = (link, previewContent, fullText) => {
            // 保存初始的预览HTML（用于收起时恢复）
            const originalPreviewHtml = previewContent.innerHTML;
            const isTruncated = previewContent.getAttribute('data-is-truncated') === '1';
            
            link.addEventListener('click', function(e) {
                e.preventDefault();
                const isExpanded = previewContent.style.maxHeight === 'none';
                
                const fullTextDecoded = fullText
                    .replace(/&amp;/g, '&')
                    .replace(/&lt;/g, '<')
                    .replace(/&gt;/g, '>')
                    .replace(/&quot;/g, '"')
                    .replace(/&#39;/g, "'");
                
                if (isExpanded) {
                    // 收起：恢复原始预览HTML（可能是纯文本或渲染后的HTML）
                    previewContent.style.maxHeight = '120px';
                    previewContent.style.overflow = 'hidden';
                    previewContent.innerHTML = originalPreviewHtml;
                    
                    link.innerHTML = '<i class="bi bi-arrows-expand"></i>';
                    link.title = '展开完整内容 / Expand full content';
                } else {
                    // 展开：使用 MarkdownParse 渲染完整内容（和题目描述一致）
                    previewContent.style.maxHeight = 'none';
                    previewContent.style.overflow = 'visible';
                    
                    // 使用 MarkdownParse 生成占位符HTML（与初始渲染一致）
                    if (typeof MarkdownParse === 'function') {
                        const placeholderHtml = MarkdownParse(fullTextDecoded, false);
                        previewContent.innerHTML = placeholderHtml;
                        
                        // 处理新生成的占位符
                        setTimeout(() => {
                            const placeholders = Array.from(previewContent.querySelectorAll('.vditor-placeholder'));
                            placeholders.forEach((placeholder) => {
                                const encodedMd = placeholder.getAttribute('data-md');
                                if (!encodedMd) return;
                                const md = decodeHtml(encodedMd);
                                if (!md || md.trim() === '') return;

                                const tempDiv = document.createElement('div');
                                tempDiv.className = 'vditor-preview-container';
                                tempDiv.style.display = 'inline';
                                if (!placeholder.parentNode) return;
                                placeholder.parentNode.replaceChild(tempDiv, placeholder);

                                if (typeof renderMdPreview === 'function') {
                                    renderMdPreview(tempDiv, md);
                                }
                            });
                        }, 50);
                    } else {
                        // 降级：直接显示文本
                        previewContent.textContent = fullTextDecoded;
                    }
                    
                    link.innerHTML = '<i class="bi bi-arrows-angle-contract"></i>';
                    link.title = '收起 / Collapse';
                }
            });
        };
        
        // 绑定答案解析展开链接
        modalBody.querySelectorAll('.answer-explain-expand-link').forEach(link => {
            const qid = link.getAttribute('data-qid');
            const previewContent = modalBody.querySelector(`.answer-explain-section[data-qid="${qid}"] .answer-explain-preview-content`);
            if (previewContent) {
                const fullText = previewContent.getAttribute('data-full-text') || '';
                handleExpandLink(link, previewContent, fullText);
            }
        });
        
        // 绑定评分建议展开链接
        modalBody.querySelectorAll('.score-advice-expand-link').forEach(link => {
            const qid = link.getAttribute('data-qid');
            const previewContent = modalBody.querySelector(`.score-advice-section[data-qid="${qid}"] .score-advice-preview-content`);
            if (previewContent) {
                const fullText = previewContent.getAttribute('data-full-text') || '';
                handleExpandLink(link, previewContent, fullText);
            }
        });

        // 触发数学公式渲染（仅编程题需要）
        if (pkindType === 'Programming') {
            MathRender('.marked_math_div', modalBody || document, true);
        }
    }, 50);
}
// 将函数暴露到全局作用域
window.show_question = show_question;
window.renderQuestionPreview = renderQuestionPreview;
} // 结束防重复加载检查

