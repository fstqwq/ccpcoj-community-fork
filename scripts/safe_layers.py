"""Apply trusted-digest image layers without ever writing outside destination."""
import os,tarfile,pathlib,shutil,argparse

def apply(layer,root):
 root=pathlib.Path(root).resolve();root.mkdir(parents=True,exist_ok=True)
 def path(name):
  p=pathlib.PurePosixPath(name)
  if p.is_absolute() or '..' in p.parts: raise ValueError('unsafe path '+name)
  q=root.joinpath(*p.parts)
  if not q.parent.resolve().is_relative_to(root):raise ValueError('escaping parent '+name)
  return q
 def remove(q):
  if q.is_symlink() or q.is_file():q.unlink()
  elif q.exists():shutil.rmtree(q)
 with tarfile.open(layer) as t:
  members=t.getmembers()
  for m in members:
   q=path(m.name)
   if q.name=='.wh..wh..opq':
    if q.parent.exists():
     for child in q.parent.iterdir(): remove(child)
   elif q.name.startswith('.wh.'):remove(q.with_name(q.name[4:]))
  for m in members:
   q=path(m.name)
   if q.name.startswith('.wh.'):continue
   q.parent.mkdir(parents=True,exist_ok=True)
   if m.isdir():
    if q.is_symlink() or q.is_file():remove(q)
    q.mkdir(exist_ok=True)
   elif m.isfile():
    remove(q)
    with t.extractfile(m) as src,q.open('wb') as dst:shutil.copyfileobj(src,dst)
    q.chmod(m.mode & 0o777)
   elif m.issym():
    target=(root/m.linkname.lstrip('/')) if m.linkname.startswith('/') else q.parent/m.linkname
    if not target.resolve().is_relative_to(root):raise ValueError('unsafe link '+m.name)
    remove(q);q.symlink_to(os.path.relpath(target,q.parent))
   elif m.islnk():
    src=path(m.linkname)
    if not src.resolve().is_relative_to(root):raise ValueError('unsafe hardlink')
    remove(q);os.link(src,q)
   # Devices/FIFOs are deliberately not restored in a source workspace.
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('destination');p.add_argument('layers',nargs='+');args=p.parse_args()
 for layer in args.layers: apply(layer,args.destination);print('APPLIED',layer,flush=True)
