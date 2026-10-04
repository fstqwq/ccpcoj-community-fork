/**
 * 考生状态管理通用函数
 * 用于 examinee_status.php 和 contest_examinee_status.php
 * 注意：PAGE_MODULE 常量在 ex_global.js 中定义
 */

/**
 * 格式化考生账号显示（带链接）
 * 显示格式：姓名 / 账号 / 单位（复用 ex_rank 的信息块结构，但更紧凑）
 */
function FormatterExaminee(value, row, index, field) {
    const userUrl = `/${PAGE_MODULE}/contest/teaminfo?cid=${row['contest_id']}&team_id=${value}`;
    const userTitle = `查看考生信息 / View Examinee Info`;

    const nameText = (row && row['name'] != null) ? String(row['name']) : '';
    const unitText = (row && row['school'] != null) ? String(row['school']) : '';
    const roomText = (row && row['room'] != null) ? String(row['room']) : '';

    const escapeAttr = (s) => String(s).replace(/"/g, '&quot;');
    const title = `${value}${nameText ? (' | ' + nameText) : ''}${unitText ? (' | ' + unitText) : ''}${roomText ? (' | ' + roomText) : ''}`;

    return `
        <div class="examinee-name-unit" title="${escapeAttr(title)}">
            ${nameText ? `<div class="name-text text-truncate">${nameText}</div>` : ''}
            <div class="user-id-text text-muted small">
                <a href="${userUrl}" class="text-decoration-none" title="${escapeAttr(userTitle)}">${value}</a>
            </div>
            ${unitText ? `<div class="unit-text text-truncate">${unitText}</div>` : ''}
        </div>
    `;
}

/**
 * 解析 addition 字段中的 IP 信息
 * @param {Object} row - 行数据
 * @returns {Object} {currentIp: string|null, previousIps: string[], displayIp: string, isLocked: boolean, title: string}
 */
function parseIpFromAddition(row) {
    let currentIp = null;
    let previousIps = [];
    let displayIp = null;
    let isLocked = false;
    let title = '';
    
    // 解析 addition 字段
    if (row.addition) {
        let addition = null;
        try {
            if (typeof row.addition === 'string') {
                addition = JSON.parse(row.addition);
            } else if (typeof row.addition === 'object') {
                addition = row.addition;
            }
        } catch (e) {
            // JSON 解析失败，忽略
        }
        
        if (addition && typeof addition === 'object') {
            currentIp = addition.current_ip || null;
            previousIps = Array.isArray(addition.previous_ips) ? addition.previous_ips : [];
        }
    }
    
    // 确定显示的 IP 和状态
    if (currentIp) {
        displayIp = currentIp;
        isLocked = true;
        title = '当前IP（已锁定）/ Current IP (Locked)';
    } else if (previousIps.length > 0) {
        displayIp = previousIps[previousIps.length - 1]; // 显示最近一次的 IP
        isLocked = false;
        title = `历史IP（最近一次）/ Previous IP (Latest): ${previousIps.join(', ')}`;
    }
    
    return { currentIp, previousIps, displayIp, isLocked, title };
}

/**
 * 格式化 IP 显示
 * 从 addition 字段读取 IP 信息
 * 如果有当前 IP（current_ip），显示为红色按钮（已锁定）
 * 如果没有当前 IP 但有历史 IP（previous_ips），显示最近一次的 IP，用绿色显示
 */
function FormatterIp(value, row, index, field) {
    const ipInfo = parseIpFromAddition(row);
    
    if (!ipInfo.displayIp) {
        return '尚无记录';
    }
    
    if (ipInfo.isLocked) {
        // IP 已锁定：显示为红色按钮（危险色，表示已锁定）
        return `<button class="btn btn-sm btn-danger" title="${ipInfo.title}">${ipInfo.displayIp}</button>`;
    } else {
        // IP 未锁定（历史IP）：显示为绿色 badge
        return `<span class="badge bg-success" title="${ipInfo.title}">${ipInfo.displayIp}</span>`;
    }
}

/**
 * 格式化考试状态显示
 */
function FormatterExamineeStatus(value, row, index, field) {
    if(row['privilege'] == 'admin') {
        return 'Admin';
    }
    if(value == 'Y') {
        return `<button class="btn btn-sm btn-success">已交卷</button>`
    } else {
        return `<button class="btn btn-sm btn-danger">考试中</button>`
    }
}

/**
 * 处理 IP 解锁
 * @param {Object} row - 行数据
 * @param {string|number} cid - 考试ID（可选，如果 row 中有 contest_id 则不需要）
 * @param {Function} onSuccess - 成功回调函数，参数为 (team, row, $element)
 * @param {Function} onError - 错误回调函数，参数为 (ret)
 */
function HandleIpUnlock(row, cid, onSuccess, onError) {
    const ipInfo = parseIpFromAddition(row);
    let contestId = cid || row.contest_id;
    let isLocked = ipInfo.isLocked;
    let displayIp = ipInfo.displayIp || '无记录';
    
    // 构建信息表格（如果 row 中有相关信息）
    let infoTable = '';
    if(row.room || row.contest_id || row.team_id || row.name) {
        let ipRows = '';
        if (ipInfo.currentIp) {
            ipRows += `<tr class="ip-info-row-ip"><td class="ip-info-label">当前IP<span class="en-text">Current IP</span></td><td class="ip-info-value ip-info-value-ip">${ipInfo.currentIp}</td></tr>`;
        }
        if (ipInfo.previousIps.length > 0) {
            ipRows += `<tr><td class="ip-info-label">历史IP<span class="en-text">Previous IPs</span></td><td class="ip-info-value">${ipInfo.previousIps.join(', ')}</td></tr>`;
        }
        if (!ipInfo.currentIp && ipInfo.previousIps.length === 0) {
            ipRows += `<tr class="ip-info-row-ip"><td class="ip-info-label">IP<span class="en-text">IP</span></td><td class="ip-info-value ip-info-value-ip">无记录</td></tr>`;
        }
        
        infoTable = `
            <table class="ip-info-table">
                <tbody>
                    ${row.room ? `<tr><td class="ip-info-label">考场<span class="en-text">Room</span></td><td class="ip-info-value">${row.room}</td></tr>` : ''}
                    ${row.contest_id && row.contest_title ? `<tr><td class="ip-info-label">考试<span class="en-text">Exam</span></td><td class="ip-info-value">${row.contest_id} - ${row.contest_title}</td></tr>` : ''}
                    ${row.team_id && row.name ? `<tr><td class="ip-info-label">考生<span class="en-text">Examinee</span></td><td class="ip-info-value">${row.team_id} - ${row.name}</td></tr>` : ''}
                    ${ipRows}
                </tbody>
            </table>
        `;
    }
    
    // 生成 modal ID
    const modalId = 'ip-info-modal-' + Date.now();
    
    // 构建 modal body 内容
    let modalBody = '';
    let modalTitle = '';
    let modalFooter = '';
    
    if(isLocked) {
        // IP 已锁定，显示解锁确认
        modalTitle = '确认<span class="en-text">Confirm</span>';
        // 构建简化的信息表格（用于确认对话框）
        let simpleInfoTable = '';
        if (ipInfo.currentIp) {
            simpleInfoTable = `<table class="ip-info-table"><tbody><tr><td class="ip-info-label">考生<span class="en-text">Examinee</span></td><td class="ip-info-value">${row.team_id} - ${row.name}</td></tr><tr class="ip-info-row-ip"><td class="ip-info-label">当前IP<span class="en-text">Current IP</span></td><td class="ip-info-value ip-info-value-ip">${ipInfo.currentIp}</td></tr>${ipInfo.previousIps.length > 0 ? `<tr><td class="ip-info-label">历史IP<span class="en-text">Previous IPs</span></td><td class="ip-info-value">${ipInfo.previousIps.join(', ')}</td></tr>` : ''}</tbody></table>`;
        } else {
            simpleInfoTable = `<table class="ip-info-table"><tbody><tr><td class="ip-info-label">考生<span class="en-text">Examinee</span></td><td class="ip-info-value">${row.team_id} - ${row.name}</td></tr></tbody></table>`;
        }
        
        modalBody = infoTable 
            ? `<div class="ip-unlock-confirm">确定解锁考生IP?<span class="en-text">Confirm to unlock examinee IP?</span></div>${infoTable}`
            : `<div class="ip-unlock-confirm">确定解锁考生IP?<span class="en-text">Confirm to unlock examinee IP?</span></div>${simpleInfoTable}`;
        modalFooter = `
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">取消</button>
            <button type="button" class="btn btn-danger" id="${modalId}-confirm-btn">确定</button>
        `;
    } else {
        // IP 未锁定，显示信息提示
        modalTitle = 'IP信息<span class="en-text">IP Information</span>';
        // 构建信息表格（用于信息显示）
        let displayInfoTable = '';
        if (ipInfo.currentIp || ipInfo.previousIps.length > 0) {
            let ipRows = '';
            if (ipInfo.currentIp) {
                ipRows += `<tr class="ip-info-row-ip"><td class="ip-info-label">当前IP<span class="en-text">Current IP</span></td><td class="ip-info-value ip-info-value-ip">${ipInfo.currentIp}</td></tr>`;
            }
            if (ipInfo.previousIps.length > 0) {
                ipRows += `<tr><td class="ip-info-label">历史IP<span class="en-text">Previous IPs</span></td><td class="ip-info-value">${ipInfo.previousIps.join(', ')}</td></tr>`;
            }
            displayInfoTable = `<table class="ip-info-table"><tbody><tr><td class="ip-info-label">考生<span class="en-text">Examinee</span></td><td class="ip-info-value">${row.team_id} - ${row.name}</td></tr>${ipRows}</tbody></table>`;
        } else {
            displayInfoTable = `<table class="ip-info-table"><tbody><tr><td class="ip-info-label">考生<span class="en-text">Examinee</span></td><td class="ip-info-value">${row.team_id} - ${row.name}</td></tr></tbody></table>`;
        }
        
        modalBody = infoTable 
            ? `${infoTable}<div class="ip-info-status"><i class="bi bi-check-circle text-success"></i> 当前IP未锁定<span class="en-text">IP not locked</span></div>`
            : `${displayInfoTable}<div class="ip-info-status"><i class="bi bi-check-circle text-success"></i> 当前IP未锁定<span class="en-text">IP not locked</span></div>`;
        modalFooter = `<button type="button" class="btn btn-primary" data-bs-dismiss="modal">确定</button>`;
    }
    
    // 构建 modal HTML
    const modalHtml = `
        <div class="modal fade" id="${modalId}" tabindex="-1" aria-labelledby="${modalId}Label" aria-hidden="true" data-bs-backdrop="static" data-bs-keyboard="false">
            <div class="modal-dialog modal-dialog-centered">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title bilingual-inline" id="${modalId}Label">${modalTitle}</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                    </div>
                    <div class="modal-body">
                        ${modalBody}
                    </div>
                    <div class="modal-footer">
                        ${modalFooter}
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // 插入 modal HTML
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    
    // 创建并显示 modal
    const modalElement = document.getElementById(modalId);
    if (!modalElement || typeof bootstrap === 'undefined' || !bootstrap.Modal) {
        console.error('Bootstrap 5 Modal 未加载');
        return;
    }
    
    const modal = new bootstrap.Modal(modalElement, {
        backdrop: 'static',
        keyboard: false
    });
    
    // 绑定确认按钮事件（仅当 IP 已锁定时）
    if (isLocked) {
        const confirmBtn = modalElement.querySelector(`#${modalId}-confirm-btn`);
        if (confirmBtn) {
            confirmBtn.addEventListener('click', function() {
                const changeUrl = (typeof window.CSGOJ_EXAMINEE_STATUS_CHANGE_URL === 'function')
                    ? window.CSGOJ_EXAMINEE_STATUS_CHANGE_URL(contestId)
                    : `/${PAGE_MODULE}/admin/examinee_status_change_ajax?cid=${contestId}`;
                $.post(changeUrl, {
                    'team_id': row.team_id, 
                    'ip_clear': 1
                }, function(ret){
                    modal.hide();
                    if(ret['code'] == 1) {
                        let team = ret.data;
                        // 解析解锁后的 IP 信息
                        const unlockedIpInfo = parseIpFromAddition(team);
                        let successTable = '';
                        if (unlockedIpInfo.previousIps.length > 0) {
                            successTable = `<table class="ip-info-table"><tbody><tr><td class="ip-info-label">考生<span class="en-text">Examinee</span></td><td class="ip-info-value">${team.team_id} - ${team.name}</td></tr><tr><td class="ip-info-label">历史IP<span class="en-text">Previous IPs</span></td><td class="ip-info-value">${unlockedIpInfo.previousIps.join(', ')}</td></tr></tbody></table>`;
                        } else {
                            successTable = `<table class="ip-info-table"><tbody><tr><td class="ip-info-label">考生<span class="en-text">Examinee</span></td><td class="ip-info-value">${team.team_id} - ${team.name}</td></tr></tbody></table>`;
                        }
                        let successMessage = infoTable 
                            ? `<div class="ip-unlock-success">IP锁定已解除<span class="en-text">IP lock released</span></div>${infoTable}`
                            : `<div class="ip-unlock-success">IP锁定已解除<span class="en-text">IP lock released</span></div>${successTable}`;
                        alerty.success(successMessage);
                        
                        // 更新行数据
                        row.addition = team.addition;
                        
                        // 调用成功回调
                        if(onSuccess) {
                            onSuccess(team, row);
                        }
                    } else {
                        if(onError) {
                            onError(ret);
                        } else {
                            alerty.error(ret.msg);
                        }
                    }
                });
            });
        }
    }
    
    // Modal 关闭后移除 DOM 元素
    modalElement.addEventListener('hidden.bs.modal', function() {
        modalElement.remove();
    }, { once: true });
    
    // 显示 modal
    modal.show();
}

