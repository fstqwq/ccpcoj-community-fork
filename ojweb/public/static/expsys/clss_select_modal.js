/**
 * 班级选择器（Modal）通用脚本
 *
 * 目标：让任何页面只要 include `expsys/view/clss/clss_select_modal.php`，
 * 就能获得：搜索/清空/刷新/仅我的筛选/确认回调。
 *
 * 回调约定：
 * - window.__CSGOJ_CLSS_SELECT_CALLBACKS[modalId] = function(row) {}
 */

window.__CSGOJ_CLSS_SELECT_CALLBACKS = window.__CSGOJ_CLSS_SELECT_CALLBACKS || {};

/**
 * bootstrap-table responseHandler：把后端 success 包装解包成数组
 * - 兼容：直接返回数组 / {rows,total} / {code,data}
 */
function ClssSelectResponseHandler(res) {
  // 已是数组：直接返回
  if (Array.isArray(res)) return res;

  // {rows,total}：bootstrap-table 常见格式
  if (res && Array.isArray(res.rows)) return res.rows;

  // ThinkPHP success()：{code:1,data:[...]}
  if (res && (res.code === 1 || res.code === "1")) {
    if (Array.isArray(res.data)) return res.data;
    if (res.data && Array.isArray(res.data.rows)) return res.data.rows;
    return [];
  }

  // 错误：弹提示
  const msg = (res && res.msg) ? String(res.msg) : "加载班级列表失败 / Failed to load class list";
  if (window.alerty && window.alerty.error) window.alerty.error(msg);
  return [];
}
window.ClssSelectResponseHandler = ClssSelectResponseHandler;

// HTML转义函数：使用全局 DomSantize（来自 global.js）
function escapeHtml(s) {
  return DomSantize(s ?? "");
}

// ===== formatters（避免引入 contest_filter.js）=====
function FormatterClssSelectSemester(value) {
  if (!value || typeof value !== "string") return '<span class="text-muted">-</span>';
  const match = value.match(/^(\d{4})-(\d{4})-(\d+)$/);
  if (match) {
    const startYear = match[1].substring(2);
    const endYear = match[2].substring(2);
    const semester = match[3];
    const compactValue = `${startYear}-${endYear}-${semester}`;
    return `<span style="font-size: 0.85em; white-space: nowrap;" title="${escapeHtml(value)}">${escapeHtml(compactValue)}</span>`;
  }
  return `<span style="font-size: 0.85em; white-space: nowrap;">${escapeHtml(value)}</span>`;
}
window.FormatterClssSelectSemester = FormatterClssSelectSemester;

function FormatterClssSelectTitleWithMine(value, row) {
  if (!value) return "";
  const title = escapeHtml(value);
  const isMine = !!(row && (row.is_mine === 1 || row.is_mine === "1" || row.is_mine === true));
  const badge = isMine
    ? `<span class="badge bg-warning text-dark ms-2">我的<span class="en-text">Mine</span></span>`
    : "";
  return `<div class="d-flex align-items-center flex-wrap">${title}${badge}</div>`;
}
window.FormatterClssSelectTitleWithMine = FormatterClssSelectTitleWithMine;

// ===== core =====
function getModalConfig(modalEl) {
  const modalId = modalEl.id;
  const tableId = modalEl.dataset.clssSelectTableId;
  const toolbarPrefix = modalEl.dataset.clssSelectToolbarPrefix || modalId;
  const confirmBtnId = modalEl.dataset.clssSelectConfirmBtnId;
  return { modalId, tableId, toolbarPrefix, confirmBtnId };
}

function updateSelectedCount(tableId) {
  const sels = $(`#${tableId}`).bootstrapTable("getSelections") || [];
  const n = sels.length;
  $(`.clss-select-selected-count[data-for="${tableId}"]`).text(String(n));
}

function applyOnlyMine(tableId, onlyMineChecked, allRows) {
  if (!Array.isArray(allRows)) return;
  if (!onlyMineChecked) {
    $(`#${tableId}`).bootstrapTable("load", allRows);
    return;
  }
  const rows = allRows.filter((r) => r && (r.is_mine === 1 || r.is_mine === "1" || r.is_mine === true));
  $(`#${tableId}`).bootstrapTable("load", rows);
}

