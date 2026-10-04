<?php
/**
 * 考试/题库共用 Trait：图片临时上传、文件名生成、搬运、清理
 *
 * 设计约定：
 * - 所有“答案图/考生答题图”先上传到 /tmp/<base>/<tmp_uuid>/... 下
 * - 只有在“保存”（提交/保存题目/保存答卷）时才把 tmp 文件搬运到最终 attach 目录
 * - 保存后按“当前提交/当前题目字段”清理不再引用的旧文件，避免目录堆积
 */
namespace app\common\traits;

trait ExamTrait
{
    /**
     * WebP 图片类型常量（PHP 7.1.0+ 支持 IMAGETYPE_WEBP，值为 18）
     */
    protected function getWebpImageType() {
        return defined('IMAGETYPE_WEBP') ? IMAGETYPE_WEBP : 18;
    }

    /**
     * 临时上传目录根：/tmp/csgoj_ex_question_tmp/<tmp_uuid>/
     * （历史原因：exadmin 题库与 examsys 考试端共用一个 tmp 根，便于复用）
     */
    protected function getAnswerImageTmpBaseDir() {
        return rtrim(sys_get_temp_dir(), '/') . '/csgoj_ex_question_tmp';
    }

    /**
     * 校验 tmp_uuid
     */
    protected function validateTmpUuid($uuid) {
        return is_string($uuid) && preg_match('/^[0-9a-fA-F-]{36}$/', $uuid);
    }

    /**
     * 安全移动单文件（rename 失败则 copy+unlink）
     */
    protected function moveFile($src, $dst) {
        if (@rename($src, $dst)) return true;
        if (@copy($src, $dst)) {
            @unlink($src);
            return true;
        }
        return false;
    }

    /**
     * 生成答案图文件名（统一规则）
     * <question_id>_<subNo>_<imgNo>_uuid_<uuidNoDash>_<YYYYMMDDHHMMSS>.webp
     */
    protected function makeAnswerImageFilename($questionId, $subNo, $imgNo) {
        $uuid = str_replace('-', '', GenerateUuidV4());
        $ts = date('YmdHis');
        return intval($questionId) . '_' . intval($subNo) . '_' . intval($imgNo) . '_uuid_' . $uuid . '_' . $ts . '.webp';
    }

    /**
     * 生成临时答案图文件名（用于未落到最终目录前的临时文件）
     * tmp_<subNo>_<imgNo>_uuid_<uuidNoDash>_<YYYYMMDDHHMMSS>.webp
     */
    protected function makeTmpAnswerImageFilename($subNo, $imgNo) {
        $uuid = str_replace('-', '', GenerateUuidV4());
        $ts = date('YmdHis');
        return 'tmp_' . intval($subNo) . '_' . intval($imgNo) . '_uuid_' . $uuid . '_' . $ts . '.webp';
    }

    /**
     * 清理“考试端考生答题图片”目录中，当前题不再引用的旧文件。
     *
     * 注意：
     * - examsys 的最终目录为：/upload/contest_attach/<attach>/exam_image/<uid>/
     * - 同一考生目录下会存多道题的图片，所以只清理 “以 <ex_question_id>_ 开头”的文件
     *
     * @param string $finalDir  文件系统目录（绝对路径）
     * @param int $ex_question_id
     * @param array $expectedFiles 期望保留的文件名集合（仅文件名，不带路径）
     */
    protected function cleanupExamQuestionFiles($finalDir, $ex_question_id, $expectedFiles) {
        if (!is_dir($finalDir)) return;
        $qidPrefix = strval(intval($ex_question_id)) . '_';
        $keep = [];
        if (is_array($expectedFiles)) {
            foreach ($expectedFiles as $f) {
                $f = trim(strval($f));
                if ($f !== '') $keep[$f] = true;
            }
        }
        $files = @scandir($finalDir);
        if (!is_array($files)) return;
        foreach ($files as $f) {
            if ($f === '.' || $f === '..') continue;
            if (strpos($f, $qidPrefix) !== 0) continue; // 只清当前题
            $full = rtrim($finalDir, '/') . '/' . $f;
            if (is_file($full) && !isset($keep[$f])) {
                @unlink($full);
            }
        }
    }

    /**
     * 删除 tmp_uuid 对应临时目录，避免 /tmp 堆积
     */
    protected function cleanupTmpUuidDir($tmp_uuid) {
        if (!$this->validateTmpUuid($tmp_uuid)) return;
        $base = $this->getAnswerImageTmpBaseDir() . '/' . $tmp_uuid;
        if (function_exists('DelWhatever')) {
            DelWhatever($base);
        } else {
            // 兜底：尽量删除
            @unlink($base);
        }
    }
}
