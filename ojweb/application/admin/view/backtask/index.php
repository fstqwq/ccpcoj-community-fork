<div class="page-title-actions">
<div id="bt_toolbar">
    <div class="d-flex align-items-center gap-2 flex-wrap" role="form">
        <button id="bt_refresh" type="button" class="btn btn-outline-secondary toolbar-btn" title="刷新 Refresh">
            <i class="bi bi-arrow-clockwise"></i>
        </button>
        <button id="bt_clear" type="button" class="btn btn-outline-secondary toolbar-btn" title="清空筛选 Clear filters">
            <i class="bi bi-eraser"></i>
        </button>
        <div class="toolbar-group">
            <input id="bt_task_id_input" name="task_id" class="form-control toolbar-input bt_filter" type="text" style="max-width:80px;" placeholder="Task ID" title="任务ID Task ID">
        </div>
        <div class="toolbar-group">
            <select id="bt_type_input" name="task_type" class="form-select toolbar-select bt_filter" style="min-width:120px;" title="任务类型 Task Type">
                <option value="">All 类型</option>
                {foreach $backtask_types_list as $btopt}
                <option value="{$btopt.value}">{$btopt.cn} {$btopt.en}</option>
                {/foreach}
            </select>
        </div>
        <div class="toolbar-group">
            <select id="bt_status_input" name="status" class="form-select toolbar-select bt_filter" style="min-width:120px;" title="状态 Status">
                <option value="-1">All 状态</option>
                <option value="0">待执行 Pending</option>
                <option value="10">执行中 Running</option>
                <option value="15">停止中 Stopping</option>
                <option value="20">已完成 Completed</option>
                <option value="30">失败 Failed</option>
                <option value="40">已取消 Cancelled</option>
            </select>
        </div>
    </div>
</div>
</div>

<table id="bt_table"
       class="bootstraptable_refresh_local"
       data-toggle="table"
       data-unique-id="task_id"
       data-url="/<?php echo $module; ?>/backtask/list_ajax"
       data-query-params="btQueryParams"
       data-response-handler="btResponseHandler"
       data-side-pagination="server"
       data-pagination="true"
       data-page-size="20"
       data-page-list="[10,20,50,100]"
       data-sort-name="task_id"
       data-sort-order="desc"
       data-pagination-v-align="bottom"
       data-pagination-h-align="left"
       data-pagination-detail-h-align="right"
       data-toolbar-align="left"
       data-toolbar="#bt_toolbar"
       data-classes="table table-hover table-striped table-bordered">
    <thead>
    <tr>
        <th data-field="task_id" data-sortable="true" data-width="70">ID</th>
        <th data-field="task_type" data-sortable="true" data-formatter="btTypeFmt" data-width="90">类型<span class="en-text">Type</span></th>
        <th data-field="status" data-formatter="btStatusFmt" data-sortable="true" data-width="100">状态<span class="en-text">Status</span></th>
        <th data-field="last_message" data-formatter="btProgressFmt">进度<span class="en-text">Progress</span></th>
        <th data-field="result" data-formatter="btResultFmt" data-align="left" data-width="220">结果<span class="en-text">Result</span></th>
        <th data-field="created_at" data-align="center" data-valign="middle" data-sortable="true" data-width="100" data-formatter="FormatterTime">创建<span class="en-text">Created</span></th>
        <th data-field="finished_at" data-align="center" data-valign="middle" data-width="100" data-formatter="FormatterTime">完成<span class="en-text">Finished</span></th>
        <th data-field="operate" data-formatter="btOperateFmt" data-width="88" data-align="center">操作<span class="en-text">Action</span></th>
    </tr>
    </thead>
</table>

{include file="../../admin/view/public/refresh_in_table" /}
{include file="../../csgoj/view/public/pkg_code_highlight" /}

