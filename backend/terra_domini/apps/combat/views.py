"""
Combat views — launch attacks, view battles, join alliance assaults.
"""
import logging
from django.utils import timezone
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from terra_domini.apps.combat.engine import Battle, BattleParticipant, MilitaryUnit, CombatEngine

logger = logging.getLogger('terra_domini.combat')


class BattleViewSet(viewsets.GenericViewSet):
    permission_classes = [IsAuthenticated]

    def list(self, request):
        """GET /api/battles/ — player's battle history (as attacker or defender)."""
        from terra_domini.apps.combat.engine import Battle
        from terra_domini.apps.combat.serializers import BattleSerializer
        limit = min(int(request.query_params.get('limit', 20)), 50)

        # Player is attacker via BattleParticipant, or defender via Battle.defender
        from terra_domini.apps.combat.engine import BattleParticipant
        attack_ids = BattleParticipant.objects.filter(
            player=request.user, is_commander=True
        ).values_list('battle_id', flat=True)

        from django.db.models import Q
        qs = Battle.objects.filter(
            Q(id__in=attack_ids) | Q(defender=request.user)
        ).select_related('target_territory', 'defender').prefetch_related(
            'participants__player'
        ).order_by('-started_at')[:limit]

        return Response({
            'count': qs.count(),
            'results': BattleSerializer(qs, many=True).data,
        })

    permission_classes = [IsAuthenticated]

    @action(detail=False, methods=['POST'], url_path='attack')
    def launch_attack(self, request):
        """
        POST /api/combat/attack/
        {target_h3: str, attack_type: 'conquest'|'raid'|'surprise', units: {infantry: N, ...}}
        """
        from terra_domini.apps.territories.models import Territory

        target_h3    = request.data.get('target_h3', '')
        attack_type  = request.data.get('attack_type', 'conquest')
        units_data   = request.data.get('units', {'infantry': 50})

        if not target_h3:
            return Response({'error': 'target_h3 required'}, status=400)

        try:
            target = Territory.objects.select_related('owner').get(h3_index=target_h3)
        except Territory.DoesNotExist:
            return Response({'error': 'Territory not found'}, status=404)

        if not target.owner:
            return Response({'error': 'Territory not claimed — use /claim instead'}, status=400)

        if target.owner == request.user:
            return Response({'error': 'Cannot attack your own territory'}, status=400)

        if target.is_shielded:
            return Response({
                'error': 'Territory is shielded',
                'shield_expires': target.shield_expires_at.isoformat()
            }, status=409)

        # Check if player already attacking this target
        # ── Stamina check ──────────────────────────────────────────────────
        from terra_domini.apps.accounts.models import Player as P
        player_obj = P.objects.get(id=request.user.id)
        if not player_obj.consume_action_slot():
            next_ready = player_obj.next_slot_ready_in_seconds
            hours = int(next_ready // 3600)
            mins  = int((next_ready % 3600) // 60)
            return Response({
                'error': 'No action slots available',
                'slots_used': player_obj.action_slots_used,
                'slots_max': player_obj.action_slots_max,
                'next_slot_in_seconds': int(next_ready),
                'next_slot_label': f'{hours}h {mins}m' if hours else f'{mins}m',
                'regen_bonus_pct': player_obj.regen_bonus_pct,
            }, status=429)

        if Battle.objects.filter(
            attacker=request.user,
            territory=target,
            status__in=['preparing', 'active']
        ).exists():
            return Response({'error': 'Already attacking this territory'}, status=409)

        battle = CombatEngine.initiate_battle(
            attacker=request.user,
            territory=target,
            attack_type=attack_type,
            attacker_units=units_data,
        )

        # Map overlay event for attack
        try:
            from terra_domini.apps.territories.models import MapOverlayEvent
            import datetime
            MapOverlayEvent.objects.create(
                event_type='attack_wave', player=request.user, territory=target,
                to_lat=target.center_lat, to_lon=target.center_lon,
                title=f'⚔️ {request.user.username} attacks {target.place_name or target.h3_index[:8]}',
                body=f'{attack_type} · {sum(units_data.values())} units',
                icon_emoji='⚔️', is_active=True,
                expires_at=timezone.now() + datetime.timedelta(hours=1),
            )
        except Exception:
            pass

        return Response({
            'battle_id': str(battle.id),
            'attack_type': attack_type,
            'target': target.place_name or target_h3,
            'defender': target.owner.username,
            'starts_at': battle.starts_at.isoformat(),
            'ends_at': battle.ends_at.isoformat(),
            'attacker_power': battle.attacker_power,
            'message': f"Attack launched! Battle resolves in {int((battle.ends_at - timezone.now()).total_seconds() / 3600)}h.",
        }, status=201)

    @action(detail=False, methods=['GET'], url_path='active')
    def active_battles(self, request):
        """GET /api/combat/active/ — player's ongoing battles"""
        battles = Battle.objects.filter(
            attacker=request.user,
            status__in=['preparing', 'active']
        ).select_related('territory', 'territory__owner').order_by('ends_at')

        data = [{
            'id': str(b.id),
            'target': b.territory.place_name or b.territory.h3_index,
            'defender': b.territory.owner.username if b.territory.owner else 'Unclaimed',
            'attack_type': b.attack_type,
            'status': b.status,
            'ends_at': b.ends_at.isoformat(),
            'hours_remaining': max(0, round((b.ends_at - timezone.now()).total_seconds() / 3600, 1)),
            'attacker_power': b.attacker_power,
            'defender_power': b.defender_power,
        } for b in battles]

        return Response({'battles': data, 'count': len(data)})

    @action(detail=False, methods=['GET'], url_path='incoming')
    def incoming_attacks(self, request):
        """GET /api/combat/incoming/ — attacks on player's territories"""
        my_territory_ids = request.user.territories.values_list('id', flat=True)
        battles = Battle.objects.filter(
            territory__in=my_territory_ids,
            status__in=['preparing', 'active']
        ).select_related('attacker', 'territory').order_by('ends_at')

        data = [{
            'id': str(b.id),
            'territory': b.territory.place_name or b.territory.h3_index,
            'attacker': b.attacker.username,
            'attack_type': b.attack_type,
            'ends_at': b.ends_at.isoformat(),
            'hours_remaining': max(0, round((b.ends_at - timezone.now()).total_seconds() / 3600, 1)),
        } for b in battles]

        return Response({'incoming': data, 'count': len(data)})

    @action(detail=True, methods=['GET'], url_path='detail')
    def battle_detail(self, request, pk=None):
        try:
            battle = Battle.objects.select_related(
                'attacker', 'territory', 'territory__owner', 'defending_alliance'
            ).get(id=pk)
        except Battle.DoesNotExist:
            return Response({'error': 'Battle not found'}, status=404)

        # Only show to involved parties
        if battle.attacker != request.user and battle.territory.owner != request.user:
            return Response({'error': 'Not authorized'}, status=403)

        return Response({
            'id': str(battle.id),
            'attacker': battle.attacker.username,
            'territory': battle.territory.place_name or battle.territory.h3_index,
            'defender': battle.territory.owner.username if battle.territory.owner else None,
            'attack_type': battle.attack_type,
            'status': battle.status,
            'attacker_power': battle.attacker_power,
            'defender_power': battle.defender_power,
            'starts_at': battle.starts_at.isoformat(),
            'ends_at': battle.ends_at.isoformat(),
            'result': battle.result,
            'loot': battle.loot,
        })

    @action(detail=False, methods=['GET'], url_path='history')
    def history(self, request):
        """GET /api/combat/history/ — resolved battles"""
        battles = Battle.objects.filter(
            attacker=request.user,
            status__in=['won', 'lost', 'cancelled']
        ).select_related('territory').order_by('-ends_at')[:50]

        data = [{
            'id': str(b.id),
            'target': b.territory.place_name or b.territory.h3_index,
            'attack_type': b.attack_type,
            'status': b.status,
            'result': b.result,
            'ended_at': b.ends_at.isoformat(),
        } for b in battles]

        return Response({'history': data})


    @action(detail=False, methods=['POST'], url_path='recruit')
    def recruit(self, request):
        """POST /api/combat/recruit/ {unit_type, quantity}"""
        unit_type = request.data.get('unit_type', '')
        quantity = int(request.data.get('quantity', 0))

        UNIT_COSTS = {
            'infantry': 5, 'naval': 15, 'aerial': 25,
            'engineer': 20, 'medic': 30, 'spy': 100,
        }

        if unit_type not in UNIT_COSTS:
            return Response({'error': f'Unknown unit type: {unit_type}'}, status=400)
        if quantity <= 0 or quantity > 500:
            return Response({'error': 'Quantity must be 1-500'}, status=400)

        cost = UNIT_COSTS[unit_type] * quantity
        player = request.user

        if float(player.tdc_in_game) < cost:
            return Response({'error': f'Not enough HEX. Need {cost}, have {player.tdc_in_game}'}, status=400)

        from django.db.models import F
        from terra_domini.apps.accounts.models import Player
        Player.objects.filter(id=player.id).update(tdc_in_game=F('tdc_in_game') - cost)

        # TODO: Track units in a PlayerArmy model. For now, just deduct cost.
        return Response({
            'recruited': quantity,
            'unit_type': unit_type,
            'cost': cost,
            'message': f'Recruited {quantity} {unit_type} for {cost} HEX',
        })
