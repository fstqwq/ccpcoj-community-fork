<?php
namespace app\exadmin\controller;
use app\admin\controller\Problem as AdminProblem;

/**
 * exadmin Problem 控制器
 * 继承 admin/Problem：
 * - 放通课程教师访问“题目列表”类接口（只读）
 * - 注入 course_item 联查，实现“仅本课程题目”过滤
 */
class Problem extends AdminProblem
{
    /**
     * exadmin：课程内题目编辑权限（用于“OJ 题 problem”的编辑）
     * 规则：
     * - 全局管理员 / problem_editor：允许
     * - 课程 admin/super：允许编辑本课程题目（通过 course_item 归属判断）
     * - 课程 teacher：仅允许看列表（不允许编辑）
     */
    protected function CanEditCourseProblem($problem_id)
    {
        if (IsAdmin('administrator') || IsAdmin('super_admin') || IsAdmin('problem_editor')) {
            return true;
        }
        if (!function_exists('PrivCourse')) {
            return false;
        }
        if (!($this->NOW_COURSE_ID ?? null)) {
            return false;
        }
        // 必须是课程管理员（admin 已包含 super）
        // 注意：PrivCourse('admin') 已包含 super 权限的检查
        if (!PrivCourse('admin', $this->NOW_COURSE_KEY)) {
            return false;
        }
        $pid = intval($problem_id);
        if ($pid <= 0) return false;
        // 必须属于当前课程
        $q = db('course_item')->where([
            'course_id' => intval($this->NOW_COURSE_ID),
            'item' => 'problem',
            'item_id' => $pid,
        ])->where(function($qq) {
            $qq->whereNull('pvrole')->whereOr('pvrole', '');
        });
        return $q->count() > 0;
    }

    protected function ensureProblemEditAccess(string $problem_id): void
    {
        if (!$this->CanEditCourseProblem($problem_id) && !PrivItem('problem', $problem_id, 'admin')) {
            $this->error('You cannot edit this problem');
        }
    }

    protected function problemEditAjaxShouldSaveCooperator(int $problem_id): bool
    {
        return PrivItem('problem', $problem_id, 'admin');
    }

    protected function problemEditAjaxAfterNewProblemInserted(int $problem_id, array $problem_update): void
    {
        $this->AddPrivilege(session('user_id'), 'problem', $problem_id);
    }

    /**
     * exadmin：补齐 course_item 映射（本类继承 admin/Problem，不经过 Exadminbase::afterInsertData）
     * 新建题目走 problem_edit_ajax（problem_id 为空）插入 problem 时依赖此处，否则下一跳带 problem_id 会触发「目标资源未关联课程组」
     *
     * @param array $data
     * @param string $tableName
     * @param int|null $insertId
     * @return void
     */
    protected function afterInsertData($data, $tableName = '', $insertId = null)
    {
        if ($tableName !== 'problem' || !$this->NOW_COURSE_ID || $insertId === null) {
            return;
        }
        // course_item 有唯一键 (course_id,item,item_id,pvrole)，INSERT IGNORE 避免重复
        try {
            \think\Db::execute(
                'INSERT IGNORE INTO course_item (course_id,item,item_id,pvrole) VALUES (' .
                intval($this->NOW_COURSE_ID) . ",'problem'," . intval($insertId) . ",'' )"
            );
        } catch (\Throwable $e) {
            // 与 contest_add 一致：避免主流程 500
        }
    }

    /**
     * 与 Exadminbase 一致：PDF / 父类 validateItemBelong 调用点对 problem 走 course_item 校验
     */
    protected function validateItemBelong($item, $itemType = '')
    {
        $courseItemTypes = ['contest', 'problem', 'news', 'ex_question'];
        if (in_array($itemType, $courseItemTypes, true)) {
            $this->CourseBelongValidate($item, $itemType);
        }
    }

