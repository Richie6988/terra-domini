#!/usr/bin/env python
"""
Seed game world — Control Towers, World Events, and initial territory data.
Run from backend/: python scripts/seed_game_world.py
"""
import os, sys, django

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'terra_domini.settings.dev')
django.setup()

from django.utils import timezone
from datetime import timedelta
from terra_domini.apps.territories.models import Territory
from terra_domini.apps.events.models import ControlTowerEvent, WorldEvent

print("🌍 Seeding game world...")

now = timezone.now()

# ─── Control Tower territories ───────────────────────────────────────────────
PARIS_TOWERS = [
    {'name': 'Notre Dame de Paris',   'lat': 48.8530, 'lon': 2.3499},
    {'name': 'Tour Eiffel',           'lat': 48.8584, 'lon': 2.2945},
    {'name': 'Arc de Triomphe',       'lat': 48.8738, 'lon': 2.2950},
    {'name': 'Sacré-Cœur Montmartre', 'lat': 48.8867, 'lon': 2.3431},
    {'name': 'Palais Royal',          'lat': 48.8638, 'lon': 2.3367},
]

tower_territories = []
for t in PARIS_TOWERS:
    ter, created = Territory.objects.get_or_create(
        center_lat__range=(t['lat']-0.003, t['lat']+0.003),
        center_lon__range=(t['lon']-0.005, t['lon']+0.005),
        defaults={
            'h3_index': f"synthetic_{t['name'].lower().replace(' ','_')[:20]}",
            'place_name': t['name'],
            'center_lat': t['lat'],
            'center_lon': t['lon'],
            'is_control_tower': True,
            'defense_points': 500,
            'max_defense_points': 500,
        }
    )
    if not created and not ter.is_control_tower:
        ter.is_control_tower = True
        ter.place_name = t['name']
        ter.save(update_fields=['is_control_tower', 'place_name'])
    tower_territories.append(ter)
    print(f"  🗼 {'Created' if created else 'Updated'}: {ter.place_name}")

# ─── Control Tower Events ────────────────────────────────────────────────────
if tower_territories:
    # ACTIVE war right now
    ControlTowerEvent.objects.get_or_create(
        territory=tower_territories[0],
        status=ControlTowerEvent.EventStatus.ACTIVE,
        defaults={
            'announced_at': now - timedelta(hours=1),
            'starts_at': now - timedelta(minutes=30),
            'ends_at': now + timedelta(hours=1, minutes=30),
            'reward_bonus': {'tdc_multiplier': 2.0, 'xp_bonus': 500},
        }
    )
    print(f"  ⚡ ACTIVE: Tower War at {tower_territories[0].place_name}")

    # Scheduled wars
    for i, tower in enumerate(tower_territories[1:4], 1):
        start = now + timedelta(hours=i * 2)
        ControlTowerEvent.objects.get_or_create(
            territory=tower,
            status=ControlTowerEvent.EventStatus.SCHEDULED,
            defaults={
                'announced_at': now,
                'starts_at': start,
                'ends_at': start + timedelta(hours=2),
                'reward_bonus': {'tdc_multiplier': 1.5, 'xp_bonus': 300},
            }
        )
        print(f"  ⏰ SCHEDULED: {tower.place_name} in {i*2}h")

