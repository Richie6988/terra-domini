"""
Region control — the Risk "continents" of HEXOD (owner 2026-10-18: "a more fun game regarding military and resource
strategy like in Risk").

The world is split into the DB regions (economy.resources.biomes: Sahara, Amazon basin, Alps…). In each region, the
player holding the most territories (at least REGION_MIN, strictly ahead of the runner-up) CONTROLS it:
  +REGION_DRAFT free troops in the daily draft per controlled region   (territories.upgrades.draft_size)
  +REGION_HEX_PCT % HEX on every territory he owns inside it           (economy.balance.territory_rates)
Anyone can take a region away by holding more territories there — the standings refresh every few minutes.
"""
from functools import lru_cache

from django.core.cache import cache

REGION_MIN = 3
REGION_DRAFT = 3
REGION_HEX_PCT = 10
CACHE_KEY, CACHE_TTL = 'region_standings_v1', 300


@lru_cache(maxsize=200_000)
def region_of(lat2: float, lon2: float):
    """(id, name) of the region at a point rounded to 0.01° — None outside every region."""
    from terra_domini.apps.economy.resources import biome_for
    b = biome_for(lat2, lon2)
    return (b['id'], b['name']) if b else None


def region_at(lat, lon, h3_index=None):
    """Natural region (Sahara, Alps…) at the point; outside them (cities, plains) the province = the H3 resolution-2
    cell (~86,000 km²), id 'p:<cell>', named later after its most notable place."""
    r = region_of(round(lat, 2), round(lon, 2)) if lat is not None and lon is not None else None
    if r or not h3_index:
        return r
    try:
        import h3
        return ('p:' + h3.cell_to_parent(h3_index, 2), None)
    except Exception:
        return None


def standings() -> dict:
    """{region id: {'name', 'counts': {owner id: territories}}} for every region someone holds (cached)."""
    data = cache.get(CACHE_KEY)
    if data is not None:
        return data
    from terra_domini.apps.territories.models import Territory
    data, best = {}, {}
    order = {'mythic': 5, 'legendary': 4, 'epic': 3, 'rare': 2, 'uncommon': 1}
    for owner, h, lat, lon, rarity, poi, place in Territory.objects.filter(owner__isnull=False).values_list(
            'owner_id', 'h3_index', 'center_lat', 'center_lon', 'rarity', 'poi_name', 'place_name'):
        r = region_at(lat, lon, h)
        if not r:
            continue
        e = data.setdefault(r[0], {'name': r[1], 'counts': {}})
        key = str(owner)
        e['counts'][key] = e['counts'].get(key, 0) + 1
        label = poi or place
        if not r[1] and label and order.get(rarity, 0) >= best.get(r[0], (-1, ''))[0]:
            best[r[0]] = (order.get(rarity, 0), label)
    for rid, e in data.items():
        if not e['name']:
            e['name'] = f"Province of {best[rid][1][:40]}" if rid in best else 'Unnamed province'
    cache.set(CACHE_KEY, data, CACHE_TTL)
    return data


def leader_of(entry):
    """(owner id, count) of the region's controller, or (None, 0) when nobody leads clearly."""
    ranked = sorted(entry['counts'].items(), key=lambda kv: -kv[1])
    if not ranked or ranked[0][1] < REGION_MIN or (len(ranked) > 1 and ranked[1][1] == ranked[0][1]):
        return None, 0
    return ranked[0]


def controlled(player_id) -> set:
    pid = str(player_id)
    return {rid for rid, e in standings().items() if leader_of(e)[0] == pid}


def invalidate():
    cache.delete(CACHE_KEY)
