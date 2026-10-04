<?php

namespace app\outrank\controller;

use Alchemy\Zippy\Zippy;
use app\common\funcs\CsgOjWireInstant;
use app\outrank\library\OutrankPusherHelper;
use app\outrank\library\OutrankSponsorBannerService;

class Index extends Outrankbase
{
    /** 外榜整包 JSON 的 format_version（与 docs/guide/13.外榜整包JSON格式.md 一致） */
    private const OUTRANK_PACK_FORMAT_VERSION = '1.0';

    public function initialize()
    {
        $this->OJMode();
    }

    /**
     * 接收榜单数据接口（支持跨域POST和ZIP压缩）
     * 接口1：接收数据
     */
    public function receive_data()
    {
        // 注意：跨域头由 Nginx 统一设置，PHP 中不再设置，避免冲突
        // Nginx 已经处理了 OPTIONS 预检请求，PHP 中不需要再处理

        // 优先从 POST 参数中读取（FormData），如果没有则从 JSON body 中读取
        $token = trim(input('token/s', ''));
        if ($token === '') {
            $token = trim(input('outrank_token/s', ''));
        }
        $outrank_uuid = input('outrank_uuid/s', '');
        
        // 如果 POST 参数中没有，尝试从 JSON body 中读取
        if (empty($token) || empty($outrank_uuid)) {
            $rawData = $this->request->getContent();
            if (!empty($rawData)) {
                $jsonData = json_decode($rawData, true);
                if ($jsonData !== null && is_array($jsonData)) {
                    // 从 JSON body 中读取 token 和 outrank_uuid
                    if (empty($token) && isset($jsonData['token'])) {
                        $token = $jsonData['token'];
                    }
                    if (empty($token) && isset($jsonData['outrank_token'])) {
                        $token = $jsonData['outrank_token'];
                    }
                    if (empty($outrank_uuid) && isset($jsonData['outrank_uuid'])) {
                        $outrank_uuid = $jsonData['outrank_uuid'];
                    }
                }
            }
        }
        
        $data_type = input('data_type/s', 'full'); // 'full' 全量数据, 'incremental' 增量solution
        
        $vr = OutrankPusherHelper::verifyOutrankForTokenPush($token, $outrank_uuid);
        if (isset($vr['error'])) {
            return json($vr['error'], $vr['http']);
        }
        $outrank = $vr['outrank'];

        // 检查是否为ZIP文件上传（通过FormData）
        $file = request()->file('data');
        $data = null;
        
        if ($file) {
            // 检查文件类型
            $fileInfo = $file->getInfo();
            $fileType = isset($fileInfo['type']) ? $fileInfo['type'] : '';
            $fileName = isset($fileInfo['name']) ? $fileInfo['name'] : '';
            
            // 判断是否为ZIP文件（通过MIME类型或文件扩展名）
            if ($fileType == 'application/zip' || 
                $fileType == 'application/x-zip-compressed' ||
                (pathinfo($fileName, PATHINFO_EXTENSION) == 'zip')) {
                // 处理ZIP文件（参考 Judge.php）
                try {
                    $data = $this->processZipFile($file, $outrank);
                } catch (\Exception $e) {
                    return json(['status' => 'error', 'message' => 'ZIP处理失败: ' . $e->getMessage() . ' (ZIP processing failed: ' . $e->getMessage() . ')'], 400);
                }
            } else {
                return json(['status' => 'error', 'message' => '不支持的文件类型，请上传ZIP文件 (Unsupported file type, please upload ZIP file)'], 400);
            }
        } else {
            // 读取请求体（JSON格式）
            $rawData = $this->request->getContent();
            
            // 解析JSON数据
            $jsonData = json_decode($rawData, true);
            if ($jsonData === null) {
                return json(['status' => 'error', 'message' => 'Invalid JSON data'], 400);
            }
            
            // 如果 JSON 中包含 'data' 字段，则使用该字段作为数据
            // 否则整个 JSON 对象作为数据（兼容旧格式）
            if (isset($jsonData['data']) && is_array($jsonData['data'])) {
                $data = $jsonData['data'];
            } else {
                // 移除鉴权与配置字段（如果存在），剩余部分作为榜单数据（与 Go 工具 JSON body 一致）
                unset($jsonData['token'], $jsonData['outrank_uuid'], $jsonData['outrank_token']);
                $data = $jsonData;
            }
        }

        if ($data === null) {
            return json(['status' => 'error', 'message' => 'Failed to process data'], 400);
        }

        if (!is_array($data)) {
            return json(['status' => 'error', 'message' => '榜单数据须为 JSON 对象 (Rank payload must be a JSON object)'], 400);
        }

        try {
            OutrankPusherHelper::persistRankJson($outrank, $data);
        } catch (\Throwable $e) {
            return json(['status' => 'error', 'message' => $e->getMessage()], 400);
        }

        return json(['status' => 'success', 'message' => 'Data received', 'filename' => 'rank.json']);
    }

    /**
     * 处理ZIP文件（参考 Judge.php 的 DecompressZipData 方法）
     */
    private function processZipFile($file, $outrank)
    {
        $ojPath = config('OjPath.');
        
        // 创建临时文件夹
        $date = date('Y-m-d-H-i-s');
        $importTempPath = $ojPath['import_problem_temp'] . '/' . $date . '-' . session('user_id', 'outrank');
        
        if (!MakeDirs($importTempPath)) {
            throw new \Exception("临时文件夹创建失败 (Failed to create temp folder)");
        }

        // 保存上传的ZIP文件到临时位置
        $zipFilePath = $importTempPath . '/rank.zip';
        $info = $file->move($importTempPath, 'rank.zip');
        
        if (!$info) {
            DelDirs($importTempPath);
            throw new \Exception("ZIP文件保存失败: " . ($file->getError() ?: 'Unknown error') . " (Failed to save ZIP file)");
        }
        
        $zipFilePath = $info->getRealPath();

        try {
            return OutrankPusherHelper::extractRankDataFromZipPath($zipFilePath, $importTempPath);
        } catch (\Exception $e) {
            if (is_dir($importTempPath)) {
                DelDirs($importTempPath);
            }
            throw $e;
        }
    }

