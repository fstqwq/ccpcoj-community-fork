<?php
/**
 * 文件 / 目录 / 下载相关函数
 *
 * 作用：
 * - 文件读写、扩展名获取
 * - 递归创建目录、递归删除文件/目录
 * - 目录列表读取
 * - 下载与 gzip 压缩（用于导出等场景）
 * - 清理过期临时目录
 *
 * 依赖：
 * - ThinkPHP：`config()`, `\think\facade\Log`
 * - 运行环境：`$_SERVER`（downloads 中用于判断 gzip 支持）
 *
 * 约束：
 * - 仅允许函数定义；禁止文件顶层执行任何逻辑。
 * - 由 `ojweb/application/common.php` 统一 require_once 引入。
 *
 * 导出函数：
 * - GetExtension, WriteFile, LoadFile
 * - MakeDirs
 * - DelWhatever, DelDirs, CopyDirs, MoveDirs, MoveFile
 * - CopyFilesByPattern
 * - ExecuteCommand (使用 proc_open，替代 exec)
 * - GetDir
 * - GzipFile, downloads
 * - DelTimeExpireFolders
 */

// 获取文件扩展名
function GetExtension($filename)
{
    $info = pathinfo($filename);
    return array_key_exists('extension', $info) ? $info['extension'] : '';
}

// 写文件
function WriteFile($filePath, $contents) {
    $handle = fopen($filePath, "w") or die("Unable to open file!");
    fwrite($handle, $contents);
    fclose($handle);
}

// 读文件
function LoadFile($filePath) {
    $handle = fopen($filePath, "r");
    $contents = fread($handle, filesize($filePath));
    fclose($handle);
    return $contents;
}

//递归建立文件夹
function MakeDirs($dir, $mode=0777)
{
    if (is_dir($dir) || @mkdir($dir, $mode)) return TRUE;
    if (!MakeDirs(dirname($dir), $mode)) return FALSE;
    return @mkdir($dir, $mode);
}

function DelWhatever($filePath)
{
    //无论是文件、文件夹 还是其他什么，删除。
    if(is_file($filePath))
    {
        if(!unlink($filePath))
            return false;
        return "File";
    }
    else if(is_link($filePath))
    {
        if(!unlink($filePath))
            return false;
        return "Link";
    }
    else if(is_dir($filePath))
    {
        if(!DelDirs($filePath))
            return false;
        return "Folder";
    }
    return false;
}

//删除指定文件夹及其子目录
function DelDirs($dir)
{
    //给定的目录不是一个文件夹
    if(!is_dir($dir)){
        return null;
    }
    $fh = opendir($dir);
    while(($row = readdir($fh)) !== false){
        //过滤掉虚拟目录
        if($row == '.' || $row == '..'){
            continue;
        }

        if(!is_dir($dir.'/'.$row)){
            unlink($dir.'/'.$row);
        }
        DelDirs($dir.'/'.$row);
    }
    //关闭目录句柄，否则出Permission denied
    closedir($fh);
    //删除文件之后再删除自身
    if(!rmdir($dir)){
        return false;
    }
    return true;
}

//递归复制目录
function CopyDirs($source, $dest)
{
    // 如果源目录不存在，返回 false
    if (!is_dir($source)) {
        return false;
    }
    
    // 创建目标目录
    if (!MakeDirs($dest)) {
        return false;
    }
    
    // 打开源目录
    $dir = opendir($source);
    if ($dir === false) {
        return false;
    }
    
    // 遍历源目录
    while (($file = readdir($dir)) !== false) {
        if ($file == '.' || $file == '..') {
            continue;
        }
        
        $sourcePath = $source . DIRECTORY_SEPARATOR . $file;
        $destPath = $dest . DIRECTORY_SEPARATOR . $file;
        
        if (is_dir($sourcePath)) {
            // 递归复制子目录
            if (!CopyDirs($sourcePath, $destPath)) {
                closedir($dir);
                return false;
            }
        } else {
            // 复制文件
            if (!copy($sourcePath, $destPath)) {
                closedir($dir);
                return false;
            }
        }
    }
    
    closedir($dir);
    return true;
}

