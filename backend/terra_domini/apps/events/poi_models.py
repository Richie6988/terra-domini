"""
World Points of Interest (POI) System
=====================================
POIs are special map markers linked to:
  - Permanent geographic landmarks (straits, capitals, monuments)
  - Live news-triggered events (conflicts, disasters, summits, elections)
  - Economic chokepoints (oil routes, trade lanes, shipping corridors)
  - Cultural moments (sports events, festivals, space launches)

When a real-world event is detected at a POI location, a WorldEvent is
triggered in-game, affecting resource production, military stats, or
trade routes in nearby territories for the event's duration.

The Strait of Hormuz crisis (Feb 28 – ongoing, 2026) is the first
live example: all coastal/industrial territories within 500km have
Energy production cut by 60% and Intel boosted by 300%.
"""
import uuid
from django.db import models
from django.conf import settings
from django.utils import timezone


class WorldPOI(models.Model):
    """
    A permanent or temporary Point of Interest on the world map.
    Shown as a special marker on top of the H3 hex grid.
    """

    class POICategory(models.TextChoices):
        # Strategic geography
        CHOKEPOINT     = 'chokepoint',    'Strategic Chokepoint'     # straits, canals, passes
        CAPITAL        = 'capital',       'National Capital'
        LANDMARK       = 'landmark',      'World Landmark'
        PORT           = 'port',          'Major Port'
        MILITARY_BASE  = 'military_base', 'Military Base'
        ENERGY         = 'energy',        'Energy Infrastructure'    # oil fields, pipelines
        # Live events
        CONFLICT_ZONE  = 'conflict_zone', 'Active Conflict Zone'
        DIPLOMATIC     = 'diplomatic',    'Diplomatic Event'         # summits, negotiations
        DISASTER       = 'disaster',      'Natural Disaster'
        ELECTION       = 'election',      'Election Event'
        ECONOMIC       = 'economic',      'Economic Crisis'
        CULTURAL       = 'cultural',      'Cultural Moment'          # World Cup, Olympics
        SPACE          = 'space',         'Space Event'              # launches, landings
        # Game-specific
        CONTROL_TOWER  = 'control_tower', 'Control Tower'
        TRADE_ROUTE    = 'trade_route',   'Trade Route Node'

    class POIStatus(models.TextChoices):
        ACTIVE   = 'active',   'Active'
        RESOLVED = 'resolved', 'Resolved'
        PENDING  = 'pending',  'Pending'

    class ThreatLevel(models.TextChoices):
        NONE     = 'none',     'None'
        LOW      = 'low',      'Low'
        MEDIUM   = 'medium',   'Medium'
        HIGH     = 'high',     'High'
        CRITICAL = 'critical', 'Critical'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    # ── Identity ────────────────────────────────────────────────────────────
    name        = models.CharField(max_length=200)
    slug        = models.SlugField(unique=True, max_length=100)
    description = models.TextField()
    category    = models.CharField(max_length=20, choices=POICategory.choices)
    status      = models.CharField(max_length=12, choices=POIStatus.choices, default=POIStatus.ACTIVE)
    threat_level= models.CharField(max_length=12, choices=ThreatLevel.choices, default=ThreatLevel.NONE)

    # ── Geography ────────────────────────────────────────────────────────────
    latitude  = models.FloatField()
    longitude = models.FloatField()
    h3_index  = models.CharField(max_length=20, blank=True)           # H3 res-10 of center point
    radius_km = models.FloatField(default=50.0)                       # affected area radius

    country_codes  = models.JSONField(default=list)   # ['IR', 'OM', 'AE'] for Hormuz
    affected_h3_cells = models.JSONField(default=list) # pre-computed hex list in radius

    # ── Real-world link ───────────────────────────────────────────────────────
    news_source_url   = models.URLField(blank=True)
    news_headline     = models.CharField(max_length=500, blank=True)
    wikipedia_url     = models.URLField(blank=True)
    real_world_data   = models.JSONField(default=dict)  # {oil_price: 105, ships_blocked: 15, ...}

    # ── Game effects ──────────────────────────────────────────────────────────
    # Applied to all territories within radius_km
    # Multipliers: 1.0 = no change, 0.5 = -50%, 2.0 = +100%
    effects = models.JSONField(default=dict)
    # Example for Hormuz:
    # {
    #   "resource_multipliers": {"energy": 0.4, "credits": 0.7, "intel": 3.0},
    #   "military_modifier": 1.5,          # troops cost more to maintain
    #   "trade_route_disrupted": true,
    #   "tdc_market_impact_pct": 15,       # TDC price up 15% (energy crisis = game coins scarce)
    #   "special_unit_unlock": "naval",    # unlocks naval units in region
    #   "mission_bonus_type": "intel",     # intel missions pay 3x in zone
    # }

    # ── Display ───────────────────────────────────────────────────────────────
    icon_emoji  = models.CharField(max_length=10, default='📍')
    icon_color  = models.CharField(max_length=7, default='#FF3B30')   # hex color
    pulse       = models.BooleanField(default=False)                   # animated pulse on map
    is_featured = models.BooleanField(default=False)                   # shown in news ticker

    # ── Timing ────────────────────────────────────────────────────────────────
    event_started_at  = models.DateTimeField(null=True, blank=True)
    event_ends_at     = models.DateTimeField(null=True, blank=True)    # null = ongoing
    created_at        = models.DateTimeField(auto_now_add=True)
    updated_at        = models.DateTimeField(auto_now=True)

    # ── Game interaction ──────────────────────────────────────────────────────
    # Players can send units to "stabilize" or "exploit" a POI
    stabilize_progress = models.FloatField(default=0.0)  # 0-100%
    exploit_progress   = models.FloatField(default=0.0)
    controlling_alliance = models.ForeignKey(
        'alliances.Alliance', null=True, blank=True,
        on_delete=models.SET_NULL, related_name='controlled_pois'
    )

    class Meta:
        db_table = 'world_pois'
        ordering = ['-is_featured', '-threat_level', '-created_at']
        indexes = [
            models.Index(fields=['category', 'status']),
            models.Index(fields=['latitude', 'longitude']),
            models.Index(fields=['is_featured']),
        ]

    def __str__(self):
        return f"{self.icon_emoji} {self.name} [{self.category}] — {self.status}"

    @property
    def is_live(self) -> bool:
        if self.status != self.POIStatus.ACTIVE:
            return False
        if self.event_ends_at and timezone.now() > self.event_ends_at:
            return False
        return True

    def get_game_briefing(self) -> dict:
        """Player-facing briefing for the news ticker."""
        return {
            'id': str(self.id),
            'name': self.name,
            'icon': self.icon_emoji,
            'color': self.icon_color,
            'category': self.category,
            'threat': self.threat_level,
            'description': self.description[:280],
            'effects': self.effects,
            'radius_km': self.radius_km,
            'lat': self.latitude,
            'lon': self.longitude,
            'started': self.event_started_at.isoformat() if self.event_started_at else None,
            'ends': self.event_ends_at.isoformat() if self.event_ends_at else None,
            'real_data': self.real_world_data,
            'news_url': self.news_source_url,
            'pulse': self.pulse,
        }


