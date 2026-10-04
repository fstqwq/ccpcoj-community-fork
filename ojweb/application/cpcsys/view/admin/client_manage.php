{include file="../../csgoj/view/public/base_csg_switch" /}

<div class="admin-page-header{if $contestStatus == 2} admin-page-header--with-ended-notice{/if}">
    <div class="admin-page-header-left">
        <div class="admin-page-header-icon">
            <i class="bi bi-laptop"></i>
        </div>
        <h1 class="admin-page-header-title">
            <div class="admin-page-header-title-main">
                客户端管理
            </div>
            <div class="admin-page-header-title-right">
                <a href="__CPC__/contest/contest?cid={$contest['contest_id']}" class="admin-page-header-id">
                    <i class="bi bi-hash"></i> {$contest['contest_id']}
                </a>
                <span class="en-text">
                    Client Management
                </span>
            </div>
        </h1>
    </div>
    {if $contestStatus == 2}
    <div class="admin-page-header-ended-notice" role="status">
        <div class="admin-page-header-ended-notice__line-cn">
            <i class="bi bi-lock-fill me-1" aria-hidden="true"></i>比赛已结束，不允许调整客户端
        </div>
        <div class="admin-page-header-ended-notice__line-en en-text">
            Contest ended, client management not allowed
        </div>
    </div>
    {/if}
    <div class="admin-page-header-right">
        {if $contestStatus != 2}
        <button type="button" id="collect_mode_toggle_btn" 
                class="btn btn-sm collect-mode-toggle me-2" 
                data-status="{$flg_collect_team_id}"
                data-invalid="{$is_collect_mode_invalid ? 1 : 0}"
                data-contest-id="{$contest['contest_id']}"
                {if $flg_collect_team_id == 1 && $is_collect_mode_invalid}
                title="当前：收集模式已开启但已无效（比赛前10分钟自动无效） / Current: Collect Mode Enabled but Invalid (automatically disabled 10 minutes before contest) | 点击切换为关闭 / Click to disable"
                {elseif $flg_collect_team_id == 1}
                title="当前：收集模式已开启 / Current: Collect Mode Enabled | 点击切换为关闭 / Click to disable"
                {else /}
                title="当前：收集模式已关闭 / Current: Collect Mode Disabled | 点击切换为开启 / Click to enable"
                {/if}>
            {if $flg_collect_team_id == 1}
            <span class="cn-text"><i class="bi bi-toggle-on"></i> 收集模式</span><span class="en-text">Collect Mode</span>
            {else /}
            <span class="cn-text"><i class="bi bi-toggle-off"></i> 收集模式</span><span class="en-text">Collect Mode</span>
            {/if}
        </button>
        {/if}
        <button type="button" class="btn btn-outline-info btn-sm" data-bs-toggle="collapse" data-bs-target="#client_help_div" aria-expanded="false" aria-controls="navbar">
            <span class="cn-text"><i class="bi bi-question-circle me-1"></i>
            帮助</span><span class="en-text">Help</span>
        </button>
    </div>