    /**
     * JSONP备用接口（分包提交，每包3kb以内）
     */
    public function receive_data_jsonp()
    {
        $callback = input('callback/s', 'callback');
        // 确保回调函数名称安全（防止 XSS）
        $callback = preg_replace('/[^a-zA-Z0-9_]/', '', $callback);
        if (empty($callback)) {
            $callback = 'callback';
        }
        
        $token = input('token/s', '');
        $outrank_uuid = input('outrank_uuid/s', '');
        $data_type = input('data_type/s', 'full');
        $chunk_index = input('chunk_index/d', 0);
        $chunk_total = input('chunk_total/d', 1);
        $chunk_data = input('chunk_data/s', '');

        if (empty($token) || empty($outrank_uuid) || empty($chunk_data)) {
            $response = ['status' => 'error', 'message' => 'Missing required parameters'];
            header('Content-Type: application/javascript; charset=utf-8');
            header('Cache-Control: no-cache, no-store, must-revalidate');
            echo $callback . '(' . json_encode($response, JSON_UNESCAPED_UNICODE) . ');';
            exit;
        }

        $vr = OutrankPusherHelper::verifyOutrankForTokenPush($token, $outrank_uuid);
        if (isset($vr['error'])) {
            header('Content-Type: application/javascript; charset=utf-8');
            header('Cache-Control: no-cache, no-store, must-revalidate');
            echo $callback . '(' . json_encode($vr['error'], JSON_UNESCAPED_UNICODE) . ');';
            exit;
        }
        $outrank = $vr['outrank'];

        // 检查是否为ZIP压缩数据
        $isZip = input('is_zip/s', '0') === '1';
        
        // 保存分块数据
        $ojPath = config('OjPath.');
        $attachFolder = $outrank['outrank_uuid'];
        $dataFolder = $ojPath['PUBLIC'] . $ojPath['outrank_ATTACH'] . '/' . $attachFolder . '/chunks';
        
        if (!is_dir($dataFolder)) {
            MakeDirs($dataFolder);
        }

        $chunkFile = $dataFolder . '/' . $data_type . '_' . $chunk_index . '.txt';
        file_put_contents($chunkFile, $chunk_data);

        // 如果是最后一块，合并所有分块
        if ($chunk_index == $chunk_total - 1) {
            $allChunks = [];
            for ($i = 0; $i < $chunk_total; $i++) {
                $chunkFile = $dataFolder . '/' . $data_type . '_' . $i . '.txt';
                if (file_exists($chunkFile)) {
                    $chunkContent = file_get_contents($chunkFile);
                    $allChunks[] = $chunkContent;
                    unlink($chunkFile); // 删除临时分块文件
                }
            }

            // 拼接所有分块
            $mergedDataStr = implode('', $allChunks);
            
            if ($isZip) {
                try {
                    $zipBinary = base64_decode($mergedDataStr, true);
                    if ($zipBinary === false) {
                        throw new \Exception('Base64解码失败 (Base64 decode failed)');
                    }
                    $date = date('Y-m-d-H-i-s');
                    $importTempPath = $ojPath['import_problem_temp'] . '/' . $date . '-' . session('user_id', 'outrank') . '-jsonp';
                    if (!MakeDirs($importTempPath)) {
                        throw new \Exception('临时文件夹创建失败 (Failed to create temp folder)');
                    }
                    $zipFilePath = $importTempPath . '/rank.zip';
                    file_put_contents($zipFilePath, $zipBinary);
                    $mergedData = OutrankPusherHelper::extractRankDataFromZipPath($zipFilePath, $importTempPath);
                } catch (\Exception $e) {
                    if (isset($importTempPath) && is_dir($importTempPath)) {
                        DelDirs($importTempPath);
                    }
                    $response = ['status' => 'error', 'message' => 'ZIP处理失败: ' . $e->getMessage() . ' (ZIP processing failed: ' . $e->getMessage() . ')'];
                    header('Content-Type: application/javascript; charset=utf-8');
                    header('Cache-Control: no-cache, no-store, must-revalidate');
                    echo $callback . '(' . json_encode($response, JSON_UNESCAPED_UNICODE) . ');';
                    exit;
                }
            } else {
                // 非 ZIP 模式：直接解析 JSON（向后兼容）
                $mergedData = json_decode($mergedDataStr, true);
                
                if ($mergedData === null) {
                    $response = ['status' => 'error', 'message' => 'Failed to parse merged JSON'];
                    header('Content-Type: application/javascript; charset=utf-8');
                    header('Cache-Control: no-cache, no-store, must-revalidate');
                    echo $callback . '(' . json_encode($response, JSON_UNESCAPED_UNICODE) . ');';
                    exit;
                }
                if (!is_array($mergedData)) {
                    $response = ['status' => 'error', 'message' => '榜单数据须为 JSON 对象 (Rank payload must be a JSON object)'];
                    header('Content-Type: application/javascript; charset=utf-8');
                    header('Cache-Control: no-cache, no-store, must-revalidate');
                    echo $callback . '(' . json_encode($response, JSON_UNESCAPED_UNICODE) . ');';
                    exit;
                }
                try {
                    CsgOjWireInstant::assertRankPayloadHasTimeContext($mergedData);
                } catch (\Throwable $e) {
                    $response = ['status' => 'error', 'message' => $e->getMessage()];
                    header('Content-Type: application/javascript; charset=utf-8');
                    header('Cache-Control: no-cache, no-store, must-revalidate');
                    echo $callback . '(' . json_encode($response, JSON_UNESCAPED_UNICODE) . ');';
                    exit;
                }
            }

            try {
                OutrankPusherHelper::persistRankJson($outrank, $mergedData);
            } catch (\Throwable $e) {
                $response = ['status' => 'error', 'message' => $e->getMessage()];
                header('Content-Type: application/javascript; charset=utf-8');
                header('Cache-Control: no-cache, no-store, must-revalidate');
                echo $callback . '(' . json_encode($response, JSON_UNESCAPED_UNICODE) . ');';
                exit;
            }
        }

        $response = ['status' => 'success', 'message' => 'Chunk received', 'chunk_index' => $chunk_index];
        header('Content-Type: application/javascript; charset=utf-8');
        header('Cache-Control: no-cache, no-store, must-revalidate');
        header('Pragma: no-cache');
        header('Expires: 0');
        
        // 直接输出，避免 ThinkPHP 的额外处理
        echo $callback . '(' . json_encode($response, JSON_UNESCAPED_UNICODE) . ');';
        exit;
    }

