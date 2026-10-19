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
        {target_h3: str, attack_type: 'conquest'|'surprise', points: N}   N attack points from your nearest kingdom
        Battle resolves after a timer (see CombatEngine._get_battle_timer), not instantly.
        """
        from terra_domini.apps.territories.models import Territory

        target_h3   = request.data.get('target_h3', '')
        attack_type = request.data.get('attack_type') or request.data.get('battle_type') or 'conquest'
        try:
            points = int(request.data.get('points') or 0)
        except (TypeError, ValueError):
            points = 0

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
            points=points,
            battle_type=attack_type,
        )
        if not ok:
            # Refund the slot — nothing was launched
            from django.db.models import F
            P.objects.filter(id=player_obj.id, action_slots_used__gt=0).update(
                action_slots_used=F('action_slots_used') - 1)
            return Response({'error': reason}, status=400)

        from terra_domini.apps.progression.missions import track
        track(request.user, 'win_battles')

        # Map overlay event for attack
        try:
            from terra_domini.apps.territories.models import MapOverlayEvent
            import datetime
            MapOverlayEvent.objects.create(
                event_type='attack_wave', player=request.user, territory=target,
                to_lat=target.center_lat, to_lon=target.center_lon,
                title=f'{request.user.username} attacks {target.place_name or target.h3_index[:8]}',
                body=f'{attack_type} · {points} attack points',
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

    @action(detail=False, methods=['GET'], url_path='preview')
    def preview(self, request):
        """GET /api/combat/preview/?target_h3= — what the attack screen needs (combat/forces.py): the attack points of your
        nearest kingdom, the target kingdom's defense points (shown above it on the map anyway), the battle timer."""
        from terra_domini.apps.territories.models import Territory
        from terra_domini.apps.combat import forces as Fz
        try:
            t = Territory.objects.select_related('owner').get(h3_index=request.query_params.get('target_h3', ''))
        except Territory.DoesNotExist:
            return Response({'error': 'Territory not found'}, status=404)
        ok, reason = CombatEngine.can_attack(request.user, t)
        timer = CombatEngine._get_battle_timer(t)
        src = Fz.source_kingdom(request.user.id, t.h3_index)
        target = Fz.kingdom_hexes(t.owner_id, t.h3_index) if t.owner_id else [t.h3_index]
        return Response({
            'can_attack': ok, 'reason': reason, 'owner': t.owner.username if t.owner else None,
            'my_attack': Fz.pools(src)['attack'] if src else 0, 'source_size': len(src),
            'target_defense': Fz.pools(target)['defense'], 'target_size': len(target),
            'point_cost': Fz.POINT_COST, 'timer_seconds': {'conquest': timer, 'surprise': timer // 2},
        })

    @action(detail=False, methods=['POST'], url_path='reinforce')
    def reinforce(self, request):
        """POST /api/combat/reinforce/ {battle_id, points} — the defender buys defense points on the attacked kingdom."""
        from terra_domini.apps.combat import forces as Fz
        try:
            battle = Battle.objects.select_related('target_territory').get(
                id=request.data.get('battle_id'), defender=request.user, status=Battle.BattleStatus.ACTIVE)
        except (Battle.DoesNotExist, ValueError, Exception):
            return Response({'error': 'No active attack on your territory with this id'}, status=404)
        if battle.resolves_at <= timezone.now():
            return Response({'error': 'Too late — the battle is resolving'}, status=409)
        res = Fz_buy(request.user, battle.target_territory.h3_index, 'defense', request.data.get('points') or 10)
        if 'error' in res:
            return Response(res, status=res.pop('status', 400))
        data = _faceoff(battle, request.user)
        return Response({**data, 'message': f"+{res['qty']} defense — {'you hold' if data['hold_chance'] >= 1 else 'not enough yet'}."})

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
        data = [{**_battle_row(b), 'hold_chance': _hold_chance(b, b.target_territory),
                 'defense_points': b.target_territory.defense_points} for b in battles]
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

    @action(detail=True, methods=['GET'], url_path='faceoff')
    def faceoff(self, request, pk=None):
        """GET /api/combat/<id>/faceoff/ — both sides face to face: forces, powers, walls, hold chance, timer,
        and what the defender can still do before the battle resolves."""
        try:
            battle = Battle.objects.select_related('target_territory', 'defender').get(id=pk)
        except (Battle.DoesNotExist, ValueError, Exception):
            return Response({'error': 'Battle not found'}, status=404)
        is_def = battle.defender_id == request.user.id
        if not is_def and not battle.participants.filter(player=request.user).exists():
            return Response({'error': 'Not authorized'}, status=403)
        CombatEngine.resolve_due(Battle.objects.filter(id=battle.id))
        battle.refresh_from_db()
        return Response(_faceoff(battle, request.user))

    @action(detail=False, methods=['POST'], url_path='defend')
    def defend(self, request):
        """POST /api/combat/defend/ {battle_id, points} — same as reinforce (defense points are the only defense)."""
        return self.reinforce(request)

    @action(detail=False, methods=['GET'], url_path='history')
    def history(self, request):
        """GET /api/combat/history/ — resolved battles, as attacker AND as defender (bot raids included)."""
        from django.db.models import Q
        mine = Battle.objects.filter(Q(participants__player=request.user) | Q(defender=request.user)).distinct()
        CombatEngine.resolve_due(mine)
        battles = mine.filter(
            status__in=[Battle.BattleStatus.COMPLETED, Battle.BattleStatus.CANCELLED],
        ).select_related('target_territory', 'defender').prefetch_related('participants__player').order_by('-completed_at')[:50]
        rows = []
        for b in battles:
            row = _battle_row(b)
            row['role'] = 'defender' if b.defender_id == request.user.id else 'attacker'
            row['won'] = (b.winner == row['role'])
            row['completed_at'] = b.completed_at.isoformat() if b.completed_at else None
            rows.append(row)
        return Response({'history': rows})


def _attack_points(battle) -> int:
    return sum(int((p.units_deployed or {}).get('attack', 0)) for p in battle.participants.filter(side=BattleParticipant.Side.ATTACKER))


def _hold_chance(battle, territory) -> float:
    """Deterministic now (1 for 1): the defender holds when the kingdom's defense ≥ the attack committed."""
    from terra_domini.apps.combat import forces as Fz
    dfn = Fz.pools(Fz.kingdom_hexes(territory.owner_id, territory.h3_index))['defense'] if territory.owner_id else 0
    return 1.0 if dfn >= _attack_points(battle) else 0.0


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
        'units_lost': (commander.units_lost if commander else None) or {},
        'units_survived': (commander.units_survived if commander else None) or {},
        'defender_casualties': b.defender_casualties or {},
    }


