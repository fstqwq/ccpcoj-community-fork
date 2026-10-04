// ========================================
// 比赛列表表格 Formatter 函数
// ========================================

// 比赛标题formatter - 带自适应宽度（ACM OJ 专用）
function FormatterContestTitle(value, row, index, field) {
    // 获取页面模块信息
    let page_module = 'csgoj'; // 默认值
    if (typeof page_info !== 'undefined' && page_info.length > 0) {
        page_module = page_info.attr('page_module') || 'csgoj';
    }
    // 也支持从 window.ContestConfig 获取模块信息
    if (window.ContestConfig && window.ContestConfig.module) {
        page_module = window.ContestConfig.module;
    }
    
    // 根据比赛类型（private % 10）决定 URL
    // 0/1: csgoj, 2: cpcsys, 4: expsys, 5: examsys
    let contest_url;
    const contestType = parseInt(row['private']) % 10;
    
    switch(contestType) {
        case 0:
        case 1:
            // 公开/私有比赛：使用 csgoj 模块
            contest_url = `/csgoj/contest/problemset?cid=${row['contest_id']}`;
            break;
        case 2:
            // CPC 标准比赛：使用 cpcsys 模块
            contest_url = `/cpcsys/contest/problemset?cid=${row['contest_id']}`;
            break;
        case 4:
            // 练习：使用 expsys 模块
            contest_url = `/expsys/contest/problemset?cid=${row['contest_id']}`;
            break;
        case 5:
            // 考试：使用 examsys 模块
            contest_url = `/examsys/contest/problemset?cid=${row['contest_id']}`;
            break;
        default:
            // 未知类型，根据当前模块决定（主要用于管理后台）
            if (page_module == 'admin' || page_module == 'exadmin') {
                // 管理后台，默认使用 csgoj
                contest_url = `/csgoj/contest/problemset?cid=${row['contest_id']}`;
            } else {
                // 其他情况，使用当前模块
                contest_url = `/${page_module}/contest/problemset?cid=${row['contest_id']}`;
            }
    }
    
    // 顺其自然：不做基于窗口宽度的截断/限宽，由布局自行决定换行与占位
    return `<a class="text-decoration-none text-primary" title="${value}" href="${contest_url}">${value}</a>`;
}

// 比赛类型formatter - 管理后台专用
function FormatterContestType(value, row, index, field) {
    const privateValue = parseInt(value);
    const attach = Math.floor(privateValue / 10 + 1e-8);
    const ckind = privateValue % 10;
    let ckind_str, cl;
    
    switch(ckind) {
        case 0:
            // csgoj 列表会清空 password 但返回 has_pass，admin 列表返回 password
            const hasPassword = (row.has_pass === true) || (row.password != null && String(row.password).trim() !== '');
            if(hasPassword) {
                cl = 'warning';
                ckind_str = "加密<span class='en-text'>Encrypted</span>";
            } else {
                cl = 'success';
                ckind_str = "公开<span class='en-text'>Public</span>";
            }
            break;
        case 1:
            cl = 'info';
            ckind_str = "私有<span class='en-text'>Private</span>";
            break;
        case 2:
            cl = 'primary';
            ckind_str = "标准<span class='en-text'>Standard</span>";
            break;
        case 4:
            cl = 'success';
            ckind_str = "练习<span class='en-text'>Practice</span>";
            break;
        case 5:
            cl = 'danger';
            ckind_str = "考试<span class='en-text'>Exam</span>";
            break;
        default:
            cl = 'secondary';
            ckind_str = "未知<span class='en-text'>Unknown</span>";
    }
    
    return `<span class='badge bg-${cl} csg-badge-eq'>${ckind_str}</span>`;
}

