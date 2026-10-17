"""
Session loop API — the "5-minute session" backbone (2026-10-17).

GET  /api/loop/status/   harvest stock, streak (auto check-in), missions, battles, nudges
POST /api/loop/collect/  credit the harvest stock (capped at STORAGE_CAP_HOURS)

Nothing is credited automatically: production that overflows the cap is lost,
and status/collect say how much — that's the FOMO the owner asked for.
"""
from datetime import timedelta
from decimal import Decimal

from django.db import transaction
from django.db.models import F
from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from terra_domini.apps.economy import balance as B


def _fmt_left(delta):
    mins = max(0, int(delta.total_seconds() // 60))
    return f'{mins // 60}h {mins % 60:02d}m' if mins >= 60 else f'{mins} min'


def _harvest(player, now):
    rate = B.player_hex_per_day(player)
    last = player.harvest_last_at or now
    elapsed_h = max(0.0, (now - last).total_seconds() / 3600)
    stored_h = min(elapsed_h, B.STORAGE_CAP_HOURS)
    pending = rate * stored_h / 24
    lost = rate * max(0.0, elapsed_h - B.STORAGE_CAP_HOURS) / 24
    cap_amount = rate * B.STORAGE_CAP_HOURS / 24
    return {
        'rate_per_day': rate,
        'pending': int(pending),
        'cap_amount': int(cap_amount),
        'cap_hours': B.STORAGE_CAP_HOURS,
        'fill_pct': round(100 * stored_h / B.STORAGE_CAP_HOURS, 1) if rate else 0,
        'is_full': elapsed_h >= B.STORAGE_CAP_HOURS and rate > 0,
        'full_at': (last + timedelta(hours=B.STORAGE_CAP_HOURS)).isoformat(),
        'lost': int(lost),
    }


def _streak(player):
    from terra_domini.apps.progression.models import PlayerStreak
    from terra_domini.apps.accounts.models import Player
    streak, _ = PlayerStreak.objects.get_or_create(player=player)
    result = streak.check_and_update()
    if result.get('is_new') and result.get('reward_tdc', 0) > 0:
        Player.objects.filter(id=player.id).update(tdc_in_game=F('tdc_in_game') + result['reward_tdc'])
    return {
        'current': streak.current_streak, 'longest': streak.longest_streak, 'shields': streak.streak_shields,
        'reward_today': result.get('reward_tdc', 0) if result.get('is_new') else 0,
        'message': result.get('message', ''),
    }


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def loop_status(request):
    from terra_domini.apps.accounts.models import Player
    from terra_domini.apps.combat.engine import Battle, BattleParticipant
    from terra_domini.apps.progression.missions import ensure_today_missions
    from terra_domini.apps.territories.models import Territory

    now = timezone.now()
    player = Player.objects.get(id=request.user.id)
    if player.harvest_last_at is None:
        Player.objects.filter(id=player.id).update(harvest_last_at=now)
        player.harvest_last_at = now

    streak = _streak(player)
    player.refresh_from_db(fields=['tdc_in_game', 'hex_purchased_balance'])
    harvest = _harvest(player, now)
    owned = Territory.objects.filter(owner=player).count()

    missions = list(ensure_today_missions(player))
    claimable = [m for m in missions if m.is_completed and not m.is_claimed]

    from terra_domini.apps.combat.engine import CombatEngine
    from django.db.models import Q
    CombatEngine.resolve_due(Battle.objects.filter(Q(defender=player) | Q(participants__player=player)).distinct())
    incoming = list(Battle.objects.filter(defender=player, status=Battle.BattleStatus.ACTIVE)
                    .select_related('target_territory').order_by('resolves_at'))
    recent = list(Battle.objects.filter(
        participants__player=player, participants__side=BattleParticipant.Side.ATTACKER,
        status=Battle.BattleStatus.COMPLETED, completed_at__gte=now - timedelta(hours=12),
    ).select_related('target_territory').order_by('-completed_at')[:3])
    lost_recent = list(Battle.objects.filter(
        defender=player, status=Battle.BattleStatus.COMPLETED, territory_captured=True,
        completed_at__gte=now - timedelta(hours=24),
    ).select_related('target_territory')[:3])

    next_cost = B.buy_cost(owned, adjacent=True)
    earned = B.spendable_earned(player)

    nudges = []
    for b in incoming:
        t = b.target_territory
        nudges.append({
            'id': f'attack-{b.id}', 'type': 'under_attack', 'priority': 100,
            'title': 'Your territory is under attack!',
            'body': f'{t.place_name or t.h3_index[:8]} falls in {_fmt_left(b.resolves_at - now)} unless you reinforce.',
            'ends_at': b.resolves_at.isoformat(), 'battle_id': str(b.id),
            'cta': {'label': f'REINFORCE ({B.REINFORCE_COST})', 'action': 'reinforce'},
        })
    for b in lost_recent:
        nudges.append({
            'id': f'lost-{b.id}', 'type': 'territory_lost', 'priority': 90,
            'title': 'Territory lost',
            'body': f'{b.target_territory.place_name or b.target_territory.h3_index[:8]} was conquered while you were away. Strike back!',
            'cta': {'label': 'MILITARY', 'panel': 'combat'},
        })
    if harvest['is_full']:
        nudges.append({
            'id': 'harvest-full', 'type': 'harvest_full', 'priority': 80,
            'title': 'Stock full — production is being lost!',
            'body': f"{harvest['lost']} HEX already lost. Collect now." if harvest['lost'] else 'Collect now to keep producing.',
            'cta': {'label': f"COLLECT {harvest['pending']}", 'action': 'collect'},
        })
    elif harvest['pending'] >= max(1, harvest['cap_amount'] // 2):
        nudges.append({
            'id': 'harvest-ready', 'type': 'harvest_ready', 'priority': 50,
            'title': 'Harvest ready', 'body': f"{harvest['pending']} HEX waiting in your stock.",
            'ends_at': harvest['full_at'],
            'cta': {'label': 'COLLECT', 'action': 'collect'},
        })
    for b in recent:
        won = b.winner == 'attacker'
        nudges.append({
            'id': f'result-{b.id}', 'type': 'battle_result', 'priority': 70,
            'title': 'Victory!' if won else 'Attack repelled',
            'body': f"{b.target_territory.place_name or b.target_territory.h3_index[:8]}: "
                    + ('territory captured.' if b.territory_captured else ('raid succeeded.' if won else 'regroup and try again.')),
            'cta': {'label': 'VIEW', 'panel': 'combat'},
        })
    if claimable:
        nudges.append({
            'id': 'missions', 'type': 'missions_claimable', 'priority': 60,
            'title': f'{len(claimable)} mission reward{"s" if len(claimable) > 1 else ""} to claim',
            'body': f'+{sum(m.reward_tdc for m in claimable)} HEX waiting.',
            'cta': {'label': 'CLAIM', 'panel': 'tasks'},
        })
    if owned == 0:
        nudges.append({
            'id': 'first-claim', 'type': 'first_claim', 'priority': 95,
            'title': 'Claim your first territory — free',
            'body': 'Tap any hex near you on the map.', 'cta': None,
        })
    elif earned + Decimal(str(player.hex_purchased_balance or 0)) >= next_cost:
        nudges.append({
            'id': 'expand', 'type': 'can_expand', 'priority': 40,
            'title': 'You can afford a new territory',
            'body': f'Next adjacent hex from {next_cost} HEX. Grow your kingdom!', 'cta': None,
        })
    nudges.sort(key=lambda n: -n['priority'])

    return Response({
        'server_time': now.isoformat(),
        'balance': float(player.tdc_in_game),
        'earned_balance': float(earned),
        'harvest': harvest,
        'streak': streak,
        'territories': owned,
        'next_territory_cost': next_cost,
        'missions': {'total': len(missions), 'completed': sum(m.is_completed for m in missions),
                     'claimable': len(claimable)},
        'incoming_attacks': len(incoming),
        'nudges': nudges,
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def loop_collect(request):
    from terra_domini.apps.accounts.models import Player
    from terra_domini.apps.progression.missions import track

    now = timezone.now()
    with transaction.atomic():
        player = Player.objects.select_for_update().get(id=request.user.id)
        h = _harvest(player, now)
        if h['pending'] <= 0:
            return Response({'collected': 0, 'lost': h['lost'], 'balance': float(player.tdc_in_game),
                             'harvest': h, 'message': 'Nothing to collect yet.'})
        Player.objects.filter(id=player.id).update(
            tdc_in_game=F('tdc_in_game') + h['pending'], harvest_last_at=now)
    track(player, 'produce')
    player.refresh_from_db(fields=['tdc_in_game', 'harvest_last_at'])
    return Response({
        'collected': h['pending'], 'lost': h['lost'], 'balance': float(player.tdc_in_game),
        'harvest': _harvest(player, now),
    })
