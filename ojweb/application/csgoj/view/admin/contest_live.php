{css href="__STATIC__/cpcsys/contestlive/css/contestlive.css" /}

<div class="admin-page-header">
    <div class="admin-page-header-left">
        <div class="admin-page-header-icon">
            <i class="bi bi-broadcast"></i>
        </div>
        <div class="admin-page-header-copy d-flex flex-column flex-grow-1 min-w-0">
            <h1 class="admin-page-header-title">
                <div class="admin-page-header-title-main">
                    <div class="contestlive-ctrl-bilingual-stack">
                        <span class="cn-text contestlive-ctrl-bilingual-stack__cn">直播控制台</span>
                        <span class="en-text contestlive-ctrl-bilingual-stack__en">Live control</span>
                    </div>
                </div>
                <div class="admin-page-header-title-right">
                    <a href="/{$module}/contest/contest?cid={$contest.contest_id}" class="admin-page-header-id">
                        <i class="bi bi-hash"></i> {$contest.contest_id}
                    </a>
                </div>
            </h1>
        </div>
    </div>
</div>

<div class="container contestlive-ctrl pb-5">
    <div class="card shadow-sm mb-4">
        <div class="card-header contestlive-ctrl-card-header-stacked">
            <div class="d-flex flex-wrap align-items-center justify-content-between gap-2 w-100">
                <div class="d-flex align-items-start gap-2 min-w-0">
                    <div class="contestlive-ctrl-bilingual-stack min-w-0">
                        <span class="cn-text contestlive-ctrl-bilingual-stack__cn">投屏页面矩阵</span>
                        <span class="en-text contestlive-ctrl-bilingual-stack__en">Display pages</span>
                    </div>
                    <button type="button" class="btn btn-sm btn-link p-0 contestlive-ctrl-panel-help-btn flex-shrink-0" data-bs-toggle="collapse" data-bs-target="#contestliveHintHub" aria-expanded="false" aria-controls="contestliveHintHub" title="展开或收起说明&#10;Show or hide help">
                        <i class="bi bi-question-circle text-secondary" aria-hidden="true"></i>
                        <span class="visually-hidden">说明</span>
                    </button>
                </div>
                <div class="d-flex flex-wrap align-items-center gap-2 gap-md-3 contestlive-token-inline">
                    <div class="contestlive-token-pass-label" title="投屏机免登录打开下方链接时，须先在赛前签发有效口令。&#10;Issue a pass so display URLs below work without sign-in.">
                        <div class="contestlive-ctrl-bilingual-stack small">
                            <span class="cn-text contestlive-ctrl-bilingual-stack__cn">投屏口令</span>
                            <span class="en-text contestlive-ctrl-bilingual-stack__en">Display pass</span>
                        </div>
                    </div>
                    <div class="contestlive-token-ttl-block d-flex flex-row flex-nowrap align-items-center gap-2">
                        <label for="contestlive_token_ttl" class="form-label small mb-0 contestlive-ctrl-bilingual-stack">
                            <span class="cn-text contestlive-ctrl-bilingual-stack__cn">有效时长（小时）</span>
                            <span class="en-text contestlive-ctrl-bilingual-stack__en">TTL (h)</span>
                        </label>
                        <input
                            type="number"
                            class="form-control form-control-sm contestlive-token-ttl-input"
                            id="contestlive_token_ttl"
                            value="6"
                            min="1"
                            max="720"
                            title="新生成的口令在多少小时内可用；过期后须重新签发或延长后再分发链接。&#10;How long the new pass stays valid; re-issue after expiry."
                            aria-label="口令有效小时数，Pass TTL in hours"
                        />
                    </div>
                    <div class="d-flex flex-wrap gap-2 align-items-center">
                        <button type="button" class="btn btn-sm btn-primary" id="contestlive_token_issue" title="生成新口令后，下面每一行的「复制链接」与点击「页面」列打开会带上新口令；有效期内可免登录。再次签发会使旧口令失效。&#10;After issue, Copy URL and Page opens include the pass. Re-issue invalidates the previous pass.">
                            <span class="contestlive-ctrl-bilingual-stack contestlive-ctrl-bilingual-stack--center"><span class="cn-text contestlive-ctrl-bilingual-stack__cn">签发口令</span><span class="en-text contestlive-ctrl-bilingual-stack__en">Issue pass</span></span>
                        </button>
                        <button type="button" class="btn btn-sm btn-outline-danger" id="contestlive_token_revoke" title="立刻作废当前及此前签发的所有投屏口令；已发出去的链接将无法打开，须重新签发后再复制分发。&#10;Voids all passes for this contest; issued URLs stop working until you issue again.">
                            <span class="contestlive-ctrl-bilingual-stack contestlive-ctrl-bilingual-stack--center"><span class="cn-text contestlive-ctrl-bilingual-stack__cn">重置口令</span><span class="en-text contestlive-ctrl-bilingual-stack__en">Revoke all</span></span>
                        </button>
                    </div>
                </div>
            </div>
            <div id="contestliveHintHub" class="collapse contestlive-ctrl-panel-hint-wrap">
                <div class="contestlive-ctrl-panel-hint pt-2 mt-2 border-top border-secondary-subtle">
                    <span class="cn-text d-block">一行一路由；签发口令后请用下方「复制」或「页面」打开，勿用本页地址栏；每场仅一条有效口令。</span>
                    <span class="en-text d-block">One row per display URL. After issuing a pass, use Copy or Page below—not this page’s address bar. One active pass per contest.</span>
                </div>
                <div class="contestlive-ctrl-panel-hint">
                    <span class="cn-text d-block">显示标题须点「保存」；批量换肤作用于下列各行，投屏页刷新后生效。</span>
                    <span class="en-text d-block">Save the display title. Batch skin applies to all rows; reload display pages.</span>
                </div>
            </div>
        </div>
        <div class="card-body py-2 px-3 border-bottom bg-light">
            <p class="small mb-0 text-success d-none" id="contestlive_token_meta" aria-live="polite"></p>
            <p class="small mb-0 text-danger d-none" id="contestlive_token_err"></p>
            <div class="mt-2 pt-2 border-top border-secondary-subtle">
                <div class="row g-3 align-items-start">
                    <div class="col-12 col-lg-6">
                        <label for="contestlive_hud_title_for_url" class="form-label small mb-1">
                            <span class="contestlive-ctrl-bilingual-inline">
                                <span class="cn-text fw-semibold">显示标题</span>
                                <span class="en-text contestlive-ctrl-bilingual-inline__en text-muted">Display title</span>
                            </span>
                        </label>
                        <div class="input-group input-group-sm">
                            <input
                                type="text"
                                class="form-control"
                                id="contestlive_hud_title_for_url"
                                maxlength="512"
                                autocomplete="off"
                                placeholder="{$contest.title|default=''}"
                                value="{$contest_live_hud_title_value|default=''}"
                                title="留空用赛题默认标题；保存后写入比赛设置。&#10;Empty uses contest title; Save writes contest settings."
                            />
                            <button type="button" class="btn btn-primary" id="contestlive_hud_title_save_btn" title="写入比赛设置&#10;Save contest settings">
                                <span class="contestlive-ctrl-bilingual-stack contestlive-ctrl-bilingual-stack--center">
                                    <span class="cn-text contestlive-ctrl-bilingual-stack__cn">保存</span>
                                    <span class="en-text contestlive-ctrl-bilingual-stack__en">Save</span>
                                </span>
                            </button>
                        </div>
                    </div>
                    <div class="col-12 col-lg-6">
                        <div class="small fw-semibold mb-1 contestlive-ctrl-bilingual-inline">
                            <span class="cn-text">批量换肤</span>
                            <span class="en-text contestlive-ctrl-bilingual-inline__en text-muted">Batch skin</span>
                        </div>
                        <div class="btn-group btn-group-sm flex-wrap" role="group" aria-label="统一各页外观">
                            <button type="button" class="btn btn-outline-secondary contestlive-ctrl-skin-batch" data-contestlive-skin="default">
                                <span class="contestlive-ctrl-bilingual-stack contestlive-ctrl-bilingual-stack--center">
                                    <span class="cn-text contestlive-ctrl-bilingual-stack__cn">默认</span>
                                    <span class="en-text contestlive-ctrl-bilingual-stack__en">Default</span>
                                </span>
                            </button>
                            <button type="button" class="btn btn-outline-secondary contestlive-ctrl-skin-batch" data-contestlive-skin="dark_stage">
                                <span class="contestlive-ctrl-bilingual-stack contestlive-ctrl-bilingual-stack--center">
                                    <span class="cn-text contestlive-ctrl-bilingual-stack__cn">暗色</span>
                                    <span class="en-text contestlive-ctrl-bilingual-stack__en">Dark</span>
                                </span>
                            </button>
                            <button type="button" class="btn btn-outline-secondary contestlive-ctrl-skin-batch" data-contestlive-skin="light_macaron">
                                <span class="contestlive-ctrl-bilingual-stack contestlive-ctrl-bilingual-stack--center">
                                    <span class="cn-text contestlive-ctrl-bilingual-stack__cn">明亮</span>
                                    <span class="en-text contestlive-ctrl-bilingual-stack__en">Light</span>
                                </span>
                            </button>
                        </div>
                    </div>
                </div>
                <p class="form-text small mb-0 mt-2" id="contestlive_ctrl_skin_feedback" aria-live="polite"></p>
            </div>
        </div>
        <div class="card-body p-0">
            <div class="table-responsive">
                <table class="table table-hover table-sm align-middle mb-0 contestlive-hub-table">
                    <thead class="table-light">
                        <tr>
                            <th scope="col">
                                <div class="contestlive-ctrl-bilingual-stack">
                                    <span class="cn-text contestlive-ctrl-bilingual-stack__cn">页面</span>
                                    <span class="en-text contestlive-ctrl-bilingual-stack__en">Page</span>
                                </div>
                            </th>
                            <th scope="col" class="contestlive-hub-th-skin text-nowrap">
                                <div class="contestlive-ctrl-bilingual-stack">
                                    <span class="cn-text contestlive-ctrl-bilingual-stack__cn">皮肤</span>
                                    <span class="en-text contestlive-ctrl-bilingual-stack__en">Skin</span>
                                </div>
                            </th>
                            <th scope="col">
                                <div class="contestlive-ctrl-bilingual-stack">
                                    <span class="cn-text contestlive-ctrl-bilingual-stack__cn">常见用途</span>
                                    <span class="en-text contestlive-ctrl-bilingual-stack__en">Typical use</span>
                                </div>
                            </th>
                            <th scope="col">
                                <div class="contestlive-ctrl-bilingual-stack">
                                    <span class="cn-text contestlive-ctrl-bilingual-stack__cn">复制链接</span>
                                    <span class="en-text contestlive-ctrl-bilingual-stack__en">Copy URL</span>
                                </div>
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr class="contestlive-hub-row contestlive-hub-row--main-pack" data-live-help="hud"
                            data-title-zh="主直播画面" data-title-en="Main live display"
                            data-desc-zh="整页综合 HUD：标题与徽标、左栏评测队列与最新过题、各题评测结果统计、内嵌实时榜单、底栏滚动提示等。各小组件另有独立投屏页，见下方矩阵。"
                            data-desc-en="Full-screen HUD: masthead, left column (queue, recent AC, verdict chart), embedded live scoreboard, ticker. Each widget also has its own display URL below."
                            data-keys="1~左栏信息~Left column;2~成绩榜~Scoreboard;3~标题与徽标~Title and logos;4~底部滚动提示~Bottom ticker;5~评测队列面板~Queue panel;6~最新过题面板~Recent AC panel;7~各题评测结果统计~Verdicts-by-problem chart;B~成绩区自动滚动~Auto-scroll scoreboard;↑,↓,PgUp,PgDn,Home,End~成绩区滚动~Scroll scoreboard;Tab~左侧两表切换~Switch tables;T~提交时间显示方式~Time style;O~画面明暗层次~Brightness steps;−~整页略缩小~Zoom out;,+,=~整页略放大~Zoom in;\~恢复整页缩放默认~Reset zoom;[~下一套外观（循环）~Cycle theme;]~恢复已保存外观并复位本页快捷键布局（本机）~Restore saved skin; reset per-page hotkey layout to defaults">
                            <td class="contestlive-hub-td-page" data-live-page="live" title="在新标签页打开投屏页 / Open display in new tab">
                                <span class="cn-text fw-semibold d-block">主直播画面（综合 HUD）</span>
                                <span class="en-text small text-muted d-block">Main live · full HUD</span>
                            </td>
                            <td class="contestlive-hub-td-skin">
                                <select class="form-select form-select-sm contestlive-ctrl-skin-page" data-live-page="live" aria-label="主直播画面外观"></select>
                            </td>
                            <td class="contestlive-hub-td-use small" title="查看本页说明与快捷键 / View description and shortcuts">
                                <span class="cn-text d-block">主画面 / 单源整页</span>
                                <span class="en-text text-muted d-block">Primary full-frame cast</span>
                            </td>
                            <td>
                                <div class="input-group input-group-sm">
                                    <input type="text" class="form-control contestlive-hub-url-inp" readonly data-live-page="live" value="" />
                                    <button type="button" class="btn btn-outline-secondary contestlive-hub-copybtn" title="复制本行投屏地址到剪贴板"><span class="cn-text">复制</span><span class="en-text d-block small">Copy</span></button>
                                </div>
                            </td>
                        </tr>
                        <tr class="contestlive-hub-row" data-live-help="balloon"
                            data-title-zh="气球层" data-title-en="Balloons"
                            data-desc-zh="单独一路透明叠层，用于在直播或榜单画面上方叠加气球等庆祝动效；默认无占位 UI。按 D 可试播一次上升动效以确认本路；按 I 可显示或隐藏占位提示与图标（本机记忆）。"
                            data-desc-en="Transparent overlay for celebration-style balloon effects above your program feed. No on-screen hint by default; press D for a one-shot sample burst; press I to show or hide the hint (saved locally)."
                            data-keys="D~试播一次气球上升动效~Sample balloon burst (once);I~显示或隐藏占位提示与图标~Show or hide on-page hint;O~画面明暗层次~Brightness steps;[~下一套外观（循环）~Cycle theme;]~恢复已保存外观并复位本页快捷键布局（本机）~Restore saved skin; reset per-page hotkey layout to defaults">
                            <td class="contestlive-hub-td-page" data-live-page="live_balloon" title="在新标签页打开投屏页 / Open display in new tab"><span class="cn-text d-block">气球层</span><span class="en-text small text-muted d-block">Balloons</span></td>
                            <td class="contestlive-hub-td-skin"><select class="form-select form-select-sm contestlive-ctrl-skin-page" data-live-page="live_balloon" aria-label="气球层页面外观"></select></td>
                            <td class="contestlive-hub-td-use small" title="查看本页说明与快捷键 / View description and shortcuts">
                                <span class="cn-text d-block">叠在主画面上方</span>
                                <span class="en-text text-muted d-block">Stack above main</span>
                            </td>
                            <td>
                                <div class="input-group input-group-sm">
                                    <input type="text" class="form-control contestlive-hub-url-inp" readonly data-live-page="live_balloon" value="" />
                                    <button type="button" class="btn btn-outline-secondary contestlive-hub-copybtn" title="复制本行投屏地址到剪贴板"><span class="cn-text">复制</span><span class="en-text d-block small">Copy</span></button>
                                </div>
                            </td>
                        </tr>
                        <tr class="contestlive-hub-row" data-live-help="wall"
                            data-title-zh="校徽墙" data-title-en="School wall"
                            data-desc-zh="由本场比赛参赛队学校筛选：仅当存在对应静态校徽文件（与榜单同源路径）时才显示一格；无文件的学校不占位。版面随有效格数自动铺满。"
                            data-desc-en="Shows only schools that have a matching static badge file (same path as the standings). Schools without a file are omitted. Layout fills to the number of badges."
                            data-keys="O~画面明暗层次~Brightness steps;[~下一套外观（循环）~Cycle theme;]~恢复已保存外观并复位本页快捷键布局（本机）~Restore saved skin; reset per-page hotkey layout to defaults;,~下一套校徽墙布局~Cycle school-wall layout;.~校徽墙布局恢复已保存~Restore saved school-wall layout">
                            <td class="contestlive-hub-td-page" data-live-page="live_schoolwall" title="在新标签页打开投屏页 / Open display in new tab">
                                <div class="d-flex align-items-start justify-content-between gap-2 flex-wrap">
                                    <div class="min-w-0 flex-grow-1">
                                        <span class="cn-text d-block">校徽墙</span>
                                        <span class="en-text small text-muted d-block">School badges</span>
                                    </div>
                                    <div class="contestlive-hub-page-extras flex-shrink-0 ms-auto">
                                        <select class="form-select form-select-sm contestlive-ctrl-schoolwall-layout" aria-label="校徽墙布局算法"></select>
                                    </div>
                                </div>
                            </td>
                            <td class="contestlive-hub-td-skin"><select class="form-select form-select-sm contestlive-ctrl-skin-page" data-live-page="live_schoolwall" aria-label="校徽墙页面外观"></select></td>
                            <td class="contestlive-hub-td-use small" title="查看本页说明与快捷键 / View description and shortcuts">
                                <span class="cn-text d-block">赞助氛围 / 候场</span>
                                <span class="en-text text-muted d-block">Backdrop</span>
                            </td>
                            <td>
                                <div class="input-group input-group-sm">
                                    <input type="text" class="form-control contestlive-hub-url-inp" readonly data-live-page="live_schoolwall" value="" />
                                    <button type="button" class="btn btn-outline-secondary contestlive-hub-copybtn" title="复制本行投屏地址到剪贴板"><span class="cn-text">复制</span><span class="en-text d-block small">Copy</span></button>
                                </div>
                            </td>
                        </tr>
                        <tr class="contestlive-hub-row" data-live-help="timer"
                            data-title-zh="比赛计时" data-title-en="Contest timer"
                            data-desc-zh="大屏仅突出大号计时；标题/状态默认隐藏（H、S）。大号数字有多套「显示方式」，赛前、赛中、赛后各自对应不同读数；按 T 在套装间循环切换（任意阶段均可），切换后在主读数下方短暂漂浮显示当前套装名称。默认套装：赛前为带符号的距离开赛；赛中为不带符号的距结束剩余；赛后主读数固定 00:00:00。另有「至整场计划结束」「正计时」「相对开赛」等套装。−/=（或 +）七档调大号字并本机按赛记忆，\ 恢复默认。与直播榜单顶栏同源脚本。"
                            data-desc-en="Large timer; title/status hidden (H, S). Several display packs for the main digits (before, during, after the contest). Press T anytime to cycle packs; a short floating label names the active pack. Default pack: signed countdown before start; unsigned remaining during the contest; zeros after end. Other packs cover planned end, elapsed-focused, and from-start styles. − / + / = adjust digit size; \ resets. Same script as the scoreboard timer bar."
                            data-keys="H~显示或隐藏比赛标题~Show or hide contest title;S~显示或隐藏比赛状态~Show or hide contest status;T~切换大号计时的显示套装~Cycle timer display pack;−~大号计时缩小一档~Smaller digits;+,=~大号计时放大一档~Larger digits;\~大号计时恢复默认字号~Reset digit size;O~画面明暗层次~Brightness steps;[~下一套外观（循环）~Cycle theme;]~恢复已保存外观并复位本页快捷键布局（本机）~Restore saved skin; reset per-page hotkey layout to defaults">
                            <td class="contestlive-hub-td-page" data-live-page="live_timer" title="在新标签页打开投屏页 / Open display in new tab"><span class="cn-text d-block">比赛计时</span><span class="en-text small text-muted d-block">Contest timer</span></td>
                            <td class="contestlive-hub-td-skin"><select class="form-select form-select-sm contestlive-ctrl-skin-page" data-live-page="live_timer" aria-label="比赛计时页外观"></select></td>
                            <td class="contestlive-hub-td-use small" title="查看本页说明与快捷键 / View description and shortcuts">
                                <span class="cn-text d-block">候场 / 角标全屏</span>
                                <span class="en-text text-muted d-block">Hold / corner overlay</span>
                            </td>
                            <td>
                                <div class="input-group input-group-sm">
                                    <input type="text" class="form-control contestlive-hub-url-inp" readonly data-live-page="live_timer" value="" />
                                    <button type="button" class="btn btn-outline-secondary contestlive-hub-copybtn" title="复制本行投屏地址到剪贴板"><span class="cn-text">复制</span><span class="en-text d-block small">Copy</span></button>
                                </div>
                            </td>
                        </tr>
                        <tr class="contestlive-hub-row" data-live-help="queue"
                            data-title-zh="评测队列（独立页）" data-title-en="Judge queue"
                            data-desc-zh="仅评测流水表，便于单独一路输出，再与其它画面叠加。快捷键 T 切换提交时间的相对/绝对显示。"
                            data-desc-en="Submissions table only. Press T to toggle relative vs absolute times."
                            data-keys="T~提交时间显示方式~Time style;O~画面明暗层次~Brightness steps;[~下一套外观（循环）~Cycle theme;]~恢复已保存外观并复位本页快捷键布局（本机）~Restore saved skin; reset per-page hotkey layout to defaults">
                            <td class="contestlive-hub-td-page" data-live-page="live_queue" title="在新标签页打开投屏页 / Open display in new tab"><span class="cn-text d-block">评测队列</span><span class="en-text small text-muted d-block">Judge queue</span></td>
                            <td class="contestlive-hub-td-skin"><select class="form-select form-select-sm contestlive-ctrl-skin-page" data-live-page="live_queue" aria-label="评测队列页面外观"></select></td>
                            <td class="contestlive-hub-td-use small" title="查看本页说明与快捷键 / View description and shortcuts">
                                <span class="cn-text d-block">判题流水单源</span>
                                <span class="en-text text-muted d-block">Standalone feed</span>
                            </td>
                            <td>
                                <div class="input-group input-group-sm">
                                    <input type="text" class="form-control contestlive-hub-url-inp" readonly data-live-page="live_queue" value="" />
                                    <button type="button" class="btn btn-outline-secondary contestlive-hub-copybtn" title="复制本行投屏地址到剪贴板"><span class="cn-text">复制</span><span class="en-text d-block small">Copy</span></button>
                                </div>
                            </td>
                        </tr>
                        <tr class="contestlive-hub-row" data-live-help="acfeed"
                            data-title-zh="最新过题（独立页）" data-title-en="Recent AC"
                            data-desc-zh="与综合 HUD 左栏「最新过题」同源：每队每题仅保留时间序上首次揭晓的 AC。快捷键 T 切换时间显示方式。默认隐藏页顶标题区，按 H 可显示或隐藏。"
                            data-desc-en="Same dedup rules as the HUD recent-AC panel. Press T to toggle time style. The page masthead is hidden by default; press H to show or hide it."
                            data-keys="H~显示或隐藏页顶标题区~Show or hide page masthead;T~提交时间显示方式~Time style;O~画面明暗层次~Brightness steps;[~下一套外观（循环）~Cycle theme;]~恢复已保存外观并复位本页快捷键布局（本机）~Restore saved skin; reset per-page hotkey layout to defaults">
                            <td class="contestlive-hub-td-page" data-live-page="live_ac" title="在新标签页打开投屏页 / Open display in new tab"><span class="cn-text d-block">最新过题</span><span class="en-text small text-muted d-block">Recent AC</span></td>
                            <td class="contestlive-hub-td-skin"><select class="form-select form-select-sm contestlive-ctrl-skin-page" data-live-page="live_ac" aria-label="最新过题页外观"></select></td>
                            <td class="contestlive-hub-td-use small" title="查看本页说明与快捷键 / View description and shortcuts">
                                <span class="cn-text d-block">过题庆祝条</span>
                                <span class="en-text text-muted d-block">AC strip</span>
                            </td>
                            <td>
                                <div class="input-group input-group-sm">
                                    <input type="text" class="form-control contestlive-hub-url-inp" readonly data-live-page="live_ac" value="" />
                                    <button type="button" class="btn btn-outline-secondary contestlive-hub-copybtn" title="复制本行投屏地址到剪贴板"><span class="cn-text">复制</span><span class="en-text d-block small">Copy</span></button>
                                </div>
                            </td>
                        </tr>
                        <tr class="contestlive-hub-row" data-live-help="combo"
                            data-title-zh="评测队列 + 最新过题 + 气球（合页）" data-title-en="Queue · AC · balloons"
                            data-desc-zh="左评测队列、右最新过题，与综合 HUD 同源；气球叠在顶层。5／6／7：左栏、右栏、气球层；H：双栏标题（本机）；T：两表时间格式。新的首次揭晓 AC 自动放气球，D 可试播一次。"
                            data-desc-en="Queue left, recent AC right (HUD feed); balloons on top. 5 / 6 / 7: left pane, right pane, balloons. H: mastheads (local). T: time style for both tables. First-seen AC triggers balloons; D samples once."
                            data-keys="5~显隐评测队列区块~Toggle judge queue pane;6~显隐最新过题区块~Toggle recent AC pane;7~显隐气球叠层~Toggle balloon overlay;H~显示或隐藏两栏顶部标题区~Show or hide both mastheads;T~提交时间相对/绝对~Relative vs absolute time;D~试播一次气球~Sample balloons;O~画面明暗层次~Brightness steps;[~下一套外观~Cycle theme;]~恢复外观并复位快捷键布局（本机）~Restore skin; reset hotkey layout">
                            <td class="contestlive-hub-td-page" data-live-page="live_combo" title="在新标签页打开投屏页 / Open display in new tab"><span class="cn-text d-block">队列·过题·气球</span><span class="en-text small text-muted d-block">Queue · AC · balloons</span></td>
                            <td class="contestlive-hub-td-skin"><select class="form-select form-select-sm contestlive-ctrl-skin-page" data-live-page="live_combo" aria-label="合页外观"></select></td>
                            <td class="contestlive-hub-td-use small" title="查看本页说明与快捷键 / View description and shortcuts">
                                <span class="cn-text d-block">一单源并排 + AC 气球联动</span>
                                <span class="en-text text-muted d-block">Split + balloons</span>
                            </td>
                            <td>
                                <div class="input-group input-group-sm">
                                    <input type="text" class="form-control contestlive-hub-url-inp" readonly data-live-page="live_combo" value="" />
                                    <button type="button" class="btn btn-outline-secondary contestlive-hub-copybtn" title="复制本行投屏地址到剪贴板"><span class="cn-text">复制</span><span class="en-text d-block small">Copy</span></button>
                                </div>
                            </td>
                        </tr>
                        <tr class="contestlive-hub-row" data-live-help="probstats"
                            data-title-zh="各题评测结果统计（独立页）" data-title-en="Verdicts by problem"
                            data-desc-zh="与 HUD 内柱状图同源：各题当前揭晓结果的堆叠统计。默认隐藏页顶标题区，按 H 可显示或隐藏；版面随视口放大。"
                            data-desc-en="Stacked bar chart per problem, same aggregation as the HUD widget. The page masthead is hidden by default; press H to show or hide it. Layout scales with the viewport."
                            data-keys="H~显示或隐藏页顶标题区~Show or hide page masthead;O~画面明暗层次~Brightness steps;[~下一套外观（循环）~Cycle theme;]~恢复已保存外观并复位本页快捷键布局（本机）~Restore saved skin; reset per-page hotkey layout to defaults">
                            <td class="contestlive-hub-td-page" data-live-page="live_probstats" title="在新标签页打开投屏页 / Open display in new tab"><span class="cn-text d-block">各题统计</span><span class="en-text small text-muted d-block">Verdict chart</span></td>
                            <td class="contestlive-hub-td-skin"><select class="form-select form-select-sm contestlive-ctrl-skin-page" data-live-page="live_probstats" aria-label="各题统计页外观"></select></td>
                            <td class="contestlive-hub-td-use small" title="查看本页说明与快捷键 / View description and shortcuts">
                                <span class="cn-text d-block">数据墙 / 解说辅助</span>
                                <span class="en-text text-muted d-block">Data wall</span>
                            </td>
                            <td>
                                <div class="input-group input-group-sm">
                                    <input type="text" class="form-control contestlive-hub-url-inp" readonly data-live-page="live_probstats" value="" />
                                    <button type="button" class="btn btn-outline-secondary contestlive-hub-copybtn" title="复制本行投屏地址到剪贴板"><span class="cn-text">复制</span><span class="en-text d-block small">Copy</span></button>
                                </div>
                            </td>
                        </tr>
                        <tr class="contestlive-hub-row" data-live-help="rankpage"
                            data-title-zh="直播榜单（独立页）" data-title-en="Live scoreboard"
                            data-desc-zh="整页实时队伍榜；默认字号与表格略偏大并随视口缩放。顶栏比赛计时与「比赛计时」独立页同源：大号数字有多套显示方式，按 T 在套装间循环切换（任意阶段均可），切换后短暂漂浮显示当前套装名称。按 −、=（或 +、小键盘 +−）连续调节整页字号，\ 恢复默认，按比赛本机记忆；] 恢复外观时一并复位字号与计时套装。"
                            data-desc-en="Full-page team standings with larger default typography that scales with the viewport. The timer bar shares the timer page packs: press T anytime to cycle display packs; a short floating label names the active pack. Press − / = (or +, numpad +/−) to zoom the page; \ resets scale; persisted per contest. ] also resets scale and timer packs when restoring the saved skin."
                            data-keys="B~成绩区自动滚动~Auto-scroll;↑,↓,PgUp,PgDn,Home,End~成绩区滚动~Scroll;T~切换顶栏计时的显示套装~Cycle timer display pack;−~缩小整页字号~Zoom page UI out;=~放大整页字号~Zoom page UI in;+~放大整页字号（同 =）~Zoom in same as =;NumpadAdd,NumpadSubtract~小键盘放大/缩小~Numpad zoom;\~恢复整页字号默认~Reset page UI scale;O~画面明暗层次~Brightness steps;[~下一套外观（循环）~Cycle theme;]~恢复已保存外观并复位本页快捷键布局（本机）~Restore saved skin; reset per-page hotkey layout to defaults">
                            <td class="contestlive-hub-td-page" data-live-page="live_rank" title="在新标签页打开投屏页 / Open display in new tab"><span class="cn-text d-block">直播榜单</span><span class="en-text small text-muted d-block">Live scoreboard</span></td>
                            <td class="contestlive-hub-td-skin"><select class="form-select form-select-sm contestlive-ctrl-skin-page" data-live-page="live_rank" aria-label="直播榜单页面外观"></select></td>
                            <td class="contestlive-hub-td-use small" title="查看本页说明与快捷键 / View description and shortcuts">
                                <span class="cn-text d-block">成绩墙单源</span>
                                <span class="en-text text-muted d-block">Dedicated board</span>
                            </td>
                            <td>
                                <div class="input-group input-group-sm">
                                    <input type="text" class="form-control contestlive-hub-url-inp" readonly data-live-page="live_rank" value="" />
                                    <button type="button" class="btn btn-outline-secondary contestlive-hub-copybtn" title="复制本行投屏地址到剪贴板"><span class="cn-text">复制</span><span class="en-text d-block small">Copy</span></button>
                                </div>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
            <p class="form-text small text-success mb-2 px-3 d-none" id="contestlive_hub_copy_ok" aria-live="polite">
                <span class="cn-text d-block">链接已复制</span>
                <span class="en-text d-block small">Copied to clipboard</span>
            </p>
        </div>
    </div>

    <div class="card shadow-sm mb-4">
        <div class="card-header contestlive-ctrl-card-header-stacked">
            <div class="d-flex flex-wrap align-items-center justify-content-between gap-2">
                <div class="d-flex align-items-start gap-2 min-w-0">
                    <div class="contestlive-ctrl-bilingual-stack min-w-0">
                        <span class="cn-text contestlive-ctrl-bilingual-stack__cn">左上角徽标</span>
                        <span class="en-text contestlive-ctrl-bilingual-stack__en">Corner logos</span>
                    </div>
                    <button type="button" class="btn btn-sm btn-link p-0 contestlive-ctrl-panel-help-btn flex-shrink-0" data-bs-toggle="collapse" data-bs-target="#contestliveHintLogo" aria-expanded="false" aria-controls="contestliveHintLogo" title="展开或收起说明&#10;Show or hide help">
                        <i class="bi bi-question-circle text-secondary" aria-hidden="true"></i>
                        <span class="visually-hidden">说明</span>
                    </button>
                </div>
                <div class="d-flex gap-2">
                    <input type="file" class="d-none" id="contestlive_logo_pick" accept="image/png,image/jpeg,image/webp,image/svg+xml" multiple />
                    <input type="file" class="d-none" id="contestlive_logo_replace_pick" accept="image/png,image/jpeg,image/webp,image/svg+xml" />
                    <button type="button" class="btn btn-sm btn-outline-primary" id="contestlive_logo_add_btn" title="选择图片文件&#10;Choose image files">
                        <span class="contestlive-ctrl-bilingual-stack contestlive-ctrl-bilingual-stack--center"><span class="cn-text contestlive-ctrl-bilingual-stack__cn">添加图片</span><span class="en-text contestlive-ctrl-bilingual-stack__en">Add</span></span>
                    </button>
                </div>
            </div>
            <div id="contestliveHintLogo" class="collapse contestlive-ctrl-panel-hint-wrap">
                <div class="contestlive-ctrl-panel-hint pt-2 mt-2 border-top border-secondary-subtle">
                    <span class="cn-text d-block">可多图、拖拽排序；条带宽度固定，过高过宽可能无法添加。</span>
                    <span class="en-text d-block">Multiple logos, drag to reorder; fixed strip—very tall/wide images may be blocked.</span>
                </div>
            </div>
        </div>
        <div class="card-body">
            <div id="contestlive_logo_grid" class="row row-cols-2 row-cols-sm-3 row-cols-md-4 row-cols-lg-5 g-2 contestlive-logo-grid"></div>
            <p class="small text-muted mb-0" id="contestlive_logo_empty">
                <span class="cn-text d-block">尚未添加徽标，请点击「添加图片」。</span>
                <span class="en-text d-block">No logos yet</span>
            </p>
            <p class="form-text small text-danger mb-0 d-none mt-2" id="contestlive_logo_err"></p>
        </div>
    </div>

    <div class="row g-3">
        <div class="col-lg-6">
            <div class="card shadow-sm">
                <div class="card-header contestlive-ctrl-card-header-stacked">
                    <div class="d-flex flex-wrap align-items-center justify-content-between gap-2">
                        <div class="d-flex align-items-start gap-2 min-w-0">
                            <div class="contestlive-ctrl-bilingual-stack min-w-0">
                                <span class="cn-text contestlive-ctrl-bilingual-stack__cn">消息推送（底栏）</span>
                                <span class="en-text contestlive-ctrl-bilingual-stack__en">Push (bottom bar)</span>
                            </div>
                            <button type="button" class="btn btn-sm btn-link p-0 contestlive-ctrl-panel-help-btn flex-shrink-0" data-bs-toggle="collapse" data-bs-target="#contestliveHintPush" aria-expanded="false" aria-controls="contestliveHintPush" title="展开或收起说明&#10;Show or hide help">
                                <i class="bi bi-question-circle text-secondary" aria-hidden="true"></i>
                                <span class="visually-hidden">说明</span>
                            </button>
                        </div>
                        <button type="button" class="btn btn-sm btn-primary flex-shrink-0" id="contestlive_command_send" title="推送到主直播画面底部&#10;Push to the main live bottom bar">
                            <span class="contestlive-ctrl-bilingual-stack contestlive-ctrl-bilingual-stack--center">
                                <span class="cn-text contestlive-ctrl-bilingual-stack__cn"><i class="bi bi-send-fill"></i> 推送到直播画面</span>
                                <span class="en-text contestlive-ctrl-bilingual-stack__en">Push to displays</span>
                            </span>
                        </button>
                    </div>
                    <div id="contestliveHintPush" class="collapse contestlive-ctrl-panel-hint-wrap">
                        <div class="contestlive-ctrl-panel-hint pt-2 mt-2 border-top border-secondary-subtle">
                            <span class="cn-text d-block">发往主直播底栏；主画面约每秒同步，通常数秒内可见。右侧列表可撤回。</span>
                            <span class="en-text d-block">To the main live ticker; the HUD polls about every second—usually visible within a few seconds. Revoke from the list on the right.</span>
                        </div>
                    </div>
                </div>
                <div class="card-body">
                    <label for="contestlive_command_input" class="form-label small contestlive-ctrl-bilingual-inline mb-1">
                        <span class="cn-text">正文</span>
                        <span class="en-text contestlive-ctrl-bilingual-inline__en text-muted">Text</span>
                    </label>
                    <textarea id="contestlive_command_input" class="form-control mb-0" rows="3" maxlength="2048" placeholder="中文或英文"></textarea>
                    <p class="form-text small mb-0 mt-2" id="contestlive_send_feedback" aria-live="polite"></p>
                </div>
            </div>
        </div>
        <div class="col-lg-6">
            <div class="card shadow-sm h-100">
                <div class="card-header contestlive-ctrl-card-header-stacked">
                    <div class="d-flex justify-content-between align-items-start flex-wrap gap-2 w-100">
                        <div class="d-flex align-items-start gap-2 min-w-0 flex-grow-1">
                            <div class="contestlive-ctrl-bilingual-stack min-w-0">
                                <span class="cn-text contestlive-ctrl-bilingual-stack__cn">近期推送</span>
                                <span class="en-text contestlive-ctrl-bilingual-stack__en">Recent lines</span>
                            </div>
                            <button type="button" class="btn btn-sm btn-link p-0 contestlive-ctrl-panel-help-btn flex-shrink-0" data-bs-toggle="collapse" data-bs-target="#contestliveHintRecent" aria-expanded="false" aria-controls="contestliveHintRecent" title="展开或收起说明&#10;Show or hide help">
                                <i class="bi bi-question-circle text-secondary" aria-hidden="true"></i>
                                <span class="visually-hidden">说明</span>
                            </button>
                        </div>
                        <button type="button" class="btn btn-sm btn-outline-secondary flex-shrink-0" id="contestlive_log_refresh" title="重新加载列表&#10;Reload list" aria-label="刷新近期推送">
                            <i class="bi bi-arrow-clockwise"></i>
                        </button>
                    </div>
                    <div id="contestliveHintRecent" class="collapse contestlive-ctrl-panel-hint-wrap">
                        <div class="contestlive-ctrl-panel-hint pt-2 mt-2 border-top border-secondary-subtle">
                            <span class="cn-text d-block">可撤回；列表最多保留约最近 100 条。超过约 60 秒未撤回的条目标「过期」，主画面底栏不再轮播该条，条目仍保留便于回顾。</span>
                            <span class="en-text d-block">Revoke supported; about 100 most recent rows kept. After ~60s an active line is marked expired (hidden from the live ticker) but stays in the list.</span>
                        </div>
                    </div>
                </div>
                <div class="card-body pt-2">
                    <ul class="list-group list-group-flush small contestlive-recent-push-list" id="contestlive_log_list"></ul>
                </div>
            </div>
        </div>
    </div>

    <div class="row g-3">
        <div class="col-12">
            <div class="card shadow-sm">
                <div class="card-header contestlive-ctrl-card-header-stacked">
                    <div class="d-flex flex-wrap align-items-center justify-content-between gap-2">
                        <div class="d-flex align-items-start gap-2 min-w-0">
                            <div class="contestlive-ctrl-bilingual-stack min-w-0">
                                <span class="cn-text contestlive-ctrl-bilingual-stack__cn">底栏固定文案（右侧）</span>
                                <span class="en-text contestlive-ctrl-bilingual-stack__en">Fixed footer line (right)</span>
                            </div>
                            <button type="button" class="btn btn-sm btn-link p-0 contestlive-ctrl-panel-help-btn flex-shrink-0" data-bs-toggle="collapse" data-bs-target="#contestliveHintTickerFixed" aria-expanded="false" aria-controls="contestliveHintTickerFixed" title="展开或收起说明&#10;Show or hide help">
                                <i class="bi bi-question-circle text-secondary" aria-hidden="true"></i>
                                <span class="visually-hidden">说明</span>
                            </button>
                        </div>
                        <button type="button" class="btn btn-sm btn-primary flex-shrink-0" id="contestlive_ticker_fixed_save" title="写入本场比赛设置并同步到各投屏页&#10;Save to this contest and sync to display pages">
                            <span class="contestlive-ctrl-bilingual-stack contestlive-ctrl-bilingual-stack--center">
                                <span class="cn-text contestlive-ctrl-bilingual-stack__cn"><i class="bi bi-save"></i> 保存固定文案</span>
                                <span class="en-text contestlive-ctrl-bilingual-stack__en">Save fixed line</span>
                            </span>
                        </button>
                    </div>
                    <div id="contestliveHintTickerFixed" class="collapse contestlive-ctrl-panel-hint-wrap">
                        <div class="contestlive-ctrl-panel-hint pt-2 mt-2 border-top border-secondary-subtle">
                            <span class="cn-text d-block">与左侧推送并排；留空则只显示推送。保存后投屏自动读到（亦可按 G 或刷新）。</span>
                            <span class="en-text d-block">Beside rolling pushes; leave empty for pushes only. Saves sync to displays (G or reload).</span>
                        </div>
                    </div>
                </div>
                <div class="card-body">
                    <label for="contestlive_ticker_fixed_input" class="form-label small contestlive-ctrl-bilingual-inline mb-1">
                        <span class="cn-text">文案</span>
                        <span class="en-text contestlive-ctrl-bilingual-inline__en text-muted">Text</span>
                    </label>
                    <textarea id="contestlive_ticker_fixed_input" class="form-control mb-0" rows="2" maxlength="1024" placeholder="例如：主办方提示、考场纪律">{$contest_live_ticker_fixed_value|default=''}</textarea>
                    <p class="form-text small mb-0 mt-2" id="contestlive_ticker_fixed_feedback" aria-live="polite"></p>
                </div>
            </div>
        </div>
    </div>
