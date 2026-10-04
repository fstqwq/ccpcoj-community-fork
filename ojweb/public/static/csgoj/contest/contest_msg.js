/**
 * 比赛消息相关功能
 * 只包含方法，不直接执行任何代码
 */

// 消息时间常量
const ContestMsg = {
    TIME_MSG_RECENT: 60000,        // 1分钟，判断新消息的时间阈值
    TIME_FETCH_INTERVAL: 60000,    // 1分钟，定时获取消息的间隔
    TIME_REFRESH_FETCH: 180000,    // 3分钟，刷新获取消息的时间阈值
};

/**
 * 渲染消息列表
 * @param {Array} messages 消息数组
 */
function renderMessages(messages) {
    const messageList = document.getElementById('messageList');
    const noMessages = document.getElementById('noMessages');
    const messageCount = document.getElementById('messageCount');
    
    if (!messageList || !noMessages || !messageCount) {
        console.warn('Message container elements not found');
        return;
    }
    
    messageList.innerHTML = '';

    if (!messages || messages.length === 0) {
        noMessages.classList.remove('d-none');
        messageCount.textContent = '0';
        return;
    }

    noMessages.classList.add('d-none');
    messageCount.textContent = messages.length;

    // 按 in_date 逆序排序
    messages.sort((a, b) => new Date(b.in_date) - new Date(a.in_date));

    const now = new Date();

    messages.forEach((msg, index) => {
        let team_id = msg.team_id;
        let team_type = '';
        if (team_id.includes('#')) {
            team_id = msg.team_id.split('_')[1];
            team_type = '比赛管理员<span class="en-text">Contest Admin</span>';
        } else {
            team_type = '系统管理员<span class="en-text">System Admin</span>';
        }

        const msgDate = new Date(msg.in_date);
        const isRecent = (now - msgDate) / (1000 * 60) <= 10; // 判断是否在10分钟内

        const messageItem = document.createElement('div');
        messageItem.className = `list-group-item list-group-item-action ${isRecent ? 'border-danger border-2' : ''}`;
        messageItem.innerHTML = `
            <div class="d-flex w-100 justify-content-between align-items-start">
                <div class="flex-grow-1">
                    <div class="d-flex align-items-center mb-2">
                        <span class="badge bg-secondary me-2">#${messages.length - index}</span>
                        ${isRecent ? '<span class="badge bg-danger me-2"><span class="cn-text"><i class="bi bi-exclamation-triangle me-1"></i>新消息</span><span class="en-text">New</span></span>' : ''}
                    </div>
                    <div id="message-${index}" class="message-content mb-2"></div>
                    <div class="d-flex align-items-center text-muted small">
                        <i class="bi bi-clock me-1"></i>
                        <span class="me-3">${msg.in_date}</span>
                        <i class="bi bi-person me-1"></i>
                        <span class="me-1">${team_id}</span>
                        <span class="badge bg-light text-dark">${team_type}</span>
                    </div>
                </div>
            </div>
        `;
        
        messageList.appendChild(messageItem);

        // 使用Vditor渲染消息内容（优先使用封装的 CsgVditor）
        const messageContentEl = document.getElementById(`message-${index}`);
        if (messageContentEl) {
            if (typeof CsgVditor !== 'undefined' && typeof CsgVditor.render === 'function') {
                CsgVditor.render({
                    el: messageContentEl,
                    markdown: msg.content || ''
                });
            } else if (typeof Vditor !== 'undefined' && typeof Vditor.preview === 'function') {
                Vditor.preview(messageContentEl, msg.content || '', {
                    mode: 'light',
                    hljs: {
                        style: 'dracula'
                    }
                });
            } else {
                // 回退到简单的HTML渲染
                messageContentEl.innerHTML = msg.content || '';
            }
        }
    });
}

/**
 * 获取当前时间（从页面元素读取）
 * @returns {number} 时间戳
 */
function MsgGetCurrentTime() {
    const currentTimeDiv = document.getElementById('current_time_div');
    if (!currentTimeDiv) {
        return null;
    }
    return new Date(currentTimeDiv.textContent.trim()).getTime();
}

