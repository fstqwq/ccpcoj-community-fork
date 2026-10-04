/**
 * 直播 HUD 徽标区几何：与 `application/ojtool/library/ContestliveBrandingLayout.php` 公式一致（上传校验在 PHP 侧复算）。
 */
(function (w) {
    "use strict";

    var ZONE_W_PX = 358;
    var ZONE_OUTER_W_PX = 376;
    var SLOT_H_PX = 41;
    var GAP_X_PX = 7;
    var LOGO_PAD_X_TOTAL_PX = 10;

    function displaySlotWidthPx(iw, ih, hPx) {
        iw = Math.max(1, iw | 0);
        ih = Math.max(1, ih | 0);
        hPx = Math.max(1, hPx | 0);
        var pieceW = Math.ceil((iw * hPx) / ih);
        return pieceW + LOGO_PAD_X_TOTAL_PX;
    }

    function totalDisplayWidthPx(dims, hPx, gap) {
        var n = dims.length;
        if (n === 0) {
            return 0;
        }
        var sum = 0;
        for (var i = 0; i < n; i++) {
            var d = dims[i];
            sum += displaySlotWidthPx(d.w || 1, d.h || 1, hPx);
        }
        if (n > 1) {
            sum += (n - 1) * gap;
        }
        return sum;
    }

    /**
     * 紧凑双行·错行（砖缝）：首行顶格；第二行首格前增加 inset = ceil(该行首枚 slot 宽 / 2)。
     * 与 DOM 一致：第二行整行 `padding-inline-start: row2InsetPx`，后续格仍用 gap，总宽须 ≤ zoneW。
     *
     * @returns {{ ok: boolean, splitIndex: number, row2InsetPx: number, nRow0: number, nRow1: number }}
     */
    function computeTwoRowBrickPack(dims, hPx, zoneW, gap) {
        zoneW = Math.max(1, zoneW | 0);
        hPx = Math.max(1, hPx | 0);
        gap = Math.max(0, gap | 0);
        var n = dims.length;
        if (n === 0) {
            return { ok: true, splitIndex: 0, row2InsetPx: 0, nRow0: 0, nRow1: 0 };
        }
        var i = 0;
        var u0 = 0;
        while (i < n) {
            var d0 = dims[i];
            var sw0 = displaySlotWidthPx(d0.w || 1, d0.h || 1, hPx);
            if (sw0 > zoneW) {
                return { ok: false, splitIndex: 0, row2InsetPx: 0, nRow0: 0, nRow1: n };
            }
            var need0 = sw0 + (u0 > 0 ? gap : 0);
            if (u0 + need0 <= zoneW) {
                u0 += need0;
                i++;
                continue;
            }
            break;
        }
        var splitIndex = i;
        if (i >= n) {
            return { ok: true, splitIndex: n, row2InsetPx: 0, nRow0: n, nRow1: 0 };
        }
        var dFirst2 = dims[i];
        var swFirst2 = displaySlotWidthPx(dFirst2.w || 1, dFirst2.h || 1, hPx);
        var row2InsetPx = Math.ceil(swFirst2 / 2);
        if (row2InsetPx + swFirst2 > zoneW) {
            return { ok: false, splitIndex: splitIndex, row2InsetPx: row2InsetPx, nRow0: splitIndex, nRow1: n - splitIndex };
        }
        var u1 = row2InsetPx + swFirst2;
        i++;
        while (i < n) {
            var d = dims[i];
            var sw = displaySlotWidthPx(d.w || 1, d.h || 1, hPx);
            if (sw > zoneW) {
                return { ok: false, splitIndex: splitIndex, row2InsetPx: row2InsetPx, nRow0: splitIndex, nRow1: n - splitIndex };
            }
            if (u1 + gap + sw > zoneW) {
                return { ok: false, splitIndex: splitIndex, row2InsetPx: row2InsetPx, nRow0: splitIndex, nRow1: n - splitIndex };
            }
            u1 += gap + sw;
            i++;
        }
        return {
            ok: true,
            splitIndex: splitIndex,
            row2InsetPx: row2InsetPx,
            nRow0: splitIndex,
            nRow1: n - splitIndex,
        };
    }

    function fitsInHud(dims) {
        var W = ZONE_W_PX;
        var h1 = SLOT_H_PX;
        var h2 = Math.max(18, Math.floor(h1 / 2));
        var G = GAP_X_PX;
        var sum1 = totalDisplayWidthPx(dims, h1, G);
        if (sum1 <= W) {
            return { compact: false, ok: true, sum1: sum1, sum2: 0, h1: h1, h2: h2, pack: null };
        }
        var sum2 = totalDisplayWidthPx(dims, h2, G);
        var pack = computeTwoRowBrickPack(dims, h2, W, G);
        return { compact: true, ok: pack.ok, sum1: sum1, sum2: sum2, h1: h1, h2: h2, pack: pack };
    }

    function fitsWithAdditional(existing, nw, nh) {
        nw = Math.max(1, nw | 0);
        nh = Math.max(1, nh | 0);
        var next = existing.slice();
        next.push({ w: nw, h: nh });
        return fitsInHud(next);
    }

    /**
     * @param {Array<{w?: number, h?: number}>} logoRows
     * @returns {{ w: number, h: number }[]}
     */
    function dimsFromLogoRows(logoRows) {
        var dims = [];
        if (!logoRows || !logoRows.length) {
            return dims;
        }
        for (var i = 0; i < logoRows.length; i++) {
            var r = logoRows[i];
            if (!r) {
                continue;
            }
            var wi = parseInt(String(r.w != null ? r.w : 0), 10);
            var hi = parseInt(String(r.h != null ? r.h : 0), 10);
            dims.push({ w: wi > 0 ? wi : 200, h: hi > 0 ? hi : 40 });
        }
        return dims;
    }

    /**
     * 投屏/控台：由 manifest.logos（含 w、h）推导 data-* 与「是否还能加一张典型尺寸」等。
     */
    function computeHudLayoutFromLogos(logoRows) {
        var dims = dimsFromLogoRows(logoRows);
        var fit = fitsInHud(dims);
        var n = dims.length;
        var typ = fitsWithAdditional(dims, 200, 48);
        var pack = fit.pack || null;
        return {
            zone_w_px: ZONE_W_PX,
            zone_outer_w_px: ZONE_OUTER_W_PX,
            slot_h_px: SLOT_H_PX,
            compact_slot_h_px: fit.compact ? fit.h2 : fit.h1,
            gap_x_px: GAP_X_PX,
            compact: fit.compact,
            fits_ok: fit.ok,
            title_below: n > 3,
            can_add_typical_probe: typ.ok,
            brick_split_index: pack ? pack.splitIndex : n,
            brick_row2_inset_px: pack ? pack.row2InsetPx : 0,
            brick_n_row0: pack ? pack.nRow0 : n,
            brick_n_row1: pack ? pack.nRow1 : 0,
        };
    }

    w.CsgContestliveBrandLayout = {
        ZONE_WIDTH_PX: ZONE_W_PX,
        LEFT_COL_OUTER_W_PX: ZONE_OUTER_W_PX,
        SLOT_HEIGHT_PX: SLOT_H_PX,
        GAP_X_PX: GAP_X_PX,
        LOGO_ITEM_PAD_X_TOTAL_PX: LOGO_PAD_X_TOTAL_PX,
        displaySlotWidthPx: displaySlotWidthPx,
        totalDisplayWidthPx: totalDisplayWidthPx,
        computeTwoRowBrickPack: computeTwoRowBrickPack,
        fitsInHud: fitsInHud,
        fitsWithAdditional: fitsWithAdditional,
        dimsFromLogoRows: dimsFromLogoRows,
        computeHudLayoutFromLogos: computeHudLayoutFromLogos,
    };
})(window);
