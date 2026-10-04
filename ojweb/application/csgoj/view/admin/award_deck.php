{include file="../../csgoj/view/public/js_exceljs" /}
{include file="../../csgoj/view/public/base_csg_switch" /}
{include file="../../csgoj/view/public/js_rank"}
{css href="__STATIC__/fonts/award_pres/award_pres.css" /}
{css href="__STATIC__/csgoj/contest/award_admin.css" /}
{js href="__STATIC__/csgoj/contest/award.js" /}
{js href="__STATIC__/vendor/jszip-3.10.1.min.js" /}
{js href="__STATIC__/js/overlay.js" /}
{js href="__STATIC__/csgoj/contest/award_deck.js" /}

<div class="admin-page-header admin-page-header--award-deck">
    <div class="admin-page-header-left">
        <div class="admin-page-header-icon"><i class="bi bi-easel"></i></div>
        <h1 class="admin-page-header-title">
            <div class="admin-page-header-title-main">颁奖编排</div>
            <div class="admin-page-header-title-right">
                <a href="__CPC__/contest/contest?cid={$contest['contest_id']}" class="admin-page-header-id">
                    <i class="bi bi-hash"></i> {$contest['contest_id']}
                </a>
                <span class="en-text">Award Deck</span>
            </div>
        </h1>
    </div>
    <div class="admin-page-header-right admin-page-header-actions--award-tools d-flex flex-wrap align-items-center justify-content-end gap-1">
        <button type="button" class="btn btn-outline-primary btn-sm award-header-tool-btn" id="award_deck_pager_config_btn"
                title="打开编排配置（Open deck settings）">
            <span class="cn-text"><i class="bi bi-sliders me-1" aria-hidden="true"></i>配置</span><span class="en-text">Setup</span>
        </button>
        <button type="button" class="btn btn-dark btn-sm award-header-tool-btn" id="award_presentation_btn"
                title="全屏展示（Present fullscreen）">
            <span class="cn-text"><i class="bi bi-arrows-fullscreen me-1" aria-hidden="true"></i>全屏展示</span><span class="en-text">Present</span>
        </button>
        <button type="button" class="btn btn-outline-dark btn-sm award-header-tool-btn" id="award_presentation_pack_btn"
                title="打包下载各归属离线投屏 HTML（ZIP）">
            <span class="cn-text"><i class="bi bi-file-zipper me-1" aria-hidden="true"></i>打包下载</span><span class="en-text">Pack ZIP</span>
        </button>
    </div>
</div>

<div class="container-fluid award-deck-page px-2 px-md-3 pb-4 mb-0" id="award_deck_page">
    <div class="card award-deck-workbench mb-0">
        <div class="award-deck-workbench-toolbar">
            <div id="award_deck_group_tabs" class="d-flex align-items-center flex-wrap gap-2"></div>
        </div>
        <div id="award_bundle_warn" class="text-warning border-0 rounded-0"></div>
        <div class="award-deck-split award-deck-split--paired">
            <div class="award-deck-paired-heads" aria-hidden="false">
                <div class="award-deck-col-head award-deck-col-head--paired">
                    <span class="award-deck-col-head__cn">候选奖项队伍</span>
                    <span class="award-deck-col-head__en en-text">Candidates</span>
                </div>
                <div class="award-deck-col-head award-deck-col-head--paired">
                    <span class="award-deck-col-head__cn">编排预览</span>
                    <span class="award-deck-col-head__en en-text">Deck preview</span>
                </div>
            </div>
            <div class="award-deck-paired-scroll">
                <div id="award_deck_pair_rows" class="deck-pair-rows"></div>
            </div>
        </div>
    </div>
</div>

