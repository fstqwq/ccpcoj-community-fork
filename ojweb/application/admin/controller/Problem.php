<?php

/**
 * Created by PhpStorm.
 * User: CSGrandeur
 * Date: 2017/3/2
 * Time: 20:25
 */

namespace app\admin\controller;

use app\common\traits\ProblemDeleteTrait;
use think\Db;

class Problem extends Adminbase
{
    use ProblemDeleteTrait;

    /** 基于题号重判时，单次请求最多题数（与前端一致） */
    private const PROBLEM_REJUDGE_MAX_IDS = 20;
    //***************************************************************//
    //Problem
    //***************************************************************//
    public function index()
    {
        $this->assign([
            'prolist_mode' => 'admin',
            'search_spj' => input('spj', -1),
            'table_prefix' => 'problem',
            'table_id' => 'admin_problemlist_table',
            'ajax_url' => '/admin/problem/problem_list_ajax',
            'page_title' => '',
            'page_title_en' => '',
            'search_placeholder' => '题号/标题/来源/作者',
            'page_size' => 50,
            'cookie_expire' => '5mi',
            'cookie_suffix' => '',
            'filter_selectors' => ['spj', 'defunct'],
            'custom_handlers' => '',
            'problem_delete_ajax_url' => '/admin/problem/problem_delete_ajax',
        ]);
        return $this->fetch();
    }
    public function problem_list_ajax() {
        $columns = ['problem_id', 'title', 'in_date', 'source', 'author', 'defunct', 'spj'];
        if ($this->OJ_OPEN_ARCHIVE) {
            $columns[] = 'archived';
        }
        $offset        = intval(input('offset'));
        $limit        = intval(input('limit'));
        $sort        = trim(input('sort'));
        $sort       = validate_item_range($sort, $columns);
        $order        = input('order');
        $search        = trim(input('search/s'));

        // 新增筛选参数
        $spj_filter = input('spj', -1);
        $defunct_filter = input('defunct', -1);
        $ret = [];
        $ordertype = [];
        if (strlen($sort) > 0) {
            $ordertype = [
                $sort => $order
            ];
        }
        $Problem = db('problem');
        
        // ThinkPHP 5.1 正确语法：使用链式调用构建查询条件
        if (strlen($search) > 0) {
            // problem_id 使用精确匹配，title|source|author 使用 LIKE 匹配（OR 关系）
            $Problem->where(function($query) use ($search) {
                $query->where('problem_id', $search)
                      ->whereOr('title', 'like', "%$search%")
                      ->whereOr('source', 'like', "%$search%")
                      ->whereOr('author', 'like', "%$search%");
            });
        }

        // 添加spj筛选
        if ($spj_filter != -1) {
            $Problem->where('spj', $spj_filter);
        }

        // 添加defunct筛选
        if ($defunct_filter != -1) {
            $Problem->where('defunct', $defunct_filter);
        }
        
        // 应用查询过滤钩子（用于注入 course_item 联查等条件）
        $Problem = $this->applyQueryFilterToQuery($Problem, [], 'problem');
        $problemList = $Problem
            ->field($columns)
            ->limit($offset, $limit)
            ->order($ordertype)
            ->select();
        foreach ($problemList as &$problem) {
            if (PrivItem($this->privilegeStr, $problem['problem_id'], 'admin')) {
                $problem['is_admin'] = true; // 有权限管理该题
                $problem['edit'] = 1;
                $problem['testdata'] = 1;
            } else {
                $problem['is_admin'] = false;
                // $problem['defunct'] = $problem['defunct'] == '0' ? "<span class='text-success'>Available</span>" : "<span class='text-warning'>Reserved</span>";
                $problem['edit'] = 0;
                $problem['testdata'] = 0;
            }
            // $problem['source'] = htmlspecialchars($problem['source']);
            // $problem['author'] = htmlspecialchars($problem['author']);
        }
        unset($problem);

        $admin_problem_ids = [];
        foreach ($problemList as $p) {
            if (!empty($p['is_admin'])) {
                $admin_problem_ids[] = intval($p['problem_id']);
            }
        }
        [$has_solution, $has_contest_problem] = $this->problemDeleteEligibilityMaps($admin_problem_ids);
        foreach ($problemList as &$problem) {
            if (!empty($problem['is_admin'])) {
                $this->problemDeleteApplyEligibilityToRow($problem, $has_solution, $has_contest_problem);
            } else {
                $problem['can_delete'] = 0;
                $problem['delete_reason'] = '您没有该题目的管理权限，无法删除';
            }
        }
        unset($problem);

        problem_list_overlay_rows_default_md_source_author($problemList);

        // ThinkPHP 5.1 正确语法：使用链式调用构建查询条件（用于统计总数）
        $ProblemTotal = db('problem');
        if (strlen($search) > 0) {
            // problem_id 使用精确匹配，title|source|author 使用 LIKE 匹配（OR 关系）
            $ProblemTotal->where(function($query) use ($search) {
                $query->where('problem_id', $search)
                      ->whereOr('title', 'like', "%$search%")
                      ->whereOr('source', 'like', "%$search%")
                      ->whereOr('author', 'like', "%$search%");
            });
        }
        // 添加spj筛选条件
        if ($spj_filter != -1) {
            $ProblemTotal->where('spj', $spj_filter);
        }
        // 添加defunct筛选条件
        if ($defunct_filter != -1) {
            $ProblemTotal->where('defunct', $defunct_filter);
        }
        // 应用查询过滤钩子（用于注入 course_item 联查等条件）
        $ProblemTotal = $this->applyQueryFilterToQuery($ProblemTotal, [], 'problem');
        $ret['total'] = $ProblemTotal->count();
        $ret['order'] = $order;
        $ret['rows'] = $problemList;

        // 如果是 AJAX 请求，返回 JSON 格式
        if (request()->isAjax()) {
            return json($ret);
        }

        return $ret;
    }

