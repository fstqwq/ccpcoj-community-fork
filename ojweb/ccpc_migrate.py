"""Idempotent CCPC extension migration; safe for fresh and existing databases."""
COLUMNS = {
    'contest_rank_kind': "varchar(8) NOT NULL DEFAULT 'icpc'",
    'ccpc_reveal_policy': "varchar(16) NOT NULL DEFAULT 'min_50_20'",
}
def migrate(conn, database):
    with conn.cursor() as cur:
        cur.execute("SELECT GET_LOCK('ccpcoj_ccpc_2026_migration', 30)")
        if cur.fetchone()[0] != 1:
            raise RuntimeError('Could not acquire CCPC migration lock')
        try:
            for name, ddl in COLUMNS.items():
                cur.execute('SELECT COUNT(*) FROM information_schema.columns WHERE table_schema=%s AND table_name=%s AND column_name=%s', (database, 'contest', name))
                if cur.fetchone()[0] == 0:
                    cur.execute('ALTER TABLE `contest` ADD COLUMN `' + name + '` ' + ddl)
        finally:
            cur.execute("SELECT RELEASE_LOCK('ccpcoj_ccpc_2026_migration')")