<style>
#bt_detail_modal .modal-header { padding-top: 0.5rem; padding-bottom: 0.5rem; }
#bt_detail_modal .modal-title { font-size: 1rem; }
#bt_detail_modal .modal-body { padding: 0.5rem 0.75rem; }
@media (min-width: 576px) {
    #bt_detail_modal .modal-body { padding: 0.65rem 1rem; }
}
#bt_detail_modal .bt-detail-summary { margin-bottom: 0; table-layout: fixed; }
#bt_detail_modal .bt-detail-summary .bt-detail-th {
    width: 11%;
    max-width: 6.5rem;
    vertical-align: middle;
    font-weight: 500;
    font-size: 0.8125rem;
    line-height: 1.3;
    color: var(--bs-secondary-color);
    background-color: var(--bs-tertiary-bg);
    padding: 0.3rem 0.45rem;
    border-color: var(--bs-border-color);
    word-break: break-word;
    hyphens: auto;
}
#bt_detail_modal .bt-detail-summary .bt-detail-td {
    width: 39%;
    vertical-align: middle;
    font-size: 0.875rem;
    line-height: 1.35;
    padding: 0.3rem 0.5rem;
    word-break: break-word;
    overflow-wrap: anywhere;
    min-width: 0;
    border-color: var(--bs-border-color);
}
#bt_detail_modal .bt-detail-summary .bt-detail-td.bt-detail-nowrap { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
#bt_detail_modal .bt-detail-section-title { font-size: 0.8125rem; font-weight: 600; color: var(--bs-secondary-color); margin-bottom: 0.25rem; }
#bt_detail_modal pre.bt-detail-json {
    font-size: 0.8125rem;
    line-height: 1.45;
    margin-bottom: 0;
    background-color: var(--bs-tertiary-bg);
    border-color: var(--bs-border-color) !important;
}
#bt_detail_modal .bt-detail-json code { white-space: pre; word-break: normal; overflow-wrap: normal; }
#bt_detail_modal .bt-detail-logs .table { margin-bottom: 0; font-size: 0.8125rem; }
#bt_detail_modal .bt-detail-logs th { font-weight: 600; white-space: nowrap; }
#bt_detail_modal .bt-detail-logs td:last-child { word-break: break-word; overflow-wrap: anywhere; }
/* 后台任务列表：类型 tag、状态 badge */
.bt-type-tag { display: inline-block; line-height: 1.35; white-space: nowrap; max-width: 100%; overflow: hidden; text-overflow: ellipsis; vertical-align: middle; }
.bt-status-badge { min-width: 4.65rem; max-width: 5.75rem; box-sizing: border-box; }
.bt-status-badge-stack { display: inline-flex !important; flex-direction: column; align-items: center; justify-content: center; text-align: center; line-height: 1.2; padding-top: 0.3rem !important; padding-bottom: 0.3rem !important; }
.bt-status-badge-stack .bt-status-cn { font-weight: 600; font-size: 0.8125rem; }
.bt-status-badge-stack .bt-status-en { font-size: 0.65rem; font-weight: 400; line-height: 1.15; margin-top: 0.06rem; opacity: 0.9; }
/* 执行中 / 停止中：圆角矩形周界上移动的描边光点（SVG pathLength + stroke-dashoffset，非整体旋转） */
.bt-status-edge-wrap {
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    vertical-align: middle;
    padding: 3px;
    box-sizing: border-box;
}
.bt-status-edge-wrap[data-tone="primary"] { color: #2b7fff; }
.bt-status-edge-wrap[data-tone="warning"] { color: #e19a0f; }
.bt-status-edge-svg {
    position: absolute;
    left: 0;
    top: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    overflow: visible;
}
.bt-status-edge-track {
    fill: none;
    stroke: currentColor;
    stroke-width: 2;
    stroke-opacity: 0.22;
    vector-effect: non-scaling-stroke;
    paint-order: stroke fill;
}
.bt-status-edge-head {
    fill: none;
    stroke: currentColor;
    stroke-width: 2.75;
    stroke-linecap: round;
    stroke-linejoin: round;
    stroke-dasharray: 8 92;
    stroke-dashoffset: 0;
    vector-effect: non-scaling-stroke;
    /* 不使用 drop-shadow：部分浏览器 + 表格频繁刷新时，外发光合成易导致 stroke-dashoffset 动画「看起来停住」 */
    animation: bt-status-edge-crawl 2s linear infinite;
}
@keyframes bt-status-edge-crawl {
    from { stroke-dashoffset: 0; }
    to { stroke-dashoffset: -100; }
}
/* 系统「减少动态效果」开启时：仍保留沿边缓移（仅放慢），避免完全静止被误认为任务卡死 */
@media (prefers-reduced-motion: reduce) {
    .bt-status-edge-head {
        animation-duration: 4.5s;
        animation-timing-function: linear;
    }
}
.bt-status-edge-badge { position: relative; z-index: 1; }
/* 结果列：一律左对齐；双语同一行（中文主 + en-text 副），避免四行堆叠 */
.bt-res-download {
    display: inline-flex; align-items: center; justify-content: flex-start; gap: 6px;
    text-align: left; line-height: 1.3; padding: 0.2rem 0.45rem; max-width: 100%;
}
.bt-res-download-ico { flex-shrink: 0; font-size: 1.05rem; line-height: 1; opacity: 0.92; }
.bt-res-download-text { min-width: 0; text-align: left; }
.bt-res-compact { display: block; text-align: left; line-height: 1.35; word-break: break-word; }
.bt-res-compact-cn { font-weight: 600; font-size: 0.8125rem; }
.bt-res-compact-en { font-size: 0.68rem; font-weight: 400; opacity: 0.82; margin-left: 0.2rem; white-space: normal; }
.bt-res-error, .bt-res-ok {
    display: inline-flex; align-items: flex-start; justify-content: flex-start; gap: 6px;
    text-align: left; max-width: 100%;
}
.bt-res-ok--import { align-items: center; }
.bt-res-error-ico, .bt-res-ok-ico { flex-shrink: 0; margin-top: 0.15rem; font-size: 1rem; line-height: 1; }
.bt-res-ok--import .bt-res-ok-ico { margin-top: 0; }
.bt-res-error-text, .bt-res-ok-text { min-width: 0; text-align: left; }
.bt-res-error { color: var(--bs-danger); }
.bt-res-ok { color: var(--bs-success); }
/* 题目导入结果：同一行对齐的指标（图标与数字等高） */
.bt-import-metrics {
    display: inline-flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 0.4rem;
    line-height: 1.2;
}
.bt-import-sep {
    align-self: stretch;
    width: 1px;
    margin: 0.1rem 0;
    background: var(--bs-border-color);
    opacity: 0.55;
    flex-shrink: 0;
}
.bt-import-stat {
    display: inline-flex;
    align-items: center;
    gap: 0.2rem;
    font-weight: 600;
    font-size: 0.8125rem;
    line-height: 1;
    white-space: nowrap;
}
.bt-import-stat-ico {
    font-size: 1rem;
    line-height: 1;
    opacity: 0.92;
}
.bt-import-stat-num { line-height: 1; font-variant-numeric: tabular-nums; }
.bt-progress-link { cursor: pointer; }
.bt-progress-link:hover { color: var(--bs-primary) !important; }
</style>

<div class="modal fade" id="bt_detail_modal" tabindex="-1">
    <div class="modal-dialog modal-xl modal-dialog-scrollable">
        <div class="modal-content">
            <div class="modal-header">
                <h5 class="modal-title bilingual-inline">任务详情<span class="en-text">Task Detail</span></h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body" id="bt_detail_body"></div>
        </div>
    </div>
</div>

{js href="__STATIC__/js/backtask_list.js" /}
<script>
(function() {
    var BT_MODULE      = '<?php echo $module; ?>';
    var BT_CANCEL_URL  = '/' + BT_MODULE + '/backtask/cancel_ajax';
    var BT_DELETE_URL  = '/' + BT_MODULE + '/backtask/delete_ajax';
    var BT_DETAIL_URL  = '/' + BT_MODULE + '/backtask/detail_ajax';

    var BT_TYPE_LIST = <?php echo json_encode($backtask_types_list ?? [], JSON_UNESCAPED_UNICODE); ?>;
    var BT_TYPE_MAP = {};
    for (var _i = 0; _i < BT_TYPE_LIST.length; _i++) {
        var _x = BT_TYPE_LIST[_i];
        BT_TYPE_MAP[_x.value] = {cn: _x.cn, en: _x.en};
    }

    var BT_STATUS_MAP = {
        0:  {cn:'待执行',  en:'Pending',   color:'secondary'},
        10: {cn:'执行中',  en:'Running',   color:'primary'},
        15: {cn:'停止中',  en:'Stopping',  color:'warning'},
        20: {cn:'已完成',  en:'Completed', color:'success'},
        30: {cn:'失败',    en:'Failed',    color:'danger'},
        40: {cn:'已取消',  en:'Cancelled', color:'secondary'}
    };

    function btTypeHashColors(s) {
        var h = 0;
        s = String(s || '');
        for (var i = 0; i < s.length; i++) {
            h = ((h << 5) - h) + s.charCodeAt(i);
            h |= 0;
        }
        var hue = Math.abs(h) % 360;
        return {
            bg: 'hsl(' + hue + ', 42%, 92%)',
            fg: 'hsl(' + hue + ', 55%, 26%)',
            border: 'hsl(' + hue + ', 35%, 76%)'
        };
    }

    function btTypeLabel(value) {
        var t = BT_TYPE_MAP[value];
        if (t) return t;
        return {cn: value || '-', en: ''};
    }

    window.btTypeFmt = function(value) {
        var t = btTypeLabel(value);
        var c = btTypeHashColors(String(value || ''));
        var inner = DomSantize(t.cn);
        return '<span class="bt-type-tag rounded-pill px-2 py-0 border" style="font-size:0.72rem;background:' + c.bg + ';color:' + c.fg + ';border-color:' + c.border + ' !important;">' +
            inner + '</span>';
    };

    /** 与 .bt-status-edge-head 的 animation 默认时长一致（毫秒）；减少动态偏好下 CSS 周期为 4.5s，此处同步取模 */
    var BT_EDGE_CRAWL_MS = 2000;
    var BT_EDGE_CRAWL_MS_REDUCE = 4500;

    /**
     * 与外层圆角矩形共形的描边：周长 pathLength=100，dash 周期 8+92；列表定时 refresh 会重建 DOM，
     * 用负 animation-delay 把相位对齐到墙钟，避免每次刷新光点跳回起点。
     */
    function btStatusEdgeSvg() {
        var period = BT_EDGE_CRAWL_MS;
        try {
            if (typeof window !== 'undefined' && window.matchMedia &&
                window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
                period = BT_EDGE_CRAWL_MS_REDUCE;
            }
        } catch (e) { /* ignore */ }
        var delaySec = -((Date.now() % period) / 1000);
        var delayAttr = ' style="animation-delay:' + delaySec.toFixed(3) + 's"';
        return '<svg class="bt-status-edge-svg" viewBox="0 0 100 40" preserveAspectRatio="none" aria-hidden="true">' +
            '<rect class="bt-status-edge-track" x="1.75" y="1.75" width="96.5" height="36.5" rx="10" ry="10" pathLength="100" />' +
            '<rect class="bt-status-edge-head" x="1.75" y="1.75" width="96.5" height="36.5" rx="10" ry="10" pathLength="100"' + delayAttr + ' />' +
            '</svg>';
    }

    window.btStatusFmt = function(value, row) {
        var s = BT_STATUS_MAP[value] || {cn: String(value), en: '', color: 'secondary'};
        var enLine = s.en ? '<span class="en-text bt-status-en">' + DomSantize(s.en) + '</span>' : '';
        var badge = '<span class="badge bg-' + s.color + ' bt-status-badge bt-status-badge-stack bt-status-edge-badge">' +
            '<span class="bt-status-cn">' + DomSantize(s.cn) + '</span>' + enLine + '</span>';
        var inner;
        if (value == 10) {
            inner = '<span class="bt-status-edge-wrap" data-tone="primary" title="执行中 Running">' +
                btStatusEdgeSvg() + badge + '</span>';
        } else if (value == 15) {
            inner = '<span class="bt-status-edge-wrap" data-tone="warning" title="停止中 Stopping">' +
                btStatusEdgeSvg() + badge + '</span>';
        } else {
            inner = badge;
        }
        return '<span class="d-inline-flex align-items-center">' + inner + '</span>';
    };

    var BT_PROGRESS_DISP_MAX = 56;
    var BT_PROGRESS_FRIENDLY_CN = 'Worker 环境或权限异常';
    var BT_PROGRESS_FRIENDLY_EN = 'Worker env/permission error';

    function btIsInternalProgressMessage(s) {
        if (!s || typeof s !== 'string') return false;
        if (s.indexOf('禁止访问表') >= 0) return true;
        if (s.indexOf('frozenset') >= 0) return true;
        if (s.indexOf('Traceback') >= 0) return true;
        if (s.indexOf('仅允许') >= 0 && s.indexOf('backtask') >= 0) return true;
        if (s.indexOf('backtask worker') >= 0 && (s.indexOf('禁止') >= 0 || s.indexOf('错误') >= 0 || s.indexOf('仅允许') >= 0)) return true;
        return false;
    }

    function btTruncateProgressDisplay(s, maxLen) {
        s = String(s);
        if (s.length <= maxLen) return s;
        return s.substring(0, maxLen - 1) + '…';
    }

    window.btProgressFmt = function(value, row) {
        var tid = row.task_id;
        var raw = (value == null || value === '') ? '' : String(value);
        var inner;
        if (!raw) {
            inner = '<span class="text-muted">—</span> <span class="en-text small text-muted">Detail</span>';
        } else if (btIsInternalProgressMessage(raw)) {
            inner = '<span class="text-warning">' + DomSantize(BT_PROGRESS_FRIENDLY_CN) +
                ' <span class="en-text small">' + DomSantize(BT_PROGRESS_FRIENDLY_EN) + '</span></span>';
        } else {
            inner = DomSantize(btTruncateProgressDisplay(raw, BT_PROGRESS_DISP_MAX));
        }
        return '<a href="javascript:void(0)" class="bt-progress-link text-decoration-none d-block text-truncate" ' +
            'onclick="btShowDetail(' + tid + ')" title="查看进度与日志 View progress & logs">' + inner + '</a>';
    };

    window.btResultFmt = function(value, row) {
        if (typeof CsgBacktaskList !== 'undefined' && CsgBacktaskList.renderBacktaskResultHtml) {
            return CsgBacktaskList.renderBacktaskResultHtml(row.task_type, value, row, BT_MODULE);
        }
        if (!value) {
            if (parseInt(row.status, 10) < 20) return '<span class="text-muted">-</span>';
            return '';
        }
        try { JSON.parse(value); } catch (e) { return '<span class="text-muted">-</span>'; }
        return '';
    };

    window.btOperateFmt = function(value, row) {
        var tid = row.task_id;
        var status = parseInt(row.status, 10);
        var parts = [];
        if (status === 10) {
            parts.push('<a href="javascript:void(0)" class="text-warning text-decoration-none" onclick="btStop(' + tid + ')" title="停止任务 Stop task"><i class="bi bi-stop-circle"></i></a>');
        }
        if (status !== 10) {
            parts.push('<a href="javascript:void(0)" class="text-danger text-decoration-none' + (parts.length ? ' ms-2' : '') + '" onclick="btDelete(' + tid + ')" title="删除任务及日志 Delete task and logs"><i class="bi bi-trash"></i></a>');
        }
        return '<span class="d-inline-flex align-items-center flex-nowrap justify-content-center">' + parts.join('') + '</span>';
    };

    // ── anchor sync ──
    function getAnchorVal(key) {
        return (typeof csg !== 'undefined' && csg.GetAnchor) ? (csg.GetAnchor('bt_' + key) || null) : null;
    }
    function setAnchorVal(key, val) {
        if (typeof csg !== 'undefined' && csg.SetAnchor) csg.SetAnchor(val || '', 'bt_' + key);
    }
    function syncFromAnchor() {
        var v;
        v = getAnchorVal('task_id');
        $('#bt_task_id_input').val(v != null && String(v) !== '' ? String(v) : '');
        v = getAnchorVal('status');
        if (v != null && String(v) !== '') {
            $('#bt_status_input').val(String(v));
        } else {
            $('#bt_status_input').val('-1');
        }
        v = getAnchorVal('task_type');
        $('#bt_type_input').val(v != null && String(v) !== '' ? String(v) : '');
    }
    /**
     * 列表请求参数以工具栏 DOM 为准（与 URL anchor 一致由 writeBtFiltersToDomAndAnchor 维护）。
     * 不在此回读 anchor：否则用户清空输入后仍会被 hash 旧值「粘回」。
     */
    function readBtFiltersEffective() {
        var task_id = ($('#bt_task_id_input').val() || '').trim();
        var status = $('#bt_status_input').val();
        if (status === null || status === undefined || status === '') status = '-1';
        var task_type = ($('#bt_type_input').val() || '').trim();
        return { task_id: task_id, status: status, task_type: task_type };
    }
    function writeBtFiltersToDomAndAnchor(f) {
        $('#bt_task_id_input').val(f.task_id);
        $('#bt_status_input').val(f.status);
        $('#bt_type_input').val(f.task_type);
        window._bt_updating_anchor = true;
        try {
            setAnchorVal('task_id', f.task_id);
            setAnchorVal('status', f.status == '-1' ? '' : f.status);
            setAnchorVal('task_type', f.task_type);
        } finally {
            setTimeout(function() { window._bt_updating_anchor = false; }, 0);
        }
    }

    window.btQueryParams = function(params) {
        var f = readBtFiltersEffective();
        if (f.task_id) params.task_id = f.task_id;
        params.status = f.status;
        if (f.task_type) params.task_type = f.task_type;
        writeBtFiltersToDomAndAnchor(f);
        return params;
    };

    window.btResponseHandler = function(res) {
        if (res && res.data && typeof res.data.total !== 'undefined')
            return {total: res.data.total, rows: res.data.rows || []};
        if (res && typeof res.total !== 'undefined') return res;
        return {total: 0, rows: []};
    };

    // 在 bootstrap-table 的 document ready 初始化之前回填 hash，避免首屏 list_ajax 不带锚点筛选
    if (typeof csg !== 'undefined' && csg.GetAnchor) {
        syncFromAnchor();
    }

    // ── events ──
    $(function() {
        syncFromAnchor();
        var btTaskIdAnchorTimer = null;
        function syncTaskIdAnchorFromInput() {
            if (typeof csg === 'undefined' || !csg.SetAnchor) return;
            var v = ($('#bt_task_id_input').val() || '').trim();
            window._bt_updating_anchor = true;
            try {
                setAnchorVal('task_id', v);
            } finally {
                setTimeout(function() { window._bt_updating_anchor = false; }, 0);
            }
        }
        $('#bt_task_id_input').on('input', function() {
            clearTimeout(btTaskIdAnchorTimer);
            btTaskIdAnchorTimer = setTimeout(syncTaskIdAnchorFromInput, 200);
        });
        $('.bt_filter').on('change', function() {
            $('#bt_table').bootstrapTable('refresh', {pageNumber: 1});
        });
        $('#bt_task_id_input').on('keypress', function(e) {
            if (e.which === 13) { e.preventDefault(); $('#bt_table').bootstrapTable('refresh', {pageNumber: 1}); }
        });
        $('#bt_refresh').on('click', function() { $('#bt_table').bootstrapTable('refresh'); });
        $('#bt_clear').on('click', function() {
            $('.bt_filter').val(''); $('#bt_status_input').val('-1');
            window._bt_updating_anchor = true;
            try {
                setAnchorVal('task_id', ''); setAnchorVal('status', ''); setAnchorVal('task_type', '');
            } finally {
                setTimeout(function() { window._bt_updating_anchor = false; }, 0);
            }
            $('#bt_table').bootstrapTable('refresh', {pageNumber: 1});
        });
        $(window).on('hashchange.bt_filter', function() {
            if (window._bt_updating_anchor) return;
            syncFromAnchor();
            $('#bt_table').bootstrapTable('refresh', {pageNumber: 1});
        });
        // 自动刷新执行中的任务
        var autoTimer = null;
        $('#bt_table').on('load-success.bs.table', function(e, data) {
            clearTimeout(autoTimer);
            var rows = data.rows || data || [];
            if (rows.some(function(r) { return parseInt(r.status) < 20; })) {
                autoTimer = setTimeout(function() { $('#bt_table').bootstrapTable('refresh'); }, 3000);
            }
        });
    });

    // ── stop（执行中 → 停止中/已取消）──
    window.btStop = function(taskId) {
        alerty.confirm({
            message: '确定停止此任务？', message_en: 'Stop this task?',
            callback: function() {
                $.post(BT_CANCEL_URL, {task_id: taskId}, function(ret) {
                    if (ret.code == 1) $('#bt_table').bootstrapTable('refresh');
                    else alertRetBilingual(ret, 'error');
                }, 'json');
            }
        });
    };

    // ── delete（非执行中：删任务 + 日志）──
    window.btDelete = function(taskId) {
        alerty.confirm({
            message: '确定删除此任务及其日志？不可恢复。',
            message_en: 'Delete this task and all its logs? This cannot be undone.',
            callback: function() {
                $.post(BT_DELETE_URL, {task_id: taskId}, function(ret) {
                    if (ret.code == 1) $('#bt_table').bootstrapTable('refresh');
                    else alertRetBilingual(ret, 'error');
                }, 'json');
            }
        });
    };

    // ── detail modal ──
    window.btShowDetail = function(taskId) {
        var body = $('#bt_detail_body');
        body.html('<div class="text-center py-3"><div class="spinner-border spinner-border-sm text-primary"></div></div>');
        bootstrap.Modal.getOrCreateInstance(document.getElementById('bt_detail_modal')).show();
        $.get(BT_DETAIL_URL, {task_id: taskId}, function(ret) {
            if (ret.code != 1 || !ret.data) {
                body.html('<div class="alert alert-danger">加载失败<span class="en-text"> Load failed</span></div>');
                return;
            }
            var t = ret.data.task, logs = ret.data.logs || [];
            var html = '';
            html += '<div class="table-responsive rounded border mb-2">';
            html += '<table class="table table-sm table-bordered bt-detail-summary">';
            html += '<tbody>';
            html += _detailPairRow(
                {label: 'Task ID', value: String(t.task_id), tdClass: 'bt-detail-nowrap', title: String(t.task_id)},
                {label: '类型<span class="en-text">Type</span>', value: btTypeFmt(t.task_type)}
            );
            html += _detailPairRow(
                {label: '状态<span class="en-text">Status</span>', value: btStatusFmt(t.status, t)},
                {
                    label: '进度<span class="en-text">Progress</span>',
                    value: '<div class="bt-detail-progress-full" style="white-space:pre-wrap;word-break:break-word;max-height:min(35vh,200px);overflow:auto">' +
                        DomSantize(t.last_message || '-') + '</div>'
                }
            );
            html += _detailPairRow(
                {label: '创建<span class="en-text">Created</span>', value: DomSantize(t.created_at || '-'), tdClass: 'bt-detail-nowrap', title: t.created_at || ''},
                {label: '开始<span class="en-text">Started</span>', value: DomSantize(t.started_at || '-'), tdClass: 'bt-detail-nowrap', title: t.started_at || ''}
            );
            html += _detailPairRow(
                {label: '完成<span class="en-text">Finished</span>', value: DomSantize(t.finished_at || '-'), tdClass: 'bt-detail-nowrap', title: t.finished_at || ''},
                {label: 'Worker', value: '<span class="font-monospace">' + DomSantize(t.locked_by || '-') + '</span>', title: t.locked_by || ''}
            );
            html += '</tbody></table></div>';

            html += _jsonBlock('bt_params_code', '参数<span class="en-text">Params</span>', t.task_params);
            if (t.result) {
                html += _jsonBlock('bt_result_code', '结果<span class="en-text">Result</span>', t.result);
            }

            if (logs.length > 0) {
                html += '<div class="mt-2 bt-detail-logs">';
                html += '<div class="bt-detail-section-title bilingual-inline">执行日志<span class="en-text">Logs</span> <span class="text-muted fw-normal">(' + logs.length + ')</span></div>';
                html += '<div class="table-responsive rounded border"><table class="table table-sm table-bordered">';
                html += '<thead class="table-light"><tr>';
                html += '<th>时间<span class="en-text">Time</span></th>';
                html += '<th style="width:4.5rem">等级<span class="en-text">Lv</span></th>';
                html += '<th>信息<span class="en-text">Message</span></th></tr></thead><tbody>';
                var lvMap = {10:'INFO', 20:'WARN', 30:'ERROR'}, lvCls = {10:'', 20:'text-warning', 30:'text-danger fw-bold'};
                for (var i = 0; i < logs.length; i++) {
                    var l = logs[i];
                    html += '<tr><td class="text-nowrap">' + DomSantize(l.created_at || '') + '</td>';
                    html += '<td class="' + (lvCls[l.level]||'') + '">' + (lvMap[l.level]||DomSantize(String(l.level))) + '</td>';
                    html += '<td>' + DomSantize(l.message||'') + '</td></tr>';
                }
                html += '</tbody></table></div></div>';
            }
            body.html(html);

            // JSON 语法高亮
            requestAnimationFrame(function() {
                body.find('pre code.language-json').each(function() {
                    if (typeof CsgCodeHighlight !== 'undefined' && CsgCodeHighlight.highlightElementSafe) {
                        CsgCodeHighlight.highlightElementSafe(this);
                    } else if (typeof hljs !== 'undefined') {
                        try { hljs.highlightElement(this); } catch(e) {}
                    }
                });
            });
        }, 'json');
    };

    function _detailPairRow(left, right) {
        var th = ' scope="row" class="bt-detail-th"';
        function tdCell(spec) {
            var cls = 'bt-detail-td' + (spec.tdClass ? ' ' + spec.tdClass : '');
            var tit = spec.title ? ' title="' + DomSantize(spec.title) + '"' : '';
            return '<td class="' + cls + '"' + tit + '>' + spec.value + '</td>';
        }
        return '<tr><th' + th + '>' + left.label + '</th>' + tdCell(left) +
               '<th' + th + '>' + right.label + '</th>' + tdCell(right) + '</tr>';
    }

    function _jsonBlock(codeId, label, jsonStr) {
        var formatted = '';
        try { formatted = JSON.stringify(JSON.parse(jsonStr || '{}'), null, 2); } catch(e) { formatted = jsonStr || ''; }
        return '<div class="mt-2">' +
               '<div class="bt-detail-section-title bilingual-inline">' + label + '</div>' +
               '<pre class="border rounded p-2 bt-detail-json" style="max-height:min(40vh,220px);overflow:auto"><code id="' + codeId + '" class="language-json">' +
               DomSantize(formatted) + '</code></pre></div>';
    }
})();
</script>