    /**
     * 列表快捷保存：Pandoc 会把无 Markdown 结构的纯文本包成单段 &lt;p&gt;…&lt;/p&gt;，与单行输入预期不符；若整段仅为该形态且无内联 HTML，则落库为解码后的纯文本。
     *
     * @param string $html ParseMarkdown 返回值
     */
    protected function problemListQuickSaveCollapseTrivialParagraph(string $html): string
    {
        $t = trim($html);
        if ($t === '') {
            return '';
        }
        if (!preg_match('/^<p(?:\s[^>]*)?>([\s\S]*)<\/p>\s*$/i', $t, $m)) {
            return $html;
        }
        $inner = $m[1];
        if (strpos($inner, '<') !== false) {
            return $html;
        }
        return html_entity_decode(trim($inner), ENT_QUOTES | ENT_HTML5, 'UTF-8');
    }

    /**
     * 题目列表「快捷编辑」单行保存（仅标题、来源、出题人；与首选语言 problem_md 同步 source/author）
     */
    public function problem_list_quick_save_ajax()
    {
        if (!request()->isPost()) {
            return json(['code' => 0, 'msg' => '请使用 POST 提交<br/><span class="en-text">POST required</span>']);
        }
        $problem_id = intval(request()->post('problem_id', 0));
        if ($problem_id <= 0) {
            return json(['code' => 0, 'msg' => '无效的题目ID']);
        }
        $this->ensureProblemEditAccess((string) $problem_id);
        $problem = db('problem')->where('problem_id', $problem_id)->find();
        if (!$problem) {
            return json(['code' => 0, 'msg' => '题目不存在']);
        }
        $this->validateItemBelong($problem, 'problem');

        $title = trim((string) request()->post('title', ''));
        $sourceMd = trim((string) request()->post('source', ''));
        $authorMd = trim((string) request()->post('author', ''));

        if ($title === '') {
            return json(['code' => 0, 'msg' => '标题不能为空<br/><span class="en-text">Title is required</span>']);
        }
        if (mb_strlen($title, 'UTF-8') > 200) {
            return json(['code' => 0, 'msg' => '标题过长（最多 200 字符）<br/><span class="en-text">Title too long (max 200)</span>']);
        }
        if (mb_strlen($sourceMd, 'UTF-8') > 255) {
            return json(['code' => 0, 'msg' => '来源（Markdown 原文）过长（最多 255 字符）<br/><span class="en-text">Source (Markdown) too long (max 255)</span>']);
        }
        if (mb_strlen($authorMd, 'UTF-8') > 255) {
            return json(['code' => 0, 'msg' => '出题（Markdown 原文）过长（最多 255 字符）<br/><span class="en-text">Author (Markdown) too long (max 255)</span>']);
        }

        // problem 主表：与 problem_edit_ajax 一致存 ParseMarkdown 后的 HTML
        $sourceHtml = $this->problemListQuickSaveCollapseTrivialParagraph(ParseMarkdown($sourceMd));
        $authorHtml = $this->problemListQuickSaveCollapseTrivialParagraph(ParseMarkdown($authorMd));
        if (mb_strlen($sourceHtml, 'UTF-8') > 255) {
            return json(['code' => 0, 'msg' => '来源渲染后过长（最多 255 字符），请缩短 Markdown 或改用编辑页<br/><span class="en-text">Rendered source too long (max 255)</span>']);
        }
        if (mb_strlen($authorHtml, 'UTF-8') > 255) {
            return json(['code' => 0, 'msg' => '出题渲染后过长（最多 255 字符），请缩短 Markdown 或改用编辑页<br/><span class="en-text">Rendered author too long (max 255)</span>']);
        }

        $upd = [
            'title' => $title,
            'source' => $sourceHtml,
            'author' => $authorHtml,
        ];
        $rowsAffected = db('problem')->where('problem_id', $problem_id)->update($upd);
        if ($rowsAffected === false) {
            return json(['code' => 0, 'msg' => '保存失败<br/><span class="en-text">Save failed</span>']);
        }

        $dkey = problem_locale_default_key($problem_id);
        if ($dkey !== '') {
            $exM = db('problem_md')->where(['problem_id' => $problem_id, 'locale_key' => $dkey])->find();
            if (is_array($exM)) {
                // problem_md：存与题目编辑页一致的 Markdown 原文（非 ParseMarkdown 的 HTML）
                db('problem_md')->where(['problem_id' => $problem_id, 'locale_key' => $dkey])->update([
                    'source' => $sourceMd,
                    'author' => $authorMd,
                ]);
                $mdFull = db('problem_md')->where(['problem_id' => $problem_id, 'locale_key' => $dkey])->find();
                if (is_array($mdFull)) {
                    $htmlRow = problem_locale_md_row_to_html_row($mdFull);
                    problem_locale_html_upsert($problem_id, $dkey, $htmlRow);
                }
            }
        }

        return json([
            'code' => 1,
            'msg' => '已保存<br/><span class="en-text">Saved</span>',
            'data' => [
                'problem_id' => $problem_id,
                'title' => $title,
                'source' => $sourceMd,
                'author' => $authorMd,
            ],
        ]);
    }

