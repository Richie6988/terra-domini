"""
Idempotent migration for PendingClaim, SafariTarget, SafariCapture.
Uses CREATE TABLE IF NOT EXISTS for safety.
"""
import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


CREATE_SQL = """
CREATE TABLE IF NOT EXISTS pending_claim (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    h3_index VARCHAR(24) NOT NULL,
    method VARCHAR(12) NOT NULL,
    status VARCHAR(12) NOT NULL DEFAULT 'in_progress',
    started_at DATETIME NOT NULL,
    hours_required REAL NOT NULL DEFAULT 1.0,
    completed_at DATETIME,
    is_adjacent BOOL NOT NULL DEFAULT 0,
    territory_name VARCHAR(120) NOT NULL DEFAULT '',
    player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    territory_id CHAR(32) REFERENCES territories(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS pending_claim_player_status_idx ON pending_claim(player_id, status);
CREATE INDEX IF NOT EXISTS pending_claim_h3_status_idx ON pending_claim(h3_index, status);

CREATE TABLE IF NOT EXISTS safari_targets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    creature_id VARCHAR(30) NOT NULL,
    creature_name VARCHAR(100) NOT NULL,
    rarity VARCHAR(20) NOT NULL DEFAULT 'common',
    hex_reward INTEGER NOT NULL DEFAULT 100,
    target_lat REAL NOT NULL,
    target_lon REAL NOT NULL,
    target_h3 VARCHAR(24) NOT NULL DEFAULT '',
    hint TEXT NOT NULL DEFAULT '',
    status VARCHAR(12) NOT NULL DEFAULT 'active',
    assigned_at DATETIME NOT NULL,
    player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS safari_targets_player_idx ON safari_targets(player_id);

CREATE TABLE IF NOT EXISTS safari_captures (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    creature_id VARCHAR(30) NOT NULL,
    creature_name VARCHAR(100) NOT NULL,
    rarity VARCHAR(20) NOT NULL,
    hex_earned INTEGER NOT NULL DEFAULT 0,
    captured_at DATETIME NOT NULL,
    capture_lat REAL,
    capture_lon REAL,
    player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS safari_captures_player_idx ON safari_captures(player_id);
"""

REVERSE_SQL = """
DROP TABLE IF EXISTS safari_captures;
DROP TABLE IF EXISTS safari_targets;
DROP TABLE IF EXISTS pending_claim;
"""


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('territories', '0001_initial'),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            database_operations=[
                migrations.RunSQL(CREATE_SQL, REVERSE_SQL),
            ],
            state_operations=[
                migrations.CreateModel(
                    name='PendingClaim',
                    fields=[
                        ('id', models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                        ('h3_index', models.CharField(max_length=24)),
                        ('method', models.CharField(choices=[('explore', 'Exploration'), ('attack', 'Military Attack'), ('buy', 'Purchase')], max_length=12)),
                        ('status', models.CharField(choices=[('in_progress', 'In Progress'), ('completed', 'Completed'), ('cancelled', 'Cancelled'), ('failed', 'Failed')], default='in_progress', max_length=12)),
                        ('started_at', models.DateTimeField(auto_now_add=True)),
                        ('hours_required', models.FloatField(default=1.0)),
                        ('completed_at', models.DateTimeField(blank=True, null=True)),
                        ('is_adjacent', models.BooleanField(default=False)),
                        ('territory_name', models.CharField(blank=True, max_length=120)),
                        ('player', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='pending_claims', to=settings.AUTH_USER_MODEL)),
                        ('territory', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, to='territories.territory')),
                    ],
                    options={
                        'db_table': 'pending_claim',
                        'ordering': ['-started_at'],
                    },
                ),
                migrations.CreateModel(
                    name='SafariTarget',
                    fields=[
                        ('id', models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                        ('creature_id', models.CharField(max_length=30)),
                        ('creature_name', models.CharField(max_length=100)),
                        ('rarity', models.CharField(default='common', max_length=20)),
                        ('hex_reward', models.IntegerField(default=100)),
                        ('target_lat', models.FloatField()),
                        ('target_lon', models.FloatField()),
                        ('target_h3', models.CharField(blank=True, max_length=24)),
                        ('hint', models.TextField(blank=True)),
                        ('status', models.CharField(choices=[('active', 'Active'), ('captured', 'Captured'), ('expired', 'Expired')], default='active', max_length=12)),
                        ('assigned_at', models.DateTimeField(auto_now_add=True)),
                        ('player', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='safari_targets', to=settings.AUTH_USER_MODEL)),
                    ],
                    options={
                        'db_table': 'safari_targets',
                        'ordering': ['-assigned_at'],
                    },
                ),
                migrations.CreateModel(
                    name='SafariCapture',
                    fields=[
                        ('id', models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                        ('creature_id', models.CharField(max_length=30)),
                        ('creature_name', models.CharField(max_length=100)),
                        ('rarity', models.CharField(max_length=20)),
                        ('hex_earned', models.IntegerField(default=0)),
                        ('captured_at', models.DateTimeField(auto_now_add=True)),
                        ('capture_lat', models.FloatField(null=True)),
                        ('capture_lon', models.FloatField(null=True)),
                        ('player', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='safari_captures', to=settings.AUTH_USER_MODEL)),
                    ],
                    options={
                        'db_table': 'safari_captures',
                        'ordering': ['-captured_at'],
                    },
                ),
            ],
        ),
    ]
