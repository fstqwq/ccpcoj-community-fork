<div class="page-title-container">
    <h1 class="page-title">全局评测状态<span class="en-text">Global Judge Status</span></h1>
    {include file="../../csgoj/view/status/status_toolbar" /}
</div>
<div id="status_toolbar" class="table-toolbar" style="display: none;">
    <!-- 全局评测状态的工具栏内容已移到 header，这里保留空容器以避免 Bootstrap Table 报错 -->
</div>
{include file="status/status_table" /}
{include file="status/status_config" /}

{include file="../../csgoj/view/public/pkg_code_highlight" /}

{if $module!='examsys'}
{include file="../../csgoj/view/status/code_show" /}
{include file="../../csgoj/view/status/runinfo_show" /}
{/if}

{js href="__STATIC__/csgoj/oj_status.js" /}
{js href="__STATIC__/csgoj/oj_status.css" /}

