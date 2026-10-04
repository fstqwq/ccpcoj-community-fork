// 客户端管理 JavaScript 逻辑
let client_PreviewData = [];
let client_PreviewMode = false;
let client_delete_infoed = false;

/**
 * 后端约定：data.flg_bilingual 且含 msg_cn、msg_en 时使用 alerty 双参展示（中文在前、英文在后）
 * @param {object} ret - 接口返回
 * @param {'success'|'error'} type - success 或 error
 * @param {string} [defaultCn] - 无双语时的中文
 * @param {string} [defaultEn] - 无双语时的英文
 */
function ClientAlertRet(ret, type, defaultCn, defaultEn) {
    var isSuccess = type === 'success';
    var useBilingual = ret && ret.data && ret.data.flg_bilingual && ret.data.msg_cn !== undefined && ret.data.msg_en !== undefined;
    if (useBilingual) {
        if (isSuccess) window.alerty.success(ret.data.msg_cn, ret.data.msg_en);
        else window.alerty.error(ret.data.msg_cn, ret.data.msg_en);
    } else {
        var msg = (ret && ret.msg) ? ret.msg : (isSuccess ? (defaultCn || '成功') : (defaultCn || '操作失败'));
        var msgEn = (ret && ret.msg) ? ret.msg : (isSuccess ? (defaultEn || 'Success') : (defaultEn || 'Operation failed'));
        if (isSuccess) window.alerty.success(msg, msgEn);
        else window.alerty.error(msg, msgEn);
    }
}

// 初始化
function ClientManageInit() {
    // 初始化页面状态 - 显示实际数据
    client_PreviewMode = false;
    
    // 设置初始工具栏状态
    $("#toolbar_title").html(
        '<span class="cn-text"><i class="bi bi-database me-2"></i>实际数据</span><span class="en-text">Actual Data</span>'
    );
    $("#toolbar_subtitle").hide();
    $("#preview_import_tip").hide();
    $("#execute_import_btn").hide();
    $("#error_summary").hide();
    $("#batch_delete_btn").show();
    $("#export_standard_btn").show();
    updateBatchButtonsVisibility();
    
    // 应用实际数据样式
    $("#client_toolbar")
        .removeClass("toolbar-preview-data")
        .addClass("toolbar-actual-data");
    
    // 手动加载数据
    ClientLoadServerData();
    
    // 绑定所有事件
    ClientBindAllEvents();
}

// 手动加载服务器数据
function ClientLoadServerData() {
    $.ajax({
        url: CLIENT_MANAGE_CONFIG.client_list_url,
        type: "GET",
        success: function (data) {
            // 切换到实际数据模式
            client_PreviewMode = false;
            client_PreviewData = [];
            
            // 为每行数据添加 row_index
            if (data && Array.isArray(data)) {
                data.forEach((row, index) => {
                    if (!row.row_index) {
                        row.row_index = `server_${index}`;
                    }
                });
            }
            
            // 隐藏错误信息列，显示SSH相关列和行选择列（实际数据下可勾选管理）
            $("#client_table").bootstrapTable("hideColumn", "validation_errors");
            $("#client_table").bootstrapTable("showColumn", "state");
            $("#client_table").bootstrapTable("showColumn", "ssh_actions");
            $("#client_table").bootstrapTable("showColumn", "connect_status");
            $("#client_table").bootstrapTable("showColumn", "lock_status");
            
            // 更新工具栏状态
            $("#toolbar_title").html(
                '<span class="cn-text"><i class="bi bi-database me-2"></i>实际数据</span><span class="en-text">Actual Data</span>'
            );
            $("#toolbar_subtitle").hide();
            $("#preview_import_tip").hide();
            $("#execute_import_btn").hide();
            $("#error_summary").hide();
            $("#batch_delete_btn").show();
            $("#export_standard_btn").show();
            
            // 应用实际数据样式
            $("#client_toolbar")
                .removeClass("toolbar-preview-data")
                .addClass("toolbar-actual-data");
            
            // 加载数据到表格
            $("#client_table").bootstrapTable("load", data);
            updateBatchButtonsVisibility();
        },
        error: function () {
            console.error("加载服务器数据失败");
            window.alerty.error("加载数据失败，请刷新页面重试");
        },
    });
}

// 绑定所有事件
function ClientBindAllEvents() {
    // 解析数据按钮
    $("#parse_data_btn").on("click", function () {
        ClientParseTextData();
    });
    
    // 执行导入按钮
    $("#execute_import_btn").on("click", function () {
        ClientExecuteImport();
    });
    
    // Excel 文件选择
    $("#excel_file_btn").on("click", function () {
        $("#excel_file_input").click();
    });
    
    $("#excel_file_input").on("change", function (e) {
        const file = e.target.files[0];
        if (file) {
            ClientImportExcel(file);
        }
    });
    
    // 下载模板
    $("#download_template_btn").on("click", function () {
        ClientDownloadTemplate();
    });
    
    // 导出标准数据
    $("#export_standard_btn").on("click", function () {
        ClientExportStandard();
    });
    
    // 单个添加
    $("#add_single_btn").on("click", function () {
        ClientAddSingle();
    });
    
    // 批量删除
    $("#batch_delete_btn").on("click", function () {
        ClientBatchDelete();
    });
    
    // 批量 SSH 操作
    $("#batch_check_connect_btn").on("click", function () {
        ClientBatchSshAction('check_connect');
    });
    
    $("#batch_lock_btn").on("click", function () {
        ClientBatchSshAction('lock');
    });
    
    $("#batch_unlock_btn").on("click", function () {
        ClientBatchSshAction('unlock');
    });
    
    // 表格选择变化
    $("#client_table").on("check.bs.table uncheck.bs.table check-all.bs.table uncheck-all.bs.table", function () {
        updateBatchButtonsVisibility();
    });
    
    // IP 列点击：打开客户端详情（委托绑定，表格动态渲染）
    $(document).on("click", ".client-ip-link", function (e) {
        e.preventDefault();
        e.stopPropagation();
        var clientId = $(this).data("client-id");
        if (clientId !== undefined && clientId !== "") {
            ClientShowDetail(parseInt(clientId, 10));
        }
    });
    
    // 绑定表格点击事件（支持双击删除）
    BindClientTableEvents();
}

// 更新批量按钮可见性
function updateBatchButtonsVisibility() {
    const selected = $("#client_table").bootstrapTable("getSelections");
    const hasSelection = selected && selected.length > 0;
    const hasSshConfig = selected && selected.some(row => row.ssh_user && row.ssh_user.trim() !== '');
    
    $("#batch_delete_btn").toggle(hasSelection);
    $("#batch_check_connect_btn").toggle(hasSshConfig);
    $("#batch_lock_unlock_group").toggle(hasSshConfig);
    $("#batch_lock_btn").toggle(hasSshConfig);
    $("#batch_unlock_btn").toggle(hasSshConfig);
}

// 检查比赛状态
function ClientCheckContestStatus() {
    if (CLIENT_MANAGE_CONFIG.contest_status == 2) {
        window.alerty.error("比赛已结束，不允许操作 / Contest ended, operation not allowed");
        return false;
    }
    return true;
}

// 解析文本数据
function ClientParseTextData() {
    if (!ClientCheckContestStatus()) return;
    
    const clientDescription = $("#client_description").val().trim();
    
    if (!clientDescription) {
        window.alerty.error("请输入客户端描述 / Please enter client description");
        return;
    }
    
    // 清理旧数据
    client_PreviewData = [];
    client_PreviewMode = true;
    
    const lines = clientDescription.split("\n");
    const clientData = [];
    
    lines.forEach((line, index) => {
        line = line.trim();
        if (!line) return;
        
        const parts = line.split("\t");
            const ct = (parts[6] || "ssh").trim().toLowerCase();
            const clientInfo = {
                row_index: `text_${index}`,
                contest_id: CLIENT_MANAGE_CONFIG.contest_id,
                team_id_bind: parts[0] || "",
                ip_bind: parts[1] || "",
                ssh_user: parts[2] || "",
                ssh_pass: parts[3] || "",
                ssh_rsa: parts[4] || "",
                ssh_port: parts[5] || "22",
                client_type: ct === "client" ? "client" : "ssh",
                validation_errors: [],
            };
        
        // 验证数据
        const validationResult = ClientValidateData(clientInfo, index + 1);
        clientInfo.validation_errors = validationResult.errors;
        clientInfo.validation_warnings = validationResult.warnings || [];
        
        clientData.push(clientInfo);
    });
    
    if (clientData.length === 0) {
        window.alerty.error("没有有效的客户端数据 / No valid client data found");
        return;
    }
    
    ClientShowPreview(clientData);
}

// 验证IP地址格式（简单验证）
function isValidIpAddress(ip) {
    if (!ip || typeof ip !== 'string') return false;
    // 简单的IP地址格式验证（IPv4）
    const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
    return ipv4Regex.test(ip);
}

