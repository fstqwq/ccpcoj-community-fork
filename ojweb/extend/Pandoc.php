<?php
/**
 * Pandoc PHP
 *
 * Copyright (c) Ryan Kadwell <ryan@riaka.ca>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

//namespace Pandoc;

/**
 * Naive wrapper for haskell's pandoc utility
 *
 * @author Ryan Kadwell <ryan@riaka.ca>
 */
class Pandoc
{
    /**
     * Where is the executable located
     * @var string
     */
    private $executable;

    /**
     * Where to take the content for pandoc from
     * @var string
     */
    private $tmpFile;

    /**
     * Directory to store temporary files
     * @var string
     */
    private $tmpDir;

    /**
     * List of valid input types
     * @var array
     */
    private $inputFormats = array(
        "native",
        "json",
        "markdown",
        "markdown_strict",
        "markdown_phpextra",
        "markdown_github",
        "markdown_mmd",
        "rst",
        "mediawiki",
        "docbook",
        "textile",
        "html",
        "latex"
    );

    /**
     * List of valid output types
     * @var array
     */
    private $outputFormats = array(
        "native",
        "json",
        "docx",
        "odt",
        "epub",
        "epub3",
        "fb2",
        "html",
        "html5",
        "s5",
        "slidy",
        "slideous",
        "dzslides",
        "docbook",
        "opendocument",
        "latex",
        "beamer",
        "context",
        "texinfo",
        "man",
        "markdown",
        "markdown_strict",
        "markdown_phpextra",
        "markdown_github",
        "markdown_mmd",
        "plain",
        "rst",
        "mediawiki",
        "textile",
        "rtf",
        "org",
        "asciidoc"
    );

    /**
     * Setup path to the pandoc binary
     *
     * @param string $executable Path to the pandoc executable
     * @param string $tmpDir     Path to where we want to store temporary files
     */
    public function __construct($executable = null, $tmpDir = null)
    {
        if ( ! $tmpDir) {
            $tmpDir = sys_get_temp_dir();
        }

        if ( ! file_exists($tmpDir)) {
            throw new PandocException(
                sprintf('The directory %s does not exist!', $tmpDir)
            );
        }

        if ( ! is_writable($tmpDir)) {
            throw new PandocException(
                sprintf('Unable to write to the directory %s!', $tmpDir)
            );
        }

        $this->tmpDir = $tmpDir;

        $this->tmpFile = sprintf("%s/%s", $this->tmpDir, uniqid("pandoc"));

        // Since we can not validate that the command that they give us is
        // *really* pandoc we will just check that its something.
        // If the provide no path to pandoc we will try to find it on our own
        if ( ! $executable) {
            // 尝试多种方式查找 pandoc
            $pandocPath = null;
            
            // 方法1: 使用 which (如果 exec 可用)
            if (function_exists('exec')) {
                $output = [];
                $returnVar = 0;
                exec('which pandoc', $output, $returnVar);
                if ($returnVar === 0 && !empty($output)) {
                    $pandocPath = $output[0];
                }
            }
            
            // 方法2: 使用 shell_exec (如果 exec 不可用)
            if (!$pandocPath && function_exists('shell_exec')) {
                $result = shell_exec('which pandoc 2>&1');
                if ($result && trim($result)) {
                    $pandocPath = trim($result);
                }
            }
            
            // 方法3: 使用 proc_open (如果前两种都不可用)
            if (!$pandocPath && function_exists('proc_open')) {
                try {
                    $descriptorspec = array(
                        0 => array("pipe", "r"),
                        1 => array("pipe", "w"),
                        2 => array("pipe", "w")
                    );
                    $process = @proc_open('which pandoc', $descriptorspec, $pipes);
                    if (is_resource($process)) {
                        if (isset($pipes[0])) fclose($pipes[0]);
                        $result = '';
                        if (isset($pipes[1])) {
                            $result = stream_get_contents($pipes[1]);
                            fclose($pipes[1]);
                        }
                        if (isset($pipes[2])) {
                            fclose($pipes[2]);
                        }
                        proc_close($process);
                        if ($result && trim($result)) {
                            $pandocPath = trim($result);
                        }
                    }
                } catch (\Exception $e) {
                    // 忽略错误，继续尝试其他方法
                }
            }
            
            // 方法4: 如果所有方法都失败，尝试使用默认路径
            if (!$pandocPath) {
                $defaultPaths = ['/usr/local/bin/pandoc', '/usr/bin/pandoc', '/bin/pandoc'];
                foreach ($defaultPaths as $path) {
                    if (file_exists($path) && is_executable($path)) {
                        $pandocPath = $path;
                        break;
                    }
                }
            }
            
            if ($pandocPath) {
                $this->executable = $pandocPath;
            } else {
                throw new PandocException('Unable to locate pandoc. exec(), shell_exec(), and proc_open() may be disabled.');
            }
        } else {
            $this->executable = $executable;
        }

        if ( ! is_executable($this->executable)) {
            throw new PandocException('Pandoc executable is not executable');
        }
    }

