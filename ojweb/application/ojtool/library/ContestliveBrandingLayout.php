<?php
declare(strict_types=1);

namespace app\ojtool\library;

/**
 * 仅服务于 `/ojtool/contestlive` 徽标上传校验。
 * 紧凑双行：**错行第二行**占位 = 行首 inset `ceil(该行首枚徽标 slot 宽 / 2)` + 后续 `gap`/`slot`（与 DOM 第二行 `padding-inline-start` 一致）。与 `contestlive_brand_layout.js`、`.contestlive-hud__logos--brick-rows` 一致。
 */
final class ContestliveBrandingLayout
{
    /** 与 `.contestlive-hud` 中 `--contestlive-hud-left-w: 23.5rem` 对齐（16px/rem），全栏外宽 */
    public const LEFT_COL_OUTER_W_PX = 376;

    /**
     * 左栏内可放徽标的水平宽度：外宽减 `padding-left(0.55rem)+padding-right(0.5rem)`，再向下取整留 1px 取整余量。
     * 须与紧凑模式下徽标条独占整行（见 `contestlive.css` #contestlive_hud_masthead_row[data-brand-compact]) 一致。
     */
    public const ZONE_WIDTH_PX = 358;

    /** 与 `.contestlive-hud__logos` 高度 clamp 上沿约 2.55rem 对齐 */
    public const SLOT_HEIGHT_PX = 41;

    public const GAP_X_PX = 7;

    /** 与 HUD `.contestlive-brand-strip__item` 左右 padding（约 0.28rem×2 @16px）同量级，计入折行占位 */
    public const LOGO_ITEM_PAD_X_TOTAL_PX = 10;

    /**
     * 单格在高度 hPx 下的近似外宽（图按比例宽 + 左右 padding）。
     */
    public static function displaySlotWidthPx(int $iw, int $ih, int $hPx): int
    {
        $iw = max(1, $iw);
        $ih = max(1, $ih);
        $hPx = max(1, $hPx);
        $pieceW = (int) ceil($iw * ($hPx / $ih));

        return $pieceW + self::LOGO_ITEM_PAD_X_TOTAL_PX;
    }

    /**
     * @return array{w:int,h:int}
     */
    public static function readImageDimensions(string $path): array
    {
        if (!is_file($path)) {
            return ['w' => 1, 'h' => 1];
        }
        $ext = strtolower(pathinfo($path, PATHINFO_EXTENSION));
        if ($ext === 'svg') {
            $raw = @file_get_contents($path, false, null, 0, 12000);
            if (!is_string($raw)) {
                return ['w' => 240, 'h' => 40];
            }
            $w = 240;
            $h = 40;
            if (preg_match('/<svg[^>]*\swidth\s*=\s*["\']([\d.]+)/i', $raw, $m)) {
                $w = max(1, (int) round((float) $m[1]));
            }
            if (preg_match('/<svg[^>]*\sheight\s*=\s*["\']([\d.]+)/i', $raw, $m2)) {
                $h = max(1, (int) round((float) $m2[1]));
            }
            return ['w' => $w, 'h' => $h];
        }
        $info = @getimagesize($path);
        if (!$info || $info[0] < 1 || $info[1] < 1) {
            return ['w' => 200, 'h' => 40];
        }
        return ['w' => (int) $info[0], 'h' => (int) $info[1]];
    }

    /**
     * @param array<int, array{w:int,h:int}> $dims
     */
    public static function totalDisplayWidthPx(array $dims, int $hPx, int $gap): int
    {
        $n = count($dims);
        if ($n === 0) {
            return 0;
        }
        $sum = 0;
        foreach ($dims as $d) {
            $iw = max(1, (int) ($d['w'] ?? 1));
            $ih = max(1, (int) ($d['h'] ?? 1));
            $sum += self::displaySlotWidthPx($iw, $ih, $hPx);
        }
        if ($n > 1) {
            $sum += ($n - 1) * $gap;
        }
        return $sum;
    }

