/**
 * expsys 教学实验系统榜单
 * 基于 Bootstrap Table（原生 table，不使用 BootstrapTable 插件）
 * 继承 RankSystem 处理数据，直接操作 DOM 渲染
 */

// 确保 RankSystem 已加载
if(typeof RankSystem == 'undefined') {
    console.error('RankSystem is required but not loaded');
}

/**
 * ExpRankSystem - 继承 RankSystem，专门用于 expsys 的素雅榜单
 */
if(typeof ExpRankSystem == 'undefined') {
    class ExpRankSystem extends RankSystem {
        constructor(containerId, config = {}) {
            // 设置默认配置：不显示炫酷效果，专注于信息清晰
            const defaultConfig = {
                flg_show_page_contest_title: true,
                flg_show_fullscreen_contest_title: false,
                flg_rank_cache: true,
                flg_show_time_progress: false,
                flg_show_controls_toolbar: false,
                flg_show_team_id: false
            };
            // 合并配置，确保传入的 config 中的 cid_list 和 key 不会被覆盖
            const mergedConfig = RankToolMergeConfig(defaultConfig, config);
            // 确保 cid_list 和 key 配置被保留（如果传入的 config 中有这些值）
            if (config.cid_list !== undefined) {
                mergedConfig.cid_list = config.cid_list;
            }
            if (config.key !== undefined) {
                mergedConfig.key = config.key;
            }
            if (config.api_url !== undefined) {
                mergedConfig.api_url = config.api_url;
            }
            
            // 必须先调用 super() 才能访问 this
            super(containerId, mergedConfig);
            
            // 先设置 externalMode，防止父类构造函数中的 Init() 调用 LoadData()
            // 注意：由于父类构造函数会调用 Init()，我们需要在 Init() 中处理
            this.externalMode = true;
            
            // DOM 元素引用
            this.tableElement = null;
            this.theadElement = null;
            this.tbodyElement = null;
            this.rankData = []; // 存储格式化后的榜单数据
            // 固定表头相关
            this.fixedHeaderWrapper = null;
            this.fixedHeaderTable = null;
            this.scrollHandler = null;
            this.resizeHandler = null;
            // 键盘事件相关
            this.keydownHandler = null;
            // 标记是否已加载数据，防止重复加载
            this._dataLoaded = false;
        }
        
        /**
         * 重写 Init 方法：初始化 DOM 引用
         */
        Init() {
            // 先设置 externalMode，防止父类 Init 调用 LoadData
            this.externalMode = true;
            
            // 初始化缓存管理器（如果父类没有初始化）
            if (!this.cache) {
                this.cache = new IndexedDBCache('csgoj_rank', 'logotable');
            }
            
            // 初始化 DOM 引用
            this.tableElement = document.getElementById(this.containerId);
            
            if (this.tableElement) {
                this.theadElement = this.tableElement.querySelector('thead');
                this.tbodyElement = this.tableElement.querySelector('tbody');
                
                if (!this.tbodyElement) {
                    // 如果没有 tbody，创建一个
                    this.tbodyElement = document.createElement('tbody');
                    this.tableElement.appendChild(this.tbodyElement);
                }
            }
            
            // 检查是否已经加载过数据（防止重复加载）
            if (this._dataLoaded) {
                return;
            }
            
            // 标记正在加载，防止重复调用
            this._dataLoaded = true;
            
            // 初始化缓存，然后加载数据
            this.cache.init().then(() => {
                // 再次检查 DOM 元素（可能在异步操作期间 DOM 已准备好）
                this.ensureDOMElements();
                this.LoadData();
            }).catch(error => {
                // 即使缓存初始化失败，也尝试加载数据
                this.ensureDOMElements();
                this.LoadData();
            });
            
            // 初始化键盘事件监听（F5 刷新）
            this.initKeyboardListener();
        }
        
        /**
         * 确保 DOM 元素已准备好（在异步操作后调用）
         */
        ensureDOMElements() {
            if (!this.tableElement) {
                this.tableElement = document.getElementById(this.containerId);
            }
            
            if (this.tableElement && !this.tbodyElement) {
                this.tbodyElement = this.tableElement.querySelector('tbody');
                if (!this.tbodyElement) {
                    this.tbodyElement = document.createElement('tbody');
                    this.tableElement.appendChild(this.tbodyElement);
                }
            }
            
            if (this.tableElement && !this.theadElement) {
                this.theadElement = this.tableElement.querySelector('thead');
            }
        }
        
        /**
         * 重写 OriInit 方法：处理数据并更新表格
         */
        OriInit(raw_data) {
            this.data = raw_data;
            // 将 list 格式转换为 dict 格式
            this.ConvertListToDict();
            // 处理数据
            this.ProcessData();
            // 更新表格
            this.UpdateTable();
            // 隐藏加载提示（调用父类方法，但 externalMode 下可能无效，所以 UpdateTable 中的回调会处理）
            this.HideLoading();
        }
        
        /**
         * 重写 HideLoading 方法，在 externalMode 下手动隐藏加载提示
         */
        HideLoading() {
            // 调用父类方法
            super.HideLoading();
            // externalMode 下手动隐藏加载提示
            if (this.externalMode) {
                const loadingEl = document.getElementById('rank-loading');
                if (loadingEl) {
                    loadingEl.style.display = 'none';
                }
                // 显示表格
                const tableEl = document.getElementById('rank-table');
                if (tableEl) {
                    tableEl.style.display = '';
                }
            }
        }
        
        /**
         * 将 RankSystem 的 rankList 转换为表格行数据
         */
        ConvertToTableData() {
            if (!this.rankList || this.rankList.length === 0) {
                return [];
            }
            
            // 应用打星过滤
            const filteredList = this.FilterByStarMode(this.rankList, this.starMode);
            // 计算排名信息
            const rankedList = this.CalculateRankInfo(filteredList);
            
            return rankedList;
        }
        
        /**
         * 创建表头行（包含题目列）
         */
        CreateTableHeader() {
            if (!this.theadElement) return;
            
            // 清空现有表头
            this.theadElement.innerHTML = '';
            
            const tr = document.createElement('tr');
            
            // 基础列（中英双语）
            const baseColumns = [
                { 
                    field: 'rank', 
                    titleCn: '排名', 
                    titleEn: 'Rank', 
                    width: '60px', 
                    align: 'center' 
                },
                { 
                    field: 'name_unit', 
                    titleCn: '姓名', 
                    titleEn: 'Name', 
                    width: '100px', 
                    align: 'left' 
                },
                { 
                    field: 'solved', 
                    titleCn: '解题数', 
                    titleEn: 'Solved', 
                    width: '80px', 
                    align: 'center' 
                },
                { 
                    field: 'penalty', 
                    titleCn: '罚时', 
                    titleEn: 'Penalty', 
                    width: '120px', 
                    align: 'center' 
                }
            ];
            
            baseColumns.forEach(col => {
                const th = document.createElement('th');
                // 中英双语显示
                th.innerHTML = `
                    <div class="header-bilingual">
                        <div class="header-cn">${col.titleCn}</div>
                        <div class="header-en text-muted small">${col.titleEn}</div>
                    </div>
                `;
                th.style.width = col.width;
                th.style.textAlign = col.align;
                th.setAttribute('data-field', col.field);
                tr.appendChild(th);
            });
            
            // 添加题目列（可点击，跳转到题目页面）
            if (this.problemMap && Object.keys(this.problemMap).length > 0) {
                const problemIds = Object.keys(this.problemMap).sort((a, b) => 
                    this.problemMap[a].num - this.problemMap[b].num
                );
                
                // 获取模块和比赛ID（用于构建题目链接）
                const config = window.RANK_CONFIG || this.config || {};
                const contestId = config.key || config.cid_list || '';
                // 从 api_url 提取模块名，例如 '/expsys/contest/contest_data_ajax' -> 'expsys'
                let module = 'expsys'; // 默认值
                if (config.api_url) {
                    const match = config.api_url.match(/\/([^\/]+)\//);
                    if (match) {
                        module = match[1];
                    }
                }
                
                problemIds.forEach(problemId => {
                    const problem = this.problemMap[problemId];
                    const problemAlphabetIdx = RankToolGetProblemAlphabetIdx(problem.num);
                    
                    const th = document.createElement('th');
                    th.style.width = '80px';
                    th.style.textAlign = 'center';
                    th.setAttribute('data-field', `problem_${problemId}`);
                    th.setAttribute('title', `点击查看题目 ${problemAlphabetIdx} / Click to view Problem ${problemAlphabetIdx}`);
                    
                    // 创建可点击的链接
                    const link = document.createElement('a');
                    link.href = `/${module}/contest/problem?cid=${contestId}&pid=${encodeURIComponent(problemAlphabetIdx)}`;
                    link.className = 'problem-header-link';
                    link.textContent = problemAlphabetIdx;
                    link.style.cssText = `
                        display: inline-block;
                        font-size: 1.1em;
                        font-weight: 600;
                        color: #0d6efd;
                        text-decoration: none;
                        padding: 4px 8px;
                        border-radius: 4px;
                        transition: all 0.2s ease;
                    `;
                    
                    // 悬停效果
                    link.addEventListener('mouseenter', function() {
                        this.style.backgroundColor = '#e7f1ff';
                        this.style.color = '#0a58ca';
                        this.style.transform = 'scale(1.1)';
                    });
                    link.addEventListener('mouseleave', function() {
                        this.style.backgroundColor = 'transparent';
                        this.style.color = '#0d6efd';
                        this.style.transform = 'scale(1)';
                    });
                    
                    th.appendChild(link);
                    tr.appendChild(th);
                });
            }
            
            this.theadElement.appendChild(tr);
        }
        
        /**
         * 格式化罚时（支持长时显示，包括天）
         */
        FormatPenalty(seconds) {
            if (seconds == null || isNaN(seconds)) return { brief: '0', full: '0天 0:00:00' };
            
            const days = Math.floor(seconds / 86400);
            const hours = Math.floor((seconds % 86400) / 3600);
            const minutes = Math.floor((seconds % 3600) / 60);
            const remainingSeconds = seconds % 60;
            
            let brief = '';
            let full = '';
            
            if (days > 0) {
                brief = `${days}天 ${hours}:${minutes.toString().padStart(2, '0')}`;
                full = `${days}天 ${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
            } else if (hours > 0) {
                brief = `${hours}:${minutes.toString().padStart(2, '0')}`;
                full = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
            } else {
                brief = `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
                full = `0:${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
            }
            
            return { brief, full };
        }
        
        /**
         * 创建表格行
         */
        CreateTableRow(item, index) {
            const tr = document.createElement('tr');
            if (index % 2 === 0) {
                tr.classList.add('table-light');
            }
            
            // 排名
            const tdRank = document.createElement('td');
            tdRank.style.textAlign = 'center';
            tdRank.innerHTML = item.isStar ? '<span class="text-muted">*</span>' : (item.displayRank || '');
            tr.appendChild(tdRank);
            
            // 姓名、学号、单位（合并到一列，三行显示）
            const tdNameUnit = document.createElement('td');
            tdNameUnit.style.width = '150px';
            tdNameUnit.style.wordWrap = 'break-word';
            tdNameUnit.style.wordBreak = 'break-all';
            let nameUnitHtml = '';
            
            // 姓名（第一行）
            const name = item.team.name || '';
            const userId = item.team_id || item.user_id || ''; // 学号（user_id 或 team_id）
            const unit = item.team.school || '';
            
            if (name) {
                nameUnitHtml += `<div class="name-text" style="font-weight: 500; margin-bottom: 2px;">${RankToolEscapeHtml(name)}</div>`;
            }
            
            // 学号（第二行，单独一行）
            if (userId) {
                nameUnitHtml += `<div class="user-id-text text-muted small" style="font-size: 0.8em; color: #6c757d; margin-bottom: 2px; font-family: 'Courier New', monospace;">${RankToolEscapeHtml(userId)}</div>`;
            }
            
            // 单位（第三行，单独一行）
            if (unit) {
                nameUnitHtml += `<div class="unit-text text-muted small" style="font-size: 0.875em;">${RankToolEscapeHtml(unit)}</div>`;
            }
            
            if (!name && !userId && !unit) {
                nameUnitHtml += '<span class="text-muted">-</span>';
            }
            
            tdNameUnit.innerHTML = nameUnitHtml;
            tr.appendChild(tdNameUnit);
            
            // 解题数
            const tdSolved = document.createElement('td');
            tdSolved.style.textAlign = 'center';
            tdSolved.innerHTML = `<strong>${item.solved}</strong>`;
            tr.appendChild(tdSolved);
            
            // 罚时（支持长时显示）
            const tdPenalty = document.createElement('td');
            tdPenalty.style.textAlign = 'center';
            const penaltyFormatted = this.FormatPenalty(item.penalty);
            tdPenalty.innerHTML = `
                <div class="penalty-time" style="display: flex; flex-direction: column; align-items: center; gap: 2px;">
                    <div class="penalty-brief" style="font-weight: 600;">${penaltyFormatted.brief}</div>
                    <div class="penalty-full text-muted small" style="font-size: 0.75em;">${penaltyFormatted.full}</div>
                </div>
            `;
            tr.appendChild(tdPenalty);
            
            // 题目列
            if (this.problemMap && Object.keys(this.problemMap).length > 0) {
                const problemIds = Object.keys(this.problemMap).sort((a, b) => 
                    this.problemMap[a].num - this.problemMap[b].num
                );
                
                problemIds.forEach(problemId => {
                    const problem = this.problemMap[problemId];
                    const problemStats = item.problemStats || {};
                    const stats = problemStats[problemId] || {
                        status: 'none',
                        submitCount: 0,
                        lastSubmitTime: '',
                        problemAlphabetIdx: RankToolGetProblemAlphabetIdx(problem.num)
                    };
                    
                    const tdProblem = document.createElement('td');
                    tdProblem.style.textAlign = 'center';
                    tdProblem.innerHTML = this.FormatProblemCell(stats, item.team_id, problemId);
                    
                    // 如果有提交记录，添加点击事件
                    if (stats.submitCount > 0) {
                        tdProblem.style.cursor = 'pointer';
                        tdProblem.classList.add('problem-cell-clickable');
                        tdProblem.setAttribute('data-team-id', item.team_id);
                        tdProblem.setAttribute('data-problem-id', problemId);
                        tdProblem.setAttribute('data-problem-alphabet', stats.problemAlphabetIdx);
                        tdProblem.addEventListener('click', () => {
                            this.ShowSolutionModal(item.team_id, problemId, stats.problemAlphabetIdx);
                        });
                    }
                    
                    tr.appendChild(tdProblem);
                });
            }
            
            return tr;
        }
        
        /**
         * 格式化题目单元格（确保方块大小一致）
         */
        FormatProblemCell(stats, teamId = null, problemId = null) {
            const { status, submitCount, lastSubmitTime, problemAlphabetIdx } = stats;
            
            // 统一的最小高度和宽度，确保所有状态下的方块大小一致
            const cellStyle = 'min-height: 50px; min-width: 50px; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 4px;';
            
            // 如果有提交，添加悬停效果提示
            const hoverStyle = submitCount > 0 ? 'transition: transform 0.2s;' : '';
            const hoverHint = submitCount > 0 ? 'title="点击查看提交记录 / Click to view submissions"' : '';
            
            let html = '';
            let statusClass = '';
            
            switch (status) {
                case 'ac':
                    statusClass = 'problem-ac';
                    html = `
                        <div class="problem-status ${statusClass}" style="${cellStyle} ${hoverStyle}" ${hoverHint}>
                            <div class="problem-submit-count" style="font-weight: bold; font-size: 14px;">${submitCount}</div>
                            <div class="problem-time small" style="font-size: 10px; margin-top: 2px;">${lastSubmitTime || ''}</div>
                        </div>
                    `;
                    break;
                case 'wa':
                case 'pending':
                    statusClass = status === 'wa' ? 'problem-wa' : 'problem-pending';
                    // WA 和 pending 状态也保持相同高度，添加占位符确保布局一致
                    html = `
                        <div class="problem-status ${statusClass}" style="${cellStyle} ${hoverStyle}" ${hoverHint}>
                            <div class="problem-submit-count" style="font-weight: bold; font-size: 14px;">${submitCount}</div>
                            <div class="problem-time-placeholder" style="font-size: 10px; height: 12px; visibility: hidden;">占位</div>
                        </div>
                    `;
                    break;
                default:
                    html = `
                        <div class="problem-status problem-none" style="${cellStyle}">
                            <div style="font-size: 14px;">${problemAlphabetIdx || '?'}</div>
                            <div style="font-size: 10px; height: 12px; visibility: hidden;">占位</div>
                        </div>
                    `;
            }
            
            return html;
        }
        
        /**
         * 显示提交记录 Modal（使用 status table）
         */
        async ShowSolutionModal(teamId, problemId, problemAlphabet) {
            // 创建或获取 modal
            let modal = document.getElementById('exp-rank-solution-modal');
            if (!modal) {
                modal = this.CreateSolutionModal();
                document.body.appendChild(modal);
            }
            
            // 显示 modal
            const modalInstance = new bootstrap.Modal(modal);
            
            // 设置标题
            const modalTitle = modal.querySelector('#exp-solution-modal-title');
            if (modalTitle) {
                modalTitle.textContent = `提交记录 / Submissions - ${problemAlphabet}`;
            }
            
            // 设置查看详情按钮的跳转链接
            const viewStatusBtn = modal.querySelector('#exp-solution-view-status-btn');
            if (viewStatusBtn) {
                const config = window.EXP_RANK_MODAL_CONFIG || {};
                const module = config.module || 'expsys';
                const contestId = config.contest_id || this.config?.key || '';
                
                // 构建跳转 URL，使用锚参数筛选用户和题号
                // 锚参数格式：使用带 namespace 的格式（status_user_id, status_problem_id）
                // 注意：在 contest 模式下，problem_id 应该使用字母 ID（如 A, B, C）
                // 对 problemAlphabet 进行编码，确保特殊字符正确处理
                const prefix = 'status'; // status 页面的 prefix
                const statusUrl = `/${module}/contest/status?cid=${contestId}#${prefix}_user_id=${encodeURIComponent(teamId)}#${prefix}_problem_id=${encodeURIComponent(problemAlphabet)}`;
                viewStatusBtn.onclick = () => {
                    window.location.href = statusUrl;
                };
            }
            
            // 获取 modal body
            const modalBody = modal.querySelector('#exp-solution-modal-body');
            if (!modalBody) {
                return;
            }
            
            // 显示加载状态
            modalBody.innerHTML = `
                <div class="text-center py-4">
                    <div class="spinner-border text-primary" role="status">
                        <span class="visually-hidden">加载中...</span>
                    </div>
                    <div class="mt-2 text-muted">正在加载提交记录...</div>
                </div>
            `;
            
            // 显示 modal
            modalInstance.show();
            
            try {
                // 从模板中克隆 status table
                const template = document.getElementById('status_table_modal_template');
                if (!template) {
                    throw new Error('Status table template not found');
                }
                
                // 克隆模板内容
                const clonedContent = template.cloneNode(true);
                clonedContent.style.display = '';
                clonedContent.id = 'status_table_modal_template_clone';
                
                // 清空 modal body 并插入克隆的内容
                modalBody.innerHTML = '';
                modalBody.appendChild(clonedContent);
                
                // 获取表格和配置元素
                const statusTable = modalBody.querySelector('#status_table_modal');
                const statusConfig = modalBody.querySelector('#status_page_information_modal');
                const statusTableDiv = modalBody.querySelector('#status_table_div_modal');
                
                if (!statusTable || !statusConfig) {
                    throw new Error('Status table elements not found');
                }
                
                // 设置筛选条件：cid、user_id、problem_id
                const config = window.EXP_RANK_MODAL_CONFIG || {};
                const contestId = config.contest_id || this.config?.key || '';
                
                // 更新配置元素的 cid
                if (statusConfig) {
                    statusConfig.setAttribute('cid', contestId);
                }
                
                // 从 status_page_information_modal 元素读取配置并设置到 window.statusPageConfig
                // 这样 BtnCodeShow 和 BtnResultShow 就能正确使用 modal 的配置
                if (statusConfig) {
                    const module = statusConfig.getAttribute('module') || 'expsys';
                    // 如果 URL 为空，则根据模块和 contest ID 动态生成完整的 URL（与 contest status 页面一致）
                    let singleStatusUrl = statusConfig.getAttribute('single_status_url') || '';
                    let showCodeUrl = statusConfig.getAttribute('show_code_url') || '';
                    let showResUrl = statusConfig.getAttribute('show_res_url') || '';
                    
                    // 如果是相对路径，则添加模块前缀（与 contest status 页面一致）
                    if (singleStatusUrl && !singleStatusUrl.startsWith('/')) {
                        singleStatusUrl = '/' + module + '/contest/' + singleStatusUrl;
                    } else if (!singleStatusUrl) {
                        singleStatusUrl = '/' + module + '/contest/single_status_ajax';
                    }
                    
                    if (showCodeUrl && !showCodeUrl.startsWith('/')) {
                        showCodeUrl = '/' + module + '/contest/' + showCodeUrl;
                    } else if (!showCodeUrl) {
                        showCodeUrl = '/' + module + '/contest/showcode_ajax';
                    }
                    
                    if (showResUrl && !showResUrl.startsWith('/')) {
                        showResUrl = '/' + module + '/contest/' + showResUrl;
                    } else if (!showResUrl) {
                        showResUrl = '/' + module + '/contest/resdetail_ajax';
                    }
                    
                    window.statusPageConfig = {
                        cid: contestId,
                        single_status_url: singleStatusUrl,
                        show_code_url: showCodeUrl,
                        show_res_url: showResUrl,
                        user_id: statusConfig.getAttribute('user_id') || '',
                        status_ajax_url: statusConfig.getAttribute('status_ajax_url') || `/${module}/contest/status_ajax?cid=${contestId}`,
                        rejudge_url: statusConfig.getAttribute('rejudge_url') || `/${module}/admin/contest_rejudge_ajax?cid=${contestId}`,
                        status_page_where: 'contest', // 明确设置为 contest
                        module: module,
                        OJ_MODE: statusConfig.getAttribute('OJ_MODE') || 'cpc',
                        OJ_STATUS: statusConfig.getAttribute('OJ_STATUS') || 'exp',
                        now_course_key: statusConfig.getAttribute('now_course_key') || null,
                        enable_dblclick_filter: false // Modal 中禁用双击筛选功能
                    };
                }
                
                // 创建 modal 专用的 queryParams 函数
                // 注意：在 contest 模式下，problem_id 应该使用字母 ID（如 A, B, C），而不是数字 ID
                window.queryParamsModal = function(params) {
                    // 设置筛选条件
                    params.cid = contestId;
                    params.user_id = teamId;
                    // 使用字母 ID（problemAlphabet）而不是数字 ID（problemId）
                    params.problem_id = problemAlphabet;
                    return params;
                };
                
                // 初始化 BootstrapTable
                // 使用 setTimeout 确保 DOM 已完全插入
                setTimeout(() => {
                    if (typeof $ !== 'undefined' && $.fn.bootstrapTable) {
                        // 如果表格已经初始化，先销毁
                        if ($(statusTable).data('bootstrap.table')) {
                            $(statusTable).bootstrapTable('destroy');
                        }
                        
                        // 初始化表格
                        // FormatterSolutionId 函数会自动检查 modal 配置，不需要手动设置 status_page_where
                        $(statusTable).bootstrapTable();
                        
                        // 为 modal 表格绑定点击事件（使用 SetStatusButtonForTable，禁用双击筛选）
                        // 注意：需要等待 statusPageConfig 设置完成后再调用
                        if (typeof SetStatusButtonForTable === 'function') {
                            SetStatusButtonForTable($(statusTable), 'modal', false);
                        } else {
                            // 如果函数还未加载，延迟执行
                            setTimeout(() => {
                                if (typeof SetStatusButtonForTable === 'function') {
                                    SetStatusButtonForTable($(statusTable), 'modal', false);
                                }
                            }, 200);
                        }
                        
                        // 宽表格在 modal-body 内横向滚动，勿把容器宽度设为 scrollWidth（会撑破弹窗）
                        $(statusTable).on('load-success.bs.table.modal', function() {
                            if (statusTableDiv) {
                                statusTableDiv.style.width = '';
                                statusTableDiv.style.maxWidth = '';
                            }
                        });
                        
                        // Modal 关闭时清理表格实例和配置
                        $(modal).on('hidden.bs.modal', function() {
                            if ($(statusTable).data('bootstrap.table')) {
                                $(statusTable).bootstrapTable('destroy');
                            }
                            // 清理事件监听器
                            $(statusTable).off('load-success.bs.table.modal');
                            $(statusTable).off('click-cell.bs.table.modal');
                            // 清理 modal 配置（它们不会同时出现，所以可以直接清空）
                            window.statusPageConfig = null;
                        });
                    } else {
                        console.error('BootstrapTable not loaded');
                        modalBody.innerHTML = `
                            <div class="alert alert-danger">
                                <i class="bi bi-exclamation-triangle"></i> 表格组件未加载
                                <div class="small text-muted mt-1">Table component not loaded</div>
                            </div>
                        `;
                    }
                }, 100);
                
            } catch (error) {
                console.error('Error loading status table:', error);
                modalBody.innerHTML = `
                    <div class="alert alert-danger">
                        <i class="bi bi-exclamation-triangle"></i> 加载失败，请重试
                        <div class="small text-muted mt-1">Failed to load submissions, please try again</div>
                    </div>
                `;
            }
        }
        
        /**
         * 创建提交记录 Modal
         */
        CreateSolutionModal() {
            const modal = document.createElement('div');
            modal.id = 'exp-rank-solution-modal';
            modal.className = 'modal fade';
            modal.setAttribute('tabindex', '-1');
            modal.setAttribute('aria-labelledby', 'exp-solution-modal-title');
            modal.setAttribute('aria-hidden', 'true');
            modal.innerHTML = `
                <div class="modal-dialog modal-xl modal-dialog-centered modal-dialog-scrollable exp-rank-solution-modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title" id="exp-solution-modal-title">提交记录 / Submissions</h5>
                            <div class="d-flex align-items-center gap-2">
                                <button type="button" class="btn btn-outline-primary btn-sm" id="exp-solution-view-status-btn" title="查看状态详情 / View Status Details">
                                    <span><i class="bi bi-list-ul"></i><span class="d-none d-sm-inline ms-1">查看详情</span></span><span class="d-none d-md-inline en-text">View Details</span>
                                </button>
                                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                            </div>
                        </div>
                        <div class="modal-body" id="exp-solution-modal-body">
                            <!-- 内容将动态填充 -->
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">关闭 / Close</button>
                        </div>
                    </div>
                </div>
            `;
            return modal;
        }
        
        /**
         * 获取提交记录
         */
        async FetchSolutions(teamId, problemId) {
            // 优先从 solutionMap 获取（父类 RankSystem 构建的数据结构）
            if (this.solutionMap && this.solutionMap[teamId] && this.solutionMap[teamId].problems) {
                const solutions = this.solutionMap[teamId].problems[problemId] || [];
                if (solutions.length > 0) {
                    return solutions;
                }
            }
            
            // 如果 solutionMap 中没有，尝试从 data.solution 中筛选
            if (this.data && this.data.solution && Array.isArray(this.data.solution)) {
                const filteredSolutions = this.data.solution.filter(sol => 
                    sol.team_id === teamId && sol.problem_id == problemId
                );
                if (filteredSolutions.length > 0) {
                    // 按时间排序
                    filteredSolutions.sort((a, b) => {
                        const timeA = new Date(a.in_date || 0).getTime();
                        const timeB = new Date(b.in_date || 0).getTime();
                        return timeA - timeB;
                    });
                    return filteredSolutions;
                }
            }
            
            // 如果都没有，返回空数组
            return [];
        }
        
        /**
         * 格式化语言名称（双语）
         */
        FormatLanguage(language) {
            if (!language) return null;
            
            const languageMap = {
                0: { cn: 'C', en: 'C' },
                1: { cn: 'C++', en: 'C++' },
                2: { cn: 'Java', en: 'Java' },
                3: { cn: 'Python', en: 'Python' },
                4: { cn: 'Python3', en: 'Python3' },
                5: { cn: 'Go', en: 'Go' },
                6: { cn: 'PHP', en: 'PHP' },
                7: { cn: 'Ruby', en: 'Ruby' },
                8: { cn: 'Scala', en: 'Scala' },
                9: { cn: 'JavaScript', en: 'JavaScript' },
                10: { cn: 'Kotlin', en: 'Kotlin' },
                11: { cn: 'Rust', en: 'Rust' }
            };
            
            // 如果是数字，查找映射
            if (typeof language === 'number' || /^\d+$/.test(language)) {
                const langInfo = languageMap[parseInt(language)];
                if (langInfo) {
                    return langInfo;
                }
            }
            
            // 如果是字符串，尝试匹配
            const langStr = String(language).toLowerCase();
            for (const [key, value] of Object.entries(languageMap)) {
                if (value.cn.toLowerCase() === langStr || value.en.toLowerCase() === langStr) {
                    return value;
                }
            }
            
            // 默认返回原值
            return { cn: String(language), en: String(language) };
        }
        
        /**
         * 渲染提交记录表格
         */
        RenderSolutions(container, solutions, problemAlphabet, teamName, teamUnit, teamId) {
            if (!solutions || solutions.length === 0) {
                container.innerHTML = `
                    <div class="alert alert-info text-center">
                        <i class="bi bi-info-circle"></i> 暂无提交记录
                        <div class="small text-muted mt-1">No submissions found</div>
                    </div>
                `;
                return;
            }
            
            // 格式化结果（双语）
            const formatResult = (result) => {
                const resultMap = {
                    0: { cn: '等待评测', en: 'Pending', class: 'warning' },
                    1: { cn: '等待重测', en: 'Rejudging', class: 'warning' },
                    2: { cn: '正在编译', en: 'Compiling', class: 'info' },
                    3: { cn: '正在运行', en: 'Running', class: 'info' },
                    4: { cn: '通过', en: 'AC', class: 'success' },
                    5: { cn: '格式错误', en: 'PE', class: 'danger' },
                    6: { cn: '答案错误', en: 'WA', class: 'danger' },
                    7: { cn: '时间超限', en: 'TLE', class: 'danger' },
                    8: { cn: '内存超限', en: 'MLE', class: 'danger' },
                    9: { cn: '输出超限', en: 'OLE', class: 'danger' },
                    10: { cn: '运行错误', en: 'RE', class: 'danger' },
                    11: { cn: '编译错误', en: 'CE', class: 'danger' }
                };
                const resultInfo = resultMap[result] || { cn: '未知', en: 'Unknown', class: 'secondary' };
                return `
                    <span class="badge bg-${resultInfo.class}">
                        ${resultInfo.cn}
                        <span class="en-text" style="font-size: 0.85em; opacity: 0.9;">${resultInfo.en}</span>
                    </span>
                `;
            };
            
            // 格式化时间
            const formatTime = (dateStr) => {
                if (!dateStr) return null;
                const date = new Date(dateStr);
                return date.toLocaleString('zh-CN', { 
                    year: 'numeric', 
                    month: '2-digit', 
                    day: '2-digit', 
                    hour: '2-digit', 
                    minute: '2-digit',
                    second: '2-digit'
                });
            };
            
            // 转义 HTML：使用全局 DomSantize（来自 global.js）
            const escapeHtml = (text) => DomSantize(text || '');
            
            // 创建表格（双语表头，所有内容居中）
            let tableHtml = `
                <div class="table-responsive">
                    <table class="table table-hover table-sm text-center">
                        <thead>
                            <tr>
                                <th style="width: 90px;">
                                    <div class="bilingual-header">
                                        <span class="header-cn">RunID</span>
                                        <span class="header-en en-text">RunID</span>
                                    </div>
                                </th>
                                <th style="width: 100px;">
                                    <div class="bilingual-header">
                                        <span class="header-cn">账号</span>
                                        <span class="header-en en-text">Account</span>
                                    </div>
                                </th>
                                <th style="width: 100px;">
                                    <div class="bilingual-header">
                                        <span class="header-cn">姓名</span>
                                        <span class="header-en en-text">Name</span>
                                    </div>
                                </th>
                                <th style="width: 120px;">
                                    <div class="bilingual-header">
                                        <span class="header-cn">单位</span>
                                        <span class="header-en en-text">Unit</span>
                                    </div>
                                </th>
                                <th style="width: 120px;">
                                    <div class="bilingual-header">
                                        <span class="header-cn">结果</span>
                                        <span class="header-en en-text">Result</span>
                                    </div>
                                </th>
                                <th style="width: 160px;">
                                    <div class="bilingual-header">
                                        <span class="header-cn">提交时间</span>
                                        <span class="header-en en-text">Submit Time</span>
                                    </div>
                                </th>
                            </tr>
                        </thead>
                        <tbody>
            `;
            
            solutions.forEach((solution, index) => {
                const hasSolutionId = solution.solution_id != null && solution.solution_id !== '';
                const hasResult = solution.result != null && solution.result !== '';
                const hasSubmitTime = solution.in_date != null && solution.in_date !== '';
                const submitTime = hasSubmitTime ? formatTime(solution.in_date) : '';
                
                tableHtml += `
                    <tr>
                        <td style="font-family: 'Courier New', monospace;">${hasSolutionId ? escapeHtml(String(solution.solution_id)) : ''}</td>
                        <td style="font-family: 'Courier New', monospace;">${escapeHtml(teamId)}</td>
                        <td>${escapeHtml(teamName)}</td>
                        <td>${escapeHtml(teamUnit)}</td>
                        <td>${hasResult ? formatResult(solution.result) : ''}</td>
                        <td>${submitTime}</td>
                    </tr>
                `;
            });
            
            tableHtml += `
                        </tbody>
                    </table>
                </div>
            `;
            
            container.innerHTML = tableHtml;
        }
        
        /**
         * 初始化固定表头（使用 JavaScript 实现，不依赖 CSS sticky）
         */
        initFixedHeader() {
            // 移除旧的固定表头（如果存在）
            const oldFixedHeader = document.getElementById('rank-table-fixed-header');
            if (oldFixedHeader) {
                oldFixedHeader.remove();
            }
            
            if (!this.theadElement || !this.tableElement) {
                return;
            }
            
            // 克隆表头
            const clonedThead = this.theadElement.cloneNode(true);
            clonedThead.id = 'rank-table-fixed-header-thead';
            
            // 创建固定表头容器
            const fixedHeaderWrapper = document.createElement('div');
            fixedHeaderWrapper.id = 'rank-table-fixed-header';
            fixedHeaderWrapper.className = 'rank-table-fixed-header-wrapper';
            
            // 创建固定表头表格
            const fixedHeaderTable = document.createElement('table');
            fixedHeaderTable.className = 'table table-hover table-striped';
            fixedHeaderTable.style.marginBottom = '0';
            fixedHeaderTable.style.fontSize = '0.9rem';
            fixedHeaderTable.appendChild(clonedThead);
            
            fixedHeaderWrapper.appendChild(fixedHeaderTable);
            
            // 插入到表格之前
            this.tableElement.parentNode.insertBefore(fixedHeaderWrapper, this.tableElement);
            
            // 初始隐藏（当表头滚出视口时才显示）
            fixedHeaderWrapper.style.display = 'none';
            
            // 存储引用，用于后续更新
            this.fixedHeaderWrapper = fixedHeaderWrapper;
            this.fixedHeaderTable = fixedHeaderTable;
            
            // 绑定滚动和调整大小事件（如果还没有绑定）
            if (!this.scrollHandler) {
                this.scrollHandler = () => this.updateFixedHeaderPosition();
                window.addEventListener('scroll', this.scrollHandler, { passive: true });
            }
            if (!this.resizeHandler) {
                this.resizeHandler = () => this.updateFixedHeaderPosition();
                window.addEventListener('resize', this.resizeHandler);
            }
            
            // 初始更新位置
            this.updateFixedHeaderPosition();
        }
        
        /**
         * 更新固定表头的位置和显示状态
         */
        updateFixedHeaderPosition() {
            if (!this.fixedHeaderWrapper || !this.tableElement || !this.theadElement) {
                return;
            }
            
            const tableRect = this.tableElement.getBoundingClientRect();
            const theadRect = this.theadElement.getBoundingClientRect();
            
            // 如果原始表头还在视口内，隐藏固定表头
            if (theadRect.top >= 0 && theadRect.bottom > 0) {
                this.fixedHeaderWrapper.style.display = 'none';
                return;
            }
            
            // 如果表格已经滚出视口底部，隐藏固定表头
            if (tableRect.bottom < 0) {
                this.fixedHeaderWrapper.style.display = 'none';
                return;
            }
            
            // 显示固定表头并同步宽度和位置
            this.fixedHeaderWrapper.style.display = 'block';
            this.fixedHeaderWrapper.style.position = 'fixed';
            this.fixedHeaderWrapper.style.top = '0';
            this.fixedHeaderWrapper.style.left = tableRect.left + 'px';
            this.fixedHeaderWrapper.style.width = tableRect.width + 'px';
            this.fixedHeaderWrapper.style.zIndex = '100';
            
            // 同步列宽
            const originalThs = this.theadElement.querySelectorAll('th');
            const fixedThs = this.fixedHeaderWrapper.querySelectorAll('th');
            originalThs.forEach((th, index) => {
                if (fixedThs[index]) {
                    fixedThs[index].style.width = th.offsetWidth + 'px';
                }
            });
        }
        
        /**
         * 更新表格
         */
        UpdateTable() {
            // 如果 tbodyElement 不存在，尝试重新获取
            if (!this.tbodyElement) {
                this.ensureDOMElements();
            }
            
            if (!this.tbodyElement) {
                return;
            }
            
            // 转换数据
            const tableData = this.ConvertToTableData();
            this.rankData = tableData;
            
            // 更新表头（包含题目列）
            this.CreateTableHeader();
            
            // 清空现有数据
            this.tbodyElement.innerHTML = '';
            
            // 添加数据行
            tableData.forEach((item, index) => {
                const tr = this.CreateTableRow(item, index);
                this.tbodyElement.appendChild(tr);
            });
            
            // 初始化固定表头（使用 setTimeout 确保 DOM 已更新）
            setTimeout(() => {
                this.initFixedHeader();
            }, 0);
            
            // 通知外部表格已更新（确保加载提示被隐藏）
            if (window.expRankTableUpdated) {
                window.expRankTableUpdated(this);
            } else {
                // 如果回调未定义，直接隐藏加载提示
                const loadingEl = document.getElementById('rank-loading');
                if (loadingEl) {
                    loadingEl.style.display = 'none';
                }
                // 显示表格
                const tableEl = document.getElementById('rank-table');
                if (tableEl) {
                    tableEl.style.display = '';
                }
            }
        }
        
        /**
         * 刷新数据（统一的刷新方法，包含UI反馈）
         */
        async RefreshData() {
            try {
                // 显示加载提示和隐藏表格（统一的UI反馈）
                const loadingEl = document.getElementById('rank-loading');
                const tableEl = document.getElementById('rank-table');
                if (loadingEl) {
                    loadingEl.style.display = 'block';
                }
                if (tableEl) {
                    tableEl.style.display = 'none';
                }
                
                // 加载数据
                await this.LoadData();
            } catch (error) {
                // 显示错误提示（使用页面级别的提示，因为 externalMode 时 container 为 null）
                this.ShowErrorInPage('刷新失败，请重试');
            }
        }
        
        /**
         * 在页面中显示错误（用于 externalMode）
         */
        ShowErrorInPage(message) {
            // 创建一个页面级别的提示
            const toast = document.createElement('div');
            toast.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                background: #dc3545;
                color: white;
                padding: 12px 24px;
                border-radius: 4px;
                z-index: 10000;
                font-size: 14px;
                box-shadow: 0 2px 8px rgba(0,0,0,0.2);
            `;
            toast.textContent = message;
            document.body.appendChild(toast);
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.parentNode.removeChild(toast);
                }
            }, 3000);
        }
        
        /**
         * 重写 ShowMessage 方法，处理 externalMode
         */
        ShowMessage(message) {
            if (this.externalMode || !this.container) {
                // externalMode 时使用页面级别的提示
                this.ShowErrorInPage(message);
            } else {
                // 调用父类方法
                super.ShowMessage(message);
            }
        }
        
        /**
         * 重写 ShowError 方法，处理 externalMode
         */
        ShowError(message) {
            this.HideLoading();
            if (this.externalMode || !this.container) {
                // externalMode 时使用页面级别的提示
                this.ShowErrorInPage('数据尚未准备好');
            } else {
                // 调用父类方法
                super.ShowError(message);
            }
        }
        
        /**
         * 获取题目列表（用于外部查询）
         */
        GetProblemList() {
            if (!this.data || !this.data.problem) {
                return [];
            }
            return this.data.problem.sort((a, b) => a.num - b.num);
        }
        
        /**
         * 初始化键盘事件监听（F5 刷新）
         */
        initKeyboardListener() {
            if (this.keydownHandler) {
                return; // 已经初始化
            }
            
            this.keydownHandler = (event) => {
                // 监听 F5 键（keyCode 116 或 key === 'F5'）
                if (event.keyCode === 116 || event.key === 'F5') {
                    // 阻止默认的页面刷新行为
                    event.preventDefault();
                    // 触发榜单刷新
                    this.RefreshData();
                }
            };
            
            // 绑定键盘事件
            document.addEventListener('keydown', this.keydownHandler);
        }
        
        /**
         * 清理固定表头相关资源
         */
        cleanupFixedHeader() {
            // 移除固定表头元素
            if (this.fixedHeaderWrapper) {
                this.fixedHeaderWrapper.remove();
                this.fixedHeaderWrapper = null;
            }
            
            // 移除事件监听器
            if (this.scrollHandler) {
                window.removeEventListener('scroll', this.scrollHandler);
                this.scrollHandler = null;
            }
            if (this.resizeHandler) {
                window.removeEventListener('resize', this.resizeHandler);
                this.resizeHandler = null;
            }
            if (this.keydownHandler) {
                document.removeEventListener('keydown', this.keydownHandler);
                this.keydownHandler = null;
            }
        }
    }
    
    window.ExpRankSystem = ExpRankSystem;
}

/**
 * 初始化函数
 */
function ExpRankSystemInit(containerId, config = {}) {
    if (!config || Object.keys(config).length === 0) {
        config = window.RANK_CONFIG || {};
    }
    
    const instance = new ExpRankSystem(containerId, config);
    return instance;
}
