// 班级管理业务逻辑函数
// 注意：只包含业务逻辑函数，执行逻辑在 view 中触发

let clss_PreviewData = [];
let clss_PreviewMode = false;
let clss_delete_infoed = false;

// 初始化预览模式
function ClssInitPreviewMode() {
    clss_PreviewData = [];
    clss_PreviewMode = false;
    clss_delete_infoed = false;
    
    // 设置初始工具栏状态
    $("#toolbar_title").html(
        '<span class="cn-text"><i class="bi bi-info-circle me-2"></i>请先解析Excel或数据</span><span class="en-text">Please parse Excel or data first</span>'
    );
    $("#toolbar_subtitle").hide();
    $("#execute_import_btn").hide();
    $("#error_summary").hide();
    
    // 应用无数据状态样式
    $("#clss_toolbar")
        .removeClass("toolbar-preview-data")
        .addClass("toolbar-no-data");
}

// 解析文本数据
function ClssParseTextData() {
    const clssDescription = $("#clss_description").val().trim();
    
    if (!clssDescription) {
        window.alerty.error("请输入班级描述 / Please enter class description");
        return;
    }
    
    // 清理旧数据
    clss_PreviewData = [];
    clss_PreviewMode = false;
    
    // 解析数据（包含验证）
    const parsedData = ClssParseTextDataInternal(clssDescription);
    
    // 显示预览表
    ClssShowPreview(parsedData);
}

// 解析文本数据内部函数
function ClssParseTextDataInternal(clssDescription) {
    try {
        const clssList = clssDescription.split("\n");
        const parsedData = [];
        
        for (let i = 0; i < clssList.length; i++) {
            try {
                const line = clssList[i] || "";
                if (line.trim() === "") continue;
                
                const elements = line.split(/\t/).map((elem) => {
                    if (typeof elem === "string") {
                        return elem.trim();
                    }
                    return String(elem || "").trim();
                });
                
                // 检查第一行是否为表头
                if (i === 0 && ClssIsHeaderRow(elements)) {
                    continue;
                }
                
                // 检查是否为样例行（最后一列包含"样例"或"Example"）
                const lastColumnValue = elements[elements.length - 1] || "";
                if (lastColumnValue.includes("样例") || lastColumnValue.includes("Example")) {
                    continue; // 跳过样例行
                }
                
                // 判断是修改模式（有clss_id）还是添加模式
                let clss_id = null;
                let title_idx = 0;
                let year_idx = 1;
                let semester_idx = 2;
                let teachers_idx = 3;
                
                // 如果第一个元素是纯数字，认为是修改模式
                if (elements.length >= 5 && /^\d+$/.test(elements[0])) {
                    clss_id = parseInt(elements[0]);
                    title_idx = 1;
                    year_idx = 2;
                    semester_idx = 3;
                    teachers_idx = 4;
                }
                
                const clss = {
                    row_index: `text_${i}`,
                    clss_id: clss_id,
                    clss_title: elements[title_idx]?.trim() || "",
                    clss_year: elements[year_idx]?.trim() || "-1",
                    clss_semester: elements[semester_idx]?.trim() || "",
                    teachers: elements[teachers_idx]?.trim() || "",
                    validation_errors: [],
                };
                
                // 验证数据
                const validationResult = ClssValidateClssData(clss, i + 1);
                clss.validation_errors = validationResult.errors;
                clss.validation_warnings = validationResult.warnings;
                
                parsedData.push(clss);
            } catch (lineError) {
                console.error(`解析第${i + 1}行数据时出错:`, lineError);
                parsedData.push({
                    row_index: `text_error_${i}`,
                    clss_id: null,
                    clss_title: `解析错误 (第${i + 1}行)`,
                    clss_year: "-1",
                    clss_semester: "",
                    teachers: "",
                    validation_errors: [`数据格式错误: ${escapeHtml(lineError.message)}`],
                    validation_warnings: [],
                });
            }
        }
        
        return parsedData;
    } catch (error) {
        console.error("解析文本数据时出错:", error);
        alerty.error("解析数据失败", `数据格式错误: ${escapeHtml(error.message)}`);
        return [];
    }
}

// 检测是否为表头行
function ClssIsHeaderRow(row) {
    if (!row || row.length === 0) return false;
    
    const headerKeywords = [
        "班级", "Class", "clss",
        "标题", "Title", "title",
        "年级", "Year", "year",
        "学期", "Semester", "semester",
        "教师", "Teacher", "teacher",
        "ID", "id"
    ];
    
    const rowText = row.join(" ").toLowerCase();
    let matchCount = 0;
    
    for (const keyword of headerKeywords) {
        if (rowText.includes(keyword.toLowerCase())) {
            matchCount++;
        }
    }
    
    return matchCount >= 3;
}

// 验证班级数据
function ClssValidateClssData(clss, rowIndex) {
    const errors = [];
    const warnings = [];
    
    // 验证班级标题（必填）
    if (!clss.clss_title) {
        errors.push(`班级标题不能为空`);
    } else if (clss.clss_title.length > 99) {
        errors.push(`班级标题过长（最多99字符）`);
    }
    
    // 验证学期格式（必填）
    if (!clss.clss_semester) {
        errors.push(`学期不能为空`);
    } else if (!/^\d{4}-\d{4}-\d$/.test(clss.clss_semester)) {
        errors.push(`学期格式不正确（应为YYYY-YYYY-N格式）`);
    }
    
    // 验证年级（可选，但如果是数字则验证范围）
    if (clss.clss_year && clss.clss_year !== "-1") {
        const year = parseInt(clss.clss_year);
        if (isNaN(year) || year < 1900 || year > 2100) {
            warnings.push(`年级值可能不正确`);
        }
    }
    
    // 验证教师数量
    if (clss.teachers) {
        const teachers_array = clss.teachers.split(',').filter(t => t.trim());
        if (teachers_array.length > 100) {
            errors.push(`教师数量过多（最多100个）`);
        }
    }
    
    return { errors, warnings };
}

