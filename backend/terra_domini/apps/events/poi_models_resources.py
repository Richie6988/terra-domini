"""
Resource POI model extension.
20 resource categories with real-world geographic data.
Each resource hex grants bonus production to its owner.
"""
from django.db import models
import uuid


class ResourceCategory(models.TextChoices):
    # Fossil fuels
    OIL_FIELD       = 'oil_field',       'Oil Field'
    GAS_RESERVE     = 'gas_reserve',     'Natural Gas Reserve'
    COAL_MINE       = 'coal_mine',       'Coal Mine'
    # Metals & minerals
    GOLD_MINE       = 'gold_mine',       'Gold Mine'
    DIAMOND_MINE    = 'diamond_mine',    'Diamond Mine'
    RARE_EARTH      = 'rare_earth',      'Rare Earth Deposit'
    IRON_ORE        = 'iron_ore',        'Iron Ore Deposit'
    COPPER_MINE     = 'copper_mine',     'Copper Mine'
    LITHIUM_DEPOSIT = 'lithium_deposit', 'Lithium Deposit'
    URANIUM_MINE    = 'uranium_mine',    'Uranium Mine'
    # Strategic
    MILITARY_BASE   = 'military_base',   'Military Base'
    NUCLEAR_PLANT   = 'nuclear_plant',   'Nuclear Power Plant'
    SPACE_CENTER    = 'space_center',    'Space Launch Center'
    CHOKEPOINT      = 'chokepoint',      'Strategic Chokepoint'
    PORT_MEGACITY   = 'port_megacity',   'Mega Port'
    # Nature
    NATURE_SANCTUARY= 'nature_sanctuary','Nature Sanctuary'
    ANCIENT_FOREST  = 'ancient_forest',  'Ancient Forest'
    FRESHWATER      = 'freshwater',      'Freshwater Reserve'
    # Food & bio
    FERTILE_LAND    = 'fertile_land',    'Fertile Agricultural Land'
    DEEP_SEA_FISH   = 'deep_sea_fish',   'Deep Sea Fishing Zone'


RESOURCE_CONFIG = {
    # category: {emoji, color, game_resource, bonus_pct, rarity}
    'oil_field':        {'emoji': '🛢️',  'color': '#1F2937', 'game_resource': 'energy',    'bonus_pct': 50, 'rarity': 'common'},
    'gas_reserve':      {'emoji': '🔥',  'color': '#D97706', 'game_resource': 'energy',    'bonus_pct': 35, 'rarity': 'common'},
    'coal_mine':        {'emoji': '⚫',  'color': '#374151', 'game_resource': 'materials', 'bonus_pct': 25, 'rarity': 'common'},
    'gold_mine':        {'emoji': '🥇',  'color': '#F59E0B', 'game_resource': 'credits',   'bonus_pct': 80, 'rarity': 'rare'},
    'diamond_mine':     {'emoji': '💎',  'color': '#06B6D4', 'game_resource': 'credits',   'bonus_pct': 100,'rarity': 'legendary'},
    'rare_earth':       {'emoji': '🔮',  'color': '#8B5CF6', 'game_resource': 'intel',     'bonus_pct': 90, 'rarity': 'rare'},
    'iron_ore':         {'emoji': '⚙️',  'color': '#6B7280', 'game_resource': 'materials', 'bonus_pct': 30, 'rarity': 'common'},
    'copper_mine':      {'emoji': '🟠',  'color': '#EA580C', 'game_resource': 'materials', 'bonus_pct': 40, 'rarity': 'uncommon'},
    'lithium_deposit':  {'emoji': '⚡',  'color': '#10B981', 'game_resource': 'energy',    'bonus_pct': 70, 'rarity': 'rare'},
    'uranium_mine':     {'emoji': '☢️',  'color': '#16A34A', 'game_resource': 'energy',    'bonus_pct': 120,'rarity': 'legendary'},
    'military_base':    {'emoji': '🏛️',  'color': '#374151', 'game_resource': 'intel',     'bonus_pct': 60, 'rarity': 'uncommon'},
    'nuclear_plant':    {'emoji': '⚛️',  'color': '#0EA5E9', 'game_resource': 'energy',    'bonus_pct': 150,'rarity': 'legendary'},
    'space_center':     {'emoji': '🚀',  'color': '#1D4ED8', 'game_resource': 'intel',     'bonus_pct': 200,'rarity': 'legendary'},
    'chokepoint':       {'emoji': '⚓',  'color': '#0F172A', 'game_resource': 'credits',   'bonus_pct': 75, 'rarity': 'rare'},
    'port_megacity':    {'emoji': '🚢',  'color': '#0369A1', 'game_resource': 'credits',   'bonus_pct': 60, 'rarity': 'uncommon'},
    'nature_sanctuary': {'emoji': '🌿',  'color': '#15803D', 'game_resource': 'culture',   'bonus_pct': 45, 'rarity': 'uncommon'},
    'ancient_forest':   {'emoji': '🌲',  'color': '#166534', 'game_resource': 'food',      'bonus_pct': 40, 'rarity': 'uncommon'},
    'freshwater':       {'emoji': '💧',  'color': '#0284C7', 'game_resource': 'food',      'bonus_pct': 50, 'rarity': 'rare'},
    'fertile_land':     {'emoji': '🌾',  'color': '#A16207', 'game_resource': 'food',      'bonus_pct': 35, 'rarity': 'common'},
    'deep_sea_fish':    {'emoji': '🐟',  'color': '#0C4A6E', 'game_resource': 'food',      'bonus_pct': 30, 'rarity': 'common'},
}


