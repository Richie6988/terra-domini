"""
Terra Domini — Unified Point of Interest System
Every remarkable place on Earth is a POI.
One model. 50+ categories. 10,000+ locations.
POIs = Control Towers = Resources = Landmarks = all the same concept.
"""
from django.db import models
import uuid


# ─── 50 POI Categories ────────────────────────────────────────────────────────
class POICategory(models.TextChoices):
    # 🌍 Nature & Geography
    MOUNTAIN_PEAK    = 'mountain_peak',    'Mountain Peak'
    VOLCANO          = 'volcano',          'Volcano'
    CANYON           = 'canyon',           'Canyon'
    WATERFALL        = 'waterfall',        'Waterfall'
    GLACIER          = 'glacier',          'Glacier'
    CAVE_SYSTEM      = 'cave_system',      'Cave System'
    CORAL_REEF       = 'coral_reef',       'Coral Reef'
    ANCIENT_FOREST   = 'ancient_forest',   'Ancient Forest'
    NATURE_SANCTUARY = 'nature_sanctuary', 'Nature Sanctuary'
    ISLAND           = 'island',           'Strategic Island'
    # 💎 Resources
    OIL_FIELD        = 'oil_field',        'Oil Field'
    GAS_RESERVE      = 'gas_reserve',      'Gas Reserve'
    GOLD_MINE        = 'gold_mine',        'Gold Mine'
    DIAMOND_MINE     = 'diamond_mine',     'Diamond Mine'
    RARE_EARTH       = 'rare_earth',       'Rare Earth Deposit'
    LITHIUM_DEPOSIT  = 'lithium_deposit',  'Lithium Deposit'
    URANIUM_MINE     = 'uranium_mine',     'Uranium Mine'
    COAL_MINE        = 'coal_mine',        'Coal Mine'
    IRON_ORE         = 'iron_ore',         'Iron Ore'
    COPPER_MINE      = 'copper_mine',      'Copper Mine'
    FRESHWATER       = 'freshwater',       'Freshwater Reserve'
    FERTILE_LAND     = 'fertile_land',     'Fertile Land'
    # 🏛️ Human Infrastructure
    CAPITAL_CITY     = 'capital_city',     'Capital City'
    MEGA_PORT        = 'mega_port',        'Mega Port'
    CHOKEPOINT       = 'chokepoint',       'Strategic Chokepoint'
    NUCLEAR_PLANT    = 'nuclear_plant',    'Nuclear Plant'
    SPACE_CENTER     = 'space_center',     'Space Center'
    DATA_CENTER      = 'data_center',      'Data Center Hub'
    FINANCIAL_HUB    = 'financial_hub',    'Financial Hub'
    STOCK_EXCHANGE   = 'stock_exchange',   'Stock Exchange'
    # 🪖 Military
    MILITARY_BASE    = 'military_base',    'Military Base'
    NAVAL_BASE       = 'naval_base',       'Naval Base'
    MISSILE_SITE     = 'missile_site',     'Missile Site'
    INTELLIGENCE_HQ  = 'intelligence_hq',  'Intelligence HQ'
    # 🏛️ Culture & History
    WORLD_HERITAGE   = 'world_heritage',   'UNESCO World Heritage'
    ANCIENT_RUINS    = 'ancient_ruins',    'Ancient Ruins'
    RELIGIOUS_SITE   = 'religious_site',   'Religious Site'
    ROYAL_PALACE     = 'royal_palace',     'Royal Palace'
    MUSEUM           = 'museum',           'Major Museum'
    # 🎭 Controversial / Secret
    CONSPIRACY       = 'conspiracy',       'Conspiracy Site'
    SECRET_FACILITY  = 'secret_facility',  'Secret Facility'
    OLIGARCH_ASSET   = 'oligarch_asset',   'Oligarch Asset'
    OFFSHORE_HAVEN   = 'offshore_haven',   'Offshore Haven'
    # 🌐 Organizations
    INTERNATIONAL_ORG = 'international_org', 'International Organization'
    ALLIANCE_HQ      = 'alliance_hq',     'Military Alliance HQ'
    TECH_GIANT       = 'tech_giant',       'Tech Giant Campus'
    MEDIA_HQ         = 'media_hq',        'Media Headquarters'
    # 🎮 Game-specific
    CONTROL_TOWER    = 'control_tower',    'Control Tower'
    TRADE_NODE       = 'trade_node',       'Trade Node'
    ANCIENT_WONDER   = 'ancient_wonder',   'Ancient Wonder'
    ANOMALY          = 'anomaly',          'Anomaly Zone'


