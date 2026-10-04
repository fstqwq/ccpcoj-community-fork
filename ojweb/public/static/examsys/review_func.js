// **************************************************
// 阅卷功能模块
// 依赖：question_md_utils.js (renderMdPreview, processVditorPlaceholders)
// 依赖：question_nav_common.js (initQuestionNavCommon) - 题目导航通用功能
// 注意：PAGE_MODULE 常量在 ex_global.js 中定义
// **************************************************

// **************************************************
// info
let page_info;
let cid;
let examinee_defunct;
let allow_lang;
let allow_lang_key;
let allow_lang_val;
let review_examinee_table;
let review_question_table;  // 保留用于兼容，但不再使用
let question_id_filter_input;
let load_finish_flag;
let loading_div;
let stu_info_span;
let stu_score_span;
let attach_pro;
let question_list_container;  // 题目列表容器
let question_nav_menu;  // 悬浮导航菜单
let question_nav_content;  // 导航内容
let question_elements = {};  // 题目DOM元素映射
let review_empty_hint;  // 初始提示元素
// **************************************************
// import/export state
let review_score_import_pending = {}; // { [ex_question_id]: {notes_text: string, score_list: number[]} } 仅用于当前考生
// **************************************************
// data
let examinee_map;           // 考生信息
let examinee_list;
let asheet_map;             // 全局解答信息
let question_map;           // 题目信息
let question_qtype_cnt;     // 各打分类型数量
let question_list;          // 题目列表
let oj_problemset;          // OJ编程题
let oj_solution_best_pass_rate;  // OJ编程题每题最优pass_rate的最后一次提交
let score_map = null;       // 分数统计
// **********
// cache
let question_html_cache = {};
// **************************************************
// global signal
let examinee_id_now = null;    // 正在批改该生答卷
let asheet_table_width;
let question_filter;
let first_render_flag = false;
// **************************************************
function InitPageInfo() {
    page_info = $('#page_info');
    cid = page_info.attr('cid');
    examinee_defunct = page_info.attr('examinee_defunct'); 
    attach_pro = parseInt(page_info.attr('attach_pro'));
    asheet_table_width = $('#review_area_div').width() - 400;
    review_examinee_table = $('#review_examinee_table');
    review_question_table = $('#review_question_table');  // 保留兼容
    loading_div = $('#loading_div');
    question_id_filter_input = $("#question_id_filter_input");
    stu_info_span = $('#stu_info_span');
    stu_score_span = $('#stu_score_span');
    question_list_container = $('#question_list_container');
    question_nav_menu = $('#question_nav_menu');
    question_nav_content = $('#question_nav_content');
    review_empty_hint = $('#review_empty_hint');
}

function ReviewDecodeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .replace(/&#39;|&#039;/g, "'");
}

// **************************************************
// 综合题（pkind=20）：把每小题打分放到小题旁，并提供“每小题保存”按钮
function ReviewGetComprehensiveSubLi(q_div, qid, subq) {
    const preview = q_div.querySelector(`.md-answer-preview[data-qid="${qid}"][data-subq="${subq}"]`);
    if (!preview) return null;
    return preview.closest('li.list-group-item') || null;
}
function ReviewUpdateComprehensiveScoreWarnings(qid) {
    const q = question_map?.[qid];
    if (!q || parseInt(q.pkind) !== 20) return;
    const q_div = question_elements?.[qid];
    if (!q_div) return;

    const inputs = Array.from(q_div.querySelectorAll(`.review_score_qid_${qid}`));
    if (!inputs.length) return;

    const missingIdx = new Set();
    for (const el of inputs) {
        const subq = parseInt(el.getAttribute('q_sub_id') || '-1', 10);
        const v = (el.value || '').trim();
        if (!v) missingIdx.add(subq);
    }
    const anyMissing = missingIdx.size > 0;

    // 更新每小题保存按钮（顶部 slot 与底部按钮共用同一套文案，并用 CsgSetTitleAndTooltip 同步 Bootstrap tooltip）
    const subBtns = Array.from(q_div.querySelectorAll(`.review_submit_subscore[qid="${qid}"]`));
    for (const btn of subBtns) {
        const subq = parseInt(btn.getAttribute('data-subq') || '-1', 10);
        const thisMissing = missingIdx.has(subq);
        const othersMissing = anyMissing && !thisMissing;

        // 统一配色：全部使用 primary 系；用图标/tooltip 表达 warning 状态
        btn.classList.remove('btn-warning', 'btn-outline-warning', 'btn-primary', 'btn-outline-primary');
        // 已打分：实心；未打分：outline
        btn.classList.add(thisMissing ? 'btn-outline-primary' : 'btn-primary');
        const warnIcon = btn.querySelector('.review-subscore-warn-icon');
        var btnTitle;
        if (thisMissing) {
            btnTitle = '本小题未打分 / This sub-question is not scored';
            if (warnIcon) warnIcon.classList.remove('d-none');
        } else if (othersMissing) {
            btnTitle = '尚有其它小题未打分 / Other sub-questions are not scored';
            if (warnIcon) warnIcon.classList.remove('d-none');
        } else {
            btnTitle = '保存本题 / Save this question';
            if (warnIcon) warnIcon.classList.add('d-none');
        }
        CsgSetTitleAndTooltip(btn, btnTitle);
    }

    // 更新总保存按钮（评语区那个）
    const mainBtn = q_div.querySelector(`.review_submit[qid="${qid}"].review-submit-vertical`);
    if (mainBtn) {
        // 统一配色：保持 primary；用图标/tooltip 表达 warning 状态
        mainBtn.classList.remove('btn-warning');
        mainBtn.classList.add('btn-primary');
        var mainTitle = anyMissing ? '尚有小题未打分 / Some sub-questions are not scored' : '保存本题的评分与评语 / Save score & comment for this question';
        CsgSetTitleAndTooltip(mainBtn, mainTitle);
        const mainWarnIcon = mainBtn.querySelector('.review-save-warn-icon');
        if (mainWarnIcon) mainWarnIcon.classList.toggle('d-none', !anyMissing);
    }

    // 同步更新题目导航与题卡分数区配色（综合题：必须全部小题打分才变色）
    try { UpdateQuestionNavScore(qid); } catch (e) {}
    try { UpdateQuestionHeader(q_div, q); } catch (e) {}
}

function ReviewSyncComprehensiveSummaryInputs(qid, subq = null) {
    const q_div = question_elements?.[qid] || document.getElementById(`question_div_${qid}`);
    if (!q_div) return;
    const syncOne = (idx) => {
        const slotInput = q_div.querySelector(`.review_score_input[qid="${qid}"][q_sub_id="${idx}"]`);
        const sumInput = q_div.querySelector(`.review_subscore_summary_input[qid="${qid}"][q_sub_id="${idx}"]`);
        const botInput = q_div.querySelector(`.review_subscore_bottom_input[qid="${qid}"][q_sub_id="${idx}"]`);
        if (!slotInput || !sumInput) return;
        const v = (slotInput.value ?? '');
        if (sumInput.value !== v) sumInput.value = v;
        if (botInput && botInput.value !== v) botInput.value = v;
    };
    if (subq === null || typeof subq === 'undefined') {
        const sumInputs = Array.from(q_div.querySelectorAll(`.review_subscore_summary_input[qid="${qid}"]`));
        for (const el of sumInputs) {
            const idx = parseInt(el.getAttribute('q_sub_id') || '-1', 10);
            if (idx >= 0) syncOne(idx);
        }
        return;
    }
    const idx = parseInt(subq, 10);
    if (idx >= 0) syncOne(idx);
}

function ReviewSyncComprehensiveInputDisabledState(qid, subq = null) {
    // 解决：综合题底部控件在 QuestionRender.dis.Render 后被禁用，而顶部控件是“后插入”所以未禁用
    // 这里以“顶部小题输入框”的 disabled 为准，同步到：总区输入框 + 底部输入框 + 底部快调按钮 + 底部保存按钮
    const q_div = question_elements?.[qid] || document.getElementById(`question_div_${qid}`);
    if (!q_div) return;
    const syncOne = (idx) => {
        const slotInput = q_div.querySelector(`.review_score_input[qid="${qid}"][q_sub_id="${idx}"]`);
        if (!slotInput) return;
        const disabled = !!slotInput.disabled;
        const sumInput = q_div.querySelector(`.review_subscore_summary_input[qid="${qid}"][q_sub_id="${idx}"]`);
        const botInput = q_div.querySelector(`.review_subscore_bottom_input[qid="${qid}"][q_sub_id="${idx}"]`);
        if (sumInput) sumInput.disabled = disabled;
        if (botInput) botInput.disabled = disabled;

        // 底部区域的快调按钮与保存按钮
        const foot = botInput ? botInput.closest('.review-subq-foot') : null;
        if (foot) {
            foot.querySelectorAll('button.btn_fast_score').forEach(btn => { btn.disabled = disabled; });
            const saveBtn = foot.querySelector(`.review_submit_subscore_bottom[qid="${qid}"][data-subq="${idx}"]`);
            if (saveBtn) saveBtn.disabled = disabled;
        }
    };

    if (subq === null || typeof subq === 'undefined') {
        const slotInputs = Array.from(q_div.querySelectorAll(`.review_score_input[qid="${qid}"]`));
        for (const el of slotInputs) {
            const idx = parseInt(el.getAttribute('q_sub_id') || '-1', 10);
            if (idx >= 0) syncOne(idx);
        }
        return;
    }
    const idx = parseInt(subq, 10);
    if (idx >= 0) syncOne(idx);
}
function ReviewInitComprehensiveSubScoreUI(question, q_div_override=null) {
    if (!question || parseInt(question.pkind) !== 20) return;
    const qid = question.ex_question_id;
    const q_div = q_div_override || question_elements?.[qid] || document.getElementById(`question_div_${qid}`);
    if (!q_div) throw new Error(`question_div not found: qid=${qid}`);

    // 未作答：禁评阅，直接跳过（避免无意义的 warn）
    try {
        const asheet_single = GetAsheetSingle(qid);
        if (ReviewIsAsheetEffectivelyBlank(question, asheet_single, 0)) return;
    } catch (e) {}

    // 把 ScorePanel 生成的每小题打分块移动到对应 slot
    const slots = Array.from(q_div.querySelectorAll(`.review-subscore-slot[data-qid="${qid}"]`));
    const items = Array.from(q_div.querySelectorAll(`.review-subscore-item[data-qid="${qid}"]`));
    if (!items.length) {
        // 调试辅助：如果 slot 已存在但 item 缺失，说明 ScorePanel 未按预期渲染到 review 区
        if (slots.length > 0) {
            const hasSource = !!q_div.querySelector('.review-subscore-source');
            console.warn('[review] subscore items not found', { qid, slots: slots.length, hasSource });
        }
        return;
    }

    for (const item of items) {
        const subq = item.getAttribute('data-subq');
        const slot = q_div.querySelector(`.review-subscore-slot[data-qid="${qid}"][data-subq="${subq}"]`);
        if (!slot) {
            console.error('review-subscore-slot not found', { qid, subq });
            continue;
        }

        // 构造面板：打分控件 + 每小题保存按钮（功能同总保存按钮）
        slot.innerHTML = '';
        const panel = document.createElement('div');
        panel.className = 'review-subscore-panel border rounded bg-light px-2 py-1 d-flex align-items-center gap-2 flex-wrap';

        panel.appendChild(item); // move node

        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'btn btn-sm btn-outline-primary review_submit review_submit_subscore';
        btn.setAttribute('qid', String(qid));
        btn.setAttribute('data-subq', String(subq));
        btn.innerHTML = `<i class="bi bi-save" aria-hidden="true"></i>
            <span class="review-subscore-warn-icon text-warning ms-1 d-none" title="提示 / Warning" aria-hidden="true"><i class="bi bi-exclamation-triangle-fill"></i></span>`;
        btn.setAttribute('aria-label', '保存小题评分 / Save sub-question score');
        // 与底部保存按钮一致的默认 title，后续 ReviewUpdateComprehensiveScoreWarnings 会按状态统一更新
        btn.setAttribute('title', '保存本题 / Save this question');

        panel.appendChild(btn);
        slot.appendChild(panel);
    }

    ReviewUpdateComprehensiveScoreWarnings(qid);
    // 初始化“总区小题输入框”值（与小题旁输入框保持一致）
    try { ReviewSyncComprehensiveSummaryInputs(qid); } catch (e) {}
    // 同步禁用状态（让底部控件与顶部一致）
    try { ReviewSyncComprehensiveInputDisabledState(qid); } catch (e) {}
}

