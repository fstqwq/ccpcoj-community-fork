{/*
  可复用：班级选择器工具栏（search / refresh / clear / mine filter）

  可配置参数：
  - clss_toolbar_id
  - clss_toolbar_prefix（用于生成 input/button id，避免冲突）
  - clss_toolbar_show_only_mine（默认 true：显示“仅我的”筛选）
*/}
<?php
    $clss_toolbar_id = isset($clss_toolbar_id) ? $clss_toolbar_id : 'clss_select_toolbar';
    $clss_toolbar_prefix = isset($clss_toolbar_prefix) ? $clss_toolbar_prefix : 'clss_select';
    $clss_toolbar_show_only_mine = isset($clss_toolbar_show_only_mine) ? !!$clss_toolbar_show_only_mine : true;
?>

<div id="{$clss_toolbar_id}" class="table-toolbar">
    <div class="d-flex align-items-center gap-2 flex-wrap" role="form">
        <button id="{$clss_toolbar_prefix}_refresh" type="button" class="btn btn-outline-secondary toolbar-btn" title="刷新 (Refresh)">
            <i class="bi bi-arrow-clockwise"></i>
        </button>
        <button id="{$clss_toolbar_prefix}_clear" type="button" class="btn btn-outline-secondary toolbar-btn" title="清空筛选条件 (Clear)">
            <i class="bi bi-eraser"></i>
        </button>

        {if $clss_toolbar_show_only_mine}
        <div class="form-check ms-2">
            <input class="form-check-input" type="checkbox" value="" id="{$clss_toolbar_prefix}_only_mine">
            <label class="form-check-label" for="{$clss_toolbar_prefix}_only_mine">
                仅我的<span class="en-text">Mine</span>
            </label>
        </div>
        {/if}

        <div class="input-group" style="width: 280px;">
            <span class="input-group-text"><i class="bi bi-search"></i></span>
            <input
                id="{$clss_toolbar_prefix}_search_input"
                class="form-control"
                type="text"
                placeholder="搜索班级/ID/学期..."
                title="Search class/ID/semester"
            >
            <button class="btn btn-outline-secondary" type="button" id="{$clss_toolbar_prefix}_search_btn" title="搜索 (Search)">
                搜索<span class="en-text">Search</span>
            </button>
        </div>
    </div>
</div>


