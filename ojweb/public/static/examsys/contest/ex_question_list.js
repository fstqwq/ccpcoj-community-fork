// 考试页面题目列表渲染 - 重构版本
// 不再使用 Bootstrap Table，直接渲染题目到页面
// 支持视口懒加载和右侧悬浮导航菜单
// 注意：PAGE_MODULE 常量在 ex_global.js 中定义

// 全局变量
let loading_div = $('#loading_div');
let asheet = {}, asheet_tmp = {};   // asheet 已保存的答卷， asheet_tmp 当前修改过的答卷
let problemset = {};    // 编程题
let allow_lang = {};
let question_list = [];  // 题目列表
let question_map = {};  // 映射 ex_question_id -> question
let contest_user;
let cid;
let examinee_defunct;
let allow_lang_key;
let allow_lang_val;
let markdown_editor;
let vditorSingleton = null;
let is_admin = false; // 是否为管理员

// -----------------------------
// 题目导航：自动定位逻辑（保留，供通用模块调用）
// -----------------------------

// 同步离开提醒开关：仅当确实有未保存修改时才提示
function syncBeforeUnloadFlag() {
    try {
        let hasUnsavedChanges = false;
        
        // 优先使用 JudgeSaved 判断（基于 asheet_tmp 对比）
        // 所有依赖已全局引入，直接使用
        const modifiedList = JudgeSaved();
        // JudgeSaved 返回 true 表示没有修改，返回非空数组表示有修改
        if (modifiedList !== true && Array.isArray(modifiedList) && modifiedList.length > 0) {
            hasUnsavedChanges = true;
        }
        
        // 检查 DOM 中是否有标记为已修改的题目
        if (!hasUnsavedChanges) {
            hasUnsavedChanges = !!document.querySelector('.question_div[data-modified="true"]');
        }
        
        window.skipBeforeUnload = !hasUnsavedChanges;
    } catch (e) {
        window.skipBeforeUnload = false;
    }
}

// 懒加载相关
let visibleRange = { start: 0, end: 0 };
let renderedQuestions = new Set(); // 已渲染的题目ID
let questionElements = {}; // 题目DOM元素映射
let renderedSections = new Set(); // 已渲染的大题类型
const LAZY_LOAD_BUFFER = 3; // 视口外额外加载的题目数量

// 导航菜单相关（已迁移到通用模块）

// 大题统计相关
let sectionStats = {}; // { pkind: { count, index } }
let sectionIndexMap = {}; // pkind -> index
let currentMdEdit = null; // {qid, subq}
let modalDragInitialized = false; // Modal 拖拽功能是否已初始化

// 注意：renderMdPreview 函数已移至 question_md_utils.js

// 读取 Vditor 单例的当前内容
async function getMarkdownEditorValue() {
    try {
        // 所有依赖已全局引入，直接使用
        if (markdown_editor && markdown_editor.getInstance) {
            const inst = markdown_editor.getInstance();
            if (inst?.getValue) return inst.getValue() || '';
        }
        // 所有依赖已全局引入，直接使用
        if (markdown_editor && markdown_editor.ready && markdown_editor.ready.then) {
            const inst = await markdown_editor.ready;
            if (inst?.getValue) return inst.getValue() || '';
        }
    } catch (e) {}
    return '';
}

/**
 * 获取中文序号（一、二、三...）
 */
function getChineseNumber(num) {
    const table = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十',
        '十一', '十二', '十三', '十四', '十五', '十六', '十七', '十八', '十九', '二十'];
    if (num <= 20) return table[num] || `${num}`;
    return `${num}`;
}

/**
 * 统计每个题型的题目数量并分配序号
 */
function calculateSectionStats() {
    sectionStats = {};
    sectionIndexMap = {};
    // 计数和计算总分
    question_list.forEach(q => {
        const pk = q.pkind;
        if (!sectionStats[pk]) {
            sectionStats[pk] = { count: 0, pkind: pk, totalScore: 0 };
        }
        sectionStats[pk].count += 1;
        // 累加题目分数
        const pscore = q.pscore;
        if (pscore !== undefined && pscore !== null && pscore !== '') {
            const score = parseFloat(pscore);
            if (!isNaN(score)) {
                sectionStats[pk].totalScore += score;
            }
        }
    });
    // 按 pkind 排序分配序号
    Object.keys(sectionStats).map(Number).sort((a, b) => a - b).forEach((pk, idx) => {
        sectionStats[pk].index = idx + 1;
        sectionIndexMap[pk] = idx + 1;
    });
}

/**
 * 初始化页面信息
 */
function InitPageInfo() {
    if (!window.examProblemsetConfig) {
        console.error('window.examProblemsetConfig is not defined');
        return;
    }
    contest_user = window.examProblemsetConfig.contest_user || '';
    cid = window.examProblemsetConfig.cid || '';
    examinee_defunct = window.examProblemsetConfig.examinee_defunct || 'N';
    is_admin = window.examProblemsetConfig.is_admin === '1';
    // IndexedDB 异步读取本地答卷缓存（由调用方 await）
}

/**
 * 初始化允许的语言
 */
function InitAllowLang() {
    if (!window.examProblemsetConfig) {
        console.error('window.examProblemsetConfig is not defined');
        return;
    }
    const config = window.examProblemsetConfig;
    const langKeyStr = config.allow_lang_key || '';
    const langValStr = config.allow_lang_val || '';
    allow_lang_key = langKeyStr ? langKeyStr.split(',') : [];
    allow_lang_val = langValStr ? langValStr.split(',') : [];
    for(let i in allow_lang_key) {
        allow_lang[allow_lang_key[i]] = allow_lang_val[i];
    }
}

/**
 * 获取题目状态
 * @param {Object} question - 题目对象
 * @returns {string} 状态：'empty' | 'saved' | 'unsaved'
 */
function getQuestionStatus(question) {
    const ex_question_id = question.ex_question_id;
    const hasAnswer = ex_question_id in asheet;
    const hasTmp = ex_question_id in asheet_tmp;
    
    if (!hasAnswer && !hasTmp) {
        return 'empty';
    }
    
    // 如果只有 asheet_tmp（填写了但从未提交过），算作未答题
    if (hasTmp && !hasAnswer) {
        return 'empty';
    }
    
    // 如果已提交过（hasAnswer），且有未保存的修改
    if (hasTmp && hasAnswer && asheet_tmp[ex_question_id].update_at > asheet[ex_question_id].update_at) {
        return 'unsaved';
    }
    
    return 'saved';
}

/**
 * 获取题目状态图标HTML
 * @param {string} status - 状态
 * @returns {string} HTML字符串
 */