# Visual config per category
POI_VISUAL = {
    'mountain_peak':    {'emoji': '🏔️', 'color': '#9CA3AF', 'size': 'sm', 'rarity': 'common',    'game_resource': 'culture',   'bonus': 20},
    'volcano':          {'emoji': '🌋', 'color': '#EF4444', 'size': 'md', 'rarity': 'uncommon',  'game_resource': 'energy',    'bonus': 40},
    'canyon':           {'emoji': '🏜️', 'color': '#D97706', 'size': 'sm', 'rarity': 'common',    'game_resource': 'culture',   'bonus': 15},
    'waterfall':        {'emoji': '💦', 'color': '#0EA5E9', 'size': 'sm', 'rarity': 'common',    'game_resource': 'food',      'bonus': 20},
    'glacier':          {'emoji': '🧊', 'color': '#BAE6FD', 'size': 'md', 'rarity': 'uncommon',  'game_resource': 'freshwater','bonus': 35},
    'cave_system':      {'emoji': '🕳️', 'color': '#6B7280', 'size': 'sm', 'rarity': 'uncommon',  'game_resource': 'materials', 'bonus': 25},
    'coral_reef':       {'emoji': '🪸', 'color': '#EC4899', 'size': 'md', 'rarity': 'rare',      'game_resource': 'food',      'bonus': 45},
    'ancient_forest':   {'emoji': '🌲', 'color': '#15803D', 'size': 'md', 'rarity': 'uncommon',  'game_resource': 'food',      'bonus': 35},
    'nature_sanctuary': {'emoji': '🌿', 'color': '#10B981', 'size': 'md', 'rarity': 'uncommon',  'game_resource': 'culture',   'bonus': 40},
    'island':           {'emoji': '🏝️', 'color': '#0EA5E9', 'size': 'md', 'rarity': 'rare',      'game_resource': 'credits',   'bonus': 60},
    'oil_field':        {'emoji': '🛢️', 'color': '#1F2937', 'size': 'lg', 'rarity': 'common',    'game_resource': 'energy',    'bonus': 50},
    'gas_reserve':      {'emoji': '🔥', 'color': '#D97706', 'size': 'md', 'rarity': 'common',    'game_resource': 'energy',    'bonus': 35},
    'gold_mine':        {'emoji': '🥇', 'color': '#F59E0B', 'size': 'lg', 'rarity': 'rare',      'game_resource': 'credits',   'bonus': 80},
    'diamond_mine':     {'emoji': '💎', 'color': '#06B6D4', 'size': 'lg', 'rarity': 'legendary', 'game_resource': 'credits',   'bonus': 100},
    'rare_earth':       {'emoji': '🔮', 'color': '#8B5CF6', 'size': 'lg', 'rarity': 'rare',      'game_resource': 'intel',     'bonus': 90},
    'lithium_deposit':  {'emoji': '⚡', 'color': '#10B981', 'size': 'lg', 'rarity': 'rare',      'game_resource': 'energy',    'bonus': 70},
    'uranium_mine':     {'emoji': '☢️', 'color': '#16A34A', 'size': 'lg', 'rarity': 'legendary', 'game_resource': 'energy',    'bonus': 120},
    'coal_mine':        {'emoji': '⚫', 'color': '#374151', 'size': 'sm', 'rarity': 'common',    'game_resource': 'materials', 'bonus': 25},
    'iron_ore':         {'emoji': '⚙️', 'color': '#6B7280', 'size': 'sm', 'rarity': 'common',    'game_resource': 'materials', 'bonus': 30},
    'copper_mine':      {'emoji': '🟠', 'color': '#EA580C', 'size': 'md', 'rarity': 'uncommon',  'game_resource': 'materials', 'bonus': 40},
    'freshwater':       {'emoji': '💧', 'color': '#0284C7', 'size': 'lg', 'rarity': 'rare',      'game_resource': 'food',      'bonus': 50},
    'fertile_land':     {'emoji': '🌾', 'color': '#A16207', 'size': 'md', 'rarity': 'common',    'game_resource': 'food',      'bonus': 35},
    'capital_city':     {'emoji': '🏛️', 'color': '#F59E0B', 'size': 'xl', 'rarity': 'rare',      'game_resource': 'credits',   'bonus': 75},
    'mega_port':        {'emoji': '🚢', 'color': '#0369A1', 'size': 'lg', 'rarity': 'uncommon',  'game_resource': 'credits',   'bonus': 60},
    'chokepoint':       {'emoji': '⚓', 'color': '#0F172A', 'size': 'xl', 'rarity': 'rare',      'game_resource': 'credits',   'bonus': 75},
    'nuclear_plant':    {'emoji': '⚛️', 'color': '#0EA5E9', 'size': 'xl', 'rarity': 'legendary', 'game_resource': 'energy',    'bonus': 150},
    'space_center':     {'emoji': '🚀', 'color': '#1D4ED8', 'size': 'xl', 'rarity': 'legendary', 'game_resource': 'intel',     'bonus': 200},
    'data_center':      {'emoji': '🖥️', 'color': '#6366F1', 'size': 'lg', 'rarity': 'rare',      'game_resource': 'intel',     'bonus': 80},
    'financial_hub':    {'emoji': '💹', 'color': '#10B981', 'size': 'lg', 'rarity': 'rare',      'game_resource': 'credits',   'bonus': 90},
    'stock_exchange':   {'emoji': '📈', 'color': '#059669', 'size': 'lg', 'rarity': 'rare',      'game_resource': 'credits',   'bonus': 85},
    'military_base':    {'emoji': '🏛️', 'color': '#374151', 'size': 'lg', 'rarity': 'uncommon',  'game_resource': 'intel',     'bonus': 60},
    'naval_base':       {'emoji': '⚓', 'color': '#1E3A5F', 'size': 'lg', 'rarity': 'uncommon',  'game_resource': 'intel',     'bonus': 65},
    'missile_site':     {'emoji': '🚀', 'color': '#DC2626', 'size': 'xl', 'rarity': 'legendary', 'game_resource': 'intel',     'bonus': 150},
    'intelligence_hq':  {'emoji': '🕵️', 'color': '#1F2937', 'size': 'xl', 'rarity': 'legendary', 'game_resource': 'intel',     'bonus': 200},
    'world_heritage':   {'emoji': '🏛️', 'color': '#D97706', 'size': 'md', 'rarity': 'uncommon',  'game_resource': 'culture',   'bonus': 50},
    'ancient_ruins':    {'emoji': '🗿', 'color': '#92400E', 'size': 'md', 'rarity': 'uncommon',  'game_resource': 'culture',   'bonus': 45},
    'religious_site':   {'emoji': '🕌', 'color': '#D97706', 'size': 'md', 'rarity': 'uncommon',  'game_resource': 'culture',   'bonus': 40},
    'royal_palace':     {'emoji': '👑', 'color': '#F59E0B', 'size': 'lg', 'rarity': 'rare',      'game_resource': 'culture',   'bonus': 70},
    'museum':           {'emoji': '🏛️', 'color': '#7C3AED', 'size': 'md', 'rarity': 'common',    'game_resource': 'culture',   'bonus': 30},
    'conspiracy':       {'emoji': '👁️', 'color': '#4B5563', 'size': 'lg', 'rarity': 'rare',      'game_resource': 'intel',     'bonus': 100},
    'secret_facility':  {'emoji': '🔒', 'color': '#1F2937', 'size': 'xl', 'rarity': 'legendary', 'game_resource': 'intel',     'bonus': 180},
    'oligarch_asset':   {'emoji': '🛥️', 'color': '#D97706', 'size': 'lg', 'rarity': 'rare',      'game_resource': 'credits',   'bonus': 120},
    'offshore_haven':   {'emoji': '🏦', 'color': '#065F46', 'size': 'lg', 'rarity': 'rare',      'game_resource': 'credits',   'bonus': 130},
    'international_org':{'emoji': '🌐', 'color': '#1D4ED8', 'size': 'lg', 'rarity': 'rare',      'game_resource': 'intel',     'bonus': 80},
    'alliance_hq':      {'emoji': '🤝', 'color': '#2563EB', 'size': 'xl', 'rarity': 'legendary', 'game_resource': 'intel',     'bonus': 160},
    'tech_giant':       {'emoji': '💻', 'color': '#6366F1', 'size': 'xl', 'rarity': 'legendary', 'game_resource': 'intel',     'bonus': 170},
    'media_hq':         {'emoji': '📡', 'color': '#EC4899', 'size': 'lg', 'rarity': 'rare',      'game_resource': 'culture',   'bonus': 75},
    'control_tower':    {'emoji': '🗼', 'color': '#FFB800', 'size': 'xl', 'rarity': 'legendary', 'game_resource': 'credits',   'bonus': 200},
    'trade_node':       {'emoji': '🔄', 'color': '#10B981', 'size': 'lg', 'rarity': 'rare',      'game_resource': 'credits',   'bonus': 80},
    'ancient_wonder':   {'emoji': '✨', 'color': '#F59E0B', 'size': 'xl', 'rarity': 'legendary', 'game_resource': 'culture',   'bonus': 250},
    'anomaly':          {'emoji': '🌀', 'color': '#8B5CF6', 'size': 'xl', 'rarity': 'legendary', 'game_resource': 'intel',     'bonus': 300},
}

