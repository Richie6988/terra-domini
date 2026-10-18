"""
Resource icons on the map (owner 2026-10-18: "satellite view with our resource icons on top, where they belong").

GET /api/map/resources/?south=&west=&north=&east=&zoom=   (zoom ≥ 9)
- Exact spots: POIs that produce a resource (oil field → oil, gold mine → gold, dam → energy…).
- The land itself: one sample per H3 cell (res 6 / 7 / 8 by zoom). Its terrain (land/sea mask + region rules)
  picks the resource that terrain yields, among the resources of its DB region — sea → aquaculture, forest →
  biomass, farmland → cereals, mountain → the region's ore, city → human capital… The same rules the economy uses.
"""
import h3
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from terra_domini.apps.economy import resources as R

ORES = ['gold', 'silver', 'copper', 'iron', 'platinum', 'diamonds', 'lithium', 'nickel', 'cobalt', 'uranium', 'tin',
        'zinc', 'titanium', 'tungsten', 'chromium', 'manganese', 'aluminium', 'rareearthelements', 'marble']
TERRAIN_PREF = {   # terrain → resources it yields, best first (the region decides which are really there)
    'ocean': ['aquaculture', 'oil', 'gas'], 'coastal': ['aquaculture', 'strategicposition', 'salt'], 'lake': ['freshwater', 'aquaculture'],
    'ice': ['freshwater'], 'forest': ['biomass', 'biodiversity'], 'farmland': ['cereals', 'phosphates'], 'grassland': ['cereals', 'biomass'],
    'rural': ['cereals', 'biomass'], 'wetland': ['biodiversity', 'freshwater'], 'desert': ['energy', 'oil', 'gas', 'sand', 'salt'],
    'tundra': ['gas', 'oil', 'biodiversity'], 'mountain': ORES, 'urban': ['humancapital', 'culturalheritage'],
    'industrial': ['oil', 'gas', 'coal', 'iron', 'copper'],
}
FALLBACK = {'ocean': 'aquaculture', 'coastal': 'aquaculture', 'lake': 'freshwater', 'ice': 'freshwater', 'forest': 'biomass',
            'farmland': 'cereals', 'grassland': 'cereals', 'rural': 'cereals', 'urban': 'humancapital', 'desert': 'sand',
            'mountain': 'marble', 'wetland': 'biodiversity', 'tundra': 'biodiversity'}
RES_FOR_ZOOM = [(13, 8), (11, 7), (9, 6)]


def resource_of(lat, lon, cell=''):
    from terra_domini.apps.territories.terrain_rules import terrain
    t = terrain(round(lat, 4), round(lon, 4), '', False)[0]
    region = R.biome_for(round(lat, 3), round(lon, 3))
    have = set(region['resource_ids']) if region else set()
    options = [r for r in TERRAIN_PREF.get(t, []) if r in have][:3]   # the region's own mix (e.g. several ores in the Alps)
    pick = options[int(cell[-6:], 16) % len(options)] if options and cell else (options[0] if options else FALLBACK.get(t))
    return pick, t


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
    res = next(r for z, r in RES_FOR_ZOOM if zoom >= z)
    cells = h3.polygon_to_cells(h3.LatLngPoly([(s, w), (s, e), (n, e), (n, w)]), res)
    while len(cells) > 60 and res > 5:   # keep the map readable
        res -= 1
        cells = h3.polygon_to_cells(h3.LatLngPoly([(s, w), (s, e), (n, e), (n, w)]), res)
    meta = R.resources()
    icons = []
    from terra_domini.apps.events.unified_poi import UnifiedPOI
    for name, cat, lat, lon in UnifiedPOI.objects.filter(is_active=True, latitude__gte=s, latitude__lte=n, longitude__gte=w,
                                                          longitude__lte=e, category__in=list(R.POI_RESOURCE)) \
            .values_list('name', 'category', 'latitude', 'longitude')[:150]:
        rid = R.POI_RESOURCE[cat]
        if rid in meta:
            icons.append({'lat': lat, 'lon': lon, 'resource': rid, 'name': meta[rid]['name'], 'where': name, 'poi': True})
    for c in list(cells)[:60]:
        lat, lon = h3.cell_to_latlng(c)
        rid, terr = resource_of(lat, lon, c)
        if rid and rid in meta:
            icons.append({'lat': round(lat, 5), 'lon': round(lon, 5), 'resource': rid, 'name': meta[rid]['name'], 'where': terr, 'poi': False})
    return Response({'icons': icons, 'res': res})
