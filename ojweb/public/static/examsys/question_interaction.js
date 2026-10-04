// **************************************************
// 题目交互功能模块
// 处理：保存按钮交互、保存提醒、离开提醒等
// 依赖：QuestionRender (question_render.js), question_map (由页面定义)
// **************************************************

/**
 * 显示题目通知（通用封装）
 * @param {HTMLElement} question_div - 题目容器元素
 * @param {string} type - 通知类型：'warning' | 'success'
 * @param {string} cnText - 中文文本
 * @param {string} enText - 英文文本
 * @param {number} autoHide - 自动隐藏时间（毫秒），0 表示不自动隐藏
 */
function showQuestionNotification(question_div, type, cnText, enText, autoHide = 0) {
    if (!question_div) return;
    
    // 优先使用 inline 位置（题号旁边）
    let reminder_slot = question_div.querySelector('.save-reminder-slot-inline');
    
    // 如果没有 inline 位置，使用旧位置（兼容）
    if (!reminder_slot) {
        reminder_slot = question_div.querySelector('.save-reminder-slot');
    }
    
    // 如果还是没有，创建一个（放在按钮容器之后）
    if (!reminder_slot) {
        let submit_container = question_div.querySelector('.question_submit_container');
        if (submit_container) {
            reminder_slot = document.createElement('div');
            reminder_slot.className = 'save-reminder-slot-inline';
            // 找到题号部分，插入到题号旁边
            const numPart = question_div.querySelector('.question-number-part');
            if (numPart) {
                numPart.appendChild(reminder_slot);
            } else {
                submit_container.parentNode.insertBefore(reminder_slot, submit_container);
            }
        } else {
            return; // 如果连按钮容器都没有，就不显示提醒
        }
    }
    
    // 移除现有的通知
    const existingNotification = reminder_slot.querySelector('.question-notification');
    if (existingNotification) {
        existingNotification.remove();
    }
    
    // 根据类型设置样式
    const typeConfig = {
        warning: {
            className: 'question-notification question-notification-warning',
            icon: 'bi-exclamation-triangle'
        },
        success: {
            className: 'question-notification question-notification-success',
            icon: 'bi-check-circle'
        }
    };
    
    const config = typeConfig[type] || typeConfig.warning;
    
    // 创建通知元素
    let notification = document.createElement('span');
    notification.className = config.className;
    notification.innerHTML = `
        <i class="bi ${config.icon} notification-icon"></i>
        <span class="notification-text">
            <span class="cn-text">${cnText}</span>
            <span class="en-text">${enText}</span>
        </span>
    `;
    reminder_slot.appendChild(notification);
    reminder_slot.style.display = 'inline-flex';
    
    // 自动隐藏
    if (autoHide > 0) {
        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
                // 如果 slot 里没有其他内容了，隐藏它
                if (!reminder_slot.querySelector('.question-notification')) {
                    reminder_slot.style.display = 'none';
                }
            }
        }, autoHide);
    }
    
    return notification;
}

/**
 * 隐藏题目通知
 * @param {HTMLElement} question_div - 题目容器元素
 */
function hideQuestionNotification(question_div) {
    if (!question_div) return;
    
    // 隐藏 inline 位置的通知
    const inlineSlot = question_div.querySelector('.save-reminder-slot-inline');
    if (inlineSlot) {
        const notification = inlineSlot.querySelector('.question-notification');
        if (notification) {
            notification.remove();
        }
        inlineSlot.style.display = 'none';
    }
    
    // 隐藏旧位置的通知（兼容）
    const oldSlot = question_div.querySelector('.save-reminder-slot:not(.save-reminder-slot-inline)');
    if (oldSlot) {
        const notification = oldSlot.querySelector('.question-notification');
        if (notification) {
            notification.remove();
        }
        const oldReminder = oldSlot.querySelector('.save-reminder-inline, .save-reminder, .save-success');
        if (oldReminder) {
            oldReminder.remove();
        }
        oldSlot.style.display = 'none';
    }
}

/**
 * 显示保存提醒（使用通用封装）
 * @param {HTMLElement} question_div - 题目容器元素
 */
function showSaveReminder(question_div) {
    showQuestionNotification(
        question_div,
        'warning',
        '提醒：您已修改答案，记得点保存！',
        'Reminder: You have modified the answer, remember to save!',
        0  // 不自动隐藏
    );
}

/**
 * 隐藏保存提醒（兼容旧接口）
 * @param {HTMLElement} question_div - 题目容器元素
 */
function hideSaveReminder(question_div) {
    hideQuestionNotification(question_div);
}

/**
 * 显示保存成功提示（使用通用封装）
 * @param {HTMLElement} button - 保存按钮元素
 */
function showSaveSuccess(button) {
    let question_div = button.closest('.question_div');
    if (!question_div) return;
    
    // 先隐藏之前的通知
    hideQuestionNotification(question_div);
    
    // 显示保存成功通知
    showQuestionNotification(
        question_div,
        'success',
        '解答保存成功！',
        'Response saved!',
        3000  // 3秒后自动隐藏
    );
    
    // 更新状态
    question_div.setAttribute('data-modified', 'false');
}

/**
 * 是否为“文本类”控件（textarea 或 type=text/search 等）：这类控件每次输入已触发 input，无需在 change（失焦）时再更新按钮，避免用户点保存时失焦触发 change 导致按钮 DOM 被替换、第一次点击无效。
 */
