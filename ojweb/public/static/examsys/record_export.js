// 注意：PAGE_MODULE 常量在 ex_global.js 中定义
const AUTO_REVIEWER = '[自动]';
let flg_pscore_same;
let pro_num_cn = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十'];
let zipWriter;
let zipAddedPaths = new Set(); // 避免重复路径导致 zip "File already exists"
// 注意：所有 HTML 都是通过 MarkdownParseAsync 渲染后导出的，不需要 Vditor CSS
// 只需要 highlight.js CSS（用于代码高亮）和 KaTeX（用于数学公式渲染）
let vditor_filelist = [
    // KaTeX CSS（用于数学公式渲染）
    {old: '/static/katex/katex.min.css',                                                        new: 'resource/katex/katex.min.css'},
    // KaTeX JS（用于数学公式渲染）
    {old: '/static/katex/katex.min.js',                                                         new: 'resource/katex/katex.min.js'},
    {old: '/static/katex/contrib/auto-render.min.js',                                           new: 'resource/katex/contrib/auto-render.min.js'},
    // highlight.js CSS（用于代码高亮，Vditor 生成的 HTML 中包含代码块）
    {old: '/static/vditor/dist/js/highlight.js/styles/github.min.css',                        new: 'resource/vditor/dist/js/highlight.js/styles/github.min.css'},
];
// KaTeX 字体文件（需要导出所有字体以确保离线查看）
let katex_fonts = [
    'KaTeX_AMS-Regular.woff', 'KaTeX_AMS-Regular.woff2',
    'KaTeX_Caligraphic-Bold.woff', 'KaTeX_Caligraphic-Bold.woff2',
    'KaTeX_Caligraphic-Regular.woff', 'KaTeX_Caligraphic-Regular.woff2',
    'KaTeX_Fraktur-Bold.woff', 'KaTeX_Fraktur-Bold.woff2',
    'KaTeX_Fraktur-Regular.woff', 'KaTeX_Fraktur-Regular.woff2',
    'KaTeX_Main-Bold.woff', 'KaTeX_Main-Bold.woff2',
    'KaTeX_Main-BoldItalic.woff', 'KaTeX_Main-BoldItalic.woff2',
    'KaTeX_Main-Italic.woff', 'KaTeX_Main-Italic.woff2',
    'KaTeX_Main-Regular.woff', 'KaTeX_Main-Regular.woff2',
    'KaTeX_Math-BoldItalic.woff', 'KaTeX_Math-BoldItalic.woff2',
    'KaTeX_Math-Italic.woff', 'KaTeX_Math-Italic.woff2',
    'KaTeX_SansSerif-Bold.woff', 'KaTeX_SansSerif-Bold.woff2',
    'KaTeX_SansSerif-Italic.woff', 'KaTeX_SansSerif-Italic.woff2',
    'KaTeX_SansSerif-Regular.woff', 'KaTeX_SansSerif-Regular.woff2',
    'KaTeX_Script-Regular.woff', 'KaTeX_Script-Regular.woff2',
    'KaTeX_Size1-Regular.woff', 'KaTeX_Size1-Regular.woff2',
    'KaTeX_Size2-Regular.woff', 'KaTeX_Size2-Regular.woff2',
    'KaTeX_Size3-Regular.woff', 'KaTeX_Size3-Regular.woff2',
    'KaTeX_Size4-Regular.woff', 'KaTeX_Size4-Regular.woff2',
    'KaTeX_Typewriter-Regular.woff', 'KaTeX_Typewriter-Regular.woff2',
];
// 将 KaTeX 字体添加到 vditor_filelist
katex_fonts.forEach(font => {
    vditor_filelist.push({
        old: `/static/katex/fonts/${font}`,
        new: `resource/katex/fonts/${font}`
    });
});
function ExamPaperHeader(title, subtitle) {
    let ret_markdown = '';
    // title
    ret_markdown += `<div class="header_info">`;
    if(subtitle != null) {
        ret_markdown += `<div class="header_global_subtitle">[机考导出]${subtitle}</div>`;
    }
    let ymd = exam_info_config.course_ymd.split('-');
    ret_markdown += `
        <div class="header_global_title">${title}</div>
        <div class="header_line">
            <div class="hdiv_info header_open_or_close"><div class="hd_txt">开/闭卷</div><div class="hd_txt hd_underline">${exam_info_config.open_or_close == '0' ? '闭卷' : '开卷' }</div></div>
            <div class="hdiv_info header_a_or_b"><div class="hd_txt">A/B卷</div><div class="hd_txt hd_underline">${String.fromCharCode('A'.charCodeAt(0) + parseInt(exam_info_config.a_or_b))}</div></div>
        </div>
        <div class="header_line">
            <div class="hdiv_info header_course_id"><div class="hd_txt">课程编号</div><div class="hd_txt hd_underline">${exam_info_config.course_id}</div></div>
            <div class="hdiv_info header_course_name"><div class="hd_txt">课程名称</div><div class="hd_txt hd_underline">${exam_info_config.course_name}</div></div>
            <div class="hdiv_info header_credit"><div class="hd_txt">学分</div><div class="hd_txt hd_underline">${exam_info_config.credit}</div></div>
        </div>
        <br/>
        <div class="header_line">
            <div class="hdiv_info header_exam_question_creater"><div class="hd_txt">命题人</div><div class="hd_txt hd_underline">${exam_info_config.exam_question_creater}</div></div>
            <div class="hdiv_info header_exam_question_reviewer"><div class="hd_txt">审题人</div><div class="hd_txt hd_underline">${exam_info_config.exam_question_reviewer}</div></div>
            <div class="hdiv_info header_year"><div class="hd_txt hd_underline">${ymd[0]}</div><div class="hd_txt">年</div></div>
            <div class="hdiv_info header_month"><div class="hd_txt hd_underline">${ymd[1]}</div><div class="hd_txt">月</div></div>
            <div class="hdiv_info header_day"><div class="hd_txt hd_underline">${ymd[2]}</div><div class="hd_txt">日</div></div>
        </div>
        <div class="header_line"></div>
    </div>
    `;
    // ret_markdown += AM('<hr>');
    return ret_markdown
}
function GetReviewerStr(reviewer_id) {
    if(reviewer_id == null || reviewer_id.trim() == '') {
        return AUTO_REVIEWER;
    }
    if(reviewer_id.endsWith('#SYS')) {
        reviewer_id = reviewer_id.replace('#SYS', '');
    }
    return `${reviewer_id}${reviewer_id in reviewer_map ? '_' + reviewer_map[reviewer_id] : ''}`;
}
function GetExamPaperData() {
    // 预处理题目信息数据，按类型排列
    let pkind_question_map = {};
    for(let i in question_list) {
        if(!(question_list[i].pkind in pkind_question_map)) {
            pkind_question_map[question_list[i].pkind] = {
                'total_score': 0,
                'data': []
            };
        }
        pkind_question_map[question_list[i].pkind].total_score += question_list[i].pscore;
        pkind_question_map[question_list[i].pkind].data.push(question_list[i]);
    }
    return pkind_question_map;
}
function GetReviewerStr(reviewer_id) {
    if(reviewer_id == null || reviewer_id.trim() == '') {
        return AUTO_REVIEWER;
    }
    if(reviewer_id.endsWith('#SYS')) {
        reviewer_id = reviewer_id.replace('#SYS', '');
    }
    return `${reviewer_id}${reviewer_id in reviewer_map ? '_' + reviewer_map[reviewer_id] : ''}`;
}
function GetExamPaperData() {
    // 学生答卷 markdown
    let md = '';

    let sm_score = (question.pkind in flg_pscore_same) && flg_pscore_same[question.pkind] !== false ? `` : `（${question.pscore}分）`;
    let p_title = `${ith == null ? '' : (ith + '. ')}`;
    md += AM(`### ${p_title}${sm_score}`);

    if((stu_ans === null)) {
        md += AM(`\[空\]`)
    } else {
        if(question.pkind == 25) {
            // 编程题用pass_rate最大的、最后提交的代码 替换 全局最后一次。即用最高分一次而不是最后一次。
            ChangeAsheetCodeToBestPassRate(stu_ans, question.description);  // in review_func.js
        }
        let submission = stu_ans.submission;
        if(typeof(submission) == 'string') {
            submission = JSON.parse(submission);
        }
        switch(parseInt(question.pkind)) {
            case 0:
            case 1:
            case 5:
                try{
                    md += AM(`${submission.join(',')}`);
                } catch(e) {
                    console.error(question, submission);
                }
                break;
            case 10:
                // 考虑填空题归档markdown源内容。因为很多学生不会写markdown，一般也不会在填空里要求写公式
                for(let i = 0; i < submission.length; i ++) {
                    md += AM(`\n \`${typeof(submission[i]) === 'string' ? DomSantize(submission[i]) : submission[i]}\` `, `(${i + 1}) `);
                }
                break;
            case 20:
                // 新结构：{text:[...], images:[...] }
                if(submission && Array.isArray(submission.text)) {
                    for(let i = 0; i < submission.text.length; i ++) {
                        md += AM(`\n${ConvertHtmlSafeProcess(`${recovermath ? RecoverMath(submission.text[i]) : submission.text[i]}`, false)}`, `(${i + 1}) `);
                        const imgs = (submission.images && Array.isArray(submission.images[i])) ? submission.images[i] : [];
                        if(imgs.length > 0) {
                            md += AM(`\n**考生图片：**`, '', '\n');
                            for(let r = 0; r < imgs.length; r++) {
                                if(imgs[r] && String(imgs[r]).trim() !== '') {
                                    md += AM(`- ${r + 1}.\n\n<img src="${imgs[r]}" style="max-width: 600px;">\n`, '', '\n');
                                } else {
                                    md += AM(`- ${r + 1}. [未上传]\n`, '', '\n');
                                }
                            }
                            md += '\n';
                        }
                    }
                } else {
                    for(let i = 0; i < submission.length; i ++) {
                        md += AM(`\n${ConvertHtmlSafeProcess(`${recovermath ? RecoverMath(submission[i]) : submission[i]}`, false)}`, `(${i + 1}) `);
                    }
                }
                break;
            case 15:
                if(submission && Array.isArray(submission.text)) {
                    for(let i = 0; i < submission.text.length; i ++) {
                        md += AM(`\n${ConvertHtmlSafeProcess(`${recovermath ? RecoverMath(submission.text[i]) : submission.text[i]}`, false)}`);
                    }
                    const imgs = (submission.images && Array.isArray(submission.images[0])) ? submission.images[0] : [];
                    if(imgs.length > 0) {
                        md += AM(`\n**考生图片：**`, '', '\n');
                        for(let r = 0; r < imgs.length; r++) {
                            if(imgs[r] && String(imgs[r]).trim() !== '') {
                                md += AM(`- ${r + 1}.\n\n<img src="${imgs[r]}" style="max-width: 600px;">\n`, '', '\n');
                            } else {
                                md += AM(`- ${r + 1}. [未上传]\n`, '', '\n');
                            }
                        }
                        md += '\n';
                    }
                } else {
                    for(let i = 0; i < submission.length; i ++) {
                        md += AM(`\n${ConvertHtmlSafeProcess(`${recovermath ? RecoverMath(submission[i]) : submission[i]}`, false)}`);   // 简答题不区分小题
                    }
                }
                break;
            case 25:
                let lang = allow_lang != null && submission.lang in allow_lang ? allow_lang[submission.lang] : 'c++';
                // let stuans_show = ConvertHtmlSafeProcess(submission.code, false);
                // let stuans_show = DomSantize(submission.code, false);    // DomSantize 会转换“<”等符号，使代码显示不正常
                let stuans_show = submission.code.replace(/```/g, "\\`\\`\\`");
                md += AM("```" + lang);
                md += AM(stuans_show);
                md += AM("```");
                break;
        }
    }
    md += AM(`<span class='text-red'>得分：${'score' in score_single_question ? score_single_question.score : 0}</span>`);
    notes = GetNoteWithScore(stu_ans);
    if(question.pkind == 20) {
        if(('score' in notes) && notes.score?.length != null && typeof(notes.score?.length) != 'undefined' && notes.score?.length > 0) {
            let sub_score_list = [];
            for(let i = 0; i < notes.score.length; i ++) {
                sub_score_list.push(`(${i + 1}) ${notes.score[i]};  `);
            }
            md += AM(`<span class='text-red'>小题得分：${sub_score_list.join('')}</span>`);
        }
    }
    if(stu_ans == null) {
        md += AM(`<span class='text-red'>评阅：未答该题，默认 0 分</span>`);
    } else if('reviewer' in stu_ans && stu_ans.reviewer != null && stu_ans.reviewer.trim() != '') {
        md += AM(`<span class='text-red'>评阅：${GetReviewerStr(stu_ans.reviewer)}</span>`);
    } else {
        md += AM(`<span class='text-red'>评阅：${AUTO_REVIEWER}</span>`);
    }
    if(notes?.notes != null && typeof(notes?.notes) != 'undefined' && notes?.notes.trim() != '') {
        md += AM(`<span class='text-red'>评语：${notes?.notes}</span>`);
    }
    return md;
}
function GetExamPaperData() {
    // 预处理题目信息数据，按类型排列
    let pkind_question_map = {};
    for(let i in question_list) {
        if(!(question_list[i].pkind in pkind_question_map)) {
            pkind_question_map[question_list[i].pkind] = {
                'total_score': 0,
                'data': []
            };
        }
        pkind_question_map[question_list[i].pkind].total_score += question_list[i].pscore;
        pkind_question_map[question_list[i].pkind].data.push(question_list[i]);
    }
    return pkind_question_map;
}
function Fix1(num) {
    if(typeof(num) == 'string') {
        num = parseFloat(num);
    }
    if(num == parseInt(num)) {
        num = parseInt(num);
    } else {
        num = num.toFixed(1);
    }
    return num;
}
function MdScoreBody() {
    let output_score_table = review_examinee_table.clone();
    output_score_table.bootstrapTable('filterBy', {check: true});
    output_score_table.find('tbody tr:not(.selected)').remove();
    output_score_table.find("tr").find("td:eq(0)").remove();
    output_score_table.find("tr").find("th:eq(0)").remove();
    output_score_table.removeAttr(Object.values(output_score_table[0].attributes).map(attr => attr.name).join(' '));
    output_score_table.addClass('global_score_table');
    // with css for more convenient single file sharing
    return `<div>${output_score_table[0].outerHTML.replace(/<a href="[^"]*" (.*?)>(.*?)<\/a>/g, '<span $1>$2</span>')}</div>`;
}
function GetAllImgUrl(html_str, local_replace=false) {
    let reg = /<img.*?src="(.*?)".*?>/g;
    let arr = html_str.match(reg);
    if(arr == null) {
        arr = [];
    }
    let img_url_list = [];
    let newImgSrc;
    for (var i = 0; i < arr.length; i++) {
        let imgSrc = arr[i].match(/src="(.*?)"/)[1];
        if(imgSrc) {
            if(imgSrc.startsWith('/upload/')) {
                newImgSrc = imgSrc.replace(/^\/upload/, 'resource/upload');
            } else {
                newImgSrc = `resource/outerimg/${imgSrc.substring(imgSrc.lastIndexOf('/')+1)}_${Date.now()}`;
            }
            if(local_replace) {
                html_str = html_str.replace(imgSrc, newImgSrc);
            }
            img_url_list.push({
                'imgSrc': imgSrc,
                'newImgSrc': newImgSrc
            });
        }
    }
    return {
        'img_url_list': img_url_list,
        'html_str': html_str
    }
}
/**
 * 获取资源并添加到zip，失败时提示但继续
 * 使用 CsgZip.addUrlResource 封装方法
 */
function fetchAndAddToZip(url, zipPath, questionInfo) {
    return CsgZip.addUrlResource(zipWriter, url, zipPath, {
        context: questionInfo,
        onError: function(error, url, zipPath, context) {
            const line1 = context ? `考生/资源：${context}` : '资源';
            const line2 = `路径：${url}`;
            const errorMsg = context
                ? `${line1}\n${line2}`
                : `资源不存在\n${line2}`;
            const errorMsgEn = context
                ? `Examinee/Resource: ${context}\nPath: ${url}`
                : `Resource not found\nPath: ${url}`;
            alerty.alert({
                title: '资源加载失败',
                message: errorMsg,
                message_en: errorMsgEn,
                size: 'lg'
            });
        }
    });
}

function ZipTaskAdd(zip_task_list, html_str, md_str, origin_json, filename) {
    if(html_str != null) {
        let ret = GetAllImgUrl(html_str, true);
        // 去重：同一路径只写一次
        ret.img_url_list.forEach(item => {
            const path = item.newImgSrc;
            if (zipAddedPaths.has(path)) return;
            zipAddedPaths.add(path);
            zip_task_list.push(fetchAndAddToZip(item.imgSrc, path, filename));
        });
        const htmlPath = `${filename}.html`;
        if (!zipAddedPaths.has(htmlPath)) {
            zipAddedPaths.add(htmlPath);
            zip_task_list.push(zipWriter.add(htmlPath, new zip.TextReader(ret.html_str)));
        }
    }
    if(md_str != null){
        const mdPath = `resource/md_source/${filename}.md`;
        if (!zipAddedPaths.has(mdPath)) {
            zipAddedPaths.add(mdPath);
            zip_task_list.push(zipWriter.add(mdPath, new zip.TextReader(md_str)));
        }
    }
    if(origin_json != null) {
        const jsonPath = `resource/data/${filename}.json`;
        if (!zipAddedPaths.has(jsonPath)) {
            zipAddedPaths.add(jsonPath);
            zip_task_list.push(zipWriter.add(jsonPath, new zip.TextReader(JSON.stringify(origin_json))));
        }
    }
}
function ZipExport(zip_task_list) {
    loading_div.show();
    Promise.all(zip_task_list).then(value => {
        zipWriter.close().then(DownloadFile);
        loading_div.hide();
    }).catch((e) => {
        alerty.error("数据处理失败");
        console.error(e);
        loading_div.hide();
    });
}
function DownloadFile(blob) {
    let title = `${exam_info_config.course_id}_${exam_info_config.course_name.replace(/[\\/:*?"<>|]/g, '')}_${exam_info_config.open_or_close == '0' ? '闭卷' : '开卷'}_${String.fromCharCode('A'.charCodeAt(0) + parseInt(exam_info_config.a_or_b))}卷`;
    // 归档：直接触发浏览器下载，不再显示额外“下载”按钮
    const a = Object.assign(document.createElement("a"), {
        download: `考试归档_${title}_${DateFormat(new Date(), 'yyyy-MM-dd_HH-mm-ss')}.zip`,
        href: URL.createObjectURL(blob)
    });
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
        URL.revokeObjectURL(a.href);
        a.remove();
    }, 5000);
}
function HtmlPostProcess(html_str, page_title, export_type, options = {}) {
    const isPreview = !!options.preview;
    // 资源路径：预览用站点原始链接，导出用 resource 相对路径
    const abs = (p) => `${location.origin}${p}`;
    // 只需要 highlight.js CSS（用于代码高亮，MarkdownParseAsync 生成的 HTML 中包含代码块）
    const hljs_css         = isPreview ? abs('/static/vditor/dist/js/highlight.js/styles/github.min.css') : 'resource/vditor/dist/js/highlight.js/styles/github.min.css';
    const katex_css        = isPreview ? abs('/static/katex/katex.min.css') : 'resource/katex/katex.min.css';
    const show_css         = isPreview ? abs(`/static/${PAGE_MODULE}/exam_export_show.css`) : 'resource/show.css';
    // KaTeX JS（用于数学公式渲染）
    const katex_js         = isPreview ? abs('/static/katex/katex.min.js') : 'resource/katex/katex.min.js';
    const katex_auto_js    = isPreview ? abs('/static/katex/contrib/auto-render.min.js') : 'resource/katex/contrib/auto-render.min.js';
    // 参照考试页的渲染逻辑：需要 math.js 和 math.css 来处理后端返回的编程题 HTML 中的 Pandoc 格式（<span class="math">）
    const math_css         = isPreview ? abs('/static/csgoj/math.css') : 'resource/math.css';
    const math_js          = isPreview ? abs('/static/csgoj/math.js') : 'resource/math.js';

    let html_dom = $(html_str);
    if(export_type == 'paper_sealline') {
        // 标准带密封线样卷删掉"[机考导出]"等文字的subtitle
        html_dom.find('.header_global_subtitle').remove();
    }
    
    // 移除所有英文文本（导出时不需要中英双语）
    html_dom.find('.en-text').remove();
    
    // 样卷和学生答卷导出：移除交互元素，转换为纯展示 HTML
    if (export_type === 'paper' || export_type === 'paper_sealline' || export_type === 'paper_answer' || export_type === 'asheet') {
        // 移除 radio/checkbox 输入框
        html_dom.find('input[type="radio"], input[type="checkbox"]').remove();
        // 移除提交按钮等交互元素
        html_dom.find('.question_submit_container, .ans_review_div, .review_div, .answer_div').remove();
        // 移除样例复制按钮
        html_dom.find('.sample_copy').remove();
        // 移除编程题的题目标题区域（prog-header），保留内容
        html_dom.find('.prog-header').remove();
        html_dom.find('.question_header_slot').remove();
        // 处理选择题选项：提取选项文本，移除 label 和交互元素
        html_dom.find('.list-group-item').each(function() {
            const $item = $(this);
            const $label = $item.find('label');
            if ($label.length > 0) {
                const choiceText = $label.find('.choice-content').html() || $label.text();
                const choiceLabel = $label.find('.choice-label').text() || '';
                $item.html(`<li>${choiceLabel} ${choiceText}</li>`);
            }
        });
        // 移除 vditor-placeholder，直接显示内容
        html_dom.find('.vditor-placeholder').each(function() {
            const $ph = $(this);
            const md = $ph.attr('data-md') || $ph.text();
            $ph.replaceWith(md);
        });
        
        // 学生答卷特殊处理：移除或简化 Bootstrap 类，确保导出样式正确
        if (export_type === 'asheet') {
            // 移除 Bootstrap 图标类（导出时不需要）
            html_dom.find('.bi').remove();
            // 简化 Bootstrap 工具类，转换为简单的样式
            html_dom.find('.mt-3, .mb-2, .mb-3').each(function() {
                const $el = $(this);
                $el.removeClass('mt-3 mb-2 mb-3');
                if (!$el.attr('style')) {
                    $el.css('margin-top', '12pt');
                    $el.css('margin-bottom', '8pt');
                }
            });
            // 简化 flex 布局类
            html_dom.find('.d-flex, .align-items-center').each(function() {
                const $el = $(this);
                $el.removeClass('d-flex align-items-center');
                $el.css('display', 'block');
            });
            // 简化 badge 类，转换为简单的文本样式
            html_dom.find('.badge').each(function() {
                const $badge = $(this);
                const text = $badge.text();
                $badge.replaceWith(`<span style="font-size: 10pt; color: #0dcaf0;">${text}</span>`);
            });
            // 简化 ms-2, me-2 等间距类
            html_dom.find('[class*="ms-"], [class*="me-"]').each(function() {
                const $el = $(this);
                $el.removeClass(function(index, className) {
                    return (className.match(/\b(ms|me)-\d+\b/g) || []).join(' ');
                });
            });
        }
    }
    
    // 预览模式：将图片路径转换为绝对路径
    if(isPreview) {
        html_dom.find('img').each(function() {
            const img = $(this);
            let src = img.attr('src');
            if(src && src.startsWith('/') && !src.startsWith('http')) {
                img.attr('src', abs(src));
            }
        });
    }
    
    // 渲染数学公式（在生成最终 HTML 之前）
    // 复用考试和阅卷模式的逻辑：
    // 1. 先使用 MathDomProcess 处理 <div class="language-math">（Vditor 生成的格式）
    // 2. 再使用 MathRender 处理 Pandoc 格式和 $...$ / $$...$$ 格式
    html_dom.each(function() {
        const el = this;
        if (el && el.nodeType === 1 && typeof el.querySelectorAll === 'function') {
            // 直接在整个 html_dom 上处理，不限制选择器范围（参考 question_render.js 的做法：MathDomProcess(null, [html_dom], html_dom)）
            MathDomProcess(null, [el], el);
            // 处理 Pandoc 生成的格式和 $...$ / $$...$$ 格式（MathRender 内部会统一处理）
            MathRender('.marked_math_div, .md_display_div', el, false);
        }
    });
    
    // 保留所有根节点，避免只取第一个元素导致正文丢失
    const html_body_str = html_dom.toArray().map(el => el.outerHTML).join('');
    // body_style：只有 score 类型需要特殊样式，其他类型（paper、paper_sealline、paper_answer、answer、asheet）都使用 exam_export_show.css 中定义的标准样式
    let body_style = export_type == 'score' ? `
        body {
            width: auto;
            min-width: 100%;
            height: auto;
            margin: 0;
            padding: 5mm;
            overflow: visible;
        }
        .md_display_div {
            max-width: none;
            margin: 0;
            overflow: visible;
        }
        .global_score_table {
            width: auto;
            min-width: 100%;
            table-layout: auto;
            overflow: visible;
        }
    ` : '';
    // 其他类型（paper、paper_sealline、paper_answer、answer、asheet）使用 exam_export_show.css 中定义的标准 A4 样式
    // HTML 已经通过 MarkdownParseAsync 渲染完成，直接使用
    let main_content = `<div class="md_display_div">${html_body_str}</div>`;
    if(export_type == 'paper_sealline') {
        // 添加密封线
        main_content = `
        <div class="sealline_layout">
            <div class="sealline_left">
                <div class="sealline_left_content">
                    <div class="sealline_txt">
                        <div class="sealline_txt_line">
                            <div class="sealline_content_space"></div>
                            <div class="sealline_content_txt">学院</div><div class="sealline_content_underline"></div>
                            <div class="sealline_content_txt">专业</div><div class="sealline_content_underline"></div>
                            <div class="sealline_content_txt">姓名</div><div class="sealline_content_underline"></div>
                            <div class="sealline_content_txt">学号</div><div class="sealline_content_underline"></div>
                            <div class="sealline_content_txt">座号</div><div class="sealline_content_underline"></div>
                            <div class="sealline_content_space"></div>
                        </div>
                        <div class="sealline_notify_line">( 密 封 线 内 不 答 题；学院或任课教师可根据需要选择是否密封。 )</div>
                    </div>
                    <div class="sealline_line">                    
                        <div class="sealline_dots"></div>
                        <div class="sealline_text">密</div>
                        <div class="sealline_dots"></div>
                        <div class="sealline_text">封</div>
                        <div class="sealline_dots"></div>
                        <div class="sealline_text">线</div>
                        <div class="sealline_dots"></div>
                    </div>
            
                </div>
            </div>
            <div class="sealline_right">
                ${main_content}
            </div>
        </div>
        `
    }
    return `
    <!DOCTYPE html>
    <html>
    <head lang="en">
        <meta charset="utf-8" />
        <meta http-equiv="X-UA-Compatible" content="IE=edge,chrome=1" />
        <meta name="renderer" content="webkit" />
        <title>${page_title}-${contest_title}</title>
        <!-- highlight.js CSS（用于代码高亮，Vditor 生成的 HTML 中包含代码块） -->
        <link rel="stylesheet" type="text/css" href="${hljs_css}" />
        <!-- KaTeX CSS（用于数学公式渲染） -->
        <link rel="stylesheet" type="text/css" href="${katex_css}" />
        <!-- 数学公式处理工具 CSS（参照考试页，处理 Pandoc 格式） -->
        <link rel="stylesheet" type="text/css" href="${math_css}" />
        <!-- 导出页面样式 -->
        <link rel="stylesheet" type="text/css" href="${show_css}" />
        <!-- KaTeX JS（用于数学公式渲染） -->
        <script defer src="${katex_js}"></script>
        <script defer src="${katex_auto_js}"></script>
        <!-- 数学公式处理工具 JS（参照考试页，处理 Pandoc 格式） -->
        <!-- math.js 会自动初始化并处理所有数学公式 -->
        <script defer src="${math_js}"></script>
    </head>
    <body>
    ${main_content}
    </body>
    <style>
    ${body_style}
    </style>
    </html>
    `;
}
async function ExamExport(zip_task_list, export_type, pkind_question_map, examinee_single, asheet_single) {
    const buildRet = await BuildExamHtml(export_type, pkind_question_map, examinee_single, asheet_single, {preview: false});
    if(!buildRet) return;
    const {html_exam, metaJson, filename} = buildRet;
    
    // 保存大 JSON 到 resource/meta_json 目录
    const metaJsonPath = `resource/meta_json/${filename}.json`;
    if (!zipAddedPaths.has(metaJsonPath)) {
        zipAddedPaths.add(metaJsonPath);
        zip_task_list.push(zipWriter.add(metaJsonPath, new zip.TextReader(JSON.stringify(metaJson, null, 2))));
    }
    
    // 不再保存 markdown 源码，只保存 HTML 和 JSON
    ZipTaskAdd(zip_task_list, html_exam, null, null, filename);
}