    /**
     * Run the conversion from one type to another
     *
     * @param string $from The type we are converting from
     * @param string $to   The type we want to convert the document to
     * @param bool $highlight Whether to enable syntax highlighting
     * @param int $toc Table of contents depth (0 to disable)
     * @param string|null $title Document title
     * @param string $mathEngine Math engine to use: 'mathjax' or 'katex' (default: 'katex')
     *
     * @return string
     */
    public function convert($content, $from, $to, $highlight=false, $toc=0, $title=null, $mathEngine='katex')
    {
        if ( ! in_array($from, $this->inputFormats)) {
            throw new PandocException(
                sprintf('%s is not a valid input format for pandoc', $from)
            );
        }

        if ( ! in_array($to, $this->outputFormats)) {
            throw new PandocException(
                sprintf('%s is not a valid output format for pandoc', $to)
            );
        }

        // Validate math engine
        if (!in_array($mathEngine, ['mathjax', 'katex'])) {
            throw new PandocException(
                sprintf('%s is not a valid math engine. Use "mathjax" or "katex"', $mathEngine)
            );
        }

        file_put_contents($this->tmpFile, $content);

        // Build math engine parameter
        $mathParam = $mathEngine === 'katex' ? '--katex' : '--mathjax';

        $command = sprintf(
            '%s --from=%s --to=%s %s %s',
            $this->executable,
            $from,
            $to,
            $mathParam,
            $this->tmpFile
        );
        $standalone = false;
        if($highlight) {
            $command .= " -s --highlight-style=pygments";
            $standalone = true;
        }
        if($toc) {
            if(!$standalone) {
                $command .= " -s";
                $standalone = true;
            }
            $command .= " --toc --toc-depth=" . $toc;
        }
        if($title) {
            if(!$standalone) {
                $command .= " -s";
                $standalone = true;
            }
            $command .= " --metadata title=" . escapeshellarg($title);
        }
        
        // 执行命令并检查返回码
        // 优先使用 proc_open（如果 exec 被禁用）
        if (function_exists('proc_open')) {
            return $this->executeWithProcOpen($command, $content);
        } elseif (function_exists('exec')) {
            return $this->executeWithExec($command, $content);
        } elseif (function_exists('shell_exec')) {
            return $this->executeWithShellExec($command, $content);
        } else {
            throw new PandocException('No available method to execute pandoc command. exec(), proc_open(), and shell_exec() are all disabled.');
        }
    }
    
