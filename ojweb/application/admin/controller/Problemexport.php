<?php

namespace app\admin\controller;

use think\Controller;
use think\db\Expression;

class Problemexport extends Filebase
{
    var $attachFileNameRe;

    /**
     * Hook：当前模块名（用于拼接路由前缀）
     * 子类（如 exadmin）覆写即可复用整套逻辑。
     */
    protected function getProblemexportModule(): string
    {
        return 'admin';
    }

    /**
     * Hook：Problemexport 路由前缀
     */
    protected function getProblemexportRoutePrefix(): string
    {
        return '/' . $this->getProblemexportModule() . '/problemexport';
    }

    /**
     * Hook：题目包单页 URL（导出/导入任务提交后的引导跳转）
     */
    protected function getProblemexportFilemanagerPageUrl(): string
    {
        return $this->getProblemexportRoutePrefix() . '/problem_export?item=problemexport';
    }

    /**
     * 题目包页 / 文件管理共用的 assign（exadmin 可覆写以注入课程组等）
     */
    protected function getProblemexportFilemanagerAssigns(): array
    {
        return [
            'inputinfo'     => $this->inputInfo,
            'iteminfo'      => $this->itemInfo,
            'file_regex'    => $this->filenameRe,
            'file_url'      => $this->getProblemexportRoutePrefix() . '/problem_export_filemanager_ajax?item=' . $this->inputInfo['item'] . '&id=' . $this->inputInfo['id'],
            'delete_url'    => $this->getProblemexportRoutePrefix() . '/file_delete_ajax?item=' . $this->inputInfo['item'] . '&id=' . $this->inputInfo['id'],
            'rename_url'    => $this->getProblemexportRoutePrefix() . '/file_rename_ajax?item=' . $this->inputInfo['item'] . '&id=' . $this->inputInfo['id'],
            'upload_url'    => $this->getProblemexportRoutePrefix() . '/upload_ajax',
            'method_button' => 'Do!',
            'attach_notify' => '文件会在' . $this->ojPath['export_keep_time'] . '天后自动删除。仅支持 "zip" 文件。<span class="en-text">Files will be automatically deleted after ' . $this->ojPath['export_keep_time'] . ' days. Only "zip" allowed</span>',
            /* 有 fire_url 时该列为导入操作，与通用附件「复制链接」区分 */
            'filemanager_type_column_cn' => '导入',
            'filemanager_type_column_en' => 'Import',
            'fire_url'      => $this->getProblemexportRoutePrefix() . '/problem_import_ajax',
            'NOW_COURSE_ID' => null,
            'NOW_COURSE_KEY' => '',
        ];
    }

    /**
     * exp：题目包上传等场景写入 privilege 时，资源刚创建尚无记录，需关闭「资源已存在」校验。
     * cpc 与父类 Adminbase 一致（严格校验）。
     */
    public function AddPrivilege($user_id, $item, $id)
    {
        $checkPrivilege = ($this->OJ_STATUS !== 'exp');
        try {
            AddPrivilege($user_id, $item, $id, $checkPrivilege, 'admin');
        } catch (\Exception $e) {
            $this->error($e->getMessage());
        }
    }

    /**
     * 题目导入入队前的课程上下文。cpc 恒为 null；exp 必须从请求带 now_course_id（避免 session 课程与页面不一致）。
     *
     * @return array{0: int|null, 1: string|null} [now_course_id, now_course_key]
     */
    protected function resolveProblemImportCourseContextForEnqueue(): array
    {
        if ($this->OJ_STATUS !== 'exp') {
            return [null, null];
        }

        $request_course_id = request()->param('now_course_id', null);
        $request_course_key = request()->param('now_course_key', null);

        if (empty($request_course_id)) {
            $this->error('必须先进入课程组才可导入题目。');
        }

        $course_id = intval($request_course_id);
        $course = db('course')->where('course_id', $course_id)->find();
        if (!$course) {
            $this->error("指定的课程组不存在（course_id: {$course_id}）");
        }

        if (!empty($request_course_key)) {
            $course_key = strval($request_course_key);
            if ($course['course_key'] !== $course_key) {
                $this->error("课程组标识不匹配（course_id: {$course_id}, course_key: {$course_key}）");
            }
        } else {
            $request_course_key = $course['course_key'] ?? '';
        }

        if (!PrivCourse('admin', $request_course_key) && !IsAdmin('problem_editor')) {
            $this->error('您没有权限在该课程组中导入题目');
        }

        return [$course_id, $request_course_key];
    }

