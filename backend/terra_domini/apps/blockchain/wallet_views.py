"""
Crypto wallet + dual currency endpoints.
GET  /api/wallet/me/          — wallet + TDI balance
GET  /api/wallet/prices/       — live crypto prices (CoinGecko cached)
POST /api/wallet/convert/      — convert TDI → TDC at current rate
POST /api/wallet/withdraw/     — request external wallet withdrawal
GET  /api/wallet/transactions/ — TDI transaction history
GET  /api/wallet/newsfeed/     — crypto news (CoinGecko news endpoint)
"""
import logging
import requests
from decimal import Decimal
from django.utils import timezone
from django.db.models import F
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from terra_domini.apps.blockchain.service import (
    CryptoWallet, TDITransaction, CryptoPriceCache
)

logger = logging.getLogger('terra_domini.wallet')

# Simulated TDI price relative to MATIC (in prod: use real DEX price)
TDI_USD_PRICE = Decimal('0.0042')


def _ensure_wallet(player):
    wallet, _ = CryptoWallet.objects.get_or_create(player=player)
    return wallet


def _get_prices():
    """Return cached prices, refresh if stale (>5 min)."""
    from django.utils import timezone as tz
    import datetime
    threshold = tz.now() - datetime.timedelta(minutes=5)
    stale = CryptoPriceCache.objects.filter(updated_at__lt=threshold)
    if stale.exists() or not CryptoPriceCache.objects.exists():
        try:
            r = requests.get(
                'https://api.coingecko.com/api/v3/simple/price',
                params={'ids': 'matic-network,bitcoin,ethereum', 'vs_currencies': 'usd',
                        'include_24hr_change': 'true', 'include_market_cap': 'true'},
                timeout=3
            ).json()
            updates = {
                'MATIC': ('matic-network', r.get('matic-network', {})),
                'BTC':   ('bitcoin',       r.get('bitcoin', {})),
                'ETH':   ('ethereum',      r.get('ethereum', {})),
            }
            for sym, (_, d) in updates.items():
                CryptoPriceCache.objects.update_or_create(
                    symbol=sym,
                    defaults={
                        'price_usd':  Decimal(str(d.get('usd', 0))),
                        'change_24h': d.get('usd_24h_change', 0),
                        'market_cap': Decimal(str(d.get('usd_market_cap', 0) or 0)),
                    }
                )
            # TDI = our token, pegged to MATIC * 0.0042 ratio
            matic_price = Decimal(str(r.get('matic-network', {}).get('usd', 0.5)))
            CryptoPriceCache.objects.update_or_create(
                symbol='TDI',
                defaults={
                    'price_usd': matic_price * Decimal('0.0042'),
                    'change_24h': r.get('matic-network', {}).get('usd_24h_change', 0),
                }
            )
        except Exception as e:
            logger.warning(f'Price fetch failed: {e}')

    return {p.symbol: {
        'price_usd': float(p.price_usd),
        'change_24h': p.change_24h,
        'market_cap': float(p.market_cap) if p.market_cap else None,
        'updated_at': p.updated_at.isoformat(),
    } for p in CryptoPriceCache.objects.all()}


