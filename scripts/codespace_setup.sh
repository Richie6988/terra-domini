#!/bin/bash
# ─── Terra Domini Codespace Setup ────────────────────────────────────────────
# Run this ONCE after cloning in Codespace:
#   bash scripts/codespace_setup.sh
set -e
echo "🚀 Setting up Terra Domini in Codespace..."

cd /workspaces/terra-domini/backend

# 1. Create venv if not exists
if [ ! -d "venv" ]; then
  python -m venv venv
  echo "✅ venv created"
fi

# Activate
source venv/bin/activate

# 2. Upgrade pip + setuptools first (fixes pkg_resources issue)
pip install --upgrade pip setuptools wheel -q
echo "✅ pip + setuptools upgraded"

# 3. Install minimal requirements (no heavy deps)
pip install -r requirements-codespace.txt -q
echo "✅ Python packages installed"

# 4. Set env
export DJANGO_SETTINGS_MODULE=terra_domini.settings.dev

# 5. Migrate (SQLite — no Docker needed)
python manage.py migrate --noinput
echo "✅ Migrations applied (SQLite)"

# 6. Create superuser
python manage.py shell -c "
from terra_domini.apps.accounts.models import Player
if not Player.objects.filter(email='admin@td.local').exists():
    Player.objects.create_superuser('admin@td.local', 'admin', 'adminpassword123')
    print('✅ admin@td.local created')
else:
    print('ℹ admin@td.local exists')
"

# 7. Seed data
python scripts/seed_dev.py
echo "✅ Seed data loaded"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Setup complete!"
echo ""
echo "  Start backend:  source venv/bin/activate && python manage.py runserver"
echo "  API docs:       http://localhost:8000/api/docs/"
echo "  Admin:          http://localhost:8000/admin/"
echo "  Health:         http://localhost:8000/health/"
echo ""
echo "  Login:  alice@td.local / testpassword123"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
