"""
POI API Views — Points of Interest endpoints.
"""
import logging
from django.utils import timezone
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.decorators import action
from rest_framework import viewsets

from terra_domini.apps.events.poi_models import WorldPOI, POIPlayerInteraction, POINewsUpdate

logger = logging.getLogger('terra_domini.pois')


class WorldPOIViewSet(viewsets.ReadOnlyModelViewSet):
    """Public POI endpoints — all POIs visible to all players."""
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return WorldPOI.objects.filter(status=WorldPOI.POIStatus.ACTIVE)

    @action(detail=False, methods=['GET'], url_path='map')
    def map_data(self, request):
        """
        GET /api/pois/map/?lat=26.5&lon=56.4&radius_km=1000
        Returns all active POIs for the map viewport.
        Lightweight format — just enough for map rendering.
        """
        try:
            lat = float(request.query_params.get('lat', 0))
            lon = float(request.query_params.get('lon', 0))
            radius_km = min(float(request.query_params.get('radius_km', 5000)), 20000)
        except (TypeError, ValueError):
            return Response({'error': 'Invalid params'}, status=400)

        # For now return all active POIs (geo filter can be added later with PostGIS)
        pois = WorldPOI.objects.filter(status=WorldPOI.POIStatus.ACTIVE).order_by(
            '-is_featured', '-threat_level'
        )

        data = []
        for poi in pois:
            data.append({
                'id': str(poi.id),
                'slug': poi.slug,
                'name': poi.name,
                'category': poi.category,
                'threat': poi.threat_level,
                'lat': poi.latitude,
                'lon': poi.longitude,
                'radius_km': poi.radius_km,
                'icon': poi.icon_emoji,
                'color': poi.icon_color,
                'pulse': poi.pulse,
                'featured': poi.is_featured,
                'effects_summary': _summarize_effects(poi.effects),
                'live': poi.is_live,
            })

        return Response({'pois': data, 'count': len(data)})

    @action(detail=False, methods=['GET'], url_path='featured')
    def featured(self, request):
        """GET /api/pois/featured/ — POIs for the news ticker (critical + featured)."""
        pois = WorldPOI.objects.filter(
            status=WorldPOI.POIStatus.ACTIVE,
            is_featured=True
        ).order_by('-threat_level', '-updated_at')[:10]

        return Response({
            'featured': [poi.get_game_briefing() for poi in pois],
            'server_time': timezone.now().isoformat(),
        })

    @action(detail=True, methods=['GET'], url_path='detail')
    def poi_detail(self, request, pk=None):
        """Full POI detail including news updates and current game effects."""
        try:
            poi = WorldPOI.objects.get(id=pk)
        except WorldPOI.DoesNotExist:
            return Response({'error': 'Not found'}, status=404)

        news = POINewsUpdate.objects.filter(poi=poi).order_by('-published_at')[:10]

        return Response({
            **poi.get_game_briefing(),
            'full_description': poi.description,
            'real_world_data': poi.real_world_data,
            'news_updates': [
                {
                    'headline': n.headline,
                    'body': n.body,
                    'url': n.source_url,
                    'impact': n.impact_change,
                    'published': n.published_at.isoformat(),
                }
                for n in news
            ],
            'controlling_alliance': (
                {'id': str(poi.controlling_alliance.id), 'tag': poi.controlling_alliance.tag}
                if poi.controlling_alliance else None
            ),
            'stabilize_progress': poi.stabilize_progress,
            'exploit_progress': poi.exploit_progress,
        })

    @action(detail=True, methods=['POST'], url_path='interact')
    def interact(self, request, pk=None):
        """
        POST /api/pois/{id}/interact/
        Body: {action: 'intel' | 'stabilize' | 'exploit', units: int}
        Send units on a mission to a POI.
        """
        try:
            poi = WorldPOI.objects.get(id=pk, status=WorldPOI.POIStatus.ACTIVE)
        except WorldPOI.DoesNotExist:
            return Response({'error': 'POI not found or inactive'}, status=404)

        action_type = request.data.get('action')
        units = int(request.data.get('units', 10))

        if action_type not in [c[0] for c in POIPlayerInteraction.ActionType.choices]:
            return Response({'error': 'Invalid action'}, status=400)

        # Calculate outcome
        outcome, tdc_earned, intel_gained = _calculate_poi_outcome(poi, action_type, units)

        interaction = POIPlayerInteraction.objects.create(
            poi=poi,
            player=request.user,
            action=action_type,
            units_deployed=units,
            tdc_earned=tdc_earned,
            intel_gained=intel_gained,
            outcome=outcome,
            completed_at=timezone.now(),
        )

        return Response({
            'outcome': outcome,
            'tdc_earned': float(tdc_earned),
            'intel_gained': intel_gained,
            'mission_id': str(interaction.id),
        })

    @action(detail=False, methods=['GET'], url_path='news-feed')
    def news_feed(self, request):
        """
        GET /api/pois/news-feed/
        Latest news updates from all active POIs — the in-game newspaper.
        """
        updates = POINewsUpdate.objects.filter(
            poi__status=WorldPOI.POIStatus.ACTIVE
        ).select_related('poi').order_by('-published_at')[:30]

        return Response({
            'news': [
                {
                    'poi_name': u.poi.name,
                    'poi_icon': u.poi.icon_emoji,
                    'poi_color': u.poi.icon_color,
                    'poi_category': u.poi.category,
                    'poi_threat': u.poi.threat_level,
                    'headline': u.headline,
                    'body': u.body[:200],
                    'url': u.source_url,
                    'impact': u.impact_change,
                    'published': u.published_at.isoformat(),
                    'poi_lat': u.poi.latitude,
                    'poi_lon': u.poi.longitude,
                }
                for u in updates
            ]
        })

    @action(detail=False, methods=['GET'], url_path='territory-effects')
    def territory_effects(self, request):
        """
        GET /api/pois/territory-effects/?h3={h3_index}
        Returns all active POI effects on a specific territory.
        Used to compute actual production rates shown in territory panel.
        """
        h3_index = request.query_params.get('h3', '')
        if not h3_index:
            return Response({'error': 'h3 required'}, status=400)

        try:
            import h3 as h3lib
            lat, lon = h3lib.h3_to_geo(h3_index)
        except Exception:
            return Response({'error': 'Invalid h3'}, status=400)

        active_pois = WorldPOI.objects.filter(status=WorldPOI.POIStatus.ACTIVE)
        applicable = []

        for poi in active_pois:
            # Check if territory center is within POI radius
            from math import radians, sin, cos, sqrt, atan2
            R = 6371
            dlat = radians(lat - poi.latitude)
            dlon = radians(lon - poi.longitude)
            a = sin(dlat/2)**2 + cos(radians(poi.latitude)) * cos(radians(lat)) * sin(dlon/2)**2
            dist_km = R * 2 * atan2(sqrt(a), sqrt(1-a))

            if dist_km <= poi.radius_km:
                applicable.append({
                    'poi_name': poi.name,
                    'poi_icon': poi.icon_emoji,
                    'distance_km': round(dist_km),
                    'effects': poi.effects,
                    'threat': poi.threat_level,
                })

        # Compute combined multipliers
        combined = {'energy': 1.0, 'food': 1.0, 'credits': 1.0, 'culture': 1.0, 'materials': 1.0, 'intel': 1.0}
        for ap in applicable:
            mults = ap['effects'].get('resource_multipliers', {})
            for resource, mult in mults.items():
                if resource in combined:
                    combined[resource] *= mult

        return Response({
            'h3': h3_index,
            'applicable_pois': applicable,
            'combined_multipliers': {k: round(v, 3) for k, v in combined.items()},
            'affected_by': len(applicable),
        })


