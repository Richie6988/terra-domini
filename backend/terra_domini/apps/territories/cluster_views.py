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
                    neighbors = [c for c in h3.k_ring(current, 1) if c != current]
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
                lats = [h3.h3_to_geo(h)[0] for h in cluster_list]
                lons = [h3.h3_to_geo(h)[1] for h in cluster_list]
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

    @action(detail=False, methods=['GET'], url_path='mine')
    def mine(self, request):
        """GET /api/territories-geo/mine/ — player's owned territories with full data."""
        from terra_domini.apps.territories.models import Territory
        import h3 as h3lib
        player = request.user
        territories = Territory.objects.filter(owner=player).select_related('owner')[:200]

        from terra_domini.apps.events.unified_poi import UnifiedPOI
        hex_ids = [t.h3_index for t in territories if t.h3_index]
        pois = {p['h3_index']: p for p in UnifiedPOI.objects.filter(
            h3_index__in=hex_ids, is_active=True
        ).values('name','emoji','rarity','is_shiny','wiki_url','floor_price_tdi','h3_index')}

        result = []
        for t in territories:
            try:
                geo = h3lib.h3_to_geo(t.h3_index) if t.h3_index else (t.center_lat, t.center_lon)
                boundary = [[p[0],p[1]] for p in h3lib.h3_to_geo_boundary(t.h3_index)] if t.h3_index else []
            except Exception:
                geo = (t.center_lat or 0, t.center_lon or 0)
                boundary = []
            poi = pois.get(t.h3_index, {})
            result.append({
                'h3_index': t.h3_index,
                'h3': t.h3_index,
                'owner_id': str(player.id),
                'owner_username': player.username,
                'custom_name': getattr(t, 'custom_name', None),
                'custom_emoji': getattr(t, 'custom_emoji', None),
                'border_color': getattr(t, 'border_color', None),
                'territory_type': t.territory_type,
                'rarity': poi.get('rarity') or getattr(t, 'rarity', 'common'),
                'is_shiny': poi.get('is_shiny') or getattr(t, 'is_shiny', False),
                'nft_version': getattr(t, 'nft_version', 1),
                'token_id': getattr(t, 'token_id', None),
                'center_lat': geo[0], 'center_lon': geo[1],
                'boundary_points': boundary,
                'resource_credits': float(getattr(t, 'resource_credits', 10)),
                'resource_food': float(getattr(t, 'resource_food', 5)),
                'resource_energy': float(getattr(t, 'resource_energy', 5)),
                'resource_materials': float(getattr(t, 'resource_materials', 3)),
                'resource_intel': float(getattr(t, 'resource_intel', 2)),
                'food_per_tick': float(getattr(t, 'resource_food', 10)),
                'defense_tier': t.defense_tier,
                'poi_name': poi.get('name'),
                'poi_emoji': poi.get('emoji'),
                'poi_wiki_url': poi.get('wiki_url'),
                'poi_floor_price': poi.get('floor_price_tdi'),
                'is_landmark': bool(poi),
            })
        return Response({'territories': result, 'count': len(result)})


    @action(detail=False, methods=['GET'], url_path='kingdoms')
    def kingdoms(self, request):
        """GET /api/territories-geo/kingdoms/ — all kingdoms for current player."""
        from terra_domini.apps.territories.kingdom_engine import recompute_kingdoms
        kingdoms = recompute_kingdoms(request.user)
        return Response({'kingdoms': kingdoms, 'count': len(kingdoms)})

    @action(detail=False, methods=['GET'], url_path='kingdom-skill-tree')
    def kingdom_skill_tree(self, request):
        """GET /api/territories-geo/kingdom-skill-tree/?cluster_id=xxx"""
        cluster_id = request.query_params.get('cluster_id', '')
        if not cluster_id:
            # Auto: return main kingdom tree
            from terra_domini.apps.territories.models import TerritoryCluster
            cluster = TerritoryCluster.objects.filter(
                player=request.user, is_main_kingdom=True).first()
            if not cluster:
                from terra_domini.apps.territories.kingdom_engine import recompute_kingdoms
                kingdoms = recompute_kingdoms(request.user)
                if kingdoms:
                    cluster_id = kingdoms[0]['cluster_id']
                else:
                    return Response({'tree': {}, 'unlocked_count': 0, 'kingdom': None})
            else:
                cluster_id = cluster.cluster_id

        from terra_domini.apps.territories.kingdom_engine import get_kingdom_skill_tree
        return Response(get_kingdom_skill_tree(request.user, cluster_id))

    @action(detail=False, methods=['POST'], url_path='kingdom-unlock-skill')
    def kingdom_unlock_skill(self, request):
        """POST /api/territories-geo/kingdom-unlock-skill/ {cluster_id, skill_id}"""
        cluster_id = request.data.get('cluster_id', '')
        skill_id   = request.data.get('skill_id')
        if not cluster_id or not skill_id:
            return Response({'error': 'cluster_id and skill_id required'}, status=400)
        from terra_domini.apps.territories.kingdom_engine import unlock_kingdom_skill
        result = unlock_kingdom_skill(request.user, cluster_id, int(skill_id))
        if 'error' in result:
            return Response(result, status=400)
        return Response(result)

    @action(detail=False, methods=['GET'], url_path='territory-kingdom')
    def territory_kingdom(self, request):
        """GET /api/territories-geo/territory-kingdom/?h3=xxx — get kingdom for a territory."""
        h3_index = request.query_params.get('h3', '')
        if not h3_index:
            return Response({'error': 'h3 required'}, status=400)
        try:
            from terra_domini.apps.territories.kingdom_engine import get_kingdom_for_territory
            kingdom = get_kingdom_for_territory(request.user, h3_index)
            return Response({'kingdom': kingdom})
        except Exception as e:
            import logging; logging.getLogger(__name__).error(f'territory_kingdom error: {e}', exc_info=True)
            return Response({'kingdom': None, 'error': str(e)})

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


    @action(detail=False, methods=['GET'], url_path='ladder')
    def ladder(self, request):
        """
        GET /api/territories-geo/ladder/
        Params: ?scope=global|nearby&lat=&lon=&radius_km=500

        Classement global ou joueurs proches (distance géo du joueur).
        Métriques : territoires, HEX Coin total, batailles gagnées, rareté max.
        """
        scope    = request.query_params.get('scope', 'global')
        lat      = request.query_params.get('lat')
        lon      = request.query_params.get('lon')
        radius   = float(request.query_params.get('radius_km', 500))

        import sqlite3 as _sq
        from django.conf import settings as _s
        import math

        db = str(_s.DATABASES['default'].get('NAME', 'db.sqlite3'))
        conn = _sq.connect(db)
        c    = conn.cursor()

        RARITY_RANK = {'common':1,'uncommon':2,'rare':3,'epic':4,'legendary':5,'mythic':6}

        if scope == 'nearby' and lat and lon:
            # Joueurs qui ont des territoires dans le rayon
            lat_f, lon_f = float(lat), float(lon)
            # Approximation: 1° lat ≈ 111km, 1° lon ≈ 111km×cos(lat)
            dlat = radius / 111.0
            dlon = radius / (111.0 * max(0.01, abs(math.cos(math.radians(lat_f)))))

            c.execute("""
                SELECT u.id, u.username, u.commander_rank,
                       COUNT(t.h3_index) as terr_count,
                       SUM(t.tdc_per_day) as daily_income,
                       MAX(CASE t.rarity
                           WHEN 'mythic' THEN 6 WHEN 'legendary' THEN 5
                           WHEN 'epic' THEN 4 WHEN 'rare' THEN 3
                           WHEN 'uncommon' THEN 2 ELSE 1 END) as max_rarity_rank,
                       u.battles_won, u.tdc_in_game,
                       AVG(t.center_lat) as avg_lat,
                       AVG(t.center_lon) as avg_lon
                FROM accounts_player u
                JOIN territories t ON t.owner_id = CAST(u.id AS TEXT)
                WHERE t.center_lat BETWEEN ? AND ?
                  AND t.center_lon BETWEEN ? AND ?
                GROUP BY u.id, u.username, u.commander_rank, u.battles_won, u.tdc_in_game
                ORDER BY terr_count DESC, daily_income DESC
                LIMIT 50
            """, [lat_f - dlat, lat_f + dlat, lon_f - dlon, lon_f + dlon])
        else:
            # Classement global
            c.execute("""
                SELECT u.id, u.username, u.commander_rank,
                       COUNT(t.h3_index) as terr_count,
                       SUM(t.tdc_per_day) as daily_income,
                       MAX(CASE t.rarity
                           WHEN 'mythic' THEN 6 WHEN 'legendary' THEN 5
                           WHEN 'epic' THEN 4 WHEN 'rare' THEN 3
                           WHEN 'uncommon' THEN 2 ELSE 1 END) as max_rarity_rank,
                       u.battles_won, u.tdc_in_game,
                       NULL as avg_lat, NULL as avg_lon
                FROM accounts_player u
                JOIN territories t ON t.owner_id = CAST(u.id AS TEXT)
                GROUP BY u.id, u.username, u.commander_rank, u.battles_won, u.tdc_in_game
                ORDER BY terr_count DESC, daily_income DESC
                LIMIT 100
            """)

        rows = c.fetchall()
        conn.close()

        RARITY_LABELS = {1:'Common',2:'Uncommon',3:'Rare',4:'Epic',5:'Legendary',6:'Mythic'}
        RARITY_COLORS = {1:'#9CA3AF',2:'#10B981',3:'#3B82F6',4:'#8B5CF6',5:'#F59E0B',6:'#EC4899'}

        result = []
        for i, row in enumerate(rows):
            uid, username, rank, terr_count, daily_income, max_rar_rank, battles_won, tdc_total, avg_lat, avg_lon = row
            # Calculer distance si nearby
            dist_km = None
            if lat and lon and avg_lat and avg_lon:
                dlat_r = math.radians(float(avg_lat) - float(lat))
                dlon_r = math.radians(float(avg_lon) - float(lon))
                a = math.sin(dlat_r/2)**2 + math.cos(math.radians(float(lat))) * math.cos(math.radians(float(avg_lat))) * math.sin(dlon_r/2)**2
                dist_km = round(6371 * 2 * math.asin(math.sqrt(a)), 0)

            is_me = str(uid) == str(request.user.id) if request.user.is_authenticated else False
            max_rar_rank = max_rar_rank or 1

            result.append({
                'rank':          i + 1,
                'player_id':     str(uid),
                'username':      username,
                'commander_rank': rank or 1,
                'territories':   terr_count or 0,
                'daily_income':  round(float(daily_income or 0), 0),
                'battles_won':   battles_won or 0,
                'tdc_total':     round(float(tdc_total or 0), 0),
                'max_rarity':    RARITY_LABELS.get(max_rar_rank, 'Common'),
                'max_rarity_color': RARITY_COLORS.get(max_rar_rank, '#9CA3AF'),
                'distance_km':   dist_km,
                'is_me':         is_me,
            })

        # Position du joueur courant dans le classement global
        my_rank = None
        if request.user.is_authenticated:
            for entry in result:
                if entry['is_me']:
                    my_rank = entry['rank']; break

        return Response({
            'scope':   scope,
            'entries': result,
            'my_rank': my_rank,
            'total':   len(result),
        })

    @action(detail=False, methods=['GET'], url_path='meta')
    def meta(self, request):
        """
        GET /api/territories-geo/meta/
        Stats mondiales pour MetaDashboard (Alex spec).
        """
        import sqlite3 as _sq
        from django.conf import settings as _s
        db = str(_s.DATABASES['default'].get('NAME','db.sqlite3'))
        conn = _sq.connect(db); c = conn.cursor()

        # Distribution raretés
        c.execute("SELECT rarity, COUNT(*) FROM territories WHERE owner_id IS NOT NULL GROUP BY rarity")
        rarity_dist = dict(c.fetchall())

        # Distribution biomes
        c.execute("SELECT COALESCE(biome,territory_type,'unknown'), COUNT(*) FROM territories WHERE owner_id IS NOT NULL GROUP BY biome")
        biome_dist = dict(c.fetchall())

        # Stats globales
        c.execute("SELECT COUNT(DISTINCT owner_id) FROM territories WHERE owner_id IS NOT NULL")
        active_players = (c.fetchone() or [0])[0]
        c.execute("SELECT COUNT(*) FROM territories WHERE owner_id IS NOT NULL")
        owned_count = (c.fetchone() or [0])[0]

        # Zones contestées (batailles 24h) — approx via battle_log si existe
        contested = []
        try:
            c.execute("""
                SELECT t.h3_index, t.poi_name, t.rarity, COUNT(b.id) as battle_count
                FROM territories t
                JOIN battle_log b ON b.territory_h3 = t.h3_index
                WHERE b.resolved_at > datetime('now','-24 hours')
                GROUP BY t.h3_index
                ORDER BY battle_count DESC
                LIMIT 10
            """)
            for row in c.fetchall():
                contested.append({'h3_index':row[0],'poi_name':row[1],'rarity':row[2],
                                   'battle_count':row[3],'owner_changes':0})
        except: pass

        # Balance ressources (offre vs demande estimée)
        resource_fields = ['res_petrole','res_fer','res_donnees','res_influence',
                           'res_uranium','res_terres_rares','res_or','res_silicium']
        resource_balance = []
        for rf in resource_fields:
            try:
                c.execute(f"SELECT SUM({rf}) FROM territories WHERE owner_id IS NOT NULL")
                supply = (c.fetchone() or [0])[0] or 0
                # Demande estimée = supply * 0.8 (équilibre cible)
                resource_balance.append({'resource': rf.replace('res_',''), 'supply':round(supply,0), 'demand': round(supply*0.75,0)})
            except: pass

        conn.close()

        return Response({
            'rarity_distribution': rarity_dist,
            'biome_distribution':  biome_dist,
            'global_stats': {
                'active_players': active_players,
                'owned_count':    owned_count,
                'battles_24h':    0,
                'hex_emitted_24h': owned_count * 10,
            },
            'contested_zones':  contested,
            'resource_balance': resource_balance,
        })
