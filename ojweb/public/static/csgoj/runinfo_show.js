/**
 * 运行信息查看器类
 * 提供运行结果详情展示功能
 */
class RuninfoViewer {
    constructor() {
        this.modalElement = document.getElementById('runinfo_show_modal');
        this.errorDetailModalElement = document.getElementById('runinfo_error_detail_modal');
        this.modal = new bootstrap.Modal(this.modalElement);
        this.errorDetailModal = new bootstrap.Modal(this.errorDetailModalElement);
        this.contentContainer = document.getElementById('runinfo_viewer_content');
        this.titleElement = document.getElementById('runinfo_show_modal_title');
        this.solutionIdBadge = document.getElementById('runinfo_solution_id');
        this.errorDetailContent = document.getElementById('runinfo_error_detail_content');
        this.loadedCaseDetail = new Set(); // 记录已加载的展开内容，避免重复请求
        this.detailDataMap = new Map(); // detailKey -> {caseName, userOut, userOutTrunc, userOutMaxBytes, outHashFromJudge}

        this.modalElement.addEventListener('hide.bs.modal', () => {
            if (this.errorDetailModalElement && this.errorDetailModalElement.classList.contains('show')) {
                this.errorDetailModal.hide();
            }
        });
    }

    /**
     * 显示运行信息
     */
    showInfo(solutionId, resultData) {
        // 更新标题和提交ID
        this.solutionIdBadge.textContent = `#${solutionId}`;
        
        if (!resultData || !resultData.data) {
            this.showError('没有详细信息<span class="en-text">No detailed information available</span>');
            return;
        }

        const payload = resultData.data;
        const dataType = (payload.data_type || '').toString().toLowerCase();
        // 获取权限信息：是否允许查看输入数据
        this.canSeeInput = payload.can_see_input !== false; // 默认为true（向后兼容）
        this.solutionId = solutionId;
        this.detailDataMap.clear();
        this.loadedCaseDetail.clear(); // 每次打开 modal 都清空，否则关闭后再次打开时展开会因“已加载”被跳过导致内容不渲染

        // 文本型：检查是否是旧格式的WA信息
        if (dataType === 'txt' || dataType === 'text') {
            const textData = payload.data || '';
            
            // ========== 【旧版 WA Info 兼容代码开始】 ==========
            // 检测是否是旧格式的WA信息
            const isLegacy = this.isLegacyWAFormat(textData);
            
            if (isLegacy) {
                this.renderLegacyWAInfo(textData);
                this.modal.show();
                return;
            }
            // ========== 【旧版 WA Info 兼容代码结束】 ==========
            // 新格式或普通文本，直接显示
            this.renderText(textData);
            this.modal.show();
            return;
        }

        // 结构化JSON：按原有结构化视图渲染
        if (dataType === 'json') {
            // 传入整个 data 对象，renderContent 会自行提取 error_summary 和 diff_comparison
            const jsonData = payload.data || {};
            if (!jsonData || (typeof jsonData === 'object' && Object.keys(jsonData).length === 0)) {
                this.showError('没有错误信息<span class="en-text">No error information available</span>');
                return;
            }
            this.renderContent(jsonData);
            this.modal.show();
            return;
        }

        // 未标注类型的后向兼容处理
        if (typeof payload.data === 'string') {
            const textData = payload.data;
            // ========== 【旧版 WA Info 兼容代码开始】 ==========
            // 检测是否是旧格式的WA信息
            if (this.isLegacyWAFormat(textData)) {
                this.renderLegacyWAInfo(textData);
                this.modal.show();
                return;
            }
            // ========== 【旧版 WA Info 兼容代码结束】 ==========
            // 普通文本，直接显示
            this.renderText(textData);
            this.modal.show();
            return;
        }

        // 兜底处理：直接传入整个 data 对象
        const fallback = payload.data || null;
        if (fallback && typeof fallback === 'object' && Object.keys(fallback).length > 0) {
            this.renderContent(fallback);
            this.modal.show();
        } else {
            this.showError('没有错误信息<span class="en-text">No error information available</span>');
        }
    }