function ReviewApplyBlankQuestionUIState(question, q_div) {
    if (!question || !q_div || !examinee_id_now) return;
    const qid = question.ex_question_id;
    const scoreInfo = GetQuestionScore(examinee_id_now, qid);
    const isBlank = scoreInfo && scoreInfo.score_type === 'blank';
    q_div.classList.toggle('review-question-blank', !!isBlank);
}

// **************************************************
// toolbar: 下载/上传/批量提交评分
function ReviewEnsureExamineeSelected() {
    if (!examinee_id_now) {
        alerty.warning('请先选择考生', 'Please select an examinee first');
        return false;
    }
    return true;
}

function ReviewHasAsheetRecord(qid) {
    // “考生未交该题”通常表现为：ex_asheet 表里不存在该 qid 的记录
    // 前端约定：无答卷记录的题，不参与批量保存/导入/导出
    const q = parseInt(qid || '0', 10);
    if (!q) return false;
    const ex = asheet_map?.[examinee_id_now];
    if (!ex) return false;
    const row = ex[q];
    return !!(row && row.ex_asheet_id);
}

function ReviewGetComprehensiveSubScoreStats(question, qid, q_div = null) {
    // 综合题：统计小题打分完成度（用于导航/题卡分数配色）
    // - 优先用 DOM 输入框（实时编辑态）
    // - 若 DOM 不可用，则回退到已保存 notes.score（初始渲染态）
    let total = 0;
    try { total = (GetRealSubScore(question) || []).length; } catch (e) { total = 0; }
    if (!total) {
        try {
            const c = JSON.parse(question?.content || '[]');
            if (Array.isArray(c)) total = c.length;
        } catch (e) { total = 0; }
    }
    if (!total) return { total: 0, filled: 0 };

    const div = q_div || question_elements?.[qid] || document.getElementById(`question_div_${qid}`);
    if (div) {
        const inputs = Array.from(div.querySelectorAll(`.review_score_qid_${qid}`));
        if (inputs.length > 0) {
            let filled = 0;
            for (const el of inputs) {
                const v = (el.value || '').trim();
                if (v !== '') filled++;
            }
            return { total: inputs.length, filled };
        }
    }

    // fallback: notes.score
    const asheet_single = GetAsheetSingle(qid);
    const notesObj = GetNoteWithScore(asheet_single) || {};
    const scoreArr = Array.isArray(notesObj.score) ? notesObj.score : [];
    let filled = 0;
    for (let i = 0; i < total; i++) {
        const v = scoreArr[i];
        if (typeof v === 'undefined' || v === null) continue;
        if (v === -1) continue;
        const s = String(v).trim();
        if (s === '') continue;
        filled++;
    }
    return { total, filled };
}

function ReviewTruncateText(s, maxLen = 24) {
    if (s === null || typeof s === 'undefined') return '';
    s = String(s);
    if (s.length <= maxLen) return s;
    return s.substring(0, maxLen) + '...';
}

function ReviewGetQuestionTypeName(pkind, fallback = '') {
    try {
        return question_default?.pkind_table_cn?.[pkind] || fallback || String(pkind);
    } catch (e) {
        return fallback || String(pkind);
    }
}

function ReviewEnsureImportFileInput() {
    const id = 'review_score_import_file_input';
    let inputEl = document.getElementById(id);
    if (inputEl) return inputEl;
    inputEl = document.createElement('input');
    inputEl.type = 'file';
    inputEl.accept = 'application/json,.json';
    inputEl.id = id;
    inputEl.style.display = 'none';
    document.body.appendChild(inputEl);
    return inputEl;
}

function ReviewParseImportedScoreFile(text) {
    let obj;
    try {
        obj = JSON.parse(text);
    } catch (e) {
        return { ok: false, msg: '文件解析失败：不是有效的评分文件', msg_en: 'Failed to parse file: invalid grading file' };
    }
    const questions = obj?.questions;
    if (!Array.isArray(questions)) {
        return { ok: false, msg: '文件结构不正确：缺少题目列表', msg_en: 'Invalid file structure: missing questions' };
    }
    const qmap = {};
    for (const it of questions) {
        const qid = parseInt(it?.qid);
        if (!qid) continue;
        qmap[qid] = it;
    }
    return { ok: true, data: obj, qmap };
}

function ReviewBuildImportDiffHtml(missingInImport, extraInImport, extraMetaMap) {
    const buildList = (items, getItemHtml) => {
        if (!items.length) return '<div class="text-muted small">（无 / None）</div>';
        const rows = items.map(getItemHtml).join('');
        return `<ul class="list-group list-group-flush">${rows}</ul>`;
    };
    const missingHtml = buildList(missingInImport, (q) => {
        const pkindName = ReviewGetQuestionTypeName(q.pkind, '');
        const title = ReviewTruncateText(q.title || '', 28);
        return `<li class="list-group-item d-flex justify-content-between align-items-start">
            <div class="me-2">
                <div class="fw-semibold">#${q.num || '-'} <span class="text-muted small">(${pkindName})</span></div>
                <div class="text-muted small">${title}</div>
            </div>
            <div class="text-muted small">qid=${q.ex_question_id}</div>
        </li>`;
    });
    const extraHtml = buildList(extraInImport, (qid) => {
        const meta = extraMetaMap[qid] || {};
        const pkindName = ReviewGetQuestionTypeName(meta.pkind, '');
        const title = ReviewTruncateText(meta.title || '', 28);
        const num = meta.num || '-';
        return `<li class="list-group-item d-flex justify-content-between align-items-start">
            <div class="me-2">
                <div class="fw-semibold">#${num} <span class="text-muted small">(${pkindName})</span></div>
                <div class="text-muted small">${title}</div>
            </div>
            <div class="text-muted small">qid=${qid}</div>
        </li>`;
    });
    return `
        <div class="mb-2">
            <div class="fw-semibold text-warning bilingual-inline">导入提示<span class="en-text">Import notice</span></div>
            <div class="text-muted small bilingual-inline">题目不完全一致时，只会填入题号重叠的部分。<span class="en-text">When question sets differ, only overlapping questions are filled.</span></div>
        </div>
        <div class="mb-3">
            <div class="fw-semibold">导入材料中缺少（本场存在，已保留原界面内容）</div>
            ${missingHtml}
        </div>
        <div class="mb-1">
            <div class="fw-semibold">导入材料多出（本场不存在，已忽略）</div>
            ${extraHtml}
        </div>
    `;
}

function ReviewApplyImportedToDom(question, imported) {
    if (!imported || !question) return;
    const qid = question.ex_question_id;
    const notesInput = document.getElementById(`review_notes_qid_${qid}`);
    if (notesInput && typeof imported.notes_text === 'string') {
        notesInput.value = imported.notes_text;
    }
    const scoreInputs = document.getElementsByClassName(`review_score_qid_${qid}`);
    if (scoreInputs && scoreInputs.length > 0 && Array.isArray(imported.score_list)) {
        for (let i = 0; i < scoreInputs.length; i++) {
            const v = imported.score_list[i];
            if (typeof v === 'undefined' || v === null || v === -1) {
                scoreInputs[i].value = '';
            } else {
                scoreInputs[i].value = String(v);
            }
        }
    }
}

function ReviewTryApplyPendingImport(question) {
    const qid = question?.ex_question_id;
    if (!qid) return;
    const pending = review_score_import_pending?.[qid];
    if (!pending) return;
    ReviewApplyImportedToDom(question, pending);
    delete review_score_import_pending[qid];
}

function ReviewCollectReviewPayloadFromDom(question) {
    // 采集当前界面输入（不提交），并做与单题提交一致的校验
    const qid = question.ex_question_id;
    const notesInput = document.getElementById(`review_notes_qid_${qid}`);
    if (!notesInput) {
        return { ok: false, msg: `未找到题目(qid=${qid})的评语输入框` };
    }
    const notesText = notesInput.value.trim();
    const scoreInputs = document.getElementsByClassName(`review_score_qid_${qid}`);
    if (!scoreInputs || scoreInputs.length === 0) {
        return { ok: false, msg: `未找到题目(qid=${qid})的分数输入框` };
    }
    let scoreList = [];
    let sum = 0;
    let clearScoreFlg = true;
    for (let i = 0; i < scoreInputs.length; i++) {
        const el = scoreInputs[i];
        const raw = (el.value || '').trim();
        let score = raw === '' ? -1 : parseFloat(raw);
        if (raw !== '' && Number.isNaN(score)) {
            return { ok: false, msg: '分数必须是数字' };
        }
        if (score !== -1 && score !== Math.floor(score + 0.00000001)) {
            el.value = score.toFixed(1);
            score = parseFloat(score.toFixed(1));
        }
        let maxScore = parseFloat(el.getAttribute('q_score'));
        if (Number.isNaN(maxScore) || maxScore < 0) {
            maxScore = parseFloat(question.pscore) || 0;
        }
        if (score !== -1 && (score < 0 || score > maxScore)) {
            el.value = '';
            return { ok: false, msg: `分数范围应在0~${maxScore}` };
        }
        scoreList.push(score);
        sum += score === -1 ? 0 : score;
        if (score !== -1) clearScoreFlg = false;
    }
    if (notesText.length > 512) {
        return { ok: false, msg: '评语过长' };
    }
    if (clearScoreFlg) sum = -1;
    const notesObj = { notes: notesText, score: scoreList };
    return {
        ok: true,
        notesObj,
        notesStr: JSON.stringify(notesObj),
        scoreSum: sum,
    };
}

function ReviewCollectReviewPayloadFallback(question) {
    // 用已保存数据兜底（当题目未渲染/被过滤时）
    const qid = question.ex_question_id;
    const asheetSingle = GetAsheetSingle(qid);
    const notesObj = GetNoteWithScore(asheetSingle);
    const scoreVal = (typeof asheetSingle?.score === 'undefined' || asheetSingle?.score === null) ? -1 : parseFloat(asheetSingle.score);
    return {
        ok: true,
        notesObj,
        notesStr: JSON.stringify(notesObj || { notes: '', score: [] }),
        scoreSum: Number.isNaN(scoreVal) ? -1 : scoreVal,
    };
}