// 验证客户端数据
function ClientValidateData(clientInfo, rowNumber) {
    const errors = [];
    const warnings = [];
    
    // 验证 team_id_bind（队伍ID，与后端 CpcSysConfig.client_team_id_bind 一致：最多32字符，仅允许字母数字下划线）
    const TEAM_ID_BIND_MAX = 32;
    const TEAM_ID_BIND_REGEX = /^[a-zA-Z0-9_]+$/;
    const teamIdBind = (clientInfo.team_id_bind || "").trim();
    if (!teamIdBind) {
        errors.push(`第${rowNumber}行: 队伍号不能为空 / Row ${rowNumber}: team_id_bind is required`);
    } else {
        if (teamIdBind.length > TEAM_ID_BIND_MAX) {
            errors.push(`第${rowNumber}行: 队伍号最多${TEAM_ID_BIND_MAX}个字符 / Row ${rowNumber}: Team ID should not exceed ${TEAM_ID_BIND_MAX} characters`);
        }
        if (!TEAM_ID_BIND_REGEX.test(teamIdBind)) {
            errors.push(`第${rowNumber}行: 队伍号仅允许字母、数字、下划线 / Row ${rowNumber}: Only letters, numbers and underscores are allowed for Team ID`);
        }
        if (isValidIpAddress(teamIdBind)) {
            errors.push(`第${rowNumber}行: 队伍号不能是IP地址格式，请检查数据列顺序是否正确 / Row ${rowNumber}: team_id_bind cannot be an IP address format, please check if the column order is correct`);
        }
    }
    
    // 验证 ip_bind（IP地址）
    const ipBind = (clientInfo.ip_bind || "").trim();
    if (!ipBind) {
        errors.push(`第${rowNumber}行: IP地址不能为空 / Row ${rowNumber}: ip_bind is required`);
    }
    
    // 验证 SSH 配置
    // SSH相关信息允许全为空
    // 仅当提供了SSH账号（用户名）的时候，才验证密码、密钥方面是否存在
    const sshUser = (clientInfo.ssh_user || "").trim();
    const sshPass = (clientInfo.ssh_pass || "").trim();
    const sshRsa = (clientInfo.ssh_rsa || "").trim();
    const sshPort = (clientInfo.ssh_port || "22").trim();
    
    // 如果SSH用户名为空，则通过验证（允许SSH信息全为空）
    if (sshUser === "") {
        // 通过验证
    } else {
        // ssh_user 不应该是IP地址格式（防止字段混淆）
        if (isValidIpAddress(sshUser)) {
            errors.push(`第${rowNumber}行: SSH用户名不能是IP地址格式，请检查数据列顺序是否正确 / Row ${rowNumber}: SSH user cannot be an IP address format, please check if the column order is correct`);
        }
        
        // 如果提供了SSH用户名，则需要验证port必填
        if (sshPort === "") {
            errors.push(`第${rowNumber}行: 提供SSH用户名时，SSH端口为必填项 / Row ${rowNumber}: SSH port is required when SSH user is provided`);
        }
        
        // 如果提供了SSH用户名，pass 和 rsa 至少需要有一个
        if (sshPass === "" && sshRsa === "") {
            errors.push(`第${rowNumber}行: 提供SSH用户名时，SSH密码或RSA密钥至少需要提供一个 / Row ${rowNumber}: SSH password or RSA key is required when SSH user is provided`);
        }
    }
    
    return {
        valid: errors.length === 0,
        errors: errors,
        warnings: warnings,
    };
}

/**
 * IP 地址整组错误：在四段输入下方显示提示，不破坏 input-group 布局（定制以配合 FormValidationTip 风格）
 * @param {jQuery} $modal - 弹窗
 * @param {string} message - 双语 HTML 消息
 */
function ClientShowIpError($modal, message) {
    var $group = $modal.find(".client-ip-octets");
    var $err = $modal.find(".client-ip-error");
    $group.addClass("is-invalid");
    $modal.find(".client-ip-octet").addClass("is-invalid");
    if ($err.length) {
        $err.html(message).css("display", "block");
    }
}

/**
 * 清除 IP 整组错误状态及占位内容
 * @param {jQuery} $modal - 弹窗
 */
function ClientClearIpError($modal) {
    $modal.find(".client-ip-octets").removeClass("is-invalid");
    $modal.find(".client-ip-octet").removeClass("is-invalid");
    $modal.find(".client-ip-error").css("display", "none").empty();
    var ipOctet0 = $modal.find("input[name=ip_octet_0]")[0];
    if (ipOctet0) FormValidationTip.clearFieldError(ipOctet0);
}

/**
 * 使用 FormValidationTip 校验客户端表单（修改/单个添加弹窗），在字段旁显示错误
 * IP 使用定制展示：错误显示在四段输入下方，不破坏「一段一格」布局
 * @param {jQuery} $modal - 弹窗 jQuery 对象
 * @param {boolean} isAddSingle - 是否为「单个添加」（需要校验队伍号必填）
 * @returns {{ valid: boolean, firstInvalid: HTMLElement|null }}
 */
function ClientModalValidateWithFormValidationTip($modal, isAddSingle) {
    var firstInvalid = null;
    var msg = function (cn, en) { return FormValidationTip.createBilingualMessage(cn, en); };

    function clear(el) {
        if (el) FormValidationTip.clearFieldError(el);
    }
    function show(el, message) {
        if (el && !firstInvalid) firstInvalid = el;
        if (el) FormValidationTip.showFieldError(el, message);
    }

    var teamEl = $modal.find("[name=team_id_bind]")[0];
    var ipOctet0 = $modal.find("input[name=ip_octet_0]")[0];
    var sshUserEl = $modal.find("[name=ssh_user]")[0];
    var sshPassEl = $modal.find("[name=ssh_pass]")[0];
    var sshRsaEl = $modal.find("[name=ssh_rsa]")[0];
    var sshPortEl = $modal.find("[name=ssh_port]")[0];

    clear(teamEl);
    ClientClearIpError($modal);
    clear(sshUserEl);
    clear(sshPassEl);
    clear(sshRsaEl);
    clear(sshPortEl);

    if (isAddSingle && teamEl) {
        var teamVal = (teamEl.value || "").trim();
        if (!teamVal) {
            show(teamEl, msg("队伍号不能为空", "Team ID is required"));
        } else {
            if (teamVal.length > 64) {
                show(teamEl, msg("队伍号最多64个字符", "Team ID should not exceed 64 characters"));
            } else if (!/^[a-zA-Z0-9_]+$/.test(teamVal)) {
                show(teamEl, msg("队伍号仅允许字母、数字、下划线", "Only letters, numbers and underscores are allowed for Team ID"));
            }
        }
    }

    var octetVals = [];
    $modal.find(".client-ip-octet").each(function () {
        octetVals.push($(this).val().trim());
    });
    for (var i = 0; i < 4; i++) {
        var v = octetVals[i];
        var n = parseInt(v, 10);
        if (v === "" || isNaN(n) || n < 0 || n > 255) {
            if (ipOctet0 && !firstInvalid) firstInvalid = ipOctet0;
            ClientShowIpError($modal, msg("IP 地址每段须为 0-255 的整数", "Each IP octet must be 0-255"));
            break;
        }
    }

    var sshUser = (sshUserEl && sshUserEl.value) ? sshUserEl.value.trim() : "";
    var sshPass = (sshPassEl && sshPassEl.value) ? sshPassEl.value.trim() : "";
    var sshRsa = (sshRsaEl && sshRsaEl.value) ? sshRsaEl.value.trim() : "";
    var sshPortRaw = (sshPortEl && sshPortEl.value) ? sshPortEl.value.trim() : "";
    if (sshUser !== "") {
        if (sshPortRaw === "") {
            show(sshPortEl, msg("提供 SSH 用户名时，SSH 端口为必填项", "SSH port is required when SSH user is provided"));
        }
        if (sshPass === "" && sshRsa === "") {
            show(sshUserEl, msg("提供 SSH 用户名时，SSH 密码或 RSA 密钥至少需要提供一个", "SSH password or RSA key is required when SSH user is provided"));
        }
        if (sshUser && isValidIpAddress(sshUser)) {
            show(sshUserEl, msg("SSH 用户名不能是 IP 地址格式，请检查列顺序", "SSH user cannot be an IP address format"));
        }
    }

    return { valid: !firstInvalid, firstInvalid: firstInvalid };
}

// 显示预览
function ClientShowPreview(clientData) {
    client_PreviewData = clientData;
    client_PreviewMode = true;
    
    // 显示错误信息列
    $("#client_table").bootstrapTable("showColumn", "validation_errors");
    // 预览模式下不显示行选择列（数据尚未导入，不可勾选）
    $("#client_table").bootstrapTable("hideColumn", "state");
    // 隐藏SSH操作列（预览模式下不需要）
    $("#client_table").bootstrapTable("hideColumn", "ssh_actions");
    $("#client_table").bootstrapTable("hideColumn", "connect_status");
    $("#client_table").bootstrapTable("hideColumn", "lock_status");
    
    // 更新工具栏
    $("#toolbar_title").html(
        '<span class="cn-text"><i class="bi bi-table me-2"></i>数据预览</span><span class="en-text">Data Preview</span>'
    );
    $("#toolbar_subtitle")
        .html('请检查数据后执行导入<span class="en-text">Please review data before importing</span>')
        .show();
    $("#preview_import_tip").show();
    $("#execute_import_btn").show();
    $("#batch_delete_btn").hide();
    $("#batch_check_connect_btn").hide();
    $("#batch_lock_unlock_group").hide();
    $("#batch_lock_btn").hide();
    $("#batch_unlock_btn").hide();
    $("#export_standard_btn").hide();
    
    // 应用预览样式
    $("#client_toolbar")
        .removeClass("toolbar-actual-data")
        .addClass("toolbar-preview-data");
    
    // 计算错误和警告统计
    const errorRows = clientData.filter(
        (client) => client.validation_errors && client.validation_errors.length > 0
    );
    const warningRows = clientData.filter(
        (client) => client.validation_warnings && client.validation_warnings.length > 0
    );
    
    // 显示错误和警告统计
    showErrorWarningSummary(errorRows, warningRows);
    
    // 加载数据到表格
    $("#client_table").bootstrapTable("load", clientData);
    
    // 显示解析完成提示
    const totalRows = clientData.length;
    const errorCount = errorRows.length;
    const warningCount = warningRows.length;
    
    if (errorCount > 0) {
        window.alerty.warning(
            "数据解析完成",
            `成功解析 ${totalRows} 行数据，发现 ${errorCount} 行有错误${warningCount > 0 ? `，${warningCount} 行有警告` : ''}。请检查错误后执行导入。`
        );
    } else if (warningCount > 0) {
        window.alerty.warning(
            "数据解析完成",
            `成功解析 ${totalRows} 行数据，发现 ${warningCount} 行有警告。可以执行导入。`
        );
    } else {
        window.alerty.success(
            "数据解析完成",
            `成功解析 ${totalRows} 行数据，数据格式正确，可以执行导入。`
        );
    }
}

