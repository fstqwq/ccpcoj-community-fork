<div id="loading_div" class='overlay'>
    <div id="loading_spinner" class="spinner-border">&nbsp;Loading...</div>
</div>
<div id="page_div">
    <div class="record-export-toolbar">
        <div class="d-flex flex-wrap align-items-center gap-2">
            <!-- 第一行：大标题 + 日期 -->
            <div class="input-group input-group-sm record-export-title-group">
                <input class="exam_info_form form-control form-control-sm" name="global_title" placeholder="自定义大标题" type="text">
                <input class="exam_info_form form-control form-control-sm record-export-date" name="course_ymd" placeholder="年月日" type="text">
            </div>

            <!-- 操作按钮 -->
            <div class="btn-group btn-group-sm" role="group">
                <button class="btn btn-warning btn-sm button_fullscreen"><i class="bi bi-arrows-fullscreen"></i>全屏</button>
                <button class="btn btn-outline-warning btn-sm button_color_legend">图例</button>
            </div>

            <!-- 第二行：考试信息 -->
            <div class="input-group input-group-sm record-export-info-group">
                <input class="exam_info_form form-control form-control-sm" name="course_id" placeholder="课程编号" type="text">
                <input class="exam_info_form form-control form-control-sm" name="course_name" placeholder="课程名称" type="text">
                <input class="exam_info_form form-control form-control-sm record-export-credit" name="credit" placeholder="学分" type="text">
                <input class="exam_info_form form-control form-control-sm" name="exam_question_creater" placeholder="命题人" type="text">
                <input class="exam_info_form form-control form-control-sm" name="exam_question_reviewer" placeholder="审题人" type="text">
                <select class="exam_info_form form-select form-select-sm record-export-openclose" name="open_or_close" aria-label="open or close">
                    <option selected value="0">闭卷</option>
                    <option value="1">开卷</option>
                </select>
                <select class="exam_info_form form-select form-select-sm record-export-ab" name="a_or_b" aria-label="a or b">
                    {for start="0" end="6"}
                        <option {if $i==0} selected {/if} value="{$i}"><?php echo chr(ord('A')+$i); ?>卷</option>
                    {/for}
                </select>
            </div>

            <!-- 导出/配置 -->
            <div class="btn-group btn-group-sm" role="group">
                <button class="btn btn-success btn-sm" id="copy_exam_info_btn" title="复制配置"><i class="bi bi-clipboard-check"></i></button>
                <button class="btn btn-success btn-sm" id="paste_exam_info_btn" title="粘贴配置"><i class="bi bi-clipboard-minus-fill"></i></button>
                <button class="btn btn-outline-secondary btn-sm" id="exam_paper_preview_btn" title="预览样卷（带密封线）"><i class="bi bi-eye-fill"></i></button>
                <button class="btn btn-primary btn-sm" id="exam_paper_export_btn" title="导出归档文档"><i class="bi bi-file-check"></i> 归档</button>
            </div>

            <span style="display:none;" class="info_loading_asheet">Loading data ...</span>
        </div>
    </div>
    <div id="review_examinee_table_div">
        <table
            id="review_examinee_table"
            data-toggle="table"
            data-unique-id="team_id"
            data-buttons-align="left"
            data-side-pagination="client"
            data-url="/{$module}/admin/teamgen_list_ajax?cid={$contest['contest_id']}"
            data-pagination="false"
            data-method="get"
            data-show-export="true"
            data-export-types="['csv', 'png']"
            data-export-options='{"fileName": "archive"}'
            data-advanced-search="false"
            data-show-refresh="true"
            data-classes="table table-bordered table-hover table-striped"
        >
            <thead>
            <tr>
                <th data-field="check" data-checkbox="true"></th>
                <th data-field="idx" data-align="center" data-valign="middle" data-width="30" data-formatter="FormatterIdx">编号</th>
                <th data-field="team_id" data-align="center" data-valign="middle" data-sortable="true" data-width="55" data-formatter="FormatterExaminee">账号</th>
                <th data-field="name" data-align="center" data-valign="middle" data-width="90" >姓名</th>
                <th data-field="examinee_score" data-align="center" data-valign="middle" data-sortable="true" data-width="50" data-formatter="FormatterExamineeScore">分数</th>
                {foreach($contest_problem as $val)}
                    <th data-field="qs_{$val['problem_id']}" data-align="center" data-valign="middle"  data-formatter="FormatterScoreExport" data-cell-style="StyleScore">
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
                <th data-field="school"         data-align="center" data-valign="middle"                    data-sortable="true" >所在单位</th>
                <th data-field="room"           data-align="center" data-valign="middle"                    data-sortable="true" data-formatter="FormatterNoWrap">考场</th>
            </tr>
            </thead>
        </table>
    </div>
