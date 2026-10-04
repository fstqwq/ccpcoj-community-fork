/**
 * 登录表单验证和提交处理
 * 使用自定义表单验证系统
 */

// 防止重复初始化
if (window.loginOutInitialized) {
    console.warn('login_out.js already initialized, skipping...');
} else {
    window.loginOutInitialized = true;

    // 等待DOM加载完成
    document.addEventListener('DOMContentLoaded', function() {
        // 初始化登出功能
        initLogoutFunctionality();
        
        // 初始化登录表单验证
        initLoginFormValidation();
    });
}

/**
 * 初始化登出功能
 */
function initLogoutFunctionality() {
    const logoutButton = document.getElementById('logout_button');
    if (!logoutButton) {
        return; // 如果没有登出按钮，直接返回
    }

    // 绑定登出按钮点击事件
    logoutButton.addEventListener('click', handleLogoutClick);
    
    function handleLogoutClick(e) {
        e.preventDefault();
        
        // 禁用按钮防止重复点击（不修改按钮文字，避免影响布局）
        logoutButton.disabled = true;

        // 获取登出配置
        const logoutConfig = window.logoutConfig || {};
        const logoutUrl = logoutConfig.logoutUrl || '/csgoj/User/logout_ajax';
        const redirectUrl = logoutConfig.redirectUrl || '/csgoj';

        // 使用 util.js 封装的 csg.post 方法
        (async function() {
            try {
                const ret = await csg.post(logoutUrl, {}, {}, 'json');
                
                if (ret && ret.code == 1) {
                    // 登出成功
                    alerty.success('登出成功', 'Logout successful');
                    setTimeout(function() {
                        location.reload();
                    }, 500);
                } else {
                    // 登出失败
                    alerty.alert({
                        message: '登出失败',
                        message_en: ret && ret.msg ? ret.msg : 'Logout failed',
                        title: '登出失败',
                        callback: function() {
                            location.href = redirectUrl;
                        }
                    });
                }
            } catch (error) {
                // 请求失败
                alerty.alert({
                    message: '网络错误，请重试',
                    message_en: 'Network error, please try again',
                    title: '网络错误',
                    callback: function() {
                        // 恢复按钮状态
                        logoutButton.disabled = false;
                    }
                });
                console.error('Logout request failed:', error);
            }
        })();
    }
}

/**
 * 初始化登录表单验证
 * 使用 Bootstrap 5 Tooltip 和统一错误提示区域，不影响登录框尺寸
 */
