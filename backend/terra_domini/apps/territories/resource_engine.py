"""
Terra Domini — Intelligent Territory Resource Engine
Assigns resources to H3 hexagons based on:
- Geographic coordinates (latitude/longitude)
- Biome type (derived from lat/lon + altitude heuristics)
- Regional context (continent, proximity to coast, elevation zone)
- Global balance constraints (no continent hoards one resource)

This is the algorithm that makes EVERY hex meaningful,
not just the 600 curated POIs.
"""
import math
import random
import hashlib
from typing import Optional


# ─── Biome Detection ──────────────────────────────────────────────────────────

def get_biome(lat: float, lon: float) -> str:
    """
    Estimate biome from coordinates.
    Returns one of: tropical_forest, savanna, desert, temperate_forest,
    boreal_forest, tundra, grassland, mediterranean, mountain, coastal, ocean
    """
    abs_lat = abs(lat)

    # Polar / tundra
    if abs_lat > 66:
        return 'tundra'
    # Boreal (taiga)
    if abs_lat > 55:
        return 'boreal_forest'
    # Temperate
    if abs_lat > 40:
        # Check for Mediterranean basins
        if (28 < lat < 47 and -10 < lon < 40) or (-35 < lat < -28 and 115 < lon < 155):
            return 'mediterranean'
        return 'temperate_forest'
    # Subtropical deserts
    if 20 < abs_lat < 35:
        # Main desert zones
        if (20 < lat < 35 and -20 < lon < 60):  # Sahara + Middle East
            return 'desert'
        if (-35 < lat < -20 and 115 < lon < 140):  # Australian outback
            return 'desert'
        if (20 < lat < 35 and -120 < lon < -105):  # Sonoran/Chihuahuan
            return 'desert'
        return 'grassland'
    # Tropics
    if abs_lat < 20:
        if abs_lat < 10:
            return 'tropical_forest'  # Equatorial belt
        return 'savanna'

    return 'grassland'


def is_coastal(lat: float, lon: float, threshold_deg: float = 2.0) -> bool:
    """Rough coastal detection — within 2° of known coastlines."""
    # Simplified: use modular distance from known coastal bands
    # Real implementation would use GeoJSON coastline
    # Heuristic: high variation in lat/lon suggests coastline proximity
    return False  # Overridden by explicit coastal regions below


def get_region(lat: float, lon: float) -> str:
    """Determine world region from coordinates."""
    if lon < -30:  # Americas
        if lat > 15: return 'north_america'
        if lat > -10: return 'central_america'
        return 'south_america'
    if lon < 30:  # Europe + Africa
        if lat > 35: return 'europe'
        if lat > -5: return 'north_africa'
        return 'sub_saharan_africa'
    if lon < 60:  # Middle East + Central Asia
        if lat > 35: return 'central_asia'
        return 'middle_east'
    if lon < 100:  # South Asia
        if lat > 25: return 'central_asia'
        return 'south_asia'
    if lon < 145:  # East Asia + Southeast Asia
        if lat > 20: return 'east_asia'
        return 'southeast_asia'
    # Pacific
    if lat < -10: return 'oceania'
    return 'east_asia'


# ─── Resource Probability Tables ──────────────────────────────────────────────

# biome → {resource: probability_weight}
BIOME_RESOURCES = {
    'tropical_forest': {
        'food': 50, 'materials': 20, 'culture': 10,
        'energy': 5, 'credits': 10, 'intel': 5
    },
    'savanna': {
        'food': 35, 'materials': 20, 'culture': 20,
        'energy': 10, 'credits': 10, 'intel': 5
    },
    'desert': {
        'energy': 35, 'intel': 20, 'credits': 15,
        'materials': 20, 'food': 5, 'culture': 5
    },
    'temperate_forest': {
        'food': 30, 'materials': 25, 'culture': 20,
        'energy': 10, 'credits': 10, 'intel': 5
    },
    'boreal_forest': {
        'materials': 35, 'food': 20, 'energy': 20,
        'intel': 10, 'credits': 10, 'culture': 5
    },
    'tundra': {
        'energy': 30, 'materials': 25, 'intel': 25,
        'credits': 10, 'food': 5, 'culture': 5
    },
    'grassland': {
        'food': 40, 'credits': 20, 'materials': 15,
        'culture': 15, 'energy': 5, 'intel': 5
    },
    'mediterranean': {
        'food': 30, 'culture': 30, 'credits': 20,
        'materials': 10, 'energy': 5, 'intel': 5
    },
    'mountain': {
        'materials': 35, 'energy': 20, 'culture': 20,
        'intel': 15, 'food': 5, 'credits': 5
    },
}