RARITY_TDC = {'common': 10, 'uncommon': 25, 'rare': 60, 'legendary': 150}


class UnifiedPOI(models.Model):
    """
    Single unified POI model for all points of interest.
    Replaces WorldPOI + ResourcePOI.
    10,000+ real-world locations seeded from curated data.
    """
    id           = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name         = models.CharField(max_length=300, db_index=True)
    category     = models.CharField(max_length=30, choices=POICategory.choices, db_index=True)
    latitude     = models.FloatField()
    longitude    = models.FloatField()
    country_code = models.CharField(max_length=4, blank=True, db_index=True)
    country_name = models.CharField(max_length=100, blank=True)
    h3_index     = models.CharField(max_length=20, blank=True, db_index=True)

    # Display
    emoji        = models.CharField(max_length=8, blank=True)
    color        = models.CharField(max_length=7, default='#6B7280')
    size         = models.CharField(max_length=4, default='md',
                                    choices=[('xs','XS'),('sm','SM'),('md','MD'),('lg','LG'),('xl','XL')])

    # Game mechanics
    rarity        = models.CharField(max_length=12, default='common',
                                     choices=[('common','Common'),('uncommon','Uncommon'),
                                              ('rare','Rare'),('legendary','Legendary')])
    game_resource = models.CharField(max_length=20, default='credits')
    bonus_pct     = models.IntegerField(default=25)
    tdc_per_24h   = models.DecimalField(max_digits=10, decimal_places=2, default=10)

    # Info
    description   = models.TextField(blank=True)
    real_output   = models.CharField(max_length=200, blank=True)
    wiki_url      = models.URLField(blank=True)
    fun_fact      = models.TextField(blank=True)

    # State
    is_active    = models.BooleanField(default=True, db_index=True)
    is_featured  = models.BooleanField(default=False)
    threat_level = models.CharField(max_length=10, default='none',
                                    choices=[('none','None'),('low','Low'),('medium','Medium'),
                                             ('high','High'),('critical','Critical')])
    verified     = models.BooleanField(default=True)  # false = AI-suggested, needs review
    source       = models.CharField(max_length=50, blank=True)  # 'seed', 'ai', 'user', 'osm'

    created_at   = models.DateTimeField(auto_now_add=True)
    updated_at   = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'unified_poi'
        ordering = ['-is_featured', '-bonus_pct', 'name']
        indexes  = [
            models.Index(fields=['category', 'is_active']),
            models.Index(fields=['latitude', 'longitude']),
            models.Index(fields=['rarity', 'is_active']),
        ]

    def __str__(self):
        return f"{self.emoji} {self.name} ({self.category})"

    def save(self, *args, **kwargs):
        cfg = POI_VISUAL.get(self.category, {})
        if not self.emoji: self.emoji = cfg.get('emoji', '📍')
        if self.color == '#6B7280': self.color = cfg.get('color', '#6B7280')
        if not self.size or self.size == 'md': self.size = cfg.get('size', 'md')
        if self.rarity == 'common': self.rarity = cfg.get('rarity', 'common')
        if self.game_resource == 'credits': self.game_resource = cfg.get('game_resource', 'credits')
        if self.bonus_pct == 25: self.bonus_pct = cfg.get('bonus', 25)
        self.tdc_per_24h = RARITY_TDC.get(self.rarity, 10)
        if not self.h3_index and self.latitude and self.longitude:
            try:
                import h3
                self.h3_index = h3.geo_to_h3(self.latitude, self.longitude, 7)
            except Exception:
                pass
        super().save(*args, **kwargs)