function ReviewDownloadScore() {
    if (!ReviewEnsureExamineeSelected()) return;
    if (!question_list || !question_map || !examinee_map) {
        alerty.error('数据尚未加载完成，请稍后再试');
        return;
    }
    
    // “已生效”以服务端为准：下载前拉取一次该考生已保存的评分/评语
    if (loading_div) loading_div.show();
    $.get(
        `/${PAGE_MODULE}/contest/asheet_ajax?cid=${cid}`,
        {
            examinee_id: examinee_id_now,
            fields: ['ex_question_id', 'score', 'notes', 'reviewer']
        },
        function (data) {
            if (loading_div) loading_div.hide();
            let asheetEffective = {};
            try {
                for (const row of (data || [])) {
                    const qid = parseInt(row?.ex_question_id);
                    if (!qid) continue;
                    let notesObj = null;
                    try {
                        notesObj = JSON.parse(row?.notes || 'null');
                    } catch (e) {
                        notesObj = null;
                    }
                    if (!notesObj || typeof notesObj !== 'object') {
                        notesObj = { notes: '', score: [] };
                    }
                    asheetEffective[qid] = {
                        score: (row?.score === null || typeof row?.score === 'undefined') ? null : parseFloat(row.score),
                        notes: notesObj,
                        reviewer: row?.reviewer || null,
                    };
                }
            } catch (e) {
                console.error(e);
            }
            
            const examinee = examinee_map[examinee_id_now] || {};
            const payload = {
                version: 1,
                exported_at: new Date().toISOString(),
                contest: { cid: cid, title: document.title || '' },
                examinee: {
                    team_id: examinee_id_now,
                    name: examinee.name || '',
                    school: examinee.school || '',
                    room: examinee.room || '',
                },
                questions: [],
            };
            
            // 仅导出“该考生有答卷记录”的题（服务端返回的 asheetEffective 即为有效集合）
            for (const q of question_list) {
                const qid = parseInt(q.ex_question_id);
                const eff = asheetEffective[qid];
                if (!eff) continue;
                payload.questions.push({
                    qid: qid,
                    num: q.num,
                    pkind: q.pkind,
                    type: ReviewGetQuestionTypeName(q.pkind, ''),
                    title: q.title || '',
                    score: eff.score,
                    notes: eff.notes,
                    reviewer: eff.reviewer,
                });
            }
            
            const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            const ts = new Date().toISOString().replace(/[:.]/g, '-');
            a.href = url;
            a.download = `score_${cid}_${examinee_id_now}_${ts}.json`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);
            alerty.success('已下载', 'Downloaded');
        }
    ).fail(function () {
        if (loading_div) loading_div.hide();
        alerty.error('下载失败：无法获取已保存的评分数据', 'Download failed: cannot load saved grading data');
    });
}

function ReviewUploadScore() {
    if (!ReviewEnsureExamineeSelected()) return;
    if (!question_list) {
        alerty.error('数据尚未加载完成，请稍后再试');
        return;
    }
    const inputEl = ReviewEnsureImportFileInput();
    inputEl.value = '';
    inputEl.onchange = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        let text = '';
        try {
            text = await file.text();
        } catch (err) {
            alerty.error('读取文件失败', 'Failed to read file');
            return;
        }
        const parsed = ReviewParseImportedScoreFile(text);
        if (!parsed.ok) {
            alerty.alert({
                title: '<span class="text-warning bilingual-inline">导入失败<span class="en-text">Import failed</span></span>',
                message: `<div class="text-danger">${parsed.msg}</div>`,
                message_en: parsed.msg_en || '',
            });
            return;
        }
        const uploadQmap = parsed.qmap;
        // 仅对“该考生有答卷记录”的题做导入/对比
        const eligibleQids = new Set();
        try {
            const ex = asheet_map?.[examinee_id_now] || {};
            for (const k of Object.keys(ex)) {
                const qid = parseInt(k, 10);
                if (!qid) continue;
                if (ex[k] && ex[k].ex_asheet_id) eligibleQids.add(qid);
            }
        } catch (e) {}
        const currentQids = eligibleQids;
        const uploadQids = new Set(Object.keys(uploadQmap).map(k => parseInt(k)));
        const missingInImport = [];
        const extraInImport = []; // 仅展示“可导入集合”内的 extra；未交题的 qid 自动忽略
        for (const q of question_list) {
            const qid = parseInt(q.ex_question_id);
            if (!eligibleQids.has(qid)) continue;
            if (!uploadQids.has(qid)) missingInImport.push(q);
        }
        for (const qid of uploadQids) {
            if (!currentQids.has(qid)) continue;
            // extraInImport 的语义：文件里有，但当前页可导入集合里没有 —— 这里 currentQids==eligibleQids，所以不会走到
            // 保留结构以兼容之前的 UI 展示
        }
        // 只填入 qid 重叠的题
        let filled = 0;
        for (const q of question_list) {
            const qid = parseInt(q.ex_question_id);
            if (!eligibleQids.has(qid)) continue; // 未交题：跳过
            const it = uploadQmap[qid];
            if (!it) continue;
            const notesText = typeof it?.notes?.notes === 'string'
                ? it.notes.notes
                : (typeof it?.notes_text === 'string' ? it.notes_text : '');
            const scoreList = Array.isArray(it?.notes?.score)
                ? it.notes.score
                : (Array.isArray(it?.score_list) ? it.score_list : []);
            review_score_import_pending[qid] = { notes_text: notesText, score_list: scoreList };
            // 若当前已渲染，立即应用；否则等 RenderSingleQuestion 时应用
            ReviewApplyImportedToDom(q, review_score_import_pending[qid]);
            if (document.getElementById(`review_notes_qid_${qid}`)) {
                delete review_score_import_pending[qid];
            }
            filled++;
        }
        // mismatch 提示（warning modal）
        if (missingInImport.length > 0 || extraInImport.length > 0) {
            const extraMetaMap = {};
            for (const qid of extraInImport) {
                extraMetaMap[qid] = uploadQmap[qid] || {};
            }
            const html = ReviewBuildImportDiffHtml(missingInImport, extraInImport, extraMetaMap);
            alerty.alert({
                title: '<span class="text-warning bilingual-inline">评分导入提示<span class="en-text">Import notice</span></span>',
                message: `${html}<div class="mt-2 text-muted small bilingual-inline">已填入<span class="en-text">Filled</span>：${filled} 题</div>`,
            });
        } else {
            alerty.success(`已填入 ${filled} 题`, `Filled ${filled} questions`);
        }
    };
    inputEl.click();
}

function ReviewSubmitAllScore() {
    if (!ReviewEnsureExamineeSelected()) return;
    if (!question_list) {
        alerty.error('数据尚未加载完成，请稍后再试');
        return;
    }
    alerty.confirm({
        title: '确认<span class="en-text">Confirm</span>',
        message: '将一次性保存当前考生整份试卷的评分与评语，是否继续？',
        message_en: "This will save scores & comments for the whole paper. Continue?",
        callback: () => {
            const items = [];
            const failedLocal = [];
            const skippedNoAsheet = [];
            for (const q of question_list) {
                const qid = parseInt(q.ex_question_id);
                if (!ReviewHasAsheetRecord(qid)) {
                    skippedNoAsheet.push(qid);
                    continue;
                }
                let collected;
                if (document.getElementById(`review_notes_qid_${qid}`)) {
                    collected = ReviewCollectReviewPayloadFromDom(q);
                } else {
                    collected = ReviewCollectReviewPayloadFallback(q);
                }
                if (!collected.ok) {
                    failedLocal.push({ q, msg: collected.msg });
                    continue;
                }
                items.push({
                    ex_question_id: qid,
                    notes: collected.notesStr,
                    score: collected.scoreSum,
                });
            }
            if (failedLocal.length) {
                alerty.error(`存在 ${failedLocal.length} 道题校验失败，已取消提交`);
                return;
            }
            if (!items.length) {
                const skipMsg = skippedNoAsheet.length ? `（已跳过 ${skippedNoAsheet.length} 题：考生未作答）` : '';
                alerty.warning(`无可保存题目：该考生未交卷或无有效答卷记录${skipMsg}`, 'No items to save');
                return;
            }
            $.post(
                'set_score_batch_ajax?cid=' + cid,
                // 直接提交数组，按 ThinkPHP 的 items/a 解析（避免字符串被错误转为数组导致后端无法取到 ex_question_id）
                { examinee_id: examinee_id_now, items: items },
                function (ret) {
                    if (ret.code != 1) {
                        alerty.error(ret.msg || '提交失败');
                        return;
                    }
                    const results = ret.data?.results || [];
                    const okList = results.filter(r => r && r.ok);
                    const failList = results.filter(r => r && !r.ok);
                    if (!(examinee_id_now in asheet_map)) asheet_map[examinee_id_now] = {};
                    for (const r of okList) {
                        const qid = parseInt(r.ex_question_id);
                        if (!qid) continue;
                        if (!(qid in asheet_map[examinee_id_now])) {
                            asheet_map[examinee_id_now][qid] = {
                                examinee_id: examinee_id_now,
                                ex_question_id: qid,
                                submission: null,
                                score: null,
                                notes: null,
                                reviewer: null,
                            };
                        }
                        asheet_map[examinee_id_now][qid].score = (r.score === null || typeof r.score === 'undefined') ? null : parseFloat(r.score);
                        asheet_map[examinee_id_now][qid].notes = r.notes_obj || r.notes || null;
                        asheet_map[examinee_id_now][qid].reviewer = r.reviewer || null;
                        try { SyncQuestionDisplay(question_map[qid]); } catch (e) {}
                        try { UpdateQuestionNavScore(qid); } catch (e) {}
                    }
                    ReinitExamineeScore(examinee_id_now);
                    review_examinee_table.bootstrapTable('updateByUniqueId', { id: examinee_id_now });
                    AnimateDelayScoreChange(parseFloat(stu_score_span.text() || 0).toFixed(1), score_map?.[examinee_id_now]?.total, stu_score_span);

                    if (failList.length) {
                        const rows = failList.map(r => {
                            const qid = r.ex_question_id;
                            const q = question_map?.[qid];
                            const title = ReviewTruncateText(q?.title || '', 24);
                            const pkindName = ReviewGetQuestionTypeName(q?.pkind, '');
                            return `<li class="list-group-item">
                                <div class="fw-semibold">qid=${qid} <span class="text-muted small">(${pkindName})</span></div>
                                <div class="text-muted small">${title}</div>
                                <div class="text-danger small">${r.msg || 'failed'}</div>
                            </li>`;
                        }).join('');
                        alerty.alert({
                            title: '<span class="text-warning bilingual-inline">部分题目提交失败<span class="en-text">Some failed</span></span>',
                            message: `<div class="mb-2 text-muted small">成功：${okList.length} 题，失败：${failList.length} 题${skippedNoAsheet.length ? `，跳过：${skippedNoAsheet.length} 题（未作答）` : ''}</div><ul class="list-group list-group-flush">${rows}</ul>`,
                        });
                    } else {
                        const skipCn = skippedNoAsheet.length ? `（跳过 ${skippedNoAsheet.length} 题：未作答）` : '';
                        const skipEn = skippedNoAsheet.length ? ` (skipped ${skippedNoAsheet.length}: not answered)` : '';
                        alerty.success(`已保存 ${okList.length} 题${skipCn}`, `Saved ${okList.length} questions${skipEn}`);
                    }
                }
            );
        }
    });
}

// 绑定按钮事件（事件委托，避免重复绑定）
$(document).ready(function () {
    $(document).off('click.review_score_download').on('click.review_score_download', '.button_review_score_download', function () {
        ReviewDownloadScore();
    });
    $(document).off('click.review_score_upload').on('click.review_score_upload', '.button_review_score_upload', function () {
        ReviewUploadScore();
    });
    $(document).off('click.review_score_submit_all').on('click.review_score_submit_all', '.button_review_score_submit_all', function () {
        ReviewSubmitAllScore();
    });
});

// 编程题：点击评测结果，跳转到 status 页面（阅卷页不弹 modal，直接打开提交状态）
$(document).off('click.review_pro_result_show').on('click.review_pro_result_show', '.pro_result_show', function (e) {
    try {
        e.preventDefault();
        e.stopPropagation();
        const sid = this.getAttribute('sid') || '';
        const res = this.getAttribute('res') || '';
        if (!sid) return;
        const base = `/${PAGE_MODULE}/contest/status?cid=${cid}`;
        const url = `${base}&solution_id=${encodeURIComponent(sid)}&result=${encodeURIComponent(res)}#solution_id=${encodeURIComponent(sid)}`;
        window.open(url, '_blank');
    } catch (err) {
        // 降级：不阻断页面
        console.error(err);
    }
});

// 综合题：分数输入变化时，实时更新“未打分”警告状态
$(document).off('input.review_subscore_warn').on('input.review_subscore_warn', '.review_score_input', function () {
    const qid = parseInt(this.getAttribute('qid') || '0', 10);
    if (!qid) return;
    const q = question_map?.[qid];
    if (!q || parseInt(q.pkind) !== 20) return;
    const subq = parseInt(this.getAttribute('q_sub_id') || '-1', 10);
    if (subq >= 0) ReviewSyncComprehensiveSummaryInputs(qid, subq);
    if (subq >= 0) ReviewSyncComprehensiveInputDisabledState(qid, subq);
    ReviewUpdateComprehensiveScoreWarnings(qid);
});