function getStatusIcon(status) {
    switch(status) {
        case 'unsaved':
            return '<i class="bi bi-file-diff-fill" title="有未保存的修改"></i>';
        case 'saved':
            return '<i class="bi bi-save" title="已保存"></i>';
        default:
            return '';
    }
}

/**
 * 获取题型中文名称
 * @param {number} pkind - 题型编号
 * @returns {string} 题型名称
 */
function getPkindName(pkind) {
    return question_default.pkind_table_cn[pkind];
}

/**
 * 获取题型颜色
 * @param {number} pkind - 题型编号
 * @returns {string} 颜色值
 */
function getPkindColor(pkind) {
    return question_default.pkind_color[pkind];
}

/**
 * 更新 Markdown 编辑器标题栏的题目信息
 * @param {number} ex_question_id - 题目ID
 */
function updateMarkdownEditorTitle(ex_question_id) {
    const question = question_map[ex_question_id];
    const questionInfoEl = document.getElementById('md_question_info');
    const questionNumBadge = document.getElementById('md_question_num_badge');
    const questionTitleText = document.getElementById('md_question_title_text');
    
    if (question && questionInfoEl && questionNumBadge && questionTitleText) {
        // 显示题目信息区域
        questionInfoEl.style.display = 'flex';
        
        // 设置题目序号
        const questionNum = question.num || ex_question_id;
        questionNumBadge.textContent = questionNum;
        questionNumBadge.setAttribute('title', `题目序号: ${questionNum} / Question Number: ${questionNum}`);
        
        // 设置题目标题
        const titlePreview = getQuestionTitlePreview(question);
        // 限制标题长度，避免过长
        const maxTitleLength = 50;
        const displayTitle = titlePreview.length > maxTitleLength 
            ? titlePreview.substring(0, maxTitleLength) + '...' 
            : titlePreview;
        questionTitleText.textContent = displayTitle;
        questionTitleText.setAttribute('title', `题目: ${titlePreview} / Question: ${titlePreview}`);
    } else if (questionInfoEl) {
        // 如果没有题目信息，隐藏题目信息区域
        questionInfoEl.style.display = 'none';
    }
}

/**
 * 获取题目标题预览（前30个字符）
 * @param {Object} question - 题目对象
 * @returns {string} 标题预览
 */
function getQuestionTitlePreview(question) {
    let title = '';
    if (question.pkind == 25 && problemset[question.description]) {
        title = problemset[question.description].title || '';
    } else {
        title = GetFakeTitle(question);
    }
    if (title.length > 30) {
        title = title.substring(0, 30) + '...';
    }
    return title || '无标题';
}

/**
 * 渲染单个题目 - 简化版本，直接使用已有的渲染函数
 * @param {Object} question - 题目对象
 * @param {number} index - 题目索引
 * @param {number} questionNum - 题目序号（从1开始）
 * @returns {HTMLElement} 题目DOM元素
 */
