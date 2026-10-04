<?php
namespace app\examsys\controller;
use think\Controller;
class Index extends Examsysbase {
    public function index() {
    	$this->redirect('/examsys/contest');
	}
}

