<?php

namespace app\outrank\library;

/**
 * 外榜观众页顶栏「赞助商 / 页眉」横幅：固定文件名落在各 UUID 的 outrank_attach 目录。
 * 栅格图须为 **WebP 字节**（由前端生成）；服务端只做扩展名与 WebP 文件头校验后落盘。矢量保留为 SVG（经基础安全校验）。
 */
class OutrankSponsorBannerService
{
    public const BASENAME = 'outrank_sponsor_banner';

    /** 建议上传宽度（像素），用于管理端提示 */
    public const SUGGEST_WIDTH = 1600;

    public const SUGGEST_HEIGHT = 320;

    /**
     * @return array{0: string, 1: string} [webpAbs, svgAbs]
     */
    public static function absolutePaths(string $publicRoot, string $attachRel, string $uuid): array
    {
        $dir = rtrim($publicRoot, "/\\") . $attachRel . '/' . $uuid;
        $webp = $dir . '/' . self::BASENAME . '.webp';
        $svg = $dir . '/' . self::BASENAME . '.svg';

        return [$webp, $svg];
    }

    /**
     * @return array{kind: string, url: string, mtime: int}|null kind: webp|svg，无文件则 null
     */
    public static function resolvePublicMeta(string $publicRoot, string $attachRel, string $webUploadBase, string $uuid): ?array
    {
        [$webp, $svg] = self::absolutePaths($publicRoot, $attachRel, $uuid);
        if (is_file($svg) && is_readable($svg)) {
            $mt = (int) filemtime($svg);

            return [
                'kind' => 'svg',
                'url' => $webUploadBase . '/' . rawurlencode($uuid) . '/' . self::BASENAME . '.svg',
                'mtime' => $mt,
            ];
        }
        if (is_file($webp) && is_readable($webp)) {
            $mt = (int) filemtime($webp);

            return [
                'kind' => 'webp',
                'url' => $webUploadBase . '/' . rawurlencode($uuid) . '/' . self::BASENAME . '.webp',
                'mtime' => $mt,
            ];
        }

        return null;
    }

    public static function deleteAllInDir(string $publicRoot, string $attachRel, string $uuid): void
    {
        [$webp, $svg] = self::absolutePaths($publicRoot, $attachRel, $uuid);
        if (is_file($webp)) {
            @unlink($webp);
        }
        if (is_file($svg)) {
            @unlink($svg);
        }
    }

    /**
     * @param string $tmpPath 已落盘的临时文件（任意名）
     * @param string $origName 原始文件名（用于扩展名提示）
     * @return string 最终 kind：webp|svg
     */
    public static function processAndSave(string $tmpPath, string $origName, string $publicRoot, string $attachRel, string $uuid): string
    {
        if (!is_file($tmpPath) || !is_readable($tmpPath)) {
            throw new \RuntimeException('上传文件无效 (Invalid upload)');
        }

        $ext = strtolower(pathinfo($origName, PATHINFO_EXTENSION));
        $dir = rtrim($publicRoot, "/\\") . $attachRel . '/' . $uuid;
        if (!MakeDirs($dir)) {
            throw new \RuntimeException('目录创建失败 (Failed to create directory)');
        }

        [$webpPath, $svgPath] = self::absolutePaths($publicRoot, $attachRel, $uuid);

        if ($ext === 'svg') {
            $raw = file_get_contents($tmpPath);
            if ($raw === false) {
                throw new \RuntimeException('无法读取 SVG (Cannot read SVG)');
            }
            if (!self::svgLooksSafe($raw)) {
                throw new \RuntimeException('SVG 未通过安全校验（请去掉脚本与事件处理器）(SVG failed safety check)');
            }
            if (is_file($webpPath)) {
                @unlink($webpPath);
            }
            if (!@rename($tmpPath, $svgPath)) {
                if (!@copy($tmpPath, $svgPath)) {
                    throw new \RuntimeException('保存 SVG 失败 (Failed to save SVG)');
                }
                @unlink($tmpPath);
            }

            return 'svg';
        }

        if ($ext !== 'webp') {
            throw new \RuntimeException(
                '请从本页重新选择图片上传，或使用 SVG。 / Please upload again from this page, or use SVG.'
            );
        }

        $raw = file_get_contents($tmpPath);
        if ($raw === false || $raw === '') {
            throw new \RuntimeException('无法读取上传文件 (Cannot read upload)');
        }
        if (strlen($raw) > self::EXPORT_MAX_RAW_BYTES) {
            throw new \RuntimeException('图片文件过大，请换一张较小的。 / Image file is too large.');
        }
        if (!self::isWebpBinary($raw)) {
            throw new \RuntimeException('图片无效或已损坏，请换一张重试。 / Invalid or corrupted image.');
        }

        if (is_file($svgPath)) {
            @unlink($svgPath);
        }
        if (!@copy($tmpPath, $webpPath)) {
            @unlink($tmpPath);
            throw new \RuntimeException('保存失败，请稍后重试。 / Save failed, try again later.');
        }
        @unlink($tmpPath);

        return 'webp';
    }

