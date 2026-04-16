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

UNIT_DEFS = {
    'infantry': {
        'name': 'Infantry', 'icon': 'swords',
        'atk': 10, 'def': 12, 'cost': 50,
        'train_seconds': 3600,       # 1 hour
        'admin_train_seconds': 60,   # 1 min for admin
        'desc': 'Balanced ground troops. Strong in urban and forest terrain.',
    },
    'cavalry': {
        'name': 'Cavalry', 'icon': 'horse',
        'atk': 18, 'def': 8, 'cost': 120,
        'train_seconds': 7200,       # 2 hours
        'admin_train_seconds': 120,
        'desc': 'Fast attack unit. Excels in rural and coastal biomes.',
    },
    'artillery': {
        'name': 'Artillery', 'icon': 'bomb',
        'atk': 35, 'def': 4, 'cost': 300,
        'train_seconds': 14400,      # 4 hours
        'admin_train_seconds': 180,
        'desc': 'Heavy damage dealer. Slow but devastating firepower.',
    },
    'aerial': {
        'name': 'Aerial', 'icon': 'plane',
        'atk': 25, 'def': 6, 'cost': 250,
        'train_seconds': 10800,      # 3 hours
        'admin_train_seconds': 150,
        'desc': 'Air support unit. Ignores terrain penalties.',
    },
    'naval': {
        'name': 'Naval', 'icon': 'ship',
        'atk': 20, 'def': 15, 'cost': 200,
        'train_seconds': 7200,       # 2 hours
        'admin_train_seconds': 120,
        'desc': 'Maritime forces. Dominant on coastal territories.',
    },
    'spy': {
        'name': 'Spy', 'icon': 'spy',
        'atk': 5, 'def': 3, 'cost': 150,
        'train_seconds': 5400,       # 1.5 hours
        'admin_train_seconds': 90,
        'desc': 'Infiltration agent. Reveals enemy defenses before attack.',
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
    defs = {}
    for k, v in UNIT_DEFS.items():
        is_admin = player.is_staff
        defs[k] = {
            **v,
            'owned': unit_map.get(k, 0),
            'effective_train_seconds': v['admin_train_seconds'] if is_admin else v['train_seconds'],
        }

    # Kingdom force totals
    total_atk = sum(unit_map.get(k, 0) * v['atk'] for k, v in UNIT_DEFS.items())
    total_def = sum(unit_map.get(k, 0) * v['def'] for k, v in UNIT_DEFS.items())

    return Response({
        'units': defs,
        'training': training,
        'force': {'attack': total_atk, 'defense': total_def},
    })


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

    # Check concurrent training limit (max 3 queues)
    active = TrainingQueue.objects.filter(player=player, collected=False).count()
    if active >= 3:
        return Response({'error': 'Training queue full (max 3 concurrent). Collect finished units first.'}, status=400)

    udef = UNIT_DEFS[unit_type]
    total_cost = udef['cost'] * quantity
    balance = float(getattr(player, 'tdc_in_game', 0) or 0)

    if balance < total_cost:
        return Response({'error': f'Need {total_cost} HEX. You have {int(balance)}.'}, status=400)

    # Deduct cost
    player.tdc_in_game = balance - total_cost
    player.save(update_fields=['tdc_in_game'])

    # Training time: admin gets fast-track
    train_s = udef['admin_train_seconds'] if player.is_staff else udef['train_seconds']
    train_total = train_s * quantity
    now = timezone.now()

    tq = TrainingQueue.objects.create(
        player=player,
        unit_type=unit_type,
        quantity=quantity,
        completes_at=now + timedelta(seconds=train_total),
    )

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
        unit = MilitaryUnit.objects.get(player=player, unit_type=unit_type, status='garrison')
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
