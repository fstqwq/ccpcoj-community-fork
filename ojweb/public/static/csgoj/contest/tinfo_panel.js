/**
 * 队伍信息面板控制器
 * 继承 RankSystem，实现展开/收起功能和状态持久化
 */
class TeamInfoPanel extends RankSystem {
    constructor(config = {}) {
        // 配置优先级：实例化参数 > window.TEAM_INFO_PANEL_CONFIG
        const globalConfig = window.TEAM_INFO_PANEL_CONFIG || {};
        const mergedConfig = RankToolMergeConfig(globalConfig, config);
        
        // 设置 RankSystem 的默认配置（外部模式，不创建自己的DOM）
        const rankConfig = {
            flg_show_page_contest_title: false,
            flg_show_fullscreen_contest_title: false,
            flg_rank_cache: mergedConfig.flg_rank_cache !== undefined ? mergedConfig.flg_rank_cache : true,
            flg_show_time_progress: false,
            flg_show_controls_toolbar: false,
            flg_show_team_id: false,
            api_url: mergedConfig.api_url,
            rank_mode: mergedConfig.rank_mode,
            key: `team_info_${mergedConfig.contest_id || mergedConfig.key || 'default'}`,
            cid_list: mergedConfig.cid_list || mergedConfig.contest_id || null,
            backend_time_diff: mergedConfig.backend_time_diff || 0
        };
        
        // 调用父类构造函数（使用一个不存在的容器ID，强制外部模式）
        super('team_info_external_mode', rankConfig);
        
        // 面板相关属性
        this.contest_id = mergedConfig.contest_id || null;
        this.module = mergedConfig.module || null;
        this.team_id = mergedConfig.team_id || null;
        /** 无本地缓存时是否默认展开面板（参赛队 true；比赛内 staff 账号 false） */
        this.defaultNoCacheExpanded =
            mergedConfig.default_no_cache_expanded !== undefined
                ? !!mergedConfig.default_no_cache_expanded
                : true;
        this.toggleBtn = null;
        this.closeBtn = null;
        this.panel = null;
        this.logoutBtn = null;
        this.isExpanded = false;
        this.updateInterval = null;
        this.initRetryCount = 0;
        this.maxInitRetries = 10; // 最多重试10次（1秒）
        /** @type {{ left: number, top: number } | null} */
        this.floatPos = null;
        this._floatDragBound = false;
        /** 打开时入场动画的兜底清理（避免与拖拽结束的 contest-float-panel-dragging 叠放重播动画） */
        this._teamIntroCleanupFn = null;
        /** 窄屏下队伍面板为 position:fixed，须随页面滚动重新锚定右上角按钮 */
        this._compactScrollListenerOn = false;
        /** @type {Record<string, string>|null} problem_id -> 首次 AC 时间（my_solve_ajax） */
        this.mySolveAcByProblem = null;
        /** @type {number|null} 封榜时刻毫秒（my_solve_ajax.close_rank_time） */
        this.mySolveCloseRankMs = null;
        /** @type {Promise<void>|null} 成绩区加载互斥，避免 init / show / 定时器并发 */
        this._scoreLoadPromise = null;
        /** 合并一帧内多次公告布局请求，避免与队伍面板 updatePanelPosition 互调闪动 */
        this._notificationLayoutRaf = 0;
        this._onCompactViewportScroll = () => {
            if (!this.isExpanded || !this.panel) return;
            if (window.innerWidth >= 1400) return;
            if (this.floatPos && window.ContestFloatingPanel) return;
            this.updatePanelPosition();
        };
        
        // 注意：RankSystem 的构造函数会调用 this.Init()，所以不需要在这里调用 initPanel()
    }
    
    /**
     * 重写 Init 方法，先调用父类 Init，然后初始化面板
     */
    Init() {
        // 调用父类 Init（会设置 externalMode = true）
        super.Init();
        
        // 初始化面板功能（延迟初始化，等待 DOM 准备好）
        this.initPanel();
    }
    