function renderQuestion(question, index, questionNum) {
    const ex_question_id = question.ex_question_id;
    
    // 如果已渲染，直接返回
    if (questionElements[ex_question_id]) {
        return questionElements[ex_question_id];
    }
    
    // 直接使用已有的 GetDetailDom 函数渲染
    const questionDiv = GetDetailDom(
        question,           // row
        problemset,         // problemset
        null,               // asheet_single
        false,              // show
        true,               // asheet_display
        true,               // disable_display
        false,              // answer_display
        false,              // review_display
        false               // math_process (稍后单独处理)
    );
    
    // 设置索引属性
    questionDiv.setAttribute('data-question-index', index);
    questionDiv.setAttribute('data-question-id', ex_question_id);
    
    // 添加题目序号、美化，并将保存按钮放在题号右侧
    const headerTarget = questionDiv.querySelector('.question_header_slot') 
        || questionDiv.querySelector('h3') 
        || questionDiv.querySelector('span:first-child');
    const submitContainer = questionDiv.querySelector('.question_submit_container');
    if (headerTarget) {
        const pkColor = getPkindColor(question.pkind);
        const pkName = getPkindName(question.pkind);
        // 使用 pscore 字段（题目分数）
        const scoreVal = (question.pscore !== undefined && question.pscore !== null && question.pscore !== '') ? question.pscore : '';
        const badge = `<span class="question-number-badge" title="${pkName}" style="background-color:${pkColor};">${questionNum}</span>`;
        const idBadge = is_admin ? `<span class="question-id-badge">ID:${ex_question_id}</span>` : '';
        const originalHtml = headerTarget.innerHTML.replace(/^\d+\.\s*/, '');
        
        // 重排：题号栏（题号 + ID + 分数靠右）+ 按钮 + 标题文本
        headerTarget.innerHTML = '';
        headerTarget.style.display = 'flex';
        headerTarget.style.alignItems = 'center';
        headerTarget.style.flexWrap = 'wrap';
        headerTarget.style.gap = '8px';

        // 题号栏容器（包含题号、ID、分数）
        const numContainer = document.createElement('div');
        numContainer.style.display = 'flex';
        numContainer.style.alignItems = 'center';
        numContainer.style.gap = '8px';
        numContainer.style.flex = '1';
        numContainer.style.minWidth = '0';
        
        // 题号和ID部分
        const numPart = document.createElement('span');
        numPart.style.display = 'flex';
        numPart.style.alignItems = 'center';
        numPart.style.gap = '8px';
        numPart.className = 'question-number-part';
        numPart.innerHTML = `${badge}${idBadge}`;
        numContainer.appendChild(numPart);
        
        // 保存提醒占位：应显示在"分数"右侧（不要夹在题号与分数之间）
        const reminderSlotInline = document.createElement('div');
        reminderSlotInline.className = 'save-reminder-slot-inline';
        reminderSlotInline.style.display = 'none'; // 默认隐藏，由 question_interaction.js 控制显示
        
        // 分数部分（在题号右侧）
        if (scoreVal !== '') {
            const scorePart = document.createElement('span');
            scorePart.className = 'question-score-badge';
            scorePart.innerHTML = `<span class="badge bg-info">${scoreVal}分<span class="en-text">pts</span></span>`;
            numPart.appendChild(scorePart);
        }
        
        // 附加题标识（如果是最后一道题且考试有附加题）
        const hasAdditional = !!(window.examProblemsetConfig && window.examProblemsetConfig.has_additional === '1');
        const isLastQuestion = !!(question.is_last_question === true);
        if (isLastQuestion && hasAdditional) {
            const additionalBadge = document.createElement('span');
            additionalBadge.className = 'badge bg-warning text-dark ms-2 bilingual-inline';
            additionalBadge.innerHTML = '附加题<span class="en-text">Additional</span>';
            numPart.appendChild(additionalBadge);
        }
        
        // 提醒信息放在分数右边（若无分数则放在题号右边）
        numPart.appendChild(reminderSlotInline);
        
        headerTarget.appendChild(numContainer);

        if (submitContainer) {
            submitContainer.classList.add('question-submit-inline');
            headerTarget.appendChild(submitContainer);
        }

        const descSpan = document.createElement('span');
        descSpan.style.flex = '1 1 100%';
        descSpan.style.minWidth = '0';
        descSpan.innerHTML = originalHtml;
        headerTarget.appendChild(descSpan);
    }

    // 保存提醒占位：保留旧位置用于兼容，但主要使用 inline 位置
    let reminderSlot = questionDiv.querySelector('.save-reminder-slot');
    if (!reminderSlot) {
        reminderSlot = document.createElement('div');
        reminderSlot.className = 'save-reminder-slot mt-2';
        reminderSlot.style.display = 'none'; // 默认隐藏，使用 inline 位置
        const headerParent = headerTarget?.parentNode || questionDiv;
        if (headerParent && headerParent.parentNode) {
            headerParent.parentNode.insertBefore(reminderSlot, headerParent.nextSibling);
        } else {
            questionDiv.appendChild(reminderSlot);
        }
    }
    
    // 修复保存按钮初始状态：如果题目未作答，不显示"已保存"
    const submitButton = questionDiv.querySelector('.question_submit');
    if (submitButton) {
        const hasAnswer = ex_question_id in asheet;
        const hasTmp = ex_question_id in asheet_tmp;
        if (!hasAnswer && !hasTmp) {
            // 未作答：显示"保存答案"，使用 btn-primary（蓝色）
            submitButton.innerHTML = '<i class="bi bi-save"></i><span class="cn-text">保存答案</span><span class="en-text">Save Answer</span>';
            submitButton.classList.remove('btn-success', 'btn-secondary');
            submitButton.classList.add('btn-primary');
            questionDiv.setAttribute('data-modified', 'false');
        } else {
            // 已作答：根据是否有未保存修改来决定状态
            // 这里使用 QuestionRender.dis.SubmitButtonStatus 来统一处理
            if(typeof QuestionRender !== 'undefined' && QuestionRender.dis && QuestionRender.dis.SubmitButtonStatus) {
                const question = question_map?.[ex_question_id];
                const is_modified = question?.modified === true;
                const is_disable = question ? QuestionRender.dis.IsQuestionDisabled(question) : false;
                QuestionRender.dis.SubmitButtonStatus(questionDiv, is_modified, is_disable);
            }
        }
    }
    
    // 异步渲染Markdown和数学公式
    renderMarkdownInQuestion(questionDiv).then(() => {
        // 所有依赖已全局引入，直接使用
        MathRender('.marked_math_div', questionDiv, true);
    });
    // 渲染初始答案预览（隐藏域里的值）
    const hiddenInputs = questionDiv.querySelectorAll('.md-hidden-input');
    hiddenInputs.forEach(input => {
        const qid = input.getAttribute('data-qid');
        const subq = input.getAttribute('data-subq') || '0';
        const preview = questionDiv.querySelector(`.md-answer-preview[data-qid="${qid}"][data-subq="${subq}"]`);
        const val = input.value || input.getAttribute('data-initial-md') || '';
        if (preview) renderMdPreview(preview, val);
    });

    // 初始化预览内容
    const previews = questionDiv.querySelectorAll('.md-answer-preview');
    previews.forEach(p => {
        const md = p.getAttribute('data-initial-md') || '';
        renderMdPreview(p, md);
    });
    
    // 缓存元素
    questionElements[ex_question_id] = questionDiv;
    renderedQuestions.add(ex_question_id);
    
    return questionDiv;
}

/**
 * 异步渲染题目中的Markdown内容
 * @param {HTMLElement} questionDiv - 题目容器元素
 */
function renderMarkdownInQuestion(questionDiv) {
    if (!questionDiv) return Promise.resolve();
    
    const placeholders = Array.from(questionDiv.querySelectorAll('.vditor-placeholder'));
    if (placeholders.length === 0) return Promise.resolve();
    
    const decodeHtml = (str) => {
        if (!str) return '';
        return str
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&amp;/g, '&')
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'");
    };
    
    const renderPromises = placeholders.map(async (placeholder) => {
        const encodedMd = placeholder.getAttribute('data-md');
        if (!encodedMd) return;
        
        const md = decodeHtml(encodedMd);
        if (!md || md.trim() === '') return;
        
        const tempDiv = document.createElement('div');
        tempDiv.className = 'vditor-preview-container';
        
        if (!placeholder.parentNode) return;
        placeholder.parentNode.replaceChild(tempDiv, placeholder);
        
        // 所有依赖已全局引入，直接使用
        if (typeof CsgVditor !== 'undefined' && CsgVditor.render) {
            CsgVditor.render({
                el: tempDiv,
                markdown: md
            });
            
            // 等待 Vditor 渲染完成后再渲染数学公式
            // 使用 Promise 确保数学公式渲染在 Markdown 渲染完成后进行
            return new Promise((resolve) => {
                setTimeout(() => {
                    // 渲染数学公式（使用 KaTeX auto-render 扩展）
                    if (typeof renderMathInElement !== 'undefined' && typeof katex !== 'undefined') {
                        try {
                            renderMathInElement(tempDiv, {
                                delimiters: [
                                    {left: "$$", right: "$$", display: true},
                                    {left: "$", right: "$", display: false},
                                    {left: "\\[", right: "\\]", display: true},
                                    {left: "\\(", right: "\\)", display: false}
                                ],
                                throwOnError: false,
                                // 不忽略任何标签，确保所有数学公式都被渲染
                                ignoredTags: []
                            });
                        } catch (e) {
                            console.warn('KaTeX auto-render failed in renderMarkdownInQuestion:', e);
                        }
                    }
                    resolve();
                }, 100);
            });
        } else {
            // 后备方案：直接显示文本
            tempDiv.textContent = md;
            return Promise.resolve();
        }
    });
    
    return Promise.all(renderPromises);
}


/**
 * 更新可见范围并渲染题目 - 简化版本
 */
