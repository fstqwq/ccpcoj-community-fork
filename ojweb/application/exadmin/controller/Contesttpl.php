<?php

namespace app\exadmin\controller;

/**
 * exp 练习：模板管理（课程管理员及以上）
 */
class Contesttpl extends Exadminbase
{
    protected function initTemplateManageAuth()
    {
        if ($this->OJ_MODE !== 'online' || $this->OJ_STATUS !== 'exp') {
            $this->error('当前模式无此功能', '/');
        }
        if (empty($this->NOW_COURSE_ID) || empty($this->NOW_COURSE_KEY)) {
            $this->error('请在课程内操作', '/course');
        }
        if (!PrivCourse('admin', $this->NOW_COURSE_KEY)
            && !IsAdmin('contest_editor')
            && !IsAdmin('administrator')) {
            $this->error('需要课程管理员或全局赛事编辑权限', '/');
        }
    }

    /**
     * 校验 contest 属于当前课程（course_item）
     */
    protected function assertContestInCurrentCourse($contest_id)
    {
        $contest_id = intval($contest_id);
        if ($contest_id <= 0) {
            $this->error('无效的练习');
        }
        $n = db('course_item')->where([
            'course_id' => intval($this->NOW_COURSE_ID),
            'item' => 'contest',
            'item_id' => $contest_id,
        ])->where(function ($q) {
            $q->whereNull('pvrole')->whereOr('pvrole', '');
        })->count();
        if ($n < 1) {
            $this->error('练习不属于当前课程');
        }
    }

    /**
     * @param mixed $rawAddition
     * @return array
     */
    protected function parseAdditionArray($rawAddition)
    {
        if (empty($rawAddition)) {
            return [];
        }
        if (is_string($rawAddition)) {
            $arr = Json2Array($rawAddition);
            return is_array($arr) ? $arr : [];
        }
        if (is_array($rawAddition)) {
            return $rawAddition;
        }
        return [];
    }

    /**
     * @param mixed $rawAddition
     * @param array $expPracticePatch 写入 exp_practice 子键
     * @return string JSON
     */
    protected function mergeExpPracticeIntoAddition($rawAddition, array $expPracticePatch)
    {
        $arr = $this->parseAdditionArray($rawAddition);
        if (!isset($arr['exp_practice']) || !is_array($arr['exp_practice'])) {
            $arr['exp_practice'] = [];
        }
        foreach ($expPracticePatch as $k => $v) {
            if ($v === null) {
                unset($arr['exp_practice'][$k]);
            } else {
                $arr['exp_practice'][$k] = $v;
            }
        }
        return json_encode($arr, JSON_UNESCAPED_UNICODE);
    }

    protected function getTemplateMetaFromRow(array $row)
    {
        $add = $this->parseAdditionArray($row['addition'] ?? null);
        $ep = isset($add['exp_practice']) && is_array($add['exp_practice']) ? $add['exp_practice'] : [];
        $tt = isset($ep['template_title']) ? strval($ep['template_title']) : '';
        if ($tt === '') {
            $tt = strval($row['title'] ?? '');
        }
        return [
            'template_title' => $tt,
            'template_label' => isset($ep['template_label']) ? strval($ep['template_label']) : '',
            'template_sort' => isset($ep['template_sort']) ? intval($ep['template_sort']) : 0,
        ];
    }

    /**
     * 当前课程下模板条数（设为模板前调用，用于新模板编号接续）
     */
    protected function getTemplateCountInCourse(): int
    {
        return intval($this->baseContestCourseQuery(true)->count());
    }