// 综合题：总区输入框 -> 同步到小题旁输入框
$(document).off('input.review_subscore_summary').on('input.review_subscore_summary', '.review_subscore_summary_input', function () {
    const qid = parseInt(this.getAttribute('qid') || '0', 10);
    const subq = parseInt(this.getAttribute('q_sub_id') || '-1', 10);
    if (!qid || subq < 0) return;
    const q = question_map?.[qid];
    if (!q || parseInt(q.pkind) !== 20) return;
    const q_div = question_elements?.[qid] || document.getElementById(`question_div_${qid}`);
    if (!q_div) return;
    const slotInput = q_div.querySelector(`.review_score_input[qid="${qid}"][q_sub_id="${subq}"]`);
    if (!slotInput) return;
    slotInput.value = this.value;
    ReviewSyncComprehensiveSummaryInputs(qid, subq);
    ReviewSyncComprehensiveInputDisabledState(qid, subq);
    ReviewUpdateComprehensiveScoreWarnings(qid);
});

// 综合题：小题底部输入框 -> 同步到小题旁输入框 / 总区输入框
$(document).off('input.review_subscore_bottom').on('input.review_subscore_bottom', '.review_subscore_bottom_input', function () {
    const qid = parseInt(this.getAttribute('qid') || '0', 10);
    const subq = parseInt(this.getAttribute('q_sub_id') || '-1', 10);
    if (!qid || subq < 0) return;
    const q = question_map?.[qid];
    if (!q || parseInt(q.pkind) !== 20) return;
    const q_div = question_elements?.[qid] || document.getElementById(`question_div_${qid}`);
    if (!q_div) return;
    const slotInput = q_div.querySelector(`.review_score_input[qid="${qid}"][q_sub_id="${subq}"]`);
    if (!slotInput) return;
    slotInput.value = this.value;
    ReviewSyncComprehensiveSummaryInputs(qid, subq);
    ReviewSyncComprehensiveInputDisabledState(qid, subq);
    ReviewUpdateComprehensiveScoreWarnings(qid);
});

// 综合题：快调按钮不会触发 input 事件，这里补一次同步（以及总区汇总同步）
$(document).off('click.review_subscore_fast_sync').on('click.review_subscore_fast_sync', '.btn_fast_score', function () {
    const btn = this;
    setTimeout(() => {
        let score_input = btn.parentNode ? btn.parentNode.nextElementSibling : null;
        while (score_input && score_input.tagName && score_input.tagName.toLowerCase() !== 'input') {
            score_input = score_input.nextElementSibling;
        }
        if (!score_input) return;
        const qid = parseInt(score_input.getAttribute('qid') || '0', 10);
        const subq = parseInt(score_input.getAttribute('q_sub_id') || '-1', 10);
        const q = question_map?.[qid];
        if (!qid || !q || parseInt(q.pkind) !== 20 || subq < 0) return;
        // 将“被快调的输入框”作为源，写回到主输入框，再统一同步到总区/底部
        const q_div = question_elements?.[qid] || document.getElementById(`question_div_${qid}`);
        if (q_div) {
            const slotInput = q_div.querySelector(`.review_score_input[qid="${qid}"][q_sub_id="${subq}"]`);
            if (slotInput && slotInput !== score_input) {
                slotInput.value = score_input.value;
            }
        }
        ReviewSyncComprehensiveSummaryInputs(qid, subq);
        ReviewUpdateComprehensiveScoreWarnings(qid);
    }, 0);
});
function InitAllowLang() {
    allow_lang = {};
    allow_lang_key = page_info.attr('allow_lang_key').split(',');
    allow_lang_val = page_info.attr('allow_lang_val').split(',');
    for(let i in allow_lang_key) {
        allow_lang[allow_lang_key[i]] = allow_lang_val[i];
    }
}
function ProcessQuestionFilterStr(qfstr) {
    let qlist = qfstr.split(',');
    let real_qlist = [];
    for(let i in qlist) {
        if(qlist[i].indexOf('-') !== -1) {
            let qlr = qlist[i].split('-');
            if(qlr.length != 2) {
                return false;
            }
            let qns = parseInt(qlr[0]);
            let qnr = parseInt(qlr[1]);
            if(isNaN(qns) || isNaN(qnr)) {
                return false;
            }
            if(qns > qnr) {
                [qns, qnr] = [qnr, qns];
            }
            if(qnr - qns > 4096) {
                return false;
            }
            for(let i = qns; i <= qnr; i ++) {
                real_qlist.push(i);
            }
        } else {
            let qnow = parseInt(qlist[i]);
            if(isNaN(qnow)) {
                return false;
            }
            real_qlist.push(qnow);
        }
    }
    question_filter = real_qlist;
    return true;
}
function InitQuestionFilter() {
    question_filter = [];
    let qc = csg.store('question_filter_cid' + cid);
    if(qc != null) {
        if(ProcessQuestionFilterStr(qc)) {
            question_id_filter_input.val(qc);
        }
    }
}
function GetSinglePassRate(examinee_id, oj_problem_id) {
    // 获取考生编程题 pass_rate
    // oj_problem_id 统一转换为数字类型，确保与存储时的键类型一致
    if(!(examinee_id in oj_solution_best_pass_rate)) return 0;
    
    let problem_id = parseInt(oj_problem_id) || 0;
    if(problem_id <= 0) return 0;
    
    if(!(problem_id in oj_solution_best_pass_rate[examinee_id])) return 0;
    
    let problem_data = oj_solution_best_pass_rate[examinee_id][problem_id];
    if(!problem_data) return 0;
    
    let pass_rate = parseFloat(problem_data.pass_rate) || 0;
    return pass_rate;
}

function ReviewParseSubmissionObject(asheet_single) {
    // 统一把 submission 解析成 object/array（兼容后端存 string 的情况）
    if (!asheet_single) return null;
    const sub = asheet_single.submission;
    if (sub === null || typeof sub === 'undefined') return null;
    if (typeof sub === 'string') {
        try { return JSON.parse(sub); } catch (e) { return null; }
    }
    return sub;
}

function ReviewIsAsheetEffectivelyBlank(question, asheet_single, pass_rate = 0) {
    // 统一判定“未作答该题（默认 0 分且禁评阅）”
    // 兼容两类后端数据：
    // 1) 未交题：asheet_single 为 undefined / {}
    // 2) 误填充空对象/空 submission：asheet_single 存在但内容为空
    if (!question) return true;
    if (!asheet_single || (typeof asheet_single === 'object' && Object.keys(asheet_single).length === 0)) return true;

    // 没有有效的答卷记录（常见于后端填充空对象）
    if (!asheet_single.ex_asheet_id) {
        // 编程题允许仅靠 pass_rate 判断“是否有提交”
        if (parseInt(question.pkind) === 25 && pass_rate > 0) return false;
        return true;
    }

    const pkind = parseInt(question.pkind);
    if (pkind === 25) {
        if (pass_rate > 0) return false;
        const sub = ReviewParseSubmissionObject(asheet_single);
        const code = (sub && typeof sub.code === 'string') ? sub.code.trim() : '';
        return !code;
    }

    const sub = ReviewParseSubmissionObject(asheet_single);
    if (!sub) return true;

    // 选择/判断：submission 通常为数组
    if (pkind < 10) {
        if (!Array.isArray(sub)) return true;
        return sub.length === 0;
    }

    // 填空：submission 为数组（每空一个字符串）
    if (pkind === 10) {
        if (!Array.isArray(sub)) return true;
        return sub.every(v => String(v ?? '').trim() === '');
    }

    // 简答：{text:[...], images:[[...]]}
    if (pkind === 15) {
        const texts = Array.isArray(sub.text) ? sub.text : [];
        const imgs = (Array.isArray(sub.images) && Array.isArray(sub.images[0])) ? sub.images[0] : [];
        const hasText = texts.some(v => String(v ?? '').trim() !== '');
        const hasImg = imgs.some(v => String(v ?? '').trim() !== '');
        return !hasText && !hasImg;
    }

    // 综合：{text:[...], images:[[...],[...],...]}
    if (pkind === 20) {
        const texts = Array.isArray(sub.text) ? sub.text : [];
        const imgsAll = Array.isArray(sub.images) ? sub.images : [];
        const hasText = texts.some(v => String(v ?? '').trim() !== '');
        const hasImg = imgsAll.some(row => Array.isArray(row) && row.some(v => String(v ?? '').trim() !== ''));
        return !hasText && !hasImg;
    }

    // 其他主观题：submission 为空/全空字符串则视作未作答
    if (typeof sub === 'string') return sub.trim() === '';
    return false;
}

