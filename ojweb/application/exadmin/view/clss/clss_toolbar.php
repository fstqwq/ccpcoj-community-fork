<div id="clss_toolbar" class="table-toolbar">
    <div class="d-flex align-items-center gap-2 flex-wrap" role="form">
        <button id="clss_refresh" type="button" class="btn btn-outline-secondary toolbar-btn" title="刷新 (Refresh)">
            <i class="bi bi-arrow-clockwise"></i>
        </button>
        <button id="clss_clear" type="button" class="btn btn-outline-secondary toolbar-btn" title="清空筛选条件 (Clear)">
            <i class="bi bi-eraser"></i>
        </button>
        <div class="toolbar-group">
            <input id="clss_id_input" name="clss_id" class="form-control toolbar-input clss_filter" type="text" style="max-width:100px;" placeholder="班级ID" title="班级ID (Class ID)">
        </div>
        <div class="toolbar-group">
            <input id="clss_title_input" name="clss_title" class="form-control toolbar-input clss_filter" type="text" style="max-width:200px;" placeholder="班级名称" title="班级名称 (Class Name)">
        </div>
        <div class="toolbar-group">
            <input id="clss_year_input" name="clss_year" class="form-control toolbar-input clss_filter" type="number" style="max-width:100px;" placeholder="年级" title="年级 (Year)">
        </div>
        <div class="toolbar-group">
            <input id="clss_semester_input" name="clss_semester" class="form-control toolbar-input clss_filter" type="text" style="max-width:150px;" placeholder="学期" title="学期 (Semester, 格式: 2023-2024-1)" pattern="\d{4}-\d{4}-\d">
        </div>
        <?php
            $clss_list_show_delete = isset($clss_list_show_delete) ? $clss_list_show_delete : false;
        ?>
        {if $clss_list_show_delete}
        <div class="toolbar-group">
            <button id="clss_export_btn" type="button" class="btn btn-outline-success btn-sm toolbar-btn" title="导出选中班级数据 (Export Selected Classes Data)">
                <i class="bi bi-download"></i>
            </button>
        </div>
        <div class="toolbar-group">
            <button id="clss_batch_delete_btn" type="button" class="btn btn-outline-danger btn-sm toolbar-btn" title="批量删除选中班级 (Batch Delete Selected Classes)" disabled>
                <i class="bi bi-trash"></i>
            </button>
        </div>
        {/if}
    </div>
</div>

{include file="../../csgoj/view/public/base_select" /}