/**
 * 处理考试状态切换（交卷/恢复考试）
 * @param {Object} row - 行数据
 * @param {string|number} cid - 考试ID（可选，如果 row 中有 contest_id 则不需要）
 * @param {Function} onSuccess - 成功回调函数，参数为 (team, row, $element)
 * @param {Function} onError - 错误回调函数，参数为 (ret)
 */
function HandleDefunctToggle(row, cid, onSuccess, onError) {
    // 如果是管理员账号，不允许切换状态
    if(row['privilege'] == 'admin') {
        return;
    }
    
    let contestId = cid || row.contest_id;
    let newDefunct = row.defunct == 'Y' ? 'N' : 'Y';
    
    const changeUrl = (typeof window.CSGOJ_EXAMINEE_STATUS_CHANGE_URL === 'function')
        ? window.CSGOJ_EXAMINEE_STATUS_CHANGE_URL(contestId)
        : `/${PAGE_MODULE}/admin/examinee_status_change_ajax?cid=${contestId}`;
    $.post(changeUrl, {
        'team_id': row.team_id, 
        'defunct': newDefunct
    }, function(ret){
        if(ret['code'] == 1) {
            let team = ret.data;
            if(team.defunct == 'Y') {
                alerty.warning(`${team.team_id} - ${team.name}<br/>交卷`);
            } else {
                alerty.success(`${team.team_id} - ${team.name}<br/>恢复考试`);
            }
            
            // 更新行数据
            row.defunct = team.defunct;
            
            // 调用成功回调
            if(onSuccess) {
                onSuccess(team, row);
            }
        } else {
            if(onError) {
                onError(ret);
            } else {
                alerty.error(ret.msg);
            }
        }
    });
}

