/**
 * 题包转换页：将打包好的 ZIP 上传至题目导入区或直接入队 problem_import。
 * 依赖：polygon.js（BuildSelectedProblemsZipBlob）、thusaa.js（BuildSelectedThusaaProblemsZipBlob）、
 * chunk_upload.js（ChunkUpload）、global（csg、alerty、$）
 */
(function () {
    'use strict';

    function readConfig() {
        var el = document.getElementById('problem-pkg-import-config');
        if (!el) return null;
        return {
            chunkUploadUrl: el.getAttribute('data-chunk-upload-url') || '',
            importAjax: el.getAttribute('data-import-ajax') || '',
            filemanagerUrl: el.getAttribute('data-filemanager-url') || '',
            backtaskUrl: el.getAttribute('data-backtask-url') || '',
        };
    }

    function courseParams() {
        var p = {};
        if (typeof window.NOW_COURSE_ID !== 'undefined' && window.NOW_COURSE_ID !== null && window.NOW_COURSE_ID !== '') {
            p.now_course_id = window.NOW_COURSE_ID;
        }
        if (typeof window.NOW_COURSE_KEY === 'string' && window.NOW_COURSE_KEY) {
            p.now_course_key = window.NOW_COURSE_KEY;
        }
        return p;
    }

    async function packSelectedZip(packFn, tableSelector) {
        var ac = new AbortController();
        showOverlay({
            message: '正在打包选中题目…',
            message_en: 'Packing selected problems…',
            type: 'text',
            progressMode: 'indeterminate',
            cancelable: true,
            cancelLabel: '取消',
            cancelLabel_en: 'Cancel',
            abortController: ac,
        });
        try {
            var fn = packFn || window.BuildSelectedProblemsZipBlob;
            if (tableSelector) {
                return await fn(tableSelector, ac.signal);
            }
            return await fn(undefined, ac.signal);
        } finally {
            hideOverlay();
        }
    }

    /** ChunkUpload 内部已负责遮罩，此处勿再包一层。 */
    async function uploadPackedZip(cfg, packed) {
        var file = new File([packed.blob], packed.defaultName, { type: 'application/zip' });
        var data = Object.assign({ item: 'problemexport', id: '' }, courseParams());
        var ok = await ChunkUpload(file, cfg.chunkUploadUrl, data);
        return ok ? packed.defaultName : null;
    }

    function runImportAjax(cfg, filename, signal, extraParams) {
        var params = Object.assign(
            {
                item: 'problemexport',
                filename: filename,
            },
            courseParams(),
            extraParams || {}
        );
        return new Promise(function (resolve, reject) {
            if (signal && signal.aborted) {
                reject(new DOMException('Cancelled', 'AbortError'));
                return;
            }
            var xhr = $.ajax({
                url: cfg.importAjax,
                method: 'GET',
                data: params,
                success: function (ret) {
                    if (signal && signal.aborted) {
                        return;
                    }
                    if (ret && ret.code === 1) {
                        resolve(ret);
                    } else {
                        reject(new Error((ret && ret.msg) || 'Import request failed'));
                    }
                },
                error: function (jqXHR, status) {
                    if (status === 'abort') {
                        reject(new DOMException('Cancelled', 'AbortError'));
                        return;
                    }
                    reject(new Error((jqXHR && jqXHR.statusText) || 'Network error'));
                },
            });
            if (signal) {
                signal.addEventListener(
                    'abort',
                    function () {
                        if (xhr && typeof xhr.abort === 'function') {
                            xhr.abort();
                        }
                    },
                    { once: true }
                );
            }
        });
    }

    function wireOneImportUi(cfg, spec) {
        var btn = document.getElementById(spec.btnId);
        var modalEl = document.getElementById(spec.modalId);
        if (!cfg || !cfg.chunkUploadUrl || !btn || !modalEl) {
            return;
        }
        var modal = window.bootstrap ? new bootstrap.Modal(modalEl) : null;
        if (!modal) return;

        btn.addEventListener('click', function () {
            var sel = $(spec.tableSelector).bootstrapTable('getSelections');
            if (!sel || !sel.length) {
                alerty.error('请先勾选题目', 'Select at least one problem');
                return;
            }
            modal.show();
        });

        var btnUpload = document.getElementById(spec.uploadOnlyBtnId);
        var btnDirect = document.getElementById(spec.directBtnId);
        if (btnUpload) {
            btnUpload.addEventListener('click', function () {
                modal.hide();
                (async function () {
                    try {
                        var packed = await packSelectedZip(spec.packFn, spec.tableSelector);
                        if (!packed) {
                            alerty.error('请先勾选题目', 'Select at least one problem');
                            return;
                        }
                        var fn = await uploadPackedZip(cfg, packed);
                        if (fn) {
                            alerty.success('已上传，将打开题目导入/导出页', 'Uploaded. Opening problem import/export page.');
                            window.location.href = cfg.filemanagerUrl;
                        }
                    } catch (e) {
                        if (e && e.name === 'AbortError') {
                            return;
                        }
                        console.error(e);
                        hideOverlay();
                        alerty.error(String(e.message || e), String(e.message || e));
                    }
                })();
            });
        }
        if (btnDirect) {
            btnDirect.addEventListener('click', function () {
                alerty.confirm({
                    title: '提交后台导入',
                    message:
                        '导入将添加新题目；重复导入同一包可能产生重复题目。\n\n确定要上传并提交后台导入任务吗？',
                    message_en:
                        'Import adds new problems; re-importing the same package may create duplicates.\n\nUpload and submit a background import task?',
                    okText: '确定',
                    cancelText: '取消',
                    width: 'lg',
                    switches: [
                        {
                            id: 'auto_submit_solutions',
                            label: '自动提交包内代码',
                            label_en: 'Auto-submit included solutions',
                            checked: false,
                            tip: '勾选后，包内附带的评测代码将自动提交至新题目，由评测机重新评测',
                            tip_en: 'When enabled, bundled solution code will be auto-submitted for re-judging',
                        }
                    ],
                    callback: function (switchValues) {
                        var autoSubmit = switchValues && switchValues.auto_submit_solutions;
                        modal.hide();
                        (async function () {
                            try {
                                var packed = await packSelectedZip(spec.packFn, spec.tableSelector);
                                if (!packed) {
                                    alerty.error('请先勾选题目', 'Select at least one problem');
                                    return;
                                }
                                var fn = await uploadPackedZip(cfg, packed);
                                if (!fn) return;
                                var acImp = new AbortController();
                                showOverlay({
                                    message: '正在提交后台导入任务…',
                                    message_en: 'Submitting background import…',
                                    type: 'text',
                                    progressMode: 'indeterminate',
                                    cancelable: true,
                                    cancelLabel: '取消',
                                    cancelLabel_en: 'Cancel',
                                    abortController: acImp,
                                });
                                var ret = await runImportAjax(cfg, fn, acImp.signal, {
                                    auto_submit_solutions: autoSubmit ? '1' : '0'
                                });
                                hideOverlay();
                                var msgCn = ret.msg || '导入任务已提交';
                                var msgEn = ret.msg || 'Import task submitted';
                                if (cfg.backtaskUrl) {
                                    msgCn += '\n\n点击「确定」后将进入后台任务页，可查看本次导入进度。';
                                    msgEn +=
                                        '\n\nClick OK to open the backtask page and check this import\'s progress.';
                                }
                                alerty.alert({
                                    message: msgCn,
                                    message_en: msgEn,
                                    width: 'lg',
                                    callback: function () {
                                        if (cfg.backtaskUrl) {
                                            window.location.href = cfg.backtaskUrl;
                                        }
                                    },
                                });
                            } catch (e) {
                                hideOverlay();
                                if (e && e.name === 'AbortError') {
                                    return;
                                }
                                console.error(e);
                                alerty.error(String(e.message || e), String(e.message || e));
                            }
                        })();
                    },
                });
            });
        }
    }

    document.addEventListener('DOMContentLoaded', function () {
        var cfg = readConfig();
        if (!cfg || !cfg.chunkUploadUrl) {
            return;
        }
        wireOneImportUi(cfg, {
            btnId: 'polygon_import_oj_btn',
            modalId: 'polygonImportOjModal',
            tableSelector: '#polygon_parse_table',
            packFn: window.BuildSelectedProblemsZipBlob,
            uploadOnlyBtnId: 'polygonImportOjBtnUploadOnly',
            directBtnId: 'polygonImportOjBtnDirect',
        });
        wireOneImportUi(cfg, {
            btnId: 'thusaa_import_oj_btn',
            modalId: 'thusaaImportOjModal',
            tableSelector: '#thusaa_parse_table',
            packFn: window.BuildSelectedThusaaProblemsZipBlob,
            uploadOnlyBtnId: 'thusaaImportOjBtnUploadOnly',
            directBtnId: 'thusaaImportOjBtnDirect',
        });
    });
})();
