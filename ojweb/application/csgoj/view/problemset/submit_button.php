<div class="btn-group" role="group">
    {if isset($contest) }
        <?php
        // 检查是否应该禁用提交按钮
        $is_teacher = false;
        $is_admin = false;
        $disable_reason = '';
        $disable_title = '';
        
        // 检查是否是教师（expsys/examsys 模块）
        if(isset($OJ_STATUS) && $OJ_STATUS == 'exp' && isset($NOW_COURSE_KEY) && function_exists('PrivCourse')) {
            $is_teacher = PrivCourse('teacher', $NOW_COURSE_KEY);
        }
        
        // 检查是否是管理员（expsys 模块）
        if(isset($module) && $module == 'expsys' && function_exists('IsAdmin')) {
            $is_admin = IsAdmin();
        }
        
        // 提前计算比赛类型，用于 standard 的禁用逻辑
        $contest_type = isset($contest['private']) ? ($contest['private'] % 10) : 0;
        $is_standard_contest = ($contest_type === 2);
        
        // 判断是否应该禁用按钮
        $should_disable = false;
        if($is_teacher) {
            $should_disable = true;
            $disable_reason = 'teacher';
            $disable_title = '教师不能提交 (Teachers cannot submit)';
        } elseif($is_admin) {
            $should_disable = true;
            $disable_reason = 'admin';
            $disable_title = '管理员不能提交 (Administrators cannot submit)';
        } elseif(!isset($contestStatus)) {
            // contestStatus 未设置，保持原逻辑
        } elseif($contestStatus == -1) {
            $should_disable = true;
            $disable_reason = 'not_started';
            $disable_title = isset($OJ_STATUS) && $OJ_STATUS == 'exp' ? '习题尚未开始 (Exercise not started)' : '比赛尚未开始 (Contest not started)';
        } elseif($contestStatus == 2) {
            $should_disable = true;
            $disable_reason = 'ended';
            $disable_title = isset($OJ_STATUS) && $OJ_STATUS == 'exp' ? '习题已结束 (Exercise ended)' : '比赛已结束 (Contest ended)';
        } elseif($is_standard_contest && !$contest_user) {
            $should_disable = true;
            $disable_reason = 'no_contest_account';
            $disable_title = '请使用比赛账号登录后提交 (Please login with contest account to submit)';
        }
        
        // 检查是否可以提交
        if ($is_standard_contest) {
            // standard：仅按比赛内账号身份，登录了合法参赛账号（非职能 staff）即可提交，不认系统级权限（如 source_browser）
            $can_submit = $contest_user && $running == 1 && (!isset($isContestAccountStaff) || !$isContestAccountStaff);
        } else {
            $can_submit = $contest_user && $running == 1 && (in_array($contest_type, [0, 1]) || !IsAdmin('source_browser') && !$isContestAdmin && (!isset($isContestStaff) || !$isContestStaff));
        }
        
        // 构建完整的提示信息（用于 title 和 info_str）
        $full_disable_title = '';
        if($should_disable) {
            $full_disable_title = $disable_title;
        } elseif($is_standard_contest && !$contest_user) {
            $full_disable_title = '请使用比赛账号登录后提交 (Please login with contest account to submit)';
        } elseif($is_standard_contest && isset($isContestAccountStaff) && $isContestAccountStaff) {
            $full_disable_title = 'You are contest staff!';
        } elseif(!$is_standard_contest && function_exists('IsAdmin') && IsAdmin('source_browser')) {
            $full_disable_title = 'You are source browser!';
        } elseif(isset($isContestStaff) && $isContestStaff) {
            $full_disable_title = 'You are contest staff!';
        } else {
            $full_disable_title = 'Please login before submit!';
        }
        ?>
        {if $can_submit && !$should_disable }
        <a href="/{$module}/{$controller}/submit?cid={$contest['contest_id']}&pid={$apid}" class="a_noline">
            <button type="button" class="btn btn-primary">
                <span class="cn-text">提交</span>
                <span class="en-text">Submit</span>
            </button>
        </a>
        {else /}
        <a href="javascript:void(null)" class='disabled_problem_submit_button a_noline' 
        info_str="{$full_disable_title}"
        >
            <button type="button" class="btn btn-secondary" title="{$full_disable_title}" {if $should_disable}disabled="disabled"{/if}>
                <span class="cn-text">提交</span>
                <span class="en-text">Submit</span>
            </button>
        </a>
        {/if}
        {if ($contestStatus == 2) && ($OJ_MODE == 'online' || IsAdmin('administrator')) }
        <a href="__OJ__/problemset/summary?pid={$problem['problem_id']}" class="a_noline">
            <button type="button" class="btn btn-info">
                <span class="cn-text">统计</span>
                <span class="en-text">Summary</span>
            </button>
        </a>
        {/if}
        {if isset($contestStatus) && $contestStatus == 2 && isset($GIT_DISCUSSION) && !empty($GIT_DISCUSSION) }
        <a href="{$GIT_DISCUSSION}?discussions_q={$problem['problem_id']}" class="a_noline" target="_blank">
            <button type="button" class="btn btn-success">
                <span class="cn-text">讨论</span>
                <span class="en-text">Discussion</span>
            </button>
        </a>
        {/if}
        {if $OJ_STATUS=='exp' && ($ALLOW_TEST_DOWNLOAD || IsAdmin()) }
        <a href="/{$module}/{$controller}/testdata?cid={$contest['contest_id']}&pid={$apid}" class="a_noline">
            <button type="button" class="btn btn-warning">
                <span class="cn-text">评测数据</span>
                <span class="en-text">TestData</span>
            </button>
        </a>
        {/if}
    {else/}
        {if session('?user_id') }
        <a href="__OJ__/problemset/submit?pid={$problem['problem_id']}" class="a_noline">
            <button type="button" class="btn btn-primary">
                <span class="cn-text">提交</span>
                <span class="en-text">Submit</span>
            </button>
        </a>
        {else /}
        <a href="javascript:void(null)" class='disabled_problem_submit_button a_noline'>
            <button type="button" class="btn btn-secondary" title="Please login before submit!">
                <span class="cn-text">提交</span>
                <span class="en-text">Submit</span>
            </button>
        </a>
        {/if}
        <a href="__OJ__/problemset/summary?pid={$problem['problem_id']}" class="a_noline">
            <button type="button" class="btn btn-info">
                <span class="cn-text">统计</span>
                <span class="en-text">Summary</span>
            </button>
        </a>
        {if isset($GIT_DISCUSSION) && !empty($GIT_DISCUSSION) }
        <a href="{$GIT_DISCUSSION}?discussions_q={$problem['problem_id']}" class="a_noline" target="_blank">
            <button type="button" class="btn btn-success">
                <span class="cn-text">讨论</span>
                <span class="en-text">Discussion</span>
            </button>
        </a>
        {/if}
    {/if}
</div>
