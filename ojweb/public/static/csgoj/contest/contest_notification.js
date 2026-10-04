/**
 * 公告栏控制器 - 独立面板版本
 * 支持缓存、变化检测、响应式布局、独立显示/收起
 */

// 全局初始化函数
function ContestNotificationInit(config = {}) {
    
    // 如果没有传入配置，尝试从全局获取
    if (!config || Object.keys(config).length === 0) {
        config = window.CONTEST_NOTIFICATION_CONFIG || {};
    }
    
    // 使用单例模式
    if (!window._contestNotificationInstance) {
        window._contestNotificationInstance = new ContestNotificationPanel(config);
    }
    return window._contestNotificationInstance;
}

class ContestNotificationPanel {
    constructor(config = {}) {
        // 配置优先级：实例化参数 > window.CONTEST_NOTIFICATION_CONFIG
        const globalConfig = window.CONTEST_NOTIFICATION_CONFIG || {};
        const mergedConfig = Object.assign({}, globalConfig, config);
        
        // 基本属性
        this.contest_id = mergedConfig.contest_id || null;
        this.module = mergedConfig.module || 'csgoj';
        this.controller = mergedConfig.controller || 'contest';
        this.isContestAdmin = mergedConfig.is_contest_admin === 'true' || mergedConfig.is_contest_admin === true;
        this.proctorAdmin = mergedConfig.proctor_admin === 'true' || mergedConfig.proctor_admin === true;
        this.forceModalMode = mergedConfig.force_modal_mode === true || mergedConfig.force_modal_mode === 'true';
        
        // DOM 元素
        this.toggleBtn = null;
        this.panel = null;
        this.content = null;
        this.contentDiv = null;
        this.isExpanded = false;
        this.eventsBound = false;
        /** @type {{ left: number, top: number } | null} 用户拖拽保存的视口坐标 */
        this.floatPos = null;
        this._floatDragBound = false;
        
        // 缓存相关
        this.CACHE_KEY_PREFIX = 'contest_notification_';
        this.CACHE_EXPIRE_TIME = 30 * 1000; // 30秒缓存
        this.STORE_KEY_UNREAD = 'contest_notification_unread_';
        this.currentContent = '';
        this.checkInterval = null;
        
        // 编辑相关
        this.announcement_edit_modal = null;
        this.announcement_edit_textarea = null;
        this.announcement_edit_save_btn = null;
        
        // 初始化
        this.init();
    }
    
