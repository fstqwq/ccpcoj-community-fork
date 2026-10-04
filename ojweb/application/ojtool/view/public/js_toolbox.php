{if(config('OJ_ENV.OJ_CDN') == 'local') /}
    {js href='__STATIC__/seedrandom/seedrandom.min.js' /}
{else /}
    <script src="https://fastly.jsdelivr.net/npm/seedrandom@3.0.5/seedrandom.min.js"></script>
{/if}