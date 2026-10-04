<div id="contest_rejudge_config" class="d-none"
     data-module="{$module}"
     data-contest-id="{$contest['contest_id']}"
     data-submit-url="{if isset($submit_url) && $submit_url != ''}{$submit_url}{else/}/{$module}/admin/contest_rejudge_ajax?cid={$contest['contest_id']}{/if}"
     data-problem-id-mode="{if isset($rejudge_problem_id_mode) && $rejudge_problem_id_mode != ''}{$rejudge_problem_id_mode}{else/}alphabet{/if}"
     data-contest-title="<?php echo htmlspecialchars(isset($contest_title) ? $contest_title : (isset($contest['title']) ? $contest['title'] : ''), ENT_QUOTES, 'UTF-8'); ?>"></div>
<script>
(function(){
 var el = document.getElementById('contest_rejudge_config');
 if (el && el.dataset) {
   var d = el.dataset;
   window.rejudgeConfig = window.contestRejudgeConfig = {
     module: d.module || '',
     contest_id: d.contestId || '',
     submit_url: d.submitUrl || '',
     problem_id_mode: d.problemIdMode || 'alphabet',
     contest_title: d.contestTitle || ''
   };
 }
})();
</script>

{include file="../../admin/view/problem/problem_rejudge_page" /}
{js href="__STATIC__/csgoj/admin/contest_rejudge.js" /}