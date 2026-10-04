<?php
namespace app\common\cross_module\contestlive;

/**
 * 跨模块「直播投屏」业务：`contest.addition` 内 live_display 片段。
 * 路径 `common/cross_module/contestlive/`（**跨模块**根目录下的业务子目录）；勿放入 `common/funcs` 通用工具。
 */
class ContestliveDisplayAddition
{
    public const PAGE_IDS = [
        'live',
        'live_balloon',
        'live_schoolwall',
        'live_timer',
        'live_queue',
        'live_ac',
        'live_combo',
        'live_probstats',
        'live_rank',
    ];

    public const SKIN_IDS = ['default', 'dark_stage', 'light_macaron'];

    /** 校徽墙布局算法 id（与前端 ContestliveSchoolwallLayout.ORDER 一致） */
    public const SCHOOLWALL_LAYOUT_IDS = [
        'grid',
        'stagger_rows',
        'hex',
        'rhythm',
        'mosaic',
        'radial',
        'spiral',
        'arc_rings',
        'petals',
        'frame',
        'scatter',
    ];

    /** 主 HUD 底栏右侧固定文案（与左侧推送缓存分离，存于 addition.live_display） */
    public const TICKER_FIXED_MAX_LEN = 1024;

    /**
     * @param mixed $additionJson contest.addition 原始值（JSON 字符串或 null）
     * @return array{skin_global:string,skin_pages:array<string,string>,hud_title:string,schoolwall_layout:string,ticker_fixed:string}
     */
    public static function normalizeFromAddition($additionJson)
    {
        $out = [
            'skin_global' => 'default',
            'skin_pages' => [],
            'hud_title' => '',
            'schoolwall_layout' => 'grid',
            'ticker_fixed' => '',
        ];
        if ($additionJson === null || $additionJson === '') {
            return $out;
        }
        if (is_array($additionJson)) {
            $add = $additionJson;
        } else {
            $add = Json2Array((string) $additionJson);
        }
        if (!$add || !is_array($add) || !isset($add['live_display']) || !is_array($add['live_display'])) {
            return $out;
        }
        $ld = $add['live_display'];
        $g = isset($ld['skin_global']) ? (string) $ld['skin_global'] : '';
        if ($g !== '' && in_array($g, self::SKIN_IDS, true)) {
            $out['skin_global'] = $g;
        }
        if (isset($ld['skin_pages']) && is_array($ld['skin_pages'])) {
            foreach (self::PAGE_IDS as $pid) {
                if (!array_key_exists($pid, $ld['skin_pages'])) {
                    continue;
                }
                $v = (string) $ld['skin_pages'][$pid];
                if ($v !== '' && in_array($v, self::SKIN_IDS, true)) {
                    $out['skin_pages'][$pid] = $v;
                }
            }
        }
        if (isset($ld['hud_title']) && is_string($ld['hud_title'])) {
            $out['hud_title'] = $ld['hud_title'];
        }
        if (isset($ld['schoolwall_layout']) && is_string($ld['schoolwall_layout'])) {
            $sw = trim($ld['schoolwall_layout']);
            if ($sw !== '' && in_array($sw, self::SCHOOLWALL_LAYOUT_IDS, true)) {
                $out['schoolwall_layout'] = $sw;
            }
        }
        if (isset($ld['ticker_fixed']) && is_string($ld['ticker_fixed'])) {
            $out['ticker_fixed'] = self::normalizeTickerFixedText($ld['ticker_fixed']);
        }

        return $out;
    }

    /**
     * 控台写入：去控制字符、裁长度；保留换行便于多行编辑。
     *
     * @param mixed $raw
     */
    public static function normalizeTickerFixedText($raw)
    {
        $t = is_string($raw) ? $raw : '';
        $t = str_replace(["\r\n", "\r"], "\n", $t);
        $t = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/u', '', $t) ?? '';
        $t = trim($t);
        if (function_exists('mb_substr')) {
            $t = mb_substr($t, 0, self::TICKER_FIXED_MAX_LEN);
        } else {
            $t = substr($t, 0, self::TICKER_FIXED_MAX_LEN);
        }

        return $t;
    }

