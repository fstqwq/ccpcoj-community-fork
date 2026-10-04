<?php

namespace app\common\funcs;

/**
 * 全站 wire 时间：RFC3339 / naive 墙钟 + IANA 与「应用时区」下 MySQL DATETIME 语义对齐。
 *
 * 契约见 docs/future_design/10.全系统时区体系与数据交换-wire与解析-20260511.md §3A、§7。
 */
final class CsgOjWireInstant
{
    public const EXPORT_TIMEZONE_FILENAME = 'csg_export_timezone.json';

    public const EXPORT_TIMEZONE_SCHEMA = 1;

    /**
     * 侧车 JSON（UTF-8）：写入各 ZIP 根或供根对象并列字段使用。
     *
     * @return array{iana: string, schema: int}
     */
    public static function exportSidecarArray(): array
    {
        $tz = self::normalizeAppTimezoneId((string) config('app.default_timezone'));

        return [
            'iana' => $tz,
            'schema' => self::EXPORT_TIMEZONE_SCHEMA,
        ];
    }

    public static function exportSidecarJson(): string
    {
        $enc = json_encode(self::exportSidecarArray(), JSON_UNESCAPED_UNICODE);
        if ($enc === false) {
            throw new \RuntimeException('csg_export_timezone json_encode failed');
        }

        return $enc;
    }

    /**
     * 赛内 contest_data_ajax 等同源榜单 payload：说明 naive DATETIME 的墙钟 IANA 与编码。
     *
     * @return array{schema_version: int, wall_clock_timezone: string, encoding: string}
     */
    public static function rankAjaxTimeContext(): array
    {
        $side = self::exportSidecarArray();

        return [
            'schema_version' => (int) $side['schema'],
            'wall_clock_timezone' => $side['iana'],
            'encoding' => 'naive_app_wall',
        ];
    }

    /**
     * 当前时刻在本机 **app.default_timezone** 下的 naive 墙钟串（写入 DATETIME；不查 MySQL）。
     *
     * @throws \RuntimeException
     */
    public static function appWallNaiveSqlNow(): string
    {
        $raw = (string) config('app.default_timezone');
        $t = trim($raw);
        if ($t === '') {
            throw new \RuntimeException('app.default_timezone 未配置，无法生成墙钟时间串');
        }
        new \DateTimeZone($t);

        return (new \DateTimeImmutable('now', new \DateTimeZone($t)))->format('Y-m-d H:i:s');
    }

    /**
     * 榜单根（contest_data_ajax / rank.json）须含 **time_context**，与 naive 列语义绑定。
     *
     * @param array $rankRoot
     *
     * @throws \InvalidArgumentException
     */
    public static function assertRankPayloadHasTimeContext(array $rankRoot): void
    {
        if (!isset($rankRoot['time_context']) || !is_array($rankRoot['time_context'])) {
            throw new \InvalidArgumentException('榜单数据须含 time_context（与赛内 contest_data_ajax 同源）');
        }
        self::validateTimeContext($rankRoot['time_context']);
        $w = trim((string) ($rankRoot['time_context']['wall_clock_timezone'] ?? ''));
        if ($w === '') {
            throw new \InvalidArgumentException('time_context.wall_clock_timezone 不能为空');
        }
    }

    /**
     * 从目录读取侧车 IANA；非法或缺失返回 null（缺失由调用方按「本机应用时区」回退）。
     */
    public static function readSidecarIanaFromDirectory(string $dir): ?string
    {
        $path = rtrim($dir, '/\\') . DIRECTORY_SEPARATOR . self::EXPORT_TIMEZONE_FILENAME;
        if (!is_file($path)) {
            return null;
        }
        $raw = @file_get_contents($path);
        if ($raw === false || trim($raw) === '') {
            return null;
        }
        $j = json_decode($raw, true);
        if (!is_array($j)) {
            return null;
        }
        $iana = isset($j['iana']) ? trim((string) $j['iana']) : '';
        if ($iana === '') {
            return null;
        }
        try {
            new \DateTimeZone($iana);
        } catch (\Exception $e) {
            return null;
        }

        return $iana;
    }

    /**
     * 校验 JSON 根上的 csg_export_timezone（与侧车同形）；非法抛异常。
     *
     * @param mixed $node
     */
    public static function validateEmbeddedExportTimezone($node): ?string
    {
        if ($node === null) {
            return null;
        }
        if (!is_array($node)) {
            throw new \InvalidArgumentException('csg_export_timezone 须为对象');
        }
        $iana = isset($node['iana']) ? trim((string) $node['iana']) : '';
        if ($iana === '') {
            throw new \InvalidArgumentException('csg_export_timezone.iana 不能为空');
        }
        new \DateTimeZone($iana);
        $sch = isset($node['schema']) ? (int) $node['schema'] : 0;
        if ($sch !== self::EXPORT_TIMEZONE_SCHEMA) {
            throw new \InvalidArgumentException('不支持的 csg_export_timezone.schema');
        }

        return $iana;
    }

