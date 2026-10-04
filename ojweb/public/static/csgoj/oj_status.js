// 从 window.statusPageConfig 读取配置（如果不存在则使用默认值）
let statusPageConfig = window.statusPageConfig || {};
let status_ajax_url = statusPageConfig.status_ajax_url || '';
let show_code_url = statusPageConfig.show_code_url || '';
let rejudge_url = statusPageConfig.rejudge_url || '';
let status_page_where = statusPageConfig.status_page_where || '';
let module = statusPageConfig.module || '';
let user_id = statusPageConfig.user_id || '';
let OJ_MODE = statusPageConfig.OJ_MODE || '';
let OJ_STATUS = statusPageConfig.OJ_STATUS || '';
let now_course_key = statusPageConfig.now_course_key || null;
// 是否启用双击单元格筛选功能（默认启用，modal 中禁用）
let enable_dblclick_filter = statusPageConfig.enable_dblclick_filter !== false;

/**
 * 当前生效的模块与场景。榜单等页首次加载时未写入 window.statusPageConfig，modal 打开后才会赋值；
 * 本文件顶层的 module/status_page_where 仍是脚本初次执行时的快照，formatter 渲染时必须读 window。
 */
function getEffectiveStatusPageContext() {
    const cfg = window.statusPageConfig;
    const effModule = (cfg && cfg.module) ? String(cfg.module) : module;
    const effWhere = (cfg && cfg.status_page_where) ? String(cfg.status_page_where) : status_page_where;
    return { module: effModule, status_page_where: effWhere };
}

// 注意：anchor 逻辑已由 initBootstrapTableToolbar 中的 initFilterAnchorSync 统一处理

