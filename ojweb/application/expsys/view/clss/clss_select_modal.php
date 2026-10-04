{/*
  可复用：班级选择器 Modal（参考 problem_selection.php 思路）

  可配置参数：
  - clss_select_modal_id
  - clss_select_modal_title_cn/en
  - clss_select_table_id
  - clss_select_ajax_url
  - clss_select_confirm_btn_id
  - clss_select_show_only_mine（是否显示“仅我的”切换）
  - clss_select_title_formatter（默认：FormatterClssSelectTitleWithMine，由 clss_select_modal.js 提供）
*/}
<?php
    $clss_select_modal_id = isset($clss_select_modal_id) ? $clss_select_modal_id : 'clssSelectModal';
    $clss_select_modal_title_cn = isset($clss_select_modal_title_cn) ? $clss_select_modal_title_cn : '选择班级';
    $clss_select_modal_title_en = isset($clss_select_modal_title_en) ? $clss_select_modal_title_en : 'Select Class';
    $clss_select_table_id = isset($clss_select_table_id) ? $clss_select_table_id : 'clssSelectTable';
    $clss_select_confirm_btn_id = isset($clss_select_confirm_btn_id) ? $clss_select_confirm_btn_id : 'clss_select_confirm_btn';
    // 同 clss_table.php：避免模板引擎扫描模板变量输出标记造成异常
    if (!isset($clss_select_ajax_url) || $clss_select_ajax_url === '') {
        $m = isset($module) && $module ? $module : 'expsys';
        $c = isset($controller) && $controller ? $controller : 'clss';
        $clss_select_ajax_url = '/' . $m . '/' . $c . '/clss_list_ajax';
    }
    $clss_select_show_only_mine = isset($clss_select_show_only_mine) ? !!$clss_select_show_only_mine : true;
?>

<div
    class="modal fade"
    id="{$clss_select_modal_id}"
    tabindex="-1"
    aria-hidden="true"
    data-clss-select-table-id="{$clss_select_table_id}"
    data-clss-select-toolbar-prefix="{$clss_select_modal_id}"
    data-clss-select-confirm-btn-id="{$clss_select_confirm_btn_id}"
>
    <div class="modal-dialog modal-xl modal-dialog-scrollable">
        <div class="modal-content">
            <div class="modal-header">
                <h5 class="modal-title bilingual-inline">
                    <span class="cn-text"><i class="bi bi-people me-2"></i>{$clss_select_modal_title_cn}</span>
                    <span class="en-text">{$clss_select_modal_title_en}</span>
                </h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div class="modal-body">
                <?php
                    $clss_toolbar_id = $clss_select_modal_id . '_toolbar';
                    $clss_toolbar_prefix = $clss_select_modal_id;
                    $clss_toolbar_show_only_mine = $clss_select_show_only_mine;
                ?>
                {include file="../../expsys/view/clss/clss_select_toolbar" /}

                <div class="mt-2">
                    <?php
                        // table 组件参数
                        $clss_table_id = $clss_select_table_id;
                        $clss_table_ajax_url = $clss_select_ajax_url;
                        $clss_table_toolbar_id = $clss_toolbar_id;
                        $clss_table_side_pagination = 'client';
                        $clss_table_page_size = 25;
                        $clss_table_page_list = '[25,50,100]';
                        $clss_table_search = false; // 使用自定义 toolbar 搜索
                        $clss_table_show_checkbox = true;
                        $clss_table_single_select = true;
                        // examsys/expsys 后端普遍使用 code/msg/data 包装，bootstrap-table 需要解包
                        $clss_table_response_handler = 'ClssSelectResponseHandler';
                        // 由 clss_select_modal.js 提供 formatter（避免引入 contest_filter.js）
                        $clss_title_formatter = 'FormatterClssSelectTitleWithMine';
                        $clss_semester_formatter = 'FormatterClssSelectSemester';
                    ?>
                    {include file="../../expsys/view/clss/clss_table" /}
                </div>
            </div>
            <div class="modal-footer">
                <div class="d-flex justify-content-between w-100">
                    <div class="text-muted">
                        已选择: <span class="clss-select-selected-count" data-for="{$clss_select_table_id}">0</span> 个班级
                        <span class="en-text">Selected: <span class="clss-select-selected-count" data-for="{$clss_select_table_id}">0</span></span>
                    </div>
                    <div class="d-flex gap-2">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">
                            取消<span class="en-text">Cancel</span>
                        </button>
                        <button type="button" class="btn btn-primary" id="{$clss_select_confirm_btn_id}">
                            <i class="bi bi-check-circle"></i> 确认选择
                            <span class="en-text">Confirm</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    </div>
</div>

{js href="__STATIC__/expsys/clss_select_modal.js" /}