class WalletViewSet(viewsets.GenericViewSet):
    permission_classes = [IsAuthenticated]

    @action(detail=False, methods=['GET'], url_path='me')
    def me(self, request):
        wallet = _ensure_wallet(request.user)
        prices = _get_prices()
        tdi_price = Decimal(str(prices.get('TDI', {}).get('price_usd', TDI_USD_PRICE)))
        return Response({
            'tdc_in_game':       float(request.user.tdc_in_game),
            'tdi_balance':       float(wallet.tdi_balance),
            'tdi_staked':        float(wallet.tdi_staked),
            'tdi_pending':       float(wallet.tdi_pending_withdraw),
            'tdi_usd_value':     float(wallet.tdi_balance * tdi_price),
            'total_earned':      float(wallet.total_tdi_earned),
            'total_withdrawn':   float(wallet.total_tdi_withdrawn),
            'external_wallet':   wallet.external_wallet,
            'kyc_verified':      wallet.kyc_verified,
            'tdi_price_usd':     float(tdi_price),
        })

    @action(detail=False, methods=['GET'], url_path='prices')
    def prices(self, request):
        return Response(_get_prices())

    @action(detail=False, methods=['POST'], url_path='convert')
    def convert(self, request):
        """Convert TDI → TDC at current rate (1 TDI = X TDC based on prices)."""
        amount_tdi = Decimal(str(request.data.get('amount_tdi', 0)))
        if amount_tdi <= 0:
            return Response({'error': 'amount_tdi must be > 0'}, status=400)

        wallet = _ensure_wallet(request.user)
        if wallet.tdi_balance < amount_tdi:
            return Response({'error': f'Insufficient TDI. Have {wallet.tdi_balance:.6f}'}, status=400)

        prices = _get_prices()
        tdi_price = Decimal(str(prices.get('TDI', {}).get('price_usd', 0.002)))
        # 1 TDC = $0.001 (internal fixed rate); TDI → TDC = tdi_price / 0.001
        tdc_rate = tdi_price / Decimal('0.001')
        tdc_earned = amount_tdi * tdc_rate

        CryptoWallet.objects.filter(player=request.user).update(
            tdi_balance=F('tdi_balance') - amount_tdi
        )
        from django.db.models import F as FF
        from terra_domini.apps.accounts.models import Player
        Player.objects.filter(id=request.user.id).update(
            tdc_in_game=FF('tdc_in_game') + tdc_earned
        )
        TDITransaction.objects.create(
            player=request.user, tx_type='convert_to_tdc',
            amount_tdi=-amount_tdi,
            note=f'Converted {amount_tdi:.6f} TDI → {tdc_earned:.2f} TDC'
        )
        return Response({
            'success': True, 'tdi_spent': float(amount_tdi),
            'tdc_earned': float(tdc_earned), 'rate': float(tdc_rate)
        })

    @action(detail=False, methods=['POST'], url_path='withdraw')
    def withdraw(self, request):
        """Request TDI withdrawal to external wallet."""
        amount = Decimal(str(request.data.get('amount_tdi', 0)))
        wallet_address = request.data.get('wallet_address', '').strip()

        if amount < Decimal('10'):
            return Response({'error': 'Minimum withdrawal: 10 TDI'}, status=400)
        if not wallet_address.startswith('0x') or len(wallet_address) != 42:
            return Response({'error': 'Invalid Polygon wallet address'}, status=400)
        if not request.user.crypto_wallet.kyc_verified:
            return Response({'error': 'KYC verification required for withdrawals'}, status=403)

        wallet = _ensure_wallet(request.user)
        if wallet.tdi_balance < amount:
            return Response({'error': 'Insufficient TDI balance'}, status=400)

        CryptoWallet.objects.filter(player=request.user).update(
            tdi_balance=F('tdi_balance') - amount,
            tdi_pending_withdraw=F('tdi_pending_withdraw') + amount,
            external_wallet=wallet_address,
        )
        TDITransaction.objects.create(
            player=request.user, tx_type='withdraw',
            amount_tdi=-amount, note=f'Withdrawal request → {wallet_address}'
        )
        return Response({'success': True, 'amount': float(amount), 'status': 'pending', 'eta': '24-48h'})

    @action(detail=False, methods=['GET'], url_path='transactions')
    def transactions(self, request):
        txs = TDITransaction.objects.filter(player=request.user)[:50]
        return Response([{
            'type': t.tx_type, 'amount': float(t.amount_tdi),
            'usd_value': float(t.usd_value) if t.usd_value else None,
            'note': t.note, 'date': t.created_at.isoformat(),
            'tx_hash': t.tx_hash,
        } for t in txs])

    @action(detail=False, methods=['GET'], url_path='newsfeed')
    def newsfeed(self, request):
        """Crypto news from CoinGecko."""
        try:
            data = requests.get(
                'https://api.coingecko.com/api/v3/news',
                timeout=4
            ).json()
            articles = data.get('data', [])[:20]
            return Response([{
                'title': a.get('title'),
                'author': a.get('author'),
                'url': a.get('url'),
                'thumb': a.get('thumb_2x') or a.get('small_image_url'),
                'published_at': a.get('created_at'),
                'source': a.get('news_site'),
            } for a in articles])
        except Exception:
            return Response([])
