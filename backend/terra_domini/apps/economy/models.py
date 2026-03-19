"""
Economy models — shop items, player inventory, ad marketplace.
"""
import uuid
from django.db import models
from django.conf import settings
from django.utils import timezone


class ShopItem(models.Model):
    """Catalog of all purchasable items (TDC or fiat)."""

    class Category(models.TextChoices):
        SHIELD = 'shield', 'Territory Shield'
        MILITARY = 'military', 'Military Boost'
        CONSTRUCTION = 'construction', 'Construction Speed'
        COSMETIC = 'cosmetic', 'Cosmetic'
        BATTLE_PASS = 'battle_pass', 'Battle Pass'
        ALLIANCE = 'alliance', 'Alliance Premium'
        RESOURCE_PACK = 'resource_pack', 'Resource Pack'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    code = models.CharField(max_length=50, unique=True)  # e.g. 'shield_6h'
    name = models.CharField(max_length=100)
    description = models.TextField()
    category = models.CharField(max_length=20, choices=Category.choices)

    price_tdc = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    price_eur = models.DecimalField(max_digits=8, decimal_places=2, null=True, blank=True)

    # Effect definition
    effect_type = models.CharField(max_length=50)    # 'shield', 'military_boost', 'speed_boost', etc.
    effect_value = models.FloatField(default=0.0)    # boost amount
    effect_duration_seconds = models.IntegerField(default=0)  # 0 = permanent

    # Balance caps enforced at purchase
    max_per_day = models.IntegerField(default=0)     # 0 = unlimited
    hard_cap_pct = models.FloatField(default=0.0)    # enforced boost ceiling

    is_active = models.BooleanField(default=True)
    is_limited = models.BooleanField(default=False)
    available_until = models.DateTimeField(null=True, blank=True)
    max_stock = models.IntegerField(default=0)       # 0 = unlimited
    sold_count = models.IntegerField(default=0)

    # Cosmetic data
    icon_url = models.URLField(blank=True)
    rarity = models.CharField(max_length=20, default='common')  # common, rare, epic, legendary

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'shop_items'
        ordering = ['category', 'price_tdc']

    def is_available(self) -> bool:
        if not self.is_active:
            return False
        if self.is_limited and self.available_until and timezone.now() > self.available_until:
            return False
        if self.max_stock > 0 and self.sold_count >= self.max_stock:
            return False
        return True


class PlayerInventory(models.Model):
    """Items owned by a player (not yet used)."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    player = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='inventory')
    item = models.ForeignKey(ShopItem, on_delete=models.PROTECT)
    quantity = models.IntegerField(default=1)
    acquired_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField(null=True, blank=True)  # For timed inventory items

    class Meta:
        db_table = 'player_inventory'
        unique_together = ['player', 'item']


class ActiveBoost(models.Model):
    """Currently active boost on a player or territory."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    player = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='active_boosts')
    territory = models.ForeignKey(
        'territories.Territory', null=True, blank=True,
        on_delete=models.CASCADE, related_name='active_boosts'
    )
    item = models.ForeignKey(ShopItem, on_delete=models.PROTECT)
    boost_type = models.CharField(max_length=50)
    boost_value = models.FloatField()
    activated_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()

    class Meta:
        db_table = 'active_boosts'
        indexes = [models.Index(fields=['player', 'boost_type']), models.Index(fields=['expires_at'])]

    @property
    def is_active(self) -> bool:
        return timezone.now() < self.expires_at


class BattlePass(models.Model):
    """Battle Pass season."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    season_number = models.IntegerField(unique=True)
    name = models.CharField(max_length=100)
    starts_at = models.DateTimeField()
    ends_at = models.DateTimeField()
    price_eur = models.DecimalField(max_digits=6, decimal_places=2, default=4.99)
    price_tdc = models.DecimalField(max_digits=12, decimal_places=2, default=499)
    total_tiers = models.IntegerField(default=40)
    is_active = models.BooleanField(default=False)

    class Meta:
        db_table = 'battle_passes'


class BattlePassReward(models.Model):
    """Individual tier reward in a Battle Pass."""
    battle_pass = models.ForeignKey(BattlePass, on_delete=models.CASCADE, related_name='rewards')
    tier = models.IntegerField()
    item = models.ForeignKey(ShopItem, on_delete=models.PROTECT)
    quantity = models.IntegerField(default=1)
    is_free_tier = models.BooleanField(default=False)  # Free players get every other tier

    class Meta:
        db_table = 'battle_pass_rewards'
        unique_together = ['battle_pass', 'tier']
        ordering = ['tier']


class PlayerBattlePass(models.Model):
    """Player's progress on current Battle Pass."""
    player = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    battle_pass = models.ForeignKey(BattlePass, on_delete=models.CASCADE)
    is_premium = models.BooleanField(default=False)
    current_tier = models.IntegerField(default=0)
    xp = models.IntegerField(default=0)
    claimed_tiers = models.JSONField(default=list)
    purchased_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'player_battle_pass'
        unique_together = ['player', 'battle_pass']


# ─── Advertising Marketplace ─────────────────────────────────────────────────

class AdCampaign(models.Model):
    """Brand advertising campaign in the game."""

    class CampaignStatus(models.TextChoices):
        DRAFT = 'draft', 'Draft'
        PENDING_REVIEW = 'pending_review', 'Pending Review'
        ACTIVE = 'active', 'Active'
        PAUSED = 'paused', 'Paused'
        COMPLETED = 'completed', 'Completed'
        REJECTED = 'rejected', 'Rejected'

    class TargetingType(models.TextChoices):
        GLOBAL = 'global', 'Global'
        COUNTRY = 'country', 'By Country'
        TERRITORY_TYPE = 'territory_type', 'By Territory Type'
        LANDMARK = 'landmark', 'Landmarks Only'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    brand_name = models.CharField(max_length=100)
    brand_email = models.EmailField()
    campaign_name = models.CharField(max_length=200)

    # Creative
    banner_url = models.URLField()           # 300×250 or 728×90
    click_url = models.URLField()
    logo_url = models.URLField(blank=True)

    # Targeting
    targeting_type = models.CharField(max_length=20, choices=TargetingType.choices, default=TargetingType.GLOBAL)
    target_countries = models.JSONField(default=list)
    target_territory_types = models.JSONField(default=list)
    min_territory_tier = models.IntegerField(default=1)

    # Budget
    budget_eur = models.DecimalField(max_digits=12, decimal_places=2)
    spent_eur = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    cpm_eur = models.DecimalField(max_digits=6, decimal_places=4, default=2.0)  # Cost per 1000 impressions
    total_impressions = models.BigIntegerField(default=0)
    target_impressions = models.BigIntegerField(default=0)

    status = models.CharField(max_length=20, choices=CampaignStatus.choices, default=CampaignStatus.DRAFT)
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True,
        on_delete=models.SET_NULL, related_name='reviewed_campaigns'
    )
    rejection_reason = models.TextField(blank=True)

    starts_at = models.DateTimeField(null=True, blank=True)
    ends_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'ad_campaigns'
        ordering = ['-created_at']

    @property
    def is_active(self) -> bool:
        now = timezone.now()
        return (
            self.status == self.CampaignStatus.ACTIVE
            and self.spent_eur < self.budget_eur
            and (not self.ends_at or now < self.ends_at)
        )
