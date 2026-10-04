<div id="page_div">
    <div id="examinee_table_toolbar">
        <div class="btn-group" role="group">
            <button class="btn btn-warning button_fullscreen" style="margin-right: 5px;"><i class="bi bi-arrows-fullscreen"></i>全屏</button>
        </div>
        <span style="display:none;" class="info_loading_asheet">Loading answer sheet ...</span>
    </div>
    <div id="examinee_table_div">
        <table
            id="examinee_table"
            class="bootstraptable_refresh_local"
            data-toggle="table"
            data-unique-id="team_id"
            data-toolbar="#examinee_table_toolbar"
            data-buttons-align="left"
            data-side-pagination="client"
            data-url="/{$module}/admin/teamgen_list_ajax?cid={$contest['contest_id']}"
            data-pagination="false"
            data-method="get"
            data-show-export="true"
            data-export-types="['csv', 'json', 'png']"
            data-export-options='{"fileName": "Team_Generated"}'
            data-fixed-columns=true
            data-fixed-number=2
            data-show-refresh="true"
            data-advanced-search="false"
            data-classes="table table-bordered table-hover table-striped"
        >
            <thead>
            <tr>
                <th data-field="idx"            data-align="center" data-valign="middle" data-width="30"    data-formatter="FormatterIdx">Idx</th>
                <th data-field="team_id"        data-align="left" data-valign="middle" data-width="140"   data-sortable="true"  data-formatter="FormatterExaminee">账号/姓名/单位<span class="en-text">Account/Name/Unit</span></th>
                <th data-field="school"         data-visible="false" data-sortable="true">所在单位</th>
                <th data-field="room"           data-align="center" data-valign="middle"                    data-sortable="true" data-formatter="FormatterNoWrap">考场</th>
                <th data-field="ip"             data-align="center" data-valign="middle" data-width="120"   data-sortable="true" data-formatter="FormatterIp">IP</th>
                <th data-field="defunct"        data-align="center" data-valign="middle" data-width="120"   data-sortable="true" data-formatter="FormatterExamineeStatus">考试状态</th>
                <th data-field="total_saved"    data-align="center" data-valign="middle" data-width="50">已答</th>
                {foreach($contest_problem as $val)}
                    <th data-field="qs_{$val['problem_id']}" data-align="center" data-valign="middle"  data-formatter="FormatterQuestionStatus" >
                        <button
                            type="button"
                            class="question-header-qbtn question_display"
                            ex_question_id="{$val['problem_id']}"
                            title="Q{$val['num']} / ID {$val['problem_id']} - 点击预览题目 / Click to preview"
                        >
                            {if ($isAdmin || (isset($isTeacher) && $isTeacher))}
                                <span class="question-header-qbadge question-header-qbadge-2line">
                                    <span class="qid">{$val['num']}</span>
                                    <span class="qid2">#{$val['problem_id']}</span>
                                </span>
                            {else /}
                                <span class="question-header-qbadge">{$val['num']}</span>
                            {/if}
                        </button>
                    </th>
                {/foreach}
            </tr>
            </thead>
        </table>
    </div>
