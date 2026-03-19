"""Blockchain views — TDC purchase, wallet, withdrawal."""
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.utils import timezone


class TDCBalanceView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        player = request.user
        return Response({
            'tdc_in_game': float(player.tdc_in_game),
            'wallet_address': player.wallet_address,
            'tdc_eur_rate': 100,
            'eur_equivalent': float(player.tdc_in_game) / 100,
        })


class TDCPurchaseView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        """Initiate Stripe payment intent for TDC purchase."""
        import stripe
        from django.conf import settings
        eur_amount = float(request.data.get('eur_amount', 0))
        if eur_amount < 1.99:
            return Response({'error': 'Minimum purchase €1.99'}, status=400)
        if eur_amount > 999:
            return Response({'error': 'Maximum purchase €999 per transaction'}, status=400)

        try:
            stripe.api_key = settings.STRIPE_SECRET_KEY
            intent = stripe.PaymentIntent.create(
                amount=int(eur_amount * 100),  # cents
                currency='eur',
                metadata={
                    'player_id': str(request.user.id),
                    'tdc_amount': int(eur_amount * 100),  # 1 EUR = 100 TDC
                    'player_username': request.user.username,
                },
            )
            return Response({
                'client_secret': intent.client_secret,
                'payment_intent_id': intent.id,
                'tdc_amount': int(eur_amount * 100),
                'bonus_tdc': int(eur_amount * 100 * 0.1) if eur_amount >= 10 else 0,
            })
        except Exception as e:
            return Response({'error': 'Payment service unavailable'}, status=503)


class TDCWithdrawView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        amount_tdc = int(request.data.get('amount_tdc', 0))
        wallet_address = request.data.get('wallet_address', '').strip()

        if amount_tdc < 50:
            return Response({'error': 'Minimum withdrawal: 50 TDC'}, status=400)
        if float(request.user.tdc_in_game) < amount_tdc:
            return Response({'error': 'Insufficient TDC balance'}, status=400)
        if not wallet_address.startswith('0x') or len(wallet_address) != 42:
            return Response({'error': 'Invalid wallet address'}, status=400)

        # Queue blockchain task
        from terra_domini.apps.blockchain.tasks import fulfill_tdc_purchase
        # Deduct from balance
        from terra_domini.apps.accounts.models import Player
        from django.db.models import F
        Player.objects.filter(id=request.user.id).update(
            tdc_in_game=F('tdc_in_game') - amount_tdc
        )
        fee = int(amount_tdc * 0.03)
        net = amount_tdc - fee
        return Response({
            'status': 'queued',
            'amount_tdc': amount_tdc,
            'fee_tdc': fee,
            'net_tdc': net,
            'wallet': wallet_address,
            'message': f'Withdrawal of {net} TDC queued. Arrives within 10 minutes.',
        })