function isTextLikeInput(el) {
    if (!el || !el.classList.contains('question_input')) return false;
    if (el.tagName === 'TEXTAREA') return true;
    if (el.tagName === 'INPUT') {
        const t = (el.type || 'text').toLowerCase();
        return ['text', 'search', 'email', 'url', 'tel', 'password'].indexOf(t) !== -1;
    }
    return false;
}

/**
 * 处理输入变化，更新按钮状态和显示提醒
 * @param {Event} event - 输入事件
 */
function handleQuestionInputChange(event) {
    if (!event.target.classList.contains('question_input')) return;
    // 编程题/填空等：input 已足够；change 在失焦时触发，若此时用户正在点保存，会同步替换按钮 DOM 导致第一次点击无效，故对文本类控件忽略 change
    if (event.type === 'change' && isTextLikeInput(event.target)) return;

    let question_div = event.target.closest('.question_div');
    if (!question_div) return;
    
    const ex_question_id = question_div.getAttribute('ex_question_id');
    
    // 更新 DOM 状态
    question_div.setAttribute('data-modified', 'true');
    
    // 同步更新 question_map 中的 modified 属性（重要：防止 dis.Render 再次禁用按钮）
    // 所有依赖已全局引入，直接使用
    if (question_map?.[ex_question_id]) {
        question_map[ex_question_id].modified = true;
    }
    
    // 更新保存按钮状态：有修改时启用按钮
    const question = question_map?.[ex_question_id] || null;
    // 计算是否应该禁用：只有考试结束时才禁用
    const examDisabled = question ? QuestionRender.dis.IsQuestionDisabled(question) : false;
    
    // 所有依赖已全局引入，直接使用
    // is_modified = true 表示有修改，按钮应该可用（除非考试结束）
    QuestionRender.dis.SubmitButtonStatus(question_div, true, examDisabled);
    
    // 显示保存提醒
    showSaveReminder(question_div);
}

/**
 * 初始化题目交互功能
 */
function initQuestionInteraction() {
    // 保存按钮点击效果（只添加视觉反馈）
    document.addEventListener('click', function(event) {
        if (event.target.classList.contains('question_submit') || event.target.closest('.question_submit')) {
            const button = event.target.classList.contains('question_submit') ? event.target : event.target.closest('.question_submit');
            // 只添加点击视觉反馈，实际保存成功后由 answerSubmitted 事件处理
            button.style.transform = 'scale(0.95)';
            setTimeout(() => {
                button.style.transform = '';
            }, 150);
        }
    });
    
    // 添加输入变化监听
    document.addEventListener('input', handleQuestionInputChange);
    document.addEventListener('change', handleQuestionInputChange);
    
    // 监听保存成功事件，显示成功提示
    $(document).on('answerSubmitted', function(event, ex_question_id) {
        const question_div = document.getElementById(`question_div_${ex_question_id}`);
        if (question_div) {
            const button = question_div.querySelector('.question_submit');
            if (button) {
                showSaveSuccess(button);
            }
        }
    });
    
    // 页面离开前提醒保存
    window.addEventListener('beforeunload', function(event) {
        if (window.skipBeforeUnload === true) return;
        
        // 优先使用 JudgeSaved（基于 asheet_tmp 对比）判断是否有未保存的修改
        if (typeof JudgeSaved === 'function') {
            try {
                const modified_list = JudgeSaved();
                // JudgeSaved 返回 true 表示没有修改，返回空数组也表示没有修改
                if (modified_list === true || (Array.isArray(modified_list) && modified_list.length === 0)) {
                    return; // 没有未保存修改，不弹提示
                }
            } catch (e) {
                console.warn('JudgeSaved check failed', e);
            }
        }
        
        // 降级检查：检查 DOM 中是否有标记为已修改的题目
        let modified_questions = document.querySelectorAll('.question_div[data-modified="true"]');
        if (modified_questions.length > 0) {
            event.preventDefault();
            event.returnValue = ''; // 现代浏览器会忽略自定义消息，使用空字符串即可
            return event.returnValue;
        }
    });
    
    // 页面可见性变化提醒
    document.addEventListener('visibilitychange', function() {
        if (document.hidden) {
            let modified_questions = document.querySelectorAll('.question_div[data-modified="true"]');
            if (modified_questions.length > 0) {
                alerty.warning(`您有 ${modified_questions.length} 道题目未保存，请记得保存答案！`);
            }
        }
    });
    
    // 定期提醒保存（每5分钟检查一次）
    setInterval(function() {
        let modified_questions = document.querySelectorAll('.question_div[data-modified="true"]');
        if (modified_questions.length > 0) {
            if (!document.hidden && document.hasFocus()) {
                alerty.warning(`提醒：您有 ${modified_questions.length} 道题目未保存`);
            }
        }
    }, 5 * 60 * 1000);
}

// 页面加载完成后初始化
document.addEventListener("DOMContentLoaded", initQuestionInteraction);

// 确保全局可用
if (typeof window !== 'undefined') {
    window.showSaveSuccess = showSaveSuccess;
    window.showSaveReminder = showSaveReminder;
    window.hideSaveReminder = hideSaveReminder;
    window.showQuestionNotification = showQuestionNotification;
    window.hideQuestionNotification = hideQuestionNotification;
}