    initPanel() {
        // 延迟初始化，等待 DOM 准备好
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                this.initRetryCount = 0;
                this.initPanel();
            });
            return;
        }
        
        // 检查重试次数
        if (this.initRetryCount >= this.maxInitRetries) {
            return;
        }
        
        // 获取DOM元素
        this.toggleBtn = document.getElementById('team_info_toggle');
        this.closeBtn = document.getElementById('team_info_close_btn');
        this.panel = document.getElementById('team_info_panel');
        this.logoutBtn = document.getElementById('contest_logout_button');
        
        // logoutBtn 在 csgoj/expsys 等“系统用户模式”下可能不存在（不提供比赛内登出）
        // 不能因为缺少 logoutBtn 导致整个面板初始化失败
        if (!this.toggleBtn || !this.panel) {
            // 如果元素未找到，尝试延迟重试
            this.initRetryCount++;
            setTimeout(() => {
                this.initPanel();
            }, 100);
            return;
        }
        
        // 重置重试计数器
        this.initRetryCount = 0;
        
        this.floatPos = window.ContestFloatingPanel
            ? ContestFloatingPanel.load(String(this.contest_id), 'team_info')
            : null;
        
        // 绑定事件
        this.bindEvents();
        
        // 更新关闭按钮的显示状态
        this.updateCloseButtonVisibility();
        
        // 监听窗口大小变化，更新面板位置和关闭按钮显示
        window.addEventListener('resize', () => {
            this.updatePanelPosition();
            this.updateCloseButtonVisibility();
            this._ensureCompactScrollListener(
                this.isExpanded
                && window.innerWidth < 1400
                && !(this.floatPos && window.ContestFloatingPanel),
            );
        });
        
        // 恢复状态（先恢复状态，再更新位置）
        this.restoreState();
        
        // 更新面板位置（在恢复状态之后，确保位置计算正确）
        // 使用 requestAnimationFrame 确保状态恢复完成后再计算位置
        requestAnimationFrame(() => {
            this.updatePanelPosition();
        });
        
        // 初始化成绩系统
        this.initScoreSystem();
    }
    
    /**
     * 更新关闭按钮的显示状态
     * 窗口较窄（< 1400px）时隐藏，窗口较宽时显示
     */
    updateCloseButtonVisibility() {
        if (!this.closeBtn) return;
        
        if (window.innerWidth < 1400) {
            // 窗口较窄，隐藏关闭按钮（使用 !important 确保覆盖其他样式）
            this.closeBtn.style.setProperty('display', 'none', 'important');
        } else {
            // 窗口较宽，显示关闭按钮
            this.closeBtn.style.setProperty('display', '', 'important');
        }
    }
    
    bindEvents() {
        // 队伍信息切换按钮
        this.toggleBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.toggle();
        });
        
        // 收起按钮
        if (this.closeBtn) {
            this.closeBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.hide();
            });
        }
        
        // 登出按钮（可选：仅 cpcsys/examsys 使用 cpc_team 的比赛内登出）
        if (this.logoutBtn) {
            this.logoutBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.handleLogout();
            });
        }
        
        // ESC键关闭面板 - 已移除，不再响应 ESC 键
        // document.addEventListener('keydown', (e) => {
        //     if (e.key === 'Escape' && this.isExpanded) {
        //         this.hide();
        //     }
        // });
        
        this.bindTeamFloatingDrag();
    }
    
    bindTeamFloatingDrag() {
        if (this._floatDragBound || !this.panel || !window.ContestFloatingPanel) return;
        const header = this.panel.querySelector('.team-info-panel-header');
        if (!header) return;
        this._floatDragBound = true;
        ContestFloatingPanel.attachDrag({
            panel: this.panel,
            handle: header,
            contestId: String(this.contest_id),
            panelId: 'team_info',
            isExpanded: () => this.isExpanded,
            onPositionCommit: (pos) => {
                this.floatPos = pos;
                this.updatePanelPosition();
            },
        });
    }
    
    toggle() {
        // 检查元素是否存在
        if (!this.panel || !this.toggleBtn) {
            // 如果元素不存在，尝试重新初始化
            this.initPanel();
            if (!this.panel || !this.toggleBtn) {
                return;
            }
        }
        
        if (this.isExpanded) {
            this.hide();
        } else {
            this.show();
        }
    }
    
    show(flg_save=true) {
        // 检查元素是否存在
        if (!this.panel || !this.toggleBtn) {
            // 如果元素不存在，尝试重新初始化
            this.initPanel();
            if (!this.panel || !this.toggleBtn) {
                return;
            }
        }
        
        // 先显示面板（但暂时不可见），以便获取实际尺寸
        this.panel.style.display = 'block';
        this.panel.style.visibility = 'hidden';
        this.panel.style.opacity = '0';
        
        // 更新面板位置（如果在大屏幕上）- 现在面板已显示，可以获取实际尺寸
        this.updatePanelPosition();
        
        // 更新关闭按钮的显示状态
        this.updateCloseButtonVisibility();
        
        // 恢复可见性
        this.panel.style.visibility = '';
        this.panel.style.opacity = '';
        if (this._teamIntroCleanupFn) {
            this._teamIntroCleanupFn();
        }
        const vm = this;
        this.panel.classList.add('show');
        const panelEl = this.panel;
        let introTimer = null;
        const cleanupIntro = () => {
            if (introTimer != null) {
                clearTimeout(introTimer);
                introTimer = null;
            }
            panelEl.classList.remove('team-info-panel-intro');
            panelEl.removeEventListener('animationend', onIntroEnd);
            if (vm._teamIntroCleanupFn === cleanupIntro) {
                vm._teamIntroCleanupFn = null;
            }
        };
        const onIntroEnd = (ev) => {
            if (ev.target !== panelEl) {
                return;
            }
            const n = ev.animationName || '';
            if (n.indexOf('slideInRight') === -1 && n.indexOf('slideDown') === -1) {
                return;
            }
            cleanupIntro();
        };
        panelEl.classList.add('team-info-panel-intro');
        panelEl.addEventListener('animationend', onIntroEnd);
        vm._teamIntroCleanupFn = cleanupIntro;
        introTimer = setTimeout(cleanupIntro, 450);
        this.toggleBtn.classList.add('active');
        this.isExpanded = true;
        if(flg_save) {
            this.saveState(true);
        }
        this._ensureCompactScrollListener(
            window.innerWidth < 1400 && !(this.floatPos && window.ContestFloatingPanel),
        );
        
        if (this.OuterIsDataLoaded() && this.mySolveAcByProblem != null) {
            this.processScoreData();
        } else {
            void this.refreshScoreIfNeeded();
        }
        this._scheduleNotificationLayout();
    }
    
    hide(flg_save=true) {
        // 检查元素是否存在
        if (!this.panel || !this.toggleBtn) {
            // 如果元素不存在，尝试重新初始化
            this.initPanel();
            if (!this.panel || !this.toggleBtn) {
                return;
            }
        }
        
        if (this._teamIntroCleanupFn) {
            this._teamIntroCleanupFn();
        }
        this.panel.classList.remove('team-info-panel-intro');
        // 先移除show类，然后强制设置display为none（使用!important覆盖CSS）
        this.panel.classList.remove('show');
        this.panel.style.setProperty('display', 'none', 'important');
        this.toggleBtn.classList.remove('active');
        this.isExpanded = false;
        this._ensureCompactScrollListener(false);
        if(flg_save) {
            this.saveState(false);
        }
        
        this._scheduleNotificationLayout();
    }

    /** 队伍面板布局变更后，通知公告面板重算 top（单向，勿回调队伍面板） */
    _scheduleNotificationLayout() {
        if (this._notificationLayoutRaf) {
            return;
        }
        this._notificationLayoutRaf = requestAnimationFrame(() => {
            this._notificationLayoutRaf = 0;
            const n = window._contestNotificationInstance;
            if (n && typeof n.updatePanelPosition === 'function') {
                n.updatePanelPosition();
            }
        });
    }
    
    saveState(isExpanded) {
        if (!this.contest_id) {
            return;
        }
        
        const stateKey = `flg_tinfo_show_${this.contest_id}`;
        try {
            // 使用 csg.store，不设 expire（第三个参数不传或传 null）
            if (window.csg && window.csg.store) {
                window.csg.store(stateKey, isExpanded);
            } else {
                // 降级到 localStorage
                localStorage.setItem(stateKey, isExpanded ? '1' : '0');
            }
        } catch (e) {
        }
    }
    
    restoreState() {
        if (!this.contest_id) {
            return;
        }
        
        const stateKey = `flg_tinfo_show_${this.contest_id}`;
        try {
            let isExpanded = null;  // null 表示没有保存的状态
            
            // 从 csg.store 读取保存的状态
            if (window.csg && window.csg.store) {
                const stored = window.csg.store(stateKey);
                if (stored !== null && stored !== undefined) {
                    // 处理可能的值类型：布尔值、字符串 "true"/"false"、数字 1/0
                    if (typeof stored === 'boolean') {
                        isExpanded = stored;
                    } else if (typeof stored === 'string') {
                        isExpanded = stored === 'true' || stored === '1';
                    } else if (typeof stored === 'number') {
                        isExpanded = stored !== 0;
                    } else {
                        isExpanded = Boolean(stored);
                    }
                }
            } else {
                // 降级到 localStorage
                const localValue = localStorage.getItem(stateKey);
                if (localValue !== null) {
                    isExpanded = localValue === '1';
                }
            }
            
            // 如果没有保存的状态，按账号类型默认：参赛队展开，staff 收起
            if (isExpanded === null || isExpanded === undefined) {
                isExpanded = this.defaultNoCacheExpanded;
            }
            
            
            if (isExpanded) {
                this.show(false);
            } else {
                this.hide(false);
            }
        } catch (e) {
        }
    }
    
    /**
     * 更新面板位置（根据屏幕宽度决定显示位置）
     * 参考 ex_question_list.js 的 updateNavMenuPosition 实现
     */
    updatePanelPosition() {
        if (!this.panel) return;
        
        // 更新关闭按钮的显示状态（在更新位置之前）
        this.updateCloseButtonVisibility();
        
        if (this.floatPos && window.ContestFloatingPanel) {
            this.floatPos = ContestFloatingPanel.applyFixed(this.panel, this.floatPos);
            this._scheduleNotificationLayout();
            return;
        }
        
        // 小屏幕：视口级 fixed，避免主内容区（如榜单 sticky 表头）后绘制盖住 header 内的 absolute 层
        if (window.innerWidth < 1400) {
            const buttonContainer = document.querySelector('.contest-header-actions');
            if (buttonContainer) {
                const ar = buttonContainer.getBoundingClientRect();
                this.panel.style.setProperty('position', 'fixed', 'important');
                this.panel.style.setProperty('top', `${Math.round(ar.top)}px`, 'important');
                this.panel.style.setProperty('right', `${Math.round(window.innerWidth - ar.right)}px`, 'important');
                this.panel.style.setProperty('left', 'auto', 'important');
                this.panel.style.setProperty('transform', 'none', 'important');
            } else {
                this.panel.style.setProperty('position', 'fixed', 'important');
                this.panel.style.setProperty('top', '0', 'important');
                this.panel.style.setProperty('right', '12px', 'important');
                this.panel.style.setProperty('left', 'auto', 'important');
            }
            return;
        }
        
        // 大屏幕模式：面板悬浮在右侧
        // 强制设置 position: fixed（大屏幕模式），使用 !important 覆盖 CSS
        this.panel.style.setProperty('position', 'fixed', 'important');
        // 面板顶部与main区域顶部对齐
        this.panel.style.setProperty('top', '0', 'important');
        this.panel.style.setProperty('transform', 'none', 'important');
        
        // 查找main容器或内容容器
        let container = document.querySelector('main');
        if (!container) {
            // 如果没有main，尝试查找其他内容容器
            container = document.querySelector('.container') || 
                       document.querySelector('[style*="max-width"]') ||
                       document.querySelector('.question-list-container');
        }
        
        if (!container) {
            // 如果没有找到容器，使用CSS默认位置
            this.panel.style.right = '';
            this.panel.style.left = '';
            return;
        }
        
        // 获取容器的位置和尺寸（参考代码的实现方式）
        const containerRect = container.getBoundingClientRect();
        
        // 等待一帧，确保 position: fixed 已应用
        requestAnimationFrame(() => {
            // 再次检查 position，确保是 fixed
            const currentStyle = window.getComputedStyle(this.panel);
            if (currentStyle.position !== 'fixed') {
                this.panel.style.setProperty('position', 'fixed', 'important');
            }
            
            // 获取面板的实际尺寸（面板必须已显示才能获取准确尺寸）
            const panelRect = this.panel.getBoundingClientRect();
            const panelWidth = panelRect.width || this.panel.offsetWidth || 280;
            
            const availableRight = window.innerWidth - containerRect.right;
            const gap = 12; // 面板与容器的间距
            const minRightMargin = 12; // 距离屏幕右边缘的最小距离
            
            // 计算位置：基于 main 容器的右侧位置，确保位置稳定
            // 两个面板都使用相同的基准（containerRect.right + gap）来计算 left 位置，确保左对齐
            if (availableRight >= panelWidth + gap) {
                // 有足够空间：放在容器右侧
                // 始终使用 containerRect.right + gap 作为 left 位置，不依赖公告面板的位置
                const leftPosition = containerRect.right + gap;
                const topPosition = 0;
                
                const rightEdge = leftPosition + panelWidth;
                const maxRight = window.innerWidth - minRightMargin;
                
                // 边界检查：确保面板不会超出窗口
                if (rightEdge <= maxRight) {
                    // 先清除 right 值，确保 CSS 的 right 规则不会干扰 left 定位
                    this.panel.style.removeProperty('right');
                    this.panel.style.setProperty('right', 'auto', 'important');
                    // 然后设置 left 位置
                    this.panel.style.setProperty('left', `${leftPosition}px`, 'important');
                    this.panel.style.setProperty('top', `${topPosition}px`, 'important');
                } else {
                    // 如果会超出窗口，回退到右上角固定位置
                    // 先清除 left 值，确保 CSS 的 left 规则不会干扰 right 定位
                    this.panel.style.removeProperty('left');
                    this.panel.style.setProperty('left', 'auto', 'important');
                    this.panel.style.setProperty('right', `${minRightMargin}px`, 'important');
                    this.panel.style.setProperty('top', `${topPosition}px`, 'important');
                }
            } else {
                // 空间不足：回退到右上角固定位置（使用right定位）
                this.panel.style.setProperty('left', 'auto', 'important');
                this.panel.style.setProperty('right', `${minRightMargin}px`, 'important');
                this.panel.style.setProperty('top', '0', 'important');
            }
            
            this._scheduleNotificationLayout();
        });
    }
    
    handleLogout() {
        if (!this.contest_id) {
            return;
        }
        window.alerty.confirm({
            message: '确定要登出吗？',
            message_en: 'Are you sure you want to logout?',
            title: '确认登出',
            titleEn: 'Confirm Logout',
            okText: '确定',
            okTextEn: 'Confirm',
            cancelText: '取消',
            cancelTextEn: 'Cancel',
            callback: () => {
                this.performLogout();
            },
        });
    }
    
    performLogout() {
        const logoutUrl = `/${this.module}/contest/contest_logout_ajax?cid=${this.contest_id}`;

        $.get(logoutUrl, {}, (rep) => {
            if (rep.code == 1) {
                alerty.success("登出成功", "Logout successful");
                // 延迟刷新页面
                setTimeout(() => {
                    location.reload();
                }, 500);
            } else {
                alerty.error(rep.msg || '登出失败', 'Logout failed');
            }
        }).fail(() => {
            alerty.error('登出请求失败，请重试', 'Logout request failed, please try again');
        });
    }
    
    async initScoreSystem() {
        if (!document.querySelector('.team-score-content')) {
            return;
        }
        try {
            await this._ensureScoreDataLoaded({ force: true });
            this.processScoreData();
            this.setupAutoUpdate();
        } catch (error) {
            console.error('[TeamInfoPanel] initScoreSystem', error);
            this.showError('加载成绩数据失败');
        }
    }

    /**
     * 外部模式须直接 OriInit：RankSystem.applyFreshContestData 对 externalMode 为空操作。
     */
    _ingestContestPayload(rawData) {
        if (!rawData) {
            return false;
        }
        let payload;
        try {
            payload =
                typeof structuredClone === 'function'
                    ? structuredClone(rawData)
                    : JSON.parse(JSON.stringify(rawData));
        } catch (eClone) {
            console.error('[TeamInfoPanel] _ingestContestPayload clone failed', eClone);
            return false;
        }
        this.OriInit(payload);
        return true;
    }

    _isContestPayloadUsable(payload) {
        return !!(
            payload
            && typeof payload === 'object'
            && Array.isArray(payload.problem)
            && payload.problem.length > 0
        );
    }

    _getContestIdForPanel() {
        if (this.contest_id != null && this.contest_id !== '') {
            return String(this.contest_id);
        }
        if (this.config.cid_list != null && this.config.cid_list !== '') {
            return String(this.config.cid_list);
        }
        return '';
    }

    /** 有同页 `{cid}_data_v2` 则 ingest；否则 LoadData（读 `team_info_{cid}_data_v2` 或 HTTP）。 */
    async loadContestDataForTeamPanel() {
        const cid = this._getContestIdForPanel();
        if (this.config.flg_rank_cache !== false && cid && this.cache) {
            const sharedKey = `${cid}_data_v2`;
            try {
                const sharedCached = await this.cache.get(sharedKey);
                if (sharedCached && this._isContestPayloadUsable(sharedCached)) {
                    if (this._ingestContestPayload(sharedCached)) {
                        return;
                    }
                }
            } catch (eCache) {
                console.warn('[TeamInfoPanel] shared rank cache read failed', eCache);
            }
        }
        await this.LoadData();
    }

    /**
     * 串行化成绩数据加载，避免并发两次 ProcessData / 清空气球后未重绘。
     * @param {{ force?: boolean }} [options]
     */
    async _ensureScoreDataLoaded(options = {}) {
        const force = !!options.force;
        if (!force && this.OuterIsDataLoaded() && this.mySolveAcByProblem != null) {
            return;
        }
        if (this._scoreLoadPromise) {
            return this._scoreLoadPromise;
        }
        this._scoreLoadPromise = (async () => {
            const needContest = force || !this.OuterIsDataLoaded();
            await Promise.all([
                needContest ? this.loadContestDataForTeamPanel() : Promise.resolve(),
                this.loadMySolveAc(),
            ]);
            this.syncFrozenScoreMask();
        })().finally(() => {
            this._scoreLoadPromise = null;
        });
        return this._scoreLoadPromise;
    }

    async refreshScoreIfNeeded() {
        if (!document.querySelector('.team-score-content')) {
            return;
        }
        try {
            await this._ensureScoreDataLoaded();
            if (this.OuterIsDataLoaded()) {
                this.processScoreData();
            }
        } catch (e) {
            console.warn('[TeamInfoPanel] refreshScoreIfNeeded', e);
        }
    }

    _findTeamInRankList(rankList) {
        if (!Array.isArray(rankList) || !this.team_id) {
            return null;
        }
        const tid = String(this.team_id);
        return (
            rankList.find((item) => String(item?.team?.team_id ?? '') === tid) || null
        );
    }

    /** 当前 this.data（或传入 payload）是否仍含封榜掩码（result 为负） */
    _contestPayloadStillMasked(payload = null) {
        const data = payload || this.data;
        if (!data || !Array.isArray(data.solution)) {
            return false;
        }
        return data.solution.some((s) => Number(s.result) < 0);
    }

    /** ❄ 遮罩：仅当已 ingest 的 solution 含负 result */
    isTeamPanelRankFrozen() {
        return this._contestPayloadStillMasked();
    }

    syncFrozenScoreMask() {
        const root = this.panel || document;
        const scoreBox = root.querySelector('.cteam_info_score_container');
        const frozenMask = root.querySelector('.cteam_info_frozen_mask');
        const show = this.isTeamPanelRankFrozen();
        if (scoreBox) {
            scoreBox.classList.toggle('is-rank-frozen', show);
        }
        if (frozenMask) {
            frozenMask.classList.toggle('is-visible', show);
        }
    }

    /** 拉取本队每题首次 AC（真实库内结果，供面板题态；名次/罚时仍用 contest_data_ajax + rank 计算） */
    async loadMySolveAc() {
        if (!this.contest_id || !this.module) {
            this.mySolveAcByProblem = null;
            this.mySolveCloseRankMs = null;
            return;
        }
        const url = `/${this.module}/contest/my_solve_ajax?cid=${encodeURIComponent(this.contest_id)}`;
        try {
            const rep = await this._fetchTeamPanelJson(url, 15000);
            if (rep && rep.code === 1 && rep.data && typeof rep.data.ac === 'object') {
                this.mySolveAcByProblem = rep.data.ac;
                const closeStr = rep.data.close_rank_time;
                const closeMs = closeStr ? this._rankWireInstantMs(closeStr) : NaN;
                this.mySolveCloseRankMs = Number.isFinite(closeMs) ? closeMs : null;
            } else {
                this.mySolveAcByProblem = {};
                this.mySolveCloseRankMs = null;
            }
        } catch (e) {
            console.warn('[TeamInfoPanel] loadMySolveAc', e);
            this.mySolveAcByProblem = {};
            this.mySolveCloseRankMs = null;
        }
    }

    /** @param {string} url @param {number} [timeoutMs] */
    async _fetchTeamPanelJson(url, timeoutMs = 15000) {
        const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
        const timer = ctrl
            ? window.setTimeout(() => ctrl.abort(), timeoutMs)
            : null;
        try {
            const resp = await fetch(url, {
                credentials: 'same-origin',
                headers: { 'X-Requested-With': 'XMLHttpRequest' },
                signal: ctrl ? ctrl.signal : undefined,
            });
            if (!resp.ok) {
                throw new Error(`HTTP ${resp.status}`);
            }
            const text = await resp.text();
            try {
                return JSON.parse(text);
            } catch (eParse) {
                throw new Error('non-json response');
            }
        } finally {
            if (timer != null) {
                window.clearTimeout(timer);
            }
        }
    }

    /** @returns {string|null} 某题首次 AC 时间串 */
    getMyFirstAcInDate(problemId) {
        if (!this.mySolveAcByProblem) {
            return null;
        }
        const key = String(problemId);
        return this.mySolveAcByProblem[key] ?? this.mySolveAcByProblem[problemId] ?? null;
    }

    /** 首次 AC 是否在封榜时刻之后（已通过但对榜隐藏） */
    isMyFreezeHiddenAc(problemId) {
        const acDate = this.getMyFirstAcInDate(problemId);
        if (!acDate || this.mySolveCloseRankMs == null) {
            return false;
        }
        const acMs = this._rankWireInstantMs(acDate);
        return Number.isFinite(acMs) && acMs > this.mySolveCloseRankMs;
    }

    /**
     * 面板题态（与 rank 榜口径解耦：仅气球/尝试数；solved/名次/罚时仍用 teamData）
     * @returns {'none'|'tried'|'solved'|'solved_hidden'}
     */
    resolveTeamPanelBalloonStatus(rankStats) {
        const pid = rankStats && rankStats.problemId;
        const rankStatus = rankStats ? rankStats.status : 'none';
        const submitCount = rankStats && rankStats.submitCount ? rankStats.submitCount : 0;
        const hasMyAc = !!this.getMyFirstAcInDate(pid);

        if (rankStatus === 'ac') {
            return 'solved';
        }
        if (hasMyAc && this.isMyFreezeHiddenAc(pid)) {
            return 'solved_hidden';
        }
        if (rankStatus === 'wa' || (rankStatus === 'pending' && submitCount > 0)) {
            return 'tried';
        }
        return 'none';
    }

    /** 合并 rank 的 problemStats 与题号，供展示层使用 */
    buildTeamPanelProblemDisplays(teamData, problems) {
        const rankStatsMap = (teamData && teamData.problemStats) || {};
        const displays = {};
        problems.forEach((problem) => {
            const rs = rankStatsMap[problem.problem_id] || null;
            const rankStatus = rs ? rs.status : 'none';
            const submitCount = rs ? (rs.submitCount || 0) : 0;
            displays[problem.problem_id] = {
                problemId: problem.problem_id,
                status: this.resolveTeamPanelBalloonStatus({
                    problemId: problem.problem_id,
                    status: rankStatus,
                    submitCount,
                }),
            };
        });
        return displays;
    }
    
    processScoreData() {
        if (!this.OuterIsDataLoaded()) {
            return;
        }
        
        // 生成气球容器
        this.generateBalloonContainer();
        
        // 获取当前队伍的数据
        const rankList = this.OuterGetRankList(0); // 打星不排名
        const currentTeam = this._findTeamInRankList(rankList);
        
        // 计算获奖线
        const awardRanks = this.GetAwardRanks({
            flg_ac_team_base: false,
            starMode: 0
        });
        
        // 更新显示（无队伍数据时也渲染占位）
        this.updateScoreDisplay(currentTeam, awardRanks);
    }
    
    generateBalloonContainer() {
        const container = document.querySelector('.cteam_info_balloon_container');
        if (!container) return;
        
        // 清空容器
        container.innerHTML = '';
        
        // 获取题目列表
        const problems = this.OuterGetProblems();
        
        problems.forEach(problem => {
            const problemIndex = RankToolGetProblemAlphabetIdx(problem.num);
            // 跳过无效的 problemIndex（如 '?'）
            if (problemIndex === '?' || !problemIndex) {
                return;
            }
            const balloon = document.createElement('div');
            balloon.className = 'cteam_info_balloon cteam_info_outline';
            balloon.setAttribute('data-letter', problemIndex);
            balloon.setAttribute('id', `cteam_score_pro_${problemIndex}`);
            // 使用统一的颜色规范化函数处理颜色
            const normalizedColor = NormalizeColorForDisplay(problem.color) || problem.color || '#CCCCCC';
            balloon.style.setProperty('--balloon-color', normalizedColor);
            
            // 创建链接
            const link = document.createElement('a');
            link.className = 'a_noline';
            link.href = `/${this.module}/contest/problem?cid=${this.contest_id}&pid=${problemIndex}`;
            link.appendChild(balloon);
            
            container.appendChild(link);
        });
    }
    
    updateScoreDisplay(teamData, awardRanks) {
        const noData = !teamData;
        const problems = this.OuterGetProblems();
        const problemDisplays = noData ? {} : this.buildTeamPanelProblemDisplays(teamData, problems);
        let triedCount = 0;
        if (!noData) {
            problems.forEach((problem) => {
                const disp = problemDisplays[problem.problem_id];
                if (disp && disp.status === 'tried') {
                    triedCount++;
                }
            });
        }
        
        // 更新基本统计信息（无数据用 * 占位）
        $('#cteam_info_score_solved').text(noData ? '*' : (teamData.solved || 0));
        $('#cteam_info_score_tried').text(noData ? '*' : triedCount);
        
        // 更新排名
        let rank_val = '*';
        if (!noData) {
            rank_val = teamData.displayRank == '*'  ? teamData.displayOrder : (teamData.displayRank ?? '-');
            if (teamData.isStar) {
                rank_val = `<span title="按最接近的正式队排名计算 / Based on the nearest formal team">${rank_val}*</span>`;
            }
        }
        $('#cteam_info_score_rank').html(rank_val);
        
        // 计算并更新奖区
        let temp_award = '*';
        if (!noData && awardRanks) {
            const rankGold = awardRanks.rankGold;
            const rankSilver = awardRanks.rankSilver;
            const rankBronze = awardRanks.rankBronze;
            temp_award = '';
            const temp_award_star = teamData.isStar ? '*' : '';
            const title_addition = teamData.isStar ? '按最接近的正式队排名计算 / Based on the nearest formal team' : '';
            if (rank_val === '-') {
                temp_award = '-';
            } else if (teamData.displayRank <= rankGold) {
                temp_award = `<span class="award_span_gold" title="金 / Gold ${title_addition}">金${temp_award_star}</span>`;
            } else if (teamData.displayRank <= rankSilver) {
                temp_award = `<span class="award_span_silver" title="银 / Silver ${title_addition}">银${temp_award_star}</span>`;
            } else if (teamData.displayRank <= rankBronze) {
                temp_award = `<span class="award_span_bronze" title="铜 / Bronze ${title_addition}">铜${temp_award_star}</span>`;
            } else if (teamData.solved > 0) {
                temp_award = `<span class="award_span_iron" title="铁 / Iron ${title_addition}">铁${temp_award_star}</span>`;
            } else {
                temp_award = `<span>-</span>`;
            }
        }
        $('#cteam_info_score_award').html(temp_award);
        
        this.updateProblemBalloons(problemDisplays, problems);
        this.syncFrozenScoreMask();
        if (this.isExpanded) {
            this._scheduleNotificationLayout();
        }
    }
    
    updateProblemBalloons(problemDisplays, problems) {
        const displays = problemDisplays || {};
        const probList = problems || this.OuterGetProblems();
        const hiddenAcTitle = '已通过，榜单待解榜后显示 / Accepted; hidden on scoreboard until unfreeze';
        
        probList.forEach((problem) => {
            const problemIndex = RankToolGetProblemAlphabetIdx(problem.num);
            if (problemIndex === '?' || !problemIndex) {
                return;
            }
            const pro_dom = $(`#cteam_score_pro_${problemIndex}`);
            if (pro_dom.length === 0) {
                return;
            }
            pro_dom.attr('class', 'cteam_info_balloon');
            const disp = displays[problem.problem_id];
            const status = disp ? disp.status : 'none';
            if (status === 'solved') {
                pro_dom.addClass('cteam_info_solved');
                pro_dom.attr('title', `${problemIndex}: 已解决 / Solved`);
            } else if (status === 'solved_hidden') {
                pro_dom.addClass('cteam_info_solved_frozen');
                pro_dom.attr('title', `${problemIndex}: ${hiddenAcTitle}`);
            } else if (status === 'tried') {
                pro_dom.addClass('cteam_info_tried');
                pro_dom.attr('title', `${problemIndex}: 已尝试 / Tried`);
            } else {
                pro_dom.addClass('cteam_info_outline');
                pro_dom.attr('title', `${problemIndex}: 未尝试 / Not attempted`);
            }
        });
    }
    
    async updateScore() {
        try {
            await this._ensureScoreDataLoaded({ force: true });
            if (!this.OuterIsDataLoaded()) {
                return;
            }
            this.processScoreData();
        } catch (e) {
            console.warn('[TeamInfoPanel] updateScore', e);
        }
    }
    
    _ensureCompactScrollListener(enable) {
        if (this._compactScrollListenerOn === enable) {
            return;
        }
        this._compactScrollListenerOn = enable;
        if (enable) {
            window.addEventListener('scroll', this._onCompactViewportScroll, { passive: true, capture: true });
        } else {
            window.removeEventListener('scroll', this._onCompactViewportScroll, { passive: true, capture: true });
        }
    }
    
    setupAutoUpdate() {
        // 设置定时更新
        this.updateInterval = setInterval(() => {
            if (document.visibilityState === 'visible') {
                this.updateScore();
            }
        }, 60000); // 每分钟更新一次
    }
    
    showError(message) {
        // 可以在这里添加错误显示逻辑
        // 例如显示错误提示或隐藏相关元素
    }
    
    destroy() {
        if (this._notificationLayoutRaf) {
            cancelAnimationFrame(this._notificationLayoutRaf);
            this._notificationLayoutRaf = 0;
        }
        if (this._teamIntroCleanupFn) {
            this._teamIntroCleanupFn();
        }
        this._ensureCompactScrollListener(false);
        // 清理定时器
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
        }
        
        // 清理RankSystem（调用父类方法）
        if (this.Cleanup) {
            this.Cleanup();
        }
    }
}

// #########################################
//  全局调用接口
// #########################################
// 使用示例：
// 1. 使用全局配置：TeamInfoPanelInit()
// 2. 使用自定义配置：TeamInfoPanelInit({ contest_id: '123', ... })
// 3. 混合配置：TeamInfoPanelInit({ api_url: '/custom/api' })
function TeamInfoPanelInit(config = {}) {
    // 如果没有传入配置，尝试从全局获取
    if (!config || Object.keys(config).length === 0) {
        config = window.TEAM_INFO_PANEL_CONFIG || {};
    }
    const inst = new TeamInfoPanel(config);
    window._teamInfoPanelInstance = inst;
    return inst;
}