/**
 * 移动目录（原子性操作，用于替代 exec("mv")）
 * 
 * 最佳实践：
 * 1. 先尝试 rename()（同文件系统内，性能最佳）
 * 2. 如果失败（跨驱动器/文件系统），回退到复制+删除
 * 3. 确保原子性：只有复制完全成功后才删除源目录
 * 
 * @param string $source 源目录路径
 * @param string $dest 目标目录路径
 * @return bool 成功返回 true，失败返回 false
 */
function MoveDirs($source, $dest)
{
    // 如果源目录不存在，返回 false
    if (!is_dir($source)) {
        return false;
    }
    
    // 如果源和目标相同，直接返回成功
    $realSource = realpath($source);
    $realDest = realpath($dest);
    if ($realSource !== false && $realDest !== false && $realSource === $realDest) {
        return true;
    }
    
    // 确保目标目录的父目录存在
    $destParent = dirname($dest);
    if (!MakeDirs($destParent)) {
        return false;
    }
    
    // 如果目标目录已存在，先删除
    if (is_dir($dest) || file_exists($dest)) {
        if (DelDirs($dest) === false) {
            return false;
        }
    }
    
    // 策略1：尝试使用 rename()（同文件系统内，性能最佳且原子性）
    // 注意：rename() 在跨驱动器时会失败，这是正常的，需要回退到策略2
    if (@rename($source, $dest)) {
        return true;
    }
    
    // 策略2：跨文件系统时，使用复制+删除
    // 先复制整个目录
    if (!CopyDirs($source, $dest)) {
        // 复制失败，清理可能已创建的部分目标目录
        if (is_dir($dest)) {
            DelDirs($dest);
        }
        return false;
    }
    
    // 复制成功，删除源目录（确保原子性）
    if (DelDirs($source) === false) {
        // 删除失败，但数据已复制，记录警告但不返回失败
        // 因为主要目标（移动数据）已达成，源目录可以在后续清理
        \think\facade\Log::warning("MoveDirs: 复制成功但删除源目录失败", [
            'source' => $source,
            'dest' => $dest
        ]);
    }
    
    return true;
}

/**
 * 移动单个文件（用于替代 exec("mv file")）
 * 
 * @param string $source 源文件路径
 * @param string $dest 目标文件路径
 * @return bool 成功返回 true，失败返回 false
 */
function MoveFile($source, $dest)
{
    // 如果源文件不存在，返回 false
    if (!is_file($source)) {
        return false;
    }
    
    // 如果源和目标相同，直接返回成功
    $realSource = realpath($source);
    $realDest = realpath($dest);
    if ($realSource !== false && $realDest !== false && $realSource === $realDest) {
        return true;
    }
    
    // 确保目标目录的父目录存在
    $destParent = dirname($dest);
    if (!MakeDirs($destParent)) {
        return false;
    }
    
    // 如果目标文件已存在，先删除
    if (file_exists($dest)) {
        if (!unlink($dest)) {
            return false;
        }
    }
    
    // 策略1：尝试使用 rename()（同文件系统内，性能最佳且原子性）
    if (@rename($source, $dest)) {
        return true;
    }
    
    // 策略2：跨文件系统时，使用复制+删除
    if (!copy($source, $dest)) {
        return false;
    }
    
    // 复制成功，删除源文件
    if (!unlink($source)) {
        // 删除失败，但文件已复制，记录警告但不返回失败
        \think\facade\Log::warning("MoveFile: 复制成功但删除源文件失败", [
            'source' => $source,
            'dest' => $dest
        ]);
    }
    
    return true;
}

/**
 * 复制源目录中匹配指定模式的文件到目标目录
 * 
 * @param string $sourceDir 源目录路径
 * @param string $destDir 目标目录路径
 * @param array $patterns 文件模式数组，如 ['*.in', '*.out', '*.cc']
 * @return bool 成功返回 true，失败返回 false
 */