# ─── World Events ────────────────────────────────────────────────────────────
events_data = [
    {
        'name': '⚡ DOUBLE XP WEEKEND',
        'description': 'All battles give ×2 XP until Sunday midnight UTC!',
        'event_type': 'special',
        'is_global': True,
        'is_active': True,
        'effects': {'xp_multiplier': 2.0},
        'starts_at': now - timedelta(hours=6),
        'ends_at': now + timedelta(hours=42),
    },
    {
        'name': '🔥 HORMUZ CRISIS',
        'description': 'Gulf energy disrupted. Naval units unlocked.',
        'event_type': 'geopolitical',
        'is_global': False,
        'is_active': True,
        'effects': {'energy': 0.4, 'intel': 3.0},
        'starts_at': now - timedelta(days=20),
        'ends_at': now + timedelta(days=30),
    },
    {
        'name': '🏆 SEASON 1 — Week 3',
        'description': 'Season 1 live! 50,000 TDC prize pool. Top alliance takes 60%.',
        'event_type': 'season',
        'is_global': True,
        'is_active': True,
        'effects': {'prize_pool_tdc': 50000},
        'starts_at': now - timedelta(weeks=3),
        'ends_at': now + timedelta(weeks=10),
    },
    {
        'name': '🌊 MONSOON SEASON',
        'description': 'South Asia territory income +30% this week.',
        'event_type': 'weather',
        'is_global': False,
        'is_active': True,
        'effects': {'income_bonus': 0.3, 'region': 'south_asia'},
        'starts_at': now - timedelta(days=2),
        'ends_at': now + timedelta(days=5),
    },
]

for ed in events_data:
    ev, created = WorldEvent.objects.get_or_create(name=ed['name'], defaults=ed)
    if not created:
        ev.ends_at = ed['ends_at']
        ev.is_active = True
        ev.save(update_fields=['ends_at', 'is_active'])
    print(f"  🌍 {'Created' if created else 'Live'}: {ev.name}")

# ─── Activate Hormuz POI ─────────────────────────────────────────────────────
try:
    from terra_domini.apps.events.poi_models import WorldPOI
    poi, created = WorldPOI.objects.update_or_create(
        slug='strait-of-hormuz-2026',
        defaults={
            'name': 'Strait of Hormuz — Active Blockade',
            'description': 'Iran blockade active. Energy -60% in Gulf region.',
            'category': 'chokepoint', 'threat_level': 'critical',
            'status': 'active', 'latitude': 26.58, 'longitude': 56.42,
            'radius_km': 800, 'icon_emoji': '🔥', 'icon_color': '#FF3B30',
            'pulse': True, 'is_featured': True,
            'effects': {'resource_multipliers': {'energy': 0.4, 'intel': 3.0}},
            'news_headline': 'Iran closes Strait of Hormuz — Brent at $105',
            'event_started_at': now - timedelta(days=20),
        }
    )
    print(f"  🔥 POI: {poi.name}")
except Exception as e:
    print(f"  ⚠️ POI skipped: {e}")

print(f"\n✅ Done!")
print(f"  🗼 Towers:         {Territory.objects.filter(is_control_tower=True).count()}")
print(f"  ⚡ Active wars:    {ControlTowerEvent.objects.filter(status='active').count()}")
print(f"  ⏰ Scheduled:      {ControlTowerEvent.objects.filter(status='scheduled').count()}")
print(f"  🌍 World events:   {WorldEvent.objects.count()}")

# ─── Shop Items for Military Units ────────────────────────────────────────────
try:
    from terra_domini.apps.economy.models import ShopItem
    UNIT_ITEMS = [
        {'code': 'unit_infantry',  'name': 'Infantry Unit',  'price_tdc': 50,  'category': 'military'},
        {'code': 'unit_cavalry',   'name': 'Cavalry Unit',   'price_tdc': 120, 'category': 'military'},
        {'code': 'unit_artillery', 'name': 'Artillery Unit', 'price_tdc': 200, 'category': 'military'},
        {'code': 'unit_naval',     'name': 'Naval Unit',     'price_tdc': 300, 'category': 'military'},
    ]
    for u in UNIT_ITEMS:
        ShopItem.objects.update_or_create(
            code=u['code'],
            defaults={
                'name': u['name'],
                'price_tdc': u['price_tdc'],
                'category': u.get('category', 'military'),
                'is_active': True,
                'max_per_day': 100,
                'description': f"Train {u['name']} for your territories",
            }
        )
    print(f"  🛒 {len(UNIT_ITEMS)} unit shop items created")
except Exception as e:
    print(f"  ⚠️ Shop items: {e}")