// 显示预览数据
function ClssShowPreview(data) {
    clss_PreviewData = data;
    clss_PreviewMode = true;
    
    // 检查重复的clss_id（仅修改模式）
    ClssCheckDuplicateClssIds(data);
    
    // 显示错误信息列
    $("#clss_table").bootstrapTable("showColumn", "validation_errors");
    
    // 更新工具栏
    $("#toolbar_title").html(
        '<span class="cn-text"><i class="bi bi-table me-2"></i>数据预览</span><span class="en-text">Data Preview</span>'
    );
    $("#toolbar_subtitle")
        .html('请检查数据后执行导入<span class="en-text">Please review data before importing</span>')
        .show();
    $("#execute_import_btn").show();
    
    // 应用预览数据样式
    $("#clss_toolbar")
        .removeClass("toolbar-no-data")
        .addClass("toolbar-preview-data");
    
    // 计算错误和警告统计
    const errorRows = data.filter(
        (clss) => clss.validation_errors && clss.validation_errors.length > 0
    );
    const warningRows = data.filter(
        (clss) => clss.validation_warnings && clss.validation_warnings.length > 0
    );
    
    // 显示错误和警告统计
    ClssShowErrorWarningSummary(errorRows, warningRows);
    
    // 加载数据到表格
    $("#clss_table").bootstrapTable("load", data);
    
    // 显示解析完成提示
    const totalRows = data.length;
    const errorCount = errorRows.length;
    const warningCount = warningRows.length;
    
    if (errorCount > 0) {
        alerty.warning(
            "数据解析完成",
            `成功解析 ${totalRows} 行数据，发现 ${errorCount} 行有错误，${warningCount} 行有警告。请检查错误后执行导入。`
        );
    } else if (warningCount > 0) {
        alerty.warning(
            "数据解析完成",
            `成功解析 ${totalRows} 行数据，发现 ${warningCount} 行有警告。可以执行导入。`
        );
    } else {
        alerty.success(
            "数据解析完成",
            `成功解析 ${totalRows} 行数据，数据格式正确，可以执行导入。`
        );
    }
}

// 显示提交结果数据
function ClssShowResult(data) {
    // 处理返回数据：将 teachers 字符串转换为数组格式（如果需要）
    const processedData = data.map((clss) => {
        const processed = { ...clss };
        
        // 如果 teachers 是字符串格式（",user1,user2,"），转换为数组格式
        if (typeof processed.teachers === 'string') {
            const teachersStr = processed.teachers.trim().replace(/^,|,$/g, '');
            if (teachersStr) {
                const teacherIds = teachersStr.split(',').filter(t => t.trim());
                // 转换为数组格式（与 FormatterExpClssTeachers 兼容）
                processed.teachers = teacherIds.map(user_id => ({
                    user_id: user_id.trim(),
                    nick: user_id.trim(), // 如果没有 nick，使用 user_id
                    school: ''
                }));
            } else {
                processed.teachers = [];
            }
        } else if (!Array.isArray(processed.teachers)) {
            processed.teachers = [];
        }
        
        return processed;
    });
    
    clss_PreviewData = processedData;
    clss_PreviewMode = false; // 标记为已提交，不再是预览模式
    
    // 隐藏错误信息列（提交成功的数据不需要显示错误）
    $("#clss_table").bootstrapTable("hideColumn", "validation_errors");
    
    // 更新工具栏
    const insertCount = processedData.filter(d => d._action_type === 'insert').length;
    const updateCount = processedData.filter(d => d._action_type === 'update').length;
    
    let subtitleText = '';
    if (insertCount > 0 && updateCount > 0) {
        subtitleText = `成功新增 ${insertCount} 条，更新 ${updateCount} 条<span class="en-text">Successfully added ${insertCount}, updated ${updateCount}</span>`;
    } else if (insertCount > 0) {
        subtitleText = `成功新增 ${insertCount} 条数据<span class="en-text">Successfully added ${insertCount} records</span>`;
    } else if (updateCount > 0) {
        subtitleText = `成功更新 ${updateCount} 条数据<span class="en-text">Successfully updated ${updateCount} records</span>`;
    }
    
    $("#toolbar_title").html(
        '<span class="cn-text"><i class="bi bi-check-circle me-2"></i>提交成功</span><span class="en-text">Submit Success</span>'
    );
    $("#toolbar_subtitle")
        .html(subtitleText)
        .show();
    $("#execute_import_btn").hide();
    
    // 应用成功状态样式（可以使用不同的样式类）
    $("#clss_toolbar")
        .removeClass("toolbar-no-data toolbar-preview-data")
        .addClass("toolbar-success-data");
    
    // 隐藏错误摘要
    $("#error_summary").hide();
    
    // 加载数据到表格
    $("#clss_table").bootstrapTable("load", processedData);
}

// 检查重复的clss_id（仅修改模式）
function ClssCheckDuplicateClssIds(data) {
    const clssIdCount = {};
    const duplicateClssIds = new Set();
    
    data.forEach((clss, index) => {
        if (clss.clss_id && clss.clss_id > 0) {
            const clssId = clss.clss_id;
            if (!clssIdCount[clssId]) {
                clssIdCount[clssId] = [];
            }
            clssIdCount[clssId].push(index);
            
            if (clssIdCount[clssId].length > 1) {
                duplicateClssIds.add(clssId);
            }
        }
    });
    
    duplicateClssIds.forEach((clssId) => {
        const indices = clssIdCount[clssId];
        indices.forEach((index) => {
            if (!data[index].validation_errors) {
                data[index].validation_errors = [];
            }
            data[index].validation_errors.push(
                `班级ID "${escapeHtml(clssId)}" 重复，请修改为唯一值`
            );
        });
    });
}

