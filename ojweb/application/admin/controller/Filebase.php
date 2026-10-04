<?php

/**
 * Created by PhpStorm.
 * User: CSGrandeur
 * Date: 2017/3/2
 * Time: 22:20
 */

namespace app\admin\controller;

use app\common\funcs\UploadChunkMerge;

class Filebase extends Adminbase
{

    var $filenameRe;
    var $filenameReMsg;
    var $maxFileSize;
    var $maxFileNum;
    var $inputInfo;            //get/post参数得到的信息
    var $itemInfo;            //根据id查数据库的信息
    var $allowField;
    var $ojPath;
    var $validateRule;
    public function initialize()
    {
        $this->OJMode();
        $this->AdminInit();
        $this->FilebaseInit();
    }
    public function FilebaseInit()
    {
        /* 连字符须写在 [] 末尾或转义，勿写 Z-_（否则成 ASCII 范围，不含「-」） */
        $this->filenameRe = '/^[A-Za-z0-9._()-]+\.(jpg|png|gif|bmp|svg|ico)$/i';
        $this->filenameReMsg = "<br/>只允许包含字母数字的文件名<br/>Only jpg|png|gif|bmp|svg|ico with <strong>alphanumeric file name</strong> allowed";
        $this->maxFileSize = config('CsgojConfig.OJ_UPLOAD_ATTACH_MAXSIZE');
        $this->assign('maxfilesize', $this->maxFileSize);
        $this->maxFileNum = config('CsgojConfig.OJ_UPLOAD_MAXNUM');
        $this->assign('maxFileNum', $this->maxFileNum);
        $this->validateRule = ['size' => $this->maxFileSize, 'ext' => 'jpg,png,gif,bmp,svg,ico'];
        $this->GetInput();
        $this->FileAuthentication();
    }
    public function filemanager_ajax()
    {
        $filelist = $this->GetDir();
        return $filelist;
    }
    public function GetInput()
    {
        $this->ojPath = config('OjPath.');
        //Admin ChangeDefunct管理的通用验证，$item = news、problem、contest
        $this->inputInfo = [
            'item' => trim(input('item', '')),
            'id' => trim(input('id', '')),
            // course 等资源可能需要 key（比如 course_key）来作为附件目录名
            'key' => trim(input('key', '')),
            'filename' => trim(input('filename', '')),         //仅在删除、修改
            'rename' => trim(input('rename', '')),         //仅在修改文件名时有此项
            'path' => '',
        ];
        $this->privilegeStr = $this->inputInfo['item']; //比如 problem
    }
    public function FileAuthentication()
    {
        // Adminbase中的基本权限验证，即验证是否有 problem_editor 这样的item权限
        $this->BaseAuthentication($this->privilegeStr);

        // exp 模式下：这些资源通常由 course_item 维护归属。
        // 为避免跨课程上下文误操作，这里做“轻量一致性校验”：
        // - 仅当 NOW_COURSE_ID 存在 且 能从 course_item 查到归属时才校验
        // - 查不到（老数据/未入 course_item）则不拦截，保持兼容
        if($this->NOW_COURSE_ID && !IsAdmin() && in_array($this->inputInfo['item'], ['contest', 'problem', 'news', 'ex_question'])) {
            $cache_time = config('CsgojConfig.OJ_PRIVILEGE_CACHE_TIME');
            $cid = db('course_item')->where([
                'item' => $this->inputInfo['item'],
                'item_id' => intval($this->inputInfo['id']),
            ])
            // 兼容历史数据：pvrole 可能是 NULL 或空字符串
            ->where(function($q) {
                $q->whereNull('pvrole')->whereOr('pvrole', '');
            })
            ->cache($cache_time)->value('course_id');
            if($cid && intval($cid) !== intval($this->NOW_COURSE_ID)) {
                $this->error("You don't have permission to manage this item in current course context");
            }
        }

        // course：表结构没有 attach 字段，使用 course_key 作为附件目录名（无需改数据库结构）
        if ($this->inputInfo['item'] === 'course') {
            $course_id = intval($this->inputInfo['id']);
            if ($course_id <= 0) {
                $this->error('No such course.');
            }
            // 允许 course 的 super/admin/teacher 访问附件
            if (!PrivItem('course', $course_id, ['super', 'admin', 'teacher'])) {
                $this->error("You don't own this item.");
            }
            $course = db('course')->where('course_id', $course_id)->field(['course_id', 'course_key', 'course_title'])->find();
            if (!$course) {
                $this->error('No such course.');
            }
            $this->itemInfo = [
                'attach' => $course['course_key'],
                'title'  => $course['course_title'],
            ];
            return;
        }

        if (!IsAdmin($this->inputInfo['item'], $this->inputInfo['id'])) {
            //判断有无管理此模块下对应id的专有权限
            $this->error("You don't own this item.");
        }
        $this->itemInfo = db($this->inputInfo['item'])
            ->where($this->inputInfo['item'] . '_id', $this->inputInfo['id'])
            ->field('attach,title')
            ->find();
        if (!$this->itemInfo) {
            //无此条目
            $this->error('No such ' . $this->inputInfo['item'] . '.');
        } else {
            //更新没有attach的旧数据或者因为bug没更新该字段的数据
            if (!array_key_exists('attach', $this->itemInfo) || strlen($this->itemInfo['attach']) == 0) {
                $this->itemInfo['attach'] = $this->AttachFolderCalculation(session('user_id'));
                db($this->inputInfo['item'])
                    ->where($this->inputInfo['item'] . '_id', $this->inputInfo['id'])
                    ->update($this->itemInfo);
            }
        }
    }
    protected function PostProcessUploadedFile($finalFilePath, $fileName)
    {
        // 上传成功后的处理
    }
    protected function validateUploadFilename($fileName)
    {
        return (bool) preg_match($this->filenameRe, $fileName);
    }
    public function chunk_upload_ajax()
    {
        $fileName = request()->post('fileName');
        if (!$this->validateUploadFilename($fileName)) {
            $this->error($fileName . ": 文件名不合法(Name not valid)");
        }
        $ret = UploadChunkMerge::receiveChunk(
            request()->file('upload_file'),
            request()->post('index'),
            request()->post('totalChunks'),
            (string) $fileName,
            $this->inputInfo['path'],
            $this->ojPath['chunk_file_temp'],
            function (string $finalFilePath, string $fn): void {
                $this->PostProcessUploadedFile($finalFilePath, $fn);
            }
        );
        if (!$ret['ok']) {
            $this->error($ret['err']);
        }
        if ($ret['merged']) {
            $this->success('OK', '', ['saved_files' => $ret['saved_files']]);
        }
        $this->success(
            '分片上传成功(Chunk uploaded successfully)',
            '',
            ['fileName' => $ret['fileName'], 'index' => $ret['index'], 'total' => $ret['total']]
        );
    }
    public function upload_ajax()
    {
        $files = request()->file("upload_file");
        // 移动到框架应用根目录/public/uploads/ 目录下
        if (count($files) > $this->maxFileNum) {
            $this->error('单次文件数量限制(Number of files limit once): ' . $this->maxFileNum);
        }
        $infolist = '';
        $atLeastOneFile = 0;
        $savedFiles = [];
        foreach ($files as $file) {
            $filename = $file->getinfo('name');
            if (!preg_match($this->filenameRe, $filename)) {
                $infolist .= "<br/>" . $filename . ": 文件名不合法(Name not valid)";
                continue;
            }
            $info = $file->validate($this->validateRule)->move($this->inputInfo['path'], '');
            if (!$info) {
                $infolist .= "<br/>" . $filename . ": " . ($file->getError());
            } else {
                $atLeastOneFile++;
                $savedFiles[] = str_replace('\\', '/', (string) $info->getSaveName());
            }
        }
        if ($infolist == '') {
            $this->success('OK', '', ['saved_files' => $savedFiles]);
        } else {
            $this->error('存在文件上传失败(Some files upload failed)' . $infolist);
        }
    }
    public function file_delete_ajax()
    {
        if ($this->inputInfo['filename'] == '') {
            $this->error("No filename gaved."); // 以免删除整个目录
        }
        if (is_dir($this->inputInfo['path'] . '/' . $this->inputInfo['filename'])) {
            $this->error("禁止删除目录");
        } else {
            $ret = DelWhatever($this->inputInfo['path'] . '/' . $this->inputInfo['filename']);
            if ($ret === false)
                $this->error("Failed to delete " . $this->inputInfo['filename']);
            $this->success($ret . " [" . $this->inputInfo['filename'] . "] successfully deleted.");
        }
    }
    public function file_rename_ajax()
    {
        if (!preg_match($this->filenameRe, $this->inputInfo['rename'])) {
            $this->error("Please enter a valid filename<br/>" . $this->filenameReMsg);
        }
        if (!rename($this->inputInfo['path'] . '/' . $this->inputInfo['filename'], $this->inputInfo['path'] . '/' . $this->inputInfo['rename'])) {
            $this->error('Failed.');
        }
        $this->ojPath = config('OjPath.');
        // URL 使用 attach 目录名（不是 id）
        $file_url = $this->ojPath[$this->inputInfo['item'] . '_ATTACH'] . '/' . $this->itemInfo['attach'] . '/' . $this->inputInfo['rename'];
        $this->success(
            'Renamed to ' . $this->inputInfo['rename'],
            '',
            ['rename' => "<a href='" . $file_url . "' filename='" . $this->inputInfo['rename'] . "' target='_blank'>" . $this->inputInfo['rename'] . "</a>"]
        );
    }
    //获取目标文件夹文件列表
    public function GetDir()
    {
        $path = $this->inputInfo['path'];
        $filelist = [];
        if ($handle = opendir($path)) {
            $i = 1;
            while (($file = readdir($handle)) !== false) {
                if ($file != "." && $file != "..") {
                    $file_url = $this->ojPath[$this->inputInfo['item'] . '_ATTACH'] . '/' . $this->itemInfo['attach'] . '/' . $file;
                    $mt = (int) filemtime($path . '/' . $file);
                    $filelist[] = [
                        'file_lastmodify' => date("Y-m-d h:i:s", $mt),
                        'file_name' => $file,
                        'file_size' => round(filesize($path . '/' . $file) / 1024, 3),
                        'file_type' => mime_content_type($path . '/' . $file),
                        'file_url' => $file_url,
                        '_sort_mtime' => $mt,
                    ];
                    $i++;
                }
            }
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
    public function downloaddata()
    {
        $fn = $this->inputInfo['filename'];
        // 与 worker 题包命名 _safe_problem_zip_segment 一致：A-Za-z0-9._-；() 供重命名；禁止路径片段
        if (strpos($fn, '..') !== false || !preg_match('/^[A-Za-z0-9._()-]+$/i', $fn)) {
            $this->error("Please use a valid filename.");
        }
        $extension = pathinfo($this->inputInfo['filename'], PATHINFO_EXTENSION);
        try {
            if ($extension == 'in' || $extension == 'out') {
                downloads($this->inputInfo['path'], $this->inputInfo['filename'], null, 9);
            } else {
                downloads($this->inputInfo['path'], $this->inputInfo['filename']);
            }
        } catch (\Throwable $e) {
            $this->errorBilingual(
                '文件读取失败：' . $e->getMessage(),
                'Download failed: ' . $e->getMessage()
            );
        }
    }
}
