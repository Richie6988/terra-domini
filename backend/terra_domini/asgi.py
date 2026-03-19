"""
ASGI configuration — Django Channels with HTTP + WebSocket routing.
"""
import os
from django.core.asgi import get_asgi_application
from channels.routing import ProtocolTypeRouter, URLRouter
from channels.security.websocket import AllowedHostsOriginValidator
from terra_domini.middleware import JWTAuthMiddleware

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'terra_domini.settings.dev')

django_asgi_app = get_asgi_application()

from terra_domini.apps.websocket import routing as ws_routing

application = ProtocolTypeRouter({
    "http": django_asgi_app,
    "websocket": AllowedHostsOriginValidator(
        JWTAuthMiddleware(
            URLRouter(ws_routing.websocket_urlpatterns)
        )
    ),
})
