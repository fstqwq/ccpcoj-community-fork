<?php
declare(strict_types=1);

namespace app\common\funcs;

/**
 * 比赛附件目录（{PUBLIC}{contest_ATTACH}/{contest.attach}/）下的"固定文件名"读写工具。
 *
 * 设计意图：
 * - logo / 自定义封面 PDF / 横幅 等"每场比赛只保留一份固定文件名"的资源，
 *   读写逻辑高度同质——校验 MIME / 大小 / 魔术头，写入到 attach 子目录，再返回带 mtime 的 URL。
 * - 通过本工具集中处理上述同质逻辑，避免在多个 controller / trait 里重复散落同一段代码。
 *
 * 约束：
 * - 仅做"输入解析 + 写盘 + 路径解析"，不依赖 ThinkPHP 控制器上下文（不调用 $this->success/error）。
 * - 调用方负责权限校验、归档校验（如 assertContestNotArchivedForWrite）。
 * - 返回值统一为 `array{ok:bool, err:string, ...}`，调用方按需把 err 抛给前端。
 *
 * 与已有 `ContestHeaderBanner` 的关系：
 * - 该类只解析"读公开元数据"；写入逻辑、清旧扩展名等通用动作交给本工具。
 */
final class ContestAttachFile
{
    /**
     * 解析比赛 attach 目录的盘上绝对路径与 web URL 前缀。
     *
     * @param array $contest 至少需要 ['attach' => 子目录名]
     * @return array{ok:bool, err:string, disk_dir:string, web_dir:string}
     *   disk_dir 已带尾随 '/'；web_dir 不带尾随 '/'。
     */
    public static function resolveDir(array $contest): array
    {
        $attach = isset($contest['attach']) ? trim((string) $contest['attach']) : '';
        if ($attach === '' || $attach === '-') {
            return ['ok' => false, 'err' => 'Contest has no attach directory', 'disk_dir' => '', 'web_dir' => ''];
        }
        $ojPath = config('OjPath.');
        if (!is_array($ojPath) || !isset($ojPath['PUBLIC']) || !isset($ojPath['contest_ATTACH'])) {
            return ['ok' => false, 'err' => 'OjPath config missing', 'disk_dir' => '', 'web_dir' => ''];
        }
        $disk = rtrim((string) $ojPath['PUBLIC'], "/\\") . (string) $ojPath['contest_ATTACH'] . '/' . $attach . '/';
        $web  = (string) $ojPath['contest_ATTACH'] . '/' . $attach;
        return ['ok' => true, 'err' => '', 'disk_dir' => $disk, 'web_dir' => $web];
    }

    /**
     * 若 contest.attach 为空或 '-'，则写入新子目录名（与后台新建比赛 AttachFolderCalculation 一致）并创建盘上根目录。
     * 调用方须已完成权限与归档等写前校验。
     *
     * @param array $contest 至少含 contest_id；成功时原地更新 attach
     * @return array{ok:bool, err:string}
     */
    public static function ensureContestAttachRecord(array &$contest): array
    {
        $resolved = self::resolveDir($contest);
        if ($resolved['ok']) {
            $root = rtrim($resolved['disk_dir'], "/\\");
            if ($root !== '' && !\MakeDirs($root)) {
                return ['ok' => false, 'err' => 'Failed to create attach directory'];
            }
            return ['ok' => true, 'err' => ''];
        }
        $cid = isset($contest['contest_id']) ? intval($contest['contest_id']) : 0;
        if ($cid <= 0) {
            return ['ok' => false, 'err' => 'Invalid contest'];
        }
        for ($attempt = 0; $attempt < 4; $attempt++) {
            $row = db('contest')->where('contest_id', $cid)->field(['contest_id', 'attach'])->find();
            if (!$row) {
                return ['ok' => false, 'err' => 'Contest not found'];
            }
            $cur = isset($row['attach']) ? trim((string) $row['attach']) : '';
            if ($cur !== '' && $cur !== '-') {
                $contest['attach'] = $cur;
                $again = self::resolveDir($contest);
                if (!$again['ok']) {
                    return ['ok' => false, 'err' => $again['err']];
                }
                $root = rtrim($again['disk_dir'], "/\\");
                if ($root !== '' && !\MakeDirs($root)) {
                    return ['ok' => false, 'err' => 'Failed to create attach directory'];
                }
                return ['ok' => true, 'err' => ''];
            }
            $newAttach = date('y-m-d') . '-' . \GenerateUuidV4();
            $aff = db('contest')->where('contest_id', $cid)->where(function ($q) {
                $q->whereNull('attach')->whereOr('attach', '=', '')->whereOr('attach', '=', '-');
            })->update(['attach' => $newAttach]);
            if ($aff) {
                $contest['attach'] = $newAttach;
                $final = self::resolveDir($contest);
                if (!$final['ok']) {
                    return ['ok' => false, 'err' => $final['err']];
                }
                $root = rtrim($final['disk_dir'], "/\\");
                if ($root !== '' && !\MakeDirs($root)) {
                    return ['ok' => false, 'err' => 'Failed to create attach directory'];
                }
                return ['ok' => true, 'err' => ''];
            }
        }
        return ['ok' => false, 'err' => 'Failed to allocate attach directory'];
    }

