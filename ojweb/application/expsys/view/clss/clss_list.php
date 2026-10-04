{/*
  兼容入口：原 `clss_list.php` 现在作为“可复用班级表格组件”的薄封装。
  现建议外部直接 include `clss_table.php` 或 `clss_select_modal.php`。
*/}
<?php
    // 兼容老参数名 -> 新组件参数
    $clss_table_id = isset($clss_list_table_id) ? $clss_list_table_id : (isset($clss_table_id) ? $clss_table_id : 'clss_list_table');
    // 同 clss_table.php：避免模板引擎扫描模板变量输出标记造成异常
    $clss_table_ajax_url = isset($clss_list_ajax_url) ? $clss_list_ajax_url : (isset($clss_table_ajax_url) ? $clss_table_ajax_url : '');
    $clss_table_side_pagination = isset($clss_list_side_pagination) ? $clss_list_side_pagination : (isset($clss_table_side_pagination) ? $clss_table_side_pagination : 'client');
    $clss_table_page_size = isset($clss_list_page_size) ? $clss_list_page_size : (isset($clss_table_page_size) ? $clss_table_page_size : 50);
    $clss_table_page_list = isset($clss_list_page_list) ? $clss_list_page_list : (isset($clss_table_page_list) ? $clss_table_page_list : '[10, 50, 100]');
    $clss_table_search = isset($clss_list_search) ? $clss_list_search : (isset($clss_table_search) ? $clss_table_search : false);
    $clss_table_toolbar_id = isset($clss_list_toolbar_id) ? $clss_list_toolbar_id : (isset($clss_table_toolbar_id) ? $clss_table_toolbar_id : '');
    $clss_table_query_params = isset($clss_list_query_params) ? $clss_list_query_params : (isset($clss_table_query_params) ? $clss_table_query_params : '');
    $clss_table_response_handler = isset($clss_list_response_handler) ? $clss_list_response_handler : (isset($clss_table_response_handler) ? $clss_table_response_handler : '');
    $clss_table_show_checkbox = isset($clss_list_show_checkbox) ? $clss_list_show_checkbox : (isset($clss_table_show_checkbox) ? $clss_table_show_checkbox : false);
    // 老页面默认不单选
    $clss_table_single_select = isset($clss_table_single_select) ? $clss_table_single_select : false;
    // 传递编辑列显示标志
    $clss_table_show_modify = isset($clss_table_show_modify) ? !!$clss_table_show_modify : false;
    // 传递归档列显示标志
    $clss_table_show_archive = isset($clss_table_show_archive) ? !!$clss_table_show_archive : false;
?>

{include file="../../expsys/view/clss/clss_table" /}

<script type="text/javascript">
// 设置页面信息变量（替代 page_info hidden input）
window.clssPageInfo = {
    module: "<?php echo $module; ?>",
    controller: "<?php echo $controller; ?>",
    tableUrl: "/<?php echo $module; ?>/<?php echo $controller; ?>/clss_list_ajax"
};
</script>

{css href="__STATIC__/expsys/contest_filter.css" /}

{js href="__STATIC__/expsys/contest_filter.js" /}
{if !isset($clss_list_no_clss_js) || !$clss_list_no_clss_js}
{js href="__STATIC__/expsys/clss.js" /}
{/if}
