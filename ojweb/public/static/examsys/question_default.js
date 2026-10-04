// 注意：PAGE_MODULE 常量在 ex_global.js 中定义

// 防重复加载：如果已定义则跳过
if (typeof question_default === 'undefined') {
let question_default = {
    "singlechoice": {
        "pkind": 0,
        "description": "",
        "content": [
            "A选项",
            "B选项",
            "C选项",
            "D选项"
        ],
        "answer": [
            "A"
        ]
    },
    "multichoice": {
        "pkind": 1,
        "description": "",
        "content": [
            "A选项",
            "B选项",
            "C选项",
            "D选项"
        ],
        "answer": [
            "A",
            "B"
        ]
    },
    "truefalse": {
        "pkind": 5,
        "description": "",
        "content": [],
        "answer": [
            "T"
        ]
    },
    "fill": {
        "pkind": 10,
        "description": "",
        "content": [
            "第一空描述（可为空）：",
            "第二空描述（可为空）："
        ],
        "answer": [
            "第一空答案",
            "第二空答案"
        ]
    },
    "shortanswer": {
        "pkind": 15,
        "description": "",
        "content": [],
        "answer": [
            "答案"
        ]
    },
    "comprehensive": {
        "pkind": 20,
        "description": "自由编辑，支持markdown、latex",
        "content": [
            {
                "content": "第一小题描述，支持markdown、latex",
                "score_ratio": "第一小题分数比例，用正整数 x 表示比例为 x%"
            },
            {
                "content": "第二小题描述，支持markdown、latex",
                "score_ratio": "第二小题分数比例，用正整数 x 表示比例为 x%"
            },
            {
                "content": "最后一小题描述",
                "score_ratio": "最后一小题自动计算剩余分数"
            }
        ],
        "answer": [
            "第一小题参考答案",
            "第二小题参考答案",
            "最后一小题参考答案"
        ]
    },
    "programming": {
        "pkind": 25,
        "description": "填写OJ题目ID",
        "content": ["参考代码框架"],
        "answer": ["答案代码"]
    },
    "pkind_table": {
        "0": "SingleChoice",
        "1": "MultiChoice",
        "5": "TrueFalse",
        "10": "Fill",
        "15": "ShortAnswer",
        "20": "Comprehensive",
        "25": "Programming"
    },
    // pkind -> 默认模板 key（避免依赖大小写转换）
    "pkind_template_key": {
        "0": "singlechoice",
        "1": "multichoice",
        "5": "truefalse",
        "10": "fill",
        "15": "shortanswer",
        "20": "comprehensive",
        "25": "programming"
    },
    "pkind_table_cn": {
        "0": "单选",
        "1": "多选",
        "5": "判断",
        "10": "填空",
        "15": "简答",
        "20": "综合",
        "25": "编程"
    },
    "pkind_table_en": {
        "0": "Single Choice",
        "1": "Multiple Choice",
        "5": "True/False",
        "10": "Fill in the Blank",
        "15": "Short Answer",
        "20": "Comprehensive",
        "25": "Programming"
    },
    "pkind_color": {
        // 配色原则：题型区分更明确（更"亮/饱和"），但仍保持 Bootstrap 5 风格的干净与克制
        // 适合用于标签/徽章底色（不走荧光），并尽量让相邻题型色相差异更大
        0:  "#FF922B", // orange - 单选
        1:  "#FFD43B", // yellow/amber - 多选
        5:  "#38D9A9", // teal - 判断
        10: "#4DABF7", // blue - 填空
        15: "#9775FA", // purple - 简答
        20: "#FF6B6B", // red - 综合
        25: "#51CF66", // green - 编程
        30: "#D08C60", // brown - 预留扩展
        35: "#FAA2C1", // pink - 预留扩展
        40: "#CED4DA"  // gray - 预留扩展
    },
    "pkind_contrast_color": {
        // 与 pkind_color 对应的对比色，用于确保文字在背景色上的可读性
        // 基于 WCAG 对比度标准计算：luminance > 0.5 使用黑色，否则使用白色
        0:  "#FFFFFF", // orange 背景用黑色文字
        1:  "#FFFFFF", // yellow 背景用黑色文字
        5:  "#FFFFFF", // teal 背景用黑色文字
        10: "#FFFFFF", // blue 背景用黑色文字
        15: "#FFFFFF", // purple 背景用黑色文字
        20: "#FFFFFF", // red 背景用黑色文字
        25: "#FFFFFF", // green 背景用黑色文字
        30: "#FFFFFF", // brown 背景用黑色文字
        35: "#FFFFFF", // pink 背景用黑色文字
        40: "#FFFFFF"  // gray 背景用黑色文字
    },
    "pkind_reverse_table": {
        "SingleChoice": "0",
        "MultiChoice": "1",
        "TrueFalse": "5",
        "Fill": "10",
        "ShortAnswer": "15",
        "Comprehensive": "20",
        "Programming": "25"
    },
    "default_score": {
        "0": 2,
        "1": 2,
        "5": 2,
        "10": 2,
        "15": 10,
        "20": 20,
        "25": 20
    }
};
// 将 question_default 暴露到全局作用域
window.question_default = question_default;
} // 结束防重复加载检查

