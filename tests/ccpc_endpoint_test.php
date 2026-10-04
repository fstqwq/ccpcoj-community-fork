<?php
// Exercise the actual action trait without starting ThinkPHP or an external database.
spl_autoload_register(function($class) {
    if (strpos($class, 'app\\') === 0) require __DIR__.'/../ojweb/application/'.str_replace('\\','/',substr($class,4)).'.php';
});
date_default_timezone_set('UTC');
function input($key,$default=null) {global $query;return $query[explode('/',$key)[0]] ?? $default;}
class Reply extends Exception {public $payload;function __construct($p){$this->payload=$p;}}
class Harness {
    use app\common\traits\ContestActionTrait;
    public $module='cpcsys';public $contest;public $contest_user='T_0';public $staff=false;public $preview=false;public $data;
    function GetContestMeta($cid,$refresh){return ['contest'=>$this->data['contest']];}
    function GetVars(){}
    function GetContestData4Rank($params){return $this->data;}
    function IsContestAdmin(){return $this->staff;}
    function flgRankNotAdminRequest(){return $this->preview;}
    function SolutionUser($id,$prefix=false){return $prefix?'#cpc1_'.$id:app\common\funcs\CcpcRules::teamId($id,1);}
    function success($msg,$url,$data){throw new Reply($data);}
    function error($msg){throw new Exception($msg);}
    function filters($m){$this->applyStatusAjaxContestFilter($m);return $m;}
    function single($s){return $this->canSeeSingleStatusAjax($s);}
}
$checks=0;function check($v,$name){global $checks;$checks++;if(!$v)throw new Exception($name);}
function callEndpoint($h){try{$h->contest_data_ajax();}catch(Reply $r){return $r->payload;}throw new Exception('Missing response');}
$query=['cid'=>1,'min_solution_id'=>999,'solution_result'=>4,'info_need'=>['solution']];
putenv('CCPC_HMAC_KEY='.str_repeat('k',32));
$now=time();$h=new Harness();$h->data=['contest'=>['contest_id'=>1,'contest_rank_kind'=>'ccpc','start_time'=>gmdate('Y-m-d H:i:s',$now-100),'end_time'=>gmdate('Y-m-d H:i:s',$now+18000),'password'=>'private','frozen_after'=>30],'problem'=>[[100,'SECRET',0,'red',0]],'team'=>[],'solution'=>[[1,1,100,'#cpc1_T_0',4,gmdate('Y-m-d H:i:s',$now-50)],[2,1,100,'#cpc1_T_0',6,gmdate('Y-m-d H:i:s',$now-40)]]];
foreach(range(0,9)as$i)$h->data['team'][]=[1,'T_'.$i,'Team','','','','School','',0,'','',null,[],0];
$h->contest=$h->data['contest'];
$p=callEndpoint($h);check(count($p['ccpc_rows'])===10,'complete public rows');check($p['solution']===[],'raw rows removed');check($p['problem']===[],'mapping absent');check(!isset($p['contest']['password']),'sensitive field absent');
$h->staff=true;$p=callEndpoint($h);check($p['ccpc_meta']['view']==='referee','referee branch');check(count($p['solution'])===1,'staff duplicate removal');check(!isset($p['contest']['password']),'referee sensitive field stripped');
$h->preview=true;$p=callEndpoint($h);check($p['solution']===[],'staff public preview obeys concealment');
$h->staff=false;$m=$h->filters(['user_id'=>'#cpc1_other']);check($m['user_id']==='#cpc1_T_0','override other-team filter');check(!$h->single(['contest_id'=>1,'user_id'=>'#cpc1_other']),'deny other-team status');check($h->single(['contest_id'=>1,'user_id'=>'#cpc1_T_0']),'own status allowed');
$h->data['contest']['contest_rank_kind']='icpc';$p=callEndpoint($h);check(count($p['solution'])===2,'legacy API data preserved');check(!isset($p['ccpc_rows']),'legacy no projection');
echo "PASS $checks production endpoint/auth assertions (database boundary stubbed)\n";
