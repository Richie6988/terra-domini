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

    @action(detail=False, methods=['GET'], url_path='preview')
    def preview(self, request):
        """GET /api/combat/preview/?target_h3= — real numbers the server will use (defense, timer, per-unit attack).
        Lets the attack screen show an honest win chance instead of a made-up simulation."""
        from terra_domini.apps.territories.models import Territory
        from terra_domini.apps.combat.engine import UNIT_STATS, SURPRISE_ATK_MULT, active_boost_pct
        try:
            t = Territory.objects.select_related('owner').get(h3_index=request.query_params.get('target_h3', ''))
        except Territory.DoesNotExist:
            return Response({'error': 'Territory not found'}, status=404)
        ok, reason = CombatEngine.can_attack(request.user, t)
        timer = CombatEngine._get_battle_timer(t)
        atk_b = 1 + active_boost_pct(request.user.id, 'atk_multiplier') / 100.0
        def_b = 1 + active_boost_pct(t.owner_id, 'def_multiplier') / 100.0
        return Response({
            'can_attack': ok, 'reason': reason,
            'owner': t.owner.username if t.owner else None,
            'defense_power': round(CombatEngine.calculate_defense_power(t, CombatEngine.garrison_dict(t)) * def_b, 1),
            'defense_points': t.defense_points, 'max_defense_points': t.max_defense_points,
            'atk_per_unit': {k: round(v['atk'] * v['terrain_bonus'].get(t.territory_type, 1.0) * atk_b, 2) for k, v in UNIT_STATS.items()},
            'atk_boost_pct': round((atk_b - 1) * 100), 'def_boost_pct': round((def_b - 1) * 100),
            'timer_seconds': {'conquest': timer, 'surprise': timer // 2},
            'surprise_atk_mult': SURPRISE_ATK_MULT,
            'roll_spread': 0.1,
        })

    @action(detail=False, methods=['POST'], url_path='reinforce')
    def reinforce(self, request):
        """POST /api/combat/reinforce/ {battle_id} — defender spends HEX to add defense before resolution."""
        from django.db import transaction
        from django.db.models import F
        from terra_domini.apps.accounts.models import Player as P
        from terra_domini.apps.economy import balance as B
        from terra_domini.apps.progression.missions import track
        try:
            battle = Battle.objects.select_related('target_territory').get(
                id=request.data.get('battle_id'), defender=request.user, status=Battle.BattleStatus.ACTIVE)
        except (Battle.DoesNotExist, ValueError, Exception):
            return Response({'error': 'No active attack on your territory with this id'}, status=404)
        t = battle.target_territory
        cap = (t.max_defense_points or 100) * 2
        if (t.defense_points or 0) >= cap:
            return Response({'error': 'Defenses are already at maximum'}, status=409)
        with transaction.atomic():
            p = P.objects.select_for_update().get(id=request.user.id)
            if float(p.tdc_in_game) < B.REINFORCE_COST:
                return Response({'error': f'Need {B.REINFORCE_COST} HEX'}, status=402)
            P.objects.filter(id=p.id).update(tdc_in_game=F('tdc_in_game') - B.REINFORCE_COST)
            t.defense_points = min(cap, (t.defense_points or 0) + B.REINFORCE_DEFENSE)
            t.save(update_fields=['defense_points'])
        B.consume_purchased_first(p, B.REINFORCE_COST)
        track(request.user, 'spend_tdc', B.REINFORCE_COST)
        hold = _hold_chance(battle, t)
        return Response({'ok': True, 'defense_points': t.defense_points, 'max': cap, 'cost': B.REINFORCE_COST,
                         'hold_chance': hold,
                         'message': f'Defenses {int(t.defense_points)}/{int(cap)} — {round(hold * 100)}% chance to hold.'})

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
        """POST /api/combat/defend/ {battle_id, units:{type:n}} — defender sends free (unstationed) units
        into the battle before it resolves. Survivors come back afterwards."""
        from django.db import transaction
        try:
            battle = Battle.objects.select_related('target_territory').get(
                id=request.data.get('battle_id'), defender=request.user, status=Battle.BattleStatus.ACTIVE)
        except (Battle.DoesNotExist, ValueError, Exception):
            return Response({'error': 'No active attack on your territory with this id'}, status=404)
        if battle.resolves_at <= timezone.now():
            return Response({'error': 'Too late — the battle is resolving'}, status=409)
        units = {k: int(v) for k, v in (request.data.get('units') or {}).items() if int(v or 0) > 0}
        if not units:
            return Response({'error': 'Select at least one unit'}, status=400)
        with transaction.atomic():
            stacks = {}
            for ut, n in units.items():
                st = MilitaryUnit.objects.select_for_update().filter(
                    player=request.user, unit_type=ut, territory__isnull=True,
                    status=MilitaryUnit.UnitStatus.GARRISON, count__gte=n).first()
                if not st:
                    return Response({'error': f'Not enough free {ut}'}, status=400)
                stacks[ut] = st
            for ut, n in units.items():
                stacks[ut].count -= n
                stacks[ut].save(update_fields=['count'])
            part = battle.participants.filter(player=request.user, side=BattleParticipant.Side.DEFENDER).first()
            if part:
                merged = dict(part.units_deployed or {})
                for ut, n in units.items():
                    merged[ut] = merged.get(ut, 0) + n
                part.units_deployed = merged
                part.save(update_fields=['units_deployed'])
            else:
                BattleParticipant.objects.create(battle=battle, player=request.user, side=BattleParticipant.Side.DEFENDER,
                                                 units_deployed=units)
        data = _faceoff(battle, request.user)
        return Response({**data, 'message': f"{sum(units.values())} units joined the defense — {round(data['hold_chance'] * 100)}% to hold."})

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


def _hold_chance(battle, territory) -> float:
    """Defender's chance to win with current defenses (same ±10% rolls as resolve_battle)."""
    from terra_domini.apps.combat.engine import SURPRISE_ATK_MULT
    atk = sum(CombatEngine.calculate_attack_power(p.units_deployed, territory.territory_type)
              for p in battle.participants.filter(side=BattleParticipant.Side.ATTACKER))
    if battle.battle_type == Battle.BattleType.SURPRISE:
        atk *= SURPRISE_ATK_MULT
    from terra_domini.apps.combat.engine import active_boost_pct
    commander = battle.participants.filter(is_commander=True).first()
    atk *= 1 + active_boost_pct(commander.player_id if commander else None, 'atk_multiplier') / 100.0
    dfn = CombatEngine.calculate_defense_power(territory, CombatEngine.defender_units(battle, territory)) * (1 + active_boost_pct(battle.defender_id, 'def_multiplier') / 100.0)
    if atk <= 0:
        return 1.0
    n, held = 40, 0
    for i in range(n):
        x = 0.9 + 0.2 * (i + 0.5) / n
        for j in range(n):
            if atk * x <= dfn * (0.9 + 0.2 * (j + 0.5) / n):
                held += 1
    return round(held / (n * n), 3)


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


def _side_power(units, territory, attack):
    from terra_domini.apps.combat.engine import UNIT_STATS
    out = []
    for ut, n in sorted(units.items(), key=lambda x: -x[1]):
        st = UNIT_STATS.get(ut, {})
        per = st.get('atk' if attack else 'def', 0) * (st.get('terrain_bonus', {}).get(territory.territory_type, 1.0) if attack else 1)
        out.append({'type': ut, 'count': n, 'power': round(per * n, 1)})
    return out


def _faceoff(battle, viewer):
    """Face-to-face payload, from the same numbers resolve_battle uses."""
    from terra_domini.apps.combat.engine import SURPRISE_ATK_MULT, active_boost_pct
    from terra_domini.apps.economy import balance as B
    from terra_domini.apps.economy.models import ShopItem
    t = battle.target_territory
    atk_parts = list(battle.participants.filter(side=BattleParticipant.Side.ATTACKER).select_related('player'))
    def_parts = list(battle.participants.filter(side=BattleParticipant.Side.DEFENDER).select_related('player'))
    atk_units = CombatEngine._aggregate_units(atk_parts)
    garrison = CombatEngine.garrison_dict(t)
    sent = CombatEngine._aggregate_units(def_parts)
    commander = next((p for p in atk_parts if p.is_commander), None)
    atk_boost = active_boost_pct(commander.player_id if commander else None, 'atk_multiplier')
    def_boost = active_boost_pct(battle.defender_id, 'def_multiplier')
    atk = sum(CombatEngine.calculate_attack_power(p.units_deployed, t.territory_type) for p in atk_parts)
    if battle.battle_type == Battle.BattleType.SURPRISE:
        atk *= SURPRISE_ATK_MULT
    atk *= 1 + atk_boost / 100.0
    dfn = CombatEngine.calculate_defense_power(t, CombatEngine.defender_units(battle, t)) * (1 + def_boost / 100.0)
    is_def = battle.defender_id == viewer.id
    out = {
        **_battle_row(battle),
        'role': 'defender' if is_def else 'attacker',
        'seconds_left': max(0, int((battle.resolves_at - timezone.now()).total_seconds())),
        'territory': {'h3': t.h3_index, 'name': t.place_name or t.poi_name or t.h3_index[:10], 'rarity': t.rarity,
                      'terrain': t.territory_type},
        'attack': {'players': [p.player.username for p in atk_parts], 'units': _side_power(atk_units, t, True),
                   'power': round(atk, 1), 'boost_pct': round(atk_boost), 'surprise': battle.battle_type == Battle.BattleType.SURPRISE},
        'defense': {'player': battle.defender.username if battle.defender else None,
                    'garrison': _side_power(garrison, t, False), 'sent': _side_power(sent, t, False),
                    'walls': round(t.defense_points or 0), 'walls_max': round((t.max_defense_points or 100) * 2),
                    'power': round(dfn, 1), 'boost_pct': round(def_boost)},
        'hold_chance': _hold_chance(battle, t) if battle.status in ACTIVE_STATUSES else (1.0 if battle.winner == 'defender' else 0.0),
    }
    if is_def and battle.status == Battle.BattleStatus.ACTIVE:
        free = {m.unit_type: m.count for m in MilitaryUnit.objects.filter(player=viewer, territory__isnull=True, count__gt=0)}
        item = ShopItem.objects.filter(effect_type='def_multiplier', is_active=True).order_by('price_tdc').first()
        out['actions'] = {
            'reserve': free,
            'reinforce_cost': B.REINFORCE_COST, 'reinforce_defense': B.REINFORCE_DEFENSE,
            'boost_item': {'code': item.code, 'name': item.name, 'price': float(item.price_tdc)} if item and not def_boost else None,
        }
    return out
