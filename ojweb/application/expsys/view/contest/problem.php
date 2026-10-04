{include file="../../csgoj/view/contest/problem" /}

<!-- expsys 专用逻辑：修改提示文本 -->
<script type="text/javascript">
    $(document).ready(function() {
        // 覆盖默认的提示文本
        $('.disabled_problem_submit_button').off('click').on('click', function(){
            var contestStatus = $('#contest_status').val();
            if(contestStatus == -1)
                alerty.error('习题尚未开始', 'Exercise not started!');
            else if(contestStatus == 2)
                alerty.error('习题已结束', 'Exercise ended!');
            else
                alerty.error($(this).attr('info_str'));
        });
    });
</script>
