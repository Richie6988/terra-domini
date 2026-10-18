"""
Daily auctions (owner 2026-10-18: "10 auctions a day on a random rare card").

- create_daily(): 10 random rare+ place territories nobody owns, ends staggered over the day (2h → 24h) so there is
  always one closing soon. Start price = 3 days of the card's HEX yield.
- Bids are escrowed in HEX (the bidder pays now, an outbid player is refunded at once). Min raise 5 %.
  A bid in the last 2 minutes extends the auction by 2 minutes (no sniping).
- resolve_due(): ended auctions → the top bidder owns the territory (and its card); no bid → unsold.
GET  /api/auctions/          today's auctions (resolves the ended ones first)
POST /api/auctions/<id>/bid/ {amount}
Cron: manage.py daily_auctions (create at 00:05 UTC + resolve hourly).
"""
import random
from datetime import timedelta

from django.db import transaction
from django.db.models import F
from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from terra_domini.apps.economy import balance as B
from terra_domini.apps.economy.models import AuctionBid, DailyAuction

PER_DAY = 10
MIN_RAISE = 0.05
SNIPE_WINDOW = timedelta(minutes=2)
RARE_PLUS = ('rare', 'epic', 'legendary', 'mythic')


def create_daily(n=PER_DAY) -> int:
    from terra_domini.apps.territories.models import Territory
    now = timezone.now()
    today = now.replace(hour=0, minute=0, second=0, microsecond=0)
    have = DailyAuction.objects.filter(created_at__gte=today).count()
    if have >= n:
        return 0
    busy = set(DailyAuction.objects.filter(status='live').values_list('territory_id', flat=True))
    pool = list(Territory.objects.filter(owner__isnull=True, rarity__in=RARE_PLUS, is_landmark=True)
                .exclude(id__in=busy).values_list('id', 'rarity')[:5000])
    random.shuffle(pool)
    made = 0
    for i, (tid, rarity) in enumerate(pool[:n - have]):
        hours = 2 + (22 * (have + i) / max(1, n - 1))           # staggered: 2h … 24h
        DailyAuction.objects.create(territory_id=tid, starts_at=now, ends_at=now + timedelta(hours=hours),
                                    start_price=int(B.HEX_PER_DAY.get(rarity, 360) * 3))
        made += 1
    return made


def resolve_due() -> int:
    from terra_domini.apps.territories.models import Territory
    done = 0
    for a in DailyAuction.objects.filter(status='live', ends_at__lte=timezone.now()).select_related('territory'):
        with transaction.atomic():
            a = DailyAuction.objects.select_for_update().get(pk=a.pk)
            if a.status != 'live':
                continue
            t = Territory.objects.select_for_update().get(pk=a.territory_id)
            if a.top_bidder_id and not t.owner_id:
                t.owner_id, t.captured_at = a.top_bidder_id, timezone.now()
                t.save(update_fields=['owner', 'captured_at'])
                from terra_domini.apps.accounts.models import Player
                B.consume_purchased_first(Player.objects.get(id=a.top_bidder_id), a.current_bid)
                a.status = 'won'
            elif a.top_bidder_id:   # claimed meanwhile by someone else: refund the winner
                from terra_domini.apps.accounts.models import Player
                Player.objects.filter(id=a.top_bidder_id).update(tdc_in_game=F('tdc_in_game') + a.current_bid)
                a.status = 'unsold'
            else:
                a.status = 'unsold'
            a.save(update_fields=['status'])
            done += 1
    return done


def _row(a, me):
    t = a.territory
    from terra_domini.apps.events.unified_poi import UnifiedPOI
    poi = UnifiedPOI.objects.filter(h3_index=t.h3_index, is_active=True).values('name', 'category', 'image_url', 'country_code').first() or {}
    floor = a.current_bid and int(a.current_bid * (1 + MIN_RAISE)) + 1 or a.start_price
    return {
        'id': str(a.id), 'h3_index': t.h3_index, 'name': poi.get('name') or t.poi_name or t.place_name or t.h3_index[:10],
        'category': poi.get('category') or '', 'image_url': poi.get('image_url') or '', 'country_code': poi.get('country_code') or t.country_code,
        'rarity': t.rarity, 'hex_per_day': B.HEX_PER_DAY.get(t.rarity, 60),
        'start_price': a.start_price, 'current_bid': a.current_bid, 'min_bid': floor, 'bid_count': a.bid_count,
        'top_bidder': a.top_bidder.username if a.top_bidder_id else None, 'you_lead': a.top_bidder_id == me.id,
        'ends_at': a.ends_at.isoformat(), 'status': a.status,
        'bids': [{'player': b.player.username, 'amount': b.amount, 'at': b.created_at.isoformat()}
                 for b in a.bids.select_related('player')[:10]],
    }


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def auctions_list(request):
    resolve_due()
    create_daily()   # first visitor of the day opens the 10 auctions if the cron has not run
    since = timezone.now() - timedelta(hours=24)
    qs = DailyAuction.objects.filter(status='live').select_related('territory', 'top_bidder') | \
        DailyAuction.objects.filter(status='won', ends_at__gte=since).select_related('territory', 'top_bidder')
    return Response({'auctions': [_row(a, request.user) for a in qs.order_by('status', 'ends_at')[:30]],
                     'per_day': PER_DAY, 'min_raise_pct': int(MIN_RAISE * 100)})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def auction_bid(request, auction_id):
    from terra_domini.apps.accounts.models import Player
    try:
        amount = int(request.data.get('amount') or 0)
    except (TypeError, ValueError):
        return Response({'error': 'Invalid amount'}, status=400)
    with transaction.atomic():
        try:
            a = DailyAuction.objects.select_for_update().get(id=auction_id)
        except (DailyAuction.DoesNotExist, ValueError, Exception):
            return Response({'error': 'Auction not found'}, status=404)
        now = timezone.now()
        if a.status != 'live' or a.ends_at <= now:
            return Response({'error': 'This auction is over'}, status=409)
        if a.top_bidder_id == request.user.id:
            return Response({'error': 'You already lead this auction'}, status=409)
        floor = int(a.current_bid * (1 + MIN_RAISE)) + 1 if a.current_bid else a.start_price
        if amount < floor:
            return Response({'error': f'Minimum bid: {floor:,} HEX', 'min_bid': floor}, status=400)
        me = Player.objects.select_for_update().get(id=request.user.id)
        if float(me.tdc_in_game) < amount:
            return Response({'error': f'Not enough HEX ({float(me.tdc_in_game):,.0f} / {amount:,})', 'shop': True}, status=402)
        Player.objects.filter(id=me.id).update(tdc_in_game=F('tdc_in_game') - amount)          # escrow
        if a.top_bidder_id:                                                                  # refund the outbid player
            Player.objects.filter(id=a.top_bidder_id).update(tdc_in_game=F('tdc_in_game') + a.current_bid)
        a.current_bid, a.top_bidder_id, a.bid_count = amount, me.id, a.bid_count + 1
        if a.ends_at - now < SNIPE_WINDOW:
            a.ends_at = now + SNIPE_WINDOW
        a.save(update_fields=['current_bid', 'top_bidder', 'bid_count', 'ends_at'])
        AuctionBid.objects.create(auction=a, player=me, amount=amount)
    a.refresh_from_db()   # purchased HEX is consumed only when the auction is won (refunds stay neutral)
    return Response({**_row(a, request.user), 'message': f'You lead with {amount:,} HEX'})
