{if $OJ_MODE == 'online' && $OJ_STATUS == 'exp' && (IsAdmin('contest_editor') || PrivCourse('teacher', $NOW_COURSE_KEY))}
<div class="modal fade" id="expFromTplModal" tabindex="-1" aria-hidden="true">
    <div class="modal-dialog modal-lg modal-dialog-scrollable">
        <div class="modal-content">
            <div class="modal-header">
                <h5 class="modal-title">从模板添加练习<span class="en-text text-muted ms-2">Add from template</span></h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body">
                <p class="small text-muted mb-2">请选择模板后进入添加页，题目与说明将预填，标题可按模板短标题自动组合。<span class="en-text d-block mt-1">Pick a template to open the add page with problems and description prefilled.</span></p>
                <div class="mb-2">
                    <input type="search" id="exp_from_tpl_search" class="form-control form-control-sm" autocomplete="off"
                           placeholder="模糊搜索 ID 或模板标题 (Search ID or template title)"
                           title="匹配练习 ID 或模板标题，纯前端筛选 (Matches practice ID or template title, client-side only)">
                </div>
                <table id="exp_from_tpl_table" class="table table-sm table-hover mb-0"
                       data-toggle="table"
                       data-unique-id="contest_id"
                       data-pagination="true"
                       data-page-size="20"
                       data-page-list="[20, 50, 100]"
                       data-side-pagination="client"
                       data-click-to-select="true"
                       data-single-select="true">
                    <thead>
                    <tr>
                        <th data-radio="true" data-width="40"></th>
                        <th data-field="contest_id" data-width="56">ID</th>
                        <th data-field="template_title">模板标题<span class="en-text">Title</span></th>
                        <th data-field="template_sort" data-align="center" data-width="80" data-sortable="true">编号<span class="en-text">Order #</span></th>
                    </tr>
                    </thead>
                </table>
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">取消<span class="en-text">Cancel</span></button>
                <button type="button" class="btn btn-primary" id="exp_from_tpl_go">下一步<span class="en-text">Next</span></button>
            </div>
        </div>
    </div>
</div>
{js href="__STATIC__/exadmin/from_template_practice.js" /}
{/if}