</div>
<input id="page_info" type="hidden" cid="<?php echo htmlspecialchars($contest['contest_id']); ?>" question_list="<?php echo implode(',', array_column($contest_problem, 'problem_id')); ?>" data-is-admin="<?php echo (isset($isAdmin) && $isAdmin) || (isset($isTeacher) && $isTeacher) ? '1' : '0'; ?>">
{css href="__STATIC__/expsys/ex_rank.css" /}
<script type="text/javascript" src="__STATIC__/examsys/examinee_status.js"></script>
<script>
let page_info = $('#page_info');
// 题目预览配置：监考等"考试内权限"可以预览题目，但不显示"使用该题的考试"
window.questionPreviewConfig = window.questionPreviewConfig || {};
window.questionPreviewConfig.showUsage = page_info.attr('data-is-admin') === '1';
// 非 教师/管理员：预览时不显示参考答案与答案解析
window.questionPreviewConfig.showAnswer = page_info.attr('data-is-admin') === '1';
let cid = page_info.attr('cid');
let examinee_table = $('#examinee_table');
let asheet_all = {};
let question_record;
function FormatterQuestionStatus(value, row, index, field) {
    let ex_question_id = field.split('_')[1];
    if(row['team_id'] in asheet_all && ex_question_id in asheet_all[row['team_id']]) {
        return `<i class='bi bi-save' title='已填写 / Filled'></i>`;
    }
}
function InitQuestionRecord() {
    // 从 table header 获取
    question_record = new Set(page_info.attr('question_list').split(',').map(x => parseInt(x)));
}
function LoadAllAsheet() {
    // 管理员获取所有考生答题状态
    $.get(
        `/examsys/contest/asheet_ajax?cid=${cid}`, 
        {
            'fields': ['examinee_id', 'ex_question_id'],
            'query_all': 1
        },
        function(data){
            let rows = examinee_table.bootstrapTable('getData');
            asheet_all = {};
            for(let i = 0; i < data.length; i ++) {
                if(!(data[i].examinee_id in asheet_all)) {
                    asheet_all[data[i].examinee_id] = {};
                }
                if(!(question_record.has(data[i].ex_question_id))) {
                    continue;   // 处理考试开考后删题但已经有学生提交的情况
                }
                asheet_all[data[i].examinee_id][data[i].ex_question_id] = true;
            }
            for(let i in rows) {
                if(rows[i].team_id in asheet_all) {
                    rows[i].total_saved = Object.keys(asheet_all[rows[i].team_id]).length;
                } else {
                    rows[i].total_saved = 0;
                }
            }
            examinee_table.bootstrapTable('load', rows);
        }
    );
}
$('.button_fullscreen').click(function(){ToggleFullScreen('examinee_table_div')});

document.addEventListener("fullscreenchange", function () {
    if (!document.fullscreenElement) {
        examinee_table.bootstrapTable('resetView', {height: $(window).height() * 0.7});
        $('.fixed-table-toolbar').show();
    } else {
        examinee_table.bootstrapTable('resetView', {height: window.screen.height + $('.fixed-table-toolbar').height()});
        $('.fixed-table-toolbar').hide();
    }
});
$(document).ready(function(){
    SetFrontAlerty('examinee_table_div'); // 初始化alerti提示信息dom
    InitQuestionRecord();
    // 使用通用函数设置表格事件
    SetupExamineeStatusTableEvents(examinee_table, cid, {
        showDefunctHint: true
    });
    
    examinee_table.on('load-success.bs.table', function(){
        LoadAllAsheet();
    });
    examinee_table.bootstrapTable('resetView', {height: $(window).height() * 0.7});
});
</script>
<style>
    #examinee_table_div {
        background-color: white;
    }
    .question-header-qbtn{
        border: 0;
        background: transparent;
        padding: 0;
        line-height: 1;
        cursor: pointer;
    }
    .question-header-qbadge{
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-width: 28px;
        height: 22px;
        padding: 0 8px;
        border-radius: 999px;
        font-weight: 700;
        font-size: 12px;
        color: #0d6efd;
        background: rgba(13,110,253,.10);
        border: 1px solid rgba(13,110,253,.25);
        transition: all .12s ease;
    }
    .question-header-qbadge-2line{
        flex-direction: column;
        height: auto;
        padding: 6px 8px 5px;
        gap: 1px;
        min-width: 44px;
    }
    .question-header-qbadge-2line .qid{
        font-size: 12px;
        line-height: 1;
        font-weight: 800;
    }
    .question-header-qbadge-2line .qid2{
        font-size: 10px;
        line-height: 1.1;
        font-weight: 600;
        color: rgba(13,110,253,.85);
    }
    .question-header-qbtn:hover .question-header-qbadge{
        background: rgba(13,110,253,.16);
        border-color: rgba(13,110,253,.40);
        transform: translateY(-1px);
    }

    /* 账号/姓名/单位列：复用 ex_rank 的信息块风格，但更紧凑 */
    #examinee_table .examinee-name-unit {
        display: flex;
        flex-direction: column;
        gap: 2px;
        align-items: flex-start;
        padding: 2px 0;
        line-height: 1.15;
        min-width: 0;
    }
    #examinee_table .examinee-name-unit .name-text {
        font-weight: 600;
        font-size: 0.85rem;
        color: #212529;
        max-width: 130px;
    }
    #examinee_table .examinee-name-unit .user-id-text {
        font-size: 0.78rem;
        line-height: 1.1;
        margin: 0;
    }
    #examinee_table .examinee-name-unit .unit-text {
        font-size: 0.75rem;
        color: #6c757d;
        max-width: 130px;
    }
    #examinee_table .examinee-name-unit .text-truncate {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }
</style>