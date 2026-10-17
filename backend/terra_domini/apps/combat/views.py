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

    @action(detail=False, methods=['POST'], url_path='attack')
    def launch_attack(self, request):
        """
        POST /api/combat/attack/
        {target_h3: str, attack_type: 'conquest'|'raid'|'siege'|'surprise', units: {infantry: N, ...}}
        Battle resolves after a timer (see CombatEngine._get_battle_timer), not instantly.
        """
        from terra_domini.apps.territories.models import Territory

        target_h3   = request.data.get('target_h3', '')
        attack_type = request.data.get('attack_type') or request.data.get('battle_type') or 'conquest'
        units_data  = request.data.get('units') or {}

        if not target_h3:
            return Response({'error': 'target_h3 required'}, status=400)
        if attack_type not in Battle.BattleType.values:
            return Response({'error': f'Unknown attack type: {attack_type}'}, status=400)

        try:
            target = Territory.objects.select_related('owner').get(h3_index=target_h3)
        except Territory.DoesNotExist:
            return Response({'error': 'Territory not found'}, status=404)

        ok, reason = CombatEngine.can_attack(request.user, target)
        if not ok:
            return Response({'error': reason}, status=409 if target.owner_id else 400)

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

        ok, reason, battle = CombatEngine.initiate_attack(
            attacker=request.user,
            target_territory=target,
            units=units_data,
            battle_type=attack_type,
        )
        if not ok:
            # Refund the slot — nothing was launched
            from django.db.models import F
            P.objects.filter(id=player_obj.id, action_slots_used__gt=0).update(
                action_slots_used=F('action_slots_used') - 1)
            return Response({'error': reason}, status=400)

        # Map overlay event for attack
        try:
            from terra_domini.apps.territories.models import MapOverlayEvent
            import datetime
            MapOverlayEvent.objects.create(
                event_type='attack_wave', player=request.user, territory=target,
                to_lat=target.center_lat, to_lon=target.center_lon,
                title=f'{request.user.username} attacks {target.place_name or target.h3_index[:8]}',
                body=f'{attack_type} · {sum(int(v or 0) for v in units_data.values())} units',
                icon_emoji='⚔️', is_active=True,
                expires_at=timezone.now() + datetime.timedelta(hours=1),
            )
        except Exception:
            pass

        hours = (battle.resolves_at - timezone.now()).total_seconds() / 3600
        return Response({
            **_battle_row(battle),
            'battle_id': str(battle.id),
            'message': f"Attack launched! Battle resolves in {hours:.1f}h.",
        }, status=201)

    @action(detail=False, methods=['GET'], url_path='active')
    def active_battles(self, request):
        """GET /api/combat/active/ — player's ongoing attacks"""
        mine = Battle.objects.filter(
            participants__player=request.user, participants__side=BattleParticipant.Side.ATTACKER)
        CombatEngine.resolve_due(mine)
        battles = mine.filter(status__in=ACTIVE_STATUSES).select_related(
            'target_territory', 'defender').order_by('resolves_at')
        data = [_battle_row(b) for b in battles]
        return Response({'battles': data, 'count': len(data)})

    @action(detail=False, methods=['GET'], url_path='incoming')
    def incoming_attacks(self, request):
        """GET /api/combat/incoming/ — attacks on player's territories"""
        incoming = Battle.objects.filter(defender=request.user)
        CombatEngine.resolve_due(incoming)
        battles = incoming.filter(status__in=ACTIVE_STATUSES).select_related(
            'target_territory', 'defender').prefetch_related('participants__player').order_by('resolves_at')
        data = [_battle_row(b) for b in battles]
        return Response({'incoming': data, 'count': len(data)})

    @action(detail=True, methods=['GET'], url_path='detail')
    def battle_detail(self, request, pk=None):
        try:
            battle = Battle.objects.select_related('target_territory', 'defender').get(id=pk)
        except (Battle.DoesNotExist, ValueError):
            return Response({'error': 'Battle not found'}, status=404)

        # Only show to involved parties
        if battle.defender_id != request.user.id and not battle.participants.filter(player=request.user).exists():
            return Response({'error': 'Not authorized'}, status=403)

        return Response({**_battle_row(battle), 'combat_log': battle.combat_log})

    @action(detail=False, methods=['GET'], url_path='history')
    def history(self, request):
        """GET /api/combat/history/ — resolved battles"""
        battles = Battle.objects.filter(
            participants__player=request.user,
            status__in=[Battle.BattleStatus.COMPLETED, Battle.BattleStatus.CANCELLED],
        ).select_related('target_territory', 'defender').order_by('-completed_at')[:50]
        return Response({'history': [_battle_row(b) for b in battles]})


ACTIVE_STATUSES = [Battle.BattleStatus.PREPARING, Battle.BattleStatus.ACTIVE, Battle.BattleStatus.RESOLVING]


def _battle_row(b):
    t = b.target_territory
    commander = next((p for p in b.participants.all() if p.is_commander), None)
    return {
        'id': str(b.id),
        'target_h3': t.h3_index,
        'target': t.place_name or t.h3_index,
        'attacker': commander.player.username if commander else None,
        'defender': b.defender.username if b.defender else 'Unclaimed',
        'attack_type': b.battle_type,
        'status': b.status,
        'units': commander.units_deployed if commander else {},
        'started_at': b.started_at.isoformat(),
        'ends_at': b.resolves_at.isoformat(),
        'hours_remaining': max(0, round((b.resolves_at - timezone.now()).total_seconds() / 3600, 1)),
        'winner': b.winner or None,
        'territory_captured': b.territory_captured,
    }