<div class="modal fade award-deck-config-modal" id="award_deck_pager_modal" tabindex="-1" aria-labelledby="award_deck_pager_modal_label" data-bs-backdrop="static">
    <div class="modal-dialog modal-xl award-deck-pager-dialog">
        <div class="modal-content border-0 shadow">
            <div class="modal-header bg-light py-2 px-3 align-items-center award-deck-modal-header-sticky">
                <h5 class="modal-title fw-semibold mb-0 me-2 flex-shrink-0 text-truncate" id="award_deck_pager_modal_label">
                    <span class="cn-text">编排配置</span><span class="en-text text-muted fw-normal ms-1">Deck settings</span>
                </h5>
                <div class="award-deck-pager-modal-header-center flex-grow-1 min-w-0 px-2" role="status" aria-live="polite">
                    <span id="award_deck_pager_modal_group_line" class="award-deck-pager-modal-group-line" title="当前编排分页与专项顺序所针对的赛事归属 / Affiliation for pager &amp; special order"></span>
                </div>
                <div class="d-flex align-items-center gap-1 flex-shrink-0 award-deck-modal-header-tools me-1">
                    <button type="button" class="btn btn-outline-success btn-sm award-deck-modal-iconbtn" id="award_bundle_export_btn"
                            title="导出整包颁奖编排配置（Export full award deck configuration）">
                        <i class="bi bi-download" aria-hidden="true"></i>
                    </button>
                    <button type="button" class="btn btn-outline-primary btn-sm award-deck-modal-iconbtn" id="award_bundle_import_btn"
                            title="从配置文件导入整包颁奖编排（Import full award deck from configuration file）">
                        <i class="bi bi-upload" aria-hidden="true"></i>
                    </button>
                    <button type="button" class="btn btn-outline-danger btn-sm award-deck-modal-iconbtn" id="award_bundle_reset_btn"
                            title="重置本页缓存的整包编排（Reset cached bundle on this page）">
                        <i class="bi bi-arrow-counterclockwise" aria-hidden="true"></i>
                    </button>
                    <span class="vr align-self-stretch my-1 opacity-50" aria-hidden="true"></span>
                    <button type="button" class="btn btn-outline-secondary btn-sm award-deck-modal-iconbtn" id="award_deck_sync_pager_sizes_all_groups_btn"
                            title="将当前赛事归属的基础与分奖每页队数复制到其他赛事归属（Copy base and per-award page sizes from current affiliation to all other affiliations）">
                        <i class="bi bi-diagram-3" aria-hidden="true"></i>
                    </button>
                </div>
                <input type="file" id="award_bundle_import_file" accept=".json,application/json" class="d-none" aria-hidden="true">
                <div class="d-flex align-items-center gap-1 flex-shrink-0 ps-1">
                    <button type="button" class="btn btn-outline-primary btn-sm award-deck-modal-iconbtn" id="award_deck_pager_modal_header_save"
                            title="保存应用（同底部保存；样式同评测机参数页保存图标） / Save (same as footer; icon style as judger config save)">
                        <i class="bi bi-check-lg" aria-hidden="true"></i>
                    </button>
                    <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                </div>
            </div>
            <div class="modal-body award-deck-config-modal-body">
                <p class="text-muted mb-2 mb-md-3 lh-sm award-deck-modal-intro">
                    <span class="cn-text">「保存应用」写入分页记忆并重算编排页；奖牌顺序固定为金→银→铜（或一二三等奖）。顶栏：保存图标与评测机参数等页一致（outline 主色勾）、绿导出、蓝导入、红重置整包；灰图标为将分页每页队数同步到其他赛事归属。本窗内容过长时随外层一起滚动，顶栏在滚动时吸附顶部。</span>
                    <span class="en-text">Save rebuilds deck; medals gold→silver→bronze. Header: save icon matches judger config (outline primary check), export / import / reset; gray syncs page sizes. Long content scrolls with the sheet; header sticks on scroll.</span>
                </p>

                <div class="row g-3 award-deck-modal-split">
                <div class="col-lg-8 award-deck-modal-split-main">

                <div class="mb-2 pb-2 border-bottom border-light-subtle">
                    <div class="award-deck-form-sec-title"><span class="cn-text">筛选</span><span class="en-text">Filters</span></div>
                    <div class="d-flex flex-wrap align-items-center gap-2 gap-md-3">
                        <div class="csg-switch csg-switch-md">
                            <input type="checkbox" id="switch_one_two_three" name="one_two_three" class="csg-switch-input"
                                   data-csg-text-on="一二三" data-csg-text-off="金银铜"
                                   data-csg-text-on-en="One Two Three" data-csg-text-off-en="Gold Silver Bronze"
                                   title="显示名称：一二三 / 金银铜">
                        </div>
                        <div class="csg-switch csg-switch-md">
                            <input type="checkbox" id="switch_with_star_team" name="with_star_team" class="csg-switch-input"
                                   data-csg-text-on="包含打星" data-csg-text-off="不包含打星"
                                   data-csg-text-on-en="Include Star" data-csg-text-off-en="Exclude Star"
                                   title="打星队伍是否计入获奖">
                        </div>
                        <div class="csg-switch csg-switch-md">
                            <input type="checkbox" id="switch_all_team_based" name="all_team_based" class="csg-switch-input"
                                   data-csg-text-on="总数为基数" data-csg-text-off="过题为基数"
                                   data-csg-text-on-en="Total Count" data-csg-text-off-en="Solved Count"
                                   title="获奖线：按总队伍数或按过题队伍数">
                        </div>
                    </div>
                </div>

                <div class="mb-2 pb-2 border-bottom border-light-subtle">
                    <div class="award-deck-form-sec-title"><span class="cn-text">专项奖入选</span><span class="en-text">Special awards</span></div>
                    <p class="text-muted small mb-2 lh-sm">
                        <span class="cn-text">开关打开且本场确有获奖队时，才会生成对应编排页；专项之间的先后顺序在右侧栏用拖拽调整。</span>
                        <span class="en-text">When on and winners exist, deck pages are generated; drag specials on the right to set their order.</span>
                    </p>
                    <div class="row g-2 award-deck-special-include-grid award-deck-switch-col-pair">
                        <div class="col-12 col-md-6">
                            <div class="award-deck-label-switch-row d-flex align-items-center justify-content-between gap-2">
                                <span class="form-label mb-0 small flex-grow-1 me-1"><span class="cn-text">冠亚季军学校</span><span class="en-text">Champ schools</span></span>
                                <div class="csg-switch csg-switch-md flex-shrink-0">
                                    <input type="checkbox" id="switch_deck_inc_champion_schools" class="csg-switch-input"
                                           data-csg-text-on="纳入" data-csg-text-off="不纳"
                                           data-csg-text-on-en="On" data-csg-text-off-en="Off"
                                           title="冠军学校、亚军学校、季军学校（有则纳入编排）">
                                </div>
                            </div>
                        </div>
                        <div class="col-12 col-md-6">
                            <div class="award-deck-label-switch-row d-flex align-items-center justify-content-between gap-2">
                                <span class="form-label mb-0 small flex-grow-1 me-1"><span class="cn-text">最快解题</span><span class="en-text">First blood</span></span>
                                <div class="csg-switch csg-switch-md flex-shrink-0">
                                    <input type="checkbox" id="switch_deck_inc_first_blood" class="csg-switch-input"
                                           data-csg-text-on="纳入" data-csg-text-off="不纳"
                                           data-csg-text-on-en="On" data-csg-text-off-en="Off"
                                           title="各题首答合并为同一编排块（多页时仅按每页队数分页）">
                                </div>
                            </div>
                        </div>
                        <div class="col-12 col-md-6">
                            <div class="award-deck-label-switch-row d-flex align-items-center justify-content-between gap-2">
                                <span class="form-label mb-0 small flex-grow-1 me-1"><span class="cn-text">最佳女队或女生</span><span class="en-text">Best girls</span></span>
                                <div class="csg-switch csg-switch-md flex-shrink-0">
                                    <input type="checkbox" id="switch_deck_inc_best_female" class="csg-switch-input"
                                           data-csg-text-on="纳入" data-csg-text-off="不纳"
                                           data-csg-text-on-en="On" data-csg-text-off-en="Off"
                                           title="最佳女队奖或最佳女生奖">
                                </div>
                            </div>
                        </div>
                        <div class="col-12 col-md-6">
                            <div class="award-deck-label-switch-row d-flex align-items-center justify-content-between gap-2">
                                <span class="form-label mb-0 small flex-grow-1 me-1"><span class="cn-text">顽强拼搏</span><span class="en-text">Spirit</span></span>
                                <div class="csg-switch csg-switch-md flex-shrink-0">
                                    <input type="checkbox" id="switch_deck_inc_tenacity" class="csg-switch-input"
                                           data-csg-text-on="纳入" data-csg-text-off="不纳"
                                           data-csg-text-on-en="On" data-csg-text-off-en="Off"
                                           title="顽强拼搏奖">
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="mb-2 pb-2 border-bottom border-light-subtle">
                    <div class="award-deck-form-sec-title"><span class="cn-text">翻页顺序</span><span class="en-text">Page order</span></div>
                    <div class="award-deck-label-switch-row d-flex align-items-center justify-content-between gap-2" style="max-width:28rem">
                        <span class="form-label mb-0 text-start flex-grow-1 me-1">
                            <span class="cn-text">同类奖内名次</span><span class="en-text">Within award</span>
                        </span>
                        <div class="csg-switch csg-switch-md flex-shrink-0">
                            <input type="checkbox" id="switch_pager_within_award_rank_forward" class="csg-switch-input"
                                   data-csg-text-on="正序" data-csg-text-off="逆序"
                                   data-csg-text-on-en="Fwd" data-csg-text-off-en="Rev"
                                   title="正序：名次升序；逆序：名次降序（高名次在前）">
                        </div>
                    </div>
                </div>

                <div class="mb-2 pb-2 border-bottom border-light-subtle">
                    <div class="award-deck-form-sec-title"><span class="cn-text">全屏展示</span><span class="en-text">Presentation</span></div>
                    <p class="text-muted mb-2 lh-sm award-deck-pres-hint">
                        <span class="cn-text">控制全屏颁奖时每行展示字段；投屏画幅在全屏顶栏设置（未手动保存画幅时，每次打开全屏会按当前视口建议比例）。名单列数决定分栏与字号；名单为单列、双列或三列，过长文案在投屏内横向滚动展示。下载的单文件投屏 HTML 会内嵌此处的名单列数与各字段显隐，离线打开与全屏一致；请先在本窗点「保存应用」后再在全屏内打包下载。</span>
                        <span class="en-text">Fields per row here; aspect ratio is set in the fullscreen toolbar (auto from viewport until you save a ratio). Column count affects sizing. Long lines scroll horizontally on stage. The downloadable single-file HTML embeds the same column count and field visibility for offline viewing; save this dialog first, then pack from fullscreen.</span>
                    </p>
                    <div class="row g-2 mb-2">
                        <div class="col-md-8 col-lg-6">
                            <label class="form-label mb-1" for="award_pres_team_grid_columns"><span class="cn-text">名单列数</span><span class="en-text">Columns</span></label>
                            <select class="form-select" id="award_pres_team_grid_columns" title="投屏名单分栏：单栏、双栏、三栏">
                                <option value="1">单栏 / 1 col</option>
                                <option value="2" selected>双栏 / 2 cols</option>
                                <option value="3">三栏 / 3 cols</option>
                            </select>
                        </div>
                    </div>
                    <div class="row g-2 award-deck-switch-col-pair">
                        <div class="col-md-6">
                            <div class="award-deck-label-switch-row d-flex align-items-center justify-content-between gap-2">
                                <span class="form-label mb-0 text-start flex-grow-1 me-1"><span class="cn-text">选手姓名</span><span class="en-text">Members</span></span>
                                <div class="csg-switch csg-switch-md flex-shrink-0">
                                    <input type="checkbox" id="switch_pres_show_member_names" class="csg-switch-input"
                                           data-csg-text-on="显示" data-csg-text-off="隐藏"
                                           data-csg-text-on-en="Show" data-csg-text-off-en="Hide"
                                           title="全屏是否展示队员姓名列表">
                                </div>
                            </div>
                        </div>
                        <div class="col-md-6">
                            <div class="award-deck-label-switch-row d-flex align-items-center justify-content-between gap-2">
                                <span class="form-label mb-0 text-start flex-grow-1 me-1"><span class="cn-text">教练姓名</span><span class="en-text">Coach</span></span>
                                <div class="csg-switch csg-switch-md flex-shrink-0">
                                    <input type="checkbox" id="switch_pres_show_coach" class="csg-switch-input"
                                           data-csg-text-on="显示" data-csg-text-off="隐藏"
                                           data-csg-text-on-en="Show" data-csg-text-off-en="Hide"
                                           title="全屏是否展示教练">
                                </div>
                            </div>
                        </div>
                        <div class="col-md-6">
                            <div class="award-deck-label-switch-row d-flex align-items-center justify-content-between gap-2">
                                <span class="form-label mb-0 text-start flex-grow-1 me-1"><span class="cn-text">学校</span><span class="en-text">School</span></span>
                                <div class="csg-switch csg-switch-md flex-shrink-0">
                                    <input type="checkbox" id="switch_pres_show_school" class="csg-switch-input"
                                           data-csg-text-on="显示" data-csg-text-off="隐藏"
                                           data-csg-text-on-en="Show" data-csg-text-off-en="Hide"
                                           title="全屏是否展示学校">
                                </div>
                            </div>
                        </div>
                        <div class="col-md-6">
                            <div class="award-deck-label-switch-row d-flex align-items-center justify-content-between gap-2">
                                <span class="form-label mb-0 text-start flex-grow-1 me-1"><span class="cn-text">队名</span><span class="en-text">Team name</span></span>
                                <div class="csg-switch csg-switch-md flex-shrink-0">
                                    <input type="checkbox" id="switch_pres_show_team_name" class="csg-switch-input"
                                           data-csg-text-on="显示" data-csg-text-off="隐藏"
                                           data-csg-text-on-en="Show" data-csg-text-off-en="Hide"
                                           title="全屏是否展示队名">
                                </div>
                            </div>
                        </div>
                        <div class="col-md-6">
                            <div class="award-deck-label-switch-row d-flex align-items-center justify-content-between gap-2">
                                <span class="form-label mb-0 text-start flex-grow-1 me-1"><span class="cn-text">第二语言队名</span><span class="en-text">Alt. team name</span></span>
                                <div class="csg-switch csg-switch-md flex-shrink-0">
                                    <input type="checkbox" id="switch_pres_show_team_name_en" class="csg-switch-input"
                                           data-csg-text-on="显示" data-csg-text-off="隐藏"
                                           data-csg-text-on-en="Show" data-csg-text-off-en="Hide"
                                           title="全屏是否展示第二语言队名（如 name_en）">
                                </div>
                            </div>
                        </div>
                        <div class="col-md-6">
                            <div class="award-deck-label-switch-row d-flex align-items-center justify-content-between gap-2">
                                <span class="form-label mb-0 text-start flex-grow-1 me-1"><span class="cn-text">队伍号</span><span class="en-text">Team ID</span></span>
                                <div class="csg-switch csg-switch-md flex-shrink-0">
                                    <input type="checkbox" id="switch_pres_show_team_id" class="csg-switch-input"
                                           data-csg-text-on="显示" data-csg-text-off="隐藏"
                                           data-csg-text-on-en="Show" data-csg-text-off-en="Hide"
                                           title="全屏是否展示登录账号（如 team 开头）">
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="mb-0">
                    <div class="award-deck-form-sec-title"><span class="cn-text">每页队数</span><span class="en-text">Page size</span></div>
                    <p class="text-muted mb-2 lh-sm">
                        <span class="cn-text">仅当前所选赛事归属「<strong id="award_deck_pager_cur_cn"></strong>」。分奖单独填写则<strong>覆盖</strong>基础值。</span>
                        <span class="en-text">Current affiliation <strong id="award_deck_pager_cur_en"></strong> only. Per-award values override base.</span>
                    </p>
                    <div class="row g-2">
                        <div class="col-6 col-md-3">
                            <label class="form-label" for="award_pager_by_group_page_size"><span class="cn-text">基础</span><span class="en-text">Base</span></label>
                            <input type="number" min="1" class="form-control" id="award_pager_by_group_page_size" placeholder="默认 16" />
                        </div>
                        <div class="col-6 col-md-3">
                            <label class="form-label" for="award_pager_award_level_1_page_size"><span id="award_pager_label_level_1_cn">金奖</span><span class="en-text" id="award_pager_label_level_1_en">Gold</span></label>
                            <input type="number" min="1" class="form-control" id="award_pager_award_level_1_page_size" placeholder="—" />
                        </div>
                        <div class="col-6 col-md-3">
                            <label class="form-label" for="award_pager_award_level_2_page_size"><span id="award_pager_label_level_2_cn">银奖</span><span class="en-text" id="award_pager_label_level_2_en">Silver</span></label>
                            <input type="number" min="1" class="form-control" id="award_pager_award_level_2_page_size" placeholder="—" />
                        </div>
                        <div class="col-6 col-md-3">
                            <label class="form-label" for="award_pager_award_level_3_page_size"><span id="award_pager_label_level_3_cn">铜奖</span><span class="en-text" id="award_pager_label_level_3_en">Bronze</span></label>
                            <input type="number" min="1" class="form-control" id="award_pager_award_level_3_page_size" placeholder="—" />
                        </div>
                    </div>
                </div>

                </div>
                <aside class="col-lg-4 award-deck-modal-split-rail">
                    <div class="award-deck-form-sec-title"><span class="cn-text">专项顺序</span><span class="en-text">Special order</span></div>
                    <p class="text-muted small mb-2 lh-sm">
                        <span class="cn-text">拖拽整表顺序：含金/银/铜（或一二三等奖）奖牌块与专项，可穿插排列。「恢复默认」恢复规范顺序；「排序」在规范正序、规范逆序、自定义三者间切换。</span>
                        <span class="en-text">Drag the full list: medal blocks and specials. Reset restores defaults; Sort cycles modes (see status line below).</span>
                    </p>
                    <div class="award-deck-special-rail-sortbar">
                        <div class="btn-group btn-group-sm" role="group">
                            <button type="button" class="btn btn-outline-secondary" data-award-deck-special-cmd="default" title="恢复系统默认顺序">恢复默认</button>
                            <button type="button" class="btn btn-outline-primary" data-award-deck-special-cmd="sort_cycle" id="award_deck_special_sort_btn" title="切换规范正序 / 规范逆序 / 自定义">
                                <i class="bi bi-arrow-down-up me-1" aria-hidden="true"></i><span class="cn-text">排序</span><span class="en-text">Sort</span>
                            </button>
                        </div>
                        <div id="award_deck_special_sort_phase_label" class="award-deck-special-sort-phase-label small text-muted mb-0"></div>
                    </div>
                    <div id="award_deck_special_order_list" class="award-deck-special-order-list"></div>
                </aside>
                </div>

            </div>
            <div class="modal-footer bg-light py-2 px-3 border-top d-flex flex-wrap gap-2 justify-content-end">
                <button type="button" class="btn btn-secondary award-deck-modal-footer-btn" data-bs-dismiss="modal">
                    <span class="cn-text">关闭</span><span class="en-text">Close</span>
                </button>
                <button type="button" class="btn btn-primary award-deck-modal-footer-btn" id="award_deck_pager_modal_submit"
                        title="保存分页与筛选并重算编排页（Save pager &amp; filters, rebuild deck）">
                    <i class="bi bi-check-lg me-1" aria-hidden="true"></i>
                    <span class="cn-text">保存应用</span><span class="en-text">Save</span>
                </button>
            </div>
        </div>
    </div>
