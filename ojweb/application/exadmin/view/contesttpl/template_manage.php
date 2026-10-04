<div class="admin-page-header">
    <div class="admin-page-header-left">
        <div class="admin-page-header-icon">
            <i class="bi bi-journal-bookmark"></i>
        </div>
        <h1 class="admin-page-header-title">
            <div class="admin-page-header-title-main">练习模板管理</div>
            <div class="admin-page-header-title-right">
                <span class="en-text">Practice Templates</span>
            </div>
        </h1>
    </div>
    <div class="admin-page-header-actions d-flex flex-wrap gap-2">
        <button type="button" class="btn btn-primary btn-sm" id="btn_tpl_add_open">
            <i class="bi bi-plus-lg"></i>
            <span class="cn-text">添加模板</span><span class="en-text">Add Template</span>
        </button>
    </div>
</div>

<div id="tpl_toolbar" class="table-toolbar mb-2">
    <div class="d-flex flex-wrap align-items-center gap-2">
        <div class="toolbar-group">
            <select name="status" class="form-select form-select-sm tpl_main_filter" title="时间状态 (Time status)" style="min-width: 120px;">
                <option value="-1">全部 <span class="en-text">All</span></option>
                <option value="0">未开始 <span class="en-text">Not started</span></option>
                <option value="1">进行中 <span class="en-text">Running</span></option>
                <option value="2">已结束 <span class="en-text">Ended</span></option>
            </select>
        </div>
        <div class="toolbar-group flex-grow-1" style="min-width: 200px;">
            <input type="text" id="tpl_main_search" class="form-control form-control-sm" placeholder="关键词：源标题 / 模板标题 / 标签 / 练习ID" title="多字段模糊，任一匹配即显示 (Keyword OR across fields)" autocomplete="off">
        </div>
        <button type="button" class="btn btn-outline-secondary btn-sm" id="tpl_main_clear" title="清空筛选 (Clear filters)">
            <i class="bi bi-eraser"></i>
        </button>
        <button type="button" class="btn btn-outline-secondary btn-sm" id="tpl_refresh" title="刷新 (Refresh)">
            <i class="bi bi-arrow-clockwise"></i>
        </button>
        <button type="button" class="btn btn-outline-primary btn-sm btn-csg-filter-more" id="tpl_toggle_filter_sidebar" title="打开或收起侧栏中的更多筛选条件；角标为侧栏内已填附加筛选项数 (Show or hide the sidebar for more filters; badge = count of extra conditions in the sidebar)" aria-label="更多筛选">
            <i class="bi bi-sliders" aria-hidden="true"></i>
            <span class="badge bg-primary ms-1 align-middle" id="tpl_filter_badge" style="display: none;">0</span>
        </button>
        <div class="d-inline-flex align-items-stretch gap-2 tpl-toolbar-equal-actions flex-shrink-0">
        <button type="button" class="btn btn-outline-secondary btn-sm tpl-toolbar-twinline-btn" id="btn_tpl_reindex_selected" disabled title="将勾选行按编号与标题排序后重排为 1…n (Renumber selected)">
            <span class="tpl-toolbar-action-top"><i class="bi bi-sort-numeric-down" aria-hidden="true"></i><span class="cn-text">重排勾选</span></span>
            <span class="en-text">Renumber</span>
        </button>
        <button type="button" class="btn btn-outline-secondary btn-sm tpl-toolbar-twinline-btn" id="btn_tpl_bulk_replace" disabled title="正则批量替换模板标题 (Regex bulk replace template titles)">
            <span class="tpl-toolbar-action-top"><i class="bi bi-code-square" aria-hidden="true"></i><span class="cn-text">批量替换标题</span></span>
            <span class="en-text">Regex replace</span>
        </button>
        <button type="button" class="btn btn-outline-danger btn-sm tpl-toolbar-twinline-btn" id="tpl_batch_demote" title="剔除所选模板 (Remove selected)">
            <span class="tpl-toolbar-action-top"><span class="tpl-toolbar-action-icon-slot" aria-hidden="true"></span><span class="cn-text">剔除所选</span></span>
            <span class="en-text">Remove selected</span>
        </button>
        </div>
    </div>
