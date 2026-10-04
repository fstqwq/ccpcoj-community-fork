<div class="container-fluid mt-3">
    <div class="d-flex align-items-center justify-content-between mb-3">
        <button id="rank-refresh-btn" type="button" class="btn btn-outline-secondary btn-sm" title="刷新">
            <i class="bi bi-arrow-clockwise"></i> 刷新
        </button>
    </div>
    
    <!-- Bootstrap Table 榜单（原生 table，不使用 BootstrapTable 插件） -->
    <div class="table-responsive">
        <table id="rank-table" class="table table-hover table-striped">
            <thead>
            <tr>
                <th style="width: 60px; text-align: center;">排名</th>
                <th>队伍</th>
                <th style="width: 120px;">单位</th>
                <th style="width: 80px; text-align: center;">解题数</th>
                <th style="width: 100px; text-align: center;">罚时</th>
                <!-- 题目列将动态生成 -->
            </tr>
            </thead>
            <tbody>
            <!-- 数据将通过 JS 动态填充 -->
            </tbody>
        </table>
    </div>
    
    <!-- 加载提示 -->
    <div id="rank-loading" class="text-center py-4">
        <div class="spinner-border text-primary" role="status">
            <span class="visually-hidden">加载中...</span>
        </div>
        <div class="mt-2 text-muted">正在加载榜单数据...</div>
    </div>
</div>

<script>
    // 配置信息
    // 使用 IIFE 避免变量名冲突
    (function() {
        const timeStamp = $('#current_time_div').attr('time_stamp');
        let rank_time_diff = 0;
        if (timeStamp) {
            rank_time_diff = new Date(timeStamp * 1000).getTime() - new Date().getTime();
        }
        
        window.RANK_CONFIG = {
            key: '<?php echo $contest['contest_id']; ?>',
            cid_list: '<?php echo $contest['contest_id']; ?>',
            api_url: '/<?php echo $module; ?>/contest/contest_data_ajax',
            backend_time_diff: rank_time_diff || 0,
            flg_rank_cache: <?php echo isset($isContestAdmin) && $isContestAdmin ? 'false' : 'true'; ?>,
        };
        
        // 提供给提交记录 Modal 使用的配置信息
        window.EXP_RANK_MODAL_CONFIG = {
            module: '<?php echo $module; ?>',
            contest_id: <?php echo $contest['contest_id']; ?>
        };
    })();
</script>

<!-- 引入 RankSystem 和 ExpRankSystem -->
{include file="../../csgoj/view/public/js_rank"}
{css href="__STATIC__/expsys/ex_rank.css" /}
{js href="__STATIC__/expsys/ex_rank.js" /}

<!-- 预加载 status table 模板（用于 modal，隐藏） -->
<div id="status_table_modal_template" style="display: none;">
    {include file="../../csgoj/view/status/status_table_modal" /}
</div>

<!-- 引入 status 相关的 JavaScript 和样式 -->
{include file="../../csgoj/view/public/pkg_code_highlight" /}
{include file="../../csgoj/view/status/code_show" /}
{include file="../../csgoj/view/status/runinfo_show" /}
{js href="__STATIC__/csgoj/oj_status.js" /}
{js href="__STATIC__/csgoj/oj_status.css" /}

<script>
    // 初始化 ExpRankSystem
    let expRankSystem = null;
    
    /**
     * 表格更新回调
     */
    window.expRankTableUpdated = function(rankSystem) {
        // 隐藏加载提示
        const loadingEl = document.getElementById('rank-loading');
        if (loadingEl) {
            loadingEl.style.display = 'none';
        }
        
        // 显示表格
        const tableEl = document.getElementById('rank-table');
        if (tableEl) {
            tableEl.style.display = '';
        }
    };
    
    // 初始化榜单系统
    $(document).ready(function() {
        // 初始化榜单系统
        expRankSystem = ExpRankSystemInit('rank-table', window.RANK_CONFIG);
        
        // 刷新按钮事件（与F5键复用同一个RefreshData方法）
        $('#rank-refresh-btn').on('click', function() {
            if (expRankSystem) {
                expRankSystem.RefreshData();
            }
        });
    });
</script>
