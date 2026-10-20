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
    # Forces (combat/forces.py): attack / defense / spy points stored on the hex; a kingdom's counter = sum of its hexes
    atk_pts = models.IntegerField(default=0)
    def_pts = models.IntegerField(default=0)
    spy_pts = models.IntegerField(default=0)
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
    token_id = models.BigIntegerField(null=True, blank=True, db_index=True, help_text="Polygon NFT token ID")
    token_minted_at = models.DateTimeField(null=True, blank=True)
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


    # ── Hexod GDD core fields (exist in DB, were missing from ORM) ───────────
    rarity            = models.CharField(max_length=12, default='common',
        choices=[('common','Common'),('uncommon','Uncommon'),('rare','Rare'),
                 ('epic','Epic'),('legendary','Legendary'),('mythic','Mythic')])
    biome             = models.CharField(max_length=20, default='grassland')
    terrain_source    = models.CharField(max_length=20, blank=True, default='')   # 'worldcover' = measured (landcover.py)
    elevation_m       = models.IntegerField(null=True, blank=True)
    tdc_per_day       = models.FloatField(default=10.0)
    poi_name          = models.CharField(max_length=200, blank=True, default='')
    poi_wiki_url      = models.CharField(max_length=500, blank=True, default='')
    is_shiny          = models.BooleanField(default=False)
    nft_version       = models.IntegerField(default=1)
    mint_cooldown_until = models.DateTimeField(null=True, blank=True)
    shield_until      = models.DateTimeField(null=True, blank=True)
    # Customisation
    custom_name       = models.CharField(max_length=80, null=True, blank=True)
    custom_emoji      = models.CharField(max_length=8, null=True, blank=True)
    border_color      = models.CharField(max_length=7, null=True, blank=True)
    fill_color        = models.CharField(max_length=7, null=True, blank=True)
    hex_type          = models.CharField(max_length=20, default='standard',
        choices=[('standard','Standard'),('resource','Ressource'),('poi','POI'),('strategic','Stratégique')])
    is_connected      = models.BooleanField(default=False)
    cluster_bonus_pct = models.DecimalField(max_digits=5, decimal_places=2, default=0)

    # ── Hidden Resource Discovery ──────────────────────────────────────────
    # Each territory may hide a sub-surface resource (oil, minerals, etc.)
    # Revealed when player scouts with intel units or clicker bonus
    hidden_resource_type   = models.CharField(max_length=30, blank=True)  # category from ResourceCategory
    hidden_resource_amount = models.FloatField(default=0)   # bonus_pct if mined
    hidden_resource_found  = models.BooleanField(default=False)
    hidden_resource_rarity = models.CharField(max_length=12, default='common')

    # Combat state — set by CombatEngine
    is_under_attack = models.BooleanField(default=False)
    current_battle  = models.UUIDField(null=True, blank=True)

    # Hexod GDD Resources (Section 5)
    res_fer           = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    res_cuivre        = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    res_aluminium     = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    res_acier         = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    res_titanium      = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    res_petrole       = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    res_gaz           = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    res_charbon       = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    res_uranium       = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    res_silicium      = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    res_terres_rares  = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    res_composants    = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    res_donnees       = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    res_main_oeuvre   = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    res_nourriture    = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    res_eau           = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    res_influence     = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    res_stabilite     = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    res_hex_cristaux  = models.DecimalField(max_digits=12, decimal_places=4, default=0)
    # Hex type classification (GDD 2.2)
    hex_type          = models.CharField(max_length=20, default='standard',
        choices=[('standard','Standard'),('resource','Ressource'),('poi','POI'),('strategic','Stratégique')])
    is_connected      = models.BooleanField(default=False)  # part of connected cluster
    cluster_bonus_pct = models.DecimalField(max_digits=5, decimal_places=2, default=0)

    class Meta:
        db_table = 'territories'
        verbose_name_plural = 'territories'
        indexes = [
            models.Index(fields=['owner']),
            models.Index(fields=['country_code']),
            models.Index(fields=['token_id']),
        ]

    def __str__(self):
        return f"{self.place_name or self.h3_index} [{self.territory_type}] owner={self.owner}"

    @property
    def is_claimed(self):
        return self.owner is not None

    @property


    def is_available(self) -> bool:
        """Territory can be claimed (not owned, not under attack)."""
        return self.owner is None and not self.is_under_attack

    def get_production_rates(self) -> dict:
        """Returns per-tick resource production for this territory."""
        return {
            'energy':    float(self.resource_energy or 0),
            'food':      float(self.resource_food or 0),
            'credits':   float(self.resource_credits or 0),
            'culture':   float(self.resource_culture or 0),
            'materials': float(self.resource_materials or 0),
            'intel':     float(self.resource_intel or 0),
        }

    def is_shielded(self):
        if self.shield_until and self.shield_until > timezone.now():
            return True
        return self.shield_expires_at and self.shield_expires_at > timezone.now()

    @property
    def edition(self):
        return 'genesis'

    @property
    def resource_richness(self):
        return (self.tdc_per_day or 10) / 10.0

    @property
    def primary_resource(self):
        return self.biome or 'credits'

    def get_card_gradient(self):
        RARITY_GRAD = {
            'common':    ['#9CA3AF', '#4B5563'],
            'uncommon':  ['#10B981', '#065F46'],
            'rare':      ['#3B82F6', '#1E3A8A'],
            'epic':      ['#8B5CF6', '#4C1D95'],
            'legendary': ['#F59E0B', '#78350F'],
            'mythic':    ['#EC4899', '#831843'],
        }
        return RARITY_GRAD.get(self.rarity or 'common', RARITY_GRAD['common'])


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


