{// examsys 状态页面 - 直接复用 csgoj/view/status/status_page.php}
{include file="../../csgoj/view/status/status_page" /}

{// examsys 特有的配置：添加权限信息到 statusPageConfig}
<script>
if (window.statusPageConfig) {
    window.statusPageConfig.isAdmin = {if isset($isAdmin) && $isAdmin}true{else/}false{/if};
    // isContestAdmin 通过 IsContestAdmin() 判断，如果没有单独变量则使用 isAdmin
    window.statusPageConfig.isContestAdmin = {if isset($isContestAdmin) && $isContestAdmin}true{elseif isset($isAdmin) && $isAdmin}true{else/}false{/if};
    window.statusPageConfig.isReviewer = {if isset($isReviewer) && $isReviewer}true{else/}false{/if};
}
</script>

{// examsys 特有的 JS：引入 formatter 函数}
{js href="__STATIC__/examsys/examinee_status.js" /}

{// examsys 特有的 include}
{include file="../../examsys/view/public/content_show_modal"}

{// examsys 特有的样式}
<style type="text/css">
    .inline-waiting
    {
        width: 100%;
        height: 28px;
        overflow: hidden;
        position: relative;
    }
    .res_running
    {
        margin-top: 3px;
        text-align: center;
        -moz-opacity:0.60;
        opacity: 0.60;
    }
    .loadingblock .loader {
        font-size: 3px;
        text-indent: -9999em;
        border-top:     3px solid rgba(66, 139, 202, 0.8);
        border-right:     3px solid rgba(66, 139, 202, 0.8);
        border-bottom:     3px solid rgba(66, 139, 202, 0.8);
        border-left: #ffffff;
        -webkit-animation: loadingblock 1.0s infinite linear;
        animation: loadingblock 1.0s infinite linear;
        position: absolute;
        left: calc(50% - 14px);
        top: calc(50% - 14px);
    }
    .loadingblock .loader,
    .loadingblock .loader:after {
        border-radius: 50%;
        width: 28px;
        height: 28px;
    }
    @-webkit-keyframes loadingblock {
        0% {
            -webkit-transform: rotate(0deg);
            transform: rotate(0deg);
        }
        100% {
            -webkit-transform: rotate(360deg);
            transform: rotate(360deg);
        }
    }
    @keyframes loadingblock {
        0% {
            -webkit-transform: rotate(0deg);
            transform: rotate(360deg);
        }
        100% {
            -webkit-transform: rotate(360deg);
            transform: rotate(360deg);
        }
    }
    #content_show_modal_content pre
    {
        overflow-y: hidden;
    }
    .code_linenumber_div
    {
        overflow-x: auto;
    }
</style>
