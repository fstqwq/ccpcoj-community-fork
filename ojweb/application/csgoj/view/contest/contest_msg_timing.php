{if $controller == 'contest'}

<div class="modal fade" id="contentModal" tabindex="-1" aria-labelledby="contentModalLabel" aria-hidden="true">
    <div class="modal-dialog modal-xl">
        <div class="modal-content">
            <div class="modal-header">
                <h5 class="modal-title bilingual-inline" id="contentModalLabel">
                    <span class="cn-text"><i class="bi bi-bell me-2"></i>
                    比赛通知</span><span class="en-text">Contest Messages</span>
                </h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div class="modal-body">
                {include file="../../csgoj/view/contest/msg_show" /}
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-secondary bilingual-button" data-bs-dismiss="modal">
                    <span><i class="bi bi-x-circle me-1"></i>关闭</span>
                    <span class="en-text">Close</span>
                </button>
            </div>
        </div>
    </div>
</div>

<script>
    // 初始化比赛消息定时获取
    const CONTEST_MSG_TIMING_OPTION = {
        cid: <?php echo $contest['contest_id']; ?>,
        auto_show: <?php echo !$isContestAdmin && (!isset($isContestStaff) || !$isContestStaff) ? "true" : "false"; ?>
    }
    document.addEventListener('DOMContentLoaded', function() {
        ContestMsgTimingInit(CONTEST_MSG_TIMING_OPTION);
    });
    
</script>
{/if}