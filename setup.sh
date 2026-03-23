#!/bin/bash
# ═══════════════════════════════════════════════════════════
#  HEXOD — setup.sh  |  bash setup.sh
# ═══════════════════════════════════════════════════════════
set -e
cd "$(dirname "$0")"
GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RESET='\033[0m'
ok()   { echo -e "${GREEN}✅ $1${RESET}"; }
info() { echo -e "${YELLOW}→  $1${RESET}"; }

info "Venv..."
cd backend && source venv/bin/activate && ok "venv actif"

info "Migrations..."
python manage.py migrate --verbosity=0 2>/dev/null || \
  (python manage.py migrate --fake-initial --verbosity=0 2>/dev/null || true)
ok "Migrations OK"

info "Admin + seed..."
python3 << 'EOF'
import os,sys
os.environ['DJANGO_SETTINGS_MODULE']='terra_domini.settings.dev'
os.environ['DJANGO_SECRET_KEY']='dev-secret-key-change-in-prod'
sys.path.insert(0,'.')
import django; django.setup()

from terra_domini.apps.accounts.models import Player
try:
    u = Player.objects.get(email='admin@td.com')
    u.set_password('admin123')
except Player.DoesNotExist:
    u = Player(username='admin', email='admin@td.com')
    u.set_password('admin123')
u.is_staff=True; u.is_superuser=True; u.tdc_in_game=999999; u.save()
print("Admin: admin@td.com / admin123")

from terra_domini.apps.territories.models import Territory
if Territory.objects.count() == 0:
    import csv, h3
    objs = []
    if os.path.exists('terra_domini_pois.csv'):
        with open('terra_domini_pois.csv') as f:
            for row in csv.DictReader(f):
                try:
                    lat=float(row.get('lat',0) or 0); lon=float(row.get('lon',0) or 0)
                    if not lat and not lon: continue
                    h3i=h3.geo_to_h3(lat,lon,10)
                    bd=[[p[0],p[1]] for p in h3.h3_to_geo_boundary(h3i)]
                    name=(row.get('name','') or '')[:200]
                    objs.append(Territory(
                        h3_index=h3i,h3_resolution=10,
                        geom_geojson={'type':'Polygon','coordinates':[bd]},
                        territory_type=row.get('category','landmark'),
                        country_code=row.get('country_code','XX') or 'XX',
                        region_name='',place_name=name,
                        center_lat=lat,center_lon=lon,
                        rarity=row.get('rarity','common') or 'common',
                        biome=row.get('category','landmark'),
                        tdc_per_day=float(row.get('tdc_per_24h',10) or 10),
                        defense_tier=1,defense_points=100.0,max_defense_points=100.0,
                        is_landmark=True,poi_name=name,
                        is_shiny=bool(int(row.get('is_shiny',0) or 0)),
                    ))
                except: pass
        Territory.objects.bulk_create(objs,ignore_conflicts=True)
print(f"Territoires: {Territory.objects.count()}")
EOF
ok "Seed OK"

info "Build frontend..."
cd ../frontend
command -v npm &>/dev/null && npm install --silent 2>/dev/null && npm run build 2>/dev/null && ok "Frontend buildé" || echo "⚠️  npm absent"

cd ../backend
echo ""
echo "  🌍 Port 8000 → jeu  |  /admin  |  /gm"
echo "  Login: admin@td.com / admin123"
echo ""
exec python manage.py runserver 0.0.0.0:8000
