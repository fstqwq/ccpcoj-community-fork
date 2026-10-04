/**
 * 题目包单页：导出表单校验与提交（样式见 admin_zip_pkg.css，后台任务）
 */
(function () {
    'use strict';

    function problemPkgExportSubmitButtonHtml(cn, en) {
        var esc = function (s) {
            return $('<div/>').text(String(s || '')).html();
        };
        return (
            '<span class="cn-text"><i class="bi bi-download me-1" aria-hidden="true"></i>' +
            esc(cn) +
            '</span><span class="en-text">' +
            esc(en) +
            '</span>'
        );
    }

    /** 与 global.js button_delay 类似，恢复时保留「图标 + 提交导出」结构 */
    function problemPkgExportSubmitButtonCooldown($btn, cn, en, delaySec) {
        var left = delaySec;
        $btn.prop('disabled', true);
        function tick() {
            if (left <= 0) {
                $btn.html(problemPkgExportSubmitButtonHtml(cn, en));
                $btn.prop('disabled', false);
                return;
            }
            $btn.html(left + ' 秒<span class="en-text">' + left + 's</span>');
            left -= 1;
            setTimeout(tick, 1000);
        }
        tick();
    }

    function DoExport(form) {
        var submit_button = $('#submit_button');
        var submit_button_texts = window.Bilingual
            ? window.Bilingual.getBilingualText(submit_button)
            : { chinese: '提交导出', english: 'Submit export' };
        var submit_button_text = submit_button_texts.chinese;
        var submit_button_en_text = submit_button_texts.english;

        var attach_file_check = $('#attach_file_check');
        var test_data_check = $('#test_data_check');
        var testDataChecked = test_data_check[0] ? test_data_check[0].checked : false;
        var attachFileChecked = attach_file_check[0] ? attach_file_check[0].checked : false;

        submit_button.prop('disabled', true);
        submit_button.html(
            '<span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>提交中...<span class="en-text">Submitting...</span>'
        );

        var url = window.PROBLEM_EXPORT_AJAX_URL || '';
        $.post(
            url,
            {
                start_pid: $('#start_pid').val(),
                end_pid: $('#end_pid').val(),
                pid_list: $('#pid_list').val(),
                ex_cid: $('#ex_cid').val(),
                test_data_check: testDataChecked ? 'true' : 'false',
                attach_file_check: attachFileChecked ? 'true' : 'false',
            },
            function (ret) {
                if (ret && ret.code == 1) {
                    var taskId = ret.data && ret.data.task_id;
                    if (taskId) {
                        var btBase =
                            (typeof window.PROBLEM_BACKTASK_URL === 'string' && window.PROBLEM_BACKTASK_URL) ||
                            '/' + (window.PROBLEMEXPORT_WEB_MODULE || 'admin') + '/backtask';
                        if (typeof csg !== 'undefined' && csg.openBacktaskWithTaskFilter) {
                            csg.openBacktaskWithTaskFilter(btBase, taskId, { newTab: true });
                        }
                        alerty.alert({
                            message:
                                '导出任务已提交（Task #' +
                                taskId +
                                '）。已在新标签页打开后台任务并筛选该任务。',
                            message_en:
                                'Export task submitted (Task #' +
                                taskId +
                                '). Opened Backtask in a new tab with this task filtered.',
                        });
                    } else {
                        alerty.alert({
                            message: ret.msg || '导出完成',
                            callback: function () {},
                        });
                    }
                } else {
                    alerty.alert(ret.msg || '失败');
                }
                problemPkgExportSubmitButtonCooldown(
                    submit_button,
                    submit_button_text,
                    submit_button_en_text,
                    3
                );
            },
            'json'
        ).fail(function () {
            alerty.alert('网络错误', 'Network error');
            problemPkgExportSubmitButtonCooldown(
                submit_button,
                submit_button_text,
                submit_button_en_text,
                3
            );
        });
    }

    function SubmitExport(form) {
        var attach_file_check = $('#attach_file_check');
        var test_data_check = $('#test_data_check');
        var testDataChecked = test_data_check[0] ? test_data_check[0].checked : false;
        var attachFileChecked = attach_file_check[0] ? attach_file_check[0].checked : false;

        if (testDataChecked || attachFileChecked) {
            alerty.confirm({
                message:
                    '题目导出将作为<strong>后台任务</strong>执行，可在任务页面查看进度和下载结果。<br/>' +
                    '请确保数据总量在合理范围内。<br/>' +
                    '确认提交？',
                message_en:
                    'Problem export will run as a <strong>background task</strong>. ' +
                    'You can track progress and download results on the task page.<br/>' +
                    'Please ensure the total data size is reasonable.<br/>' +
                    'Confirm?',
                callback: function () {
                    DoExport(form);
                },
                callbackCancel: function () {
                    alerty.message('已取消', 'Canceled');
                },
            });
            return false;
        }
        DoExport(form);
        return false;
    }

    $(document).ready(function () {
        var attach_file_check = $('#attach_file_check');
        var test_data_check = $('#test_data_check');

        if (window.csgSwitch) {
            ['attach_file_check', 'test_data_check'].forEach(function (id) {
                var el = document.getElementById(id);
                if (el && el.dataset.csgInitialized !== 'true') {
                    window.csgSwitch.initSwitch(el);
                }
            });
        }

        if (window.zipPkgContestCidSuggest && typeof window.zipPkgContestCidSuggest.init === 'function') {
            var sugUrl = window.PROBLEM_EXPORT_CONTEST_SUGGEST_URL || '';
            if (sugUrl) {
                window.zipPkgContestCidSuggest.init({
                    inputSelector: '#ex_cid',
                    suggestBoxSelector: '#ex_cid_suggest',
                    feedbackSelector: '',
                    suggestUrl: sugUrl,
                    precheckUrl: '',
                    closeNs: 'problemExportZip',
                });
            }
        }

        if (typeof createProblemInput !== 'undefined') {
            var problemInput = createProblemInput('problem_export_input', {
                max: 30,
                allowDuplicates: false,
                allowInvalid: false,
                showCount: false,
                showActions: true,
                uiVariant: 'compact',
                showLabel: false,
                showHelpText: false,
                inputPlaceholder: '题号，回车/逗号…',
                onChange: function (csv) {
                    $('#pid_list').val(csv);
                },
            });
            window.onProblemSelectionConfirm = function (problemIds) {
                problemInput.addProblems(problemIds);
            };
        }

        if (typeof window.FormValidationTip === 'undefined') {
            console.error('FormValidationTip not loaded');
            return;
        }

        window.FormValidationTip.initCommonFormValidation(
            '#problem_export_form',
            {
                start_pid: {
                    rules: {
                        number: true,
                        custom: [
                            function (value) {
                                if (!value || value.trim() === '') return true;
                                var num = Number(value);
                                return /^\d{1,10}$/.test(value) && num >= 1000;
                            },
                        ],
                    },
                    messages: {
                        number: window.FormValidationTip.createBilingualMessage('请输入有效的数字', 'Please enter a valid number'),
                        custom: window.FormValidationTip.createBilingualMessage(
                            '题目ID应该是1000以上的有限正整数',
                            'Problem ID should be a limited Positive integer >= 1000'
                        ),
                    },
                },
                end_pid: {
                    rules: { number: true },
                    messages: {
                        number: window.FormValidationTip.createBilingualMessage('请输入有效的数字', 'Please enter a valid number'),
                    },
                },
                pid_list: {
                    rules: {
                        custom: [
                            function (value) {
                                if (!value || value.trim() === '') return true;
                                return /^\d{1,10}(,\d{1,10}){0,20}$/.test(value.trim());
                            },
                        ],
                    },
                    messages: {
                        custom: window.FormValidationTip.createBilingualMessage(
                            '题目ID列表应该用逗号分隔，且为有限的正整数',
                            "Problem IDs should be separated by ',' and be limited Positive Integers"
                        ),
                    },
                },
                ex_cid: {
                    rules: {
                        custom: [
                            function (value) {
                                if (!value || value.trim() === '') return true;
                                return /^\d{1,10}$/.test(value.trim());
                            },
                        ],
                    },
                    messages: {
                        custom: window.FormValidationTip.createBilingualMessage(
                            '应该只提交一个比赛ID，且为有限的正整数',
                            'Should submit only one contest ID and should be a limited Positive Integer'
                        ),
                    },
                },
            },
            function (form) {
                var start_pid = Number($('#start_pid').val()) || 0;
                var end_pid = Number($('#end_pid').val()) || 0;
                var pid_list = $('#pid_list').val().trim();
                var ex_cid = $('#ex_cid').val().trim();

                if (end_pid === 0) end_pid = start_pid;

                if (start_pid === 0 && pid_list === '' && ex_cid === '') {
                    alerty.alert('需要输入三种方式中的一种', 'Need to input one of the three types');
                    return false;
                }

                if (start_pid !== 0) {
                    if (!/^\d{1,10}$/.test(String(start_pid))) {
                        alerty.alert('题目ID应该是有限的正整数', 'Problem ID should be a limited Positive integer');
                        return false;
                    }

                    if (end_pid - start_pid > 30) {
                        alerty.alert(
                            '建议不要一次性导出这么多题目（超过30个）',
                            "You'd better not export so many problems once (more than 30)"
                        );
                        return false;
                    }

                    var testDataChecked = test_data_check[0] ? test_data_check[0].checked : false;
                    var attachFileChecked = attach_file_check[0] ? attach_file_check[0].checked : false;

                    if (end_pid - start_pid > 30 && (testDataChecked || attachFileChecked)) {
                        alerty.alert('包含相关文件时，不能导出这么多题目', 'Together with related files, you cannot export so many problems');
                        return false;
                    }

                    if (end_pid < start_pid) {
                        alerty.alert('结束题目ID应该大于起始题目ID', 'End problem ID should be bigger than start problem ID');
                        return false;
                    }

                    SubmitExport(form);
                } else if (pid_list !== '') {
                    var pidArray = pid_list.split(/[,\s]+/).filter(function (p) {
                        return p.trim() !== '';
                    });
                    if (pidArray.length === 0) {
                        alerty.alert('请输入至少一个题目ID', 'Please enter at least one Problem ID');
                        return false;
                    }
                    var invalidPids = pidArray.filter(function (pid) {
                        return !/^\d{1,10}$/.test(pid.trim());
                    });
                    if (invalidPids.length > 0) {
                        alerty.alert(
                            '题目ID列表包含无效的ID：' + invalidPids.join(', '),
                            'Problem ID list contains invalid IDs: ' + invalidPids.join(', ')
                        );
                        return false;
                    }
                    if (pidArray.length > 1000) {
                        alerty.alert('一次最多导出1000个题目', 'Maximum 1000 problems can be exported at once');
                        return false;
                    }
                    SubmitExport(form);
                } else if (ex_cid !== '') {
                    if (!/^\d{1,10}$/.test(ex_cid)) {
                        alerty.alert(
                            '应该只提交一个比赛ID，且为有限的正整数',
                            'Should submit only one contest ID and should be a limited Positive Integer'
                        );
                        return false;
                    }
                    SubmitExport(form);
                }

                return false;
            }
        );
    });

})();