    /**
     * 渲染运行信息内容
     */
    renderContent(data) {
        // 处理 error_summary 格式的数据（新格式）
        if (data.error_summary) {
            // 从 error_summary 中提取数据
            const errorSummary = data.error_summary;
            const failedCases = errorSummary.failed_cases || [];
            const totalFailed = errorSummary.total_failed_cases || failedCases.length;
            const errorTypeSummary = errorSummary.error_type || '';
            const errorMessageSummary = errorSummary.error_message || errorSummary.detail || '';
            
            // 检查是否有对拍结果（兼容新旧格式：diffs/diff_cases, case/test_case）
            const diffData = data.diff_comparison || {};
            const diffCases = diffData.diffs || diffData.diff_cases || [];
            const hasDiffComparison = diffCases.length > 0;
            const diffCasesMap = {};
            if (hasDiffComparison) {
                diffCases.forEach(diffCase => {
                    diffCasesMap[diffCase.case || diffCase.test_case] = diffCase;
                });
            }
            
            // 检查是否有所有测试用例的统计信息
            const testCasesStats = data.test_cases_stats;
            const allCasesInfo = testCasesStats ? (testCasesStats.cases || []) : [];
            const totalCases = testCasesStats ? (testCasesStats.total_cases || allCasesInfo.length) : 0;
            const passedCases = totalCases - totalFailed;
            
            // 先展示系统错误摘要（即使没有任何测试点数据也能看到）
            let html = '';
            if (errorTypeSummary || errorMessageSummary) {
                html += this.renderSystemErrorCard({
                    errorType: errorTypeSummary || '评测系统错误',
                    errorMessage: errorMessageSummary || '未知错误',
                    extraClass: 'mb-2'
                });
            }

            // 如果没有测试点数据，就不要渲染“failed 统计表格”那套，避免出现空白/误导
            if (failedCases.length === 0 && allCasesInfo.length === 0 && totalCases === 0) {
                if (!html) {
                    html = `
                        <div class="alert alert-secondary m-3" role="alert">
                            <i class="bi bi-info-circle me-2"></i>
                            没有可展示的测试点信息<span class="en-text">No test case details available</span>
                        </div>
                    `;
                }
                this.contentContainer.innerHTML = html;
                return;
            }

            html += `
                <div class="failed-cases-summary">
                    <div class="stats-item">
                        <div class="stats-label">
                            未通过用例数
                            <span class="en-text">Failed</span>
                        </div>
                        <div class="stats-value text-danger">${totalFailed}</div>
                    </div>`;
            
            // 如果有总测试用例数，显示通过率
            if (totalCases > 0) {
                const passRate = ((passedCases / totalCases) * 100).toFixed(1);
                html += `
                    <div class="stats-divider"></div>
                    <div class="stats-item">
                        <div class="stats-label">
                            通过率
                            <span class="en-text">Pass Rate</span>
                        </div>
                        <div class="stats-value text-primary">${passRate}%</div>
                        <div class="stats-detail text-muted">${passedCases}/${totalCases}</div>
                    </div>`;
            }
            
            html += `
                </div>`;
            
            if (failedCases.length > 0 || allCasesInfo.length > 0) {
                html += `
                    <div class="table-container">
                        <table class="table table-hover runinfo-testcases-table">
                        <thead>
                            <tr>
                                <th style="width: 40px;"></th>
                                <th>测试点<span class="en-text">Test Case</span></th>
                                <th>结果<span class="en-text">Result</span></th>
                                <th class="text-end" style="width: 100px;">时间<span class="en-text">Time</span></th>
                                <th class="text-end" style="width: 100px;">内存<span class="en-text">Memory</span></th>
                                <th class="text-end" style="width: 110px;">输入<span class="en-text">Input</span></th>
                                <th class="text-end" style="width: 110px;">输出<span class="en-text">Output</span></th>
                                <th>详细信息<span class="en-text">Details</span></th>
                            </tr>
                        </thead>
                        <tbody>`;
                
                // 如果有所有测试用例信息，显示所有测试用例（包括AC的）
                const casesToShow = allCasesInfo.length > 0 ? allCasesInfo : failedCases;
                
                casesToShow.forEach((caseInfo, index) => {
                    const testCaseName = caseInfo.test_case;
                    const judgeResult = caseInfo.judge_result;
                    const isFailed = judgeResult !== 'AC' && judgeResult !== 4;
                    
                    // 对于失败用例，从 failedCases 中获取详细信息
                    const failedCase = failedCases.find(fc => fc.test_case === testCaseName);
                    const errorDetail = failedCase ? (failedCase.judge_info || failedCase.runtime_error || '') : '';
                    const hasErrorDetail = errorDetail.length > 0;
                    const detailId = `error_detail_${index}`;
                    
                    // 检查是否有对拍数据（兼容新旧格式：ok/diff_available）
                    const diffCase = diffCasesMap[testCaseName];
                    const hasDiff = diffCase && (diffCase.ok || diffCase.diff_available);
                    
                    // 获取时间和内存信息（内存加千分位）
                    const caseTime = caseInfo.time || failedCase?.time || 0;
                    const caseMemory = caseInfo.memory || failedCase?.memory || 0;
                    const timeDisplay = caseTime > 0 ? `${caseTime}ms` : '-';
                    const memoryDisplay = caseMemory > 0 ? `${this.formatThousands(caseMemory)} KB` : '-';
                    
                    // 构建详细信息单元格
                    let detailsCellContent = this.escapeHtml(failedCase?.message || '');
                    let detailsCellClass = 'text-break';
                    let detailsCellAttr = '';
                    
                    if (hasErrorDetail) {
                        detailsCellClass += ' error-detail-cell-clickable';
                        detailsCellAttr = ` data-detail-id="${detailId}" data-error-detail="${this.escapeHtml(errorDetail)}" title="点击查看错误详情 / Click to view error details"`;
                        detailsCellContent += ` <i class="bi bi-info-circle text-primary ms-2" style="font-size: 1rem;"></i>`;
                    }
                    
                    // 行样式和属性：可展开（有对拍）整行高亮，失败无对拍整行弱化，便于区分
                    const rowClass = (isFailed && hasDiff)
                        ? 'testcase-row-expandable'
                        : (isFailed ? 'testcase-row-failed-no-diff' : '');
                    const rowAttr = (isFailed && hasDiff) ? `data-bs-toggle="collapse" data-bs-target="#collapse_${index}" aria-expanded="false" aria-controls="collapse_${index}"` : '';
                    const rowStyle = (isFailed && hasDiff) ? 'cursor: pointer;' : '';
                    
                    // 图标列内容
                    let iconContent = '';
                    if (isFailed && hasDiff) {
                        iconContent = `<i class="bi bi-chevron-right testcase-expand-icon" style="transition: transform 0.2s ease;"></i>`;
                    } else if (isFailed) {
                        // 检查是否在跳过列表中
                        const skippedList = diffData.skipped || diffData.skipped_cases || [];
                        const skippedCase = skippedList.find(sc => (sc.case || sc.test_case) === testCaseName);
                        if (skippedCase) {
                            const errMsg = skippedCase.err || skippedCase.reason || '';
                            iconContent = `<i class="bi bi-dash-circle text-muted" title="${this.escapeHtml(errMsg)}"></i>`;
                        } else {
                            iconContent = `<i class="bi bi-dash-circle text-muted" title="无对拍数据"></i>`;
                        }
                    }
                    
                    // 结果标签颜色：与 status 配色体系一致（res_color: success/danger/warning/info...）
                    const resultBadgeClass = this.getBadgeClassByResColor(this.getResColorByJudgeResult(judgeResult));
                    
                    html += `
                        <tr class="${rowClass}" ${rowAttr} style="${rowStyle}" data-case-name="${this.escapeHtml(testCaseName)}">
                            <td class="text-center">${iconContent}</td>
                            <td class="font-monospace">${testCaseName}</td>
                            <td><span class="badge ${resultBadgeClass}">${judgeResult}</span></td>
                            <td class="text-end font-monospace small">${timeDisplay}</td>
                            <td class="text-end font-monospace small">${memoryDisplay}</td>
                            <td class="text-end font-monospace small" data-role="in-size">-</td>
                            <td class="text-end font-monospace small" data-role="out-size">-</td>
                            <td class="${detailsCellClass}"${detailsCellAttr}>${detailsCellContent}</td>
                        </tr>`;
                    
                    // 如果有对拍数据，添加展开行
                    if (isFailed && hasDiff) {
                        // 保存展开详情需要的数据（避免把用户输出塞进 DOM attribute）
                        const detailKey = `case_${index}`;
                        const userOut = (diffCase && (diffCase.act || diffCase.actual_content)) ? (diffCase.act || diffCase.actual_content) : '';
                        const userOutTrunc = !!(diffCase && (diffCase.user_output_trunc || diffCase.user_output_truncated || diffCase.trunc));
                        const userOutMaxBytes = (diffCase && diffCase.user_output_max_bytes) ? parseInt(diffCase.user_output_max_bytes, 10) : 1024;
                        const outHashFromJudge = (diffCase && diffCase.out_hash) ? diffCase.out_hash : '';
                        this.detailDataMap.set(detailKey, {
                            caseName: testCaseName,
                            userOut,
                            userOutTrunc,
                            userOutMaxBytes: userOutMaxBytes || 1024,
                            outHashFromJudge
                        });
                        html += `
                        <tr class="testcase-detail-row">
                            <td colspan="8" class="p-0 border-0">
                                <div class="collapse" id="collapse_${index}">
                                    <div class="testcase-detail-content">
                                        ${this.renderTestCaseDetail(failedCase || caseInfo, diffCase, index)}
                                    </div>
                                </div>
                            </td>
                        </tr>`;
                    }
                });
                
                html += `
                    </tbody>
                </table>
            </div>`;
                
                // 显示对拍统计信息（兼容新旧格式：total/total_diff_generated）
                if (data.diff_comparison) {
                    const totalDiff = diffData.total || diffData.total_diff_generated || 0;
                    const totalFailed = diffData.total_failed || failedCases.length;
                    const maxDiff = diffData.max_diff_cases || 5;
                    html += `
                        <div class="alert alert-info m-3">
                            <i class="bi bi-info-circle me-2"></i>
                            对拍统计：已生成 ${totalDiff} 个对拍结果（共 ${totalFailed} 个失败用例，最多显示 ${maxDiff} 个）
                            <span class="en-text">Diff Statistics: Generated ${totalDiff} diff comparisons (${totalFailed} failed cases, max ${maxDiff} shown)</span>
                        </div>
                    `;
                }
            }
            
            this.contentContainer.innerHTML = html;
            this.bindErrorDetailButtons();
            this.bindCollapseEvents();
            this.loadCollapsedTestdataSizes().catch(() => {});
            return;
        }
        
        // 检查是否是系统错误信息（error_summary格式）
        if (data.error_type || data.error_message || data.error_code) {
            // 系统错误信息显示
            let html = this.renderSystemErrorCard({
                errorType: data.error_type || '评测系统错误',
                errorMessage: data.error_message || data.detail || '未知错误',
                errorCode: data.error_code || ''
            });
            
            this.contentContainer.innerHTML = html;
            return;
        }
        
        // 原有的测试用例失败信息显示逻辑
        // 构建结果视图
        let html = `
                <div class="failed-cases-summary">
                    <div class="title">
                        未通过用例数
                        <span class="en-text">Failed Test Cases</span>
                    </div>
                    <div class="count">${data.total_failed_cases || 0}</div>
                </div>`;
        
        // 检查是否有对拍结果（兼容新旧格式）
        const diffData2 = data.diff_comparison || {};
        const diffCases2 = diffData2.diffs || diffData2.diff_cases || [];
        const hasDiffComparison = diffCases2.length > 0;
        const diffCasesMap = {};
        if (hasDiffComparison) {
            diffCases2.forEach(diffCase => {
                diffCasesMap[diffCase.case || diffCase.test_case] = diffCase;
            });
        }
        
        // 检查是否有所有测试用例的统计信息（旧格式）
        const testCasesStats2 = data.test_cases_stats;
        const allCasesInfo2 = testCasesStats2 ? (testCasesStats2.cases || []) : [];
        
        if (data.failed_cases && data.failed_cases.length > 0) {
            html += `
                <div class="table-container">
                    <table class="table table-hover">
                    <thead>
                        <tr>
                                <th>测试点<span class="en-text">Test Case</span></th>
                                <th>结果<span class="en-text">Result</span></th>
                                <th class="text-end" style="width: 100px;">时间<span class="en-text">Time</span></th>
                                <th class="text-end" style="width: 100px;">内存<span class="en-text">Memory</span></th>
                                <th class="text-end" style="width: 110px;">输入<span class="en-text">Input</span></th>
                                <th class="text-end" style="width: 110px;">输出<span class="en-text">Output</span></th>
                                <th>详细信息<span class="en-text">Details</span></th>
                                ${hasDiffComparison ? '<th>对拍<span class="en-text">Diff</span></th>' : ''}
                        </tr>
                    </thead>
                    <tbody>`;
            
            // 如果有所有测试用例信息，显示所有测试用例（包括AC的）
            const casesToShow2 = allCasesInfo2.length > 0 ? allCasesInfo2 : data.failed_cases;
            
            casesToShow2.forEach((caseInfo, index) => {
                const testCaseName = caseInfo.test_case;
                const failedCase = data.failed_cases.find(fc => fc.test_case === testCaseName) || caseInfo;
                // 获取错误详情字段（judge_info 或 runtime_error）
                const errorDetail = failedCase.judge_info || failedCase.runtime_error || '';
                const hasErrorDetail = errorDetail.length > 0;
                
                // 生成唯一ID用于按钮绑定
                const detailId = `error_detail_${index}`;
                
                // 详细信息单元格：显示消息，如果有错误详情则整个单元格可点击
                let detailsCellContent = this.escapeHtml(failedCase.message || '');
                let detailsCellClass = 'text-break';
                let detailsCellAttr = '';
                
                if (hasErrorDetail) {
                    detailsCellClass += ' error-detail-cell-clickable';
                    detailsCellAttr = ` data-detail-id="${detailId}" data-error-detail="${this.escapeHtml(errorDetail)}" title="点击查看错误详情 / Click to view error details"`;
                    detailsCellContent += ` <i class="bi bi-info-circle text-primary ms-2" style="font-size: 1rem;"></i>`;
                }
                
                // 获取时间和内存信息（内存加千分位）
                const caseTime2 = caseInfo.time || failedCase.time || 0;
                const caseMemory2 = caseInfo.memory || failedCase.memory || 0;
                const timeDisplay2 = caseTime2 > 0 ? `${caseTime2}ms` : '-';
                const memoryDisplay2 = caseMemory2 > 0 ? `${this.formatThousands(caseMemory2)} KB` : '-';
                
                // 结果标签颜色：与 status 配色体系一致（res_color: success/danger/warning/info...）
                const judgeResult2 = caseInfo.judge_result || failedCase.judge_result;
                const resultBadgeClass2 = this.getBadgeClassByResColor(this.getResColorByJudgeResult(judgeResult2));
                
                // 对拍列
                let diffCellContent = '';
                const diffCase = diffCasesMap[testCaseName];
                if (diffCase && (diffCase.ok || diffCase.diff_available)) {
                    const diffModalId = `diff_modal_${index}`;
                    diffCellContent = `
                        <button class="btn btn-sm btn-outline-primary" 
                                data-bs-toggle="modal" 
                                data-bs-target="#${diffModalId}"
                                title="查看对拍结果 / View diff comparison">
                            <i class="bi bi-arrow-left-right"></i>
                        </button>
                    `;
                    // 将对拍数据存储到按钮的data属性中，供modal使用
                    html += `
                        <div class="modal fade" id="${diffModalId}" tabindex="-1" aria-hidden="true">
                            <div class="modal-dialog modal-xl">
                                <div class="modal-content">
                                    <div class="modal-header">
                                        <h5 class="modal-title">
                                            对拍结果 - ${this.escapeHtml(testCaseName)}
                                            <span class="en-text">Diff Comparison</span>
                                        </h5>
                                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                                    </div>
                                    <div class="modal-body">
                                        ${this.renderDiffComparison(diffCase)}
                                    </div>
                                </div>
                            </div>
                        </div>
                    `;
                } else {
                    // 检查是否在跳过的列表中（兼容新旧格式）
                    const skippedList2 = diffData2.skipped || diffData2.skipped_cases || [];
                    const skippedCase = skippedList2.find(sc => (sc.case || sc.test_case) === testCaseName);
                    if (skippedCase) {
                        const errMsg = skippedCase.err || skippedCase.reason || '';
                        diffCellContent = `
                            <span class="text-muted small" title="${this.escapeHtml(errMsg)}">
                                ${this.escapeHtml(errMsg.length > 20 ? errMsg.substring(0, 20) + '...' : errMsg)}
                            </span>
                        `;
                    }
                }
                
                html += `
                        <tr data-case-name="${this.escapeHtml(testCaseName)}">
                            <td class="font-monospace">${testCaseName}</td>
                            <td><span class="badge ${resultBadgeClass2}">${judgeResult2}</span></td>
                            <td class="text-end font-monospace small">${timeDisplay2}</td>
                            <td class="text-end font-monospace small">${memoryDisplay2}</td>
                            <td class="text-end font-monospace small" data-role="in-size">-</td>
                            <td class="text-end font-monospace small" data-role="out-size">-</td>
                            <td class="${detailsCellClass}"${detailsCellAttr}>${detailsCellContent}</td>
                            ${hasDiffComparison ? `<td>${diffCellContent}</td>` : ''}
                        </tr>`;
            });
            
            html += `
                    </tbody>
                </table>
            </div>`;
            
            // 显示对拍统计信息（兼容新旧格式）
            if (data.diff_comparison) {
                const totalDiff = diffData2.total || diffData2.total_diff_generated || 0;
                const totalFailed = diffData2.total_failed || data.failed_cases?.length || 0;
                const maxDiff = diffData2.max_diff_cases || 5;
                html += `
                    <div class="alert alert-info m-3">
                        <i class="bi bi-info-circle me-2"></i>
                        对拍统计：已生成 ${totalDiff} 个对拍结果（共 ${totalFailed} 个失败用例，最多显示 ${maxDiff} 个）
                        <span class="en-text">Diff Statistics: Generated ${totalDiff} diff comparisons (${totalFailed} failed cases, max ${maxDiff} shown)</span>
                    </div>
                `;
            }
        }

        this.contentContainer.innerHTML = html;
        
        // 绑定错误详情单元格事件
        this.bindErrorDetailButtons();
        
        // 绑定展开/收起图标旋转事件
        this.bindCollapseEvents();
        this.loadCollapsedTestdataSizes().catch(() => {});
    }

