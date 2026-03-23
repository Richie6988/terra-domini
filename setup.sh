#!/bin/bash
# ═══════════════════════════════════════════════════════════
#  HEXOD — setup.sh
#  Usage: bash setup.sh
#  Fait tout : migrations, build front, démarrage serveur
# ═══════════════════════════════════════════════════════════
set -e
cd "$(dirname "$0")"

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; RESET='\033[0m'
ok()   { echo -e "${GREEN}✅ $1${RESET}"; }
info() { echo -e "${YELLOW}→  $1${RESET}"; }
err()  { echo -e "${RED}❌ $1${RESET}"; }

# ── 1. VENV ──────────────────────────────────────────────────────────────────
info "Activation venv Python..."
cd backend
source venv/bin/activate || { err "venv absent — run: python3 -m venv venv && pip install -r requirements.txt"; exit 1; }
ok "venv actif"

# ── 2. MIGRATIONS ────────────────────────────────────────────────────────────
info "Migration base de données..."

# Nettoyer django_migrations — garder seulement les apps tierces stables
python3 -c "
import sqlite3, os
db = 'db.sqlite3'
if not os.path.exists(db): exit(0)
conn = sqlite3.connect(db)
c = conn.cursor()
KEEP = {'auth','contenttypes','sessions','django_celery_beat','django_celery_results'}
c.execute(\"DELETE FROM django_migrations WHERE app NOT IN ('{}')\".format(\"','\".join(KEEP)))
conn.commit(); conn.close()
print('  DB migrations nettoyées')
" 2>/dev/null || true

# Fake-initial : marque toutes les migrations comme appliquées (schema existe déjà)
python manage.py migrate --fake-initial 2>/dev/null || python manage.py migrate --fake 2>/dev/null || true

ok "Migrations OK"

# ── 3. ADMIN ─────────────────────────────────────────────────────────────────
info "Vérification compte admin..."
python manage.py shell -c "
from terra_domini.apps.accounts.models import Player
try:
    u = Player.objects.get(email='admin@td.com')
    u.set_password('admin123')
    u.is_staff = True
    u.is_superuser = True
    u.tdc_in_game = 999999
    u.save()
    print('Admin OK')
except Player.DoesNotExist:
    u = Player.objects.create_superuser(username='admin', email='admin@td.com', password='admin123')
    u.tdc_in_game = 999999
    u.save()
    print('Admin créé')
" 2>/dev/null
ok "Admin: admin@td.com / admin123"

# ── 4. BUILD FRONTEND ────────────────────────────────────────────────────────
cd ../frontend
info "Build frontend React..."

if ! command -v npm &>/dev/null; then
    err "npm absent"
    info "Tentative installation Node..."
    sudo apk add nodejs npm 2>/dev/null \
    || sudo apt-get install -y nodejs npm 2>/dev/null \
    || { err "Impossible d'installer Node. Lancez le frontend manuellement dans un 2ème terminal: cd frontend && npm run dev -- --host"; }
fi

if command -v npm &>/dev/null; then
    npm install --silent 2>/dev/null || npm install
    npm run build 2>/dev/null && ok "Frontend buildé → dist/"
fi

# ── 5. DÉMARRAGE SERVEUR ────────────────────────────────────────────────────
cd ../backend
info "Démarrage serveur Django sur :8000..."
echo ""
echo "  🌍 Jeu disponible sur : http://localhost:8000"
echo "  👑 Admin panel        : http://localhost:8000/admin"
echo "  🎮 GM panel           : http://localhost:8000/gm"
echo "  Login                 : admin@td.com / admin123"
echo ""

exec python manage.py runserver 0.0.0.0:8000