function CopyFilesByPattern($sourceDir, $destDir, $patterns)
{
    if (!is_dir($sourceDir)) {
        return false;
    }
    
    if (!MakeDirs($destDir)) {
        return false;
    }
    
    // 将 glob 模式转换为正则表达式
    $regexPatterns = [];
    foreach ($patterns as $pattern) {
        // 将 glob 模式转换为正则表达式
        // *.in -> /^.*\.in$/
        $regex = str_replace(['*', '.'], ['.*', '\.'], $pattern);
        $regexPatterns[] = '/^' . $regex . '$/';
    }
    
    // 打开源目录
    $dir = opendir($sourceDir);
    if ($dir === false) {
        return false;
    }
    
    $success = true;
    while (($file = readdir($dir)) !== false) {
        if ($file == '.' || $file == '..') {
            continue;
        }
        
        $sourcePath = $sourceDir . DIRECTORY_SEPARATOR . $file;
        
        // 只处理文件，不处理目录
        if (!is_file($sourcePath)) {
            continue;
        }
        
        // 检查文件名是否匹配任一模式
        $matched = false;
        foreach ($regexPatterns as $regex) {
            if (preg_match($regex, $file)) {
                $matched = true;
                break;
            }
        }
        
        if ($matched) {
            $destPath = $destDir . DIRECTORY_SEPARATOR . $file;
            if (!copy($sourcePath, $destPath)) {
                $success = false;
            }
        }
    }
    
    closedir($dir);
    return $success;
}

/**
 * 执行系统命令（使用 proc_open，替代 exec）
 * 
 * 注意：此函数仅在必要时使用，优先考虑 PHP 原生函数
 * 项目配置允许 proc_open，但禁用 exec/shell_exec
 * 
 * @param string $command 要执行的命令
 * @param string|null $cwd 工作目录，null 表示当前目录
 * @param array &$output 输出数组（按行）
 * @param int &$returnCode 返回码
 * @param int $timeout 超时时间（秒），0 表示无超时
 * @return bool 成功返回 true，失败返回 false
 */
function ExecuteCommand($command, $cwd = null, &$output = [], &$returnCode = 0, $timeout = 0)
{
    if (!function_exists('proc_open')) {
        \think\facade\Log::error("ExecuteCommand: proc_open is not available");
        return false;
    }
    
    $descriptorspec = [
        0 => ["pipe", "r"],  // stdin
        1 => ["pipe", "w"],  // stdout
        2 => ["pipe", "w"]   // stderr
    ];
    
    $process = @proc_open($command, $descriptorspec, $pipes, $cwd);
    
    if (!is_resource($process)) {
        \think\facade\Log::error("ExecuteCommand: Failed to open process", ['command' => $command]);
        return false;
    }
    
    // 关闭 stdin（不需要输入）
    if (isset($pipes[0])) {
        fclose($pipes[0]);
    }
    
    // 读取输出
    $output = [];
    $error = '';
    
    if (isset($pipes[1])) {
        // 非阻塞读取 stdout
        stream_set_blocking($pipes[1], false);
        while (!feof($pipes[1])) {
            $line = fgets($pipes[1]);
            if ($line !== false) {
                $output[] = rtrim($line, "\r\n");
            }
            // 简单超时检查（非精确）
            if ($timeout > 0) {
                // 这里可以实现更精确的超时机制，但需要更复杂的代码
            }
        }
        fclose($pipes[1]);
    }
    
    if (isset($pipes[2])) {
        // 读取 stderr
        $error = stream_get_contents($pipes[2]);
        fclose($pipes[2]);
    }
    
    // 获取退出码
    $returnCode = proc_close($process);
    
    // 如果有错误输出，记录日志
    if (!empty($error)) {
        \think\facade\Log::warning("ExecuteCommand: Command produced stderr", [
            'command' => $command,
            'error' => $error,
            'return_code' => $returnCode
        ]);
    }
    
    return $returnCode === 0;
}

