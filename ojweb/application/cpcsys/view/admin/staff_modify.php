<!-- 修改工作人员信息 Modal（赛务生成页；预览态仅前端写回，提交导入后再落库） -->
<div class="modal fade" id="staffModifyModal" tabindex="-1" aria-labelledby="staffModifyModalLabel" aria-hidden="true">
    <div class="modal-dialog modal-lg">
        <div class="modal-content">
            <div class="modal-header">
                <h5 class="modal-title bilingual-inline" id="staffModifyModalLabel">
                    <span class="cn-text"><i class="bi bi-pencil-square me-2"></i>
                    修改工作人员信息
                    </span><span class="en-text">Update Staff Information</span>
                    <span class="ms-2 text-muted" id="staff_modify_header_team_id" style="font-size: 0.85em; font-weight: normal;"></span>
                </h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div class="modal-body">
                <form id="staff_modify_form" method="post" action="/cpcsys/admin/team_modify_ajax">
                    <input type="hidden" name="staff_modify_mode" value="1">
                    <div class="row g-3">
                        <input type="hidden" id="staff_modify_team_id" name="team_id" value="">
                        <input type="hidden" id="staff_modify_cid" name="cid" value="">

                        <div class="col-md-6">
                            <label for="staff_modify_name" class="form-label bilingual-label">
                                姓名：<span class="en-text">Name</span>
                            </label>
                            <input type="text" id="staff_modify_name" class="form-control staffinfo_input" name="name"
                                   placeholder="姓名" value="">
                        </div>

                        <div class="col-md-6">
                            <label for="staff_modify_room" class="form-label bilingual-label">
                                房间/区域：<span class="en-text">Room</span>
                            </label>
                            <input type="text" id="staff_modify_room" class="form-control staffinfo_input" name="room"
                                   placeholder="机房或区域" value="">
                        </div>

                        <div class="col-md-6">
                            <label for="staff_modify_privilege" class="form-label bilingual-label">
                                权限：<span class="en-text">Privilege</span>
                            </label>
                            <select id="staff_modify_privilege" class="form-select staffinfo_input" name="privilege">
                                <option value="">请选择 / Select</option>
                                <option value="admin">admin（核心管理）</option>
                                <option value="printer">printer（打印）</option>
                                <option value="balloon_manager">balloon_manager（气球管理员）</option>
                                <option value="balloon_sender">balloon_sender（送气球）</option>
                                <option value="watcher">watcher（观察员）</option>
                                <option value="ccs_reader">ccs_reader（CCS 只读）</option>
                            </select>
                        </div>

                        <div class="col-12" id="staff_modify_groups_wrap" style="display:none;">
                            <label for="staff_modify_group_ids" class="form-label bilingual-label">
                                赛事归属：<span class="en-text">Event Affiliations</span>
                            </label>
                            <select id="staff_modify_group_ids" class="form-select staffinfo_input" name="group_ids[]" multiple size="4"></select>
                            <div class="form-text">
                                <span class="bilingual-inline">
                                    <span>可多选，按 Ctrl / Command 选择多个归属</span>
                                    <span class="en-text">Multi-select supported (Ctrl / Command)</span>
                                </span>
                            </div>
                        </div>

                        <div class="col-12">
                            <label for="staff_modify_password" class="form-label bilingual-label">
                                新密码：<span class="en-text">New Password</span>
                            </label>
                            <input type="text" id="staff_modify_password" class="form-control staffinfo_input"
                                   placeholder="留空表示不修改密码，至少6个字符" name="password" autocomplete="new-password">
                            <div class="form-text">
                                <span class="bilingual-inline">
                                    <span>留空表示不修改密码</span>
                                    <span class="en-text">Leave blank to keep current password</span>
                                </span>
                            </div>
                        </div>
                    </div>
                </form>
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">
                    <span class="cn-text"><i class="bi bi-x-circle me-1"></i>
                    取消</span><span class="en-text">Cancel</span>
                </button>
                <button type="button" class="btn btn-primary bilingual-button" id="staff_modify_submit_button">
                    <span class="cn-text"><i class="bi bi-check-circle me-2"></i>
                    提交修改</span><span class="en-text">Submit Changes</span>
                </button>
            </div>
        </div>
    </div>
</div>
