{css file="__STATIC__/css/csg_ui_markers.css" /}
{css file="__STATIC__/cpcsys/contest/cpc_team_cards.css" /}
{js href="__STATIC__/csgoj/contest/rank_tool.js" /}
<script src="/static/js/csg_marquee_plain.js?v=20260516_19"></script>

<div class="container py-4 cpc-team-display-page">
    <h2 class="h4 mb-4 bilingual-inline">
        参赛队伍
        <span class="en-text">Teams</span>
    </h2>
    {include file="../../cpcsys/view/contest/team_cards_grid" /}
</div>
<script src="/static/cpcsys/contest/cpc_team_cards.js?v=20260524_1"></script>
<script>
    window.CPC_TEAM_CARD_CONFIG = window.CPC_TEAM_CARD_CONFIG || {};
    window.CPC_TEAM_CARD_CONFIG.school_badge_url = '/static/image/school_badge';
    window.CPC_TEAM_CARD_CONFIG.region_flag_url = '/static/image/region_flag';
    if (typeof CpcTeamCardsInit === 'function') {
        CpcTeamCardsInit(document.querySelector('.cpc-team-display-page'));
    }
</script>