# ─── Territory Customization ───────────────────────────────────────────────
class TerritoryCustomization(models.Model):
    """
    Unlocked based on contiguous cluster size.
    1 zone  → rename + emoji
    3 zones → embed image / background color
    6 zones → embed video URL
    10 zones→ live stream RTMP slot
    15 zones→ private chat room
    25 zones→ 3D metaverse portal
    50 zones→ premium ad placement
    """
    EMBED_TYPES = [
        ('none', 'None'),
        ('image', 'Image URL'),
        ('video', 'Video URL (YouTube/MP4)'),
        ('livestream', 'Live Stream'),
        ('chat', 'Private Chat Room'),
        ('metaverse', '3D Metaverse Portal'),
        ('ad_slot', 'Premium Ad Slot'),
    ]
    territory        = models.OneToOneField(Territory, on_delete=models.CASCADE, related_name='customization')
    display_name     = models.CharField(max_length=80, blank=True)
    flag_emoji       = models.CharField(max_length=8, blank=True)
    border_color     = models.CharField(max_length=7, default='#00FF87')  # hex
    fill_color       = models.CharField(max_length=7, blank=True)
    embed_type       = models.CharField(max_length=20, choices=EMBED_TYPES, default='none')
    embed_url        = models.URLField(blank=True)
    embed_title      = models.CharField(max_length=120, blank=True)
    chat_room_id     = models.CharField(max_length=36, blank=True)  # UUID
    ad_advertiser    = models.CharField(max_length=120, blank=True)
    ad_cpm_rate      = models.DecimalField(max_digits=8, decimal_places=4, default=0)
    ad_impressions   = models.BigIntegerField(default=0)
    ad_revenue_total = models.DecimalField(max_digits=12, decimal_places=4, default=0)
    unlocked_tier    = models.PositiveSmallIntegerField(default=0)  # cluster size when last updated
    updated_at       = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'territory_customization'


