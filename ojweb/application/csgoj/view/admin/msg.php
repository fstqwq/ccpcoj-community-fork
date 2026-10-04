<div class="admin-page-header">
    <div class="admin-page-header-left">
        <div class="admin-page-header-icon">
            <i class="bi bi-chat-dots"></i>
        </div>
        <h1 class="admin-page-header-title">
            <div class="admin-page-header-title-main">
                消息管理
            </div>
            <div class="admin-page-header-title-right">
                <a href="__CPC__/contest/contest?cid={$contest['contest_id']}" class="admin-page-header-id">
                    <i class="bi bi-hash"></i> {$contest['contest_id']}
                </a>
                <span class="en-text">
                    Message Management
                </span>
            </div>
        </h1>
    </div>
    <div class="admin-page-header-right">
        <button class="btn btn-primary btn-sm" id="add_msg_btn">
            <span class="cn-text"><i class="bi bi-plus-circle me-1"></i>添加消息</span><span class="en-text">Add Message</span>
        </button>
        <button class="btn btn-info btn-sm" id="preview_all_msg_btn">
            <span class="cn-text"><i class="bi bi-eye me-1"></i>预览全部</span><span class="en-text">Preview All</span>
        </button>
        <button class="btn btn-success btn-sm" id="preview_public_msg_btn">
            <span class="cn-text"><i class="bi bi-eye-fill me-1"></i>预览公开</span><span class="en-text">Preview Public</span>
        </button>
    </div>
</div>

<div class="container">
    <div id="table_toolbar" class="table-toolbar">
        <div class="d-flex align-items-center gap-2" role="form">
            <div class="toolbar-group">
                <span class="toolbar-label-inline"><span>消息状态</span><span class="toolbar-label en-text">Message Status</span></span>
                <select name="defunct" class="form-select toolbar-select msg_filter">
                    <option value="-1" selected>
                        All
                    </option>
                    <option value="0">
                        已发送 <span class="en-text">Sent</span>
                    </option>
                    <option value="1">
                        准备中 <span class="en-text">Prepared</span>
                    </option>
                </select>
            </div>
            <div class="toolbar-group">
                <span class="toolbar-label-inline"><span>搜索</span><span class="toolbar-label en-text">Search</span></span>
                <input id="msg_search_input" name="search" class="form-control toolbar-input msg_filter" type="text" placeholder="消息内容/发送者" style="width: 200px;">
            </div>
        </div>
    </div>
<table
    id="msg_table"
    class="bootstraptable_refresh_local"
    data-toggle="table"
    data-url="/{$module}/admin/msg_ajax?cid={$contest['contest_id']}"
    data-pagination="true"
    data-side-pagination="client"
    data-method="get"
    data-striped="true"
    data-search="false"
    data-search-align="left"
    data-sort-name="msg_id"
    data-sort-order="desc"
    data-pagination-v-align="bottom"
    data-pagination-h-align="left"
    data-pagination-detail-h-align="right"
    data-classes="table table-hover table-striped"
    data-show-refresh="true"
    data-buttons-align="left"
    data-toolbar="#table_toolbar"
    data-query-params="queryParams">
    <thead>
        <tr>
            <th data-field="msg_id" data-align="center" data-valign="middle" data-sortable="true" data-width="55">ID<span class="en-text">ID</span></th>
            <th data-field="content" data-align="left" data-valign="middle" data-sortable="true" data-formatter="FormatterContestMsgContent">内容<span class="en-text">Content</span></th>
            <th data-field="team_id" data-align="center" data-valign="middle" data-sortable="true" data-width="55" data-formatter="FormatterContestMsgUser">发送者<span class="en-text">Sender</span></th>
            <th data-field="defunct" data-align="center" data-valign="middle" data-sortable="true" data-width="55" data-formatter="FormatterContestMsgStatus">状态<span class="en-text">Status</span></th>
            <th data-field="edit" data-align="center" data-valign="middle" data-sortable="true" data-width="55" data-formatter="FormatterContestMsgEdit">编辑<span class="en-text">Edit</span></th>
            <th data-field="in_date" data-align="center" data-valign="middle" data-sortable="true" data-width="120">时间<span class="en-text">In Date</span></th>
        </tr>
    </thead>
</table>

<!-- Edit Modal Structure -->
<!-- Bootstrap 5.3 规范：Modal HTML 应该放在 top-level 位置，避免嵌套在其他元素中 -->
<div class="modal fade" id="msg_edit_modal" tabindex="-1" aria-labelledby="messageModalLabel" data-bs-backdrop="static">
    <div class="modal-dialog modal-xl">
        <div class="modal-content">
            <div class="modal-header">
                <h1 class="modal-title fs-5" id="messageModalLabel">
                    <span class="cn-text"><i class="bi bi-chat-dots me-2"></i>添加/编辑弹窗消息</span><span class="en-text">Add/Edit Message</span>
                </h1>
                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div class="modal-body">
                <form id="messageForm">
                    <div class="mb-3">
                        <label for="messageContent" class="form-label">
                            消息内容 (Markdown)<span class="en-text">Message Content (Markdown)</span>
                        </label>
                        <div id="vditor" class="form-control" style="height: 300px;"></div>
                        <div id="charCount" class="form-text text-muted">255 bytes remaining</div>
                    </div>
                </form>
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">关闭<span class="en-text">Close</span></button>
                <button type="button" class="btn btn-primary" id="saveMessageBtn">保存更改<span class="en-text">Save Changes</span></button>
            </div>
        </div>
    </div>
</div>

<!-- Content Modal Structure -->
<!-- Bootstrap 5.3 规范：Modal HTML 应该放在 top-level 位置 -->
<div class="modal fade" id="contentModal" tabindex="-1" aria-labelledby="contentModalLabel">
    <div class="modal-dialog modal-xl modal-max-width-900">
        <div class="modal-content">
            <div class="modal-header">
                <h1 class="modal-title fs-5" id="contentModalLabel">
                    <span class="cn-text"><i class="bi bi-eye me-2"></i>消息预览</span><span class="en-text">Message Preview</span>
                </h1>
                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div class="modal-body">
                {include file="../../csgoj/view/contest/msg_show" /}
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">关闭<span class="en-text">Close</span></button>
            </div>
        </div>
    </div>
</div>

<script type="text/javascript">
    // 定义 Formatter 函数（Bootstrap Table 需要全局函数）
    function FormatterContestMsgEdit(value, row, index, field) {
        return ContestMsgAdmin.formatterEdit(value, row, index, field);
    }
    
    function FormatterContestMsgStatus(value, row, index, field) {
        return ContestMsgAdmin.formatterStatus(value, row, index, field);
    }
    
    function FormatterContestMsgUser(value, row, index, field) {
        const cid = "<?php echo $contest['contest_id']; ?>";
        const page_module = "<?php echo $module; ?>";
        return ContestMsgAdmin.formatterUser(value, row, index, field, page_module, cid);
    }
    
    function FormatterContestMsgContent(value, row, index, field) {
        return ContestMsgAdmin.formatterContent(value, row, index, field);
    }
    
    // 初始化消息管理页面
    document.addEventListener('DOMContentLoaded', function() {
        ContestMsgAdmin.init({
            cid: "<?php echo $contest['contest_id']; ?>",
            page_module: "<?php echo $module; ?>",
            tableId: 'msg_table'
        });
    });
</script>
</div>