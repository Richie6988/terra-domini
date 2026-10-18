"""
Lucky draw (owner 2026-10-18: "a lottery where you can spend HEX on chance").

- 3 tickets: BRONZE 100 · SILVER 500 · GOLD 2000 HEX. One free BRONZE ticket a day.
- Paid with HEX earned in game only (like booster packs: no paid loot boxes — purchased HEX can't gamble).
- Prize = ticket × multiplier, drawn server-side (PRIZES below, ~82 % return) + a progressive JACKPOT fed by
  10 % of every ticket: BRONZE wins 10 % of the pool, SILVER 35 %, GOLD 100 %.
GET  /api/lottery/        pool, tiers, free ticket, odds table, my last tickets, recent big wins (real)
POST /api/lottery/play/   {tier}
"""
import random
from decimal import Decimal

from django.db import transaction
from django.db.models import F
from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from terra_domini.apps.economy import balance as B
from terra_domini.apps.economy.models import LotteryPool, LotteryTicket

TIERS = {'bronze': 100, 'silver': 500, 'gold': 2000}
JACKPOT_SHARE = {'bronze': 0.10, 'silver': 0.35, 'gold': 1.0}
POOL_CUT = 0.10
POOL_SEED = 10000
JACKPOT_ODDS = 0.001
PRIZES = [(0, 0.58), (0.5, 0.15), (1, 0.12), (2, 0.09), (5, 0.04), (10, 0.015), (25, 0.004)]   # multiplier, chance


def _pool():
    p = LotteryPool.objects.select_for_update().first()
    return p or LotteryPool.objects.create(amount=POOL_SEED)


def _free_available(player) -> bool:
    today = timezone.now().replace(hour=0, minute=0, second=0, microsecond=0)
    return not LotteryTicket.objects.filter(player=player, free=True, created_at__gte=today).exists()


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def lottery_status(request):
    pool = LotteryPool.objects.first()
    big = LotteryTicket.objects.filter(multiplier__gte=5).select_related('player')[:8]
    mine = LotteryTicket.objects.filter(player=request.user)[:5]
    return Response({
        'pool': pool.amount if pool else POOL_SEED,
        'tiers': [{'id': k, 'cost': v, 'jackpot_share': JACKPOT_SHARE[k]} for k, v in TIERS.items()],
        'free_ticket': _free_available(request.user),
        'earned_balance': float(B.spendable_earned(request.user)),
        'odds': [{'multiplier': m, 'chance': c} for m, c in PRIZES] + [{'multiplier': 'JACKPOT', 'chance': JACKPOT_ODDS}],
        'recent_wins': [{'player': t.player.username, 'tier': t.tier, 'prize': t.prize, 'multiplier': t.multiplier,
                         'jackpot': t.jackpot, 'at': t.created_at.isoformat()} for t in big],
        'my_tickets': [{'tier': t.tier, 'prize': t.prize, 'multiplier': t.multiplier, 'jackpot': t.jackpot} for t in mine],
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def lottery_play(request):
    from terra_domini.apps.accounts.models import Player
    tier = (request.data.get('tier') or 'bronze').lower()
    if tier not in TIERS:
        return Response({'error': 'Unknown ticket'}, status=400)
    cost = TIERS[tier]
    with transaction.atomic():
        me = Player.objects.select_for_update().get(id=request.user.id)
        free = tier == 'bronze' and bool(request.data.get('free')) and _free_available(me)
        if not free and B.spendable_earned(me) < Decimal(cost):
            return Response({'error': f'Lucky tickets are paid with HEX earned in game ({float(B.spendable_earned(me)):,.0f} earned).',
                             'earned_balance': float(B.spendable_earned(me))}, status=402)
        pool = _pool()
        if not free:
            Player.objects.filter(id=me.id).update(tdc_in_game=F('tdc_in_game') - cost)
            pool.amount += int(cost * POOL_CUT)
        r = random.random()
        jackpot = r < JACKPOT_ODDS
        if jackpot:
            prize, mult = int(pool.amount * JACKPOT_SHARE[tier]), 'JACKPOT'
            pool.amount = max(POOL_SEED, pool.amount - prize)
        else:
            acc, mult = JACKPOT_ODDS, 0
            for m, c in PRIZES:
                acc += c
                if r < acc:
                    mult = m
                    break
            prize = int(cost * mult)
        pool.save(update_fields=['amount', 'updated_at'])
        if prize:
            Player.objects.filter(id=me.id).update(tdc_in_game=F('tdc_in_game') + prize)
        LotteryTicket.objects.create(player=me, tier=tier, cost=0 if free else cost, prize=prize,
                                     multiplier=0 if mult == 'JACKPOT' else mult, jackpot=jackpot, free=free)
        me.refresh_from_db(fields=['tdc_in_game'])
    return Response({'tier': tier, 'free': free, 'multiplier': mult, 'prize': prize, 'jackpot': jackpot,
                     'pool': pool.amount, 'balance': float(me.tdc_in_game),
                     'free_ticket': _free_available(me)})
