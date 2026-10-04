{include file="../../csgoj/view/public/base_csg_switch" /}

<div class="admin-page-header">
    <div class="admin-page-header-left">
        <div class="admin-page-header-icon">
            <i class="bi bi-shuffle"></i>
        </div>
        <h1 class="admin-page-header-title">
            <div class="admin-page-header-title-main">
                机位抽签
            </div>
            <div class="admin-page-header-title-right">
                <span class="en-text">Seat Draw</span>
            </div>
        </h1>
    </div>
    <div class="admin-page-header-right">
        <button type="button" class="btn btn-outline-info btn-sm" data-bs-toggle="collapse" data-bs-target="#seatdraw_help_div" aria-expanded="false" aria-controls="seatdraw_help_div">
            <span class="cn-text"><i class="bi bi-question-circle me-1"></i>帮助</span><span class="en-text">Help</span>
        </button>
    </div>
</div>

<div class="container admin-import-container">
    <article id="seatdraw_help_div" class="alert alert-info collapse csg-admin-help-collapse">
        <p class="mb-2 bilingual-inline"><span class="cn-text"><strong>任选其一</strong>即可完成录入。</span><span class="en-text">Choose <strong>either</strong> method — both are optional.</span></p>
        <ul class="mb-2 small seatdraw-help-list ps-3">
            <li class="bilingual-inline"><span class="cn-text"><strong>方式一：</strong>下载「队伍」或「分区」模板填入后上传；系统自动识别。<strong>分区</strong>与<strong>队伍</strong>分两表上传，成功后会弹出相应提示。</span><span class="en-text"><strong>Excel:</strong> use the Teams or Zones template and upload — we detect which it is. You’ll get a confirmation when zones or teams are loaded.</span></li>
            <li class="bilingual-inline"><span class="cn-text"><strong>方式二：</strong>在两个框里分别从表格粘贴考场、队伍两块，在各区域标题栏右侧点「应用」。</span><span class="en-text"><strong>Text:</strong> paste rooms and teams in separate boxes, then use <strong>Apply</strong> on the right of each block title.</span></li>
            <li class="bilingual-inline"><span class="cn-text"><strong>类型列：</strong>可填 <code>0</code> / <code>1</code> / <code>2</code> 或写「正式、女队、打星」等。</span><span class="en-text"><strong>Type:</strong> <code>0</code>/<code>1</code>/<code>2</code>, or Regular / Girls / Star.</span></li>
        </ul>
        <p class="small text-muted bilingual-inline mb-0"><span class="cn-text">关闭页面前数据会记在浏览器里；点「清空缓存」会擦掉。</span><span class="en-text">Data is kept until you clear cache.</span></p>
    </article>

    <p class="seatdraw-mode-intro text-muted mb-3 small bilingual-inline"><span class="cn-text"><strong>任选一种</strong>录入即可，不必同时使用下面两栏。</span><span class="en-text">Pick <strong>either</strong> column — Excel <strong>or</strong> text — as you prefer.</span></p>

    <div class="row g-4 mb-4 align-items-stretch seatdraw-input-mode-row">
        <div class="col-lg mb-lg-0">
            <div class="card h-100 shadow-sm seatdraw-mode-card seatdraw-mode-card--excel">
                <div class="card-header seatdraw-card-header-accent">
                    <h5 class="card-title mb-0 bilingual-stack">
                        <span class="cn-text"><span class="badge rounded-pill text-bg-primary align-middle me-2">方式一</span><i class="bi bi-file-earmark-excel me-1 align-middle"></i>Excel</span>
                        <span class="en-text small d-block mt-1 mb-0">Mode 1 · Excel</span>
                    </h5>
                </div>
                <div class="card-body">
                    <p class="small text-muted bilingual-inline mb-3"><span class="cn-text">下载队伍或分区模板，填好上传即可；成功后会提示<strong>分区已导入</strong>或<strong>队伍已导入</strong>。也可用混排行表。</span><span class="en-text">Download a template, fill it, upload — you’ll see <strong>Zones imported</strong> or <strong>Teams imported</strong>. Mixed sheets OK.</span></p>
                    <div class="row g-3">
                        <div class="col-md-6">
                            <div class="btn-group w-100 shadow-sm seatdraw-template-dl-group" role="group" aria-label="Excel 模板">
                                <button type="button" id="seatdraw_dl_team" class="btn btn-success">
                                    <span class="cn-text d-inline-block"><i class="bi bi-download me-1"></i>队伍模板</span>
                                    <span class="en-text d-block small mb-0">Teams</span>
                                </button>
                                <button type="button" id="seatdraw_dl_partition" class="btn btn-success">
                                    <span class="cn-text d-inline-block"><i class="bi bi-download me-1"></i>分区模板</span>
                                    <span class="en-text d-block small mb-0">Zones</span>
                                </button>
                            </div>
                        </div>
                        <div class="col-md-6">
                            <button type="button" id="seatdraw_excel_pick_btn" class="btn btn-outline-primary w-100">
                                <span class="cn-text d-inline-block"><i class="bi bi-file-earmark-excel me-1"></i>上传表格</span>
                                <span class="en-text d-block small mb-0">Upload file</span>
                            </button>
                            <input type="file" id="seatdraw_excel_file_input" class="d-none" accept=".xlsx,.xls" />
                        </div>
                    </div>
                    <div class="table-responsive seatdraw-mini-table-wrap mt-3">
                        <div class="d-flex flex-wrap justify-content-between align-items-baseline gap-2 mb-1">
                            <p class="form-text tiny-hint bilingual-inline mb-0"><span class="cn-text">分区预览</span><span class="en-text">Zones preview</span></p>
                            <span class="text-muted small bilingual-inline tiny-hint mb-0"><span class="cn-text">总机位</span><span class="en-text">Total seats</span><span class="text-danger fw-semibold ms-1" id="seat_num_span">0</span></span>
                        </div>
                        <table
                            id="room_info_table"
                            data-toggle="table"
                            data-pagination="false"
                            data-method="get"
                            data-search="false"
                            data-sortable="false"
                            data-detail-view="true"
                            data-detail-view-by-click="true"
                            data-detail-view-icon="false"
                            data-classes="table table-sm table-hover table-striped"
                        >
                            <thead>
                            <tr>
                                <th data-field="idx" data-align="center" data-valign="middle" data-sortable="false" data-width="52" data-formatter="FormatterIndex">序</th>
                                <th data-field="room_name" data-align="center" data-valign="middle" data-sortable="false">名称</th>
                                <th data-field="seat_start" data-align="center" data-sortable="false" data-width="76">起始</th>
                                <th data-field="seat_end" data-align="center" data-sortable="false" data-width="76">结束</th>
                                <th data-field="seat_num" data-align="center" data-sortable="false" data-width="58">容量</th>
                            </tr>
                            </thead>
                        </table>
                    </div>
                </div>
            </div>
        </div>

        <div class="col-12 d-lg-none">
            <div class="seatdraw-or-line text-center text-muted small bilingual-inline" role="presentation"><span class="cn-text">— 或 —</span><span class="en-text">— Or —</span></div>
        </div>
        <div class="col-lg-auto d-none d-lg-flex align-items-stretch justify-content-center px-1 px-xl-2">
            <div class="seatdraw-or-pillar" role="presentation">
                <div class="seatdraw-or-pillar__inner bilingual-stack text-center">
                    <span class="cn-text fw-semibold">或</span>
                    <span class="en-text small">Or</span>
                </div>
            </div>
        </div>

        <div class="col-lg mb-lg-0">
            <div class="card h-100 shadow-sm seatdraw-mode-card seatdraw-mode-card--text">
                <div class="card-header">
                    <h5 class="card-title mb-0 bilingual-stack">
                        <span class="cn-text"><span class="badge rounded-pill text-bg-secondary align-middle me-2">方式二</span><i class="bi bi-clipboard-data me-1 align-middle"></i>复制粘贴</span>
                        <span class="en-text small d-block mt-1 mb-0">Mode 2 · Copy &amp; paste</span>
                    </h5>
                </div>
                <div class="card-body">
                    <p class="small text-muted bilingual-inline mb-3"><span class="cn-text">从 Excel/WPS 等复制；考场与队伍各占一框。</span><span class="en-text">Paste two blocks from spreadsheets: rooms then teams.</span></p>

                    <div class="seatdraw-text-block rounded border mb-3 p-3 bg-body-secondary bg-opacity-25">
                        <div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-2">
                            <label for="room_input" class="form-label mb-0 bilingual-inline fw-semibold"><span class="cn-text">考场</span><span class="en-text">Rooms</span></label>
                            <button type="button" class="btn btn-success btn-sm btn-func flex-shrink-0 room_submit"><span class="cn-text">应用考场</span><span class="en-text">Apply rooms</span></button>
                        </div>
                        <p class="form-text tiny-hint bilingual-inline mb-1"><span class="cn-text">每行一条：<code>#</code> 或 Tab 隔开「名称、起止编号」或「名称、座位数」</span><span class="en-text">One room per line: name + range or head count.</span></p>
                        <textarea class="form-control form-control-sm font-monospace" id="room_input" rows="4" placeholder="机房A#1#30&#10;区域B#40"></textarea>
                    </div>

                    <div class="seatdraw-text-block rounded border mb-3 p-3 bg-body-secondary bg-opacity-25">
                        <div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-2">
                            <label for="team_input" class="form-label mb-0 bilingual-inline fw-semibold"><span class="cn-text">队伍</span><span class="en-text">Teams</span></label>
                            <button type="button" class="btn btn-success btn-sm btn-func flex-shrink-0 team_submit"><span class="cn-text">应用队伍</span><span class="en-text">Apply teams</span></button>
                        </div>
                        <p class="form-text tiny-hint bilingual-inline mb-1"><span class="cn-text">每行一队：Tab 隔「队名、学校、成员、教练、类型、备注」</span><span class="en-text">One team per tab‑separated line.</span></p>
                        <textarea class="form-control form-control-sm font-monospace" id="team_input" rows="4" placeholder="一队&#9;某大学&#9;甲、乙&#9;&#9;0&#9;"></textarea>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <div class="btn-toolbar flex-wrap gap-2 mb-3 align-items-center seatdraw-action-toolbar" role="toolbar">
        <button class="btn btn-func btn-outline-secondary button_fullscreen" type="button"><span class="cn-text"><i class="bi bi-arrows-fullscreen me-1"></i>全屏</span><span class="en-text">Fullscreen</span></button>
        <button class="btn btn-func btn-outline-danger button_clear" type="button"><span class="cn-text">清空缓存</span><span class="en-text">Clear cache</span></button>
        <button class="btn btn-func btn-success button_draw" type="button"><span class="cn-text">按种子排座</span><span class="en-text">Draw once</span></button>
        <div class="btn-group seatdraw-export-dd dropup" role="group">
            <button type="button" class="btn btn-func btn-primary dropdown-toggle seatdraw-export-dd-toggle" data-bs-toggle="dropdown" aria-expanded="false" disabled>
                <span class="seatdraw-export-dd-label">
                    <span class="cn-text">导出·单位序</span>
                    <span class="en-text">Export · by school</span>
                </span>
            </button>
            <ul class="dropdown-menu dropdown-menu-end" role="menu">
                <li><a href="#" class="dropdown-item seatdraw-export-item py-2" role="menuitem" data-btype="school" data-export-fmt="xlsx"><span class="cn-text d-block fw-semibold">Excel（.xlsx）</span><span class="en-text small text-muted">Spreadsheet</span></a></li>
                <li><a href="#" class="dropdown-item seatdraw-export-item py-2" role="menuitem" data-btype="school" data-export-fmt="csv"><span class="cn-text d-block fw-semibold">CSV</span><span class="en-text small text-muted">Comma-separated</span></a></li>
            </ul>
        </div>
        <div class="btn-group seatdraw-export-dd dropup" role="group">
            <button type="button" class="btn btn-func btn-primary dropdown-toggle seatdraw-export-dd-toggle" data-bs-toggle="dropdown" aria-expanded="false" disabled>
                <span class="seatdraw-export-dd-label">
                    <span class="cn-text">导出·队号序</span>
                    <span class="en-text">Export · by team id</span>
                </span>
            </button>
            <ul class="dropdown-menu dropdown-menu-end" role="menu">
                <li><a href="#" class="dropdown-item seatdraw-export-item py-2" role="menuitem" data-btype="team_id" data-export-fmt="xlsx"><span class="cn-text d-block fw-semibold">Excel（.xlsx）</span><span class="en-text small text-muted">Spreadsheet</span></a></li>
                <li><a href="#" class="dropdown-item seatdraw-export-item py-2" role="menuitem" data-btype="team_id" data-export-fmt="csv"><span class="cn-text d-block fw-semibold">CSV</span><span class="en-text small text-muted">Comma-separated</span></a></li>
            </ul>
        </div>
    </div>

    <div id="seatdraw_div_fullscreen">
        <div id="seatdraw_div">
            <div id="seatdraw_table_toolbar" class="seatdraw-draw-toolbar mb-3">
                <div class="seatdraw-draw-toolbar__left flex-grow-1 min-w-0">
                    <div class="input-group input-group-lg" role="group">
                        <button class="btn btn-lg btn-success text-draw-go flex-shrink-0" id="seatdraw_button" type="button"><span class="cn-text">开始</span><span class="en-text">Start</span></button>
                        <span class="input-group-text text-draw-go bilingual-inline flex-shrink-0"><span class="cn-text">种子</span><span class="en-text">Seed</span></span>
                        <input type="text" class="form-control text-draw-go font-monospace" id="seatdraw_seed" placeholder="1024" value="1024" inputmode="numeric" autocomplete="off" />
                    </div>
                </div>
                <div class="seatdraw-draw-toolbar__right text-muted small bilingual-inline align-self-center mb-0">
                    <span class="cn-text d-block">快捷键：<kbd>S</kbd> 启/停 滚动抽签</span>
                    <span class="en-text d-block">Hotkey <kbd>S</kbd> rolls / stops</span>
                </div>
            </div>
            <table
                id="seatdraw_table"
                data-toggle="table"
                data-toolbar="#seatdraw_table_toolbar"
                data-pagination="false"
                data-search="false"
                data-sortable="false"
                data-classes="table table-no-bordered table-hover table-striped table-dark align-middle seatdraw-main-table"
            >
                <thead>
                <tr>
                    <th data-field="idx" data-align="center" data-valign="middle" data-sortable="false" data-width="52" data-formatter="FormatterIndex"><span class="seatdraw-th-stack"><span class="seatdraw-th-cn">序</span><span class="seatdraw-th-en en-text">#</span></span></th>
                    <th data-field="name" data-align="left" data-valign="middle" data-sortable="false" data-cell-style="SeatdrawCellStyleName"><span class="seatdraw-th-stack"><span class="seatdraw-th-cn">队名</span><span class="seatdraw-th-en en-text">Name</span></span></th>
                    <th data-field="school" data-align="left" data-valign="middle" data-sortable="false" data-formatter="FormatterSeatdrawSchool" data-cell-style="SeatdrawCellStyleSchool"><span class="seatdraw-th-stack"><span class="seatdraw-th-cn">单位</span><span class="seatdraw-th-en en-text">School</span></span></th>
                    <th data-field="tmember" data-align="left" data-valign="middle" data-sortable="false" data-width="240" data-cell-style="SeatdrawCellStyleMembers"><span class="seatdraw-th-stack"><span class="seatdraw-th-cn">成员</span><span class="seatdraw-th-en en-text">Members</span></span></th>
                    <th data-field="coach" data-align="left" data-valign="middle" data-sortable="false" data-width="100" data-cell-style="SeatdrawCellStyleCoach"><span class="seatdraw-th-stack"><span class="seatdraw-th-cn">教练</span><span class="seatdraw-th-en en-text">Coach</span></span></th>
                    <th data-field="tkind" data-align="center" data-valign="middle" data-sortable="false" data-width="112" data-formatter="FormatterSeatdrawTkind" data-cell-style="SeatdrawCellStyleTkind"><span class="seatdraw-th-stack"><span class="seatdraw-th-cn">类型</span><span class="seatdraw-th-en en-text">Type</span></span></th>
                    <th data-field="room" data-align="left" data-valign="middle" data-sortable="false" data-width="100" data-formatter="FormatterSeatdrawRoom" data-cell-style="SeatdrawCellStyleRoom"><span class="seatdraw-th-stack"><span class="seatdraw-th-cn">分区</span><span class="seatdraw-th-en en-text">Zone</span></span></th>
                    <th data-field="team_id" data-align="center" data-valign="middle" data-sortable="false" data-width="88" data-formatter="FormatterSeatdrawTeamId" data-cell-style="SeatdrawCellStyleTeamId"><span class="seatdraw-th-stack"><span class="seatdraw-th-cn">队号</span><span class="seatdraw-th-en en-text">Team ID</span></span></th>
                </tr>
                </thead>
            </table>
        </div>
    </div>
