<script>
window.statusPageConfig = {
    cid: <?php echo isset($contest) ? $contest['contest_id'] : "'x'"; ?>,
    single_status_url: "<?php echo $single_status_url; ?>",
    show_code_url: "<?php echo $show_code_url; ?>",
    show_res_url: "<?php echo $show_res_url; ?>",
    user_id: "<?php echo $user_id; ?>",
    status_ajax_url: "/<?php echo $module; ?>/<?php echo $controller; ?>/status_ajax<?php echo isset($contest) ? '?cid=' . $contest['contest_id'] : ''; ?>",
    rejudge_url: "<?php
        if ($controller == 'contest') {
            // 比赛内重测：走各模块自己的 Admin（csgoj/admin, cpcsys/admin, expsys/admin, examsys/admin）
            echo '/' . $module . '/admin/contest_rejudge_ajax?cid=' . $contest['contest_id'];
        } else {
            // 全局题目重测：OJ_STATUS=exp 时应走 exadmin（练习/课程模式的管理后台）
            echo ($OJ_STATUS == 'exp') ? '/exadmin/problem/problem_rejudge_ajax' : '/admin/problem/problem_rejudge_ajax';
        }
    ?>",
    status_page_where: "<?php echo $controller == 'contest' ? 'contest' : 'problemset'; ?>",
    module: "<?php echo $module; ?>",
    OJ_MODE: "<?php echo $OJ_MODE; ?>",
    OJ_STATUS: "<?php echo $OJ_STATUS; ?>",
    now_course_key: "<?php echo isset($NOW_COURSE_KEY) ? $NOW_COURSE_KEY : null; ?>"
};
</script>
