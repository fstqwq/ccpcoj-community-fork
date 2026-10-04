// 考试页面 JavaScript 逻辑
// 依赖：question_default.js, question_render.js, question_submit.js, question_md_utils.js
// 注意：PAGE_MODULE 常量在 ex_global.js 中定义

let loading_div = $('#loading_div');
let exam_problemset_table = $('#exam_problemset_table');
let asheet = {}, asheet_tmp = {};   // asheet 已保存的答卷， asheet_tmp 当前修改过的答卷
let problemset = {};    // 编程题
let allow_lang = {};
let question_list, question_map = {};  // 映射到 table 的 row 数据
let main_width;
let page_info;
let contest_user;
let cid;
let examinee_defunct;
let allow_lang_key;
let allow_lang_val;
// markdown编辑器
let markdown_editor;
let vditorSingleton = null;

function InitPageInfo() {
    page_info = $('#page_info');
    contest_user = page_info.attr('contest_user');
    cid = page_info.attr('cid');
    examinee_defunct = page_info.attr('examinee_defunct');  // 是否已交卷
    // IndexedDB 异步读取本地答卷缓存
    // 注意：必须在后续渲染/状态判断前完成加载，否则会出现“缓存为空”的闪烁
    // 所有依赖已全局引入，直接使用
    // eslint-disable-next-line no-undef
    // (本仓库未统一 eslint；这里仅作说明)
    // await in caller
    main_width = document.getElementById("answer_sheet_div").clientWidth;
}

function InitAllowLang() {
    allow_lang_key = page_info.attr('allow_lang_key').split(',');
    allow_lang_val = page_info.attr('allow_lang_val').split(',');
    for(let i in allow_lang_key) {
        allow_lang[allow_lang_key[i]] = allow_lang_val[i];
    }
}

function FormatterExpProNum(value, row, index, field) {
    return value;
}

function FormatterExpProQuestionTitle(value, row, index, field) {
    let width = main_width - 350;
    let fake_title = (row.pkind == 25 ? GetFakeTitle(row, problemset?.[row.description]) : GetFakeTitle(row)) + '...';
    return `<div id='q_title_${row["ex_question_id"]}'><span class='d-inline-block text-truncate' style='width:${width}px;'>${fake_title}</span></div>`;
}

function FormatterExpProStatus(value, row, index, field) {
    return `<div id="question_answer_status_${row.ex_question_id}">${GetAnswerStatusHtml(row)}</div>`;
}

function DetailFormatterExpPro(index, row) {
    return GetDetailDom(
        row, 
        problemset, 
        null,           // asheet_single
        false,          // show
        true,           // asheet_display
        true,           // disable_display
        false,          // answer_display
        false           // math_process
    );
}

function RenderTable() {
    exam_problemset_table.bootstrapTable('load', question_list);
    LoadAsheet();
    let rows = exam_problemset_table.bootstrapTable('getData');
    for(let i in rows) {
        question_map[rows[i].ex_question_id] = rows[i];
    }
}

function LoadQuestion() {
    loading_div.show();
    $.get(`/${PAGE_MODULE}/contest/problemset_ajax?cid=${cid}`, function(ret) {
        question_list = ret;
        LoadProgrammProblem();
    });
}

function LoadAsheet(reset_asheet_tmp=false) {
    // 获取该考生答卷
    loading_div.show();
    $.get(`/${PAGE_MODULE}/contest/asheet_ajax?cid=${cid}`, function(data){
        try {
            if(reset_asheet_tmp == true) {
                asheet_tmp = {};
            }
            for(let i in data) {
                let ex_question_id = data[i]['ex_question_id'];
                asheet[ex_question_id] = data[i];
                try{
                    asheet[ex_question_id]['submission'] = $.parseJSON(asheet[ex_question_id]['submission']);
                    question_map[ex_question_id].answered = true;
                    question_map[ex_question_id].modified = false;
                } catch(e) {
                    console.error('get asheet submission error: ', ex_question_id, e);
                }
            }
            if(reset_asheet_tmp == true) {
                SetAsheetTmp(asheet_tmp, cid, contest_user);
            }
            // 处理没有提交的修改
            for(let ex_question_id in asheet_tmp) {
                let answered = ex_question_id in asheet;
                let modified = !answered || asheet_tmp[ex_question_id].update_at > asheet[ex_question_id].update_at;
                question_map[ex_question_id].answered = answered;
                question_map[ex_question_id].modified = modified;
            }
            for(let ex_question_id in question_map) {
                let row = question_map[ex_question_id];    // row
                UpdateQuestionAnswerStatus(row);
                let detail_dom = $(`#question_div_${ex_question_id}`);
                if(detail_dom.length > 0) {
                    QuestionRender.asheet.Render(
                        row,                // question
                        detail_dom[0],      // q_div
                        false               // show
                    );
                    QuestionRender.dis.Render(
                        row,                // question
                        detail_dom[0],      // q_div
                        null                // is_disable
                    );
                }
            }
            if(!reset_asheet_tmp) {
                exam_problemset_table.bootstrapTable('expandAllRows');
            }
        } catch(e) {
            console.error('get asheet error: ', e);
        }
        loading_div.hide();
    });
}

