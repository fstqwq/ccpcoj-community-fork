{if(config('OJ_ENV.OJ_CDN') == 'local') /}
    {js href="__STATIC__/ojtool/jspdf/jspdf.umd.min.js" /}
{else /}
    <script src="https://fastly.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js"></script>
{/if}
<script>window.jsPDF = window.jspdf.jsPDF;</script>