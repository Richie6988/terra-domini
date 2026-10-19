"""
Forces — the whole military in 3 counters (owner 2026-10-19: "only 3 categories: attack, defense and spy; HEX raise
them; shown above the kingdom or territory; attack and defense are spent 1 for 1 against another player; spies lower
the cost of discovering a territory. A simpler game = better immersion").

- Points are stored on the hexes (Territory.atk_pts / def_pts / spy_pts); a kingdom's counter = the sum over its hexes.
- Bought with HEX on any of your hexes (POINT_COST each).
- Attack: you commit N attack points from the kingdom nearest to the target. When the battle timer ends, they meet the
  target kingdom's defense 1 for 1: both lose min(N, DEF). N > DEF → the hex is yours and the leftover attack points
  stay on it. The defender can buy defense until the timer ends.
- Spy: each spy point spent on a discovery (buy or explore) cuts its price and its time by SPY_DISCOUNT (max SPY_MAX).
"""
from django.db.models import F

POINT_COST = {'attack': 10, 'defense': 10, 'spy': 20}
FIELD = {'attack': 'atk_pts', 'defense': 'def_pts', 'spy': 'spy_pts'}
SPY_DISCOUNT, SPY_MAX = 0.05, 10          # −5 % per spy point, up to 10 points (−50 %)
DAILY_SUPPLY_KINDS = ('attack', 'defense')


def kingdom_hexes(owner_id, h3_index) -> list:
    from terra_domini.apps.territories.upgrades import kingdom_of
    return sorted(kingdom_of(owner_id, h3_index))


def pools(hexes) -> dict:
    """{'attack', 'defense', 'spy'} totals over these hexes."""
    from django.db.models import Sum
    from terra_domini.apps.territories.models import Territory
    agg = Territory.objects.filter(h3_index__in=list(hexes)).aggregate(a=Sum('atk_pts'), d=Sum('def_pts'), s=Sum('spy_pts'))
    return {'attack': agg['a'] or 0, 'defense': agg['d'] or 0, 'spy': agg['s'] or 0}


def add(h3_index, kind: str, n: int) -> None:
    from terra_domini.apps.territories.models import Territory
    Territory.objects.filter(h3_index=h3_index).update(**{FIELD[kind]: F(FIELD[kind]) + int(n)})


def take(hexes, kind: str, n: int) -> int:
    """Remove up to n points of this kind from these hexes (richest first). Returns how many were taken."""
    from terra_domini.apps.territories.models import Territory
    left, f = int(n), FIELD[kind]
    for h, have in Territory.objects.filter(h3_index__in=list(hexes), **{f'{f}__gt': 0}).order_by(f'-{f}').values_list('h3_index', f):
        if left <= 0:
            break
        k = min(have, left)
        Territory.objects.filter(h3_index=h).update(**{f: F(f) - k})
        left -= k
    return int(n) - left


def nearest_owned(player_id, target_h3, max_rings: int = 60):
    """(owned hex closest to the target, distance in rings) — (None, None) when the player owns nothing."""
    import h3
    from terra_domini.apps.territories.models import Territory
    best, dist = None, None
    for h in Territory.objects.filter(owner_id=player_id).values_list('h3_index', flat=True):
        try:
            d = h3.grid_distance(h, target_h3)
        except Exception:
            continue
        if dist is None or d < dist:
            best, dist = h, d
    return best, dist


def source_kingdom(player_id, target_h3) -> list:
    """Hexes of the kingdom an attack on target_h3 starts from (the one nearest to it)."""
    h, _ = nearest_owned(player_id, target_h3)
    return kingdom_hexes(player_id, h) if h else []


def spy_discount(points: int) -> float:
    return min(SPY_MAX, max(0, int(points or 0))) * SPY_DISCOUNT
