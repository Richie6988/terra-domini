"""
Admin token editor (owner 2026-10-18): quality editing + generation of place tokens, straight on the DB.

  GET   /api/gm/tokens/?q=&category=&rarity=&validated=0|1&page=   list (50 per page)
  POST  /api/gm/tokens/                                            create a new token (+ its res-8 territory)
  GET   /api/gm/tokens/meta/                                       categories, rarities
  GET   /api/gm/tokens/<id>/                                       one token
  PATCH /api/gm/tokens/<id>/   {fields…, validate?: bool}          edit (+ validate)

Data governance: an edited token becomes source='admin' (import_hexod_db never overwrites it);
validated_by / validated_at record who validated the current content and when — any later content
change clears the validation until an admin validates again.
"""
import uuid

import h3
from django.db import transaction
from django.utils import timezone
from rest_framework.permissions import IsAdminUser
from rest_framework.response import Response
from rest_framework.views import APIView

from terra_domini.apps.economy.balance import HEX_PER_DAY
from terra_domini.apps.events.unified_poi import POICategory, UnifiedPOI

RARITIES = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic']
TEXT_FIELDS = {'name': 300, 'real_output': 200, 'description': 4000, 'fun_fact': 4000, 'country_code': 4}


def _categories() -> list:
    """Model choices + categories used by the master DB (sports_arena, mega_dam… are not in the choices)."""
    used = set(UnifiedPOI.objects.values_list('category', flat=True).distinct())
    known = dict(POICategory.choices)
    return sorted([(c, known.get(c, c.replace('_', ' ').title())) for c in set(known) | used if c], key=lambda x: x[1])


def _serialize(p: UnifiedPOI) -> dict:
    from terra_domini.apps.territories.models import Territory
    t = Territory.objects.filter(h3_index=p.h3_index).select_related('owner').first() if p.h3_index else None
    return {
        'id': str(p.id), 'db_uid': p.db_uid, 'name': p.name, 'title': p.real_output, 'description': p.description,
        'fun_fact': p.fun_fact, 'category': p.category, 'rarity': p.rarity, 'color': p.color,
        'lat': p.latitude, 'lon': p.longitude, 'h3_index': p.h3_index, 'country_code': p.country_code,
        'wiki_url': p.wiki_url, 'image_url': p.image_url, 'is_active': p.is_active, 'is_featured': p.is_featured,
        'source': p.source, 'token_id': p.token_id,
        'validated_by': p.validated_by.username if p.validated_by_id else None,
        'validated_at': p.validated_at.isoformat() if p.validated_at else None,
        'updated_at': p.updated_at.isoformat() if p.updated_at else None,
        'owner': t.owner.username if t and t.owner_id else None,
    }


def _sync_territory(p: UnifiedPOI, old_h3: str = '') -> None:
    """Keep the res-8 territory of the token in line with it (name, rarity, income); owners are never touched."""
    from terra_domini.apps.territories.models import Territory
    from terra_domini.apps.territories.terrain_rules import terrain, territory_type_for
    if old_h3 and old_h3 != p.h3_index:
        Territory.objects.filter(h3_index=old_h3, poi_name=p.name).update(poi_name='', poi_wiki_url='', is_landmark=False,
                                                                         landmark_name='', hex_type='standard')
    if not p.h3_index or not p.is_active:
        return
    t = Territory.objects.filter(h3_index=p.h3_index).first()
    if t is None:
        lat, lon = h3.cell_to_latlng(p.h3_index)
        t = Territory(h3_index=p.h3_index, h3_resolution=8, center_lat=lat, center_lon=lon)
    biome = terrain(round(t.center_lat, 4), round(t.center_lon, 4), p.category)[0]
    t.poi_name = t.landmark_name = t.place_name = p.name[:200]
    t.poi_wiki_url = (p.wiki_url or '')[:500]
    t.is_landmark, t.hex_type, t.rarity = True, 'poi', p.rarity
    t.biome, t.territory_type = biome, ('landmark' if biome == 'landmark' else territory_type_for(biome))
    t.tdc_per_day = t.resource_credits = HEX_PER_DAY.get(p.rarity, 60)
    t.country_code = (p.country_code or '')[:3]
    t.save()


def _apply(p: UnifiedPOI, data: dict) -> tuple[list, str | None]:
    """Write the editable fields from data onto p. Returns (changed field names, error)."""
    changed = []
    src = dict(data)
    if 'title' in src:
        src['real_output'] = src.pop('title')
    for f, n in TEXT_FIELDS.items():
        if f in src:
            v = str(src[f] or '').strip()[:n]
            if f == 'name' and not v:
                return [], 'Name is required'
            if getattr(p, f) != v:
                setattr(p, f, v); changed.append(f)
    if 'category' in src:
        if src['category'] not in {c for c, _ in _categories()}:
            return [], f"Unknown category {src['category']}"
        if p.category != src['category']:
            p.category = src['category']; changed.append('category')
    if 'rarity' in src:
        if src['rarity'] not in RARITIES:
            return [], 'Unknown rarity'
        if p.rarity != src['rarity']:
            p.rarity = src['rarity']; changed.append('rarity')
    if 'color' in src and src['color']:
        c = str(src['color'])
        if len(c) != 7 or not c.startswith('#'):
            return [], 'Colour must be #RRGGBB'
        if p.color != c:
            p.color = c; changed.append('color')
    for f in ('wiki_url', 'image_url'):
        if f in src:
            v = str(src[f] or '').strip()
            if v and not v.startswith('https://'):
                return [], f'{f} must start with https://'
            if getattr(p, f) != v:
                setattr(p, f, v); changed.append(f)
    for f in ('is_active', 'is_featured'):
        if f in src and bool(src[f]) != getattr(p, f):
            setattr(p, f, bool(src[f])); changed.append(f)
    if 'lat' in src or 'lon' in src:
        try:
            lat, lon = float(src.get('lat', p.latitude)), float(src.get('lon', p.longitude))
        except (TypeError, ValueError):
            return [], 'lat/lon must be numbers'
        if not (-90 <= lat <= 90 and -180 <= lon <= 180):
            return [], 'lat/lon out of range'
        if (lat, lon) != (p.latitude, p.longitude):
            p.latitude, p.longitude = lat, lon
            p.h3_index = h3.latlng_to_cell(lat, lon, 8)
            changed.append('location')
    return changed, None


