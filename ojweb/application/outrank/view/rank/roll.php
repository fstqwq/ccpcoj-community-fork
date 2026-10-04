{css file="__STATIC__/csgoj/contest/rank_font_faces.css" /}
{css file="__STATIC__/csgoj/contest/rank.css" /}
{css file="__STATIC__/csgoj/contest/rank_skin_dark_stage.css" /}
{css file="__STATIC__/csgoj/contest/rank_skin_light_macaron.css" /}
{css file="__STATIC__/csgoj/contest/outrank_roll.css" /}
{css file="__STATIC__/csgoj/contest/roll_award_overlay.css" /}
{include file="../../csgoj/view/public/base_csg_multiselect" /}
<?php
$csg_ph_title = isset($outrank['title']) ? (string) $outrank['title'] : '';
$csg_ph_en = 'Roll';
$csg_ph_icon_class = 'bi-trophy';
$_osb = isset($outrank_sponsor_banner) && is_array($outrank_sponsor_banner) ? $outrank_sponsor_banner : [];
?>
<?php if (!empty($_osb['kind']) && !empty($_osb['url'])): ?>
<div class="outrank-sponsor-banner-outer">
    <div class="outrank-sponsor-banner">
        <div class="outrank-sponsor-banner__frame">
            <img class="outrank-sponsor-banner__media" src="<?php echo htmlspecialchars((string) $_osb['url'], ENT_QUOTES, 'UTF-8'); ?>?v=<?php echo (int) ($_osb['mtime'] ?? 0); ?>" alt="" decoding="async" loading="eager" />
        </div>
    </div>
</div>
<?php endif; ?>
<div class="container-fluid px-4 outrank-standalone-page-header">
{include file="../../csgoj/view/public/csg_page_header" /}
</div>
<div id="rank-container"></div>

<div id="current_time_div" time_stamp="<?php echo $timeStamp; ?>" style="display: none;"></div>

<script>
    (function() {
        const timeStampElement = document.getElementById('current_time_div');
        const timeStamp = timeStampElement ? timeStampElement.getAttribute('time_stamp') : null;
        let rank_time_diff = 0;
        if (timeStamp) {
            rank_time_diff = new Date(timeStamp * 1000).getTime() - new Date().getTime();
        }
        window.RANK_CONFIG = {
            key: 'outrank_<?php echo $outrank_uuid; ?>_roll',
            cid_list: '<?php echo $outrank_uuid; ?>',
            outrank_uuid: '<?php echo $outrank_uuid; ?>',
            api_url: '/upload/outrank_attach/<?php echo $outrank_uuid; ?>/rank.json',
            team_photo_url: '',
            school_badge_url: '/static/image/school_badge',
            region_flag_url: '/static/image/region_flag',
            rank_mode: 'roll',
            backend_time_diff: rank_time_diff || 0,
            flg_show_page_contest_title: false,
            flg_show_time_progress: false,
            flg_show_controls_toolbar: false,
            flg_show_export_offline_roll: false,
            flg_rank_cache: true,
            cache_duration: 60 * 1000,
            request_t_param: true
        };
    })();
</script>
{include file="../../csgoj/view/public/js_rank" /}
{if(config('OJ_ENV.OJ_CDN') == 'local') /}
    {js href="__STATIC__/bootstrap-5.3.8/js/bootstrap.bundle.min.js" /}
{else /}
    <script src="//fastly.jsdelivr.net/npm/bootstrap@5.3.8/dist/js/bootstrap.bundle.min.js"></script>
{/if}
{js href="__STATIC__/js/alerty.js" /}
{js href="__STATIC__/js/csg_marquee_plain.js" /}
{js href="__STATIC__/csgoj/contest/roll_award_overlay.js" /}
{js href="__STATIC__/csgoj/contest/rank_roll.js" /}
{js href="__STATIC__/csgoj/contest/outrank_roll.js" /}
<script>
    const rollSystem = OutrankRollSystemInit('rank-container', window.RANK_CONFIG);
    window.rollSystem = rollSystem;
</script>
