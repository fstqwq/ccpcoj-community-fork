// 账号生成器 JavaScript 逻辑 - examsys 版本
// 注意：PAGE_MODULE 常量在 ex_global.js 中定义

let teamgen_regionList = [];
let teamgen_regionMap = {
  byCode: {}, // 英文缩写 -> 地区对象
  byName: {}, // 中文简称 -> 地区对象
};
let teamgen_currentTeamData = [];
let teamgen_PreviewData = []; // 预览数据
let teamgen_PreviewMode = false; // 是否为预览模式

// 初始化
function TeamgenInit() {
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
  $("#export_teamgen_pageteam_btn").show();
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

// 解析文本数据
function TeamgenParseTextData() {
  const teamDescription = $("#team_description").val().trim();

  if (!teamDescription) {
    window.alerty.error("请输入账号描述 / Please enter account description");
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

// 解析文本数据内部函数 - examsys 格式
function TeamgenParseTextDataInternal(teamDescription) {
  try {
    const teamList = teamDescription.split("\n");
    const parsedData = [];
    const accountGenType = window.TEAMGEN_CONFIG?.account_gen_type || "student";
    const isProctor = accountGenType === "proctor";
    const isReviewer = accountGenType === "reviewer";

    for (let i = 0; i < teamList.length; i++) {
      try {
        const line = teamList[i] || "";
        if (line.trim() === "") continue;
        
        // examsys 支持制表符或#分隔
        const elements = line.split(/[#\t]/).map((elem) => {
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

        let team;
        if (isProctor || isReviewer) {
          // 监考/阅卷生成：team_id, name, school, room, password (5个字段，不需要tkind和privilege)
          team = {
            row_index: `text_${i}`, // 添加唯一索引
            team_id: elements[0]?.trim() || "",
            name: elements[1]?.trim() || "",
            school: elements[2]?.trim() || "",
            room: elements[3]?.trim() || "",
            tkind: 0, // 监考/阅卷不需要考生类型
            password: elements[4]?.trim() || "",
            privilege: isProctor ? "admin" : "reviewer", // 根据类型设置权限
            validation_errors: [],
          };
        } else {
          // 考生生成：team_id, name, school, room, tkind, password (6个字段，不需要privilege)
          team = {
            row_index: `text_${i}`, // 添加唯一索引
            team_id: elements[0]?.trim() || "",
            name: elements[1]?.trim() || "",
            school: elements[2]?.trim() || "",
            room: elements[3]?.trim() || "",
            tkind: TeamgenParseTkind(elements[4]?.trim() || "0"),
            password: elements[5]?.trim() || "",
            privilege: null, // 考生生成自动设置为null
            validation_errors: [],
          };
        }

        // 处理密码（在team初始化后）
        if (!team.password || team.password === "") {
          team._password_auto_generated = true;
          team.password = TeamgenGeneratePassword(team.team_id);
        } else {
          team._password_auto_generated = false;
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
          school: "",
          room: "",
          tkind: 0,
          password: "",
          privilege: null,
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

// 解析考生类型 - examsys 格式
function TeamgenParseTkind(tkindValue) {
  if (!tkindValue) return 0;

  const value = String(tkindValue).toLowerCase();

  // 如果是有效数字，直接返回
  const validTkinds = [0, 2, 10, 11, 12, 20, 21, 22];
  const intValue = parseInt(value);
  if (!isNaN(intValue) && validTkinds.includes(intValue)) {
    return intValue;
  }

  // 根据文本内容判断
  if (value.includes("初修")) {
    if (value.includes("缓考")) return 11;
    if (value.includes("补考")) return 12;
    return 10;
  }
  if (value.includes("重修")) {
    if (value.includes("缓考")) return 21;
    if (value.includes("补考")) return 22;
    return 20;
  }

  // 默认返回 0
  return 0;
}

// 解析权限 - examsys 格式
function TeamgenParsePrivilege(privilegeValue) {
  if (!privilegeValue) return null;
  
  const value = String(privilegeValue).toLowerCase();
  const validPrivileges = ['admin', 'reviewer'];
  
  if (validPrivileges.includes(value)) {
    return value;
  }
  
  return null;
}

// 格式化考生类型用于显示
function TeamgenFormatTkindForDisplay(tkind) {
  const tkindMap = {
    0: "正常考试",
    2: "打星",
    10: "初修:考试",
    11: "初修:缓考",
    12: "初修:补考",
    20: "重修:考试",
    21: "重修:缓考",
    22: "重修:补考",
  };
  return tkindMap[tkind] || "正常考试";
}

// 格式化考生类型用于导出
function TeamgenFormatTkindForExport(tkind) {
  const tkindMap = {
    0: "0 / 正常考试",
    10: "10 / 初修:考试",
    11: "11 / 初修:缓考",
    12: "12 / 初修:补考",
    20: "20 / 重修:考试",
    21: "21 / 重修:缓考",
    22: "22 / 重修:补考",
    2: "2 / 打星",
  };
  return tkindMap[tkind] || "0 / 正常考试";
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
  let combinedSeed = seed + id.length + (id.charCodeAt(0) || 0);
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

// 账号密码生成函数
function TeamgenGeneratePassword(teamId = "") {
  return GeneratePassword(teamId, "ABCDEFGHJKMNPQRSTUVWXYZ23456789");
}

// 生成文件名
function TeamgenGenerateFilename(prefix) {
  // 获取比赛信息
  const contestId = window.TEAMGEN_CONFIG?.contest_id || "unknown";
  let contestTitle = window.TEAMGEN_CONFIG?.contest_title || "unknown";

  // 过滤非合法文件名字符，空格替换为下划线
  contestTitle = contestTitle.replace(/[<>:"/\\|?*]/g, "").replace(/\s+/g, "_");

  // 生成时间戳 (YYYYMMDDHHMMSS)
  const now = new Date();
  const timestamp =
    now.getFullYear().toString() +
    (now.getMonth() + 1).toString().padStart(2, "0") +
    now.getDate().toString().padStart(2, "0") +
    now.getHours().toString().padStart(2, "0") +
    now.getMinutes().toString().padStart(2, "0") +
    now.getSeconds().toString().padStart(2, "0");

  return `${prefix}_cid${contestId}_${contestTitle}_${timestamp}`;
}

// 验证单个账号数据
function TeamgenValidateTeamData(team, rowIndex) {
  const errors = [];
  const warnings = [];
  const accountGenType = window.TEAMGEN_CONFIG?.account_gen_type || "student";
  const isProctor = accountGenType === "proctor";
  const isReviewer = accountGenType === "reviewer";

  // 验证账号ID（必填）
  if (!team.team_id) {
    errors.push(`账号ID不能为空`);
  } else if (team.team_id.length > 24) {
    errors.push(`账号ID过长（最多24字符）`);
  }

  // 验证姓名（必填）
  if (!team.name) {
    errors.push(`姓名不能为空`);
  } else if (team.name.length > 100) {
    errors.push(`姓名过长（最多100字符）`);
  }

  // 验证学校
  if (team.school && team.school.length > 100) {
    errors.push(`学校名称过长（最多100字符）`);
  }

  // 验证考生类型（仅考生生成需要）
  if (!isProctor && !isReviewer) {
    const validTkinds = [0, 2, 10, 11, 12, 20, 21, 22];
    if (!validTkinds.includes(team.tkind)) {
      errors.push(`考生类型无效（0正常/2打星/10-12初修/20-22重修）`);
    }
  }

  // 权限由代码自动设置，不需要验证

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
        `账号ID "${escapeHtml(teamId)}" 重复，请修改为唯一值`
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
  $("#export_teamgen_pageteam_btn").hide();
  // 预览模式也允许导出标准数据（便于用户下载后编辑“考场”等字段，再通过Excel导入）
  $("#export_standard_btn").show();

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

// ========== 导入班级（仅考生生成） ==========
function TeamgenImportStudentsFromClss() {
  const $table = $("#import_clss_table");
  if (!$table.length) return;

  const sels = $table.bootstrapTable("getSelections") || [];
  if (!sels.length) {
    window.alerty.error("请选择一个班级 / Please select a class");
    return;
  }
  const clss = sels[0] || {};
  const clss_id = parseInt(clss.clss_id || 0);
  if (!clss_id) {
    window.alerty.error("班级ID无效 / Invalid class id");
    return;
  }

  const url = window.TEAMGEN_CONFIG?.clss_student_list_url;
  if (!url) {
    window.alerty.error("缺少学生列表接口配置 / Missing student list API config");
    return;
  }

  $.ajax({
    url,
    type: "GET",
    data: { clss_id },
    success: function (ret) {
      if (!(ret && ret.code === 1)) {
        window.alerty.error(ret?.msg || "导入班级失败 / Import class failed");
        return;
      }

      const students = Array.isArray(ret.data) ? ret.data : [];
      if (!students.length) {
        window.alerty.warning(
          "班级无学生数据",
          "No students found in this class"
        );
      }

      // 组装为 teamgen 预览数据格式
      const teamData = students.map((s, idx) => {
        const team_id = (s.user_id != null) ? String(s.user_id) : "";
        const team = {
          row_index: `clss_${clss_id}_${idx}`,
          team_id,
          name: (s.nick != null) ? String(s.nick) : "",
          school: (s.school != null) ? String(s.school) : "",
          room: "",
          tkind: 0,
          password: "",
          privilege: null,
          validation_errors: [],
          validation_warnings: [],
        };

        // 生成密码（沿用页面密码种子逻辑）
        team._password_auto_generated = true;
        team.password = TeamgenGeneratePassword(team_id);

        // 验证
        const validationResult = TeamgenValidateTeamData(team, idx + 1);
        team.validation_errors = validationResult.errors;
        team.validation_warnings = validationResult.warnings;
        return team;
      });

      TeamgenShowPreview(teamData, "clss", $("#reset_team").is(":checked"));

      // 关闭 modal
      const modalEl = document.getElementById("importClssModal");
      if (modalEl) {
        bootstrap.Modal.getOrCreateInstance(modalEl).hide();
      }

      // 指引提示（按你要求：系统密码/导出标准数据再编辑考场）
      window.alerty.alert({
        message:
          '<div class="mb-2">已从班级导入学生到<strong>预览数据</strong>。</div>' +
          '<ul class="mb-0 ps-3">' +
          '<li class="mb-1">勾选 <span class="text-success fw-bold">“使用系统密码”</span> 后，学生可用其习题账号直接进入考试，无需输入密码。</li>' +
          '<li>你也可以点击 <span class="text-primary fw-bold">“导出标准数据”</span>，在 Excel 中编辑 <span class="text-primary fw-bold">“考场”</span> 等更多信息，然后通过 <span class="text-secondary fw-bold">“选择Excel文件”</span> 重新导入。</li>' +
          '</ul>',
        message_en:
          '<div class="mb-2">Students have been imported into <strong>preview data</strong>.</div>' +
          '<ul class="mb-0 ps-3">' +
          '<li class="mb-1">Enable <span class="text-success fw-bold">"Use System Password"</span> so students can enter the exam with their practice account without typing a password.</li>' +
          '<li>You can also click <span class="text-primary fw-bold">"Export Standard Data"</span>, edit fields like <span class="text-primary fw-bold">"Room"</span> in Excel, then re-import via <span class="text-secondary fw-bold">"Select Excel File"</span>.</li>' +
          '</ul>',
      });
    },
    error: function () {
      window.alerty.error("导入班级失败 / Import class failed");
    },
  });
}

// 执行导入
function TeamgenExecuteImport() {
  if (!teamgen_PreviewMode) return;

  // 过滤掉有错误的数据
  const validData = teamgen_PreviewData.filter(
    (team) => team.validation_errors.length === 0
  );

  if (validData.length === 0) {
    window.alerty.error("没有有效数据可导入 / No valid data to import");
    return;
  }

  // 显示确认对话框
  window.alerty.confirm({
    message: `确认导入 ${validData.length} 条账号数据？`,
    message_en: `Confirm importing ${validData.length} account records?`,
    callback: function () {
      TeamgenExecuteImportInternal(validData);
    },
  });
}

// 内部执行导入函数
function TeamgenExecuteImportInternal(validData) {
  const resetTeam = $("#reset_team").is(":checked");
  const useSystemPass = $("#use_system_pass").is(":checked");

  // 提交结构化数据
  const accountGenType = window.TEAMGEN_CONFIG?.account_gen_type || "student";
  const requestData = {
    team_list: JSON.stringify(validData),
    reset_team: resetTeam,
    use_system_pass: useSystemPass,
    password_seed: $("#password_seed").val() || 0,
    account_gen_type: accountGenType, // 传递生成类型
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
        // 导入成功后，重新从服务器加载全部数据（而不是只显示刚导入的数据）
        // 这样可以避免用户误解之前的数据被删除了
        TeamgenLoadServerData();
        
        // 切换到实际数据模式（不传入数据，让TeamgenLoadServerData加载）
        teamgen_PreviewMode = false;
        
        // 隐藏错误信息列
        $("#teamgen_table").bootstrapTable("hideColumn", "validation_errors");
        
        // 更新工具栏
        $("#toolbar_title").html(
          '<span class="cn-text"><i class="bi bi-database me-2"></i>实际数据</span><span class="en-text">Actual Data</span>'
        );
        $("#toolbar_subtitle").hide();
        $("#preview_import_tip").hide();
        $("#execute_import_btn").hide();
        $("#error_summary").hide();
        
        // 显示导出按钮
        $("#export_teamgen_pageteam_btn").show();
        $("#export_standard_btn").show();
        
        // 应用实际数据样式
        $("#teamgen_toolbar")
          .removeClass("toolbar-preview-data")
          .addClass("toolbar-actual-data");

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
  
  // 确保每行数据都有 row_index（用于删除时定位）
  if (data && Array.isArray(data)) {
    data.forEach((row, index) => {
      if (!row.row_index) {
        row.row_index = `server_${row.team_id}_${index}`;
      }
    });
  }

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
  $("#export_teamgen_pageteam_btn").show();
  $("#export_standard_btn").show();

  // 应用实际数据样式
  $("#teamgen_toolbar")
    .removeClass("toolbar-preview-data")
    .addClass("toolbar-actual-data");

  // 加载实际数据
  $("#teamgen_table").bootstrapTable("load", data);
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

    TeamgenExportToExcel(teamData, "标准账号数据");

    window.alerty.success(
      "标准数据导出成功 / Standard data exported successfully"
    );
  } catch (error) {
    console.error("导出标准数据失败:", error);
    window.alerty.error("导出标准数据失败 / Standard data export failed");
  }
}

// 下载模板
async function TeamgenDownloadTemplate() {
  try {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("账号信息");
    const accountGenType = window.TEAMGEN_CONFIG?.account_gen_type || "student";
    const isProctor = accountGenType === "proctor";
    const isReviewer = accountGenType === "reviewer";

    // 设置列定义 - 根据类型不同
    let teamHeaders;
    if (isProctor || isReviewer) {
      // 监考/阅卷生成：不需要考生类型和权限列
      teamHeaders = [
        { header: "账号", header_en: "Account ID", key: "team_id", width: 15 },
        { header: "姓名", header_en: "Name", key: "name", width: 20 },
        { header: "学校/学院/班级", header_en: "School/Class", key: "school", width: 25 },
        { header: "考场", header_en: "Room", key: "room", width: 15 },
        { header: "密码", header_en: "Password", key: "password", width: 15 },
        { header: "", header_en: "", key: "sample", width: 15 }, // 样例列，无表头
      ];
    } else {
      // 考生生成：不需要权限列（权限由代码自动设置为null）
      teamHeaders = [
        { header: "账号", header_en: "Account ID", key: "team_id", width: 15 },
        { header: "姓名", header_en: "Name", key: "name", width: 20 },
        { header: "学校/学院/班级", header_en: "School/Class", key: "school", width: 25 },
        { header: "考场", header_en: "Room", key: "room", width: 15 },
        { header: "考生类型", header_en: "Exam Type", key: "tkind", width: 20 },
        { header: "密码", header_en: "Password", key: "password", width: 15 },
        { header: "", header_en: "", key: "sample", width: 15 }, // 样例列，无表头
      ];
    }

    worksheet.columns = teamHeaders.map((h) => ({
      key: h.key,
      width: h.width,
    }));

    // 添加中英双语表头（样例列使用空字符串）
    const headerRow = worksheet.addRow(
      teamHeaders.map((h) =>
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

    // 添加样例数据
    let sampleData;
    if (isProctor) {
      // 监考生成样例数据 - 使用8位数字工号格式
      sampleData = [
        {
          team_id: "20201234",
          name: "王老师",
          school: "计算机学院",
          room: "C5-360",
          password: "",
          sample: "样例/Example",
        },
        {
          team_id: "20205678",
          name: "陈老师",
          school: "软件工程学院",
          room: "C5-361",
          password: "123456",
          sample: "样例/Example",
        },
      ];
    } else if (isReviewer) {
      // 阅卷生成样例数据 - 使用8位数字教师账号，学校/考场可以为空
      sampleData = [
        {
          team_id: "20201234",
          name: "赵老师",
          school: "计算机学院",
          room: "C5-360",
          password: "",
          sample: "样例/Example",
        },
        {
          team_id: "20205678",
          name: "钱老师",
          school: "",
          room: "",
          password: "123456",
          sample: "样例/Example",
        },
      ];
    } else {
      // 考生生成样例数据（不需要权限字段）
      sampleData = [
        {
          team_id: "202000000000",
          name: "张三",
          school: "计算机2003",
          room: "C5-360",
          tkind: "0",
          password: "",
          sample: "样例/Example",
        },
        {
          team_id: "202000000001",
          name: "李四",
          school: "软件工程2001",
          room: "C5-361",
          tkind: "10",
          password: "123456",
          sample: "样例/Example",
        },
        {
          team_id: "202000000002",
          name: "王五",
          school: "网络工程2002",
          room: "",
          tkind: "11",
          password: "",
          sample: "样例/Example",
        },
      ];
    }

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

    // 根据类型设置数据验证
    if (!isProctor && !isReviewer) {
      // 考生生成：设置考生类型下拉列表
      const tkindSheet = workbook.addWorksheet("考生类型");
      tkindSheet.addRow(["考生类型"]);
      tkindSheet.addRow(["0 / 正常考试"]);
      tkindSheet.addRow(["10 / 初修:考试"]);
      tkindSheet.addRow(["11 / 初修:缓考"]);
      tkindSheet.addRow(["12 / 初修:补考"]);
      tkindSheet.addRow(["20 / 重修:考试"]);
      tkindSheet.addRow(["21 / 重修:缓考"]);
      tkindSheet.addRow(["22 / 重修:补考"]);
      tkindSheet.addRow(["2 / 打星"]);

      // 设置考生类型数据验证（从第6行开始，跳过表头和样例行）
      for (let i = 6; i <= 1000; i++) {
        worksheet.getCell(`E${i}`).dataValidation = {
          type: "list",
          allowBlank: true,
          formulae: [`'考生类型'!$A$2:$A$9`],
          showErrorMessage: true,
          errorStyle: "error",
          errorTitle: "无效考生类型",
          error: "请从下拉列表中选择一个考生类型",
        };
      }
    }
    // 权限由代码自动处理，不需要在模板中设置

    // 写入文件
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "账号信息模板.xlsx";
    a.click();
    URL.revokeObjectURL(url);

    window.alerty.success("模板即将开始下载 / Template will start downloading");
  } catch (error) {
    console.error("下载模板失败:", error);
    window.alerty.error("下载模板失败 / Template download failed");
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

    worksheet.eachRow((row, rowNumber) => {
      try {
        const values = row.values;
        if (!values || values.length < 2) return;

        // 检查第一行是否为表头
        if (rowNumber === 1 && TeamgenIsHeaderRow(values)) {
          return; // 跳过表头行
        }

        // 检查是否为样例行（最后一列包含"样例"或"Example"）
        const lastColumnValue = TeamgenExtractCellValue(values[values.length - 1]) || "";
        if (
          lastColumnValue.includes("样例") ||
          lastColumnValue.includes("Example")
        ) {
          return; // 跳过样例行
        }

        // 提取原始数据，处理Excel格式问题 - 根据类型不同
        const accountGenType = window.TEAMGEN_CONFIG?.account_gen_type || "student";
        const isProctor = accountGenType === "proctor";
        const isReviewer = accountGenType === "reviewer";
        
        let teamInfo;
        if (isProctor || isReviewer) {
          // 监考/阅卷生成：team_id, name, school, room, password (5个字段)
          teamInfo = {
            row_index: `excel_${rowNumber}`, // 添加唯一索引
            team_id: TeamgenExtractCellValue(values[1]) || "",
            name: TeamgenExtractCellValue(values[2]) || "",
            school: TeamgenExtractCellValue(values[3]) || "",
            room: TeamgenExtractCellValue(values[4]) || "",
            tkind: 0, // 监考/阅卷不需要考生类型
            password: TeamgenExtractCellValue(values[5]) || "",
            privilege: isProctor ? "admin" : "reviewer", // 根据类型设置权限
            validation_errors: [],
          };
        } else {
          // 考生生成：team_id, name, school, room, tkind, password (6个字段，不需要privilege)
          teamInfo = {
            row_index: `excel_${rowNumber}`, // 添加唯一索引
            team_id: TeamgenExtractCellValue(values[1]) || "",
            name: TeamgenExtractCellValue(values[2]) || "",
            school: TeamgenExtractCellValue(values[3]) || "",
            room: TeamgenExtractCellValue(values[4]) || "",
            tkind: TeamgenParseTkind(TeamgenExtractCellValue(values[5]) || "0"),
            password: TeamgenExtractCellValue(values[6]) || "",
            privilege: null, // 考生生成自动设置为null
            validation_errors: [],
          };
        }

        // 处理密码（在teamInfo初始化后）
        if (!teamInfo.password || teamInfo.password.trim() === "") {
          teamInfo._password_auto_generated = true;
          teamInfo.password = TeamgenGeneratePassword(teamInfo.team_id);
        } else {
          teamInfo._password_auto_generated = false;
          teamInfo.password = teamInfo.password.trim();
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
          school: "",
          room: "",
          tkind: 0,
          password: "",
          privilege: null,
          validation_errors: [
            `Excel数据格式错误: ${escapeHtml(rowError.message)}`,
          ],
          validation_warnings: [],
        });
      }
    });

    if (teamData.length === 0) {
      window.alerty.error("没有有效的账号数据 / No valid account data found");
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

// 导出到Excel
async function TeamgenExportToExcel(teamData, filename) {
  try {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("账号数据");
    const accountGenType = window.TEAMGEN_CONFIG?.account_gen_type || "student";
    const isProctor = accountGenType === "proctor";
    const isReviewer = accountGenType === "reviewer";

    // 设置列定义（不包含样例列和权限列）
    let exportHeaders;
    if (isProctor || isReviewer) {
      // 监考/阅卷生成：不需要考生类型和权限列
      exportHeaders = [
        { header: "账号", header_en: "Account ID", key: "team_id", width: 15 },
        { header: "姓名", header_en: "Name", key: "name", width: 20 },
        { header: "学校/学院/班级", header_en: "School/Class", key: "school", width: 25 },
        { header: "考场", header_en: "Room", key: "room", width: 15 },
        { header: "密码", header_en: "Password", key: "password", width: 15 },
      ];
    } else {
      // 考生生成：不需要权限列
      exportHeaders = [
        { header: "账号", header_en: "Account ID", key: "team_id", width: 15 },
        { header: "姓名", header_en: "Name", key: "name", width: 20 },
        { header: "学校/学院/班级", header_en: "School/Class", key: "school", width: 25 },
        { header: "考场", header_en: "Room", key: "room", width: 15 },
        { header: "考生类型", header_en: "Exam Type", key: "tkind", width: 20 },
        { header: "密码", header_en: "Password", key: "password", width: 15 },
      ];
    }

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
      let excelRow;
      if (isProctor || isReviewer) {
        // 监考/阅卷生成：不包含考生类型和权限
        excelRow = worksheet.addRow([
          team.team_id || "",
          team.name || "",
          team.school || "",
          team.room || "",
          team.password || "",
        ]);
      } else {
        // 考生生成：包含考生类型，但不包含权限
        const tkindFormatted = TeamgenFormatTkindForExport(team.tkind);
        excelRow = worksheet.addRow([
          team.team_id || "",
          team.name || "",
          team.school || "",
          team.room || "",
          tkindFormatted,
          team.password || "",
        ]);
      }

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

// 检测是否为表头行
function TeamgenIsHeaderRow(row) {
  if (!row || row.length === 0) return false;

  // 表头特征关键词（中英文）
  const headerKeywords = [
    "账号",
    "Account ID",
    "team_id",
    "姓名",
    "Name",
    "name",
    "学校",
    "School",
    "school",
    "考场",
    "Room",
    "room",
    "类型",
    "Type",
    "tkind",
    "密码",
    "Password",
    "password",
    "权限",
    "Privilege",
    "privilege",
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

function FormatterExamTkind(value, row, index, field) {
  const tkindMap = {
    0: '<span class="badge bg-success">正常考试</span>',
    2: '<span class="badge bg-warning">打星</span>',
    10: '<span class="badge bg-primary">初修:考试</span>',
    11: '<span class="badge bg-warning">初修:缓考</span>',
    12: '<span class="badge bg-danger">初修:补考</span>',
    20: '<span class="badge bg-danger">重修:考试</span>',
    21: '<span class="badge bg-warning">重修:缓考</span>',
    22: '<span class="badge bg-danger">重修:补考</span>',
  };
  return (
    tkindMap[value] ||
    '<span class="badge bg-secondary">未知</span>'
  );
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

// 格式化密码列
function FormatterPassword(value, row, index, field) {
  if (!value || value === '' || value === null) {
    return '<span class="text-muted">-</span>';
  }
  if (value === '[SYS_PASS]' || value === '[SYS_PASS]') {
    return '<span class="badge bg-info"><i class="bi bi-key me-1"></i>系统密码</span>';
  }
  return '<code class="text-primary">' + escapeHtml(value) + '</code>';
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

// 通用表格事件绑定
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
  const cid = window.TEAMGEN_CONFIG?.contest_id || "unknown";
  $.post(
    "team_del_ajax?cid=" + cid,
    { team_id: row.team_id },
    function (ret) {
      if (ret.code == 1) {
        // 使用 row_index 作为唯一标识来删除行（因为表格的 data-unique-id 是 row_index）
        const uniqueId = row.row_index || row.team_id;
        $("#teamgen_table").bootstrapTable("removeByUniqueId", uniqueId);
        window.alerty.success(
          `账号 ${row.team_id} 删除成功`,
          `Account ${row.team_id} deleted successfully`
        );
      } else {
        window.alerty.error(ret.msg);
      }
    }
  );
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

  // 导出密码条按钮事件
  $("#export_teamgen_pageteam_btn").click(function () {
    let data_list = $("#teamgen_table").bootstrapTable("getData", {
      includeHiddenRows: true,
    });
    exportTableFunc(data_list, window.TEAMGEN_CONFIG?.contest_title || "unknown");
  });
}

// 账号所有事件绑定
function TeamgenBindAllEvents() {
  BindAllEvents({
    parseDataFunc: TeamgenParseTextData,
    downloadTemplateFunc: TeamgenDownloadTemplate,
    exportStandardFunc: TeamgenExportStandard,
    importExcelFunc: TeamgenImportExcel,
    exportTableFunc: ExportTeamgenTable,
    executeImportFunc: TeamgenExecuteImport,
    resetModeMessage:
      '已开启"重新生成所有账号"模式<br/>开启后将清除所有现有账号，重新生成新的账号数据<br/>如需关闭此模式，请点击开关',
    resetModeMessageEn:
      '"Regenerate All Accounts" mode enabled<br/>When enabled, all existing accounts will be cleared and new account data will be generated<br/>To disable this mode, please click the switch',
  });

  // 导入班级（仅 student）
  if ($("#import_clss_btn").length) {
    $("#import_clss_btn").on("click", function () {
      // 复用 expsys 的 clss_select_modal：通过回调拿到选中的班级信息
      const modalEl = document.getElementById("importClssModal");
      if (!modalEl) return;
      window.__CSGOJ_CLSS_SELECT_CALLBACKS = window.__CSGOJ_CLSS_SELECT_CALLBACKS || {};
      window.__CSGOJ_CLSS_SELECT_CALLBACKS["importClssModal"] = function (_row) {
        // 点击“确认选择”后，仍然走“导入该班学生”按钮触发的逻辑（保持按钮语义）
        // 这里不直接导入，避免用户误触；仅确保已选中即可。
      };
      bootstrap.Modal.getOrCreateInstance(modalEl).show();
      try {
        $("#import_clss_table").bootstrapTable("refresh", { silent: true });
      } catch (_e) {}
    });
  }
  if ($("#import_clss_confirm_btn").length) {
    $("#import_clss_confirm_btn").on("click", function () {
      TeamgenImportStudentsFromClss();
    });
  }
}

// 导出密码条相关函数
function SheetSimple(team_list, ctitle, worksheet) {
  const per_subtable = 24; // 每页左右各24行
  const per_page = per_subtable * 2; // 左右分栏，总共 per_subtable * 2 条数据
  const font_size = 14;
  
  // 设置打印页面设置
  worksheet.pageSetup = {
    margins: {
      left: 0.2,
      right: 0.2,
      top: 0.5,
      bottom: 0.5,
      header: 0.3,
      footer: 0.3
    },
    horizontalCentered: true,
    paperSize: 9, // A4纸张
    orientation: 'portrait' // 纵向打印
  };
  
  // 简化密码表
  worksheet.columns = [{ width: 18 }, { width: 23 }, { width: 5 }];
  worksheet.columns = [...worksheet.columns, ...worksheet.columns];

  // 添加数据
  let totalRows = Math.ceil(team_list.length / per_page); // 总页数
  let lastPageStartRow = 0; // 记录上一页的起始行，用于设置分页符
  
  for (let i = 0; i < team_list.length; i++) {
    let team = team_list[i];
    let rowNumber = ((i % per_page) % per_subtable) + 4; // 当前行号
    let columnOffset = i % per_page < per_subtable ? 0 : 3; // 列偏移量
    let currentPage = Math.floor(i / per_page) + 1; // 当前页数

    let rowOffset = Math.floor(i / per_page) * (per_subtable + 3);

    // 如果是新的一页，更新页码
    if (i % per_page === 0) {
      // 如果不是第一页，在上一页结束位置添加分页符
      if (currentPage > 1 && lastPageStartRow > 0) {
        const lastPageEndRow = rowOffset;
        // ExcelJS 4.4.0 正确的分页符 API：row.addPageBreak()
        const pageBreakRow = worksheet.getRow(lastPageEndRow);
        if (pageBreakRow && typeof pageBreakRow.addPageBreak === 'function') {
          pageBreakRow.addPageBreak();
        }
      }
      lastPageStartRow = rowOffset + 1;
      
      // 前两行横向合并单元格并居中
      let titleRow = worksheet.addRow([`${ctitle}`]);
      worksheet.mergeCells(`A${titleRow.number}:E${titleRow.number}`);
      titleRow.height = 60;
      titleRow.alignment = {
        wrapText: true,
        vertical: "middle",
        horizontal: "center",
      };
      titleRow.font = { size: font_size };

      let headerRow = worksheet.addRow([`账号表 ${currentPage}/${totalRows}`]);
      worksheet.mergeCells(`A${headerRow.number}:E${headerRow.number}`);
      headerRow.alignment = { horizontal: "center" };
      headerRow.font = { size: font_size };

      // 添加表头
      let tableHeaderRow = worksheet.addRow([
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
      tableHeaderRow.font = { size: font_size };
    }

    // 添加数据
    let row = worksheet.getRow(rowOffset + rowNumber);
    row.getCell(columnOffset + 1).value = team.team_id;
    row.getCell(columnOffset + 2).value = team.password;
    if (columnOffset == 0) {
      row.getCell(columnOffset + 3).value = "";
    }

    // 设置行高和文本自动换行
    row.height = 38; // 设置行高
    row.alignment = {
      wrapText: true,
      vertical: "middle",
      horizontal: "center",
    }; // 设置文本自动换行

    // 设置单元格边框
    for (let j = 1; j <= 5; j++) {
      if (j == 3) {
        continue;
      }
      let cell = row.getCell(j);
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

function SheetPage(team_list, ctitle, worksheet) {
  const per_subtable = 15;
  const per_page = per_subtable * 2;
  
  // 设置打印页面设置
  worksheet.pageSetup = {
    margins: {
      left: 0.2,
      right: 0.2,
      top: 0.5,
      bottom: 0.5,
      header: 0.3,
      footer: 0.3
    },
    horizontalCentered: true,
    paperSize: 9, // A4纸张
    orientation: 'portrait' // 纵向打印
  };
  
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
  
  // 设置打印页面设置
  worksheet.pageSetup = {
    margins: {
      left: 0.2,
      right: 0.2,
      top: 0.5,
      bottom: 0.5,
      header: 0.3,
      footer: 0.3
    },
    horizontalCentered: true,
    paperSize: 9, // A4纸张
    orientation: 'portrait' // 纵向打印
  };
  
  // 完整数据表（添加序号列）
  worksheet.columns = [
    { width: 8 },  // 序号列
    { width: 12 },
    { width: 20 },
    { width: 25 },
    { width: 10 },
    { width: 15 },
    { width: 5 },
  ];
  // 添加表头（包含序号列）
  let tableHeaderRow = worksheet.addRow([
    "序号",
    "账号",
    "学校",
    "姓名",
    "考场",
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
    row.getCell(1).value = i + 1; // 序号列
    row.getCell(2).value = team.team_id;
    row.getCell(3).value = team.school;
    row.getCell(4).value = team.name;
    row.getCell(5).value = team.room;
    row.getCell(6).value = team.password;
    row.getCell(6).font = { name: "Courier New", bold: true };
    row.height = 42;
    row.alignment = { wrapText: true };
    for (let j = 1; j <= 6; j++) {
      row.getCell(j).border = {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" },
      };
    }
  }
}

// 带序号和姓名的密码条（左右双栏）
// roomName: 可选的考场名称，如果提供则会在标题中显示
function SheetWithName(team_list, ctitle, worksheet, roomName = null) {
  const per_subtable = 24; // 每页左右各24行
  const per_page = per_subtable * 2; // 左右分栏，每页共 per_subtable * 2 条数据
  const font_size = 9; // 进一步缩小字号以确保A4纵向打印能容下所有列
  
  // 设置打印页边距和居中
  worksheet.pageSetup = {
    margins: {
      left: 0.2,   // 左边距（英寸），约5mm
      right: 0.2,  // 右边距（英寸），约5mm
      top: 0.5,    // 上边距（英寸），约12.7mm
      bottom: 0.5, // 下边距（英寸），约12.7mm
      header: 0.3, // 页眉边距（英寸）
      footer: 0.3 // 页脚边距（英寸）
    },
    horizontalCentered: true, // 横向居中
    paperSize: 9, // A4纸张（9 = A4）
    orientation: 'portrait' // 纵向打印
  };
  
  // 列定义：序号、姓名、考场、账号、密码，左右双栏
  worksheet.columns = [
    { width: 4 },   // 序号
    { width: 8 },  // 姓名
    { width: 8 },  // 考场
    { width: 12 }, // 账号
    { width: 12 }, // 密码
    { width: 2 },  // 中间间隔
    { width: 4 },   // 序号
    { width: 8 },  // 姓名
    { width: 8 },  // 考场
    { width: 12 }, // 账号
    { width: 12 }, // 密码
  ];

  // 添加数据
  let totalRows = Math.ceil(team_list.length / per_page); // 总页数
  let lastPageStartRow = 0; // 记录上一页的起始行，用于设置分页符
  
  for (let i = 0; i < team_list.length; i++) {
    let team = team_list[i];
    let rowNumber = ((i % per_page) % per_subtable) + 4; // 当前行号（从第4行开始，前3行是标题和表头）
    let columnOffset = i % per_page < per_subtable ? 0 : 6; // 列偏移量：左栏0，右栏6
    let currentPage = Math.floor(i / per_page) + 1; // 当前页数
    let rowOffset = Math.floor(i / per_page) * (per_subtable + 3); // 行偏移量

    // 如果是新的一页，更新页码
    if (i % per_page === 0) {
      // 如果不是第一页，在上一页结束位置添加分页符
      if (currentPage > 1 && lastPageStartRow > 0) {
        const lastPageEndRow = rowOffset;
        // ExcelJS 4.4.0 正确的分页符 API：row.addPageBreak()
        const pageBreakRow = worksheet.getRow(lastPageEndRow);
        if (pageBreakRow && typeof pageBreakRow.addPageBreak === 'function') {
          pageBreakRow.addPageBreak();
        }
      }
      lastPageStartRow = rowOffset + 1;
      
      // 前两行横向合并单元格并居中
      // 大标题：包含比赛标题和考场信息（如果有）
      let titleText = `${ctitle}`;
      if (roomName !== null && roomName !== undefined && roomName !== "") {
        titleText += `\n考场：${roomName}`;
      }
      let titleRow = worksheet.addRow([titleText]);
      worksheet.mergeCells(`A${titleRow.number}:K${titleRow.number}`);
      titleRow.height = 60; // 增加行高以支持换行
      titleRow.alignment = {
        wrapText: true, // 支持自动换行
        vertical: "middle",
        horizontal: "center",
      };
      titleRow.font = { size: font_size + 2 };

      // 第二行：只显示账号表和页码
      let headerText = `账号表（含姓名） ${currentPage}/${totalRows}`;
      let headerRow = worksheet.addRow([headerText]);
      worksheet.mergeCells(`A${headerRow.number}:K${headerRow.number}`);
      headerRow.alignment = { horizontal: "center" };
      headerRow.font = { size: font_size };

      // 添加表头
      let tableHeaderRow = worksheet.addRow([
        "序号", "姓名", "考场", "账号", "密码",
        "",
        "序号", "姓名", "考场", "账号", "密码",
      ]);
      tableHeaderRow.font = { bold: true, size: font_size };
      tableHeaderRow.eachCell(
        (cell, colNumber) => {
          // 第6列（中间间隔列）只设置左右边框，不设置上下边框
          if (colNumber === 6) {
            cell.border = {
              left: { style: "thin" },
              right: { style: "thin" },
            };
          } else {
            cell.border = {
              top: { style: "thin" },
              left: { style: "thin" },
              bottom: { style: "thin" },
              right: { style: "thin" },
            };
          }
        }
      );
    }

    // 添加数据
    let row = worksheet.getRow(rowOffset + rowNumber);
    // 序号：全局序号，从1开始
    const seqNumber = i + 1;
    
    // 设置数据：序号、姓名、考场、账号、密码
    row.getCell(columnOffset + 1).value = seqNumber;
    row.getCell(columnOffset + 2).value = team.name || "";
    row.getCell(columnOffset + 3).value = team.room || "";
    row.getCell(columnOffset + 4).value = team.team_id;
    row.getCell(columnOffset + 5).value = team.password;

    // 设置行高和文本自动换行（保持原有行高）
    row.height = 38;
    row.alignment = {
      wrapText: true,
      vertical: "middle",
      horizontal: "center",
    };

    // 设置单元格边框和字体
    for (let j = 1; j <= 11; j++) {
      if (j == 6) {
        // 中间间隔列，不设置边框
        continue;
      }
      let cell = row.getCell(j);
      cell.font = { size: font_size };
      
      // 密码列使用等宽字体
      if (j == 5 || j == 11) {
        cell.font = { name: "Courier New", bold: true, size: font_size };
      }
      
      cell.border = {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" },
      };
    }
  }
}

async function ExportTeamgenTable(team_list, ctitle) {
  const workbook = new ExcelJS.Workbook();
  
  // 先创建原有的通用子表（保持"密码条-含姓名"在第一个）
  SheetWithName(team_list, ctitle, workbook.addWorksheet("密码条-含姓名"));
  SheetSimple(team_list, ctitle, workbook.addWorksheet("密码条-表格"));
  SheetPage(
    team_list,
    ctitle,
    workbook.addWorksheet("密码条-分页（横向打印）")
  );
  SheetFull(team_list, ctitle, workbook.addWorksheet("完整数据"));
  
  // 统计所有不同的考场（trim后）
  const roomSet = new Set();
  team_list.forEach(team => {
    const room = (team.room || "").trim();
    roomSet.add(room);
  });
  const uniqueRooms = Array.from(roomSet);
  const hasMultipleRooms = uniqueRooms.length > 1;
  
  // 如果有多于1个不同的考场，为每个考场生成单独的子表（放在后面）
  if (hasMultipleRooms) {
    uniqueRooms.forEach(room => {
      // 过滤出该考场的考生
      const roomTeamList = team_list.filter(team => {
        const teamRoom = (team.room || "").trim();
        return teamRoom === room;
      });
      
      if (roomTeamList.length > 0) {
        // 生成子表名称：空考场为"考场：#"，其他为"考场：考场名"
        const sheetName = room === "" ? "考场：#" : `考场：${room}`;
        // 显示用的考场名称：空考场显示为"#"
        const displayRoomName = room === "" ? "#" : room;
        SheetWithName(roomTeamList, ctitle, workbook.addWorksheet(sheetName), displayRoomName);
      }
    });
  }

  // 生成文件名
  const filename = TeamgenGenerateFilename("账号表");

  // 导出文件
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filename}.xlsx`;
  a.click();
}

// 允许在 textarea 中使用 Tab 键
function TextAllowTab(textareaId) {
    const textarea = document.getElementById(textareaId);
    if (!textarea) {
        console.warn('TextAllowTab: textarea with id "' + textareaId + '" not found');
        return;
    }
    
    textarea.addEventListener('keydown', function(e) {
        if (e.keyCode === 9) { // Tab 键
            e.preventDefault();
            const start = this.selectionStart;
            const end = this.selectionEnd;
            const value = this.value;
            
            // 插入制表符
            this.value = value.substring(0, start) + '\t' + value.substring(end);
            
            // 设置光标位置
            this.setSelectionRange(start + 1, start + 1);
        }
    });
}

// 全局变量
let teamgen_page_info = $("#page_info");
let teamgen_cid = window.TEAMGEN_CONFIG?.contest_id || "unknown";
let teamgen_ctitle = window.TEAMGEN_CONFIG?.contest_title || "unknown";
let teamgen_table = $("#teamgen_table");
let teamgen_delete_infoed = false;

