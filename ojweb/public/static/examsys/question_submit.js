// asheet 应在 problemset 页面已定义并获取
// alerty 已全局引入，无需设置
// ---------- 考试答题临时图片：IndexedDB 缓存（C2：刷新后可恢复预览，并支持自动重传） ----------
const EXAM_TMP_IMG_EXPIRE_MS = 24 * 60 * 60 * 1000; // 24h

function examTmpImgKey(cid, contest_user, qid, subq, req) {
    return `exam_tmp_img#${String(cid)}#${String(contest_user)}#${String(qid)}#${String(subq)}#${String(req)}`;
}

async function saveExamTmpImgBlobToIdb(cid, contest_user, qid, subq, req, blob) {
    try {
        if (!blob) return;
        
        await window.idb.SetIdb(examTmpImgKey(cid, contest_user, qid, subq, req), blob, EXAM_TMP_IMG_EXPIRE_MS);
        
    } catch (e) {
        // 缓存失败不应阻断用户上传
        console.warn('saveExamTmpImgBlobToIdb failed', e);
    }
}

async function loadExamTmpImgBlobFromIdb(cid, contest_user, qid, subq, req) {
    try {
        
        return await window.idb.GetIdb(examTmpImgKey(cid, contest_user, qid, subq, req));
    } catch (e) {
        return null;
    }
}

async function deleteExamTmpImgBlobFromIdb(cid, contest_user, qid, subq, req) {
    try {
        await window.idb.DelIdb(examTmpImgKey(cid, contest_user, qid, subq, req));
    } catch (e) {}
}

function ensureAsheetTmpEntry(ex_question_id) {
    if (typeof asheet_tmp === 'undefined' || !asheet_tmp) return null;
    const qid = String(ex_question_id);
    if (!asheet_tmp[qid]) asheet_tmp[qid] = {};
    return asheet_tmp[qid];
}

function upsertPendingTmpImage(ex_question_id, subq, req, tmp_uuid, file_name) {
    const entry = ensureAsheetTmpEntry(ex_question_id);
    if (!entry) return;
    entry.pending_tmp_uuid = tmp_uuid || entry.pending_tmp_uuid || '';
    if (!Array.isArray(entry.pending_tmp_images)) entry.pending_tmp_images = [];
    const s = parseInt(subq, 10), r = parseInt(req, 10);
    const fn = String(file_name || '').trim();
    if (!Number.isFinite(s) || !Number.isFinite(r) || s < 0 || r < 0 || !fn) return;
    // 去重：同一 subq/req 只保留最新 file_name
    const idx = entry.pending_tmp_images.findIndex(it => parseInt(it?.sub_idx, 10) === s && parseInt(it?.req_idx, 10) === r);
    const obj = { sub_idx: s, req_idx: r, file_name: fn };
    if (idx >= 0) entry.pending_tmp_images[idx] = obj;
    else entry.pending_tmp_images.push(obj);
    
}

function clearPendingTmpImages(ex_question_id) {
    const entry = ensureAsheetTmpEntry(ex_question_id);
    if (!entry) return;
    delete entry.pending_tmp_uuid;
    delete entry.pending_tmp_images;
}

async function restoreExamTmpImagesFromCache() {
    try {
        if (typeof asheet_tmp === 'undefined' || !asheet_tmp) return;
        if (typeof cid === 'undefined' || typeof contest_user === 'undefined') return;

        
        for (const qidStr of Object.keys(asheet_tmp)) {
            const qid = parseInt(qidStr, 10);
            if (!Number.isFinite(qid) || qid <= 0) continue;
            const entry = asheet_tmp[qidStr] || {};
            const tmp_uuid = String(entry.pending_tmp_uuid || '').trim();
            const list = Array.isArray(entry.pending_tmp_images) ? entry.pending_tmp_images : [];

            
            if (tmp_uuid) {
                examImageTmpUuid[qid] = tmp_uuid;
            }
            if (!list.length) continue;

            for (const it of list) {
                const subq = parseInt(it?.sub_idx, 10);
                const req = parseInt(it?.req_idx, 10);
                const fileName = String(it?.file_name || '').trim();
                if (!Number.isFinite(subq) || !Number.isFinite(req) || subq < 0 || req < 0 || !fileName) continue;

                // 恢复隐藏域（用于后续保存搬运）
                const tmpHidden = document.querySelector(`input.submission_image_tmp_${qid}[data-subq="${subq}"][data-req="${req}"]`);
                if (tmpHidden) {
                    tmpHidden.value = fileName;
                    
                } else {
                    // debug log removed
                }

                // 恢复预览：从 idb 读取 blob -> objectURL
                const img = document.getElementById(`exam_img_preview_${qid}_${subq}_${req}`);
                if (!img) {
                    // debug log removed
                }
                // 只要存在 pending tmp，就应该优先展示“未保存的新图”
                // 即使当前 img 已被 asheet/asheet_tmp 的“已保存 URL”回填，也要覆盖为 pending blob 预览
                if (img) {
                    const blob = await loadExamTmpImgBlobFromIdb(cid, contest_user, qid, subq, req);
                    
                    if (blob instanceof Blob) {
                        const oldBlobUrl = img.getAttribute('data-blob-url');
                        if (oldBlobUrl) {
                            try { URL.revokeObjectURL(oldBlobUrl); } catch (e) {}
                        }
                        const blobUrl = URL.createObjectURL(blob);
                        img.src = blobUrl;
                        img.classList.remove('d-none');
                        img.setAttribute('data-blob-url', blobUrl);
                        
                    } else {
                        // debug log removed
                    }
                }
            }
        }
        
    } catch (e) {
        console.warn('restoreExamTmpImagesFromCache failed', e);
    }
}

// 暴露给题目列表页：渲染完成后触发一次恢复
window.CsgExamTmpImage = window.CsgExamTmpImage || {};
window.CsgExamTmpImage.restoreFromCache = function() {
    // fire and forget
    restoreExamTmpImagesFromCache();
};

window.CsgExamTmpImage.clearQuestion = function(ex_question_id) {
    try {
        if (typeof cid === 'undefined' || typeof contest_user === 'undefined') return;
        const qid = parseInt(ex_question_id, 10);
        if (!Number.isFinite(qid) || qid <= 0) return;
        const entry = ensureAsheetTmpEntry(qid);
        const list = Array.isArray(entry?.pending_tmp_images) ? entry.pending_tmp_images : [];
        clearPendingTmpImages(qid);
        // 删除对应 blob（不 await）
        list.forEach((it) => {
            const subq = parseInt(it?.sub_idx, 10);
            const req = parseInt(it?.req_idx, 10);
            if (!Number.isFinite(subq) || !Number.isFinite(req)) return;
            deleteExamTmpImgBlobFromIdb(cid, contest_user, qid, subq, req);
        });
    } catch (e) {}
};

