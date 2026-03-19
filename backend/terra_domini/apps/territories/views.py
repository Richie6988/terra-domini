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
from terra_domini.apps.territories.serializers import TerritorySerializer, TerritoryDetailSerializer

logger = logging.getLogger('terra_domini.territories')


class TerritoryViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = TerritorySerializer
    filterset_fields = ['territory_type', 'country_code', 'is_control_tower']

    def get_queryset(self):
        return Territory.objects.select_related('owner', 'alliance').all()

    def get_serializer_class(self):
        if self.action == 'retrieve':
            return TerritoryDetailSerializer
        return TerritorySerializer

    # ── Map viewport query ────────────────────────────────────────────────────
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

        territory.owner = request.user
        territory.captured_at = timezone.now()
        territory.save(update_fields=['owner', 'captured_at'])

        # Update player stats
        from terra_domini.apps.accounts.models import PlayerStats
        PlayerStats.objects.filter(player=request.user).update(
            territories_owned=Territory.objects.filter(owner=request.user).count(),
            territories_captured=request.user.stats.territories_captured + 1 if hasattr(request.user, 'stats') else 1,
        )

        logger.info(f"Territory claimed: {h3_index} by {request.user.username}")

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
            'territories': TerritorySerializer(territories, many=True).data,
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
