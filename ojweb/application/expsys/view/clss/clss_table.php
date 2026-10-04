
{/*
  可复用：班级列表表格组件（table only）

  用法：
  - 作为普通“班级列表页”的 table：配合外部 toolbar / data-url
  - 作为“班级选择器”的 table：data-click-to-select + checkbox + singleSelect

  可配置参数（外部 assign / include 前设置）：
  - clss_table_id
  - clss_table_ajax_url
  - clss_table_toolbar_id
  - clss_table_side_pagination: 'client' | 'server'
  - clss_table_page_size
  - clss_table_page_list
  - clss_table_search: bool（启用 bootstrap-table 内置搜索框）
  - clss_table_show_checkbox: bool
  - clss_table_single_select: bool（仅在 show_checkbox 时生效）
  - clss_table_query_params: string（bootstrap-table query-params 处理函数名）
  - clss_table_response_handler: string（bootstrap-table response-handler，适配接口返回 code/msg/data 包装）
  - clss_title_formatter: string（默认 FormatterExpClssTitle）
  - clss_semester_formatter: string（默认 FormatterExpSemester）
*/}
<?php
    $clss_table_id = isset($clss_table_id) ? $clss_table_id : 'clss_list_table';
    // 注意：模板引擎会扫描“模板变量输出标记”（甚至可能出现在注释里），
    // 所以这里统一用纯 PHP 拼接默认 URL，并做兜底保证变量一定存在。
    if (!isset($clss_table_ajax_url) || $clss_table_ajax_url === '') {
        $m = isset($module) && $module ? $module : 'expsys';
        $c = isset($controller) && $controller ? $controller : 'clss';
        $clss_table_ajax_url = '/' . $m . '/' . $c . '/clss_list_ajax';
    }
    $clss_table_toolbar_id = isset($clss_table_toolbar_id) ? $clss_table_toolbar_id : '';
    $clss_table_side_pagination = isset($clss_table_side_pagination) ? $clss_table_side_pagination : 'client';
    $clss_table_page_size = isset($clss_table_page_size) ? intval($clss_table_page_size) : 50;
    $clss_table_page_list = isset($clss_table_page_list) ? $clss_table_page_list : '[10, 50, 100]';
    $clss_table_search = isset($clss_table_search) ? !!$clss_table_search : false;
    $clss_table_show_checkbox = isset($clss_table_show_checkbox) ? !!$clss_table_show_checkbox : false;
    $clss_table_single_select = isset($clss_table_single_select) ? !!$clss_table_single_select : false;
    $clss_table_query_params = isset($clss_table_query_params) ? $clss_table_query_params : '';
    $clss_table_response_handler = isset($clss_table_response_handler) ? $clss_table_response_handler : '';
    $clss_title_formatter = isset($clss_title_formatter) && $clss_title_formatter ? $clss_title_formatter : 'FormatterExpClssTitle';
    $clss_semester_formatter = isset($clss_semester_formatter) && $clss_semester_formatter ? $clss_semester_formatter : 'FormatterExpSemester';
    $clss_table_show_modify = isset($clss_table_show_modify) ? !!$clss_table_show_modify : false;
    $clss_table_show_archive = isset($clss_table_show_archive) ? !!$clss_table_show_archive : false;
?>

<table
    class="bootstraptable_refresh_local table table-borderless table-hover table-striped"
    id="{$clss_table_id}"
    data-url="{$clss_table_ajax_url}"
    data-toggle="table"
    data-pagination="true"
    data-page-list="{$clss_table_page_list}"
    data-page-size="{$clss_table_page_size}"
    data-side-pagination="{$clss_table_side_pagination}"
    data-method="get"
    data-unique-id="clss_id"
    data-sort-name="clss_id"
    data-sort-order="desc"
    data-sort-stable="true"
    data-pagination-v-align="both"
    data-pagination-h-align="left"
    data-pagination-detail-h-align="right"
    data-click-to-select="{if $clss_table_show_checkbox}true{else/}false{/if}"
    data-single-select="{if $clss_table_show_checkbox && $clss_table_single_select}true{else/}false{/if}"
    data-multiple-select-row="{if $clss_table_show_checkbox && !$clss_table_single_select}true{else/}false{/if}"
    data-maintain-meta-data="{if $clss_table_show_checkbox}true{else/}false{/if}"
    data-search="{if $clss_table_search}true{else/}false{/if}"
    {if $clss_table_search}data-search-align="left"{/if}
    {if $clss_table_toolbar_id}data-toolbar="#{$clss_table_toolbar_id}"{/if}
    {if $clss_table_query_params}data-query-params="{$clss_table_query_params}"{/if}
    {if $clss_table_response_handler}data-response-handler="{$clss_table_response_handler}"{/if}
>
    <thead>
    <tr>
        {if $clss_table_show_checkbox}
        <th data-field="state" data-checkbox="true" data-width="40" title="勾选；Shift+点击行可连选 (Shift+click row for range)"></th>
        {/if}
        <th data-field="clss_id"    data-align="center" data-valign="middle" data-sortable="true" data-width="80">
            班级ID<span class="en-text">Class ID</span>
        </th>
        <th data-field="clss_title" data-align="left" data-valign="middle" data-formatter="{$clss_title_formatter}">
            <span class="cn-text">教学班级名称</span>
            <span class="en-text">Class Name</span>
        </th>
        <th data-field="clss_year"  data-align="center" data-valign="middle" data-sortable="true" data-width="90">
            <span class="cn-text">年级</span>
            <span class="en-text">Year</span>
        </th>
        <th data-field="clss_semester" data-align="center" data-valign="middle" data-sortable="true" data-width="130" data-formatter="{$clss_semester_formatter}">
            <span class="cn-text">学期</span>
            <span class="en-text">Semester</span>
        </th>
        {if $clss_table_show_modify}
        <th data-field="modify" data-align="center" data-valign="middle" data-sortable="false" data-width="80" data-formatter="FormatterClssModify">
            <span class="cn-text">编辑</span>
            <span class="en-text">Edit</span>
        </th>
        {/if}
        {if $clss_table_show_archive}
        <th data-field="archive" data-align="center" data-valign="middle" data-sortable="false" data-width="80" data-formatter="FormatterClssArchive">
            <span class="cn-text">归档</span>
            <span class="en-text">Archive</span>
        </th>
        {/if}
    </tr>
    </thead>
</table>


