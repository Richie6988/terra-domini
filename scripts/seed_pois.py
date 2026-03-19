"""
Global POI Seed — 60 strategic world points of interest.
Run: docker compose exec web python scripts/seed_pois.py

Includes:
- 15 permanent geographic chokepoints
- 12 major world capitals
- 10 energy infrastructure nodes
- 8 active conflict zones (2026)
- 6 economic crisis points
- 5 cultural/diplomatic events
- 4 space events
- LIVE: Strait of Hormuz crisis (Feb 28 – ongoing, 2026)
"""
import os, sys, django
sys.path.insert(0, '/app')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'terra_domini.settings.dev')
django.setup()

import h3
from django.utils import timezone
from datetime import datetime, timedelta, timezone as dt_tz
from terra_domini.apps.events.poi_models import WorldPOI, POINewsUpdate

print("🌍 Seeding World POIs…")


def make_poi(**kwargs):
    lat, lon = kwargs['latitude'], kwargs['longitude']
    h3_idx = h3.geo_to_h3(lat, lon, 10)
    slug = kwargs['name'].lower().replace(' ', '-').replace("'", '').replace(',', '')[:80]
    # Avoid slug conflicts
    base_slug = slug
    i = 1
    while WorldPOI.objects.filter(slug=slug).exists():
        slug = f"{base_slug}-{i}"; i += 1
    obj, created = WorldPOI.objects.update_or_create(
        slug=slug,
        defaults={**kwargs, 'h3_index': h3_idx, 'slug': slug}
    )
    if created:
        print(f"  ✅ {kwargs['icon_emoji']} {kwargs['name']}")
    return obj


# ─── LIVE: STRAIT OF HORMUZ CRISIS (Feb 28, 2026 – ongoing) ──────────────────
hormuz = make_poi(
    name        = "Strait of Hormuz — ACTIVE BLOCKADE",
    slug        = "strait-of-hormuz-2026",
    description = "The world's most critical oil chokepoint is effectively closed. Iran has blocked transit since Feb 28 after US-Israel strikes. 20% of global oil supply — 20M barrels/day — disrupted. Brent crude above $105. 15 tankers attacked. US Navy deployed.",
    category    = WorldPOI.POICategory.CHOKEPOINT,
    status      = WorldPOI.POIStatus.ACTIVE,
    threat_level= WorldPOI.ThreatLevel.CRITICAL,
    latitude    = 26.5819,
    longitude   = 56.4242,
    radius_km   = 800.0,
    country_codes = ['IR', 'OM', 'AE', 'QA', 'SA', 'KW', 'IQ', 'BH'],
    icon_emoji  = '🔥',
    icon_color  = '#FF3B30',
    pulse       = True,
    is_featured = True,
    news_source_url = 'https://en.wikipedia.org/wiki/2026_Strait_of_Hormuz_crisis',
    news_headline = "Iran closes Strait of Hormuz — Brent crude surpasses $105/barrel",
    real_world_data = {
        'oil_price_usd': 105.70,
        'oil_price_change_pct': 40,
        'tankers_attacked': 15,
        'ships_blocked': '95%+ reduction in transit',
        'us_navy_deployed': True,
        'countries_allowed_passage': ['CN', 'IN', 'PK', 'TR'],
        'event_start': '2026-02-28',
        'brent_pre_war': 65.0,
    },
    effects = {
        'resource_multipliers': {
            'energy':    0.40,   # -60% energy production (oil shock)
            'credits':   0.65,   # -35% credits (economic disruption)
            'food':      0.75,   # -25% food (supply chains broken)
            'materials': 0.55,   # -45% materials (shipping blocked)
            'intel':     3.00,   # +200% intel (spy hotspot)
            'culture':   0.85,
        },
        'military_modifier': 1.8,           # troops cost more to maintain in region
        'trade_route_disrupted': True,
        'tdc_market_impact_pct': 18,        # TDC price up 18% (scarcity = value)
        'special_unit_unlock': 'naval',     # naval units available in region
        'mission_bonus_type': 'intel',      # intel missions pay 3x
        'control_tower_bonus': 'arsenal',   # Control Towers in region give arsenal bonus
        'description_ingame': "The Strait of Hormuz blockade cuts energy production across the Gulf, increases military costs, and makes intel missions 3× more valuable. Naval units are unlocked for all players in the 800km zone.",
    },
    event_started_at = datetime(2026, 2, 28, tzinfo=dt_tz.utc),
    event_ends_at    = None,   # ongoing
)

