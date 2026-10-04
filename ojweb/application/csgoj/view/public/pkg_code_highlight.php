{/*
ThinkPHP5.1 模板注释参考：
https://doc.thinkphp.cn/v5_1/mubanzhushi.html
*/} 

{if(config('OJ_ENV.OJ_CDN') == 'local') }
    {js href="__STATIC__/highlight/highlight.min.js" /}
    {css href="__STATIC__/highlight/styles/github.min.css" /}
    {js href="__STATIC__/highlight/languages/c.min.js" /}
    {js href="__STATIC__/highlight/languages/cpp.min.js" /}
    {js href="__STATIC__/highlight/languages/java.min.js" /}
    {js href="__STATIC__/highlight/languages/python.min.js" /}
    {js href="__STATIC__/highlight/languages/go.min.js" /}
    {js href="__STATIC__/highlight/languages/javascript.min.js" /}
    {js href="__STATIC__/highlight/languages/json.min.js" /}
    {js href="__STATIC__/highlight/languages/plaintext.min.js" /}
{else /}
    {js href="//fastly.jsdelivr.net/gh/highlightjs/cdn-release@11.11.1/build/highlight.min.js" /}
    {css href="//fastly.jsdelivr.net/gh/highlightjs/cdn-release@11.11.1/build/styles/github.min.css" /}
    {js href="//fastly.jsdelivr.net/gh/highlightjs/cdn-release@11.11.1/build/languages/c.min.js" /}
    {js href="//fastly.jsdelivr.net/gh/highlightjs/cdn-release@11.11.1/build/languages/cpp.min.js" /}
    {js href="//fastly.jsdelivr.net/gh/highlightjs/cdn-release@11.11.1/build/languages/java.min.js" /}
    {js href="//fastly.jsdelivr.net/gh/highlightjs/cdn-release@11.11.1/build/languages/python.min.js" /}
    {js href="//fastly.jsdelivr.net/gh/highlightjs/cdn-release@11.11.1/build/languages/go.min.js" /}
    {js href="//fastly.jsdelivr.net/gh/highlightjs/cdn-release@11.11.1/build/languages/javascript.min.js" /}
    {js href="//fastly.jsdelivr.net/gh/highlightjs/cdn-release@11.11.1/build/languages/json.min.js" /}
    {js href="//fastly.jsdelivr.net/gh/highlightjs/cdn-release@11.11.1/build/languages/plaintext.min.js" /}
{/if}

{/*
  highlight.js 统一封装入口：
  - 自动高亮：pkg_code_highlight.js 会在 DOMReady 时扫描 pre code 并高亮
  - 手动高亮：业务侧可调用 window.CsgCodeHighlight.highlightElementSafe(el)
  - 同时统一配置 ignoreUnescapedHTML（第三方固有安全告警）
  - 已含 json 语言包（如 CCS API 控制台响应 JSON）
*/} 
{js href="__STATIC__/csgoj/public/pkg_code_highlight.js" /}

{/*
  renderCode()（题目预览等使用）：提供行号+高亮的通用渲染
  - 依赖 code_show.css 的样式
*/} 
{css href="__STATIC__/csgoj/code_show.css" /}
{js href="__STATIC__/csgoj/code_render.js" /}


