"""
Custom middleware stack for Terra Domini.
"""
import time
import logging
from urllib.parse import parse_qs

from django.conf import settings
from django.contrib.auth.models import AnonymousUser
from django.utils import timezone
from channels.db import database_sync_to_async
from channels.middleware import BaseMiddleware

logger = logging.getLogger('terra_domini.middleware')


# ─── JWT Auth Middleware (Channels / WebSocket) ───────────────────────────────

class JWTAuthMiddleware(BaseMiddleware):
    """
    Attach authenticated user to WebSocket scope from JWT token.
    Token passed as query param: ws://host/ws/map/?token=<jwt>
    """

    async def __call__(self, scope, receive, send):
        scope['user'] = await self._get_user(scope)
        return await super().__call__(scope, receive, send)

    @database_sync_to_async
    def _get_user(self, scope):
        from rest_framework_simplejwt.tokens import AccessToken
        from rest_framework_simplejwt.exceptions import TokenError
        from terra_domini.apps.accounts.models import Player

        query_string = scope.get('query_string', b'').decode()
        params = parse_qs(query_string)
        token_list = params.get('token', [])

        if not token_list:
            return AnonymousUser()

        try:
            token = AccessToken(token_list[0])
            player_id = token['user_id']
            return Player.objects.get(id=player_id, is_active=True)
        except (TokenError, Player.DoesNotExist, KeyError):
            return AnonymousUser()


# ─── Request Timing Middleware (HTTP) ────────────────────────────────────────

class RequestTimingMiddleware:
    """Log slow requests and add X-Response-Time header."""

    SLOW_THRESHOLD_MS = 500

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        start = time.monotonic()
        response = self.get_response(request)
        elapsed_ms = int((time.monotonic() - start) * 1000)

        response['X-Response-Time'] = f'{elapsed_ms}ms'

        if elapsed_ms > self.SLOW_THRESHOLD_MS:
            logger.warning(
                f"SLOW REQUEST {elapsed_ms}ms | {request.method} {request.path}"
            )

        return response


# ─── Game Session Middleware ──────────────────────────────────────────────────

class GameSessionMiddleware:
    """
    Track player session activity for:
    - Online status in Redis
    - Action rate counting (anti-cheat)
    - Last-active timestamp
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)

        # Only track authenticated game API calls
        if (request.user.is_authenticated
                and request.path.startswith('/api/')
                and not request.path.startswith('/api/auth/')
                and not request.path.startswith('/api/docs/')):
            self._update_session(request)

        return response

    def _update_session(self, request):
        try:
            from django.core.cache import caches
            game_cache = caches['game_state']
            player_id = str(request.user.id)

            # Mark online (expires in 2 min — refreshed each request)
            game_cache.set(f'online:{player_id}', True, timeout=120)

            # Increment action counter for anti-cheat (per minute window)
            action_key = f'actions:{player_id}:minute'
            try:
                game_cache.incr(action_key)
            except Exception:
                game_cache.set(action_key, 1, timeout=60)

            # Update last_active (batched — avoid DB write on every request)
            last_update_key = f'last_active_update:{player_id}'
            if not game_cache.get(last_update_key):
                request.user.__class__.objects.filter(id=player_id).update(
                    last_active=timezone.now()
                )
                game_cache.set(last_update_key, True, timeout=60)

        except Exception as e:
            logger.debug(f"Session middleware error: {e}")
