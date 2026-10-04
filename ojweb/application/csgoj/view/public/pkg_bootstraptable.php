{if(config('OJ_ENV.OJ_CDN') == 'local') }
    {css href="__STATIC__/bootstrap-table/bootstrap-table.min.css" /}
    {css href='__STATIC__/bootstrap-table/extensions/filter-control/bootstrap-table-filter-control.min.css' /}
    {css href='__STATIC__/bootstrap-table/extensions/reorder-rows/bootstrap-table-reorder-rows.min.css' /}
    {css href='__STATIC__/bootstrap-table/extensions/fixed-columns/bootstrap-table-fixed-columns.min.css' /}
    
    {js href='__STATIC__/tableExport.jquery.plugin/tableExport.min.js' /}
    {js href='__STATIC__/tableExport.jquery.plugin/libs/html2canvas//html2canvas.min.js' /}

    {js href="__STATIC__/bootstrap-table/bootstrap-table.min.js" /}
    {js href='__STATIC__/bootstrap-table/extensions/toolbar/bootstrap-table-toolbar.min.js' /}
    {js href='__STATIC__/bootstrap-table/extensions/export/bootstrap-table-export.min.js' /}
    {js href="__STATIC__/bootstrap-table/extensions/cookie/bootstrap-table-cookie.min.js" /}
{else /}
    {css href="//fastly.jsdelivr.net/npm/bootstrap-table@1.26.0/dist/bootstrap-table.min.css" /}
    {css href="//fastly.jsdelivr.net/npm/bootstrap-table@1.26.0/dist/extensions/filter-control/bootstrap-table-filter-control.min.css" /}
    {css href="//fastly.jsdelivr.net/npm/bootstrap-table@1.26.0/dist/extensions/reorder-rows/bootstrap-table-reorder-rows.min.css" /}
    {css href="//fastly.jsdelivr.net/npm/bootstrap-table@1.26.0/dist/extensions/fixed-columns/bootstrap-table-fixed-columns.min.css" /}
    
    {js href="//fastly.jsdelivr.net/npm/tableexport.jquery.plugin@1.33.0/tableExport.min.js" /}
    {js href="//fastly.jsdelivr.net/npm/tableexport.jquery.plugin@1.33.0/libs/html2canvas/html2canvas.min.js" /}
    
    {js href="//fastly.jsdelivr.net/npm/bootstrap-table@1.26.0/dist/bootstrap-table.min.js" /}
    {js href="//fastly.jsdelivr.net/npm/bootstrap-table@1.26.0/dist/extensions/toolbar/bootstrap-table-toolbar.min.js" /}
    {js href="//fastly.jsdelivr.net/npm/bootstrap-table@1.26.0/dist/extensions/export/bootstrap-table-export.min.js" /}
    {js href="//fastly.jsdelivr.net/npm/bootstrap-table@1.26.0/dist/extensions/cookie/bootstrap-table-cookie.min.js" /}
{/if}