    /**
     * 获取outrank列表
     * 接口2：列表接口
     */
    public function index()
    {
        $logoDir = \think\facade\App::getRootPath() . 'public' . DIRECTORY_SEPARATOR . 'static' . DIRECTORY_SEPARATOR . 'image' . DIRECTORY_SEPARATOR . 'logos';
        $logoSlugs = [];
        if (is_dir($logoDir)) {
            foreach (scandir($logoDir) as $f) {
                if ($f === '.' || $f === '..') {
                    continue;
                }
                if (preg_match('/^([a-zA-Z0-9_-]+)\.webp$/i', $f, $m)) {
                    $logoSlugs[] = strtolower($m[1]);
                }
            }
            $logoSlugs = array_values(array_unique($logoSlugs));
            sort($logoSlugs);
        }
        $this->assign('outrank_logo_slugs', $logoSlugs);
        $this->assign('pagetitle', 'CCPCOJ 外榜');
        $this->assign('pagetitle_en', 'Outrank System');

        return $this->fetch();
    }

    public function outrank_list_ajax()
    {
        $isAdmin = IsAdmin('administrator');

        $columns = ["outrank_id", "outrank_uuid", "title", "ckind", "description", "start_time", "end_time", "in_date", "updated_at", "defunct", "addition"];
        if ($isAdmin) {
            $columns[] = 'token';
            $columns[] = 'flg_allow';
        }
        // defunct：'0' 启用、'1' 禁用、'2' 已删除（软删除）。
        // 访客与非大管理员：仅启用。
        // 大管理员默认：启用 + 禁用；传 show_deleted=1 时含已删除。
        $listQuery = db('outrank')->field($columns);
        if (!$isAdmin) {
            $listQuery->where('defunct', '0');
        } elseif ((int) input('show_deleted/d', 0) !== 1) {
            $listQuery->where('defunct', 'in', ['0', '1']);
        }

        $list = $listQuery->order('outrank_id', 'desc')->select();

        $ojPath = config('OjPath.');
        // 为每条记录添加 is_admin 字段；页眉横幅类型供管理端图标状态
        foreach ($list as &$item) {
            $item['is_admin'] = $isAdmin;
            $ph = OutrankSponsorBannerService::resolvePublicMeta(
                $ojPath['PUBLIC'],
                $ojPath['outrank_ATTACH'],
                $ojPath['outrank_ATTACH'],
                $item['outrank_uuid']
            );
            $item['page_header_kind'] = $ph ? $ph['kind'] : '';
        }
        unset($item); // 释放引用

        return $list;
    }

    /**
     * 添加/编辑outrank页面
     * 接口3：编辑页面
     */
    public function outrank_edit()
    {
        if (!IsAdmin('administrator')) {
            $this->error('Permission denied');
        }

        $id = input('id/d', 0);
        $outrank = null;
        if ($id > 0) {
            $outrank = db('outrank')->where('outrank_id', $id)->find();
            if (!$outrank) {
                $this->error('Outrank not found');
            }
        }
        $this->assign('outrank', $outrank);
        $this->assign('pagetitle', $id > 0 ? 'Edit Outrank' : 'Add Outrank');
        return $this->fetch();
    }

    /**
     * 获取单个outrank数据（用于modal编辑）
     */
    public function outrank_get_ajax()
    {
        if (!IsAdmin('administrator')) {
            $this->error('Permission denied');
        }

        $id = input('id/d', 0);
        $outrank = null;
        
        if ($id > 0) {
            $outrank = db('outrank')->where('outrank_id', $id)->find();
            if (!$outrank) {
                $this->error('Outrank not found');
            }
        }

        // 返回 JSON 数据
        if ($outrank) {
            $this->success('获取成功', null, $outrank);
        } else {
            // 新增模式，返回空数据
            $this->success('获取成功', null, []);
        }
    }

    /**
     * 添加/编辑outrank的ajax处理
     */
    public function outrank_addedit_ajax()
    {
        if (!IsAdmin('administrator')) {
            $this->error('Permission denied');
        }

        $id = input('outrank_id/d', 0);
        $title = trim(input('title/s', ''));
        $ckind = trim(input('ckind/s', ''));
        $description = trim(input('description/s', ''));
        $token = trim(input('token/s', ''));
        $start_time_raw = trim(input('start_time/s', ''));
        $end_time_raw = trim(input('end_time/s', ''));
        $addition = input('addition/a', []);

        if (empty($title)) {
            $this->error('Title is required');
        }

        // 如果token为空，自动生成
        if (empty($token)) {
            $token = $this->generateRandomToken();
        }

        // datetime-local 提交为 YYYY-MM-DDTHH:mm，MySQL datetime 不接受其中的 T，否则会 SQL 异常导致 500
        $start_time = $this->normalizeDatetimeLocalForMysql($start_time_raw);
        $end_time = $this->normalizeDatetimeLocalForMysql($end_time_raw);
        if ($start_time === false || $end_time === false) {
            $this->error('时间格式错误 (Invalid time format)');
        }
        if ($start_time !== null && $end_time !== null && strtotime($start_time) >= strtotime($end_time)) {
            $this->error('开始时间须早于结束时间 (Start time must be before end time)');
        }

        $data = [
            'title' => $title,
            'ckind' => $ckind,
            'description' => $description,
            'token' => $token,
            'start_time' => $start_time,
            'end_time' => $end_time,
            'addition' => json_encode($addition, JSON_UNESCAPED_UNICODE)
        ];

        if ($id > 0) {
            // 更新
            db('outrank')->where('outrank_id', $id)->update($data);
            $this->success('Outrank updated', null, ['outrank_id' => $id]);
        } else {
            // 新增：默认 flg_allow 为 1（允许推送）
            $data['outrank_uuid'] = GenerateUuidV4();
            $data['in_date'] = CsgOjWireInstant::appWallNaiveSqlNow();
            $data['flg_allow'] = 1; // 新增时默认为1（允许推送）
            // 注意：如果数据库表有 defunct 字段且有默认值，数据库会自动使用默认值
            // 如果表没有该字段，则不插入，避免报错
            $outrank_id = db('outrank')->insertGetId($data);
            $this->success('Outrank added', null, ['outrank_id' => $outrank_id]);
        }
    }

