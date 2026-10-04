{/* 
  可复用：题目筛选工具条（Bootstrap5）
  通过 assign 变量定制 id/class，避免写死页面耦合

  必填（建议）：
  - toolbar_id
  - btn_clear_id
  - filter_check_class
  - filter_id_prefix
  - filter_all_id
  - filter_clear_id
  - search_input_id

  可选：
  - toolbar_extra_class
  - show_refresh_btn (bool)
  - btn_refresh_id
  - refresh_title
  - search_placeholder
  - search_width
  - search_input_name
  - search_input_class
  - show_select_all (bool)
  - select_all_id
  - select_all_label_cn
  - select_all_label_en
*/}

<div id="{$toolbar_id|default='question_toolbar'}" class="table-toolbar {$toolbar_extra_class|default=''}">
    <div class="d-flex align-items-center gap-2 flex-wrap" role="form">
        {if isset($show_refresh_btn) && $show_refresh_btn}
            <button id="{$btn_refresh_id|default='question_refresh'}" type="button" class="btn btn-outline-secondary toolbar-btn" title="{$refresh_title|default='刷新 (Refresh)'}">
                <i class="bi bi-arrow-clockwise"></i>
            </button>
        {/if}

        <button id="{$btn_clear_id|default='question_clear'}" type="button" class="btn btn-outline-secondary toolbar-btn" title="清空筛选条件 (Clear)">
            <i class="bi bi-eraser"></i>
        </button>

        <div class="btn-group csg-pkind-filter" role="group" aria-label="Pkind filter">
            <input type="checkbox" class="btn-check {$filter_check_class|default='question_filter_check'}" pkind="0" id="{$filter_id_prefix|default='question'}_filter_0" autocomplete="off" {if isset($pkind_default_checked) && $pkind_default_checked}checked{/if}>
            <label class="btn btn-outline-primary" for="{$filter_id_prefix|default='question'}_filter_0" title="单选">单选<span class="en-text">Single</span></label>

            <input type="checkbox" class="btn-check {$filter_check_class|default='question_filter_check'}" pkind="1" id="{$filter_id_prefix|default='question'}_filter_1" autocomplete="off" {if isset($pkind_default_checked) && $pkind_default_checked}checked{/if}>
            <label class="btn btn-outline-primary" for="{$filter_id_prefix|default='question'}_filter_1" title="多选">多选<span class="en-text">Multi</span></label>

            <input type="checkbox" class="btn-check {$filter_check_class|default='question_filter_check'}" pkind="5" id="{$filter_id_prefix|default='question'}_filter_5" autocomplete="off" {if isset($pkind_default_checked) && $pkind_default_checked}checked{/if}>
            <label class="btn btn-outline-primary" for="{$filter_id_prefix|default='question'}_filter_5" title="判断">判断<span class="en-text">True/False</span></label>

            <input type="checkbox" class="btn-check {$filter_check_class|default='question_filter_check'}" pkind="10" id="{$filter_id_prefix|default='question'}_filter_10" autocomplete="off" {if isset($pkind_default_checked) && $pkind_default_checked}checked{/if}>
            <label class="btn btn-outline-primary" for="{$filter_id_prefix|default='question'}_filter_10" title="填空">填空<span class="en-text">Fill</span></label>

            <input type="checkbox" class="btn-check {$filter_check_class|default='question_filter_check'}" pkind="15" id="{$filter_id_prefix|default='question'}_filter_15" autocomplete="off" {if isset($pkind_default_checked) && $pkind_default_checked}checked{/if}>
            <label class="btn btn-outline-primary" for="{$filter_id_prefix|default='question'}_filter_15" title="简答">简答<span class="en-text">Short</span></label>

            <input type="checkbox" class="btn-check {$filter_check_class|default='question_filter_check'}" pkind="20" id="{$filter_id_prefix|default='question'}_filter_20" autocomplete="off" {if isset($pkind_default_checked) && $pkind_default_checked}checked{/if}>
            <label class="btn btn-outline-primary" for="{$filter_id_prefix|default='question'}_filter_20" title="综合">综合<span class="en-text">Comprehensive</span></label>

            <input type="checkbox" class="btn-check {$filter_check_class|default='question_filter_check'}" pkind="25" id="{$filter_id_prefix|default='question'}_filter_25" autocomplete="off" {if isset($pkind_default_checked) && $pkind_default_checked}checked{/if}>
            <label class="btn btn-outline-primary" for="{$filter_id_prefix|default='question'}_filter_25" title="编程">编程<span class="en-text">Programming</span></label>
        </div>

        <div class="btn-group" role="group" aria-label="Filter quick actions">
            <button id="{$filter_all_id|default='question_filter_all'}" type="button" class="btn btn-warning" title="全选 (All)">
                全选<span class="en-text">All</span>
            </button>
            <button id="{$filter_clear_id|default='question_filter_clear'}" type="button" class="btn btn-secondary" title="清空 (Clear)">
                清空<span class="en-text">Clear</span>
            </button>
        </div>

        <div class="toolbar-group">
            <span class="toolbar-label-inline"><span>搜索</span><span class="toolbar-label en-text">Search</span></span>
            <input
                id="{$search_input_id|default='question_search_input'}"
                {if isset($search_input_name) && $search_input_name !== ''}name="{$search_input_name}"{/if}
                class="form-control toolbar-input {$search_input_class|default=''}"
                type="text"
                placeholder="{$search_placeholder|default='题号/标题/来源/作者'}"
                style="width: <?php echo (isset($search_width) && $search_width !== '') ? $search_width : '200px'; ?>;"
            >
        </div>

        {if isset($show_select_all) && $show_select_all}
            <div class="ms-auto d-flex align-items-center gap-2">
                <input type="checkbox" id="{$select_all_id|default='draft_select_all'}">
                <label class="text-muted small mb-0" for="{$select_all_id|default='draft_select_all'}">
                    {$select_all_label_cn|default='全选导出'}<span class="en-text">{$select_all_label_en|default='Select all'}</span>
                </label>
            </div>
        {/if}
    </div>
</div>