function GetQuestionScore(examinee_id, ex_question_id) {
    // 考生特定题目的分数
    let ret = {
        score: null,
        score_type: 'unscored'
    };
    let question = question_map[ex_question_id];
    if(!question) return ret;
    
    let asheet_single = asheet_map?.[examinee_id]?.[ex_question_id];
    let pass_rate = question.pkind == 25 ? GetSinglePassRate(examinee_id, question.description) : 0;
    
    // 对于编程题，即使没有 asheet_map 记录，如果有 pass_rate，也应该计算自动分数
    if(question.pkind == 25 && !asheet_single && pass_rate > 0) {
        // 编程题：有提交记录但没有 asheet_map 记录，创建虚拟的 asheet_single 用于计算
        asheet_single = {
            examinee_id: examinee_id,
            ex_question_id: ex_question_id,
            submission: null,  // 编程题不需要 submission 来计算分数
            score: null,
            notes: null,
            reviewer: null
        };
    }
    
    // 统一“未作答”判定（综合题常见：后端/聚合逻辑填充空对象或空 submission）
    if (ReviewIsAsheetEffectivelyBlank(question, asheet_single, pass_rate)) {
        ret.score = 0;
        ret.score_type = 'blank';
        return ret;
    }

    if(asheet_single) {
        ret.score = GetManualScore(
                asheet_single, 
                question, 
                question.pscore,
                pass_rate
            );
        if(ret.score === null){
            if(CanAutoScore(question.pkind)) {
                ret.score = GetAutoScore(
                    asheet_single, 
                    question, 
                    question.pscore,
                    pass_rate
                );
                ret.score_type = 'auto';
            }
        } else {
            ret.score_type = 'manual';
        }
    } else {
        // 考生未答该题
        // 对于编程题，如果没有 asheet_map 记录且没有 pass_rate，才是真正的未答
        if(question.pkind == 25 && pass_rate == 0) {
            ret.score = 0;
            ret.score_type = 'blank';
        } else if(question.pkind != 25) {
            ret.score = 0;
            ret.score_type = 'blank';
        } else {
            // 编程题：理论上不应该到这里，但为了安全起见
            ret.score = 0;
            ret.score_type = 'blank';
        }
    }
    return ret;
}
function PkindScoreType(pkind) {
    if(pkind < 10) return 0;                    // 纯客观题（选择、判断）
    if(pkind == 10 || pkind == 25) return 1;    // 能自动打分的题（填空、编程）
    return 2;                                   // 其它常规题
}
function ReinitExamineeScore(examinee_id) {
    // 初始化特定考生打分情况
    score_map[examinee_id] = {};
    score_map[examinee_id].total = 0;
    score_map[examinee_id].attach = 0;
    score_map[examinee_id].score_cnt = [0, 0, 0, 0];     // [纯客观题（选择、判断）,能自动打分的题（填空、编程）,其它常规题] 手动打分个数
    score_map[examinee_id].blank_cnt = [0, 0, 0, 0];     // [纯客观题（选择、判断）,能自动打分的题（填空、编程）,其它常规题] 考生没做的题个数
    let last_score = 0;
    for(let i = 0; i < question_list.length; i ++) {
    // for(let ex_question_id in question_map) {
        ex_question_id = question_list[i].ex_question_id;
        score_map[examinee_id][ex_question_id] = GetQuestionScore(examinee_id, ex_question_id);
        if(score_map[examinee_id][ex_question_id].score !== null) {
            score_map[examinee_id][ex_question_id].score = parseFloat(score_map[examinee_id][ex_question_id].score);
        }
        last_score = score_map[examinee_id][ex_question_id].score === null ? 0 : score_map[examinee_id][ex_question_id].score;
        score_map[examinee_id].total += last_score;
        if(score_map[examinee_id][ex_question_id].score_type == 'manual') {
            score_map[examinee_id].score_cnt[PkindScoreType(question_map[ex_question_id].pkind)] ++;
            score_map[examinee_id].score_cnt[3] ++;
        } else if(score_map[examinee_id][ex_question_id].score_type == 'blank') {
            score_map[examinee_id].blank_cnt[PkindScoreType(question_map[ex_question_id].pkind)] ++;
            score_map[examinee_id].blank_cnt[3] ++;
        }
    }
    if(attach_pro) {
        score_map[examinee_id].attach = last_score;
        score_map[examinee_id].total -= last_score;
    }
    score_map[examinee_id].total = score_map[examinee_id].total.toFixed(1);
    return score_map[examinee_id].total;
}
function InitAllScore() {
    // 初始化所有人已打分情况
    score_map = {};
    for(let examinee_id in examinee_map) {
        ReinitExamineeScore(examinee_id);
    }
    review_examinee_table.bootstrapTable('load', examinee_list)
}
function FinishFlag() {
    // 等待关键数据加载. FINISH_TASK_NUM 需在引用页定义
    load_finish_flag ++;
    if(load_finish_flag == FINISH_TASK_NUM) {
        InitAllScore();
        review_examinee_table.bootstrapTable('load', examinee_list);
        loading_div.hide();
        LoadFinishOtherWorks();
        
        // 尝试从 localStorage 恢复上次选中的考生
        // 延迟执行，确保表格和数据都已加载完成
        setTimeout(() => {
            if(cid && examinee_map) {
                try {
                    const cachedExamineeId = localStorage.getItem(`review_current_examinee_${cid}`);
                    if(cachedExamineeId && examinee_map[cachedExamineeId]) {
                        // 找到缓存的考生，自动选中
                        const cachedRow = examinee_map[cachedExamineeId];
                        if(cachedRow && typeof SelectExaminee === 'function') {
                            // 确保 DOM 已经准备好
                            if(document.getElementById('review_asheet_panel_wrapper')) {
                                SelectExaminee(cachedRow, true);
                                return; // 已选中考生，不需要显示提示
                            }
                        }
                    }
                } catch(e) {
                    console.warn('Failed to load examinee from localStorage:', e);
                }
            }
            
            // 如果没有缓存的考生，显示提示
            RenderAsheet();
        }, 300);
    }
}
function LoadData() {
    examinee_list = review_examinee_table.bootstrapTable('getData');
    examinee_map = {};
    for(let i in examinee_list) {
        examinee_map[examinee_list[i].team_id] = examinee_list[i];
        examinee_map[examinee_list[i].team_id].idx = parseInt(i);
    }
    load_finish_flag = 0;
    // 获取全局答卷
    asheet_map = {};
    $.get(
        `/${PAGE_MODULE}/contest/asheet_ajax?cid=${cid}`, 
        {
            'fields': ['ex_asheet_id', 'ex_question_id', 'examinee_id', 'submission', 'score', 'notes', 'reviewer'],
            'query_all': 1
        },
        function(data){
            for(let i in data) {
                if(!(data[i].examinee_id in asheet_map)) {
                    asheet_map[data[i].examinee_id] = {};
                }
                asheet_map[data[i].examinee_id][data[i].ex_question_id] = data[i];
                asheet_map[data[i].examinee_id][data[i].ex_question_id].submission = $.parseJSON(asheet_map[data[i].examinee_id][data[i].ex_question_id].submission);
            }
            FinishFlag();
        }
    );
    // 获取所有题目
    question_map = {};
    question_qtype_cnt = [0, 0, 0, 0];
    // question_list = [];
    $.get(`/${PAGE_MODULE}/contest/problemset_ajax?cid=${cid}`, {'with_answer': 1},function(data){
        question_list = data;
        for(let i in data) {
            question_map[data[i].ex_question_id] = data[i];
            question_map[data[i].ex_question_id].answerParsed = $.parseJSON(question_map[data[i].ex_question_id].answer);
            question_qtype_cnt[PkindScoreType(data[i].pkind)] ++;
            question_qtype_cnt[3] ++;
        }
        FinishFlag();
    });
    // 获取编程题详情
    oj_problemset = {};
    $.get(`/${PAGE_MODULE}/contest/oj_problemset_ajax?cid=${cid}`, function(data){
        try {
            for(let i in data) {
                oj_problemset[data[i]['problem_id']] = data[i];
            }
        } catch(e) {
            console.error('get problemset error: ', e);
        }
        FinishFlag();
    });
    // 获取编程题答题通过率和代码
    oj_solution_best_pass_rate = {};
    $.get(`/${PAGE_MODULE}/admin/oj_solution_ajax?cid=${cid}`, function(data){
        try {
            let examinee_prefix = `#cpc${cid}_`;
            for(let i in data) {
                if (!data[i] || !data[i].user_id) continue;
                let examinee_id = data[i].user_id.replace(examinee_prefix, '');
                if(!(examinee_id in oj_solution_best_pass_rate)) {
                    oj_solution_best_pass_rate[examinee_id] = {};
                }
                // 统一使用数字类型的 problem_id 作为键，确保类型一致
                let problem_id = parseInt(data[i].problem_id) || 0;
                if(problem_id <= 0) continue;  // 无效的 problem_id
                
                let current_pass_rate = parseFloat(data[i].pass_rate) || 0;
                let current_solution_id = parseInt(data[i].solution_id) || 0;
                
                // 每个人每道题最优 pass_rate 的最后 solution
                // 规则：优先选择 pass_rate 最大的，如果 pass_rate 相等，选择 solution_id 最大的
                if(!(problem_id in oj_solution_best_pass_rate[examinee_id])) {
                    oj_solution_best_pass_rate[examinee_id][problem_id] = data[i];
                } else {
                    let existing = oj_solution_best_pass_rate[examinee_id][problem_id];
                    let existing_pass_rate = parseFloat(existing.pass_rate) || 0;
                    let existing_solution_id = parseInt(existing.solution_id) || 0;
                    
                    // 如果当前 pass_rate 更大，或者 pass_rate 相等但 solution_id 更大，则更新
                    if(current_pass_rate > existing_pass_rate || 
                       (Math.abs(current_pass_rate - existing_pass_rate) < 0.001 && current_solution_id > existing_solution_id)) {
                        oj_solution_best_pass_rate[examinee_id][problem_id] = data[i];
                    }
                }
            }
        } catch(e) {
            console.error('get problemset error: ', e);
        }
        FinishFlag();
    });
}
function GetAsheetSingle(ex_question_id) {
    let asheet_examinee = examinee_id_now in asheet_map ? asheet_map[examinee_id_now] : {};
    let asheet_single = ex_question_id in asheet_examinee ? asheet_examinee[ex_question_id] : {};
    return asheet_single;
}
/**
 * 同步题目展示：使题目区块的 DOM 与当前答卷（asheet）、评阅状态一致。
 * 会刷新：答卷展示、禁评阅/禁用态、评阅面板（分数/评语）、小题打分 UI、题头得分、考生答卷预览、答案解析展开与数学公式等。
 * 不重绘参考答案（ref-answer-slot）：参考答案仅在题目首次创建时（GetDetailDom）渲染，与打分无关。
 * @param {object} question - 题目数据
 */
function SyncQuestionDisplay(question) {
    let asheet_single = GetAsheetSingle(question.ex_question_id);
    let q_div = question_elements[question.ex_question_id];

    if (!q_div) {
        RenderSingleQuestion(question);
        q_div = question_elements[question.ex_question_id];
    }

    if (q_div) {
        if (question.pkind == 25 && typeof (asheet_single?.submission) !== 'undefined') {
            ChangeAsheetCodeToBestPassRate(asheet_single, question.description);
        }
        QuestionRender.asheet.Render(question, q_div, true, asheet_single);
        QuestionRender.dis.Render(question, q_div, null);
        QuestionRender.review.Render(question, q_div, asheet_single);

        // 未作答：标记禁评阅（综合题会隐藏小题上下打分控件）
        ReviewApplyBlankQuestionUIState(question, q_div);

        // 综合题：把每小题打分移到小题旁（更新后再做一次，保证对齐）
        try {
            if (!q_div.classList.contains('review-question-blank')) {
                ReviewInitComprehensiveSubScoreUI(question, q_div);
            }
        } catch (e) {
            console.error('init comprehensive subscore ui failed', e);
        }
        
        // 更新题目标题行的背景色和得分
        UpdateQuestionHeader(q_div, question);
        
        // 更新考生答卷的 Markdown 预览
        const mdPreviews = q_div.querySelectorAll('.md-answer-preview');
        mdPreviews.forEach(preview => {
            const initialMd = preview.getAttribute('data-initial-md') || '';
            if(initialMd) {
                renderMdPreview(preview, initialMd);
            }
        });
        
        // 处理答案解析预览
        const answerExplainPreviews = q_div.querySelectorAll('.answer-explain-preview-content');
        answerExplainPreviews.forEach(preview => {
            processVditorPlaceholders(preview);
        });
        
        // 重新绑定答案解析/评分建议展开链接
        q_div.querySelectorAll('.answer-explain-expand-link').forEach(link => {
            // 移除旧的事件监听器（如果存在）
            const newLink = link.cloneNode(true);
            link.parentNode.replaceChild(newLink, link);
            
            newLink.addEventListener('click', function(e) {
                e.preventDefault();
                const qid = this.getAttribute('data-qid');
                const previewContent = q_div.querySelector(`.answer-explain-section[data-qid="${qid}"] .answer-explain-preview-content`);
                if(previewContent) {
                    const fullText = previewContent.getAttribute('data-full-text');
                    if(fullText) {
                        const decodedText = ReviewDecodeHtml(fullText);
                        ShowAnswerExplainModal(decodedText, qid);
                    }
                }
            });
        });

        q_div.querySelectorAll('.score-advice-expand-link').forEach(link => {
            const newLink = link.cloneNode(true);
            link.parentNode.replaceChild(newLink, link);
            newLink.addEventListener('click', function(e) {
                e.preventDefault();
                const qid = this.getAttribute('data-qid');
                const previewContent = q_div.querySelector(`.score-advice-section[data-qid="${qid}"] .score-advice-preview-content`);
                if (previewContent) {
                    const fullText = previewContent.getAttribute('data-full-text');
                    if (fullText) {
                        const decodedText = ReviewDecodeHtml(fullText);
                        ShowAnswerExplainModal(decodedText, qid);
                    }
                }
            });
        });
        
        // 重新渲染数学公式（所有依赖已全局引入）
        setTimeout(() => {
            MathRender('.marked_math_div', q_div, true);
            MathRender('.md_display_div', q_div, true);
        }, 100);
        
        UpdateQuestionNavScore(question.ex_question_id);
    }
}