</div>

<!-- 与练习列表「更多」侧栏同风格，控件 class 仍为 tpl_main_filter 供现有筛选逻辑收集 -->
<div id="tpl_filter_sidebar" class="filter-sidebar tpl-filter-sidebar">
    <div class="filter-sidebar-header">
        <h5 class="filter-sidebar-title">
            <i class="bi bi-funnel me-2"></i>更多筛选<span class="en-text">More filters</span>
        </h5>
        <button type="button" class="btn btn-sm btn-link p-0" id="tpl_filter_sidebar_toggle" title="收起/展开">
            <i class="bi bi-chevron-right"></i>
        </button>
    </div>
    <div class="filter-sidebar-body">
        <div class="filter-section">
            <h6 class="filter-section-title"><i class="bi bi-tags me-2"></i>状态与附加<span class="en-text">Status &amp; attach</span></h6>
            <div class="mb-3">
                <label class="form-label">附加题<span class="en-text">Attach</span></label>
                <select name="attach" class="form-select form-select-sm tpl_main_filter">
                    <option value="3">全部 <span class="en-text">All</span></option>
                    <option value="0">无附加题 <span class="en-text">No attach</span></option>
                    <option value="1">有附加题 <span class="en-text">Has attach</span></option>
                </select>
            </div>
            <div class="mb-3">
                <label class="form-label">公开状态<span class="en-text">Visibility</span></label>
                <select name="defunct" class="form-select form-select-sm tpl_main_filter">
                    <option value="-1">全部 <span class="en-text">All</span></option>
                    <option value="0">公开 <span class="en-text">Public</span></option>
                    <option value="1">隐藏 <span class="en-text">Hidden</span></option>
                </select>
            </div>
        </div>
        <div class="filter-section">
            <h6 class="filter-section-title"><i class="bi bi-journal-text me-2"></i>模板字段<span class="en-text">Template</span></h6>
            <div class="mb-3">
                <label class="form-label">编号<span class="en-text">Order #</span></label>
                <input type="text" name="template_sort" class="form-control form-control-sm tpl_main_filter" placeholder="部分数字" autocomplete="off">
            </div>
            <div class="mb-3">
                <label class="form-label">标签<span class="en-text">Label</span></label>
                <input type="text" name="template_label" class="form-control form-control-sm tpl_main_filter" placeholder="模板标签" autocomplete="off">
            </div>
            <div class="mb-3">
                <label class="form-label">源标题<span class="en-text">Source title</span></label>
                <input type="text" name="title" class="form-control form-control-sm tpl_main_filter" placeholder="模糊" autocomplete="off">
            </div>
            <div class="mb-3">
                <label class="form-label">模板标题<span class="en-text">Tpl title</span></label>
                <input type="text" name="template_title" class="form-control form-control-sm tpl_main_filter" placeholder="模糊" autocomplete="off">
            </div>
        </div>
        <div class="filter-section">
            <h6 class="filter-section-title"><i class="bi bi-people me-2"></i>班级与教师<span class="en-text">Class &amp; teachers</span></h6>
            <div class="mb-3">
                <label class="form-label">源班级<span class="en-text">Class</span></label>
                <input type="text" name="clss" class="form-control form-control-sm tpl_main_filter" placeholder="模糊" autocomplete="off">
            </div>
            <div class="mb-3">
                <label class="form-label">年级<span class="en-text">Year</span></label>
                <input type="text" name="year" class="form-control form-control-sm tpl_main_filter" placeholder="逗号多选" autocomplete="off">
            </div>
            <div class="mb-3">
                <label class="form-label">学期<span class="en-text">Semester</span></label>
                <input type="text" name="semester" class="form-control form-control-sm tpl_main_filter" placeholder="模糊" autocomplete="off">
            </div>
            <div class="mb-3">
                <label class="form-label">教师 ID<span class="en-text">Teacher IDs</span></label>
                <input type="text" name="teachers" class="form-control form-control-sm tpl_main_filter" placeholder="逗号多选" autocomplete="off">
            </div>
        </div>
        <div class="filter-actions mt-4 pt-3 border-top">
            <button type="button" class="btn btn-outline-secondary w-100" id="tpl_filter_sidebar_clear">
                <i class="bi bi-eraser me-2"></i>清空侧栏条件<span class="en-text d-block small">Clear sidebar filters</span>
            </button>
        </div>
    </div>
