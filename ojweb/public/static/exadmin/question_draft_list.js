// 本地出题草稿列表（IndexedDB）
// 依赖：window.idb、alerty、zip（全局已引入）、question_default（全局已引入）
(function(){
    'use strict';

    const TABLE = 'examsys_question_draft';
    const tbody = document.getElementById('draft_tbody');
    const selectAll = document.getElementById('draft_select_all');
    const exportBtn = document.getElementById('draft_export_selected_btn');
    const importBtn = document.getElementById('draft_import_btn');
    const importFile = document.getElementById('draft_import_file');
    const refreshBtn = document.getElementById('draft_refresh_btn');
    const nowCourseKey = (document.getElementById('tpl_now_course_key')?.value || '').trim();

    function fmtTime(ts) {
        if (!ts) return '';
        try {
            return DateFormat(new Date(ts), 'yyyy-MM-dd HH:mm:ss');
        } catch (e) {
            return String(ts);
        }
    }

    function pkindName(pkind) {
        const p = String(pkind ?? '');
        return (window.question_default?.pkind_table_cn && window.question_default.pkind_table_cn[p]) || `类型${p}`;
    }

    function esc(s) {
        return String(s ?? '').replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    }

    async function loadAllDrafts() {
        const all = await idb.GetIdbTable(TABLE);
        // all: [{key:..., value:...}, ...]
        const rows = [];
        (all || []).forEach((kv) => {
            if (!kv || typeof kv !== 'object') return;
            const key = kv.key || {};
            const value = kv.value || {};
            if (nowCourseKey && key.course_key && String(key.course_key) !== String(nowCourseKey)) return;
            rows.push({ key, value });
        });
        // 按更新时间降序
        rows.sort((a, b) => (b.value?.meta?.updated_at || 0) - (a.value?.meta?.updated_at || 0));
        return rows;
    }

    function getSelectedDraftIds() {
        const ids = [];
        document.querySelectorAll('input.draft-select[type="checkbox"]').forEach((cb) => {
            if (cb.checked) ids.push(cb.getAttribute('data-draft-id'));
        });
        return ids.filter(Boolean);
    }

    async function exportDraftsZip(drafts, fileSuffix) {
        if (!drafts || drafts.length === 0) {
            alerty.warn('请先选择要导出的草稿', 'Please select drafts to export');
            return;
        }
        const zipWriter = new zip.ZipWriter(new zip.BlobWriter("application/zip"));
        // 兼容：优先使用 export_row（与正式导出格式一致），否则退回 payload（旧草稿）
        const exportRows = [];
        for (const d of drafts) {
            const row = d.value?.export_row || null;
            if (row) {
                exportRows.push(row);
            } else if (d.value?.payload) {
                exportRows.push(d.value.payload);
            }
        }
        await zipWriter.add("question_list.json", new zip.TextReader(JSON.stringify(exportRows, null, 4)));
        // 附件：与正式导出一致，按每题 row.attach 目录名打包
        for (const d of drafts) {
            const row = d.value?.export_row || null;
            const attachFolder = row?.attach;
            const atts = d.value?.attachments;
            if (!attachFolder || !Array.isArray(atts) || atts.length === 0) continue;
            for (const a of atts) {
                const fn = a?.file_name;
                const blob = a?.blob;
                if (!fn || !blob) continue;
                await zipWriter.add(`${attachFolder}/${fn}`, new zip.BlobReader(blob));
            }
        }
        const blob = await zipWriter.close();
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `draft_question_export_${fileSuffix}_${DateFormat(new Date(), 'yyyy-MM-dd_HH-mm-ss')}.zip`;
        a.click();
        URL.revokeObjectURL(a.href);
        alerty.success('导出已开始', 'Export started');
    }

    function genDraftId() {
        return `d_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
    }

    async function saveImportedPayloadAsDraft(payload, attachments = []) {
        if (!payload || typeof payload !== 'object') return false;
        // payload 是 question_export 的 row
        const title = String(payload.title || '').trim() || '(未命名)';
        const did = genDraftId();
        const key = { course_key: nowCourseKey, draft_id: did };
        const now = Date.now();
        const value = {
            meta: { title, pkind: payload.pkind, updated_at: now },
            payload: payload,      // 为了旧代码兼容保留一份
            export_row: payload,   // 新草稿以 export_row 为准
            attachments: Array.isArray(attachments) ? attachments : [],
        };
        await idb.SetIdbTableByKey(TABLE, key, value);
        return true;
    }

    async function importFromJsonText(text) {
        const data = JSON.parse(text);
        // 允许两种格式：
        // - 单题：{title, pkind, ...}
        // - 列表：[{...}, {...}]
        const list = Array.isArray(data) ? data : [data];
        let ok = 0;
        for (const payload of list) {
            const r = await saveImportedPayloadAsDraft(payload, []);
            if (r) ok++;
        }
        return ok;
    }

    async function importFromZip(file) {
        const reader = new zip.ZipReader(new zip.BlobReader(file));
        const entries = await reader.getEntries();
        const qlistEntry = entries.find(e => e && e.filename === 'question_list.json');
        if (!qlistEntry) {
            await reader.close();
            throw new Error('question_list.json not found in zip');
        }
        const text = await qlistEntry.getData(new zip.TextWriter());
        // 解析 question_list.json
        const list = JSON.parse(text);
        const qrows = Array.isArray(list) ? list : [list];

        // 按目录聚合附件（与正式导出一致：目录名 = item.attach）
        const folderMap = {};
        entries.forEach((e) => {
            if (!e || !e.filename) return;
            if (e.filename === 'question_list.json') return;
            const parts = e.filename.split('/');
            if (parts.length < 2) return;
            const folder = parts[0];
            if (!folderMap[folder]) folderMap[folder] = [];
            folderMap[folder].push(e);
        });

        let ok = 0;
        for (const row of qrows) {
            const folder = row && row.attach ? String(row.attach) : '';
            const attEntries = folder && folderMap[folder] ? folderMap[folder] : [];
            const atts = [];
            for (const ent of attEntries) {
                const filename = ent.filename.split('/').slice(1).join('/');
                // 仅支持单层文件名，子目录按原样保留（zip add 时用同名路径即可）
                const blob = await ent.getData(new zip.BlobWriter(), {});
                atts.push({
                    file_name: filename,
                    type: blob.type || '',
                    size: blob.size || 0,
                    blob,
                    updated_at: Date.now(),
                });
            }
            const r = await saveImportedPayloadAsDraft(row, atts);
            if (r) ok++;
        }

        await reader.close();
        return ok;
    }

    async function render() {
        const drafts = await loadAllDrafts();
        if (!tbody) return;
        tbody.innerHTML = '';
        if (!drafts.length) {
            tbody.innerHTML = `<tr><td colspan="5" class="text-muted">暂无草稿<span class="en-text">No drafts</span></td></tr>`;
            return;
        }
        drafts.forEach((d) => {
            const draftId = d.key?.draft_id || '';
            const title = d.value?.meta?.title || d.value?.payload?.title || '(未命名)';
            const pk = d.value?.meta?.pkind ?? d.value?.payload?.pkind ?? '';
            const updated = d.value?.meta?.updated_at || 0;
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><input class="draft-select" type="checkbox" data-draft-id="${esc(draftId)}"></td>
                <td>
                    <div class="fw-semibold">${esc(title)}</div>
                    <div class="text-muted" style="font-size:12px;">${esc(draftId)}</div>
                </td>
                <td>${esc(pkindName(pk))}</td>
                <td>${esc(fmtTime(updated))}</td>
                <td>
                    <div class="btn-group btn-group-sm" role="group" aria-label="Draft actions">
                        <a class="btn btn-outline-primary"
                           href="/exadmin/question/question_draft_edit?draft_id=${encodeURIComponent(draftId)}"
                           title="编辑 / Edit">
                            <i class="bi bi-pencil-square"></i>
                        </a>
                        <button type="button"
                                class="btn btn-outline-success draft-export-one"
                                data-draft-id="${esc(draftId)}"
                                title="导出 / Export">
                            <i class="bi bi-file-earmark-zip"></i>
                        </button>
                        <button type="button"
                                class="btn btn-outline-danger draft-del-one"
                                data-draft-id="${esc(draftId)}"
                                title="删除 / Delete">
                            <i class="bi bi-trash"></i>
                        </button>
                    </div>
                </td>
            `;
            tbody.appendChild(tr);
        });

        tbody.querySelectorAll('button.draft-export-one').forEach((btn) => {
            btn.addEventListener('click', async () => {
                const id = btn.getAttribute('data-draft-id');
                const all = await loadAllDrafts();
                const hit = all.find(x => String(x.key?.draft_id) === String(id));
                if (!hit) {
                    alerty.error('草稿不存在或已被删除', 'Draft not found');
                    return;
                }
                await exportDraftsZip([hit], 'single');
            });
        });

        tbody.querySelectorAll('button.draft-del-one').forEach((btn) => {
            btn.addEventListener('click', async () => {
                const id = btn.getAttribute('data-draft-id');
                const key = { course_key: nowCourseKey, draft_id: id };
                await idb.DelIdbTableByKey(TABLE, key);
                alerty.success('已删除草稿', 'Draft deleted');
                await render();
            });
        });
    }

    selectAll?.addEventListener('change', () => {
        const checked = !!selectAll.checked;
        document.querySelectorAll('input.draft-select[type="checkbox"]').forEach((cb) => { cb.checked = checked; });
    });

    exportBtn?.addEventListener('click', async () => {
        const ids = getSelectedDraftIds();
        const all = await loadAllDrafts();
        const selected = all.filter(x => ids.includes(String(x.key?.draft_id)));
        await exportDraftsZip(selected, `selected_${selected.length}`);
    });

    importBtn?.addEventListener('click', async () => {
        importFile.click();
    });

    importFile?.addEventListener('change', async (e) => {
        const file = e.target.files?.[0];
        importFile.value = '';
        if (!file) return;
        try {
            let ok = 0;
            const name = String(file.name || '').toLowerCase();
            if (name.endsWith('.zip')) {
                ok = await importFromZip(file);
            } else if (name.endsWith('.json')) {
                const text = await file.text();
                ok = await importFromJsonText(text);
            } else {
                // 兜底：优先按 zip 解析，失败再按 json
                try {
                    ok = await importFromZip(file);
                } catch (e1) {
                    const text = await file.text();
                    ok = await importFromJsonText(text);
                }
            }
            await render();
            alerty.success(`导入成功：${ok} 个草稿`, `Imported: ${ok} draft(s)`);
        } catch (err) {
            console.error(err);
            alerty.error('导入失败：请确认文件格式（zip 内需包含 question_list.json）', 'Import failed: invalid file');
        }
    });

    refreshBtn?.addEventListener('click', async () => {
        await render();
        alerty.success('已刷新', 'Refreshed');
    });

    // init
    render().catch((e) => {
        console.error(e);
        alerty.error('草稿列表加载失败', 'Failed to load drafts');
    });
})();


