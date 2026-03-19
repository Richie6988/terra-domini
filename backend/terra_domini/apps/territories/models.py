"""
Territory models — PostGIS-free version for Codespace compatibility.
Geo fields stored as JSON strings when PostGIS unavailable.
"""
import uuid
from django.db import models
from django.conf import settings
from django.utils import timezone


class Territory(models.Model):

    class TerritoryType(models.TextChoices):
        URBAN      = 'urban',      'Urban'
        RURAL      = 'rural',      'Rural'
        INDUSTRIAL = 'industrial', 'Industrial'
        COASTAL    = 'coastal',    'Coastal'
        LANDMARK   = 'landmark',   'Landmark'
        FOREST     = 'forest',     'Forest'
        MOUNTAIN   = 'mountain',   'Mountain'
        WATER      = 'water',      'Water'
        DESERT     = 'desert',     'Desert'
        ARCTIC     = 'arctic',     'Arctic'

    class DefenseTier(models.IntegerChoices):
        OPEN      = 1, 'Open'
        PALISADE  = 2, 'Palisade'
        FORTRESS  = 3, 'Fortress'
        CITADEL   = 4, 'Citadel'
        BASTION   = 5, 'Bastion'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    # ── H3 Identity ───────────────────────────────────────────────────────────
    h3_index      = models.CharField(max_length=20, unique=True, db_index=True)
    h3_resolution = models.IntegerField(default=10)

    # ── Geo (PostGIS-free: store as JSON text) ────────────────────────────────
    # In prod with PostGIS: replace with PolygonField/PointField
    geom_geojson  = models.TextField(blank=True, default='')   # GeoJSON polygon
    center_lat    = models.FloatField(null=True, blank=True)
    center_lon    = models.FloatField(null=True, blank=True)

    # ── Classification ────────────────────────────────────────────────────────
    territory_type = models.CharField(max_length=20, choices=TerritoryType.choices, default=TerritoryType.RURAL)
    country_code   = models.CharField(max_length=3, blank=True, db_index=True)
    region_name    = models.CharField(max_length=100, blank=True)
    place_name     = models.CharField(max_length=200, blank=True)

    # ── Ownership ─────────────────────────────────────────────────────────────
    owner      = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name='territories')
    alliance   = models.ForeignKey('alliances.Alliance', null=True, blank=True, on_delete=models.SET_NULL, related_name='territories')
    captured_at = models.DateTimeField(null=True, blank=True)
    previous_owner = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name='lost_territories')

    # ── Defense ───────────────────────────────────────────────────────────────
    defense_tier         = models.IntegerField(choices=DefenseTier.choices, default=DefenseTier.OPEN)
    defense_points       = models.FloatField(default=100.0)
    max_defense_points   = models.FloatField(default=100.0)
    shield_expires_at    = models.DateTimeField(null=True, blank=True)
    fortification_level  = models.IntegerField(default=0)

    # ── Resources (per 5-min tick) ────────────────────────────────────────────
    resource_energy    = models.FloatField(default=10.0)
    resource_food      = models.FloatField(default=10.0)
    resource_credits   = models.FloatField(default=10.0)
    resource_culture   = models.FloatField(default=5.0)
    resource_materials = models.FloatField(default=5.0)
    resource_intel     = models.FloatField(default=2.0)

    # ── Stockpiles ────────────────────────────────────────────────────────────
    stockpile_energy    = models.FloatField(default=0.0)
    stockpile_food      = models.FloatField(default=0.0)
    stockpile_credits   = models.FloatField(default=0.0)
    stockpile_culture   = models.FloatField(default=0.0)
    stockpile_materials = models.FloatField(default=0.0)
    stockpile_intel     = models.FloatField(default=0.0)
    stockpile_capacity  = models.FloatField(default=1000.0)

    # ── Terrain modifiers ─────────────────────────────────────────────────────
    terrain_attack_modifier   = models.FloatField(default=1.0)
    terrain_defense_modifier  = models.FloatField(default=1.0)
    terrain_movement_cost     = models.FloatField(default=1.0)

    # ── Control Tower ─────────────────────────────────────────────────────────
    is_control_tower   = models.BooleanField(default=False)
    control_tower_type = models.CharField(max_length=30, blank=True)
    is_landmark        = models.BooleanField(default=False)
    landmark_name      = models.CharField(max_length=200, blank=True)

    # ── Ad Marketplace ────────────────────────────────────────────────────────
    ad_slot_enabled   = models.BooleanField(default=False)
    daily_viewer_count = models.IntegerField(default=0)
    ad_revenue_today  = models.DecimalField(max_digits=14, decimal_places=4, default=0)

    # ── Timestamps ────────────────────────────────────────────────────────────
    created_at    = models.DateTimeField(auto_now_add=True)
    updated_at    = models.DateTimeField(auto_now=True)
    last_tick_at  = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'territories'
        verbose_name_plural = 'territories'
        indexes = [
            models.Index(fields=['owner']),
            models.Index(fields=['country_code']),
            models.Index(fields=['is_control_tower']),
        ]

    def __str__(self):
        return f"{self.place_name or self.h3_index} [{self.territory_type}] owner={self.owner}"

    @property
    def is_claimed(self):
        return self.owner is not None

    @property
    def is_shielded(self):
        return self.shield_expires_at and self.shield_expires_at > timezone.now()


class Building(models.Model):
    class BuildingType(models.TextChoices):
        FARM      = 'farm',      'Farm'
        MINE      = 'mine',      'Mine'
        MARKET    = 'market',    'Market'
        BARRACKS  = 'barracks',  'Barracks'
        FORT      = 'fort',      'Fort'
        ACADEMY   = 'academy',   'Academy'
        LAB       = 'lab',       'Lab'
        PORT      = 'port',      'Port'

    id          = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    territory   = models.ForeignKey(Territory, on_delete=models.CASCADE, related_name='buildings')
    building_type = models.CharField(max_length=20, choices=BuildingType.choices)
    level       = models.IntegerField(default=1)
    is_active   = models.BooleanField(default=True)
    built_at    = models.DateTimeField(auto_now_add=True)
    upgraded_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'territory_buildings'


class TradeRoute(models.Model):
    id         = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    from_territory = models.ForeignKey(Territory, on_delete=models.CASCADE, related_name='outgoing_routes')
    to_territory   = models.ForeignKey(Territory, on_delete=models.CASCADE, related_name='incoming_routes')
    resource_type  = models.CharField(max_length=20)
    amount_per_tick = models.FloatField(default=5.0)
    is_active      = models.BooleanField(default=True)
    created_at     = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'trade_routes'