// 显示错误和警告统计
function ClssShowErrorWarningSummary(errorRows, warningRows) {
    if (errorRows.length > 0 || warningRows.length > 0) {
        let alertClass = "alert-warning";
        let alertIcon = "bi-exclamation-triangle";
        let contentHtml = "";
        
        if (errorRows.length > 0) {
            alertClass = "alert-danger";
            alertIcon = "bi-exclamation-triangle-fill";
            contentHtml = `<i class="bi ${alertIcon} me-2"></i><span class="cn-text">发现 ${errorRows.length} 行数据有错误，请检查后执行导入。</span><span class="en-text">Found ${errorRows.length} rows with errors, please check before importing.</span>`;
            $("#execute_import_btn").prop("disabled", true).addClass("disabled");
        } else if (warningRows.length > 0) {
            contentHtml = `<i class="bi ${alertIcon} me-2"></i><span class="cn-text">发现 ${warningRows.length} 行数据有警告，请检查后执行导入。</span><span class="en-text">Found ${warningRows.length} rows with warnings, please check before importing.</span>`;
            $("#execute_import_btn").prop("disabled", false).removeClass("disabled");
        }
        
        $("#error_summary")
            .removeClass("alert-warning alert-danger")
            .addClass(alertClass)
            .html(contentHtml)
            .show();
    } else {
        $("#error_summary").hide();
        $("#execute_import_btn").prop("disabled", false).removeClass("disabled");
    }
}

// 执行导入
function ClssExecuteImport() {
    if (!clss_PreviewMode) return;
    
    // 过滤掉有错误的数据
    const validData = clss_PreviewData.filter(
        (clss) => clss.validation_errors.length === 0
    );
    
    if (validData.length === 0) {
        window.alerty.error("没有有效数据可导入 / No valid data to import");
        return;
    }
    
    // 显示确认对话框
    window.alerty.confirm({
        message: `确认导入 ${validData.length} 条班级数据？`,
        message_en: `Confirm importing ${validData.length} class records?`,
        callback: function () {
            ClssExecuteImportInternal(validData);
        },
    });
}

// 内部执行导入函数
function ClssExecuteImportInternal(validData) {
    // 转换为后端需要的格式
    // 使用页面加载时保存的 course_key，而不是当前会话的 course_key
    const pageCourseKey = window.CLSS_PAGE_COURSE_KEY || "";
    if (!pageCourseKey) {
        window.alerty.error("无法获取课程组信息，请刷新页面重试", "Unable to get course key, please refresh the page");
        return;
    }
    
    const clssList = validData.map((clss) => {
        const item = {
            clss_title: clss.clss_title,
            clss_year: clss.clss_year || "-1",
            clss_semester: clss.clss_semester,
            teachers: clss.teachers || "",
            course_key: pageCourseKey  // 使用页面打开时的 course_key
        };
        
        if (clss.clss_id) {
            item.clss_id = clss.clss_id;
        }
        
        return item;
    });
    
    // 提交数据
    $.ajax({
        url: $("#clss_add_form").attr("action"),
        type: "POST",
        data: {
            clss_list: JSON.stringify(clssList)
        },
        success: function (ret) {
            if (ret.code == 1) {
                window.alerty.success(ret.msg);
                
                // 将返回的数据显示在预览表格中
                if (ret.data && (ret.data.insert || ret.data.update)) {
                    const resultData = [];
                    
                    // 处理新增的数据
                    if (ret.data.insert && ret.data.insert.length > 0) {
                        ret.data.insert.forEach((clss, index) => {
                            resultData.push({
                                row_index: `result_insert_${index}`,
                                clss_id: clss.clss_id || null,
                                clss_title: clss.clss_title || '',
                                clss_year: clss.clss_year || '-1',
                                clss_semester: clss.clss_semester || '',
                                teachers: clss.teachers || ',',
                                validation_errors: [],
                                validation_warnings: [],
                                _is_result: true, // 标记为提交结果
                                _action_type: 'insert' // 标记为新增
                            });
                        });
                    }
                    
                    // 处理更新的数据
                    if (ret.data.update && ret.data.update.length > 0) {
                        ret.data.update.forEach((clss, index) => {
                            resultData.push({
                                row_index: `result_update_${index}`,
                                clss_id: clss.clss_id || null,
                                clss_title: clss.clss_title || '',
                                clss_year: clss.clss_year || '-1',
                                clss_semester: clss.clss_semester || '',
                                teachers: clss.teachers || ',',
                                validation_errors: [],
                                validation_warnings: [],
                                _is_result: true, // 标记为提交结果
                                _action_type: 'update' // 标记为更新
                            });
                        });
                    }
                    
                    // 显示返回的数据
                    if (resultData.length > 0) {
                        ClssShowResult(resultData);
                    } else {
                        // 如果没有返回数据，清空表单并重置
                        $("#clss_description").val("");
                        ClssInitPreviewMode();
                        $("#clss_table").bootstrapTable("load", []);
                    }
                } else {
                    // 如果没有返回数据，清空表单并重置
                    $("#clss_description").val("");
                    ClssInitPreviewMode();
                    $("#clss_table").bootstrapTable("load", []);
                }
            } else {
                window.alerty.error(ret.msg);
            }
        },
        error: function () {
            window.alerty.error("提交失败，请重试 / Submit failed, please try again");
        },
    });
}