    /**
     * 题目编辑权限（PDF 上传等复用）
     */
    protected function ensureProblemEditAccess(string $problem_id): void
    {
        if (!PrivItem($this->privilegeStr, $problem_id, 'admin')) {
            $this->error('You cannot edit this problem');
        }
    }

    /**
     * 是否写入协作者（exadmin 无 per-problem 权限时跳过）
     */
    protected function problemEditAjaxShouldSaveCooperator(int $problem_id): bool
    {
        return true;
    }

    /**
     * 新建题目 insert 后钩子（exadmin 用于 privilege_item 等）
     */
    protected function problemEditAjaxAfterNewProblemInserted(int $problem_id, array $problem_update): void
    {
    }

    /**
     * exp：当前课程组 query 片段（供编辑页表单 action、PDF 请求 URL 带参，触发 ConfirmCourseKey）
     */
    protected function buildProblemEditExpCourseQueryString(): string
    {
        if (!isset($this->OJ_STATUS) || $this->OJ_STATUS !== 'exp') {
            return '';
        }
        $key = isset($this->NOW_COURSE_KEY) ? trim((string) $this->NOW_COURSE_KEY) : '';
        if ($key === '' || strtoupper($key) === 'DEFAULT') {
            return '';
        }
        return 'now_course_key=' . rawurlencode($key);
    }

