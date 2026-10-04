// 注意：MarkdownParse, MarkdownConvertArray, ConvertHtmlSafeProcess 在 question_md_utils.js
// 注意：PAGE_MODULE 常量在 ex_global.js 中定义

function GetFakeTitle(question, oj_problem=null) {
    let fake_title;
    if(oj_problem == null) {
        fake_title = typeof(question.description) == 'string' ? question.description.split(/[\$<`]/)[0] : '-';
    } else {
        fake_title = 'title' in oj_problem && oj_problem.title != '' ? oj_problem.title : oj_problem.description.split(/[\$<`]/)[0];
    }
    if(fake_title.trim() == '') {
        fake_title = '-';
    }
    if(fake_title.length > 100) {
        fake_title = fake_title.substring(0, 100);
    }
    return fake_title;
}

// ======================================================
// examsys：选择题选项稳定乱序（仅考试答题页启用）
// - 只影响 /examsys/contest/problemset（不影响单页、预览、阅卷、导出）
// - 提交仍按原始选项对应（依赖 input.value = 原始下标）
// ======================================================
function CsgExamShouldShuffleChoiceOptions() {
    try {
        // 仅考试答题页启用：由 view 下发 window.examProblemsetConfig.page = 'examsys_problemset'
        if (!window.examProblemsetConfig) return false;
        if (window.examProblemsetConfig.page !== 'examsys_problemset') return false;
        return String(window.examProblemsetConfig.shuffle_choice || '0') === '1';
    } catch (e) {
        return false;
    }
}
function CsgHash32FNV1a(str) {
    let h = 2166136261;
    str = String(str || '');
    for (let i = 0; i < str.length; i++) {
        h ^= str.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    return h >>> 0;
}
function CsgMulberry32(seed) {
    let a = seed >>> 0;
    return function () {
        a |= 0;
        a = (a + 0x6D2B79F5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
function CsgChoicePermutation(ex_question_id, n) {
    // 返回 perm[displayIdx] = origIdx
    const arr = Array.from({ length: n }, (_, i) => i);
    if (!CsgExamShouldShuffleChoiceOptions()) return arr;
    const cid = String(window.examProblemsetConfig.cid || '');
    // 已登录考试账号（cpc_team）时：用 team_id 作为 seed，确保同一账号多次进入/刷新乱序一致
    // 未登录考试账号（管理员/教师只看题）时：用固定 seed，保证“未登录视角”也稳定一致
    const teamId = String(window.examProblemsetConfig.contest_user || '');
    const seedUser = (teamId && teamId.trim() !== '') ? teamId.trim() : '__NO_CPC_TEAM__';
    const key = `choice_shuffle_v1|${cid}|${seedUser}|${String(ex_question_id)}`;
    const rand = CsgMulberry32(CsgHash32FNV1a(key));
    for (let i = n - 1; i > 0; i--) {
        const j = Math.floor(rand() * (i + 1));
        const tmp = arr[i];
        arr[i] = arr[j];
        arr[j] = tmp;
    }
    return arr;
}
function Code2Html(code_str, lang='c++') {
    let lang_convert = lang.toLocaleLowerCase();
    // highlightjs 要引入特定js才能高亮特定语言，且语言名称固定
    if(lang_convert == 'python3') {
        lang_convert = 'python';
    } else if(lang_convert == 'c++') {
        lang_convert = 'cpp';
    }
    if(!['python', 'c', 'cpp', 'java', 'go'].includes(lang_convert)) {
        lang_convert = 'c';
    }
    return hljs.highlight(code_str, {language: lang_convert}).value;
}
function ProcessAnswerHtml(question) {
    // 预览权限控制：监考等“考试内权限”（非管理员/非教师）不展示参考答案/答案解析
    if (window.questionPreviewConfig && window.questionPreviewConfig.showAnswer === false) {
        return '';
    }
    let ret_html = '';
    if(question?.prule && question.prule.trim() != '') {
        ret_html += `<div class="answer-prule mb-2"><strong class='text-success'>评分标准：<span class="en-text">Scoring Standard</span></strong><div class='text-success'>${question.prule.trim()}</div></div>`;
    }
    let pkind = parseInt(question.pkind);
    // 编程题需要复制按钮，提前获取代码内容
    let codeContentForCopy = '';
    if (pkind === 25 && 'answer' in question) {
        let answer = question.answer;
        if (typeof(answer) == 'string') {
            try { answer = JSON.parse(answer); } catch(e) { answer = [answer]; }
        }
        if (!Array.isArray(answer)) {
            answer = [answer];
        }
        codeContentForCopy = DomSantize((answer[0] || '').trim());  // global.js 中的 DomSantize 函数
    }
    ret_html += `<div class="answer-content${pkind === 25 ? ' ex-scroll-section' : ''}"><strong class='text-success'>参考答案：${pkind === 25 ? `<a href="javascript:void(0)" class="ex-scroll-toggle" data-ex-target=".code-viewer-container, pre" title="展开 / Expand"><i class="bi bi-arrows-angle-expand"></i></a><a href="javascript:void(0)" class="answer-code-copy-btn ms-2" data-code-content="${codeContentForCopy}" title="复制代码 / Copy Code"><i class="bi bi-clipboard"></i></a>` : ''}<span class="en-text">Reference Answer</span></strong>`;
    if('answer' in question) {
        let answer = question.answer;
        if(typeof(answer) == 'string') {
            try { answer = JSON.parse(answer); } catch(e) { answer = [answer]; }
        }
        if(!Array.isArray(answer)) {
            answer = [answer];
        }
        if(pkind < 10) {
            // 单选/多选/判断 - 直接显示，用逗号分隔
            ret_html += `<span class='text-success answer-inline'>${answer.join(', ')}</span>`;
        } else if(pkind == 10) {
            // 填空题 - 统一序号风格为 (1)，与题干保持一致
            // 注意：不要使用 answer-list（它会启用 CSS 的 decimal marker，导致与“(1)”重复）
            ret_html += `<ul class="answer-fill-list text-success list-unstyled mb-0">`;
            for(let i = 0; i < answer.length; i ++) {
                ret_html += `<li class="answer-item answer-md-inline"><span class="fw-semibold me-2">(${i + 1})</span>${MarkdownParse(answer[i])}</li>`;
            }
            ret_html += `</ul>`;
        } else if(pkind == 15) {
            // 简答题 - 支持新格式：{answer: "...", answer_images: [...]}
            // 兼容旧格式：字符串
            let answerText = '';
            let answerImages = [];
            if (answer.length > 0) {
                const firstItem = answer[0];
                if (typeof firstItem === 'string') {
                    // 旧格式：字符串
                    answerText = firstItem;
                    answerImages = [];
                } else if (typeof firstItem === 'object' && firstItem !== null) {
                    // 新格式：对象
                    answerText = firstItem.answer || '';
                    answerImages = Array.isArray(firstItem.answer_images) ? firstItem.answer_images : [];
                } else {
                    answerText = String(firstItem || '');
                    answerImages = [];
                }
            }
            
            // 显示答案文本
            if(answer.length === 1) {
                // 只有一个答案时，不显示序号
                ret_html += `<div class='text-success answer-md-block answer-single'>${MarkdownParse(answerText, false)}</div>`;
            } else {
                // 多个答案时，显示序号
                ret_html += `<ol class="answer-list answer-short-list text-success">`;
                for(let i = 0; i < answer.length; i ++) {
                    const item = answer[i];
                    const text = (typeof item === 'object' && item !== null) ? (item.answer || '') : String(item || '');
                    ret_html += `<li class="answer-item answer-md-block">${MarkdownParse(text, false)}</li>`;
                }
                ret_html += `</ol>`;
            }
            
            // 显示答案图（从 answer 字段读取）
            if (answerImages.length > 0 && question.attach) {
                ret_html += `<div class="mt-3"><div class="fw-semibold mb-2 bilingual-inline">答案图<span class="en-text">Answer Images</span></div>`;
                answerImages.forEach((imgUrl, idx) => {
                    if (imgUrl && String(imgUrl).trim()) {
                        // 如果已经是完整路径（以 /upload/ 开头），直接使用；否则拼接路径
                        const imgSrc = String(imgUrl).startsWith('/upload/') 
                            ? imgUrl 
                            : (question.attach ? `/upload/question_attach/${question.attach}/answer_image/${imgUrl}` : '');
                        if (imgSrc) {
                            ret_html += `<div class="mb-2"><img class="img-thumbnail" style="max-width: 400px;" src="${imgSrc}" alt="答案图 ${idx + 1}"></div>`;
                        }
                    }
                });
                ret_html += `</div>`;
            }
        } else if(pkind == 20) {
            // 综合题 - 支持新格式：[{answer: "...", answer_images: [...]}, ...]
            // 兼容旧格式：字符串数组
            ret_html += `<ol class="answer-list answer-comprehensive-list text-success">`;
            for(let i = 0; i < answer.length; i ++) {
                const item = answer[i];
                let answerText = '';
                let answerImages = [];
                if (typeof item === 'string') {
                    // 旧格式：字符串
                    answerText = item;
                    answerImages = [];
                } else if (typeof item === 'object' && item !== null) {
                    // 新格式：对象
                    answerText = item.answer || '';
                    answerImages = Array.isArray(item.answer_images) ? item.answer_images : [];
                } else {
                    answerText = String(item || '');
                    answerImages = [];
                }
                
                ret_html += `<li class="answer-item answer-md-block">${MarkdownParse(answerText, false)}`;
                
                // 显示该小题的答案图
                if (answerImages.length > 0 && question.attach) {
                    ret_html += `<div class="mt-2"><div class="small text-muted mb-1">答案图<span class="en-text">Answer Images</span></div>`;
                    answerImages.forEach((imgUrl, imgIdx) => {
                        if (imgUrl && String(imgUrl).trim()) {
                            // 如果已经是完整路径（以 /upload/ 开头），直接使用；否则拼接路径
                            const imgSrc = String(imgUrl).startsWith('/upload/') 
                                ? imgUrl 
                                : (question.attach ? `/upload/question_attach/${question.attach}/answer_image/${imgUrl}` : '');
                            if (imgSrc) {
                                ret_html += `<div class="mb-1"><img class="img-thumbnail" style="max-width: 350px;" src="${imgSrc}" alt="答案图 ${imgIdx + 1}"></div>`;
                            }
                        }
                    });
                    ret_html += `</div>`;
                }
                
                ret_html += `</li>`;
            }
            ret_html += `</ol>`;
        } else if(pkind == 25) {
            // 编程题 - 使用代码高亮渲染
            const codeContent = answer[0] || '';
            if(codeContent.trim() === '') {
                ret_html += `
                    <div class="code-viewer-container code-render-empty">
                        <div class="code-empty-placeholder">
                            <i class="bi bi-code-slash text-muted"></i>
                            <span class="text-muted ms-2">无参考代码 / No Reference Code</span>
                        </div>
                    </div>`;
            } else {
                // 所有依赖已全局引入，直接使用 renderCode
                // 参考代码语言：优先使用题目携带的语言字段（若无则交给 renderCode 自动处理）
                const answerLang = question.lang || question.language || question.code_lang || null;
                if (typeof renderCode !== 'undefined' && renderCode) {
                    const codeContainer = renderCode(codeContent, {
                        enableHighlight: true,
                        enableLineNumber: true,
                        language: answerLang,
                        cssClass: 'code-viewer-answer'
                    });
                    ret_html += `<div class="answer-code-container">${codeContainer[0].outerHTML}</div>`;
                } else {
                    ret_html += `<pre class="bg-light p-3 border rounded answer-code-fallback"><code>${codeContent}</code></pre>`;
                }
            }
        }
    }
    ret_html += `</div>`;
    // 答案解析 - 预览模式（即使为空也显示）
    const ex_question_id = question.ex_question_id || '';
    let explainStr = '';
    let scoreAdviceStr = '';
    
    if ('answer_explain' in question) {
        let explain = question.answer_explain;
        // 解析 JSON（如果后端返回的是字符串）
        if (typeof explain === 'string') {
            try { explain = JSON.parse(explain); } catch (e) {}
        }
        
        // 新格式：结构化 JSON 对象 { "explain": "...", "score_advice": "..." }
        if (typeof explain === 'object' && explain !== null && !Array.isArray(explain)) {
            explainStr = String(explain.explain || '').trim();
            scoreAdviceStr = String(explain.score_advice || '').trim();
        } else if (typeof explain === 'string') {
            // 兼容旧格式：字符串（可能是分隔符格式）
            const re = /(?:^|\n)\s*---\s*\n\s*\n\s*#{2,4}\s*评分建议\s*\n/;
            const m = explain.match(re);
            if (m && m.index !== undefined) {
                const idx = m.index;
                const matchLen = m[0].length;
                explainStr = explain.slice(0, idx).trim();
                scoreAdviceStr = explain.slice(idx + matchLen).trim();
            } else {
                explainStr = explain.trim();
                scoreAdviceStr = '';
            }
        } else if (Array.isArray(explain)) {
            // 兼容旧格式：数组
            explainStr = explain.join('\n').trim();
            scoreAdviceStr = '';
        }
    }
    
    // 答案解析和评分建议作为两个独立的标题显示
    const explainEmpty = !explainStr || explainStr.trim() === '';
    const scoreAdviceEmpty = !scoreAdviceStr || scoreAdviceStr.trim() === '';
    
    // HTML 转义（用于 data 属性）
    const escapedExplain = DomSantize(explainStr || '');
    const escapedScoreAdvice = DomSantize(scoreAdviceStr || '');
    
    // 预览区域：如果内容被截断，显示纯文本；如果完整显示，则渲染Markdown
    // 这样可以避免截断导致的Markdown语法不完整问题（如数学公式缺少结束符）
    const explainIsTruncated = explainStr && explainStr.length > 150;
    const explainPreviewText = explainStr ? (explainIsTruncated ? explainStr.substring(0, 150) + '...' : explainStr) : '';
    const explainPreviewHtml = explainEmpty 
        ? '<span class="text-muted">暂无答案解析 / No explanation available</span>' 
        : (explainIsTruncated 
            ? `<span class="text-muted" style="white-space: pre-wrap;">${DomSantize(explainPreviewText)}</span>` 
            : MarkdownParse(String(explainPreviewText), false));
    
    const scoreAdviceIsTruncated = scoreAdviceStr && scoreAdviceStr.length > 150;
    const scoreAdvicePreviewText = scoreAdviceStr ? (scoreAdviceIsTruncated ? scoreAdviceStr.substring(0, 150) + '...' : scoreAdviceStr) : '';
    const scoreAdvicePreviewHtml = scoreAdviceEmpty 
        ? '<span class="text-muted">暂无评分建议 / No scoring advice available</span>' 
        : (scoreAdviceIsTruncated 
            ? `<span class="text-muted" style="white-space: pre-wrap;">${DomSantize(scoreAdvicePreviewText)}</span>` 
            : MarkdownParse(String(scoreAdvicePreviewText), false));
    
    // 答案解析区域
    ret_html += `
        <div class='mt-2 answer-explain-section' data-qid="${ex_question_id}">
            <strong class='text-primary'>答案解析：<span class="en-text">Answer Explanation</span></strong>
            <div class='answer-explain-preview' 
                 style='max-height: 120px; overflow: hidden; position: relative; margin-top: 8px; padding: 8px; background: #f8f9fa; border-radius: 4px; border: 1px solid #dee2e6;'>
                <div class='answer-explain-preview-content' data-full-text="${escapedExplain}" data-is-truncated="${explainIsTruncated ? '1' : '0'}">
                    ${explainPreviewHtml}
                </div>
                ${!explainEmpty ? '<a href="javascript:void(0)" class="answer-explain-expand-link" data-qid="' + ex_question_id + '" data-type="explain" style="position: absolute; top: 8px; right: 8px; color: #6c757d; font-size: 1.2em; text-decoration: none; cursor: pointer; z-index: 10;" title="展开完整解析 / Expand full explanation"><i class="bi bi-arrows-expand"></i></a>' : ''}
            </div>
        </div>
    `;
    
    // 评分建议区域（仅简答题和综合题显示）
    if (pkind === 15 || pkind === 20) {
        ret_html += `
            <div class='mt-2 score-advice-section' data-qid="${ex_question_id}">
                <strong class='text-primary'>评分建议：<span class="en-text">Scoring Advice</span></strong>
                <div class='score-advice-preview' 
                     style='max-height: 120px; overflow: hidden; position: relative; margin-top: 8px; padding: 8px; background: #f8f9fa; border-radius: 4px; border: 1px solid #dee2e6;'>
                    <div class='score-advice-preview-content' data-full-text="${escapedScoreAdvice}" data-is-truncated="${scoreAdviceIsTruncated ? '1' : '0'}">
                        ${scoreAdvicePreviewHtml}
                    </div>
                    ${!scoreAdviceEmpty ? '<a href="javascript:void(0)" class="score-advice-expand-link" data-qid="' + ex_question_id + '" data-type="score_advice" style="position: absolute; top: 8px; right: 8px; color: #6c757d; font-size: 1.2em; text-decoration: none; cursor: pointer; z-index: 10;" title="展开完整评分建议 / Expand full scoring advice"><i class="bi bi-arrows-expand"></i></a>' : ''}
                </div>
            </div>
        `;
    }
    return ret_html;
}

// 仅渲染“评分标准/答案解析/评分建议”（不含参考答案正文）
// 注意：题目“元信息”（评分标准/评分建议/答案解析）已拆分为左右两块：
// - 左栏：ProcessMetaLeftHtml（评分标准 + 评分建议）
// - 右栏：ProcessMetaRightHtml（答案解析）

function ParseAnswerExplainParts(question) {
    const ex_question_id = question?.ex_question_id || '';
    let explainStr = '';
    let scoreAdviceStr = '';
    if ('answer_explain' in (question || {})) {
        let explain = question.answer_explain;
        if (typeof explain === 'string') {
            try { explain = JSON.parse(explain); } catch (e) {}
        }
        // 新格式：结构化 JSON 对象 { "explain": "...", "score_advice": "..." }
        if (typeof explain === 'object' && explain !== null && !Array.isArray(explain)) {
            explainStr = String(explain.explain || '').trim();
            scoreAdviceStr = String(explain.score_advice || '').trim();
        } else if (typeof explain === 'string') {
            // 兼容旧格式：字符串（可能是分隔符格式）
            const re = /(?:^|\n)\s*---\s*\n\s*\n\s*#{2,4}\s*评分建议\s*\n/;
            const m = explain.match(re);
            if (m && m.index !== undefined) {
                const idx = m.index;
                const matchLen = m[0].length;
                explainStr = explain.slice(0, idx).trim();
                scoreAdviceStr = explain.slice(idx + matchLen).trim();
            } else {
                explainStr = explain.trim();
                scoreAdviceStr = '';
            }
        } else if (Array.isArray(explain)) {
            explainStr = explain.join('\n').trim();
            scoreAdviceStr = '';
        }
    }
    return { ex_question_id, explainStr, scoreAdviceStr };
}

function BuildMetaPreviewBlock({ qid, titleCn, titleEn, noteCn = '', noteEn = '', fullText = '', type = 'explain' }) {
    const text = String(fullText || '').trim();
    if (!text) return '';
    const isTruncated = text.length > 150;
    const previewText = isTruncated ? (text.substring(0, 150) + '...') : text;
    const escapedFull = DomSantize(text);
    const previewHtml = isTruncated
        ? `<span class="text-muted" style="white-space: pre-wrap;">${DomSantize(previewText)}</span>`
        : MarkdownParse(String(previewText), false);

    const isExplain = (type === 'explain');
    const sectionCls = isExplain ? 'answer-explain-section' : 'score-advice-section';
    const contentCls = isExplain ? 'answer-explain-preview-content' : 'score-advice-preview-content';
    const linkCls = isExplain ? 'answer-explain-expand-link' : 'score-advice-expand-link';
    const linkTitle = isExplain ? '展开完整解析 / Expand full explanation' : '展开完整评分建议 / Expand full scoring advice';

    const noteHtml = (noteCn || noteEn)
        ? `<div class="review-meta-note text-muted small text-end">
                ${noteCn ? `<div>${noteCn}</div>` : ''}
                ${noteEn ? `<div class="en-text">${noteEn}</div>` : ''}
           </div>`
        : '';

    return `
        <div class="review-meta-item ${sectionCls}" data-qid="${qid}">
            <div class="review-meta-header d-flex align-items-start justify-content-between gap-2">
                <div class="fw-semibold bilingual-inline">${titleCn}<span class="en-text">${titleEn}</span></div>
                ${noteHtml}
            </div>
            <div class="answer-explain-preview"
                 style="max-height: 120px; overflow: hidden; position: relative; margin-top: 8px; padding: 8px; background: #f8f9fa; border-radius: 4px; border: 1px solid #dee2e6;">
                <div class="${contentCls}" data-full-text="${escapedFull}" data-is-truncated="${isTruncated ? '1' : '0'}">
                    ${previewHtml}
                </div>
                <a href="javascript:void(0)" class="${linkCls}" data-qid="${qid}" data-type="${type}"
                   style="position: absolute; top: 8px; right: 8px; color: #6c757d; font-size: 1.2em; text-decoration: none; cursor: pointer; z-index: 10;"
                   title="${linkTitle}"><i class="bi bi-arrows-expand"></i></a>
            </div>
        </div>
    `;
}

function ProcessMetaLeftHtml(question) {
    if (window.questionPreviewConfig && window.questionPreviewConfig.showAnswer === false) {
        return '';
    }
    const qid = question?.ex_question_id || '';
    if (!qid) return '';
    const hasPrule = !!(question?.prule && String(question.prule).trim() !== '');
    const { scoreAdviceStr } = ParseAnswerExplainParts(question);
    const hasAdvice = !!(scoreAdviceStr && scoreAdviceStr.trim());
    if (!hasPrule && !hasAdvice) return '';

    let body = '';
    if (hasPrule) {
        body += `<div class="review-meta-item mb-2">
            <div class="review-meta-header d-flex align-items-start justify-content-between gap-2">
                <div class="fw-semibold bilingual-inline">评分标准<span class="en-text">Scoring standard</span></div>
                <div class="review-meta-note text-muted small text-end">
                    <div>考试配置 · 导出试卷包含</div>
                    <div class="en-text">Exam config · included in export</div>
                </div>
            </div>
            <div class="text-success mt-1">${String(question.prule).trim()}</div>
        </div>`;
    }
    if (hasAdvice) {
        body += BuildMetaPreviewBlock({
            qid,
            titleCn: '评分建议',
            titleEn: 'Scoring advice',
            noteCn: '题库内容 · 导出试卷不含',
            noteEn: 'Question bank · not included in export',
            fullText: scoreAdviceStr,
            type: 'score_advice',
        });
    }
    return `<div class="review-meta-box border rounded p-2 bg-light">${body}</div>`;
}

function ProcessMetaRightHtml(question) {
    if (window.questionPreviewConfig && window.questionPreviewConfig.showAnswer === false) {
        return '';
    }
    const qid = question?.ex_question_id || '';
    if (!qid) return '';
    const { explainStr } = ParseAnswerExplainParts(question);
    if (!explainStr || !explainStr.trim()) return '';
    const body = BuildMetaPreviewBlock({
        qid,
        titleCn: '答案解析',
        titleEn: 'Explanation',
        fullText: explainStr,
        type: 'explain',
    });
    return `<div class="review-meta-box border rounded p-2 bg-light">${body}</div>`;
}

// 仅渲染“参考答案正文”，用于左右对照区（可按 subq 拆分）
function ProcessRefAnswerHtml(question, subq = null) {
    if (window.questionPreviewConfig && window.questionPreviewConfig.showAnswer === false) {
        return '';
    }
    const pkind = parseInt(question?.pkind);
    if (!('answer' in (question || {}))) {
        return `<div class="text-muted small">暂无参考答案 / No reference answer</div>`;
    }

    let answer = question.answer;
    if (typeof answer === 'string') {
        try { answer = JSON.parse(answer); } catch (e) { answer = [answer]; }
    }
    if (!Array.isArray(answer)) answer = [answer];

    // 客观题：显示“页面展示序号”的正确答案（避免与随机选项顺序不一致）
    if (pkind < 10) {
        // 目标：紧凑、避免重复（不再输出 ul/li，也不把字母再写一遍）
        const joined = answer.map(a => String(a).trim()).filter(Boolean).join(', ');
        try {
            const content = JSON.parse(question.content || '[]');
            if (Array.isArray(content) && content.length >= 2) {
                const ansUpper = answer.map(a => String(a).trim().toUpperCase()).filter(Boolean);
                const isTF = (content.length === 2) && ansUpper.length > 0 && ansUpper.every(v => v === 'T' || v === 'F');
                if (isTF) {
                    // 判断题：只显示 T/F（不再重复附带文本）
                    const val = ansUpper.join(', ') || '-';
                    return `<span class="badge bg-success">${val}</span>`;
                }

                const n = content.length;
                const perm = CsgChoicePermutation(question.ex_question_id, n);
                const ansSet = new Set(ansUpper);
                const disp = [];
                const Acode = 'A'.charCodeAt(0);
                for (let displayIdx = 0; displayIdx < n; displayIdx++) {
                    const origIdx = perm[displayIdx];
                    const origLetter = String.fromCharCode(Acode + origIdx);
                    if (ansSet.has(origLetter)) {
                        const displayLetter = String.fromCharCode(Acode + displayIdx);
                        disp.push(displayLetter);
                    }
                }
                const dispStr = disp.length ? disp.join(', ') : joined;
                // 单/多选：只显示“正确答案：A,B”（不再重复列出选项文本）
                const val = dispStr || '-';
                return `<span class="badge bg-success">${val}</span>`;
            }
        } catch (e) {}
        const val = joined || '-';
        return `<span class="badge bg-success">${val}</span>`;
    }

    if (pkind === 10) {
        const idx = (subq === null || typeof subq === 'undefined') ? null : parseInt(subq, 10);
        if (idx === null || Number.isNaN(idx)) {
            return `<div class="text-success">${answer.map(a => MarkdownParse(String(a || ''), false)).join('<br/>')}</div>`;
        }
        return `<div class="text-success">${MarkdownParse(String(answer[idx] || ''), false)}</div>`;
    }

    if (pkind === 15) {
        // 简答题参考答案可能包含答案图
        const firstItem = answer[0];
        let answerText = '';
        let answerImages = [];
        if (typeof firstItem === 'string') {
            answerText = firstItem;
        } else if (typeof firstItem === 'object' && firstItem !== null) {
            answerText = firstItem.answer || '';
            answerImages = Array.isArray(firstItem.answer_images) ? firstItem.answer_images : [];
        } else {
            answerText = String(firstItem || '');
        }
        let html = `<div class="text-success">${MarkdownParse(answerText, false)}</div>`;
        if (answerImages.length > 0 && question.attach) {
            html += `<div class="mt-2"><div class="small text-muted mb-1">答案图<span class="en-text">Answer Images</span></div>`;
            answerImages.forEach((imgUrl, imgIdx) => {
                if (imgUrl && String(imgUrl).trim()) {
                    const imgSrc = String(imgUrl).startsWith('/upload/')
                        ? imgUrl
                        : (question.attach ? `/upload/question_attach/${question.attach}/answer_image/${imgUrl}` : '');
                    if (imgSrc) {
                        html += `<div class="mb-1"><img class="img-thumbnail" style="max-width: 350px;" src="${imgSrc}" alt="答案图 ${imgIdx + 1}"></div>`;
                    }
                }
            });
            html += `</div>`;
        }
        return html;
    }

    if (pkind === 20) {
        const idx = (subq === null || typeof subq === 'undefined') ? null : parseInt(subq, 10);
        if (idx === null || Number.isNaN(idx) || idx < 0 || idx >= answer.length) {
            return `<div class="text-muted small">参考答案未拆分 / Reference not split</div>`;
        }
        const item = answer[idx];
        let answerText = '';
        let answerImages = [];
        if (typeof item === 'string') {
            answerText = item;
        } else if (typeof item === 'object' && item !== null) {
            answerText = item.answer || '';
            answerImages = Array.isArray(item.answer_images) ? item.answer_images : [];
        } else {
            answerText = String(item || '');
        }
        let html = `<div class="text-success">${MarkdownParse(answerText, false)}</div>`;
        if (answerImages.length > 0 && question.attach) {
            html += `<div class="mt-2"><div class="small text-muted mb-1">答案图<span class="en-text">Answer Images</span></div>`;
            answerImages.forEach((imgUrl, imgIdx) => {
                if (imgUrl && String(imgUrl).trim()) {
                    const imgSrc = String(imgUrl).startsWith('/upload/')
                        ? imgUrl
                        : (question.attach ? `/upload/question_attach/${question.attach}/answer_image/${imgUrl}` : '');
                    if (imgSrc) {
                        html += `<div class="mb-1"><img class="img-thumbnail" style="max-width: 350px;" src="${imgSrc}" alt="答案图 ${imgIdx + 1}"></div>`;
                    }
                }
            });
            html += `</div>`;
        }
        return html;
    }

    if (pkind === 25) {
        const codeContent = String(answer[0] || '');
        const codeContentForCopy = DomSantize(codeContent.trim());
        const answerLang = question.lang || question.language || question.code_lang || null;
        if (!codeContent.trim()) {
            return `<div class="text-muted small">无参考代码 / No Reference Code</div>`;
        }
        if (typeof renderCode !== 'undefined' && renderCode) {
            const codeContainer = renderCode(codeContent, {
                enableHighlight: true,
                enableLineNumber: true,
                language: answerLang,
                cssClass: 'code-viewer-answer'
            });
            return `<div class="ex-scroll-section">
                <div class="d-flex align-items-center gap-2 mb-2">
                    <a href="javascript:void(0)" class="ex-scroll-toggle" data-ex-target=".code-viewer-container, pre" title="展开 / Expand"><i class="bi bi-arrows-angle-expand"></i></a>
                    <a href="javascript:void(0)" class="answer-code-copy-btn" data-code-content="${codeContentForCopy}" title="复制代码 / Copy Code"><i class="bi bi-clipboard"></i></a>
                    <span class="text-muted small">参考代码</span>
                </div>
                ${codeContainer[0].outerHTML}
            </div>`;
        }
        return `<pre class="bg-light p-3 border rounded answer-code-fallback"><code>${codeContent}</code></pre>`;
    }

    // 其他题型：直接拼起来
    return `<div class="text-success">${answer.map(a => MarkdownParse(String(a || ''), false)).join('<br/>')}</div>`;
}
// 防重复加载：如果已定义则跳过
if (typeof QuestionRender === 'undefined') {
const need_markdown_set = new Set([10, 15, 20, '10', '15', '20'])
// 预览页面也会使用 show=true 展示参考答案/解析，但不应显示“考生答卷”和打分控件。
// 这里用阅卷页面特有的 DOM 标识来区分。
function CsgIsReviewUIPage() {
    try {
        return !!document.getElementById('review_question_panel');
    } catch (e) {
        return false;
    }
}
let QuestionRender = {
    // **************************************************
    // 生成题目界面
    html: {
        Get: function(question, pnum, show=false, oj_pro=null) {
            let pkind_str = question_default.pkind_table[question.pkind];
            return this[pkind_str](question, pnum, show, oj_pro, allow_lang);
        },
        GetHeader: function(question, pnum=null, show=false) {
            // 添加data-modified属性用于CSS动画效果 - 2025年新增
            let rethtml = `<div class='question_div' ex_question_id='${question.ex_question_id}' id='question_div_${question.ex_question_id}' pkind=${question.pkind} data-modified="${question.modified || false}">`;
            let pnum_str = pnum === null ? '' : pnum + '. '
            rethtml += `<span>${pnum_str}${MarkdownParse(question.description, false)}</span>`;
            if(!show) {
                let markdown_editor = need_markdown_set.has(question.pkind) ? markdown_editor_button : "";
                rethtml += `<div class="question_submit_container">
                    <button class="btn btn-primary question_submit" type="button" qid="${question.ex_question_id}">
                        <i class="bi bi-save"></i><span class="cn-text">保存答案</span><span class="en-text">Save Answer</span>
                    </button>
                    ${markdown_editor}
                </div>`
            }
            return rethtml;
        },
        // 生成阅卷模式下的学生答卷标题栏HTML
        GetReviewAnswerHeader: function() {
            return `<div class="md-answer-header-review">
                <h5 class="mb-2 d-flex align-items-center">
                    <i class="bi bi-person-fill text-primary me-2"></i>
                    <span class="bilingual-inline">考生答卷<span class="en-text">Student Answer</span></span>
                </h5>
            </div>`;
        },
        GetReviewRefHeader: function() {
            return `<div class="md-answer-header-review">
                <h5 class="mb-2 d-flex align-items-center">
                    <i class="bi bi-journal-check text-success me-2"></i>
                    <span class="bilingual-inline">参考答案<span class="en-text">Reference</span></span>
                </h5>
            </div>`;
        },
        // 生成答题按钮HTML
        GetAnswerButton: function(ex_question_id, subq) {
            return `<div class="md-answer-header">
                <button type="button" class="btn btn-outline-primary btn-sm btn-edit-md bilingual-inline" data-qid="${ex_question_id}" data-subq="${subq}"><i class="bi bi-pencil-square"></i> 答题<span class="en-text">Start Answering</span></button>
            </div>`;
        },
        GetFooter: function(question) {
            // 考试模式：不渲染 ans_review_div（考试时不应显示参考答案和阅卷区域）
            // 检查是否是考试模式：
            // 1. questionPreviewConfig.showAnswer === false（预览模式不显示答案）
            // 2. examsys 考试答题页（由 view 下发 examProblemsetConfig.page 标识 + hide_answer_review=1）
            const isProblemsetHideAnswer = !!(window.examProblemsetConfig
                && window.examProblemsetConfig.page === 'examsys_problemset'
                && String(window.examProblemsetConfig.hide_answer_review || '0') === '1');
            const isExamMode = (window.questionPreviewConfig && window.questionPreviewConfig.showAnswer === false) ||
                               isProblemsetHideAnswer;
            
            // 考试模式：不渲染整个 ans_review_div
            if (isExamMode) {
                return '';
            }
            
            // 非考试模式：仅保留阅卷区域容器（评语/打分）
            // 参考答案渲染到题目内部的对照区（.ref-answer-slot），题目元信息渲染到左右元信息区（answer_meta_left/right_div）。
            return `<div class="ans_review_div">
                <div class='review_div' id='review_div_${question.ex_question_id}'></div>
            </div>
            </div>`;
        },
        SingleChoice: function(question, pnum=null, show=false) {
            let rethtml = this.GetHeader(question, pnum, show);
            if (show) {
                rethtml += `<div class="review-compare-row mt-3"><div class="review-compare-left">
                    <div class="answer_meta_left_div" id="answer_meta_left_div_${question.ex_question_id}"></div>`;
            }
            rethtml += '<ul class="list-group">';
            let content = JSON.parse(question.content);
            MarkdownConvertArray(content);
            let ans = question.answer;
            if (typeof ans === 'string') {
                try { ans = JSON.parse(ans); } catch (e) { ans = []; }
            }
            ans = Array.isArray(ans) ? ans.map(a => String(a).trim().toUpperCase()) : [];
            let Acode = "A".charCodeAt(0);
            const n = content.length;
            const perm = CsgChoicePermutation(question.ex_question_id, n);
            for(let displayIdx = 0; displayIdx < n; displayIdx ++) {
                const origIdx = perm[displayIdx];
                const displayLetter = String.fromCharCode(Acode + displayIdx);
                const origLetter = String.fromCharCode(Acode + origIdx);
                const checked = ans.includes(origLetter) ? 'checked' : '';
                const disabled = show ? 'disabled' : '';
                // #############################################
                // 选择题选项布局优化 - 2025年新增
                // 使用choice-line容器让序号和内容在同一行显示
                // #############################################
                rethtml += `<li class="list-group-item radiocheck_container">
                <div class="d-flex align-items-start">
                    <input class="form-check-input me-3 mt-1 flex-shrink-0 SingleChoice submission_${question.ex_question_id} question_input question_input_check" type="radio" name="submission_${question.ex_question_id}" value=${origIdx} sub_qnum="${displayIdx}" qid="${question.ex_question_id}" id="ex_question_${question.ex_question_id}_${displayIdx}" ${checked} ${disabled}>
                    <label class="form-check-label flex-grow-1" for="ex_question_${question.ex_question_id}_${displayIdx}">
                        <div class="choice-line">
                            <span class="choice-label fw-bold me-2">${displayLetter}.</span>
                            <span class="choice-content">${content[origIdx]}</span>
                        </div>
                    </label>
                </div>
                </li>`;
            }
            rethtml += '</ul>';
            if (show) {
                rethtml += `</div><div class="review-compare-right">
                    <div class="md-answer-container md-ref-answer-container">`;
                rethtml += this.GetReviewRefHeader();
                rethtml += `<div class="ref-answer-slot" data-qid="${question.ex_question_id}" data-subq="0"></div>
                    </div>
                    <div class="answer_meta_right_div mt-3" id="answer_meta_right_div_${question.ex_question_id}"></div>
                </div></div>`;
            }
            rethtml += this.GetFooter(question);
            return rethtml;
        },
        MultiChoice: function(question, pnum=null, show=false) {
            let rethtml = this.GetHeader(question, pnum, show);
            if (show) {
                rethtml += `<div class="review-compare-row mt-3"><div class="review-compare-left">
                    <div class="answer_meta_left_div" id="answer_meta_left_div_${question.ex_question_id}"></div>`;
            }
            rethtml += '<ul class="list-group">';
            let content = JSON.parse(question.content);
            MarkdownConvertArray(content);
            let ans = question.answer;
            if (typeof ans === 'string') {
                try { ans = JSON.parse(ans); } catch (e) { ans = []; }
            }
            ans = Array.isArray(ans) ? ans.map(a => String(a).trim().toUpperCase()) : [];
            let Acode = "A".charCodeAt(0);
            const n = content.length;
            const perm = CsgChoicePermutation(question.ex_question_id, n);
            for(let displayIdx = 0; displayIdx < n; displayIdx ++) {
                const origIdx = perm[displayIdx];
                const displayLetter = String.fromCharCode(Acode + displayIdx);
                const origLetter = String.fromCharCode(Acode + origIdx);
                const checked = ans.includes(origLetter) ? 'checked' : '';
                const disabled = show ? 'disabled' : '';
                // #############################################
                // 多选题选项布局优化 - 2025年新增
                // 使用choice-line容器让序号和内容在同一行显示
                // #############################################
                rethtml += `<li class="list-group-item radiocheck_container">
                <div class="d-flex align-items-start">
                    <input class="form-check-input me-3 mt-1 flex-shrink-0 MultiChoice submission_${question.ex_question_id} question_input question_input_check" type="checkbox" name="submission_${question.ex_question_id}" value=${origIdx} sub_qnum="` + displayIdx + `" qid="${question.ex_question_id}" id="ex_question_${question.ex_question_id}_${displayIdx}" ${checked} ${disabled}>
                    <label class="form-check-label flex-grow-1" for="ex_question_${question.ex_question_id}_${displayIdx}">
                        <div class="choice-line">
                            <span class="choice-label fw-bold me-2">${displayLetter}.</span>
                            <span class="choice-content">${content[origIdx]}</span>
                        </div>
                    </label>
                </div>
            </li>`
            }
            rethtml += '</ul>'
            if (show) {
                rethtml += `</div><div class="review-compare-right">
                    <div class="md-answer-container md-ref-answer-container">`;
                rethtml += this.GetReviewRefHeader();
                rethtml += `<div class="ref-answer-slot" data-qid="${question.ex_question_id}" data-subq="0"></div>
                    </div>
                    <div class="answer_meta_right_div mt-3" id="answer_meta_right_div_${question.ex_question_id}"></div>
                </div></div>`;
            }
            rethtml += this.GetFooter(question);
            return rethtml;
        },
        TrueFalse: function(question, pnum=null, show=false) {
            let rethtml = this.GetHeader(question, pnum, show);
            if (show) {
                rethtml += `<div class="review-compare-row mt-3"><div class="review-compare-left">
                    <div class="answer_meta_left_div" id="answer_meta_left_div_${question.ex_question_id}"></div>`;
            }
            rethtml += '<ul class="list-group">';
            let content = JSON.parse(question.content);
            MarkdownConvertArray(content);
            let ans = question.answer;
            if (typeof ans === 'string') {
                try { ans = JSON.parse(ans); } catch (e) { ans = []; }
            }
            ans = Array.isArray(ans) ? ans.map(a => String(a).trim().toUpperCase()) : [];
            let TF = ["T", "F"]
            for(let i = 0; i < 2; i ++) {
                let choice_val = TF[i];
                const checked = ans.includes(choice_val) ? 'checked' : '';
                const disabled = show ? 'disabled' : '';
                // #############################################
                // 判断题选项布局优化 - 2025年新增
                // 使用choice-line容器让序号和内容在同一行显示
                // #############################################
                rethtml += `<li class="list-group-item radiocheck_container">
                <div class="d-flex align-items-start">
                    <input class="form-check-input me-3 mt-1 flex-shrink-0 TrueFalse submission_${question.ex_question_id} question_input question_input_check" type="radio" name="submission_${question.ex_question_id}" value="${TF[i][0]}" sub_qnum="${i}" qid="${question.ex_question_id}" id="ex_question_${question.ex_question_id}_${i}" ${checked} ${disabled}>
                    <label class="form-check-label flex-grow-1" for="ex_question_${question.ex_question_id}_${i}">
                        <div class="choice-line">
                            <span class="choice-label fw-bold me-2">${choice_val}</span>
                            <span class="choice-content">${content[i] || ''}</span>
                        </div>
                    </label>
                </div>
                </li>`
            }
            rethtml += '</ul>'
            if (show) {
                rethtml += `</div><div class="review-compare-right">
                    <div class="md-answer-container md-ref-answer-container">`;
                rethtml += this.GetReviewRefHeader();
                rethtml += `<div class="ref-answer-slot" data-qid="${question.ex_question_id}" data-subq="0"></div>
                    </div>
                    <div class="answer_meta_right_div mt-3" id="answer_meta_right_div_${question.ex_question_id}"></div>
                </div></div>`;
            }
            rethtml += this.GetFooter(question);
            return rethtml;
        },
        Fill: function(question, pnum=null, show=false) {
            let rethtml = this.GetHeader(question, pnum, show);
            const isReviewUI = CsgIsReviewUIPage();
            if (show) {
                rethtml += `<div class="review-compare-row mt-3 review-meta-row">
                    <div class="review-compare-left">
                        <div class="answer_meta_left_div" id="answer_meta_left_div_${question.ex_question_id}"></div>
                    </div>
                    <div class="review-compare-right"><!-- 答案解析移至参考答案下方，见循环后 --></div>
                </div>`;
            }
            rethtml += '<br/><br/><ul class="list-group">';
            let content = JSON.parse(question.content);
            MarkdownConvertArray(content);
            for(let i = 0; i < content.length; i ++) {
                // 填空题：序号与描述保持同一行（Markdown 渲染可能产生块级 div，需要包进 inline 容器）
                rethtml += `<li class="list-group-item">
                <label class="form-label mb-1" for="ex_question_${question.ex_question_id}_${i}">
                    <span class="fill-line">
                        <span class="fill-label fw-bold">(${i + 1})</span>
                        <span class="fill-desc">${content[i] || ''}</span>
                    </span>
                </label>`
                rethtml += `<input type="hidden" maxlength="512" class="form-control Fill submission_${question.ex_question_id} question_input md-hidden-input question_input_typein" name="submission_${question.ex_question_id}" sub_qnum="${i}" qid="${question.ex_question_id}" id="ex_question_${question.ex_question_id}_${i}" data-qid="${question.ex_question_id}" data-subq="${i}" >`;

                if (show && isReviewUI) {
                    // 阅卷：考生答卷 vs 参考答案（左右对照）；最后一空下方显示答案解析
                    const isLastFill = (i === content.length - 1);
                    rethtml += `<div class="review-compare-row mt-3">
                        <div class="review-compare-left">
                            <div class="md-answer-container">`;
                    rethtml += this.GetReviewAnswerHeader();
                    rethtml += `<div class="md-answer-preview" data-qid="${question.ex_question_id}" data-subq="${i}" data-initial-md=""></div>`;
                    rethtml += `</div>
                        </div>
                        <div class="review-compare-right">
                            <div class="md-answer-container md-ref-answer-container">`;
                    rethtml += this.GetReviewRefHeader();
                    rethtml += `<div class="ref-answer-slot" data-qid="${question.ex_question_id}" data-subq="${i}"></div>
                            </div>`;
                    if (isLastFill) {
                        rethtml += `<div class="answer_meta_right_div mt-3" id="answer_meta_right_div_${question.ex_question_id}"></div>`;
                    }
                    rethtml += `</div>
                    </div>`;
                } else if (show) {
                    // 预览：只显示参考答案（绿色边框），不显示“考生答卷”
                    rethtml += `<div class="md-answer-container md-ref-answer-container mt-3">`;
                    rethtml += this.GetReviewRefHeader();
                    rethtml += `<div class="ref-answer-slot" data-qid="${question.ex_question_id}" data-subq="${i}"></div>`;
                    rethtml += `</div>`;
                } else {
                    // 答题区域：按钮和预览区合并边框
                    rethtml += `<div class="md-answer-container mt-3">`;
                    rethtml += this.GetAnswerButton(question.ex_question_id, i);
                    rethtml += `<div class="md-answer-preview" data-qid="${question.ex_question_id}" data-subq="${i}" data-initial-md=""></div>`;
                    rethtml += `</div>`;
                }
                rethtml += `</li>`;
            }
            rethtml += '</ul>';
            rethtml += this.GetFooter(question);
            return rethtml;
        },
        ShortAnswer: function(question, pnum=null, show=false) {
            let rethtml = this.GetHeader(question, pnum, show);
            rethtml += `<br/><input type="hidden" maxlength="16384" class="form-control ShortAnswer submission_${question.ex_question_id} question_input md-hidden-input question_input_typein" name="submission_${question.ex_question_id}" sub_qnum="0" qid="${question.ex_question_id}" id="ex_question_${question.ex_question_id}" data-qid="${question.ex_question_id}" data-subq="0">`;
            const isReviewUI = CsgIsReviewUIPage();

            // 图片上传要求（简答题视为仅 1 小题）
            let reqs = [];
            try {
                const c = JSON.parse(question.content || '[]');
                if (Array.isArray(c) && c[0] && Array.isArray(c[0].image_reqs)) reqs = c[0].image_reqs;
            } catch(e) { reqs = []; }
            const reqsDescHtml = (() => {
                if (!reqs.length) return '';
                let h = `<div class="mt-2 exam-image-reqs exam-image-reqs-desc" data-qid="${question.ex_question_id}" data-subq="0">`;
                h += `<div class="fw-semibold mb-2 bilingual-inline">图片上传要求<span class="en-text">Image Upload</span></div>`;
                for (let r = 0; r < reqs.length; r++) {
                    const title = (reqs[r] && reqs[r].title) ? reqs[r].title : '';
                    h += `<div class="border rounded p-2 mb-2 bg-light">
                        <div class="d-flex align-items-center justify-content-between gap-2 flex-wrap">
                            <div><strong>${r + 1}.</strong> ${title}</div>
                        </div>
                    </div>`;
                }
                h += `</div>`;
                return h;
            })();
            const reqsStuUploadHtml = (() => {
                if (!reqs.length) return '';
                let h = `<div class="mt-2 exam-image-stu-uploads" data-qid="${question.ex_question_id}" data-subq="0">`;
                h += `<div class="small text-muted">考生上传<span class="en-text">Examinee upload</span></div>`;
                for (let r = 0; r < reqs.length; r++) {
                    h += `<div class="mt-2" style="display: none;">
                        <img class="img-thumbnail d-none mt-1 csg-img-thumb" data-csg-img-clickable="1" style="max-width: 320px;" id="stu_exam_img_${question.ex_question_id}_0_${r}">
                        <div class="small text-danger d-none" id="stu_exam_img_empty_${question.ex_question_id}_0_${r}">未上传</div>
                    </div>`;
                }
                h += `</div>`;
                return h;
            })();

            if (show && isReviewUI) {
                // 阅卷：考生答卷 vs 参考答案（左右对照）
                rethtml += `<div class="review-compare-row mt-3">
                    <div class="review-compare-left">
                        <div class="answer_meta_left_div" id="answer_meta_left_div_${question.ex_question_id}"></div>
                        ${reqsDescHtml}
                        <div class="md-answer-container">`;
                rethtml += this.GetReviewAnswerHeader();
                rethtml += `<div class="md-answer-preview" data-qid="${question.ex_question_id}" data-subq="0" data-initial-md=""></div>`;
                rethtml += `${reqsStuUploadHtml}`;
                rethtml += `</div>`;
            } else if (show) {
                // 预览：不显示“考生答卷”，仅展示参考答案（绿色边框）+ 元信息
                rethtml += `<div class="mt-3">
                    <div class="answer_meta_left_div" id="answer_meta_left_div_${question.ex_question_id}"></div>
                    ${reqsDescHtml}
                    <div class="md-answer-container md-ref-answer-container mt-3">`;
                rethtml += this.GetReviewRefHeader();
                rethtml += `<div class="ref-answer-slot" data-qid="${question.ex_question_id}" data-subq="0"></div>`;
                rethtml += `</div>
                    <div class="answer_meta_right_div mt-3" id="answer_meta_right_div_${question.ex_question_id}"></div>
                </div>`;
            } else {
                // 答题区域：按钮和预览区合并边框
                rethtml += `<div class="md-answer-container mt-3">`;
                rethtml += this.GetAnswerButton(question.ex_question_id, 0);
                rethtml += `<div class="md-answer-preview" data-qid="${question.ex_question_id}" data-subq="0" data-initial-md=""></div>`;
                rethtml += `</div>`;
            }
            if (!show && reqs.length > 0) {
                rethtml += `<div class="mt-3 exam-image-reqs" data-qid="${question.ex_question_id}" data-subq="0">`;
                rethtml += `<div class="fw-semibold mb-2 bilingual-inline">图片上传要求<span class="en-text">Image Upload</span></div>`;
                for (let r = 0; r < reqs.length; r++) {
                    const title = (reqs[r] && reqs[r].title) ? reqs[r].title : '';
                    rethtml += `<div class="border rounded p-2 mb-2 bg-light">
                        <div class="d-flex align-items-center justify-content-between gap-2 flex-wrap">
                            <div><strong>${r + 1}.</strong> ${title}</div>
                        </div>`;
                    if (show) {
                        // show=true：考生上传图片已移动到“考生答卷”容器内（md-answer-container）显示
                    } else {
                        rethtml += `<div class="mt-2 d-flex align-items-center gap-2 flex-wrap exam-image-upload-row">
                            <input type="file" class="d-none exam-image-file" id="exam_image_file_${question.ex_question_id}_0_${r}" data-qid="${question.ex_question_id}" data-subq="0" data-req="${r}" accept=".bmp,.png,.jpg,.jpeg,.webp,.tif,.tiff,image/*">
                            <button type="button" class="btn btn-outline-primary btn-sm" onclick="document.getElementById('exam_image_file_${question.ex_question_id}_0_${r}').click()">
                                <i class="bi bi-upload"></i> <span class="cn-text">选择文件</span><span class="en-text">Choose File</span>
                            </button>
                            <a href="/ojtool/tool/webdraw" target="_blank" class="btn btn-outline-info btn-sm" title="打开绘图工具绘制图形 (Open drawing tool)">
                                <i class="bi bi-pencil-square"></i> <span class="cn-text">绘图工具</span><span class="en-text">Draw Tool</span>
                            </a>
                            <img class="img-thumbnail d-none csg-img-thumb" data-csg-img-clickable="1" style="max-width: 180px;" id="exam_img_preview_${question.ex_question_id}_0_${r}">
                            <input type="hidden" class="submission_image_${question.ex_question_id}" data-subq="0" data-req="${r}" value="">
                            <input type="hidden" class="submission_image_tmp_${question.ex_question_id}" data-subq="0" data-req="${r}" value="">
                        </div>`;
                    }
                    rethtml += `</div>`;
                }
                rethtml += `</div>`;
            }
            if (show && isReviewUI) {
                rethtml += `</div>
                    <div class="review-compare-right">
                        <div class="md-answer-container md-ref-answer-container">`;
                rethtml += this.GetReviewRefHeader();
                rethtml += `<div class="ref-answer-slot" data-qid="${question.ex_question_id}" data-subq="0"></div>
                        </div>
                        <div class="answer_meta_right_div mt-3" id="answer_meta_right_div_${question.ex_question_id}"></div>
                    </div>
                </div>`;
            }
            rethtml += this.GetFooter(question);
            return rethtml;
        },
        Comprehensive: function(question, pnum=null, show=false) {
            let rethtml = this.GetHeader(question, pnum, show);
            const isReviewUI = CsgIsReviewUIPage();
            if (show) {
                rethtml += `<div class="review-compare-row mt-3 review-meta-row">
                    <div class="review-compare-left">
                        <div class="answer_meta_left_div" id="answer_meta_left_div_${question.ex_question_id}"></div>
                    </div>
                    <div class="review-compare-right"><!-- 答案解析移至参考答案下方，见小题循环内最后一题 --></div>
                </div>`;
            }
            rethtml += '<br/><br/><ul class="list-group">';
            let content = JSON.parse(question.content);
            // 计算各小题分数（如果还没有计算且题目有 pscore）
            if (content.length > 0 && !content[0].sub_pscore && typeof GetRealSubScore === 'function' && question.pscore !== undefined && question.pscore !== null) {
                const contentWithScore = GetRealSubScore(question, question.pscore);
                if (contentWithScore) {
                    content = contentWithScore;
                }
            }
            for(let i in content) {
                content[i].content = MarkdownParse(content[i].content, false);   // true: 也按单行markdown编译
            }
            for(let i = 0; i < content.length; i ++) {
                // 小题标题栏：Qid + 分值/分数比例
                // Qid 使用题目的 num 字段（如果存在），否则使用 pnum，最后使用 ex_question_id
                const mainQid = question.num || pnum || question.ex_question_id;
                const subQid = `${mainQid}-${i + 1}`;
                // 如果有实际分数，显示分数；否则显示分数比例
                let scoreHtml = '';
                if (content[i].sub_pscore !== undefined && content[i].sub_pscore !== null && content[i].sub_pscore !== '') {
                    // 显示实际分数
                    scoreHtml = `<span class="badge bg-info ms-2">${content[i].sub_pscore}分<span class="en-text">pts</span></span>`;
                } else if (content[i].score_ratio !== undefined && content[i].score_ratio !== null && String(content[i].score_ratio).trim() !== '') {
                    // 显示分数比例（预览模式）
                    scoreHtml = `<span class="badge bg-secondary ms-2 score-ratio-badge">${content[i].score_ratio}%<span class="en-text">ratio</span></span>`;
                }
                // 附加题标识（如果是最后一个小题，且是整场考试的最后一道题，且考试有附加题）
                const isLastSubQuestion = (i === content.length - 1);
                const isLastQuestion = !!(question.is_last_question === true);
                const hasAdditional = !!(window.examProblemsetConfig && window.examProblemsetConfig.has_additional === '1');
                const additionalBadge = (isLastSubQuestion && isLastQuestion && hasAdditional) 
                    ? `<span class="badge bg-warning text-dark ms-2 bilingual-inline">附加题<span class="en-text">Additional</span></span>` 
                    : '';
                if (show) {
                    rethtml += `<li class="list-group-item">
                        <div class="review-subq-head d-flex align-items-start justify-content-between gap-2 flex-wrap">
                            <div class="d-flex align-items-center gap-2 flex-wrap">
                                <span class="question-number-badge question-sub-number-badge">${subQid}</span>
                                <span class="fw-semibold">小题 ${i + 1}<span class="en-text">Sub-question ${i + 1}</span></span>
                                ${scoreHtml}
                                ${additionalBadge}
                            </div>
                            ${isReviewUI ? `<div class="review-subscore-slot" data-qid="${question.ex_question_id}" data-subq="${i}"></div>` : ''}
                        </div>
                        <label class="form-label mb-0 mt-2" for="ex_question_${question.ex_question_id}_${i}">${content[i].content}</label>
                        ${(() => {
                            const reqs = Array.isArray(content[i]?.image_reqs) ? content[i].image_reqs : [];
                            if (!reqs.length) return '';
                            let h = `<div class="mt-2 exam-image-reqs exam-image-reqs-desc" data-qid="${question.ex_question_id}" data-subq="${i}">`;
                            h += `<div class="fw-semibold mb-2 bilingual-inline">图片上传要求<span class="en-text">Image Upload</span></div>`;
                            for (let r = 0; r < reqs.length; r++) {
                                const title = (reqs[r] && reqs[r].title) ? reqs[r].title : '';
                                h += `<div class="border rounded p-2 mb-2 bg-light">
                                    <div class="d-flex align-items-center justify-content-between gap-2 flex-wrap">
                                        <div><strong>${r + 1}.</strong> ${title}</div>
                                    </div>
                                </div>`;
                            }
                            h += `</div>`;
                            return h;
                        })()}`;
                } else {
                    rethtml += `<li class="list-group-item">
                        <div class="d-flex align-items-center gap-2 mb-2 flex-wrap">
                            <span class="question-number-badge question-sub-number-badge">${subQid}</span>
                            <span class="fw-semibold">小题 ${i + 1}<span class="en-text">Sub-question ${i + 1}</span></span>
                            ${scoreHtml}
                            ${additionalBadge}
                        </div>
                        <label class="form-label" for="ex_question_${question.ex_question_id}_${i}">${content[i].content}</label>`;
                }
                rethtml += `<input type="hidden" maxlength="16384" class="form-control Comprehensive submission_${question.ex_question_id} question_input md-hidden-input question_input_typein" name="submission_${question.ex_question_id}_${i}" sub_qnum="${i}" qid="${question.ex_question_id}" id="ex_question_${question.ex_question_id}_${i}" data-qid="${question.ex_question_id}" data-subq="${i}">`;
                
                const reqs = Array.isArray(content[i]?.image_reqs) ? content[i].image_reqs : [];

                if (show && isReviewUI) {
                    // 阅卷：考生答卷 vs 参考答案（左右对照）；最后一小题下方显示答案解析
                    const isLastSubq = (i === content.length - 1);
                    rethtml += `<div class="review-compare-row mt-3">
                        <div class="review-compare-left">
                            <div class="md-answer-container">`;
                    rethtml += this.GetReviewAnswerHeader();
                    rethtml += `<div class="md-answer-preview" data-qid="${question.ex_question_id}" data-subq="${i}" data-initial-md=""></div>`;
                    // 阅卷页：考生上传图片渲染到“考生答卷”容器内
                    if (reqs.length > 0) {
                        rethtml += `<div class="mt-2 exam-image-stu-uploads" data-qid="${question.ex_question_id}" data-subq="${i}">
                            <div class="small text-muted">考生上传<span class="en-text">Examinee upload</span></div>`;
                        for (let r = 0; r < reqs.length; r++) {
                            rethtml += `<div class="mt-2" style="display: none;">
                                <img class="img-thumbnail d-none mt-1 csg-img-thumb" data-csg-img-clickable="1" style="max-width: 320px;" id="stu_exam_img_${question.ex_question_id}_${i}_${r}">
                                <div class="small text-danger d-none" id="stu_exam_img_empty_${question.ex_question_id}_${i}_${r}">未上传</div>
                            </div>`;
                        }
                        rethtml += `</div>`;
                    }
                    rethtml += `</div>
                        </div>
                        <div class="review-compare-right">
                            <div class="md-answer-container md-ref-answer-container">`;
                    rethtml += this.GetReviewRefHeader();
                    rethtml += `<div class="ref-answer-slot" data-qid="${question.ex_question_id}" data-subq="${i}"></div>
                            </div>`;
                    if (isLastSubq) {
                        rethtml += `<div class="answer_meta_right_div mt-3" id="answer_meta_right_div_${question.ex_question_id}"></div>`;
                    }
                    rethtml += `</div>
                    </div>`;

                    // 小题底部：弱化标题栏 + 完整打分控件（与顶部/总区三方同步）
                    const maxScore = (content[i] && content[i].sub_pscore !== undefined && content[i].sub_pscore !== null) ? content[i].sub_pscore : '';
                    rethtml += `
                        <div class="review-subq-foot mt-2">
                            <div class="review-subq-foot-left text-muted small">
                                <span class="fw-semibold">小题 ${i + 1}</span>
                                <span class="ms-2">${subQid}</span>
                                ${maxScore !== '' ? `<span class="ms-2">满分 ${maxScore} 分</span>` : ''}
                            </div>
                            <div class="review-subq-foot-hint text-muted small bilingual-inline">
                                小题上下均可打分，便于操作<span class="en-text">Score at top/bottom</span>
                            </div>
                            <div class="review-subq-foot-right review-subscore-panel border rounded bg-light px-2 py-1 d-flex align-items-center gap-2 flex-wrap">
                                <div class="btn-group">
                                    <button class="btn_fast_score btn btn-xs btn-outline-danger" vl="-1000"> |&lt;</button>
                                    <button class="btn_fast_score btn btn-xs btn-outline-danger" vl="-3"> &lt;&lt;</button>
                                    <button class="btn_fast_score btn btn-xs btn-outline-danger" vl="-0.5"> &lt;</button>
                                    <button class="btn_fast_score btn btn-xs btn-outline-info" vl="hf"> ||</button>
                                    <button class="btn_fast_score btn btn-xs btn-outline-success" vl="0.5">&gt;</button>
                                    <button class="btn_fast_score btn btn-xs btn-outline-success" vl="3">&gt;&gt;</button>
                                    <button class="btn_fast_score btn btn-xs btn-outline-success" vl="1000">&gt;|</button>
                                </div>
                                <input class="form-control form-control-sm text-end fw-semibold review_input review_subscore_bottom_input"
                                    type="text" inputmode="decimal" autocomplete="off" placeholder="分"
                                    qid="${question.ex_question_id}" q_sub_id="${i}" q_score="${maxScore}">
                                <button type="button" class="btn btn-sm btn-outline-primary review_submit review_submit_subscore review_submit_subscore_bottom"
                                    qid="${question.ex_question_id}" data-subq="${i}" title="保存本题 / Save this question" aria-label="保存本题 / Save this question">
                                    <i class="bi bi-save" aria-hidden="true"></i>
                                    <span class="review-subscore-warn-icon text-warning ms-1 d-none" title="提示 / Warning" aria-hidden="true"><i class="bi bi-exclamation-triangle-fill"></i></span>
                                </button>
                            </div>
                        </div>
                    `;
                } else if (show) {
                    // 预览：只显示参考答案（绿色边框），不显示“考生答卷”和打分控件
                    rethtml += `<div class="md-answer-container md-ref-answer-container mt-3">`;
                    rethtml += this.GetReviewRefHeader();
                    rethtml += `<div class="ref-answer-slot" data-qid="${question.ex_question_id}" data-subq="${i}"></div>`;
                    rethtml += `</div>`;
                } else {
                    // 答题：按钮和预览区合并边框
                    rethtml += `<div class="md-answer-container mt-3">`;
                    rethtml += this.GetAnswerButton(question.ex_question_id, i);
                    rethtml += `<div class="md-answer-preview" data-qid="${question.ex_question_id}" data-subq="${i}" data-initial-md=""></div>`;
                    rethtml += `</div>`;
                }
                
                // 图片上传要求（每小题）
                if (!show && reqs.length > 0) {
                    rethtml += `<div class="mt-3 exam-image-reqs" data-qid="${question.ex_question_id}" data-subq="${i}">`;
                    rethtml += `<div class="fw-semibold mb-2 bilingual-inline">图片上传要求<span class="en-text">Image Upload</span></div>`;
                    for (let r = 0; r < reqs.length; r++) {
                        const title = (reqs[r] && reqs[r].title) ? reqs[r].title : '';
                        rethtml += `<div class="border rounded p-2 mb-2 bg-light">
                            <div class="d-flex align-items-center justify-content-between gap-2 flex-wrap">
                                <div><strong>${r + 1}.</strong> ${title}</div>
                            </div>`;
                        rethtml += `<div class="mt-2 d-flex align-items-center gap-2 flex-wrap exam-image-upload-row">
                            <input type="file" class="d-none exam-image-file" id="exam_image_file_${question.ex_question_id}_${i}_${r}" data-qid="${question.ex_question_id}" data-subq="${i}" data-req="${r}" accept=".bmp,.png,.jpg,.jpeg,.webp,.tif,.tiff,image/*">
                            <button type="button" class="btn btn-outline-primary btn-sm" onclick="document.getElementById('exam_image_file_${question.ex_question_id}_${i}_${r}').click()">
                                <i class="bi bi-upload"></i> <span class="cn-text">选择文件</span><span class="en-text">Choose File</span>
                            </button>
                            <a href="/ojtool/tool/webdraw" target="_blank" class="btn btn-outline-info btn-sm" title="打开绘图工具绘制图形 (Open drawing tool)">
                                <i class="bi bi-pencil-square"></i> <span class="cn-text">绘图工具</span><span class="en-text">Draw Tool</span>
                            </a>
                            <img class="img-thumbnail d-none csg-img-thumb" data-csg-img-clickable="1" style="max-width: 180px;" id="exam_img_preview_${question.ex_question_id}_${i}_${r}">
                            <input type="hidden" class="submission_image_${question.ex_question_id}" data-subq="${i}" data-req="${r}" value="">
                            <input type="hidden" class="submission_image_tmp_${question.ex_question_id}" data-subq="${i}" data-req="${r}" value="">
                        </div>`;
                        rethtml += `</div>`;
                    }
                    rethtml += `</div>`;
                }
                rethtml += `</li>`;
            }
            rethtml += '</ul>';
            rethtml += this.GetFooter(question);
            return rethtml;
        },
        join_programming: function(question, problem, allow_lang=null, pnum=null, show=false) {
            let rethtml = `<div class='question_div question_programming' ex_question_id='${question.ex_question_id}' id='question_div_${question.ex_question_id}' pkind='25'>`;
            
            // 获取题目类型颜色和名称（编程题 pkind=25）
            const pkind = 25;
            const pkColor = question_default.pkind_color[pkind];
            const pkName = question_default.pkind_table_cn[pkind];
            
            // 获取题号、ID、分数等信息
            const mainQid = question.num || pnum || question.ex_question_id;
            const isAdmin = !!(window.examProblemsetConfig && window.examProblemsetConfig.is_admin === '1');
            const idBadge = isAdmin ? `<span class="question-id-badge ms-2">ID:${question.ex_question_id}</span>` : '';
            const scoreVal = (question.pscore !== undefined && question.pscore !== null && question.pscore !== '') ? question.pscore : '';
            const scoreHtml = scoreVal !== '' ? `<span class="question-score-badge ms-2"><span class="badge bg-info">${scoreVal}分<span class="en-text">pts</span></span></span>` : '';
            
            // 判断是否是最后一道题，且考试有附加题
            const isLastQuestion = !!(question.is_last_question === true);
            const hasAdditional = !!(window.examProblemsetConfig && window.examProblemsetConfig.has_additional === '1');
            const additionalBadge = (isLastQuestion && hasAdditional) 
                ? `<span class="badge bg-warning text-dark ms-2 bilingual-inline">附加题<span class="en-text">Additional</span></span>` 
                : '';
            
            // 题目标题：融合考试题号和OJ题目信息
            rethtml += `
                <div class="prog-header mb-3">
                    <h4 class="prog-title mb-2 d-flex align-items-center flex-wrap" style="gap: 8px;">
                        <span class="question-number-badge" style="background-color:${pkColor};" data-bs-toggle="tooltip" data-bs-placement="top" data-bs-title="${pkName}" csg-target-tooltip="true">${mainQid}</span>
                        ${idBadge}
                        ${scoreHtml}
                        ${additionalBadge}
                        <span class="text-muted fw-normal ms-2">#${problem.problem_id}</span>
                        <span class="flex-grow-1">${problem.title}</span>
                    </h4>
                    <div class="prog-limits text-muted small">
                        <span class="me-3"><i class="bi bi-clock me-1"></i>${problem.time_limit}s</span>
                        <span class="me-3"><i class="bi bi-memory me-1"></i>${problem.memory_limit}MB</span>
                        ${problem.spj != '0' ? '<span class="text-danger"><i class="bi bi-check2-square me-1"></i>SPJ</span>' : ''}
                    </div>
                </div>`;
            
            // 头部槽位，供外层插入题号/按钮（保留兼容性）
            rethtml += `<div class="question_header_slot d-none"></div>`;

            // 描述
            rethtml += `
                <h5 class="mt-2 bilingual-inline">题目描述<span class="en-text">Description</span></h5>
                <div class='md_display_div'>${problem.description}</div>
                <h5 class="mt-3 bilingual-inline">输入格式<span class="en-text">Input</span></h5>
                <div class='md_display_div'>${problem.input}</div>
                <h5 class="mt-3 bilingual-inline">输出格式<span class="en-text">Output</span></h5>
                <div class='md_display_div'>${problem.output}</div>
                <h5 class="mt-3 bilingual-inline">样例<span class="en-text">Sample</span></h5>
                <div class='md_display_div'><div class="sample_div">${typeof ProblemSampleHtml === 'function' ? ProblemSampleHtml(problem.sample_input, problem.sample_output, 5, false, problem.problem_id) : (() => {
                    // 降级实现：如果 ProblemSampleHtml 未定义，使用简单的表格显示
                    const sampleIn = String(problem.sample_input || '').trim();
                    const sampleOut = String(problem.sample_output || '').trim();
                    if (!sampleIn && !sampleOut) {
                        return '<h5 class="bilingual-inline">无样例<span class="en-text">No Sample</span></h5>';
                    }
                    return `<table class="table table-bordered">
                        <thead><tr><th>输入样例</th><th>输出样例</th></tr></thead>
                        <tbody><tr><td><pre>${sampleIn || ''}</pre></td><td><pre>${sampleOut || ''}</pre></td></tr></tbody>
                    </table>`;
                })()}</div></div>
            `;
            if(problem?.hint && problem.hint.trim() != '') {
                rethtml += `<h5 class="mt-3 bilingual-inline">提示<span class="en-text">Hint</span></h5>
                <div class='md_display_div'>${problem.hint}</div>`
            }

            let content;
            try { content = JSON.parse(question.content); } catch(e) { content = []; }
            if(!Array.isArray(content)) content = [];
            const firstContent = content[0] || {};
            const codeVal = (() => {
                if (typeof firstContent === 'string') return firstContent;
                if (firstContent && typeof firstContent.code === 'string') return firstContent.code;
                if (firstContent && firstContent.code != null) return String(firstContent.code);
                return '';
            })();
            const allowLang = allow_lang || {};
            const allow_lang_key = Object.keys(allowLang);
            const allow_lang_val = Object.values(allowLang);
            // 设置默认语言：优先选择 language=1 (C++)
            let selected_lang = '1';
            if (!('1' in allowLang) && allow_lang_key.length > 0) {
                selected_lang = allow_lang_key[0];
            }
            if(show) {
                const allowShowAnswer = !(window.questionPreviewConfig && window.questionPreviewConfig.showAnswer === false);
                const isReviewUI = CsgIsReviewUIPage();
                // 预览模式：显示代码模板和参考代码，不显示考试用的控件
                // 注意：在阅卷页面，需要创建 stu_asheet_span 用于显示考生代码
                
                // 显示代码模板（如果存在）
                if(codeVal && codeVal.trim()) {
                    rethtml += `
                        <div class="mt-3 mb-2 question_code_template ex-scroll-section">
                            <h5 class="mb-2 ex-title-row">
                                <i class="bi bi-file-code text-info me-2"></i>
                                <span class="bilingual-inline">代码模板<span class="en-text">Code Template</span></span>
                                <a href="javascript:void(0)" class="ex-scroll-toggle" data-ex-target=".code-viewer-container, pre" title="展开 / Expand">
                                    <i class="bi bi-arrows-angle-expand"></i>
                                </a>
                            </h5>
                            <div class="code-template-content" data-ex-question-id="${question.ex_question_id}">`;
                    
                    if (typeof renderCode !== 'undefined' && renderCode) {
                        const templateContainer = renderCode(codeVal, {
                            enableHighlight: true,
                            enableLineNumber: true,
                            language: null,
                            cssClass: 'code-viewer-template'
                        });
                        rethtml += templateContainer[0].outerHTML;
                    } else {
                        rethtml += `<pre class="bg-light p-3 border rounded code-viewer-template"><code>${codeVal}</code></pre>`;
                    }
                    
                    rethtml += `
                            </div>
                        </div>`;
                }

                if (isReviewUI) {
                    // 阅卷：学生代码 vs 参考代码（左右对照）
                    rethtml += `<div class="review-compare-row mt-3">
                        <div class="review-compare-left">
                            <div class="answer_meta_left_div" id="answer_meta_left_div_${question.ex_question_id}"></div>
                            <div class="stu_asheet_span stu_code_display"></div>
                        </div>
                        <div class="review-compare-right">
                            <div class="md-answer-container md-ref-answer-container">`;
                    rethtml += this.GetReviewRefHeader();
                    rethtml += `<div class="ref-answer-slot" data-qid="${question.ex_question_id}" data-subq="0"></div>
                            </div>
                            <div class="answer_meta_right_div mt-3" id="answer_meta_right_div_${question.ex_question_id}"></div>
                        </div>
                    </div>`;
                } else {
                    // 预览：不显示“考生代码/答卷”区域，仅展示参考答案（绿色边框）+ 元信息
                    rethtml += `<div class="mt-3">
                        <div class="answer_meta_left_div" id="answer_meta_left_div_${question.ex_question_id}"></div>
                        <div class="md-answer-container md-ref-answer-container mt-3">`;
                    rethtml += this.GetReviewRefHeader();
                    rethtml += `<div class="ref-answer-slot" data-qid="${question.ex_question_id}" data-subq="0"></div>
                        </div>
                        <div class="answer_meta_right_div mt-3" id="answer_meta_right_div_${question.ex_question_id}"></div>
                    </div>`;
                }
                
                // 预览模式下：编程题代码只展示两块：
                // - 代码模板（来自 content.code）
                // - 参考答案（由 ProcessAnswerHtml/QuestionRender.ans.Render 统一渲染）
            } else {
                // 考试模式：显示语言选择、提交按钮等
                // 检查是否支持多个小题（content 数组长度 > 1）
                const hasMultipleSubQuestions = content.length > 1;
                
                if (hasMultipleSubQuestions) {
                    // 多个小题：为每个小题添加标题栏和代码输入框
                    // 计算各小题分数（如果还没有计算）
                    if (content.length > 0 && !content[0].sub_pscore && typeof GetRealSubScore === 'function') {
                        const contentWithScore = GetRealSubScore(question, question.pscore);
                        if (contentWithScore) {
                            content = contentWithScore;
                        }
                    }
                    
                    for(let i = 0; i < content.length; i++) {
                        const subContent = content[i] || {};
                        const subCodeVal = (() => {
                            if (typeof subContent === 'string') return subContent;
                            if (subContent && typeof subContent.code === 'string') return subContent.code;
                            if (subContent && subContent.code != null) return String(subContent.code);
                            return '';
                        })();
                        const subScore = subContent.sub_pscore !== undefined ? subContent.sub_pscore : '';
                        
                        // 小题标题栏：对齐其他题目类型的样式
                        // Qid 使用题目的 num 字段（如果存在），否则使用 pnum，最后使用 ex_question_id
                        const mainQid = question.num || pnum || question.ex_question_id;
                        const subQid = `${mainQid}-${i + 1}`;
                        
                        // 获取题目类型颜色和名称（编程题 pkind=25）
                        const pkind = 25;
                        const pkColor = question_default.pkind_color[pkind];
                        const pkName = question_default.pkind_table_cn[pkind];
                        
                        // 判断是否是管理员（用于显示ID）
                        const isAdmin = !!(window.examProblemsetConfig && window.examProblemsetConfig.is_admin === '1');
                        const idBadge = isAdmin ? `<span class="question-id-badge">ID:${question.ex_question_id}</span>` : '';
                        
                        // 分数badge
                        const scoreHtml = subScore !== '' ? `<span class="question-score-badge"><span class="badge bg-info">${subScore}分<span class="en-text">pts</span></span></span>` : '';
                        
                        // 判断是否是最后一个小题，且考试有附加题
                        // 只需要满足：1) 是编程题的最后一个小题；2) 是整场考试的最后一道题；3) 考试有附加题
                        const isLastSubQuestion = (i === content.length - 1);
                        const isLastQuestion = !!(question.is_last_question === true);
                        const hasAdditional = !!(window.examProblemsetConfig && window.examProblemsetConfig.has_additional === '1');
                        const additionalBadge = (isLastSubQuestion && isLastQuestion && hasAdditional) 
                            ? `<span class="badge bg-warning text-dark ms-2 bilingual-inline">附加题<span class="en-text">Additional</span></span>` 
                            : '';
                        
                        rethtml += `
                            <div class="d-flex align-items-center gap-2 mt-3 mb-2 flex-wrap" style="display: flex; align-items: center; gap: 8px; flex: 1 1 0%; min-width: 0px;">
                                <span class="question-number-part" style="display: flex; align-items: center; gap: 8px;">
                                    <span class="question-number-badge question-sub-number-badge" style="background-color:${pkColor};" data-bs-toggle="tooltip" data-bs-placement="top" data-bs-title="${pkName}" csg-target-tooltip="true">${subQid}</span>
                                    ${idBadge}
                                    ${scoreHtml}
                                    ${additionalBadge}
                                </span>
                            </div>`;
                        
                        // 语言选择和提交按钮（每个小题独立）
                        const statusHref = cid ? `/${PAGE_MODULE}/contest/status?cid=${cid}` : `/${PAGE_MODULE}/contest/status`;
                        rethtml += `
                            <div class="d-flex align-items-center gap-2 mb-2 flex-wrap">
                                <h5 class="mb-0">Code</h5>
                                <select class="language_select form-select form-select-sm" name="lang" qid="${question.ex_question_id}" sub_qnum="${i}" style="width: auto;">`;
                        for(let j in allow_lang_key) {
                            let selected = selected_lang == allow_lang_key[j] ? "selected" : "";
                            rethtml += `<option value="${allow_lang_key[j]}" ${selected}>${allow_lang_val[j]}</option>`;
                        }
                        rethtml += `
                                </select>
                                <button class="btn btn-sm btn-success question_submit" type="button" qid="${question.ex_question_id}" sub_qnum="${i}">
                                    <i class="bi bi-upload"></i><span class="cn-text">提交</span><span class="en-text">Submit</span>
                                </button>
                                <button class="btn btn-sm btn-outline-secondary Programming_reset" type="button" qid="${question.ex_question_id}" sub_qnum="${i}">
                                    <i class="bi bi-arrow-counterclockwise"></i><span class="cn-text">重置</span><span class="en-text">Reset</span>
                                </button>
                                <a class="btn btn-sm btn-outline-info pro-status" id="pro_status_${question.ex_question_id}_${i}" href="${statusHref}" target="_blank" rel="noopener">
                                    <i class="bi bi-activity"></i><span class="cn-text">评测状态</span><span class="en-text">Status</span>
                                </a>
                            </div>
                            <textarea class="form-control Programming submission_${question.ex_question_id} question_input question_input_typein code_area" rows="10" name="submission_${question.ex_question_id}_${i}" sub_qnum="${i}" qid="${question.ex_question_id}" id="ex_question_${question.ex_question_id}_${i}">${subCodeVal || ''}</textarea>
                        `;
                    }
                } else {
                    // 单个小题：题号等信息已在 prog-header 中显示，这里直接显示语言选择和提交按钮
                    const statusHref = cid ? `/${PAGE_MODULE}/contest/status?cid=${cid}` : `/${PAGE_MODULE}/contest/status`;
                    rethtml += `
                        <div class="d-flex align-items-center gap-2 mb-2 flex-wrap">
                            <h5 class="mb-0">Code</h5>
                            <select class="language_select form-select form-select-sm" name="lang" qid="${question.ex_question_id}" style="width: auto;">`;
                    for(let i in allow_lang_key) {
                        let selected = selected_lang == allow_lang_key[i] ? "selected" : "";
                        rethtml += `<option value="${allow_lang_key[i]}" ${selected}>${allow_lang_val[i]}</option>`;
                    }
                    rethtml += `
                            </select>
                            <button class="btn btn-sm btn-success question_submit" type="button" qid="${question.ex_question_id}">
                                <i class="bi bi-upload"></i><span class="cn-text">提交</span><span class="en-text">Submit</span>
                            </button>
                            <button class="btn btn-sm btn-outline-secondary Programming_reset" type="button" qid="${question.ex_question_id}">
                                <i class="bi bi-arrow-counterclockwise"></i><span class="cn-text">重置</span><span class="en-text">Reset</span>
                            </button>
                            <a class="btn btn-sm btn-outline-info pro-status" id="pro_status_${question.ex_question_id}" href="${statusHref}" target="_blank" rel="noopener">
                                <i class="bi bi-activity"></i><span class="cn-text">评测状态</span><span class="en-text">Status</span>
                            </a>
                        </div>
                        <textarea class="form-control Programming submission_${question.ex_question_id} question_input question_input_typein code_area" rows="10" name="submission_${question.ex_question_id}" sub_qnum="0" qid="${question.ex_question_id}" id="ex_question_${question.ex_question_id}">${codeVal || ''}</textarea>
                    `;
                }
            }
            rethtml += this.GetFooter(question);
            return rethtml;
        },
        Programming: function(question, pnum, show=false, pro_data, allow_lang) {
            // 非 async 用于已预加载题目数据的情况
            // rethtml += "<span>" + pnum_str + MarkdownParse(question.title) + "</span>";
            let problem = pro_data;
            let rethtml = this.join_programming(question, problem, allow_lang, pnum, show);
            return rethtml;
        },
        Programming_async: function(question, pnum=null, show=false, pro_url='/exadmin/exam/problem_ajax') {
            // 使用 jQuery 异步加载 OJ 题目
            // 注意：需要在闭包中保存 show 参数
            const showMode = show;
            return new Promise(function(resolve, reject) {
                $.get(pro_url, { problem_id: question.description }, function(pro_ret) {
                    if(pro_ret.code != 1) {
                        alerty.error("Load OJ problem failed;");
                        reject(new Error("Load OJ problem failed"));
                        return;
                    }
                    let problem = pro_ret.data;
                    // 正确传递 show 参数，控制是否显示提交按钮等控件
                    let rethtml = QuestionRender.html.join_programming(question, problem, null, pnum, showMode);
                    resolve(rethtml);
                }, 'json').fail(function() {
                    alerty.error("Load OJ problem failed;");
                    reject(new Error("Load OJ problem failed"));
                });
            });
        }
    },
    // **************************************************
    // 在题目界面基础上显示考生答卷
    asheet: {
        Render(question, q_div=null, show=false, asheet_single=null) {
            if(typeof(asheet) != 'undefined' && IsNothing(asheet_single) && typeof(asheet_tmp) != 'undefined') {
                asheet_single = GetNewerAsheetSingle(asheet, asheet_tmp, question.ex_question_id);
            }
            if(q_div == null) {
                q_div = this.GetDiv(question.ex_question_id);
            }
            if(IsNothing(asheet_single?.ex_question_id)) {
                // 未作答该题，要清空题目里之前的答卷信息
                if(show) {
                    this.ClearSubmissionShow(question.ex_question_id, q_div);
                } 
                return false;
            }
            let pkind_str = question_default.pkind_table[question.pkind];
            this[pkind_str](asheet_single, q_div, show);
            return true;
        },
        GetDiv: function(ex_question_id) {
            return document.getElementById(`question_div_${ex_question_id}`);
        },
        ClearSubmissionShow: function(ex_question_id, q_div) {
            // 清理显示的答卷信息
            let asheet_span_list = q_div.getElementsByClassName(`stu_asheet_span`);
            for(let i = 0; i < asheet_span_list.length; i ++) {
                asheet_span_list[i].innerHTML = '';
            }
            let input_list = q_div.getElementsByClassName(`submission_${ex_question_id}`);
            for(let i = 0; i < input_list.length; i ++) {
                input_list[i].checked = false;
            }
        },
        GetSubmission: function(asheet_single) {
            let submission = typeof(asheet_single?.submission) == 'string' ? JSON.parse(asheet_single.submission) : asheet_single.submission;
            if(IsNothing(submission)) {
                submission = {};
            }
            return submission;
        },
        SingleChoice: function(asheet_single, q_div) {
            let submission = this.GetSubmission(asheet_single);
            let stuAnsFlag = Array.isArray(submission) && submission.length == 1;
            function anschecked(cs_) {return stuAnsFlag && cs_ == submission[0];}
            let input_list = q_div.getElementsByClassName(`submission_${asheet_single.ex_question_id}`);
            let Acode = "A".charCodeAt(0);
            for(let i = 0; i < input_list.length; i ++) {
                let choice_val = String.fromCharCode(Acode + parseInt(input_list[i].value));
                input_list[i].checked = anschecked(choice_val);
            }
        },
        MultiChoice: function(asheet_single, q_div) {
            let submission = this.GetSubmission(asheet_single);
            let stuAnsFlag = Array.isArray(submission);
            function anschecked(cs_) {return stuAnsFlag && submission.includes(cs_);}
            let input_list = q_div.getElementsByClassName(`submission_${asheet_single.ex_question_id}`);
            let Acode = "A".charCodeAt(0);
            for(let i = 0; i < input_list.length; i ++) {
                let choice_val = String.fromCharCode(Acode + parseInt(input_list[i].value));
                input_list[i].checked = anschecked(choice_val);
            }
        },
        TrueFalse: function(asheet_single, q_div) {
            let submission = this.GetSubmission(asheet_single);
            let stuAnsFlag = Array.isArray(submission) && submission.length == 1;
            function anschecked(cs_) {return stuAnsFlag && cs_ == submission[0];}
            let input_list = q_div.getElementsByClassName(`submission_${asheet_single.ex_question_id}`);
            let TF = ["T", "F"];
            for(let i = 0; i < input_list.length; i ++) {
                let choice_val = TF[i];
                input_list[i].checked = anschecked(choice_val);
            }
        },
        Fill: function(asheet_single, q_div, show=false) {
            let submission = this.GetSubmission(asheet_single);
            let stuAnsFlag = Array.isArray(submission);
            function ansfill(i) {return stuAnsFlag && i < submission.length ? submission[i].trim() : '';}
            let asheet_input_list = q_div.getElementsByClassName(`submission_${asheet_single.ex_question_id}`);
            for(let i = 0; i < asheet_input_list.length; i ++) {
                const val = ansfill(i) || '';
                asheet_input_list[i].value = val;
                const preview = q_div.querySelector(`.md-answer-preview[data-qid="${asheet_single.ex_question_id}"][data-subq="${i}"]`);
                if (preview) {
                    preview.setAttribute('data-initial-md', val);
                    if (show && !val) {
                        preview.innerHTML = `<span class="text-muted bilingual-inline">未作答<span class="en-text">Not answered</span></span>`;
                    } else {
                        renderMdPreview(preview, val);
                    }
                }
            }
        },
        ShortAnswer: function(asheet_single, q_div, show=false) {
            let submission = this.GetSubmission(asheet_single);
            // 新结构：{text:[...], images:[[...]]}
            let stuAnsFlag = submission && Array.isArray(submission.text) && submission.text.length == 1;
            function ansfill() {return stuAnsFlag ? submission.text[0].trim() : '';}
            let asheet_input = q_div.getElementsByClassName(`submission_${asheet_single.ex_question_id}`)[0];
            const val = ansfill() || '';
            if(asheet_input) asheet_input.value = val;
            const preview = q_div.querySelector(`.md-answer-preview[data-qid="${asheet_single.ex_question_id}"][data-subq="0"]`);
            if (preview) {
                preview.setAttribute('data-initial-md', val);
                if (show && !val) {
                    preview.innerHTML = `<span class="text-muted bilingual-inline">未作答<span class="en-text">Not answered</span></span>`;
                } else {
                    if (typeof renderMdPreview === 'function') renderMdPreview(preview, val);
                }
            }
            // 图片回填
            const imgRow = (submission && Array.isArray(submission.images) && Array.isArray(submission.images[0])) ? submission.images[0] : [];
            const imgInputs = q_div.querySelectorAll(`input.submission_image_${asheet_single.ex_question_id}[data-subq="0"]`);
            imgInputs.forEach((inp) => {
                const ridx = parseInt(inp.getAttribute('data-req') || '0', 10);
                const url = imgRow[ridx] || '';
                inp.value = url;
                const img = q_div.querySelector(`#exam_img_preview_${asheet_single.ex_question_id}_0_${ridx}`);
                if (img) {
                    if (url) {
                        img.src = url;
                        img.classList.remove('d-none');
                    } else {
                        img.classList.add('d-none');
                    }
                }
            });
            // show=true（阅卷/预览）时：填充学生上传占位
            const stuImgRow = imgRow;
            for (let ridx = 0; ridx < stuImgRow.length; ridx++) {
                const url = stuImgRow[ridx] || '';
                const stuImg = q_div.querySelector(`#stu_exam_img_${asheet_single.ex_question_id}_0_${ridx}`);
                const stuEmpty = q_div.querySelector(`#stu_exam_img_empty_${asheet_single.ex_question_id}_0_${ridx}`);
                // 查找外层容器（用于在阅卷时显示）
                const container = stuImg ? stuImg.closest('.mt-2[style*="display: none"]') : null;
                if (stuImg) {
                    if (url) {
                        stuImg.src = url;
                        stuImg.classList.remove('d-none');
                        if (stuEmpty) stuEmpty.classList.add('d-none');
                        // 阅卷时有学生上传内容，显示外层容器
                        if (container) container.style.display = '';
                    } else {
                        stuImg.classList.add('d-none');
                        if (stuEmpty) stuEmpty.classList.remove('d-none');
                        // 阅卷时即使没有上传，也显示容器（显示"未上传"提示）
                        if (container) container.style.display = '';
                    }
                }
            }
        },
        Comprehensive: function(asheet_single, q_div, show=false) {
            let submission = this.GetSubmission(asheet_single);
            let stuAnsFlag = submission && Array.isArray(submission.text);
            function ansfill(i) {return stuAnsFlag && i < submission.text.length ? submission.text[i].trim() : '';}
            let asheet_input_list = q_div.getElementsByClassName(`submission_${asheet_single.ex_question_id}`);
            for(let i = 0; i < asheet_input_list.length; i ++) {
                const val = ansfill(i) || '';
                asheet_input_list[i].value = val;
                const preview = q_div.querySelector(`.md-answer-preview[data-qid="${asheet_single.ex_question_id}"][data-subq="${i}"]`);
                if (preview) {
                    preview.setAttribute('data-initial-md', val);
                    if (show && !val) {
                        preview.innerHTML = `<span class="text-muted bilingual-inline">未作答<span class="en-text">Not answered</span></span>`;
                    } else {
                        renderMdPreview(preview, val);
                    }
                }
            }
            // 图片回填
            const imgAll = (submission && Array.isArray(submission.images)) ? submission.images : [];
            for (let i = 0; i < asheet_input_list.length; i++) {
                const imgRow = Array.isArray(imgAll[i]) ? imgAll[i] : [];
                const imgInputs = q_div.querySelectorAll(`input.submission_image_${asheet_single.ex_question_id}[data-subq="${i}"]`);
                imgInputs.forEach((inp) => {
                    const ridx = parseInt(inp.getAttribute('data-req') || '0', 10);
                    const url = imgRow[ridx] || '';
                    inp.value = url;
                    const img = q_div.querySelector(`#exam_img_preview_${asheet_single.ex_question_id}_${i}_${ridx}`);
                    if (img) {
                        if (url) {
                            img.src = url;
                            img.classList.remove('d-none');
                        } else {
                            img.classList.add('d-none');
                        }
                    }
                });
                // show=true（阅卷/预览）学生上传占位
                for (let ridx = 0; ridx < imgRow.length; ridx++) {
                    const url = imgRow[ridx] || '';
                    const stuImg = q_div.querySelector(`#stu_exam_img_${asheet_single.ex_question_id}_${i}_${ridx}`);
                    const stuEmpty = q_div.querySelector(`#stu_exam_img_empty_${asheet_single.ex_question_id}_${i}_${ridx}`);
                    // 查找外层容器（用于在阅卷时显示）
                    const container = stuImg ? stuImg.closest('.mt-2[style*="display: none"]') : null;
                    if (stuImg) {
                        if (url) {
                            stuImg.src = url;
                            stuImg.classList.remove('d-none');
                            if (stuEmpty) stuEmpty.classList.add('d-none');
                            // 阅卷时有学生上传内容，显示外层容器
                            if (container) container.style.display = '';
                        } else {
                            stuImg.classList.add('d-none');
                            if (stuEmpty) stuEmpty.classList.remove('d-none');
                            // 阅卷时即使没有上传，也显示容器（显示"未上传"提示）
                            if (container) container.style.display = '';
                        }
                    }
                }
            }
        },
        Programming: function(asheet_single, q_div, show=false) {
            let submission = this.GetSubmission(asheet_single);
            let stuAnsFlag = ('lang' in submission) && ('code' in submission);
            function ansfill() {return stuAnsFlag ? submission.code.trim() : '';}
            // 阅卷/预览 show=true 时，本页通常不会渲染语言选择器（仅展示代码）
            // 因此不应在 show 模式下强依赖 select[name="lang"] 存在
            if(!show && !IsNothing(allow_lang)) {
                // 从 q_div 获取 ex_question_id（唯一途径：从 ex_question_id 属性获取）
                const ex_question_id = q_div.getAttribute('ex_question_id');
                if (!ex_question_id) {
                    console.error('Cannot find ex_question_id attribute from q_div', q_div);
                    return;
                }
                
                // 处理 select 元素（唯一途径：通过 name="lang" 和 qid 属性查找）
                let lang_select = q_div.querySelector(`select[name="lang"][qid="${ex_question_id}"]`);
                if (!lang_select) {
                    // 在某些页面（例如阅卷/预览或精简渲染）可能不存在语言选择器，属于正常情况
                    // 降噪：不再报错中断
                    console.debug?.(`Language select element not found for question ${ex_question_id} (skip)`);
                } else {
                    // 正确处理 lang=0 的情况（0 是有效的语言ID，但也是 falsy 值）
                    if (submission && 'lang' in submission && submission.lang !== null && submission.lang !== undefined) {
                        const langValue = String(submission.lang);
                        // 验证该值是否在允许的语言列表中
                        const optionExists = Array.from(lang_select.options).some(opt => opt.value === langValue);
                        if (optionExists) {
                            lang_select.value = langValue;
                        } else {
                            console.debug?.(`Language value ${langValue} not found in options for question ${ex_question_id} (skip)`);
                            // 如果值不在选项中，使用第一个选项
                            const firstOption = lang_select.querySelector('option:first-child');
                            if (firstOption) {
                                lang_select.value = firstOption.value;
                            }
                        }
                    }
                }
            }
            if(show) {
                // 展示而非填写（阅卷模式）
                let asheet_span = q_div.getElementsByClassName(`stu_asheet_span`)[0];
                // 如果找不到 stu_asheet_span，尝试创建它（可能在预览模式下没有创建）
                if(!asheet_span) {
                    // 查找合适的位置插入（通常在题目描述之后）
                    let mdDisplayDivs = q_div.getElementsByClassName('md_display_div');
                    let insertAfter = mdDisplayDivs.length > 0 ? mdDisplayDivs[mdDisplayDivs.length - 1] : null;
                    asheet_span = document.createElement('div');
                    asheet_span.className = 'stu_asheet_span stu_code_display';
                    if(insertAfter && insertAfter.parentNode) {
                        insertAfter.parentNode.insertBefore(asheet_span, insertAfter.nextSibling);
                    } else {
                        q_div.appendChild(asheet_span);
                    }
                }
                
                let lang = allow_lang != null && submission.lang in allow_lang ? allow_lang[submission.lang] : 'c++';
                const codeToShow = stuAnsFlag ? submission.code : '';
                
                // 准备代码内容用于复制（HTML 转义）
                let codeContentForCopy = codeToShow && codeToShow.trim() ? DomSantize(codeToShow.trim()) : '';
                
                // 构建学生代码显示区域
                let codeHtml = `
                    <div class="mt-3 mb-2${codeToShow && codeToShow.trim() ? ' ex-scroll-section' : ''}">
                        <h5 class="mb-2 d-flex align-items-center">
                            <i class="bi bi-person-fill text-primary me-2"></i>
                            <span class="bilingual-inline">学生提交代码<span class="en-text">Student Submission</span></span>
                            ${codeToShow && codeToShow.trim() ? `<a href="javascript:void(0)" class="ex-scroll-toggle ms-2" data-ex-target=".code-viewer-container, pre" title="展开 / Expand"><i class="bi bi-arrows-angle-expand"></i></a><a href="javascript:void(0)" class="student-code-copy-btn ms-2" data-code-content="${codeContentForCopy}" title="复制代码 / Copy Code"><i class="bi bi-clipboard"></i></a>` : ''}
                            <span class="badge bg-info bg-opacity-10 text-info border border-info border-opacity-25 ms-2">${lang.toUpperCase()}</span>
                        </h5>
                        <div class="stu-code-content">`;
                
                // 使用新的代码渲染函数，带行号
                if(codeToShow && codeToShow.trim()) {
                    const codeContainer = renderCode(codeToShow, {
                        enableHighlight: true,
                        enableLineNumber: true,
                        language: lang,
                        cssClass: 'code-viewer-student'
                    });
                    codeHtml += codeContainer[0].outerHTML;
                } else if(codeToShow && codeToShow.trim()) {
                    // 所有依赖已全局引入，直接使用 renderCode
                    codeHtml += renderCode(codeToShow, lang || 'text');
                } else {
                    codeHtml += `
                        <div class="code-viewer-container code-render-empty">
                            <div class="code-empty-placeholder">
                                <i class="bi bi-file-earmark-x text-muted"></i>
                                <span class="text-muted ms-2">该学生未提交代码 / No Code Submitted</span>
                            </div>
                        </div>`;
                }
                
                codeHtml += `
                        </div>
                    </div>`;
                
                asheet_span.innerHTML = codeHtml;
            } else {
                let asheet_input = q_div.getElementsByClassName(`submission_${asheet_single.ex_question_id}`)[0];
                if(asheet_input) {
                    asheet_input.value = ansfill();
                }
            }
        }
    },
    // **************************************************
    // 设置禁止/允许答题状态
    dis: {
        Render: function(question, q_div=null, is_disable=null) {
            if(q_div == null) {
                q_div = this.GetDiv(question.ex_question_id);
            }
            if(is_disable !== null) {
                // 人为设定disable
                this.AsheetDisable(q_div, is_disable);
            } else {
                // 根据题目状态判断
                is_disable = this.IsQuestionDisabled(question);
                this.AsheetDisable(q_div, is_disable);
                // 按钮状态逻辑：
                // - 如果考试结束（is_disable=true），按钮禁用
                // - 如果有未保存修改（question.modified=true），按钮可用
                // - 如果没有修改（question.modified=false/undefined），按钮禁用
                const buttonDisabled = is_disable || question.modified !== true;
                this.SubmitButtonStatus(q_div, question.modified, buttonDisabled);
            }
            return true;
        },
        GetDiv: function(ex_question_id) {
            return document.getElementById(`question_div_${ex_question_id}`);
        },
        AsheetDisable: function(q_div, is_disable) {
            if(typeof(q_div) != 'undefined' && !IsNothing(q_div)) {
                let subnodes = q_div.getElementsByTagName('*')
                for(let i = 0; i < subnodes.length; i ++) {
                    if(!subnodes[i].classList.contains('sample_copy')) {
                        subnodes[i].disabled = is_disable;
                    }
                }
            }
        },
        SubmitButtonStatus: function(q_div, is_modified, is_disable) {
            if(typeof(q_div) != 'undefined' && !IsNothing(q_div)) {
                let question_submit_button = q_div.getElementsByClassName('question_submit')[0];
                if(typeof(question_submit_button) != 'undefined') {
                    question_submit_button.disabled = is_disable;
                    var wantModified = is_modified === true || is_modified === undefined;
                    // 幂等：仅当目标状态与当前不一致时才替换 innerHTML/class，避免失焦或重复更新时替换按钮 DOM 导致点击失效
                    var hasPrimary = question_submit_button.classList.contains('btn-primary');
                    if (wantModified !== hasPrimary) {
                        if (wantModified) {
                            question_submit_button.innerHTML = '<i class="bi bi-save"></i><span class="cn-text">保存</span><span class="en-text">Save Answer</span>';
                            question_submit_button.classList.remove('btn-success', 'btn-secondary');
                            question_submit_button.classList.add('btn-primary');
                        } else {
                            question_submit_button.innerHTML = '<i class="bi bi-save"></i><span class="cn-text">已存</span><span class="en-text">Saved</span>';
                            question_submit_button.classList.remove('btn-primary', 'btn-secondary');
                            question_submit_button.classList.add('btn-success');
                        }
                    }
                    var modStr = is_modified === true ? 'true' : 'false';
                    if (q_div.getAttribute('data-modified') !== modStr) {
                        q_div.setAttribute('data-modified', modStr);
                    }
                }
            }
        },
        IsQuestionDisabled: function(question) {
            // examinee_defunct 全局变量在主页面定义
            return (typeof examinee_defunct) != 'undefined' && examinee_defunct == 'Y' || question?.disabled == true;
        }
    },
    // **************************************************
    // 显示题目参考答案
    ans: {
        Render: function(question, q_div=null) {
            if(q_div == null) {
                q_div = this.GetDiv(question.ex_question_id);
            }
            const qid = question?.ex_question_id;
            if (!qid || !q_div) return;

            // 1) 左右元信息区：左（评分标准/评分建议），右（答案解析）
            const metaLeft = q_div.querySelector(`#answer_meta_left_div_${qid}`);
            if (metaLeft) metaLeft.innerHTML = ProcessMetaLeftHtml(question);
            const metaRight = q_div.querySelector(`#answer_meta_right_div_${qid}`);
            if (metaRight) metaRight.innerHTML = ProcessMetaRightHtml(question);
            try {
                // 仅在“应当有内容却缺少容器”时提示一次，避免静默丢失
                if (!q_div.dataset.reviewMetaWarned) {
                    const hasPrule = !!(question?.prule && String(question.prule).trim());
                    const hasExplainField = ('answer_explain' in (question || {})) && (question.answer_explain !== null && question.answer_explain !== undefined);
                    if ((hasPrule || hasExplainField) && (!metaLeft || !metaRight)) {
                        console.warn('[review] meta container missing', {
                            qid,
                            pkind: question?.pkind,
                            hasPrule,
                            hasAnswerExplain: hasExplainField,
                            hasMetaLeft: !!metaLeft,
                            hasMetaRight: !!metaRight,
                        });
                        q_div.dataset.reviewMetaWarned = '1';
                    }
                }
            } catch (e) {}

            // 2) 左右对照区：按题/按小题拆分的参考答案
            const slots = q_div.querySelectorAll(`.ref-answer-slot[data-qid="${qid}"]`);
            if (slots && slots.length > 0) {
                slots.forEach(slot => {
                    const subq = slot.getAttribute('data-subq');
                    slot.innerHTML = ProcessRefAnswerHtml(question, subq);
                    // ProcessRefAnswerHtml 使用同步 MarkdownParse，会输出 vditor-placeholder；需异步替换为真实渲染
                    processVditorPlaceholders(slot);
                });
                return;
            }

            // 不再兼容旧结构：缺少对照 slot 说明该题型的 show 模式 HTML 未按约定生成
            throw new Error(`ref-answer-slot not found for question(qid=${qid}, pkind=${question?.pkind})`);
        }
    },
    review: {
        Render: function(question, q_div, asheet_single=null) {
            let review_div = q_div.getElementsByClassName('review_div')[0];

            let review_html;
            // 优先复用阅卷页的统一判定（与题目导航/禁评阅一致）
            // - 解决：编程题“有提交(pass_rate>0)但 asheet 缺失”时，页面误显示“未作答”
            // - 以及：综合题 text 为空但 images 有上传时的误判风险
            let isEffectivelyBlank = null;
            try {
                const qid = question?.ex_question_id;
                if (qid && typeof GetQuestionScore === 'function' && typeof examinee_id_now !== 'undefined' && examinee_id_now) {
                    const si = GetQuestionScore(examinee_id_now, qid);
                    if (si && typeof si.score_type === 'string') {
                        isEffectivelyBlank = (si.score_type === 'blank');
                    }
                }
            } catch (e) {}

            if (isEffectivelyBlank === null) isEffectivelyBlank = (() => {
                if (typeof(asheet_single) == 'undefined' || IsNothing(asheet_single) || Object.keys(asheet_single).length == 0) return true;
                // 缺少有效答卷记录（后端可能填充空对象）
                if (!asheet_single.ex_asheet_id) return true;
                // 解析 submission
                let sub = asheet_single.submission;
                if (sub === null || typeof sub === 'undefined') return true;
                if (typeof sub === 'string') {
                    try { sub = JSON.parse(sub); } catch (e) { return true; }
                }
                const pk = parseInt(question?.pkind);
                if (Number.isNaN(pk)) return false;
                // 客观题：数组为空视作未作答
                if (pk < 10) return (!Array.isArray(sub) || sub.length === 0);
                // 填空：全部为空视作未作答
                if (pk === 10) return (!Array.isArray(sub) || sub.every(v => String(v ?? '').trim() === ''));
                // 简答：text/images 均为空视作未作答
                if (pk === 15) {
                    const texts = Array.isArray(sub.text) ? sub.text : [];
                    const imgs = (Array.isArray(sub.images) && Array.isArray(sub.images[0])) ? sub.images[0] : [];
                    const hasText = texts.some(v => String(v ?? '').trim() !== '');
                    const hasImg = imgs.some(v => String(v ?? '').trim() !== '');
                    return !hasText && !hasImg;
                }
                // 综合：所有小题 text/images 均为空视作未作答
                if (pk === 20) {
                    const texts = Array.isArray(sub.text) ? sub.text : [];
                    const imgsAll = Array.isArray(sub.images) ? sub.images : [];
                    const hasText = texts.some(v => String(v ?? '').trim() !== '');
                    const hasImg = imgsAll.some(row => Array.isArray(row) && row.some(v => String(v ?? '').trim() !== ''));
                    return !hasText && !hasImg;
                }
                return false;
            })();

            if(isEffectivelyBlank) {
                review_html = `
                    <div class="review-unanswered-alert alert alert-danger d-flex align-items-start gap-2 mt-2 mb-0" role="alert">
                        <i class="bi bi-exclamation-triangle-fill mt-1" aria-hidden="true"></i>
                        <div class="bilingual-inline">
                            <div class="fw-bold">该生未作答该题，默认0分</div>
                            <div class="en-text">Not answered, 0 points by default</div>
                        </div>
                    </div>
                `;
            } else {
                review_html = this.GetReviewHtml(question, asheet_single, false);
            }
            review_div.innerHTML = review_html
        },
        GetProResultShowHtml: function(asheet_single) {
            // 编程题：展示评测结果入口（用于放到“打分”label 右侧）
            if (!asheet_single?.submission?.result) return '';
            const sid = asheet_single?.submission?.solution_id;
            const res = asheet_single?.submission?.result;
            if (!sid || typeof res === 'undefined' || res === null) return '';
            const info_content = `sid="${sid}" res="${res}"`;
            switch (res) {
                case 4:  return `<a href="javascript:void(0)" class="pro_result_show text-success" ${info_content}>题目通过 A C</a>`;
                case 5:  return `<a href="javascript:void(0)" class="pro_result_show text-danger"  ${info_content}>格式错误 P E</a>`;
                case 6:  return `<a href="javascript:void(0)" class="pro_result_show text-danger"  ${info_content}>输出错误 W A</a>`;
                case 7:  return `<a href="javascript:void(0)" class="pro_result_show text-warning" ${info_content}>时间超限 TLE</a>`;
                case 8:  return `<a href="javascript:void(0)" class="pro_result_show text-warning" ${info_content}>内存超限 MLE</a>`;
                case 9:  return `<a href="javascript:void(0)" class="pro_result_show text-warning" ${info_content}>输出过多 OLE</a>`;
                case 10: return `<a href="javascript:void(0)" class="pro_result_show text-warning" ${info_content}>运行错误 R E</a>`;
                case 11: return `<a href="javascript:void(0)" class="pro_result_show text-info"    ${info_content}>编译错误 C E</a>`;
                case 0:  return `<a href="javascript:void(0)" class="pro_result_show text-default" ${info_content}>等待评测 P D</a>`;
                case 1:  return `<a href="javascript:void(0)" class="pro_result_show text-default" ${info_content}>等待重测 P R</a>`;
                case 2:  return `<a href="javascript:void(0)" class="pro_result_show text-default" ${info_content}>正在编译 C I</a>`;
                case 3:  return `<a href="javascript:void(0)" class="pro_result_show text-info"    ${info_content}>正在运行 R J</a>`;
            }
            return '';
        },
        ScorePanel: function(question, asheet_single, show=false) {
            let content = GetRealSubScore(question);
            let notes = GetNoteWithScore(asheet_single);
            let score = 'score' in asheet_single && asheet_single.score != null ? asheet_single.score : '';
            function SubScore(sc){return typeof(sc) == 'undefined' || sc == -1 ? '' : sc;}
            const score_fast_btn = `<div class="btn-group">
                <button class="btn_fast_score btn btn-xs btn-outline-danger" vl="-1000"> |&lt;</button>
                <button class="btn_fast_score btn btn-xs btn-outline-danger" vl="-3"> &lt;&lt;</button>
                <button class="btn_fast_score btn btn-xs btn-outline-danger" vl="-0.5"> &lt;</button>
                <button class="btn_fast_score btn btn-xs btn-outline-info" vl="hf"> ||</button>
                <button class="btn_fast_score btn btn-xs btn-outline-success" vl="0.5">&gt;</button>
                <button class="btn_fast_score btn btn-xs btn-outline-success" vl="3">&gt;&gt;</button>
                <button class="btn_fast_score btn btn-xs btn-outline-success" vl="1000">&gt;|</button>
                </div>`;
            if(show) {
                if(question.pkind == 20) {
                    let ret = '';
                    for(let i = 0; i < content.length; i ++) {
                        ret += `${i + 1}. <span class='text-red'>${SubScore(notes?.score?.[i])}</span> / ${content[i].sub_pscore}`;
                    }
                    return ret;
                } else {
                    return `<span class='text-red'>${asheet_single.score}</span>`;
                }
                
            } else {
                if(question.pkind == 20) {
                    let ret = '';
                    for(let i = 0; i < content.length; i ++) {
                        let sub_score = notes?.score?.[i];
                        if(typeof(sub_score) == 'undefined' || sub_score == -1) {
                            sub_score = '';
                        }
                        const idAttr = (i === 0) ? `id="review_score_qid_${question.ex_question_id}"` : '';
                        ret += `
                        <div class="review-subscore-item" data-qid="${question.ex_question_id}" data-subq="${i}">
                            <div class="text-muted small">(${i + 1}) 满分<span class="text-danger">${content[i].sub_pscore}</span>分</div>
                            <div class="d-flex align-items-center gap-2 flex-wrap mt-1">
                                ${score_fast_btn}
                                <input ${idAttr} class="form-control form-control-sm text-end fw-semibold review_input review_score_input review_score_qid_${question.ex_question_id}" type="text" inputmode="decimal" autocomplete="off" placeholder="分数" qid="${question.ex_question_id}" q_sub_id="${i}" value="${sub_score}" q_score="${content[i].sub_pscore}">
                            </div>
                        </div>`;
                    }
                    return ret;
                }
                return `<div>
                ${score_fast_btn}
                <input id="review_score_qid_${question.ex_question_id}" class="form-control form-control-sm text-end fw-semibold review_input review_score_input review_score_qid_${question.ex_question_id}" type="text" inputmode="decimal" autocomplete="off" placeholder="分数" qid="${question.ex_question_id}" q_sub_id="0" value="${score}" q_score="${question.pscore}">
                </div>`;
            }
        },
        GetReviewHtml: function(question, asheet_single, show=false) {
            if(typeof(asheet_single) == 'undefined' || IsNothing(asheet_single) || Object.keys(asheet_single).length == 0) {
                asheet_single = {'notes': '', 'score': '', 'reviewer': '[None]'};
            }
            let rethtml = '';
            let notes = GetNoteWithScore(asheet_single);
            if(show) {
                let totalScore = question.pscore !== undefined && question.pscore !== null ? question.pscore : '';
                let scoreLabelText = totalScore !== '' ? `打分（满分${totalScore}分）：` : '打分：';
                rethtml += `
                <div class="mt-2 border rounded p-2">
                    <div class="mb-2">
                        <div class="text-muted small">评语</div>
                        <div class="text-red">${ConvertHtmlSafeProcess(notes.notes, true)}</div>
                    </div>
                    <div class="review_score_block border rounded p-2 bg-light">
                        <div class="text-muted small mb-1">${scoreLabelText}</div>
                        <div>${this.ScorePanel(question, asheet_single, show)}</div>
                    </div>
                    <div class="text-muted small mt-2">
                        评阅人：<a href='/${PAGE_MODULE}/contest/teaminfo?cid=${cid}&team_id=${asheet_single.reviewer}'>${asheet_single.reviewer}</a>
                    </div>
                </div>
                `;
            } else {
                if(asheet_single?.reviewer) {
                    if(asheet_single.reviewer.endsWith('#SYS')) {
                        rethtml += `评阅人：<a href='/csgoj/user/userinfo?user_id=${asheet_single.reviewer.replace("#SYS", "")}' target='_blank'>${asheet_single.reviewer}</a>`;
                    } else {
                        rethtml += `评阅人：<a href='/csgoj/contest/teaminfo?cid=${cid}&team_id=${asheet_single.reviewer}' target='_blank'>${asheet_single.reviewer}</a>`;
                    }            
                }
                let totalScore = question.pscore !== undefined && question.pscore !== null ? question.pscore : '';
                let scoreLabelText = totalScore !== '' ? `打分（满分${totalScore}分）` : '打分';
                const autoScoreTipHtml = (question.pkind <= 10)
                    ? `<div class="text-danger small mt-1">客观题会自动给分，也可进行打分覆盖自动分.</div>`
                    : '';
                const isComprehensive = (parseInt(question.pkind) === 20);
                const isProgramming = (parseInt(question.pkind) === 25);
                const proResultHtml = isProgramming ? this.GetProResultShowHtml(asheet_single) : '';
                const scorePanelHtml = (() => {
                    if (!isComprehensive) {
                        return `${this.ScorePanel(question, asheet_single, show)}${autoScoreTipHtml}`;
                    }
                    // 综合题：总区仅展示“每小题输入框”，与小题旁输入框双向同步（由 review_func.js 完成绑定）
                    let content = [];
                    try { content = GetRealSubScore(question) || []; } catch (e) { content = []; }
                    const mainQid = question.num || question.ex_question_id;
                    const items = content.map((it, i) => {
                        const max = (it && it.sub_pscore !== undefined && it.sub_pscore !== null) ? it.sub_pscore : '';
                        const subLabel = `${mainQid}(${i + 1})`;
                        const maxHtml = (max !== '' && max !== null && typeof max !== 'undefined')
                            ? `<span class="review-subscore-summary-max text-muted small" title="小题满分 / Full score">${max}分</span>`
                            : '';
                        return `<div class="review-subscore-summary-item">
                            <div class="review-subscore-summary-left">
                                <span class="review-subscore-summary-label" title="小题 ${i + 1} / Sub-question ${i + 1}">${subLabel}</span>
                                ${maxHtml}
                            </div>
                            <input class="form-control form-control-sm text-end fw-semibold review_input review_subscore_summary_input"
                                type="text" inputmode="decimal" autocomplete="off" placeholder="分"
                                qid="${question.ex_question_id}" q_sub_id="${i}" q_score="${max}">
                        </div>`;
                    }).join('');
                    return `
                        <div class="review-subscore-summary">
                            <div class="text-muted small mb-1">小题打分（可在此处或小题右侧修改）</div>
                            <div class="review-subscore-summary-grid">${items}</div>
                        </div>
                        <div class="d-none review-subscore-source">${this.ScorePanel(question, asheet_single, show)}</div>
                    `;
                })();
                rethtml += `
                <div class="mt-2 review-eval-wrap">
                    <div class="review-eval-left">
                        <div class="review_comment_block border rounded p-2 bg-light mb-2">
                            <div class="d-flex align-items-center justify-content-between gap-2 mb-1">
                                <label class="form-label mb-0" for="review_notes_qid_${question.ex_question_id}">评语</label>
                            </div>
                            <input class="form-control form-control-sm review_input review_notes_input" type="text" qid="${question.ex_question_id}" id="review_notes_qid_${question.ex_question_id}" value="${notes.notes}" placeholder="评语（可选）">
                        </div>
                        <div class="review_score_block border rounded p-2 bg-light">
                            <div class="d-flex align-items-center justify-content-between gap-2 mb-1">
                                <label class="form-label mb-0" for="review_score_qid_${question.ex_question_id}">${scoreLabelText}</label>
                                ${proResultHtml ? `<span class="small">${proResultHtml}</span>` : ''}
                            </div>
                            ${scorePanelHtml}
                        </div>
                    </div>
                    <div class="review-eval-right">
                        <button class="btn btn-primary btn-sm review_submit review-submit-vertical" type="button" qid="${question.ex_question_id}" title="保存本题的评分与评语 / Save score & comment for this question">
                            <i class="bi bi-save"></i>
                            <span class="review-save-warn-icon text-warning d-none" aria-hidden="true" title="尚有小题未打分 / Some sub-questions are not scored"><i class="bi bi-exclamation-triangle-fill"></i></span>
                            <span class="review-submit-text">保存评阅<span class="en-text">Save review</span></span>
                        </button>
                    </div>
                </div>
                `;
            }
            return rethtml;
        }
    }
};
// 将 QuestionRender 暴露到全局作用域
window.QuestionRender = QuestionRender;
} // 结束防重复加载检查

// 代码复制功能（参考答案和学生代码）
(function() {
    // 复制代码的通用函数
    async function copyCode(btn, codeContent) {
        if (!codeContent || codeContent.trim() === '') {
            if (typeof alerty !== 'undefined') {
                alerty.warn('没有可复制的代码', 'No code to copy');
            }
            return;
        }
        
        // 解码 HTML 实体
        const textarea = document.createElement('textarea');
        textarea.innerHTML = codeContent;
        const decodedCode = textarea.value;
        
        // 使用全局 ClipboardWrite 函数
        if (typeof ClipboardWrite !== 'undefined') {
            const success = await ClipboardWrite(decodedCode);
            if (success) {
                // 更新按钮图标显示成功状态
                const icon = btn.querySelector('i');
                if (icon) {
                    const originalClass = icon.className;
                    icon.className = 'bi bi-check';
                    btn.classList.add('text-success');
                    
                    setTimeout(() => {
                        icon.className = originalClass;
                        btn.classList.remove('text-success');
                    }, 1000);
                }
                
                if (typeof alerty !== 'undefined') {
                    alerty.success('代码已复制到剪贴板', 'Code copied to clipboard');
                }
            } else {
                if (typeof alerty !== 'undefined') {
                    alerty.error('复制失败，请手动选择代码复制', 'Copy failed, please manually select and copy the code');
                }
            }
        } else {
            if (typeof alerty !== 'undefined') {
                alerty.error('复制功能不可用', 'Copy function not available');
            }
        }
    }
    
    // 使用事件委托处理复制按钮点击
    document.addEventListener('click', async function(e) {
        // 参考答案复制按钮
        if (e.target.closest('.answer-code-copy-btn')) {
            e.preventDefault();
            e.stopPropagation();
            
            const btn = e.target.closest('.answer-code-copy-btn');
            const codeContent = btn.getAttribute('data-code-content');
            await copyCode(btn, codeContent);
        }
        
        // 学生代码复制按钮
        if (e.target.closest('.student-code-copy-btn')) {
            e.preventDefault();
            e.stopPropagation();
            
            const btn = e.target.closest('.student-code-copy-btn');
            const codeContent = btn.getAttribute('data-code-content');
            await copyCode(btn, codeContent);
        }
    });
})();

// 注意：已改用 jQuery 的 $.get，不再使用 fetch 和 __fetchBody
function GetRealSubScore(question, question_exam_pscore) {
    // 对于 pkind==20 综合题，计算各小题实际分数
    let content = question.content;
    if(typeof(content) == 'string') {
        try {
            content = JSON.parse(content);
        } catch(e) {
            alerty.alert(`获取题目数据失败: ${question.ex_question_id}`);
            return;
        }
    }
    let sum_sub_pscore = 0;
    for(let i = 0; i < content.length; i ++) {
        let sub_pscore;
        if(i >= content.length) {
            alerty.alert(`题目数据已更新，请刷新重试`);
            return;
        } else if(i == content.length - 1) {
            // 最后一小题分数为题目总分减去前面小题的分数
            sub_pscore = Math.max(question.pscore - sum_sub_pscore, 0);
        } else {
            // 前面的小题：根据比例计算，然后四舍五入到最接近的0.5分
            sub_pscore = content[i].score_ratio / 100 * question.pscore;
            // 四舍五入到最接近的0.5分：乘以2，四舍五入，再除以2
            sub_pscore = Math.round(sub_pscore * 2) / 2;
            // 确保不超过剩余分数
            sub_pscore = Math.max(Math.min(sub_pscore, question.pscore - sum_sub_pscore), 0);
            sum_sub_pscore += sub_pscore;
        }
        // 确保分数格式正确（如果是整数，显示为整数；如果是0.5的倍数，显示为1位小数）
        if(sub_pscore % 1 === 0) {
            content[i].sub_pscore = sub_pscore;
        } else {
            content[i].sub_pscore = parseFloat(sub_pscore.toFixed(1));
        }
    }
    return content;
}
function GetNoteWithScore(asheet_single) {
    // 转换asheet中的notes. 主要针对pkind==20这样的分小题.
    let notes = asheet_single?.notes;
    if(typeof(notes) == 'string' || notes == null || typeof(notes) == 'undefined') {
        try{
            notes = JSON.parse(notes);
            if(notes === null || typeof(notes) == 'undefined') {
                notes = {'notes': ''};
            }
        } catch(e) {
            notes = {'notes': ''};
        }
    }
    return notes;
}
function GetNewerAsheetSingle(asheet, asheet_tmp, ex_question_id, asheet_single=null) {
    // 获取已保存的和当前调整后答卷中最新的一个版本
    if(!IsNothing(asheet_single)) {
        return asheet_single;
    }
    asheet_single = asheet?.[ex_question_id];
    let asheet_tmp_single = asheet_tmp?.[ex_question_id];
    if(IsNothing(asheet_single)) {
        asheet_single = asheet_tmp_single;
    } else if(!IsNothing(asheet_tmp_single && asheet_tmp_single.update_at > asheet_single.update_at)) {
        asheet_single = asheet_tmp_single;
    }
    if(IsNothing(asheet_single)) {
        asheet_single = {};
    }
    return asheet_single;
}
function GetDetailHtml(row, problemset, show=false) {
    // show 表示展示而非提供填写
    return QuestionRender.html.Get(row, null, show, row.pkind == 25 ? problemset[row.description] : null);
}
function GetDetailDom(row, problemset, asheet_single=null, show=false, asheet_display=false, disable_display=false, answer_display=false, review_display=false, math_process=false) {
    let html_dom = $(GetDetailHtml(row, problemset, show)).get(0);
    if(math_process == true) {
        // 使用全局的数学公式处理函数（math.js 已全局引入）
        MathDomProcess(null, [html_dom], html_dom);
    }
    if(asheet_display) {
        QuestionRender.asheet.Render(
            row,                // question
            html_dom,           // q_div
            show,               // show
            asheet_single       // asheet_single
        );
    }
    if(disable_display) {
        QuestionRender.dis.Render(
            row,                // question
            html_dom,           // q_div
            null                // is_disable
        );
    }
    if(answer_display) {
        QuestionRender.ans.Render(row, html_dom);
    }
    if(review_display) {
        QuestionRender.review.Render(row, html_dom, asheet_single);
    }
    return html_dom;
}
