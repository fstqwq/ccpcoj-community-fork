{include file="../../csgoj/view/public/js_exceljs" /}
{include file="../../csgoj/view/public/base_csg_switch" /}
{include file="../../csgoj/view/public/base_csg_multiselect" /}
{include file="../../csgoj/view/public/js_rank"}
{css href="__STATIC__/csgoj/contest/award_admin.css" /}
{js href="__STATIC__/csgoj/contest/award.js" /}

<div class="admin-page-header admin-page-header--with-award-confirm">
    <div class="admin-page-header-left">
        <div class="admin-page-header-icon">
            <i class="bi bi-trophy"></i>
        </div>
        <h1 class="admin-page-header-title">
            <div class="admin-page-header-title-main">
                获奖名单
            </div>
            <div class="admin-page-header-title-right">
                <a href="__CPC__/contest/contest?cid={$contest['contest_id']}" class="admin-page-header-id">
                    <i class="bi bi-hash"></i> {$contest['contest_id']}
                </a>
                <span class="en-text">
                    Award List
                </span>
            </div>
        </h1>
    </div>
    <div class="admin-page-header-award-confirm" role="status">
        <div class="admin-page-header-award-confirm__line-cn">
            <i class="bi bi-shield-exclamation me-1" aria-hidden="true"></i>
            务必确认：<span class="text-danger">1. 比赛已结束</span>
            <span class="text-muted">|</span>
            <span class="text-danger">2. <a href="/{$module}/contest/status?cid={$contest['contest_id']}" class="link-danger text-decoration-none">评测队列</a>已完成</span>
            <span class="text-muted">|</span>
            <span class="text-danger">3. <strong class="text-primary" role="button" style="cursor:pointer" onclick="window.location.reload()">刷新本页</strong>获取最新数据</span>
        </div>
        <div class="admin-page-header-award-confirm__line-en en-text">
            Please confirm: contest ended, judging queue finished, refresh for latest data
        </div>
    </div>
    <div class="admin-page-header-right admin-page-header-actions--compact admin-page-header-actions--award-tools d-flex flex-wrap align-items-center gap-1">
        <button type="button" class="btn btn-outline-secondary btn-sm award-header-tool-btn" id="export_award_csv_btn" title="导出 CSV / Export CSV">
            <span class="cn-text"><i class="bi bi-file-earmark-text me-1"></i>CSV</span><span class="en-text">CSV</span>
        </button>
        <button type="button" class="btn btn-outline-primary btn-sm award-header-tool-btn" id="export_award_xlsx_btn" title="导出 Excel / Export Excel">
            <span class="cn-text"><i class="bi bi-file-earmark-excel me-1"></i>Excel</span><span class="en-text">Excel</span>
        </button>
        <button type="button" class="btn btn-outline-info btn-sm award-header-tool-btn" data-bs-toggle="collapse" data-bs-target="#award_rules_help" aria-expanded="false" aria-controls="award_rules_help" title="获奖规则说明 / Award rules">
            <span class="cn-text"><i class="bi bi-question-circle me-1"></i>规则</span><span class="en-text">Rules</span>
        </button>
    </div>
</div>

