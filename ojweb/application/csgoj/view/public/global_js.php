<?php
$__csg_app_tz = (string) (config('app.default_timezone') ?? '');
if ($__csg_app_tz === '') {
    $__csg_app_tz = date_default_timezone_get();
}
?>
<span id="csg-app-tz-root" class="visually-hidden" aria-hidden="true" data-app-timezone="<?php echo htmlspecialchars($__csg_app_tz, ENT_QUOTES, 'UTF-8'); ?>"></span>
{if(config('OJ_ENV.OJ_CDN') == 'local') }
    {js href="__JS__/jquery-3.7.1.min.js" /}
    {js href="__JS__/jquery.cookie.min.js" /}
    {js href="__JS__/bootstrap_modal_escape_stack.js" /}
    {js href="__STATIC__/bootstrap-5.3.8/js/bootstrap.bundle.min.js" /}
    {js href="__STATIC__/js/vendor/luxon-3.7.2.min.js" /}
{else /}
    {js href="//fastly.jsdelivr.net/npm/jquery@3.7.1/dist/jquery.min.js" /}
    {js href="//fastly.jsdelivr.net/npm/jquery.cookie@1.4.1/jquery.cookie.min.js" /}
    {js href="__JS__/bootstrap_modal_escape_stack.js" /}
    {js href="//fastly.jsdelivr.net/npm/bootstrap@5.3.8/dist/js/bootstrap.bundle.min.js" /}
    {js href="//fastly.jsdelivr.net/npm/luxon@3.7.2/build/global/luxon.min.js" /}
{/if}

{include file="../../csgoj/view/public/pkg_bootstraptable" /}


{js href="__JS__/global.js" /}
{js href="__STATIC__/js/sidebar_mobile_edge.js" /}
{js href="__STATIC__/js/csg_timezone_forms.js" /}
{js href="__JS__/tools/idb.js" /}
{js href="__JS__/util.js" /}
{js href="__STATIC__/js/bilingual.js" /}
{js href="__STATIC__/js/alerty.js" /}
{js href="__STATIC__/js/form_validate_tip.js" /}
{js href="__STATIC__/js/csg_hover_popover.js" /}
{js href="__STATIC__/csgoj/general_formatter.js" /}

{include file="../../csgoj/view/public/pkg_vditor" /}
{include file="../../csgoj/view/public/pkg_math" /}