<script type="text/javascript">
(function () {
    window.RANK_CONFIG = {
        key: '{$contest.contest_id}',
        cid_list: '{$contest.contest_id}',
        api_url: <?php echo json_encode(isset($rank_contest_data_api_url) ? (string) $rank_contest_data_api_url : '', JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT | JSON_UNESCAPED_SLASHES); ?>,
        lvtk: <?php echo isset($rank_lvtk_json) ? $rank_lvtk_json : '""'; ?>,
        team_photo_url: <?php echo json_encode(isset($rank_team_photo_url) ? (string) $rank_team_photo_url : '/upload/contest_attach//team_photo', JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT | JSON_UNESCAPED_SLASHES); ?>,
        school_badge_url: '/static/image/school_badge',
        region_flag_url: '/static/image/region_flag',
        rank_account_link_ctx: <?php echo isset($rank_account_link_json) ? $rank_account_link_json : '{}'; ?>,
        backend_time_diff: <?php echo isset($rank_backend_time_diff) ? intval($rank_backend_time_diff) : 0; ?>,
        flg_rank_cache: <?php echo !empty($rank_live_flg_cache) ? 'true' : 'false'; ?>,
        flg_show_page_contest_title: false,
        flg_show_fullscreen_contest_title: false,
    };
})();
</script>
