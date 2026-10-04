<?php

namespace app\outrank\library;

use app\common\funcs\CsgOjWireInstant;

/**
 * 外榜 Token 推送（POST / JSONP）共用：鉴权、赛后宽限期、写入 rank.json。
 */
final class OutrankPusherHelper
{
    private const RANK_JSON_FILENAME = 'rank.json';
    private const RANK_JSON_LOCK_FILENAME = '.rank.json.lock';

    /**
     * 按 token + uuid 查库并校验是否允许 Token 推送。
     *
     * @return array{outrank: array}|array{error: array, http: int}
     */
    public static function verifyOutrankForTokenPush(string $token, string $outrankUuid): array
    {
        $token = trim($token);
        $outrankUuid = trim($outrankUuid);
        if ($token === '' || $outrankUuid === '') {
            return ['error' => ['status' => 'error', 'message' => 'Missing token or outrank_uuid'], 'http' => 400];
        }

        $outrank = db('outrank')->where([
            'outrank_uuid' => $outrankUuid,
            'token' => $token,
        ])->find();

        if (!$outrank) {
            return ['error' => ['status' => 'error', 'message' => 'Invalid token or outrank_uuid'], 'http' => 401];
        }

        if (isset($outrank['defunct']) && (string) $outrank['defunct'] === '2') {
            return ['error' => ['status' => 'error', 'message' => '此外榜已删除，无法推送 (This outrank was deleted; push rejected)'], 'http' => 403];
        }

        if (isset($outrank['flg_allow']) && $outrank['flg_allow'] == '0') {
            return ['error' => ['status' => 'error', 'message' => '推送已被禁止 (Push is disabled)'], 'http' => 403];
        }

        $grace = self::gracePeriodBlockIfEndedLongAgo($outrank);
        if ($grace !== null) {
            return ['error' => $grace, 'http' => 403];
        }

        return ['outrank' => $outrank];
    }

    /**
     * flg_allow=1 且库中 end_time 已逾「赛后宽限期」时拒绝 Token 推送。
     *
     * @param array $outrank 库行
     * @return array|null 非 null 时为可直接 JSON 输出的错误体
     */
    public static function gracePeriodBlockIfEndedLongAgo(array $outrank): ?array
    {
        if (!isset($outrank['flg_allow']) || (string) $outrank['flg_allow'] !== '1') {
            return null;
        }
        if (empty($outrank['end_time'])) {
            return null;
        }
        $endTs = strtotime($outrank['end_time']);
        if ($endTs === false) {
            return null;
        }
        $graceDays = 5;
        $graceSeconds = $graceDays * 24 * 60 * 60;
        if (time() - $endTs > $graceSeconds) {
            return [
                'status' => 'error',
                'message' => '比赛已结束超过' . $graceDays . '天，Token 推送已关闭；请在外榜列表更新结束时间或通过整包导入调整后再推送 (Token push closed: contest ended more than '
                    . $graceDays . ' days ago; update end_time on receiver or re-import pack before pushing)',
            ];
        }

        return null;
    }

    /**
     * 将榜单数据写入外榜附件目录并更新 updated_at（POST 整包与 JSONP 合并完成后共用）。
     *
     * @param array $outrank outrank 表行
     * @param array $data    rank.json 根对象（与网页推送一致）
     */
    public static function persistRankJson(array $outrank, array $data): void
    {
        CsgOjWireInstant::assertRankPayloadHasTimeContext($data);

        $dataFolder = self::rankJsonFolderForUuid((string) $outrank['outrank_uuid']);
        self::writeRankJsonToFolder($dataFolder, $data);

        db('outrank')->where('outrank_id', $outrank['outrank_id'])->update([
            'updated_at' => CsgOjWireInstant::appWallNaiveSqlNow(),
        ]);
    }

    /**
     * 整包导入等：向指定 UUID 目录原子写入 rank.json（调用方负责 updated_at 等库表字段）。
     *
     * @param string $outrankUuid
     * @param array  $data rank.json 根对象
     */
    public static function writeRankJsonForUuid(string $outrankUuid, array $data): void
    {
        CsgOjWireInstant::assertRankPayloadHasTimeContext($data);
        self::writeRankJsonToFolder(self::rankJsonFolderForUuid($outrankUuid), $data);
    }

    /**
     * 删除盘上 rank.json（整包导入 rank_data=null 等）。
     *
     * @param string $outrankUuid
     */
    public static function removeRankJsonForUuid(string $outrankUuid): void
    {
        self::removeRankJsonFromFolder(self::rankJsonFolderForUuid($outrankUuid));
    }