    async init() {
        // 等待 DOM 加载
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.initPanel());
        } else {
            this.initPanel();
        }
    }
    
    initPanel() {
        
        // 获取比赛ID
        if (!this.contest_id) {
            if (window.contestHeaderConfig && window.contestHeaderConfig.contest_id) {
                this.contest_id = window.contestHeaderConfig.contest_id;
            } else {
                const urlParams = new URLSearchParams(window.location.search);
                this.contest_id = urlParams.get('cid');
            }
        }
        
        if (!this.contest_id) {
            return;
        }
        
        // 查找 DOM 元素
        this.toggleBtn = document.getElementById('contest_notification_toggle');
        this.closeBtn = document.getElementById('contest_notification_close_btn');
        this.panel = document.getElementById('contest_notification_panel');
        this.content = document.getElementById('contest_notification_content');
        this.contentDiv = document.getElementById('contest_notification_div');
        
        
        // 编辑相关元素
        this.announcement_edit_modal = document.getElementById('announcement_edit_modal');
        this.announcement_edit_textarea = document.getElementById('announcement_edit_textarea');
        this.announcement_edit_save_btn = document.getElementById('announcement_edit_save_btn');
        
        // 查看完整公告相关元素
        this.announcement_view_modal = document.getElementById('announcement_view_modal');
        this.announcement_view_modal_body = document.getElementById('announcement_view_modal_body');
        
        // 如果强制使用 modal 模式（考试模式），不需要面板
        if (this.forceModalMode) {
            if (!this.toggleBtn || !this.announcement_view_modal) {
                return;
            }
        } else if (!this.panel) {
            const allElements = document.querySelectorAll('[id*="notification"], [class*="notification"]');
            return;
        }
        
        if (!this.toggleBtn) {
            const allButtons = document.querySelectorAll('.contest-header-actions button, .contest-header-actions a');
        }
        
        
        // 绑定事件
        if (!this.eventsBound) {
            this.bindEvents();
            this.eventsBound = true;
        }
        
        this.refreshFloatPosFromStore();
        
        // 加载公告内容（带缓存）
        this.loadNotification();
        
        // 恢复状态（默认展开，除非有保存的收起状态）
        // 注意：先恢复状态，再更新位置，确保状态不被覆盖
        // 在恢复状态时跳过位置更新，延迟 500ms 后再更新位置，确保 team panel 先完成位置计算
        this.restoreState(true);
        
        // 延迟后再更新位置，确保 team panel 先完成位置计算，避免遮挡
        // 在位置更新完成后，再显示面板，避免先显示在错误位置

        setTimeout(() => {
            if (this.isExpanded) {
                this.updatePanelPosition();
            }
        }, 300);
        // 启动定期检查
        this.startPeriodicCheck();
        
        // 监听窗口大小变化
        let resizeTimer;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimer);
            resizeTimer = setTimeout(() => {
                // 如果窗口变窄，关闭侧边栏
                if (this.isNarrowScreen() && this.isExpanded && !this.floatPos) {
                    this.hide();
                } else if (!this.isNarrowScreen()) {
                    // 窗口变宽时，更新位置
                    if (this.isExpanded) {
                        this.updatePanelPosition();
                    }
                }
            }, 100);
        });
        
    }
    
    bindEvents() {
        // 切换按钮
        if (this.toggleBtn) {
            this.toggleBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.toggle();
            });
        }
        
        // 收起按钮
        if (this.closeBtn) {
            this.closeBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.hide();
            });
        }
        
        // 查看完整公告 Modal 显示时更新内容
        if (this.announcement_view_modal) {
            $(this.announcement_view_modal).on('show.bs.modal', () => {
                this.updateViewModalContent();
                // 打开 modal 时标记为已读（强制 modal 模式下）
                if (this.forceModalMode) {
                    this.markAsRead();
                }
            });
        }
        
        // 编辑 Modal 显示时加载内容
        if (this.announcement_edit_modal) {
            $(this.announcement_edit_modal).on('show.bs.modal', () => {
                this.loadNotificationMd();
            });
        }
        
        // 保存按钮
        if (this.announcement_edit_save_btn) {
            this.announcement_edit_save_btn.addEventListener('click', () => {
                this.saveNotification();
            });
        }
        
        // 快捷键支持
        if (this.announcement_edit_textarea) {
            this.announcement_edit_textarea.addEventListener('keydown', (e) => {
                if (e.ctrlKey && e.keyCode === 13) {
                    e.preventDefault();
                    if (this.announcement_edit_save_btn) {
                        this.announcement_edit_save_btn.click();
                    }
                }
            });
        }
        
        // ESC 键关闭面板 - 已移除，不再响应 ESC 键
        // document.addEventListener('keydown', (e) => {
        //     if (e.key === 'Escape' && this.isExpanded) {
        //         this.hide();
        //     }
        // });
        
        this.bindFloatingDrag();
    }
    
    refreshFloatPosFromStore() {
        if (!this.contest_id || !window.ContestFloatingPanel) {
            this.floatPos = null;
            return;
        }
        this.floatPos = ContestFloatingPanel.load(String(this.contest_id), 'notification');
    }
    
    bindFloatingDrag() {
        if (this._floatDragBound || !this.panel || this.forceModalMode || !window.ContestFloatingPanel) return;
        const header = this.panel.querySelector('.contest-notification-panel-header');
        if (!header) return;
        this._floatDragBound = true;
        ContestFloatingPanel.attachDrag({
            panel: this.panel,
            handle: header,
            contestId: String(this.contest_id),
            panelId: 'notification',
            isExpanded: () => this.isExpanded,
            onPositionCommit: (pos) => {
                this.floatPos = pos;
                this.updatePanelPosition();
            },
        });
    }
    
    _prepareLayoutMeasurement() {
        const wasHidden = this.panel.style.display === 'none' ||
            window.getComputedStyle(this.panel).display === 'none';
        let needRestoreVisibility = false;
        if (this.isExpanded) {
            this.panel.style.setProperty('display', 'flex', 'important');
            const currentOpacity = this.panel.style.opacity || window.getComputedStyle(this.panel).opacity;
            const currentVisibility = this.panel.style.visibility || window.getComputedStyle(this.panel).visibility;
            if (currentOpacity === '0' || currentVisibility === 'hidden') {
                this.panel.style.setProperty('visibility', 'hidden', 'important');
                this.panel.style.setProperty('opacity', '0', 'important');
            } else {
                this.panel.style.setProperty('visibility', 'visible', 'important');
            }
        } else if (wasHidden) {
            this.panel.style.setProperty('display', 'flex', 'important');
            this.panel.style.setProperty('visibility', 'hidden', 'important');
            needRestoreVisibility = true;
        } else {
            this.panel.style.setProperty('visibility', 'hidden', 'important');
            needRestoreVisibility = true;
        }
        return { wasHidden, needRestoreVisibility };
    }
    
    _finalizeLayoutMeasurement(wasHidden, needRestoreVisibility) {
        if (this.isExpanded) {
            this.panel.style.setProperty('display', 'flex', 'important');
            this.panel.style.setProperty('visibility', 'visible', 'important');
            requestAnimationFrame(() => {
                this.panel.style.setProperty('transition', 'opacity 0.2s ease-in-out', 'important');
                requestAnimationFrame(() => {
                    this.panel.style.setProperty('opacity', '1', 'important');
                });
            });
        } else {
            if (wasHidden) {
                this.panel.style.setProperty('display', 'none', 'important');
            } else if (needRestoreVisibility) {
                this.panel.style.setProperty('visibility', 'visible', 'important');
                this.panel.style.setProperty('opacity', '1', 'important');
            }
        }
    }
    
    _schedulePanelMaxHeight() {
        if (!this.isExpanded) return;
        requestAnimationFrame(() => {
            const panelRect = this.panel.getBoundingClientRect();
            const currentTop = panelRect.top;
            const bottomMargin = 20;
            const maxAvailableHeight = window.innerHeight - currentTop - bottomMargin;
            const calculatedMaxHeight = Math.max(200, maxAvailableHeight);
            this.panel.style.setProperty('max-height', `${calculatedMaxHeight}px`, 'important');
        });
    }
    
    /**
     * 更新面板位置（根据屏幕宽度决定显示位置）
     */
    updatePanelPosition() {
        if (!this.panel || this._updatePanelPositionRunning) return;
        this._updatePanelPositionRunning = true;
        
        if (this.floatPos && window.ContestFloatingPanel) {
            const prep = this._prepareLayoutMeasurement();
            requestAnimationFrame(() => {
                try {
                    this.floatPos = ContestFloatingPanel.applyFixed(this.panel, this.floatPos);
                    this._finalizeLayoutMeasurement(prep.wasHidden, prep.needRestoreVisibility);
                    this._schedulePanelMaxHeight();
                } finally {
                    this._updatePanelPositionRunning = false;
                }
            });
            return;
        }
        
        // 小屏幕模式：在右侧贴边
        if (window.innerWidth < 1400) {
            // 查找按钮容器
            const buttonContainer = document.querySelector('.contest-header-actions');
            if (buttonContainer) {
                // 使用 absolute 定位，相对于按钮容器
                this.panel.style.setProperty('position', 'absolute', 'important');
                this.panel.style.setProperty('top', '0', 'important');
                this.panel.style.setProperty('right', '0', 'important');
                this.panel.style.setProperty('left', 'auto', 'important');
                this.panel.style.setProperty('transform', 'none', 'important');
            } else {
                // 如果找不到按钮容器，使用 fixed 定位在右侧
                this.panel.style.setProperty('position', 'fixed', 'important');
                this.panel.style.setProperty('top', '0', 'important');
                this.panel.style.setProperty('right', '0', 'important');
                this.panel.style.setProperty('left', 'auto', 'important');
                this.panel.style.setProperty('transform', 'none', 'important');
            }
            this._updatePanelPositionRunning = false;
            return;
        }
        
        // 大屏幕模式：悬浮在 main 区域右侧（自动布局）
        this.panel.style.setProperty('position', 'fixed', 'important');
        this.panel.style.setProperty('top', '0', 'important');
        this.panel.style.setProperty('transform', 'none', 'important');
        
        // 查找 main 容器
        let container = document.querySelector('main');
        if (!container) {
            container = document.querySelector('.container') || 
                       document.querySelector('[style*="max-width"]') ||
                       document.querySelector('.question-list-container');
        }
        
        if (!container) {
            // 如果没有找到容器，使用默认位置
            this.panel.style.setProperty('right', '12px', 'important');
            this.panel.style.setProperty('left', 'auto', 'important');
            this._updatePanelPositionRunning = false;
            return;
        }
        
        const containerRect = container.getBoundingClientRect();
        const minRightMargin = 12;
        const gap = 12;
        
        const { wasHidden, needRestoreVisibility } = this._prepareLayoutMeasurement();
        
        requestAnimationFrame(() => {
            try {
                const panelRect = this.panel.getBoundingClientRect();
            const panelWidth = panelRect.width || this.panel.offsetWidth || 280;
            
            const availableRight = window.innerWidth - containerRect.right;
            
            // 计算队伍面板的位置（如果存在）
            // 使用双重检查，确保获取到准确的位置和尺寸
            const teamPanel = document.getElementById('team_info_panel');
            let teamPanelTop = 0;
            let teamPanelHeight = 0;
            let teamPanelLeft = 0;
            let teamPanelWidth = 0;
            
            if (teamPanel) {
                const teamPanelComputedStyle = window.getComputedStyle(teamPanel);
                const teamPanelDisplay = teamPanelComputedStyle.display;
                const hasShowClass = teamPanel.classList.contains('show');
                
                // 检查 team panel 是否真的显示（display 不是 none，且有 show 类）
                if (teamPanelDisplay !== 'none' && hasShowClass) {
                    const teamPanelRect = teamPanel.getBoundingClientRect();
                    // 确保获取到有效的尺寸（高度和宽度都大于0）
                    if (teamPanelRect.height > 0 && teamPanelRect.width > 0) {
                        teamPanelTop = teamPanelRect.top;
                        teamPanelHeight = teamPanelRect.height;
                        teamPanelLeft = teamPanelRect.left;
                        teamPanelWidth = teamPanelRect.width;
                    }
                }
            }
            
            // 公告面板应该放在队伍面板下方，与队伍面板左对齐
            // 两个面板都使用相同的基准（containerRect.right + gap）来计算 left 位置，确保左对齐
            if (availableRight >= panelWidth + gap) {
                // 有足够空间：放在容器右侧
                // 始终使用 containerRect.right + gap 作为 left 位置，不依赖 team panel 的位置
                const leftPosition = containerRect.right + gap;
                let topPosition = 0;
                
                if (teamPanelWidth > 0 && teamPanelHeight > 0) {
                    // 队伍面板已打开，公告面板放在队伍面板下方
                    topPosition = teamPanelTop + teamPanelHeight + gap;
                } else {
                    // 队伍面板未打开，公告面板放在顶部
                    topPosition = 0;
                }
                
                const rightEdge = leftPosition + panelWidth;
                const maxRight = window.innerWidth - minRightMargin;
                
                if (rightEdge <= maxRight) {
                    // 先清除 right 值，确保 CSS 的 right 规则不会干扰 left 定位
                    this.panel.style.removeProperty('right');
                    this.panel.style.setProperty('right', 'auto', 'important');
                    // 然后设置 left 位置
                    this.panel.style.setProperty('left', `${leftPosition}px`, 'important');
                    this.panel.style.setProperty('top', `${topPosition}px`, 'important');
                } else {
                    // 如果会超出窗口，放在右侧贴边
                    // 先清除 left 值，确保 CSS 的 left 规则不会干扰 right 定位
                    this.panel.style.removeProperty('left');
                    this.panel.style.setProperty('left', 'auto', 'important');
                    this.panel.style.setProperty('right', `${minRightMargin}px`, 'important');
                    // 如果队伍面板已打开，放在队伍面板下方
                    if (teamPanelHeight > 0) {
                        this.panel.style.setProperty('top', `${teamPanelTop + teamPanelHeight + gap}px`, 'important');
                    } else {
                        this.panel.style.setProperty('top', '0', 'important');
                    }
                }
            } else {
                // 空间不足：放在右侧贴边
                this.panel.style.setProperty('left', 'auto', 'important');
                this.panel.style.setProperty('right', `${minRightMargin}px`, 'important');
                // 如果队伍面板已打开，放在队伍面板下方
                if (teamPanelHeight > 0) {
                    this.panel.style.setProperty('top', `${teamPanelTop + teamPanelHeight + gap}px`, 'important');
                } else {
                    this.panel.style.setProperty('top', '0', 'important');
                }
            }
            
                this._finalizeLayoutMeasurement(wasHidden, needRestoreVisibility);
                this._schedulePanelMaxHeight();
            } finally {
                this._updatePanelPositionRunning = false;
            }
        });
    }
    
    /**
     * 检查窗口是否较窄（< 1400px）
     */
    isNarrowScreen() {
        return window.innerWidth < 1400;
    }
    
    toggle() {
        // 如果强制使用 modal 模式（考试模式），或窗口较窄，直接打开 modal 而不是侧边栏
        if (this.forceModalMode || this.isNarrowScreen()) {
            if (this.announcement_view_modal) {
                $(this.announcement_view_modal).modal('show');
            }
            return;
        }
        
        // 宽屏时，正常切换侧边栏
        if (this.isExpanded) {
            this.hide();
        } else {
            this.show();
        }
    }
    
    show(skipPositionUpdate = false) {
        if (!this.panel) {
            return;
        }
        
        // 显示面板 - 使用 requestAnimationFrame 确保样式应用
        requestAnimationFrame(() => {
            this.panel.style.setProperty('display', 'flex', 'important');
            // 如果跳过位置更新，先隐藏面板，等位置计算完成后再显示
            if (skipPositionUpdate) {
                this.panel.style.setProperty('visibility', 'hidden', 'important');
                this.panel.style.setProperty('opacity', '0', 'important');
            } else {
                this.panel.style.setProperty('visibility', 'visible', 'important');
                this.panel.style.setProperty('opacity', '1', 'important');
            }
            this.panel.classList.add('show');
            this.isExpanded = true;
            
            // 按钮添加 active 类，使其变成实心样式（类似 team panel 按钮）
            if (this.toggleBtn) {
                this.toggleBtn.classList.add('active');
            }
            
            // 更新位置（除非跳过）
            if (!skipPositionUpdate) {
                this.updatePanelPosition();
            }
            
            // 标记为已读
            this.markAsRead();
            
            // 保存状态（使用 csg.store，不设 expire）
            this.saveState();
        });
    }
    
    hide() {
        if (!this.panel) {
            return;
        }
        
        // 隐藏面板
        this.panel.style.setProperty('display', 'none', 'important');
        this.panel.classList.remove('show');
        this.isExpanded = false;
        
        // 按钮移除 active 类，恢复 outline 样式
        if (this.toggleBtn) {
            this.toggleBtn.classList.remove('active');
        }
        
        
        // 检查未读状态
        this.checkUnreadStatus();
        
        // 保存状态（使用 csg.store，不设 expire）
        this.saveState();
    }
    
    /**
     * 加载公告内容（带缓存）
     */
    async loadNotification() {
        if (!this.contest_id) return;
        
        const cacheKey = this.CACHE_KEY_PREFIX + this.contest_id;
        
        // 检查缓存
        const cachedData = await window.idb.GetIdb(cacheKey);
        const cacheTime = await window.idb.GetCacheTime(cacheKey);
        const now = Date.now();
        
        // 获取当前页面中的公告内容（首次加载）
        // 优先从侧边栏内容获取，如果没有则从 modal 内容获取（强制 modal 模式）
        if (this.contentDiv) {
            const currentHtml = this.contentDiv.innerHTML;
            if (currentHtml && currentHtml.trim() !== '' && 
                currentHtml.trim() !== '<div class="text-muted">暂无公告<span class="en-text">No announcement</span></div>') {
                this.currentContent = currentHtml;
                // 保存到缓存
                window.idb.SetIdb(cacheKey, currentHtml, this.CACHE_EXPIRE_TIME);
            }
        } else if (this.forceModalMode && this.announcement_view_modal_body) {
            // 强制 modal 模式：从 modal 的初始内容获取
            const modalContent = this.announcement_view_modal_body.querySelector('article.md_display_div');
            if (modalContent) {
                const currentHtml = modalContent.innerHTML;
                if (currentHtml && currentHtml.trim() !== '' && 
                    currentHtml.trim() !== '<div class="text-muted">暂无公告<span class="en-text">No announcement</span></div>') {
                    this.currentContent = currentHtml;
                    // 保存到缓存
                    window.idb.SetIdb(cacheKey, currentHtml, this.CACHE_EXPIRE_TIME);
                }
            }
        }
        
        // 如果缓存未过期（30秒内），使用缓存
        if (cachedData && cacheTime && (now - cacheTime < this.CACHE_EXPIRE_TIME)) {
            // 只在刷新时使用缓存，首次加载使用页面内容
            if (!this.currentContent || this.currentContent.trim() === '') {
                this.updateNotificationContent(cachedData, false);
            }
            return;
        }
        
        // 缓存过期或不存在，请求后端更新
        // 注意：首次加载时使用页面内容，后续刷新才请求API
        if (this.currentContent && this.currentContent.trim() !== '') {
            return;
        }
        
        // 刷新时请求后端
        $.get(`/${this.module}/${this.controller}/contest`, {
            'cid': this.contest_id
        }, (ret) => {
            let notification = null;
            if (ret && ret.contest && ret.contest.notification) {
                notification = ret.contest.notification;
            } else if (ret && ret.notification) {
                notification = ret.notification;
            }
            
            if (notification !== null) {
                // 更新缓存
                window.idb.SetIdb(cacheKey, notification, this.CACHE_EXPIRE_TIME);
                this.updateNotificationContent(notification, true);
            }
        }).fail(() => {
            // 请求失败，如果有缓存则使用缓存
            if (cachedData) {
                this.updateNotificationContent(cachedData, false);
            }
        });
    }
    
    /**
     * 更新公告内容
     */
    updateNotificationContent(htmlContent, checkChange) {
        if (!htmlContent) return;
        
        // 如果强制使用 modal 模式（考试模式），不更新侧边栏内容
        if (this.forceModalMode) {
            // 检查内容是否变化
            if (checkChange && this.currentContent && this.currentContent !== htmlContent) {
                // 内容有变化，标记为未读
                this.markAsUnread();
            }
            // 更新当前内容（用于 modal 显示）
            this.currentContent = htmlContent;
            return;
        }
        
        // 非强制 modal 模式，正常更新侧边栏内容
        if (!this.contentDiv) return;
        
        // 检查内容是否变化
        if (checkChange && this.currentContent && this.currentContent !== htmlContent) {
            // 内容有变化，标记为未读
            this.markAsUnread();
        } else if (!checkChange) {
            // 使用缓存，不检查变化
            if (this.currentContent !== htmlContent) {
                this.currentContent = htmlContent;
                this.contentDiv.innerHTML = htmlContent;
                // 触发数学公式渲染
                this.renderMathJax();
            }
            return;
        }
        
        this.currentContent = htmlContent;
        this.contentDiv.innerHTML = htmlContent;
        
        // 触发数学公式渲染（延迟执行，确保 DOM 已更新）
        this.renderMathJax();
        
        // 如果展开状态，自动标记为已读
        if (this.isExpanded && checkChange) {
            this.markAsRead();
        }
    }
    
    /**
     * 渲染数学公式
     * 后端返回的 HTML 已经包含数学公式渲染，通常无需额外处理
     * 如果后端使用 Pandoc 的 --katex 选项，公式已经渲染完成
     */
    renderMathJax() {
        if (!this.contentDiv) return;
        
        // 使用 setTimeout 确保 DOM 已完全更新
        setTimeout(() => {
            // 使用 MathRender 函数（如果存在）
            if (typeof MathRender === 'function') {
                MathRender('.md_display_div', this.contentDiv, true);
            } else if (typeof MathjaxRender === 'function') {
                // 兼容旧函数名
                MathjaxRender('.md_display_div', this.contentDiv, true);
            }
            // 注意：如果后端使用 Pandoc 的 --katex 选项，公式已经渲染完成，无需额外处理
        }, 100);
    }
    
    /**
     * 检查公告更新
     */
    async checkNotificationUpdate() {
        if (!this.contest_id) return;
        
        const cacheKey = this.CACHE_KEY_PREFIX + this.contest_id;
        const cacheTime = await window.idb.GetCacheTime(cacheKey);
        const now = Date.now();
        
        // 如果缓存未过期，不检查
        if (cacheTime && (now - cacheTime < this.CACHE_EXPIRE_TIME)) {
            return;
        }
        
        // 缓存过期，请求更新
        $.get(`/${this.module}/${this.controller}/contest`, {
            'cid': this.contest_id
        }, (ret) => {
            let notification = null;
            if (ret && ret.contest && ret.contest.notification) {
                notification = ret.contest.notification;
            } else if (ret && ret.notification) {
                notification = ret.notification;
            }
            
            if (notification !== null) {
                // 检查内容是否变化
                const hasChanged = this.currentContent && this.currentContent !== notification;
                
                // 更新缓存
                window.idb.SetIdb(cacheKey, notification, this.CACHE_EXPIRE_TIME);
                
                // 更新内容（如果内容变化，会自动标记为未读）
                if (hasChanged) {
                    this.updateNotificationContent(notification, true);
                } else {
                    // 内容未变化，只更新缓存
                    this.currentContent = notification;
                }
            }
        }).fail(() => {
            // 请求失败，忽略
        });
    }
    
    /**
     * 启动定期检查
     */
    startPeriodicCheck() {
        // 清除旧的定时器
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
        }
        
        // 每30秒检查一次公告更新
        this.checkInterval = setInterval(() => {
            this.checkNotificationUpdate();
        }, this.CACHE_EXPIRE_TIME);
    }
    
    /**
     * 标记为未读
     */
    markAsUnread() {
        if (!this.contest_id) return;
        const storeKey = this.STORE_KEY_UNREAD + this.contest_id;
        if (window.csg && window.csg.store) {
            window.csg.store(storeKey, true);
        }
        this.updateUnreadIndicator(true);
    }
    
    /**
     * 标记为已读
     */
    markAsRead() {
        if (!this.contest_id) return;
        const storeKey = this.STORE_KEY_UNREAD + this.contest_id;
        if (window.csg && window.csg.store) {
            window.csg.store(storeKey, false);
        }
        this.updateUnreadIndicator(false);
    }
    
    /**
     * 更新未读指示器
     */
    updateUnreadIndicator(isUnread) {
        if (!this.toggleBtn) return;
        
        // 强制 modal 模式下，只要未读就显示提示（因为不展开侧边栏）
        if (isUnread && (this.forceModalMode || !this.isExpanded)) {
            // 未读状态下，按钮显示红色提示
            this.toggleBtn.classList.add('has-unread');
        } else {
            this.toggleBtn.classList.remove('has-unread');
        }
    }
    
    /**
     * 更新查看完整公告 Modal 的内容
     */
    updateViewModalContent() {
        if (!this.announcement_view_modal_body) return;
        
        const modalContent = this.announcement_view_modal_body.querySelector('article.md_display_div');
        if (!modalContent) return;
        
        // 优先使用 currentContent（支持强制 modal 模式）
        if (this.currentContent) {
            modalContent.innerHTML = this.currentContent;
            // 触发数学公式渲染（延迟执行，确保 DOM 已更新）
            setTimeout(() => {
                // 使用 MathRender 或 MathjaxRender 函数（如果存在）
                if (typeof MathRender === 'function') {
                    MathRender('.md_display_div', this.announcement_view_modal_body, true);
                } else if (typeof MathjaxRender === 'function') {
                    MathjaxRender('.md_display_div', this.announcement_view_modal_body, true);
                }
            }, 100);
            return;
        }
        
        // 如果没有 currentContent，从侧边栏内容中复制
        if (this.contentDiv && this.contentDiv.innerHTML) {
            modalContent.innerHTML = this.contentDiv.innerHTML;
            // 触发数学公式渲染（延迟执行，确保 DOM 已更新）
            setTimeout(() => {
                // 使用 MathRender 或 MathjaxRender 函数（如果存在）
                if (typeof MathRender === 'function') {
                    MathRender('.md_display_div', this.announcement_view_modal_body, true);
                } else if (typeof MathjaxRender === 'function') {
                    MathjaxRender('.md_display_div', this.announcement_view_modal_body, true);
                }
            }, 100);
        } else {
            // 如果面板内容不存在，从缓存或服务器加载
            this.loadNotification().then(() => {
                if (this.currentContent) {
                    modalContent.innerHTML = this.currentContent;
                } else if (this.contentDiv && this.contentDiv.innerHTML) {
                    modalContent.innerHTML = this.contentDiv.innerHTML;
                }
                
                // 触发数学公式渲染
                setTimeout(() => {
                    if (typeof MathRender === 'function') {
                        MathRender('.md_display_div', this.announcement_view_modal_body, true);
                    } else if (typeof MathjaxRender === 'function') {
                        MathjaxRender('.md_display_div', this.announcement_view_modal_body, true);
                    }
                }, 100);
            });
        }
    }
    
    /**
     * 检查未读状态
     */
    checkUnreadStatus() {
        if (!this.contest_id) return;
        const storeKey = this.STORE_KEY_UNREAD + this.contest_id;
        if (window.csg && window.csg.store) {
            const isUnread = window.csg.store(storeKey);
            if (isUnread) {
                this.updateUnreadIndicator(true);
            }
        }
    }
    
    /**
     * 保存状态（使用 csg.store，不设 expire，key 包含 contest id）
     */
    saveState() {
        if (!this.contest_id) return;
        const stateKey = 'contest_notification_expanded_' + this.contest_id;
        if (window.csg && window.csg.store) {
            // 使用 csg.store，不设 expire（第三个参数不传或传 null）
            window.csg.store(stateKey, this.isExpanded);
        } else {
            localStorage.setItem(stateKey, this.isExpanded ? '1' : '0');
        }
    }
    
    /**
     * 恢复状态（默认展开，除非有保存的收起状态）
     * 如果 team panel 和公告都没有缓存，默认打开公告并缓存
     * 注意：窗口较窄时（< 1400px），不自动打开公告
     * @param {boolean} skipPositionUpdate - 是否跳过位置更新（用于初始化时延迟更新）
     */
    restoreState(skipPositionUpdate = false) {
        if (!this.contest_id) {
            return;
        }
        
        if (!this.panel) {
            return;
        }
        
        // 如果窗口较窄，不自动打开公告
        if (this.isNarrowScreen()) {
            this.isExpanded = false;
            this.hide();
            // 检查未读状态
            this.checkUnreadStatus();
            return;
        }
        
        const stateKey = 'contest_notification_expanded_' + this.contest_id;
        const teamPanelStateKey = `flg_tinfo_show_${this.contest_id}`;
        let savedState = null;
        let teamPanelState = null;
        
        // 检查 team panel 和公告的状态缓存
        if (window.csg && window.csg.store) {
            savedState = window.csg.store(stateKey);
            teamPanelState = window.csg.store(teamPanelStateKey);
        } else {
            // 降级到 localStorage
            const localValue = localStorage.getItem(stateKey);
            savedState = localValue === null ? null : (localValue === '1');
            const teamPanelLocalValue = localStorage.getItem(teamPanelStateKey);
            teamPanelState = teamPanelLocalValue === null ? null : (teamPanelLocalValue === '1');
        }
        
        // 如果 team panel 和公告都没有缓存，默认打开公告并缓存
        const hasNotificationState = savedState !== null && savedState !== undefined;
        const hasTeamPanelState = teamPanelState !== null && teamPanelState !== undefined;
        
        if (!hasNotificationState && !hasTeamPanelState) {
            // 两者都没有缓存，默认打开公告并缓存
            this.isExpanded = true;
            this.show(skipPositionUpdate);
            // 保存状态（会自动调用 saveState）
        } else if (!hasNotificationState) {
            // 只有公告没有缓存，默认展开
            this.isExpanded = true;
            this.show(skipPositionUpdate);
        } else {
            // 使用保存的状态
            // 处理可能的值类型：布尔值、字符串 "true"/"false"、数字 1/0
            let shouldExpand = false;
            if (typeof savedState === 'boolean') {
                shouldExpand = savedState;
            } else if (typeof savedState === 'string') {
                shouldExpand = savedState === 'true' || savedState === '1';
            } else if (typeof savedState === 'number') {
                shouldExpand = savedState !== 0;
            } else {
                shouldExpand = Boolean(savedState);
            }
            this.isExpanded = shouldExpand;
            if (shouldExpand) {
                this.show(skipPositionUpdate);
            } else {
                this.hide();
            }
        }
        
        // 检查未读状态
        this.checkUnreadStatus();
    }
    
    /**
     * 加载 Markdown 内容到编辑框
     */
    loadNotificationMd() {
        $.get(`/${this.module}/${this.controller}/notification_md_ajax`, {
            'cid': this.contest_id
        }, (ret) => {
            if (ret && ret.code == 1 && this.announcement_edit_textarea) {
                this.announcement_edit_textarea.value = ret.data || '';
            }
        });
    }
    
    /**
     * 保存公告
     */
    saveNotification() {
        if (!this.announcement_edit_textarea) return;
        
        const notification = this.announcement_edit_textarea.value.trim();
        
        if (notification.length == 0) {
            alerty.confirm({
                message: '公告内容已清空，确定要提交吗？',
                message_en: 'Announcement is cleared. Are you sure to submit?',
                callback: () => {
                    this.doSaveNotification(notification);
                },
                callbackCancel: () => {
                    alerty.message('已取消', 'Canceled');
                }
            });
        } else if (notification.length < 16384) {
            this.doSaveNotification(notification);
        } else {
            alerty.error('公告内容过长', 'Announcement too long');
        }
    }
    
    /**
     * 执行保存
     */
    doSaveNotification(notification) {
        if (!this.announcement_edit_save_btn) return;
        
        const $btn = $(this.announcement_edit_save_btn);
        this.announcement_edit_save_btn.disabled = true;
        // 不修改按钮文字，只禁用按钮
        
        $.post(`/${this.module}/${this.controller}/notification_change_ajax`, {
            'cid': this.contest_id,
            'notification_md': notification
        }, (ret) => {
            // 如果返回的是字符串，尝试解析为 JSON
            if (ret && typeof ret === 'string') {
                try {
                    ret = JSON.parse(ret);
                } catch(e) {
                    console.error('Failed to parse response:', e);
                    alerty.error('响应解析失败', 'Failed to parse response');
                    this.announcement_edit_save_btn.disabled = false;
                    return;
                }
            }
            
            if (ret && ret.code == 1) {
                // 根据后端返回的标记显示详细的中英双语消息
                const msgCode = ret.msg || 'success';
                const messages = {
                    'success': { cn: '公告已更新', en: 'Notification updated' }
                };
                const message = messages[msgCode] || { cn: '保存成功', en: 'Save successful' };
                alerty.success(message.cn, message.en);
                
                // 使用 updateNotificationContent 方法统一更新内容（会触发数学公式渲染）
                const description = ret.data;
                
                // 清除缓存，强制刷新
                const cacheKey = this.CACHE_KEY_PREFIX + this.contest_id;
                window.idb.DelIdb(cacheKey);
                
                // 更新缓存
                window.idb.SetIdb(cacheKey, description, this.CACHE_EXPIRE_TIME);
                
                // 使用统一的方法更新内容（会触发数学公式渲染）
                this.updateNotificationContent(description, false);
                
                // 恢复按钮状态（在关闭 Modal 之前）
                this.announcement_edit_save_btn.disabled = false;
                
                // 延迟关闭 Modal，确保按钮状态已恢复
                setTimeout(() => {
                    if (this.announcement_edit_modal) {
                        $(this.announcement_edit_modal).modal('hide');
                    }
                }, 100);
            } else {
                // 根据后端返回的标记显示详细的中英双语错误消息
                const msgCode = ret.msg || 'unknown_error';
                const errorMessages = {
                    'permission_denied': { cn: '权限不足，无法修改公告', en: 'Permission denied to change contest notification' },
                    'too_long': { cn: '公告内容过长', en: 'Notification too long' },
                    'unknown_error': { cn: '保存失败', en: 'Save failed' }
                };
                const errorMsg = errorMessages[msgCode] || errorMessages['unknown_error'];
                alerty.error(errorMsg.cn, errorMsg.en);
                // 恢复按钮状态
                this.announcement_edit_save_btn.disabled = false;
            }
        }, 'json').fail((xhr, status, error) => {
            console.error('Save notification failed:', status, error, xhr);
            alerty.error('保存失败', 'Save failed');
            // 恢复按钮状态
            this.announcement_edit_save_btn.disabled = false;
        });
    }
    
    /**
     * 清理资源
     */
    destroy() {
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
            this.checkInterval = null;
        }
        document.body.style.userSelect = '';
    }
}

// 页面卸载时清理
window.addEventListener('beforeunload', () => {
    if (window._contestNotificationInstance) {
        window._contestNotificationInstance.destroy();
    }
});

// 自动初始化（如果配置存在）

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        if (window.CONTEST_NOTIFICATION_CONFIG || window.contestHeaderConfig) {
            ContestNotificationInit();
        } else {
        }
    });
} else {
    if (window.CONTEST_NOTIFICATION_CONFIG || window.contestHeaderConfig) {
        ContestNotificationInit();
    } else {
    }
}
