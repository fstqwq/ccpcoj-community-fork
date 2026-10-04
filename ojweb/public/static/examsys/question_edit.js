// 题目编辑页面逻辑（vditor + 动态表单）
// 仅使用一个 vditor 实例，用于所有文本编辑弹窗

let vditorSingleton = null;
let vditorModal, vditorSaveBtn, vditorTitle;
let currentVditorSave = null;

let pkind = 0;
let state = {
    description: '',
    content: [],
    answer: [],
    answerExplain: '', // 统一单段解析
    tmp_uuid: '', // 新增题目时：答案图临时上传工作目录标识
    scoreAdvice: '', // 简答/综合：评分建议（写入 answer_explain）
    _localAnswerImg: {}, // 仅前端：答案图本地预览 blob URL（不入库）
    _tmpAnswerImages: {}, // 仅前端：待保存的临时答案图（key: `${sub_idx}_${req_idx}` => tmp file_name）
};

const el = (sel) => document.querySelector(sel);
const elAll = (sel) => Array.from(document.querySelectorAll(sel));

let initialSnapshot = null;
let isDirty = false;
let currentProblem = null; // programming only

function isProgramming() { return pkind === 25; }

function setSubmitEnabled(flag) {
    const btns = [
        el('#submit_button'),
        document.querySelector('button[form="question_edit_form"]'),
    ];
    btns.forEach((btn) => {
        if (!btn) return;
        btn.disabled = !flag;
        btn.classList.toggle('disabled', !flag);
    });
}

function markDirty() {
    if (!isDirty) {
        isDirty = true;
        setSubmitEnabled(true);
    }
}

function safeParse(str, fallback) {
    if (str === undefined || str === null || String(str).trim() === '') return fallback;
    try { return JSON.parse(str); } catch (e) { return fallback; }
}

/**
 * 规范化答案格式（兼容旧格式）
 * 简答题：["答案"] -> [{"answer": "答案", "answer_images": []}]
 * 综合题：["答案1", "答案2"] -> [{"answer": "答案1", "answer_images": []}, {"answer": "答案2", "answer_images": []}]
 */
function normalizeAnswerFormat(answer, pkind) {
    if (!Array.isArray(answer)) {
        answer = [answer];
    }
    if (pkind === 15) {
        // 简答题
        if (answer.length === 0) {
            return [{ answer: '', answer_images: [] }];
        }
        // 兼容旧格式：如果是字符串，转换为新格式
        if (typeof answer[0] === 'string') {
            return [{ answer: answer[0], answer_images: [] }];
        }
        // 新格式：确保有 answer 和 answer_images 字段
        if (typeof answer[0] === 'object' && answer[0] !== null) {
            return [{
                answer: answer[0].answer || '',
                answer_images: Array.isArray(answer[0].answer_images) ? answer[0].answer_images : []
            }];
        }
        return [{ answer: '', answer_images: [] }];
    } else if (pkind === 20) {
        // 综合题
        return answer.map((item, idx) => {
            // 兼容旧格式：如果是字符串，转换为新格式
            if (typeof item === 'string') {
                return { answer: item, answer_images: [] };
            }
            // 新格式：确保有 answer 和 answer_images 字段
            if (typeof item === 'object' && item !== null) {
                return {
                    answer: item.answer || '',
                    answer_images: Array.isArray(item.answer_images) ? item.answer_images : []
                };
            }
            return { answer: '', answer_images: [] };
        });
    }
    // 其他题型不处理
    return answer;
}

// 本地兜底：避免与 question_md_utils.js 的全局 `renderMdPreview` 同名互相覆盖（脚本加载顺序会导致不可预期行为）
const renderMdPreviewLocal = (elm, md) => {
    if (!elm) return;
    // 统一使用全局 CsgVditor 渲染（无降级方案）
    CsgVditor.render({ el: elm, markdown: (md === undefined || md === null) ? '' : String(md) });
};

// 优先使用统一版（question_md_utils.js），不存在时用本地兜底
const renderMdPreviewSafe = (elm, md) => {
    if (typeof window !== 'undefined' && typeof window.renderMdPreview === 'function') {
        return window.renderMdPreview(elm, md);
    }
    return renderMdPreviewLocal(elm, md);
};

function answerImgKey(sub_idx, req_idx) {
    return `${sub_idx}_${req_idx}`;
}

function setLocalAnswerImg(sub_idx, req_idx, blob) {
    const k = answerImgKey(sub_idx, req_idx);
    const prev = state._localAnswerImg?.[k];
    if (prev) {
        try { URL.revokeObjectURL(prev); } catch (e) {}
    }
    const url = URL.createObjectURL(blob);
    state._localAnswerImg[k] = url;
    return url;
}

function clearLocalAnswerImg(sub_idx, req_idx) {
    const k = answerImgKey(sub_idx, req_idx);
    const prev = state._localAnswerImg?.[k];
    if (prev) {
        try { URL.revokeObjectURL(prev); } catch (e) {}
    }
    delete state._localAnswerImg[k];
}

function setTmpAnswerImg(sub_idx, req_idx, fileName) {
    const k = answerImgKey(sub_idx, req_idx);
    if (!state._tmpAnswerImages) state._tmpAnswerImages = {};
    state._tmpAnswerImages[k] = String(fileName || '');
}

function clearTmpAnswerImg(sub_idx, req_idx) {
    const k = answerImgKey(sub_idx, req_idx);
    if (!state._tmpAnswerImages) state._tmpAnswerImages = {};
    delete state._tmpAnswerImages[k];
}

function getTmpAnswerImg(sub_idx, req_idx) {
    const k = answerImgKey(sub_idx, req_idx);
    return (state._tmpAnswerImages && state._tmpAnswerImages[k]) ? String(state._tmpAnswerImages[k]) : '';
}

// 删除某个图片要求后，需要把同一 sub_idx 下更高 req_idx 的临时图索引整体前移
function shiftTmpAnswerImagesAfterDeleteReq(sub_idx, deletedReqIdx) {
    if (!state._tmpAnswerImages) state._tmpAnswerImages = {};
    const next = {};
    Object.keys(state._tmpAnswerImages).forEach((k) => {
        const parts = k.split('_');
        if (parts.length !== 2) return;
        const s = parseInt(parts[0], 10);
        const r = parseInt(parts[1], 10);
        if (Number.isNaN(s) || Number.isNaN(r)) return;
        if (s !== sub_idx) {
            next[k] = state._tmpAnswerImages[k];
            return;
        }
        if (r < deletedReqIdx) {
            next[k] = state._tmpAnswerImages[k];
        } else if (r > deletedReqIdx) {
            next[answerImgKey(s, r - 1)] = state._tmpAnswerImages[k];
        }
        // r === deletedReqIdx：丢弃
    });
    state._tmpAnswerImages = next;
}

function getAnswerImgSrc(sub_idx, req_idx, answerImageVal) {
    const k = answerImgKey(sub_idx, req_idx);
    const local = state._localAnswerImg?.[k] || '';
    const pendingTmp = getTmpAnswerImg(sub_idx, req_idx);
    // 关键：只要该位置有“待保存”的临时图，就强制用本地 blob 预览（/tmp 服务器路径前端不可访问）
    if (pendingTmp && local) return local;

    const v = String(answerImageVal || '');
    if (v.startsWith('/upload/')) return v;
    return local;
}

function getAnswerImgDisplayName(answerImageVal) {
    const v = String(answerImageVal || '');
    if (!v) return '';
    if (v.startsWith('/upload/')) {
        try { return v.split('/').pop() || v; } catch (e) { return v; }
    }
    return v;
}

/**
 * 打开图片预览 Modal（基于 Bootstrap 5）
 * @param {string} src - 图片地址
 * @param {string} title - 标题，默认为 '图片预览'
 */
