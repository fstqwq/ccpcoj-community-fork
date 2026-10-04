/**
 * 滚榜模块 (Rank Roll Module)
 * 继承自 RankSystem 的滚榜功能模块
 *
 * ============================================================
 * 调试日志体系
 * ============================================================
 * 所有调试输出统一通过 RankRollSystem._dbg() 入口；本文件源码中**不会
 * 出现** `console.log` 字面量（_dbg 内部用动态属性访问 console['log']
 * 调用，方便用 `rg console\\.log` 一次性清理散落日志）。
 * 文件中可见的 console.warn / console.error 是真错误/警告路径（如数据
 * 完整性校验失败），跟"调试 log"语义不同，故保留显式写法。
 *
 * 在浏览器控制台开启/调节：
 *   window.RankRollDebug = {
 *     enabled: true,            // 总开关
 *     skipFullscreen: false,    // 调试时不进全屏（方便用 MCP/普通浏览器测试）
 *     categories: {
 *       state: true,    // 状态机变化
 *       roll: true,     // RollNext / RollNextStep 入口
 *       confirm: true,  // JudgeConfirm / FindNextJudging
 *       judge: true,    // JudgeDo / JudgeSort 揭晓与排序
 *       award: true,    // 获奖弹窗流程
 *       intro: true,    // 启动动画
 *       keyboard: true, // 键盘 / 鼠标事件
 *       undo: true,     // 撤回 / 跳转
 *       scroll: false,  // 滚动事件（量大，按需开）
 *     },
 *   };
 * 也支持 URL 参数：?rdbg=1&rdbg_nofs=1
 *      / localStorage：localStorage.setItem('roll_debug','1')，刷新生效
 *
 * 在代码里使用：this._dbg('state', '...', payload);
 *
 * 类内通过 _dbgConfig() 读取配置，找不到就回退到默认（关闭）。
 * ============================================================
 *
 * 使用示例：
 * const rollSystem = new RankRollSystem('roll-container', {
 *     key: 'contest_123',
 *     cid_list: '123,456',
 *     api_url: '/csgoj/contest/contest_data_ajax',
 *     // ... 其他配置
 * });
 * // 无需手动调用 init()，继承的 Init() 会自动处理
 */

class RankRollSystem extends RankSystem {
    constructor(containerId, config = {}) {
        // 调用父类构造函数
        super(containerId, config);
        
        // 滚榜相关状态
        this.rollStack = [];
        this.rollDataMap = null;
        this.rollData = null;
        this.currentJudgingIndex = -1;
        this.judgingTeamId = null;
        this.judgingProblemId = null;
        this.judgingTeamIdLast = null;
        this.animatingRisingTeamId = null; // 用于动画的上升队伍ID（在执行IncrementalUpdate时设置）
        this.autoSpeed = 1000;
        this.isAutoRolling = false;
        this.isRolling = false;

        this.realRankMap = null;    // 终榜的 team_id 到 team item 映射, this.rankList 将被处理为终榜
        this.realRankGold = 0;
        this.realRankSilver = 0;
        this.realRankBronze = 0;
        this.rollSolutionMap = null;    // 滚榜对应的 solution map
        this.flgAwardRankReady = false; // 标记是否最末有 ac 队已揭晓，此时不必再更新获奖线
        
        // 获奖区域跟踪
        this.isInAwardArea = false;
        this.currentAwardLevel = 0;
        this.startAwardLevel = 0;
        this.autoAwardEntryPauseConsumed = false;
        this.awardShownTeams = new Set(); // 记录已经显示过获奖的队伍ID（弹奖去重，不参与定位）

        // ────────────────────────────────────────────────────────────────────
        // 滚榜状态机 — — 详细文档见 docs/guide/15.滚榜机制.md（§3）
        // 改动滚榜任何一处必读 15。本注释只维护与代码同步的关键摘要。
        // ────────────────────────────────────────────────────────────────────
        //
        // 核心契约（违反即视为重大缺陷，详见 15 §1）：
        //   I1: currentJudgingIndex 严格单调递减（rollData.length-1 → -1）
        //   I2: FindNextJudging 只看当前 i 这一位，不跳过任何中间位置
        //   I3: i 推进集中在 _AdvanceIndexAfterTeamHandled（按"队是否还在 i 处"判定）
        //       + case 'highlight_only' 内一次性 i--
        //   I4: 不使用任何 settled 标记
        //
        // 状态枚举：
        //   'intro_scroll'    启动"片尾字幕"匀速滚动（按 N/空格/Enter/F/G/点击/右键 中断后快速滚到底）
        //   'wait_first_n'    启动动画结束 / 接续旧进度后等用户按第一次 N（自动模式 A 不进入）
        //   'confirm'         已高亮当前队/题，按 N → JudgeDo 揭晓
        //   'do'              揭晓中（瞬时态）
        //   'judged'          题目刚揭晓完毕：DOM 已变色（绿/红）+ .roll-judged-problem 余韵边框，
        //                     队伍仍高亮，**没有排序动画**——按 N 才触发 JudgeSort
        //                     关键手感：避免"揭晓即上升"撕扯感，让观众看清楚结果
        //   'sort'            排序动画 / 排序判断中（瞬时态）
        //   'award_highlight' 已高亮待获奖队伍，按 N 打开 overlay
        //   'award_open'      overlay 已显示，按 N 关闭
        //   'award_close'     已发起关 overlay，按 N 走 _AdvanceIndexAfterTeamHandled + JudgeConfirm
        //   'highlight_only'  当前 i 处队伍已 highlight，按 N → i-- + JudgeConfirm
        //   null              空闲，按 N → JudgeConfirm 重新定位
        //   'sort_award' / 'award'  兼容旧路径，新代码勿使用
        //
        // 一次完整揭晓的 N 序列（严格按 docs/guide/15.滚榜机制.md §3 执行，详细决策见 _JudgeSortDoneJudge）：
        //   [N] confirm → do → judged
        //   [N] judged  → sort → _JudgeSortDoneJudge 同步分流：
        //                ├─ 该队仍有 frozen 题   → JudgeConfirm 锁同队下一题（confirm）
        //                ├─ 无 frozen + 需弹奖    → award_highlight（同步打开全屏 overlay）
        //                │                           [N] award_highlight → award_open
        //                │                           [N] award_open      → award_close
        //                │                           [N] award_close     → _AdvanceIndexAfterTeamHandled（再 N 才 JudgeConfirm）
        //                └─ 无 frozen + 不需弹奖  → _AdvanceIndexAfterTeamHandled + JudgeConfirm
        //                                            ├─ 队仍在 i 处（WA / AC 没改名次）→ i--
        //                                            └─ AC 升走，i 处现在落下来的别的队 → i 不变（不跳过）
        this.currentRollStep = null;
        // 启动动画临时变量
        this._introScrollAborted = false;
        this._introScrollDone = false;
        this._introScrollAnimId = null;
        this.rollSpeedMultiplier = 1.0;
        this.DEFAULT_ROLL_SPEED = 1000;
        this.MIN_ROLL_SPEED = 100;
        this.MAX_ROLL_SPEED = 5000;
        this.pendingAutoRoll = false;
        
        // 模拟计算相关
        this.isSimulating = false;
        this.simulatedRollDataBackup = null;
        this.simulatedSolutionMapBackup = null;
        this.simulatedRollDataMapBackup = null;
        
        this._awardGroupScrollTimer = null;

        // 滚动管理
        this.scrollTimeout = null; // 滚动定时器，用于取消旧的滚动
        this.pendingScrollTeamId = null; // 待滚动的队伍ID
        this.scrollAnimationRunning = false; // 滚动动画是否正在运行（用于中断f键的滚动）
        this.scrollAnimationId = null; // 滚动动画的 requestAnimationFrame ID
        this.lastScrollTeamId = null; // 上一次滚动的队伍ID
        this.lastScrollY = null; // 上一次滚动到的Y位置（用于判断是否需要重新滚动）
        this.fastSkipScrollTimeout = null; // f键滚动等待定时器ID（用于清理）
        this.fastSkipJudgeConfirmTimeout = null; // f键滚动后的JudgeConfirm定时器ID（用于清理）
        /** F 跳奖区：PQ 判停边界队 id，RollSort 后由 FastSkipToAwardArea 消费 */
        this._awardJumpSettledBoundaryTeamId = null;
        
        // 全屏事件监听器引用（用于移除）
        this._fullscreenHandler = null;
        this._rollGroupMultiSelect = null;
        
        this.maxAnimationDuration = 20000; // 最大动画持续时间

        // 初始化全局调试配置（仅当还没人动过 window.RankRollDebug 时）。
        // 触发开关有 3 种方式（按优先级从高到低）：
        //   1. 直接在控制台改：window.RankRollDebug.enabled = true
        //   2. URL 参数：?rdbg=1 启用日志，?rdbg_nofs=1 启用"调试不进全屏"
        //   3. localStorage：localStorage.setItem('roll_debug','1') / 'roll_debug_nofs'
        //      （刷新生效，持久化）
        if (typeof window !== 'undefined' && !window.RankRollDebug) {
            let urlEnable = false;
            let urlNoFs = false;
            try {
                const params = new URLSearchParams(window.location.search || '');
                urlEnable = params.get('rdbg') === '1';
                urlNoFs = params.get('rdbg_nofs') === '1';
            } catch (_) { /* 容错：旧浏览器无 URLSearchParams */ }
            let lsEnable = false;
            let lsNoFs = false;
            try {
                lsEnable = window.localStorage && localStorage.getItem('roll_debug') === '1';
                lsNoFs = window.localStorage && localStorage.getItem('roll_debug_nofs') === '1';
            } catch (_) { /* 容错：被禁用 localStorage 时 */ }
            window.RankRollDebug = {
                enabled: !!(urlEnable || lsEnable),
                skipFullscreen: !!(urlNoFs || lsNoFs),
                categories: {
                    state: true,
                    roll: true,
                    confirm: true,
                    judge: true,
                    award: true,
                    intro: true,
                    keyboard: true,
                    undo: true,
                    scroll: false,
                },
            };
        }
    }

    // ============================================================
    // 内部调试日志：所有 console 输出唯一入口（详见类头部注释）
    // ============================================================

    /**
     * 读取调试配置（容错：window 不存在 / 配置缺失时回退默认关闭）
     */
    _dbgConfig() {
        if (typeof window === 'undefined') return null;
        return window.RankRollDebug || null;
    }

    /**
     * 输出调试日志。
     * @param {string} category 分类，与 RankRollDebug.categories 中字段对应
     * @param  {...any} args    任意参数
     *
     * 全局开关 enabled=false 或对应分类 categories[category]===false 时不输出。
     * 行内自带时间戳与统一前缀，便于浏览器 Console 里按 `[RollDbg` 过滤。
     *
     * 这里是整个 rank_roll.js 中唯一会产生"调试 log"的地方，
     * 用动态属性访问（console['log']）写法以便 `rg console\\.log` 不会命中本文件。
     */
    _dbg(category, ...args) {
        const cfg = this._dbgConfig();
        if (!cfg || !cfg.enabled) return;
        if (cfg.categories && cfg.categories[category] === false) return;
        const c = (typeof window !== 'undefined') ? window.console : null;
        if (!c) return;
        const fn = c['log']; // 动态属性访问：避免被 grep "console.log" 误清理
        if (typeof fn !== 'function') return;
        const ts = new Date().toISOString().slice(11, 23);
        fn.call(c, `${ts} [RollDbg:${category || 'misc'}]`, ...args);
    }

    /**
     * 调试用：打印一次"状态快照"（变量较多时便于一行看清楚）
     */
    _dbgState(label) {
        const cfg = this._dbgConfig();
        if (!cfg || !cfg.enabled) return;
        if (cfg.categories && cfg.categories.state === false) return;
        this._dbg('state', label, {
            step: this.currentRollStep,
            idx: this.currentJudgingIndex,
            total: this.rollData ? this.rollData.length : 0,
            judging: this.judgingTeamId,
            judgingProblem: this.judgingProblemId,
            lastJudging: this.judgingTeamIdLast,
            awardShown: this.awardShownTeams ? this.awardShownTeams.size : 0,
            isRolling: this.isRolling,
            isAuto: this.isAutoRolling,
        });
    }

    /**
     * 重写 OriInit：在数据初始化完成后，初始化滚榜状态并创建UI
     */
    OriInit(raw_data) {
        // 调用父类的 OriInit 方法（处理数据、计算排名等）
        super.OriInit(raw_data);    // 这里会执行第一次 ProcessData，处理数据、计算排名等
        
        // 初始化滚榜状态（基于 RankSystem 的数据创建滚榜专用数据）
        this.InitRollState();
        
        // 如果提供了容器，创建滚榜UI
        if (this.container && !this.externalMode) {
            this.createUI();
            this.bindEvents();
            
            // // 初始渲染榜单（使用封榜状态的数据）
            // if (this.rollData && this.rollData.length > 0) {
            //     const displayList = this.rollData;
            //     this.RenderRank(displayList);
            // }

            this._scheduleRollViewportZoomHint();
        }
    }

    /**
     * 大屏且浏览器页缩放仍约 100% 时，用与 rank.js 相同的 modal-overlay 提示可整页放大（不依赖 Alerty）。
     * 同会话内关闭后不再弹出（sessionStorage）。
     */
    _scheduleRollViewportZoomHint() {
        if (this.externalMode || !this.container) {
            return;
        }
        try {
            if (typeof sessionStorage !== 'undefined' &&
                sessionStorage.getItem('csg_roll_viewport_zoom_hint_dismissed') === '1') {
                return;
            }
        } catch (e) { /* 私密模式等 */ }
        const run = () => this._maybeShowRollViewportZoomHint();
        if (typeof requestAnimationFrame === 'function') {
            requestAnimationFrame(() => requestAnimationFrame(run));
        } else {
            setTimeout(run, 0);
        }
    }

    _rollViewportZoomHintPageScale() {
        try {
            if (window.visualViewport && typeof window.visualViewport.scale === 'number' &&
                Number.isFinite(window.visualViewport.scale) && window.visualViewport.scale > 0) {
                return window.visualViewport.scale;
            }
        } catch (e) { /* ignore */ }
        return 1;
    }

    _rollViewportZoomHintLargeCssViewport() {
        return window.innerWidth > 1920 || window.innerHeight > 1080;
    }

    _rollViewportZoomHintShouldShow() {
        if (!this._rollViewportZoomHintLargeCssViewport()) {
            return false;
        }
        const s = this._rollViewportZoomHintPageScale();
        return s <= 1.02;
    }

    _rollViewportZoomHintMarkDismissed() {
        try {
            if (typeof sessionStorage !== 'undefined') {
                sessionStorage.setItem('csg_roll_viewport_zoom_hint_dismissed', '1');
            }
        } catch (e) { /* ignore */ }
    }

    _getRollViewportZoomHintModal() {
        return this.container ? this.container.querySelector('#csg-roll-viewport-zoom-hint-modal') : null;
    }

    _isRollViewportZoomHintModalOpen() {
        const m = this._getRollViewportZoomHintModal();
        return !!(m && m.style.display === 'flex');
    }

    _closeRollViewportZoomHintModal() {
        const modal = this._getRollViewportZoomHintModal();
        if (modal) {
            modal.style.display = 'none';
        }
        if (this._rollViewportZoomHintOnKey) {
            document.removeEventListener('keydown', this._rollViewportZoomHintOnKey, true);
        }
        this._rollViewportZoomHintMarkDismissed();
        this._syncRollModalStackingOverToolbar();
    }

    _openRollViewportZoomHintModal() {
        const modal = this._getRollViewportZoomHintModal();
        if (!modal) {
            return;
        }
        if (!this._rollViewportZoomHintOnKey) {
            this._rollViewportZoomHintOnKey = (e) => {
                if (e.key !== 'Enter' && e.key !== 'Escape') {
                    return;
                }
                if (!this._isRollViewportZoomHintModalOpen()) {
                    return;
                }
                e.preventDefault();
                e.stopPropagation();
                this._closeRollViewportZoomHintModal();
            };
        }
        document.removeEventListener('keydown', this._rollViewportZoomHintOnKey, true);
        modal.style.display = 'flex';
        this._syncRollModalStackingOverToolbar();
        document.addEventListener('keydown', this._rollViewportZoomHintOnKey, true);
    }

    _maybeShowRollViewportZoomHint() {
        if (!this._rollViewportZoomHintShouldShow()) {
            return;
        }
        this._openRollViewportZoomHintModal();
    }

    DoUpdateAwardInfo() {
        // 暂时直接用真实获奖线，不实时计算
        return;
        // if(!this.flgAwardRankReady) {
        //     this.UpdateAwardInfo();
        // }
    }
    
    /**
     * 重写 ShouldShowProblemStats 方法，滚榜模式下隐藏题目统计信息（尝试数、通过数）
     * @returns {boolean} 滚榜模式下返回 false，不显示统计信息
     */
    ShouldShowProblemStats() {
        return false;
    }
    
    /**
     * 初始化滚榜状态的内部实现（通用逻辑）。
     *
     * 关键设计（防止"按 N 看不到队伍"的根因 bug 复发）：
     * **rollData 严格 = 当前筛选视图**。
     * 也就是说，滚榜要处理的数据集 = `FilterByStarMode(rankList, starMode)`
     * 经过 starMode（打星三模式）+ selectedGroupIds（赛事归属）过滤后的子集，
     * **而不是全量 rankList**。这样 IncrementalUpdate / FindNextJudging /
     * scrollToTeam 等流程操作的索引、DOM、数据三者完全一致：currentJudgingIndex
     * 指向的 rollData[i] 一定是 DOM 中可见的、可被定位高亮的队伍。
     *
     * 代价：用户切换 starMode / 赛事归属 = 进入了"另一个滚榜会话"，
     * 必须重建 rollData / rollSolutionMap / realRankMap，并清空进度。
     * 这由 `_RebuildRollDataForFilters()` 与切换处的逻辑负责。
     *
     * @param {boolean} forceReset - 是否强制重置（忽略已初始化检查）
     */
    _InitRollDataInternal(forceReset = false) {
        if (!this.data || !this.data.contest) {
            console.warn('RankRollSystem: data or contest not available');
            return;
        }

        // 如果已经初始化过且不是强制重置，不再重复初始化
        if (!forceReset && this.rollData && this.rollData.length > 0) {
            return;
        }

        // 空榜单（如尚未有人提交）：仍初始化滚榜数据结构，避免 rollData 为 null
        if (!this.rankList || this.rankList.length === 0) {
            this._InitEmptyRollDataState();
            return;
        }
        // 1. 初始化 this.rankList 为封榜状态
        this.ProcessData();

        // 2. **按当前筛选（starMode + selectedGroupIds）过滤 rankList，再基于
        //    这个过滤后的子集构建 rollData**。
        //    FilterByStarMode 内部已同时处理 selectedGroupIds 过滤与 isStar 标记。
        const filteredRankList = this.FilterByStarMode(this.rankList, this.starMode);
        this.rollData = filteredRankList.map(item => {
            const newItem = {
                ...item,
                problemStats: {},
                flg_award_by_group: {},
                displayRankByGroup: {}
            };
            const solutions = this.solutionMap[item.team_id];
            const frozenProblems = solutions && solutions.frozen ? solutions.frozen : {};

            // 深拷贝 problemStats，但 frozen 题目的状态改为 pending
            for (const problemId in item.problemStats) {
                const isFrozen = frozenProblems[problemId];
                if (isFrozen) {
                    newItem.problemStats[problemId] = {
                        ...item.problemStats[problemId],
                        status: 'pending'
                    };
                } else {
                    newItem.problemStats[problemId] = { ...item.problemStats[problemId] };
                }
            }
            return newItem;
        });
        // 3. 重新创建 rollDataMap（仅含视图内队伍）
        this.RollSort();
        if (typeof RankToolApplyMedalFlagsByGroupFromList === 'function' && this.rollData && this.rollData.length) {
            RankToolApplyMedalFlagsByGroupFromList(this, this.rollData);
        }
        if (this.rollDataMap) {
            this.rollDataMap.clear();
        } else {
            this.rollDataMap = new Map();
        }
        this.rollData.forEach(item => {
            this.rollDataMap.set(item.team_id, item);
        });

        this.flgAwardRankReady = false;
        this.DoUpdateAwardInfo();

        // 4. rollSolutionMap 也只包含视图内队伍的提交。
        //    （以前是 JSON.parse(JSON.stringify(this.solutionMap)) 全量深拷贝，
        //    会让"非视图队"也参与 FindNextJudging 的判断，然后定位到 DOM 中
        //    不存在的队，导致 highlight 加不上去——按 N 像没反应。）
        this.rollSolutionMap = {};
        for (const item of this.rollData) {
            const src = this.solutionMap[item.team_id];
            if (src) {
                this.rollSolutionMap[item.team_id] = JSON.parse(JSON.stringify(src));
            }
        }

        // 5. 初始化真实榜单：this.rankList / realRankMap 切到「全题已揭晓」口径；其末尾 UpdateAwardInfo()
        //    已按当前 starMode + selectedGroupIds + GetAwardRatioPackForCurrentView 写入 this.rankGold 等
        //   （与榜单页 GetAwardRanks 同源）。FindNextJudging / GetCurrentAwardLevel 只看 this.rankGold，
        //    与 rollData 上 CalculateRankInfo 算出的 displayRank 对照；勿在此处再算一套以免与 5 脱节。
        this.CalculateRealRankMap();

        // 6. 同步「真实获奖线」到 realRank*：与 this.rankGold 单一真相源一致；rollData 为空时 5 未调 UpdateAwardInfo，在此补算
        if (!this.rollData || this.rollData.length === 0) {
            this.UpdateAwardInfo(this.starMode);
        }
        this.realRankGold = this.rankGold;
        this.realRankSilver = this.rankSilver;
        this.realRankBronze = this.rankBronze;
        this._dbg('state', '_InitRollDataInternal done', {
            rollDataLen: this.rollData.length,
            rankListLen: this.rankList.length,
            starMode: this.starMode,
            groups: this.selectedGroupIds,
        });
    }

    /**
     * 空榜单时的滚榜数据结构初始化（尚无提交 / 过滤后无可见队伍）。
     * 保证 rollData / rollDataMap 等为合法空容器，页面可正常展示表头与工具栏。
     */
    _InitEmptyRollDataState() {
        this.rollData = [];
        if (this.rollDataMap) {
            this.rollDataMap.clear();
        } else {
            this.rollDataMap = new Map();
        }
        this.rollSolutionMap = {};
        this.currentJudgingIndex = -1;
        this.flgAwardRankReady = false;
        this.UpdateAwardInfo(this.starMode);
        this.realRankGold = this.rankGold;
        this.realRankSilver = this.rankSilver;
        this.realRankBronze = this.rankBronze;
        if (this.container && !this.externalMode && this.elements && this.elements.rankGrid) {
            this.RenderRank(this.rollData);
        }
        this._dbg('state', '_InitRollDataInternal empty rankList', {
            starMode: this.starMode,
            groups: this.selectedGroupIds,
        });
    }

    /**
     * 切换 starMode / 赛事归属后调用，重建滚榜数据（== 当前筛选视图）。
     * - 滚榜进行中：先 StopRoll 清空进度，再重建——明示用户：筛选改了 = 新滚榜
     * - 未滚榜中：仅重建 + RenderRank
     *
     * 必须保证：调用方先把 this.starMode / this.selectedGroupIds 改成新值，
     * 再调本函数。
     */
    _RebuildRollDataForFilters() {
        const wasRolling = this.isRolling;
        if (wasRolling) {
            this._dbg('state', '筛选变更 -> 自动停止当前滚榜并清空进度');
            this.StopRollCompletely();
            // StopRollCompletely 默认保留进度，但筛选变更等同"换了一场比赛口径"，
            // 必须把残留的进度索引/标记清掉，否则 currentJudgingIndex 可能指向
            // 已不存在于新 rollData 的队。
            this.currentJudgingIndex = -1;
            this.judgingTeamId = null;
            this.judgingProblemId = null;
            this.judgingTeamIdLast = null;
            if (this.awardShownTeams) this.awardShownTeams.clear();
            this.isInAwardArea = false;
            this.currentAwardLevel = 0;
            this.startAwardLevel = 0;
            this.autoAwardEntryPauseConsumed = false;
            this.flgAwardRankReady = false;
        }
        this._InitRollDataInternal(true);
        if (this.container && this.rollData && this.rollData.length > 0) {
            // rollData 已经是过滤后的，直接 RenderRank（不再二次过滤）
            this.RenderRank(this.rollData);
        }
        // 工具栏按钮上的"摘要"也要刷新
        this._RefreshRollFilterBtnSummary();
        if (wasRolling) {
            this.ShowMessage('筛选已变更，滚榜进度已重置');
        }
    }

    // ──────────────────────────────────────────────────────────────────
    // 「筛选 Filter」按钮 + Modal（取代旧版工具栏散落的多个下拉）
    // 设计要点：
    //   - 工具栏只放一个「筛选」按钮（带摘要文字），点开 modal 配置：
    //       1. 打星视图（三选项 radio）—— 始终显示
    //       2. 赛事归属筛选（csgMultiSelect）—— 仅 IsMultiGroupEnabled() 时显示
    //   - 任一项变更：通过 _RebuildRollDataForFilters() 立即重建 rollData
    //     （滚榜中会清空进度并提示），并刷新按钮摘要 + 写入 IDB viewPrefs。
    //   - 不再使用 #roll-group-filter / #roll-group-multiselect / #roll-star-mode-*
    //     这些工具栏内联控件——它们已被本 modal 取代。
    // ──────────────────────────────────────────────────────────────────

    /**
     * 工具栏「筛选」按钮上的摘要文字（如 "校内 · 不含打星"）。
     */
    _GetRollFilterSummaryHtml() {
        const parts = [];
        if (this.IsMultiGroupEnabled()) {
            const groups = this.GetContestGroups();
            const total = groups.length;
            const selected = Array.isArray(this.selectedGroupIds) ? this.selectedGroupIds.length : 0;
            if (selected === 0 || selected === total) {
                parts.push('全部归属');
            } else if (selected === 1) {
                const sel = groups.find((g) => RankToolGroupIdKey(g.group_id) === RankToolGroupIdKey(this.selectedGroupIds[0]));
                parts.push(sel ? (sel.group_name || sel.group_id) : '1 个归属');
            } else {
                parts.push(`${selected} 个归属`);
            }
        }
        const starLabel = ['打星不排名', '不含打星', '打星参与'][this.starMode != null ? this.starMode : 0] || '';
        if (starLabel) parts.push(starLabel);
        if (parts.length === 0) return '';
        return `<span class="roll-filter-btn-summary-text">${parts.join(' · ')}</span>`;
    }

    _RefreshRollFilterBtnSummary() {
        const el = document.querySelector('#roll-filter-btn-summary');
        if (el) el.innerHTML = this._GetRollFilterSummaryHtml();
    }

    /**
     * 创建 modal DOM。重复调用安全（已存在则跳过）。
     */
    _CreateRollFilterModal() {
        if (!this.container) return;
        if (this.container.querySelector('#roll-filter-modal')) return;
        const showGroup = this.IsMultiGroupEnabled();
        const groupCardCls = showGroup ? '' : 'd-none';
        const modal = document.createElement('div');
        modal.id = 'roll-filter-modal';
        modal.className = 'modal-overlay rank-filter-modal-overlay';
        modal.style.display = 'none';
        modal.innerHTML = `
            <div class="modal-content rank-filter-modal-content">
                <div class="modal-header">
                    <h3>${this.CreateBilingualText('筛选', 'Filter')}</h3>
                    <button id="roll-close-filter-modal" class="close-btn" type="button">&times;</button>
                </div>
                <div class="modal-body rank-filter-modal-body">
                    <div class="rank-filter-top-controls roll-filter-top-controls-single">
                        <div class="filter-card filter-card-star-mode">
                            <div class="filter-card-title">${this.CreateBilingualText('打星视图', 'Star Mode')}</div>
                            <div class="rank-radio-group" id="roll-star-mode-group" role="group" aria-label="打星视图 / Star Mode">
                                <button type="button" class="rank-radio-btn rank-radio-btn-icon" data-roll-star-mode="0" title="打星不排名 / Star No Rank" aria-label="打星不排名 / Star No Rank"><i class="bi bi-slash-circle" aria-hidden="true"></i></button>
                                <button type="button" class="rank-radio-btn rank-radio-btn-icon" data-roll-star-mode="1" title="不含打星 / Exclude Star" aria-label="不含打星 / Exclude Star"><i class="bi bi-eye-slash" aria-hidden="true"></i></button>
                                <button type="button" class="rank-radio-btn rank-radio-btn-icon" data-roll-star-mode="2" title="打星参与排名 / Star Participate" aria-label="打星参与排名 / Star Participate"><i class="bi bi-stars" aria-hidden="true"></i></button>
                            </div>
                        </div>
                    </div>
                    <div class="rank-filter-group-controls ${groupCardCls}" id="roll-filter-group-card">
                        <div class="filter-column-title-row">
                            <div class="filter-column-title-main">
                                <span class="filter-column-title-text">${this.CreateBilingualText('赛事归属筛选', 'Affiliation Filter')}</span>
                            </div>
                            <div class="filter-title-actions">
                                <button type="button" class="btn btn-outline-secondary btn-sm" id="roll-filter-group-select-all">${this.CreateBilingualText('全选', 'All')}</button>
                                <button type="button" class="btn btn-outline-secondary btn-sm" id="roll-filter-group-clear">${this.CreateBilingualText('清空', 'None')}</button>
                            </div>
                        </div>
                        <div id="roll-filter-group-multiselect"></div>
                        <select id="roll-filter-group-select" class="form-select form-select-sm d-none" multiple size="6"></select>
                    </div>
                </div>
            </div>`;
        this.container.appendChild(modal);
    }

    _OpenRollFilterModal() {
        const modal = this.container && this.container.querySelector('#roll-filter-modal');
        if (!modal) return;
        this._SyncRollFilterModalState();
        modal.style.display = 'flex';
        this._syncRollModalStackingOverToolbar();
    }

    _CloseRollFilterModal() {
        const modal = this.container && this.container.querySelector('#roll-filter-modal');
        if (modal) modal.style.display = 'none';
        this._syncRollModalStackingOverToolbar();
    }

    /**
     * .roll-controls-section 与 #rank-container 为兄弟且 z-index 更高时，容器内的 .modal-overlay
     * 无法盖过工具条；在任一滚榜自定义 modal 显示时抬高 #rank-container.rank-system。
     * 管理端等页面在 #rank-container 外还有 .contest-rank-page-shell__body 包裹层时，
     * 仅抬 #rank-container 无效（子 stacking 无法越过 __body 与工具条的前序兄弟层），须一并抬 __body。
     */
    _syncRollModalStackingOverToolbar() {
        if (!this.container) return;
        const filterModal = this.container.querySelector('#roll-filter-modal');
        const helpModal = this.container.querySelector('#roll-help-modal');
        const zoomHintModal = this.container.querySelector('#csg-roll-viewport-zoom-hint-modal');
        const filterOpen = filterModal && filterModal.style.display === 'flex';
        const helpOpen = helpModal && helpModal.style.display === 'flex';
        const zoomHintOpen = zoomHintModal && zoomHintModal.style.display === 'flex';
        const shouldElevate = filterOpen || helpOpen || zoomHintOpen;
        this.container.classList.toggle('rank-modal-stacks-above-toolbar', shouldElevate);
        const shellBody = this.container.parentElement;
        if (shellBody && shellBody.classList.contains('contest-rank-page-shell__body')) {
            shellBody.classList.toggle('rank-modal-stacks-above-toolbar', shouldElevate);
        }
    }

    /**
     * 同步 modal 内 starMode radio 的 active 态 + group 多选当前值。
     */
    _SyncRollFilterModalState() {
        if (!this.container) return;
        const cur = String(this.starMode != null ? this.starMode : 0);
        this.container.querySelectorAll('#roll-star-mode-group .rank-radio-btn[data-roll-star-mode]').forEach(btn => {
            btn.classList.toggle('active', String(btn.dataset.rollStarMode) === cur);
        });
        // 同步赛事归属（多选）
        const groupCard = this.container.querySelector('#roll-filter-group-card');
        if (groupCard) {
            groupCard.classList.toggle('d-none', !this.IsMultiGroupEnabled());
        }
        if (this.IsMultiGroupEnabled()) {
            this._BuildRollFilterGroupOptions();
            this._SyncRollFilterGroupMultiSelectFromState();
        }
    }

    /**
     * 把 contest_group → 原生 select 的 options，再交给 csgMultiSelect 渲染。
     */
    _BuildRollFilterGroupOptions() {
        const select = this.container && this.container.querySelector('#roll-filter-group-select');
        if (!select) return;
        const groups = this.GetContestGroups();
        select.innerHTML = '';
        groups.forEach(g => {
            const op = document.createElement('option');
            op.value = g.group_id;
            op.textContent = g.group_name || g.group_id;
            if (Array.isArray(this.selectedGroupIds) && this.selectedGroupIds.includes(g.group_id)) {
                op.selected = true;
            }
            select.appendChild(op);
        });
        // 实例化（或刷新）多选组件
        const mount = this.container.querySelector('#roll-filter-group-multiselect');
        if (mount && window.csgMultiSelect) {
            const options = Array.from(select.options).map(op => ({
                value: op.value,
                label: op.textContent || op.value
            }));
            const selected = Array.from(select.selectedOptions).map(op => op.value);
            if (!this._rollFilterGroupMS) {
                this._rollFilterGroupMS = window.csgMultiSelect.create(mount, {
                    placeholder: '选择赛事归属',
                    searchPlaceholder: '搜索分组',
                    selectedSuffix: '项已选',
                    emptyText: '暂无可选分组',
                    options,
                    selected,
                    onChange: (values) => this._OnRollFilterGroupChanged(values),
                });
            } else {
                this._rollFilterGroupMS.setOptions(options);
                this._rollFilterGroupMS.setSelectedValues(selected);
            }
        }
    }

    _SyncRollFilterGroupMultiSelectFromState() {
        // selectedGroupIds 是真相源；BuildRollFilterGroupOptions 会同步到 multi-select
    }

    _OnRollFilterGroupChanged(values) {
        // 至少保留 1 个（与 EnsureGroupSelection 语义一致）
        let next = Array.isArray(values) ? values.filter(Boolean) : [];
        if (next.length === 0) {
            // 用户清空了——给个默认（第一个 group）
            const groups = this.GetContestGroups();
            next = groups.length > 0 ? [groups[0].group_id] : [];
            if (this._rollFilterGroupMS) this._rollFilterGroupMS.setSelectedValues(next);
        }
        // 与已有状态相比无变化则跳过，避免无谓重建
        const prev = Array.isArray(this.selectedGroupIds) ? this.selectedGroupIds.slice().sort() : [];
        const cur = next.slice().sort();
        if (prev.length === cur.length && prev.every((v, i) => v === cur[i])) return;
        this.selectedGroupIds = next;
        if (typeof this.SaveViewPrefs === 'function') {
            try { this.SaveViewPrefs(); } catch (_) { /* 容错 */ }
        }
        this._RebuildRollDataForFilters();
    }