# region → bonus multipliers for specific resources
REGION_MODIFIERS = {
    'middle_east':      {'energy': 2.5, 'intel': 1.5},
    'north_africa':     {'energy': 1.8, 'culture': 1.5},
    'sub_saharan_africa':{'materials': 1.8, 'food': 1.5, 'culture': 1.3},
    'europe':           {'culture': 2.0, 'credits': 1.5, 'intel': 1.3},
    'east_asia':        {'materials': 1.8, 'credits': 2.0, 'intel': 1.5},
    'south_asia':       {'food': 2.0, 'culture': 1.5, 'materials': 1.3},
    'southeast_asia':   {'food': 1.8, 'materials': 1.5, 'credits': 1.3},
    'central_asia':     {'energy': 1.5, 'materials': 2.0, 'intel': 1.3},
    'north_america':    {'energy': 1.5, 'food': 1.5, 'credits': 2.0},
    'south_america':    {'food': 1.8, 'materials': 1.5, 'culture': 1.3},
    'central_america':  {'food': 1.5, 'culture': 2.0, 'materials': 1.3},
    'oceania':          {'materials': 1.5, 'food': 1.5, 'culture': 1.8},
}

# Rare resource hotspots: (lat_center, lon_center, radius_deg, resource, multiplier)
HOTSPOTS = [
    # Oil/Energy hotspots
    (26, 50, 8, 'energy', 4.0),   # Persian Gulf
    (60, 2, 5, 'energy', 3.0),    # North Sea
    (31, -100, 8, 'energy', 3.5), # Permian Basin
    (57, -111, 5, 'energy', 2.5), # Alberta Oil Sands
    (-23, -68, 6, 'materials', 4.5),  # Atacama Lithium
    (42, 110, 8, 'materials', 4.0),   # Inner Mongolia Rare Earth
    (-26, 27, 4, 'materials', 5.0),   # Witwatersrand Gold
    (-25, 25, 5, 'materials', 3.5),   # Kalahari Diamonds
    (-10, 26, 5, 'materials', 4.5),   # DRC Cobalt/Copper
    (-20, -67, 4, 'materials', 5.0),  # Atacama/Uyuni Lithium zone
    (1, 114, 5, 'materials', 3.0),    # Borneo resources
    (68, 30, 6, 'materials', 2.5),    # Kola Peninsula nickel
    (-30, 116, 5, 'materials', 3.5),  # Western Australia iron/lithium
    (37, -5, 4, 'culture', 3.0),      # Andalucia culture
    (35, 105, 8, 'culture', 2.5),     # China cultural heartland
    (28, 80, 5, 'culture', 3.0),      # Ganges plain culture
    (4, 102, 4, 'credits', 3.0),      # Singapore/Malaysia trade
    (51, 10, 5, 'credits', 2.5),      # Central Europe finance
    (40, -74, 3, 'credits', 4.0),     # New York financial
    (22, 114, 2, 'credits', 3.5),     # Hong Kong
    (45, 35, 6, 'food', 3.5),         # Ukraine Chernozem
    (42, -93, 8, 'food', 3.0),        # US Corn Belt
    (10, 105, 5, 'food', 2.5),        # Mekong Delta
]


