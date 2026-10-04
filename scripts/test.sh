#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
: "${PHP:=php}"
export PHP
"$PHP" tests/ccpc_rules_test.php
"$PHP" tests/ccpc_endpoint_test.php
python3 tests/ccpc_differential.py
node --test tests/ccpc_frontend.test.cjs
python3 -m unittest discover -s tests -p 'test_*.py' -v
