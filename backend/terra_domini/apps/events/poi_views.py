"""
/api/pois/ — Unified POI endpoint with viewport + category filtering.
"""
import math, logging
from rest_framework import viewsets
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
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

    @action(detail=False, methods=['GET'], url_path='hex-map')
    def hex_map(self, request):
        """GET /api/pois/hex-map/?lat=&lon=&radius_km= — POI hexes for map display."""
        try:
            lat       = float(request.query_params.get('lat', 48.8566))
            lon       = float(request.query_params.get('lon', 2.3522))
            radius_km = min(float(request.query_params.get('radius_km', 50)), 600)
        except (TypeError, ValueError):
            return Response({'error': 'Invalid params'}, status=400)

        deg_lat = radius_km / 111.0
        deg_lon = radius_km / (111.0 * max(abs(math.cos(math.radians(lat))), 0.01))

        pois = UnifiedPOI.objects.filter(
            is_active=True,
            latitude__range=(lat - deg_lat, lat + deg_lat),
            longitude__range=(lon - deg_lon, lon + deg_lon),
        ).values('name','emoji','rarity','latitude','longitude','is_shiny','category','h3_index')[:500]

        result = []
        # Deduplicate by h3_index — highest rarity wins per hex
        RARITY_RANK = {'common':0,'uncommon':1,'rare':2,'epic':3,'legendary':4,'mythic':5}
        hex_map_dict = {}
        for p in pois:
            hx = p['h3_index']
            if not hx: continue
            cur_r = RARITY_RANK.get(hex_map_dict.get(hx, {}).get('rarity','common'), 0)
            if hx not in hex_map_dict or RARITY_RANK.get(p.get('rarity','common'),0) > cur_r:
                hex_map_dict[hx] = p

        import h3 as h3lib
        for hx, p in hex_map_dict.items():
            try:
                # Use hex CENTROID — not raw POI lat/lon
                # This ensures the pin sits on the hex territory, not beside it
                geo = h3lib.cell_to_latlng(hx)
                result.append({
                    'h3_index': hx,
                    'name': p['name'],
                    'rarity': p['rarity'],
                    'emoji': p['emoji'] or '📍',
                    'lat': geo[0],          # hex centroid lat
                    'lon': geo[1],          # hex centroid lon
                    'category': p['category'],
                    'is_shiny': bool(p['is_shiny']),
                })
            except Exception:
                pass

        return Response({'pois': result, 'count': len(result)})


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


# ── Map overview: points of interest readable from far away (owner 2026-10-18) ──
MAP_ZOOM_RARITIES = [   # (min zoom, rarities shown) — the further out, the rarer
    (3, ('mythic', 'legendary')),
    (5, ('mythic', 'legendary', 'epic')),
    (7, ('mythic', 'legendary', 'epic', 'rare')),
    (9, ('mythic', 'legendary', 'epic', 'rare', 'uncommon', 'common')),
]


