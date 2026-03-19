"""
Dev seed script — populates the DB with test data for local development.
Run: docker compose exec web python scripts/seed_dev.py
"""
import os
import sys
import django

sys.path.insert(0, '/app')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'terra_domini.settings.dev')
django.setup()

from django.utils import timezone
from datetime import timedelta
import h3

print("🌱 Seeding Terra Domini dev data…")

# ─── Players ─────────────────────────────────────────────────────────────────
from terra_domini.apps.accounts.models import Player, PlayerStats

players_data = [
    {'email': 'alice@td.local', 'username': 'AliceGeneral', 'rank': 15, 'tdc': 5000},
    {'email': 'bob@td.local',   'username': 'BobMarshal',   'rank': 8,  'tdc': 1200},
    {'email': 'charlie@td.local','username': 'CharlieScout','rank': 3,  'tdc': 200},
]

players = []
for pd in players_data:
    p, created = Player.objects.get_or_create(
        email=pd['email'],
        defaults={
            'username': pd['username'],
            'display_name': pd['username'],
            'commander_rank': pd['rank'],
            'tdc_in_game': pd['tdc'],
            'is_active': True,
            'email_verified': True,
        }
    )
    if created:
        p.set_password('testpassword123')
        p.save()
        PlayerStats.objects.get_or_create(player=p)
        print(f"  ✅ Player: {p.username}")
    else:
        print(f"  ⏭️  Player exists: {p.username}")
    players.append(p)

# ─── Alliance ─────────────────────────────────────────────────────────────────
from terra_domini.apps.alliances.models import Alliance, AllianceMember

alice = players[0]
bob = players[1]

alliance, created = Alliance.objects.get_or_create(
    tag='TERRA',
    defaults={
        'name': 'Terra Dominators',
        'description': 'Dev test alliance',
        'tier': Alliance.AllianceTier.GUILD,
        'leader': alice,
        'banner_color': '#10B981',
        'is_recruiting': True,
    }
)
if created:
    AllianceMember.objects.get_or_create(player=alice, defaults={'alliance': alliance, 'role': AllianceMember.Role.LEADER})
    AllianceMember.objects.get_or_create(player=bob,   defaults={'alliance': alliance, 'role': AllianceMember.Role.MEMBER})
    print(f"  ✅ Alliance: [{alliance.tag}] {alliance.name}")
else:
    print(f"  ⏭️  Alliance exists: {alliance.name}")

# ─── Territories (small area around Paris center) ─────────────────────────────
from terra_domini.apps.territories.models import Territory
from terra_domini.apps.territories.engine import TerritoryEngine

# Paris center H3 cells
center_h3 = h3.geo_to_h3(48.8566, 2.3522, 10)  # Notre Dame
test_hexes = list(h3.k_ring(center_h3, 5))       # ~91 hexes

TYPES = ['urban', 'rural', 'industrial', 'coastal', 'landmark', 'forest', 'mountain']
BASE_PROD = {
    'urban':      (20, 5,  30, 15, 8,  5),
    'rural':      (5,  40, 5,  5,  15, 2),
    'industrial': (30, 2,  20, 2,  40, 5),
    'coastal':    (10, 25, 25, 10, 10, 15),
    'landmark':   (10, 5,  50, 60, 5,  8),
    'forest':     (5,  20, 5,  15, 25, 10),
    'mountain':   (15, 5,  8,  8,  30, 20),
}

created_count = 0
for i, h3_idx in enumerate(test_hexes):
    t_type = TYPES[i % len(TYPES)]
    prod = BASE_PROD[t_type]

    # Assign owners to first 20 hexes
    owner = None
    if i < 8:
        owner = alice
    elif i < 15:
        owner = bob

    # One control tower
    is_tower = (i == 0)

    t, created = Territory.objects.get_or_create(
        h3_index=h3_idx,
        defaults={
            'h3_resolution': 10,
            'territory_type': t_type,
            'country_code': 'FR',
            'region_name': 'Île-de-France',
            'place_name': f'Hex {h3_idx[:8]}',
            'owner': owner,
            'alliance': alliance if owner else None,
            'captured_at': timezone.now() if owner else None,
            'defense_tier': 2 if owner else 1,
            'defense_points': 200 if owner else 100,
            'max_defense_points': 200 if owner else 100,
            'resource_energy': prod[0], 'resource_food': prod[1],
            'resource_credits': prod[2], 'resource_culture': prod[3],
            'resource_materials': prod[4], 'resource_intel': prod[5],
            'stockpile_energy': prod[0] * 10, 'stockpile_food': prod[1] * 10,
            'stockpile_credits': prod[2] * 10, 'stockpile_culture': prod[3] * 10,
            'stockpile_materials': prod[4] * 10, 'stockpile_intel': prod[5] * 10,
            'stockpile_capacity': 2000.0,
            'is_control_tower': is_tower,
            'control_tower_type': 'market' if is_tower else '',
            'is_landmark': is_tower,
            'landmark_name': 'Notre Dame de Paris' if is_tower else '',
            'terrain_attack_modifier': 0.8 if t_type == 'urban' else 1.0,
            'terrain_defense_modifier': 1.3 if t_type == 'urban' else 1.0,
            'terrain_movement_cost': 1.0,
            'ad_slot_enabled': is_tower,
            'daily_viewer_count': 500 if is_tower else 0,
        }
    )
    if created:
        created_count += 1
        TerritoryEngine.set_territory_state_cache(t)

