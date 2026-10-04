<?php
/**
 * 比赛包导出策略：仅允许竞赛侧类型（contest.private 个位 0 公开 / 1 私有 / 2 标准）。
 * 排除教学侧练习·实验(4)、考试(5)；其它未约定个位数保守拒绝。
 *
 * 题目「按比赛导出」候选列表另见 problem_export_contest_suggest_allowed_private（含 4、不含 5）。
 */

/**
 * @return int private % 10
 */
function contest_pkg_export_private_kind(int $private): int
{
    return (int) $private % 10;
}

function contest_pkg_export_allowed_private(int $private): bool
{
    return in_array(contest_pkg_export_private_kind($private), [0, 1, 2], true);
}

/**
 * 题目「按比赛导出」候选列表：含公开/私有/标准 XCPC 与实验课(4)，排除考试(5) 及未约定类型。
 */
function problem_export_contest_suggest_allowed_private(int $private): bool
{
    return in_array(contest_pkg_export_private_kind($private), [0, 1, 2, 4], true);
}

/**
 * @return array{0:string,1:string}|null 可导出时返回 null
 */
function contest_pkg_export_deny_bilingual(int $private): ?array
{
    if (contest_pkg_export_allowed_private($private)) {
        return null;
    }
    $k = contest_pkg_export_private_kind($private);
    if ($k === 4) {
        return [
            '该比赛为练习/实验类型，不支持导出比赛包。',
            'Practice / lab contests cannot be exported as a contest package.',
        ];
    }
    if ($k === 5) {
        return [
            '该比赛为考试类型，不支持导出比赛包。',
            'Exam contests cannot be exported as a contest package.',
        ];
    }
    return [
        '该比赛类型不支持导出比赛包。',
        'This contest type cannot be exported as a contest package.',
    ];
}