class ResourcePOI(models.Model):
    """
    Real-world resource location on the map.
    Owning this H3 hex grants production bonus to the player.
    Only visible to players when they are near the zone (fog of war).
    """
    id           = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name         = models.CharField(max_length=200)
    category     = models.CharField(max_length=30, choices=ResourceCategory.choices)
    country_code = models.CharField(max_length=4, blank=True)
    country_name = models.CharField(max_length=80, blank=True)
    latitude     = models.FloatField()
    longitude    = models.FloatField()
    h3_index     = models.CharField(max_length=20, blank=True, db_index=True)  # computed on save

    # Game stats
    game_resource  = models.CharField(max_length=20, default='credits')
    bonus_pct      = models.IntegerField(default=25)    # % production bonus when owned
    rarity         = models.CharField(max_length=12, default='common')
    tdc_per_24h    = models.DecimalField(max_digits=10, decimal_places=2, default=0)

    # Display
    emoji          = models.CharField(max_length=8, default='📍')
    color          = models.CharField(max_length=7, default='#6B7280')
    description    = models.TextField(blank=True)
    real_output    = models.CharField(max_length=100, blank=True)  # e.g. "3.2M barrels/day"

    # State
    is_active      = models.BooleanField(default=True)
    discovered_by  = models.ForeignKey(
        'accounts.Player', null=True, blank=True,
        on_delete=models.SET_NULL, related_name='discovered_pois'
    )
    discovered_at  = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'resource_poi'
        ordering = ['-bonus_pct', 'name']
        indexes  = [
            models.Index(fields=['category']),
            models.Index(fields=['country_code']),
            models.Index(fields=['latitude', 'longitude']),
        ]

    def __str__(self):
        return f"{self.emoji} {self.name} ({self.get_category_display()})"

    def save(self, *args, **kwargs):
        # Auto-compute H3 index if not set
        if not self.h3_index:
            try:
                import h3
                self.h3_index = h3.latlng_to_cell(self.latitude, self.longitude, 7)
            except Exception:
                pass
        # Set display from config
        cfg = RESOURCE_CONFIG.get(self.category, {})
        if not self.emoji:
            self.emoji = cfg.get('emoji', '📍')
        if not self.color or self.color == '#6B7280':
            self.color = cfg.get('color', '#6B7280')
        if not self.game_resource or self.game_resource == 'credits':
            self.game_resource = cfg.get('game_resource', 'credits')
        if not self.bonus_pct or self.bonus_pct == 25:
            self.bonus_pct = cfg.get('bonus_pct', 25)
        if not self.rarity or self.rarity == 'common':
            self.rarity = cfg.get('rarity', 'common')
        # TDC income based on rarity
        tdc_map = {'common': 10, 'uncommon': 25, 'rare': 60, 'legendary': 150}
        self.tdc_per_24h = tdc_map.get(self.rarity, 10)
        super().save(*args, **kwargs)
