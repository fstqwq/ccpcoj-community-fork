<div class="admin-page-header">
    <div class="admin-page-header-left">
        <div class="admin-page-header-icon">
            <i class="bi bi-people-fill"></i>
        </div>
        <h1 class="admin-page-header-title">
            <div class="admin-page-header-title-main">
                全局考生账号管理
            </div>
            <div class="admin-page-header-title-right">
                <span class="en-text">Global Examinee Account Management</span>
            </div>
        </h1>
    </div>
</div>

<div id="page_div">
    <div id="contest_global_account_table_toolbar" class="table-toolbar">
        <div class="d-flex align-items-center gap-2 flex-wrap">
            <div class="toolbar-group">
                <span class="toolbar-label-inline"><span>考试ID</span><span class="toolbar-label en-text">Exam ID</span></span>
                <input id="cid_list_input" name="cid_list" placeholder="cid like 1001,1003-1006,..." class="form-control toolbar-input" type="text" style="width:200px;">
            </div>
            <button id="load_account_btn" class="btn btn-success toolbar-btn" title="加载数据 (Load Data)">
                <i class="bi bi-arrow-clockwise"></i> <span class="cn-text">加载</span><span class="en-text">Load</span>
            </button>
            <div class="toolbar-group ms-auto">
                <button id="export_total_btn" class="btn btn-primary toolbar-btn" title="导出总表 (Export Total)" disabled>
                    <i class="bi bi-download"></i> <span class="cn-text">导出总表</span><span class="en-text">Export Total</span>
                </button>
                <button id="export_by_contest_btn" class="btn btn-info toolbar-btn" title="分考试导出 (Export by Exam)" disabled>
                    <i class="bi bi-file-zip"></i> <span class="cn-text">分考试导出</span><span class="en-text">Export by Exam</span>
                </button>
                <button id="export_by_room_btn" class="btn btn-warning toolbar-btn" title="分考场导出 (Export by Room)" disabled>
                    <i class="bi bi-file-zip"></i> <span class="cn-text">分考场导出</span><span class="en-text">Export by Room</span>
                </button>
            </div>
        </div>
    </div>
    <div id="contest_global_account_table_div">
        <table
            id="contest_global_account_table"
            class="bootstraptable_refresh_local"
            data-toggle="table"
            data-toolbar="#contest_global_account_table_toolbar"
            data-toolbar-align="left"
            data-buttons-align="right"
            data-side-pagination="client"
            data-pagination="false"
            data-method="get"
            data-sort-name="contest_id"
            data-sort-order="desc"
            data-unique-id="row_index"
            data-classes="table table-bordered table-hover table-striped"
        >
            <thead>
            <tr>
                <th data-field="idx" data-align="center" data-valign="middle" data-width="50" data-formatter="FormatterIdx">序号<span class="en-text">Idx</span></th>
                <th data-field="team_id" data-align="center" data-valign="middle" data-width="120" data-sortable="true" data-formatter="FormatterTeamId">账号<span class="en-text">Account ID</span></th>
                <th data-field="name" data-align="left" data-valign="middle" data-width="120" data-sortable="true">姓名<span class="en-text">Name</span></th>
                <th data-field="school" data-align="center" data-valign="middle" data-width="150" data-sortable="true">学校/组织<span class="en-text">School/Organization</span></th>
                <th data-field="room" data-align="center" data-valign="middle" data-width="100" data-sortable="true">考场<span class="en-text">Room</span></th>
                <th data-field="tkind" data-align="center" data-valign="middle" data-width="100" data-formatter="FormatterExamTkind">考生类型<span class="en-text">Exam Type</span></th>
                <th data-field="password" data-align="center" data-valign="middle" data-width="100" data-formatter="FormatterPassword">密码<span class="en-text">Password</span></th>
                <th data-field="contest_id" data-align="center" data-valign="middle" data-width="80" data-sortable="true" data-formatter="FormatterExamId">考试ID<span class="en-text">Exam ID</span></th>
                <th data-field="contest_title" data-align="left" data-valign="middle" data-sortable="true" data-formatter="FormatterContestTitle">考试名称<span class="en-text">Exam Title</span></th>
            </tr>
            </thead>
        </table>
    </div>
