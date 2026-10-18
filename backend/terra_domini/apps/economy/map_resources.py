"""
Resource icons on the map (owner 2026-10-18: "satellite view with our resource icons on top, where they belong").

GET /api/map/resources/?south=&west=&north=&east=&zoom=   (zoom ≥ 9)
- Only the exact spots: POIs that produce a resource (oil field → oil, gold mine → gold, dam → energy…).
  (An icon per area was tried and saturated the map.)
"""
import h3
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from terra_domini.apps.economy import resources as R

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def map_resources(request):
    try:
        s, w = float(request.query_params['south']), float(request.query_params['west'])
        n, e = float(request.query_params['north']), float(request.query_params['east'])
        zoom = float(request.query_params.get('zoom', 12))
    except (KeyError, ValueError):
        return Response({'error': 'south, west, north, east required'}, status=400)
    if zoom < 9:
        return Response({'icons': []})
    meta = R.resources()
    icons = []
    from terra_domini.apps.events.unified_poi import UnifiedPOI
    for name, cat, lat, lon in UnifiedPOI.objects.filter(is_active=True, latitude__gte=s, latitude__lte=n, longitude__gte=w,
                                                          longitude__lte=e, category__in=list(R.POI_RESOURCE)) \
            .values_list('name', 'category', 'latitude', 'longitude')[:150]:
        rid = R.POI_RESOURCE[cat]
        if rid in meta:
            icons.append({'lat': lat, 'lon': lon, 'resource': rid, 'name': meta[rid]['name'], 'where': name, 'poi': True})
    # Only the exact spots (POIs) are drawn: an icon on every area saturated the map (owner 2026-10-18)
    return Response({'icons': icons})


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def map_states(request):
    """GET /api/map/states/?south=&west=&north=&east= — hexes with a live state to show on the map (Clash style):
    attack (battle running), shield (protected), event (live world event: production x3 and a bounty)."""
    from django.db.models import Q
    from django.utils import timezone
    from terra_domini.apps.events.world_events import live_event_hexes
    from terra_domini.apps.territories.models import Territory
    try:
        s, w = float(request.query_params['south']), float(request.query_params['west'])
        n, e = float(request.query_params['north']), float(request.query_params['east'])
    except (KeyError, ValueError):
        return Response({'error': 'south, west, north, east required'}, status=400)
    now = timezone.now()
    box = Territory.objects.filter(center_lat__gte=s, center_lat__lte=n, center_lon__gte=w, center_lon__lte=e)
    out = {}
    for h in box.filter(Q(shield_until__gt=now) | Q(owner__shield_until__gt=now)).values_list('h3_index', flat=True)[:300]:
        out[h] = 'shield'
    for h in live_event_hexes():
        try:
            lat, lon = h3.cell_to_latlng(h)
        except Exception:
            continue
        if s <= lat <= n and w <= lon <= e:
            out[h] = 'event'
    for h in box.filter(is_under_attack=True).values_list('h3_index', flat=True)[:300]:
        out[h] = 'attack'          # strongest signal wins
    return Response({'states': [{'h3': h, 'state': st} for h, st in out.items()]})