function RenderSingleQuestion(question) {
    // 渲染单个题目到列表容器
    let asheet_single = GetAsheetSingle(question.ex_question_id);
    
    if(question.pkind == 25 && typeof(asheet_single?.submission) !== 'undefined') {
        ChangeAsheetCodeToBestPassRate(asheet_single, question.description);
    }
    
    let cache_name = `${examinee_id_now}#${question.ex_question_id}`;
    let q_div;
    
    if(cache_name in question_html_cache) {
        q_div = question_html_cache[cache_name].cloneNode(true);
    } else {
        q_div = GetDetailDom(
            question,
            oj_problemset,
            asheet_single,
            true,   // show
            true,   // asheet_display
            true,   // disable_display
            true,   // answer_display
            false,  // review_display
            true    // math_process
        );
        question_html_cache[cache_name] = q_div.cloneNode(true);
    }
    
    // 添加阅卷面板
    QuestionRender.review.Render(question, q_div, asheet_single);

    // 未作答：标记禁评阅（综合题会隐藏小题上下打分控件）
    ReviewApplyBlankQuestionUIState(question, q_div);
    
    // 如果有待导入的评分，优先填入界面（不提交）
    try {
        ReviewTryApplyPendingImport(question);
    } catch (e) {}

    // 添加题目标题行（带背景色）
    AddQuestionHeader(q_div, question);
    
    // 添加到容器
    question_list_container.append(q_div);
    question_elements[question.ex_question_id] = q_div;
    
    // 处理 vditor 占位符（题目描述、选项等）
    processVditorPlaceholders(q_div);

    // 综合题：把每小题打分移到小题旁（避免被 vditor 处理覆盖）
    try {
        if (!q_div.classList.contains('review-question-blank')) {
            ReviewInitComprehensiveSubScoreUI(question, q_div);
        }
    } catch (e) {
        console.error('init comprehensive subscore ui failed', e);
    }
    
    // 处理考生答卷的 Markdown 预览（填空、简答、综合题）
    const mdPreviews = q_div.querySelectorAll('.md-answer-preview');
    mdPreviews.forEach(preview => {
        const initialMd = preview.getAttribute('data-initial-md') || '';
        if(initialMd) {
            // 清空现有内容，重新渲染
            preview.innerHTML = '';
            renderMdPreview(preview, initialMd);
        }
    });
    
    // 处理答案解析预览
    const answerExplainPreviews = q_div.querySelectorAll('.answer-explain-preview-content');
    answerExplainPreviews.forEach(preview => {
        // 处理预览中的占位符
        processVditorPlaceholders(preview);
    });
    
    // 绑定答案解析/评分建议展开链接点击事件
    q_div.querySelectorAll('.answer-explain-expand-link').forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const qid = this.getAttribute('data-qid');
            const previewContent = q_div.querySelector(`.answer-explain-section[data-qid="${qid}"] .answer-explain-preview-content`);
            if(previewContent) {
                const fullText = previewContent.getAttribute('data-full-text');
                if(fullText) {
                    const decodedText = ReviewDecodeHtml(fullText);
                    ShowAnswerExplainModal(decodedText, qid);
                }
            }
        });
    });

    q_div.querySelectorAll('.score-advice-expand-link').forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const qid = this.getAttribute('data-qid');
            const previewContent = q_div.querySelector(`.score-advice-section[data-qid="${qid}"] .score-advice-preview-content`);
            if (previewContent) {
                const fullText = previewContent.getAttribute('data-full-text');
                if (fullText) {
                    const decodedText = ReviewDecodeHtml(fullText);
                    ShowAnswerExplainModal(decodedText, qid);
                }
            }
        });
    });
    
    // 处理编程题的 OJ 题目内容（description, input, output, hint）
    // 这些内容通常已经是 HTML 格式，但如果有纯文本 Markdown 内容也需要渲染
    const mdDisplayDivs = q_div.querySelectorAll('.md_display_div');
    mdDisplayDivs.forEach(div => {
        // 检查是否是纯文本 Markdown（不是 HTML）
        const textContent = div.textContent || div.innerText || '';
        const htmlContent = div.innerHTML.trim();
        // 如果内容主要是文本且包含 Markdown 语法，尝试渲染
        if(textContent && htmlContent === textContent && 
           (htmlContent.includes('```') || htmlContent.includes('$$') || 
            htmlContent.includes('**') || htmlContent.includes('#'))) {
            const originalContent = htmlContent;
            div.innerHTML = '';
            renderMdPreview(div, originalContent);
        }
    });
    
    // 渲染数学公式（在 vditor 渲染之后，所有依赖已全局引入）
    setTimeout(() => {
        MathRender('.marked_math_div', q_div, true);
        MathRender('.md_display_div', q_div, true);
    }, 200);
}
function ChangeAsheetCodeToBestPassRate(asheet_single, problem_id) {
    // problem_id 统一转换为数字类型，确保与存储时的键类型一致
    let problem_id_num = parseInt(problem_id) || 0;
    if(problem_id_num <= 0) return;
    
    if(oj_solution_best_pass_rate?.[asheet_single.examinee_id]?.[problem_id_num]) {
        let solution_data = oj_solution_best_pass_rate[asheet_single.examinee_id][problem_id_num];
        asheet_single.submission = {
            code: solution_data.source,
            lang: solution_data.language,
            result: solution_data.result,
            solution_id: solution_data.solution_id,
        }
    }
}
function DetailView(row) {
    let asheet_single = GetAsheetSingle(row.ex_question_id);
    let cache_name = `${examinee_id_now}#${row.ex_question_id}`;
    if(!(cache_name in question_html_cache)) {
        if(row.pkind == 25 && typeof(asheet_single?.submission) !== 'undefined') {
            // 编程题用pass_rate最大的、最后提交的代码 替换 全局最后一次。即用最高分一次而不是最后一次。
            ChangeAsheetCodeToBestPassRate(asheet_single, row.description);
        }
        question_html_cache[cache_name] = GetDetailDom(
            row, 
            oj_problemset,  // problemset
            asheet_single,  // asheet_single
            true,           // show
            true,           // asheet_display
            true,           // disable_display
            true,           // answer_display
            false,          // review_display
            true            // math_process
        );
    }
    let q_div = question_html_cache[cache_name];
    QuestionRender.review.Render(row, q_div, asheet_single);
    return q_div;
}
function RenderAsheet() {
    // 清空容器
    question_list_container.empty();
    question_elements = {};
    
    // 如果没有选择考生，显示提示
    if(examinee_id_now === null) {
        if(review_empty_hint) {
            review_empty_hint.removeClass('hidden');
        }
        UpdateQuestionNav();  // 清空导航菜单
        return;
    }
    
    // 过滤题目列表
    let filtered_questions = question_list;
    if(question_filter && question_filter.length > 0) {
        filtered_questions = question_list.filter(q => question_filter.includes(q.num));
    }
    
    // 如果有题目，隐藏提示并渲染
    if(filtered_questions.length > 0) {
        if(review_empty_hint) {
            review_empty_hint.addClass('hidden');
        }
        
        // 渲染所有题目
        filtered_questions.forEach(question => {
            RenderSingleQuestion(question);
        });
        
        // 更新导航菜单
        UpdateQuestionNav();
        
        // 滚动到顶部
        $('#review_asheet_panel_wrapper').scrollTop(0);
        
        first_render_flag = true;
    } else {
        // 没有题目，显示提示
        if(review_empty_hint) {
            review_empty_hint.removeClass('hidden');
        }
        UpdateQuestionNav();  // 清空导航菜单
    }
}
function SelectExaminee(row, scroll=false) {
    let scroll_position = review_examinee_table.bootstrapTable('getScrollPosition');
    if(examinee_id_now != null) {
        review_examinee_table.bootstrapTable('updateByUniqueId', {
            id: examinee_id_now,
            row: {'selected_review': false}
        });
    }
    examinee_id_now = row.team_id;    // global signal，重要
    review_examinee_table.bootstrapTable('updateByUniqueId', {
        id: examinee_id_now,
        row: {'selected_review': true}
    });
    
    // 保存当前选中的考生到 localStorage
    if(cid) {
        try {
            localStorage.setItem(`review_current_examinee_${cid}`, examinee_id_now);
        } catch(e) {
            console.warn('Failed to save examinee to localStorage:', e);
        }
    }
    
    // 清空缓存（切换考生时）
    question_html_cache = {};
    
    RenderAsheet();
    
    if(scroll) {
        review_examinee_table.bootstrapTable('scrollTo', {unit: 'rows', value: row.idx >= 3 ? row.idx - 3 : 0});
    } else {
        review_examinee_table.bootstrapTable('scrollTo', scroll_position);
    }
    stu_info_span.text(`${row.team_id}-${row.name}`);
    stu_score_span.text(score_map?.[row.team_id]?.total || '-');
}
function PreviousExaminee() {
    if(examinee_id_now === null ) {
        SelectExaminee(examinee_list[examinee_list.length - 1]);
    } else {
        let idx_nex = examinee_map[examinee_id_now].idx - 1;
        if(idx_nex < 0) {
            return;
        }
        SelectExaminee(examinee_list[idx_nex], true);
    }
}
function NextExaminee() {
    if(examinee_id_now === null ) {
        SelectExaminee(examinee_list[0]);
    } else {
        let idx_nex = examinee_map[examinee_id_now].idx + 1;
        if(idx_nex >= examinee_list.length) {
            return;
        }
        SelectExaminee(examinee_list[idx_nex], true);
    }
    
}
function UpdateNavHighlight() {
    // 根据滚动位置高亮当前题目
    if(!examinee_id_now) return;
    
    let scrollContainer = $('#review_asheet_panel_wrapper');
    let containerElement = scrollContainer[0];
    if(!containerElement) return;
    
    let scrollTop = containerElement.scrollTop; // scrollTop 是属性，不是函数
    let toolbarHeight = $('#review_question_toolbar').outerHeight() || 0;
    let containerRect = containerElement.getBoundingClientRect();
    let viewportTop = scrollTop + toolbarHeight + 20; // 考虑工具栏和间距
    
    let currentHighlight = null;
    let minDistance = Infinity;
    
    Object.keys(question_elements).forEach(ex_question_id => {
        let q_div = question_elements[ex_question_id];
        if(!q_div) return;
        
        // 使用 getBoundingClientRect 获取相对于滚动容器的位置
        let elementRect = q_div.getBoundingClientRect();
        let elementTopRelativeToContainer = elementRect.top - containerRect.top + scrollTop;
        
        // 计算元素顶部到视口顶部的距离
        let distance = Math.abs(elementTopRelativeToContainer - viewportTop);
        
        // 如果元素在视口顶部附近（容差100px），且距离最小，则高亮
        if(elementTopRelativeToContainer <= viewportTop + 100 && distance < minDistance) {
            minDistance = distance;
            currentHighlight = ex_question_id;
        }
    });
    
    if(currentHighlight) {
        question_nav_content.find('.question-nav-item').removeClass('active');
        question_nav_content.find(`[data-qid="${currentHighlight}"]`).addClass('active');
    }
}

// **************************************************
// examinee panel
function RowStyle(row, index) {
    let rcls = '';
    if('selected_review' in row && row.selected_review) {
        rcls = 'table-dark';
    } 
    else if(score_map != null && row.team_id in score_map) {
        let score_cnt = score_map[row.team_id].score_cnt;
        let blank_cnt = score_map[row.team_id].blank_cnt;
        if(score_cnt[2] > 0) {
            rcls = 'table-secondary';
        }
        if(score_cnt[2] + blank_cnt[2] == question_qtype_cnt[2]) {
            rcls = 'table-success';
            if(score_cnt[1] > 0) {
                rcls = 'table-warning';
            }
            if(score_cnt[1] + blank_cnt[1] == question_qtype_cnt[1]) {
                rcls = 'table-info';
            }
        }
    }
    return {'classes' : rcls};
}
function FormatterIdx(value, row, index, field) {
    return `<span class="text-muted small">${value}</span>`;
}

function FormatterExaminee(value, row, index, field) {
    const school = row.school ? `<span class="text-muted small d-block">${row.school}</span>` : '';
    const room = row.room ? `<span class="text-muted small">${row.room}</span>` : '';
    return `<div title="${value} | ${row.name} | ${row.school || ''} | ${row.room || ''}">
        <div class="fw-semibold">${value}</div>
        ${school}
        ${room}
    </div>`;
}

function FormatterName(value, row, index, field) {
    return `<span class="small">${value || '-'}</span>`;
}

