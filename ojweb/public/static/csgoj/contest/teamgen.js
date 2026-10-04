// 队伍生成器 JavaScript 逻辑
let teamgen_regionList = [];
let teamgen_regionMap = {
  byCode: {}, // 英文缩写 -> 地区对象
  byName: {}, // 中文简称 -> 地区对象
};
let teamgen_currentTeamData = [];
let teamgen_PreviewData = []; // 预览数据
let teamgen_PreviewMode = false; // 是否为预览模式

// 工作人员生成器初始化
function StaffgenInit() {
  // 加载密码种子到输入框
  loadPasswordSeed();

  // 初始化页面状态 - 显示实际数据
  teamgen_PreviewMode = false;

  // 设置初始工具栏状态
  $("#toolbar_title").html(
    '<span class="cn-text"><i class="bi bi-database me-2"></i>实际数据</span><span class="en-text">Actual Data</span>'
  );
  $("#toolbar_subtitle").hide();
  $("#preview_import_tip").hide();
  $("#execute_import_btn").hide();
  $("#error_summary").hide();

  // 显示导出按钮（初始状态是实际数据模式）
  $("#export_teamgen_pageteam_group").show();
  $("#export_standard_btn").show();

  // 应用实际数据样式
  $("#teamgen_toolbar")
    .removeClass("toolbar-preview-data")
    .addClass("toolbar-actual-data");

  // 手动加载数据
  TeamgenLoadServerData();

  // 绑定所有事件
  BindTableEvents({
    tableSelector: "#teamgen_table",
    deleteInfoedGetter: () => teamgen_delete_infoed,
    previewModeGetter: () => teamgen_PreviewMode,
    deleteFromPreviewFunc: TeamgenDeleteFromPreview,
    deleteFromServerFunc: TeamgenDeleteFromServer,
    deleteInfoedSetter: (value) => {
      teamgen_delete_infoed = value;
    },
  });
  StaffgenBindAllEvents();
  StaffgenInitModifyModal();
}

// 初始化
function TeamgenInit() {
  // 加载地区映射数据
  loadRegionMapping();

  // 加载密码种子到输入框
  loadPasswordSeed();

  // 初始化页面状态 - 显示实际数据
  teamgen_PreviewMode = false;

  // 设置初始工具栏状态
  $("#toolbar_title").html(
    '<span class="cn-text"><i class="bi bi-database me-2"></i>实际数据</span><span class="en-text">Actual Data</span>'
  );
  $("#toolbar_subtitle").hide();
  $("#preview_import_tip").hide();
  $("#execute_import_btn").hide();
  $("#error_summary").hide();

  // 显示导出按钮（初始状态是实际数据模式）
  $("#export_teamgen_pageteam_group").show();
  $("#export_standard_btn").show();

  // 应用实际数据样式
  $("#teamgen_toolbar")
    .removeClass("toolbar-preview-data")
    .addClass("toolbar-actual-data");

  // 手动加载数据
  TeamgenLoadServerData();

  // 绑定所有事件
  BindTableEvents({
    tableSelector: "#teamgen_table",
    deleteInfoedGetter: () => teamgen_delete_infoed,
    previewModeGetter: () => teamgen_PreviewMode,
    deleteFromPreviewFunc: TeamgenDeleteFromPreview,
    deleteFromServerFunc: TeamgenDeleteFromServer,
    deleteInfoedSetter: (value) => {
      teamgen_delete_infoed = value;
    },
  });
  TeamgenBindAllEvents();

  // 初始化修改 Modal 事件
  TeamgenInitModifyModal();
}

// 手动加载服务器数据
function TeamgenLoadServerData() {
  const ttype = window.TEAMGEN_CONFIG?.ttype || "0";
  const cid = window.TEAMGEN_CONFIG?.contest_id || "unknown";

  $.ajax({
    url: TEAMGEN_CONFIG.teamgen_data_url,
    type: "GET",
    success: function (data) {
      // 为每行数据添加 row_index
      if (data && Array.isArray(data)) {
        data.forEach((row, index) => {
          if (!row.row_index) {
            row.row_index = `server_${index}`;
          }
        });
      }

      // 加载数据到表格
      $("#teamgen_table").bootstrapTable("load", data);
    },
    error: function () {
      console.error("加载服务器数据失败");
      window.alerty.error("加载数据失败，请刷新页面重试");
    },
  });
}

// 加载地区映射数据
async function loadRegionMapping() {
  try {
    const response = await fetch(
      "/static/image/region_flag/region_mapping.json"
    );
    if (response.ok) {
      teamgen_regionList = await response.json();

      // 构建地区映射字典
      teamgen_regionMap.byCode = {};
      teamgen_regionMap.byName = {};

      teamgen_regionList.forEach((region) => {
        const code = region["英文缩写"];
        const name = region["中文简称"];

        // 英文缩写映射
        if (code) {
          teamgen_regionMap.byCode[code] = region;
        }

        // 中文简称映射
        if (name) {
          teamgen_regionMap.byName[name] = region;
        }
      });
    }
  } catch (error) {
    console.warn("无法加载地区映射数据，将使用普通输入框", error);
  }
}

// 加载密码种子到输入框
function loadPasswordSeed() {
  let contestId = "unknown";
  if (
    typeof TEAMGEN_CONFIG !== "undefined" &&
    TEAMGEN_CONFIG != null &&
    TEAMGEN_CONFIG.contest_id != null &&
    String(TEAMGEN_CONFIG.contest_id).trim() !== ""
  ) {
    contestId = String(TEAMGEN_CONFIG.contest_id).trim();
  } else if (
    typeof window !== "undefined" &&
    window.TEAMGEN_CONFIG != null &&
    window.TEAMGEN_CONFIG.contest_id != null &&
    String(window.TEAMGEN_CONFIG.contest_id).trim() !== ""
  ) {
    contestId = String(window.TEAMGEN_CONFIG.contest_id).trim();
  }
  const seedKey = `con_pass_seed_${contestId}`;

  const cachedSeed = csg.store(seedKey);
  const $seed = $("#password_seed");
  if (!$seed.length) {
    return;
  }

  // 刷新页从 store 回填（勿用 if(cachedSeed)：数值 0 为合法种子）
  if (
    cachedSeed !== null &&
    cachedSeed !== undefined &&
    !(typeof cachedSeed === "string" && cachedSeed.trim() === "")
  ) {
    const n =
      typeof cachedSeed === "number"
        ? cachedSeed
        : parseInt(String(cachedSeed).trim(), 10);
    $seed.val(Number.isNaN(n) ? cachedSeed : n);
  }

  // 监听密码种子输入框变化，实时保存到 store；留空则删除缓存（否则下次进页会从 localStorage 回填旧种子）
  $seed
    .off("input.teamgenPassSeed change.teamgenPassSeed")
    .on("input.teamgenPassSeed change.teamgenPassSeed", function () {
      const raw = $(this).val();
      const trimmed = typeof raw === "string" ? raw.trim() : raw;
      if (trimmed === "" || trimmed === null || trimmed === undefined) {
        csg.DelStore(seedKey);
        return;
      }
      const seed = parseInt(trimmed, 10);
      if (!isNaN(seed)) {
        csg.store(seedKey, seed, 30 * 24 * 60 * 60 * 1000);
      }
    });
}

// 解析工作人员文本数据
function StaffgenParseTextData() {
  const staffDescription = $("#team_description").val().trim();

  if (!staffDescription) {
    window.alerty.error("请输入工作人员描述 / Please enter staff description");
    return;
  }

  // 清理旧数据，避免干扰
  teamgen_PreviewData = [];
  teamgen_PreviewMode = false;

  // 解析数据（包含验证）
  const parsedData = StaffgenParseTextDataInternal(staffDescription);

  // 显示预览表（无论是否有错误）
  TeamgenShowPreview(parsedData, "text", $("#reset_team").is(":checked"));
}

// 解析工作人员文本数据内部函数
function StaffgenParseTextDataInternal(staffDescription) {
  try {
    const staffList = staffDescription.split("\n");
    const parsedData = [];

    for (let i = 0; i < staffList.length; i++) {
      try {
        const line = staffList[i] || "";
        if (line.trim() === "") continue;
        const elements = line.split(/\t/).map((elem) => {
          if (typeof elem === "string") {
            return elem.trim();
          }
          return String(elem || "").trim();
        });

        // 检查第一行是否为表头
        if (i === 0 && StaffgenIsHeaderRow(elements)) {
          continue; // 跳过表头行
        }

        // 检查是否为样例行（最后一列包含"样例"或"Example"）
        const lastColumnValue = elements[elements.length - 1] || "";
        if (
          lastColumnValue.includes("样例") ||
          lastColumnValue.includes("Example")
        ) {
          continue; // 跳过样例行
        }

        const staff = {
          row_index: `staff_text_${i}`, // 添加唯一索引
          team_id: elements[0]?.trim() || "",
          name: elements[1]?.trim() || "",
          room: elements[2]?.trim() || "",
          privilege: elements[3]?.trim() || "",
          password: elements[4]?.trim() || "",
          groups: TeamgenIsMultiGroup()
            ? TeamgenNormalizeGroupsInputValue(elements[5])
            : "",
          validation_errors: [],
        };

        // 处理密码（在staff初始化后）
        if (!staff.password || staff.password === "") {
          staff._password_auto_generated = true;
          staff.password = StaffgenGeneratePassword(staff.team_id);
        } else {
          staff._password_auto_generated = false;
        }

        // 验证数据
        const validationResult = StaffgenValidateStaffData(staff, i + 1);
        staff.validation_errors = validationResult.errors;
        staff.validation_warnings = validationResult.warnings;

        parsedData.push(staff);
      } catch (lineError) {
        console.error(`解析第${i + 1}行数据时出错:`, lineError);
        // 添加错误行到结果中
        parsedData.push({
          row_index: `staff_text_error_${i}`,
          team_id: "",
          name: `解析错误 (第${i + 1}行)`,
          room: "",
          privilege: "",
          password: "",
          groups: "",
          validation_errors: [`数据格式错误: ${escapeHtml(lineError.message)}`],
          validation_warnings: [],
        });
      }
    }

    return parsedData;
  } catch (error) {
    console.error("解析工作人员文本数据时出错:", error);
    alerty.error("解析数据失败", `数据格式错误: ${escapeHtml(error.message)}`);
    return [];
  }
}

// 解析文本数据
function TeamgenParseTextData() {
  const teamDescription = $("#team_description").val().trim();

  if (!teamDescription) {
    window.alerty.error("请输入队伍描述 / Please enter team description");
    return;
  }

  // 清理旧数据，避免干扰
  teamgen_PreviewData = [];
  teamgen_PreviewMode = false;

  // 解析数据（包含验证）
  const parsedData = TeamgenParseTextDataInternal(teamDescription);

  // 显示预览表（无论是否有错误）
  TeamgenShowPreview(parsedData, "text", $("#reset_team").is(":checked"));
}

// 验证文本数据
function TeamgenValidateTextData(teamDescription) {
  const errors = [];
  const teamList = teamDescription.split("\n");

  for (let i = 0; i < teamList.length; i++) {
    const line = teamList[i].trim();
    if (line === "") continue;

    const elements = line.split("\t");
    const teamId = elements[0]?.trim() || "";

    // 验证队伍ID
    if (teamId && !/^[a-zA-Z0-9]+$/.test(teamId)) {
      errors.push(`第${i + 1}行: 队伍ID只能包含数字和字母`);
    }

    // 验证队名长度
    const teamName = elements[1]?.trim() || "";
    if (teamName && teamName.length > 100) {
      errors.push(`第${i + 1}行: 队名过长（最多100字符）`);
    }

    // 验证英文队名长度
    const teamNameEn = elements[2]?.trim() || "";
    if (teamNameEn && teamNameEn.length > 120) {
      errors.push(`第${i + 1}行: 英文队名过长（最多120字符）`);
    }

    // 验证队伍类型
    const tkind = elements[8]?.trim() || "0";
    if (tkind && !["0", "1", "2"].includes(tkind)) {
      errors.push(`第${i + 1}行: 队伍类型必须是0、1或2`);
    }
  }

  return {
    valid: errors.length === 0,
    errors: errors,
  };
}

