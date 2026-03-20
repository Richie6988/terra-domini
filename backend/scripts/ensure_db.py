#!/usr/bin/env python3
"""Terra Domini — Ensure all DB tables exist. Runs at startup."""
import os, sys, django, sqlite3
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'terra_domini.settings.dev')
os.environ.setdefault('DJANGO_SECRET_KEY', 'dev-secret-key-not-for-production')
django.setup()

from django.db import connection
from django.core.management import call_command
import io

def get_tables():
    with connection.cursor() as c:
        c.execute("SELECT name FROM sqlite_master WHERE type='table'")
        return {r[0] for r in c.fetchall()}

tables = get_tables()

# 1. Run syncdb to get Django + third-party tables
if 'token_blacklist_blacklistedtoken' not in tables or 'unified_poi' not in tables:
    print("⚡ Running migrate --run-syncdb...")
    call_command('migrate', '--run-syncdb', stdout=io.StringIO(), verbosity=0)
    tables = get_tables()

# 2. Create game app tables if missing (accounts, territories, etc.)
GAME_SQL = [
    ('players', """CREATE TABLE IF NOT EXISTS players (
    id TEXT PRIMARY KEY, password TEXT NOT NULL DEFAULT '',
    last_login DATETIME, is_superuser INTEGER DEFAULT 0,
    email TEXT UNIQUE NOT NULL, username TEXT UNIQUE NOT NULL,
    display_name TEXT DEFAULT '', avatar_emoji TEXT DEFAULT '🎖️',
    bio TEXT DEFAULT '', avatar_url TEXT DEFAULT '',
    is_active INTEGER DEFAULT 1, is_staff INTEGER DEFAULT 0,
    date_joined DATETIME DEFAULT CURRENT_TIMESTAMP, email_verified INTEGER DEFAULT 0,
    commander_rank INTEGER DEFAULT 1, commander_xp INTEGER DEFAULT 0,
    spec_path TEXT DEFAULT 'military', wallet_address TEXT DEFAULT '',
    tdc_in_game REAL DEFAULT 0, total_tdc_purchased REAL DEFAULT 0,
    total_tdc_spent REAL DEFAULT 0, total_tdc_earned_ads REAL DEFAULT 0,
    action_slots_max INTEGER DEFAULT 3, action_slots_used INTEGER DEFAULT 0,
    last_slot_regen_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    regen_bonus_pct REAL DEFAULT 0, attack_power_bonus REAL DEFAULT 0,
    ban_status TEXT DEFAULT 'none', ban_reason TEXT DEFAULT '', ban_until DATETIME,
    anticheat_score REAL DEFAULT 0, last_active DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_ip TEXT DEFAULT '', total_playtime_seconds INTEGER DEFAULT 0,
    is_online INTEGER DEFAULT 0, shield_until DATETIME,
    beginner_protection_until DATETIME, daily_shield_hours_used REAL DEFAULT 0,
    shield_reset_date DATETIME, preferred_language TEXT DEFAULT 'en',
    notifications_enabled INTEGER DEFAULT 1, push_token TEXT DEFAULT '',
    tutorial_completed INTEGER DEFAULT 0, is_bot INTEGER DEFAULT 0,
    territories_owned INTEGER DEFAULT 0, max_territories_owned INTEGER DEFAULT 10,
    territories_captured INTEGER DEFAULT 0, territories_lost INTEGER DEFAULT 0,
    battles_fought INTEGER DEFAULT 0, battles_won INTEGER DEFAULT 0,
    battles_lost INTEGER DEFAULT 0, units_killed INTEGER DEFAULT 0,
    units_lost INTEGER DEFAULT 0, resources_produced REAL DEFAULT 0,
    resources_traded REAL DEFAULT 0, alliances_formed INTEGER DEFAULT 0,
    diplomacy_actions INTEGER DEFAULT 0, season_score INTEGER DEFAULT 0,
    season_rank INTEGER DEFAULT 0, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    fingerprint TEXT DEFAULT '', platform TEXT DEFAULT 'web', referred_by_id TEXT)"""),
    ('players_groups', "CREATE TABLE IF NOT EXISTS players_groups (id INTEGER PRIMARY KEY, player_id INTEGER, group_id INTEGER)"),
    ('players_user_permissions', "CREATE TABLE IF NOT EXISTS players_user_permissions (id INTEGER PRIMARY KEY, player_id INTEGER, permission_id INTEGER)"),
    ('territories_territory', """CREATE TABLE IF NOT EXISTS territories_territory (
        id TEXT PRIMARY KEY, h3_index TEXT UNIQUE NOT NULL,
        h3_resolution INTEGER DEFAULT 7, center_lat REAL, center_lon REAL,
        country_code TEXT DEFAULT \'\', place_name TEXT DEFAULT \'\',
        territory_type TEXT DEFAULT \'rural\', owner_id INTEGER,
        defense_tier INTEGER DEFAULT 1, defense_points REAL DEFAULT 100.0,
        resource_type TEXT DEFAULT \'credits\', rarity TEXT DEFAULT \'common\',
        biome TEXT DEFAULT \'grassland\', tdc_per_day REAL DEFAULT 10.0,
        poi_name TEXT DEFAULT \'\', poi_wiki_url TEXT DEFAULT \'\',
        is_shiny INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP)"""),
    ('economy_wallet', """CREATE TABLE IF NOT EXISTS economy_wallet (
        id TEXT PRIMARY KEY, player_id INTEGER UNIQUE NOT NULL,
        tdc_balance REAL DEFAULT 0.0, tdi_balance REAL DEFAULT 0.0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP)"""),
    ('alliances_alliance', """CREATE TABLE IF NOT EXISTS alliances_alliance (
        id TEXT PRIMARY KEY, name TEXT UNIQUE NOT NULL, tag TEXT UNIQUE NOT NULL,
        description TEXT DEFAULT \'\', leader_id INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP)"""),
    ('combat_battle', "CREATE TABLE IF NOT EXISTS combat_battle (id TEXT PRIMARY KEY, attacker_id INTEGER, defender_id INTEGER, territory_id TEXT, result TEXT DEFAULT \'pending\', created_at DATETIME DEFAULT CURRENT_TIMESTAMP)"),
    ('progression_achievement', "CREATE TABLE IF NOT EXISTS progression_achievement (id TEXT PRIMARY KEY, player_id INTEGER NOT NULL, achievement_type TEXT NOT NULL, unlocked_at DATETIME DEFAULT CURRENT_TIMESTAMP)"),
    ('social_message', "CREATE TABLE IF NOT EXISTS social_message (id TEXT PRIMARY KEY, sender_id INTEGER, content TEXT DEFAULT \'\', created_at DATETIME DEFAULT CURRENT_TIMESTAMP)"),
]

with connection.cursor() as cur:
    for tname, sql in GAME_SQL:
        if tname not in tables:
            cur.execute(sql)

tables = get_tables()

# 3. Seed POIs if empty
from terra_domini.apps.events.unified_poi import UnifiedPOI
n = UnifiedPOI.objects.count()
if n == 0:
    print("🌍 Seeding 1,102 POIs...")
    seed = os.path.join(os.path.dirname(__file__), 'seed_all_pois_master.py')
    if os.path.exists(seed):
        exec(open(seed).read())
    n = UnifiedPOI.objects.count()

print(f"✅ DB OK — {n:,} POIs, {len(tables)} tables ready")
