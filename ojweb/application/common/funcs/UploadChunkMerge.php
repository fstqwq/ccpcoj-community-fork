<?php
declare(strict_types=1);

namespace app\common\funcs;

/**
 * 大文件分片接收与合并（与 `public/static/js/chunk_upload.js` 的 ChunkUpload 契约一致）。
 *
 * Harness：凡须「1MB 分片 + part*.chunk + 合并到目标目录」的 admin 侧上传，**只准**通过本类落盘；
 * 禁止在控制器内复制分片/合并循环。鉴权、目标目录、文件名白名单由调用方在入口显式处理后再调用。
 *
 * @see docs/guide/00.开发协作必读.md#harness-upload-chunk-merge
 */
final class UploadChunkMerge
{
    /** 与 `chunk_upload.js` 单分片大小一致 */
    public const MAX_CHUNK_BYTES = 1048576;

    /**
     * @param mixed $chunkFile `request()->file('upload_file')`，须为可 `move` 的上传对象
     * @param mixed $index 0-based 分片序号
     * @param mixed $totalChunks 分片总数
     * @param string $fileName 客户端上报的最终文件名（调用方已校验合法）
     * @param string $finalDir 最终文件所在目录的绝对路径
     * @param string $chunkTempRoot `OjPath.chunk_file_temp`
     * @param callable|null $onMerged 合并完成后 `(string $finalFilePath, string $fileName): void`，仅合并成功且文件已写完时调用一次
     * @return array{
     *   ok: bool,
     *   err: string,
     *   merged: bool,
     *   saved_files?: list<string>,
     *   fileName?: string,
     *   index?: int,
     *   total?: int
     * }
     */
    public static function receiveChunk(
        $chunkFile,
        $index,
        $totalChunks,
        string $fileName,
        string $finalDir,
        string $chunkTempRoot,
        ?callable $onMerged = null
    ): array {
        $fileName = trim($fileName);
        if ($fileName === '' || strpos($fileName, "\0") !== false) {
            return ['ok' => false, 'err' => 'fileName empty', 'merged' => false];
        }
        if ($chunkFile === null) {
            return ['ok' => false, 'err' => 'no upload file', 'merged' => false];
        }

        $total = filter_var($totalChunks, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);
        if ($total === false) {
            return ['ok' => false, 'err' => 'totalChunks invalid', 'merged' => false];
        }
        $idx = filter_var($index, FILTER_VALIDATE_INT, ['options' => ['min_range' => 0]]);
        if ($idx === false || $idx >= $total) {
            return ['ok' => false, 'err' => 'index invalid', 'merged' => false];
        }

        $finalDir = rtrim(str_replace(['/', '\\'], DIRECTORY_SEPARATOR, $finalDir), DIRECTORY_SEPARATOR);
        if ($finalDir === '') {
            return ['ok' => false, 'err' => 'finalDir empty', 'merged' => false];
        }
        $chunkTempRoot = rtrim(str_replace(['/', '\\'], DIRECTORY_SEPARATOR, $chunkTempRoot), DIRECTORY_SEPARATOR);
        if ($chunkTempRoot === '') {
            return ['ok' => false, 'err' => 'chunkTempRoot empty', 'merged' => false];
        }

        $finalFilePath = $finalDir . DIRECTORY_SEPARATOR . $fileName;
        $finalHash = md5($finalFilePath . DIRECTORY_SEPARATOR . $total);
        $tempDir = $chunkTempRoot . DIRECTORY_SEPARATOR . $finalHash;

        if (!\MakeDirs($tempDir)) {
            return ['ok' => false, 'err' => 'Folder permission denied.', 'merged' => false];
        }

        $chunkSize = (int) $chunkFile->getSize();
        if ($chunkSize > self::MAX_CHUNK_BYTES) {
            return ['ok' => false, 'err' => $fileName . ': 分片大小超过限制(Chunk size exceeds limit)', 'merged' => false];
        }

        $info = $chunkFile->move($tempDir, 'part' . $idx . '.chunk');
        if (!$info) {
            return ['ok' => false, 'err' => $fileName . ': ' . (string) $chunkFile->getError(), 'merged' => false];
        }

        $allUploaded = true;
        for ($i = 0; $i < $total; $i++) {
            if (!is_file($tempDir . DIRECTORY_SEPARATOR . 'part' . $i . '.chunk')) {
                $allUploaded = false;
                break;
            }
        }

        if (!$allUploaded) {
            return [
                'ok' => true,
                'err' => '',
                'merged' => false,
                'fileName' => $fileName,
                'index' => $idx,
                'total' => $total,
            ];
        }

        if (!\MakeDirs($finalDir)) {
            return ['ok' => false, 'err' => 'Folder permission denied.', 'merged' => false];
        }

        $finalFile = @fopen($finalFilePath, 'wb');
        if ($finalFile === false) {
            return ['ok' => false, 'err' => 'Failed to open target file', 'merged' => false];
        }

        for ($i = 0; $i < $total; $i++) {
            $partFilePath = $tempDir . DIRECTORY_SEPARATOR . 'part' . $i . '.chunk';
            $partFile = @fopen($partFilePath, 'rb');
            if ($partFile === false) {
                fclose($finalFile);
                @unlink($finalFilePath);
                return ['ok' => false, 'err' => 'Missing chunk part ' . $i, 'merged' => false];
            }
            while (($buffer = fread($partFile, 8192)) !== false && $buffer !== '') {
                fwrite($finalFile, $buffer);
            }
            fclose($partFile);
            @unlink($partFilePath);
        }
        fclose($finalFile);

        if ($onMerged !== null) {
            $onMerged($finalFilePath, $fileName);
        }

        @rmdir($tempDir);

        return [
            'ok' => true,
            'err' => '',
            'merged' => true,
            'saved_files' => [str_replace('\\', '/', $fileName)],
        ];
    }
}