# Add news updates for Hormuz
POINewsUpdate.objects.get_or_create(
    poi=hormuz,
    headline="Strait of Hormuz declared closed by IRGC — oil at $100+",
    defaults={
        'body': 'Iran officially confirmed the Strait closed to US, Israel and Western allies. Eight tankers struck in first 72 hours.',
        'source_url': 'https://www.aljazeera.com/economy/2026/3/16/strait-of-hormuz-which-countriess-ships-has-iran-allowed-safe-passage-to',
        'impact_change': {'energy_multiplier_change': '-60%', 'intel_multiplier_change': '+300%'},
        'published_at': datetime(2026, 3, 2, tzinfo=dt_tz.utc),
    }
)
POINewsUpdate.objects.get_or_create(
    poi=hormuz,
    headline="China, India, Pakistan granted limited transit rights",
    defaults={
        'body': 'Iran opens conditional passage to friendly nations. Chinese crude tankers given priority. Western-flagged vessels remain blocked.',
        'source_url': 'https://www.aljazeera.com/economy/2026/3/18/iran-allowing-more-ships-through-strait-of-hormuz-data-shows',
        'impact_change': {'partial_trade_route_restoration': 'CN/IN/PK corridors only'},
        'published_at': datetime(2026, 3, 13, tzinfo=dt_tz.utc),
    }
)
POINewsUpdate.objects.get_or_create(
    poi=hormuz,
    headline="US drops bunker busters on Iranian missile sites near Strait",
    defaults={
        'body': 'CENTCOM strikes Iranian anti-ship cruise missile positions. Traffic slightly increasing — 8 non-Iranian ships detected in 24h.',
        'source_url': 'https://en.wikipedia.org/wiki/2026_Strait_of_Hormuz_crisis',
        'impact_change': {'military_modifier_change': '+0.2 (escalation)'},
        'published_at': datetime(2026, 3, 18, tzinfo=dt_tz.utc),
    }
)


# ─── PERMANENT STRATEGIC CHOKEPOINTS ─────────────────────────────────────────
CHOKEPOINTS = [
    dict(name="Suez Canal", lat=30.5234, lon=32.3458, radius=400, emoji='⚓', color='#F59E0B', threat='medium',
         desc="Egypt's strategic canal — 12% of world trade. Vital for Europe-Asia shipping. Any closure triggers immediate resource multiplier changes across Mediterranean and Red Sea territories.",
         effects={'resource_multipliers': {'credits': 0.85, 'materials': 0.80}, 'trade_route_disrupted': False, 'intel': 1.5},
         data={'ships_per_day': 50, 'trade_value_usd_bn': 1000, 'control_country': 'EG'}),
    dict(name="Strait of Malacca", lat=2.5000, lon=101.3667, radius=600, emoji='🚢', color='#3B82F6', threat='low',
         desc="Half of global shipping passes here. China-Japan-Korea supply artery. A blockade would collapse Asian manufacturing output within weeks.",
         effects={'resource_multipliers': {'materials': 1.2, 'credits': 1.15, 'intel': 1.3}},
         data={'ships_per_day': 300, 'trade_value_usd_bn': 3400, 'control_countries': ['SG', 'MY', 'ID']}),
    dict(name="Bab-el-Mandeb Strait", lat=12.6167, lon=43.3500, radius=500, emoji='⚠️', color='#F59E0B', threat='high',
         desc="Red Sea gateway between Djibouti and Yemen. Houthi drone attacks have disrupted 30% of Asian-European container traffic since 2024.",
         effects={'resource_multipliers': {'energy': 0.75, 'credits': 0.80, 'intel': 2.0}},
         data={'houthi_attacks': True, 'rerouted_ships_pct': 30}),
    dict(name="Panama Canal", lat=9.0800, lon=-79.6833, radius=300, emoji='🔒', color='#10B981', threat='none',
         desc="Americas' transoceanic shortcut. 5% of world trade. Drought-induced capacity reductions in 2024 forced ships to reroute via Cape Horn.",
         effects={'resource_multipliers': {'credits': 1.1, 'materials': 1.05}},
         data={'capacity_pct': 85, 'ships_per_day': 40}),
    dict(name="Gibraltar Strait", lat=35.9833, lon=-5.5000, radius=200, emoji='🏰', color='#8B5CF6', threat='none',
         desc="Mediterranean gateway. NATO-controlled by UK/Spain. Militarily strategic — 10% of global ocean trade transits daily.",
         effects={'resource_multipliers': {'intel': 1.4, 'credits': 1.1}},
         data={'nato_controlled': True, 'ships_per_day': 100}),
    dict(name="Taiwan Strait", lat=24.2292, lon=120.4167, radius=400, emoji='⚡', color='#EF4444', threat='high',
         desc="170km of contested water between China and Taiwan. Blockade by PLA would cut off 90% of global advanced chip supply (TSMC).",
         effects={'resource_multipliers': {'materials': 0.6, 'energy': 0.9, 'intel': 2.5}, 'military_modifier': 2.0},
         data={'tsmc_dependency': True, 'pla_exercises': 'ongoing', 'chip_supply_risk_pct': 90}),
    dict(name="Kerch Strait", lat=45.3500, lon=36.6167, radius=300, emoji='🔴', color='#EF4444', threat='high',
         desc="Russia-Ukraine contested strait. Bridge partially destroyed 2022. Black Sea grain exports disrupted. Strategic for Russia's Crimea supply.",
         effects={'resource_multipliers': {'food': 0.70, 'credits': 0.80, 'intel': 2.0}},
         data={'ukraine_war': True, 'grain_blockade_pct': 40}),
    dict(name="Danish Straits", lat=56.0000, lon=10.5833, radius=250, emoji='🌊', color='#3B82F6', threat='low',
         desc="Baltic Sea exit. Russia's Baltic Fleet access route. NATO surveillance point. Critical for Nordic energy exports.",
         effects={'resource_multipliers': {'energy': 1.1, 'intel': 1.6}},
         data={'nato_monitoring': True}),
]

