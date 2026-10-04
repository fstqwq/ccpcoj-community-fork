/**
 * 考试/比赛登录页面 JavaScript
 * 统一处理考试登录和比赛密码验证
 */

// 防止重复初始化
if (window.contestAuthIndexInitialized) {
    console.warn('contest_auth_index.js already initialized, skipping...');
} else {
    window.contestAuthIndexInitialized = true;

    // 等待DOM加载完成
    document.addEventListener('DOMContentLoaded', function() {
        initExamAuthForm();
        initContestTeamAuthForm();
        initContestPasswordlessLogin();
        initContestPassAuthForm();
    });
}

/**
 * 将 fieldConfig 转换为规则数组（供 validateField 使用）
 * @param {Object} fieldConfig - 字段配置对象 {rules: {...}, messages: {...}}
 * @param {HTMLElement} element - 表单元素（用于获取字段标签）
 * @returns {Array} 规则数组
 */
function convertFieldConfigToRules(fieldConfig, element) {
    if (!fieldConfig || !fieldConfig.rules) {
        return [];
    }
    
    const rules = [];
    Object.keys(fieldConfig.rules).forEach(ruleName => {
        const ruleValue = fieldConfig.rules[ruleName];
        const params = Array.isArray(ruleValue) ? ruleValue : [ruleValue];
        
        // 优先使用自定义消息，否则生成默认消息
        let message;
        if (fieldConfig.messages && fieldConfig.messages[ruleName]) {
            message = fieldConfig.messages[ruleName];
        } else {
            // 尝试从字段的placeholder或name获取字段标签
            let fieldLabel = '';
            if (element) {
                const placeholder = element.getAttribute('placeholder');
                if (placeholder) {
                    const match = placeholder.match(/^([^<]+)/);
                    if (match) {
                        fieldLabel = match[1].trim();
                    }
                }
            }
            if (window.FormValidationTip && window.FormValidationTip.generateDefaultMessage) {
                message = window.FormValidationTip.generateDefaultMessage(ruleName, params, fieldLabel);
            } else {
                message = `${fieldLabel || '此字段'}验证失败`;
            }
        }
        
        rules.push({
            rule: ruleName,
            params: params,
            message: message
        });
    });
    
    return rules;
}

/**
 * 初始化考试认证表单
 */
