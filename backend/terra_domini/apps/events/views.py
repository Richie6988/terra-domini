"""
Events — Control Tower Wars + World Events system.
"""
import uuid
from django.db import models
from django.conf import settings
from django.utils import timezone
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response


class ControlTowerEvent(models.Model):
    """Timed capture window for a Control Tower territory."""

    class EventStatus(models.TextChoices):
        SCHEDULED = 'scheduled', 'Scheduled'
        ACTIVE = 'active', 'Active'
        COMPLETED = 'completed', 'Completed'
        CANCELLED = 'cancelled', 'Cancelled'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    territory = models.ForeignKey(
        'territories.Territory',
        on_delete=models.CASCADE,
        related_name='tower_events',
        limit_choices_to={'is_control_tower': True}
    )
    status = models.CharField(max_length=12, choices=EventStatus.choices, default=EventStatus.SCHEDULED)
    announced_at = models.DateTimeField()
    starts_at = models.DateTimeField()
    ends_at = models.DateTimeField()

    # Participants
    min_participants = models.IntegerField(default=5)
    registered_alliances = models.ManyToManyField('alliances.Alliance', blank=True, related_name='registered_events')

    # Outcome
    winning_alliance = models.ForeignKey(
        'alliances.Alliance', null=True, blank=True,
        on_delete=models.SET_NULL, related_name='tower_victories'
    )
    winner_score = models.IntegerField(default=0)
    total_participants = models.IntegerField(default=0)

    # Rewards (applied to winning alliance territories in region)
    reward_bonus = models.JSONField(default=dict)  # e.g. {"credits": 2.0, "duration_hours": 168}

    class Meta:
        db_table = 'control_tower_events'
        ordering = ['starts_at']

    def is_active(self) -> bool:
        now = timezone.now()
        return self.status == self.EventStatus.ACTIVE and self.starts_at <= now <= self.ends_at

    def time_until_start(self) -> int:
        delta = self.starts_at - timezone.now()
        return max(0, int(delta.total_seconds()))


class WorldEvent(models.Model):
    """Dynamic world event affecting gameplay globally or regionally."""

    class EventType(models.TextChoices):
        TRADE_DISRUPTION = 'trade_disruption', 'Trade Disruption'
        RESOURCE_SURGE = 'resource_surge', 'Resource Surge'
        MILITARY_MOBILIZATION = 'military_mobilization', 'Military Mobilization'
        DIPLOMATIC_SUMMIT = 'diplomatic_summit', 'Diplomatic Summit'
        NATURAL_DISASTER = 'natural_disaster', 'Natural Disaster'
        TECH_BREAKTHROUGH = 'tech_breakthrough', 'Tech Breakthrough'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=200)
    description = models.TextField()
    event_type = models.CharField(max_length=30, choices=EventType.choices)

    # Geographic scope
    is_global = models.BooleanField(default=False)
    affected_countries = models.JSONField(default=list)
    affected_h3_cells = models.JSONField(default=list)

    # Effect
    effects = models.JSONField(default=dict)  # {resource_type: multiplier, duration_hours: N}

    starts_at = models.DateTimeField()
    ends_at = models.DateTimeField()
    is_active = models.BooleanField(default=False)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'world_events'
        ordering = ['-starts_at']


# ─── Views ───────────────────────────────────────────────────────────────────

class ControlTowerViewSet(viewsets.GenericViewSet):

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