/**
 * 比较本地和远程消息列表
 * @param {Array} msg_list_local 本地消息列表
 * @param {Array} msg_list 远程消息列表
 * @returns {Object} { isEqual: boolean, remote_msg_callback: boolean, other_msg_dif: boolean }
 */
function CompareMsg(msg_list_local, msg_list) {
    if (!Array.isArray(msg_list_local) || !Array.isArray(msg_list)) {
        return { isEqual: false, remote_msg_callback: false, other_msg_dif: false };
    }
    
    let remote_msg_callback = false;
    let other_msg_dif = false;
    let ret = true;
    let localMap = {};
    let remoteMap = {};
    
    msg_list_local.forEach(msg => {
        localMap[msg.msg_id] = msg.in_date;
    });
    msg_list.forEach(msg => {
        remoteMap[msg.msg_id] = msg.in_date;
    });
    
    for (let id in localMap) {
        if (localMap[id] !== remoteMap[id]) {
            remote_msg_callback = !remote_msg_callback && !(id in remoteMap);
            other_msg_dif = other_msg_dif || (id in remoteMap);
            ret = false;
        }
    }
    
    for (let id in remoteMap) {
        if (remoteMap[id] !== localMap[id]) {
            other_msg_dif = true;
            ret = false;
        }
    }
    
    return { isEqual: ret, remote_msg_callback, other_msg_dif };
}

/**
 * 获取消息列表
 * @param {number} cid 比赛ID
 * @param {Function} callback 回调函数，接收 (msg_list, error)
 */
function fetchMessages(cid, callback) {
    if (typeof $ === 'undefined') {
        if (callback) callback(null, new Error('jQuery not available'));
        return;
    }
    
    $.get(`msg_list_ajax?cid=${cid}`, function(rep) {
        let msg_list = rep;
        if (!Array.isArray(msg_list)) {
            console.error('msg_list is not an array', msg_list);
            if (callback) callback(null, new Error('Invalid response format'));
            return;
        }
        if (callback) callback(msg_list, null);
    }).fail(function(xhr, status, error) {
        console.error('Failed to fetch messages:', error);
        if (callback) callback(null, error);
    });
}

/**
 * 更新消息数量显示
 * @param {Array} msg_list 消息列表
 */
function updateMsgNum(msg_list) {
    if (!Array.isArray(msg_list)) {
        return;
    }
    const msg_num = document.getElementById('msg_num');
    if (!msg_num) {
        return;
    }
    
    msg_num.textContent = msg_list.length;

    let hasRecentMsg = msg_list.some(function(msg) {
        let msgDate = new Date(msg.in_date).getTime();
        return (new Date().getTime()) - msgDate < ContestMsg.TIME_MSG_RECENT;
    });

    if (hasRecentMsg) {
        msg_num.classList.add('text-danger');
    } else {
        msg_num.classList.remove('text-danger');
    }
}

/**
 * 消息定时获取管理器
 */
const ContestMsgTiming = {
    fetchMessagesInterval: null,
    
    /**
     * 开始定时获取消息
     * @param {number} cid 比赛ID
     * @param {Function} onFetch 获取消息后的回调
     */
    startFetching(cid, onFetch) {
        if (this.fetchMessagesInterval) {
            return; // 已经在运行
        }
        
        const fetchFn = () => {
            fetchMessages(cid, (msg_list, error) => {
                if (error) {
                    console.error('Failed to fetch messages:', error);
                    return;
                }
                if (onFetch) {
                    onFetch(msg_list);
                }
            });
        };
        
        this.fetchMessagesInterval = setInterval(fetchFn, ContestMsg.TIME_FETCH_INTERVAL);
        // 立即执行一次
        fetchFn();
    },
    
    /**
     * 停止定时获取消息
     */
    stopFetching() {
        if (this.fetchMessagesInterval) {
            clearInterval(this.fetchMessagesInterval);
            this.fetchMessagesInterval = null;
        }
    },
    
    /**
     * 处理页面可见性变化
     * @param {number} cid 比赛ID
     * @param {Function} onFetch 获取消息后的回调
     */
    handleVisibilityChange(cid, onFetch) {
        if (document.visibilityState === 'visible') {
            this.startFetching(cid, onFetch);
        } else {
            this.stopFetching();
        }
    }
};