function updateVisibleRange() {
    if (question_list.length === 0) return;
    
    const viewportTop = window.scrollY;
    const viewportBottom = viewportTop + window.innerHeight;
    const buffer = 500;
    
    // 计算可见范围
    let start = 0;
    let end = question_list.length;
    
    // 如果还没有渲染任何题目，直接渲染前10题
    if (renderedQuestions.size === 0) {
        start = 0;
        end = Math.min(question_list.length, 10);
    } else {
        // 找到第一个可见的题目
        for (let i = 0; i < question_list.length; i++) {
            const element = questionElements[question_list[i].ex_question_id];
            if (element && element.parentNode) {
                const rect = element.getBoundingClientRect();
                if (rect.bottom >= viewportTop - buffer) {
                    start = Math.max(0, i - LAZY_LOAD_BUFFER);
                    break;
                }
            }
        }
        
        // 找到最后一个可见的题目
        for (let i = question_list.length - 1; i >= 0; i--) {
            const element = questionElements[question_list[i].ex_question_id];
            if (element && element.parentNode) {
                const rect = element.getBoundingClientRect();
                if (rect.top <= viewportBottom + buffer) {
                    end = Math.min(question_list.length, i + 1 + LAZY_LOAD_BUFFER);
                    break;
                }
            }
        }
    }
    
    visibleRange.start = start;
    visibleRange.end = end;
    
    // 渲染可见范围内的题目
    renderVisibleQuestions();
}

/**
 * 渲染可见范围内的题目 - 支持大题分组和题目序号
 */
function renderVisibleQuestions() {
    const container = document.getElementById('question_list_container');
    if (!container) return;
    
    // 一次性按顺序渲染所有题目，保证编号连续和大标题位置正确
    for (let i = 0; i < question_list.length; i++) {
        const question = question_list[i];
        const ex_question_id = question.ex_question_id;
        
        // 大标题（每个 pkind 只插一次），按顺序追加
        if (!renderedSections.has(question.pkind)) {
            const pkindName = question_default.pkind_table_cn[question.pkind];
            const pkindNameEn = question_default.pkind_table_en[question.pkind];
            const pkindColor = question_default.pkind_color[question.pkind];
            const sectionInfo = sectionStats[question.pkind];
            const sectionIndex = sectionInfo ? sectionInfo.index : 1;
            const questionCount = sectionInfo ? sectionInfo.count : 0;
            const totalScore = sectionInfo ? sectionInfo.totalScore : 0;
            const chineseIndex = getChineseNumber(sectionIndex);
            const romanIndex = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'][sectionIndex] || sectionIndex;
            
            // 格式化分数显示（如果是整数则不显示小数）
            const scoreText = totalScore > 0 
                ? (totalScore % 1 === 0 ? totalScore : totalScore.toFixed(1))
                : '0';

            const sectionHeader = document.createElement('div');
            sectionHeader.className = 'question-section-header';
            sectionHeader.style.borderLeftColor = pkindColor;
            sectionHeader.innerHTML = `
                <div class="d-flex align-items-center justify-content-between">
                    <div class="d-flex align-items-center">
                        <div class="section-title-badge" style="background-color: ${pkindColor};"></div>
                        <h4 class="mb-0 ms-2">${chineseIndex}、${pkindName}<span class="en-text">${romanIndex}. ${pkindNameEn}</span></h4>
                    </div>
                    <span class="section-question-count text-muted bilingual-inline">共${questionCount}题，总分：${scoreText}分<span class="en-text">${questionCount} Qs, Total: ${scoreText} Pts</span></span>
                </div>
            `;
            sectionHeader.setAttribute('data-pkind', question.pkind);
            renderedSections.add(question.pkind);
            container.appendChild(sectionHeader);
        }
        
        if (!renderedQuestions.has(ex_question_id)) {
            const questionNum = question.num || (i + 1);
            // 标记是否是整场考试的最后一道题（用于显示附加题标识）
            question.is_last_question = (i === question_list.length - 1);
            const questionDiv = renderQuestion(question, i, questionNum);
            if (questionDiv) {
                container.appendChild(questionDiv);
            }
        }
    }

    // C2：题目渲染完成后触发事件（由 question_submit.js 监听并执行恢复）
    // 说明：本页脚本加载顺序是 ex_question_list.js -> question_submit.js，
    // 直接在这里调用 restoreFromCache 可能因时序导致“错过一次恢复”。
    try {
        
        document.dispatchEvent(new CustomEvent('csg:exam_questions_rendered'));
    } catch (e) {}
}

/**
 * 渲染导航菜单
 */
function renderNavMenu() {
    const navContent = document.getElementById('question_nav_content');
    if (!navContent) return;
    
    navContent.innerHTML = '';
    
    question_list.forEach((question, index) => {
        const status = getQuestionStatus(question);
        const statusIcon = getStatusIcon(status);
        const pkindName = getPkindName(question.pkind);
        const pkindColor = getPkindColor(question.pkind);
        const titlePreview = getQuestionTitlePreview(question);
        
        const navItem = document.createElement('div');
        navItem.className = 'question-nav-item';
        navItem.setAttribute('data-question-id', question.ex_question_id);
        navItem.setAttribute('data-question-index', index);
        navItem.innerHTML = `
            <div class="question-nav-item-status ${status}"></div>
            <div class="question-nav-item-number">${question.num}</div>
            <div class="question-nav-item-title" title="${titlePreview}">${titlePreview}</div>
            <div class="question-nav-item-type" style="background-color: ${pkindColor};">${pkindName}</div>
        `;
        
        navItem.addEventListener('click', () => {
            scrollToQuestion(question.ex_question_id);
        });
        
        navContent.appendChild(navItem);
    });
    
    // 更新当前激活项
    updateActiveNavItem();
    
    // 更新统计信息显示
    updateStatsDisplay();
}

/**
 * 滚动到指定题目
 * @param {string} ex_question_id - 题目ID
 */
function scrollToQuestion(ex_question_id) {
    const element = questionElements[ex_question_id];
    if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        updateActiveNavItem();
    }
}

/**
 * 更新导航菜单中的激活项
 */
function updateActiveNavItem() {
    const navItems = document.querySelectorAll('.question-nav-item');
    const viewportTop = window.scrollY;
    const viewportBottom = viewportTop + window.innerHeight;
    
    let activeId = null;
    
    // 找到当前视口中最靠上的题目
    for (let i = 0; i < question_list.length; i++) {
        const question = question_list[i];
        const element = questionElements[question.ex_question_id];
        if (element && !element.classList.contains('question-placeholder')) {
            const rect = element.getBoundingClientRect();
            if (rect.top >= viewportTop - 100 && rect.top <= viewportBottom) {
                activeId = question.ex_question_id;
                break;
            }
        }
    }
    
    // 如果没有找到，找最接近视口顶部的
    if (!activeId) {
        let minDistance = Infinity;
        for (let i = 0; i < question_list.length; i++) {
            const question = question_list[i];
            const element = questionElements[question.ex_question_id];
            if (element && !element.classList.contains('question-placeholder')) {
                const rect = element.getBoundingClientRect();
                const distance = Math.abs(rect.top - viewportTop);
                if (distance < minDistance) {
                    minDistance = distance;
                    activeId = question.ex_question_id;
                }
            }
        }
    }
    
    // 更新激活状态
    navItems.forEach(item => {
        if (item.getAttribute('data-question-id') === activeId) {
            item.classList.add('active');
        } else {
            item.classList.remove('active');
        }
    });
}

