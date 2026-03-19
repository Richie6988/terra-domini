#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# Terra Domini — Codespace Setup Script
# Run: bash SETUP.sh
# ─────────────────────────────────────────────────────────────────────────────
set -e
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
ok()   { echo -e "${GREEN}✅ $1${NC}"; }
warn() { echo -e "${YELLOW}⚠️  $1${NC}"; }
err()  { echo -e "${RED}❌ $1${NC}"; exit 1; }

echo ""
echo "╔═══════════════════════════════════╗"
echo "║  Terra Domini — Dev Setup         ║"
echo "╚═══════════════════════════════════╝"
echo ""

# ─── Pull latest code ────────────────────────────────────────────────────────
echo "📥 Pulling latest code..."
git pull origin main || warn "git pull failed — continuing with current code"

# ─── Navigate to backend ─────────────────────────────────────────────────────
cd "$(dirname "$0")/backend"
ok "In backend dir: $(pwd)"

# ─── Python venv ─────────────────────────────────────────────────────────────
if [ ! -d "venv" ]; then
  echo "🐍 Creating Python venv..."
  python3 -m venv venv
fi
source venv/bin/activate
ok "venv activated"

# ─── CRITICAL: fix pkg_resources BEFORE anything else ────────────────────────
echo "🔧 Upgrading setuptools + pip (fixes shapely/pkg_resources)..."
pip install --upgrade setuptools pip --quiet
ok "setuptools + pip upgraded"

# ─── Shapely (pre-built wheel, no compilation) ───────────────────────────────
echo "🗺️  Installing shapely (pre-built wheel)..."
pip install "shapely>=2.1.0" --quiet
ok "shapely installed"

# ─── Install remaining deps ───────────────────────────────────────────────────
echo "📦 Installing requirements..."
pip install -r requirements.txt --quiet 2>&1 | tail -5
ok "requirements installed"

# ─── Environment ─────────────────────────────────────────────────────────────
export DJANGO_SETTINGS_MODULE=terra_domini.settings.dev
export DJANGO_SECRET_KEY=dev-secret-key-codespace-$(date +%s)
export POSTGRES_PASSWORD=devpassword123
export POSTGRES_HOST=localhost
export REDIS_HOST=localhost
export CELERY_BROKER_URL=memory://
export CELERY_TASK_ALWAYS_EAGER=True
export KAFKA_BOOTSTRAP_SERVERS=localhost:9092
export BLOCKCHAIN_RPC_URL=http://localhost:8545
export TDC_CONTRACT_ADDRESS=0x5FbDB2315678afecb367f032d93F642f64180aa3
export TDC_TREASURY_ADDRESS=0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
export TDC_TREASURY_PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
export TDC_EUR_RATE=100
export TDC_MIN_WITHDRAWAL=50
export STRIPE_SECRET_KEY=sk_test_placeholder
export STRIPE_WEBHOOK_SECRET=whsec_placeholder
ok "env vars set"

# ─── Django check ────────────────────────────────────────────────────────────
echo "🔍 Running Django checks..."
python manage.py check 2>&1
if python manage.py check --quiet 2>/dev/null; then
  ok "Django system check passed"
else
  warn "Django check returned warnings — check output above"
fi

# ─── Database ─────────────────────────────────────────────────────────────────
# Try postgres first, fall back to SQLite for Codespace without Docker
if python -c "import psycopg2; import socket; socket.create_connection(('localhost',5432), 2)" 2>/dev/null; then
  ok "PostgreSQL found — running migrations"
  python manage.py migrate --noinput
  python manage.py shell -c "
from django.contrib.auth import get_user_model
U = get_user_model()
if not U.objects.filter(email='admin@td.local').exists():
    U.objects.create_superuser('admin@td.local', 'admin', 'adminpassword123')
    print('Superuser created')
else:
    print('Superuser exists')
"
  ok "Migrations complete"
  
  # Seed dev data
  echo "🌱 Seeding test data..."
  python ../scripts/seed_dev.py 2>&1 | tail -10 || warn "Seed failed — run manually later"
  
else
  warn "PostgreSQL not found — using SQLite for local testing"
  
  # Patch settings to use SQLite
  export DJANGO_SETTINGS_MODULE=terra_domini.settings.dev
  python -c "
import os, django
os.environ['DJANGO_SETTINGS_MODULE'] = 'terra_domini.settings.dev'

# Quick SQLite override
from django.conf import settings
settings.DATABASES['default'] = {
    'ENGINE': 'django.db.backends.sqlite3',
    'NAME': '/tmp/terradomini_dev.db',
}
" 2>/dev/null || true

  # Try migrations with SQLite
  python manage.py migrate --noinput 2>/dev/null || warn "Migrations skipped (DB not ready)"
fi

echo ""
echo "╔═══════════════════════════════════════╗"
echo "║  ✅ Setup complete!                    ║"
echo "╚═══════════════════════════════════════╝"
echo ""
echo "🚀 To start the server:"
echo "   source venv/bin/activate"
echo "   export DJANGO_SETTINGS_MODULE=terra_domini.settings.dev"
echo "   export DJANGO_SECRET_KEY=dev-key"
echo "   export POSTGRES_PASSWORD=devpassword123"
echo "   python manage.py runserver 0.0.0.0:8000"
echo ""
echo "🌐 API docs: http://localhost:8000/api/docs/"
echo "🔧 Admin:    http://localhost:8000/admin/"
echo "💚 Health:   http://localhost:8000/health/"
echo ""
echo "📱 Frontend:"
echo "   cd frontend && npm install && npm run dev"
echo ""
echo "Test accounts:"
echo "  alice@td.local / testpassword123"
echo "  admin@td.local / adminpassword123"
