"""
Resource & biome cards (2026-10-18) — data from the HEXOD master DB (apps/events/hexod_db.py).

- Biome card: one of the DB's named regions (lat/lon boxes). A territory belongs to the smallest
  land region containing its centre (ocean regions only if no land region matches).
- Resource card: one of the DB's resources. Every owned territory produces, per day, each resource
  of its biome, plus the resource of its POI category (oil field → oil, gold mine → gold...).
- Production goes into the same stock as HEX (capped at balance.STORAGE_CAP_HOURS) and is credited
  to PlayerResource on COLLECT — no automatic credit.
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


def territory_resource_rates(lat, lon, rarity='common', poi_category='', mult=1.0) -> dict:
    """Resource id → units/day for one territory."""
    out = {}
    b = biome_for(round(lat, 3), round(lon, 3)) if lat is not None and lon is not None else None
    rm = RARITY_RES_MULT.get(rarity or 'common', 1) * mult
    for rid in (b['resource_ids'] if b else []):
        out[rid] = out.get(rid, 0) + RES_PER_DAY.get(resources()[rid].get('rarity'), 5) * rm
    rid = POI_RESOURCE.get(poi_category or '')
    if rid and rid in resources():
        out[rid] = out.get(rid, 0) + RES_PER_DAY.get(resources()[rid].get('rarity'), 5) * POI_RES_MULT * rm
    return out


def player_resource_rates(player) -> dict:
    """Resource id → units/day for the whole empire (starter boost included, like HEX)."""
    from terra_domini.apps.territories.models import Territory
    from terra_domini.apps.events.unified_poi import UnifiedPOI
    rows = list(Territory.objects.filter(owner=player).values_list('h3_index', 'center_lat', 'center_lon', 'rarity'))
    cats = dict(UnifiedPOI.objects.filter(h3_index__in=[r[0] for r in rows], is_active=True).values_list('h3_index', 'category'))
    mult = (B.BEGINNER_MULT if B.is_beginner(player) else 1) * B.boost_mult(player, 'resource_multiplier')   # shop '2X Extraction'
    total = {}
    for h, lat, lon, rarity in rows:
        for rid, v in territory_resource_rates(lat, lon, rarity, cats.get(h, ''), mult).items():
            total[rid] = total.get(rid, 0) + v
    return {k: round(v, 2) for k, v in total.items()}


def player_biomes(player) -> dict:
    """Biome id → number of owned territories in that region."""
    from terra_domini.apps.territories.models import Territory
    out = {}
    for lat, lon in Territory.objects.filter(owner=player).values_list('center_lat', 'center_lon'):
        b = biome_for(round(lat, 3), round(lon, 3)) if lat is not None and lon is not None else None
        if b:
            out[b['id']] = out.get(b['id'], 0) + 1
    return out


def pending(rates: dict, stored_hours: float) -> dict:
    return {k: round(v * stored_hours / 24, 2) for k, v in rates.items() if v > 0}


def credit(player, amounts: dict) -> None:
    from django.db.models import F
    from terra_domini.apps.economy.models import PlayerResource
    for rid, v in amounts.items():
        if v <= 0:
            continue
        row, _ = PlayerResource.objects.get_or_create(player=player, resource_id=rid)
        PlayerResource.objects.filter(pk=row.pk).update(amount=F('amount') + v, total_produced=F('total_produced') + v)


# ── HEX yield of a territory varies with what it sits on (owner 2026-10-18) ──
# Bonus % on the territory's HEX/day for each resource it produces (region + POI), capped; plus a stable
# per-hex variation so two neighbouring commons are not identical.
RESOURCE_HEX_BONUS = {
    'oil': 15, 'gas': 10, 'coal': 5, 'gold': 25, 'diamonds': 30, 'platinum': 20, 'silver': 12, 'uranium': 20,
    'rareearthelements': 20, 'lithium': 18, 'cobalt': 15, 'copper': 8, 'iron': 6, 'titanium': 12, 'tungsten': 10,
    'strategicposition': 25, 'culturalheritage': 10, 'humancapital': 10, 'freshwater': 5, 'energy': 8,
}
HEX_BONUS_CAP = 60
HEX_VARIATION = 15      # ± % per hex, deterministic


def hex_variation_pct(h3_index: str) -> int:
    import hashlib
    return int(hashlib.md5((h3_index or '').encode()).hexdigest()[:4], 16) % (2 * HEX_VARIATION + 1) - HEX_VARIATION


def hex_yield(h3_index, lat, lon, rarity='common', poi_category='') -> dict:
    """{'mult', 'bonuses': [(resource name, pct)], 'variation_pct'} for one territory."""
    rates = territory_resource_rates(lat, lon, rarity, poi_category) if lat is not None and lon is not None else {}
    bonuses = sorted(((resources()[r]['name'], RESOURCE_HEX_BONUS[r]) for r in rates if r in RESOURCE_HEX_BONUS),
                     key=lambda x: -x[1])
    total = min(HEX_BONUS_CAP, sum(p for _, p in bonuses))
    var = hex_variation_pct(h3_index)
    return {'mult': (1 + total / 100) * (1 + var / 100), 'bonuses': bonuses, 'bonus_pct': total, 'variation_pct': var}