print(f"  ✅ Territories: {created_count} created, {len(test_hexes) - created_count} existed")

# Update alice stats
from terra_domini.apps.accounts.models import PlayerStats
PlayerStats.objects.filter(player=alice).update(territories_owned=8)
PlayerStats.objects.filter(player=bob).update(territories_owned=7)

# ─── Shop items ───────────────────────────────────────────────────────────────
from terra_domini.apps.economy.models import ShopItem

shop_items = [
    {'code': 'shield_6h',   'name': '6h Territory Shield',     'category': 'shield',       'price_tdc': 50,   'effect_type': 'shield',           'effect_value': 6,   'effect_duration_seconds': 21600, 'max_per_day': 2,  'hard_cap_pct': 0,  'rarity': 'common',    'description': 'Protect your territory from attacks for 6 hours.'},
    {'code': 'shield_12h',  'name': '12h Territory Shield',    'category': 'shield',       'price_tdc': 90,   'effect_type': 'shield',           'effect_value': 12,  'effect_duration_seconds': 43200, 'max_per_day': 1,  'hard_cap_pct': 0,  'rarity': 'rare',      'description': 'Full day protection (uses daily cap).'},
    {'code': 'mil_boost_s', 'name': 'Military Boost — Small',  'category': 'military',     'price_tdc': 75,   'effect_type': 'military_boost',   'effect_value': 10,  'effect_duration_seconds': 3600,  'max_per_day': 3,  'hard_cap_pct': 25, 'rarity': 'common',    'description': '+10% attack power for 1 hour. Hard capped at +25%.'},
    {'code': 'mil_boost_l', 'name': 'Military Boost — Large',  'category': 'military',     'price_tdc': 200,  'effect_type': 'military_boost',   'effect_value': 25,  'effect_duration_seconds': 14400, 'max_per_day': 1,  'hard_cap_pct': 25, 'rarity': 'rare',      'description': '+25% attack power for 4 hours (max boost).'},
    {'code': 'build_rush',  'name': 'Construction Rush',       'category': 'construction', 'price_tdc': 60,   'effect_type': 'construction_speed','effect_value': 50,  'effect_duration_seconds': 7200,  'max_per_day': 2,  'hard_cap_pct': 50, 'rarity': 'common',    'description': '-50% construction time for 2 hours.'},
    {'code': 'banner_td',   'name': 'Terra Banner — Green',    'category': 'cosmetic',     'price_tdc': 150,  'effect_type': 'cosmetic',         'effect_value': 0,   'effect_duration_seconds': 0,     'max_per_day': 0,  'hard_cap_pct': 0,  'rarity': 'rare',      'description': 'Exclusive green banner for your territories.'},
    {'code': 'bp_s1',       'name': 'Battle Pass — Season 1',  'category': 'battle_pass',  'price_tdc': 499,  'effect_type': 'battle_pass',      'effect_value': 0,   'effect_duration_seconds': 0,     'max_per_day': 1,  'hard_cap_pct': 0,  'rarity': 'epic',      'description': '40 tiers of cosmetic rewards. 5,000 TDC value inside.'},
    {'code': 'resource_m',  'name': 'Resource Pack — Materials','category': 'resource_pack','price_tdc': 100, 'effect_type': 'resource_grant',   'effect_value': 500, 'effect_duration_seconds': 0,     'max_per_day': 3,  'hard_cap_pct': 0,  'rarity': 'common',    'description': '500 Materials delivered to your most active territory.'},
]

for item_data in shop_items:
    item, created = ShopItem.objects.get_or_create(
        code=item_data['code'],
        defaults={'is_active': True, 'price_eur': None, **item_data}
    )
    if created:
        print(f"  ✅ Shop item: {item.name}")

# ─── Control Tower Event ──────────────────────────────────────────────────────
from terra_domini.apps.events.models import ControlTowerEvent

tower = Territory.objects.filter(is_control_tower=True).first()
if tower and not ControlTowerEvent.objects.filter(territory=tower).exists():
    ControlTowerEvent.objects.create(
        territory=tower,
        announced_at=timezone.now(),
        starts_at=timezone.now() + timedelta(hours=2),
        ends_at=timezone.now() + timedelta(hours=4),
        status=ControlTowerEvent.EventStatus.SCHEDULED,
        reward_bonus={'credits': 2.0, 'culture': 3.0, 'duration_hours': 168},
    )
    print(f"  ✅ Control Tower event scheduled for: {tower.landmark_name}")

# Run POI seed
print("\n🌍 Seeding World POIs...")
import subprocess, sys
subprocess.run([sys.executable, 'scripts/seed_pois.py'], check=False)

print("\n✅ Seed complete! Dev credentials:")
print("   Alice:   alice@td.local   / testpassword123  (rank 15, 5000 TDC, 8 territories)")
print("   Bob:     bob@td.local     / testpassword123  (rank 8,  1200 TDC, 7 territories)")
print("   Charlie: charlie@td.local / testpassword123  (rank 3,   200 TDC)")
print("   Admin:   admin@td.local   / adminpassword123")
print(f"\n   91 test territories seeded around Paris center")
print(f"   Alliance [TERRA] with Alice + Bob")
print(f"   8 shop items available")
print(f"\n🌐 Open: http://localhost:5173")
print(f"🔧 API:  http://localhost:8000/api/docs/")
