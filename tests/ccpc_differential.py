"""Independent per-(team,problem) oracle vs production PHP stream processor."""
import datetime as dt, hashlib, hmac, json, os, random, subprocess, pathlib
root=pathlib.Path(__file__).resolve().parents[1]
START=int(dt.datetime(2026,10,4,8,tzinfo=dt.timezone.utc).timestamp())
SECRET='k'*32
rng=random.Random(20260914)
def stamp(seconds):return dt.datetime.fromtimestamp(START+seconds,dt.timezone.utc).strftime('%Y-%m-%d %H:%M:%S')
def fixture(n,m):
 return {'contest':{'contest_id':1,'contest_rank_kind':'ccpc','start_time':stamp(0),'end_time':stamp(18000),'frozen_after':30},'problem':[[100+i,'SECRET_TITLE_'+str(i),i,'#abcdef',0] for i in range(m)],'team':[[1,'T_'+str(i),'Team '+str(i),'','','','School','',0,'','',None,[],0] for i in range(n)],'solution':[]}
def oracle(data,now):
 n=len(data['team']);m=len(data['problem']);fr=14400<=now<19800;states={};acs=[0]*m
 for ti in range(n):
  tid='T_'+str(ti)
  for pi in range(m):
   # Deliberately group first, locate first AC, then count; production scans global events.
   events=sorted((s for s in data['solution'] if s[2]==100+pi and s[3]=='#cpc1_'+tid and 0<=s[4]<=10 and stamp(0)<=s[5]<stamp(18000) and s[5]<=stamp(now)),key=lambda s:(s[5],s[0]))
   accepted=next((i for i,s in enumerate(events) if s[4]==4),None)
   if accepted is not None: events=events[:accepted+1]
   visible_ac=next((s for s in events if s[4]==4 and not(fr and s[5]>=stamp(14400))),None)
   pending=any(s[4]<4 or (fr and s[5]>=stamp(14400)) for s in events)
   status='ac' if visible_ac else 'pending' if pending else 'wa' if events else 'none'
   last=int((dt.datetime.strptime(events[-1][5],'%Y-%m-%d %H:%M:%S')-dt.datetime(2026,10,4,8)).total_seconds()) if events else None
   ac=last if visible_ac else None
   wrong=sum(5<=s[4]<=10 and not(fr and s[5]>=stamp(14400)) for s in events)
   states[ti,pi]=(status,len(events),last,ac,wrong)
   if ac is not None:acs[pi]+=1
 threshold=min(50,max(1,n//5))
 reveal={i for i in range(m) if now>=14400 or acs[i]>=threshold}
 rows=[]
 for ti in range(n):
  def key(pi):
   st,count,last,ac,wrong=states[ti,pi]
   return (0,pi,pi) if pi in reveal else (1,ac,pi) if ac is not None else (2,last,pi) if last is not None else (3,pi,pi)
  order=sorted(range(m),key=key);stats=[];keys=[];penalty=solved=0
  for pi in order:
   status,count,last,ac,wrong=states[ti,pi]
   if ac is not None:solved+=1;penalty+=ac+wrong*1200
   payload=json.dumps([1,'T_'+str(ti),str(100+pi)],separators=(',',':')).encode()
   keys.append(str(100+pi) if pi in reveal else 'h_'+hmac.new(SECRET.encode(),payload,hashlib.sha256).hexdigest()[:32])
   stats.append((status,count,('%02d:%02d:%02d'%(last//3600,last//60%60,last%60)) if last is not None else ''))
  rows.append((solved,penalty,keys,stats))
 return reveal,rows
cases=[]
for case in range(180):
 d=fixture(rng.randint(1,30),rng.randint(1,12))
 for sid in range(1,rng.randint(40,300)):
  sec=rng.choice([-1,0,100,14399,14400,14401,17999,18000,rng.randint(0,20000)])
  d['solution'].append([sid,1,100+rng.randrange(len(d['problem'])),'#cpc1_T_'+str(rng.randrange(len(d['team']))),rng.randrange(0,14),stamp(sec)])
 rng.shuffle(d['solution'])
 for now in [0,14399,14400,16000,19800]: cases.append({'data':d,'now':START+now,'secret':SECRET})
php=os.environ.get('PHP','php')
proc=subprocess.run([php,str(root/'tests/ccpc_cli.php')],input=''.join(json.dumps(c)+'\n' for c in cases),text=True,capture_output=True,check=True)
outputs=[json.loads(x) for x in proc.stdout.splitlines()];assert len(outputs)==len(cases)
for i,(case,out) in enumerate(zip(cases,outputs)):
 reveal,rows=oracle(case['data'],case['now']-START)
 assert [p[2] for p in out['problem']]==sorted(reveal),(i,'reveal')
 for actual,expected in zip(out['ccpc_rows'],rows):
  stats=actual['problemStats'];vals=[stats[k] for k in actual['problemOrder']]
  got=(actual['solved'],actual['penalty'],actual['problemOrder'],[(x['status'],x['submitCount'],x['lastSubmitTime']) for x in vals])
  assert got==expected,(i,got,expected)
 assert not out['solution'] and not out['contest_balloon']
 assert 'SECRET_TITLE_' not in json.dumps(out)
outdir=root/'test-results';outdir.mkdir(exist_ok=True)
(outdir/'snapshot.json').write_text(json.dumps(outputs[2]))
# Before freezing: populate a fixture with hidden cells for DOM integration.
(outdir/'hidden-snapshot.json').write_text(json.dumps(outputs[1]))
print('PASS',len(cases),'randomized snapshots against independent oracle (180 contests x 5 time boundaries)')