# ─── Map Overlay Events ─────────────────────────────────────────────────────
class MapOverlayEvent(models.Model):
    """
    Live geo-mapped events displayed as animated sublayer on the map.
    Troop movements, resource drops, war declarations, trade convoys,
    live news pins, player messages.
    """
    EVENT_TYPES = [
        ('troop_move', 'Troop Movement'),
        ('attack_wave', 'Attack Wave'),
        ('trade_convoy', 'Trade Convoy'),
        ('resource_drop', 'Resource Drop'),
        ('news_pin', 'Live News Pin'),
        ('player_msg', 'Player Message'),
        ('war_declaration', 'War Declaration'),
        ('alliance_rally', 'Alliance Rally'),
        ('tower_siege', 'Tower Siege'),
        ('airdrop', 'TDC Airdrop'),
    ]
    event_type   = models.CharField(max_length=20, choices=EVENT_TYPES)
    player       = models.ForeignKey('accounts.Player', null=True, blank=True, on_delete=models.SET_NULL)
    territory    = models.ForeignKey(Territory, null=True, blank=True, on_delete=models.SET_NULL)
    from_lat     = models.FloatField(null=True)
    from_lon     = models.FloatField(null=True)
    to_lat       = models.FloatField(null=True)
    to_lon       = models.FloatField(null=True)
    title        = models.CharField(max_length=160)
    body         = models.TextField(blank=True)
    icon_emoji   = models.CharField(max_length=8, default='📍')
    icon_3d      = models.CharField(max_length=60, blank=True)  # glTF asset key
    payload      = models.JSONField(default=dict)
    is_active    = models.BooleanField(default=True)
    starts_at    = models.DateTimeField(auto_now_add=True)
    expires_at   = models.DateTimeField(null=True)

    class Meta:
        db_table = 'map_overlay_event'
        ordering  = ['-starts_at']
        indexes   = [models.Index(fields=['event_type', 'is_active', 'expires_at'])]


# ─── Territory Cluster Cache ───────────────────────────────────────────────
class TerritoryCluster(models.Model):
    """
    Denormalized cache of contiguous territory clusters per player.
    Recomputed by Celery task on any territory capture/loss.
    Determines customization unlock tier.
    """
    player       = models.ForeignKey('accounts.Player', on_delete=models.CASCADE, related_name='clusters')
    cluster_id   = models.CharField(max_length=36)   # UUID, stable across recomputes
    size         = models.PositiveIntegerField(default=1)
    centroid_lat = models.FloatField(default=0)
    centroid_lon = models.FloatField(default=0)
    unlock_tier  = models.PositiveSmallIntegerField(default=0)
    tdc_per_24h  = models.DecimalField(max_digits=10, decimal_places=4, default=0)
    tdi_per_24h  = models.DecimalField(max_digits=14, decimal_places=8, default=0)
    # Aggregate resources for this kingdom (sum of all member territories)
    agg_fer           = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    agg_petrole       = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    agg_silicium      = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    agg_donnees       = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    agg_uranium       = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    agg_hex_cristaux  = models.DecimalField(max_digits=12, decimal_places=4, default=0)
    agg_influence     = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    agg_stabilite     = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    agg_acier         = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    agg_terres_rares  = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    agg_composants    = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    is_main_kingdom   = models.BooleanField(default=False)   # True for the largest cluster
    poi_count         = models.IntegerField(default=0)        # number of POI territories
    hex_h3_index      = models.CharField(max_length=20, blank=True, default='')  # centroid hex
    last_payout  = models.DateTimeField(null=True)
    computed_at  = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'territory_cluster'
        unique_together = [('player', 'cluster_id')]