class POIPlayerInteraction(models.Model):
    """Player actions on a POI (sending intel units, stabilizing, exploiting)."""

    class ActionType(models.TextChoices):
        INTEL_MISSION  = 'intel',      'Intel Mission'
        STABILIZE      = 'stabilize',  'Stabilization Force'
        EXPLOIT        = 'exploit',    'Exploitation Strike'
        TRADE_MISSION  = 'trade',      'Trade Mission'

    id     = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    poi    = models.ForeignKey(WorldPOI, on_delete=models.CASCADE, related_name='interactions')
    player = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    action = models.CharField(max_length=20, choices=ActionType.choices)
    units_deployed = models.IntegerField(default=0)
    tdc_earned     = models.DecimalField(max_digits=12, decimal_places=4, default=0)
    intel_gained   = models.IntegerField(default=0)
    outcome        = models.CharField(max_length=100, blank=True)
    created_at     = models.DateTimeField(auto_now_add=True)
    completed_at   = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'poi_player_interactions'


class POINewsUpdate(models.Model):
    """Append-only news log for a POI — shows in the in-game news feed."""
    id         = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    poi        = models.ForeignKey(WorldPOI, on_delete=models.CASCADE, related_name='news_updates')
    headline   = models.CharField(max_length=500)
    body       = models.TextField(blank=True)
    source_url = models.URLField(blank=True)
    impact_change = models.JSONField(default=dict)   # what game effects changed this update
    published_at  = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'poi_news_updates'
        ordering = ['-published_at']