    /**
     * 为“收起状态”的测试点表格填充 .in/.out 文件尺寸（字节）
     * - 使用 testdatafile_ajax 的 data.size
     * - 用 max_bytes=1 触发最小读取，避免拉取大内容
     */
    async loadCollapsedTestdataSizes() {
        if (!this.canSeeInput) return;

        const rows = this.contentContainer.querySelectorAll('tr[data-case-name]');
        if (!rows || rows.length === 0) return;
        const caseNames = [];
        rows.forEach((row) => {
            const caseName = row.getAttribute('data-case-name') || '';
            if (caseName) caseNames.push(caseName);
        });
        if (caseNames.length === 0) return;

        const res = await this.fetchTestDataSizes(caseNames);
        const data = res?.data || {};
        if (!(res?.code === 1 && data?.ok === 1 && data?.sizes)) return;

        rows.forEach((row) => {
            const caseName = row.getAttribute('data-case-name') || '';
            if (!caseName) return;
            const s = data.sizes[caseName];
            if (!s) return;

            const inCell = row.querySelector('[data-role="in-size"]');
            const outCell = row.querySelector('[data-role="out-size"]');
            if (inCell && (inCell.textContent || '').trim() === '-' && s.in !== null && s.in !== undefined) {
                inCell.textContent = `${this.formatThousands(s.in)} B`;
            }
            if (outCell && (outCell.textContent || '').trim() === '-' && s.out !== null && s.out !== undefined) {
                outCell.textContent = `${this.formatThousands(s.out)} B`;
            }
        });
    }