</div>

<div id="award_presentation_modal" class="award-presentation-modal" style="display:none;">
    <div id="award_presentation_stage" class="award-presentation-stage" data-award-pres-theme="honor">
        <div class="award-presentation-toolbar award-presentation-toolbar--overlay">
            <div class="award-presentation-toolbar-inner">
                <div class="award-presentation-toolbar-cluster" role="group" aria-label="pager">
                    <button type="button" class="btn btn-sm btn-light award-pres-icon-btn" id="award_presentation_prev"
                            title="上一页 / Previous" aria-label="上一页">&lt;</button>
                    <div id="award_presentation_page_info" class="award-presentation-page-info">- / -</div>
                    <button type="button" class="btn btn-sm btn-light award-pres-icon-btn" id="award_presentation_next"
                            title="下一页 / Next" aria-label="下一页">&gt;</button>
                </div>
                <div class="award-presentation-toolbar-cluster" role="group" aria-label="zoom">
                    <button type="button" class="btn btn-sm btn-outline-light award-pres-icon-btn" id="award_presentation_zoom_out"
                            title="缩小信息区（投屏边缘遮挡时）/ Zoom out" aria-label="缩小">−</button>
                    <button type="button" class="btn btn-sm btn-outline-light award-pres-icon-btn" id="award_presentation_zoom_in"
                            title="放大至贴齐视口一边 / Zoom in" aria-label="放大">+</button>
                </div>
                <div class="award-presentation-toolbar-cluster award-pres-aspect-toolbar" role="group" aria-label="aspect">
                    <button type="button" class="btn btn-sm btn-outline-light award-pres-icon-btn" id="award_pres_aspect_narrow"
                            title="更窄画幅（如竖屏）/ Narrower aspect" aria-label="更窄">‹</button>
                    <input type="number" min="1" max="64" step="1" class="form-control form-control-sm award-pres-aspect-input"
                           id="award_pres_aspect_w" inputmode="numeric" title="比例宽 / Aspect width" aria-label="比例宽" />
                    <span class="award-pres-aspect-colon" aria-hidden="true">:</span>
                    <input type="number" min="1" max="64" step="1" class="form-control form-control-sm award-pres-aspect-input"
                           id="award_pres_aspect_h" inputmode="numeric" title="比例高 / Aspect height" aria-label="比例高" />
                    <button type="button" class="btn btn-sm btn-outline-light award-pres-icon-btn" id="award_pres_aspect_wide"
                            title="更宽画幅（如超宽屏）/ Wider aspect" aria-label="更宽">›</button>
                </div>
                <div class="dropdown award-pres-theme-dropdown">
                    <button class="btn btn-sm btn-outline-light dropdown-toggle" type="button" id="award_pres_theme_menu_btn"
                            data-bs-toggle="dropdown" data-bs-auto-close="true" aria-expanded="false"
                            title="配色方案 / Color theme">
                        <span class="cn-text">配色</span><span class="en-text">Theme</span>
                    </button>
                    <ul class="dropdown-menu dropdown-menu-dark dropdown-menu-end shadow" aria-labelledby="award_pres_theme_menu_btn">
                        <li><button type="button" class="dropdown-item py-2" data-award-pres-theme="honor">
                            <span class="cn-text d-block">红金表彰</span><span class="en-text small d-block opacity-75">Honor</span>
                        </button></li>
                        <li><button type="button" class="dropdown-item py-2" data-award-pres-theme="ruby">
                            <span class="cn-text d-block">绯红礼赞</span><span class="en-text small d-block opacity-75">Ruby</span>
                        </button></li>
                        <li><button type="button" class="dropdown-item py-2" data-award-pres-theme="mist">
                            <span class="cn-text d-block">雾灰浅蓝</span><span class="en-text small d-block opacity-75">Mist</span>
                        </button></li>
                        <li><button type="button" class="dropdown-item py-2" data-award-pres-theme="night">
                            <span class="cn-text d-block">深色夜境</span><span class="en-text small d-block opacity-75">Night</span>
                        </button></li>
                        <li><button type="button" class="dropdown-item py-2" data-award-pres-theme="ocean">
                            <span class="cn-text d-block">蔚蓝典礼</span><span class="en-text small d-block opacity-75">Ocean blue</span>
                        </button></li>
                        <li><button type="button" class="dropdown-item py-2" data-award-pres-theme="jade">
                            <span class="cn-text d-block">翠玉正式</span><span class="en-text small d-block opacity-75">Jade formal</span>
                        </button></li>
                    </ul>
                </div>
                <button type="button" class="btn btn-sm btn-outline-light" id="award_presentation_fullscreen"
                        title="浏览器全屏 / Fullscreen">
                    <span class="cn-text">全屏</span><span class="en-text">FS</span>
                </button>
                <button type="button" class="btn btn-sm btn-danger" id="award_presentation_close">关闭<span class="en-text">Close</span></button>
            </div>
        </div>
        <div class="award-presentation-viewport">
            <div class="award-presentation-viewport-gutter award-presentation-viewport-gutter--left" aria-hidden="true"></div>
            <div id="award_presentation_slide_shell" class="award-presentation-slide-shell">
                <div id="award_presentation_slide" class="award-presentation-slide">
                    <div class="award-presentation-card">
                        <header class="award-presentation-head">
                            <div class="award-presentation-title-row" id="award_presentation_title_row">
                                <div class="award-presentation-title-cluster">
                                    <div id="award_presentation_title" class="award-presentation-title"></div>
                                    <div id="award_presentation_award_fraction" class="award-presentation-award-fraction" title="该奖项分页 / Pages within this award"></div>
                                </div>
                                <div id="award_presentation_group" class="award-presentation-group award-presentation-group--head-inline" hidden
                                     title="当前赛事归属 / Contest affiliation"></div>
                            </div>
                            <div id="award_presentation_subtitle" class="award-presentation-subtitle"></div>
                        </header>
                        <div class="award-presentation-card-list-vert">
                            <div id="award_presentation_list" class="award-pres-list" role="list"></div>
                        </div>
                    </div>
                </div>
            </div>
            <div class="award-presentation-viewport-gutter award-presentation-viewport-gutter--right" aria-hidden="true"></div>
        </div>
    </div>
</div>

<script type="text/javascript">
window.RANK_CONFIG = {
    key: 'award_deck_{$contest["contest_id"]}',
    cid_list: '{$contest["contest_id"]}',
    api_url: '/{$module}/contest/contest_data_ajax',
    team_photo_url: "/upload/contest_attach/{$contest_attach|default=''}/team_photo",
    school_badge_url: '/static/image/school_badge',
    region_flag_url: '/static/image/region_flag',
    rank_mode: 'team',
    flg_rank_cache: false
};
new AwardDeckPage();
</script>
