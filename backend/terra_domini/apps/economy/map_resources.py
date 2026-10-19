"""
Live hex states on the map (Clash style). The resource-icon layer was removed (owner 2026-10-19: POIs were drawn
twice — the hexagon with its icon is enough).
"""
import h3
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response


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
