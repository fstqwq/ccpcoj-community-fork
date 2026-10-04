<?php
/**
 * Created by PhpStorm.
 * User: CSGrandeur
 * Date: 2017/3/17
 * Time: 14:01
 */
namespace app\examsys\controller;
use \Expbasecontroller;
class Examsysbase extends Expbasecontroller
{
    public function initialize()
    {
        $this->OJMode();
        $this->ExamInit();
    }
    
    /**
     * 重写：获取模块特定的 OJ_MODE/OJ_STATUS 要求
     * examsys 需要 OJ_STATUS='exp' 且 OJ_MODE='cpcsys'
     */
    protected function getModuleRequirement()
    {
        return [
            'oj_mode' => 'cpcsys',
            'oj_status' => 'exp'
        ];
    }
    
    public function ExamInit() {
    }
}

