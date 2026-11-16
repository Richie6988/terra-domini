#!/bin/bash
# Runs the validation agents one after another, one batch each, until nothing is left (or MAX cycles).
#   AGENT_CMD='your-agent-cli --prompt-file' bash agents/loop.sh            # all three workers in turn
#   ONLY=poi AGENT_CMD='...' MAX=20 bash agents/loop.sh                      # one worker, 20 batches
# AGENT_CMD gets the prompt file path as its last argument (e.g. 'claude -p "$(cat FILE)"' style wrappers: see README).
# After every batch: the validations are folded into the token base and committed locally (never pushed).
set -e
cd "$(dirname "$0")/.."
: "${AGENT_CMD:?set AGENT_CMD (see agents/README.md)}"
MAX=${MAX:-1000}
WORKERS=${ONLY:-"poi species mushroom"}
left() {   # rows still to check for a worker
  python3 - "$1" <<'P'
import json, sys
t = json.load(open('data/hexod_db/hexod_db.json'))['tokens']
w = sys.argv[1]
if w == 'poi':
    print(sum(1 for x in t if not x.get('species_id') and not x.get('verdict')))
else:
    sp = {x['species_id']: x for x in t if x.get('species_id') and not x.get('verdict')}
    print(sum(1 for x in sp.values() if (x.get('codex_category') == 'mushroom') == (w == 'mushroom')))
P
}
for i in $(seq 1 "$MAX"); do
  active=0
  for w in $WORKERS; do
    n=$(left "$w")
    [ "$n" = "0" ] && continue
    active=1
    echo "== cycle $i · $w · $n left · $(date -u +%H:%M)"
    $AGENT_CMD "agents/run_$w.md" || echo "agent exited with an error, continuing"
    python3 scripts/fold_validations.py | tail -1
    git add data/hexod_db agents/reports
    git commit -qm "Agents: $w batch ($(date -u +%Y-%m-%dT%H:%MZ))" || true
  done
  [ $active = 0 ] && { echo "nothing left to check"; break; }
done
