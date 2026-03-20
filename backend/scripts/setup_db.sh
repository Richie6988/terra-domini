#!/bin/bash
# Terra Domini — One-command DB setup
# Run: cd backend && bash scripts/setup_db.sh

set -e
echo "🌍 Terra Domini DB Setup"
echo "========================"
cd "$(dirname "$0")/.."

# 1. Run all migrations
echo ""
echo "📦 Running migrations..."
python manage.py migrate --run-syncdb 2>&1 | grep -E "(Apply|Create|OK|Error|Warning)" | head -20

# 2. Verify unified_poi table exists
python -c "
import django, os
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'terra_domini.settings.dev')
django.setup()
from django.db import connection
tables = connection.introspection.table_names()
if 'unified_poi' in tables:
    print('✅ unified_poi table exists')
else:
    print('❌ unified_poi table MISSING — running syncdb...')
    from django.core.management import call_command
    call_command('migrate', '--run-syncdb')
"

# 3. Seed POIs
echo ""
echo "🗺️  Seeding 1102 POIs..."
python scripts/seed_all_pois_master.py

echo ""
echo "✅ Setup complete!"
python -c "
import django, os
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'terra_domini.settings.dev')
django.setup()
from terra_domini.apps.events.unified_poi import UnifiedPOI
total = UnifiedPOI.objects.count()
print(f'   POIs in DB: {total:,}')
from collections import Counter
rar = Counter(UnifiedPOI.objects.values_list('rarity', flat=True))
for r, n in sorted(rar.items()): print(f'   {r}: {n}')
"
