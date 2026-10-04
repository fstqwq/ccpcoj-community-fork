/**
 * 比赛包：导出表单 + 与 upload_page 协同的导入触发（样式 admin_zip_pkg.css · 3×2 与题包对齐）
 */
(function () {
    'use strict';

    function alertyBilingualData(data) {
        var d = data || {};
        if (d.flg_bilingual && d.msg_cn) {
            if (typeof alerty !== 'undefined' && alerty.alert) {
                alerty.alert({ message: d.msg_cn, message_en: d.msg_en || d.msg_cn });
            } else {
                window.alert(d.msg_cn + (d.msg_en ? '\n' + d.msg_en : ''));
            }
            return true;
        }
        return false;
    }

    function submitExportPost(cid, testOn, attOn) {
        var url = window.CONTEST_PKG_EXPORT_URL || '';
        var bt = window.CONTEST_PKG_BACKTASK_URL || '';
        $.post(
            url,
            {
                contest_id: cid,
                test_data_check: testOn ? 'true' : 'false',
                attach_file_check: attOn ? 'true' : 'false',
            },
            function (ret) {
                $('#ce_btn').prop('disabled', false);
                if (ret && ret.code === 1 && ret.data && ret.data.task_id) {
                    var tid = ret.data.task_id;
                    if (bt && typeof csg !== 'undefined' && csg.openBacktaskWithTaskFilter) {
                        csg.openBacktaskWithTaskFilter(bt, tid, { newTab: true });
                    }
                    var msg =
                        (ret.msg || '已提交') +
                        '\n任务 ID: ' +
                        tid +
                        (bt ? '\n已在新标签页打开后台任务并筛选该任务。' : '');
                    var msgEn =
                        (ret.msg || 'Submitted') +
                        '\nTask ID: ' +
                        tid +
                        (bt ? '\nOpened Backtask in a new tab with this task filtered.' : '');
                    if (typeof alerty !== 'undefined' && alerty.alert) {
                        alerty.alert({ message: msg, message_en: msgEn });
                    } else {
                        window.alert(msg);
                    }
                } else if (ret && ret.data && alertyBilingualData(ret.data)) {
                    /* errorBilingual */
                } else {
                    var err = (ret && ret.msg) ? ret.msg : '失败';
                    if (typeof alerty !== 'undefined' && alerty.alert) {
                        alerty.alert({ message: err, message_en: err });
                    } else {
                        window.alert(err);
                    }
                }
            },
            'json'
        ).fail(function () {
            $('#ce_btn').prop('disabled', false);
            var msg = '网络错误';
            if (typeof alerty !== 'undefined' && alerty.alert) {
                alerty.alert({ message: msg, message_en: msg });
            } else {
                window.alert(msg);
            }
        });
    }

    function exportContest() {
        var url = window.CONTEST_PKG_EXPORT_URL || '';
        var preUrl = window.CONTEST_PKG_PRECHECK_URL || '';
        var raw = String($('#ce_cid').val() || '').trim();
        if (!/^\d+$/.test(raw)) {
            if (typeof alerty !== 'undefined' && alerty.alert) {
                alerty.alert({
                    message: '请输入有效的比赛 ID（纯数字）',
                    message_en: 'Please enter a valid numeric contest ID',
                });
            } else {
                window.alert('请输入有效的比赛 ID');
            }
            return;
        }
        var cid = parseInt(raw, 10);
        if (!cid || cid <= 0) {
            if (typeof alerty !== 'undefined' && alerty.alert) {
                alerty.alert({ message: '请输入比赛 ID', message_en: 'Please enter the contest ID' });
            } else {
                window.alert('请输入比赛 ID');
            }
            return;
        }
        if (!url) {
            return;
        }
        var testOn = $('#ce_test').is(':checked');
        var attOn = $('#ce_attach').is(':checked');
        $('#ce_btn').prop('disabled', true);

        if (!preUrl) {
            submitExportPost(cid, testOn, attOn);
            return;
        }

        $.get(
            preUrl,
            { contest_id: cid },
            function (pret) {
                if (!pret || pret.code !== 1 || !pret.data) {
                    $('#ce_btn').prop('disabled', false);
                    if (!alertyBilingualData(pret && pret.data)) {
                        var msg = '预检失败';
                        if (typeof alerty !== 'undefined' && alerty.alert) {
                            alerty.alert({ message: msg, message_en: 'Precheck failed' });
                        } else {
                            window.alert(msg);
                        }
                    }
                    return;
                }
                if (window.zipPkgContestCidSuggest && typeof window.zipPkgContestCidSuggest.setFeedback === 'function') {
                    window.zipPkgContestCidSuggest.setFeedback('#ce_cid_feedback', pret.data);
                }
                if (!pret.data.exportable) {
                    $('#ce_btn').prop('disabled', false);
                    alertyBilingualData(pret.data);
                    return;
                }
                submitExportPost(cid, testOn, attOn);
            },
            'json'
        ).fail(function () {
            $('#ce_btn').prop('disabled', false);
            var msg = '网络错误';
            if (typeof alerty !== 'undefined' && alerty.alert) {
                alerty.alert({ message: msg, message_en: msg });
            } else {
                window.alert(msg);
            }
        });
    }

    $(document).ready(function () {
        $('#ce_btn').on('click', exportContest);

        if (window.zipPkgContestCidSuggest && typeof window.zipPkgContestCidSuggest.init === 'function') {
            window.zipPkgContestCidSuggest.init({
                inputSelector: '#ce_cid',
                suggestBoxSelector: '#ce_cid_suggest',
                feedbackSelector: '#ce_cid_feedback',
                suggestUrl: window.CONTEST_PKG_SUGGEST_URL || '',
                precheckUrl: window.CONTEST_PKG_PRECHECK_URL || '',
                closeNs: 'contestPkgZip',
            });
        }

        if (window.csgSwitch) {
            ['ce_test', 'ce_attach'].forEach(function (id) {
                var el = document.getElementById(id);
                if (el && el.dataset.csgInitialized !== 'true') {
                    window.csgSwitch.initSwitch(el);
                }
            });
        }

        var upload_table = $('#upload_table');
        var fire_url = $('#id_input').attr('fire_url');
        var item_name = $('#item_input').val();
        if (!upload_table.length || !fire_url || fire_url === 'null') {
            return;
        }

        function fetchContestAttachFromUploadedZip(filename) {
            var metaUrl = window.CONTEST_PKG_ZIP_METADATA_URL || '';
            if (!metaUrl) {
                return Promise.reject(new Error('no zip metadata url'));
            }
            return new Promise(function (resolve, reject) {
                $.get(
                    metaUrl,
                    { filename: filename },
                    function (ret) {
                        if (!ret || ret.code !== 1 || ret.data == null) {
                            if (ret && ret.data && alertyBilingualData(ret.data)) {
                                reject({ _alertyBilingual: true });
                                return;
                            }
                            reject(new Error((ret && ret.msg) || 'metadata failed'));
                            return;
                        }
                        resolve(String(ret.data.attach != null ? ret.data.attach : '').trim());
                    },
                    'json'
                ).fail(function (xhr) {
                    reject(new Error('metadata http ' + (xhr && xhr.status ? xhr.status : '?')));
                });
            });
        }

        function checkAttachExistsOnServer(attach) {
            var chk = window.CONTEST_PKG_ATTACH_CHECK_URL || '';
            if (!chk) {
                return Promise.reject(new Error('no attach check url'));
            }
            return $.get(chk, { attach: attach }).then(function (ret) {
                if (!ret || ret.code !== 1 || ret.data == null) {
                    if (ret && ret.data && alertyBilingualData(ret.data)) {
                        return Promise.reject({ _alertyBilingual: true });
                    }
                    return Promise.reject(new Error((ret && ret.msg) || 'attach check failed'));
                }
                return !!ret.data.exists;
            });
        }

        function runContestImportEnqueue(button, row, regenerateAttach) {
            button.attr('disabled', true);
            var button_text = button.text();
            button.text('Running...');
            if (typeof showOverlay === 'function') {
                showOverlay({
                    message: '正在提交比赛导入任务…',
                    message_en: 'Submitting contest import task…',
                });
            }
            var params = { filename: row.file_name, item: item_name };
            if (regenerateAttach) {
                params.regenerate_contest_attach = '1';
            }
            $.get(fire_url, params, function (ret) {
                if (typeof hideOverlay === 'function') {
                    hideOverlay();
                }
                button.attr('disabled', false);
                button.text(button_text);
                if (ret.code === 1 && ret.data && ret.data.task_id) {
                    var tidImp = ret.data.task_id;
                    var btImp = window.CONTEST_PKG_BACKTASK_URL || '';
                    var msgICn = ret.msg || '比赛导入任务已提交';
                    var msgIEn = ret.msg || 'Contest import task submitted';
                    window.CsgConfirmBacktaskFollowup({
                        backtaskUrl: btImp,
                        taskId: tidImp,
                        title: '导入已入队<span class="en-text">Import queued</span>',
                        messageCn: msgICn,
                        messageEn: msgIEn,
                        onDone: function () {
                            upload_table.bootstrapTable('refresh');
                        },
                    });
                } else if (ret.data && alertyBilingualData(ret.data)) {
                    /* bilingual API error */
                } else {
                    alerty.alert({
                        message: ret.msg || '失败',
                        message_en: ret.msg || 'Failed',
                    });
                }
            }, 'json').fail(function () {
                if (typeof hideOverlay === 'function') {
                    hideOverlay();
                }
                button.attr('disabled', false);
                button.text(button_text);
                alerty.alert({ message: '网络错误', message_en: 'Network error' });
            });
        }

        upload_table.on('click-cell.bs.table', function (e, field, td, row) {
            if (field !== 'file_type') {
                return;
            }
            var button = $('#' + $(td).attr('id'));
            if (typeof showOverlay === 'function') {
                    showOverlay({
                        message: '正在校验比赛包…',
                        message_en: 'Checking the package…',
                    });
            }
            fetchContestAttachFromUploadedZip(row.file_name)
                .then(function (attach) {
                    if (!attach) {
                        if (typeof hideOverlay === 'function') {
                            hideOverlay();
                        }
                        alerty.confirm({
                            title: '导入比赛',
                            message: '将整包导入为新比赛（新 contest_id）。确定继续？',
                            message_en: 'Import contest as a new contest. Continue?',
                            okText: '确定',
                            cancelText: '取消',
                            width: 'lg',
                            callback: function () {
                                runContestImportEnqueue(button, row, false);
                            },
                        });
                        return;
                    }
                    return checkAttachExistsOnServer(attach).then(function (exists) {
                        if (typeof hideOverlay === 'function') {
                            hideOverlay();
                        }
                        if (exists) {
                            var msgDup =
                                '检测到比赛包指纹（attach）与本站已有比赛或附件目录冲突：<code class="user-select-all">' +
                                attach +
                                '</code><br><br>选择「以新哈希值导入」将为本次比赛分配新的附件目录名并继续导入；选择「取消」则不导入。';
                            var msgDupEn =
                                'This package’s attach fingerprint conflicts with an existing contest or folder: <code class="user-select-all">' +
                                attach +
                                '</code><br><br>Choose <b>Import with new hash</b> to assign a new attach folder and import; choose <b>Cancel</b> to abort.';
                            alerty.confirm({
                                title: '比赛指纹冲突<span class="en-text">Attach conflict</span>',
                                message: msgDup,
                                message_en: msgDupEn,
                                okText: '以新哈希值导入<span class="en-text">Import with new hash</span>',
                                cancelText: '取消<span class="en-text">Cancel</span>',
                                width: 'lg',
                                callback: function () {
                                    runContestImportEnqueue(button, row, true);
                                },
                            });
                            return;
                        }
                        alerty.confirm({
                            title: '导入比赛',
                            message: '将整包导入为新比赛（新 contest_id）。确定继续？',
                            message_en: 'Import contest as a new contest. Continue?',
                            okText: '确定',
                            cancelText: '取消',
                            width: 'lg',
                            callback: function () {
                                runContestImportEnqueue(button, row, false);
                            },
                        });
                    });
                })
                .catch(function (err) {
                    if (typeof hideOverlay === 'function') {
                        hideOverlay();
                    }
                    if (err && err._alertyBilingual) {
                        return;
                    }
                    alerty.alert({
                        message: '无法读取比赛包信息，请使用本站导出的比赛包。',
                        message_en: 'Couldn’t read package info. Use a contest package exported from this site.',
                    });
                });
            return false;
        });
    });
})();