    /**
     * @param array[] $rows
     * @return array[]
     */
    protected function attachTeachersTextToRows(array $rows)
    {
        $clss_ids = [];
        foreach ($rows as $r) {
            $cid = intval($r['clss_id'] ?? 0);
            if ($cid > 0) {
                $clss_ids[$cid] = true;
            }
        }
        $clss_ids = array_keys($clss_ids);
        $teachers_map = [];
        $uids = [];
        if (!empty($clss_ids)) {
            $pvrole_teacher = GetPvroleConfig('clss_teacher', 'teacher');
            $tl = db('privilege_item')->where([
                'rightitem' => 'clss',
                'pvrole' => $pvrole_teacher,
                'defunct' => '0',
            ])->where('item_id', 'in', $clss_ids)->field(['item_id', 'user_id'])->select();
            foreach ($tl as $t) {
                $cid = intval($t['item_id']);
                $uid = strval($t['user_id']);
                if (!isset($teachers_map[$cid])) {
                    $teachers_map[$cid] = [];
                }
                $teachers_map[$cid][] = $uid;
                $uids[$uid] = true;
            }
        }
        $nick = [];
        $userRow = [];
        if (!empty($uids)) {
            $ul = db('users')->where('user_id', 'in', array_keys($uids))
                ->field(['user_id', 'nick', 'school'])->select();
            foreach ($ul as $u) {
                $uidk = strval($u['user_id']);
                $nick[$uidk] = $u['nick'] ?: $u['user_id'];
                $userRow[$uidk] = [
                    'user_id' => $uidk,
                    'nick' => $nick[$uidk],
                    'school' => isset($u['school']) ? strval($u['school']) : '',
                ];
            }
        }
        foreach ($rows as &$r) {
            $cid = intval($r['clss_id'] ?? 0);
            $parts = [];
            $teachersArr = [];
            if ($cid > 0 && !empty($teachers_map[$cid])) {
                foreach (array_unique($teachers_map[$cid]) as $uid) {
                    $parts[] = isset($nick[$uid]) ? $nick[$uid] : $uid;
                    if (isset($userRow[$uid])) {
                        $teachersArr[] = $userRow[$uid];
                    } else {
                        $teachersArr[] = ['user_id' => $uid, 'nick' => $uid, 'school' => ''];
                    }
                }
            }
            $r['teachers_text'] = implode('、', $parts);
            $r['teachers'] = $teachersArr;
        }
        unset($r);
        return $rows;
    }

    /**
     * @param bool $onlyTemplate flg_archive 非 0
     * @return \think\db\Query
     */
    protected function baseContestCourseQuery($onlyTemplate)
    {
        $q = db('contest')->alias('c')
            ->join('course_item ci', "ci.item_id = c.contest_id AND ci.item = 'contest'", 'inner')
            ->where('ci.course_id', intval($this->NOW_COURSE_ID))
            ->where(function ($qq) {
                $qq->whereNull('ci.pvrole')->whereOr('ci.pvrole', '');
            })
            ->join('clss cl', 'c.clss_id = cl.clss_id', 'left')
            ->where('c.private', 'in', [4, 14]);
        if ($onlyTemplate) {
            $q->whereRaw('IFNULL(c.flg_archive,0) <> 0');
        } else {
            $q->where(function ($qq) {
                $qq->whereNull('c.flg_archive')->whereOr('c.flg_archive', 0);
            });
        }
        return $q;
    }

    public function template_manage()
    {
        $this->initTemplateManageAuth();
        $this->assign('pagetitle', '练习模板管理');
        $this->assign('module', 'exadmin');
        $this->assign('controller', 'contest');
        $this->assign('isAdmin', IsAdmin());
        $this->assign('NOW_COURSE_KEY', strval($this->NOW_COURSE_KEY ?? ''));
        return $this->fetch();
    }

    /**
     * 模板列表（客户端分页）
     */
    public function template_list_ajax()
    {
        $this->initTemplateManageAuth();
        $list = $this->baseContestCourseQuery(true)
            ->field([
                'c.contest_id', 'c.title', 'c.private', 'c.clss_id', 'c.addition', 'c.flg_archive',
                'c.start_time', 'c.end_time', 'c.defunct',
                'cl.clss_title', 'cl.clss_year', 'cl.clss_semester',
            ])
            ->order('c.contest_id', 'desc')
            ->select();
        $out = [];
        foreach ($list as $r) {
            $meta = $this->getTemplateMetaFromRow($r);
            $out[] = [
                'contest_id' => intval($r['contest_id']),
                'title' => strval($r['title'] ?? ''),
                'template_title' => $meta['template_title'],
                'template_label' => $meta['template_label'],
                'template_sort' => $meta['template_sort'],
                'start_time' => strval($r['start_time'] ?? ''),
                'end_time' => strval($r['end_time'] ?? ''),
                'defunct' => strval($r['defunct'] ?? '0'),
                'clss_id' => intval($r['clss_id'] ?? 0),
                'clss_title' => strval($r['clss_title'] ?? ''),
                'clss_year' => $r['clss_year'] ?? null,
                'clss_semester' => isset($r['clss_semester']) ? strval($r['clss_semester']) : '',
                'private' => intval($r['private']),
                'addition' => $r['addition'],
                'is_admin' => true,
                'tpl_remove' => '',
                'tpl_meta' => '',
            ];
        }
        $out = $this->attachTeachersTextToRows($out);
        return $out;
    }