    /**
     * Hook：从环境变量初始化时区（容器启动脚本通常会传入 TZ）
     */
    protected function initTimezoneFromEnv(): void
    {
        $tz = getenv('TZ');
        if (!$tz) {
            return;
        }
        try {
            new \DateTimeZone($tz);
            date_default_timezone_set($tz);
        } catch (\Exception $e) {
            // ignore invalid timezone
        }
    }

    /**
     * 统一格式化时间戳（确保使用当前 PHP 默认时区，24 小时制）
     */
    protected function formatTimestamp(int $ts): string
    {
        $tz = date_default_timezone_get();
        try {
            return (new \DateTimeImmutable('@' . $ts))
                ->setTimezone(new \DateTimeZone($tz))
                ->format('Y-m-d H:i:s');
        } catch (\Exception $e) {
            return date('Y-m-d H:i:s', $ts);
        }
    }

    public function initialize()
    {
        $this->OJMode();
        $this->AdminInit();
        $this->FilebaseInit();
        $this->initTimezoneFromEnv();

        /* 勿用 [0-9a-zA-Z-_...]：其中 Z-_ 会被解析为范围，不含连字符，会误拒 OJ-Problem-*.zip */
        $this->filenameRe = '/^[A-Za-z0-9._()-]+\.(zip)$/i';
        $this->attachFileNameRe = '/^[A-Za-z0-9._()-]+\.(jpg|png|gif|bmp|svg|ico)$/i';
        $this->filenameReMsg = "<br/>Only zip allowed";
        $this->maxFileSize = config('CsgojConfig.OJ_UPLOAD_IMPORT_MAXSIZE');
        $this->assign('maxfilesize', $this->maxFileSize);
        $this->maxFileNum = config('CsgojConfig.OJ_UPLOAD_MAXNUM');
        $this->validateRule = ['size' => $this->maxFileSize,  'ext' => 'zip'];

        $this->GetInput();

        if ($this->inputInfo['item'] != 'problemexport') {
            $this->error('This page is for problem export');
        }
        $this->FileAuthentication();
        $this->GetPath();
    }
    public function FileAuthentication()
    {
        // 对 problemexport 情况直接判断管理员，跳过搜索具体problem_id
        if (!IsAdmin('administrator'))
            $this->error("You cannot export problem according to your privilege");
    }
    public function GetPath()
    {
        // 确保 ojPath 已初始化
        if (!isset($this->ojPath) || $this->ojPath === null || !is_array($this->ojPath) || !isset($this->ojPath['export_problem'])) {
            $this->ojPath = config('OjPath.');
        }
        if (!isset($this->ojPath) || $this->ojPath === null || !is_array($this->ojPath) || !isset($this->ojPath['export_problem'])) {
            $this->error('OjPath configuration is missing or export_problem is not configured.');
        }
        $this->inputInfo['path'] =  $this->ojPath['export_problem'];
        if (!MakeDirs($this->inputInfo['path'])) {
            $this->error('Folder permission denied.');
        }
        return $this->inputInfo;
    }