// 下载模板
async function TeamgenDownloadTemplate() {
  try {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("队伍信息");

    // 设置列定义（不设置header，避免重复表头）
    const templateHeaders = TeamgenVisibleHeaders(TEAMGEN_HEADERS);
    worksheet.columns = templateHeaders.map((h) => ({
      key: h.key,
      width: h.width,
    }));

    // 添加中英双语表头（样例列使用空字符串）
    const headerRow = worksheet.addRow(
      templateHeaders.map((h) =>
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
        team_id: "001",
        name: "XX大学一队",
        name_en: "XX University Team 1",
        school: "XX大学",
        region: "中国",
        tmember: "队员一、队员二、队员三",
        coach: "教练名",
        room: "",
        tkind: "0",
        password: "",
        groups: "provincial，national",
        sample: "样例/Example",
      },
      {
        team_id: "team002",
        name: "XX大学二队",
        name_en: "",
        school: "XX大学",
        region: "",
        tmember: "队员A, 队员B",
        coach: "",
        room: "",
        tkind: "女队",
        password: "password123",
        groups: "provincial",
        sample: "样例/Example",
      },
      {
        team_id: "T01",
        name: "打星队伍",
        name_en: "Star Team",
        school: "某学院",
        region: "日本",
        tmember: "",
        coach: "指导老师",
        room: "线上",
        tkind: "Star",
        password: "",
        groups: "national",
        sample: "样例/Example",
      },
      {
        team_id: "123",
        name: "纯数字ID队伍",
        name_en: "Numeric ID Team",
        school: "测试学院",
        region: "韩国",
        tmember: "成员1",
        coach: "",
        room: "实验室",
        tkind: "0",
        password: "",
        groups: "",
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

    const dataValFirstRow = 2; // 第1行为表头；自第2行起（含样例行）提供下拉，与 account_gen 一致
    const dataValLastRow = 1000;
    const regionCol = TeamgenExcelColLetter(
      TeamgenExcelColumnIndexByKey(templateHeaders, "region")
    );
    const tkindCol = TeamgenExcelColLetter(
      TeamgenExcelColumnIndexByKey(templateHeaders, "tkind")
    );

    // 地区下拉：子表 A 列为导入用中文简称，B 列为说明
    if (teamgen_regionList.length > 0 && regionCol) {
      const regionSheet = workbook.addWorksheet("地区列表");
      regionSheet.columns = [{ width: 14 }, { width: 36 }];
      regionSheet.addRow(["地区（填本列）", "说明 / Description"]);
      teamgen_regionList.forEach((region) => {
        const code = String(region["中文简称"] ?? "").trim();
        const cn = String(region["中文名"] ?? "").trim();
        const ens = String(region["英文简称"] ?? region["英文名"] ?? "").trim();
        const desc = [cn && cn !== code ? cn : "", ens].filter(Boolean).join(" · ");
        regionSheet.addRow([code, desc || code]);
      });
      TeamgenApplyListColumnValidation(
        worksheet,
        regionCol,
        dataValFirstRow,
        dataValLastRow,
        `'地区列表'!$A$2:$A$${teamgen_regionList.length + 1}`,
        "无效地区",
        "请从下拉列表中选择一个地区（或手填与「地区列表」A 列一致的简称）"
      );
    }

    // 队伍类型：A 列仅 0/1/2 供下拉（避免用户以为必须整串「0 / 正式 / Regular」）；B 列为中英说明
    const tkindSheet = workbook.addWorksheet("队伍类型");
    tkindSheet.columns = [{ width: 6 }, { width: 36 }];
    tkindSheet.addRow(["类型（填本列）", "说明 / Description"]);
    tkindSheet.addRow(["0", "正式 · Regular"]);
    tkindSheet.addRow(["1", "女队 · Girls"]);
    tkindSheet.addRow(["2", "打星 · Star"]);
    if (tkindCol) {
      TeamgenApplyListColumnValidation(
        worksheet,
        tkindCol,
        dataValFirstRow,
        dataValLastRow,
        `'队伍类型'!$A$2:$A$4`,
        "无效队伍类型",
        "请从列表选择 0、1 或 2（也可手填 0–2 或「正式」「女队」等关键词）"
      );
    }

    // 多分组时：赛事归属候选子表（无下拉，主表可填多个 id，用英文或中文逗号分隔）
    const groupRowsForSheet = TeamgenContestGroupsForTemplate().filter(
      (g) => TeamgenContestGroupCatalogId(g) !== ""
    );
    if (TeamgenIsMultiGroup() && groupRowsForSheet.length > 0) {
      const groupSheet = workbook.addWorksheet("赛事归属");
      groupSheet.columns = [{ width: 16 }, { width: 36 }];
      groupSheet.addRow(["group_id（填本列）", "说明 / Description"]);
      groupRowsForSheet.forEach((g) => {
        const id = TeamgenContestGroupCatalogId(g);
        const nm = TeamgenContestGroupCatalogName(g);
        const en = String(g.group_name_en ?? "").trim();
        const desc = [nm && nm !== id ? nm : "", en].filter(Boolean).join(" · ");
        groupSheet.addRow([id, desc || nm || id]);
      });
    }

    // 写入文件
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "队伍信息模板.xlsx";
    a.click();
    URL.revokeObjectURL(url);

    window.alerty.success("模板下载成功 / Template downloaded successfully");
  } catch (error) {
    console.error("下载模板失败:", error);
    window.alerty.error("下载模板失败 / Template download failed");
  }
}

// 导出标准数据
function TeamgenExportStandard() {
  try {
    const teamData = $("#teamgen_table").bootstrapTable("getData", {
      includeHiddenRows: true,
    });
    if (!teamData || teamData.length === 0) {
      window.alerty.error("没有数据可导出 / No data to export");
      return;
    }

    TeamgenExportToExcel(teamData, "标准队伍数据");

    window.alerty.success(
      "标准数据导出成功 / Standard data exported successfully"
    );
  } catch (error) {
    console.error("导出标准数据失败:", error);
    window.alerty.error("导出标准数据失败 / Standard data export failed");
  }
}

// 导入Excel
async function TeamgenImportExcel(file) {
  try {
    // 清理旧数据，避免干扰
    teamgen_PreviewData = [];
    teamgen_PreviewMode = false;

    const workbook = new ExcelJS.Workbook();
    const buffer = await file.arrayBuffer();
    await workbook.xlsx.load(buffer);

    const worksheet = workbook.getWorksheet(1); // 第一个工作表
    if (!worksheet) {
      throw new Error("Excel文件中没有找到工作表");
    }

    const teamData = [];
    const errors = [];
    const importTeamHeaders = TeamgenImportTeamHeaders();
    const col = (key) => TeamgenExcelColumnIndexByKey(importTeamHeaders, key);

    worksheet.eachRow((row, rowNumber) => {
      try {
        const values = row.values;
        if (!values || values.length < 2) return;

        // 检查第一行是否为表头
        if (rowNumber === 1 && TeamgenIsHeaderRow(values)) {
          return; // 跳过表头行
        }

        // 检查是否为样例行（最后一列有"样例"字样）
        // 检查最后一列是否包含样例标识
        const sampleValue = TeamgenExtractCellValue(values[values.length - 1]);
        if (
          sampleValue &&
          (sampleValue.includes("样例") || sampleValue.includes("Example"))
        ) {
          return; // 跳过样例行
        }

        // 提取原始数据，处理Excel格式问题（列顺序随是否多分组与表头一致）
        const teamInfo = {
          row_index: `excel_${rowNumber}`, // 添加唯一索引
          team_id: TeamgenExtractCellValue(values[col("team_id")]) || "",
          name: TeamgenExtractCellValue(values[col("name")]) || "",
          name_en: TeamgenExtractCellValue(values[col("name_en")]) || "",
          school: TeamgenExtractCellValue(values[col("school")]) || "",
          region: TeamgenParseRegion(
            TeamgenExtractCellValue(values[col("region")]) || ""
          ),
          tmember: TeamgenExtractCellValue(values[col("tmember")]) || "",
          coach: TeamgenExtractCellValue(values[col("coach")]) || "",
          room: TeamgenExtractCellValue(values[col("room")]) || "",
          tkind: TeamgenParseTkind(
            TeamgenExtractCellValue(values[col("tkind")])
          ),
          password: "",
          groups: TeamgenIsMultiGroup()
            ? TeamgenNormalizeGroupsInputValue(
                TeamgenExtractCellValue(values[col("groups")])
              )
            : "",
          validation_errors: [],
        };

        // 处理密码（在teamInfo初始化后）
        const pwd = TeamgenExtractCellValue(values[col("password")]);
        if (!pwd || pwd.trim() === "") {
          teamInfo._password_auto_generated = true;
          teamInfo.password = TeamgenGeneratePassword(teamInfo.team_id);
        } else {
          teamInfo._password_auto_generated = false;
          teamInfo.password = pwd.trim();
        }

        // 验证数据
        const validationResult = TeamgenValidateTeamData(teamInfo, rowNumber);
        teamInfo.validation_errors = validationResult.errors;
        teamInfo.validation_warnings = validationResult.warnings;

        teamData.push(teamInfo);
      } catch (rowError) {
        console.error(`解析Excel第${rowNumber}行数据时出错:`, rowError);
        // 添加错误行到结果中
        teamData.push({
          row_index: `excel_error_${rowNumber}`,
          team_id: "",
          name: `解析错误 (第${rowNumber}行)`,
          name_en: "Parse Error",
          school: "",
          region: "",
          tmember: "",
          coach: "",
          room: "",
          tkind: 0,
          password: "",
          groups: "",
          validation_errors: [
            `Excel数据格式错误: ${escapeHtml(rowError.message)}`,
          ],
          validation_warnings: [],
        });
      }
    });

    if (teamData.length === 0) {
      window.alerty.error("没有有效的队伍数据 / No valid team data found");
      return;
    }

    // 显示预览
    TeamgenShowPreview(teamData, "excel", $("#reset_team").is(":checked"));
  } catch (error) {
    console.error("导入Excel失败:", error);
    window.alerty.error("导入Excel失败: " + error.message);
  }
}

// 提取单元格原始值
function TeamgenExtractCellValue(cellValue) {
  if (cellValue === null || cellValue === undefined) return "";

  // 如果是对象，尝试获取原始值
  if (typeof cellValue === "object") {
    if (cellValue.richText) {
      // 富文本，提取纯文本
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

/**
 * 解析队伍类型 → "0" | "1" | "2"
 * 支持：纯 0/1/2；下拉仅数字；复合展示「0 / 正式 / Regular」「0 / 正式」「正式 / Regular」；
 * 仅关键词「正式」「Regular」「女队」「打星」「Star」等（与文本粘贴、旧模板兼容）。
 * 行首为 0/1/2 且后跟分隔符或结尾时优先采数字，避免「2」与英文子串组合被关键词误判。
 */
function TeamgenParseTkind(tkindValue) {
  if (!tkindValue) return "0";
  const raw = String(tkindValue).trim();
  if (!raw) return "0";
  const value = raw.toLowerCase();

  const headDigit = raw.match(/^\s*([012])\s*(?:$|[/／、,，\s].*)?$/);
  if (headDigit) {
    return headDigit[1];
  }

  if (/^[012]$/.test(value)) {
    return value;
  }

  if (
    value.includes("正") ||
    value.includes("常") ||
    value.includes("official") ||
    value.includes("regular")
  ) {
    return "0";
  }
  if (value.includes("女") || value.includes("girl")) {
    return "1";
  }
  if (value.includes("打") || value.includes("星") || value.includes("star")) {
    return "2";
  }

  return "0";
}

// 格式化队伍类型用于导出（与模板说明列语义一致，首字符仍为数字便于识别）
function TeamgenFormatTkindForExport(tkind) {
  const tkindMap = {
    0: "0 — 正式 / Regular",
    1: "1 — 女队 / Girls",
    2: "2 — 打星 / Star",
  };
  return tkindMap[tkind] || tkindMap[0];
}

// 通用密码生成函数
function GeneratePassword(
  id = "",
  charSet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"
) {
  const raw = $("#password_seed").val();
  const trimmed = typeof raw === "string" ? raw.trim() : raw;
  // 留空：为本批次生成随机种子并立即填入输入框（触发 input/change 以同步 localStorage），后续队伍沿用同一种子
  let seed;
  if (trimmed) {
    seed = parseInt(trimmed, 10);
    if (isNaN(seed)) {
      seed = Math.floor(Math.random() * 1000000);
      $("#password_seed").val(seed).trigger("input").trigger("change");
    }
  } else {
    seed = Math.floor(Math.random() * 1000000);
    $("#password_seed").val(seed).trigger("input").trigger("change");
  }

  // 使用种子和id生成确定性随机数
  let combinedSeed = seed + id.length + id.charCodeAt(0) || 0;
  for (let i = 0; i < id.length; i++) {
    combinedSeed = (combinedSeed * 31 + id.charCodeAt(i)) % 2147483647;
  }

  // 简单的线性同余生成器
  function seededRandom() {
    combinedSeed = (combinedSeed * 16807) % 2147483647;
    return combinedSeed / 2147483647;
  }

  let password = "";
  for (let i = 0; i < 8; i++) {
    password += charSet.charAt(Math.floor(seededRandom() * charSet.length));
  }

  return password;
}

// 队伍密码生成函数
function TeamgenGeneratePassword(teamId = "") {
  return GeneratePassword(teamId, "ABCDEFGHJKMNPQRSTUVWXYZ23456789");
}

// 生成文件名
function TeamgenGenerateFilename(prefix, fixedTimestamp) {
  // 获取比赛信息
  const contestId = window.TEAMGEN_CONFIG?.contest_id || "unknown";
  let contestTitle = window.TEAMGEN_CONFIG?.contest_title || "unknown";

  // 过滤非合法文件名字符，空格替换为下划线
  contestTitle = contestTitle.replace(/[<>:"/\\|?*]/g, "").replace(/\s+/g, "_");

  // 生成时间戳 (YYYYMMDDHHMMSS)
  let timestamp = fixedTimestamp;
  if (!timestamp) {
    const now = new Date();
    timestamp =
      now.getFullYear().toString() +
      (now.getMonth() + 1).toString().padStart(2, "0") +
      now.getDate().toString().padStart(2, "0") +
      now.getHours().toString().padStart(2, "0") +
      now.getMinutes().toString().padStart(2, "0") +
      now.getSeconds().toString().padStart(2, "0");
  }

  return `${prefix}_cid${contestId}_${contestTitle}_${timestamp}`;
}

/** 文件名片段：去掉非法字符（与比赛标题规则一致） */
function TeamgenSanitizeFilenameSegment(s) {
  let t = (s == null ? "" : String(s)).trim();
  t = t.replace(/[<>:"/\\|?*]/g, "").replace(/\s+/g, "_");
  return t || "unnamed";
}

/** 分区字段：英文/中文逗号分隔为多分区 */
function TeamgenSplitRoomZones(room) {
  const str = (room == null ? "" : String(room)).trim();
  if (!str) return [];
  return str
    .split(/[,，]/)
    .map((x) => x.trim())
    .filter(Boolean);
}

/**
 * 按分区聚合行（room 多值时同一行可出现在多个分区列表）
 * @returns {Map<string, any[]>} key 为分区原始串或 "__empty__"
 */
function TeamgenGroupRowsByZone(rows) {
  const map = new Map();
  for (const row of rows) {
    const zones = TeamgenSplitRoomZones(row.room);
    if (zones.length === 0) {
      const k = "__empty__";
      if (!map.has(k)) map.set(k, []);
      map.get(k).push(row);
    } else {
      for (const z of zones) {
        if (!map.has(z)) map.set(z, []);
        map.get(z).push(row);
      }
    }
  }
  return map;
}

function TeamgenZoneExportLabel(zoneKey) {
  return zoneKey === "__empty__" ? "未分区" : String(zoneKey);
}

function TeamgenEnsureZipJs() {
  if (typeof zip !== "undefined" && zip.ZipWriter && zip.BlobWriter && zip.BlobReader) {
    if (typeof CsgZipEnsureConfigured === "function") {
      CsgZipEnsureConfigured();
    }
    return true;
  }
  return false;
}

// 验证单个队伍信息
function TeamgenValidateTeamInfo(teamInfo, rowNumber) {
  const errors = [];

  // 验证队伍ID
  if (teamInfo.team_id && !/^[a-zA-Z0-9]+$/.test(teamInfo.team_id)) {
    errors.push(`第${rowNumber}行: 队伍ID只能包含数字和字母`);
  }

  // 验证队名长度
  if (teamInfo.name && teamInfo.name.length > 100) {
    errors.push(`第${rowNumber}行: 队名过长（最多100字符）`);
  }

  // 验证英文队名长度
  if (teamInfo.name_en && teamInfo.name_en.length > 120) {
    errors.push(`第${rowNumber}行: 英文队名过长（最多120字符）`);
  }

  // 验证队伍类型
  if (teamInfo.tkind && !["0", "1", "2"].includes(String(teamInfo.tkind))) {
    errors.push(`第${rowNumber}行: 队伍类型必须是0、1或2`);
  }

  return {
    valid: errors.length === 0,
    errors: errors,
  };
}

// 提交Excel数据
async function TeamgenSubmitExcelData(teamData) {
  const resetTeam = $("#reset_team").is(":checked");

  // 转换为文本格式
  const teamDescription = teamData
    .map((team) => {
      return [
        team.team_id || "",
        team.name || "",
        team.name_en || "",
        team.school || "",
        team.region || "",
        team.tmember || "",
        team.coach || "",
        team.room || "",
        team.tkind || "0",
        team.password || "",
      ].join("\t");
    })
    .join("\n");

  const formData = new FormData();
  formData.append("team_description", teamDescription);
  if (resetTeam) {
    formData.append("reset_team", "on");
  }

  $.ajax({
    url: $("#contest_teamgen_form").attr("action"),
    type: "POST",
    data: formData,
    processData: false,
    contentType: false,
    success: function (ret) {
      if (ret.code == 1) {
        window.alerty.success(ret.msg);
        $("#teamgen_table").bootstrapTable("load", ret.data.rows);
        $("#excel_file_input").val(""); // 清空文件选择
        $("#import_excel_btn").prop("disabled", true);
      } else {
        window.alerty.error(ret.msg);
      }
    },
    error: function () {
      window.alerty.error("提交失败，请重试");
    },
  });
}

// 导出到Excel
async function TeamgenExportToExcel(teamData, filename) {
  try {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("队伍数据");

    // 设置列定义（不包含样例列，不设置header避免重复表头）
    const exportHeaders = TeamgenVisibleHeaders(TEAMGEN_HEADERS).filter((h) => h.key !== "sample");
    worksheet.columns = exportHeaders.map((h) => ({
      key: h.key,
      width: h.width,
    }));

    // 添加中英双语表头
    const headerRow = worksheet.addRow(
      exportHeaders.map((h) => `${h.header}\n${h.header_en}`)
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

    // 添加数据
    teamData.forEach((team) => {
      const tkindFormatted = TeamgenFormatTkindForExport(team.tkind);
      const rowCells = [
        team.team_id || "",
        team.name || "",
        team.name_en || "",
        team.school || "",
        team.region || "",
        team.tmember || "",
        team.coach || "",
        team.room || "",
        tkindFormatted,
        team.password || "",
      ];
      if (TeamgenIsMultiGroup()) {
        rowCells.push(TeamgenNormalizeGroupsInputValue(team.groups) || "");
      }
      const excelRow = worksheet.addRow(rowCells);

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
    const exportFilename = TeamgenGenerateFilename(filename);

    // 导出文件
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${exportFilename}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error("导出Excel失败:", error);
    throw error;
  }
}

// 解析文本数据
function TeamgenParseTextDataInternal(teamDescription) {
  try {
    const teamList = teamDescription.split("\n");
    const parsedData = [];

    for (let i = 0; i < teamList.length; i++) {
      try {
        const line = teamList[i] || "";
        if (line.trim() === "") continue;
        const elements = line.split(/\t/).map((elem) => {
          if (typeof elem === "string") {
            return elem.trim();
          }
          return String(elem || "").trim();
        });

        // 检查第一行是否为表头
        if (i === 0 && TeamgenIsHeaderRow(elements)) {
          continue; // 跳过表头行
        }

        // 检查是否为样例行（最后一列包含"样例"或"Example"）
        const lastColumnValue = elements[elements.length - 1] || "";
        if (
          lastColumnValue.includes("样例") ||
          lastColumnValue.includes("Example")
        ) {
          continue; // 跳过样例行
        }

        const team = {
          row_index: `text_${i}`, // 添加唯一索引
          team_id: elements[0]?.trim() || "",
          name: elements[1]?.trim() || "",
          name_en: elements[2]?.trim() || "",
          school: elements[3]?.trim() || "",
          region: TeamgenParseRegion(elements[4]?.trim() || ""),
          tmember: elements[5]?.trim() || "",
          coach: elements[6]?.trim() || "",
          room: elements[7]?.trim() || "",
          tkind: TeamgenParseTkind(elements[8]?.trim() || "0"),
          password: "",
          groups: TeamgenIsMultiGroup()
            ? TeamgenNormalizeGroupsInputValue(elements[10])
            : "",
          validation_errors: [],
        };

        // 处理密码（在team初始化后）
        const pwd = elements[9]?.trim();
        if (!pwd || pwd === "") {
          team._password_auto_generated = true;
          team.password = TeamgenGeneratePassword(team.team_id);
        } else {
          team._password_auto_generated = false;
          team.password = pwd;
        }

        // 验证数据
        const validationResult = TeamgenValidateTeamData(team, i + 1);
        team.validation_errors = validationResult.errors;
        team.validation_warnings = validationResult.warnings;

        parsedData.push(team);
      } catch (lineError) {
        console.error(`解析第${i + 1}行数据时出错:`, lineError);
        // 添加错误行到结果中
        parsedData.push({
          row_index: `text_error_${i}`,
          team_id: "",
          name: `解析错误 (第${i + 1}行)`,
          name_en: "Parse Error",
          school: "",
          region: "",
          tmember: "",
          coach: "",
          room: "",
          tkind: 0,
          password: "",
          groups: "",
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

// 验证单个队伍数据
function TeamgenValidateTeamData(team, rowIndex) {
  const errors = [];
  const warnings = [];

  // 验证队伍ID（必填）
  if (!team.team_id) {
    errors.push(`队伍ID不能为空`);
  } else if (!/^[a-zA-Z0-9]+$/.test(team.team_id)) {
    errors.push(`队伍ID只能包含数字和字母`);
  }

  // 验证队名（必填）
  if (!team.name) {
    errors.push(`队名不能为空`);
  } else if (team.name.length > 100) {
    errors.push(`队名过长（最多100字符）`);
  }

  // 验证英文队名
  if (team.name_en && team.name_en.length > 120) {
    errors.push(`英文队名过长（最多120字符）`);
  }

  // 学校可以为空，不验证

  // 验证队伍类型
  const tkindStr = String(team.tkind ?? "0");
  if (!["0", "1", "2"].includes(tkindStr)) {
    errors.push(`队伍类型无效（0普通/1女队/2打星）`);
  }

  // 检查密码是否为空（自动生成的情况）
  if (team._password_auto_generated) {
    warnings.push(`密码为空，将自动生成随机密码`);
  }

  return { errors, warnings };
}

// 检查重复的team_id
function TeamgenCheckDuplicateTeamIds(data) {
  const teamIdCount = {};
  const duplicateTeamIds = new Set();

  // 统计每个team_id的出现次数
  data.forEach((team, index) => {
    if (team.team_id && team.team_id.trim() !== "") {
      const teamId = team.team_id.trim();
      if (!teamIdCount[teamId]) {
        teamIdCount[teamId] = [];
      }
      teamIdCount[teamId].push(index);

      if (teamIdCount[teamId].length > 1) {
        duplicateTeamIds.add(teamId);
      }
    }
  });

  // 为重复的team_id添加错误信息
  duplicateTeamIds.forEach((teamId) => {
    const indices = teamIdCount[teamId];
    indices.forEach((index) => {
      if (!data[index].validation_errors) {
        data[index].validation_errors = [];
      }
      data[index].validation_errors.push(
        `队伍ID "${escapeHtml(teamId)}" 重复，请修改为唯一值`
      );
    });
  });
}

// 显示预览数据
function TeamgenShowPreview(data, source, resetTeam) {
  teamgen_PreviewData = data;
  teamgen_PreviewMode = true;

  // 检查team_id重复
  TeamgenCheckDuplicateTeamIds(data);

  // 显示错误信息列
  $("#teamgen_table").bootstrapTable("showColumn", "validation_errors");

  // 更新工具栏
  $("#toolbar_title").html(
    '<span class="cn-text"><i class="bi bi-table me-2"></i>数据预览</span><span class="en-text">Data Preview</span>'
  );
  $("#toolbar_subtitle")
    .html(
      '请检查数据后执行导入<span class="en-text">Please review data before importing</span>'
    )
    .show();
  $("#preview_import_tip").show();
  $("#execute_import_btn").show();

  // 隐藏导出按钮（预览模式下不适合导出）
  $("#export_teamgen_pageteam_group").hide();
  $("#export_standard_btn").hide();

  // 应用预览数据样式
  $("#teamgen_toolbar")
    .removeClass("toolbar-actual-data")
    .addClass("toolbar-preview-data");

  // 计算错误和警告统计
  const errorRows = data.filter(
    (team) => team.validation_errors && team.validation_errors.length > 0
  );
  const warningRows = data.filter(
    (team) => team.validation_warnings && team.validation_warnings.length > 0
  );

  // 显示错误和警告统计
  showErrorWarningSummary(errorRows, warningRows);

  // 加载数据到表格
  $("#teamgen_table").bootstrapTable("load", data);

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

// 执行导入
function TeamgenExecuteImport() {
  if (!teamgen_PreviewMode) return;

  // 过滤掉有错误的数据
  const validData = teamgen_PreviewData.filter(
    (team) => (team.validation_errors || []).length === 0
  );

  if (validData.length === 0) {
    window.alerty.error("没有有效数据可导入 / No valid data to import");
    return;
  }

  // 显示确认对话框
  window.alerty.confirm({
    message: `确认导入 ${validData.length} 条队伍数据？`,
    message_en: `Confirm importing ${validData.length} team records?`,
    callback: function () {
      TeamgenExecuteImportInternal(validData);
    },
  });
}

// 内部执行导入函数
function TeamgenExecuteImportInternal(validData) {
  const resetTeam = $("#reset_team").is(":checked");
  const ttype = window.TEAMGEN_CONFIG?.ttype || "0";

  // 提交结构化数据
  const requestData = {
    team_list: JSON.stringify(validData),
    reset_team: resetTeam,
    password_seed: $("#password_seed").val() || 0,
    ttype: ttype,  // 传递区分参数：1表示工作人员生成，0表示队伍生成
  };

  var $container = $(".admin-import-container");
  var $overlay = $('<div class="import-submit-overlay"><div class="import-submit-overlay-inner"><div class="spinner-border text-light" role="status"></div><p class="mt-2 text-white mb-0"><span class="cn-text">正在提交导入，请稍候…</span><span class="en-text">Submitting import, please wait...</span></p></div></div>');
  $container.append($overlay);

  $.ajax({
    url: $("#contest_teamgen_form").attr("action"),
    type: "POST",
    data: requestData,
    success: function (ret) {
      if (ret.code == 1) {
        // 切换到实际数据模式
        TeamgenShowActualData(ret.data.rows);

        window.alerty.success(ret.msg);
      } else {
        window.alerty.error(ret.msg);
      }
    },
    error: function () {
      window.alerty.error("提交失败，请重试 / Submit failed, please try again");
    },
    complete: function () {
      $container.find(".import-submit-overlay").remove();
    },
  });
}

// 显示实际数据
function TeamgenShowActualData(data) {
  teamgen_PreviewMode = false;

  // 隐藏错误信息列
  $("#teamgen_table").bootstrapTable("hideColumn", "validation_errors");

  // 更新工具栏
  $("#toolbar_title").html(
    '<span class="cn-text"><i class="bi bi-database me-2"></i>实际数据</span><span class="en-text">Actual Data</span>'
  );
  $("#toolbar_subtitle").hide(); // 隐藏提示信息
  $("#preview_import_tip").hide();
  $("#execute_import_btn").hide();
  $("#error_summary").hide();

  // 显示导出按钮（实际数据模式下可以导出）
  $("#export_teamgen_pageteam_group").show();
  $("#export_standard_btn").show();

  // 应用实际数据样式
  $("#teamgen_toolbar")
    .removeClass("toolbar-preview-data")
    .addClass("toolbar-actual-data");

  // 加载实际数据
  $("#teamgen_table").bootstrapTable("load", data);
}

// 全局变量
let teamgen_page_info = $("#page_info");
let teamgen_cid = window.TEAMGEN_CONFIG?.contest_id || "unknown";
let teamgen_ctitle = window.TEAMGEN_CONFIG?.contest_title || "unknown";
let teamgen_table = $("#teamgen_table");
let teamgen_delete_infoed = false;

// 统一定义表头结构
const TEAMGEN_HEADERS = [
  { header: "队号", header_en: "Team ID", key: "team_id", width: 12 },
  { header: "队名", header_en: "Team Name", key: "name", width: 20 },
  {
    header: "副语言队名",
    header_en: "Secondary Language Name",
    key: "name_en",
    width: 25,
  },
  { header: "学校", header_en: "School", key: "school", width: 25 },
  {
    header: "国家/地区",
    header_en: "Country/Region",
    key: "region",
    width: 15,
  },
  { header: "队员", header_en: "Members", key: "tmember", width: 30 },
  { header: "教练", header_en: "Coach", key: "coach", width: 20 },
  { header: "房间/区域", header_en: "Room/Area", key: "room", width: 15 },
  { header: "队伍类型", header_en: "Team Type", key: "tkind", width: 15 },
  { header: "密码", header_en: "Password", key: "password", width: 15 },
  { header: "赛事归属", header_en: "Affiliations", key: "groups", width: 20 },
  { header: "", header_en: "", key: "sample", width: 15 }, // 样例列，无表头
];

/** 权限子表：A 列为代码（下拉用），B 列为说明 */
const TEAMGEN_PRIVILEGE_CATALOG = [
  { code: "admin", desc: "监考 / 赛务配置 · Proctor & config" },
  { code: "printer", desc: "打印管理 · Print admin" },
  { code: "balloon_manager", desc: "气球管理 · Balloon manager" },
  { code: "balloon_sender", desc: "气球配送 · Balloon runner" },
  { code: "watcher", desc: "观察 / 外榜直播 · Observer" },
  { code: "ccs_reader", desc: "CCS API 只读 · CCS API read-only" },
];

/** 工作人员 Excel 表头（与队伍模板共用 TeamgenVisibleHeaders） */
const STAFFGEN_HEADERS = [
  { header: "账号", header_en: "User ID", key: "team_id", width: 15 },
  { header: "姓名", header_en: "Name", key: "name", width: 20 },
  { header: "房间", header_en: "Room", key: "room", width: 15 },
  { header: "权限", header_en: "Privilege", key: "privilege", width: 20 },
  { header: "密码", header_en: "Password", key: "password", width: 15 },
  { header: "分组", header_en: "Groups", key: "groups", width: 18 },
  { header: "", header_en: "", key: "sample", width: 15 },
];

function TeamgenIsMultiGroup() {
  return !!window.TEAMGEN_CONFIG?.is_multi_group;
}

function TeamgenVisibleHeaders(headers) {
  if (TeamgenIsMultiGroup()) {
    return headers;
  }
  return headers.filter((h) => h.key !== "groups");
}

/** 1-based 列号 → Excel 列字母 */
function TeamgenExcelColLetter(col1Based) {
  let n = col1Based;
  let s = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

function TeamgenExcelColumnIndexByKey(headers, key) {
  const i = headers.findIndex((h) => h.key === key);
  return i >= 0 ? i + 1 : 0;
}

function TeamgenImportTeamHeaders() {
  return TeamgenVisibleHeaders(TEAMGEN_HEADERS).filter((h) => h.key !== "sample");
}

function StaffgenImportStaffHeaders() {
  return TeamgenVisibleHeaders(STAFFGEN_HEADERS).filter((h) => h.key !== "sample");
}

function TeamgenContestGroupsForTemplate() {
  const g = window.TEAMGEN_CONFIG?.contest_groups;
  return Array.isArray(g) ? g : [];
}

/** 与 util.js contestGroupAffiliation* 一致：库表为 group_id / group_name，部分接口可能用 id / name */
function TeamgenContestGroupCatalogId(g) {
  if (!g || typeof g !== "object") return "";
  const fromGid = g.group_id != null ? String(g.group_id).trim() : "";
  if (fromGid !== "") return fromGid;
  return g.id != null ? String(g.id).trim() : "";
}

function TeamgenContestGroupCatalogName(g) {
  const id = TeamgenContestGroupCatalogId(g);
  const fromGn =
    g.group_name != null ? String(g.group_name).trim() : "";
  if (fromGn !== "") return fromGn;
  const fromName = g.name != null ? String(g.name).trim() : "";
  if (fromName !== "") return fromName;
  return id;
}

/**
 * 赛事归属 / 分组：支持英文逗号、中文逗号分隔多 group；「id / 名称」格取 id。
 * 输出为英文逗号分隔的 id（与后端习惯一致）。
 */
function TeamgenNormalizeGroupsInputValue(raw) {
  if (raw == null || raw === "") return "";
  return String(raw)
    .split(/[,，]+/)
    .map((t) => t.trim())
    .filter(Boolean)
    .map((t) => {
      const sep = " / ";
      const p = t.indexOf(sep);
      return p >= 0 ? t.slice(0, p).trim() : t;
    })
    .join(",");
}

function TeamgenApplyListColumnValidation(
  worksheet,
  colLetter,
  fromRow,
  toRow,
  formula,
  errorTitle,
  errorMessage
) {
  for (let r = fromRow; r <= toRow; r++) {
    worksheet.getCell(`${colLetter}${r}`).dataValidation = {
      type: "list",
      allowBlank: true,
      formulae: [formula],
      showErrorMessage: true,
      errorStyle: "error",
      errorTitle,
      error: errorMessage,
    };
  }
}

// 工作人员密码生成函数
function StaffgenGeneratePassword(staffId = "") {
  return GeneratePassword(staffId, "23456789ABCDEFGHJKLMNPQRSTUVWXYZ");
}

// 工作人员表头检测
function StaffgenIsHeaderRow(row) {
  if (!row || row.length === 0) return false;

  // 工作人员表头特征关键词（中英文）
  const headerKeywords = [
    "账号",
    "User ID",
    "team_id",
    "姓名",
    "Name",
    "name",
    "密码",
    "Password",
    "password",
    "权限",
    "Privilege",
    "privilege",
    "房间",
    "Room",
    "room",
    "分组",
    "Group",
    "groups",
  ];

  // 检查行中是否包含表头关键词
  const rowText = row.join(" ").toLowerCase();
  let matchCount = 0;

  for (const keyword of headerKeywords) {
    if (rowText.includes(keyword.toLowerCase())) {
      matchCount++;
    }
  }

  // 如果匹配的关键词数量大于等于3，认为是表头
  return matchCount >= 3;
}

// 验证工作人员数据
function StaffgenValidateStaffData(staff, rowIndex) {
  const errors = [];
  const warnings = [];

  // 验证账号（必填）
  if (!staff.team_id) {
    errors.push(`账号不能为空`);
  } else if (staff.team_id.length < 3) {
    errors.push(`账号至少3个字符`);
  } else if (!/^[a-zA-Z0-9]+$/.test(staff.team_id)) {
    errors.push(`账号只能包含数字和字母`);
  }

  // 验证姓名（必填）
  if (!staff.name) {
    errors.push(`姓名不能为空`);
  }

  // 验证权限（必填）
  const validPrivileges = [
    "admin",
    "printer",
    "balloon_manager",
    "balloon_sender",
    "watcher",
    "ccs_reader",
  ];
  if (!staff.privilege) {
    errors.push(`权限不能为空`);
  } else if (!validPrivileges.includes(staff.privilege)) {
    errors.push(`权限不在可选范围内（${validPrivileges.join(", ")}）`);
  }

  // 检查密码是否为空（自动生成的情况）
  if (staff._password_auto_generated) {
    warnings.push(`密码为空，将自动生成随机密码`);
  }

  return { errors, warnings };
}

// 检测是否为表头行
function TeamgenIsHeaderRow(row) {
  if (!row || row.length === 0) return false;

  // 表头特征关键词（中英文）
  const headerKeywords = [
    "队号",
    "Team ID",
    "team_id",
    "队名",
    "Team Name",
    "name",
    "学校",
    "School",
    "school",
    "队员",
    "Members",
    "member",
    "教练",
    "Coach",
    "coach",
    "密码",
    "Password",
    "password",
    "类型",
    "Type",
    "type",
    "房间",
    "Room",
    "room",
    "地区",
    "Region",
    "region",
    "副语言队名",
    "Secondary Language Name",
    "name_en",
    "样例",
    "Sample",
    "sample",
  ];

  // 检查行中是否包含表头关键词
  const rowText = row.join(" ").toLowerCase();
  let matchCount = 0;

  for (const keyword of headerKeywords) {
    if (rowText.includes(keyword.toLowerCase())) {
      matchCount++;
    }
  }

  // 如果匹配的关键词数量大于等于3，认为是表头
  return matchCount >= 3;
}

// 表格格式化函数
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

  return `<button class="${buttonClass}" onclick="showErrorDetail(${index}, '${escapeHtml(
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

function FormatterTkind(value, row, index, field) {
  const tkindMap = {
    0: '<span class="badge bg-primary csg-badge-eq csg-badge-eq--stack">正式<span class="en-text">Regular</span></span>',
    1: '<span class="badge bg-danger csg-badge-eq csg-badge-eq--stack">女队<span class="en-text">Girls</span></span>',
    2: '<span class="badge bg-warning csg-badge-eq csg-badge-eq--stack text-dark">打星<span class="en-text">Star</span></span>',
  };
  return (
    tkindMap[value] ||
    '<span class="badge bg-secondary csg-badge-eq csg-badge-eq--stack">未知<span class="en-text">Unknown</span></span>'
  );
}

function FormatterModify(value, row, index, field) {
  return `<button class='modify_button btn btn-outline-primary btn-sm' title="修改队伍信息 / Modify Team Information">
                <i class="bi bi-pencil-square"></i>
            </button>`;
}

function FormatterDel(value, row, index, field) {
  return `<button class='delete_button btn btn-outline-danger btn-sm' title="双击删除 / Double Click to Delete">
                <i class="bi bi-trash"></i>
            </button>`;
}

// HTML转义函数：使用全局 DomSantize（来自 global.js）
function escapeHtml(text) {
  return DomSantize(text);
}

// 显示错误和警告统计的通用函数
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

// 显示错误详情
function showErrorDetail(rowIndex, messageString, errorCount, warningCount) {
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

// 通用表格事件绑定 - 参数化设计
function BindTableEvents(config) {
  const {
    tableSelector, // 表格选择器
    deleteInfoedGetter, // 删除提示状态getter函数
    previewModeGetter, // 预览模式状态getter函数
    deleteFromPreviewFunc, // 预览模式删除函数
    deleteFromServerFunc, // 服务器删除函数
  } = config;

  const table = $(tableSelector);
  table.on("click-cell.bs.table", function (e, field, td, row) {
    if (field == "delete") {
      if (!deleteInfoedGetter()) {

        // 这里需要提供一个setter函数来更新状态
        if (config.deleteInfoedSetter) {
          config.deleteInfoedSetter(true);
        }
      }
    } else if (field == "modify") {
      // 处理修改按钮点击
      const tableData = $(tableSelector).bootstrapTable("getData");
      const rowIndex = tableData.findIndex((r) => r.row_index === row.row_index);
      if (rowIndex >= 0) {
        if (window.TEAMGEN_CONFIG?.action === "contest_staffgen") {
          StaffgenOpenModifyModal(rowIndex);
        } else {
          TeamgenOpenModifyModal(rowIndex);
        }
      }
    }
  });

  table.on("dbl-click-cell.bs.table", function (e, field, td, row) {
    if (field == "delete") {
      if (previewModeGetter()) {
        // 预览模式：从待提交数据中删除
        deleteFromPreviewFunc(row);
      } else {
        // 实际数据模式：调用后端删除接口
        deleteFromServerFunc(row);
      }
    }
  });
}

// 地区解析函数 - 将各种格式的地区数据转换为中文简称
function TeamgenParseRegion(regionValue) {
  if (!regionValue) return "";

  // 如果已经是双语格式，先提取中文部分，然后继续解析
  let searchValue = regionValue;
  if (regionValue.includes(" / ")) {
    const parts = regionValue.split(" / ");
    searchValue = parts[0].trim();
  }

  // 尝试匹配地区数据 - 支持所有字段
  let region = null;

  // 遍历所有地区数据，检查所有字段
  for (let i = 0; i < teamgen_regionList.length; i++) {
    const currentRegion = teamgen_regionList[i];

    // 检查所有可能的字段
    if (
      searchValue === currentRegion["中文名"] ||
      searchValue === currentRegion["中文简称"] ||
      searchValue === currentRegion["英文名"] ||
      searchValue === currentRegion["英文简称"] ||
      searchValue === currentRegion["英文缩写"]
    ) {
      region = currentRegion;
      break;
    }
  }

  // 如果找到匹配的地区，返回中文简称
  if (region) {
    return region["中文简称"];
  }

  // 如果没找到匹配，返回原始值
  return regionValue;
}

// ID/账号列样式：队伍页单行省略；赛务页账号须完整可见（可换行）
function cellStyleTeamId(value, row, index, field) {
  if (window.TEAMGEN_CONFIG?.action === "contest_staffgen") {
    return {
      css: {
        "white-space": "normal",
        "word-break": "break-word",
        overflow: "visible",
        "text-overflow": "clip",
      },
    };
  }
  return {
    classes: "text-nowrap",
    css: {
      "white-space": "nowrap",
      overflow: "hidden",
      "text-overflow": "ellipsis",
    },
  };
}

/** 地区列纯文本（供导出/其它表复用逻辑） */
function TeamgenResolveRegionLabel(value) {
  if (!value) return "";
  const v = String(value);
  if (v.includes(" / ")) {
    return v;
  }
  let region = null;
  if (teamgen_regionMap.byCode[v]) {
    region = teamgen_regionMap.byCode[v];
  } else if (teamgen_regionMap.byName[v]) {
    region = teamgen_regionMap.byName[v];
  }
  if (region) {
    return `${region["中文简称"]} / ${region["英文简称"]}`;
  }
  return v;
}

function FormatterRegion(value, row, index, field) {
  return TeamgenResolveRegionLabel(value);
}

function FormatterTeamgenRegion(value, row, index, field) {
  const label = TeamgenResolveRegionLabel(value);
  const inner = !label
    ? csg.hashTagBadgeHtml("", "", {})
    : csg.hashTagBadgeHtml(
        label,
        String(value || "").trim() || label,
        { allowWrap: true, maxWidth: "9rem" }
      );
  return (
    '<div class="teamgen-hash-cell teamgen-hash-cell--center">' +
    inner +
    "</div>"
  );
}

function FormatterTeamgenSchool(value, row, index, field) {
  const s = value != null ? String(value).trim() : "";
  if (!s) {
    return csg.hashTagBadgeHtml("", "", {});
  }
  return csg.hashTagBadgeHtml(s, s, { allowWrap: true, maxWidth: "12rem" });
}

function FormatterTeamgenRoom(value, row, index, field) {
  const s = value != null ? String(value).trim() : "";
  const inner = !s
    ? csg.hashTagBadgeHtml("", "", {})
    : csg.hashTagBadgeHtml(s, s, { allowWrap: false, maxWidth: "7rem" });
  return '<div class="teamgen-hash-cell teamgen-hash-cell--center">' + inner + "</div>";
}

function FormatterTeamgenPrivilege(value, row, index, field) {
  const s = value != null ? String(value).trim() : "";
  const inner = !s
    ? csg.hashTagBadgeHtml("", "", {})
    : csg.hashTagBadgeHtml(s, s, { allowWrap: true, maxWidth: "7.5rem" });
  return (
    '<div class="teamgen-hash-cell teamgen-hash-cell--center">' + inner + "</div>"
  );
}

function cellStyleTeamgenIdx() {
  return { css: { fontSize: "0.78rem", padding: "0.28rem 0.2rem" } };
}

function cellStyleTeamgenName() {
  return {
    css: {
      fontSize: "0.8rem",
      lineHeight: "1.35",
      whiteSpace: "normal",
      wordBreak: "break-word",
      verticalAlign: "middle",
      padding: "0.3rem 0.35rem",
      maxWidth: "11rem",
    },
  };
}

function cellStyleTeamgenNameEn() {
  return {
    css: {
      fontSize: "0.76rem",
      lineHeight: "1.35",
      whiteSpace: "normal",
      wordBreak: "break-word",
      verticalAlign: "middle",
      padding: "0.3rem 0.35rem",
      maxWidth: "9rem",
      color: "var(--bs-secondary-color, #6c757d)",
    },
  };
}

function cellStyleTeamgenSchool() {
  return {
    css: {
      verticalAlign: "middle",
      padding: "0.3rem 0.35rem",
      maxWidth: "13rem",
    },
  };
}

function cellStyleTeamgenRegion() {
  return {
    css: {
      verticalAlign: "middle",
      padding: "0.3rem 0.35rem",
      maxWidth: "10rem",
      textAlign: "center",
    },
  };
}

function cellStyleTeamgenMembers() {
  return {
    css: {
      fontSize: "0.78rem",
      lineHeight: "1.4",
      whiteSpace: "normal",
      wordBreak: "break-word",
      verticalAlign: "middle",
      padding: "0.3rem 0.35rem",
      maxWidth: "14rem",
    },
  };
}

function cellStyleTeamgenCoach() {
  return {
    css: {
      fontSize: "0.78rem",
      whiteSpace: "normal",
      wordBreak: "break-word",
      verticalAlign: "middle",
      padding: "0.3rem 0.3rem",
      maxWidth: "6rem",
    },
  };
}

function cellStyleTeamgenTkind() {
  return {
    css: {
      verticalAlign: "middle",
      padding: "0.28rem 0.2rem",
      textAlign: "center",
    },
  };
}

function cellStyleTeamgenRoom() {
  return {
    css: {
      verticalAlign: "middle",
      padding: "0.3rem 0.35rem",
      maxWidth: "8rem",
      textAlign: "center",
    },
  };
}

function cellStyleTeamgenPrivilege() {
  return {
    css: {
      fontSize: "0.76rem",
      whiteSpace: "normal",
      wordBreak: "break-word",
      verticalAlign: "middle",
      padding: "0.3rem 0.3rem",
      maxWidth: "8rem",
    },
  };
}

function cellStyleTeamgenPassword() {
  return {
    css: {
      fontSize: "0.74rem",
      fontFamily:
        'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
      whiteSpace: "nowrap",
      verticalAlign: "middle",
      padding: "0.3rem 0.35rem",
    },
  };
}

function cellStyleTeamgenErrCol() {
  return { css: { padding: "0.28rem 0.2rem", verticalAlign: "middle" } };
}

function cellStyleTeamgenAct() {
  return { css: { padding: "0.28rem 0.2rem", verticalAlign: "middle" } };
}

// 从预览数据中删除
function TeamgenDeleteFromPreview(row) {
  if (!teamgen_PreviewData) return;

  // 从预览数据中移除
  const index = teamgen_PreviewData.findIndex(
    (team) => team.team_id === row.team_id
  );
  if (index > -1) {
    teamgen_PreviewData.splice(index, 1);

    // 重新检查重复team_id
    TeamgenCheckDuplicateTeamIds(teamgen_PreviewData);

    // 重新加载表格数据
    $("#teamgen_table").bootstrapTable("load", teamgen_PreviewData);

    // 重新计算错误统计
    const errorRows = teamgen_PreviewData.filter(
      (team) => team.validation_errors && team.validation_errors.length > 0
    );
    const warningRows = teamgen_PreviewData.filter(
      (team) => team.validation_warnings && team.validation_warnings.length > 0
    );

    // 显示错误和警告统计
    showErrorWarningSummary(errorRows, warningRows);

    window.alerty.success("已从预览数据中删除 / Removed from preview data");
  }
}

// 从服务器删除
function TeamgenDeleteFromServer(row) {
  $.post(
    "team_del_ajax?cid=" + teamgen_cid,
    { team_id: row.team_id },
    function (ret) {
      if (ret.code == 1) {
        teamgen_table.bootstrapTable("removeByUniqueId", row.row_index);
        window.alerty.success(
          `队伍 ${row.team_id} 删除成功`,
          `Team ${row.team_id} deleted successfully`
        );
      } else {
        window.alerty.error(ret.msg);
      }
    }
  );
}

// 导出密码条相关函数
/** 双栏「账号+密码」表：每页块含 title、x/y 页、表名、列标题共 headRows 行 */
function SheetSimple(team_list, ctitle, worksheet) {
  const per_subtable = 15;
  const per_page = per_subtable * 2;
  const font_size = 14;
  const headRows = 4;
  worksheet.columns = [{ width: 18 }, { width: 23 }, { width: 5 }];
  worksheet.columns = [...worksheet.columns, ...worksheet.columns];

  const totalRows = Math.max(1, Math.ceil(team_list.length / per_page));
  for (let i = 0; i < team_list.length; i++) {
    const team = team_list[i];
    const rowNumber = ((i % per_page) % per_subtable) + (headRows + 1);
    const columnOffset = i % per_page < per_subtable ? 0 : 3;
    const currentPage = Math.floor(i / per_page) + 1;
    const rowOffset = Math.floor(i / per_page) * (per_subtable + headRows);

    if (i % per_page === 0) {
      const titleRow = worksheet.addRow([`${ctitle}`]);
      worksheet.mergeCells(`A${titleRow.number}:E${titleRow.number}`);
      titleRow.height = 60;
      titleRow.alignment = {
        wrapText: true,
        vertical: "middle",
        horizontal: "center",
      };
      titleRow.font = { size: font_size };

      const pageRow = worksheet.addRow([`${currentPage}/${totalRows} 页`]);
      worksheet.mergeCells(`A${pageRow.number}:E${pageRow.number}`);
      pageRow.alignment = { horizontal: "center" };
      pageRow.font = { size: font_size };

      const headerRow = worksheet.addRow([`账号表 ${currentPage}/${totalRows}`]);
      worksheet.mergeCells(`A${headerRow.number}:E${headerRow.number}`);
      headerRow.alignment = { horizontal: "center" };
      headerRow.font = { size: font_size };

      const tableHeaderRow = worksheet.addRow([
        "账号",
        "密码",
        "",
        "账号",
        "密码",
      ]);
      tableHeaderRow.font = { bold: true, size: font_size };
      tableHeaderRow.eachCell(
        (cell) =>
          (cell.border = {
            top: { style: "thin" },
            left: { style: "thin" },
            bottom: { style: "thin" },
            right: { style: "thin" },
          })
      );
    }

    const row = worksheet.getRow(rowOffset + rowNumber);
    row.getCell(columnOffset + 1).value = team.team_id;
    row.getCell(columnOffset + 2).value = team.password;
    if (columnOffset == 0) {
      row.getCell(columnOffset + 3).value = "";
    }

    row.height = 38;
    row.alignment = {
      wrapText: true,
      vertical: "middle",
      horizontal: "center",
    };

    for (let j = 1; j <= 5; j++) {
      if (j == 3) {
        continue;
      }
      const cell = row.getCell(j);
      cell.font = {};
      if (j == 2 || j == 5) {
        cell.font = { name: "Courier New", bold: true };
      }
      cell.font.size = font_size;
      cell.border = {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" },
      };
    }
  }
}

/** 与「密码条-表格」SheetSimple 列宽之和一致，含分区表总宽须与此对齐以便打印 */
const TEAMGEN_SHEETSIMPLE_PRINT_WIDTH_SUM = 18 + 23 + 5 + 18 + 23;

/** 含分区双栏：左[分区+账号+密码] + 间隔 + 右[…]，总宽 = TEAMGEN_SHEETSIMPLE_PRINT_WIDTH_SUM */
function TeamgenPasswordStripWithZoneColumnDefs() {
  const gap = 5;
  const perHalf = (TEAMGEN_SHEETSIMPLE_PRINT_WIDTH_SUM - gap) / 2;
  const wZone = 8;
  const wAcct = 14;
  const wPwd = perHalf - wZone - wAcct;
  return [
    { width: wZone },
    { width: wAcct },
    { width: wPwd },
    { width: gap },
    { width: wZone },
    { width: wAcct },
    { width: wPwd },
  ];
}

/** 双栏「分区+账号+密码」：总列宽与 SheetSimple 相同；字号略小 + shrinkToFit 防打印裁切 */
function SheetSimpleWithZone(team_list, ctitle, worksheet) {
  const per_subtable = 15;
  const per_page = per_subtable * 2;
  const font_size = 10;
  const headRows = 4;
  const cellAlignPrint = {
    wrapText: true,
    vertical: "middle",
    horizontal: "center",
    shrinkToFit: true,
  };
  worksheet.columns = TeamgenPasswordStripWithZoneColumnDefs();

  const totalRows = Math.max(1, Math.ceil(team_list.length / per_page));
  for (let i = 0; i < team_list.length; i++) {
    const team = team_list[i];
    const rowNumber = ((i % per_page) % per_subtable) + (headRows + 1);
    const columnOffset = i % per_page < per_subtable ? 0 : 4;
    const currentPage = Math.floor(i / per_page) + 1;
    const rowOffset = Math.floor(i / per_page) * (per_subtable + headRows);

    if (i % per_page === 0) {
      const titleRow = worksheet.addRow([`${ctitle}`]);
      worksheet.mergeCells(`A${titleRow.number}:G${titleRow.number}`);
      titleRow.height = 52;
      titleRow.getCell(1).alignment = cellAlignPrint;
      titleRow.font = { size: font_size };

      const pageRow = worksheet.addRow([`${currentPage}/${totalRows} 页`]);
      worksheet.mergeCells(`A${pageRow.number}:G${pageRow.number}`);
      pageRow.getCell(1).alignment = cellAlignPrint;
      pageRow.font = { size: font_size };

      const headerRow = worksheet.addRow([`账号表 ${currentPage}/${totalRows}`]);
      worksheet.mergeCells(`A${headerRow.number}:G${headerRow.number}`);
      headerRow.getCell(1).alignment = cellAlignPrint;
      headerRow.font = { size: font_size };

      const tableHeaderRow = worksheet.addRow([
        "分区",
        "账号",
        "密码",
        "",
        "分区",
        "账号",
        "密码",
      ]);
      tableHeaderRow.font = { bold: true, size: font_size };
      tableHeaderRow.eachCell({ includeEmpty: true }, (cell) => {
        cell.alignment = cellAlignPrint;
        cell.border = {
          top: { style: "thin" },
          left: { style: "thin" },
          bottom: { style: "thin" },
          right: { style: "thin" },
        };
      });
    }

    const row = worksheet.getRow(rowOffset + rowNumber);
    const zoneText = (team.room != null && String(team.room).trim() !== "")
      ? String(team.room).trim()
      : "未分区";
    if (columnOffset === 0) {
      row.getCell(1).value = zoneText;
      row.getCell(2).value = team.team_id;
      row.getCell(3).value = team.password;
      row.getCell(4).value = "";
    } else {
      row.getCell(5).value = zoneText;
      row.getCell(6).value = team.team_id;
      row.getCell(7).value = team.password;
    }

    row.height = 34;

    for (let j = 1; j <= 7; j++) {
      if (j === 4) continue;
      const cell = row.getCell(j);
      cell.alignment = cellAlignPrint;
      cell.font = {};
      if (j === 3 || j === 7) {
        cell.font = { name: "Courier New", bold: true };
      }
      cell.font.size = font_size;
      cell.border = {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" },
      };
    }
  }
}

/**
 * 与 SheetSimple 同列方案；按分区连续排版，同一物理页内不出现两个分区；
 * 每页标题含「分区- x/y 页」（x/y 为该分区内页码）。
 */
function SheetSimpleByZone(team_list, ctitle, worksheet) {
  const per_subtable = 15;
  const per_page = per_subtable * 2;
  const font_size = 14;
  const headRows = 4;
  worksheet.columns = [{ width: 18 }, { width: 23 }, { width: 5 }];
  worksheet.columns = [...worksheet.columns, ...worksheet.columns];

  const grouped = TeamgenGroupRowsByZone(team_list);
  const entries = Array.from(grouped.entries()).sort((a, b) => {
    const ka = a[0];
    const kb = b[0];
    if (ka === "__empty__") return 1;
    if (kb === "__empty__") return -1;
    return String(ka).localeCompare(String(kb), "zh-Hans-CN");
  });

  for (const [zoneKey, zoneTeams] of entries) {
    const n = zoneTeams.length;
    if (n === 0) continue;
    const zoneLabel = TeamgenZoneExportLabel(zoneKey);
    const pagesInZone = Math.ceil(n / per_page);

    for (let p = 0; p < pagesInZone; p++) {
      const pageIndex = p + 1;
      const rTitle = worksheet.addRow([`${ctitle}`]);
      worksheet.mergeCells(`A${rTitle.number}:E${rTitle.number}`);
      rTitle.height = 60;
      rTitle.alignment = {
        wrapText: true,
        vertical: "middle",
        horizontal: "center",
      };
      rTitle.font = { size: font_size };

      const rZonePage = worksheet.addRow([
        `分区- ${pageIndex}/${pagesInZone} 页`,
      ]);
      worksheet.mergeCells(`A${rZonePage.number}:E${rZonePage.number}`);
      rZonePage.alignment = { horizontal: "center" };
      rZonePage.font = { size: font_size };

      const rAcct = worksheet.addRow([
        `账号表（${zoneLabel}） ${pageIndex}/${pagesInZone}`,
      ]);
      worksheet.mergeCells(`A${rAcct.number}:E${rAcct.number}`);
      rAcct.alignment = { horizontal: "center" };
      rAcct.font = { size: font_size };

      const tableHeaderRow = worksheet.addRow([
        "账号",
        "密码",
        "",
        "账号",
        "密码",
      ]);
      tableHeaderRow.font = { bold: true, size: font_size };
      tableHeaderRow.eachCell((cell) => {
        cell.border = {
          top: { style: "thin" },
          left: { style: "thin" },
          bottom: { style: "thin" },
          right: { style: "thin" },
        };
      });

      const start = p * per_page;
      const slice = zoneTeams.slice(start, start + per_page);
      for (let k = 0; k < slice.length; k++) {
        const team = slice[k];
        const rowNumber = (k % per_subtable) + (headRows + 1);
        const columnOffset = k < per_subtable ? 0 : 3;
        const blockStartRow = rTitle.number;
        const row = worksheet.getRow(blockStartRow + rowNumber - 1);
        row.getCell(columnOffset + 1).value = team.team_id;
        row.getCell(columnOffset + 2).value = team.password;
        if (columnOffset == 0) {
          row.getCell(columnOffset + 3).value = "";
        }
        row.height = 38;
        row.alignment = {
          wrapText: true,
          vertical: "middle",
          horizontal: "center",
        };
        for (let j = 1; j <= 5; j++) {
          if (j == 3) continue;
          const cell = row.getCell(j);
          cell.font = {};
          if (j == 2 || j == 5) {
            cell.font = { name: "Courier New", bold: true };
          }
          cell.font.size = font_size;
          cell.border = {
            top: { style: "thin" },
            left: { style: "thin" },
            bottom: { style: "thin" },
            right: { style: "thin" },
          };
        }
      }
    }
  }
}

function SheetPage(team_list, ctitle, worksheet) {
  const per_subtable = 15;
  const per_page = per_subtable * 2;
  // 单页密码
  worksheet.columns = [
    { width: 15 },
    { width: 30 },
    { width: 30 },
    { width: 15 },
    { width: 15 },
    { width: 5 },
  ];

  for (let i = 0; i < team_list.length; i++) {
    // 添加数据
    let row = worksheet.getRow(i + 1);
    let team = team_list[i];
    row.getCell(1).value = ` | ${team.team_id}`;
    row.getCell(2).value = ` | ${team.school}`;
    row.getCell(3).value = ` | ${team.name}`;
    row.getCell(4).value = ` | ${team.room}`;
    row.getCell(5).value = ` | ${team.password}`;
    row.getCell(5).font = { name: "Courier New", bold: true };
    row.height = 800; // 设置行高
    row.alignment = { wrapText: true, vertical: "top", horizontal: "left" };
  }
}

function SheetFull(team_list, ctitle, worksheet) {
  const per_subtable = 15;
  const per_page = per_subtable * 2;
  // 完整数据表
  worksheet.columns = [
    { width: 12 },
    { width: 20 },
    { width: 25 },
    { width: 10 },
    { width: 15 },
    { width: 5 },
  ];
  // 添加表头
  let tableHeaderRow = worksheet.addRow([
    "账号",
    "学校",
    "队名",
    "分区",
    "密码",
  ]);
  tableHeaderRow.font = { bold: true };
  tableHeaderRow.eachCell(
    (cell) =>
      (cell.border = {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" },
      })
  );
  for (let i = 0; i < team_list.length; i++) {
    let team = team_list[i];
    let row = worksheet.getRow(i + 2);
    row.getCell(1).value = team.team_id;
    row.getCell(2).value = team.school;
    row.getCell(3).value = team.name;
    row.getCell(4).value = team.room;
    row.getCell(5).value = team.password;
    row.getCell(5).font = { name: "Courier New", bold: true };
    row.height = 42;
    row.alignment = { wrapText: true };
    for (let j = 1; j <= 5; j++) {
      row.getCell(j).border = {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" },
      };
    }
  }
}

function BuildExportTeamgenWorkbook(team_list, ctitle) {
  const workbook = new ExcelJS.Workbook();
  SheetSimple(team_list, ctitle, workbook.addWorksheet("密码条-表格"));
  SheetSimpleWithZone(
    team_list,
    ctitle,
    workbook.addWorksheet("密码条-表格-含分区")
  );
  SheetSimpleByZone(
    team_list,
    ctitle,
    workbook.addWorksheet("密码条-表格-按分区")
  );
  SheetPage(
    team_list,
    ctitle,
    workbook.addWorksheet("密码条-分页（横向打印）")
  );
  SheetFull(team_list, ctitle, workbook.addWorksheet("完整数据"));
  return workbook;
}

async function ExportTeamgenTable(team_list, ctitle, opts) {
  opts = opts || {};
  const workbook = BuildExportTeamgenWorkbook(team_list, ctitle);
  const seg =
    opts.fileSuffix != null && String(opts.fileSuffix).trim() !== ""
      ? TeamgenSanitizeFilenameSegment(opts.fileSuffix)
      : "";
  const prefix = seg ? `账号表_${seg}` : "账号表";
  const filename = TeamgenGenerateFilename(prefix);

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filename}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}

function BuildStaffgenWorkbook(staff_list, ctitle) {
  const workbook = new ExcelJS.Workbook();
  StaffgenSheetSimple(staff_list, ctitle, workbook.addWorksheet("密码条-表格"));
  StaffgenSheetSimpleWithZone(
    staff_list,
    ctitle,
    workbook.addWorksheet("密码条-表格-含分区")
  );
  StaffgenSheetSimpleByZone(
    staff_list,
    ctitle,
    workbook.addWorksheet("密码条-表格-按分区")
  );
  StaffgenSheetPage(
    staff_list,
    ctitle,
    workbook.addWorksheet("密码条-分页（横向打印）")
  );
  StaffgenSheetFull(staff_list, ctitle, workbook.addWorksheet("完整数据"));
  return workbook;
}

/**
 * 按分区各生成一个 xlsx，用 zip.js 打成 zip 下载（与全站 js_zip 约定一致）
 */
async function TeamgenExportPasswordSheetsZipByZone(rows, ctitle) {
  if (!TeamgenEnsureZipJs()) {
    window.alerty.error(
      "缺少 zip 打包库，请刷新页面后重试",
      "Zip library missing; please refresh and try again"
    );
    return;
  }
  if (!Array.isArray(rows) || rows.length === 0) {
    window.alerty.error("没有可导出的数据 / No data to export");
    return;
  }
  const grouped = TeamgenGroupRowsByZone(rows);
  if (grouped.size === 0) {
    window.alerty.error("没有可导出的数据 / No data to export");
    return;
  }
  const now = new Date();
  const bundleStamp =
    now.getFullYear().toString() +
    (now.getMonth() + 1).toString().padStart(2, "0") +
    now.getDate().toString().padStart(2, "0") +
    now.getHours().toString().padStart(2, "0") +
    now.getMinutes().toString().padStart(2, "0") +
    now.getSeconds().toString().padStart(2, "0");
  const entries = Array.from(grouped.entries()).sort((a, b) => {
    const ka = a[0];
    const kb = b[0];
    if (ka === "__empty__") return 1;
    if (kb === "__empty__") return -1;
    return String(ka).localeCompare(String(kb), "zh-Hans-CN");
  });
  const usedInner = new Set();
  function uniqueInnerBase(displayLabel) {
    let base = TeamgenSanitizeFilenameSegment(displayLabel);
    if (!usedInner.has(base)) {
      usedInner.add(base);
      return base;
    }
    let i = 2;
    while (usedInner.has(`${base}_${i}`)) i++;
    const u = `${base}_${i}`;
    usedInner.add(u);
    return u;
  }
  const isStaff = String(window.TEAMGEN_CONFIG?.ttype || "0") === "1";
  const zipWriter = new zip.ZipWriter(new zip.BlobWriter("application/zip"));
  for (const [zoneKey, list] of entries) {
    const label = TeamgenZoneExportLabel(zoneKey);
    const innerSeg = uniqueInnerBase(label);
    const workbook = isStaff
      ? BuildStaffgenWorkbook(list, ctitle)
      : BuildExportTeamgenWorkbook(list, ctitle);
    const buffer = await workbook.xlsx.writeBuffer();
    const innerPrefix = isStaff
      ? `工作人员账号表_${innerSeg}`
      : `账号表_${innerSeg}`;
    const innerName = `${TeamgenGenerateFilename(innerPrefix, bundleStamp)}.xlsx`;
    await zipWriter.add(
      innerName,
      new zip.BlobReader(
        new Blob([buffer], {
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        })
      )
    );
  }
  const zipBlob = await zipWriter.close();
  const zipBase = TeamgenGenerateFilename(
    isStaff ? "工作人员账号表_分区分包" : "账号表_分区分包",
    bundleStamp
  );
  const zipUrl = URL.createObjectURL(zipBlob);
  const a = document.createElement("a");
  a.href = zipUrl;
  a.download = `${zipBase}.zip`;
  a.click();
  URL.revokeObjectURL(zipUrl);
}

// 通用事件绑定函数
function BindAllEvents(config) {
  const {
    parseDataFunc,
    downloadTemplateFunc,
    exportStandardFunc,
    importExcelFunc,
    exportTableFunc,
    resetModeMessage,
    resetModeMessageEn,
  } = config;

  // 解析数据按钮
  $("#parse_data_btn").on("click", function () {
    parseDataFunc();
  });

  // 下载模板按钮
  $("#download_template_btn").on("click", function () {
    downloadTemplateFunc();
  });

  // 导出标准数据按钮
  $("#export_standard_btn").on("click", function () {
    exportStandardFunc();
  });

  // Excel文件选择按钮
  $("#excel_file_btn").on("click", function () {
    $("#excel_file_input").click();
  });

  // Excel文件选择事件
  $("#excel_file_input").on("change", function () {
    const file = this.files[0];
    if (file) {
      importExcelFunc(file);
      // 清除input的val，确保同名文件能重新加载
      $(this).val("");
    }
  });

  // 重置队伍复选框事件
  $("#reset_team").on("change", function () {
    if (this.checked) {
      window.alerty.alert({
        message: resetModeMessage,
        message_en: resetModeMessageEn,
      });
    }
  });

  // 执行导入按钮事件
  $("#execute_import_btn").on("click", function () {
    config.executeImportFunc();
  });

  // 导出密码条：下拉菜单两项
  $("#export_teamgen_pageteam_item_single")
    .off("click.teamgenPwdExport")
    .on("click.teamgenPwdExport", function () {
      const data_list = teamgen_table.bootstrapTable("getData", {
        includeHiddenRows: true,
      });
      exportTableFunc(data_list, teamgen_ctitle);
    });
  $("#export_teamgen_pageteam_item_by_zone")
    .off("click.teamgenPwdExport")
    .on("click.teamgenPwdExport", function () {
      const data_list = teamgen_table.bootstrapTable("getData", {
        includeHiddenRows: true,
      });
      TeamgenExportPasswordSheetsZipByZone(data_list, teamgen_ctitle).catch(
        (e) => {
          try {
            console.error(e);
          } catch (e2) {}
          window.alerty.error(
            "分区打包导出失败: " + (e && e.message ? e.message : String(e)),
            "Zone pack export failed: " + (e && e.message ? e.message : String(e))
          );
        }
      );
    });
}

// 工作人员所有事件绑定
function StaffgenBindAllEvents() {
  BindAllEvents({
    parseDataFunc: StaffgenParseTextData,
    downloadTemplateFunc: StaffgenDownloadTemplate,
    exportStandardFunc: StaffgenExportStandard,
    importExcelFunc: StaffgenImportExcel,
    exportTableFunc: StaffgenExportTable,
    executeImportFunc: TeamgenExecuteImport,
    resetModeMessage:
      '已开启"重新生成所有工作人员"模式<br/>开启后将清除所有现有工作人员，重新生成新的工作人员数据<br/>如需关闭此模式，请点击开关',
    resetModeMessageEn:
      '"Regenerate All Staff" mode enabled<br/>When enabled, all existing staff will be cleared and new staff data will be generated<br/>To disable this mode, please click the switch',
  });
}

// 队伍所有事件绑定
function TeamgenBindAllEvents() {
  BindAllEvents({
    parseDataFunc: TeamgenParseTextData,
    downloadTemplateFunc: TeamgenDownloadTemplate,
    exportStandardFunc: TeamgenExportStandard,
    importExcelFunc: TeamgenImportExcel,
    exportTableFunc: ExportTeamgenTable,
    executeImportFunc: TeamgenExecuteImport,
    resetModeMessage:
      '已开启"重新生成所有队伍"模式<br/>开启后将清除所有现有队伍，重新生成新的队伍数据<br/>如需关闭此模式，请点击开关',
    resetModeMessageEn:
      '"Regenerate All Teams" mode enabled<br/>When enabled, all existing teams will be cleared and new team data will be generated<br/>To disable this mode, please click the switch',
  });
}

// 文本模板生成功能已移除，专注于Excel模板

// 工作人员模板生成
async function StaffgenDownloadTemplate() {
  try {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("工作人员信息");

    const staffHeaders = TeamgenVisibleHeaders(STAFFGEN_HEADERS);

    worksheet.columns = staffHeaders.map((h) => ({
      key: h.key,
      width: h.width,
    }));

    // 添加中英双语表头（样例列无表头）
    const headerRow = worksheet.addRow(
      staffHeaders.map((h) =>
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

    // 添加样例数据 - 按新顺序：账号、姓名、房间、权限、密码
    const sampleData = [
      // 核心管理员
      {
        team_id: "proctor",
        name: "裁判",
        room: "",
        privilege: "admin",
        password: "",
        groups: "",
        sample: "样例/Example",
      },
      // 观察员
      {
        team_id: "live",
        name: "直播",
        room: "",
        privilege: "watcher",
        password: "",
        groups: "",
        sample: "样例/Example",
      },
      // 打印管理员示例
      {
        team_id: "printA",
        name: "A区打印",
        room: "A",
        privilege: "printer",
        password: "",
        groups: TeamgenIsMultiGroup() ? "provincial" : "",
        sample: "样例/Example",
      },
      {
        team_id: "printB",
        name: "B区打印",
        room: "B",
        privilege: "printer",
        password: "",
        groups: TeamgenIsMultiGroup() ? "national" : "",
        sample: "样例/Example",
      },
      // 气球配送员示例
      {
        team_id: "balA0",
        name: "A区配送1",
        room: "A",
        privilege: "balloon_sender",
        password: "",
        groups: TeamgenIsMultiGroup() ? "provincial" : "",
        sample: "样例/Example",
      },
      {
        team_id: "balA1",
        name: "A区配送2",
        room: "A",
        privilege: "balloon_sender",
        password: "",
        groups: TeamgenIsMultiGroup() ? "provincial" : "",
        sample: "样例/Example",
      },
      {
        team_id: "balB0",
        name: "B区配送1",
        room: "B",
        privilege: "balloon_sender",
        password: "",
        groups: TeamgenIsMultiGroup() ? "national" : "",
        sample: "样例/Example",
      },
      // 气球管理员（可选填房间以限制仅管理该区域，与 balloon_sender 一致）
      {
        team_id: "bmanager",
        name: "气球管理",
        room: "A",
        privilege: "balloon_manager",
        password: "",
        groups: TeamgenIsMultiGroup() ? "provincial" : "",
        sample: "样例/Example",
      },
      // CCS API 只读账号（账号须仅字母数字，勿用下划线）
      {
        team_id: "ccsapi",
        name: "CCS接口",
        room: "",
        privilege: "ccs_reader",
        password: "",
        groups: "",
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

    const dataValFirstRow = 2;
    const dataValLastRow = 1000;
    const privilegeCol = TeamgenExcelColLetter(
      TeamgenExcelColumnIndexByKey(staffHeaders, "privilege")
    );

    // 权限下拉：子表 A 列为代码，B 列为说明
    const privilegeSheet = workbook.addWorksheet("权限列表");
    privilegeSheet.columns = [{ width: 18 }, { width: 42 }];
    privilegeSheet.addRow(["权限（填本列）", "说明 / Description"]);
    TEAMGEN_PRIVILEGE_CATALOG.forEach((row) => {
      privilegeSheet.addRow([row.code, row.desc]);
    });
    if (privilegeCol) {
      TeamgenApplyListColumnValidation(
        worksheet,
        privilegeCol,
        dataValFirstRow,
        dataValLastRow,
        `'权限列表'!$A$2:$A$${TEAMGEN_PRIVILEGE_CATALOG.length + 1}`,
        "无效权限",
        "请从下拉列表中选择一个权限（或手填与「权限列表」A 列一致的代码）"
      );
    }

    // 多分组时：分组候选子表（无下拉，主表可手填多个 group_id，逗号可用 `,` 或 `，`）
    const staffGroupRowsForSheet = TeamgenContestGroupsForTemplate().filter(
      (g) => TeamgenContestGroupCatalogId(g) !== ""
    );
    if (TeamgenIsMultiGroup() && staffGroupRowsForSheet.length > 0) {
      const groupSheet = workbook.addWorksheet("赛事归属");
      groupSheet.columns = [{ width: 16 }, { width: 36 }];
      groupSheet.addRow(["group_id（填本列）", "说明 / Description"]);
      staffGroupRowsForSheet.forEach((g) => {
        const id = TeamgenContestGroupCatalogId(g);
        const nm = TeamgenContestGroupCatalogName(g);
        const en = String(g.group_name_en ?? "").trim();
        const desc = [nm && nm !== id ? nm : "", en].filter(Boolean).join(" · ");
        groupSheet.addRow([id, desc || nm || id]);
      });
    }

    // 写入文件
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "工作人员信息模板.xlsx";
    a.click();
    URL.revokeObjectURL(url);

    window.alerty.success("模板下载成功 / Template downloaded successfully");
  } catch (error) {
    console.error("下载模板失败:", error);
    window.alerty.error("下载模板失败 / Template download failed");
  }
}

// 工作人员导出标准数据
function StaffgenExportStandard() {
  try {
    const staffData = $("#teamgen_table").bootstrapTable("getData", {
      includeHiddenRows: true,
    });
    if (!staffData || staffData.length === 0) {
      window.alerty.error("没有数据可导出 / No data to export");
      return;
    }

    StaffgenExportToExcel(staffData, "标准工作人员数据");

    window.alerty.success(
      "标准数据导出成功 / Standard data exported successfully"
    );
  } catch (error) {
    console.error("导出标准数据失败:", error);
    window.alerty.error("导出标准数据失败 / Standard data export failed");
  }
}

// 工作人员导出到Excel
async function StaffgenExportToExcel(staffData, filename) {
  try {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("工作人员数据");

    // 设置列定义（导出不包含样例列）
    const staffHeaders = TeamgenVisibleHeaders(STAFFGEN_HEADERS).filter(
      (h) => h.key !== "sample"
    );

    worksheet.columns = staffHeaders.map((h) => ({
      key: h.key,
      width: h.width,
    }));

    // 添加中英双语表头
    const headerRow = worksheet.addRow(
      staffHeaders.map((h) => `${h.header}\n${h.header_en}`)
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

    // 添加数据
    staffData.forEach((staff) => {
      const rowValues = [
        staff.team_id || "",
        staff.name || "",
        staff.room || "",
        staff.privilege || "",
        staff.password || "",
      ];
      if (TeamgenIsMultiGroup()) {
        rowValues.push(
          TeamgenNormalizeGroupsInputValue(staff.groups) || ""
        );
      }
      const excelRow = worksheet.addRow(rowValues);

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
    const exportFilename = TeamgenGenerateFilename(filename);

    // 导出文件
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${exportFilename}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error("导出Excel失败:", error);
    throw error;
  }
}

// 工作人员Excel导入
async function StaffgenImportExcel(file) {
  try {
    // 清理旧数据，避免干扰
    teamgen_PreviewData = [];
    teamgen_PreviewMode = false;

    const workbook = new ExcelJS.Workbook();
    const buffer = await file.arrayBuffer();
    await workbook.xlsx.load(buffer);

    const worksheet = workbook.getWorksheet(1); // 第一个工作表
    if (!worksheet) {
      throw new Error("Excel文件中没有找到工作表");
    }

    const staffData = [];
    const errors = [];
    const importStaffHeaders = StaffgenImportStaffHeaders();
    const scol = (key) => TeamgenExcelColumnIndexByKey(importStaffHeaders, key);

    worksheet.eachRow((row, rowNumber) => {
      try {
        const values = row.values;
        if (!values || values.length < 2) return;

        // 检查第一行是否为表头
        if (rowNumber === 1 && StaffgenIsHeaderRow(values)) {
          return; // 跳过表头行
        }

        // 检查是否为样例行（最后一列包含"样例"或"Example"）
        const lastColumnValue =
          TeamgenExtractCellValue(values[values.length - 1]) || "";
        if (
          lastColumnValue.includes("样例") ||
          lastColumnValue.includes("Example")
        ) {
          return; // 跳过样例行
        }

        // 提取原始数据（列顺序随是否多分组与表头一致）
        const staffInfo = {
          row_index: `staff_excel_${rowNumber}`, // 添加唯一索引
          team_id: TeamgenExtractCellValue(values[scol("team_id")]) || "",
          name: TeamgenExtractCellValue(values[scol("name")]) || "",
          room: TeamgenExtractCellValue(values[scol("room")]) || "",
          privilege: TeamgenExtractCellValue(values[scol("privilege")]) || "",
          password: TeamgenExtractCellValue(values[scol("password")]) || "",
          groups: TeamgenIsMultiGroup()
            ? TeamgenNormalizeGroupsInputValue(
                TeamgenExtractCellValue(values[scol("groups")])
              )
            : "",
          validation_errors: [],
        };

        // 处理密码（在staffInfo初始化后）
        if (!staffInfo.password || staffInfo.password.trim() === "") {
          staffInfo._password_auto_generated = true;
          staffInfo.password = StaffgenGeneratePassword(staffInfo.team_id);
        } else {
          staffInfo._password_auto_generated = false;
          staffInfo.password = staffInfo.password.trim();
        }

        // 验证数据
        const validationResult = StaffgenValidateStaffData(
          staffInfo,
          rowNumber
        );
        staffInfo.validation_errors = validationResult.errors;
        staffInfo.validation_warnings = validationResult.warnings;

        staffData.push(staffInfo);
      } catch (rowError) {
        console.error(`解析Excel第${rowNumber}行数据时出错:`, rowError);
        // 添加错误行到结果中
        staffData.push({
          row_index: `staff_excel_error_${rowNumber}`,
          team_id: "",
          name: `解析错误 (第${rowNumber}行)`,
          room: "",
          privilege: "",
          password: "",
          groups: "",
          validation_errors: [
            `Excel数据格式错误: ${escapeHtml(rowError.message)}`,
          ],
          validation_warnings: [],
        });
      }
    });

    if (staffData.length === 0) {
      window.alerty.error("没有有效的工作人员数据 / No valid staff data found");
      return;
    }

    // 显示预览
    TeamgenShowPreview(staffData, "excel", $("#reset_team").is(":checked"));
  } catch (error) {
    console.error("导入Excel失败:", error);
    window.alerty.error("导入Excel失败: " + error.message);
  }
}

// 工作人员导出表格
async function StaffgenExportTable(staff_list, ctitle, opts) {
  opts = opts || {};
  const workbook = BuildStaffgenWorkbook(staff_list, ctitle);
  const seg =
    opts.fileSuffix != null && String(opts.fileSuffix).trim() !== ""
      ? TeamgenSanitizeFilenameSegment(opts.fileSuffix)
      : "";
  const prefix = seg ? `工作人员账号表_${seg}` : "工作人员账号表";
  const filename = TeamgenGenerateFilename(prefix);

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filename}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}

// 工作人员简化密码表
function StaffgenSheetSimple(staff_list, ctitle, worksheet) {
  const per_subtable = 15;
  const per_page = per_subtable * 2;
  const font_size = 14;
  const headRows = 4;
  worksheet.columns = [{ width: 18 }, { width: 23 }, { width: 5 }];
  worksheet.columns = [...worksheet.columns, ...worksheet.columns];

  const totalRows = Math.max(1, Math.ceil(staff_list.length / per_page));
  for (let i = 0; i < staff_list.length; i++) {
    const staff = staff_list[i];
    const rowNumber = ((i % per_page) % per_subtable) + (headRows + 1);
    const columnOffset = i % per_page < per_subtable ? 0 : 3;
    const currentPage = Math.floor(i / per_page) + 1;
    const rowOffset = Math.floor(i / per_page) * (per_subtable + headRows);

    if (i % per_page === 0) {
      const titleRow = worksheet.addRow([`${ctitle}`]);
      worksheet.mergeCells(`A${titleRow.number}:E${titleRow.number}`);
      titleRow.height = 60;
      titleRow.alignment = {
        wrapText: true,
        vertical: "middle",
        horizontal: "center",
      };
      titleRow.font = { size: font_size };

      const pageRow = worksheet.addRow([`${currentPage}/${totalRows} 页`]);
      worksheet.mergeCells(`A${pageRow.number}:E${pageRow.number}`);
      pageRow.alignment = { horizontal: "center" };
      pageRow.font = { size: font_size };

      const headerRow = worksheet.addRow([
        `工作人员账号表 ${currentPage}/${totalRows}`,
      ]);
      worksheet.mergeCells(`A${headerRow.number}:E${headerRow.number}`);
      headerRow.alignment = { horizontal: "center" };
      headerRow.font = { size: font_size };

      const tableHeaderRow = worksheet.addRow([
        "账号",
        "密码",
        "",
        "账号",
        "密码",
      ]);
      tableHeaderRow.font = { bold: true, size: font_size };
      tableHeaderRow.eachCell(
        (cell) =>
          (cell.border = {
            top: { style: "thin" },
            left: { style: "thin" },
            bottom: { style: "thin" },
            right: { style: "thin" },
          })
      );
    }

    const row = worksheet.getRow(rowOffset + rowNumber);
    row.getCell(columnOffset + 1).value = staff.team_id;
    row.getCell(columnOffset + 2).value = staff.password;
    if (columnOffset == 0) {
      row.getCell(columnOffset + 3).value = "";
    }

    row.height = 38;
    row.alignment = {
      wrapText: true,
      vertical: "middle",
      horizontal: "center",
    };

    for (let j = 1; j <= 5; j++) {
      if (j == 3) {
        continue;
      }
      const cell = row.getCell(j);
      cell.font = {};
      if (j == 2 || j == 5) {
        cell.font = { name: "Courier New", bold: true };
      }
      cell.font.size = font_size;
      cell.border = {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" },
      };
    }
  }
}

function StaffgenSheetSimpleWithZone(staff_list, ctitle, worksheet) {
  const per_subtable = 15;
  const per_page = per_subtable * 2;
  const font_size = 10;
  const headRows = 4;
  const cellAlignPrint = {
    wrapText: true,
    vertical: "middle",
    horizontal: "center",
    shrinkToFit: true,
  };
  worksheet.columns = TeamgenPasswordStripWithZoneColumnDefs();

  const totalRows = Math.max(1, Math.ceil(staff_list.length / per_page));
  for (let i = 0; i < staff_list.length; i++) {
    const staff = staff_list[i];
    const rowNumber = ((i % per_page) % per_subtable) + (headRows + 1);
    const columnOffset = i % per_page < per_subtable ? 0 : 4;
    const currentPage = Math.floor(i / per_page) + 1;
    const rowOffset = Math.floor(i / per_page) * (per_subtable + headRows);

    if (i % per_page === 0) {
      const titleRow = worksheet.addRow([`${ctitle}`]);
      worksheet.mergeCells(`A${titleRow.number}:G${titleRow.number}`);
      titleRow.height = 52;
      titleRow.getCell(1).alignment = cellAlignPrint;
      titleRow.font = { size: font_size };

      const pageRow = worksheet.addRow([`${currentPage}/${totalRows} 页`]);
      worksheet.mergeCells(`A${pageRow.number}:G${pageRow.number}`);
      pageRow.getCell(1).alignment = cellAlignPrint;
      pageRow.font = { size: font_size };

      const headerRow = worksheet.addRow([
        `工作人员账号表 ${currentPage}/${totalRows}`,
      ]);
      worksheet.mergeCells(`A${headerRow.number}:G${headerRow.number}`);
      headerRow.getCell(1).alignment = cellAlignPrint;
      headerRow.font = { size: font_size };

      const tableHeaderRow = worksheet.addRow([
        "房间",
        "账号",
        "密码",
        "",
        "房间",
        "账号",
        "密码",
      ]);
      tableHeaderRow.font = { bold: true, size: font_size };
      tableHeaderRow.eachCell({ includeEmpty: true }, (cell) => {
        cell.alignment = cellAlignPrint;
        cell.border = {
          top: { style: "thin" },
          left: { style: "thin" },
          bottom: { style: "thin" },
          right: { style: "thin" },
        };
      });
    }

    const row = worksheet.getRow(rowOffset + rowNumber);
    const roomText =
      staff.room != null && String(staff.room).trim() !== ""
        ? String(staff.room).trim()
        : "未分区";
    if (columnOffset === 0) {
      row.getCell(1).value = roomText;
      row.getCell(2).value = staff.team_id;
      row.getCell(3).value = staff.password;
      row.getCell(4).value = "";
    } else {
      row.getCell(5).value = roomText;
      row.getCell(6).value = staff.team_id;
      row.getCell(7).value = staff.password;
    }

    row.height = 34;

    for (let j = 1; j <= 7; j++) {
      if (j === 4) continue;
      const cell = row.getCell(j);
      cell.alignment = cellAlignPrint;
      cell.font = {};
      if (j === 3 || j === 7) {
        cell.font = { name: "Courier New", bold: true };
      }
      cell.font.size = font_size;
      cell.border = {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" },
      };
    }
  }
}

function StaffgenSheetSimpleByZone(staff_list, ctitle, worksheet) {
  const per_subtable = 15;
  const per_page = per_subtable * 2;
  const font_size = 14;
  const headRows = 4;
  worksheet.columns = [{ width: 18 }, { width: 23 }, { width: 5 }];
  worksheet.columns = [...worksheet.columns, ...worksheet.columns];

  const grouped = TeamgenGroupRowsByZone(staff_list);
  const entries = Array.from(grouped.entries()).sort((a, b) => {
    const ka = a[0];
    const kb = b[0];
    if (ka === "__empty__") return 1;
    if (kb === "__empty__") return -1;
    return String(ka).localeCompare(String(kb), "zh-Hans-CN");
  });

  for (const [zoneKey, zoneStaff] of entries) {
    const n = zoneStaff.length;
    if (n === 0) continue;
    const zoneLabel = TeamgenZoneExportLabel(zoneKey);
    const pagesInZone = Math.ceil(n / per_page);

    for (let p = 0; p < pagesInZone; p++) {
      const pageIndex = p + 1;
      const rTitle = worksheet.addRow([`${ctitle}`]);
      worksheet.mergeCells(`A${rTitle.number}:E${rTitle.number}`);
      rTitle.height = 60;
      rTitle.alignment = {
        wrapText: true,
        vertical: "middle",
        horizontal: "center",
      };
      rTitle.font = { size: font_size };

      const rZonePage = worksheet.addRow([
        `分区- ${pageIndex}/${pagesInZone} 页`,
      ]);
      worksheet.mergeCells(`A${rZonePage.number}:E${rZonePage.number}`);
      rZonePage.alignment = { horizontal: "center" };
      rZonePage.font = { size: font_size };

      const rAcct = worksheet.addRow([
        `工作人员账号表（${zoneLabel}） ${pageIndex}/${pagesInZone}`,
      ]);
      worksheet.mergeCells(`A${rAcct.number}:E${rAcct.number}`);
      rAcct.alignment = { horizontal: "center" };
      rAcct.font = { size: font_size };

      const tableHeaderRow = worksheet.addRow([
        "账号",
        "密码",
        "",
        "账号",
        "密码",
      ]);
      tableHeaderRow.font = { bold: true, size: font_size };
      tableHeaderRow.eachCell((cell) => {
        cell.border = {
          top: { style: "thin" },
          left: { style: "thin" },
          bottom: { style: "thin" },
          right: { style: "thin" },
        };
      });

      const start = p * per_page;
      const slice = zoneStaff.slice(start, start + per_page);
      for (let k = 0; k < slice.length; k++) {
        const staff = slice[k];
        const rowNumber = (k % per_subtable) + (headRows + 1);
        const columnOffset = k < per_subtable ? 0 : 3;
        const blockStartRow = rTitle.number;
        const row = worksheet.getRow(blockStartRow + rowNumber - 1);
        row.getCell(columnOffset + 1).value = staff.team_id;
        row.getCell(columnOffset + 2).value = staff.password;
        if (columnOffset == 0) {
          row.getCell(columnOffset + 3).value = "";
        }
        row.height = 38;
        row.alignment = {
          wrapText: true,
          vertical: "middle",
          horizontal: "center",
        };
        for (let j = 1; j <= 5; j++) {
          if (j == 3) continue;
          const cell = row.getCell(j);
          cell.font = {};
          if (j == 2 || j == 5) {
            cell.font = { name: "Courier New", bold: true };
          }
          cell.font.size = font_size;
          cell.border = {
            top: { style: "thin" },
            left: { style: "thin" },
            bottom: { style: "thin" },
            right: { style: "thin" },
          };
        }
      }
    }
  }
}

// 工作人员分页密码
function StaffgenSheetPage(staff_list, ctitle, worksheet) {
  const per_subtable = 15;
  const per_page = per_subtable * 2;
  // 单页密码
  worksheet.columns = [
    { width: 15 },
    { width: 30 },
    { width: 30 },
    { width: 15 },
    { width: 15 },
    { width: 5 },
  ];

  for (let i = 0; i < staff_list.length; i++) {
    // 添加数据
    let row = worksheet.getRow(i + 1);
    let staff = staff_list[i];
    row.getCell(1).value = ` | ${staff.team_id}`;
    row.getCell(2).value = ` | ${staff.name}`;
    row.getCell(3).value = ` | ${staff.privilege}`;
    row.getCell(4).value = ` | ${staff.room}`;
    row.getCell(5).value = ` | ${staff.password}`;
    row.getCell(5).font = { name: "Courier New", bold: true };
    row.height = 800; // 设置行高
    row.alignment = { wrapText: true, vertical: "top", horizontal: "left" };
  }
}

// 工作人员完整数据表
function StaffgenSheetFull(staff_list, ctitle, worksheet) {
  const per_subtable = 15;
  const per_page = per_subtable * 2;
  // 完整数据表
  worksheet.columns = [
    { width: 12 },
    { width: 20 },
    { width: 25 },
    { width: 10 },
    { width: 15 },
    { width: 5 },
  ];
  // 添加表头
  let tableHeaderRow = worksheet.addRow([
    "账号",
    "姓名",
    "权限",
    "房间",
    "密码",
  ]);
  tableHeaderRow.font = { bold: true };
  tableHeaderRow.eachCell(
    (cell) =>
      (cell.border = {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" },
      })
  );
  for (let i = 0; i < staff_list.length; i++) {
    let staff = staff_list[i];
    let row = worksheet.getRow(i + 2);
    row.getCell(1).value = staff.team_id;
    row.getCell(2).value = staff.name;
    row.getCell(3).value = staff.privilege;
    row.getCell(4).value = staff.room;
    row.getCell(5).value = staff.password;
    row.getCell(5).font = { name: "Courier New", bold: true };
    row.height = 42;
    row.alignment = { wrapText: true };
    for (let j = 1; j <= 5; j++) {
      row.getCell(j).border = {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" },
      };
    }
  }
}

// ============================================================================
// 用户生成器功能 (User Generator)
// ============================================================================

let usergen_currentUserData = [];
let usergen_PreviewData = []; // 预览数据
let usergen_PreviewMode = false; // 是否为预览模式
let usergen_delete_infoed = false; // 删除提示状态

// 用户生成器初始化
function UsergenInit() {
  // 初始化页面状态 - 无数据状态
  usergen_PreviewMode = false;
  usergen_delete_infoed = false;

  // 设置初始工具栏状态 - 无数据时不显示标题
  $("#toolbar_title").html(
    '<span class="cn-text"><i class="bi bi-info-circle me-2"></i>请先解析数据</span><span class="en-text">Please parse data first</span>'
  );
  $("#toolbar_subtitle").hide();
  $("#execute_import_btn").hide();
  $("#error_summary").hide();

  // 隐藏导出按钮（无数据时不能导出）
  $("#export_standard_btn").hide();

  // 应用无数据状态样式
  $("#usergen_toolbar")
    .removeClass("toolbar-preview-data toolbar-actual-data")
    .addClass("toolbar-no-data");

  // 绑定所有事件
  BindTableEvents({
    tableSelector: "#usergen_table",
    deleteInfoedGetter: () => usergen_delete_infoed,
    previewModeGetter: () => usergen_PreviewMode,
    deleteFromPreviewFunc: UsergenDeleteFromPreview,
    deleteFromServerFunc: UsergenDeleteFromServer,
    deleteInfoedSetter: (value) => {
      usergen_delete_infoed = value;
    },
  });
  UsergenBindAllEvents();
}

// 解析用户文本数据
function UsergenParseTextData() {
  const userDescription = $("#user_description").val().trim();

  if (!userDescription) {
    window.alerty.error("请输入用户描述 / Please enter user description");
    return;
  }

  // 清理旧数据，避免干扰
  usergen_PreviewData = [];
  usergen_PreviewMode = false;

  // 解析数据（包含验证）
  const parsedData = UsergenParseTextDataInternal(userDescription);

  // 显示预览表（无论是否有错误）
  UsergenShowPreview(parsedData);
}

// 解析用户文本数据内部函数
function UsergenParseTextDataInternal(userDescription) {
  try {
    const userList = userDescription.split("\n");
    const parsedData = [];

    for (let i = 0; i < userList.length; i++) {
      try {
        const line = userList[i] || "";
        if (line.trim() === "") continue;

        // 只支持制表符分隔符
        const elements = line.split(/\t/).map((elem) => {
          if (typeof elem === "string") {
            return elem.trim();
          }
          return String(elem || "").trim();
        });

        // 检查第一行是否为表头
        if (i === 0 && UsergenIsHeaderRow(elements)) {
          continue; // 跳过表头行
        }

        const user = {
          row_index: `user_text_${i}`, // 添加唯一索引
          user_id: elements[0]?.trim() || "",
          nick: elements[1]?.trim() || "",
          school: elements[2]?.trim() || "",
          email: elements[3]?.trim() || "",
          password: elements[4]?.trim() || "",
          validation_errors: [],
        };

        // 处理密码（在user初始化后）
        if (!user.password || user.password === "") {
          user._password_auto_generated = true;
          user.password = UsergenGeneratePassword(user.user_id);
        } else {
          user._password_auto_generated = false;
        }

        // 验证数据
        const validationResult = UsergenValidateUserData(user, i + 1);
        user.validation_errors = validationResult.errors;
        user.validation_warnings = validationResult.warnings;

        parsedData.push(user);
      } catch (lineError) {
        console.error(`解析第${i + 1}行数据时出错:`, lineError);
        // 添加错误行到结果中
        parsedData.push({
          row_index: `user_text_error_${i}`,
          user_id: "",
          nick: `解析错误 (第${i + 1}行)`,
          school: "",
          email: "",
          password: "",
          validation_errors: [`数据格式错误: ${escapeHtml(lineError.message)}`],
          validation_warnings: [],
        });
      }
    }

    return parsedData;
  } catch (error) {
    console.error("解析用户文本数据时出错:", error);
    alerty.error("解析数据失败", `数据格式错误: ${escapeHtml(error.message)}`);
    return [];
  }
}

// 用户密码生成函数
function UsergenGeneratePassword(userId = "") {
  return GeneratePassword(userId, "ABCDEFGHJKMNPQRSTUVWXYZ23456789");
}

// 用户表头检测
function UsergenIsHeaderRow(row) {
  if (!row || row.length === 0) return false;

  // 用户表头特征关键词（中英文）
  const headerKeywords = [
    "用户ID",
    "User ID",
    "user_id",
    "姓名",
    "Name",
    "nick",
    "学校",
    "School",
    "school",
    "邮箱",
    "Email",
    "email",
    "密码",
    "Password",
    "password",
  ];

  // 检查行中是否包含表头关键词
  const rowText = row.join(" ").toLowerCase();
  let matchCount = 0;

  for (const keyword of headerKeywords) {
    if (rowText.includes(keyword.toLowerCase())) {
      matchCount++;
    }
  }

  // 如果匹配的关键词数量大于等于3，认为是表头
  return matchCount >= 3;
}

// 验证用户数据
function UsergenValidateUserData(user, rowIndex) {
  const errors = [];
  const warnings = [];

  // 验证用户ID（必填）
  if (!user.user_id) {
    errors.push(`用户ID不能为空`);
  } else if (user.user_id.length < 3) {
    errors.push(`用户ID至少3个字符`);
  } else if (!/^[a-zA-Z0-9]+$/.test(user.user_id)) {
    errors.push(`用户ID只能包含数字和字母`);
  }

  // 验证邮箱格式（如果提供）
  if (user.email && user.email.trim() !== "") {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(user.email)) {
      errors.push(`邮箱格式不正确`);
    }
  }

  // 检查密码是否为空（自动生成的情况）
  if (user._password_auto_generated) {
    warnings.push(`密码为空，将自动生成随机密码`);
  }

  return { errors, warnings };
}

// 从预览数据中删除用户
function UsergenDeleteFromPreview(row) {
  if (!usergen_PreviewData) return;

  // 从预览数据中移除
  const index = usergen_PreviewData.findIndex(
    (user) => user.user_id === row.user_id
  );
  if (index > -1) {
    usergen_PreviewData.splice(index, 1);

    // 重新检查重复user_id
    UsergenCheckDuplicateUserIds(usergen_PreviewData);

    // 重新加载表格数据
    $("#usergen_table").bootstrapTable("load", usergen_PreviewData);

    // 重新计算错误统计
    const errorRows = usergen_PreviewData.filter(
      (user) => user.validation_errors && user.validation_errors.length > 0
    );
    const warningRows = usergen_PreviewData.filter(
      (user) => user.validation_warnings && user.validation_warnings.length > 0
    );

    // 显示错误和警告统计
    showErrorWarningSummary(errorRows, warningRows);

    window.alerty.success("已从预览数据中删除 / Removed from preview data");
  }
}

// 从服务器删除用户
function UsergenDeleteFromServer(row) {
  // 调用后端删除接口
  $.post("user_del_ajax", { user_id: row.user_id }, function (ret) {
    if (ret.code == 1) {
      // 从表格中移除该行数据
      $("#usergen_table").bootstrapTable("remove", {
        field: "user_id",
        values: [row.user_id],
      });
      window.alerty.success(
        `用户 ${row.user_id} 删除成功`,
        `User ${row.user_id} deleted successfully`
      );
    } else {
      window.alerty.error(ret.msg);
    }
  });
}

// 显示预览数据
function UsergenShowPreview(data) {
  usergen_PreviewData = data;
  usergen_PreviewMode = true;

  // 检查user_id重复
  UsergenCheckDuplicateUserIds(data);

  // 显示错误信息列
  $("#usergen_table").bootstrapTable("showColumn", "validation_errors");

  // 更新工具栏
  $("#toolbar_title").html(
    '<span class="cn-text"><i class="bi bi-table me-2"></i>数据预览</span><span class="en-text">Data Preview</span>'
  );
  $("#toolbar_subtitle")
    .html(
      '请检查数据后执行导入<span class="en-text">Please review data before importing</span>'
    )
    .show();
  $("#execute_import_btn").show();

  // 隐藏导出按钮（预览模式下不适合导出）
  $("#export_standard_btn").hide();

  // 应用预览数据样式
  $("#usergen_toolbar")
    .removeClass("toolbar-actual-data toolbar-no-data")
    .addClass("toolbar-preview-data");

  // 计算错误和警告统计
  const errorRows = data.filter(
    (user) => user.validation_errors && user.validation_errors.length > 0
  );
  const warningRows = data.filter(
    (user) => user.validation_warnings && user.validation_warnings.length > 0
  );

  // 显示错误和警告统计
  showErrorWarningSummary(errorRows, warningRows);

  // 加载数据到表格
  $("#usergen_table").bootstrapTable("load", data);

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

// 检查重复的user_id
function UsergenCheckDuplicateUserIds(data) {
  const userIdCount = {};
  const duplicateUserIds = new Set();

  // 统计每个user_id的出现次数
  data.forEach((user, index) => {
    if (user.user_id && user.user_id.trim() !== "") {
      const userId = user.user_id.trim();
      if (!userIdCount[userId]) {
        userIdCount[userId] = [];
      }
      userIdCount[userId].push(index);

      if (userIdCount[userId].length > 1) {
        duplicateUserIds.add(userId);
      }
    }
  });

  // 为重复的user_id添加错误信息
  duplicateUserIds.forEach((userId) => {
    const indices = userIdCount[userId];
    indices.forEach((index) => {
      if (!data[index].validation_errors) {
        data[index].validation_errors = [];
      }
      data[index].validation_errors.push(
        `用户ID "${escapeHtml(userId)}" 重复，请修改为唯一值`
      );
    });
  });
}

// 执行导入
function UsergenExecuteImport() {
  if (!usergen_PreviewMode) return;

  // 过滤掉有错误的数据
  const validData = usergen_PreviewData.filter(
    (user) => user.validation_errors.length === 0
  );

  if (validData.length === 0) {
    window.alerty.error("没有有效数据可导入 / No valid data to import");
    return;
  }

  // 显示确认对话框
  window.alerty.confirm({
    message: `确认导入 ${validData.length} 条用户数据？`,
    message_en: `Confirm importing ${validData.length} user records?`,
    callback: function () {
      UsergenExecuteImportInternal(validData);
    },
  });
}

// 内部执行导入函数
function UsergenExecuteImportInternal(validData) {
  // 提交结构化数据
  const requestData = {
    user_list: JSON.stringify(validData),
  };

  $.ajax({
    url: $("#usergen_form").attr("action"),
    type: "POST",
    data: requestData,
    success: function (ret) {
      if (ret.code == 1) {
        // 切换到实际数据模式
        UsergenShowActualData(ret.data.rows);

        window.alerty.success(ret.msg);
      } else {
        window.alerty.error(ret.msg);
      }
    },
    error: function () {
      window.alerty.error("提交失败，请重试 / Submit failed, please try again");
    },
  });
}

// 显示实际数据
function UsergenShowActualData(data) {
  usergen_PreviewMode = false;

  // 隐藏错误信息列
  $("#usergen_table").bootstrapTable("hideColumn", "validation_errors");

  // 更新工具栏
  $("#toolbar_title").html(
    '<span class="cn-text"><i class="bi bi-database me-2"></i>实际数据</span><span class="en-text">Actual Data</span>'
  );
  $("#toolbar_subtitle").hide(); // 隐藏提示信息
  $("#execute_import_btn").hide();
  $("#error_summary").hide();

  // 显示导出按钮（实际数据模式下可以导出）
  $("#export_standard_btn").show();

  // 应用实际数据样式
  $("#usergen_toolbar")
    .removeClass("toolbar-preview-data toolbar-no-data")
    .addClass("toolbar-actual-data");

  // 加载实际数据
  $("#usergen_table").bootstrapTable("load", data);
}

// 用户导出标准数据
function UsergenExportStandard() {
  try {
    const userData = $("#usergen_table").bootstrapTable("getData", {
      includeHiddenRows: true,
    });
    if (!userData || userData.length === 0) {
      window.alerty.error("没有数据可导出 / No data to export");
      return;
    }

    UsergenExportToExcel(userData, "标准用户数据");

    window.alerty.success(
      "标准数据导出成功 / Standard data exported successfully"
    );
  } catch (error) {
    console.error("导出标准数据失败:", error);
    window.alerty.error("导出标准数据失败 / Standard data export failed");
  }
}

// 用户导出到Excel
async function UsergenExportToExcel(userData, filename) {
  try {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("用户数据");

    // 设置列定义
    const userHeaders = [
      { header: "用户ID", header_en: "User ID", key: "user_id", width: 15 },
      { header: "姓名", header_en: "Name", key: "nick", width: 20 },
      { header: "学校", header_en: "School", key: "school", width: 25 },
      { header: "邮箱", header_en: "Email", key: "email", width: 30 },
      { header: "密码", header_en: "Password", key: "password", width: 15 },
    ];

    worksheet.columns = userHeaders.map((h) => ({
      key: h.key,
      width: h.width,
    }));

    // 添加中英双语表头
    const headerRow = worksheet.addRow(
      userHeaders.map((h) => `${h.header}\n${h.header_en}`)
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

    // 添加数据
    userData.forEach((user) => {
      const excelRow = worksheet.addRow([
        user.user_id || "",
        user.nick || "",
        user.school || "",
        user.email || "",
        user.password || "",
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
    const exportFilename = UsergenGenerateFilename(filename);

    // 导出文件
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${exportFilename}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error("导出Excel失败:", error);
    throw error;
  }
}

// 生成文件名
function UsergenGenerateFilename(prefix) {
  // 生成时间戳 (YYYYMMDDHHMMSS)
  const now = new Date();
  const timestamp =
    now.getFullYear().toString() +
    (now.getMonth() + 1).toString().padStart(2, "0") +
    now.getDate().toString().padStart(2, "0") +
    now.getHours().toString().padStart(2, "0") +
    now.getMinutes().toString().padStart(2, "0") +
    now.getSeconds().toString().padStart(2, "0");

  return `${prefix}_${timestamp}`;
}

// 用户模板生成
async function UsergenDownloadTemplate() {
  try {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("用户信息");

    // 设置列定义
    const userHeaders = [
      { header: "用户ID", header_en: "User ID", key: "user_id", width: 15 },
      { header: "姓名", header_en: "Name", key: "nick", width: 20 },
      { header: "学校", header_en: "School", key: "school", width: 25 },
      { header: "邮箱", header_en: "Email", key: "email", width: 30 },
      { header: "密码", header_en: "Password", key: "password", width: 15 },
      { header: "", header_en: "", key: "sample", width: 15 }, // 样例列，无表头
    ];

    worksheet.columns = userHeaders.map((h) => ({
      key: h.key,
      width: h.width,
    }));

    // 添加中英双语表头
    const headerRow = worksheet.addRow(
      userHeaders.map((h) => `${h.header}\n${h.header_en}`)
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
        user_id: "202200000001",
        nick: "张三",
        school: "XX大学",
        email: "zhangsan@xx.edu.cn",
        password: "",
        sample: "样例/Example",
      },
      {
        user_id: "202200000002",
        nick: "李四",
        school: "YY大学",
        email: "lisi@yy.edu.cn",
        password: "123456",
        sample: "样例/Example",
      },
      {
        user_id: "student001",
        nick: "王五",
        school: "ZZ学院",
        email: "",
        password: "",
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
    a.download = "用户信息模板.xlsx";
    a.click();
    URL.revokeObjectURL(url);

    window.alerty.success("模板下载成功 / Template downloaded successfully");
  } catch (error) {
    console.error("下载模板失败:", error);
    window.alerty.error("下载模板失败 / Template download failed");
  }
}

// 用户Excel导入
async function UsergenImportExcel(file) {
  try {
    // 清理旧数据，避免干扰
    usergen_PreviewData = [];
    usergen_PreviewMode = false;

    const workbook = new ExcelJS.Workbook();
    const buffer = await file.arrayBuffer();
    await workbook.xlsx.load(buffer);

    const worksheet = workbook.getWorksheet(1); // 第一个工作表
    if (!worksheet) {
      throw new Error("Excel文件中没有找到工作表");
    }

    const userData = [];
    const errors = [];

    worksheet.eachRow((row, rowNumber) => {
      try {
        const values = row.values;
        if (!values || values.length < 2) return;

        // 检查第一行是否为表头
        if (rowNumber === 1 && UsergenIsHeaderRow(values)) {
          return; // 跳过表头行
        }

        // 检查是否为样例行（最后一列包含"样例"或"Example"）
        const lastColumnValue =
          TeamgenExtractCellValue(values[values.length - 1]) || "";
        if (
          lastColumnValue.includes("样例") ||
          lastColumnValue.includes("Example")
        ) {
          return; // 跳过样例行
        }

        // 提取原始数据，处理Excel格式问题
        const userInfo = {
          row_index: `user_excel_${rowNumber}`, // 添加唯一索引
          user_id: TeamgenExtractCellValue(values[1]) || "",
          nick: TeamgenExtractCellValue(values[2]) || "",
          school: TeamgenExtractCellValue(values[3]) || "",
          email: TeamgenExtractCellValue(values[4]) || "",
          password: TeamgenExtractCellValue(values[5]) || "",
          validation_errors: [],
        };

        // 处理密码（在userInfo初始化后）
        if (!userInfo.password || userInfo.password.trim() === "") {
          userInfo._password_auto_generated = true;
          userInfo.password = UsergenGeneratePassword(userInfo.user_id);
        } else {
          userInfo._password_auto_generated = false;
          userInfo.password = userInfo.password.trim();
        }

        // 验证数据
        const validationResult = UsergenValidateUserData(userInfo, rowNumber);
        userInfo.validation_errors = validationResult.errors;
        userInfo.validation_warnings = validationResult.warnings;

        userData.push(userInfo);
      } catch (rowError) {
        console.error(`解析Excel第${rowNumber}行数据时出错:`, rowError);
        // 添加错误行到结果中
        userData.push({
          row_index: `user_excel_error_${rowNumber}`,
          user_id: "",
          nick: `解析错误 (第${rowNumber}行)`,
          school: "",
          email: "",
          password: "",
          validation_errors: [
            `Excel数据格式错误: ${escapeHtml(rowError.message)}`,
          ],
          validation_warnings: [],
        });
      }
    });

    if (userData.length === 0) {
      window.alerty.error("没有有效的用户数据", "No valid user data found");
      return;
    }

    // 显示预览
    UsergenShowPreview(userData);
  } catch (error) {
    console.error("导入Excel失败:", error);
    window.alerty.error("导入Excel失败: " + error.message);
  }
}

// 用户所有事件绑定
function UsergenBindAllEvents() {
  BindAllEvents({
    parseDataFunc: UsergenParseTextData,
    downloadTemplateFunc: UsergenDownloadTemplate,
    exportStandardFunc: UsergenExportStandard,
    importExcelFunc: UsergenImportExcel,
    exportTableFunc: UsergenExportStandard, // 用户生成器没有专门的表格导出函数
    executeImportFunc: UsergenExecuteImport,
    resetModeMessage:
      "用户生成器不支持重置模式 / User generator does not support reset mode",
    resetModeMessageEn: "User generator does not support reset mode",
  });
}

// ============================================================================
// 队伍修改功能 (Team Modify)
// ============================================================================

// 初始化修改 Modal（只初始化一次）
let teamgenModifyModalInitialized = false;
let teamgenContestGroups = [];

function TeamgenLoadContestGroups() {
  const cid = window.TEAMGEN_CONFIG?.contest_id;
  if (!cid) return Promise.resolve([]);
  return $.getJSON(`/cpcsys/admin/contest_group_list_ajax?cid=${encodeURIComponent(cid)}`)
    .then((rows) => {
      teamgenContestGroups = Array.isArray(rows) ? rows : [];
      return teamgenContestGroups;
    })
    .catch(() => {
      teamgenContestGroups = [];
      return [];
    });
}

function TeamgenRenderGroupSelector(
  selectedGroupIds = [],
  wrapSel = "#team_modify_groups_wrap",
  selectSel = "#team_modify_group_ids"
) {
  const $wrap = $(wrapSel);
  const $select = $(selectSel);
  if (!$wrap.length || !$select.length) return;
  const groups = Array.isArray(teamgenContestGroups) ? teamgenContestGroups : [];
  if (groups.length <= 1) {
    $wrap.hide();
    $select.empty();
    return;
  }
  $select.empty();
  groups.forEach((g) => {
    const gid = String(g.group_id || "");
    if (!gid) return;
    const gname = String(g.group_name || gid);
    const op = document.createElement("option");
    op.value = gid;
    op.textContent = `${gname} (${gid})`;
    if (selectedGroupIds.includes(gid)) op.selected = true;
    $select.append(op);
  });
  $wrap.show();
}

/** 读取队伍修改弹窗中的地区值（含 CSGSelect 同步的 name=region 隐藏域） */
function TeamgenReadModifyModalRegion(form) {
  if (!form) return "";
  const hid = form.querySelector('input[type="hidden"][name="region"]');
  const sel = form.querySelector("#team_modify_region");
  let raw = "";
  if (hid && hid.value) raw = hid.value;
  else if (sel && sel.value) raw = sel.value;
  return TeamgenResolveRegionLabel(raw);
}

/**
 * 预览模式：将队伍弹窗写回 teamgen_PreviewData（不请求 team_modify_ajax）
 */
function TeamgenTryApplyTeamPreviewModify(form) {
  const LENGTH_LIMITS = {
    TEAM_NAME_MAX: 100,
    TEAM_NAME_EN_MAX: 120,
    SCHOOL_MAX: 100,
    MEMBER_MAX: 200,
    COACH_MAX: 50,
    ROOM_MAX: 20,
    PASSWORD_MIN: 6,
  };
  const currentRowIndex = $("#team_modify_form").data("currentRowIndex");
  if (!currentRowIndex) {
    window.alerty.error("无法定位预览行", "Cannot locate preview row");
    return;
  }
  const pw = ($("#team_modify_password").val() || "").trim();
  if (pw.length > 0 && pw.length < LENGTH_LIMITS.PASSWORD_MIN) {
    window.alerty.error(
      `新密码至少 ${LENGTH_LIMITS.PASSWORD_MIN} 位`,
      `Password at least ${LENGTH_LIMITS.PASSWORD_MIN} chars`
    );
    return;
  }
  const name = ($("#team_modify_name").val() || "").trim();
  const name_en = ($("#team_modify_name_en").val() || "").trim();
  const school = ($("#team_modify_school").val() || "").trim();
  const region = TeamgenReadModifyModalRegion(form);
  const tmember = ($("#team_modify_tmember").val() || "").trim();
  const coach = ($("#team_modify_coach").val() || "").trim();
  const room = ($("#team_modify_room").val() || "").trim();
  const tkind = String($("#team_modify_tkind").val() || "0");

  if (name.length > LENGTH_LIMITS.TEAM_NAME_MAX) {
    window.alerty.error("队名过长", "Team name too long");
    return;
  }
  if (name_en.length > LENGTH_LIMITS.TEAM_NAME_EN_MAX) {
    window.alerty.error("英文队名过长", "English name too long");
    return;
  }
  if (school.length > LENGTH_LIMITS.SCHOOL_MAX) {
    window.alerty.error("学校/组织过长", "School/org too long");
    return;
  }
  if (tmember.length > LENGTH_LIMITS.MEMBER_MAX) {
    window.alerty.error("队员字段过长", "Members field too long");
    return;
  }
  if (coach.length > LENGTH_LIMITS.COACH_MAX) {
    window.alerty.error("教练字段过长", "Coach field too long");
    return;
  }
  if (room.length > LENGTH_LIMITS.ROOM_MAX) {
    window.alerty.error("房间字段过长", "Room too long");
    return;
  }

  const idx = teamgen_PreviewData.findIndex(
    (r) => r.row_index === currentRowIndex
  );
  if (idx < 0) {
    window.alerty.error("预览数据已失效，请重新导入", "Preview stale, re-import");
    return;
  }
  const row = teamgen_PreviewData[idx];
  row.name = name;
  row.name_en = name_en;
  row.school = school;
  row.region = region;
  row.tmember = tmember;
  row.coach = coach;
  row.room = room;
  row.tkind = tkind;

  const gVals = $("#team_modify_group_ids").val();
  const gidArr = Array.isArray(gVals)
    ? gVals.map((x) => String(x).trim()).filter(Boolean)
    : gVals
      ? [String(gVals).trim()].filter(Boolean)
      : [];
  row.group_ids = gidArr;
  row.groups = gidArr.join(",");

  if (pw.length > 0) {
    row.password = pw;
    row._password_auto_generated = false;
  }

  const vr = TeamgenValidateTeamData(row, idx + 1);
  row.validation_errors = vr.errors;
  row.validation_warnings = vr.warnings;

  TeamgenCheckDuplicateTeamIds(teamgen_PreviewData);

  $("#teamgen_table").bootstrapTable("load", teamgen_PreviewData);
  const errorRows = teamgen_PreviewData.filter(
    (team) => team.validation_errors && team.validation_errors.length > 0
  );
  const warningRows = teamgen_PreviewData.filter(
    (team) => team.validation_warnings && team.validation_warnings.length > 0
  );
  showErrorWarningSummary(errorRows, warningRows);

  const modalEl = document.getElementById("teamModifyModal");
  const modal = modalEl ? bootstrap.Modal.getInstance(modalEl) : null;
  if (modal) modal.hide();
  window.alerty.success(
    "已更新预览数据（尚未导入）",
    "Preview updated (not imported yet)"
  );
}

/**
 * 预览模式：将赛务弹窗写回 teamgen_PreviewData
 */
function StaffgenTryApplyStaffPreviewModify() {
  const LENGTH_LIMITS = {
    NAME_MAX: 100,
    ROOM_MAX: 20,
    PASSWORD_MIN: 6,
  };
  const currentRowIndex = $("#staff_modify_form").data("currentRowIndex");
  if (!currentRowIndex) {
    window.alerty.error("无法定位预览行", "Cannot locate preview row");
    return;
  }
  const pw = ($("#staff_modify_password").val() || "").trim();
  if (pw.length > 0 && pw.length < LENGTH_LIMITS.PASSWORD_MIN) {
    window.alerty.error(
      `新密码至少 ${LENGTH_LIMITS.PASSWORD_MIN} 位`,
      `Password at least ${LENGTH_LIMITS.PASSWORD_MIN} chars`
    );
    return;
  }
  const name = ($("#staff_modify_name").val() || "").trim();
  const room = ($("#staff_modify_room").val() || "").trim();
  const privilege = ($("#staff_modify_privilege").val() || "").trim();

  if (name.length > LENGTH_LIMITS.NAME_MAX) {
    window.alerty.error("姓名过长", "Name too long");
    return;
  }
  if (room.length > LENGTH_LIMITS.ROOM_MAX) {
    window.alerty.error("房间字段过长", "Room too long");
    return;
  }

  const idx = teamgen_PreviewData.findIndex(
    (r) => r.row_index === currentRowIndex
  );
  if (idx < 0) {
    window.alerty.error("预览数据已失效，请重新导入", "Preview stale, re-import");
    return;
  }
  const row = teamgen_PreviewData[idx];
  row.name = name;
  row.room = room;
  row.privilege = privilege;

  const gVals = $("#staff_modify_group_ids").val();
  const gidArr = Array.isArray(gVals)
    ? gVals.map((x) => String(x).trim()).filter(Boolean)
    : gVals
      ? [String(gVals).trim()].filter(Boolean)
      : [];
  row.group_ids = gidArr;
  row.groups = gidArr.join(",");

  if (pw.length > 0) {
    row.password = pw;
    row._password_auto_generated = false;
  }

  const vr = StaffgenValidateStaffData(row, idx + 1);
  row.validation_errors = vr.errors;
  row.validation_warnings = vr.warnings;

  TeamgenCheckDuplicateTeamIds(teamgen_PreviewData);

  $("#teamgen_table").bootstrapTable("load", teamgen_PreviewData);
  const errorRows = teamgen_PreviewData.filter(
    (team) => team.validation_errors && team.validation_errors.length > 0
  );
  const warningRows = teamgen_PreviewData.filter(
    (team) => team.validation_warnings && team.validation_warnings.length > 0
  );
  showErrorWarningSummary(errorRows, warningRows);

  const modalEl = document.getElementById("staffModifyModal");
  const modal = modalEl ? bootstrap.Modal.getInstance(modalEl) : null;
  if (modal) modal.hide();
  window.alerty.success(
    "已更新预览数据（尚未导入）",
    "Preview updated (not imported yet)"
  );
}

function TeamgenInitModifyModal() {
  // 如果已经初始化过，直接返回
  if (teamgenModifyModalInitialized) {
    return;
  }

  // 监听 Modal 关闭事件，清理表单
  $("#teamModifyModal").on("hidden.bs.modal", function () {
    // 清理表单数据
    const form = document.querySelector("#team_modify_form");
    if (form) {
      form.reset();
    }
    $("#team_modify_team_id").val("");
    $("#team_modify_cid").val("");
    $("#team_modify_password").val("");
    $("#team_modify_group_ids").empty();
    $("#team_modify_groups_wrap").hide();

    // 清理 header 中的队伍ID显示
    $("#team_modify_header_team_id").html("");

    // 注意：不要清除 formValidationInitialized 标记
    // 表单验证只需要初始化一次，重复初始化会导致事件重复绑定
  });

  // 绑定提交按钮点击事件，触发表单提交
  // 因为按钮在 modal-footer 中，不在表单内，所以需要手动触发表单提交
  $(document).on("click", "#team_modify_submit_button", function (e) {
    e.preventDefault();
    e.stopPropagation();
    const form = document.querySelector("#team_modify_form");
    if (!form) return;
    if (
      teamgen_PreviewMode &&
      window.TEAMGEN_CONFIG?.action !== "contest_staffgen"
    ) {
      TeamgenTryApplyTeamPreviewModify(form);
      return;
    }
    form.requestSubmit();
  });

  // 标记已初始化
  teamgenModifyModalInitialized = true;
}

// 打开修改队伍信息 Modal
function TeamgenOpenModifyModal(rowIndex) {
  // 检查 Modal 元素是否存在（staffgen 页面可能没有这个 modal）
  const modalElement = document.getElementById("teamModifyModal");
  if (!modalElement) {
    alerty.error("修改功能不可用", "Modify function is not available");
    return;
  }

  // 获取行数据
  const tableData = $("#teamgen_table").bootstrapTable("getData");
  const row = tableData[rowIndex];

  if (!row) {
    alerty.error("无法获取队伍信息", "Unable to get team information");
    return;
  }

  // 保存当前行的 row_index，用于更新
  $("#team_modify_form").data("currentRowIndex", row.row_index);

  // 填充表单数据
  const teamId = row.team_id || "";
  $("#team_modify_team_id").val(teamId);
  $("#team_modify_cid").val(window.TEAMGEN_CONFIG?.contest_id || "");
  $("#team_modify_name").val(row.name || "");
  $("#team_modify_name_en").val(row.name_en || "");
  $("#team_modify_school").val(row.school || "");
  $("#team_modify_tmember").val(row.tmember || "");
  $("#team_modify_coach").val(row.coach || "");
  $("#team_modify_room").val(row.room || "");
  $("#team_modify_tkind").val(row.tkind || "0");
  $("#team_modify_password").val("");

  const rowGroupIds = Array.isArray(row.group_ids)
    ? row.group_ids.map((x) => String(x))
    : String(row.groups || "")
        .split(",")
        .map((x) => x.trim())
        .filter((x) => x.length > 0);

  // 更新 header 中的队伍ID显示
  if (teamId) {
    $("#team_modify_header_team_id").html(
      `<i class="bi bi-hash"></i> ${escapeHtml(teamId)}`
    );
  } else {
    $("#team_modify_header_team_id").html("");
  }

  // 国家/地区：选项异步加载，须在加载完成后回填（后端 teamgen_list_ajax 已含 region）
  TeamgenLoadRegionDataForModal(row.region || "");

  TeamgenLoadContestGroups().then(() => {
    TeamgenRenderGroupSelector(rowGroupIds);
    // 显示 Modal
    const modal = new bootstrap.Modal(modalElement);
    modal.show();
  });
  
  // 在 Modal 显示后初始化表单验证（确保表单在 DOM 中且可见）
  // 使用 setTimeout 确保 Modal 完全显示后再初始化
  setTimeout(() => {
    TeamgenInitModifyFormValidation();
  }, 100);
}

// ============================================================================
// 工作人员修改 Modal（StaffGen）
// ============================================================================

let staffgenModifyModalInitialized = false;

function StaffgenOpenModifyModal(rowIndexInTable) {
  const modalElement = document.getElementById("staffModifyModal");
  if (!modalElement) {
    window.alerty.error("修改功能不可用", "Modify function is not available");
    return;
  }

  const tableData = $("#teamgen_table").bootstrapTable("getData");
  const row = tableData[rowIndexInTable];

  if (!row) {
    window.alerty.error(
      "无法获取工作人员信息",
      "Unable to get staff information"
    );
    return;
  }

  $("#staff_modify_form").data("currentRowIndex", row.row_index);

  const teamId = row.team_id || "";
  $("#staff_modify_team_id").val(teamId);
  $("#staff_modify_cid").val(window.TEAMGEN_CONFIG?.contest_id || "");
  $("#staff_modify_name").val(row.name || "");
  $("#staff_modify_room").val(row.room || "");
  $("#staff_modify_privilege").val(row.privilege || "");
  $("#staff_modify_password").val("");

  if (teamId) {
    $("#staff_modify_header_team_id").html(
      `<i class="bi bi-hash"></i> ${escapeHtml(teamId)}`
    );
  } else {
    $("#staff_modify_header_team_id").html("");
  }

  const rowGroupIds = Array.isArray(row.group_ids)
    ? row.group_ids.map((x) => String(x))
    : String(row.groups || "")
        .split(",")
        .map((x) => x.trim())
        .filter((x) => x.length > 0);

  TeamgenLoadContestGroups().then(() => {
    TeamgenRenderGroupSelector(
      rowGroupIds,
      "#staff_modify_groups_wrap",
      "#staff_modify_group_ids"
    );
    const modal = new bootstrap.Modal(modalElement);
    modal.show();
  });

  setTimeout(() => StaffgenInitStaffModifyFormValidation(), 100);
}

function StaffgenInitModifyModal() {
  if (staffgenModifyModalInitialized) {
    return;
  }

  $("#staffModifyModal").on("hidden.bs.modal", function () {
    const form = document.querySelector("#staff_modify_form");
    if (form) {
      form.reset();
    }
    $("#staff_modify_team_id").val("");
    $("#staff_modify_cid").val("");
    $("#staff_modify_password").val("");
    $("#staff_modify_group_ids").empty();
    $("#staff_modify_groups_wrap").hide();
    $("#staff_modify_header_team_id").html("");
  });

  $(document).on("click", "#staff_modify_submit_button", function (e) {
    e.preventDefault();
    e.stopPropagation();
    if (teamgen_PreviewMode) {
      StaffgenTryApplyStaffPreviewModify();
      return;
    }
    const form = document.querySelector("#staff_modify_form");
    if (form) {
      form.requestSubmit();
    }
  });

  staffgenModifyModalInitialized = true;
}

function StaffgenInitStaffModifyFormValidation() {
  const form = document.querySelector("#staff_modify_form");
  if (!form) {
    setTimeout(() => StaffgenInitStaffModifyFormValidation(), 200);
    return;
  }
  if ($("#staff_modify_form").data("formValidationInitialized")) {
    return;
  }

  const LENGTH_LIMITS = {
    NAME_MAX: 100,
    ROOM_MAX: 20,
    PASSWORD_MIN: 6,
  };

  const submitButton = $("#staff_modify_submit_button");
  const submitButtonTexts = window.Bilingual
    ? window.Bilingual.getBilingualText(submitButton)
    : { chinese: "提交修改", english: "Submit Changes" };
  const submitButtonText = submitButtonTexts.chinese;
  const submitButtonEnText = submitButtonTexts.english;

  window.FormValidationTip.initCommonFormValidation(
    "#staff_modify_form",
    {
      name: {
        rules: { maxlength: LENGTH_LIMITS.NAME_MAX, required: true },
      },
      room: {
        rules: { maxlength: LENGTH_LIMITS.ROOM_MAX },
      },
      privilege: {
        rules: { required: true },
      },
      password: {
        rules: { minlength: LENGTH_LIMITS.PASSWORD_MIN },
      },
    },
    function (frm) {
      submitButton.prop("disabled", true);
      submitButton.text("Waiting...");

      const currentRowIndex = $("#staff_modify_form").data("currentRowIndex");

      $(frm).ajaxSubmit({
        dataType: "json",
        success: function (ret) {
          if (ret.code == 1) {
            const modalInst = bootstrap.Modal.getInstance(
              document.getElementById("staffModifyModal")
            );
            if (modalInst) {
              modalInst.hide();
            }

            if (currentRowIndex && ret.data) {
              const merged = Object.assign({}, ret.data, {
                row_index: currentRowIndex,
              });
              $("#teamgen_table").bootstrapTable("updateByUniqueId", {
                id: currentRowIndex,
                row: merged,
              });
            } else {
              TeamgenLoadServerData();
            }

            alerty.success("修改成功", "Modified successfully");
          } else {
            alerty.error(ret.msg || "修改失败", "Modify failed");
          }

          button_delay(
            submitButton,
            3,
            submitButtonText,
            null,
            submitButtonEnText
          );
          return false;
        },
        error: function () {
          alerty.error("网络错误，请重试", "Network error, please try again");

          button_delay(
            submitButton,
            3,
            submitButtonText,
            null,
            submitButtonEnText
          );
        },
      });
      return false;
    }
  );

  $("#staff_modify_form").data("formValidationInitialized", true);
}

/** 将队伍行中的 region 写入修改弹窗（与 CSGSelect / 普通 select 兼容） */
function TeamgenSetModifyModalRegion(regionValue) {
  const regionSelect = document.getElementById("team_modify_region");
  if (!regionSelect) return;

  const raw = (regionValue || "").trim();
  let regionText = "";
  let displayLabel = "";

  if (raw) {
    regionText = TeamgenParseRegion(raw);
    if (raw.includes(" / ")) {
      const cn = raw.split(" / ")[0].trim();
      if (cn) {
        regionText = TeamgenParseRegion(cn) || cn;
      }
    }
    displayLabel = TeamgenResolveRegionLabel(regionText) || regionText;
  }

  const apply = () => {
    if (window.CSGSelect && regionSelect.dataset.csgSelectId) {
      const selectInstance = window.CSGSelect.getInstance(
        regionSelect.dataset.csgSelectId
      );
      if (selectInstance) {
        if (!regionText) {
          selectInstance.setValue("", "");
        } else {
          selectInstance.setValue(regionText, displayLabel);
        }
        return;
      }
    }
    $(regionSelect).val(regionText);
  };

  apply();
}

// 加载地区数据到 Modal；regionValue 为当前行已有地区（加载完选项后回填）
function TeamgenLoadRegionDataForModal(regionValue) {
  const regionSelect = document.getElementById("team_modify_region");
  if (!regionSelect) return Promise.resolve();

  const applyRegion = () => TeamgenSetModifyModalRegion(regionValue);

  if (regionSelect.options.length > 1) {
    applyRegion();
    return Promise.resolve();
  }

  return fetch("/static/image/region_flag/region_mapping.json")
    .then((response) => response.json())
    .then((data) => {
      regionSelect.innerHTML = '<option value="">请选择国家/地区</option>';
      data.forEach((region) => {
        const option = document.createElement("option");
        option.value = region["中文简称"];
        option.textContent = `${region["中文简称"]} / ${region["英文简称"]}`;
        option.setAttribute("data-text-en", region["英文简称"]);
        regionSelect.appendChild(option);
      });

      return new Promise((resolve) => {
        const finish = () => {
          applyRegion();
          resolve();
        };
        if (window.CSGSelect) {
          setTimeout(() => {
            const selectInstance = window.CSGSelect.getInstance(
              regionSelect.dataset.csgSelectId
            );
            if (selectInstance) {
              selectInstance.loadOptions();
            }
            finish();
          }, 200);
        } else {
          finish();
        }
      });
    })
    .catch((error) => {
      console.error("加载国家/地区数据失败:", error);
      applyRegion();
    });
}

// 初始化修改表单验证
function TeamgenInitModifyFormValidation() {
  // 检查表单是否存在
  const form = document.querySelector("#team_modify_form");
  if (!form) {
    console.warn("Form #team_modify_form not found, retrying...");
    // 如果表单不存在，延迟重试
    setTimeout(() => {
      TeamgenInitModifyFormValidation();
    }, 200);
    return;
  }

  // 如果已经初始化过，直接返回，不要重复初始化
  if ($("#team_modify_form").data("formValidationInitialized")) {
    return;
  }

  // 使用FormValidationTip进行表单验证（所有依赖已全局引入）

  // 定义长度常量
  const LENGTH_LIMITS = {
    TEAM_NAME_MAX: 100,
    TEAM_NAME_EN_MAX: 120,
    SCHOOL_MAX: 100,
    REGION_MAX: 50,
    MEMBER_MAX: 200,
    COACH_MAX: 50,
    ROOM_MAX: 20,
    PASSWORD_MIN: 6,
  };

  const submitButton = $("#team_modify_submit_button");
  const submitButtonTexts = window.Bilingual
    ? window.Bilingual.getBilingualText(submitButton)
    : { chinese: "提交修改", english: "Submit Changes" };
  const submitButtonText = submitButtonTexts.chinese;
  const submitButtonEnText = submitButtonTexts.english;

  window.FormValidationTip.initCommonFormValidation(
    "#team_modify_form",
    {
      name: {
        rules: { maxlength: LENGTH_LIMITS.TEAM_NAME_MAX },
      },
      name_en: {
        rules: { maxlength: LENGTH_LIMITS.TEAM_NAME_EN_MAX },
      },
      school: {
        rules: { maxlength: LENGTH_LIMITS.SCHOOL_MAX },
      },
      region: {
        rules: { maxlength: LENGTH_LIMITS.REGION_MAX },
      },
      tmember: {
        rules: { maxlength: LENGTH_LIMITS.MEMBER_MAX },
      },
      coach: {
        rules: { maxlength: LENGTH_LIMITS.COACH_MAX },
      },
      room: {
        rules: { maxlength: LENGTH_LIMITS.ROOM_MAX },
      },
      password: {
        rules: { minlength: LENGTH_LIMITS.PASSWORD_MIN },
      },
    },
    function (form) {
      // 提交处理函数
      submitButton.prop("disabled", true);
      submitButton.text("Waiting...");

      // 获取当前行的 row_index
      const currentRowIndex = $("#team_modify_form").data("currentRowIndex");
      // 使用 ajaxSubmit，会自动使用 form 的 action
      $(form).ajaxSubmit({
        dataType: "json",
        success: function (ret) {
          if (ret.code == 1) {
            // 关闭 Modal
            const modal = bootstrap.Modal.getInstance(
              document.getElementById("teamModifyModal")
            );
            if (modal) {
              modal.hide();
            }

            // 更新表格中对应行的数据
            if (currentRowIndex && ret.data) {
              const teamInfo = Object.assign({}, ret.data, {
                row_index: currentRowIndex,
              });
              $("#teamgen_table").bootstrapTable("updateByUniqueId", {
                id: currentRowIndex,
                row: teamInfo,
              });
            } else {
              // 如果没有返回详细数据，刷新整个表格
              TeamgenLoadServerData();
            }

            alerty.success("修改成功", "Modified successfully");
          } else {
            alerty.error(ret.msg || "修改失败", "Modify failed");
          }

          // 恢复按钮状态
          button_delay(submitButton, 3, submitButtonText, null, submitButtonEnText);
          return false;
        },
        error: function () {
          alerty.error("网络错误，请重试", "Network error, please try again");

          // 恢复按钮状态
          button_delay(submitButton, 3, submitButtonText, null, submitButtonEnText);
        },
      });
      return false;
    }
  );

  // 标记已初始化
  $("#team_modify_form").data("formValidationInitialized", true);
}