</div>
<div class="container admin-import-container">
    <article id="client_help_div" class="alert alert-info collapse">
        <h5 class="bilingual-inline">
            文本输入模式
            <span class="en-text">Text Input Mode</span>
        </h5>
        <p>每行一个客户端，该客户端信息由制表符<code>\t</code>隔开。信息从左到右依次为：</p>
        <p>队伍号、IP地址、SSH用户名、SSH密码、SSH RSA密钥、SSH端口、客户端类型，例如：</p>
        <p><code>team001[\t]192.168.1.100[\t]admin[\t]password123[\t][\t]22[\t]ssh</code></p>
        <p>客户端类型：<code>ssh</code> 表示 SSH 方式，<code>client</code> 表示客户端方式；留空默认为 ssh。</p>
        <p>SSH配置说明：</p>
        <ul>
            <li>如果所有SSH字段都为空，则不需要SSH配置</li>
            <li>如果提供SSH配置，则SSH用户名和端口为必填项</li>
            <li>SSH密码和RSA密钥至少需要提供一个</li>
            <li>SSH端口默认为22</li>
        </ul>
        
        <h5 class="bilingual-inline">
            Excel导入模式
            <span class="en-text">Excel Import Mode</span>
        </h5>
        <p>点击"下载模板"按钮下载Excel模板，填写信息后上传即可批量导入。</p>
        <p>模板包含所有必要字段，支持批量编辑客户端信息。</p>
    </article>
    
    {if $contestStatus != 2}
    
    <div class="row g-4">
        <div class="col-lg-6">
            <div class="card h-100">
                <div class="card-header">
                    <h5 class="card-title mb-0 bilingual-inline">
                        <span class="cn-text"><i class="bi bi-pencil-square me-2"></i>
                        文本输入模式
                        </span><span class="en-text">Text Input Mode</span>
                    </h5>
                </div>
                <div class="card-body">
                    <form id="client_manage_form" method='post' action="__CPC__/admin/contest_client_save_ajax?cid={$contest['contest_id']}">
                        <div class="mb-3">
                            <textarea id="client_description" class="form-control" 
                                placeholder="每行一个客户端，用制表符分隔... / One client per line, separated by tabs..." 
                                rows="3" name="client_description"></textarea>
                        </div>
                        <button type="button" id="parse_data_btn" class="btn btn-outline-primary w-100">
                            <span><i class="bi bi-search me-1"></i>解析数据</span>
                            <span class="en-text">Parse Data</span>
                        </button>
                    </form>
                </div>
            </div>
        </div>
        
        <div class="col-lg-6">
            <div class="card h-100">
                <div class="card-header">
                    <h5 class="card-title mb-0 bilingual-inline">
                        <span class="cn-text"><i class="bi bi-file-earmark-excel me-2"></i>
                        Excel导入模式
                        </span><span class="en-text">Excel Import Mode</span>
                    </h5>
                </div>
                <div class="card-body">
                    <div class="mb-3">
                        <button type="button" id="download_template_btn" class="btn btn-success w-100">
                            <span><i class="bi bi-download me-1"></i>下载模板</span>
                            <span class="en-text">Download Template</span>
                        </button>
                    </div>
                    <div class="mb-3">
                        <button type="button" id="excel_file_btn" class="btn btn-outline-primary w-100">
                            <span><i class="bi bi-file-earmark-excel me-1"></i>选择Excel文件</span>
                            <span class="en-text">Select Excel File</span>
                        </button>
                        <input type="file" id="excel_file_input" style="display: none;" accept=".xlsx,.xls" />
                        <div class="form-text">
                            <span class="bilingual-inline">
                                选择文件后将自动解析并预览数据
                                <span class="en-text">File will be parsed and previewed automatically after selection</span>
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
    {/if}

