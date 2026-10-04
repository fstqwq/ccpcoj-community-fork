#!/usr/bin/env python3
"""Fail a judge image build when its binaries differ from the published FAQ."""
import json
import platform
import subprocess
import sys
from pathlib import Path

manifest = json.loads(Path(sys.argv[1]).read_text())
def output(*args):
    return subprocess.check_output(args, stderr=subprocess.STDOUT, text=True).strip()

release = dict(line.split('=', 1) for line in Path('/etc/os-release').read_text().splitlines() if '=' in line)
actual = {
    'os': release['PRETTY_NAME'].strip('"'),
    'gcc': output('gcc', '-dumpfullversion'),
    'python': platform.python_version(),
    'java': output('javac', '-version').split()[-1],
}
for key, value in actual.items():
    if value != manifest[key]:
        raise SystemExit(f'{key}: expected {manifest[key]}, found {value}')
if output('g++', '-dumpfullversion') != manifest['gcc']:
    raise SystemExit('g++ does not match the configured GCC version')
if ('"' + manifest['java'] + '"') not in output('java', '-version'):
    raise SystemExit('java and javac versions differ')
print(json.dumps(actual))