// 关键：确保“题目 DOM 渲染完成后”一定会触发恢复
// - ex_question_list.js 负责 dispatch 'csg:exam_questions_rendered'
// - 这里监听并执行恢复，避免脚本加载时序导致错过一次恢复
document.addEventListener('csg:exam_questions_rendered', function() {
    try {
        
        restoreExamTmpImagesFromCache();
    } catch (e) {}
});

// 兜底：页面加载后也尝试恢复一次（避免事件未触发/旧页面未升级）
document.addEventListener('DOMContentLoaded', function() {
    setTimeout(() => {
        
        try { restoreExamTmpImagesFromCache(); } catch (e) {}
    }, 0);
    setTimeout(() => {
        
        try { restoreExamTmpImagesFromCache(); } catch (e) {}
    }, 500);
});

async function autoReuploadTmpImages(cid, ex_question_id) {
    const qid = parseInt(ex_question_id, 10);
    if (!Number.isFinite(qid) || qid <= 0) return { ok: false, msg: '题目ID无效' };
    const entry = ensureAsheetTmpEntry(qid) || {};
    const list = Array.isArray(entry.pending_tmp_images) ? entry.pending_tmp_images : [];
    const tmp_uuid_old = String(entry.pending_tmp_uuid || examImageTmpUuid[qid] || '').trim();
    if (!list.length) return { ok: false, msg: '未找到需要重传的图片信息' };

    // 先检查本地 blob 是否齐全
    const missing = [];
    const blobs = [];
    for (const it of list) {
        const subq = parseInt(it?.sub_idx, 10);
        const req = parseInt(it?.req_idx, 10);
        if (!Number.isFinite(subq) || !Number.isFinite(req)) continue;
        const blob = await loadExamTmpImgBlobFromIdb(cid, contest_user, qid, subq, req);
        if (!(blob instanceof Blob)) {
            missing.push({ subq, req });
        } else {
            blobs.push({ subq, req, blob });
        }
    }
    if (missing.length) {
        return { ok: false, msg: '图片已失效，且本地缓存不存在对应图片，请重新选择文件上传。', missing };
    }

    let latestTmpUuid = tmp_uuid_old;
    for (const item of blobs) {
        const fd = new FormData();
        fd.append('ex_question_id', String(qid));
        fd.append('sub_idx', String(item.subq));
        fd.append('req_idx', String(item.req));
        if (latestTmpUuid) fd.append('tmp_uuid', latestTmpUuid);
        fd.append('upload_file', item.blob, `${qid}_${contest_user}_${Date.now()}_${item.subq}_${item.req}.webp`);
        const ret = await csg.post({ url: `exam_image_upload_ajax?cid=${cid}`, data: fd, dtype: 'json' });
        if (!ret || ret.code !== 1) {
            return { ok: false, msg: ret?.msg || '自动重传失败' };
        }
        if (ret.data?.tmp_uuid) latestTmpUuid = ret.data.tmp_uuid;
        const tmpFileName = String(ret.data?.file_name || '').trim();
        if (!tmpFileName) {
            return { ok: false, msg: '自动重传失败（缺少 file_name）' };
        }
        // 更新隐藏域与缓存映射
        const tmpHidden = document.querySelector(`input.submission_image_tmp_${qid}[data-subq="${item.subq}"][data-req="${item.req}"]`);
        if (tmpHidden) tmpHidden.value = tmpFileName;
        examImageTmpUuid[qid] = latestTmpUuid;
        upsertPendingTmpImage(qid, item.subq, item.req, latestTmpUuid, tmpFileName);
    }

    // 写回 asheet_tmp（不 await）
    try {
        if (typeof SetAsheetTmp === 'function') SetAsheetTmp(asheet_tmp, cid, contest_user);
    } catch (e) {}
    return { ok: true, tmp_uuid: latestTmpUuid };
}

