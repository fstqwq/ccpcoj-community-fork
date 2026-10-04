{__NOLAYOUT__}
<!DOCTYPE html>
<html>
<head lang="en">
    <meta charset="utf-8" />
    <meta http-equiv="X-UA-Compatible" content="IE=edge,chrome=1" />
    <meta name="renderer" content="webkit" />
    <link rel="icon" href="__IMG__/global/favicon.ico" />
    <title>阅卷 / Review - <?php echo htmlspecialchars($contest['title'] ?? 'Online Judge'); ?></title>
    {include file="../../examsys/view/public/global_css" /}
    {include file="../../examsys/view/public/global_js" /}
</head>
<body class="review-single-page">
    <!-- 简洁的顶部标题栏 -->
    <div class="container-fluid bg-light border-bottom mb-3" style="padding: 10px 20px;">
        <div class="d-flex justify-content-between align-items-center">
            <h4 class="mb-0"><?php echo htmlspecialchars($contest['title'] ?? '阅卷 / Review'); ?></h4>
            <button class="btn btn-sm btn-outline-secondary" onclick="window.close()" title="关闭独立页 / Close">
                <i class="bi bi-x-lg"></i> 关闭
            </button>
        </div>
    </div>

    <!-- 阅卷内容区域 -->
    <input type="hidden" id='page_info' 
        cid="{$contest['contest_id']}" 
        allow_lang_key="<?php echo implode(',', array_keys($allowLanguage)); ?>" 
        allow_lang_val="<?php echo implode(',', array_values($allowLanguage)); ?>"
        examinee_defunct="Y"
        attach_pro="<?php echo intval($contest['private'] / 10); ?>"
    >

    {css href="__STATIC__/examsys/review.css" /}
    {css href="__STATIC__/csgoj/code_show.css" /}
    {js href="__STATIC__/csgoj/code_render.js" /}
    <script type="text/javascript" src="__STATIC__/examsys/question_nav_common.js"></script>
    <script type="text/javascript" src="__STATIC__/examsys/review_func.js"></script>

    <script>
    const FINISH_TASK_NUM = 4;
    let score_star_for_obj = true;  // 客观题手动打分给score加星
    $(document).on('click', '.review_submit', function(){
        // 保留按钮原始HTML（竖排/图标/双语），避免 button_delay 覆盖结构
        button_delay_auto($(this), 2, 'start', '');
        let ex_question_id = this.getAttribute('qid');
        SubmitSingleReview(cid, question_map[ex_question_id]);
    });
    // 独立页不需要全屏处理
    $(document).keydown(function(e){
        if (e.ctrlKey && e.keyCode == 38) {
            PreviousExaminee();
        } else if (e.ctrlKey && e.keyCode == 40) {
            NextExaminee();
        }
    });

    function LoadFinishOtherWorks() {
        // nothing
    }
    $(document).ready(function(){
        InitPageInfo();
        InitAllowLang();
        SetFrontAlerty('review_area_div'); // 初始化alerti提示信息dom
        InitQuestionFilter();
        
        // **********
        // examinee table
        review_examinee_table.on('load-success.bs.table', function(){
            // 需要在 table load 完成后再加载其他数据
            LoadData();
        });
        review_examinee_table.on('click-row.bs.table', function(e, row, tr_elem, field) {
            // 点击examinee的行，选定该考生答卷
            try {
                let idx = examinee_map[row.team_id].idx;
                SelectExaminee(row);
            } catch(e) {
                console.error(e);
            }
        });
        
        // **********
        // 工具栏按钮
        $('.button_color_legend').click(function() {
            $('#content_show_modal_content').empty().append($('#color_legend_div').html());
            $('#content_show_modal_label_span').text('图例 / Legend');
            $('#content_show_modal').modal('show');
        });

        $('.button_pre').click(function(){
            PreviousExaminee();
        });
        $('.button_nex').click(function(){
            NextExaminee();
        });
        
        $('#question_filter_ok').click(function() {
            SetQuestionFilter(question_id_filter_input.val());
        });
        question_id_filter_input.keypress(function(e){
            var keycode = (e.keyCode ? e.keyCode : e.which);
            if(keycode == '13'){
                SetQuestionFilter(question_id_filter_input.val());
            }
        });
        
        // 滚动时更新导航高亮
        $('#review_asheet_panel_wrapper').on('scroll', function() {
            UpdateNavHighlight();
        });
        
        // 初始化题目导航的拖拽和展开/收起功能
        if (typeof initQuestionNavCommon === 'function') {
            initQuestionNavCommon({
                getStorageKey: (suffix) => {
                    // 阅卷页面：绑定到考试ID（所有考生共享同一个导航位置）
                    return `${PAGE_MODULE || 'examsys'}:review:${cid || ''}:question_nav:${suffix}`;
                },
                getDefaultPosition: () => {
                    // 独立页默认位置
                    return { right: 20, top: 80 };
                },
                updatePosition: () => {
                    // 阅卷页面可以在这里实现自动定位逻辑（如果需要）
                }
            });
        }
    });
    </script>
    

    <div id="review_area_div">
        <div id="loading_div" class='overlay' style="display:none;">
            <div id="loading_spinner" class="spinner-border" role="status">
                <span class="visually-hidden">Loading...</span>
            </div>
        </div>
        
        <!-- 左侧学生列表 -->
        <div id="review_examinee_panel_wrapper">
            {include file="../../examsys/view/admin/review_examinee_panel" /}
        </div>
        
        <!-- 右侧阅卷区域 -->
        <div id="review_asheet_panel_wrapper">
            {include file="../../examsys/view/admin/review_asheet_panel" /}
        </div>
        
        {include file="../../examsys/view/public/content_show_modal"}
    </div>

    <!-- 答案解析 Modal -->
    <div class="modal fade" id="answer_explain_modal" tabindex="-1" aria-hidden="true">
        <div class="modal-dialog modal-lg">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title">答案解析 / Answer Explanation</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                </div>
                <div class="modal-body">
                    <div id="answer_explain_modal_content" class="answer-explain-full-content">
                        <!-- 完整答案解析将在这里渲染 -->
                    </div>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">关闭 / Close</button>
                </div>
            </div>
        </div>
    </div>

    <!-- 右侧悬浮题目导航 -->
    <div id="question_nav_menu" class="question-nav-menu">
        <div class="question-nav-header">
            <strong class="bilingual-inline">题目导航<span class="en-text">Question Nav</span></strong>
            <button class="btn btn-sm btn-link p-0 text-white nav-menu-toggle-btn" id="nav_menu_toggle" title="收起/展开 (Collapse/Expand)">
                <i class="bi bi-arrows-angle-contract"></i>
            </button>
        </div>
        <div class="question-nav-content" id="question_nav_content">
            <!-- 导航项将动态生成 -->
        </div>
    </div>
        
    <div style="display:none;"  id="color_legend_div">
        <h3>名单区</h3>
        <ul class="list-group">
            <li class="list-group-item">分数星号"*"：人工批改了自动打分的纯客观题（单选、多选、判断）</li>
            <li class="list-group-item">无色：未批该</li>
            <li class="list-group-item list-group-item-secondary">灰色：主观题（简答、综合等）有批改</li>
            <li class="list-group-item list-group-item-success">绿色：主观题批改完毕</li>
            <li class="list-group-item list-group-item-warning">黄色：主观题批改完毕前提下，支持自动打分的半客观题（填空、编程）有批改</li>
            <li class="list-group-item list-group-item-info">蓝色：主观题、半客观题全部批改完毕</li>
            <li class="list-group-item" style="background: black;color:white;">黑色：选中的答卷</li>
        </ul>
        <br/>
        <h3>答卷区-分数</h3>
        <ul class="list-group">
            <li class="list-group-item list-group-item-warning">黄色：已自动判分</li>
            <li class="list-group-item list-group-item-success">绿色：已人工批改，会覆盖自动判分</li>
            <li class="list-group-item list-group-item-danger">红色：考生未答该题判 0 分，不支持人工判分</li>
            <li class="list-group-item list-group-item-secondary">灰色：主观题，尚未人工判分</li>
        </ul>
    </div>
</body>
</html>

