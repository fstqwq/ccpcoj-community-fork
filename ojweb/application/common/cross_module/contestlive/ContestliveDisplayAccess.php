<?php
namespace app\common\cross_module\contestlive;

/**
 * 跨模块「直播投屏」业务：免登录令牌（单比赛单活跃令牌，仅存 cache）。
 * 路径 `common/cross_module/contestlive/`（**跨模块**根目录下的业务子目录）；勿放入 `common/funcs` 通用工具。
 */
final class ContestliveDisplayAccess
{
    const CACHE_KEY_PREFIX = 'contestlive_lvtk_v1:';
    /** 默认有效期（秒），可在签发时覆盖 */
    const DEFAULT_TTL = 2592000;

    /**
     * @return string 64 位 hex
     */
    public static function generateOpaqueToken()
    {
        return bin2hex(random_bytes(32));
    }

    public static function cacheKeyForContest($contest_id)
    {
        return self::CACHE_KEY_PREFIX . intval($contest_id);
    }

    /**
     * @param int $contest_id
     * @param string $token
     * @param int $expires_at unix
     */
    public static function storeTokenForContest($contest_id, $token, $expires_at)
    {
        $cid = intval($contest_id);
        $ttl = max(60, $expires_at - time());
        cache(self::cacheKeyForContest($cid), [
            'token' => $token,
            'exp' => intval($expires_at),
        ], $ttl);
    }

    /**
     * @param int $contest_id
     * @return array|null {token, exp}
     */
    public static function getStoredTokenForContest($contest_id)
    {
        $cid = intval($contest_id);
        $row = cache(self::cacheKeyForContest($cid));
        return is_array($row) && !empty($row['token']) ? $row : null;
    }

    /**
     * @param int $contest_id
     * @param string $lvtk
     */
    public static function validateToken($contest_id, $lvtk)
    {
        $lvtk = trim((string) $lvtk);
        if ($lvtk === '' || strlen($lvtk) < 32) {
            return false;
        }
        $row = self::getStoredTokenForContest($contest_id);
        if ($row === null) {
            return false;
        }
        if (!hash_equals((string) $row['token'], $lvtk)) {
            return false;
        }
        if (time() > intval($row['exp'] ?? 0)) {
            return false;
        }
        return true;
    }

    /**
     * 清除该场比赛已签发的投屏令牌（撤销后所有旧链接立即失效）
     */
    public static function clearTokenForContest($contest_id)
    {
        $cid = intval($contest_id);
        if ($cid <= 0) {
            return;
        }
        cache(self::cacheKeyForContest($cid), null);
    }
}
