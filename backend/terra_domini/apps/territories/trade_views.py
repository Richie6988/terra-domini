"""
Resource Trade API
GET  /api/resource-trade/market/      — open market listings
POST /api/resource-trade/list/        — create a listing
POST /api/resource-trade/<id>/accept/ — accept a trade
POST /api/resource-trade/<id>/cancel/ — cancel own listing
GET  /api/resource-trade/my-trades/   — player's trades
GET  /api/resource-trade/rates/       — current market rates
POST /api/resource-trade/<id>/buy-tdc/— buy with TDC directly
"""
import logging
from decimal import Decimal
from django.utils import timezone
from django.db import transaction
from django.db.models import Q, F
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from terra_domini.apps.territories.models import ResourceTrade

logger = logging.getLogger('terra_domini.trade')

RESOURCE_EMOJI = {
    'water': '💧', 'food': '🌾', 'energy': '⚡', 'credits': '💰',
    'materials': '⚙️', 'culture': '🎭', 'intel': '🕵️', 'tdc': '🪙',
}

def serialize_trade(t: ResourceTrade, me=None) -> dict:
    rates = ResourceTrade.market_rates()
    return {
        'id':               str(t.id),
        'mode':             t.mode,
        'status':           t.status,
        'seller':           t.seller.username,
        'seller_avatar':    getattr(t.seller, 'avatar_emoji', '🎖️'),
        'buyer':            t.buyer.username if t.buyer else None,
        'offer_resource':   t.offer_resource,
        'offer_emoji':      RESOURCE_EMOJI.get(t.offer_resource, '📦'),
        'offer_amount':     float(t.offer_amount),
        'request_resource': t.request_resource,
        'request_emoji':    RESOURCE_EMOJI.get(t.request_resource, '📦'),
        'request_amount':   float(t.request_amount),
        'market_price_tdc': float(t.market_price_tdc),
        'allow_tdc_purchase': t.allow_tdc_purchase,
        'message':          t.message,
        'created_at':       t.created_at.isoformat(),
        'expires_at':       t.expires_at.isoformat() if t.expires_at else None,
        'is_mine':          me and str(t.seller_id) == str(me.id),
        # Market value context
        'offer_tdc_value':  float(t.offer_amount) * rates.get(t.offer_resource, 1),
        'request_tdc_value':float(t.request_amount) * rates.get(t.request_resource, 1),
    }


def get_player_resource(player, resource: str) -> float:
    """Get player's current amount of a resource (from territories)."""
    if resource == 'tdc':
        return float(player.tdc_in_game)
    # Sum stockpiles across owned territories
    from terra_domini.apps.territories.models import Territory
    from django.db.models import Sum
    field = f'stockpile_{resource}'
    result = Territory.objects.filter(owner=player).aggregate(total=Sum(field))
    return float(result['total'] or 0)


def deduct_player_resource(player, resource: str, amount: Decimal) -> bool:
    """Deduct resource. Returns False if insufficient."""
    from terra_domini.apps.accounts.models import Player
    if resource == 'tdc':
        if float(player.tdc_in_game) < float(amount):
            return False
        Player.objects.filter(id=player.id).update(tdc_in_game=F('tdc_in_game') - amount)
        return True
    # Deduct from territory stockpiles (largest first)
    from terra_domini.apps.territories.models import Territory
    field = f'stockpile_{resource}'
    territories = Territory.objects.filter(owner=player).filter(
        **{f'{field}__gt': 0}
    ).order_by(f'-{field}')
    remaining = float(amount)
    for t in territories:
        available = getattr(t, field, 0)
        if available <= 0:
            continue
        take = min(available, remaining)
        Territory.objects.filter(id=t.id).update(**{field: F(field) - int(take)})
        remaining -= take
        if remaining <= 0:
            return True
    return remaining <= 0


def credit_player_resource(player, resource: str, amount: Decimal):
    """Add resource to player's largest territory stockpile."""
    from terra_domini.apps.accounts.models import Player
    if resource == 'tdc':
        Player.objects.filter(id=player.id).update(tdc_in_game=F('tdc_in_game') + amount)
        return
    from terra_domini.apps.territories.models import Territory
    field = f'stockpile_{resource}'
    # Add to territory with most space
    best = Territory.objects.filter(owner=player).order_by('-stockpile_capacity').first()
    if best:
        Territory.objects.filter(id=best.id).update(**{field: F(field) + int(amount)})


