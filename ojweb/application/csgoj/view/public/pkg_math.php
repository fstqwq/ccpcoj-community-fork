<!-- 数学公式渲染工具 -->
<!-- KaTeX 官方库 -->
{if(config('OJ_ENV.OJ_CDN') == 'local') }
    {css href="__STATIC__/katex/katex.min.css" /}
    {js href="__STATIC__/katex/katex.min.js" /}
    {js href="__STATIC__/katex/contrib/auto-render.min.js" /}
{else /}
    <link rel="stylesheet" href="https://fastly.jsdelivr.net/npm/katex@0.16.27/dist/katex.min.css">
    <script src="https://fastly.jsdelivr.net/npm/katex@0.16.27/dist/katex.min.js"></script>
    <script src="https://fastly.jsdelivr.net/npm/katex@0.16.27/dist/contrib/auto-render.min.js"></script>
{/if}
<!-- 数学公式处理工具 -->
{css href="__STATIC__/csgoj/math.css" /}
{js href="__STATIC__/csgoj/math.js" /}