</div>
<input id="page_info" type="hidden">
{include file="../../csgoj/view/public/js_exceljs" /}
{include file="../../csgoj/view/public/js_zip" /}
<script type="text/javascript" src="__STATIC__/examsys/ex_global.js"></script>
{js href="__STATIC__/examsys/contest/account_gen.js" /}
{js href="__STATIC__/exadmin/exam_global_account.js" /}
<script>
const MAX_CID_LEN = 64;
let page_info = $('#page_info');
let contest_global_account_table = $('#contest_global_account_table');
let cid_list_input = $('#cid_list_input');
let load_account_btn = $('#load_account_btn');
let export_total_btn = $('#export_total_btn');
let export_by_contest_btn = $('#export_by_contest_btn');
let export_by_room_btn = $('#export_by_room_btn');
let map_contest = {};
let current_team_list = [];

function FormatterIdx(value, row, index) {
    return index + 1;
}

function FormatterTeamId(value, row, index) {
    // 检查是否有重复的 team_id，如果有则标红
    const isDuplicate = row._is_duplicate || false;
    if (isDuplicate) {
        return `<span class="text-danger fw-bold">${escapeHtml(value)}</span>`;
    }
    return escapeHtml(value);
}

function FormatterExamId(value, row, index) {
    return `<a href='/examsys/contest/contest?cid=${row.contest_id}'>${value}</a>`;
}

function FormatterContestTitle(value, row, index) {
    let idx_well = value.indexOf('#');
    let real_title = value;
    if(idx_well != -1) {
        real_title = value.slice(idx_well + 1);
    }
    return `<span title="${escapeHtml(value)}">${escapeHtml(real_title)}</span>`;
}

function FormatterPassword(value, row, index, field) {
    if (!value || value === '' || value === null) {
        return '<span class="text-muted">-</span>';
    }
    if (value === '[SYS_PASS]' || value === '[SYS_PASS]') {
        return '<span class="badge bg-info"><i class="bi bi-key me-1"></i>系统密码</span>';
    }
    return '<code class="text-primary">' + escapeHtml(value) + '</code>';
}

function FormatterExamTkind(value, row, index, field) {
    const tkindMap = {
        0: '<span class="badge bg-success">正常考试</span>',
        2: '<span class="badge bg-warning">打星</span>',
        10: '<span class="badge bg-primary">初修:考试</span>',
        11: '<span class="badge bg-warning">初修:缓考</span>',
        12: '<span class="badge bg-danger">初修:补考</span>',
        20: '<span class="badge bg-danger">重修:考试</span>',
        21: '<span class="badge bg-warning">重修:缓考</span>',
        22: '<span class="badge bg-danger">重修:补考</span>',
    };
    return tkindMap[value] || '<span class="badge bg-secondary">未知</span>';
}

function escapeHtml(text) {
    return DomSantize(text);
}

function ContestIdListValidate(cid_list) {
    cid_list.sort((a, b) => a - b);
    if(cid_list.length > MAX_CID_LEN) {
        cid_list = cid_list.slice(0, MAX_CID_LEN);
        alerty.warn(`最多查询${MAX_CID_LEN}场考试，已截取`, `Maximum ${MAX_CID_LEN} exams, truncated`);
    }
    let cid_str = '';
    for (let i = 0; i < cid_list.length; i++) {
        let start = cid_list[i];
        while (i + 1 < cid_list.length && cid_list[i + 1] - cid_list[i] == 1) {
            i++;
        }
        let end = cid_list[i];

        if (start != end) {
            cid_str += start + '-' + end + ',';
        } else {
            cid_str += start + ',';
        }
    }
    cid_str = cid_str.slice(0, -1);
    cid_list_input.val(cid_str);
    csg.store('contest_global_account_cid_list', cid_str);
    return cid_list;
}