    /**
     * 使用 proc_open 执行命令
     */
    private function executeWithProcOpen($command, $content) {
        $descriptorspec = array(
            0 => array("pipe", "r"),
            1 => array("pipe", "w"),
            2 => array("pipe", "w")
        );
        
        $process = @proc_open($command, $descriptorspec, $pipes);
        
        if (!is_resource($process)) {
            throw new PandocException("Failed to open process for command: $command");
        }
        
        // 关闭 stdin
        if (isset($pipes[0])) {
            fclose($pipes[0]);
        }
        
        // 读取 stdout 和 stderr（阻塞模式，等待进程完成）
        $output = isset($pipes[1]) ? stream_get_contents($pipes[1]) : '';
        $error = isset($pipes[2]) ? stream_get_contents($pipes[2]) : '';
        
        // 关闭管道
        if (isset($pipes[1])) fclose($pipes[1]);
        if (isset($pipes[2])) fclose($pipes[2]);
        
        // 获取退出码
        $returnVar = proc_close($process);
        
        // 如果 stderr 包含 HTML（Pandoc 可能将输出写到 stderr），使用它作为输出
        if (empty($output) && !empty($error) && (strpos($error, '<p>') !== false || strpos($error, '<span') !== false)) {
            $output = $error;
            $error = '';
        }
        
        // 如果输出为空但输入不为空，抛出异常
        if (empty($output) && !empty($content)) {
            throw new PandocException(
                sprintf('Pandoc returned empty output. Command: %s. Input length: %d. Error: %s', $command, strlen($content), $error)
            );
        }
        
        // 如果有真正的错误（不是 HTML 输出），抛出异常
        if (!empty($error) && strpos($error, '<p>') === false && strpos($error, '<span') === false) {
            throw new PandocException(
                sprintf('Pandoc conversion failed. Command: %s. Error: %s', $command, $error)
            );
        }
        
        return $output;
    }
    
    /**
     * 使用 exec 执行命令
     */
    private function executeWithExec($command, $content) {
        $output = [];
        $returnVar = 0;
        $lastLine = exec($command, $output, $returnVar);
        
        // 如果 exec 返回最后一行，但 $output 为空，尝试使用 $lastLine
        if (empty($output) && !empty($lastLine)) {
            $output = [$lastLine];
        }
        
        // 检查执行是否成功
        if ($returnVar !== 0) {
            $errorMsg = is_array($output) && !empty($output) ? implode("\n", $output) : 'No error output';
            // 尝试获取 stderr 输出
            $commandWithStderr = $command . ' 2>&1';
            exec($commandWithStderr, $outputWithStderr, $returnVarStderr);
            if (!empty($outputWithStderr)) {
                $errorMsg = implode("\n", $outputWithStderr);
            }
            throw new PandocException(
                sprintf('Pandoc conversion failed with exit code %d. Command: %s. Error: %s', $returnVar, $command, $errorMsg)
            );
        }
        
        // 检查输出是否为空
        $result = is_array($output) && !empty($output) ? implode("\n", $output) : '';
        if (empty($result) && !empty($content)) {
            // 如果输出为空但输入不为空，尝试重新执行并捕获 stderr
            $commandWithStderr = $command . ' 2>&1';
            exec($commandWithStderr, $outputWithStderr, $returnVarStderr);
            if ($returnVarStderr !== 0) {
                $errorMsg = is_array($outputWithStderr) && !empty($outputWithStderr) ? implode("\n", $outputWithStderr) : 'No error output';
                throw new PandocException(
                    sprintf('Pandoc returned empty output with exit code %d. Command: %s. Error: %s', $returnVarStderr, $command, $errorMsg)
                );
            }
            // 如果重新执行成功，使用新的输出
            if (!empty($outputWithStderr)) {
                $result = implode("\n", $outputWithStderr);
            } else {
                throw new PandocException(
                    sprintf('Pandoc returned empty output. Command: %s. Input length: %d', $command, strlen($content))
                );
            }
        }

        return $result;
    }
    
    /**
     * 使用 shell_exec 执行命令
     */
    private function executeWithShellExec($command, $content) {
        $commandWithStderr = $command . ' 2>&1';
        $output = shell_exec($commandWithStderr);
        
        // shell_exec 在失败时返回 null
        if ($output === null) {
            throw new PandocException(
                sprintf('Pandoc command execution failed. Command: %s', $command)
            );
        }
        
        if (empty($output) && !empty($content)) {
            throw new PandocException(
                sprintf('Pandoc returned empty output. Command: %s. Input length: %d', $command, strlen($content))
            );
        }
        
        return $output;
    }