/**
 * 计算题目统计信息
 * @returns {Object} { empty: 未答题数量, unsaved: 未保存数量, saved: 已保存数量, total: 总数量 }
 */
function calculateQuestionStats() {
    let empty = 0, unsaved = 0, saved = 0;
    question_list.forEach(question => {
        const status = getQuestionStatus(question);
        if (status === 'empty') empty++;
        else if (status === 'unsaved') unsaved++;
        else if (status === 'saved') saved++;
    });
    return { empty, unsaved, saved, total: question_list.length };
}

/**
 * 更新统计信息显示
 */
function updateStatsDisplay() {
    const stats = calculateQuestionStats();
    
    // 更新导航菜单标题旁的统计
    const navHeader = document.querySelector('.question-nav-header strong');
    if (navHeader) {
        let statsText = '';
        if (stats.unsaved > 0 || stats.empty > 0) {
            const parts = [];
            if (stats.unsaved > 0) {
                parts.push(`<span class="badge ms-1" style="font-size: 0.75rem; background-color: #e74c3c; color: white;" title="未保存的题目数量">${stats.unsaved}</span>`);
            }
            if (stats.empty > 0) {
                parts.push(`<span class="badge ms-1" style="font-size: 0.75rem; background-color: #95a5a6; color: white;" title="未答题数量">${stats.empty}</span>`);
            }
            statsText = ` ${parts.join('')}`;
        }
        navHeader.innerHTML = `<span class="bilingual-inline">题目导航<span class="en-text">Question Nav</span></span>${statsText}`;
    }
    
    // 更新按钮区的统计
    const toolbar = document.getElementById('exam_problemset_toolbar');
    if (toolbar) {
        let statsEl = toolbar.querySelector('.question-stats');
        if (!statsEl) {
            statsEl = document.createElement('div');
            statsEl.className = 'question-stats d-inline-flex align-items-center gap-1 flex-shrink-0';
            toolbar.appendChild(statsEl);
        }
        const parts = [];
        if (stats.unsaved > 0) parts.push(`<span class="badge" style="font-size: 0.75rem; background-color: #e74c3c; color: white;">未保存:${stats.unsaved}</span>`);
        if (stats.empty > 0) parts.push(`<span class="badge" style="font-size: 0.75rem; background-color: #95a5a6; color: white;">未答:${stats.empty}</span>`);
        if (stats.saved > 0 && stats.unsaved === 0 && stats.empty === 0) {
            parts.push(`<span class="badge bg-success" style="font-size: 0.75rem;">已保存:${stats.saved}</span>`);
        }
        statsEl.innerHTML = parts.length > 0 ? parts.join('') : `<span class="badge bg-success" style="font-size: 0.75rem;">全部完成</span>`;
    }
}

/**
 * 更新题目状态显示
 */
function updateQuestionStatuses() {
    question_list.forEach(question => {
        const status = getQuestionStatus(question);
        const navItem = document.querySelector(`.question-nav-item[data-question-id="${question.ex_question_id}"]`);
        if (navItem) {
            const statusEl = navItem.querySelector('.question-nav-item-status');
            if (statusEl) {
                statusEl.className = `question-nav-item-status ${status}`;
            }
        }
        
        // 更新题目DOM中的状态
        const questionDiv = questionElements[question.ex_question_id];
        if (questionDiv && !questionDiv.classList.contains('question-placeholder')) {
            // 检查 DOM 是否已标记为修改（用户已编辑但未保存）
            const domModified = questionDiv.getAttribute('data-modified') === 'true';
            // 如果 DOM 已标记为修改，或者服务器状态是 unsaved，则标记为已修改
            question.modified = domModified || status === 'unsaved';
            question.answered = status !== 'empty';
            QuestionRender.dis.Render(question, questionDiv, null);
            UpdateQuestionAnswerStatus(question);
            
            // 更新保存按钮状态
            const submitButton = questionDiv.querySelector('.question_submit');
            if (submitButton) {
                if (status === 'saved') {
                    submitButton.innerHTML = '<i class="bi bi-save"></i><span class="cn-text">已保存</span><span class="en-text">Saved</span>';
                    submitButton.classList.remove('btn-primary');
                    submitButton.classList.add('btn-success');
                } else {
                    submitButton.innerHTML = '<i class="bi bi-save"></i><span class="cn-text">保存答案</span><span class="en-text">Save Answer</span>';
                    submitButton.classList.remove('btn-success');
                    submitButton.classList.add('btn-primary');
                }
            }
        }
    });
    
    // 更新统计信息显示
    updateStatsDisplay();
}

/**
 * 更新导航栏位置（适配带鱼屏）
 * 注意：此函数由通用模块通过 updatePosition 回调调用
 * 当用户未拖动过导航菜单时，自动计算最佳位置
 */
function updateNavMenuPosition() {
    const navMenu = document.getElementById('question_nav_menu');
    if (!navMenu) return;
    
    const container = document.getElementById('question_list_container');
    if (!container) return;

    // 收起态：不进行自动定位，由通用模块管理
    if (navMenu.classList.contains('collapsed')) {
        return;
    }

    // 检查是否已设置用户自定义位置
    // 如果用户拖动过，通用模块会设置 right/top，此时不进行自动定位
    const computedStyle = window.getComputedStyle(navMenu);
    const right = computedStyle.right;
    const top = computedStyle.top;
    
    // 如果 right 和 top 都有值且不是默认的 'auto'
    if (right !== 'auto' && top !== 'auto' && right !== '' && top !== '') {
        const rightValue = parseFloat(right);
        const topValue = parseFloat(top);
        // 检查是否是默认位置（right: 20px, top: 120px 或 80px）
        const isDefaultPosition = (rightValue === 20 && (topValue === 120 || topValue === 80));
        // 如果不是默认位置，说明用户已拖动过，不自动定位
        if (!isDefaultPosition) {
            return;
        }
        // 如果是默认位置，继续执行自动定位（可能是通用模块设置的临时默认值）
    }
    
    // 自动定位：计算最佳位置
    // 优先放在题目区域右侧（不遮挡），空间不足时回退到右上角
    const navWidth = navMenu.offsetWidth || 260;
    const containerRect = container.getBoundingClientRect();
    const availableRight = window.innerWidth - containerRect.right;
    const gap = 24;

    if (availableRight >= navWidth + gap) {
        // 有足够空间：放在题目区域右侧，不遮挡
        navMenu.style.left = `${containerRect.right + gap}px`;
        navMenu.style.right = 'auto';
        // 保持 top 位置不变（使用默认值或已设置的值）
        if (top === 'auto' || top === '') {
            const defaultTop = document.body.classList.contains('exam-single-page') ? 80 : 120;
            navMenu.style.top = `${defaultTop}px`;
        }
    } else {
        // 空间不足：回退到右上角固定位置
        navMenu.style.left = 'auto';
        navMenu.style.right = '20px';
        // 保持 top 位置不变（使用默认值或已设置的值）
        if (top === 'auto' || top === '') {
            const defaultTop = document.body.classList.contains('exam-single-page') ? 80 : 120;
            navMenu.style.top = `${defaultTop}px`;
        }
    }
}


