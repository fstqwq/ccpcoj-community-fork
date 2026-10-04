<?php
/**
 * Created by PhpStorm.
 * User: CSGrandeur
 * Date: 2017/3/17
 * Time: 12:50
 */
//OJ模式
return [
    'OJ_MODE_ALLOW_MODULE' => [
        'online'    => [
            'cpc' => ['index', 'admin', 'cr', 'csgoj', 'cpcsys', 'user', 'tt', 'ojtool', 'outrank'],
            'exp' => ['exindex', 'admin', 'user', 'expsys', 'course', 'ojtool', 'csgoj'],
        ],
        'cpcsys'    => [
            'cpc' => ['cpcsys', 'admin', 'user', 'ojtool', 'outrank'],
            'exp' => ['exindex', 'examsys', 'expsys', 'admin', 'user', 'course', 'ojtool', 'csgoj'],
        ]
    ],
    
    /**
     * 模块访问权限配置
     * 定义不同 OJ_MODE 和 OJ_STATUS 组合下，不同用户类型可以访问的模块
     * 
     * 用户类型说明：
     * - 'administrator': 大管理员（IsAdmin('administrator') 返回 true）
     * - 'admin': 小管理员（有任意管理员权限但不是大管理员）
     * - 'teacher': 课程教师（PrivCourse('teacher') 或 checkIsAnyCourseTeacher() 返回 true）
     * - 'logged_in': 普通登录用户（已登录但不是管理员也不是教师）
     * - 'guest': 未登录用户
     * 
     * 注意：权限是向下兼容的，即 administrator 可以访问所有模块（不受此配置限制）
     */
    'MODULE_ACCESS_PERMISSION' => [
        'online' => [
            'cpc' => [
                'super_admin' => ['index', 'admin', 'cr', 'csgoj', 'cpcsys', 'user', 'tt', 'ojtool', 'outrank'],
                'administrator' => ['index', 'admin', 'cr', 'csgoj', 'cpcsys', 'user', 'tt', 'ojtool', 'outrank'],
                'admin' => ['index', 'admin', 'cr', 'csgoj', 'cpcsys', 'user', 'tt', 'ojtool', 'outrank'],
                'teacher' => ['index', 'csgoj', 'cpcsys', 'user', 'outrank'],
                'logged_in' => ['index', 'csgoj', 'cpcsys', 'user', 'outrank'],
                'guest' => ['index', 'csgoj', 'cpcsys', 'user', 'outrank'],
            ],
            'exp' => [
                'super_admin' => ['exindex', 'exadmin', 'user', 'expsys', 'course', 'ojtool', 'csgoj'],
                'administrator' => ['exindex', 'exadmin', 'user', 'expsys', 'course', 'ojtool', 'csgoj'],
                'admin' => ['exindex', 'exadmin', 'user', 'expsys', 'course', 'ojtool', 'csgoj'],
                'course_super' => ['exindex', 'exadmin', 'user', 'expsys', 'course', 'ojtool', 'csgoj'],
                'course_admin' => ['exindex', 'exadmin', 'user', 'expsys', 'course', 'ojtool', 'csgoj'],
                'course_teacher' => ['exindex', 'exadmin', 'user', 'expsys', 'course', 'csgoj'],
                'teacher' => ['exindex', 'user', 'expsys', 'course', 'csgoj'],
                'logged_in' => ['exindex', 'user', 'expsys', 'course', 'csgoj'],
                'guest' => ['exindex', 'course', 'csgoj'],
            ],
        ],
        'cpcsys' => [
            'cpc' => [
                'super_admin' => ['cpcsys', 'admin', 'user', 'ojtool', 'outrank'],
                'administrator' => ['cpcsys', 'admin', 'user', 'ojtool', 'outrank'],
                'admin' => ['cpcsys', 'admin', 'user', 'ojtool', 'outrank'],
                'teacher' => ['cpcsys', 'user'],
                'logged_in' => ['cpcsys', 'user'],
                'guest' => ['cpcsys', 'user'],
            ],
            'exp' => [
                // super_admin 和 administrator：可以访问所有常规模块和管理后台
                'super_admin' => ['exindex', 'examsys', 'expsys', 'exadmin', 'user', 'course', 'ojtool', 'csgoj'],
                'administrator' => ['exindex', 'examsys', 'expsys', 'exadmin', 'user', 'course', 'ojtool', 'csgoj'],
                'admin' => ['exindex', 'examsys', 'expsys', 'exadmin', 'user', 'course', 'ojtool', 'csgoj'],
                // course_super 和 course_admin：可以访问常规模块和管理后台
                'course_super' => ['exindex', 'examsys', 'expsys', 'exadmin', 'user', 'course', 'ojtool', 'csgoj'],
                'course_admin' => ['exindex', 'examsys', 'expsys', 'exadmin', 'user', 'course', 'ojtool', 'csgoj'],
                // course_teacher：可以访问常规模块和管理后台
                'course_teacher' => ['exindex', 'examsys', 'expsys', 'exadmin', 'user', 'course', 'csgoj'],
                'teacher' => ['exindex', 'examsys', 'expsys', 'user', 'course', 'csgoj'],
                // cpcsys-exp 模式下，普通用户和未登录用户只能访问 examsys、course 和 csgoj（仅限 faqs controller）
                'logged_in' => [
                    'examsys' => true,  // 可以访问所有 controller
                    'course' => true,   // 可以访问课程选择页面
                    'csgoj' => ['faqs'],  // 只能访问 faqs controller
                ],
                'guest' => [
                    'examsys' => true,  // 可以访问所有 controller
                    'course' => true,   // 可以访问课程选择页面
                    'csgoj' => ['faqs'],  // 只能访问 faqs controller
                ],
            ],
        ],
    ],
];