    /**
     * 紧凑双行·错行（砖缝）：首行顶格；第二行前设 inset = ceil(该行首枚 slot 宽 / 2)，该行后续仍用 gap，总占位 ≤ zoneW。
     *
     * @param array<int, array{w:int,h:int}> $dims
     * @return array{ok:bool, split:int, row2_inset_px:int, n0:int, n1:int}
     */
    public static function computeTwoRowBrickPack(array $dims, int $hPx, int $zoneW, int $gap): array
    {
        $zoneW = max(1, $zoneW);
        $hPx = max(1, $hPx);
        $gap = max(0, $gap);
        $n = count($dims);
        if ($n === 0) {
            return ['ok' => true, 'split' => 0, 'row2_inset_px' => 0, 'n0' => 0, 'n1' => 0];
        }
        $i = 0;
        $u0 = 0;
        while ($i < $n) {
            $d0 = $dims[$i];
            $iw = max(1, (int) ($d0['w'] ?? 1));
            $ih = max(1, (int) ($d0['h'] ?? 1));
            $sw0 = self::displaySlotWidthPx($iw, $ih, $hPx);
            if ($sw0 > $zoneW) {
                return ['ok' => false, 'split' => 0, 'row2_inset_px' => 0, 'n0' => 0, 'n1' => $n];
            }
            $need0 = $sw0 + ($u0 > 0 ? $gap : 0);
            if ($u0 + $need0 <= $zoneW) {
                $u0 += $need0;
                $i++;
                continue;
            }
            break;
        }
        $split = $i;
        if ($i >= $n) {
            return ['ok' => true, 'split' => $n, 'row2_inset_px' => 0, 'n0' => $n, 'n1' => 0];
        }
        $d1 = $dims[$i];
        $iw1 = max(1, (int) ($d1['w'] ?? 1));
        $ih1 = max(1, (int) ($d1['h'] ?? 1));
        $swFirst2 = self::displaySlotWidthPx($iw1, $ih1, $hPx);
        $row2InsetPx = (int) ceil($swFirst2 / 2);
        if ($row2InsetPx + $swFirst2 > $zoneW) {
            return ['ok' => false, 'split' => $split, 'row2_inset_px' => $row2InsetPx, 'n0' => $split, 'n1' => $n - $split];
        }
        $u1 = $row2InsetPx + $swFirst2;
        $i++;
        while ($i < $n) {
            $d = $dims[$i];
            $iw = max(1, (int) ($d['w'] ?? 1));
            $ih = max(1, (int) ($d['h'] ?? 1));
            $sw = self::displaySlotWidthPx($iw, $ih, $hPx);
            if ($sw > $zoneW) {
                return ['ok' => false, 'split' => $split, 'row2_inset_px' => $row2InsetPx, 'n0' => $split, 'n1' => $n - $split];
            }
            if ($u1 + $gap + $sw > $zoneW) {
                return ['ok' => false, 'split' => $split, 'row2_inset_px' => $row2InsetPx, 'n0' => $split, 'n1' => $n - $split];
            }
            $u1 += $gap + $sw;
            $i++;
        }

        return ['ok' => true, 'split' => $split, 'row2_inset_px' => $row2InsetPx, 'n0' => $split, 'n1' => $n - $split];
    }

    /**
     * @param array<int, array{w:int,h:int}> $dims
     * @return array{compact:bool, ok:bool, sum1:int, sum2:int, h1:int, h2:int}
     */
    public static function fitsInHud(array $dims): array
    {
        $W = self::ZONE_WIDTH_PX;
        $h1 = self::SLOT_HEIGHT_PX;
        $h2 = max(18, (int) floor($h1 / 2));
        $G = self::GAP_X_PX;
        $sum1 = self::totalDisplayWidthPx($dims, $h1, $G);
        if ($sum1 <= $W) {
            return ['compact' => false, 'ok' => true, 'sum1' => $sum1, 'sum2' => 0, 'h1' => $h1, 'h2' => $h2];
        }
        $sum2 = self::totalDisplayWidthPx($dims, $h2, $G);
        $brick = self::computeTwoRowBrickPack($dims, $h2, $W, $G);
        return ['compact' => true, 'ok' => $brick['ok'], 'sum1' => $sum1, 'sum2' => $sum2, 'h1' => $h1, 'h2' => $h2, 'brick' => $brick];
    }

    /**
     * @param array<int, array{w:int,h:int}> $existing
     * @return array{compact:bool, ok:bool, sum1:int, sum2:int, h1:int, h2:int}
     */
    public static function fitsWithAdditional(array $existing, int $nw, int $nh): array
    {
        $nw = max(1, $nw);
        $nh = max(1, $nh);
        $next = $existing;
        $next[] = ['w' => $nw, 'h' => $nh];
        return self::fitsInHud($next);
    }

    /**
     * @param array<int, array{w:int,h:int}> $existingDims
     */
    public static function maxIdenticalExtras(array $existingDims, int $nw, int $nh, int $kMax = 64): int
    {
        $nw = max(1, $nw);
        $nh = max(1, $nh);
        $low = 0;
        $high = max(1, $kMax) + 1;
        while ($high - $low > 1) {
            $mid = intdiv($low + $high, 2);
            $test = $existingDims;
            for ($i = 0; $i < $mid; $i++) {
                $test[] = ['w' => $nw, 'h' => $nh];
            }
            if (self::fitsInHud($test)['ok']) {
                $low = $mid;
            } else {
                $high = $mid;
            }
        }

        return $low;
    }
}
