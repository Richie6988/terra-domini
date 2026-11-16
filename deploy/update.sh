#!/bin/bash
# One command to deploy a new version on the VPS (run as root from anywhere):
#
#   sudo bash /home/hexod/terra-domini/deploy/update.sh            # code + DB migrations + restart (1-2 min)
#
# Everything Django runs with the PRODUCTION settings (the site's database in /home/hexod/data), as user hexod.
set -e
APP=/home/hexod/terra-domini
PY=$APP/.venv/bin/python
AS="sudo -u hexod -H env DJANGO_SETTINGS_MODULE=terra_domini.settings.prod"

echo "== 1/6 code"
chown -R hexod: "$APP"   # a pull done as root leaves root-owned files that block the next one
sudo -u hexod -H git -C "$APP" pull --ff-only

echo "== 2/6 python packages"
sudo -u hexod -H "$APP/.venv/bin/pip" install -q -r "$APP/backend/requirements.txt"

echo "== 3/6 database migrations (production DB)"
cd "$APP/backend"
$AS "$PY" manage.py migrate --noinput
$AS "$PY" manage.py collectstatic --noinput -v 0

echo "== 4/6 game data (shop, tokens, auctions)"
$AS "$PY" manage.py seed_shop
$AS "$PY" manage.py import_hexod_db
$AS "$PY" manage.py daily_auctions

echo "== 5/6 scheduled jobs"
crontab -u hexod "$APP/deploy/hexod.cron"

# one source (owner 2026-11-16): the game reads data/hexod_db/hexod_db.json from git, never an old server copy
sed -i '/^HEXOD_DB_JSON=/d' "$APP/.env.prod" 2>/dev/null || true

echo "== 6/6 restart"
systemctl restart hexod
sleep 3
systemctl is-active hexod && echo "site restarted"

# token pictures copied on our server (resumable, skips the ones already there)
sudo -u hexod -H env DJANGO_SETTINGS_MODULE=terra_domini.settings.prod nohup "$PY" manage.py mirror_images >> /home/hexod/data/mirror_images.log 2>&1 &
echo "pictures copy running in the background — log: /home/hexod/data/mirror_images.log"