// 格式化验证错误
function FormatterValidationErrors(value, row, index, field) {
    const errors = row.validation_errors || [];
    const warnings = row.validation_warnings || [];
    
    if (errors.length === 0 && warnings.length === 0) {
        return '<span class="text-success"><i class="bi bi-check-circle"></i></span>';
    }
    
    const errorCount = errors.length;
    const warningCount = warnings.length;
    
    let buttonClass = "btn btn-outline-success btn-sm";
    let iconClass = "bi-check-circle text-success";
    let title = "查看详情 / View Details";
    
    if (errorCount > 0) {
        buttonClass = "btn btn-outline-danger btn-sm";
        iconClass = "bi-exclamation-triangle-fill text-danger";
        title = "查看错误详情 / View Error Details";
    } else if (warningCount > 0) {
        buttonClass = "btn btn-outline-warning btn-sm";
        iconClass = "bi-exclamation-triangle text-warning";
        title = "查看警告详情 / View Warning Details";
    }
    
    const allMessages = [...errors, ...warnings];
    const messageString = allMessages.map((msg) => escapeHtml(msg)).join("|");
    
    return `<button class="${buttonClass}" onclick="ClssShowErrorDetail(${index}, '${escapeHtml(
        messageString
    )}', ${errorCount}, ${warningCount})" title="${escapeHtml(title)}">
                <i class="bi ${iconClass}"></i>
                ${
                    errorCount > 0
                        ? errorCount
                        : warningCount > 0
                        ? warningCount
                        : ""
                }
            </button>`;
}

// 显示错误详情
function ClssShowErrorDetail(rowIndex, messageString, errorCount, warningCount) {
    const messages = messageString.split("|");
    let detailHtml = '<div class="list-group">';
    
    let messageIndex = 0;
    
    // 显示错误信息
    for (let i = 0; i < errorCount; i++) {
        if (messages[messageIndex] && messages[messageIndex].trim()) {
            detailHtml += `
                <div class="list-group-item list-group-item-danger">
                    <div class="d-flex w-100 justify-content-between">
                        <h6 class="mb-1"><i class="bi bi-exclamation-triangle-fill me-1"></i>错误 ${
                            i + 1
                        }</h6>
                        <small class="text-muted">第 ${rowIndex + 1} 行</small>
                    </div>
                    <p class="mb-1">${escapeHtml(messages[messageIndex])}</p>
                </div>
            `;
        }
        messageIndex++;
    }
    
    // 显示警告信息
    for (let i = 0; i < warningCount; i++) {
        if (messages[messageIndex] && messages[messageIndex].trim()) {
            detailHtml += `
                <div class="list-group-item list-group-item-warning">
                    <div class="d-flex w-100 justify-content-between">
                        <h6 class="mb-1"><i class="bi bi-exclamation-triangle me-1"></i>警告 ${
                            i + 1
                        }</h6>
                        <small class="text-muted">第 ${rowIndex + 1} 行</small>
                    </div>
                    <p class="mb-1">${escapeHtml(messages[messageIndex])}</p>
                </div>
            `;
        }
        messageIndex++;
    }
    
    detailHtml += "</div>";
    
    $("#error_detail_content").html(detailHtml);
    $("#errorDetailModal").modal("show");
}

// HTML转义函数：使用全局 DomSantize（来自 global.js）
// 为了兼容性，保留 escapeHtml 作为 DomSantize 的别名
function escapeHtml(text) {
    return DomSantize(text);
}