# ─── Resource Trade System ─────────────────────────────────────────────────
class ResourceTrade(models.Model):
    """
    Player-to-player resource trade or market listing.
    Two modes:
    - DIRECT: specific player offer (requires acceptance)
    - MARKET: listed on open market, first taker wins
    """
    TRADE_STATUS = [
        ('pending',   'Pending'),
        ('accepted',  'Accepted'),
        ('rejected',  'Rejected'),
        ('cancelled', 'Cancelled'),
        ('expired',   'Expired'),
        ('completed', 'Completed'),
    ]
    TRADE_MODES = [
        ('direct', 'Direct Trade'),
        ('market', 'Open Market'),
    ]
    RESOURCE_TYPES = [
        ('water',     '💧 Water'),
        ('food',      '🌾 Food'),
        ('energy',    '⚡ Energy'),
        ('credits',   '💰 Credits'),
        ('materials', '⚙️ Materials'),
        ('culture',   '🎭 Culture'),
        ('intel',     '🕵️ Intel'),
        ('tdc',       '🪙 TDC Coins'),
    ]

    id              = models.UUIDField(primary_key=True, default=__import__('uuid').uuid4, editable=False)
    mode            = models.CharField(max_length=10, choices=TRADE_MODES, default='market')
    status          = models.CharField(max_length=12, choices=TRADE_STATUS, default='pending')

    # Parties
    seller          = models.ForeignKey(
        'accounts.Player', on_delete=models.CASCADE, related_name='trades_selling')
    buyer           = models.ForeignKey(
        'accounts.Player', null=True, blank=True,
        on_delete=models.SET_NULL, related_name='trades_buying')

    # What's being traded
    offer_resource  = models.CharField(max_length=12, choices=RESOURCE_TYPES)
    offer_amount    = models.DecimalField(max_digits=12, decimal_places=2)

    # What seller wants in return
    request_resource = models.CharField(max_length=12, choices=RESOURCE_TYPES)
    request_amount   = models.DecimalField(max_digits=12, decimal_places=2)

    # Market price in TDC (auto-computed or manual)
    market_price_tdc = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    allow_tdc_purchase = models.BooleanField(default=True)  # can buy with TDC instead of resource

    # Metadata
    message         = models.CharField(max_length=200, blank=True)
    expires_at      = models.DateTimeField(null=True)
    created_at      = models.DateTimeField(auto_now_add=True)
    completed_at    = models.DateTimeField(null=True)

    class Meta:
        db_table = 'resource_trade'
        ordering = ['-created_at']
        indexes  = [
            models.Index(fields=['status', 'mode']),
            models.Index(fields=['offer_resource', 'status']),
        ]

    def __str__(self):
        return f"{self.seller.username}: {self.offer_amount} {self.offer_resource} → {self.request_amount} {self.request_resource}"

    @classmethod
    def market_rates(cls) -> dict:
        """TDC value per unit of each resource (based on supply/demand + world events)."""
        base = {
            'water':     8.0,    # Increasingly scarce
            'food':      5.0,
            'energy':    10.0,
            'credits':   1.0,    # Credits = near-money
            'materials': 7.0,
            'culture':   12.0,   # Rare to produce
            'intel':     20.0,   # High strategic value
            'tdc':       1.0,
        }
        # Apply world event modifiers
        try:
            from terra_domini.apps.events.poi_models import WorldEvent
            from django.utils import timezone
            active = WorldEvent.objects.filter(is_active=True).values_list('effects', flat=True)
            for effects in active:
                if isinstance(effects, dict):
                    mults = effects.get('resource_multipliers', {})
                    for res, mult in mults.items():
                        if res in base:
                            base[res] *= mult
        except Exception:
            pass
        return {k: round(v, 2) for k, v in base.items()}


# ── Kingdom ─────────────────────────────────────────────────────────────────
# A Kingdom = a contiguous cluster of territories. Skills are per-kingdom.
class KingdomSkill(models.Model):
    """
    Skill unlocked for a specific kingdom (cluster).
    Skills are lost if the kingdom is fragmented.
    The main kingdom (largest cluster) gets full tree access.
    Isolated territories start with empty tree.
    """
    player      = models.ForeignKey('accounts.Player', on_delete=models.CASCADE, related_name='kingdom_skills')
    cluster_id  = models.CharField(max_length=36)   # UUID of the kingdom
    skill       = models.ForeignKey('progression.SkillNode', on_delete=models.CASCADE)
    unlocked_at = models.DateTimeField(auto_now_add=True)
    level       = models.IntegerField(default=1)

    class Meta:
        unique_together = ('player', 'cluster_id', 'skill')
        indexes = [models.Index(fields=['player','cluster_id'])]

    def __str__(self):
        return f"{self.player.username}@{self.cluster_id[:8]}: {self.skill.name}"