// 将题型配色同步为 CSS 变量，方便模板/CSS 直接复用（避免多处硬编码）
// 变量名：--pkind-color-0 / --pkind-color-1 / ...
try {
    if (typeof document !== 'undefined' && window.question_default && window.question_default.pkind_color) {
        const rootStyle = document.documentElement && document.documentElement.style;
        if (rootStyle) {
            const colors = window.question_default.pkind_color;
            Object.keys(colors).forEach((k) => {
                rootStyle.setProperty(`--pkind-color-${k}`, String(colors[k]));
            });
        }
    }
} catch (e) {
    // ignore
}

// 将题型配色应用到 DOM（不在 CSS 里硬编码 pkind 编号）
// 做法：给元素写入 CSS 变量 --csg-pkind-color，CSS 仅消费该变量渲染
function CsgApplyPkindColorsToDom() {
    try {
        if (typeof document === 'undefined') return;
        const setVar = (el, pkind) => {
            if (!el || pkind === null || pkind === undefined || pkind === '') return;
            el.style.setProperty('--csg-pkind-color', `var(--pkind-color-${pkind})`);
        };

        // 题型 pills（question_type_header 等）
        document.querySelectorAll('.csg-question-type-nav .li_pkind[pkind]').forEach((el) => {
            setVar(el, el.getAttribute('pkind'));
        });

        // 题型筛选工具条（checkbox + label.btn）
        document.querySelectorAll('.csg-pkind-filter .btn-check[pkind]').forEach((input) => {
            const pkind = input.getAttribute('pkind');
            const id = input.getAttribute('id');
            if (!id) return;
            const label = document.querySelector(`label[for="${CSS.escape(id)}"]`);
            if (label) setVar(label, pkind);
        });

        // 题目编辑面板背景（exadmin/question_edit.php）
        document.querySelectorAll('#question_edit_surface[data-pkind], .question-edit-surface[data-pkind]').forEach((surface) => {
            const pk = surface.getAttribute('data-pkind');
            setVar(surface, pk);
        });
    } catch (e) {
        // ignore
    }
}
window.CsgApplyPkindColorsToDom = CsgApplyPkindColorsToDom;
try {
    if (typeof document !== 'undefined') {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', CsgApplyPkindColorsToDom);
        } else {
            CsgApplyPkindColorsToDom();
        }
        // 一些页面会晚些插入组件，额外再跑一次
        setTimeout(CsgApplyPkindColorsToDom, 300);
    }
} catch (e) {
    // ignore
}