function LoadProgrammProblem() {
    $.get(`/${PAGE_MODULE}/contest/oj_problemset_ajax?cid=${cid}`, function(data){
        // 获取该场考试 programming 题目内容
        try {
            for(let i in data) {
                problemset[data[i]['problem_id']] = data[i];
            }
        } catch(e) {
            console.error('get problemset error: ', e);
        }
        RenderTable();
    });
}

function ExamFinishedWork() {
    $('.button_exam_finish').prop('disabled', true).html('<span class="cn-text">非考试状态</span><span class="en-text">Exam Not Active</span>');
    $('.button_save_all').prop('disabled', true);
    $('.button_recover').prop('disabled', true);
}

function HeartBeat() {
    $.get(`/${PAGE_MODULE}/contest/heartbeat_ajax?cid=${cid}`);
}

/**
 * 初始化 Markdown 编辑器（使用 Vditor）
 */
function SetMarkdownEditor() {
    const editorEl = document.querySelector('#markdown_editor');
    if (!editorEl) return;
    
    // 所有依赖已全局引入，直接使用
    vditorSingleton = CsgVditor.createSingletonEditor({
            el: '#markdown_editor',
            height: 500,
            options: {
                toolbarConfig: { pin: true },
                cache: { enable: false },
                preview: { delay: 300 },
            },
        });
        markdown_editor = vditorSingleton;
    } else {
        console.warn('CsgVditor is not available, markdown editor will not work');
    }
}

/**
 * 异步渲染展开行中的 Markdown 内容
 * @param {HTMLElement} detailElement - 展开行的详情元素
 */
async function renderMarkdownInDetail(detailElement) {
    if (!detailElement) return;
    
    // 查找所有占位符
    const placeholders = Array.from(detailElement.querySelectorAll('.vditor-placeholder'));
    if (placeholders.length === 0) return;
    
    // HTML 解码函数
    const decodeHtml = (str) => {
        if (!str) return '';
        return str
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&amp;/g, '&')
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'");
    };
    
    // 异步渲染每个占位符
    const renderPromises = placeholders.map(async (placeholder) => {
        const encodedMd = placeholder.getAttribute('data-md');
        if (!encodedMd) return;
        
        const md = decodeHtml(encodedMd);
        if (!md || md.trim() === '') return;
        
        // 创建临时容器
        const tempDiv = document.createElement('div');
        tempDiv.className = 'vditor-preview-container';
        
        if (!placeholder.parentNode) return;
        placeholder.parentNode.replaceChild(tempDiv, placeholder);
        
        // 使用 Vditor 渲染（所有依赖已全局引入）
        if (typeof CsgVditor !== 'undefined' && CsgVditor.render) {
            CsgVditor.render({
                el: tempDiv,
                markdown: md
            });
            
            // 等待 Vditor 渲染完成后再渲染数学公式
            // 使用 Promise 确保数学公式渲染在 Markdown 渲染完成后进行
            return new Promise((resolve) => {
                setTimeout(() => {
                    // 渲染数学公式（使用 KaTeX auto-render 扩展）
                    if (typeof renderMathInElement !== 'undefined' && typeof katex !== 'undefined') {
                        try {
                            renderMathInElement(tempDiv, {
                                delimiters: [
                                    {left: "$$", right: "$$", display: true},
                                    {left: "$", right: "$", display: false},
                                    {left: "\\[", right: "\\]", display: true},
                                    {left: "\\(", right: "\\)", display: false}
                                ],
                                throwOnError: false,
                                // 不忽略任何标签，确保所有数学公式都被渲染
                                ignoredTags: []
                            });
                        } catch (e) {
                            console.warn('KaTeX auto-render failed in renderMarkdownInDetail:', e);
                        }
                    }
                    resolve();
                }, 100);
            });
        } else {
            // 后备方案：直接显示文本
            tempDiv.textContent = md;
            return Promise.resolve();
        }
    });
    
    await Promise.all(renderPromises);
}

