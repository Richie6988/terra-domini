"""
GET /api/geoip/ — server-side IP geolocation proxy.
Returns {lat, lon, city, country} based on the request IP.
No external API key needed — uses ip-api.com (free, 45 req/min).
"""
import requests
import logging
from django.http import JsonResponse
from django.views import View
from django.core.cache import cache

logger = logging.getLogger('terra_domini')


def get_geoip_data(request):
    """Extract geolocation from request IP. Returns dict with lat, lon, city, country."""
    ip = (
        request.META.get('HTTP_X_FORWARDED_FOR', '').split(',')[0].strip()
        or request.META.get('HTTP_X_REAL_IP', '')
        or request.META.get('REMOTE_ADDR', '')
    )
    default = {'lat': 48.8566, 'lon': 2.3522, 'city': 'Paris', 'country': 'FR', 'source': 'default'}

    if not ip or ip.startswith(('127.', '10.', '192.168.', '::1', '172.')):
        return default

    cache_key = f'geoip:{ip}'
    cached = cache.get(cache_key)
    if cached:
        return cached

    try:
        r = requests.get(f'http://ip-api.com/json/{ip}?fields=status,lat,lon,city,country,countryCode', timeout=3)
        data = r.json()
        if data.get('status') == 'success':
            result = {'lat': data['lat'], 'lon': data['lon'], 'city': data.get('city', ''), 'country': data.get('countryCode', ''), 'source': 'ip-api'}
            cache.set(cache_key, result, 3600)
            return result
    except Exception as e:
        logger.warning(f'GeoIP failed for {ip}: {e}')

    return default


class GeoIPView(View):
    def get(self, request):
        return JsonResponse(get_geoip_data(request))