    /**
     * 切换状态（defunct）专用接口
     */
    public function outrank_toggle_status_ajax()
    {
        if (!IsAdmin('administrator')) {
            $this->error('Permission denied');
        }

        $id = input('outrank_id/d', 0);
        if ($id <= 0) {
            $this->error('Invalid outrank_id');
        }

        // 获取当前状态
        $outrank = db('outrank')->where('outrank_id', $id)->find();
        if (!$outrank) {
            $this->error('Outrank not found');
        }

        $d = isset($outrank['defunct']) ? (string) $outrank['defunct'] : '0';
        if ($d === '2') {
            $this->error('已删除的外榜请先在列表中「恢复」再改启用/禁用 (Restore deleted outrank before toggling enabled/disabled)');
        }
        if ($d !== '0' && $d !== '1') {
            $this->error('未知 defunct 取值 (Invalid defunct value)');
        }
        $newStatus = $d === '0' ? '1' : '0';
        db('outrank')->where('outrank_id', $id)->update(['defunct' => $newStatus]);

        $this->success('Status updated', null, ['defunct' => $newStatus]);
    }

    /**
     * 切换推送状态（flg_allow）专用接口
     */
    public function outrank_toggle_allow_ajax()
    {
        if (!IsAdmin('administrator')) {
            $this->error('Permission denied');
        }

        $id = input('outrank_id/d', 0);
        if ($id <= 0) {
            $this->error('Invalid outrank_id');
        }

        // 获取当前状态
        $outrank = db('outrank')->where('outrank_id', $id)->find();
        if (!$outrank) {
            $this->error('Outrank not found');
        }

        // 切换状态：0 <-> 1
        $currentAllow = isset($outrank['flg_allow']) ? $outrank['flg_allow'] : '1';
        $newAllow = $currentAllow == '1' ? '0' : '1';
        db('outrank')->where('outrank_id', $id)->update(['flg_allow' => $newAllow]);
        
        $this->success('Push status updated', null, ['flg_allow' => $newAllow]);
    }

    /**
     * 删除 outrank（软删除，defunct='2'，与「禁用」'1' 区分）
     */
    public function outrank_delete_ajax()
    {
        if (!IsAdmin('administrator')) {
            $this->error('Permission denied');
        }

        $id = input('outrank_id/d', 0);
        if ($id <= 0) {
            $this->error('Invalid outrank_id');
        }

        db('outrank')->where('outrank_id', $id)->update(['defunct' => '2']);
        $this->success('Outrank deleted');
    }

    /**
     * 将已删除（defunct='2'）恢复为禁用（'1'），便于再在列表中启用
     */
    public function outrank_restore_deleted_ajax()
    {
        if (!IsAdmin('administrator')) {
            $this->error('Permission denied');
        }

        $id = input('outrank_id/d', 0);
        if ($id <= 0) {
            $this->error('Invalid outrank_id');
        }

        $outrank = db('outrank')->where('outrank_id', $id)->find();
        if (!$outrank) {
            $this->error('Outrank not found');
        }
        if ((string) $outrank['defunct'] !== '2') {
            $this->error('仅已删除记录可执行恢复 (Only deleted outrank can be restored)');
        }

        db('outrank')->where('outrank_id', $id)->update(['defunct' => '1']);
        $this->success('Restored to disabled', null, ['defunct' => '1']);
    }

    /**
     * 将 HTML datetime-local（YYYY-MM-DDTHH:mm[:ss]）转为 MySQL datetime 字符串；空串为 null；非法为 false。
     */
    private function normalizeDatetimeLocalForMysql($value)
    {
        if ($value === null || $value === '') {
            return null;
        }
        $s = str_replace('T', ' ', trim((string) $value));
        if (preg_match('/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/', $s)) {
            $s .= ':00';
        }
        $ts = strtotime($s);
        if ($ts === false) {
            return false;
        }
        return date('Y-m-d H:i:s', $ts);
    }

    /**
     * 生成随机Token
     */
    private function generateRandomToken($length = 32)
    {
        $chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        $token = '';
        for ($i = 0; $i < $length; $i++) {
            $token .= $chars[random_int(0, strlen($chars) - 1)];
        }
        return $token;
    }

    /**
     * 下载单条外榜整包 JSON（库行 + rank.json）
     * GET outrank_id — 仅 administrator
     */
    public function outrank_export_download()
    {
        if (!IsAdmin('administrator')) {
            $this->error('Permission denied');
        }

        $id = input('outrank_id/d', 0);
        if ($id <= 0) {
            $this->error('Invalid outrank_id');
        }

        $outrank = db('outrank')->where('outrank_id', $id)->find();
        if (!$outrank) {
            $this->error('Outrank not found');
        }

        $payload = $this->buildOutrankExportPayload($outrank);

        $safePrefix = preg_replace('/[^0-9a-z_-]/i', '', substr($outrank['outrank_uuid'], 0, 8));
        $filename = 'outrank_pack_' . $safePrefix . '_' . date('Ymd_His') . '.json';

        $json = json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
        if ($json === false) {
            $this->error('Export encode failed');
        }

        header('Content-Type: application/json; charset=utf-8');
        header('Content-Disposition: attachment; filename="' . $filename . '"');
        header('Cache-Control: no-store, no-cache, must-revalidate');
        echo $json;
        exit;
    }

