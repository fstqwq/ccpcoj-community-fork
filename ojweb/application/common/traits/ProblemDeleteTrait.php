<?php

namespace app\common\traits;

/**
 * 题目删除：列表行上的可删标记 + 数据库/文件清理（与 exadmin 行为一致）
 */
trait ProblemDeleteTrait
{
    /**
     * 批量查询：哪些题目存在 solution / contest_problem 引用
     * @param array $problem_ids
     * @return array{0: array<int,int>, 1: array<int,int>} [problem_id => 1, ...] 形式的集合
     */
    protected function problemDeleteEligibilityMaps(array $problem_ids): array
    {
        $problem_ids = array_values(array_unique(array_filter(array_map('intval', $problem_ids))));
        $has_solution = [];
        $has_contest_problem = [];
        if (!empty($problem_ids)) {
            $solution_problem_ids = db('solution')
                ->where('problem_id', 'in', $problem_ids)
                ->distinct(true)
                ->column('problem_id');
            $has_solution = array_flip($solution_problem_ids);
            $contest_problem_ids = db('contest_problem')
                ->where('problem_id', 'in', $problem_ids)
                ->distinct(true)
                ->column('problem_id');
            $has_contest_problem = array_flip($contest_problem_ids);
        }
        return [$has_solution, $has_contest_problem];
    }

    /**
     * 根据批量查询结果写入 can_delete、delete_reason
     */
    protected function problemDeleteApplyEligibilityToRow(array &$row, array $has_solution, array $has_contest_problem): void
    {
        $problem_id = intval($row['problem_id'] ?? 0);
        $can_delete = false;
        $has_sol = false;
        $has_cp = false;
        if ($problem_id > 0) {
            $has_sol = isset($has_solution[$problem_id]);
            $has_cp = isset($has_contest_problem[$problem_id]);
            $can_delete = (!$has_sol && !$has_cp);
        }
        $row['can_delete'] = $can_delete ? 1 : 0;
        if (!$can_delete) {
            if ($has_sol && $has_cp) {
                $row['delete_reason'] = '该题目有提交记录且已被比赛引用，无法删除';
            } elseif ($has_sol) {
                $row['delete_reason'] = '该题目有提交记录，无法删除';
            } elseif ($has_cp) {
                $row['delete_reason'] = '该题目已被比赛引用，无法删除';
            } else {
                $row['delete_reason'] = '';
            }
        } else {
            $row['delete_reason'] = '该题目没有提交记录且未被比赛引用，可以删除';
        }
    }

    /**
     * 删除前校验（无提交、未被比赛引用）
     * @return string|null 错误文案；null 表示可删
     */
    protected function problemDeleteValidateRefs(int $problem_id): ?string
    {
        if (db('solution')->where('problem_id', $problem_id)->count() > 0) {
            return '该题目有提交记录，无法删除';
        }
        if (db('contest_problem')->where('problem_id', $problem_id)->count() > 0) {
            return '该题目已被比赛引用，无法删除';
        }
        return null;
    }

    /**
     * 事务内删库 + 提交后删评测数据目录与附件目录
     * @param array $problem problem 表行（删除前读取，需含 attach）
     */
    protected function problemDeleteExecuteAfterChecks(array $problem, int $problem_id): void
    {
        \think\Db::startTrans();
        try {
            db('problem_locale')->where('problem_id', $problem_id)->delete();
            db('problem_md')->where('problem_id', $problem_id)->delete();
            db('problem_locale_html')->where('problem_id', $problem_id)->delete();
            db('privilege_item')
                ->where('rightitem', 'problem')
                ->where('item_id', $problem_id)
                ->delete();
            db('course_item')
                ->where('item', 'problem')
                ->where('item_id', $problem_id)
                ->delete();
            db('problem')->where('problem_id', $problem_id)->delete();
            \think\Db::commit();
        } catch (\Exception $e) {
            \think\Db::rollback();
            throw $e;
        }
        $ojPath = config('OjPath.');
        if (!empty($ojPath['testdata'])) {
            $testdataDir = rtrim($ojPath['testdata'], '/') . '/' . $problem_id;
            if (is_dir($testdataDir) && function_exists('DelDirs')) {
                @DelDirs($testdataDir);
            }
        }
        if (!empty($problem['attach'])) {
            $attachDir = rtrim($ojPath['PUBLIC'], '/') . rtrim($ojPath['problem_ATTACH'], '/') . '/' . $problem['attach'];
            if (is_dir($attachDir) && function_exists('DelWhatever')) {
                @DelWhatever($attachDir);
            }
        }
    }
}
