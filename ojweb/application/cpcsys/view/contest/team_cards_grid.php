{if empty($cpc_team_card_rows)}
<p class="text-muted small bilingual-inline cpc-team-cards-empty">
    暂无队伍信息。
    <span class="en-text">No team listings.</span>
</p>
{/if}
<div class="cpc-team-cards-grid" role="list">
    {volist name="cpc_team_card_rows" id="row"}
    <article class="cpc-team-card" role="listitem">
        <div class="cpc-team-card__header">
            <div class="cpc-team-card__logo school-logo"
                 {if isset($row.school) && $row.school neq ''}data-school="{$row.school}"{/if}
                 title="{if isset($row.school) && $row.school neq ''}学校标识 / School{else /}CCPC{/if}"
                 role="img"
                 aria-label="{if isset($row.school) && $row.school neq ''}{$row.school}{else /}CCPC{/if}"></div>
            <div class="cpc-team-card__header-main">
                <div class="cpc-team-card__title-line">
                    <div class="cpc-team-card__name-wrap{if isset($row.tkind) && (intval($row.tkind) == 1 || intval($row.tkind) == 2)} cpc-team-card__name-wrap--marker{/if}">
                        {if isset($row.tkind) && intval($row.tkind) == 2}
                        <span class="csg-marker-layer-tl" aria-hidden="true"><span class="csg-marker-yellow-star-tl" title="打星队伍 / Star team"><i class="bi bi-star-fill" aria-hidden="true"></i></span></span>
                        {elseif isset($row.tkind) && intval($row.tkind) == 1}
                        <span class="csg-marker-layer-tl" aria-hidden="true"><span class="csg-marker-girl-tl" title="女队 / Girl team"><i class="bi bi-heart-fill" aria-hidden="true"></i></span></span>
                        {/if}
                        <div class="cpc-team-card__name cpc-team-card__mq" data-cpc-mq-plain="{$row.name}" title="队名 / Team name">{$row.name}</div>
                    </div>
                </div>
                {if isset($row.name_en) && $row.name_en neq ''}
                <div class="cpc-team-card__name-en cpc-team-card__mq" data-cpc-mq-plain="{$row.name_en}" title="英文名 / English name">{$row.name_en}</div>
                {/if}
                {if (isset($row.school) && $row.school neq '') || (isset($row.region) && $row.region neq '')}
                <div class="cpc-team-card__school-line">
                    {if isset($row.region) && $row.region neq ''}
                    <div class="cpc-team-card__school-flag-slot" aria-hidden="true">
                        <img class="flag-icon" data-flag="{$row.region}" alt="" role="presentation" width="24" height="18" decoding="async" style="opacity:0" />
                    </div>
                    {/if}
                    <div class="cpc-team-card__school cpc-team-card__mq"{if isset($row.school) && $row.school neq ''} data-cpc-mq-plain="{$row.school}"{/if} title="学校 / School">{if isset($row.school) && $row.school neq ''}{$row.school}{/if}</div>
                </div>
                {/if}
            </div>
            <div class="cpc-team-card__header-end">
                <span class="cpc-team-card__tid mono" title="账号 / Account">{$row.team_id}</span>
                <span class="cpc-team-card__room-slot">
                    {if isset($row.room) && $row.room neq ''}
                    <span class="cpc-team-card__pill" title="场地 / Room">{$row.room}</span>
                    {/if}
                </span>
            </div>
        </div>
        {if isset($cpc_contest_multi_group) && $cpc_contest_multi_group == 1 && isset($row.group_labels) && count($row.group_labels) > 0}
        <div class="cpc-team-card__groups" title="分组 / Groups">
            {foreach $row['group_labels'] as $gl}
            <span class="cpc-team-card__group-chip">
                <span class="cn-text">{$gl.group_name}</span>
                {if isset($gl.group_name_en) && $gl.group_name_en neq ''}<span class="en-text">{$gl.group_name_en}</span>{/if}
            </span>
            {/foreach}
        </div>
        {/if}
        <div class="cpc-team-card__body">
            {if isset($row.coach) && $row.coach neq ''}
            <div class="cpc-team-card__row">
                <span class="cpc-team-card__lbl" role="group" aria-label="教练 Coach"><span class="cn-text">教练</span><span class="en-text">Coach</span></span>
                <span class="cpc-team-card__val cpc-team-card__hud-mq-slot" data-cpc-val-plain="{$row.coach}">{$row.coach}</span>
            </div>
            {/if}
            {if isset($row.tmember) && $row.tmember neq ''}
            <div class="cpc-team-card__row cpc-team-card__row--multiline">
                <span class="cpc-team-card__lbl" role="group" aria-label="选手 Members"><span class="cn-text">选手</span><span class="en-text">Members</span></span>
                <span class="cpc-team-card__val cpc-team-card__hud-mq-slot" data-cpc-val-plain="{$row.tmember}">{$row.tmember}</span>
            </div>
            {/if}
        </div>
    </article>
    {/volist}
</div>
