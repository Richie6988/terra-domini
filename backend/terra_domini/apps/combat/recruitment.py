"""
Military recruitment system.

TrainingQueue: time-based unit training with countdown.
  - Normal players: training takes hours
  - Admin (is_staff): training takes minutes (fast-track)

API:
  GET  /api/combat/my-army/      — units + active training queues
  POST /api/combat/recruit/      — start training {unit_type, quantity}
  POST /api/combat/collect/      — collect finished training into MilitaryUnit
  POST /api/combat/assign/       — assign units to kingdom {unit_type, count, kingdom_id}
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
    """GET /api/combat/my-army/ — player's units + training queues."""
    from terra_domini.apps.combat.engine import MilitaryUnit
    player = request.user
    now = timezone.now()

    # Units (grouped by type)
    units = MilitaryUnit.objects.filter(player=player).values('unit_type').annotate(
        total=models.Sum('count')
    )
    unit_map = {u['unit_type']: u['total'] for u in units}
    reserve = {u['unit_type']: u['total'] for u in MilitaryUnit.objects.filter(player=player, territory__isnull=True)
               .values('unit_type').annotate(total=models.Sum('count'))}

    # Training queues
    queues = TrainingQueue.objects.filter(player=player, collected=False).order_by('completes_at')
    training = []
    for q in queues:
        remaining = max(0, int((q.completes_at - now).total_seconds()))
        training.append({
            'id': str(q.id),
            'unit_type': q.unit_type,
            'quantity': q.quantity,
            'started_at': q.started_at.isoformat(),
            'completes_at': q.completes_at.isoformat(),
            'remaining_seconds': remaining,
            'done': remaining <= 0,
        })

    # Unit defs for frontend
    from terra_domini.apps.combat import units as U
    levels = U.levels_of(player)
    defs = {}
    for k, v in UNIT_DEFS.items():
        lvl = int(levels.get(k, 0))
        defs[k] = {
            **v,
            'owned': unit_map.get(k, 0),
            'available': reserve.get(k, 0),   # not stationed: can attack or be sent to defend
            'level': lvl, 'max_level': U.UNIT_LEVEL_MAX,
            'atk': round(v['atk'] * U.level_mult(lvl), 1), 'def': round(v['def'] * U.level_mult(lvl), 1),
            'base_atk': v['atk'], 'base_def': v['def'],
            'effective_train_seconds': U.unit_seconds(player, k),     # per unit, one after another
            'upgrade_cost': U.upgrade_cost(k, lvl) if lvl < U.UNIT_LEVEL_MAX else None,
            'role': U.ROLES.get(k, ('', ''))[0], 'how': U.ROLES.get(k, ('', ''))[1],
        }

    # Kingdom force totals
    total_atk = round(sum(unit_map.get(k, 0) * v['atk'] * U.level_mult(levels.get(k)) for k, v in UNIT_DEFS.items()))
    total_def = round(sum(unit_map.get(k, 0) * v['def'] * U.level_mult(levels.get(k)) for k, v in UNIT_DEFS.items()))

    return Response({
        'units': defs,
        'training': training,
        'force': {'attack': total_atk, 'defense': total_def},
        'stations': _stations(player),
        'draft': {**_draft(player)},
        'queue': {'cap': U.QUEUE_CAP, 'waiting': sum(1 for t in training if not t['done'])},
        'rank': int(getattr(player, 'commander_rank', 1) or 1),
    })


def _draft(player) -> dict:
    from terra_domini.apps.territories.upgrades import draft_size, draft_available
    return {**draft_size(player), 'available': draft_available(player)}


