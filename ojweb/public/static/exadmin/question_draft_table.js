// **************************************************
// 出题草稿列表（本地 IndexedDB）——BootstrapTable 版本
// 目标：UI/交互与 /exadmin/question/question_list 一致
// 依赖：idb（全局）、zip（全局）、alerty（全局）、jQuery、bootstrapTable、
//      question_default.js、question_render.js、question_preview.js（renderQuestionPreview）
//      exadmin/question_list.js（复用 FormatterQuestionType/Label 等）
// **************************************************

(function() {
    'use strict';

    // 与编辑页（question_edit.js / bindLocalDraft）保持一致的存储表
    // key: { course_key, draft_id }
    // value: { meta, payload, export_row, attachments, attach_folder }
    const TABLE = 'examsys_question_draft';

    const $table = $('#draft_question_table');
    const el = (sel) => document.querySelector(sel);

    const isJsonLike = (v) => {
        if (typeof v !== 'string') return false;
        const s = v.trim();
        return (s.startsWith('[') && s.endsWith(']')) || (s.startsWith('{') && s.endsWith('}'));
    };
    const parseMaybeJson = (v, fallback) => {
        if (v === null || v === undefined) return fallback;
        if (typeof v === 'object') return v;
        if (typeof v === 'string') {
            const s = v.trim();
            if (isJsonLike(s)) {
                try { return JSON.parse(s); } catch (e) { return fallback; }
            }
            return fallback;
        }
        return fallback;
    };
    const esc = (s) => String(s ?? '').replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

    function nowTs() { return Math.floor(Date.now() / 1000); }
    function nowMs() { return Date.now(); }

    function getNowCourseKey() {
        return String(el('#tpl_now_course_key')?.value || '').trim();
    }

    function normUnixTsSec(v) {
        let t = Number(v) || 0;
        // 草稿 meta.updated_at 是 ms；DB 里常见是 sec
        if (t > 1e12) t = Math.floor(t / 1000);
        return t;
    }

    function buildDraftKey(draft_id) {
        return { course_key: getNowCourseKey(), draft_id: String(draft_id || '').trim() };
    }

    async function idbGetAllDrafts() {
        const rows = await idb.GetIdbTable(TABLE);
        const list = Array.isArray(rows) ? rows : [];
        const ck = getNowCourseKey();
        // list: [{key, value}]
        return list
            .filter((x) => x && typeof x === 'object' && x.key && x.value)
            .filter((x) => {
                // 若页面没有 course_key（理论上不会），则不过滤
                if (!ck) return true;
                return String(x.key.course_key || '').trim() === ck;
            })
            .map((x) => ({
                draft_id: String(x.key.draft_id || ''),
                course_key: String(x.key.course_key || ''),
                ...(x.value || {}),
            }))
            .filter((x) => x.draft_id);
    }

    async function idbGetDraftById(draft_id) {
        const key = buildDraftKey(draft_id);
        const value = await idb.GetIdbTableByKey(TABLE, key);
        if (!value) return null;
        return {
            draft_id: String(key.draft_id || ''),
            course_key: String(key.course_key || ''),
            ...(value || {})
        };
    }

    async function idbDeleteDraft(draft_id) {
        const key = buildDraftKey(draft_id);
        await idb.DelIdbTableByKey(TABLE, key);
    }

    function toTableRow(d) {
        // d: { draft_id, meta, payload, export_row, attachments, attach_folder, ... }
        const payload = d?.payload || {};
        const exportRow = d?.export_row || {};
        const pkind = parseInt(payload?.pkind ?? exportRow?.pkind ?? d?.meta?.pkind ?? 0, 10) || 0;
        const title = String(payload?.title ?? exportRow?.title ?? '(未命名)');
        const source = String(payload?.source ?? exportRow?.source ?? '');
        const author = String(payload?.author ?? exportRow?.author ?? '');
        const label = String(payload?.label ?? exportRow?.label ?? '');
        const updatedMs = d?.meta?.updated_at ?? 0;
        const updated = normUnixTsSec(updatedMs);
        return {
            __isDraft: true,
            draft_id: String(d?.draft_id ?? ''),
            // 为了复用现有列/formatter，保留 ex_question_id 字段，但显示为“草稿”
            ex_question_id: 0,
            title,
            pkind,
            source,
            author,
            label,
            create_at: 0,
            update_at: updated || 0,
            // 原始数据（预览用）
            __raw: d || {},
        };
    }

    function getActivePkindSet() {
        const set = new Set();
        document.querySelectorAll('.draft_question_filter_check').forEach((n) => {
            if (n.checked) set.add(parseInt(n.getAttribute('pkind'), 10));
        });
        return set;
    }

    function getSearchText() {
        return String(el('#draft_search_input')?.value ?? '').trim().toLowerCase();
    }

    function matchSearch(row, kw) {
        if (!kw) return true;
        const hay = [
            row?.draft_id,
            row?.title,
            row?.source,
            row?.author,
            row?.label,
        ].map(x => String(x ?? '').toLowerCase()).join(' ');
        return hay.includes(kw);
    }

    function applyClientFilter(allRows) {
        const pkSet = getActivePkindSet();
        const kw = getSearchText();
        return allRows.filter((r) => {
            const pk = parseInt(r?.pkind ?? 0, 10) || 0;
            // 与 question_list 行为保持一致：
            // 初始全不选也视为“全选”，便于用户直接点某个类型开始筛选
            if (pkSet.size > 0 && !pkSet.has(pk)) return false;
            if (!matchSearch(r, kw)) return false;
            return true;
        });
    }

    // -------------------- formatters（草稿专用/复用） --------------------
    window.FormatterDraftSelect = function(_v, row) {
        const id = esc(row?.draft_id ?? '');
        return `<input class="draft-select" type="checkbox" data-draft-id="${id}">`;
    };

    window.FormatterDraftQuestionId = function(_v, row) {
        const id = esc(row?.draft_id ?? '');
        return `<span class="badge text-bg-success" title="${id}">草稿</span>`;
    };

    window.FormatterDraftQuestionTitle = function(value, row) {
        const title = esc(value ?? '');
        const id = esc(row?.draft_id ?? '');
        // 点击预览（本地）
        return `
            <div class="d-flex flex-column">
                <span class="cursor-pointer text-primary draft_question_preview"
                      data-draft-id="${id}"
                      style="cursor:pointer;text-decoration:underline;"
                      title="点击预览 / Click to preview">${title}</span>
                <span class="text-muted" style="font-size:12px;">${id}</span>
            </div>
        `;
    };

    window.FormatterDraftOperate = function(_v, row) {
        const id = esc(row?.draft_id ?? '');
        return `
            <div class="btn-group btn-group-sm" role="group" aria-label="Draft actions">
                <a class="btn btn-outline-primary"
                   href="/exadmin/question/question_draft_edit?draft_id=${encodeURIComponent(row?.draft_id ?? '')}"
                   title="编辑 / Edit">
                    <i class="bi bi-pencil-square"></i>
                </a>
                <button type="button"
                        class="btn btn-outline-success draft-export-one"
                        data-draft-id="${id}"
                        title="导出 / Export">
                    <i class="bi bi-file-earmark-zip"></i>
                </button>
                <button type="button"
                        class="btn btn-outline-danger draft-del-one"
                        data-draft-id="${id}"
                        title="删除 / Delete">
                    <i class="bi bi-trash"></i>
                </button>
            </div>
        `;
    };

    // -------------------- 本地预览（复用 question_preview.js 的渲染器） --------------------
    async function showDraftPreviewById(draft_id) {
        const d = await idbGetDraftById(draft_id);
        if (!d) {
            alerty.error('草稿不存在或已被删除', 'Draft not found');
            return;
        }
        // 渲染器 QuestionRender.html.* 期望的字段格式与后端 question_ajax 一致：
        // - description: markdown string
        // - content: JSON string（如 ["A","B"]）
        // - answer: string 或 JSON string（如 ["A"]）
        const exportRow = d?.export_row || {};
        const payload = d?.payload || {};
        const qidSafe = `draft_${String(draft_id || '').replace(/[^\w-]/g, '_')}_${Date.now()}`;
        const questionData = {
            ex_question_id: qidSafe,
            pkind: parseInt(payload?.pkind ?? exportRow?.pkind ?? 0, 10) || 0,
            title: String(payload?.title ?? exportRow?.title ?? ''),
            description: String(payload?.description ?? exportRow?.description ?? ''),
            // content/answer：优先使用 export_row（编辑页保存时已是字符串 JSON）
            content: exportRow?.content ?? payload?.content ?? '[]',
            answer: exportRow?.answer ?? payload?.answer ?? '[]',
            answer_explain: String(payload?.answer_explain ?? exportRow?.answer_explain ?? ''),
            source: String(payload?.source ?? exportRow?.source ?? ''),
            author: String(payload?.author ?? exportRow?.author ?? ''),
            label: String(payload?.label ?? exportRow?.label ?? ''),
            // programming 题会用到 description 作为 pid（保持原样）
        };

        // 兜底：若 content 不是 JSON string，尽量转成可被 JSON.parse 的形式，避免预览直接炸
        try {
            if (typeof questionData.content !== 'string') {
                questionData.content = JSON.stringify(questionData.content ?? []);
            } else {
                const s = String(questionData.content || '').trim();
                if (!isJsonLike(s)) {
                    const lines = s.split(/\r?\n/).map(x => x.trim()).filter(Boolean);
                    questionData.content = JSON.stringify(lines.length ? lines : (s ? [s] : []));
                } else {
                    questionData.content = s;
                }
            }
        } catch (e) {
            questionData.content = '[]';
        }
        try {
            if (typeof questionData.answer !== 'string') {
                questionData.answer = JSON.stringify(questionData.answer ?? []);
            }
        } catch (e) {}

        // 草稿预览：不展示“使用该题的考试”，避免走后端 usage_ajax
        const oldCfg = window.questionPreviewConfig ? { ...window.questionPreviewConfig } : null;
        window.questionPreviewConfig = { ...(window.questionPreviewConfig || {}), showUsage: false, showAnswer: true };

        try {
            const pkindName = question_default['pkind_table'][questionData.pkind];
            if (pkindName === 'Programming') {
                const problemUrl = '/exadmin/exam/problem_ajax';
                const html = await QuestionRender.html.Programming_async(questionData, null, true, problemUrl);
                renderQuestionPreview(html, questionData, `draft:${draft_id}`, '/exadmin/question/question_ajax');
            } else {
                const html = QuestionRender.html[pkindName](questionData, null, true);
                renderQuestionPreview(html, questionData, `draft:${draft_id}`, '/exadmin/question/question_ajax');
            }

            // 草稿附件预览映射：将 /upload/{folder}/{file} 替换为 blob url（如草稿有附件信息）
            // 这里只做轻量兜底：若草稿保存了 _draftAttachFolder/_draftAttachments，则映射图片/链接
            setTimeout(async () => {
                const folder = String(d?.attach_folder || d?.export_row?.attach || '').trim();
                const atts = Array.isArray(d?.attachments) ? d.attachments : [];
                if (!folder || atts.length === 0) return;

                // attachments: [{file_name, mime, blob/base64?...}] —— 兼容性：我们只依赖 file_name/blob
                const nameToBlob = new Map();
                atts.forEach((a) => {
                    if (!a || !a.file_name) return;
                    if (a.blob instanceof Blob) nameToBlob.set(String(a.file_name), a.blob);
                });
                if (nameToBlob.size === 0) return;

                const modals = Array.from(document.querySelectorAll('.question-preview-modal.show'));
                if (modals.length === 0) return;
                const modal = modals[modals.length - 1];
                const nodes = modal.querySelectorAll('img[src^="/upload/"], a[href^="/upload/"]');
                nodes.forEach((n) => {
                    const attr = n.tagName === 'IMG' ? 'src' : 'href';
                    const p = String(n.getAttribute(attr) || '');
                    const m = p.match(/^\/upload\/([^/]+)\/(.+)$/);
                    if (!m) return;
                    const f = m[1];
                    const fn = decodeURIComponent(m[2]);
                    if (f !== folder) return;
                    const blob = nameToBlob.get(fn);
                    if (!blob) return;
                    const url = URL.createObjectURL(blob);
                    n.setAttribute(attr, url);
                });
            }, 0);
        } finally {
            if (oldCfg) window.questionPreviewConfig = oldCfg;
            else delete window.questionPreviewConfig;
        }
    }

    // -------------------- 导入/导出（沿用原草稿逻辑） --------------------
    async function exportDraftsToZip(draftIds) {
        const ids = Array.isArray(draftIds) ? draftIds.filter(Boolean) : [];
        if (ids.length === 0) {
            alerty.warning('请选择草稿', 'Please select drafts');
            return;
        }

        // zip.js 已在模板引入
        zip.configure({ useWebWorkers: false });
        const writer = new zip.ZipWriter(new zip.BlobWriter('application/zip'));

        // 导出结构：question_list.json + (可选) upload/{uuid}/...
        // question_list.json：兼容后端题目导出格式（数组）
        const list = [];
        for (const id of ids) {
            const d = await idbGetDraftById(id);
            if (!d) continue;
            const exportRow = d.export_row || d.payload || {};
            // 把 draft_id 作为附加字段写入，便于导入后再编辑
            list.push({ ...exportRow, draft_id: d.draft_id });

            // 写附件（若草稿里是 blob）
            const folder = String(d?.attach_folder || exportRow?.attach || '').trim();
            const atts = Array.isArray(d?.attachments) ? d.attachments : [];
            if (folder) {
                for (const a of atts) {
                    if (!a || !a.file_name || !(a.blob instanceof Blob)) continue;
                    const path = `upload/${folder}/${String(a.file_name).replace(/^\/+/, '')}`;
                    await writer.add(path, new zip.BlobReader(a.blob));
                }
            }
        }

        await writer.add('question_list.json', new zip.TextReader(JSON.stringify(list, null, 2)));
        const blob = await writer.close();

        const a = document.createElement('a');
        const fn = `draft_questions_${nowTs()}.zip`;
        a.download = fn;
        a.href = URL.createObjectURL(blob);
        document.body.appendChild(a);
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 1500);
        a.remove();
    }

    async function importDraftsFromFile(file) {
        if (!file) return;
        const name = String(file.name || '').toLowerCase();
        try {
            const nowCourseKey = getNowCourseKey();
            if (name.endsWith('.json')) {
                const text = await file.text();
                const data = JSON.parse(text);
                const list = Array.isArray(data) ? data : (Array.isArray(data?.list) ? data.list : []);
                let cnt = 0;
                for (const d of list) {
                    if (!d) continue;
                    const draft_id = String(d.draft_id || `d_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`);
                    const export_row = { ...d, ex_question_id: null };
                    const payload = { ...export_row }; // applyImportedData 会自行解析 JSON 字符串
                    const key = { course_key: nowCourseKey, draft_id };
                    const value = {
                        meta: { title: export_row.title || '(未命名)', pkind: export_row.pkind, updated_at: nowMs() },
                        payload,
                        export_row,
                        attachments: [],
                        attach_folder: String(export_row.attach || ''),
                    };
                    await idb.SetIdbTableByKey(TABLE, key, value);
                    cnt++;
                }
                alerty.success(`导入成功：${cnt} 条`, `Imported: ${cnt}`);
                await refreshTable();
                return;
            }
            // zip
            zip.configure({ useWebWorkers: false });
            const reader = new zip.ZipReader(new zip.BlobReader(file));
            const entries = await reader.getEntries();
            const qEntry = entries.find(e => e.filename === 'question_list.json');
            if (!qEntry) {
                await reader.close();
                alerty.error('ZIP 内缺少 question_list.json', 'Missing question_list.json');
                return;
            }
            const text = await qEntry.getData(new zip.TextWriter());
            const list = JSON.parse(text);
            const arr = Array.isArray(list) ? list : [];

            // 先建 draft，再把附件写回 _draftAttachments.blob
            const fileMap = new Map();
            for (const e of entries) fileMap.set(e.filename, e);

            let cnt = 0;
            for (const d of arr) {
                const draft_id = String(d?.draft_id || `d_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`);
                const folder = String(d?._draftAttachFolder || '').trim();
                const attsMeta = Array.isArray(d?._draftAttachments) ? d._draftAttachments : [];
                const atts = [];
                for (const a of attsMeta) {
                    const fn = String(a?.file_name || '');
                    if (!folder || !fn) continue;
                    const p = `upload/${folder}/${fn.replace(/^\/+/, '')}`;
                    const ent = fileMap.get(p);
                    if (!ent) continue;
                    const blob = await ent.getData(new zip.BlobWriter(a?.mime || 'application/octet-stream'));
                    atts.push({ file_name: fn, mime: a?.mime || '', blob });
                }
                const export_row = { ...d, ex_question_id: null };
                // 兼容两种字段命名：_draftAttachFolder / attach
                export_row.attach = export_row.attach || folder;
                const payload = { ...export_row };
                const key = { course_key: nowCourseKey, draft_id };
                await idb.SetIdbTableByKey(TABLE, key, {
                    meta: { title: export_row.title || '(未命名)', pkind: export_row.pkind, updated_at: nowMs() },
                    payload,
                    export_row,
                    attachments: atts,
                    attach_folder: String(export_row.attach || ''),
                });
                cnt++;
            }
            await reader.close();
            alerty.success(`导入成功：${cnt} 条`, `Imported: ${cnt}`);
            await refreshTable();
        } catch (e) {
            console.error(e);
            alerty.error('导入失败：文件格式不正确', 'Import failed');
        }
    }

    // -------------------- 表格/事件 --------------------
    let __allRows = [];

    async function ensureBootstrapTableInitialized() {
        // bootstrap-table.js 会自动对 [data-toggle="table"] 执行初始化，
        // 这里避免重复初始化导致 "You cannot initialize the table more than once!"
        const maxTry = 30;
        for (let i = 0; i < maxTry; i++) {
            if ($table.data('bootstrap.table')) return;
            // 等待 bootstrap-table 的自动初始化完成
            await new Promise((r) => setTimeout(r, 10));
        }
        // 兜底：若仍未初始化，则手动初始化一次
        if (!$table.data('bootstrap.table')) {
            $table.bootstrapTable({ data: [] });
        }
    }

    async function refreshTable() {
        await ensureBootstrapTableInitialized();
        const drafts = await idbGetAllDrafts();
        __allRows = drafts.map(toTableRow);
        const filtered = applyClientFilter(__allRows);
        $table.bootstrapTable('load', filtered);
        syncSelectAllState();
    }

    function getSelectedDraftIds() {
        const ids = [];
        document.querySelectorAll('.draft-select:checked').forEach((n) => {
            const id = String(n.getAttribute('data-draft-id') || '');
            if (id) ids.push(id);
        });
        return ids;
    }

    function syncSelectAllState() {
        const all = Array.from(document.querySelectorAll('.draft-select'));
        const checked = Array.from(document.querySelectorAll('.draft-select:checked'));
        const box = el('#draft_select_all');
        if (!box) return;
        if (all.length === 0) {
            box.indeterminate = false;
            box.checked = false;
            return;
        }
        box.checked = checked.length === all.length;
        box.indeterminate = checked.length > 0 && checked.length < all.length;
    }

    function bindEventsOnce() {
        // 预览
        $(document).off('click.draft_preview', '.draft_question_preview').on('click.draft_preview', '.draft_question_preview', function(e) {
            e.preventDefault();
            const id = $(this).attr('data-draft-id');
            showDraftPreviewById(id);
        });

        // 操作：单条导出/删除
        $(document).off('click.draft_export_one', '.draft-export-one').on('click.draft_export_one', '.draft-export-one', async function() {
            const id = $(this).attr('data-draft-id');
            await exportDraftsToZip([id]);
        });
        $(document).off('click.draft_del_one', '.draft-del-one').on('click.draft_del_one', '.draft-del-one', async function() {
            const id = $(this).attr('data-draft-id');
            if (!confirm('确定删除该草稿？\nAre you sure to delete this draft?')) return;
            await idbDeleteDraft(id);
            await refreshTable();
        });

        // 筛选
        document.querySelectorAll('.draft_question_filter_check').forEach((n) => {
            n.addEventListener('change', refreshTable);
        });
        el('#draft_search_input')?.addEventListener('input', () => {
            // 简单节流：用户输入时即时刷新
            refreshTable();
        });
        el('#draft_filter_all')?.addEventListener('click', () => {
            document.querySelectorAll('.draft_question_filter_check').forEach(n => n.checked = true);
            refreshTable();
        });
        el('#draft_filter_clear')?.addEventListener('click', () => {
            document.querySelectorAll('.draft_question_filter_check').forEach(n => n.checked = false);
            refreshTable();
        });
        el('#draft_question_clear')?.addEventListener('click', () => {
            document.querySelectorAll('.draft_question_filter_check').forEach(n => n.checked = true);
            const s = el('#draft_search_input'); if (s) s.value = '';
            refreshTable();
        });

        // 全选导出
        el('#draft_select_all')?.addEventListener('change', (e) => {
            const checked = !!e.target.checked;
            document.querySelectorAll('.draft-select').forEach(n => { n.checked = checked; });
            syncSelectAllState();
        });
        $(document).off('change.draft_select', '.draft-select').on('change.draft_select', '.draft-select', syncSelectAllState);

        // 顶部按钮：导入/导出所选/刷新
        el('#draft_refresh_btn')?.addEventListener('click', refreshTable);
        el('#draft_export_selected_btn')?.addEventListener('click', async () => {
            await exportDraftsToZip(getSelectedDraftIds());
        });
        el('#draft_import_btn')?.addEventListener('click', () => el('#draft_import_file')?.click());
        el('#draft_import_file')?.addEventListener('change', async (e) => {
            const file = e.target.files && e.target.files[0];
            await importDraftsFromFile(file);
            e.target.value = '';
        });
    }

    // 表格初始化：client data
    document.addEventListener('DOMContentLoaded', async function() {
        bindEventsOnce();
        await ensureBootstrapTableInitialized();
        await refreshTable();

        // 表格重绘后同步“全选”状态
        $table.on('post-body.bs.table', function() {
            syncSelectAllState();
        });
    });
})();