/**
 * 构造大 JSON（包含所有题目的元数据，保持服务端返回的格式）
 * @param {string} export_type - 导出类型
 * @param {Object} pkind_question_map - 按题型分组的题目数据
 * @param {Object} examinee_single - 单个考生信息（仅 asheet 类型需要）
 * @param {Object} asheet_single - 单个考生答卷（仅 asheet 类型需要）
 * @returns {Object} 大 JSON 对象
 */
function BuildExamMetaJson(export_type, pkind_question_map, examinee_single = null, asheet_single = null) {
    const metaJson = {
        export_type: export_type,
        exam_info: exam_info_config,
        questions: [],
        pkind_question_map: pkind_question_map,  // 保存 pkind_question_map 用于生成题号表格和大题标题
        // 对于 asheet 类型，还需要包含考生信息和答卷
        examinee: null,
        asheet: null,
        score: null
    };
    
    // 收集所有题目（按顺序）
    const allQuestions = [];
    for (let pkind in pkind_question_map) {
        for (let i = 0; i < pkind_question_map[pkind].data.length; i++) {
            allQuestions.push(pkind_question_map[pkind].data[i]);
        }
    }
    
    // 按 ex_question_id 排序（保持原有顺序）
    allQuestions.sort((a, b) => {
        const aIdx = question_list.findIndex(q => q.ex_question_id === a.ex_question_id);
        const bIdx = question_list.findIndex(q => q.ex_question_id === b.ex_question_id);
        return aIdx - bIdx;
    });
    
    // 为每个题目添加序号
    allQuestions.forEach((question, idx) => {
        metaJson.questions.push({
            ...question,
            question_index: idx + 1  // 题目序号（从1开始）
        });
    });
    
    // 对于 asheet 类型，添加考生信息和答卷
    if (export_type === 'asheet' && examinee_single) {
        metaJson.examinee = examinee_single;
        metaJson.asheet = asheet_single || {};
        if (score_map && examinee_single.team_id in score_map) {
            metaJson.score = score_map[examinee_single.team_id];
        }
    }
    
    return metaJson;
}

