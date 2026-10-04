<?php
require __DIR__.'/../ojweb/application/common/funcs/CcpcRules.php';
use app\common\funcs\CcpcRules as R;
date_default_timezone_set('UTC');
$checks = 0;
function same($a, $b, $name) { global $checks; $checks++; if ($a !== $b) throw new Exception($name . ': '.json_encode([$a,$b])); }
function expectError($fn, $name) { try {$fn();} catch (Throwable $e) {same(true,true,$name); return;} throw new Exception($name); }
function fixture($n=10) {
    $d = ['contest'=>['contest_id'=>1,'contest_rank_kind'=>'ccpc','start_time'=>'2026-10-04 08:00:00','end_time'=>'2026-10-04 13:00:00','frozen_after'=>30,'password'=>'PRIVATE_PASSWORD'], 'problem'=>[], 'team'=>[], 'solution'=>[], 'time_context'=>['timezone'=>'UTC']];
    foreach (range(0,4) as $i) $d['problem'][]=[100+$i,'SECRET_TITLE_'.$i,$i,'#ff0000',0];
    for ($i=0;$i<$n;$i++) $d['team'][]=[1,'T_'.$i,'Team '.$i,'','','','School','',0,'','',null,[],0];
    return $d;
}
function sol($id,$pid,$tid,$result,$delta) {return [$id,1,$pid,'#cpc1_'.$tid,$result,gmdate('Y-m-d H:i:s',strtotime('2026-10-04 08:00:00')+$delta)];}
function project($d,$elapsed=7200) {return R::project($d,strtotime('2026-10-04 08:00:00')+$elapsed,str_repeat('k',32));}
function row($d,$idx=0) {return $d['ccpc_rows'][$idx];}
foreach ([[0,1],[4,1],[10,2],[249,49],[250,50],[1000,50]] as $v) same(R::threshold($v[0]),$v[1],'threshold');
same(R::threshold(1000,'ratio_20'),200,'ratio policy');same(R::threshold(10,'fixed_50'),50,'fixed policy');
same(R::letter(26),'AA','Excel letters');same(R::teamId('#cpc1_T_with_under',1),'T_with_under','team underscores');
expectError(function(){R::threshold(2,'bad');},'invalid policy');
expectError(function(){R::project(fixture(),0,'short');},'short key');
$d=fixture();$p=project($d,0);same(count($p['problem']),0,'initial hidden');same(count(row($p)['problemOrder']),5,'unsubmitted placeholders');same(row($p)['solved'],0,'empty team included');
same(strpos(json_encode($p),'SECRET_TITLE_')===false,true,'no problem titles');same(isset($p['contest']['password']),false,'no password');
$d['solution']=[sol(1,102,'T_0',6,50),sol(2,101,'T_0',4,200),sol(3,100,'T_0',4,100),sol(4,102,'T_0',6,250),sol(5,103,'T_0',6,300),sol(6,100,'T_0',6,999)];
$p=project($d);$r=row($p);$stats=array_values($r['problemStats']);same(array_column($stats,'status'),['ac','ac','wa','wa','none'],'independent group order');same(array_column($stats,'lastSubmitTime'),['00:01:40','00:03:20','00:04:10','00:05:00',''],'sort by AC then latest submission');same($r['solved'],2,'solved');same($r['penalty'],300,'no post AC penalty');same($stats[0]['submitCount'],1,'post AC count');
same(count(array_unique(array_merge($r['problemOrder'],row($p,1)['problemOrder']))),10,'team-specific opaque keys');
$d['solution'][]=sol(7,100,'T_1',4,500);$p=project($d);same(count($p['problem']),1,'reveal equality');same(row($p)['problemOrder'][0],'100','revealed first');same(row($p)['problemStats'][100]['problemAlphabetIdx'],'A','correct label');same($p['solution'],[],'no raw public solutions');same($p['contest_balloon'],[],'no public balloons');
$d=fixture();$d['solution']=[sol(1,100,'T_0',6,100),sol(2,100,'T_0',4,14400),sol(3,100,'T_0',6,14500),sol(4,100,'T_0',4,14600)];
$p=project($d,14400);same(count($p['problem']),5,'freeze reveals all');same(row($p)['solved'],0,'exact freeze AC masked');same(row($p)['problemStats'][100]['status'],'pending','frozen pending');
$p=project($d,16000);same(row($p)['problemStats'][100]['submitCount'],2,'frozen post AC ignored');same(row($p)['penalty'],0,'frozen penalty hidden');
$p=project($d,19800);same(row($p)['solved'],1,'exact unfreeze');same(row($p)['penalty'],15600,'penalty wrong plus time');same(count($p['problem']),5,'labels remain after end');
$d['solution'][1][4]=6;$p=project($d,19800);same(row($p)['problemStats'][100]['submitCount'],4,'rejudge replay');same(row($p)['penalty'],18200,'rejudge penalty');
$d=fixture();$d['solution']=[sol(1,100,'T_0',4,-1),sol(2,101,'T_0',4,18000),sol(3,102,'T_0',4,9000),sol(4,103,'T_0',11,10),sol(5,104,'T_0',0,20)];
$p=project($d,8000);same(row($p)['solved'],0,'exclude before after and future');same(array_sum(array_column(row($p)['problemStats'],'submitCount')),1,'pending counts CE ignored');
$d=fixture();$d['solution']=[sol(9,100,'T_1',4,100),sol(8,100,'T_0',4,100),sol(10,101,'T_0',4,14400),sol(11,100,'T_0',4,500),sol(12,101,'T_1',4,200)];
$palette=R::palette();$b=R::balloonAssignments($d,strtotime('2026-10-04 13:00:00'),str_repeat('k',32),$palette);
same(count($b),3,'one balloon per eligible AC');same($b[8]['first_blood'],true,'first blood SID tie');same($b[9]['first_blood'],false,'not duplicate first blood');same($b[8]['label'],'FB','uniform first blood label');same($b[8]['color'],'#000000','reserved first blood color');same($b[12]['label'],'FB','all first blood identical');same(isset($b[10]),false,'no freeze balloon');
same($b,R::balloonAssignments($d,strtotime('2026-10-04 13:00:00'),str_repeat('k',32),$palette),'restart deterministic');
expectError(function()use($d){R::balloonAssignments($d,time(),str_repeat('k',32),[]);},'palette shortage');
expectError(function()use($d,$palette){$palette[0]['color']='#ABCDEF';$palette[1]['color']='#abcdef';R::balloonAssignments($d,time(),str_repeat('k',32),$palette);},'duplicate color ignoring hex case');
expectError(function()use($d,$palette){$palette[0]['name']='';R::balloonAssignments($d,time(),str_repeat('k',32),$palette);},'empty color label');
// Every ordinary balloon color is distinct for each team.
$d=fixture();foreach(range(0,4) as $i){$d['solution'][]=sol($i+1,100+$i,'T_0',4,$i+1);$d['solution'][]=sol($i+11,100+$i,'T_1',4,$i+20);}
$b=R::balloonAssignments($d,strtotime('2026-10-04 13:00:00'),str_repeat('k',32),$palette);$colors=[];foreach(range(11,15) as $id)$colors[]=$b[$id]['color'];same(count(array_unique($colors)),5,'injective team palette');
// Whitespace/unknown/staff teams do not contribute to reveal counts.
$d=fixture(5);$d['team'][]=[1,'staff','Admin','','','','','',0,'','admin'];$d['solution']=[sol(1,100,'staff',4,10)];$p=project($d);same($p['ccpc_meta']['team_count'],5,'staff excluded');same(count($p['problem']),0,'staff cannot reveal');
same(R::settings(['contest_rank_kind'=>'ccpc','frozen_minute'=>0])['frozen_minute'],60,'fixed one hour');same(R::settings([],['contest_rank_kind'=>'ccpc'])['contest_rank_kind'],'ccpc','preserve omitted setting');
echo "PASS $checks rule assertions\n";
