{include file="../../csgoj/view/public/base_csg_switch" /}

<div class="ccs-api-console container-fluid px-2 py-2">
    <div class="admin-page-header mb-2">
        <div class="admin-page-header-left">
            <div class="admin-page-header-icon">
                <i class="bi bi-braces"></i>
            </div>
            <h1 class="admin-page-header-title">
                <div class="admin-page-header-title-main">CCS Contest API</div>
                <div class="admin-page-header-title-right">
                    <a href="__CPC__/contest/contest?cid={$contest['contest_id']}" class="admin-page-header-id">
                        <i class="bi bi-hash"></i> {$contest['contest_id']}
                    </a>
                    <span class="en-text">ICPC CCS API explorer</span>
                </div>
            </h1>
        </div>
    </div>

    {if !$ccs_api_standard}
    <div class="alert alert-warning alert-sm py-2 mb-2" role="alert">
        <span class="cn-text">当前比赛不是 Standard 模式（private%10≠2），CCS REST 接口将返回 404；下方说明仍可查阅。</span>
        <span class="en-text">This contest is not Standard mode; CCS REST returns 404. Documentation below is still available.</span>
    </div>
    {/if}

    <div class="row g-2 ccs-api-console-row">
        <div class="col-lg-4 col-xl-3 d-flex flex-column min-h-0">
            <div class="card border shadow-sm flex-grow-1 d-flex flex-column min-h-0 h-100">
                <div class="card-header py-2 px-3 d-flex align-items-center gap-2 flex-wrap">
                    <label class="mb-0 flex-grow-1 small text-secondary" for="ccs_api_search">
                        <span class="cn-text">查找端点</span><span class="en-text">Find endpoint</span>
                    </label>
                    <span class="badge rounded-pill text-bg-light border" id="ccs_api_count_badge">0</span>
                </div>
                <div class="px-3 pt-2 pb-1">
                    <input type="search" class="form-control form-control-sm" id="ccs_api_search"
                           placeholder="URL / 中英文描述 / 空格表示同时包含…" autocomplete="off"
                           title="Filter by path or Chinese/English description">
                </div>
                <div class="list-group list-group-flush flex-grow-1 overflow-auto ccs-api-endpoint-list" id="ccs_api_list" role="listbox"></div>
            </div>
        </div>
        <div class="col-lg-8 col-xl-9 d-flex flex-column min-h-0">
            <div class="card border shadow-sm flex-grow-1 d-flex flex-column min-h-0 h-100">
                <div class="card-header py-2 px-3">
                    <span class="cn-text fw-semibold">端点说明与请求</span>
                    <span class="en-text fw-semibold">Details & request</span>
                </div>
                <div class="card-body flex-grow-1 overflow-auto py-2 px-3" id="ccs_api_detail">
                    <p class="text-muted small mb-0">
                        <span class="cn-text">请从左侧选择端点；文案与端点列表由静态资源加载。</span>
                        <span class="en-text">Select an endpoint on the left; catalog loads from static assets.</span>
                    </p>
                </div>
            </div>
        </div>
    </div>
</div>

<script>
window.CCS_API_CONSOLE_CONFIG = {
    contestId: <?php echo json_encode(strval($contest['contest_id'] ?? ''), JSON_UNESCAPED_UNICODE); ?>,
    isStandard: <?php echo !empty($ccs_api_standard) ? 'true' : 'false'; ?>
};
</script>
{include file="../../csgoj/view/public/pkg_code_highlight" /}
{css href="__STATIC__/cpcsys/admin/ccs_api_console.css" /}
{js href="__STATIC__/cpcsys/admin/ccs_api_catalog.js" /}
{js href="__STATIC__/cpcsys/admin/ccs_api_console.js" /}