class GMTokenMetaView(APIView):
    permission_classes = [IsAdminUser]

    def get(self, request):
        return Response({'categories': [{'id': v, 'label': l} for v, l in _categories()], 'rarities': RARITIES})


class GMTokenListView(APIView):
    permission_classes = [IsAdminUser]

    def get(self, request):
        qs = UnifiedPOI.objects.select_related('validated_by').order_by('-updated_at')
        q = request.query_params.get('q', '').strip()
        if q:
            qs = qs.filter(name__icontains=q)
        for f in ('category', 'rarity'):
            if request.query_params.get(f):
                qs = qs.filter(**{f: request.query_params[f]})
        v = request.query_params.get('validated')
        if v in ('0', '1'):
            qs = qs.filter(validated_at__isnull=(v == '0'))
        if request.query_params.get('active', '1') == '1':
            qs = qs.filter(is_active=True)
        page = max(1, int(request.query_params.get('page', 1) or 1))
        total = qs.count()
        rows = qs[(page - 1) * 50: page * 50]
        return Response({'total': total, 'page': page, 'validated_total': UnifiedPOI.objects.filter(is_active=True, validated_at__isnull=False).count(),
                         'results': [{'id': str(p.id), 'name': p.name, 'category': p.category, 'rarity': p.rarity,
                                      'validated': bool(p.validated_at), 'source': p.source} for p in rows]})

    def post(self, request):
        """Generate a new token at a location."""
        p = UnifiedPOI(name='', category='anomaly', latitude=0, longitude=0, source='admin', verified=True,
                       db_uid=f'admin-{uuid.uuid4().hex[:10]}')
        data = dict(request.data)
        if 'lat' not in data or 'lon' not in data:
            return Response({'error': 'lat and lon are required'}, status=400)
        data.setdefault('category', 'anomaly')
        changed, err = _apply(p, data)
        if err:
            return Response({'error': err}, status=400)
        p.tdc_per_24h = HEX_PER_DAY.get(p.rarity, 60)
        if UnifiedPOI.objects.filter(h3_index=p.h3_index, is_active=True).exists():
            return Response({'error': 'A token already sits on this hex'}, status=409)
        with transaction.atomic():
            if request.data.get('validate'):
                p.validated_by, p.validated_at = request.user, timezone.now()
            UnifiedPOI.objects.bulk_create([p])      # bulk_create: save() would force res 7 + category rarity
            _sync_territory(p)
        return Response(_serialize(UnifiedPOI.objects.get(id=p.id)), status=201)


class GMTokenDetailView(APIView):
    permission_classes = [IsAdminUser]

    def get(self, request, poi_id):
        p = UnifiedPOI.objects.filter(id=poi_id).select_related('validated_by').first()
        return Response(_serialize(p)) if p else Response({'error': 'Not found'}, status=404)

    def patch(self, request, poi_id):
        p = UnifiedPOI.objects.filter(id=poi_id).first()
        if not p:
            return Response({'error': 'Not found'}, status=404)
        old_h3 = p.h3_index
        changed, err = _apply(p, request.data)
        if err:
            return Response({'error': err}, status=400)
        if 'location' in changed and UnifiedPOI.objects.filter(h3_index=p.h3_index, is_active=True).exclude(id=p.id).exists():
            return Response({'error': 'Another token already sits on that hex'}, status=409)
        with transaction.atomic():
            if changed:
                p.source = 'admin'                       # protected from import_hexod_db from now on
                p.validated_by, p.validated_at = None, None
                p.tdc_per_24h = HEX_PER_DAY.get(p.rarity, 60)
            if request.data.get('validate'):
                p.validated_by, p.validated_at = request.user, timezone.now()
            UnifiedPOI.objects.filter(id=p.id).update(   # update(): save() would rewrite h3 / rarity defaults
                name=p.name, real_output=p.real_output, description=p.description, fun_fact=p.fun_fact,
                country_code=p.country_code, category=p.category, rarity=p.rarity, color=p.color,
                wiki_url=p.wiki_url, image_url=p.image_url, is_active=p.is_active, is_featured=p.is_featured,
                latitude=p.latitude, longitude=p.longitude, h3_index=p.h3_index, source=p.source,
                tdc_per_24h=p.tdc_per_24h, validated_by=p.validated_by, validated_at=p.validated_at,
                updated_at=timezone.now(),
            )
            if changed:
                _sync_territory(p, old_h3)
        return Response({**_serialize(UnifiedPOI.objects.select_related('validated_by').get(id=p.id)), 'changed': changed})