/**
 * 初始化比赛消息定时获取
 * @param {Object} options 配置选项
 * @param {number} options.cid 比赛ID
 * @param {boolean} options.auto_show 是否自动显示消息（非管理员且非工作人员）
 */
function ContestMsgTimingInit(options) {
    const { cid, auto_show } = options || {};
    
    if (!cid) {
        console.error('ContestMsgTimingInit: cid is required');
        return;
    }
    
    let currentTime = MsgGetCurrentTime();
    if (!currentTime) {
        setTimeout(() => ContestMsgTimingInit(options), 1000);
        return;
    }
    
    const startTimeEl = document.getElementById('start_time_span');
    const endTimeEl = document.getElementById('end_time_span');
    
    if (!startTimeEl || !endTimeEl) {
        console.warn('ContestMsgTimingInit: start_time_span or end_time_span not found');
        return;
    }
    
    const startTime = new Date(startTimeEl.textContent.trim()).getTime();
    const endTime = new Date(endTimeEl.textContent.trim()).getTime();

    // 处理消息获取和显示（异步）
    const handleFetchMessages = async (msg_list, show) => {
        if (!msg_list || msg_list.length === 0) {
            return; // 没有消息，不弹窗
        }
        
        const cacheKey = `contest_msg#cid${cid}`;
        const msg_list_local_obj = await idb.GetIdb(cacheKey);
        const currentTime = MsgGetCurrentTime();
        const compareResult = CompareMsg(msg_list_local_obj ? msg_list_local_obj.msg_list : [], msg_list);
        
        if (!msg_list_local_obj || !compareResult.isEqual) {
            await idb.SetIdb(cacheKey, {
                msg_list: msg_list,
                time: currentTime
            });
            if (show && (!compareResult.remote_msg_callback || compareResult.other_msg_dif)) {
                // 仅有远程message撤回的情况下不弹窗
                renderMessages(msg_list);
                const modalEl = document.getElementById('contentModal');
                if (modalEl) {
                    const modal = new bootstrap.Modal(modalEl);
                    modal.show();
                }
            }
        }
        
        updateMsgNum(msg_list);
    };

    // 如果在比赛时间内，启动定时获取
    if (currentTime >= startTime && currentTime <= endTime) {
        const onFetch = (msg_list) => {
            handleFetchMessages(msg_list, auto_show); // 定时获取时也根据 auto_show 决定是否弹窗
        };
        
        document.addEventListener('visibilitychange', function() {
            ContestMsgTiming.handleVisibilityChange(cid, onFetch);
        });
        ContestMsgTiming.handleVisibilityChange(cid, onFetch); // 初始化时检查页面可见性
    }
    
    // 初始加载（异步）
    (async () => {
        const cacheKey = `contest_msg#cid${cid}`;
        const msg_list_local_obj = await idb.GetIdb(cacheKey);
        if (!msg_list_local_obj || MsgGetCurrentTime() - msg_list_local_obj.time > ContestMsg.TIME_REFRESH_FETCH) {
            fetchMessages(cid, async (msg_list, error) => {
                if (!error && msg_list) {
                    await handleFetchMessages(msg_list, auto_show);
                }
            });
        } else {
            updateMsgNum(msg_list_local_obj.msg_list);
        }
    })();
    
    // 绑定手动显示消息按钮
    const showMsgBtn = document.getElementById('show_msg_btn');
    if (showMsgBtn) {
        showMsgBtn.addEventListener('click', async function(e) {
            e.preventDefault(); // 阻止默认行为，避免页面滚动到顶部
            fetchMessages(cid, async (msg_list, error) => {
                if (error) {
                    console.error('Failed to fetch messages:', error);
                    return;
                }
                const cacheKey = `contest_msg#cid${cid}`;
                const msg_list_local = await idb.GetIdb(cacheKey);
                const messagesToShow = msg_list || (msg_list_local ? msg_list_local.msg_list : []);
                renderMessages(messagesToShow);
                const modalEl = document.getElementById('contentModal');
                if (modalEl) {
                    const modal = new bootstrap.Modal(modalEl);
                    modal.show();
                }
            });
        });
    }
}