    public function file_rename_ajax()
    {

        if (!preg_match($this->filenameRe, $this->inputInfo['rename'])) {
            $this->error("Please enter a valid filename" . $this->filenameReMsg);
        }
        if (!rename($this->inputInfo['path'] . '/' . $this->inputInfo['filename'], $this->inputInfo['path'] . '/' . $this->inputInfo['rename'])) {
            $this->error('Failed.');
        }
        $this->ojPath = config('OjPath.');
        $this->success(
            'Renamed to ' . $this->inputInfo['rename'],
            '',
            ['rename'  => "<a href='" . $this->getProblemexportRoutePrefix() . "/downloaddata?id=" . $this->inputInfo['id'] . "&filename=" . $this->inputInfo['rename'] . "' filename='" . $this->inputInfo['rename'] . "'>" .  $this->inputInfo['rename'] . "</a>"]
        );
    }
    //获取目标文件夹文件列表
    public function GetDir()
    {
        DelTimeExpireFolders($this->inputInfo['path'], $this->ojPath['export_keep_time']);
        $filelist = [];
        if (is_dir($this->inputInfo['path']) && ($handle = opendir($this->inputInfo['path']))) {
            $i = 1;
            while (($file = readdir($handle)) !== false) {
                if ($file != "." && $file != "..") {
                    $filetime = filemtime($this->inputInfo['path'] . '/' . $file);
                    $filelist[] = [
                        'file_lastmodify'     => $this->formatTimestamp((int)$filetime),
                        'file_name'           => $file,
                        'file_size'           => round(filesize($this->inputInfo['path'] . '/' . $file) / 1024, 2),
                        'file_type'           => "Import",
                        'file_url'            => $this->getProblemexportRoutePrefix() . "/downloaddata?item=" . $this->inputInfo['item'] . "&filename=" . $file,
                        '_sort_mtime'         => (int) $filetime,
                    ];
                    $i++;
                }
            }
            // 按修改时间降序；禁止对「关联数组行」用 rsort（PHP 8 下行为不可靠）
            usort($filelist, function ($a, $b) {
                return ($b['_sort_mtime'] ?? 0) <=> ($a['_sort_mtime'] ?? 0);
            });
            foreach ($filelist as &$row) {
                unset($row['_sort_mtime']);
            }
            unset($row);
            //关闭句柄
            closedir($handle);
        }
        return $filelist;
    }
    public function problem_export_filemanager()
    {
        if (!IsAdmin('administrator'))
            $this->error("You cannot export problem according to your privilege");
        $this->assign($this->getProblemexportFilemanagerAssigns());
        return $this->fetch();
    }
    public function problem_export_filemanager_ajax()
    {
        if (!IsAdmin('administrator'))
            $this->error("You cannot import problem according to your privilege");

        $filelist = $this->GetDir();
        //        $ret['total'] = count($filelist);
        //        $ret['rows'] = $filelist;
        return $filelist;
    }
    public function problem_import_ajax()
    {
        if (!IsAdmin('administrator')) {
            $this->error("You cannot import problem according to your privilege");
        }
        if (!preg_match($this->filenameRe, $this->inputInfo['filename'])) {
            $this->error("Please select a valid file");
        }
        [$cid, $ckey] = $this->resolveProblemImportCourseContextForEnqueue();
        $this->enqueueProblemImportBacktask($cid, $ckey);
    }

