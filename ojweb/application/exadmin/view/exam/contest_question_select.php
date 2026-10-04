<div class="container">
    <div class="row">
        <div class="col-6">
            <div id="question_filter_toolbar">
                    <input type="checkbox" class="btn-check w-50 question_filter_check" pkind=0  id="question_filter_0"  autocomplete="off" checked><label class="btn btn-outline-primary" title="单选" for="question_filter_0">SC</label>
                    <input type="checkbox" class="btn-check w-50 question_filter_check" pkind=1  id="question_filter_1"  autocomplete="off" checked><label class="btn btn-outline-primary" title="多选" for="question_filter_1">MC</label>
                    <input type="checkbox" class="btn-check w-50 question_filter_check" pkind=5  id="question_filter_5"  autocomplete="off" checked><label class="btn btn-outline-primary" title="判断" for="question_filter_5">TF</label>
                    <input type="checkbox" class="btn-check w-50 question_filter_check" pkind=10 id="question_filter_10" autocomplete="off" checked><label class="btn btn-outline-primary" title="填空" for="question_filter_10">FI</label>
                    <input type="checkbox" class="btn-check w-50 question_filter_check" pkind=15 id="question_filter_15" autocomplete="off" checked><label class="btn btn-outline-primary" title="简答" for="question_filter_15">SA</label>
                    <input type="checkbox" class="btn-check w-50 question_filter_check" pkind=20 id="question_filter_20" autocomplete="off" checked><label class="btn btn-outline-primary" title="综合" for="question_filter_20">CS</label>
                    <input type="checkbox" class="btn-check w-50 question_filter_check" pkind=25 id="question_filter_25" autocomplete="off" checked><label class="btn btn-outline-primary" title="编程" for="question_filter_25">PG</label>

                    <button id="question_filter_all" class="btn btn-warning" title="全选">A</button>
                    <button id="question_filter_clear" class="btn btn-secondary" title="全不选">C</button>
                    <button id="question_filter_button" class="btn btn-success" title="过滤">F</button>

            </div>
            <table
                    id="question_list_table"
                    class="bootstraptable_refresh_local"
                    data-unique-id="ex_question_id"
                    data-toggle="table"
                    data-toolbar="#question_filter_toolbar"
                    data-buttons-align="left"
                    data-toolbar-align="left"
                    data-pagination="true"
                    data-page-list="[25,50,100]"
                    data-page-size="25"
                    data-side-pagination="client"
                    data-striped="true"
                    data-search="true"
                    data-search-align="left"
                    data-sort-name="ex_question_id"
                    data-sort-order="desc"
                    data-pagination-v-align="bottom"
                    data-pagination-h-align="left"
                    data-pagination-detail-h-align="right"
                    data-classes="table-no-bordered table table-hover"
            >
                <thead>
                <tr>
                    <th data-field="ex_question_id" data-align="center" data-valign="middle" data-sortable="true" data-width="55" data-formatter="FormatterQuestionId">ID</th>
                    <th data-field="pkind" data-align="center" data-valign="middle" data-sortable="true" data-width="28" data-formatter="FormatterPkind" data-cell-style="StylePkind" title="题目类型">Pk</th>
                    <th data-field="title" data-align="left" data-valign="middle" data-sortable="true" data-width="210" data-formatter="FormatterQuestionTitle">Title</th>
                    <th data-field="source" data-align="left" data-valign="middle" data-sortable="true" data-width="90" data-formatter="FormatterSource" title="来源">Src</th>
                    <th data-field="label" data-align="left" data-valign="middle" data-sortable="true" data-width="65" data-formatter="FormatterLabel" title="标签">Lb</th>
                    <th data-field="selected" data-align="center" data-valign="middle" data-sortable="true" data-width="55" data-formatter="FormatterAdd">Add</th>
                </tr>
                </thead>
            </table>
        </div>
        <div class="col-6">
            <div id="question_selected_table_toobar" class="d-flex justify-content-between align-items-center mb-2">
                <div class="d-flex align-items-center gap-2">
                    <span >总分：<span class="en-text">Total Score</span></span>
                    <span id="total_score_span" class='text-danger fw-bold'>0</span>
                    <span id="total_score_hint" class="small text-muted"></span>
                </div>
                <div class="btn-group" role="group">
                    <button type="button" class="btn btn-outline-primary btn-sm bilingual-button btn-compact" id="download_config_btn" title="下载配置 / Download Config">
                        <i class="bi bi-download"></i>
                        <span class="cn-text">下载配置</span>
                        <span class="en-text">Download</span>
                    </button>
                    <button type="button" class="btn btn-outline-success btn-sm bilingual-button btn-compact" id="upload_config_btn" title="上传配置 / Upload Config">
                        <i class="bi bi-upload"></i>
                        <span class="cn-text">上传配置</span>
                        <span class="en-text">Upload</span>
                    </button>
                    <input type="file" id="config_file_input" accept=".json">
                </div>
            </div>
            <div id="question_select_table_div">
                <table
                        id="question_selected_table"
                        data-toggle="table"
                        data-toolbar="#question_selected_table_toobar"
                        data-toolbar-align="right"
                        data-pagination="true"
                        data-page-list="[25,50,100]"
                        data-page-size="25"
                        data-side-pagination="client"
                        data-striped="true"
                        data-search="true"
                        data-search-align="left"
                        data-pagination-v-align="bottom"
                        data-pagination-h-align="left"
                        data-pagination-detail-h-align="right"
                        data-reorderable-rows="true"
                        data-use-row-attr-func="true"
                        data-classes="table-no-bordered table table-hover"
                >
                    <thead>
                    <tr>
                        <th data-field="idx" data-align="center" data-valign="middle"  data-sortable="false" data-width="20" data-formatter="FormatterIdx">Idx</th>
                        <th data-field="ex_question_id" data-align="center" data-valign="middle"  data-sortable="false" data-width="20" data-formatter="FormatterQuestionId">ID</th>
                        <th data-field="pkind"  data-align="center" data-valign="middle"  data-sortable="false" data-width="20" data-formatter="FormatterPkind" data-cell-style="StylePkind" title="题目类型">Pk</th>
                        <th data-field="title"   data-align="left" data-valign="middle"  data-sortable="false" data-formatter="FormatterQuestionTitleSelected">Title</th>
                        <th data-field="prule"   data-align="left" data-valign="middle"  data-sortable="false" data-formatter="FormatterPrule" data-width="120">
                            评分规则<span class="en-text">Scoring Rule</span>
                        </th>
                        <th data-field="pscore"   data-align="center" data-valign="middle"  data-sortable="false" data-width="80" data-formatter="FormatterPscore">
                            分数<span class="en-text">Score</span>
                        </th>
                        <th data-field="rm"   data-align="center" data-valign="middle"  data-sortable="false" data-width="30" data-formatter="FormatterRM" >RM</th>
                    </tr>
                    </thead>
                </table>
            </div>
        </div>
    </div>
</div>
<input
    type="hidden"
    id="page_info"
    edit_mode="{if $edit_mode}1{else/}0{/if}"
    copy_mode="{if isset($copy_mode) && $copy_mode}1{else/}0{/if}"
    contest_id="{if $edit_mode}{$contest['contest_id']}{else /}0{/if}"
>
{css href="__STATIC__/exadmin/exadmin.css" /}
{include file="../../csgoj/view/public/pkg_code_highlight" /}
{css href="__STATIC__/csgoj/code_show.css" /}
{js href="__STATIC__/csgoj/oj_problem.js" /}
{js href="__STATIC__/csgoj/code_render.js" /}
{js href="__STATIC__/examsys/ex_global.js" /}
{js href="__STATIC__/examsys/question_md_utils.js" /}
{js href="__STATIC__/examsys/question_default.js" /}
{js href="__STATIC__/examsys/question_render.js" /}
{js href="__STATIC__/examsys/question_preview.js" /}
{js href="__STATIC__/exadmin/contest_question_select.js" /}
<style>
    .fixed-table-toolbar {
        height: 120px !important;
    }
</style>

