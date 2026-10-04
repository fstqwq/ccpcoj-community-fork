<div class="admin-page-header sticky-top bg-body" style="z-index:1;">
    <div class="admin-page-header-left">
        <div class="admin-page-header-icon">
            <i class="bi bi-file-earmark-text"></i>
        </div>
        <h1 class="admin-page-header-title">
            <div class="admin-page-header-title-main">
                {if $edit_mode && !(isset($copy_mode) && $copy_mode) }
                    编辑考试
                {elseif isset($copy_mode) && $copy_mode /}
                    复制考试
                {else /}
                    添加考试
                {/if}
            </div>
            <div class="admin-page-header-title-right">
                {if $edit_mode && !(isset($copy_mode) && $copy_mode) }
                <a href="/examsys/contest/contest?cid={$contest['contest_id']}" target="_blank" class="admin-page-header-id">
                    <i class="bi bi-hash"></i> {$contest['contest_id']}
                </a>
                {/if}
                {if $edit_mode && !(isset($copy_mode) && $copy_mode) }
                    <span class="en-text">Edit Exam</span>
                {elseif isset($copy_mode) && $copy_mode /}
                    <span class="en-text">Copy Exam</span>
                {else /}
                    <span class="en-text">Add Exam</span>
                {/if}
            </div>
        </h1>
    </div>
    
    {if $edit_mode && !(isset($copy_mode) && $copy_mode) }
    <div class="admin-page-header-actions">
        {if request()->module()=='exadmin' && strtolower(request()->controller())=='exam'}
        <button type="button" class="btn btn-success btn-sm bilingual-button" 
                data-modal-url="/exadmin/filemanager/filemanager?item=contest&id={$contest['contest_id']}" 
                data-modal-title="附件管理 - 考试 #{$contest['contest_id']} - {$contest['title']|mb_substr=0,150,'utf-8'}..."
                title="附件管理 (File Manager)">
            <span class="cn-text"><i class="bi bi-paperclip"></i> 附件</span><span class="en-text">Attach</span>
        </button>
        <?php $defunct = $contest['defunct']; $item_id = $contest['contest_id']; $item_name="contest"; ?>
        {include file="../../admin/view/admin/changestatus_button" /}
        {/if}
        <button type="submit" form="contest_edit_form" class="btn btn-primary btn-sm submit_button bilingual-button" id="submit_button">
            <span class="cn-text"><i class="bi bi-save"></i> 保存</span><span class="en-text">Save</span>
        </button>
    </div>
    {else /}
    <div class="admin-page-header-actions">
        <button type="submit" form="contest_edit_form" class="btn btn-primary btn-sm submit_button bilingual-button" id="submit_button">
            <span class="cn-text"><i class="bi bi-plus-circle"></i> 添加</span><span class="en-text">Add</span>
        </button>
    </div>
    {/if}
</div>

<form
    id="contest_edit_form"
    class="admin-form"
    method="post"
    action="{if request()->module()=='exadmin' && strtolower(request()->controller())=='exam'}/exadmin/exam/contest_edit_ajax{else/}/{:request()->module()}/admin/contest_edit_ajax?cid={$contest['contest_id']}{/if}"