/**
 * 加载题目列表
 */
function LoadQuestion() {
    loading_div.show();
    $.get(`/${PAGE_MODULE}/contest/problemset_ajax?cid=${cid}`, function(ret) {
        question_list = ret;
        question_list.forEach((q, index) => {
            question_map[q.ex_question_id] = q;
        });
        // 统计题型信息
        calculateSectionStats();
        renderedSections = new Set();
        LoadProgrammProblem();
    });
}

/**
 * 加载编程题数据
 */
function LoadProgrammProblem() {
    $.get(`/${PAGE_MODULE}/contest/oj_problemset_ajax?cid=${cid}`, function(data){
        try {
            for(let i in data) {
                problemset[data[i]['problem_id']] = data[i];
            }
            } catch(e) {}
        LoadAsheet();
    });
}

/**
 * 加载答卷数据
 */
function LoadAsheet(reset_asheet_tmp=false) {
    loading_div.show();
    $.get(`/${PAGE_MODULE}/contest/asheet_ajax?cid=${cid}`, function(data){
        try {
            if(reset_asheet_tmp == true) {
                asheet_tmp = {};
            }
            for(let i in data) {
                let ex_question_id = data[i]['ex_question_id'];
                asheet[ex_question_id] = data[i];
                try{
                    asheet[ex_question_id]['submission'] = $.parseJSON(asheet[ex_question_id]['submission']);
                    if (question_map[ex_question_id]) {
                        question_map[ex_question_id].answered = true;
                        question_map[ex_question_id].modified = false;
                    }
                    } catch(e) {}
            }
            if(reset_asheet_tmp == true) {
                SetAsheetTmp(asheet_tmp, cid, contest_user);
            }
            // 处理没有提交的修改
            for(let ex_question_id in asheet_tmp) {
                if (question_map[ex_question_id]) {
                    let answered = ex_question_id in asheet;
                    let modified = !answered || asheet_tmp[ex_question_id].update_at > asheet[ex_question_id].update_at;
                    question_map[ex_question_id].answered = answered;
                    question_map[ex_question_id].modified = modified;
                }
            }
            
            // 渲染导航菜单
            renderNavMenu();
            
            // 初始渲染题目
            const container = document.getElementById('question_list_container');
            if (container && question_list.length > 0) {
                // 直接渲染前10题
                visibleRange.start = 0;
                visibleRange.end = Math.min(question_list.length, 10);
                renderVisibleQuestions();
                
                // 更新可见范围（触发懒加载）
                updateVisibleRange();
                updateQuestionStatuses();
                
                // 更新导航栏位置（适配带鱼屏）
                updateNavMenuPosition();
            }
            
            loading_div.hide();
            syncBeforeUnloadFlag();
        } catch(e) { loading_div.hide(); }
    });
}

/**
 * 卷面恢复 - 重新加载答卷并更新所有题目的 DOM 内容
 */
function recoverAnswerSheet() {
    loading_div.show();
    
    // 清空本地临时答卷
    asheet_tmp = {};
    SetAsheetTmp(asheet_tmp, cid, contest_user);
    
    // 重新加载服务器答卷数据
    $.get(`/${PAGE_MODULE}/contest/asheet_ajax?cid=${cid}`, function(data){
        try {
            // 清空并重新加载 asheet
            asheet = {};
            for(let i in data) {
                let ex_question_id = data[i]['ex_question_id'];
                asheet[ex_question_id] = data[i];
                try {
                    asheet[ex_question_id]['submission'] = $.parseJSON(asheet[ex_question_id]['submission']);
                } catch(e) {}
                
                // 更新 question_map 状态
                if (question_map[ex_question_id]) {
                    question_map[ex_question_id].answered = true;
                    question_map[ex_question_id].modified = false;
                }
            }
            
            // 重新渲染所有已渲染题目的答案内容
            for (let ex_question_id in questionElements) {
                const questionDiv = questionElements[ex_question_id];
                const question = question_map[ex_question_id];
                
                if (questionDiv && question) {
                    // 重置 data-modified 属性
                    questionDiv.setAttribute('data-modified', 'false');
                    
                    // 获取答卷数据（优先使用服务器保存的版本）
                    const asheet_single = asheet[ex_question_id] || null;
                    
                    // 重新渲染答案内容到 DOM
                    // 所有依赖已全局引入，直接使用
                    QuestionRender.asheet.Render(question, questionDiv, false, asheet_single);
                    
                    // 更新题目状态（禁用/启用等）
                    question.modified = false;
                    QuestionRender.dis.Render(question, questionDiv, null);
                    
                    // 隐藏保存提醒
                    hideQuestionNotification(questionDiv);
                }
            }
            
            // 更新导航菜单和统计信息
            updateQuestionStatuses();
            syncBeforeUnloadFlag();
            
            loading_div.hide();
            alerty.success("恢复完毕");
        } catch(e) {
            console.error('恢复答卷失败:', e);
            loading_div.hide();
            alerty.error("恢复失败，请刷新页面重试");
        }
    }).fail(function() {
        loading_div.hide();
        alerty.error("网络错误，请刷新页面重试");
    });
}

/**
 * 初始化Markdown编辑器
 */
function SetMarkdownEditor() {
    const editorEl = document.querySelector('#markdown_editor');
    if (!editorEl) return;
    
    // 所有依赖已全局引入，直接使用
    vditorSingleton = CsgVditor.createSingletonEditor({
        el: '#markdown_editor',
        height: 500,
        options: {
            toolbarConfig: { pin: true },
            cache: { enable: false },
            preview: { delay: 300 },
        },
    });
    markdown_editor = vditorSingleton;
}

