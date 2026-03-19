"""
Territory models — core game world entities.
H3 hex index + PostGIS geometry for all spatial queries.
"""
import uuid
from django.contrib.gis.db import models as gis_models
from django.db import models
from django.conf import settings
from django.utils import timezone


class Territory(models.Model):
    """
    A single H3 hexagonal territory cell.
    Resolution 10 by default (~150m edge length, ~65,000m² area).
    Represents the atomic unit of the game world.
    """

    class TerritoryType(models.TextChoices):
        URBAN = 'urban', 'Urban'
        RURAL = 'rural', 'Rural'
        INDUSTRIAL = 'industrial', 'Industrial'
        COASTAL = 'coastal', 'Coastal'
        LANDMARK = 'landmark', 'Landmark'
        MOUNTAIN = 'mountain', 'Mountain'
        FOREST = 'forest', 'Forest'
        WATER = 'water', 'Water'  # lakes, rivers — uncapturable

    class DefenseTier(models.IntegerChoices):
        OUTPOST = 1, 'Outpost'
        FORT = 2, 'Fort'
        CITADEL = 3, 'Citadel'
        FORTRESS = 4, 'Fortress'
        STRONGHOLD = 5, 'Stronghold'

    # ─── Identity ─────────────────────────────────────────────────────────────
    h3_index = models.CharField(max_length=20, primary_key=True, db_index=True)
    h3_resolution = models.PositiveSmallIntegerField(default=10)

    # PostGIS geometry — H3 hex polygon
    geom = gis_models.PolygonField(srid=4326, null=True, blank=True)
    center = gis_models.PointField(srid=4326, null=True, blank=True)

    # Real-world metadata from OSM
    territory_type = models.CharField(max_length=20, choices=TerritoryType.choices, default=TerritoryType.RURAL)
    country_code = models.CharField(max_length=3, blank=True, db_index=True)
    region_name = models.CharField(max_length=100, blank=True)
    place_name = models.CharField(max_length=200, blank=True)
    elevation_meters = models.FloatField(default=0.0)
    population_density = models.FloatField(default=0.0)  # per km²
    land_use = models.CharField(max_length=50, blank=True)  # OSM land_use tag

    # ─── Ownership ────────────────────────────────────────────────────────────
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True, blank=True,
        on_delete=models.SET_NULL,
        related_name='territories'
    )
    alliance = models.ForeignKey(
        'alliances.Alliance',
        null=True, blank=True,
        on_delete=models.SET_NULL,
        related_name='territories'
    )
    captured_at = models.DateTimeField(null=True, blank=True)
    previous_owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True, blank=True,
        on_delete=models.SET_NULL,
        related_name='lost_territories'
    )

    # ─── Defense & Buildings ──────────────────────────────────────────────────
    defense_tier = models.PositiveSmallIntegerField(
        choices=DefenseTier.choices, default=DefenseTier.OUTPOST
    )
    defense_points = models.IntegerField(default=100)
    max_defense_points = models.IntegerField(default=100)
    fortification_level = models.PositiveSmallIntegerField(default=0)

    # ─── Resources ────────────────────────────────────────────────────────────
    # Base production rates (per tick, 5 min intervals)
    resource_energy = models.FloatField(default=0.0)
    resource_food = models.FloatField(default=0.0)
    resource_credits = models.FloatField(default=0.0)
    resource_culture = models.FloatField(default=0.0)
    resource_materials = models.FloatField(default=0.0)
    resource_intel = models.FloatField(default=0.0)

    # Accumulated stockpile
    stockpile_energy = models.FloatField(default=0.0)
    stockpile_food = models.FloatField(default=0.0)
    stockpile_credits = models.FloatField(default=0.0)
    stockpile_culture = models.FloatField(default=0.0)
    stockpile_materials = models.FloatField(default=0.0)
    stockpile_intel = models.FloatField(default=0.0)

    # Max stockpile capacity (scales with defense tier)
    stockpile_capacity = models.FloatField(default=1000.0)

    # ─── Advertising ──────────────────────────────────────────────────────────
    daily_viewer_count = models.IntegerField(default=0)
    ad_slot_enabled = models.BooleanField(default=False)
    ad_slot_tier = models.PositiveSmallIntegerField(default=0)  # 0-5
    ad_cpm_rate = models.DecimalField(max_digits=10, decimal_places=4, default=0)
    active_ad_campaign = models.ForeignKey(
        'economy.AdCampaign',
        null=True, blank=True,
        on_delete=models.SET_NULL,
        related_name='territories'
    )

    # ─── Special properties ───────────────────────────────────────────────────
    is_control_tower = models.BooleanField(default=False, db_index=True)
    control_tower_type = models.CharField(max_length=20, blank=True)
    is_capital = models.BooleanField(default=False)
    is_landmark = models.BooleanField(default=False)
    landmark_name = models.CharField(max_length=200, blank=True)
    landmark_bonus = models.JSONField(default=dict)  # {resource_type: multiplier}

    # ─── Terrain modifiers (computed from OSM/elevation) ─────────────────────
    terrain_attack_modifier = models.FloatField(default=1.0)
    terrain_defense_modifier = models.FloatField(default=1.0)
    terrain_movement_cost = models.FloatField(default=1.0)

    # ─── State ────────────────────────────────────────────────────────────────
    is_under_attack = models.BooleanField(default=False, db_index=True)
    current_battle = models.OneToOneField(
        'combat.Battle',
        null=True, blank=True,
        on_delete=models.SET_NULL,
        related_name='territory_ref'
    )
    last_tick = models.DateTimeField(default=timezone.now)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    # Visibility count (for ad traffic scoring)
    view_count_today = models.IntegerField(default=0)
    view_count_total = models.BigIntegerField(default=0)

    class Meta:
        db_table = 'territories'
        indexes = [
            models.Index(fields=['owner']),
            models.Index(fields=['alliance']),
            models.Index(fields=['country_code', 'territory_type']),
            models.Index(fields=['is_control_tower']),
            models.Index(fields=['is_under_attack']),
            gis_models.Index(fields=['geom'], name='territory_geom_idx'),
        ]
        verbose_name_plural = 'territories'

    def __str__(self):
        name = self.place_name or self.h3_index
        owner = self.owner.username if self.owner else 'unclaimed'
        return f"{name} ({owner})"

    @property
    def defense_strength(self) -> float:
        """Effective defense including fortification and terrain."""
        base = self.defense_points * (1 + self.fortification_level * 0.1)
        return base * self.terrain_defense_modifier

    def get_production_rates(self) -> dict:
        """Resource production per tick with all modifiers applied."""
        base = {
            'energy': self.resource_energy,
            'food': self.resource_food,
            'credits': self.resource_credits,
            'culture': self.resource_culture,
            'materials': self.resource_materials,
            'intel': self.resource_intel,
        }
        # Apply landmark bonus
        if self.landmark_bonus:
            for resource, multiplier in self.landmark_bonus.items():
                if resource in base:
                    base[resource] *= multiplier
        return base

    def can_be_attacked_by(self, attacker) -> tuple[bool, str]:
        """Returns (can_attack, reason)."""
        if not self.owner:
            return True, ""
        if self.owner == attacker:
            return False, "own_territory"
        if self.owner.is_protected:
            return False, "target_protected"
        if self.is_under_attack:
            return False, "already_under_attack"
        # Check alliance peace treaty
        if self.alliance and attacker.alliance_member:
            member_alliance = attacker.alliance_member.alliance
            if member_alliance == self.alliance:
                return False, "same_alliance"
        return True, ""