/**
 * 生成题号表格 HTML
 * @param {Object} pkind_question_map - 按题型分组的题目数据
 * @returns {string} HTML 字符串
 */
/**
 * 生成题号表格 HTML
 * @param {Object} pkind_question_map - 按题型分组的题目数据
 * @param {string} export_type - 导出类型（'asheet' 时需要填入数据）
 * @param {Object} score_single - 单个考生的分数数据（仅 asheet 类型需要）
 * @param {Object} asheet_single - 单个考生的答卷数据（仅 asheet 类型需要）
 * @returns {string} HTML 字符串
 */
function GenerateScoreTable(pkind_question_map, export_type = null, score_single = null, asheet_single = null) {
    let score_table = '<table class="score_table"><thead><tr><th class="score-col-qid">题号</th>';
    let i = 1;
    let score_pkind = {};  // 用于存储每个题型的分数和评卷人信息
    
    // 生成表头
    for(let pkind in question_default.pkind_table_cn) {
        if(pkind in pkind_question_map) {
            score_table += `<th class="score-col-pkind">${pro_num_cn[i]}</th>`;
            // 如果是学生答卷，初始化统计信息
            if(export_type === 'asheet') {
                score_pkind[pkind] = {
                    'total': 0,
                    'reviewer': {},  // 保留用于兼容
                    'reviewer_set': new Set()  // 使用 Set 来记录所有不同的评阅人
                };
            }
            i++;
        }
    }
    score_table += '<th class="score-col-basic-total">基本题总分</th><th class="score-col-extra">附加题</th></tr></thead><tbody><tr><td class="score-col-qid">得分</td>';
    
    // 如果是学生答卷，计算每个题型的得分和评卷人
    if(export_type === 'asheet' && score_single && asheet_single) {
        // 遍历每个题型，统计得分和评卷人
        for(let pkind in question_default.pkind_table_cn) {
            if(pkind in pkind_question_map) {
                const questions = pkind_question_map[pkind].data;
                let pkind_total = 0;
                
                for(let j = 0; j < questions.length; j++) {
                    const question = questions[j];
                    const single_question_score = score_single[question.ex_question_id];
                    
                    if(single_question_score != null && 'score' in single_question_score) {
                        pkind_total += parseFloat(single_question_score.score) || 0;
                    }
                    
                    // 统计评卷人（包括"自动"）
                    const asheet_item = asheet_single[question.ex_question_id];
                    let reviewer_str = AUTO_REVIEWER;  // 默认为"自动"
                    if(asheet_item && asheet_item.reviewer) {
                        reviewer_str = GetReviewerStr(asheet_item.reviewer);
                    }
                    // 使用 Set 来去重，记录所有不同的评阅人
                    if(!score_pkind[pkind].reviewer_set) {
                        score_pkind[pkind].reviewer_set = new Set();
                    }
                    score_pkind[pkind].reviewer_set.add(reviewer_str);
                }
                
                score_pkind[pkind].total = pkind_total;
                score_table += `<td class="score-col-pkind text-red">${Fix1(pkind_total)}</td>`;
            }
        }
        
        // 基本题总分（使用 score_single.total，参考旧代码）
        const total_score = score_single.total || 0;
        const attach_score = score_single.attach || 0;
        
        score_table += `<td class="score-col-basic-total text-red">${Fix1(total_score)}</td>`;
        score_table += `<td class="score-col-extra text-red">${attach_score > 0 ? Fix1(attach_score) : '/'}</td>`;
    } else {
        // 非学生答卷，生成空表格
        for(let pkind in question_default.pkind_table_cn) {
            if(pkind in pkind_question_map) {
                score_table += '<td class="score-col-pkind"></td>';
            }
        }
        score_table += '<td class="score-col-basic-total"></td><td class="score-col-extra text-red"></td>';
    }
    
    // 评卷人行
    score_table += '</tr><tr><td class="score-col-qid">评卷人</td>';
    
    if(export_type === 'asheet' && score_single && asheet_single) {
        // 填入评卷人信息
        for(let pkind in question_default.pkind_table_cn) {
            if(pkind in pkind_question_map) {
                // 获取所有不同的评阅人（包括"自动"），用"、"连接
                const reviewer_set = score_pkind[pkind].reviewer_set || new Set();
                const reviewer_list = Array.from(reviewer_set).sort();  // 排序以便显示一致
                if(reviewer_list.length > 0) {
                    score_table += `<td class="score-col-pkind text-red">${reviewer_list.join('、')}</td>`;
                } else {
                    score_table += `<td class="score-col-pkind text-red">${AUTO_REVIEWER}</td>`;
                }
            }
        }
        score_table += `<td class="score-col-basic-total text-red">${AUTO_REVIEWER}</td>`;
        const attach_score = score_single.attach || 0;
        if(attach_score > 0) {
            // 附加题的评卷人：通常附加题是最后一个题型的最后一题
            let attach_reviewer = AUTO_REVIEWER;
            // 从后往前遍历，找到最后一个有题目的题型
            let last_pkind_with_questions = null;
            for(let pkind in question_default.pkind_table_cn) {
                if(pkind in pkind_question_map && pkind_question_map[pkind].data.length > 0) {
                    last_pkind_with_questions = pkind;
                }
            }
            if(last_pkind_with_questions) {
                const questions = pkind_question_map[last_pkind_with_questions].data;
                if(questions.length > 0) {
                    const last_question = questions[questions.length - 1];
                    const last_asheet = asheet_single[last_question.ex_question_id];
                    if(last_asheet && last_asheet.reviewer) {
                        attach_reviewer = GetReviewerStr(last_asheet.reviewer);
                    }
                }
            }
            score_table += `<td class="score-col-extra text-red">${attach_reviewer}</td>`;
        } else {
            score_table += '<td class="score-col-extra text-red">/</td>';
        }
    } else {
        // 非学生答卷，生成空表格
        for(let pkind in question_default.pkind_table_cn) {
            if(pkind in pkind_question_map) {
                score_table += '<td class="score-col-pkind"></td>';
            }
        }
        score_table += '<td class="score-col-basic-total"></td><td class="score-col-extra text-red"></td>';
    }
    
    score_table += '</tr></tbody></table>';
    return score_table;
}

