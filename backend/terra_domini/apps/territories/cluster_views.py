"""
Territory cluster + customization + income endpoints.
GET  /api/territories/clusters/     — player's clusters + unlock tiers
POST /api/territories/customize/    — update territory customization
GET  /api/territories/income/       — TDC income projection
GET  /api/territories/overlay/      — map overlay events for viewport
"""
import logging, uuid
from decimal import Decimal
from django.utils import timezone
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from django.db.models import Q
from terra_domini.apps.territories.models import (
    Territory, TerritoryCustomization, TerritoryCluster, MapOverlayEvent
)

logger = logging.getLogger('terra_domini.territories')

# Unlock thresholds: cluster size → tier
CLUSTER_TIERS = [
    (1,  0, 'rename + emoji'),
    (3,  1, 'image embed + border color'),
    (6,  2, 'video embed'),
    (10, 3, 'live stream slot'),
    (15, 4, 'private chat room'),
    (25, 5, '3D metaverse portal'),
    (50, 6, 'premium ad placement'),
]

def cluster_tier(size: int) -> int:
    tier = 0
    for min_size, t, _ in CLUSTER_TIERS:
        if size >= min_size:
            tier = t
    return tier

def tdc_per_24h(size: int) -> Decimal:
    """Income = 5 * size * (1 + 0.1 * tier) TDC / 24h."""
    t = cluster_tier(size)
    return Decimal(str(5 * size * (1 + 0.1 * t)))

def tdi_per_24h(size: int) -> Decimal:
    """TDI income = 0.1% of TDC income (low — premium tier players earn more)."""
    return tdc_per_24h(size) * Decimal('0.001')


def recompute_clusters(player):
    """
    H3-graph flood-fill to find contiguous territory clusters.
    Returns list of {cluster_id, h3_indexes, size}.
    """
    try:
        import h3
    except ImportError:
        return []

    territories = list(Territory.objects.filter(owner=player).values_list('h3_index', flat=True))
    if not territories:
        return []

    owned_set = set(territories)
    visited   = set()
    clusters  = []

    for h3_idx in owned_set:
        if h3_idx in visited:
            continue
        # BFS flood fill using H3 neighbors
        cluster = []
        queue = [h3_idx]
        while queue:
            current = queue.pop()
            if current in visited:
                continue
            visited.add(current)
            if current in owned_set:
                cluster.append(current)
                try:
                    neighbors = [c for c in h3.grid_disk(current, 1) if c != current]
                    queue.extend(n for n in neighbors if n not in visited)
                except Exception:
                    pass
        if cluster:
            clusters.append(cluster)

    return clusters