</div>

<table id="tpl_manage_table" class="bootstraptable_refresh_local"
       data-toggle="table"
       data-pagination="true"
       data-page-list="[15, 50, 100]"
       data-page-size="15"
       data-side-pagination="client"
       data-method="get"
       data-unique-id="contest_id"
       data-sort-name="template_sort"
       data-sort-order="asc"
       data-multiple-select-row="true"
       data-click-to-select="true"
       data-maintain-meta-data="true"
       data-checkbox-header="true">
    <thead>
    <tr>
        <th data-field="state" data-checkbox="true" data-width="44" title="勾选；Shift+点击行可连选 (Shift+click row for range)"></th>
        <th data-field="contest_id" data-align="center" data-valign="middle" data-width="60" data-sortable="true">ID</th>
        <th data-field="title" data-align="left" data-valign="middle" data-sortable="true" data-formatter="FormatterContestTitle">源标题<span class="en-text">Source title</span></th>
        <th data-field="template_title" data-align="left" data-valign="middle" data-sortable="true">模板标题<span class="en-text">Tpl Title</span></th>
        <th data-field="template_label" data-align="center" data-valign="middle" data-width="90" data-sortable="true">标签<span class="en-text">Label</span></th>
        <th data-field="template_sort" data-align="center" data-valign="middle" data-width="120" data-sortable="true" data-formatter="FormatterTplSortNo">编号<span class="en-text">Order #</span></th>
        <th data-field="clss_title" data-align="left" data-valign="middle" data-sortable="true" data-formatter="FormatterExpClssTitle">源班级<span class="en-text">Source class</span></th>
        <th data-field="clss_year" data-align="center" data-valign="middle" data-width="100" data-formatter="FormatterExpYearSemester" data-sortable="false">年级学期<span class="en-text">Term</span></th>
        <th data-field="private" data-align="center" data-valign="middle" data-width="48" data-formatter="FormatterExpContestAttachpro">附加<span class="en-text">Attach</span></th>
        <th data-field="teachers" data-align="left" data-valign="middle" data-formatter="FormatterExpClssTeachers" data-width="120">教师<span class="en-text">Teachers</span></th>
        <th data-field="tpl_remove" data-align="center" data-valign="middle" data-formatter="FormatterTplDemote" data-width="52" data-click-to-select="false">剔除<span class="en-text">Remove</span></th>
        <th data-field="tpl_meta" data-align="center" data-valign="middle" data-formatter="FormatterTplEdit" data-width="52" data-click-to-select="false">编辑<span class="en-text">Edit</span></th>
    </tr>
    </thead>
</table>

