<div class="admin-page-header">
    <div class="admin-page-header-left">
        <div class="admin-page-header-icon">
            <i class="bi bi-people"></i>
        </div>
        <h1 class="admin-page-header-title">
            <div class="admin-page-header-title-main">
                全局考生状态管理
            </div>
            <div class="admin-page-header-title-right">
                <span class="en-text">Global Examinee Status Management</span>
            </div>
        </h1>
    </div>
</div>

<div id="page_div">
    <div id="contest_examinee_status_table_toolbar" class="table-toolbar">
        <div class="d-flex align-items-center gap-2 flex-wrap">
            <div class="toolbar-group">
                <span class="toolbar-label-inline"><span>考试ID</span><span class="toolbar-label en-text">Exam ID</span></span>
                <input id="cid_list_input" name="cid_list" placeholder="cid like 1001,1003-1006,..." class="form-control toolbar-input status_filter" type="text" style="width:200px;">
            </div>
            <div class="toolbar-group">
                <span class="toolbar-label-inline"><span>考场</span><span class="toolbar-label en-text">Room</span></span>
                <input id="room_list_input" name="room_list" placeholder="room like 1考场,2考场..." class="form-control toolbar-input status_filter" type="text" style="width:200px;">
            </div>
            <button id="load_examinee_status_btn" class="btn btn-success toolbar-btn" title="加载数据 (Load Data)">
                <i class="bi bi-arrow-clockwise"></i> <span class="cn-text">加载</span><span class="en-text">Load</span>
            </button>
        </div>
    </div>
    <div id="contest_examinee_status_table_div">
        <table
            id="contest_examinee_status_table"
            class="bootstraptable_refresh_local"
            data-toggle="table"
            data-toolbar="#contest_examinee_status_table_toolbar"
            data-toolbar-align="left"
            data-buttons-align="right"
            data-side-pagination="client"
            data-pagination="false"
            data-method="get"
            data-sort-name="room"
            data-sort-order="asc"
            data-show-export="true"
            data-export-types="['csv', 'json', 'png']"
            data-export-options='{"fileName": "Team_Generated"}'
            data-fixed-columns=true
            data-fixed-number=3
            data-classes="table table-bordered table-hover table-striped"
        >
            <thead>
            <tr>
                <th data-field="idx"            data-align="center" data-valign="middle" data-width="30"    data-formatter="FormatterIdx">序号<span class="en-text">Idx</span></th>
                {/*
                    账号列已通过 FormatterExaminee 显示：姓名 / 账号 / 单位（三行）
                    因此不再单独展示“姓名/所在单位”两列，避免重复、节省空间
                */}
                <th data-field="team_id"        data-align="left"   data-valign="middle" data-width="190"   data-sortable="true"  data-formatter="FormatterExaminee">考生<span class="en-text">Examinee</span></th>
                <th data-field="room"           data-align="center" data-valign="middle"                    data-sortable="true" data-formatter="FormatterNoWrap">考场<span class="en-text">Room</span></th>
                <th data-field="ip"             data-align="center" data-valign="middle" data-width="120"   data-sortable="true" data-formatter="FormatterIp">IP<span class="en-text">IP</span></th>
                <th data-field="defunct"        data-align="center" data-valign="middle" data-width="120"   data-sortable="true" data-formatter="FormatterExamineeStatus">考试状态<span class="en-text">Status</span></th>
                <th data-field="contest_id"     data-align="center" data-valign="middle" data-width="50"    data-sortable="true" data-formatter="FormatterExamId">考试ID<span class="en-text">Exam ID</span></th>
                <th data-field="contest_title"  data-align="center" data-valign="middle"                    data-sortable="true" data-formatter="FormatterContestTitle">考试名称<span class="en-text">Exam Title</span></th>
            </tr>
            </thead>
        </table>
    </div>
</div>
<input id="page_info" type="hidden" >
{/* 依赖：PAGE_MODULE（在 ex_global.js 中定义），以及 examinee_status.js 提供的表格事件/formatter */}
<script type="text/javascript" src="__STATIC__/examsys/ex_global.js"></script>
<script type="text/javascript">
    // exadmin 的“全局考生状态管理”使用自己的后端接口做状态变更，避免依赖 examsys/admin 的监考鉴权
    window.CSGOJ_EXAMINEE_STATUS_CHANGE_URL = function(cid) {
        return `/exadmin/exam/contest_examinee_status_change_ajax?cid=${cid}`;
    };