class PendingClaim(models.Model):
    """Tracks ongoing territory claims (exploration, battles)."""
    METHOD_CHOICES = [
        ('explore', 'Exploration'),
        ('attack', 'Military Attack'),
        ('buy', 'Purchase'),
    ]
    STATUS_CHOICES = [
        ('in_progress', 'In Progress'),
        ('completed', 'Completed'),
        ('cancelled', 'Cancelled'),
        ('failed', 'Failed'),
    ]

    player        = models.ForeignKey('accounts.Player', on_delete=models.CASCADE, related_name='pending_claims')
    h3_index      = models.CharField(max_length=24)
    territory     = models.ForeignKey(Territory, on_delete=models.SET_NULL, null=True, blank=True)
    method        = models.CharField(max_length=12, choices=METHOD_CHOICES)
    status        = models.CharField(max_length=12, choices=STATUS_CHOICES, default='in_progress')
    started_at    = models.DateTimeField(auto_now_add=True)
    hours_required = models.FloatField(default=1.0)
    completed_at  = models.DateTimeField(null=True, blank=True)
    is_adjacent   = models.BooleanField(default=False)
    territory_name = models.CharField(max_length=120, blank=True)

    class Meta:
        db_table = 'pending_claim'
        ordering = ['-started_at']
        indexes = [
            models.Index(fields=['player', 'status']),
            models.Index(fields=['h3_index', 'status']),
        ]

    @property
    def progress(self):
        """0.0 to 1.0"""
        from django.utils import timezone
        if self.status != 'in_progress':
            return 1.0
        elapsed = (timezone.now() - self.started_at).total_seconds() / 3600
        return min(1.0, elapsed / max(self.hours_required, 0.01))

    @property
    def eta_seconds(self):
        """Seconds remaining"""
        from django.utils import timezone
        if self.status != 'in_progress':
            return 0
        elapsed = (timezone.now() - self.started_at).total_seconds()
        total = self.hours_required * 3600
        return max(0, total - elapsed)

    def __str__(self):
        return f"{self.player.username} → {self.h3_index[:12]} ({self.method}, {self.progress:.0%})"


