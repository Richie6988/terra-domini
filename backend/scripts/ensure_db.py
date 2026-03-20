#!/usr/bin/env python3
"""
Terra Domini — Ensure DB has all tables.
Runs on every startup. Fast (checks first, skips if already done).
"""
import os, sys, django
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'terra_domini.settings.dev')
os.environ.setdefault('DJANGO_SECRET_KEY', 'dev-secret-key-not-for-production')
django.setup()

from django.db import connection
from django.core.management import call_command
import io

tables = connection.introspection.table_names()

if 'unified_poi' not in tables:
    print("⚡ unified_poi missing — running migrations...")
    out = io.StringIO()
    call_command('migrate', '--run-syncdb', stdout=out, verbosity=0)
    
    # Now seed
    from terra_domini.apps.events.unified_poi import UnifiedPOI
    if UnifiedPOI.objects.count() == 0:
        print("🌍 Seeding POIs...")
        seed_path = os.path.join(os.path.dirname(__file__), 'seed_all_pois_master.py')
        exec(open(seed_path).read())
    
    tables = connection.introspection.table_names()
    print(f"✅ DB ready: {len(tables)} tables")
else:
    from terra_domini.apps.events.unified_poi import UnifiedPOI
    n = UnifiedPOI.objects.count()
    if n == 0:
        print("🌍 Table exists but empty — seeding...")
        seed_path = os.path.join(os.path.dirname(__file__), 'seed_all_pois_master.py')
        exec(open(seed_path).read())
    else:
        print(f"✅ DB OK — {n:,} POIs ready")
