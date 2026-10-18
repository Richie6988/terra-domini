#!/bin/bash
# HEXOD token DB refresh on the VPS (the only place that reaches Wikipedia).
#   bash deploy/wiki_refresh.sh --pull     # pull the agents' new candidates first (then restart if code changed)
#   bash deploy/wiki_refresh.sh            # tokens/candidates already on disk
#   bash deploy/wiki_refresh.sh --limit 50 # quick try
#   bash deploy/wiki_refresh.sh --external # first refresh the open databases (Wikidata categories, iNaturalist, PBDB)
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
if [ "$1" = "--external" ]; then
  shift
  $PY scripts/fetch_external.py all
fi
$PY scripts/wiki_enrich.py "$@"
$PY scripts/build_hexod_db.py
(cd backend && DJANGO_SETTINGS_MODULE=terra_domini.settings.prod ../$PY manage.py import_hexod_db)
# the site reads the refreshed DB from there (added once), then reloads its worker (gunicorn runs as hexod)
grep -q '^HEXOD_DB_JSON=' .env.prod 2>/dev/null || echo "HEXOD_DB_JSON=$DATA/hexod_db.json" >> .env.prod
pkill -HUP -f "gunicorn terra_domini" && echo "site reloaded with the new token data" || echo "restart the site to load the new token data"
