<?php
/**
 * Contest 删除功能 Trait
 * 提供考试(exam)和练习(contest)的通用删除逻辑
 */
namespace app\common\traits;

use think\Db;

trait ContestDeleteTrait
{
    /**
     * 批量探测 deleteContest 前置阻断条件（与 deleteContest 一致，避免列表 N+1）
     *
     * @param int[] $contest_ids
     * @param bool  $check_asheet 是否查询 ex_asheet（与 deleteContest 第二参数一致）
     * @return array{0: array<int,true>, 1: array<int,true>, 2: array<int,true>} [has_solution, has_team, has_asheet]
     */
    protected function contestDeleteBarrierMaps(array $contest_ids, $check_asheet = true)
    {
        $contest_ids = array_values(array_unique(array_filter(array_map('intval', $contest_ids))));
        $has_solution = [];
        $has_team = [];
        $has_asheet = [];
        if (empty($contest_ids)) {
            return [$has_solution, $has_team, $has_asheet];
        }
        $sol_ids = db('solution')
            ->where('contest_id', 'in', $contest_ids)
            ->distinct(true)
            ->column('contest_id');
        foreach ($sol_ids as $cid) {
            $has_solution[intval($cid)] = true;
        }
        $team_ids = db('cpc_team')
            ->where('contest_id', 'in', $contest_ids)
            ->distinct(true)
            ->column('contest_id');
        foreach ($team_ids as $cid) {
            $has_team[intval($cid)] = true;
        }
        if ($check_asheet) {
            $sheet_ids = db('ex_asheet')
                ->where('exam_id', 'in', $contest_ids)
                ->distinct(true)
                ->column('exam_id');
            foreach ($sheet_ids as $eid) {
                $has_asheet[intval($eid)] = true;
            }
        }
        return [$has_solution, $has_team, $has_asheet];
    }

    /**
     * 写入 can_delete / delete_reason（供管理端列表灰显与 Tooltip）
     *
     * @param array<int,true> $has_solution
     * @param array<int,true> $has_team
     * @param array<int,true> $has_asheet
     */
    protected function contestDeleteApplyEligibilityToRow(array &$row, array $has_solution, array $has_team, array $has_asheet, $check_asheet = true)
    {
        $cid = intval($row['contest_id'] ?? 0);
        $sol = $cid > 0 && isset($has_solution[$cid]);
        $team = $cid > 0 && isset($has_team[$cid]);
        $sheet = $check_asheet && $cid > 0 && isset($has_asheet[$cid]);
        $can = !$sol && !$team && !$sheet;
        $row['can_delete'] = $can ? 1 : 0;
        if ($can) {
            $row['delete_reason'] = $check_asheet
                ? '无提交记录、无考生账号、无答卷记录时可删除'
                : '无提交记录、无考生账号时可删除';
            return;
        }
        $parts = [];
        if ($sol) {
            $parts[] = '有提交记录';
        }
        if ($team) {
            $parts[] = '有考生账号';
        }
        if ($sheet) {
            $parts[] = '有答卷记录';
        }
        $row['delete_reason'] = '该记录' . implode('、', $parts) . '，无法删除';
    }

    /**
     * 删除 contest (考试或练习)
     * 
     * @param int $contest_id 要删除的 contest_id
     * @param bool $check_asheet 是否检查 ex_asheet（考试类需要检查，练习类不需要）
     * @return array ['code' => 1/0, 'msg' => '...']
     */
    protected function deleteContest($contest_id, $check_asheet = true) {
        $contest_id = intval($contest_id);
        
        if ($contest_id <= 0) {
            return ['code' => 0, 'msg' => '无效的ID'];
        }
        
        // 检查该 contest 是否存在
        $contest = db('contest')->where('contest_id', $contest_id)->find();
        if (!$contest) {
            return ['code' => 0, 'msg' => '记录不存在'];
        }
        
        // 检查该 contest 是否有提交记录（solution）
        $solution_count = db('solution')->where('contest_id', $contest_id)->count();
        if ($solution_count > 0) {
            return ['code' => 0, 'msg' => '该记录有提交记录，无法删除'];
        }
        
        // 检查该 contest 是否有考生账号（cpc_team）
        $team_count = db('cpc_team')->where('contest_id', $contest_id)->count();
        if ($team_count > 0) {
            return ['code' => 0, 'msg' => '该记录有考生账号，无法删除'];
        }
        
        // 考试类需要检查答卷（ex_asheet）
        if ($check_asheet) {
            $asheet_count = db('ex_asheet')->where('exam_id', $contest_id)->count();
            if ($asheet_count > 0) {
                return ['code' => 0, 'msg' => '该考试有答卷记录，无法删除'];
            }
        }
        
        // 所有检查通过，执行删除
        // 开启事务
        Db::startTrans();
        try {
            // 先删除所有有外键约束的子表（必须在删除 contest 之前）
            
            // 删除 contest_msg 表中的记录（有外键约束）
            db('contest_msg')->where('contest_id', $contest_id)->delete();
            
            // 删除 contest_problem 表中的关联记录
            db('contest_problem')->where('contest_id', $contest_id)->delete();
            
            // 删除 contest_balloon 表中的记录
            db('contest_balloon')->where('contest_id', $contest_id)->delete();
            
            // 删除 contest_print 表中的记录
            db('contest_print')->where('contest_id', $contest_id)->delete();
            
            // 删除 contest_topic 表中的记录
            db('contest_topic')->where('contest_id', $contest_id)->delete();
            
            // 删除 contest_md 表中的记录
            db('contest_md')->where('contest_id', $contest_id)->delete();
            
            // 删除 privilege_item 表中的关联记录（owner/admin 权限等）
            db('privilege_item')
                ->where('rightitem', 'contest')
                ->where('item_id', $contest_id)
                ->delete();
            
            // 删除 course_item 表中的关联记录
            db('course_item')
                ->where('item', 'contest')
                ->where('item_id', $contest_id)
                ->delete();
            
            // 最后删除 contest 表中的记录（主表）
            db('contest')->where('contest_id', $contest_id)->delete();
            
            // 提交事务
            Db::commit();
            
            // 删除 attach 目录（在事务提交后执行，避免文件系统错误导致事务回滚）
            if (!empty($contest['attach'])) {
                $ojPath = config('OjPath.');
                $attachDir = rtrim($ojPath['PUBLIC'], '/') . rtrim($ojPath['contest_ATTACH'], '/') . '/' . $contest['attach'];
                if (is_dir($attachDir) && function_exists('DelWhatever')) {
                    @DelWhatever($attachDir);
                }
            }
            
            return ['code' => 1, 'msg' => '删除成功'];
        } catch (\Exception $e) {
            // 回滚事务
            Db::rollback();
            return ['code' => 0, 'msg' => '删除失败：' . $e->getMessage()];
        }
    }
}

