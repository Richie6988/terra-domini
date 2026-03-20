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

def _fix_token_tables(connection):
    """Ensure token tables reference players not auth_user."""
    with connection.cursor() as c:
        c.execute("SELECT sql FROM sqlite_master WHERE name='token_blacklist_outstandingtoken'")
        row = c.fetchone()
        if row and 'auth_user' in (row[0] or ''):
            c.execute("PRAGMA foreign_keys = OFF")
            c.execute("DROP TABLE IF EXISTS token_blacklist_blacklistedtoken")
            c.execute("DROP TABLE IF EXISTS token_blacklist_outstandingtoken")
            c.execute("""CREATE TABLE token_blacklist_outstandingtoken (
                id INTEGER PRIMARY KEY AUTOINCREMENT, token TEXT NOT NULL,
                jti VARCHAR(255) NOT NULL UNIQUE, created_at DATETIME,
                expires_at DATETIME NOT NULL,
                user_id TEXT REFERENCES players(id) DEFERRABLE INITIALLY DEFERRED)""")
            c.execute("""CREATE TABLE token_blacklist_blacklistedtoken (
                id INTEGER PRIMARY KEY AUTOINCREMENT, blacklisted_at DATETIME NOT NULL,
                token_id INTEGER NOT NULL UNIQUE
                    REFERENCES token_blacklist_outstandingtoken(id))""")
            c.execute("PRAGMA foreign_keys = ON")

def get_tables():
    with connection.cursor() as c:
        c.execute("SELECT name FROM sqlite_master WHERE type='table'")
        return {r[0] for r in c.fetchall()}

_fix_token_tables(connection)
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
    ('territories', """CREATE TABLE IF NOT EXISTS territories (
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
    ('token_blacklist_outstandingtoken_v2', """CREATE TABLE IF NOT EXISTS token_blacklist_outstandingtoken (
    id INTEGER PRIMARY KEY AUTOINCREMENT, token TEXT NOT NULL,
    jti VARCHAR(255) NOT NULL UNIQUE, created_at DATETIME, expires_at DATETIME NOT NULL,
    user_id TEXT REFERENCES players(id) DEFERRABLE INITIALLY DEFERRED)"""),
    ('token_blacklist_blacklistedtoken_v2', """CREATE TABLE IF NOT EXISTS token_blacklist_blacklistedtoken (
    id INTEGER PRIMARY KEY AUTOINCREMENT, blacklisted_at DATETIME NOT NULL,
    token_id INTEGER NOT NULL UNIQUE REFERENCES token_blacklist_outstandingtoken(id))"""),
    ('combat_battle', "CREATE TABLE IF NOT EXISTS combat_battle (id TEXT PRIMARY KEY, attacker_id INTEGER, defender_id INTEGER, territory_id TEXT, result TEXT DEFAULT \'pending\', created_at DATETIME DEFAULT CURRENT_TIMESTAMP)"),
    ('progression_achievement', "CREATE TABLE IF NOT EXISTS progression_achievement (id TEXT PRIMARY KEY, player_id INTEGER NOT NULL, achievement_type TEXT NOT NULL, unlocked_at DATETIME DEFAULT CURRENT_TIMESTAMP)"),
        ('map_overlay_event', """CREATE TABLE IF NOT EXISTS map_overlay_event (
    id INTEGER PRIMARY KEY AUTOINCREMENT, event_type VARCHAR(20) NOT NULL DEFAULT 'news_pin',
    player_id TEXT REFERENCES players(id) ON DELETE SET NULL,
    territory_id TEXT REFERENCES territories(id) ON DELETE SET NULL,
    from_lat REAL, from_lon REAL, to_lat REAL, to_lon REAL,
    title TEXT NOT NULL DEFAULT '', body TEXT DEFAULT '',
    icon_emoji TEXT DEFAULT '📍', icon_3d TEXT DEFAULT '',
    payload TEXT DEFAULT '{}', is_active INTEGER DEFAULT 1,
    starts_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)"""),
    ('combat_battle', """CREATE TABLE IF NOT EXISTS combat_battle (
    id TEXT PRIMARY KEY, attacker_id TEXT REFERENCES players(id) ON DELETE SET NULL,
    defender_id TEXT REFERENCES players(id) ON DELETE SET NULL,
    territory_id TEXT REFERENCES territories_territory(id) ON DELETE SET NULL,
    result TEXT DEFAULT 'pending', attacker_units INTEGER DEFAULT 0,
    defender_units INTEGER DEFAULT 0, tdc_loot REAL DEFAULT 0,
    started_at DATETIME DEFAULT CURRENT_TIMESTAMP, ended_at DATETIME)"""),
    ('progression_player_stats', """CREATE TABLE IF NOT EXISTS progression_player_stats (
    id TEXT PRIMARY KEY, player_id TEXT UNIQUE REFERENCES players(id) ON DELETE CASCADE,
    total_logins INTEGER DEFAULT 0, longest_streak INTEGER DEFAULT 0,
    current_streak INTEGER DEFAULT 0, last_login_date DATE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP)"""),
    ('economy_shop_item', """CREATE TABLE IF NOT EXISTS economy_shop_item (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT DEFAULT '',
    price_tdc REAL DEFAULT 0, price_tdi REAL DEFAULT 0,
    item_type TEXT DEFAULT 'boost', is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP)"""),
    ('territory_customization', """CREATE TABLE IF NOT EXISTS territory_customization (
    id TEXT PRIMARY KEY, territory_id TEXT UNIQUE REFERENCES territories(id) ON DELETE CASCADE,
    custom_name TEXT DEFAULT '', emoji TEXT DEFAULT '', border_color TEXT DEFAULT '#6B7280',
    image_url TEXT DEFAULT '', video_url TEXT DEFAULT '', stream_url TEXT DEFAULT '',
    description TEXT DEFAULT '', updated_at DATETIME DEFAULT CURRENT_TIMESTAMP)"""),
    ('territory_cluster', """CREATE TABLE IF NOT EXISTS territory_cluster (
    id TEXT PRIMARY KEY, owner_id TEXT REFERENCES players(id) ON DELETE CASCADE,
    h3_indexes TEXT DEFAULT '[]', size INTEGER DEFAULT 1, tier INTEGER DEFAULT 0,
    tdc_per_24h REAL DEFAULT 5.0, created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP)"""),
    ('blockchain_transaction', """CREATE TABLE IF NOT EXISTS blockchain_transaction (
    id TEXT PRIMARY KEY, player_id TEXT REFERENCES players(id),
    tx_hash TEXT DEFAULT '', amount REAL DEFAULT 0,
    tx_type TEXT DEFAULT 'purchase', status TEXT DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP)"""),
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

# Create default admin user if no players exist
from terra_domini.apps.accounts.models import Player
if not Player.objects.filter(email='admin@td.com').exists():
    try:
        Player.objects.create_superuser(
            email='admin@td.com', username='admin', password='admin123'
        )
        print("   👤 Admin created: admin@td.com / admin123")
    except Exception as e:
        pass

print(f"✅ DB OK — {n:,} POIs, {len(tables)} tables ready")
