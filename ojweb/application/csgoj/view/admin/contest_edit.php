{assign name="copy_mode" value="$copy_mode|default=false" /}
{assign name="has_contest" value="0" /}
{if isset($contest) && isset($contest.contest_id)}
    {assign name="has_contest" value="1" /}
{/if}
{assign name="is_admin_module" value="0" /}
{if $module == 'admin' || $module == 'exadmin'}
    {assign name="is_admin_module" value="1" /}
{/if}
{assign name="edit_mode" value="$edit_mode|default=0" /}
{if !$edit_mode}
    {if $has_contest}
        {assign name="edit_mode" value="1" /}
    {/if}
{/if}
{assign name="exadmin_practice_add" value="0" /}
{if $module == 'exadmin' && !($edit_mode && !$copy_mode && $has_contest)}
    {assign name="exadmin_practice_add" value="1" /}
{/if}
{js href="__STATIC__/csgoj/common/csg_page_header.js" /}
<div class="csg-page-header" role="banner">
    <div class="csg-page-header__sheet">
        <div class="csg-page-header__grid">
            <div class="csg-page-header__identity">
                <div class="csg-page-header__icon" aria-hidden="true">
                    <i class="bi bi-trophy"></i>
                </div>
                <div class="csg-page-header__wording">
                    <h1 class="csg-page-header__heading">
                        <span class="csg-page-header__title">
                            {if isset($pagetitle)}
                                {$pagetitle}
                            {elseif $module == 'exadmin'}
                                {if $edit_mode && !$copy_mode && $has_contest}
                                    编辑练习
                                {elseif $copy_mode}
                                    复制练习
                                {else /}
                                    添加练习
                                {/if}
                            {else /}
                                {if $edit_mode && !$copy_mode && $has_contest}
                                    编辑比赛
                                {elseif $copy_mode}
                                    复制比赛
                                {else /}
                                    添加比赛
                                {/if}
                            {/if}
                        </span>
                        <span class="csg-page-header__en en-text">
                            {if isset($pagetitle)}
                                {if $pagetitle == '添加练习'}
                                    Add Practice
                                {elseif $pagetitle == '复制练习'}
                                    Copy Practice
                                {elseif $pagetitle == '编辑练习'}
                                    Edit Practice
                                {elseif $pagetitle == '比赛设置'}
                                    Contest Settings
                                {elseif $pagetitle == '添加比赛'}
                                    Add Contest
                                {elseif $pagetitle == '复制比赛'}
                                    Copy Contest
                                {elseif $pagetitle == '编辑比赛'}
                                    Edit Contest
                                {/if}
                            {elseif $module == 'exadmin'}
                                {if $edit_mode && !$copy_mode && $has_contest}
                                    Edit Practice
                                {elseif $copy_mode}
                                    Copy Practice
                                {else /}
                                    Add Practice
                                {/if}
                            {else /}
                                {if $edit_mode && !$copy_mode && $has_contest}
                                    Edit Contest
                                {elseif $copy_mode}
                                    Copy Contest
                                {else /}
                                    Add Contest
                                {/if}
                            {/if}
                        </span>
                    </h1>
                    {if $edit_mode && !$copy_mode && $has_contest}
                    <div class="csg-page-header__chips">
                        <a href="__OJ__/contest/problemset?cid={$contest['contest_id']}" target="_blank" class="csg-page-header__badge">
                            <i class="bi bi-hash"></i> {$contest['contest_id']}
                        </a>
                    </div>
                    {/if}
                </div>
            </div>
            {if $is_admin_module && $edit_mode && !$copy_mode && $has_contest}
            <div class="csg-page-header__actions">
                <button type="button" class="btn btn-success btn-sm"
                        data-modal-url="__ADMIN__/filemanager/filemanager?item={$controller}&id={$contest['contest_id']}"
                        data-modal-title="附件管理 - 比赛 #{$contest['contest_id']} - {$contest['title']|mb_substr=0,150,'utf-8'}..."
                        title="附件管理 (File Manager)">
                    <span><i class="bi bi-paperclip"></i> 附件</span><span class="en-text">Attach</span>
                </button>
                {assign name="defunct" value="$contest.defunct" /}
                {assign name="item_id" value="$contest.contest_id" /}
                {include file="../../admin/view/admin/changestatus_button" /}
            </div>
            {/if}
        </div>
    </div>
</div>

{if $is_admin_module && ($module == 'admin' || $module == 'exadmin')}
{include file="../../csgoj/view/public/base_csg_switch" /}
{/if}

{if $is_admin_module}
    {include file="../../admin/view/contest/problem_selection" /}

    <script>
    // 初始化比赛编辑页面的题号输入组件
    document.addEventListener('DOMContentLoaded', function() {
        // 创建题号输入组件
        const problemInput = createProblemInput('contest_problem_input', {
            max: 26,
            allowDuplicates: false,
            allowInvalid: false,
            showCount: true,
            showActions: true,
            onChange: function(csv, component) {
                // 可以在这里添加额外的变化处理逻辑
            }
        });
        
        // 设置题目选择器确认回调
        window.onProblemSelectionConfirm = function(problemIds) {
            problemInput.addProblems(problemIds);
        };
        
        // 如果有初始值（编辑模式），设置到组件中
        const initialValue = '{if $edit_mode}{$problems}{elseif isset($prefill_problems) /}{$prefill_problems}{/if}';
        if (initialValue && initialValue !== '') {
            problemInput.setValue(initialValue);
        }
        
        // 确保初始化后触发气球颜色更新（仅非 exadmin 模块）
        <?php if($module != 'exadmin'): ?>
        setTimeout(() => {
            if (typeof window.InitBalloonColorPreview === 'function') {
                window.InitBalloonColorPreview();
            }
        }, 100);
        <?php endif; ?>
    });
    </script>
{/if}

<?php 
// exadmin 模块使用 /exadmin/contest/ 路径
$action_url = ($module == 'admin' || $module == 'exadmin') ? '/' . $module . '/contest/' : '/' . $module . '/admin/';
$cid_suffix = ($module == 'admin' || $module == 'exadmin') ? '' : ($has_contest ? '?cid=' . $contest['contest_id'] : '');
$action_url .= ($edit_mode && !$copy_mode ? 'contest_edit_ajax' : 'contest_add_ajax') . $cid_suffix;
?>