    /**
     * 题目编辑/添加/复制页：题面多语言 + PDF 接口 URL、表单 action、初始 JSON 等（与 `problem_edit` 视图配套，全模式统一）
     */
    protected function assignProblemLocaleEditExtras(string $problem_id, bool $copy_mode): void
    {
        $mod = $this->request->module();
        $base = [
            'problem_pdf_upload'   => '/' . $mod . '/problem/problem_pdf_upload_ajax',
            'problem_pdf_delete'   => '/' . $mod . '/problem/problem_pdf_delete_ajax',
            'problem_pdf_preview'  => '/' . $mod . '/problem/problem_pdf_editor_preview',
        ];
        $expQs = $this->buildProblemEditExpCourseQueryString();
        if ($expQs !== '') {
            foreach (['problem_pdf_upload', 'problem_pdf_delete', 'problem_pdf_preview'] as $uk) {
                $base[$uk] .= '?' . $expQs;
            }
        }
        $formAction = '/' . $mod . '/problem/problem_edit_ajax';
        if ($expQs !== '') {
            $formAction .= '?' . $expQs;
        }
        $ctxAssign = [
            'problem_edit_form_action'       => $formAction,
            'problem_edit_exp_course_qs_json' => json_encode($expQs, JSON_UNESCAPED_UNICODE),
        ];
        if ($problem_id === '' || !ctype_digit($problem_id)) {
            $defaultFirst = [
                '_sid'            => 'p0',
                'locale_key'      => 'main',
                'locale_label'    => '主语言',
                'use_pdf'         => 0,
                'locale_visible'  => 1,
                'description'     => '',
                'input'           => '',
                'output'          => '',
                'hint'            => '',
                'source'          => '',
                'author'          => '',
                'sort_order'      => 1,
            ];
            $this->assign(array_merge($base, $ctxAssign, [
                'problem_locales_json_esc'   => htmlspecialchars(json_encode([$defaultFirst], JSON_UNESCAPED_UNICODE), ENT_QUOTES, 'UTF-8'),
                'problem_id_for_locale_pdf'  => '',
                'problem_locale_pdf_preview_pid' => '',
                'problem_pdf_exists_json_esc' => '{}',
                'problem_locale_new_draft_id' => GenerateUuidV4(),
                'problem_locale_page_copy_mode' => 0,
            ]));
            return;
        }
        $rows = db('problem_locale')->where('problem_id', $problem_id)->order('sort_order asc, locale_key asc')->select();
        if (!is_array($rows)) {
            $rows = [];
        }
        $pidInt = (int) $problem_id;
        $merged = [];
        foreach ($rows as $lr) {
            $k = isset($lr['locale_key']) ? trim((string) $lr['locale_key']) : '';
            if ($k === '') {
                continue;
            }
            $md = db('problem_md')->where(['problem_id' => $pidInt, 'locale_key' => $k])->find();
            if (!is_array($md)) {
                $md = [];
            }
            $merged[] = [
                '_sid'           => 'p' . count($merged),
                'locale_key'     => $k,
                'db_locale_key'  => $k,
                'locale_label'   => (string) ($lr['locale_label'] ?? ''),
                'use_pdf'        => !empty($lr['use_pdf']) ? 1 : 0,
                'locale_visible' => intval($lr['locale_visible'] ?? 1) ? 1 : 0,
                'description'    => (string) ($md['description'] ?? ''),
                'input'          => (string) ($md['input'] ?? ''),
                'output'         => (string) ($md['output'] ?? ''),
                'hint'           => (string) ($md['hint'] ?? ''),
                'source'         => $md['source'] ?? '',
                'author'         => $md['author'] ?? '',
                'sort_order'     => intval($lr['sort_order'] ?? count($merged) + 1),
            ];
        }
        $pdfExists = [];
        foreach ($merged as $mr) {
            $stem = (string) ($mr['locale_key'] ?? '');
            if ($stem === '') {
                continue;
            }
            $pp = problem_locale_pdf_disk_path($pidInt, $stem);
            $pdfExists[$stem] = ($pp !== null && is_file($pp));
        }
        $this->assign(array_merge($base, $ctxAssign, [
            'problem_locales_json_esc'   => htmlspecialchars(json_encode($merged, JSON_UNESCAPED_UNICODE), ENT_QUOTES, 'UTF-8'),
            'problem_id_for_locale_pdf'  => $copy_mode ? '' : $problem_id,
            'problem_locale_pdf_preview_pid' => $problem_id,
            'problem_pdf_exists_json_esc' => htmlspecialchars(json_encode($pdfExists, JSON_UNESCAPED_UNICODE), ENT_QUOTES, 'UTF-8'),
            'problem_locale_new_draft_id' => $copy_mode ? GenerateUuidV4() : '',
            'problem_locale_page_copy_mode' => $copy_mode ? 1 : 0,
        ]));
    }

    public function problem_edit($copy_mode = false)
    {
        $problem_id = trim(input('id'));
        $this->ensureProblemEditAccess($problem_id);
        $problem = db('problem')->where('problem_id', $problem_id)->find();
        if ($problem == null) {
            $this->error('No such problem.');
        }
        // 验证资源归属（用于验证 course_key 等）
        $this->validateItemBelong($problem, 'problem');
        $problem = problem_locale_overlay_problem_with_default_md($problem);
        $cooperator = $this->GetCooperator($problem['problem_id']);
        $this->assign([
            'problem'         => $problem,
            'cooperator'    => implode(",", $cooperator),
            'item_priv'     => PrivItem($this->privilegeStr, $problem_id, 'admin'),
            'copy_mode'     => $copy_mode,
        ]);
        $this->assignProblemLocaleEditExtras($problem_id, (bool) $copy_mode);
        return $this->fetch('problem_edit');
    }

    public function problem_copy()
    {
        return $this->problem_edit(true);
    }

