{include file="../../csgoj/view/public/global_head" /}
<div class="container">
    <div class="page-header">
        <div class="bg-white border border-primary border-opacity-25 rounded-3 px-3 py-2 mb-3 shadow-sm">
            <div class="d-flex align-items-center justify-content-between">
                <div class="d-flex align-items-center gap-2">
                    <h1 class="page-title bilingual-inline mb-0">
                        题目导出/导入文件管理<span class="en-text">Problem Export/Import File Manager</span>
                    </h1>
                </div>
            </div>
        </div>
    </div>
    <script type="text/javascript">
        var re_checkfile = /^[0-9a-zA-Z-_\.\(\)]+\.(zip)$/;
        // 可选的课程组信息（exp 模式使用，由调用方通过 assign 传递）
        // 注意：这些变量需要挂载到 window 对象上，以便 problem_export.js 可以访问
        window.NOW_COURSE_ID = {$NOW_COURSE_ID|default='null'};
        window.NOW_COURSE_KEY = '{$NOW_COURSE_KEY|default=""|htmlspecialchars}';
        window.PROBLEM_BACKTASK_URL = '/{$module}/backtask?item=backtask';
    </script>
    {include file="../../admin/view/filemanager/js_upload" /}
</div>
{js href="__STATIC__/csgoj/admin/problem_export.js" /}
