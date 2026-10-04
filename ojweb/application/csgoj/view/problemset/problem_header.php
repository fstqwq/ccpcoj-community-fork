<?php $controller = strtolower(request()->controller()); ?>
{if isset($contest) }
<div class="contest-problem-nav">
    <ul class="nav nav-pills contest-problem-pills">
        {foreach($problemIdMap['abc2id'] as $apid__=>$pid__)}
        <li class="nav-item" role="presentation">
            <a class="nav-link contest-problem-link {if $problem["problem_id_show"] == $apid__}active{/if}" href="problem?cid={$contest['contest_id']}&pid={$apid__}">
                <span class="problem-letter">{$apid__}</span>
            </a>
        </li>
        {/foreach}
    </ul>
</div>
    <h2 class="problem-title-container">
        <span class="problem-id">{$problem['problem_id_show']}</span>
        {if array_key_exists("show_real_id", $problem) }
            <span class="problem-real-id">(<a href="__OJ__/problemset/problem?pid={$problem['problem_id']}" class="text-decoration-none">{$problem['problem_id']}</a>)</span>
        {/if}
        <span class="problem-separator">:</span>
        <span class="problem-title">{$problem['title']}</span>
    </h2>
{else /}
    <h1 class="page-title problem-title-container">
        <a href="problem?pid={$problem['problem_id']}" class="text-decoration-none">
            <span class="problem-id">{$problem['problem_id_show']}</span>
            {if array_key_exists("show_real_id", $problem) }
            <span class="problem-real-id">(<a href="__OJ__/problemset/problem?pid={$problem['problem_id']}" class="text-decoration-none">{$problem['problem_id']}</a>)</span>
            {/if}
            <span class="problem-separator">:</span>
            <span class="problem-title {if $problem['spj'] == 1}text-warning{elseif $problem['spj'] == 2}text-success{else}text-primary{/if}">{$problem['title']}</span>
        </a>
    </h1>
{/if}

<div class="problem-header-row">
    <div class="problem-header-actions">
        <div class="problem-buttons d-flex flex-wrap align-items-center gap-2">
            {include file="../../csgoj/view/problemset/submit_button" /}
        </div>
    </div>
    <div class="problem-info-inline">
        <span class="info-item">
            <span class="info-label">时间限制<span class="en-text">Time Limit</span></span>
            <span class="info-value">{$problem['time_limit']}</span>
            <span class="info-unit">秒<span class="en-text">Sec</span></span>
        </span>
        <span class="info-item">
            <span class="info-label">内存限制<span class="en-text">Memory Limit</span></span>
            <span class="info-value">{$problem['memory_limit']}</span>
            <span class="info-unit">兆<span class="en-text">MB</span></span>
        </span>
        <span class="info-item">
            <span class="info-label">提交次数<span class="en-text">Submitted</span></span>
            <span class="info-value">{if isset($problem['submit'])}{$problem['submit']}{else/}0{/if}</span>
            <span class="info-unit">次<span class="en-text">Times</span></span>
        </span>
        <span class="info-item">
            <span class="info-label">通过次数<span class="en-text">Solved</span></span>
            <span class="info-value">{if isset($problem['accepted'])}{$problem['accepted']}{else/}0{/if}</span>
            <span class="info-unit">次<span class="en-text">Times</span></span>
        </span>
        <span class="info-item judge-type-item">
            {if $problem['spj'] == 0 }
            <span class="text-primary"><span class="cn-text"><i class="bi bi-check-circle"></i> 标准评测</span><span class="en-text">Standard Judge</span></span>
            {elseif $problem['spj'] == 1 }
            <span class="text-warning"><span class="cn-text"><i class="bi bi-gear"></i> 特判评测</span><span class="en-text">Special Judge</span></span>
            {elseif $problem['spj'] == 2 }
            <span class="text-success"><span class="cn-text"><i class="bi bi-chat-dots"></i> 交互评测</span><span class="en-text">Interactive Judge</span></span>
            {/if}
        </span>
    </div>
    {if isset($show_lang_bar) && $show_lang_bar && isset($available_locales) }
    <div class="problem-desc-lang-select-wrap flex-shrink-0">
        <label for="problem_desc_lang_select" class="problem-desc-lang-select-label bilingual-inline mb-0 text-muted" title="语言 / Language">语言<span class="en-text">Language</span></label>
        <select id="problem_desc_lang_select" class="form-select form-select-sm problem-desc-lang-select" title="语言 / Language" aria-label="语言 Language">
            {volist name="available_locales" id="loc"}
            <option value="{$loc.url_html}" {if isset($current_locale_key) && $current_locale_key == $loc.key}selected="selected"{/if}>{$loc.select_label}</option>
            {/volist}
        </select>
    </div>
    {/if}
</div>
<hr/>
{include file="../../csgoj/view/public/pkg_code_highlight" /}
{css href="__STATIC__/csgoj/oj_problem.css" /}
{js href="__STATIC__/csgoj/oj_problem.js" /}