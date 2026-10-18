"""
HEX coins scattered on the map (owner 2026-10-18: "random HEX coins everywhere; click one and it goes into your
pot — a mechanic that forces exploration").

- Where: about 1 hex in 20 holds a coin today, chosen by a hash of (day, hex) — the same for every player, new every
  day (UTC), on land and at sea. 1 coin in 40 is golden.
- Worth: 10-40 HEX, ×2 more than 5 km from your land, ×3 beyond 50 km (exploring pays); golden = 250.
- Each player can pick a given coin once, up to 40 coins a day. Paid as earned HEX.
GET  /api/pickups/?lat_min=&lat_max=&lon_min=&lon_max=   coins in the view (zoom in when the view is too large)
POST /api/pickups/collect/ {h3}
"""
import hashlib
import math

import h3
from django.db import IntegrityError, transaction
from django.db.models import F
from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from terra_domini.apps.economy.models import PickupClaim

DENSITY = 20
GOLDEN = 40
DAILY_CAP = 40
MAX_CELLS = 8000


def _h(day, cell, salt=''):
    return int(hashlib.sha1(f'{day}:{cell}:{salt}'.encode()).hexdigest()[:12], 16)


def coin_at(day, cell):
    """(base value, golden) if a coin lies on this hex today, else None."""
    if _h(day, cell) % DENSITY:
        return None
    golden = _h(day, cell, 'g') % GOLDEN == 0
    return (250 if golden else 10 + _h(day, cell, 'v') % 31), golden


def _home_points(player):
    from terra_domini.apps.territories.models import Territory
    return list(Territory.objects.filter(owner=player).exclude(center_lat__isnull=True).values_list('center_lat', 'center_lon')[:500])


def _distance_mult(lat, lon, home):
    if not home:
        return 1
    d = min(6371 * 2 * math.asin(math.sqrt(math.sin(math.radians(a - lat) / 2) ** 2 + math.cos(math.radians(lat)) *
            math.cos(math.radians(a)) * math.sin(math.radians(b - lon) / 2) ** 2)) for a, b in home)
    return 3 if d > 50 else 2 if d > 5 else 1


def _value(day, cell, home):
    c = coin_at(day, cell)
    if not c:
        return None
    base, golden = c
    lat, lon = h3.cell_to_latlng(cell)
    return (base if golden else base * _distance_mult(lat, lon, home)), golden


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def pickups_in_view(request):
    try:
        a, b = float(request.query_params['lat_min']), float(request.query_params['lat_max'])
        c, d = float(request.query_params['lon_min']), float(request.query_params['lon_max'])
    except (KeyError, ValueError):
        return Response({'error': 'lat_min, lat_max, lon_min, lon_max required'}, status=400)
    day = timezone.now().date()
    taken_today = PickupClaim.objects.filter(player=request.user, day=day)
    left = max(0, DAILY_CAP - taken_today.count())
    # rough size check before asking h3 for the cells (a res-8 hex is ~0.74 km²)
    km2 = abs(b - a) * 111 * abs(d - c) * 111 * max(0.1, math.cos(math.radians((a + b) / 2)))
    if km2 / 0.74 > MAX_CELLS:
        return Response({'coins': [], 'zoom_in': True, 'left_today': left})
    cells = h3.polygon_to_cells(h3.LatLngPoly([(a, c), (a, d), (b, d), (b, c)]), 8)
    taken = set(taken_today.values_list('h3_index', flat=True))
    home = _home_points(request.user)
    coins = []
    for cell in cells:
        if cell in taken:
            continue
        v = _value(day, cell, home)
        if v:
            lat, lon = h3.cell_to_latlng(cell)
            coins.append({'h3': cell, 'lat': round(lat, 5), 'lon': round(lon, 5), 'value': v[0], 'golden': v[1]})
    return Response({'coins': coins, 'left_today': left, 'daily_cap': DAILY_CAP})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def pickup_collect(request):
    from terra_domini.apps.accounts.models import Player
    cell = (request.data.get('h3') or '').strip()
    day = timezone.now().date()
    try:
        ok = h3.is_valid_cell(cell) and h3.get_resolution(cell) == 8
    except Exception:
        ok = False
    v = _value(day, cell, _home_points(request.user)) if ok else None
    if not v:
        return Response({'error': 'No coin here today'}, status=404)
    if PickupClaim.objects.filter(player=request.user, day=day).count() >= DAILY_CAP:
        return Response({'error': f'{DAILY_CAP} coins a day — new coins tomorrow'}, status=429)
    try:
        with transaction.atomic():
            PickupClaim.objects.create(player=request.user, h3_index=cell, day=day, amount=v[0])
            Player.objects.filter(id=request.user.id).update(tdc_in_game=F('tdc_in_game') + v[0])
    except IntegrityError:
        return Response({'error': 'Already picked up'}, status=409)
    bal = Player.objects.filter(id=request.user.id).values_list('tdc_in_game', flat=True).first()
    left = max(0, DAILY_CAP - PickupClaim.objects.filter(player=request.user, day=day).count())
    return Response({'h3': cell, 'amount': v[0], 'golden': v[1], 'balance': float(bal), 'left_today': left})