function ProcessCidList() {
    let cid_str = cid_list_input.val();
    let cid_info_list = cid_str.split(',');
    let cid_list = [], cid_map = {};
    for(let i = 0; i < cid_info_list.length; i ++) {
        let info_item = cid_info_list[i];
        if(info_item.includes('-')) {
            let tmp = info_item.split('-');
            let start = parseInt(tmp[0]);
            let end = parseInt(tmp[1]);
            if(isNaN(start) || isNaN(end) || start === 0) {
                continue;
            }
            for(let i = start; i <= end && i < start + MAX_CID_LEN; i ++) {
                if(!(i in cid_map)) {
                    cid_map[i] = true;
                    cid_list.push(i);
                }
            }
        } else {
            let tmp = parseInt(info_item);
            if(isNaN(tmp) || tmp === 0) {
                continue;
            }
            if(!(tmp in cid_map)) {
                cid_map[tmp] = true;
                cid_list.push(tmp);
            }
        }
    }
    cid_list = ContestIdListValidate(cid_list);
    return cid_list;
}

function LoadAccountData() {
    let cid_list = ProcessCidList();
    if (cid_list.length === 0) {
        alerty.error("请提供考试ID列表", "Please provide exam ID list");
        return;
    }
    
    $.get(
        `/exadmin/exam/contest_global_account_ajax`,
        { 'cid_list': cid_list },
        function(ret){
            if(ret.code == 1) {
                map_contest = {};
                let data = ret.data;
                let cid_list = [];
                for(let i = 0; i < data.contest_list.length; i ++) {
                    cid_list.push(data.contest_list[i].contest_id);
                    map_contest[data.contest_list[i].contest_id] = data.contest_list[i];
                }
                
                // 为每个 team 添加 row_index 和 contest_title
                for(let i = 0; i < data.team_list.length; i ++) {
                    data.team_list[i].row_index = `team_${data.team_list[i].team_id}_${data.team_list[i].contest_id}_${i}`;
                    data.team_list[i].contest_title = map_contest?.[data.team_list[i].contest_id]?.title || '';
                }
                
                // 检查重复的 team_id，标记为红色
                const teamIdCount = {};
                data.team_list.forEach(team => {
                    const teamId = team.team_id;
                    if (!teamIdCount[teamId]) {
                        teamIdCount[teamId] = [];
                    }
                    teamIdCount[teamId].push(team);
                });
                
                // 标记重复的 team_id
                Object.keys(teamIdCount).forEach(teamId => {
                    if (teamIdCount[teamId].length > 1) {
                        teamIdCount[teamId].forEach(team => {
                            team._is_duplicate = true;
                        });
                    }
                });
                
                current_team_list = data.team_list;
                contest_global_account_table.bootstrapTable('load', data.team_list);
                ContestIdListValidate(cid_list);
                
                // 启用导出按钮
                export_total_btn.prop('disabled', false);
                export_by_contest_btn.prop('disabled', false);
                export_by_room_btn.prop('disabled', false);
                
                alerty.success("数据已加载", "Data loaded");
            } else {
                alerty.error(ret.msg || '加载失败', ret.msg || 'Load failed');
            }
        }
    );
}

load_account_btn.click(function() {
    LoadAccountData();
});

cid_list_input.keypress(function(event){ 
    let keycode = event.keycode ? event.keycode : event.which;
    if(keycode == 13) {
        LoadAccountData();
    }
});

function InitStore() {
    let cid_str = csg.store('contest_global_account_cid_list');
    if(cid_str !== null) {
        cid_list_input.val(cid_str);
    }
}

$(document).ready(function(){
    InitStore();
    SetFrontAlerty('contest_global_account_table_div');
    
    // 绑定导出按钮事件（在 exam_global_account.js 中实现）
    if (typeof window.GlobalAccountExport !== 'undefined') {
        export_total_btn.click(function() {
            window.GlobalAccountExport.exportTotal(current_team_list, map_contest);
        });
        
        export_by_contest_btn.click(function() {
            window.GlobalAccountExport.exportByContest(current_team_list, map_contest);
        });
        
        export_by_room_btn.click(function() {
            window.GlobalAccountExport.exportByRoom(current_team_list, map_contest);
        });
    }
});
</script>
<style>
    #contest_global_account_table_div {
        background-color: white;
    }
    
    .text-danger.fw-bold {
        font-weight: bold;
    }
</style>
