"""
Buy HEX with real money, straight from the shop (owner, 2026-10-18).

Fixed peg: 1 € = 1000 HEX = 1 HEX Coin (balance.HEX_PER_EUR / HEX_PER_COIN).
Card payment = Stripe Checkout (hosted page: no card data touches HEXOD).

  GET  /api/shop/hex-packs/              packs + whether card payments are configured
  POST /api/shop/hex-checkout/           {pack_id} → {url} of the Stripe payment page
  POST /api/shop/hex-checkout/confirm/   {session_id} → credits the HEX once Stripe says "paid"
  Stripe webhook checkout.session.completed → same fulfil (idempotent: whichever comes first)

Bought HEX lands in tdc_in_game + hex_purchased_balance (spent first on deterministic buys, never on
boosters or cash-out — balance.py). The on-chain HEX Coin side runs in the background: if the player has
a wallet and the chain is configured, the matching coins are minted; the game never waits for it.
"""
import logging
import threading
from decimal import Decimal

from django.conf import settings
from django.db import transaction
from django.db.models import F
from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from terra_domini.apps.economy import balance as B

logger = logging.getLogger('terra_domini.payments')


def _stripe():
    key = getattr(settings, 'STRIPE_SECRET_KEY', '') or ''
    if not key or 'placeholder' in key:
        return None
    try:
        import stripe
    except ImportError:
        return None
    stripe.api_key = key
    return stripe


def _pack(pack_id):
    return next((p for p in B.HEX_PACKS if p['id'] == pack_id), None)


def territory_eur_price(hex_cost: int) -> int:
    """Whole euros that cover a territory's HEX price at the peg (min 1 €)."""
    import math
    return max(1, math.ceil(hex_cost / B.HEX_PER_EUR))