<div class="container admin-import-container">
    <article id="award_rules_help" class="alert alert-info collapse csg-admin-help-collapse award-rules-help">
        <p class="award-rules-help__lead csg-bilingual-stack mb-3">
            <span class="cn-text">下列为系统自动计奖规则摘要；导出前请确认比赛已结束、评测队列已完成，并刷新本页。</span>
            <span class="en-text">Summary of automatic award rules. Confirm the contest has ended, judging is complete, and refresh this page before export.</span>
        </p>

        <h5 class="bilingual-inline">
            金银铜名额
            <span class="en-text">Gold / silver / bronze counts</span>
        </h5>
        <p class="csg-bilingual-stack mb-3">
            <span class="cn-text">默认发奖模式：金奖名额向上取整；银奖名额为金银合计向上取整后减去金奖个数；铜奖名额为金银铜合计向上取整后减去金、银个数。工具栏可切换「个数 / 百分比」基数及「一二三 / 金银铜」展示。</span>
            <span class="en-text">Default mode: gold count is rounded up; silver is ceil(gold+silver) minus gold; bronze is ceil(gold+silver+bronze) minus gold and silver. Use toolbar switches for count vs percentage base and medal naming.</span>
        </p>

        <h5 class="bilingual-inline">
            最佳女队 / 女生奖
            <span class="en-text">Best girls&apos; team / contestant</span>
        </h5>
        <p class="csg-bilingual-stack mb-3">
            <span class="cn-text">当正式参赛女队（三名队员皆为女生）不少于 3 支时，排名最高且已获得铜奖或以上奖项的正式女队获得。</span>
            <span class="en-text">When there are at least three formal all-female teams, the highest-ranked one that already earned bronze or better receives this award.</span>
        </p>

        <h5 class="bilingual-inline">
            顽强拼搏奖
            <span class="en-text">Spirit award</span>
        </h5>
        <p class="csg-bilingual-stack mb-3">
            <span class="cn-text">未获得金、银、铜奖的正式队伍中，按该队<strong>最后一次 AC 时间</strong>最晚者计；每场比赛评 <strong>1</strong> 支。启用多赛事归属时，<strong>每个赛事归属各评 1 支</strong>，互不占用名额；同一队可在不同归属各得一次。</span>
            <span class="en-text">Among formal teams without gold, silver, or bronze, one team with the latest last AC time wins. One per scope; with multiple affiliations, one per affiliation independently (the same team may win in more than one affiliation).</span>
        </p>

        <h5 class="bilingual-inline">
            其它专项
            <span class="en-text">Other special awards</span>
        </h5>
        <ul class="award-rules-help__list mb-0">
            <li class="csg-bilingual-stack">
                <span class="cn-text"><strong>最快解题奖</strong>：每题全场首次 AC 的队伍（打星开关影响是否计入打星队）。</span>
                <span class="en-text"><strong>First blood</strong>: first AC on each problem site-wide (star-team switch affects star teams).</span>
            </li>
            <li class="csg-bilingual-stack">
                <span class="cn-text"><strong>冠 / 亚 / 季军学校</strong>：按学校维度，在前若干名学校中分别取首个出现的队伍所在学校。</span>
                <span class="en-text"><strong>Champion / runner-up / third schools</strong>: first distinct school at each school-rank milestone among leading teams.</span>
            </li>
        </ul>
    </article>

    <div id="award_toolbar" class="award-admin-toolbar">
        <div class="csg-switch csg-switch-md">
            <input type="checkbox" id="switch_one_two_three" name="one_two_three" class="csg-switch-input"
                   data-csg-text-on="一二三" data-csg-text-off="金银铜"
                   data-csg-text-on-en="One Two Three" data-csg-text-off-en="Gold Silver Bronze"
                   title="点击切换显示方式">
        </div>
        <div class="csg-switch csg-switch-md">
            <input type="checkbox" id="switch_with_star_team" name="with_star_team" class="csg-switch-input"
                   data-csg-text-on="包含打星" data-csg-text-off="不包含打星"
                   data-csg-text-on-en="Include Star" data-csg-text-off-en="Exclude Star"
                   title="点击切换打星队伍处理方式">
        </div>
        <div class="csg-switch csg-switch-md">
            <input type="checkbox" id="switch_all_team_based" name="all_team_based" class="csg-switch-input"
                   data-csg-text-on="总数为基数" data-csg-text-off="过题为基数"
                   data-csg-text-on-en="Total Count" data-csg-text-off-en="Solved Count"
                   title="点击切换基数计算方式">
        </div>
        <div id="award_group_filter_wrap" class="award-group-ms-host d-none">
            <div id="award_group_multiselect" class="award-group-ms-control"></div>
            <select id="award_group_filter" class="form-select form-select-sm d-none" multiple></select>
        </div>
    </div>

