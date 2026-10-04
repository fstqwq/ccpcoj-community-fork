<script type="text/javascript">
    // 题目重判配置
    window.rejudgeConfig = {
        module: "<?php echo $module; ?>",
        submit_url: "/<?php echo $module; ?>/problem/problem_rejudge_ajax"
    };
</script>

{include file="../../admin/view/problem/problem_rejudge_page" /}