function initLoginFormValidation() {
    // 检查是否存在登录表单
    const loginForm = document.getElementById('login_form');
    if (!loginForm) {
        return; // 如果没有登录表单，直接返回
    }

    // 定义用户ID验证规则（自定义验证函数）
    // 与后端验证规则保持一致：允许字母、数字、下划线，可以以数字开头
    function validateUserId(value) {
        // 用户名只能包含字母、数字、下划线（可以以数字开头）
        const userIdRegex = /^[a-zA-Z0-9_]+$/;
        return userIdRegex.test(value);
    }

    // 创建双语验证消息
    function createBilingualMessage(chineseMsg, englishMsg) {
        return `${chineseMsg}<span class="en-text"> ${englishMsg}</span>`;
    }

    // 字段验证规则和消息
    const validationRules = {
        user_id: {
            validate: (value) => {
                if (!value.trim()) {
                    return createBilingualMessage('用户名不能为空', 'User ID is required');
                }
                if (value.length < 3) {
                    return createBilingualMessage('用户名不能少于3个字符', 'User ID must be at least 3 characters');
                }
                if (value.length > 30) {
                    return createBilingualMessage('用户名不能超过30个字符', 'User ID cannot exceed 30 characters');
                }
                if (!validateUserId(value)) {
                    return createBilingualMessage('用户名格式不正确，只能包含字母、数字、下划线', 'Invalid User ID format, only letters, numbers, and underscores allowed');
                }
                return null;
            }
        },
        password: {
            validate: (value) => {
                if (!value.trim()) {
                    return createBilingualMessage('密码不能为空', 'Password is required');
                }
                if (value.length < 6) {
                    return createBilingualMessage('密码不能少于6个字符', 'Password must be at least 6 characters');
                }
                if (value.length > 64) {
                    return createBilingualMessage('密码不能超过64个字符', 'Password cannot exceed 64 characters');
                }
                return null;
            }
        }
    };

    /**
     * 显示字段错误（使用 Bootstrap Tooltip）
     */
    function showFieldError(element, message) {
        // 添加错误样式
        element.classList.remove('is-valid');
        element.classList.add('is-invalid');
        
        // 销毁现有的 tooltip
        if (typeof bootstrap !== 'undefined' && bootstrap.Tooltip) {
            const existingTooltip = bootstrap.Tooltip.getInstance(element);
            if (existingTooltip) {
                existingTooltip.dispose();
            }
            
            // 创建新的 tooltip
            new bootstrap.Tooltip(element, {
                title: message,
                placement: 'top',
                trigger: 'manual',
                html: true,
                customClass: 'login-tooltip-error'
            });
            
            // 显示 tooltip
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
        
        // 销毁 tooltip
        if (typeof bootstrap !== 'undefined' && bootstrap.Tooltip) {
            const tooltip = bootstrap.Tooltip.getInstance(element);
            if (tooltip) {
                tooltip.dispose();
            }
        }
    }

    // 获取表单字段
    const user_id = document.getElementById('user_id');
    const password = document.getElementById('login_password');

    // 为字段添加实时验证和 Tooltip
    [user_id, password].forEach(element => {
        if (!element) return;

        // 失去焦点时验证
        element.addEventListener('blur', function() {
            // 如果是 user_id 字段，自动 trim
            if (element.name === 'user_id') {
                const trimmedValue = element.value.trim();
                if (trimmedValue !== element.value) {
                    element.value = trimmedValue;
                }
            }
            
            const fieldName = element.name;
            const rule = validationRules[fieldName];
            if (rule) {
                const error = rule.validate(element.value);
                if (error) {
                    showFieldError(element, error);
                } else {
                    clearFieldError(element);
                }
            }
        });

        // 输入时清除错误状态
        element.addEventListener('input', function() {
            if (element.classList.contains('is-invalid')) {
                clearFieldError(element);
            }
        });
    });

    // 提交处理函数
    async function handleLoginSubmit(form) {
        const submitButton = document.getElementById('login_submit_button');
        if (!submitButton) return;

        // 禁用提交按钮防止重复提交（不修改按钮文字，避免影响布局）
        submitButton.disabled = true;

        try {
            // 收集表单数据
            const formData = new FormData(form);
            const loginData = {
                user_id: formData.get('user_id'),
                password: formData.get('password')
            };

            // 使用 util.js 封装的 csg.post 方法提交
            // 指定 contentType 为 'form' 使用 application/x-www-form-urlencoded 格式
            // X-Requested-With header 会自动包含，无需显式指定
            const ret = await csg.post(form.action, loginData, {}, 'json', 'form');

            if (ret && ret.code == 1) {
                // 登录成功
                alerty.success('登录成功', 'Login successful');
                setTimeout(function() {
                    location.reload();
                }, 500);
            } else {
                // 登录失败 - 恢复按钮状态
                submitButton.disabled = false;

                // 不在登录框内插入提示元素（避免改变 DOM/布局），改为悬浮提示 + alerty.error
                const errorMsgEn = ret && ret.msg ? String(ret.msg) : 'Login failed';
                alerty.error('登录失败', errorMsgEn);

                // 同时将错误提示悬浮在输入框上（类似“用户名不能为空”）
                const target = password || user_id;
                if (target) {
                    showFieldError(target, createBilingualMessage('登录失败', errorMsgEn));
                    target.focus();
                }
            }
        } catch (error) {
            // 请求失败 - 恢复按钮状态
            submitButton.disabled = false;

            // 不改变 DOM 结构，使用 alerty.error 提示
            alerty.error('网络错误，请重试', 'Network error, please try again');
            const target = password || user_id;
            if (target) {
                showFieldError(target, createBilingualMessage('网络错误，请重试', 'Network error, please try again'));
            }
            console.error('Login request failed:', error);
        }
    }

    // 表单提交验证
    loginForm.addEventListener('submit', function(e) {
        e.preventDefault();
        e.stopPropagation();
        
        let isValid = true;
        let firstErrorField = null;
        let firstErrorMessage = null;

        // 验证所有字段
        Object.keys(validationRules).forEach(fieldName => {
            const element = document.querySelector(`[name="${fieldName}"]`);
            if (!element) return;

            const rule = validationRules[fieldName];
            const error = rule.validate(element.value);
            
            if (error) {
                isValid = false;
                showFieldError(element, error);
                
                // 记录第一个错误
                if (!firstErrorField) {
                    firstErrorField = element;
                    firstErrorMessage = error;
                }
            } else {
                clearFieldError(element);
            }
        });

        if (!isValid) {
            // 聚焦到第一个错误字段
            if (firstErrorField) {
                firstErrorField.focus();
            }
        } else {
            // 表单有效，提交
            handleLoginSubmit(loginForm);
        }
        
        return false;
    });
}