<!-- 题号输入组件样式和脚本 -->
{css href="__STATIC__/csgoj/csg_modal_window_scroll.css" /}
{css href="__STATIC__/csgoj/components/problem_chips_input.css" /}
{js href="__STATIC__/csgoj/csg_bstable_pickorder.js" /}
{js href="__STATIC__/csgoj/components/problem_chips_input.js" /}

<script>

// 延迟初始化题目选择器，确保模态框元素已存在
$(document).ready(function() {
    // 延迟一点时间确保所有元素都已渲染
    setTimeout(function() {
        initProblemSelectionModal();
    }, 100);
});
</script>
<div class="modal fade csg-modal-window-scroll" id="problemSelectionModal" tabindex="-1" aria-labelledby="problemSelectionModalLabel" aria-hidden="true">
    <div class="modal-dialog modal-xl">
        <div class="modal-content">
            <div class="modal-header">
                <h5 class="modal-title" id="problemSelectionModalLabel">
                    <i class="bi bi-list-check me-2"></i>题目选择器（单击累加；Shift 区间顺序与模板选择器一致，当前页内）<span class="en-text text-muted fs-6">(Additive; Shift range on current page)</span>
                </h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div class="modal-body">
                <!-- 复用题目列表页面，设置为选择器模式 -->
                <?php 
                $prolist_mode = 'selection';
                $table_prefix = 'problem';
                $table_id = 'problemSelectionTable';
                $ajax_url = '/' . $module . '/problem/problem_list_ajax';
                $search_placeholder = '题号/标题/来源/作者';
                $page_size = 25;
                $cookie_expire = '5mi';
                $cookie_suffix = '';
                $filter_selectors = ['spj', 'defunct'];
                $custom_handlers = '';
                $search_spj = -1;
                ?>
                {include file="../../csgoj/view/problemset/problem_list_common" /}
            </div>
            <div class="modal-footer flex-column align-items-stretch gap-2">
                <div class="small text-muted border rounded px-2 py-1">
                    <div>已选 <strong id="selectedCountFooter">0</strong> 题 <span class="en-text">selected</span></div>
                    <div id="problemPickerPickIds" class="font-monospace text-break" style="max-height: 4rem; overflow-y: auto" title="按勾选顺序的题号">—</div>
                </div>
                <div class="d-flex justify-content-end w-100 gap-2">
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">取消</button>
                    <button type="button" class="btn btn-primary" id="confirmSelection">
                        <i class="bi bi-check-circle"></i> 确认选择
                    </button>
                </div>
            </div>
        </div>
    </div>
</div>