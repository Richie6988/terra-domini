"""
Kingdom upgrades + daily draft (owner 2026-10-18: "click my kingdom: all its military units, defense points and the
upgrades I can buy — walls, science, education…; a more fun Risk-like military and resource strategy").

A kingdom = a connected group of owned hexes. Each upgrade has levels 0-5, bought with HEX, stored as a Building on the
hex where it was bought; a kingdom's level = the best building inside it (split a kingdom and the building stays put).
  walls      +15 % defense of every hex of the kingdom per level           (combat.engine.calculate_defense_power)
  barracks   +2 troops in the daily draft per level                         (daily_draft)
  science    +5 % HEX production of the kingdom per level                   (economy.balance.territory_rates)
  education  +5 % resource production of the kingdom per level             (economy.resources.player_resource_rates)
Daily draft (Risk reinforcements): once a day, free infantry = max(3, territories / 3) + kingdom size bonuses
(5+ hexes +2, 10+ +4, 20+ +8 each) + barracks + 3 per controlled region (territories/regions.py).
"""
from django.utils import timezone

UPGRADES = {
    'walls':     {'building': 'fort',     'name': 'Walls',     'base_cost': 1500, 'per_level': 15, 'unit': '% defense'},
    'barracks':  {'building': 'barracks', 'name': 'Barracks',  'base_cost': 1200, 'per_level': 2,  'unit': ' troops / daily draft'},
    'science':   {'building': 'lab',      'name': 'Science',   'base_cost': 2000, 'per_level': 5,  'unit': '% HEX production'},
    'education': {'building': 'academy',  'name': 'Education', 'base_cost': 2000, 'per_level': 5,  'unit': '% resource production'},
}
MAX_LEVEL = 5
BUILDING_TO_UPGRADE = {v['building']: k for k, v in UPGRADES.items()}


def upgrade_cost(key: str, level: int) -> int:
    """HEX price of the next level (doubles each level)."""
    return int(UPGRADES[key]['base_cost'] * (2 ** level))


def clusters(owned: set) -> list:
    """Connected groups of hexes."""
    from terra_domini.utils.h3_compat import k_ring
    seen, out = set(), []
    for h in owned:
        if h in seen:
            continue
        comp, todo = {h}, [h]
        while todo:
            for n in k_ring(todo.pop(), 1):
                if n in owned and n not in comp:
                    comp.add(n); todo.append(n)
        seen |= comp
        out.append(comp)
    return out


def kingdom_of(owner_id, h3_index) -> set:
    from terra_domini.apps.territories.models import Territory
    owned = set(Territory.objects.filter(owner_id=owner_id).values_list('h3_index', flat=True))
    return next((c for c in clusters(owned) if h3_index in c), {h3_index})


def levels_for(hexes) -> dict:
    """{upgrade: level} of a kingdom = best building of each kind on its hexes."""
    from terra_domini.apps.territories.models import Building
    out = {k: 0 for k in UPGRADES}
    for btype, lvl in Building.objects.filter(territory__h3_index__in=list(hexes), is_active=True,
                                              building_type__in=list(BUILDING_TO_UPGRADE)).values_list('building_type', 'level'):
        k = BUILDING_TO_UPGRADE[btype]
        out[k] = max(out[k], lvl)
    return out


def hex_multipliers(owner_id, key: str) -> dict:
    """h3 → (1 + level × per_level %) for every owned hex (science / education), one query per player."""
    from terra_domini.apps.territories.models import Building, Territory
    owned = set(Territory.objects.filter(owner_id=owner_id).values_list('h3_index', flat=True))
    built = {}
    for h, lvl in Building.objects.filter(territory__owner_id=owner_id, is_active=True,
                                          building_type=UPGRADES[key]['building']).values_list('territory__h3_index', 'level'):
        built[h] = max(built.get(h, 0), lvl)
    out = {}
    if not built:
        return out
    for comp in clusters(owned):
        lvl = max((built.get(h, 0) for h in comp), default=0)
        if lvl:
            for h in comp:
                out[h] = 1 + lvl * UPGRADES[key]['per_level'] / 100
    return out


def walls_mult(territory) -> float:
    if not territory.owner_id:
        return 1.0
    return 1 + levels_for(kingdom_of(territory.owner_id, territory.h3_index))['walls'] * UPGRADES['walls']['per_level'] / 100


def draft_size(player) -> dict:
    from terra_domini.apps.territories.models import Territory
    owned = set(Territory.objects.filter(owner=player).values_list('h3_index', flat=True))
    comps = clusters(owned)
    base = max(3, len(owned) // 3)
    size_bonus = sum(8 if len(c) >= 20 else 4 if len(c) >= 10 else 2 if len(c) >= 5 else 0 for c in comps)
    barracks = sum(levels_for(c)['barracks'] for c in comps) * UPGRADES['barracks']['per_level']
    from terra_domini.apps.territories.regions import controlled, REGION_DRAFT
    regions = len(controlled(player.id)) * REGION_DRAFT                 # Risk continents
    return {'base': base, 'kingdoms': size_bonus, 'barracks': barracks, 'regions': regions,
            'total': base + size_bonus + barracks + regions, 'territories': len(owned)}


def draft_available(player) -> bool:
    last = getattr(player, 'last_draft_at', None)
    return not last or last.date() < timezone.now().date()
