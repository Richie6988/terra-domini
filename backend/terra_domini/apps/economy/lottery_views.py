"""
Lucky draw (owner 2026-10-18: "a lottery where you can spend HEX on chance").

- 3 tickets: BRONZE 100 · SILVER 500 · GOLD 2000 HEX. One free BRONZE ticket a day.
- Paid with HEX earned in game only (like booster packs: no paid loot boxes — purchased HEX can't gamble).
- Prize = ticket × multiplier, drawn server-side (PRIZES below, ~82 % return) + a progressive JACKPOT fed by
  10 % of every ticket: BRONZE wins 10 % of the pool, SILVER 35 %, GOLD 100 %.
- Land prizes (owner 2026-10-19: "also win a random territory, and 1/10000 a POI"): 'territory' = a free hex
  somewhere in the world (next to a famous place, so never in the sea) — a new far base; 'poi' = a free point
  of interest itself. Shown on a cartoon wheel; the server draws, the wheel only stages it.
GET  /api/lottery/        pool, tiers, free ticket, odds table, my last tickets, recent big wins (real)
POST /api/lottery/play/   {tier}
"""
import random
from decimal import Decimal

from django.db import transaction
from django.db.models import F, Q
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
PRIZES = [(0, 0.5499), (0.5, 0.15), (1, 0.12), (2, 0.09), ('territory', 0.03), (5, 0.04), (10, 0.015), (25, 0.004),
          ('poi', 0.0001)]   # multiplier or land prize, chance
WATER = {'ocean', 'water', 'lake', 'sea', 'coastal_sea'}


def _pool():
    p = LotteryPool.objects.select_for_update().first()
    return p or LotteryPool.objects.create(amount=POOL_SEED)


def _win_land(player, kind):
    """Give the player a random free hex: a POI ('poi') or a land hex 2-4 rings from a random POI ('territory').
    Returns the Territory, or None when nothing free was found (then the ticket pays x2 instead)."""
    import h3
    from terra_domini.apps.territories.models import Territory
    pois = Territory.objects.filter(Q(is_landmark=True) | ~Q(poi_name='')).exclude(poi_name__isnull=True)
    for _ in range(12):
        n = pois.count()
        if not n:
            return None
        poi = pois[random.randrange(n)]
        if kind == 'poi':
            if poi.owner_id:
                pois = pois.filter(owner__isnull=True)
                continue
            t = poi
        else:
            cell = random.choice(list(h3.grid_ring(poi.h3_index, random.randint(2, 4))))
            t = Territory.objects.filter(h3_index=cell).first()
            if not t:
                lat, lon = h3.cell_to_latlng(cell)
                try:
                    from terra_domini.apps.territories.territory_engine import generate_territory
                    generate_territory(cell, lat, lon)
                except Exception:
                    pass
                t = Territory.objects.filter(h3_index=cell).first() or Territory.objects.create(
                    h3_index=cell, h3_resolution=8, center_lat=lat, center_lon=lon, territory_type='rural')
            if t.owner_id or t.poi_name or (t.territory_type or '').lower() in WATER:
                continue
        t.owner = player
        t.captured_at = timezone.now()
        t.save(update_fields=['owner', 'captured_at'])
        return t
    return None


def _free_available(player) -> bool:
    today = timezone.now().replace(hour=0, minute=0, second=0, microsecond=0)
    return not LotteryTicket.objects.filter(player=player, free=True, created_at__gte=today).exists()


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def lottery_status(request):
    pool = LotteryPool.objects.first()
    big = LotteryTicket.objects.filter(Q(multiplier__gte=5) | ~Q(won_kind='')).select_related('player')[:8]
    mine = LotteryTicket.objects.filter(player=request.user)[:5]
    return Response({
        'pool': pool.amount if pool else POOL_SEED,
        'tiers': [{'id': k, 'cost': v, 'jackpot_share': JACKPOT_SHARE[k]} for k, v in TIERS.items()],
        'free_ticket': _free_available(request.user),
        'earned_balance': float(B.spendable_earned(request.user)),
        'odds': [{'multiplier': m, 'chance': c} for m, c in PRIZES] + [{'multiplier': 'JACKPOT', 'chance': JACKPOT_ODDS}],
        'recent_wins': [{'player': t.player.username, 'tier': t.tier, 'prize': t.prize, 'multiplier': t.multiplier,
                         'jackpot': t.jackpot, 'land': t.won_kind or None, 'at': t.created_at.isoformat()} for t in big],
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
            prize = int(cost * mult) if not isinstance(mult, str) else 0
        land = None
        if mult in ('territory', 'poi'):
            land = _win_land(me, mult)
            if not land:                      # nothing free found: pays x2 instead
                mult, prize = 2, cost * 2
        pool.save(update_fields=['amount', 'updated_at'])
        if prize:
            Player.objects.filter(id=me.id).update(tdc_in_game=F('tdc_in_game') + prize)
        LotteryTicket.objects.create(player=me, tier=tier, cost=0 if free else cost, prize=prize,
                                     multiplier=mult if isinstance(mult, (int, float)) else 0, jackpot=jackpot, free=free,
                                     won_h3=land.h3_index if land else '', won_kind=mult if land else '')
        me.refresh_from_db(fields=['tdc_in_game'])
    won = None
    if land:
        won = {'kind': mult, 'h3_index': land.h3_index, 'lat': land.center_lat, 'lon': land.center_lon,
               'name': land.poi_name or land.place_name or land.custom_name or '', 'rarity': land.rarity}
    return Response({'tier': tier, 'free': free, 'multiplier': mult, 'prize': prize, 'jackpot': jackpot, 'won': won,
                     'pool': pool.amount, 'balance': float(me.tdc_in_game),
                     'free_ticket': _free_available(me)})
