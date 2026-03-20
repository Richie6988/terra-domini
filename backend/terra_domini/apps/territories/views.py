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
            center_h3 = h3lib.geo_to_h3(lat, lon, res)
            k = max(3, min(int(radius_km / {6:10, 7:4, 8:1.2}.get(res, 4)), 12))
            hex_ids = list(h3lib.k_ring(center_h3, k))
        except Exception as e:
            return Response([], status=200)

        from terra_domini.apps.territories.models import Territory
        owned = {t.h3_index: t for t in
                 Territory.objects.filter(h3_index__in=hex_ids).select_related('owner')}

        player = request.user
        result = []
        for hx in hex_ids:
            try:
                geo      = h3lib.h3_to_geo(hx)
                boundary = [[p[0], p[1]] for p in h3lib.h3_to_geo_boundary(hx)]
            except Exception:
                continue
            t = owned.get(hx)
            result.append({
                'h3_index': hx, 'h3': hx, 'h3_resolution': res,
                'owner_id': str(t.owner_id) if t and t.owner_id else None,
                'owner_username': t.owner.username if t and t.owner_id else None,
                'alliance_id': None, 'alliance_tag': None,
                'territory_type': t.territory_type if t else 'rural',
                'type': t.territory_type if t else 'rural',
                'defense_tier': t.defense_tier if t else 1,
                'defense_points': float(t.defense_points) if t else 100.0,
                'is_control_tower': bool(t.is_control_tower) if t else False,
                'is_landmark': False, 'is_under_attack': False,
                'ad_slot_enabled': False, 'landmark_name': None,
                'place_name': getattr(t, 'place_name', None),
                'center_lat': geo[0], 'center_lon': geo[1],
                'boundary_points': boundary,
                'resource_food': float(getattr(t, 'resource_food', 10)),
                'resource_energy': float(getattr(t, 'resource_energy', 10)),
                'resource_credits': float(getattr(t, 'resource_credits', 10)),
                'resource_materials': float(getattr(t, 'resource_materials', 10)),
                'resource_intel': float(getattr(t, 'resource_intel', 5)),
                'food_per_tick': float(getattr(t, 'resource_food', 10)),
                'rarity': getattr(t, 'rarity', 'common'),
                'nft_version': getattr(t, 'nft_version', 1),
                'token_id': getattr(t, 'token_id', None),
                'is_shiny': bool(getattr(t, 'is_shiny', False)),
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
                neighbors = h3lib.k_ring(h3_index, 1) - {h3_index}
                owned = Territory.objects.filter(
                    h3_index__in=list(neighbors),
                    owner=request.user
                ).count()
                adjacent_owned = owned
                # Also check distance to any owned territory
                all_owned = Territory.objects.filter(owner=request.user).values_list('h3_index', flat=True)[:50]
                for oh in all_owned:
                    try:
                        d = h3lib.h3_distance(h3_index, oh)
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
            dist_nearest = min((h3lib.h3_distance(h3_index, oh) for oh in owned), default=999)
        except: dist_nearest = 5

        dist_mult = 1 + math.log2(max(1, dist_nearest)) if dist_nearest < 999 else 3.0
        try:
            import h3 as h3lib
            neighbors = h3lib.k_ring(h3_index, 1) - {h3_index}
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
            neighbors = h3lib.k_ring(h3_index, 1) - {h3_index}
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
            if not h3.h3_is_valid(h3_index):
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
                lat, lon = h3.h3_to_geo(h3_index)
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
