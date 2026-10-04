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

{js href="__STATIC__/csgoj/oj_problem.js" /}