class TerritoryClusterViewSet(viewsets.GenericViewSet):
    permission_classes = [IsAuthenticated]

    @action(detail=False, methods=['GET'], url_path='clusters')
    def clusters(self, request):
        raw = recompute_clusters(request.user)
        result = []
        for cluster_list in raw:
            size = len(cluster_list)
            tier = cluster_tier(size)
            tdc  = float(tdc_per_24h(size))
            tdi  = float(tdi_per_24h(size))
            # centroid
            try:
                import h3
                lats = [h3.cell_to_latlng(h)[0] for h in cluster_list]
                lons = [h3.cell_to_latlng(h)[1] for h in cluster_list]
                clat = sum(lats) / len(lats)
                clon = sum(lons) / len(lons)
            except Exception:
                clat = clon = 0

            result.append({
                'cluster_id': str(uuid.uuid5(uuid.NAMESPACE_DNS, cluster_list[0])),
                'size': size,
                'tier': tier,
                'tier_name': next((n for s,t,n in CLUSTER_TIERS if t==tier), ''),
                'tdc_per_24h': tdc,
                'tdi_per_24h': tdi,
                'centroid': {'lat': clat, 'lon': clon},
                'unlocks': [n for s,t,n in CLUSTER_TIERS if size >= s],
                'next_unlock': next(((s,n) for s,t,n in CLUSTER_TIERS if size < s), None),
            })
        result.sort(key=lambda x: -x['size'])
        total_tdc = sum(c['tdc_per_24h'] for c in result)
        total_tdi = sum(c['tdi_per_24h'] for c in result)
        return Response({'clusters': result, 'total_tdc_per_24h': total_tdc, 'total_tdi_per_24h': total_tdi})

    @action(detail=False, methods=['POST'], url_path='customize')
    def customize(self, request):
        h3_index = request.data.get('h3_index', '').strip()
        if not h3_index:
            return Response({'error': 'h3_index required'}, status=400)

        territory = Territory.objects.filter(h3_index=h3_index, owner=request.user).first()
        if not territory:
            return Response({'error': 'Territory not found or not owned by you'}, status=404)

        # Determine cluster tier for this territory
        clusters = recompute_clusters(request.user)
        my_cluster = next((c for c in clusters if h3_index in c), [h3_index])
        tier = cluster_tier(len(my_cluster))

        ALLOWED_EMBEDS = {0: 'none', 1: 'image', 2: 'video', 3: 'livestream', 4: 'chat', 5: 'metaverse', 6: 'ad_slot'}
        embed_type = request.data.get('embed_type', 'none')

        # Validate tier allows this embed
        required_tier = next((t for s,t,n in CLUSTER_TIERS if ALLOWED_EMBEDS.get(t) == embed_type), 0)
        if embed_type != 'none' and tier < required_tier:
            needed = next((s for s,t,n in CLUSTER_TIERS if t == required_tier), 99)
            return Response({
                'error': f'{embed_type} requires {needed} contiguous zones. You have {len(my_cluster)}.',
                'current_cluster_size': len(my_cluster),
                'needed': needed,
            }, status=403)

        cust, _ = TerritoryCustomization.objects.get_or_create(territory=territory)
        for field in ('display_name', 'flag_emoji', 'border_color', 'fill_color',
                      'embed_type', 'embed_url', 'embed_title', 'ad_advertiser'):
            if field in request.data:
                setattr(cust, field, request.data[field])
        cust.unlocked_tier = tier
        cust.save()

        return Response({'success': True, 'tier': tier, 'embed_type': cust.embed_type})

    @action(detail=False, methods=['GET'], url_path='income')
    def income(self, request):
        clusters = recompute_clusters(request.user)
        total_tdc = sum(float(tdc_per_24h(len(c))) for c in clusters)
        total_tdi = sum(float(tdi_per_24h(len(c))) for c in clusters)
        total_zones = sum(len(c) for c in clusters)
        return Response({
            'total_zones': total_zones,
            'total_tdc_per_24h': total_tdc,
            'total_tdi_per_24h': total_tdi,
            'tdc_per_hour': total_tdc / 24,
            'cluster_count': len(clusters),
        })

    @action(detail=False, methods=['GET'], url_path='overlay')
    def overlay(self, request):
        """Active map overlay events — returned to frontend for animated sublayer."""
        now = timezone.now()
        events = MapOverlayEvent.objects.filter(
            is_active=True
        ).filter(
            Q(expires_at__isnull=True) | Q(expires_at__gt=now)
        ).select_related('player', 'territory')[:100]

        return Response([{
            'id': e.id,
            'type': e.event_type,
            'player': e.player.username if e.player else None,
            'from': {'lat': e.from_lat, 'lon': e.from_lon} if e.from_lat else None,
            'to':   {'lat': e.to_lat,   'lon': e.to_lon}   if e.to_lat   else None,
            'title': e.title,
            'body': e.body,
            'icon': e.icon_emoji,
            'icon_3d': e.icon_3d,
            'payload': e.payload,
            'started_at': e.starts_at.isoformat(),
            'expires_at': e.expires_at.isoformat() if e.expires_at else None,
        } for e in events])

