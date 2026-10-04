{include file="problemset/problem_header" /}

<div class="container-fluid mt-3">
    <div class="row g-3">
        <!-- 统计卡片 -->
        <div class="col-lg-3 col-md-4">
            <div class="card h-100">
                <div class="card-header bg-light">
                    <h5 class="mb-0 bilingual-inline">
                        <i class="bi bi-bar-chart me-2"></i>
                        统计<span class="en-text">Statistic</span>
                    </h5>
                </div>
                <div class="card-body p-2">
                    <table class="table table-sm table-hover mb-0">
                        <tbody>
                        <tr>
                            <td class="text-nowrap">
                                <a href="__OJ__/status#status_problem_id={$problem['problem_id']}" class="text-decoration-none">
                                    总提交<span class="en-text">Total Submissions</span>
                                </a>
                            </td>
                            <td class="text-end fw-bold">{$statistic['total_submissions']}</td>
                        </tr>
                        <tr>
                            <td class="text-nowrap">提交用户<span class="en-text">Users Submitted</span></td>
                            <td class="text-end fw-bold">{$statistic['users_submitted']}</td>
                        </tr>
                        <tr>
                            <td class="text-nowrap">通过用户<span class="en-text">Users Solved</span></td>
                            <td class="text-end fw-bold text-success">{$statistic['users_solved']}</td>
                        </tr>
                        <?php 
                        $resultColorMap = [
                            4 => ['success', 'Accepted', '通过'],
                            5 => ['danger', 'Presentation Error', '格式错误'],
                            6 => ['danger', 'Wrong Answer', '答案错误'],
                            7 => ['warning', 'Time Limit Exceed', '时间超限'],
                            8 => ['warning', 'Memory Limit Exceed', '内存超限'],
                            9 => ['warning', 'Output Limit Exceed', '输出超限'],
                            10 => ['warning', 'Runtime Error', '运行错误'],
                            11 => ['info', 'Compile Error', '编译错误'],
                            90 => ['info', 'Judge Failed', '评测失败'],
                            0 => ['secondary', 'Pending', '等待中'],
                            1 => ['secondary', 'Pending Rejudging', '等待重测'],
                            2 => ['secondary', 'Compiling', '编译中'],
                            3 => ['info', 'Running&Judging', '运行中'],
                        ];
                        foreach($ojResultsHtml as $key=>$value):
                             if($key == 13) break;
                             $colorInfo = isset($resultColorMap[$key]) ? $resultColorMap[$key] : ['secondary', $value[1], $value[1]];
                             $colorClass = 'text-' . $colorInfo[0];
                             $enText = $colorInfo[1];
                             $cnText = isset($colorInfo[2]) ? $colorInfo[2] : $value[1];
                        ?>
                        <tr>
                            <td class="text-nowrap">
                                <a href="__OJ__/status#status_problem_id={$problem['problem_id']}#status_result={$key}" class="text-decoration-none {$colorClass}">
                                    <span class="fw-semibold">{$cnText}</span><span class="en-text">{$enText}</span>
                                </a>
                            </td>
                            <td class="text-end fw-bold {$colorClass}">{$statistic[$key]}</td>
                        </tr>
                        <?php endforeach;?>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>

        <!-- 排行榜卡片 -->
        <div class="col-lg-9 col-md-8">
            <div class="card h-100">
                <div class="card-header bg-light">
                    <div class="d-flex align-items-center justify-content-between flex-wrap gap-2">
                        <h5 class="mb-0 bilingual-inline">
                            <i class="bi bi-trophy me-2"></i>
                            解题排行<span class="en-text">Solution Rank</span>
                        </h5>
                    </div>
                </div>
                <div class="card-body p-0">
                    <div id="summary_toolbar" class="table-toolbar p-2 border-bottom">
                        <div class="d-flex align-items-center gap-2 flex-wrap">
                            <button id="summary_refresh" type="button" class="btn btn-outline-secondary btn-sm toolbar-btn" title="刷新 (Refresh)">
                                <i class="bi bi-arrow-clockwise"></i>
                            </button>
                            <button id="summary_clear" type="button" class="btn btn-outline-secondary btn-sm toolbar-btn" title="清空筛选条件 (Clear)">
                                <i class="bi bi-eraser"></i>
                            </button>
                            <div class="toolbar-group">
                                <input id="user_id_input" name="user_id" class="form-control form-control-sm toolbar-input summary_filter" type="text" style="max-width:120px;" placeholder="User ID" title="用户ID (User ID)">
                            </div>
                            <div class="toolbar-group">
                                <span class="toolbar-label-inline"><span>编程语言</span><span class="toolbar-label en-text">Language</span></span>
                                <select name="language" class="form-select form-select-sm toolbar-select summary_filter" title="编程语言 (Programming Language)" style="min-width: 120px;">
                                    <option value="-1" selected>全部<span class="en-text">All</span></option>
                                    {foreach($allowLanguage as $key=>$value)}
                                    <option value="{$key}">{$value}</option>
                                    {/foreach}
                                </select>
                            </div>
                        </div>
                    </div>
                    <div id="summary_table_div">
                        <table
                            class="bootstraptable_refresh_local"
                            id="summary_table"
                            data-toggle="table"
                            data-url="__OJ__/problemset/summary_ajax?pid={$problem['problem_id']}"
                            data-pagination="true"
                            data-page-list="[20]"
                            data-page-size="20"
                            data-side-pagination="server"
                            data-method="get"
                            data-striped="true"
                            data-sort-name="time"
                            data-sort-order="asc"
                            data-pagination-v-align="bottom"
                            data-pagination-h-align="left"
                            data-pagination-detail-h-align="right"
                            data-toolbar="#summary_toolbar"
                            data-query-params="queryParamsSummary"
                            data-classes="table table-hover table-striped mb-0"
                        >
                            <thead class="table-light">
                            <tr>
                                <th data-field="rank" data-align="center" data-valign="middle" data-sortable="false" data-width="60">排名<span class="en-text">Rank</span></th>
                                <th data-field="solution_id" data-align="center" data-valign="middle" data-sortable="false" data-width="80" data-formatter="FormatterSummarySolutionId">ID<span class="en-text">RunID</span></th>
                                <th data-field="user_id" data-align="center" data-valign="middle" data-sortable="false" data-formatter="FormatterStatusUser">账号<span class="en-text">User</span></th>
                                <th data-field="memory" data-align="right" data-valign="middle" data-sortable="true" data-width="100">内存(kB)<span class="en-text">Memory(kB)</span></th>
                                <th data-field="time" data-align="right" data-valign="middle" data-sortable="true" data-width="100">时间(ms)<span class="en-text">Time(ms)</span></th>
                                <th data-field="language" data-align="center" data-valign="middle" data-sortable="false" data-width="100" data-formatter="FormatterLanguage">语言<span class="en-text">Language</span></th>
                                <th data-field="code_length" data-align="right" data-valign="middle" data-sortable="true" data-width="80">代码长度<span class="en-text">Code Length</span></th>
                                <th data-field="in_date" data-align="center" data-valign="middle" data-sortable="false" data-width="160" data-formatter="FormatterTime">提交时间<span class="en-text">Submit Time</span></th>
                            </tr>
                            </thead>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    </div>