def Fz_buy(player, h3_index, kind, qty):
    """Buy forces points on one of your hexes (shared by /forces/buy and the war room)."""
    from django.db import transaction
    from django.db.models import F
    from terra_domini.apps.accounts.models import Player
    from terra_domini.apps.combat import forces as Fz
    from terra_domini.apps.economy.balance import consume_purchased_first
    from terra_domini.apps.territories.models import Territory
    if kind not in Fz.POINT_COST:
        return {'error': 'kind must be attack, defense or spy'}
    try:
        qty = int(qty)
    except (TypeError, ValueError):
        return {'error': 'qty required'}
    if not 1 <= qty <= 10000:
        return {'error': 'qty between 1 and 10,000'}
    if not Territory.objects.filter(h3_index=h3_index, owner=player).exists():
        return {'error': 'Not your territory', 'status': 404}
    cost = qty * Fz.POINT_COST[kind]
    with transaction.atomic():
        p = Player.objects.select_for_update().get(id=player.id)
        if float(p.tdc_in_game or 0) < cost:
            return {'error': f'Need {cost:,} HEX', 'status': 402}
        Player.objects.filter(id=p.id).update(tdc_in_game=F('tdc_in_game') - cost)
        Fz.add(h3_index, kind, qty)
        p.refresh_from_db(fields=['tdc_in_game'])
    consume_purchased_first(p, cost)
    try:
        from terra_domini.apps.progression.missions import track
        track(player, 'spend_tdc', cost)
    except Exception:
        pass
    hexes = Fz.kingdom_hexes(player.id, h3_index)
    return {'ok': True, 'kind': kind, 'qty': qty, 'cost': cost, 'balance': float(p.tdc_in_game), 'pools': Fz.pools(hexes), 'size': len(hexes)}


def _faceoff(battle, viewer):
    """War room payload (combat/forces.py): attack points committed vs the kingdom's defense points."""
    from terra_domini.apps.combat import forces as Fz
    t = battle.target_territory
    atk_parts = list(battle.participants.filter(side=BattleParticipant.Side.ATTACKER).select_related('player'))
    n = _attack_points(battle)
    kingdom = Fz.kingdom_hexes(t.owner_id, t.h3_index) if t.owner_id else [t.h3_index]
    dfn = Fz.pools(kingdom)['defense']
    is_def = battle.defender_id == viewer.id
    out = {
        **_battle_row(battle),
        'role': 'defender' if is_def else 'attacker',
        'seconds_left': max(0, int((battle.resolves_at - timezone.now()).total_seconds())),
        'territory': {'h3': t.h3_index, 'name': t.place_name or t.poi_name or t.h3_index[:10], 'rarity': t.rarity, 'terrain': t.territory_type},
        'attack': {'players': [p.player.username for p in atk_parts], 'points': n, 'surprise': battle.battle_type == Battle.BattleType.SURPRISE},
        'defense': {'player': battle.defender.username if battle.defender else None, 'points': dfn, 'kingdom_size': len(kingdom)},
        'hold_chance': _hold_chance(battle, t) if battle.status in ACTIVE_STATUSES else (1.0 if battle.winner == 'defender' else 0.0),
        'missing': max(0, n - dfn + 1),       # defense points still needed to hold
    }
    if is_def and battle.status == Battle.BattleStatus.ACTIVE:
        out['actions'] = {'point_cost': Fz.POINT_COST['defense']}
    return out