function initExamAuthForm() {
    const contestAuthForm = document.getElementById('contest_auth_form');
    if (!contestAuthForm) {
        return; // 如果没有表单，直接返回
    }

    const config = window.EXAM_AUTH_CONFIG || {};
    const cid = config.cid || document.getElementById('cid_input')?.value;
    const authTypeUrl = config.authTypeUrl || '/examsys/contest/team_auth_type_ajax';
    const authUrl = config.authUrl || '/examsys/contest/contest_auth_ajax';
    const systemStatusUrl = config.systemStatusUrl || '/examsys/contest/system_login_status_ajax';

    const teamIdInput = document.getElementById('cpc_team_id');
    const passwordRow = document.getElementById('cpc_password_row');
    const passwordInput = document.getElementById('cpc_password');
    const submitButton = document.getElementById('submit_button_clogin');

    if (!teamIdInput || !passwordRow || !passwordInput || !submitButton) {
        return;
    }

    let lastCheckedTeamId = null;
    let lastAuthResult = null;

    // 防抖函数
    function debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    // 更新密码提示文字
    function updatePasswordHint(chinese, english, type = 'info') {
        const hint = document.getElementById('password_hint');
        if (hint) {
            const iconClass = type === 'success' ? 'bi-check-circle text-success' : 
                             type === 'warning' ? 'bi-exclamation-circle text-warning' : 
                             'bi-info-circle text-info';
            hint.innerHTML = `
                <i class="bi ${iconClass}"></i>
                <span>${chinese}<span class="en-text">${english}</span></span>
            `;
        }
    }

    function showSystemLoginHint() {
        if (errorAlertContainer) {
            errorAlertContainer.innerHTML = `
                <div class="alert alert-success fade show d-flex align-items-center mb-0" role="alert">
                    <i class="bi bi-check-circle-fill me-2"></i>
                    <div class="flex-grow-1 bilingual-inline">
                        检测到系统账号，无需密码即可登录
                        <span class="en-text">System account detected, no password required</span>
                    </div>
                </div>
            `;
            errorAlertContainer.style.display = 'block';
        }
    }

    // 显示“需要先登录系统账号”的提示（不自动隐藏，直到用户修改输入或成功）
    function showNeedSystemLoginHint(teamId) {
        if (!errorAlertContainer) return;
        errorAlertContainer.innerHTML = `
            <div class="alert alert-warning d-flex align-items-center" role="alert">
                <i class="bi bi-exclamation-circle-fill me-2"></i>
                <div class="flex-grow-1 bilingual-inline">
                    <span class="zh-text">该账号启用了“系统密码”模式：请先在左侧登录系统<span class="auth-hint-keep-together">账号 <strong>${teamId || ''}</strong></span>，再回来点击“一键登录”</span>
                    <span class="en-text">This account uses System Password mode. Please login the system <span class="auth-hint-keep-together">account <strong>${teamId || ''}</strong></span> on the left panel first, then come back and click “One-click Login”.</span>
                </div>
            </div>
        `;
        errorAlertContainer.style.display = 'block';
    }

    // 显示“系统账号不匹配”的提示
    function showSystemLoginMismatchHint(teamId, currentUser) {
        if (!errorAlertContainer) return;
        errorAlertContainer.innerHTML = `
            <div class="alert alert-warning d-flex align-items-start" role="alert">
                <i class="bi bi-exclamation-circle-fill me-2 mt-1" style="flex-shrink: 0;"></i>
                <div class="flex-grow-1">
                    <div>当前系统已登录账号为 <strong>${currentUser || ''}</strong>，但该考生要求系统账号 <strong>${teamId || ''}</strong>。请先切换系统账号后再回来一键登录。</div>
                    <div class="en-text" style="margin-top: 0.25rem; font-size: 0.9em; opacity: 0.85;">You are logged in as <strong>${currentUser || ''}</strong>, but this examinee requires <strong>${teamId || ''}</strong>. Please switch system account first, then come back for one-click login.</div>
                </div>
            </div>
        `;
        errorAlertContainer.style.display = 'block';
    }

    async function checkSystemLoginStatus(teamId) {
        const rep = await csg.get(systemStatusUrl, { cid: cid, team_id: teamId });
        if (!rep || rep.code !== 1) {
            return { logged_in: 0, user_id: '', match: 0 };
        }
        return rep.data || { logged_in: 0, user_id: '', match: 0 };
    }

    const checkAuthType = debounce(async function(teamId) {
        if (teamId === lastCheckedTeamId) {
            return;
        }
        if (!teamId || teamId.length < 3) {
            lastCheckedTeamId = null;
            lastAuthResult = null;
            passwordInput.classList.add('password-waiting');
            passwordInput.classList.remove('password-disabled');
            passwordInput.disabled = false;
            passwordInput.placeholder = '密码 / Password';
            updatePasswordHint('请输入用户名（至少3个字符）', 'Please enter username (at least 3 characters)', 'info');
            return;
        }

        try {
            const ret = await csg.get(authTypeUrl, { cid: cid, team_id: teamId });
            
            if (ret === '[SYS_PASS]') {
                const formContainer = contestAuthForm.closest('.exam-auth-container');
                if (formContainer) {
                    formContainer.style.minHeight = formContainer.offsetHeight + 'px';
                }

                passwordRow.style.display = 'none';
                passwordInput.classList.remove('password-waiting');
                passwordInput.classList.add('password-disabled');
                passwordInput.disabled = true;
                passwordInput.value = '';
                passwordInput.required = false;

                const userPanel = document.getElementById('user_panel');
                if (userPanel) {
                    userPanel.style.display = '';
                    if (lastAuthResult !== 'system_need_login' && lastAuthResult !== 'system_mismatch' && lastAuthResult !== 'system_login_ok') {
                        userPanel.classList.add('panel-highlight');
                        setTimeout(() => userPanel.classList.remove('panel-highlight'), 800);
                    }
                }

                const st = await checkSystemLoginStatus(teamId);
                const loggedIn = Number(st.logged_in) === 1;
                const match = Number(st.match) === 1;

                if (!loggedIn) {
                    submitButton.disabled = true;
                    submitButton.innerHTML = '<span class="cn-text">请先登录系统账号（非本场考试内的账号）</span><span class="en-text">Login System First (not the account for this exam)</span>';
                    showNeedSystemLoginHint(teamId);
                    updatePasswordHint('系统密码模式：请先登录系统账号（非本场考试内的账号）', 'System password mode: please login system account first (not the account for this exam)', 'warning');
                    lastAuthResult = 'system_need_login';
                } else if (!match) {
                    submitButton.disabled = true;
                    submitButton.innerHTML = '<span class="cn-text">系统账号不匹配</span><span class="en-text">Account Mismatch</span>';
                    showSystemLoginMismatchHint(teamId, st.user_id || '');
                    updatePasswordHint('系统账号不匹配，请切换账号', 'System account mismatch, please switch account', 'warning');
                    lastAuthResult = 'system_mismatch';
                } else {
                    submitButton.disabled = false;
                    submitButton.innerHTML = '<span class="cn-text">一键登录</span><span class="en-text">One-click Login</span>';
                    showSystemLoginHint();
                    updatePasswordHint('系统密码模式：可一键登录', 'System password mode: one-click login available', 'success');

                    if (lastAuthResult !== 'system_login_ok') {
                        submitButton.classList.add('btn-auth-ready');
                        setTimeout(() => submitButton.classList.remove('btn-auth-ready'), 1200);
                    }
                    lastAuthResult = 'system_login_ok';
                }

                setTimeout(() => {
                    if (formContainer) {
                        formContainer.style.transition = 'min-height 0.3s ease';
                        formContainer.style.minHeight = '';
                        setTimeout(() => { formContainer.style.transition = ''; }, 300);
                    }
                }, 50);
            } else {
                passwordRow.style.display = '';
                passwordInput.classList.remove('password-waiting', 'password-disabled');
                passwordInput.disabled = false;
                passwordInput.value = '';
                passwordInput.required = true;
                passwordInput.placeholder = '请输入密码 / Please enter password';
                
                updatePasswordHint('请输入密码', 'Please enter password', 'success');
                
                submitButton.innerHTML = '<span class="cn-text">登录考试</span><span class="en-text">Login Exam</span>';
                submitButton.disabled = false;
                
                const userPanel = document.getElementById('user_panel');
                if (userPanel) {
                    userPanel.style.display = 'none';
                }
                
                if (document.activeElement === passwordInput) {
                    passwordInput.focus();
                }
                lastAuthResult = 'password';
            }
            lastCheckedTeamId = teamId;
        } catch (error) {
            console.error('Failed to check auth type:', error);
            passwordInput.classList.add('password-waiting');
            lastCheckedTeamId = null;
            lastAuthResult = null;
        }
    }, 500);

    // 用户名输入时实时检测（使用 input 事件而不是 change）
    teamIdInput.addEventListener('input', function() {
        const teamId = this.value.trim();
        // 用户开始输入时，清除错误提示，允许后续检测
        hideFormError();
        checkAuthType(teamId);
    });

    teamIdInput.addEventListener('blur', function() {
        const teamId = this.value.trim();
        if (teamId && teamId !== lastCheckedTeamId && !isFormErrorVisible()) {
            checkAuthType(teamId);
        }
    });

    teamIdInput.addEventListener('input', function() {
        if (!this.value.trim()) {
            lastCheckedTeamId = null;
            lastAuthResult = null;
            passwordRow.style.display = '';
            passwordInput.classList.remove('password-waiting', 'password-disabled');
            passwordInput.disabled = false;
            passwordInput.value = '';
            passwordInput.required = true;
            passwordInput.placeholder = '密码 / Password';
            passwordInput.classList.add('password-waiting');
            updatePasswordHint('先输入用户名，自动检测登录模式', 'Enter username first, auto-detect login mode', 'info');
            
            submitButton.innerHTML = '<span class="cn-text">登录考试</span><span class="en-text">Login Exam</span>';
            submitButton.disabled = false;
            
            const userPanel = document.getElementById('user_panel');
            if (userPanel) {
                userPanel.style.display = 'none';
            }

            hideFormError();
        }
    });

    // 创建统一的错误提示区域（在表单上方）
    const errorAlertContainer = document.getElementById('exam_auth_error_alert');
    
    // 创建双语验证消息
    function createBilingualMessage(chineseMsg, englishMsg) {
        return `${chineseMsg}<span class="en-text"> ${englishMsg}</span>`;
    }

    /**
     * 显示字段错误（使用 Bootstrap Tooltip）- 复用登录页面的方式
     * 密码框用 bottom 避免气泡遮挡上方用户名输入框
     */
    function showFieldError(element, message) {
        element.classList.remove('is-valid');
        element.classList.add('is-invalid');
        
        if (typeof bootstrap !== 'undefined' && bootstrap.Tooltip) {
            const existingTooltip = bootstrap.Tooltip.getInstance(element);
            if (existingTooltip) {
                existingTooltip.dispose();
            }
            const placement = (element.id === 'cpc_password' || element.name === 'password') ? 'bottom' : 'top';
            new bootstrap.Tooltip(element, {
                title: message,
                placement: placement,
                trigger: 'manual',
                html: true,
                customClass: 'login-tooltip-error'
            });
            const tooltip = bootstrap.Tooltip.getInstance(element);
            if (tooltip) {
                tooltip.show();
            }
        }
    }

    /**
     * 清除字段错误 - 复用登录页面的方式
     */
    function clearFieldError(element) {
        element.classList.remove('is-invalid');
        element.classList.add('is-valid');
        
        // 销毁 tooltip
        if (typeof bootstrap !== 'undefined' && bootstrap.Tooltip) {
            const tooltip = bootstrap.Tooltip.getInstance(element);
            if (tooltip) {
                tooltip.dispose();
            }
        }
    }

    /**
     * 显示统一错误提示（在表单上方）- 复用登录页面的方式
     * @param {string} message - 错误消息（可以是HTML）
     * @param {boolean} isMainReason - 是否为主要原因（true时作为主标题显示，false时作为副标题）
     */
    function showFormError(message, isMainReason = false) {
        if (!errorAlertContainer) return;
        
        // 改进UI：如果错误消息是主要原因（如"考试结束"），直接作为主标题显示
        // 否则显示"认证失败"作为主标题，错误消息作为副标题
        let alertContent;
        if (isMainReason) {
            // 主要原因：直接显示错误消息，使用更大的字体
            alertContent = `
                <div class="alert alert-danger alert-dismissible fade show" role="alert">
                    <div class="d-flex align-items-start">
                        <i class="bi bi-exclamation-triangle-fill me-2 mt-1" style="font-size: 1.25rem; flex-shrink: 0;"></i>
                        <div class="flex-grow-1">
                            <div class="fw-bold mb-1" style="font-size: 1.1em;">${message}</div>
                        </div>
                        <button type="button" class="btn-close ms-2" data-bs-dismiss="alert" aria-label="Close"></button>
                    </div>
                </div>
            `;
        } else {
            // 一般错误：显示"认证失败"作为主标题，错误消息作为副标题
            alertContent = `
                <div class="alert alert-danger alert-dismissible fade show" role="alert">
                    <div class="d-flex align-items-start">
                        <i class="bi bi-exclamation-triangle-fill me-2 mt-1" style="font-size: 1.25rem; flex-shrink: 0;"></i>
                        <div class="flex-grow-1">
                            <div class="fw-bold mb-1">认证失败</div>
                            <div class="text-muted small">${message}</div>
                        </div>
                        <button type="button" class="btn-close ms-2" data-bs-dismiss="alert" aria-label="Close"></button>
                    </div>
                </div>
            `;
        }
        
        errorAlertContainer.innerHTML = alertContent;
        errorAlertContainer.style.display = 'block';
        
        // 3秒后自动隐藏 - 与 login_out.js 完全一致
        setTimeout(() => {
            const alert = errorAlertContainer.querySelector('.alert');
            if (alert) {
                const bsAlert = new bootstrap.Alert(alert);
                bsAlert.close();
            }
        }, 3000);
    }

    /**
     * 检查错误提示是否正在显示
     */
    function isFormErrorVisible() {
        if (!errorAlertContainer) return false;
        return errorAlertContainer.style.display !== 'none' && 
               errorAlertContainer.innerHTML.trim() !== '';
    }

    /**
     * 隐藏统一错误提示
     */
    function hideFormError() {
        if (!errorAlertContainer) return;
        errorAlertContainer.style.display = 'none';
        errorAlertContainer.innerHTML = '';
    }

    // 表单验证配置
    const fieldConfigs = {
        team_id: {
            rules: {
                required: true,
                minlength: 3,
                maxlength: 20
            },
            messages: {
                required: createBilingualMessage('用户名不能为空', 'Username is required'),
                minlength: createBilingualMessage('用户名不能少于3个字符', 'Username must be at least 3 characters'),
                maxlength: createBilingualMessage('用户名不能超过20个字符', 'Username cannot exceed 20 characters')
            }
        },
        password: {
            rules: {
                required: true,
                minlength: 3,
                maxlength: 32
            },
            messages: {
                required: createBilingualMessage('密码不能为空', 'Password is required'),
                minlength: createBilingualMessage('密码不能少于3个字符', 'Password must be at least 3 characters'),
                maxlength: createBilingualMessage('密码不能超过32个字符', 'Password cannot exceed 32 characters')
            }
        }
    };

    // 错误类型映射表 - 根据 error_type 提供友好的提示信息
    const errorTypeMessages = {
        'already_logged_in': {
            chinese: '您已经登录，请刷新页面',
            english: 'Already logged in. Please refresh the page',
            isMainReason: true
        },
        'invalid_data': {
            chinese: '输入数据无效，请检查用户名',
            english: 'Invalid input data, please check username',
            isMainReason: false
        },
        'exam_ended': {
            chinese: '考试已结束，无法登录',
            english: 'Exam has ended, cannot login',
            isMainReason: true
        },
        'team_not_found': {
            chinese: '未找到该考生账号，请检查用户名是否正确',
            english: 'Examinee account not found, please check username',
            isMainReason: false
        },
        'ip_locked': {
            chinese: 'IP已锁定，请联系管理员解锁',
            english: 'IP locked, please contact administrator to unlock',
            isMainReason: true
        },
        'already_submitted': {
            chinese: '您已交卷，无法再次登录',
            english: 'You have already submitted the exam, cannot login again',
            isMainReason: true
        },
        'system_login_required': {
            chinese: '该账号使用系统密码模式，请先在左侧登录系统账号',
            english: 'This account uses system password mode, please login system account on the left first',
            isMainReason: false
        },
        'password_error': {
            chinese: '密码错误，请重新输入',
            english: 'Password incorrect, please try again',
            isMainReason: false
        }
    };

    // 提交处理函数
    async function handleExamAuthSubmit(form) {
        if (!submitButton) return false;

        // 禁用提交按钮防止重复提交
        submitButton.disabled = true;

        try {
            // 收集表单数据
            const formData = new FormData(form);
            const authData = {
                cid: formData.get('cid'),
                team_id: formData.get('team_id'),
                password: formData.get('password')
            };

            // 使用 util.js 封装的 csg.post 方法提交
            const ret = await csg.post(authUrl, authData, {}, 'json', 'form');

            if (ret && ret.code == 1) {
                // 登录成功
                alerty.success(ret.msg || '登录成功', 'Login successful');
                
                // 清理临时数据
                if (typeof ClearAsheetTmp === 'function') {
                    ClearAsheetTmp(parseInt(authData.cid), authData.team_id);
                }
                
                // 跳转
                setTimeout(function() {
                    if (ret.data && ret.data.redirect_url) {
                        location.href = ret.data.redirect_url;
                    } else {
                        location.reload();
                    }
                }, 1000);
            } else {
                // 登录失败 - 根据 error_type 显示友好的错误提示
                submitButton.disabled = false;
                const errorMsg = ret && ret.msg ? ret.msg : '认证失败';
                const errorType = ret && ret.data && ret.data.error_type ? ret.data.error_type : null;
                
                // 根据 error_type 获取对应的友好提示
                if (errorType && errorTypeMessages[errorType]) {
                    const errorInfo = errorTypeMessages[errorType];
                    showFormError(
                        createBilingualMessage(errorInfo.chinese, errorInfo.english),
                        errorInfo.isMainReason
                    );
                } else {
                    // 如果没有 error_type 或不在映射表中，使用原有逻辑
                    if (errorMsg.includes('结束') || errorMsg.includes('Ended') || errorMsg.includes('ended')) {
                        showFormError(createBilingualMessage(errorMsg, ''), true);
                    } else {
                        showFormError(createBilingualMessage('认证失败', errorMsg), false);
                    }
                }
            }
        } catch (error) {
            // 请求失败 - 显示统一错误提示
            submitButton.disabled = false;
            showFormError(createBilingualMessage('网络错误，请重试', 'Network error, please try again'));
            console.error('Exam auth request failed:', error);
        }

        return false;
    }

    // 为字段添加实时验证和 Tooltip - 复用登录页面的方式
    [teamIdInput, passwordInput].forEach(element => {
        if (!element) return;

        // 失去焦点时验证
        element.addEventListener('blur', function() {
            const fieldName = element.name;
            const fieldConfig = fieldConfigs[fieldName];
            // 所有依赖已全局引入，直接使用
            if (fieldConfig) {
                // 将 fieldConfig 转换为规则数组
                const rules = convertFieldConfigToRules(fieldConfig, element);
                const result = FormValidationTip.validateField(element, rules);
                if (!result.valid) {
                    showFieldError(element, result.message);
                } else {
                    clearFieldError(element);
                }
            }
        });

        // 输入时清除错误状态
        element.addEventListener('input', function() {
            if (element.classList.contains('is-invalid')) {
                clearFieldError(element);
                hideFormError();
            }
        });

        element.addEventListener('focus', function() {
            if (errorAlertContainer && errorAlertContainer.querySelector('.alert-success')) {
                return;
            }
            hideFormError();
        });
    });

    // 初始化表单验证 - 使用 FormValidationTip.initFormValidation，并传入自定义函数使用 Tooltip 显示错误（所有依赖已全局引入）
    FormValidationTip.initFormValidation('#contest_auth_form', fieldConfigs, handleExamAuthSubmit, {
            showFieldError: showFieldError,
            clearFieldError: clearFieldError,
            showFormAlert: showFormError
        });
}