// 如果已存在则使用已存在的，否则定义新的
if (typeof markdown_editor_button === 'undefined') {
    window.markdown_editor_button = ``; // 考生端不再显示"辅助编辑器"
}
if (typeof stu_ans_markdown_convert === 'undefined') {
    window.stu_ans_markdown_convert = true;
}
// **************************************************
// bootstrap-table style
function FormatterExpProPkind(value, row, index, field) {
    if(value == 0)          return '<span title="单选">单选</span>';
    else if(value == 1)     return '<span title="多选">多选</span>';
    else if(value == 5)     return '<span title="判断">判断</span>';
    else if(value == 10)    return '<span title="填空">填空</span>';
    else if(value == 15)    return '<span title="简答">简答</span>';
    else if(value == 20)    return '<span title="综合">综合</span>';
    else if(value == 25)    return '<span title="编程">编程</span>';
}
function StylePkind(value, row, index, field) {
    return {
        css: {
            "background-color": question_default.pkind_color[value],
            color: "white"
        }
    };
}
// **************************************************
// Question Render
// 核心渲染逻辑已拆分至 question_render.js
// Markdown/Math 工具在 question_md_utils.js
// 题目预览在 question_preview.js
function GetAnswerStatusHtml(row) {
    // display on table row status column
    let ret = '';
    if(row?.answered === true) {
        ret += `<i class="bi bi-save" title="本题已保存过\nanswered and saved"></i>`;
    }
    if(row?.modified === true) {
        ret += `<i class="bi bi-file-diff-fill" title="有未保存的修改\nchanged but not saved"></i>`;
    }
    return ret;
}

// 注意：数学公式处理函数已移至 math.js，请使用 MathRender, MathDomProcess, MathCodeProcess
// 注意：show_question 已移至 question_preview.js