// 比赛启用状态formatter - 管理后台专用（defunct字段）
function FormatterContestStatus(value, row, index, field) {
    // 这是管理后台的defunct状态，表示比赛是否启用/禁用
    let currentStatus = row.defunct == '0' ? "启用" : "禁用";
    let nextStatus = row.defunct == '0' ? "禁用" : "启用";
    let currentStatusEn = row.defunct == '0' ? "Enabled" : "Disabled";
    let nextStatusEn = row.defunct == '0' ? "Disabled" : "Enabled";
    
    return `
        <button type='button' field='defunct' itemid='${row.contest_id}' 
            class='change_status btn btn-sm ${row.defunct == '0' ? "btn-success" : "btn-warning"}' 
            status='${row.defunct}' title="点击更改为${nextStatus}状态(Click to change to ${nextStatusEn})">${currentStatus}<span class='en-text'>${currentStatusEn}</span>
        </button>
    `;
}

// 比赛进行状态formatter - 前台专用（根据时间判断）
function FormatterContestTimeStatus(value, row, index, field) {
    var phase = (typeof CsgContestPhaseByRowTimes === 'function')
        ? CsgContestPhaseByRowTimes(row)
        : null;
    if (phase === -1) {
        return "<span class='badge bg-success csg-badge-eq'>未开始<span class='en-text'>Coming</span></span>";
    }
    if (phase === 0) {
        return "<span class='badge bg-danger csg-badge-eq'>进行中<span class='en-text'>Running</span></span>";
    }
    if (phase === 1) {
        return "<span class='badge bg-secondary csg-badge-eq'>已结束<span class='en-text'>Ended</span></span>";
    }
    // 兜底：旧字符串比较（无 Csg 工具时）
    var nowMs = $('#page_info').attr('time_stamp');
    if (typeof nowMs === 'undefined' || nowMs == null || String(nowMs).length === 0) {
        nowMs = new Date().getTime();
    } else {
        nowMs = parseFloat(String(nowMs)) * 1000;
    }
    var nowStr = typeof Timestamp2Time === 'function' ? Timestamp2Time(nowMs) : '';
    if (nowStr < row.start_time) {
        return "<span class='badge bg-success csg-badge-eq'>未开始<span class='en-text'>Coming</span></span>";
    } else if (nowStr <= row.end_time) {
        return "<span class='badge bg-danger csg-badge-eq'>进行中<span class='en-text'>Running</span></span>";
    }
    return "<span class='badge bg-secondary csg-badge-eq'>已结束<span class='en-text'>Ended</span></span>";
}


// 编辑formatter - 管理后台专用（复用统一样式，exadmin 只读用 outline-secondary + 眼睛图标）
function FormatterContestEdit(value, row, index, field) {
    var module = (window.ContestConfig && window.ContestConfig.module) || 'admin';
    var url = '/' + module + '/contest/contest_edit?id=' + row.contest_id;
    if (row.is_admin) {
        return createAdminEditBtn({ url: url, title: '编辑(Edit)', disabled: false });
    }
    if (module === 'exadmin') {
        return '<a href="' + url + '" class="btn btn-sm btn-outline-secondary" title="查看(View)"><i class="bi bi-eye"></i></a>';
    }
    return createAdminDisabledSpan('无权限编辑(No Permission)');
}

// 复制formatter - 管理后台专用（复用统一样式）
function FormatterContestCopy(value, row, index, field) {
    var module = (window.ContestConfig && window.ContestConfig.module) || 'admin';
    var canCopy = row.is_admin || module === 'exadmin';
    return createAdminCopyBtn({
        disabled: !canCopy,
        url: '/' + module + '/contest/contest_copy?id=' + row.contest_id,
        title: canCopy ? '复制比赛(Copy Contest)' : ''
    });
}

// 附件formatter - 管理后台专用（复用统一样式）
function FormatterContestAttach(value, row, index, field) {
    var module = (window.ContestConfig && window.ContestConfig.module) || 'admin';
    var title = row.title ? (row.title.length > 150 ? row.title.substring(0, 150) + '...' : row.title) : '';
    return createAdminAttachBtn({
        disabled: !row.is_admin,
        modalUrl: '/' + module + '/filemanager/filemanager?item=contest&id=' + row.contest_id,
        modalTitle: '附件管理 - 比赛 #' + row.contest_id + ' - ' + title,
        title: '附件管理 (File Manager)'
    });
}