<div id="client_toolbar" class="mb-3">
    <div class="toolbar-container">
        <div class="toolbar-left">
            <h5 id="toolbar_title">
                <span class="cn-text"><i class="bi bi-table me-2"></i>
                数据预览</span><span class="en-text">Data Preview</span>
            </h5>
            <small class="text-muted" id="toolbar_subtitle">
                <span class="bilingual-inline">
                    请检查数据后执行导入
                    <span class="en-text">Please review data before importing</span>
                </span>
            </small>
        </div>
        <div id="preview_import_tip" class="preview-import-tip toolbar-center-tip csg-bilingual-stack" style="display: none;">
            <span class="cn-text"><strong>【注意】</strong>当前仅为提交前数据预览，尚未提交到服务器，需点击「执行导入」按钮完成实际提交。</span>
            <span class="en-text"><strong>Important:</strong> This is pre-submit data preview only; data has not been submitted yet. Click "Execute Import" to submit.</span>
        </div>
        <div class="toolbar-right">
            <button type="button" class="btn btn-success bilingual-button" id="execute_import_btn" style="display: none;">
                <span><i class="bi bi-check-circle me-1"></i>执行导入</span>
                <span class="en-text">Execute Import</span>
            </button>
            <button type="button" class="btn btn-info bilingual-button" id="export_standard_btn">
                <span><i class="bi bi-download me-1"></i>导出标准数据</span>
                <span class="en-text">Export Standard Data</span>
            </button>
            {if $contestStatus != 2}
            <button type="button" class="btn btn-success bilingual-button" id="add_single_btn">
                <span><i class="bi bi-plus-circle me-1"></i>单个添加</span>
                <span class="en-text">Add Single</span>
            </button>
            {/if}
            <button type="button" class="btn btn-danger bilingual-button" id="batch_delete_btn" style="display: none;">
                <span><i class="bi bi-trash me-1"></i>批量删除</span>
                <span class="en-text">Batch Delete</span>
            </button>
            <button type="button" class="btn btn-primary bilingual-button" id="batch_check_connect_btn" style="display: none;" title="仅在参赛机部署了客户端时有效 / Only effective when client is deployed on contest machines">
                <span><i class="bi bi-wifi me-1"></i>批量确认连接</span>
                <span class="en-text">Batch Check Connect</span>
            </button>
            <div id="batch_lock_unlock_group" class="btn-group" role="group" title="仅在参赛机部署了客户端时有效 / Only effective when client is deployed on contest machines">
                <button type="button" class="btn btn-warning bilingual-button" id="batch_lock_btn" style="display: none;">
                    <span><i class="bi bi-lock me-1"></i>批量锁屏</span>
                    <span class="en-text">Batch Lock</span>
                </button>
                <button type="button" class="btn btn-info bilingual-button" id="batch_unlock_btn" style="display: none;">
                    <span><i class="bi bi-unlock me-1"></i>批量解锁</span>
                    <span class="en-text">Batch Unlock</span>
                </button>
            </div>
        </div>
    </div>
    <div id="error_summary" class="alert alert-warning mt-2" style="display: none;">
        <i class="bi bi-exclamation-triangle me-2"></i>
        <span id="error_count">0</span> 行数据有错误，请检查后重新导入
        <span class="en-text">rows have errors, please check and re-import</span>
    </div>
</div>

<div class="table-responsive clientmgmt-table-wrap">
<table
    id="client_table"
    data-toggle="table"
    data-buttons-align="left"
    data-sort-name="team_id_bind"
    data-sort-order="asc"
    data-unique-id="client_id"
    data-toolbar="#client_toolbar"
    data-toolbar-align="right"
    data-pagination="false"
    data-method="get"
    data-url="__CPC__/admin/contest_client_list_ajax?cid={$contest['contest_id']}"
    data-multiple-select-row="true"
    data-click-to-select="true"
    data-maintain-meta-data="true"
    class="table table-striped table-hover clientmgmt-main-table"
    style="table-layout: auto; width: 100%;"
