"""
Idempotent migration for NewsEvent + NewsEventRegistration.
Uses CREATE TABLE IF NOT EXISTS for safety.
"""
import django.db.models.deletion
import uuid
from django.conf import settings
from django.db import migrations, models


CREATE_SQL = """
CREATE TABLE IF NOT EXISTS news_events (
    id CHAR(32) PRIMARY KEY,
    source_url VARCHAR(512) NOT NULL UNIQUE,
    source_name VARCHAR(100) NOT NULL DEFAULT '',
    headline VARCHAR(300) NOT NULL,
    summary TEXT NOT NULL DEFAULT '',
    image_url VARCHAR(512) NOT NULL DEFAULT '',
    published_at DATETIME NOT NULL,
    location_name VARCHAR(200) NOT NULL DEFAULT 'GLOBAL',
    latitude REAL NOT NULL DEFAULT 0.0,
    longitude REAL NOT NULL DEFAULT 0.0,
    country_code VARCHAR(3) NOT NULL DEFAULT '',
    hexod_category VARCHAR(30) NOT NULL DEFAULT 'news',
    rarity VARCHAR(12) NOT NULL DEFAULT 'rare',
    status VARCHAR(12) NOT NULL DEFAULT 'live',
    hex_reward INTEGER NOT NULL DEFAULT 50,
    max_participants INTEGER NOT NULL DEFAULT 500,
    registration_cost INTEGER NOT NULL DEFAULT 25,
    starts_at DATETIME NOT NULL,
    ends_at DATETIME NOT NULL,
    created_at DATETIME NOT NULL
);

CREATE TABLE IF NOT EXISTS news_event_registrations (
    id CHAR(32) PRIMARY KEY,
    registered_at DATETIME NOT NULL,
    result VARCHAR(10) NOT NULL DEFAULT 'pending',
    hex_earned INTEGER NOT NULL DEFAULT 0,
    token_serial INTEGER,
    luck_bonus INTEGER NOT NULL DEFAULT 0,
    event_id CHAR(32) NOT NULL REFERENCES news_events(id) ON DELETE CASCADE,
    player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    UNIQUE (event_id, player_id)
);
CREATE INDEX IF NOT EXISTS news_event_reg_event_id_idx ON news_event_registrations(event_id);
CREATE INDEX IF NOT EXISTS news_event_reg_player_id_idx ON news_event_registrations(player_id);
"""

REVERSE_SQL = """
DROP TABLE IF EXISTS news_event_registrations;
DROP TABLE IF EXISTS news_events;
"""


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('events', '0001_initial'),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            database_operations=[
                migrations.RunSQL(CREATE_SQL, REVERSE_SQL),
            ],
            state_operations=[
                migrations.CreateModel(
                    name='NewsEvent',
                    fields=[
                        ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                        ('source_url', models.URLField(max_length=512, unique=True)),
                        ('source_name', models.CharField(default='', max_length=100)),
                        ('headline', models.CharField(max_length=300)),
                        ('summary', models.TextField(default='')),
                        ('image_url', models.URLField(blank=True, default='', max_length=512)),
                        ('published_at', models.DateTimeField()),
                        ('location_name', models.CharField(default='GLOBAL', max_length=200)),
                        ('latitude', models.FloatField(default=0.0)),
                        ('longitude', models.FloatField(default=0.0)),
                        ('country_code', models.CharField(default='', max_length=3)),
                        ('hexod_category', models.CharField(default='news', max_length=30)),
                        ('rarity', models.CharField(choices=[('common', 'Common'), ('uncommon', 'Uncommon'), ('rare', 'Rare'), ('epic', 'Epic'), ('legendary', 'Legendary'), ('mythic', 'Mythic')], default='rare', max_length=12)),
                        ('status', models.CharField(choices=[('live', 'Live'), ('upcoming', 'Upcoming'), ('ended', 'Ended'), ('expired', 'Expired')], default='live', max_length=12)),
                        ('hex_reward', models.IntegerField(default=50)),
                        ('max_participants', models.IntegerField(default=500)),
                        ('registration_cost', models.IntegerField(default=25)),
                        ('starts_at', models.DateTimeField()),
                        ('ends_at', models.DateTimeField()),
                        ('created_at', models.DateTimeField(auto_now_add=True)),
                    ],
                    options={
                        'db_table': 'news_events',
                        'ordering': ['-starts_at'],
                    },
                ),
                migrations.CreateModel(
                    name='NewsEventRegistration',
                    fields=[
                        ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                        ('registered_at', models.DateTimeField(auto_now_add=True)),
                        ('result', models.CharField(choices=[('pending', 'Pending'), ('won', 'Won'), ('lost', 'Lost')], default='pending', max_length=10)),
                        ('hex_earned', models.IntegerField(default=0)),
                        ('token_serial', models.IntegerField(blank=True, null=True)),
                        ('luck_bonus', models.IntegerField(default=0)),
                        ('event', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='registrations', to='events.newsevent')),
                        ('player', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='event_registrations', to=settings.AUTH_USER_MODEL)),
                    ],
                    options={
                        'db_table': 'news_event_registrations',
                        'unique_together': {('event', 'player')},
                    },
                ),
            ],
        ),
    ]