    /**
     * 解析图片 dataURL（`data:image/<mime>;base64,...`），按白名单返回原始字节与扩展名。
     *
     * @param string[] $allowedExts 例如 ['svg','png','webp','jpg']
     * @return array{ok:bool, err:string, raw:string, ext:string}
     */
    public static function decodeImageDataUrl(string $dataUrl, array $allowedExts): array
    {
        if ($dataUrl === '') {
            return ['ok' => false, 'err' => 'No image data', 'raw' => '', 'ext' => ''];
        }
        if (!preg_match('#^data:(image/[^;]+);base64,(.+)$#s', $dataUrl, $m)) {
            return ['ok' => false, 'err' => 'Invalid image data', 'raw' => '', 'ext' => ''];
        }
        $mime = strtolower(trim($m[1]));
        $raw = base64_decode($m[2], true);
        if ($raw === false) {
            return ['ok' => false, 'err' => 'Invalid image base64', 'raw' => '', 'ext' => ''];
        }
        $ext = '';
        if (strpos($mime, 'svg') !== false) {
            $ext = 'svg';
        } elseif (strpos($mime, 'webp') !== false) {
            $ext = 'webp';
        } elseif (strpos($mime, 'png') !== false) {
            $ext = 'png';
        } elseif (strpos($mime, 'jpeg') !== false || strpos($mime, 'jpg') !== false) {
            $ext = 'jpg';
        }
        if ($ext === '' || !in_array($ext, $allowedExts, true)) {
            return ['ok' => false, 'err' => 'Image format not allowed', 'raw' => '', 'ext' => ''];
        }
        return ['ok' => true, 'err' => '', 'raw' => $raw, 'ext' => $ext];
    }

    /**
     * 解析 PDF dataURL（`data:application/pdf;base64,...`）并返回原始字节。
     *
     * @return array{ok:bool, err:string, raw:string}
     */
    public static function decodePdfDataUrl(string $dataUrl): array
    {
        if ($dataUrl === '') {
            return ['ok' => false, 'err' => 'No PDF data', 'raw' => ''];
        }
        if (!preg_match('#^data:(application/pdf);base64,(.+)$#s', $dataUrl, $m)) {
            return ['ok' => false, 'err' => 'Invalid PDF data', 'raw' => ''];
        }
        $raw = base64_decode($m[2], true);
        if ($raw === false) {
            return ['ok' => false, 'err' => 'Invalid PDF base64', 'raw' => ''];
        }
        return ['ok' => true, 'err' => '', 'raw' => $raw];
    }