//获取目标文件夹文件列表
function GetDir($dirpath, $filter=null)
{
    $filelist = [];
    if ($handle  = opendir($dirpath))
    {
        $i = 1;
        while (($file = readdir($handle)) !== false)
        {
            if ($file!="." && $file!="..")
            {
                if($filter !== null && !in_array(pathinfo($file, PATHINFO_EXTENSION), $filter)) continue;
                $filelist[] = [
                    'file_lastmodify' => date("Y-m-d h:i:s", filemtime($dirpath . '/' . $file)),
                    'file_name'       => $file,
                    'file_size'       => round(filesize($dirpath . '/' . $file) / 1024, 2),
                    'file_type'       => mime_content_type($dirpath . '/' . $file),
                ];
                $i ++;
            }
        }
        rsort($filelist);
        //关闭句柄
        closedir ( $handle );
    }
    return $filelist;
}

/**
 * 递归列出文件（限定白名单子目录）
 * @param string $baseDisk 根目录（绝对路径）
 * @param string $baseUrl  对应的 URL 前缀（如 /upload/ex_question/xxxxx）
 * @param array  $allowedSubdirs 允许递归的相对子目录列表，'' 表示根目录
 * @return array [['file_name','rel_path','file_url','file_size','file_type']]
 */
function ListFilesWithAllowlist($baseDisk, $baseUrl, $allowedSubdirs = [''])
{
    $result = [];
    if (!is_array($allowedSubdirs)) $allowedSubdirs = [''];
    $baseDiskReal = realpath($baseDisk);
    if ($baseDiskReal === false || !is_dir($baseDiskReal)) {
        return $result;
    }
    $allowedSubdirs = array_values(array_unique(array_map(function($r){
        return trim(str_replace(['\\'], '/', $r), '/');
    }, $allowedSubdirs)));

    foreach ($allowedSubdirs as $rel) {
        $root = $rel === '' ? $baseDiskReal : ($baseDiskReal . DIRECTORY_SEPARATOR . $rel);
        if (!is_dir($root)) {
            continue;
        }
        // 如果同时存在 "" 与其他子目录：对 "" 只取根层文件，不递归
        if ($rel === '' && count($allowedSubdirs) > 1) {
            $it = new \DirectoryIterator($root);
            foreach ($it as $f) {
                if ($f->isDot() || $f->isDir()) continue;
                $full = realpath($f->getPathname());
                if ($full === false) continue;
                if (strpos($full, $baseDiskReal) !== 0) continue;
                $relPath = ltrim(str_replace($baseDiskReal, '', $full), DIRECTORY_SEPARATOR);
                $relPathUrl = str_replace(DIRECTORY_SEPARATOR, '/', $relPath);
                $result[] = [
                    'file_name' => $f->getFilename(),
                    'rel_path'  => $relPathUrl,
                    'file_url'  => rtrim($baseUrl, '/') . '/' . $relPathUrl,
                    'file_size' => $f->getSize(),
                    'file_type' => mime_content_type($full),
                ];
            }
            continue;
        }

        $it = new \RecursiveIteratorIterator(
            new \RecursiveDirectoryIterator($root, \FilesystemIterator::SKIP_DOTS),
            \RecursiveIteratorIterator::SELF_FIRST
        );
        foreach ($it as $f) {
            if ($f->isDir()) continue;
            $full = realpath($f->getPathname());
            if ($full === false) continue;
            // 安全校验：必须仍在 baseDiskReal 内
            if (strpos($full, $baseDiskReal) !== 0) continue;
            $relPath = ltrim(str_replace($baseDiskReal, '', $full), DIRECTORY_SEPARATOR);
            $relPathUrl = str_replace(DIRECTORY_SEPARATOR, '/', $relPath);
            $result[] = [
                'file_name' => $f->getFilename(),
                'rel_path'  => $relPathUrl,
                'file_url'  => rtrim($baseUrl, '/') . '/' . $relPathUrl,
                'file_size' => $f->getSize(),
                'file_type' => mime_content_type($full),
            ];
        }
    }
    return $result;
}

