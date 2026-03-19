"""
Events views — Control Tower Wars + World Events viewsets.
"""
from django.utils import timezone
from datetime import timedelta
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from terra_domini.apps.events.models import ControlTowerEvent, WorldEvent

class ControlTowerViewSet(viewsets.GenericViewSet):
    permission_classes = [IsAuthenticated]

    def list(self, request):
        """GET /api/control-towers/ — all tower events."""
        from terra_domini.apps.events.serializers import ControlTowerEventSerializer
        qs = ControlTowerEvent.objects.select_related(
            'territory', 'winning_alliance'
        ).order_by('-starts_at')[:50]
        return Response({
            'count': qs.count(),
            'results': ControlTowerEventSerializer(qs, many=True).data,
        })


    @action(detail=False, methods=['GET'], url_path='upcoming')
    def upcoming(self, request):
        """Next 24h of Control Tower events."""
        now = timezone.now()
        from datetime import timedelta
        events = ControlTowerEvent.objects.filter(
            starts_at__gte=now,
            starts_at__lte=now + timedelta(hours=24),
            status__in=[ControlTowerEvent.EventStatus.SCHEDULED, ControlTowerEvent.EventStatus.ACTIVE]
        ).select_related('territory', 'winning_alliance')[:20]

        data = [{
            'id': str(e.id),
            'territory_h3': e.territory_id,
            'territory_name': e.territory.place_name,
            'status': e.status,
            'starts_at': e.starts_at.isoformat(),
            'ends_at': e.ends_at.isoformat(),
            'time_until_start': e.time_until_start(),
            'min_participants': e.min_participants,
            'reward_bonus': e.reward_bonus,
        } for e in events]

        return Response({'events': data})

    @action(detail=True, methods=['POST'], url_path='register')
    def register(self, request, pk=None):
        """Register alliance for a Control Tower event."""
        player = request.user
        try:
            alliance = player.alliance_member.alliance
        except Exception:
            return Response({'error': 'Must be in an alliance to register'}, status=403)

        try:
            event = ControlTowerEvent.objects.get(
                id=pk,
                status=ControlTowerEvent.EventStatus.SCHEDULED
            )
        except ControlTowerEvent.DoesNotExist:
            return Response({'error': 'Event not found or already started'}, status=404)

        event.registered_alliances.add(alliance)
        return Response({'message': f'[{alliance.tag}] registered for {event.territory.place_name} tower event'})


class EventViewSet(viewsets.GenericViewSet):

    @action(detail=False, methods=['GET'], url_path='active')
    def active_events(self, request):
        """All currently active world events."""
        now = timezone.now()
        events = WorldEvent.objects.filter(
            is_active=True,
            starts_at__lte=now,
            ends_at__gte=now,
        )
        data = [{
            'id': str(e.id),
            'name': e.name,
            'description': e.description,
            'type': e.event_type,
            'is_global': e.is_global,
            'affected_countries': e.affected_countries,
            'effects': e.effects,
            'ends_at': e.ends_at.isoformat(),
        } for e in events]

        return Response({'events': data})