/**
 * 消息管理模块（管理员页面使用）
 */
const ContestMsgAdmin = {
    MAX_MESSAGE_LENGTH: 255,
    messageEditor: null,
    isEditMode: false,
    contest_msg_id: null,
    
    /**
     * 将 Modal 移动到 body 的直接子元素（解决 stacking context 问题）
     * @param {string|Array<string>} modalIds Modal ID 或 ID 数组
     */
    moveModalsToBody(modalIds) {
        const ids = Array.isArray(modalIds) ? modalIds : [modalIds];
        const moveModalToBody = (modalId) => {
            const modal = document.getElementById(modalId);
            if (modal && modal.parentElement !== document.body) {
                document.body.appendChild(modal);
            }
        };
        
        ids.forEach(moveModalToBody);
        
        // 在显示 modal 前确保它在 body 中（双重保险）
        document.addEventListener('show.bs.modal', function(event) {
            const modal = event.target;
            if (modal && modal.parentElement !== document.body) {
                moveModalToBody(modal.id);
            }
        }, true);
    },
    
    /**
     * 初始化 Modal 移动到 body（在 DOM 加载完成后执行）
     * @param {string|Array<string>} modalIds Modal ID 或 ID 数组
     */
    initMoveModalsToBody(modalIds) {
        const moveModals = () => {
            this.moveModalsToBody(modalIds);
        };
        
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', moveModals);
        } else {
            moveModals();
        }
    },
    
    /**
     * Bootstrap Table Formatter: 编辑按钮
     */
    formatterEdit(value, row, index, field) {
        return row.defunct == 1 
            ? "<button class='btn btn-primary btn-sm'><span><i class='bi bi-pencil me-1'></i></span><span class='en-text'>Edit</span></button>" 
            : '-';
    },
    
    /**
     * Bootstrap Table Formatter: 状态按钮
     */
    formatterStatus(value, row, index, field) {
        const txt = value == 1 ? '准备中' : '已发送';
        const txtEn = value == 1 ? 'Prepared' : 'Sent';
        const color = value == 1 ? 'warning' : 'success';
        const title = value == 1 ? '点击发送' : '点击撤回';
        const titleEn = value == 1 ? 'Click to send' : 'Click to callback';
        return `<button class='btn btn-${color} btn-sm' title='${title} (${titleEn})'>${txt}<span class='en-text'>${txtEn}</span></button>`;
    },
    
    /**
     * Bootstrap Table Formatter: 用户链接
     * @param {string} value 用户ID
     * @param {Object} row 行数据
     * @param {string} page_module 模块名称
     * @param {string|number} cid 比赛ID
     */
    formatterUser(value, row, index, field, page_module, cid) {
        if (value.includes('#')) {
            const simple = value.split('_')[1];
            return `<a href='/${page_module}/contest/teaminfo?cid=${cid}&team_id=${simple}' target='_blank'>${simple}</a>`;
        }
        return `<a href='/${page_module}/user/userinfo?user_id=${value}' target='_blank'>${value}</a>`;
    },
    
    /**
     * Bootstrap Table Formatter: 内容链接
     */
    formatterContent(value, row, index, field) {
        return `<a href='#' class='limit_span'>${value}</a>`;
    },
    
    /**
     * 初始化消息编辑器（单例模式）
     * @param {Object} options 配置选项
     * @param {string} options.editorEl 编辑器容器选择器
     * @param {string} options.charCountEl 字符计数元素ID
     */
    initMessageEditor(options = {}) {
        if (this.messageEditor) {
            return this.messageEditor;
        }
        
        const editorEl = options.editorEl || '#vditor';
        const charCountElId = options.charCountEl || 'charCount';
        const charCountEl = document.getElementById(charCountElId);
        
        if (typeof CsgVditor === 'undefined' || typeof CsgVditor.createSingletonEditor !== 'function') {
            console.error('CsgVditor.createSingletonEditor is not available');
            return null;
        }
        
        this.messageEditor = CsgVditor.createSingletonEditor({
            el: editorEl,
            height: 300,
            mode: 'wysiwyg',
            toolbar: [
                'emoji',
                'headings',
                'bold',
                'italic',
                'strike',
                'link',
                'list',
                'ordered-list',
                'check',
                'quote',
                'line',
                'code',
                'inline-code',
                'undo',
                'redo',
                'fullscreen',
                'edit-mode',
                'export'
            ],
            maxCharLength: this.MAX_MESSAGE_LENGTH,
            onCharCountUpdate: (currentLength, maxLength, remaining) => {
                if (charCountEl) {
                    charCountEl.textContent = remaining + ' bytes remaining';
                }
            },
            onCharLimitExceed: (currentLength, maxLength) => {
                // 超出限制时，获取当前内容并截断
                this.messageEditor.getValue().then(content => {
                    const getByteLength = typeof StrByteLength === 'function' 
                        ? StrByteLength 
                        : (str) => new Blob([str || '']).size;
                    
                    let truncatedValue = content;
                    while (getByteLength(truncatedValue) >= maxLength) {
                        truncatedValue = truncatedValue.slice(0, -1);
                    }
                    this.messageEditor.setValue(truncatedValue);
                });
            }
        });
        
        return this.messageEditor;
    },
    
    /**
     * 获取编辑器内容
     * @returns {Promise<string>}
     */
    getVditorContent() {
        if (!this.messageEditor) {
            return Promise.resolve('');
        }
        return this.messageEditor.getValue();
    },
    
    /**
     * 设置编辑器内容
     * @param {string} content 内容
     */
    setVditorContent(content) {
        if (!this.messageEditor) {
            this.initMessageEditor();
        }
        if (this.messageEditor) {
            return this.messageEditor.setValue(content || '');
        }
        return Promise.resolve();
    },
    
    /**
     * 显示内容预览 Modal
     * @param {Array} messages 消息数组
     */
    showContentModal(messages) {
        renderMessages(messages);
        const contentModalEl = document.getElementById('contentModal');
        if (contentModalEl) {
            // 确保 modal 在 body 中
            if (contentModalEl.parentElement !== document.body) {
                document.body.appendChild(contentModalEl);
            }
            const modal = new bootstrap.Modal(contentModalEl);
            modal.show();
        }
    },
    
    /**
     * 显示编辑 Modal（添加模式）
     */
    showAddModal() {
        this.isEditMode = false;
        this.contest_msg_id = null;
        
        const messageForm = document.getElementById('messageForm');
        if (messageForm) {
            messageForm.reset();
        }
        
        const editModalEl = document.getElementById('msg_edit_modal');
        if (!editModalEl) {
            return;
        }
        
        // 确保 modal 在 body 中
        if (editModalEl.parentElement !== document.body) {
            document.body.appendChild(editModalEl);
        }
        
        // 初始化编辑器
        this.initMessageEditor();
        
        const editModal = new bootstrap.Modal(editModalEl);
        editModal.show();
        
        // 在 modal 完全显示后再设置内容
        editModalEl.addEventListener('shown.bs.modal', function onShown() {
            ContestMsgAdmin.setVditorContent('');
            editModalEl.removeEventListener('shown.bs.modal', onShown);
        }, { once: true });
    },
    
    /**
     * 显示编辑 Modal（编辑模式）
     * @param {string|number} messageId 消息ID
     * @param {string} content 消息内容
     */
    showEditModal(messageId, content) {
        this.isEditMode = true;
        this.contest_msg_id = messageId;
        
        const editModalEl = document.getElementById('msg_edit_modal');
        if (!editModalEl) {
            return;
        }
        
        // 确保 modal 在 body 中
        if (editModalEl.parentElement !== document.body) {
            document.body.appendChild(editModalEl);
        }
        
        // 初始化编辑器
        this.initMessageEditor();
        
        const editModal = new bootstrap.Modal(editModalEl);
        editModal.show();
        
        // 在 modal 完全显示后再设置内容
        editModalEl.addEventListener('shown.bs.modal', function onShown() {
            ContestMsgAdmin.setVditorContent(content);
            editModalEl.removeEventListener('shown.bs.modal', onShown);
        }, { once: true });
    },
    
    /**
     * 保存消息
     * @param {Object} options 配置选项
     * @param {string|number} options.cid 比赛ID
     * @param {string} options.page_module 模块名称
     * @param {Function} options.onSuccess 成功回调
     * @param {Function} options.onError 错误回调
     */
    saveMessage(options = {}) {
        const { cid, page_module, onSuccess, onError } = options;
        
        if (!cid || !page_module) {
            console.error('ContestMsgAdmin.saveMessage: cid and page_module are required');
            return;
        }
        
        this.getVditorContent().then(messageContent => {
            const data_post = {
                content: messageContent
            };
            
            if (this.isEditMode && this.contest_msg_id) {
                data_post.msg_id = this.contest_msg_id;
            }
            
            if (typeof $ === 'undefined') {
                console.error('jQuery is not available');
                if (onError) onError('jQuery is not available');
                return;
            }
            
            $.post(`/${page_module}/admin/msg_add_edit_ajax?cid=${cid}`, data_post, function(rep) {
                if (rep.code == 1) {
                    // 所有依赖已全局引入，直接使用
                    alerty.success({
                        message: rep.msg,
                        message_en: rep.msg
                    });
                    
                    const editModalEl = document.getElementById('msg_edit_modal');
                    if (editModalEl) {
                        const editModal = bootstrap.Modal.getInstance(editModalEl);
                        if (editModal) {
                            editModal.hide();
                        }
                    }
                    
                    // 刷新表格
                    const msgTable = $('#msg_table');
                    if (msgTable.length && msgTable.data('bootstrap.table')) {
                        msgTable.bootstrapTable('refresh');
                    }
                    
                    if (onSuccess) {
                        onSuccess(rep);
                    }
                } else {
                    // 所有依赖已全局引入，直接使用
                    alerty.error({
                        message: rep.msg,
                        message_en: rep.msg
                    });
                    if (onError) {
                        onError(rep);
                    }
                }
            }).fail(function(xhr, status, error) {
                console.error('Failed to save message:', error);
                if (onError) {
                    onError(error);
                }
            });
        });
    },
    
    /**
     * 处理状态变更（发布/召回）
     * @param {Object} options 配置选项
     * @param {Object} options.row 行数据
     * @param {string|number} options.cid 比赛ID
     * @param {Function} options.onUpdate 更新回调，接收 (row)
     */
    handleStatusChange(options = {}) {
        const { row, cid, onUpdate } = options;
        
        if (!row || !cid) {
            console.error('ContestMsgAdmin.handleStatusChange: row and cid are required');
            return;
        }
        
        const action = row.defunct == 1 ? "发布" : "召回";
        const actionEn = row.defunct == 1 ? "publish" : "recall";
        const new_defunct = row.defunct == 1 ? 0 : 1;
        
        // 所有依赖已全局引入，直接使用
        alerty.confirm({
            message: `发布或召回后再发布将重新向选手弹窗，确定${action}？`,
            message_en: `Publishing or recalling will re-popup to players, sure to ${actionEn}?`,
            callback: () => {
                if (typeof $ === 'undefined') {
                    console.error('jQuery is not available');
                    return;
                }
                
                $.post('msg_status_change_ajax', {
                    cid: cid,
                    msg_id: row.msg_id,
                    defunct: new_defunct
                }, function(rep) {
                    if (rep.code == 1) {
                        // 所有依赖已全局引入，直接使用
                        alerty[new_defunct == 1 ? 'warning' : 'success']({
                            message: rep.msg,
                            message_en: rep.msg
                        });
                        
                        row.defunct = rep.data.defunct;
                        row.in_date = rep.data.in_date;
                        
                        if (onUpdate) {
                            onUpdate(row);
                        }
                    } else {
                        // 所有依赖已全局引入，直接使用
                        alerty.error({
                            message: rep.msg,
                            message_en: rep.msg
                        });
                    }
                }).fail(function(xhr, status, error) {
                    console.error('Failed to change message status:', error);
                });
            }
        });
    },
    
    /**
     * 初始化消息管理页面
     * @param {Object} options 配置选项
     * @param {string|number} options.cid 比赛ID
     * @param {string} options.page_module 模块名称
     * @param {string} options.tableId 表格ID，默认 'msg_table'
     */
    init(options = {}) {
        const { cid, page_module, tableId = 'msg_table' } = options;
        
        if (!cid || !page_module) {
            console.error('ContestMsgAdmin.init: cid and page_module are required');
            return;
        }
        
        // 初始化 Modal 移动到 body
        this.initMoveModalsToBody(['msg_edit_modal', 'contentModal']);
        
        // 初始化表格工具栏（如果函数存在）
        if (typeof initBootstrapTableClientToolbar === 'function') {
            initBootstrapTableClientToolbar({
                tableId: tableId,
                prefix: 'msg',
                filterSelectors: ['defunct'],
                searchInputId: 'msg_search_input',
                searchFields: {
                    content: 'content',
                    team_id: 'team_id'
                }
            });
        }
        
        // 绑定表格单元格点击事件
        const msgTable = $(`#${tableId}`);
        if (msgTable.length) {
            msgTable.on('click-cell.bs.table', (e, field, td, row) => {
                if (field === 'edit') {
                    if (row.defunct == 1) {
                        this.showEditModal(row.msg_id, row.content);
                    }
                } else if (field === 'defunct') {
                    this.handleStatusChange({
                        row: row,
                        cid: cid,
                        onUpdate: (updatedRow) => {
                            if (msgTable.data('bootstrap.table')) {
                                msgTable.bootstrapTable('updateByUniqueId', {
                                    id: updatedRow.msg_id,
                                    row: updatedRow
                                });
                            }
                        }
                    });
                } else if (field === 'content') {
                    this.showContentModal([row]);
                }
            });
        }
        
        // 绑定添加消息按钮
        const addMsgBtn = document.getElementById('add_msg_btn');
        if (addMsgBtn) {
            addMsgBtn.addEventListener('click', () => {
                this.showAddModal();
            });
        }
        
        // 绑定预览全部按钮
        const previewAllBtn = document.getElementById('preview_all_msg_btn');
        if (previewAllBtn) {
            previewAllBtn.addEventListener('click', () => {
                if (msgTable.length && msgTable.data('bootstrap.table')) {
                    const allMessages = msgTable.bootstrapTable('getData');
                    this.showContentModal(allMessages);
                }
            });
        }
        
        // 绑定预览公开按钮
        const previewPublicBtn = document.getElementById('preview_public_msg_btn');
        if (previewPublicBtn) {
            previewPublicBtn.addEventListener('click', () => {
                if (msgTable.length && msgTable.data('bootstrap.table')) {
                    const allMessages = msgTable.bootstrapTable('getData');
                    const publicMessages = allMessages.filter(msg => msg.defunct == 0);
                    this.showContentModal(publicMessages);
                }
            });
        }
        
        // 绑定保存按钮
        const saveMessageBtn = document.getElementById('saveMessageBtn');
        if (saveMessageBtn) {
            saveMessageBtn.addEventListener('click', () => {
                this.saveMessage({
                    cid: cid,
                    page_module: page_module,
                    onSuccess: () => {
                        // 保存成功后可以执行额外操作
                    },
                    onError: (error) => {
                        console.error('Failed to save message:', error);
                    }
                });
            });
        }
    }
};