function openImagePreviewModal(src, title = '图片预览') {
    if (!src) return;
    
    // 创建唯一的 modal ID
    const modalId = 'image-preview-modal-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
    
    // HTML 转义辅助函数：使用全局 DomSantize（来自 global.js）
    const escapeHtml = (text) => DomSantize(text);
    
    const modalHtml = `
        <div class="modal fade" id="${modalId}" tabindex="-1" aria-labelledby="${modalId}Label" aria-hidden="true" data-bs-backdrop="true" data-bs-keyboard="true">
            <div class="modal-dialog modal-xl modal-dialog-centered">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title" id="${modalId}Label">${escapeHtml(title)}<span class="en-text">Image Preview</span></h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                    </div>
                    <div class="modal-body text-center" style="padding: 1rem;">
                        <img src="${escapeHtml(src)}" style="max-width: 100%; max-height: 80vh; border-radius: 8px; border: 1px solid #e9ecef; object-fit: contain;" alt="${escapeHtml(title)}">
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">关闭<span class="en-text">Close</span></button>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // 移除已存在的 modal（如果有）
    const existingModal = document.getElementById(modalId);
    if (existingModal) {
        existingModal.remove();
    }
    
    // 插入 modal HTML
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    
    // 创建并显示 modal
    const modalElement = document.getElementById(modalId);
    if (modalElement && typeof bootstrap !== 'undefined' && bootstrap.Modal) {
        const modal = new bootstrap.Modal(modalElement, {
            backdrop: true,
            keyboard: true
        });
        modal.show();
        
        // Modal 关闭后移除 DOM 元素
        modalElement.addEventListener('hidden.bs.modal', function() {
            modalElement.remove();
        }, { once: true });
    } else {
        console.error('Bootstrap 5 Modal 未加载');
    }
}

/**
 * 创建图片元素，支持点击打开 Modal 预览
 * @param {string} src - 图片地址
 * @param {Object} options - 配置选项
 * @param {string} options.alt - 图片 alt 文本，默认为空
 * @param {string} options.title - Modal 标题，默认为 '图片预览'
 * @param {string} options.className - 图片 CSS 类名，默认为 'img-thumbnail'
 * @param {string|Object} options.style - 图片样式（字符串或对象），默认为 { maxWidth: '140px', cursor: 'zoom-in' }
 * @param {boolean} options.clickable - 是否支持点击打开 Modal，默认为 true
 * @returns {HTMLImageElement} 图片元素
 */
function createImageElement(src, options = {}) {
    const {
        alt = '',
        title = '图片预览',
        className = 'img-thumbnail',
        style = { maxWidth: '140px', cursor: 'zoom-in' },
        clickable = true
    } = options;
    
    if (!src) {
        const emptyDiv = document.createElement('div');
        emptyDiv.className = 'small text-danger';
        emptyDiv.textContent = '未上传';
        return emptyDiv;
    }
    
    const img = document.createElement('img');
    img.src = src;
    img.alt = alt;
    img.className = className;
    
    // 设置样式
    if (typeof style === 'string') {
        img.style.cssText = style;
    } else if (typeof style === 'object') {
        Object.assign(img.style, style);
    }
    
    // 如果支持点击，添加点击事件和样式
    if (clickable) {
        img.style.cursor = img.style.cursor || 'zoom-in';
        img.addEventListener('click', () => {
            openImagePreviewModal(src, title);
        });
    }
    
    return img;
}

// ---------- 评分建议（存储在 answer_explain 内） ----------
// 存储格式：JSON 对象 { "explain": "...", "score_advice": "..." }
function buildAnswerExplainCombined(explainMd, scoreAdviceMd) {
    const explain = String(explainMd || '').trim();
    const advice = String(scoreAdviceMd || '').trim();
    return {
        explain: explain,
        score_advice: advice
    };
}

function parseAnswerExplainCombined(rawData) {
    // 兼容旧格式：字符串（分隔符格式）
    if (typeof rawData === 'string') {
        // 尝试解析为 JSON
        try {
            const parsed = JSON.parse(rawData);
            if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
                return {
                    explain: String(parsed.explain || '').trim(),
                    advice: String(parsed.score_advice || '').trim()
                };
            }
        } catch (e) {}
        
        // 旧格式：分隔符格式
        const re = /(?:^|\n)\s*---\s*\n\s*\n\s*#{2,4}\s*评分建议\s*\n/;
        const m = rawData.match(re);
        if (m && m.index !== undefined) {
            const idx = m.index;
            const matchLen = m[0].length;
            const explain = rawData.slice(0, idx).trim();
            const advice = rawData.slice(idx + matchLen).trim();
            return { explain, advice };
        }
        // 纯字符串，作为答案解析
        return { explain: rawData.trim(), advice: '' };
    }
    
    // 新格式：JSON 对象
    if (typeof rawData === 'object' && rawData !== null && !Array.isArray(rawData)) {
        return {
            explain: String(rawData.explain || '').trim(),
            advice: String(rawData.score_advice || '').trim()
        };
    }
    
    // 其他情况
    return { explain: '', advice: '' };
}

function setHiddenValues() {
    el('#question_content').value = JSON.stringify(state.content ?? [], null, 4);
    el('#question_answer').value = JSON.stringify(state.answer ?? [], null, 4);
    // answer_explain：结构化 JSON 对象 { "explain": "...", "score_advice": "..." }
    // 简答/综合：包含评分建议；其他题型：只包含答案解析
    const explainData = (pkind === 15 || pkind === 20)
        ? buildAnswerExplainCombined(state.answerExplain ?? '', state.scoreAdvice ?? '')
        : { explain: state.answerExplain ?? '', score_advice: '' };
    el('#question_answer_explain').value = JSON.stringify(explainData);
    const tmpEl = el('#tmp_uuid');
    if (tmpEl) tmpEl.value = state.tmp_uuid || '';
    
    // 临时答案图信息：独立于表单数据（answer/content），仅用于保存时告知后端从 /tmp 搬运并回写 answer
    const tmpAnswerImages = [];
    if ((pkind === 15 || pkind === 20) && state._tmpAnswerImages && typeof state._tmpAnswerImages === 'object') {
        Object.keys(state._tmpAnswerImages).forEach((k) => {
            const v = String(state._tmpAnswerImages[k] || '');
            if (!v || !v.startsWith('tmp_')) return;
            const parts = k.split('_');
            if (parts.length !== 2) return;
            const sub_idx = parseInt(parts[0], 10);
            const req_idx = parseInt(parts[1], 10);
            if (Number.isNaN(sub_idx) || Number.isNaN(req_idx)) return;
            tmpAnswerImages.push({ sub_idx, req_idx, file_name: v });
        });
    }
    const tmpAnswerImagesEl = el('#tmp_answer_images');
    if (tmpAnswerImagesEl) tmpAnswerImagesEl.value = JSON.stringify(tmpAnswerImages);
    
    if (initialSnapshot !== null) {
        const snapNow = JSON.stringify(collectAllFields());
        if (snapNow !== initialSnapshot) {
            markDirty();
        }
    }
}

function syncScoreAdviceUI() {
    const group = el('#score_advice_group');
    const input = el('#question_score_advice');
    if (!group || !input) return;
    const show = (pkind === 15 || pkind === 20);
    group.style.display = show ? '' : 'none';
    if (!show) return;
    input.value = state.scoreAdvice || '';
}

function syncQuestionEditSurface() {
    const surface = el('#question_edit_surface');
    if (!surface) return;
    surface.setAttribute('data-pkind', String(pkind));
}

function bindScoreAdvice() {
    const input = el('#question_score_advice');
    if (!input) return;
    input.addEventListener('input', () => {
        state.scoreAdvice = input.value || '';
        setHiddenValues();
        markDirty();
    });
}

function ensureVditor() {
    if (!vditorSingleton) {
        vditorSingleton = CsgVditor.createSingletonEditor({
            el: '#vditor_editor',
            height: 500,
            options: {
                toolbarConfig: { pin: true },
                cache: { enable: false },
                preview: { delay: 300 },
            },
        });
    }
    return vditorSingleton.ensure();
}

function openVditor(title, initialMd, onSave) {
    vditorTitle.textContent = title;
    currentVditorSave = onSave;
    ensureVditor().then((v) => {
        if (v?.setValue) v.setValue(initialMd || '');
        const modal = bootstrap.Modal.getOrCreateInstance(vditorModal);
        modal.show();
    });
}

function closeVditorModal() {
    const modal = bootstrap.Modal.getInstance(vditorModal);
    if (modal) modal.hide();
}

function descriptionSectionInit() {
    const descTextarea = el('#question_description');
    state.description = descTextarea.value || '';
    renderDescriptionPreview();
    el('#edit_description_btn')?.addEventListener('click', () => {
        openVditor('编辑描述', state.description, (md) => {
            state.description = md;
            descTextarea.value = md;
            renderDescriptionPreview();
            setHiddenValues();
        });
    });
    // 根据题型控制按钮
    const editBtn = el('#edit_description_btn');
    const chooseBtn = el('#choose_oj_problem_btn');
    if (isProgramming()) {
        if (editBtn) editBtn.classList.add('d-none');
        if (chooseBtn) chooseBtn.classList.remove('d-none');
    } else {
        if (editBtn) editBtn.classList.remove('d-none');
        if (chooseBtn) chooseBtn.classList.add('d-none');
    }
}

function renderDescriptionPreview() {
    const container = el('#description_preview');
    if (isProgramming() && currentProblem) {
        renderProblemPreview();
    } else {
        renderMdPreviewSafe(container, state.description);
    }
}

function renderProblemPreview() {
    const box = el('#oj_problem_preview');
    const descBox = el('#description_preview');
    if (!box || !descBox) return;
    if (!currentProblem) {
        box.classList.add('d-none');
        descBox.classList.remove('d-none');
        const editBtn = el('#edit_description_btn');
        const chooseBtn = el('#choose_oj_problem_btn');
        if (isProgramming()) {
            if (editBtn) editBtn.classList.add('d-none');
            if (chooseBtn) chooseBtn.classList.remove('d-none');
        }
        return;
    }
    box.classList.remove('d-none');
    descBox.classList.add('d-none');
    const snippet = (currentProblem.description || '').replace(/<[^>]*>/g, '').slice(0, 100);
    box.innerHTML = `
        <div><strong>OJ题号：</strong>${currentProblem.problem_id}</div>
        <div><strong>标题：</strong>${currentProblem.title || ''}</div>
        <div class="text-muted small mt-1">${snippet}${snippet.length >= 100 ? '...' : ''}</div>
    `;
}

function toggleProgrammingControls(show) {
    const chooseBtn = el('#choose_oj_problem_btn');
    const previewBox = el('#oj_problem_preview');
    const hint = el('#prog_oj_bind_hint');
    if (chooseBtn) chooseBtn.classList.toggle('d-none', !show);
    if (previewBox) {
        previewBox.classList.toggle('d-none', !show || !currentProblem);
    }
    if (hint) hint.classList.toggle('d-none', !show);
    const descBox = el('#description_preview');
    if (descBox && show && currentProblem) descBox.classList.add('d-none');
    if (descBox && (!show || !currentProblem)) descBox.classList.remove('d-none');
    const editBtn = el('#edit_description_btn');
    if (editBtn) editBtn.classList.toggle('d-none', show); // 编程题隐藏编辑按钮
}

function toggleContentCard(show) {
    const card = el('#content_card');
    if (card) card.classList.toggle('d-none', !show);
}

function loadProgrammingPreviewByDesc(descVal) {
    const pid = parseInt(descVal, 10);
    if (Number.isNaN(pid)) {
        currentProblem = null;
        renderDescriptionPreview();
        return;
    }
    $.getJSON(`/exadmin/exam/problem_ajax?problem_id=${pid}`)
        .done(ret => {
            if (ret.code === 1) {
                currentProblem = ret.data;
            } else {
                currentProblem = null;
            }
            renderDescriptionPreview();
        })
        .fail(() => {
            currentProblem = null;
            renderDescriptionPreview();
        });
}

function fetchProblemList(search = '') {
    const params = {
        offset: 0,
        limit: 200,
        search
    };
    return $.getJSON('/exadmin/exam/prog_problem_list_ajax', params);
}

function bindProblemSelector() {
    const chooseBtn = el('#choose_oj_problem_btn');
    const searchBtn = el('#oj_problem_search_btn');
    const searchInput = el('#oj_problem_search_input');
    const tableBody = el('#oj_problem_table_body');
    const modalEl = el('#oj_problem_selector_modal');
    if (!chooseBtn || !tableBody || !modalEl) return;
    const modal = bootstrap.Modal.getOrCreateInstance(modalEl);

    const renderTable = (rows) => {
        if (!Array.isArray(rows) || rows.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="5" class="text-center text-muted">暂无数据</td></tr>`;
            return;
        }
        tableBody.innerHTML = rows.map(item => {
            const snippet = (item.description || '').replace(/<[^>]*>/g, '').slice(0, 80);
            let bindsHtml = '-';
            if (item.qlist && item.qlist !== '-') {
                const qids = item.qlist.split(',');
                bindsHtml = qids.map(qid => {
                    const qidTrim = qid.trim();
                    return `<a href="#" class="question-preview-link text-decoration-none me-1" data-qid="${qidTrim}">${qidTrim}</a>`;
                }).join('');
            }
            return `
                <tr>
                    <td>${item.problem_id}</td>
                    <td>
                        <a href="/csgoj/problemset/problem?pid=${item.problem_id}" target="_blank" class="text-decoration-none">
                            ${item.title || ''}
                        </a>
                    </td>
                    <td class="text-muted small">${snippet}${snippet.length >= 80 ? '...' : ''}</td>
                    <td>${bindsHtml}</td>
                    <td><button type="button" class="btn btn-sm btn-outline-primary select-pro-btn" data-pid="${item.problem_id}">选择</button></td>
                </tr>
            `;
        }).join('');
        // 绑定预览链接点击事件
        tableBody.querySelectorAll('.question-preview-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const qid = e.target.getAttribute('data-qid');
                if (qid) {
                    // 根据当前页面路径推断 URL
                    let url = '/exadmin/question/question_ajax';
                    if (window.location.pathname.includes('/exadmin/')) {
                        url = '/exadmin/question/question_ajax';
                    }
                    show_question(qid, url);
                }
            });
        });
    };

    const loadList = () => {
        tableBody.innerHTML = `<tr><td colspan="5" class="text-center text-muted">加载中...</td></tr>`;
        fetchProblemList(searchInput?.value || '').then(ret => {
            if (ret.code === 1) {
                renderTable(ret.data?.rows || []);
            } else {
                tableBody.innerHTML = `<tr><td colspan="5" class="text-center text-danger">加载失败</td></tr>`;
            }
        }).catch(() => {
            tableBody.innerHTML = `<tr><td colspan="5" class="text-center text-danger">加载失败</td></tr>`;
        });
    };

    chooseBtn.addEventListener('click', () => {
        if (!isProgramming()) return;
        modal.show();
        loadList();
    });

    searchBtn?.addEventListener('click', loadList);
    searchInput?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            loadList();
        }
    });

    tableBody.addEventListener('click', (e) => {
        const btn = e.target.closest('.select-pro-btn');
        if (!btn) return;
        const pid = btn.getAttribute('data-pid');
        el('#question_description').value = pid;
        state.description = pid;
        loadProgrammingPreviewByDesc(pid);
        setHiddenValues();
        modal.hide();
    });
}

// ---------- 选项处理通用工具 ----------
function letterByIndex(i) {
    return String.fromCharCode('A'.charCodeAt(0) + i);
}

function parseBatchOptions(text) {
    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l);
    const ret = [];
    lines.forEach((line) => {
        const m = line.match(/^[A-Za-z][\.\)]\s*(.*)$/);
        if (m && m[1].trim() !== '') {
            ret.push(m[1].trim());
        } else {
            ret.push(line);
        }
    });
    return ret;
}

// ---------- 渲染内容区域 ----------
function renderContentArea() {
    const area = el('#content_edit_area');
    area.innerHTML = '';
    const type = pkind;
    // 编程题需要编辑代码模板，因此 content 区域需显示
    // 简答题（15）也需要显示 content：用于“图片要求”
    const showContent = !(type === 5);
    toggleContentCard(showContent);
    setContentHeaderActions(type);

    if (type === 0 || type === 1) {
        renderChoiceContent(area, type);
    } else if (type === 5) {
        renderTrueFalseContent(area);
    } else if (type === 10) {
        renderFillContent(area);
    } else if (type === 15) {
        renderShortContent(area);
    } else if (type === 20) {
        renderComprehensiveContent(area);
    } else if (type === 25) {
        // 编程题使用内容区编辑代码模板
        renderProgrammingContent(area);
    }
}

function setContentHeaderActions(type) {
    const box = el('#content_header_actions');
    if (!box) return;
    // 默认保持模板的“靠右”布局；某些题型（如简答）需要占满剩余空间，会在分支里覆盖
    box.className = 'ms-auto d-flex gap-2';
    box.innerHTML = '';
    const headerBtn = (text, onClick, cls = 'btn-outline-primary btn-sm d-flex align-items-center justify-content-start gap-2 w-100') => btn(text, cls, onClick);
    if (type === 0 || type === 1) {
        const addBtn = headerBtn('添加', () => {
            state.content.push(`选项${letterByIndex(state.content.length)}`);
            if (state.content.length === 1 && !state.answer.length) {
                state.answer = [letterByIndex(0)];
            }
            renderContentArea();
            renderAnswerArea();
            setHiddenValues();
        });
        const batchBtn = headerBtn('批量', () => {
            openVditor('批量粘贴选项', '', (md) => {
                const options = parseBatchOptions(md);
                if (options.length) {
                    state.content = options;
                    // 重置答案
                    state.answer = type === 1 ? [] : options[0] ? [letterByIndex(0)] : [];
                    renderContentArea();
                    renderAnswerArea();
                    setHiddenValues();
                }
            });
        });
        const group = document.createElement('div');
        group.className = 'btn-group w-100';
        addBtn.innerHTML = `<i class="bi bi-plus-lg"></i><span>添加</span>`;
        batchBtn.innerHTML = `<i class="bi bi-clipboard-plus"></i><span>批量</span>`;
        addBtn.classList.add('text-start');
        batchBtn.classList.add('text-start');
        group.append(addBtn, batchBtn);
        box.append(group);
    } else if (type === 20) {
        const addBtn = headerBtn('添加小题', () => {
            addComprehensiveItem();
        });
        addBtn.innerHTML = `<i class="bi bi-plus-lg"></i><span>添加小题</span>`;
        box.append(addBtn);
    } else if (type === 10) {
        const addBtn = headerBtn('添加填空', () => {
            state.content.push('');
            state.answer.push('');
            renderContentArea();
            renderAnswerArea();
            setHiddenValues();
        });
        addBtn.innerHTML = `<i class="bi bi-plus-lg"></i><span>添加填空</span>`;
        box.append(addBtn);
    } else if (type === 15) {
        // 简答题：把“新增图片要求”按钮放到“内容：”这一行，样式与“编辑/编辑解析”一致，且占满剩余空间
        box.className = 'd-flex flex-fill gap-2';
        const addImgBtn = makeBilingualIconBtn(
            '新增图片要求',
            'Add Image Requirement',
            'bi bi-image',
            'btn btn-sm btn-outline-primary flex-fill text-center',
            () => {
                // 确保结构存在
                if (!Array.isArray(state.content) || state.content.length === 0 || typeof state.content[0] !== 'object') {
                    state.content = [{ image_reqs: [] }];
                }
                if (!Array.isArray(state.content[0].image_reqs)) state.content[0].image_reqs = [];
                if (state.content[0].image_reqs.length >= 10) {
                    alerty.error('每小题最多 10 条图片要求');
                    return;
                }
                state.content[0].image_reqs.push({ title: '' });
                // 同步初始化 answer 中的 answer_images 数组
                state.answer = normalizeAnswerFormat(state.answer, 15);
                if (!state.answer[0]) {
                    state.answer[0] = { answer: '', answer_images: [] };
                }
                if (!Array.isArray(state.answer[0].answer_images)) {
                    state.answer[0].answer_images = [];
                }
                state.answer[0].answer_images.push('');
                renderContentArea();
                renderAnswerArea(); // 图片要求影响答案区的上传组件，需实时刷新
                setHiddenValues();
            },
            'stack'
        );
        box.append(addImgBtn);
    }
}

