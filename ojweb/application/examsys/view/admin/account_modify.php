<div class="container-fluid py-3">
    <div class="row justify-content-center">
        <div class="col-12 col-lg-8 col-xl-6">
            <!-- 页面标题 -->
            <div class="d-flex align-items-center mb-4">
                <h4 class="mb-0 bilingual-inline">
                    <i class="bi bi-pencil-square me-2 text-primary"></i>
                    修改考生信息
                    <span class="en-text">Modify Examinee Information</span>
                </h4>
                <span class="ms-3 text-muted" id="current_contest_info">
                    考试ID: {$contest['contest_id']}
                </span>
            </div>

            <!-- 修改表单卡片 -->
            <div class="card">
                <div class="card-body">
                    <form id="account_modify_form" method="post" action="/{$module}/admin/team_modify_ajax">
                        <input type="hidden" id="cid_input" name="cid" value="{$contest['contest_id']}">
                        
                        <div class="row g-3">
                            <!-- 账号 -->
                            <div class="col-12">
                                <label for="team_id_input" class="form-label bilingual-label">
                                    账号：<span class="en-text">Account ID</span>
                                    <span class="text-danger">*</span>
                                </label>
                                <div class="input-group">
                                    <input type="text" id="team_id_input" class="form-control teaminfo_input" 
                                           name="team_id" placeholder="输入账号后自动加载信息" value="" required>
                                    <button type="button" class="btn btn-outline-secondary" id="load_info_btn">
                                        <i class="bi bi-search"></i>
                                        <span class="d-none d-sm-inline ms-1">查询</span>
                                    </button>
                                </div>
                                <div class="form-text bilingual-inline">
                                    输入账号后按回车或点击查询按钮加载考生信息
                                    <span class="en-text">Enter account ID and press Enter or click Search to load info</span>
                                </div>
                            </div>
                            
                            <!-- 姓名 -->
                            <div class="col-md-6">
                                <label for="name_input" class="form-label bilingual-label">
                                    姓名：<span class="en-text">Name</span>
                                </label>
                                <input type="text" id="name_input" class="form-control teaminfo_input" 
                                       name="name" placeholder="最多30个字符" value="">
                            </div>
                            
                            <!-- 单位/班级 -->
                            <div class="col-md-6">
                                <label for="school_input" class="form-label bilingual-label">
                                    单位/班级：<span class="en-text">School/Class</span>
                                </label>
                                <input type="text" id="school_input" class="form-control teaminfo_input" 
                                       name="school" placeholder="学校或班级" value="">
                            </div>
                            
                            <!-- 考场 -->
                            <div class="col-md-6">
                                <label for="room_input" class="form-label bilingual-label">
                                    考场：<span class="en-text">Room</span>
                                </label>
                                <input type="text" id="room_input" class="form-control teaminfo_input" 
                                       name="room" placeholder="考场编号" value="">
                            </div>
                            
                            <!-- 新密码 -->
                            <div class="col-12">
                                <label for="password_input" class="form-label bilingual-label">
                                    新密码：<span class="en-text">New Password</span>
                                </label>
                                <input type="text" id="password_input" class="form-control teaminfo_input" 
                                       name="password" placeholder="留空表示不修改密码，至少6个字符">
                                <div class="form-text bilingual-inline">
                                    留空表示不修改密码
                                    <span class="en-text">Leave blank to keep current password</span>
                                </div>
                            </div>
                        </div>
                        
                        <!-- 提交按钮 -->
                        <div class="d-flex justify-content-end gap-2 mt-4 pt-3 border-top">
                            <a href="/{$module}/admin/account_list?cid={$contest['contest_id']}" class="btn btn-outline-secondary">
                                <i class="bi bi-arrow-left me-1"></i>
                                <span class="bilingual-inline">返回列表<span class="en-text">Back to List</span></span>
                            </a>
                            <button type="submit" class="btn btn-primary" id="submit_button">
                                <i class="bi bi-check-circle me-1"></i>
                                <span class="bilingual-inline">提交修改<span class="en-text">Submit Changes</span></span>
                            </button>
                        </div>
                    </form>
                </div>
            </div>
            
            <!-- 操作提示 -->
            <div class="alert alert-info mt-3 small">
                <i class="bi bi-info-circle me-2"></i>
                <span class="bilingual-inline">
                    修改信息后点击"提交修改"保存更改。
                    <span class="en-text">Click "Submit Changes" to save modifications.</span>
                </span>
            </div>
        </div>
    </div>
