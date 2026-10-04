<?php
/**
 * privilege_item 表 pvrole 角色配置
 * 所有 pvrole 值必须从此配置中获取，避免随意使用字符串
 */

return [
    // ========== 通用角色 ==========
    'admin' => 'admin',      // 管理员角色（用于 news、problem、contest 等资源的管理权限）
    
    // ========== 班级（clss）相关角色 ==========
    'clss_teacher' => 'teacher', // 班级教师
    'clss_ta' => 'ta',           // 班级助教
    'clss_student' => 'student', // 班级学生
    
    // ========== 比赛（contest）相关角色 ==========
    'contest_admin' => 'admin', // 比赛管理员（等同于 admin）
    'contest_owner' => 'owner',   // 考试负责人，可编辑考试且可增删 manage
    'contest_manage' => 'manage', // 可管理人，可编辑考试但不可修改 manage 列表
    // 与 privilege_item.pvrole NOT NULL 一致：库内存空串；查询时仍兼容历史 NULL（见 auth / addContestUsersPrivilege）
    'contest_participant' => '',
    
    // ========== 新闻（news）相关角色 ==========
    'news_admin' => 'admin',    // 新闻管理员
    
    // ========== 题目（problem）相关角色 ==========
    'problem_admin' => 'admin', // 题目管理员
    
    // ========== 辅助方法：获取角色列表 ==========
    // 获取班级相关的所有角色
    'clss_roles' => ['teacher', 'ta', 'student'],
    
    // 获取学生和助教角色（用于查询班级成员）
    'clss_member_roles' => ['student', 'ta'],
    
    // 获取所有非空角色（用于查询时排除 null）
    'non_null_roles' => ['admin', 'teacher', 'ta', 'student'],
];

