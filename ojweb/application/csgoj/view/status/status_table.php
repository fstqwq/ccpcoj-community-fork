<?php 
// 支持 modal 模式复用：如果未设置，默认为主表格模式
$is_modal = isset($is_modal) ? $is_modal : false;
$table_id = $is_modal ? 'status_table_modal' : 'status_table';
$table_div_id = $is_modal ? 'status_table_div_modal' : 'status_table_div';
$page_size = $is_modal ? 20 : 15;
$page_list = $is_modal ? '[20]' : '[15]';
$query_params = $is_modal ? 'queryParamsModal' : 'queryParams';

// modal 模式下 URL 固定为 contest/status_ajax，主表格模式使用 controller 变量
if ($is_modal) {
    $table_url = "/" . $module . "/contest/status_ajax";
    if (isset($contest) && isset($contest['contest_id'])) {
        $table_url .= "?cid=" . $contest['contest_id'];
    }
} else {
    $table_url = "/" . $module . "/" . $controller . "/status_ajax";
    if (isset($contest) && isset($contest['contest_id'])) {
        $table_url .= "?cid=" . $contest['contest_id'];
    }
}

// modal 模式下提交时间固定使用 FormatterTime，主表格模式根据 controller 判断
if ($is_modal) {
    $in_date_formatter = 'FormatterTime';
} else {
    $in_date_formatter = (isset($controller) && $controller == 'contest') ? 'FormatterTime' : 'FormatterDate';
}
?>
<div id="{$table_div_id}">
    <table id="{$table_id}"
        class="bootstraptable_refresh_local"
        data-unique-id="solution_id"
        data-url="{$table_url}"
        {if !$is_modal}data-toggle="table"{/if}
        data-pagination="true"
        data-page-list="{$page_list}"
        data-page-size="{$page_size}"
        data-side-pagination="server"
        data-method="get"
        data-sort-name="solution_id"
        data-sort-order="desc"
        data-pagination-v-align="bottom"
        data-pagination-h-align="left"
        data-pagination-detail-h-align="right"
        {if !$is_modal}data-toolbar-align="left"
        data-toolbar="#status_toolbar"{/if}
        data-query-params="{$query_params}"
        data-classes="table table-hover table-striped table-bordered"
    >
        <thead>
        <tr>
            {if $module=='examsys'}
            <th data-field="solution_id" data-align="center" data-valign="middle" data-sortable="false" data-width="70">RunID<span class="en-text">RunID</span></th>
            {else/}
            <th data-field="solution_id" data-align="center" data-valign="middle" data-sortable="false" data-width="70" data-formatter="FormatterSolutionId">ID<span class="en-text">RunID</span></th>
            {/if}
            
            {if $module=='examsys'}
            <th class='status_user_id' data-field="user_id" data-align="center" data-valign="middle" data-sortable="false" data-formatter="FormatterStatusUser">考生<span class="en-text">Examinee</span></th>
            {else/}
            <th class='status_user_id' data-field="user_id" data-align="center" data-valign="middle" data-sortable="false" data-formatter="FormatterStatusUser">账号<span class="en-text">User</span></th>
            {/if}
            
            {if $module=='examsys'}
            {if IsAdmin() || isset($isContestAdmin) && $isContestAdmin || isset($isReviewer) && $isReviewer || isset($isAdmin) && $isAdmin}
            <th class='status_problem_id' data-field="problem_id" data-align="center" data-valign="middle" data-sortable="false" data-width="100" data-formatter="FormatterExamsysProblemIdWithPid" title="Question ID / Problem ID">Qid/Pid<span class="en-text">Qid/Pid</span></th>
            {else/}
            <th class='status_problem_id' data-field="problem_id" data-align="center" data-valign="middle" data-sortable="false" data-width="70" data-formatter="FormatterExamsysProblemId" title="Question ID">Qid<span class="en-text">Qid</span></th>
            {/if}
            {else/}
            <th class='status_problem_id' data-field="problem_id" data-align="center" data-valign="middle" data-sortable="false" data-width="70" data-formatter="FormatterProblemId">题号<span class="en-text">Problem</span></th>
            {/if}
            
            {if $module=='examsys'}
            <th class='status_result' data-field="result" data-align="center" data-valign="middle" data-sortable="false" data-width="200" data-formatter="FormatterStatusResult">结果<span class="en-text">Result</span></th>
            {else/}
            <th class='status_result' data-field="result" data-align="center" data-valign="middle" data-sortable="false" data-width="100" data-formatter="FormatterStatusResult">结果<span class="en-text">Result</span></th>
            {/if}
            
            {if($OJ_OPEN_OI) }
            <th class='status_pass_rate' data-field="pass_rate" data-align="center" data-valign="middle" data-sortable="false" data-width="70" data-formatter="FormatterPassRate">通过率<span class="en-text">Pass Rate</span></th>
            {/if}
            <th class='status_memory' data-field="memory" data-align="right" data-valign="middle" data-sortable="false" data-width="80">内存(kB)<span class="en-text">Memory(kB)</span></th>
            <th class='status_time' data-field="time" data-align="right" data-valign="middle" data-sortable="false" data-width="80">时间(ms)<span class="en-text">Time(ms)</span></th>
            <th class='status_language' data-field="language" data-align="center" data-valign="middle" data-sortable="false" data-width="80" data-formatter="FormatterLanguage">语言<span class="en-text">Language</span></th>
            <th class='status_code_length' data-field="code_length" data-align="right" data-valign="middle" data-sortable="false" data-width="80">代码长度<span class="en-text">Code Length</span></th>
            
            {if $module=='examsys'}
            <th class='status_in_date' data-field="in_date" data-align="center" data-valign="middle" data-sortable="false" data-width="160" data-formatter="FormatterTime" title="Submit Time">提交时间<span class="en-text">Submit Time</span></th>
            {else/}
            <th class='status_in_date' data-field="in_date" data-align="center" data-valign="middle" data-sortable="false" data-width="70" data-formatter="{$in_date_formatter}">提交时间<span class="en-text">Submit Time</span></th>
            {/if}
            
            {if IsAdmin() || isset($contest) && IsAdmin('contest', $contest['contest_id']) }
                {if $module!='examsys'}
                <th data-field="judger" data-align="center" data-valign="middle" data-sortable="false">评测机<span class="en-text">Judger</span></th>
                {/if}
                <th data-field="rejudge" data-align="center" data-valign="middle" data-sortable="false" data-formatter="FormatterRejudge">重测<span class="en-text">Rejudge</span></th>
            {/if}
            
            <?php 
            // 检查是否应该显示查重列
            // 系统在任何状态下，只要是管理员或教师身份，都显示查重列
            $show_sim_column = false;
            
            if (isset($contest)) {
                // 比赛内：比赛管理员、源码浏览权限或比赛所属课程的教师
                $show_sim_column = IsAdmin('contest', $contest['contest_id']) || IsAdmin('source_browser');
                
                // 检查是否是比赛所属课程的教师（EXP 模式）
                if (!$show_sim_column && isset($OJ_STATUS) && $OJ_STATUS == 'exp' && function_exists('PrivCourse')) {
                    // 获取比赛所属的 course_key
                    $contest_id = $contest['contest_id'];
                    $course_item = db('course_item')
                        ->where(['item' => 'contest', 'item_id' => $contest_id])
                        // 兼容历史数据：pvrole 可能是 NULL 或空字符串
                        ->where(function($q) {
                            $q->whereNull('pvrole')->whereOr('pvrole', '');
                        })
                        ->field('course_id')
                        ->find();
                    if ($course_item) {
                        $course = db('course')->where('course_id', $course_item['course_id'])->field('course_key')->find();
                        if ($course && isset($course['course_key'])) {
                            $show_sim_column = PrivCourse('teacher', $course['course_key']);
                        }
                    }
                }
            } else {
                // 全局状态页面：管理员、源码浏览权限或任何课程的教师
                $show_sim_column = IsAdmin() || IsAdmin('source_browser');
                
                // 检查是否是任何课程的教师（EXP 模式）
                if (!$show_sim_column && isset($OJ_STATUS) && $OJ_STATUS == 'exp' && function_exists('PrivCourse')) {
                    // PrivCourse('teacher', null) 检查用户是否是任何课程的教师
                    $show_sim_column = PrivCourse('teacher', null);
                }
            }
            ?>
            {if $show_sim_column}
            <th data-field="sim" data-align="center" data-valign="middle" data-sortable="false" data-formatter="FormatterSim">{if $is_modal}相似度<span class="en-text">Similar</span>{else/}查重<span class="en-text">Plagiarism</span>{/if}</th>
            {/if}
        </tr>
        </thead>
    </table>
</div>