    /**
     * 从 POST 提取可写入 problem 表的字段（fields_strict 兼容）；忽略 token 等杂项。
     * @return array<string,mixed>
     */
    protected function extractProblemFieldsFromPostWhitelist(): array
    {
        $rawPost = input('post.');
        $problemFieldAllow = [
            'title', 'description', 'input', 'output', 'sample_input', 'sample_output',
            'spj', 'hint', 'source', 'author', 'time_limit', 'memory_limit',
        ];
        $problem_update = [];
        foreach ($problemFieldAllow as $fk) {
            if (array_key_exists($fk, $rawPost)) {
                $problem_update[$fk] = $rawPost[$fk];
            }
        }
        if (!array_key_exists('spj', $problem_update) || $problem_update['spj'] === '' || $problem_update['spj'] === null) {
            $problem_update['spj'] = '0';
        }
        $problem_update['spj'] = (string) $problem_update['spj'];
        if (!in_array($problem_update['spj'], ['0', '1', '2'], true)) {
            $problem_update['spj'] = '0';
        }
        if (!array_key_exists('sample_input', $problem_update)) {
            $problem_update['sample_input'] = '';
        }
        if (!array_key_exists('sample_output', $problem_update)) {
            $problem_update['sample_output'] = '';
        }
        return $problem_update;
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
            // ThinkPHP5.1 Query 有状态：find/update/insert 等独立操作不要复用同一个 Query 对象
            $problem_item = db('problem')->where('problem_id', $problem_id)->find();
            if ($problem_item == null) {
                $this->error('No such problem.');
            }
            // 验证资源归属（用于验证 course_key 等）
            $this->validateItemBelong($problem_item, 'problem');
        }
        $this->problemEditAjaxPersistCore($problem_id, $problem_copy_id, $problem_item);
    }

    /**
     * 题目保存核心逻辑（admin / exadmin 共用，鉴权在入口完成）
     * @param string|null $problem_id
     * @param mixed $problem_item
     */
    protected function problemEditAjaxPersistCore($problem_id, $problem_copy_id, $problem_item): void
    {
        $packV = intval(input('problem_locales_pack_v/d', 0));
        if ($packV < 3) {
            $this->error('请刷新题目编辑页后再保存（多语言数据版本已更新）<br/><span class="en-text">Please refresh the problem edit page (locale pack version updated)</span>');
        }
        $rawLocales = input('problem_locales_json/s', '');
        $list = json_decode((string) $rawLocales, true);
        if (!is_array($list)) {
            $list = [];
        }
        if (count($list) < 1) {
            $this->error('须至少保留一种语言<br/><span class="en-text">At least one locale is required</span>');
        }

        $problem_update = $this->extractProblemFieldsFromPostWhitelist();
        $p0 = $list[0];
        if (is_array($p0)) {
            foreach (['description', 'input', 'output', 'hint', 'source', 'author'] as $fk) {
                if (array_key_exists($fk, $p0)) {
                    $problem_update[$fk] = (string) ($p0[$fk] ?? '');
                }
            }
        }
        $this->ProValid($problem_update);
        $problem_update['description'] = ParseMarkdown((string) ($problem_update['description'] ?? ''));
        $problem_update['input'] = ParseMarkdown((string) ($problem_update['input'] ?? ''));
        $problem_update['output'] = ParseMarkdown((string) ($problem_update['output'] ?? ''));
        $problem_update['hint'] = ParseMarkdown((string) ($problem_update['hint'] ?? ''));
        $problem_update['source'] = ParseMarkdown((string) ($problem_update['source'] ?? ''));
        $problem_update['author'] = ParseMarkdown((string) ($problem_update['author'] ?? ''));
        if ($problem_id === null) {
            $problem_update['attach'] = $this->AttachFolderCalculation(session('user_id'));
            $problem_update['defunct'] = '1';
            $problem_update['in_date'] = date('Y-m-d H:i:s');
            $problem_update = $this->prepareInsertData($problem_update, 'problem');
            $problem_id = db('problem')->insertGetId($problem_update);
            if (!$problem_id) {
                $this->error('Add problem failed, SQL error.');
            }
            $this->afterInsertData($problem_update, 'problem', $problem_id);
            $this->problemEditAjaxAfterNewProblemInserted((int) $problem_id, $problem_update);
        } else {
            $problem_update = $this->prepareUpdateData($problem_update, 'problem');
            // ThinkPHP update 在无字段变化时返回 0；!0 在 PHP 中为 true，勿与 SQL 失败 false 混淆
            $problemRowsAffected = db('problem')->where('problem_id', $problem_id)->update($problem_update);
            if ($problemRowsAffected === false) {
                $this->error('题目主表更新失败<br/><span class="en-text">Failed to update problem row</span>');
            }
        }
        $err = problem_locales_persist_full((int) $problem_id, $list);
        if ($err !== null) {
            $this->error($err);
        }
        $cooperator = input('cooperator/s');
        $alert = false;
        $additionMsg = '';
        if ($cooperator != null && $this->problemEditAjaxShouldSaveCooperator((int) $problem_id)) {
            $cooperatorList = explode(",", $cooperator);
            $additionMsg = $this->SaveCooperator($cooperatorList, $problem_id);
            if (strlen($additionMsg) > 0) {
                $alert = true;
            }
        }
        $copySrcId = is_string($problem_copy_id) ? trim($problem_copy_id) : '';
        if ($copySrcId !== '' && ctype_digit($copySrcId)) {
            $ojPath = config('OjPath.');
            $testDataCopyPath = $ojPath['testdata'] . '/' . $copySrcId;
            $testDataPath = $ojPath['testdata'] . '/' . $problem_id;
            if (!MakeDirs($testDataPath)) {
                $additionMsg .= "<br/>Cannot create problem data dir";
            } else {
                if (!CopyFilesByPattern($testDataCopyPath, $testDataPath, ['*.in', '*.out', '*.cc'])) {
                    $additionMsg .= "<br/>Failed to copy test data files";
                }
            }
            problem_locale_copy_pdf_desc_between_problems((int) $copySrcId, (int) $problem_id);
        }
        $this->success('Successful<br/>' . $additionMsg, '', ['problem_id' => $problem_id, 'alert' => $alert]);
    }

    /**
     * 上传题面 PDF（pdf_desc/{locale_key}.pdf）
     */
    public function problem_pdf_upload_ajax()
    {
        $problem_id = intval(input('problem_id/d', 0));
        $stem = trim(input('locale_key/s', 'main'));
        if ($problem_id <= 0 || !problem_locale_pdf_stem_valid($stem)) {
            return json(['code' => 0, 'msg' => '参数错误']);
        }
        $this->ensureProblemEditAccess((string) $problem_id);
        $problem = db('problem')->where('problem_id', $problem_id)->find();
        if (!$problem) {
            return json(['code' => 0, 'msg' => '题目不存在']);
        }
        $this->validateItemBelong($problem, 'problem');
        $cnt = db('problem_locale')->where(['problem_id' => $problem_id, 'locale_key' => $stem])->count();
        if ($cnt < 1) {
            return json(['code' => 0, 'msg' => '请先保存该语言后再上传 PDF']);
        }
        $file = request()->file('pdf_file');
        if (!$file) {
            return json(['code' => 0, 'msg' => '未选择文件']);
        }
        $info = $file->validate(['size' => 40 * 1024 * 1024, 'ext' => 'pdf'])->move(sys_get_temp_dir());
        if ($info === false) {
            return json(['code' => 0, 'msg' => $file->getError()]);
        }
        $tmp = $info->getPathname();
        $err = problem_locale_save_uploaded_pdf($tmp, $problem_id, $stem);
        if ($err !== null) {
            @unlink($tmp);
            return json(['code' => 0, 'msg' => $err]);
        }
        db('problem_locale')->where(['problem_id' => $problem_id, 'locale_key' => $stem])->update(['use_pdf' => 1]);
        return json(['code' => 1, 'msg' => '上传成功']);
    }

    /**
     * 删除题面 PDF；all=1 删除全部并关闭各语言 PDF 开关
     */
    public function problem_pdf_delete_ajax()
    {
        $problem_id = intval(input('problem_id/d', 0));
        $stem = trim(input('locale_key/s', ''));
        $all = intval(input('all/d', 0));
        if ($problem_id <= 0) {
            return json(['code' => 0, 'msg' => '参数错误']);
        }
        $this->ensureProblemEditAccess((string) $problem_id);
        $problem = db('problem')->where('problem_id', $problem_id)->find();
        if (!$problem) {
            return json(['code' => 0, 'msg' => '题目不存在']);
        }
        $this->validateItemBelong($problem, 'problem');
        if ($all) {
            problem_locale_delete_all_pdfs($problem_id);
            db('problem_locale')->where('problem_id', $problem_id)->update(['use_pdf' => 0]);
        } else {
            if (!problem_locale_pdf_stem_valid($stem)) {
                return json(['code' => 0, 'msg' => '参数错误']);
            }
            problem_locale_delete_pdf($problem_id, $stem);
            db('problem_locale')->where(['problem_id' => $problem_id, 'locale_key' => $stem])->update(['use_pdf' => 0]);
        }
        return json(['code' => 1, 'msg' => '已删除']);
    }

    /**
     * 题目编辑页：内联预览 pdf_desc 下已上传的 PDF（仅题目编辑权限，不校验 use_pdf 开关）
     */
    public function problem_pdf_editor_preview()
    {
        $problem_id = intval(input('problem_id/d', 0));
        $lang = trim(input('lang/s', 'main'));
        $stem = problem_locale_resolve_lang_to_pdf_stem($problem_id, $lang);
        if ($problem_id <= 0 || !problem_locale_pdf_stem_valid($stem)) {
            $this->error('参数错误', null, '', 1);
        }
        $this->ensureProblemEditAccess((string) $problem_id);
        $problem = db('problem')->where('problem_id', $problem_id)->find();
        if (!$problem) {
            $this->error('题目不存在', null, '', 1);
        }
        $this->validateItemBelong($problem, 'problem');
        $path = problem_locale_pdf_disk_path($problem_id, $stem);
        if ($path === null || !is_file($path)) {
            $this->error('PDF 不存在', null, '', 1);
        }
        header('Content-Type: application/pdf');
        header('Content-Disposition: inline; filename="' . $stem . '.pdf"');
        header('X-Content-Type-Options: nosniff');
        readfile($path);
        exit;
    }

    public function problem_add()
    {
        // 与 problem_edit 对齐，避免模板中 isset($copy_mode) 等在未 assign 时依赖引擎默认值
        $this->assign(['copy_mode' => false]);
        $this->assignProblemLocaleEditExtras('', false);
        return $this->fetch('problem_edit');
    }
    /**
     * 外格式题包 → CSGOJ 导入包（多来源标签：Polygon、酒井算协 THUSAAC 等）
     */
    public function pkg_convert()
    {
        $mod = $this->request->module();
        $pePrefix = '/' . $mod . '/problemexport';
        $nowCourseId = (isset($this->NOW_COURSE_ID) && $this->NOW_COURSE_ID) ? (int) $this->NOW_COURSE_ID : null;
        $nowCourseKey = isset($this->NOW_COURSE_KEY) ? (string) $this->NOW_COURSE_KEY : '';
        $this->assign([
            'problem_pkg_import_enable'   => 1,
            'problem_pkg_chunk_upload_url' => $pePrefix . '/chunk_upload_ajax',
            'problem_pkg_import_ajax_url'  => $pePrefix . '/problem_import_ajax',
            'problem_pkg_filemanager_url'  => $pePrefix . '/problem_export?item=problemexport',
            'problem_pkg_backtask_url'     => '/' . $mod . '/backtask?item=backtask',
            'pkg_convert_now_course_id'    => $nowCourseId,
            'pkg_convert_now_course_key'   => $nowCourseKey,
            'problem_pkg_username_for_zip' => (string) (session('user_id') ?: ''),
            'problem_judge_type_options_json' => json_encode(problem_judge_type_options_list(), JSON_UNESCAPED_UNICODE),
        ]);
        return $this->fetch();
    }

    protected function ProValid($pro_data)
    {
        if (!array_key_exists('sample_input', $pro_data) || !array_key_exists('sample_output', $pro_data)) {
            $this->error("Sample needed.");
        }
        if (strlen($pro_data['sample_input']) > 16384 || strlen($pro_data['sample_output']) > 16384) {
            $this->error("Sample too long.");
        }
    }

    public function problem_rejudge()
    {
        $this->assign([
            'rejudge_type' => 'problem',
            'submit_url' => '/' . $this->module . '/' . $this->controller . '/problem_rejudge_ajax'
        ]);
        return $this->fetch();
    }
    /**
     * 仅处理提交号重判（题号重判见 problem_rejudge_ajax）
     * @return false|int 成功时返回 solution_id
     */
    protected function Rejudge($item)
    {
        if ($item !== 'solution_id') {
            return false;
        }
        if (input('?' . $item) && strlen(trim(input($item))) > 0) {
            $id = intval(trim(input($item)));
            if ($id <= 0) {
                return false;
            }
            $Solution = db('solution');
            $solution = $Solution->where($item, $id)->find();
            if (!$solution) {
                $this->error('ID not valid');
            }
            if (!PrivItem($this->privilegeStr, $solution['problem_id'], 'admin')) {
                $this->error('You cannot rejudge solution of problem ' . $solution['problem_id']);
            }
            if ($solution['contest_id'] != null && $solution['contest_id'] > 0) {
                $this->error('比赛内的题目，重判请在比赛控制台进行操作<br/>You cannot rejudge problem in contest, please use contest rejudge in contest console');
            }
            $rejudge_res_check = input('rejudge_res_check/a');
            if ($rejudge_res_check === null) {
                $rejudge_res_check = [];
            }
            $query = db('solution')->where($item, $id);
            if (!in_array('any', $rejudge_res_check)) {
                $query->where('result', 'in', $rejudge_res_check);
            }
            $query->where(function ($query) {
                $query->whereNull('contest_id')
                    ->whereOr('contest_id', 0);
            })
                ->update([
                    'result' => 1,
                    'memory' => 0,
                    'time' => 0,
                    'pass_rate' => 0,
                ]);

            return $id;
        }
        return false;
    }

    /**
     * 解析「基于题号」重判的题号列表（逗号分隔、去重保序、最多 self::PROBLEM_REJUDGE_MAX_IDS 段）
     * @return int[]
     */
    protected function parseProblemRejudgeIdList(string $raw): array
    {
        $segments = [];
        foreach (explode(',', $raw) as $piece) {
            $t = trim($piece);
            if ($t !== '') {
                $segments[] = $t;
            }
        }
        if (count($segments) > self::PROBLEM_REJUDGE_MAX_IDS) {
            $this->error('基于题号重判一次最多 ' . self::PROBLEM_REJUDGE_MAX_IDS . ' 道题，请分批操作<br/>At most ' . self::PROBLEM_REJUDGE_MAX_IDS . ' problem IDs per request');
        }
        $seen = [];
        $ids = [];
        foreach ($segments as $seg) {
            if (!preg_match('/^\d+$/', $seg) || strlen($seg) > 10) {
                $this->error('ID not valid');
            }
            $id = intval($seg);
            if ($id <= 0) {
                $this->error('ID not valid');
            }
            if (!isset($seen[$id])) {
                $seen[$id] = true;
                $ids[] = $id;
            }
        }
        if ($ids === []) {
            $this->error('ID not valid');
        }

        return $ids;
    }

    /**
     * 将非比赛内、指定题号且命中结果筛选的提交置为等待重测（result=1）
     */
    protected function applyProblemRejudgeById(int $problem_id, array $rejudge_res_check): void
    {
        $query = db('solution')->where('problem_id', $problem_id);
        if (!in_array('any', $rejudge_res_check)) {
            $query->where('result', 'in', $rejudge_res_check);
        }
        $query->where(function ($q) {
            $q->whereNull('contest_id')->whereOr('contest_id', 0);
        })->update([
            'result' => 1,
            'memory' => 0,
            'time' => 0,
            'pass_rate' => 0,
        ]);
    }

    public function problem_rejudge_ajax()
    {
        $jumpBase = '/csgoj';
        if ($id = $this->Rejudge('solution_id')) {
            $jumpurl = $jumpBase . '/status?solution_id=' . $id;
            $this->success('Rejudge solution id=' . $id . ' started', '', $jumpurl);
            return;
        }
        $raw = trim((string) input('problem_id', ''));
        if ($raw === '') {
            $this->error('ID not valid');
        }
        $ids = $this->parseProblemRejudgeIdList($raw);
        $rejudge_res_check = input('rejudge_res_check/a');
        if ($rejudge_res_check === null) {
            $rejudge_res_check = [];
        }
        foreach ($ids as $pid) {
            if (!PrivItem($this->privilegeStr, $pid, 'admin')) {
                $this->error('You cannot rejudge problem ' . $pid);
            }
        }
        foreach ($ids as $pid) {
            $this->applyProblemRejudgeById($pid, $rejudge_res_check);
        }
        $n = count($ids);
        if ($n === 1) {
            $jumpurl = $jumpBase . '/status?problem_id=' . $ids[0];
            $this->success('Rejudge problem id=' . $ids[0] . ' started', '', $jumpurl);
        } else {
            $jumpurl = $jumpBase . '/status?result=1';
            $this->success('已对 ' . $n . ' 道题发起重判<br/>Rejudge started for ' . $n . ' problems', '', $jumpurl);
        }
    }

    /**
     * 删除题目（AJAX），规则与 exadmin 一致：无提交、未被比赛引用；删关联表与评测数据/附件目录
     */
    public function problem_delete_ajax()
    {
        $problem_id = intval(request()->post('problem_id', 0));
        if ($problem_id <= 0) {
            return json(['code' => 0, 'msg' => '无效的题目ID']);
        }
        if (!PrivItem($this->privilegeStr, $problem_id, 'admin')) {
            return json(['code' => 0, 'msg' => '您没有权限删除该题目']);
        }
        $problem = db('problem')->where('problem_id', $problem_id)->find();
        if (!$problem) {
            return json(['code' => 0, 'msg' => '题目不存在']);
        }
        $this->validateItemBelong($problem, 'problem');
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
}