    /**
     * 导入外榜整包 JSON（按 outrank_uuid 存在则更新，否则插入）
     * POST application/json — 仅 administrator
     */
    public function outrank_import_ajax()
    {
        if (!IsAdmin('administrator')) {
            $this->error('Permission denied');
        }

        $raw = $this->request->getContent();
        $payload = json_decode($raw, true);
        if (!is_array($payload)) {
            $this->error('Invalid JSON body');
        }

        $err = $this->validateOutrankImportPayload($payload);
        if ($err !== null) {
            $this->error($err);
        }

        $pkgWallIana = null;
        if (isset($payload['csg_export_timezone']) && is_array($payload['csg_export_timezone'])) {
            $pkgWallIana = trim((string) ($payload['csg_export_timezone']['iana'] ?? ''));
            if ($pkgWallIana === '') {
                $pkgWallIana = null;
            }
        }

        $meta = $payload['meta'];
        $uuid = trim((string) $meta['outrank_uuid']);

        $row = db('outrank')->where('outrank_uuid', $uuid)->find();
        $priorDeleted = $row && (string) (isset($row['defunct']) ? $row['defunct'] : '0') === '2';

        $tokenIn = isset($meta['token']) ? trim((string) $meta['token']) : '';

        $metaChanged = false;

        if ($row) {
            // 更新：仅写入 meta 中**显式出现**的键，避免省略字段时被默认值覆盖（与 token 空则保留 一致）
            $data = [];
            if (array_key_exists('title', $meta)) {
                $t = trim((string) $meta['title']);
                if ($t === '') {
                    $this->error('meta.title 不能为空 (title is required)');
                }
                $data['title'] = $t;
            }
            if (array_key_exists('ckind', $meta)) {
                $data['ckind'] = trim((string) $meta['ckind']);
            }
            if (array_key_exists('description', $meta)) {
                $data['description'] = (string) $meta['description'];
            }
            if (array_key_exists('start_time', $meta)) {
                $st = $this->normalizeDatetimeImport($meta['start_time'], $pkgWallIana);
                if ($st === false) {
                    $this->error('时间字段格式错误 (Invalid start_time/end_time)');
                }
                $data['start_time'] = $st;
            }
            if (array_key_exists('end_time', $meta)) {
                $et = $this->normalizeDatetimeImport($meta['end_time'], $pkgWallIana);
                if ($et === false) {
                    $this->error('时间字段格式错误 (Invalid start_time/end_time)');
                }
                $data['end_time'] = $et;
            }
            if (array_key_exists('flg_allow', $meta)) {
                $data['flg_allow'] = $this->normalizeTinyIntImport($meta['flg_allow'], 1);
            }
            if (array_key_exists('defunct', $meta)) {
                $data['defunct'] = $this->normalizeDefunctImport($meta['defunct']);
            }
            if (array_key_exists('addition', $meta)) {
                $data['addition'] = $this->encodeAdditionForDb($meta['addition']);
            }
            if ($tokenIn !== '') {
                $data['token'] = $tokenIn;
            }

            if (array_key_exists('start_time', $meta) || array_key_exists('end_time', $meta)) {
                $effSt = array_key_exists('start_time', $meta)
                    ? $this->normalizeDatetimeImport($meta['start_time'], $pkgWallIana)
                    : $this->normalizeDatetimeImport(isset($row['start_time']) ? $row['start_time'] : null, null);
                $effEt = array_key_exists('end_time', $meta)
                    ? $this->normalizeDatetimeImport($meta['end_time'], $pkgWallIana)
                    : $this->normalizeDatetimeImport(isset($row['end_time']) ? $row['end_time'] : null, null);
                if ($effSt === false || $effEt === false) {
                    $this->error('时间字段格式错误 (Invalid start_time/end_time)');
                }
                if ($effSt !== null && $effEt !== null
                    && strtotime((string) $effSt) >= strtotime((string) $effEt)) {
                    $this->error('开始时间须早于结束时间 (Start time must be before end time)');
                }
            }

            $metaChanged = $data !== [];
            if ($metaChanged) {
                db('outrank')->where('outrank_id', $row['outrank_id'])->update($data);
            }
            $outrankId = (int) $row['outrank_id'];
            $action = 'updated';
        } else {
            $data = [
                'title' => isset($meta['title']) ? trim((string) $meta['title']) : '',
                'ckind' => isset($meta['ckind']) ? trim((string) $meta['ckind']) : '',
                'description' => isset($meta['description']) ? (string) $meta['description'] : '',
                'start_time' => $this->normalizeDatetimeImport(isset($meta['start_time']) ? $meta['start_time'] : null, $pkgWallIana),
                'end_time' => $this->normalizeDatetimeImport(isset($meta['end_time']) ? $meta['end_time'] : null, $pkgWallIana),
                'addition' => $this->encodeAdditionForDb(isset($meta['addition']) ? $meta['addition'] : null),
                'flg_allow' => $this->normalizeTinyIntImport(isset($meta['flg_allow']) ? $meta['flg_allow'] : 1, 1),
                'defunct' => $this->normalizeDefunctImport(isset($meta['defunct']) ? $meta['defunct'] : '0'),
            ];
            if ($tokenIn !== '') {
                $data['token'] = $tokenIn;
            } else {
                $data['token'] = $this->generateRandomToken();
            }

            if ($data['title'] === '') {
                $this->error('meta.title 不能为空 (title is required)');
            }

            if ($data['start_time'] === false || $data['end_time'] === false) {
                $this->error('时间字段格式错误 (Invalid start_time/end_time)');
            }
            if ($data['start_time'] !== null && $data['end_time'] !== null
                && strtotime($data['start_time']) >= strtotime($data['end_time'])) {
                $this->error('开始时间须早于结束时间 (Start time must be before end time)');
            }

            $data['outrank_uuid'] = $uuid;
            $data['in_date'] = isset($meta['in_date']) && $meta['in_date'] !== ''
                ? $this->normalizeDatetimeImport($meta['in_date'], $pkgWallIana)
                : CsgOjWireInstant::appWallNaiveSqlNow();
            if ($data['in_date'] === false) {
                $this->error('meta.in_date 时间格式错误 (Invalid meta.in_date)');
            }
            $outrankId = (int) db('outrank')->insertGetId($data);
            $action = 'created';
            $metaChanged = true;
        }

        $ojPath = config('OjPath.');

        $rankKeyPresent = array_key_exists('rank_data', $payload);
        if ($rankKeyPresent) {
            $this->applyImportedRankData($uuid, $payload['rank_data']);
        }
        $rankDataStatus = !$rankKeyPresent ? 'omitted' : ($payload['rank_data'] === null ? 'deleted' : 'written');

        $phKeyPresent = array_key_exists('page_header_image', $payload);
        $pageHeaderStatus = 'omitted';
        if ($phKeyPresent) {
            try {
                OutrankSponsorBannerService::applyImportFromPackField(
                    $ojPath['PUBLIC'],
                    $ojPath['outrank_ATTACH'],
                    $uuid,
                    $payload['page_header_image']
                );
                $pageHeaderStatus = $payload['page_header_image'] === null ? 'deleted' : 'written';
            } catch (\Throwable $e) {
                $this->error($e->getMessage());
            }
            db('outrank')->where('outrank_uuid', $uuid)->update([
                'updated_at' => CsgOjWireInstant::appWallNaiveSqlNow(),
            ]);
        }

        // 原为「已删除」的记录被整包覆盖导入后，自动回到禁用（未启用），避免直接对访客可见
        $restoredFromDeleted = false;
        if ($priorDeleted) {
            db('outrank')->where('outrank_id', $outrankId)->update(['defunct' => '1']);
            $restoredFromDeleted = true;
            $metaChanged = true;
        }

        $fresh = db('outrank')->where('outrank_id', $outrankId)->find();
        $titleForMsg = trim((string) (isset($fresh['title']) ? $fresh['title'] : ''));
        if ($titleForMsg === '') {
            $titleForMsg = '（无标题）';
        }
        $uuidShort = strlen($uuid) > 13 ? substr($uuid, 0, 8) . '…' : $uuid;

        [$msgCn, $msgEn] = $this->formatOutrankImportSuccessMessages(
            $action,
            $titleForMsg,
            $uuidShort,
            $metaChanged,
            $rankDataStatus
        );
        if ($restoredFromDeleted) {
            $msgCn .= ' 该记录原为「已删除」，导入后已自动设为禁用（未启用），可按需在列表中启用。';
            $msgEn .= ' Row was deleted; after import it was set to disabled (not enabled) — enable manually in the list if needed.';
        }
        if ($pageHeaderStatus === 'written') {
            $msgCn .= ' 已写入页眉横幅。';
            $msgEn .= ' Header banner was written.';
        } elseif ($pageHeaderStatus === 'deleted') {
            $msgCn .= ' 已删除页眉横幅。';
            $msgEn .= ' Header banner was removed.';
        }

        $this->success($msgCn, null, [
            'msg_en' => $msgEn,
            'outrank_id' => $outrankId,
            'outrank_uuid' => $uuid,
            'action' => $action,
            'meta_changed' => $metaChanged,
            'rank_data_status' => $rankDataStatus,
            'page_header_image_status' => $pageHeaderStatus,
            'restored_from_deleted' => $restoredFromDeleted,
        ]);
    }

