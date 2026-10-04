<?php
/**
 * 后台任务 Backtask 控制器共用逻辑
 * 供 app\admin\controller\Backtask 与 app\exadmin\controller\Backtask 使用
 */
namespace app\common\traits;

use think\Db;

trait BacktaskControllerTrait
{
    /**
     * task_type => ['cn'=>..,'en'=>..]
     */
    protected function backtaskTypesAssoc(): array
    {
        // 独立配置文件：须用 trailing '.' 走 Config::pull，勿用 config('backtask_task_types')（会误读 app.backtask_task_types）
        $cfg = config('backtask_task_types.');
        $types = isset($cfg['types']) && is_array($cfg['types']) ? $cfg['types'] : [];

        return $types;
    }

    /**
     * OJ_STATUS=exp 不提供比赛包 Web 入队；列表展示亦隐藏对应类型（与 create_ajax 一致）。
     */
    protected function backtaskContestTaskTypesEnabled(): bool
    {
        return strval(config('CsgojConfig.OJ_STATUS') ?? '') !== 'exp';
    }

    /**
     * 有序列表，供筛选下拉与前端 JSON
     */
    protected function backtaskTypesListOrdered(): array
    {
        $contestOn = $this->backtaskContestTaskTypesEnabled();
        $contestTypes = ['contest_export', 'contest_import'];
        $out = [];
        foreach ($this->backtaskTypesAssoc() as $value => $labels) {
            if (!is_array($labels)) {
                continue;
            }
            $v = (string) $value;
            if (!$contestOn && in_array($v, $contestTypes, true)) {
                continue;
            }
            $out[] = [
                'value' => $v,
                'cn'    => isset($labels['cn']) ? (string) $labels['cn'] : $v,
                'en'    => isset($labels['en']) ? (string) $labels['en'] : '',
            ];
        }

        return $out;
    }

    /**
     * 允许通过 create_ajax 入队的 task_type（子集）；未配置时与 types 键一致。
     */
    protected function backtaskCreatableTypes(): array
    {
        $cfg = config('backtask_task_types.');
        $assoc = $this->backtaskTypesAssoc();
        $contestOn = $this->backtaskContestTaskTypesEnabled();
        $contestTypes = ['contest_export', 'contest_import'];

        if (isset($cfg['creatable_task_types']) && is_array($cfg['creatable_task_types'])
            && count($cfg['creatable_task_types']) > 0) {
            $list = array_map('strval', $cfg['creatable_task_types']);
        } else {
            $list = array_map('strval', array_keys($assoc));
        }

        if (!$contestOn) {
            $list = array_values(array_filter($list, function ($t) use ($contestTypes) {
                return !in_array($t, $contestTypes, true);
            }));
        }

        // 题目包入队型：须在 types 中注册且允许 create_ajax（与 Python QUEUED_TASK_REGISTRATION 一致）。
        foreach (['problem_export', 'problem_import'] as $q) {
            if (array_key_exists($q, $assoc) && !in_array($q, $list, true)) {
                $list[] = $q;
            }
        }
        // 比赛包：仅 CPC 站点 Web 入队（exp 无比赛包导入导出）。
        if ($contestOn) {
            foreach ($contestTypes as $q) {
                if (array_key_exists($q, $assoc) && !in_array($q, $list, true)) {
                    $list[] = $q;
                }
            }
        }

        return array_values(array_unique($list));
    }

    public function initialize()
    {
        parent::initialize();
        if (!IsAdmin('administrator')) {
            $this->error('Administrator required');
        }
    }

    public function index()
    {
        $this->assign('pagetitle', '后台任务');
        $this->assign('backtask_types_list', $this->backtaskTypesListOrdered());

        return $this->fetch();
    }

    /**
     * AJAX: 获取任务列表
     * 支持 task_id / task_type / status 筛选
     */
    public function list_ajax()
    {
        $offset   = intval(input('offset', 0));
        $limit    = intval(input('limit', 20));
        $status   = input('status', '');
        $taskId   = input('task_id', '');
        $taskType = input('task_type', '');
        $sort     = input('sort', 'task_id');
        $order    = input('order', 'desc');

        $allowed_sorts = ['task_id', 'task_type', 'status', 'created_at', 'started_at', 'finished_at', 'priority'];
        if (!in_array($sort, $allowed_sorts)) {
            $sort = 'task_id';
        }
        $order = strtolower($order) === 'asc' ? 'asc' : 'desc';

        $query = db('backtask');
        if ($taskId !== '') {
            $query->where('task_id', intval($taskId));
        }
        if ($taskType !== '') {
            if (!array_key_exists($taskType, $this->backtaskTypesAssoc())) {
                $query->whereRaw('0=1');
            } else {
                $query->where('task_type', $taskType);
            }
        }
        if ($status !== '' && $status !== '-1') {
            $query->where('status', intval($status));
        }

        $total = $query->count();
        $rows = $query->order($sort, $order)
            ->limit($offset, $limit)
            ->select();

        return json([
            'total' => $total,
            'rows'  => $rows,
        ]);
    }