def _stations(player) -> list:
    """Where forces can be stationed: each connected kingdom (2+ hexes) and each lone territory.
    Units stationed on any hex of a kingdom defend every hex of it (combat.engine.kingdom_garrisons)."""
    from terra_domini.apps.combat.engine import MilitaryUnit
    from terra_domini.apps.territories.models import Territory
    from terra_domini.utils.h3_compat import k_ring
    rows = {h: (cn or poi or name, rarity) for h, cn, poi, name, rarity in Territory.objects.filter(owner=player)
            .values_list('h3_index', 'custom_name', 'poi_name', 'place_name', 'rarity')}
    gar = {}
    for h, ut, c in MilitaryUnit.objects.filter(player=player, territory__isnull=False, count__gt=0) \
            .values_list('territory__h3_index', 'unit_type', 'count'):
        gar.setdefault(h, {})[ut] = gar.get(h, {}).get(ut, 0) + c
    seen, out = set(), []
    order = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic']
    for h in rows:
        if h in seen:
            continue
        comp, todo = {h}, [h]
        while todo:
            for n in k_ring(todo.pop(), 1):
                if n in rows and n not in comp:
                    comp.add(n); todo.append(n)
        seen |= comp
        units = {}
        for c in comp:
            for ut, n in gar.get(c, {}).items():
                units[ut] = units.get(ut, 0) + n
        anchor = max(comp, key=lambda c: (order.index(rows[c][1]) if rows[c][1] in order else 0, c in gar))
        out.append({'h3': anchor, 'name': rows[anchor][0] or f'Zone {anchor[:8]}', 'size': len(comp),
                    'kind': 'kingdom' if len(comp) > 1 else 'territory', 'rarity': rows[anchor][1],
                    'units': units, 'defense': sum(UNIT_DEFS[k]['def'] * v for k, v in units.items() if k in UNIT_DEFS),
                    'hexes': sorted(comp)})
    out.sort(key=lambda s: (-s['size'], -s['defense']))
    return out[:40]


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def recruit(request):
    """POST /api/combat/recruit/ — start training units.
    Body: {unit_type: str, quantity: int}
    """
    player = request.user
    unit_type = request.data.get('unit_type', '')
    quantity = int(request.data.get('quantity', 1))

    if unit_type not in UNIT_DEFS:
        return Response({'error': f'Unknown unit type: {unit_type}'}, status=400)
    if quantity < 1 or quantity > 100:
        return Response({'error': 'Quantity must be 1-100'}, status=400)

    # One barracks queue: units come out one by one, each with its own time (combat/units.py)
    from terra_domini.apps.combat.units import QUEUE_CAP, unit_seconds
    waiting = TrainingQueue.objects.filter(player=player, collected=False, completes_at__gt=timezone.now()).count()
    if waiting + quantity > QUEUE_CAP:
        return Response({'error': f'Barracks queue full: {max(0, QUEUE_CAP - waiting)} place(s) left (max {QUEUE_CAP} units waiting).'}, status=400)

    udef = UNIT_DEFS[unit_type]
    total_cost = udef['cost'] * quantity
    balance = float(getattr(player, 'tdc_in_game', 0) or 0)

    if balance < total_cost:
        return Response({'error': f'Need {total_cost} HEX. You have {int(balance)}.'}, status=400)

    # Deduct cost
    player.tdc_in_game = balance - total_cost
    player.save(update_fields=['tdc_in_game'])
    from terra_domini.apps.economy.balance import consume_purchased_first
    from terra_domini.apps.progression.missions import track
    consume_purchased_first(player, total_cost)
    track(player, 'recruit', quantity)
    track(player, 'spend_tdc', total_cost)

    now = timezone.now()
    last = TrainingQueue.objects.filter(player=player, collected=False).order_by('-completes_at').values_list('completes_at', flat=True).first()
    start = max(now, last) if last else now
    per = unit_seconds(player, unit_type)
    rows = []
    for k in range(quantity):
        rows.append(TrainingQueue(player=player, unit_type=unit_type, quantity=1,
                                  completes_at=start + timedelta(seconds=per * (k + 1))))
    TrainingQueue.objects.bulk_create(rows)
    tq = rows[-1]
    train_total = int((tq.completes_at - now).total_seconds())

    return Response({
        'success': True,
        'queue_id': str(tq.id),
        'unit_type': unit_type,
        'quantity': quantity,
        'cost': total_cost,
        'remaining_balance': float(player.tdc_in_game),
        'completes_at': tq.completes_at.isoformat(),
        'train_seconds': train_total,
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def collect_training(request):
    """POST /api/combat/collect/ — collect all finished training queues.
    Creates/updates MilitaryUnit records.
    """
    from terra_domini.apps.combat.engine import MilitaryUnit
    player = request.user
    now = timezone.now()

    finished = TrainingQueue.objects.filter(
        player=player, collected=False, completes_at__lte=now
    )
    collected = []
    for q in finished:
        # Find or create unit record
        unit, created = MilitaryUnit.objects.get_or_create(
            player=player,
            unit_type=q.unit_type,
            status='garrison',
            territory=None,  # free army pool (territory garrisons are separate stacks)
            defaults={'count': 0},
        )
        unit.count += q.quantity
        unit.save(update_fields=['count'])
        q.collected = True
        q.save(update_fields=['collected'])
        collected.append({'unit_type': q.unit_type, 'quantity': q.quantity})

    return Response({
        'collected': collected,
        'total_collected': sum(c['quantity'] for c in collected),
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def assign_to_kingdom(request):
    """POST /api/combat/assign/ — assign units to a kingdom for ATK/DEF.
    Body: {kingdom_h3: str, unit_type: str, count: int}
    """
    from terra_domini.apps.combat.engine import MilitaryUnit
    from terra_domini.apps.territories.models import Territory

    player = request.user
    kingdom_h3 = request.data.get('kingdom_h3', '')
    unit_type = request.data.get('unit_type', '')
    count = int(request.data.get('count', 1))

    if unit_type not in UNIT_DEFS:
        return Response({'error': 'Unknown unit type'}, status=400)

    # Check player owns territory
    try:
        territory = Territory.objects.get(h3_index=kingdom_h3, owner=player)
    except Territory.DoesNotExist:
        return Response({'error': 'Territory not found or not owned'}, status=404)

    # Check available units
    try:
        unit = MilitaryUnit.objects.get(player=player, unit_type=unit_type, status='garrison', territory=None)
    except MilitaryUnit.DoesNotExist:
        return Response({'error': f'No {unit_type} units available'}, status=400)

    if unit.count < count:
        return Response({'error': f'Only {unit.count} {unit_type} available'}, status=400)

    # Move units from garrison to territory
    unit.count -= count
    unit.save(update_fields=['count'])

    # Create/update territory garrison
    garrison, _ = MilitaryUnit.objects.get_or_create(
        player=player, unit_type=unit_type, territory=territory,
        defaults={'count': 0, 'status': 'garrison'},
    )
    garrison.count += count
    garrison.save(update_fields=['count'])

    udef = UNIT_DEFS[unit_type]
    return Response({
        'success': True,
        'assigned': {'unit_type': unit_type, 'count': count, 'territory': kingdom_h3},
        'atk_added': udef['atk'] * count,
        'def_added': udef['def'] * count,
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def unassign_units(request):
    """POST /api/combat/unassign/ {h3, unit_type, count} — bring stationed units back to the free army
    (from any hex of the kingdom that contains h3)."""
    from terra_domini.apps.combat.engine import MilitaryUnit
    from terra_domini.apps.territories.models import Territory
    from django.db import transaction
    player = request.user
    unit_type, count = request.data.get('unit_type', ''), int(request.data.get('count', 1) or 1)
    station = next((s for s in _stations(player) if request.data.get('h3') in s['hexes']), None)
    if not station or unit_type not in UNIT_DEFS or count < 1:
        return Response({'error': 'Nothing stationed there'}, status=404)
    with transaction.atomic():
        left = count
        for g in MilitaryUnit.objects.select_for_update().filter(player=player, unit_type=unit_type, count__gt=0,
                                                                  territory__h3_index__in=station['hexes']):
            take = min(left, g.count)
            g.count -= take; g.save(update_fields=['count'])
            left -= take
            if not left:
                break
        moved = count - left
        if not moved:
            return Response({'error': f'No {unit_type} stationed there'}, status=400)
        pool, _ = MilitaryUnit.objects.get_or_create(player=player, unit_type=unit_type, territory=None,
                                                     status='garrison', defaults={'count': 0})
        pool.count += moved; pool.save(update_fields=['count'])
    return Response({'success': True, 'moved': moved, 'unit_type': unit_type})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def upgrade_unit(request):
    """POST /api/combat/unit-upgrade/ {unit_type} — next level: +10 % atk/def, −10 % training time (combat/units.py)."""
    from django.db import transaction
    from django.db.models import F
    from terra_domini.apps.accounts.models import Player
    from terra_domini.apps.combat import units as U
    from terra_domini.apps.economy.balance import consume_purchased_first
    unit_type = request.data.get('unit_type', '')
    if unit_type not in UNIT_DEFS:
        return Response({'error': 'Unknown unit'}, status=400)
    with transaction.atomic():
        p = Player.objects.select_for_update().get(id=request.user.id)
        levels = U.levels_of(p)
        lvl = int(levels.get(unit_type, 0))
        if lvl >= U.UNIT_LEVEL_MAX:
            return Response({'error': 'Already at max level'}, status=400)
        cost = U.upgrade_cost(unit_type, lvl)
        if float(p.tdc_in_game or 0) < cost:
            return Response({'error': f'Need {cost:,} HEX'}, status=402)
        levels[unit_type] = lvl + 1
        Player.objects.filter(id=p.id).update(tdc_in_game=F('tdc_in_game') - cost, unit_levels=levels)
        p.refresh_from_db(fields=['tdc_in_game'])
    consume_purchased_first(p, cost)
    return Response({'success': True, 'unit_type': unit_type, 'level': lvl + 1, 'cost': cost, 'balance': float(p.tdc_in_game)})