    /**
     * 非模板练习列表（历史接口；「添加模板」Modal 已改用 contest_list_ajax）
     */
    public function template_picker_list_ajax()
    {
        $this->initTemplateManageAuth();
        $list = $this->baseContestCourseQuery(false)
            ->field([
                'c.contest_id', 'c.title', 'c.private', 'c.clss_id',
                'cl.clss_title', 'cl.clss_year', 'cl.clss_semester',
            ])
            ->order('c.contest_id', 'desc')
            ->select();
        $out = [];
        foreach ($list as $r) {
            $ys = '';
            if (isset($r['clss_year']) && strval($r['clss_year']) !== '') {
                $ys = strval($r['clss_year']);
            }
            if (!empty($r['clss_semester'])) {
                $ys .= ($ys !== '' ? ' ' : '') . strval($r['clss_semester']);
            }
            $out[] = [
                'contest_id' => intval($r['contest_id']),
                'title' => strval($r['title'] ?? ''),
                'clss_title' => strval($r['clss_title'] ?? ''),
                'year_semester' => $ys,
                'private' => intval($r['private']),
            ];
        }
        $out = $this->attachTeachersTextToRows($out);
        return $out;
    }

    public function template_promote_ajax()
    {
        $this->initTemplateManageAuth();
        $ids = input('contest_ids/a', []);
        if (!is_array($ids) || empty($ids)) {
            $this->error('请选择练习');
        }
        $ids = array_values(array_unique(array_filter(array_map('intval', $ids))));
        if (empty($ids)) {
            $this->error('请选择练习');
        }
        $nExisting = $this->getTemplateCountInCourse();
        $ok = 0;
        $seq = 0;
        foreach ($ids as $contest_id) {
            $this->assertContestInCurrentCourse($contest_id);
            $row = db('contest')->where('contest_id', $contest_id)->field(['contest_id', 'title', 'addition', 'private'])->find();
            if (!$row) {
                continue;
            }
            $p = intval($row['private']) % 10;
            if ($p !== 4 && $p !== 14) {
                continue;
            }
            $meta = $this->getTemplateMetaFromRow($row);
            $patch = [];
            if ($meta['template_title'] === '') {
                $patch['template_title'] = strval($row['title'] ?? '');
            }
            $seq++;
            $patch['template_sort'] = $nExisting + $seq;
            $addition = $this->mergeExpPracticeIntoAddition($row['addition'], $patch);
            db('contest')->where('contest_id', $contest_id)->update([
                'flg_archive' => 1,
                'addition' => $addition,
            ]);
            $ok++;
        }
        if ($ok < 1) {
            $this->error('未更新任何练习');
        }
        $this->success('已设为模板', null, ['count' => $ok]);
    }

    public function template_demote_ajax()
    {
        $this->initTemplateManageAuth();
        $contest_id = input('contest_id/d', 0);
        $this->assertContestInCurrentCourse($contest_id);
        $row = db('contest')->where('contest_id', $contest_id)->field(['addition'])->find();
        if (!$row) {
            $this->error('练习不存在');
        }
        $addition = $this->mergeExpPracticeIntoAddition($row['addition'], [
            'template_title' => null,
            'template_label' => null,
            'template_sort' => null,
        ]);
        db('contest')->where('contest_id', $contest_id)->update([
            'flg_archive' => 0,
            'addition' => $addition,
        ]);
        $this->success('已取消模板');
    }