    /**
     * 入队题目导入后台任务。仅传递路径与上下文（不写题目数据）；Python worker 解压后读包内 JSON 入库。
     *
     * @param int|null    $nowCourseId  exp 课程组 ID，与请求 now_course_id 一致
     * @param string|null $nowCourseKey exp 课程组 key，与请求 now_course_key 一致（可空，worker 侧以库为准）
     */
    protected function enqueueProblemImportBacktask($nowCourseId, $nowCourseKey)
    {
        $importPath = $this->ojPath['export_problem'];
        $filename = $this->inputInfo['filename'];
        if (!file_exists($importPath . '/' . $filename)) {
            $this->error("No such file");
        }

        $notWritablePath = '';
        if (!MakeDirs($this->ojPath['testdata']) || !is_writable($this->ojPath['testdata'])) {
            $notWritablePath .= "<br/>Judge data path: " . $this->ojPath['testdata'];
        }
        if (!MakeDirs($this->ojPath['PUBLIC'] . $this->ojPath['problem_ATTACH']) || !is_writable($this->ojPath['PUBLIC'] . $this->ojPath['problem_ATTACH'])) {
            $notWritablePath .= "<br/>Problem attach path: " . $this->ojPath['PUBLIC'] . $this->ojPath['problem_ATTACH'];
        }
        if (!is_writable($this->ojPath['export_problem'])) {
            $notWritablePath .= "<br/>Export file path: " . $this->ojPath['export_problem'];
        }
        if (!MakeDirs($this->ojPath['import_problem_temp']) || !is_writable($this->ojPath['import_problem_temp'])) {
            $notWritablePath .= "<br/>Import temporary path: " . $this->ojPath['import_problem_temp'];
        }
        if ($notWritablePath !== '') {
            $this->error('These paths are not writable, you need "chmod" to modify:' . $notWritablePath);
        }

        $ojPath = config('OjPath.');
        $filePath = $importPath . '/' . $filename;
        $autoSubmitSolutions = request()->param('auto_submit_solutions', '');
        $autoSubmit = ($autoSubmitSolutions === '1' || $autoSubmitSolutions === 'true' || $autoSubmitSolutions === 'on');

        $taskParams = [
            'import_file'           => $filePath,
            'import_temp_base'      => $ojPath['import_problem_temp'],
            'export_temp_keep_time' => floatval($ojPath['export_temp_keep_time'] ?? 7),
            'testdata_dir'          => $ojPath['testdata'],
            'public_attach_root'    => $ojPath['PUBLIC'] . '/' . $ojPath['problem_ATTACH'],
            'oj_status'             => strval(config('CsgojConfig.OJ_STATUS') ?? ''),
            'user_id'               => intval(session('user_id')),
            'created_by'            => session('user_id'),
            'now_course_id'         => $nowCourseId !== null ? intval($nowCourseId) : null,
            'now_course_key'        => $nowCourseKey !== null && $nowCourseKey !== '' ? (string) $nowCourseKey : '',
            'auto_submit_solutions' => $autoSubmit,
        ];

        session_write_close();

        $taskParams = backtask_params_with_site_key($taskParams);

        $taskId = db('backtask')->insertGetId(array_merge(backtask_naive_wall_timestamps_for_insert(), [
            'task_type'   => 'problem_import',
            'task_params' => json_encode($taskParams, JSON_UNESCAPED_UNICODE),
            'status'      => 0,
            'priority'    => 0,
        ]));

        $this->success(
            '导入任务已提交（后台执行中）<br/>Import task submitted (running in background)',
            null,
            [
                'task_id' => $taskId,
                'url'     => $this->getProblemexportFilemanagerPageUrl(),
            ]
        );
    }

    public function problem_export()
    {
        if (!IsAdmin('administrator'))
            $this->error("You cannot export problem according to your privilege");
        $contestSuggestUrl = $this->getProblemexportRoutePrefix()
            . '/problem_export_contest_suggest_ajax?item=problemexport';
        $this->assign(array_merge($this->getProblemexportFilemanagerAssigns(), [
            'filemanager_embed'                  => true,
            'filemanager_ui_compact'             => true,
            'problem_pkg_backtask_url'           => '/' . $this->getProblemexportModule() . '/backtask?item=backtask',
            'problem_export_ajax_url'            => $this->getProblemexportRoutePrefix() . '/problem_export_ajax?item=problemexport',
            'problemexport_module'               => $this->getProblemexportModule(),
            'problem_export_contest_suggest_url' => $contestSuggestUrl,
            'action'                             => 'problem_export',
        ]));
        return $this->fetch();
    }

    /**
     * 题目导出页「按比赛」：比赛 ID 候选（含实验课 private%10=4，不含考试 5），与比赛包导出候选策略不同。
     */
    public function problem_export_contest_suggest_ajax()
    {
        if (!IsAdmin('administrator')) {
            $this->error('Permission denied');
        }
        $q = trim((string) input('get.q', ''));
        $limit = intval(input('limit', 30));
        if ($limit < 5) {
            $limit = 5;
        }
        if ($limit > 80) {
            $limit = 80;
        }

        $query = db('contest')
            ->field('contest_id,title,private')
            ->whereRaw('(`private` % 10) IN (0, 1, 2, 4)');

        if ($q !== '') {
            if (preg_match('/^\d+$/', $q)) {
                $query->where('contest_id', 'like', $q . '%');
            } else {
                $like = '%' . addcslashes($q, '%_\\') . '%';
                $query->where('title', 'like', $like);
            }
        }

        $rows = $query->order('contest_id', 'desc')->limit($limit)->select();
        $out = [];
        foreach ($rows as $r) {
            $pv = intval($r['private'] ?? 0);
            if (!problem_export_contest_suggest_allowed_private($pv)) {
                continue;
            }
            $cid = intval($r['contest_id']);
            $title = isset($r['title']) ? (string) $r['title'] : '';
            if (function_exists('mb_strlen') && function_exists('mb_substr')) {
                $short = mb_strlen($title, 'UTF-8') > 52
                    ? mb_substr($title, 0, 52, 'UTF-8') . '…'
                    : $title;
            } else {
                $short = strlen($title) > 52 ? substr($title, 0, 52) . '…' : $title;
            }
            $out[] = [
                'contest_id'  => $cid,
                'title'       => $title,
                'title_short' => $short,
            ];
        }
        $this->success('ok', null, ['rows' => $out]);
    }

