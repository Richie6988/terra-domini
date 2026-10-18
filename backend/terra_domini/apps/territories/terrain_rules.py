"""
Terrain rules (owner 2026-10-18: "around a city or a capital it can't be rural — rules for game credibility,
from my biomes and resources"). Data: HEXOD master DB (cities with population, named biome regions with
their resources, POIs). First rule that matches wins:

1. POI on the hex           → the POI's own terrain (stadium/capital → urban, peak → mountain, oil field → industrial…)
2. Urban core               → within a city's radius (3 km + 5 km·√population in millions; capitals ≥ 10 km)
3. Industrial site          → within 6 km of an industrial POI (oil/gas field, mine, nuclear plant, dam, spaceport, port)
4. Suburbs (≤ 1.8 × radius) → industrial if the region has heavy resources (oil, coal, iron…), else rural
5. Named region             → keywords of the DB region (Sahara → desert, Rainforest → forest, Himalayan → mountain,
                               Savannah/Steppe/Plain → rural, Islands/Coast → coastal, Arctic/Taiga → tundra…)
6. Ocean region only        → coastal
7. Old latitude/longitude heuristic (biome_engine._geo_biome)
"""
import math
import re
from functools import lru_cache

from terra_domini.apps.events import hexod_db

INDUSTRIAL_POI = {'oil_field', 'gas_reserve', 'coal_mine', 'iron_ore', 'copper_mine', 'gold_mine', 'diamond_mine',
                  'uranium_mine', 'lithium_deposit', 'rare_earth', 'nuclear_plant', 'mega_dam', 'space_center',
                  'mega_port', 'data_center', 'particle_collider'}
HEAVY_RESOURCES = {'oil', 'gas', 'coal', 'iron', 'copper', 'aluminium', 'nickel', 'manganese', 'zinc', 'tin', 'chromium'}
REGION_RULES = [   # order matters: the first keyword found in the region name decides
    (r'arctic|tundra|greenland|antarc|svalbard|siberia|taiga|boreal|yukon|alaska|lapland', 'tundra'),
    (r'desert|sahara|gobi|kalahari|namib|atacama|arabian|thar|karakum|kyzylkum|sonoran|mojave|outback|arid|sahel', 'desert'),
    (r'himalaya|alpine|alps|andes|andean|mountain|montane|highland|plateau|rockies|rocky|caucasus|atlas|carpath|pyrenees|rift|volcan|drakensberg|ghats|range', 'mountain'),
    (r'rainforest|forest|woodland|jungle|congo|amazon|ituri|miombo|cerrado|mata atlantica|black forest', 'forest'),
    (r'island|archipelago|isles|coast|coastal|peninsula|reef|maldives|zanzibar|comoros|bioko|caribbean|polynesia|melanesia|micronesia|fynbos', 'coastal'),
    (r'savann|steppe|prairie|pampas|plain|grassland|scrub|karoo|basin|delta|valley|lowland|swamp|wetland|sundarbans|mediterranean', 'rural'),
]
TYPE_FOR_BIOME = {'tundra': 'arctic', 'landmark': 'landmark', 'urban': 'urban', 'rural': 'rural', 'forest': 'forest',
                  'mountain': 'mountain', 'coastal': 'coastal', 'desert': 'desert', 'industrial': 'industrial',
                  'grassland': 'rural'}


def _km(lat1, lon1, lat2, lon2):
    p = math.pi / 180
    a = 0.5 - math.cos((lat2 - lat1) * p) / 2 + math.cos(lat1 * p) * math.cos(lat2 * p) * (1 - math.cos((lon2 - lon1) * p)) / 2
    return 12742 * math.asin(math.sqrt(max(0.0, a)))


@lru_cache(maxsize=1)
def _cities():
    return hexod_db.load().get('cities', [])


@lru_cache(maxsize=1)
def _industrial_pois():
    return [(p['lat'], p['lon']) for p in hexod_db.load().get('pois', [])
            if p.get('on_map') and p.get('game_category') in INDUSTRIAL_POI and p.get('lat') is not None]


def nearest_city(lat, lon):
    best, best_r = None, 1e9
    for c in _cities():
        if abs(c['lat'] - lat) > 0.6 or abs(c['lon'] - lon) > 0.9:
            continue
        d = _km(lat, lon, c['lat'], c['lon'])
        if d / c['radius_km'] < best_r:
            best, best_r = (c, d), d / c['radius_km']
    return best


@lru_cache(maxsize=50000)
def terrain(lat: float, lon: float, poi_category: str = '') -> tuple:
    """(biome, reason) for a point. lat/lon rounded by callers for the cache."""
    from terra_domini.apps.territories.biome_engine import POI_CATEGORY_BIOME, _geo_biome
    from terra_domini.apps.economy.resources import biome_for
    if poi_category and poi_category in POI_CATEGORY_BIOME:
        return POI_CATEGORY_BIOME[poi_category], f'POI {poi_category}'
    if poi_category in INDUSTRIAL_POI:
        return 'industrial', f'POI {poi_category}'
    near = nearest_city(lat, lon)
    if near and near[1] <= near[0]['radius_km']:
        return 'urban', f"{near[0]['name']} urban area ({near[1]:.1f} km)"
    for plat, plon in _industrial_pois():
        if abs(plat - lat) < 0.07 and abs(plon - lon) < 0.1 and _km(lat, lon, plat, plon) <= 6:
            return 'industrial', 'industrial site nearby'
    region = biome_for(round(lat, 3), round(lon, 3))
    if near and near[1] <= near[0]['radius_km'] * 1.8:
        heavy = region and HEAVY_RESOURCES & set(region.get('resource_ids', []))
        return ('industrial' if heavy else 'rural'), f"{near[0]['name']} suburbs"
    if region:
        if region['type'] == 'land':
            name = region['name'].lower()
            for rx, biome in REGION_RULES:
                if re.search(rx, name):
                    return biome, f"region {region['name']}"
        else:
            return 'coastal', f"sea region {region['name']}"
    return _geo_biome(lat, lon), 'latitude/longitude'


def territory_type_for(biome: str) -> str:
    return TYPE_FOR_BIOME.get(biome, 'rural')