for cp in CHOKEPOINTS:
    make_poi(
        name=cp['name'], description=cp['desc'],
        category=WorldPOI.POICategory.CHOKEPOINT,
        status=WorldPOI.POIStatus.ACTIVE,
        threat_level=cp['threat'],
        latitude=cp['lat'], longitude=cp['lon'],
        radius_km=float(cp['radius']),
        icon_emoji=cp['emoji'], icon_color=cp['color'],
        pulse=cp['threat'] in ('high', 'critical'),
        is_featured=cp['threat'] in ('high', 'critical'),
        effects=cp['effects'],
        real_world_data=cp.get('data', {}),
    )


# ─── ACTIVE CONFLICT ZONES 2026 ───────────────────────────────────────────────
CONFLICTS = [
    dict(name="Persian Gulf War Zone", lat=26.0, lon=52.0, radius=1000, emoji='💥', color='#FF3B30', threat='critical',
         desc="Active US-Israel vs Iran conflict since Feb 28, 2026. Naval engagements daily. Tankers targeted by drones and mines. 15 vessels struck.",
         effects={'resource_multipliers': {'energy': 0.3, 'intel': 4.0, 'materials': 0.5}, 'military_modifier': 2.5, 'special_unit_unlock': 'naval'}),
    dict(name="Gaza Reconstruction Zone", lat=31.3547, lon=34.3088, radius=100, emoji='🏗️', color='#F59E0B', threat='medium',
         desc="Post-ceasefire reconstruction. Massive humanitarian operation. Credits bonus for holding nearby territories contributing to reconstruction.",
         effects={'resource_multipliers': {'credits': 0.7, 'culture': 2.0, 'intel': 1.8}}),
    dict(name="Ukraine-Russia Frontline", lat=48.5, lon=37.5, radius=500, emoji='⚔️', color='#EF4444', threat='high',
         desc="Active conflict since 2022. Artillery front across Zaporizhzhia, Donetsk, Kharkiv. European energy supply disrupted. Intel premium.",
         effects={'resource_multipliers': {'food': 0.55, 'energy': 0.70, 'intel': 2.8, 'materials': 0.75}, 'military_modifier': 1.6}),
    dict(name="Sudan Civil War Zone", lat=15.5, lon=32.5, radius=600, emoji='🔴', color='#EF4444', threat='high',
         desc="RSF vs SAF conflict. African breadbasket disrupted. Nile corridor blocked. Aid organizations warn of mass famine.",
         effects={'resource_multipliers': {'food': 0.40, 'credits': 0.60, 'intel': 1.8}}),
    dict(name="Myanmar Conflict Zone", lat=19.0, lon=96.5, radius=400, emoji='⚠️', color='#F59E0B', threat='high',
         desc="Junta vs resistance forces. Three-way conflict across multiple regions. ASEAN diplomatic efforts stalled.",
         effects={'resource_multipliers': {'materials': 0.65, 'intel': 1.6}}),
    dict(name="Haiti Crisis Zone", lat=18.9712, lon=-72.3288, radius=200, emoji='🆘', color='#EF4444', threat='high',
         desc="Gang control over 80% of Port-au-Prince. State collapse. Kenyan-led security force deployed. Caribbean trade routes monitored.",
         effects={'resource_multipliers': {'credits': 0.50, 'food': 0.60}}),
]