    _BindRollFilterModalEvents() {
        if (!this.container) return;
        const modal = this.container.querySelector('#roll-filter-modal');
        if (!modal || modal.dataset.csgRollFilterBound === '1') return;
        modal.dataset.csgRollFilterBound = '1';

        const filterBtn = document.querySelector('#roll-filter-btn');
        if (filterBtn && filterBtn.dataset.csgBound !== '1') {
            filterBtn.dataset.csgBound = '1';
            filterBtn.addEventListener('click', (e) => { e.preventDefault(); this._OpenRollFilterModal(); });
        }
        const closeBtn = modal.querySelector('#roll-close-filter-modal');
        if (closeBtn) closeBtn.addEventListener('click', () => this._CloseRollFilterModal());
        // 点击 modal 蒙层关闭
        modal.addEventListener('click', (e) => {
            if (e.target === modal) this._CloseRollFilterModal();
            const starBtn = e.target.closest('.rank-radio-btn[data-roll-star-mode]');
            if (starBtn) {
                const next = parseInt(starBtn.dataset.rollStarMode, 10);
                if (Number.isInteger(next) && [0, 1, 2].includes(next) && next !== this.starMode) {
                    this._dbg('state', 'starMode change(modal)', { from: this.starMode, to: next });
                    this.starMode = next;
                    if (typeof this.SaveViewPrefs === 'function') {
                        try { this.SaveViewPrefs(); } catch (_) { /* 容错 */ }
                    }
                    this._SyncRollFilterModalState();
                    this._RebuildRollDataForFilters();
                }
            }
        });
        // 全选 / 清空
        const selAll = modal.querySelector('#roll-filter-group-select-all');
        if (selAll) selAll.addEventListener('click', () => {
            const groups = this.GetContestGroups();
            const all = groups.map(g => g.group_id);
            if (this._rollFilterGroupMS) this._rollFilterGroupMS.setSelectedValues(all);
            this._OnRollFilterGroupChanged(all);
        });
        const clr = modal.querySelector('#roll-filter-group-clear');
        if (clr) clr.addEventListener('click', () => {
            // 留 1 个（默认第一个）—— 与 EnsureGroupSelection 语义一致
            const groups = this.GetContestGroups();
            const first = groups.length > 0 ? [groups[0].group_id] : [];
            if (this._rollFilterGroupMS) this._rollFilterGroupMS.setSelectedValues(first);
            this._OnRollFilterGroupChanged(first);
        });
    }

    /**
     * 初始化滚榜状态（首次初始化，有保护检查）
     * 基于 RankSystem 的数据创建滚榜专用数据结构
     */
    InitRollState() {
        this._InitRollDataInternal(false); // 不强制重置
    }
    
    /**
     * 重写 IsFrozen：滚榜模式下只看提交时间，不考虑当前时间
     * 继承自 RankSystem，但在滚榜模式下应该只看提交是否在封榜期间，不考虑是否已揭晓
     * 
     * 按照原 IsFrozenSolution 的逻辑实现：只判断提交时间是否在封榜期间内
     */
    IsFrozen(solution) {
        // 是否是封榜期间的提交（只看提交时间）
        if (!this.data) return false;
        
        // 检查 result < 0 的情况（后端没给结果）
        if (solution.result < 0) {
            return true;    // 后端没给结果，属于封榜状态
        }
        
        // 判断提交时间是否在封榜期间内
        const inDate = solution.in_date;
        const submitTime = this._rankWireInstantMs(inDate);
        const endTime = this._rankWireInstantMs(this.data.contest.end_time);
        const frozenMinutes = this.data.contest.frozen_minute || 0;
        const frozenStartTime = endTime - frozenMinutes * 60 * 1000;
        return submitTime > frozenStartTime;
    }
    
    /**
     * 创建滚榜UI
     */
    createUI() {
        // 检查是否已经创建过UI，避免重复创建
        if (this.container && !this.externalMode) {
            // 检查滚榜控制按钮是否已存在
            const existingControls = document.querySelector('.roll-controls-section');
            if (!existingControls) {
                const rollControls = this.createRollControlButtons();
                if (rollControls) {
                    const p = this.container.parentElement;
                    const ref =
                        p && p.classList.contains('contest-rank-page-shell__body') ? p : this.container;
                    ref.insertAdjacentHTML('beforebegin', rollControls);
                }
            }

            // 获奖全屏 overlay：roll_award_overlay.js（不再创建 #award-modal）

            const existingHelpModal = this.container.querySelector('#roll-help-modal');
            if (!existingHelpModal) {
                this.createRollHelpModal();
            }

            const existingZoomHint = this.container.querySelector('#csg-roll-viewport-zoom-hint-modal');
            if (!existingZoomHint) {
                this.createRollViewportZoomHintModal();
            }

            // 皮肤下拉在 Init → BindHeaderEvents 之后才插入 DOM：须补绑 + 同步 data-rank-skin，
            // 否则 #rank-skin-btn 无点击逻辑，且 .roll-controls-section[data-rank-skin] 缺失导致「按当前皮肤着色」的样式不生效。
            this.ApplyRankSkin();
            this.SelectCustomOption('rank-skin', RankSkinNormalize(this.rankSkin));
            this.EnsureRankSkinSelectBound();

            // 创建并绑定「筛选 Filter」modal（取代旧版工具栏的 group / starMode 内联下拉）
            this._CreateRollFilterModal();
            this._BindRollFilterModalEvents();
            this._RefreshRollFilterBtnSummary();
        }
    }
    
    /**
     * 生成滚榜控制按钮HTML
     *
     * 注意（勿删改以下约定，避免回归）：
     * 1. 滚榜工具条须保留 **榜单皮肤** 下拉（`roll-toolbar-skin-item` + `GenerateCustomSelect(rankSkinOptions)`），
     *    与比赛实时榜单一致（`icon-only` 仅图标，文案在下拉项内）；`EnsureRankSkinSelectBound()` 依赖 `#rank-skin-btn` / `#rank-skin-dropdown` 存在于 DOM。
     * 2. 工具栏从左到右：**启动滚榜** → 筛选 → 皮肤 → 重置 / 帮助 / 导出；按钮中英文须 **上下排列**：用 `RankToolGenerateBilingualTextStacked`，
     *    与 `rank.css` 中 `.roll-control-btn.with-text .roll-button-text-cn|en`（12px/10px）一致，勿改回 `CreateBilingualText`（会成左右 `<en-text>`）。
     */
    createRollControlButtons() {
        // 根据配置决定是否显示导出按钮
        const showExportButton = this.config.flg_show_export_offline_roll !== false; // 默认 true
        const createRollButtonText = (label, label_en) =>
            `<span class="button-text">${RankToolGenerateBilingualTextStacked(label, label_en)}</span>`;
        
        let exportButtonHtml = '';
        if (showExportButton) {
            exportButtonHtml = `
                    <button id="export-offline-roll-btn" class="control-btn with-text roll-control-btn roll-control-btn-outline-secondary">
                        <i class="bi bi-download"></i>
                        ${createRollButtonText('导出离线滚榜', 'Export Offline Roll')}
                    </button>`;
        }
        
        const cfg = this.htmlConfigs && this.htmlConfigs.headerControls;
        // 「筛选配置」按钮：取代旧版散落在工具栏的"赛事归属下拉 + 打星视图下拉"，
        // 用一个按钮 + 摘要文字调出 modal（参考 /cpcsys/contest/rank?cid=1082 的筛选 modal）。
        // 摘要文字由 `_GetRollFilterSummaryHtml()` 渲染：当前 starMode + 已选 group 数。
        // 多 group 比赛和单 group 比赛都显示这个按钮（单 group 时 modal 内只展示打星视图）。
        const filterBtnHtml = `
                    <button id="roll-filter-btn" class="control-btn with-text roll-control-btn roll-control-btn-outline-secondary roll-filter-btn">
                        <i class="bi bi-funnel"></i>
                        <span class="button-text roll-filter-btn-text">
                            ${RankToolGenerateBilingualTextStacked('筛选', 'Filter')}
                        </span>
                        <span class="roll-filter-btn-summary" id="roll-filter-btn-summary">${this._GetRollFilterSummaryHtml()}</span>
                    </button>`;
        const skinRollHtml =
            cfg && cfg.rankSkinOptions
                ? `
                    <div class="toolbar-item roll-toolbar-skin-item">
                        ${this.GenerateCustomSelect(cfg.rankSkinOptions, 'rank-skin', this.rankSkin || 'default')}
                    </div>`
                : '';
        return `
            <div class="roll-controls-section roll-controls-section-aligned">
                <div class="controls-toolbar roll-controls-toolbar">
                    <button id="start-roll-btn" class="control-btn with-text roll-control-btn roll-control-btn-primary">
                        <i class="bi bi-play-fill"></i>
                        ${createRollButtonText('启动滚榜', 'Start Roll')}
                    </button>
                    ${filterBtnHtml}
                    ${skinRollHtml}
                    <button id="reset-roll-btn" class="control-btn with-text roll-control-btn roll-control-btn-secondary">
                        <i class="bi bi-arrow-counterclockwise"></i>
                        ${createRollButtonText('重置滚榜', 'Reset Roll')}
                    </button>
                    <button id="help-roll-btn" class="control-btn with-text roll-control-btn roll-control-btn-outline-info">
                        <i class="bi bi-question-circle"></i>
                        ${createRollButtonText('帮助', 'Help')}
                    </button>
                    ${exportButtonHtml}
                </div>
            </div>
        `;
    }
    
    /**
     * 创建滚榜帮助模态框
     */
    createRollHelpModal() {
        if (!this.container) return;
        
        const helpModal = document.createElement('div');
        helpModal.id = 'roll-help-modal';
        helpModal.className = 'modal-overlay';
        helpModal.style.display = 'none';
        helpModal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>${this.CreateBilingualText('滚榜快捷键', 'Roll Shortcuts')}</h3>
                    <button id="close-roll-help" class="close-btn">&times;</button>
                </div>
                <div class="modal-body">
                    <div id="roll-help-content" class="roll-help-content">
                        <div class="roll-help-section">
                            <div class="roll-help-section-title">${this.CreateBilingualText('基本控制', 'Basic Control')}</div>
                            <div class="roll-help-items">
                                <div class="roll-help-item">
                                    <code>N</code> / <code>n</code> / <code>Space</code>
                                    <span>${this.CreateBilingualText('单步执行', 'Next Step')}</span>
                                </div>
                                <div class="roll-help-item">
                                    <code>A</code> / <code>a</code>
                                    <span>${this.CreateBilingualText('开启/关闭自动滚榜', 'Toggle Auto Roll')}</span>
                                </div>
                                <div class="roll-help-item">
                                    <span style="font-size: 0.9em; color: #666;">${this.CreateBilingualText('（全屏模式下：鼠标左键 = N）', '(Fullscreen: Left Click = N)')}</span>
                                </div>
                            </div>
                        </div>
                        <div class="roll-help-section">
                            <div class="roll-help-section-title">${this.CreateBilingualText('跳转', 'Navigation')}</div>
                            <div class="roll-help-items">
                                <div class="roll-help-item">
                                    <code>F</code> / <code>f</code> / <code>Enter</code>
                                    <span>${this.CreateBilingualText('跳到下个奖区', 'Skip to Next Award Area')}</span>
                                </div>
                                <div class="roll-help-item">
                                    <code>G</code> / <code>g</code>
                                    <span>${this.CreateBilingualText('往前跳 10 个队', 'Jump Forward 10 Teams')}</span>
                                </div>
                                <div class="roll-help-item">
                                    <code>U</code> / <code>u</code> / <code>Backspace</code>
                                    <span>${this.CreateBilingualText('撤回一步', 'Undo Last')}</span>
                                </div>
                                <div class="roll-help-item">
                                    <code>I</code> / <code>i</code>
                                    <span>${this.CreateBilingualText('往回跳 10 个队', 'Jump Back 10 Teams')}</span>
                                </div>
                                <div class="roll-help-item">
                                    <span style="font-size: 0.9em; color: #666;">${this.CreateBilingualText('（全屏模式下：鼠标右键 = F）', '(Fullscreen: Right Click = F)')}</span>
                                </div>
                            </div>
                        </div>
                        <div class="roll-help-section">
                            <div class="roll-help-section-title">${this.CreateBilingualText('速度控制', 'Speed Control')}</div>
                            <div class="roll-help-items">
                                <div class="roll-help-item">
                                    <code>W</code> / <code>w</code>
                                    <span>${this.CreateBilingualText('加速滚榜', 'Speed Up')}</span>
                                </div>
                                <div class="roll-help-item">
                                    <code>S</code> / <code>s</code>
                                    <span>${this.CreateBilingualText('减速滚榜', 'Speed Down')}</span>
                                </div>
                                <div class="roll-help-item">
                                    <code>R</code> / <code>r</code>
                                    <span>${this.CreateBilingualText('重置速度', 'Reset Speed')}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        this.container.appendChild(helpModal);
    }

    /**
     * 滚榜大屏 + 页缩放约 100% 时的温馨提示：与 rank.js 同款 modal-overlay，不依赖 Alerty。
     */
    createRollViewportZoomHintModal() {
        if (!this.container) {
            return;
        }
        const wrap = document.createElement('div');
        wrap.id = 'csg-roll-viewport-zoom-hint-modal';
        wrap.className = 'modal-overlay csg-roll-viewport-zoom-hint-modal';
        wrap.style.display = 'none';
        wrap.setAttribute('role', 'dialog');
        wrap.setAttribute('aria-modal', 'true');
        const title = this.CreateBilingualText('显示建议', 'Display suggestion');
        const footCn = '是否调整由您自行决定，本页不会代为修改。';
        const footEn = 'Totally optional — we won’t change zoom for you.';
        wrap.innerHTML = `
            <div class="modal-content csg-roll-viewport-zoom-hint-modal__content">
                <div class="modal-header">
                    <h3>${title}</h3>
                    <button type="button" id="close-csg-roll-viewport-zoom-hint" class="close-btn" aria-label="Close">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="csg-roll-viewport-hint">
                        <p class="csg-roll-viewport-hint__lead">当前窗口较大，可将<strong>本页</strong>放大到约 <strong>125%～200%</strong>，投屏时表格与文字更易辨认。</p>
                        <ul class="csg-roll-viewport-hint__methods">
                            <li><span class="csg-roll-viewport-hint__method-label">快捷键</span>
                                <code class="csg-roll-viewport-hint__kbd">Ctrl</code><span class="csg-roll-viewport-hint__plus">+</span><code class="csg-roll-viewport-hint__kbd">加号</code> 或
                                <code class="csg-roll-viewport-hint__kbd">Ctrl</code><span class="csg-roll-viewport-hint__plus">+</span>鼠标滚轮向上
                            </li>
                            <li><span class="csg-roll-viewport-hint__method-label">菜单</span> 使用浏览器菜单中的「缩放」</li>
                        </ul>
                        <p class="csg-roll-viewport-hint__methods-note text-muted small mb-2">${footCn}</p>
                        <div class="csg-roll-viewport-hint__en-block text-muted small">
                            <p class="csg-roll-viewport-hint__lead">Your window is large. Zoom <strong>this page</strong> to about <strong>125%–200%</strong> so the grid and text read better on a projector.</p>
                            <ul class="csg-roll-viewport-hint__methods">
                                <li><span class="csg-roll-viewport-hint__method-label">Shortcuts</span>
                                    <code class="csg-roll-viewport-hint__kbd">Ctrl</code><span class="csg-roll-viewport-hint__plus">+</span><code class="csg-roll-viewport-hint__kbd">Plus</code> or
                                    <code class="csg-roll-viewport-hint__kbd">Ctrl</code><span class="csg-roll-viewport-hint__plus">+</span>scroll wheel up
                                </li>
                                <li><span class="csg-roll-viewport-hint__method-label">Menu</span> Use the browser’s <strong>Zoom</strong> control</li>
                            </ul>
                            <p class="mb-0">${footEn}</p>
                        </div>
                    </div>
                </div>
                <div class="modal-footer csg-roll-viewport-zoom-hint-modal__footer">
                    <button type="button" class="btn btn-primary csg-roll-viewport-zoom-hint-modal__ok" id="csg-roll-viewport-zoom-hint-ok">
                        ${RankToolGenerateBilingualTextStacked('我知道了', 'OK')}
                    </button>
                </div>
            </div>`;
        this.container.appendChild(wrap);
    }


    /**
     * 绑定事件
     */
    bindEvents() {
        if (typeof RollAwardOverlay !== 'undefined' && !this._rollAwardOverlayCfg) {
            this._rollAwardOverlayCfg = true;
            RollAwardOverlay.configure({
                fadeInMs: 720,
                fadeOutMs: 540,
                /** 获奖详情正文居中；改回左对齐时设为 `'start'` */
                infoAlign: 'center',
                onBackdrop: () => this.HideModal('award'),
                // 浏览器 Fullscreen API 只渲染全屏子树：overlay 必须挂在全屏元素（一般为 #rank-container）下
                getMountParent: () =>
                    document.fullscreenElement ||
                    document.webkitFullscreenElement ||
                    document.mozFullScreenElement ||
                    document.msFullscreenElement ||
                    this.container ||
                    document.getElementById('rank-container') ||
                    document.body
            });
        }
        // 检查是否已经绑定过事件，避免重复绑定
        if (this._eventsBound) {
            return;
        }
        this._eventsBound = true;
        
        // 启动滚榜按钮
        const startRollBtn = document.querySelector('#start-roll-btn');
        if (startRollBtn && !startRollBtn.hasAttribute('data-roll-bound')) {
            startRollBtn.setAttribute('data-roll-bound', 'true');
            startRollBtn.addEventListener('click', () => this.StartRollProcess());
        }
        
        // 重置滚榜按钮
        const resetRollBtn = document.querySelector('#reset-roll-btn');
        if (resetRollBtn && !resetRollBtn.hasAttribute('data-roll-bound')) {
            resetRollBtn.setAttribute('data-roll-bound', 'true');
            resetRollBtn.addEventListener('click', () => this.ResetRoll());
        }
        
        // 帮助按钮
        const helpRollBtn = document.querySelector('#help-roll-btn');
        if (helpRollBtn && !helpRollBtn.hasAttribute('data-roll-bound')) {
            helpRollBtn.setAttribute('data-roll-bound', 'true');
            helpRollBtn.addEventListener('click', () => this.ShowRollHelp());
        }
        
        // 导出离线滚榜按钮（在 roll-controls-section 中）
        const exportOfflineRollBtn = document.querySelector('#export-offline-roll-btn');
        if (exportOfflineRollBtn && !exportOfflineRollBtn.hasAttribute('data-roll-bound')) {
            exportOfflineRollBtn.setAttribute('data-roll-bound', 'true');
            exportOfflineRollBtn.addEventListener('click', () => this.ExportOfflineRoll());
        }
        // 旧版工具栏 #roll-group-filter / #roll-group-multiselect 已被
        // 「筛选 Filter」modal 取代（_CreateRollFilterModal / _BindRollFilterModalEvents）。
        // 这里不再绑定旧控件，避免重复事件。
        
        const closeRollHelp = this.container.querySelector('#close-roll-help');
        if (closeRollHelp && !closeRollHelp.hasAttribute('data-roll-bound')) {
            closeRollHelp.setAttribute('data-roll-bound', 'true');
            closeRollHelp.addEventListener('click', () => this.HideModal('rollHelp'));
        }
        
        const rollHelpModal = this.container.querySelector('#roll-help-modal');
        if (rollHelpModal && !rollHelpModal.hasAttribute('data-roll-bound')) {
            rollHelpModal.setAttribute('data-roll-bound', 'true');
            rollHelpModal.addEventListener('click', (e) => {
                if (e.target === rollHelpModal) this.HideModal('rollHelp');
            });
        }

        const closeZoomHint = this.container.querySelector('#close-csg-roll-viewport-zoom-hint');
        if (closeZoomHint && !closeZoomHint.hasAttribute('data-roll-bound')) {
            closeZoomHint.setAttribute('data-roll-bound', 'true');
            closeZoomHint.addEventListener('click', () => this._closeRollViewportZoomHintModal());
        }
        const okZoomHint = this.container.querySelector('#csg-roll-viewport-zoom-hint-ok');
        if (okZoomHint && !okZoomHint.hasAttribute('data-roll-bound')) {
            okZoomHint.setAttribute('data-roll-bound', 'true');
            okZoomHint.addEventListener('click', () => this._closeRollViewportZoomHintModal());
        }
        const zoomHintModal = this.container.querySelector('#csg-roll-viewport-zoom-hint-modal');
        if (zoomHintModal && !zoomHintModal.hasAttribute('data-roll-bound')) {
            zoomHintModal.setAttribute('data-roll-bound', 'true');
            zoomHintModal.addEventListener('click', (e) => {
                if (e.target === zoomHintModal) {
                    this._closeRollViewportZoomHintModal();
                }
            });
        }

        // 键盘事件（只在第一次绑定，避免重复监听）
        if (!this._keyboardEventBound) {
            this._keyboardEventBound = true;
        document.addEventListener('keydown', (e) => this.HandleRollKeydown(e));
    }
    
        // 鼠标事件（全屏滚榜状态下）
        if (!this._mouseEventBound) {
            this._mouseEventBound = true;
            // 左键点击与N键相同功能（单步执行）
            document.addEventListener('click', (e) => {
                // 检查是否在全屏滚榜状态下
                const isFullscreenRolling = this.isRolling && 
                    (this.isFullscreen || (this.container && this.container.classList.contains('fullscreen')));
                
                if (isFullscreenRolling) {
                    // 检查是否在发奖 overlay 上（允许在 overlay 上触发 N）
                    const isInAwardOverlay = e.target.closest('#csg-roll-award-overlay');
                    
                    // 排除交互元素（按钮、输入框等），但允许在发奖 overlay 上触发
                    const isInteractiveElement = e.target.closest('button, .control-btn, .custom-select-btn, a, input, select, textarea, .close-btn, .award-close-btn');
                    
                    // 排除其他 modal（帮助 / 筛选等），但允许发奖 overlay
                    const isOtherModal = !isInAwardOverlay && e.target.closest('.modal-overlay, .modal-content');
                    
                    if (!isInteractiveElement && !isOtherModal) {
                        e.preventDefault();
                        this.RollNext();
                    }
                }
            });
            
            // 右键点击与F键相同功能（跳到下个奖区）
            document.addEventListener('contextmenu', (e) => {
                // 检查是否在全屏滚榜状态下
                const isFullscreenRolling = this.isRolling && 
                    (this.isFullscreen || (this.container && this.container.classList.contains('fullscreen')));
                
                if (isFullscreenRolling) {
                    // 检查是否在发奖 overlay 上（允许在 overlay 上触发）
                    const isInAwardOverlay = e.target.closest('#csg-roll-award-overlay');
                    
                    // 排除交互元素（按钮、输入框等），但允许在发奖 overlay 上触发
                    const isInteractiveElement = e.target.closest('button, .control-btn, .custom-select-btn, a, input, select, textarea, .close-btn, .award-close-btn');
                    
                    // 排除其他 modal（帮助 / 筛选等），但允许发奖 overlay
                    const isOtherModal = !isInAwardOverlay && e.target.closest('.modal-overlay, .modal-content');
                    
                    if (!isInteractiveElement && !isOtherModal) {
                        e.preventDefault();
                        // 启动动画期间右键也按"中断"处理，等同于按 N
                        if (this.currentRollStep === 'intro_scroll') {
                            this._introScrollAborted = true;
                            return;
                        }
                        // wait_first_n 期间：与 F 一致，允许直接跳奖区（不再强制等同首次 N）
                        if (this.currentRollStep === 'wait_first_n') {
                            void this.FastSkipToAwardArea();
                            return;
                        }
                        this.FastSkipToAwardArea();
                    }
                }
            });
        }
    
        // 全屏退出事件监听（退出全屏时立即停止滚榜）
        if (!this._fullscreenHandler) {
            this._fullscreenHandler = () => this.HandleFullscreenExit();
            document.addEventListener('fullscreenchange', this._fullscreenHandler);
            document.addEventListener('webkitfullscreenchange', this._fullscreenHandler);
            document.addEventListener('mozfullscreenchange', this._fullscreenHandler);
            document.addEventListener('MSFullscreenChange', this._fullscreenHandler);
        }
    }
    // 旧版工具栏 #roll-group-filter / #roll-group-multiselect 的初始化与同步函数
    // 已被「筛选 Filter」modal 取代——见 _CreateRollFilterModal /
    // _BuildRollFilterGroupOptions / _OnRollFilterGroupChanged。

    /**
     * 处理全屏退出事件 - 立即停止滚榜并重置所有状态
     * 只要退出全屏，就退出滚榜状态
     */
    HandleFullscreenExit() {
        const isCurrentlyFullscreen = !!document.fullscreenElement || 
                                    !!document.webkitFullscreenElement || 
                                    !!document.mozFullScreenElement || 
                                    !!document.msFullscreenElement;
        
        // 如果退出全屏，立即停止滚榜并重置所有状态
        if (!isCurrentlyFullscreen) {
            this.StopRollCompletely();
        }
    }
    
    /**
     * 完全停止滚榜（退出全屏 / 手动停止时调用）。
     *
     * 关键设计：**保留滚榜进度**（currentJudgingIndex / awardShownTeams /
     * isInAwardArea / currentAwardLevel / judgingTeamIdLast / flgAwardRankReady 等），
     * 以及 rollData / rollSolutionMap / rollDataMap 的揭晓状态。这样下次再点
     * "启动滚榜"，可以检测到残留进度并直接接着上次的位置开始（跳过启动动画
     * 与"等待首次 N"流程）。
     *
     * 只有显式调用 ResetRoll（"重置滚榜"按钮）才会通过 _ResetRollDataCore
     * 把所有进度变量真正清空。
     */
    StopRollCompletely() {
        // 1. 运行时状态：必须清空（否则 isRolling 等会卡住）
        this.isRolling = false;
        this.isAutoRolling = false;
        this.currentRollStep = null;
        this.isFullscreen = false;
        if (this.container) {
            this.container.classList.remove('fullscreen', 'fullscreen-mock');
        }
        this.autoSpeed = this.DEFAULT_ROLL_SPEED;
        this.rollSpeedMultiplier = 1.0;
        this.pendingAutoRoll = false;

        // 2. 中断启动动画（如果正在播放）
        if (this._introScrollAnimId !== null) {
            cancelAnimationFrame(this._introScrollAnimId);
            this._introScrollAnimId = null;
        }
        this._introScrollAborted = false;
        this._introScrollDone = true;

        // 3. 清理各类滚动定时器
        if (this.scrollTimeout) {
            clearTimeout(this.scrollTimeout);
            this.scrollTimeout = null;
        }
        if (this.fastSkipScrollTimeout !== null) {
            clearTimeout(this.fastSkipScrollTimeout);
            this.fastSkipScrollTimeout = null;
        }
        if (this.fastSkipJudgeConfirmTimeout !== null) {
            clearTimeout(this.fastSkipJudgeConfirmTimeout);
            this.fastSkipJudgeConfirmTimeout = null;
        }
        if (this.scrollAnimationRunning && this.scrollAnimationId !== null) {
            cancelAnimationFrame(this.scrollAnimationId);
            this.scrollAnimationRunning = false;
            this.scrollAnimationId = null;
        }
        this.pendingScrollTeamId = null;

        // 退出全屏/手动停止：打断未完成的 FLIP，避免下次进入时行仍带 translate3d
        this._abortRollFlipAnimationsIfAny();

        // 4. 清除高亮 / 模态框（视觉上回到"未滚榜"状态）
        this.ClearJudgingHighlight();
        this.HideModal('award');
        this.HideModal('rollHelp');

        // 5. 高亮目标 / 当前题目可以清空（重新进入时由 JudgeConfirm 重新设置）。
        //    但 judgingTeamIdLast 必须保留：FindNextJudging 用它判断"刚揭晓队"。
        this.judgingTeamId = null;
        this.judgingProblemId = null;
        this.animatingRisingTeamId = null;

        // 6. 进度变量：**故意保留**，用于"接着上次开始"。
        //    - currentJudgingIndex
        //    - judgingTeamIdLast
        //    - awardShownTeams
        //    - isInAwardArea / currentAwardLevel / startAwardLevel
        //    - flgAwardRankReady
        //    - rollData / rollSolutionMap / rollDataMap

        // 7. 操作栈不再使用，直接清空
        this.rollStack = [];

        // 8. 恢复启动按钮状态
        const startBtn = document.querySelector('#start-roll-btn');
        if (startBtn) {
            startBtn.classList.remove('disabled');
            startBtn.removeAttribute('disabled');
        }

        // 9. 清除所有提示信息
        this.ShowMessage('');
        this.ShowKeyHint('', '');
    }
    