/**
 * 为 Bootstrap 5 Modal 添加拖拽功能
 * @param {string} modalId - Modal 的 ID
 */
function initModalDrag(modalId) {
    // 如果已经初始化过，直接返回
    if (modalDragInitialized) return;
    
    const modalElement = document.getElementById(modalId);
    if (!modalElement) return;
    
    const modalDialog = modalElement.querySelector('.modal-dialog');
    const modalHeader = modalElement.querySelector('.modal-header');
    
    if (!modalDialog || !modalHeader) return;
    
    // 标记为已初始化
    modalDragInitialized = true;
    
    let isDragging = false;
    let startX = 0;
    let startY = 0;
    let initialX = 0;
    let initialY = 0;
    
    // 为 modal-header 添加拖拽样式
    modalHeader.style.cursor = 'move';
    modalHeader.style.userSelect = 'none';
    
    // 鼠标按下事件
    modalHeader.addEventListener('mousedown', dragStart);
    
    // 鼠标移动事件
    document.addEventListener('mousemove', drag);
    
    // 鼠标释放事件
    document.addEventListener('mouseup', dragEnd);
    
    // 触摸事件支持（移动端）
    modalHeader.addEventListener('touchstart', dragStartTouch, { passive: false });
    document.addEventListener('touchmove', dragTouch, { passive: false });
    document.addEventListener('touchend', dragEnd);
    
    function dragStart(e) {
        // 如果点击的是按钮或链接，不启动拖拽
        if (e.target.closest('button, a, .btn-close')) {
            return;
        }
        
        // 获取 modal-dialog 的当前位置
        const rect = modalDialog.getBoundingClientRect();
        initialX = rect.left;
        initialY = rect.top;
        
        if (e.type === 'touchstart') {
            startX = e.touches[0].clientX;
            startY = e.touches[0].clientY;
        } else {
            startX = e.clientX;
            startY = e.clientY;
        }
        
        if (e.target === modalHeader || modalHeader.contains(e.target)) {
            isDragging = true;
            modalHeader.style.cursor = 'grabbing';
            // 防止文本选择
            e.preventDefault();
        }
    }
    
    function dragStartTouch(e) {
        dragStart(e);
    }
    
    function drag(e) {
        if (!isDragging) return;
        
        e.preventDefault();
        
        let currentX, currentY;
        if (e.type === 'touchmove') {
            currentX = e.touches[0].clientX;
            currentY = e.touches[0].clientY;
        } else {
            currentX = e.clientX;
            currentY = e.clientY;
        }
        
        // 计算偏移量
        const deltaX = currentX - startX;
        const deltaY = currentY - startY;
        
        // 计算新位置
        let newX = initialX + deltaX;
        let newY = initialY + deltaY;
        
        // 获取 modal-dialog 的尺寸
        const rect = modalDialog.getBoundingClientRect();
        const dialogWidth = rect.width;
        const dialogHeight = rect.height;
        
        // 限制在视口内
        const minX = 0;
        const minY = 0;
        const maxX = window.innerWidth - dialogWidth;
        const maxY = window.innerHeight - dialogHeight;
        
        newX = Math.max(minX, Math.min(newX, maxX));
        newY = Math.max(minY, Math.min(newY, maxY));
        
        // 使用 left 和 top 定位（需要先设置 position）
        const originalPosition = window.getComputedStyle(modalDialog).position;
        if (originalPosition !== 'fixed' && originalPosition !== 'absolute') {
            modalDialog.style.position = 'fixed';
        }
        
        modalDialog.style.left = newX + 'px';
        modalDialog.style.top = newY + 'px';
        modalDialog.style.margin = '0';
        modalDialog.style.transform = 'none';
    }
    
    function dragTouch(e) {
        drag(e);
    }
    
    function dragEnd() {
        if (isDragging) {
            isDragging = false;
            modalHeader.style.cursor = 'move';
        }
    }
    
    // Modal 关闭时只重置拖拽状态，保持位置不变
    modalElement.addEventListener('hidden.bs.modal', function() {
        // 重置拖拽状态
        isDragging = false;
        modalHeader.style.cursor = 'move';
    });
}

/**
 * 考试结束处理
 */
function ExamFinishedWork() {
    $('.button_exam_finish').prop('disabled', true).html('<span class="cn-text">非考试状态</span><span class="en-text">Exam Not Active</span>');
    $('.button_save_all').prop('disabled', true);
    $('.button_recover').prop('disabled', true);
}

/**
 * 心跳
 */
function HeartBeat() {
    $.get(`/${PAGE_MODULE}/contest/heartbeat_ajax?cid=${cid}`);
}

