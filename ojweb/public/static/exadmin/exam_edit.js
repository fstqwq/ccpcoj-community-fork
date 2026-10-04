// 考试编辑页 JS（examsys/view/admin/contest_edit_examsys.php）
// 依赖：jQuery、alerty、FormValidationTip、CsgVditor、button_delay、ajaxSubmit（由 form_validate_tip.js 扩展）

(function(){
    'use strict';

    const submit_button = $('#submit_button');
    if(!submit_button.length) {
        throw new Error('Exam edit: #submit_button not found');
    }
    const submit_button_text = submit_button.text();
    const contest_edit_form = $('#contest_edit_form');
    if(!contest_edit_form.length) {
        throw new Error('Exam edit: #contest_edit_form not found');
    }

    const IS_EXADMIN_EXAM = ($('#tpl_is_exadmin_exam').val() === '1');
    const contest_edit_mode = ($('#tpl_is_edit').val() === '1') ? 1 : 0;
    const can_write = ($('#tpl_can_write').val() === '1');

    function setReadonlyUI() {
        // 禁止提交（但保留按钮，避免其它逻辑找不到元素）
        submit_button.attr('disabled', true);
        submit_button.text('只读 / Read-only');
        // 禁用所有输入控件
        $('#contest_edit_form').find('input,select,textarea,button').each(function() {
            const $el = $(this);
            if ($el.attr('id') === 'submit_button') return;
            if ($el.attr('id') === 'upload_file_button') return;
            // 允许“复制”入口是单独页面，当前页仅禁用表单控件
            $el.prop('disabled', true);
        });
        // 禁用 Vditor 容器交互（只读查看）
        $('#description_editor_container, #notification_editor_container').css('pointer-events', 'none').css('opacity', '0.85');
        alerty.warn({
            message: '当前为只读查看：你可以复制该考试，但不可直接修改。',
            message_en: 'Read-only: you can copy this exam, but cannot modify it directly.'
        });
    }

    // 初始化 Vditor 编辑器
    let descriptionEditor = null;
    let notificationEditor = null;

    $(document).ready(function() {
        if (!can_write && contest_edit_mode === 1) {
            // 只读模式：仍然初始化编辑器用于渲染，但不允许提交/修改
            // 后续初始化完成后再统一禁用控件
        }

        // 初始化考试说明 Vditor 编辑器（所有依赖已全局引入）
        const descriptionInitialValue = $('#input_description').val() || '';
        descriptionEditor = CsgVditor.createEditor({
            el: '#description_editor_container',
            value: descriptionInitialValue,
            height: 400,
            onChange: function(md) {
                // 实时同步到隐藏的 textarea，用于表单提交
                $('#input_description').val(md || '');
            },
            options: {
                toolbarConfig: { pin: true },
                cache: { enable: false },
                preview: { delay: 300 },
            }
        });

        if (!descriptionEditor) {
            const errorMsg = 'Failed to create description Vditor editor instance.';
            console.error(errorMsg);
            alerty.error({
                message: '考试说明编辑器初始化失败，请刷新页面重试',
                message_en: 'Description editor initialization failed, please refresh the page'
            });
            throw new Error(errorMsg);
        }

        // 初始化公告 Vditor 编辑器（所有依赖已全局引入）
        const notificationInitialValue = $('#input_notification').val() || '';
        notificationEditor = CsgVditor.createEditor({
            el: '#notification_editor_container',
            value: notificationInitialValue,
            height: 400,
            onChange: function(md) {
                // 实时同步到隐藏的 textarea，用于表单提交
                $('#input_notification').val(md || '');
            },
            options: {
                toolbarConfig: { pin: true },
                cache: { enable: false },
                preview: { delay: 300 },
            }
        });

        if (!notificationEditor) {
            const errorMsg = 'Failed to create notification Vditor editor instance.';
            console.error(errorMsg);
            alerty.error({
                message: '公告编辑器初始化失败，请刷新页面重试',
                message_en: 'Notification editor initialization failed, please refresh the page'
            });
            throw new Error(errorMsg);
        }

        if (typeof window.CsgContestEditTimeTzInit === 'function') {
            window.CsgContestEditTimeTzInit();
        }

        if (!can_write && contest_edit_mode === 1) {
            setReadonlyUI();
            return;
        }

        // 使用 FormValidationTip 进行表单验证（所有依赖已全局引入）
        const fieldConfigs = IS_EXADMIN_EXAM ? {
            title: { rules: { required: true, maxlength: 200 } },
            teachers: {
                rules: {
                    maxlength: 200,
                    custom: [
                        function(value) {
                            if (value === '') return true; // 允许为空
                            if (!/^[a-zA-Z0-9_,]+$/.test(value)) return false;
                            const teachers = value.split(',').filter(function(t) { return t.trim() !== ''; });
                            return teachers.length <= 10;
                        }
                    ]
                },
                messages: {
                    custom: FormValidationTip.createBilingualMessage(
                        '只能输入数字、字母、下划线和英文逗号，且逗号分隔的人数不能超过10个',
                        'Only numbers, letters, underscores and commas are allowed, and no more than 10 comma-separated user IDs'
                    )
                }
            },
            description: { rules: { maxlength: 16384 } },
            notification: { rules: { maxlength: 16384 } }
        } : {
            description: { rules: { maxlength: 16384 } },
            notification: { rules: { maxlength: 16384 } }
        };

        FormValidationTip.initFormValidation('#contest_edit_form', fieldConfigs, function(form) {
            // 在提交前同步 Vditor 内容到隐藏的 textarea
            if (descriptionEditor && descriptionEditor.getValue) {
                try {
                    const md = descriptionEditor.getValue();
                    $('#input_description').val(md || '');
                } catch (e) {
                    console.warn('Failed to get description Vditor value:', e);
                }
            }
            if (notificationEditor && notificationEditor.getValue) {
                try {
                    const md = notificationEditor.getValue();
                    $('#input_notification').val(md || '');
                } catch (e) {
                    console.warn('Failed to get notification Vditor value:', e);
                }
            }

            const doAjaxSubmit = function() {
                try {
                    if (typeof window.CsgContestEditFlushLocalTimesToAppBeforeSubmit === 'function') {
                        window.CsgContestEditFlushLocalTimesToAppBeforeSubmit();
                    }
                } catch (eTz) { /* ignore */ }
                submit_button.attr('disabled', true);
                submit_button.text('Waiting...');
                $(form).ajaxSubmit({
                    success: function(ret) {
                        if(ret['code'] == 1) {
                            if(typeof(ret['data']['alert']) != 'undefined' && ret['data']['alert'] == true){
                                alerty.alert(ret['msg']);
                            } else {
                                alerty.success(ret['msg']);
                            }
                            button_delay(submit_button, 3, submit_button_text);
                            if(contest_edit_mode != 1) {
                                setTimeout(function(){location.href='contest_edit?id='+ret['data']['id']}, 500);
                            }
                        } else {
                            alerty.alert(ret['msg']);
                            button_delay(submit_button, 3, submit_button_text);
                        }
                        try {
                            if (typeof window.CsgContestEditTimeTzInit === 'function') {
                                window.CsgContestEditTimeTzInit();
                            }
                        } catch (eTz) { /* ignore */ }
                        return false;
                    },
                    error: function() {
                        try {
                            if (typeof window.CsgContestEditTimeTzInit === 'function') {
                                window.CsgContestEditTimeTzInit();
                            }
                        } catch (eTz2) { /* ignore */ }
                    }
                });
            };

            // exadmin/exam：添加/复制模式下提交前必须已选择至少一道题
            if (IS_EXADMIN_EXAM && contest_edit_mode !== 1) {
                const questionJsonRaw = $('#question_json_text_real').val();
                let questionData = null;
                try {
                    questionData = questionJsonRaw ? JSON.parse(questionJsonRaw) : null;
                } catch (e) {
                    questionData = null;
                }
                if (!questionData || typeof questionData !== 'object' || Object.keys(questionData).length === 0) {
                    alerty.alert({
                        message: '请至少添加一道题目。',
                        message_en: 'Please add at least one question.'
                    });
                    return false;
                }
                let questionCount = 0;
                for (const pkind in questionData) {
                    if (Object.prototype.hasOwnProperty.call(questionData, pkind) && Array.isArray(questionData[pkind])) {
                        questionCount += questionData[pkind].length;
                    }
                }
                if (questionCount < 1) {
                    alerty.alert({
                        message: '请至少添加一道题目。',
                        message_en: 'Please add at least one question.'
                    });
                    return false;
                }
            }

            // exadmin/exam：提交前检查题目配置基础分是否为 100；不满足则 confirm 后再提交
            if (IS_EXADMIN_EXAM) {
                if (typeof totalScore === 'undefined' || typeof attachScore === 'undefined' || typeof has_attach_pro === 'undefined') {
                    throw new Error('Score variables missing: totalScore/attachScore/has_attach_pro');
                }
                const baseScore = has_attach_pro ? (totalScore - attachScore) : totalScore;
                if (baseScore !== 100) {
                    const diff = baseScore - 100;
                    const abs = Math.abs(diff);
                    const cn = diff < 0 ? `基础分不足100（少${abs}）` : `基础分超过100（多${abs}）`;
                    const en = diff < 0 ? `Base score < 100 (missing ${abs})` : `Base score > 100 (exceed ${abs})`;
                    alerty.confirm({
                        message: `${cn}<br/>确认提交？<br/><span class="en-text">${en}. Continue?</span>`,
                        callback: function() {
                            doAjaxSubmit();
                        }
                    });
                    return false;
                }
            }

            doAjaxSubmit();
            return false;
        }, { scrollToFirstError: true });

        // 为 input_teachers 添加实时输入验证（仅 exadmin/exam 页面存在该输入框）
        if (IS_EXADMIN_EXAM) $('#input_teachers').on('input', function() {
            const value = $(this).val();
            const filteredValue = value.replace(/[^a-zA-Z0-9_,]/g, ''); // 过滤非法字符

            if (value !== filteredValue) {
                $(this).val(filteredValue);
                FormValidationTip.showFieldError(this, FormValidationTip.createBilingualMessage(
                    '只能输入数字、字母、下划线和英文逗号',
                    'Only numbers, letters, underscores and commas are allowed'
                ));
                setTimeout(function() {
                    FormValidationTip.clearFieldError($('#input_teachers')[0]);
                }, 2000);
            }

            // 检查人数限制
            if (filteredValue !== '') {
                const teachers = filteredValue.split(',').filter(function(teacher) {
                    return teacher.trim() !== '';
                });

                if (teachers.length > 10) {
                    FormValidationTip.showFieldError(this, FormValidationTip.createBilingualMessage(
                        '逗号分隔的人数不能超过10个，当前：' + teachers.length + '个',
                        'No more than 10 comma-separated user IDs allowed, current: ' + teachers.length
                    ));
                } else {
                    FormValidationTip.clearFieldError(this);
                }
            } else {
                FormValidationTip.clearFieldError(this);
            }
        });
    });

    // Ctrl+S 快捷键触发保存
    $(window).keydown(function(e) {
        if (e.keyCode == 83 && e.ctrlKey) {
            e.preventDefault();
            const a = document.createEvent("MouseEvents");
            a.initEvent("click", true, true);
            $('#submit_button')[0].dispatchEvent(a);
        }
    });
})();
