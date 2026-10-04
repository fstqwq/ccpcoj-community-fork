<?php
/**
 * Course 模块基类
 * 继承自 Expbasecontroller，用于课程组管理
 */
namespace app\course\controller;
use \Expbasecontroller;

class Coursebase extends Expbasecontroller {
    public function initialize() {
        parent::initialize();
        $this->BaseAuth();
        $this->CourseInit();
    }    
    public function BaseAuth() {
        if($this->OJ_STATUS!='exp') {
            $this->redirect('/');
        }
    }
    public function CourseInit() {
    }
}