{__NOLAYOUT__}
<!DOCTYPE html>
<html>
<head lang="en">
    <meta charset="utf-8" />
    <meta http-equiv="X-UA-Compatible" content="IE=edge,chrome=1" />
    <meta name="renderer" content="webkit" />
    <link rel="icon" href="__IMG__/global/favicon.ico" />
    <title>考试答题 / Exam - <?php echo htmlspecialchars($contest['title'] ?? 'Online Judge'); ?></title>
    {include file="../../examsys/view/public/global_css" /}
    {include file="../../examsys/view/public/global_js" /}
</head>
<body class="exam-single-page">
    <!-- 简洁的顶部标题栏 -->
    <div class="container-fluid bg-light border-bottom mb-3" style="padding: 10px 20px; position: sticky; top: 0; z-index: 1000;">
        <div class="d-flex justify-content-between align-items-center">
            <h4 class="mb-0"><?php echo htmlspecialchars($contest['title'] ?? '考试答题 / Exam'); ?></h4>
            <button class="btn btn-sm btn-outline-secondary" onclick="window.close()" title="关闭独立页 / Close">
                <i class="bi bi-x-lg"></i> 关闭
            </button>
        </div>
    </div>

    <!-- 考试内容区域 -->
    <input type="hidden" id='page_info' 
        cid="{$contest['contest_id']}" 
        contest_user="{$contest_user}" 
        allow_lang_key="<?php echo implode(',', array_keys($allowLanguage)); ?>" 
        allow_lang_val="<?php echo implode(',', array_values($allowLanguage)); ?>"
        examinee_defunct="{$examinee_defunct}"
        shuffle_choice="{$shuffle_choice|default=0}"
        is_admin="<?php echo ($isAdmin || $isReviewer) ? '1' : '0'; ?>"
    >

    {include file="../../examsys/view/contest/problemset" /}
</body>
</html>