/**
 * 导出专用的答案处理函数（移除英文文本，简化格式）
 * @param {Object} question - 题目对象
 * @param {boolean} showExplain - 是否显示答案解析（默认false，仅参考答案及评分标准不显示）
 * @returns {Promise<string>} HTML 字符串
 */
async function ProcessAnswerHtmlForExport(question, showExplain = false) {
    let ret_html = '';
    const pkind = parseInt(question.pkind);
    
    // 1. 先显示参考答案（参考旧版格式）
    if('answer' in question) {
        let answer = question.answer;
        if(typeof(answer) == 'string') {
            try { answer = JSON.parse(answer); } catch(e) { answer = [answer]; }
        }
        if(!Array.isArray(answer)) {
            answer = [answer];
        }
        
        if(pkind < 10) {
            // 单选/多选/判断 - 直接显示，用逗号分隔（参考旧格式：只显示答案，如 "B" 或 "B, D"）
            ret_html += `<p>${answer.join(', ')}</p>\n`;
        } else if(pkind == 10) {
            // 填空题 - 参考旧格式，直接显示答案
            for(let i = 0; i < answer.length; i ++) {
                const answerText = await MarkdownParseAsync(answer[i], false);
                // 确保 answerText 是字符串类型
                const cleanText = String(answerText || '').replace(/^\s*<p[^>]*>|<\/p>\s*$/g, '').trim();
                ret_html += `<p>(${i + 1}) ${cleanText}</p>\n`;
            }
        } else if(pkind == 15 || pkind == 20) {
            // 简答题/综合题 - 支持答案图
            if(pkind == 20) {
                // 综合题：显示小题序号
                for(let i = 0; i < answer.length; i ++) {
                    const item = answer[i];
                    let answerText = '';
                    let answerImages = [];
                    if (typeof item === 'object' && item !== null) {
                        answerText = item.answer || '';
                        answerImages = Array.isArray(item.answer_images) ? item.answer_images : [];
                    } else {
                        answerText = String(item || '');
                        answerImages = [];
                    }
                    const answerHtml = await MarkdownParseAsync(answerText, false);
                    // 确保 answerHtml 是字符串类型，移除 <p> 标签，保持简洁
                    const cleanHtml = String(answerHtml || '').replace(/^\s*<p[^>]*>|<\/p>\s*$/g, '').trim();
                    ret_html += `<p>(${i + 1}) ${cleanHtml}</p>\n`;
                    
                    // 显示答案图（从 answer 字段读取）
                    if (answerImages.length > 0 && question.attach) {
                        ret_html += `<div class="mt-3"><div class="fw-semibold mb-2">答案图</div>`;
                        answerImages.forEach((imgUrl, idx) => {
                            if (imgUrl && String(imgUrl).trim()) {
                                // 如果已经是完整路径（以 /upload/ 开头），直接使用；否则拼接路径
                                const imgSrc = String(imgUrl).startsWith('/upload/') 
                                    ? imgUrl 
                                    : (question.attach ? `/upload/question_attach/${question.attach}/answer_image/${imgUrl}` : '');
                                if (imgSrc) {
                                    ret_html += `<div class="mb-2"><img class="img-thumbnail" style="max-width: 400px;" src="${imgSrc}" alt="答案图 ${idx + 1}"></div>`;
                                }
                            }
                        });
                        ret_html += `</div>\n`;
                    }
                }
            } else {
                // 简答题
                const item = answer[0] || {};
                let answerText = '';
                let answerImages = [];
                if (typeof item === 'object' && item !== null) {
                    answerText = item.answer || '';
                    answerImages = Array.isArray(item.answer_images) ? item.answer_images : [];
                } else {
                    answerText = String(item || '');
                    answerImages = [];
                }
                const answerHtml = await MarkdownParseAsync(answerText, false);
                // 确保 answerHtml 是字符串类型，移除 <p> 标签，保持简洁
                const cleanHtml = String(answerHtml || '').replace(/^\s*<p[^>]*>|<\/p>\s*$/g, '').trim();
                ret_html += `<p>${cleanHtml}</p>\n`;
                
                // 显示答案图（从 answer 字段读取）
                if (answerImages.length > 0 && question.attach) {
                    ret_html += `<div class="mt-3"><div class="fw-semibold mb-2">答案图</div>`;
                    answerImages.forEach((imgUrl, idx) => {
                        if (imgUrl && String(imgUrl).trim()) {
                            // 如果已经是完整路径（以 /upload/ 开头），直接使用；否则拼接路径
                            const imgSrc = String(imgUrl).startsWith('/upload/') 
                                ? imgUrl 
                                : (question.attach ? `/upload/question_attach/${question.attach}/answer_image/${imgUrl}` : '');
                            if (imgSrc) {
                                ret_html += `<div class="mb-2"><img class="img-thumbnail" style="max-width: 400px;" src="${imgSrc}" alt="答案图 ${idx + 1}"></div>`;
                            }
                        }
                    });
                    ret_html += `</div>\n`;
                }
            }
        } else if(pkind == 25) {
            // 编程题 - 使用代码块（参考旧格式）
            const codeContent = answer[0] || '';
            if(codeContent.trim() !== '') {
                ret_html += `<pre><code class="language-cpp">${DomSantize(codeContent)}</code></pre>\n`;
            }
        }
    }
    
    // 2. 再显示评分标准（参考旧版格式）
    // 评分标准可能来自 prule 或 answer_explain.score_advice
    let scoreAdviceStr = '';
    
    // 优先使用 prule
    if(question?.prule && question.prule.trim() != '') {
        scoreAdviceStr = question.prule.trim();
    } else if('answer_explain' in question) {
        // 如果没有 prule，尝试从 answer_explain 中获取 score_advice
        let explain = question.answer_explain;
        if (typeof explain === 'string') {
            try { explain = JSON.parse(explain); } catch (e) {}
        }
        
        if (typeof explain === 'object' && explain !== null && !Array.isArray(explain)) {
            scoreAdviceStr = String(explain.score_advice || '').trim();
        }
    }
    
    if(scoreAdviceStr) {
        const scoreAdviceHtml = await MarkdownParseAsync(scoreAdviceStr, false);
        const cleanScoreAdvice = String(scoreAdviceHtml || '').replace(/^\s*<p[^>]*>|<\/p>\s*$/g, '').trim();
        ret_html += `<h4 class="text-red">评分标准：</h4>\n<div class="text-red"><p>${cleanScoreAdvice}</p></div>\n`;
        ret_html += `<p><strong class="text-red">----------</strong></p>\n`;
    }
    
    // 3. 最后显示答案解析（如果有）
    if('answer_explain' in question) {
        let explain = question.answer_explain;
        if (typeof explain === 'string') {
            try { explain = JSON.parse(explain); } catch (e) {}
        }
        
        let explainStr = '';
        if (typeof explain === 'object' && explain !== null && !Array.isArray(explain)) {
            explainStr = String(explain.explain || '').trim();
        } else if (typeof explain === 'string') {
            explainStr = explain.trim();
        } else if (Array.isArray(explain)) {
            explainStr = explain.join('\n').trim();
        }
        
        if(explainStr) {
            const explainHtml = await MarkdownParseAsync(explainStr, false);
            // 确保 explainHtml 是字符串类型，移除 <p> 标签，保持简洁
            const cleanHtml = String(explainHtml || '').replace(/^\s*<p[^>]*>|<\/p>\s*$/g, '').trim();
            ret_html += `<h4 class="text-red">答案解析：</h4>\n<p>${cleanHtml}</p>\n`;
        }
    }
    
    return ret_html;
}