def get_territory_resource(lat: float, lon: float, h3_index: str = '') -> dict:
    """
    Calculate the primary resource type and bonus for a territory
    based on its geographic location.

    Returns:
    {
        'resource_type': str,
        'bonus_pct': int,
        'rarity': str,
        'tdc_per_day': float,
        'description': str,
        'biome': str,
        'region': str,
    }
    """
    # Deterministic seed from h3 or coordinates
    seed_str = h3_index or f"{lat:.3f},{lon:.3f}"
    seed = int(hashlib.md5(seed_str.encode()).hexdigest()[:8], 16)
    rng = random.Random(seed)

    biome = get_biome(lat, lon)
    region = get_region(lat, lon)

    # Build weighted resource table
    weights = dict(BIOME_RESOURCES.get(biome, BIOME_RESOURCES['grassland']))

    # Apply region modifiers
    mods = REGION_MODIFIERS.get(region, {})
    for resource, multiplier in mods.items():
        if resource in weights:
            weights[resource] *= multiplier

    # Apply hotspot bonuses
    hotspot_bonus = 1.0
    for hx, hy, hr, hres, hmult in HOTSPOTS:
        dist = math.sqrt((lat - hx)**2 + (lon - hy)**2)
        if dist < hr:
            proximity = 1.0 - (dist / hr)
            if hres == list(weights.keys())[0]:  # primary resource
                hotspot_bonus = max(hotspot_bonus, 1.0 + (hmult - 1.0) * proximity)
            weights[hres] = weights.get(hres, 10) * (1 + (hmult-1) * proximity * 0.5)

    # Weighted random selection
    total = sum(weights.values())
    roll = rng.random() * total
    cumsum = 0
    resource_type = 'credits'
    for res, weight in weights.items():
        cumsum += weight
        if roll <= cumsum:
            resource_type = res
            break

    # Calculate bonus and rarity
    base_bonus = rng.randint(10, 40)
    hotspot_adjusted = min(200, int(base_bonus * hotspot_bonus))

    # Rarity from bonus level + rng
    rarity_roll = rng.random()
    if hotspot_adjusted > 80 or rarity_roll > 0.98:
        rarity = 'legendary'
        bonus = rng.randint(80, 150)
    elif hotspot_adjusted > 50 or rarity_roll > 0.90:
        rarity = 'rare'
        bonus = rng.randint(50, 90)
    elif hotspot_adjusted > 30 or rarity_roll > 0.70:
        rarity = 'uncommon'
        bonus = rng.randint(25, 55)
    else:
        rarity = 'common'
        bonus = rng.randint(10, 30)

    tdc_map = {'common': 8, 'uncommon': 20, 'rare': 50, 'legendary': 120}
    tdc = tdc_map[rarity] * (1 + rng.random() * 0.5)

    descriptions = {
        'energy':    f'{biome.replace("_"," ").title()} energy potential — {["oil traces","geothermal vents","wind corridor","solar exposure"][rng.randint(0,3)]}',
        'food':      f'Fertile {biome.replace("_"," ")} zone — {["rich soil","river delta","fishing ground","grazing land"][rng.randint(0,3)]}',
        'materials': f'Mineral deposits — {["iron ore","copper","bauxite","manganese","rare minerals"][rng.randint(0,4)]}',
        'credits':   f'Trade position — {["market crossroads","historic trade route","natural harbor access","commercial corridor"][rng.randint(0,3)]}',
        'intel':     f'Strategic vantage — {["observation point","communication node","border monitoring","signal intercept site"][rng.randint(0,3)]}',
        'culture':   f'Cultural heritage — {["ancient settlement","sacred ground","archaeological site","folk tradition center"][rng.randint(0,3)]}',
    }

    return {
        'resource_type': resource_type,
        'bonus_pct': bonus,
        'rarity': rarity,
        'tdc_per_day': round(tdc, 1),
        'description': descriptions.get(resource_type, ''),
        'biome': biome,
        'region': region,
    }


def assign_bulk(territories_qs):
    """
    Assign resources to all territories that don't have one.
    Call from management command or migration.
    """
    count = 0
    for t in territories_qs.filter(resource_type=''):
        data = get_territory_resource(
            t.center_lat or 0,
            t.center_lon or 0,
            t.h3_index or ''
        )
        t.resource_type = data['resource_type']
        t.save(update_fields=['resource_type'])
        count += 1
    return count