<!-- 批量正则替换模板标题（预览与提交） -->
<div class="modal fade csg-modal-window-scroll" id="tplBulkReplaceModal" tabindex="-1" aria-hidden="true">
    <div class="modal-dialog modal-xl">
        <div class="modal-content">
            <div class="modal-header">
                <h5 class="modal-title">批量替换模板标题<span class="en-text text-muted ms-2">Bulk regex replace template titles</span></h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body">
                <p class="small text-muted mb-3">对<strong>当前勾选</strong>的模板行，用 JavaScript 正则（<code>new RegExp(表达式,'gu')</code>，与 PHP <code>u</code> 修饰尽量对齐 Unicode）匹配「模板标题」并替换；点<strong>测试</strong>仅预览，<strong>提交</strong>由服务端以 PHP 正则再次执行（定界符 <code>#</code> + <code>u</code> 修饰）。点击「正则表达式」输入框可配合下方<strong>常用</strong>一键填入（含「末级 <code>-</code> 后」：形如 <code>2025春-23级开源鸿蒙菁英班-实验4-动态规划练习（1）</code> 取最后一段）。<span class="en-text d-block mt-1">Applies to <strong>selected</strong> rows’ template title. Test = client <code>RegExp(...,'gu')</code>; Submit = server <code>preg_replace</code> with <code>#pattern#u</code>. Presets fill pattern + replacement.</span></p>
                <datalist id="tpl_bulk_pattern_datalist">
                    <option value="^.*-(.+)$"></option>
                    <option value="^(.+?)（\d+）$"></option>
                    <option value="^\d{4}[春夏秋冬]-"></option>
                    <option value="^\s+|\s+$"></option>
                    <option value="【[^】]*】"></option>
                    <option value="^(.+?)-[^-]+$"></option>
                </datalist>
                <div class="row g-3 mb-3 align-items-stretch tpl-bulk-replace-input-row">
                    <div class="col-lg-5 col-12 d-flex flex-column">
                        <label class="form-label small text-muted mb-1" for="tpl_bulk_pattern">正则表达式<span class="en-text">Pattern</span></label>
                        <input type="text" class="form-control font-monospace mt-1" id="tpl_bulk_pattern" placeholder="例：^.*-(.+)$" autocomplete="off" list="tpl_bulk_pattern_datalist">
                        <div class="mt-2 small text-muted tpl-bulk-preset-wrap" id="tpl_bulk_preset_wrap">
                            <div class="mb-1"><span class="text-nowrap">常用（点击填入正则+替换）</span><span class="en-text d-block small">Presets (fill pattern &amp; replacement)</span></div>
                            <div class="d-flex flex-wrap gap-1 align-items-center tpl-bulk-preset-chips">
                                <button type="button" class="btn btn-outline-secondary btn-sm py-0 px-1 tpl-bulk-preset" data-pattern="^.*-(.+)$" data-replacement="$1" title="示例：2025春-23级开源鸿蒙菁英班-实验4-动态规划练习（1） → 动态规划练习（1）（截取最后一个 - 之后）">末级 - 后<span class="en-text d-block small opacity-75">After last -</span></button>
                                <button type="button" class="btn btn-outline-secondary btn-sm py-0 px-1 tpl-bulk-preset" data-pattern="^(.+?)（\d+）$" data-replacement="$1" title="去掉结尾全角括号及其中阿拉伯数字">去尾（n）<span class="en-text d-block small opacity-75">Strip （n）</span></button>
                                <button type="button" class="btn btn-outline-secondary btn-sm py-0 px-1 tpl-bulk-preset" data-pattern="^\d{4}[春夏秋冬]-" data-replacement="" title="去掉开头如 2025春-">去年份季-<span class="en-text d-block small opacity-75">Drop YYYY季-</span></button>
                                <button type="button" class="btn btn-outline-secondary btn-sm py-0 px-1 tpl-bulk-preset" data-pattern="^\s+|\s+$" data-replacement="" title="去掉首尾空白（整串 trim）">首尾空白<span class="en-text d-block small opacity-75">Trim</span></button>
                                <button type="button" class="btn btn-outline-secondary btn-sm py-0 px-1 tpl-bulk-preset" data-pattern="【[^】]*】" data-replacement="" title="删掉【】及其中的内容">去【】段<span class="en-text d-block small opacity-75">Strip【】</span></button>
                                <button type="button" class="btn btn-outline-secondary btn-sm py-0 px-1 tpl-bulk-preset" data-pattern="^(.+?)-[^-]+$" data-replacement="$1" title="去掉最后一个 - 及其后的片段（保留前面）">去掉最后段<span class="en-text d-block small opacity-75">Drop last seg.</span></button>
                            </div>
                        </div>
                    </div>
                    <div class="col-lg-2 col-12 d-flex align-items-center justify-content-center py-lg-0 py-2">
                        <button type="button" class="btn btn-outline-primary btn-sm tpl-bulk-test-btn" id="tpl_bulk_test">
                            <span class="d-inline-flex align-items-center gap-1"><i class="bi bi-eye" aria-hidden="true"></i><span class="cn-text">测试</span></span>
                            <span class="en-text">Test</span>
                        </button>
                    </div>
                    <div class="col-lg-5 col-12 d-flex flex-column">
                        <label class="form-label small text-muted mb-1" for="tpl_bulk_replacement">替换为<span class="en-text">Replacement</span></label>
                        <input type="text" class="form-control font-monospace mt-1" id="tpl_bulk_replacement" placeholder="例：$1" autocomplete="off">
                    </div>
                </div>
                <div class="table-responsive border rounded" style="max-height: 22rem; overflow: auto;">
                    <table class="table table-sm table-striped mb-0">
                        <thead class="table-light sticky-top"><tr>
                            <th style="width:72px">ID</th>
                            <th>换前<span class="en-text">Before</span></th>
                            <th>换后<span class="en-text">After</span></th>
                        </tr></thead>
                        <tbody id="tpl_bulk_preview_body"></tbody>
                    </table>
                </div>
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">取消<span class="en-text">Cancel</span></button>
                <button type="button" class="btn btn-primary tpl-bulk-submit-btn" id="tpl_bulk_submit" disabled>
                    <span class="d-inline-flex align-items-center gap-1"><i class="bi bi-check2" aria-hidden="true"></i><span class="cn-text">提交</span></span>
                    <span class="en-text">Submit</span>
                </button>
            </div>
        </div>
    </div>