    /**
     * 侧车 IANA 与 JSON 内嵌 csg_export_timezone.iana 须一致（双源拒绝）。
     */
    public static function assertEmbeddedMatchesSidecar(?string $sidecarIana, ?string $embeddedIana): void
    {
        if ($sidecarIana === null || $embeddedIana === null) {
            return;
        }
        if ($sidecarIana !== $embeddedIana) {
            throw new \InvalidArgumentException(
                'ZIP 根 csg_export_timezone.json 与包内 JSON 的 csg_export_timezone.iana 不一致，拒绝导入'
            );
        }
    }

    /**
     * @param array $timeContext 可含 wall_clock_timezone（IANA）
     * @throws \InvalidArgumentException
     */
    public static function validateTimeContext(array $timeContext): void
    {
        if ($timeContext === []) {
            return;
        }
        if (isset($timeContext['wall_clock_timezone'])) {
            $w = trim((string) $timeContext['wall_clock_timezone']);
            if ($w !== '') {
                new \DateTimeZone($w);
            }
        }
    }

    /**
     * @return int Unix 毫秒（UTC）
     *
     * @param array $timeContext 可含 wall_clock_timezone；naive 墙钟优先用其 IANA
     * @param string|null $packageWallIana 侧车或整包默认 IANA（与 time_context 一致时由调用方保证）
     * @param string|null $appDefaultTz 缺省为 config app.default_timezone
     */
    public static function parseToUnixMs(string $s, array $timeContext = [], ?string $packageWallIana = null, ?string $appDefaultTz = null): int
    {
        $raw = trim($s);
        if ($raw === '') {
            throw new \InvalidArgumentException('empty wire time');
        }
        self::validateTimeContext($timeContext);

        if (self::looksLikeRfc3339OrOffset($raw)) {
            $dt = new \DateTimeImmutable($raw);

            return (int) ($dt->getTimestamp() * 1000);
        }

        $appTz = self::normalizeAppTimezoneId($appDefaultTz !== null && $appDefaultTz !== ''
            ? (string) $appDefaultTz
            : (string) config('app.default_timezone'));

        $iana = null;
        if (!empty($timeContext['wall_clock_timezone'])) {
            $t = trim((string) $timeContext['wall_clock_timezone']);
            if ($t !== '') {
                $iana = $t;
            }
        }
        if ($iana === null || $iana === '') {
            $pkg = $packageWallIana !== null ? trim((string) $packageWallIana) : '';
            $iana = $pkg !== '' ? $pkg : $appTz;
        }
        new \DateTimeZone($iana);

        $norm = str_replace('T', ' ', $raw);
        if (preg_match('/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/', $norm)) {
            $norm .= ':00';
        }
        if (!preg_match('/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/', $norm)) {
            throw new \InvalidArgumentException('无法解析的 naive 时间串');
        }
        $src = \DateTimeImmutable::createFromFormat('Y-m-d H:i:s', $norm, new \DateTimeZone($iana));
        if ($src === false) {
            throw new \InvalidArgumentException('naive 时间格式错误');
        }

        return (int) ($src->format('U') * 1000);
    }

    /**
     * 将 UTC instant 格式化为某 IANA 时区下的 RFC3339（含数值偏移，非 Z）。
     */
    public static function toRfc3339(\DateTimeInterface $utc, string $displayOffsetTz): string
    {
        $tz = new \DateTimeZone(self::normalizeAppTimezoneId($displayOffsetTz));
        if ($utc instanceof \DateTimeImmutable) {
            $u = $utc->setTimezone(new \DateTimeZone('UTC'));
        } else {
            $u = (new \DateTimeImmutable('@' . $utc->getTimestamp()))->setTimezone(new \DateTimeZone('UTC'));
        }
        $local = $u->setTimezone($tz);

        return $local->format('Y-m-d\TH:i:sP');
    }

    /**
     * naive（源 IANA 墙钟）→ 本机应用时区墙钟的 MySQL DATETIME 串。
     */
    public static function naiveWallInIanaToAppNaiveSql(string $naiveYmdHis, string $srcIana, string $appIana): string
    {
        $ms = self::parseToUnixMs($naiveYmdHis, [], $srcIana, $appIana);
        $tz = new \DateTimeZone(self::normalizeAppTimezoneId($appIana));

        return (new \DateTimeImmutable('@' . (int) floor($ms / 1000)))
            ->setTimezone($tz)
            ->format('Y-m-d H:i:s');
    }

    private static function normalizeAppTimezoneId(string $tz): string
    {
        $t = trim($tz);
        if ($t === '') {
            $t = 'Asia/Shanghai';
        }
        new \DateTimeZone($t);

        return $t;
    }

    private static function looksLikeRfc3339OrOffset(string $s): bool
    {
        if (preg_match('/Z$/i', $s)) {
            return true;
        }
        if (preg_match('/[+-]\d{2}:\d{2}$/', $s)) {
            return true;
        }
        if (preg_match('/[+-]\d{2}\d{2}$/', $s)) {
            return true;
        }

        return false;
    }
}
