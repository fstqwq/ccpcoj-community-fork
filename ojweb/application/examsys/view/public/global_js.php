{include file="../../csgoj/view/public/global_js" /}

{if(config('OJ_ENV.OJ_CDN') == 'local') /}
    {js href='__STATIC__/ojtool/js/jquery.tablednd.min.js' /}
    {js href='__STATIC__/bootstrap-table/extensions/filter-control/bootstrap-table-filter-control.min.js' /}
    {js href='__STATIC__/bootstrap-table/extensions/reorder-rows/bootstrap-table-reorder-rows.min.js' /}
    {js href='__STATIC__/bootstrap-table/extensions/fixed-columns/bootstrap-table-fixed-columns.min.js' /}
    {js href='__STATIC__/bootstrap-table/extensions/multiple-sort/bootstrap-table-multiple-sort.min.js' /}
{else /}
    <script src="https://fastly.jsdelivr.net/npm/tablednd@1.0.5/dist/jquery.tablednd.min.js"></script>
    <script src="https://fastly.jsdelivr.net/npm/bootstrap-table@1.26.0/dist/extensions/filter-control/bootstrap-table-filter-control.min.js"></script>
    <script src="https://fastly.jsdelivr.net/npm/bootstrap-table@1.26.0/dist/extensions/reorder-rows/bootstrap-table-reorder-rows.min.js"></script>
    <script src="https://fastly.jsdelivr.net/npm/bootstrap-table@1.26.0/dist/extensions/fixed-columns/bootstrap-table-fixed-columns.min.js"></script>
    <script src="https://fastly.jsdelivr.net/npm/bootstrap-table@1.26.0/dist/extensions/multiple-sort/bootstrap-table-multiple-sort.min.js"></script>
{/if}

{include file="../../csgoj/view/public/pkg_code_highlight" /}

{js href="__STATIC__/csgoj/code_render.js" /}

{js href="__STATIC__/csgoj/oj_problem.js" /}

{/* ========================================
   examsys 模块化 JS 引入顺序:
   1. ex_global.js - 全局配置 (PAGE_MODULE 等)
   2. question_md_utils.js - Markdown 工具 (renderMdPreview, processVditorPlaceholders)
   3. question_default.js - 题目类型定义和默认值
   4. question_render.js - 题目渲染 (QuestionRender 对象)
   5. question_preview.js - 题目预览弹窗
   6. question_interaction.js - 题目交互 (保存提醒、离开提醒等)
   
   代码渲染：复用 csgoj/code_show.js 的全局 renderCode() 函数
   
   专用模块（在各自页面按需引入）:
   - exam_func.js - 考试通用功能 (localStorage, 时钟等)
   - question_submit.js - 题目提交逻辑
   - review_func.js - 阅卷功能
   - record_export.js - 试卷导出
   - contest/ex_question_list.js - 考试答题页 (滚动列表版)
   - contest/ex_problemset.js - 考试答题页 (table版)
   - contest/account_gen.js - 账号生成
======================================== */}

{js href="__STATIC__/examsys/ex_global.js" /}
{js href="__STATIC__/examsys/question_md_utils.js" /}
{js href="__STATIC__/examsys/question_default.js" /}
{js href="__STATIC__/examsys/question_render.js" /}
{js href="__STATIC__/examsys/question_preview.js" /}
{js href="__STATIC__/examsys/question_interaction.js" /}