function ProcessRet(ret, ex_question_id, submission) {
    // 题目提交成功后处理
    if (ret['code'] == 1) {
        alerty.success(ret['msg']);
        asheet[ex_question_id] = ret['data'];
        try{
            asheet[ex_question_id]['submission'] = $.parseJSON(asheet[ex_question_id]['submission']);
            // 后端可能返回 update_at；若未返回则用前端时间兜底（用于与 asheet_tmp 比较）
            asheet[ex_question_id]['update_at'] = (ret?.data?.update_at && String(ret.data.update_at).trim() !== '')
                ? ret.data.update_at
                : get_contest_now();
        } catch(e) {
            console.error('get new asheet submission error: ', ex_question_id, e);
        }
        // 更新图片预览：从临时 blob URL 切换到最终 URL
        const question = question_map[ex_question_id];
        if (question && (question.pkind == 15 || question.pkind == 20)) {
            const submission = asheet[ex_question_id]['submission'];
            if (submission && submission.images) {
                // 简答题
                if (question.pkind == 15 && Array.isArray(submission.images[0])) {
                    submission.images[0].forEach((url, ridx) => {
                        if (url) {
                            const img = document.getElementById(`exam_img_preview_${ex_question_id}_0_${ridx}`);
                            if (img) {
                                // 清理 blob URL
                                const blobUrl = img.getAttribute('data-blob-url');
                                if (blobUrl) {
                                    URL.revokeObjectURL(blobUrl);
                                    img.removeAttribute('data-blob-url');
                                }
                                // 更新为最终 URL
                                img.src = url;
                                // 同步隐藏域（用于后续 GetSubmissionFromDom / asheet_tmp 缓存）
                                const savedHidden = $(`input.submission_image_${ex_question_id}[data-subq="0"][data-req="${ridx}"]`);
                                if (savedHidden.length > 0) {
                                    savedHidden.val(url);
                                }
                                // 清除临时图片标记
                                const tmpHidden = $(`input.submission_image_tmp_${ex_question_id}[data-subq="0"][data-req="${ridx}"]`);
                                if (tmpHidden.length > 0) {
                                    tmpHidden.val('');
                                }
                            }
                        }
                    });
                }
                // 综合题
                if (question.pkind == 20 && Array.isArray(submission.images)) {
                    submission.images.forEach((imgRow, subIdx) => {
                        if (Array.isArray(imgRow)) {
                            imgRow.forEach((url, ridx) => {
                                if (url) {
                                    const img = document.getElementById(`exam_img_preview_${ex_question_id}_${subIdx}_${ridx}`);
                                    if (img) {
                                        // 清理 blob URL
                                        const blobUrl = img.getAttribute('data-blob-url');
                                        if (blobUrl) {
                                            URL.revokeObjectURL(blobUrl);
                                            img.removeAttribute('data-blob-url');
                                        }
                                        // 更新为最终 URL
                                        img.src = url;
                                        // 同步隐藏域（用于后续 GetSubmissionFromDom / asheet_tmp 缓存）
                                        const savedHidden = $(`input.submission_image_${ex_question_id}[data-subq="${subIdx}"][data-req="${ridx}"]`);
                                        if (savedHidden.length > 0) {
                                            savedHidden.val(url);
                                        }
                                        // 清除临时图片标记
                                        const tmpHidden = $(`input.submission_image_tmp_${ex_question_id}[data-subq="${subIdx}"][data-req="${ridx}"]`);
                                        if (tmpHidden.length > 0) {
                                            tmpHidden.val('');
                                        }
                                    }
                                }
                            });
                        }
                    });
                }
            }
        }

        // 同步前端缓存（asheet_tmp / localStorage）：保存返回值，否则“上传图片导致后端改写 submission”会出现前端仍用旧缓存的问题
        try {
            if (typeof asheet_tmp !== 'undefined' && asheet_tmp) {
                asheet_tmp[ex_question_id] = {
                    ex_question_id: ex_question_id,
                    submission: asheet?.[ex_question_id]?.submission ?? null,
                    update_at: asheet?.[ex_question_id]?.update_at ?? get_contest_now()
                };
                if (typeof SetAsheetTmp === 'function' && typeof cid !== 'undefined' && typeof contest_user !== 'undefined') {
                    SetAsheetTmp(asheet_tmp, cid, contest_user);
                }
            }
        } catch(e) {
            console.error('sync asheet_tmp failed: ', ex_question_id, e);
        }

        // 保存成功：清理本题未保存图片缓存（tmp_uuid / tmp_images / blob）
        try {
            window.CsgExamTmpImage?.clearQuestion?.(ex_question_id);
        } catch (e) {}
        
        let table_row = question_map[ex_question_id];
        if (table_row) {
            table_row['answered'] = true;
            table_row['modified'] = false;
            QuestionRender.dis.Render(question_map?.[ex_question_id]);
            UpdateQuestionAnswerStatus(table_row);
        }
        
        // 如果是编程题且返回了 solution_id，启动状态轮询
        if (ret['data'] && ret['data']['solution_id'] && question_map[ex_question_id] && question_map[ex_question_id].pkind == 25) {
            startStatusPolling(ex_question_id, ret['data']['solution_id']);
        }
        
        // 触发自定义事件，通知新界面更新状态
        $(document).trigger('answerSubmitted', [ex_question_id]);
    }
    else {
        alerty.error(`Question ${question_map[ex_question_id]?.num || ex_question_id}:<br/>${ret['msg']}`);
        if (question_map[ex_question_id]) {
            QuestionRender.dis.Render(question_map[ex_question_id]);
        }
    }
    return false;
}

