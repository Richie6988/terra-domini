#!/bin/bash
# HEXOD token DB refresh on the VPS (the only place that reaches Wikipedia).
#   bash deploy/wiki_refresh.sh --pull     # pull the agents' new candidates first (then restart if code changed)
#   bash deploy/wiki_refresh.sh            # tokens/candidates already on disk
#   bash deploy/wiki_refresh.sh --limit 50 # quick try
# 1) pull the agents' new candidates  2) Wikipedia: pictures + credits, coordinates, intro, article exists?
# 3) rebuild the master DB  4) load it into the game (owners never touched)
set -e
cd "$(dirname "$0")/.."
PY=.venv/bin/python
# Generated DB goes outside the repo (git pull stays clean); the site reads it via HEXOD_DB_JSON in .env.prod
DATA=${HEXOD_DATA:-/home/hexod/data}/hexod_db
mkdir -p "$DATA"
export HEXOD_DB_OUT="$DATA" HEXOD_DB_JSON="$DATA/hexod_db.json"
if [ "$1" = "--pull" ]; then
  shift
  git pull --ff-only
fi
$PY scripts/wiki_enrich.py "$@"
$PY scripts/build_hexod_db.py
(cd backend && DJANGO_SETTINGS_MODULE=terra_domini.settings.prod ../$PY manage.py import_hexod_db)
grep -q '^HEXOD_DB_JSON=' .env.prod 2>/dev/null || echo "!! add HEXOD_DB_JSON=$DATA/hexod_db.json to .env.prod, then restart the site"
echo
echo "Share the Wikipedia data with the repo (dev + agents see the pictures):"
echo "  git add data/hexod_db/sources/wiki_enrich.csv && git commit -m 'Wikipedia enrichment' && git push"
