#!/usr/bin/env python3
"""Create secrets once, with no secret values printed to the terminal."""
from pathlib import Path
import os,secrets
out=Path(__file__).resolve().parents[1]/'.env'
values={k:secrets.token_hex(32) for k in ['MYSQL_ROOT_PASSWORD','DB_PASSWORD','ADMIN_PASSWORD','JUDGER_PASSWORD','CCPC_HMAC_KEY']}
values.update(APP_TIMEZONE='Asia/Macau',OJ_BIND='127.0.0.1',OJ_PORT='20080')
fd=os.open(out,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)
with os.fdopen(fd,'w') as f:f.write(''.join(k+'='+v+'\n' for k,v in values.items()))
print('Created .env (0600). Keep a backup; do not rotate CCPC_HMAC_KEY during a contest.')
