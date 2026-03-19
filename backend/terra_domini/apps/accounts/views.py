"""
Account API views — registration, login, profile management.
"""
import logging
from django.core.cache import caches
from django.utils import timezone
from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from rest_framework_simplejwt.tokens import RefreshToken

from terra_domini.apps.accounts.models import Player, PlayerStats
from terra_domini.apps.territories.serializers import PlayerProfileSerializer, PlayerPublicSerializer

logger = logging.getLogger('terra_domini.accounts')


class RegisterView(generics.CreateAPIView):
    permission_classes = [AllowAny]

    def post(self, request):
        data = request.data
        required = ['email', 'username', 'password']
        missing = [f for f in required if not data.get(f)]
        if missing:
            return Response({'error': f'Missing: {missing}'}, status=400)

        email = data['email'].lower().strip()
        username = data['username'].strip()
        password = data['password']

        # Validate
        if len(username) < 3 or len(username) > 32:
            return Response({'error': 'Username must be 3-32 characters'}, status=400)
        if len(password) < 10:
            return Response({'error': 'Password must be at least 10 characters'}, status=400)
        if Player.objects.filter(email=email).exists():
            return Response({'error': 'Email already registered'}, status=409)
        if Player.objects.filter(username__iexact=username).exists():
            return Response({'error': 'Username taken'}, status=409)

        player = Player.objects.create_user(
            email=email,
            username=username,
            password=password,
            display_name=data.get('display_name', username),
            preferred_language=data.get('language', 'en'),
        )

        # Initialize stats
        PlayerStats.objects.create(player=player)

        # Set beginner protection (7 days)
        from django.conf import settings
        from datetime import timedelta
        player.beginner_protection_until = timezone.now() + timedelta(
            days=settings.GAME['BEGINNER_PROTECTION_DAYS']
        )
        player.save(update_fields=['beginner_protection_until'])

        # Issue tokens
        refresh = RefreshToken.for_user(player)
        logger.info(f"New player registered: {player.username}")

        return Response({
            'message': 'Account created',
            'access': str(refresh.access_token),
            'refresh': str(refresh),
            'player': PlayerProfileSerializer(player).data,
        }, status=201)


class LoginView(TokenObtainPairView):
    """Standard JWT login. POST {email, password} → {access, refresh}."""
    permission_classes = [AllowAny]

    def post(self, request, *args, **kwargs):
        response = super().post(request, *args, **kwargs)
        if response.status_code == 200:
            # Find player and attach profile
            from rest_framework_simplejwt.tokens import AccessToken
            token = AccessToken(response.data['access'])
            try:
                player = Player.objects.select_related('stats').get(id=token['user_id'])
                if player.is_banned:
                    return Response({'error': 'Account suspended', 'reason': player.ban_reason}, status=403)
                response.data['player'] = PlayerProfileSerializer(player).data
                logger.info(f"Login: {player.username}")
            except Exception:
                pass
        return response


class RefreshView(TokenRefreshView):
    permission_classes = [AllowAny]


class PlayerProfileView(generics.RetrieveUpdateAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = PlayerProfileSerializer

    def get_object(self):
        return self.request.user

    def update(self, request, *args, **kwargs):
        allowed_fields = {'display_name', 'avatar_url', 'preferred_language', 'notifications_enabled'}
        data = {k: v for k, v in request.data.items() if k in allowed_fields}
        serializer = self.get_serializer(request.user, data=data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


class WalletLinkView(APIView):
    """Link an Ethereum/Polygon wallet address to player account."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        from web3 import Web3
        wallet = request.data.get('wallet_address', '').strip().lower()

        if not Web3.is_address(wallet):
            return Response({'error': 'Invalid wallet address'}, status=400)

        # Check not already used by another player
        if Player.objects.filter(wallet_address=wallet).exclude(id=request.user.id).exists():
            return Response({'error': 'Wallet already linked to another account'}, status=409)

        # Signature verification (prove wallet ownership)
        signature = request.data.get('signature')
        if signature:
            from eth_account.messages import encode_defunct
            from eth_account import Account
            message = f"Link wallet to Terra Domini account: {request.user.id}"
            try:
                msg = encode_defunct(text=message)
                recovered = Account.recover_message(msg, signature=signature)
                if recovered.lower() != wallet:
                    return Response({'error': 'Signature verification failed'}, status=400)
            except Exception:
                return Response({'error': 'Invalid signature'}, status=400)

        request.user.wallet_address = wallet
        request.user.save(update_fields=['wallet_address'])

        return Response({'message': 'Wallet linked', 'wallet_address': wallet})


class LeaderboardView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        board_type = request.query_params.get('type', 'territory')
        game_cache = caches['game_state']

        cache_key = f'leaderboard:{board_type}'
        data = game_cache.get(cache_key)

        if not data:
            # Rebuild on miss
            from terra_domini.apps.territories.tasks import refresh_leaderboards
            refresh_leaderboards.delay()
            # Return empty while rebuilding
            data = []

        return Response({
            'type': board_type,
            'leaderboard': data,
            'generated_at': timezone.now().isoformat(),
        })


class PlayerSearchView(generics.ListAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = PlayerPublicSerializer

    def get_queryset(self):
        q = self.request.query_params.get('q', '').strip()
        if len(q) < 2:
            return Player.objects.none()
        return Player.objects.filter(
            username__icontains=q, is_active=True
        ).select_related('stats')[:20]