class SafariTarget(models.Model):
    """Active safari hunt target assigned to a player."""
    # Fallback when the nature DB is missing: real species only (fauna, flora, micro-organisms, dinosaurs)
    CREATURES = [
        ('trex', 'Tyrannosaurus', 'legendary', 1000),
        ('raptor', 'Velociraptor', 'epic', 500),
        ('mammoth', 'Woolly Mammoth', 'epic', 400),
        ('eagle', 'Golden Eagle', 'rare', 200),
        ('whale', 'Blue Whale', 'legendary', 800),
        ('fungus', 'Ghost Fungus', 'rare', 150),
        ('wolf', 'Grey Wolf', 'epic', 350),
        ('bear', 'Polar Bear', 'rare', 250),
        ('beetle', 'Goliath Beetle', 'uncommon', 100),
        ('coral', 'Staghorn Coral', 'uncommon', 80),
        ('frog', 'Poison Dart Frog', 'common', 50),
        ('butterfly', 'Monarch Butterfly', 'rare', 175),
        ('orchid', 'Ghost Orchid', 'epic', 450),
        ('baobab', 'Baobab', 'rare', 200),
        ('tardigrade', 'Tardigrade', 'epic', 400),
    ]
    # Fantastic creatures (owner 2026-10-19: "fantastic creatures accepted in safari too"): a rare hunt (FANTASY_CHANCE),
    # hidden near the player's land like any radar hunt. Own album family 'fantasy'. (uid, name, rarity, HEX, legend)
    FANTASY = [
        ('fx-dragon', 'Storm Dragon', 'mythic', 2500, 'A dragon that nests inside thunderclouds and drinks lightning.'),
        ('fx-phoenix', 'Phoenix', 'mythic', 2000, 'The firebird that burns to ash every five centuries and is reborn from it.'),
        ('fx-unicorn', 'Crystal Unicorn', 'mythic', 1800, 'A white horse with a single spiralled horn said to purify water.'),
        ('fx-kraken', 'Kraken', 'legendary', 1200, 'The giant sea monster of Norse sailors, big enough to drag ships under.'),
        ('fx-serpent', 'Ancient Sea Serpent', 'legendary', 900, 'A colossal serpent seen by sailors in every ocean since antiquity.'),
        ('fx-griffin', 'Griffin', 'legendary', 1000, 'Lion body, eagle head and wings: guardian of treasures in Greek legend.'),
        ('fx-yeti', 'Yeti', 'epic', 600, 'The ape-like giant of the Himalayas, known only by its footprints in the snow.'),
        ('fx-nessie', 'Loch Ness Monster', 'epic', 500, 'The long-necked creature of the Scottish loch, photographed but never caught.'),
        ('fx-wolf', 'Ghost Wolf Alpha', 'epic', 350, 'A pale wolf that leads its pack through the fog and leaves no tracks.'),
        ('fx-kitsune', 'Nine-tailed Fox', 'legendary', 950, 'The Japanese fox spirit that grows a new tail every hundred years.'),
    ]
    FANTASY_CHANCE = 1 / 15
    WORLD_SCANS_MAX = 10   # radar scans can never go above this (shop hints included)

    player = models.ForeignKey('accounts.Player', on_delete=models.CASCADE, related_name='safari_targets')
    creature_id = models.CharField(max_length=30)
    creature_name = models.CharField(max_length=100)
    rarity = models.CharField(max_length=20, default='common')
    hex_reward = models.IntegerField(default=100)
    target_lat = models.FloatField()
    target_lon = models.FloatField()
    target_h3 = models.CharField(max_length=24, blank=True)       # hidden cell (never sent to the client)
    center_h3 = models.CharField(max_length=24, blank=True, default='')   # centre of the 19-cell hunting ground
    tries_left = models.IntegerField(default=4)
    probes = models.JSONField(default=list, blank=True)           # [{h3, ring}]
    hint = models.TextField(blank=True)
    # 'world': the species hides where it really lives (iNaturalist / fossil sites), found with the radar;
    # 'local': fallback when no place is known yet — one of the 19 hexes around the player's land
    mode = models.CharField(max_length=8, default='local')
    status = models.CharField(max_length=12, default='active', choices=[
        ('active', 'Active'), ('captured', 'Captured'), ('expired', 'Expired'),
    ])
    assigned_at = models.DateTimeField(auto_now_add=True)
    captured_at = models.DateTimeField(null=True, blank=True)
    distance_at_capture = models.FloatField(null=True, blank=True)

    class Meta:
        db_table = 'safari_targets'
        ordering = ['-assigned_at']

    GRID_K = 2          # hunting ground = centre + 2 rings = 19 real hexes
    TRIES = 4
    WORLD_SCANS = 8     # radar scans in a world hunt
    CAPTURE_KM = 2.5    # world hunt: the map centre must be this close to the creature to catch it

    @classmethod
    def spawn_world(cls, player):
        """The species hides in a real hex of its range (iNaturalist research-grade sightings, fossil sites).
        Clue = the region of that place; the radar does the rest. None when no species has a known place yet."""
        import random, h3
        from terra_domini.apps.events.hexod_db import pick_creature, CAPTURE_REWARD
        from terra_domini.apps.economy.resources import biome_for
        real = pick_creature(with_places=True)
        if not real:
            return None
        from terra_domini.apps.territories.models import Territory
        places = list(real['places']); random.shuffle(places)
        lat = lon = cell = None
        for pl in places:                    # the hex it hides on must be free: catching it gives you that hex
            c = h3.latlng_to_cell(pl[0], pl[1], 8)
            if not Territory.objects.filter(h3_index=c, owner__isnull=False).exists():
                lat, lon, cell = pl[0], pl[1], c
                break
        if not cell:
            return None
        tlat, tlon = h3.cell_to_latlng(cell)
        b = biome_for(round(lat, 3), round(lon, 3))
        clue = f"Seen in the {b['name']}" + (f" ({b['continent']})" if b.get('continent') else '') if b else 'Seen somewhere on Earth'
        return cls.objects.create(
            player=player, creature_id=real['uid'][:30], creature_name=real['name'][:100], rarity=real['rarity'],
            hex_reward=CAPTURE_REWARD.get(real['rarity'], 50), target_lat=tlat, target_lon=tlon, target_h3=cell,
            center_h3='', mode='world', tries_left=cls.WORLD_SCANS, probes=[], hint=clue,
        )

    @classmethod
    def spawn_for_player(cls, player, base_lat=None, base_lon=None, fantasy=False):
        """Fallback while no sighting is known for any species: a real species spotted 5-60 km from one of the
        player's hexes (or the map position), on a free hex — same radar hunt as the world safari.
        fantasy=True: one of the FANTASY creatures instead."""
        import math, random, h3
        from terra_domini.apps.events.hexod_db import pick_creature, CAPTURE_REWARD
        from terra_domini.apps.territories.models import Territory
        real = None if fantasy else pick_creature()
        if fantasy:
            cid, cname, rarity, reward, _ = random.choice(cls.FANTASY)
        elif real:
            cid, cname, rarity = real['uid'][:30], real['name'][:100], real['rarity']
            reward = CAPTURE_REWARD.get(rarity, 50)
        else:
            cid, cname, rarity, reward = random.choice(cls.CREATURES)
        owned = list(Territory.objects.filter(owner=player).values_list('center_lat', 'center_lon', 'place_name', 'poi_name')[:200])
        if owned:
            blat, blon, place, poi = random.choice(owned)
            where = poi or place or 'your land'
        else:
            blat, blon, where = (base_lat if base_lat is not None else 48.8566), (base_lon if base_lon is not None else 2.3522), 'here'
        for _ in range(20):
            km, brg = random.uniform(5, 60), random.uniform(0, 2 * math.pi)
            lat = blat + km / 111.0 * math.cos(brg)
            lon = blon + km / (111.0 * max(0.2, math.cos(math.radians(blat)))) * math.sin(brg)
            cell = h3.latlng_to_cell(lat, lon, 8)
            if not Territory.objects.filter(h3_index=cell, owner__isnull=False).exists():
                break
        tlat, tlon = h3.cell_to_latlng(cell)
        return cls.objects.create(
            player=player, creature_id=cid, creature_name=cname, rarity=rarity, hex_reward=reward,
            target_lat=tlat, target_lon=tlon, target_h3=cell, center_h3='', mode='world', tries_left=cls.WORLD_SCANS,
            probes=[], hint=(f'Legends place it within 60 km of {where}' if fantasy else f'Spotted within 60 km of {where}'),
        )

    def grid(self):
        """The 19 cells with local coordinates for drawing (target not revealed)."""
        import h3
        out = []
        for c in h3.grid_disk(self.center_h3, self.GRID_K):
            i, j = h3.cell_to_local_ij(self.center_h3, c)
            out.append({'h3': c, 'i': i, 'j': j})
        return out


