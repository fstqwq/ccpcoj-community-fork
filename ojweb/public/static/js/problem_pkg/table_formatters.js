/**
 * 题包解析表 — Polygon / 酒井算协共用列 formatter 与单元格事件委托。
 * 依赖：jQuery、openPolygonTestdataModal / openThusaaTestdataModal（面板内联脚本）、
 * list_problem（polygon.js）、list_thusaa_problem（thusaa.js）。
 * Polygon 独有列 FormatterProParserPolygonPdf 仍在 pkg_panel_polygon.php 中定义。
 */
(function () {
    "use strict";

    function pkgParserEscapeAttr(s) {
        return String(s)
            .replace(/&/g, "&amp;")
            .replace(/"/g, "&quot;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;");
    }

    function pkgParserJudgeTypeOptions() {
        return window.PROBLEM_JUDGE_TYPE_OPTIONS || [
            { value: "0", label_cn: "标准评测", label_en: "Standard Judge" },
            { value: "1", label_cn: "特判评测", label_en: "Test Program Judge" },
            { value: "2", label_cn: "交互评测", label_en: "Interactive Judge" },
        ];
    }

    function pkgParserRowSource(row) {
        if (row && row.__pkg_source === "thusaa") return "thusaa";
        if (row && row.testData && row.testData.kind === "thusaa") return "thusaa";
        return "polygon";
    }

    function FormatterProParserIdx(value, row, index, field) {
        return value || index + 1;
    }

    function FormatterProParserTitle(value, row, index, field) {
        if (!value) return "-";
        var pid = row.idx || index + 1;
        var fn = pkgParserRowSource(row) === "thusaa" ? "DownloadThusaaPro" : "DownloadPro";
        return (
            '<a href="#" onclick="' +
            fn +
            "(" +
            pid +
            '); return false;" class="text-decoration-none text-primary" title="下载题目 (Download Problem)">' +
            pkgParserEscapeAttr(String(value)) +
            "</a>"
        );
    }

    function FormatterProParserAuthor(value, row, index, field) {
        if (typeof FormatProblemAuthorsHtml === "function") {
            var h = FormatProblemAuthorsHtml(value);
            if (h) {
                return h;
            }
        }
        return value || "-";
    }

    function FormatterProParserTestData(value, row, index, field) {
        var pid = row.idx || index + 1;
        var fc = row.td_file_count;
        var sz = row.td_size_label;
        if ((fc == null || fc === "") && !sz && !value) return "-";
        var fcStr = fc != null && fc !== "" ? String(fc) : "—";
        var szStr = sz ? String(sz) : "—";
        var src = pkgParserRowSource(row);
        var t =
            "点击查看文件列表；弹窗内可下载与当前评测类型一致的 CSGOJ 测例 ZIP (Open list; download ZIP matching judge type)";
        return (
            '<div class="polygon-td-open-modal polygon-td-data-chip" role="button" tabindex="0" data-pid="' +
            pid +
            '" data-pkg-source="' +
            pkgParserEscapeAttr(src) +
            '" title="' +
            pkgParserEscapeAttr(t) +
            '">' +
            '<span class="polygon-td-chip-seg polygon-td-chip-count">' +
            pkgParserEscapeAttr(fcStr) +
            "</span>" +
            '<span class="polygon-td-chip-sep">·</span>' +
            '<span class="polygon-td-chip-seg polygon-td-chip-size">' +
            pkgParserEscapeAttr(szStr) +
            "</span>" +
            "</div>"
        );
    }

    function FormatterProParserSpj(value, row, index, field) {
        var pid = row.idx || index + 1;
        var v = String(row.spjType != null ? row.spjType : row.spj != null ? row.spj : value || "0");
        var vClass = /^[012]$/.test(v) ? v : "0";
        var opts = pkgParserJudgeTypeOptions();
        var title = "评测类型（与系统题目编辑一致）(Judge type, same as problem edit)";
        var html =
            '<span class="polygon-spj-cell polygon-spj-v-' +
            vClass +
            '"><select class="form-select form-select-sm polygon-spj-select py-0" data-pid="' +
            pid +
            '" title="' +
            pkgParserEscapeAttr(title) +
            '">';
        for (var i = 0; i < opts.length; i++) {
            var o = opts[i];
            var sel = String(o.value) === v ? " selected" : "";
            var optTitle = pkgParserEscapeAttr(o.label_en + " / " + o.label_cn);
            html +=
                '<option value="' +
                pkgParserEscapeAttr(o.value) +
                '"' +
                sel +
                ' title="' +
                optTitle +
                '">' +
                pkgParserEscapeAttr(o.label_cn) +
                "</option>";
        }
        html += "</select></span>";
        return html;
    }

    function FormatterProParserHash(value, row, index, field) {
        if (!value) return "-";
        var full = String(value);
        var tail = full.slice(-6);
        var t = "点击复制完整附件指纹哈希 / Click to copy full attach fingerprint";
        return (
            '<button type="button" class="polygon-hash-pill polygon-hash-copy-btn" data-polygon-hash="' +
            pkgParserEscapeAttr(full) +
            '" title="' +
            pkgParserEscapeAttr(t) +
            '">' +
            pkgParserEscapeAttr("…" + tail) +
            "</button>"
        );
    }

    function FormatterProParserPkgLangs(value, row, index, field) {
        var pid = row.idx || index + 1;
        var list = row.pkg_lang_list;
        var n = row.pkg_lang_count != null ? row.pkg_lang_count : Array.isArray(list) ? list.length : 0;
        if (!n) {
            return '<span class="text-muted polygon-lang-cell">—</span>';
        }
        var lines = Array.isArray(list) && list.length
            ? list.map(function (x) {
                  return String(x).trim();
              }).filter(Boolean)
            : value
              ? String(value)
                    .split(/\s*,\s*/)
                    .map(function (x) {
                        return x.trim();
                    })
                    .filter(Boolean)
              : [];
        var src = pkgParserRowSource(row);
        var t =
            "点击查看目录列表；点击数字可调整语言顺序（首项=导入主题面）/ Hover for list; click count to reorder (first = primary for import)";
        var badgeInner =
            '<span class="pkg-lang-count-pill">' +
            pkgParserEscapeAttr(String(n)) +
            "</span>";
        return (
            '<button type="button" class="btn btn-link p-0 border-0 text-decoration-none pkg-lang-order-open polygon-lang-cell" data-pid="' +
            pid +
            '" data-pkg-src="' +
            pkgParserEscapeAttr(src) +
            '" title="' +
            pkgParserEscapeAttr(t) +
            '">' +
            '<span class="pkg-lang-badge-chip align-middle" data-csg-hover-popover="list-json" data-csg-popover-json="' +
            pkgParserEscapeAttr(JSON.stringify(lines.length ? lines : [String(n)])) +
            '">' +
            badgeInner +
            "</span></button>"
        );
    }

    var pkgLangModalCtx = null;

    function ensurePkgLangOrderModal() {
        var $m = jQuery("#pkgLangOrderModal");
        if ($m.length) return $m;
        var html =
            '<div class="modal fade" id="pkgLangOrderModal" tabindex="-1" aria-hidden="true">' +
            '<div class="modal-dialog modal-dialog-centered">' +
            '<div class="modal-content">' +
            '<div class="modal-header py-2">' +
            '<h5 class="modal-title">语言顺序<span class="en-text"> / Locale order</span></h5>' +
            '<button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>' +
            "</div>" +
            '<div class="modal-body">' +
            '<p class="small text-muted mb-2">拖拽调整顺序；第一项将作为打包导入时的<strong>主题面</strong>。<span class="en-text">Drag to reorder; first item becomes the primary statement in the import ZIP.</span></p>' +
            '<ul id="pkgLangOrderList" class="list-group list-group-flush pkg-lang-order-list border rounded"></ul>' +
            "</div>" +
            '<div class="modal-footer flex-wrap gap-1 justify-content-between">' +
            '<button type="button" class="btn btn-outline-secondary btn-sm" data-bs-dismiss="modal">取消<span class="en-text"> / Cancel</span></button>' +
            '<div class="d-flex flex-wrap gap-1">' +
            '<button type="button" class="btn btn-primary btn-sm" id="pkgLangOrderApplyOne" title="仅更新当前表格中这一题的解析结果与打包数据">' +
            "本题<span class=\"en-text\"> / This</span></button>" +
            '<button type="button" class="btn btn-outline-primary btn-sm" id="pkgLangOrderApplyAll" title="对当前标签下各题：按本次顺序匹配共有语言名，未出现的语言保持接在原顺序之后">' +
            "全部<span class=\"en-text\"> / All</span></button>" +
            "</div></div></div></div></div>";
        jQuery("body").append(html);
        return jQuery("#pkgLangOrderModal");
    }

    function pkgLangReadOrderFromModal() {
        var out = [];
        jQuery("#pkgLangOrderList li").each(function () {
            out.push(jQuery(this).attr("data-folder") || "");
        });
        return out.filter(Boolean);
    }

    function pkgLangPopulateModalList(folders) {
        var $ul = jQuery("#pkgLangOrderList");
        $ul.empty();
        for (var i = 0; i < folders.length; i++) {
            var f = folders[i];
            $ul.append(
                jQuery("<li/>")
                    .addClass("list-group-item d-flex align-items-center gap-2 pkg-lang-order-item")
                    .attr("data-folder", f)
                    .attr("draggable", "true")
                    .append(
                        jQuery("<span/>")
                            .addClass("pkg-lang-order-drag text-muted user-select-none")
                            .attr("title", "拖拽 / Drag")
                            .html('<i class="bi bi-grip-vertical" aria-hidden="true"></i>')
                    )
                    .append(jQuery("<span/>").addClass("flex-grow-1 text-break").text(f))
            );
        }
    }

    function pkgLangRefreshTableRow(tableId, row) {
        var $t = jQuery("#" + tableId);
        if (!$t.length || typeof $t.bootstrapTable !== "function") return;
        var all = $t.bootstrapTable("getData");
        var idx = -1;
        for (var i = 0; i < all.length; i++) {
            if (String(all[i].idx) === String(row.idx)) {
                idx = i;
                break;
            }
        }
        if (idx >= 0) {
            $t.bootstrapTable("updateRow", { index: idx, row: row, replace: true });
        }
    }

    function openPkgLangOrderModalFromRow(row, tableId) {
        pkgLangModalCtx = { row: row, tableId: tableId };
        var folders = (row.pkg_lang_list || []).slice();
        if (!folders.length) return;
        var $modal = ensurePkgLangOrderModal();
        pkgLangPopulateModalList(folders);
        var el = $modal[0];
        if (window.bootstrap && window.bootstrap.Modal) {
            window.bootstrap.Modal.getOrCreateInstance(el).show();
        } else {
            $modal.modal("show");
        }
    }

    window.FormatterProParserIdx = FormatterProParserIdx;
    window.FormatterProParserTitle = FormatterProParserTitle;
    window.FormatterProParserAuthor = FormatterProParserAuthor;
    window.FormatterProParserTestData = FormatterProParserTestData;
    window.FormatterProParserSpj = FormatterProParserSpj;
    window.FormatterProParserHash = FormatterProParserHash;
    window.FormatterProParserPkgLangs = FormatterProParserPkgLangs;

    function openTestdataModalFromTile(pid, source) {
        if (source === "thusaa") {
            if (typeof openThusaaTestdataModal === "function") {
                openThusaaTestdataModal(pid);
            }
        } else {
            if (typeof openPolygonTestdataModal === "function") {
                openPolygonTestdataModal(pid);
            }
        }
    }

    function wirePkgParserTableUi() {
        $(document).on("click", ".polygon-td-open-modal", function (e) {
            e.preventDefault();
            e.stopPropagation();
            var pid = $(this).data("pid");
            var source = $(this).data("pkg-source") || "polygon";
            openTestdataModalFromTile(pid, source);
        });
        $(document).on("keydown", ".polygon-td-open-modal", function (e) {
            if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                e.stopPropagation();
                var pid = $(this).data("pid");
                var source = $(this).data("pkg-source") || "polygon";
                openTestdataModalFromTile(pid, source);
            }
        });

        $(document).on("change", "select.polygon-spj-select", function () {
            var $sel = $(this);
            var tid = $sel.closest("table").attr("id");
            var v = String($sel.val());
            var vClass = /^[012]$/.test(v) ? v : "0";
            if (tid === "polygon_parse_table") {
                $sel.closest(".polygon-spj-cell").removeClass("polygon-spj-v-0 polygon-spj-v-1 polygon-spj-v-2").addClass("polygon-spj-v-" + vClass);
            }
            var pid = parseInt($sel.data("pid"), 10);
            if (tid === "thusaa_parse_table") {
                if (typeof window.list_thusaa_problem === "undefined") return;
                var pt = window.list_thusaa_problem.find(function (x) {
                    return String(x.idx) === String(pid);
                });
                if (pt) {
                    pt.spj = v;
                    pt.spjType = v;
                    if (pt.problemJson) pt.problemJson.spj = v;
                    if (pt.testData) {
                        if (window.ProblemPkg && window.ProblemPkg.packCore) {
                            window.ProblemPkg.packCore.invalidateTestDataMaterialization(pt.testData);
                        } else {
                            delete pt.testData.zipContent;
                            delete pt.testData.packedBlobs;
                            delete pt.testData._materializePromise;
                        }
                    }
                }
            } else if (tid === "polygon_parse_table") {
                if (typeof list_problem === "undefined") return;
                var p = list_problem.find(function (x) {
                    return String(x.idx) === String(pid);
                });
                if (p) {
                    p.spj = v;
                    p.spjType = v;
                    if (p.problemJson) p.problemJson.spj = v;
                    if (p.testData) {
                        if (window.ProblemPkg && window.ProblemPkg.packCore) {
                            window.ProblemPkg.packCore.invalidateTestDataMaterialization(p.testData);
                        } else {
                            delete p.testData.zipContent;
                            delete p.testData.packedBlobs;
                            delete p.testData._materializePromise;
                        }
                    }
                }
            }
        });

        if (window.CsgSortableList && typeof window.CsgSortableList.attachDelegatedListReorder === "function") {
            window.CsgSortableList.attachDelegatedListReorder("#pkgLangOrderList", "li");
        }
        $(document).on("click", ".pkg-lang-order-open", function (e) {
            e.preventDefault();
            e.stopPropagation();
            var pid = $(this).data("pid");
            var src = $(this).data("pkg-src") || "polygon";
            var tableId = src === "thusaa" ? "thusaa_parse_table" : "polygon_parse_table";
            var listRef =
                src === "thusaa"
                    ? window.list_thusaa_problem
                    : typeof list_problem !== "undefined"
                      ? list_problem
                      : [];
            if (!Array.isArray(listRef)) return;
            var row = listRef.find(function (x) {
                return String(x.idx) === String(pid);
            });
            if (!row) return;
            openPkgLangOrderModalFromRow(row, tableId);
        });

        function pkgLangHideModal() {
            var el = document.getElementById("pkgLangOrderModal");
            if (!el) return;
            if (window.bootstrap && window.bootstrap.Modal) {
                var inst = window.bootstrap.Modal.getInstance(el);
                if (inst) inst.hide();
            } else {
                $(el).modal("hide");
            }
        }

        $(document).on("click", "#pkgLangOrderApplyOne", function () {
            if (!pkgLangModalCtx) return;
            var row = pkgLangModalCtx.row;
            var tableId = pkgLangModalCtx.tableId;
            var ordered = pkgLangReadOrderFromModal();
            var poly = window.ProblemPkg && window.ProblemPkg.polygon;
            var done = function () {
                row.pkg_lang_list = ordered;
                row.pkg_langs = ordered.join(", ");
                pkgLangRefreshTableRow(tableId, row);
                pkgLangHideModal();
            };
            if (row.__pkg_source === "polygon" && poly && typeof poly.applyPolygonLangFolderOrder === "function") {
                void poly.applyPolygonLangFolderOrder(row, ordered).then(function () {
                    done();
                });
            } else {
                done();
            }
        });

        $(document).on("click", "#pkgLangOrderApplyAll", function () {
            if (!pkgLangModalCtx) return;
            var master = pkgLangModalCtx.row;
            var tableId = pkgLangModalCtx.tableId;
            var ordered = pkgLangReadOrderFromModal();
            var poly = window.ProblemPkg && window.ProblemPkg.polygon;
            var finish = function () {
                pkgLangHideModal();
            };
            var runOthers = function () {
                if (poly && typeof poly.applyPkgLangOrderToAllProblems === "function") {
                    void poly.applyPkgLangOrderToAllProblems(master, ordered, tableId).then(finish);
                } else {
                    finish();
                }
            };
            if (master.__pkg_source === "polygon" && poly && typeof poly.applyPolygonLangFolderOrder === "function") {
                void poly.applyPolygonLangFolderOrder(master, ordered).then(function () {
                    master.pkg_lang_list = ordered;
                    master.pkg_langs = ordered.join(", ");
                    pkgLangRefreshTableRow(tableId, master);
                    runOthers();
                });
            } else {
                master.pkg_lang_list = ordered;
                master.pkg_langs = ordered.join(", ");
                pkgLangRefreshTableRow(tableId, master);
                runOthers();
            }
        });

        $(document).on("click", ".polygon-hash-copy-btn", function (e) {
            e.preventDefault();
            e.stopPropagation();
            var h = $(this).attr("data-polygon-hash");
            if (!h) return;
            var done = function () {
                if (window.alerty && typeof window.alerty.success === "function") {
                    window.alerty.success("已复制哈希", "Hash copied");
                }
            };
            if (navigator.clipboard && window.isSecureContext) {
                navigator.clipboard.writeText(h).then(done, function () {});
            } else {
                var ta = document.createElement("textarea");
                ta.value = h;
                ta.setAttribute("readonly", "");
                ta.style.position = "fixed";
                ta.style.left = "-9999px";
                document.body.appendChild(ta);
                ta.select();
                try {
                    if (document.execCommand("copy")) done();
                } catch (err) {}
                document.body.removeChild(ta);
            }
        });
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", wirePkgParserTableUi);
    } else {
        wirePkgParserTableUi();
    }
})();
