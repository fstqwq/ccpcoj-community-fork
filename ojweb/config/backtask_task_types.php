<?php
/**
 * 后台任务类型（单一配置源）
 *
 * - types：列表筛选、类型展示、详情（含仅 worker 写入的类型，如 daily_retention）
 * - creatable_task_types：允许 create_ajax 入队的类型（worker 专用类型勿加入）。
 *   注：OJ_STATUS=exp 时 BacktaskControllerTrait 会从可创建列表与前台类型下拉中排除 contest_export / contest_import（练习站不提供比赛包 Web 入队）。
 *
 * Python：入队型在 task_queue/ 模块内 QUEUED_TASK_REGISTRATION + task_schedule_config.QUEUED_TASK_MODULES
 */
return [
    'types' => [
        'problem_export'   => ['cn' => '题目导出', 'en' => 'Export'],
        'problem_import'   => ['cn' => '题目导入', 'en' => 'Import'],
        'contest_export'   => ['cn' => '比赛导出', 'en' => 'Contest export'],
        'contest_import'   => ['cn' => '比赛导入', 'en' => 'Contest import'],
        'daily_retention'  => ['cn' => '数据保留清理', 'en' => 'Data retention cleanup'],
    ],
    'creatable_task_types' => ['problem_export', 'problem_import', 'contest_export', 'contest_import'],
];