</div>
<input type="hidden" id='page_info' 
    cid="{$contest['contest_id']}" 
    allow_lang_key="<?php echo implode(',', array_keys($allowLanguage)); ?>" 
    allow_lang_val="<?php echo implode(',', array_values($allowLanguage)); ?>"
    question_list="<?php echo implode(',', array_column($contest_problem, 'problem_id')); ?>"
    attach_pro="<?php echo intval($contest['private'] / 10); ?>"
    contest_start="{$contest['start_time']}"
    contest_title="{$contest['title']}"
>
<script type="text/javascript" src="__STATIC__/examsys/review_func.js"></script>
<script type="text/javascript" src="__STATIC__/examsys/record_export.js"></script>

<script>
const FINISH_TASK_NUM = 4;
let reviewer_map;
let exam_info_config;
let contest_start;
let contest_title;

function FormatterExaminee(value, row, index, field) {
    return `<a href='/examsys/contest/teaminfo?cid=${row['contest_id']}&team_id=${value}' target='_blank' title="${value} | ${row.name} | ${row.school} | ${row.room}">${value}</a>`;
}
function CellScoreRet(row, field) {
    let ex_question_id = parseInt(field.replace('qs_', ''));
    return score_map?.[row.team_id]?.[ex_question_id];
}
function FormatterScoreExport(value, row, index, field) {
    let ex_question_id = parseInt(field.replace('qs_', ''));
    let ret = CellScoreRet(row, field), title = '';
    if(ret == null || typeof(ret) == 'undefined') return '-';
    title = ScoreSpanTitle(ret);
    return `<span class='qscore_td' qid='${ex_question_id}' id='qscore_${row.team_id}_qid_${ex_question_id}' title='${title}'>${ret.score === null ? 0 : ret.score}</span>`;
}
function LoadFinishOtherWorks() {
    InitReviewerName();
    InitTableQuestionThColor();
}
function InitReviewerName() {
    reviewer_map = {};
    let reviewer_set = new Set();
    let reviewer_exam = [], reviewer_sys = [];
    for(let i in asheet_map) {
        for(let qid in asheet_map[i]) {
            let reviewer = asheet_map[i][qid].reviewer;
            if(reviewer == null || reviewer == '' || (reviewer in reviewer_map)) {
                continue;
            }
            reviewer_map[reviewer.replace('#SYS', '')] = '';
            if(!reviewer_set.has(reviewer)) {
                if(reviewer.endsWith('#SYS')) {
                    reviewer_sys.push(reviewer.replace('#SYS', ''));
                } else {
                    reviewer_exam.push(reviewer);
                }
            }
            reviewer_set.add(reviewer);
        }
    }
    $.get('reviewer_recorded_list_ajax?cid=' + cid, {
        'reviewer_sys': reviewer_sys,
        'reviewer_exam': reviewer_exam
    }, function(ret) {
        if(ret.code == 1) {
            for(let i in ret.data.reviewer_sys) {
                reviewer_map[ret.data.reviewer_sys[i].reviewer] = ret.data.reviewer_sys[i].name;
            }
            for(let i in ret.data.reviewer_exam) {
                reviewer_map[ret.data.reviewer_exam[i].reviewer] = ret.data.reviewer_exam[i].name;
            }
        } else {
            alerty.error(ret.msg);
        }
    });
}
function InitTableQuestionThColor() {
    let th_list = document.getElementById('review_examinee_table').getElementsByTagName('th');
    for(let i = 0; i < th_list.length; i ++) {
        if(!th_list[i].hasAttribute('data-field')) {
            continue;
        }
        let atbt = th_list[i].getAttribute('data-field');
        if(!atbt.startsWith('qs_')) {
            continue;
        }
        let ex_question_id = parseInt(atbt.replace('qs_', ''));
        if(!(ex_question_id in question_map)) {
            throw new Error('InitTableQuestionThColor: question_map missing ex_question_id=' + ex_question_id);
        }
        const pkind = question_map[ex_question_id].pkind;
        th_list[i].style['background-color'] = question_default.pkind_color[pkind];
        th_list[i].style.color = 'white';
        // header DOM：归档页这里是 <button>（题目预览），而非 sortable 列的 <a>
        const headerDom = th_list[i].querySelector('button') || th_list[i].querySelector('a') || th_list[i].querySelector('.th-inner');
        if(!headerDom) {
            throw new Error('InitTableQuestionThColor: header dom not found for ex_question_id=' + ex_question_id);
        }
        headerDom.style.color = 'white';
        headerDom.style.textDecoration = 'none';
        th_list[i].setAttribute('title', `[${question_default.pkind_table_cn[pkind]}] ${question_map[ex_question_id].title}`)
    }
}
$('.button_fullscreen').click(function(){ToggleFullScreen('review_examinee_table_div')});
document.addEventListener("fullscreenchange", function () {
    if (!document.fullscreenElement) {
        // 不设置 height：避免 bootstrap-table 在 fixed-table-container 内部制造滚动条
        review_examinee_table.bootstrapTable('resetView');
        $('.fixed-table-toolbar').show();
    } else {
        // 全屏同理：不设置 height，表格高度自然展开
        review_examinee_table.bootstrapTable('resetView');
        $('.fixed-table-toolbar').hide();
    }
});
function InitExamInfoConfig() {
    // 从cookie获取
    exam_info_config = csg.store('exam_info_config_cid' + cid);
    if(exam_info_config == null) {
        exam_info_config = {};
    } else {
        exam_info_config = JSON.parse(exam_info_config);
    }
    SetExamInfoConfig(exam_info_config);
}
function GetExamInfoConfig() {
    // 从dom获取
    exam_info_config = {};
    csg.getdom('.exam_info_form').forEach((dom_item, idx) => {
        let name = dom_item.getAttribute('name');
        exam_info_config[name] = dom_item.value;
    });
    return exam_info_config;
}
function SetExamInfoConfig(config_json) {
    // 设置dom
    try {
        if(typeof(config_json) === 'string') {
            config_json = JSON.parse(config_json);
        }
        exam_info_config = config_json;
        csg.getdom('.exam_info_form').forEach((dom_item, idx) => {
            let name = dom_item.getAttribute('name');
            if(name in exam_info_config) {
                dom_item.value = exam_info_config[name];
            } else if(name == 'course_ymd') {
                dom_item.value = TimeLocal(null, 'yyyy-MM-dd');
            }
        });
    } catch(e) {
        console.error(e);
        alerty.error("配置信息格式不正确");
        return false;
    }
    return true;
}
function SaveExamInfoConfig(config_json=null) {
    // 存至cookie
    if(config_json === null) {
        config_json = GetExamInfoConfig();
    }
    try {
        if(typeof(config_json) != 'string') {
            config_json = JSON.stringify(config_json);
        }
        csg.store('exam_info_config_cid' + cid, config_json);
    } catch(e) {
        console.error(e);
        return false;
    }
    return true;
}
$(document).ready(function(){
    InitPageInfo();
    contest_start = page_info.attr('contest_start');
    contest_title = page_info.attr('contest_title');
    InitAllowLang();
    SetFrontAlerty('review_examinee_table_div'); // 初始化alerty提示信息dom
    InitExamInfoConfig();
    review_examinee_table.on('load-success.bs.table', function(){
        LoadData();
    });
    // 不设置 height：避免 fixed-table-container / fixed-table-body 出现内部 scrollbar
    review_examinee_table.bootstrapTable('resetView');

    $('.button_color_legend').click(function() {
        $('#content_show_modal_content').empty().append($('#color_legend_div').html());
        $('#content_show_modal_label_span').text('图例');
        $('#content_show_modal').modal('show');
    });
    $('#copy_exam_info_btn').click(function() {
        let setting_json = JSON.stringify(GetExamInfoConfig());
        if(ClipboardWrite(setting_json)) {
            alerty.success("考试信息已复制<br/>可以在其他考试导出页粘贴");
        } else {
            alerty.alert(`
            <span>浏览器环境不支持剪贴板，请手动复制以下内容：</span>
            <span class='text-red'>${setting_json}</span>
            `)
        } 
    });
    $('#paste_exam_info_btn').click(function() {
        if (navigator.clipboard && window.isSecureContext) {
            navigator.clipboard.readText().then(text => {
                const raw = (text == null) ? '' : String(text).trim();
                if(raw === '') {
                    alerty.alert("剪贴板中没有合法配置<br/><span class='en-text'>No valid config in clipboard</span>");
                    return;
                }
                // 粘贴配置：必须是合法 JSON（对象）
                let parsed = null;
                try {
                    parsed = JSON.parse(raw);
                } catch(e) {
                    alerty.alert("剪贴板中没有合法配置<br/><span class='en-text'>No valid config in clipboard</span>");
                    return;
                }
                if(parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
                    alerty.alert("剪贴板中没有合法配置<br/><span class='en-text'>No valid config in clipboard</span>");
                    return;
                }
                if(SetExamInfoConfig(parsed) && SaveExamInfoConfig(parsed)) {
                    alerty.success("考试信息已更新");
                } else {
                    alerty.alert("剪贴板中没有合法配置<br/><span class='en-text'>No valid config in clipboard</span>");
                }
            }).catch(err => {
                console.error('Failed to read clipboard contents: ', err);
                alerty.alert("读取剪贴板失败<br/><span class='en-text'>Failed to read clipboard</span>");
            });
        } else {
            alerty.prompt("粘贴设置", "{}",
                function(e, text) {
                    const raw = (text == null) ? '' : String(text).trim();
                    if(raw === '') {
                        alerty.alert("没有合法内容<br/><span class='en-text'>No valid content</span>");
                        return;
                    }
                    let parsed = null;
                    try {
                        parsed = JSON.parse(raw);
                    } catch(err) {
                        alerty.alert("没有合法内容<br/><span class='en-text'>No valid content</span>");
                        return;
                    }
                    if(parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
                        alerty.alert("没有合法内容<br/><span class='en-text'>No valid content</span>");
                        return;
                    }
                    if(SetExamInfoConfig(parsed) && SaveExamInfoConfig(parsed)) {
                        alerty.success("考试信息已更新");
                    } else {
                        alerty.alert("没有合法内容<br/><span class='en-text'>No valid content</span>");
                    }
                },
                function() {alerty.message("什么也没有发生");}
            );
        }
    });
    $('.exam_info_form').change(function() {
        SaveExamInfoConfig();
    })
    $('#exam_paper_export_btn').click(function() {
        GetExamInfoConfig();
        let selected_rows = review_examinee_table.bootstrapTable('getSelections')
        TotalExport(selected_rows.map((item) => item.team_id));
    });
    $('#exam_paper_preview_btn').click(function() {
        GetExamInfoConfig();
        PreviewPaperSealline();
    });
    document.querySelector('.exam_info_form[name="course_ymd"]').addEventListener('input', function() {
        let inputDate = new Date(this.value);
        if (isNaN(inputDate.getTime())) {
            this.value = new Date().toISOString().slice(0,10);
        }
    });
});
</script>