    /**
     * @param string $dataFolder …/outrank_attach/{uuid}
     * @param array  $data
     */
    public static function writeRankJsonToFolder(string $dataFolder, array $data): void
    {
        $json = json_encode($data, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
        if ($json === false) {
            throw new \RuntimeException('rank.json 编码失败 (Failed to encode rank.json)');
        }
        self::atomicWriteRankJsonBytes($dataFolder, $json);
    }

    /**
     * @param string $dataFolder …/outrank_attach/{uuid}
     */
    public static function removeRankJsonFromFolder(string $dataFolder): void
    {
        $filepath = self::rankJsonPathInFolder($dataFolder);
        if (!is_file($filepath)) {
            return;
        }

        self::withRankJsonWriteLock($dataFolder, static function () use ($filepath): void {
            if (is_file($filepath)) {
                if (!unlink($filepath)) {
                    throw new \RuntimeException('rank.json 删除失败 (Failed to delete rank.json)');
                }
            }
        });
    }

    /**
     * 从已落盘的 ZIP 解压并读取 rank.json（JSONP 合并后 ZIP 二进制与 POST 上传 ZIP 共用逻辑）。
     *
     * @param string $zipFilePath 可读 ZIP 路径
     * @param string $importTempPath 临时目录（调用方负责创建）
     * @return array rank 根数据
     * @throws \Exception
     */
    public static function extractRankDataFromZipPath(string $zipFilePath, string $importTempPath): array
    {
        if (!MakeDirs($importTempPath)) {
            throw new \Exception('临时文件夹创建失败 (Failed to create temp folder)');
        }

        try {
            $zippy = GetZippy();
            $archive = $zippy->open($zipFilePath);
            $archive->extract($importTempPath);

            $sideIana = CsgOjWireInstant::readSidecarIanaFromDirectory($importTempPath);
            if ($sideIana === null || $sideIana === '') {
                throw new \Exception('ZIP 中缺少或无效的 csg_export_timezone.json（须含 iana、schema:1）');
            }

            $rankJsonPath = $importTempPath . '/' . self::RANK_JSON_FILENAME;
            if (!file_exists($rankJsonPath)) {
                throw new \Exception('ZIP文件中未找到 rank.json (rank.json not found in ZIP)');
            }

            $jsonContent = file_get_contents($rankJsonPath);
            if ($jsonContent === false) {
                throw new \Exception('ZIP 内 rank.json 读取失败 (Failed to read rank.json from ZIP)');
            }
            $data = json_decode($jsonContent, true);
            if ($data === null) {
                throw new \Exception('rank.json 解析失败 (Failed to parse rank.json)');
            }
            if (!is_array($data)) {
                throw new \Exception('rank.json 根须为对象 (rank root must be object)');
            }
            try {
                CsgOjWireInstant::assertRankPayloadHasTimeContext($data);
            } catch (\Throwable $e) {
                throw new \Exception('rank.json: ' . $e->getMessage());
            }
            $w = trim((string) ($data['time_context']['wall_clock_timezone'] ?? ''));
            if (strcasecmp($w, $sideIana) !== 0) {
                throw new \Exception('rank.json time_context.wall_clock_timezone 与 ZIP 根 csg_export_timezone.json 的 iana 不一致');
            }

            return $data;
        } finally {
            if (is_dir($importTempPath)) {
                DelDirs($importTempPath);
            }
        }
    }

    public static function rankJsonFolderForUuid(string $outrankUuid): string
    {
        $ojPath = config('OjPath.');
        return $ojPath['PUBLIC'] . $ojPath['outrank_ATTACH'] . '/' . $outrankUuid;
    }

    private static function rankJsonPathInFolder(string $dataFolder): string
    {
        return rtrim($dataFolder, '/\\') . '/' . self::RANK_JSON_FILENAME;
    }

    private static function rankJsonLockPathInFolder(string $dataFolder): string
    {
        return rtrim($dataFolder, '/\\') . '/' . self::RANK_JSON_LOCK_FILENAME;
    }

    /**
     * 临时文件 + rename 原子替换；同目录独占锁串行化 Go 定时推与 PHP-FPM 多 worker。
     */
    private static function atomicWriteRankJsonBytes(string $dataFolder, string $json): void
    {
        if (!is_dir($dataFolder)) {
            MakeDirs($dataFolder);
        }

        $filepath = self::rankJsonPathInFolder($dataFolder);
        $expectedLen = strlen($json);

        self::withRankJsonWriteLock($dataFolder, static function () use ($filepath, $json, $expectedLen): void {
            $tmpPath = $filepath . '.tmp.' . bin2hex(random_bytes(8));
            try {
                $written = file_put_contents($tmpPath, $json, LOCK_EX);
                if ($written === false || $written !== $expectedLen) {
                    throw new \RuntimeException(
                        'rank.json 写入字节不完整 (incomplete rank.json write: expected '
                        . $expectedLen . ', got ' . ($written === false ? 'false' : (string) $written) . ')'
                    );
                }
                if (!rename($tmpPath, $filepath)) {
                    throw new \RuntimeException('rank.json 落盘失败 (Failed to rename rank.json into place)');
                }
                $tmpPath = '';
            } finally {
                if ($tmpPath !== '' && is_file($tmpPath)) {
                    @unlink($tmpPath);
                }
            }
        });
    }

    /**
     * @param callable():void $callback
     */
    private static function withRankJsonWriteLock(string $dataFolder, callable $callback): void
    {
        if (!is_dir($dataFolder)) {
            MakeDirs($dataFolder);
        }

        $lockPath = self::rankJsonLockPathInFolder($dataFolder);
        $lockFp = fopen($lockPath, 'c');
        if ($lockFp === false) {
            throw new \RuntimeException('rank.json 落盘锁打开失败 (Failed to open rank.json write lock)');
        }

        try {
            if (!flock($lockFp, LOCK_EX)) {
                throw new \RuntimeException('rank.json 落盘锁占用失败 (Failed to acquire rank.json write lock)');
            }
            $callback();
        } finally {
            flock($lockFp, LOCK_UN);
            fclose($lockFp);
        }
    }
}
