<div id="review_question_panel">
    <!-- 工具栏 -->
    <div id="review_question_toolbar" class="sticky-top bg-white border-bottom p-2 shadow-sm" style="z-index: 100;">
        <div class="d-flex align-items-center flex-wrap gap-2">
            <div class="btn-group-vertical" role="group">
                <button class="btn btn-sm btn-outline-secondary button_pre" title="上一个考生 / Previous">
                    <i class="bi bi-chevron-up"></i>
                </button>
                <button class="btn btn-sm btn-outline-secondary button_nex" title="下一个考生 / Next">
                    <i class="bi bi-chevron-down"></i>
                </button>
            </div>
            <div class="btn-group-vertical" role="group">
                <input id="question_id_filter_input" name="question_id_filter" placeholder="1-3,5,6..." 
                    class="form-control form-control-sm" type="text" value="" style="max-width:150px;">
                <button id="question_filter_ok" type="button" class="btn btn-sm btn-primary">过滤</button>
            </div>
            <div class="btn-group-vertical" role="group">
                <button class="btn btn-sm btn-outline-primary button_color_legend" title="图例 / Legend">
                    <i class="bi bi-info-circle"></i> 图例
                </button>
                <a href="/examsys/admin/review_single_page?cid={$contest['contest_id']}" target="_blank" class="btn btn-sm btn-outline-success review-single-page-btn" title="打开独立页 / Open Single Page">
                    <i class="bi bi-box-arrow-up-right"></i> 独立页
                </a>
            </div>
            <div class="btn-group-vertical" role="group" aria-label="Score tools">
                <div class="btn-group" role="group" aria-label="Import/Export">
                    <button class="btn btn-sm btn-outline-primary button_review_score_download"
                        title="下载：导出当前考生整份试卷已保存（已生效）的评分与评语（用于备份或转移） / Download: export this examinee's saved (effective) scores & comments for all questions (backup/transfer)">
                        <i class="bi bi-download"></i> 
                    </button>
                    <button class="btn btn-sm btn-outline-secondary button_review_score_upload"
                        title="上传：从文件导入评分与评语并填入当前考生界面（不提交） / Upload: import scores & comments into this examinee's page (not submitted)">
                        <i class="bi bi-upload"></i> 
                    </button>
                </div>
                <button class="btn btn-sm btn-outline-danger button_review_score_submit_all w-100"
                    title="一次性保存当前考生整份试卷的评分与评语 / Save scores & comments for all questions in one go">
                    <i class="bi bi-send-check"></i> 保存全部
                </button>
            </div>
            <div>
                <div class="text-muted small bilingual-inline">考生<span class="en-text">Examinee</span></div>
                <div id="stu_info_span" class="fw-semibold text-info"></div>
            </div>
            <div>
                <div class="text-muted small bilingual-inline">总分<span class="en-text">Total</span></div>
                <div id="stu_score_span" class="fw-bold text-danger" style="font-size:20px;"></div>
            </div>
        </div>
    </div>

    <!-- 题目列表容器 -->
    <div id="question_list_container" class="question-list-container">
        <!-- 题目将动态渲染到这里 -->
    </div>
    
    <!-- 初始提示：未选择考生时显示 -->
    <div id="review_empty_hint" class="review-empty-hint">
        <div class="text-center text-muted">
            <i class="bi bi-info-circle" style="font-size: 48px; opacity: 0.5;"></i>
            <p class="mt-3 mb-0" style="font-size: 18px;">从左侧选择考生以加载答卷</p>
            <p class="mt-1 mb-0" style="font-size: 14px; opacity: 0.8;">Select an examinee from the left panel to load answer sheet</p>
        </div>
    </div>
</div>

{include file="../../csgoj/view/public/code_line_number" /}
{include file="../../csgoj/view/public/clipboard_js" /}
<script type="text/javascript" src="__STATIC__/csgoj/oj_status.js"></script>