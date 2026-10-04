{if(config('OJ_ENV.OJ_CDN') == 'local') }
    {css href="__STATIC__/bootstrap-5.3.8/css/bootstrap.min.css" /}
    {css href='__STATIC__/bootstrap-icons-1.13.1/font/bootstrap-icons.min.css' /}
{else /}
    {css href="//fastly.jsdelivr.net/npm/bootstrap@5.3.8/dist/css/bootstrap.min.css" /}
    {css href="//fastly.jsdelivr.net/npm/bootstrap-icons@1.13.1/font/bootstrap-icons.min.css" /}
{/if}

<link rel="stylesheet" type="text/css" href="__CSS__/basecss.css" />
{css href="__STATIC__/csgoj/common/csg_page_header.css" /}

{if(config('OJ_ENV.OJ_SITE') == 'local')}
    <link rel="stylesheet" type="text/css" href="__CSS__/sidebarlayout_local.css" />
{else/}
    <link rel="stylesheet" type="text/css" href="__CSS__/sidebarlayout.css" />
{/if}

<link rel="stylesheet" type="text/css" href="__CSS__/markdownhtml.css" />
{css href="__STATIC__/css/bilingual.css" /}
{css href="__STATIC__/css/csg_ui_markers.css" /}
{css href="__STATIC__/css/csg_hover_popover.css" /}
{css href="__STATIC__/csgoj/math.css" /}
