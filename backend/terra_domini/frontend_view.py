"""
Serve the React SPA from Django.

Lookup order for index.html:
  1. STATIC_ROOT/frontend/index.html  (after collectstatic — production)
  2. STATICFILES_DIRS[0]/index.html   (direct vite dist — dev without collectstatic)

This means the app works:
  - In dev: just run 'npm run build', no collectstatic needed
  - In prod: run collectstatic, whitenoise serves assets with cache headers
"""
from pathlib import Path
from django.http import HttpResponse, Http404
from django.conf import settings
from django.views import View


class FrontendAppView(View):

    def get(self, request, *args, **kwargs):
        # 1. After collectstatic (prod)
        candidates = [
            Path(settings.STATIC_ROOT) / 'frontend' / 'index.html',
        ]
        # 2. Direct from vite dist (dev — no collectstatic needed)
        for static_dir in getattr(settings, 'STATICFILES_DIRS', []):
            candidates.append(Path(static_dir) / 'index.html')

        index_path = next((p for p in candidates if p.exists()), None)

        if not index_path:
            return HttpResponse(
                """<!DOCTYPE html><html><body style="font-family:monospace;padding:40px;background:#050508;color:#fff">
                <h2 style="color:#00FF87">Frontend not built yet</h2>
                <pre style="background:#0A0A12;padding:16px;border-radius:8px;color:#00FF87">cd frontend && npm install && npm run build</pre>
                <p>Then restart Django.</p>
                <p style="margin-top:24px">API available now:</p>
                <ul>
                  <li><a href="/api/docs/" style="color:#60A5FA">/api/docs/</a></li>
                  <li><a href="/admin/" style="color:#60A5FA">/admin/</a></li>
                  <li><a href="/health/" style="color:#60A5FA">/health/</a></li>
                </ul></body></html>""",
                content_type='text/html',
            )

        return HttpResponse(
            index_path.read_bytes(),
            content_type='text/html; charset=utf-8',
        )