// 执行导入
function ClientExecuteImport() {
    if (!ClientCheckContestStatus()) return;
    
    if (client_PreviewData.length === 0) {
        window.alerty.error("没有可导入的数据 / No data to import");
        return;
    }
    
    // 检查是否有错误
    const hasErrors = client_PreviewData.some(row => 
        row.validation_errors && row.validation_errors.length > 0
    );
    
    if (hasErrors) {
        window.alerty.error("请先修复数据错误 / Please fix data errors first");
        return;
    }
    
    // 准备数据
    const clientList = client_PreviewData.map(row => ({
        contest_id: row.contest_id || CLIENT_MANAGE_CONFIG.contest_id,
        team_id_bind: row.team_id_bind || "",
        ip_bind: row.ip_bind || "",
        ssh_user: row.ssh_user || "",
        ssh_pass: row.ssh_pass || "",
        ssh_rsa: row.ssh_rsa || "",
        ssh_port: row.ssh_port || "22",
        client_type: (row.client_type === "client" ? "client" : "ssh"),
    }));

    var $container = $(".admin-import-container");
    var $overlay = $('<div class="import-submit-overlay"><div class="import-submit-overlay-inner"><div class="spinner-border text-light" role="status"></div><p class="mt-2 text-white mb-0"><span class="cn-text">正在提交导入，请稍候…</span><span class="en-text">Submitting import, please wait...</span></p></div></div>');
    $container.append($overlay);

    $.ajax({
        url: CLIENT_MANAGE_CONFIG.client_save_url,
        type: "POST",
        data: {
            client_list: JSON.stringify(clientList)
        },
        success: function (ret) {
            if (ret.code == 1) {
                ClientAlertRet(ret, 'success', '导入成功', 'Import successful');
                // 重置预览模式
                client_PreviewMode = false;
                client_PreviewData = [];
                $("#client_description").val("");
                $("#excel_file_input").val("");
                // 重新加载数据（会切换到实际数据模式）
                ClientLoadServerData();
            } else {
                ClientAlertRet(ret, 'error', '删除失败', 'Delete failed');
            }
        },
        error: function () {
            window.alerty.error("提交失败，请重试", "Submit failed, please try again");
        },
        complete: function () {
            $container.find(".import-submit-overlay").remove();
        },
    });
}

// 删除客户端
function ClientDelete(clientId) {
    if (!ClientCheckContestStatus()) return;
    
    window.alerty.confirm({
        message: "确定要删除这个客户端吗？",
        message_en: "Are you sure to delete this client?",
        callback: function () {
            $.ajax({
                url: CLIENT_MANAGE_CONFIG.client_del_url,
                type: "POST",
                data: {
                    client_id: clientId
                },
                success: function (ret) {
                    if (ret.code == 1) {
                        ClientAlertRet(ret, 'success', '删除成功', 'Deleted successfully');
                        ClientLoadServerData();
                    } else {
                        ClientAlertRet(ret, 'error', '删除失败', 'Delete failed');
                    }
                },
                error: function () {
                    window.alerty.error("删除失败，请重试");
                },
            });
        },
    });
}

// 批量删除
function ClientBatchDelete() {
    if (!ClientCheckContestStatus()) return;
    
    const selected = $("#client_table").bootstrapTable("getSelections");
    if (!selected || selected.length === 0) {
        window.alerty.warning("请先选择要删除的客户端 / Please select clients to delete");
        return;
    }
    
    const n = selected.length;
    window.alerty.confirm({
        message: `确定要删除选中的 ${n} 个客户端吗？`,
        message_en: `Are you sure to delete ${n} selected clients?`,
        callback: function () {
            const deletePromises = selected.map(row => {
                return new Promise((resolve, reject) => {
                    $.ajax({
                        url: CLIENT_MANAGE_CONFIG.client_del_url,
                        type: "POST",
                        data: {
                            client_id: row.client_id
                        },
                        success: function (ret) {
                            if (ret.code == 1) {
                                resolve({ success: true, row: row });
                            } else {
                                resolve({ success: false, row: row, error: ret.msg });
                            }
                        },
                        error: function () {
                            resolve({ success: false, row: row, error: "Network error" });
                        },
                    });
                });
            });
            
            Promise.all(deletePromises).then(results => {
                const successCount = results.filter(r => r.success).length;
                const failCount = results.filter(r => !r.success).length;
                const failRows = results.filter(r => !r.success).map(r => r.row.client_id || r.row.ip_bind);
                
                let message = `成功删除 ${successCount} 个客户端 / Successfully deleted ${successCount} clients`;
                if (failCount > 0) {
                    message += `\n失败 ${failCount} 个 / Failed ${failCount}`;
                    if (failRows.length > 0) {
                        message += `\n失败的ID: ${failRows.join(", ")}`;
                    }
                }
                
                window.alerty.alert(message);
                ClientLoadServerData();
            });
        },
    });
}

// 批量 SSH 操作
function ClientBatchSshAction(action) {
    if (!ClientCheckContestStatus()) return;
    
    const selected = $("#client_table").bootstrapTable("getSelections");
    if (!selected || selected.length === 0) {
        window.alerty.warning("请先选择要操作的客户端 / Please select clients to operate");
        return;
    }
    
    // 过滤出有 SSH 配置的客户端
    const sshClients = selected.filter(row => row.ssh_user && row.ssh_user.trim() !== '');
    if (sshClients.length === 0) {
        window.alerty.warning("选中的客户端没有 SSH 配置 / Selected clients have no SSH config");
        return;
    }
    
    const clientIds = sshClients.map(row => row.client_id);
    
    $.ajax({
        url: CLIENT_MANAGE_CONFIG.client_ssh_url,
        type: "POST",
        data: {
            action: action,
            client_ids: clientIds
        },
        success: function (ret) {
            if (ret.code == 1) {
                ClientAlertRet(ret, 'success', '操作成功', 'Operation successful');
                // 延迟刷新数据，等待 Python 处理
                setTimeout(() => {
                    ClientLoadServerData();
                }, 2000);
            } else {
                window.alerty.error(ret.msg);
            }
        },
        error: function () {
            window.alerty.error("操作失败，请重试");
        },
    });
}

// SSH 操作（单行）
function ClientSshAction(clientId, action) {
    if (!ClientCheckContestStatus()) return;
    
    $.ajax({
        url: CLIENT_MANAGE_CONFIG.client_ssh_url,
        type: "POST",
        data: {
            action: action,
            client_ids: [clientId]
        },
        success: function (ret) {
            if (ret.code == 1) {
                ClientAlertRet(ret, 'success', '操作成功', 'Operation successful');
                setTimeout(() => {
                    ClientLoadServerData();
                }, 2000);
            } else {
                ClientAlertRet(ret, 'error', '操作失败', 'Operation failed');
            }
        },
        error: function () {
            window.alerty.error("操作失败，请重试", "Operation failed, please try again");
        },
    });
}