    /**
     * exadmin：课程内题目列表需要给 course admin/super 打开 edit/testdata 按钮
     */
    public function problem_list_ajax()
    {
        // 直接复用父类查询逻辑（已通过 getQueryFilter 注入 course_item 联查，保证"本课程题目"）
        $ret = parent::problem_list_ajax();

        // 父类在 ajax 时返回 json(Response)，这里需要取出数据再二次加工
        if ($ret instanceof \think\response\Json) {
            $data = $ret->getData();
            if (is_array($data) && isset($data['rows']) && is_array($data['rows'])) {
                $canEditAll = $this->CanEditCourseProblem(1); // 只检查"身份"部分
                if ($canEditAll) {
                    // 批量获取所有题目的 problem_id
                    $problem_ids = [];
                    foreach ($data['rows'] as $row) {
                        $problem_id = intval($row['problem_id'] ?? 0);
                        if ($problem_id > 0) {
                            $problem_ids[] = $problem_id;
                        }
                    }
                    
                    // 批量查询：一次性获取所有题目的 solution 和 contest_problem 统计
                    $has_solution = [];
                    $has_contest_problem = [];
                    if (!empty($problem_ids)) {
                        [$has_solution, $has_contest_problem] = $this->problemDeleteEligibilityMaps($problem_ids);
                    }
                    
                    // 设置每行的权限和删除标志
                    foreach ($data['rows'] as &$row) {
                        $row['is_admin'] = true;
                        $row['edit'] = 1;
                        $row['testdata'] = 1;
                        $this->problemDeleteApplyEligibilityToRow($row, $has_solution, $has_contest_problem);
                    }
                    unset($row);
                }
            }
            return json($data);
        }

        // 非 ajax（理论上不会走到这里），保持原行为
        return $ret;
    }

    public function problem_edit($copy_mode = false)
    {
        $problem_id = trim(input('id'));
        $this->ensureProblemEditAccess($problem_id);
        $problem = db('problem')->where('problem_id', $problem_id)->find();
        if ($problem == null) {
            $this->error('No such problem.');
        }
        // exadmin：确保题目属于当前课程
        if ($this->NOW_COURSE_ID) {
            $belongs = db('course_item')->where([
                'course_id' => intval($this->NOW_COURSE_ID),
                'item' => 'problem',
                'item_id' => intval($problem_id),
            ])->where(function($q) {
                $q->whereNull('pvrole')->whereOr('pvrole', '');
            })->count() > 0;
            if (!$belongs) {
                $this->error('目标资源未关联课程组');
            }
        }

        $problem = problem_locale_overlay_problem_with_default_md($problem);

        // cooperator：课程管理员编辑“课程题目”不要求有 privilege_item(problem) 记录，因此这里只显示空（避免 GetCooperator 的 PrivItem 校验报错）
        $cooperator = [];
        if (PrivItem('problem', $problem_id, 'admin')) {
            $cooperator = $this->GetCooperator($problem['problem_id']);
        }

        $this->assign([
            'problem'         => $problem,
            'cooperator'    => implode(",", $cooperator),
            'item_priv'     => true,
            'copy_mode'     => $copy_mode,
        ]);
        $this->assignProblemLocaleEditExtras($problem_id, (bool) $copy_mode);
        return $this->fetch('problem_edit');
    }

    public function problem_edit_ajax()
    {
        $problem_id = input('problem_id/s');
        if ($problem_id !== null) {
            $problem_id = trim((string) $problem_id);
            if ($problem_id === '') {
                $problem_id = null;
            }
        }
        $problem_copy_id = input('problem_copy_id/s');
        $problem_item = null;
        if ($problem_id !== null) {
            $this->ensureProblemEditAccess($problem_id);
            $problem_item = db('problem')->where('problem_id', $problem_id)->find();
            if ($problem_item == null) {
                $this->error('No such problem.');
            }
            if ($this->NOW_COURSE_ID) {
                $belongs = db('course_item')->where([
                    'course_id' => intval($this->NOW_COURSE_ID),
                    'item' => 'problem',
                    'item_id' => intval($problem_id),
                ])->where(function($q) {
                    $q->whereNull('pvrole')->whereOr('pvrole', '');
                })->count() > 0;
                if (!$belongs) {
                    $this->error('目标资源未关联课程组');
                }
            }
        } else {
            if (!IsAdmin('administrator') && !IsAdmin('super_admin') && !IsAdmin('problem_editor')
                && !(function_exists('PrivCourse') && PrivCourse('admin', $this->NOW_COURSE_KEY))) {
                $this->error('无课程权限');
            }
        }

        $this->problemEditAjaxPersistCore($problem_id, $problem_copy_id, $problem_item);
    }

    /**
     * 重写：课程维度权限校验
     * - 全局管理员/题目编辑：放通
     * - 课程 teacher/admin/super：允许访问题目管理模块（至少可看列表）
     */
    public function BaseAuthentication($privilegeStr)
    {
        // 仅对 problem 做放通，其它类型仍走父类逻辑
        if ($privilegeStr !== 'problem') {
            return parent::BaseAuthentication($privilegeStr);
        }

        if (!IsLogin()) {
            $this->error('Please loggin first.', '/', null, 1);
        }

        // 全局管理员/题目编辑权限
        if (IsAdmin('administrator') || IsAdmin('super_admin') || IsAdmin('problem_editor')) {
            return;
        }

        // 课程权限：teacher/admin（admin 已包含 super）允许查看本课程题目列表
        // 注意：PrivCourse('admin') 已包含 super 权限的检查
        if (function_exists('PrivCourse') && (
            PrivCourse('teacher', $this->NOW_COURSE_KEY) ||
            PrivCourse('admin', $this->NOW_COURSE_KEY)
        )) {
            return;
        }

        $this->error("You don't have this privilege", '/'.$this->request->module(), '', 1);
    }