function FormatterExamineeScore(value, row, index, field) {
    let score;
    if(typeof(score_map) != 'undefined' && score_map != null && (score_map?.[row.team_id]?.total)) {
        score = score_map[row.team_id].total;
        if(typeof(score_star_for_obj) != 'undefined' && score_star_for_obj && score_map[row.team_id].score_cnt[0]) {
            score = `${score}*`;
        }
    } else {
        score = '-';
    }
    row.examinee_score = score;
    return `<span id='escore_tid_${row.team_id}' class="fw-bold">${score}</span>`;
}

// **************************************************
// question answer sheet  panel
function FormatterNum(value, row, index, field) {
    return value;
}
function FormatterQuestionTitle(value, row, index, field) {
    let width = asheet_table_width - 350;
    return `<div id='q_title_${row["ex_question_id"]}'><span class='d-inline-block text-truncate' title='${value}' style='width:${width}px;'>${value}</span></div>`;
}
function ScoreSpanTitle(cellscore) {
    let titleret = '';
    switch(cellscore.score_type) {
        case 'manual':      titleret='人工判分';   break;
        case 'auto':        titleret='自动判分';   break;
        case 'blank':       titleret='未解答0分';  break;
        case 'unscored':    titleret='未判分';     break;
    }
    return titleret;
}
function CellScoreRet(row, field) {
    // for FormatterScore and StyleScore
    return score_map?.[examinee_id_now]?.[row.ex_question_id];
}
function FormatterScore(value, row, index, field) {
    let ret = CellScoreRet(row, field), title = '';
    if(ret == null || typeof(ret) == 'undefined') return '-';
    title = ScoreSpanTitle(ret);
    return `<span id='qscore_qid_${row.ex_question_id}' title='${title}'>${ret.score}</span>`;
}
function StyleScore(value, row, index, field) {
    let ret = CellScoreRet(row, field);
    let color, cls;
    if(ret == null || typeof(ret) == 'undefined') {
        color = 'white';
        cls = '';
    } else {
        switch(ret.score_type) {
            case 'manual':      color='darkgreen';      cls='table-success';    break;
            case 'auto':        color='darkgoldenrod';  cls='table-warning';    break;
            case 'blank':       color='darkred';        cls='table-danger';    break;
            case 'unscored':    color='black';          cls='table-secondary';   break;
        }
    }
    return {
        css: {
            'font-weight': 'bold',
            'color': color
        },
        classes: [
            cls
        ]
    }
}
function DetailFormatterAsheet(index, row) {
    return DetailView(row);
}
function SubmitSingleReview(cid, question) {
    const collected = ReviewCollectReviewPayloadFromDom(question);
    if (!collected.ok) {
        alerty.error(collected.msg || '提交数据不合法');
        return;
    }
    $.post(
        'set_score_ajax?cid=' + cid,
        {
            'examinee_id': examinee_id_now,
            'ex_question_id': question.ex_question_id,
            'notes': collected.notesStr,
            'score': collected.scoreSum
        },
        function(ret) {
            if(ret.code == 1) {
                alerty.success(ret.msg);
                // Update Things after change score
                if(!(examinee_id_now in asheet_map)) asheet_map[examinee_id_now] = {};
                if(!(question.ex_question_id in asheet_map[examinee_id_now])) {
                    asheet_map[examinee_id_now][question.ex_question_id] = {
                        examinee_id: examinee_id_now,
                        ex_question_id: question.ex_question_id,
                        submission: null,
                        score: null,
                        notes: null,
                        reviewer: null,
                    };
                }
                asheet_map[examinee_id_now][question.ex_question_id].score = collected.scoreSum == -1 ? null : collected.scoreSum;
                asheet_map[examinee_id_now][question.ex_question_id].notes = collected.notesObj;
                asheet_map[examinee_id_now][question.ex_question_id].reviewer = ret.data?.asheet_update?.reviewer;
                ReinitExamineeScore(examinee_id_now);
                review_examinee_table.bootstrapTable('updateByUniqueId', {
                    id: examinee_id_now
                });
                // 同步题目展示（分数、评语、小题打分 UI 等）
                SyncQuestionDisplay(question);
                // 更新导航中的分数
                UpdateQuestionNavScore(question.ex_question_id);
                AnimateDelayScoreChange(parseFloat(stu_score_span.text() || 0).toFixed(1), score_map?.[examinee_id_now]?.total, stu_score_span);
            } else {
                alerty.error(ret.msg);
            }
        }
    );
}
function ShiningScoreChange(cls_color, score_nex, leftCnt=3) {
    if(leftCnt <= 0) {
        stu_score_span.fadeIn('fast');
        stu_score_span.text(score_nex);
        stu_score_span.removeClass(cls_color).addClass('text-danger');
        return;
    } else if(leftCnt & 1) {
        stu_score_span.fadeOut('fast');
    } else {
        stu_score_span.fadeIn('fast');
    }
    setTimeout(() => {
        ShiningScoreChange(cls_color, score_nex, leftCnt - 1);
    }, 200);
}
function AnimateDelayScoreChange(score_now, score_nex) {
    try {
        let cg = (score_nex - score_now).toFixed(1);
        let cls_color;
        if(cg != 0) {
            if(cg > 0) {
                cg = `+${cg}`;
                cls_color = 'text-success';
            } else {
                cls_color = 'text-warning';
            }
            stu_score_span.removeClass('text-danger').addClass(cls_color);
            stu_score_span.text(cg);
            ShiningScoreChange(cls_color, score_nex);
        }
    } catch(e) {
        console.error(e);
    }

}
function SetQuestionFilter(qfstr) {
    if(qfstr == '') {
        question_filter = [];
    }
    if(qfstr == '' || ProcessQuestionFilterStr(qfstr)) {
        csg.store('question_filter_cid' + cid, qfstr);
        if(question_filter.length > 0) {
            alerty.success("将只查看qID=" + question_filter.join(','));
        } else {
            alerty.success("过滤条件已清空");
        }
        // 重新渲染题目列表
        if(examinee_id_now) {
            RenderAsheet();
        }
    } else {
        alerty.error("过滤格式有误");
    }
}

// **************************************************
// 悬浮题目导航功能
// **************************************************
function UpdateQuestionNav() {
    if(!question_nav_content || !examinee_id_now) return;
    
    let filtered_questions = question_list;
    if(question_filter && question_filter.length > 0) {
        filtered_questions = question_list.filter(q => question_filter.includes(q.num));
    }
    
    // 分数显示统一：得分/题目分
    const formatScoreDisplay = (v) => {
        if (v === null || v === undefined || v === '') return '-';
        const n = parseFloat(v);
        if (Number.isNaN(n)) return String(v);
        const s = n.toFixed(1);
        return s.endsWith('.0') ? s.slice(0, -2) : s;
    };

    let navHtml = '';
    filtered_questions.forEach(question => {
        let scoreInfo = GetQuestionScore(examinee_id_now, question.ex_question_id);
        const gotScore = formatScoreDisplay(scoreInfo.score);
        const totalScore = formatScoreDisplay(question.pscore);
        let score = `${gotScore}/${totalScore}`;
        let scoreClass = '';
        let statusColor = '';
        let statusTitle = '';

        // 未作答：最高优先级（红色 + 固定提示）
        if (scoreInfo.score_type === 'blank') {
            scoreClass = 'text-danger';
            statusColor = '#dc3545';
            statusTitle = '考生未答该题判0分';
        }
        
        // 综合题：只有全部小题打分才显示“已打分配色”
        if (!statusTitle && parseInt(question.pkind) === 20) {
            const stats = ReviewGetComprehensiveSubScoreStats(question, question.ex_question_id);
            if (stats.total > 0) {
                if (stats.filled === 0) {
                    scoreClass = 'text-secondary';
                    statusColor = '#6c757d';
                    statusTitle = '综合题：未打分';
                } else if (stats.filled < stats.total) {
                    scoreClass = 'text-secondary';
                    statusColor = '#6c757d';
                    statusTitle = `综合题：部分已打分（${stats.filled}/${stats.total}）`;
                } else {
                    scoreClass = 'text-success';
                    statusColor = '#198754';
                    statusTitle = '综合题：小题已全部打分';
                }
            }
        }

        if (!statusTitle && scoreInfo.score_type === 'manual') {
            scoreClass = 'text-success';
            statusColor = '#198754';  // 绿色 - 已人工批改
            statusTitle = '已人工批改';
        } else if(!statusTitle && scoreInfo.score_type === 'auto') {
            scoreClass = 'text-warning';
            statusColor = '#ffc107';  // 黄色 - 已自动判分
            statusTitle = '已自动判分';
        } else if(!statusTitle) {
            scoreClass = 'text-secondary';
            statusColor = '#6c757d';  // 灰色 - 主观题，尚未人工判分
            statusTitle = '尚未人工判分';
        }
        
        // 截断标题（与考试页保持一致，限制30个字符）
        let titleText = question.title || '题目' + question.num;
        let titleDisplay = titleText;
        if (titleText.length > 30) {
            titleDisplay = titleText.substring(0, 30) + '...';
        }
        const fullTitle = `${question.num}. ${titleText}`;
        
        // 获取题目类型颜色和名称
        const pkindColor = question_default.pkind_color[question.pkind];
        const pkindName = question_default.pkind_table_cn[question.pkind];
        
        // statusTitle 已在上方统一计算（综合题优先）
        
        navHtml += `
            <div class="question-nav-item" 
                 data-qid="${question.ex_question_id}" 
                 data-num="${question.num}" 
                 style="--score-status-color: ${statusColor}; --pkind-color: ${pkindColor};"
                 data-status-title="${statusTitle}"
                 data-pkind-title="${pkindName}">
                <span class="nav-item-title" title="${fullTitle}">${question.num}. ${titleDisplay}</span>
                <span class="nav-item-score ${scoreClass}">${score}</span>
            </div>
        `;
    });
    
    question_nav_content.html(navHtml);
    
    // 简单的 tooltip 实现
    let navTooltip = null;
    function showNavItemTooltip(event, text) {
        if (!navTooltip) {
            navTooltip = $('<div class="nav-item-tooltip"></div>');
            $('body').append(navTooltip);
        }
        navTooltip.text(text).css({
            left: event.pageX + 10,
            top: event.pageY + 10,
            display: 'block'
        });
    }
    function hideNavItemTooltip() {
        if (navTooltip) {
            navTooltip.hide();
        }
    }
    
    // 绑定点击事件和设置 title 提示
    question_nav_content.find('.question-nav-item').each(function() {
        const $item = $(this);
        const qid = $item.data('qid');
        
        // 绑定点击事件
        $item.on('click', function() {
            ScrollToQuestion(qid);
        });
        
        // 根据鼠标位置显示不同的提示
        $item.on('mousemove', function(e) {
            const item = this;
            const rect = item.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            
            // 左侧 0-8px 区域：状态颜色提示
            if (x >= 0 && x <= 8) {
                const statusTitle = $item.attr('data-status-title');
                if (statusTitle) {
                    showNavItemTooltip(e, statusTitle);
                    return;
                }
            }
            // 右侧区域（最后 8px）：题目类型颜色提示
            else if (x >= rect.width - 8 && x <= rect.width) {
                const pkindTitle = $item.attr('data-pkind-title');
                if (pkindTitle) {
                    showNavItemTooltip(e, pkindTitle);
                    return;
                }
            }
            // 其他区域：隐藏 tooltip
            hideNavItemTooltip();
        });
        
        $item.on('mouseleave', function() {
            hideNavItemTooltip();
        });
    });
}