// Excel 导入
async function ClientImportExcel(file) {
    if (!ClientCheckContestStatus()) return;
    
    try {
        const workbook = new ExcelJS.Workbook();
        const buffer = await file.arrayBuffer();
        await workbook.xlsx.load(buffer);
        
        const worksheet = workbook.getWorksheet(1);
        if (!worksheet) {
            throw new Error("Excel文件中没有找到工作表");
        }
        
        const clientData = [];
        const errors = [];
        
        worksheet.eachRow((row, rowNumber) => {
            if (rowNumber === 1) return; // 跳过表头
            
            const values = row.values;
            
            // 检查是否为样例行（最后一列包含"样例"或"Example"）
            const lastColumnValue = ClientExtractCellValue(values[values.length - 1]) || "";
            if (
                lastColumnValue.includes("样例") ||
                lastColumnValue.includes("Example")
            ) {
                return; // 跳过样例行
            }
            
            // ExcelJS的row.values数组，索引0通常是空或undefined
            // 格式：队伍号(1), IP(2), SSH用户(3), SSH密码(4), SSH RSA(5), SSH端口(6), 客户端类型(7), 样例(8)
            const ctExcel = (ClientExtractCellValue(values[7]) || "ssh").trim().toLowerCase();
            const clientInfo = {
                row_index: `excel_${rowNumber}`,
                contest_id: CLIENT_MANAGE_CONFIG.contest_id,
                team_id_bind: ClientExtractCellValue(values[1]) || "",
                ip_bind: ClientExtractCellValue(values[2]) || "",
                ssh_user: ClientExtractCellValue(values[3]) || "",
                ssh_pass: ClientExtractCellValue(values[4]) || "",
                ssh_rsa: ClientExtractCellValue(values[5]) || "",
                ssh_port: ClientExtractCellValue(values[6]) || "22",
                client_type: ctExcel === "client" ? "client" : "ssh",
                validation_errors: [],
            };
            
            const validationResult = ClientValidateData(clientInfo, rowNumber);
            clientInfo.validation_errors = validationResult.errors;
            clientInfo.validation_warnings = validationResult.warnings || [];
            
            clientData.push(clientInfo);
        });
        
        if (clientData.length === 0) {
            window.alerty.error("没有有效的客户端数据 / No valid client data found");
            return;
        }
        
        ClientShowPreview(clientData);
    } catch (error) {
        console.error("导入Excel失败:", error);
        window.alerty.error("导入Excel失败: " + error.message);
    }
}

// 提取单元格值
function ClientExtractCellValue(cellValue) {
    if (cellValue === null || cellValue === undefined) return "";
    if (typeof cellValue === "object" && cellValue.text !== undefined) {
        return cellValue.text.toString().trim();
    }
    return cellValue.toString().trim();
}

// 下载模板
async function ClientDownloadTemplate() {
    try {
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet("客户端信息");
        
        // 设置列定义（包含样例列）
        const clientHeaders = [
            { header: "队伍号", header_en: "Team ID", key: "team_id_bind", width: 15 },
            { header: "IP地址", header_en: "IP Address", key: "ip_bind", width: 15 },
            { header: "SSH用户", header_en: "SSH User", key: "ssh_user", width: 15 },
            { header: "SSH密码", header_en: "SSH Password", key: "ssh_pass", width: 15 },
            { header: "SSH RSA", header_en: "SSH RSA", key: "ssh_rsa", width: 30 },
            { header: "SSH端口", header_en: "SSH Port", key: "ssh_port", width: 10 },
            { header: "客户端类型", header_en: "Client Type", key: "client_type", width: 12 },
            { header: "", header_en: "", key: "sample", width: 15 }, // 样例列，无表头
        ];
        
        worksheet.columns = clientHeaders.map((h) => ({
            key: h.key,
            width: h.width,
        }));
        
        // 添加中英双语表头（样例列使用空字符串）
        const headerRow = worksheet.addRow(
            clientHeaders.map((h) =>
                h.key === "sample" ? "" : `${h.header}\n${h.header_en}`
            )
        );
        
        // 设置表头样式
        headerRow.height = 40;
        headerRow.eachCell((cell, colNumber) => {
            cell.alignment = {
                vertical: "middle",
                horizontal: "center",
                wrapText: true,
            };
            cell.font = { bold: true, size: 11 };
            cell.fill = {
                type: "pattern",
                pattern: "solid",
                fgColor: { argb: "FFE6F3FF" },
            };
            cell.border = {
                top: { style: "thin" },
                left: { style: "thin" },
                bottom: { style: "thin" },
                right: { style: "thin" },
            };
        });
        
        // 添加样例数据（各种兼容格式）
        const sampleData = [
            {
                team_id_bind: "team001",
                ip_bind: "192.168.1.100",
                ssh_user: "admin",
                ssh_pass: "password123",
                ssh_rsa: "",
                ssh_port: "22",
                client_type: "ssh",
                sample: "样例/Example",
            },
            {
                team_id_bind: "team002",
                ip_bind: "192.168.1.101",
                ssh_user: "root",
                ssh_pass: "",
                ssh_rsa: "-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----",
                ssh_port: "2222",
                client_type: "ssh",
                sample: "样例/Example",
            },
            {
                team_id_bind: "team003",
                ip_bind: "10.0.0.50",
                ssh_user: "",
                ssh_pass: "",
                ssh_rsa: "",
                ssh_port: "",
                client_type: "client",
                sample: "样例/Example",
            },
        ];
        
        // 添加样例行（包含样例列内容）
        sampleData.forEach((row, index) => {
            const excelRow = worksheet.addRow(row);
            excelRow.eachCell((cell, colNumber) => {
                cell.fill = {
                    type: "pattern",
                    pattern: "solid",
                    fgColor: { argb: "FFF0F0F0" },
                };
                cell.font = { color: { argb: "FF808080" } };
                cell.border = {
                    top: { style: "thin" },
                    left: { style: "thin" },
                    bottom: { style: "thin" },
                    right: { style: "thin" },
                };
            });
        });
        
        // 生成 Excel 文件
        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], {
            type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "客户端信息模板.xlsx";
        a.click();
        window.URL.revokeObjectURL(url);
        
        window.alerty.success("模板下载成功 / Template downloaded successfully");
    } catch (error) {
        console.error("下载模板失败:", error);
        window.alerty.error("下载模板失败 / Template download failed");
    }
}

// 导出标准数据
function ClientExportStandard() {
    try {
        const clientData = $("#client_table").bootstrapTable("getData", {
            includeHiddenRows: true,
        });
        if (!clientData || clientData.length === 0) {
            window.alerty.error("没有数据可导出 / No data to export");
            return;
        }
        
        ClientExportToExcel(clientData, "标准客户端数据");
        
        window.alerty.success(
            "标准数据导出成功 / Standard data exported successfully"
        );
    } catch (error) {
        console.error("导出标准数据失败:", error);
        window.alerty.error("导出标准数据失败 / Standard data export failed");
    }
}

// 导出到Excel
async function ClientExportToExcel(clientData, filename) {
    try {
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet("客户端数据");
        
        // 设置列定义（不包含ID列）
        const clientHeaders = [
            { header: "队伍号", header_en: "Team ID", key: "team_id_bind", width: 15 },
            { header: "IP地址", header_en: "IP Address", key: "ip_bind", width: 15 },
            { header: "SSH用户", header_en: "SSH User", key: "ssh_user", width: 15 },
            { header: "SSH密码", header_en: "SSH Password", key: "ssh_pass", width: 15 },
            { header: "SSH RSA", header_en: "SSH RSA", key: "ssh_rsa", width: 30 },
            { header: "SSH端口", header_en: "SSH Port", key: "ssh_port", width: 10 },
            { header: "客户端类型", header_en: "Client Type", key: "client_type", width: 12 },
        ];
        
        worksheet.columns = clientHeaders.map((h) => ({
            key: h.key,
            width: h.width,
        }));
        
        // 添加中英双语表头
        const headerRow = worksheet.addRow(
            clientHeaders.map((h) => `${h.header}\n${h.header_en}`)
        );
        
        // 设置表头样式
        headerRow.height = 40;
        headerRow.font = { bold: true };
        headerRow.eachCell((cell) => {
            cell.alignment = {
                vertical: "middle",
                horizontal: "center",
                wrapText: true,
            };
            cell.border = {
                top: { style: "thin" },
                left: { style: "thin" },
                bottom: { style: "thin" },
                right: { style: "thin" },
            };
        });
        
        // 添加数据（不包含ID列）
        clientData.forEach((client) => {
            const excelRow = worksheet.addRow([
                client.team_id_bind || "",
                client.ip_bind || "",
                client.ssh_user || "",
                client.ssh_pass || "",
                client.ssh_rsa || "",
                client.ssh_port || "22",
                (client.client_type === "client" ? "client" : "ssh"),
            ]);
            
            excelRow.eachCell((cell) => {
                cell.border = {
                    top: { style: "thin" },
                    left: { style: "thin" },
                    bottom: { style: "thin" },
                    right: { style: "thin" },
                };
            });
        });
        
        // 生成文件名
        const contestTitle = CLIENT_MANAGE_CONFIG.contest_title || "Contest";
        const contestId = CLIENT_MANAGE_CONFIG.contest_id || "";
        const now = new Date();
        const pad = (n) => (n < 10 ? "0" : "") + n;
        const date = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;
        const time = `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
        const exportFilename = `${filename}_${contestId}_${date}_${time}`;
        
        // 导出文件
        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], {
            type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${exportFilename}.xlsx`;
        a.click();
        window.URL.revokeObjectURL(url);
    } catch (error) {
        console.error("导出Excel失败:", error);
        throw error;
    }
}

