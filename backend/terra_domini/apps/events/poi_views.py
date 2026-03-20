"""
/api/pois/ — Unified POI endpoint with viewport + category filtering.
"""
import math, logging
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from terra_domini.apps.events.unified_poi import UnifiedPOI, POI_VISUAL, RARITY_TDC

logger = logging.getLogger('terra_domini.pois')

RARITY_COLOR = {'common':'#9CA3AF','uncommon':'#10B981','rare':'#3B82F6','legendary':'#FFB800'}

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
        'distance_km':    round(dist, 1) if dist is not None else None,
    }


class UnifiedPOIViewSet(viewsets.GenericViewSet):
    permission_classes = [IsAuthenticated]

    def list(self, request):
        """GET /api/pois/?lat=&lon=&radius_km=&categories=&limit="""
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

    @action(detail=False, methods=['GET'], url_path='categories')
    def categories(self, request):
        from django.db.models import Count
        counts = {r['category']: r['count'] for r in UnifiedPOI.objects.values('category').annotate(count=Count('id'))}
        return Response([{
            'id':    cat,
            'label': label,
            'count': counts.get(cat, 0),
            **{k: POI_VISUAL.get(cat, {}).get(k) for k in ('emoji','color','rarity','game_resource','bonus')},
        } for cat, label in UnifiedPOI._meta.get_field('category').choices])

    @action(detail=False, methods=['GET'], url_path='featured')
    def featured(self, request):
        pois = UnifiedPOI.objects.filter(is_active=True, is_featured=True).order_by('-bonus_pct')[:50]
        return Response({'pois': [serialize_poi(p) for p in pois]})


    @action(detail=False, methods=['GET'], url_path='agent/status',
            permission_classes=[__import__('rest_framework.permissions', fromlist=['IsAdminUser']).IsAdminUser])
    def agent_status(self, request):
        from terra_domini.agents.poi_agent import POIOrchestrator
        try:
            return Response(POIOrchestrator().get_status())
        except Exception as e:
            return Response({'error': str(e)}, status=500)

    @action(detail=False, methods=['POST'], url_path='agent/run',
            permission_classes=[__import__('rest_framework.permissions', fromlist=['IsAdminUser']).IsAdminUser])
    def agent_run(self, request):
        import threading
        from terra_domini.agents.poi_agent import POIOrchestrator
        phase = request.data.get('phase', '1')
        cats  = request.data.get('categories', None)
        def run():
            agent = POIOrchestrator()
            if phase == '1': agent.run_phase1(cats)
            elif phase == '2': agent.run_phase2(cats)
            elif phase == '3': agent.run_phase3_news()
            else:
                agent.run_phase1(cats)
                agent.run_phase2(cats)
        threading.Thread(target=run, daemon=True).start()
        return Response({'status': 'started', 'phase': phase})

    @action(detail=False, methods=['GET'], url_path='news')
    def news_events(self, request):
        """GET /api/pois/news/ — live geopolitical/earthquake events near viewport"""
        from terra_domini.agents.poi_agent import GeoNewsAgent
        try:
            agent = GeoNewsAgent()
            quakes = agent.fetch_earthquakes()[:10]
            conflicts = agent.fetch_gdelt_events()[:10]
            return Response({'earthquakes': quakes, 'conflicts': conflicts, 'fetched_at': __import__('django.utils.timezone', fromlist=['now']).now().isoformat()})
        except Exception as e:
            return Response({'earthquakes': [], 'conflicts': [], 'error': str(e)})