class Building(models.Model):
    """Buildings on a territory that modify its properties."""

    class BuildingType(models.TextChoices):
        # Production
        FARM = 'farm', 'Farm'
        MINE = 'mine', 'Mine'
        POWER_PLANT = 'power_plant', 'Power Plant'
        FACTORY = 'factory', 'Factory'
        MARKET = 'market', 'Market'
        CULTURE_CENTER = 'culture_center', 'Culture Center'
        INTEL_HQ = 'intel_hq', 'Intel HQ'
        # Military
        BARRACKS = 'barracks', 'Barracks'
        ARMORY = 'armory', 'Armory'
        RADAR = 'radar', 'Radar Tower'
        # Special
        CONTROL_TOWER = 'control_tower', 'Control Tower'
        TRADE_DEPOT = 'trade_depot', 'Trade Depot'
        AD_BILLBOARD = 'ad_billboard', 'Ad Billboard'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    territory = models.ForeignKey(Territory, on_delete=models.CASCADE, related_name='buildings')
    building_type = models.CharField(max_length=30, choices=BuildingType.choices)
    level = models.PositiveSmallIntegerField(default=1)
    is_operational = models.BooleanField(default=True)

    # Construction state
    under_construction = models.BooleanField(default=False)
    construction_ends_at = models.DateTimeField(null=True, blank=True)
    construction_started_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL
    )

    # Effects (JSON for flexibility)
    effects = models.JSONField(default=dict)
    # e.g. {"resource_bonus": {"food": 0.5}, "defense_bonus": 0.2}

    built_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'buildings'
        indexes = [
            models.Index(fields=['territory', 'building_type']),
        ]

    @property
    def is_complete(self) -> bool:
        if not self.under_construction:
            return True
        return timezone.now() >= self.construction_ends_at


class TerritoryOwnershipHistory(models.Model):
    """Immutable log of all territory ownership changes."""
    territory = models.ForeignKey(Territory, on_delete=models.CASCADE, related_name='history')
    previous_owner = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL, related_name='+'
    )
    new_owner = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL, related_name='+'
    )
    change_type = models.CharField(max_length=20)  # 'claimed', 'conquered', 'abandoned'
    battle = models.ForeignKey('combat.Battle', null=True, on_delete=models.SET_NULL)
    timestamp = models.DateTimeField(auto_now_add=True)
    metadata = models.JSONField(default=dict)

    class Meta:
        db_table = 'territory_ownership_history'
        ordering = ['-timestamp']


class TradeRoute(models.Model):
    """Active trade route between two adjacent territories."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    source_territory = models.ForeignKey(
        Territory, on_delete=models.CASCADE, related_name='outbound_routes'
    )
    target_territory = models.ForeignKey(
        Territory, on_delete=models.CASCADE, related_name='inbound_routes'
    )
    resource_type = models.CharField(max_length=20)
    amount_per_tick = models.FloatField()
    is_active = models.BooleanField(default=True)
    disrupted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'trade_routes'
        unique_together = ['source_territory', 'target_territory', 'resource_type']
