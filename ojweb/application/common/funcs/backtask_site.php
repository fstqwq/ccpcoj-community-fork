<?php
/**
 * 多 PHP 实例共用同一 MySQL 库时，backtask 队列须按「站点/容器」隔离认领，否则会出现
 * worker 在 A 容器写 /ojweb/PROBLEM_EXPORT，HTTP 在 B 容器下载找不到文件。
 *
 * 与 Python backtask.common.db._worker_site_key() 语义一致。
 */
function backtask_worker_site_key(): string
{
    $k = getenv('BACKTASK_SITE_KEY');
    if (is_string($k) && trim($k) !== '') {
        return trim($k);
    }
    $k = getenv('OJ_SESSION');
    if (is_string($k) && trim($k) !== '') {
        return trim($k);
    }
    $k = getenv('OJ_NAME');
    if (is_string($k) && trim($k) !== '') {
        return trim($k);
    }

    return 'default';
}

/**
 * 入队前合并 worker_site_key（服务端写入，不信任客户端 JSON）。
 */
function backtask_params_with_site_key(array $params): array
{
    $params['worker_site_key'] = backtask_worker_site_key();

    return $params;
}

/**
 * backtask 入队行 **created_at / updated_at**：显式写应用墙钟，禁止依赖 MySQL DEFAULT CURRENT_TIMESTAMP。
 *
 * @return array{created_at: string, updated_at: string}
 */
function backtask_naive_wall_timestamps_for_insert(): array
{
    $s = \app\common\funcs\CsgOjWireInstant::appWallNaiveSqlNow();

    return ['created_at' => $s, 'updated_at' => $s];
}
