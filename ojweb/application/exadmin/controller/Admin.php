<?php
namespace app\exadmin\controller;

/**
 * exadmin 统一管理后台入口
 * 根据 OJ_MODE 和 OJ_STATUS 重定向到不同的管理模块
 */
class Admin extends Exadminbase
{
    public function BaseAuth() {
        // OJ_STATUS/OJ_MODE 检查已由统一的路由守卫系统处理（在 Exadminbase 中）
        // 这里只检查业务权限
        if(!IsAdmin('problem_editor') && !IsAdmin('contest_editor') && !PrivCourse('teacher', $this->NOW_COURSE_KEY)) {
            $this->error('无管理权限', '/');
        }
    }
    
    public function index() {
        // 根据 OJ_MODE 和 OJ_STATUS 重定向到不同的列表页
        if($this->OJ_MODE == 'online' && $this->OJ_STATUS == 'exp') {
            // 练习模式：重定向到练习列表
            $this->redirect('/exadmin/contest/contest_list');
        } else if($this->OJ_MODE == 'cpcsys' && $this->OJ_STATUS == 'exp') {
            // 考试模式：重定向到考试列表（默认模块）
            $this->redirect('/exadmin/exam/contest_list');
        } else {
            $this->redirect('/');
        }
    }
}