<style>
    .overlay {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: 100%;
        height: 100%;
        background-color: rgba(255,255,255,.5);
        z-index: 9999;
    }
    .content_show_modal_copy {
        display: none;
    }

    /* 归档页工具栏：更紧凑的布局（不改变 JS 依赖的 id/class/name） */
    .record-export-toolbar {
        padding: 6px 0;
    }
    .record-export-toolbar .input-group {
        width: auto;
        flex: 1 1 520px;
        min-width: 320px;
    }
    .record-export-toolbar .record-export-title-group {
        flex: 2 1 520px;
        min-width: 360px;
    }
    .record-export-toolbar .record-export-info-group {
        flex: 3 1 820px;
        min-width: 520px;
    }
    .record-export-toolbar .record-export-date {
        max-width: 180px;
    }
    .record-export-toolbar .record-export-credit {
        max-width: 90px;
    }
    .record-export-toolbar .record-export-openclose,
    .record-export-toolbar .record-export-ab {
        max-width: 90px;
    }
    @media (max-width: 992px) {
        .record-export-toolbar .input-group {
            flex: 1 1 100%;
            min-width: 0;
            width: 100%;
        }
    }
</style>

<div style="display:none;"  id="color_legend_div">
    <ul class="list-group">
        <li class="list-group-item list-group-item-warning">黄色：已自动判分</li>
        <li class="list-group-item list-group-item-success">绿色：已人工批改，会覆盖自动判分</li>
        <li class="list-group-item list-group-item-danger">红色：考生未答该题判 0 分，不支持人工判分</li>
        <li class="list-group-item list-group-item-secondary">灰色：主观题，尚未人工判分</li>
    </ul>