class SafariCapture(models.Model):
    """Record of a captured safari creature — goes into Codex."""
    player = models.ForeignKey('accounts.Player', on_delete=models.CASCADE, related_name='safari_captures')
    creature_id = models.CharField(max_length=30)
    creature_name = models.CharField(max_length=100)
    rarity = models.CharField(max_length=20)
    hex_earned = models.IntegerField(default=0)
    captured_at = models.DateTimeField(auto_now_add=True)
    capture_lat = models.FloatField(null=True)
    capture_lon = models.FloatField(null=True)

    class Meta:
        db_table = 'safari_captures'
        ordering = ['-captured_at']


class CollectedToken(models.Model):
    """A token card a player holds in their codex for good (owner 2026-10-20): taking a hex with a token mints that
    edition into the taker's album (conquest → the next edition, v2, v3…). Lose the hex and the card stays in the
    album but pays nothing: income only comes from hexes you hold (economy.balance.territory_rates)."""
    player = models.ForeignKey('accounts.Player', on_delete=models.CASCADE, related_name='collected_tokens')
    h3_index = models.CharField(max_length=20, db_index=True)
    edition = models.PositiveIntegerField(default=1)
    name = models.CharField(max_length=300, blank=True, default='')
    acquired_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'collected_tokens'
        unique_together = [('player', 'h3_index', 'edition')]
        ordering = ['-acquired_at']


def _remember_owner(sender, instance, **kwargs):
    instance._owner_at_load = instance.__dict__.get('owner_id')


def _collect_on_take(sender, instance, created, **kwargs):
    """New holder of a hex with a token → that edition goes into their album."""
    owner = instance.__dict__.get('owner_id')
    if not owner or owner == getattr(instance, '_owner_at_load', None):
        return
    instance._owner_at_load = owner
    from terra_domini.apps.events.unified_poi import UnifiedPOI
    names = list(UnifiedPOI.objects.filter(h3_index=instance.h3_index, is_active=True).values_list('name', flat=True)[:1])
    if names:
        CollectedToken.objects.get_or_create(player_id=owner, h3_index=instance.h3_index, edition=instance.nft_version or 1,
                                             defaults={'name': names[0][:300]})


models.signals.post_init.connect(_remember_owner, sender=Territory)
models.signals.post_save.connect(_collect_on_take, sender=Territory)
