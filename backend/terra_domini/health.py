"""
Health check and simple utility views.
"""
from django.http import JsonResponse
from django.db import connection
from django.core.cache import cache
from django.utils import timezone
import os


def health_check(request):
    """GET /health/ — used by load balancers, Railway, smoke tests."""
    checks = {}

    # Database
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
        checks['database'] = 'ok'
    except Exception as e:
        checks['database'] = f'error: {str(e)[:50]}'

    # Cache
    try:
        cache.set('health_ping', 'pong', timeout=5)
        val = cache.get('health_ping')
        checks['cache'] = 'ok' if val == 'pong' else 'miss'
    except Exception as e:
        checks['cache'] = f'error: {str(e)[:50]}'

    all_ok = all(v == 'ok' for v in checks.values())
    status = 200 if all_ok else 503

    return JsonResponse({
        'status': 'ok' if all_ok else 'degraded',
        'checks': checks,
        'version': os.environ.get('APP_VERSION', '1.0.0'),
        'timestamp': timezone.now().isoformat(),
    }, status=status)


def robots_txt(request):
    """GET /robots.txt"""
    content = "User-agent: *\nDisallow: /api/\nDisallow: /admin/\nAllow: /\n"
    from django.http import HttpResponse
    return HttpResponse(content, content_type='text/plain')
