import uuid
from django.db import models
from django.conf import settings
from django.utils import timezone


class ControlTowerEvent(models.Model):
    class EventStatus(models.TextChoices):
        SCHEDULED = 'scheduled', 'Scheduled'
        ACTIVE = 'active', 'Active'
        COMPLETED = 'completed', 'Completed'
        CANCELLED = 'cancelled', 'Cancelled'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    territory = models.ForeignKey(
        'territories.Territory', on_delete=models.CASCADE, related_name='tower_events'
    )
    status = models.CharField(max_length=12, choices=EventStatus.choices, default=EventStatus.SCHEDULED)
    announced_at = models.DateTimeField()
    starts_at = models.DateTimeField()
    ends_at = models.DateTimeField()
    min_participants = models.IntegerField(default=5)
    registered_alliances = models.ManyToManyField('alliances.Alliance', blank=True, related_name='registered_events')
    winning_alliance = models.ForeignKey(
        'alliances.Alliance', null=True, blank=True, on_delete=models.SET_NULL, related_name='tower_victories'
    )
    winner_score = models.IntegerField(default=0)
    total_participants = models.IntegerField(default=0)
    reward_bonus = models.JSONField(default=dict)

    class Meta:
        db_table = 'control_tower_events'
        ordering = ['starts_at']

    def time_until_start(self):
        return max(0, int((self.starts_at - timezone.now()).total_seconds()))


class WorldEvent(models.Model):
    class EventType(models.TextChoices):
        TRADE_DISRUPTION = 'trade_disruption', 'Trade Disruption'
        RESOURCE_SURGE = 'resource_surge', 'Resource Surge'
        MILITARY_MOBILIZATION = 'military_mobilization', 'Military Mobilization'
        NATURAL_DISASTER = 'natural_disaster', 'Natural Disaster'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=200)
    description = models.TextField()
    event_type = models.CharField(max_length=30, choices=EventType.choices)
    is_global = models.BooleanField(default=False)
    affected_countries = models.JSONField(default=list)
    effects = models.JSONField(default=dict)
    starts_at = models.DateTimeField()
    ends_at = models.DateTimeField()
    is_active = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'world_events'
        ordering = ['-starts_at']

# Import POI models so Django discovers them for migrations
from terra_domini.apps.events.poi_models import WorldPOI, POINewsUpdate

__all__ = ["ControlTowerEvent", "WorldEvent", "WorldPOI", "POINewsUpdate"]

from terra_domini.apps.events.poi_models_resources import ResourcePOI
__all_resources__ = ['ResourcePOI']