    /** WebP 容器：RIFF + 长度 + WEBP */
    public static function isWebpBinary(string $bin): bool
    {
        $n = strlen($bin);
        if ($n < 12) {
            return false;
        }
        if (substr($bin, 0, 4) !== 'RIFF') {
            return false;
        }
        if (substr($bin, 8, 4) !== 'WEBP') {
            return false;
        }

        return true;
    }

    private static function svgLooksSafe(string $svg): bool
    {
        $s = $svg;
        if (strlen($s) > 8 * 1024 * 1024) {
            return false;
        }
        $lower = strtolower($s);
        if (strpos($lower, '<script') !== false) {
            return false;
        }
        if (preg_match('/\bon[a-z]+\s*=/i', $s)) {
            return false;
        }
        if (strpos($lower, 'javascript:') !== false) {
            return false;
        }
        if (strpos($lower, '<foreignobject') !== false) {
            return false;
        }
        if (strpos($lower, '<iframe') !== false) {
            return false;
        }
        if (strpos($lower, 'http-equiv') !== false) {
            return false;
        }
        if (strpos($lower, '<svg') === false) {
            return false;
        }

        return true;
    }

    /** 整包 JSON 内嵌 base64 时，单图原始字节上限（防止导出/导入过大） */
    public const EXPORT_MAX_RAW_BYTES = 14 * 1024 * 1024;

    /**
     * 读取磁盘页眉文件供整包导出（先于 rank_data 写入 JSON）
     *
     * @return array{kind: string, bytes: string}|null kind 为 webp|svg
     */
    public static function readBannerForExport(string $publicRoot, string $attachRel, string $uuid): ?array
    {
        [$webp, $svg] = self::absolutePaths($publicRoot, $attachRel, $uuid);
        if (is_file($svg) && is_readable($svg)) {
            $b = file_get_contents($svg);
            if ($b === false || $b === '') {
                return null;
            }
            if (strlen($b) > self::EXPORT_MAX_RAW_BYTES) {
                return null;
            }

            return ['kind' => 'svg', 'bytes' => $b];
        }
        if (is_file($webp) && is_readable($webp)) {
            $b = file_get_contents($webp);
            if ($b === false || $b === '') {
                return null;
            }
            if (strlen($b) > self::EXPORT_MAX_RAW_BYTES) {
                return null;
            }

            return ['kind' => 'webp', 'bytes' => $b];
        }

        return null;
    }

    /**
     * 整包导入：与 rank_data 类似 — 根上**省略**该键则不删不改盘上横幅；**null** 删除；对象则写入
     *
     * @param mixed $ph null | array{kind: string, data_base64: string}
     */
    public static function applyImportFromPackField(string $publicRoot, string $attachRel, string $uuid, $ph): void
    {
        if ($ph === null) {
            self::deleteAllInDir($publicRoot, $attachRel, $uuid);

            return;
        }
        if (!is_array($ph)) {
            throw new \RuntimeException('page_header_image 须为 null 或对象 (must be null or object)');
        }
        $kind = isset($ph['kind']) ? strtolower(trim((string) $ph['kind'])) : '';
        if ($kind !== 'webp' && $kind !== 'svg') {
            throw new \RuntimeException('page_header_image.kind 须为 webp 或 svg (kind must be webp|svg)');
        }
        if (!isset($ph['data_base64']) || !is_string($ph['data_base64'])) {
            throw new \RuntimeException('page_header_image.data_base64 须为字符串 (data_base64 must be a string)');
        }
        $b64 = preg_replace('/\s+/', '', (string) $ph['data_base64']);
        if ($b64 === '' || strlen($b64) > 32 * 1024 * 1024) {
            throw new \RuntimeException('page_header_image Base64 无效或过大 (Invalid or oversized base64)');
        }
        $raw = base64_decode($b64, true);
        if ($raw === false || $raw === '') {
            throw new \RuntimeException('page_header_image Base64 解码失败 (Base64 decode failed)');
        }
        if (strlen($raw) > self::EXPORT_MAX_RAW_BYTES * 2) {
            throw new \RuntimeException('页眉图解码后过大 (Decoded image too large)');
        }

        $dir = rtrim($publicRoot, "/\\") . $attachRel . '/' . $uuid;
        if (!MakeDirs($dir)) {
            throw new \RuntimeException('目录创建失败 (Failed to create directory)');
        }
        [$webpPath, $svgPath] = self::absolutePaths($publicRoot, $attachRel, $uuid);

        if ($kind === 'svg') {
            if (!self::svgLooksSafe($raw)) {
                throw new \RuntimeException('SVG 未通过安全校验 (SVG failed safety check)');
            }
            if (is_file($webpPath)) {
                @unlink($webpPath);
            }
            if (file_put_contents($svgPath, $raw) === false) {
                throw new \RuntimeException('保存 SVG 失败 (Failed to save SVG)');
            }

            return;
        }

        if (is_file($svgPath)) {
            @unlink($svgPath);
        }
        if (!self::isWebpBinary($raw)) {
            throw new \RuntimeException('page_header_image 栅格数据须为有效 WebP 字节 (Raster payload must be valid WebP)');
        }
        if (file_put_contents($webpPath, $raw) === false) {
            throw new \RuntimeException('写入 WebP 失败 (Failed to write WebP)');
        }
    }
}