    /**
     * AJAX: 创建后台任务
     */
    public function create_ajax()
    {
        if (!$this->request->isPost()) {
            $this->error('POST required');
        }
        // 兼容表单/代理偶发空白字符；creatable 列表统一为 string 再比
        $taskType   = trim((string) input('post.task_type', ''));
        $taskParams = input('post.task_params', '{}');
        $priority   = intval(input('post.priority', 0));

        $allowed_types = array_map('strval', $this->backtaskCreatableTypes());
        if (!in_array($taskType, $allowed_types, true)) {
            $this->errorBilingual(
                '不支持的任务类型: ' . $taskType,
                'Unsupported task type: ' . $taskType
            );
        }

        $params = json_decode($taskParams, true);
        if (!is_array($params)) {
            $params = [];
        }
        $params['created_by'] = session('user_id');
        $params = backtask_params_with_site_key($params);

        session_write_close();

        $taskId = db('backtask')->insertGetId(array_merge(backtask_naive_wall_timestamps_for_insert(), [
            'task_type'   => $taskType,
            'task_params' => json_encode($params, JSON_UNESCAPED_UNICODE),
            'status'      => 0,
            'priority'    => $priority,
        ]));

        $this->success('', null, ['task_id' => $taskId]);
    }

    /**
     * AJAX: 取消任务
     */
    public function cancel_ajax()
    {
        if (!$this->request->isPost()) {
            $this->error('POST required');
        }
        $taskId = intval(input('post.task_id', 0));
        if ($taskId <= 0) {
            $this->error('Invalid task_id');
        }
        $task = db('backtask')->where('task_id', $taskId)->find();
        if (!$task) {
            $this->error('Task not found');
        }
        $cancelable = [0, 10];
        if (!in_array(intval($task['status']), $cancelable)) {
            $this->errorBilingual(
                '当前状态不允许取消',
                'Cannot cancel in current status'
            );
        }
        if (intval($task['status']) === 0) {
            db('backtask')->where('task_id', $taskId)->update([
                'status'       => 40,
                'finished_at'  => \app\common\funcs\CsgOjWireInstant::appWallNaiveSqlNow(),
                'last_message' => '管理员取消',
            ]);
        } else {
            db('backtask')->where('task_id', $taskId)->update([
                'status'       => 15,
                'last_message' => '管理员请求取消',
            ]);
        }
        $this->success('');
    }

    /**
     * AJAX: 删除任务及其日志（执行中除外，需先停止）
     */
    public function delete_ajax()
    {
        if (!$this->request->isPost()) {
            $this->error('POST required');
        }
        $taskId = intval(input('post.task_id', 0));
        if ($taskId <= 0) {
            $this->error('Invalid task_id');
        }
        $task = db('backtask')->where('task_id', $taskId)->find();
        if (!$task) {
            $this->error('Task not found');
        }
        $status = intval($task['status']);
        if ($status === 10) {
            $this->errorBilingual(
                '执行中的任务请先停止',
                'Stop the running task first'
            );
        }

        Db::startTrans();
        try {
            db('backtask_log')->where('task_id', $taskId)->delete();
            db('backtask')->where('task_id', $taskId)->delete();
            Db::commit();
        } catch (\Throwable $e) {
            Db::rollback();
            $this->errorBilingual('删除失败', 'Delete failed');
        }

        $this->success('');
    }

    /**
     * AJAX: 获取单个任务详情（含日志）
     */
    public function detail_ajax()
    {
        $taskId = intval(input('task_id', 0));
        if ($taskId <= 0) {
            $this->error('Invalid task_id');
        }
        $task = db('backtask')->where('task_id', $taskId)->find();
        if (!$task) {
            $this->error('Task not found');
        }
        $logs = db('backtask_log')
            ->where('task_id', $taskId)
            ->order('log_id', 'desc')
            ->limit(50)
            ->select();
        $this->success('', null, [
            'task' => $task,
            'logs' => $logs,
        ]);
    }

    /**
     * 下载任务产出文件（如题目导出 ZIP）
     */
    public function download()
    {
        $taskId = intval(input('task_id', 0));
        if ($taskId <= 0) {
            $this->error('Invalid task_id');
        }
        $task = db('backtask')->where('task_id', $taskId)->find();
        if (!$task) {
            $this->error('Task not found');
        }
        if (intval($task['status']) !== 20) {
            $this->errorBilingual('任务尚未完成', 'Task not completed');
        }
        $result = json_decode($task['result'], true);
        if (!is_array($result) || empty($result['zip_path'])) {
            $this->errorBilingual('无可下载文件', 'No downloadable file');
        }
        $filePath = $result['zip_path'];
        if (!file_exists($filePath)) {
            $this->errorBilingual(
                '文件已不存在（可能已被清理）',
                'File no longer exists (may have been cleaned up)'
            );
        }
        $filename = basename($filePath);
        header('Content-Type: application/octet-stream');
        header('Content-Disposition: attachment; filename="' . $filename . '"');
        header('Content-Length: ' . filesize($filePath));
        readfile($filePath);
        exit;
    }
}