function UpdateQuestionAnswerStatus(row) {
    // 更新题目的答题状态
    $(`#question_answer_status_${row.ex_question_id}`).html(GetAnswerStatusHtml(row));
    // exam_problemset_table.bootstrapTable('updateCellByUniqueId', {
    //     id: row.num,
    //     field: 'status',
    //     // value: score,
    //     reinit: false
    // });
}
function GetSubmissionFromDom(ex_question_id) {
    // 基于ex_question_id获取该题当前所填内容，仅在表格row展开时可用
    let pkind = parseInt(question_map[ex_question_id].pkind);
    let ret = {
        err: '',
        submission: null
    };
    if(pkind == 0) {
        // **************************************************
        // SingleChoice
        ret.submission = [-1];
        let radios = document.getElementsByName(`submission_${ex_question_id}`);
        for(let i = 0; i < radios.length; i ++) {
            if(radios[i].checked) {
                ret.submission[0] = parseInt(radios[i].value);
            }
        }
        if(ret.submission[0] < 0 || ret.submission[0] > 25) {
            ret.err = "choice not right with ret.submission=" + ret.submission[0];
            console.error(ret.err);
        } else {
            ret.submission[0] = String.fromCharCode(ret.submission[0] + 65);
        }
        
    } else if(pkind == 1) {
        // **************************************************
        // MultiChoice
        ret.submission = [];
        let choicenum = 0;
        // jquery 使用时遇到了on change 滞后问题，但是不能稳定复现，尝试改用es6
        let checkboxes = document.getElementsByName(`submission_${ex_question_id}`);
        for(let i = 0; i < checkboxes.length; i ++) {
            if(checkboxes[i].checked) {
                ret.submission.push(parseInt(checkboxes[i].value));
            }
            choicenum ++;
        }
        if(ret.submission.length > choicenum) {
            ret.err = "checked num not right.";
            console.error(ret.err);
        } else {
            for(let i in ret.submission) {
                if(ret.submission[i] < 0 || ret.submission[i] > 25) {
                    ret.err = "choice not right with " + i + "-th ret.submission=" + ret.submission[i];
                    console.error(ret.err);
                } else {
                    ret.submission[i] = String.fromCharCode(ret.submission[i] + 65);
                }
            }
        }
    } else if(pkind == 5) {
        // **************************************************
        // TrueFalse
        
        ret.submission = [-1];
        let radios = document.getElementsByName(`submission_${ex_question_id}`);
        for(let i = 0; i < radios.length; i ++) {
            if(radios[i].checked) {
                ret.submission[0] = radios[i].value;
            }
        }
        if(ret.submission[0] != 'T' && ret.submission[0] != 'F') {
            ret.err = "choice not right with ret.submission=" + ret.submission[0];
            console.error(ret.err);
        }
    } else if(pkind == 10) {
        // **************************************************
        // Fill
        ret.submission = [];
        let tmpans = [];
        $('input[name="submission_' + ex_question_id + '"]').each(function() {
            tmpans.push({
                'sub_qnum': parseInt($(this).attr('sub_qnum')),
                'submission': $(this).val().trim()
            });
            ret.submission.push("");
        });
        for(let i = 0; i < tmpans.length; i ++) {
            ret.submission[tmpans[i].sub_qnum] = tmpans[i].submission;
            if(tmpans[i].submission.length > 512) {
                ret.err += `第${(i+1)}小题内容太长 / ${i+1}-th answer is too long`;
            } else if(tmpans[i].submission.length == 0) {
                ret.err = `第${(i+1)}小题不能为空 / ${i+1}-th answer is empty.`;
            }
        }
    } else if(pkind == 15) {
        // **************************************************
        // ShortAnswer
        const text0 = $('#ex_question_' + ex_question_id).val().trim();
        // 读取图片要求数量
        let reqCnt = 0;
        try {
            let c = question_map[ex_question_id].content;
            if (typeof c === 'string') c = JSON.parse(c);
            if (Array.isArray(c) && c[0] && Array.isArray(c[0].image_reqs)) reqCnt = c[0].image_reqs.length;
        } catch(e) { reqCnt = 0; }
        // 必须显式填充 ''，避免稀疏数组/undefined 序列化后丢失索引，导致后端收到的 images 结构不完整
        const images0 = Array(reqCnt).fill('');
        const tmpImages0 = Array(reqCnt).fill(null);  // 临时图片信息
        $(`input.submission_image_${ex_question_id}[data-subq="0"]`).each(function() {
            const ridx = parseInt($(this).attr('data-req'));
            if (ridx >= 0 && ridx < reqCnt) images0[ridx] = $(this).val();
        });
        $(`input.submission_image_tmp_${ex_question_id}[data-subq="0"]`).each(function() {
            const ridx = parseInt($(this).attr('data-req'));
            const tmpFileName = $(this).val().trim();
            if (tmpFileName) {
                if (ridx >= 0 && ridx < reqCnt) tmpImages0[ridx] = {
                    sub_idx: 0,
                    req_idx: ridx,
                    file_name: tmpFileName
                };
            }
        });
        // “答卷不能全为空”：允许纯图片答案（包括临时待保存图片）
        const hasAnySavedImg = images0.some(u => String(u || '').trim() !== '');
        const hasAnyTmpImg = tmpImages0.some(t => t && t.file_name);
        const hasAnyAnswer = String(text0 || '').trim() !== '' || hasAnySavedImg || hasAnyTmpImg;
        if (!hasAnyAnswer) {
            ret.err = '答卷不能全为空 / answer should not empty';
        }

        ret.submission = { text: [text0], images: [images0] };
        // 添加临时图片信息（用于后端移动文件）
        if (tmpImages0.some(t => t) || examImageTmpUuid[ex_question_id]) {
            ret.tmp_images = tmpImages0.filter(t => t);  // 过滤空值
            ret.tmp_uuid = examImageTmpUuid[ex_question_id] || '';
        }
        if(ret.submission.text[0].length > 16384) {
            ret.err = '内容太长 / answer too long';
        }
    } else if(pkind == 20) {
        // **************************************************
        // Comprehensive
        // 关键：综合题必须构造“0..maxSub”的密集数组。
        // 如果 sub_qnum 不连续（或 DOM 顺序异常），稀疏数组在 jQuery 序列化/后端解析时可能丢索引，导致后端 images[i] 为空 -> Not valid image submission.
        const imgArr = [];
        let tmpans = [];
        let maxSub = -1;
        $('.submission_' + ex_question_id).each(function() {
            const subq = parseInt($(this).attr('sub_qnum'));
            if (!isNaN(subq)) maxSub = Math.max(maxSub, subq);
            tmpans.push({
                'sub_qnum': subq,
                'submission': $(this).val()
            });
        });
        const subCnt = Math.max(0, maxSub + 1);
        const textArr = Array(subCnt).fill('');
        let flg_all_empty = true;
        for(let i in tmpans) {
            tmpans[i].submission = tmpans[i].submission.trim();
            const subq = parseInt(tmpans[i].sub_qnum);
            if (!isNaN(subq) && subq >= 0 && subq < textArr.length) {
                textArr[subq] = tmpans[i].submission;
            }
            if(tmpans[i].submission.length > 16384) {
                ret.err = '内容太长 / answer too long';
            } 
            // else if(tmpans[i].submission.length == 0) {
            //     ret.err = '每小题内容都不能为空 / answer is empty';
            // }
            if(tmpans[i].submission.length > 0) {
                flg_all_empty = false;
            }
        }
        if(flg_all_empty) {
            // 暂不直接报错：若存在图片（已保存或临时）也应允许保存
        }
        // 图片要求校验
        // 注意：此处不要依赖 question_map[...].content 的 JSON 解析结果（综合题在某些题目数据结构下可能解析失败）。
        // 以 DOM 中实际渲染出来的 submission_image_* 输入框为准，保证提交结构与后端期望一致。
        const tmpImagesAll = [];  // 所有临时图片信息
        let hasAnyImg = false;
        for (let s = 0; s < subCnt; s++) {
            const $savedNodes = $(`input.submission_image_${ex_question_id}[data-subq="${s}"]`);
            const $tmpNodes = $(`input.submission_image_tmp_${ex_question_id}[data-subq="${s}"]`);
            // 每个 req 都会渲染一个 hidden input，因此 length 就是 reqCnt
            const reqCnt = $savedNodes.length;
            const imgs = Array(reqCnt).fill('');
            const tmpImgs = Array(reqCnt).fill(null);

            $savedNodes.each(function() {
                const ridx = parseInt($(this).attr('data-req'));
                if (ridx >= 0 && ridx < reqCnt) imgs[ridx] = $(this).val();
            });
            $tmpNodes.each(function() {
                const ridx = parseInt($(this).attr('data-req'));
                const tmpFileName = $(this).val().trim();
                if (tmpFileName) {
                    if (ridx >= 0 && ridx < reqCnt) {
                        tmpImgs[ridx] = {
                            sub_idx: s,
                            req_idx: ridx,
                            file_name: tmpFileName
                        };
                        tmpImagesAll.push(tmpImgs[ridx]);
                    }
                }
            });
            if (!hasAnyImg) {
                if (imgs.some(u => String(u || '').trim() !== '') || tmpImgs.some(t => t && t.file_name)) {
                    hasAnyImg = true;
                }
            }
            for (let r = 0; r < reqCnt; r++) {
                // 不强制要求“图片要求必须全部上传”：
                // - 允许只答文字不传图
                // - 允许只传图不答文字
                // - 允许只上传部分图片（未上传的保持空字符串）
            }
            imgArr[s] = imgs;
        }
        if(flg_all_empty && !hasAnyImg) {
            ret.err = '答卷不能全为空 / answer should not empty';
        }
        ret.submission = { text: textArr, images: imgArr };
        // 添加临时图片信息（用于后端移动文件）
        if (tmpImagesAll.length > 0 || examImageTmpUuid[ex_question_id]) {
            ret.tmp_images = tmpImagesAll;
            ret.tmp_uuid = examImageTmpUuid[ex_question_id] || '';
        }
    } else if(pkind == 25) {
        // **************************************************
        // Programming
        ret.submission = {
            "lang": 0,
            "code": $('#ex_question_' + ex_question_id).val().trim()
        };
        
        // 从 select 元素获取语言
        const langSelect = $(`select[name="lang"][qid="${ex_question_id}"]`);
        if (langSelect.length === 0) {
            ret.err = '语言选择器未找到 / Language selector not found';
            return ret;
        }
        
        const langValue = langSelect.val();
        if (langValue === null || langValue === undefined || langValue === '') {
            ret.err = '请选择编程语言 / Please select a programming language';
            return ret;
        }
        
        const parsedLang = parseInt(langValue);
        if (isNaN(parsedLang)) {
            ret.err = '无效的编程语言 / Invalid programming language';
            return ret;
        }
        
        ret.submission.lang = parsedLang;
        
        if(ret.submission.code == '') {
            ret.err = '代码不能为空 / code is empty';
        } else if(ret.submission.code.length > 16384) {
            ret.err = '代码太长 / code is too long';
        }
    } else {
        ret.err = "No such question: " + ex_question_id + ", pkind: " + pkind;
        console.error(ret.err);
    }
    return ret;
}