# ─── Helper functions ─────────────────────────────────────────────────────────

def _summarize_effects(effects: dict) -> str:
    """One-line effect summary for map tooltip."""
    parts = []
    mults = effects.get('resource_multipliers', {})
    for resource, mult in mults.items():
        if mult < 0.8:
            parts.append(f"{resource} -{round((1-mult)*100)}%")
        elif mult > 1.2:
            parts.append(f"{resource} +{round((mult-1)*100)}%")
    if effects.get('trade_route_disrupted'):
        parts.append("trade disrupted")
    if effects.get('special_unit_unlock'):
        parts.append(f"{effects['special_unit_unlock']} units unlocked")
    return " · ".join(parts[:3]) if parts else "No active effects"


def _calculate_poi_outcome(poi, action_type: str, units: int) -> tuple[str, float, int]:
    """Calculate mission outcome. Returns (outcome_text, tdc_earned, intel_gained)."""
    import random

    base_intel = units * random.randint(2, 8)
    base_tdc = units * random.uniform(0.5, 2.0)

    intel_mult = poi.effects.get('resource_multipliers', {}).get('intel', 1.0)

    if action_type == 'intel':
        intel_gained = int(base_intel * intel_mult * 3)
        tdc_earned = base_tdc * 0.5
        outcome = f"Intel mission successful. Gathered {intel_gained} intel from {poi.name}."

    elif action_type == 'stabilize':
        intel_gained = int(base_intel * 0.5)
        tdc_earned = base_tdc * 2.0  # stabilization pays well
        poi.stabilize_progress = min(100, poi.stabilize_progress + units * 0.1)
        poi.save(update_fields=['stabilize_progress'])
        outcome = f"Stabilization force deployed. Progress: {poi.stabilize_progress:.1f}%"

    elif action_type == 'exploit':
        intel_gained = int(base_intel * 0.3)
        tdc_earned = base_tdc * 3.0  # high risk high reward
        success = random.random() > 0.4
        if success:
            poi.exploit_progress = min(100, poi.exploit_progress + units * 0.15)
            poi.save(update_fields=['exploit_progress'])
            outcome = f"Exploitation strike successful! TDC bonus secured."
        else:
            tdc_earned *= 0
            outcome = f"Exploitation failed — units repelled. No reward."

    else:
        intel_gained = 0; tdc_earned = 0; outcome = "Unknown action"

    return outcome, round(tdc_earned, 4), intel_gained