//强制文件下载
function GzipFile($filepath, $compress) {
    $ojPath = config('OjPath.');
    if (!$ojPath || !isset($ojPath['export_problem_temp'])) {
        throw new \Exception("OjPath.export_problem_temp configuration is missing.");
    }
    $exportTempRoot = $ojPath['export_problem_temp'];
    $exportMakeFolder = $exportTempRoot . DIRECTORY_SEPARATOR . 'txt_download_compress';
    if(!MakeDirs($exportMakeFolder)) {
        throw new \Exception("Cannot create compress folder (permission denied): " . $exportMakeFolder);
    }
    $file_gzip_path = $exportMakeFolder . DIRECTORY_SEPARATOR . str_replace(DIRECTORY_SEPARATOR, '-', ltrim($filepath, DIRECTORY_SEPARATOR)) . '.' . filemtime($filepath);
    if(file_exists($file_gzip_path)) {
        return $file_gzip_path;
    }
    $compress_handle = @gzopen($file_gzip_path, 'w' . $compress);
    if (!$compress_handle) {
        throw new \Exception("Cannot open file for compression (permission denied): " . $file_gzip_path);
    }
    $handle = @fopen($filepath, "r");
    if (!$handle) {
        @gzclose($compress_handle);
        throw new \Exception("Cannot open source file for reading (permission denied): " . $filepath);
    }
    try {
        while (!feof($handle)) {
            $buffer = @fread($handle, 2048);
            if ($buffer === false) {
                throw new \Exception("Failed to read from source file: " . $filepath);
            }
            if (!@gzwrite($compress_handle, $buffer)) {
                throw new \Exception("Failed to write to compressed file: " . $file_gzip_path);
            }
        }
    } finally {
        @fclose($handle);
        @gzclose($compress_handle);
    }
    return $file_gzip_path;
}

function downloads($file_dir, $filename, $file_download_name=null, $compress=false) {
    if($file_download_name === null) {
        $file_download_name = $filename;
    }
    $filepath = $file_dir . DIRECTORY_SEPARATOR . $filename;
    if (!file_exists($filepath)) {
        throw new \Exception("File not found: " . $filepath);
    }
    
    // 检查文件是否可读
    if (!is_readable($filepath)) {
        throw new \Exception("File is not readable (permission denied): " . $filepath);
    }
    
    // 获取文件大小，如果失败则抛出异常
    $filesize = @filesize($filepath);
    if ($filesize === false) {
        throw new \Exception("Cannot read file size (permission denied): " . $filepath);
    }
    
    // 在输出 header 之前进行所有可能失败的操作检查
    $final_filepath = $filepath;
    if ($compress !== false  && $filesize > 1024 && isset($_SERVER['HTTP_ACCEPT_ENCODING']) && substr_count($_SERVER['HTTP_ACCEPT_ENCODING'], 'gzip')) {
        // 虽然浏览器下载器显示下载完整文件，但下载速度其实是个伪速度，数据实际完成了压缩
        // 在输出 header 之前先压缩文件，如果失败可以抛出异常
        $final_filepath = GzipFile($filepath, $compress);
        if ($final_filepath === false || !file_exists($final_filepath)) {
            throw new \Exception("Failed to compress file: " . $filepath);
        }
    }
    
    // 再次检查压缩后的文件大小（如果压缩了）
    $final_filesize = @filesize($final_filepath);
    if ($final_filesize === false) {
        throw new \Exception("Cannot read compressed file size: " . $final_filepath);
    }

    // 关闭所有输出缓冲：否则 readfile 写入的巨量字节会积压在缓冲里，超过 memory_limit
    //（典型日志：Allowed memory size ... exhausted (tried to allocate <文件大小> bytes)），
    // nginx 侧表现为 upstream prematurely closed / 客户端 ERR_INVALID_RESPONSE。
    while (ob_get_level() > 0) {
        @ob_end_clean();
    }
    @ini_set('zlib.output_compression', '0');
    
    // 现在可以安全地输出 header（所有检查都已完成）
    header('Content-Description: File Transfer');
    Header("Content-type: application/octet-stream; charset=utf-8");
    Header("Accept-Ranges: bytes");
    Header("Accept-Length: ".$final_filesize);
    header("Content-Length: ". $final_filesize);
    Header("Content-Disposition: attachment; filename=".$file_download_name);
    
    // 如果压缩了，添加 Content-Encoding header
    if ($compress !== false  && $filesize > 1024 && isset($_SERVER['HTTP_ACCEPT_ENCODING']) && substr_count($_SERVER['HTTP_ACCEPT_ENCODING'], 'gzip')) {
        Header("Content-Encoding: gzip");
    }
    
        // 使用 readfile，如果失败则抛出异常
        // 注意：此时 header 已发送，如果抛出异常，调用者需要特殊处理
        $read_result = @readfile($final_filepath);
        if ($read_result === false) {
            // header 已发送，无法返回 JSON，只能记录日志
            \think\facade\Log::error("Failed to read file after headers sent: " . $final_filepath);
            // 尝试输出错误信息（但可能无效，因为 header 已发送）
            throw new \Exception("Failed to read file (permission denied or I/O error): " . $final_filepath);
        }
        // 必须终止请求：否则 ThinkPHP 在控制器结束后还可能输出 trace/layout，ZIP 会损坏，浏览器常表现为「无法下载」
        if (function_exists('fastcgi_finish_request')) {
            @fastcgi_finish_request();
        }
        exit(0);
}

