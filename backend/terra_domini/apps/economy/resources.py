"""
Resource & biome cards (2026-10-18) — data from the HEXOD master DB (apps/events/hexod_db.py).

- Biome card: one of the DB's named regions (lat/lon boxes). A territory belongs to the smallest
  land region containing its centre (ocean regions only if no land region matches).
- Resources (owner 2026-10-19, simpler): no stock, no collecting. A resource only exists as a RARE TOKEN — a real
  extraction site of the DB (Prudhoe Bay oil, North Dome gas, Witwatersrand gold, Orapa diamonds…). Holding one
  is a card with its own rarity (Silver to Diamond), paid like any token. Regular hexes carry no resource.
"""
from functools import lru_cache

from terra_domini.apps.economy import balance as B
from terra_domini.apps.events import hexod_db

# Units/day for one territory, by the resource's rarity in the DB
RES_PER_DAY = {'common': 10, 'regional': 6, 'variable': 8, 'high': 5, 'rare': 3, 'strategic': 3, 'unique': 2}
POI_RES_MULT = 4                   # a POI's own resource (an oil field produces much more oil)
RARITY_RES_MULT = {'common': 1, 'uncommon': 1.6, 'rare': 3, 'epic': 6, 'legendary': 12, 'mythic': 25}  # rare cards produce far more

POI_RESOURCE = {
    'oil_field': 'oil', 'gas_reserve': 'gas', 'coal_mine': 'coal', 'gold_mine': 'gold', 'diamond_mine': 'diamonds',
    'rare_earth': 'rareearthelements', 'iron_ore': 'iron', 'copper_mine': 'copper', 'lithium_deposit': 'lithium',
    'uranium_mine': 'uranium', 'nuclear_plant': 'energy', 'mega_dam': 'energy', 'freshwater': 'freshwater',
    'glacier': 'freshwater', 'waterfall': 'freshwater', 'fertile_land': 'cereals', 'agri_megafarm': 'cereals',
    'ancient_forest': 'biomass', 'nature_sanctuary': 'biodiversity', 'coral_reef': 'biodiversity',
    'chokepoint': 'strategicposition', 'mega_port': 'strategicposition', 'space_center': 'strategicposition',
    'naval_base': 'strategicposition', 'world_heritage': 'culturalheritage', 'ancient_ruins': 'culturalheritage',
    'religious_site': 'culturalheritage', 'royal_palace': 'culturalheritage', 'museum': 'culturalheritage',
    'ancient_wonder': 'culturalheritage', 'capital_city': 'humancapital', 'financial_hub': 'humancapital',
    'stock_exchange': 'humancapital', 'tech_giant': 'humancapital', 'trade_node': 'humancapital',
}


@lru_cache(maxsize=1)
def resources() -> dict:
    return {r['id']: r for r in hexod_db.load().get('resources', [])}


@lru_cache(maxsize=1)
def biomes() -> list:
    out = []
    for b in hexod_db.load().get('biomes', []):
        b = dict(b)
        b['area'] = (b['lat_max'] - b['lat_min']) * (b['lon_max'] - b['lon_min'])
        b['resource_ids'] = [x.strip() for x in (b.get('resources') or '').split(',') if x.strip() in resources()]
        out.append(b)
    return out


@lru_cache(maxsize=50000)
def biome_for(lat: float, lon: float):
    """Smallest DB region containing the point, land first (None outside every region)."""
    if lat is None or lon is None:
        return None
    hits = [b for b in biomes() if b['lat_min'] <= lat <= b['lat_max'] and b['lon_min'] <= lon <= b['lon_max']]
    land = [b for b in hits if b['type'] == 'land']
    pool = land or hits
    return min(pool, key=lambda b: b['area']) if pool else None


RESOURCE_SITES = {'oil_field', 'gas_reserve', 'coal_mine', 'gold_mine', 'diamond_mine', 'rare_earth', 'iron_ore',
                  'copper_mine', 'lithium_deposit', 'uranium_mine'}   # the only POI categories that are resource tokens


def site_resource(poi_category: str):
    """Resource id of a resource token (extraction site), else None."""
    rid = POI_RESOURCE.get(poi_category or '') if (poi_category or '') in RESOURCE_SITES else None
    return rid if rid and rid in resources() else None


def territory_resource_rates(lat, lon, rarity='common', poi_category='', mult=1.0) -> dict:
    """Resource id → 1 for a resource token (its site's resource), {} for every other hex."""
    rid = site_resource(poi_category)
    return {rid: 1} if rid else {}


def player_biomes(player) -> dict:
    """Biome id → number of owned territories in that region."""
    from terra_domini.apps.territories.models import Territory
    out = {}
    for lat, lon in Territory.objects.filter(owner=player).values_list('center_lat', 'center_lon'):
        b = biome_for(round(lat, 3), round(lon, 3)) if lat is not None and lon is not None else None
        if b:
            out[b['id']] = out.get(b['id'], 0) + 1
    return out


# ── HEX yield of a territory varies with what it sits on (owner 2026-10-18) ──
# Bonus % on the territory's HEX/day for each resource it produces (region + POI), capped; plus a stable
# per-hex variation so two neighbouring commons are not identical.
# No resource bonus any more (owner 2026-10-20): a resource token is a card with its own rarity (a Silver copper,
# an Emerald copper, a Diamond copper…) and pays that rarity's HEX like any token.
HEX_VARIATION = 15      # ± % per hex, deterministic


def hex_variation_pct(h3_index: str) -> int:
    import hashlib
    return int(hashlib.md5((h3_index or '').encode()).hexdigest()[:4], 16) % (2 * HEX_VARIATION + 1) - HEX_VARIATION


def hex_yield(h3_index, lat, lon, rarity='common', poi_category='') -> dict:
    """{'mult', 'bonuses': [(resource name, pct)], 'variation_pct'} for one territory."""
    bonuses = []
    total = 0
    var = hex_variation_pct(h3_index)
    return {'mult': (1 + total / 100) * (1 + var / 100), 'bonuses': bonuses, 'bonus_pct': total, 'variation_pct': var}
