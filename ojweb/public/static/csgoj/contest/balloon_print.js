/**
 * ============================================================================
 * ============================================================================
 * 气球小票打印模块
 * ============================================================================
 * ============================================================================
 * 
 * 本模块负责气球小票的打印功能：
 * - Lodop 初始化
 * - 小票排版和内容生成
 * - 打印执行
 */

// Lodop 全局变量
var LODOP_BALLOON;

// 初始化 Lodop（用于气球打印）
$(function () {
    setTimeout(InitBalloonLodop, 0);
});

/**
 * 初始化 Lodop（用于气球打印）。
 * 与 print_control.js 的 InitLodop 一致：CLodop 模式下 LodopFuncs.js 会异步 loadCLodop()，
 * 在 CLodopJsState === 'loading' 时调用 getLodop 会误提示「网页还没下载完毕」；须轮询到 complete 再 getLodop。
 * 动态按需插入 LodopFuncs.js（气球队列小票开关）时同样适用。
 */
function InitBalloonLodop() {
    if (LODOP_BALLOON) {
        return;
    }
    if (document.readyState !== "complete") {
        setTimeout(InitBalloonLodop, 500);
        return;
    }
    var lodopObj = document.getElementById("LODOP_OB");
    var lodopEmbed = document.getElementById("LODOP_EM");
    if (!lodopObj || !lodopEmbed || typeof getLodop !== "function") {
        return;
    }
    if (typeof needCLodop === "function" && needCLodop()) {
        if (typeof CLodopJsState !== "undefined" && CLodopJsState === "loading") {
            window.__csgInitBalloonLodopPollCount =
                (window.__csgInitBalloonLodopPollCount || 0) + 1;
            if (window.__csgInitBalloonLodopPollCount < 200) {
                setTimeout(InitBalloonLodop, 150);
                return;
            }
        }
    }
    window.__csgInitBalloonLodopPollCount = 0;
    LODOP_BALLOON = getLodop(lodopObj, lodopEmbed);
}

/**
 * 等待气球打印用 Lodop 实例就绪（按需加载脚本后由队列页调用）。
 * getLodop 在未安装时会走 Lodop 自带提示；此处仅等待初始化完成或超时。
 * @returns {Promise<void>}
 */
function csgWaitForBalloonLodopReady() {
    if (LODOP_BALLOON) {
        return Promise.resolve();
    }
    InitBalloonLodop();
    return new Promise(function (resolve, reject) {
        var t0 = Date.now();
        var maxMs = 45000;
        function step() {
            if (LODOP_BALLOON) {
                resolve();
                return;
            }
            if (Date.now() - t0 > maxMs) {
                reject(new Error("Balloon Lodop init timeout"));
                return;
            }
            setTimeout(step, 150);
        }
        setTimeout(step, 150);
    });
}

window.csgWaitForBalloonLodopReady = csgWaitForBalloonLodopReady;

/**
 * 气球打印对象
 */

// 小票基准尺寸常量（单位：mm）
// 这是基准尺寸，会根据纸张大小和数量自动等比缩放（可以放大也可以缩小）
const TICKET_BASE_WIDTH = 58;   // 基准宽度
const TICKET_BASE_HEIGHT = 80;  // 基准高度
const TICKET_SPACING = 2;       // 小票之间的间隔（mm）
// 【打印间隔】多趟 PRINT 之间见 csg_print_job_queue.js → CSG_BALLOON_PRINT_JOB_GAP_MS（每趟 = 一次 PRINT()）
/**
 * 排版计算时相对纸面每边内缩（mm），物理 SET_PRINT_PAGESIZE 仍用满幅纸。
 * 二分排版在「刚好塞满」时底/右边距可极小；Lodop/驱动取整后易多出一页空白，内缩略大更稳。
 * 仍异常时可再调大（如 3～4）；过大则同纸可排张数略减、字略小。
 */
const BALLOON_PRINT_LAYOUT_INSET_MM = 2.6;

/**
 * 气球小票中英文案唯一来源；generateTicketHTML 纵版 / 横版共用，避免两排版漂移。
 * 修改可见文案时只改此对象。
 */
const BALLOON_TICKET_COPY = Object.freeze({
    headerTitleCn: "气球",
    headerTitleEn: "Balloon",
    teamIdCn: "队号",
    teamIdEn: "Team ID",
    zoneCn: "分区",
    zoneEn: "Zone",
    orgCn: "组织",
    orgEn: "Org",
    teamNameCn: "队名",
    teamNameEn: "Name",
    fbGlobalTitle: "全场首答 / Global First Blood",
    fbRegularTitle: "正式队首答 / Regular First Blood",
    fbGlobalTagCn: "全",
    fbRegularTagCn: "正",
});

/**
 * Lodop 打印任务名（PRINT_INIT / PRINT_INITA 第 5 参），在队列/日志中标识任务，非磁盘文件名。
 * 与代码打印 print_control.js 中 "Contest Code " + print_id 同类用途。
 * @param {Array} balloons 本趟 PRINT 的有效气球（可含 null 填充位，会忽略）
 * @returns {string}
 */
function sanitizeBalloonLodopTaskPart(v) {
    const s = String(v == null ? "" : v).trim();
    return s.replace(/[^\w.-]/g, "_") || "0";
}

function buildBalloonLodopTaskName(balloons) {
    const list = (balloons || []).filter(function (b) {
        return b != null;
    });
    if (list.length === 0) {
        return "BalloonTicket";
    }
    const b = list[0];
    const pid =
        b.problem_id != null && b.problem_id !== ""
            ? b.problem_id
            : b.problem_num;
    const base =
        sanitizeBalloonLodopTaskPart(b.solution_id) +
        "_" +
        sanitizeBalloonLodopTaskPart(b.team_id) +
        "_" +
        sanitizeBalloonLodopTaskPart(pid);
    if (list.length === 1) {
        return "Balloon " + base;
    }
    return "Balloon " + base + "_x" + list.length;
}