// 页面初始化
$(document).ready(async function(){
    InitPageInfo();
    asheet_tmp = await GetAsheetTmp(cid, contest_user);
    InitAllowLang();
    SetFrontAlerty('answer_sheet_div');
    SetMarkdownEditor();
    
    // 初始化 Modal 拖拽功能
    initModalDrag('markdown_editor_modal');

    // 初始化题目导航（使用通用模块）
    if (typeof initQuestionNavCommon === 'function') {
        initQuestionNavCommon({
            getStorageKey: (suffix) => {
                return `${PAGE_MODULE || 'examsys'}:contest:${cid || ''}:${contest_user || ''}:question_nav:${suffix}`;
            },
            getDefaultPosition: () => {
                if (document.body.classList.contains('exam-single-page')) {
                    return { right: 20, top: 80 };
                }
                return { right: 20, top: 120 };
            },
            updatePosition: updateNavMenuPosition  // 保留自动定位逻辑
        });
    }
    
    if(examinee_defunct == 'Y') {
        ExamFinishedWork();
    }
    
    // 卷面恢复
    $('.button_recover').click(function(){
        alerty.confirm(
            "<span class='text-danger'>将所有未保存的答题内容恢复为最后保存版本</span><br/>恢复后不可撤销",
            () => {
                // 恢复答卷数据并重新渲染所有题目的答案内容
                recoverAnswerSheet();
            },
            () => {
                alerty.info("已取消");
            }
        );
    });
    
    // 保存所有更改
    $('.button_save_all').click(function(){
        let modified_list = JudgeSaved();
        if(modified_list === true || modified_list.length == 0) {
            alerty.success("没有未保存的内容");
            return;
        }
        let confirm_info = `
            <div class="text-start">
                <div class="mb-2 fw-semibold text-danger">请确认以下题目当前填写内容，将一次性保存：</div>
                <div class="small text-muted mb-2">保存过程中请勿操作页面，以免影响提交。</div>
                <div class="mt-2">
                    ${modified_list.map(m => {
                        const q = question_map[m.ex_question_id] || m;
                        const title = getQuestionTitlePreview(q);
                        const num = q?.num ? `${q.num}. ` : '';
                        return `<div class="text-body">${num}${title}</div>`;
                    }).join('')}
                </div>
            </div>
        `;
        alerty.confirm(confirm_info,
            () => {
                if(!JudgeAsheetValid(modified_list)) {
                    return;
                }
                setTimeout(() => {
                    SubmitMultiQuestionIterate(0, modified_list);
                }, 300);
            },
            () => {
                alerty.info("已取消");
            }
        );
    });
    
    // 结束考试
    $('.button_exam_finish').click(function(){
        let confirm_info = "结束后无法再进行答题，确认？";
        confirm_info += "<br/>Sure to submit? After that you wouldn't do anything but leave.";
        let modified_list = JudgeSaved();
        if(modified_list !== true && modified_list.length > 0) {
            confirm_info += "<br/><br/><span class='text-danger'>部分答题更改未保存</span>（<i class='bi bi-file-diff-fill'></i>），仍要结束考试点确认，继续考试请取消. <br/>更改过回答的题目：";
            for(let i in modified_list) {
                confirm_info += `<br/>${modified_list[i].question_title}`;
            }
        }
        alerty.confirm(confirm_info,
            function(){
                $.get(`/${PAGE_MODULE}/contest/submit_exam_ajax?cid=${cid}`, {}, function(ret){
                    if(ret['code'] == 1) {
                        alerty.alert(ret['msg']);
                        ExamFinishedWork();
                    } else {
                        alerty.error(ret['msg']);
                    }
                });
            },
            function(){
                alerty.message("继续考试.<br/>Go on exam.");
            }
        );
    });
    
    // 全屏 - 改为在新标签页打开独立页
    $('.button_fullscreen').click(function(){
        // 检查是否已经在独立页模式
        if (document.body.classList.contains('exam-single-page')) {
            // 已经在独立页，可以关闭窗口或提示
            alerty.info('已在独立页模式 / Already in single page mode');
            return;
        }
        
        // 构建独立页URL
        const singlePageCid = window.examProblemsetConfig ? window.examProblemsetConfig.cid : cid;
        const singlePageUrl = `/${PAGE_MODULE}/contest/problemset_single_page?cid=${singlePageCid}`;
        
        // 在新标签页打开独立页
        window.open(singlePageUrl, '_blank');
        
        // 提示用户
        alerty.success('已在新标签页打开独立页 / Opened in new tab');
    });
    
    // 返回顶部
    $('#to_top_a').click(function(e){
        e.preventDefault();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });
    
    // 滚动事件：更新可见范围和导航菜单
    let scrollTimer = null;
    $(window).on('scroll', function(){
        if (scrollTimer) clearTimeout(scrollTimer);
        scrollTimer = setTimeout(() => {
            updateVisibleRange();
            updateActiveNavItem();
        }, 100);
    });
    
    // 窗口大小改变时更新导航栏位置
    let resizeTimer = null;
    $(window).on('resize', function(){
        if (resizeTimer) clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
            updateNavMenuPosition();
        }, 200);
    });
    
    // 监听答案提交成功事件，更新状态
    $(document).on('answerSubmitted', function(e, ex_question_id) {
        updateQuestionStatuses();
        syncBeforeUnloadFlag();
    });

    // 监听答案修改事件（UpdateAsheetTmp 触发），更新状态
    $(document).on('answerModified', function(e, ex_question_id) {
        updateQuestionStatuses();
        syncBeforeUnloadFlag();
    });

    // 输入/保存操作后实时刷新导航状态（不依赖刷新）
    // 注意：这里延迟调用，确保 UpdateAsheetTmp 先执行并触发 answerModified 事件
    $(document).on('input change', '.question_input', function(){
        // 延迟调用，确保 UpdateAsheetTmp 先更新 asheet_tmp
        setTimeout(function() {
            updateQuestionStatuses();
            syncBeforeUnloadFlag();
        }, 0);
    });
    $(document).on('click', '.btn-edit-md, #md_editor_save_btn', function(){
        // 编辑或保存富文本后也刷新一次
        setTimeout(updateQuestionStatuses, 200);
        setTimeout(syncBeforeUnloadFlag, 200);
    });

    // Markdown 帮助
    $('#md_help_btn').click(function(){
        // 所有依赖已全局引入，直接使用
        MdHelp.open();
    });

    // 编辑答案按钮
    $(document).on('click', '.btn-edit-md', function(){
        const qid = this.getAttribute('data-qid');
        const subq = this.getAttribute('data-subq') || '0';
        currentMdEdit = { qid, subq };
        const hidden = document.querySelector(`.md-hidden-input[data-qid="${qid}"][data-subq="${subq}"]`);
        const val = hidden ? hidden.value : '';
        // 所有依赖已全局引入，直接使用
        markdown_editor.setValue(val || '');
        
        // 更新标题栏显示题目信息
        updateMarkdownEditorTitle(parseInt(qid));
        
        const modal = bootstrap.Modal.getOrCreateInstance(document.getElementById('markdown_editor_modal'));
        modal.show();
    });

    // 保存到当前题目
    $('#md_editor_save_btn').click(async function(){
        if (!currentMdEdit) return;
        const { qid, subq } = currentMdEdit;
        const ex_question_id = parseInt(qid);
        const hidden = document.querySelector(`.md-hidden-input[data-qid="${qid}"][data-subq="${subq}"]`);
        const preview = document.querySelector(`.md-answer-preview[data-qid="${qid}"][data-subq="${subq}"]`);
        const val = await getMarkdownEditorValue();
        if (hidden) {
            hidden.value = val;
            // 手动触发 input 事件，以便显示保存提醒
            const inputEvent = new Event('input', { bubbles: true });
            hidden.dispatchEvent(inputEvent);
        }
        renderMdPreview(preview, val);
        // 更新前端缓存和题目状态
        if (typeof UpdateAsheetTmp === 'function' && ex_question_id) {
            UpdateAsheetTmp(ex_question_id);
        }
        // 更新导航栏状态
        updateQuestionStatuses();
        const modal = bootstrap.Modal.getInstance(document.getElementById('markdown_editor_modal'));
        modal?.hide();
    });
    
    // 开始加载
    LoadQuestion();
    // 初始同步离开提醒标志
    syncBeforeUnloadFlag();
    
    // 心跳
    setInterval(HeartBeat, 600000);
});

