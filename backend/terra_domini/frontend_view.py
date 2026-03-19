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

        html = index_path.read_bytes().decode('utf-8', errors='replace')
        # Inject safety patch before </head>
        patch = """\n<script>\n// Terra Domini safety patch — prevents slice/forEach on undefined\n(function(){\n  var _orig_forEach = Array.prototype.forEach;\n  // Patch Zustand store state access\n  var patchStore = function() {\n    try {\n      var store = window.__TERRA_STORE__;\n      if (store) {\n        var state = store.getState();\n        if (!Array.isArray(state.activeBattles)) store.setState({activeBattles: []});\n        if (!Array.isArray(state.notifications)) store.setState({notifications: []});\n        if (!Array.isArray(state.recentBattleResults)) store.setState({recentBattleResults: []});\n      }\n    } catch(e) {}\n  };\n  setTimeout(patchStore, 100);\n  setTimeout(patchStore, 500);\n  setTimeout(patchStore, 2000);\n})();\n</script>\n"""
        if '</head>' in html:
            html = html.replace('</head>', patch + '</head>', 1)
        resp = HttpResponse(
            html.encode('utf-8'),
            content_type='text/html; charset=utf-8',
        )
        # Never cache index.html — assets have hash-based names for cache busting
        resp['Cache-Control'] = 'no-cache, no-store, must-revalidate'
        resp['Pragma'] = 'no-cache'
        resp['Expires'] = '0'
        return resp
