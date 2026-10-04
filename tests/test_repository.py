import importlib.util,pathlib,tempfile,unittest
ROOT=pathlib.Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('migration',ROOT/'ojweb/ccpc_migrate.py');migration=importlib.util.module_from_spec(spec);spec.loader.exec_module(migration)
class Cursor:
 def __init__(self):self.columns=set();self.ddls=0;self.current=None
 def __enter__(self):return self
 def __exit__(self,*args):pass
 def execute(self,sql,args=()):
  if 'GET_LOCK' in sql:self.current=(1,)
  elif 'RELEASE_LOCK' in sql:self.current=(1,)
  elif 'information_schema.columns' in sql:self.current=(int(args[2] in self.columns),)
  elif 'ALTER TABLE' in sql:self.columns.add(sql.split('`')[3]);self.ddls+=1
  else:raise AssertionError(sql)
 def fetchone(self):return self.current
class Connection:
 def __init__(self):self.c=Cursor()
 def cursor(self):return self.c
class Tests(unittest.TestCase):
 def test_migration_is_idempotent_and_preserves_existing_columns(self):
  c=Connection();c.c.columns.add('old_column');migration.migrate(c,'ccpcoj');migration.migrate(c,'ccpcoj');self.assertEqual(c.c.ddls,2);self.assertIn('old_column',c.c.columns)
 def test_migration_rejects_missing_lock(self):
  class NoLock(Cursor):
   def fetchone(self):return (0,)
  c=Connection();c.c=NoLock()
  with self.assertRaises(RuntimeError):migration.migrate(c,'ccpcoj')
 def test_migration_partial_upgrade(self):
  c=Connection();c.c.columns.add('contest_rank_kind');migration.migrate(c,'ccpcoj');self.assertEqual(c.c.ddls,1)
 def test_layer_traversal_and_whiteouts(self):
  import sys,tarfile,io
  sys.path.insert(0,str(ROOT/'scripts'))
  from safe_layers import apply
  with tempfile.TemporaryDirectory(dir=ROOT/'test-results') as directory:
   root=pathlib.Path(directory);target=root/'out';target.mkdir();(target/'keep').write_text('keep');(target/'deleted').write_text('old')
   layer=root/'layer.tar'
   with tarfile.open(layer,'w') as t:
    for name in ['.wh.deleted','new']:
     m=tarfile.TarInfo(name);m.size=3;t.addfile(m,io.BytesIO(b'new'))
   apply(layer,target);self.assertFalse((target/'deleted').exists());self.assertEqual((target/'keep').read_text(),'keep')
   with tarfile.open(layer,'w') as t:
    m=tarfile.TarInfo('../escape');m.size=1;t.addfile(m,io.BytesIO(b'x'))
   with self.assertRaises(ValueError):apply(layer,target)
if __name__=='__main__':unittest.main()
