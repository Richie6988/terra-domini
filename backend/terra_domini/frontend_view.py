"""
Serve the React SPA from Django.

Architecture:
  - All /api/* routes → Django REST API
  - All /ws/* routes  → Django Channels (WebSocket)
  - Everything else   → index.html (React Router takes over client-side)

In development:  collectstatic is not needed, Django finds files via
                 STATICFILES_DIRS pointing to staticfiles/frontend/

In production:   whitenoise serves the hashed asset files from STATIC_ROOT
                 with proper cache headers (1 year for hashed files)
"""
import os
from pathlib import Path
from django.http import HttpResponse, Http404
from django.conf import settings
from django.views import View


class FrontendAppView(View):
    """
    Serves the compiled React index.html for any non-API route.
    Django collectstatic must have been run first (or STATICFILES_DIRS configured).
    """

    def get(self, request, *args, **kwargs):
        index_path = Path(settings.STATIC_ROOT) / 'frontend' / 'index.html'

        # Fallback: check STATICFILES_DIRS during dev (before collectstatic)
        if not index_path.exists():
            for static_dir in getattr(settings, 'STATICFILES_DIRS', []):
                candidate = Path(static_dir) / 'index.html'
                if candidate.exists():
                    index_path = candidate
                    break

        if not index_path.exists():
            return HttpResponse(
                """
                <html><body style="font-family:monospace;padding:40px;background:#050508;color:#fff">
                <h2 style="color:#00FF87">Frontend not built yet</h2>
                <p>Run this to build the React app:</p>
                <pre style="background:#0A0A12;padding:16px;border-radius:8px;color:#00FF87">
cd frontend
npm install
npm run build
                </pre>
                <p>Then restart Django. The game will appear at this URL.</p>
                <p style="margin-top:24px">Meanwhile, you can use the API directly:</p>
                <ul>
                  <li><a href="/api/docs/" style="color:#60A5FA">/api/docs/</a> — Swagger UI</li>
                  <li><a href="/admin/" style="color:#60A5FA">/admin/</a> — Django Admin</li>
                  <li><a href="/health/" style="color:#60A5FA">/health/</a> — Health Check</li>
                </ul>
                </body></html>
                """,
                status=200,
                content_type='text/html',
            )

        try:
            content = index_path.read_bytes()
            return HttpResponse(content, content_type='text/html; charset=utf-8')
        except OSError:
            raise Http404("Frontend index.html not found")