function FormatterSolutionId(value, row, index, field) {
    // 检查是否在 modal 中
    let currentStatusPageWhere = getEffectiveStatusPageContext().status_page_where;
    
    // 比赛中的 status 页面，使用与全局页面相同的字体字号样式
    if(currentStatusPageWhere == 'contest') {
        // 使用 solution-id-exp 类保持相同的字体字号，但只显示 solution_id
        return `<div class="solution-id-exp"><div>${value}</div></div>`;
    }
    
    // ========== EXP 模式：全局状态页面的统一样式处理（与 ACMOJ 逻辑解耦） ==========
    // 非比赛页面，在 EXP 模式下，所有 solution 都使用统一的样式
    if(OJ_STATUS == 'exp') {
        // 如果有 contest_id 且 contest_info 存在，显示详细信息
        if("contest_id" in row && row.contest_id != 0 && 'contest_info' in row && row.contest_info) {
        const contestInfo = row.contest_info;
        const course = contestInfo.course || {};
        const courseKey = course.course_key || '';
        const courseTitle = course.course_title || '';
        const courseUnit = course.course_unit || '';
        const isExam = contestInfo.is_exam || false;
        const isPractice = contestInfo.is_practice || false;
        // 根据比赛类型显示中文名称
        let contestTypeText = '';
        if (isExam) {
            contestTypeText = '考试';
        } else if (isPractice) {
            contestTypeText = '练习';
        } else {
            // 根据 private 字段判断比赛类型
            const privateValue = contestInfo.private || 0;
            const contestType = privateValue % 10; // 0=普通, 2=CPC标准, 4=练习, 5=考试
            if (contestType === 2) {
                contestTypeText = 'xcpc';
            } else if (contestType === 0) {
                contestTypeText = '比赛';
            } else {
                contestTypeText = '比赛'; // 默认显示比赛
            }
        }
        
        // 构建悬停提示信息（使用 HTML 格式，支持换行）
        let tooltipParts = [`比赛ID: ${row.contest_id}`];
        if(courseKey) {
            tooltipParts.push(`课程组: ${courseKey}`);
        }
        if(courseTitle) {
            tooltipParts.push(`课程名称: ${courseTitle}`);
        }
        if(courseUnit) {
            tooltipParts.push(`单位: ${courseUnit}`);
        }
        if(contestTypeText) {
            tooltipParts.push(`类型: ${contestTypeText}`);
        }
        // 使用 <br> 标签换行，用于 Bootstrap tooltip
        const tooltipHtml = tooltipParts.join('<br>');
        // 用于 title 属性的纯文本版本（备用）
        const tooltipText = tooltipParts.join('\n');
        
        // 判断是否禁用点击（OJ_MODE=online 且 exam 类型）
        const isDisabled = (OJ_MODE == 'online' && isExam);
        
        // 构建显示内容：三行小字（提交号、course_key、exp/exam）
        let displayContent = `<div class="solution-id-exp">`;
        displayContent += `<div>${value}</div>`;
        if(courseKey) {
            displayContent += `<div>${courseKey}</div>`;
        } else {
            displayContent += `<div></div>`;
        }
        if(contestTypeText) {
            displayContent += `<div>${contestTypeText}</div>`;
        } else {
            displayContent += `<div></div>`;
        }
        displayContent += `</div>`;
        
        // 如果禁用，返回禁用样式
        if(isDisabled) {
            const disabledTooltip = tooltipHtml + '<br>本模式不能查看考试内提交';
            return `<div class="solution-id-exp-disabled solution-id-tooltip" data-bs-toggle="tooltip" data-bs-html="true" data-bs-placement="top" data-bs-title="${disabledTooltip.replace(/"/g, '&quot;')}">${displayContent}</div>`;
        }
        
        // 构建跳转 URL
        let targetModule = 'expsys';
        if(isExam) {
            targetModule = 'examsys';
        } else if(isPractice) {
            targetModule = 'expsys';
        }
        const statusUrl = `/${targetModule}/contest/status?cid=${row.contest_id}#solution_id=${value}`;
        
        // 检查是否需要切换课程
        const needSwitchCourse = (courseKey && now_course_key && courseKey !== now_course_key);
        
        // 构建链接（使用 data 属性存储信息，便于事件委托处理）
        const linkId = `solution_link_${value}_${row.contest_id}`;
        const dataAttrs = `data-solution-id="${value}" data-contest-id="${row.contest_id}" data-course-key="${courseKey || ''}" data-status-url="${statusUrl}"`;
        // 使用 Bootstrap tooltip 支持 HTML 换行，添加自定义类用于左对齐
        let linkHtml = `<a href="${statusUrl}" id="${linkId}" class="solution-id-exp-link solution-id-tooltip" ${dataAttrs} data-bs-toggle="tooltip" data-bs-html="true" data-bs-placement="top" data-bs-title="${tooltipHtml.replace(/"/g, '&quot;')}">${displayContent}</a>`;
        
            return linkHtml;
        } else {
            // 不在 contest 里的 solution，使用相同的样式，但不显示 contest 相关信息
            return `<div class="solution-id-exp"><div>${value}</div><div></div><div></div></div>`;
        }
    }
    // ========== EXP 模式：全局状态页面统一样式处理结束 ==========
    
    // 非比赛页面，如果有 contest_id，则添加超链接（ACMOJ 逻辑）
    if("contest_id" in row && row.contest_id != 0) {
        let status_url = "/csgoj/contest/status";
        if(OJ_MODE == 'cpcsys') {
            if(OJ_STATUS == 'cpc') {
                status_url = "/cpcsys/contest/status";
            } else {
                // OJ_STATUS == 'exp' 时，examsys 已独立为独立模块
                status_url = "/examsys/contest/status";
            }
        } else if(OJ_STATUS == 'exp') {
            // expsys 已独立为独立模块
            status_url = "/expsys/contest/status";
        }
        return `<a href="${status_url}?cid=${row.contest_id}#solution_id=${value}" title="Contest: ${row.contest_id}">${value}</a>`;
    }
    return value;
}
function FormatterProblemId(value, row, index, field) {
    const ctx = getEffectiveStatusPageContext();
    // 比赛内的 status 页面，使用相对路径跳转到题目
    if(ctx.status_page_where == 'contest' && 'contest_id' in row && row['contest_id'] != 0) {
        // expsys 模块使用完整路径
        if(ctx.module == 'expsys') {
            return "<a href='/" + ctx.module + "/contest/problem?cid=" + row['contest_id'] + "&pid=" + value + "'>" + value + "</a>";
        } else {
            return "<a href='problem?cid=" + row['contest_id'] + "&pid=" + value + "'>" + value + "</a>";
        }
    }
    // 其他情况（非比赛页面或全局评测状态）
    if('contest_type' in row) {
        if(row['contest_type'] == 5) {
            return value;
        } else {
            // expsys 模块使用完整路径
            if(ctx.module == 'expsys') {
                return "<a href='/" + ctx.module + "/contest/problem?cid=" + row['contest_id'] + "&pid=" + value + "'>" + value + "</a>";
            } else {
                return "<a href='problem?cid=" + row['contest_id'] + "&pid=" + value +  "'>" + value + "</a>";
            }
        }        
    } else {
        return "<a href='/csgoj/problemset/problem?pid=" + value + "'>" + value + "</a>";
    }
}
// FormatterProblemIdWithPid: 同时显示 Qid（考试题目序号）和 problem_id（OJ 题目ID）
// 用于 examsys 模块，管理员/教师/监考等身份查看时使用
function FormatterProblemIdWithPid(value, row, index, field) {
    // value 是 problem_id（字母ID，如 A, B, C），row 中包含 qid（考试题目序号）和 problem_id_oj（OJ 题目ID）
    let qid = value; // 默认使用 problem_id（字母ID）作为显示值
    let problemId = null;
    
    // 如果 row 中有 qid 字段（考试题目序号），优先使用
    if('qid' in row && row['qid'] != null && row['qid'] !== '') {
        qid = row['qid'];
    }
    
    // 如果 row 中有 problem_id_oj 字段（OJ 题目ID，数字ID），用于显示
    if('problem_id_oj' in row && row['problem_id_oj'] != null && row['problem_id_oj'] !== '') {
        problemId = row['problem_id_oj'];
    }
    
    // 使用 Bootstrap 5 badge 组件美化显示
    let qidBadge = `<span class="badge bg-primary">${qid}</span>`;
    let problemIdBadge = '';
    
    if(problemId && problemId !== qid) {
        problemIdBadge = `<span class="badge bg-secondary ms-1">${problemId}</span>`;
    }
    
    // 构建链接和显示内容
    if('contest_type' in row && row['contest_type'] == 5) {
        // 考试类型，链接到 OJ 题目页面（使用 problem_id）
        const linkUrl = problemId ? `/csgoj/problemset/problem?pid=${problemId}` : `problem?cid=${row['contest_id']}&pid=${qid}`;
        const titleText = problemId ? `Qid: ${qid}, Problem ID: ${problemId}` : `Qid: ${qid}`;
        return `<a href="${linkUrl}" class="text-decoration-none" title="${titleText}">${qidBadge}${problemIdBadge}</a>`;
    } else {
        return `${qidBadge}${problemIdBadge}`;
    }
}
function ParseCpcContestAccount(rawUserId) {
    const userId = String(rawUserId || '');
    const match = userId.match(/^#cpc(\d+)_(.+)$/i);
    if (!match) {
        return null;
    }
    return {
        contestId: match[1],
        teamId: match[2],
        fullUserId: userId
    };
}
function FormatterStatusUser(value, row, index, field) {
    const userIdRaw = String(value || '');
    const parsedContestAccount = ParseCpcContestAccount(userIdRaw);
    let userUrl = '';
    let userTitle = '';
    
    // 构建用户链接 URL 和 title（查询参数编码防特殊字符）
    if(('contest_type' in row ) && (row['contest_type'] == 5 || row['contest_type'] == 2)) {
        // standard contest、exam
        userUrl = `teaminfo?cid=${row['contest_id']}&team_id=${encodeURIComponent(userIdRaw)}`;
        userTitle = `查看队伍信息 / View Team Info`;
    } else if(parsedContestAccount) {
        const cid = parsedContestAccount.contestId;
        const m = getEffectiveStatusPageContext().module;
        userUrl = m ? `/${m}/contest/contest?cid=${cid}` : `contest?cid=${cid}`;
        userTitle = `Contestant in #${cid}`;
    } else {
        const m = getEffectiveStatusPageContext().module;
        userUrl = m ? `/${m}/user/userinfo?user_id=${encodeURIComponent(userIdRaw)}` : `userinfo?user_id=${encodeURIComponent(userIdRaw)}`;
        userTitle = `查看用户信息 / View User Info`;
    }
    
    // 构建显示内容：name 在上，user_id 在下（使用全局 DomSantize，昵称限制宽度+省略号、禁止折行）
    let nameDisplay = '';
    let userIdDisplay = '';
    
    // name 显示在上方（如果有）：转义防 XSS，过长省略、单行不折行
    if('name' in row && row['name'] != null && row['name'] !== '') {
        const nameText = DomSantize(row['name']);
        nameDisplay = `<div class="status-user-name text-truncate" title="${nameText}">${nameText}</div>`;
    }

    if (parsedContestAccount) {
        const contestIdEscaped = DomSantize(parsedContestAccount.contestId);
        const teamIdEscaped = DomSantize(parsedContestAccount.teamId);
        const fullUserIdEscaped = DomSantize(parsedContestAccount.fullUserId);
        const m = getEffectiveStatusPageContext().module;
        const teamInfoUrl = m
            ? `/${m}/contest/teaminfo?cid=${parsedContestAccount.contestId}&team_id=${encodeURIComponent(parsedContestAccount.teamId)}`
            : `teaminfo?cid=${parsedContestAccount.contestId}&team_id=${encodeURIComponent(parsedContestAccount.teamId)}`;
        const contestLine = `<div class="status-user-contest-id"><a href="${userUrl}" class="status-user-link status-user-contest-link" title="比赛 ${contestIdEscaped} / Contest ${contestIdEscaped}">#${contestIdEscaped}</a></div>`;
        const teamLine = `<div class="status-user-id text-truncate" title="${fullUserIdEscaped}"><a href="${teamInfoUrl}" class="status-user-link text-decoration-none" title="查看队伍信息 / View Team Info">${teamIdEscaped}</a></div>`;
        return `<div class="status-user-container">${nameDisplay}${contestLine}${teamLine}</div>`;
    }

    // 普通账号：user_id 显示在下方（无背景边框，普通链接样式）
    const userIdEscaped = DomSantize(userIdRaw);
    userIdDisplay = `<div class="status-user-id text-truncate"><a href='${userUrl}' class="status-user-link text-decoration-none" title="${userTitle}">${userIdEscaped}</a></div>`;
    
    // 使用垂直布局，name 在上，user_id 在下，内容居中
    return `<div class="status-user-container">${nameDisplay}${userIdDisplay}</div>`;
}
function FormatterStatusResult(value, row, index, field) {
    if(typeof(value) == undefined || value == '-') {
        return '-';
    }
    if(value < 4) {
        return `<div class='result-span loading-overlay text-secondary' title='${row.res_text}'><span class='loading-text'>${row.res_short}</span><div class='spinner-overlay'><div class='spinner-border spinner-border-sm' role='status'><span class='visually-hidden'>Loading...</span></div></div></div>`;
    } else if(row['res_show']) {
        return `<button class='btn result_show_btn btn-${row['res_color']} result-btn' title='${row.res_text}'>${row.res_short}</button>`;
    } else {
        return `<span class='text-${row['res_color']} result-span' title='${row.res_text}'>${row.res_short}</span>`;
    }
}
function FormatterPassRate(value, row, index, field) {
    return value === null ? '-' : `${value * 100}%`;
}
function FormatterLanguage(value, row, index, field) {
    let value_show = value;
    switch(value) {
        case 'Python3': value_show = 'Py3'; break;
        default: value_show = value;
    }
    if(('code_show' in row) && row['code_show']) {
        return `<button class='btn btn-primary lang-btn' solution_id='${row['solution_id']}' title='${value}'>${value_show}</button>`;
    } else {
        return `<strong class='lang-strong'>${value_show}</strong>`;
    }
}
function FormatterRejudge(value, row, index, field) {
    if("contest_id" in row && row.contest_id != 0 && getEffectiveStatusPageContext().status_page_where != 'contest') {
        row.allow_rejudge = false;
        // 添加 anchor 参数，传递 solution_id
        const anchorParam = row.solution_id ? `#solution_id=${row.solution_id}` : '';
        return `<a href="/csgoj/admin/contest_rejudge?cid=${row.contest_id}${anchorParam}" title="比赛中的代码需在比赛中执行重测 (Rejudge in contest)" target="_blank"><i class="bi bi-calendar-event"></i></span>`
    } else {
        row.allow_rejudge = row.result != 4;
        return row.result == 4 ? `<span class="text-muted" title="AC 的代码不能快捷重测，请到后台慎重执行"><i class="bi bi-shield-check"></i></span>` : `<button class='btn btn-warning btn-sm' title="重新评测 (Rejudge)"><i class="bi bi-arrow-clockwise"></i></button>`;
    }
}
function FormatterSim(value, row, index, field) {
    if(value == null || row.sim == null || row.sim_s_id == null) return '-';
    
    // 构建代码对比链接
    // 根据 status_page_where 判断是全局状态页面还是比赛内
    // 全局状态页面使用 status 控制器，比赛内使用 contest 控制器
    const ctx = getEffectiveStatusPageContext();
    const controller = (ctx.status_page_where === 'contest') ? 'contest' : 'status';
    const pathSegs = [];
    if (ctx.module) {
        pathSegs.push(ctx.module);
    }
    pathSegs.push(controller, 'status_code_compare');
    const compareUrl = '/' + pathSegs.join('/') + `?sid0=${row.solution_id}&sid1=${row.sim_s_id}&cid=${row.contest_id}`;
    
    // 相似度数值（优先凸显，中等字体，加粗，主色调）
    const simValue = `${row.sim}%`;
    const simDisplay = `<div class="sim-value" style="font-size: 0.95rem; font-weight: 700; color: #dc3545; line-height: 1.1; margin-bottom: 1px; text-align: center;" title="相似度 ${simValue}">${simValue}</div>`;
    
    // 被相似对象的用户信息（用户名和账号合并到一行，用分隔符分开）
    let userInfoDisplay = '';
    if(row.sim_user_id != null && row.sim_user_id !== '') {
        let userUrl = '';
        let userTitle = '';
        const simUserId = row.sim_user_id;
        
        // 构建用户链接 URL 和 title（参考 FormatterStatusUser 的逻辑，查询参数编码）
        if(('contest_type' in row) && (row['contest_type'] == 5 || row['contest_type'] == 2)) {
            // standard contest、exam
            userUrl = `teaminfo?cid=${row['contest_id']}&team_id=${encodeURIComponent(simUserId)}`;
            userTitle = `查看队伍信息 / View Team Info`;
        } else if(simUserId.startsWith('#cpc')) {
            let cid = simUserId.split('_')[0].substring(4);
            userUrl = ctx.module ? `/${ctx.module}/contest/contest?cid=${cid}` : `contest?cid=${cid}`;
            userTitle = `Contestant in #${cid}`;
        } else {
            userUrl = ctx.module ? `/${ctx.module}/user/userinfo?user_id=${encodeURIComponent(simUserId)}` : `userinfo?user_id=${encodeURIComponent(simUserId)}`;
            userTitle = `查看用户信息 / View User Info`;
        }
        
        // 如果有用户名，显示：用户名 | 账号，否则只显示账号（使用全局 DomSantize，过长省略、不折行）
        const nameEscaped = (row.sim_user_name != null && row.sim_user_name !== '') ? DomSantize(row.sim_user_name) : '';
        const simUserIdEscaped = DomSantize(simUserId);
        let userInfoText = '';
        if (nameEscaped !== '') {
            userInfoText = `<span class="sim-user-name text-truncate" style="max-width: 80px; display: inline-block; vertical-align: bottom; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${nameEscaped}">${nameEscaped}</span><span class="sim-separator"> | </span><a href='${userUrl}' class="text-decoration-none sim-user-id" title="${userTitle}" style="color: #0d6efd;">${simUserIdEscaped}</a>`;
        } else {
            userInfoText = `<a href='${userUrl}' class="text-decoration-none sim-user-id" title="${userTitle}" style="color: #0d6efd;">${simUserIdEscaped}</a>`;
        }
        
        userInfoDisplay = `<div class="sim-user-info text-truncate" style="text-align: center; font-size: 0.7rem; line-height: 1.1; margin-bottom: 1px; color: #6c757d; max-width: 140px; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${userInfoText}</div>`;
    }
    
    // 被相似对象的 solution_id（小字体，链接）
    const simIdDisplay = `<div class="sim-solution-id" style="text-align: center; font-size: 0.7rem; line-height: 1.1;"><a href='${compareUrl}' target='_blank' class="text-decoration-none" title="查看代码对比 / View Code Compare" style="color: #0d6efd; font-weight: 500;">#${row.sim_s_id}</a></div>`;
    
    // 使用垂直布局，相似度在上，用户信息在中，solution_id在下，内容居中，布局紧凑
    return `<div class="sim-container" style="min-width: 0; padding: 1px 0; text-align: center; cursor: pointer;" onclick="window.open('${compareUrl}', '_blank')">${simDisplay}${userInfoDisplay}${simIdDisplay}</div>`;
}
//table related
var $table = $('#status_table');
var status_table_div = $('#status_table_div');
var status_toolbar = $('#status_toolbar');

// 移除旧的modal相关代码，使用新的 CodeViewer

// 使用 Bootstrap Table 的内置 queryParams 选项
// 参考：https://www.bootstraptable.com/docs/api/table-options/#queryparams
// 注意：筛选组件的 anchor 同步已由 initBootstrapTableToolbar 中的 initFilterAnchorSync 统一处理
// 这里只负责从 anchor 读取值并传递给后端

window.queryParams = function(params) {
    // 优先从筛选组件本身读取值，其次从 anchor 读取值
    // 这确保了实时筛选功能，即使 anchor 还未更新
    const prefix = 'status';
    const filterNames = ['problem_id', 'user_id', 'solution_id', 'language', 'result', 'similar'];

    filterNames.forEach(name => {
        let value = null;

        // 只读 status 工具栏上的筛选控件（.status_filter），禁止匹配侧栏登录表单的 name="user_id" 等，
        // 否则浏览器自动填充会导致分页请求误带当前账号筛选。
        const $filterElement = $(`.status_filter[name="${name}"]`).first();
        if ($filterElement.length > 0) {
            value = $filterElement.val();
            // 对于similar参数，空值或0都视为无效（不传递）
            // 对于其他参数，如果值是默认值（空或 -1），则不传递
            if (name === 'similar') {
                if (value === '' || value === null || value === '0' || parseInt(value, 10) <= 0) {
                    value = null;
                }
            } else {
                if (value === '' || value === '-1' || value === null) {
                    value = null;
                }
            }
        }

        // 如果从筛选组件没获取到值，尝试从 anchor 读取
        if (value === null) {
            const anchorKey = `${prefix}_${name}`;
            const anchorVal = csg.GetAnchor(anchorKey);
            if (anchorVal != null && anchorVal !== '' && anchorVal !== '-1') {
                // 对于similar参数，还需要检查是否大于0
                if (name === 'similar') {
                    const numVal = parseInt(anchorVal, 10);
                    if (!isNaN(numVal) && numVal > 0) {
                        value = anchorVal;
                    }
                } else {
                    value = anchorVal;
                }
            }
        }

        // 只传递有效的值给后端
        if (value !== null) {
            params[name] = value;
        }
    });

    return params;
};

// 注意：anchor 同步逻辑已由 initBootstrapTableToolbar 中的 initFilterAnchorSync 统一处理

// 注意：anchor 同步逻辑已由 initBootstrapTableToolbar 中的 initFilterAnchorSync 统一处理

$(function() {
    // 注意：anchor 同步逻辑已由 initBootstrapTableToolbar 中的 initFilterAnchorSync 统一处理

    // ========== EXP 模式：处理 contest 内部提交的点击事件（与 ACMOJ 逻辑解耦） ==========
    // 使用事件委托处理 solution-id-exp-link 的点击事件
    if(OJ_STATUS == 'exp') {
        $(document).off('click', '.solution-id-exp-link').on('click', '.solution-id-exp-link', function(e) {
            const link = $(this);
            const courseKey = link.data('course-key');
            const statusUrl = link.data('status-url');
            
            // 如果需要切换课程，显示确认对话框
            if(courseKey && now_course_key && courseKey !== now_course_key) {
                e.preventDefault();
                alerty.confirm({
                    message: `当前课程组为 [${now_course_key}]，该提交属于课程组 [${courseKey}]，是否切换到[${courseKey}]并跳转？`,
                    message_en: `Current course group is [${now_course_key}]. This submission belongs to course group [${courseKey}]. Switch to [${courseKey}] and redirect?`,
                    callback: function() {
                        // 确认：跳转时带上 now_course_key 参数
                        // 关键修复：将 now_course_key 作为查询参数添加到URL的查询字符串中（在hash之前）
                        // 而不是hash后面，否则后端无法识别
                        let finalUrl = statusUrl;
                        // 分离URL的hash部分和查询字符串部分
                        const hashIndex = finalUrl.indexOf('#');
                        let baseUrl = finalUrl;
                        let hashPart = '';
                        
                        if (hashIndex !== -1) {
                            // 有hash部分，分离出来
                            baseUrl = finalUrl.substring(0, hashIndex);
                            hashPart = finalUrl.substring(hashIndex);
                        }
                        
                        // 在查询字符串中添加 now_course_key 参数
                        if (baseUrl.indexOf('?') !== -1) {
                            // 已有查询参数，添加 &now_course_key
                            baseUrl += `&now_course_key=${encodeURIComponent(courseKey)}`;
                        } else {
                            // 没有查询参数，添加 ?now_course_key
                            baseUrl += `?now_course_key=${encodeURIComponent(courseKey)}`;
                        }
                        
                        // 重新拼接hash部分
                        finalUrl = baseUrl + hashPart;
                        window.location.href = finalUrl;
                    },
                    callbackCancel: function() {
                        alerty.message('已取消', 'Canceled');
                    }
                });
            }
        });
    }
    // ========== EXP 模式：点击事件处理结束 ==========
    
    // 4. 初始化工具栏（延迟绑定 change 事件，避免初始化时触发刷新）
    // 注意：三个搜索框（problem_id, user_id, solution_id）和两个下拉框（language, result）都需要绑定事件
    initBootstrapTableToolbar({
        tableId: 'status_table',
        prefix: 'status',
        filterSelectors: ['problem_id', 'user_id', 'solution_id', 'language', 'result'], // 包含所有筛选组件
        searchInputId: null,
        customQueryParams: null, // 使用全局的 queryParams 函数
        customHandlers: {
            clear: function() {
                // 清空所有筛选组件和anchor（确保绝对同步）
                const prefix = 'status';
                $('.status_filter').each(function() {
                    const $elem = $(this);
                    const name = $elem.attr('name');
                    if (!name) return;
                    
                    // 标记为正在清空，避免触发 anchor 更新事件
                    $elem.data('initializing-from-anchor', true);
                    
                    // 清空筛选组件值
                    if ($elem.is('input')) {
                        $elem.val('');
                    } else {
                        // 对于 select，需要触发 change 事件以同步 csg-select 的显示
                        if ($elem[0]) {
                            $elem[0].value = '-1';
                            // 触发 change 事件，让 csg-select 同步更新显示
                            const changeEvent = new Event('change', { bubbles: true, cancelable: true });
                            $elem[0].dispatchEvent(changeEvent);
                        } else {
                            $elem.val('-1').trigger('change');
                        }
                    }
                    
                    // 清空anchor（使用带namespace的anchor参数名）
                    const anchorKey = `${prefix}_${name}`;
                    const anchorVal = csg.GetAnchor(anchorKey);
                    if (anchorVal !== null && anchorVal !== '') {
                        csg.SetAnchor(null, anchorKey);
                    }
                    
                    // 延迟清除标记
                    setTimeout(function() {
                        $elem.removeData('initializing-from-anchor');
                    }, 100);
                });

                // 使用 Bootstrap Table 的 refresh 方法
                $table.bootstrapTable('refresh', {pageNumber: 1});
            },
            refresh: function() {
                // 直接刷新表格，queryParams 会自动读取最新的 filter 值
                $table.bootstrapTable('refresh');
            }
        },
        enableAnchorSync: true
    });
});

// 使用命名空间事件，防止重复绑定
$('.fake-form').off('keypress.status').on('keypress.status', function(e){
    // it'ts not a real form, so overload 'enter' to take effect.
    if(e.keyCode == 13){
        $table.bootstrapTable('refresh', {pageNumber: 1});
    }
});
var timer_ids = [];
let flg_auto_refresh_status=false;
// 存储当前自动刷新的定时器 ID，用于防止重复执行
let autoRefreshTimerId = null;
// 已经移除了 ensureResultModal 函数，使用独立的 RuninfoViewer 组件代替
function auto_refresh_results(time_cnt=2) {
    if(!flg_auto_refresh_status) {
        // 如果标志为 false，清除可能存在的定时器
        if(autoRefreshTimerId !== null) {
            clearTimeout(autoRefreshTimerId);
            autoRefreshTimerId = null;
        }
        return;
    }
    // refresh results which are running.
    // 使用 useCurrentPage: true 只获取当前页数据，提高性能
    // 参考：https://www.bootstraptable.com/docs/api/methods/#getdata
    let status_data = $table.bootstrapTable('getData', {useCurrentPage: true});
    let solution_id_list = [];
    for(let i in status_data) {
        if(status_data[i]['result'] == '-' || status_data[i]['result'] >= 4) continue;
        solution_id_list.push(status_data[i]['solution_id']);
    }
    if(solution_id_list.length > 0) {
        $.get(
            status_ajax_url,
            {
                'solution_id_list': solution_id_list
            },
            function(ret) {
                let finish_flag = true;
                for(let i in ret.rows) {
                    const row_in_table = $table.bootstrapTable('getRowByUniqueId', ret.rows[i].solution_id);
                    // 检查 row_in_table 是否存在（可能不在当前页面或已被删除）
                    if (!row_in_table) {
                        continue;
                    }
                    if(ret.rows[i].result != row_in_table.result || ret.rows[i].memory != row_in_table.memory) {
                        // 参考：https://www.bootstraptable.com/docs/api/methods/#updatebyuniqueid
                        $table.bootstrapTable('updateByUniqueId', {
                            id: ret.rows[i].solution_id,
                            row: ret.rows[i],
                            // replace: true    // 要去掉这个选项，因为bootstrap会根据部分字段判定前后数据是否相同，判定为相同就不执行覆盖了
                        });
                    }
                    if(ret.rows[i]['result'] != '-' && ret.rows[i]['result'] < 4) {
                        finish_flag = false;
                    }
                }
                if(finish_flag) {
                    flg_auto_refresh_status = false;
                    // 清除定时器
                    if(autoRefreshTimerId !== null) {
                        clearTimeout(autoRefreshTimerId);
                        autoRefreshTimerId = null;
                    }
                }
                if(flg_auto_refresh_status) {
                    // 清除旧的定时器（如果存在）
                    if(autoRefreshTimerId !== null) {
                        clearTimeout(autoRefreshTimerId);
                    }
                    // 设置新的定时器并保存 ID
                    autoRefreshTimerId = setTimeout(function(){
                        autoRefreshTimerId = null; // 清除定时器 ID
                        auto_refresh_results(time_cnt * 2);
                    }, time_cnt * 1000);
                }
            }
        ).fail(function(xhr, status, error) {
            // 错误处理：停止自动刷新，避免持续失败
            console.error('Auto refresh failed:', error);
            flg_auto_refresh_status = false;
            // 清除定时器
            if(autoRefreshTimerId !== null) {
                clearTimeout(autoRefreshTimerId);
                autoRefreshTimerId = null;
            }
        });
    } else {
        flg_auto_refresh_status = false;
        // 清除定时器
        if(autoRefreshTimerId !== null) {
            clearTimeout(autoRefreshTimerId);
            autoRefreshTimerId = null;
        }
    }
}
function BtnCodeShow(td, row) {
    // 点击查看代码 - 使用新的CodeViewer
    let solution_id = row.solution_id;
    if(!row.code_show) return;
    
    // 直接使用 window.statusPageConfig，因为 modal 打开时会更新它
    const currentConfig = window.statusPageConfig || statusPageConfig;
    const currentShowCodeUrl = currentConfig.show_code_url || show_code_url;
    const currentCid = currentConfig.cid || 'x';
    
    // 确保 CodeViewer 可用（code_show.js 可能先于 modal DOM 加载）
    const cv = window.codeViewer;
    if (!cv || !cv.available || !cv.contentContainer) {
        console.error('CodeViewer not available: code_show_modal DOM missing or CodeViewer not initialized.');
        alerty.error('代码查看器未初始化：请刷新页面后重试', 'Code viewer not initialized. Please refresh and try again.');
        return;
    }

    // 显示加载状态
    if (cv) {
        cv.contentContainer.innerHTML = `
            <div class="text-center p-5">
                <div class="spinner-border text-primary" role="status">
                    <span class="visually-hidden">加载中...</span>
                </div>
                <p class="mt-2 text-muted">正在加载代码...</p>
                <p class="en-text">Loading code...</p>
            </div>
        `;
        cv.modal.show();
    }
    
    $.get(
        currentShowCodeUrl,
        {
            'solution_id': solution_id,
            'cid': currentCid
        },
        function(ret){
            if(ret?.code == 1) {
                let data = ret.data;
                let language = data.language ?? row?.language;
                // 使用新的CodeViewer显示代码（前端会生成头部注释）
                if (cv) {
                    cv.showCode(solution_id, language, {
                        solution_id: solution_id,
                        source: data.source,
                        submitTime: data.submit_time ?? row?.in_date,
                        codeLength: data.code_length ?? row?.code_length,
                        problemId: data.problem_id ?? row?.problem_id,
                        user_id: data.user_id ?? row?.user_id,
                        result: data.result ?? row?.result,
                        time: data.time ?? row?.time,
                        memory: data.memory ?? row?.memory,
                        contest_id: data?.contest_id ?? row?.contest_id
                    });
                }
            }
            else {
                // 显示错误信息
                if (cv) {
                    cv.contentContainer.innerHTML = `
                        <div class="text-center p-5 text-danger">
                            <i class="bi bi-exclamation-triangle fs-1"></i>
                            <p class="mt-2">加载代码失败</p>
                            <p class="en-text">Failed to load code</p>
                        </div>
                    `;
                }
            }
        }
    ).fail(function() {
        // 网络错误处理
        if (cv) {
            cv.contentContainer.innerHTML = `
                <div class="text-center p-5 text-danger">
                    <i class="bi bi-wifi-off fs-1"></i>
                    <p class="mt-2">网络连接失败</p>
                    <p class="en-text">Network connection failed</p>
                </div>
            `;
        }
    });
}
function BtnResultShow(td, row) {
    // 查看Result的提示信息
    if(!row.res_show) return;
    let solution_id = row['solution_id'];

    // 直接使用 window.statusPageConfig，因为 modal 打开时会更新它
    const currentConfig = window.statusPageConfig || statusPageConfig;
    const currentShowResUrl = currentConfig.show_res_url || '';
    const currentCid = currentConfig.cid || 'x';

    $.get(
        currentShowResUrl,
        {
            'solution_id': solution_id,
            'cid': currentCid
        },
        function (ret) {
            if (window.runinfoViewer && typeof window.runinfoViewer.showInfo === 'function') {
                window.runinfoViewer.showInfo(solution_id, ret);
            } else {
                console.error('runinfoViewer is not initialized');
                alerty.error('运行信息查看器未初始化', 'Runinfo viewer not initialized');
            }
        });
}
// 全局标志：防止 SetStatusButton 重复绑定事件
let statusButtonInitialized = false;
// 单击延迟定时器（用于区分单击和双击），使用 Map 存储多个表格的定时器
let clickCellTimers = new Map();
// 需要延迟等待双击事件的列（空白处双击筛选，按钮单击查看）
const DELAYED_CLICK_FIELDS = ['language', 'result'];

/**
 * 为指定表格设置按钮事件
 * @param {jQuery} $targetTable - 目标表格的 jQuery 对象
 * @param {string} namespace - 事件命名空间（如 'status' 或 'modal'）
 * @param {boolean} enableDblClickFilter - 是否启用双击筛选
 */
function SetStatusButtonForTable($targetTable, namespace, enableDblClickFilter) {
    // show running information and code.
    // 使用命名空间事件，确保可以正确解绑
    $targetTable.off(`click-cell.bs.table.${namespace}`).on(`click-cell.bs.table.${namespace}`, function(e, field, value, row, $element){
        // 只有特定列且启用了双击筛选功能时，才需要延迟执行单击事件
        const needsDelay = enableDblClickFilter && DELAYED_CLICK_FIELDS.includes(field);
        
        if (needsDelay) {
            // 获取该表格的定时器 key
            const tableId = $targetTable.attr('id') || 'default';
            
            // 清除之前的定时器
            if (clickCellTimers.has(tableId)) {
                clearTimeout(clickCellTimers.get(tableId));
                clickCellTimers.delete(tableId);
            }
            
            // 延迟执行单击事件（300ms）
            const timer = setTimeout(function() {
                clickCellTimers.delete(tableId);
                // 执行原有的单击逻辑
                handleClickCell(field, value, row, $element, $targetTable);
            }, 200);
            
            clickCellTimers.set(tableId, timer);
        } else {
            // 不需要延迟的列（如 rejudge），直接执行单击事件
            handleClickCell(field, value, row, $element, $targetTable);
        }
    });
    
    // 双击单元格事件：将单元格值填入筛选组件
    if (enableDblClickFilter) {
        $targetTable.off(`dbl-click-cell.bs.table.${namespace}`).on(`dbl-click-cell.bs.table.${namespace}`, function(e, field, value, row, $element){
            // 只有特定列才处理双击筛选
            if (!DELAYED_CLICK_FIELDS.includes(field)) {
                return; // 其他列不处理双击筛选
            }
            
            // 获取该表格的定时器 key
            const tableId = $targetTable.attr('id') || 'default';
            
            // 清除单击延迟定时器，避免触发单击事件
            if (clickCellTimers.has(tableId)) {
                clearTimeout(clickCellTimers.get(tableId));
                clickCellTimers.delete(tableId);
            }
            
            // 处理双击筛选
            handleDblClickCellFilter(field, value, row, $targetTable);
        });
    }
}

function SetStatusButton() {
    // 防止重复绑定事件
    if (statusButtonInitialized) {
        return;
    }
    statusButtonInitialized = true;
    
    // 为主表格设置事件（使用全局配置）
    SetStatusButtonForTable($table, 'status', enable_dblclick_filter);
}

/**
 * 处理单击单元格事件
 * @param {string} field - 字段名
 * @param {*} value - 单元格值
 * @param {object} row - 行数据
 * @param {jQuery} $element - 单元格元素
 * @param {jQuery} $targetTable - 目标表格（默认为主表格）
 */
function handleClickCell(field, value, row, $element, $targetTable) {
    $targetTable = $targetTable || $table;
    
    if(field == 'language') {
        BtnCodeShow($element, row)
    } else if(field == 'result') {
        BtnResultShow($element, row);
    } else if(field == 'rejudge' && row.allow_rejudge) {
        alerty.confirm({
            message: `确定要重测该提交 [提交号=<strong class='text-danger'>${row.solution_id}</strong>]?`, 
            message_en: `Confirm to rejudge solution [RunID=<strong class='text-danger'>${row.solution_id}</strong>]?`, 
            allowBackdropClose: true, // 允许点击空白处关闭
            callback: function() {
                const currentRejudgeUrl = (window.statusPageConfig && window.statusPageConfig.rejudge_url) || rejudge_url;
                $.post(currentRejudgeUrl, {solution_id: row.solution_id, rejudge_res_check: ['any']}, function(ret) {
                    if(ret.code == 1) {
                        // 直接更新行数据为 "Pending Rejudging" 状态
                        $targetTable.bootstrapTable('updateByUniqueId', {
                            id: row.solution_id,
                            row: {
                                result: 1,              // 1 = Pending Rejudging（等待重测）
                                memory: 0,
                                time: 0,
                                res_text: 'Pending Rejudging',
                                res_short: 'PR',
                                res_color: 'default',
                                res_show: false
                            }
                        });
                        if(!flg_auto_refresh_status) {
                            flg_auto_refresh_status = true;
                            auto_refresh_results();
                        }
                        alerty.success(`重测启动 [RunID=${row.solution_id}]`, `Rejudge started`);
                    } else {
                        alerty.error(`重测启动失败 [RunID=${row.solution_id}]`, `Rejudge start failed\n${ret.msg}`);
                    }

                });
            }
        });
    }
}

/**
 * 处理双击单元格筛选
 * @param {string} field - 字段名
 * @param {*} value - 单元格值
 * @param {object} row - 行数据
 * @param {jQuery} $targetTable - 目标表格（默认为主表格）
 */
function handleDblClickCellFilter(field, value, row, $targetTable) {
    $targetTable = $targetTable || $table;
    // 只处理指定的列：题号(problem_id)、账号(user_id)、runid(solution_id)、语言(language)、评测结果(result)
    const filterFields = ['problem_id', 'user_id', 'solution_id', 'language', 'result'];
    if (!filterFields.includes(field)) {
        return;
    }
    
    // 获取对应的筛选组件
    let $filterElement = null;
    
    switch(field) {
        case 'problem_id':
            $filterElement = $('input[name="problem_id"], #problem_id_input');
            break;
        case 'user_id':
            $filterElement = $('input[name="user_id"], #user_id_input');
            break;
        case 'solution_id':
            $filterElement = $('input[name="solution_id"], #solution_id_input');
            break;
        case 'language':
            $filterElement = $('select[name="language"]');
            break;
        case 'result':
            $filterElement = $('select[name="result"]');
            break;
    }
    
    if (!$filterElement || $filterElement.length === 0) {
        return;
    }
    
    // 获取要设置的值
    // 优先使用 row 对象中的原始值（对于使用了 formatter 的字段，value 可能是格式化后的 HTML）
    let filterValue = (row && row[field] !== undefined) ? row[field] : value;
    
    // 对于下拉框（language、result），需要找到对应的选项值
    if (field === 'language' || field === 'result') {
        const $select = $filterElement;
        const options = $select.find('option');
        let found = false;
        
        // 优先使用 row 中的原始值
        if (row && row[field] !== undefined) {
            const rawValue = row[field];
            // 遍历选项，查找匹配的值
            options.each(function() {
                const $option = $(this);
                const optionValue = $option.val();
                
                // 如果选项值匹配原始值
                if (optionValue == rawValue) {
                    filterValue = optionValue;
                    found = true;
                    return false; // 跳出循环
                }
            });
        }
        
        // 如果从 row 中没找到，尝试从 value 中匹配（可能是格式化后的文本）
        if (!found && value !== undefined && value !== null) {
            // 如果 value 是字符串（可能是格式化后的 HTML），尝试提取文本
            let valueText = value;
            if (typeof value === 'string') {
                // 尝试从 HTML 中提取文本（去除 HTML 标签）
                const $temp = $('<div>').html(value);
                valueText = $temp.text().trim() || value;
            }
            
            // 遍历选项，查找匹配的文本或值
            options.each(function() {
                const $option = $(this);
                const optionText = $option.text().trim();
                const optionValue = $option.val();
                
                // 如果选项文本匹配
                if (optionText === valueText || optionText.includes(valueText)) {
                    filterValue = optionValue;
                    found = true;
                    return false; // 跳出循环
                }
                
                // 如果选项值匹配
                if (optionValue == valueText) {
                    filterValue = optionValue;
                    found = true;
                    return false; // 跳出循环
                }
            });
        }
        
        // 如果还是没找到匹配项，不设置
        if (!found) {
            return;
        }
    }
    
    // 获取筛选字段的中文名称和显示值（用于提示）
    const fieldNames = {
        'problem_id': { cn: '题号', en: 'Problem ID' },
        'user_id': { cn: '账号', en: 'User ID' },
        'solution_id': { cn: '提交号', en: 'Solution ID' },
        'language': { cn: '语言', en: 'Language' },
        'result': { cn: '评测结果', en: 'Result' }
    };
    const fieldName = fieldNames[field] || { cn: field, en: field };
    
    // 获取显示值（对于下拉框，获取选项文本；对于输入框，直接使用值）
    let displayValue = filterValue;
    if ($filterElement.is('select')) {
        const selectedOption = $filterElement.find(`option[value="${filterValue}"]`);
        if (selectedOption.length > 0) {
            displayValue = selectedOption.text().trim();
        }
    }
    
    // 设置筛选组件的值（标记为正在设置，避免触发 anchor 更新事件）
    // 注意：不阻止 toolbar 刷新事件，让事件自然触发 refresh
    $filterElement.data('initializing-from-anchor', true);
    
    // 设置值（会触发 change/input 事件，事件处理函数会自动调用 refresh）
    // 不需要手动调用 refresh，让 general_formatter.js 中的事件处理函数自动处理
    if ($filterElement.is('input')) {
        $filterElement.val(filterValue);
    } else if ($filterElement.is('select')) {
        $filterElement.val(filterValue);
    }
    
    // 更新 anchor（使用 util.js 的 SetAnchor 方法）
    // 双击筛选是用户操作，允许更新 anchor
    // 使用带namespace的anchor参数名（status_${name}）
    const name = $filterElement.attr('name');
    if (name) {
        const prefix = 'status';
        const anchorKey = `${prefix}_${name}`;
        if (filterValue === '' || filterValue === null || filterValue === '-1') {
            csg.SetAnchor(null, anchorKey);
        } else {
            csg.SetAnchor(filterValue, anchorKey);
        }
    }
    
    // 显示提示信息
    alerty.success(
        `已设置筛选条件：${fieldName.cn} = ${displayValue}`,
        `Filter applied: ${fieldName.en} = ${displayValue}`
    );
    
    // 延迟清除标记
    // 注意：不需要手动调用 refresh，因为设置值时会触发 change/input 事件
    // general_formatter.js 中的事件处理函数会自动调用 refresh
    setTimeout(function() {
        $filterElement.removeData('initializing-from-anchor');
    }, 100);
}

// 使用 Bootstrap Table 的事件系统
// 参考：https://www.bootstraptable.com/docs/api/events/
// 全局标志：防止事件重复绑定
let statusTableEventsInitialized = false;

/**
 * 初始化相似度输入框：限制输入为0-100的整数
 * 业务逻辑：相似度查询输入框只能输入0-100之间的整数
 */
function initSimilarInput() {
    // 全局标志：防止重复初始化
    if (window.similarInputInitialized) {
        return;
    }
    window.similarInputInitialized = true;
    
    const $similarInput = $('#similar_input');
    if ($similarInput.length === 0) {
        return; // 如果输入框不存在，直接返回
    }
    
    // 限制只能输入数字
    $similarInput.off('input.similar keypress.similar paste.similar').on('input.similar', function(e) {
        let value = $(this).val();
        // 移除所有非数字字符
        value = value.replace(/[^\d]/g, '');
        // 限制范围在0-100
        if (value !== '') {
            const numValue = parseInt(value, 10);
            if (isNaN(numValue)) {
                value = '';
            } else if (numValue > 100) {
                value = '100';
            } else if (numValue < 0) {
                value = '0';
            } else {
                value = numValue.toString();
            }
        }
        $(this).val(value);
    });
    
    // 阻止非数字字符输入
    $similarInput.on('keypress.similar', function(e) {
        // 允许：数字、退格、删除、Tab、Esc、Enter
        if (e.which === 8 || e.which === 46 || e.which === 9 || e.which === 27 || e.which === 13 ||
            (e.which === 65 && e.ctrlKey === true) || // Ctrl+A
            (e.which >= 35 && e.which <= 40)) { // 方向键
            return;
        }
        // 只允许数字
        if ((e.which < 48 || e.which > 57)) {
            e.preventDefault();
        }
    });
    
    // 粘贴时验证
    $similarInput.on('paste.similar', function(e) {
        const self = this;
        setTimeout(function() {
            let value = $(self).val();
            // 移除所有非数字字符
            value = value.replace(/[^\d]/g, '');
            // 限制范围在0-100
            if (value !== '') {
                const numValue = parseInt(value, 10);
                if (isNaN(numValue)) {
                    value = '';
                } else if (numValue > 100) {
                    value = '100';
                } else if (numValue < 0) {
                    value = '0';
                } else {
                    value = numValue.toString();
                }
            }
            $(self).val(value);
        }, 0);
    });
}

$(document).ready(function(){
    SetStatusButton();
    
    // 初始化相似度输入框：限制输入为0-100的整数
    initSimilarInput();
    
    // 防止重复绑定事件
    if (statusTableEventsInitialized) {
        return;
    }
    statusTableEventsInitialized = true;
    
    // 初始化 tooltip 的辅助函数
    function initTooltips() {
        // 初始化所有带有 data-bs-toggle="tooltip" 的元素
        // CSS 样式已移到 oj_status.css 文件中
        const tooltipElements = document.querySelectorAll('.solution-id-tooltip[data-bs-toggle="tooltip"]');
        tooltipElements.forEach(function(element) {
            // 如果已经初始化过，先销毁
            const existingTooltip = bootstrap.Tooltip.getInstance(element);
            if (existingTooltip) {
                existingTooltip.dispose();
            }
            // 重新初始化，使用自定义配置
            new bootstrap.Tooltip(element, {
                html: true,
                placement: 'top',
                customClass: 'solution-id-tooltip-custom'
            });
        });
    }
    
    // 使用防抖优化 tooltip 初始化，避免重复初始化
    let tooltipInitTimeout;
    function debouncedInitTooltips() {
        clearTimeout(tooltipInitTimeout);
        tooltipInitTimeout = setTimeout(initTooltips, 100);
    }
    
    // 使用 Bootstrap Table 的 post-body 事件（表格 body 渲染后触发）
    // 使用命名空间事件，确保可以正确解绑
    $table.off('post-body.bs.table.status').on('post-body.bs.table.status', function(){
        // 处理表格宽度
        if($table[0].scrollWidth > status_table_div.width())
            status_table_div.width($table[0].scrollWidth + 20);
        // 清除旧的定时器
        for(let i in timer_ids) {
            clearTimeout(timer_ids[i]);
            delete timer_ids[i];
        }
        // 使用防抖初始化 tooltip（表格 body 更新后需要重新初始化）
        debouncedInitTooltips();
    });
    
    // 使用 Bootstrap Table 的 load-success 事件（数据加载成功后触发）
    $table.off('load-success.bs.table.status').on('load-success.bs.table.status', function(){
        // 清除旧的自动刷新定时器，防止重复执行
        if(autoRefreshTimerId !== null) {
            clearTimeout(autoRefreshTimerId);
            autoRefreshTimerId = null;
        }
        flg_auto_refresh_status = true;
        auto_refresh_results();
        // 使用防抖初始化 tooltip（数据加载成功后初始化）
        debouncedInitTooltips();
    });
});