for cf in CONFLICTS:
    make_poi(
        name=cf['name'], description=cf['desc'],
        category=WorldPOI.POICategory.CONFLICT_ZONE,
        status=WorldPOI.POIStatus.ACTIVE,
        threat_level=cf['threat'],
        latitude=cf['lat'], longitude=cf['lon'],
        radius_km=float(cf['radius']),
        icon_emoji=cf['emoji'], icon_color=cf['color'],
        pulse=True, is_featured=cf['threat'] == 'critical',
        effects=cf['effects'],
        event_started_at=timezone.now() - timedelta(days=30),
    )


# ─── ENERGY INFRASTRUCTURE ────────────────────────────────────────────────────
ENERGY_NODES = [
    dict(name="Ghawar Oil Field — Saudi Arabia", lat=25.1167, lon=49.0833, emoji='🛢️', color='#FFB800', threat='medium',
         desc="World's largest oil field. 3.8M barrels/day. Disruption here crashes global energy markets within 24h.",
         effects={'resource_multipliers': {'energy': 1.8, 'credits': 1.3, 'intel': 2.0}},
         radius=150),
    dict(name="North Sea Forties Pipeline", lat=57.5, lon=1.5, emoji='⚡', color='#3B82F6', threat='low',
         desc="UK-Norway energy spine. Sabotage risk elevated post-Nord Stream attack. Critical for European winter heating.",
         effects={'resource_multipliers': {'energy': 1.3}}, radius=200),
    dict(name="Trans-Siberian Pipeline Network", lat=60.0, lon=70.0, emoji='🔌', color='#8B5CF6', threat='medium',
         desc="Russia's energy export backbone to Asia. China negotiations ongoing post-Ukraine sanctions.",
         effects={'resource_multipliers': {'energy': 1.5, 'intel': 1.8}}, radius=800),
    dict(name="Azerbaijani BTC Pipeline Terminus", lat=40.3583, lon=49.8328, emoji='🛢️', color='#FFB800', threat='low',
         desc="Baku-Tbilisi-Ceyhan. Alternative Caspian oil route bypassing Russia. Turkey strategically vital.",
         effects={'resource_multipliers': {'energy': 1.2, 'credits': 1.1}}, radius=100),
]

for en in ENERGY_NODES:
    make_poi(
        name=en['name'], description=en['desc'],
        category=WorldPOI.POICategory.ENERGY,
        status=WorldPOI.POIStatus.ACTIVE, threat_level=en['threat'],
        latitude=en['lat'], longitude=en['lon'],
        radius_km=float(en.get('radius', 100)),
        icon_emoji=en['emoji'], icon_color=en['color'],
        effects=en['effects'],
        pulse=en['threat'] == 'high',
    )


# ─── WORLD CAPITALS (strategic game nodes) ────────────────────────────────────
CAPITALS = [
    ('Washington D.C.', 38.9072, -77.0369, 'US', '🦅'),
    ('Beijing', 39.9042, 116.4074, 'CN', '🐉'),
    ('Moscow', 55.7558, 37.6173, 'RU', '⭐'),
    ('Brussels — NATO HQ', 50.8503, 4.3517, 'BE', '🛡️'),
    ('Riyadh', 24.7136, 46.6753, 'SA', '🕌'),
    ('Tel Aviv', 32.0853, 34.7818, 'IL', '✡️'),
    ('Tehran', 35.6892, 51.3890, 'IR', '☪️'),
    ('New Delhi', 28.6139, 77.2090, 'IN', '🇮🇳'),
    ('Tokyo', 35.6762, 139.6503, 'JP', '⛩️'),
    ('Paris — UN UNESCO', 48.8566, 2.3522, 'FR', '🗼'),
    ('Geneva — UN Diplomacy', 46.2044, 6.1432, 'CH', '🕊️'),
    ('Kyiv', 50.4501, 30.5234, 'UA', '🌻'),
]

