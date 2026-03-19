"""
Resource POI API — viewport-based visibility (fog of war).
GET /api/resources/?lat=&lon=&radius_km= — resources near viewport
GET /api/resources/categories/           — category metadata
GET /api/resources/<id>/                 — single resource detail
"""
import logging, math
from django.utils import timezone
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response

from terra_domini.apps.events.poi_models_resources import ResourcePOI, RESOURCE_CONFIG

logger = logging.getLogger('terra_domini.resources')


def haversine(lat1, lon1, lat2, lon2) -> float:
    """Distance in km between two points."""
    R = 6371
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (math.sin(dlat/2)**2 +
         math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon/2)**2)
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))


def serialize_resource(r: ResourcePOI, distance_km: float = None) -> dict:
    rarity_colors = {
        'common':    '#9CA3AF',
        'uncommon':  '#10B981',
        'rare':      '#3B82F6',
        'legendary': '#FFB800',
    }
    return {
        'id':           str(r.id),
        'name':         r.name,
        'category':     r.category,
        'category_label': r.get_category_display(),
        'country_code': r.country_code,
        'lat':          r.latitude,
        'lon':          r.longitude,
        'h3_index':     r.h3_index,
        'emoji':        r.emoji,
        'color':        r.color,
        'rarity':       r.rarity,
        'rarity_color': rarity_colors.get(r.rarity, '#fff'),
        'game_resource':r.game_resource,
        'bonus_pct':    r.bonus_pct,
        'tdc_per_24h':  float(r.tdc_per_24h),
        'description':  r.description,
        'real_output':  r.real_output,
        'distance_km':  round(distance_km, 1) if distance_km is not None else None,
    }


class ResourcePOIViewSet(viewsets.GenericViewSet):
    permission_classes = [IsAuthenticated]

    def list(self, request):
        """
        GET /api/resources/?lat=&lon=&radius_km=&category=
        Returns resources visible from the given viewport.
        FOG OF WAR: only within 100km of player's owned territories (or viewport radius).
        """
        try:
            lat       = float(request.query_params.get('lat', 0))
            lon       = float(request.query_params.get('lon', 0))
            radius_km = min(float(request.query_params.get('radius_km', 50)), 200)
            category  = request.query_params.get('category', '')
        except (TypeError, ValueError):
            return Response({'error': 'Invalid params'}, status=400)

        # Bounding box pre-filter (fast DB query)
        deg_lat = radius_km / 111.0
        deg_lon = radius_km / (111.0 * max(abs(math.cos(math.radians(lat))), 0.01))

        qs = ResourcePOI.objects.filter(
            is_active=True,
            latitude__range=(lat - deg_lat, lat + deg_lat),
            longitude__range=(lon - deg_lon, lon + deg_lon),
        )
        if category:
            qs = qs.filter(category=category)

        # Precise haversine filter + sort by distance
        results = []
        for r in qs:
            dist = haversine(lat, lon, r.latitude, r.longitude)
            if dist <= radius_km:
                results.append((dist, r))

        results.sort(key=lambda x: x[0])

        return Response({
            'resources': [serialize_resource(r, dist) for dist, r in results[:100]],
            'count':     len(results),
            'viewport':  {'lat': lat, 'lon': lon, 'radius_km': radius_km},
        })

    @action(detail=False, methods=['GET'], url_path='categories')
    def categories(self, request):
        """GET /api/resources/categories/ — category metadata + counts."""
        from django.db.models import Count
        counts = {
            item['category']: item['count']
            for item in ResourcePOI.objects.values('category').annotate(count=Count('id'))
        }
        return Response([{
            'id':           cat,
            'label':        label,
            'emoji':        RESOURCE_CONFIG.get(cat, {}).get('emoji', '📍'),
            'color':        RESOURCE_CONFIG.get(cat, {}).get('color', '#6B7280'),
            'game_resource':RESOURCE_CONFIG.get(cat, {}).get('game_resource', 'credits'),
            'bonus_pct':    RESOURCE_CONFIG.get(cat, {}).get('bonus_pct', 25),
            'rarity':       RESOURCE_CONFIG.get(cat, {}).get('rarity', 'common'),
            'count':        counts.get(cat, 0),
        } for cat, label in ResourcePOI._meta.get_field('category').choices])

    @action(detail=False, methods=['GET'], url_path='nearby-bonus')
    def nearby_bonus(self, request):
        """
        GET /api/resources/nearby-bonus/
        Resources on territories the player owns — active production bonuses.
        """
        from terra_domini.apps.territories.models import Territory
        player_territories = Territory.objects.filter(
            owner=request.user
        ).values_list('center_lat', 'center_lon', 'h3_index')

        bonuses = []
        for t_lat, t_lon, h3_idx in player_territories:
            if not t_lat: continue
            # Check resources within 5km of territory center
            nearby = ResourcePOI.objects.filter(is_active=True)
            for r in nearby:
                dist = haversine(t_lat, t_lon, r.latitude, r.longitude)
                if dist <= 5.0:
                    bonuses.append({
                        **serialize_resource(r, dist),
                        'territory_h3': h3_idx,
                        'active': True,
                    })

        return Response({'bonuses': bonuses, 'total_bonus_pct': sum(b['bonus_pct'] for b in bonuses)})