function PreviewSubmission(question) {
    // 预览该题的提交
    asheet_single = GetNewerAsheetSingle(asheet, asheet_tmp, question.ex_question_id);
    if(IsNothing(asheet_single?.ex_question_id)) {
        alerty.warning("没有答卷可以预览");
        return false;
    }
    let asheet_span_list = [];
    if(!(asheet_single?.submission?.length) || asheet_single?.submission?.length == 1) {
        asheet_span_list.push(`<span class="stu_asheet_span"></span>`)
    } else {
        for(let i = 0; i < asheet_single.submission.length; i ++) {
            asheet_span_list.push(`(${i+1}) <span class="stu_asheet_span"></span>`)
        }
    }
    let q_div_id = `q_div_${question.ex_question_id}`;
    let q_div = $(`<div id='${q_div_id}'>${asheet_span_list.join('<br/>')}</div>`)[0];
    QuestionRender.asheet.Render(question, q_div, true, asheet_single);
    alerty.alert({message: q_div.outerHTML, title: `答卷预览 / Answer Preview`});

}
document.addEventListener('click', function(event){
    const qTrigger = event.target.closest && event.target.closest('.question_display');
    if(qTrigger){
        // 如果元素有 data-preview-url 属性，说明已经有专门的处理器（如 question_list.js），跳过
        if (qTrigger.hasAttribute('data-preview-url')) {
            return;
        }
        // 避免旧代码里 href="#" 导致滚动到顶部
        event.preventDefault();
        // 管理员点此class对象可弹出题目预览
        const ex_question_id = qTrigger.getAttribute('ex_question_id');
        // 检查是否有自定义的预览 URL
        const previewUrl = qTrigger.getAttribute('data-preview-url');
        // 如果没有指定 URL，根据当前路径推断
        let url = previewUrl;
        if (!url) {
            // 根据当前页面路径推断：如果在 exadmin 模块，使用 exadmin 的接口
            if (window.location.pathname.includes('/exadmin/')) {
                url = '/exadmin/question/question_ajax';
            } else {
                // 默认使用 exadmin 的接口（兼容旧代码）
                url = '/exadmin/question/question_ajax';
            }
        }
        if (typeof show_question === 'function') {
            show_question(ex_question_id, url);
        } else {
            console.warn('show_question is not defined. Please ensure question_preview.js is loaded.');
        }
    } else if(event.target.classList.contains("radiocheck_container")){
        // 便于选中 radio 或 checkbox
        let input = event.target.querySelector("input[type='checkbox'], input[type='radio']");
        if (input) {
            input.click();
        }
    } else if(event.target.classList.contains("preview_submission")) {
        PreviewSubmission(question_map?.[event.target.getAttribute('qid')]);
    } else if(event.target.id == 'encode_markdown_do') {
        let resstr = JSON.stringify(markdown_editor.getMarkdown());
        if(resstr.length >= 2) {
            resstr = resstr.slice(1, resstr.length - 2);
        }
        // if(ClipboardWrite(resstr)) {
        //     alerty.success("json编码后的markdown<br/>已复制到剪贴板");
        // } else {
        //     alerty.warning("当前网络环境或浏览器不支持按钮复制<br/>请手动复制并使用转码功能");
        // }
        try {
            markdown_modal_bs.hide();
            transcoding_text.val(resstr);
            transcoding_text.focus();
            transcoding_text.select();
            transcoding_modal_bs.show();
        } catch(e) {
            alerty.error("功能在当前页面不可用");
        }

    } else if(event.target.classList.contains('btn_fast_score')) {
        let score_change = event.target.getAttribute('vl');
        score_change = score_change == 'hf' ? 'hf' : parseFloat(score_change);
        let score_input = event.target.parentNode.nextElementSibling;
        while(score_input && score_input.tagName.toLowerCase() !== 'input') {
            score_input = score_input.nextElementSibling;
        }
        if(score_input) {
            let q_score = parseFloat(score_input.getAttribute('q_score'));
            let score_now = parseFloat(score_input.value);
            if(isNaN(score_now)) {
                score_now = 0;
            }
            if(score_change === 'hf') {
                score_now = HalfScore(q_score);
            } else {
                score_now += score_change;
            }
            if(score_now < 0) {
                score_now = 0;
            }
            if(score_now > q_score) {
                score_now = q_score;
            }
            if(score_now != Math.floor(score_now + 0.00000001)) {
                score_now = score_now.toFixed(1)
            }
            score_input.value = score_now;
        }
    } else if(event.target.classList.contains('pro_result_show')) {
        // oj_status.js 在 review页引入
        let res = event.target.getAttribute('res');
        let res_show = res >= 5 && res <= 100;
        let info = {
            'solution_id': event.target.getAttribute('sid'),
            'result': res,
            'res_show': res >= 5 && res <= 100
        }
        if(res_show) {
            BtnResultShow(info, `/${PAGE_MODULE}/contest/resdetail_ajax`, cid);
        } else {
            alerty.message("无额外信息");
        }
    }
});
// **************************************************
// question validate
function ValidateQuestionEdit(pkind, question_content_json, question_answer_json) {
    if(pkind == 0) {
        // 单项选择题
        if(!question_content_json.every(IsStringorNumber)) {
            alerty.error("内容应为一系列字符串或数字<br/>Content is not array of strings or numbers");
            return false;
        }
        if(question_answer_json.length != 1) {
            alerty.error("答案应该为唯一选项<br/>Answer should be 1 choice");
            return false;
        }
        for(let i = 0; i < question_answer_json.length; i ++) {
            question_answer_json[i] = question_answer_json[i].toUpperCase();
            let selection_ascii = question_answer_json[i].charCodeAt(0);
            if(question_answer_json[i].length != 1) {
                alerty.error("答案应为唯一答案形如 [\"A\"]<br/>Answer should be single choice like [\"A\"]");
                return false;
            } else if(selection_ascii < 65 || selection_ascii >= 65 + question_content_json.length) {
                alerty.error("答案编号超出选项个数<br/>Answer should not exceed choices");
                return false;
            }
        }
    } else if(pkind == 1) {
        // 多项选择题
        if(!question_content_json.every(IsStringorNumber)) {
            alerty.error("内容应该为一系列字符串或数字<br/>Content is not array of strings or numbers");
            return false;
        }
        if(question_answer_json.length > question_content_json.length) {
            alerty.error("答案长于题目选项数<br/>Answer is longer than question");
            return false;
        }
        for(let i = 0; i < question_answer_json.length; i ++) {
            question_answer_json[i] = question_answer_json[i].toUpperCase();
            let selection_ascii = question_answer_json[i].charCodeAt(0);
            if(question_answer_json[i].length != 1 || selection_ascii < 65 || selection_ascii >= 65 + question_content_json.length) {
                alerty.error("Answer should be a list of [\"A\", \"B\", \"C\" ...] and not exceed number of choice<br/>答案应为 [\"A\", \"B\", \"C\" ...] 数组，且字母不超过选项个数");
                return false;
            }
        }
        question_answer_json.sort();
    } else if(pkind == 5) {
        // 判断题
        if(question_answer_json.length != 1 || question_answer_json[0] != "T" && question_answer_json[0] != "F") {
            alerty.error("Answer should be [\"T\"] or [\"F\"]");
            return false;
        }
    } else if(pkind == 10) {
        // 填空题
        if(question_answer_json.length < 1) {
            alerty.error("At lease one to fill.");
            return false;
        }
        if(question_answer_json.length != question_content_json.length) {
            alerty.error("Answer should according to questions.");
            return false;
        }
    } else if(pkind == 15) {
        // 简答题
        if(question_answer_json.length < 1) {
            alerty.error("At lease one to answer.");
            return false;
        }
    } else if(pkind == 20) {
        // 综合题
        if(question_answer_json.length < 1) {
            alerty.error("At lease one to answer.");
            return false;
        }
        if(question_answer_json.length != question_content_json.length) {
            alerty.error("Answer should according to questions.");
            return false;
        }
        score_sum = 0;
        for(let i = 0; i < question_content_json.length; i ++) {
            if(!('content' in question_content_json[i]) || !('score_ratio' in question_content_json[i])) {
                alerty.error("\"content\" and \"score_ratio\" should be included in question define");
                return false;
            }
            question_content_json[i]['score_ratio'] = parseInt(question_content_json[i]['score_ratio']);
            if(i < question_content_json.length - 1) score_sum += question_content_json[i]['score_ratio'];
        }
        if(score_sum > 100 || score_sum < 0) {
            alerty.error("Score ratio shold be integer and not exceed 100.");
            return false;
        }
        // 最后一题分数比例自动计算
        question_content_json[question_content_json.length - 1]['score_ratio'] = 100 - score_sum;
    }
    return true;
}
function HalfScore(score_num) {
    return parseFloat((score_num * 0.5).toFixed(1));
}
function GetAutoScore(stu_asheet, question, pscore, pass_rate=0) {
    // 自动判分
    try{
        if(!('answerParsed' in question)) {
            question.answerParsed = JSON.parse(question.answer);
        }
        question.pkind = parseInt(question.pkind);
        if([0, 1, 5].indexOf(question.pkind) != -1) {
            // 选择、判断
            let ans_map = {}, sol_map = {};
            for(let i in stu_asheet.submission) {
                sol_map[stu_asheet.submission[i]] = true;
            }
            for(let i in question.answerParsed) {
                ans_map[question.answerParsed[i]] = true;
            }
            for(let i in sol_map) {
                if(!(i in ans_map)) {
                    return 0;   // 有错项 0 分
                }
            }
            let miss_cnt = 0;
            for(let i in ans_map) {
                if(!(i in sol_map)) {
                    miss_cnt ++;    // 有漏项
                }
            }
            if(miss_cnt == 0) return pscore;
            return miss_cnt < Object.keys(ans_map).length ? HalfScore(pscore) : 0; // 多选未答全给一半分
        } else if(question.pkind == 10) {
            // 填空
            let right_cnt = 0;
            for(let i = 0; i < question.answerParsed.length; i ++) {
                right_cnt += stu_asheet.submission[i] == question.answerParsed[i];
            }
            if(right_cnt == 0) return 0;
            if(right_cnt < question.answerParsed.length) return HalfScore(pscore);
            return pscore;
        } else if(question.pkind == 25) {
            // 编程
            let score = pass_rate * pscore;
            // 对齐到最近的 0.5 分：乘以2，四舍五入，再除以2
            score = Math.round(score * 2) / 2;
            // 确保分数格式正确（如果是整数，返回整数；否则返回1位小数）
            if(score % 1 === 0) {
                return score;
            } else {
                return parseFloat(score.toFixed(1));
            }
        } else {
            return 0;
        }
    } catch(e) {
        alerty.error("Something Error With Question: " + question.ex_question_id + " StuAsheet: " + stu_asheet.examinee_id);
        return null;
    }
}
function GetManualScore(stu_asheet, question, pscore, pass_rate=0) {
    // 获取人工打分的分数
    if(typeof(stu_asheet?.score) === 'number' && stu_asheet.score >= 0)  {
        return stu_asheet.score;
    }
    return null;
}
function GetScore(stu_asheet, question, pscore, pass_rate=0) {
    let score = GetManualScore(stu_asheet, question, pscore, pass_rate);
    if(score === null) {
        score = GetAutoScore(stu_asheet, question, pscore, pass_rate);
    }
    return score;    
}
function CanAutoScore(pkind) {
    return pkind <= 10 || pkind == 25;
}

// 注意：题目保存交互功能（保存按钮、提醒等）已移至 question_interaction.js