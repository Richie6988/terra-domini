"""
Event token market (owner 2026-10-18: "only 10 tokens issued… then you can sell it high in the market for collectors").

GET  /api/event-cards/market/          tokens on sale (cheapest first) + mine
POST /api/event-cards/<id>/sell/       {price}  put my token on sale (or change its price)
POST /api/event-cards/<id>/delist/
POST /api/event-cards/<id>/buy/        pay the price: 95 % to the seller, 5 % royalty (like the territory market)
"""
from django.db import transaction
from django.db.models import F
from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from terra_domini.apps.events.news_models import EventCard

ROYALTY_PCT = 0.05
MIN_PRICE, MAX_PRICE = 100, 100_000_000


def _ser(c, me=None):
    return {'id': str(c.id), 'headline': c.headline, 'kind': c.kind, 'location': c.location_name, 'rarity': c.rarity,
            'image_url': c.image_url, 'source_url': c.source_url, 'event_date': c.event_date.isoformat(), 'h3_index': c.h3_index,
            'serial': c.serial, 'max_supply': c.max_supply, 'price': c.price_hex,
            'seller': c.player.username if c.price_hex else None, 'mine': bool(me and c.player_id == me.id)}


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def market(request):
    on_sale = EventCard.objects.filter(price_hex__isnull=False).select_related('player').order_by('price_hex')[:200]
    mine = EventCard.objects.filter(player=request.user).select_related('player').order_by('-event_date')
    return Response({'listings': [_ser(c, request.user) for c in on_sale], 'mine': [_ser(c, request.user) for c in mine]})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def sell(request, card_id):
    c = EventCard.objects.filter(id=card_id, player=request.user).first()
    if not c:
        return Response({'error': 'Not your token'}, status=404)
    try:
        price = int(request.data.get('price'))
    except (TypeError, ValueError):
        return Response({'error': 'price required'}, status=400)
    if not MIN_PRICE <= price <= MAX_PRICE:
        return Response({'error': f'Price between {MIN_PRICE} and {MAX_PRICE:,} HEX'}, status=400)
    c.price_hex, c.listed_at = price, timezone.now()
    c.save(update_fields=['price_hex', 'listed_at'])
    return Response({'success': True, 'card': _ser(c, request.user)})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def delist(request, card_id):
    n = EventCard.objects.filter(id=card_id, player=request.user).update(price_hex=None, listed_at=None)
    return Response({'success': bool(n)})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def buy(request, card_id):
    from terra_domini.apps.accounts.models import Player
    with transaction.atomic():
        c = EventCard.objects.select_for_update().filter(id=card_id, price_hex__isnull=False).first()
        if not c:
            return Response({'error': 'Token no longer on sale'}, status=404)
        if c.player_id == request.user.id:
            return Response({'error': 'This is your own token'}, status=400)
        if c.event_id and EventCard.objects.filter(player=request.user, event_id=c.event_id).exists():
            return Response({'error': 'You already own a token of this event'}, status=400)
        buyer = Player.objects.select_for_update().get(id=request.user.id)
        price = c.price_hex
        if float(buyer.tdc_in_game or 0) < price:
            return Response({'error': f'Need {price:,} HEX'}, status=402)
        seller_id = c.player_id
        Player.objects.filter(id=buyer.id).update(tdc_in_game=F('tdc_in_game') - price)
        Player.objects.filter(id=seller_id).update(tdc_in_game=F('tdc_in_game') + round(price * (1 - ROYALTY_PCT)))
        c.player, c.price_hex, c.listed_at = buyer, None, None
        c.save(update_fields=['player', 'price_hex', 'listed_at'])
        buyer.refresh_from_db(fields=['tdc_in_game'])
    return Response({'success': True, 'card': _ser(c, request.user)})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def delist(request, card_id):
    n = EventCard.objects.filter(id=card_id, player=request.user).update(price_hex=None, listed_at=None)
    return Response({'success': bool(n)})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def buy(request, card_id):
    from terra_domini.apps.accounts.models import Player
    with transaction.atomic():
        c = EventCard.objects.select_for_update().filter(id=card_id, price_hex__isnull=False).first()
        if not c:
            return Response({'error': 'Token no longer on sale'}, status=404)
        if c.player_id == request.user.id:
            return Response({'error': 'This is your own token'}, status=400)
        if c.event_id and EventCard.objects.filter(player=request.user, event_id=c.event_id).exists():
            return Response({'error': 'You already own a token of this event'}, status=400)
        buyer = Player.objects.select_for_update().get(id=request.user.id)
        price = c.price_hex
        if float(buyer.tdc_in_game or 0) < price:
            return Response({'error': f'Need {price:,} HEX'}, status=402)
        seller_id = c.player_id
        Player.objects.filter(id=buyer.id).update(tdc_in_game=F('tdc_in_game') - price)
        Player.objects.filter(id=seller_id).update(tdc_in_game=F('tdc_in_game') + round(price * (1 - ROYALTY_PCT)))
        c.player, c.price_hex, c.listed_at = buyer, None, None
        c.save(update_fields=['player', 'price_hex', 'listed_at'])
        buyer.refresh_from_db(fields=['tdc_in_game'])
    try:
        from terra_domini.apps.social.notify import notify   # optional
        notify(seller_id, f'Your token {c.serial}/{c.max_supply} sold for {price:,} HEX')
    except Exception:
        pass
    return Response({'success': True, 'card': _ser(c, buyer), 'price': price, 'balance': float(buyer.tdc_in_game)})
