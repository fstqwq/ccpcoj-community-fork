<?php

return [
    // 实际配置数据（用于文件读写）
    'config' => [
        'ALLOW_WA_INFO' => false,                    // 是否允许普通用户在练习中查看具体的失败数据点
        'ALLOW_TEST_DOWNLOAD' => false,              // 是否允许普通用户下载评测数据
        'OJ_TEST_DOWNLOAD_WAIT_TIME' => 60,         // 下载2个数据文件后暂时禁止下载数据的时间间隔（分钟）
        'PLAGIARISM_SCORE' => 0.4,                  // 代码查重后的打分折扣，0~1，例如 0.4 表示查重后仍能获得应得分的 40%
        'PLAGIARISM_MIN_LEN' => 800,                // 纳入查重的最小代码长度
        'PLAGIARISM_THRESHOLD' => 85,               // 统计分数时认定为雷同的相似度阈值；1~100
        'EXP_LEVEL_SCORE' => 4,                     // 5、24、168、720小时为分分界的题目成绩扣除；0~10
    ],
    
    // 配置定义（用于前端渲染）
    'definitions' => [
        'title' => ['cn' => '课程组配置', 'en' => 'Course Group Configuration'],
        'fields' => [
            'ALLOW_WA_INFO' => [
                'type' => 'switch',
                'label' => ['cn' => '允许查看WA详情', 'en' => 'Allow WA Info'],
                'description' => ['cn' => '是否允许普通用户在练习中查看具体的失败数据点', 'en' => 'Whether to allow regular users to view specific failed test cases in practice'],
                'category' => '评测结果',
                'category_en' => 'Judgment Result',
            ],
            'ALLOW_TEST_DOWNLOAD' => [
                'type' => 'switch',
                'label' => ['cn' => '允许下载评测数据', 'en' => 'Allow Test Download'],
                'description' => ['cn' => '是否允许普通用户下载评测数据', 'en' => 'Whether to allow regular users to download test data'],
                'category' => '评测数据',
                'category_en' => 'Test Data',
            ],
            'OJ_TEST_DOWNLOAD_WAIT_TIME' => [
                'type' => 'number',
                'label' => ['cn' => '下载等待时间', 'en' => 'Download Wait Time'],
                'description' => ['cn' => '下载2个数据文件后暂时禁止下载数据的时间间隔（分钟），数值不宜过大', 'en' => 'Time interval (minutes) to temporarily ban downloads after downloading 2 data files, value should not be too large'],
                'unit' => ['cn' => '分钟', 'en' => 'minutes'],
                'min' => 0,
                'max' => 1576800,  // 3年（分钟）
                'step' => 1,
                'category' => '评测数据',
                'category_en' => 'Test Data',
            ],
            'PLAGIARISM_SCORE' => [
                'type' => 'number',
                'label' => ['cn' => '查重扣分比例', 'en' => 'Plagiarism Score Ratio'],
                'description' => ['cn' => '代码查重后的打分折扣，0~1，例如 0.4 表示查重后仍能获得应得分的 40%', 'en' => 'Score discount after code plagiarism check, 0~1, e.g. 0.4 means 40% of the original score'],
                'min' => 0,
                'max' => 1,
                'step' => 0.01,
                'category' => '查重扣分',
                'category_en' => 'Plagiarism Deduction',
            ],
            'PLAGIARISM_MIN_LEN' => [
                'type' => 'number',
                'label' => ['cn' => '最小查重长度', 'en' => 'Min Plagiarism Length'],
                'description' => ['cn' => '纳入查重的最小代码长度', 'en' => 'Minimum code length to be included in plagiarism check'],
                'min' => 0,
                'max' => 10000,
                'step' => 10,
                'category' => '查重扣分',
                'category_en' => 'Plagiarism Deduction',
            ],
            'PLAGIARISM_THRESHOLD' => [
                'type' => 'number',
                'label' => ['cn' => '相似度阈值', 'en' => 'Similarity Threshold'],
                'description' => ['cn' => '统计分数时认定为雷同的相似度阈值；1~100', 'en' => 'Similarity threshold to identify plagiarism when calculating scores; 1~100'],
                'min' => 1,
                'max' => 100,
                'step' => 1,
                'category' => '查重扣分',
                'category_en' => 'Plagiarism Deduction',
            ],
            'EXP_LEVEL_SCORE' => [
                'type' => 'number',
                'label' => ['cn' => '分层扣分', 'en' => 'Level Deduction'],
                'description' => [
                    'cn' => '针对日常练习/实验课的分层扣分：按开始后经过 5/24/168/720 小时分层扣分；范围 0~10',
                    'en' => 'Level-based deduction for daily practice/lab courses: apply deductions by 5/24/168/720 hours after start; range 0~10'
                ],
                'min' => 0,
                'max' => 10,
                'step' => 0.1,
                'category' => '分层扣分',
                'category_en' => 'Level Deduction',
            ],
        ],
    ],
];

