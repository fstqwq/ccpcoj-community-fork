#!/usr/bin/env python3
"""Recover the exact source-bearing layers; never run the downloaded images."""
import argparse,concurrent.futures,hashlib,json,pathlib,urllib.request
from safe_layers import apply
ROOT=pathlib.Path(__file__).resolve().parents[1]
LAYERS={'ccpcoj-web2':[26,27,28,29,30,32],'ccpcoj-judge2':[9,10,11]}
ACCEPT='application/vnd.oci.image.manifest.v1+json,application/vnd.docker.distribution.manifest.v2+json'
def request(url,token=None):
 headers={'Accept':ACCEPT}
 if token:headers['Authorization']='Bearer '+token
 return urllib.request.urlopen(urllib.request.Request(url,headers=headers),timeout=120)
def recover(name,destination):
 source=json.loads((ROOT/'provenance/images'/name/'source.json').read_text());repo=source['repository']
 with request('https://auth.docker.io/token?service=registry.docker.io&scope=repository:'+repo+':pull') as response:token=json.load(response)['token']
 base='https://registry-1.docker.io/v2/'+repo
 with request(base+'/manifests/'+source['manifest_digest'],token) as response:raw=response.read()
 assert 'sha256:'+hashlib.sha256(raw).hexdigest()==source['manifest_digest'],'manifest digest mismatch'
 manifest=json.loads(raw);out=destination/name;out.mkdir()
 (out/'manifest.json').write_bytes(raw)
 for idx in LAYERS[name]:
  layer=manifest['layers'][idx];path=out/(str(idx)+'.tar.gz');checksum=hashlib.sha256()
  with request(base+'/blobs/'+layer['digest'],token) as response,path.open('wb') as output:
   while chunk:=response.read(1024*1024):output.write(chunk);checksum.update(chunk)
  assert 'sha256:'+checksum.hexdigest()==layer['digest'],'layer digest mismatch'
  apply(path,out/'rootfs');path.unlink();print(name,'layer',idx,'verified',flush=True)
 # Image config is evidence, not a live configuration to deploy.
 if name=='ccpcoj-web2':
  env=out/'rootfs/ojweb/.env'
  if env.exists():env.unlink()
parser=argparse.ArgumentParser();parser.add_argument('destination',type=pathlib.Path)
args=parser.parse_args();args.destination.mkdir(parents=True,exist_ok=True)
if any(args.destination.iterdir()):parser.error('destination must be empty')
with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
 list(pool.map(lambda n:recover(n,args.destination),LAYERS))
print('Recovered /ojweb, /SQL, /nginx_conf, /core and /judge_lib; image .env deliberately omitted.')
