"""
ASGI config — Django Channels (HTTP + WebSocket).

WebSocket endpoint: /ws/map/?token=<jwt>
"""
import os
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'terra_domini.settings.dev')

import django
django.setup()


# ── Auto-ensure unified_poi table exists (runs once at startup) ──────────────
def _ensure_unified_poi():
    try:
        from django.db import connection
        with connection.cursor() as cur:
            cur.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='unified_poi'")
            if not cur.fetchone():
                import subprocess, sys, os
                base = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
                subprocess.run([sys.executable, 'scripts/ensure_db.py'], cwd=base, check=False)
    except Exception:
        pass

_ensure_unified_poi()
# ─────────────────────────────────────────────────────────────────────────────
from django.conf import settings
from django.core.asgi import get_asgi_application
from channels.routing import ProtocolTypeRouter, URLRouter
from terra_domini.middleware import JWTAuthMiddleware
from terra_domini.apps.websocket.routing import websocket_urlpatterns

django_asgi_app = get_asgi_application()

# In dev/Codespace: skip AllowedHostsOriginValidator (it rejects github.dev)
# In production: add it back or configure ALLOWED_HOSTS properly
DEBUG = getattr(settings, 'DEBUG', False)

if DEBUG:
    # No origin check — JWT token provides authentication
    ws_application = JWTAuthMiddleware(URLRouter(websocket_urlpatterns))
else:
    from channels.security.websocket import AllowedHostsOriginValidator
    ws_application = AllowedHostsOriginValidator(
        JWTAuthMiddleware(URLRouter(websocket_urlpatterns))
    )

application = ProtocolTypeRouter({
    "http": django_asgi_app,
    "websocket": ws_application,
})
