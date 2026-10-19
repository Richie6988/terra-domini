"""
Kingdom upgrades + daily supplies (simplified 2026-10-19: the military is 3 counters, combat/forces.py).

A kingdom = a connected group of owned hexes. Each upgrade has levels 0-5, bought with HEX, stored as a Building on the
hex where it was bought; a kingdom's level = the best building inside it (split a kingdom and the building stays put).
  influence  +2 hexes of attack range per level (the best kingdom counts)   (combat.engine.can_attack)
  science    +5 % HEX production of the kingdom per level                   (economy.balance.territory_rates)
Daily supplies: once a day, max(3, territories / 3) + kingdom size bonuses (5+ hexes +2, 10+ +4, 20+ +8 each)
+ 3 per controlled region (territories/regions.py), × SUPPLY_PER_DRAFT attack AND defense points on the biggest kingdom.
"""
from django.utils import timezone

UPGRADES = {
    'influence': {'building': 'market',   'name': 'Influence', 'base_cost': 1500, 'per_level': 2,  'unit': ' hexes attack range'},
    'science':   {'building': 'lab',      'name': 'Science',   'base_cost': 2000, 'per_level': 5,  'unit': '% HEX production'},
}
MAX_LEVEL = 5
SUPPLY_PER_DRAFT = 5      # daily supplies: 5 attack + 5 defense points per draft unit
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
    """h3 → (1 + level × per_level %) for every owned hex (science), one query per player."""
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


def draft_size(player) -> dict:
    from terra_domini.apps.territories.models import Territory
    owned = set(Territory.objects.filter(owner=player).values_list('h3_index', flat=True))
    comps = clusters(owned)
    base = max(3, len(owned) // 3)
    size_bonus = sum(8 if len(c) >= 20 else 4 if len(c) >= 10 else 2 if len(c) >= 5 else 0 for c in comps)
    from terra_domini.apps.territories.regions import controlled, REGION_DRAFT
    regions = len(controlled(player.id)) * REGION_DRAFT                 # Risk continents
    total = base + size_bonus + regions
    # daily supplies (combat/forces.py): SUPPLY_PER_DRAFT attack AND defense points per draft unit, on the biggest kingdom
    return {'base': base, 'kingdoms': size_bonus, 'regions': regions, 'total': total,
            'points': total * SUPPLY_PER_DRAFT, 'territories': len(owned)}


def draft_available(player) -> bool:
    last = getattr(player, 'last_draft_at', None)
    return not last or last.date() < timezone.now().date()


def influence_rings(player_id) -> int:
    """Extra attack range from the best Influence level among the player's kingdoms."""
    from terra_domini.apps.territories.models import Building
    lvl = max(Building.objects.filter(territory__owner_id=player_id, is_active=True, building_type=UPGRADES['influence']['building'])
              .values_list('level', flat=True), default=0)
    return lvl * UPGRADES['influence']['per_level']
