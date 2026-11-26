import sqlite3, re, unittest, tempfile
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
SOURCE=(ROOT/'src/core/database/migrations/001.ts').read_text(encoding='utf8')
MIGRATION=re.search(r'String.raw`(.*?)`;',SOURCE,re.S).group(1)
class Persistence(unittest.TestCase):
 def setUp(self):
  self.directory=tempfile.TemporaryDirectory(dir=ROOT/'.test-output')
  self.path=Path(self.directory.name)/'real.sqlite'
  self.db=sqlite3.connect(self.path)
  self.db.execute('PRAGMA foreign_keys=ON')
  self.db.execute('PRAGMA journal_mode=WAL')
  self.db.executescript(MIGRATION)
  self.db.execute("INSERT INTO properties VALUES('p','Inmueble','Calle','Lima','Lima','Lima','Casa','',1)")
  self.db.execute("INSERT INTO units VALUES('u','p','101','Unidad','','Casa','','',1)")
  self.db.execute("INSERT INTO people VALUES('a','Persona','Ejemplo','DNI','12345678','','','',1)")
  self.db.commit()
 def tearDown(self):self.db.close();self.directory.cleanup()
 def test_reopen_and_wal(self):
  self.db.close();self.db=sqlite3.connect(self.path)
  self.assertEqual(self.db.execute('SELECT name FROM properties').fetchone()[0],'Inmueble')
  self.assertEqual(self.db.execute('PRAGMA journal_mode').fetchone()[0],'wal')
 def test_duplicate_code(self):
  with self.assertRaises(sqlite3.IntegrityError):self.db.execute("INSERT INTO units VALUES('u2','p','101','Duplicada','','Casa','','',1)")
 def test_foreign_keys(self):
  with self.assertRaises(sqlite3.IntegrityError):self.db.execute("INSERT INTO units VALUES('u2','missing','102','Ajena','','Casa','','',1)")
 def test_overlap_and_history(self):
  self.db.execute("INSERT INTO occupancies VALUES('o','u','a','INQUILINO','2026-11-01',NULL,1,10000,5,'')")
  with self.assertRaises(sqlite3.IntegrityError):self.db.execute("INSERT INTO occupancies VALUES('o2','u','a','INQUILINO','2026-11-10',NULL,1,10000,5,'')")
  self.db.execute("UPDATE occupancies SET end_date='2026-11-15' WHERE id='o'")
  self.db.execute("INSERT INTO occupancies VALUES('o2','u','a','INQUILINO','2026-11-16',NULL,1,10000,5,'')")
  self.assertEqual(self.db.execute('SELECT count(*) FROM occupancies').fetchone()[0],2)
 def test_transaction_rollback(self):
  try:
   with self.db:
    self.db.execute("INSERT INTO units VALUES('new','p','102','Nueva','','Casa','','',1)")
    self.db.execute("INSERT INTO units VALUES('bad','missing','103','Incorrecta','','Casa','','',1)")
  except sqlite3.IntegrityError:pass
  self.assertEqual(self.db.execute("SELECT count(*) FROM units WHERE id='new'").fetchone()[0],0)
 def test_consistent_backup_and_integrity(self):
  target=sqlite3.connect(':memory:');self.db.backup(target)
  self.assertEqual(target.execute('PRAGMA integrity_check').fetchone()[0],'ok')
  self.assertEqual(target.execute('PRAGMA foreign_key_check').fetchall(),[])
  self.assertEqual(target.execute('SELECT count(*) FROM properties').fetchone()[0],1)
  target.close()
if __name__=='__main__':
 (ROOT/'.test-output').mkdir(exist_ok=True)
 unittest.main(verbosity=2)