$(document).ready(async function(){
    InitPageInfo();
    asheet_tmp = await GetAsheetTmp(cid, contest_user);
    InitAllowLang();
    SetFrontAlerty('answer_sheet_div'); // 初始化alerty提示信息dom
    LoadQuestion();
    SetMarkdownEditor();
    if(examinee_defunct == 'Y') {
        ExamFinishedWork();
    }
    $('.button_expand').click(function(){
        // 全部展开
        exam_problemset_table.bootstrapTable('expandAllRows');
    });
    $('.button_collapse').click(function(){
        // 全部收起
        exam_problemset_table.bootstrapTable('collapseAllRows');
    });
    $('.button_recover').click(function(){
        // 全部已填写内容恢复为已保存的版本
        alerty.confirm("<span class='text-danger'>所有更改的答题内容（<i class='bi bi-file-diff-fill'></i>）恢复为最后保存版本（<i class='bi bi-save'></i>）</span>.<br/>All filled contents would be set to your saved version.",
            function(){
                LoadAsheet(true);   // 传入 true 重置asheet_tmp
                // exam_problemset_table.bootstrapTable('collapseAllRows');
                alerty.success("恢复完毕.<br/>Recover Finished.");
            },
            function(){
                alerty.message("什么也没有发生.<br/>Nothing Happened.");
            }
        );

    })
    $('.button_save_all').click(function(){
        // 提交所有修改的题目
        let modified_list = JudgeSaved();
        if(modified_list === true || modified_list.length == 0) {
            alerty.success("没有未保存的内容.<br/>No unsaved questions.");
            return;
        }
        let confirm_info = "已确认各题当前填写内容？";
        confirm_info += "<br/>Did you confirmed all filled contents?";
        confirm_info += "<br/><br/><span class='text-danger'>保存过程中勿进行任何操作. 将保存答卷改动</span>（<i class='bi bi-file-diff-fill'></i>）：";
        for(let i in modified_list) {
            confirm_info += `<br/>${modified_list[i].question_title}`;
        }
        alerty.confirm(confirm_info,
            function(){
                exam_problemset_table.bootstrapTable('expandAllRows');
                if(!JudgeAsheetValid(modified_list)) {
                    return;
                }
                setTimeout(() => {
                    SubmitMultiQuestionIterate(0, modified_list);
                }, 500);
                // SubmitMultiQuestion(modified_list);
            },
            function(){
                alerty.message("什么也没有发生.<br/>Nothing Happened.");
            }
        );
    });
    $('.button_exam_finish').click(function(){
        // 提交离场
        let confirm_info = "结束后无法再进行答题，确认？";
        confirm_info += "<br/>Sure to submit? After that you wouldn't do anything but leave.";
        let modified_list = JudgeSaved();
        if(modified_list !== true && modified_list.length > 0) {
            confirm_info += "<br/><br/><span class='text-danger'>部分答题更改未保存</span>（<i class='bi bi-file-diff-fill'></i>），仍要结束考试点确认，继续考试请取消. <br/>更改过回答的题目：";
            for(let i in modified_list) {
                confirm_info += `<br/>${modified_list[i].question_title}`;
            }
        }
        alerty.confirm(confirm_info,
            function(){
                $.get(`/${PAGE_MODULE}/contest/submit_exam_ajax?cid=${cid}`, {}, function(ret){
                    if(ret['code'] == 1) {
                        alerty.alert(ret['msg']);
                        ExamFinishedWork();
                    } else {
                        alerty.error(ret['msg']);
                    }
                });
            },
            function(){
                alerty.message("继续考试.<br/>Go on exam.");
            }
        );
    });
    exam_problemset_table.on('expand-row.bs.table', async function(index, row, $detail){
        // row展开时异步渲染markdown内容，然后渲染math公式
        const detailElement = $detail[0];
        if (detailElement) {
            // 先渲染 Markdown
            await renderMarkdownInDetail(detailElement);
            // 然后渲染数学公式（所有依赖已全局引入）
            // 注意：renderMarkdownInDetail 已经处理了 .vditor-preview-container 内的数学公式
            // 这里额外处理 .marked_math_div 和 .md_display_div 内的数学公式
            MathRender('.marked_math_div, .md_display_div', detailElement, true);
            // 也处理 .vditor-preview-container 内的数学公式（作为备用，因为 renderMarkdownInDetail 已经处理了）
            if (typeof renderMathInElement !== 'undefined' && typeof katex !== 'undefined') {
                setTimeout(() => {
                    try {
                        const containers = detailElement.querySelectorAll('.vditor-preview-container');
                        containers.forEach(container => {
                            renderMathInElement(container, {
                                delimiters: [
                                    {left: "$$", right: "$$", display: true},
                                    {left: "$", right: "$", display: false},
                                    {left: "\\[", right: "\\]", display: true},
                                    {left: "\\(", right: "\\)", display: false}
                                ],
                                throwOnError: false,
                                ignoredTags: []
                            });
                        });
                    } catch (e) {
                        console.warn('KaTeX auto-render failed in expand-row:', e);
                    }
                }, 200);
            }
        }
    });
    $('.button_fullscreen').click(function(){ToggleFullScreen('answer_sheet_div')});
    setInterval(HeartBeat, 600000);
});