// 重判formatter - 管理后台专用
function FormatterContestRejudge(value, row, index, field) {
    if (parseInt(row.flg_archive || 0, 10) !== 0) {
        return '<span class="text-muted small" title="已归档">—</span>';
    }
    if (row.is_admin) {
        // 根据比赛类型决定重判控制台所在模块：
        // - 普通比赛（0/1）：csgoj
        // - 标准比赛（2）：cpcsys
        // - 练习（4/14）：expsys（private % 10 == 4）
        // - 考试（5）：examsys（兜底兼容）
        const privateValue = parseInt(row['private'] ?? row['protected'] ?? 0);
        const contestType = privateValue % 10;
        let module = 'csgoj';
        if (contestType === 2) {
            module = 'cpcsys';
        } else if (contestType === 4) {
            module = 'expsys';
        } else if (contestType === 5) {
            module = 'examsys';
        } else {
            module = 'csgoj';
        }
        return `<a href='/${module}/admin/contest_rejudge?cid=${row.contest_id}' target='_blank' class="btn btn-sm btn-warning" title="比赛重判控制台 (Contest Rejudge Console)">
                    <i class="bi bi-arrow-clockwise"></i>
                </a>`;
    }
    return createAdminDisabledSpan('无权限重判(No Permission)');
}