</script>
<script type="text/javascript" src="__STATIC__/examsys/examinee_status.js"></script>
<script>
const MAX_CID_LEN = 64;
let page_info = $('#page_info');
let cid = page_info.attr('cid');
let contest_examinee_status_table = $('#contest_examinee_status_table');
let cid_list_input = $('#cid_list_input');
let room_list_input = $('#room_list_input');
let load_examinee_status_btn = $('#load_examinee_status_btn');
let map_contest;
function FormatterExamId(value, row, index, field) {
    return `<a href='/examsys/contest/contest?cid=${row.contest_id}'>${value}</a>`;
}
function FormatterContestTitle(value, row, index, field) {
    let idx_well = value.indexOf('#');
    let real_title = value;
    if(idx_well != -1)  {
        real_title = value.slice(idx_well + 1);
    }
    return `<span title="${value}">${real_title}</span>`;
}
function ContestIdListValidate(cid_list) {
    cid_list.sort((a, b) => a - b);
    if(cid_list.length > MAX_CID_LEN) {
        cid_list = cid_list.slice(0, MAX_CID_LEN);
        alerty.warn(`最多查询${MAX_CID_LEN}场考试，已截取`, `Maximum ${MAX_CID_LEN} exams, truncated`)
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
    csg.store('contest_examinee_status_cid_list', cid_str);
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
function RoomFilter() {
    let room_list_tmp = room_list_input.val().split(',');
    let room_set = new Set();
    for(let i = 0; i < room_list_tmp.length; i ++) {
        if(room_list_tmp[i].trim() != '') {
            room_set.add(room_list_tmp[i].trim());
        }
    }
    csg.store('contest_examinee_status_room_list', Array.from(room_set).join(','));
    if(room_set.size > 0) {
        contest_examinee_status_table.bootstrapTable('filterBy', room_set, {
            filterAlgorithm: (row, filters) => {
                return room_set.has(row.room);
            }
        });
    } else {
        contest_examinee_status_table.bootstrapTable('filterBy', room_set, {
            filterAlgorithm: (row, filters) => {
                return true;
            }
        });
    }
}
room_list_input.change(function() {
    RoomFilter();
    csg.store()
})
function LoadExamineeStatus() {
    let cid_list = ProcessCidList();
    $.get(
        `/exadmin/exam/contest_examinee_status_ajax`, {
            'cid_list': cid_list
        },
        function(ret){
            if(ret.code == 1) {
                map_contest = {};
                let data = ret.data;
                let cid_list = [];
                for(let i = 0; i < data.contest_list.length; i ++) {
                    cid_list.push(data.contest_list[i].contest_id);
                    map_contest[data.contest_list[i].contest_id] = data.contest_list[i];
                }
                for(let i = 0; i < data.team_list.length; i ++) {
                    data.team_list[i].contest_title = map_contest?.[data.team_list[i].contest_id]?.title;
                }
                contest_examinee_status_table.bootstrapTable('load', data.team_list);
                ContestIdListValidate(cid_list);
                RoomFilter();
                alerty.success("新数据已加载<br/>非考试ID已过滤", "New data loaded<br/>Non-exam IDs filtered");
            } else {
                alerty.error(ret.msg || '加载失败', ret.msg || 'Load failed');
            }
        }
    );
}
load_examinee_status_btn.click(function() {
    LoadExamineeStatus();
});
cid_list_input.keypress(function(event){ 
    let keycode = event.keycode ? event.keycode : event.which;
    if(keycode == 13) {
        LoadExamineeStatus();
    }
});
function InitStore() {
    let cid_str = csg.store('contest_examinee_status_cid_list');
    if(cid_str !== null) {
        cid_list_input.val(cid_str);
    }
    let room_str = csg.store('contest_examinee_status_room_list');
    if(room_str != null) {
        room_list_input.val(room_str);
    }
}
$(document).ready(function(){
    InitStore();
    SetFrontAlerty('contest_examinee_status_table_div');
    SetupExamineeStatusTableEvents(contest_examinee_status_table, null, {
        showDefunctHint: true,
        onDefunctToggleSuccess: function(team, row, $element) {
            $element.html(FormatterExamineeStatus(row.defunct, row));
        },
        onIpUnlockSuccess: function(team, row, $element) {
            $element.html(FormatterIp(null, row));
        }
    });
    
    contest_examinee_status_table.on('load-success.bs.table', function(){
        LoadAllAsheet();
    });
});
</script>
<style>
    #contest_examinee_status_table_div {
        background-color: white;
    }

    /* 复用 /expsys/contest/rank 的“姓名列”风格：更紧凑、层级清晰 */
    #contest_examinee_status_table_div .examinee-name-unit .name-text {
        font-weight: 500;
        margin-bottom: 2px;
        font-size: 0.95em;
        line-height: 1.1;
    }
    #contest_examinee_status_table_div .examinee-name-unit .user-id-text {
        margin-bottom: 2px;
        font-size: 0.82em;
        color: #6c757d;
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
        line-height: 1.1;
    }
    #contest_examinee_status_table_div .examinee-name-unit .unit-text {
        font-size: 0.85em;
        line-height: 1.1;
    }
    #contest_examinee_status_table_div .examinee-name-unit {
        max-width: 220px;
        word-break: break-word;
    }
</style>


{css href="__STATIC__/examsys/examsys.css" /}