window.BalloonPrint = {
    /**
     * 打印气球小票
     * @param {Array} balloons - 要打印的气球列表（可能包含 null 用于填充）
     * @param {Number} perPage - 每页数量（用于填充空数据）
     * @param {Function} callback - 打印成功后的回调函数 (error, result)
     * @param {Object} queueSystem - 队列系统实例（可选，用于状态管理）
     */
    printBalloons: function(balloons, perPage, callback, queueSystem) {
        if (!LODOP_BALLOON) {
            if (callback) callback(new Error('Lodop 未初始化'), null);
            return;
        }
        
        if (!balloons || balloons.length === 0) {
            if (callback) callback(new Error('没有要打印的气球'), null);
            return;
        }
        
        // 获取打印设置
        const pageSize = this.getPageSize();
        const actualPerPage = perPage || this.getPerPage();
        
        // 过滤掉 null 值（空数据填充）
        const validBalloons = balloons.filter(b => b !== null);
        
        if (validBalloons.length === 0) {
            if (callback) callback(new Error('没有有效的气球数据'), null);
            return;
        }
        
        // 将气球分组（每页一组，每组最多 actualPerPage 个）
        const groups = [];
        for (let i = 0; i < balloons.length; i += actualPerPage) {
            const group = balloons.slice(i, i + actualPerPage);
            // 确保每组都有 actualPerPage 个元素（不足的用 null 填充）
            while (group.length < actualPerPage) {
                group.push(null);
            }
            groups.push(group);
        }
        
        // 逐组打印
        this.printGroups(groups, pageSize, 0, null, callback, queueSystem);
    },
    
    /**
     * 逐组打印
     * @param {Array} groups - 分组的气球列表
     * @param {Object} pageSize - 页面尺寸
     * @param {Number} index - 当前组索引
     * @param {Error|null} previousError - 之前的错误（如果有）
     * @param {Function} callback - 最终回调函数 (error, result)
     * @param {Object} queueSystem - 队列系统实例（可选，用于状态管理）
     */
    printGroups: function(groups, pageSize, index, previousError, callback, queueSystem) {
        if (index >= groups.length) {
            // 所有组都打印完成，调用最终回调
            if (callback) {
                callback(previousError || null, previousError ? null : true);
            }
            return;
        }
        
        const group = groups[index];
        this.printSinglePage(group, pageSize, (printError, printResult) => {
            // 如果当前组打印失败，记录错误但继续打印下一组
            const currentError = printError || previousError;
            
            // 下一组入队；组间间隔由 CsgPrintJobQueue 在上一趟 PRINT 后统一等待
            this.printGroups(groups, pageSize, index + 1, currentError, callback, queueSystem);
        }, false);
    },
    
    /**
     * 计算单个方向的布局（平铺和缩放）
     * @param {Number} pageWidth - 纸宽（mm）
     * @param {Number} pageHeight - 走纸长度（mm）
     * @param {Number} ticketCount - 需要打印的小票数量
     * @returns {Object} { cols, rows, ticketWidth, ticketHeight, scale }
     */
    calculateLayoutForOrientation: function(pageWidth, pageHeight, ticketCount) {
        const baseWidth = TICKET_BASE_WIDTH;
        const baseHeight = TICKET_BASE_HEIGHT;
        // 使用基准尺寸（可以等比缩放，可以放大也可以缩小）
        // 计算可用的缩放范围
        // 最大倍率：纸张能容纳的最大尺寸
        const maxScaleLimit = Math.min(pageWidth / baseWidth, pageHeight / baseHeight);
        // 最小倍率：确保至少能放一个（设置为一个很小的值，比如 0.1）
        // 但实际上，如果纸张太小，我们仍然会尽可能缩小
        const minScaleLimit = 0.1;
        
        // 使用二分法找到最佳倍率
        // 目标：找到最大的倍率，使得平铺数量刚好 >= ticketCount
        let bestScale = 1.0; // 默认使用基准尺寸
        let currentMinScale = minScaleLimit;
        let currentMaxScale = maxScaleLimit;
        
        // 二分法迭代15次
        for (let i = 0; i < 15; i++) {
            const testScale = (currentMinScale + currentMaxScale) / 2;
            const scaledWidth = baseWidth * testScale;
            const scaledHeight = baseHeight * testScale;
            
            // 如果缩放后的尺寸太小（小于1mm），跳过
            if (scaledWidth < 1 || scaledHeight < 1) {
                break;
            }
            
            // 计算列数和行数时，需要考虑小票之间的间隔
            // 每个小票占用的空间 = 小票尺寸 + 间隔
            const cols = Math.floor((pageWidth + TICKET_SPACING) / (scaledWidth + TICKET_SPACING));
            const rows = Math.floor((pageHeight + TICKET_SPACING) / (scaledHeight + TICKET_SPACING));
            const count = cols * rows;
            
            if (count >= ticketCount) {
                // 数量足够，尝试增大倍率（让数量更接近 ticketCount）
                bestScale = testScale;
                currentMinScale = testScale;
            } else {
                // 数量不足，减小倍率
                currentMaxScale = testScale;
            }
        }
        
        // 使用最佳倍率计算最终布局
        const finalWidth = baseWidth * bestScale;
        const finalHeight = baseHeight * bestScale;
        // 计算列数和行数时，需要考虑小票之间的间隔
        const finalCols = Math.floor((pageWidth + TICKET_SPACING) / (finalWidth + TICKET_SPACING));
        const finalRows = Math.floor((pageHeight + TICKET_SPACING) / (finalHeight + TICKET_SPACING));
        
        // 确保至少能放一个
        const cols = Math.max(1, finalCols);
        const rows = Math.max(1, finalRows);
        
        // 计算实际使用的列数和行数
        let actualCols = cols;
        let actualRows = Math.ceil(ticketCount / actualCols);
        
        // 如果行数超过纸张高度，调整列数
        // 考虑间隔：总高度 = 行数 * 小票高度 + (行数 - 1) * 间隔
        const totalHeight = actualRows * finalHeight + (actualRows - 1) * TICKET_SPACING;
        if (totalHeight > pageHeight) {
            actualRows = rows;
            actualCols = Math.ceil(ticketCount / actualRows);
        }
        
        return {
            cols: actualCols,
            rows: actualRows,
            ticketWidth: finalWidth,
            ticketHeight: finalHeight,
            scale: bestScale
        };
    },
    
    /**
     * 计算平铺布局和缩放倍率，自动选择最佳方向（横向或纵向）
     * 与「重构2.0」一致：第二套方案在算法里交换纸的宽高参与比较（扁/长纸自动择优），
     * rotated 为 true 时：在物理页上用「走纸×纸宽」虚拟面择优后的格子映射；小票内容走 **横版 HTML**（与旋转无关），见 `generateTicketHTML(..., 'landscape')`。
     * @param {Number} pageWidth - 纸宽（mm），一行字左右方向
     * @param {Number} pageHeight - 走纸长度（mm），送纸方向上下堆叠
     * @param {Number} ticketCount - 需要打印的小票数量
     * @returns {Object} { cols, rows, ticketWidth, ticketHeight, scale, rotated }
     */
    calculateLayout: function(pageWidth, pageHeight, ticketCount) {
        // 测试纵向布局（正常方向）
        const portraitLayout = this.calculateLayoutForOrientation(pageWidth, pageHeight, ticketCount);

        // 测试「交换纸宽高」后的布局（等价于纸旋转 90° 后仍用 58×80 小票块排版择优）
        const landscapeLayout = this.calculateLayoutForOrientation(
            pageHeight,
            pageWidth,
            ticketCount
        );

        // 比较两种布局，选择最佳方案（相同数量下，scale 更大的方案）
        let bestLayout;
        let bestRotated = false;

        const portraitCount = portraitLayout.cols * portraitLayout.rows;
        const landscapeCount = landscapeLayout.cols * landscapeLayout.rows;

        if (portraitCount === landscapeCount) {
            // 数量相同，选择 scale 更大的
            if (portraitLayout.scale >= landscapeLayout.scale) {
                bestLayout = portraitLayout;
                bestRotated = false;
            } else {
                bestLayout = landscapeLayout;
                bestRotated = true;
            }
        } else if (portraitCount >= ticketCount && landscapeCount >= ticketCount) {
            // 两种都能满足，选择 scale 更大的
            if (portraitLayout.scale >= landscapeLayout.scale) {
                bestLayout = portraitLayout;
                bestRotated = false;
            } else {
                bestLayout = landscapeLayout;
                bestRotated = true;
            }
        } else if (portraitCount >= ticketCount) {
            // 只有纵向能满足
            bestLayout = portraitLayout;
            bestRotated = false;
        } else if (landscapeCount >= ticketCount) {
            // 只有横向能满足
            bestLayout = landscapeLayout;
            bestRotated = true;
        } else {
            // 两种都不能满足，选择数量更多的
            if (portraitCount >= landscapeCount) {
                bestLayout = portraitLayout;
                bestRotated = false;
            } else {
                bestLayout = landscapeLayout;
                bestRotated = true;
            }
        }

        return {
            cols: bestLayout.cols,
            rows: bestLayout.rows,
            ticketWidth: bestLayout.ticketWidth,
            ticketHeight: bestLayout.ticketHeight,
            scale: bestLayout.scale,
            rotated: bestRotated
        };
    },
    
    /**
     * 打印单页
     * @param {Array} balloons - 要打印的气球列表
     * @param {Object} pageSize - { width: 纸宽(mm), height: 走纸长度(mm), layoutWidthTrimMm?: number }
     * @param {Function} callback - 回调函数 (error, result)，error 为 null 表示成功
     * @param {Boolean} preview - 是否为预览模式
     */
    printSinglePage: function(balloons, pageSize, callback, preview = false) {
        if (!LODOP_BALLOON) {
            if (callback) {
                callback(new Error('Lodop 未初始化'), null);
            }
            return;
        }

        const executeLodopJob = () => {
        const paperWidthMm = pageSize.width;
        const paperFeedMm = pageSize.height;
        const trimRaw = Number(pageSize.layoutWidthTrimMm);
        const layoutWidthTrimMm =
            !isNaN(trimRaw) && trimRaw > 0 ? Math.min(20, trimRaw) : 0;
        const ticketCount = balloons.length;
        const layoutInset = BALLOON_PRINT_LAYOUT_INSET_MM;
        const layoutW = Math.max(20, paperWidthMm - layoutWidthTrimMm - 2 * layoutInset);
        const layoutH = Math.max(20, paperFeedMm - 2 * layoutInset);
        
        try {
            // 任务名：Lodop 队列可见标识（对齐代码打印 print_id；非保存文件名）
            const lodopTaskName = buildBalloonLodopTaskName(balloons);
            if (typeof LODOP_BALLOON.PRINT_INITA === "function") {
                LODOP_BALLOON.PRINT_INITA(0, 0, 0, 0, lodopTaskName);
            } else {
                LODOP_BALLOON.PRINT_INIT(lodopTaskName);
            }
            
            // 在略小的「可排版矩形」上算格子与缩放，再整体平移 layoutInset，避免贴底/贴边触发多出一页空白
            const layout = this.calculateLayout(layoutW, layoutH, ticketCount);
            
            // 物理页只认一套尺寸：始终纵向 SET(1, 纸宽, 走纸)。切勿再叠 SET(2)+CSS 旋转两套坐标系，否则易跨页、字向错乱。
            LODOP_BALLOON.SET_PRINT_PAGESIZE(1, paperWidthMm * 10, paperFeedMm * 10, "");
            
            // 为每个气球生成小票内容并平铺排版
            balloons.forEach((balloon, index) => {
                // 数据验证：如果 balloon 为 null，跳过（用于填充空位置）
                if (!balloon) {
                    // 空数据，不生成小票内容，直接跳过
                    return;
                }
                
                // 计算位置（从左到右，从上到下）
                const col = index % layout.cols;
                const row = Math.floor(index / layout.cols);
                
                let left;
                let top;
                let width;
                let height;
                // rotated：布局在「走纸×纸宽」虚拟面上择优；映射到物理页 (纸宽×走纸) 上放置，与 calculateLayoutForOrientation(走纸,纸宽) 一致。
                if (layout.rotated) {
                    left = row * (layout.ticketHeight + TICKET_SPACING);
                    top = col * (layout.ticketWidth + TICKET_SPACING);
                    // 本格在纸面上的「横向跨度×纵向跨度」= 格子长边×短边（扁格时多为 57×tw）
                    width = layout.ticketHeight;
                    height = layout.ticketWidth;
                } else {
                    left = col * (layout.ticketWidth + TICKET_SPACING);
                    top = row * (layout.ticketHeight + TICKET_SPACING);
                    width = layout.ticketWidth;
                    height = layout.ticketHeight;
                }
                
                // 单张且旋转：在纸宽×走纸内居中，避免贴角造成「像没转对」的观感（仍按满幅纸居中，不加 layoutInset）
                if (layout.rotated && ticketCount === 1) {
                    left = Math.max(0, (paperWidthMm - width) / 2);
                    top = Math.max(0, (paperFeedMm - height) / 2);
                } else {
                    left += layoutInset;
                    top += layoutInset;
                }
                
                // 生成小票HTML（使用缩放后的尺寸，传入旋转标志）
                const tw = layout.ticketWidth;
                const th = layout.ticketHeight;
                let html;
                let addTop;
                let addLeft;
                let addW;
                let addH;
                if (layout.rotated) {
                    // 物理格为「宽×高」= th×tw；直接生成横版 HTML，避免 transform / AngleOfPageInside 与老内核不兼容。
                    html = this.generateTicketHTML(balloon, th, tw, layout.scale, "landscape");
                    addTop = top;
                    addLeft = left;
                    addW = th;
                    addH = tw;
                } else {
                    html = this.generateTicketHTML(balloon, tw, th, layout.scale, "portrait");
                    addTop = top;
                    addLeft = left;
                    addW = tw;
                    addH = th;
                }
                
                // HTML验证
                if (!html || html.trim().length === 0) {
                    return;
                }
                
                // Lodop 官方：ADD_PRINT_HTM(Top, Left, Width, Height, strHtml)；Width=纸面水平跨度，Height=垂直跨度（0.1mm 的 SET 与之一致）
                LODOP_BALLOON.ADD_PRINT_HTM(
                    addTop + "mm",
                    addLeft + "mm",
                    addW + "mm",
                    addH + "mm",
                    html
                );
            });

            // 仅第 1 逻辑页入任务：避免内核估出后续空白续页（Lodop SET_PRINT_MODE 页码范围）。
            if (typeof LODOP_BALLOON.SET_PRINT_MODE === "function") {
                LODOP_BALLOON.SET_PRINT_MODE("PRINT_START_PAGE", 1);
                LODOP_BALLOON.SET_PRINT_MODE("PRINT_END_PAGE", 1);
            }
            
            if (preview) {
                LODOP_BALLOON.PREVIEW();
                if (callback) {
                    callback(null, true);
                }
            } else {
                LODOP_BALLOON.PRINT();
                if (callback) {
                    callback(null, true);
                }
            }
        } catch (error) {
            if (callback) {
                callback(error, null);
            }
            throw error;
        }
        };

        if (preview) {
            executeLodopJob();
            return;
        }

        if (typeof CsgPrintJobQueue !== 'undefined' && CsgPrintJobQueue && typeof CsgPrintJobQueue.enqueue === 'function') {
            CsgPrintJobQueue.enqueue(
                function () {
                    return new Promise(function (resolve, reject) {
                        try {
                            executeLodopJob();
                            resolve();
                        } catch (e) {
                            reject(e);
                        }
                    });
                },
                CSG_BALLOON_PRINT_JOB_GAP_MS
            );
            return;
        }

        executeLodopJob();
    },
    
    /**
     * 预览单个气球小票
     */
    previewBalloon: function(balloon) {
        if (!balloon) {
            console.warn('没有要预览的气球');
            return;
        }
        
        if (!LODOP_BALLOON) {
            alerty.alert({
                message: 'Lodop 未初始化，无法预览',
                message_en: 'Lodop not initialized, cannot preview'
            });
            return;
        }
        
        // 获取打印设置
        const pageSize = this.getPageSize();
        
        // 预览单个气球
        this.printSinglePage([balloon], pageSize, null, true);
    },
    
    /**
     * 打印单个气球并更新状态（封装函数）
     * 打印发送和后台反馈连着执行，如果打印发送失败，不执行后台反馈
     * 成功或失败都只显示一次合并通知
     */
    printSingleBalloonWithStatusUpdate: function(balloon, queueSystem) {
        if (!balloon) {
            console.warn('没有要打印的气球');
            return;
        }
        
        if (!LODOP_BALLOON) {
            alerty.alert({
                message: 'Lodop 未初始化，无法打印',
                message_en: 'Lodop not initialized, cannot print'
            });
            return;
        }
        
        if (!queueSystem) {
            console.error('queueSystem 未提供，无法更新状态');
            return;
        }
        
        // 获取打印设置
        const pageSize = this.getPageSize();
        
        // 构建气球信息（用于通知）
        const balloonInfo = {
            team_id: balloon.team_id || '',
            problem_alphabet: balloon.problem_alphabet || '?',
            room: balloon.team?.room || '-'
        };
        // 第一步：执行打印
        this.printSinglePage([balloon], pageSize, (printError, printResult) => {
            // 如果打印失败，直接显示失败通知，不执行状态更新
            if (printError) {
                alerty.alert({
                    title: '打印失败<span class="en-text">Print Failed</span>',
                    message: `队伍 ${balloonInfo.team_id} 的题目 ${balloonInfo.problem_alphabet}<br/>分区: ${balloonInfo.room}<br/><br/>错误: ${printError.message || printError}`,
                    message_en: `Team ${balloonInfo.team_id} Problem ${balloonInfo.problem_alphabet}<br/>Zone: ${balloonInfo.room}<br/><br/>Error: ${printError.message || printError}`,
                    width: '500px'
                });
                return;
            }
            
            // 打印成功，第二步：更新气球状态为 10（已通知）
            queueSystem.UpdateBalloonsStatus([balloon], 10).then(() => {
                // 打印和状态更新都成功，显示合并的成功通知
                const statusInfo = queueSystem.balloonStatusMap[10] || { cn: '已通知', en: 'Printed/Issued' };
                alerty.success(
                    `队伍 ${balloonInfo.team_id} 的题目 ${balloonInfo.problem_alphabet} 打印成功，状态已更新为 ${statusInfo.cn}`,
                    `Team ${balloonInfo.team_id} Problem ${balloonInfo.problem_alphabet} printed successfully, status updated to ${statusInfo.en}`
                );
            }).catch((updateError) => {
                // 打印成功但状态更新失败，显示合并的失败通知
                console.error('更新气球状态失败:', updateError);
                alerty.alert({
                    title: '部分失败<span class="en-text">Partial Failure</span>',
                    message: `队伍 ${balloonInfo.team_id} 的题目 ${balloonInfo.problem_alphabet}<br/>分区: ${balloonInfo.room}<br/><br/>打印成功，但更新状态失败: ${updateError.message || updateError}<br/>请手动更新状态`,
                    message_en: `Team ${balloonInfo.team_id} Problem ${balloonInfo.problem_alphabet}<br/>Zone: ${balloonInfo.room}<br/><br/>Print successful, but status update failed: ${updateError.message || updateError}<br/>Please update status manually`,
                    width: '500px'
                });
            });
        }, false);
    },
    
    /**
     * 热敏/单色优化：无开关 DOM 时由 `window.__csgBalloonTicketThermalMode` 控制；有开关时以勾选为准。
     * 无本地缓存时默认开启热敏（与气球队列页默认一致）。
     * @returns {boolean}
     */
    readBalloonTicketThermalMode: function () {
        const el = document.getElementById("balloon-print-thermal-mode");
        if (el) {
            return !!el.checked;
        }
        return window.__csgBalloonTicketThermalMode === true;
    },

    /**
     * 生成单个小票的 HTML（与 ADD_PRINT_HTM 的宽高严格一致，单位 mm）。
     * 可见文案取自文件级 `BALLOON_TICKET_COPY`，纵版 / 横版共用。
     * @param {Object} balloon - 气球数据
     * @param {Number} boxWidthMm - 小票区域宽度（纸面左右）
     * @param {Number} boxHeightMm - 小票区域高度（纸面上下）
     * @param {Number} scale - 布局缩放倍率（来自 calculateLayout）
     * @param {String} layoutMode - "portrait" 竖票（窄×高）| "landscape" 横票（扁纸格，通常为 走纸缩放×纸宽缩放）
     */
    generateTicketHTML: function(balloon, boxWidthMm, boxHeightMm, scale = 1.0, layoutMode = "portrait") {
        if (balloon.ccpc_freeze_at && Date.now() + (balloon.ccpc_clock_offset || 0) >= balloon.ccpc_freeze_at) throw new Error('CCPC 封榜后停止发放气球');
        const mode = layoutMode === "landscape" ? "landscape" : "portrait";
        const T = BALLOON_TICKET_COPY;

        const teamId = RankToolEscapeHtml(String(
            balloon.team_id ||
            (balloon.team && balloon.team.team_id) ||
            ""
        ));
        const room = RankToolEscapeHtml(
            (balloon.team && balloon.team.room) ||
            balloon.room ||
            "-"
        );
        const problemAlphabet = RankToolEscapeHtml(
            balloon.problem_alphabet ||
            (balloon.problem && balloon.problem.alphabet) ||
            "?"
        );

        const schoolRaw = String((balloon.team && balloon.team.school) || balloon.school || "-");
        const teamNameRaw = String((balloon.team && balloon.team.name) || balloon.team_name || "-");

        /** 极端长度保护后再按纸宽省略（先长度截断再算宽，避免超长字符串） */
        const capLen = 400;
        const capStr = (s) => {
            if (s.length <= capLen) {
                return s;
            }
            return s.substring(0, capLen - 1) + "…";
        };

        /**
         * 按可用宽度（mm）与字号估算最大字符数后加省略（中文为主，偏保守）
         */
        const ellipsizeByMm = (text, widthMm, fontSizePt, maxLines) => {
            if (!text || text === "-") {
                return text;
            }
            const mmPerCn = fontSizePt * 0.36;
            const lineChars = Math.max(2, Math.floor(widthMm / mmPerCn));
            const maxLen = Math.max(4, lineChars * maxLines - 1);
            if (text.length <= maxLen) {
                return text;
            }
            return text.substring(0, Math.max(1, maxLen - 1)) + "\u2026";
        };

        if (!teamId || teamId === "") {
            console.error("team_id 为空，气球数据:", JSON.stringify(balloon, null, 2));
        }

        const thermal = this.readBalloonTicketThermalMode();
        const rootModeClass = thermal ? "balloon-print--thermal" : "balloon-print--color";

        /** 彩色模式首答：内联 SVG（矢量 + 显式填色），避免依赖字体字形，Lodop/各打印机更一致 */
        const fbSvgGlobal =
            '<svg class="fb-ico-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
            '<path fill="#f4b400" stroke="#8a6200" stroke-width="0.4" stroke-linejoin="round" ' +
            'd="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/>' +
            "</svg>";
        const fbSvgRegular =
            '<svg class="fb-ico-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
            '<circle cx="12" cy="12" r="10" fill="#198754"/>' +
            '<path fill="none" stroke="#fff" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" ' +
            'd="M7.2 12.5l3.1 3 6.9-6.9"/>' +
            "</svg>";

        const fbTitleG = RankToolEscapeHtml(T.fbGlobalTitle);
        const fbTitleR = RankToolEscapeHtml(T.fbRegularTitle);
        const fbTagG = RankToolEscapeHtml(T.fbGlobalTagCn);
        const fbTagR = RankToolEscapeHtml(T.fbRegularTagCn);

        let firstBloodHTML = "";
        if (balloon.is_global_fb) {
            firstBloodHTML += thermal
                ? `<span class="fb-tag" title="${fbTitleG}">${fbTagG}</span>`
                : `<span class="fb-ico fb-global" title="${fbTitleG}">${fbSvgGlobal}</span>`;
        }
        if (balloon.is_regular_fb) {
            firstBloodHTML += thermal
                ? `<span class="fb-tag" title="${fbTitleR}">${fbTagR}</span>`
                : `<span class="fb-ico fb-regular" title="${fbTitleR}">${fbSvgRegular}</span>`;
        }

        const baseFontSize = 12;
        const landFsMul = mode === "landscape" ? Math.min(1.05, Math.max(0.72, boxHeightMm / 30)) : 1;
        const fontSize = baseFontSize * scale * landFsMul;
        const smallFontSize = fontSize * 0.82;
        const padding = Math.min(4 * scale, boxWidthMm * 0.055);
        const gap = Math.min(10 * scale, boxHeightMm * 0.065, boxWidthMm * 0.04);

        /** 标签列等宽（mm）；须晚于 padding / smallFontSize */
        const labelColMm = Math.max(11, Math.min(18 * scale, boxWidthMm * 0.3));
        const valueAvailMm = Math.max(
            6,
            boxWidthMm - 2 * padding - labelColMm - 1.5 * scale
        );
        const schoolForEllip = capStr(schoolRaw);
        const teamNameForEllip = capStr(teamNameRaw);
        const school = RankToolEscapeHtml(ellipsizeByMm(schoolForEllip, valueAvailMm, smallFontSize, 2));
        const teamName = RankToolEscapeHtml(ellipsizeByMm(teamNameForEllip, valueAvailMm, smallFontSize, 2));

        const rootCss = `
        html.balloon-print-root, html.balloon-print-root body {
            margin: 0;
            padding: 0;
            width: ${boxWidthMm}mm;
            height: ${boxHeightMm}mm;
            max-width: ${boxWidthMm}mm;
            max-height: ${boxHeightMm}mm;
            overflow: hidden;
            position: relative;
            box-sizing: border-box;
        }`;

        /** 题号徽章与首答标记统一字号（彩色/热敏两套内各自一致） */
        const markPt = fontSize * 0.98;
        const hdrMarkPt = markPt * 0.88;

        const marksCss = thermal
            ? `
        .problem-badge {
            display: inline-block;
            box-sizing: border-box;
            border: ${Math.max(0.35, 0.12 * scale)}mm solid #000;
            background: #fff;
            color: #000;
            padding: ${0.26 * scale}mm ${0.65 * scale}mm;
            font-weight: bold;
            font-size: ${markPt}pt;
            line-height: 1;
            vertical-align: middle;
        }
        .fb-tag {
            display: inline-block;
            box-sizing: border-box;
            margin-left: ${0.85 * scale}mm;
            border: ${Math.max(0.32, 0.11 * scale)}mm solid #000;
            padding: ${0.26 * scale}mm ${0.55 * scale}mm;
            font-size: ${markPt}pt;
            font-weight: bold;
            line-height: 1;
            color: #000;
            background: #fff;
            vertical-align: middle;
        }`
            : `
        .problem-badge {
            display: inline-block;
            box-sizing: border-box;
            background: #0d6efd;
            color: #fff;
            border: ${Math.max(0.2, 0.08 * scale)}mm solid #084298;
            padding: ${0.26 * scale}mm ${0.65 * scale}mm;
            border-radius: ${1.5 * scale}mm;
            font-weight: bold;
            font-size: ${markPt}pt;
            line-height: 1;
            vertical-align: middle;
        }
        .fb-ico {
            display: inline-block;
            margin-left: ${0.85 * scale}mm;
            line-height: 0;
            vertical-align: middle;
        }
        .fb-ico-svg {
            display: block;
            width: ${markPt * 1.08}pt;
            height: ${markPt * 1.08}pt;
        }`;

        const headerBadgeCss = `
        .ticket-h-c .problem-badge,
        .ticket-h-c .fb-tag,
        .land-h-c .problem-badge,
        .land-h-c .fb-tag {
            font-size: ${hdrMarkPt}pt;
            line-height: 1;
            vertical-align: middle;
        }
        .ticket-h-c .fb-ico,
        .land-h-c .fb-ico {
            margin-left: ${0.45 * scale}mm;
            line-height: 0;
            vertical-align: middle;
        }
        .ticket-h-c .fb-ico-svg,
        .land-h-c .fb-ico-svg {
            width: ${hdrMarkPt * 1.08}pt;
            height: ${hdrMarkPt * 1.08}pt;
            display: block;
        }
        .ticket-h-c .problem-badge,
        .land-h-c .problem-badge {
            padding: ${0.18 * scale}mm ${0.55 * scale}mm;
        }
        .ticket-h-c .fb-tag,
        .land-h-c .fb-tag {
            margin-left: ${0.4 * scale}mm;
            padding: ${0.16 * scale}mm ${0.45 * scale}mm;
        }`;

        const marksAllCss = `${marksCss}${headerBadgeCss}`;
        let innerHtml;
        let modeCss;

        /** 小票标签列：中文 + .en-text 英文，文案来自 BALLOON_TICKET_COPY */
        const escCopy = (v) => RankToolEscapeHtml(String(v));
        const ticketLbl = (cn, en) =>
            `<td class="ticket-label">${escCopy(cn)}<span class="en-text">${escCopy(en)}</span></td>`;

        if (mode === "landscape") {
            modeCss = `
        html.balloon-print-root body {
            font-family: "Microsoft YaHei", Arial, sans-serif;
            font-size: ${fontSize}pt;
            line-height: 1.22;
            color: #000;
        }
        .land-wrap {
            width: ${boxWidthMm}mm;
            height: ${boxHeightMm}mm;
            display: flex;
            flex-direction: column;
            padding: ${padding}mm;
            gap: ${Math.min(1.2 * scale, boxHeightMm * 0.03)}mm;
        }
        .land-header-tbl {
            width: 100%;
            border-collapse: collapse;
            table-layout: fixed;
            flex-shrink: 0;
            border-bottom: 0.35mm solid #000;
            padding-bottom: ${0.6 * scale}mm;
            margin-bottom: ${0.3 * scale}mm;
        }
        .land-header-tbl td {
            vertical-align: middle;
            padding-bottom: ${0.5 * scale}mm;
        }
        .land-h-l {
            width: 22%;
            font-weight: bold;
            font-size: ${fontSize * 1.02}pt;
            text-align: left;
        }
        .land-h-c {
            width: 56%;
            text-align: center;
            white-space: nowrap;
            overflow: hidden;
        }
        .land-h-r {
            width: 22%;
            font-size: 0.74em;
            font-weight: normal;
            font-style: italic;
            opacity: 0.86;
            text-align: right;
        }
        .land-mid {
            flex: 0 1 auto;
            min-height: 0;
            overflow: hidden;
        }
        .land-stk-tbl {
            width: 100%;
            border-collapse: collapse;
            table-layout: fixed;
        }
        .land-stk-tbl td {
            vertical-align: top;
            padding-bottom: ${gap * 0.45}mm;
        }
        .land-stk-tbl tr:last-child td {
            padding-bottom: 0;
        }
        .ticket-label {
            width: ${labelColMm}mm;
            min-width: ${labelColMm}mm;
            max-width: ${labelColMm}mm;
            font-weight: bold;
            padding-right: ${1 * scale}mm;
            white-space: nowrap;
            overflow: hidden;
        }
        .ticket-label .en-text {
            display: block;
            font-size: 0.66em;
            font-weight: normal;
            font-style: italic;
            opacity: 0.8;
            margin-top: 0.06em;
            white-space: nowrap;
        }
        .land-stk-tbl .ticket-value {
            font-weight: bold;
            word-break: break-all;
            word-wrap: break-word;
            overflow: hidden;
            font-size: ${fontSize * 1.02}pt;
            line-height: 1.2;
        }
        .land-foot-wrap {
            flex: 1 1 0;
            min-height: 0;
            overflow: hidden;
        }
        .land-foot-tbl {
            width: 100%;
            height: 100%;
            border-collapse: collapse;
            table-layout: fixed;
            font-size: ${smallFontSize}pt;
            color: #222;
        }
        .land-foot-tbl td {
            vertical-align: top;
            padding-top: ${0.4 * scale}mm;
            word-break: break-word;
            overflow: hidden;
        }
        .land-foot-tbl .ticket-value-small {
            line-height: 1.28;
            word-break: break-word;
            overflow: hidden;
        }
        ${marksAllCss}`;

            innerHtml = `
    <div class="land-wrap">
        <table class="land-header-tbl" cellpadding="0" cellspacing="0">
            <tr>
                <td class="land-h-l">${escCopy(T.headerTitleCn)}</td>
                <td class="land-h-c">
                    <span class="problem-badge">${problemAlphabet}</span>${firstBloodHTML}
                </td>
                <td class="land-h-r">${escCopy(T.headerTitleEn)}</td>
            </tr>
        </table>
        <div class="land-mid">
            <table class="ticket-tbl land-stk-tbl" cellpadding="0" cellspacing="0">
                <colgroup><col style="width:${labelColMm}mm" /><col /></colgroup>
                <tr>
                    ${ticketLbl(T.teamIdCn, T.teamIdEn)}
                    <td class="ticket-value">${teamId}</td>
                </tr>
                <tr>
                    ${ticketLbl(T.zoneCn, T.zoneEn)}
                    <td class="ticket-value">${room}</td>
                </tr>
            </table>
        </div>
        <div class="land-foot-wrap">
            <table class="ticket-tbl land-foot-tbl" cellpadding="0" cellspacing="0">
                <colgroup><col style="width:${labelColMm}mm" /><col /></colgroup>
                <tr>
                    ${ticketLbl(T.orgCn, T.orgEn)}
                    <td class="ticket-value-small">${school}</td>
                </tr>
                <tr>
                    ${ticketLbl(T.teamNameCn, T.teamNameEn)}
                    <td class="ticket-value-small">${teamName}</td>
                </tr>
            </table>
        </div>
    </div>`;
        } else {
            modeCss = `
        html.balloon-print-root body {
            font-family: "Microsoft YaHei", Arial, sans-serif;
            font-size: ${fontSize}pt;
            line-height: 1.35;
            color: #000;
        }
        .ticket-wrapper {
            width: ${boxWidthMm}mm;
            height: ${boxHeightMm}mm;
        }
        .ticket-container {
            display: flex;
            flex-direction: column;
            gap: ${gap * 0.45}mm;
            width: 100%;
            height: 100%;
            padding: ${padding}mm;
        }
        .ticket-header-tbl {
            width: 100%;
            border-collapse: collapse;
            table-layout: fixed;
            flex-shrink: 0;
            border-bottom: 0.35mm solid #000;
            margin-bottom: ${gap * 0.35}mm;
        }
        .ticket-header-tbl td {
            vertical-align: middle;
            padding-bottom: ${1.2 * scale}mm;
        }
        .ticket-h-l {
            width: 22%;
            font-weight: bold;
            font-size: ${fontSize * 1.12}pt;
            text-align: left;
        }
        .ticket-h-c {
            width: 56%;
            text-align: center;
            white-space: nowrap;
            overflow: hidden;
        }
        .ticket-h-r {
            width: 22%;
            font-size: 0.72em;
            font-weight: normal;
            font-style: italic;
            opacity: 0.82;
            text-align: right;
        }
        .ticket-content {
            display: flex;
            flex-direction: column;
            gap: ${gap * 0.45}mm;
            flex: 1 1 0;
            min-height: 0;
            overflow: hidden;
        }
        .ticket-tbl {
            width: 100%;
            border-collapse: collapse;
            table-layout: fixed;
        }
        .ticket-tbl td {
            vertical-align: top;
            padding-bottom: ${gap * 0.45}mm;
        }
        .ticket-tbl tr:last-child td {
            padding-bottom: 0;
        }
        .ticket-label {
            width: ${labelColMm}mm;
            min-width: ${labelColMm}mm;
            max-width: ${labelColMm}mm;
            font-weight: bold;
            padding-right: ${1 * scale}mm;
            white-space: nowrap;
            overflow: hidden;
        }
        .ticket-label .en-text {
            display: block;
            font-size: 0.66em;
            font-weight: normal;
            font-style: italic;
            opacity: 0.8;
            margin-top: 0.06em;
            white-space: nowrap;
        }
        .ticket-value {
            word-break: break-all;
            word-wrap: break-word;
            overflow: hidden;
            font-weight: bold;
        }
        .ticket-meta {
            flex: 1 1 0;
            min-height: 0;
            overflow: hidden;
        }
        .ticket-meta .ticket-tbl td {
            padding-bottom: ${gap * 0.3}mm;
        }
        .ticket-value-small {
            font-size: ${smallFontSize}pt;
            color: #333;
            overflow: hidden;
            word-break: break-word;
            line-height: 1.28;
        }
        ${marksAllCss}`;

            innerHtml = `
    <div class="ticket-wrapper">
        <div class="ticket-container">
            <table class="ticket-header-tbl" cellpadding="0" cellspacing="0">
                <tr>
                    <td class="ticket-h-l">${escCopy(T.headerTitleCn)}</td>
                    <td class="ticket-h-c">
                        <span class="problem-badge">${problemAlphabet}</span>${firstBloodHTML}
                    </td>
                    <td class="ticket-h-r">${escCopy(T.headerTitleEn)}</td>
                </tr>
            </table>
            <div class="ticket-content">
                <table class="ticket-tbl" cellpadding="0" cellspacing="0">
                    <colgroup><col style="width:${labelColMm}mm" /><col /></colgroup>
                    <tr>
                        ${ticketLbl(T.teamIdCn, T.teamIdEn)}
                        <td class="ticket-value">${teamId}</td>
                    </tr>
                    <tr>
                        ${ticketLbl(T.zoneCn, T.zoneEn)}
                        <td class="ticket-value">${room}</td>
                    </tr>
                </table>
                <div class="ticket-meta">
                    <table class="ticket-tbl" cellpadding="0" cellspacing="0">
                        <colgroup><col style="width:${labelColMm}mm" /><col /></colgroup>
                        <tr>
                            ${ticketLbl(T.orgCn, T.orgEn)}
                            <td class="ticket-value-small">${school}</td>
                        </tr>
                        <tr>
                            ${ticketLbl(T.teamNameCn, T.teamNameEn)}
                            <td class="ticket-value-small">${teamName}</td>
                        </tr>
                    </table>
                </div>
            </div>
        </div>
    </div>`;
        }

        const html = `<!DOCTYPE html>
<html class="balloon-print-root ${rootModeClass}">
<head>
    <meta charset="UTF-8">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        ${rootCss}
        ${modeCss}
    </style>
</head>
<body>
${innerHtml}
</body>
</html>`;

        return html;
    },
    
    /**
     * 获取页面尺寸（毫米）。返回对象的语义固定为：
     * - width：纸宽（卷宽，一行字左右方向）
     * - height：走纸长度（送纸方向，多行上下堆叠）
     * - layoutWidthTrimMm：纸宽缩减（毫米），仅从标称纸宽参与排版计算时扣除；`SET_PRINT_PAGESIZE` 仍用 width。
     * `layout.rotated` 时小票为横版 HTML（`generateTicketHTML(...,'landscape')`），与物理格 th×tw 一致；不再使用整页旋转 API。
     */
    getPageSize: function() {
        const wEl = document.getElementById("balloon-print-paper-width-mm");
        const fEl = document.getElementById("balloon-print-paper-feed-mm");
        const trimEl = document.getElementById("balloon-print-paper-width-trim-mm");
        const readMm = (v, fallback) => {
            const n = parseFloat(v);
            return !isNaN(n) && n > 0 ? n : fallback;
        };
        const readTrimMm = (v) => {
            const n = parseFloat(v);
            if (isNaN(n) || n < 0) {
                return 0;
            }
            return Math.min(20, n);
        };
        const paperWidthMm = wEl ? readMm(wEl.value, 57) : 57;
        const paperFeedMm = fEl ? readMm(fEl.value, 50) : 50;
        const layoutWidthTrimMm = trimEl ? readTrimMm(trimEl.value) : 0;
        return { width: paperWidthMm, height: paperFeedMm, layoutWidthTrimMm: layoutWidthTrimMm };
    },
    
    /**
     * 获取每页数量
     */
    getPerPage: function() {
        const perPageInput = document.getElementById('balloon-print-per-page');
        return parseInt(perPageInput?.value || 1);
    }
};

