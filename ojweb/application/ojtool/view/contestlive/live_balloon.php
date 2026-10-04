{__NOLAYOUT__}
<!DOCTYPE html>
<html lang="zh-CN" class="contestlive-page-opacity">
{include file="../../csgoj/view/public/global_head" /}
<link rel="stylesheet" href="__STATIC__/cpcsys/contestlive/css/contestlive.css" />
<body class="contestlive-display contestlive-display--balloon">
<script>window.CONTEST_LIVE_DISPLAY_CONFIG={$live_display_config_json|raw};</script>
{js href="__STATIC__/cpcsys/contestlive/js/contestlive_skin_common.js" /}
<script id="contestlive-skin-boot" data-contestlive-page="live_balloon" src="__STATIC__/cpcsys/contestlive/js/contestlive_skin_boot.js"></script>
<link rel="stylesheet" href="__STATIC__/cpcsys/contestlive/css/contestlive_skin.css" />
<link rel="stylesheet" href="__STATIC__/cpcsys/contestlive/css/contestlive_page_opacity.css" />
<div class="contestlive-balloon-page" id="contestlive_balloon_root">
    <div class="contestlive-balloon-page__chrome">
        <i class="bi bi-balloon contestlive-balloon-page__icon" aria-hidden="true"></i>
        <p class="contestlive-balloon-page__hint mt-3 mb-1 bilingual-inline">
            <span class="cn-text">按 D 试播一次气球动效</span><span class="en-text">Press D for a sample burst</span>
        </p>
        <p class="contestlive-balloon-page__hint small mb-0 bilingual-inline">
            <span class="cn-text">按 I 隐藏本提示</span><span class="en-text">Press I to hide this hint</span>
        </p>
    </div>
    <div id="contestlive_balloon_fx_host" class="contestlive-balloon-fx-host" aria-hidden="true"></div>
</div>
<script type="text/javascript">
window.CONTEST_LIVE_PAGE = 'live_balloon';
window.CONTEST_LIVE_CID = parseInt('{$contest.contest_id}', 10);
window.CONTEST_LIVE_LVTK = <?php echo json_encode(isset($live_lvtk) ? (string) $live_lvtk : '', JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT | JSON_UNESCAPED_UNICODE); ?>;
</script>
{js href="__STATIC__/cpcsys/contestlive/js/contestlive_balloon_page.js" /}
{js href="__STATIC__/cpcsys/contestlive/js/contestlive_page_opacity.js" /}
{js href="__STATIC__/cpcsys/contestlive/js/contestlive_skin_hotkeys.js" /}
</body>
</html>