</div>

<!-- 从练习列表勾选添加模板（复用练习列表筛选 + 数据接口，无操作列） -->
<div class="modal fade csg-modal-window-scroll" id="tplPickerModal" tabindex="-1" aria-hidden="true">
    <div class="modal-dialog modal-xl">
        <div class="modal-content">
            <div class="modal-header">
                <h5 class="modal-title">选择练习设为模板<span class="en-text text-muted ms-2">Select practices to mark as templates</span></h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body">
                <p class="small text-muted mb-2">勾选：请点<strong>前三列</strong>（勾选框 / 勾选顺序 / ID）。普通单击为<strong>累加</strong>勾选，不会清掉已选。<kbd>Shift</kbd>+点第二行：以<strong>上一次点选行为起点</strong>、本次为<strong>终点</strong>，区间内按列表顺序编号；若终点在起点之上（先点后前），区间内编号为<strong>逆序</strong>。其它列可<strong>双击</strong>填筛选。<span class="en-text">Additive pick; Shift = range from last anchor to current row (reverse if upward).</span></p>
                <div class="d-flex align-items-center justify-content-between mb-3 flex-wrap gap-2">
                    <div class="d-flex align-items-center gap-2 flex-wrap">
                        <div class="toolbar-group">
                            <select name="status" class="form-select form-select-sm contest_filter" title="时间状态 (Time Status)" style="min-width: 120px;">
                                <option value="-1">全部 <span class="en-text">All</span></option>
                                <option value="0">未开始 <span class="en-text">Not Started</span></option>
                                <option value="1">进行中 <span class="en-text">Running</span></option>
                                <option value="2">已结束 <span class="en-text">Ended</span></option>
                            </select>
                        </div>
                        <div class="toolbar-group">
                            <input id="contest_title_filter" name="title" class="form-control form-control-sm contest_filter" type="text" placeholder="搜索标题" style="width: 220px;" autocomplete="off">
                        </div>
                        <button id="contest_refresh" type="button" class="btn btn-outline-secondary btn-sm" title="刷新 (Refresh)">
                            <i class="bi bi-arrow-clockwise"></i>
                        </button>
                        <button id="contest_clear" type="button" class="btn btn-outline-secondary btn-sm" title="清空筛选条件 (Clear)">
                            <i class="bi bi-eraser"></i>
                        </button>
                        <button type="button" class="btn btn-outline-primary btn-sm btn-csg-filter-more" id="toggleFilterSidebar" title="打开或收起侧栏中的更多筛选条件；角标为侧栏内已填附加筛选项数 (Show or hide the sidebar for more filters; badge = count of extra conditions in the sidebar)" aria-label="更多筛选">
                            <i class="bi bi-sliders" aria-hidden="true"></i>
                            <span class="badge bg-primary ms-1 align-middle" id="filterBadge" style="display: none;">0</span>
                        </button>
                    </div>
                </div>
                <div id="filterTagsContainer" class="mb-2" style="display: none;">
                    <div class="d-flex align-items-center gap-2 flex-wrap">
                        <small class="text-muted">已选筛选：</small>
                        <div id="filterTags"></div>
                    </div>
                </div>
                <table
                    class="bootstraptable_refresh_local"
                    id="tpl_picker_table"
                    data-toggle="table"
                    data-pagination="true"
                    data-page-list="[15, 50, 100]"
                    data-page-size="15"
                    data-side-pagination="client"
                    data-method="get"
                    data-toolbar-align="right"
                    data-buttons-align="left"
                    data-unique-id="contest_id"
                    data-sort-name="contest_id"
                    data-sort-order="desc"
                    data-pagination-v-align="bottom"
                    data-pagination-h-align="left"
                    data-pagination-detail-h-align="right"
                    data-checkbox-header="true"
                    data-multiple-select-row="false"
                    data-click-to-select="true"
                    data-maintain-meta-data="true"
                >
                    <thead>
                    <tr>
                        <th data-field="state" data-checkbox="true" data-width="44" title="勾选；点勾选列/勾选顺序/ID 列切换选中；Ctrl/Shift 连选亦在此三列生效。其它列单击不勾选，可双击填筛选。(Select via checkbox / pick order / ID columns; dbl-click other cells for filters)"></th>
                        <th data-field="picker_seq" data-align="center" data-valign="middle" data-width="56" data-formatter="FormatterTplPickerSeq" data-sortable="false">勾选顺序<span class="en-text">Pick order</span></th>
                        <th data-field="contest_id" data-align="center" data-valign="middle" data-sortable="true" data-width="55">ID</th>
                        <th data-field="title" data-align="left" data-valign="middle" data-formatter="FormatterTplPickerTitle" data-click-to-select="false">标题<span class="en-text">Title</span></th>
                        <th data-field="clss_title" data-align="left" data-valign="middle" data-formatter="FormatterExpClssTitle" data-click-to-select="false">班级<span class="en-text">Class</span></th>
                        <th data-field="clss_year" data-align="center" data-valign="middle" data-width="80" data-formatter="FormatterExpYearSemester" data-sortable="false" data-click-to-select="false">年级学期<span class="en-text">Term</span></th>
                        <th data-field="private" data-align="center" data-valign="middle" data-formatter="FormatterExpContestAttachpro" data-width="40" data-click-to-select="false">附加<span class="en-text">Attach</span></th>
                        <th data-field="" data-align="center" data-valign="middle" data-formatter="FormatterExpContestTimeStatus" data-width="60" data-click-to-select="false">状态<span class="en-text">Status</span></th>
                        <th data-field="start_time" data-align="center" data-valign="middle" data-width="70" data-formatter="FormatterDate" data-sortable="true" data-click-to-select="false">开始<span class="en-text">Start</span></th>
                        <th data-field="end_time" data-align="center" data-valign="middle" data-width="70" data-formatter="FormatterDate" data-sortable="true" data-click-to-select="false">结束<span class="en-text">End</span></th>
                        <th data-field="teachers" data-align="left" data-valign="middle" data-formatter="FormatterExpClssTeachers" data-width="120" data-click-to-select="false">教师<span class="en-text">Teachers</span></th>
                    </tr>
                    </thead>
                </table>
                <div id="tplPickerPickFooter" class="small border-top px-1 py-2 mt-2 text-muted">
                    <div>
                        <span class="cn-text">已选</span> <strong id="tplPickerPickCount">0</strong>
                        <span class="en-text">selected</span>
                    </div>
                    <div id="tplPickerPickIds" class="font-monospace text-break" style="max-height: 4.5rem; overflow-y: auto" title="按勾选顺序的 contest_id">—</div>
                </div>
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">取消<span class="en-text">Cancel</span></button>
                <button type="button" class="btn btn-primary" id="tpl_picker_confirm">确定<span class="en-text">OK</span></button>
            </div>
        </div>
    </div>