// 下载模板（批量录入，无班级ID列）
async function ClssDownloadTemplateAdd() {
    try {
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet("班级信息");
        
        // 设置列定义（录入模板没有班级ID列）
        const clssHeaders = [
            { header: "班级名称", header_en: "Class Name", key: "clss_title", width: 30 },
            { header: "年级", header_en: "Year", key: "clss_year", width: 15 },
            { header: "学期", header_en: "Semester", key: "clss_semester", width: 20 },
            { header: "教师", header_en: "Teachers", key: "teachers", width: 30 },
            { header: "", header_en: "", key: "sample", width: 15 }, // 样例列，无表头
        ];
        
        worksheet.columns = clssHeaders.map((h) => ({
            key: h.key,
            width: h.width,
        }));
        
        // 添加中英双语表头
        const headerRow = worksheet.addRow(
            clssHeaders.map((h) => `${h.header}\n${h.header_en}`)
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
        
        // 添加样例数据
        const sampleData = [
            {
                clss_title: "2024级计算机1班",
                clss_year: "2024",
                clss_semester: "2024-2025-1",
                teachers: "20200000,20190000",
                sample: "样例/Example",
            },
            {
                clss_title: "2024级计算机2班",
                clss_year: "2024",
                clss_semester: "2024-2025-1",
                teachers: "20190000",
                sample: "样例/Example",
            },
        ];
        
        // 添加样例行
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
        
        // 写入文件
        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], {
            type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "班级录入模板.xlsx";
        a.click();
        URL.revokeObjectURL(url);
        
        window.alerty.success("模板下载成功 / Template downloaded successfully");
    } catch (error) {
        console.error("下载模板失败:", error);
        window.alerty.error("下载模板失败 / Template download failed");
    }
}

// 下载模板（批量修改，有班级ID列）
async function ClssDownloadTemplateModify() {
    try {
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet("班级信息");
        
        // 设置列定义（修改模板有班级ID列）
        const clssHeaders = [
            { header: "班级ID", header_en: "Class ID", key: "clss_id", width: 15 },
            { header: "班级名称", header_en: "Class Name", key: "clss_title", width: 30 },
            { header: "年级", header_en: "Year", key: "clss_year", width: 15 },
            { header: "学期", header_en: "Semester", key: "clss_semester", width: 20 },
            { header: "教师", header_en: "Teachers", key: "teachers", width: 30 },
            { header: "", header_en: "", key: "sample", width: 15 }, // 样例列，无表头
        ];
        
        worksheet.columns = clssHeaders.map((h) => ({
            key: h.key,
            width: h.width,
        }));
        
        // 添加中英双语表头
        const headerRow = worksheet.addRow(
            clssHeaders.map((h) => `${h.header}\n${h.header_en}`)
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
        
        // 添加样例数据
        const sampleData = [
            {
                clss_id: "1",
                clss_title: "2024级计算机1班",
                clss_year: "2024",
                clss_semester: "2024-2025-1",
                teachers: "teacher1,teacher2",
                sample: "样例/Example",
            },
            {
                clss_id: "2",
                clss_title: "2024级计算机2班",
                clss_year: "2024",
                clss_semester: "2024-2025-1",
                teachers: "teacher2",
                sample: "样例/Example",
            },
        ];
        
        // 添加样例行
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
        
        // 写入文件
        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], {
            type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "班级修改模板.xlsx";
        a.click();
        URL.revokeObjectURL(url);
        
        window.alerty.success("模板下载成功 / Template downloaded successfully");
    } catch (error) {
        console.error("下载模板失败:", error);
        window.alerty.error("下载模板失败 / Template download failed");
    }
}

// Excel导入
async function ClssImportExcel(file) {
    try {
        // 清理旧数据
        clss_PreviewData = [];
        clss_PreviewMode = false;
        
        const workbook = new ExcelJS.Workbook();
        const buffer = await file.arrayBuffer();
        await workbook.xlsx.load(buffer);
        
        const worksheet = workbook.getWorksheet(1);
        if (!worksheet) {
            throw new Error("Excel文件中没有找到工作表");
        }
        
        const clssData = [];
        let hasClssIdColumn = false; // 标记是否有班级ID列
        
        // 先检查第一行（表头）判断是否有班级ID列
        const firstRow = worksheet.getRow(1);
        if (firstRow) {
            const firstRowValues = firstRow.values;
            const firstRowText = firstRowValues.map(v => ClssExtractCellValue(v)).join(" ").toLowerCase();
            if (firstRowText.includes("班级id") || firstRowText.includes("class id") || firstRowText.includes("clss_id")) {
                hasClssIdColumn = true;
            }
        }
        
        worksheet.eachRow((row, rowNumber) => {
            try {
                const values = row.values;
                if (!values || values.length < 2) return;
                
                // 检查第一行是否为表头
                if (rowNumber === 1 && ClssIsHeaderRow(values)) {
                    return;
                }
                
                // 检查是否为样例行（最后一列包含"样例"或"Example"）
                const lastColumnValue = ClssExtractCellValue(values[values.length - 1]) || "";
                if (lastColumnValue.includes("样例") || lastColumnValue.includes("Example")) {
                    return; // 跳过样例行
                }
                
                // 根据是否有班级ID列来提取数据
                let clssInfo;
                if (hasClssIdColumn) {
                    // 有班级ID列：班级ID、班级名称、年级、学期、教师
                    clssInfo = {
                        row_index: `excel_${rowNumber}`,
                        clss_id: ClssExtractCellValue(values[1]) ? parseInt(ClssExtractCellValue(values[1])) : null,
                        clss_title: ClssExtractCellValue(values[2]) || "",
                        clss_year: ClssExtractCellValue(values[3]) || "-1",
                        clss_semester: ClssExtractCellValue(values[4]) || "",
                        teachers: ClssExtractCellValue(values[5]) || "",
                        validation_errors: [],
                    };
                } else {
                    // 无班级ID列：班级名称、年级、学期、教师
                    clssInfo = {
                        row_index: `excel_${rowNumber}`,
                        clss_id: null,
                        clss_title: ClssExtractCellValue(values[1]) || "",
                        clss_year: ClssExtractCellValue(values[2]) || "-1",
                        clss_semester: ClssExtractCellValue(values[3]) || "",
                        teachers: ClssExtractCellValue(values[4]) || "",
                        validation_errors: [],
                    };
                }
                
                // 验证数据
                const validationResult = ClssValidateClssData(clssInfo, rowNumber);
                clssInfo.validation_errors = validationResult.errors;
                clssInfo.validation_warnings = validationResult.warnings;
                
                clssData.push(clssInfo);
            } catch (rowError) {
                console.error(`解析Excel第${rowNumber}行数据时出错:`, rowError);
                clssData.push({
                    row_index: `excel_error_${rowNumber}`,
                    clss_id: null,
                    clss_title: `解析错误 (第${rowNumber}行)`,
                    clss_year: "-1",
                    clss_semester: "",
                    teachers: "",
                    validation_errors: [
                        `Excel数据格式错误: ${escapeHtml(rowError.message)}`,
                    ],
                    validation_warnings: [],
                });
            }
        });
        
        if (clssData.length === 0) {
            window.alerty.error("没有有效的班级数据 / No valid class data found");
            return;
        }
        
        // 显示预览
        ClssShowPreview(clssData);
    } catch (error) {
        console.error("导入Excel失败:", error);
        window.alerty.error("导入Excel失败: " + error.message);
    }
}

// 提取单元格原始值
function ClssExtractCellValue(cellValue) {
    if (cellValue === null || cellValue === undefined) return "";
    
    if (typeof cellValue === "object") {
        if (cellValue.richText) {
            return cellValue.richText.map((part) => part.text || "").join("");
        }
        if (cellValue.text) {
            return cellValue.text;
        }
        if (cellValue.value !== undefined) {
            return cellValue.value;
        }
    }
    
    return String(cellValue || "");
}

// 绑定所有事件（业务逻辑函数，由view调用）
function ClssBindAllEvents() {
    // 解析数据按钮
    $("#parse_data_btn").on("click", function () {
        ClssParseTextData();
    });
    
    // 下载录入模板按钮
    $("#download_template_add_btn").on("click", function () {
        ClssDownloadTemplateAdd();
    });
    
    // 下载修改模板按钮
    $("#download_template_modify_btn").on("click", function () {
        ClssDownloadTemplateModify();
    });
    
    // Excel文件选择按钮
    $("#excel_file_btn").on("click", function () {
        $("#excel_file_input").click();
    });
    
    // Excel文件选择事件
    $("#excel_file_input").on("change", function () {
        const file = this.files[0];
        if (file) {
            ClssImportExcel(file);
            $(this).val("");
        }
    });
    
    // 执行导入按钮事件
    $("#execute_import_btn").on("click", function () {
        ClssExecuteImport();
    });
}

// 打开修改Modal（从列表页调用）
function ClssOpenModifyModal(clss_id) {
    // 从表格获取当前行数据
    const tableData = $("#clss_list_table").bootstrapTable("getData");
    const clss = tableData.find(row => row.clss_id == clss_id);
    
    if (!clss) {
        window.alerty.error("无法获取班级信息", "Unable to get class information");
        return;
    }
    
    // 填充表单
    $("#clss_modify_clss_id").val(clss.clss_id);
    $("#clss_modify_title").val(clss.clss_title || "");
    $("#clss_modify_year").val(clss.clss_year || "-1");
    $("#clss_modify_semester").val(clss.clss_semester || "");
    
    // 处理教师列表
    let teachers_str = "";
    if (clss.teachers && Array.isArray(clss.teachers) && clss.teachers.length > 0) {
        teachers_str = clss.teachers.map(t => t.user_id || t).join(",");
    } else if (clss.teachers && typeof clss.teachers === 'string') {
        teachers_str = clss.teachers.replace(/^,|,$/g, '');
    }
    $("#clss_modify_teachers").val(teachers_str);
    
    // 更新header
    $("#clss_modify_header_clss_id").html(
        `<i class="bi bi-hash"></i> ${escapeHtml(clss.clss_id)}`
    );
    
    // 显示Modal
    const modalElement = document.getElementById("clssModifyModal");
    if (modalElement) {
        const modal = new bootstrap.Modal(modalElement);
        modal.show();
    } else {
        window.alerty.error("修改功能不可用", "Modify function is not available");
    }
}

// 删除班级
function ClssDelete(clss_id) {
    window.alerty.confirm({
        message: `确定要删除班级ID为 ${clss_id} 的班级吗？`,
        message_en: `Are you sure to delete class with ID ${clss_id}?`,
        callback: function() {
            $.post(`/${page_module}/${page_controller}/clss_del_ajax`, {
                'clss_id': clss_id
            }, function(ret) {
                if(ret.code == 1) {
                    window.alerty.success(ret.msg);
                    $('#clss_list_table').bootstrapTable('refresh');
                } else {
                    window.alerty.error(ret.msg);
                }
            });
        }
    });
}

// 导出批量修改模板（基于选中的班级数据）
async function ClssExportBatchModifyTemplate(selectedRows) {
    try {
        // 使用传入的选中数据，如果没有传入则获取所有选中数据
        const allData = selectedRows || $('#clss_list_table').bootstrapTable('getSelections');
        
        if (!allData || allData.length === 0) {
            window.alerty.warn('请先选择要导出的班级', 'Please select classes to export');
            return;
        }
        
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet("班级信息");
        
        // 设置列定义（修改模板有班级ID列）
        const clssHeaders = [
            { header: "班级ID", header_en: "Class ID", key: "clss_id", width: 15 },
            { header: "班级名称", header_en: "Class Name", key: "clss_title", width: 30 },
            { header: "年级", header_en: "Year", key: "clss_year", width: 15 },
            { header: "学期", header_en: "Semester", key: "clss_semester", width: 20 },
            { header: "教师", header_en: "Teachers", key: "teachers", width: 30 },
        ];
        
        worksheet.columns = clssHeaders.map((h) => ({
            key: h.key,
            width: h.width,
        }));
        
        // 添加中英双语表头
        const headerRow = worksheet.addRow(
            clssHeaders.map((h) => `${h.header}\n${h.header_en}`)
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
        
        // 添加数据行
        allData.forEach((clss) => {
            // 处理教师数据：如果是数组，转换为逗号分隔的字符串
            let teachersStr = '';
            if (Array.isArray(clss.teachers)) {
                teachersStr = clss.teachers.map(t => t.user_id || t).join(',');
            } else if (typeof clss.teachers === 'string') {
                teachersStr = clss.teachers.trim().replace(/^,|,$/g, '');
            }
            
            const rowData = {
                clss_id: clss.clss_id || '',
                clss_title: clss.clss_title || '',
                clss_year: clss.clss_year || '-1',
                clss_semester: clss.clss_semester || '',
                teachers: teachersStr,
            };
            
            const excelRow = worksheet.addRow(rowData);
            excelRow.eachCell((cell, colNumber) => {
                cell.border = {
                    top: { style: "thin" },
                    left: { style: "thin" },
                    bottom: { style: "thin" },
                    right: { style: "thin" },
                };
            });
        });
        
        // 写入文件
        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], {
            type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        a.download = `班级批量修改模板_${timestamp}.xlsx`;
        a.click();
        URL.revokeObjectURL(url);
        
        window.alerty.success("导出成功 / Export successful");
    } catch (error) {
        console.error("导出失败:", error);
        window.alerty.error("导出失败 / Export failed", error.message || "Unknown error");
    }
}

// 批量删除班级
async function ClssBatchDelete(selectedRows) {
    if (!selectedRows || selectedRows.length === 0) {
        window.alerty.warn('请先选择要删除的班级', 'Please select classes to delete');
        return;
    }
    
    // 获取班级信息（用于显示）
    const clssList = selectedRows.map(row => ({
        id: row.clss_id,
        title: row.clss_title || `班级ID ${row.clss_id}`
    })).filter(item => item.id);
    
    if (clssList.length === 0) {
        window.alerty.warn('选中的班级没有有效的ID', 'Selected classes have no valid ID');
        return;
    }
    
    window.alerty.confirm({
        message: `确定要删除选中的 ${clssList.length} 个班级吗？此操作不可恢复。`,
        message_en: `Are you sure to delete ${clssList.length} selected classes? This operation cannot be undone.`,
        callback: async function() {
            // 显示 overlay 进度条
            showOverlay({
                message: `正在删除班级... (0/${clssList.length})`,
                message_en: `Deleting classes... (0/${clssList.length})`,
                type: 'text'
            });
            
            // 构建任务列表
            const tasks = clssList.map(clss => ({
                id: clss.id,
                title: clss.title,
                requestFn: async () => {
                    try {
                        const ret = await csg.post(`/${page_module}/${page_controller}/clss_del_ajax`, {
                            'clss_id': clss.id
                        });
                        // ThinkPHP 返回格式：{code: 1, msg: "ok"} 或 {code: 0, msg: "error"}
                        if (ret && ret.code === 1) {
                            return ret;
                        } else {
                            // 构造错误对象
                            const error = {
                                code: ret ? ret.code : 0,
                                msg: ret ? ret.msg : '请求失败',
                                message: ret ? ret.msg : '请求失败'
                            };
                            throw error;
                        }
                    } catch (error) {
                        // 如果是网络错误或其他异常，构造统一的错误格式
                        if (!error || !error.code) {
                            throw {
                                code: 0,
                                msg: error && error.message ? error.message : '网络错误或服务器异常',
                                message: error && error.message ? error.message : '网络错误或服务器异常'
                            };
                        }
                        throw error;
                    }
                }
            }));
            
            // 执行批量请求
            const batchResult = await csg.batchRequest(tasks, {
                concurrency: 5, // 并发数
                onProgress: (completed, total, currentTask) => {
                    const progress = Math.round((completed / total) * 100);
                    updateOverlay({
                        message: `正在删除班级... (${completed}/${total})`,
                        message_en: `Deleting classes... (${completed}/${total})`,
                        type: 'text'
                    }, progress);
                }
            });
            
            hideOverlay();
            
            // 如果全部失败，不刷新表格
            if (batchResult.summary.failCount === batchResult.summary.total) {
                // 全部失败，只显示错误信息
                ClssShowBatchDeleteResult(batchResult, clssList);
            } else {
                // 有成功的情况，刷新表格
                $('#clss_list_table').bootstrapTable('refresh');
                
                // 如果有失败，显示结果；如果全部成功，显示成功提示
                if (batchResult.summary.failCount > 0) {
                    ClssShowBatchDeleteResult(batchResult, clssList);
                } else {
                    window.alerty.success(
                        `成功删除 ${batchResult.summary.successCount} 个班级`,
                        `Successfully deleted ${batchResult.summary.successCount} classes`
                    );
                }
            }
        }
    });
}

// 显示批量删除结果汇总
function ClssShowBatchDeleteResult(batchResult, clssList) {
    const { summary, results, errors } = batchResult;
    
    // 解析错误信息，提取结构化数据
    const parseError = (errorMsg) => {
        const errorInfo = {
            privilegeItem: null,
            contest: null,
            other: errorMsg
        };
        
        // 解析教师/学生关联信息（新格式：存在 X 个关联的教师或学生）
        const privilegeMatch = errorMsg.match(/存在 (\d+) 个关联的(教师或学生|教师|学生)/);
        if (privilegeMatch) {
            errorInfo.privilegeItem = {
                count: parseInt(privilegeMatch[1]),
                type: privilegeMatch[2] || '教师或学生'
            };
        }
        
        // 解析练习/考试关联信息（新格式：存在 X 个关联的练习或考试）
        const contestMatch = errorMsg.match(/存在 (\d+) 个关联的(练习或考试|练习|考试)/);
        if (contestMatch) {
            errorInfo.contest = {
                count: parseInt(contestMatch[1]),
                type: contestMatch[2] || '练习或考试'
            };
        }
        
        // 如果解析到了结构化数据，更新 other
        if (errorInfo.privilegeItem || errorInfo.contest) {
            errorInfo.other = null;
        }
        
        return errorInfo;
    };
    
    // 构建结果信息
    let html = '<div class="batch-delete-result">';
    
    // 统计卡片
    html += '<div class="result-summary mb-4">';
    html += '<div class="row g-3">';
    html += '<div class="col-md-4">';
    html += '<div class="card border-primary h-100">';
    html += '<div class="card-body text-center py-3">';
    html += '<h6 class="card-title text-primary mb-2 small fw-normal">';
    html += '<span class="cn-text">总计</span>';
    html += '<span class="en-text">Total</span>';
    html += '</h6>';
    html += `<h2 class="mb-0 fw-bold">${summary.total}</h2>`;
    html += '</div></div></div>';
    
    html += '<div class="col-md-4">';
    html += '<div class="card border-success h-100">';
    html += '<div class="card-body text-center py-3">';
    html += '<h6 class="card-title text-success mb-2 small fw-normal">';
    html += '<span class="cn-text">成功</span>';
    html += '<span class="en-text">Success</span>';
    html += '</h6>';
    html += `<h2 class="mb-0 fw-bold">${summary.successCount}</h2>`;
    html += '</div></div></div>';
    
    html += '<div class="col-md-4">';
    html += '<div class="card border-danger h-100">';
    html += '<div class="card-body text-center py-3">';
    html += '<h6 class="card-title text-danger mb-2 small fw-normal">';
    html += '<span class="cn-text">失败</span>';
    html += '<span class="en-text">Failed</span>';
    html += '</h6>';
    html += `<h2 class="mb-0 fw-bold">${summary.failCount}</h2>`;
    html += '</div></div></div>';
    html += '</div></div>';
    
    // 如果有失败，显示失败详情
    if (errors.length > 0) {
        html += '<div class="failure-details">';
        html += '<h6 class="text-danger mb-3 d-flex align-items-center">';
        html += '<i class="bi bi-exclamation-triangle-fill me-2"></i>';
        html += '<span class="cn-text">失败详情</span>';
        html += '<span class="en-text">Failure Details</span>';
        html += '</h6>';
        html += '<table class="table table-sm table-hover align-middle batch-delete-table">';
        html += '<thead class="table-light">';
        html += '<tr>';
        html += '<th style="width: 80px;">';
        html += '<div class="th-bilingual"><span class="cn-text">班级ID</span><span class="en-text">Class ID</span></div>';
        html += '</th>';
        html += '<th style="min-width: 120px;">';
        html += '<div class="th-bilingual"><span class="cn-text">班级名称</span><span class="en-text">Class Name</span></div>';
        html += '</th>';
        html += '<th>';
        html += '<div class="th-bilingual"><span class="cn-text">失败原因</span><span class="en-text">Error Message</span></div>';
        html += '</th>';
        html += '</tr>';
        html += '</thead>';
        html += '<tbody>';
        
        errors.forEach(err => {
            const clssInfo = clssList.find(c => c.id === err.id);
            const clssTitle = clssInfo ? clssInfo.title : `ID ${err.id}`;
            const errorInfo = parseError(err.message);
            
            html += '<tr>';
            html += `<td><code>${err.id}</code></td>`;
            html += `<td class="fw-medium">${escapeHtml(clssTitle)}</td>`;
            html += '<td class="text-danger">';
            
            // 如果有结构化错误信息，使用更好的展示方式
            if (errorInfo.privilegeItem || errorInfo.contest) {
                html += '<div class="error-detail-list">';
                
                if (errorInfo.privilegeItem) {
                    html += '<div class="error-detail-item mb-2">';
                    html += '<i class="bi bi-people-fill text-warning me-2"></i>';
                    html += '<div class="error-detail-content">';
                    html += '<div class="cn-text">';
                    html += `存在 <strong class="text-danger">${errorInfo.privilegeItem.count}</strong> 个关联的${errorInfo.privilegeItem.type}`;
                    html += '</div>';
                    html += '<div class="en-text">';
                    const enType = errorInfo.privilegeItem.type === '教师或学生' ? 'teachers or students' : 
                                  errorInfo.privilegeItem.type === '教师' ? 'teachers' : 'students';
                    html += `Has <strong class="text-danger">${errorInfo.privilegeItem.count}</strong> related ${enType}`;
                    html += '</div>';
                    html += '</div>';
                    html += '</div>';
                }
                
                if (errorInfo.contest) {
                    html += '<div class="error-detail-item">';
                    html += '<i class="bi bi-trophy-fill text-info me-2"></i>';
                    html += '<div class="error-detail-content">';
                    html += '<div class="cn-text">';
                    html += `存在 <strong class="text-danger">${errorInfo.contest.count}</strong> 个关联的${errorInfo.contest.type}`;
                    html += '</div>';
                    html += '<div class="en-text">';
                    const enType = errorInfo.contest.type === '练习或考试' ? 'contests or exams' : 
                                  errorInfo.contest.type === '练习' ? 'contests' : 'exams';
                    html += `Has <strong class="text-danger">${errorInfo.contest.count}</strong> related ${enType}`;
                    html += '</div>';
                    html += '</div>';
                    html += '</div>';
                }
                
                html += '</div>';
            } else {
                // 普通错误信息
                html += `<div class="error-message">${escapeHtml(err.message)}</div>`;
            }
            
            html += '</td>';
            html += '</tr>';
        });
        
        html += '</tbody>';
        html += '</table>';
        html += '</div>';
    }
    
    // 如果有成功，显示成功列表
    if (results.length > 0 && results.length <= 10) {
        html += '<div class="success-details mt-4">';
        html += '<h6 class="text-success mb-3 d-flex align-items-center">';
        html += '<i class="bi bi-check-circle-fill me-2"></i>';
        html += '<span class="cn-text">成功删除的班级</span>';
        html += '<span class="en-text">Successfully Deleted Classes</span>';
        html += '</h6>';
        html += '<div class="list-group">';
        
        results.forEach(result => {
            const clssInfo = clssList.find(c => c.id === result.id);
            const clssTitle = clssInfo ? clssInfo.title : `ID ${result.id}`;
            html += '<div class="list-group-item list-group-item-success d-flex align-items-center">';
            html += '<i class="bi bi-check-circle me-2"></i>';
            html += `<strong>${escapeHtml(clssTitle)}</strong>`;
            html += `<small class="text-muted ms-2">(ID: ${result.id})</small>`;
            html += '</div>';
        });
        
        html += '</div>';
        html += '</div>';
    }
    
    html += '</div>';
    
    // 使用 alerty.modal 显示结果
    window.alerty.modal({
        title: '<span class="cn-text">批量删除结果</span><span class="en-text">Batch Delete Results</span>',
        message: html,
        width: 'xl'
    });
    
    // 监听模态框显示事件，添加特定类名以便CSS定位
    $(document).one('shown.bs.modal', function(e) {
        const modalElement = e.target;
        if (modalElement && modalElement.querySelector('.batch-delete-result')) {
            modalElement.classList.add('batch-delete-modal');
        }
    });
}
