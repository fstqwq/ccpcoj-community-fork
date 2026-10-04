<?php
namespace app\expsys\controller;

class Index extends Expsysbase
{
    public function index()
    {
        $this->redirect('/expsys/contest');
    }
}