/**
 * 初始化比赛账号登录表单（team_id + password，用于 cpcsys）
 */
function initContestTeamAuthForm() {
    const contestAuthForm = document.getElementById('contest_auth_form');
    if (!contestAuthForm) {
        return;
    }

    // 检查是否是比赛账号登录表单（有 team_id 和 password 字段，但没有 cpc_team_id）
    const teamIdInput = document.getElementById('cpc_team_id');
    const passwordInput = document.getElementById('cpc_password');
    const submitButton = document.getElementById('submit_contest_logon_button');
    
    // 如果已经有 exam auth form 处理了，跳过
    if (document.getElementById('submit_button_clogin')) {
        return;
    }

    if (!teamIdInput || !passwordInput || !submitButton) {
        return; // 不是比赛账号登录表单，跳过
    }

    const config = window.CONTEST_AUTH_CONFIG || {};
    const authUrl = config.authUrl || contestAuthForm.action;
    const cid = config.cid || document.querySelector('input[name="cid"]')?.value;

    // 创建统一的错误提示区域（在表单上方）
    let errorAlertContainer = document.getElementById('contest_auth_error_alert');
    if (!errorAlertContainer) {
        errorAlertContainer = document.createElement('div');
        errorAlertContainer.id = 'contest_auth_error_alert';
        errorAlertContainer.className = 'mb-2';
        errorAlertContainer.style.display = 'none';
        contestAuthForm.insertBefore(errorAlertContainer, contestAuthForm.firstChild);
    }

    // 创建双语验证消息
    function createBilingualMessage(chineseMsg, englishMsg) {
        return `${chineseMsg}<span class="en-text"> ${englishMsg}</span>`;
    }

    /**
     * 显示字段错误（使用 Bootstrap Tooltip）- 复用登录页面的方式
     */
    function showFieldError(element, message) {
        element.classList.remove('is-valid');
        element.classList.add('is-invalid');
        
        if (typeof bootstrap !== 'undefined' && bootstrap.Tooltip) {
            const existingTooltip = bootstrap.Tooltip.getInstance(element);
            if (existingTooltip) {
                existingTooltip.dispose();
            }
            
            new bootstrap.Tooltip(element, {
                title: message,
                placement: 'top',
                trigger: 'manual',
                html: true,
                customClass: 'login-tooltip-error'
            });
            
            const tooltip = bootstrap.Tooltip.getInstance(element);
            if (tooltip) {
                tooltip.show();
            }
        }
    }

    /**
     * 清除字段错误
     */
    function clearFieldError(element) {
        element.classList.remove('is-invalid');
        element.classList.add('is-valid');
        
        if (typeof bootstrap !== 'undefined' && bootstrap.Tooltip) {
            const tooltip = bootstrap.Tooltip.getInstance(element);
            if (tooltip) {
                tooltip.dispose();
            }
        }
    }

    /**
     * 显示统一错误提示
     * @param {string} message - 错误消息（可以是HTML）
     * @param {boolean} isMainReason - 是否为主要原因（true时作为主标题显示，false时作为副标题）
     */
    function showFormError(message, isMainReason = false) {
        if (!errorAlertContainer) return;
        
        // 改进UI：如果错误消息是主要原因（如"考试结束"），直接作为主标题显示
        // 否则显示"认证失败"作为主标题，错误消息作为副标题
        let alertContent;
        if (isMainReason) {
            // 主要原因：直接显示错误消息，使用更大的字体
            alertContent = `
                <div class="alert alert-danger alert-dismissible fade show" role="alert">
                    <div class="d-flex align-items-start">
                        <i class="bi bi-exclamation-triangle-fill me-2 mt-1" style="font-size: 1.25rem; flex-shrink: 0;"></i>
                        <div class="flex-grow-1">
                            <div class="fw-bold mb-1" style="font-size: 1.1em;">${message}</div>
                        </div>
                        <button type="button" class="btn-close ms-2" data-bs-dismiss="alert" aria-label="Close"></button>
                    </div>
                </div>
            `;
        } else {
            // 一般错误：显示"认证失败"作为主标题，错误消息作为副标题
            alertContent = `
                <div class="alert alert-danger alert-dismissible fade show" role="alert">
                    <div class="d-flex align-items-start">
                        <i class="bi bi-exclamation-triangle-fill me-2 mt-1" style="font-size: 1.25rem; flex-shrink: 0;"></i>
                        <div class="flex-grow-1">
                            <div class="fw-bold mb-1">认证失败</div>
                            <div class="text-muted small">${message}</div>
                        </div>
                        <button type="button" class="btn-close ms-2" data-bs-dismiss="alert" aria-label="Close"></button>
                    </div>
                </div>
            `;
        }
        
        errorAlertContainer.innerHTML = alertContent;
        errorAlertContainer.style.display = 'block';
        
        setTimeout(() => {
            const alert = errorAlertContainer.querySelector('.alert');
            if (alert) {
                const bsAlert = bootstrap.Alert.getInstance(alert);
                if (bsAlert) {
                    bsAlert.close();
                } else {
                    alert.remove();
                }
            }
        }, 3000);
    }

    /**
     * 隐藏统一错误提示
     */
    function hideFormError() {
        if (!errorAlertContainer) return;
        errorAlertContainer.style.display = 'none';
        errorAlertContainer.innerHTML = '';
    }

    // 表单验证配置
    const fieldConfigs = {
        team_id: {
            rules: {
                required: true,
                minlength: 3,
                maxlength: 20
            },
            messages: {
                required: createBilingualMessage('队伍ID不能为空', 'Team ID is required'),
                minlength: createBilingualMessage('队伍ID不能少于3个字符', 'Team ID must be at least 3 characters'),
                maxlength: createBilingualMessage('队伍ID不能超过20个字符', 'Team ID cannot exceed 20 characters')
            }
        },
        password: {
            rules: {
                required: true,
                minlength: 3,
                maxlength: 32
            },
            messages: {
                required: createBilingualMessage('密码不能为空', 'Password is required'),
                minlength: createBilingualMessage('密码不能少于3个字符', 'Password must be at least 3 characters'),
                maxlength: createBilingualMessage('密码不能超过32个字符', 'Password cannot exceed 32 characters')
            }
        }
    };

    // 错误类型映射表 - 根据 error_type 提供友好的提示信息
    const errorTypeMessages = {
        'already_logged_in': {
            chinese: '您已经登录，请刷新页面',
            english: 'Already logged in. Please refresh the page',
            isMainReason: true
        },
        'invalid_data': {
            chinese: '输入数据无效，请检查队伍ID',
            english: 'Invalid input data, please check team ID',
            isMainReason: false
        },
        'exam_ended': {
            chinese: '比赛已结束，无法登录',
            english: 'Contest has ended, cannot login',
            isMainReason: true
        },
        'team_not_found': {
            chinese: '未找到该队伍，请检查队伍ID是否正确',
            english: 'Team not found, please check team ID',
            isMainReason: false
        },
        'ip_locked': {
            chinese: 'IP已锁定，请联系管理员解锁',
            english: 'IP locked, please contact administrator to unlock',
            isMainReason: true
        },
        'already_submitted': {
            chinese: '您已交卷，无法再次登录',
            english: 'You have already submitted, cannot login again',
            isMainReason: true
        },
        'system_login_required': {
            chinese: '该账号使用系统密码模式，请先登录系统账号',
            english: 'This account uses system password mode, please login system account first',
            isMainReason: false
        },
        'password_error': {
            chinese: '密码错误，请重新输入',
            english: 'Password incorrect, please try again',
            isMainReason: false
        }
    };

    // 提交处理函数
    async function handleContestTeamAuthSubmit(form) {
        if (!submitButton) return false;

        submitButton.disabled = true;

        try {
            const formData = new FormData(form);
            const authData = {
                cid: formData.get('cid'),
                team_id: formData.get('team_id'),
                password: formData.get('password')
            };

            const url = `${authUrl}?cid=${cid}`;
            const ret = await csg.post(url, { team_id: authData.team_id, password: authData.password }, {}, 'json', 'form');

            if (ret && ret.code == 1) {
                alerty.success(ret.msg || '认证成功', 'Authentication successful');
                setTimeout(function() {
                    if (ret.data && ret.data.redirect_url) {
                        location.href = ret.data.redirect_url;
                    } else {
                        location.reload();
                    }
                }, 500);
            } else {
                submitButton.disabled = false;
                const errorMsg = ret && ret.msg ? ret.msg : '认证失败';
                const errorType = ret && ret.data && ret.data.error_type ? ret.data.error_type : null;
                
                // 根据 error_type 获取对应的友好提示
                if (errorType && errorTypeMessages[errorType]) {
                    const errorInfo = errorTypeMessages[errorType];
                    showFormError(
                        createBilingualMessage(errorInfo.chinese, errorInfo.english),
                        errorInfo.isMainReason
                    );
                } else {
                    // 如果没有 error_type 或不在映射表中，使用原有逻辑
                    if (errorMsg.includes('结束') || errorMsg.includes('Ended') || errorMsg.includes('ended')) {
                        showFormError(createBilingualMessage(errorMsg, ''), true);
                    } else {
                        showFormError(createBilingualMessage('认证失败', errorMsg), false);
                    }
                }
            }
        } catch (error) {
            submitButton.disabled = false;
            showFormError(createBilingualMessage('网络错误，请重试', 'Network error, please try again'));
            console.error('Contest team auth request failed:', error);
        }

        return false;
    }

    // 为字段添加实时验证和 Tooltip
    [teamIdInput, passwordInput].forEach(element => {
        if (!element) return;

        element.addEventListener('blur', function() {
            const fieldName = element.name;
            const fieldConfig = fieldConfigs[fieldName];
            if (fieldConfig && window.FormValidationTip) {
                // 将 fieldConfig 转换为规则数组
                const rules = convertFieldConfigToRules(fieldConfig, this);
                const result = window.FormValidationTip.validateField(this, rules);
                if (!result.valid) {
                    showFieldError(this, result.message);
                } else {
                    clearFieldError(this);
                }
            }
        });

        element.addEventListener('input', function() {
            if (this.classList.contains('is-invalid')) {
                clearFieldError(this);
                hideFormError();
            }
        });

        element.addEventListener('focus', function() {
            hideFormError();
        });
    });

    // 初始化表单验证 - 使用 FormValidationTip.initFormValidation，并传入自定义函数使用 Tooltip 显示错误
    if (window.FormValidationTip && window.FormValidationTip.initFormValidation) {
        window.FormValidationTip.initFormValidation('#contest_auth_form', fieldConfigs, handleContestTeamAuthSubmit, {
            showFieldError: showFieldError,
            clearFieldError: clearFieldError,
            showFormAlert: showFormError
        });
    } else {
        contestAuthForm.addEventListener('submit', function(e) {
            e.preventDefault();
            hideFormError();
            handleContestTeamAuthSubmit(this);
            return false;
        });
    }
}