    /**
     * 把已解析的字节写入 attach 子目录下的相对路径，自动建目录、校验大小与魔术头。
     *
     * @param string|null $magicPrefix 例如 PDF 用 '%PDF-'；不需要传 null
     * @return array{ok:bool, err:string, disk_path:string, web_url:string}
     *   web_url 已附 `?v=time()` 缓存戳。
     */
    public static function writeRel(array $contest, string $relPath, string $rawBytes, int $maxBytes, ?string $magicPrefix = null): array
    {
        $resolved = self::resolveDir($contest);
        if (!$resolved['ok']) {
            return ['ok' => false, 'err' => $resolved['err'], 'disk_path' => '', 'web_url' => ''];
        }
        if (strlen($rawBytes) > $maxBytes) {
            return ['ok' => false, 'err' => 'File too large', 'disk_path' => '', 'web_url' => ''];
        }
        if ($magicPrefix !== null && substr($rawBytes, 0, strlen($magicPrefix)) !== $magicPrefix) {
            return ['ok' => false, 'err' => 'File magic mismatch', 'disk_path' => '', 'web_url' => ''];
        }
        $rel = ltrim(str_replace('\\', '/', $relPath), '/');
        $disk = $resolved['disk_dir'] . $rel;
        // relPath 可含子目录（例如 "contest_print/contest_logo.svg"），逐层建目录后再写入。
        if (!\MakeDirs(dirname($disk))) {
            return ['ok' => false, 'err' => 'Failed to create attach directory', 'disk_path' => '', 'web_url' => ''];
        }
        if (file_put_contents($disk, $rawBytes) === false) {
            return ['ok' => false, 'err' => 'Failed to write file', 'disk_path' => '', 'web_url' => ''];
        }
        $url = $resolved['web_dir'] . '/' . $rel . '?v=' . time();
        return ['ok' => true, 'err' => '', 'disk_path' => $disk, 'web_url' => $url];
    }

    /**
     * 删除 attach 子目录下指定相对路径的文件。
     * 文件不存在视为正常（ok=true, removed=false）。
     *
     * @return array{ok:bool, err:string, removed:bool}
     */
    public static function deleteRel(array $contest, string $relPath): array
    {
        $resolved = self::resolveDir($contest);
        if (!$resolved['ok']) {
            return ['ok' => false, 'err' => $resolved['err'], 'removed' => false];
        }
        $rel = ltrim(str_replace('\\', '/', $relPath), '/');
        $disk = $resolved['disk_dir'] . $rel;
        if (!is_file($disk)) {
            return ['ok' => true, 'err' => '', 'removed' => false];
        }
        $removed = @unlink($disk);
        return ['ok' => $removed, 'err' => $removed ? '' : 'Failed to delete file', 'removed' => (bool) $removed];
    }

    /**
     * 按"同名多扩展"批量删除（例如 logo 这种允许 svg/png/webp/jpg 多扩展轮换的固定 baseName）。
     * removed=至少一个被成功删除。文件不存在不算错误。
     *
     * @param string[] $exts 不含点的扩展名列表
     * @return array{ok:bool, err:string, removed:bool}
     */
    public static function deleteByBaseExts(array $contest, string $baseName, array $exts): array
    {
        $resolved = self::resolveDir($contest);
        if (!$resolved['ok']) {
            return ['ok' => false, 'err' => $resolved['err'], 'removed' => false];
        }
        $removed = false;
        foreach ($exts as $ext) {
            $p = $resolved['disk_dir'] . $baseName . '.' . ltrim((string) $ext, '.');
            if (is_file($p) && @unlink($p)) {
                $removed = true;
            }
        }
        return ['ok' => true, 'err' => '', 'removed' => $removed];
    }

    /**
     * 用新扩展名写 baseName 文件，并清理旧扩展（用于 logo 这种"单文件多扩展轮换"场景）。
     * 写入失败时不会去清理旧文件，避免半残状态。
     *
     * @param string[] $allowedExts 允许的扩展名列表，用作"清理旧扩展"的范围（也包含 $newExt）
     * @return array{ok:bool, err:string, web_url:string, ext:string}
     */
    public static function writeBaseWithExt(array $contest, string $baseName, string $newExt, string $rawBytes, int $maxBytes, array $allowedExts): array
    {
        $newExt = ltrim((string) $newExt, '.');
        if ($newExt === '' || !in_array($newExt, $allowedExts, true)) {
            return ['ok' => false, 'err' => 'Extension not allowed', 'web_url' => '', 'ext' => ''];
        }
        $rel = $baseName . '.' . $newExt;
        // 先清理同 baseName 的旧扩展（即便后续写入失败也能保持只剩一份；此处先清后写以避免遗留）
        self::deleteByBaseExts($contest, $baseName, $allowedExts);
        $w = self::writeRel($contest, $rel, $rawBytes, $maxBytes, null);
        if (!$w['ok']) {
            return ['ok' => false, 'err' => $w['err'], 'web_url' => '', 'ext' => ''];
        }
        return ['ok' => true, 'err' => '', 'web_url' => $w['web_url'], 'ext' => $newExt];
    }
}