    /**
     * 格式化时间（毫秒转 HH:MM:SS）
     */
    formatDuration(milliseconds) {
        const totalSeconds = Math.floor(milliseconds / 1000);
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    // 继承 RankSystem 的方法，无需代理调用
    // ShowMessage, ShowKeyHint, FilterByStarMode, CalculateRankInfo, 
    // GetProblemAlphabetIdx, IncrementalUpdate, RenderRank, UpdateRankRow 
    // 等方法直接继承自 RankSystem，可以直接使用 this.xxx() 调用
    
    CalculateAnimationDuration() {
        // 继承自 RankSystem，直接调用父类方法
        return super.CalculateAnimationDuration(this.baseAnimationDuration, this.rollSpeedMultiplier, this.minAnimationDuration, this.maxAnimationDuration);
    }
    
    /**
     * 重写 ExecuteBulkAnimation：滚榜模式下使用基于速度的动画。
     *
     * 视觉连续性要点（与 csg_anim.js flipSortAnimate 的"统一 commit + 同帧 FLIP"配合）：
     *   - 多个队伍连续揭晓时，每次 sort 都从"上一刻真实视觉位置"无缝接续；
     *   - risingTeamIds 包含【所有当前正在上升中的队伍】，用于 z-index 优先级提示；
     *     即便不传，flipSortAnimate 也会按 deltaY > 0 自动识别上升方向，
     *     但显式传入能避免新进入的上升队伍被旧的上升队伍遮挡。
     *   - 上升/下降同律按"距离/速度"算 duration，速率一致 → 远观稳重。
     */
    async ExecuteBulkAnimation(movements, sortedRows, grid, onComplete = null) {
        const speedMultiplier = this.rollSpeedMultiplier || 1.0;
        const animationDuration = RankToolCalculateAnimationDuration(this.baseAnimationDuration, speedMultiplier, this.minAnimationDuration, this.maxAnimationDuration);

        const order = sortedRows.map(row => row.getAttribute('data-row-id')).filter(Boolean);

        // 收集所有"当前正在上升中的队伍"作为 z-index 提示：
        //   1. 当前刚揭晓且即将上升的（animatingRisingTeamId / judgingTeamIdLast / judgingTeamId）；
        //   2. 上一波动画尚未结束、CSGAnim 仍标记为 risingElements 的队伍。
        const risingHintSet = new Set();
        if (this.animatingRisingTeamId) risingHintSet.add(this.animatingRisingTeamId);
        if (this.judgingTeamIdLast) risingHintSet.add(this.judgingTeamIdLast);
        if (this.judgingTeamId) risingHintSet.add(this.judgingTeamId);
        // 把动画库内仍标记为上升中的队伍也合并进来（连续揭晓时关键）
        if (window.CSGAnim && window.CSGAnim.risingElements) {
            const allRows = grid.querySelectorAll('[data-row-id]');
            allRows.forEach(row => {
                if (window.CSGAnim.risingElements.has(row)) {
                    const tid = row.getAttribute('data-row-id');
                    if (tid) risingHintSet.add(tid);
                }
            });
        }
        const risingTeamIds = Array.from(risingHintSet);

        await window.CSGAnim.sortAnimate(grid, order, {
            duration: animationDuration,
            speedMultiplier: speedMultiplier,
            easing: window.CSGAnim.getEasing('smooth'),
            useFlip: true,
            queue: true,
            cancelPrevious: true,
            // 滚榜：按距离/速度算 duration，让多队伍同帧时速率一致
            useSpeedBasedDuration: true,
            speed: 500,                    // 上升速度：500 像素/秒（数值越大越慢）
            // 下降默认与上升同速（不传 fallingSpeed 时由动画库设为 = speed）
            // → 整体"齐速沉淀"，远观最稳重
            minDuration: this.minAnimationDuration || 600,
            maxDuration: this.maxAnimationDuration || 20000,
            risingTeamIds,                 // z-index 优先级提示：所有当前上升中队伍
            risingEasing: 'linear',        // 上升用线性，避免减速时被新动画接管的"软停"
            // 下降"力度感"参数（resolver 风格）
            fallingMinDuration: 550,       // 即便短距离也至少 550ms，避免"刷的一下"
            fallingMaxDuration: 1400,      // 长距离上限，避免过分拖沓
            fallingEasing: 'cubic-bezier(0.65, 0, 0.35, 1)', // ease-in-out-cubic：起步—加速—收尾
            fallingStaggerMaxMs: 80,       // 多队伍同帧时按距离从短到长 stagger 启动 → "涟漪沉淀"
            fallingUnifyDuration: true,    // 同批次下降统一 duration，齐速感
            onStart: () => {},
            onComplete: () => {
                this.FinalizeBulkAnimation([], sortedRows, grid);
                if (onComplete) onComplete();
            }
        });
    }
    
    SmoothScrollToBottom(element) {
        // 如果父类有该方法则调用，否则使用简单实现
        if (super.SmoothScrollToBottom) {
            return super.SmoothScrollToBottom(element);
        }
        // 简单实现
        return new Promise((resolve) => {
            const startScrollTop = element.scrollTop;
            const targetScrollTop = element.scrollHeight - element.clientHeight;
            const distance = targetScrollTop - startScrollTop;
            
            if (Math.abs(distance) < 1) {
                resolve();
                return;
            }
            
            const duration = 2000;
            const startTime = performance.now();
            const easeInOutCubic = (t) => {
                return t < 0.5 
                    ? 4 * t * t * t 
                    : 1 - Math.pow(-2 * t + 2, 3) / 2;
            };
            
            const animateScroll = (currentTime) => {
                const elapsed = currentTime - startTime;
                const progress = Math.min(elapsed / duration, 1);
                const easedProgress = easeInOutCubic(progress);
                
                element.scrollTop = startScrollTop + distance * easedProgress;
                
                if (progress < 1) {
                    requestAnimationFrame(animateScroll);
                } else {
                    resolve();
                }
            };
            
            requestAnimationFrame(animateScroll);
        });
    }
    
    // 滚榜排序
    RollSort() {
        // 排名计算必须通过 CalculateRankInfo 来完成，它会正确处理并列、打星等情况
        // 复用父类的排序比较函数，避免重复实现排序逻辑
        this.rollData.sort((a, b) => this.CompareTeamsForRanking(a, b));
        // 调用父类的方法计算排名
        this.CalculateRankInfo(this.rollData);
        if (typeof RankToolApplyMedalFlagsByGroupFromList === 'function') {
            RankToolApplyMedalFlagsByGroupFromList(this, this.rollData);
        }
    }
    
    /**
     * 启动滚榜流程
     *
     * 完整时序：
     *   进入全屏 → DOM 稳定 → 检测是否有"上次未完成的进度"
     *     ┣━ 有进度：跳过启动动画与 wait_first_n，直接进入 wait_first_n
     *     ┃           （让用户按一次 N 再定位上次位置；已揭晓的题目状态保留）
     *     ┗━ 无进度：走"片尾字幕"启动动画 → wait_first_n → 按 N 才定位第一队
     */
    async StartRollProcess() {
        this._dbg('intro', 'StartRollProcess() ENTER',
            { isRolling: this.isRolling, hasRollData: !!(this.rollData && this.rollData.length) });
        if (this.isRolling) {
            this.ShowMessage('滚榜已启动');
            return;
        }
        
        // 空榜单时不进入滚榜流程（如比赛尚未有人提交）
        if (!this.rollData || this.rollData.length === 0) {
            this.ShowMessage('暂无榜单数据');
            return;
        }

        // 更新启动按钮状态（禁用）
        const startBtn = document.querySelector('#start-roll-btn');
        if (startBtn) {
            startBtn.classList.add('disabled');
            startBtn.setAttribute('disabled', 'true');
        }

        // 1. 进入全屏（调试时可通过 window.RankRollDebug.skipFullscreen=true 跳过）
        const dbgCfg = this._dbgConfig();
        const skipFullscreen = !!(dbgCfg && dbgCfg.skipFullscreen);
        if (skipFullscreen) {
            // 调试模式：不调真实全屏 API（MCP/普通浏览器测试用），但仍加 'fullscreen'
            // 类，让样式 / 鼠标键盘事件路径与全屏一致。
            // 额外加 'fullscreen-mock'：CSS 用它把 .rank-system 的 position:fixed
            // 退化为 position:relative，避免在普通页面里把工具条 / 表格"飞"到
            // 视口左上角导致 .roll-controls-section（z-index 抬高过的）漂浮遮挡 rank。
            this.container.classList.add('fullscreen');
            this.container.classList.add('fullscreen-mock');
            this.isFullscreen = true;
            this._dbg('intro', 'skipFullscreen=true: 模拟全屏 class，未触发 requestFullscreen()');
        } else if (!document.fullscreenElement) {
            try {
                if (this.container.requestFullscreen) {
                    await this.container.requestFullscreen();
                } else if (this.container.webkitRequestFullscreen) {
                    await this.container.webkitRequestFullscreen();
                } else if (this.container.msRequestFullscreen) {
                    await this.container.msRequestFullscreen();
                }
                this.container.classList.add('fullscreen');
                this.isFullscreen = true;
            } catch(e) {
                this._dbg('intro', 'requestFullscreen FAILED', e && e.message);
                this.ShowMessage('无法进入全屏模式');
                if (startBtn) {
                    startBtn.classList.remove('disabled');
                    startBtn.removeAttribute('disabled');
                }
                return;
            }
        } else if (document.fullscreenElement === this.container ||
                   document.webkitFullscreenElement === this.container ||
                   document.msFullscreenElement === this.container) {
            this.container.classList.add('fullscreen');
            this.container.classList.remove('fullscreen-mock');
            this.isFullscreen = true;
        }
        
        // 2. 等待DOM稳定
        await new Promise(resolve => setTimeout(resolve, 300));

        // 3. 检测是否有"上次未完成的进度"。
        //    如果上次滚榜中途退出（如 Esc 退出全屏 / 手动停止），StopRollCompletely
        //    会保留 currentJudgingIndex / awardShownTeams 等进度变量。
        //    此时直接接着上次开始，不走启动动画的"繁文缛节"。
        if (this._HasRollProgress()) {
            this._dbg('intro', 'StartRollProcess: 检测到残留进度 -> _StartRollResume');
            this._StartRollResume();
            return;
        }

        // 4. 全新启动：走片尾字幕动画 + 等待首次 N
        this._dbg('intro', 'StartRollProcess: 全新启动 -> _StartRollFresh');
        this._StartRollFresh();
    }

    /**
     * 是否存在"上次未完成的进度"。
     * 触发条件（任一即可）：
     *   - currentJudgingIndex 不是初始值（说明已经处理过至少一个队的位置）
     *   - awardShownTeams 非空（说明至少弹过一次奖）
     */
    _HasRollProgress() {
        if (!this.rollData || this.rollData.length === 0) return false;
        if (this.currentJudgingIndex >= 0 &&
            this.currentJudgingIndex < this.rollData.length - 1) {
            return true;
        }
        if (this.awardShownTeams && this.awardShownTeams.size > 0) return true;
        return false;
    }

    /**
     * 全新启动滚榜：先走"片尾字幕"启动动画，再进入 wait_first_n。
     */
    _StartRollFresh() {
        // 标记正式进入滚榜会话：isRolling=true 才能让 HandleRollKeydown 接收按键。
        this.isRolling = true;
        this.isAutoRolling = false;
        this.autoSpeed = this.DEFAULT_ROLL_SPEED;
        this.rollSpeedMultiplier = 1.0;

        if (this.HideGlobalTooltip) {
            this.HideGlobalTooltip();
        }
        if (this.tooltipTimeouts) {
            Object.values(this.tooltipTimeouts).forEach(timeout => clearTimeout(timeout));
            this.tooltipTimeouts = {};
        }

        // 重置进度变量到初始状态
        this.rollStack = [];
        this.currentJudgingIndex = this.rollData.length - 1;
        this.judgingTeamId = null;
        this.judgingProblemId = null;
        this.judgingTeamIdLast = null;
        this.animatingRisingTeamId = null;
        this.awardShownTeams.clear();
        this.isInAwardArea = false;
        this.currentAwardLevel = 0;
        this.startAwardLevel = 0;
        this.autoAwardEntryPauseConsumed = false;
        this.flgAwardRankReady = false;

        // 自动模式下启动：跳过 intro 动画与 wait_first_n，直接 RollNext。
        if (this.pendingAutoRoll) {
            this.isAutoRolling = true;
            this.pendingAutoRoll = false;
            this.RollNext();
            return;
        }

        // 进入启动动画状态。键盘事件在 intro_scroll 状态下只接受"中断"性按键。
        this.currentRollStep = 'intro_scroll';
        this.ShowKeyHint('启动中…按 N 加速', 'N');
        this._RunIntroScrollAnimation().then(() => {
            // intro 动画结束（或被中断后快滚到底）：进入 wait_first_n
            // 注意：动画过程中若用户切换了自动模式，按 wait_first_n 路径走自动判定。
            if (!this.isRolling) return; // 动画期间已退出
            this.currentRollStep = 'wait_first_n';
            this.ShowKeyHint('按 N 锁定第一队', 'N');
            // 自动模式下：不再等待，直接进入正式流程
            if (this.isAutoRolling) {
                this.currentRollStep = null;
                this.RollNext();
            }
        });
    }

    /**
     * 接着上次进度恢复滚榜：不走启动动画，进入 wait_first_n 等用户按一次 N 再定位。
     */
    _StartRollResume() {
        this.isRolling = true;
        this.isAutoRolling = false;
        this.autoSpeed = this.DEFAULT_ROLL_SPEED;
        this.rollSpeedMultiplier = 1.0;
        this.judgingTeamId = null;
        this.judgingProblemId = null;
        this.animatingRisingTeamId = null;
        this.rollStack = [];

        // 视口/容器先到底部：和"全新启动后 intro 动画结束"的状态保持一致。
        // 因为 scrollToElementBottomThird 已经实现"单向向上"——只允许 scrollY
        // 减小、永不向下。如果恢复时把视口放到顶部，按 N 锁定中间位置的队伍时
        // scrollToTeam 因为目标 scrollY 大于当前 scrollY 会拒绝滚动，导致用户
        // 看不到当前队伍。把视口放到底部就能让 scrollToTeam 平滑向上滚到当前
        // 队伍的位置，符合滚榜整体"自下而上"的视口推进方向。
        const scrollContainer = this.getScrollContainer();
        if (scrollContainer === window) {
            const maxScroll = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
            window.scrollTo({ top: maxScroll, behavior: 'auto' });
        } else {
            scrollContainer.scrollTop = Math.max(0, scrollContainer.scrollHeight - scrollContainer.clientHeight);
        }

        this.currentRollStep = 'wait_first_n';
        this.ShowKeyHint('已恢复上次进度，按 N 继续', 'N');

        // 自动模式：直接进入正式流程
        if (this.pendingAutoRoll) {
            this.isAutoRolling = true;
            this.pendingAutoRoll = false;
            this.currentRollStep = null;
            this.RollNext();
        }
    }

    /**
     * 启动滚榜（业务逻辑）—— 兼容旧调用方
     * @deprecated 入口请改用 StartRollProcess（已包含完整启动动画与进度检测）。
     *   仅用于个别老路径继续可用，等同于 _StartRollFresh。
     */
    StartRollInternal() {
        this._StartRollFresh();
    }

    /**
     * 启动动画："片尾字幕"风格 —— 视口/容器从顶部恒速滚到底部。
     *
     * - 速度：80 像素/秒（视榜单长度而定，最多 60 秒兜底）
     * - 中断：当 _introScrollAborted=true 时，剩余距离用固定 800ms ease-out
     *   平滑滚到底部，并 resolve Promise
     * - 完成或被取消（this._introScrollDone=true）后立即停止
     */
    _RunIntroScrollAnimation() {
        return new Promise((resolve) => {
            const scrollContainer = this.getScrollContainer();
            const isWindow = scrollContainer === window;

            const setScroll = (y, max) => {
                const v = Math.max(0, Math.min(y, max));
                if (isWindow) {
                    window.scrollTo(0, v);
                } else {
                    scrollContainer.scrollTop = v;
                }
            };
            const getMaxScroll = () => {
                if (isWindow) {
                    return Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
                }
                return Math.max(0, scrollContainer.scrollHeight - scrollContainer.clientHeight);
            };

            // 1. 先滚到顶部
            setScroll(0, getMaxScroll());

            // 等两帧让浏览器完成布局，再开始动画
            requestAnimationFrame(() => requestAnimationFrame(() => {
                const maxScroll = getMaxScroll();
                if (maxScroll <= 0) {
                    this._introScrollDone = true;
                    this._introScrollAnimId = null;
                    resolve();
                    return;
                }

                this._introScrollAborted = false;
                this._introScrollDone = false;

                // 启动滚动时长：按队伍数自适应，让"启动仪式"长度与赛事规模匹配，
                // 同时由 maxScroll/duration 自动适配不同皮肤的行高，速度感保持一致。
                //
                // 经验数据（参考闭幕式现场感受）：
                //   - 50 队 ：8s （下限）—— 慢悠悠的电影片尾感，享受
                //   - 100 队：8s        —— 飞驰感开始
                //   - 200 队：10s       —— 快速浏览整体
                //   - 300 队：15s       —— "标杆"速度，约 1100~1400 px/s，
                //                          扫视清晰但有仪式感（不至于让前排打瞌睡）
                //   - 500 队：22s （上限）
                //   - 1000+：22s （上限，速度~3000 px/s 浮光掠影但仍流畅）
                //
                // 比"按 px/s 速度算时长"更稳：不同皮肤行高 60~110px 都能跑出
                // 一致的现场体验。如需更快/更慢，调整 perTeamMs 或 clamp 边界。
                const teamCount = (this.rollData && this.rollData.length) ? this.rollData.length : 100;
                const perTeamMs = 50;          // 每 20 队约 1 秒
                const minDuration = 8000;      // 不能再短：仪式感
                const maxDuration = 22000;     // 不能再长：耐心
                const duration = Math.max(minDuration,
                                          Math.min(maxDuration, teamCount * perTeamMs));
                const startTime = performance.now();

                const animate = (now) => {
                    if (this._introScrollDone) return;

                    if (this._introScrollAborted) {
                        // 中断：剩余距离用 ease-out 在 800ms 内滚到底
                        const fastStart = performance.now();
                        const startScrollY = isWindow
                            ? (window.scrollY || window.pageYOffset)
                            : scrollContainer.scrollTop;
                        const fastDuration = 800;
                        const fastAnimate = (t) => {
                            if (this._introScrollDone) return;
                            const elapsed = t - fastStart;
                            const progress = Math.min(elapsed / fastDuration, 1);
                            const eased = 1 - Math.pow(1 - progress, 3); // ease-out
                            setScroll(startScrollY + (maxScroll - startScrollY) * eased, maxScroll);
                            if (progress < 1) {
                                this._introScrollAnimId = requestAnimationFrame(fastAnimate);
                            } else {
                                this._introScrollDone = true;
                                this._introScrollAnimId = null;
                                resolve();
                            }
                        };
                        this._introScrollAnimId = requestAnimationFrame(fastAnimate);
                        return;
                    }

                    const elapsed = now - startTime;
                    const progress = Math.min(elapsed / duration, 1);
                    // 线性插值（恒速字幕感）
                    setScroll(maxScroll * progress, maxScroll);

                    if (progress < 1) {
                        this._introScrollAnimId = requestAnimationFrame(animate);
                    } else {
                        this._introScrollDone = true;
                        this._introScrollAnimId = null;
                        resolve();
                    }
                };

                this._introScrollAnimId = requestAnimationFrame(animate);
            }));
        });
    }
    
    /**
     * 停止滚榜
     */
    StopRoll() {
        // 调用完全停止方法，确保所有状态都重置
        this.StopRollCompletely();
    }
    
    /**
     * 重置滚榜数据的核心逻辑（可复用的内部函数）
     * 清理所有状态变量、定时器、高亮等，并重新初始化滚榜状态
     * @param {boolean} shouldReloadData - 是否重新从服务器获取数据（ResetRoll需要，u/i不需要）
     */
    async _ResetRollDataCore(shouldReloadData = false) {
        // 1. 彻底清空所有滚榜状态变量
        this.rollData = null;
        this.rollDataMap = null;
        this.rollStack = []; // 清空栈，不再使用
        this.currentJudgingIndex = -1;
        this.judgingTeamId = null;
        this.judgingProblemId = null;
        this.judgingTeamIdLast = null;
        this.animatingRisingTeamId = null;
        this.autoSpeed = this.DEFAULT_ROLL_SPEED;
        this.rollSpeedMultiplier = 1.0;
        this.isAutoRolling = false;
        this.currentRollStep = null;
        this.isInAwardArea = false;
        this.currentAwardLevel = 0;
        this.startAwardLevel = 0;
        this.autoAwardEntryPauseConsumed = false;
        this.awardShownTeams.clear();
        this.isSimulating = false;
        this.simulatedRollDataBackup = null;
        this.simulatedSolutionMapBackup = null;
        this.simulatedRollDataMapBackup = null;
        this.pendingAutoRoll = false;
        this.pendingScrollTeamId = null;
        this.scrollAnimationRunning = false;
        this.scrollAnimationId = null;
        this.lastScrollTeamId = null;
        this.lastScrollY = null;
        this.flgAwardRankReady = false;

        // U/I/重置：强制结束 FLIP 排序动画，避免旧 WAAPI 与下一帧 RenderRank 叠在半成品 DOM 上
        this._abortRollFlipAnimationsIfAny();

        // 启动动画状态（避免残留 RAF 干扰下一次启动）
        if (this._introScrollAnimId !== null) {
            cancelAnimationFrame(this._introScrollAnimId);
            this._introScrollAnimId = null;
        }
        this._introScrollAborted = false;
        this._introScrollDone = true;

        // 2. 清理所有定时器（包括 f 键滚动的定时器）
        if (this.scrollTimeout) {
            clearTimeout(this.scrollTimeout);
            this.scrollTimeout = null;
        }
        if (this.fastSkipScrollTimeout !== null) {
            clearTimeout(this.fastSkipScrollTimeout);
            this.fastSkipScrollTimeout = null;
        }
        if (this.fastSkipJudgeConfirmTimeout !== null) {
            clearTimeout(this.fastSkipJudgeConfirmTimeout);
            this.fastSkipJudgeConfirmTimeout = null;
        }
        
        // 3. 清除高亮 + 获奖全屏（U/I 撤回、ResetRollDataToInitial 等会走此路径，须关掉 overlay）
        this.ClearJudgingHighlight();
        this.HideModal('award');

        // 4. 清除所有tooltip
        this.HideGlobalTooltip();
        if (this.tooltipTimeouts) {
            Object.values(this.tooltipTimeouts).forEach(timeout => clearTimeout(timeout));
            this.tooltipTimeouts = {};
        }
        
        // 5. 如果需要，重新获取数据（从服务器重新加载）
        if (shouldReloadData) {
            await this.LoadData();
        }
        
        // 6. 重新初始化滚榜状态
        this.InitRollState();
        
        // 7. 设置 currentJudgingIndex 为最后一个队伍（初始状态）
        this.currentJudgingIndex = this.rollData.length > 0 ? this.rollData.length - 1 : -1;
    }

    /**
     * 中止榜单格上的 CSGAnim 排序动画并复位行内联 transform / z-index，
     * 供 U/I/Reset 数据核在重绘前调用，避免「撤回中途 + 新排序」与未收尾的 FLIP 竞态。
     */
    _abortRollFlipAnimationsIfAny() {
        const grid = (this.elements && this.elements.rankGrid)
            || (this.container && this.container.querySelector('.rank-grid'));
        if (!grid || !window.CSGAnim) {
            return;
        }
        try {
            if (typeof window.CSGAnim.cancelAnimations === 'function') {
                window.CSGAnim.cancelAnimations(grid, []);
            }
            if (window.CSGAnim.animationQueues instanceof Map) {
                window.CSGAnim.animationQueues.set(grid, []);
            }
            if (window.CSGAnim.isAnimating instanceof Map) {
                window.CSGAnim.isAnimating.set(grid, false);
            }
        } catch (e) {
            /* 仅收尾，静默 */
        }
        grid.querySelectorAll('.rank-row[data-row-id]').forEach((row) => {
            row.style.transform = '';
            row.style.willChange = '';
            row.style.backfaceVisibility = '';
            if (row.style.zIndex === '99') {
                row.style.zIndex = '';
            }
        });
    }
    
    /**
     * 重置滚榜 - 彻底重置所有变量并重新获取数据
     */
    async ResetRoll() {
        // 1. 停止滚榜
        if (this.isRolling) {
            this.StopRoll();
        }
        
        // 2. 执行核心重置逻辑（包含重新获取数据）
        await this._ResetRollDataCore(true);
        
        // 3. 渲染榜单
        if (this.rollData && this.rollData.length > 0) {
            const displayList = this.rollData;
            this.RenderRank(displayList);
        }
        
        // 4. 恢复启动按钮状态
        const startBtn = document.querySelector('#start-roll-btn');
        if (startBtn) {
            startBtn.classList.remove('disabled');
            startBtn.removeAttribute('disabled');
        }
                
        this.ShowMessage('滚榜已重置');
    }
    
    /**
     * 获奖 overlay 流程中（高亮待开 / 已开 / 关后收尾）属于状态机阻塞态。
     * 键盘入口不再按这些状态写快捷键白名单；操作类动作统一由快捷键分发器处理。
     * 这里仅供 RollNext 判断是否应暂缓刷新获奖线等副作用。
     */
    _isRollAwardStepBlocking() {
        const s = this.currentRollStep;
        return s === 'award_highlight' || s === 'award_open' || s === 'award_close';
    }

    _PauseAutoOnFirstAwardEntry() {
        if (!this.isAutoRolling || this.autoAwardEntryPauseConsumed || this.isInAwardArea) {
            return false;
        }
        this.autoAwardEntryPauseConsumed = true;
        this.isAutoRolling = false;
        this.pendingAutoRoll = false;
        this._dbg('state', 'auto paused on first award entry',
            { idx: this.currentJudgingIndex, team: this.judgingTeamId });
        return true;
    }

    /**
     * 下一个判题
     */
    RollNext() {
        this._dbg('roll', 'RollNext() ENTER', { step: this.currentRollStep, idx: this.currentJudgingIndex });
        if (!this.isRolling) {
            this._dbg('roll', 'RollNext() RETURN: not rolling');
            return;
        }

        // 启动动画进行中：触发"快滚到底"中断
        if (this.currentRollStep === 'intro_scroll') {
            this._dbg('intro', 'RollNext: abort intro');
            this._introScrollAborted = true;
            return;
        }

        // 启动动画后的"等待首次 N"空转：清状态并进入正式定位流程
        if (this.currentRollStep === 'wait_first_n') {
            this._dbg('state', 'wait_first_n -> null (first N pressed) -> JudgeConfirm');
            this.currentRollStep = null;
            this.ShowKeyHint('', '');
            this.JudgeConfirm();
            return;
        }

        // 颁奖态避免刷新获奖线等副作用抢戏；退出该态后的下一次 N 再更新
        if (!this._isRollAwardStepBlocking()) {
            this.DoUpdateAwardInfo();
        }

        // 强检查：如果滚榜已完成（currentJudgingIndex < 0），坚决停止所有操作
        if (this.currentJudgingIndex < 0) {
            this.ShowMessage('滚榜完成');
            this.currentRollStep = null;
            this.judgingTeamId = null;
            this.judgingProblemId = null;
            // 强制清空状态变量，避免残留导致奇怪行为
            this.awardShownTeams.clear();
            this.isInAwardArea = false;
            this.currentAwardLevel = 0;
            this.startAwardLevel = 0;
            this.StopRoll();
            return;
        }
        
        // RollAwardOverlay.isOpen() 在 hide() 触发后、fadeOutMs 定时器把 display 改为 none 之前
        // 一直为 true（roll_award_overlay.js）。award_close 的 RollNextStep 已执行完会立刻
        // JudgeConfirm，currentRollStep 可能已是 highlight_only/confirm，但 overlay 仍在淡出。
        // 若此时仍因 isOpen() 走「overlay 打开」专用分支，旧逻辑会误判为异常并清空 step，
        // 连按 N 无法进入正常 RollNextStep，直到淡出结束才恢复。故仅 award_open/award_close
        // 与「DOM 上 overlay 仍 flex」同时成立时才走本分支。
        const awardOpen = typeof RollAwardOverlay !== 'undefined' && RollAwardOverlay.isOpen();
        if (awardOpen && (this.currentRollStep === 'award_open' || this.currentRollStep === 'award_close')) {
            this.RollNextStep();
            return;
        }
        
        // 如果当前有步骤在执行，执行下一步
        if (this.currentRollStep) {
            this.RollNextStep();
            return;
        }
        // 执行确认步骤（定位到排名最靠后的有未揭晓题目的队伍）
        this.JudgeConfirm();
    }
    
    /**
     * 尝试自动滚榜（封装自动滚榜的延迟逻辑）
     * 根据 currentRollStep 决定延迟时间和执行的操作
     * @param {string} action - 要执行的操作类型: 'RollNextStep', 'JudgeDo', 'JudgeSort', 'JudgeConfirm', 'RollNext', null(根据currentRollStep自动判断)
     * @param {boolean} isSimulating - 是否在模拟模式下（模拟模式下不执行）
     */
    TryAutoRolling(action = null, isSimulating = false) {
        if (!this.isAutoRolling || isSimulating) {
            return;
        }

        // 根据 currentRollStep 或 action 决定延迟时间和执行的操作
        let delay = 0;
        let targetAction = action;
        
        // 如果没有指定 action，根据 currentRollStep 自动判断
        if (!targetAction) {
            switch (this.currentRollStep) {
                case 'confirm':
                    targetAction = 'JudgeDo';
                    delay = this.isInAwardArea ? Math.max(300, this.autoSpeed * 0.3) : 50;
                    break;
                case 'award_highlight':
                    targetAction = 'RollNextStep';
                    delay = this.isInAwardArea ? Math.max(300, this.autoSpeed * 0.3) : 200;
                    break;
                case 'do':
                    // do 步骤：如果没有AC，会直接设置 currentRollStep = 'sort'，这里按 sort 处理
                    // 如果AC了，会调用 JudgeSort，但这里我们已经在 JudgeDo 中处理了
                    targetAction = 'RollNextStep';
                    delay = this.isInAwardArea ? Math.max(200, this.autoSpeed * 0.2) : 50;
                    break;
                case 'judged':
                    // 'judged' 自动模式：等价于按 N 推进 → 调 RollNextStep 走 case 'judged'。
                    // 实际上 JudgeDo 里也直接 setTimeout 调 _AdvanceFromJudged，这里
                    // 是兜底（防止外部路径设到 judged 后忘了驱动）。
                    targetAction = 'RollNextStep';
                    delay = this.isInAwardArea ? Math.max(400, this.autoSpeed * 0.4) : Math.max(200, this.autoSpeed * 0.2);
                    break;
                case 'sort':
                    targetAction = 'RollNextStep'; // 会进入 sort 分支，调用 JudgeAward
                    delay = this.isInAwardArea ? Math.max(200, this.autoSpeed * 0.2) : 50;
                    break;
                case 'highlight_only':
                    // "看一眼"步骤：手动按 N 走 RollNextStep（i-- + JudgeConfirm）。
                    // 自动模式必须与之一致；误调 JudgeConfirm 会跳过 i--，卡在同一索引。
                    targetAction = 'RollNextStep';
                    delay = this.isInAwardArea
                        ? Math.max(300, this.autoSpeed * 0.3)
                        : Math.max(120, Math.floor(this.autoSpeed * 0.15));
                    break;
                case 'award_open':
                    // overlay 已展示：等价于按 N 关窗 → award_close（延迟略长于 roll_award_overlay 渐入）
                    targetAction = 'RollNextStep';
                    delay = this.isInAwardArea
                        ? Math.max(720, Math.floor(this.autoSpeed * 0.55))
                        : Math.max(500, Math.floor(this.autoSpeed * 0.4));
                    break;
                case 'award_close':
                    // 已发起关窗：等价于再按 N 完成 i 推进 + JudgeConfirm（延迟覆盖淡出）
                    targetAction = 'RollNextStep';
                    delay = this.isInAwardArea
                        ? Math.max(600, Math.floor(this.autoSpeed * 0.45))
                        : Math.max(400, Math.floor(this.autoSpeed * 0.35));
                    break;
                default:
                    // 默认不执行
                    return;
            }
        } else {
            // 如果指定了 action，根据 action 类型和 currentRollStep 决定延迟
            switch (targetAction) {
                case 'RollNextStep':
                    if (this.currentRollStep === 'award_highlight') {
                        delay = this.isInAwardArea ? Math.max(300, this.autoSpeed * 0.3) : 200;
                    } else if (this.currentRollStep === 'award_open') {
                        delay = this.isInAwardArea
                            ? Math.max(720, Math.floor(this.autoSpeed * 0.55))
                            : Math.max(500, Math.floor(this.autoSpeed * 0.4));
                    } else if (this.currentRollStep === 'award_close') {
                        delay = this.isInAwardArea
                            ? Math.max(600, Math.floor(this.autoSpeed * 0.45))
                            : Math.max(400, Math.floor(this.autoSpeed * 0.35));
                    } else if (this.currentRollStep === 'highlight_only') {
                        delay = this.isInAwardArea
                            ? Math.max(300, this.autoSpeed * 0.3)
                            : Math.max(120, Math.floor(this.autoSpeed * 0.15));
                    } else {
                        delay = this.isInAwardArea ? Math.max(200, this.autoSpeed * 0.2) : 50;
                    }
                    break;
                case 'JudgeDo':
                    delay = this.isInAwardArea ? Math.max(300, this.autoSpeed * 0.3) : 50;
                    break;
                case 'JudgeSort':
                    delay = this.isInAwardArea ? Math.max(200, this.autoSpeed * 0.2) : 50;
                    break;
                case 'JudgeConfirm':
                    delay = this.isInAwardArea ? Math.max(this.autoSpeed, 256) : 0;
                    break;
                case 'RollNext':
                    delay = this.isInAwardArea ? Math.max(200, this.autoSpeed * 0.2) : 50;
                    break;
                default:
                    return;
            }
        }
        
        // 如果延迟为0，直接执行；否则延迟执行
        const executeAction = () => {
            switch (targetAction) {
                case 'RollNextStep':
                    this.RollNextStep();
                    break;
                case 'JudgeDo':
                    this.JudgeDo();
                    break;
                case 'JudgeSort':
                    this.JudgeSort();
                    break;
                case 'JudgeConfirm':
                    // highlight_only 下按 N 的语义是 RollNextStep；若误传 JudgeConfirm 须与此一致
                    if (this.currentRollStep === 'highlight_only') {
                        this.RollNextStep();
                    } else {
                        this.JudgeConfirm();
                    }
                    break;
                case 'RollNext':
                    this.RollNext();
                    break;
            }
        };
        
        let delayMs = delay;
        if (!Number.isFinite(delayMs) || delayMs < 0) {
            delayMs = 200;
        }
        if (delayMs === 0) {
            executeAction();
        } else {
            setTimeout(executeAction, delayMs);
        }
    }
    
    /**
     * 步骤推进
     */
    RollNextStep() {
        this._dbg('roll', 'RollNextStep() ENTER', { step: this.currentRollStep, idx: this.currentJudgingIndex });
        // 强检查：如果滚榜已完成（currentJudgingIndex < 0），坚决停止所有操作
        if (this.currentJudgingIndex < 0) {
            this._dbg('roll', 'RollNextStep: idx<0 -> StopRoll');
            this.ShowMessage('滚榜完成');
            this.currentRollStep = null;
            this.judgingTeamId = null;
            this.judgingProblemId = null;
            // 强制清空状态变量，避免残留导致奇怪行为
            this.awardShownTeams.clear();
            this.isInAwardArea = false;
            this.currentAwardLevel = 0;
            this.startAwardLevel = 0;
            this.StopRoll();
            return;
        }

        switch (this.currentRollStep) {
            case 'confirm':
                // 'confirm' 状态意味着 JudgeConfirm 已经定位好 judgingTeamId / judgingProblemId
                // 并完成了高亮，用户按 N 的语义就是"揭晓这道题"，直接调 JudgeDo 即可。
                // （以前这里又重新调一次 FindNextJudging 是冗余的：FindNextJudging 在
                // currentJudgingIndex 不变的情况下会找到同一个队，反而带来路径分叉。）
                this.JudgeDo();
                break;
            case 'judged':
                // 'judged' 状态意味着题目刚揭晓完毕、DOM 已变色但还没排序上升。
                // 按 N 的语义：触发 JudgeSort 启动排序动画 + 后续判奖/定位。
                this._AdvanceFromJudged();
                break;
            case 'award_highlight':
                // 获奖高亮步骤：已高亮，下一步打开获奖 overlay
                if (this._PauseAutoOnFirstAwardEntry()) {
                    break;
                }
                const currentItem = this.rollDataMap.get(this.judgingTeamId);
                
                if (currentItem && currentItem.displayRank !== '*') {
                    // 与 ShouldShowAward 同步（含多归属勾选下「所选归属内无牌不弹」）；防状态边缘重复按 N
                    if (
                        !this.ShouldShowAward(
                            { team_id: this.judgingTeamId },
                            currentItem,
                            this.realRankMap
                        )
                    ) {
                        this.currentRollStep = null;
                        this._AdvanceIndexAfterTeamHandled();
                        this.ClearJudgingHighlight();
                        if (this.currentJudgingIndex >= 0) {
                            this.RollNext();
                        } else {
                            this.JudgeConfirm();
                        }
                        break;
                    }
                    const awardType = this._GetBestAwardClassForTeamRoll(this.judgingTeamId);
                    if (awardType) {
                        // 须先 ShowAward 成功再置 award_open；否则 isOpen() 为假会被误判为「异常跳过」
                        if (!this.ShowAward(this.judgingTeamId, awardType)) {
                            this.currentRollStep = null;
                            this._AdvanceIndexAfterTeamHandled();
                            this.ClearJudgingHighlight();
                            if (this.currentJudgingIndex >= 0) {
                                this.RollNext();
                            } else {
                                this.JudgeConfirm();
                            }
                            break;
                        }
                        this.currentRollStep = 'award_open';

                        // 标记该队伍已经显示过获奖，避免重复弹出
                        this.awardShownTeams.add(this.judgingTeamId);

                        // 更新获奖区域状态
                        if (!this.isInAwardArea) {
                            this.isInAwardArea = true;
                        }
                        this.TryAutoRolling('RollNextStep');
                    } else {
                        // 不在 gold/silver/bronze 任一档：当前队不需要弹奖，但仍按
                        // "经过 i 处的队"原则推进——队仍在 i → i--；AC 升走 → i 不变。
                        this.currentRollStep = null;
                        this._AdvanceIndexAfterTeamHandled();
                        this.ClearJudgingHighlight();
                        if (this.currentJudgingIndex >= 0) {
                            this.RollNext();
                        } else {
                            this.JudgeConfirm();
                        }
                    }
                } else {
                    this.currentRollStep = null;
                    this._AdvanceIndexAfterTeamHandled();
                    this.ClearJudgingHighlight();
                    if (this.currentJudgingIndex >= 0) {
                        this.RollNext();
                    } else {
                        this.JudgeConfirm();
                    }
                }
                break;
            case 'do':
                this.JudgeSort();
                break;
            case 'sort':
                this.JudgeAward();
                break;
            case 'award_open':
                // 获奖 overlay 已打开，下一步是关闭
                if (typeof RollAwardOverlay !== 'undefined' && RollAwardOverlay.isOpen()) {
                    this.currentRollStep = 'award_close';
                    this.HideModal('award');
                    this.TryAutoRolling('RollNextStep');
                } else {
                    // overlay 未打开（异常兜底）：按"经过 i 处的队"原则推进，与 award_close 一致
                    this.currentRollStep = null;
                    this._AdvanceIndexAfterTeamHandled();
                    this.ClearJudgingHighlight();
                    if (this.currentJudgingIndex >= 0) {
                        this.RollNext();
                    } else {
                        this.JudgeConfirm();
                    }
                }
                break;
            case 'award_close':
                // 获奖 overlay 已关闭，继续下一个。
                // 关键不变量：i 只在「弹奖队伍仍停在 i 处」时推进；如果该队是揭晓最后一题
                // 后 AC 升上去再弹奖（i 处现在是落下来的别的队），i 不能--，否则会把 i 处的
                // 新队跳过——这正是用户指出的"跳过中间队"问题的根源场景之一。
                if (typeof RollAwardOverlay !== 'undefined' && RollAwardOverlay.isOpen()) {
                    this.HideModal('award');
                }
                this._AdvanceIndexAfterTeamHandled();
                this.ClearJudgingHighlight();
                this.currentRollStep = null;
                // 与 highlight_only 一致：本步结束后应已定位下一待揭晓位，勿再空转一次 N。
                // 滚榜完成仍走 JudgeConfirm；自动模式交给 TryAutoRolling；手动则直接 JudgeConfirm。
                if (this.currentJudgingIndex < 0) {
                    this.JudgeConfirm();
                } else if (this.isAutoRolling) {
                    this.TryAutoRolling('RollNext');
                } else {
                    this.JudgeConfirm();
                }
                break;
            case 'award':
                // 兼容旧逻辑：如果 overlay 已打开，关闭它；否则继续下一个
                if (typeof RollAwardOverlay !== 'undefined' && RollAwardOverlay.isOpen()) {
                    this.currentRollStep = 'award_close';
                    this.HideModal('award');
                } else {
                    this._AdvanceIndexAfterTeamHandled();
                    this.ClearJudgingHighlight();
                    this.currentRollStep = null;
                    if (this.currentJudgingIndex >= 0) {
                        this.RollNext();
                    } else {
                        this.JudgeConfirm();
                    }
                }
                break;
            case 'sort_award':
                this.JudgeAward();
                break;
            case 'highlight_only':
                // 一次"看一眼"步骤：当前位置 i 的队伍已 highlight，按 N → 推进到下一位。
                // highlight_only 期间不会触发任何揭晓/排序，队伍位置不会变化，故走通用
                // _AdvanceIndexAfterTeamHandled 的 stayedAtSamePos 分支稳定 i--。
                // currentJudgingIndex 单调递减的关键时机之一（另一个在 case 'award_close'
                // 和 _JudgeSortDoneJudge）。
                this.currentRollStep = null;
                this._AdvanceIndexAfterTeamHandled();
                this.ClearJudgingHighlight();
                this.JudgeConfirm();
                break;
            default:
                this.RollNext();
                break;
        }
    }
    
    /**
     * 查找当前要处理的队伍。
     *
     * 关键策略（**严禁回退到老的 for 循环跳过式逻辑**）：
     *   FindNextJudging **只看 `currentJudgingIndex` 这一位**，不跳过任何中间位置。
     *
     *   "按顺序往前滚，只要经过的队伍就一定要看"——`currentJudgingIndex` 单调递减，
     *   推进时机集中在两个清晰的转换点：
     *     1) `_JudgeSortDoneJudge`：当前队的最后一题揭晓完，且排序后该队仍停在 i
     *        位置（WA 或 AC 但没改名次）→ `currentJudgingIndex--`；
     *        否则（队 AC 升到新位置，i 处现在是别的队）→ `currentJudgingIndex` 不变，
     *        下次 FindNextJudging 经过 i 处的新队（落下来的）做 highlight / 揭晓 / 弹奖。
     *     2) `RollNextStep` case 'highlight_only'：N 后 i-- 并 JudgeConfirm；case 'award_close'：
     *        N 后 i-- / 清高光，须**再**按 N 才 JudgeConfirm（不链式自动步进）。
     *
     *   升上去的队在新位置自然会被 `currentJudgingIndex` 走到，不需要 settled 标记。
     *
     * 返回值：
     *   - null：滚榜结束（currentJudgingIndex < 0）或当前位置数据异常
     *   - { team_id, problemId, needsAward:false, needsSkip:false }：当前队有 frozen 题，锁第一题
     *   - { team_id, problemId:null, needsAward:true, needsSkip:false }：当前队无 frozen 但需弹奖
     *   - { team_id, problemId:null, needsAward:false, needsSkip:true }：当前队无 frozen 不需弹奖，highlight 一次
     */
    FindNextJudging() {
        // 滚榜已完成
        if (this.currentJudgingIndex < 0) {
            return null;
        }
        // 越界保护：clamp 到合法范围
        if (this.currentJudgingIndex >= this.rollData.length) {
            this.currentJudgingIndex = this.rollData.length - 1;
        }

        const i = this.currentJudgingIndex;
        const teamData = this.rollData[i];
        if (!teamData) {
            // 数据异常：i-- 跳过这个位置（绝不能 return null 终止整个滚榜）
            this._dbg('confirm', 'FindNextJudging: skip bad slot (no teamData)', { i });
            this.currentJudgingIndex--;
            return this.FindNextJudging();
        }

        const rankedItem = this.rollDataMap ? this.rollDataMap.get(teamData.team_id) : null;
        const solutions = this.rollSolutionMap ? this.rollSolutionMap[teamData.team_id] : null;
        if (!rankedItem || !solutions) {
            // 数据异常：i-- 跳过这个位置
            this._dbg('confirm', 'FindNextJudging: skip bad slot (no rankedItem/solutions)',
                { i, team: teamData.team_id });
            this.currentJudgingIndex--;
            return this.FindNextJudging();
        }

        // 1) 有 frozen 题：锁定编号最小的那道题等揭晓
        const hasFrozenProblems = solutions.frozen && Object.keys(solutions.frozen).length > 0;
        if (hasFrozenProblems) {
            const frozenProblems = Object.keys(solutions.frozen)
                .filter(problemId => solutions.frozen[problemId])
                .map(problemId => {
                    const problem = this.problemMap[problemId];
                    return {
                        problemId: problemId,
                        num: problem ? (problem.num !== undefined ? problem.num : 9999) : 9999
                    };
                })
                .sort((a, b) => a.num - b.num);

            if (frozenProblems.length > 0) {
                this._dbg('confirm', 'FindNextJudging -> needsProblem',
                    { i, team: teamData.team_id, problem: frozenProblems[0].problemId });
                return {
                    team_id: teamData.team_id,
                    problemId: frozenProblems[0].problemId,
                    needsAward: false,
                    needsSkip: false
                };
            }
        }

        // 2) 无 frozen 题：尘埃落定，更新获奖线就绪标志
        if (teamData.solved > 0) {
            this.flgAwardRankReady = true;
        }

        // 3) 无 frozen + 在获奖区且未弹过奖 → 需要弹奖
        if (this.ShouldShowAward(teamData, rankedItem, this.realRankMap)) {
            this._dbg('confirm', 'FindNextJudging -> needsAward', { i, team: teamData.team_id });
            return {
                team_id: teamData.team_id,
                problemId: null,
                needsAward: true,
                needsSkip: false
            };
        }

        // 4) 无 frozen + 不需弹奖 → highlight_only 看一眼，按 N 后 i--
        this._dbg('confirm', 'FindNextJudging -> needsSkip', { i, team: teamData.team_id });
        return {
            team_id: teamData.team_id,
            problemId: null,
            needsAward: false,
            needsSkip: true
        };
    }
    
    /**
     * 判题确认：定位到当前索引的队伍，先高亮，再判断需要判题、获奖还是跳过
     */
    JudgeConfirm() {
        this._dbg('confirm', 'JudgeConfirm() ENTER',
            { idx: this.currentJudgingIndex, step: this.currentRollStep, lastJudging: this.judgingTeamIdLast });
        // 强检查：如果滚榜已完成（currentJudgingIndex < 0），坚决停止所有操作
        if (this.currentJudgingIndex < 0) {
            this._dbg('confirm', 'JudgeConfirm: idx<0 -> StopRoll');
            this.ShowMessage('滚榜完成');
            this.currentRollStep = null;
            this.judgingTeamId = null;
            this.judgingProblemId = null;
            // 强制清空状态变量，避免残留导致奇怪行为
            this.awardShownTeams.clear();
            this.isInAwardArea = false;
            this.currentAwardLevel = 0;
            this.startAwardLevel = 0;
            this.StopRoll();
            return null;
        }
        this.DoUpdateAwardInfo();
        
        const isSimulating = this.isSimulating;
        
        // 查找下一个要处理的队伍
        const nextJudging = this.FindNextJudging();
        if (!nextJudging) {
            this._dbg('confirm', 'JudgeConfirm: nextJudging=null -> StopRoll');
            // 没有找到，滚榜完成
            this.ShowMessage('滚榜完成');
            this.currentRollStep = null;
            this.currentJudgingIndex = -1;
            this.judgingTeamId = null;
            this.judgingProblemId = null;
            // 强制清空状态变量，避免残留导致奇怪行为
            this.awardShownTeams.clear();
            this.isInAwardArea = false;
            this.currentAwardLevel = 0;
            this.startAwardLevel = 0;
            this.StopRoll();
            return null;
        }
        
        // 设置当前判题的队伍和题目
        this.judgingTeamId = nextJudging.team_id;
        this.judgingProblemId = nextJudging.problemId;
        this.judgingTeamIdLast = nextJudging.team_id;
        
        // 先高亮当前队伍（无论是否需要判题或获奖）
        this.currentRollStep = 'confirm';
        if (!isSimulating) {
            // 使用 requestAnimationFrame 确保DOM有时间渲染高亮效果
            requestAnimationFrame(() => {
                // 清除之前的高亮
                this.container.querySelectorAll('.rank-row.roll-judging').forEach(row => {
                    row.classList.remove('roll-judging');
                });
                this.container.querySelectorAll('.problem-item.roll-judging-problem').forEach(item => {
                    item.classList.remove('roll-judging-problem');
                });
                // 上一题的"余韵高亮"边框，到本次锁定下一题/下一队时一起清掉
                this.container.querySelectorAll('.problem-item.roll-judged-problem').forEach(item => {
                    item.classList.remove('roll-judged-problem');
                });

                // 高亮当前队伍
                const teamRow = document.getElementById(`rank-grid-${nextJudging.team_id}`);
                if (teamRow) {
                    teamRow.classList.add('roll-judging');
                    
                    // 关键修复：如果需要显示获奖（needsAward），不要立即滚动
                    // 全屏获奖 overlay 会改变布局，易导致滚动计算与视口错位
                    // 只有在需要判题（needsProblem）或需要跳过（needsSkip）时才滚动
                    // if (!nextJudging.needsAward) {
                        // 使用滚动管理，确保窗口跟随当前激活的队伍（这会中断f键的滚动）
                        this.scrollToTeam(nextJudging.team_id);
                    // }
                    // 需要显示获奖时跳过滚动，避免 overlay 与视口错位
                    
                    // 如果有要揭晓的题目，也高亮题目
                    if (nextJudging.problemId) {
                        const problem = this.problemMap[nextJudging.problemId];
                        if (problem) {
                            const problemAlphabetIdx = this.GetProblemAlphabetIdx(problem.num);
                            const problemItem = teamRow.querySelector(
                                `.problem-item[d-pro-idx="${problemAlphabetIdx}"]`
                            );
                            if (problemItem) {
                                problemItem.classList.add('roll-judging-problem');
                            }
                        }
                    }
                }
            });
        }
                
        // 当前位置 i 的队伍已全部揭晓且不需要获奖：把它当成一次"看一眼"步骤——
        // 队伍已经在上面的 requestAnimationFrame 中被高亮，等用户按 N。
        // 推进 i 由 RollNextStep case 'highlight_only' 统一负责（i--），不在这里推。
        // 这样保证 currentJudgingIndex 单调递减、不跳过任何位置。
        if (nextJudging.needsSkip) {
            this.currentRollStep = 'highlight_only';
            this._dbg('state', 'JudgeConfirm: needsSkip -> highlight_only',
                { team: nextJudging.team_id, idx: this.currentJudgingIndex });

            // 自动模式：等价于按 N → RollNextStep（i-- + JudgeConfirm），勿直接 JudgeConfirm
            this.TryAutoRolling('RollNextStep', isSimulating);

            return nextJudging;
        }
        
        // 如果需要显示获奖，进入获奖高亮步骤（下一步再打开 overlay）
        if (nextJudging.needsAward) {
            this.currentRollStep = 'award_highlight';
            this._dbg('state', 'JudgeConfirm: needsAward -> award_highlight', { team: nextJudging.team_id });

            // 自动滚榜第一次进入奖区时停在获奖队高亮，交给主持人手动讲解；
            // 之后用户再次开启自动滚榜不再因奖区自动停。
            if (!isSimulating && !this._PauseAutoOnFirstAwardEntry()) {
                // 自动模式下延迟后进入下一步（打开 overlay）
                this.TryAutoRolling('RollNextStep', isSimulating);
            }
            
            return nextJudging;
        }
        
        // 需要判题，设置 confirm 步骤
        this.currentRollStep = 'confirm';
        this._dbg('state', 'JudgeConfirm: needsProblem -> confirm', {
            team: nextJudging.team_id, problem: nextJudging.problemId,
        });

        // 自动模式下自动进入下一步
        this.TryAutoRolling('JudgeDo', isSimulating);
        
        return nextJudging;
    }
    
    /**
     * 执行判题
     */
    JudgeDo() {
        this._dbg('judge', 'JudgeDo() ENTER',
            { team: this.judgingTeamId, problem: this.judgingProblemId, step: this.currentRollStep });
        this.currentRollStep = 'do';

        if (!this.judgingTeamId) {
            this._dbg('judge', 'JudgeDo: no judgingTeamId -> null');
            this.currentRollStep = null;
            return;
        }
        
        // 如果没有题目，直接跳过排序进入获奖检查
        if (!this.judgingProblemId) {
            this.currentRollStep = 'sort';
            // 自动模式下延迟后进入下一步
            this.TryAutoRolling('RollNextStep');
            return;
        }
        
        const team_solutions = this.rollSolutionMap[this.judgingTeamId];
        const team_problem_solutions = team_solutions.problems[this.judgingProblemId] || [];
        
        // 检查是否AC，并计算submitCount
        let isAC = false;
        let submitCount = 0;
        let acTime = '';
        let firstAcIndex = -1;
        
        // 找到第一次AC的位置
        for (let i = 0; i < team_problem_solutions.length; i++) {
            if (team_problem_solutions[i].result === 4) {
                isAC = true;
                acTime = team_problem_solutions[i].in_date;
                firstAcIndex = i;
                break;
            }
        }
        
        if (isAC && firstAcIndex >= 0) {
            submitCount = firstAcIndex + 1;
        } else {
            submitCount = team_problem_solutions.length;
        }
        
        // 更新队伍数据
        const teamData = this.rollDataMap ? this.rollDataMap.get(this.judgingTeamId) : null;
        let penaltyChange = 0;
        if (teamData) {
            if (isAC) {
                teamData.solved += 1;
                const startTime = this._rankWireInstantMs(this.data.contest.start_time);
                const acTimeMs = this._rankWireInstantMs(acTime);
                const deltaSeconds = Math.floor((acTimeMs - startTime) / 1000);
                penaltyChange = deltaSeconds + (submitCount - 1) * 20 * 60;
                teamData.penalty += penaltyChange;
                // 更新题目状态
                teamData.problemStats[this.judgingProblemId].status = 'ac';
                teamData.problemStats[this.judgingProblemId].submitCount = submitCount;
                teamData.problemStats[this.judgingProblemId].lastSubmitTime = this.formatDuration(deltaSeconds * 1000);
                // 新的 ac 出现，考虑更新获奖线
                if(teamData.solved == 1) {
                    this.DoUpdateAwardInfo();
                }
            } else {
                teamData.problemStats[this.judgingProblemId].status = 'wa';
                teamData.problemStats[this.judgingProblemId].submitCount = submitCount;
                if (submitCount > 0) {
                    const lastTime = this._rankWireInstantMs(team_problem_solutions[submitCount - 1].in_date);
                    const startTime = this._rankWireInstantMs(this.data.contest.start_time);
                    const deltaSeconds = Math.floor((lastTime - startTime) / 1000);
                    teamData.problemStats[this.judgingProblemId].lastSubmitTime = this.formatDuration(deltaSeconds * 1000);
                }
            }
        }
                
        // 移除frozen标记
        delete team_solutions.frozen[this.judgingProblemId];
        
        // 如果揭晓的题目是AC，需要重新计算一血状态
        if (isAC && acTime) {
            this.UpdateFirstBloodForProblem(this.judgingProblemId);
        }
        
        // 更新上次判题的队伍ID
        this.judgingTeamIdLast = this.judgingTeamId;

        if (this.isSimulating) return;

        // 注意时序：UpdateRankRowForJudging 会**重新生成行内 DOM**（包括 problem-item），
        // 所以原来的 .roll-judging-problem class 会随旧 DOM 一起消失。
        // 我们要**在重新渲染之后**，根据 judgingProblemId 重新定位题目元素再加
        // .roll-judged-problem，否则边框立刻消失（之前的 bug）。
        const judgedTeamId = this.judgingTeamId;
        const judgedProblemId = this.judgingProblemId;
        this.UpdateRankRowForJudging(judgedTeamId);
        this._dbg('judge', 'JudgeDo: 揭晓完成 -> judged', { isAC, team: judgedTeamId });

        // 把刚揭晓的题加 .roll-judged-problem（仅保留橙色 outline，背景色由
        // .pro-ac / .pro-wa 决定）。这样揭晓后题目格"焦点边框"不会立刻消失——
        // 观众视线还能锁在这一格。边框会在下次 JudgeConfirm 锁定下一题/下一队
        // 时由统一的 querySelector('.roll-judged-problem') 清掉。
        const judgedRow = document.getElementById(`rank-grid-${judgedTeamId}`);
        const judgedProblem = judgedProblemId ? this.problemMap[judgedProblemId] : null;
        if (judgedRow && judgedProblem) {
            const alphabetIdx = this.GetProblemAlphabetIdx(judgedProblem.num);
            const problemItem = judgedRow.querySelector(
                `.problem-item[d-pro-idx="${alphabetIdx}"]`
            );
            if (problemItem) {
                problemItem.classList.add('roll-judged-problem');
                // 同时清掉可能残留的 .roll-judging-problem（pending 黄底）
                problemItem.classList.remove('roll-judging-problem');
            }
        }

        // 关键手感设计：揭晓后**不立即排序上升**，停在 'judged' 状态。
        // 题目格已经变色（绿/红）+ 余韵边框，队伍仍高亮——观众有一拍
        // "看清楚答案是对是错"的停顿；下次按 N 才真正触发 JudgeSort（排序+判奖）。
        //
        // 这避免了"揭晓即排序"的撕扯感（行同时变色和飞起来眼睛跟不上）。
        // 自动模式下用 setTimeout 模拟"按 N"，延时与排序动画衔接保持原有节奏。
        this._pendingJudgeIsAC = !!isAC;
        this.currentRollStep = 'judged';
        if (this.isAutoRolling) {
            const judgedDelay = this.isInAwardArea ? Math.max(400, this.autoSpeed * 0.4) : Math.max(200, this.autoSpeed * 0.2);
            setTimeout(() => {
                if (this.currentRollStep === 'judged') this._AdvanceFromJudged();
            }, judgedDelay);
        }
    }

    /**
     * 从 'judged' 状态推进到 JudgeSort（排序+判奖）。
     * 由 RollNextStep case 'judged' / JudgeDo 自动模式 setTimeout 调用。
     */
    _AdvanceFromJudged() {
        const isAC = !!this._pendingJudgeIsAC;
        this._pendingJudgeIsAC = false;
        this._dbg('judge', '_AdvanceFromJudged -> JudgeSort', { isAC });
        this.JudgeSort(isAC);
    }

    /**
     * 通用工具：当前队（this.judgingTeamId）在 i 位置上的处理已结束（揭晓最后一题 /
     * 弹奖关闭 / highlight 完毕）后，按"队伍是否仍在 i 处"决定 currentJudgingIndex 是否--。
     *
     * - 队仍在 i 处（WA 不动 / AC 但没改名次 / 弹奖不会改位置）→ i--，推进到下一位
     * - 队 AC 升到了新 displayIdx，i 处现在是别的队（落下来的）→ i 不变，下一次
     *   FindNextJudging 处理 i 处新落下来的队
     *
     * 这是"按顺序经过、不跳位"的稳定策略——不需要任何 settled 标记。
     */
    _AdvanceIndexAfterTeamHandled() {
        const i = this.currentJudgingIndex;
        if (i < 0 || i >= this.rollData.length) {
            // 越界：直接 i--（兜底，正常不应到这里）
            this.currentJudgingIndex--;
            return;
        }
        const teamAtCurrentIdx = this.rollData[i] ? this.rollData[i].team_id : null;
        const stayedAtSamePos = teamAtCurrentIdx === this.judgingTeamId;
        if (stayedAtSamePos) {
            this.currentJudgingIndex--;
            this._dbg('state', '_AdvanceIndexAfterTeamHandled: i--',
                { team: this.judgingTeamId, oldIdx: i, newIdx: this.currentJudgingIndex });
        } else {
            this._dbg('state', '_AdvanceIndexAfterTeamHandled: i unchanged (team moved up)',
                { team: this.judgingTeamId, idx: i, nowAtIdx: teamAtCurrentIdx });
        }
    }

    /**
     * JudgeSort 完成后的统一判断入口。
     *
     * **关键手感**：揭晓后已经在 'judged' 状态有过"看清楚结果"的停顿；
     * 排序完成后**不再 highlight_only 中转**——直接进入下一动作：
     *   - 还有 frozen 题            → 直接 JudgeConfirm 锁定下一题（confirm）
     *   - 无 frozen + 需弹奖 + 排序后仍在原下标 → 直接走 award_highlight 同步弹 overlay
     *   - 无 frozen + 需弹奖 + 排序后下标变了（上升/下降）→ 不立刻弹奖，JudgeConfirm；
     *     等索引走到该队新位置时再 needsAward（与旧版「名次落定再弹」一致）
     *   - 无 frozen + 不需弹奖 + 没动 → currentJudgingIndex-- + JudgeConfirm 处理新位置
     *   - 无 frozen + 不需弹奖 + AC 升 → currentJudgingIndex 不变 + JudgeConfirm
     *                                     处理 i 处现在落下来的新队（highlight 一次）
     *
     * 关键不变量：
     *   - currentJudgingIndex 单调递减，**只在两个时机推进**：
     *     1) 这里：当前队最后一题揭晓完、不需弹奖、且排序后仍在原位（已经在 'judged' 停过）
     *     2) RollNextStep 中 case 'highlight_only' / 'award_close'：N 后推进
     *   - 队 AC 升上去后，i 不变，让 i 处新落下来的队被 JudgeConfirm 经过；该升上去的
     *     队会在 i 走到它的新位置时被再次经过（再 highlight 一次）
     *
     * 严禁回退到旧的 settled 标记式策略——按位置推进就是最稳健的方案。
     *
     * @param {{ afterSort?: boolean, teamIndexBefore?: number|null }} [opts]
     *   afterSort：本步执行了 RollSort（有「上升动画」语义）；false 表示 WA 等未重排。
     *   teamIndexBefore：RollSort 前该队在 rollData 中的下标（与 CalculateRankInfo 顺序一致）；
     *   仅在 afterSort 为 true 时用于判断名次相对排序是否改变。
     */
    _JudgeSortDoneJudge(opts = {}) {
        const afterSort = !!opts.afterSort;
        const teamIndexBefore = opts.teamIndexBefore != null ? opts.teamIndexBefore : null;

        if (!this.judgingTeamId) {
            this._dbg('state', 'JudgeSort done -> JudgeConfirm (no judgingTeamId)');
            this.currentRollStep = null;
            this.JudgeConfirm();
            return;
        }
        const teamId = this.judgingTeamId;
        const currentItem = this.rollDataMap ? this.rollDataMap.get(teamId) : null;
        const solutions = this.rollSolutionMap ? this.rollSolutionMap[teamId] : null;
        const hasFrozen = solutions && solutions.frozen && Object.keys(solutions.frozen).length > 0;

        // 1) 当前队仍有 frozen 题：i 不变，FindNextJudging 会锁定该队的下一题
        if (hasFrozen) {
            this._dbg('state', 'JudgeSort done -> JudgeConfirm (still has frozen)',
                { team: teamId, idx: this.currentJudgingIndex });
            this.currentRollStep = null;
            this.JudgeConfirm();
            return;
        }

        // 2) 当前队无 frozen 题：判断是否需弹奖
        if (currentItem && currentItem.solved > 0) {
            this.flgAwardRankReady = true;
        }
        const idxAfterSort = this.rollData ? this.rollData.findIndex(t => t.team_id === teamId) : -1;
        // 与旧版 JudgeSort 一致：排序导致该队在 rollData 中下标变化时，数据名次已更新但行还在飞，
        // 此时不立刻弹 overlay；等 JudgeConfirm / FindNextJudging 在「落定」路径上再 needsAward。
        const sortRankSlotChanged = afterSort && (
            teamIndexBefore === null ||
            idxAfterSort < 0 ||
            teamIndexBefore !== idxAfterSort
        );
        if (currentItem && this.ShouldShowAward({ team_id: teamId }, currentItem, this.realRankMap)) {
            if (sortRankSlotChanged) {
                this._dbg('state', 'JudgeSort done -> JudgeConfirm (defer award: rank slot changed or unknown)',
                    { team: teamId, idx: this.currentJudgingIndex, teamIndexBefore, idxAfterSort });
                this.currentRollStep = null;
                this.JudgeConfirm();
                return;
            }
            // 直接弹奖：复用 case 'award_highlight' 的同步弹 overlay 路径。
            // i 不在这里推进，等 award_close 时统一推进。
            this.currentRollStep = 'award_highlight';
            this._dbg('state', 'JudgeSort done -> award_highlight (direct popup)',
                { team: teamId, idx: this.currentJudgingIndex });
            this.RollNextStep();
            return;
        }

        // 3) 无 frozen + 不需弹奖：当前队在 'judged' 中已经停过一拍。
        //    按"队是否仍在 i 处"决定 i--：仍在原位 → i--；AC 升走 → i 不变（让 i 处
        //    新落下来的队被 JudgeConfirm 经过）。统一走 _AdvanceIndexAfterTeamHandled。
        this._AdvanceIndexAfterTeamHandled();
        this.currentRollStep = null;
        this.JudgeConfirm();
    }
    
    /**
     * 为特定题目重新计算并更新一血状态
     * 在滚榜揭晓题目时调用，遍历所有队伍的已揭晓AC提交，找出最早的一个
     * @param {string} problemId - 题目ID
     */
    UpdateFirstBloodForProblem(problemId) {
        if (!this.rollSolutionMap || !this.teamMap || !problemId) {
            return;
        }
        
        // 用于记录最早AC的队伍和时间
        let globalFirstBlood = null;  // { team_id, in_date, isStarTeam }
        let regularFirstBlood = null; // { team_id, in_date } (仅非打星队)
        
        // 遍历所有队伍
        for (const teamId in this.rollSolutionMap) {
            const solutions = this.rollSolutionMap[teamId];
            if (!solutions || !solutions.problems || !solutions.problems[problemId]) {
                continue;
            }
            
            // 检查该题目的提交是否已揭晓（非frozen）
            const isFrozen = solutions.frozen && solutions.frozen[problemId];
            if (isFrozen) {
                // 还未揭晓，跳过
                continue;
            }
            
            // 遍历该队伍的所有提交，找出第一次AC
            const problemSolutions = solutions.problems[problemId];
            for (const solution of problemSolutions) {
                if (solution.result === 4) { // AC
                    const team = this.teamMap[teamId];
                    const isStarTeam = team && team.tkind === 2;
                    const inDate = solution.in_date;
                    
                    // 更新全局一血（所有队伍）
                    if (!globalFirstBlood || inDate < globalFirstBlood.in_date) {
                        globalFirstBlood = {
                            team_id: teamId,
                            in_date: inDate,
                            isStarTeam: isStarTeam
                        };
                    }
                    
                    // 更新常规一血（仅非打星队）
                    if (!isStarTeam) {
                        if (!regularFirstBlood || inDate < regularFirstBlood.in_date) {
                            regularFirstBlood = {
                                team_id: teamId,
                                in_date: inDate
                            };
                        }
                    }
                    
                    // 找到第一次AC就停止（因为题目提交是按时间顺序的）
                    break;
                }
            }
        }
        
        // 更新全局一血记录
        if (globalFirstBlood) {
            // 如果之前有记录但新的更早，或者之前没有记录，则更新
            const existingGlobal = this.map_fb?.global?.[problemId];
            if (!existingGlobal || globalFirstBlood.in_date < existingGlobal.in_date) {
                if (!this.map_fb.global) {
                    this.map_fb.global = {};
                }
                this.map_fb.global[problemId] = {
                    team_id: globalFirstBlood.team_id,
                    in_date: globalFirstBlood.in_date,
                    isStarTeam: globalFirstBlood.isStarTeam
                };
            }
        }
        
        // 更新常规一血记录
        if (regularFirstBlood) {
            // 如果之前有记录但新的更早，或者之前没有记录，则更新
            const existingRegular = this.map_fb?.regular?.[problemId];
            if (!existingRegular || regularFirstBlood.in_date < existingRegular.in_date) {
                if (!this.map_fb.regular) {
                    this.map_fb.regular = {};
                }
                this.map_fb.regular[problemId] = {
                    team_id: regularFirstBlood.team_id,
                    in_date: regularFirstBlood.in_date,
                    isStarTeam: false
                };
            }
        }
        
        // 一血状态更新后，需要重新渲染所有相关队伍的题目状态，以便显示一血标记
        // 这里我们会在 UpdateRankRowForJudging 或 IncrementalUpdate 中自动更新
        // 但如果需要立即更新，可以调用 RenderRank()
        // 为了性能考虑，这里不立即渲染，让后续的 UpdateRankRowForJudging 和 IncrementalUpdate 处理
    }
    
    /**
     * 更新单个队伍的排名行
     */
    UpdateRankRowForJudging(teamId) {
        const item = this.rollDataMap.get(teamId);
        if (item && this.container) {
            const row = document.getElementById(`rank-grid-${teamId}`);
            if (row) {
                const index = this.rollDataMap.get(teamId).displayIdx;
                this.UpdateRankRow(item, item.displayRank, index);
            }
        }
    }
    
    /**
     * 判题排序
     * @param {boolean} flg_do_sort - 是否执行排序逻辑，默认 true。如果为 false，则跳过排序（用于非AC情况），但保留其他逻辑（如检查获奖）
     */
    async JudgeSort(flg_do_sort = true) {
        this._dbg('judge', 'JudgeSort() ENTER', { flg_do_sort, team: this.judgingTeamId, idx: this.currentJudgingIndex });
        this.currentRollStep = 'sort';
        
        // 关键：在执行动画前，保存要上升的队伍ID（刚揭晓题目的队伍）
        // 使用 judgingTeamIdLast，因为它是刚刚揭晓题目的队伍ID
        // 这样即使 judgingTeamId 被更新，我们也能正确识别上升的队伍
        this.animatingRisingTeamId = this.judgingTeamIdLast || this.judgingTeamId;
        
        // 记录排序前的位置（无论是否排序都需要记录，用于后续判断位置是否变化）
        let teamIndexBefore = null;
        if (this.judgingTeamId) {
            const displayListBefore = this.rollData;
            const rankedListBefore = this.CalculateRankInfo(displayListBefore);
            const indexBefore = rankedListBefore.findIndex(item => item.team_id === this.judgingTeamId);
            if (indexBefore >= 0) {
                teamIndexBefore = indexBefore;
            }
        }
        
        // 如果不需要排序（flg_do_sort = false），跳过排序动画，直接进入统一判断
        if (!flg_do_sort) {
            this._JudgeSortDoneJudge({ afterSort: false });
            return;
        }

        // 需要排序：使用增量更新和动画（不阻塞，让动画在后台运行，确保键盘响应不被阻塞）
        this.RollSort();

        const judgingRow = this.judgingTeamId ? document.getElementById(`rank-grid-${this.judgingTeamId}`) : null;
        if (judgingRow && judgingRow.classList.contains('roll-judging')) {
            judgingRow.style.zIndex = '99';
        }
        // rollData 已经是按筛选视图过滤后的子集（_InitRollDataInternal 保证），
        // 直接喂给 IncrementalUpdate 即可——不要再做二次过滤。
        const displayListForRender = this.rollData;
        const rankGrid = this.container.querySelector('.rank-grid');
        if (rankGrid && rankGrid.children.length > 0) {
            // 启动动画，但不等待（后台运行），让键盘事件可以立即响应。
            // 关键时序：IncrementalUpdate 在第一个 await 之前的同步段会读取
            // currentRollStep === 'sort'，因此必须在调用之后再修改 currentRollStep。
            this.IncrementalUpdate(displayListForRender).then(() => {
                // 不移除z-index，让上升队伍的z-index自然保留
            });
        } else {
            this.RenderRank(displayListForRender);
        }

        // 揭晓后滚动到当前队伍（动画完成后再滚动）
        if (this.judgingTeamId) {
            this.scrollToTeamAfterAnimation(this.judgingTeamId);
        }

        // 排序动画启动（异步在后台跑）后，**同步**进入"是否弹奖 / 是否定位下一队"
        // 的统一判断。仅当排序后该队在 rollData 中的下标与排序前一致时，才允许此处立刻弹奖；
        // 若因 AC 上升导致下标变化，须走 JudgeConfirm，避免 overlay 与上升动画抢戏（旧版逻辑）。
        this._JudgeSortDoneJudge({ afterSort: true, teamIndexBefore });
    }
    
    // /**
    //  * 子类重写获奖排名，获奖排名要随着滚榜更新变化，数据来源应当是不断揭晓的滚榜数据
    //  */
    // GetAwardRanks(options = {}) {
    //     const {
    //         flg_ac_team_base = false,     // 是否以总数为基数
    //         customBaseCount = null,    // 自定义基数（优先级最高）
    //         starMode = null
    //     } = options;
    //     if (!this.data || !this.data.contest) {
    //         console.error("数据未初始化");
    //         return [0, 0, 0];
    //     }
    //     const awardRatio = this.data.contest.award_ratio;
    //     const ratios = RankToolParseAwardRatio(awardRatio);
    //     const tmp_star_mode = starMode ? starMode : this.starMode;
        
    //     // 先调用 FilterByStarMode 设置 isStar 属性，然后再计算有效队伍数
    //     // FilterByStarMode 会根据 starMode 设置 isStar 属性或过滤掉打星队
    //     const filteredList = this.FilterByStarMode(this.rollData ?? this.rankList, tmp_star_mode);
    //     // 获取有效队伍数（排除打星队和0题队伍）
    //     // 注意：starMode === 1 时，打星队已被 FilterByStarMode 过滤掉，所以这里只需要检查 isStar
    //     // starMode === 0 时，打星队 isStar=true，会被排除
    //     // starMode === 2 时，打星队 isStar=false，会被计入
    //     const validTeamNum = customBaseCount ? customBaseCount : 
    //         (flg_ac_team_base ? 
    //             filteredList.filter(item => !item.isStar) : 
    //             filteredList.filter(item => item.solved > 0 && !item.isStar)
    //         ).length;
            
    //     return RankToolGetAwardRank(validTeamNum, ratios.gold, ratios.silver, ratios.bronze);
    // }
    /**
     * 获取获奖级别
     */
    GetAwardLevel(rank) {
        if (rank === '*' || rank <= 0) return 0;
        if (rank <= this.rankGold) return 3;
        if (rank <= this.rankSilver) return 2;
        if (rank <= this.rankBronze) return 1;
        return 0;
    }
    
    /**
     * 多归属滚榜：当前勾选 ≥2 个归属时，某队在所选归属下的分组奖项（与 overlay 右栏一致）。
     * @param {string} team_id
     * @returns {boolean} 是否在任一所选归属内为金/银/铜（非「未获奖」）
     */
    _TeamHasMedalInAnySelectedGroupRoll(team_id) {
        return this._GetBestAwardClassForTeamRoll(team_id) !== null;
    }

    _GetBestAwardClassForTeamRoll(team_id) {
        const rows = this.GetTeamGroupAwardList(team_id);
        const priority = { gold: 3, silver: 2, bronze: 1 };
        let best = null;
        for (let i = 0; i < rows.length; i++) {
            const c = rows[i] && rows[i].awardClass;
            if (c === 'gold' || c === 'silver' || c === 'bronze') {
                if (!best || priority[c] > priority[best]) {
                    best = c;
                }
            }
        }
        return best;
    }

    /**
     * 判断是否需要显示获奖
     * @param {Object} teamData - 队伍数据
     * @param {Object} rankedItem - 排名项（包含displayRank等）
     * @param {Map} realRankMap - 真实排名映射
     * @returns {boolean} - 是否需要显示获奖
     */
    ShouldShowAward(teamData, rankedItem, realRankMap) {
        // 必须是非打星队
        if (rankedItem.isStar) {
            return false;
        }
        if (this.awardShownTeams.has(teamData.team_id)) {
            return false;
        }

        // 弹奖口径统一走 group-aware 奖项列表：
        // - 多 group：只看所选且队伍所属的 group；
        // - 单 group：全队归入该 group；
        // - 旧数据无 group：用赛事全局 award_ratio 合成虚拟默认 group。
        // 因此这里不再使用“全场金/银/铜线”作为主判定。
        return this._TeamHasMedalInAnySelectedGroupRoll(teamData.team_id);
    }
    
    /**
     * 计算真实排名（基于所有题目都已揭晓）
     * 关键修复：复用 rank.js 的 CalculateRank() 方法，而不是重写排序算法
     */
    CalculateRealRankMap() {
        if (!this.rollData || this.rollData.length === 0 || !this.rollSolutionMap || !this.teamMap) {
            return ;
        }
        
        // ProcessData(true) 会忽略封榜分支，把冻结期内 AC 写入 map_fb，与滚榜格子的
        // pending 语义冲突；终榜排序仍依赖 true，一血表恢复为封榜口径（与首次 ProcessData() 一致）。
        const savedMapFb = JSON.parse(JSON.stringify(this.map_fb || { global: {}, regular: {} }));
        this.ProcessData(true);
        this.map_fb = savedMapFb;
        const displayList = this.FilterByStarMode(this.rankList, this.starMode);
        this.rankList = this.CalculateRankInfo(displayList);
        this.realRankMap = new Map();
        this.rankList.forEach((item, index) => {
            this.realRankMap.set(item.team_id, item);
        });
        // 更新获奖线为真实获奖线
        this.UpdateAwardInfo();
    }
    
    /**
     * 判题获奖
     */
    JudgeAward() {
        this.currentRollStep = 'award';
        
        if (!this.judgingTeamId) {
            this.JudgeConfirm();
            return;
        }
        
        const currentItem = this.rollDataMap.get(this.judgingTeamId);
        
        if (!currentItem) {
            this.JudgeConfirm();
            return;
        }
        
        // 检查该队伍是否已经没有frozen题目
        const solutions = this.rollSolutionMap[this.judgingTeamId];
        const hasFrozenProblems = solutions && solutions.frozen && Object.keys(solutions.frozen).length > 0;
        
        // 检查是否需要显示奖励
        let shouldShowAward = false;
        let awardType = null;
        let newAwardLevel = 0;
        // 使用封装的函数判断是否需要显示获奖
        if (!hasFrozenProblems) {
            // 判断是否需要显示获奖
            shouldShowAward = this.ShouldShowAward({team_id: this.judgingTeamId}, currentItem, this.realRankMap);
            if (shouldShowAward) {
                awardType = this._GetBestAwardClassForTeamRoll(this.judgingTeamId);
                if (awardType === 'gold') {
                    newAwardLevel = 3;
                } else if (awardType === 'silver') {
                    newAwardLevel = 2;
                } else if (awardType === 'bronze') {
                    newAwardLevel = 1;
                }
            } else {
                // 即使不需要显示获奖，也需要计算获奖级别用于状态跟踪
                const skippedAwardType = this._GetBestAwardClassForTeamRoll(this.judgingTeamId);
                if (skippedAwardType === 'gold') {
                    newAwardLevel = 3;
                } else if (skippedAwardType === 'silver') {
                    newAwardLevel = 2;
                } else if (skippedAwardType === 'bronze') {
                    newAwardLevel = 1;
                }
                // // 没奖，直接下一步
                // this.RollNext();
            }
        }
        
        // 检测是否进入新的获奖级别
        const enteredAwardArea = !this.isInAwardArea && newAwardLevel > 0;
        
        // 更新获奖区域状态
        if (newAwardLevel > 0) {
            this.isInAwardArea = true;
        }
        if (newAwardLevel > this.currentAwardLevel) {
            this.currentAwardLevel = newAwardLevel;
        }
        
        // 从无奖进入获奖区域但本步不弹 overlay：仍停自动（留给主持人手动节奏）
        if (this.isAutoRolling && enteredAwardArea && !shouldShowAward) {
            this.isAutoRolling = false;
            this.autoSpeed = this.DEFAULT_ROLL_SPEED;
            this.currentRollStep = null;
            this.ClearJudgingHighlight();
            return;
        }

        // 如果获奖，显示全屏获奖 overlay
        if (shouldShowAward && awardType) {
            // 须先 ShowAward 成功再置 award_open；否则 isOpen() 为假会被误判为「异常跳过」
            if (!this.ShowAward(this.judgingTeamId, awardType)) {
                this.currentRollStep = null;
                this.ClearJudgingHighlight();
                this.JudgeConfirm();
                return;
            }
            this.currentRollStep = 'award_open';
            
            // 标记该队伍已经显示过获奖，避免重复弹出
            this.awardShownTeams.add(this.judgingTeamId);
            
            if (!this.isInAwardArea) {
                this.isInAwardArea = true;
            }
            this.TryAutoRolling('RollNextStep');

        } else {
            // 没获奖，直接继续
            this.currentRollStep = null;
            this.ClearJudgingHighlight();
            
            // 自动模式下延迟后继续
            this.TryAutoRolling('JudgeConfirm');
        }
    }
    
    /**
     * 清除高亮
     */
    ClearJudgingHighlight() {
        if (this.container) {
            this.container.querySelectorAll('.rank-row.roll-judging').forEach(row => {
                row.classList.remove('roll-judging');
                if (row.style.zIndex === '99') {
                    row.style.zIndex = '';
                }
            });
            this.container.querySelectorAll('.problem-item.roll-judging-problem').forEach(item => {
                item.classList.remove('roll-judging-problem');
            });
            // 同时清"刚揭晓题的余韵边框"——结束滚榜/全屏退出/重置等场景下统一收尾
            this.container.querySelectorAll('.problem-item.roll-judged-problem').forEach(item => {
                item.classList.remove('roll-judged-problem');
            });
        }
    }
    /**
     * 获取滚动容器（全屏模式下是container，否则是window）
     */
    getScrollContainer() {
        if (this.container && this.container.classList.contains('fullscreen')) {
            return this.container;
        }
        // 非全屏模式下，尝试找到有滚动条的父容器，否则使用window
        let element = this.container;
        while (element && element !== document.body) {
            const overflow = window.getComputedStyle(element).overflowY;
            if (overflow === 'auto' || overflow === 'scroll') {
                return element;
            }
            element = element.parentElement;
        }
        return window;
    }

    /**
     * 滚动到指定队伍（确保窗口跟随，队伍出现在屏幕下方1/3位置）
     * 使用防抖机制，快速调用时只执行最后一次滚动
     * 如果连续滚动到同一个队伍，且位置变化很小，则跳过滚动以避免抖动
     */
    scrollToTeam(teamId) {
        // 中断 f 键的滚动动画（如果正在运行）
        if (this.scrollAnimationRunning && this.scrollAnimationId !== null) {
            cancelAnimationFrame(this.scrollAnimationId);
            this.scrollAnimationRunning = false;
            this.scrollAnimationId = null;
        }
        
        // 清理 f 键滚动的所有相关定时器（避免延迟触发导致窗口滑动）
        if (this.fastSkipScrollTimeout !== null) {
            clearTimeout(this.fastSkipScrollTimeout);
            this.fastSkipScrollTimeout = null;
        }
        if (this.fastSkipJudgeConfirmTimeout !== null) {
            clearTimeout(this.fastSkipJudgeConfirmTimeout);
            this.fastSkipJudgeConfirmTimeout = null;
        }
        
        // 记录待滚动的队伍ID
        this.pendingScrollTeamId = teamId;
        
        // 取消之前的滚动
        if (this.scrollTimeout) {
            clearTimeout(this.scrollTimeout);
            this.scrollTimeout = null;
        }
        
        // 使用多个 requestAnimationFrame 确保DOM完全更新后再滚动
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    // 再次检查是否还是这个队伍（避免被新的调用覆盖）
                    if (this.pendingScrollTeamId === teamId) {
                        const teamRow = document.getElementById(`rank-grid-${teamId}`);
                        if (teamRow) {
                            // 如果切换到不同队伍，清除上次滚动记录
                            if (this.lastScrollTeamId !== null && this.lastScrollTeamId !== teamId) {
                                this.lastScrollTeamId = null;
                                this.lastScrollY = null;
                            }
                            
                            // 如果是同一个队伍，且上次滚动位置很近，则跳过滚动以避免抖动
                            if (this.lastScrollTeamId === teamId && this.lastScrollY !== null) {
                                const scrollContainer = this.getScrollContainer();
                                let currentScrollY;
                                if (scrollContainer === window) {
                                    currentScrollY = window.scrollY || window.pageYOffset;
                                } else {
                                    currentScrollY = scrollContainer.scrollTop;
                                }
                                
                                // 如果当前位置和上次滚动位置相差小于10像素，且队伍仍然在视口下方1/3附近，则跳过滚动
                                const scrollDiff = Math.abs(currentScrollY - this.lastScrollY);
                                if (scrollDiff < 10) {
                                    const elementRect = teamRow.getBoundingClientRect();
                                    const viewportHeight = scrollContainer === window ? window.innerHeight : scrollContainer.clientHeight;
                                    const targetOffset = scrollContainer === window ? viewportHeight / 3 : viewportHeight / 3 * 2;
                                    const currentOffset = scrollContainer === window ? elementRect.top : (elementRect.top - scrollContainer.getBoundingClientRect().top);
                                    
                                    // 如果当前偏移和目标偏移相差小于20像素，则认为位置稳定，跳过滚动
                                    if (Math.abs(currentOffset - targetOffset) < 20) {
                                        this.pendingScrollTeamId = null;
                                        return;
                                    }
                                }
                            }
                            
                            // 计算目标滚动位置
                            const scrollContainer = this.getScrollContainer();
                            const elementRect = teamRow.getBoundingClientRect();
                            let targetScrollY;
                            
                            if (scrollContainer === window) {
                                const viewportHeight = window.innerHeight;
                                const scrollY = window.scrollY || window.pageYOffset;
                                const elementTop = elementRect.top + scrollY;
                                targetScrollY = elementTop - (viewportHeight / 3);
                            } else {
                                const containerRect = scrollContainer.getBoundingClientRect();
                                const containerScrollTop = scrollContainer.scrollTop;
                                const containerHeight = containerRect.height;
                                const elementTopRelative = elementRect.top - containerRect.top + containerScrollTop;
                                targetScrollY = elementTopRelative - (containerHeight / 3 * 2);
                            }
                            
                            // 记录目标位置（在滚动完成前就记录，用于下次判断）
                            this.lastScrollY = targetScrollY;
                            this.lastScrollTeamId = teamId;
                            
                            // 执行滚动
                            this.scrollToElementBottomThird(teamRow);
                        }
                        this.pendingScrollTeamId = null;
                    }
                });
            });
        });
    }
    
    /**
     * 滚动元素到屏幕上方 1/3 位置（视口顶部下方 1/3 处）。
     *
     * 关键设计：**滚榜过程中视口"单向向上"滚动**。
     * 滚榜整体方向是从最差名次（DOM 底部）推进到第一名（DOM 顶部），
     * 视口本身就是从底部慢慢向上移动（scrollY 单调减小）。
     * 因此当某次锁定下一队的目标位置在当前视口内（或下方），
     * 我们故意**不滚动**——避免出现"上一队上升 + DOM 补位后，按 N 锁定
     * 下一队时视口反向往下跳一下"的撕扯感。
     * 只有当目标位置在视口上方（targetScrollY < currentScrollY）时，
     * 才平滑向上滚动，让步进始终是稳的。
     *
     * 容差 5px 用于忽略亚像素抖动。
     */
    scrollToElementBottomThird(element, scrollSpeed = null) {
        const scrollContainer = this.getScrollContainer();
        const elementRect = element.getBoundingClientRect();
        const ONE_WAY_TOLERANCE = 5;
        // "一次性绕过单向限制"票据：U/I/F/G 等跳转操作设置后，本次滚动允许任意方向。
        // 消费即重置——避免后续正常按 N 也乱跳。
        let oneWayBypass = !!this._allowOneWayBypass;
        if (oneWayBypass) this._allowOneWayBypass = false;

        // 激活行整段落在可视区之下：单向「只减小 scroll」会永久无法把该队滚入画（错位/撤回后常见）
        const BELOW_VIEWPORT_MARGIN = 10;
        if (!oneWayBypass) {
            if (scrollContainer === window) {
                if (elementRect.top > window.innerHeight - BELOW_VIEWPORT_MARGIN) {
                    oneWayBypass = true;
                }
            } else {
                const crect = scrollContainer.getBoundingClientRect();
                if (elementRect.top > crect.bottom - BELOW_VIEWPORT_MARGIN) {
                    oneWayBypass = true;
                }
            }
        }

        if (scrollContainer === window) {
            // 窗口滚动
            const viewportHeight = window.innerHeight;
            const scrollY = window.scrollY || window.pageYOffset;
            const elementTop = elementRect.top + scrollY;
            // 目标：元素顶部距离视口顶部 = 视口高度的 1/3
            const targetScrollY = elementTop - (viewportHeight / 3);
            const currentScrollY = scrollY;

            // 单向向上：目标在当前视口内/下方 → 不滚（除非本次允许 bypass）
            if (!oneWayBypass && targetScrollY >= currentScrollY - ONE_WAY_TOLERANCE) {
                return;
            }

            const scrollDistance = Math.abs(targetScrollY - currentScrollY);
            
            // 如果提供了滚动速度，使用自定义滚动速度实现平滑滚动
            if (scrollSpeed && scrollSpeed > 0) {
                const scrollDuration = (scrollDistance / scrollSpeed) * 1000; // 转为毫秒
                const minScrollDuration = 500; // 最小滚动时长
                const maxScrollDuration = 30000; // 最大滚动时长（增加到30秒，让慢速滚动完全生效）
                const finalScrollDuration = Math.max(minScrollDuration, Math.min(maxScrollDuration, scrollDuration));
                
                // 使用requestAnimationFrame实现平滑滚动
                const startScrollY = currentScrollY;
                const startTime = performance.now();
                
                const animateScroll = (currentTime) => {
                    const elapsed = currentTime - startTime;
                    const progress = Math.min(elapsed / finalScrollDuration, 1);
                    
                    // 使用线性插值，实现匀速滚动（不使用缓动函数）
                    const currentScrollY = startScrollY + (targetScrollY - startScrollY) * progress;
                    window.scrollTo(0, Math.max(0, currentScrollY));
                    
                    if (progress < 1) {
                        requestAnimationFrame(animateScroll);
                    }
                };
                
                requestAnimationFrame(animateScroll);
            } else {
                // 使用浏览器原生平滑滚动
                window.scrollTo({
                    top: Math.max(0, targetScrollY),
                    behavior: 'smooth'
                });
            }
        } else {
            // 容器滚动
            const containerRect = scrollContainer.getBoundingClientRect();
            const containerScrollTop = scrollContainer.scrollTop;
            const containerHeight = containerRect.height;
            
            // 元素相对于容器的位置
            const elementTopRelative = elementRect.top - containerRect.top + containerScrollTop;
            // 目标：元素顶部距离容器顶部 = 容器高度的 1/3
            const targetScrollTop = elementTopRelative - (containerHeight / 3 * 2);
            const currentScrollTop = containerScrollTop;

            // 单向向上：目标在当前视口内/下方 → 不滚（除非本次允许 bypass）
            if (!oneWayBypass && targetScrollTop >= currentScrollTop - ONE_WAY_TOLERANCE) {
                return;
            }

            const scrollDistance = Math.abs(targetScrollTop - currentScrollTop);
            
            // 如果提供了滚动速度，使用自定义滚动速度实现平滑滚动
            if (scrollSpeed && scrollSpeed > 0) {
                const scrollDuration = (scrollDistance / scrollSpeed) * 1000; // 转为毫秒
                const minScrollDuration = 500; // 最小滚动时长
                const maxScrollDuration = 30000; // 最大滚动时长（增加到30秒，让慢速滚动完全生效）
                const finalScrollDuration = Math.max(minScrollDuration, Math.min(maxScrollDuration, scrollDuration));
                
                // 使用requestAnimationFrame实现平滑滚动
                const startScrollTop = currentScrollTop;
                const startTime = performance.now();
                
                const animateScroll = (currentTime) => {
                    const elapsed = currentTime - startTime;
                    const progress = Math.min(elapsed / finalScrollDuration, 1);
                    
                    // 使用线性插值，实现匀速滚动（不使用缓动函数）
                    const currentScrollTop = startScrollTop + (targetScrollTop - startScrollTop) * progress;
                    scrollContainer.scrollTop = Math.max(0, currentScrollTop);
                    
                    if (progress < 1) {
                        requestAnimationFrame(animateScroll);
                    }
                };
                
                requestAnimationFrame(animateScroll);
            } else {
                // 使用浏览器原生平滑滚动
                scrollContainer.scrollTo({
                    top: Math.max(0, targetScrollTop),
                    behavior: 'smooth'
                });
            }
        }
    }
    
    /**
     * 在动画完成后滚动到当前激活的队伍（确保位置变化后窗口跟随，队伍出现在屏幕下方1/3位置）
     */
    scrollToTeamAfterAnimation(teamId) {
        if (!teamId) return;
        
        // 延迟一点，确保动画完成
        if (this.scrollTimeout) {
            clearTimeout(this.scrollTimeout);
        }
        
        this.scrollTimeout = setTimeout(() => {
            const teamRow = document.getElementById(`rank-grid-${teamId}`);
            if (teamRow && teamRow.classList.contains('roll-judging')) {
                // 使用 requestAnimationFrame 确保在DOM更新后滚动
                requestAnimationFrame(() => {
                    this.scrollToElementBottomThird(teamRow);
                });
            }
            this.scrollTimeout = null;
        }, 150); // 稍微延迟，确保动画完成
    }
    /**
     * PQ 快跳后自检（不修改状态）：滚榜方向为「名次差的一侧先处理」，
     * currentJudgingIndex = i 时，rollData[i+1..]（更差名次 / 列表更靠下）应对应已整队揭晓完毕（无 frozen）。
     * 若违反，说明 remainingTeams 与模拟预算脱节或数据异常——仅告警便于现场/回放排查，不作静默纠正。
     * @param {number} afterIdx - currentJudgingIndex
     */
    _getSuffixFrozenMismatchRows(afterIdx) {
        const n = this.rollData ? this.rollData.length : 0;
        if (afterIdx < 0 || afterIdx >= n - 1 || !this.rollSolutionMap) {
            return [];
        }
        const bad = [];
        for (let j = afterIdx + 1; j < n; j++) {
            const tid = this.rollData[j].team_id;
            const sol = this.rollSolutionMap[tid];
            if (!sol || !sol.frozen) continue;
            const keys = Object.keys(sol.frozen).filter(pid => sol.frozen[pid]);
            if (keys.length > 0) {
                bad.push({ row: j, team_id: tid, pendingFrozen: keys.length });
            }
        }
        return bad;
    }

    _warnJumpSuffixFrozenMismatch(afterIdx) {
        const bad = this._getSuffixFrozenMismatchRows(afterIdx);
        if (bad.length > 0) {
            this._dbg('undo', 'JumpToSpecificStage: 更差名次侧仍有 frozen（与 i 语义不一致）',
                { afterIdx, bad });
            console.warn('JumpToSpecificStage: suffix rows still have frozen', bad);
        }
    }

    /**
     * G 等非重置快跳：跳前要求 currentJudgingIndex 更差侧已无 frozen，否则 PQ 步数预算会被
     * 「已完成队」白占，判停后行位/选队易错位。违反则 fail-fast，禁止带脏状态进 PQ。
     * @param {number} afterIdx - 当前 currentJudgingIndex
     * @param {string} hintKey - ShowKeyHint 快捷键标签（如 'G'）
     * @returns {boolean}
     */
    _requireJumpSuffixFrozenClean(afterIdx, hintKey) {
        const bad = this._getSuffixFrozenMismatchRows(afterIdx);
        if (bad.length === 0) {
            return true;
        }
        this._dbg('undo', '_requireJumpSuffixFrozenClean: suffix 仍有 frozen，拒绝快跳',
            { afterIdx, bad, hintKey });
        console.error('Jump suffix frozen mismatch (pre-PQ gate)', { afterIdx, bad, hintKey });
        this.ShowKeyHint('当前光标下方仍有未揭晓题，无法安全跳转', hintKey || '');
        return false;
    }

    /**
     * 排序后同步 currentJudgingIndex：G/U/I 等位置跳转固定落在 remainingTeams - 1 行。
     * @param {number} validRemainingTeams - 钳制后的 remainingTeams
     */
    _syncJudgingIndexToTeamRowAfterSort(validRemainingTeams) {
        const n = this.rollData ? this.rollData.length : 0;
        const rem = Math.max(0, Math.min(Number(validRemainingTeams) || 0, n));
        this.currentJudgingIndex = rem > 0 ? rem - 1 : -1;
        if (this.currentJudgingIndex >= n && n > 0) {
            this.currentJudgingIndex = n - 1;
        }
    }

    _NormalizeJumpOptions(options = {}) {
        const rawLevel = options.targetAwardLevel;
        const targetAwardLevel = Number.isFinite(Number(rawLevel)) ? Math.floor(Number(rawLevel)) : 0;
        const rawGid = options.targetGroupId;
        const targetGroupId = (rawGid != null && String(rawGid).trim() !== '') ? String(rawGid).trim() : '';
        return {
            settleTargetRow: !!options.settleTargetRow,
            targetAwardLevel: (targetAwardLevel >= 1 && targetAwardLevel <= 3) ? targetAwardLevel : 0,
            targetGroupId
        };
    }

    /**
     * PQ 奖区快跳：初始化 O(1) 判停 tracker（终态参与排名总数 + 队列内计数，禁止逐步 filter/sort）。
     */
    _createPqAwardJumpTracker(rollDataBackup, jumpOptions) {
        if (typeof RankToolPqAwardJumpTracker !== 'function') {
            throw new Error('_createPqAwardJumpTracker: RankToolPqAwardJumpTracker 未加载');
        }
        const targetGroupId = jumpOptions.targetGroupId || '';
        const targetScopeKey = targetGroupId || RankToolPqAwardJumpGlobalScope;
        const rowMetaByTeamId = new Map();
        const totalRankEligibleByScope = new Map();
        const cutoffsByScope = new Map();

        totalRankEligibleByScope.set(RankToolPqAwardJumpGlobalScope, 0);
        cutoffsByScope.set(RankToolPqAwardJumpGlobalScope, {
            rankGold: this.rankGold,
            rankSilver: this.rankSilver,
            rankBronze: this.rankBronze
        });

        const selectedGroupSet = new Set(
            (this._GetSelectedAwardJumpGroups() || []).map((g) => String(g.group_id))
        );
        (this.GetContestGroups() || []).forEach((g) => {
            const gid = String(g.group_id || '');
            if (!gid) return;
            if (selectedGroupSet.size > 0 && !selectedGroupSet.has(gid)) return;
            totalRankEligibleByScope.set(gid, 0);
            cutoffsByScope.set(gid, { rankGold: 0, rankSilver: 0, rankBronze: 0 });
        });

        const starMode = typeof this.starMode === 'number' ? this.starMode : parseInt(this.starMode || 0, 10) || 0;
        const flgAcTeamBase = typeof RankToolRankMedalGetAcTeamBaseFromUi === 'function'
            ? RankToolRankMedalGetAcTeamBaseFromUi()
            : true;

        if (targetGroupId && typeof RankToolBuildGroupRankListForMedals === 'function') {
            const finalView = rollDataBackup.map((item) => ({ ...item }));
            finalView.sort((a, b) => this.CompareTeamsForRanking(a, b));
            this.CalculateRankInfo(finalView);
            const groupRow = (this.GetContestGroups() || []).find((g) => String(g.group_id) === targetGroupId);
            if (groupRow) {
                const ranked = RankToolBuildGroupRankListForMedals(this, targetGroupId, starMode, finalView);
                const validTeamNum = typeof RankToolGetGroupMedalValidTeamNum === 'function'
                    ? RankToolGetGroupMedalValidTeamNum(ranked, flgAcTeamBase)
                    : ranked.filter((item) => item && item.solved > 0 && !item.isStar).length;
                cutoffsByScope.set(targetGroupId, RankToolGetAwardRank(
                    validTeamNum,
                    parseInt(groupRow.award_ratio_gold ?? 10, 10) || 0,
                    parseInt(groupRow.award_ratio_silver ?? 15, 10) || 0,
                    parseInt(groupRow.award_ratio_bronze ?? 20, 10) || 0,
                    parseInt(groupRow.flg_award_qty_mode, 10) === 1 ? 1 : 0
                ));
            }
        }

        rollDataBackup.forEach((row) => {
            const team = row.team || {};
            const tkind = team.tkind != null ? team.tkind : 0;
            const rankEligible = !row.isStar;
            const rawGids = Array.isArray(team.group_ids) ? team.group_ids.map(String) : [];
            const groupKeys = rawGids.filter((gid) => totalRankEligibleByScope.has(gid));
            rowMetaByTeamId.set(row.team_id, { groupKeys, tkind, rankEligible });

            if (rankEligible) {
                totalRankEligibleByScope.set(
                    RankToolPqAwardJumpGlobalScope,
                    totalRankEligibleByScope.get(RankToolPqAwardJumpGlobalScope) + 1
                );
                groupKeys.forEach((gid) => {
                    totalRankEligibleByScope.set(gid, totalRankEligibleByScope.get(gid) + 1);
                });
            }
        });

        return new RankToolPqAwardJumpTracker({
            rowMetaByTeamId,
            totalRankEligibleByScope,
            cutoffsByScope,
            targetScopeKey,
            targetAwardLevel: jumpOptions.targetAwardLevel
        });
    }

    _syncJudgingIndexToPqSettledBoundary(settledBoundaryTeamId) {
        if (!settledBoundaryTeamId || !this.rollData || this.rollData.length === 0) {
            return false;
        }
        const idx = this.rollData.findIndex((row) => row.team_id === settledBoundaryTeamId);
        if (idx < 0) {
            console.error('JumpToSpecificStage: PQ 判停边界队不在 rollData', settledBoundaryTeamId);
            return false;
        }
        this.currentJudgingIndex = idx;
        return true;
    }

    _CalculateJumpCompletedTeams(totalTeams, remainingTeams, options = {}) {
        const n = Math.max(0, Math.floor(Number(totalTeams)) || 0);
        const remNum = Number(remainingTeams);
        if (!Number.isFinite(remNum)) {
            return null;
        }
        const rem = Math.max(0, Math.min(Math.floor(remNum), n));
        const jumpOptions = this._NormalizeJumpOptions(options);
        const completed = Math.max(0, n - rem + (jumpOptions.settleTargetRow ? 1 : 0));
        return {
            remTeams: rem,
            completedTeams: completed,
            settleTargetRow: jumpOptions.settleTargetRow
        };
    }

    /**
     * 跳到滚榜特定阶段：到达剩余 x 个队伍未揭晓时停住
     * @param {number} remainingTeams - **当前 rollData 视图内**「仍处未整队揭晓前缀」的队伍个数（1..n），
     *   与 G/U/I 的 targetIndex+1 同语义；必须与 {@link _InitRollDataInternal} 的 rollData 尺度一致，
     *   **禁止**使用全量 rankList 的 displayIdx 代替（含打星/未选 group 时尺度不同）。
     * @param {function(number, number): void} progressCallback - 进度回调 (current, total)
     * @param {{ settleTargetRow?: boolean, targetAwardLevel?: number, targetGroupId?: string }} options
     *   settleTargetRow=true：目标行本身也必须整队落定（奖区边界跳转）；
     *   targetAwardLevel=1|2|3 + targetGroupId?：F 跳 PQ tracker 判停 scope。
     * @returns {Promise<Array<string>>}
     */
    async JumpToSpecificStage(remainingTeams, progressCallback = null, options = {}) {
        if (!this.rollData || this.rollData.length === 0 || !this.rollSolutionMap) {
            console.warn('JumpToSpecificStage: 数据未初始化');
            return;
        }
        
        // 清空状态跟踪变量，确保模拟过程不会遗留状态
        // 注意：这些变量在 ResetRollDataToInitial 中也会被清空，但在这里再次清空确保更彻底
        this.awardShownTeams.clear();
        this.isInAwardArea = false;
        
        // rollData 已是 FilterByStarMode(starMode+group) 后的唯一真相源（见 _InitRollDataInternal），
        // 与旧版「再 Filter 一次算 totalTeams」不同；totalTeams 必须与 rollDataBackup.length 一致。
        const displayList = this.rollData;
        const totalTeams = displayList.length;
        
        const remNum = Number(remainingTeams);
        if (!Number.isFinite(remNum)) {
            console.warn('JumpToSpecificStage: remainingTeams 非法', remainingTeams);
            return;
        }
        let remTeams = Math.floor(remNum);
        const remRequested = remTeams;
        remTeams = Math.max(0, Math.min(remTeams, totalTeams));
        if (remRequested !== remTeams) {
            this._dbg('undo', 'JumpToSpecificStage: remainingTeams 钳制到 [0, rollData.length]',
                { requested: remainingTeams, remTeams, totalTeams });
        }

        const jumpOptions = this._NormalizeJumpOptions(options);
        const targetAwardLevel = jumpOptions.targetAwardLevel;
        const stopOnAwardLevel = !!(targetAwardLevel >= 1 && jumpOptions.settleTargetRow);

        const jumpBudget = this._CalculateJumpCompletedTeams(totalTeams, remTeams, jumpOptions);
        if (!jumpBudget && !stopOnAwardLevel) {
            console.warn('JumpToSpecificStage: remainingTeams 非法', remainingTeams);
            return;
        }
        const targetCompletedInitial = jumpBudget ? jumpBudget.completedTeams : totalTeams;
        if (!stopOnAwardLevel && (targetCompletedInitial > totalTeams || (!jumpBudget.settleTargetRow && targetCompletedInitial >= totalTeams))) {
            return;
        }
        
        // 备份原始数据
        const rollDataBackup = JSON.parse(JSON.stringify(this.rollData));
        // 按 rollData 逐队备份提交，与 _InitRollDataInternal 一致；无 rollSolutionMap 项时
        // 用空壳占位（外榜/离线等可能仅有 rank 行而无 solutionMap 源），PQ 侧视为已无可揭晓题，
        // 与 FindNextJudging 对「无 solutions」槽位 i-- 跳过语义一致。
        // 禁止要求 keys.length === rollData.length：初始化本就不为「无 src」队建 rollSolutionMap 项。
        const solutionMapBackup = {};
        let missingSolutionRows = 0;
        for (const row of rollDataBackup) {
            const key = row.team_id;
            const value = this.rollSolutionMap[key];
            if (!value) {
                missingSolutionRows++;
                solutionMapBackup[key] = {
                    problems: {},
                    ac: {},
                    frozen: {}
                };
            } else {
                solutionMapBackup[key] = {
                    problems: value.problems,
                    ac: { ...value.ac },
                    frozen: { ...value.frozen }
                };
            }
        }
        if (missingSolutionRows > 0) {
            this._dbg('undo', 'JumpToSpecificStage: 部分 rollData 行无 rollSolutionMap，已用空 frozen 占位',
                { missingSolutionRows, rollLen: rollDataBackup.length });
        }
        
        let finalTeamsResult = null;
        let simulatedSolutionMapResult = null;
        let processedTeamIdsResult = null;
        const targetCT = stopOnAwardLevel ? totalTeams : targetCompletedInitial;
        if (!stopOnAwardLevel && targetCT > totalTeams) {
            console.warn('JumpToSpecificStage: PQ 目标步数异常', { remTeams, totalTeams });
            return;
        }

        let awardJumpTracker = null;
        if (stopOnAwardLevel) {
            awardJumpTracker = this._createPqAwardJumpTracker(rollDataBackup, jumpOptions);
        }

        // 创建深拷贝用于模拟
        const simulatedRollData = rollDataBackup.map(teamData => {
            const newTeam = {
                ...teamData,
                problemStats: {}
            };
            for (const problemId in teamData.problemStats) {
                newTeam.problemStats[problemId] = { ...teamData.problemStats[problemId] };
            }
            return newTeam;
        });

        const simulatedSolutionMap = {};
        for (const [key, value] of Object.entries(solutionMapBackup)) {
            simulatedSolutionMap[key] = {
                problems: value.problems,
                ac: { ...value.ac },
                frozen: { ...value.frozen }
            };
        }

        const compareFn = (a, b) => this.CompareTeamsForRanking(a, b);

        const pq = new window.RankToolPriorityQueue(compareFn);

        simulatedRollData.forEach(teamData => {
            pq.push({
                team_id: teamData.team_id,
                solved: teamData.solved,
                penalty: teamData.penalty,
                problemStats: { ...teamData.problemStats }
            });
        });

        const completedTeams = [];
        const processedTeamIds = new Set();
        let completedCount = 0;
        let awardBoundarySettled = false;
        let settledBoundaryTeamId = null;

        const finishSimulatedTeam = (teamItem) => {
            completedTeams.push(teamItem);
            completedCount++;
            if (progressCallback) {
                progressCallback(completedCount, targetCT);
            }
            if (stopOnAwardLevel && awardJumpTracker) {
                const verdict = awardJumpTracker.onTeamSettled(teamItem.team_id);
                if (verdict.stop) {
                    awardBoundarySettled = true;
                    settledBoundaryTeamId = teamItem.team_id;
                }
            }
        };

        while (!pq.empty()) {
            if (stopOnAwardLevel) {
                if (awardBoundarySettled) {
                    break;
                }
            } else if (completedCount >= targetCT) {
                break;
            }
            const teamItem = pq.pop();
            if (awardJumpTracker) {
                awardJumpTracker.onLeaveQueue(teamItem.team_id);
            }

            processedTeamIds.add(teamItem.team_id);

            const solutions = simulatedSolutionMap[teamItem.team_id];
            if (!solutions || !solutions.frozen) {
                finishSimulatedTeam(teamItem);
                continue;
            }

            const frozenProblems = Object.keys(solutions.frozen)
                .filter(problemId => solutions.frozen[problemId])
                .map(problemId => {
                    const problem = this.problemMap[problemId];
                    return {
                        problemId: problemId,
                        num: problem ? (problem.num !== undefined ? problem.num : 9999) : 9999
                    };
                })
                .sort((a, b) => a.num - b.num);

            if (frozenProblems.length === 0) {
                finishSimulatedTeam(teamItem);
                continue;
            }

            const problemToReveal = frozenProblems[0];
            const problemId = problemToReveal.problemId;
            const problemSolutions = solutions.problems[problemId] || [];

            let isAC = false;
            let submitCount = 0;
            let acTime = '';
            let firstAcIndex = -1;

            for (let i = 0; i < problemSolutions.length; i++) {
                if (problemSolutions[i].result === 4) {
                    isAC = true;
                    acTime = problemSolutions[i].in_date;
                    firstAcIndex = i;
                    break;
                }
            }

            if (isAC && firstAcIndex >= 0) {
                submitCount = firstAcIndex + 1;
            } else {
                submitCount = problemSolutions.length;
            }

            if (isAC) {
                teamItem.solved += 1;
                const startTime = this._rankWireInstantMs(this.data.contest.start_time);
                const acTimeMs = this._rankWireInstantMs(acTime);
                const deltaSeconds = Math.floor((acTimeMs - startTime) / 1000);
                const penaltyChange = deltaSeconds + (submitCount - 1) * 20 * 60;
                teamItem.penalty += penaltyChange;
                if (!teamItem.problemStats[problemId]) {
                    teamItem.problemStats[problemId] = {};
                }
                teamItem.problemStats[problemId].status = 'ac';
                teamItem.problemStats[problemId].submitCount = submitCount;
                teamItem.problemStats[problemId].lastSubmitTime = this.formatDuration(deltaSeconds * 1000);
            } else {
                if (!teamItem.problemStats[problemId]) {
                    teamItem.problemStats[problemId] = {};
                }
                teamItem.problemStats[problemId].status = 'wa';
                teamItem.problemStats[problemId].submitCount = submitCount;
                if (submitCount > 0) {
                    const lastTime = this._rankWireInstantMs(problemSolutions[submitCount - 1].in_date);
                    const startTime = this._rankWireInstantMs(this.data.contest.start_time);
                    const deltaSeconds = Math.floor((lastTime - startTime) / 1000);
                    teamItem.problemStats[problemId].lastSubmitTime = this.formatDuration(deltaSeconds * 1000);
                }
            }

            delete solutions.frozen[problemId];

            pq.push(teamItem);
            if (awardJumpTracker) {
                awardJumpTracker.onEnterQueue(teamItem.team_id);
            }

            if (completedCount % 100 === 0) {
                await new Promise(resolve => setTimeout(resolve, 0));
            }
        }

        const finalTeams = [];

        while (!pq.empty()) {
            finalTeams.push(pq.pop());
        }

        finalTeams.push(...completedTeams);

        if (finalTeams.length !== rollDataBackup.length) {
            console.error(`JumpToSpecificStage: 队伍数量不匹配！原始: ${rollDataBackup.length}, 最终: ${finalTeams.length}`);
            return Array.from(processedTeamIds);
        }

        finalTeams.sort((a, b) => this.CompareTeamsForRanking(a, b));

        finalTeamsResult = finalTeams;
        simulatedSolutionMapResult = simulatedSolutionMap;
        processedTeamIdsResult = processedTeamIds;

        if (!finalTeamsResult || !simulatedSolutionMapResult) {
            console.warn('JumpToSpecificStage: 模拟未产出结果');
            return;
        }

        // 更新 rollData 和 rollDataMap
        const teamIdMap = new Map();
        rollDataBackup.forEach(team => {
            teamIdMap.set(team.team_id, team);
        });
        
        // 关键修复：确保每个队伍都能找到对应的原始数据，并验证数量
        const updatedRollData = [];
        const processedTeamIdSet = new Set(); // 用于检测重复的 team_id
        
        for (const teamItem of finalTeamsResult) {
            // 关键修复：检测重复的 team_id，避免同一个队伍被添加多次
            if (processedTeamIdSet.has(teamItem.team_id)) {
                console.error(`JumpToSpecificStage: 发现重复的队伍ID: ${teamItem.team_id}`);
                continue; // 跳过重复的队伍
            }
            processedTeamIdSet.add(teamItem.team_id);
            
            const originalTeam = teamIdMap.get(teamItem.team_id);
            if (!originalTeam) {
                console.error(`JumpToSpecificStage: 找不到队伍 ${teamItem.team_id} 的原始数据`);
                // 关键修复：如果找不到原始数据，跳过这个队伍，避免产生 null 或 undefined
                continue;
            }
            
            updatedRollData.push({
                ...originalTeam,
                solved: teamItem.solved,
                penalty: teamItem.penalty,
                rank: updatedRollData.length + 1, // 使用当前数组长度 + 1 作为排名
                problemStats: teamItem.problemStats
            });
        }
        
        // 关键修复：验证更新后的数据数量必须等于原始数量
        if (updatedRollData.length !== rollDataBackup.length) {
            console.error(`JumpToSpecificStage: 更新后队伍数量不匹配！原始: ${rollDataBackup.length}, 更新后: ${updatedRollData.length}`);
            // 不更新 rollData，保持原样，并返回已处理的队伍ID
            return Array.from(processedTeamIdsResult);
        }
        
        this.rollData = updatedRollData;
        
        // 更新 rollDataMap
        this.rollDataMap = new Map();
        this.rollData.forEach(item => {
            this.rollDataMap.set(item.team_id, item);
        });
        
        // 更新 rollSolutionMap 的 frozen 状态
        for (const [teamId, solutions] of Object.entries(simulatedSolutionMapResult)) {
            if (this.rollSolutionMap[teamId]) {
                this.rollSolutionMap[teamId].frozen = { ...solutions.frozen };
            }
        }
        
        // 调用方若在此后接 RollSort：F 跳仅记录 PQ 边界 team_id（落点在 FastSkip RollSort 后）；G/U/I 按行位。
        const validRemainingTeams = Math.max(0, Math.min(remTeams, this.rollData.length));
        if (stopOnAwardLevel) {
            if (settledBoundaryTeamId) {
                this._awardJumpSettledBoundaryTeamId = settledBoundaryTeamId;
            } else {
                console.error('JumpToSpecificStage: 奖区 PQ 判停未命中边界', jumpOptions);
            }
        } else if (validRemainingTeams > 0) {
            this.currentJudgingIndex = validRemainingTeams - 1;
        } else {
            this.currentJudgingIndex = -1;
        }
        if (this.currentJudgingIndex >= this.rollData.length && this.rollData.length > 0) {
            this.currentJudgingIndex = this.rollData.length - 1;
        }
        this.judgingTeamId = null;
        this.judgingProblemId = null;
        this.judgingTeamIdLast = null;
        this.animatingRisingTeamId = null;
        
        // 再次确保状态变量被清空（模拟过程不应该修改这些状态，但为了保险起见再次清空）
        this.awardShownTeams.clear();
        this.isInAwardArea = false;
        this.currentAwardLevel = 0;
        this.startAwardLevel = 0;
        this.currentRollStep = null;

        this._warnJumpSuffixFrozenMismatch(this.currentJudgingIndex);

        // 调用方（FastSkipToAwardArea / FinalizeJumpToStage）负责 RenderRank，此处不渲染。
        
        // 返回被处理的队伍ID列表（所有出队的都算），用于应用特效
        return Array.from(processedTeamIdsResult);
    }
    
    /**
     * 获取当前位置所属的奖区级别
     * @returns {number} 0=无奖区, 1=铜奖, 2=银奖, 3=金奖
     */
    GetCurrentAwardLevel() {
        const displayList = this.rollData;
        const rankedList = this.CalculateRankInfo(displayList);
        
        // 获取当前队伍的排名
        let checkingTeamId = this.judgingTeamId;
        if (!checkingTeamId && this.currentJudgingIndex >= 0 && this.currentJudgingIndex < displayList.length) {
            checkingTeamId = displayList[this.currentJudgingIndex].team_id;
        }
        
        if (!checkingTeamId) {
            return 0;
        }
        
        const currentItem = rankedList.find(item => item.team_id === checkingTeamId);
        if (!currentItem || currentItem.isStar || currentItem.displayRank === '*') {
            return 0;
        }
        
        const rank = parseInt(currentItem.displayRank);
        if (isNaN(rank) || rank <= 0) {
            return 0;
        }
        
        if (rank <= this.rankGold) {
            return 3; // 金奖
        } else if (rank <= this.rankSilver) {
            return 2; // 银奖
        } else if (rank <= this.rankBronze) {
            return 1; // 铜奖
        }
        
        return 0; // 无奖区
    }
    
    /**
     * 找到指定奖区的最后一个队伍
     * @param {number} targetAwardLevel - 目标奖区级别: 1=铜奖, 2=银奖, 3=金奖
     * @param {Array} rankedList - 排名列表
     * @returns {Object|null} 最后一个队伍，如果没有则返回null
     */
    /**
     * 在当前传入的「已排名列表」中，从榜单底部往上找目标奖区的**最后一名**
     *（该奖区内名次数字最大者，即铜/银/金带最靠下的边界队）。
     *
     * **必须**传入与滚榜 UI 同一套数据上的名次（通常 `CalculateRankInfo(this.rollData.slice())`）：
     * 禁止传 `this.rankList` 作滚榜中途的奖区边界——`rankList` 在 `CalculateRealRankMap` 之后
     * 不随揭晓重排更新，且与 `GetCurrentAwardLevel` 所用的 `CalculateRankInfo(rollData)` 脱节
     * （含 group / star 筛选后视图）。
     *
     * 奖区阈值与 {@link GetCurrentAwardLevel} 一致：{@link this.rankGold} / rankSilver / rankBronze
     *（来自 `UpdateAwardInfo`，与当前筛选视图有效队数一致）。
     */
    FindLastTeamInAwardLevel(targetAwardLevel, rankedList) {
        if (targetAwardLevel < 1 || targetAwardLevel > 3) {
            return null;
        }
        const rg = this.rankGold;
        const rs = this.rankSilver;
        const rb = this.rankBronze;
        // 从后往前找：列表须为名次好→差（与 rollData / CalculateRankInfo 一致）
        for (let i = rankedList.length - 1; i >= 0; i--) {
            const item = rankedList[i];
            if (item.displayRank !== '*' && !item.isStar) {
                const rank = parseInt(item.displayRank);
                if (!isNaN(rank) && rank > 0) {
                    let itemLevel = 0;
                    if (rank <= rg) {
                        itemLevel = 3;
                    } else if (rank <= rs) {
                        itemLevel = 2;
                    } else if (rank <= rb) {
                        itemLevel = 1;
                    }
                    if (itemLevel === targetAwardLevel) {
                        return item;
                    }
                    if (itemLevel > targetAwardLevel) {
                        return null;
                    }
                }
            }
        }
        
        return null;
    }

    _GetSelectedAwardJumpGroups() {
        if (
            !this.IsMultiGroupEnabled() ||
            !Array.isArray(this.selectedGroupIds) ||
            this.selectedGroupIds.length <= 1
        ) {
            return [];
        }
        const selected = new Set(this.selectedGroupIds.map(String));
        return this.GetContestGroups().filter((group) => RankToolGroupIdListHas(selected, group.group_id));
    }

    _GetAwardLevelFromGroupCutoffs(rank, cutoffs) {
        const r = parseInt(rank, 10);
        if (!Number.isFinite(r) || r <= 0 || !cutoffs) return 0;
        if (cutoffs.rankGold > 0 && r <= cutoffs.rankGold) return 3;
        if (cutoffs.rankSilver > 0 && r <= cutoffs.rankSilver) return 2;
        if (cutoffs.rankBronze > 0 && r <= cutoffs.rankBronze) return 1;
        return 0;
    }

    _GetAwardNameByLevel(level) {
        if (level === 3) return this.CreateBilingualText('金奖区', 'Gold Award Area');
        if (level === 2) return this.CreateBilingualText('银奖区', 'Silver Award Area');
        if (level === 1) return this.CreateBilingualText('铜奖区', 'Bronze Award Area');
        return this.CreateBilingualText('奖区', 'Award Area');
    }

    _BuildGroupAwardJumpTierPlan() {
        if (!this.rankList || this.rankList.length === 0 || typeof RankToolBuildGroupRankListForMedals !== 'function') {
            return [];
        }
        const groups = this._GetSelectedAwardJumpGroups();
        if (groups.length === 0) {
            return [];
        }

        const finalView = this.rankList.map((item) => ({ ...item }));
        finalView.sort((a, b) => this.CompareTeamsForRanking(a, b));
        this.CalculateRankInfo(finalView);

        const rollIndexByTeam = new Map();
        (this.rollData || []).forEach((row, index) => {
            if (row && row.team_id) {
                rollIndexByTeam.set(row.team_id, index);
            }
        });

        const tiers = [];
        const starMode = typeof this.starMode === 'number' ? this.starMode : parseInt(this.starMode || 0, 10) || 0;
        const flgAcTeamBase = typeof RankToolRankMedalGetAcTeamBaseFromUi === 'function'
            ? RankToolRankMedalGetAcTeamBaseFromUi()
            : true;

        groups.forEach((group) => {
            const gid = String(group.group_id || '');
            if (!gid) return;
            const ranked = RankToolBuildGroupRankListForMedals(this, gid, starMode, finalView);
            if (!ranked || ranked.length === 0) return;

            const validTeamNum = typeof RankToolGetGroupMedalValidTeamNum === 'function'
                ? RankToolGetGroupMedalValidTeamNum(ranked, flgAcTeamBase)
                : ranked.filter((item) => item && item.solved > 0 && !item.isStar).length;
            const cutoffs = RankToolGetAwardRank(
                validTeamNum,
                parseInt(group.award_ratio_gold ?? 10, 10) || 0,
                parseInt(group.award_ratio_silver ?? 15, 10) || 0,
                parseInt(group.award_ratio_bronze ?? 20, 10) || 0,
                parseInt(group.flg_award_qty_mode, 10) === 1 ? 1 : 0
            );

            [1, 2, 3].forEach((level) => {
                const cutoffRank = typeof RankToolAwardCutoffRankForLevel === 'function'
                    ? RankToolAwardCutoffRankForLevel(level, cutoffs)
                    : 0;
                if (cutoffRank <= 0) return;
                for (let i = ranked.length - 1; i >= 0; i--) {
                    const item = ranked[i];
                    if (!item || item.isStar || item.displayRank === '*' || item.solved <= 0) continue;
                    if (this._GetAwardLevelFromGroupCutoffs(item.displayRank, cutoffs) !== level) continue;
                    const sortDepth = rollIndexByTeam.has(item.team_id)
                        ? rollIndexByTeam.get(item.team_id)
                        : -1;
                    if (sortDepth < 0) break;
                    tiers.push({
                        groupId: gid,
                        groupName: group.group_name || gid,
                        level,
                        sortDepth
                    });
                    break;
                }
            });
        });

        tiers.sort((a, b) => {
            if (a.sortDepth !== b.sortDepth) return b.sortDepth - a.sortDepth;
            if (a.level !== b.level) return a.level - b.level;
            return String(a.groupId).localeCompare(String(b.groupId));
        });
        return tiers;
    }

    _FindNextGroupAwardJumpTarget() {
        const tiers = this._BuildGroupAwardJumpTierPlan();
        if (tiers.length === 0) {
            return null;
        }
        const curIdx = this.currentJudgingIndex;
        for (const tier of tiers) {
            if (tier.sortDepth < curIdx) {
                return tier;
            }
        }
        return null;
    }

    _AwardTierExistsInRollView(targetAwardLevel, targetGroupId, rankedRollView) {
        if (targetAwardLevel < 1 || targetAwardLevel > 3) {
            return false;
        }
        if (targetGroupId) {
            const starMode = typeof this.starMode === 'number' ? this.starMode : parseInt(this.starMode || 0, 10) || 0;
            const ranked = RankToolBuildGroupRankListForMedals(this, targetGroupId, starMode, rankedRollView);
            const groupRow = (this.GetContestGroups() || []).find((g) => String(g.group_id) === String(targetGroupId));
            if (!groupRow || !ranked.length) return false;
            const flgAcTeamBase = typeof RankToolRankMedalGetAcTeamBaseFromUi === 'function'
                ? RankToolRankMedalGetAcTeamBaseFromUi()
                : true;
            const validTeamNum = typeof RankToolGetGroupMedalValidTeamNum === 'function'
                ? RankToolGetGroupMedalValidTeamNum(ranked, flgAcTeamBase)
                : ranked.filter((item) => item && item.solved > 0 && !item.isStar).length;
            const cutoffs = RankToolGetAwardRank(
                validTeamNum,
                parseInt(groupRow.award_ratio_gold ?? 10, 10) || 0,
                parseInt(groupRow.award_ratio_silver ?? 15, 10) || 0,
                parseInt(groupRow.award_ratio_bronze ?? 20, 10) || 0,
                parseInt(groupRow.flg_award_qty_mode, 10) === 1 ? 1 : 0
            );
            const cutoffRank = RankToolAwardCutoffRankForLevel(targetAwardLevel, cutoffs);
            if (cutoffRank <= 0) return false;
            for (let i = ranked.length - 1; i >= 0; i--) {
                const item = ranked[i];
                if (!item || item.isStar || item.displayRank === '*' || item.solved <= 0) continue;
                if (this._GetAwardLevelFromGroupCutoffs(item.displayRank, cutoffs) === targetAwardLevel) {
                    return true;
                }
            }
            return false;
        }
        return !!this.FindLastTeamInAwardLevel(targetAwardLevel, rankedRollView);
    }

    /**
     * 快速跳过到获奖区域（增强版：支持在奖区间跳跃）
     * - 如果当前在无奖区，跳到奖区（有视口上升动画）
     * - 如果当前在铜奖区，跳到银奖区；如果没有银奖区，跳到金奖区
     * - 如果当前在银奖区，跳到金奖区
     * - 奖区间跳跃无额外动画，像 g 操作一样直接跳转
     */
    async FastSkipToAwardArea() {
        // 关键修复：在 f 行为开始时，将 currentRollStep 设为 null
        // 这样当用户按 N 时，会执行一次 JudgeConfirm，就正常了
        if (typeof RollAwardOverlay !== 'undefined' && RollAwardOverlay.isOpen()) {
            this.HideModal('award');
        }
        this.currentRollStep = null;
                
        if (!this.rollData || this.rollData.length === 0) {
            this.ShowKeyHint('无法计算获奖区域', 'F');
            return;
        }

        const hasSelectedGroupAwardJump = this._GetSelectedAwardJumpGroups().length > 0;
        const groupAwardTarget = this._FindNextGroupAwardJumpTarget();
        const useGroupAwardTarget = !!groupAwardTarget;

        if (hasSelectedGroupAwardJump && !useGroupAwardTarget) {
            const groupAwardPlan = this._BuildGroupAwardJumpTierPlan();
            this.ShowKeyHint(groupAwardPlan.length > 0 ? '当前位置已在最高奖区' : '没有找到获奖队伍', 'F');
            return;
        }

        const currentAwardLevel = this.GetCurrentAwardLevel();

        const rankedRollView = this.rollData.slice();
        rankedRollView.sort((a, b) => this.CompareTeamsForRanking(a, b));
        this.CalculateRankInfo(rankedRollView);

        let targetAwardLevel = 0;
        let targetGroupId = '';

        if (useGroupAwardTarget) {
            targetAwardLevel = groupAwardTarget.level;
            targetGroupId = groupAwardTarget.groupId;
            if (!this._AwardTierExistsInRollView(targetAwardLevel, targetGroupId, rankedRollView)) {
                this.ShowKeyHint('无法找到归属奖区边界', 'F');
                return;
            }
        } else {
            if (currentAwardLevel === 0) {
                targetAwardLevel = 1;
            } else if (currentAwardLevel === 1) {
                targetAwardLevel = 2;
            } else if (currentAwardLevel === 2) {
                targetAwardLevel = 3;
            } else if (currentAwardLevel === 3) {
                this.ShowKeyHint('当前位置已在最高奖区', 'F');
                return;
            }

            while (targetAwardLevel <= 3 && !this._AwardTierExistsInRollView(targetAwardLevel, '', rankedRollView)) {
                targetAwardLevel++;
            }
            if (targetAwardLevel > 3 || !this._AwardTierExistsInRollView(targetAwardLevel, '', rankedRollView)) {
                if (currentAwardLevel === 0) {
                    this.ShowKeyHint('没有找到获奖队伍', 'F');
                } else {
                    this.ShowKeyHint('当前位置已在最高奖区', 'F');
                }
                return;
            }
        }

        const totalTeams = this.rollData.length;

        this.ShowFastSkipProgress();
        try {
            const jumpOptions = {
                settleTargetRow: true,
                targetAwardLevel,
                ...(targetGroupId ? { targetGroupId } : {})
            };
            this.UpdateFastSkipProgress(0, totalTeams);

            const revealedTeamIds = await this.JumpToSpecificStage(totalTeams, (current, total) => {
                this.UpdateFastSkipProgress(current, total);
            }, jumpOptions);

            this.HideFastSkipProgress();

            const viewportHeight = window.innerHeight;

            this.RollSort();
            const settledId = this._awardJumpSettledBoundaryTeamId;
            if (!settledId || !this._syncJudgingIndexToPqSettledBoundary(settledId)) {
                console.error('FastSkipToAwardArea: PQ 判停未命中奖区边界队', {
                    targetAwardLevel,
                    targetGroupId,
                    settledId
                });
                this.ShowKeyHint('跳奖区失败：未能定位边界队', 'F');
                return;
            }
            this._awardJumpSettledBoundaryTeamId = null;
            this._warnJumpSuffixFrozenMismatch(this.currentJudgingIndex);
            
            // 3. 更新DOM显示（但不执行IncrementalUpdate动画，避免与f键动画冲突）
            // 使用RenderRank直接渲染，确保DOM顺序正确，但不带动画
            // 同样要先 FilterByStarMode，避免把打星队当作新增渲染（参考 JudgeSort）。
            await this.RenderRank(this.rollData);
            
            // 判断是否需要视口上升动画：只有从非奖区跳到奖区时才执行动画
            const shouldAnimateScroll = (currentAwardLevel === 0);
            
            // 如果不需要动画，像 g 操作一样直接跳转
            if (!shouldAnimateScroll) {
                // 直接执行跳转，无额外动画
                // 关键修复：RenderRank 已经更新了DOM，不需要再调用 IncrementalUpdate
                // IncrementalUpdate 会追加新元素，导致重复DOM
                // 如果需要动画，可以调用 IncrementalUpdate，但这里已经 RenderRank 了，不需要
                
                // 应用特效（如果有）
                if (revealedTeamIds && revealedTeamIds.length > 0) {
                    this.ApplySkipRevealEffect(revealedTeamIds);
                }
                // F 跳奖区是"跳到非相邻位置"，允许本次绕过单向滚动限制（向下/向上都行），
                // 否则跳完看不到激活的队。
                this._allowOneWayBypass = true;
                // 执行一次JudgeConfirm（立即执行，不等待动画）
                this.JudgeConfirm();
                
                const awardName = this._GetAwardNameByLevel(targetAwardLevel);
                const groupPrefix = useGroupAwardTarget ? `${RankToolEscapeHtml(groupAwardTarget.groupName)} ` : '';
                
                this.ShowKeyHint(`已跳到${groupPrefix}${awardName}`, 'F');
                return;
            }
            
            // 以下是从非奖区跳到奖区的逻辑，保持原有的视口上升动画
            // 构建元素ID数组（用于后续计算）
            const allElementIds = this.rollData.map(item => `rank-grid-${item.team_id}`);
            
            // 4. 等待DOM更新完成，确保所有元素都已正确排序和渲染
            // 需要等待足够的时间，让浏览器完成布局计算
            await new Promise(resolve => requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    requestAnimationFrame(resolve);
                });
            }));
            
            // 强制重排，确保浏览器完成布局计算
            const tempElement = document.querySelector('.rank-grid');
            if (tempElement) {
                tempElement.offsetHeight; // 强制重排
            }
            
            // 5. DOM更新完成后，直接向上滚动到跳过后第一个未处理队伍的上方位置
            // 找到 currentJudgingIndex 对应的队伍（应该是奖区最后一名）
            let targetTeamId = null;
            if (this.currentJudgingIndex >= 0 && this.currentJudgingIndex < this.rollData.length) {
                // 使用 this.rollData 而不是 rankedList，因为 currentJudgingIndex 是基于 displayList 的
                targetTeamId = this.rollData[this.currentJudgingIndex].team_id;
            } else if (this.rollData.length > 0) {
                // 如果索引超出范围，使用最后一个队伍
                targetTeamId = this.rollData[this.rollData.length - 1].team_id;
            }
            
            // 从非奖区跳到奖区，需要执行视口上升动画
            if (targetTeamId) {
                const targetElementId = `rank-grid-${targetTeamId}`;
                const targetEl = document.getElementById(targetElementId);
                if (targetEl) {
                    // 获取滚动容器
                    const scrollContainer = this.getScrollContainer();
                    const isWindowScroll = scrollContainer === window;
                    
                    // 获取当前滚动位置
                    const scrollUpStartY = isWindowScroll
                        ? (window.scrollY || window.pageYOffset || document.documentElement.scrollTop)
                        : scrollContainer.scrollTop;
                    
                    // 等待一帧，确保DOM完全稳定
                    await new Promise(resolve => requestAnimationFrame(resolve));
                    
                    // 重新获取元素位置（DOM可能已经更新）
                    const refreshedTargetEl = document.getElementById(targetElementId);
                    if (!refreshedTargetEl) {
                        console.warn('目标元素未找到:', targetElementId);
                        return;
                    }
                    
                    // 计算目标位置（跳过后第一个未处理的队伍应该在视口下方1/3处）
                    let elementOffsetTop = refreshedTargetEl.offsetTop;
                    let offsetParent = refreshedTargetEl.offsetParent;
                    while (offsetParent && offsetParent !== document.body && offsetParent !== document.documentElement) {
                        elementOffsetTop += offsetParent.offsetTop;
                        offsetParent = offsetParent.offsetParent;
                    }
                    
                    // 计算目标滚动位置
                    let finalTargetScrollY;
                    if (isWindowScroll) {
                        // window 滚动：目标：元素顶部距离视口顶部 = 视口高度的 1/3
                        finalTargetScrollY = elementOffsetTop - (viewportHeight / 3);
                    } else {
                        // 容器滚动：需要计算元素相对于容器的位置
                        const containerRect = scrollContainer.getBoundingClientRect();
                        const containerScrollTop = scrollContainer.scrollTop;
                        const elementTopRelative = refreshedTargetEl.getBoundingClientRect().top - containerRect.top + containerScrollTop;
                        finalTargetScrollY = elementTopRelative - (viewportHeight / 3);
                    }
                    
                    // 优化滚动性能：为所有元素启用硬件加速，避免滚动时的动态模糊
                    // 给所有队伍元素添加硬件加速样式
                    allElementIds.forEach(elementId => {
                        const element = document.getElementById(elementId);
                        if (element) {
                            // 启用硬件加速，避免滚动时的动态模糊
                            element.style.willChange = 'transform';
                            element.style.transform = 'translateZ(0)'; // 启用硬件加速
                            element.style.backfaceVisibility = 'hidden'; // 避免渲染问题
                        }
                    });
                    
                    // 等待一帧，确保样式已应用
                    await new Promise(resolve => requestAnimationFrame(resolve));
                    
                    // 检查滚动距离是否足够（至少10px才滚动）
                    const scrollDistance = finalTargetScrollY - scrollUpStartY;
                    
                    if (Math.abs(scrollDistance) > 10) {
                        // 使用优化的滚动函数，平滑滚动到目标位置
                        // 滚动速度：150像素/秒，优雅缓慢
                        const scrollSpeed = 150;
                        const scrollDistanceAbs = Math.abs(scrollDistance);
                        const scrollDuration = (scrollDistanceAbs / scrollSpeed) * 1000;
                        const minScrollDuration = 500;
                        const maxScrollDuration = 30000;
                        const finalScrollDuration = Math.max(minScrollDuration, Math.min(maxScrollDuration, scrollDuration));
                        
                        // 中断之前的滚动动画（如果有）
                        if (this.scrollAnimationRunning && this.scrollAnimationId !== null) {
                            cancelAnimationFrame(this.scrollAnimationId);
                            this.scrollAnimationRunning = false;
                        }
                        
                        // 使用 requestAnimationFrame 实现平滑滚动，确保流畅不模糊
                        const scrollUpStartTime = performance.now();
                        this.scrollAnimationRunning = true;
                        let lastScrollY = scrollUpStartY;
                        
                        const animateScrollUp = (currentTime) => {
                            // 检查是否被中断（scrollToTeam 会设置 scrollAnimationRunning = false）
                            if (!this.scrollAnimationRunning) {
                                // 动画被中断，清理硬件加速样式
                                allElementIds.forEach(elementId => {
                                    const element = document.getElementById(elementId);
                                    if (element) {
                                        element.style.willChange = '';
                                        element.style.transform = '';
                                        element.style.backfaceVisibility = '';
                                    }
                                });
                                // 清理相关定时器，避免延迟触发
                                if (this.fastSkipScrollTimeout !== null) {
                                    clearTimeout(this.fastSkipScrollTimeout);
                                    this.fastSkipScrollTimeout = null;
                                }
                                if (this.fastSkipJudgeConfirmTimeout !== null) {
                                    clearTimeout(this.fastSkipJudgeConfirmTimeout);
                                    this.fastSkipJudgeConfirmTimeout = null;
                                }
                                return;
                            }
                            
                            const elapsed = currentTime - scrollUpStartTime;
                            const progress = Math.min(elapsed / finalScrollDuration, 1);
                            
                            // 使用线性插值，实现匀速滚动
                            const scrollY = scrollUpStartY + (finalTargetScrollY - scrollUpStartY) * progress;
                            const targetScrollY = Math.max(0, scrollY);
                            
                            // 检查是否需要滚动（至少0.5px变化才滚动）
                            if (Math.abs(targetScrollY - lastScrollY) > 0.5) {
                                // 使用正确的滚动方法
                                if (isWindowScroll) {
                                    // window 滚动：直接使用 scrollTo
                                    window.scrollTo({
                                        top: targetScrollY,
                                        left: 0,
                                        behavior: 'auto'
                                    });
                                } else {
                                    // 容器滚动：直接设置 scrollTop
                                    scrollContainer.scrollTop = targetScrollY;
                                }
                                lastScrollY = targetScrollY;
                            }
                            
                            if (progress < 1) {
                                this.scrollAnimationId = requestAnimationFrame(animateScrollUp);
                            } else {
                                this.scrollAnimationRunning = false;
                                this.scrollAnimationId = null;
                                // 确保最终位置正确
                                if (isWindowScroll) {
                                    window.scrollTo({
                                        top: finalTargetScrollY,
                                        left: 0,
                                        behavior: 'auto'
                                    });
                                } else {
                                    scrollContainer.scrollTop = finalTargetScrollY;
                                }
                                
                                // 滚动完成后，清理硬件加速样式
                                allElementIds.forEach(elementId => {
                                    const element = document.getElementById(elementId);
                                    if (element) {
                                        element.style.willChange = '';
                                        element.style.transform = '';
                                        element.style.backfaceVisibility = '';
                                    }
                                });
                            }
                        };
                        
                        requestAnimationFrame(animateScrollUp);
                        
                        // 等待滚动动画完成（使用可取消的 Promise）
                        await new Promise(resolve => {
                            // 保存定时器ID，以便中断时可以清理
                            this.fastSkipScrollTimeout = setTimeout(() => {
                                this.fastSkipScrollTimeout = null;
                                resolve();
                            }, finalScrollDuration + 100);
                        });
                        
                        // 验证滚动是否成功
                        const afterScrollY = isWindowScroll
                            ? (window.scrollY || window.pageYOffset || document.documentElement.scrollTop)
                            : scrollContainer.scrollTop;
                        
                        // 如果滚动失败，尝试直接定位
                        if (Math.abs(afterScrollY - finalTargetScrollY) > 10) {
                            console.warn('滚动动画未达到目标位置，尝试直接定位');
                            if (isWindowScroll) {
                                window.scrollTo({
                                    top: finalTargetScrollY,
                                    left: 0,
                                    behavior: 'auto'
                                });
                            } else {
                                scrollContainer.scrollTop = finalTargetScrollY;
                            }
                        }
                    } else {
                        
                    }
                }
            } else {
                // 如果没有非奖区已揭晓队伍，执行排序动画并应用特效
                // 先 FilterByStarMode，避免把打星队当作新增渲染（参考 JudgeSort）。
                await this.IncrementalUpdate(this.rollData);
                if (revealedTeamIds && revealedTeamIds.length > 0) {
                    this.ApplySkipRevealEffect(revealedTeamIds);
                }
            }
            
            // 等待动画完全完成后再执行JudgeConfirm
            // 延迟一点时间，确保所有滚动动画也完成（使用可取消的定时器）
            this.fastSkipJudgeConfirmTimeout = setTimeout(() => {
                this.fastSkipJudgeConfirmTimeout = null;
                // 再次检查滚动是否被中断（如果被中断，不应该执行JudgeConfirm）
                if (this.scrollAnimationRunning) {
                    // 滚动还在进行，不执行JudgeConfirm（等待滚动完成）
                    return;
                }
                // F 跳奖区"跳到非相邻位置"，允许本次绕过单向滚动限制
                this._allowOneWayBypass = true;
                // 执行一次JudgeConfirm
                this.JudgeConfirm();

                const awardName = this._GetAwardNameByLevel(targetAwardLevel);
                const groupPrefix = useGroupAwardTarget ? `${RankToolEscapeHtml(groupAwardTarget.groupName)} ` : '';
                this.ShowKeyHint(`已跳到${groupPrefix}${awardName}`, 'F');
            }, 500); // 额外等待500ms，确保滚动和动画完全完成
        } catch (error) {
            console.error('快速跳过失败:', error);
            this.HideFastSkipProgress();
            this.ShowMessage('快速跳过失败，请重试');
        }
    }
    
    /**
     * 往前跳 10 个队（快捷键 g）
     * 基于 currentJudgingIndex 前进10个位置
     */
    async JumpForward10Teams() {
        if (!this.isRolling) {
            this.ShowKeyHint('请先启动滚榜', 'G');
            return;
        }

        // G 与 F/U/I 一样是非相邻跳转。若当前停在获奖 overlay 的子状态，
        // 先收束旧 overlay / 高亮，避免跳转完成后残留的 award step 抢走键盘状态。
        if (this._isRollAwardStepBlocking()) {
            if (typeof RollAwardOverlay !== 'undefined' && RollAwardOverlay.isOpen()) {
                this.HideModal('award');
            }
            this.currentRollStep = null;
            this.ClearJudgingHighlight();
        }
        
        const displayList = this.rollData;
        const totalTeams = displayList.length;
        
        // 初始化 currentJudgingIndex 如果无效
        if (this.currentJudgingIndex < 0 || this.currentJudgingIndex >= totalTeams) {
            this.currentJudgingIndex = totalTeams - 1;
        }
        
        // 往前跳 10 个队，即 currentJudgingIndex 减少 10
        const targetIndex = Math.max(0, this.currentJudgingIndex - 10);
        
        if (targetIndex === this.currentJudgingIndex) {
            this.ShowKeyHint('无法再往前跳', 'G');
            return;
        }

        if (!this._requireJumpSuffixFrozenClean(this.currentJudgingIndex, 'G')) {
            return;
        }

        // 计算需要"完成"到目标索引（即剩余队伍数）
        const remainingTeams = targetIndex + 1; // currentJudgingIndex 是索引，剩余队伍数 = 索引 + 1
        
        this.ShowFastSkipProgress();
        
        try {
            // 计算总步数用于进度显示（需要完成的队伍数）
            const jumpBudget = this._CalculateJumpCompletedTeams(totalTeams, remainingTeams);
            this.UpdateFastSkipProgress(0, jumpBudget ? jumpBudget.completedTeams : 0);
            
            const revealedTeamIds = await this.JumpToSpecificStage(remainingTeams, (current, total) => {
                this.UpdateFastSkipProgress(current, total);
            });
            
            this.HideFastSkipProgress();
            
            // 关键修复：使用 FinalizeJumpToStage 统一处理，确保数据一致性
            // FinalizeJumpToStage 会调用 RenderRank 并处理所有后续逻辑
            await this.FinalizeJumpToStage(remainingTeams, {
                callJudgeConfirm: true
            });
            
            // 应用特效（如果有）
            if (revealedTeamIds && revealedTeamIds.length > 0) {
                this.ApplySkipRevealEffect(revealedTeamIds);
            }
            
            this.ShowKeyHint(`已往前跳 10 个队（当前位置: ${this.currentJudgingIndex + 1}/${totalTeams}）`, 'G');
        } catch (error) {
            console.error('往前跳失败:', error);
            this.HideFastSkipProgress();
            this.ShowMessage('往前跳失败，请重试');
        }
    }
    
    
    /**
     * 显示快速跳过进度条
     */
    ShowFastSkipProgress() {
        this.HideFastSkipProgress();
        
        const overlay = document.createElement('div');
        overlay.id = 'fast-skip-progress-overlay';
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100vw;
            height: 100vh;
            background: rgba(0, 0, 0, 0.7);
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            z-index: 100000;
            backdrop-filter: blur(4px);
        `;
        
        const progressContainer = document.createElement('div');
        progressContainer.style.cssText = `
            background: white;
            padding: 32px 48px;
            border-radius: 12px;
            box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
            min-width: 400px;
            max-width: 600px;
        `;
        
        progressContainer.innerHTML = `
            <div style="margin-bottom: 20px; font-size: 18px; font-weight: 600; color: #333;">
                ${this.CreateBilingualText('快速跳过到获奖区域...', 'Fast Skip to Award Area...')}
            </div>
            <div style="width: 100%; height: 24px; background: #e9ecef; border-radius: 6px; overflow: hidden; margin-bottom: 12px;">
                <div id="fast-skip-progress-bar" style="width: 0%; height: 100%; background: linear-gradient(90deg, #3b82f6, #2563eb); transition: width 0.3s ease; border-radius: 6px;"></div>
            </div>
            <div id="fast-skip-progress-text" style="font-size: 14px; color: #666; text-align: center;">
                ${this.CreateBilingualText('计算中...', 'Calculating...')}
            </div>
        `;
        
        overlay.appendChild(progressContainer);
        document.body.appendChild(overlay);
    }
    
    /**
     * 更新快速跳过进度条
     */
    UpdateFastSkipProgress(current, total) {
        const progressBar = document.getElementById('fast-skip-progress-bar');
        const progressText = document.getElementById('fast-skip-progress-text');
        
        if (progressBar && progressText) {
            const percentage = total > 0 ? Math.min(100, Math.round((current / total) * 100)) : 0;
            progressBar.style.width = `${percentage}%`;
            progressText.textContent = `${this.CreateBilingualText('处理中', 'Processing')}: ${current} / ${total} (${percentage}%)`;
        }
    }
    
    /**
     * 隐藏快速跳过进度条
     */
    HideFastSkipProgress() {
        const overlay = document.getElementById('fast-skip-progress-overlay');
        if (overlay) {
            overlay.remove();
        }
    }
    
    /**
     * 执行跳转到指定阶段后的通用后处理逻辑
     * 参考 FastSkipToAwardArea 的正确实现，确保状态一致性
     * @param {number} remainingTeams - 剩余队伍数（已由JumpToSpecificStage处理）
     * @param {Object} options - 选项
     * @param {boolean} options.callJudgeConfirm - 是否调用JudgeConfirm定位（默认true）
     */
    async FinalizeJumpToStage(remainingTeams, options = {}) {
        const { callJudgeConfirm = true } = options;
        
        const totalLen = this.rollData.length;
        const remNum = Number(remainingTeams);
        let rem = Number.isFinite(remNum) ? Math.floor(remNum) : 0;
        rem = Math.max(0, Math.min(rem, totalLen));
        const validRemainingTeams = rem;
        
        this.RollSort();
        this._syncJudgingIndexToTeamRowAfterSort(validRemainingTeams);

        this.judgingTeamId = null;
        this.judgingProblemId = null;
        this.judgingTeamIdLast = null;
        
        // 3. 更新DOM显示（无动画）
        // 参考 FastSkipToAwardArea：使用 RenderRank 直接渲染，确保DOM顺序正确。
        // 同样要先 FilterByStarMode，避免把打星队当作新增渲染。
        await this.RenderRank(this.rollData);
        
        // 4. 等待DOM更新完成（参考 FastSkipToAwardArea）
        // 需要等待足够的时间，让浏览器完成布局计算
        await new Promise(resolve => requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                requestAnimationFrame(resolve);
            });
        }));

        this._warnJumpSuffixFrozenMismatch(this.currentJudgingIndex);

        // 5. 定位到下一个要判的队伍（如果需要）
        if (callJudgeConfirm) {
            // U 撤回 / I 回退 10 队 / F 跳奖区 等"跳到非相邻位置"的操作，必须能向下
            // 滚回去——否则用户撤回到之前位置看不到激活的队（被单向滚动机制挡住）。
            // 这里置一次性 bypass 票据，scrollToElementBottomThird 消费一次后立即重置。
            this._allowOneWayBypass = true;
            this.JudgeConfirm();
        }
    }
    
    async RollUndo() {
        this._dbg('undo', 'RollUndo() ENTER',
            { idx: this.currentJudgingIndex, step: this.currentRollStep });
        if (!this.isRolling) {
            this._dbg('undo', 'RollUndo abort: not rolling');
            this.ShowKeyHint('请先启动滚榜', 'U');
            return;
        }
        
        // 1. 保存当前的 currentJudgingIndex（重置前的位置）
        const currentIndex = this.currentJudgingIndex;
        
        // 获取当前数据用于验证
        const totalTeams = this.rollData.length;
        
        // 验证当前索引有效性
        if (currentIndex < 0 || currentIndex >= totalTeams) {
            this._dbg('undo', 'RollUndo abort: index invalid', { currentIndex, totalTeams });
            this.ShowKeyHint('无法再撤回', 'U');
            return;
        }
        
        // 2. 计算目标位置：撤回1步，即 currentJudgingIndex + 1
        const targetIndex = Math.min(totalTeams - 1, currentIndex + 1);
        
        if (targetIndex <= currentIndex) {
            this._dbg('undo', 'RollUndo abort: targetIndex<=currentIndex', { currentIndex, targetIndex });
            this.ShowKeyHint('无法再撤回', 'U');
            return;
        }
        this._dbg('undo', 'RollUndo proceeding', { currentIndex, targetIndex, remainingTeams: targetIndex + 1 });
        
        // 3. 计算剩余队伍数（用于 JumpToSpecificStage）
        // targetIndex 表示目标位置，remainingTeams = targetIndex + 1
        const remainingTeams = targetIndex + 1;
        
        try {
            // 4. 完全重置滚榜数据（复用 ResetRoll 的初始化逻辑）
            await this.ResetRollDataToInitial();

            // 5. 验证重置后的数据：注意这里要拿"全量 rollData 长度"做对比，不能拿
            //    FilterByStarMode 后的过滤子集长度。
            //    旧代码把 this.rollData.length（全量）跟 FilterByStarMode 后的 49 队比，
            //    只要存在打星队 / 赛事归属过滤，长度永远不等，导致 RollUndo 100% 报错失败
            //    （对应控制台 "RollUndo: 重置前后队伍数不一致 97 49"）。
            //    rollData 是 InitRollState 重新基于 rankList 构建的，长度本就稳定相等。
            if (this.rollData.length !== totalTeams) {
                this._dbg('undo', 'RollUndo abort: rollData length mismatch',
                    { before: totalTeams, after: this.rollData.length });
                this.ShowMessage('撤回失败：数据不一致');
                return;
            }

            // 6. 使用 JumpToSpecificStage 跳转到目标位置（无动画）
            await this.JumpToSpecificStage(remainingTeams, null);

            // 7. 执行通用后处理逻辑
            await this.FinalizeJumpToStage(remainingTeams, {
                callJudgeConfirm: true
            });

            this._dbg('undo', 'RollUndo done', { newIdx: this.currentJudgingIndex });
            this.ShowKeyHint(`已撤回一步（当前位置: ${this.currentJudgingIndex + 1}/${this.rollData.length}）`, 'U');
        } catch (error) {
            this._dbg('undo', 'RollUndo error', error && error.message);
            this.ShowMessage('撤回失败，请重试');
        }
    }

    /**
     * 完全重置滚榜数据（复用 ResetRoll 的核心逻辑）
     * 与 ResetRoll 的区别：不会停止滚榜、不会重新获取服务器数据
     * 用于 u 和 i 操作，确保数据完全一致
     */
    async ResetRollDataToInitial() {
        // 直接复用 ResetRoll 的核心重置逻辑（不重新获取数据）
        await this._ResetRollDataCore(false);
    }
    
    /**
     * 回退10个队伍（I键）：完全重置数据，然后暴力跳转到 currentJudgingIndex + 10 的位置，无动画
     */
    async JumpBack10Teams() {
        if (!this.isRolling) {
            this.ShowKeyHint('请先启动滚榜', 'I');
            return;
        }

        const currentIndex = this.currentJudgingIndex;
        // 关键修复：currentJudgingIndex 是 rollData 的全量索引，所以"总数"也必须用
        // rollData.length 才能正确做边界判断；用 FilterByStarMode 过滤后的长度会
        // 在有打星队 / 赛事归属过滤时把 currentIndex >= 过滤长度 误判为越界。
        const totalTeams = this.rollData.length;
        if (currentIndex < 0 || currentIndex >= totalTeams) {
            this._dbg('undo', 'JumpBack10Teams abort: index invalid', { currentIndex, totalTeams });
            this.ShowKeyHint('无法再往前跳', 'I');
            return;
        }

        const stepsToJump = 10;
        const targetIndex = Math.min(totalTeams - 1, currentIndex + stepsToJump);
        if (targetIndex <= currentIndex) {
            this._dbg('undo', 'JumpBack10Teams abort: targetIndex<=currentIndex', { currentIndex, targetIndex });
            this.ShowKeyHint('无法再往前跳', 'I');
            return;
        }

        const remainingTeams = targetIndex + 1;
        this._dbg('undo', 'JumpBack10Teams proceeding', { currentIndex, targetIndex, remainingTeams });

        try {
            await this.ResetRollDataToInitial();

            // 用全量 rollData.length 校验（原因同 RollUndo）
            if (this.rollData.length !== totalTeams) {
                this._dbg('undo', 'JumpBack10Teams abort: rollData length mismatch',
                    { before: totalTeams, after: this.rollData.length });
                this.ShowMessage('回退失败：数据不一致');
                return;
            }

            await this.JumpToSpecificStage(remainingTeams, null);
            await this.FinalizeJumpToStage(remainingTeams, {
                callJudgeConfirm: true
            });

            this._dbg('undo', 'JumpBack10Teams done', { newIdx: this.currentJudgingIndex });
            this.ShowKeyHint(`已回退10个队伍（当前位置: ${this.currentJudgingIndex + 1}/${this.rollData.length}）`, 'I');
        } catch (error) {
            this._dbg('undo', 'JumpBack10Teams error', error && error.message);
            this.ShowMessage('回退失败，请重试');
        }
    }
    
    /**
     * 优雅的队伍落下动画（使用 CSGAnim 库）
     * @param {string[]} teamIds - 要落下的队伍ID数组
     * @param {number} duration - 动画持续时间（ms），默认慢速优雅
     * @param {boolean} shouldScrollFollow - 是否让窗口跟随上升，默认true
     * @param {string} targetTeamId - 滚动目标队伍ID（用于窗口跟随）
     * @returns {Promise<void>}
     */
    async AnimateTeamsFallingDown(teamIds, duration = 1500, shouldScrollFollow = true, targetTeamId = null) {
        // 关键修复：此方法已废弃，不再需要跳过的队伍的优雅降落动画
        // 直接返回，不执行任何操作，避免产生额外的DOM操作
        return;
    }
    
    /**
     * 获取所有已揭晓的非奖区队伍ID
     * @param {Array} rankedList - 排名列表
     * @returns {string[]} - 队伍ID数组
     */
    GetNonAwardRevealedTeams(rankedList) {
        const nonAwardTeams = [];
        
        rankedList.forEach(item => {
            // 跳过打星队和奖区队伍
            if (item.isStar) {
                return;
            }
            
            if (item.displayRank !== '*' && item.displayRank <= this.rankBronze) {
                return; // 奖区队伍，跳过
            }
            
            // 检查该队伍是否已全部揭晓（没有frozen题目）)
            const solutions = this.rollSolutionMap[item.team_id];
            const hasFrozenProblems = solutions && solutions.frozen && Object.keys(solutions.frozen).length > 0;
            
            if (!hasFrozenProblems) {
                // 已全部揭晓的非奖区队伍
                nonAwardTeams.push(item.team_id);
            }
        });
        
        return nonAwardTeams;
    }
    
    /**
     * 获取已尘埃落定的队伍ID（currentJudgingIndex 之前的队伍，名次不会再变化）
     * @param {Array} rankedList - 排名列表
     * @param {number} currentJudgingIndex - 当前判题索引
     * @returns {string[]} - 队伍ID数组
     */
    GetSettledTeams(rankedList, currentJudgingIndex) {
        if (currentJudgingIndex <= 0 || currentJudgingIndex >= rankedList.length) {
            return [];
        }
        
        const settledTeams = [];
        
        // currentJudgingIndex 之前的队伍都已尘埃落定（名次不会再变化）
        // 注意：不包括 currentJudgingIndex 本身
        for (let i = 0; i < currentJudgingIndex; i++) {
            const item = rankedList[i];
            if (item) {
                settledTeams.push(item.team_id);
            }
        }
        
        return settledTeams;
    }
    
    /**
     * 为跳过过程中被处理的队伍应用特效
     * @param {string[]} teamIds - 被处理的队伍ID数组（所有出队的都算）
     */
    ApplySkipRevealEffect(teamIds) {
        if (!teamIds || teamIds.length === 0 || !this.container) {
            return;
        }
        
        // // 使用 requestAnimationFrame 确保不阻塞动画和DOM操作
        // // 批量添加特效类，异步执行，不阻塞主线程
        // requestAnimationFrame(() => {
        //     teamIds.forEach((teamId, index) => {
        //         // 使用 requestAnimationFrame 分批处理，避免阻塞
        //         requestAnimationFrame(() => {
        //             const teamRow = document.getElementById(`rank-grid-${teamId}`);
        //             if (teamRow) {
        //                 // 延迟添加，形成逐个闪现的效果
        //                 setTimeout(() => {
        //                     teamRow.classList.add('roll-skip-revealed');
        //                     // 2秒后移除特效类
        //                     setTimeout(() => {
        //                         teamRow.classList.remove('roll-skip-revealed');
        //                     }, 1000);
        //                 }, index * 30); // 每个队伍间隔30ms，形成流水效果
        //             }
        //         });
        //     });
        // });
    }
    
    /**
     * 速度控制
     */
    RollSpeedUp() {
        this.rollSpeedMultiplier = Math.min(5.0, this.rollSpeedMultiplier * 1.5);
        this.autoSpeed = Math.max(this.MIN_ROLL_SPEED, Math.floor(this.DEFAULT_ROLL_SPEED / this.rollSpeedMultiplier));
    }
    
    RollSpeedDown() {
        this.rollSpeedMultiplier = Math.max(0.2, this.rollSpeedMultiplier / 1.5);
        this.autoSpeed = Math.min(this.MAX_ROLL_SPEED, Math.floor(this.DEFAULT_ROLL_SPEED / this.rollSpeedMultiplier));
    }
    
    RollResetSpeed() {
        this.rollSpeedMultiplier = 1.0;
        this.autoSpeed = this.DEFAULT_ROLL_SPEED;
    }
    
    /**
     * 切换自动滚榜
     */
    ToggleAutoRoll() {
        this.isAutoRolling = !this.isAutoRolling;
        if (this.isAutoRolling) {
            if (!this.isRolling) {
                this.pendingAutoRoll = true;
                this.StartRollProcess().then(() => {
                    if (this.pendingAutoRoll && this.isRolling) {
                        this.pendingAutoRoll = false;
                        const displayList = this.rollData;
                        const rankedList = this.CalculateRankInfo(displayList);
                        
                        if (this.judgingTeamId) {
                            const currentItem = rankedList.find(item => item.team_id === this.judgingTeamId);
                            if (currentItem && !currentItem.isStar) {
                                this.startAwardLevel = this.GetAwardLevel(currentItem.displayRank);
                            } else {
                                this.startAwardLevel = this.currentAwardLevel;
                            }
                        } else {
                            this.startAwardLevel = this.currentAwardLevel;
                        }
                        
                        this.ShowKeyHint('开启自动滚榜', 'A');
                        this.RollNext();
                    }
                });
                return;
            }
            
            const displayList = this.rollData;
            const rankedList = this.CalculateRankInfo(displayList);
            
            if (this.judgingTeamId) {
                const currentItem = rankedList.find(item => item.team_id === this.judgingTeamId);
                if (currentItem && !currentItem.isStar) {
                    this.startAwardLevel = this.GetAwardLevel(currentItem.displayRank);
                } else {
                    this.startAwardLevel = this.currentAwardLevel;
                }
            } else {
                this.startAwardLevel = this.currentAwardLevel;
            }
            
            this.ShowKeyHint('开启自动滚榜', 'A');
            this.RollNext();
        } else {
            this.ShowKeyHint('关闭自动滚榜', 'A');
        }
    }
    
    /**
     * 加载获奖 overlay 中的学校校徽（直接加载，不使用懒加载）。
     * 预处理（抠边、测内容半径、background-size）见 rank_tool.js。
     */
    async LoadAwardSchoolLogo(element, school) {
        if (!element || !school) {
            return;
        }
        if (typeof RankToolDisconnectSchoolBadgeResizeObserver === 'function') {
            RankToolDisconnectSchoolBadgeResizeObserver(element, '--roa-badge-bg-size');
        }
        try {
            const baseUrl = this.config.school_badge_url || '/static/image/school_badge';
            const fileKey = `${baseUrl}/${encodeURIComponent(school)}`;
            const dataUrl = await this.FetchSchoolLogoDataUrl(fileKey);
            const pack = typeof RankToolLoadSchoolBadgeProcessedPack === 'function'
                ? await RankToolLoadSchoolBadgeProcessedPack(fileKey, dataUrl)
                : { measured: { W: 0, H: 0, R: null }, displayUrl: dataUrl };
            const measured = pack.measured;
            const displayUrl = pack.displayUrl || dataUrl;
            element.style.setProperty('--rank-school-logo-bg', `url(${JSON.stringify(displayUrl)})`);
            element.classList.add('has-background');
            if (measured.R != null && measured.R > 0 && typeof RankToolApplySchoolBadgeBackgroundFit === 'function') {
                RankToolApplySchoolBadgeBackgroundFit(element, measured.W, measured.H, measured.R, '--roa-badge-bg-size');
            } else if (typeof RankToolDisconnectSchoolBadgeResizeObserver === 'function') {
                RankToolDisconnectSchoolBadgeResizeObserver(element, '--roa-badge-bg-size');
            }
        } catch (e) {
            element.classList.remove('has-background');
            element.style.setProperty('--rank-school-logo-bg', 'none');
            if (typeof RankToolDisconnectSchoolBadgeResizeObserver === 'function') {
                RankToolDisconnectSchoolBadgeResizeObserver(element, '--roa-badge-bg-size');
            }
        }
    }

    /**
     * 计算真实最终榜的一血状态（基于所有题目都已揭晓）
     * @returns {Object} - { global: {...}, regular: {...} } 格式的一血映射
     */
    CalculateRealFirstBlood() {
        if (!this.rollSolutionMap || !this.teamMap) {
            return { global: {}, regular: {} };
        }
        
        const realGlobalFB = {};
        const realRegularFB = {};
        
        // 遍历所有题目
        for (const problemId in this.problemMap) {
            let globalFirstBlood = null;  // { team_id, in_date, isStarTeam }
            let regularFirstBlood = null; // { team_id, in_date } (仅非打星队)
            
            // 遍历所有队伍，找出该题目的最早AC（基于所有题目都已揭晓的假设）
            for (const teamId in this.rollSolutionMap) {
                const solutions = this.rollSolutionMap[teamId];
                if (!solutions || !solutions.problems || !solutions.problems[problemId]) {
                    continue;
                }
                
                // 遍历该队伍的所有提交，找出第一次AC
                const problemSolutions = solutions.problems[problemId];
                for (const solution of problemSolutions) {
                    if (solution.result === 4) { // AC
                        const team = this.teamMap[teamId];
                        const isStarTeam = team && team.tkind === 2;
                        const inDate = solution.in_date;
                        
                        // 更新全局一血（所有队伍）
                        if (!globalFirstBlood || inDate < globalFirstBlood.in_date) {
                            globalFirstBlood = {
                                team_id: teamId,
                                in_date: inDate,
                                isStarTeam: isStarTeam
                            };
                        }
                        
                        // 更新常规一血（仅非打星队）
                        if (!isStarTeam) {
                            if (!regularFirstBlood || inDate < regularFirstBlood.in_date) {
                                regularFirstBlood = {
                                    team_id: teamId,
                                    in_date: inDate
                                };
                            }
                        }
                        
                        // 找到第一次AC就停止
                        break;
                    }
                }
            }
            
            // 记录全局一血
            if (globalFirstBlood) {
                realGlobalFB[problemId] = {
                    team_id: globalFirstBlood.team_id,
                    in_date: globalFirstBlood.in_date,
                    isStarTeam: globalFirstBlood.isStarTeam
                };
            }
            
            // 记录常规一血
            if (regularFirstBlood) {
                realRegularFB[problemId] = {
                    team_id: regularFirstBlood.team_id,
                    in_date: regularFirstBlood.in_date,
                    isStarTeam: false
                };
            }
        }
        
        return {
            global: realGlobalFB,
            regular: realRegularFB
        };
    }
    
    /**
     * 获取队伍的一血列表（首答题目）- 基于真实最终榜的结果
     * @param {string} team_id - 队伍ID
     * @returns {string} - 一血题目列表，格式如 "A,B,E"，如果没有则返回 "-"
     */
    GetFirstBloodList(team_id) {
        // 计算真实最终榜的一血状态（基于所有题目都已揭晓）
        const realFB = this.CalculateRealFirstBlood();
        
        // 根据打星模式选择使用regular还是global一血
        const fbMap = this.starMode === 1 ? realFB.regular : realFB.global;
        if (!fbMap || Object.keys(fbMap).length === 0) {
            return null; // 返回null而不是'-'，用于判断是否显示
        }
        
        const fbList = [];
        
        // 遍历所有题目，找出该队的一血
        for (const problemId in fbMap) {
            const fbInfo = fbMap[problemId];
            if (fbInfo && fbInfo.team_id === team_id) {
                // 获取题目编号（A, B, C等）
                const problem = this.problemMap[problemId];
                if (problem) {
                    const alphabetIdx = this.GetProblemAlphabetIdx(problem.num);
                    // GetProblemAlphabetIdx 已经返回字母了（'A', 'B', 'C'），直接使用
                    fbList.push(alphabetIdx);
                }
            }
        }
        
        // 按题目顺序排序
        fbList.sort();
        
        return fbList.length > 0 ? fbList.join(', ') : null;
    }
    
    /**
     * 为元素启用跑马灯效果（如果文本溢出）。实现见 `/static/js/csg_marquee_plain.js`（与滚榜 overlay 同源：双文段 + 分隔，`translateX` 一周回到开头）。
     * @param {HTMLElement} element - 目标元素
     * @param {string} text - 要显示的文本
     * @param {{ htmlWhenFit?: string, marqueeAggressive?: boolean, overflowSlackRatio?: number }} [options]
     *        overflowSlackRatio：与容器宽的乘数作溢出余量（默认 0.01）；院校正文等可略增大以减少贴边误开跑马灯
     */
    enableMarqueeIfNeeded(element, text, options) {
        if (window.CsgMarqueePlain && typeof window.CsgMarqueePlain.enableMarqueeIfNeeded === 'function') {
            window.CsgMarqueePlain.enableMarqueeIfNeeded(element, text, options);
        } else {
            console.error('RankRollSystem: CsgMarqueePlain missing; load /static/js/csg_marquee_plain.js before rank_roll.js');
        }
    }
    
    /**
     * 设置获奖信息行的显示/隐藏和内容（overlay 内 #award-*）
     */
    setAwardInfoRow(rowId, valueElement, value, deferMarquee) {
        const row = typeof document !== 'undefined' ? document.getElementById(rowId) : null;
        const isEmpty = !value || String(value).trim() === '';
        const defer = !!deferMarquee;

        if (isEmpty) {
            if (row) {
                row.style.display = 'none';
                row.classList.add('award-info-row-hidden');
            }
            if (!defer) {
                this.enableMarqueeIfNeeded(valueElement, '');
            } else if (valueElement) {
                valueElement.classList.remove('needs-marquee');
                const ow = valueElement.querySelector('.marquee-wrapper');
                if (ow) {
                    ow.remove();
                }
                valueElement.textContent = '';
            }
        } else {
            if (row) {
                row.style.display = 'flex';
                row.classList.remove('award-info-row-hidden');
            }
            if (defer && valueElement) {
                valueElement.classList.remove('needs-marquee');
                const ow2 = valueElement.querySelector('.marquee-wrapper');
                if (ow2) {
                    ow2.remove();
                }
                valueElement.textContent = value;
            } else {
                this.enableMarqueeIfNeeded(valueElement, value);
            }
        }
    }

    /**
     * 滚榜获奖 overlay：双语标签（中英左右，无分隔符；样式见 roll_award_overlay `.award-roa-label-stack`）
     */
    CreateRollAwardLabelStack(cn, en) {
        return (
            `<span class="award-roa-label-stack">` +
            `<span class="award-roa-label-stack-cn">${RankToolEscapeHtml(cn)}</span>` +
            `<span class="award-roa-label-stack-en">${RankToolEscapeHtml(en)}</span>` +
            `</span>`
        );
    }

    /**
     * 首答题号：**仅单行**；超出宽度则横向跑马灯（与排名、解题一致）。
     * @param {HTMLElement} element `#award-first-blood`
     * @param {string} text
     */
    enableAwardFbStatValueIfNeeded(element, text) {
        const raw = String(text || '').trim();
        if (!element) {
            return;
        }
        element.classList.remove('needs-marquee', 'award-stat-value-fb--wrap2');
        const oldWrapper = element.querySelector('.marquee-wrapper');
        if (oldWrapper) {
            oldWrapper.remove();
        }
        element.style.removeProperty('--marquee-duration');
        element.style.removeProperty('--marquee-translate');
        if (!raw) {
            element.textContent = '';
            return;
        }
        this.enableMarqueeIfNeeded(element, raw, { marqueeAggressive: true });
    }

    /**
     * 左栏首答格：无首答时隐藏整格；有则写入正文。与排名、解题同一行；首答值为单行，溢出横向跑马灯。
     */
    applyRollAwardFbStatCell(root, firstBloodList, hasFirstBlood) {
        const cell = root && root.querySelector ? root.querySelector('#award-fb-stat-cell') : null;
        const valueElement = root && root.querySelector ? root.querySelector('#award-first-blood') : null;
        const lblCn = root && root.querySelector ? root.querySelector('#award-lbl-fb-cn') : null;
        const lblEn = root && root.querySelector ? root.querySelector('#award-lbl-fb-en') : null;
        if (lblCn) lblCn.textContent = '首答';
        if (lblEn) lblEn.textContent = 'First blood';
        if (!cell || !valueElement) {
            return;
        }
        const raw = hasFirstBlood && firstBloodList != null ? String(firstBloodList) : '';
        const empty = raw.trim() === '';
        const triple = root.querySelector('.award-stats-triple');
        if (empty) {
            if (triple) triple.classList.add('award-stats-triple--no-fb');
            cell.style.display = 'none';
            valueElement.classList.remove('needs-marquee', 'award-stat-value-fb--wrap2');
            const ow = valueElement.querySelector('.marquee-wrapper');
            if (ow) ow.remove();
            valueElement.textContent = '';
            valueElement.style.removeProperty('--marquee-duration');
            valueElement.style.removeProperty('--marquee-translate');
            return;
        }
        if (triple) triple.classList.remove('award-stats-triple--no-fb');
        cell.style.display = '';
        this.enableAwardFbStatValueIfNeeded(valueElement, raw.trim());
    }

    /**
     * 可选信息行：有内容则显示标签+正文；无内容则隐藏标签，正文区用轻装饰占位（无「无xx」文案）
     */
    applyRollAwardOptionalRow(rowId, labelElement, valueElement, rawText, deferMarquee) {
        const row = typeof document !== 'undefined' ? document.getElementById(rowId) : null;
        const empty = rawText == null || String(rawText).trim() === '';
        const defer = !!deferMarquee;
        if (row) {
            row.style.display = 'flex';
            row.classList.remove('award-info-row-hidden');
        }
        if (!valueElement) {
            return;
        }
        if (empty) {
            if (row) {
                row.classList.add('award-roa-block--vacant');
            }
            if (labelElement) {
                labelElement.hidden = true;
            }
            valueElement.classList.remove('award-roa-placeholder', 'needs-marquee');
            const ow = valueElement.querySelector('.marquee-wrapper');
            if (ow) {
                ow.remove();
            }
            valueElement.innerHTML = '<div class="award-roa-vacant-ornament" aria-hidden="true"></div>';
            valueElement.style.removeProperty('--marquee-duration');
            valueElement.style.removeProperty('--marquee-translate');
            return;
        }
        if (row) {
            row.classList.remove('award-roa-block--vacant');
        }
        if (labelElement) {
            labelElement.hidden = false;
        }
        valueElement.classList.remove('award-roa-placeholder');
        if (defer) {
            valueElement.classList.remove('needs-marquee');
            const ow2 = valueElement.querySelector('.marquee-wrapper');
            if (ow2) {
                ow2.remove();
            }
            valueElement.textContent = String(rawText);
        } else {
            const inAward =
                typeof valueElement.closest === 'function' && valueElement.closest('#csg-roll-award-overlay');
            this.enableMarqueeIfNeeded(valueElement, String(rawText), inAward ? { marqueeAggressive: true } : {});
        }
    }

    BuildTeamGroupAwardItemHtml(one, extraClass) {
        const extra = [extraClass, one.hideGroupName ? 'award-group-item--no-group' : 'award-group-item--with-group']
            .filter(Boolean)
            .join(' ');
        const mod = extra ? ` ${extra}` : '';
        const multiGroupRoll =
            this.IsMultiGroupEnabled() &&
            Array.isArray(this.selectedGroupIds) &&
            this.selectedGroupIds.length > 1;
        const gid = one.groupId != null ? String(one.groupId) : '';
        const useAccent =
            multiGroupRoll &&
            !!gid &&
            !one.hideGroupName &&
            typeof RankToolContestGroupAccentHex === 'function';
        const accentHex = useAccent ? RankToolContestGroupAccentHex(gid) : '';
        const accentClass = useAccent ? ' award-group-item--csg-group-accent' : '';
        const accentStyle = useAccent ? ` style="--csg-group-accent:${accentHex}"` : '';
        const hashIconBi =
            useAccent && typeof RankToolContestGroupOverlayIconClass === 'function'
                ? RankToolContestGroupOverlayIconClass(gid)
                : '';
        const rawTier = String(one.awardClass || 'none');
        const tierKey = ['gold', 'silver', 'bronze', 'none'].includes(rawTier) ? rawTier : 'none';
        const tierClass = ` award-group-item--tier-${tierKey}`;
        const nameRow = one.hideGroupName
            ? ''
            : useAccent && hashIconBi
              ? `<div class="award-group-name-row award-group-name-row--hash-icon"><i class="bi ${hashIconBi} award-group-hash-icon" aria-hidden="true" style="color:${accentHex}"></i><div class="award-group-name award-roa-value-slot">${RankToolEscapeHtml(one.groupName)}</div></div>`
              : `<div class="award-group-name-row"><div class="award-group-name award-roa-value-slot">${RankToolEscapeHtml(one.groupName)}</div></div>`;
        const medalInner =
            one.awardCn != null && one.awardEn != null
                ? `<span class="award-group-medal-cn">${RankToolEscapeHtml(one.awardCn)}</span><span class="award-group-medal-en">${RankToolEscapeHtml(one.awardEn)}</span>`
                : one.awardNameHtml;
        return `
                <div class="award-group-item${mod}${tierClass}${accentClass}"${accentStyle}${useAccent ? ` data-csg-group-id="${RankToolEscapeHtml(gid)}"` : ''}>
                    ${nameRow}
                    <div class="award-group-award-row">
                        <div class="award-group-medal ${one.awardClass}">${medalInner}</div>
                    </div>
                </div>
            `;
    }

    _stopAwardGroupStepScroll() {
        if (this._awardGroupScrollTimer) {
            clearInterval(this._awardGroupScrollTimer);
            this._awardGroupScrollTimer = null;
        }
    }

    RefreshAwardGroupPanel(team_id, root) {
        this._stopAwardGroupStepScroll();
        if (!root) {
            return;
        }
        const panel = root.querySelector('#award-group-panel');
        const rotator = root.querySelector('#award-group-rotator');
        if (!panel || !rotator) {
            return;
        }
        const list = this.GetTeamGroupAwardList(team_id);
        if (!list.length) {
            panel.hidden = true;
            rotator.innerHTML = '';
            rotator.style.transform = '';
            rotator.style.transition = '';
            return;
        }
        panel.hidden = false;
        const lbl = root.querySelector('#award-lbl-groups');
        if (lbl) {
            lbl.innerHTML = this.CreateRollAwardLabelStack('奖项', 'Awards');
        }
        const itemClass = 'award-group-item--in-rotator';
        const onePass = list.map((one) => this.BuildTeamGroupAwardItemHtml(one, itemClass)).join('');
        rotator.style.transition = '';
        rotator.style.transform = '';
        if (list.length <= 2) {
            rotator.innerHTML = onePass;
            return;
        }
        rotator.innerHTML = onePass + onePass;
        const self = this;
        const start = () => {
            const nodes = rotator.querySelectorAll(`.${itemClass}`);
            const first = nodes[0];
            const second = nodes[1];
            let h = 0;
            if (first && second) {
                h = second.offsetTop - first.offsetTop;
            }
            if ((!Number.isFinite(h) || h <= 0) && first) {
                const rs = window.getComputedStyle(rotator);
                const gap = parseFloat(rs.rowGap || rs.gap || '0') || 0;
                h = first.getBoundingClientRect().height + (second ? gap : 0);
            }
            if (!Number.isFinite(h) || h <= 0) {
                h = first && first.offsetHeight ? first.offsetHeight : 88;
            }
            let step = 0;
            self._awardGroupScrollTimer = setInterval(() => {
                const next = step + 1;
                rotator.style.transition = 'transform 0.5s cubic-bezier(0.33, 1, 0.68, 1)';
                if (next >= list.length) {
                    rotator.style.transform = `translateY(-${list.length * h}px)`;
                    setTimeout(() => {
                        rotator.style.transition = 'none';
                        rotator.style.transform = 'translateY(0)';
                        step = 0;
                    }, 520);
                } else {
                    rotator.style.transform = `translateY(-${next * h}px)`;
                    step = next;
                }
            }, 3000);
        };
        requestAnimationFrame(start);
    }

    _rollAwardReflowOptionalValue(valueElement, rawText, marqueeOptions) {
        if (!valueElement) {
            return;
        }
        const row = valueElement.closest('.award-roa-block');
        if (row && row.classList.contains('award-roa-block--vacant')) {
            return;
        }
        const empty = rawText == null || String(rawText).trim() === '';
        if (empty) {
            return;
        }
        this.enableMarqueeIfNeeded(valueElement, String(rawText).trim(), marqueeOptions || {});
    }

    _disconnectRollAwardMarqueeResize(root) {
        if (!root) {
            return;
        }
        if (root._csgRoaMarqueeRo) {
            try {
                root._csgRoaMarqueeRo.disconnect();
            } catch (e) {
                /* ignore */
            }
            root._csgRoaMarqueeRo = null;
        }
        if (root._csgRoaMarqueeResizeTimer) {
            clearTimeout(root._csgRoaMarqueeResizeTimer);
            root._csgRoaMarqueeResizeTimer = null;
        }
        root._csgRollAwardMarqueePack = null;
    }

    /**
     * 舞台随窗口缩放时重测跑马灯（与 --roa-vu 连续字号一致；避免只测首帧）。
     */
    _ensureRollAwardMarqueeResizeObserver(root) {
        if (!root || typeof ResizeObserver === 'undefined') {
            return;
        }
        if (root._csgRoaMarqueeRo) {
            return;
        }
        const stage = root.querySelector('.csg-roa__stage');
        if (!stage) {
            return;
        }
        const self = this;
        const ro = new ResizeObserver(() => {
            if (typeof RollAwardOverlay === 'undefined' || !RollAwardOverlay.isOpen()) {
                return;
            }
            const p = root._csgRollAwardMarqueePack;
            if (!p || p.root !== root) {
                return;
            }
            if (root._csgRoaMarqueeResizeTimer) {
                clearTimeout(root._csgRoaMarqueeResizeTimer);
            }
            root._csgRoaMarqueeResizeTimer = setTimeout(() => {
                root._csgRoaMarqueeResizeTimer = null;
                self._scheduleRollAwardMarqueeReflow(p);
            }, 80);
        });
        ro.observe(stage);
        root._csgRoaMarqueeRo = ro;
    }

    /**
     * overlay 渐显后 clientWidth 才可靠；在 present 之后 rAF 补测跑马灯（与其它字段共用 enableMarqueeIfNeeded）。
     */
    _scheduleRollAwardMarqueeReflow(pack) {
        const self = this;
        if (pack && pack.root) {
            pack.root._csgRollAwardMarqueePack = pack;
            this._ensureRollAwardMarqueeResizeObserver(pack.root);
        }
        const runInner = () => {
            try {
                if (typeof RollAwardOverlay === 'undefined' || !RollAwardOverlay.isOpen()) {
                    return;
                }
                const r = RollAwardOverlay.getRoot();
                if (!r || !pack.root || r !== pack.root) {
                    return;
                }
                const {
                    awardSchool,
                    schoolPlain,
                    schoolHtmlFit,
                    awardTeamName,
                    teamTitle,
                    awardTeamEn,
                    teamEnTrim,
                    awardMembers,
                    awardCoach,
                    awardRank,
                    awardSolved,
                    rankStr,
                    solvedStr,
                    team
                } = pack;
                const mqAward = { marqueeAggressive: true };
                /* 院校正文：略放宽溢出判定，配合较小 --roa-fs-school-line，避免约 9 字贴边误开跑马灯 */
                const mqSchool = { ...mqAward, overflowSlackRatio: 0.055 };
                if (schoolHtmlFit) {
                    self.enableMarqueeIfNeeded(awardSchool, schoolPlain, { ...mqSchool, htmlWhenFit: schoolHtmlFit });
                } else {
                    self.enableMarqueeIfNeeded(awardSchool, schoolPlain, mqSchool);
                }
                self.enableMarqueeIfNeeded(awardTeamName, teamTitle, mqAward);
                self._rollAwardReflowOptionalValue(awardTeamEn, teamEnTrim, mqAward);
                self._rollAwardReflowOptionalValue(awardMembers, team.tmember, mqAward);
                self._rollAwardReflowOptionalValue(awardCoach, team.coach, mqAward);
                if (awardRank && rankStr != null) {
                    self.enableMarqueeIfNeeded(awardRank, String(rankStr), mqAward);
                }
                if (awardSolved && solvedStr != null) {
                    self.enableMarqueeIfNeeded(awardSolved, String(solvedStr), mqAward);
                }

                const reflowLblLine = (el) => {
                    if (!el) return;
                    const t = (el.textContent || '').replace(/\s+/g, ' ').trim();
                    if (!t) return;
                    self.enableMarqueeIfNeeded(el, t, mqAward);
                };
                r.querySelectorAll('.award-stat-lbl-cn').forEach(reflowLblLine);
                r.querySelectorAll('.award-stat-lbl-en').forEach(reflowLblLine);

                const reflowLabelStackLines = (lblRoot) => {
                    if (!lblRoot) return;
                    const cn = lblRoot.querySelector('.award-roa-label-stack-cn');
                    const en = lblRoot.querySelector('.award-roa-label-stack-en');
                    reflowLblLine(cn);
                    reflowLblLine(en);
                };
                [
                    '#award-lbl-school',
                    '#award-lbl-team',
                    '#award-lbl-team-en',
                    '#award-lbl-members',
                    '#award-lbl-coach',
                    '#award-lbl-groups'
                ].forEach((sel) => reflowLabelStackLines(r.querySelector(sel)));

                r.querySelectorAll('.award-group-name').forEach((el) => {
                    const t = (el.textContent || '').replace(/\s+/g, ' ').trim();
                    self.enableMarqueeIfNeeded(el, t, mqAward);
                });
                r.querySelectorAll('.award-group-medal').forEach((el) => {
                    /* 中英双 span 由 CSS flex 左起成组；勿对整块跑跑马灯（测量用父级字号会与子级不一致，引发 Bronze 等抖动） */
                    if (el.querySelector('.award-group-medal-cn')) {
                        return;
                    }
                    const plain = (el.textContent || '').replace(/\s+/g, ' ').trim();
                    const htmlFit = el.innerHTML;
                    self.enableMarqueeIfNeeded(el, plain, { ...mqAward, htmlWhenFit: htmlFit });
                });
            } catch (e) {
                /* ignore */
            }
        };
        const kick = () => {
            requestAnimationFrame(() => {
                requestAnimationFrame(runInner);
            });
        };
        if (typeof document !== 'undefined' && document.fonts && document.fonts.ready && typeof document.fonts.ready.then === 'function') {
            document.fonts.ready.then(kick).catch(kick);
        } else {
            kick();
        }
    }

    /**
     * 各 group 奖项摘要 HTML（供其它调用方拼接列表项）
     */
    BuildTeamGroupAwardSummary(team_id) {
        return this.GetTeamGroupAwardList(team_id).map((one) => this.BuildTeamGroupAwardItemHtml(one)).join('');
    }

    showAwardPlaceholder(placeholderElement, award) {
        const emojiMap = { gold: '🥇', silver: '🥈', bronze: '🥉' };
        const emoji = emojiMap[award] || '🏆';
        if (placeholderElement) {
            placeholderElement.textContent = emoji;
            placeholderElement.className = `award-photo-placeholder award-photo-placeholder-${award}`;
        }
    }

    GetAwardName(award) {
        const names = { gold: '金奖', silver: '银奖', bronze: '铜奖' };
        return names[award] || '';
    }

    /**
     * 显示获奖（全屏 overlay，DOM 由 roll_award_overlay.js 挂载；勿用 #award-modal / modal-content）
     * @returns {boolean} 是否已成功调用 present（失败时调用方不得把 currentRollStep 置为 award_open）
     */
    ShowAward(team_id, award) {
        const team = this.teamMap[team_id];
        if (!team) return false;
        const teamData = this.rollDataMap ? this.rollDataMap.get(team_id) : null;
        if (!teamData) return false;
        if (typeof RollAwardOverlay === 'undefined') {
            return false;
        }
        RollAwardOverlay.ensureReady();
        const root = RollAwardOverlay.getRoot();
        if (!root) return false;

        this._stopAwardGroupStepScroll();

        const awardSchool = root.querySelector('#award-school');
        const awardTeamName = root.querySelector('#award-team-name');
        const awardTeamEn = root.querySelector('#award-team-en');
        const awardMembers = root.querySelector('#award-members');
        const awardCoach = root.querySelector('#award-coach');
        const awardRank = root.querySelector('#award-rank');
        const awardSolved = root.querySelector('#award-solved');
        const awardPhoto = root.querySelector('#award-team-photo');
        const awardPhotoPlaceholder = root.querySelector('#award-photo-placeholder');
        const awardDetailsCard = root.querySelector('.award-details-card');
        const awardSchoolLogo = root.querySelector('#award-school-logo');

        const lblSchool = root.querySelector('#award-lbl-school');
        const lblTeam = root.querySelector('#award-lbl-team');
        const lblMembers = root.querySelector('#award-lbl-members');
        const lblCoach = root.querySelector('#award-lbl-coach');
        const lblRankCn = root.querySelector('#award-lbl-rank-cn');
        const lblRankEn = root.querySelector('#award-lbl-rank-en');
        const lblSolvedCn = root.querySelector('#award-lbl-solved-cn');
        const lblSolvedEn = root.querySelector('#award-lbl-solved-en');
        const lblTeamEn = root.querySelector('#award-lbl-team-en');
        if (lblSchool) lblSchool.innerHTML = this.CreateRollAwardLabelStack('院校/组织', 'School / Organization');
        if (lblTeam) lblTeam.innerHTML = this.CreateRollAwardLabelStack('队名', 'Team');
        if (lblTeamEn) lblTeamEn.innerHTML = this.CreateRollAwardLabelStack('第二语言队名', 'Alt. team name');
        if (lblMembers) lblMembers.innerHTML = this.CreateRollAwardLabelStack('成员', 'Members');
        if (lblCoach) lblCoach.innerHTML = this.CreateRollAwardLabelStack('教练', 'Coach');
        if (lblRankCn) lblRankCn.textContent = '全场排名';
        if (lblRankEn) lblRankEn.textContent = 'Overall rank';
        if (lblSolvedCn) lblSolvedCn.textContent = '解题数';
        if (lblSolvedEn) lblSolvedEn.textContent = 'Solved';

        if (awardDetailsCard) {
            awardDetailsCard.setAttribute('data-award-tier', award);
            awardDetailsCard.style.removeProperty('--award-bg-image');
        }

        let schoolHtmlFit = null;
        let schoolPlain = '';
        if (team.school) {
            schoolPlain = team.school;
            if (awardSchool) {
                awardSchool.textContent = schoolPlain;
            }
        } else {
            schoolHtmlFit = this.CreateBilingualText('未知学校/组织', 'Unknown School/Organization');
            const schoolTmp = document.createElement('div');
            schoolTmp.innerHTML = schoolHtmlFit;
            schoolPlain = (schoolTmp.textContent || '').replace(/\s+/g, ' ').trim();
            if (awardSchool) {
                awardSchool.innerHTML = schoolHtmlFit;
            }
        }

        const teamTitle = team.name || String(team_id);
        const teamEnTrim = team.name_en && String(team.name_en).trim() ? String(team.name_en).trim() : '';
        if (awardTeamName) {
            awardTeamName.textContent = teamTitle;
        }
        this.applyRollAwardOptionalRow('award-team-en-row', lblTeamEn, awardTeamEn, teamEnTrim, true);
        this.applyRollAwardOptionalRow('award-members-row', lblMembers, awardMembers, team.tmember || '', true);
        this.applyRollAwardOptionalRow('award-coach-row', lblCoach, awardCoach, team.coach || '', true);

        const rankStr = this.GetOverallContestRankForOverlay(team_id);
        const solvedStr = teamData.solved;
        if (awardRank) awardRank.textContent = rankStr;
        if (awardSolved) awardSolved.textContent = solvedStr;

        const firstBloodList = this.GetFirstBloodList(team_id);
        const hasFirstBlood = firstBloodList && firstBloodList !== null && firstBloodList !== '-';
        this.applyRollAwardFbStatCell(root, firstBloodList, hasFirstBlood);

        this.RefreshAwardGroupPanel(team_id, root);

        if (awardSchoolLogo && team.school) {
            awardSchoolLogo.setAttribute('data-school', team.school);
            awardSchoolLogo.classList.remove('has-background');
            this.LoadAwardSchoolLogo(awardSchoolLogo, team.school);
        } else if (awardSchoolLogo) {
            awardSchoolLogo.removeAttribute('data-school');
            awardSchoolLogo.style.setProperty('--rank-school-logo-bg', 'none');
            awardSchoolLogo.classList.remove('has-background');
            if (typeof RankToolDisconnectSchoolBadgeResizeObserver === 'function') {
                RankToolDisconnectSchoolBadgeResizeObserver(awardSchoolLogo, '--roa-badge-bg-size');
            }
        }

        if (awardPhoto && awardPhotoPlaceholder) {
            const base = this.config.team_photo_url || '';
            const urls = (typeof RankToolTeamPhotoUrls === 'function')
                ? RankToolTeamPhotoUrls(base, team_id)
                : { webp: `${base}/${team_id}.webp`, jpg: `${base}/${team_id}.jpg` };
            this.showAwardPlaceholder(awardPhotoPlaceholder, award);
            awardPhoto.style.display = 'none';
            awardPhotoPlaceholder.style.display = 'flex';
            let photoPhase = 0;
            awardPhoto.onload = () => {
                awardPhoto.style.display = 'block';
                awardPhotoPlaceholder.style.display = 'none';
            };
            awardPhoto.onerror = () => {
                if (photoPhase === 0) {
                    photoPhase = 1;
                    awardPhoto.src = urls.jpg;
                    return;
                }
                awardPhoto.style.display = 'none';
                awardPhotoPlaceholder.style.display = 'flex';
            };
            awardPhoto.src = urls.webp;
        }

        RollAwardOverlay.present();
        this._scheduleRollAwardMarqueeReflow({
            root,
            awardSchool,
            schoolPlain,
            schoolHtmlFit,
            awardTeamName,
            teamTitle,
            awardTeamEn,
            teamEnTrim,
            awardMembers,
            awardCoach,
            awardRank,
            awardSolved,
            rankStr,
            solvedStr,
            team
        });
        return true;
    }

    /**
     * 旧赛无 contest_group 时，用赛事全局 award_ratio 合成虚拟默认归属（与 PHP 存库打包规则一致）。
     * @returns {{ group_id: string, group_name: string, award_ratio_gold: number, award_ratio_silver: number, award_ratio_bronze: number, __csgVirtualDefault: true }}
     */
    _BuildVirtualDefaultContestGroupForAward() {
        const contest = this.data?.contest || {};
        const r = RankToolParseAwardRatio(contest.award_ratio);
        return {
            group_id: '__csg_virtual_default_group__',
            group_name: '',
            award_ratio_gold: r.gold,
            award_ratio_silver: r.silver,
            award_ratio_bronze: r.bronze,
            __csgVirtualDefault: true
        };
    }

    _GetAwardQtyModeForRoll() {
        return parseInt(this.data?.contest?.flg_award_qty_mode, 10) === 1 ? 1 : 0;
    }

    /**
     * 各赛事归属下的名次与奖项（供滚榜获奖 overlay 使用）。
     * - 无 contest_group：按赛事全局 award_ratio 虚拟默认归属，算一行；UI 不展示归属名。
     * - 仅 1 个归属：全队归入该组，算一行；UI 不展示归属名。
     * - ≥2 个归属：按归属列出（仍受 selectedGroupIds 与队伍 group_ids 约束）；行数据仍含该归属内名次 rank（供逻辑用），获奖条 UI 仅展示奖级中英、不展示「#名次」。
     */
    GetTeamGroupAwardList(team_id) {
        const rawGroups = this.GetContestGroups();
        const team = this.teamMap[team_id];
        if (!team) return [];
        const qtyMode = this._GetAwardQtyModeForRoll();

        const pushRow = (group, hideGroupName) => {
            const one = this.CalcGroupRankForTeam(team_id, group, qtyMode);
            if (!one) return null;
            return {
                groupName: hideGroupName ? '' : (group.group_name || group.group_id || ''),
                groupId: String(group.group_id || ''),
                hideGroupName: !!hideGroupName,
                rank: one.rank,
                awardClass: one.awardClass,
                awardNameHtml: one.awardName,
                awardCn: one.awardCn,
                awardEn: one.awardEn
            };
        };

        if (rawGroups.length >= 2) {
            const teamGroupIds = Array.isArray(team.group_ids) ? team.group_ids : [];
            const selected = (Array.isArray(this.selectedGroupIds) && this.selectedGroupIds.length > 0)
                ? this.selectedGroupIds
                : rawGroups.map((g) => g.group_id);
            const rows = [];
            rawGroups.forEach((group) => {
                if (!selected.includes(group.group_id)) return;
                if (!teamGroupIds.includes(group.group_id)) return;
                const row = pushRow(group, false);
                if (row) rows.push(row);
            });
            return rows;
        }

        const pseudo =
            rawGroups.length === 1
                ? { ...rawGroups[0], __csgSingleGroupAllTeams: true }
                : this._BuildVirtualDefaultContestGroupForAward();
        if (!pseudo || !pseudo.group_id) return [];
        const row = pushRow(pseudo, true);
        return row ? [row] : [];
    }

    /**
     * 在给定归属（或虚拟默认 / 单归属全队）子集上重算排序与 displayRank，返回的 rank 为该子集内名次；
     * 子集成员取自全量 this.rankList（不受 selectedGroupIds 的榜单过滤影响），与 overlay 左栏全场排名口径分离。
     */
    CalcGroupRankForTeam(team_id, group, qtyMode) {
        // 打星口径与当前滚榜 starMode 一致；不按 selectedGroupIds 缩窄 rankList
        const starMode = parseInt(this.starMode || 0);
        const useWholeList =
            group.__csgVirtualDefault === true || group.__csgSingleGroupAllTeams === true;
        const inGroup = useWholeList
            ? this.rankList
            : this.rankList.filter(item => {
                const gids = Array.isArray(item.team?.group_ids) ? item.team.group_ids : [];
                return RankToolGroupIdsIncludes(gids, group.group_id);
            });
        const ranked = [];
        inGroup.forEach(item => {
            const copied = { ...item, isStar: false };
            if (copied.team?.tkind === 2) {
                if (starMode === 1) return;
                copied.isStar = (starMode === 0);
            }
            ranked.push(copied);
        });
        ranked.sort((a, b) => this.CompareTeamsForRanking(a, b));
        const withRank = this.CalculateRankInfo(ranked);
        const hit = withRank.find(x => x.team_id === team_id);
        if (!hit || hit.displayRank === '*' || !hit.displayRank) return null;
        const validTeamNum = withRank.filter(x => x.solved > 0 && !x.isStar).length;
        const mode = qtyMode === undefined ? this._GetAwardQtyModeForRoll() : (qtyMode === 1 ? 1 : 0);
        const ratio = RankToolGetAwardRank(
            validTeamNum,
            parseInt(group.award_ratio_gold || 10),
            parseInt(group.award_ratio_silver || 15),
            parseInt(group.award_ratio_bronze || 20),
            mode
        );
        let awardClass = 'none';
        let awardCn = '未获奖';
        let awardEn = 'No Award';
        if (hit.displayRank <= ratio.rankGold) {
            awardClass = 'gold';
            awardCn = '金奖';
            awardEn = 'Gold';
        } else if (hit.displayRank <= ratio.rankSilver) {
            awardClass = 'silver';
            awardCn = '银奖';
            awardEn = 'Silver';
        } else if (hit.displayRank <= ratio.rankBronze) {
            awardClass = 'bronze';
            awardCn = '铜奖';
            awardEn = 'Bronze';
        }
        const awardName = this.CreateBilingualText(awardCn, awardEn);
        return { rank: hit.displayRank, awardClass, awardName, awardCn, awardEn };
    }

    /**
     * 获奖全屏 overlay 左栏「全场排名」：在全量榜单上算名次，不受当前赛事归属筛选影响；
     * 打星口径仍与当前滚榜 starMode 一致（与 rollData 的打星语义对齐）。
     */
    GetOverallContestRankForOverlay(team_id) {
        if (!this.rankList || this.rankList.length === 0) {
            return '-';
        }
        const starMode = parseInt(this.starMode || 0);
        const ranked = [];
        this.rankList.forEach(item => {
            const copied = { ...item, isStar: false };
            if (copied.team?.tkind === 2) {
                if (starMode === 1) return;
                copied.isStar = starMode === 0;
            }
            ranked.push(copied);
        });
        ranked.sort((a, b) => this.CompareTeamsForRanking(a, b));
        const withRank = this.CalculateRankInfo(ranked);
        const hit = withRank.find(x => x.team_id === team_id);
        if (!hit || hit.displayRank === '*' || hit.displayRank == null) {
            return '-';
        }
        return hit.displayRank;
    }
    
    /**
     * 获取当前排名
     * 关键修复：通过 CalculateRankInfo 获取正确的 displayRank，而不是使用错误的 team.rank
     */
    GetCurrentRank(team_id) {
        if (!this.rollData || this.rollData.length === 0) {
            return '-';
        }
        const rollTeamItem = this.rollDataMap.get(team_id);
        if (!rollTeamItem) {
            return '-';
        }
        // 使用 CalculateRankInfo 获取正确的排名
        return rollTeamItem.displayRank;
    }
    
    /**
     * 显示模态框
     */
    ShowModal(type) {
        if (type !== 'rollHelp') return;
        const modal = this.container.querySelector('#roll-help-modal');
        if (modal) {
            modal.style.display = 'flex';
            this._syncRollModalStackingOverToolbar();
        }
    }
    
    /**
     * 隐藏模态框
     */
    HideModal(type) {
        if (type === 'award') {
            this._stopAwardGroupStepScroll();
            if (typeof RollAwardOverlay !== 'undefined') {
                const roaRoot = RollAwardOverlay.getRoot && RollAwardOverlay.getRoot();
                this._disconnectRollAwardMarqueeResize(roaRoot);
                RollAwardOverlay.hide();
            }
        } else if (type === 'rollHelp') {
            const modal = this.container.querySelector('#roll-help-modal');
            if (modal) {
                modal.style.display = 'none';
            }
            this._syncRollModalStackingOverToolbar();
        }
        
        // 如果是获奖 overlay 关闭，且当前在 award_close 步骤，标记为已关闭
        // 注意：不要在HideModal中自动继续，让RollNextStep控制流程
        if (type === 'award' && this.currentRollStep === 'award_close' && this.isRolling) {
            // overlay 已关闭，由 RollNextStep 控制后续，勿在此自动步进
        }
        
        // 兼容旧路径 currentRollStep === 'award'（非 overlay）
        if (type === 'award' && this.currentRollStep === 'award' && this.isRolling) {
            this.currentRollStep = null;
            this.ClearJudgingHighlight();
            
            // 自动模式下延迟后继续
            this.TryAutoRolling('JudgeConfirm');
        }
    }
    
    /**
     * 显示滚榜帮助
     */
    ShowRollHelp() {
        this.ShowModal('rollHelp');
    }
    
    /**
     * 自动滚榜开启时：除调速（W/S）、恢复默认间隔（R）、自动开关（A）外，
     * 任意其它滚榜快捷键一律立即关闭自动（避免与手动单步抢节奏）。
     */
    _stopAutoRollingOnNonParameterKey(key) {
        if (!this.isAutoRolling) {
            return;
        }
        const allowWhileAuto = new Set(['w', 'W', 's', 'S', 'r', 'R', 'a', 'A']);
        if (allowWhileAuto.has(key)) {
            return;
        }
        this.isAutoRolling = false;
        this.pendingAutoRoll = false;
        this.ShowKeyHint('关闭自动滚榜', 'A');
    }

    _GetRollShortcutAction(key) {
        switch (key) {
            case 'n':
            case 'N':
            case ' ':
            case 'Space':
                return 'next';
            case 'Enter':
                return 'enter';
            case 'f':
            case 'F':
                return 'award_jump';
            case 'g':
            case 'G':
                return 'forward_10';
            case 'Backspace':
            case 'u':
            case 'U':
                return 'undo';
            case 'i':
            case 'I':
                return 'back_10';
            case 'w':
            case 'W':
                return 'speed_up';
            case 's':
            case 'S':
                return 'speed_down';
            case 'r':
            case 'R':
                return 'speed_reset';
            case 'a':
            case 'A':
                return 'auto_toggle';
            default:
                return null;
        }
    }

    _IsRollParameterAction(action) {
        return action === 'speed_up' ||
            action === 'speed_down' ||
            action === 'speed_reset' ||
            action === 'auto_toggle';
    }

    _IsRollIntroAbortAction(action) {
        return action === 'next' ||
            action === 'enter' ||
            action === 'award_jump' ||
            action === 'forward_10' ||
            action === 'undo' ||
            action === 'back_10';
    }

    _PreventRollShortcutDefault(e, action) {
        // Space/Enter/Backspace have browser defaults; operational shortcuts should never leak to the page.
        if (action === 'next' ||
            action === 'enter' ||
            action === 'award_jump' ||
            action === 'forward_10' ||
            action === 'undo' ||
            action === 'back_10') {
            e.preventDefault();
        }
    }

    _DispatchRollShortcutAction(action, e) {
        if (!action) {
            return false;
        }
        this._PreventRollShortcutDefault(e, action);

        switch (action) {
            case 'next':
                this.RollNext();
                return true;
            case 'enter':
            case 'award_jump':
                void this.FastSkipToAwardArea();
                return true;
            case 'forward_10':
                void this.JumpForward10Teams();
                return true;
            case 'undo':
                void this.RollUndo();
                return true;
            case 'back_10':
                void this.JumpBack10Teams();
                return true;
            case 'speed_up': {
                const oldSpeed = this.autoSpeed;
                this.RollSpeedUp();
                if (this.autoSpeed < oldSpeed) {
                    this.ShowKeyHint(`加速: ${this.autoSpeed}ms (${this.rollSpeedMultiplier.toFixed(1)}x)`, 'W');
                }
                return true;
            }
            case 'speed_down': {
                const oldSpeed = this.autoSpeed;
                this.RollSpeedDown();
                if (this.autoSpeed > oldSpeed) {
                    this.ShowKeyHint(`减速: ${this.autoSpeed}ms (${this.rollSpeedMultiplier.toFixed(1)}x)`, 'S');
                }
                return true;
            }
            case 'speed_reset':
                this.RollResetSpeed();
                this.ShowKeyHint(`恢复默认速度: ${this.autoSpeed}ms`, 'R');
                return true;
            case 'auto_toggle':
                this.ToggleAutoRoll();
                return true;
            default:
                return false;
        }
    }

    /**
     * 处理滚榜键盘事件
     */
    HandleRollKeydown(e) {
        if (!this.isRolling) {
            return;
        }
        const action = this._GetRollShortcutAction(e.key);
        this._dbg('keyboard', 'HandleRollKeydown', {
            key: e.key,
            action,
            step: this.currentRollStep,
            idx: this.currentJudgingIndex
        });
        this._stopAutoRollingOnNonParameterKey(e.key);

        // 启动动画进行中：所有"推进/跳转"类动作都只触发"快滚到底"中断；
        // 速度/自动等参数动作仍可即时生效。
        if (this.currentRollStep === 'intro_scroll') {
            if (this._IsRollIntroAbortAction(action)) {
                e.preventDefault();
                this._introScrollAborted = true;
                return;
            }
            if (this._IsRollParameterAction(action)) {
                this._DispatchRollShortcutAction(action, e);
                return;
            }
            return;
        }

        // 等待首次 N：N（含等价键）进入正式定位；F 与正式流程一致，可直接跳奖区（FastSkip 内会清 step）。
        // G/U/I/Backspace 仍忽略，避免未锁定第一队就跳 10 队/撤回；参数动作照常生效。
        if (this.currentRollStep === 'wait_first_n') {
            if (action === 'next' || action === 'enter') {
                this._PreventRollShortcutDefault(e, action);
                this.RollNext();
                return;
            }
            if (action === 'award_jump' || this._IsRollParameterAction(action)) {
                this._DispatchRollShortcutAction(action, e);
                return;
            }
            if (action) e.preventDefault();
            return;
        }

        this._DispatchRollShortcutAction(action, e);
    }
    
    /**
     * 获取滚榜数据
     */
    getRollData() {
        return this.rollData;
    }
    
    /**
     * 导出离线滚榜包
     */
    async ExportOfflineRoll() {
        if (!window.RankToolExportOfflineRollPack) {
            this.ShowMessage('导出功能未加载，请刷新页面重试');
            return;
        }
        
        if (!this.data) {
            this.ShowMessage('数据未加载，无法导出');
            return;
        }
        
        // 显示进度模态框
        const progressOverlay = document.createElement('div');
        progressOverlay.id = 'export-offline-progress-overlay';
        progressOverlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100vw;
            height: 100vh;
            background: rgba(0, 0, 0, 0.7);
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            z-index: 100000;
            backdrop-filter: blur(4px);
        `;
        
        const progressContainer = document.createElement('div');
        progressContainer.style.cssText = `
            background: white;
            padding: 32px 48px;
            border-radius: 12px;
            box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
            min-width: 400px;
            max-width: 600px;
        `;
        
        progressContainer.innerHTML = `
            <div style="margin-bottom: 20px; font-size: 18px; font-weight: 600; color: #333;">
                ${this.CreateBilingualText('正在导出离线滚榜包...', 'Exporting Offline Roll Pack...')}
            </div>
            <div style="width: 100%; height: 24px; background: #e9ecef; border-radius: 6px; overflow: hidden; margin-bottom: 12px;">
                <div id="export-offline-progress-bar" style="width: 0%; height: 100%; background: linear-gradient(90deg, #3b82f6, #2563eb); transition: width 0.3s ease; border-radius: 6px;"></div>
            </div>
            <div id="export-offline-progress-text" style="font-size: 14px; color: #666; text-align: center;">
                ${this.CreateBilingualText('准备中...', 'Preparing...')}
            </div>
        `;
        
        progressOverlay.appendChild(progressContainer);
        document.body.appendChild(progressOverlay);
        
        try {
            // 进度回调
            const progressCallback = (message, progress) => {
                const progressBar = document.getElementById('export-offline-progress-bar');
                const progressText = document.getElementById('export-offline-progress-text');
                if (progressBar && progressText) {
                    const percentage = Math.min(100, Math.round(progress));
                    progressBar.style.width = `${percentage}%`;
                    progressText.textContent = message || `${this.CreateBilingualText('处理中', 'Processing')}: ${percentage}%`;
                }
            };
            
            // 调用导出功能
            const zipBlob = await window.RankToolExportOfflineRollPack(this, progressCallback);
            
            // 生成下载链接
            const url = URL.createObjectURL(zipBlob);
            const a = document.createElement('a');
            a.href = url;
            
            // 生成文件名：滚榜离线包-<比赛标题>-<14位时间戳>.zip
            const contestTitle = this.data?.contest?.title || '滚榜';
            const sanitizedTitle = window.RankToolSanitizeFilename ? window.RankToolSanitizeFilename(contestTitle) : contestTitle.replace(/[<>:"/\\|?*]+/g, '-').replace(/\s+/g, '_');
            const timestamp = window.RankToolGenerateTimestamp14 ? window.RankToolGenerateTimestamp14() : new Date().toISOString().slice(0, 19).replace(/[:-]/g, '').slice(0, 14);
            a.download = `滚榜离线包-${sanitizedTitle}-${timestamp}.zip`;
            
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            // 移除进度模态框
            progressOverlay.remove();
            
            this.ShowMessage(this.CreateBilingualText('导出成功！', 'Export successful!'));
        } catch (error) {
            console.error('导出离线滚榜包失败:', error);
            progressOverlay.remove();
            this.ShowMessage(this.CreateBilingualText('导出失败：' + error.message, 'Export failed: ' + error.message));
        }
    }
}

// 导出到全局
if (typeof window !== 'undefined') {
    window.RankRollSystem = RankRollSystem;
}

