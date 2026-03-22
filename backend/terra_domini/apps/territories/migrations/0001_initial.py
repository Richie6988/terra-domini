"""
Migration 0001 — initial Territory ORM sync.
DB was created via raw SQL (ensure_db.py). This migration is a no-op
that tells Django the schema already exists, so subsequent migrations work.
Run with: python manage.py migrate territories --fake-initial
"""
from django.db import migrations


class Migration(migrations.Migration):

    initial = True

    dependencies = [
    ]

    operations = [
        # No-op: table created by ensure_db.py raw SQL.
        # All fields are in sync — verified 2025 Phase 1 audit.
    ]