/** 大后台超级管理员：删除列（与 deleteContest / exadmin 练习删除前置条件一致；不可删时灰显 + title） */
function FormatterContestSuperDelete(value, row, index, field) {
    var cid = row.contest_id;
    var title = (row.title || '').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
    var canDelete = row.can_delete == 1 || row.can_delete === '1';
    var deleteReason = (row.delete_reason || '')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;')
        .replace(/`/g, '&#96;');
    var module = (window.ContestConfig && window.ContestConfig.module) || 'admin';
    if (!canDelete) {
        var defaultReason = '该比赛存在提交、考生账号或答卷等记录，无法删除';
        var tooltipText = deleteReason || defaultReason;
        return (
            '<span class="d-inline-block" title="' +
            tooltipText +
            '" style="cursor: not-allowed;">' +
            '<span class="btn btn-sm btn-outline-secondary disabled" style="pointer-events: none;">' +
            '<i class="bi bi-trash"></i>' +
            '</span></span>'
        );
    }
    var okTip = deleteReason || '删除 (Delete)';
    return (
        '<button type="button" class="btn btn-sm btn-danger admin-contest-super-delete-btn" ' +
        'data-contest-id="' +
        cid +
        '" data-module="' +
        module +
        '" data-contest-title="' +
        title +
        '" title="' +
        okTip +
        '">' +
        '<i class="bi bi-trash"></i></button>'
    );
}

/** 管理端比赛列表：归档开关（仅图标 + 颜色；title 供 global.js 转 Tooltip，说明当前态与点击后态） */
function FormatterContestArchive(value, row, index, field) {
    if (!row.is_admin) {
        return '<span class="text-muted">—</span>';
    }
    var module = (window.ContestConfig && window.ContestConfig.module) || 'admin';
    var on = parseInt(row.flg_archive || 0, 10) !== 0;
    var next = on ? 0 : 1;
    var icon = on ? 'bi-archive-fill' : 'bi-archive';
    var colorClass = on ? 'text-secondary' : 'text-success';
    var title =
        (on
            ? '当前为已归档，点击改为未归档（取消归档）'
            : '当前为未归档，点击改为已归档') +
        ' (' +
        (on ? 'Archived — click to unarchive' : 'Not archived — click to archive') +
        ')';
    var titleAttr = title.replace(/"/g, '&quot;');
    return (
        '<button type="button" class="btn btn-link btn-sm p-0 border-0 align-middle text-decoration-none contest-archive-toggle-btn ' +
        colorClass + '" style="line-height:1;min-width:1.25rem" ' +
        'data-module="' +
        module +
        '" data-cid="' +
        row.contest_id +
        '" data-next="' +
        next +
        '" title="' +
        titleAttr +
        '">' +
        '<i class="bi ' +
        icon +
        ' fs-5" aria-hidden="true"></i>' +
        '<span class="visually-hidden">' +
        (on ? '已归档，点击取消归档' : '未归档，点击归档') +
        '</span></button>'
    );
}

// ========================================
// 客户端筛选功能 - 已迁移到 general_formatter.js
// ========================================

// ========================================
// 事件监听和初始化
// ========================================

// 窗口大小变化时重新计算标题宽度
$(document).ready(function() {
    $(document).on('click', '.admin-contest-super-delete-btn', function (e) {
        e.preventDefault();
        e.stopPropagation();
        if (!window.ContestConfig || !window.ContestConfig.contest_super_delete) {
            return;
        }
        var $btn = $(this);
        var contestId = $btn.data('contest-id');
        var mod = $btn.data('module') || 'admin';
        var contestTitle = $btn.data('contest-title') || '比赛 #' + contestId;
        var url = '/' + mod + '/contest/contest_delete_ajax';
        if (typeof alerty === 'undefined' || !alerty.confirm) {
            window.alert('缺少确认组件');
            return;
        }
        alerty.confirm(
            '确定要删除该比赛吗？<br><br>' +
                '<strong>比赛 ID：</strong>' +
                contestId +
                '<br><strong>标题：</strong>' +
                contestTitle +
                '<br><br>' +
                '<span class="text-danger">仅当无提交记录、无考生账号且无答卷记录时可删除；删除后无法恢复。</span>',
            '确认删除',
            function () {
                $.post(
                    url,
                    { contest_id: contestId },
                    function (response) {
                        if (response && response.code === 1) {
                            var $t = $('#contest_list_table');
                            if ($t.length && typeof $t.bootstrapTable === 'function') {
                                $t.bootstrapTable('remove', {
                                    field: 'contest_id',
                                    values: [contestId],
                                });
                            }
                            alerty.success(response.msg || '删除成功', '成功');
                        } else {
                            alerty.error((response && response.msg) || '删除失败', '错误');
                        }
                    },
                    'json'
                ).fail(function () {
                    alerty.error('网络错误，请稍后重试。', '错误');
                });
            },
            function () {}
        );
    });

    $(document).on('click', '.contest-archive-toggle-btn', function () {
        var $btn = $(this);
        var mod = $btn.data('module') || 'admin';
        var cid = $btn.data('cid');
        var next = $btn.data('next');
        if (!cid) {
            return;
        }
        $btn.prop('disabled', true);
        $.post(
            '/' + mod + '/contest/contest_archive_toggle_ajax',
            { cid: cid, flg_archive: next },
            function (ret) {
                $btn.prop('disabled', false);
                if (ret && ret.code === 1) {
                    var $t = $('#contest_list_table');
                    if ($t.length && typeof $t.bootstrapTable === 'function') {
                        $t.bootstrapTable('refresh');
                    }
                } else {
                    var msg = (ret && ret.msg) ? ret.msg : '操作失败';
                    if (typeof alerty !== 'undefined' && alerty.alert) {
                        alerty.alert({ message: msg, message_en: msg });
                    } else {
                        window.alert(msg);
                    }
                }
            },
            'json'
        ).fail(function () {
            $btn.prop('disabled', false);
            var msg = '网络错误';
            if (typeof alerty !== 'undefined' && alerty.alert) {
                alerty.alert({ message: msg, message_en: msg });
            } else {
                window.alert(msg);
            }
        });
    });

    const $contest_list_table = $('#contest_list_table');
    let resizeTimeout;
    $(window).on('resize', function() {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(function() {
            // 重新刷新表格以应用新的标题宽度
            if (typeof $contest_list_table.bootstrapTable !== 'undefined') {
                $contest_list_table.bootstrapTable('refresh');
            }
        }, 300); // 防抖，300ms后执行
    });
    
});
