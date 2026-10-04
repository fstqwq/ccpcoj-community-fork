/**
 * 通用 HTML 列表拖拽排序（题包语言 modal、题目编辑语言表等共用）。
 * 依赖 jQuery。列表项须设 draggable="true"。
 */
(function (w) {
    "use strict";

    var NS = ".csgSortableList";

    /**
     * 在 document 上委托拖拽：适用于动态填充的 ul/ol。
     * @param {string} listSelector 如 "#pkgLangOrderList"
     * @param {string} itemSelector 如 "li"
     */
    function attachDelegatedListReorder(listSelector, itemSelector) {
        var dragFrom = null;
        var full = listSelector + " " + itemSelector;
        jQuery(document)
            .off("dragstart" + NS, full)
            .on("dragstart" + NS, full, function (ev) {
                dragFrom = this;
                if (ev.originalEvent && ev.originalEvent.dataTransfer) {
                    ev.originalEvent.dataTransfer.effectAllowed = "move";
                }
            });
        jQuery(document)
            .off("dragover" + NS, full)
            .on("dragover" + NS, full, function (ev) {
                ev.preventDefault();
            });
        jQuery(document)
            .off("drop" + NS, full)
            .on("drop" + NS, full, function (ev) {
                ev.preventDefault();
                if (!dragFrom || dragFrom === this) {
                    dragFrom = null;
                    return;
                }
                var $a = jQuery(dragFrom);
                var $b = jQuery(this);
                if ($a.index() < $b.index()) {
                    $b.after($a);
                } else {
                    $b.before($a);
                }
                dragFrom = null;
            });
    }

    var NST = ".csgSortableTable";

    /**
     * 表格 tbody 内按「手柄」拖拽交换行顺序（委托事件，适合 render 后动态行）。
     * @param {{ tbodySelector: string, rowSelector: string, handleSelector: string, onReorder?: function(fromTr: HTMLElement, toTr: HTMLElement): void }} opts
     */
    function attachDelegatedTableRowReorder(opts) {
        if (!opts || !opts.tbodySelector || !opts.rowSelector || !opts.handleSelector) {
            return;
        }
        var tbody = opts.tbodySelector;
        var rowSel = opts.rowSelector;
        var handleSel = opts.handleSelector;
        var onReorder = opts.onReorder;
        var dragFrom = null;
        jQuery(document)
            .off("dragstart" + NST, handleSel)
            .on("dragstart" + NST, handleSel, function (ev) {
                var tr = jQuery(this).closest(rowSel)[0];
                dragFrom = tr || null;
                var e = ev.originalEvent;
                if (e && e.dataTransfer) {
                    e.dataTransfer.effectAllowed = "move";
                    try {
                        e.dataTransfer.setData("text/plain", "row");
                    } catch (e1) {
                        /* ignore */
                    }
                }
            });
        jQuery(document)
            .off("dragend" + NST, handleSel)
            .on("dragend" + NST, handleSel, function () {
                dragFrom = null;
            });
        jQuery(document)
            .off("dragover" + NST, tbody + " " + rowSel)
            .on("dragover" + NST, tbody + " " + rowSel, function (ev) {
                ev.preventDefault();
            });
        jQuery(document)
            .off("drop" + NST, tbody + " " + rowSel)
            .on("drop" + NST, tbody + " " + rowSel, function (ev) {
                ev.preventDefault();
                var toTr = this;
                if (dragFrom && toTr && dragFrom !== toTr && typeof onReorder === "function") {
                    onReorder(dragFrom, toTr);
                }
                dragFrom = null;
            });
    }

    w.CsgSortableList = {
        attachDelegatedListReorder: attachDelegatedListReorder,
        attachDelegatedTableRowReorder: attachDelegatedTableRowReorder,
    };
})(window);