class ResourceTradeViewSet(viewsets.GenericViewSet):
    permission_classes = [IsAuthenticated]

    @action(detail=False, methods=['GET'], url_path='rates')
    def rates(self, request):
        """Current market rates — TDC value per unit."""
        rates = ResourceTrade.market_rates()
        return Response({
            'rates': [{
                'resource': k,
                'emoji':    RESOURCE_EMOJI.get(k, '📦'),
                'tdc_per_unit': v,
            } for k, v in rates.items()],
            'note': 'Rates shift with active world events (Hormuz crisis → Energy +40%)',
        })

    @action(detail=False, methods=['GET'], url_path='market')
    def market(self, request):
        """Open market listings — all pending trades."""
        resource_filter = request.query_params.get('resource', '')
        qs = ResourceTrade.objects.filter(
            status='pending', mode='market'
        ).select_related('seller', 'buyer').order_by('-created_at')
        if resource_filter:
            qs = qs.filter(Q(offer_resource=resource_filter) | Q(request_resource=resource_filter))
        qs = qs[:50]
        return Response({
            'trades': [serialize_trade(t, request.user) for t in qs],
            'count': qs.count(),
        })

    @action(detail=False, methods=['POST'], url_path='list')
    def create_listing(self, request):
        """POST {mode, offer_resource, offer_amount, request_resource, request_amount, message}"""
        mode             = request.data.get('mode', 'market')
        offer_res        = request.data.get('offer_resource', '')
        offer_amt        = Decimal(str(request.data.get('offer_amount', 0)))
        request_res      = request.data.get('request_resource', '')
        request_amt      = Decimal(str(request.data.get('request_amount', 0)))
        message          = request.data.get('message', '')[:200]

        if not offer_res or not request_res or offer_amt <= 0 or request_amt <= 0:
            return Response({'error': 'All fields required'}, status=400)

        # Check seller has enough
        available = get_player_resource(request.user, offer_res)
        if available < float(offer_amt):
            return Response({
                'error': f'Insufficient {offer_res}. Have {available:.1f}, need {float(offer_amt):.1f}',
            }, status=400)

        # Compute market price
        rates = ResourceTrade.market_rates()
        market_price = offer_amt * Decimal(str(rates.get(offer_res, 1)))

        import datetime
        trade = ResourceTrade.objects.create(
            mode=mode, seller=request.user,
            offer_resource=offer_res, offer_amount=offer_amt,
            request_resource=request_res, request_amount=request_amt,
            market_price_tdc=market_price,
            message=message,
            expires_at=timezone.now() + datetime.timedelta(hours=48),
        )
        return Response({'success': True, 'trade': serialize_trade(trade, request.user)}, status=201)

    @action(detail=True, methods=['POST'], url_path='accept')
    def accept_trade(self, request, pk=None):
        """Accept and execute a trade."""
        try:
            trade = ResourceTrade.objects.select_related('seller').get(id=pk, status='pending')
        except ResourceTrade.DoesNotExist:
            return Response({'error': 'Trade not found or no longer available'}, status=404)

        if str(trade.seller_id) == str(request.user.id):
            return Response({'error': 'Cannot accept your own trade'}, status=400)

        buyer = request.user

        with transaction.atomic():
            # Verify buyer has enough of request_resource
            buyer_has = get_player_resource(buyer, trade.request_resource)
            if buyer_has < float(trade.request_amount):
                return Response({
                    'error': f'Need {float(trade.request_amount):.1f} {trade.request_resource}. You have {buyer_has:.1f}',
                }, status=400)

            # Verify seller still has offer_resource
            seller_has = get_player_resource(trade.seller, trade.offer_resource)
            if seller_has < float(trade.offer_amount):
                trade.status = 'cancelled'
                trade.save(update_fields=['status'])
                return Response({'error': 'Seller no longer has enough resources'}, status=400)

            # Execute
            deduct_player_resource(buyer,         trade.request_resource, trade.request_amount)
            deduct_player_resource(trade.seller,  trade.offer_resource,   trade.offer_amount)
            credit_player_resource(buyer,         trade.offer_resource,   trade.offer_amount)
            credit_player_resource(trade.seller,  trade.request_resource, trade.request_amount)

            trade.buyer = buyer
            trade.status = 'completed'
            trade.completed_at = timezone.now()
            trade.save(update_fields=['buyer', 'status', 'completed_at'])

        return Response({
            'success': True,
            'received': f'{float(trade.offer_amount):.1f} {RESOURCE_EMOJI.get(trade.offer_resource,"")} {trade.offer_resource}',
            'gave': f'{float(trade.request_amount):.1f} {RESOURCE_EMOJI.get(trade.request_resource,"")} {trade.request_resource}',
        })

    @action(detail=True, methods=['POST'], url_path='buy-tdc')
    def buy_with_tdc(self, request, pk=None):
        """Buy a market listing directly with TDC."""
        try:
            trade = ResourceTrade.objects.select_related('seller').get(
                id=pk, status='pending', allow_tdc_purchase=True
            )
        except ResourceTrade.DoesNotExist:
            return Response({'error': 'Listing not found or TDC purchase not allowed'}, status=404)

        price = trade.market_price_tdc
        buyer = request.user

        if float(buyer.tdc_in_game) < float(price):
            return Response({
                'error': f'Need {float(price):.0f} TDC. You have {float(buyer.tdc_in_game):.0f}',
            }, status=400)

        with transaction.atomic():
            if not deduct_player_resource(buyer, 'tdc', price):
                return Response({'error': 'Insufficient TDC'}, status=400)

            if not deduct_player_resource(trade.seller, trade.offer_resource, trade.offer_amount):
                return Response({'error': 'Seller no longer has resources'}, status=400)

            # Seller gets 90% of TDC price (10% market fee)
            seller_gets = price * Decimal('0.90')
            credit_player_resource(trade.seller, 'tdc', seller_gets)
            credit_player_resource(buyer, trade.offer_resource, trade.offer_amount)

            trade.buyer = buyer
            trade.status = 'completed'
            trade.completed_at = timezone.now()
            trade.save(update_fields=['buyer', 'status', 'completed_at'])

        return Response({
            'success': True,
            'spent_tdc': float(price),
            'received': f'{float(trade.offer_amount):.1f} {trade.offer_resource}',
        })

    @action(detail=True, methods=['POST'], url_path='cancel')
    def cancel_trade(self, request, pk=None):
        try:
            trade = ResourceTrade.objects.get(id=pk, seller=request.user, status='pending')
            trade.status = 'cancelled'
            trade.save(update_fields=['status'])
            return Response({'success': True})
        except ResourceTrade.DoesNotExist:
            return Response({'error': 'Trade not found'}, status=404)

    @action(detail=False, methods=['GET'], url_path='my-trades')
    def my_trades(self, request):
        trades = ResourceTrade.objects.filter(
            Q(seller=request.user) | Q(buyer=request.user)
        ).select_related('seller', 'buyer').order_by('-created_at')[:30]
        return Response([serialize_trade(t, request.user) for t in trades])

    @action(detail=False, methods=['GET'], url_path='my-resources')
    def my_resources(self, request):
        """Player's current resource stockpiles across all territories."""
        resources = ['water','food','energy','credits','materials','culture','intel']
        rates = ResourceTrade.market_rates()
        result = []
        for res in resources:
            amount = get_player_resource(request.user, res)
            result.append({
                'resource':   res,
                'emoji':      RESOURCE_EMOJI.get(res, '📦'),
                'amount':     amount,
                'tdc_value':  round(amount * rates.get(res, 1), 2),
            })
        # Also add TDC
        result.append({
            'resource': 'tdc', 'emoji': '🪙',
            'amount': float(request.user.tdc_in_game), 'tdc_value': float(request.user.tdc_in_game),
        })
        return Response({'resources': result, 'total_tdc_value': sum(r['tdc_value'] for r in result)})

    @action(detail=False, methods=['POST'], url_path='scout')
    def scout(self, request):
        """POST {h3_index} — scout a territory to discover hidden resources."""
        h3_index = request.data.get('h3_index', '').strip()
        if not h3_index:
            return Response({'error': 'h3_index required'}, status=400)
        from terra_domini.apps.territories.models import Territory
        from terra_domini.apps.territories.resource_engine import scout_hidden_resource
        try:
            territory = Territory.objects.get(h3_index=h3_index)
        except Territory.DoesNotExist:
            return Response({'error': 'Territory not found'}, status=404)
        result = scout_hidden_resource(territory, request.user)
        return Response(result)
