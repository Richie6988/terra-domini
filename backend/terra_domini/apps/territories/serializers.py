"""
DRF Serializers — territory, combat, economy.
"""
from rest_framework import serializers
from terra_domini.apps.territories.models import Territory, Building, TradeRoute
from terra_domini.apps.combat.engine import Battle, BattleParticipant, MilitaryUnit
from terra_domini.apps.economy.models import ShopItem, PlayerInventory, ActiveBoost, AdCampaign
from terra_domini.apps.accounts.models import Player, PlayerStats
from terra_domini.apps.alliances.models import Alliance, AllianceMember


# ─── Player ───────────────────────────────────────────────────────────────────

class PlayerPublicSerializer(serializers.ModelSerializer):
    territories_owned = serializers.IntegerField(source='stats.territories_owned', default=0)
    season_score = serializers.IntegerField(source='stats.season_score', default=0)
    alliance_tag = serializers.SerializerMethodField()

    class Meta:
        model = Player
        fields = ['id', 'username', 'display_name', 'avatar_url', 'commander_rank',
                  'spec_path', 'territories_owned', 'season_score', 'alliance_tag', 'is_online']

    def get_alliance_tag(self, obj):
        try:
            return obj.alliance_member.alliance.tag
        except Exception:
            return None


class PlayerProfileSerializer(serializers.ModelSerializer):
    stats = serializers.SerializerMethodField()
    alliance = serializers.SerializerMethodField()
    active_boosts = serializers.SerializerMethodField()

    class Meta:
        model = Player
        fields = [
            'id', 'username', 'display_name', 'email', 'avatar_url',
            'commander_rank', 'commander_xp', 'spec_path',
            'tdc_in_game', 'total_tdc_purchased', 'total_tdc_earned_ads',
            'wallet_address', 'is_protected', 'shield_until', 'beginner_protection_until',
            'stats', 'alliance', 'active_boosts', 'last_active', 'is_online',
            'preferred_language', 'date_joined',
        ]
        read_only_fields = ['id', 'email', 'commander_rank', 'commander_xp',
                            'tdc_in_game', 'total_tdc_purchased', 'total_tdc_earned_ads']

    def get_stats(self, obj):
        try:
            s = obj.stats
            return {
                'territories_owned': s.territories_owned,
                'territories_captured': s.territories_captured,
                'battles_won': s.battles_won,
                'battles_lost': s.battles_lost,
                'season_score': s.season_score,
                'season_rank': s.season_rank,
            }
        except PlayerStats.DoesNotExist:
            return {}

    def get_alliance(self, obj):
        try:
            m = obj.alliance_member
            return {
                'id': str(m.alliance.id),
                'tag': m.alliance.tag,
                'name': m.alliance.name,
                'role': m.role,
                'tier': m.alliance.tier,
            }
        except Exception:
            return None

    def get_active_boosts(self, obj):
        from django.utils import timezone
        boosts = obj.active_boosts.filter(expires_at__gt=timezone.now())
        return [{'type': b.boost_type, 'value': b.boost_value, 'expires_at': b.expires_at.isoformat()} for b in boosts]


# ─── Territory ────────────────────────────────────────────────────────────────

class TerritoryLightSerializer(serializers.ModelSerializer):
    """Minimal — used for map viewport rendering (performance critical)."""
    owner_username = serializers.CharField(source='owner.username', default=None)
    alliance_tag = serializers.SerializerMethodField()

    class Meta:
        model = Territory
        fields = [
            'h3_index', 'territory_type', 'owner_username', 'alliance_tag',
            'defense_tier', 'is_under_attack', 'is_control_tower',
            'ad_slot_enabled', 'is_landmark', 'landmark_name',
        ]

    def get_alliance_tag(self, obj):
        return obj.alliance.tag if obj.alliance else None


class BuildingSerializer(serializers.ModelSerializer):
    class Meta:
        model = Building
        fields = ['id', 'building_type', 'level', 'is_operational',
                  'under_construction', 'construction_ends_at', 'effects']


class TerritoryDetailSerializer(serializers.ModelSerializer):
    """Full territory detail — returned on click/detail request."""
    owner = PlayerPublicSerializer(read_only=True)
    alliance_tag = serializers.SerializerMethodField()
    buildings = BuildingSerializer(many=True, read_only=True)
    production_rates = serializers.SerializerMethodField()
    can_be_attacked = serializers.SerializerMethodField()
    recent_history = serializers.SerializerMethodField()
    current_battle_id = serializers.UUIDField(source='current_battle.id', default=None)

    class Meta:
        model = Territory
        fields = [
            'h3_index', 'h3_resolution', 'territory_type', 'country_code',
            'region_name', 'place_name', 'elevation_meters', 'population_density',
            'owner', 'alliance_tag', 'captured_at',
            'defense_tier', 'defense_points', 'max_defense_points', 'fortification_level',
            'stockpile_energy', 'stockpile_food', 'stockpile_credits',
            'stockpile_culture', 'stockpile_materials', 'stockpile_intel',
            'stockpile_capacity', 'production_rates',
            'is_control_tower', 'control_tower_type', 'is_capital',
            'is_landmark', 'landmark_name', 'landmark_bonus',
            'terrain_attack_modifier', 'terrain_defense_modifier',
            'is_under_attack', 'current_battle_id',
            'ad_slot_enabled', 'ad_slot_tier', 'daily_viewer_count',
            'buildings', 'can_be_attacked', 'recent_history',
        ]

    def get_alliance_tag(self, obj):
        return obj.alliance.tag if obj.alliance else None

    def get_production_rates(self, obj):
        return obj.get_production_rates()

    def get_can_be_attacked(self, obj):
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return False
        can, _ = obj.can_be_attacked_by(request.user)
        return can

    def get_recent_history(self, obj):
        history = obj.history.select_related('new_owner', 'previous_owner').order_by('-timestamp')[:5]
        return [{
            'change_type': h.change_type,
            'new_owner': h.new_owner.username if h.new_owner else None,
            'previous_owner': h.previous_owner.username if h.previous_owner else None,
            'timestamp': h.timestamp.isoformat(),
        } for h in history]