>
    <div class="container">
        <input type="hidden" id="tpl_is_exadmin_exam" value="{if request()->module()=='exadmin' && strtolower(request()->controller())=='exam'}1{else/}0{/if}">
        <input type="hidden" id="tpl_is_edit" value="{if $edit_mode && !(isset($copy_mode) && $copy_mode) }1{else/}0{/if}">
        <input type="hidden" id="tpl_can_write" value="{if isset($can_write)}{if $can_write}1{else/}0{/if}{else/}1{/if}">
        {if isset($can_write) && !$can_write && $edit_mode && !(isset($copy_mode) && $copy_mode)}
            <div class="alert alert-warning mt-3 mb-0">
                当前为只读查看：你可以复制该考试，但不可直接修改（仅可管理自己发起的考试）。
                <span class="en-text">Read-only: you can copy this exam, but cannot modify it (only exams you created are editable).</span>
            </div>
        {/if}
        {if request()->module()=='exadmin' && strtolower(request()->controller())=='exam'}
        <div class="form-group">
            <label for="title" class="bilingual-label">考试标题：<span class="en-text">Exam Title</span></label>
            <input type="text" class="form-control" id="input_title" placeholder="输入考试标题... / Enter exam title..." name="title" {if $edit_mode}value="{$contest['title']|htmlspecialchars}"{/if}>
        </div>
        
        <div class="form-group" style="display:none;">
            <label for="teachers" class="bilingual-label">合作教师（逗号分隔用户ID）：<span class="en-text">Cooperative Teachers (comma-separated user IDs)</span></label>
            <input type="text" class="form-control" id="input_teachers" placeholder="输入用户ID，用逗号分隔... / Enter user IDs, separated by commas..." name="teachers" {if $edit_mode && !(isset($copy_mode) && $copy_mode)}value="{$teachers|htmlspecialchars}"{/if}>
            <div class="form-text">
                <span class="bilingual-inline">
                    <span>每行或逗号分隔一个用户ID，最多10个</span>
                    <span class="en-text">One user ID per line or comma-separated, maximum 10</span>
                </span>
            </div>
        </div>
        {if isset($can_edit_manage_list) && $can_edit_manage_list && isset($course_key_for_owners)}
        <div class="form-group">
            <label class="bilingual-label">可管理此考试的人 <span class="en-text">Exam Managers</span></label>
            <div class="form-text mb-2">
                <span class="bilingual-inline">
                    <span>仅负责人(owner)可修改。从本课程教师中多选，选中者具有编辑、考生状态、附件等权限，但不能修改本列表。负责人不可被选为可管理人。</span>
                    <span class="en-text">Only owners can edit. Select course teachers as managers (same rights except cannot edit this list). Owners cannot be added as managers.</span>
                </span>
            </div>
            <script>
            window.EXAM_MANAGE_INIT = {
                courseKey: <?php echo json_encode(isset($course_key_for_owners) ? $course_key_for_owners : ''); ?>,
                manageList: <?php echo json_encode(isset($manage_list) ? $manage_list : []); ?>,
                ownerList: <?php echo json_encode(isset($owner_list) ? $owner_list : []); ?>
            };
            </script>
            <div id="exam_manage_selector_wrapper"></div>
            <input type="hidden" name="manage_ids" id="manage_ids_input" value="<?php echo htmlspecialchars(isset($manage_list) && is_array($manage_list) ? implode(',', $manage_list) : ''); ?>">
        </div>
        {/if}
        {/if}
        
        <div class="row g-3">
            <div class="col-12 col-md-6">
                <div class="form-group mb-0">
                    <label class="bilingual-label csg-contest-edit-time-label" id="csg-contest-edit-label-start" for="start_year"><span class="csg-contest-edit-time-label__main">开始时间：<span class="en-text">Start Time</span></span></label>
                    <div class="row g-2">
                        <div class="col-auto">
                            <label for="start_year" class="form-label bilingual-inline">年<span class="en-text">Year</span></label>
                            <input type="text" class="form-control" id="start_year" name="start_year" style="width:80px;" placeholder="年" title="年 (Year)" value="{$start_year}">
                        </div>
                        <div class="col-auto">
                            <label for="start_month" class="form-label bilingual-inline">月<span class="en-text">Month</span></label>
                            <input type="text" class="form-control" id="start_month" name="start_month" style="width:50px;" placeholder="月" title="月 (Month)" value="{$start_month}">
                        </div>
                        <div class="col-auto">
                            <label for="start_day" class="form-label bilingual-inline">日<span class="en-text">Day</span></label>
                            <input type="text" class="form-control" id="start_day" name="start_day" style="width:50px;" placeholder="日" title="日 (Day)" value="{$start_day}">
                        </div>
                        <div class="col-auto">
                            <label for="start_hour" class="form-label bilingual-inline">时<span class="en-text">Hour</span></label>
                            <input type="text" class="form-control" id="start_hour" name="start_hour" style="width:50px;" placeholder="时" title="时 (Hour)" value="{$start_hour}">
                        </div>
                        <div class="col-auto">
                            <label for="start_minute" class="form-label bilingual-inline">分<span class="en-text">Minute</span></label>
                            <input type="text" class="form-control" id="start_minute" name="start_minute" style="width:50px;" placeholder="分" title="分 (Minute)" value="{$start_minute}">
                        </div>
                    </div>
                </div>
            </div>
            
            <div class="col-12 col-md-6">
                <div class="form-group mb-0">
                    <label class="bilingual-label csg-contest-edit-time-label" id="csg-contest-edit-label-end" for="end_year"><span class="csg-contest-edit-time-label__main">结束时间：<span class="en-text">End Time</span></span></label>
                    <div class="row g-2">
                        <div class="col-auto">
                            <label for="end_year" class="form-label bilingual-inline">年<span class="en-text">Year</span></label>
                            <input type="text" class="form-control" id="end_year" name="end_year" style="width:80px;" placeholder="年" title="年 (Year)" value="{$end_year}">
                        </div>
                        <div class="col-auto">
                            <label for="end_month" class="form-label bilingual-inline">月<span class="en-text">Month</span></label>
                            <input type="text" class="form-control" id="end_month" name="end_month" style="width:50px;" placeholder="月" title="月 (Month)" value="{$end_month}">
                        </div>
                        <div class="col-auto">
                            <label for="end_day" class="form-label bilingual-inline">日<span class="en-text">Day</span></label>
                            <input type="text" class="form-control" id="end_day" name="end_day" style="width:50px;" placeholder="日" title="日 (Day)" value="{$end_day}">
                        </div>
                        <div class="col-auto">
                            <label for="end_hour" class="form-label bilingual-inline">时<span class="en-text">Hour</span></label>
                            <input type="text" class="form-control" id="end_hour" name="end_hour" style="width:50px;" placeholder="时" title="时 (Hour)" value="{$end_hour}">
                        </div>
                        <div class="col-auto">
                            <label for="end_minute" class="form-label bilingual-inline">分<span class="en-text">Minute</span></label>
                            <input type="text" class="form-control" id="end_minute" name="end_minute" style="width:50px;" placeholder="分" title="分 (Minute)" value="{$end_minute}">
                        </div>
                    </div>
                </div>
            </div>
        </div>
        
        {if request()->module()=='exadmin' && strtolower(request()->controller())=='exam'}
        <div class="row g-3">
            <div class="col-12 col-md-6">
                <div class="form-group mb-0">
                    <label class="bilingual-label">是否有附加题：<span class="en-text">Has Additional Problems</span></label>
                    <div class="form-check form-check-inline">
                        <input class="form-check-input" name="attach_pro" type="radio" value="1" id="attach_pro_yes" {if !$edit_mode || !isset($protected) || intval($protected / 10) == 1} checked {/if}>
                        <label class="form-check-label" for="attach_pro_yes">是<span class="en-text">Yes</span></label>
                    </div>
                    <div class="form-check form-check-inline">
                        <input class="form-check-input" name="attach_pro" type="radio" value="0" id="attach_pro_no" {if $edit_mode && isset($protected) && intval($protected / 10) == 0} checked {/if}>
                        <label class="form-check-label" for="attach_pro_no">否<span class="en-text">No</span></label>
                    </div>
                </div>
            </div>
            
            <div class="col-12 col-md-6">
                <div class="form-group mb-0">
                    <label class="bilingual-label" title="限制单IP登录">是否锁IP：<span class="en-text">Lock IP</span></label>
                    <div class="form-check form-check-inline">
                        <input class="form-check-input" name="ip_rt" type="radio" value="1" id="ip_rt_yes" {if !$edit_mode || !isset($contest['topteam']) || intdiv($contest['topteam'], 10000) == 1} checked {/if}>
                        <label class="form-check-label" for="ip_rt_yes">是<span class="en-text">Yes</span></label>
                    </div>
                    <div class="form-check form-check-inline">
                        <input class="form-check-input" name="ip_rt" type="radio" value="0" id="ip_rt_no" {if $edit_mode && isset($contest['topteam']) && intdiv($contest['topteam'], 10000) == 0} checked {/if}>
                        <label class="form-check-label" for="ip_rt_no">否<span class="en-text">No</span></label>
                    </div>
                </div>
            </div>
        </div>

        <div class="row g-3 mt-0">
            <div class="col-12 col-md-6">
                <div class="form-group mb-0">
                    <label class="bilingual-label" title="仅影响考试答题页 / Only affects the exam answering page">
                        是否打乱选择题选项顺序：<span class="en-text">Shuffle Choice Options</span>
                    </label>
                    <div class="form-check form-check-inline">
                        <input class="form-check-input" name="shuffle_choice" type="radio" value="1" id="shuffle_choice_yes" {if isset($contest['shuffle_choice']) && intval($contest['shuffle_choice']) == 1} checked {/if}>
                        <label class="form-check-label" for="shuffle_choice_yes">是<span class="en-text">Yes</span></label>
                    </div>
                    <div class="form-check form-check-inline">
                        <input class="form-check-input" name="shuffle_choice" type="radio" value="0" id="shuffle_choice_no" {if !isset($contest['shuffle_choice']) || intval($contest['shuffle_choice']) == 0} checked {/if}>
                        <label class="form-check-label" for="shuffle_choice_no">否<span class="en-text">No</span></label>
                    </div>
                    <div class="form-text">
                        <span class="bilingual-inline">
                            <span>开启后：考生在答题页看到的单选/多选选项将稳定乱序显示；但提交保存仍对应原选项（不影响判题/统计）。仅在“考试答题页”生效，不影响预览/阅卷/导出。</span>
                            <span class="en-text">When enabled: single/multiple choice options are shown in a stable shuffled order on the exam answering page, but submissions are still mapped to the original options (no impact on judging/statistics). Only applies to the exam answering page, not preview/review/export.</span>
                        </span>
                    </div>
                </div>
            </div>
        </div>
        {/if}
        
        <div class="form-group">
            <label class="bilingual-label">允许的编程语言：<span class="en-text">Allowed Programming Languages</span></label>
            <div class="row g-2">
                {foreach($ojLang as $k=>$val) }
                <div class="col-auto">
                    <div class="form-check">
                        <input class="form-check-input" type="checkbox" name="lang[]" value={$k} id="language_checkbox_{$val}" {if ($contest['langmask'] >> $k) & 1}checked{/if}>
                        <label class="form-check-label" for="language_checkbox_{$val}">{$val}</label>
                    </div>
                </div>
                {/foreach}
            </div>
            <div class="form-text">
                <span class="bilingual-inline">
                    <span>选择允许在此考试中使用的编程语言</span>
                    <span class="en-text">Select programming languages allowed in this exam</span>
                </span>
            </div>
        </div>
        
        <div class="row g-3">
            <div class="col-12 col-lg-6">
                <div class="form-group">
                    <label for="description" class="bilingual-label">
                        考试说明<span class="en-text">Exam Description</span>
                        <small class="text-muted d-block mt-1">
                            <span>
                                <span>（考试首页显示，用于考试规则、题目说明等）</span>
                                <span class="en-text">(Displayed on exam homepage for rules, problem descriptions, etc.)</span>
                            </span>
                        </small>
                    </label>
                    <div id="description_editor_container" style="min-height: 400px;"></div>
                    <textarea id="input_description" class="form-control d-none" name="description" style="display:none;">{if $edit_mode}{if isset($contest['description'])}{$contest['description']|htmlspecialchars}{/if}{/if}</textarea>
                    <div class="form-text">
                        <span class="bilingual-inline">
                            <span>支持 Markdown 格式</span>
                            <span class="en-text">Markdown format supported</span>
                        </span>
                    </div>
                </div>
            </div>
            <div class="col-12 col-lg-6">
                <div class="form-group">
                    <label for="notification" class="bilingual-label">
                        公告<span class="en-text">Announcement</span>
                        <small class="text-muted d-block mt-1">
                            <span >
                                <span>（考试进行中的公告，在答题页面右侧显示）</span>
                                <span class="en-text">(Announcements during the exam, displayed on the right side of the exam page)</span>
                            </span>
                        </small>
                    </label>
                    <div id="notification_editor_container" style="min-height: 400px;"></div>
                    <textarea id="input_notification" class="form-control d-none" name="notification" style="display:none;">{if $edit_mode}{if isset($contest['notification'])}{$contest['notification']|htmlspecialchars}{/if}{/if}</textarea>
                    <div class="form-text">
                        <span class="bilingual-inline">
                            <span>支持 Markdown 格式</span>
                            <span class="en-text">Markdown format supported</span>
                        </span>
                    </div>
                </div>
            </div>
        </div>
        {if request()->module()=='exadmin' && strtolower(request()->controller())=='exam' && (!$edit_mode || (isset($copy_mode) && $copy_mode))}
            <input type="hidden" name="course_key" value="{$NOW_COURSE_KEY}">
        {/if}
    </div>
    {if request()->module()=='exadmin' && strtolower(request()->controller())=='exam' && $edit_mode && !(isset($copy_mode) && $copy_mode)}
        <input type="hidden" id='id_input' value="{$contest['contest_id']}" name="contest_id">
    {/if}

    {if request()->module()=='exadmin' && strtolower(request()->controller())=='exam'}
    <textarea type="text" class="form-control" name="question_json_text_real" id="question_json_text_real" style="display:none"></textarea>
    {/if}
</form>
{if request()->module()=='exadmin' && strtolower(request()->controller())=='exam'}
{include file="../../exadmin/view/exam/contest_question_select" /}
{/if}
{include file="../../csgoj/view/public/pkg_vditor" /}
{if isset($can_edit_manage_list) && $can_edit_manage_list && isset($course_key_for_owners)}
{include file="../../csgoj/view/public/dual_list_selector" /}
{js file="__STATIC__/exadmin/exam_manage_selector_init.js" /}
{/if}
{js href="__STATIC__/exadmin/exam_edit.js" /}