</div>

<style type="text/css">
    #summary_table_div {
        overflow-x: auto;
    }
    .bootstrap-table .fixed-table-toolbar {
        padding: 0.5rem 0;
    }
</style>

<script type="text/javascript">
    // 配置 statusPageConfig，供 oj_status.js 使用
    window.statusPageConfig = window.statusPageConfig || {};
    window.statusPageConfig.module = '{$module}';
    window.statusPageConfig.status_page_where = 'problemset';
    
    var summary_table = $('#summary_table');
    var summary_table_div = $('#summary_table_div');
    
    // queryParams 函数：从筛选组件读取值并传递给后端
    window.queryParamsSummary = function(params) {
        const prefix = 'summary';
        const filterNames = ['user_id', 'language'];
        filterNames.forEach(name => {
            const anchorKey = `${prefix}_${name}`;
            const anchorVal = csg.GetAnchor(anchorKey);
            
            // 只传递非空且非默认值给后端
            if (anchorVal != null && anchorVal !== '' && anchorVal !== '-1') {
                params[name] = anchorVal;
            }
        });
        
        return params;
    };
    
    summary_table.on('post-body.bs.table', function(){
        if(summary_table[0].scrollWidth > summary_table_div.width()) {
            summary_table_div.width(summary_table[0].scrollWidth + 20);
        }
    });
    
    // 初始化工具栏
    $(function() {
        initBootstrapTableToolbar({
            tableId: 'summary_table',
            prefix: 'summary',
            filterSelectors: ['user_id', 'language'],
            searchInputId: null,
            customQueryParams: null, // 使用全局的 queryParamsSummary 函数
            customHandlers: {
                clear: function() {
                    // 清空所有筛选组件和anchor
                    const prefix = 'summary';
                    $('.summary_filter').each(function() {
                        const $elem = $(this);
                        const name = $elem.attr('name');
                        if (!name) return;
                        
                        // 标记为正在清空，避免触发 anchor 更新事件
                        $elem.data('initializing-from-anchor', true);
                        
                        // 清空筛选组件值
                        if ($elem.is('input')) {
                            $elem.val('');
                        } else {
                            $elem.val('-1');
                        }
                        
                        // 清空anchor
                        const anchorKey = `${prefix}_${name}`;
                        const anchorVal = csg.GetAnchor(anchorKey);
                        if (anchorVal !== null && anchorVal !== '') {
                            csg.SetAnchor(null, anchorKey);
                        }
                        
                        // 延迟清除标记
                        setTimeout(function() {
                            $elem.removeData('initializing-from-anchor');
                        }, 100);
                    });
                    
                    // 刷新表格
                    summary_table.bootstrapTable('refresh', {pageNumber: 1});
                },
                refresh: function() {
                    summary_table.bootstrapTable('refresh');
                }
            },
            enableFilterAnchorSync: true
        });
    });
    
    // Summary 页面专用的 formatter
    function FormatterSummarySolutionId(value, row, index, field) {
        // 使用锚参数格式，参考 status 页面的实现（多个参数用 # 分隔）
        var module = '{$module}';
        var pid = '<?php echo $problem['problem_id']; ?>';
        var acnum = row.acnum || '';
        var acnumText = acnum ? '(' + acnum + ')' : '';
        var statusUrl = '/' + module + '/status#status_problem_id=' + pid + '#status_result=4#status_user_id=' + row.user_id;
        return '<a href="' + statusUrl + '" title="查看提交详情 / View Submission Details">' + value + acnumText + '</a>';
    }
</script>

{js href="__STATIC__/csgoj/oj_status.js" /}
{js href="__STATIC__/csgoj/oj_status.css" /}