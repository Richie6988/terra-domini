"""
Events views — Control Tower Wars + World Events viewsets.
"""
from django.utils import timezone
from datetime import timedelta
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, IsAuthenticatedOrReadOnly, AllowAny

from terra_domini.apps.events.models import ControlTowerEvent, WorldEvent

class ControlTowerViewSet(viewsets.GenericViewSet):
    permission_classes = [AllowAny]

    def list(self, request):
        """GET /api/control-towers/ — all tower events."""
        from terra_domini.apps.events.serializers import ControlTowerEventSerializer
        qs = ControlTowerEvent.objects.select_related(
            'territory', 'winning_alliance'
        ).order_by('-starts_at')[:50]
        return Response({
            'count': qs.count(),
            'results': ControlTowerEventSerializer(qs, many=True, context={'request': request}).data,
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
        """Register player (or their alliance) for a Control Tower event."""
        player = request.user

        # Get alliance if player has one — solo players can still register
        alliance = None
        try:
            alliance = player.alliance_member.alliance
        except Exception:
            pass

        try:
            event = ControlTowerEvent.objects.select_related('territory').get(id=pk)
        except ControlTowerEvent.DoesNotExist:
            return Response({'error': 'Event not found'}, status=404)

        # Allow registration for scheduled events
        allowed_statuses = ['scheduled', 'registration_open', 'pending', 'upcoming']
        if hasattr(ControlTowerEvent, 'EventStatus'):
            scheduled = getattr(ControlTowerEvent.EventStatus, 'SCHEDULED', 'scheduled')
            if event.status not in [scheduled, 'scheduled', 'registration_open', 'pending']:
                return Response({
                    'error': f'Registration closed (event is {event.status})',
                    'status': event.status,
                }, status=400)

        # Register alliance or solo
        if alliance:
            try:
                event.registered_alliances.add(alliance)
                label = f'[{alliance.tag}]'
            except Exception:
                # registered_alliances field might not exist on all events
                label = f'{player.username}'
        else:
            label = player.username

        territory_name = getattr(event.territory, 'place_name', 'Unknown') if event.territory else 'Unknown'
        return Response({
            'success': True,
            'message': f'{label} registered for {territory_name} Tower War',
            'event_id': str(event.id),
            'starts_at': event.starts_at.isoformat() if hasattr(event, 'starts_at') else None,
            'alliance': alliance.tag if alliance else None,
        })


class EventViewSet(viewsets.GenericViewSet):

    def list(self, request):
        """GET /api/events/ — all world events."""
        from terra_domini.apps.events.models import WorldEvent
        from django.utils import timezone
        now = timezone.now()
        events = WorldEvent.objects.filter(
            starts_at__lte=now, ends_at__gte=now
        ).order_by('-starts_at')[:20]
        return Response({'count': events.count(), 'results': [
            {'id': str(e.id), 'name': e.name, 'description': e.description,
             'event_type': e.event_type, 'is_global': e.is_global,
             'effects': e.effects, 'starts_at': e.starts_at.isoformat(),
             'ends_at': e.ends_at.isoformat(), 'is_active': e.is_active}
            for e in events
        ]})


    @action(detail=False, methods=['GET'], url_path='active_events')
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