/**
 * 比赛账号免密登录（cpcsys：本机 IP 已绑定 team_id_bind）
 * 逻辑原先在 contest_auth.js，页面实际只加载 contest_auth_index.js，须在此注册点击事件。
 */
function initContestPasswordlessLogin() {
    const passwordlessBtn = document.getElementById('passwordless_login_btn');
    if (!passwordlessBtn) {
        return;
    }

    const config = window.CONTEST_AUTH_CONFIG || {};
    const passwordlessUrl = config.passwordlessUrl;
    const cid = config.cid;
    if (!passwordlessUrl || !cid) {
        return;
    }

    const passwordlessPanel = document.getElementById('contest_passwordless_panel');
    const credentialTable = document.getElementById('contest_credential_table');
    const showPasswordBtn = document.getElementById('contest_show_password_login_btn');
    const backPasswordlessBtn = document.getElementById('contest_back_passwordless_btn');
    const teamIdInput = document.getElementById('cpc_team_id');
    const passwordInput = document.getElementById('cpc_password');
    const errorAlertContainer = document.getElementById('contest_auth_error_alert');

    function createBilingualMessage(chineseMsg, englishMsg) {
        return `${chineseMsg}<span class="en-text"> ${englishMsg}</span>`;
    }

    function showFormError(message, isMainReason = false) {
        if (!errorAlertContainer) return;
        const alertContent = isMainReason
            ? `<div class="alert alert-danger alert-dismissible fade show mb-0" role="alert">
                    <div class="d-flex align-items-start">
                        <i class="bi bi-exclamation-triangle-fill me-2 mt-1" style="font-size: 1.25rem; flex-shrink: 0;"></i>
                        <div class="flex-grow-1"><div class="fw-bold mb-1" style="font-size: 1.1em;">${message}</div></div>
                        <button type="button" class="btn-close ms-2" data-bs-dismiss="alert" aria-label="Close"></button>
                    </div>
               </div>`
            : `<div class="alert alert-danger alert-dismissible fade show mb-0" role="alert">
                    <div class="d-flex align-items-start">
                        <i class="bi bi-exclamation-triangle-fill me-2 mt-1" style="font-size: 1.25rem; flex-shrink: 0;"></i>
                        <div class="flex-grow-1">
                            <div class="fw-bold mb-1">登录失败</div>
                            <div class="text-muted small">${message}</div>
                        </div>
                        <button type="button" class="btn-close ms-2" data-bs-dismiss="alert" aria-label="Close"></button>
                    </div>
               </div>`;
        errorAlertContainer.innerHTML = alertContent;
        errorAlertContainer.style.display = 'block';
    }

    function hideFormError() {
        if (!errorAlertContainer) return;
        errorAlertContainer.style.display = 'none';
        errorAlertContainer.innerHTML = '';
    }

    function showCredentialForm() {
        if (passwordlessPanel) {
            passwordlessPanel.style.display = 'none';
        }
        if (credentialTable) {
            credentialTable.style.display = '';
        }
        if (backPasswordlessBtn) {
            backPasswordlessBtn.style.display = '';
        }
        if (teamIdInput) {
            teamIdInput.required = true;
            if (config.teamIdBind) {
                teamIdInput.value = config.teamIdBind;
            }
            teamIdInput.focus();
        }
        if (passwordInput) {
            passwordInput.required = true;
        }
    }

    function showPasswordlessPanel() {
        hideFormError();
        if (passwordlessPanel) {
            passwordlessPanel.style.display = '';
        }
        if (credentialTable) {
            credentialTable.style.display = 'none';
        }
        if (backPasswordlessBtn) {
            backPasswordlessBtn.style.display = 'none';
        }
        if (teamIdInput) {
            teamIdInput.required = false;
        }
        if (passwordInput) {
            passwordInput.required = false;
            passwordInput.value = '';
        }
    }

    if (showPasswordBtn) {
        showPasswordBtn.addEventListener('click', showCredentialForm);
    }
    if (backPasswordlessBtn) {
        backPasswordlessBtn.addEventListener('click', showPasswordlessPanel);
    }

    passwordlessBtn.addEventListener('click', async function() {
        const btn = this;
        btn.disabled = true;
        hideFormError();

        try {
            const ret = await csg.post(
                `${passwordlessUrl}?cid=${encodeURIComponent(cid)}`,
                { cid: cid },
                {},
                'json',
                'form'
            );

            if (ret && ret.code == 1) {
                alerty.success(ret.msg || '登录成功', 'Login successful');
                setTimeout(function() {
                    if (ret.data && ret.data.redirect_url) {
                        location.href = ret.data.redirect_url;
                    } else {
                        location.reload();
                    }
                }, 500);
                return;
            }

            const errorMsg = (ret && ret.msg) ? ret.msg : '登录失败';
            showFormError(createBilingualMessage(errorMsg, errorMsg), true);
            btn.disabled = false;
        } catch (error) {
            console.error('Contest passwordless login failed:', error);
            showFormError(createBilingualMessage('网络错误，请重试', 'Network error, please try again'));
            btn.disabled = false;
        }
    });
}

