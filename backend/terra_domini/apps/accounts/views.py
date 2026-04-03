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
            days=getattr(settings, 'GAME', {}).get('BEGINNER_PROTECTION_DAYS', 7)
        )

        # #10: Detect geolocation from IP
        try:
            from terra_domini.apps.accounts.geoip_view import get_geoip_data
            geo = get_geoip_data(request)
            if geo.get('lat') and geo.get('lon'):
                player.initial_lat = geo['lat']
                player.initial_lon = geo['lon']
                player.initial_country = geo.get('country', '')
        except Exception:
            pass

        # #9: Generate email verification code
        from terra_domini.apps.accounts.email_service import generate_verification_code, send_verification_email
        code = generate_verification_code()
        player.email_verification_code = code
        player.email_verification_sent_at = timezone.now()
        player.email_verified = False

        player.save()

        # Send verification email
        try:
            send_verification_email(player, code)
        except Exception as e:
            logger.warning(f"Verification email failed for {player.username}: {e}")

        logger.info(f"New player registered: {player.username} (verification pending)")

        # Return pending status — don't auto-login until verified
        return Response({
            'message': 'Account created — check your email for verification code',
            'status': 'pending_verification',
            'email': email,
            'username': username,
        }, status=201)


class LoginView(TokenObtainPairView):
    """Standard JWT login. POST {email, password} → {access, refresh}."""
    permission_classes = [AllowAny]

    def post(self, request, *args, **kwargs):
        # Check email verification before allowing login
        email = request.data.get('email', '').lower().strip()
        if email:
            try:
                player = Player.objects.get(email=email)
                if not player.email_verified:
                    return Response({
                        'error': 'Email not verified',
                        'requires_verification': True,
                        'email': email,
                    }, status=403)
            except Player.DoesNotExist:
                pass  # Let SimpleJWT handle the error

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


# ─── Password Reset (uses configured EMAIL_BACKEND) ───────────────────────────

from django.contrib.auth.tokens import default_token_generator
from django.utils.http import urlsafe_base64_encode, urlsafe_base64_decode
from django.utils.encoding import force_bytes, force_str
from django.core.mail import send_mail
from django.conf import settings as django_settings


class VerifyEmailView(APIView):
    """POST /api/auth/verify-email/ {email, code}"""
    permission_classes = [AllowAny]

    def post(self, request):
        email = request.data.get('email', '').lower().strip()
        code = request.data.get('code', '').strip()

        if not email or not code:
            return Response({'error': 'Email and code required'}, status=400)

        try:
            player = Player.objects.get(email=email)
        except Player.DoesNotExist:
            return Response({'error': 'Account not found'}, status=404)

        if player.email_verified:
            return Response({'error': 'Email already verified'}, status=400)

        # Check code expiry (24h)
        if player.email_verification_sent_at:
            from datetime import timedelta
            if timezone.now() - player.email_verification_sent_at > timedelta(hours=24):
                return Response({'error': 'Code expired — request a new one'}, status=410)

        if player.email_verification_code != code:
            return Response({'error': 'Invalid code'}, status=400)

        # Verify and issue tokens
        player.email_verified = True
        player.email_verification_code = ''
        player.save(update_fields=['email_verified', 'email_verification_code'])

        refresh = RefreshToken.for_user(player)
        logger.info(f"Email verified: {player.username}")

        # Send welcome email now that they're verified
        try:
            from terra_domini.apps.accounts.email_service import send_welcome_email
            send_welcome_email(player)
        except Exception:
            pass

        return Response({
            'message': 'Email verified!',
            'access': str(refresh.access_token),
            'refresh': str(refresh),
            'player': PlayerProfileSerializer(player).data,
        })


class ResendVerificationView(APIView):
    """POST /api/auth/resend-verification/ {email}"""
    permission_classes = [AllowAny]

    def post(self, request):
        email = request.data.get('email', '').lower().strip()
        try:
            player = Player.objects.get(email=email, email_verified=False)
        except Player.DoesNotExist:
            return Response({'message': 'If this email exists, a new code was sent.'})

        from terra_domini.apps.accounts.email_service import generate_verification_code, send_verification_email
        code = generate_verification_code()
        player.email_verification_code = code
        player.email_verification_sent_at = timezone.now()
        player.save(update_fields=['email_verification_code', 'email_verification_sent_at'])

        try:
            send_verification_email(player, code)
        except Exception as e:
            logger.warning(f"Resend verification failed: {e}")

        return Response({'message': 'If this email exists, a new code was sent.'})


