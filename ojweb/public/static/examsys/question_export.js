// Question Export (exadmin/question/question_export)
// 依赖：jQuery、alerty、zip.js、question_default、DateFormat、ItemShining
(function(){
    'use strict';

    if (window.ExadminQuestionExport && window.ExadminQuestionExport._initialized) {
        return;
    }
    window.ExadminQuestionExport = window.ExadminQuestionExport || {};
    window.ExadminQuestionExport._initialized = true;

    const $qids = $('#qids_input');
    const $cid = $('#cid_input');
    const $submit = $('#submit_button');
    const $clear = $('#clear_button');
    const $bar = $('#process_ratio_bar');
    const $barWrap = $('#process_ratio_bar_div');
    const $tip = $('#progress_tip_span');
    const $dl = $('#question_export_download_div');

    let question_export_json = [];
    let file_suffix = '';
    let export_blob = null;
    let export_filename = '';

    function pratio(r = 0, content = '') {
        $tip.text(content);
        const ratio = Math.max(0, Math.min(100, parseInt(r * 100)));
        $bar.attr('aria-valuenow', ratio);
        $bar.text(ratio + '%');
        $bar.css('width', ratio + '%');
    }

    function uiStart() {
        pratio(0, '');
        $barWrap.show();
        $dl.hide().empty();
        export_blob = null;
        export_filename = '';
        $('.export_form_item').prop('disabled', true);
    }

    function uiEnd() {
        pratio(0, '');
        $barWrap.hide();
        $('.export_form_item').prop('disabled', false);
    }

    function showError(cn, en) {
        alerty.error(cn, en || cn);
    }
    function showWarn(cn, en) {
        alerty.warn(cn, en || cn);
    }
    function showSuccess(cn, en) {
        alerty.success(cn, en || cn);
    }

    function downloadReady(blob) {
        if (!(blob instanceof Blob)) {
            console.error('export blob invalid', blob);
            showError('导出失败：未生成有效文件', 'Export failed: invalid blob');
            return;
        }
        export_blob = blob;
        export_filename = `question_exported_${file_suffix}_${DateFormat(new Date(), 'yyyy-MM-dd_HH-mm-ss')}.zip`;
        $dl.html(`
            <button type="button" class="btn btn-success btn-sm" id="download_zip_btn" title="${export_filename}">
                <span class="cn-text"><i class="bi bi-file-earmark-zip"></i> 下载</span>
                <span class="en-text">Download</span>
            </button>
        `).show();
        ItemShining($dl);
        $('#download_zip_btn').off('click').on('click', function() {
            if (!(export_blob instanceof Blob)) {
                showError('没有可下载的文件', 'No file to download');
                return;
            }
            const url = URL.createObjectURL(export_blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = export_filename || 'question_export.zip';
            document.body.appendChild(a);
            a.click();
            a.remove();
            setTimeout(() => {
                try { URL.revokeObjectURL(url); } catch (e) {}
            }, 1000);
        });
        showSuccess('导出完成，可下载 zip', 'Export ready');
    }

    async function getQuestionAttach(ith, zipWriter) {
        if (ith >= question_export_json.length) {
            await zipWriter.add('question_list.json', new zip.TextReader(JSON.stringify(question_export_json, null, 4)));
            const blob = await zipWriter.close(); // 关键：await 直接拿 blob，避免 then 链丢值/异步竞态
            downloadReady(blob);
            uiEnd();
            return;
        }
        const ex_question_id = question_export_json[ith].ex_question_id;
        const attach_folder = String(question_export_json[ith].attach || '').trim();
        const pratio_val = (ith + 1) / question_export_json.length;
        const pratio_info = `Fetching ${question_export_json[ith].ex_question_id}:${question_default.pkind_table[question_export_json[ith].pkind]} | ${question_export_json[ith].title}`;
        pratio(pratio_val, pratio_info);

        if (!attach_folder) {
            return getQuestionAttach(ith + 1, zipWriter);
        }

        // 新接口：递归白名单子目录（根 + answer_image）
        csg.get('/exadmin/question/question_attach_list_ajax', { ex_question_id })
            .then(async (resp) => {
                if (!resp || resp.code != 1) {
                    throw new Error(resp?.msg || 'attach list failed');
                }
                const files = Array.isArray(resp.data) ? resp.data : [];
                // 顺序写入，显式检测重复路径
                const written = new Set();
                // 路径前缀使用题目自身的 attach 目录；若为空则用 exq_{id}，保证唯一性
                const prefix = attach_folder ? attach_folder : `exq_${ex_question_id}`;
                for (const item of files) {
                    const rel = `${prefix}/${item.rel_path || item.file_name}`;
                    if (written.has(rel)) {
                        console.error('[question_export] duplicate rel path detected', { ex_question_id, rel, item });
                        throw new Error(`Duplicate entry in ZIP: ${rel}`);
                    }
                    written.add(rel);
                    const r = await csg.get(item.file_url, {}, {}, 'blob', null);
                    if (!r || !r.ok) throw new Error(`HTTP ${r ? r.status : 'no resp'} for ${rel}`);
                    const blob = await r.blob();
                    await zipWriter.add(rel, new zip.BlobReader(blob));
                }
                await getQuestionAttach(ith + 1, zipWriter);
            })
            .catch((e) => {
                const msg = e && e.message ? e.message : 'attach failed';
                showWarn(`题目 ${ex_question_id} 附件获取失败：${msg}`, `Failed to fetch attachments for ${ex_question_id}: ${msg}`);
                getQuestionAttach(ith + 1, zipWriter);
            });
    }

    async function zipExportQuestion() {
        const zipWriter = new zip.ZipWriter(new zip.BlobWriter('application/zip'));
        await getQuestionAttach(0, zipWriter);
    }

    async function doExport(qid_param) {
        uiStart();
        question_export_json = [];
        const problem_id_list = [];
        const problem2question = {};

        $.get('/exadmin/question/question_list_get', qid_param, function(ret) {
            if (ret.code != 1) {
                showError(ret.msg || '导出失败', ret.msg || 'Export failed');
                uiEnd();
                return;
            }

            const rows = (ret.data && ret.data.rows) ? ret.data.rows : (Array.isArray(ret.data) ? ret.data : []);
            const meta = (ret.data && ret.data.meta) ? ret.data.meta : null;

            if (meta) {
                const inCnt = (meta.in_course_ids || []).length;
                const outCnt = (meta.out_of_course_ids || []).length;
                const missCnt = (meta.missing_ids || []).length;
                if (inCnt === 0) {
                    showError(
                        `所选考题均不属于当前课程，无法导出（非本课：${outCnt}，不存在：${missCnt}）`,
                        `All selected questions are not in current course (out-of-course: ${outCnt}, missing: ${missCnt}).`
                    );
                    uiEnd();
                    return;
                }
                if (outCnt > 0) {
                    showWarn(`已自动跳过非本课程考题：${outCnt} 题`, `Skipped out-of-course questions: ${outCnt}`);
                }
                if (missCnt > 0) {
                    showWarn(`有 ${missCnt} 个题号不存在，已忽略`, `Missing question IDs ignored: ${missCnt}`);
                }
            }

            question_export_json = rows;
            for (let i in question_export_json) {
                if (parseInt(question_export_json[i].pkind) === 25) {
                    const pid_tmp = parseInt(question_export_json[i].description);
                    if (!Number.isNaN(pid_tmp)) {
                        problem_id_list.push(pid_tmp);
                        problem2question[pid_tmp] = i;
                    }
                }
            }

            $.get('/exadmin/question/problem_attach_list_get', { pids: problem_id_list }, function(data) {
                (data || []).forEach((row) => {
                    const idx = problem2question[row.problem_id];
                    if (idx !== undefined && question_export_json[idx]) {
                        question_export_json[idx]['problem_hash'] = row.attach;
                    }
                });

                if (qid_param.query_type === 'range') {
                    file_suffix = qid_param.qids[0] + '-' + qid_param.qids[1];
                } else {
                    file_suffix = (qid_param.qids || []).join('.');
                }
                if (file_suffix.length > 20) {
                    file_suffix = file_suffix.substr(0, 16) + '...';
                }
                file_suffix = '[' + file_suffix + ']';
                zipExportQuestion();
            });
        });
    }

    function exportByQid() {
        const qid_str = ($qids.val() || '').trim();
        if (!qid_str) return false;

        if (qid_str.includes('-')) {
            let qid_range = qid_str.split('-');
            if (qid_range.length < 2) {
                showError('区间需要两个数字', 'Range requires two numbers');
                return true;
            }
            qid_range = qid_range.slice(0, 2).map(x => parseInt(x, 10));
            if (qid_range.some(x => Number.isNaN(x))) {
                showError('题号必须是数字', 'Question ID must be number');
                return true;
            }
            if (qid_range[1] - qid_range[0] > 255) {
                showError('一次最多导出 256 题', 'At most 256 questions once');
                return true;
            }
            doExport({ qids: qid_range, query_type: 'range' });
            return true;
        }

        const qid_list = qid_str.split(',').map(x => parseInt(x, 10)).filter(x => !Number.isNaN(x));
        if (qid_list.length === 0) {
            showError('未找到有效题号', 'No valid question IDs');
            return true;
        }
        doExport({ qids: qid_list, query_type: 'list' });
        return true;
    }

    function exportByCid() {
        const cid = parseInt(($cid.val() || '').trim(), 10);
        if (Number.isNaN(cid)) {
            showError('请输入有效考试ID', 'Please input a valid exam ID');
            return;
        }
        $.get('/exadmin/exam/contest_problem_ajax', { contest_id: cid }, function(ret){
            if (ret.code != 1) {
                showError(ret.msg || '获取考试题单失败', ret.msg || 'Failed to get exam question list');
                return;
            }
            const rows = (ret.data && ret.data.rows) ? ret.data.rows : (Array.isArray(ret.data) ? ret.data : []);
            const meta = (ret.data && ret.data.meta) ? ret.data.meta : null;

            const qid_list = [];
            rows.forEach((r) => {
                if (r && r.problem_id !== undefined) qid_list.push(r.problem_id);
            });

            if (meta) {
                const outCnt = (meta.out_of_course_question_ids || []).length;
                const allCnt = (meta.all_question_ids || []).length;
                if (qid_list.length === 0) {
                    showError(
                        `该考试题单中没有本课程考题可导出（非本课：${outCnt}/${allCnt}）`,
                        `No in-course questions to export (out-of-course: ${outCnt}/${allCnt}).`
                    );
                    return;
                }
                if (outCnt > 0) {
                    showWarn(`已自动跳过非本课程考题：${outCnt} 题`, `Skipped out-of-course questions: ${outCnt}`);
                }
            }

            doExport({ qids: qid_list, query_type: 'list' });
        });
    }

    $submit.on('click', function() {
        if (exportByQid()) return;
        exportByCid();
    });

    $clear.on('click', function() {
        $qids.val('');
        $cid.val('');
    });

    $('#question_export_div').on('keypress', function(e) {
        if (e.which === 13) $submit.click();
    });

})();


