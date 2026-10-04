<?php
/**
 * Created by PhpStorm.
 * User: CSGrandeur
 * Date: 2017/3/4
 * Time: 16:28
 */
$__ojRoot = rtrim((string) \think\facade\Env::get('root_path'), "/\\") . '/';

return [
    'PUBLIC'                => \think\facade\Env::get('OJ_STATIC', '/var/www/public/csg'), //ROOT_PATH . 'public',
    'UPLOAD'                => '/upload',                       // upload总目录
    'problem_ATTACH'        => '/upload/problem_attach',        // 题目描述的附件文件（主要是图片）
    'news_ATTACH'           => '/upload/news_attach',           // 公告、新闻的附件文件
    'contest_ATTACH'        => '/upload/contest_attach',        // 比赛描述/注意事项的附件
    'regcontest_ATTACH'     => '/upload/regcontest_attach',     // 报名系统的注意事项附件
    'ex_question_ATTACH'    => '/upload/question_attach',       // 考试题的附件
    'outrank_ATTACH'        => '/upload/outrank_attach',        // 外榜
    'course_ATTACH'         => '/upload/course_attach',         // 课程组附件
    // 非 Web 根路径；题目题面 PDF 存 {testdata}/{problem_id}/pdf_desc/，仅 PHP 接口可读
    'testdata'              => '/home/judge/data',              //**判题数据管理路径，此项与以上处理方式不同。
    'judger_config'         => '/upload/judger_config.json',    // 评测机配置文件

    'export_problem_temp'   => $__ojRoot . 'PROBLEM_EXPORT/FILE_TEMP',
    'export_problem'        => $__ojRoot . 'PROBLEM_EXPORT/EXPORT',
    'summary_contest_temp'  => $__ojRoot . 'CONTEST_SUMMARY/FILE_TEMP',
    'summary_contest'       => $__ojRoot . 'CONTEST_SUMMARY/SUMMARY',
    'export_keep_time'      => 30,
    'import_problem_temp'   => $__ojRoot . 'PROBLEM_EXPORT/IMPORT_TEMP',
    'export_contest_temp'   => $__ojRoot . 'CONTEST_EXPORT/FILE_TEMP',
    'export_contest'        => $__ojRoot . 'CONTEST_EXPORT/EXPORT',
    'import_contest_temp'   => $__ojRoot . 'CONTEST_EXPORT/IMPORT_TEMP',
    'chunk_file_temp'       => $__ojRoot . 'CHUNK_TEMP',
    'cpc_client_record'     => $__ojRoot . 'CPC_CLIENT_RECORD',

    'export_temp_keep_time'    => 2,    //因为一些程序错误未删除的临时文件夹，设置2天。（文件时间有可能是12小时制的问题，时间不对，避免出问题设置大于1天）
];