/**
 * 格式化考试题目ID显示（examsys 专属）
 * 只有管理员才能点击跳转到 OJ 题目页面
 * @param {string|number} value - problem_id（字母ID，如 A, B, C）
 * @param {Object} row - 行数据
 * @param {number} index - 行索引
 * @param {string} field - 字段名
 * @returns {string} HTML字符串
 */
function FormatterExamsysProblemId(value, row, index, field) {
    // 获取权限信息（从 statusPageConfig 获取）
    let isAdmin = false;
    if (window.statusPageConfig) {
        isAdmin = window.statusPageConfig.isAdmin || 
                  window.statusPageConfig.isContestAdmin || 
                  window.statusPageConfig.isReviewer;
    }
    
    // 获取 qid（考试题目序号）和 problem_id_oj（OJ 题目ID）
    let qid = value; // 默认使用 problem_id（字母ID）作为显示值
    let problemId = null;
    
    // 如果 row 中有 qid 字段（考试题目序号），优先使用
    if('qid' in row && row['qid'] != null && row['qid'] !== '') {
        qid = row['qid'];
    }
    
    // 如果 row 中有 problem_id_oj 字段（OJ 题目ID，数字ID）
    if('problem_id_oj' in row && row['problem_id_oj'] != null && row['problem_id_oj'] !== '') {
        problemId = row['problem_id_oj'];
    }
    
    // 只有管理员才能点击跳转
    if (isAdmin && problemId) {
        // 管理员：显示为链接，跳转到 OJ 题目页面
        const linkUrl = `/csgoj/problemset/problem?pid=${problemId}`;
        const titleText = `Qid: ${qid}, Problem ID: ${problemId}`;
        return `<a href="${linkUrl}" class="text-decoration-none" title="${titleText}" target="_blank">${qid}</a>`;
    } else {
        // 非管理员：只显示文本，不可点击
        return `<span title="Question ID: ${qid}">${qid}</span>`;
    }
}