    /**
     * @param string $action created|updated
     * @param string $rankDataStatus omitted|written|deleted
     * @return array{0:string,1:string} [中文, English]
     */
    private function formatOutrankImportSuccessMessages($action, $titleForMsg, $uuidShort, $metaChanged, $rankDataStatus)
    {
        $t = $titleForMsg;
        if ($action === 'created') {
            $rankPartCn = [
                'written' => '已写入盘上 rank.json。',
                'deleted' => '包内 rank_data 为 null，已删除盘上 rank.json（若曾存在）。',
                'omitted' => '包内未包含 rank_data 键，未创建或修改 rank.json；需推送或再导入含榜单数据的整包。',
            ];
            $rankPartEn = [
                'written' => 'rank.json on disk was written.',
                'deleted' => 'rank_data was null; rank.json removed if it existed.',
                'omitted' => 'rank_data key was omitted; rank.json was not created or changed — push data or import a pack that includes rank_data.',
            ];
            $cn = '已新增外榜「' . $t . '」（UUID ' . $uuidShort . '）。' . $rankPartCn[$rankDataStatus];
            $en = 'New outrank "' . $t . '" (UUID ' . $uuidShort . '). ' . $rankPartEn[$rankDataStatus];
            return [$cn, $en];
        }

        // updated：按 UUID 覆盖同一行，不新增列表条目
        $headCn = 'UUID 已对应列表中的外榜「' . $t . '」，已按整包做覆盖式更新（不会新增一行）。';
        $headEn = 'UUID matched existing outrank "' . $t . '"; import updated that row (no new list entry). ';

        $metaCn = $metaChanged ? '库表元数据已按包内出现的字段更新。' : '库表元数据未改（包中未含可合并的 meta 字段，或与当前库值相同）。';
        $metaEn = $metaChanged ? 'Table columns present in meta were updated. '
            : 'No meta columns changed (no mergeable meta keys in pack, or values unchanged). ';

        if ($rankDataStatus === 'written') {
            $rankCn = 'rank.json 已整文件替换。';
            $rankEn = 'rank.json was fully replaced. ';
        } elseif ($rankDataStatus === 'deleted') {
            $rankCn = '包内 rank_data 为 null，已删除盘上 rank.json（若曾存在）。';
            $rankEn = 'rank_data was null; rank.json removed if it existed. ';
        } else {
            $rankCn = '包内未包含 rank_data 键，盘上 rank.json 未改动（与文档一致：省略则不覆盖文件）。';
            $rankEn = 'rank_data key was omitted; rank.json on disk was left unchanged (per format: omit means do not touch file). ';
        }

        $tailCn = '';
        $tailEn = '';
        if (!$metaChanged && $rankDataStatus === 'omitted') {
            $tailCn = '若预期要刷新榜单，请使用含 rank_data 的整包（例如本站「导出」下载的 JSON）。';
            $tailEn = 'To refresh rank data, import a full pack that includes rank_data (e.g. JSON from Export).';
        }

        return [$headCn . $metaCn . $rankCn . $tailCn, $headEn . $metaEn . $rankEn . $tailEn];
    }

    /**
     * @param array $outrank db('outrank')->find 行
     * @return array
     */
    private function buildOutrankExportPayload(array $outrank)
    {
        $ojPath = config('OjPath.');
        $rankPath = $ojPath['PUBLIC'] . $ojPath['outrank_ATTACH'] . '/' . $outrank['outrank_uuid'] . '/rank.json';

        $rankData = null;
        if (is_file($rankPath)) {
            $raw = file_get_contents($rankPath);
            if ($raw !== false && trim($raw) !== '') {
                $decoded = json_decode($raw, true);
                if ($decoded === null && json_last_error() !== JSON_ERROR_NONE) {
                    $this->error('服务器上 rank.json 无法解析，请先修复后再导出 (rank.json on server is invalid JSON)');
                }
                $rankData = $decoded;
            }
        }

        if (is_array($rankData)) {
            $tc = CsgOjWireInstant::rankAjaxTimeContext();
            if (!isset($rankData['time_context']) || !is_array($rankData['time_context'])) {
                $rankData['time_context'] = $tc;
            } else {
                try {
                    CsgOjWireInstant::assertRankPayloadHasTimeContext($rankData);
                } catch (\Throwable $e) {
                    $this->error('盘上 rank.json 的 time_context 无效: ' . $e->getMessage());
                }
                $w = trim((string) ($rankData['time_context']['wall_clock_timezone'] ?? ''));
                if (strcasecmp($w, (string) $tc['wall_clock_timezone']) !== 0) {
                    $this->error('盘上 rank.json 的 time_context 与本机 app.default_timezone 不一致，请先推送或刷新榜单后再导出');
                }
            }
        }

        $meta = [
            'outrank_id' => (int) $outrank['outrank_id'],
            'outrank_uuid' => $outrank['outrank_uuid'],
            'title' => $outrank['title'],
            'ckind' => $outrank['ckind'],
            'description' => $outrank['description'],
            'token' => $outrank['token'],
            'start_time' => $outrank['start_time'],
            'end_time' => $outrank['end_time'],
            'in_date' => $outrank['in_date'],
            'updated_at' => isset($outrank['updated_at']) ? $outrank['updated_at'] : null,
            'flg_allow' => isset($outrank['flg_allow']) ? (int) $outrank['flg_allow'] : 1,
            'defunct' => isset($outrank['defunct']) ? (string) $outrank['defunct'] : '0',
            'addition' => $this->decodeAdditionForExport(isset($outrank['addition']) ? $outrank['addition'] : null),
        ];

        $pageHeaderImage = null;
        $bannerBin = OutrankSponsorBannerService::readBannerForExport(
            $ojPath['PUBLIC'],
            $ojPath['outrank_ATTACH'],
            $outrank['outrank_uuid']
        );
        if ($bannerBin !== null) {
            $pageHeaderImage = [
                'kind' => $bannerBin['kind'],
                'data_base64' => base64_encode($bannerBin['bytes']),
            ];
        }

        return [
            'csg_outrank_export' => [
                'format_version' => self::OUTRANK_PACK_FORMAT_VERSION,
                'exported_at' => gmdate('Y-m-d\TH:i:s\Z'),
            ],
            'csg_export_timezone' => CsgOjWireInstant::exportSidecarArray(),
            'meta' => $meta,
            'rank_data' => $rankData,
            'page_header_image' => $pageHeaderImage,
        ];
    }