// 转义 HTML 用于在 formatter 中安全显示
function ClientEscapeHtml(s) {
    if (s === null || s === undefined) return "";
    var t = String(s);
    return t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// 客户端类型列：ssh / 客户端
function FormatterClientType(value, row, index) {
    var ct = (row.client_type === "client") ? "client" : "ssh";
    if (ct === "client") {
        return '<span class="badge bg-info" title="Client">客户端</span>';
    }
    return '<span class="badge bg-secondary" title="SSH">SSH</span>';
}

// IP 列：不触发行勾选，点击打开客户端详情
function FormatterIpBind(value, row, index) {
    var clientId = row.client_id != null ? row.client_id : "";
    var displayIp = ClientEscapeHtml(value || "");
    return '<div class="client-cell-no-select" onclick="event.stopPropagation();">' +
        '<a href="javascript:void(0)" class="client-ip-link" data-client-id="' + ClientEscapeHtml(String(clientId)) + '" title="点击查看详情 / Click for details">' + displayIp + '</a>' +
        '</div>';
}

// 格式化函数
function FormatterConnectStatus(value, row, index) {
    if (!row.last_connect_time) {
        return '<span class="connect-status-icon connect-status-unknown" title="未知 / Unknown"></span>未知';
    }
    
    const connectTime = new Date(row.last_connect_time);
    const now = new Date();
    const diffMinutes = (now - connectTime) / (1000 * 60);
    
    let statusClass = "connect-status-old";
    let statusText = "超过2小时";
    let title = `最后连接: ${row.last_connect_time}`;
    
    if (diffMinutes <= 10) {
        statusClass = "connect-status-10min";
        statusText = "10分钟内";
    } else if (diffMinutes <= 30) {
        statusClass = "connect-status-30min";
        statusText = "30分钟内";
    } else if (diffMinutes <= 120) {
        statusClass = "connect-status-2hour";
        statusText = "2小时内";
    }
    
    return `<span class="connect-status-icon ${statusClass}" title="${title}"></span>${statusText}`;
}

function FormatterLockStatus(value, row, index) {
    const lockStatus = row.lock_status || "unlock";
    const lockTime = row.lock_time || "";
    
    if (lockStatus === "lock") {
        return `<span class="badge bg-danger">已锁屏</span>${lockTime ? `<br><small>${lockTime}</small>` : ""}`;
    } else {
        return `<span class="badge bg-success">未锁屏</span>${lockTime ? `<br><small>${lockTime}</small>` : ""}`;
    }
}

function FormatterSshActions(value, row, index) {
    if (!row.ssh_user || row.ssh_user.trim() === "") {
        return '<span class="text-muted">无SSH配置</span>';
    }
    
    const buttons = [
        `<button class="btn btn-sm btn-primary" onclick="ClientSshAction(${row.client_id}, 'check_connect')" title="确认连接 / Check Connection">
            <i class="bi bi-wifi"></i>
        </button>`,
        `<button class="btn btn-sm btn-warning" onclick="ClientSshAction(${row.client_id}, 'lock')" title="锁屏 / Lock">
            <i class="bi bi-lock"></i>
        </button>`,
        `<button class="btn btn-sm btn-info" onclick="ClientSshAction(${row.client_id}, 'unlock')" title="解锁 / Unlock">
            <i class="bi bi-unlock"></i>
        </button>`,
    ];
    
    return buttons.join(" ");
}

function FormatterModify(value, row, index) {
    return `<div class="client-cell-no-select" onclick="event.stopPropagation();"><button class="btn btn-sm btn-primary" onclick="ClientModify(${row.client_id})" title="修改 / Modify">
        <i class="bi bi-pencil"></i>
    </button></div>`;
}

function FormatterDel(value, row, index) {
    return `<div class="client-cell-no-select" onclick="event.stopPropagation();"><button class="btn btn-sm btn-danger" onclick="ClientDelete(${row.client_id})" title="删除 / Delete">
        <i class="bi bi-trash"></i>
    </button></div>`;
}

// 客户端详情弹窗：点击 IP 列打开，每项可复制，支持一键复制整套为 JSON
function ClientShowDetail(clientId) {
    var row = $("#client_table").bootstrapTable("getRowByUniqueId", clientId);
    if (!row) {
        window.alerty.warning("未找到该客户端 / Client not found");
        return;
    }
    
    var modalId = "client-detail-modal-" + Date.now();
    var detailFields = [
        { key: "client_id", labelCn: "客户端ID", labelEn: "Client ID" },
        { key: "contest_id", labelCn: "比赛ID", labelEn: "Contest ID" },
        { key: "team_id_bind", labelCn: "队伍号", labelEn: "Team ID" },
        { key: "ip_bind", labelCn: "IP 地址", labelEn: "IP Address" },
        { key: "ssh_user", labelCn: "SSH 用户", labelEn: "SSH User" },
        { key: "ssh_pass", labelCn: "SSH 密码", labelEn: "SSH Password" },
        { key: "ssh_rsa", labelCn: "SSH RSA 密钥", labelEn: "SSH RSA Key" },
        { key: "ssh_port", labelCn: "SSH 端口", labelEn: "SSH Port" },
        { key: "client_type", labelCn: "客户端类型", labelEn: "Client Type" },
        { key: "last_connect_time", labelCn: "最后连接时间", labelEn: "Last Connect Time" },
        { key: "connect_status", labelCn: "连接状态", labelEn: "Connect Status" },
        { key: "lock_status", labelCn: "锁屏状态", labelEn: "Lock Status" },
        { key: "lock_time", labelCn: "锁屏时间", labelEn: "Lock Time" }
    ];
    
    var rowsHtml = detailFields.map(function (f) {
        var val = row[f.key];
        var displayVal = (val === null || val === undefined || val === "") ? "-" : String(val);
        if (f.key === "client_type") {
            displayVal = (val === "client") ? "客户端 (Client)" : "SSH";
        }
        var escapedVal = ClientEscapeHtml(displayVal);
        if (f.key === "ssh_pass") {
            return '<div class="client-detail-row d-flex align-items-center mb-2">' +
                '<label class="client-detail-label text-muted me-2 flex-shrink-0" style="min-width: 110px;">' + f.labelCn + ' <span class="en-text">' + f.labelEn + '</span></label>' +
                '<div class="input-group flex-grow-1">' +
                '<input type="password" class="form-control form-control-sm client-detail-password" readonly placeholder="-" />' +
                '<button type="button" class="btn btn-sm btn-outline-secondary client-detail-password-toggle" title="显示明文 / Show password" aria-label="显示密码"><i class="bi bi-eye"></i></button>' +
                '</div>' +
                '<button type="button" class="btn btn-sm btn-outline-secondary ms-1 client-detail-copy-btn" data-field="' + ClientEscapeHtml(f.key) + '" title="复制 / Copy"><i class="bi bi-clipboard"></i></button>' +
                '</div>';
        }
        return '<div class="client-detail-row d-flex align-items-center mb-2">' +
            '<label class="client-detail-label text-muted me-2 flex-shrink-0" style="min-width: 110px;">' + f.labelCn + ' <span class="en-text">' + f.labelEn + '</span></label>' +
            '<div class="client-detail-value flex-grow-1 text-break border rounded px-2 py-1 client-detail-copy" data-field="' + ClientEscapeHtml(f.key) + '" title="点击复制 / Click to copy">' + escapedVal + '</div>' +
            '<button type="button" class="btn btn-sm btn-outline-secondary ms-1 client-detail-copy-btn" data-field="' + ClientEscapeHtml(f.key) + '" title="复制 / Copy"><i class="bi bi-clipboard"></i></button>' +
            '</div>';
    }).join("");
    
    var modalHtml =
        '<div class="modal fade" id="' + modalId + '" tabindex="-1" aria-labelledby="' + modalId + '-label" aria-hidden="true">' +
        '  <div class="modal-dialog modal-lg">' +
        '    <div class="modal-content">' +
        '      <div class="modal-header">' +
        '        <h5 class="modal-title bilingual-inline" id="' + modalId + '-label"><span class="cn-text">客户端详情</span><span class="en-text">Client Details</span></h5>' +
        '        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>' +
        '      </div>' +
        '      <div class="modal-body">' +
        '        <div class="client-detail-list">' + rowsHtml + '</div>' +
        '        <div class="mt-3">' +
        '          <button type="button" class="btn btn-outline-primary btn-sm" id="client-detail-copy-json-btn"><i class="bi bi-clipboard me-1"></i><span class="cn-text">复制整套信息为 JSON</span><span class="en-text">Copy full client as JSON</span></button>' +
        '        </div>' +
        '      </div>' +
        '    </div>' +
        '  </div>' +
        '</div>';
    
    $("body").append(modalHtml);
    var $modal = $("#" + modalId);
    var modalEl = $modal[0];
    var bsModal = new bootstrap.Modal(modalEl);
    
    $modal.find("input.client-detail-password").val(row.ssh_pass || "");
    
    $modal.on("click", ".client-detail-password-toggle", function () {
        var $btn = $(this);
        var $input = $btn.siblings("input.client-detail-password");
        if ($input.attr("type") === "password") {
            $input.attr("type", "text");
            $btn.attr("title", "隐藏密码 / Hide password").find("i").removeClass("bi-eye").addClass("bi-eye-slash");
        } else {
            $input.attr("type", "password");
            $btn.attr("title", "显示明文 / Show password").find("i").removeClass("bi-eye-slash").addClass("bi-eye");
        }
    });
    
    function copyToClipboard(text, doneCallback) {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).then(function () {
                if (doneCallback) doneCallback();
            }, function () {
                fallbackCopy(text, doneCallback);
            });
        } else {
            fallbackCopy(text, doneCallback);
        }
    }
    function fallbackCopy(text, doneCallback) {
        var ta = document.createElement("textarea");
        ta.value = text;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        try {
            document.execCommand("copy");
            if (doneCallback) doneCallback();
        } catch (err) {
            window.alerty.error("复制失败 / Copy failed");
        }
        document.body.removeChild(ta);
    }
    
    $modal.on("click", ".client-detail-copy, .client-detail-copy-btn", function (e) {
        e.preventDefault();
        var field = $(this).data("field");
        var copyVal = (field && row[field] !== undefined && row[field] !== null) ? String(row[field]) : "";
        copyToClipboard(copyVal, function () {
            window.alerty.success("已复制 / Copied");
        });
    });
    
    $modal.find("#client-detail-copy-json-btn").on("click", function () {
        var jsonRow = {};
        detailFields.forEach(function (f) {
            var v = row[f.key];
            jsonRow[f.key] = v === null || v === undefined ? "" : v;
        });
        var jsonStr = JSON.stringify(jsonRow, null, 2);
        copyToClipboard(jsonStr, function () {
            window.alerty.success("已复制 JSON / JSON copied");
        });
    });
    
    $modal.on("hidden.bs.modal", function () {
        $modal.remove();
    });
    
    bsModal.show();
}

