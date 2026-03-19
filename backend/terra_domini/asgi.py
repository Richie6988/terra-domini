"""
ASGI config — Django Channels (HTTP + WebSocket).
"""
import os
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'terra_domini.settings.dev')

# Setup Django FIRST before any app imports
import django
django.setup()

from django.core.asgi import get_asgi_application
from channels.routing import ProtocolTypeRouter, URLRouter
from channels.security.websocket import AllowedHostsOriginValidator
from terra_domini.middleware import JWTAuthMiddleware
from terra_domini.apps.websocket import routing as ws_routing

django_asgi_app = get_asgi_application()

application = ProtocolTypeRouter({
    "http": django_asgi_app,
    "websocket": AllowedHostsOriginValidator(
        JWTAuthMiddleware(
            URLRouter(ws_routing.websocket_urlpatterns)
        )
    ),
})