def _territory_pack(user, h3_index):
    """Pack that unlocks one free hex far from the player's kingdom (same price rules as BUY)."""
    import h3
    from terra_domini.apps.territories.models import Territory
    t = Territory.objects.filter(h3_index=h3_index).first()
    if t and t.owner_id:
        return None
    owned = Territory.objects.filter(owner=user).count()
    adjacent = Territory.objects.filter(h3_index__in=list(set(h3.grid_disk(h3_index, 1)) - {h3_index}), owner=user).exists()
    cost = B.buy_cost(owned, adjacent or owned == 0, (t.rarity if t else 'common'))
    eur = territory_eur_price(cost)
    return {'id': f'territory:{h3_index}', 'eur': eur, 'hex': eur * B.HEX_PER_EUR, 'bonus': 0, 'territory': h3_index, 'cost': cost}


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def hex_packs(request):
    return Response({
        'packs': [{**p, 'total': p['hex'] + p['bonus']} for p in B.HEX_PACKS],
        'hex_per_eur': B.HEX_PER_EUR, 'hex_per_coin': B.HEX_PER_COIN,
        'card_payments': _stripe() is not None,
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def hex_checkout(request):
    from terra_domini.apps.blockchain.service import PurchaseOrder
    h3_index = request.data.get('territory_h3')
    pack = _territory_pack(request.user, h3_index) if h3_index else _pack(request.data.get('pack_id'))
    if not pack:
        return Response({'error': 'This territory is no longer free' if h3_index else 'Unknown pack'}, status=400)
    stripe = _stripe()
    if not stripe:
        return Response({'error': 'Card payments are not open yet on this server.'}, status=503)
    site = (getattr(settings, 'SITE_URL', '') or request.build_absolute_uri('/')).rstrip('/')
    total = pack['hex'] + pack['bonus']
    try:
        session = stripe.checkout.Session.create(
            mode='payment',
            line_items=[{'quantity': 1, 'price_data': {
                'currency': 'eur', 'unit_amount': int(pack['eur'] * 100),
                'product_data': {'name': f"Territory {pack['territory']}" if pack.get('territory') else f'{total:,} HEX',
                                 'description': f"{pack['hex']:,} HEX"
                                 + (f" + {pack['bonus']:,} bonus" if pack['bonus'] else '') + ' · HEXOD'},
            }}],
            client_reference_id=str(request.user.id),
            customer_email=request.user.email or None,
            metadata={'player_id': str(request.user.id), 'pack_id': pack['id'], 'hex': str(pack['hex']), 'bonus': str(pack['bonus']),
                      'territory_h3': pack.get('territory', '')},
            success_url=f'{site}/?hex_paid={{CHECKOUT_SESSION_ID}}',
            cancel_url=f'{site}/?hex_cancel=1',
        )
    except Exception as e:
        logger.error(f'Stripe checkout failed: {e}')
        return Response({'error': 'Payment service unavailable, try again later.'}, status=503)
    PurchaseOrder.objects.create(
        player=request.user, eur_amount=Decimal(pack['eur']), tdc_amount=Decimal(pack['hex']),
        bonus_tdc=Decimal(pack['bonus']), payment_provider='stripe_checkout', payment_intent_id=session.id,
    )
    return Response({'url': session.url, 'session_id': session.id})


def fulfil(session_id: str) -> dict:
    """Credit the HEX of a paid Checkout session exactly once. Returns {'status', 'hex'}."""
    from terra_domini.apps.accounts.models import Player
    from terra_domini.apps.blockchain.service import PurchaseOrder, TDCTransaction
    stripe = _stripe()
    if not stripe:
        return {'status': 'unavailable'}
    session = stripe.checkout.Session.retrieve(session_id)
    if session.get('payment_status') != 'paid':
        return {'status': session.get('payment_status') or 'unpaid'}
    with transaction.atomic():
        order = PurchaseOrder.objects.select_for_update().filter(payment_intent_id=session_id).first()
        if not order:
            return {'status': 'unknown_order'}
        total = order.tdc_amount + order.bonus_tdc
        if order.status == PurchaseOrder.OrderStatus.COMPLETED:
            return {'status': 'already_credited', 'hex': float(total)}
        if int(session.get('amount_total') or 0) != int(order.eur_amount * 100):
            logger.error(f'Amount mismatch on {session_id}')
            return {'status': 'amount_mismatch'}
        Player.objects.filter(id=order.player_id).update(
            tdc_in_game=F('tdc_in_game') + total,
            hex_purchased_balance=F('hex_purchased_balance') + total,
            total_tdc_purchased=F('total_tdc_purchased') + total,
        )
        tx = TDCTransaction.objects.create(
            player_id=order.player_id, transaction_type=TDCTransaction.TransactionType.PURCHASE,
            amount_tdc=total, amount_eur=order.eur_amount, status='completed', confirmed_at=timezone.now(),
            metadata={'session': session_id, 'hex_coin': float(total) / B.HEX_PER_COIN},
        )
        order.status = PurchaseOrder.OrderStatus.COMPLETED
        order.tdc_transaction = tx
        order.paid_at = order.completed_at = timezone.now()
        order.save()
    threading.Thread(target=_mint_in_background, args=(str(order.id),), daemon=True).start()
    claimed = None
    h3_index = (session.get('metadata') or {}).get('territory_h3')
    if h3_index:
        claimed = _claim_paid_territory(order.player_id, h3_index)
    return {'status': 'credited', 'hex': float(total), 'territory': h3_index or None, 'claimed': claimed}


def _claim_paid_territory(player_id, h3_index) -> bool:
    """Spend the just-credited HEX on the paid hex. If someone took it meanwhile, the HEX stays on the balance."""
    import h3
    from terra_domini.apps.accounts.models import Player
    from terra_domini.apps.territories.models import Territory
    with transaction.atomic():
        player = Player.objects.select_for_update().get(id=player_id)
        t = Territory.objects.select_for_update().filter(h3_index=h3_index).first()
        if t and t.owner_id:
            return False
        if not t:
            try:
                from terra_domini.apps.territories.territory_engine import generate_territory
                lat, lon = h3.cell_to_latlng(h3_index)
                generate_territory(h3_index, lat, lon)
            except Exception:
                pass
            t = Territory.objects.select_for_update().filter(h3_index=h3_index).first()
            if not t:
                lat, lon = h3.cell_to_latlng(h3_index)
                t = Territory.objects.create(h3_index=h3_index, h3_resolution=8, center_lat=lat, center_lon=lon)
        owned = Territory.objects.filter(owner=player).count()
        adjacent = Territory.objects.filter(h3_index__in=list(set(h3.grid_disk(h3_index, 1)) - {h3_index}), owner=player).exists()
        cost = B.buy_cost(owned, adjacent or owned == 0, t.rarity or 'common')
        if Decimal(str(player.tdc_in_game)) < cost:
            return False
        Player.objects.filter(id=player.id).update(tdc_in_game=F('tdc_in_game') - cost)
        B.consume_purchased_first(player, cost)
        t.owner = player; t.captured_at = timezone.now()
        t.save(update_fields=['owner', 'captured_at'])
    return True


def _mint_in_background(order_id: str) -> None:
    """On-chain side of the peg: mint the HEX Coin to the player's wallet if there is one. Never blocks the game."""
    try:
        from terra_domini.apps.blockchain.service import BlockchainService, PurchaseOrder
        order = PurchaseOrder.objects.select_related('player').get(id=order_id)
        wallet = order.player.wallet_address
        if not wallet:
            return
        tx_hash = BlockchainService.get().mint_for_purchase(wallet, order.eur_amount, str(order.id))
        if tx_hash and order.tdc_transaction_id:
            from terra_domini.apps.blockchain.service import TDCTransaction
            TDCTransaction.objects.filter(id=order.tdc_transaction_id).update(tx_hash=tx_hash)
    except Exception as e:   # chain not configured / RPC down: in-game HEX is already credited
        logger.info(f'HEX Coin mint skipped for order {order_id}: {e}')


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def hex_checkout_confirm(request):
    from terra_domini.apps.blockchain.service import PurchaseOrder
    sid = request.data.get('session_id', '')
    if not PurchaseOrder.objects.filter(payment_intent_id=sid, player=request.user).exists():
        return Response({'error': 'Unknown payment'}, status=404)
    try:
        r = fulfil(sid)
    except Exception as e:
        logger.error(f'Confirm failed for {sid}: {e}')
        return Response({'error': 'Could not verify the payment yet, it will be credited automatically.'}, status=502)
    from terra_domini.apps.accounts.models import Player
    bal = Player.objects.filter(id=request.user.id).values_list('tdc_in_game', flat=True).first()
    ok = r['status'] in ('credited', 'already_credited')
    return Response({**r, 'balance': float(bal or 0)}, status=200 if ok else 402)