/**
 * 初始化比赛密码验证表单（contest_pass）
 */
function initContestPassAuthForm() {
    const contestAuthForm = document.getElementById('contest_auth_form');
    if (!contestAuthForm) {
        return;
    }

    // 检查是否是比赛密码验证表单（有 contest_pass 字段）
    const contestPassInput = document.getElementById('contest_pass');
    if (!contestPassInput) {
        return; // 不是比赛密码验证表单，跳过
    }

    const config = window.CONTEST_PASS_CONFIG || {};
    const authUrl = config.authUrl || contestAuthForm.action;
    const submitButton = document.getElementById('submit_button');

    if (!submitButton) {
        return;
    }

    // 创建统一的错误提示区域（在表单上方）
    let errorAlertContainer = document.getElementById('contest_auth_error_alert');
    if (!errorAlertContainer) {
        errorAlertContainer = document.createElement('div');
        errorAlertContainer.id = 'contest_auth_error_alert';
        errorAlertContainer.className = 'mb-2';
        errorAlertContainer.style.display = 'none';
        contestAuthForm.insertBefore(errorAlertContainer, contestAuthForm.firstChild);
    }

    // 创建双语验证消息
    function createBilingualMessage(chineseMsg, englishMsg) {
        return `${chineseMsg}<span class="en-text"> ${englishMsg}</span>`;
    }

    /**
     * 显示字段错误（使用 Bootstrap Tooltip）- 复用登录页面的方式
     */
    function showFieldError(element, message) {
        element.classList.remove('is-valid');
        element.classList.add('is-invalid');
        
        if (typeof bootstrap !== 'undefined' && bootstrap.Tooltip) {
            const existingTooltip = bootstrap.Tooltip.getInstance(element);
            if (existingTooltip) {
                existingTooltip.dispose();
            }
            
            new bootstrap.Tooltip(element, {
                title: message,
                placement: 'top',
                trigger: 'manual',
                html: true,
                customClass: 'login-tooltip-error'
            });
            
            const tooltip = bootstrap.Tooltip.getInstance(element);
            if (tooltip) {
                tooltip.show();
            }
        }
    }

    /**
     * 清除字段错误
     */
    function clearFieldError(element) {
        element.classList.remove('is-invalid');
        element.classList.add('is-valid');
        
        if (typeof bootstrap !== 'undefined' && bootstrap.Tooltip) {
            const tooltip = bootstrap.Tooltip.getInstance(element);
            if (tooltip) {
                tooltip.dispose();
            }
        }
    }

    /**
     * 显示统一错误提示
     * @param {string} message - 错误消息（可以是HTML）
     * @param {boolean} isMainReason - 是否为主要原因（true时作为主标题显示，false时作为副标题）
     */
    function showFormError(message, isMainReason = false) {
        if (!errorAlertContainer) return;
        
        // 改进UI：如果错误消息是主要原因（如"考试结束"），直接作为主标题显示
        // 否则显示"验证失败"作为主标题，错误消息作为副标题
        let alertContent;
        if (isMainReason) {
            // 主要原因：直接显示错误消息，使用更大的字体
            alertContent = `
                <div class="alert alert-danger alert-dismissible fade show" role="alert">
                    <div class="d-flex align-items-start">
                        <i class="bi bi-exclamation-triangle-fill me-2 mt-1" style="font-size: 1.25rem; flex-shrink: 0;"></i>
                        <div class="flex-grow-1">
                            <div class="fw-bold mb-1" style="font-size: 1.1em;">${message}</div>
                        </div>
                        <button type="button" class="btn-close ms-2" data-bs-dismiss="alert" aria-label="Close"></button>
                    </div>
                </div>
            `;
        } else {
            // 一般错误：显示"验证失败"作为主标题，错误消息作为副标题
            alertContent = `
                <div class="alert alert-danger alert-dismissible fade show" role="alert">
                    <div class="d-flex align-items-start">
                        <i class="bi bi-exclamation-triangle-fill me-2 mt-1" style="font-size: 1.25rem; flex-shrink: 0;"></i>
                        <div class="flex-grow-1">
                            <div class="fw-bold mb-1">验证失败</div>
                            <div class="text-muted small">${message}</div>
                        </div>
                        <button type="button" class="btn-close ms-2" data-bs-dismiss="alert" aria-label="Close"></button>
                    </div>
                </div>
            `;
        }
        
        errorAlertContainer.innerHTML = alertContent;
        errorAlertContainer.style.display = 'block';
        
        setTimeout(() => {
            const alert = errorAlertContainer.querySelector('.alert');
            if (alert) {
                const bsAlert = bootstrap.Alert.getInstance(alert);
                if (bsAlert) {
                    bsAlert.close();
                } else {
                    alert.remove();
                }
            }
        }, 3000);
    }

    /**
     * 隐藏统一错误提示
     */
    function hideFormError() {
        if (!errorAlertContainer) return;
        errorAlertContainer.style.display = 'none';
        errorAlertContainer.innerHTML = '';
    }

    // 表单验证配置
    const fieldConfigs = {
        contest_pass: {
            rules: {
                required: true,
                minlength: 6,
                maxlength: 15
            },
            messages: {
                required: createBilingualMessage('比赛密码不能为空', 'Contest password is required'),
                minlength: createBilingualMessage('比赛密码不能少于6个字符', 'Contest password must be at least 6 characters'),
                maxlength: createBilingualMessage('比赛密码不能超过15个字符', 'Contest password cannot exceed 15 characters')
            }
        }
    };

    // 提交处理函数
    async function handleContestPassSubmit(form) {
        if (!submitButton) return false;

        submitButton.disabled = true;

        try {
            const formData = new FormData(form);
            const authData = {
                cid: formData.get('cid'),
                contest_pass: formData.get('contest_pass')
            };

            const ret = await csg.post(authUrl, authData, {}, 'json', 'form');

            if (ret && ret.code == 1) {
                alerty.success(ret.msg || '验证成功', 'Verification successful');
                setTimeout(function() {
                    if (ret.data && ret.data.redirect_url) {
                        location.href = ret.data.redirect_url;
                    } else {
                        location.reload();
                    }
                }, 1000);
            } else {
                submitButton.disabled = false;
                const errorMsg = ret && ret.msg ? ret.msg : '验证失败';
                // 改进UI：如果错误消息包含"结束"或"Ended"，直接显示错误消息作为主标题
                if (errorMsg.includes('结束') || errorMsg.includes('Ended') || errorMsg.includes('ended')) {
                    showFormError(createBilingualMessage(errorMsg, ''), true);
                } else {
                    // 其他错误：显示"验证失败"作为主标题，错误消息作为副标题
                    showFormError(createBilingualMessage('验证失败', errorMsg), false);
                }
            }
        } catch (error) {
            submitButton.disabled = false;
            showFormError(createBilingualMessage('网络错误，请重试', 'Network error, please try again'), false);
            console.error('Contest pass auth request failed:', error);
        }

        return false;
    }

    // 为字段添加实时验证和 Tooltip
    contestPassInput.addEventListener('blur', function() {
        const fieldConfig = fieldConfigs.contest_pass;
        if (fieldConfig && window.FormValidationTip) {
            // 将 fieldConfig 转换为规则数组
            const rules = convertFieldConfigToRules(fieldConfig, this);
            const result = window.FormValidationTip.validateField(this, rules);
            if (!result.valid) {
                showFieldError(this, result.message);
            } else {
                clearFieldError(this);
            }
        }
    });

    contestPassInput.addEventListener('input', function() {
        if (this.classList.contains('is-invalid')) {
            clearFieldError(this);
            hideFormError();
        }
    });

    contestPassInput.addEventListener('focus', function() {
        hideFormError();
    });

    // 初始化表单验证 - 使用 FormValidationTip.initFormValidation，并传入自定义函数使用 Tooltip 显示错误
    if (window.FormValidationTip && window.FormValidationTip.initFormValidation) {
        window.FormValidationTip.initFormValidation('#contest_auth_form', fieldConfigs, handleContestPassSubmit, {
            showFieldError: showFieldError,
            clearFieldError: clearFieldError,
            showFormAlert: showFormError
        });
    } else {
        contestAuthForm.addEventListener('submit', function(e) {
            e.preventDefault();
            hideFormError();
            handleContestPassSubmit(this);
            return false;
        });
    }
}