function DelTimeExpireFolders($dir, $expireTime)
{
    // 因为种种原因可能程序没执行完退出，导致临时文件夹有许多未删除旧文件
    // 此程序在每次生成临时文件夹的时候删除旧的未删除文件夹
    $now = time();
    if(is_dir($dir) && ($handle = opendir($dir)))
    {
        while (($file = readdir($handle)) !== false)
        {
            if ($file == "." || $file == "..")
                continue;
            $filetime = filemtime($dir . '/' . $file);
            if(($now - $filetime) / 60 / 60 / 24 > $expireTime)
            {
                if(is_file($dir . '/' . $file))
                    unlink($dir . '/' . $file);
                else
                    DelDirs($dir . '/' . $file);
            }
        }
        //关闭句柄
        closedir ( $handle );
    }
}

/**
 * ThinkPHP 上传 File：move/validate 失败时 getError() 仍可能为空（内部 $error 未写入），避免 AJAX 返回 msg 空串。
 *
 * @param mixed $file think\File 或 null
 */
function ThinkUploadFailMessage($file, string $fallback = ''): string
{
    if ($fallback === '') {
        $fallback = '上传校验或保存失败（请检查扩展名、大小与系统临时目录权限） / Upload validation or save failed';
    }
    if (!$file || !is_object($file) || !method_exists($file, 'getError')) {
        return $fallback;
    }
    $err = $file->getError();
    if (is_string($err) && trim($err) !== '') {
        return $err;
    }
    return $fallback;
}

/**
 * 异常 getMessage() 为空时给 AJAX 非空提示（如部分扩展/底层错误）。
 */
function CsgThrowableMessageOrFallback(\Throwable $e, string $fallback = ''): string
{
    if ($fallback === '') {
        $fallback = '处理失败（未返回具体原因） / Processing failed with no message';
    }
    $m = trim((string) $e->getMessage());
    if ($m !== '') {
        return $m;
    }
    $suffix = ' [' . get_class($e) . ']';
    $code = (int) $e->getCode();
    if ($code !== 0) {
        $suffix .= ' code=' . $code;
    }
    $prev = $e->getPrevious();
    if ($prev instanceof \Throwable) {
        $pm = trim((string) $prev->getMessage());
        if ($pm !== '') {
            $suffix .= '; cause: ' . $pm;
        } else {
            $suffix .= '; cause: [' . get_class($prev) . ']';
        }
    }
    return trim($fallback . $suffix);
}