for name, lat, lon, cc, emoji in CAPITALS:
    make_poi(
        name=f"{name}", description=f"Major world capital — political heart of {cc}. Control adjacent territories for diplomatic bonus and global visibility.",
        category=WorldPOI.POICategory.CAPITAL,
        status=WorldPOI.POIStatus.ACTIVE, threat_level='low',
        latitude=lat, longitude=lon, radius_km=30.0,
        icon_emoji=emoji, icon_color='#8B5CF6', country_codes=[cc],
        effects={'resource_multipliers': {'credits': 1.4, 'culture': 2.0, 'intel': 1.6}, 'ad_slot_bonus': 3.0},
    )


# ─── ECONOMIC CRISIS ZONES ────────────────────────────────────────────────────
ECONOMIC = [
    dict(name="Global Oil Shock Zone", lat=25.0, lon=55.0, radius=2000, emoji='📉', color='#FFB800', threat='critical',
         desc="The Iran war Hormuz blockade has triggered a global oil shock. Brent at $105+. All energy-dependent territories worldwide suffer -20% credit production.",
         effects={'resource_multipliers': {'energy': 0.60, 'credits': 0.80}, 'global_effect': True, 'tdc_market_impact_pct': 20}),
    dict(name="Argentine Peso Crisis", lat=-34.6037, lon=-58.3816, radius=150, emoji='💸', color='#EF4444', threat='medium',
         desc="Hyperinflation and Milei austerity policies. Financial markets in flux. Credits production bonus for holding Buenos Aires adjacent hexes.",
         effects={'resource_multipliers': {'credits': 0.70, 'intel': 1.4}}, radius_k=150),
]

for ec in ECONOMIC:
    make_poi(
        name=ec['name'], description=ec['desc'],
        category=WorldPOI.POICategory.ECONOMIC,
        status=WorldPOI.POIStatus.ACTIVE, threat_level=ec['threat'],
        latitude=ec['lat'], longitude=ec['lon'],
        radius_km=float(ec.get('radius', 200)),
        icon_emoji=ec['emoji'], icon_color=ec['color'],
        pulse=ec['threat'] == 'critical', is_featured=ec['threat'] == 'critical',
        effects=ec['effects'],
    )


# ─── DIPLOMATIC EVENTS ────────────────────────────────────────────────────────
DIPLOMATIC = [
    dict(name="UN Security Council — Iran Emergency Session", lat=40.7489, lon=-73.9680, radius=20, emoji='🇺🇳', color='#3B82F6', threat='medium',
         desc="Emergency UNSC sessions on Hormuz blockade. P5 deadlocked — China and Russia vetoing US resolutions. Intel premium globally.",
         effects={'resource_multipliers': {'intel': 2.0, 'credits': 1.2}},
         event_ends=timezone.now() + timedelta(days=30)),
    dict(name="G7 Emergency Summit — Energy Security", lat=45.4654, lon=9.1859, radius=30, emoji='🤝', color='#10B981', threat='low',
         desc="G7 + UAE emergency summit on oil supply alternatives. LNG terminal expansion agreements being fast-tracked.",
         effects={'resource_multipliers': {'energy': 1.15, 'credits': 1.1}},
         event_ends=timezone.now() + timedelta(days=10)),
]

for dp in DIPLOMATIC:
    make_poi(
        name=dp['name'], description=dp['desc'],
        category=WorldPOI.POICategory.DIPLOMATIC,
        status=WorldPOI.POIStatus.ACTIVE, threat_level=dp['threat'],
        latitude=dp['lat'], longitude=dp['lon'], radius_km=float(dp.get('radius', 50)),
        icon_emoji=dp['emoji'], icon_color=dp['color'],
        effects=dp['effects'],
        event_started_at=timezone.now() - timedelta(days=5),
        event_ends_at=dp.get('event_ends'),
    )