    public function template_meta_edit_ajax()
    {
        $this->initTemplateManageAuth();
        $contest_id = input('contest_id/d', 0);
        $this->assertContestInCurrentCourse($contest_id);
        $row = db('contest')->where('contest_id', $contest_id)->field(['contest_id', 'addition', 'flg_archive', 'title'])->find();
        if (!$row) {
            $this->error('练习不存在');
        }
        if (intval($row['flg_archive'] ?? 0) === 0) {
            $this->error('该练习不是模板');
        }
        $title = trim(strval(input('title/s', '')));
        $template_title = trim(strval(input('template_title/s', '')));
        $template_label = trim(strval(input('template_label/s', '')));
        $template_sort = input('template_sort/d', 0);
        if ($title === '') {
            $this->error('练习标题不能为空');
        }
        if ($template_title === '') {
            $this->error('模板标题不能为空');
        }
        $addition = $this->mergeExpPracticeIntoAddition($row['addition'], [
            'template_title' => $template_title,
            'template_label' => $template_label,
            'template_sort' => intval($template_sort),
        ]);
        db('contest')->where('contest_id', $contest_id)->update([
            'title' => $title,
            'addition' => $addition,
        ]);
        $this->success('已保存');
    }

    /**
     * 模板编号快捷 ±1（不小于 0）
     */
    public function template_sort_delta_ajax()
    {
        $this->initTemplateManageAuth();
        $contest_id = input('contest_id/d', 0);
        $delta = input('delta/d', 0);
        if ($contest_id <= 0 || ($delta !== 1 && $delta !== -1)) {
            $this->error('参数无效');
        }
        $this->assertContestInCurrentCourse($contest_id);
        $row = db('contest')->where('contest_id', $contest_id)->field(['contest_id', 'addition', 'flg_archive'])->find();
        if (!$row || intval($row['flg_archive'] ?? 0) === 0) {
            $this->error('不是模板练习');
        }
        $meta = $this->getTemplateMetaFromRow($row);
        $next = max(0, $meta['template_sort'] + $delta);
        $addition = $this->mergeExpPracticeIntoAddition($row['addition'], [
            'template_sort' => $next,
        ]);
        db('contest')->where('contest_id', $contest_id)->update(['addition' => $addition]);
        $this->success('已更新', null, ['template_sort' => $next]);
    }

    /**
     * 将勾选模板按当前编号、模板标题、练习 ID 排序后，重排为连续编号 1…n（仅更新所选行）
     */
    public function template_reindex_ajax()
    {
        $this->initTemplateManageAuth();
        $rawIds = input('post.contest_ids', '');
        $ids = is_array($rawIds) ? $rawIds : (json_decode(strval($rawIds), true) ?: []);
        $ids = array_values(array_unique(array_map('intval', $ids)));
        $ids = array_filter($ids, function ($x) {
            return $x > 0;
        });
        if (count($ids) < 1) {
            $this->error('请先勾选需要重排的模板');
        }
        if (count($ids) > 500) {
            $this->error('一次最多重排 500 条');
        }
        $rows = [];
        foreach ($ids as $contest_id) {
            $this->assertContestInCurrentCourse($contest_id);
            $r = db('contest')->where('contest_id', $contest_id)
                ->field(['contest_id', 'title', 'addition', 'flg_archive'])
                ->find();
            if (!$r || intval($r['flg_archive'] ?? 0) === 0) {
                continue;
            }
            $meta = $this->getTemplateMetaFromRow($r);
            $rows[] = [
                'contest_id' => intval($r['contest_id']),
                'addition_raw' => $r['addition'],
                'template_sort' => $meta['template_sort'],
                'template_title' => $meta['template_title'],
                'title' => strval($r['title'] ?? ''),
            ];
        }
        if (count($rows) < 1) {
            $this->error('所选行中没有有效模板');
        }
        usort($rows, function ($a, $b) {
            if ($a['template_sort'] !== $b['template_sort']) {
                return $a['template_sort'] - $b['template_sort'];
            }
            $ta = $a['template_title'] !== '' ? $a['template_title'] : $a['title'];
            $tb = $b['template_title'] !== '' ? $b['template_title'] : $b['title'];
            $c = strcmp($ta, $tb);
            if ($c !== 0) {
                return $c;
            }
            return $a['contest_id'] - $b['contest_id'];
        });
        $n = 0;
        foreach ($rows as $r) {
            $n++;
            $addition = $this->mergeExpPracticeIntoAddition($r['addition_raw'], [
                'template_sort' => $n,
            ]);
            db('contest')->where('contest_id', $r['contest_id'])->update(['addition' => $addition]);
        }
        $this->success('已重排 ' . $n . ' 个所选模板编号', null, ['count' => $n]);
    }