function renderChoiceContent(area, type) {
    const isMulti = type === 1;
    const list = document.createElement('div');
    state.content.forEach((opt, idx) => {
        const card = document.createElement('div');
        card.className = 'option-item';

        const top = document.createElement('div');
        top.className = 'd-flex align-items-center gap-2';
        const left = document.createElement('div');
        left.innerHTML = `<strong>${letterByIndex(idx)}.</strong>`;
        const editBtn = btn('编辑内容', 'btn-outline-primary btn-sm flex-fill text-start', () => {
            openVditor(`编辑选项 ${letterByIndex(idx)}`, opt, (md) => {
                state.content[idx] = md;
                renderContentArea();
                renderAnswerArea(); // 选项内容更新时同步刷新答案区域
                setHiddenValues();
            });
        });
        const delBtn = btn('删除', 'btn-outline-danger btn-sm', () => {
            state.content.splice(idx, 1);
            // 修剪答案
            state.answer = state.answer.filter(a => {
                const ai = a.charCodeAt(0) - 65;
                return ai >= 0 && ai < state.content.length;
            });
            renderContentArea();
            renderAnswerArea();
            setHiddenValues();
        });
        top.append(left, editBtn, delBtn);

        const preview = document.createElement('div');
        preview.className = 'option-preview mt-2';
        renderMdPreviewSafe(preview, opt);

        card.append(top, preview);
        list.append(card);
    });
    area.append(list);
}

function renderTrueFalseContent(area) {
    // 判断题隐藏内容区域，仅保留默认 T/F 逻辑
    state.content = ['True', 'False'];
    // 不渲染任何可见内容
}

function renderFillContent(area) {
    const list = document.createElement('div');
    state.content = state.content || [];
    if (!Array.isArray(state.answer)) state.answer = [];
    state.answer.length = state.content.length;
    state.content.forEach((txt, idx) => {
        const card = document.createElement('div');
        card.className = 'fill-item';
        const row = document.createElement('div');
        row.className = 'd-flex align-items-center gap-2';
        const title = document.createElement('div');
        title.innerHTML = `<strong>第 ${idx + 1} 空</strong>`;
        const editBtn = btn('编辑描述', 'btn-outline-primary btn-sm flex-fill text-start', () => {
            openVditor(`填空 ${idx + 1} 描述`, txt, (md) => {
                state.content[idx] = md;
                renderContentArea();
                setHiddenValues();
            });
        });
        const delBtn = btn('删除', 'btn-outline-danger btn-sm', () => {
            state.content.splice(idx, 1);
            state.answer.splice(idx, 1);
            renderContentArea();
            renderAnswerArea();
            setHiddenValues();
        });
        const btnWrap = document.createElement('div');
        btnWrap.className = 'd-flex gap-2 flex-fill';
        btnWrap.append(editBtn, delBtn);
        row.append(title, btnWrap);
        const preview = document.createElement('div');
        preview.className = 'fill-preview mt-2';
        renderMdPreviewSafe(preview, txt || `(第${idx + 1}空)`);
        card.append(row, preview);
        list.append(card);
    });
    area.append(list);
}

function renderShortContent(area) {
    // 简答题：content 用来承载图片上传要求（题干在 description）
    if (!Array.isArray(state.content) || state.content.length === 0 || typeof state.content[0] !== 'object') {
        state.content = [{ image_reqs: [] }];
    }
    if (!Array.isArray(state.content[0].image_reqs)) state.content[0].image_reqs = [];

    const wrap = document.createElement('div');
    wrap.className = 'mb-2';

    const title = document.createElement('div');
    title.className = 'fw-semibold mb-2';
    title.textContent = '图片上传要求（最多 10 条，每条必须上传答案图）';

    const listBox = document.createElement('div');
    listBox.className = 'd-flex flex-column gap-2';

    state.content[0].image_reqs.forEach((req, ridx) => {
        const row = document.createElement('div');
        row.className = 'border rounded p-2 bg-light';

        const head = document.createElement('div');
        head.className = 'd-flex align-items-center gap-2 flex-wrap';
        head.innerHTML = `<strong>图片${ridx + 1}</strong>`;

            const titleInput = document.createElement('input');
            titleInput.type = 'text';
            titleInput.className = 'form-control form-control-sm flex-grow-1';
            titleInput.placeholder = '例如：请上传推导过程截图 / Upload derivation screenshot';
            titleInput.value = req.title || '';
            titleInput.dataset.pkind = '15';
            titleInput.dataset.ridx = ridx;
            titleInput.addEventListener('input', () => {
                state.content[0].image_reqs[ridx].title = titleInput.value;
                fvtClearError(titleInput);
                setHiddenValues();
                renderAnswerArea(); // 标题在答案区同步展示
            });

        const delBtn = btn('删除', 'btn-outline-danger btn-sm', () => {
            clearLocalAnswerImg(0, ridx);
            clearTmpAnswerImg(0, ridx);
            state.content[0].image_reqs.splice(ridx, 1);
            // 同步删除 answer 中的对应答案图（仅保存的 attach URL；临时图走 _tmpAnswerImages）
            state.answer = normalizeAnswerFormat(state.answer, 15);
            if (state.answer[0] && Array.isArray(state.answer[0].answer_images)) {
                state.answer[0].answer_images.splice(ridx, 1);
            }
            shiftTmpAnswerImagesAfterDeleteReq(0, ridx);
            renderContentArea();
            renderAnswerArea(); // 删除后答案区也要实时移除对应上传行
            setHiddenValues();
        });

        const imgInfo = document.createElement('div');
        imgInfo.className = 'small text-muted mt-2';
        // 从 answer 字段读取答案图信息，不再从 content 读取
        state.answer = normalizeAnswerFormat(state.answer, 15);
        const answerObj = state.answer[0] || { answer: '', answer_images: [] };
        const answerImages = Array.isArray(answerObj.answer_images) ? answerObj.answer_images : [];
        const savedUrl = answerImages[ridx] || '';
        const pendingTmp = getTmpAnswerImg(0, ridx);
        if (pendingTmp) {
            imgInfo.textContent = `答案图：待保存：${pendingTmp}`;
        } else {
            const displayName = getAnswerImgDisplayName(savedUrl);
            imgInfo.textContent = displayName ? `答案图：已保存：${displayName}` : '答案图：未上传（请在"答案"区域上传）';
        }

        head.append(delBtn);
        row.append(head, titleInput, imgInfo);
        listBox.append(row);
    });

    wrap.append(title, listBox);
    area.append(wrap);
}

function renderComprehensiveContent(area) {
    state.content = state.content && Array.isArray(state.content) ? state.content : [];
    const list = document.createElement('div');
    if (!Array.isArray(state.answer)) state.answer = [];
    state.answer.length = state.content.length;

    state.content.forEach((item, idx) => {
        if (!Array.isArray(item?.image_reqs)) item.image_reqs = [];
        const card = document.createElement('div');
        card.className = 'comprehensive-item';

        const row = document.createElement('div');
        row.className = 'd-flex justify-content-between align-items-center gap-2 flex-wrap';
        const title = document.createElement('div');
        title.innerHTML = `<strong>第 ${idx + 1} 小题</strong>`;
        const addImgBtn = makeBilingualIconBtn(
            '新增图片要求',
            '',
            'bi bi-image',
            'btn btn-sm btn-outline-primary d-flex align-items-center gap-2',
            () => {
            if (item.image_reqs.length >= 10) {
                alerty.error('每小题最多 10 条图片要求');
                return;
            }
            item.image_reqs.push({ title: '' });
            // 同步初始化 answer 中的 answer_images 数组
            state.answer = normalizeAnswerFormat(state.answer, 20);
            if (!state.answer[idx]) {
                state.answer[idx] = { answer: '', answer_images: [] };
            }
            if (!Array.isArray(state.answer[idx].answer_images)) {
                state.answer[idx].answer_images = [];
            }
            state.answer[idx].answer_images.push('');
            renderContentArea();
            renderAnswerArea(); // 图片要求影响答案区的上传组件，需实时刷新
            setHiddenValues();
        });
        const editBtn = btn('编辑内容', 'btn-outline-primary btn-sm d-flex align-items-center gap-2', () => {
            openVditor(`综合题内容 ${idx + 1}`, item?.content || '', (md) => {
                state.content[idx] = Object.assign({}, item, { content: md, score_ratio: item?.score_ratio || '' });
                renderContentArea();
                setHiddenValues();
            });
        });
        editBtn.innerHTML = `<i class="bi bi-pencil-square"></i><span>编辑内容</span>`;
        const delBtn = btn('删除', 'btn-outline-danger btn-sm', () => {
            state.content.splice(idx, 1);
            state.answer.splice(idx, 1);
            renderContentArea();
            renderAnswerArea();
            setHiddenValues();
        });
        delBtn.innerHTML = `<i class="bi bi-trash"></i><span>删除</span>`;
        const btnWrap = document.createElement('div');
        btnWrap.className = 'btn-group';
        // “新增图片要求”放到“编辑内容、删除”左侧并组成 btn-group
        btnWrap.append(addImgBtn, editBtn, delBtn);
        row.append(title, btnWrap);

        const ratioRow = document.createElement('div');
        ratioRow.className = 'mt-2 d-flex align-items-center gap-2 flex-wrap';
        const ratioLabel = document.createElement('label');
        ratioLabel.className = 'form-label mb-0';
        ratioLabel.textContent = '分数比例(%)';
        const ratioInput = document.createElement('input');
        ratioInput.type = 'number';
        ratioInput.className = 'form-control form-control-sm ratio-input';
        ratioInput.dataset.idx = idx;
        ratioInput.dataset.pkind = '20';
        ratioInput.value = item?.score_ratio ?? '';
        ratioInput.min = 0;
        ratioInput.max = 100;
        ratioInput.step = 1;
        ratioInput.style.maxWidth = '120px';
        ratioInput.addEventListener('input', () => {
            fvtClearError(ratioInput);
        });
        // 非整数提示
        const ratioWarning = document.createElement('div');
        ratioWarning.className = 'ratio-warning text-danger fw-bold small';
        ratioWarning.style.display = 'none';
        ratioWarning.textContent = '⚠ 分数比例必须是整数';
        const ratioInputWrap = document.createElement('div');
        ratioInputWrap.className = 'd-flex flex-column gap-1';
        ratioInputWrap.append(ratioInput, ratioWarning);
        ratioRow.append(ratioLabel, ratioInputWrap);
        const preview = document.createElement('div');
        preview.className = 'comprehensive-preview mt-2';
        renderMdPreviewSafe(preview, item?.content || '');

        // 图片要求编辑区
        const imgWrap = document.createElement('div');
        imgWrap.className = 'mt-2 img-wrap';
        const imgTitle = document.createElement('div');
        imgTitle.className = 'fw-semibold mb-2 text-muted';
        imgTitle.textContent = '图片上传要求（最多 10 条，每条必须上传答案图）';
        const imgList = document.createElement('div');
        imgList.className = 'd-flex flex-column gap-2';
        item.image_reqs.forEach((req, ridx) => {
            const r = document.createElement('div');
            r.className = 'img-list-item';
            const h = document.createElement('div');
            h.className = 'd-flex align-items-center gap-2 flex-wrap';
            h.innerHTML = `<strong>图片${ridx + 1}</strong>`;
            const titleInput = document.createElement('input');
            titleInput.type = 'text';
            titleInput.className = 'form-control form-control-sm flex-grow-1';
            titleInput.placeholder = '例如：请上传关键步骤截图 / Upload key steps screenshot';
            titleInput.value = req.title || '';
            titleInput.dataset.pkind = '20';
            titleInput.dataset.subIdx = idx;
            titleInput.dataset.ridx = ridx;
            titleInput.addEventListener('input', () => {
                item.image_reqs[ridx].title = titleInput.value;
                fvtClearError(titleInput);
                setHiddenValues();
                renderAnswerArea(); // 标题在答案区同步展示
            });
            const delBtn = btn('删除', 'btn-outline-danger btn-sm', () => {
                clearLocalAnswerImg(idx, ridx);
                clearTmpAnswerImg(idx, ridx);
                item.image_reqs.splice(ridx, 1);
                // 同步删除 answer 中的对应答案图（仅保存的 attach URL；临时图走 _tmpAnswerImages）
                state.answer = normalizeAnswerFormat(state.answer, 20);
                if (state.answer[idx] && Array.isArray(state.answer[idx].answer_images)) {
                    state.answer[idx].answer_images.splice(ridx, 1);
                }
                shiftTmpAnswerImagesAfterDeleteReq(idx, ridx);
                renderContentArea();
                renderAnswerArea(); // 删除后答案区也要实时移除对应上传行
                setHiddenValues();
            });
            const imgInfo = document.createElement('div');
            imgInfo.className = 'small text-muted mt-2';
            // 从 answer 字段读取答案图信息，不再从 content 读取
            state.answer = normalizeAnswerFormat(state.answer, 20);
            const answerObj = state.answer[idx] || { answer: '', answer_images: [] };
            const answerImages = Array.isArray(answerObj.answer_images) ? answerObj.answer_images : [];
            const savedUrl = answerImages[ridx] || '';
            const pendingTmp = getTmpAnswerImg(idx, ridx);
            if (pendingTmp) {
                imgInfo.textContent = `答案图：待保存：${pendingTmp}`;
            } else {
                const displayName = getAnswerImgDisplayName(savedUrl);
                imgInfo.textContent = displayName ? `答案图：已保存：${displayName}` : '答案图：未上传（请在"答案"区域上传）';
            }
            h.append(delBtn);
            r.append(h, titleInput, imgInfo);
            imgList.append(r);
        });
        imgWrap.append(imgTitle, imgList);

        card.append(row, ratioRow, preview, imgWrap);
        list.append(card);
    });

    // 检查分数比例是否为整数
    function checkRatioInteger(ratioInput) {
        const idx = parseInt(ratioInput.dataset.idx, 10);
        const val = ratioInput.value;
        const warning = ratioInput.parentElement.querySelector('.ratio-warning');
        if (val && val.trim() !== '') {
            const numVal = parseFloat(val);
            if (!Number.isNaN(numVal) && numVal % 1 !== 0) {
                // 不是整数，显示警告
                warning.style.display = 'block';
                ratioInput.classList.add('is-invalid');
            } else {
                // 是整数，隐藏警告
                warning.style.display = 'none';
                ratioInput.classList.remove('is-invalid');
            }
        } else {
            warning.style.display = 'none';
            ratioInput.classList.remove('is-invalid');
        }
    }
    
    // 初始化时检查所有分数比例
    list.querySelectorAll('.ratio-input').forEach(input => {
        checkRatioInteger(input);
    });
    
    list.addEventListener('input', (e) => {
        if (e.target.classList.contains('ratio-input')) {
            const idx = parseInt(e.target.dataset.idx, 10);
            const val = e.target.value;
            state.content[idx].score_ratio = val;
            checkRatioInteger(e.target);
            setHiddenValues();
        }
    });

    area.append(list);
}