</div>

{include file="public/js_toolbox" /}
{include file="../../csgoj/view/public/js_exceljs" /}
{css href="__STATIC__/css/import_overlay.css" /}
{js href="__STATIC__/ojtool/js/seatdraw.js" /}

<style>
    .seatdraw-help-list > li + li { margin-top: 0.25rem; }
    .seatdraw-template-dl-group > .btn { flex: 1 1 0; min-width: 0; }
    .seatdraw-mode-intro { border-left: 3px solid var(--bs-primary); padding-left: 0.65rem; }
    .seatdraw-card-header-accent { background: linear-gradient(180deg, rgba(230,243,255,0.92) 0%, var(--bs-body-bg, #fff) 100%); border-bottom: 1px solid rgba(13,110,253,.15); }
    .seatdraw-or-line { letter-spacing: 0.12em; }
    .seatdraw-or-pillar { display: flex; align-items: center; min-height: 8rem; }
    .seatdraw-or-pillar__inner {
        padding: 0.5rem 0.72rem;
        border-radius: 999px;
        border: 2px dashed var(--bs-secondary);
        background: rgba(var(--bs-secondary-rgb),.06);
        color: var(--bs-secondary);
        line-height: 1.2;
        max-width: 3.75rem;
    }
    .bilingual-stack .en-text.small { opacity: .88; }
    .seatdraw-draw-toolbar {
        display: flex;
        flex-wrap: nowrap;
        align-items: stretch;
        gap: 0.85rem 1rem;
        max-width: 1280px;
        margin-left: auto;
        margin-right: auto;
    }
    @media (min-width: 576px) {
        .seatdraw-draw-toolbar__left { flex: 1 1 auto; max-width: 44rem; }
        .seatdraw-draw-toolbar__right { flex: 0 0 auto; text-align: right; padding-top: 0.15rem; max-width: 14rem; }
    }
    @media (max-width: 575.98px) {
        .seatdraw-draw-toolbar {
            flex-direction: column;
            align-items: stretch;
        }
        .seatdraw-draw-toolbar__right { text-align: left; padding-top: 0; max-width: none; }
    }
    .text-draw-go { font-size: clamp(1.1rem, 2.6vw, 1.95rem); }
    #seatdraw_seed.text-draw-go { flex: 1 1 6rem; min-width: 0; }
    #seatdraw_button { min-width: 5rem; padding-left: 0.85rem; padding-right: 0.85rem; }
    #seatdraw_div { max-width: 1280px; margin-left: auto; margin-right: auto; }
    #seatdraw_div_fullscreen { overflow-y: auto; }

    /* —— 原生全屏（#seatdraw_div_fullscreen）：顶栏抽签区深色沉浸，与主表色板一致 —— */
    #seatdraw_div_fullscreen:fullscreen,
    #seatdraw_div_fullscreen:-webkit-full-screen {
        --seatdraw-fs-bg: #06080c;
        --seatdraw-fs-panel: linear-gradient(165deg, #1a212c 0%, #12161d 55%, #10141a 100%);
        --seatdraw-fs-border: rgba(255, 255, 255, 0.14);
        box-sizing: border-box;
        width: 100%;
        min-height: 100vh;
        min-height: 100dvh;
        padding: clamp(0.75rem, 2vw, 1.35rem) clamp(0.65rem, 2.2vw, 1.5rem) 1.25rem;
        background: var(--seatdraw-fs-bg);
        color: rgba(255, 255, 255, 0.9);
    }
    #seatdraw_div_fullscreen:fullscreen #seatdraw_div,
    #seatdraw_div_fullscreen:-webkit-full-screen #seatdraw_div {
        max-width: min(96rem, 100%);
    }
    /* bootstrap-table 自带工具栏容器：全屏下去掉浅底 */
    #seatdraw_div_fullscreen:fullscreen #seatdraw_div .bootstrap-table > .fixed-table-toolbar,
    #seatdraw_div_fullscreen:-webkit-full-screen #seatdraw_div .bootstrap-table > .fixed-table-toolbar {
        margin: 0 0 0.35rem 0;
        padding: 0;
        background: transparent;
        border: none;
    }
    /* 抽签条：独立一块，与表体 #1e232d / 表头 #161a21 同系 */
    #seatdraw_div_fullscreen:fullscreen #seatdraw_table_toolbar.seatdraw-draw-toolbar,
    #seatdraw_div_fullscreen:-webkit-full-screen #seatdraw_table_toolbar.seatdraw-draw-toolbar {
        max-width: none;
        padding: 0.9rem 1.05rem;
        margin-bottom: 0.95rem !important;
        border-radius: 0.55rem;
        border: 1px solid var(--seatdraw-fs-border);
        background: var(--seatdraw-fs-panel);
        box-shadow:
            0 0 0 1px rgba(0, 0, 0, 0.35),
            0 10px 36px rgba(0, 0, 0, 0.42);
    }
    /* 开始：略提亮，与深色底协调 */
    #seatdraw_div_fullscreen:fullscreen #seatdraw_button.btn-success,
    #seatdraw_div_fullscreen:-webkit-full-screen #seatdraw_button.btn-success {
        font-weight: 700;
        border: 1px solid rgba(255, 255, 255, 0.12);
        box-shadow: 0 2px 0 rgba(0, 0, 0, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.12);
    }
    /* 种子前缀 + 输入框：深色填色，可读性拉满 */
    #seatdraw_div_fullscreen:fullscreen #seatdraw_table_toolbar .input-group-text,
    #seatdraw_div_fullscreen:-webkit-full-screen #seatdraw_table_toolbar .input-group-text {
        background: rgba(30, 35, 45, 0.95);
        color: rgba(235, 240, 250, 0.92);
        border-color: var(--seatdraw-fs-border);
    }
    #seatdraw_div_fullscreen:fullscreen #seatdraw_table_toolbar .input-group-text .en-text,
    #seatdraw_div_fullscreen:-webkit-full-screen #seatdraw_table_toolbar .input-group-text .en-text {
        opacity: 0.78;
        font-weight: 500;
    }
    #seatdraw_div_fullscreen:fullscreen #seatdraw_table_toolbar .form-control,
    #seatdraw_div_fullscreen:-webkit-full-screen #seatdraw_table_toolbar .form-control {
        background: rgba(18, 22, 29, 0.92);
        color: rgba(250, 252, 255, 0.98);
        border-color: var(--seatdraw-fs-border);
    }
    #seatdraw_div_fullscreen:fullscreen #seatdraw_table_toolbar .form-control::placeholder,
    #seatdraw_div_fullscreen:-webkit-full-screen #seatdraw_table_toolbar .form-control::placeholder {
        color: rgba(255, 255, 255, 0.35);
    }
    #seatdraw_div_fullscreen:fullscreen #seatdraw_table_toolbar .form-control:focus,
    #seatdraw_div_fullscreen:-webkit-full-screen #seatdraw_table_toolbar .form-control:focus {
        background: rgba(28, 33, 44, 0.98);
        color: #fff;
        border-color: rgba(32, 201, 151, 0.55);
        box-shadow: 0 0 0 0.2rem rgba(25, 135, 84, 0.28);
        outline: 0;
    }
    /* 快捷键说明：可读 + kbd */
    #seatdraw_div_fullscreen:fullscreen #seatdraw_table_toolbar .seatdraw-draw-toolbar__right,
    #seatdraw_div_fullscreen:-webkit-full-screen #seatdraw_table_toolbar .seatdraw-draw-toolbar__right {
        padding-top: 0.08rem !important;
    }
    #seatdraw_div_fullscreen:fullscreen #seatdraw_table_toolbar .seatdraw-draw-toolbar__right.text-muted,
    #seatdraw_div_fullscreen:-webkit-full-screen #seatdraw_table_toolbar .seatdraw-draw-toolbar__right.text-muted {
        color: rgba(210, 218, 232, 0.88) !important;
        --bs-text-opacity: 1;
    }
    #seatdraw_div_fullscreen:fullscreen #seatdraw_table_toolbar .seatdraw-draw-toolbar__right kbd,
    #seatdraw_div_fullscreen:-webkit-full-screen #seatdraw_table_toolbar .seatdraw-draw-toolbar__right kbd {
        display: inline-block;
        padding: 0.12em 0.45em 0.1em;
        font-size: 0.82em;
        font-weight: 650;
        line-height: 1.22;
        color: rgba(255, 255, 255, 0.95);
        background: rgba(255, 255, 255, 0.1);
        border: 1px solid rgba(255, 255, 255, 0.22);
        border-radius: 0.3rem;
        box-shadow: 0 1px 2px rgba(0, 0, 0, 0.25);
        vertical-align: 0.05em;
    }
    /* 全屏顶栏与表衔接：外层容器轻描边 */
    #seatdraw_div_fullscreen:fullscreen #seatdraw_div .bootstrap-table,
    #seatdraw_div_fullscreen:-webkit-full-screen #seatdraw_div .bootstrap-table {
        border-radius: 0 0 0.45rem 0.45rem;
        overflow: hidden;
    }

    /* 全屏时再压一层表头底色（避免别处 !important / 亮色主题盖掉 bootstrap-table 顶栏 thead） */
    #seatdraw_div_fullscreen:fullscreen #seatdraw_div .fixed-table-container .fixed-table-header,
    #seatdraw_div_fullscreen:-webkit-full-screen #seatdraw_div .fixed-table-container .fixed-table-header {
        background-color: #161a21 !important;
    }
    #seatdraw_div_fullscreen:fullscreen #seatdraw_div .fixed-table-container .fixed-table-header table thead > tr > th,
    #seatdraw_div_fullscreen:-webkit-full-screen #seatdraw_div .fixed-table-container .fixed-table-header table thead > tr > th {
        background-color: #161a21 !important;
        background-image: linear-gradient(to bottom, rgba(255, 255, 255, 0.048), transparent) !important;
        color: rgba(255, 255, 255, 0.9) !important;
        border-color: rgba(255, 255, 255, 0.11) !important;
    }
    #seatdraw_div_fullscreen:fullscreen #seatdraw_table.seatdraw-main-table thead > tr > th,
    #seatdraw_div_fullscreen:-webkit-full-screen #seatdraw_table.seatdraw-main-table thead > tr > th {
        background-color: #161a21 !important;
        background-image: linear-gradient(to bottom, rgba(255, 255, 255, 0.048), transparent) !important;
        color: rgba(255, 255, 255, 0.9) !important;
        border-color: rgba(255, 255, 255, 0.11) !important;
    }
    .admin-import-container .seatdraw-mini-table-wrap .fixed-table-toolbar { display: none; }
    .tiny-hint { font-size: 0.73rem; line-height: 1.35; }
    .seatdraw-action-toolbar .btn-func {
        min-height: 3rem;
        padding: 0.42rem 0.72rem;
        line-height: 1.12;
    }
    .seatdraw-action-toolbar .btn-func .cn-text { display: block; font-size: 0.98rem; font-weight: 600; }
    .seatdraw-action-toolbar .btn-func .en-text { display: block; margin-top: 0.12rem; font-size: 0.68rem; line-height: 1; }
    .seatdraw-action-toolbar .button_fullscreen {
        min-width: 4.4rem;
        padding-left: 0.62rem;
        padding-right: 0.62rem;
    }

    /* 导出下拉：双语文案与 caret 分行堆叠时易压字；用 flex 把标签与三角固定为左右列 */
    .seatdraw-export-dd .seatdraw-export-dd-toggle.dropdown-toggle {
        display: inline-flex;
        flex-direction: row;
        flex-wrap: nowrap;
        align-items: center;
        justify-content: center;
        gap: 0.5rem;
        white-space: normal;
        text-align: center;
        padding-left: 0.75rem;
        padding-right: 0.65rem;
        min-width: 9.5rem;
    }
    .seatdraw-export-dd .seatdraw-export-dd-label {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        min-width: 0;
        line-height: 1.12;
    }
    .seatdraw-export-dd .seatdraw-export-dd-label .cn-text {
        display: block;
        font-weight: 650;
        letter-spacing: 0.02em;
    }
    .seatdraw-export-dd .seatdraw-export-dd-label .en-text {
        display: block;
        margin-top: 0.14rem;
        font-size: 0.68rem;
        font-weight: 500;
        line-height: 1.15;
        opacity: 0.9;
    }
    .seatdraw-export-dd.dropup .seatdraw-export-dd-toggle.dropdown-toggle::after {
        flex: 0 0 auto;
        align-self: center;
        margin: 0;
        vertical-align: 0;
    }
    /* 主表深色底：表自身与斑马线；fixed 列宽以利类型列 badge 等宽 */
    #seatdraw_table.seatdraw-main-table.table-dark {
        --seatdraw-main-fg: rgba(255, 255, 255, 0.93);
        --seatdraw-muted-fg: rgba(255, 255, 255, 0.48);
        --seatdraw-head-bg: #161a21;
        --bs-table-bg: #1e232d;
        --bs-table-striped-bg: rgba(255, 255, 255, 0.048);
        --bs-table-hover-bg: rgba(255, 255, 255, 0.082);
        --bs-table-border-color: rgba(255, 255, 255, 0.1);
        --bs-table-color: var(--seatdraw-main-fg);
        color: var(--seatdraw-main-fg);
        border-color: rgba(255, 255, 255, 0.12);
        table-layout: fixed !important;
        width: 100%;
    }
    /* bootstrap-table 会复制 thead 到 .fixed-table-header，此处显式同色深底，避免表头仍为浅色块 */
    #seatdraw_div .bootstrap-table .fixed-table-container .fixed-table-header {
        background-color: var(--seatdraw-head-bg, #161a21);
        border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    }
    #seatdraw_div .bootstrap-table .fixed-table-container .fixed-table-header .seatdraw-main-table.table-dark thead tr > th,
    #seatdraw_table.seatdraw-main-table.table-dark thead tr > th {
        background-color: var(--seatdraw-head-bg, #161a21) !important;
        background-image: linear-gradient(to bottom, rgba(255, 255, 255, 0.045), rgba(255, 255, 255, 0));
        color: rgba(255, 255, 255, 0.9) !important;
        border-color: rgba(255, 255, 255, 0.12) !important;
        font-weight: 600;
        vertical-align: bottom !important;
        padding: 0.4rem 0.34rem !important;
        letter-spacing: 0.02em;
        white-space: normal !important;
        box-shadow: inset 0 -1px 0 rgba(255, 255, 255, 0.07);
    }
    #seatdraw_div .bootstrap-table .fixed-table-container .fixed-table-header .seatdraw-main-table thead th .seatdraw-th-stack,
    #seatdraw_table.seatdraw-main-table thead th .seatdraw-th-stack {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: flex-end;
        text-align: center;
        gap: 0.14rem;
        min-height: 2.5rem;
        line-height: 1.16;
    }
    #seatdraw_div .bootstrap-table .fixed-table-container .fixed-table-header .seatdraw-main-table thead th[data-field="name"] .seatdraw-th-stack,
    #seatdraw_div .bootstrap-table .fixed-table-container .fixed-table-header .seatdraw-main-table thead th[data-field="school"] .seatdraw-th-stack,
    #seatdraw_div .bootstrap-table .fixed-table-container .fixed-table-header .seatdraw-main-table thead th[data-field="tmember"] .seatdraw-th-stack,
    #seatdraw_div .bootstrap-table .fixed-table-container .fixed-table-header .seatdraw-main-table thead th[data-field="coach"] .seatdraw-th-stack,
    #seatdraw_div .bootstrap-table .fixed-table-container .fixed-table-header .seatdraw-main-table thead th[data-field="room"] .seatdraw-th-stack,
    #seatdraw_table.seatdraw-main-table thead th[data-field="name"] .seatdraw-th-stack,
    #seatdraw_table.seatdraw-main-table thead th[data-field="school"] .seatdraw-th-stack,
    #seatdraw_table.seatdraw-main-table thead th[data-field="tmember"] .seatdraw-th-stack,
    #seatdraw_table.seatdraw-main-table thead th[data-field="coach"] .seatdraw-th-stack,
    #seatdraw_table.seatdraw-main-table thead th[data-field="room"] .seatdraw-th-stack {
        align-items: flex-start;
        text-align: left;
    }
    #seatdraw_div .bootstrap-table .fixed-table-container .fixed-table-header .seatdraw-main-table thead th .seatdraw-th-cn,
    #seatdraw_table.seatdraw-main-table thead th .seatdraw-th-cn {
        display: block;
        font-size: 0.88rem;
        font-weight: 650;
        letter-spacing: 0.02em;
        line-height: 1.12;
    }
    #seatdraw_div .bootstrap-table .fixed-table-container .fixed-table-header .seatdraw-main-table thead th .seatdraw-th-en,
    #seatdraw_table.seatdraw-main-table thead th .seatdraw-th-en {
        display: block !important;
        font-size: 0.73rem !important;
        font-weight: 500 !important;
        opacity: 0.88;
        line-height: 1.06;
    }
    /* 顶栏复制的 table 可能没有 id #seatdraw_table，用列宽块里已对 th[data-field="tkind"] 设宽，兜底：凡 .fixed-table-header 内 thead 同色 */
    #seatdraw_div .bootstrap-table .fixed-table-container .fixed-table-header .table-dark thead tr > th {
        background-color: var(--seatdraw-head-bg, #161a21) !important;
        background-image: linear-gradient(to bottom, rgba(255, 255, 255, 0.045), rgba(255, 255, 255, 0));
        color: rgba(255, 255, 255, 0.9) !important;
        border-color: rgba(255, 255, 255, 0.12) !important;
    }
    #seatdraw_div .bootstrap-table .fixed-table-border,
    #seatdraw_div .bootstrap-table .table > :not(:first-child) {
        border-color: rgba(255, 255, 255, 0.1);
    }

    /* 与 contest 队伍生成表一致：单位/分区为多色 hash tag；队号为纯文本 */
    #seatdraw_table.seatdraw-main-table tbody td[data-field="school"] .teamgen-hash-cell,
    #seatdraw_table.seatdraw-main-table tbody td[data-field="room"] .teamgen-hash-cell {
        display: inline-flex;
        justify-content: center;
        max-width: 100%;
    }
    #seatdraw_table.seatdraw-main-table tbody td[data-field="school"] .teamgen-hash-cell {
        justify-content: flex-start;
    }
    #seatdraw_table.seatdraw-main-table tbody td[data-field="room"] .teamgen-hash-cell--start,
    #seatdraw_table.seatdraw-main-table tbody td[data-field="school"] .csg-hash-tag-list {
        justify-content: flex-start;
    }
    #seatdraw_table.seatdraw-main-table tbody td[data-field="team_id"] {
        color: rgba(226, 232, 246, 0.98);
        text-align: center;
        vertical-align: middle;
    }
    #seatdraw_table.seatdraw-main-table tbody td[data-field="team_id"] .seatdraw-teamid-plain.seatdraw-placeholder {
        color: var(--seatdraw-muted-fg);
        font-weight: 500;
    }

    /* 深色表上的多色标签：略微压暗边框、避免「飘」在背景上 */
    #seatdraw_table.seatdraw-main-table.table-dark .csg-hash-tag-badge {
        box-shadow:
            inset 0 0 0 1px rgba(0, 0, 0, 0.32),
            0 1px 1px rgba(0, 0, 0, 0.18);
        filter: brightness(0.97) saturate(1.06);
    }
    #seatdraw_table.seatdraw-main-table.table-dark .csg-hash-tag-empty,
    #seatdraw_table.seatdraw-main-table.table-dark .text-muted.csg-hash-tag-empty {
        color: var(--seatdraw-muted-fg) !important;
        opacity: 1;
    }

    /* 类型双语 badge（深色表）：压住横纹；等宽见 bilingual.css .csg-badge-eq */
    #seatdraw_table.seatdraw-main-table.table-dark tbody td[data-field="tkind"] .badge.csg-badge-eq {
        box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.45);
    }
    #seatdraw_table.seatdraw-main-table.table-dark tbody td[data-field="tkind"] .badge.bg-warning.text-dark.csg-badge-eq {
        color: rgba(34, 30, 20, 0.95) !important;
    }
    #seatdraw_table.seatdraw-main-table tbody td[data-field="tkind"] .seatdraw-tkind-wrap {
        display: flex;
        justify-content: center;
        align-items: center;
        width: 100%;
        min-width: 0;
    }
    #seatdraw_table.seatdraw-main-table .badge:not(.csg-badge-eq) {
        font-size: 0.65rem;
        font-weight: 600;
        padding: 0.18em 0.42em;
        line-height: 1.2;
    }
    #seatdraw_table.seatdraw-main-table .badge:not(.csg-badge-eq) .en-text {
        font-size: 0.58rem;
        margin-left: 0.15em;
    }
    #seatdraw_table.seatdraw-main-table .csg-hash-tag-list {
        gap: 0.2rem !important;
    }
</style>