</div>
{include file="../../examsys/view/public/content_show_modal"}
{include file="../../csgoj/view/public/js_zip" /}

<style>
    #loading_spinner {
        position:absolute;
        top:50%;
        left:50%;
        /* transform:translate(-50%,-50%); */
    }
    #review_examinee_table_div {
        background-color: white;
    }

    /* 布局对齐 examinee_status 的“不要限制宽度”效果：
       归档页题目列更多，默认会在 fixed-table-container 内部出现横向 scrollbar。
       这里直接让表格向右撑开（max-content），取消内部横向滚动条。*/
    #review_examinee_table_div {
        overflow: visible;
    }
    #review_examinee_table_div .bootstrap-table,
    #review_examinee_table_div .fixed-table-container,
    #review_examinee_table_div .fixed-table-body,
    #review_examinee_table_div table {
        width: max-content;
        min-width: 100%;
        overflow-x: visible !important;
    }

    /* 归档页：尽量保持 bootstrap-table 原生样式，仅移除表头题目按钮的默认样式 */
    #review_examinee_table_div .question-header-qbtn{
        border: 0;
        background: transparent;
        padding: 0;
        line-height: 1;
        cursor: pointer;
    }

    /* 归档页：题目表头 badge（仅做 badge 视觉，不干预表格布局/列宽计算） */
    #review_examinee_table_div .question-header-qbadge{
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-width: 28px;
        height: 22px;
        padding: 0 8px;
        border-radius: 999px;
        font-weight: 700;
        font-size: 12px;
        color: #ffffff;
        background: rgba(255,255,255,.16);
        border: 1px solid rgba(255,255,255,.25);
        transition: all .12s ease;
        box-sizing: border-box;
    }
    #review_examinee_table_div .question-header-qbadge-2line{
        flex-direction: column;
        height: auto;
        padding: 6px 8px 5px;
        gap: 1px;
        min-width: 44px;
    }
    #review_examinee_table_div .question-header-qbadge-2line .qid{
        font-size: 12px;
        line-height: 1;
        font-weight: 800;
    }
    #review_examinee_table_div .question-header-qbadge-2line .qid2{
        font-size: 10px;
        line-height: 1.1;
        font-weight: 600;
        color: rgba(255,255,255,.85);
    }
    #review_examinee_table_div .question-header-qbtn:hover .question-header-qbadge{
        background: rgba(255,255,255,.22);
        border-color: rgba(255,255,255,.35);
        transform: translateY(-1px);
    }
</style>