// ---------- 考生图片上传（前端转 webp + 缩放） ----------
const CSGOJ_MAX_IMAGE_DIM = window.CSGOJ_IMAGE_MAX_DIM;
async function preprocessExamImageToWebp(file) {
    const name = (file.name || '').toLowerCase();
    const ok = name.endsWith('.bmp') || name.endsWith('.png') || name.endsWith('.jpg') || name.endsWith('.jpeg') || name.endsWith('.webp') || name.endsWith('.tif') || name.endsWith('.tiff');
    if (!ok) throw new Error('仅允许 bmp/png/jpg/webp/tiff 图片');
    const bmp = await createImageBitmap(file);
    const w0 = bmp.width, h0 = bmp.height;
    const scale = Math.min(1, CSGOJ_MAX_IMAGE_DIM / Math.max(w0, h0));
    const w = Math.max(1, Math.round(w0 * scale));
    const h = Math.max(1, Math.round(h0 * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(bmp, 0, 0, w, h);
    // 转换为 WebP 格式，质量 0.85（WebP 在相同质量下文件更小）
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/webp', 0.85));
    if (!blob) throw new Error('图片转换失败');
    return blob;
}

// 存储每个题目的 tmp_uuid（用于图片上传）
const examImageTmpUuid = {};

$(document).on('change', '.exam-image-file', async function() {
    const qid = parseInt($(this).attr('data-qid'));
    const subq = parseInt($(this).attr('data-subq'));
    const req = parseInt($(this).attr('data-req'));
    const file = this.files && this.files[0];
    this.value = '';
    if (!file) return;
    try {
        const webpBlob = await preprocessExamImageToWebp(file);
        const fd = new FormData();
        fd.append('ex_question_id', String(qid));
        fd.append('sub_idx', String(subq));
        fd.append('req_idx', String(req));
        // 携带 tmp_uuid（如果已存在）
        if (examImageTmpUuid[qid]) {
            fd.append('tmp_uuid', examImageTmpUuid[qid]);
        }
        fd.append('upload_file', webpBlob, `${qid}_${contest_user}_${Date.now()}.webp`);
        const ret = await csg.post({
            url: `exam_image_upload_ajax?cid=${cid}`,
            data: fd,
            dtype: 'json',
        });
        if (!ret || ret.code !== 1) {
            alerty.error(ret?.msg || '上传失败');
            return;
        }
        
        // 保存 tmp_uuid（如果返回了新的）
        if (ret.data?.tmp_uuid) {
            examImageTmpUuid[qid] = ret.data.tmp_uuid;
        }
        
        // 保存临时文件名到隐藏输入框（用于提交时移动）
        const tmpFileName = ret.data?.file_name || '';
        const tmpHidden = $(`input.submission_image_tmp_${qid}[data-subq="${subq}"][data-req="${req}"]`);
        if (tmpHidden.length > 0) {
            tmpHidden.val(tmpFileName);
        }

        // C2：将 WebP blob 缓存到 IndexedDB，刷新后可恢复预览；并把 pending 信息写入 asheet_tmp
        await saveExamTmpImgBlobToIdb(cid, contest_user, qid, subq, req, webpBlob);
        upsertPendingTmpImage(qid, subq, req, examImageTmpUuid[qid] || '', tmpFileName);
        // 关键：用户可能“上传后立刻刷新”，这里必须 await 落盘 pending 信息，避免刷新后无法恢复
        try {
            if (typeof SetAsheetTmp === 'function') {
                
                await SetAsheetTmp(asheet_tmp, cid, contest_user);
                
            }
        } catch (e) {}
        
        // 预览：使用临时文件的 blob URL（或后端提供的预览 URL）
        // 注意：此时图片还在 tmp 目录，不能使用最终 URL
        const img = document.getElementById(`exam_img_preview_${qid}_${subq}_${req}`);
        if (img) {
            // 使用 blob URL 预览
            const blobUrl = URL.createObjectURL(webpBlob);
            img.src = blobUrl;
            img.classList.remove('d-none');
            // 保存 blob URL 到 data 属性，以便后续清理
            img.setAttribute('data-blob-url', blobUrl);
        }
        
        // 标记题目已修改（但未保存）
        if (question_map[qid]) {
            question_map[qid].modified = true;
            UpdateAsheetTmp(qid);
        }

        // 上传图片也属于“答卷变更”：需要提示“已修改，记得保存”
        try {
            const questionDiv = document.getElementById(`question_div_${qid}`);
            if (questionDiv) {
                questionDiv.setAttribute('data-modified', 'true');
                // 启用保存按钮（除非考试结束）
                const q = question_map?.[qid] || null;
                const examDisabled = q ? QuestionRender?.dis?.IsQuestionDisabled?.(q) : false;
                if (QuestionRender?.dis?.SubmitButtonStatus) {
                    QuestionRender.dis.SubmitButtonStatus(questionDiv, true, !!examDisabled);
                }
                if (typeof showSaveReminder === 'function') {
                    showSaveReminder(questionDiv);
                }
            }
        } catch (e) {}
        
        alerty.success('图片已上传（待保存）');
    } catch (e) {
        console.error(e);
        alerty.error(String(e?.message || e || '上传失败'));
    }
});
function SubmitSingleQuestion(cid, ex_question_id, opts) {
    opts = opts || {};
    let ret = GetSubmissionFromDom(ex_question_id);
    if(ret.err != '') {
        alerty.error(`Question ${question_map[ex_question_id].num}:<br/>${ret.err}`);
        return;
    }
    QuestionRender.dis.Render(question_map?.[ex_question_id], null, true); // 以免提交等待过程中重复提交
    // 提交答题（包含临时图片信息）
    // 关键：综合题 images 是二维数组；使用 x-www-form-urlencoded 提交时，空数组行可能被序列化丢失，导致后端 images[i] = null -> Not valid image submission。
    // 因此这里统一用 JSON 字符串传输 submission_raw/tmp_images（后端会优先解析 JSON 字段）。
    const postData = {
        'ex_question_id': ex_question_id,
        'submission_raw_json': JSON.stringify(ret.submission || {}),
        'tmp_uuid': ret.tmp_uuid || '',
        'tmp_images_json': JSON.stringify(ret.tmp_images || []),
    };
    $.post(
        "ex_question_submit_ajax?cid=" + cid,
        postData,
        function (ret) {
            // tmp 图片过期：提示并支持自动重传（使用本地 IDB blob），然后自动重试一次
            if (ret && ret.code !== 1 && ret.data && ret.data.err_code === 'TMP_IMAGE_EXPIRED') {
                // 关键：本次提交前已 disable 全题交互；遇到 TMP_IMAGE_EXPIRED 必须立刻恢复交互，否则用户无法重新上传/继续答题
                try {
                    QuestionRender?.dis?.Render?.(question_map?.[ex_question_id], null, false);
                } catch (e) {}

                // 避免无限重试
                if (opts && opts._retried_tmp_expired) {
                    alerty.error(ret.msg || '图片已失效，请重新上传后再保存。');
                    return;
                }
                alerty.confirm({
                    title: '提示<span class="en-text">Tip</span>',
                    message: '由于过久未保存，图片已失效，需要重新上传。',
                    message_en: 'Image expired. Re-upload required.',
                    callback: async function() {
                        try {
                            // 自动重传期间临时禁用，避免重复点击
                            try { QuestionRender?.dis?.Render?.(question_map?.[ex_question_id], null, true); } catch(e) {}
                            alerty.message('正在自动重新上传图片，请稍候...', 'Re-uploading images...');

                            const r = await autoReuploadTmpImages(cid, ex_question_id);
                            if (!r.ok) {
                                alerty.error(r.msg || '自动重传失败', 'Auto re-upload failed.');
                                return;
                            }
                            // 重试保存
                            SubmitSingleQuestion(cid, ex_question_id, { _retried_tmp_expired: true });
                        } catch (e) {
                            alerty.error('自动重传失败，请手动重新上传。', 'Auto re-upload failed. Please re-upload manually.');
                        } finally {
                            // 无论成功/失败，都恢复交互（重试保存会再次 disable）
                            try { QuestionRender?.dis?.Render?.(question_map?.[ex_question_id], null, false); } catch(e) {}
                        }
                    },
                    callbackCancel: function() {
                        // 保持交互可用，允许用户手动重新上传
                        try { QuestionRender?.dis?.Render?.(question_map?.[ex_question_id], null, false); } catch(e) {}
                    }
                });
                return;
            }

            // ProcessRet(ret, ex_question_id, ret.submission, shining);
            ProcessRet(ret, ex_question_id, ret.submission, false); // 不闪动了
            // 提交成功后，清理临时图片的 blob URL
            if (ret.code == 1) {
                $(`img[id^="exam_img_preview_${ex_question_id}_"]`).each(function() {
                    const blobUrl = $(this).attr('data-blob-url');
                    if (blobUrl) {
                        URL.revokeObjectURL(blobUrl);
                        $(this).removeAttr('data-blob-url');
                    }
                });
                // 清除 tmp_uuid（已保存）
                delete examImageTmpUuid[ex_question_id];
            }
        }
    );
}
function JudgeSaved() {
    // 判断是否所有题都保存了
    if(!asheet_tmp) {
        return true;
    }
    let modified_list = [];
    try {
        for(let ex_question_id in asheet_tmp) {
            if(!(ex_question_id in asheet) || asheet_tmp[ex_question_id].update_at > asheet[ex_question_id].update_at) {
                if(ex_question_id in question_map) {
                    modified_list.push({
                        'ex_question_id': ex_question_id,
                        'num': question_map[ex_question_id].num,
                        'question_title': `${question_map[ex_question_id].num}. ${question_map[ex_question_id].title.substring(0, 20)}...`
                    });
                }
            }
        }
        modified_list.sort((a, b) => a.num - b.num);
        return modified_list;
    } catch(e) {
        console.error(e);
    }
}
// **************************************************
// 保存题目答卷到服务器
$(document).on('click', '.question_submit', function(){
    SubmitSingleQuestion(cid, this.getAttribute('qid'))
});

// **************************************************
// 编程题
$(document).on('click', '.Programming_reset', function(){
    let ex_question_id = parseInt(this.getAttribute('qid'));
    alerty.confirm("确定重置为参考模板？<br/>Sure to reset this question?", 
        function(){
            try {
                let code_textarea = $('#ex_question_' + ex_question_id);
                let default_code = GetDefaultCodeTemplate(ex_question_id);
                let changed = default_code != code_textarea.val();
                code_textarea.val(default_code);
                if(changed) {
                    UpdateAsheetTmp(ex_question_id);
                }                
            } catch(e) {
                alerty.error('获取参考代码失败');
            }
        },
        function(){
            return;
        }
    )
});

function GetDefaultCodeTemplate(ex_question_id) {
    try {
        let content = question_map?.[ex_question_id]?.content;
        if (typeof content === 'string') {
            content = JSON.parse(content);
        }
        if (!Array.isArray(content) || content.length === 0) return '';
        const first = content[0];
        if (typeof first === 'string') return first;
        if (first && typeof first.code === 'string') return first.code;
        if (first && first.code != null) return String(first.code);
    } catch(e) {
        // ignore
    }
    return '';
}
// // 一次提交多个题，一次请求 Unfininshed！！！
// function SubmitMultiQuestion(modified_list) {
//     let sret = {
//         'err_list': [],
//         'ret_list': []
//     }
//     for(let i in modified_list) {    
//         let ret = GetSubmissionFromDom(modified_list[i].ex_question_id);
//         if(ret.err != '') {
//             sret.err_list.push({
//                 'num': question_map[modified_list[i].ex_question_id].num,
//                 'ex_question_id': modified_list[i].ex_question_id,
//                 'err': ret.err
//             });
//         } else {
//             sret.ret_list.push({
//                 'ex_question_id': modified_list[i].ex_question_id,
//                 'submission': ret.submission
//             })
//         }
//     }
//     if(sret.err_list.length > 0) {
//         sret.err_list.sort((a, b) => a.num - b.num);
//         let err_str = "请检查以下错误，修正后提交：<br/>"
//         for(let i = 0; i < sret.err_list.length; i ++) {
//             err_str += `<br/>${sret.err_list[i].num}. ${sret.err_list[i].err}`;
//         }
//         alerty.alert(err_str);
//     }
// }

// 提交多个题 迭代式
function JudgeAsheetValid(modified_list) {
    let err_list = []
    for(let i in modified_list) {    
        let ret = GetSubmissionFromDom(modified_list[i].ex_question_id);
        if(ret.err != '') {
            err_list.push({
                'num': question_map[modified_list[i].ex_question_id].num,
                'ex_question_id': modified_list[i].ex_question_id,
                'err': ret.err
            });
        }
    }
    if(err_list.length > 0) {
        err_list.sort((a, b) => a.num - b.num);
        let err_str = "请检查以下问题，修正后提交：<br/>"
        for(let i = 0; i < err_list.length; i ++) {
            err_str += `<br/>${err_list[i].num}. ${err_list[i].err}`;
        }
        alerty.alert(err_str);
        return false;
    }
    return true;
}
function SubmitMultiQuestionIterate(ith, modified_list) {
    if(ith >= modified_list.length) {
        alerty.alert('保存提交完毕，注意检查是否有错误提示.<br/>Save finished. Please confirm error tips.');
        return;
    }
    SubmitSingleQuestion(cid, modified_list[ith].ex_question_id);    // false: don't shine

    setTimeout(() => {
        SubmitMultiQuestionIterate(ith + 1, modified_list);
    }, 200);
}

function UpdateAsheetTmp(ex_question_id, update_at=null) {
    if(!(ex_question_id in asheet_tmp)) {
        asheet_tmp[ex_question_id] = {};
    }
    ret = GetSubmissionFromDom(ex_question_id);
    let submission = ret.submission;
    if(submission == null) {
        return;
    }
    asheet_tmp[ex_question_id]['ex_question_id'] = ex_question_id;
    asheet_tmp[ex_question_id]['submission'] = submission;
    asheet_tmp[ex_question_id]['update_at'] = update_at == null ? get_contest_now() : update_at;
    // 额外保存未落地图片引用信息（刷新后可恢复保存链路）
    if (ret.tmp_uuid) {
        asheet_tmp[ex_question_id]['pending_tmp_uuid'] = ret.tmp_uuid;
    }
    if (ret.tmp_images && Array.isArray(ret.tmp_images) && ret.tmp_images.length > 0) {
        asheet_tmp[ex_question_id]['pending_tmp_images'] = ret.tmp_images;
    }
    SetAsheetTmp(asheet_tmp, cid, contest_user);
    if(update_at == null) {
        // 新修改了答案
        if (question_map[ex_question_id]) {
            question_map[ex_question_id].modified = true;
            QuestionRender.dis.Render(question_map[ex_question_id]);
            UpdateQuestionAnswerStatus(question_map[ex_question_id]);
        }
        // 触发自定义事件，通知新界面更新状态
        $(document).trigger('answerModified', [ex_question_id]);
    }
}
document.addEventListener("change", function(event){
    // Save answer sheet change to local storage
    if(event.target.classList.contains("question_input_check") || event.target.classList.contains("language_select")){
        const qid = event.target.getAttribute('qid');
        if (qid) {
            UpdateAsheetTmp(parseInt(qid));
        }
    }
});

document.addEventListener("input", function(event){
    // Save answer sheet change to local storage
    if(event.target.classList.contains("question_input_typein")){
        UpdateAsheetTmp(parseInt(event.target.getAttribute('qid')));
    }
});

// **************************************************
// 编程题状态轮询功能
// **************************************************

// 存储每个题目的轮询定时器
let statusPollingTimers = {};
// 存储每个题目按钮的原始内容，用于恢复
let statusButtonOriginals = {};

/**
 * 启动状态轮询
 * @param {number} ex_question_id - 题目ID
 * @param {number} solution_id - 提交ID
 */
function startStatusPolling(ex_question_id, solution_id) {
    // 停止之前的轮询（如果存在）
    stopStatusPolling(ex_question_id);
    
    // 获取 cid（从全局变量或页面元素）
    let cid = null;
    // 尝试从全局变量获取（ex_question_list.js 中定义的）
    if (typeof window.cid !== 'undefined' && window.cid) {
        cid = window.cid;
    } else {
        // 从页面元素获取
        const pageInfo = document.getElementById('page_info');
        if (pageInfo) {
            cid = pageInfo.getAttribute('cid');
        }
        // 如果还是没找到，尝试从 jQuery 对象获取
        if (!cid && typeof $ !== 'undefined') {
            const $pageInfo = $('#page_info');
            if ($pageInfo.length > 0) {
                cid = $pageInfo.attr('cid');
            }
        }
    }
    if (!cid) {
        console.warn('Cannot start status polling: cid not found');
        return;
    }
    
    // 获取状态按钮元素
    const statusButton = document.getElementById(`pro_status_${ex_question_id}`);
    if (!statusButton) {
        console.warn(`Cannot start status polling: status button not found for question ${ex_question_id}`);
        return;
    }
    
    // 保存按钮的原始内容（如果还没有保存）
    if (!statusButtonOriginals[ex_question_id]) {
        statusButtonOriginals[ex_question_id] = {
            innerHTML: statusButton.innerHTML,
            className: statusButton.className,
            href: statusButton.getAttribute('href')
        };
    }
    
    // 初始状态：显示加载中
    updateStatusButton(statusButton, {
        result: 0, // 0 = Pending
        res_text: '等待评测',
        res_short: 'PD',
        res_color: 'default',
        res_show: false
    });
    
    // 轮询间隔：2s -> 4s -> 8s -> 8s...
    let pollInterval = 2000;
    let pollCount = 0;
    
    /**
     * 执行一次状态查询
     */
    function pollStatus() {
        $.get(`/${PAGE_MODULE}/contest/status_ajax?cid=${cid}`, {
            solution_id: solution_id
        }, function(ret) {
            if (ret && ret.rows && ret.rows.length > 0) {
                const statusData = ret.rows[0];
                updateStatusButton(statusButton, statusData);
                
                // 如果评测完成（result >= 4），停止轮询，10秒后恢复按钮
                if (statusData.result >= 4) {
                    stopStatusPolling(ex_question_id);
                    setTimeout(() => {
                        restoreStatusButton(ex_question_id);
                    }, 10000); // 10秒后恢复
                    return;
                }
            }
            
            // 继续轮询
            pollCount++;
            // 前两次使用2s，之后使用4s，再之后使用8s
            if (pollCount <= 1) {
                pollInterval = 2000;
            } else if (pollCount <= 3) {
                pollInterval = 4000;
            } else {
                pollInterval = 8000;
            }
            
            const timer = setTimeout(pollStatus, pollInterval);
            statusPollingTimers[ex_question_id] = timer;
        }).fail(function() {
            // 网络错误：显示错误状态，停止轮询
            updateStatusButton(statusButton, {
                result: -1,
                res_text: '查询失败',
                res_short: 'ERR',
                res_color: 'danger',
                res_show: false
            });
            stopStatusPolling(ex_question_id);
            // 10秒后恢复按钮
            setTimeout(() => {
                restoreStatusButton(ex_question_id);
            }, 10000);
        });
    }
    
    // 立即执行第一次查询
    pollStatus();
}

/**
 * 停止状态轮询
 * @param {number} ex_question_id - 题目ID
 */
function stopStatusPolling(ex_question_id) {
    if (statusPollingTimers[ex_question_id]) {
        clearTimeout(statusPollingTimers[ex_question_id]);
        delete statusPollingTimers[ex_question_id];
    }
}

/**
 * 恢复按钮到原始状态
 * @param {number} ex_question_id - 题目ID
 */
function restoreStatusButton(ex_question_id) {
    const statusButton = document.getElementById(`pro_status_${ex_question_id}`);
    if (!statusButton || !statusButtonOriginals[ex_question_id]) {
        return;
    }
    
    const original = statusButtonOriginals[ex_question_id];
    statusButton.innerHTML = original.innerHTML;
    statusButton.className = original.className;
    if (original.href) {
        statusButton.setAttribute('href', original.href);
    }
    
    // 恢复 title 属性（如果原始内容中有）
    if (original.title) {
        statusButton.setAttribute('title', original.title);
    } else {
        // 如果没有原始 title，移除可能存在的 data-bs-title
        statusButton.removeAttribute('data-bs-title');
    }
    
    // 更新 tooltip（如果已初始化）
    updateButtonTooltip(statusButton);
    
    // 清除保存的原始内容
    delete statusButtonOriginals[ex_question_id];
}

/**
 * 更新按钮的 tooltip（兼容全局 tooltip 系统）
 * @param {HTMLElement} button - 按钮元素
 */
function updateButtonTooltip(button) {
    if (!button) return;
    
    // 检查是否已经有 tooltip 实例
    const tooltipInstance = bootstrap.Tooltip.getInstance(button);
    if (tooltipInstance) {
        // 如果已有实例，更新 title
        const titleText = button.getAttribute('data-bs-title') || button.getAttribute('title') || '';
        if (titleText) {
            tooltipInstance.setContent({ '.tooltip-inner': titleText });
        }
    } else {
        // 如果没有实例，检查是否有 title 或 data-bs-title，触发全局 tooltip 初始化
        const titleText = button.getAttribute('data-bs-title') || button.getAttribute('title') || '';
        if (titleText && typeof window.autoTooltips !== 'undefined' && window.autoTooltips) {
            // 确保有 title 属性（全局函数会将其转换为 data-bs-title）
            if (!button.getAttribute('title') && !button.getAttribute('data-bs-title')) {
                button.setAttribute('title', titleText);
            }
            // 触发 tooltip 刷新
            window.autoTooltips.refresh();
        }
    }
}

/**
 * 更新状态按钮内容
 * @param {HTMLElement} button - 状态按钮元素
 * @param {Object} statusData - 状态数据（包含 result, res_text, res_short, res_color, res_show）
 */
function updateStatusButton(button, statusData) {
    if (!button) return;
    
    const result = statusData.result;
    const resText = statusData.res_text || '';
    const resShort = statusData.res_short || '';
    const resColor = statusData.res_color || 'default';
    const resShow = statusData.res_show || false;
    
    // 保存原始内容（如果还没有保存）
    const ex_question_id = button.id.replace('pro_status_', '');
    if (!statusButtonOriginals[ex_question_id]) {
        statusButtonOriginals[ex_question_id] = {
            innerHTML: button.innerHTML,
            className: button.className,
            href: button.getAttribute('href'),
            title: button.getAttribute('title') || button.getAttribute('data-bs-title') || ''
        };
    }
    
    // 根据状态更新按钮内容
    let buttonContent = '';
    let buttonClass = 'btn btn-sm';
    let titleText = resText || '评测状态';
    
    // 保留原始 href（如果存在）
    const originalHref = statusButtonOriginals[ex_question_id]?.href || button.getAttribute('href');
    
    if (result === undefined || result === '-' || result === null) {
        buttonContent = '<i class="bi bi-activity"></i><span class="cn-text">评测状态</span><span class="en-text">Status</span>';
        buttonClass += ' btn-outline-info';
        titleText = '评测状态 / Status';
    } else if (result < 4) {
        // 评测中：显示加载动画和状态文本
        buttonContent = `
            <span class='loading-text' style='opacity: 0.6;'>${resShort}</span>
            <div class='spinner-overlay'>
                <div class='spinner-border spinner-border-sm' role='status'>
                    <span class='visually-hidden'>Loading...</span>
                </div>
            </div>
        `;
        buttonClass += ' btn-outline-secondary';
        // 确保按钮是相对定位，以便 spinner-overlay 绝对定位
        if (!button.style.position) {
            button.style.position = 'relative';
        }
    } else {
        // 评测完成：显示结果
        buttonContent = resShort;
        // 根据结果设置按钮颜色
        if (resColor === 'success') {
            buttonClass += ' btn-success';
        } else if (resColor === 'danger') {
            buttonClass += ' btn-danger';
        } else if (resColor === 'warning') {
            buttonClass += ' btn-warning';
        } else if (resColor === 'info') {
            buttonClass += ' btn-info';
        } else {
            buttonClass += ' btn-outline-secondary';
        }
    }
    
    // 更新按钮
    button.innerHTML = buttonContent;
    button.className = buttonClass;
    
    // 更新 title 属性（兼容全局 tooltip 系统）
    // 先设置 title，全局函数会自动转换为 data-bs-title
    button.setAttribute('title', titleText);
    
    // 如果已经有 data-bs-title（说明 tooltip 已初始化），也更新它
    if (button.hasAttribute('data-bs-title')) {
        button.setAttribute('data-bs-title', titleText);
    }
    
    // 保留 href 属性（如果存在），确保点击仍可跳转
    if (originalHref) {
        button.setAttribute('href', originalHref);
    }
    
    // 更新 tooltip（如果已初始化）
    updateButtonTooltip(button);
}