    /** 底栏单行展示：空白压成单空格 */
    public static function tickerFixedPlainOneLine($stored)
    {
        $t = str_replace(["\r\n", "\r"], "\n", (string) $stored);
        $t = preg_replace('/\s+/u', ' ', $t) ?? '';

        return trim($t);
    }

    public static function pickValidSkin($raw)
    {
        $s = trim((string) $raw);

        return in_array($s, self::SKIN_IDS, true) ? $s : '';
    }

    public static function pickValidSchoolwallLayout($raw)
    {
        $s = trim((string) $raw);

        return in_array($s, self::SCHOOLWALL_LAYOUT_IDS, true) ? $s : '';
    }

    /**
     * 将 live_display 子树合并回 addition JSON 字符串（整字段写回 contest.addition）。
     *
     * @param mixed $existingAdditionJson
     * @param array $liveDisplaySubset 仅含要更新的键：skin_global、skin_pages、hud_title、schoolwall_layout、ticker_fixed 之一或多者
     */
    public static function mergeLiveDisplayIntoAdditionJson($existingAdditionJson, array $liveDisplaySubset)
    {
        $add = [];
        if ($existingAdditionJson !== null && $existingAdditionJson !== '') {
            $add = Json2Array((string) $existingAdditionJson);
            if (!is_array($add)) {
                $add = [];
            }
        }
        $cur = self::normalizeFromAddition(json_encode($add, JSON_UNESCAPED_UNICODE));
        if (isset($liveDisplaySubset['skin_global'])) {
            $g = self::pickValidSkin($liveDisplaySubset['skin_global']);
            $cur['skin_global'] = $g !== '' ? $g : 'default';
        }
        if (array_key_exists('skin_pages', $liveDisplaySubset)) {
            $sp = $liveDisplaySubset['skin_pages'];
            if (!is_array($sp)) {
                $cur['skin_pages'] = [];
            } elseif ($sp === []) {
                $cur['skin_pages'] = [];
            } else {
                foreach ($sp as $pid => $v) {
                    $pid = (string) $pid;
                    if (!in_array($pid, self::PAGE_IDS, true)) {
                        continue;
                    }
                    if ($v === null || $v === '') {
                        unset($cur['skin_pages'][$pid]);
                    } else {
                        $vv = self::pickValidSkin($v);
                        if ($vv !== '') {
                            $cur['skin_pages'][$pid] = $vv;
                        } else {
                            unset($cur['skin_pages'][$pid]);
                        }
                    }
                }
            }
        }
        if (array_key_exists('hud_title', $liveDisplaySubset)) {
            $t = (string) $liveDisplaySubset['hud_title'];
            if (function_exists('mb_substr')) {
                $t = mb_substr($t, 0, 512);
            } else {
                $t = substr($t, 0, 512);
            }
            $cur['hud_title'] = $t;
        }
        if (array_key_exists('schoolwall_layout', $liveDisplaySubset)) {
            $sw = self::pickValidSchoolwallLayout($liveDisplaySubset['schoolwall_layout']);
            $cur['schoolwall_layout'] = $sw !== '' ? $sw : 'grid';
        }
        if (array_key_exists('ticker_fixed', $liveDisplaySubset)) {
            $cur['ticker_fixed'] = self::normalizeTickerFixedText($liveDisplaySubset['ticker_fixed']);
        }
        $add['live_display'] = [
            'skin_global' => $cur['skin_global'],
            'skin_pages' => $cur['skin_pages'],
            'hud_title' => $cur['hud_title'],
            'schoolwall_layout' => $cur['schoolwall_layout'],
            'ticker_fixed' => isset($cur['ticker_fixed']) ? (string) $cur['ticker_fixed'] : '',
        ];

        return json_encode($add, JSON_UNESCAPED_UNICODE);
    }
}