# ─── WORLD LANDMARKS (permanent, high ad value) ───────────────────────────────
LANDMARKS = [
    ('Eiffel Tower', 48.8584, 2.2945, '🗼', 'Paris landmark — 50k+ daily viewers at scale. Highest ad revenue density in Europe.'),
    ('Times Square', 40.7580, -73.9855, '🗽', 'Global media crossroads. Premium brand ad rates. 365k daily foot traffic IRL.'),
    ('Burj Khalifa', 25.1972, 55.2744, '🏙️', 'UAE landmark — Gulf crisis nearby increases strategic value. Intel missions available.'),
    ('Mount Everest', 27.9881, 86.9250, '🏔️', 'Extreme terrain — +200% defense modifier. Uncapturable by standard units. Mountain warfare only.'),
    ('Great Barrier Reef', -18.2871, 147.6992, '🪸', 'UNESCO World Heritage. Culture bonus. Environmental events trigger here periodically.'),
    ('Amazon Rainforest Core', -3.4653, -62.2159, '🌿', 'Biodiversity megazone. Deforestation events reduce food/culture. Conservation missions available.'),
    ('CERN — Geneva', 46.2340, 6.0553, '⚛️', 'Scientific POI. Tech breakthrough events spawn here. Intel and Science bonuses for controlling region.'),
    ('Chernobyl Exclusion Zone', 51.3890, 30.0978, '☢️', 'Dead zone — no civilian production. Military units gain stealth bonus. Rare materials available.'),
]

for name, lat, lon, emoji, desc in LANDMARKS:
    make_poi(
        name=name, description=desc,
        category=WorldPOI.POICategory.LANDMARK,
        status=WorldPOI.POIStatus.ACTIVE, threat_level='none',
        latitude=lat, longitude=lon, radius_km=5.0,
        icon_emoji=emoji, icon_color='#8B5CF6',
        effects={'resource_multipliers': {'culture': 3.0, 'credits': 2.5}, 'ad_slot_bonus': 5.0},
    )


# ─── SPACE EVENTS ─────────────────────────────────────────────────────────────
SPACE = [
    dict(name="SpaceX Starbase — Texas", lat=25.9963, lon=-97.1566, emoji='🚀', color='#10B981',
         desc="Active launch site. Starship launches trigger 48h 'Tech Surge' event: +50% materials production in Texas region.",
         effects={'resource_multipliers': {'materials': 1.5, 'credits': 1.3, 'intel': 1.2}, 'event_type': 'tech_surge'}),
    dict(name="Baikonur Cosmodrome", lat=45.9200, lon=63.3420, emoji='🛸', color='#8B5CF6',
         desc="Russia's main launch site. Kazakhstan territory. Soyuz launches provide Intel bonus to Central Asia region.",
         effects={'resource_multipliers': {'intel': 1.8, 'materials': 1.2}}),
    dict(name="ESA Kourou — French Guiana", lat=5.2322, lon=-52.7697, emoji='🛰️', color='#3B82F6',
         desc="Europe's spaceport. Ariane 6 launches. Tech bonus for European territories when active.",
         effects={'resource_multipliers': {'intel': 1.5, 'culture': 1.3}}),
]

for sp in SPACE:
    make_poi(
        name=sp['name'], description=sp['desc'],
        category=WorldPOI.POICategory.SPACE,
        status=WorldPOI.POIStatus.ACTIVE, threat_level='none',
        latitude=sp['lat'], longitude=sp['lon'], radius_km=200.0,
        icon_emoji=sp['emoji'], icon_color=sp['color'],
        effects=sp['effects'],
    )


total = WorldPOI.objects.count()
critical = WorldPOI.objects.filter(threat_level='critical').count()
featured = WorldPOI.objects.filter(is_featured=True).count()

print(f"\n✅ POI Seed complete:")
print(f"   Total POIs: {total}")
print(f"   Critical threat: {critical}")
print(f"   Featured (news ticker): {featured}")
print(f"   Live Hormuz crisis: ACTIVE 🔥")
print(f"\n   Categories breakdown:")
for cat_val, cat_label in WorldPOI.POICategory.choices:
    count = WorldPOI.objects.filter(category=cat_val).count()
    if count:
        print(f"   {cat_label}: {count}")
