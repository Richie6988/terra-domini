"""
/api/pois/ — Unified POI endpoint with viewport + category filtering.
"""
import math, logging
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from terra_domini.apps.events.unified_poi import UnifiedPOI, POI_VISUAL, RARITY_TDC


import os, subprocess, sys

def _ensure_table():
    """Create unified_poi table and seed data if missing. Called on first request."""
    try:
        from django.db import connection
        with connection.cursor() as cur:
            cur.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='unified_poi'")
            if cur.fetchone():
                return  # Table exists, fast path
        # Table missing — create it now
        from django.core.management import call_command
        import io
        call_command('migrate', '--run-syncdb', stdout=io.StringIO(), verbosity=0)
        # Seed if empty
        from terra_domini.apps.events.unified_poi import UnifiedPOI
        if UnifiedPOI.objects.count() == 0:
            seed = os.path.join(os.path.dirname(__file__), '..', '..', '..', 
                               'scripts', 'seed_all_pois_master.py')
            seed = os.path.abspath(seed)
            if os.path.exists(seed):
                exec(open(seed).read(), {'__file__': seed})
    except Exception as e:
        logger.warning(f"ensure_table: {e}")

_TABLE_READY = False

logger = logging.getLogger('terra_domini.pois')

RARITY_COLOR = {'common':'#9CA3AF','uncommon':'#10B981','rare':'#3B82F6','epic':'#8B5CF6','legendary':'#FFB800','mythic':'#FF006E'}

def haversine(lat1, lon1, lat2, lon2):
    R = 6371
    dlat = math.radians(lat2-lat1); dlon = math.radians(lon2-lon1)
    a = math.sin(dlat/2)**2 + math.cos(math.radians(lat1))*math.cos(math.radians(lat2))*math.sin(dlon/2)**2
    return R*2*math.atan2(math.sqrt(a), math.sqrt(1-a))

def serialize_poi(p: UnifiedPOI, dist=None) -> dict:
    return {
        'id':             str(p.id),
        'name':           p.name,
        'category':       p.category,
        'category_label': p.get_category_display(),
        'lat':            p.latitude,
        'lon':            p.longitude,
        'country_code':   p.country_code,
        'emoji':          p.emoji,
        'color':          p.color,
        'size':           p.size,
        'rarity':         p.rarity,
        'rarity_color':   RARITY_COLOR.get(p.rarity, '#fff'),
        'game_resource':  p.game_resource,
        'bonus_pct':      p.bonus_pct,
        'tdc_per_24h':    float(p.tdc_per_24h),
        'description':    p.description,
        'fun_fact':       p.fun_fact,
        'is_featured':    p.is_featured,
        'threat_level':   p.threat_level,
        'wiki_url':         p.wiki_url,
        'distance_km':      round(dist, 1) if dist is not None else None,
        # NFT metadata
        'token_id':         p.token_id,
        'floor_price_tdi':  p.floor_price_tdi,
        'mint_difficulty':  p.mint_difficulty,
        'is_shiny':         p.is_shiny,
        'card_number':      p.card_number,
        'edition':          p.edition,
        'visitors_per_year':p.visitors_per_year,
        'geopolitical_score':p.geopolitical_score,
    }


class UnifiedPOIViewSet(viewsets.GenericViewSet):
    permission_classes = [IsAuthenticated]

    def list(self, request):
        """GET /api/pois/?lat=&lon=&radius_km=&categories=&limit="""
        global _TABLE_READY
        if not _TABLE_READY:
            _ensure_table()
            _TABLE_READY = True
        try:
            lat       = float(request.query_params.get('lat', 0))
            lon       = float(request.query_params.get('lon', 0))
            radius_km = min(float(request.query_params.get('radius_km', 100)), 3000)
            limit     = min(int(request.query_params.get('limit', 100)), 200)
            cats_str  = request.query_params.get('categories', '')
        except (TypeError, ValueError):
            return Response({'error': 'Invalid params'}, status=400)

        # Bounding box
        deg_lat = radius_km / 111.0
        deg_lon = radius_km / (111.0 * max(abs(math.cos(math.radians(lat))), 0.01))

        qs = UnifiedPOI.objects.filter(
            is_active=True,
            latitude__range=(lat-deg_lat, lat+deg_lat),
            longitude__range=(lon-deg_lon, lon+deg_lon),
        )
        if cats_str:
            qs = qs.filter(category__in=cats_str.split(','))

        # Sort: featured first, then by rarity, then by distance
        results = []
        for p in qs:
            dist = haversine(lat, lon, p.latitude, p.longitude)
            if dist <= radius_km:
                results.append((dist, p))

        # Featured first, then legendary, then by distance
        rarity_order = {'legendary': 0, 'rare': 1, 'uncommon': 2, 'common': 3}
        results.sort(key=lambda x: (not x[1].is_featured, rarity_order.get(x[1].rarity, 4), x[0]))
        results = results[:limit]

        return Response({
            'pois':  [serialize_poi(p, dist) for dist, p in results],
            'count': len(results),
        })

    @action(detail=False, methods=['GET'], url_path='news')
    def news_events(self, request):
        """GET /api/pois/news/ — live events (GDELT + USGS)"""
        import requests as req
        events = []
        try:
            # USGS earthquakes M4.5+
            r = req.get(
                'https://earthquake.usgs.gov/fdsnws/event/1/query'
                '?format=geojson&minmagnitude=4.5&limit=15&orderby=time',
                timeout=5)
            if r.status_code == 200:
                for f in r.json().get('features', []):
                    p = f['properties']
                    c = f['geometry']['coordinates']
                    events.append({
                        'type': 'earthquake', 'lat': c[1], 'lon': c[0],
                        'title': p.get('place', 'Earthquake'),
                        'magnitude': p.get('mag'), 'url': p.get('url', ''),
                        'time': p.get('time'),
                    })
        except Exception:
            pass
        return Response({'events': events, 'count': len(events)})
