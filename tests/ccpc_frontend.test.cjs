const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const ctx={console,performance,URLSearchParams,setTimeout,clearTimeout,Map,Set,Date};
ctx.window=ctx;ctx.location={search:''};ctx.localStorage={getItem(){return null}};ctx.document={};vm.createContext(ctx);
for(const file of ['rank_tool.js','rank.js','rank_ccpc.js','rank_page.js']) vm.runInContext(fs.readFileSync(path.join(root,'ojweb/public/static/csgoj/contest',file),'utf8'),ctx,{filename:file});
function instance(fixture){
 const inst=Object.create(ctx.RankSystem.prototype);
 Object.assign(inst,{data:JSON.parse(JSON.stringify(fixture)),config:{},currentMode:'team',GetHeaderElement(){return null},_rankPerfEnabled(){return false},_rankWireInstantMs(s){return Date.parse(s.replace(' ','T')+'Z')},IsFrozen(s){return s.result<0}});
 inst.ConvertListToDict();inst.ProcessData();return inst;
}
const hidden=JSON.parse(fs.readFileSync(path.join(root,'test-results/hidden-snapshot.json')));
const frozen=JSON.parse(fs.readFileSync(path.join(root,'test-results/snapshot.json')));
test('production RankSystem consumes hidden server snapshots and retains all registered teams',()=>{
 const i=instance(hidden);assert.equal(i.rankList.length,hidden.team.length);assert.equal(i.config.flg_rank_cache,false);
 for(const row of i.rankList){assert.ok(row.team);const html=i.CreateProblemGroup(row.problemStats,row);assert.equal((html.match(/class="rank-col rank-col-problem"/g)||[]).length,hidden.ccpc_meta.problem_count);for(const key of row.problemOrder.filter(k=>k.startsWith('h_')))assert.ok(!html.includes(key));}
 assert.ok(!i.CreateProblemHeaderGroup().includes('balloon'));
 assert.equal(JSON.stringify(i.CalculateProblemStats()),JSON.stringify(hidden.ccpc_meta.problem_stats));
});
test('freeze snapshot exposes aligned letters but retains pending verdicts',()=>{
 const i=instance(frozen);assert.equal(i.data.problem.length,frozen.ccpc_meta.problem_count);
 assert.ok(!i.CreateProblemHeaderGroup().includes('Hidden problems'));
 for(const row of i.rankList){assert.ok(!i.CreateProblemGroup(row.problemStats,row).includes('ccpc-private-zone'));}
});
test('legacy XCPC result processing and same-second ordering still work',()=>{
 const data={contest:{contest_id:1,contest_rank_kind:'icpc',start_time:'2026-10-04 08:00:00'},team:[[1,'T_0','Team','','','','School','',0,'','',null,[],0]],problem:[[100,'A',0,'red',0]],solution:[[1,1,100,'#cpc1_T_0',6,'2026-10-04 08:01:00'],[2,1,100,'#cpc1_T_0',4,'2026-10-04 08:02:00'],[3,1,100,'#cpc1_T_0',6,'2026-10-04 08:03:00']]};
 const i=instance(data);assert.equal(i.rankList[0].team_id,'T_0');assert.equal(i.rankList[0].solved,1);assert.equal(i.rankList[0].penalty,1320);assert.equal(i.rankList[0].problemStats[100].submitCount,2);
});
test('CCPC renderer escapes attributes and only displays labels supplied by server',()=>{
 const i=instance(hidden);const st={status:'<script>',submitCount:1,lastSubmitTime:'" onmouseover="evil',problemAlphabetIdx:''};
 const html=i.CreateProblemGroup({'h_private':st},{problemOrder:['h_private']});
 assert.ok(!html.includes('<script>'));assert.ok(!html.includes(' onmouseover="'));assert.ok(html.includes('&quot;'));assert.ok(html.includes('d-pro-idx=""'));
});
test('CCPC school view does not combine unrelated hidden problems',()=>{
 const i=instance(hidden);i.currentMode='school';const row=i.rankList[0];const html=i.CreateProblemGroup(row.problemStats,row);
 assert.equal((html.match(/class="rank-col rank-col-problem"/g)||[]).length,hidden.problem.length);
});
test('CCPC factory retains upstream page class and skins',()=>{
 const Cls=ctx.CcpcRank.pageClass(vm.runInContext('RankPageSystem',ctx));assert.equal(Cls.name,'RankCcpcPageSystem');assert.ok(Cls.prototype instanceof ctx.RankSystem);
});
test('production balloon queue uses server labels and never schedules frozen deliveries',()=>{
 vm.runInContext(fs.readFileSync(path.join(root,'ojweb/public/static/csgoj/contest/balloon_manager.js'),'utf8'),ctx);
 const q=Object.create(ctx.BalloonQueueSystem.prototype);
 const problem={problem_id:100,num:0,color:'#112233'};
 Object.assign(q,{data:{team:[{team_id:'T'}],problem:[problem],solution:[{solution_id:1,team_id:'T',problem_id:100}],ccpc_balloon_assignments:{'1':{color:'#abcdef',label:'Sky',first_blood:false}},ccpc_freeze_at:Date.now()+100000,ccpc_server_time:Date.now()},balloonMap:new Map(),map_fb:{global:{},regular:{}},IsFrozen(){return false}});
 q.BuildBalloonList();assert.equal(q.balloonList.length,1);assert.equal(q.balloonList[0].problem_alphabet,'Sky');assert.equal(q.balloonList[0].problem.color,'#abcdef');assert.equal(problem.color,'#112233');assert.ok(q.balloonList[0].ccpc_freeze_at);
 q.data.ccpc_balloon_stopped=true;q.BuildBalloonList();assert.equal(q.balloonList.length,0);
});
test('production ticket printer rejects stale pre-freeze queues using server clock offset',()=>{
 ctx.$=()=>{};ctx.document.getElementById=()=>null;ctx.document.createElement=()=>({textContent:'',get innerHTML(){return String(this.textContent).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}});
 vm.runInContext(fs.readFileSync(path.join(root,'ojweb/public/static/csgoj/contest/balloon_print.js'),'utf8'),ctx);
 assert.throws(()=>ctx.BalloonPrint.generateTicketHTML({ccpc_freeze_at:Date.now()-1},57,50),/停止发放/);
 assert.throws(()=>ctx.BalloonPrint.generateTicketHTML({ccpc_freeze_at:Date.now()+10000,ccpc_clock_offset:20000},57,50),/停止发放/);
 const html=ctx.BalloonPrint.generateTicketHTML({team_id:'T',problem_alphabet:'Sky',problem:{color:'#abcdef'},ccpc_freeze_at:Date.now()+100000},57,50);
 assert.ok(html.includes('Sky'));
});