# ─── Combat ───────────────────────────────────────────────────────────────────

class MilitaryUnitSerializer(serializers.ModelSerializer):
    class Meta:
        model = MilitaryUnit
        fields = ['id', 'unit_type', 'count', 'status', 'morale', 'territory']


class BattleParticipantSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='player.username')

    class Meta:
        model = BattleParticipant
        fields = ['id', 'username', 'side', 'units_deployed',
                  'units_survived', 'units_lost', 'xp_earned', 'is_commander']


class BattleSerializer(serializers.ModelSerializer):
    participants = BattleParticipantSerializer(many=True, read_only=True)
    territory_h3 = serializers.CharField(source='target_territory.h3_index')
    territory_name = serializers.CharField(source='target_territory.place_name', default='')
    defender_username = serializers.CharField(source='defender.username', default=None)
    time_remaining_seconds = serializers.SerializerMethodField()

    class Meta:
        model = Battle
        fields = [
            'id', 'territory_h3', 'territory_name', 'defender_username',
            'battle_type', 'status', 'started_at', 'resolves_at', 'completed_at',
            'winner', 'territory_captured', 'attacker_casualties', 'defender_casualties',
            'resources_looted', 'combat_log', 'participants', 'time_remaining_seconds',
        ]

    def get_time_remaining_seconds(self, obj):
        from django.utils import timezone
        if obj.status == Battle.BattleStatus.COMPLETED:
            return 0
        delta = obj.resolves_at - timezone.now()
        return max(0, int(delta.total_seconds()))


# ─── Economy & Shop ───────────────────────────────────────────────────────────

class ShopItemSerializer(serializers.ModelSerializer):
    is_available = serializers.SerializerMethodField()
    price_eur_display = serializers.SerializerMethodField()

    class Meta:
        model = ShopItem
        fields = [
            'id', 'code', 'name', 'description', 'category',
            'price_tdc', 'price_eur', 'price_eur_display',
            'effect_type', 'effect_value', 'effect_duration_seconds',
            'max_per_day', 'hard_cap_pct', 'is_active', 'is_limited',
            'available_until', 'icon_url', 'rarity', 'is_available',
        ]

    def get_is_available(self, obj):
        return obj.is_available()

    def get_price_eur_display(self, obj):
        return f"€{obj.price_eur:.2f}" if obj.price_eur else None


class PlayerInventorySerializer(serializers.ModelSerializer):
    item = ShopItemSerializer(read_only=True)

    class Meta:
        model = PlayerInventory
        fields = ['id', 'item', 'quantity', 'acquired_at', 'expires_at']


# ─── Alliance ─────────────────────────────────────────────────────────────────

class AllianceSerializer(serializers.ModelSerializer):
    leader_username = serializers.CharField(source='leader.username')
    member_count = serializers.IntegerField(source='total_members')
    territory_count = serializers.IntegerField(source='total_territories')

    class Meta:
        model = Alliance
        fields = [
            'id', 'tag', 'name', 'description', 'tier',
            'banner_color', 'banner_symbol',
            'leader_username', 'member_count', 'territory_count',
            'war_score', 'season_score', 'is_recruiting',
            'min_rank_to_join', 'require_approval', 'created_at',
        ]


class AllianceMemberSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='player.username')
    display_name = serializers.CharField(source='player.display_name')
    commander_rank = serializers.IntegerField(source='player.commander_rank')
    territories_owned = serializers.SerializerMethodField()

    class Meta:
        model = AllianceMember
        fields = ['id', 'username', 'display_name', 'commander_rank',
                  'role', 'territories_owned', 'battles_fought_for_alliance',
                  'territories_taken_for_alliance', 'joined_at']

    def get_territories_owned(self, obj):
        try:
            return obj.player.stats.territories_owned
        except Exception:
            return 0


# ─── Ad Campaign (brand-facing) ───────────────────────────────────────────────

class AdCampaignPublicSerializer(serializers.ModelSerializer):
    """Safe fields for player-facing display."""

    class Meta:
        model = AdCampaign
        fields = [
            'id', 'brand_name', 'campaign_name', 'banner_url',
            'click_url', 'logo_url', 'targeting_type',
            'total_impressions', 'status',
        ]


class AdCampaignAdminSerializer(serializers.ModelSerializer):
    """Full fields for admin/brand portal."""

    class Meta:
        model = AdCampaign
        fields = '__all__'