</div>

<!-- 编辑模板元数据 -->
<div class="modal fade" id="tplEditModal" tabindex="-1" aria-hidden="true">
    <div class="modal-dialog">
        <div class="modal-content">
            <div class="modal-header">
                <h5 class="modal-title">编辑模板信息<span class="en-text text-muted ms-2">Edit template</span></h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body">
                <input type="hidden" id="tpl_edit_contest_id" value="">
                <div class="mb-3">
                    <label class="form-label bilingual-label">练习标题<span class="en-text">Practice title</span></label>
                    <input type="text" class="form-control" id="tpl_edit_title" maxlength="255">
                </div>
                <div class="mb-3">
                    <label class="form-label bilingual-label">模板标题<span class="en-text">Template title</span></label>
                    <input type="text" class="form-control" id="tpl_edit_template_title" maxlength="255">
                </div>
                <div class="mb-3">
                    <label class="form-label bilingual-label">标签<span class="en-text">Label</span></label>
                    <input type="text" class="form-control" id="tpl_edit_template_label" maxlength="64">
                </div>
                <div class="mb-0">
                    <label class="form-label bilingual-label">编号<span class="en-text">Order #</span></label>
                    <input type="number" class="form-control" id="tpl_edit_template_sort" step="1" value="0">
                </div>
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">取消<span class="en-text">Cancel</span></button>
                <button type="button" class="btn btn-primary" id="tpl_edit_save">保存<span class="en-text">Save</span></button>
            </div>
        </div>
    </div>
