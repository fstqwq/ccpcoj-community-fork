<?php
/**
 * 评测数据文件（.in/.out）读取与元信息 Trait
 * - 提供给 Status 控制器与 ContestActionTrait 复用
 *
 * 约定：
 * - 本 Trait 只做“文件路径/读取/元信息”层面的工作
 * - 权限校验、solution 查表等由调用方负责
 */
namespace app\common\traits;

trait TestdataFileTrait
{
    /**
     * 校验 case 名称是否安全（仅允许字母数字、下划线、横杠、点）
     */
    protected function isValidTestdataCaseName($case)
    {
        return is_string($case) && preg_match('/^[A-Za-z0-9_\\-\\.]+$/', $case);
    }

    /**
     * 获取评测数据根目录（OjPath.testdata）
     */
    protected function getTestdataRootDir()
    {
        $ojPath = config('OjPath.');
        $testdata_dir = isset($ojPath['testdata']) ? $ojPath['testdata'] : '';
        return rtrim($testdata_dir, '/');
    }

    /**
     * 生成 {problem_id}/{case}.{kind} 的完整路径
     */
    protected function buildTestdataFilePath($problem_id, $case, $kind)
    {
        $dir = $this->getTestdataRootDir();
        return $dir . '/' . intval($problem_id) . '/' . $case . '.' . $kind;
    }

    /**
     * 读取单个评测数据文件（截断）+ 元信息
     *
     * 返回结构：
     * - ok: 1/0
     * - reason: file_not_found/read_failed/invalid_case_name/invalid_kind
     * - case, kind, max_bytes
     * - size, mtime, truncated, sha256, content
     */
    protected function readTestdataFileWithMeta($problem_id, $case, $kind, $max_bytes = 1024)
    {
        $case = is_string($case) ? trim($case) : '';
        $kind = is_string($kind) ? strtolower(trim($kind)) : '';
        $max_bytes = intval($max_bytes);
        if ($max_bytes <= 0) $max_bytes = 1024;

        if (!$this->isValidTestdataCaseName($case)) {
            return ['ok' => 0, 'reason' => 'invalid_case_name', 'case' => $case, 'kind' => $kind, 'max_bytes' => $max_bytes];
        }
        if (!in_array($kind, ['in', 'out'])) {
            return ['ok' => 0, 'reason' => 'invalid_kind', 'case' => $case, 'kind' => $kind, 'max_bytes' => $max_bytes];
        }

        $file_path = $this->buildTestdataFilePath($problem_id, $case, $kind);
        if (!file_exists($file_path) || !is_readable($file_path)) {
            return ['ok' => 0, 'reason' => 'file_not_found', 'case' => $case, 'kind' => $kind, 'max_bytes' => $max_bytes];
        }

        $size = @filesize($file_path);
        $mtime = @filemtime($file_path);
        $content = @file_get_contents($file_path, false, null, 0, $max_bytes);
        if ($content === false) {
            return ['ok' => 0, 'reason' => 'read_failed', 'case' => $case, 'kind' => $kind, 'max_bytes' => $max_bytes];
        }

        $sha256 = null;
        try {
            $sha256 = hash_file('sha256', $file_path);
        } catch (\Exception $e) {
            $sha256 = null;
        }

        return [
            'ok' => 1,
            'case' => $case,
            'kind' => $kind,
            'max_bytes' => $max_bytes,
            'size' => intval($size),
            'mtime' => intval($mtime),
            'truncated' => (intval($size) > $max_bytes) ? 1 : 0,
            'sha256' => $sha256,
            'content' => $content
        ];
    }

    /**
     * 批量读取多个 case 的 in/out 尺寸（字节），不读取内容
     *
     * 返回：
     * - ok: 1
     * - problem_id
     * - sizes: [case => ['in' => int|null, 'out' => int|null]]
     */
    protected function readTestdataSizesForCases($problem_id, $cases)
    {
        $ret = [];
        if (!is_array($cases)) $cases = [];

        foreach ($cases as $case) {
            $case = is_string($case) ? trim($case) : '';
            if ($case === '' || !$this->isValidTestdataCaseName($case)) continue;

            $in_path = $this->buildTestdataFilePath($problem_id, $case, 'in');
            $out_path = $this->buildTestdataFilePath($problem_id, $case, 'out');
            $in_size = (file_exists($in_path) && is_readable($in_path)) ? intval(@filesize($in_path)) : null;
            $out_size = (file_exists($out_path) && is_readable($out_path)) ? intval(@filesize($out_path)) : null;

            $ret[$case] = [
                'in' => $in_size,
                'out' => $out_size
            ];
        }

        return [
            'ok' => 1,
            'problem_id' => intval($problem_id),
            'sizes' => $ret
        ];
    }
}