/**
 * 生成纯展示用的题目 HTML（不含交互元素）
 * @param {Object} question - 题目对象
 * @param {number} questionIndex - 题目序号
 * @param {Object} problemset - 编程题数据集合
 * @returns {Promise<string>} HTML 字符串
 */
async function RenderQuestionForExport(question, questionIndex, problemset = {}) {
    let html = '';
    const pkind = parseInt(question.pkind);
    
    // 题目标题和描述合并到一行
    let sm_score = (question.pkind in flg_pscore_same) && flg_pscore_same[question.pkind] !== false ? `` : `（${question.pscore}分）`;
    
    if (pkind == 25) {
        // 编程题：显示题目标题（从 problem.title 获取）
        const problem = problemset[question.description];
        if (problem) {
            // 编程题标题：序号 + 分数 + 题目标题
            const problemTitle = problem.title || `题目 ${problem.problem_id}`;
            html += `<h3>${questionIndex}. ${sm_score}${problemTitle}</h3>`;
            html += `<blockquote><p>时限: ${problem.time_limit}s    内存限制: ${problem.memory_limit}MB    特殊评测: ${problem.spj == '0' ? "否" : "是"}</p></blockquote>`;
            // 题目描述（后端已编译为 HTML，直接使用，不包含题目标题）
            html += `<div class="md_display_div">${problem.description}</div>`;
            html += `<h4>输入</h4>`;
            html += `<div class="md_display_div">${problem.input}</div>`;
            html += `<h4>输出</h4>`;
            html += `<div class="md_display_div">${problem.output}</div>`;
            html += `<h4>样例</h4>`;
            // 样卷导出：使用简单的表格格式，不含交互元素
            // 解析样例数据（兼容新格式和旧格式）
            let sample_in_list = [];
            let sample_out_list = [];
            try {
                const parsedIn = JSON.parse(problem.sample_input);
                if (parsedIn && typeof parsedIn === 'object' && parsedIn.data_type === 'json' && Array.isArray(parsedIn.data)) {
                    sample_in_list = parsedIn.data;
                } else {
                    sample_in_list = problem.sample_input.includes('##CASE##') ? problem.sample_input.split(/\n##CASE##\n/m) : [problem.sample_input];
                }
            } catch(e) {
                sample_in_list = problem.sample_input.includes('##CASE##') ? problem.sample_input.split(/\n##CASE##\n/m) : [problem.sample_input];
            }
            try {
                const parsedOut = JSON.parse(problem.sample_output);
                if (parsedOut && typeof parsedOut === 'object' && parsedOut.data_type === 'json' && Array.isArray(parsedOut.data)) {
                    sample_out_list = parsedOut.data;
                } else {
                    sample_out_list = problem.sample_output.includes('##CASE##') ? problem.sample_output.split(/\n##CASE##\n/m) : [problem.sample_output];
                }
            } catch(e) {
                sample_out_list = problem.sample_output.includes('##CASE##') ? problem.sample_output.split(/\n##CASE##\n/m) : [problem.sample_output];
            }
            const sample_num_max = Math.max(sample_in_list.length, sample_out_list.length);
            if (sample_num_max > 0) {
                html += `<table class="sample_table"><thead><tr><th class="sample-col-index">序</th><th>输入样例</th><th>输出样例</th></tr></thead><tbody>`;
                for(let i = 0; i < sample_num_max; i++) {
                    const sampleIn = i < sample_in_list.length ? String(sample_in_list[i] || '').trim() : '';
                    const sampleOut = i < sample_out_list.length ? String(sample_out_list[i] || '').trim() : '';
                    html += `<tr><td class="sample-col-index"><pre>#${i}</pre></td><td class="sample_td"><pre>${DomSantize(sampleIn)}</pre></td><td class="sample_td"><pre>${DomSantize(sampleOut)}</pre></td></tr>`;
                }
                html += `</tbody></table>`;
            }
            if(problem?.hint && problem.hint.trim() != '') {
                html += `<h4>提示</h4>`;
                html += `<div class="md_display_div">${problem.hint}</div>`;
            }
        } else {
            // 编程题数据未加载，显示错误信息
            html += `<h3>${questionIndex}. ${sm_score}[编程题加载失败]</h3>`;
        }
    } else {
        // 非编程题：显示题目描述
        let descriptionHtml = await MarkdownParseAsync(question.description, false);
        // 确保 descriptionHtml 是字符串类型，移除描述中的 <p> 标签，保留内容，确保与序号在同一行
        // 使用更全面的正则，移除所有 <p> 和 </p> 标签（包括前后空格和空标签）
        descriptionHtml = String(descriptionHtml || '').replace(/^\s*<p[^>]*>|<\/p>\s*$/g, '').replace(/<p[^>]*><\/p>/g, '').trim();
        html += `<h3>${questionIndex}. ${sm_score}${descriptionHtml}</h3>`;
        
        if (pkind == 0 || pkind == 1 || pkind == 5) {
            // 选择题、多选题、判断题：生成纯展示的选项列表
            let content = typeof(question.content) == 'string' ? JSON.parse(question.content) : question.content;
            html += '<ul>';
            let baseA = 'A'.charCodeAt(0);
            for(let i = 0; i < content.length; i++) {
                let optionHtml = await MarkdownParseAsync(content[i], false);
                // 确保 optionHtml 是字符串类型
                optionHtml = String(optionHtml || '');
                // 移除选项中的 <p> 标签，保留内容，确保与序号在同一行
                // 使用更全面的正则，移除所有 <p> 和 </p> 标签（包括前后空格和空标签）
                optionHtml = optionHtml.replace(/^\s*<p[^>]*>|<\/p>\s*$/g, '').replace(/<p[^>]*><\/p>/g, '').trim();
                html += `<li>${String.fromCharCode(baseA + i)}. ${optionHtml}</li>`;
            }
            html += '</ul>';
        } else if (pkind == 10) {
            // 填空题
            let content = typeof(question.content) == 'string' ? JSON.parse(question.content) : question.content;
            if(content.length > 1) {
                for(let i = 0; i < content.length; i++) {
                    if(content[i].trim() != '') {
                        const contentHtml = await MarkdownParseAsync(content[i], false);
                        html += `<p>(${i + 1}) ${contentHtml}</p>`;
                    } else {
                        html += `<p>(${i + 1}) 填写第${i + 1}空答案：</p>`;
                    }
                }
            }
        } else if (pkind == 15) {
            // 简答题：题干已在 description 中，content 用于图片上传要求
            let content = typeof(question.content) == 'string' ? JSON.parse(question.content) : question.content;
            if(!Array.isArray(content)) content = [];
            let reqs = [];
            if(content[0] && typeof content[0] === 'object' && Array.isArray(content[0].image_reqs)) {
                reqs = content[0].image_reqs;
            }
            if(reqs.length > 0) {
                html += `<h4>图片上传要求</h4>`;
                html += '<ul>';
                for(let r = 0; r < reqs.length; r++) {
                    html += `<li>${r + 1}. ${DomSantize(reqs[r]?.title || '')}</li>`;
                }
                html += '</ul>';
            }
        } else if (pkind == 20) {
            // 综合题
            let content = GetRealSubScore(question);
            for(let i = 0; i < content.length; i++) {
                const contentHtml = await MarkdownParseAsync(content[i].content, false);
                html += `<p>(${i + 1})（${content[i].sub_pscore}分）${contentHtml}</p>`;
                const reqs = Array.isArray(content[i]?.image_reqs) ? content[i].image_reqs : [];
                if(reqs.length > 0) {
                    html += `<p><strong>图片上传要求：</strong></p><ul>`;
                    for(let r = 0; r < reqs.length; r++) {
                        html += `<li>${r + 1}. ${DomSantize(reqs[r]?.title || '')}</li>`;
                    }
                    html += '</ul>';
                }
            }
        }
    }
    
    return html;
}

/**
 * 生成学生答卷的 HTML（复用样卷格式，在此基础上添加学生答卷和评分信息）
 * @param {Object} question - 题目对象
 * @param {number} questionIndex - 题目序号
 * @param {Object} problemset - 编程题数据集合
 * @param {Object} asheetSingle - 学生答卷数据
 * @param {Object} scoreSingle - 该题目的评分信息（从 score_map 获取）
 * @returns {Promise<string>} HTML 字符串
 */
async function RenderQuestionWithAsheetForExport(question, questionIndex, problemset, asheetSingle, scoreSingle) {
    // 学生答卷：只显示题号，不显示题目内容
    // 参考旧版输出格式：只有题号、答案、得分、评阅信息
    let html = '';
    
    // 1. 只生成题号（不包含题目内容）
    const pkind = parseInt(question.pkind);
    let sm_score = (question.pkind in flg_pscore_same) && flg_pscore_same[question.pkind] !== false ? `` : `（${question.pscore}分）`;
    html += `<h3>${questionIndex}.${sm_score}</h3>\n`;
    
    // 2. 添加学生答卷内容（直接显示，不加标题，保持简洁格式）
    if (!asheetSingle || !asheetSingle.ex_question_id) {
        html += `<p>[未作答]</p>\n`;
    } else {
        // 处理编程题：使用 pass_rate 最大的代码
        if (question.pkind == 25 && typeof ChangeAsheetCodeToBestPassRate === 'function') {
            ChangeAsheetCodeToBestPassRate(asheetSingle, question.description);
        }
        
        let submission = asheetSingle.submission;
        if (typeof(submission) == 'string') {
            try {
                submission = JSON.parse(submission);
            } catch(e) {
                submission = null;
            }
        }
        
        const pkind = parseInt(question.pkind);
        switch(pkind) {
            case 0:
            case 1:
            case 5:
                // 单选/多选/判断
                if (submission && Array.isArray(submission)) {
                    html += `<p>${submission.join(', ')}</p>\n`;
                } else {
                    html += `<p>[未作答]</p>\n`;
                }
                break;
            case 10:
                // 填空题
                if (submission && Array.isArray(submission)) {
                    for(let i = 0; i < submission.length; i++) {
                        const answerText = typeof(submission[i]) === 'string' ? DomSantize(submission[i]) : String(submission[i] || '');
                        html += `<p>(${i + 1}) <code>${answerText}</code></p>\n`;
                    }
                } else {
                    html += `<p>[未作答]</p>\n`;
                }
                break;
            case 15:
                // 简答题
                if (submission && typeof submission === 'object' && Array.isArray(submission.text)) {
                    for(let i = 0; i < submission.text.length; i++) {
                        const answerHtml = await MarkdownParseAsync(submission.text[i] || '', false);
                        const cleanHtml = String(answerHtml || '').replace(/^\s*<p[^>]*>|<\/p>\s*$/g, '').trim();
                        html += `<div class="md_display_div">${cleanHtml}</div>\n`;
                    }
                    // 处理图片
                    const imgs = (submission.images && Array.isArray(submission.images[0])) ? submission.images[0] : [];
                    if(imgs.length > 0) {
                        html += `<p><strong>考生图片：</strong></p><ul>\n`;
                        for(let r = 0; r < imgs.length; r++) {
                            if(imgs[r] && String(imgs[r]).trim() !== '') {
                                html += `<li>${r + 1}. <img src="${imgs[r]}" style="max-width: 600px;"></li>\n`;
                            } else {
                                html += `<li>${r + 1}. [未上传]</li>\n`;
                            }
                        }
                        html += `</ul>\n`;
                    }
                } else if (submission && Array.isArray(submission)) {
                    // 兼容旧格式
                    for(let i = 0; i < submission.length; i++) {
                        const answerHtml = await MarkdownParseAsync(submission[i] || '', false);
                        const cleanHtml = String(answerHtml || '').replace(/^\s*<p[^>]*>|<\/p>\s*$/g, '').trim();
                        html += `<div class="md_display_div">${cleanHtml}</div>\n`;
                    }
                } else {
                    html += `<p>[未作答]</p>\n`;
                }
                break;
            case 20:
                // 综合题
                if (submission && typeof submission === 'object' && Array.isArray(submission.text)) {
                    for(let i = 0; i < submission.text.length; i++) {
                        const answerHtml = await MarkdownParseAsync(submission.text[i] || '', false);
                        const cleanHtml = String(answerHtml || '').replace(/^\s*<p[^>]*>|<\/p>\s*$/g, '').trim();
                        html += `<p>(${i + 1}) ${cleanHtml}</p>\n`;
                        // 处理图片
                        const imgs = (submission.images && Array.isArray(submission.images[i])) ? submission.images[i] : [];
                        if(imgs.length > 0) {
                            html += `<p><strong>考生图片：</strong></p><ul>\n`;
                            for(let r = 0; r < imgs.length; r++) {
                                if(imgs[r] && String(imgs[r]).trim() !== '') {
                                    html += `<li>${r + 1}. <img src="${imgs[r]}" style="max-width: 600px;"></li>\n`;
                                } else {
                                    html += `<li>${r + 1}. [未上传]</li>\n`;
                                }
                            }
                            html += `</ul>\n`;
                        }
                    }
                } else if (submission && Array.isArray(submission)) {
                    // 兼容旧格式
                    for(let i = 0; i < submission.length; i++) {
                        const answerHtml = await MarkdownParseAsync(submission[i] || '', false);
                        const cleanHtml = String(answerHtml || '').replace(/^\s*<p[^>]*>|<\/p>\s*$/g, '').trim();
                        html += `<p>(${i + 1}) ${cleanHtml}</p>\n`;
                    }
                } else {
                    html += `<p>[未作答]</p>\n`;
                }
                break;
            case 25:
                // 编程题
                if (submission && submission.code) {
                    const lang = (allow_lang != null && submission.lang in allow_lang) ? allow_lang[submission.lang] : 'cpp';
                    const codeContent = submission.code.replace(/```/g, "\\`\\`\\`");
                    html += `<pre><code class="language-${lang}">${DomSantize(codeContent)}</code></pre>\n`;
                } else {
                    html += `<p>[未作答]</p>\n`;
                }
                break;
            default:
                html += `<p>[未作答]</p>\n`;
                break;
        }
    }
    
    // 3. 添加评分信息（直接显示，不加标题，保持简洁格式）
    if (scoreSingle) {
        const score = scoreSingle.score !== null && scoreSingle.score !== undefined ? scoreSingle.score : 0;
        html += `<p><span class="text-red">得分：${Fix1(score)}</span></p>\n`;
        
        // 综合题的小题得分
        if (question.pkind == 20 && asheetSingle) {
            const notes = GetNoteWithScore(asheetSingle);
            if(notes && notes.score && Array.isArray(notes.score) && notes.score.length > 0) {
                let sub_score_list = [];
                for(let i = 0; i < notes.score.length; i++) {
                    sub_score_list.push(`(${i + 1}) ${Fix1(notes.score[i])}`);
                }
                html += `<p><span class="text-red">小题得分：${sub_score_list.join('; ')}</span></p>\n`;
            }
        }
    } else {
        html += `<p><span class="text-red">得分：0</span></p>\n`;
    }
    
    // 评阅人信息
    if (!asheetSingle || !asheetSingle.ex_question_id) {
        html += `<p><span class="text-red">评阅：未答该题，默认 0 分</span></p>\n`;
    } else if (asheetSingle.reviewer && asheetSingle.reviewer.trim() !== '') {
        html += `<p><span class="text-red">评阅：${GetReviewerStr(asheetSingle.reviewer)}</span></p>\n`;
    } else {
        html += `<p><span class="text-red">评阅：${AUTO_REVIEWER}</span></p>\n`;
    }
    
    // 评语
    if (asheetSingle) {
        const notes = GetNoteWithScore(asheetSingle);
        if(notes && notes.notes && typeof notes.notes === 'string' && notes.notes.trim() !== '') {
            html += `<p><span class="text-red">评语：${DomSantize(notes.notes)}</span></p>\n`;
        }
    }
    
    return html;
}

/**
 * 基于大 JSON 逐题渲染 HTML（复用现有的渲染函数）
 * @param {Object} metaJson - 大 JSON 对象
 * @param {string} export_type - 导出类型
 * @param {boolean} isPreview - 是否为预览模式
 * @returns {Promise<string>} HTML 字符串
 */
async function RenderHtmlFromMetaJson(metaJson, export_type, isPreview = false) {
    let subtitle, filename;
    
    switch(export_type) {
        case 'paper':           filename = subtitle = '样卷';                break;
        case 'paper_sealline':  filename = subtitle = '样卷_带密封线';       break;
        case 'answer':          filename = subtitle = '参考答案及评分标准';  break;
        case 'paper_answer':    filename = subtitle = '样卷（带答案）';      break;
        case 'score':           filename = subtitle = '细分评分表';          break;
        case 'asheet':
            if (metaJson.examinee) {
                filename = `${metaJson.examinee.team_id}_${metaJson.examinee.name}`;
                subtitle = `学号：${metaJson.examinee.team_id} | 姓名：${metaJson.examinee.name}</span>`;
            } else {
                filename = subtitle = '学生答卷';
            }
            break;
    }
    
    // 生成头部 HTML
    const md_header = ExamPaperHeader(`${exam_info_config.global_title}`, subtitle);
    const headerHtml = await MarkdownParseAsync(md_header, false);
    
    // 生成题目 HTML
    let questionsHtml = '';
    
    if (export_type === 'score') {
        // 细分评分表特殊处理
        const scoreMd = MdScoreBody();
        questionsHtml = await MarkdownParseAsync(scoreMd, false);
    } else {
        const pkind_question_map = metaJson.pkind_question_map;
        
        // 生成题号表格（样卷、参考答案、学生答卷都需要）
        if (['paper', 'paper_sealline', 'paper_answer', 'answer', 'asheet'].includes(export_type))  {
            // 对于学生答卷，需要传入分数和答卷数据以填充表格
            const score_single = (export_type === 'asheet' && metaJson.score) ? metaJson.score : null;
            const asheet_single = (export_type === 'asheet' && metaJson.asheet) ? metaJson.asheet : null;
            questionsHtml += GenerateScoreTable(pkind_question_map, export_type, score_single, asheet_single) + '\n\n';
        }
        
        // 构建 problemset 对象（用于编程题）
        // 优先使用已加载的 oj_problemset 数据（由 review_func.js 的 LoadData 函数加载）
        const problemset = {};
        
        // 获取所有编程题
        const programmingQuestions = metaJson.questions.filter(q => q.pkind == 25);
        
        // 检查是否已有 oj_problemset 数据（从 review_func.js 加载）
        // oj_problemset 是全局变量，在 review_func.js 中通过 /examsys/contest/oj_problemset_ajax 加载
        const hasOjProblemset = typeof oj_problemset !== 'undefined' && oj_problemset !== null && Object.keys(oj_problemset).length > 0;
        
        if (hasOjProblemset && programmingQuestions.length > 0) {
            // 使用已加载的数据（避免重复请求）
            for (const question of programmingQuestions) {
                const problemId = question.description;
                // oj_problemset 的键是 problem_id（数字类型），question.description 可能是字符串或数字
                // 尝试多种键格式匹配
                let found = false;
                
                // 1. 直接匹配（如果类型一致）
                if (problemId in oj_problemset) {
                    problemset[problemId] = oj_problemset[problemId];
                    found = true;
                } else {
                    // 2. 尝试字符串格式
                    const problemIdStr = String(problemId);
                    if (problemIdStr in oj_problemset) {
                        problemset[problemId] = oj_problemset[problemIdStr];
                        found = true;
                    } else {
                        // 3. 尝试数字格式
                        const problemIdNum = parseInt(problemId);
                        if (!isNaN(problemIdNum) && problemIdNum in oj_problemset) {
                            problemset[problemId] = oj_problemset[problemIdNum];
                            found = true;
                        }
                    }
                }
                
                // 如果仍然找不到，记录警告（但不阻塞导出）
                if (!found) {
                    console.warn(`Problem ${problemId} not found in oj_problemset, will be missing in export`);
                }
            }
        } else if (programmingQuestions.length > 0) {
            // 如果没有已加载的数据，才进行请求（向后兼容，但会重复加载）
            console.warn('oj_problemset not found, falling back to individual requests (this may cause duplicate loading)');
            const programmingPromises = programmingQuestions.map(question => {
                return new Promise((resolve) => {
                    $.get('/exadmin/exam/problem_ajax', { problem_id: question.description }, function(pro_ret) {
                        if(pro_ret.code == 1) {
                            problemset[question.description] = pro_ret.data;
                        }
                        resolve();
                    }, 'json').fail(function() {
                        resolve();
                    });
                });
            });
            await Promise.all(programmingPromises);
        }
        
        // 按题型分组渲染题目
        let i = 1;  // 大题序号
        let questionNumInType = 0;  // 当前题型内的题目序号
        
        for(let pkind in question_default.pkind_table_cn) {
            if(pkind in pkind_question_map) {
                const typeQuestions = pkind_question_map[pkind].data;
                questionNumInType = 0;
                
                // 生成大题标题
                let score_description = '';
                if((pkind in flg_pscore_same) && flg_pscore_same[pkind] !== false) {
                    score_description = `（每小题${flg_pscore_same[pkind]}分，共${flg_pscore_same[pkind] * typeQuestions.length}分）`;
                } else {
                    score_description = `（共${pkind_question_map[pkind].total_score}分）`;
                }
                questionsHtml += `<h2>${pro_num_cn[i]}. ${question_default.pkind_table_cn[pkind]}${score_description}</h2>\n\n`;
                
                // 渲染该题型下的所有题目
                for(let j = 0; j < typeQuestions.length; j++) {
                    const question = typeQuestions[j];
                    questionNumInType++;
                    
                    // 使用题型内序号（每个题型从1开始重新编号）
                    const questionIndex = questionNumInType;
                    
                    let questionHtml = '';
                    
                    // 根据导出类型生成不同的内容
                    if (export_type === 'paper' || export_type === 'paper_sealline') {
                        // 样卷：使用纯展示渲染函数
                        questionHtml = await RenderQuestionForExport(question, questionIndex, problemset);
                    } else if (export_type === 'answer') {
                        // 参考答案及评分标准：显示答案、评分标准、答案解析
                        questionHtml = `<h3>${questionIndex}. </h3>`;
                        questionHtml += await ProcessAnswerHtmlForExport(question, true); // showExplain=true 显示答案解析
                    } else if (export_type === 'paper_answer') {
                        // 样卷（带答案）：题目 + 答案
                        questionHtml = await RenderQuestionForExport(question, questionIndex, problemset);
                        questionHtml += `<h4 class="text-red">参考答案：</h4>\n\n<div class="text-red">\n\n`;
                        questionHtml += await ProcessAnswerHtmlForExport(question, true);
                        questionHtml += `\n\n</div>\n\n`;
                    } else if (export_type === 'asheet') {
                        // 学生答卷：复用样卷格式，在此基础上添加学生答卷和评分信息
                        const asheetSingle = metaJson.asheet?.[question.ex_question_id] || null;
                        const scoreSingle = metaJson.score?.[question.ex_question_id] || null;
                        
                        questionHtml = await RenderQuestionWithAsheetForExport(
                            question,
                            questionIndex,
                            problemset,
                            asheetSingle,
                            scoreSingle
                        );
                    }
                    
                    questionsHtml += questionHtml + '\n\n';
                }
                
                i++;
            }
        }
    }
    
    // 拼接完整 HTML
    const fullHtml = headerHtml + questionsHtml;
    
    // 后处理（添加样式、脚本等）
    const processedHtml = HtmlPostProcess(fullHtml, filename, export_type, {preview: isPreview});
    
    return processedHtml;
}



async function BuildExamHtml(export_type, pkind_question_map, examinee_single, asheet_single, options = {}) {
    const isPreview = !!options.preview;
    
    // 1. 先构造大 JSON
    const metaJson = BuildExamMetaJson(export_type, pkind_question_map, examinee_single, asheet_single);
    
    // 2. 基于大 JSON 生成 HTML（预览模式和导出模式都使用相同的逻辑）
    const html_exam = await RenderHtmlFromMetaJson(metaJson, export_type, isPreview);
    
    // 3. 确定文件名
    let filename;
    switch(export_type) {
        case 'paper':           filename = '样卷';                break;
        case 'paper_sealline':  filename = '样卷_带密封线';       break;
        case 'answer':          filename = '参考答案及评分标准';  break;
        case 'paper_answer':    filename = '样卷（带答案）';      break;
        case 'score':           filename = '细分评分表';          break;
        case 'asheet':
            if (examinee_single) {
                filename = `${examinee_single.team_id}_${examinee_single.name}`;
            } else {
                filename = '学生答卷';
            }
            break;
    }
    
    return {html_exam, metaJson, filename};
}
function JudgePscoreSame(pkind_question_map) {
    // 检查通常量较大的客观题是否所有题分数一样，如果一样则题目分数将显示在大题标题那一行.
    flg_pscore_same = {
        "0": true,
        "1": true,
        "5": true,
        "10": true
    };
    for(let pkind in pkind_question_map) {
        if(!(pkind in flg_pscore_same)) {
            continue;
        }
        let last_score = -1;
        for(let i = 0; i < pkind_question_map[pkind].data.length; i ++) {
            if(last_score == -1) {
                last_score = pkind_question_map[pkind].data[i].pscore;
                flg_pscore_same[pkind] = last_score;
            } else if(Math.abs(last_score - pkind_question_map[pkind].data[i].pscore) > 1e-6) {
                flg_pscore_same[pkind] = false;
                break;
            }
        }
    }
}
async function TotalExport(examinee_id_list) {
    // 确保题目和数据已加载
    if(!Array.isArray(question_list) || question_list.length === 0) {
        console.error("Export blocked: question_list empty", {question_list});
        alerty.error("题目数据尚未加载完成，请稍后重试");
        return;
    }
    if(!examinee_map || Object.keys(examinee_map).length === 0) {
        console.error("Export blocked: examinee_map empty", {examinee_map});
        alerty.error("考生列表尚未加载完成，请稍后重试");
        return;
    }
    
    // 检查编程题数据是否已加载（如果有编程题）
    const hasProgrammingQuestions = question_list.some(q => q.pkind == 25);
    if (hasProgrammingQuestions) {
        if (typeof oj_problemset === 'undefined' || oj_problemset === null || Object.keys(oj_problemset).length === 0) {
            console.warn("oj_problemset not loaded, programming questions may be missing details");
            // 不阻塞导出，但会记录警告（RenderHtmlFromMetaJson 会回退到单独请求）
        }
    }

    zipWriter = new zip.ZipWriter(new zip.BlobWriter("application/zip"));
    zipAddedPaths = new Set();
    let pkind_question_map = GetExamPaperData();
    if(Object.keys(pkind_question_map).length === 0) {
        console.error("Export blocked: pkind_question_map empty", {pkind_question_map, question_list});
        alerty.error("未找到可导出的题目，请检查题库数据");
        return;
    }
    JudgePscoreSame(pkind_question_map);
    let zip_task_list = [];
    
    // 使用 CsgZip.addUrlResources 批量添加全局资源文件
    const globalResources = vditor_filelist.map(item => ({
        url: item.old,
        zipPath: item.new,
        context: '全局资源'
    }));
    globalResources.push(
        {url: `/static/${PAGE_MODULE}/exam_export_show.css`, zipPath: 'resource/show.css', context: '全局资源'},
        {url: '/static/csgoj/math.css', zipPath: 'resource/math.css', context: '全局资源'},
        {url: '/static/csgoj/math.js', zipPath: 'resource/math.js', context: '全局资源'}
    );
    
    const globalResourceTasks = CsgZip.addUrlResources(zipWriter, globalResources, {
        onError: function(error, url, zipPath, context) {
            const errorMsg = `${context}\n路径：${url}`;
            const errorMsgEn = `${context}\nPath: ${url}`;
            alerty.alert({
                title: '资源加载失败',
                message: errorMsg,
                message_en: errorMsgEn,
                size: 'lg'
            });
        }
    });
    zip_task_list = zip_task_list.concat(globalResourceTasks);
    
    // 添加考试信息参数 JSON 文件
    try {
        let examInfoConfig = null;
        // 尝试从全局函数获取配置（如果存在）
        if (typeof GetExamInfoConfig === 'function') {
            examInfoConfig = GetExamInfoConfig();
        } else if (typeof exam_info_config !== 'undefined' && exam_info_config !== null) {
            // 如果全局函数不存在，使用全局变量
            examInfoConfig = exam_info_config;
        }
        
        if (examInfoConfig && typeof examInfoConfig === 'object') {
            const examInfoJson = JSON.stringify(examInfoConfig, null, 2); // 格式化 JSON，便于阅读
            const examInfoPath = '考试信息参数.json';
            if (!zipAddedPaths.has(examInfoPath)) {
                zipAddedPaths.add(examInfoPath);
                zip_task_list.push(zipWriter.add(examInfoPath, new zip.TextReader(examInfoJson)));
            }
        }
    } catch (e) {
        console.warn('Failed to add exam info config JSON:', e);
    }
    
    // 异步导出所有文件
    await ExamExport(zip_task_list, 'paper', pkind_question_map);
    await ExamExport(zip_task_list, 'paper_sealline', pkind_question_map);    // 带密封线
    await ExamExport(zip_task_list, 'answer', pkind_question_map);
    await ExamExport(zip_task_list, 'paper_answer', pkind_question_map);
    await ExamExport(zip_task_list, 'score', pkind_question_map);
    for(let i in examinee_id_list) {
        let examinee_id = examinee_id_list[i];
        // if(examinee_id in examinee_map && examinee_id in asheet_map) {   // 白卷不导出
        //     await ExamExport(zip_task_list, 'asheet', pkind_question_map, examinee_map[examinee_id], asheet_map[examinee_id]);
        // }
        if(examinee_id in examinee_map) {      // 所有人都导出
            await ExamExport(zip_task_list, 'asheet', pkind_question_map, examinee_map[examinee_id], asheet_map?.[examinee_id]);
        }
    }
    ZipExport(zip_task_list);
}

// 预览带密封线样卷（直接在新标签页打开 Blob，不写入 zip）
async function PreviewPaperSealline() {
    if(!Array.isArray(question_list) || question_list.length === 0) {
        alerty.error("题目数据尚未加载完成，请稍后重试");
        return;
    }
    let pkind_question_map = GetExamPaperData();
    if(Object.keys(pkind_question_map).length === 0) {
        alerty.error("未找到可导出的题目，请检查题库数据");
        return;
    }
    JudgePscoreSame(pkind_question_map);
    try {
        const ret = await BuildExamHtml('paper_sealline', pkind_question_map, null, null, {preview: true});
        if(!ret) {
            alerty.error("生成样卷失败");
            return;
        }
        const blob = new Blob([ret.html_exam], {type: 'text/html'});
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
        setTimeout(() => URL.revokeObjectURL(url), 30000);
    } catch(e) {
        console.error(e);
        alerty.error("生成样卷预览失败");
    }
}

// 归档页：
// - 表格“向右扩展不限制宽度”：通过在模板中添加 bootstrap_table_div/bootstrap_table_table 类，
//   复用 global.js 的 post-body.bs.table 宽度扩展逻辑（让容器跟随 scrollWidth 变宽）。
// - 本项目不使用 bootstrap-table 的 Advanced Search；在本页移除该按钮，避免误点触发 modal 异常。
$(function () {
    $('#review_examinee_table').on('post-body.bs.table post-header.bs.table', function () {
        $(this).closest('.bootstrap-table').find('button[name="advancedSearch"]').remove();
    });
});