<?php
declare(strict_types=1);

namespace app\common\funcs;

/**
 * 比赛页顶部横幅：固定文件名存放在「比赛附件」目录下，与 filemanager 静态路径一致。
 * 仅解析盘上元数据（存在性、优先级、URL、mtime），不负责上传。
 */
final class ContestHeaderBanner
{
    public const BASENAME = 'contest_header_banner';

    /**
     * @return array{0: string, 1: string} [webpAbs, svgAbs]
     */
    public static function absolutePaths(string $publicRoot, string $contestAttachRel, string $attach): array
    {
        $dir = rtrim($publicRoot, "/\\") . $contestAttachRel . '/' . trim($attach, '/');
        return [
            $dir . '/' . self::BASENAME . '.webp',
            $dir . '/' . self::BASENAME . '.svg',
        ];
    }

    /**
     * @return array{kind: string, url: string, mtime: int}|null
     */
    public static function resolvePublicMeta(
        string $publicRoot,
        string $contestAttachRel,
        string $webUploadBase,
        string $attach
    ): ?array {
        [$webp, $svg] = self::absolutePaths($publicRoot, $contestAttachRel, $attach);
        // 公开 URL 一律用「/」分段；勿用 DIRECTORY_SEPARATOR（Windows 为「\」不适用于 HTTP 路径）
        $base = rtrim(str_replace('\\', '/', $webUploadBase), '/');
        $rel = rawurlencode(trim($attach, '/'));
        if (is_file($svg) && is_readable($svg)) {
            return [
                'kind' => 'svg',
                'url' => $base . '/' . $rel . '/' . self::BASENAME . '.svg',
                'mtime' => (int) filemtime($svg),
            ];
        }
        if (is_file($webp) && is_readable($webp)) {
            return [
                'kind' => 'webp',
                'url' => $base . '/' . $rel . '/' . self::BASENAME . '.webp',
                'mtime' => (int) filemtime($webp),
            ];
        }
        return null;
    }
}