    /**
     * 重写：注入 course_item 联查（仅显示当前课程的题目）
     * @param string $tableName
     * @return array|null
     */
    protected function getQueryFilter($tableName = '')
    {
        if ($tableName !== 'problem' || !$this->NOW_COURSE_ID) {
            return null;
        }

        return [
            'join' => [
                'course_item ci',
                "ci.item_id = problem.problem_id AND ci.item = 'problem'",
                'inner'
            ],
            'where' => [
                'ci.course_id' => $this->NOW_COURSE_ID,
            ]
            ,
            // 兼容历史数据：pvrole 可能是 NULL 或空字符串
            'where_func' => function($q) {
                $q->where(function($qq) {
                    $qq->whereNull('ci.pvrole')->whereOr('ci.pvrole', '');
                });
            }
        ];
    }

    /**
     * 重写 index 方法，设置正确的 ajax_url 为 /exadmin/...
     */
    public function index()
    {
        $this->assign([
            'prolist_mode' => 'admin',
            'search_spj' => input('spj', -1),
            'table_prefix' => 'problem',
            'table_id' => 'admin_problemlist_table',
            'ajax_url' => '/exadmin/problem/problem_list_ajax', // 使用 exadmin 模块的 URL
            'page_title' => 'OJ题目列表',
            'page_title_en' => 'Problem List',
            'search_placeholder' => '题号/标题/来源/作者',
            'page_size' => 50,
            'cookie_expire' => '5mi',
            'cookie_suffix' => '',
            'filter_selectors' => ['spj', 'defunct'],
            'custom_handlers' => '',
            'problem_delete_ajax_url' => '/exadmin/problem/problem_delete_ajax',
            'pagetitle' => 'OJ题目列表',
            'pagetitle_en' => 'Problem List',
        ]);
        return $this->fetch();
    }
    
    /**
     * 重写 AddPrivilege 方法，使用全局函数（统一管理）
     * 在 OJ_STATUS=exp 模式下，创建新资源时不检查权限（checkPrivilege=false）
     */
    public function AddPrivilege($user_id, $item, $id)
    {
        // exp 模式下创建新资源时，不检查权限（因为资源刚创建，还没有权限记录）
        $checkPrivilege = ($this->OJ_STATUS != 'exp');
        try {
            AddPrivilege($user_id, $item, $id, $checkPrivilege, 'admin');
        } catch (\Exception $e) {
            $this->error($e->getMessage());
        }
    }
    
    /**
     * 删除题目（AJAX）
     */
    public function problem_delete_ajax()
    {
        $problem_id = intval(request()->post('problem_id', 0));
        
        if ($problem_id <= 0) {
            return json(['code' => 0, 'msg' => '无效的题目ID']);
        }
        
        // 权限检查：只有 course admin/super/global admin 或题目拥有者可以删除
        $is_global_admin = IsAdmin('administrator') || IsAdmin('super_admin') || IsAdmin('problem_editor');
        $can_edit = $this->CanEditCourseProblem($problem_id);
        $is_owner = PrivItem('problem', $problem_id, 'admin');
        
        if (!$is_global_admin && !$can_edit && !$is_owner) {
            return json(['code' => 0, 'msg' => '您没有权限删除该题目']);
        }
        
        // 检查该题目是否存在
        $problem = db('problem')->where('problem_id', $problem_id)->find();
        if (!$problem) {
            return json(['code' => 0, 'msg' => '题目不存在']);
        }
        
        $err = $this->problemDeleteValidateRefs($problem_id);
        if ($err !== null) {
            return json(['code' => 0, 'msg' => $err]);
        }
        try {
            $this->problemDeleteExecuteAfterChecks($problem, $problem_id);
            return json(['code' => 1, 'msg' => '删除成功']);
        } catch (\Exception $e) {
            return json(['code' => 0, 'msg' => '删除失败：' . $e->getMessage()]);
        }
    }
    
    // 其他方法复用 admin/Problem，course_key 的注入通过 Exadminbase 的钩子方法自动完成
}