class PasswordResetRequestView(APIView):
    permission_classes = []  # Public

    def post(self, request):
        email = request.data.get('email', '').lower().strip()
        try:
            player = Player.objects.get(email=email, is_active=True)
        except Player.DoesNotExist:
            # Don't reveal whether email exists
            return Response({'message': 'If this email is registered, a reset link has been sent.'})

        token = default_token_generator.make_token(player)
        uid   = urlsafe_base64_encode(force_bytes(player.pk))

        frontend_url = getattr(django_settings, 'FRONTEND_URL', f"{request.scheme}://{request.get_host()}")
        reset_url    = f"{frontend_url}/reset-password/{uid}/{token}/"

        try:
            send_mail(
                subject='Réinitialisation de votre mot de passe Hexod',
                message=(
                    f"Bonjour {player.username},\n\n"
                    f"Cliquez sur ce lien pour réinitialiser votre mot de passe :\n\n"
                    f"{reset_url}\n\n"
                    f"Ce lien expire dans 24 heures.\n\n"
                    f"Si vous n'avez pas demandé cette réinitialisation, ignorez cet email.\n\n"
                    f"— L'équipe Hexod"
                ),
                html_message=(
                    f"<div style='font-family:system-ui;max-width:480px;margin:auto;padding:32px;background:#07070f;color:#E5E7EB;border-radius:16px'>"
                    f"<div style='font-size:28px;margin-bottom:8px'>⬡ Hexod</div>"
                    f"<h2 style='color:#fff;margin-bottom:16px'>Réinitialisation du mot de passe</h2>"
                    f"<p>Bonjour <strong>{player.username}</strong>,</p>"
                    f"<p>Cliquez sur le bouton ci-dessous pour créer un nouveau mot de passe.</p>"
                    f"<a href='{reset_url}' style='display:inline-block;margin:20px 0;padding:14px 28px;"
                    f"background:#00FF87;color:#000;font-weight:800;border-radius:10px;text-decoration:none;font-size:15px'>"
                    f"🔑 Réinitialiser mon mot de passe</a>"
                    f"<p style='color:#6B7280;font-size:12px'>Ce lien expire dans 24 heures.<br>"
                    f"Si vous n'avez pas fait cette demande, ignorez cet email.</p>"
                    f"</div>"
                ),
                from_email=getattr(django_settings, 'DEFAULT_FROM_EMAIL', 'Hexod <noreply@hexod.io>'),
                recipient_list=[player.email],
                fail_silently=False,
            )
        except Exception as e:
            logger.error(f"Password reset email failed: {e}")

        return Response({'message': 'If this email is registered, a reset link has been sent.'})


class PasswordResetConfirmView(APIView):
    permission_classes = []  # Public

    def post(self, request):
        uid      = request.data.get('uid', '')
        token    = request.data.get('token', '')
        password = request.data.get('password', '')

        if len(password) < 8:
            return Response({'error': 'Password must be at least 8 characters.'}, status=400)

        try:
            pk     = force_str(urlsafe_base64_decode(uid))
            player = Player.objects.get(pk=pk, is_active=True)
        except (Player.DoesNotExist, ValueError, TypeError):
            return Response({'error': 'Invalid reset link.'}, status=400)

        if not default_token_generator.check_token(player, token):
            return Response({'error': 'Reset link expired or already used.'}, status=400)

        player.set_password(password)
        player.save(update_fields=['password'])
        logger.info(f"Password reset successful for {player.email}")

        return Response({'message': 'Password reset successful. You can now log in.'})


from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from terra_domini.apps.accounts.models import Player


class PlayerViewSet(viewsets.GenericViewSet):
    permission_classes = [IsAuthenticated]

    @action(detail=False, methods=['GET', 'PATCH'], url_path='me')
    def me(self, request):
        p = request.user
        if request.method == 'PATCH':
            for field in ('display_name', 'avatar_emoji', 'bio'):
                if field in request.data:
                    setattr(p, field, request.data[field])
            save_fields = [f for f in ('display_name', 'avatar_emoji', 'bio') if f in request.data]
            if save_fields:
                p.save(update_fields=save_fields)
            return Response({'success': True})
        # GET
        return Response({
            'id': str(p.id), 'username': p.username,
            'display_name': getattr(p, 'display_name', p.username),
            'avatar_emoji': getattr(p, 'avatar_emoji', '🎖️'),
            'bio': getattr(p, 'bio', ''),
            'commander_rank': getattr(p, 'commander_rank', 1),
            'tdc_in_game': float(getattr(p, 'tdc_in_game', 0)),
            'territories_owned': 0,
            'tutorial_completed': getattr(p, 'tutorial_completed', False),
            'is_bot': getattr(p, 'is_bot', False),
        })


    @action(detail=False, methods=['GET'], url_path='stamina')
    def stamina(self, request):
        """GET /api/players/stamina/ — live stamina state for HUD."""
        from terra_domini.apps.accounts.models import Player
        p = Player.objects.get(id=request.user.id)
        return Response({
            'slots_max':              p.action_slots_max,
            'slots_used':             p.action_slots_used,
            'slots_available':        p.action_slots_available,
            'next_slot_in_seconds':   int(p.next_slot_ready_in_seconds),
            'regen_progress_pct':     round(p.regen_progress_pct, 1),
            'regen_seconds_per_slot': int(p.regen_seconds_per_slot),
            'regen_bonus_pct':        p.regen_bonus_pct,
            'attack_power_bonus':     p.attack_power_bonus,
        })

    @action(detail=False, methods=['GET'], url_path='search')
    def search(self, request):
        q = request.query_params.get('q', '').strip()
        if len(q) < 2:
            return Response([])
        players = Player.objects.filter(
            username__icontains=q, is_bot=False
        ).exclude(id=request.user.id)[:10]
        return Response([{
            'id': str(p.id), 'username': p.username,
            'display_name': getattr(p, 'display_name', p.username),
            'avatar_emoji': getattr(p, 'avatar_emoji', '🎖️'),
            'commander_rank': getattr(p, 'commander_rank', 1),
        } for p in players])


class UpdateProfileView(APIView):
    """PATCH /api/players/update-profile/"""
    permission_classes = [IsAuthenticated]

    def patch(self, request):
        player = request.user
        data = request.data

        if 'display_name' in data:
            player.display_name = str(data['display_name'])[:50]
        if 'avatar_emoji' in data:
            player.avatar_emoji = str(data['avatar_emoji'])[:8]
        if 'spec_path' in data and data['spec_path'] in ['military','economic','diplomatic','scientific']:
            player.spec_path = data['spec_path']
        if 'bio' in data:
            player.bio = str(data['bio'])[:300]

        player.save(update_fields=['display_name','avatar_emoji','spec_path','bio'])
        return Response({'ok': True, 'display_name': player.display_name,
                        'avatar_emoji': player.avatar_emoji, 'spec_path': player.spec_path})