</div>

{css href="__STATIC__/exadmin/exadmin.css" /}
{css href="__STATIC__/csgoj/csg_modal_window_scroll.css" /}
{js href="__STATIC__/csgoj/csg_bstable_pickorder.js" /}
{js href="__STATIC__/exadmin/contest_tpl_manage.js" /}
<script type="text/javascript">
window.tplPickerFilterMode = true;
window.ContestConfig = { module: "exadmin" };
window.tplPickerContestPageInfo = {
    module: "exadmin",
    controller: "contest",
    tableUrl: "/exadmin/contest/contest_list_ajax",
    timeStamp: <?php echo json_encode(microtime(true)); ?>,
    courseKey: <?php echo json_encode(isset($NOW_COURSE_KEY) ? strval($NOW_COURSE_KEY) : ''); ?>
};
</script>
{js href="__STATIC__/csgoj/oj_contest.js" /}
{js href="__STATIC__/csgoj/general_formatter.js" /}
<script type="text/javascript">
function FormatterTplPickerTitle(value, row, index, field) {
    if (typeof FormatterContestTitle !== 'function') {
        return $('<div>').text(value == null ? '' : String(value)).html();
    }
    var h = FormatterContestTitle(value, row, index, field);
    return h.replace('<a ', '<a target="_blank" rel="noopener noreferrer" ');
}
</script>
{include file="../../expsys/view/contest/contest_filter" /}
