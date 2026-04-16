"""
NewsEvent — Real-world news articles converted to geolocalized territory tokens.

Flow:
  1. Management command `fetch_news` calls a news API (NewsAPI.org / GNews)
  2. Each article is geocoded (city/country → lat/lon)
  3. Article mapped to HEXOD category + rarity based on topic/magnitude
  4. Players register for events → on event end, luck skill determines loot
  5. Won tokens can be placed on adjacent territories
"""
import uuid
import hashlib
from django.db import models
from django.conf import settings
from django.utils import timezone


class NewsEvent(models.Model):
    """A real-world news article turned into a game event with a geolocalized token."""

    class Rarity(models.TextChoices):
        COMMON = 'common', 'Common'
        UNCOMMON = 'uncommon', 'Uncommon'
        RARE = 'rare', 'Rare'
        EPIC = 'epic', 'Epic'
        LEGENDARY = 'legendary', 'Legendary'
        MYTHIC = 'mythic', 'Mythic'

    class Status(models.TextChoices):
        LIVE = 'live', 'Live'           # Currently open for registration
        UPCOMING = 'upcoming', 'Upcoming'  # Starts soon
        ENDED = 'ended', 'Ended'         # Rewards distributed
        EXPIRED = 'expired', 'Expired'   # No one registered, auto-expired

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    # ── News source data ──
    source_url = models.URLField(max_length=512, unique=True)
    source_name = models.CharField(max_length=100, default='')
    headline = models.CharField(max_length=300)
    summary = models.TextField(default='')
    image_url = models.URLField(max_length=512, blank=True, default='')
    published_at = models.DateTimeField()

    # ── Geolocation ──
    location_name = models.CharField(max_length=200, default='GLOBAL')
    latitude = models.FloatField(default=0.0)
    longitude = models.FloatField(default=0.0)
    country_code = models.CharField(max_length=3, default='')

    # ── Game mapping ──
    hexod_category = models.CharField(max_length=30, default='news')  # matches radarIconData id
    rarity = models.CharField(max_length=12, choices=Rarity.choices, default=Rarity.RARE)
    status = models.CharField(max_length=12, choices=Status.choices, default=Status.LIVE)
    hex_reward = models.IntegerField(default=50)
    max_participants = models.IntegerField(default=500)
    registration_cost = models.IntegerField(default=25)  # HEX coins

    # ── Timing ──
    starts_at = models.DateTimeField()
    ends_at = models.DateTimeField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'news_events'
        ordering = ['-starts_at']

    def __str__(self):
        return f"[{self.rarity}] {self.headline[:60]}"

    @property
    def is_active(self):
        now = timezone.now()
        return self.starts_at <= now <= self.ends_at and self.status == self.Status.LIVE

    @property
    def time_remaining(self):
        return max(0, int((self.ends_at - timezone.now()).total_seconds()))

    @property
    def registered_count(self):
        return self.registrations.count()

    def content_hash(self):
        """Dedup hash from source URL."""
        return hashlib.md5(self.source_url.encode()).hexdigest()[:16]


class NewsEventRegistration(models.Model):
    """Player registration for a news event."""

    class Result(models.TextChoices):
        PENDING = 'pending', 'Pending'
        WON = 'won', 'Won'
        LOST = 'lost', 'Lost'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    event = models.ForeignKey(NewsEvent, on_delete=models.CASCADE, related_name='registrations')
    player = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='event_registrations')
    registered_at = models.DateTimeField(auto_now_add=True)
    result = models.CharField(max_length=10, choices=Result.choices, default=Result.PENDING)
    hex_earned = models.IntegerField(default=0)
    token_serial = models.IntegerField(null=True, blank=True)
    luck_bonus = models.IntegerField(default=0)

    class Meta:
        db_table = 'news_event_registrations'
        unique_together = ('event', 'player')

    def __str__(self):
        return f"{self.player.username} → {self.event.headline[:30]} ({self.result})"