    /**
     * Run the pandoc command with specific options.
     *
     * Provides more control over what happens. You simply pass an array of
     * key value pairs of the command options omitting the -- from the start.
     * If you want to pass a command that takes no argument you set its value
     * to null.
     *
     * @param string $content The content to run the command on
     * @param array  $options The options to use
     *
     * @return string The returned content
     */
    public function runWith($content, $options)
    {
        $commandOptions = array();

        $extFilesFormat = array(
            'docx',
            'odt',
            'epub',
            'fb2',
            'pdf'
        );

        $extFilesHtmlSlide = array(
            's5',
            'slidy',
            'dzslides',
            'slideous'
        );

        foreach ($options as $key => $value) {
            if ($key == 'to' && in_array($value, $extFilesFormat)) {
                $commandOptions[] = '-s -S -o '.$this->tmpFile.'.'.$value;
                $format = $value;
                continue;
            } else if ($key == 'to' && in_array($value, $extFilesHtmlSlide)) {
                $commandOptions[] = '-s -t '.$value.' -o '.$this->tmpFile.'.html';
                $format = 'html';
                continue;
            } else if ($key == 'to' && $value == 'epub3') {
                $commandOptions[] = '-S -o '.$this->tmpFile.'.epub';
                $format = 'epub';
                continue;
            } else if ($key == 'to' && $value == 'beamer') {
                $commandOptions[] = '-s -t beamer -o '.$this->tmpFile.'.pdf';
                $format = 'pdf';
                continue;
            } else if ($key == 'to' && $value == 'latex') {
                $commandOptions[] = '-s -o '.$this->tmpFile.'.tex';
                $format = 'tex';
                continue;
            } else if ($key == 'to' && $value == 'rst') {
                $commandOptions[] = '-s -t rst --toc -o '.$this->tmpFile.'.text';
                $format = 'text';
                continue;
            } else if ($key == 'to' && $value == 'rtf') {
                $commandOptions[] = '-s -o '.$this->tmpFile.'.'.$value;
                $format = $value;
                continue;
            } else if ($key == 'to' && $value == 'docbook') {
                $commandOptions[] = '-s -S -t docbook -o '.$this->tmpFile.'.db';
                $format = 'db';
                continue;
            } else if ($key == 'to' && $value == 'context') {
                $commandOptions[] = '-s -t context -o '.$this->tmpFile.'.tex';
                $format = 'tex';
                continue;
            } else if ($key == 'to' && $value == 'asciidoc') {
                $commandOptions[] = '-s -S -t asciidoc -o '.$this->tmpFile.'.txt';
                $format = 'txt';
                continue;
            }


            if (null === $value) {
                $commandOptions[] = "--$key";
                continue;
            }

            $commandOptions[] = "--$key=$value";
        }

        file_put_contents($this->tmpFile, $content);
        chmod($this->tmpFile, 0777);

        $command = sprintf(
            "%s %s %s",
            $this->executable,
            implode(' ', $commandOptions),
            $this->tmpFile
        );


        $output = [];
        $returnval = 0;
        exec($command, $output, $returnval);
        if($returnval === 0)
        {
            if (isset($format)) {
                return file_get_contents($this->tmpFile.'.'.$format);
            } else {
                return is_array($output) && !empty($output) ? implode("\n", $output) : '';
            }
        }else
        {
            $errorMsg = is_array($output) && !empty($output) ? implode("\n", $output) : 'No error output';
            throw new PandocException(
                sprintf('Pandoc could not convert successfully, error code: %s. Tried to run the following command: %s. Error: %s', $returnval, $command, $errorMsg)
            );
        }
    }

    /**
     * Remove the temporary files that were created
     */
    public function __destruct()
    {
        if (file_exists($this->tmpFile)) {
            @unlink($this->tmpFile);
        }

        foreach (glob($this->tmpFile.'*') as $filename) {
            @unlink($filename);
        }
    }

    /**
     * Returns the pandoc version number
     *
     * @return string
     */
    public function getVersion()
    {
        $output = [];
        exec(sprintf('%s --version', $this->executable), $output);

        return is_array($output) && !empty($output) ? trim(str_replace('pandoc', '', $output[0])) : '';
    }

    /**
     * Return that path where we are storing temporary files
     * @return string
     */
    public function getTmpDir()
    {
        return $this->tmpDir;
    }
}