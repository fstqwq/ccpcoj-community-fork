{include file="../../csgoj/view/public/global_css" /}

{if(config('OJ_ENV.OJ_CDN') == 'local') /}
    {css href='__STATIC__/bootstrap-table/extensions/filter-control/bootstrap-table-filter-control.min.css' /}
    {css href='__STATIC__/bootstrap-table/extensions/reorder-rows/bootstrap-table-reorder-rows.min.css' /}
    {css href='__STATIC__/bootstrap-table/extensions/fixed-columns/bootstrap-table-fixed-columns.min.css' /}
{else /}
    <link rel="stylesheet" href="https://fastly.jsdelivr.net/npm/bootstrap-table@1.26.0/dist/extensions/filter-control/bootstrap-table-filter-control.min.css">
    <link rel="stylesheet" href="https://fastly.jsdelivr.net/npm/bootstrap-table@1.26.0/dist/extensions/reorder-rows/bootstrap-table-reorder-rows.min.css">
    <link rel="stylesheet" href="https://fastly.jsdelivr.net/npm/bootstrap-table@1.26.0/dist/extensions/fixed-columns/bootstrap-table-fixed-columns.min.css">
{/if}

{css href="__STATIC__/csgoj/oj_problem.css" /}
{css href="__STATIC__/csgoj/code_show.css" /}
{css href="__STATIC__/examsys/examsys.css" /}