    /**
     * 获取测试数据文件内容（.in/.out），从 web 端评测数据目录读取
     */
    async fetchTestDataFile(caseName, kind, maxBytes = 1024) {
        const cfg = window.statusPageConfig || {};
        const module = cfg.module || 'csgoj';
        const controller = (cfg.status_page_where === 'contest') ? 'contest' : 'status';
        const url = `/${module}/${controller}/testdatafile_ajax`;
        return await csg.get({
            url,
            data: {
                solution_id: String(this.solutionId || ''),
                case: String(caseName || ''),
                kind: String(kind || ''),
                max_bytes: parseInt(maxBytes, 10) || 1024,
                cid: String(cfg.cid || 'x') // 兼容比赛路由（后端可忽略）
            },
            dtype: 'json'
        });
    }

    /**
     * 批量获取多个 case 的 in/out 尺寸（字节）
     */
    async fetchTestDataSizes(cases) {
        const cfg = window.statusPageConfig || {};
        const module = cfg.module || 'csgoj';
        const controller = (cfg.status_page_where === 'contest') ? 'contest' : 'status';
        const url = `/${module}/${controller}/testdatafilesizes_ajax`;
        const caseList = Array.isArray(cases) ? cases : [];
        return await csg.get({
            url,
            data: {
                solution_id: String(this.solutionId || ''),
                cases: caseList.join(','),
                cid: String(cfg.cid || 'x')
            },
            dtype: 'json'
        });
    }

    /**
     * 数字加千分位分隔符（用于输入/输出列等字节数显示）
     */
    formatThousands(n) {
        if (n == null || n === '') return '';
        const s = String(Number(n));
        if (!/^\d+$/.test(s)) return s;
        return s.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    }

    /**
     * HTML转义
     */
    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * 将测试点 judge_result 统一映射到与 Status 页一致的 res_color（来源：CsgojConfig.OJ_RESULTS_HTML）
     * 支持字符串（AC/WA/RE...）与数字（4/6/10...）
     */
    getResColorByJudgeResult(judgeResult) {
        const v = (judgeResult ?? '').toString().trim().toUpperCase();
        const n = (typeof judgeResult === 'number' || /^\d+$/.test(v)) ? parseInt(v, 10) : null;

        // 统一到结果 code（与后端一致：4 AC, 5 PE, 6 WA, 7 TLE, 8 MLE, 9 OLE, 10 RE, 11 CE, 90 JF）
        let code = n;
        if (code === null) {
            if (v === 'AC') code = 4;
            else if (v === 'PE') code = 5;
            else if (v === 'WA') code = 6;
            else if (v === 'TLE') code = 7;
            else if (v === 'MLE') code = 8;
            else if (v === 'OLE') code = 9;
            else if (v === 'RE') code = 10;
            else if (v === 'CE') code = 11;
            else if (v === 'JF') code = 90;
        }

        // 与 CsgojConfig.OJ_RESULTS_HTML 保持一致
        if (code === 4) return 'success';
        if (code === 5 || code === 6) return 'danger';
        if (code === 7 || code === 8 || code === 9 || code === 10) return 'warning'; // RE 也是 warning（不是灰色）
        if (code === 11 || code === 90) return 'info';
        return 'default';
    }

    /**
     * 将 res_color 转成 Bootstrap badge class（与 status 的 btn/text 配色体系对齐）
     */
    getBadgeClassByResColor(resColor) {
        const c = (resColor || '').toString().trim().toLowerCase();
        if (c === 'success') return 'bg-success';
        if (c === 'danger') return 'bg-danger';
        if (c === 'warning') return 'bg-warning text-dark';
        if (c === 'info') return 'bg-info text-dark';
        if (c === 'secondary') return 'bg-secondary';
        // status 里 default 是灰系；badge 用 secondary 对齐
        return 'bg-secondary';
    }

    /**
     * 统一的“评测系统错误”卡片（避免各处重复拼 HTML）
     */
    renderSystemErrorCard({ errorType, errorMessage, errorCode, extraClass = '' }) {
        const type = errorType || '评测系统错误';
        const msg = errorMessage || '未知错误';
        return `
            <div class="alert alert-danger m-3 ${extraClass}" role="alert">
                <h5 class="alert-heading mb-2">
                    <i class="bi bi-exclamation-triangle me-2"></i>
                    ${this.escapeHtml(type)}
                    <span class="en-text">Judge System Error</span>
                </h5>
                <pre class="runinfo-error-pre">${this.escapeHtml(msg)}</pre>
                ${errorCode ? `<p class="mt-2 mb-0 text-muted small">错误代码: <code>${this.escapeHtml(errorCode)}</code> <span class="en-text">Error Code</span></p>` : ''}
            </div>
        `;
    }

