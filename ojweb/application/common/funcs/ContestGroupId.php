<?php
declare(strict_types=1);

namespace app\common\funcs;

/**
 * 赛事归属 group_id：大小写不敏感比较与去重，解析为 contest_group 中的规范 id。
 */
final class ContestGroupId
{
    public static function key(string $gid): string
    {
        return strtolower(trim($gid));
    }

    /**
     * @param array<int, array<string, mixed>> $groups contest_group 行或同形数组
     * @return array<string, string> 小写键 → 规范 group_id
     */
    public static function buildCanonicalMap(array $groups): array
    {
        $map = [];
        foreach ($groups as $g) {
            if (!is_array($g)) {
                continue;
            }
            $canonical = trim(strval($g['group_id'] ?? ''));
            if ($canonical === '') {
                continue;
            }
            $map[self::key($canonical)] = $canonical;
        }
        return $map;
    }

    /**
     * 将任意写法解析为 contest_group 规范 id；无匹配时保留 trim 后原值。
     */
    public static function resolveCanonical(string $gid, array $canonicalMap): string
    {
        $raw = trim($gid);
        if ($raw === '') {
            return '';
        }
        $k = self::key($raw);
        return $canonicalMap[$k] ?? $raw;
    }

    /**
     * 大小写不敏感去重，并尽量映射为 contest_group 规范 id。
     *
     * @param mixed $ids
     * @return string[]
     */
    public static function normalizeList($ids, array $canonicalMap): array
    {
        $seen = [];
        $ret = [];
        foreach (is_array($ids) ? $ids : [] as $gid) {
            $canonical = self::resolveCanonical(strval($gid), $canonicalMap);
            $k = self::key($canonical);
            if ($k === '' || isset($seen[$k])) {
                continue;
            }
            $seen[$k] = 1;
            $ret[] = $canonical;
        }
        return $ret;
    }

    /**
     * 两列表是否有交集（大小写不敏感）。
     *
     * @param string[] $a
     * @param string[] $b
     */
    public static function listsOverlap(array $a, array $b): bool
    {
        $setB = [];
        foreach ($b as $gid) {
            $k = self::key(strval($gid));
            if ($k !== '') {
                $setB[$k] = 1;
            }
        }
        foreach ($a as $gid) {
            $k = self::key(strval($gid));
            if ($k !== '' && isset($setB[$k])) {
                return true;
            }
        }
        return false;
    }
}