    public function problem_export_ajax()
    {
        if (!IsAdmin('administrator'))
            $this->error("You cannot export problem according to your privilege");
        //$ep: Export Parameter
        $test_data_check = input('test_data_check', 'false');
        $attach_file_check = input('attach_file_check', 'false');
        $ep = [
            'start_pid' => intval(input('start_pid')),
            'end_pid'     => intval(input('end_pid')),
            'pid_list'     => trim(input('pid_list')),
            'ex_cid'     => trim(input('ex_cid')),
            'test_data_check' => $test_data_check == 'on' || $test_data_check == 'true',
            'attach_file_check' => $attach_file_check == 'on' || $attach_file_check == 'true',
        ];
        if ($ep['end_pid'] == 0)
            $ep['end_pid'] = $ep['start_pid'];
        $orderMap = "";
        $exportedTag = "";  // 导出文件名的标识部分
        $problem_list_export = null; // 用于 IN 查询的数组
        $useInQuery = false; // 标记是否使用 IN 查询（避免 TP5.1 数组 where 触发嵌套 IN）
        $useBetweenQuery = false; // 标记是否使用 whereBetween（避免 "p.problem_id"=>['between',...] 这种 TP5.0 风格数组 where）
        $betweenRange = null;

        if ($ep['start_pid'] > 0) {
            // 按起止题号导出
            //这句和下面那句重复了，只是目前还是把所有大于30个题的请求都拦劫吧，一次导太多题不好。。。
            if ($ep['end_pid'] - $ep['start_pid'] > 30)
                $this->error("You'd better not export so many problems once (more than 30).");

            if ($ep['end_pid'] - $ep['start_pid'] > 30 && ($ep['test_data_check'] || $ep['attach_file_check']))
                $this->error('Together with related files, you cannot export so many problems.');
            else if ($ep['end_pid'] < $ep['start_pid'])
                $this->error("End problem ID should be bigger than start problem ID.", '', $ep);
            $whereMap = null;
            $useBetweenQuery = true;
            $betweenRange = [$ep['start_pid'], $ep['end_pid']];
            $exportedTag = $ep['start_pid'] . '-' . $ep['end_pid'];
        } else if ($ep['pid_list'] != '') {
            // 按离散题号列表导出
            $problem_list = explode(",", $ep['pid_list']);
            $problem_list_export = [];
            foreach ($problem_list as $val) {
                $problem_list_export[] = intval($val);
            }
            $problem_list_export = array_unique($problem_list_export);
            // TP5.1：不要用 where(['field'=>['in', $arr]])，会被框架再次包装成 IN 导致嵌套
            $whereMap = null;
            $useInQuery = true;
            $orderMap = new Expression("field(p.problem_id," . implode(",", $problem_list_export) . ")");
            $exportedTag = 'pidlist-' . count($problem_list_export) . '-start-' . $problem_list_export[0];
        } else if ($ep['ex_cid'] != '') {
            // 按比赛题目列表导出
            $ex_cid = intval($ep['ex_cid']);
            $ContestProblem = db('contest_problem');
            $problem_list = $ContestProblem
                ->where('contest_id', '=', $ex_cid)
                ->order('num', 'asc')
                ->field('problem_id')
                ->select();
            $problem_list_export = [];
            foreach ($problem_list as $val) {
                $problem_list_export[] = intval($val['problem_id']);
            }
            $problem_list_export = array_unique($problem_list_export);
            if (count($problem_list_export) == 0)
                $this->error("Cannot find problems for contest $ex_cid");
            // TP5.1：不要用 where(['field'=>['in', $arr]])，会被框架再次包装成 IN 导致嵌套
            $whereMap = null;
            $useInQuery = true;
            $orderMap = new Expression("field(p.problem_id," . implode(",", $problem_list_export) . ")");
            $exportedTag = 'num-' . count($problem_list_export) . '-cid-' . $ep['ex_cid'];
        } else {
            $this->error("The problem ID is not valid");
        }
        $Problem = db('problem');
        $problemList = $Problem->alias('p')
            ->join([problem_md_join_default_subquery_sql() => 'pmd'], 'p.problem_id = pmd.problem_id', 'left');

        // 根据查询类型选择不同的 where 调用方式
        if ($useInQuery && $problem_list_export !== null) {
            $problemList->where('p.problem_id', 'in', $problem_list_export);
        } else if ($useBetweenQuery && $betweenRange !== null) {
            $problemList->whereBetween('p.problem_id', $betweenRange);
        } else if (isset($whereMap)) {
            $problemList->where($whereMap);
        }

        $problemList = $problemList
            ->order($orderMap)
            ->field([
                'p.problem_id problem_id',
                'p.title title',
                'p.description description',
                'p.input input',
                'p.output output',
                'p.sample_input sample_input',
                'p.sample_output sample_output',
                'p.spj spj',
                'p.hint hint',
                'p.source source',
                'p.author author',    //额外加的字段
                'p.attach attach',    //额外加的字段
                'p.in_date in_date',
                'p.time_limit time_limit',
                'p.memory_limit memory_limit',
                'p.defunct defunct',
                'p.accepted accepted',
                'p.submit submit',
                'p.solved solved',
                'pmd.description description_md',
                'pmd.input input_md',
                'pmd.output output_md',
                'pmd.hint hint_md',
                'pmd.source source_md',
                'pmd.author author_md',
            ])
            ->select();
        $outputInfo = "Some problems weren't exported. The problems you don't own:<br/>";
        $outputProblem = [];
        $i = 1;
        $noPrivilegeFlag = false;
        foreach ($problemList as $problem) {
            if (!IsAdmin('problem', $problem['problem_id'])) {
                $noPrivilegeFlag = true;
                $outputInfo .= $problem['problem_id'] . '<br/>';
                continue;
            }
            $problem['problem_new_id'] = $i;
            $i++;
            $outputProblem[] = $problem;
        }
        if (!count($outputProblem)) {
            if ($noPrivilegeFlag)
                $this->error("The range you selected is empty");
            else
                $this->error("You have no privilege of these problems");
        }

        $ojPath = config('OjPath.');
        $problemIds = array_map(function($p) { return intval($p['problem_id']); }, $outputProblem);
        $taskParams = backtask_params_with_site_key([
            'created_by'       => session('user_id'),
            'problem_ids'      => $problemIds,
            'export_tag'       => $exportedTag,
            'test_data_check'  => $ep['test_data_check'],
            'attach_file_check'=> $ep['attach_file_check'],
            'testdata_dir'     => $ojPath['testdata'],
            'attach_base_dir'  => $ojPath['PUBLIC'] . '/' . $ojPath['problem_ATTACH'],
            'export_dir'       => $ojPath['export_problem'],
            'export_temp_dir'  => $ojPath['export_problem_temp'],
        ]);

        session_write_close();

        $taskId = db('backtask')->insertGetId(array_merge(backtask_naive_wall_timestamps_for_insert(), [
            'task_type'   => 'problem_export',
            'task_params' => json_encode($taskParams, JSON_UNESCAPED_UNICODE),
            'status'      => 0,
            'priority'    => 0,
        ]));

        $retMsg = "导出任务已提交（后台执行中）<br/>Export task submitted (running in background)";
        if (count($outputProblem) != count($problemList))
            $retMsg .= '<br/>' . $outputInfo;
        $this->success($retMsg, null, [
            'task_id' => $taskId,
            'url'     => $this->getProblemexportFilemanagerPageUrl(),
        ]);
    }
}