function UpdateQuestionNavScore(ex_question_id) {
    if(!examinee_id_now) return;
    let navItem = question_nav_content.find(`[data-qid="${ex_question_id}"]`);
    if(navItem.length === 0) return;
    
    let question = question_map[ex_question_id];
    if(!question) return;
    
    const formatScoreDisplay = (v) => {
        if (v === null || v === undefined || v === '') return '-';
        const n = parseFloat(v);
        if (Number.isNaN(n)) return String(v);
        const s = n.toFixed(1);
        return s.endsWith('.0') ? s.slice(0, -2) : s;
    };

    let scoreInfo = GetQuestionScore(examinee_id_now, ex_question_id);
    const gotScore = formatScoreDisplay(scoreInfo.score);
    const totalScore = formatScoreDisplay(question.pscore);
    let score = `${gotScore}/${totalScore}`;
    let scoreClass = '';
    let statusColor = '';
    let statusTitle = '';

    // 未作答：最高优先级（红色 + 固定提示）
    if (scoreInfo.score_type === 'blank') {
        scoreClass = 'text-danger';
        statusColor = '#dc3545';
        statusTitle = '考生未答该题判0分';
        navItem.css('--score-status-color', statusColor);
        navItem.attr('data-status-title', statusTitle);
        navItem.find('.nav-item-score').text(score).removeClass('text-success text-warning text-danger text-secondary').addClass(scoreClass);
        return;
    }

    // 综合题：只有所有小题都打分，才显示“已打分配色”；否则保持未打分配色，并区分提示
    if (parseInt(question.pkind) === 20) {
        const stats = ReviewGetComprehensiveSubScoreStats(question, ex_question_id);
        if (stats.total > 0) {
            if (stats.filled === 0) {
                scoreClass = 'text-secondary';
                statusColor = '#6c757d';
                statusTitle = '综合题：未打分 / Comprehensive: not scored';
            } else if (stats.filled < stats.total) {
                scoreClass = 'text-secondary';
                statusColor = '#6c757d';
                statusTitle = `综合题：部分已打分（${stats.filled}/${stats.total}） / Comprehensive: partially scored`;
            } else {
                scoreClass = 'text-success';
                statusColor = '#198754';
                statusTitle = '综合题：小题已全部打分 / Comprehensive: fully scored';
            }
            navItem.css('--score-status-color', statusColor);
            navItem.attr('data-status-title', statusTitle);
            navItem.find('.nav-item-score').text(score).removeClass('text-success text-warning text-danger text-secondary').addClass(scoreClass);
            return;
        }
    }
    
    if(scoreInfo.score_type === 'manual') {
        scoreClass = 'text-success';
        statusColor = '#198754';
        statusTitle = '已人工批改 / Manually graded';
    } else if(scoreInfo.score_type === 'auto') {
        scoreClass = 'text-warning';
        statusColor = '#ffc107';
        statusTitle = '已自动判分 / Auto scored';
    } else {
        scoreClass = 'text-secondary';
        statusColor = '#6c757d';
        statusTitle = '尚未人工判分 / Not graded';
    }
    
    // 更新状态色指示条
    navItem.css('--score-status-color', statusColor);
    navItem.attr('data-status-title', statusTitle);
    
    // 更新分数显示
    navItem.find('.nav-item-score').text(score).removeClass('text-success text-warning text-danger text-secondary').addClass(scoreClass);
}

function ScrollToQuestion(ex_question_id) {
    let q_div = question_elements[ex_question_id];
    if(!q_div) {
        // 如果元素不存在，尝试通过ID查找（使用锚点）
        q_div = document.getElementById(`question_div_${ex_question_id}`);
        if(!q_div) {
            console.warn('Question element not found:', ex_question_id);
            return;
        }
    }
    
    // 获取滚动容器和工具栏
    let scrollContainer = $('#review_asheet_panel_wrapper');
    let containerElement = scrollContainer[0];
    if(!containerElement) return;
    
    let toolbar = $('#review_question_toolbar');
    let toolbarHeight = toolbar.outerHeight() || 0;
    let padding = 20; // 顶部间距
    
    // 计算相对于滚动容器的位置
    // 使用 getBoundingClientRect() 获取元素相对于视口的位置
    let containerRect = containerElement.getBoundingClientRect();
    let elementRect = q_div.getBoundingClientRect();
    
    // 计算元素相对于滚动容器顶部的距离
    let elementTopRelativeToContainer = elementRect.top - containerRect.top + containerElement.scrollTop;
    
    // 目标滚动位置：元素顶部 - 工具栏高度 - 间距
    let targetScrollTop = elementTopRelativeToContainer - toolbarHeight - padding;
    
    // 确保不超出滚动范围
    targetScrollTop = Math.max(0, Math.min(targetScrollTop, containerElement.scrollHeight - containerElement.clientHeight));
    
    // 使用原生 scrollTo 方法，更准确可靠
    containerElement.scrollTo({
        top: targetScrollTop,
        behavior: 'smooth'
    });
    
    // 高亮当前题目
    question_nav_content.find('.question-nav-item').removeClass('active');
    question_nav_content.find(`[data-qid="${ex_question_id}"]`).addClass('active');
}

// 导航菜单折叠/展开 - 已移至 initQuestionNavCommon，这里保留兼容性
// 注意：实际的展开/收起逻辑现在由 question_nav_common.js 处理

// 添加题目标题行（带背景色）
function AddQuestionHeader(q_div, question) {
    if(!q_div || !question || !examinee_id_now) return;
    
    // 获取题目得分信息
    let scoreInfo = GetQuestionScore(examinee_id_now, question.ex_question_id);
    UpdateQuestionHeaderStyle(q_div, question, scoreInfo);
}

// 更新题目标题行的样式和得分
function UpdateQuestionHeaderStyle(q_div, question, scoreInfo) {
    if(!q_div || !question) return;
    
    let scoreType = scoreInfo ? (scoreInfo.score_type || 'unscored') : 'unscored';
    let scoreTitle = '';

    // 综合题：只有全部小题打分才变色（与题目导航一致）
    if (scoreType !== 'blank' && parseInt(question.pkind) === 20) {
        const qid = parseInt(question.ex_question_id);
        const stats = ReviewGetComprehensiveSubScoreStats(question, qid, q_div);
        if (stats.total > 0) {
            if (stats.filled === 0) {
                scoreType = 'unscored';
                scoreTitle = '综合题：未打分 / Comprehensive: not scored';
            } else if (stats.filled < stats.total) {
                scoreType = 'unscored';
                scoreTitle = `综合题：部分已打分（${stats.filled}/${stats.total}） / Comprehensive: partially scored`;
            } else {
                scoreType = 'manual';
                scoreTitle = '综合题：小题已全部打分 / Comprehensive: fully scored';
            }
        }
    }
    
    // 根据得分类型设置分数区域的背景色和文字颜色
    let scoreBgColor, scoreTextColor;
    switch(scoreType) {
        case 'manual':
            scoreBgColor = '#198754';  // 绿色 - 已人工批改
            scoreTextColor = 'white';
            if (!scoreTitle) scoreTitle = '已人工批改 / Manually graded';
            break;
        case 'auto':
            scoreBgColor = '#ffc107';  // 黄色 - 已自动判分
            scoreTextColor = 'black';
            if (!scoreTitle) scoreTitle = '已自动判分 / Auto scored';
            break;
        case 'blank':
            scoreBgColor = '#dc3545';  // 红色 - 考生未答该题判 0 分
            scoreTextColor = 'white';
            if (!scoreTitle) scoreTitle = '考生未答该题判0分';
            break;
        case 'unscored':
        default:
            scoreBgColor = '#6c757d';  // 灰色 - 主观题，尚未人工判分
            scoreTextColor = 'white';
            if (!scoreTitle) scoreTitle = '尚未人工判分 / Not graded';
            break;
    }
    
    // 获取题目类型颜色和名称
    let pkindColor = question_default.pkind_color[question.pkind];
    let pkindName = question_default.pkind_table_cn[question.pkind];
    let headerTextColor = question_default.pkind_contrast_color[question.pkind];
    
    // 查找或创建标题行
    let header = q_div.querySelector('.question-header-row');
    if(!header) {
        header = document.createElement('div');
        header.className = 'question-header-row';
        q_div.insertBefore(header, q_div.firstChild);
    }
    
    // 更新样式：标题栏使用题目类型颜色
    header.className = 'question-header-row';
    header.style.cssText = `padding: 10px 15px; margin: -15px -15px 15px -15px; border-radius: 10px 10px 0 0; background-color: ${pkindColor}; color: ${headerTextColor}; font-weight: bold;`;
    
    // 更新内容
    let score = scoreInfo && scoreInfo.score !== null ? scoreInfo.score : '-';
    let totalScore = question.pscore !== undefined && question.pscore !== null ? question.pscore : '-';
    
    // 获取 question_id（优先使用 description，如果是编程题；否则显示 ex_question_id）
    let questionId = '';
    if(question.pkind == 25 && question.description) {
        // 编程题：description 就是 OJ 题目 ID
        questionId = question.description.trim();
    } else if(question.ex_question_id) {
        // 其他题目：显示 ex_question_id
        questionId = question.ex_question_id;
    }
    
    header.innerHTML = `
        <div class="d-flex justify-content-between align-items-center" style="color: ${headerTextColor};">
            <div class="d-flex align-items-center">
                <div class="question-number-badge-wrapper me-3" style="display: flex; flex-direction: column; align-items: center;">
                    <div class="d-flex align-items-baseline" style="gap: 6px;">
                        <span class="question-number" style="font-weight: 700; font-size: 1.1em;">
                            ${question.num}
                        </span>
                        ${questionId ? `<span class="question-id-label" style="font-size: 0.75rem; opacity: 0.85; font-weight: 500;">
                            (${questionId})
                        </span>` : ''}
                    </div>
                    <span class="question-type-label" style="font-size: 0.7rem; margin-top: 2px; white-space: nowrap; opacity: 0.9;">
                        ${pkindName}
                    </span>
                </div>
                <span style="font-weight: 600;">${question.title || '题目' + question.num}</span>
            </div>
            <div class="question-score-area" title="${scoreTitle}" style="background-color: ${scoreBgColor}; color: ${scoreTextColor}; padding: 6px 15px; margin: -10px -15px -10px 0; border-radius: 0 10px 0 0; font-weight: bold; min-width: 80px; text-align: center;">
                <span>${score}/${totalScore}</span>
            </div>
        </div>
    `;
}

// 根据背景色计算对比文字颜色（WCAG 标准）
function getContrastColor(hexColor) {
    if(!hexColor) return 'white';
    
    // 移除 # 号
    hexColor = hexColor.replace('#', '');
    
    // 转换为 RGB
    let r = parseInt(hexColor.substring(0, 2), 16);
    let g = parseInt(hexColor.substring(2, 4), 16);
    let b = parseInt(hexColor.substring(4, 6), 16);
    
    // 转换为 0-1 范围
    r /= 255;
    g /= 255;
    b /= 255;
    
    // 应用 gamma 校正
    r = r <= 0.03928 ? r / 12.92 : Math.pow((r + 0.055) / 1.055, 2.4);
    g = g <= 0.03928 ? g / 12.92 : Math.pow((g + 0.055) / 1.055, 2.4);
    b = b <= 0.03928 ? b / 12.92 : Math.pow((b + 0.055) / 1.055, 2.4);
    
    // 计算相对亮度
    const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    
    // 使用 0.179 作为阈值（确保良好的对比度）
    return luminance > 0.179 ? 'black' : 'white';
}

// 更新题目标题行
function UpdateQuestionHeader(q_div, question) {
    if(!q_div || !question || !examinee_id_now) return;
    let scoreInfo = GetQuestionScore(examinee_id_now, question.ex_question_id);
    UpdateQuestionHeaderStyle(q_div, question, scoreInfo);
}

// 显示答案解析 Modal
function ShowAnswerExplainModal(explainText, qid) {
    if(!explainText || !explainText.trim()) {
        // 如果内容为空，不打开modal
        return;
    }
    
    const modal = $('#answer_explain_modal');
    const modalContent = $('#answer_explain_modal_content');
    
    // 清空内容
    modalContent.empty();
    
    // 创建容器用于 vditor 渲染
    const container = document.createElement('div');
    container.className = 'answer-explain-full-render';
    modalContent.append(container);
    
    // 使用 vditor 渲染
    renderMdPreview(container, explainText);
    
    // 渲染数学公式（所有依赖已全局引入）
    setTimeout(() => {
        MathRender('.marked_math_div', container, true);
    }, 200);
    
    // 显示 modal
    const bsModal = new bootstrap.Modal(modal[0]);
    bsModal.show();
}