    /**
     * @param mixed $addition DB 中的 json 列或已解码值
     * @return array|\stdClass
     */
    private function decodeAdditionForExport($addition)
    {
        if ($addition === null || $addition === '') {
            return new \stdClass();
        }
        if (is_array($addition)) {
            return $addition;
        }
        if (is_string($addition)) {
            $d = json_decode($addition, true);
            if (is_array($d)) {
                return $d;
            }
            return new \stdClass();
        }
        return new \stdClass();
    }

    /**
     * @param mixed $addition
     * @return string JSON 字符串写入 DB
     */
    private function encodeAdditionForDb($addition)
    {
        if ($addition === null || $addition === '') {
            return '{}';
        }
        if (is_string($addition)) {
            $t = trim($addition);
            if ($t === '') {
                return '{}';
            }
            json_decode($t);
            if (json_last_error() === JSON_ERROR_NONE) {
                return $t;
            }
            return json_encode(['_raw' => $t], JSON_UNESCAPED_UNICODE);
        }
        $enc = json_encode($addition, JSON_UNESCAPED_UNICODE);
        return $enc !== false ? $enc : '{}';
    }

    /**
     * @param array $payload
     * @return string|null 错误文案；null 表示通过
     */
    private function validateOutrankImportPayload(array $payload)
    {
        if (!isset($payload['csg_outrank_export']) || !is_array($payload['csg_outrank_export'])) {
            return '缺少 csg_outrank_export 对象 (Missing envelope)';
        }
        $ver = isset($payload['csg_outrank_export']['format_version'])
            ? (string) $payload['csg_outrank_export']['format_version'] : '';
        if ($ver !== self::OUTRANK_PACK_FORMAT_VERSION) {
            return '不支持的 format_version（当前仅支持 ' . self::OUTRANK_PACK_FORMAT_VERSION . '）';
        }
        if (!isset($payload['csg_export_timezone']) || !is_array($payload['csg_export_timezone'])) {
            return '缺少 csg_export_timezone 对象（IANA 侧车，整包必填）';
        }
        try {
            $embIana = CsgOjWireInstant::validateEmbeddedExportTimezone($payload['csg_export_timezone']);
        } catch (\Throwable $e) {
            return $e->getMessage();
        }
        if (isset($payload['rank_data']) && is_array($payload['rank_data'])) {
            try {
                CsgOjWireInstant::assertRankPayloadHasTimeContext($payload['rank_data']);
            } catch (\Throwable $e) {
                return $e->getMessage();
            }
            $w = trim((string) ($payload['rank_data']['time_context']['wall_clock_timezone'] ?? ''));
            if ($embIana !== null && strcasecmp((string) $embIana, $w) !== 0) {
                return 'rank_data.time_context.wall_clock_timezone 与 csg_export_timezone.iana 不一致';
            }
        }
        if (!isset($payload['meta']) || !is_array($payload['meta'])) {
            return '缺少 meta 对象';
        }
        $uuid = isset($payload['meta']['outrank_uuid']) ? trim((string) $payload['meta']['outrank_uuid']) : '';
        if ($uuid === '' || !$this->isValidOutrankUuid($uuid)) {
            return 'meta.outrank_uuid 无效（须为 UUID 字符串）';
        }
        if (array_key_exists('rank_data', $payload)) {
            $rd = $payload['rank_data'];
            if ($rd !== null && !is_array($rd)) {
                return 'rank_data 须为对象/数组或 null';
            }
        }
        if (array_key_exists('page_header_image', $payload)) {
            $ph = $payload['page_header_image'];
            if ($ph !== null) {
                if (!is_array($ph)) {
                    return 'page_header_image 须为 null 或对象 (must be null or object)';
                }
                $kind = isset($ph['kind']) ? strtolower(trim((string) $ph['kind'])) : '';
                if ($kind !== 'webp' && $kind !== 'svg') {
                    return 'page_header_image.kind 须为 webp 或 svg (kind must be webp|svg)';
                }
                if (!isset($ph['data_base64']) || !is_string($ph['data_base64'])) {
                    return 'page_header_image.data_base64 须为非空字符串 (data_base64 required)';
                }
                $b64 = preg_replace('/\s+/', '', (string) $ph['data_base64']);
                if ($b64 === '') {
                    return 'page_header_image.data_base64 不能为空 (data_base64 empty)';
                }
                if (strlen($b64) > 32 * 1024 * 1024) {
                    return 'page_header_image.data_base64 过大 (base64 too large)';
                }
                $raw = base64_decode($b64, true);
                if ($raw === false || $raw === '') {
                    return 'page_header_image Base64 解码失败 (Base64 decode failed)';
                }
                if (strlen($raw) > OutrankSponsorBannerService::EXPORT_MAX_RAW_BYTES * 2) {
                    return '页眉图解码后过大 (Decoded image too large)';
                }
            }
        }

        return null;
    }

    private function isValidOutrankUuid($s)
    {
        return (bool) preg_match(
            '/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i',
            $s
        );
    }