<form id="contest_edit_form" class="admin-form" method='post' action="{$action_url}">
    <div class="container">
        {if $is_admin_module}
            {if $module == 'exadmin'}
                <!-- exadmin 模块：附加题选择（有附加题/无附加题） -->
                <?php 
                // 计算 attach_pro：private = 4 表示无附加题，private = 14 表示有附加题
                $current_private = isset($contest) ? ($contest['private'] ?? ($contest['protected'] ?? 4)) : 4;
                // private 的十位用于“附加题”标记：用纯整数运算避免 / 导致 float
                $attach_pro_value = intdiv((int)$current_private, 10); // 4 -> 0, 14 -> 1
                $is_attach = ($attach_pro_value == 1); // 是否有附加题
                ?>
                <div class="form-group mb-4">
                    <label for="attach_pro" class="bilingual-label">附加题：<span class="en-text">Attach Problem</span></label>
                    <div class="d-grid gap-2">
                        <div class="row g-2">
                            <div class="col-6">
                                <button type="button" class="btn btn-outline-secondary attach-type-btn bilingual-button w-100 {if !$is_attach}active{/if}" data-attach-pro="0" aria-pressed="{if !$is_attach}true{else/}false{/if}">
                                    <i class="bi bi-x-circle"></i> 无附加题 <span class="en-text">No Attach</span>
                                </button>
                            </div>
                            <div class="col-6">
                                <button type="button" class="btn btn-outline-primary attach-type-btn bilingual-button w-100 {if $is_attach}active{/if}" data-attach-pro="1" aria-pressed="{if $is_attach}true{else/}false{/if}">
                                    <i class="bi bi-check-circle"></i> 有附加题 <span class="en-text">Has Attach</span>
                                </button>
                            </div>
                        </div>
                    </div>
                    <input type="hidden" name="attach_pro" id="attach_pro_value" value="{$attach_pro_value}">
                    <input type="hidden" name="private" id="private_value" value="{$current_private}">
                </div>
            {else /}
                <!-- admin 模块：比赛类型选择（添加时 OJ_MODE=cpcsys 且 OJ_STATUS=cpc 默认 Standard） -->
                <?php
                $default_private = isset($private) ? (int)$private : 0;
                $is_encrypted = ($default_private >= 10); $default_private_base = $default_private % 10;
                if ($default_private_base == 2) {
                    $contest_type_hint_kind = 'standard';
                    $contest_type_hint_cn = '标准：XCPC标准比赛，账号在比赛内生成';
                    $contest_type_hint_en = 'Standard: XCPC contest; team accounts are provisioned inside the contest.';
                } elseif ($default_private_base == 1) {
                    $contest_type_hint_kind = 'private';
                    $contest_type_hint_cn = '私有：仅白名单OJ用户可参赛';
                    $contest_type_hint_en = 'Private: only whitelisted OJ users can join.';
                } elseif ($is_encrypted) {
                    $contest_type_hint_kind = 'encrypted';
                    $contest_type_hint_cn = '加密：任何OJ用户通过输入设置的题目密码可以参赛';
                    $contest_type_hint_en = 'Encrypted: any OJ user can join with the contest password.';
                } else {
                    $contest_type_hint_kind = 'public';
                    $contest_type_hint_cn = '公开：任何OJ用户都能参赛';
                    $contest_type_hint_en = 'Public: any OJ user can join.';
                }
                ?>
                <div class="form-group mb-4">
                    <div class="row g-2 align-items-start mb-2 contest-type-header-row">
                        <div class="col-12 col-lg-auto">
                            <label for="private" class="bilingual-label mb-0">比赛类型：<span class="en-text">Contest Type</span></label>
                        </div>
                        <div class="col-12 col-lg contest-type-hint-col text-lg-end">
                            <div id="contest_type_hint" class="contest-type-hint form-text contest-type-hint--{$contest_type_hint_kind} small mb-0 csg-bilingual-stack d-inline-block text-start" role="status" aria-live="polite">
                                <span id="contest_type_hint_cn">{$contest_type_hint_cn}</span>
                                <span id="contest_type_hint_en" class="en-text">{$contest_type_hint_en}</span>
                            </div>
                        </div>
                    </div>
                    <div class="d-grid gap-2">
                        <div class="row g-2">
                            <div class="col-3">
                                <button type="button" class="btn btn-success contest-type-btn bilingual-button w-100 {if $default_private_base == 0 && !$is_encrypted}active{/if}" data-private="0" aria-pressed="{if $default_private_base == 0 && !$is_encrypted}true{else/}false{/if}">
                                    <i class="bi bi-unlock">公开</i> <span class="en-text">Public</span>
                                </button>
                            </div>
                            <div class="col-3">
                                <button type="button" class="btn btn-warning contest-type-btn bilingual-button w-100 {if $default_private_base == 0 && $is_encrypted}active{/if}" data-private="0" data-encrypted="true" aria-pressed="{if $default_private_base == 0 && $is_encrypted}true{else/}false{/if}">
                                    <i class="bi bi-shield-lock">加密</i> <span class="en-text">Encrypted</span>
                                </button>
                            </div>
                            <div class="col-3">
                                <button type="button" class="btn btn-danger contest-type-btn bilingual-button w-100 {if $default_private_base == 1}active{/if}" data-private="1" aria-pressed="{if $default_private_base == 1}true{else/}false{/if}">
                                    <i class="bi bi-lock">私有</i> <span class="en-text">Private</span>
                                </button>
                            </div>
                            <div class="col-3">
                                <button type="button" class="btn btn-primary contest-type-btn bilingual-button w-100 {if $default_private_base == 2}active{/if}" data-private="2" aria-pressed="{if $default_private_base == 2}true{else/}false{/if}">
                                    <i class="bi bi-award">标准</i> <span class="en-text">Standard</span>
                                </button>
                            </div>
                        </div>
                    </div>
                    <input type="hidden" name="private" id="private_value" value="{$default_private}">
                </div>
            {/if}
        {/if}
        <div class="form-group mb-4" id="password_group" style="display: none;">
            <label for="password" class="bilingual-label">密码：<span class="en-text">Password</span></label>
            <input type="text" class="form-control" id="password" name="password" placeholder="{if $module == 'exadmin'}输入练习密码...{else /}输入比赛密码...{/if}" {if $edit_mode && $has_contest}value="{$contest['password']}"{/if}>
        </div>

        <div class="row">
            <div class="{if $is_admin_module && $module != 'exadmin'}col-md-9{else/}col-12{/if}" id="main_content_column">
                {if $is_admin_module}
                    {if $module == 'exadmin'}
                    <div class="form-group mb-3" id="exp_title_block">
                        <div class="d-flex flex-wrap align-items-center gap-3 mb-2">
                            <span class="bilingual-label mb-0">练习标题<span class="en-text">Practice Title</span></span>
                            <div class="d-flex align-items-center gap-2">
                                <span class="small text-muted"><span>自动组合</span><span class="en-text">Auto</span></span>
                                <div class="csg-switch csg-switch-sm csg-switch-primary">
                                    <input type="checkbox" class="csg-switch-input" id="exp_auto_title_switch"
                                           data-csg-text-on="开" data-csg-text-on-en="On"
                                           data-csg-text-off="关" data-csg-text-off-en="Off"
                                           {if isset($exp_auto_title_default) && $exp_auto_title_default}checked{/if} />
                                </div>
                            </div>
                        </div>
                        <input type="hidden" name="exp_auto_title" id="exp_auto_title_hidden" value="{if isset($exp_auto_title_default) && $exp_auto_title_default}1{else /}0{/if}">
                        {if $exadmin_practice_add}
                        <input type="hidden" name="title" id="title" value="">
                        <div class="row g-2 align-items-end">
                            <div class="col-12 col-sm-auto">
                                <label for="exp_no" class="form-label small text-muted mb-1"><span>实验序号</span><span class="en-text">Lab #</span></label>
                                <div class="input-group exp-no-stepper" style="width: 9.5rem; max-width: 100%;">
                                    <button type="button" class="btn btn-outline-secondary px-2" id="exp_no_dec" title="序号减 1 (Decrease)">−</button>
                                    <input type="text" class="form-control text-center px-1" id="exp_no" name="exp_no" inputmode="numeric" autocomplete="off" maxlength="3" pattern="[0-9]*" placeholder="0" value="{if isset($prefill_exp_no)}{$prefill_exp_no|intval}{else /}1{/if}">
                                    <button type="button" class="btn btn-outline-secondary px-2" id="exp_no_inc" title="序号加 1 (Increase)">+</button>
                                </div>
                            </div>
                            <div class="col-12 col-sm min-w-0">
                                <label for="title_suffix" class="form-label small text-muted mb-1"><span>实验短标题</span><span class="en-text">Short title</span></label>
                                <input type="text" class="form-control" id="title_suffix" name="title_suffix" maxlength="200" placeholder="如：回溯法练习（1）" value="{if isset($prefill_title_suffix)}{$prefill_title_suffix|htmlspecialchars}{/if}">
                            </div>
                        </div>
                        {else /}
                        <div class="row g-2 align-items-end">
                            <div class="col-12 col-lg min-w-0">
                                <label for="title" class="form-label small text-muted mb-1"><span>总标题</span><span class="en-text">Full title</span></label>
                                <input type="text" class="form-control" id="title" placeholder="输入练习标题..." name="title" {if $edit_mode && $has_contest}value="{$contest['title']|htmlspecialchars}"{/if}>
                            </div>
                            <div class="col-12 col-lg-auto">
                                <label for="exp_no" class="form-label small text-muted mb-1"><span>实验序号</span><span class="en-text">Lab #</span></label>
                                <div class="input-group exp-no-stepper" style="width: 9.5rem; max-width: 100%;">
                                    <button type="button" class="btn btn-outline-secondary px-2" id="exp_no_dec" title="序号减 1 (Decrease)">−</button>
                                    <input type="text" class="form-control text-center px-1" id="exp_no" name="exp_no" inputmode="numeric" autocomplete="off" maxlength="3" pattern="[0-9]*" placeholder="0" value="{if isset($prefill_exp_no)}{$prefill_exp_no|intval}{else /}1{/if}">
                                    <button type="button" class="btn btn-outline-secondary px-2" id="exp_no_inc" title="序号加 1 (Increase)">+</button>
                                </div>
                            </div>
                            <div class="col-12 col-lg">
                                <label for="title_suffix" class="form-label small text-muted mb-1"><span>实验短标题</span><span class="en-text">Short title</span></label>
                                <input type="text" class="form-control" id="title_suffix" name="title_suffix" maxlength="200" placeholder="如：回溯法练习（1）" value="{if isset($prefill_title_suffix)}{$prefill_title_suffix|htmlspecialchars}{/if}">
                            </div>
                        </div>
                        {/if}
                        {if $exadmin_practice_add}
                        <input type="hidden" name="exp_batch_json" id="exp_batch_json" value="[]">
                        <div id="exp_practice_add_batch_panel" class="card border mb-3 mt-2">
                            <div class="card-header py-2 px-3 d-flex flex-wrap align-items-center justify-content-between gap-2">
                                <span class="small fw-semibold mb-0"><span>按班级填写</span><span class="en-text ms-1">Per class</span></span>
                                <button type="button" class="btn btn-sm btn-outline-primary" id="exp_batch_sync_default">
                                    <span>时间全部同步为页面默认</span><span class="en-text"> Sync all rows to page defaults</span>
                                </button>
                            </div>
                            <div class="card-body p-2">
                                <p class="small text-muted mb-2 csg-bilingual-stack">
                                    <span>须先绑定班级；提交时按班逐条创建练习。每行填写该班的总标题与起止时间；未选班级时无法提交。「时间全部同步」使用本页初始默认时间。</span>
                                    <span class="en-text">Bind class(es) first; each row is one practice. Submit creates one contest per class. Sync uses the page’s initial default times.</span>
                                </p>
                                <div class="table-responsive rounded border">
                                    <table class="table table-sm table-striped align-middle mb-0 exp-batch-table" id="exp_batch_table">
                                        <thead class="table-light">
                                            <tr>
                                                <th scope="col">班级</th>
                                                <th scope="col">总标题</th>
                                                <th scope="col">开始</th>
                                                <th scope="col">结束</th>
                                                <th scope="col" class="text-nowrap">操作</th>
                                            </tr>
                                        </thead>
                                        <tbody></tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                        {/if}
                        <div class="form-text small text-muted mt-2 mb-0 csg-bilingual-stack">
                            <span>开启「自动组合」时，上表「总标题」列会按学期、班级名、实验序号与短标题预填（可改）；实验序号写入扩展信息（0～999）。保存的 title 以各行为准。</span>
                            <span class="en-text">Auto fills the title column per class; lab # is stored in metadata (0–999). Saved title is each row’s value.</span>
                        </div>
                    </div>
                    {else /}
                    <div class="form-group mb-3">
                        <label for="title" class="bilingual-label">
                            比赛标题：<span class="en-text">Contest Title</span>
                        </label>
                        <input type="text" class="form-control" id="title" placeholder="输入比赛标题..." name="title" {if $edit_mode && $has_contest}value="{$contest['title']}"{/if}>
                    </div>
                    {/if}
                {/if}
                <!-- 时间设置（exadmin 添加/复制练习时仅保留隐藏域，供批量表默认时间与提交兼容） -->
                {if $exadmin_practice_add}
                <input type="hidden" id="start_year" name="start_year" value="{$start_year}">
                <input type="hidden" id="start_month" name="start_month" value="{$start_month}">
                <input type="hidden" id="start_day" name="start_day" value="{$start_day}">
                <input type="hidden" id="start_hour" name="start_hour" value="{$start_hour}">
                <input type="hidden" id="start_minute" name="start_minute" value="{$start_minute}">
                <input type="hidden" id="end_year" name="end_year" value="{$end_year}">
                <input type="hidden" id="end_month" name="end_month" value="{$end_month}">
                <input type="hidden" id="end_day" name="end_day" value="{$end_day}">
                <input type="hidden" id="end_hour" name="end_hour" value="{$end_hour}">
                <input type="hidden" id="end_minute" name="end_minute" value="{$end_minute}">
                {else /}
                <div class="row g-3 mb-3">
                    <div class="col-12 col-md-6">
                        <div class="form-group mb-0">
                            <label class="bilingual-label csg-contest-edit-time-label" id="csg-contest-edit-label-start" for="start_year"><span class="csg-contest-edit-time-label__main">开始时间：<span class="en-text">Start Time</span></span></label>
                            <div class="row g-2">
                                <div class="col-2">
                                    <input type="text" class="form-control form-control-sm" id="start_year" name="start_year" 
                                            title="年 (Year)" placeholder="年" value="{$start_year}">
                                </div>
                                <div class="col-2">
                                    <input type="text" class="form-control form-control-sm" id="start_month" name="start_month" 
                                            title="月 (Month)" placeholder="月" value="{$start_month}">
                                </div>
                                <div class="col-2">
                                    <input type="text" class="form-control form-control-sm" id="start_day" name="start_day" 
                                            title="日 (Day)" placeholder="日" value="{$start_day}">
                                </div>
                                <div class="col-2">
                                    <input type="text" class="form-control form-control-sm" id="start_hour" name="start_hour" 
                                            title="时 (Hour)" placeholder="时" value="{$start_hour}">
                                </div>
                                <div class="col-2">
                                    <input type="text" class="form-control form-control-sm" id="start_minute" name="start_minute" 
                                            title="分 (Minute)" placeholder="分" value="{$start_minute}">
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="col-12 col-md-6">
                        <div class="form-group mb-0">
                            <label class="bilingual-label csg-contest-edit-time-label" id="csg-contest-edit-label-end" for="end_year"><span class="csg-contest-edit-time-label__main">结束时间：<span class="en-text">End Time</span></span></label>
                            <div class="row g-2">
                                <div class="col-2">
                                    <input type="text" class="form-control form-control-sm" id="end_year" name="end_year" 
                                            title="年 (Year)" placeholder="年" value="{$end_year}">
                                </div>
                                <div class="col-2">
                                    <input type="text" class="form-control form-control-sm" id="end_month" name="end_month" 
                                            title="月 (Month)" placeholder="月" value="{$end_month}">
                                </div>
                                <div class="col-2">
                                    <input type="text" class="form-control form-control-sm" id="end_day" name="end_day" 
                                            title="日 (Day)" placeholder="日" value="{$end_day}">
                                </div>
                                <div class="col-2">
                                    <input type="text" class="form-control form-control-sm" id="end_hour" name="end_hour" 
                                            title="时 (Hour)" placeholder="时" value="{$end_hour}">
                                </div>
                                <div class="col-2">
                                    <input type="text" class="form-control form-control-sm" id="end_minute" name="end_minute" 
                                            title="分 (Minute)" placeholder="分" value="{$end_minute}">
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                {/if}
                <!-- 奖项比例改为仅由赛事归属配置维护 -->
                <input type="hidden" id="ratio_gold" name="ratio_gold" value="{$ratio_gold}">
                <input type="hidden" id="ratio_silver" name="ratio_silver" value="{$ratio_silver}">
                <input type="hidden" id="ratio_bronze" name="ratio_bronze" value="{$ratio_bronze}">
                <input type="hidden" id="flg_award_qty_mode" name="flg_award_qty_mode" value="{if isset($flg_award_qty_mode)}{$flg_award_qty_mode}{else /}0{/if}">

                {/* 仅 $module==admin：赛事归属 JSON 提交给 /admin/contest/contest_edit_ajax，由 saveContestGroupsCompat 写 contest_group。cpcsys/csgoj 等走 Trait 的 contest_edit_ajax 不处理该表。见 guide/01 #harness-contest-edit-dual-admin */}
                {if $module == 'admin'}
                <div class="form-group mb-3" id="contest_group_editor_wrap">
                    <div class="d-flex justify-content-between align-items-center mb-2">
                        <div class="bilingual-label mb-0" title="用于同一场比赛下按不同赛事归属分别计算奖项与学校排名口径；每个归属可独立设置判奖比例和学校计队规则。">队伍赛事归属配置<span class="en-text">Team Event Affiliation Config</span></div>
                        <button type="button" class="btn btn-sm btn-outline-primary" id="btn_add_contest_group">+ 赛事归属</button>
                    </div>
                    <div class="table-responsive">
                        <table class="table table-sm table-bordered" id="contest_group_table">
                            <thead>
                            <tr>
                                <th>归属标识<span class="en-text">Affiliation ID</span></th>
                                <th>名称<span class="en-text">Name</span></th>
                                <th class="text-nowrap" style="min-width:7.5rem" title="关：百分比（金银铜各 0～100，合计≤100）；开：个数（固定名额）">计奖方式<span class="en-text">Basis</span></th>
                                <th>金<span class="en-text">Gold</span></th>
                                <th>银<span class="en-text">Silver</span></th>
                                <th>铜<span class="en-text">Bronze</span></th>
                                <th title="学校排名按各校前 N 队为准">学校计前N队<span class="en-text">School Top-N</span></th>
                                <th>删<span class="en-text">Delete</span></th>
                            </tr>
                            </thead>
                            <tbody></tbody>
                        </table>
                    </div>
                    <div class="form-text text-muted small csg-bilingual-stack">
                        <span>仅当配置超过 1 个赛事归属时，前端榜单显示归属筛选逻辑；0/1 个保持旧体验。</span>
                        <span>每行数字框或计奖方式旁 <i class="bi bi-arrow-down"></i> 表示“下同”，可将该值应用到下方所有归属。</span>
                        <span class="en-text">Affiliation UI is enabled only when more than one affiliation exists.</span>
                        <span class="en-text">Use the <i class="bi bi-arrow-down"></i> button to apply current value to all rows below.</span>
                    </div>
                    <input type="hidden" name="contest_groups_json" id="contest_groups_json" value="[]">
                </div>
                {/if}
                
                <div class="form-group mb-3">
                    <label for="contest_rank_kind" class="form-label">榜单赛制 / Scoreboard rules</label>
                    <select class="form-select" id="contest_rank_kind" name="contest_rank_kind">
                        <option value="icpc" <?php echo ($contest['contest_rank_kind'] ?? 'icpc') === 'icpc' ? 'selected' : ''; ?>>原 XCPC / ICPC</option>
                        <option value="ccpc" <?php echo ($contest['contest_rank_kind'] ?? 'icpc') === 'ccpc' ? 'selected' : ''; ?>>CCPC 2026 匿名榜单</option>
                    </select>
                    <label for="ccpc_reveal_policy" class="form-label mt-2">题号公开阈值 / Reveal threshold</label>
                    <select class="form-select" id="ccpc_reveal_policy" name="ccpc_reveal_policy">
                        <?php foreach (['min_50_20'=>'50 与队数 20% 下取整的较小值（默认）','fixed_50'=>'固定 50 支队伍','ratio_20'=>'队数 20% 下取整'] as $key=>$label): ?>
                        <option value="<?php echo $key; ?>" <?php echo ($contest['ccpc_reveal_policy'] ?? 'min_50_20') === $key ? 'selected' : ''; ?>><?php echo $label; ?></option>
                        <?php endforeach; ?>
                    </select>
                    <div class="form-text">CCPC 固定最后 60 分钟封榜，封榜起停止气球发放；阈值最低为 1。赛事开始后请勿更改赛制或气球色板。</div>
                </div>
                <!-- 封榜时间设置 -->
                {if !isset($OJ_STATUS) || $OJ_STATUS != 'exp'}
                <div class="form-group mb-3">
                    <div class="bilingual-label mb-2">封榜（分钟）<span class="en-text">Scoreboard freeze (min)</span></div>
                    <div class="row g-3 align-items-start">
                        <div class="col-12 col-sm-6 col-md-5 col-lg-4">
                            <label for="frozen_minute" class="form-label small mb-1 csg-bilingual-stack">
                                <span>距结束</span>
                                <span class="en-text">Before end</span>
                            </label>
                            <input type="text" class="form-control form-control-sm" id="frozen_minute" name="frozen_minute"
                                    inputmode="numeric" autocomplete="off" title="距结束前开始封榜的分钟数" value="{$frozen_minute}">
                            <div class="form-text text-muted small mt-1 mb-0 csg-bilingual-stack">
                                <span>结束前最后 N 分钟榜单冻结；0=全程不封。</span>
                                <span class="en-text">Freeze scoreboard in the last N minutes before end; 0 = off.</span>
                            </div>
                        </div>
                        <div class="col-12 col-sm-6 col-md-5 col-lg-4">
                            <label for="frozen_after" class="form-label small mb-1 csg-bilingual-stack">
                                <span>结束后</span>
                                <span class="en-text">After end</span>
                            </label>
                            <input type="text" class="form-control form-control-sm" id="frozen_after" name="frozen_after"
                                    inputmode="numeric" autocomplete="off" title="结束后继续封榜的分钟数" value="{$frozen_after}">
                            <div class="form-text text-muted small mt-1 mb-0 csg-bilingual-stack">
                                <span>正式结束后仍封榜的分钟数；0=结束即解榜。</span>
                                <span class="en-text">Stay frozen this many minutes after end; 0 = unfreeze at end.</span>
                            </div>
                        </div>
                    </div>
                </div>
                {else /}
                <!-- EXP 模式：隐藏封榜时间设置，使用默认值 0 -->
                <input type="hidden" name="frozen_minute" value="0">
                <input type="hidden" name="frozen_after" value="0">
                {/if}
                
                <!-- 学校前N改为仅由赛事归属配置维护 -->
                <input type="hidden" id="topteam" name="topteam" value="{if isset($topteam) && $topteam > 0}{$topteam}{else/}1{/if}">
                
                {if $module == 'exadmin'}
                <!-- exadmin 模块：班级选择（支持多选） -->
                <div class="form-group mb-3" id="clss_selector_wrapper">
                    <!-- 班级选择器将在这里动态生成 -->
                </div>
                {/if}
                
                <!-- 编程语言选择 -->
                <div class="form-group mb-3">
                    <label for="language" class="bilingual-label">允许的编程语言：<span class="en-text">Allowed Programming Languages</span></label>
                    <?php 
                    $ojLang = config('CsgojConfig.OJ_LANGUAGE');
                    $selectedLanguages = [];
                    if ($edit_mode && $has_contest) {
                        foreach($ojLang as $k => $val) {
                            if (($contest['langmask'] >> $k) & 1) {
                                $selectedLanguages[] = $k;
                            }
                        }
                    } elseif (!$edit_mode && !$copy_mode) {
                        // 添加比赛（非编辑、非复制）：默认选中 C、C++、Java、Python
                        $defaultLangKeys = [0, 1, 3, 6]; // C, C++, Java, Python3
                        $selectedLanguages = array_values(array_intersect($defaultLangKeys, array_keys($ojLang ?: [])));
                    }
                    ?>
                    <select name="language[]" class="form-select" multiple size="6">
                        {foreach($ojLang as $k=>$val) }
                        <option value="{$k}" {if in_array($k, $selectedLanguages)}selected="selected"{/if}>
                            {$val}
                        </option>
                        {/foreach}
                    </select>
                    <div class="form-text text-muted small mt-1 mb-0 csg-bilingual-stack">
                        <span>按住 Ctrl 键可多选语言。</span>
                        <span class="en-text">Hold Ctrl to select multiple languages.</span>
                    </div>
                </div>
                
            {if $is_admin_module}
                <!-- 题目设置 -->
                <div class="form-group mb-3">
                    <div id="contest_problem_input"></div>
                </div>
                
                {if $module != 'exadmin'}
                    {include file="../../admin/view/contest/balloon_color_selection" /}
                {/if}
            {/if}
                <!-- 说明和公告（左右并排双栏） -->
                <div class="row g-3 mb-3">
                    <!-- 说明（首页显示） -->
                    <div class="col-md-6">
                        <div class="form-group mb-0">
                            <label for="contest_description" class="bilingual-label">
                                {if $module == 'examsys'}
                                    考试说明<span class="en-text">Exam Description</span>
                                {elseif $module == 'expsys'}
                                    练习说明<span class="en-text">Practice Description</span>
                                {else /}
                                    比赛说明<span class="en-text">Contest Description</span>
                                {/if}
                            </label>
                            <textarea id="contest_description" class="form-control" placeholder="{if $module == 'examsys'}输入考试说明（支持 Markdown）...{elseif $module == 'expsys'}输入练习说明（支持 Markdown）...{else /}输入比赛说明（支持 Markdown）...{/if}" rows="6" name="description">{if $edit_mode && isset($contest['description'])}{$contest['description']|htmlspecialchars}{elseif isset($prefill_description)}{$prefill_description|htmlspecialchars}{/if}</textarea>
                            <div class="mt-1">
                                <div class="form-text text-muted small mb-0 csg-bilingual-stack">
                                    {if $module == 'examsys'}
                                        <span>展示在考试首页。</span>
                                        <span class="en-text">Shown on the exam home page.</span>
                                    {elseif $module == 'expsys'}
                                        <span>展示在练习首页。</span>
                                        <span class="en-text">Shown on the practice home page.</span>
                                    {else /}
                                        <span>对外公开展示在比赛首页。</span>
                                        <span class="en-text">Publicly visible on the contest home page.</span>
                                    {/if}
                                </div>
                                <div class="form-text text-muted small mt-1 mb-0 csg-bilingual-stack">
                                    <span>支持 Markdown。</span>
                                    <span class="en-text">Markdown supported.</span>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- 公告（赛内） -->
                    <div class="col-md-6">
                        <div class="form-group mb-0">
                            <label for="contest_notification" class="bilingual-label">
                                公告<span class="en-text">Announcement</span>
                            </label>
                            <textarea id="contest_notification" class="form-control" placeholder="输入公告内容（支持 Markdown）..." rows="6" name="notification">{if $edit_mode}{if isset($contest['notification'])}{$contest['notification']|htmlspecialchars}{/if}{/if}</textarea>
                            <div class="mt-1">
                                <div class="form-text text-muted small mb-0 csg-bilingual-stack">
                                    {if $module == 'examsys'}
                                        <span>考试内的公告。</span>
                                        <span class="en-text">In-exam announcement.</span>
                                    {elseif $module == 'expsys'}
                                        <span>练习内的公告。</span>
                                        <span class="en-text">In-practice announcement.</span>
                                    {else /}
                                        <span>比赛内的公告。</span>
                                        <span class="en-text">In-contest announcement.</span>
                                    {/if}
                                </div>
                                <div class="form-text text-muted small mt-1 mb-0 csg-bilingual-stack">
                                    <span>支持 Markdown。</span>
                                    <span class="en-text">Markdown supported.</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            
            {if $is_admin_module && $module != 'exadmin'}
                <!-- 参赛白名单列（仅 admin 私有赛；exadmin 不需要） -->
                <div class="col-md-3" id="users_column" style="display: none;">
                    <div class="form-group mb-3">
                        <label for="users" class="bilingual-label">参赛白名单（每行一个用户 ID）：<span class="en-text">Whitelist (one user ID per line)</span></label>
                        <textarea class="form-control" id="users" placeholder="team001&#10;team002&#10;..." rows="20" name="users">{if $edit_mode && !$copy_mode}{$users}{/if}</textarea>
                        <div class="form-text text-muted small mt-1 mb-0 csg-bilingual-stack">
                            <span>仅私有赛生效；每行一个可参赛的 OJ 账号。</span>
                            <span class="en-text">Private contests only; one eligible OJ account per line.</span>
                        </div>
                    </div>
                </div>
            {/if}
        </div>
        
        <!-- 提交按钮 -->
        {if $edit_mode && !$copy_mode && $has_contest}
        <input type="hidden" id="id_input" value="{$contest['contest_id']}" name="contest_id">
        {/if}
        
        <div class="admin-form-actions">
            <button type="submit" id="submit_button" class="btn btn-primary bilingual-button">
                <span><i class="bi bi-check-circle"></i>
                {if $module == 'exadmin'}
                    {if $edit_mode && !$copy_mode}
                    修改练习</span><span class="en-text">Modify Practice</span>
                    {else}
                    添加练习</span><span class="en-text">Add Practice</span>
                    {/if}
                {else /}
                    {if $edit_mode && !$copy_mode}
                    修改比赛</span><span class="en-text">Modify Contest</span>
                    {else}
                    添加比赛</span><span class="en-text">Add Contest</span>
                    {/if}
                {/if}
            </button>
        </div>
    </div>
