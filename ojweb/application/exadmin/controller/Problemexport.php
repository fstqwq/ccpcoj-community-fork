<?php

namespace app\exadmin\controller;

use app\admin\controller\Problemexport as AdminProblemexport;

/**
 * 练习/考试后台：题目包导入导出与 admin 共用同一套逻辑（见 admin/Problemexport）。
 * 仅覆写模块名与视图 assign（课程组上下文）。
 */
class Problemexport extends AdminProblemexport
{
    protected function getProblemexportModule(): string
    {
        return 'exadmin';
    }

    /**
     * 题目包页 / 文件管理：注入课程组，供前端导入 AJAX 附带 now_course_id / now_course_key。
     */
    protected function getProblemexportFilemanagerAssigns(): array
    {
        $a = parent::getProblemexportFilemanagerAssigns();
        $a['NOW_COURSE_ID'] = $this->NOW_COURSE_ID ?? null;
        $a['NOW_COURSE_KEY'] = $this->NOW_COURSE_KEY ?? '';

        return $a;
    }
}
