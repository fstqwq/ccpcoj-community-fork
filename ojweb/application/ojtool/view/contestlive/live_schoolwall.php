{__NOLAYOUT__}
<!DOCTYPE html>
<html lang="zh-CN" class="contestlive-page-opacity">
{include file="../../csgoj/view/public/global_head" /}
<link rel="stylesheet" href="__STATIC__/cpcsys/contestlive/css/contestlive.css" />
<body class="contestlive-display contestlive-display--schoolwall">
<script>window.CONTEST_LIVE_PAGE='live_schoolwall';</script>
<script>window.CONTEST_LIVE_DISPLAY_CONFIG={$live_display_config_json|raw};</script>
{js href="__STATIC__/cpcsys/contestlive/js/contestlive_skin_common.js" /}
<script id="contestlive-skin-boot" data-contestlive-page="live_schoolwall" src="__STATIC__/cpcsys/contestlive/js/contestlive_skin_boot.js"></script>
<link rel="stylesheet" href="__STATIC__/cpcsys/contestlive/css/contestlive_skin.css" />
<link rel="stylesheet" href="__STATIC__/cpcsys/contestlive/css/contestlive_page_opacity.css" />
{js href="__STATIC__/csgoj/contest/rank_tool.js" /}
<div class="contestlive-schoolwall" id="contestlive_schoolwall_root">
    <div class="contestlive-schoolwall__grid" role="presentation" aria-label="school badges"></div>
</div>
<script type="text/javascript">
window.CONTEST_LIVE_CID = parseInt('{$contest.contest_id}', 10);
window.CONTEST_LIVE_LVTK = <?php echo json_encode(isset($live_lvtk) ? (string) $live_lvtk : '', JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT | JSON_UNESCAPED_UNICODE); ?>;
window.SCHOOL_WALL_SCHOOLS = <?php
    $list = isset($school_wall_schools) && is_array($school_wall_schools) ? $school_wall_schools : [];
    echo json_encode(array_values($list), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
?>;
</script>
{js href="__STATIC__/cpcsys/contestlive/js/contestlive_schoolwall_layouts.js" /}
{js href="__STATIC__/cpcsys/contestlive/js/contestlive_schoolwall.js" /}
{js href="__STATIC__/cpcsys/contestlive/js/contestlive_layout_hotkeys.js" /}
{js href="__STATIC__/cpcsys/contestlive/js/contestlive_page_opacity.js" /}
{js href="__STATIC__/cpcsys/contestlive/js/contestlive_skin_hotkeys.js" /}
</body>
</html>
