"""
Alliance & Diplomacy models.
4 tiers: Solo < Squad(5) < Guild(25) < Federation(500)
"""
import uuid
from django.db import models
from django.conf import settings
from django.utils import timezone


class Alliance(models.Model):

    class AllianceTier(models.TextChoices):
        SQUAD = 'squad', 'Squad'
        GUILD = 'guild', 'Guild'
        FEDERATION = 'federation', 'Federation'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tag = models.CharField(max_length=6, unique=True, db_index=True)   # [TERRA]
    name = models.CharField(max_length=64, unique=True)
    description = models.TextField(blank=True)
    tier = models.CharField(max_length=12, choices=AllianceTier.choices, default=AllianceTier.SQUAD)
    banner_color = models.CharField(max_length=7, default='#1D9E75')
    banner_symbol = models.CharField(max_length=50, blank=True)
    leader = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='led_alliances')

    # Treasury (shared resource pool)
    treasury_energy = models.FloatField(default=0.0)
    treasury_food = models.FloatField(default=0.0)
    treasury_credits = models.FloatField(default=0.0)
    treasury_materials = models.FloatField(default=0.0)
    treasury_tdc = models.DecimalField(max_digits=20, decimal_places=6, default=0)

    # Stats
    total_territories = models.IntegerField(default=0)
    total_members = models.IntegerField(default=1)
    war_score = models.BigIntegerField(default=0)
    season_score = models.BigIntegerField(default=0)

    # Settings
    is_recruiting = models.BooleanField(default=True)
    min_rank_to_join = models.IntegerField(default=1)
    require_approval = models.BooleanField(default=False)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'alliances'
        ordering = ['-war_score']

    @property
    def max_members(self) -> int:
        limits = {
            self.AllianceTier.SQUAD: 5,
            self.AllianceTier.GUILD: 25,
            self.AllianceTier.FEDERATION: 500,
        }
        return limits.get(self.tier, 5)


class AllianceMember(models.Model):

    class Role(models.TextChoices):
        LEADER = 'leader', 'Leader'
        OFFICER = 'officer', 'Officer'
        VETERAN = 'veteran', 'Veteran'
        MEMBER = 'member', 'Member'
        RECRUIT = 'recruit', 'Recruit'

    player = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='alliance_member'
    )
    alliance = models.ForeignKey(Alliance, on_delete=models.CASCADE, related_name='members')
    role = models.CharField(max_length=12, choices=Role.choices, default=Role.RECRUIT)

    # Contribution tracking
    resources_contributed = models.JSONField(default=dict)
    battles_fought_for_alliance = models.IntegerField(default=0)
    territories_taken_for_alliance = models.IntegerField(default=0)

    joined_at = models.DateTimeField(auto_now_add=True)
    promoted_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'alliance_members'


class DiplomaticRelation(models.Model):
    """Diplomatic state between two alliances."""

    class State(models.TextChoices):
        WAR = 'war', 'At War'
        CEASEFIRE = 'ceasefire', 'Ceasefire'
        NEUTRAL = 'neutral', 'Neutral'
        NAP = 'nap', 'Non-Aggression Pact'
        TRADE = 'trade', 'Trade Agreement'
        ALLIANCE = 'alliance', 'Allied'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    initiator = models.ForeignKey(Alliance, on_delete=models.CASCADE, related_name='diplomatic_initiated')
    target = models.ForeignKey(Alliance, on_delete=models.CASCADE, related_name='diplomatic_received')
    state = models.CharField(max_length=12, choices=State.choices, default=State.NEUTRAL)
    expires_at = models.DateTimeField(null=True, blank=True)
    established_at = models.DateTimeField(auto_now_add=True)
    terms = models.JSONField(default=dict)  # Treaty terms

    class Meta:
        db_table = 'diplomatic_relations'
        unique_together = ['initiator', 'target']


class AllianceOperation(models.Model):
    """Coordinated multi-player alliance military operation."""

    class OperationStatus(models.TextChoices):
        PLANNING = 'planning', 'Planning'
        ACTIVE = 'active', 'Active'
        COMPLETED = 'completed', 'Completed'
        CANCELLED = 'cancelled', 'Cancelled'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    alliance = models.ForeignKey(Alliance, on_delete=models.CASCADE)
    name = models.CharField(max_length=100)
    commander = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT)
    target_territory = models.ForeignKey('territories.Territory', on_delete=models.CASCADE, null=True)
    status = models.CharField(max_length=12, choices=OperationStatus.choices, default=OperationStatus.PLANNING)
    min_participants = models.IntegerField(default=5)
    starts_at = models.DateTimeField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'alliance_operations'


class AllianceChatMessage(models.Model):
    """Persistent alliance chat messages for history."""
    MSG_TYPES = [
        ('chat', 'Chat'), ('help', 'Help Request'),
        ('attack_plan', 'Attack Plan'), ('system', 'System'),
    ]

    alliance = models.ForeignKey(Alliance, on_delete=models.CASCADE, related_name='chat_messages')
    player = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    message_type = models.CharField(max_length=20, choices=MSG_TYPES, default='chat')
    text = models.TextField(max_length=500)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'alliance_chat_messages'
        ordering = ['-created_at']
        indexes = [models.Index(fields=['alliance', '-created_at'])]
