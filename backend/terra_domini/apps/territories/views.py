from terra_domini.apps.blockchain.nft_service import mint_territory_nft
from django.utils import timezone as tz
import math
"""
Territory views — CRUD + claim + attack + build.
"""
import logging
from django.utils import timezone
from django.core.cache import cache
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny

from terra_domini.apps.territories.models import Territory, Building
from terra_domini.apps.territories.serializers import TerritoryLightSerializer, TerritoryDetailSerializer

logger = logging.getLogger('terra_domini.territories')



# POI category → territory type / biome
_POI_BIOME = {
    'capital_city':'urban', 'financial_hub':'urban', 'stock_exchange':'urban',
    'world_heritage':'landmark', 'ancient_ruins':'landmark', 'religious_site':'landmark',
    'museum':'landmark', 'palace':'landmark', 'stadium':'landmark',
    'mountain_peak':'mountain', 'volcano':'mountain',
    'nature_sanctuary':'forest', 'ancient_forest':'forest', 'national_park':'forest',
    'waterfall':'coastal', 'coral_reef':'coastal', 'mega_port':'coastal', 'island':'coastal',
    'oil_field':'industrial', 'nuclear_plant':'industrial', 'military_base':'industrial',
    'space_center':'industrial', 'mine':'industrial',
    'desert':'desert', 'tundra':'tundra',
}

def _biome_from_poi(poi: dict) -> str:
    return _POI_BIOME.get(poi.get('category',''), 'urban' if poi.get('name') else 'rural')


class TerritoryViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = TerritoryLightSerializer
    filterset_fields = ['territory_type', 'country_code', 'is_control_tower']

    def get_queryset(self):
        return Territory.objects.select_related('owner', 'alliance').all()

    def get_serializer_class(self):
        if self.action == 'retrieve':
            return TerritoryDetailSerializer
        return TerritoryLightSerializer

    # ── Map viewport query ─────────────────────────────────────────
    @action(detail=False, methods=['GET'], url_path='map-view')
    def map_view(self, request):
        """GET /api/territories/map-view/?lat=&lon=&radius_km=&zoom="""
        try:
            lat       = float(request.query_params.get('lat', 48.8566))
            lon       = float(request.query_params.get('lon', 2.3522))
            radius_km = min(float(request.query_params.get('radius_km', 10)), 100)
            zoom      = int(request.query_params.get('zoom', 13))
        except (TypeError, ValueError):
            return Response({'error': 'Invalid params'}, status=400)

        if zoom <= 11:   res = 6
        elif zoom <= 14: res = 7
        else:            res = 8

        try:
            import h3 as h3lib
            center_h3 = h3lib.latlng_to_cell(lat, lon, res)
            k = max(3, min(int(radius_km / {6:10, 7:4, 8:1.2}.get(res, 4)), 12))
            hex_ids = list(h3lib.grid_disk(center_h3, k))
        except Exception as e:
            return Response([], status=200)

        from terra_domini.apps.territories.models import Territory
        import sqlite3 as _sqlite3, os as _os

        # Load ORM territories (for owner, alliance, etc.)
        orm_terrs = {t.h3_index: t for t in
                     Territory.objects.filter(h3_index__in=hex_ids).select_related('owner')}

        # Load raw territory data (rarity, is_landmark, poi_name etc.) via direct SQL
        # This bypasses ORM model sync issues
        raw_terrs = {}
        try:
            from django.conf import settings as _s
            _db_cfg = _s.DATABASES.get('default', {})
            _db = _db_cfg.get('NAME', 'db.sqlite3')
            _conn = _sqlite3.connect(str(_db))
            _c = _conn.cursor()
            _ph = ','.join(['?'] * len(hex_ids))
            _c.execute(f"""SELECT h3_index, rarity, is_landmark, is_shiny, poi_name, poi_wiki_url,
                territory_type, tdc_per_day, resource_credits,
                res_hex_cristaux, res_donnees, res_influence, res_fer, res_petrole,
                res_nourriture, res_eau, res_stabilite, res_acier, res_composants,
                res_main_oeuvre, res_silicium, res_terres_rares, res_uranium, res_gaz,
                center_lat, center_lon, country_code, place_name, landmark_name, nft_version,
                custom_name, custom_emoji, border_color
                FROM territories WHERE h3_index IN ({_ph})""", hex_ids)
            cols = [d[0] for d in _c.description]
            for row in _c.fetchall():
                raw_terrs[row[0]] = dict(zip(cols, row))
            _conn.close()
        except Exception as _e:
            pass

        owned = orm_terrs  # ORM for owner/alliance

        player = request.user

        # Kingdom lookup: find which cluster each owned hex belongs to
        kingdom_map = {}  # h3_index -> cluster_id
        try:
            from terra_domini.apps.territories.kingdom_engine import recompute_kingdoms
            kingdoms = recompute_kingdoms(player)
            for k in kingdoms:
                for h3_idx in k.get('h3_indexes', []):
                    kingdom_map[h3_idx] = {
                        'cluster_id': k['cluster_id'],
                        'is_main': k['is_main'],
                        'size': k['size'],
                        'kingdom_tier': k['tier'],
                    }
        except Exception:
            pass

        # POI index by exact h3_index
        from terra_domini.apps.events.unified_poi import UnifiedPOI
        RARITY_RANK = {'common':0,'uncommon':1,'rare':2,'epic':3,'legendary':4,'mythic':5}
        poi_index = {}
        try:
            for poi in UnifiedPOI.objects.filter(h3_index__in=hex_ids, is_active=True).values(
                    'name','category','emoji','rarity','h3_index','tdc_per_24h','token_id',
                    'is_shiny','wiki_url','description','fun_fact','floor_price_tdi',
                    'visitors_per_year','geopolitical_score'):
                hx2 = poi['h3_index']
                if not hx2: continue
                cur_r = RARITY_RANK.get(poi_index.get(hx2,{}).get('rarity','common'), 0)
                if hx2 not in poi_index or RARITY_RANK.get(poi.get('rarity','common'),0) > cur_r:
                    poi_index[hx2] = dict(poi)
        except Exception:
            pass

        result = []
        for hx in hex_ids:
            try:
                geo      = h3lib.cell_to_latlng(hx)
                boundary = [[p[0], p[1]] for p in h3lib.cell_to_boundary(hx)]
            except Exception:
                continue
            t = owned.get(hx)
            raw = raw_terrs.get(hx, {})    # Raw DB data (rarity, resources, etc.)
            poi = poi_index.get(hx, {})    # UnifiedPOI data
            result.append({
                'h3_index': hx, 'h3': hx, 'h3_resolution': res,
                'owner_id': str(t.owner_id) if t and t.owner_id else None,
                'owner_username': t.owner.username if t and t.owner_id else None,
                'owner_kingdom_id': kingdom_map.get(hx, {}).get('cluster_id') if t and t.owner_id and hx in kingdom_map else None,
                'owner_kingdom_is_main': kingdom_map.get(hx, {}).get('is_main', False),
                'owner_kingdom_size': kingdom_map.get(hx, {}).get('size', 1),
                'owner_kingdom_tier': kingdom_map.get(hx, {}).get('kingdom_tier', 0),
                'owner_emoji': getattr(t.owner, 'avatar_emoji', '🏴') if t and t.owner_id else None,
                'alliance_id': None, 'alliance_tag': None,
                'territory_type': (t.territory_type if t else None) or raw.get('territory_type') or _biome_from_poi(poi) or 'rural',
                'type': (t.territory_type if t else None) or raw.get('territory_type') or _biome_from_poi(poi) or 'rural',
                'defense_tier': t.defense_tier if t else 1,
                'defense_points': float(t.defense_points) if t else 100.0,
                'is_control_tower': bool(t.is_control_tower) if t else False,
                'is_landmark': bool(raw.get('is_landmark',0)) or bool(poi),
                'is_under_attack': False,
                'ad_slot_enabled': False,
                'landmark_name': poi.get('name'),
                'place_name': poi.get('name') or getattr(t, 'place_name', None),
                'center_lat': geo[0], 'center_lon': geo[1],
                'boundary_points': boundary,
                'resource_food': float(getattr(t, 'resource_food', 5)),
                'resource_energy': float(getattr(t, 'resource_energy', 5)),
                'resource_credits': float(raw.get('tdc_per_day') or raw.get('resource_credits') or poi.get('tdc_per_24h',10) or 10),
                'resource_materials': float(getattr(t, 'resource_materials', 3)),
                'resource_intel': float(getattr(t, 'resource_intel', 2)),
                'food_per_tick': float(getattr(t, 'resource_food', poi.get('tdc_per_24h', 10))),
                'rarity': raw.get('rarity') or poi.get('rarity') or 'common',
                'nft_version': getattr(t, 'nft_version', 1),
                'token_id': poi.get('token_id') or getattr(t, 'token_id', None),
                'is_shiny': bool(raw.get('is_shiny',0)) or bool(poi.get('is_shiny',False)),
                'custom_name': raw.get('custom_name') or (getattr(t,'custom_name',None) if t else None),
                'custom_emoji': getattr(t, 'custom_emoji', None) if t else None,
                'border_color': raw.get('border_color') or (getattr(t,'border_color',None) if t else None),
                # POI — hex identity when POI present
                'poi_name': poi.get('name'),
                'poi_category': poi.get('category'),
                'poi_emoji': poi.get('emoji'),
                'poi_wiki_url': poi.get('wiki_url'),
                'poi_description': poi.get('description'),
                'poi_fun_fact': poi.get('fun_fact'),
                'poi_floor_price': poi.get('floor_price_tdi'),
                'poi_visitors': poi.get('visitors_per_year'),
                'poi_geo_score': poi.get('geopolitical_score'),
            })
        return Response(result)


    @action(detail=False, methods=['GET'], url_path='viewport')
    def viewport(self, request):
        """GET /api/territories/viewport/?h3_indexes=idx1,idx2,..."""
        h3_list = request.query_params.get('h3_indexes', '').split(',')
        h3_list = [h.strip() for h in h3_list if h.strip()][:500]  # cap at 500

        if not h3_list:
            return Response({'error': 'h3_indexes required'}, status=400)

        territories = Territory.objects.filter(
            h3_index__in=h3_list
        ).select_related('owner', 'alliance').only(
            'h3_index', 'territory_type', 'owner', 'owner__username',
            'owner__commander_rank', 'alliance', 'defense_tier',
            'is_control_tower', 'is_landmark', 'landmark_name',
            'shield_expires_at', 'ad_slot_enabled',
        )

        data = {}
        for t in territories:
            data[t.h3_index] = {
                'type': t.territory_type,
                'owner': t.owner.username if t.owner else None,
                'rank': t.owner.commander_rank if t.owner else None,
                'alliance': t.alliance.tag if t.alliance else None,
                'defense': t.defense_tier,
                'shielded': t.is_shielded,
                'tower': t.is_control_tower,
                'landmark': t.landmark_name if t.is_landmark else None,
                'ad': t.ad_slot_enabled,
            }

        return Response({'territories': data, 'count': len(data)})

    # ── Claim ─────────────────────────────────────────────────────────────────

    @action(detail=False, methods=['GET'], url_path='hex/(?P<h3_index>[0-9a-f]+)')
    def hex_detail(self, request, h3_index=None):
        """GET /api/territories/hex/<h3>/ — full territory NFT card data"""
        from terra_domini.apps.territories.resource_engine import get_territory_resource
        from terra_domini.apps.events.unified_poi import UnifiedPOI
        import math, hashlib, random

        ter = Territory.objects.filter(h3_index=h3_index).first()

        # Get POI for this hex
        poi = None
        try:
            lat = float(request.query_params.get('lat', ter.center_lat if ter else 0) or 0)
            lon = float(request.query_params.get('lon', ter.center_lon if ter else 0) or 0)
            if lat and lon:
                deg = 0.06  # ~7km radius
                poi = UnifiedPOI.objects.filter(
                    latitude__range=(lat-deg, lat+deg),
                    longitude__range=(lon-deg, lon+deg),
                    is_active=True,
                ).order_by('-is_featured', '-bonus_pct').first()
        except Exception:
            pass

        # Resource engine
        res = get_territory_resource(
            ter.center_lat if ter else 0,
            ter.center_lon if ter else 0,
            h3_index
        ) if (ter and ter.center_lat) else {}

        # Adjacent owned territories count
        adjacent_owned = 0
        dist_nearest = 999
        if ter and request.user.is_authenticated:
            try:
                import h3 as h3lib
                neighbors = h3lib.grid_disk(h3_index, 1) - {h3_index}
                owned = Territory.objects.filter(
                    h3_index__in=list(neighbors),
                    owner=request.user
                ).count()
                adjacent_owned = owned
                # Also check distance to any owned territory
                all_owned = Territory.objects.filter(owner=request.user).values_list('h3_index', flat=True)[:50]
                for oh in all_owned:
                    try:
                        d = h3lib.grid_distance(h3_index, oh)
                        dist_nearest = min(dist_nearest, d)
                    except: pass
            except ImportError:
                pass

        # Cost calculation
        rarity_base = {'common':1,'uncommon':5,'rare':25,'epic':100,'legendary':500,'mythic':5000}
        rarity = (poi.rarity if poi else res.get('rarity','common')) or 'common'
        base = rarity_base.get(rarity, 10)
        dist_mult = 1 + math.log2(max(1, dist_nearest)) if dist_nearest < 999 else 3.0
        adj_discount = max(0.25, 1.0 - adjacent_owned * 0.25)
        cost_tdi = round(base * dist_mult * adj_discount, 1)

        # Mint seconds
        mint_base = {'common':900,'uncommon':7200,'rare':43200,'epic':172800,'legendary':432000,'mythic':1209600}
        mint_seconds = round(mint_base.get(rarity, 900) * adj_discount)

        # Is currently minting?
        is_minting = False
        mint_end_at = None
        if ter and ter.shield_until:  # reusing shield_until field as mint_end_at
            from django.utils import timezone
            if ter.shield_until > timezone.now():
                is_minting = True
                mint_end_at = ter.shield_until.isoformat()

        data = {
            'h3_index': h3_index,
            'rarity': rarity,
            'biome': res.get('biome', ter.biome if ter else 'grassland'),
            'primary_resource': res.get('resource_type', ter.primary_resource if ter else 'credits'),
            'tdc_per_day': ter.tdc_per_day if ter else res.get('tdc_per_day', 10),
            'resource_richness': ter.resource_richness if ter else res.get('tdc_per_day', 1.0) / 10,
            'owner_id': str(ter.owner_id) if (ter and ter.owner_id) else None,
            'owner_username': ter.owner.username if (ter and ter.owner) else None,
            'is_minting': is_minting,
            'mint_end_at': mint_end_at,
            'adjacent_owned': adjacent_owned,
            'distance_to_nearest_owned': dist_nearest if dist_nearest < 999 else None,
            'cost_tdi': cost_tdi,
            'mint_seconds': mint_seconds,
            'is_shiny': ter.is_shiny if ter else False,
            'token_id': ter.token_id if ter else None,
            'edition': ter.edition if ter else 'genesis',
            'card_gradient': ter.get_card_gradient() if ter else None,
            # Fenêtre vulnérabilité DEF (visible par tous pour stratégie)
            'infiltration_count': getattr(ter,'infiltration_count',0) if ter else 0,
            'infiltration_window_until': str(getattr(ter,'infiltration_window_until','') or '') if ter else '',
            # Builds actifs sur le territoire
            'buildings': [
                {'id':str(b.id),'building_type':b.building_type,'level':getattr(b,'level',1)}
                for b in ter.buildings.all()
            ] if ter and hasattr(ter,'buildings') else [],
            'fortification_level': getattr(ter,'fortification_level',0) if ter else 0,
        }
        if poi:
            data.update({
                'poi_name': poi.name,
                'poi_category': poi.category,
                'poi_emoji': poi.emoji,
                'poi_wiki_url': poi.wiki_url,
                'poi_description': poi.description,
                'poi_fun_fact': poi.fun_fact,
                'visitors_per_year': poi.visitors_per_year if hasattr(poi, 'visitors_per_year') else 0,
                'geopolitical_score': poi.geopolitical_score if hasattr(poi, 'geopolitical_score') else 0,
                'floor_price_tdi': poi.floor_price_tdi if hasattr(poi, 'floor_price_tdi') else 0,
                'mint_difficulty': poi.mint_difficulty if hasattr(poi, 'mint_difficulty') else 1,
            })
        return Response(data)

    @action(detail=False, methods=['POST'], url_path='mint')
    def mint(self, request):
        """POST /api/territories/mint/ {h3_index} — start minting process"""
        from django.utils import timezone
        from datetime import timedelta
        h3_index = request.data.get('h3_index', '')
        if not h3_index:
            return Response({'error': 'h3_index required'}, status=400)

        ter, _ = Territory.objects.get_or_create(
            h3_index=h3_index,
            defaults={'center_lat': request.data.get('lat'), 'center_lon': request.data.get('lon')}
        )
        if ter.owner_id:
            return Response({'error': 'Already claimed'}, status=400)
        if ter.shield_until and ter.shield_until > timezone.now():
            return Response({'error': 'Already minting'}, status=400)

        # Calculate mint duration
        mint_base = {'common':900,'uncommon':7200,'rare':43200,'epic':172800,'legendary':432000,'mythic':1209600}
        rarity = ter.rarity or 'common'
        adj_owned = Territory.objects.filter(owner=request.user).count()
        discount = max(0.25, 1.0 - min(adj_owned, 3) * 0.25)
        mint_secs = mint_base.get(rarity, 900) * discount

        ter.shield_until = timezone.now() + timedelta(seconds=mint_secs)
        ter.owner = request.user  # tentative claim
        ter.save(update_fields=['shield_until', 'owner_id'])

        return Response({'status': 'minting', 'ends_at': ter.shield_until.isoformat(), 'duration_seconds': int(mint_secs)})

    @action(detail=False, methods=['POST'], url_path='buy')
    def buy(self, request):
        """POST /api/territories/buy/ {h3_index} — instant purchase"""
        from django.utils import timezone
        import math
        h3_index = request.data.get('h3_index', '')
        if not h3_index:
            return Response({'error': 'h3_index required'}, status=400)

        ter = Territory.objects.filter(h3_index=h3_index).first()
        if ter and ter.owner_id and str(ter.owner_id) != str(request.user.id):
            return Response({'error': 'Territory already owned'}, status=400)

        rarity = (ter.rarity if ter else 'common') or 'common'
        rarity_base = {'common':1,'uncommon':5,'rare':25,'epic':100,'legendary':500,'mythic':5000}
        base = rarity_base.get(rarity, 10)

        # Distance-based pricing
        try:
            import h3 as h3lib
            owned = Territory.objects.filter(owner=request.user).values_list('h3_index', flat=True)[:50]
            dist_nearest = min((h3lib.grid_distance(h3_index, oh) for oh in owned), default=999)
        except: dist_nearest = 5

        dist_mult = 1 + math.log2(max(1, dist_nearest)) if dist_nearest < 999 else 3.0
        try:
            import h3 as h3lib
            neighbors = h3lib.grid_disk(h3_index, 1) - {h3_index}
            adj_owned = Territory.objects.filter(h3_index__in=list(neighbors), owner=request.user).count()
        except: adj_owned = 0
        adj_discount = max(0.25, 1.0 - adj_owned * 0.25)
        cost = base * dist_mult * adj_discount

        player = request.user
        if float(player.tdc_in_game) < cost:
            return Response({'error': f'Need {cost:.1f} TDI, have {float(player.tdc_in_game):.1f}'}, status=400)

        # Deduct and claim
        player.tdc_in_game = float(player.tdc_in_game) - cost
        player.save(update_fields=['tdc_in_game'])

        ter, _ = Territory.objects.get_or_create(h3_index=h3_index)
        ter.owner = player
        ter.shield_until = None
        ter.rarity = rarity
        ter.save(update_fields=['owner_id', 'shield_until', 'rarity'])

        # Check for fusion (adjacent owned territories)
        fusion_count = 0
        try:
            import h3 as h3lib
            neighbors = h3lib.grid_disk(h3_index, 1) - {h3_index}
            fusion_count = Territory.objects.filter(h3_index__in=list(neighbors), owner=player).count()
        except: pass

        return Response({
            'status': 'claimed',
            'h3_index': h3_index,
            'cost_paid': round(cost, 1),
            'fusion_count': fusion_count,
            'message': f'Territory claimed! {"Fusion unlocked!" if fusion_count > 0 else ""}',
        })

    @action(detail=False, methods=['POST'], url_path='claim')
    def claim(self, request):
        """POST /api/territories/claim/ {h3_index: str}"""
        h3_index = request.data.get('h3_index', '').strip()
        if not h3_index:
            return Response({'error': 'h3_index required'}, status=400)

        # Validate H3
        try:
            import h3
            if not h3.is_valid_cell(h3_index):
                return Response({'error': 'Invalid H3 index'}, status=400)
        except Exception:
            pass

        # Check if already claimed
        territory = Territory.objects.filter(h3_index=h3_index).first()
        if territory and territory.owner:
            return Response({'error': 'Territory already claimed', 'owner': territory.owner.username}, status=409)

        if not territory:
            # Create from scratch (new territory)
            try:
                import h3
                lat, lon = h3.cell_to_latlng(h3_index)
            except Exception:
                lat, lon = 0.0, 0.0

            territory = Territory.objects.create(
                h3_index=h3_index,
                h3_resolution=len(h3_index) - 1,
                center_lat=lat,
                center_lon=lon,
                territory_type='urban',  # default, geo pipeline refines later
            )

        # ── Method validation ─────────────────────────────────────────────
        method = request.data.get('method', 'free')
        answer = request.data.get('answer', '')

        from terra_domini.apps.accounts.models import PlayerStats, Player as P
        stats, _ = PlayerStats.objects.get_or_create(player=request.user)
        is_first = stats.territories_owned == 0

        if method == 'free':
            if not is_first:
                return Response({'error': 'Free claim is only for your first territory.'}, status=403)

        elif method == 'puzzle':
            # Answer validated client-side (math puzzle) — trust but log
            if not answer:
                return Response({'error': 'Puzzle answer required'}, status=400)

        elif method == 'buy':
            CLAIM_COST = 50  # TDC
            player_obj = P.objects.get(id=request.user.id)
            if float(player_obj.tdc_in_game) < CLAIM_COST:
                return Response({'error': f'Need {CLAIM_COST} TDC. You have {float(player_obj.tdc_in_game):.0f}.'}, status=402)
            P.objects.filter(id=request.user.id).update(
                tdc_in_game=player_obj.tdc_in_game - CLAIM_COST
            )

        # ── Claim ─────────────────────────────────────────────────────────
        territory.owner = request.user
        territory.captured_at = timezone.now()
        territory.save(update_fields=['owner', 'captured_at'])

        # Async NFT mint (non-blocking — doesn't fail the claim)
        try:
            nft_result = mint_territory_nft(territory, request.user)
            if nft_result['success'] and nft_result.get('token_id'):
                territory.token_id = nft_result['token_id']
                territory.token_minted_at = tz.now()
                territory.save(update_fields=['token_id', 'token_minted_at'])
        except Exception:
            pass  # NFT mint never blocks gameplay

        # Update player stats
        from terra_domini.apps.accounts.models import PlayerStats
        owned_count = Territory.objects.filter(owner=request.user).count()
        PlayerStats.objects.filter(player=request.user).update(
            territories_owned=owned_count,
            territories_captured=stats.territories_captured + 1,
        )
        stats.refresh_from_db()

        # First-claim bonus
        if method == 'free' and is_first:
            from django.db.models import F as FF
            from terra_domini.apps.accounts.models import Player as P
            P.objects.filter(id=request.user.id).update(tdc_in_game=FF('tdc_in_game') + 100)

        # Initialize resources based on territory type
        try:
            from terra_domini.apps.territories.resource_engine import initialize_territory_resources
            # Only init if resources are zero (first claim)
            if not territory.resource_food and not territory.resource_energy:
                initialize_territory_resources(territory, save=True)
                territory.refresh_from_db()
        except Exception as e:
            logger.warning(f'Resource init failed: {e}')

        logger.info(f"Territory claimed: {h3_index} by {request.user.username} (method={method})")
        # Vérifier progression campagne après claim
        try:
            from terra_domini.apps.progression.campaigns import check_campaign_progress
            check_campaign_progress(request.user)
        except Exception:
            pass
        # Déclencher vérification progression campagnes
        try:
            from terra_domini.apps.progression.campaigns import check_campaign_progress
            check_campaign_progress(request.user)
        except Exception:
            pass
        # Vérifier progression campagnes après claim
        try:
            from terra_domini.apps.progression.campaigns import check_campaign_progress
            check_campaign_progress(request.user)
        except Exception: pass
        # Create map overlay event
        try:
            from terra_domini.apps.territories.models import MapOverlayEvent
            from django.utils import timezone as tz2
            MapOverlayEvent.objects.create(
                event_type='resource_drop' if method == 'free' else 'troop_move',
                player=request.user,
                territory=territory,
                from_lat=territory.center_lat,
                from_lon=territory.center_lon,
                title=f'{request.user.username} claimed {territory.place_name or h3_index[:8]}',
                body=f'Method: {method}',
                icon_emoji='🎉' if method == 'free' else '⚑',
                is_active=True,
                expires_at=tz2.now() + __import__('datetime').timedelta(minutes=10),
            )
        except Exception:
            pass

        return Response({
            'success': True,
            'h3_index': h3_index,
            'territory_type': territory.territory_type,
            'resources': {
                'energy': territory.resource_energy,
                'food': territory.resource_food,
                'credits': territory.resource_credits,
                'culture': territory.resource_culture,
                'materials': territory.resource_materials,
                'intel': territory.resource_intel,
            },
            'message': f"Territory claimed! Earning {territory.resource_credits:.0f} credits/tick."
        }, status=201)

    # ── My territories ────────────────────────────────────────────────────────
    @action(detail=False, methods=['GET'], url_path='mine')
    def my_territories(self, request):
        """GET /api/territories/mine/ — list player's own territories"""
        territories = Territory.objects.filter(owner=request.user).select_related('alliance').order_by('-captured_at')
        return Response({
            'territories': TerritoryLightSerializer(territories, many=True).data,
            'count': territories.count(),
        })

    # ── Territory detail ──────────────────────────────────────────────────────
    @action(detail=False, methods=['GET'], url_path='by-h3/(?P<h3_index>[0-9a-f]+)')
    def by_h3(self, request, h3_index=None):
        """GET /api/territories/by-h3/{h3_index}/"""
        try:
            territory = Territory.objects.select_related('owner', 'alliance').get(h3_index=h3_index)
        except Territory.DoesNotExist:
            return Response({'error': 'Territory not found', 'h3_index': h3_index}, status=404)

        return Response(TerritoryDetailSerializer(territory).data)

    # ── Shield ────────────────────────────────────────────────────────────────
    @action(detail=False, methods=['POST'], url_path='generate')
    def generate(self, request):
        """POST /api/territories/generate/ {h3_index, lat, lon}
        Generate or retrieve a standard territory on first click.
        """
        h3_index = request.data.get('h3_index', '').strip()
        lat = float(request.data.get('lat', 0))
        lon = float(request.data.get('lon', 0))
        if not h3_index:
            return Response({'error': 'h3_index required'}, status=400)
        try:
            from terra_domini.apps.territories.territory_engine import generate_territory
            data = generate_territory(h3_index, lat, lon)
            return Response({'territory': data})
        except Exception as e:
            return Response({'error': str(e)}, status=500)

    @action(detail=False, methods=['POST'], url_path='shield')
    def activate_shield(self, request):
        """POST /api/territories/shield/ {h3_index, hours: 6|12}"""
        h3_index = request.data.get('h3_index', '')
        hours = int(request.data.get('hours', 6))

        if hours not in (6, 12):
            return Response({'error': 'hours must be 6 or 12'}, status=400)

        try:
            territory = Territory.objects.get(h3_index=h3_index, owner=request.user)
        except Territory.DoesNotExist:
            return Response({'error': 'Territory not found or not yours'}, status=404)

        tdc_cost = 50 if hours == 6 else 90

        if request.user.tdc_in_game < tdc_cost:
            return Response({'error': f'Need {tdc_cost} TDC, you have {request.user.tdc_in_game:.0f}'}, status=402)

        from datetime import timedelta
        territory.shield_expires_at = timezone.now() + timedelta(hours=hours)
        territory.save(update_fields=['shield_expires_at'])

        request.user.__class__.objects.filter(id=request.user.id).update(
            tdc_in_game=request.user.__class__.objects.get(id=request.user.id).tdc_in_game - tdc_cost
        )

        return Response({
            'success': True,
            'shield_expires_at': territory.shield_expires_at.isoformat(),
            'tdc_spent': tdc_cost,
        })

    # ── Buy offer (send HEX Coin offer to owner) ──────────────────────────────
    @action(detail=False, methods=['POST'], url_path='buy-offer')
    def buy_offer(self, request):
        """POST /api/territories/buy-offer/ {h3_index, offer_tdc}"""
        h3_index   = request.data.get('h3_index', '')
        offer_tdc  = float(request.data.get('offer_tdc', 0))

        if not h3_index:
            return Response({'error': 'h3_index required'}, status=400)
        if offer_tdc <= 0:
            return Response({'error': 'offer_tdc must be > 0'}, status=400)

        try:
            territory = Territory.objects.select_related('owner').get(h3_index=h3_index)
        except Territory.DoesNotExist:
            return Response({'error': 'Territory not found'}, status=404)

        if not territory.owner:
            return Response({'error': 'Territory is free — claim it directly'}, status=400)
        if territory.owner == request.user:
            return Response({'error': 'You already own this territory'}, status=400)

        # Check buyer balance
        from terra_domini.apps.accounts.models import Player as P
        buyer = P.objects.get(id=request.user.id)
        if float(buyer.tdc_in_game) < offer_tdc:
            return Response({'error': f'Insufficient HEX Coin: need {offer_tdc}, have {float(buyer.tdc_in_game):.0f}'}, status=402)

        # For V0: auto-accept if offer >= floor_price or rarity base
        RARITY_FLOOR = {'common':1,'uncommon':5,'rare':25,'epic':100,'legendary':500,'mythic':5000}
        floor = RARITY_FLOOR.get(territory.rarity or 'common', 10)
        auto_accept = offer_tdc >= floor * 1.5

        if auto_accept:
            # Transfer: deduct from buyer, add to seller
            seller = territory.owner
            P.objects.filter(id=buyer.id).update(tdc_in_game=float(buyer.tdc_in_game) - offer_tdc)
            P.objects.filter(id=seller.id).update(tdc_in_game=float(P.objects.get(id=seller.id).tdc_in_game) + offer_tdc)
            territory.owner    = buyer
            territory.captured_at = timezone.now()
            territory.save(update_fields=['owner', 'captured_at'])
            return Response({'success': True, 'auto_accepted': True,
                             'message': f'Offer accepted! {offer_tdc} HEX Coin transferred.'})
        else:
            # V0: queue offer (notify owner via future WebSocket) — return pending
            return Response({'success': True, 'auto_accepted': False,
                             'message': f'Offer of {offer_tdc} HEX Coin sent to {territory.owner.username}. Waiting for response.'})

    # ── Attack (CDC §2.3 — ATK vs DEF, cost by rarity) ───────────────────────
    @action(detail=False, methods=['POST'], url_path='attack')
    def attack(self, request):
        """
        POST /api/territories/attack/ {h3_index, attack_type}

        3 types d'attaque (BOARD spec — rock-paper-scissors stratégique) :

        'assault'      → ATK brute vs DEF physique
                         Ressource consommée: res_petrole + res_acier
                         Counter: Fortification build
                         Bonus si attacker a skill "Guerre mécanisée"

        'infiltration' → Données vs Stabilité du défenseur
                         Ressource consommée: res_donnees + res_composants
                         Counter: Tour de contrôle build
                         Bonus si attacker a skill "Frappe à distance"
                         Succès → neutralise DEF sans conquête (prépare assault)

        'blockade'     → Influence attaquant vs Influence défenseur
                         Ressource consommée: res_influence + res_or
                         Counter: skill "Résistance prolongée"
                         Succès → réduit production défenseur de 50% pendant 24h
                         Ne conquiert pas mais ruine économiquement
        """
        import random as _r
        h3_index    = request.data.get('h3_index', '').strip()
        attack_type = request.data.get('attack_type', 'assault')

        if not h3_index:
            return Response({'error': 'h3_index required'}, status=400)
        if attack_type not in ('assault', 'infiltration', 'blockade'):
            return Response({'error': 'attack_type must be assault|infiltration|blockade'}, status=400)

        territory = Territory.objects.filter(h3_index=h3_index).select_related('owner').first()
        if not territory:
            return Response({'error': 'Territory not found'}, status=404)
        if territory.owner == request.user:
            return Response({'error': 'Already yours'}, status=400)

        from terra_domini.apps.accounts.models import Player as P
        from django.db.models import F
        attacker = P.objects.get(id=request.user.id)
        rank = float(getattr(attacker, 'commander_rank', 1))

        # ── Coûts en ressources (Board: consommation sans maintenance) ──────
        import sqlite3 as _sq3
        from django.conf import settings as _s
        db = str(_s.DATABASES['default'].get('NAME', 'db.sqlite3'))
        conn = _sq3.connect(db)
        c = conn.cursor()

        ATTACK_COSTS = {
            'assault':      {'res_petrole': 20, 'res_acier': 15},
            'infiltration': {'res_donnees': 25, 'res_composants': 10},
            'blockade':     {'res_influence': 30},
        }
        costs = ATTACK_COSTS[attack_type]

        # Vérifier ressources attaquant (depuis ses territoires)
        c.execute('SELECT ' + ', '.join(costs.keys()) +
                  ' FROM territories WHERE owner_id=? LIMIT 1', [str(attacker.id)])
        row = c.fetchone()
        if not row:
            conn.close()
            return Response({'error': 'Aucun territoire — impossible d\'attaquer'}, status=400)
        for i, (res, needed) in enumerate(costs.items()):
            if (row[i] or 0) < needed:
                conn.close()
                return Response({'error': f'Ressources insuffisantes : {needed} {res} requis'}, status=402)

        # Déduire ressources du premier territoire de l'attaquant
        sets = ', '.join(f"{k}=MAX(0,{k}-?)" for k in costs)
        c.execute(f"UPDATE territories SET {sets} WHERE owner_id=? AND ROWID=(SELECT MIN(ROWID) FROM territories WHERE owner_id=?)",
                  [*costs.values(), str(attacker.id), str(attacker.id)])
        conn.commit()
        conn.close()

        # ── Résolution selon le type ─────────────────────────────────────────
        if attack_type == 'assault':
            # ATK brute — rank + skill "Guerre mécanisée" + build fortification counter
            atk = rank * 12 + float(getattr(attacker, 'attack_power_bonus', 0))
            def_val = float(territory.defense_points or 100.0)
            # Check si défenseur a Fortification → DEF ×1.25
            if getattr(territory, 'fortification_level', 0) > 0:
                def_val *= 1.25

            # BOARD spec: Coalition anti-dominant
            # Si l'attaquant contrôle >8% des territoires → défenseurs reçoivent DEF +25%
            import sqlite3 as _sq3c
            _db3 = str(__import__('django').conf.settings.DATABASES['default'].get('NAME','db.sqlite3'))
            _c3  = _sq3c.connect(_db3)
            _c3.execute("SELECT COUNT(*) FROM territories")
            _total_terr = _c3.fetchone()[0] or 1
            _c3.execute("SELECT COUNT(*) FROM territories WHERE owner_id=?", [str(attacker.id)])
            _atk_count = _c3.fetchone()[0] or 0
            _c3.close()
            _dominance_pct = _atk_count / _total_terr
            if _dominance_pct > 0.08:
                def_val *= 1.25  # Coalition: +25% DEF contre le dominant

            atk_ratio  = atk / max(def_val, 1)
            win_chance = min(0.90, max(0.10, 0.35 + atk_ratio * 0.35))
            victory    = _r.random() < win_chance

            if victory:
                prev_owner = territory.owner
                territory.owner = attacker
                territory.captured_at = timezone.now()
                territory.defense_points = float(territory.max_defense_points or 100) * 0.25
                territory.save(update_fields=['owner', 'captured_at', 'defense_points'])
                P.objects.filter(id=attacker.id).update(
                    territories_captured=F('territories_captured') + 1,
                    battles_won=F('battles_won') + 1,
                )
                # Check campaign progress après victoire
                try:
                    from terra_domini.apps.progression.campaigns import check_campaign_progress
                    check_campaign_progress(attacker)
                except Exception: pass
                return Response({
                    'victory': True, 'attack_type': 'assault',
                    'atk': round(atk, 1), 'def': round(def_val, 1),
                    'win_chance': round(win_chance * 100, 1),
                    'territory_captured': True,
                    'report': {
                        'title': '⚔️ Assaut victorieux',
                        'detail': f'ATK {atk:.0f} vs DEF {def_val:.0f}',
                        'loot': f'Territoire conquis · Défenses réduites à 25%',
                        'tip': 'Construisez vite avant que l\'ennemi riposte !',
                    }
                })
            else:
                P.objects.filter(id=attacker.id).update(battles_lost=F('battles_lost') + 1)
                return Response({
                    'victory': False, 'attack_type': 'assault',
                    'atk': round(atk, 1), 'def': round(def_val, 1),
                    'win_chance': round(win_chance * 100, 1),
                    'territory_captured': False,
                    'report': {
                        'title': '💀 Assaut repoussé',
                        'detail': f'ATK {atk:.0f} insuffisant vs DEF {def_val:.0f}',
                        'loot': 'Aucun territoire pris',
                        'tip': 'Débloquez "Guerre mécanisée" ou augmentez votre rang.',
                    }
                })

        elif attack_type == 'infiltration':
            # Données attaquant vs Stabilité défenseur
            # Succès : neutralise les défenses (DEF ÷2) sans conquérir
            atk_data  = float(getattr(attacker, 'commander_rank', 1)) * 8
            def_stab  = float(territory.res_stabilite or 50) + float(territory.defense_points or 100) * 0.3
            # Tour de contrôle counter
            if territory.is_control_tower:
                def_stab *= 1.5
            win_chance = min(0.85, max(0.15, 0.4 + (atk_data / max(def_stab, 1)) * 0.3))
            victory    = _r.random() < win_chance

            if victory:
                # Neutralise défenses pendant 6h
                from datetime import timedelta
                import sqlite3 as _sq3b
                _db = str(__import__('django').conf.settings.DATABASES['default'].get('NAME','db.sqlite3'))
                _c2 = _sq3b.connect(_db)
                # Incrémenter compteur infiltrations
                _c2.execute("SELECT infiltration_count FROM territories WHERE h3_index=?", [h3_index])
                _row = _c2.fetchone()
                _inf_count = (_row[0] or 0) + 1 if _row else 1
                _def_mult = 0.15 if _inf_count >= 3 else 0.5  # 3+ infiltrations → DEF 15%
                _c2.execute("UPDATE territories SET infiltration_count=?, infiltration_window_until=datetime('now','+6 hours') WHERE h3_index=?",
                            [_inf_count, h3_index])
                _c2.commit(); _c2.close()
                territory.defense_points = max(10, float(territory.defense_points or 100) * _def_mult)
                territory.save(update_fields=['defense_points'])
                return Response({
                    'victory': True, 'attack_type': 'infiltration',
                    'territory_captured': False,
                    'report': {
                        'title': '🔓 Infiltration réussie',
                        'detail': f'Stabilité percée — DEF divisée par 2',
                        'loot': 'Défenses du territoire affaiblies pendant 6h',
                        'tip': 'Lancez un assaut maintenant pendant que les défenses sont basses !',
                    }
                })
            else:
                return Response({
                    'victory': False, 'attack_type': 'infiltration',
                    'territory_captured': False,
                    'report': {
                        'title': '🚫 Infiltration déjouée',
                        'detail': 'Contre-espionnage actif',
                        'loot': 'Aucun effet',
                        'tip': 'Augmentez vos Données ou débloquez "Cyberguerre".',
                    }
                })

        else:  # blockade
            # Influence attaquant vs Influence défenseur
            # Succès : réduit production de 50% pendant 24h
            atk_inf  = float(getattr(attacker, 'commander_rank', 1)) * 6 + float(territory.res_influence or 0) * 0.1
            def_inf  = float(territory.res_influence or 30) + float(territory.res_stabilite or 30) * 0.5
            win_chance = min(0.80, max(0.10, 0.35 + (atk_inf / max(def_inf, 1)) * 0.3))
            victory    = _r.random() < win_chance

            if victory:
                # Réduire production HEX Coin du territoire pour 24h
                orig = float(territory.tdc_per_day or 10)
                territory.tdc_per_day = orig * 0.5
                territory.save(update_fields=['tdc_per_day'])
                return Response({
                    'victory': True, 'attack_type': 'blockade',
                    'territory_captured': False,
                    'report': {
                        'title': '🚢 Blocus économique réussi',
                        'detail': f'Production réduite de 50% ({orig:.0f}→{orig*0.5:.0f} HEX Coin/j)',
                        'loot': f'Adversaire perd {orig*0.5:.0f} HEX Coin/j pendant 24h',
                        'tip': 'Répétez le blocus pour ruiner économiquement avant l\'assaut final.',
                    }
                })
            else:
                return Response({
                    'victory': False, 'attack_type': 'blockade',
                    'territory_captured': False,
                    'report': {
                        'title': '📡 Blocus brisé',
                        'detail': 'Influence défenseur trop forte',
                        'loot': 'Aucun effet',
                        'tip': 'Débloquez "Soft power" pour forcer la capitulation diplomatique.',
                    }
                })
