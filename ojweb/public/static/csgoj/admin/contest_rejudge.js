/**
 * 比赛重判管理 JavaScript
 * Contest Rejudge Management JavaScript
 */

/**
 * 初始化重判表单
 */
function InitContestRejudgeForm() {
    const form = document.getElementById('problem_rejudge_form');
    const submitButton = form.querySelector('button[type="submit"]');
    const configEl = document.getElementById('contest_rejudge_config');
    if (configEl && configEl.dataset) {
        const d = configEl.dataset;
        window.rejudgeConfig = window.contestRejudgeConfig = {
            module: d.module || '',
            contest_id: d.contestId || '',
            submit_url: d.submitUrl || '',
            problem_id_mode: d.problemIdMode || 'alphabet',
            contest_title: (d.contestTitle != null && d.contestTitle !== '') ? d.contestTitle : ''
        };
    }
    const problemIdMode = (window.contestRejudgeConfig && window.contestRejudgeConfig.problem_id_mode) ? window.contestRejudgeConfig.problem_id_mode : 'alphabet';
    
    if (!form || !submitButton) {
        console.warn('Contest rejudge form elements not found');
        return;
    }
    
    // 从 anchor 参数读取 solution_id 并填入表单
    const solutionIdInput = form.querySelector('#solution_id');
    if (solutionIdInput) {
        const solutionIdFromAnchor = csg.GetAnchor('solution_id');
        if (solutionIdFromAnchor !== null && solutionIdFromAnchor !== '') {
            solutionIdInput.value = solutionIdFromAnchor;
        }
    }

    // 字段配置
    const fieldConfigs = {
        solution_id: { 
            rules: { maxlength: 256 },
            messages: {
                maxlength: '提交号长度不能超过256个字符 (Solution ID cannot exceed 256 characters)'
            }
        },
        problem_id: { 
            rules: { maxlength: 256 },
            messages: {
                maxlength: '题号长度不能超过256个字符 (Problem ID cannot exceed 256 characters)'
            }
        }
    };

    // 获取按语言重判的已选语言（原生 form-select multiple 的 selectedOptions）
    function getSelectedLanguageIds(form) {
        const sel = form.querySelector('#rejudge_language_ids');
        if (!sel || !sel.multiple) return [];
        return Array.from(sel.selectedOptions || []).map(function (o) { return o.value; }).filter(Boolean);
    }

    // 提交处理函数
    function handleRejudgeSubmit(form) {
        const solutionId = form.querySelector('#solution_id').value.trim();
        const problemId = form.querySelector('#problem_id').value.trim();
        const acCheckbox = form.querySelector('#rejudge_res_check_ac');
        const selectedLangIds = getSelectedLanguageIds(form);
        
        let acAlertMessage = '';
        if (acCheckbox && acCheckbox.checked) {
            acAlertMessage = '<strong class="text-danger">请慎重重判AC的提交，确认？</strong><br/><span class="en-text">Please confirm rejudging AC submissions carefully?</span>';
        }

        // 验证输入
        if (solutionId.length > 0 && problemId.length > 0) {
            alerty.alert({
                message: '在提交号与题号中只选择其中一项填写',
                message_en: 'Please clear one input either solution_id or problem_id'
            });
            return false;
        } else if (solutionId.length > 0) {
            if (!/^[0-9,]+$/.test(solutionId)) {
                alerty.alert({
                    message: '提交号格式不正确',
                    message_en: 'Solution ID format is not valid'
                });
                return false;
            }
            
            if (acAlertMessage) {
                alerty.confirm({
                    message: acAlertMessage,
                    callback: () => submitRejudgeForm(form)
                });
            } else {
                submitRejudgeForm(form);
            }
        } else if (problemId.length > 0) {
            if (problemIdMode === 'exam_qid') {
                // examsys：Qid（支持 Q1,Q2... 或 1,2...，允许逗号与空格）
                if (!/^([Qq]?\d+)(\s*,\s*[Qq]?\d+)*$/.test(problemId)) {
                    alerty.alert({
                        message: '考试中请使用 Qid 题号（如 Q1,Q2 或 1,2）',
                        message_en: 'In exam mode, please use Qid (e.g. Q1,Q2 or 1,2)'
                    });
                    return false;
                }
            } else {
                // 传统比赛：字母题号 A,B,C...
                if (!/^[A-Za-z,]+$/.test(problemId)) {
                    alerty.alert({
                        message: '比赛中请使用字母题号',
                        message_en: 'Problem ID in contest should be in alphabet type'
                    });
                    return false;
                }
            }
            
            const confirmMessage = acAlertMessage + 
                '<br/><strong class="text-warning">基于题号评测时间较久，确认？</strong><br/><span class="en-text">Rejudge by problem_id may take a long time, sure to rejudge?</span>';
            
            alerty.confirm({
                message: confirmMessage,
                callback: () => submitRejudgeForm(form),
            });
        } else {
            // 提交号与题号都为空：仅支持按语言重判，须至少选一种语言，且需用户输入比赛ID-比赛标题确认
            if (selectedLangIds.length === 0) {
                alerty.error({
                    message: '提交号与题号都为空时，请至少选择一种语言进行重判',
                    message_en: 'When both solution ID and problem ID are empty, please select at least one language.'
                });
                return false;
            }
            const config = window.contestRejudgeConfig || {};
            const contestId = config.contest_id || '';
            const contestTitle = config.contest_title != null ? String(config.contest_title) : '';
            const confirmText = contestId + '-' + contestTitle;
            const confirmTextEscaped = (confirmText || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
            alerty.prompt({
                title: '确认整场按语言重判 <span class="en-text">Confirm Full Contest Rejudge by Language</span>',
                message: '<div class="alert alert-danger mb-0">此操作将按所选语言重判本场比赛全部提交。请将下方内容<strong>完整输入</strong>到输入框以确认：<code class="user-select-all d-block mt-1 p-2 bg-white bg-opacity-75 rounded">' + confirmTextEscaped + '</code></div>',
                message_en: 'This will rejudge all submissions of the selected language(s) in this contest. Enter the content below exactly to confirm:',
                defaultValue: '',
                placeholder: '请输入上方 比赛ID-比赛标题',
                callbackConfirm: function (ev, value) {
                    const trimmed = (value || '').trim();
                    if (trimmed === '') {
                        return { keepOpen: true, tip: '输入不能为空' };
                    }
                    if (trimmed !== confirmText) {
                        return { keepOpen: true, tip: '输入与比赛ID-比赛标题不一致，请重新输入' };
                    }
                    submitRejudgeForm(form);
                    return true;
                }
            });
            return false;
        }
        
        return false;
    }

    // 提交重判表单
    async function submitRejudgeForm(form) {
        submitButton.disabled = true;
        const originalText = submitButton.innerHTML;
        // 双语按钮 loading：仅 .cn-text + .en-text，勿在 span 外追加裸文本（会破坏 bilingual.css 网格）
        submitButton.innerHTML = '<span class="cn-text"><i class="bi bi-hourglass-split me-2"></i>重判中</span><span class="en-text">Rejudging</span>';

        const formData = new FormData(form);
        
        try {
            const data = await csg.post({
                url: window.contestRejudgeConfig.submit_url,
                data: formData,
                contentType: null, // FormData 不设置 Content-Type，让浏览器自动处理
                dtype: 'json'
            });
            
            if (data.code === 1) {
                alerty.success({
                    message: data.msg || '重判已开始',
                    message_en: 'Rejudge started successfully'
                });

                const statusUrl = (typeof data.data === 'string' && data.data)
                    ? data.data
                    : (data.data && data.data.jumpurl ? data.data.jumpurl : '');
                const openWinEl = document.getElementById('open_status_window_check');
                if (statusUrl && openWinEl && openWinEl.checked) {
                    setTimeout(() => {
                        window.open(statusUrl);
                    }, 300);
                }
            } else {
                alerty.error({
                    message: data.msg || '重判失败',
                    message_en: 'Rejudge failed'
                });
            }
        } catch (error) {
            console.error('Rejudge error:', error);
            alerty.error({
                message: '网络错误，请重试',
                message_en: 'Network error, please try again'
            });
        } finally {
            setTimeout(() => {
                submitButton.disabled = false;
                submitButton.innerHTML = originalText;
            }, 3000);
        }
    }

    // 所有依赖已全局引入，直接使用 FormValidationTip
    FormValidationTip.initFormValidation('#problem_rejudge_form', fieldConfigs, handleRejudgeSubmit);

    // 键盘快捷键 (Ctrl+S)
    document.addEventListener('keydown', function(e) {
        if (e.keyCode === 83 && e.ctrlKey) {
            e.preventDefault();
            submitButton.click();
        }
    });
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', function() {
    if (window.contestRejudgeConfig) {
        InitContestRejudgeForm();
    }
});