    /**
     * 绑定错误详情单元格点击事件
     */
    bindErrorDetailButtons() {
        const detailCells = this.contentContainer.querySelectorAll('.error-detail-cell-clickable');
        detailCells.forEach(cell => {
            cell.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                
                const errorDetail = cell.getAttribute('data-error-detail');
                if (!errorDetail) return;

                this.showErrorDetail(errorDetail);
            });
        });
    }

    showErrorDetail(errorDetail) {
        if (!this.errorDetailContent || !this.errorDetailModal) return;
        this.errorDetailContent.textContent = errorDetail;
        this.errorDetailModal.show();
    }
    
    /**
     * 绑定展开/收起图标旋转事件
     */
    bindCollapseEvents() {
        const expandableRows = this.contentContainer.querySelectorAll('.testcase-row-expandable');
        expandableRows.forEach(row => {
            const icon = row.querySelector('.testcase-expand-icon');
            if (!icon) return;
            
            // 获取关联的 collapse 元素
            const targetId = row.getAttribute('data-bs-target');
            if (!targetId) return;
            
            const collapseElement = document.querySelector(targetId);
            if (!collapseElement) return;
            
            // 监听展开事件
            collapseElement.addEventListener('show.bs.collapse', () => {
                icon.style.transform = 'rotate(90deg)';
                // 首次展开时加载输入/标准输出并渲染 diff
                const detailRoot = collapseElement.querySelector('.testcase-detail-root');
                if (detailRoot) {
                    const key = detailRoot.getAttribute('data-detail-key');
                    if (key && !this.loadedCaseDetail.has(key)) {
                        this.loadedCaseDetail.add(key);
                        this.loadAndRenderCaseDetail(detailRoot).catch(() => {
                            // 失败时允许下次重试
                            this.loadedCaseDetail.delete(key);
                        });
                    }
                }
            });
            
            // 监听收起事件
            collapseElement.addEventListener('hide.bs.collapse', () => {
                icon.style.transform = 'rotate(0deg)';
            });
        });
    }

    /**
     * 加载并渲染单个测试点详情：.in/.out（截断+hash），以及与用户输出片段的 diff
     */
    async loadAndRenderCaseDetail(detailRoot) {
        const key = detailRoot.getAttribute('data-detail-key') || '';
        const meta = key ? this.detailDataMap.get(key) : null;
        const caseName = meta?.caseName || '';
        const outHashFromJudge = meta?.outHashFromJudge || '';
        const userOutMaxBytes = meta?.userOutMaxBytes || 1024;
        const userOutText = meta?.userOut || '';
        const userOutTrunc = !!meta?.userOutTrunc;

        const inputBox = detailRoot.querySelector('[data-role="input-box"]');
        const diffBox = detailRoot.querySelector('[data-role="diff-box"]');
        const metaBar = detailRoot.querySelector('[data-role="meta-bar"]');

        // 1) 输入数据（权限控制）
        if (this.canSeeInput && inputBox) {
            inputBox.innerHTML = `<div class="text-muted small">加载中... <span class="en-text">Loading</span></div>`;
            const inRes = await this.fetchTestDataFile(caseName, 'in', 1024);
            const inData = inRes?.data || {};
            if (inRes?.code === 1 && inData?.ok === 1) {
                const inMaxBytesFmt = this.formatThousands(inData.max_bytes);
                const truncHint = inData.truncated ? `
                    <div class="d-flex align-items-start gap-2 mt-2">
                        <span class="badge bg-warning text-dark">
                            <i class="bi bi-exclamation-triangle me-1"></i>
                            输入已截断<span class="en-text">Truncated</span>
                        </span>
                        <div class="small text-muted">
                            <span style="font-size:22px;line-height:1" class="me-1">……</span>
                            末尾内容已省略，仅展示前 ${inMaxBytesFmt} B。
                            <span class="en-text">Tail is omitted; showing first ${inMaxBytesFmt} bytes.</span>
                        </div>
                    </div>
                ` : '';
                inputBox.innerHTML = `
                    <div class="d-flex align-items-center mb-2">
                        <i class="bi bi-box-arrow-in-down text-primary me-2"></i>
                        <strong>输入数据</strong><span class="en-text ms-2">Input</span>
                    </div>
                    ${this.renderTestInputTable(inData.content || '')}
                    ${truncHint}
                `;
            } else {
                inputBox.innerHTML = `<div class="text-muted small">无法读取输入数据 <span class="en-text">Cannot read input</span></div>`;
            }
        } else if (inputBox) {
            inputBox.innerHTML = '';
        }

        // 2) 标准输出（.out）— 同样按 1KB 截断
        // 不显示标准输出原文：只用于生成“输出对比表格”
        if (this.canSeeInput) {
            const outRes = await this.fetchTestDataFile(caseName, 'out', 1024);
            const outData = outRes?.data || {};
            let outText = '';
            let outHashNow = '';
            let outTrunc = false;
            let outMaxBytes = 1024;
            if (outRes?.code === 1 && outData?.ok === 1) {
                outText = outData.content || '';
                outHashNow = outData.sha256 || '';
                outTrunc = !!outData.truncated;
                outMaxBytes = parseInt(outData.max_bytes || '1024', 10) || 1024;
                const stale = (outHashFromJudge && outHashNow && outHashFromJudge !== outHashNow);
                // meta-bar：集中放截断/过期提示（你要表格为主）
                const staleBadge = stale ? `<span class="badge bg-danger">数据可能已变化</span>` : '';
                if (metaBar) {
                    metaBar.innerHTML = `
                        ${staleBadge}
                        ${stale ? `<span class="text-danger small">.out 哈希与评测时不一致，可能已更新<span class="en-text">Hash mismatch</span></span>` : ''}
                    `;
                }

                // 3) diff：标准输出(截断片段) vs 用户输出(截断片段)
                if (diffBox) {
                    diffBox.innerHTML = this.renderInlineDiffComparison({
                        expected_content: outText,
                        actual_content: userOutText,
                        expected_truncated: outTrunc,
                        actual_truncated: userOutTrunc,
                        expected_max_bytes: outMaxBytes,
                        actual_max_bytes: userOutMaxBytes
                    });

                    // “标准输出已截断”提示固定放在“输出对比”的末尾（表格外、滚动区外）
                    if (outTrunc) {
                        const already = diffBox.querySelector('[data-role="out-trunc-hint"]');
                        if (!already) {
                            const outMaxBytesFmt = this.formatThousands(outMaxBytes);
                            diffBox.insertAdjacentHTML('beforeend', `
                                <div class="d-flex align-items-start gap-2 mt-2" data-role="out-trunc-hint">
                                    <span class="badge bg-warning text-dark">
                                        <i class="bi bi-exclamation-triangle me-1"></i>
                                        标准输出已截断(前${outMaxBytesFmt} B)<span class="en-text">Truncated</span>
                                    </span>
                                    <div class="small text-muted">
                                        <span style="font-size:22px;line-height:1" class="me-1">……</span>
                                        末尾内容已省略，当前对比基于已返回片段。
                                        <span class="en-text">Tail is omitted; diff uses returned snippets.</span>
                                    </div>
                                </div>
                            `);
                        }
                    }
                }
            } else {
                if (diffBox) diffBox.innerHTML = '';
            }
        } else {
            if (diffBox) diffBox.innerHTML = '';
        }
    }

    /**
     * 将输入文本渲染为“带行号”的表格（复用 runinfo_show.css 的 test-input-table 样式）
     */
    renderTestInputTable(text) {
        const content = (text ?? '').toString();
        const lines = content.split('\n');
        let html = `
            <div class="test-input-container">
                <table class="test-input-table">
                    <tbody>
        `;
        lines.forEach((line, idx) => {
            const lineNum = idx + 1;
            html += `
                <tr class="test-input-line">
                    <td class="diff-line-number">${lineNum}</td>
                    <td class="test-input-content">${this.escapeHtml(line)}</td>
                </tr>
            `;
        });
        html += `
                    </tbody>
                </table>
            </div>
        `;
        return html;
    }

    /**
     * 文本结果渲染（代码块）
     */
    renderText(text) {
        const escaped = (text ?? '').toString()
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
        // 不用class标识语言，让hljs自动识别。无论标 language-plaintext 还是 language-txt，都会报 warning，反正hljs不认识。
        this.contentContainer.innerHTML = `
            <div class="p-3">
                <pre class="mb-0"><code>${escaped}</code></pre>
            </div>`;
        // 应用 highlight.js 高亮（纯文本统一样式）
        const codeElement = this.contentContainer.querySelector('code');
        if (codeElement) {
            hljs.highlightElement(codeElement);
        }
    }

    /**
     * 显示错误信息
     */
    showError(message) {
        this.contentContainer.innerHTML = `
            <div class="alert alert-info m-3" role="alert">
                <i class="bi bi-info-circle me-2"></i>
                ${message}
            </div>`;
        this.modal.show();
    }
    
    /**
     * ========================================================================
     * 【旧版 WA Info 兼容代码 - 可删除】
     * 检测是否是旧格式的WA信息
     * @param {string} text - 待检测的文本
     * @returns {boolean} 是否是旧格式
     * ========================================================================
     */
    isLegacyWAFormat(text) {
        if (!text || typeof text !== 'string') {
            return false;
        }
        
        // 旧格式的核心特征（必须全部满足）：
        // 1. 包含 ========[test_name.out]========= 模式（这是最明显的特征）
        // 2. 包含 ------test in top XXX bytes------ 输入数据标记
        // 3. 包含 ------diff out top XXX bytes----- diff数据标记
        // 4. 包含标准的diff格式：--- 和 +++ 开头的文件头
        // 5. 包含 @@ 开头的hunk头（diff的核心特征）
        
        // 检测核心特征
        const hasTestSection = /========\[[^\]]+\]=========/.test(text);
        const hasInputSection = /------test in top \d+ bytes------/.test(text);
        const hasDiffSection = /------diff out top \d+ bytes-----/.test(text);
        const hasDiffHeaders = /^--- .+$/m.test(text) && /^\+\+\+ .+$/m.test(text);
        const hasDiffHunks = /^@@ -?\d+(?:,\d+)? \+\d+(?:,\d+)? @@/m.test(text);
        
        // 所有核心特征都必须存在
        const isLegacy = hasTestSection && hasInputSection && hasDiffSection && hasDiffHeaders && hasDiffHunks;
        
        return isLegacy;
    }
    
    /**
     * ========================================================================
     * 【旧版 WA Info 兼容代码 - 可删除】
     * 解析旧格式的WA信息
     * @param {string} text - WA信息文本
     * @returns {Array} 解析后的测试用例数组
     * ========================================================================
     */
    parseLegacyWAFormat(text) {
        const testCases = [];
        
        // 使用更精确的正则来分割测试用例
        // 匹配 ========[test_name.out]========= 模式
        const testCaseRegex = /========\[([^\]]+)\]=========/g;
        let match;
        let lastIndex = 0;
        const sections = [];
        
        while ((match = testCaseRegex.exec(text)) !== null) {
            if (lastIndex < match.index) {
                sections.push({
                    name: null,
                    start: lastIndex,
                    end: match.index
                });
            }
            sections.push({
                name: match[1],
                start: match.index,
                end: match.index + match[0].length
            });
            lastIndex = match.index + match[0].length;
        }
        
        // 处理最后一个测试用例之后的内容
        if (lastIndex < text.length) {
            sections.push({
                name: null,
                start: lastIndex,
                end: text.length
            });
        }
        
        // 解析每个测试用例
        for (let i = 0; i < sections.length; i++) {
            if (!sections[i].name) continue;
            
            const testName = sections[i].name;
            // 找到下一个有名称的section或文本结尾
            let contentEnd = text.length;
            for (let j = i + 1; j < sections.length; j++) {
                if (sections[j].name) {
                    contentEnd = sections[j].start;
                    break;
                }
            }
            const contentStart = sections[i].end;
            const content = text.substring(contentStart, contentEnd);
            
            // 提取输入数据（匹配 ------test in top XXX bytes------ 后面的内容）
            const inputMatch = content.match(/------test in top \d+ bytes------\s*\n([\s\S]*?)(?=\n------diff out top|time_space_table|==============================|$)/);
            const input = inputMatch ? inputMatch[1].trim() : '';
            
            // 提取diff数据（匹配 ------diff out top XXX bytes----- 后面的内容）
            // 直到下一个测试用例、time_space_table 或 ==============================
            const diffMatch = content.match(/------diff out top \d+ bytes-----\s*\n([\s\S]*?)(?=\n========\[|time_space_table|==============================|$)/);
            const diff = diffMatch ? diffMatch[1].trim() : '';
            
            // 只要有测试用例名称和（输入或diff），就添加
            if (testName && (input || diff)) {
                testCases.push({
                    name: testName,
                    input: input,
                    diff: diff
                });
            }
        }
        
        // 提取时间空间表格（在 ============================== 之后或直接是 time_space_table:）
        let timeSpaceTable = '';
        const timeSpaceMatch1 = text.match(/==============================\s*\ntime_space_table:\s*\n([\s\S]*?)$/);
        const timeSpaceMatch2 = text.match(/time_space_table:\s*\n([\s\S]*?)$/);
        if (timeSpaceMatch1) {
            timeSpaceTable = timeSpaceMatch1[1].trim();
        } else if (timeSpaceMatch2) {
            timeSpaceTable = timeSpaceMatch2[1].trim();
        }
        
        return {
            testCases: testCases,
            timeSpaceTable: timeSpaceTable
        };
    }
    
    /**
     * ========================================================================
     * 【旧版 WA Info 兼容代码 - 可删除】
     * 解析diff内容（用于旧格式的WA信息）
     * @param {string} diffText - diff文本
     * @returns {Array} 解析后的diff行数组
     * ========================================================================
     */
    parseDiff(diffText) {
        // 先规范化 diffText：确保文件头和 hunk 头之间有换行符
        // 新版数据格式：--- sample.expected+++ sample.actual@@ ...
        // 需要在 +++ 和 @@ 之间添加换行符
        diffText = diffText.replace(/(\+\+\+ [^\n]+)(@@ )/g, '$1\n$2');
        
        const lines = diffText.split('\n');
        const diffLines = [];
        let currentHunk = null;
        
        for (const line of lines) {
            // 文件头
            if (line.startsWith('--- ')) {
                continue;
            }
            if (line.startsWith('+++ ')) {
                continue;
            }
            
            // Hunk头 @@ -start,count +start,count @@
            const hunkMatch = line.match(/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/);
            if (hunkMatch) {
                if (currentHunk) {
                    diffLines.push(currentHunk);
                }
                currentHunk = {
                    type: 'hunk',
                    oldStart: parseInt(hunkMatch[1]),
                    oldCount: parseInt(hunkMatch[2] || '1'),
                    newStart: parseInt(hunkMatch[3]),
                    newCount: parseInt(hunkMatch[4] || '1'),
                    lines: [],
                    oldLineNum: parseInt(hunkMatch[1]), // 当前旧文件行号
                    newLineNum: parseInt(hunkMatch[3])  // 当前新文件行号
                };
                continue;
            }
            
            // 普通行
            if (currentHunk) {
                if (line.startsWith('+')) {
                    currentHunk.lines.push({ 
                        type: 'add', 
                        content: line.substring(1),
                        oldLineNum: null,  // add行在旧文件中不存在
                        newLineNum: currentHunk.newLineNum++
                    });
                } else if (line.startsWith('-')) {
                    currentHunk.lines.push({ 
                        type: 'remove', 
                        content: line.substring(1),
                        oldLineNum: currentHunk.oldLineNum++,
                        newLineNum: null  // remove行在新文件中不存在
                    });
                } else if (line.startsWith(' ')) {
                    currentHunk.lines.push({ 
                        type: 'context', 
                        content: line.substring(1),
                        oldLineNum: currentHunk.oldLineNum++,
                        newLineNum: currentHunk.newLineNum++
                    });
                } else if (line === '\\ No newline at end of file') {
                    currentHunk.lines.push({ 
                        type: 'noeol', 
                        content: '',
                        oldLineNum: null,
                        newLineNum: null
                    });
                } else if (line.trim() === '') {
                    // 空行作为上下文处理
                    currentHunk.lines.push({ 
                        type: 'context', 
                        content: '',
                        oldLineNum: currentHunk.oldLineNum++,
                        newLineNum: currentHunk.newLineNum++
                    });
                } else {
                    currentHunk.lines.push({ 
                        type: 'context', 
                        content: line,
                        oldLineNum: currentHunk.oldLineNum++,
                        newLineNum: currentHunk.newLineNum++
                    });
                }
            }
        }
        
        if (currentHunk) {
            diffLines.push(currentHunk);
        }
        
        return diffLines;
    }
    
    /**
     * 前端计算diff hunks（当后端未提供unified_diff时使用）
     * @param {string} expected - 期望内容
     * @param {string} actual - 实际内容
     * @returns {Array} diff hunks数组
     */
    computeDiffHunks(expected, actual) {
        const expLines = expected.split('\n');
        const actLines = actual.split('\n');
        const maxLen = Math.max(expLines.length, actLines.length);
        
        // 简单的逐行对比算法
        const hunk = {
            type: 'hunk',
            oldStart: 1,
            newStart: 1,
            lines: []
        };
        
        for (let i = 0; i < maxLen; i++) {
            const expLine = i < expLines.length ? expLines[i] : null;
            const actLine = i < actLines.length ? actLines[i] : null;
            
            if (expLine === actLine) {
                // 相同行
                hunk.lines.push({
                    type: 'context',
                    content: expLine || '',
                    oldLineNum: i + 1,
                    newLineNum: i + 1
                });
            } else if (expLine !== null && actLine !== null) {
                // 两边都有但不同：先显示删除，再显示添加
                hunk.lines.push({
                    type: 'remove',
                    content: expLine,
                    oldLineNum: i + 1,
                    newLineNum: null
                });
                hunk.lines.push({
                    type: 'add',
                    content: actLine,
                    oldLineNum: null,
                    newLineNum: i + 1
                });
            } else if (expLine !== null) {
                // 只有期望有
                hunk.lines.push({
                    type: 'remove',
                    content: expLine,
                    oldLineNum: i + 1,
                    newLineNum: null
                });
            } else {
                // 只有实际有
                hunk.lines.push({
                    type: 'add',
                    content: actLine,
                    oldLineNum: null,
                    newLineNum: i + 1
                });
            }
        }
        
        return [hunk];
    }
    
    /**
     * ========================================================================
     * 【旧版 WA Info 兼容代码 - 可删除】
     * 渲染旧格式的WA信息
     * @param {string} text - WA信息文本
     * ========================================================================
     */
    /**
     * 渲染测试点详情（展开区域）
     * @param {Object} failedCase - 失败的测试用例
     * @param {Object} diffCase - 对拍结果数据
     * @returns {string} HTML字符串
     */
    renderTestCaseDetail(failedCase, diffCase, index) {
        const detailKey = `case_${index}`;
        let html = `
            <div class="p-3 bg-light border-top testcase-detail-root"
                 data-detail-key="${detailKey}">
                <!-- 信息栏 -->
                <div class="d-flex align-items-center gap-3 mb-3 flex-wrap">
                    <span class="badge bg-secondary">
                        <i class="bi bi-file-earmark-text me-1"></i>
                        ${this.escapeHtml(failedCase.test_case)}
                    </span>`;
        
        // 顶部信息栏不再重复展示“输出已截断”
        //（截断提示统一：选手输出截断在 meta-bar；输入/标准输出截断在输入块末尾）
        
        html += `
                </div>
        `;
        
        // 输入/标准输出不再默认渲染原文（你要“对比表格”为主）
        // 这里保留容器：展开时按需拉取 .in/.out，并用于生成对比表格；原文改为“可选查看”
        html += `
            <div class="d-flex align-items-center gap-2 mb-2 flex-wrap" data-role="meta-bar">
            </div>
            <div class="input-data-section mb-3" data-role="input-box"></div>
            <div class="diff-comparison-section mb-0" data-role="diff-box"></div>
        `;
        
        html += `
            </div>
        `;
        
        return html;
    }
    
    /**
     * 渲染行内对拍对比（双栏布局）
     * @param {Object} diffCase - 对拍结果数据
     * @returns {string} HTML字符串
     */
    renderInlineDiffComparison(diffCase) {
        // 优先使用后端提供的unified_diff，否则前端自己计算
        let diffHunks;
        if (diffCase.unified_diff) {
            diffHunks = this.parseDiff(diffCase.unified_diff);
        } else {
            const expContent = diffCase.exp || diffCase.expected_content || '';
            const actContent = diffCase.act || diffCase.actual_content || '';
            diffHunks = this.computeDiffHunks(expContent, actContent);
        }
        
        // 去重：不再额外渲染“对比基于截断片段”提示
        //（输入/标准输出/选手输出的截断提示分别在对应位置展示）

        let html = `
            <div class="diff-comparison-section">
                <div class="d-flex align-items-center justify-content-between mb-2 flex-wrap gap-2">
                    <div class="d-flex align-items-center">
                        <i class="bi bi-arrow-left-right text-primary me-2"></i>
                        <strong>输出对比</strong>
                        <span class="en-text ms-2">Output Comparison</span>
                    </div>
                </div>
                <div class="diff-container-two-column">
                    <div class="diff-column-header-row">
                        <div class="diff-column-header">
                            <i class="bi bi-check-circle text-success me-2"></i>
                            <span class="bilingual-inline fw-bold">期望输出<span class="en-text">Expected</span></span>
                        </div>
                        <div class="diff-column-header">
                            <i class="bi bi-x-circle text-danger me-2"></i>
                            <span class="bilingual-inline fw-bold">实际输出<span class="en-text">Actual</span></span>
                        </div>
                    </div>
                    <div class="diff-scroll-container">
                        <div class="diff-column diff-column-expected">
                            <table class="diff-table">
                                <tbody>
        `;
        
        // 左栏：显示 remove 和 context
        diffHunks.forEach(hunk => {
            hunk.lines.forEach(line => {
                if (line.type === 'remove' || line.type === 'context' || line.type === 'noeol') {
                    let lineClass = '';
                    if (line.type === 'remove') {
                        lineClass = 'diff-line-remove';
                    } else if (line.type === 'context') {
                        lineClass = 'diff-line-context';
                    } else {
                        lineClass = 'diff-line-noeol';
                    }
                    
                    const cleanContent = line.content;
                    const lineNum = line.oldLineNum !== null ? line.oldLineNum : '';
                    html += `
                        <tr class="diff-line ${lineClass}">
                            <td class="diff-line-number">${lineNum}</td>
                            <td class="diff-line-content">${this.escapeHtml(cleanContent)}</td>
                        </tr>
                    `;
                } else if (line.type === 'add') {
                    // add行在左栏显示为空行（占位）
                    html += `
                        <tr class="diff-line diff-line-placeholder">
                            <td class="diff-line-number"></td>
                            <td class="diff-line-content">&nbsp;</td>
                        </tr>
                    `;
                }
            });
        });
        
        html += `
                                </tbody>
                            </table>
                        </div>
                        <div class="diff-column diff-column-actual">
                            <table class="diff-table">
                                <tbody>
        `;
        
        // 右栏：显示 add 和 context
        diffHunks.forEach(hunk => {
            hunk.lines.forEach(line => {
                if (line.type === 'add' || line.type === 'context' || line.type === 'noeol') {
                    let lineClass = '';
                    if (line.type === 'add') {
                        lineClass = 'diff-line-add';
                    } else if (line.type === 'context') {
                        lineClass = 'diff-line-context';
                    } else {
                        lineClass = 'diff-line-noeol';
                    }
                    
                    const cleanContent = line.content;
                    const lineNum = line.newLineNum !== null ? line.newLineNum : '';
                    html += `
                        <tr class="diff-line ${lineClass}">
                            <td class="diff-line-number">${lineNum}</td>
                            <td class="diff-line-content">${this.escapeHtml(cleanContent)}</td>
                        </tr>
                    `;
                } else if (line.type === 'remove') {
                    // remove行在右栏显示为空行（占位）
                    html += `
                        <tr class="diff-line diff-line-placeholder">
                            <td class="diff-line-number"></td>
                            <td class="diff-line-content">&nbsp;</td>
                        </tr>
                    `;
                }
            });
        });
        
        html += `
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        return html;
    }
    
    /**
     * 渲染对拍结果（用于 Modal 弹窗，保持旧版兼容）
     * @param {Object} diffCase - 对拍结果数据
     * @returns {string} HTML字符串
     */
    renderDiffComparison(diffCase) {
        if (!diffCase || !(diffCase.ok || diffCase.diff_available)) {
            return '<div class="alert alert-warning">对拍结果不可用</div>';
        }
        
        let html = `
            <div class="diff-comparison-container">
                <div class="mb-3">
                    <small class="text-muted">
                        测试用例：<code>${this.escapeHtml(diffCase.test_case)}</code>
                        <span class="en-text">Test Case</span>
                    </small>
                    ${diffCase.user_output_truncated ? `
                        <div class="alert alert-warning mt-2 mb-0">
                            <i class="bi bi-exclamation-triangle me-1"></i>
                            用户输出过长，已截断（原始大小: ${diffCase.actual_size} bytes）
                            <span class="en-text">User output truncated (original size: ${diffCase.actual_size} bytes)</span>
                        </div>
                    ` : ''}
                </div>
        `;
        
        // 使用unified diff格式渲染
        if (diffCase.unified_diff) {
            const diffHunks = this.parseDiff(diffCase.unified_diff);
            html += `
                <div class="test-diff-section p-3">
                    <div class="small text-muted mb-2">
                        <i class="bi bi-arrow-left-right me-1"></i>
                        输出对比（Unified Diff格式）
                        <span class="en-text">Output Comparison (Unified Diff)</span>
                    </div>
                    <div class="diff-container-two-column">
                        <div class="diff-column-header-row">
                            <div class="diff-column-header">
                                <span class="bilingual-inline fw-bold">期望输出<span class="en-text">Expected</span></span>
                            </div>
                            <div class="diff-column-header">
                                <span class="bilingual-inline fw-bold">实际输出<span class="en-text">Actual</span></span>
                            </div>
                        </div>
                        <div class="diff-scroll-container">
                            <div class="diff-column diff-column-expected">
                                <table class="diff-table">
                                    <tbody>
            `;
            
            // 左栏：显示 remove 和 context
            diffHunks.forEach(hunk => {
                hunk.lines.forEach(line => {
                    if (line.type === 'remove' || line.type === 'context' || line.type === 'noeol') {
                        let lineClass = '';
                        if (line.type === 'remove') {
                            lineClass = 'diff-line-remove';
                        } else if (line.type === 'context') {
                            lineClass = 'diff-line-context';
                        } else {
                            lineClass = 'diff-line-noeol';
                        }
                        
                        const cleanContent = line.content.trim();
                        const lineNum = line.oldLineNum !== null ? line.oldLineNum : '';
                        html += `
                            <tr class="diff-line ${lineClass}">
                                <td class="diff-line-number">${lineNum}</td>
                                <td class="diff-line-content">${this.escapeHtml(cleanContent)}</td>
                            </tr>
                        `;
                    } else if (line.type === 'add') {
                        // add类型的行在左栏显示为空
                        html += `
                            <tr class="diff-line diff-line-placeholder">
                                <td class="diff-line-number"></td>
                                <td class="diff-line-content">&nbsp;</td>
                            </tr>
                        `;
                    }
                });
            });
            
            html += `
                                    </tbody>
                                </table>
                            </div>
                            <div class="diff-column diff-column-actual">
                                <table class="diff-table">
                                    <tbody>
            `;
            
            // 右栏：显示 add 和 context
            diffHunks.forEach(hunk => {
                hunk.lines.forEach(line => {
                    if (line.type === 'add' || line.type === 'context' || line.type === 'noeol') {
                        let lineClass = '';
                        if (line.type === 'add') {
                            lineClass = 'diff-line-add';
                        } else if (line.type === 'context') {
                            lineClass = 'diff-line-context';
                        } else {
                            lineClass = 'diff-line-noeol';
                        }
                        
                        const cleanContent = line.content.trim();
                        const lineNum = line.newLineNum !== null ? line.newLineNum : '';
                        html += `
                            <tr class="diff-line ${lineClass}">
                                <td class="diff-line-number">${lineNum}</td>
                                <td class="diff-line-content">${this.escapeHtml(cleanContent)}</td>
                            </tr>
                        `;
                    } else if (line.type === 'remove') {
                        // remove类型的行在右栏显示为空
                        html += `
                            <tr class="diff-line diff-line-placeholder">
                                <td class="diff-line-number"></td>
                                <td class="diff-line-content">&nbsp;</td>
                            </tr>
                        `;
                    }
                });
            });
            
            html += `
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }
        
        html += `</div>`;
        return html;
    }
    
    renderLegacyWAInfo(text) {
        const parsed = this.parseLegacyWAFormat(text);
        
        let html = '<div class="wa-info-container p-3">';
        
        // 渲染每个测试用例
        parsed.testCases.forEach((testCase, index) => {
            html += `
                <div class="test-case-card mb-4">
                    <div class="card border">
                        <div class="card-header bg-light">
                            <h6 class="mb-0">
                                <i class="bi bi-file-earmark-text me-2"></i>
                                ${this.escapeHtml(testCase.name)}
                            </h6>
                        </div>
                        <div class="card-body p-0">
            `;
            
            // 输入数据（仅管理员/教师可见）
            if (testCase.input && this.canSeeInput) {
                // 将输入数据按行分割
                const inputLines = testCase.input.split('\n');
                html += `
                    <div class="test-input-section p-3 border-bottom">
                        <div class="small text-muted mb-2">
                            <i class="bi bi-arrow-down-circle me-1"></i>
                            输入数据
                            <span class="en-text">Input Data</span>
                        </div>
                        <div class="test-input-container">
                            <table class="test-input-table">
                                <tbody>
                `;
                
                inputLines.forEach((line, index) => {
                    const lineNum = index + 1;
                    html += `
                        <tr class="test-input-line">
                            <td class="diff-line-number">${lineNum}</td>
                            <td class="test-input-content">${this.escapeHtml(line)}</td>
                        </tr>
                    `;
                });
                
                html += `
                                </tbody>
                            </table>
                        </div>
                    </div>
                `;
            }
            
            // Diff输出 - 双表格布局
            if (testCase.diff) {
                const diffHunks = this.parseDiff(testCase.diff);
                html += `
                    <div class="test-diff-section p-3">
                        <div class="small text-muted mb-2">
                            <i class="bi bi-arrow-left-right me-1"></i>
                            输出对比
                            <span class="en-text">Output Comparison</span>
                        </div>
                        <div class="diff-container-two-column">
                            <div class="diff-column-header-row">
                                <div class="diff-column-header">
                                    <span class="bilingual-inline fw-bold">期望输出<span class="en-text">Expected</span></span>
                                </div>
                                <div class="diff-column-header">
                                    <span class="bilingual-inline fw-bold">实际输出<span class="en-text">Actual</span></span>
                                </div>
                            </div>
                            <div class="diff-scroll-container">
                                <div class="diff-column diff-column-expected">
                                    <table class="diff-table">
                                        <tbody>
                `;
                
                // 左栏：显示 remove 和 context
                diffHunks.forEach(hunk => {
                    hunk.lines.forEach(line => {
                        if (line.type === 'remove' || line.type === 'context' || line.type === 'noeol') {
                            let lineClass = '';
                            if (line.type === 'remove') {
                                lineClass = 'diff-line-remove';
                            } else if (line.type === 'context') {
                                lineClass = 'diff-line-context';
                            } else {
                                lineClass = 'diff-line-noeol';
                            }
                            
                            const cleanContent = line.content.trim();
                            const lineNum = line.oldLineNum !== null ? line.oldLineNum : '';
                            html += `
                                <tr class="diff-line ${lineClass}">
                                    <td class="diff-line-number">${lineNum}</td>
                                    <td class="diff-line-content">${this.escapeHtml(cleanContent)}</td>
                                </tr>
                            `;
                        } else if (line.type === 'add') {
                            // add行在左栏显示为空行（占位）
                            html += `
                                <tr class="diff-line diff-line-placeholder">
                                    <td class="diff-line-number"></td>
                                    <td class="diff-line-content">&nbsp;</td>
                                </tr>
                            `;
                        }
                    });
                });
                
                html += `
                                        </tbody>
                                    </table>
                                </div>
                                <div class="diff-column diff-column-actual">
                                    <table class="diff-table">
                                        <tbody>
                `;
                
                // 右栏：显示 add 和 context
                diffHunks.forEach(hunk => {
                    hunk.lines.forEach(line => {
                        if (line.type === 'add' || line.type === 'context' || line.type === 'noeol') {
                            let lineClass = '';
                            if (line.type === 'add') {
                                lineClass = 'diff-line-add';
                            } else if (line.type === 'context') {
                                lineClass = 'diff-line-context';
                            } else {
                                lineClass = 'diff-line-noeol';
                            }
                            
                            const cleanContent = line.content.trim();
                            const lineNum = line.newLineNum !== null ? line.newLineNum : '';
                            html += `
                                <tr class="diff-line ${lineClass}">
                                    <td class="diff-line-number">${lineNum}</td>
                                    <td class="diff-line-content">${this.escapeHtml(cleanContent)}</td>
                                </tr>
                            `;
                        } else if (line.type === 'remove') {
                            // remove行在右栏显示为空行（占位）
                            html += `
                                <tr class="diff-line diff-line-placeholder">
                                    <td class="diff-line-number"></td>
                                    <td class="diff-line-content">&nbsp;</td>
                                </tr>
                            `;
                        }
                    });
                });
                
                html += `
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
            }
            
            html += `
                        </div>
                    </div>
            `;
        });
        
        // 时间空间表格
        if (parsed.timeSpaceTable) {
            html += `
                <div class="time-space-table-section mt-4">
                    <div class="card border">
                        <div class="card-header bg-light">
                            <h6 class="mb-0">
                                <i class="bi bi-table me-2"></i>
                                运行统计
                                <span class="en-text">Runtime Statistics</span>
                            </h6>
                        </div>
                        <div class="card-body p-3">
                            <pre class="mb-0"><code>${this.escapeHtml(parsed.timeSpaceTable)}</code></pre>
                        </div>
                    </div>
                </div>
            `;
        }
        
        html += '</div>';
        
        this.contentContainer.innerHTML = html;
    }
}

// 全局运行信息查看器实例
window.runinfoViewer = new RuninfoViewer();