<div id="award_table_div">
    <table id="award_table"
           data-toggle="table"
           data-pagination="false"
           data-side-pagination="client"
           data-sort-name="rank_order"
           data-sort-order="asc"
           data-classes="table table-hover table-striped"
           data-show-refresh="false"
           data-show-columns="false"
           data-search="true"
           data-search-on-enter-key="true"
           data-maintain-meta-data="true"
           data-toolbar="#award_toolbar">
        <thead>
            <tr>
                <th data-field="rank_order" data-align="center" data-sortable="true" data-width="60" data-formatter="FormatterAwardRank">排名<span class="en-text">Rank</span></th>
                {if isset($award_is_multi_group) && $award_is_multi_group == 1}
                <th data-field="group_affiliations_csv" data-align="center" data-sortable="false" data-width="120" data-formatter="FormatterContestGroupAffiliationColumn" data-cell-style="FormatterContestGroupAffiliationColumnCellStyle"><span class="teamgen-th-stack"><span class="teamgen-th-cn">赛事归属</span><span class="teamgen-th-en en-text">Affiliation</span></span></th>
                {/if}
                <th data-field="awards" data-align="center" data-sortable="false" data-width="220" data-formatter="FormatterAward" class="award-col-award">获奖<span class="en-text">Award</span></th>
                <th data-field="name" data-align="left" data-sortable="true" data-formatter="FormatterAwardTeamName">队名<span class="en-text">Team Name</span></th>
                <th data-field="tkind" data-align="center" data-sortable="false" data-width="50" data-formatter="FormatterAwardTkind">类型<span class="en-text">Type</span></th>
                <th data-field="solved" data-align="center" data-sortable="true" data-width="60" data-formatter="FormatterAwardSolved">解题<span class="en-text">Solved</span></th>
                <th data-field="penalty" data-align="center" data-sortable="true" data-width="80" data-formatter="FormatterAwardPenalty">罚时<span class="en-text">Penalty</span></th>
                <th data-field="school" data-align="left" data-sortable="true" data-formatter="FormatterAwardSchool">学校<span class="en-text">School</span></th>
                <th data-field="members" data-align="left" data-sortable="false" data-formatter="FormatterAwardMembers">选手<span class="en-text">Members</span></th>
                <th data-field="coach" data-align="left" data-sortable="false" data-width="80" data-formatter="FormatterAwardCoach">教练<span class="en-text">Coach</span></th>
                <th data-field="team_id" data-align="left" data-sortable="true" data-width="80" data-formatter="FormatterAwardTeamId">ID<span class="en-text">ID</span></th>
            </tr>
        </thead>
    </table>
</div>

<style>
#award_table_div .fixed-table-container { border: 1px solid #d9dde3; border-radius: 10px; }
#award_table_div .table thead th { font-size: 13px; font-weight: 800; letter-spacing: .2px; color: #232832; background: #f6f7f9; border-bottom: 1px solid #d9dde3; }
#award_table_div .table tbody td { font-size: 14px; color: #1f232b; vertical-align: middle; padding-top: 10px; padding-bottom: 10px; }
#award_table_div .table tbody tr:hover { background: #f8fbff; }

.award-rank-badge { min-width: 2.6rem; display: inline-block; text-align: center; border-radius: 999px; font-weight: 800; }
.award-cell-team { white-space: normal; word-break: break-all; font-size: 15px; font-weight: 700; line-height: 1.35; color: #12161d; }
.award-cell-school, .award-cell-members, .award-cell-coach { white-space: normal; word-break: break-all; line-height: 1.35; }
.award-cell-school { font-weight: 600; color: #202632; }
.award-cell-members { color: #273041; }
.award-cell-coach { color: #5d6776; }
.award-cell-penalty, .award-cell-solved { font-weight: 800; font-size: 15px; color: #12161d; }

.award-tag-wrap { display: flex; flex-wrap: wrap; gap: 5px; align-items: center; justify-content: center; }
.award-tag { display: inline-flex; align-items: center; gap: 3px; padding: 2px 9px; border-radius: 999px; border: 1px solid transparent; font-size: 12px; font-weight: 700; line-height: 1.45; white-space: nowrap; }
.award-group-tag { font-size: 11px; opacity: .92; font-weight: 700; }
.award-problem-id { font-weight: 900; }

.award-tag-gold { color: #6d4c00; background: #fff0bf; border-color: #e0b54d; }
.award-tag-silver { color: #3c4f60; background: #eef3f7; border-color: #9fb0be; }
.award-tag-bronze { color: #67371f; background: #f9e5d9; border-color: #b7794f; }
.award-tag-first-blood { color: #0f4372; background: #d8ebff; border-color: #5c9fdd; }
.award-tag-champion { color: #5d3b00; background: #ffe7a6; border-color: #cf9f30; }
.award-tag-runnerup { color: #2f4558; background: #e4edf7; border-color: #8ba0b4; }
.award-tag-third { color: #5f3420; background: #f3dfd4; border-color: #ab7358; }
.award-tag-girl { color: #7e2455; background: #ffe1f0; border-color: #cf6d9f; }
.award-tag-tenacity { color: #31405f; background: #e6edf9; border-color: #7388af; }
.award-tag-default { color: #1f5fa5; background: #e7f1ff; border-color: #6ea0dd; }
</style>

<script type="text/javascript">
window.RANK_CONFIG = {
    key: 'award_{$contest["contest_id"]}',
    cid_list: '{$contest["contest_id"]}',
    api_url: '/{$module}/contest/contest_data_ajax',
    team_photo_url: "/upload/contest_attach/{$contest_attach|default=''}/team_photo",
    school_badge_url: '/static/image/school_badge',
    region_flag_url: '/static/image/region_flag',
    rank_mode: 'team',
    flg_rank_cache: false
};
new AwardSystem('award_container');
</script>
</div>