    /**
     * 导入用时间：null、空串 -> null；datetime 字符串 -> MySQL datetime；非法 -> false
     *
     * @param mixed $value
     * @return string|null|false
     */
    /**
     * @param string|null $packageWallIana 包声明的 naive 墙钟 IANA；来自库快照时传 null（已是应用时区语义）
     */
    private function normalizeDatetimeImport($value, $packageWallIana = null)
    {
        if ($value === null || $value === '') {
            return null;
        }
        $raw = trim((string) $value);
        if ($raw === '') {
            return null;
        }
        $appTz = (string) config('app.default_timezone');
        try {
            $ms = CsgOjWireInstant::parseToUnixMs($raw, [], $packageWallIana, $appTz);
        } catch (\Throwable $e) {
            return false;
        }
        $tz = new \DateTimeZone($appTz);

        return (new \DateTimeImmutable('@' . (int) floor($ms / 1000)))
            ->setTimezone($tz)
            ->format('Y-m-d H:i:s');
    }

    private function normalizeTinyIntImport($v, $default = 1)
    {
        if ($v === null || $v === '') {
            return (int) $default;
        }
        return ((int) $v) ? 1 : 0;
    }

    private function normalizeDefunctImport($v)
    {
        $s = strtolower(trim((string) $v));
        if ($s === '2' || $s === 'd' || $s === 'deleted' || $s === 'del') {
            return '2';
        }
        if ($s === '1' || $s === 'y' || $s === 'yes') {
            return '1';
        }
        return '0';
    }

    /**
     * @param string $uuid
     * @param mixed $rankData null 表示删除 rank.json；array 写入
     */
    private function applyImportedRankData($uuid, $rankData)
    {
        if ($rankData === null) {
            OutrankPusherHelper::removeRankJsonForUuid($uuid);
            return;
        }

        if (!is_array($rankData)) {
            $this->error('rank_data 须为对象或 null');
        }

        try {
            OutrankPusherHelper::writeRankJsonForUuid($uuid, $rankData);
        } catch (\RuntimeException $e) {
            $this->error($e->getMessage());
        } catch (\Throwable $e) {
            $this->error($e->getMessage());
        }

        db('outrank')->where('outrank_uuid', $uuid)->update([
            'updated_at' => CsgOjWireInstant::appWallNaiveSqlNow(),
        ]);
    }

    /**
     * 外榜页眉横幅元数据（是否存在、URL、mtime）— 仅大管理员
     */
    public function outrank_page_header_meta_ajax()
    {
        if (!IsAdmin('administrator')) {
            $this->error('Permission denied');
        }
        $id = input('outrank_id/d', 0);
        if ($id <= 0) {
            $this->error('Invalid outrank_id');
        }
        $outrank = db('outrank')->where('outrank_id', $id)->find();
        if (!$outrank) {
            $this->error('Outrank not found');
        }
        $ojPath = config('OjPath.');
        $meta = OutrankSponsorBannerService::resolvePublicMeta(
            $ojPath['PUBLIC'],
            $ojPath['outrank_ATTACH'],
            $ojPath['outrank_ATTACH'],
            $outrank['outrank_uuid']
        );
        if (!$meta) {
            $this->success('ok', null, ['kind' => '', 'url' => '', 'mtime' => 0]);
        }
        $this->success('ok', null, $meta);
    }

    /**
     * 上传页眉横幅（svg 原样保存；栅格须为前端生成的 WebP）— 仅大管理员
     */
    public function outrank_page_header_upload_ajax()
    {
        if (!IsAdmin('administrator')) {
            $this->error('Permission denied');
        }
        $id = input('outrank_id/d', 0);
        if ($id <= 0) {
            $this->error('Invalid outrank_id');
        }
        $outrank = db('outrank')->where('outrank_id', $id)->find();
        if (!$outrank) {
            $this->error('Outrank not found');
        }

        $file = request()->file('file');
        if (!$file) {
            $this->error('请选择文件 (No file uploaded)');
        }

        $ojPath = config('OjPath.');
        $maxBytes = (int) config('CsgojConfig.OJ_UPLOAD_ATTACH_MAXSIZE');
        $info = $file->validate(['size' => $maxBytes, 'ext' => 'webp,svg'])->move(sys_get_temp_dir());
        if (!$info) {
            $this->error(ThinkUploadFailMessage($file));
        }

        $tmpPath = $info->getPathname();
        $origName = $file->getInfo('name');

        try {
            OutrankSponsorBannerService::processAndSave(
                $tmpPath,
                $origName,
                $ojPath['PUBLIC'],
                $ojPath['outrank_ATTACH'],
                $outrank['outrank_uuid']
            );
        } catch (\Throwable $e) {
            if (isset($tmpPath) && is_string($tmpPath) && $tmpPath !== '' && is_file($tmpPath)) {
                @unlink($tmpPath);
            }
            $this->error(CsgThrowableMessageOrFallback($e));
        }

        db('outrank')->where('outrank_id', $id)->update(['updated_at' => CsgOjWireInstant::appWallNaiveSqlNow()]);

        $meta = OutrankSponsorBannerService::resolvePublicMeta(
            $ojPath['PUBLIC'],
            $ojPath['outrank_ATTACH'],
            $ojPath['outrank_ATTACH'],
            $outrank['outrank_uuid']
        );
        $this->success('Saved', null, $meta ?: ['kind' => '', 'url' => '', 'mtime' => 0]);
    }

    /**
     * 删除页眉横幅 — 仅大管理员
     */
    public function outrank_page_header_delete_ajax()
    {
        if (!IsAdmin('administrator')) {
            $this->error('Permission denied');
        }
        $id = input('outrank_id/d', 0);
        if ($id <= 0) {
            $this->error('Invalid outrank_id');
        }
        $outrank = db('outrank')->where('outrank_id', $id)->find();
        if (!$outrank) {
            $this->error('Outrank not found');
        }
        $ojPath = config('OjPath.');
        OutrankSponsorBannerService::deleteAllInDir(
            $ojPath['PUBLIC'],
            $ojPath['outrank_ATTACH'],
            $outrank['outrank_uuid']
        );
        db('outrank')->where('outrank_id', $id)->update(['updated_at' => CsgOjWireInstant::appWallNaiveSqlNow()]);
        $this->success('Deleted', null, ['kind' => '', 'url' => '', 'mtime' => 0]);
    }

}

