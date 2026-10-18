#!/bin/bash
# One command to deploy a new version on the VPS (run as root from anywhere):
#
#   sudo bash /home/hexod/terra-domini/deploy/update.sh            # code + DB migrations + restart (1-2 min)
#   sudo bash /home/hexod/terra-domini/deploy/update.sh --data     # same, then refresh the token data in the background
#                                                                  # (open databases + Wikipedia photos, ~1 h; log: /home/hexod/data/data_refresh.log)
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

echo "== 6/6 restart"
systemctl restart hexod
sleep 3
systemctl is-active hexod && echo "site restarted"

if [ "$1" = "--data" ]; then
  mkdir -p /home/hexod/data && chown hexod: /home/hexod/data
  sudo -u hexod -H nohup bash "$APP/deploy/wiki_refresh.sh" --external > /home/hexod/data/data_refresh.log 2>&1 &
  echo "token data refresh started in the background — follow it with:  tail -f /home/hexod/data/data_refresh.log"
fi
