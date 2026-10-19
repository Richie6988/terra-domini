"""
Military overview. Since 2026-10-19 the military is 3 counters per kingdom (attack, defense, spy — combat/forces.py),
bought with POST /api/forces/buy/. Units, training queues and garrisons are no longer used by the game
(TrainingQueue / UNIT_DEFS stay only for old rows and the legacy engine helpers).

API:
  GET  /api/combat/my-army/      — every kingdom with its attack / defense / spy points, totals, prices, daily supplies
"""
import uuid
from datetime import timedelta
from django.db import models
from django.conf import settings
from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response


# ═══ MODEL ═══════════════════════════════════════════════════════

class TrainingQueue(models.Model):
    """A batch of units currently being trained."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    player = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='training_queue')
    unit_type = models.CharField(max_length=20)
    quantity = models.IntegerField(default=1)
    started_at = models.DateTimeField(auto_now_add=True)
    completes_at = models.DateTimeField()
    collected = models.BooleanField(default=False)

    class Meta:
        db_table = 'training_queue'
        ordering = ['completes_at']


# ═══ UNIT DEFINITIONS ════════════════════════════════════════════
# train_seconds = economy/balance.TRAIN_SECONDS (one unit); real time per player: combat/units.unit_seconds

UNIT_DEFS = {
    'infantry': {
        'name': 'Infantry', 'icon': 'swords',
        'atk': 10, 'def': 12, 'cost': 50,
        'train_seconds': 180,
        'desc': 'Holds ground: cheap and sturdy, best defender per HEX. +20% in cities, +10% in forests.',
    },
    'cavalry': {
        'name': 'Cavalry', 'icon': 'horse',
        'atk': 18, 'def': 8, 'cost': 120,
        'train_seconds': 360,
        'desc': 'Fast striker: strong attack, weak defence. +30% in the countryside, +20% on coasts.',
    },
    'artillery': {
        'name': 'Artillery', 'icon': 'bomb',
        'atk': 35, 'def': 4, 'cost': 300,
        'train_seconds': 720,
        'desc': 'Siege breaker: the hardest hitter, almost no defence.',
    },
    'aerial': {
        'name': 'Aerial', 'icon': 'plane',
        'atk': 25, 'def': 6, 'cost': 250,
        'train_seconds': 600,
        'desc': 'Air strike: high attack anywhere, -30% over mountains.',
    },
    'naval': {
        'name': 'Naval', 'icon': 'ship',
        'atk': 20, 'def': 15, 'cost': 200,
        'train_seconds': 480,
        'desc': 'Coast master: balanced, +50% on coastal hexes.',
    },
    'spy': {
        'name': 'Spy', 'icon': 'spy',
        'atk': 5, 'def': 3, 'cost': 150,
        'train_seconds': 300,
        'desc': "Saboteur: each spy sent cuts the target's fortifications by 4% (max -40%).",
    },
}


# ═══ VIEWS ═══════════════════════════════════════════════════════

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def my_army(request):
    """GET /api/combat/my-army/ — the military in 3 counters (combat/forces.py): every kingdom / lone territory with its
    attack, defense and spy points, the totals, the point prices and the daily supplies."""
    from terra_domini.apps.combat import forces as Fz
    player = request.user
    stations = _stations(player)
    total = {k: sum(st['forces'][k] for st in stations) for k in ('attack', 'defense', 'spy')}
    return Response({
        'forces': total, 'stations': stations, 'point_cost': Fz.POINT_COST,
        'spy_discount': {'per_point': Fz.SPY_DISCOUNT, 'max_points': Fz.SPY_MAX},
        'draft': {**_draft(player)},
    })


def _draft(player) -> dict:
    from terra_domini.apps.territories.upgrades import draft_size, draft_available
    return {**draft_size(player), 'available': draft_available(player)}


def _stations(player) -> list:
    """Each connected kingdom and each lone territory, with its forces counters."""
    from terra_domini.apps.combat import forces as Fz
    from terra_domini.apps.territories.models import Territory
    from terra_domini.apps.territories.upgrades import clusters
    rows = {h: (cn or poi or name, rarity) for h, cn, poi, name, rarity in Territory.objects.filter(owner=player)
            .values_list('h3_index', 'custom_name', 'poi_name', 'place_name', 'rarity')}
    order = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic']
    out = []
    for comp in clusters(set(rows)):
        anchor = max(comp, key=lambda c: (order.index(rows[c][1]) if rows[c][1] in order else 0, c))
        out.append({'h3': anchor, 'name': rows[anchor][0] or f'Zone {anchor[:8]}', 'size': len(comp),
                    'kind': 'kingdom' if len(comp) > 1 else 'territory', 'rarity': rows[anchor][1],
                    'forces': Fz.pools(comp), 'hexes': sorted(comp)})
    out.sort(key=lambda s: (-s['size'], -s['forces']['defense']))
    return out
