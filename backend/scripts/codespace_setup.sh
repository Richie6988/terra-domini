#!/bin/bash
# Terra Domini — Codespace Setup (handles merge conflicts)
set -e
cd /workspaces/terra-domini

echo "🔧 Fixing any merge conflicts..."
# Remove untracked migration files that block pull
rm -f backend/terra_domini/apps/events/migrations/0001_initial.py
rm -f backend/terra_domini/apps/*/migrations/0001_initial.py 2>/dev/null || true

echo "📥 Pulling latest..."
git fetch origin main
git reset --hard origin/main

echo "📦 Installing deps..."
cd backend && source venv/bin/activate

echo "🗄️  Setting up database..."
python manage.py migrate --run-syncdb 2>/dev/null || true

# Check if unified_poi exists and has data
python -c "
import django, os
os.environ['DJANGO_SETTINGS_MODULE'] = 'terra_domini.settings.dev'
django.setup()
from terra_domini.apps.events.unified_poi import UnifiedPOI
n = UnifiedPOI.objects.count()
if n == 0:
    print('Seeding POIs...')
    exec(open('scripts/seed_all_pois_master.py').read())
else:
    print(f'✅ {n:,} POIs ready')
"

echo "🏗️  Building frontend..."
cd ../frontend
PATH="/tmp/node-v20.11.0-linux-x64-musl/bin:\$PATH" /tmp/node-v20.11.0-linux-x64-musl/bin/npm run build 2>/dev/null || echo "Frontend build skipped"

echo ""
echo "✅ Ready! Run: cd backend && bash start.sh"