</form>

<input type="hidden" id='page_info' edit_mode="{if $edit_mode && !$copy_mode}1{else/}0{/if}" copy_mode="{if isset($copy_mode) && $copy_mode}1{else /}0{/if}">

<script>
    window.CONTEST_EDIT_CONFIG = {
        edit_mode: <?php echo ($module != 'admin' && $module != 'exadmin') || ($edit_mode && !$copy_mode) ? 1 : 0; ?>,
        view_only: <?php echo (isset($view_only) && $view_only) ? 1 : 0; ?>,
        exadmin_add_batch: <?php echo !empty($exadmin_practice_add) ? 1 : 0; ?>,
    }
</script>

{if $module == 'admin'}
<script>
$(function () {
    const MAX_CONTEST_GROUPS = 10;
    const $tableBody = $("#contest_group_table tbody");
    const $jsonInput = $("#contest_groups_json");
    function nextAffiliationSeed() {
        let maxNo = 0;
        $tableBody.find("tr").each(function () {
            const gid = $.trim($(this).find(".cg-group-id").val() || "");
            const m = gid.match(/^event_(\d+)$/);
            if (m) maxNo = Math.max(maxNo, parseInt(m[1], 10) || 0);
        });
        return maxNo + 1;
    }
    function generateAffiliationId() {
        let n = nextAffiliationSeed();
        let gid = `event_${n}`;
        const exists = () => {
            let hit = false;
            $tableBody.find(".cg-group-id").each(function () {
                if ($.trim($(this).val()) === gid) hit = true;
            });
            return hit;
        };
        while (exists()) {
            n++;
            gid = `event_${n}`;
        }
        return gid;
    }
    function generateAffiliationName() {
        const idx = $tableBody.find("tr").length + 1;
        return `赛事${idx}`;
    }
    function coalesceInt(v, defVal) {
        const n = parseInt(v, 10);
        return Number.isNaN(n) ? defVal : n;
    }
    /** 与 ContestAwardMath::validateAwardTripleI18n 一致 */
    function validateContestGroupAwardTriple(g, s, b, qtyMode) {
        if (qtyMode === 1) {
            if (g < 0 || s < 0 || b < 0) {
                return {
                    message: "个数模式下，金、银、铜名额须为非负整数。",
                    message_en: "In count mode, gold, silver, and bronze slot counts must be non-negative integers."
                };
            }
            return null;
        }
        if (g < 0 || g > 100 || s < 0 || s > 100 || b < 0 || b > 100) {
            return {
                message: "百分比模式下，金、银、铜比例须各自在 0～100 之间。",
                message_en: "In percentage mode, each value must be between 0 and 100."
            };
        }
        if (g + s + b > 100) {
            return {
                message: "百分比模式下，金、银、铜比例之和不可超过 100。",
                message_en: "In percentage mode, the sum of gold, silver, and bronze ratios must not exceed 100."
            };
        }
        return null;
    }
    /** 动态插入的赛事归属行上的 csg_switch 需再跑 autoInit（依赖 base_csg_switch 已引入） */
    function initContestGroupCsgSwitches() {
        if (window.csgSwitch && typeof window.csgSwitch.autoInit === "function") {
            window.csgSwitch.autoInit();
        }
    }
    function makeNumberCell(cls, val) {
        const n = coalesceInt(val, 0);
        return `<div class="input-group input-group-sm">
            <input type="number" class="form-control ${cls}" value="${n}">
            <button type="button" class="btn btn-outline-secondary btn-sm py-0 px-1 cg-copy-down" title="下同 / Apply to below" data-target="${cls}">
                <i class="bi bi-arrow-down" style="font-size:0.95rem"></i>
            </button>
        </div>`;
    }
    /** 关=百分比（0–100），开=个数（≥0）；与 contest_group.flg_award_qty_mode 一致 */
    function makeAwardModeCell(qtyMode) {
        const on = coalesceInt(qtyMode, 0) === 1 ? "checked" : "";
        return `<div class="d-flex align-items-center gap-1 flex-wrap">
            <label class="csg-switch csg-switch-sm csg-switch-success mb-0 flex-shrink-0">
                <input type="checkbox" class="csg-switch-input flg_award_qty_mode" ${on}
                    data-csg-text-off="百分比"
                    data-csg-text-on="个数"
                    data-csg-text-off-en="Percent"
                    data-csg-text-on-en="Count"
                    data-csg-title-off="金银铜为参赛规模的百分比比例（各 0～100，合计不超过 100）"
                    data-csg-title-on="金银铜为固定名额个数">
            </label>
            <button type="button" class="btn btn-outline-secondary btn-sm py-0 px-1 cg-copy-down-mode" title="以下归属同步为本行计奖方式 / Apply award basis to rows below">
                <i class="bi bi-arrow-down" style="font-size:0.95rem"></i>
            </button>
        </div>`;
    }
    function makeRow(data) {
        const d = Object.assign({
            group_id: "default",
            group_name: "默认赛事",
            award_ratio_gold: 10,
            award_ratio_silver: 15,
            award_ratio_bronze: 20,
            flg_award_qty_mode: 0,
            topteam: 1
        }, data || {});
        const row = `<tr>
            <td><input class="form-control form-control-sm cg-group-id" value="${$('<div>').text(d.group_id).html()}"></td>
            <td><input class="form-control form-control-sm cg-group-name" value="${$('<div>').text(d.group_name).html()}"></td>
            <td class="align-middle">${makeAwardModeCell(d.flg_award_qty_mode)}</td>
            <td>${makeNumberCell("cg-gold", coalesceInt(d.award_ratio_gold, 10))}</td>
            <td>${makeNumberCell("cg-silver", coalesceInt(d.award_ratio_silver, 15))}</td>
            <td>${makeNumberCell("cg-bronze", coalesceInt(d.award_ratio_bronze, 20))}</td>
            <td>${makeNumberCell("cg-topteam", coalesceInt(d.topteam, 1))}</td>
            <td><button type="button" class="btn btn-sm btn-outline-danger cg-del" title="删除 / Delete"><i class="bi bi-trash"></i></button></td>
        </tr>`;
        return $(row);
    }
    function collectRows() {
        window._lastContestGroupCollectErr = null;
        const ret = [];
        let hasError = false;
        const gidMap = {};
        $tableBody.find("tr").each(function (idx) {
            const $tr = $(this);
            const $gidInput = $tr.find(".cg-group-id");
            const $nameInput = $tr.find(".cg-group-name");
            const $gold = $tr.find(".cg-gold");
            const $silv = $tr.find(".cg-silver");
            const $brnz = $tr.find(".cg-bronze");
            const gid = $.trim($gidInput.val());
            const gname = $.trim($nameInput.val());
            $gidInput.removeClass("is-invalid");
            $nameInput.removeClass("is-invalid");
            $gold.add($silv).add($brnz).removeClass("is-invalid");
            if (!gid || !gname) {
                if (!gid) $gidInput.addClass("is-invalid");
                if (!gname) $nameInput.addClass("is-invalid");
                hasError = true;
                window._lastContestGroupCollectErr = window._lastContestGroupCollectErr || {
                    message: "请完整填写赛事归属；归属标识仅允许数字/字母/下划线，且不得重复。",
                    message_en: "Please complete all affiliations. Affiliation ID must be alphanumeric/underscore and unique."
                };
                return;
            }
            if (!/^[A-Za-z0-9_]+$/.test(gid)) {
                $gidInput.addClass("is-invalid");
                hasError = true;
                window._lastContestGroupCollectErr = window._lastContestGroupCollectErr || {
                    message: "请完整填写赛事归属；归属标识仅允许数字/字母/下划线，且不得重复。",
                    message_en: "Please complete all affiliations. Affiliation ID must be alphanumeric/underscore and unique."
                };
            }
            if (gidMap[gid]) {
                $gidInput.addClass("is-invalid");
                gidMap[gid].addClass("is-invalid");
                hasError = true;
                window._lastContestGroupCollectErr = window._lastContestGroupCollectErr || {
                    message: "请完整填写赛事归属；归属标识仅允许数字/字母/下划线，且不得重复。",
                    message_en: "Please complete all affiliations. Affiliation ID must be alphanumeric/underscore and unique."
                };
            } else {
                gidMap[gid] = $gidInput;
            }
            const qty = $tr.find(".flg_award_qty_mode").prop("checked") ? 1 : 0;
            const ag = coalesceInt($gold.val(), 10);
            const aslv = coalesceInt($silv.val(), 15);
            const ab = coalesceInt($brnz.val(), 20);
            const aerr = validateContestGroupAwardTriple(ag, aslv, ab, qty);
            if (aerr) {
                hasError = true;
                if (!window._lastContestGroupCollectErr) {
                    window._lastContestGroupCollectErr = { message: aerr.message, message_en: aerr.message_en };
                }
                if (qty === 1) {
                    if (ag < 0) $gold.addClass("is-invalid");
                    if (aslv < 0) $silv.addClass("is-invalid");
                    if (ab < 0) $brnz.addClass("is-invalid");
                } else {
                    if (ag < 0 || ag > 100) $gold.addClass("is-invalid");
                    if (aslv < 0 || aslv > 100) $silv.addClass("is-invalid");
                    if (ab < 0 || ab > 100) $brnz.addClass("is-invalid");
                    if (ag + aslv + ab > 100) {
                        $gold.add($silv).add($brnz).addClass("is-invalid");
                    }
                }
            }
            ret.push({
                group_id: gid,
                group_name: gname,
                group_order: idx,
                flg_award_qty_mode: qty,
                award_ratio_gold: ag,
                award_ratio_silver: aslv,
                award_ratio_bronze: ab,
                topteam: coalesceInt($tr.find(".cg-topteam").val(), 1)
            });
        });
        refreshDefaultRowReadonly();
        refreshDeleteButtons();
        if (ret.length > MAX_CONTEST_GROUPS) {
            hasError = true;
            window._lastContestGroupCollectErr = window._lastContestGroupCollectErr || {
                message: `赛事归属最多 ${MAX_CONTEST_GROUPS} 个。`,
                message_en: `At most ${MAX_CONTEST_GROUPS} affiliations are allowed.`
            };
            if (window.alerty && alerty.error) {
                alerty.error({
                    message: `赛事归属最多 ${MAX_CONTEST_GROUPS} 个。`,
                    message_en: `At most ${MAX_CONTEST_GROUPS} affiliations are allowed.`
                });
            } else {
                alert(`赛事归属最多 ${MAX_CONTEST_GROUPS} 个。`);
            }
        }
        if (hasError) {
            $jsonInput.val("");
            return false;
        }
        if (ret.length > 0) {
            const first = ret[0];
            $("#ratio_gold").val(first.award_ratio_gold);
            $("#ratio_silver").val(first.award_ratio_silver);
            $("#ratio_bronze").val(first.award_ratio_bronze);
            $("#flg_award_qty_mode").val(first.flg_award_qty_mode ? 1 : 0);
            $("#topteam").val(first.topteam);
        }
        $jsonInput.val(JSON.stringify(ret));
        return true;
    }
    function refreshDefaultRowReadonly() {
        const $rows = $tableBody.find("tr");
        if ($rows.length === 0) return;
        const lockDefaultName = $rows.length <= 1;
        $rows.each(function (idx) {
            const $tr = $(this);
            const $name = $tr.find(".cg-group-name");
            if (idx === 0) {
                if (!$tr.find(".cg-group-id").val()) $tr.find(".cg-group-id").val("default");
                if (!$name.val()) $name.val("默认赛事");
                $name.prop("readonly", lockDefaultName);
            }
        });
    }
    function refreshDeleteButtons() {
        const rowCnt = $tableBody.find("tr").length;
        const canDelete = rowCnt > 1;
        $tableBody.find(".cg-del").each(function () {
            const $btn = $(this);
            if (canDelete) {
                $btn.prop("disabled", false).css("display", "").removeClass("d-none");
            } else {
                $btn.prop("disabled", true).css("display", "none").addClass("d-none");
            }
        });
    }
    function appendDefaultRowForCreate() {
        $tableBody.append(makeRow({
            group_id: "default",
            group_name: "默认赛事",
            flg_award_qty_mode: coalesceInt($("#flg_award_qty_mode").val(), 0),
            award_ratio_gold: coalesceInt($("#ratio_gold").val(), 10),
            award_ratio_silver: coalesceInt($("#ratio_silver").val(), 15),
            award_ratio_bronze: coalesceInt($("#ratio_bronze").val(), 20),
            topteam: coalesceInt($("#topteam").val(), 1)
        }));
    }
    function reloadFromServer() {
        const cid = $.trim($("#id_input").val() || "");
        if (!cid) {
            // 新建比赛：前端初始化默认赛事归属
            $tableBody.empty();
            appendDefaultRowForCreate();
            collectRows();
            initContestGroupCsgSwitches();
            return;
        }
        // 编辑比赛：仅以后端统一兼容层返回为准，不做前端隐式兜底
        $.getJSON(`__ADMIN__/contest/contest_group_list_ajax?cid=${encodeURIComponent(cid)}`, function (rows) {
            $tableBody.empty();
            const list = Array.isArray(rows) ? rows : [];
            if (list.length === 0) {
                if (window.alerty && alerty.error) {
                    alerty.error({
                        message: "赛事归属配置加载为空，请检查后端兼容层返回。",
                        message_en: "Affiliation config response is empty. Please check backend compatibility layer."
                    });
                } else {
                    alert("赛事归属配置加载为空，请检查后端兼容层返回。");
                }
                return;
            }
            list.forEach(function (r) { $tableBody.append(makeRow(r)); });
            collectRows();
            initContestGroupCsgSwitches();
        }).fail(function () {
            if (window.alerty && alerty.error) {
                alerty.error({
                    message: "赛事归属配置加载失败，请重试或检查后端接口。",
                    message_en: "Failed to load affiliation config. Please retry or check backend API."
                });
            } else {
                alert("赛事归属配置加载失败，请重试或检查后端接口。");
            }
        });
    }
    $("#btn_add_contest_group").on("click", function () {
        if ($tableBody.find("tr").length >= MAX_CONTEST_GROUPS) {
            if (window.alerty && alerty.error) {
                alerty.error({
                    message: `赛事归属最多 ${MAX_CONTEST_GROUPS} 个，不能继续新增。`,
                    message_en: `At most ${MAX_CONTEST_GROUPS} affiliations are allowed.`
                });
            } else {
                alert(`赛事归属最多 ${MAX_CONTEST_GROUPS} 个，不能继续新增。`);
            }
            return;
        }
        $tableBody.append(makeRow({
            group_id: generateAffiliationId(),
            group_name: generateAffiliationName(),
            flg_award_qty_mode: coalesceInt($("#flg_award_qty_mode").val(), 0),
            award_ratio_gold: coalesceInt($("#ratio_gold").val(), 10),
            award_ratio_silver: coalesceInt($("#ratio_silver").val(), 15),
            award_ratio_bronze: coalesceInt($("#ratio_bronze").val(), 20),
            topteam: coalesceInt($("#topteam").val(), 1)
        }));
        collectRows();
        initContestGroupCsgSwitches();
    });
    $tableBody.on("click", ".cg-del", function () {
        if ($tableBody.find("tr").length <= 1) {
            return;
        }
        $(this).closest("tr").remove();
        collectRows();
    });
    $tableBody.on("click", ".cg-copy-down", function () {
        const $btn = $(this);
        const cls = $btn.data("target");
        const $tr = $btn.closest("tr");
        const val = $tr.find(`.${cls}`).val();
        $tr.nextAll("tr").each(function () {
            $(this).find(`.${cls}`).val(val);
        });
        collectRows();
    });
    $tableBody.on("click", ".cg-copy-down-mode", function (e) {
        e.preventDefault();
        const $tr = $(this).closest("tr");
        const checked = $tr.find(".flg_award_qty_mode").prop("checked");
        $tr.nextAll("tr").each(function () {
            const $cb = $(this).find(".flg_award_qty_mode");
            $cb.prop("checked", checked);
            if (window.csgSwitch && $cb[0] && typeof window.csgSwitch.setChecked === "function") {
                window.csgSwitch.setChecked($cb[0], checked);
            }
        });
        collectRows();
    });
    $tableBody.on("input", ".cg-group-id", function () {
        const v = ($(this).val() || "").replace(/[^A-Za-z0-9_]/g, "");
        $(this).val(v);
    });
    $tableBody.on("change input", "input", collectRows);
    window.CsgValidateContestGroups = function () {
        return collectRows();
    };
    $("#contest_edit_form").on("submit", function (e) {
        if (!collectRows()) {
            e.preventDefault();
            const err = window._lastContestGroupCollectErr;
            if (window.alerty && alerty.error) {
                alerty.error(err || {
                    message: "请完整填写赛事归属；归属标识仅允许数字/字母/下划线，且不得重复。",
                    message_en: "Please complete all affiliations. Affiliation ID must be alphanumeric/underscore and unique."
                });
            } else {
                alert((err && err.message) ? err.message : "请完整填写赛事归属；归属标识仅允许数字/字母/下划线，且不得重复。");
            }
        }
    });
    reloadFromServer();
});
</script>
{/if}

    
{js file="__STATIC__/csgoj/contest/admin_contest_edit.js" /}
{if $is_admin_module}
    {css file="__STATIC__/csgoj/admin/contest.css" /}
    {js file="__STATIC__/csgoj/admin/contest.js" /}
    {if $module == 'exadmin'}
        {css file="__STATIC__/exadmin/clss_selector.css" /}
        {js file="__STATIC__/exadmin/clss_selector.js" /}
        <script>
        $(document).ready(function() {
            // 初始化班级选择器
            const isAdmin = <?php echo IsAdmin() ? 'true' : 'false'; ?>;
            const currentUserId = '<?php echo session("user_id") ?: ""; ?>';
            const editMode = <?php echo $edit_mode && !$copy_mode && $has_contest ? 'true' : 'false'; ?>;
            const isCourseAdmin = <?php echo (isset($is_course_admin) && $is_course_admin) ? 'true' : 'false'; ?>;
            const currentClssId = <?php echo ($edit_mode && !$copy_mode && $has_contest && isset($contest['clss_id'])) ? intval($contest['clss_id']) : 'null'; ?>;
            const currentClssTitle = <?php echo ($edit_mode && !$copy_mode && $has_contest && isset($contest['clss_title'])) ? json_encode($contest['clss_title']) : 'null'; ?>;
            const currentClssSemester = <?php echo ($edit_mode && !$copy_mode && $has_contest && isset($contest['clss_semester'])) ? json_encode($contest['clss_semester']) : 'null'; ?>;
            
            // 编辑模式下，如果不是课程管理员，使用只读模式
            const isReadOnly = editMode && !isCourseAdmin;
            // 绑定班级选择数量：
            // - 新增/复制练习：可多选（为多个班级按同一配置创建多场练习）
            // - 编辑练习：只能单选（允许课程管理员更换绑定班级）
            const maxSelect = editMode ? 1 : null;
            
            window.clssSelector = new ClssSelector({
                container: '#clss_selector_wrapper',
                isAdmin: isAdmin,
                currentUserId: currentUserId,
                isCourseAdmin: isCourseAdmin,
                isReadOnly: isReadOnly,
                maxSelect: maxSelect
            });
            
            // 编辑模式下，设置已选班级
            if (editMode) {
                if (isReadOnly && currentClssId) {
                    // 只读模式：显示单个班级信息
                    window.clssSelector.setReadOnlyClss(
                        currentClssId,
                        currentClssTitle || '',
                        currentClssSemester || ''
                    );
                } else if (currentClssId) {
                    // 编辑模式（可编辑）：预置当前绑定班级，避免异步加载前界面空白
                    window.clssSelector.preselectClssInfo(
                        currentClssId,
                        currentClssTitle || '',
                        currentClssSemester || ''
                    );
                }
            }
            if (window.ExpPracticeBatchUi && window.CONTEST_EDIT_CONFIG && window.CONTEST_EDIT_CONFIG.exadmin_add_batch) {
                window.ExpPracticeBatchUi.init();
            }
        });
        </script>
    {/if}
{/if}

{if $is_admin_module && $module == 'exadmin'}
<script type="text/javascript">
window.expTitlePageConfig = <?php echo json_encode([
    'editMode' => !empty($edit_mode),
    'copyMode' => !empty($copy_mode),
    'defaultAuto' => !empty($exp_auto_title_default),
], JSON_UNESCAPED_UNICODE); ?>;
</script>
{js href="__STATIC__/exadmin/contest_edit_exp_title.js" /}
        {css href="__STATIC__/exadmin/contest_edit_exp_batch.css" /}
        {js href="__STATIC__/exadmin/exp_practice_time_cache.js" /}
        {js href="__STATIC__/exadmin/contest_edit_exp_batch.js" /}
{/if}