    /**
     * 批量正则替换所选模板的「模板标题」（写入 addition.exp_practice.template_title）
     */
    public function template_bulk_title_replace_ajax()
    {
        $this->initTemplateManageAuth();
        $pattern = strval(input('post.pattern', ''));
        $replacement = strval(input('post.replacement', ''));
        if ($pattern === '') {
            $this->error('正则表达式不能为空');
        }
        if (strlen($pattern) > 800) {
            $this->error('正则过长');
        }
        $rawIds = input('post.contest_ids', '');
        $ids = is_array($rawIds) ? $rawIds : (json_decode(strval($rawIds), true) ?: []);
        $ids = array_values(array_unique(array_map('intval', $ids)));
        $ids = array_filter($ids, function ($x) {
            return $x > 0;
        });
        if (count($ids) < 1) {
            $this->error('请先勾选模板');
        }
        if (count($ids) > 200) {
            $this->error('一次最多处理 200 条');
        }
        $del = '#';
        $body = str_replace($del, '\\' . $del, $pattern);
        $regex = $del . $body . $del . 'u';
        $probe = @preg_replace($regex, '', 'x');
        if ($probe === null) {
            $this->error('正则无效：' . $this->pregLastErrorMessage());
        }
        $ok = 0;
        foreach ($ids as $contest_id) {
            $this->assertContestInCurrentCourse($contest_id);
            $row = db('contest')->where('contest_id', $contest_id)
                ->field(['contest_id', 'title', 'addition', 'flg_archive'])
                ->find();
            if (!$row || intval($row['flg_archive'] ?? 0) === 0) {
                continue;
            }
            $meta = $this->getTemplateMetaFromRow($row);
            $before = $meta['template_title'];
            $after = @preg_replace($regex, $replacement, $before);
            if ($after === null) {
                $this->error('替换失败（正则执行错误），请检查表达式');
            }
            $after = strval($after);
            if (trim($after) === '') {
                $this->error('替换后模板标题不能为空（contest_id=' . intval($contest_id) . '）');
            }
            if (strlen($after) > 255) {
                $this->error('替换后模板标题超过 255 字（contest_id=' . intval($contest_id) . '）');
            }
            if ($after === $before) {
                continue;
            }
            $addition = $this->mergeExpPracticeIntoAddition($row['addition'], [
                'template_title' => $after,
            ]);
            db('contest')->where('contest_id', $contest_id)->update(['addition' => $addition]);
            $ok++;
        }
        if ($ok < 1) {
            $this->error('没有行被更新（可能均无匹配或与替换结果相同）');
        }
        $this->success('已更新 ' . $ok . ' 条模板标题', null, ['count' => $ok]);
    }

    /**
     * @return string
     */
    protected function pregLastErrorMessage()
    {
        $code = preg_last_error();
        $map = [
            PREG_NO_ERROR => 'PREG_NO_ERROR',
            PREG_INTERNAL_ERROR => 'PREG_INTERNAL_ERROR',
            PREG_BACKTRACK_LIMIT_ERROR => 'PREG_BACKTRACK_LIMIT_ERROR',
            PREG_RECURSION_LIMIT_ERROR => 'PREG_RECURSION_LIMIT_ERROR',
            PREG_BAD_UTF8_ERROR => 'PREG_BAD_UTF8_ERROR',
            PREG_BAD_UTF8_OFFSET_ERROR => 'PREG_BAD_UTF8_OFFSET_ERROR',
            PREG_JIT_STACKLIMIT_ERROR => 'PREG_JIT_STACKLIMIT_ERROR',
        ];
        return isset($map[$code]) ? $map[$code] : ('code=' . strval($code));
    }
}