@api_view(['GET'])
@permission_classes([AllowAny])
def map_pois(request):
    """GET /api/map/pois/?south=&west=&north=&east=&zoom= — POI markers for the zoomed-out map, rarest first."""
    try:
        s, w, n, e = (float(request.query_params[k]) for k in ('south', 'west', 'north', 'east'))
        z = int(float(request.query_params.get('zoom', 5)))
    except (KeyError, ValueError):
        return Response({'error': 'south, west, north, east required'}, status=400)
    rarities = MAP_ZOOM_RARITIES[0][1]
    for mz, r in MAP_ZOOM_RARITIES:
        if z >= mz:
            rarities = r
    qs = UnifiedPOI.objects.filter(is_active=True, rarity__in=rarities, latitude__range=(s, n))
    # Token categories the player shows on the map (?kinds=places,resources,species — all when absent)
    from django.db.models import Q
    from terra_domini.apps.economy.resources import RESOURCE_SITES
    kinds = {k for k in (request.query_params.get('kinds') or 'places,resources,species').split(',') if k}
    kq = Q(pk__in=[])
    if 'species' in kinds:
        kq |= Q(category__startswith='species_')
    if 'resources' in kinds:
        kq |= Q(category__in=RESOURCE_SITES)
    if 'places' in kinds:
        kq |= ~Q(category__startswith='species_') & ~Q(category__in=RESOURCE_SITES)
    qs = qs.filter(kq)
    qs = qs.filter(longitude__range=(w, e)) if w <= e else qs  # antimeridian: skip the lon filter
    order = {'mythic': 0, 'legendary': 1, 'epic': 2, 'rare': 3, 'uncommon': 4, 'common': 5}
    rows = sorted(qs.values('name', 'category', 'rarity', 'latitude', 'longitude', 'h3_index', 'is_featured')[:1500],
                  key=lambda p: (order.get(p['rarity'], 9), not p['is_featured']))[:250]
    from terra_domini.apps.territories.models import Territory
    owners = dict(Territory.objects.filter(h3_index__in=[p['h3_index'] for p in rows], owner__isnull=False)
                  .values_list('h3_index', 'owner__username'))
    # Area counters: every active POI of the view grouped by an H3 cell sized for the zoom
    import h3 as _h3
    res = 1 if z <= 4 else 2 if z <= 6 else 3 if z <= 9 else 4
    allq = UnifiedPOI.objects.filter(is_active=True, latitude__range=(s, n)).filter(kq)
    allq = allq.filter(longitude__range=(w, e)) if w <= e else allq
    groups = {}
    for la, lo, rar in allq.values_list('latitude', 'longitude', 'rarity')[:20000]:
        cell = _h3.latlng_to_cell(la, lo, res)
        g = groups.setdefault(cell, [0, 0.0, 0.0, {}])
        g[0] += 1; g[1] += la; g[2] += lo; g[3][rar] = g[3].get(rar, 0) + 1
    clusters = [{'cell': c, 'count': g[0], 'lat': g[1] / g[0], 'lon': g[2] / g[0], 'by_rarity': g[3]} for c, g in groups.items()]
    return Response({'zoom': z, 'cluster_res': res, 'clusters': clusters, 'pois': [{
        'name': p['name'], 'category': p['category'], 'rarity': p['rarity'], 'lat': p['latitude'], 'lon': p['longitude'],
        'h3_index': p['h3_index'], 'owner': owners.get(p['h3_index']),
    } for p in rows]})


@api_view(['GET'])
@permission_classes([AllowAny])
def map_where(request):
    """GET /api/map/where/?lat=&lon= — the map centre's biome for the AR layer: DB region (name, continent), terrain
    (offline rules, no slow land-cover call) and what lives there (resources the region is known for)."""
    try:
        lat, lon = round(float(request.query_params['lat']), 2), round(float(request.query_params['lon']), 2)
    except (KeyError, ValueError):
        return Response({'error': 'lat, lon required'}, status=400)
    from terra_domini.apps.economy.resources import biome_for, resources
    from terra_domini.apps.territories.terrain_rules import terrain
    b = biome_for(lat, lon)
    try:
        terr, _why = terrain(lat, lon, precise=False)
    except Exception:
        terr = ''
    meta = resources()
    res = [meta[r]['name'] for r in (b or {}).get('resource_ids', [])[:4] if r in meta]
    region = b['name'] if b else None
    if not region:     # gaps between the DB regions: the nearest known city names the place
        try:
            from terra_domini.apps.territories.terrain_rules import nearest_city
            near = nearest_city(lat, lon)
            if near and near[0] and near[1] < 80:
                region = f"{near[0]['name']} area"
        except Exception:
            pass
    return Response({'region': region, 'continent': b['continent'] if b else None,
                     'type': b['type'] if b else None, 'terrain': terr, 'known_for': res})
