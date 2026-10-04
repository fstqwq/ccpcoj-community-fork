<?php
declare(strict_types=1);

namespace app\common\funcs;

/**
 * 比赛金银铜配置：校验、打包、名次截断（与 rank_tool.js RankToolGetAwardRank 语义一致）。
 */
final class ContestAwardMath
{
    public static function normalizeQtyMode($v): int
    {
        return (intval($v) === 1) ? 1 : 0;
    }

    public static function pack(int $g, int $s, int $b): int
    {
        return $b * 1000000 + $s * 1000 + $g;
    }

    /**
     * 金银铜数值校验（双语）。与前端 contest_edit 校验文案保持一致。
     *
     * @return array{msg_cn:string,msg_en:string}|null 通过为 null
     */
    public static function validateAwardTripleI18n(int $g, int $s, int $b, int $qtyMode): ?array
    {
        if ($qtyMode === 1) {
            if ($g < 0 || $s < 0 || $b < 0) {
                return [
                    'msg_cn' => '个数模式下，金、银、铜名额须为非负整数。',
                    'msg_en' => 'In count mode, gold, silver, and bronze slot counts must be non-negative integers.',
                ];
            }
            return null;
        }
        if ($g < 0 || $g > 100 || $s < 0 || $s > 100 || $b < 0 || $b > 100) {
            return [
                'msg_cn' => '百分比模式下，金、银、铜比例须各自在 0～100 之间。',
                'msg_en' => 'In percentage mode, each value must be between 0 and 100.',
            ];
        }
        if ($g + $s + $b > 100) {
            return [
                'msg_cn' => '百分比模式下，金、银、铜比例之和不可超过 100。',
                'msg_en' => 'In percentage mode, the sum of gold, silver, and bronze ratios must not exceed 100.',
            ];
        }
        return null;
    }

    /** @deprecated 仅保留兼容；新代码请用 validateAwardTripleI18n */
    public static function validateAwardTriple(int $g, int $s, int $b, int $qtyMode): ?string
    {
        $x = self::validateAwardTripleI18n($g, $s, $b, $qtyMode);
        return $x === null ? null : $x['msg_cn'];
    }

    /**
     * @param array<int, array<string, mixed>> $groups
     * @return array{msg_cn:string,msg_en:string}|null 通过为 null
     */
    public static function validateAllGroups(array $groups): ?array
    {
        foreach ($groups as $g) {
            if (!is_array($g)) {
                return [
                    'msg_cn' => '赛事归属数据格式无效。',
                    'msg_en' => 'Invalid contest group payload.',
                ];
            }
            $mode = self::normalizeQtyMode($g['flg_award_qty_mode'] ?? 0);
            $err = self::validateAwardTripleI18n(
                intval($g['award_ratio_gold'] ?? 0),
                intval($g['award_ratio_silver'] ?? 0),
                intval($g['award_ratio_bronze'] ?? 0),
                $mode
            );
            if ($err !== null) {
                return $err;
            }
        }
        return null;
    }

    /**
     * 用赛事归属首行覆盖 contest 行的 award_ratio / flg_award_qty_mode（与前端 hidden 同步策略一致）。
     *
     * @param array<string, mixed> $contestRow
     * @param array<int, array<string, mixed>> $groups
     */
    public static function applyFirstGroupToContestRow(array &$contestRow, array $groups): void
    {
        if (count($groups) === 0) {
            return;
        }
        $g0 = $groups[0];
        $g = intval($g0['award_ratio_gold'] ?? 0);
        $s = intval($g0['award_ratio_silver'] ?? 0);
        $b = intval($g0['award_ratio_bronze'] ?? 0);
        $contestRow['award_ratio'] = self::pack($g, $s, $b);
        $contestRow['flg_award_qty_mode'] = self::normalizeQtyMode($g0['flg_award_qty_mode'] ?? 0);
    }

    /**
     * 与 rank_tool.js RankToolGetAwardRank 一致。
     *
     * @return array{rankGold:int, rankSilver:int, rankBronze:int, total:int}
     */
    public static function computeRankCutoffs(int $cntBase, int $rawGold, int $rawSilver, int $rawBronze, int $qtyMode): array
    {
        $B = $cntBase;
        if ($B <= 0) {
            return ['rankGold' => 0, 'rankSilver' => 0, 'rankBronze' => 0, 'total' => 0];
        }
        $g = max(0, intval($rawGold));
        $s = max(0, intval($rawSilver));
        $br = max(0, intval($rawBronze));
        if ($qtyMode === 1) {
            $nG = min($g, $B);
            $nS = min($s, max(0, $B - $nG));
            $nB = min($br, max(0, $B - $nG - $nS));
            $rankGold = $nG;
            $rankSilver = $nG + $nS;
            $rankBronze = $nG + $nS + $nB;
            return [
                'rankGold' => $rankGold,
                'rankSilver' => $rankSilver,
                'rankBronze' => $rankBronze,
                'total' => $B,
            ];
        }
        $pg = min(100, $g) / 100.0;
        $ps = min(100, $s) / 100.0;
        $pb = min(100, $br) / 100.0;
        $rankGold = (int)ceil($B * $pg);
        $rankSilver = (int)ceil($B * ($pg + $ps));
        $rankBronze = (int)ceil($B * ($pg + $ps + $pb));
        if ($s === 0) {
            $rankSilver = $rankGold;
        }
        if ($br === 0) {
            $rankBronze = $rankSilver;
        }
        return [
            'rankGold' => $rankGold,
            'rankSilver' => $rankSilver,
            'rankBronze' => $rankBronze,
            'total' => $B,
        ];
    }
}