function renderProgrammingContent(area) {
    const contentObj = (() => {
        if (Array.isArray(state.content) && state.content.length) {
            const first = state.content[0];
            if (typeof first === 'string') return { code: first };
            if (first && typeof first === 'object') return { code: first.code || '' };
        }
        return { code: '' };
    })();

    const wrapper = document.createElement('div');
    wrapper.className = 'mb-3';

    const label = document.createElement('label');
    label.className = 'form-label fw-semibold';
    label.textContent = '代码模板（考生答题区的默认代码）';

    const textarea = document.createElement('textarea');
    textarea.className = 'form-control';
    textarea.rows = 8;
    textarea.placeholder = '// 在此填写默认代码模板，考生打开试卷将自动填入';
    textarea.value = contentObj.code || '';
    textarea.addEventListener('input', () => {
        state.content = [{ code: textarea.value }];
        setHiddenValues();
    });

    wrapper.append(label, textarea);
    area.append(wrapper);

    // 编程题描述使用 OJ 题号 + 预览
    const previewBox = el('#oj_problem_preview');
    if (previewBox) previewBox.classList.remove('d-none');
    const chooseBtn = el('#choose_oj_problem_btn');
    if (chooseBtn) chooseBtn.classList.remove('d-none');
}

function addComprehensiveItem() {
    state.content.push({ content: '', score_ratio: '', image_reqs: [] });
    state.answer.push('');
    renderContentArea();
    renderAnswerArea();
    setHiddenValues();
}

// ---------- 图片预处理 & 答案图上传 ----------
const CSGOJ_MAX_IMAGE_DIM = window.CSGOJ_IMAGE_MAX_DIM;