function initOneModal(modalEl) {
  const { modalId, tableId, toolbarPrefix, confirmBtnId } = getModalConfig(modalEl);
  if (!tableId) return;

  const $table = $(`#${tableId}`);
  if (!$table.length) return;

  let allRowsCache = null;

  // 首次加载/刷新后缓存全量 rows（便于仅我的筛选与清空恢复）
  $table.on("load-success.bs.table", function (_e, data) {
    if (Array.isArray(data)) {
      allRowsCache = data.slice();
    } else if (data && Array.isArray(data.rows)) {
      allRowsCache = data.rows.slice();
    }
    updateSelectedCount(tableId);
  });

  // 勾选变化 -> 更新计数
  $table.on("check.bs.table uncheck.bs.table check-all.bs.table uncheck-all.bs.table", function () {
    updateSelectedCount(tableId);
  });

  // modal 打开时：刷新数据、清空搜索/筛选/选中
  modalEl.addEventListener("shown.bs.modal", function () {
    try {
      $table.bootstrapTable("refresh", { silent: true });
      $table.bootstrapTable("uncheckAll");
    } catch (_e) {}
    updateSelectedCount(tableId);
  });

  // refresh
  $(`#${toolbarPrefix}_refresh`).on("click", function () {
    $table.bootstrapTable("refresh");
  });

  // search
  const doSearch = () => {
    const keyword = $(`#${toolbarPrefix}_search_input`).val() || "";
    // 使用 bootstrap-table 的内置搜索逻辑（即便页面不显示默认 search 框）
    try {
      $table.bootstrapTable("resetSearch", keyword);
    } catch (_e) {
      // fallback：简单前端过滤（保留 ID / 标题 / 学期）
      if (Array.isArray(allRowsCache)) {
        const kw = String(keyword).trim().toLowerCase();
        if (!kw) {
          $table.bootstrapTable("load", allRowsCache);
        } else {
          const rows = allRowsCache.filter((r) => {
            const s = `${r.clss_id ?? ""} ${r.clss_title ?? ""} ${r.clss_year ?? ""} ${r.clss_semester ?? ""}`.toLowerCase();
            return s.includes(kw);
          });
          $table.bootstrapTable("load", rows);
        }
      }
    }
  };
  $(`#${toolbarPrefix}_search_btn`).on("click", doSearch);
  $(`#${toolbarPrefix}_search_input`).on("keydown", function (e) {
    if (e.key === "Enter") {
      e.preventDefault();
      doSearch();
    }
  });

  // only mine
  $(`#${toolbarPrefix}_only_mine`).on("change", function () {
    applyOnlyMine(tableId, !!this.checked, allRowsCache);
    $table.bootstrapTable("uncheckAll");
    updateSelectedCount(tableId);
  });

  // clear
  $(`#${toolbarPrefix}_clear`).on("click", function () {
    $(`#${toolbarPrefix}_search_input`).val("");
    $(`#${toolbarPrefix}_only_mine`).prop("checked", false);
    if (Array.isArray(allRowsCache)) {
      $table.bootstrapTable("load", allRowsCache);
    } else {
      $table.bootstrapTable("refresh");
    }
    $table.bootstrapTable("uncheckAll");
    updateSelectedCount(tableId);
  });

  // confirm
  if (confirmBtnId) {
    $(`#${confirmBtnId}`).on("click", function () {
      const sels = $table.bootstrapTable("getSelections") || [];
      if (!sels.length) {
        window.alerty && window.alerty.error
          ? window.alerty.error("请选择一个班级 / Please select a class")
          : alert("请选择一个班级");
        return;
      }
      const row = sels[0];
      const cb = window.__CSGOJ_CLSS_SELECT_CALLBACKS[modalId];
      if (typeof cb === "function") {
        cb(row);
      }
    });
  }
}

$(function () {
  // 页面可能 include 多个 modal，逐个初始化
  document.querySelectorAll("[data-clss-select-table-id]").forEach((el) => initOneModal(el));
});