>
    <thead>
    <tr>
        <th data-field="state" data-checkbox="true" data-width="48" title="选择 / Select"><span class="teamgen-th-stack"><span class="teamgen-th-cn">选择</span><span class="teamgen-th-en en-text">Sel</span></span></th>
        <th data-field="idx" data-align="center" data-valign="middle" data-sortable="false" data-width="52" data-formatter="FormatterIdx" title="序号 / Index"><span class="teamgen-th-stack"><span class="teamgen-th-cn">序号</span><span class="teamgen-th-en en-text">#</span></span></th>
        <th data-field="team_id_bind" data-align="center" data-valign="middle" data-sortable="true" data-width="108" title="队伍号 / Team ID"><span class="teamgen-th-stack"><span class="teamgen-th-cn">队伍号</span><span class="teamgen-th-en en-text">Team ID</span></span></th>
        <th data-field="ip_bind" data-align="center" data-valign="middle" data-sortable="true" data-width="140" data-formatter="FormatterIpBind" title="IP地址(点击查看详情) / IP(click for details)"><span class="teamgen-th-stack"><span class="teamgen-th-cn">IP</span><span class="teamgen-th-en en-text">Address</span></span></th>
        <th data-field="client_type" data-align="center" data-valign="middle" data-sortable="true" data-width="72" data-formatter="FormatterClientType" title="客户端类型 / Client Type"><span class="teamgen-th-stack"><span class="teamgen-th-cn">类型</span><span class="teamgen-th-en en-text">Type</span></span></th>
        <!-- <th data-field="ssh_user" data-align="center" data-valign="middle" data-width="100" title="SSH用户 / SSH User">SSH用户<span class="en-text">SSH User</span></th>
        <th data-field="ssh_port" data-align="center" data-valign="middle" data-width="80" title="SSH端口 / SSH Port">SSH端口<span class="en-text">SSH Port</span></th>
        <th data-field="connect_status" data-align="center" data-valign="middle" data-width="100" data-formatter="FormatterConnectStatus" title="连接状态 / Connect Status">连接状态<span class="en-text">Connect Status</span></th>
        <th data-field="lock_status" data-align="center" data-valign="middle" data-width="100" data-formatter="FormatterLockStatus" title="锁屏状态 / Lock Status">锁屏状态<span class="en-text">Lock Status</span></th>
        <th data-field="ssh_actions" data-align="center" data-valign="middle" data-width="200" data-formatter="FormatterSshActions" data-sortable="false" data-visible="true" title="SSH操作 / SSH Actions">SSH操作<span class="en-text">SSH Actions</span></th> -->
        <th data-field="validation_errors" data-align="center" data-valign="middle" data-width="52" data-formatter="FormatterValidationErrors" data-visible="false" data-sortable="true" title="校验 / Validation"><span class="teamgen-th-stack"><span class="teamgen-th-cn">校验</span><span class="teamgen-th-en en-text">Valid</span></span></th>
        {if $contestStatus != 2}
        <th data-field="modify" data-align="center" data-valign="middle" data-width="56" data-formatter="FormatterModify" data-sortable="false" title="修改 / Modify"><span class="teamgen-th-stack"><span class="teamgen-th-cn">改</span><span class="teamgen-th-en en-text">Edit</span></span></th>
        <th data-field="delete" data-align="center" data-valign="middle" data-width="52" data-formatter="FormatterDel" data-sortable="false" title="删除 / Del(Dbl Click)"><span class="teamgen-th-stack"><span class="teamgen-th-cn">删</span><span class="teamgen-th-en en-text">Del</span></span></th>
        {/if}
    </tr>
    </thead>
</table>
</div>

