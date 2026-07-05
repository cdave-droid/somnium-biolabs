#!/usr/bin/env bash
# G4(c)/G5 parity gate: every golden case must produce byte-identical output
# from BOTH runtimes, matching the committed expected.canonical.json.
set -euo pipefail
cd "$(dirname "$0")/.."

PKG=content/packages/demo-2026.07.0
pass=0; fail=0
for d in golden/cases/*/; do
  name=$(basename "$d")
  want=$(cat "$d/expected.canonical.json")
  got_py=$(python3 -c "
import json, sys
sys.path.insert(0, 'engine-py')
from sentinel import Engine, load_content
from sentinel.canonical import canonical_json
inp = json.load(open('$d/input.json'))
c = load_content('$PKG')
print(canonical_json(Engine(c).evaluate(inp['unit_profile'], inp['observations'], inp['context'], inp['reference_time'])))
")
  got_ts=$(node engine-ts/dist/bin/run_case.js "$PKG" "$d/input.json")
  if [ "$got_py" = "$want" ] && [ "$got_ts" = "$want" ]; then
    pass=$((pass+1))
  else
    fail=$((fail+1))
    echo "DIVERGE: $name"
    [ "$got_py" != "$want" ] && echo "  python != expected"
    [ "$got_ts" != "$want" ] && echo "  typescript != expected"
  fi
done
echo "parity: $pass/$((pass+fail)) golden cases byte-identical in BOTH runtimes"
[ "$fail" -eq 0 ]