</div>

<div class="modal fade" id="contestlive_row_modal" tabindex="-1" aria-hidden="true">
    <div class="modal-dialog modal-dialog-centered modal-lg">
        <div class="modal-content">
            <div class="modal-header">
                <h5 class="modal-title" id="contestlive_row_modal_title">—</h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div class="modal-body">
                <p class="mb-2 cn-text" id="contestlive_row_modal_desc_zh"></p>
                <p class="small text-muted mb-3 en-text" id="contestlive_row_modal_desc_en"></p>
                <div class="contestlive-ctrl-shortcuts-heading mb-1">
                    <span class="fw-semibold cn-text d-block">快捷键</span>
                    <span class="en-text text-muted d-block">Shortcuts</span>
                </div>
                <div id="contestlive_row_modal_keys" class="contestlive-ctrl-roll-help-block"></div>
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-primary" data-bs-dismiss="modal">OK</button>
            </div>
        </div>
    </div>
</div>

<script type="text/javascript">
window.CONTEST_LIVE_PAGE = 'ctrl';
window.CONTEST_LIVE_CID = parseInt('{$contest.contest_id}', 10);
window.CONTEST_LIVE_ATTACH_PATH = <?php echo json_encode(isset($contest_live_brand_base) ? (string) $contest_live_brand_base : '', JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT | JSON_UNESCAPED_SLASHES); ?>;
window.CONTEST_LIVE_BRAND_SLOT_H_PX = <?php echo json_encode(isset($contest_live_brand_slot_h_px) ? (int) $contest_live_brand_slot_h_px : 41, JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT); ?>;
window.CONTEST_LIVE_DISPLAY_CONFIG = {$live_display_config_json|raw};
</script>
{js href="__STATIC__/cpcsys/contestlive/js/contestlive_skin_common.js" /}
{js href="__STATIC__/cpcsys/contestlive/js/contestlive_brand_layout.js" /}
{js href="__STATIC__/js/csg_sortable_list.js" /}
{js href="__STATIC__/cpcsys/contestlive/js/contestlive_ctrl.js" /}