/**
 * 格式化考试题目ID显示（管理员/教师/监考等身份，显示 Qid 和 Pid）
 * @param {string|number} value - problem_id（字母ID，如 A, B, C）
 * @param {Object} row - 行数据
 * @param {number} index - 行索引
 * @param {string} field - 字段名
 * @returns {string} HTML字符串
 */
function FormatterExamsysProblemIdWithPid(value, row, index, field) {
    // 获取权限信息（从 statusPageConfig 获取）
    let isAdmin = false;
    if (window.statusPageConfig) {
        isAdmin = window.statusPageConfig.isAdmin || 
                  window.statusPageConfig.isContestAdmin || 
                  window.statusPageConfig.isReviewer;
    }
    
    // 获取 qid（考试题目序号）和 problem_id_oj（OJ 题目ID）
    let qid = value; // 默认使用 problem_id（字母ID）作为显示值
    let problemId = null;
    
    // 如果 row 中有 qid 字段（考试题目序号），优先使用
    if('qid' in row && row['qid'] != null && row['qid'] !== '') {
        qid = row['qid'];
    }
    
    // 如果 row 中有 problem_id_oj 字段（OJ 题目ID，数字ID）
    if('problem_id_oj' in row && row['problem_id_oj'] != null && row['problem_id_oj'] !== '') {
        problemId = row['problem_id_oj'];
    }
    
    // 使用 Bootstrap 5 badge 组件美化显示
    let qidBadge = `<span class="badge bg-primary">${qid}</span>`;
    let problemIdBadge = '';
    
    if(problemId && problemId !== qid) {
        problemIdBadge = `<span class="badge bg-secondary ms-1">${problemId}</span>`;
    }
    
    // 只有管理员才能点击跳转
    if (isAdmin && problemId) {
        // 管理员：显示为链接，跳转到 OJ 题目页面
        const linkUrl = `/csgoj/problemset/problem?pid=${problemId}`;
        const titleText = `Qid: ${qid}, Problem ID: ${problemId}`;
        return `<a href="${linkUrl}" class="text-decoration-none" title="${titleText}" target="_blank">${qidBadge}${problemIdBadge}</a>`;
    } else {
        // 非管理员：只显示文本，不可点击
        const titleText = problemId ? `Qid: ${qid}, Problem ID: ${problemId}` : `Qid: ${qid}`;
        return `<span title="${titleText}">${qidBadge}${problemIdBadge}</span>`;
    }
}

