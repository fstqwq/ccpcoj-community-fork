<?php 
// 判断场景：全局状态页面（status/index）还是比赛内状态页面（contest/status）
$is_contest_status = $controller == 'contest';
$is_global_status = !$is_contest_status; // 全局状态页面

// 根据场景设置不同的样式和容器
$problem_id_width = ($module == 'examsys') ? '110px' : '100px';
$problem_id_placeholder = ($module == 'examsys') ? 'Question ID' : 'Pro ID';
$solution_id_placeholder = ($module == 'examsys') ? 'RunID' : 'Run ID';

// 全局状态页面：工具栏放在 page-title-actions 中；比赛内状态页面：工具栏放在 table-toolbar 中
// 比赛内状态页面需要 id="status_toolbar" 供 Bootstrap Table 使用
$toolbar_wrapper_class = $is_contest_status ? 'table-toolbar' : '';
$toolbar_id = $is_contest_status ? 'status_toolbar' : '';
?>
{/* 全局状态页面：工具栏在 page-title-actions 中；比赛内状态页面：工具栏在 table-toolbar 中 */}
{if $is_global_status}
<div class="page-title-actions">
{/if}
<div {if $toolbar_id}id="{$toolbar_id}"{/if} class="{$toolbar_wrapper_class}">
    <div class="d-flex align-items-center gap-2 flex-wrap" role="form">
        <button id="status_refresh" type="button" class="btn btn-outline-secondary toolbar-btn" title="刷新 (Refresh)">
            <i class="bi bi-arrow-clockwise"></i>
        </button>
        <button id="status_clear" type="button" class="btn btn-outline-secondary toolbar-btn" title="清空筛选条件 (Clear)">
            <i class="bi bi-eraser"></i>
        </button>
        <div class="toolbar-group">
            <input id="problem_id_input" name="problem_id" class="form-control toolbar-input status_filter" type="text" value="{$search_problem_id}" style="max-width:{$problem_id_width};" placeholder="{$problem_id_placeholder}" title="题目ID (Problem ID)">
        </div>
        <div class="toolbar-group">
            <input id="user_id_input" name="user_id" class="form-control toolbar-input status_filter" type="text" value="{$search_user_id}" style="max-width:120px;" placeholder="User ID" title="用户ID (User ID)">
        </div>
        <div class="toolbar-group">
            <input id="solution_id_input" name="solution_id" class="form-control toolbar-input status_filter" type="text" value="{$search_solution_id}" style="max-width:100px;" placeholder="{$solution_id_placeholder}" title="提交ID (Solution ID)">
        </div>
        <div class="toolbar-group">
            <div class="csg-select">
                <select name="language" class="csg-select-input form-select toolbar-select status_filter" title="编程语言 (Programming Language)" 
                    {if $is_global_status}style="min-width: 120px;"{/if} data-csg-searchable="false" data-csg-no-scroll="true">
                    <option value="-1" selected="true">
                        All 语言
                    </option>
                    {foreach($allowLanguage as $key=>$value)}
                    <?php
                    // 获取语言颜色配置
                    $langColorConfig = (isset($ojLanguageColor) && isset($ojLanguageColor[$key])) ? $ojLanguageColor[$key] : null;
                    $langColorClass = '';
                    if ($langColorConfig && is_array($langColorConfig) && isset($langColorConfig[0])) {
                        $langColorClass = $langColorConfig[0]; // 颜色类
                    }
                    ?>
                    <option value="{$key}" {if $langColorClass}data-color-class="{$langColorClass}"{/if}>
                        {$value}
                    </option>
                    {/foreach}
                </select>
            </div>
        </div>
        <div class="toolbar-group">
            <div class="csg-select">
                <select name="result" class="csg-select-input form-select toolbar-select status_filter" title="评测结果 (Result)" {if $is_global_status}style="min-width: 120px;"{/if} data-csg-searchable="false" data-csg-no-scroll="true">
                    <option value="-1" {if $search_result == -1}selected="true"{/if}>
                        All 结果
                    </option>
                    {foreach($ojResultsHtml as $key=>$value)}
                    {if($key != 13 && $key != 100)}
                    <?php
                    // 从配置中获取中文名称和英文缩写，格式：中文 + 空格 + 英文缩写
                    // $value 格式：[颜色类, '英文全称', '英文缩写', '中文名称']
                    $cnName = isset($value[3]) ? $value[3] : $value[1]; // 如果有中文名称则使用，否则使用英文全称
                    $shortName = isset($value[2]) ? $value[2] : ''; // 英文缩写
                    $displayText = $shortName ? ($cnName . ' ' . $shortName) : $cnName;
                    // 提取颜色类（去除可能的额外类名，如 'default res_running'）
                    $colorClass = isset($value[0]) ? trim(explode(' ', $value[0])[0]) : '';
                    // 将 'default' 映射为空（不应用颜色），其他保持原样
                    $colorClass = ($colorClass == 'default') ? '' : $colorClass;
                    ?>
                    <option value="{$key}" {if $search_result == $key}selected="true"{/if} {if $colorClass}data-color-class="{$colorClass}"{/if}>
                        {$displayText}
                    </option>
                    {/if}
                    {/foreach}
                </select>
            </div>
        </div>
        <?php
        // 判断是否显示 sim 筛选输入框
        $show_similar_input = false;
        if (isset($contest)) {
            // 比赛内：比赛管理员、源码浏览权限
            $show_similar_input = IsAdmin('contest', $contest['contest_id']) || IsAdmin('source_browser');
            
            // EXP 模式：检查是否是比赛所属课程的 teacher/admin/super
            if (!$show_similar_input && isset($OJ_STATUS) && $OJ_STATUS == 'exp' && function_exists('PrivCourse')) {
                $course_key = GetItemCourseKey($contest, 'contest');
                if ($course_key) {
                    // 注意：PrivCourse('admin') 已包含 super 权限的检查
                    $show_similar_input = PrivCourse('teacher', $course_key) || PrivCourse('admin', $course_key);
                }
            }
        } else {
            // 全局状态页面：管理员或源码浏览权限
            $show_similar_input = IsAdmin() || IsAdmin('source_browser');
        }
        ?>
        {if $show_similar_input}
        <div class="toolbar-group">
            <input id="similar_input" name="similar" placeholder="Similar" class="form-control toolbar-input status_filter" type="number" min="0" max="100" step="1" style="max-width:100px;" title="相似度 (Similarity, 0-100)" data-filter-anchor="similar">
        </div>
        {/if}
    </div>
</div>
{if $is_global_status}
</div>
{/if}

{include file="../../csgoj/view/public/base_select" /}