</div>

<script>
$(document).ready(function() {
    const teamIdInput = $('#team_id_input');
    const cidInput = $('#cid_input');
    const form = $('#account_modify_form');
    const submitBtn = $('#submit_button');
    
    // 加载考生信息
    function loadTeamInfo() {
        const teamId = teamIdInput.val().trim();
        if (!teamId) {
            alerty.alert('请输入账号', 'Please enter account ID');
            return;
        }
        
        $.get('/{$module}/admin/teaminfo_ajax', {
            team_id: teamId,
            cid: cidInput.val()
        }, function(ret) {
            if (ret.code == 1) {
                // 填充表单
                $('.teaminfo_input').each(function() {
                    const fieldName = $(this).attr('name');
                    if (fieldName && fieldName !== 'password' && ret.data.teaminfo[fieldName] !== undefined) {
                        $(this).val(ret.data.teaminfo[fieldName]);
                    }
                });
                alerty.success('考生信息加载成功', 'Examinee info loaded successfully');
            } else {
                alerty.error(ret.msg || '加载失败');
            }
        }, 'json').fail(function() {
            alerty.error('请求失败，请重试', 'Request failed, please retry');
        });
    }
    
    // 回车或失焦时加载信息
    teamIdInput.on('blur', function() {
        if ($(this).val().trim()) {
            loadTeamInfo();
        }
    });
    
    teamIdInput.on('keypress', function(e) {
        if (e.which === 13) {
            e.preventDefault();
            loadTeamInfo();
        }
    });
    
    // 查询按钮点击
    $('#load_info_btn').on('click', function() {
        loadTeamInfo();
    });
    
    // 表单提交
    form.on('submit', function(e) {
        e.preventDefault();
        
        // 基础验证
        const teamId = teamIdInput.val().trim();
        if (!teamId) {
            alerty.alert('请输入账号', 'Please enter account ID');
            teamIdInput.focus();
            return false;
        }
        
        if (teamId.length < 3 || teamId.length > 30) {
            alerty.alert('账号长度需在3-30个字符之间', 'Account ID must be 3-30 characters');
            teamIdInput.focus();
            return false;
        }
        
        // 密码验证（如果填写了密码）
        const password = $('#password_input').val();
        if (password && password.length < 6) {
            alerty.alert('密码至少需要6个字符', 'Password must be at least 6 characters');
            $('#password_input').focus();
            return false;
        }
        
        // 禁用按钮防止重复提交
        submitBtn.prop('disabled', true);
        const originalHtml = submitBtn.html();
        submitBtn.html('<span class="spinner-border spinner-border-sm me-1"></span>提交中...');
        
        // Ajax 提交
        $.post(form.attr('action'), form.serialize(), function(ret) {
            if (ret.code == 1) {
                alerty.success(ret.msg || '修改成功', 'Modified successfully');
            } else {
                alerty.alert(ret.msg || '修改失败', 'Modification failed');
            }
        }, 'json').fail(function() {
            alerty.error('请求失败，请重试', 'Request failed, please retry');
        }).always(function() {
            // 恢复按钮状态
            setTimeout(function() {
                submitBtn.prop('disabled', false);
                submitBtn.html(originalHtml);
            }, 1000);
        });
        
        return false;
    });
});
</script>