/**
 * 设置表格的 IP 和状态切换事件处理器
 * @param {jQuery} table - Bootstrap Table 的 jQuery 对象
 * @param {string|number} cid - 考试ID（可选，如果每行数据中有 contest_id 则不需要）
 * @param {Object} options - 配置选项
 * @param {boolean} options.showDefunctHint - 是否显示"双击修改状态"提示（默认：true）
 * @param {Function} options.onIpUnlockSuccess - IP解锁成功回调
 * @param {Function} options.onDefunctToggleSuccess - 状态切换成功回调
 */
function SetupExamineeStatusTableEvents(table, cid, options = {}) {
    const config = {
        showDefunctHint: true,
        onIpUnlockSuccess: null,
        onDefunctToggleSuccess: null,
        ...options
    };
    
    let flg_msg_status = false;
    
    // 双击切换考试状态
    table.on('dbl-click-cell.bs.table', function(e, field, value, row, $element){
        if(field == 'defunct') {
            HandleDefunctToggle(row, cid, function(team, row) {
                // 更新表格显示
                table.bootstrapTable('updateByUniqueId', {
                    id: row.team_id,
                    row: row
                });
                
                // 调用自定义回调
                if(config.onDefunctToggleSuccess) {
                    config.onDefunctToggleSuccess(team, row, $element);
                } else {
                    // 默认更新显示
                    $element.html(FormatterExamineeStatus(row.defunct, row));
                }
            });
        }
    });
    
    // 单击显示提示或处理 IP 解锁
    table.on('click-cell.bs.table', function(e, field, td, row, $element){
        if(field == 'defunct') {
            if(config.showDefunctHint && !flg_msg_status) {
                alerty.warning("双击修改状态");
                flg_msg_status = true;
            }
        } else if(field == 'ip') {
            HandleIpUnlock(row, cid, function(team, row) {
                // 更新表格显示
                table.bootstrapTable('updateByUniqueId', {
                    id: row.team_id,
                    row: row
                });
                
                // 调用自定义回调
                if(config.onIpUnlockSuccess) {
                    config.onIpUnlockSuccess(team, row, $element);
                } else {
                    // 默认更新显示
                    $element.html(FormatterIp(null, row));
                }
            });
        }
    });
}