<script type="text/javascript">
    var CLIENT_MANAGE_CONFIG = {
        contest_id: "<?php echo $contest['contest_id']; ?>",
        contest_title: "<?php echo htmlspecialchars($contest['title'], ENT_QUOTES, 'UTF-8'); ?>",
        contest_status: <?php echo $contestStatus; ?>,
        contest_start_time: <?php echo $contest['start_time'] ? strtotime($contest['start_time']) : 0; ?>,
        client_list_url: "/cpcsys/admin/contest_client_list_ajax?cid=<?php echo $contest['contest_id']; ?>",
        client_save_url: "/cpcsys/admin/contest_client_save_ajax?cid=<?php echo $contest['contest_id']; ?>",
        client_del_url: "/cpcsys/admin/contest_client_del_ajax?cid=<?php echo $contest['contest_id']; ?>",
        client_update_url: "/cpcsys/admin/contest_client_update_ajax?cid=<?php echo $contest['contest_id']; ?>",
        client_ssh_url: "/cpcsys/admin/contest_client_ssh_ajax?cid=<?php echo $contest['contest_id']; ?>"
    }
    
    TextAllowTab('client_description');
    
    $(function() {
        ClientManageInit();
        
        if (parseInt(CLIENT_MANAGE_CONFIG.contest_status, 10) === 2) {
            return;
        }
        
        // 初始化收集模式按钮样式（根据无效化状态）
        var collectModeBtn = $('#collect_mode_toggle_btn');
        var btnStatus = parseInt(collectModeBtn.attr('data-status'), 10);
        var btnInvalid = parseInt(collectModeBtn.attr('data-invalid'), 10);
        
        if (btnStatus == 1) {
            if (btnInvalid == 1) {
                collectModeBtn.removeClass('btn-outline-secondary btn-success').addClass('btn-warning');
            } else {
                collectModeBtn.removeClass('btn-outline-secondary btn-warning').addClass('btn-success');
            }
        } else {
            collectModeBtn.removeClass('btn-success btn-warning').addClass('btn-outline-secondary');
        }
        
        // 收集模式切换按钮事件
        $('#collect_mode_toggle_btn').on('click', function() {
            var btn = $(this);
            var currentStatus = parseInt(btn.attr('data-status'));
            var newStatus = currentStatus == 1 ? 0 : 1;
            
            // 如果要开启收集模式，显示确认对话框（红色醒目）
            if (newStatus == 1) {
                // 计算是否已经在无效化时间内（比赛前10分钟）
                var now = Math.floor(Date.now() / 1000);
                var startTime = CLIENT_MANAGE_CONFIG.contest_start_time || 0;
                var timeDiff = startTime - now;
                var isAlreadyInvalid = timeDiff < 600; // 600秒 = 10分钟
                
                // 构建提示信息
                var warningMessage = '';
                var warningMessageEn = '';
                
                if (isAlreadyInvalid) {
                    warningMessage = '<div class="alert alert-warning border-warning mb-3"><div class="alerty-bilingual"><div class="alerty-primary"><strong><i class="bi bi-exclamation-triangle-fill me-2"></i>当前时间已在比赛前10分钟内，收集模式开启后将立即无效！</strong></div><div class="alerty-secondary"><strong><i class="bi bi-exclamation-triangle-fill me-2"></i>Current time is within 10 minutes before the contest starts. Collect mode will be invalid immediately after enabling!</strong></div></div></div>';
                }
                
                var mainMessage = '<div class="alert alert-danger border-danger"><div class="alerty-bilingual"><div class="alerty-primary"><strong>收集模式将取代比赛登录页内容，提供账号收集功能；赛前10分钟将自动无效，但仍建议选手使用前手动关闭收集模式！</strong></div><div class="alerty-secondary"><strong>Collect mode will replace the contest login page content and provide account collection functionality. It will automatically become invalid 10 minutes before the contest starts, but it is still recommended to manually disable collect mode before contestants use it!</strong></div></div></div>';
                
                // 创建红色醒目的确认对话框
                var modalId = 'alerty-modal-' + Date.now();
                var modalHtml = `
                    <div class="modal fade" id="${modalId}" tabindex="-1" aria-labelledby="${modalId}Label" aria-hidden="true" data-bs-backdrop="static" data-bs-keyboard="false">
                        <div class="modal-dialog">
                            <div class="modal-content border-danger">
                                <div class="modal-header bg-danger text-white">
                                    <h5 class="modal-title bilingual-inline" id="${modalId}Label">
                                        <span class="cn-text"><i class="bi bi-exclamation-triangle-fill me-2"></i>警告</span>
                                        <span class="en-text">Warning</span>
                                    </h5>
                                    <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Close"></button>
                                </div>
                                <div class="modal-body">
                                    ${warningMessage}
                                    ${mainMessage}
                                </div>
                                <div class="modal-footer">
                                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">取消</button>
                                    <button type="button" class="btn btn-danger" id="alerty-confirm-btn">确定</button>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
                
                document.body.insertAdjacentHTML('beforeend', modalHtml);
                var modalElement = document.getElementById(modalId);
                var modal = new bootstrap.Modal(modalElement, {
                    backdrop: 'static',
                    keyboard: false
                });
                
                modalElement.querySelector('#alerty-confirm-btn').addEventListener('click', function() {
                    modal.hide();
                    toggleCollectMode(btn, newStatus);
                });
                
                modalElement.addEventListener('hidden.bs.modal', function() {
                    modalElement.remove();
                });
                
                modal.show();
            } else {
                toggleCollectMode(btn, newStatus);
            }
        });
    });
    
    function toggleCollectMode(btn, newStatus) {
        $.get('/cpcsys/admin/contest_collect_mode_toggle_ajax?cid=' + CLIENT_MANAGE_CONFIG.contest_id, function(ret) {
            if (ret && ret.code == 1) {
                // 更新按钮状态
                btn.attr('data-status', newStatus);
                
                // 计算是否已无效化（比赛前10分钟）
                var now = Math.floor(Date.now() / 1000);
                var startTime = CLIENT_MANAGE_CONFIG.contest_start_time || 0;
                var timeDiff = startTime - now;
                var isInvalid = (newStatus == 1 && timeDiff < 600); // 600秒 = 10分钟
                
                btn.attr('data-invalid', isInvalid ? 1 : 0);
                
                if (newStatus == 1) {
                    if (isInvalid) {
                        btn.removeClass('btn-outline-secondary btn-success').addClass('btn-warning');
                        btn.html('<span class="cn-text"><i class="bi bi-toggle-on"></i> 收集模式</span><span class="en-text">Collect Mode</span>');
                        btn.attr('title', '当前：收集模式已开启但已无效（比赛前10分钟自动无效） / Current: Collect Mode Enabled but Invalid (automatically disabled 10 minutes before contest) | 点击切换为关闭 / Click to disable');
                    } else {
                        btn.removeClass('btn-outline-secondary btn-warning').addClass('btn-success');
                        btn.html('<span class="cn-text"><i class="bi bi-toggle-on"></i> 收集模式</span><span class="en-text">Collect Mode</span>');
                        btn.attr('title', '当前：收集模式已开启 / Current: Collect Mode Enabled | 点击切换为关闭 / Click to disable');
                    }
                } else {
                    btn.removeClass('btn-success btn-warning').addClass('btn-outline-secondary');
                    btn.html('<span class="cn-text"><i class="bi bi-toggle-off"></i> 收集模式</span><span class="en-text">Collect Mode</span>');
                    btn.attr('title', '当前：收集模式已关闭 / Current: Collect Mode Disabled | 点击切换为开启 / Click to enable');
                }
                alerty.success('账号收集模式' + ret.data.status_str, 'Collect mode ' + ret.data.status_str);
            } else {
                alerty.error(ret?.msg || '切换失败', ret?.msg || 'Toggle failed');
            }
        }, 'json').fail(function() {
            alerty.error('切换失败，请重试', 'Toggle failed, please try again');
        });
    }
</script>

{include file="../../csgoj/view/public/js_exceljs" /}
{css href="__STATIC__/css/bilingual.css" /}
{css href="__STATIC__/css/import_overlay.css" /}
{js href="__STATIC__/js/bilingual.js" /}
{js href="__STATIC__/cpcsys/admin/client_manage.js" /}

<style type="text/css">
    .clientmgmt-table-wrap {
        max-width: 100%;
    }
    #client_table.clientmgmt-main-table {
        font-family: 'Simsun', 'Microsoft Yahei Mono', 'Lato', "PingFang SC", "Microsoft YaHei", sans-serif;
        font-size: 0.8125rem;
        word-wrap: break-word;
    }
    #client_table.clientmgmt-main-table tbody td {
        vertical-align: middle;
    }
    #client_table.clientmgmt-main-table thead th {
        font-size: 0.72rem;
        font-weight: 600;
        white-space: normal !important;
        word-break: keep-all;
        vertical-align: bottom !important;
        line-height: 1.12;
        padding: 0.32rem 0.28rem !important;
    }
    #client_table.clientmgmt-main-table .teamgen-th-stack {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: flex-end;
        text-align: center;
        gap: 0.1rem;
        min-height: 2.1rem;
    }
    #client_table.clientmgmt-main-table .teamgen-th-cn {
        display: block;
        line-height: 1.1;
    }
    #client_table.clientmgmt-main-table .teamgen-th-en {
        display: block !important;
        font-size: 0.62rem !important;
        font-weight: 500 !important;
        opacity: 0.86;
        line-height: 1.05;
    }
    #client_table.clientmgmt-main-table thead th[data-field="ip_bind"] .teamgen-th-stack {
        align-items: flex-start;
        text-align: left;
    }
    
    /* 针对Bootstrap Table生成的工具栏结构进行修复 */
    .fixed-table-toolbar {
        margin: 0 !important;
        padding: 0 !important;
    }
    
    .fixed-table-toolbar .bs-bars {
        float: none !important;
        display: block !important;
        width: 100% !important;
    }
    
    .fixed-table-toolbar .bs-bars.float-right {
        float: none !important;
    }
    
    /* 自定义工具栏样式 - 强制左对齐 */
    .toolbar-container {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        width: 100%;
        margin: 0;
        padding: 0;
    }
    
    .toolbar-left {
        flex: 1;
        margin: 0;
        padding: 0;
        text-align: left;
    }
    
    .toolbar-right {
        flex-shrink: 0;
        display: flex;
        flex-wrap: wrap;
        gap: 0.5rem;
        align-items: center;
        justify-content: flex-end;
        margin: 0;
        padding: 0;
    }
    
    /* 强制标题左对齐，移除所有默认间距 */
    #toolbar_title {
        margin: 0 !important;
        padding: 0 !important;
        text-align: left !important;
        line-height: 1.2;
    }
    
    #toolbar_subtitle {
        margin: 0 !important;
        padding: 0 !important;
        text-align: left !important;
        display: block;
        margin-top: 0.25rem !important;
    }
    
    /* 确保图标不产生额外间距 */
    #toolbar_title i {
        margin-right: 0.5rem;
    }
    
    /* 实际数据状态样式 */
    .toolbar-actual-data {
        background-color: rgba(13, 110, 253, 0.1) !important;
        border-left: 4px solid #0d6efd !important;
        padding: 0.75rem 1rem !important;
        border-radius: 0.375rem !important;
    }
    
    .toolbar-actual-data #toolbar_title {
        color: #0d6efd !important;
        font-size: 1.1rem !important;
        font-weight: 600 !important;
    }
    
    .toolbar-actual-data #toolbar_title i {
        color: #0d6efd !important;
    }
    
    /* 数据预览状态样式 */
    .toolbar-preview-data {
        background-color: rgba(255, 193, 7, 0.1) !important;
        border-left: 4px solid #ffc107 !important;
        padding: 0.75rem 1rem !important;
        border-radius: 0.375rem !important;
    }
    
    .toolbar-preview-data #toolbar_title {
        color: #b45309 !important;
        font-size: 1.1rem !important;
        font-weight: 600 !important;
    }
    
    .toolbar-preview-data #toolbar_title i {
        color: #b45309 !important;
    }
    
    .connect-status-icon {
        display: inline-block;
        width: 12px;
        height: 12px;
        border-radius: 50%;
        margin-right: 5px;
    }
    
    .connect-status-10min { background-color: #28a745; }
    .connect-status-30min { background-color: #ffc107; }
    .connect-status-2hour { background-color: #fd7e14; }
    .connect-status-old { background-color: #dc3545; }
    .connect-status-unknown { background-color: #6c757d; }
    
    /* 收集模式按钮样式 */
    .collect-mode-toggle {
        transition: all 0.3s ease;
    }
    
    .collect-mode-toggle[data-status="1"] {
        background-color: #198754;
        border-color: #198754;
        color: white;
    }
    
    /* 收集模式已开启但已无效化（比赛前10分钟） */
    .collect-mode-toggle[data-status="1"][data-invalid="1"] {
        background-color: #ffc107;
        border-color: #ffc107;
        color: #000;
    }
    
    .collect-mode-toggle[data-status="0"] {
        background-color: transparent;
        border-color: #6c757d;
        color: #6c757d;
    }
    
    /* 确认对话框红色醒目样式 */
    .alerty-modal .modal-content .alert-danger,
    .alerty-modal .modal-content .alert-warning {
        border-left: 4px solid #dc3545;
        background-color: #f8d7da;
    }
    
    /* 客户端详情弹窗：可复制项点击样式 */
    .client-detail-copy {
        cursor: pointer;
    }
    .client-ip-link {
        text-decoration: none;
        color: inherit;
    }
    .client-ip-link:hover {
        text-decoration: underline;
    }
</style>
<style type="text/css">
    #client_help_div {
        border: 0;
        border-radius: 0.75rem;
        color: var(--bs-body-color);
        background: var(--bs-body-bg);
        box-shadow: 0 0.4rem 1.2rem rgba(15, 23, 42, 0.08);
        padding: 1rem 1.1rem;
    }
    #client_help_div h5 {
        margin-top: 0.35rem;
        margin-bottom: 0.55rem;
        font-weight: 700;
    }
    #client_help_div p {
        margin-bottom: 0.45rem;
        line-height: 1.55;
    }
    #client_help_div ul {
        margin-bottom: 0.65rem;
    }
    #client_help_div code {
        color: #334155;
        background: #f1f5f9;
        border-radius: 0.35rem;
        padding: 0.08rem 0.32rem;
    }
</style>