// 绑定表格事件（支持双击删除等）
function BindClientTableEvents() {
    const table = $("#client_table");
    
    // 防止重复绑定
    table.off("click-cell.bs.table");
    table.off("dbl-click-cell.bs.table");
    
    table.on("click-cell.bs.table", function (e, field, td, row) {
        if (field === "delete") {
            if (!client_delete_infoed) {
                client_delete_infoed = true;
            }
        }
        // modify 列由按钮 onclick 处理，此处不重复调用，且已用 client-cell-no-select 阻止触发行勾选
    });
    
    table.on("dbl-click-cell.bs.table", function (e, field, td, row) {
        if (field === "delete") {
            if (client_PreviewMode) {
                // 预览模式：从待提交数据中删除
                ClientDeleteFromPreview(row);
            } else {
                // 实际数据模式：调用后端删除接口
                ClientDelete(row.client_id);
            }
        }
    });
}

// 从预览数据中删除
function ClientDeleteFromPreview(row) {
    if (!client_PreviewData) return;

    // 从预览数据中移除
    const index = client_PreviewData.findIndex(r => r.row_index === row.row_index);
    if (index >= 0) {
        client_PreviewData.splice(index, 1);

        // 重新计算错误和警告统计
        const errorRows = client_PreviewData.filter(
            (client) => client.validation_errors && client.validation_errors.length > 0
        );
        const warningRows = client_PreviewData.filter(
            (client) => client.validation_warnings && client.validation_warnings.length > 0
        );

        // 重新加载表格数据
        $("#client_table").bootstrapTable("load", client_PreviewData);

        // 显示错误和警告统计
        showErrorWarningSummary(errorRows, warningRows);

        window.alerty.success("已从预览数据中删除 / Removed from preview data");
    }
}

// 显示错误和警告统计的通用函数（与 teamgen.js 保持一致）
function showErrorWarningSummary(
    errorRows,
    warningRows,
    executeImportBtnId = "#execute_import_btn",
    errorSummaryId = "#error_summary"
) {
    if (errorRows.length > 0 || warningRows.length > 0) {
        let alertClass = "alert-warning";
        let alertIcon = "bi-exclamation-triangle";
        let contentHtml = "";

        if (errorRows.length > 0) {
            alertClass = "alert-danger";
            alertIcon = "bi-exclamation-triangle-fill";
            contentHtml = `<i class="bi ${alertIcon} me-2"></i><span class="cn-text">发现 ${errorRows.length} 行数据有错误，请检查后执行导入。</span><span class="en-text">Found ${errorRows.length} rows with errors, please check before importing.</span>`;
            $(executeImportBtnId).prop("disabled", true).addClass("disabled");
        } else if (warningRows.length > 0) {
            contentHtml = `<i class="bi ${alertIcon} me-2"></i><span class="cn-text">发现 ${warningRows.length} 行数据有警告，请检查后执行导入。</span><span class="en-text">Found ${warningRows.length} rows with warnings, please check before importing.</span>`;
            $(executeImportBtnId).prop("disabled", false).removeClass("disabled");
        }

        $(errorSummaryId)
            .removeClass("alert-warning alert-danger")
            .addClass(alertClass)
            .html(contentHtml)
            .show();
    } else {
        $(errorSummaryId).hide();
        $(executeImportBtnId).prop("disabled", false).removeClass("disabled");
    }
}

// 格式化验证错误
function FormatterValidationErrors(value, row, index) {
    if (!row.validation_errors || row.validation_errors.length === 0) {
        return '<span class="text-success"><i class="bi bi-check-circle"></i></span>';
    }
    
    const errorCount = row.validation_errors.length;
    const errorText = row.validation_errors.join("; ");
    
    return `<span class="text-danger" title="${errorText}" style="cursor: pointer;">
        <i class="bi bi-exclamation-triangle"></i> ${errorCount}
    </span>`;
}

// 将 IP 字符串拆分为 4 段（用于分段输入）
function parseIpToOctets(ipStr) {
    if (!ipStr || typeof ipStr !== "string") {
        return ["", "", "", ""];
    }
    const parts = ipStr.trim().split(".");
    return [
        parts[0] || "",
        parts[1] || "",
        parts[2] || "",
        parts[3] || ""
    ];
}

// 从 4 个段输入合并为 IP 字符串
function octetsToIp(octets) {
    if (!Array.isArray(octets) || octets.length !== 4) {
        return "";
    }
    return octets.map(function (s) { return (s || "").trim(); }).join(".");
}