async function preprocessImageToWebp(file) {
    // 仅允许 bmp/png/jpg/webp/tiff（前端统一转 webp）
    const name = (file.name || '').toLowerCase();
    const ok = name.endsWith('.bmp') || name.endsWith('.png') || name.endsWith('.jpg') || name.endsWith('.jpeg') || name.endsWith('.webp') || name.endsWith('.tif') || name.endsWith('.tiff');
    if (!ok) {
        throw new Error('仅允许 bmp/png/jpg/webp/tiff 图片');
    }
    const bmp = await createImageBitmap(file);
    const w0 = bmp.width, h0 = bmp.height;
    const scale = Math.min(1, CSGOJ_MAX_IMAGE_DIM / Math.max(w0, h0));
    const w = Math.max(1, Math.round(w0 * scale));
    const h = Math.max(1, Math.round(h0 * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    // 透明区域填白
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(bmp, 0, 0, w, h);
    // 转换为 WebP 格式，质量 0.85（WebP 在相同质量下文件更小）
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/webp', 0.85));
    if (!blob) throw new Error('图片转换失败');
    return blob;
}

function buildAnswerImageFileName(ex_question_id, sub_idx, req_idx) {
    // 按题号编号：包含题目ID + 小题序号 + 要求序号
    if (!ex_question_id || parseInt(ex_question_id, 10) <= 0) {
        // 新增题目：先落临时目录，提交后后端会重命名为 question_{id}_*
        return `tmp_sub${sub_idx + 1}_req${req_idx + 1}.webp`;
    }
    return `question_${ex_question_id}_sub${sub_idx + 1}_req${req_idx + 1}.webp`;
}

async function uploadAnswerImage(ex_question_id, sub_idx, req_idx, webpBlob) {
    // 预览：新增题目用本地 blob；编辑题也可先显示本地，待接口返回再切换到 URL
    setLocalAnswerImg(sub_idx, req_idx, webpBlob);
    const fd = new FormData();
    fd.append('ex_question_id', String(ex_question_id));
    fd.append('sub_idx', String(sub_idx));
    fd.append('req_idx', String(req_idx));
    // 新增题目：携带 tmp_uuid（首次可为空，由后端生成并返回）
    if (!ex_question_id || parseInt(ex_question_id, 10) <= 0) {
        if (state.tmp_uuid) fd.append('tmp_uuid', state.tmp_uuid);
    }
    fd.append('upload_file', webpBlob, buildAnswerImageFileName(ex_question_id, sub_idx, req_idx));
    const ret = await csg.post({
        url: '/exadmin/question/answer_image_upload_ajax',
        data: fd,
        dtype: 'json',
    });
    if (!ret || ret.code !== 1) {
        throw new Error(ret?.msg || '上传失败');
    }
    if (ret.data?.tmp_uuid) {
        state.tmp_uuid = ret.data.tmp_uuid;
    }
    const fname = ret.data?.file_name || buildAnswerImageFileName(ex_question_id, sub_idx, req_idx);

    // 最佳实践：answer 只保存最终 attach URL；临时图仅写入 _tmpAnswerImages，并用本地 blob 预览
    setTmpAnswerImg(sub_idx, req_idx, fname);

    renderContentArea();
    renderAnswerArea(); // 上传成功后，答案区状态需要实时更新
    setHiddenValues();
    alerty.success('答案图已上传');
}

// ---------- 渲染答案区域 ----------
function renderAnswerArea() {
    const area = el('#answer_edit_area');
    area.innerHTML = '';
    // 同步答案区标题行右侧操作区（例如简答题“编辑答案”按钮）
    renderAnswerHeaderActions();
    const type = pkind;
    if (type === 0 || type === 1) {
        renderChoiceAnswer(area, type);
    } else if (type === 5) {
        renderTrueFalseAnswer(area);
    } else if (type === 10) {
        renderFillAnswer(area);
    } else if (type === 15) {
        renderShortAnswer(area);
    } else if (type === 20) {
        renderComprehensiveAnswer(area);
    } else if (type === 25) {
        renderProgrammingAnswer(area);
    }
}

function renderAnswerHeaderActions() {
    const ph = el('#answer_header_placeholder');
    if (!ph) return;
    ph.innerHTML = '';
    // 只有简答题：在“答案：”标题行右侧显示“编辑答案”按钮，占满剩余空间
    if (pkind === 15) {
        ph.className = 'd-flex flex-fill gap-2';
        const editBtn = makeBilingualIconBtn(
            '编辑答案',
            'Edit Answer',
            'bi bi-pencil-square',
            'btn btn-sm btn-outline-primary flex-fill text-center',
            () => {
            // 规范化答案格式
            state.answer = normalizeAnswerFormat(state.answer, 15);
            const currentAnswer = state.answer[0]?.answer || '';
            openVditor('编辑答案', currentAnswer, (md) => {
                state.answer = normalizeAnswerFormat(state.answer, 15);
                if (!state.answer[0]) {
                    state.answer[0] = { answer: '', answer_images: [] };
                }
                state.answer[0].answer = md;
                setHiddenValues();
                renderAnswerArea();
            });
            },
            'stack'
        );
        ph.append(editBtn);
    } else {
        // 其他题型不占位（保持紧凑）
        ph.className = 'flex-fill';
    }
}

function renderChoiceAnswer(area, type) {
    const isMulti = type === 1;
    const form = document.createElement('div');
    form.className = 'mb-3';
    state.answer = Array.isArray(state.answer) ? state.answer : [];
    // 选择题答案解析改为整题文本
    if (typeof state.answerExplain !== 'string') state.answerExplain = '';

    state.content.forEach((_, idx) => {
        const letter = letterByIndex(idx);
        const wrap = document.createElement('div');
        wrap.className = 'd-flex align-items-center mb-2 gap-2';

        const input = document.createElement('input');
        input.type = isMulti ? 'checkbox' : 'radio';
        input.name = 'answer_choice';
        input.value = letter;
        // Bootstrap 5 的 form-check-input 默认带负 margin-left，会在 flex 行里“跑出框”
        input.className = 'form-check-input m-0';
        input.style.marginLeft = '0';
        if (state.answer.includes(letter)) input.checked = true;
        input.addEventListener('change', () => {
            if (isMulti) {
                if (input.checked) {
                    if (!state.answer.includes(letter)) state.answer.push(letter);
                } else {
                    state.answer = state.answer.filter(a => a !== letter);
                }
            } else {
                state.answer = [letter];
            }
            setHiddenValues();
        });

        // 点击整行也可选中/切换
        wrap.addEventListener('click', (e) => {
            if (e.target === input) return;
            input.click();
        });

        const letterLabel = document.createElement('strong');
        letterLabel.textContent = letter;
        const contentPreview = document.createElement('div');
        contentPreview.className = 'flex-grow-1 small';
        renderMdPreviewSafe(contentPreview, state.content[idx] || '');

        wrap.append(input, letterLabel, contentPreview);
        form.append(wrap);
    });

    area.append(form);
}

function renderAnswerExplainPreview(box, md) {
    if (!box) return;
    if (!md || (typeof md === 'string' && md.trim() === '')) {
        box.innerHTML = '<div class="text-muted small">暂无解析</div>';
        return;
    }
    renderMdPreviewSafe(box, md || '');
}

function renderAnswerExplainArea() {
    const preview = el('#answer_explain_preview');
    const btn = el('#answer_explain_edit_btn');
    renderAnswerExplainPreview(preview, state.answerExplain);
    btn?.addEventListener('click', () => {
        openVditor('答案解析', state.answerExplain || '', (md) => {
            state.answerExplain = md;
            setHiddenValues();
            renderAnswerExplainPreview(preview, md);
        });
    });
}

function renderTrueFalseAnswer(area) {
    state.answer = Array.isArray(state.answer) ? state.answer : [];
    const labels = ['T', 'F'];
    const list = document.createElement('div');
    labels.forEach((letter) => {
        const row = document.createElement('div');
        row.className = 'd-flex align-items-center mb-2 gap-2';
        const input = document.createElement('input');
        input.type = 'radio';
        input.name = 'tf_answer';
        // Bootstrap 5 的 form-check-input 默认带负 margin-left，会在 flex 行里“跑出框”
        input.className = 'form-check-input m-0';
        input.style.marginLeft = '0';
        input.value = letter;
        if (state.answer.includes(letter)) input.checked = true;
        input.addEventListener('change', () => {
            state.answer = [letter];
            setHiddenValues();
        });
        row.append(input, document.createTextNode(letter));
        list.append(row);
    });

    area.append(list);
}

function renderFillAnswer(area) {
    state.answer = Array.isArray(state.answer) ? state.answer : [];
    const list = document.createElement('div');
    state.content.forEach((_, idx) => {
        const row = document.createElement('div');
        row.className = 'mb-3';
        const title = document.createElement('div');
        title.className = 'fw-semibold mb-1';
        title.textContent = `第 ${idx + 1} 空`;
        const ansPreview = document.createElement('div');
        ansPreview.className = 'option-preview mt-1';
        renderMdPreviewSafe(ansPreview, state.answer[idx] || '');

        const editAnsBtn = btn('编辑答案', 'btn-outline-primary btn-sm flex-fill text-start', () => {
            openVditor(`第 ${idx + 1} 空答案`, state.answer[idx] || '', (md) => {
                state.answer[idx] = md;
                setHiddenValues();
                renderMdPreviewSafe(ansPreview, md);
            });
        });

        const btnRow = document.createElement('div');
        btnRow.className = 'd-flex align-items-center gap-2';
        btnRow.append(editAnsBtn);

        row.append(title, btnRow, ansPreview);
        list.append(row);
    });
    area.append(list);
}

function renderShortAnswer(area) {
    // 规范化答案格式
    state.answer = normalizeAnswerFormat(state.answer, 15);
    const answerObj = state.answer[0] || { answer: '', answer_images: [] };
    
    const wrap = document.createElement('div');
    wrap.className = 'd-flex flex-column gap-2';

    const ansPreview = document.createElement('div');
    ansPreview.className = 'option-preview';
    renderMdPreviewSafe(ansPreview, answerObj.answer || '');
    wrap.append(ansPreview);

    // 简答题：答案图从 answer[0].answer_images 读取
    const answerImages = Array.isArray(answerObj.answer_images) ? answerObj.answer_images : [];
    // 从 content 读取图片要求定义（用于显示标题）
    const item = Array.isArray(state.content) && state.content[0] ? state.content[0] : { image_reqs: [] };
    const reqs = Array.isArray(item.image_reqs) ? item.image_reqs : [];
    if (reqs.length > 0) {
        const sec = document.createElement('div');
        sec.className = 'mt-2';
        const secTitle = document.createElement('div');
        secTitle.className = 'fw-semibold mb-2 bilingual-inline';
        secTitle.innerHTML = `答案图上传<span class="en-text">Answer Image Upload</span>`;
        const list = document.createElement('div');
        list.className = 'd-flex flex-column gap-2';
        reqs.forEach((req, ridx) => {
            const row = document.createElement('div');
            row.className = 'border rounded p-2 bg-light';
            const top = document.createElement('div');
            top.className = 'd-flex align-items-center gap-2 flex-wrap';
            const left = document.createElement('div');
            left.className = 'flex-grow-1';
            left.innerHTML = `<strong>图片${ridx + 1}</strong>：${(req?.title || '').trim() || '<span class="text-muted">（未填写描述）</span>'}`;
            const uploadBtn = makeBilingualIconBtn(
                '上传答案图',
                'Upload',
                'bi bi-upload',
                'btn btn-sm btn-outline-success',
                () => {
                    const qid = parseInt(el('#ex_question_id')?.value || '0', 10) || 0;
                    const input = document.createElement('input');
                    input.type = 'file';
                    input.accept = '.bmp,.png,.jpg,.jpeg,.webp,.tif,.tiff,image/*';
                    input.addEventListener('change', async () => {
                        const file = input.files && input.files[0];
                        if (!file) return;
                        try {
                            const webpBlob = await preprocessImageToWebp(file);
                            await uploadAnswerImage(qid, 0, ridx, webpBlob);
                        } catch (e) {
                            console.error(e);
                            alerty.error(String(e?.message || e || '上传失败'));
                        }
                    });
                    input.click();
                }
            );
            const info = document.createElement('div');
            info.className = 'small text-muted mt-2';
            // 最佳实践：answer 只显示已保存 URL；临时图显示“待保存”并使用本地预览
            const savedUrl = answerImages[ridx] || '';
            const pendingTmp = getTmpAnswerImg(0, ridx);
            const src = getAnswerImgSrc(0, ridx, savedUrl);
            const displayName = pendingTmp
                ? `待保存：${pendingTmp}`
                : (getAnswerImgDisplayName(savedUrl) ? `已保存：${getAnswerImgDisplayName(savedUrl)}` : '');
            info.textContent = displayName || '未上传';
            const thumbWrap = document.createElement('div');
            thumbWrap.className = 'mt-2 d-flex align-items-center gap-2 flex-wrap';
            const img = createImageElement(src, {
                alt: `答案图 图片${ridx + 1}`,
                title: `答案图 图片${ridx + 1}`,
                clickable: true
            });
            thumbWrap.append(img);
            top.append(left, uploadBtn);
            row.append(top, info, thumbWrap);
            list.append(row);
        });
        sec.append(secTitle, list);
        wrap.append(sec);
    }
    area.append(wrap);
}

function bindAnswerEditButton() {
    const btn = el('#edit_answer_btn');
    if (!btn) return;
    btn.addEventListener('click', () => {
        // 针对不同题型使用当前渲染区域的编辑方式
        if (pkind === 0 || pkind === 1 || pkind === 5 || pkind === 10 || pkind === 20 || pkind === 25) {
            // 这些题型的答案已经在区域中呈现对应控件，点击按钮时滚动到答案区域
            const area = el('#answer_edit_area');
            if (area) {
                area.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        } else if (pkind === 15) {
            // 简答题直接弹出编辑答案
            state.answer = normalizeAnswerFormat(state.answer, 15);
            const currentAnswer = state.answer[0]?.answer || '';
            openVditor('编辑答案', currentAnswer, (md) => {
                state.answer = normalizeAnswerFormat(state.answer, 15);
                if (!state.answer[0]) {
                    state.answer[0] = { answer: '', answer_images: [] };
                }
                state.answer[0].answer = md;
                setHiddenValues();
                renderContentArea();
                renderAnswerArea();
            });
        }
    });
}
function renderComprehensiveAnswer(area) {
    // 规范化答案格式
    state.answer = normalizeAnswerFormat(state.answer, 20);
    const list = document.createElement('div');
    state.content.forEach((_, idx) => {
        const answerObj = state.answer[idx] || { answer: '', answer_images: [] };
        
        const card = document.createElement('div');
        card.className = 'mb-3';

        const row = document.createElement('div');
        row.className = 'd-flex align-items-center gap-2';
        row.append(document.createTextNode(`第 ${idx + 1} 小题`));

        const ansPreview = document.createElement('div');
        ansPreview.className = 'option-preview mt-2';
        renderMdPreviewSafe(ansPreview, answerObj.answer || '');

        const ansBtn = btn('编辑答案', 'btn-outline-primary btn-sm flex-fill text-start', () => {
            openVditor(`第 ${idx + 1} 小题答案`, answerObj.answer || '', (md) => {
                state.answer = normalizeAnswerFormat(state.answer, 20);
                if (!state.answer[idx]) {
                    state.answer[idx] = { answer: '', answer_images: [] };
                }
                state.answer[idx].answer = md;
                setHiddenValues();
                renderMdPreviewSafe(ansPreview, state.answer[idx].answer);
            });
        });
        row.append(ansBtn);

        card.append(row, ansPreview);

        // 综合题：答案图从 answer[idx].answer_images 读取
        const answerImages = Array.isArray(answerObj.answer_images) ? answerObj.answer_images : [];
        // 从 content 读取图片要求定义（用于显示标题）
        const sub = state.content?.[idx];
        const reqs = Array.isArray(sub?.image_reqs) ? sub.image_reqs : [];
        if (reqs.length > 0) {
            const sec = document.createElement('div');
            sec.className = 'mt-2';
            const secTitle = document.createElement('div');
            secTitle.className = 'fw-semibold mb-2 bilingual-inline';
            secTitle.innerHTML = `答案图上传<span class="en-text">Answer Image Upload</span>`;
            const ulist = document.createElement('div');
            ulist.className = 'd-flex flex-column gap-2';
            reqs.forEach((req, ridx) => {
                const r = document.createElement('div');
                r.className = 'border rounded p-2 bg-light';
                const top = document.createElement('div');
                top.className = 'd-flex align-items-center gap-2 flex-wrap';
                const left = document.createElement('div');
                left.className = 'flex-grow-1';
                left.innerHTML = `<strong>图片${ridx + 1}</strong>：${(req?.title || '').trim() || '<span class="text-muted">（未填写描述）</span>'}`;
                const uploadBtn = makeBilingualIconBtn(
                    '上传答案图',
                    'Upload',
                    'bi bi-upload',
                    'btn btn-sm btn-outline-success',
                    () => {
                        const qid = parseInt(el('#ex_question_id')?.value || '0', 10) || 0;
                        const input = document.createElement('input');
                        input.type = 'file';
                        input.accept = '.bmp,.png,.jpg,.jpeg,.webp,.tif,.tiff,image/*';
                        input.addEventListener('change', async () => {
                            const file = input.files && input.files[0];
                            if (!file) return;
                            try {
                                const webpBlob = await preprocessImageToWebp(file);
                                await uploadAnswerImage(qid, idx, ridx, webpBlob);
                            } catch (e) {
                                console.error(e);
                                alerty.error(String(e?.message || e || '上传失败'));
                            }
                        });
                        input.click();
                    }
                );
                const info = document.createElement('div');
                info.className = 'small text-muted mt-2';
                // 最佳实践：answer 只显示已保存 URL；临时图显示“待保存”并使用本地预览
                const savedUrl = answerImages[ridx] || '';
                const pendingTmp = getTmpAnswerImg(idx, ridx);
                const src = getAnswerImgSrc(idx, ridx, savedUrl);
                const displayName = pendingTmp
                    ? `待保存：${pendingTmp}`
                    : (getAnswerImgDisplayName(savedUrl) ? `已保存：${getAnswerImgDisplayName(savedUrl)}` : '');
                info.textContent = displayName || '未上传';
                const thumbWrap = document.createElement('div');
                thumbWrap.className = 'mt-2 d-flex align-items-center gap-2 flex-wrap';
                const img = createImageElement(src, {
                    alt: `答案图 第${idx + 1}小题 图片${ridx + 1}`,
                    title: `答案图 第${idx + 1}小题 图片${ridx + 1}`,
                    clickable: true
                });
                thumbWrap.append(img);
                top.append(left, uploadBtn);
                r.append(top, info, thumbWrap);
                ulist.append(r);
            });
            sec.append(secTitle, ulist);
            card.append(sec);
        }
        list.append(card);
    });
    area.append(list);
}

function renderProgrammingAnswer(area) {
    state.answer = Array.isArray(state.answer) ? state.answer : [''];
    const codeInput = document.createElement('textarea');
    codeInput.className = 'form-control mb-2';
    codeInput.rows = 8;
    codeInput.value = state.answer[0] || '';
    codeInput.addEventListener('input', () => {
        state.answer[0] = codeInput.value;
        setHiddenValues();
    });
    area.append(codeInput);
}

function btn(text, cls, onClick) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = `btn ${cls}`;
    b.textContent = text;
    b.addEventListener('click', onClick);
    return b;
}

/**
 * 生成统一风格的“双语 + icon”按钮
 * @param {string} cn 中文（必填）
 * @param {string} en 英文（可选）
 * @param {string} icon Bootstrap Icons class（可选），如 "bi bi-image"
 * @param {string} cls 按钮 class（可选，需包含 btn/btn-sm 等）
 * @param {Function} onClick 点击回调
 */
function makeBilingualIconBtn(cn, en = '', icon = '', cls = 'btn btn-sm btn-outline-primary', onClick = () => {}, layout = 'inline') {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = cls;
    const iconHtml = icon ? `<i class="${icon}"></i>` : '';
    const cnHtml = cn ? `<span class="cn-text">${cn}</span>` : '';
    const enHtml = en ? `<span class="en-text">${en}</span>` : '';
    if (layout === 'stack') {
        // 垂直堆叠：让按钮内容更容易在宽按钮里居中
        b.innerHTML = `
            <span class="d-flex flex-column align-items-center justify-content-center w-100 text-center">
                <span class="d-inline-flex align-items-center justify-content-center gap-1 w-100">${iconHtml}${cnHtml}</span>
                ${enHtml}
            </span>
        `;
    } else {
        // 默认：与现有“编辑/编辑解析”等按钮一致（中文一行 + 英文一行）
        b.innerHTML = `<span class="d-inline-flex align-items-center gap-1">${iconHtml}${cnHtml}</span>${enHtml}`;
    }
    b.addEventListener('click', onClick);
    return b;
}

// ---------- JSON 导入导出 ----------
function bindJsonImportExport() {
    const downloadBtn = el('#download_json_btn');
    const uploadBtn = el('#upload_json_btn');
    const fileInput = el('#json_file_input');

    downloadBtn?.addEventListener('click', () => {
        const payload = collectAllFields();
        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
        // 获取题目类型中文名称
        // 所有依赖已全局引入，直接使用
        const pkindCn = (question_default.pkind_table_cn && question_default.pkind_table_cn[String(pkind)]) || `类型${pkind}`;
        // 时间戳格式：年月日时分秒 (YYYYMMDDHHmmss)
        const now = new Date();
        const timestamp = [
            now.getFullYear(),
            String(now.getMonth() + 1).padStart(2, '0'),
            String(now.getDate()).padStart(2, '0'),
            String(now.getHours()).padStart(2, '0'),
            String(now.getMinutes()).padStart(2, '0'),
            String(now.getSeconds()).padStart(2, '0')
        ].join('');
        const name = `question_${payload.ex_question_id || 'new'}_${pkindCn}_${timestamp}.json`;
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = name;
        a.click();
        URL.revokeObjectURL(a.href);
    });

    uploadBtn?.addEventListener('click', () => fileInput.click());
    fileInput?.addEventListener('change', (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            try {
                const data = JSON.parse(ev.target.result);
                applyImportedData(data);
                setHiddenValues();
            } catch (err) {
                alerty.error('JSON 解析失败');
            }
        };
        reader.readAsText(file);
        fileInput.value = '';
    });
}

function collectAllFields() {
    return {
        title: el('#question_title').value || '',
        pkind,
        description: state.description,
        content: state.content,
        answer: state.answer,
        answer_explain: state.answerExplain,
        // 临时答案图：属于“编辑态草稿信息”，也应纳入脏检查，确保上传后“保存修改”按钮亮起
        tmp_uuid: state.tmp_uuid || '',
        tmp_answer_images: el('#tmp_answer_images')?.value || '',
        source: el('#question_source').value || '',
        author: el('#question_author').value || '',
        label: el('#question_label').value || '',
        ex_question_id: el('#ex_question_id')?.value || '',
    };
}

function applyImportedData(data) {
    if (!data || typeof data !== 'object') return;
    if ('title' in data) el('#question_title').value = data.title;
    if ('pkind' in data) {
        pkind = parseInt(data.pkind, 10);
        el('#pkind_input').value = pkind;
        // 切换导航高亮
        document.querySelectorAll('.li_pkind').forEach((n) => {
            n.classList.toggle('active', parseInt(n.getAttribute('pkind'), 10) === pkind);
        });
    }
    state.description = data.description ?? state.description;
    // 兼容导出格式：content/answer 可能是 JSON 字符串（如 "[]"/"[{...}]"）
    const normalizeMaybeJson = (v, fallback) => {
        if (v === null || v === undefined) return fallback;
        // 已经是数组/对象：直接返回
        if (typeof v === 'object') return v;
        // 字符串：尝试 JSON.parse（仅在看起来像 JSON 时）
        if (typeof v === 'string') {
            const s = v.trim();
            if ((s.startsWith('[') && s.endsWith(']')) || (s.startsWith('{') && s.endsWith('}'))) {
                try { return JSON.parse(s); } catch (e) { return fallback; }
            }
            return fallback;
        }
        return fallback;
    };
    state.content = normalizeMaybeJson(data.content, state.content);
    // 规范化答案格式（兼容旧格式）
    const rawAnswer = normalizeMaybeJson((data.answer ?? state.answer), state.answer);
    state.answer = normalizeAnswerFormat(rawAnswer, pkind);
    // answer_explain：解析结构化 JSON 对象 { "explain": "...", "score_advice": "..." }
    if ('answer_explain' in data) {
        const parsed = parseAnswerExplainCombined(data.answer_explain);
        state.answerExplain = parsed.explain;
        state.scoreAdvice = parsed.advice;
    }
    if ('source' in data) el('#question_source').value = data.source;
    if ('author' in data) el('#question_author').value = data.author;
    if ('label' in data) el('#question_label').value = data.label;
    // 清理本地预览缓存，避免跨题型/跨导入污染
    state._localAnswerImg = {};

    el('#question_description').value = state.description;
    setHiddenValues();
    renderDescriptionPreview();
    renderContentArea();
    renderAnswerArea();
    renderAnswerExplainArea();
    syncScoreAdviceUI();
    syncQuestionEditSurface();
    if (isProgramming()) {
        toggleProgrammingControls(true);
        loadProgrammingPreviewByDesc(state.description);
    } else {
        toggleProgrammingControls(false);
    }
}

// ---------- Draft Mode (IndexedDB) ----------
function genDraftId() {
    // 不依赖 crypto.randomUUID，避免部分环境缺失
    return `d_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function uuidv4() {
    // RFC4122 v4（不依赖 crypto）
    // xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
    let d = Date.now();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = (d + Math.random() * 16) % 16 | 0;
        d = Math.floor(d / 16);
        if (c === 'x') return r.toString(16);
        return ((r & 0x3) | 0x8).toString(16);
    });
}

function isUuidV4Like(s) {
    const v = String(s || '').trim();
    return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

function draftUploadPathFor(fileName) {
    const folder = String(state._draftAttachFolder || '').trim();
    const fn = String(fileName || '').replace(/^\/+/, '');
    if (!folder || !fn) return '';
    // 保持与真实系统一致：/upload/{attach_folder}/{file_name}
    return `/upload/${folder}/${fn}`;
}

function draftEnsureAttachFolder() {
    if (state._draftAttachFolder && String(state._draftAttachFolder).trim() !== '') return;
    state._draftAttachFolder = uuidv4();
}

function draftFindAttachmentByName(fileName) {
    const fn = String(fileName || '');
    const atts = Array.isArray(state._draftAttachments) ? state._draftAttachments : [];
    return atts.find(a => String(a?.file_name || '') === fn) || null;
}

function draftGetObjectUrlForUploadPath(uploadPath) {
    const p = String(uploadPath || '');
    if (!p.startsWith('/upload/')) return null;
    const folder = String(state._draftAttachFolder || '').trim();
    if (!folder) return null;
    const prefix = `/upload/${folder}/`;
    const idx = p.indexOf(prefix);
    if (idx < 0) return null;
    const rel = p.slice(idx + prefix.length);
    const fileName = decodeURIComponentSafe(rel);
    const att = draftFindAttachmentByName(fileName) || draftFindAttachmentByName(rel);
    if (!att || !att.blob) return null;
    if (!state._draftObjectUrls) state._draftObjectUrls = {};
    const key = prefix + rel;
    if (!state._draftObjectUrls[key]) {
        state._draftObjectUrls[key] = URL.createObjectURL(att.blob);
    }
    return state._draftObjectUrls[key];
}

function decodeURIComponentSafe(s) {
    try { return decodeURIComponent(String(s || '')); } catch (e) { return String(s || ''); }
}

function draftRewriteUploadLinks(rootEl) {
    if (!rootEl) return;
    const folder = String(state._draftAttachFolder || '').trim();
    if (!folder) return;
    const prefix = `/upload/${folder}/`;
    const nodes = rootEl.querySelectorAll('img, a, source, video, audio');
    nodes.forEach((n) => {
        // img/source/video/audio: src；a: href
        const attr = (n.tagName && n.tagName.toLowerCase() === 'a') ? 'href' : 'src';
        const v = n.getAttribute(attr);
        if (!v) return;
        const pos = v.indexOf(prefix);
        if (pos < 0) return;
        const url = draftGetObjectUrlForUploadPath(v);
        if (!url) return;
        // 替换为对象 URL（预览可用），但保留原始路径以便用户复制/导出一致
        n.setAttribute(attr, url);
        if (attr === 'href') {
            n.setAttribute('target', '_blank');
            n.setAttribute('rel', 'noopener');
        }
    });
}

function draftInsertMarkdownOrCopy(md) {
    const text = String(md || '');
    if (!text) return;
    try {
        // 如果 Vditor 弹窗打开，优先插入到编辑器
        if (vditorSingleton && vditorSingleton.getInstance && vditorSingleton.getInstance()) {
            const v = vditorSingleton.getInstance();
            if (v && typeof v.insertValue === 'function') {
                v.insertValue(text);
                return;
            }
        }
    } catch (e) {}
    // 兜底：复制到剪贴板
    ClipboardWrite(text).then(() => {
        alerty.success('已复制到剪贴板', 'Copied to clipboard');
    }).catch(() => {
        alerty.warn('无法自动插入，已生成文本请手动复制', 'Cannot insert automatically');
    });
}

function draftShowAttachModal() {
    // 轻量 modal：不追求完全复刻 filemanager，但交互尽量一致
    let modalEl = document.getElementById('draft_attach_modal');
    if (!modalEl) {
        modalEl = document.createElement('div');
        modalEl.id = 'draft_attach_modal';
        modalEl.className = 'modal fade';
        modalEl.tabIndex = -1;
        modalEl.innerHTML = `
            <div class="modal-dialog modal-lg modal-dialog-scrollable">
              <div class="modal-content">
                <div class="modal-header">
                  <h5 class="modal-title">
                    本地附件（草稿）<span class="en-text">Local Attachments (Draft)</span>
                  </h5>
                  <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                </div>
                <div class="modal-body">
                  <div class="alert alert-warning py-2">
                    <strong>注意：</strong>附件仅保存在本机浏览器，不会上传到服务器；导出 zip 后交由管理员导入。
                    <span class="en-text">Attachments are stored locally in your browser and will NOT be uploaded to the server. Export zip and send it to an admin for import.</span>
                  </div>
                  <div class="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-2">
                    <div class="text-muted small">
                      attach 目录：<code id="draft_attach_folder_code"></code>
                      <span class="en-text">Attach folder</span>
                    </div>
                    <div class="d-flex gap-2">
                      <button type="button" class="btn btn-sm btn-primary" id="draft_attach_add_btn">
                        <i class="bi bi-upload"></i> 添加<span class="en-text">Add</span>
                      </button>
                    </div>
                  </div>
                  <div class="table-responsive">
                    <table class="table table-sm table-hover align-middle">
                      <thead>
                        <tr>
                          <th>文件<span class="en-text">File</span></th>
                          <th style="width:120px;">大小<span class="en-text">Size</span></th>
                          <th style="width:260px;">操作<span class="en-text">Actions</span></th>
                        </tr>
                      </thead>
                      <tbody id="draft_attach_tbody"></tbody>
                    </table>
                  </div>
                </div>
                <div class="modal-footer">
                  <button type="button" class="btn btn-secondary btn-sm" data-bs-dismiss="modal">关闭<span class="en-text">Close</span></button>
                </div>
              </div>
            </div>
        `;
        document.body.appendChild(modalEl);
    }

    const folderCode = modalEl.querySelector('#draft_attach_folder_code');
    if (folderCode) folderCode.textContent = String(state._draftAttachFolder || '');

    const tbody = modalEl.querySelector('#draft_attach_tbody');
    const atts = Array.isArray(state._draftAttachments) ? state._draftAttachments : [];
    if (tbody) {
        if (atts.length === 0) {
            tbody.innerHTML = `<tr><td colspan="3" class="text-muted text-center">暂无附件<span class="en-text">No attachments</span></td></tr>`;
        } else {
            tbody.innerHTML = atts.map((a, idx) => {
                const fn = String(a.file_name || '');
                const size = Number(a.size || 0);
                const uploadPath = draftUploadPathFor(fn);
                return `
                    <tr>
                      <td>
                        <div class="fw-semibold">${DomSantize(fn)}</div>
                        <div class="text-muted small"><code>${DomSantize(uploadPath)}</code></div>
                      </td>
                      <td class="text-muted small">${(size/1024).toFixed(1)} KB</td>
                      <td>
                        <div class="d-flex flex-wrap gap-1">
                          <button type="button" class="btn btn-sm btn-outline-secondary" data-act="copy" data-idx="${idx}">
                            <i class="bi bi-clipboard"></i>
                          </button>
                          <button type="button" class="btn btn-sm btn-outline-primary" data-act="mdimg" data-idx="${idx}">
                            <i class="bi bi-image"></i>
                          </button>
                          <button type="button" class="btn btn-sm btn-outline-danger" data-act="del" data-idx="${idx}">
                            <i class="bi bi-trash"></i>
                          </button>
                        </div>
                      </td>
                    </tr>
                `;
            }).join('');
        }
    }

    modalEl.querySelectorAll('button[data-act]').forEach((btn) => {
        btn.addEventListener('click', async () => {
            const act = btn.getAttribute('data-act');
            const idx = parseInt(btn.getAttribute('data-idx'), 10);
            const attsNow = Array.isArray(state._draftAttachments) ? state._draftAttachments : [];
            const a = attsNow[idx];
            if (!a) return;
            const fn = String(a.file_name || '');
            const uploadPath = draftUploadPathFor(fn);
            if (act === 'copy') {
                await ClipboardWrite(uploadPath);
                alerty.success('已复制附件路径', 'Copied attachment path');
            } else if (act === 'mdimg') {
                const md = `![](${uploadPath})`;
                draftInsertMarkdownOrCopy(md);
                alerty.success('已插入/复制 Markdown 图片语法', 'Markdown inserted/copied');
            } else if (act === 'del') {
                // 删除附件
                state._draftAttachments = attsNow.filter((_, i) => i !== idx);
                // 清理对象 URL
                try {
                    const keyPrefix = `/upload/${String(state._draftAttachFolder)}/${fn}`;
                    if (state._draftObjectUrls) {
                        Object.keys(state._draftObjectUrls).forEach((k) => {
                            if (k.includes(keyPrefix)) {
                                try { URL.revokeObjectURL(state._draftObjectUrls[k]); } catch (e) {}
                                delete state._draftObjectUrls[k];
                            }
                        });
                    }
                } catch (e) {}
                // 刷新预览（让图片消失）
                try { renderDescriptionPreview(); } catch (e) {}
                try { renderContentArea(); } catch (e) {}
                try { renderAnswerExplainArea(); } catch (e) {}
                draftShowAttachModal();
            }
        }, { once: true });
    });

    const addBtn = modalEl.querySelector('#draft_attach_add_btn');
    addBtn?.addEventListener('click', () => {
        el('#draft_attach_input')?.click();
    }, { once: true });

    const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
    modal.show();
}

function buildExportRowFromEditor() {
    // 目标：与 /exadmin/question/question_export 导出的 question_list.json 单条 item 字段结构对齐
    // 说明：
    // - content/answer/label 等在数据库里通常是字符串；这里使用隐藏域的 JSON 字符串以保持一致
    // - attach：草稿本地附件用一个“文件夹名”承载，导出 zip 时会创建同名目录
    const title = (el('#question_title')?.value || '').trim();
    const pk = parseInt(el('#pkind_input')?.value || '0', 10) || 0;
    const desc = el('#question_description')?.value || '';
    const contentStr = el('#question_content')?.value || '[]';
    const answerStr = el('#question_answer')?.value || '[]';
    const explainStr = el('#question_answer_explain')?.value || null;
    const source = el('#question_source')?.value || '';
    const author = el('#question_author')?.value || '';
    const label = el('#question_label')?.value || '';
    return {
        // ex_question_id：草稿无真实 id，导入端会 delete(ex_question_id) 后 insert
        ex_question_id: null,
        title: title,
        pkind: pk,
        description: desc,
        content: contentStr,
        answer: answerStr,
        answer_explain: explainStr && String(explainStr).trim() !== '' ? explainStr : null,
        attach: null,
        source: source,
        author: author,
        label: label,
        uni_id: '', // 由导入端补齐或由管理员导入时生成
        create_at: '',
        update_at: '',
    };
}

async function bindLocalDraft() {
    const draftModeEl = el('#tpl_draft_mode');
    const isDraft = (draftModeEl && String(draftModeEl.value || '') === '1');
    if (!isDraft) return;

    const TABLE = 'examsys_question_draft';
    const saveBtn = el('#save_local_draft_btn');
    const submitBtn = el('#submit_button');
    const draftIdEl = el('#tpl_draft_id');
    const courseKeyEl = el('#tpl_now_course_key');
    const nowCourseKey = (courseKeyEl?.value || '').trim();

    // 草稿 attach 目录：尽量与真实题库一致（UUIDv4）
    state._draftAttachFolder = '';
    state._draftAttachments = Array.isArray(state._draftAttachments) ? state._draftAttachments : [];
    state._draftObjectUrls = state._draftObjectUrls || {};

    // 草稿模式：让 markdown 预览支持 /upload/{attach}/xx 的本地映射（“真实路径风格，JS兜底可预览”）
    if (typeof window !== 'undefined') {
        if (!window.__CSGOJ_DRAFT_RENDER_MD_PATCHED) {
            window.__CSGOJ_DRAFT_RENDER_MD_PATCHED = true;
            const orig = (typeof window.renderMdPreview === 'function') ? window.renderMdPreview : null;
            window.renderMdPreview = function(elm, md) {
                try {
                    if (orig) orig(elm, md);
                    else renderMdPreviewLocal(elm, md);
                } finally {
                    // 关键：渲染后把 /upload/{attach}/... 替换为 blob url
                    try { draftRewriteUploadLinks(elm); } catch (e) {}
                }
            };
        }
    }

    // 加载已有草稿
    const draftId0 = (draftIdEl?.value || '').trim();
    if (draftId0) {
        try {
            const key = { course_key: nowCourseKey, draft_id: draftId0 };
            const kv = await idb.GetIdbTableByKey(TABLE, key);
            if (kv && kv.payload) {
                applyImportedData(kv.payload);
                alerty.success('已加载草稿', 'Draft loaded');
            }
            // 本地附件（Blob）也随草稿加载
            state._draftAttachments = (kv && Array.isArray(kv.attachments)) ? kv.attachments : [];
            // attach folder：优先沿用导入/旧草稿的 attach
            const folder = (kv && kv.export_row && kv.export_row.attach) ? String(kv.export_row.attach) : (kv && kv.attach_folder ? String(kv.attach_folder) : '');
            if (folder) {
                state._draftAttachFolder = folder;
            }
        } catch (e) {
            console.error(e);
            alerty.error('加载草稿失败', 'Failed to load draft');
        }
    }

    // 若仍无 folder，则生成 UUIDv4
    draftEnsureAttachFolder();

    // 本地附件：选择文件加入草稿（仅本机 IndexedDB，不上传服务器）
    const attachBtn = el('#draft_attach_btn');
    const attachInput = el('#draft_attach_input');
    state._draftAttachments = Array.isArray(state._draftAttachments) ? state._draftAttachments : [];
    // 点击“本地附件”只打开管理弹窗（不要自动弹出文件选择框）
    // 文件选择入口由弹窗里的“添加”按钮触发
    attachBtn?.addEventListener('click', () => {
        // 如果用户只是想打开弹窗（而不是直接打开系统 file picker），弹窗里也有“添加”按钮
        try { draftShowAttachModal(); } catch (e) { console.error(e); }
    });
    attachInput?.addEventListener('change', async (e) => {
        const files = Array.from(e.target.files || []);
        attachInput.value = '';
        if (!files.length) return;
        files.forEach((f) => {
            state._draftAttachments.push({
                file_name: f.name,
                type: f.type || '',
                size: f.size || 0,
                blob: f, // Blob/File 直接存入 IndexedDB（最佳实践：避免 base64 膨胀）
                updated_at: Date.now(),
            });
        });
        alerty.success(`已添加 ${files.length} 个本地附件（仅保存于本机）`, `Added ${files.length} local attachment(s)`);
        // 立即刷新预览（如果用户刚插入了 /upload/... 图片）
        try { renderDescriptionPreview(); } catch (e) {}
        try { renderContentArea(); } catch (e) {}
        try { renderAnswerExplainArea(); } catch (e) {}
    });

    if (!saveBtn) return;

    // 草稿页底部“保存草稿”按钮（submit_button）复用同一保存逻辑
    if (submitBtn && submitBtn.type === 'button') {
        submitBtn.addEventListener('click', () => {
            try { saveBtn.click(); } catch (e) {}
        });
    }

    saveBtn.addEventListener('click', async () => {
        const payload = collectAllFields();
        const title = (payload.title || '').trim() || '(未命名)';
        const did = (draftIdEl?.value || '').trim() || genDraftId();
        const key = { course_key: nowCourseKey, draft_id: did };
        const now = Date.now();
        setHiddenValues();
        const export_row = buildExportRowFromEditor();
        // 草稿附件目录名：与真实题库一致（UUIDv4），并与导出 zip 目录结构对齐（question_import 按 item.attach 取目录）
        // 如果旧草稿是 draft_xxx，自动迁移为 uuid（并替换内容里的 /upload/old/... 引用）
        const oldFolder = String(state._draftAttachFolder || '').trim();
        if (!isUuidV4Like(oldFolder)) {
            const newFolder = uuidv4();
            const oldPrefix = `/upload/${oldFolder}/`;
            const newPrefix = `/upload/${newFolder}/`;
            // 替换描述
            if (typeof state.description === 'string' && state.description.includes(oldPrefix)) {
                state.description = state.description.split(oldPrefix).join(newPrefix);
                el('#question_description').value = state.description;
            }
            // 替换 content（各种题型的字符串字段里都可能包含 markdown）
            try {
                const walkReplace = (x) => {
                    if (typeof x === 'string') return x.includes(oldPrefix) ? x.split(oldPrefix).join(newPrefix) : x;
                    if (Array.isArray(x)) return x.map(walkReplace);
                    if (x && typeof x === 'object') {
                        const out = {};
                        Object.keys(x).forEach((k) => { out[k] = walkReplace(x[k]); });
                        return out;
                    }
                    return x;
                };
                state.content = walkReplace(state.content);
            } catch (e) {}
            state._draftAttachFolder = newFolder;
        }
        export_row.attach = String(state._draftAttachFolder || '');
        const value = {
            meta: {
                title,
                pkind: payload.pkind,
                updated_at: now,
            },
            payload,
            export_row,
            attachments: Array.isArray(state._draftAttachments) ? state._draftAttachments : [],
            attach_folder: String(state._draftAttachFolder || ''),
        };
        await idb.SetIdbTableByKey(TABLE, key, value);
        if (draftIdEl) draftIdEl.value = did;
        // URL 带上 draft_id，方便刷新/分享当前草稿入口（仍是本地）
        try {
            const u = new URL(window.location.href);
            u.searchParams.set('draft_id', did);
            window.history.replaceState({}, '', u.toString());
        } catch (e) {}
        alerty.success('已保存到本地草稿', 'Saved to local draft');
    });
}

// ---------- 初始化 ----------
function initFromHidden() {
    pkind = parseInt(el('#pkind_input').value || '0', 10);
    state.description = el('#question_description').value || '';
    state.content = safeParse(el('#question_content').value, []);
    // 规范化答案格式（兼容旧格式）
    const rawAnswer = safeParse(el('#question_answer').value, []);
    state.answer = normalizeAnswerFormat(rawAnswer, pkind);
    state.tmp_uuid = el('#tmp_uuid')?.value || '';
    state._localAnswerImg = {};
    state._tmpAnswerImages = {};
    // 解析 answer_explain：结构化 JSON 对象或兼容旧格式
    const rawExplain = el('#question_answer_explain').value || '';
    const parsedExplain = safeParse(rawExplain, rawExplain);
    const split = parseAnswerExplainCombined(parsedExplain);
    state.answerExplain = split.explain;
    state.scoreAdvice = split.advice;
    setHiddenValues();
    syncScoreAdviceUI();
    syncQuestionEditSurface();
    if (isProgramming()) {
        loadProgrammingPreviewByDesc(state.description);
        toggleProgrammingControls(true);
    } else {
        toggleProgrammingControls(false);
    }
}

// 给“本地草稿/二次复用”暴露最小 API（不影响原逻辑）
if (typeof window !== 'undefined') {
    window.CSGOJ_EXAM_QUESTION_EDIT = window.CSGOJ_EXAM_QUESTION_EDIT || {};
    window.CSGOJ_EXAM_QUESTION_EDIT.collectAllFields = collectAllFields;
    window.CSGOJ_EXAM_QUESTION_EDIT.applyImportedData = applyImportedData;
    window.CSGOJ_EXAM_QUESTION_EDIT.setHiddenValues = setHiddenValues;
}

function bindPkindSwitch() {
    document.querySelectorAll('.li_pkind').forEach((a) => {
        a.addEventListener('click', (e) => {
            e.preventDefault();
            const navPkind = parseInt(a.getAttribute('pkind'), 10);
            if (Number.isNaN(navPkind)) return;
            pkind = navPkind;
            el('#pkind_input').value = pkind;
            // 载入默认模板
            // 所有依赖已全局引入，直接使用
            const defaults = question_default;
            const key = (question_default.pkind_template_key && question_default.pkind_template_key[String(pkind)]) || '';
            if (key && defaults[key]) {
                state.content = JSON.parse(JSON.stringify(defaults[key].content || []));
                state.answer = JSON.parse(JSON.stringify(defaults[key].answer || []));
                state.answerExplain = '';
            } else {
                state.content = [];
                state.answer = [];
                state.answerExplain = '';
            }
            // 切换题型时：评分建议仅简答/综合可用，其他题型清空
            if (!(pkind === 15 || pkind === 20)) state.scoreAdvice = '';
            setHiddenValues();
            renderContentArea();
            renderAnswerArea();
            renderAnswerExplainArea();
            syncScoreAdviceUI();
            syncQuestionEditSurface();
            // 同步题型配色到 DOM（用于背景/标签等）
            try {
                if (typeof window !== 'undefined' && typeof window.CsgApplyPkindColorsToDom === 'function') {
                    window.CsgApplyPkindColorsToDom();
                }
            } catch (e) {}
            // 更新导航高亮
            document.querySelectorAll('.li_pkind').forEach(n => n.classList.remove('active'));
            a.classList.add('active');
            if (isProgramming()) {
                toggleProgrammingControls(true);
                loadProgrammingPreviewByDesc(state.description);
            } else {
                currentProblem = null;
                toggleProgrammingControls(false);
                renderDescriptionPreview();
            }
        });
    });
}

function bindFormSubmit() {
    const form = el('#question_edit_form');
    if (!form) return;
    form.addEventListener('submit', (e) => {
        const isDraft = (String(el('#tpl_draft_mode')?.value || '') === '1');
        // 草稿模式：禁止任何“提交到后端”的行为（避免 action=javascript:void(0) 触发 CORS/ERR_FAILED）
        // 用户点击“保存草稿/保存到本地”应写入 IndexedDB
        if (isDraft) {
            e.preventDefault();
            e.stopPropagation();
            setHiddenValues();
            if (!validateBeforeSubmit()) {
                return false;
            }
            // 复用 bindLocalDraft 绑定的保存逻辑
            const saveBtn = el('#save_local_draft_btn') || el('#submit_button');
            if (saveBtn) {
                saveBtn.click();
            } else {
                alerty.error('未找到保存按钮', 'Save button not found');
            }
            return false;
        }

        const isEdit = !!(el('#ex_question_id')?.value);
        setHiddenValues();
        if (!validateBeforeSubmit()) {
            e.preventDefault();
            e.stopPropagation();
            return false;
        }
        // 所有依赖已全局引入，直接使用 jQuery
        if (!$ || typeof $.post !== 'function') {
            // 无 jQuery 时走默认提交
            return;
        }
        e.preventDefault();
        e.stopPropagation();
        setSubmitEnabled(false);
        $.post(form.getAttribute('action') || form.action || window.location.href, $(form).serialize())
            .done((ret) => {
                if (ret && ret.code === 1) {
                    if (ret.data && ret.data.ex_question_id) {
                        const idInput = el('#ex_question_id');
                        if (idInput) idInput.value = ret.data.ex_question_id;
                    }
                    alerty.success(ret.msg || '提交成功');
                    // 新增成功后 0.5s 跳转到编辑页
                    if (!isEdit && ret.data && ret.data.ex_question_id) {
                        setTimeout(() => {
                            window.location.href = `/exadmin/question/question_edit?ex_question_id=${ret.data.ex_question_id}`;
                        }, 500);
                    }
                    initialSnapshot = JSON.stringify(collectAllFields());
                    isDirty = false;
                    setSubmitEnabled(false);
                } else {
                    setSubmitEnabled(true);
                    const msg = (ret && ret.msg) ? ret.msg : '提交失败';
                    alerty.error(msg);
                }
            })
            .fail(() => {
                setSubmitEnabled(true);
                alerty.error('提交失败，请稍后重试');
            });
        return false;
    });
}

function bindReset() {
    const doReset = () => {
        const defaults = window.question_default || {};
        const key = (question_default.pkind_template_key && question_default.pkind_template_key[String(pkind)]) || '';
        if (key && defaults[key]) {
            state.content = JSON.parse(JSON.stringify(defaults[key].content || []));
            state.answer = JSON.parse(JSON.stringify(defaults[key].answer || []));
            state.answerExplain = '';
        } else {
            state.content = [];
            state.answer = [];
            state.answerExplain = '';
        }
        renderContentArea();
        renderAnswerArea();
        setHiddenValues();
        alerty.success('已重置为默认模板');
    };

    const resetHandler = (e) => {
        e.preventDefault();
        alerty.confirm('确认重置？', '将恢复当前题型的默认模板，已填内容将丢失。', () => {
            doReset();
        }, () => {});
    };

    el('#reset_button')?.addEventListener('click', resetHandler);
    el('#reset_button_top')?.addEventListener('click', resetHandler);
}

// ---------- 前端校验 ----------
function fvtShowError(element, message) {
    // 所有依赖已全局引入，直接使用
    if (element) {
        FormValidationTip.showFieldError(element, message);
    } else {
        alerty.error(message);
    }
}

function fvtClearError(element) {
    // 所有依赖已全局引入，直接使用
    if (element) {
        FormValidationTip.clearFieldError(element);
    }
}

function validateBeforeSubmit() {
    const errors = [];
    const titleEl = el('#question_title');
    const titleVal = (titleEl?.value || '').trim();
    const labelEl = el('#question_label');
    const labelVal = (labelEl?.value || '').trim();
    const answerAreaEl = el('#answer_edit_area');
    
    // 先清理旧的错误样式
    fvtClearError(titleEl);
    fvtClearError(labelEl);
    if (answerAreaEl) {
        // 清除答案区域的错误提示
        const errorMsg = answerAreaEl.querySelector('.invalid-feedback');
        if (errorMsg) errorMsg.remove();
        answerAreaEl.classList.remove('is-invalid');
    }
    
    if (!titleVal) {
        errors.push({ el: titleEl, msg: '标题不能为空' });
    }
    if (!labelVal) {
        errors.push({ el: labelEl, msg: '标签不能为空' });
    }
    
    // 答案验证（所有题型都需要，除了编程题）
    if (pkind !== 25) {
        let answerValid = false;
        let answerErrorMsg = '答案不能为空';
        
        if (pkind === 0 || pkind === 1) {
            // 选择题
            if (!Array.isArray(state.content) || state.content.length < 2) {
                errors.push({ el: el('#content_edit_area'), msg: '选择题至少需要 2 个选项' });
            }
            if (Array.isArray(state.answer) && state.answer.length > 0) {
                // 检查答案是否都是有效的选项字母
                const validAnswers = state.answer.filter(a => {
                    if (typeof a !== 'string' || a.length !== 1) return false;
                    const idx = a.toUpperCase().charCodeAt(0) - 65;
                    return idx >= 0 && idx < state.content.length;
                });
                answerValid = validAnswers.length > 0;
                if (!answerValid && state.answer.length > 0) {
                    answerErrorMsg = '选择题答案格式不正确或超出选项范围';
                }
            }
        } else if (pkind === 5) {
            // 判断题：答案应该是 ["T"] 或 ["F"]
            if (Array.isArray(state.answer) && state.answer.length > 0) {
                const valid = state.answer.some(a => a === 'T' || a === 'F');
                answerValid = valid;
                if (!answerValid) {
                    answerErrorMsg = '判断题答案必须是 T 或 F';
                }
            }
        } else if (pkind === 10) {
            // 填空题：每个填空都要有答案
            if (Array.isArray(state.content) && state.content.length > 0) {
                if (Array.isArray(state.answer) && state.answer.length === state.content.length) {
                    // 检查每个答案是否非空
                    const allFilled = state.answer.every(a => a && String(a).trim() !== '');
                    answerValid = allFilled;
                    if (!answerValid) {
                        answerErrorMsg = '所有填空都必须填写答案';
                    }
                } else {
                    answerErrorMsg = '填空题答案数量与填空数量不匹配';
                }
            } else {
                answerErrorMsg = '填空题至少需要 1 个填空';
            }
        } else if (pkind === 15) {
            // 简答题：答案不能为空
            state.answer = normalizeAnswerFormat(state.answer, 15);
            if (Array.isArray(state.answer) && state.answer.length > 0) {
                const answerObj = state.answer[0];
                const answerText = (typeof answerObj === 'object' && answerObj !== null) 
                    ? (answerObj.answer || '') 
                    : String(answerObj || '');
                answerValid = answerText.trim() !== '';
            }
        } else if (pkind === 20) {
            // 综合题：每个小题都要有答案，并验证分数比例
            state.answer = normalizeAnswerFormat(state.answer, 20);
            if (Array.isArray(state.content) && state.content.length > 0) {
                // 验证分数比例
                let ratioSum = 0;
                let hasNonInteger = false;
                let lastNonIntegerIdx = -1;
                for (let i = 0; i < state.content.length; i++) {
                    const item = state.content[i];
                    const ratio = item?.score_ratio;
                    const ratioInput = document.querySelector(`.ratio-input[data-idx="${i}"][data-pkind="20"]`);
                    if (ratio !== undefined && ratio !== null && String(ratio).trim() !== '') {
                        const numRatio = parseFloat(ratio);
                        if (Number.isNaN(numRatio)) {
                            if (ratioInput) {
                                errors.push({ el: ratioInput, msg: `第 ${i + 1} 小题分数比例格式不正确` });
                            } else {
                                errors.push({ el: el('#content_edit_area'), msg: `第 ${i + 1} 小题分数比例格式不正确` });
                            }
                        } else {
                            // 检查是否为整数
                            if (numRatio % 1 !== 0) {
                                hasNonInteger = true;
                                lastNonIntegerIdx = i;
                                if (ratioInput) {
                                    errors.push({ el: ratioInput, msg: '分数比例必须是整数' });
                                }
                            }
                            // 只累加前 n-1 个小题的分数比例
                            if (i < state.content.length - 1) {
                                ratioSum += numRatio;
                            }
                        }
                    }
                }
                
                // 检查分数比例之和不能超过100
                if (ratioSum > 100) {
                    // 找到第一个分数比例输入框（如果有多个，显示在第一个上）
                    const firstRatioInput = document.querySelector('.ratio-input[data-pkind="20"]');
                    if (firstRatioInput) {
                        errors.push({ el: firstRatioInput, msg: `分数比例之和（${ratioSum}%）不能超过 100%` });
                    } else {
                        errors.push({ el: el('#content_edit_area'), msg: `分数比例之和（${ratioSum}%）不能超过 100%` });
                    }
                }
                
                // 如果分数比例之和不足100：自动补齐最后一个小题
                // 注意：只有当“最后一个小题的分数比例为空或不等于应补齐值”时才调整并提示；
                // 若用户已手动填对（例如 99 + 1），则不应重复弹提示。
                if (ratioSum < 100 && !hasNonInteger && state.content.length > 0) {
                    const lastIdx = state.content.length - 1;
                    const expectedLast = Math.round(100 - ratioSum); // 确保是整数

                    const rawLast = state.content[lastIdx]?.score_ratio;
                    const lastIsEmpty = (rawLast === undefined || rawLast === null || String(rawLast).trim() === '');
                    const lastNum = lastIsEmpty ? null : parseFloat(rawLast);
                    const lastIsValidInt = (lastNum !== null && !Number.isNaN(lastNum) && lastNum % 1 === 0);
                    const lastAlreadyOk = (lastIsValidInt && Math.round(lastNum) === expectedLast);

                    if (!lastAlreadyOk) {
                        state.content[lastIdx].score_ratio = expectedLast;
                        // 更新界面显示
                        const lastRatioInput = document.querySelector(`.ratio-input[data-idx="${lastIdx}"]`);
                        if (lastRatioInput) {
                            lastRatioInput.value = expectedLast;
                            // 触发 input 事件以更新界面提示和状态
                            lastRatioInput.dispatchEvent(new Event('input', { bubbles: true }));
                        }
                        setHiddenValues();
                        // 仅当确实发生“自动调整”时提示
                        alerty.warn(`分数比例之和不等于 100%，已自动将第 ${lastIdx + 1} 小题的分数比例调整为 ${expectedLast}%`);
                    }
                }
                
                // 验证答案
                if (Array.isArray(state.answer) && state.answer.length === state.content.length) {
                    const allFilled = state.answer.every(item => {
                        const answerText = (typeof item === 'object' && item !== null) 
                            ? (item.answer || '') 
                            : String(item || '');
                        return answerText.trim() !== '';
                    });
                    answerValid = allFilled;
                    if (!answerValid) {
                        answerErrorMsg = '所有小题都必须填写答案';
                    }
                } else {
                    answerErrorMsg = '综合题答案数量与小题数量不匹配';
                }
            } else {
                answerErrorMsg = '综合题至少需要 1 个小题';
            }
        }
        
        if (!answerValid) {
            errors.push({ el: answerAreaEl, msg: answerErrorMsg });
        }
    } else if (pkind === 25) {
        // 编程题：验证题号
        const descEl = el('#question_description');
        const descVal = (descEl?.value || '').trim();
        fvtClearError(descEl);
        if (!descVal) {
            errors.push({ el: descEl, msg: '编程题题号不能为空' });
        } else if (Number.isNaN(Number(descVal))) {
            errors.push({ el: descEl, msg: '编程题题号必须是数字' });
        }
    }

    // 简答/综合题：图片要求校验（每条必须有标题与答案图）
    // 答案图从 answer 字段读取，不再从 content 读取
    state.answer = normalizeAnswerFormat(state.answer, pkind);
    if (pkind === 15) {
        const item = Array.isArray(state.content) && state.content[0] ? state.content[0] : { image_reqs: [] };
        const reqs = Array.isArray(item.image_reqs) ? item.image_reqs : [];
        if (reqs.length > 10) errors.push({ el: el('#content_edit_area'), msg: '简答题图片要求最多 10 条' });
        const answerObj = state.answer[0] || { answer: '', answer_images: [] };
        const answerImages = Array.isArray(answerObj.answer_images) ? answerObj.answer_images : [];
        reqs.forEach((r, i) => {
            const titleInput = document.querySelector(`input[data-pkind="15"][data-ridx="${i}"]`);
            if (!r || !String(r.title || '').trim()) {
                if (titleInput) {
                    errors.push({ el: titleInput, msg: `图片要求 ${i + 1}：描述不能为空` });
                } else {
                    errors.push({ el: el('#content_edit_area'), msg: `简答题图片要求 ${i + 1}：描述不能为空` });
                }
            }
            // 重要：已保存的 URL 或“待保存”的临时图（二者任一存在即可视为已上传）
            const savedUrl = answerImages[i] || '';
            const pendingTmp = getTmpAnswerImg(0, i);
            if (!String(savedUrl).trim() && !String(pendingTmp).trim()) {
                errors.push({ el: el('#answer_edit_area'), msg: `图片要求 图片${i + 1}：必须上传答案图` });
            }
        });
    }
    if (pkind === 20) {
        const content = Array.isArray(state.content) ? state.content : [];
        content.forEach((it, subIdx) => {
            const reqs = Array.isArray(it?.image_reqs) ? it.image_reqs : [];
            if (reqs.length > 10) errors.push({ el: el('#content_edit_area'), msg: `综合题第 ${subIdx + 1} 小题图片要求最多 10 条` });
            const answerObj = state.answer[subIdx] || { answer: '', answer_images: [] };
            const answerImages = Array.isArray(answerObj.answer_images) ? answerObj.answer_images : [];
            reqs.forEach((r, i) => {
                const titleInput = document.querySelector(`input[data-pkind="20"][data-sub-idx="${subIdx}"][data-ridx="${i}"]`);
                if (!r || !String(r.title || '').trim()) {
                    if (titleInput) {
                        errors.push({ el: titleInput, msg: `第 ${subIdx + 1} 小题图片要求 ${i + 1}：描述不能为空` });
                    } else {
                        errors.push({ el: el('#content_edit_area'), msg: `综合题第 ${subIdx + 1} 小题图片要求 ${i + 1}：描述不能为空` });
                    }
                }
                // 重要：已保存的 URL 或“待保存”的临时图（二者任一存在即可视为已上传）
                const savedUrl = answerImages[i] || '';
                const pendingTmp = getTmpAnswerImg(subIdx, i);
                if (!String(savedUrl).trim() && !String(pendingTmp).trim()) {
                    errors.push({ el: el('#answer_edit_area'), msg: `第 ${subIdx + 1} 小题 图片${i + 1}：必须上传答案图` });
                }
            });
        });
    }

    if (errors.length) {
        // 总提示：避免用户误以为“点击无响应”
        try {
            alerty.error('表单未完成，请先补全必填项并按红色提示修正。<br/><span class="en-text">Form incomplete. Please complete required fields.</span>');
        } catch (e) {}
        // 定位第一个错误
        const first = errors[0];
        if (first.el) first.el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        errors.forEach((err) => {
            // 优先在输入框旁边显示错误（支持 INPUT, TEXTAREA, SELECT）
            if (err.el && (err.el.tagName === 'INPUT' || err.el.tagName === 'TEXTAREA' || err.el.tagName === 'SELECT')) {
                fvtShowError(err.el, err.msg);
            } else if (err.el) {
                // 对于区域元素，也尝试显示错误（会回退到 alerty 如果元素不支持）
                fvtShowError(err.el, err.msg);
            } else {
                // 非输入区域用 alerty/alert 提示
                alerty.error(err.msg);
            }
        });
        return false;
    }
    return true;
}

function initVditorModal() {
    vditorModal = el('#vditor_modal');
    vditorSaveBtn = el('#vditor_save_btn');
    vditorTitle = el('#vditor_modal_title');
    vditorSaveBtn.addEventListener('click', () => {
        // 所有依赖已全局引入，直接使用
        if (currentVditorSave && vditorSingleton && vditorSingleton.getInstance()) {
            const v = vditorSingleton.getInstance();
            currentVditorSave(v.getValue());
            setHiddenValues();
            closeVditorModal();
        }
    });
}

document.addEventListener('DOMContentLoaded', () => {
    initVditorModal();
    initFromHidden();
    bindPkindSwitch();
    bindProblemSelector();
    descriptionSectionInit();
    renderContentArea();
    renderAnswerArea();
    renderAnswerExplainArea();
    bindAnswerEditButton();
    bindScoreAdvice();
    bindJsonImportExport();
    bindFormSubmit();
    bindReset();
    bindLocalDraft();
    // Ctrl+S 快捷提交
    document.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
            e.preventDefault();
            const form = el('#question_edit_form');
            if (form && !el('#submit_button')?.disabled) {
                form.requestSubmit ? form.requestSubmit() : form.submit();
            }
        }
    });
    // 初始化提交禁用，记录初始快照
    initialSnapshot = JSON.stringify(collectAllFields());
    setSubmitEnabled(false);
    isDirty = false;
    // 监听表单原生输入/变更
    el('#question_edit_form')?.addEventListener('input', () => setHiddenValues());
    el('#question_edit_form')?.addEventListener('change', () => setHiddenValues());
});
