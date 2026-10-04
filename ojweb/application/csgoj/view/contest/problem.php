<!-- 复用开放题目集模板，添加比赛定制化逻辑 -->
{include file="../../csgoj/view/problemset/problem" /}

<!-- 比赛专用逻辑 -->
<input type="hidden" id="contest_status" value="{$contestStatus}">
<script type="text/javascript">
    $('.disabled_problem_submit_button').on('click', function(){
        var contestStatus = $('#contest_status').val();
        if(contestStatus == -1)
            alerty.error('比赛尚未开始', 'Contest not started!');
        else if(contestStatus == 2)
            alerty.error('比赛已结束', 'Contest ended!');
        else
            alerty.error($(this).attr('info_str'));
    });
</script>