// 修改客户端：打开 modal 表单，提交后根据后台返回更新表格
function ClientModify(clientId) {
    if (!ClientCheckContestStatus()) return;
    
    const tableData = $("#client_table").bootstrapTable("getData");
    const row = tableData.find(function (r) { return r.client_id == clientId; });
    if (!row) {
        window.alerty.error("未找到该客户端数据 / Client row not found");
        return;
    }
    
    const octets = parseIpToOctets(row.ip_bind || "");
    const teamIdBind = (row.team_id_bind || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    const sshUser = (row.ssh_user || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    const sshPass = (row.ssh_pass || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    const sshRsa = (row.ssh_rsa || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    const sshPort = (row.ssh_port || "22").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    const clientType = (row.client_type === "client" ? "client" : "ssh");
    
    const modalId = "client-modify-modal-" + clientId;
    const modalHtml = 
        '<div class="modal fade" id="' + modalId + '" tabindex="-1" aria-labelledby="' + modalId + '-label" aria-hidden="true" data-bs-backdrop="static">' +
        '  <div class="modal-dialog">' +
        '    <div class="modal-content">' +
        '      <div class="modal-header">' +
        '        <h5 class="modal-title bilingual-inline" id="' + modalId + '-label"><span class="cn-text">修改客户端</span><span class="en-text">Modify Client</span></h5>' +
        '        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>' +
        '      </div>' +
        '      <div class="modal-body">' +
        '        <form id="client-modify-form-' + clientId + '">' +
        '          <div class="mb-3">' +
        '            <label class="form-label bilingual-inline"><span class="cn-text">队伍号</span><span class="en-text">Team ID</span></label>' +
        '            <input type="text" class="form-control" value="' + teamIdBind + '" readonly disabled />' +
        '            <div class="form-text bilingual-inline"><span class="cn-text">队伍号不可更改，用于定位数据</span><span class="en-text">Team ID cannot be changed</span></div>' +
        '          </div>' +
        '          <div class="mb-3">' +
        '            <label class="form-label bilingual-inline"><span class="cn-text">IP 地址</span><span class="en-text">IP Address</span></label>' +
        '            <div class="client-ip-octets input-group">' +
        '              <input type="text" class="form-control client-ip-octet" name="ip_octet_0" data-octet="0" maxlength="3" inputmode="numeric" pattern="[0-9]*" value="' + (octets[0] || "") + '" placeholder="0-255" />' +
        '              <span class="input-group-text">.</span>' +
        '              <input type="text" class="form-control client-ip-octet" data-octet="1" maxlength="3" inputmode="numeric" pattern="[0-9]*" value="' + (octets[1] || "") + '" placeholder="0-255" />' +
        '              <span class="input-group-text">.</span>' +
        '              <input type="text" class="form-control client-ip-octet" data-octet="2" maxlength="3" inputmode="numeric" pattern="[0-9]*" value="' + (octets[2] || "") + '" placeholder="0-255" />' +
        '              <span class="input-group-text">.</span>' +
        '              <input type="text" class="form-control client-ip-octet" data-octet="3" maxlength="3" inputmode="numeric" pattern="[0-9]*" value="' + (octets[3] || "") + '" placeholder="0-255" />' +
        '              <button type="button" class="btn btn-outline-secondary client-ip-copy-btn" title="复制 IP / Copy IP" aria-label="复制IP"><i class="bi bi-clipboard"></i></button>' +
        '            </div>' +
        '            <div class="client-ip-error" style="display:none; font-size:0.875em; color:#dc3545; margin-top:0.25rem"></div>' +
        '          </div>' +
        '          <div class="mb-3">' +
        '            <label class="form-label bilingual-inline"><span class="cn-text">SSH 用户</span><span class="en-text">SSH User</span></label>' +
        '            <input type="text" class="form-control" name="ssh_user" value="' + sshUser + '" />' +
        '          </div>' +
        '          <div class="mb-3">' +
        '            <label class="form-label bilingual-inline"><span class="cn-text">SSH 密码</span><span class="en-text">SSH Password</span></label>' +
        '            <input type="password" class="form-control" name="ssh_pass" value="' + sshPass + '" />' +
        '          </div>' +
        '          <div class="mb-3">' +
        '            <label class="form-label bilingual-inline"><span class="cn-text">SSH RSA 密钥</span><span class="en-text">SSH RSA Key</span></label>' +
        '            <textarea class="form-control" name="ssh_rsa" rows="3">' + sshRsa + '</textarea>' +
        '          </div>' +
        '          <div class="mb-3">' +
        '            <label class="form-label bilingual-inline"><span class="cn-text">SSH 端口</span><span class="en-text">SSH Port</span></label>' +
        '            <input type="text" class="form-control" name="ssh_port" value="' + sshPort + '" placeholder="22" />' +
        '          </div>' +
        '          <div class="mb-3">' +
        '            <label class="form-label bilingual-inline"><span class="cn-text">客户端类型</span><span class="en-text">Client Type</span></label>' +
        '            <select class="form-select" name="client_type">' +
        '              <option value="ssh"' + (clientType === "ssh" ? ' selected' : '') + '>SSH 方式</option>' +
        '              <option value="client"' + (clientType === "client" ? ' selected' : '') + '>客户端方式</option>' +
        '            </select>' +
        '            <div class="form-text bilingual-inline"><span class="cn-text">用于后续按类型控制客户端方式</span><span class="en-text">Used to control client mode by type</span></div>' +
        '          </div>' +
        '        </form>' +
        '      </div>' +
        '      <div class="modal-footer">' +
        '        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal"><span class="cn-text">取消</span><span class="en-text">Cancel</span></button>' +
        '        <button type="button" class="btn btn-primary" id="client-modify-submit-' + clientId + '"><span class="cn-text">提交</span><span class="en-text">Submit</span></button>' +
        '      </div>' +
        '    </div>' +
        '  </div>' +
        '</div>';
    
    $("body").append(modalHtml);
    var $modal = $("#" + modalId);
    var modalEl = $modal[0];
    var bsModal = new bootstrap.Modal(modalEl, { backdrop: "static" });
    
    // 从 4 个输入框收集当前 IP 字符串
    function getModalCurrentIp() {
        var octetVals = [];
        $modal.find(".client-ip-octet").each(function () {
            octetVals.push($(this).val().trim());
        });
        return octetsToIp(octetVals);
    }
    
    // 判断是否为合法单段 0-255
    function isLegalOctet(s) {
        var n = parseInt(s, 10);
        return s !== "" && !isNaN(n) && n >= 0 && n <= 255 && (String(n) === s.trim());
    }
    // 解析粘贴内容：若为合法 IP 返回 [a,b,c,d]，若为合法数字返回 [n,"","",""]，否则返回 null
    function parsePasteAsIpOrOctet(text) {
        if (!text || typeof text !== "string") return null;
        var t = text.trim();
        var parts = t.split(/\./);
        if (parts.length === 4) {
            var octets = parts.map(function (p) { return p.trim(); });
            if (octets.every(isLegalOctet)) return octets;
        }
        if (parts.length === 1 && isLegalOctet(t)) return [t, "", "", ""];
        return null;
    }
    
    // IP 分段输入：仅允许数字，满 3 位自动聚焦下一段；输入时清除 IP 校验错误提示
    $modal.find(".client-ip-octet").on("input", function () {
        ClientClearIpError($modal);
        var $input = $(this);
        var val = $input.val().replace(/\D/g, "");
        if (val.length > 3) val = val.slice(0, 3);
        $input.val(val);
        if (val.length >= 3) {
            var next = $modal.find(".client-ip-octet[data-octet=\"" + (parseInt($input.attr("data-octet"), 10) + 1) + "\"]");
            if (next.length) next[0].focus();
        }
    }).on("keydown", function (e) {
        var $input = $(this);
        if (e.key === "Backspace" && $input.val() === "") {
            var prev = $modal.find(".client-ip-octet[data-octet=\"" + (parseInt($input.attr("data-octet"), 10) - 1) + "\"]");
            if (prev.length) {
                e.preventDefault();
                prev[0].focus();
            }
        }
    });
    
    // 第一个格子粘贴：合法 IP 则填入四段，合法数字则只填第一段
    $modal.find(".client-ip-octet[data-octet=\"0\"]").on("paste", function (e) {
        var pasted = (e.originalEvent && e.originalEvent.clipboardData) ? e.originalEvent.clipboardData.getData("text") : "";
        var parsed = parsePasteAsIpOrOctet(pasted);
        if (parsed) {
            e.preventDefault();
            $modal.find(".client-ip-octet").each(function (i) {
                $(this).val(parsed[i] || "");
            });
            if (parsed.length === 4 && parsed[3] !== "") {
                $modal.find(".client-ip-octet[data-octet=\"3\"]").focus();
            } else {
                $modal.find(".client-ip-octet[data-octet=\"0\"]").focus();
            }
        }
    });
    
    // 复制当前填好的 IP
    $modal.find(".client-ip-copy-btn").on("click", function () {
        var ip = getModalCurrentIp();
        if (!ip || ip.split(".").some(function (s) { return s === ""; })) {
            window.alerty.warning("请先填写完整 IP 地址 / Please fill in a complete IP address");
            return;
        }
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(ip).then(function () {
                window.alerty.success("已复制 / Copied");
            }, function () {
                fallbackCopyIp(ip);
            });
        } else {
            fallbackCopyIp(ip);
        }
    });
    function fallbackCopyIp(ip) {
        var ta = document.createElement("textarea");
        ta.value = ip;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        try {
            document.execCommand("copy");
            window.alerty.success("已复制 / Copied");
        } catch (err) {
            window.alerty.error("复制失败 / Copy failed");
        }
        document.body.removeChild(ta);
    }
    
    $modal.find("#client-modify-submit-" + clientId).on("click", function () {
        var result = ClientModalValidateWithFormValidationTip($modal, false);
        if (!result.valid) {
            if (result.firstInvalid) {
                result.firstInvalid.focus();
                result.firstInvalid.scrollIntoView({ behavior: "smooth", block: "center" });
            }
            return;
        }
        var octetVals = [];
        $modal.find(".client-ip-octet").each(function () {
            octetVals.push($(this).val().trim());
        });
        var ipBind = octetsToIp(octetVals);
        var sshUser = $modal.find("[name=ssh_user]").val().trim();
        var sshPass = $modal.find("[name=ssh_pass]").val().trim();
        var sshRsa = $modal.find("[name=ssh_rsa]").val().trim();
        var sshPort = $modal.find("[name=ssh_port]").val().trim() || "22";
        var clientTypeVal = $modal.find("[name=client_type]").val();
        if (clientTypeVal !== "client") clientTypeVal = "ssh";
        
        var $btn = $(this);
        $btn.prop("disabled", true);
        $.ajax({
            url: CLIENT_MANAGE_CONFIG.client_update_url,
            type: "POST",
            data: {
                client_id: clientId,
                ip_bind: ipBind,
                ssh_user: sshUser,
                ssh_pass: sshPass,
                ssh_rsa: sshRsa,
                ssh_port: sshPort,
                client_type: clientTypeVal
            },
            success: function (ret) {
                if (ret && ret.code == 1 && ret.data && ret.data.row) {
                    ClientAlertRet(ret, 'success', '修改成功', 'Modified successfully');
                    var newRow = ret.data.row;
                    if (row.row_index) newRow.row_index = row.row_index;
                    $("#client_table").bootstrapTable("updateByUniqueId", {
                        id: clientId,
                        row: newRow,
                        replace: true
                    });
                    bsModal.hide();
                } else {
                    ClientAlertRet(ret, 'error', '更新失败', 'Update failed');
                }
            },
            error: function () {
                window.alerty.error("提交失败，请重试", "Submit failed, please try again");
            },
            complete: function () {
                $btn.prop("disabled", false);
            }
        });
    });
    
    $modal.on("hidden.bs.modal", function () {
        $modal.remove();
    });
    
    bsModal.show();
}

// 单个添加客户端：复用与修改客户端相同的 modal 表单，提交到批量添加接口，成功后刷新表格
function ClientAddSingle() {
    if (!ClientCheckContestStatus()) return;
    
    var modalId = "client-add-single-modal";
    var modalHtml =
        '<div class="modal fade" id="' + modalId + '" tabindex="-1" aria-labelledby="' + modalId + '-label" aria-hidden="true" data-bs-backdrop="static">' +
        '  <div class="modal-dialog">' +
        '    <div class="modal-content">' +
        '      <div class="modal-header">' +
        '        <h5 class="modal-title bilingual-inline" id="' + modalId + '-label"><span class="cn-text">单个添加</span><span class="en-text">Add Single</span></h5>' +
        '        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>' +
        '      </div>' +
        '      <div class="modal-body">' +
        '        <form id="client-add-single-form">' +
        '          <div class="mb-3">' +
        '            <label class="form-label bilingual-inline"><span class="cn-text">队伍号</span><span class="en-text">Team ID</span></label>' +
        '            <input type="text" class="form-control" name="team_id_bind" maxlength="64" value="" placeholder="必填" />' +
        '          </div>' +
        '          <div class="mb-3">' +
        '            <label class="form-label bilingual-inline"><span class="cn-text">IP 地址</span><span class="en-text">IP Address</span></label>' +
        '            <div class="client-ip-octets input-group">' +
        '              <input type="text" class="form-control client-ip-octet" name="ip_octet_0" data-octet="0" maxlength="3" inputmode="numeric" pattern="[0-9]*" value="" placeholder="0-255" />' +
        '              <span class="input-group-text">.</span>' +
        '              <input type="text" class="form-control client-ip-octet" data-octet="1" maxlength="3" inputmode="numeric" pattern="[0-9]*" value="" placeholder="0-255" />' +
        '              <span class="input-group-text">.</span>' +
        '              <input type="text" class="form-control client-ip-octet" data-octet="2" maxlength="3" inputmode="numeric" pattern="[0-9]*" value="" placeholder="0-255" />' +
        '              <span class="input-group-text">.</span>' +
        '              <input type="text" class="form-control client-ip-octet" data-octet="3" maxlength="3" inputmode="numeric" pattern="[0-9]*" value="" placeholder="0-255" />' +
        '              <button type="button" class="btn btn-outline-secondary client-ip-copy-btn" title="复制 IP / Copy IP" aria-label="复制IP"><i class="bi bi-clipboard"></i></button>' +
        '            </div>' +
        '            <div class="client-ip-error" style="display:none; font-size:0.875em; color:#dc3545; margin-top:0.25rem"></div>' +
        '          </div>' +
        '          <div class="mb-3">' +
        '            <label class="form-label bilingual-inline"><span class="cn-text">SSH 用户</span><span class="en-text">SSH User</span></label>' +
        '            <input type="text" class="form-control" name="ssh_user" value="" />' +
        '          </div>' +
        '          <div class="mb-3">' +
        '            <label class="form-label bilingual-inline"><span class="cn-text">SSH 密码</span><span class="en-text">SSH Password</span></label>' +
        '            <input type="password" class="form-control" name="ssh_pass" value="" />' +
        '          </div>' +
        '          <div class="mb-3">' +
        '            <label class="form-label bilingual-inline"><span class="cn-text">SSH RSA 密钥</span><span class="en-text">SSH RSA Key</span></label>' +
        '            <textarea class="form-control" name="ssh_rsa" rows="3"></textarea>' +
        '          </div>' +
        '          <div class="mb-3">' +
        '            <label class="form-label bilingual-inline"><span class="cn-text">SSH 端口</span><span class="en-text">SSH Port</span></label>' +
        '            <input type="text" class="form-control" name="ssh_port" value="22" placeholder="22" />' +
        '          </div>' +
        '          <div class="mb-3">' +
        '            <label class="form-label bilingual-inline"><span class="cn-text">客户端类型</span><span class="en-text">Client Type</span></label>' +
        '            <select class="form-select" name="client_type">' +
        '              <option value="ssh" selected>SSH 方式</option>' +
        '              <option value="client">客户端方式</option>' +
        '            </select>' +
        '          </div>' +
        '        </form>' +
        '      </div>' +
        '      <div class="modal-footer">' +
        '        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal"><span class="cn-text">取消</span><span class="en-text">Cancel</span></button>' +
        '        <button type="button" class="btn btn-primary" id="client-add-single-submit"><span class="cn-text">提交</span><span class="en-text">Submit</span></button>' +
        '      </div>' +
        '    </div>' +
        '  </div>' +
        '</div>';
    
    $("body").append(modalHtml);
    var $modal = $("#" + modalId);
    var modalEl = $modal[0];
    var bsModal = new bootstrap.Modal(modalEl, { backdrop: "static" });
    
    function getModalCurrentIp() {
        var octetVals = [];
        $modal.find(".client-ip-octet").each(function () {
            octetVals.push($(this).val().trim());
        });
        return octetsToIp(octetVals);
    }
    function isLegalOctet(s) {
        var n = parseInt(s, 10);
        return s !== "" && !isNaN(n) && n >= 0 && n <= 255 && (String(n) === s.trim());
    }
    function parsePasteAsIpOrOctet(text) {
        if (!text || typeof text !== "string") return null;
        var t = text.trim();
        var parts = t.split(/\./);
        if (parts.length === 4) {
            var octets = parts.map(function (p) { return p.trim(); });
            if (octets.every(isLegalOctet)) return octets;
        }
        if (parts.length === 1 && isLegalOctet(t)) return [t, "", "", ""];
        return null;
    }
    
    $modal.find(".client-ip-octet").on("input", function () {
        ClientClearIpError($modal);
        var $input = $(this);
        var val = $input.val().replace(/\D/g, "");
        if (val.length > 3) val = val.slice(0, 3);
        $input.val(val);
        if (val.length >= 3) {
            var next = $modal.find(".client-ip-octet[data-octet=\"" + (parseInt($input.attr("data-octet"), 10) + 1) + "\"]");
            if (next.length) next[0].focus();
        }
    }).on("keydown", function (e) {
        var $input = $(this);
        if (e.key === "Backspace" && $input.val() === "") {
            var prev = $modal.find(".client-ip-octet[data-octet=\"" + (parseInt($input.attr("data-octet"), 10) - 1) + "\"]");
            if (prev.length) {
                e.preventDefault();
                prev[0].focus();
            }
        }
    });
    
    $modal.find(".client-ip-octet[data-octet=\"0\"]").on("paste", function (e) {
        var pasted = (e.originalEvent && e.originalEvent.clipboardData) ? e.originalEvent.clipboardData.getData("text") : "";
        var parsed = parsePasteAsIpOrOctet(pasted);
        if (parsed) {
            e.preventDefault();
            $modal.find(".client-ip-octet").each(function (i) {
                $(this).val(parsed[i] || "");
            });
            if (parsed.length === 4 && parsed[3] !== "") {
                $modal.find(".client-ip-octet[data-octet=\"3\"]").focus();
            } else {
                $modal.find(".client-ip-octet[data-octet=\"0\"]").focus();
            }
        }
    });
    
    $modal.find(".client-ip-copy-btn").on("click", function () {
        var ip = getModalCurrentIp();
        if (!ip || ip.split(".").some(function (s) { return s === ""; })) {
            window.alerty.warning("请先填写完整 IP 地址 / Please fill in a complete IP address");
            return;
        }
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(ip).then(function () {
                window.alerty.success("已复制 / Copied");
            }, function () {
                var ta = document.createElement("textarea");
                ta.value = ip;
                ta.style.position = "fixed";
                ta.style.opacity = "0";
                document.body.appendChild(ta);
                ta.select();
                try {
                    document.execCommand("copy");
                    window.alerty.success("已复制 / Copied");
                } catch (err) {
                    window.alerty.error("复制失败 / Copy failed");
                }
                document.body.removeChild(ta);
            });
        } else {
            var ta = document.createElement("textarea");
            ta.value = ip;
            ta.style.position = "fixed";
            ta.style.opacity = "0";
            document.body.appendChild(ta);
            ta.select();
            try {
                document.execCommand("copy");
                window.alerty.success("已复制 / Copied");
            } catch (err) {
                window.alerty.error("复制失败 / Copy failed");
            }
            document.body.removeChild(ta);
        }
    });
    
    $modal.find("#client-add-single-submit").on("click", function () {
        var result = ClientModalValidateWithFormValidationTip($modal, true);
        if (!result.valid) {
            if (result.firstInvalid) {
                result.firstInvalid.focus();
                result.firstInvalid.scrollIntoView({ behavior: "smooth", block: "center" });
            }
            return;
        }
        var teamIdBind = $modal.find("[name=team_id_bind]").val().trim();
        var octetVals = [];
        $modal.find(".client-ip-octet").each(function () {
            octetVals.push($(this).val().trim());
        });
        var ipBind = octetsToIp(octetVals);
        var sshUser = $modal.find("[name=ssh_user]").val().trim();
        var sshPass = $modal.find("[name=ssh_pass]").val().trim();
        var sshRsa = $modal.find("[name=ssh_rsa]").val().trim();
        var sshPort = $modal.find("[name=ssh_port]").val().trim() || "22";
        var clientTypeVal = $modal.find("[name=client_type]").val();
        if (clientTypeVal !== "client") clientTypeVal = "ssh";
        
        var clientList = [{
            contest_id: CLIENT_MANAGE_CONFIG.contest_id,
            team_id_bind: teamIdBind,
            ip_bind: ipBind,
            ssh_user: sshUser,
            ssh_pass: sshPass,
            ssh_rsa: sshRsa,
            ssh_port: sshPort,
            client_type: clientTypeVal
        }];
        
        var $btn = $(this);
        $btn.prop("disabled", true);
        $.ajax({
            url: CLIENT_MANAGE_CONFIG.client_save_url,
            type: "POST",
            data: {
                client_list: JSON.stringify(clientList),
                insert_only: 1
            },
            success: function (ret) {
                if (ret && ret.code == 1) {
                    ClientAlertRet(ret, 'success', '添加成功', 'Add successful');
                    bsModal.hide();
                    ClientLoadServerData();
                } else {
                    ClientAlertRet(ret, 'error', '添加失败', 'Add failed');
                }
            },
            error: function () {
                window.alerty.error("提交失败，请重试", "Submit failed, please try again");
            },
            complete: function () {
                $btn.prop("disabled", false);
            }
        });
    });
    
    $modal.on("hidden.bs.modal", function () {
        $modal.remove();
    });
    
    bsModal.show();
}

