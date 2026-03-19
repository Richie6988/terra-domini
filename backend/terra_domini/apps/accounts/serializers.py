from rest_framework import serializers
from terra_domini.apps.accounts.models import Player, PlayerStats


class PlayerStatsSerializer(serializers.ModelSerializer):
    class Meta:
        model = PlayerStats
        fields = [
            'territories_owned', 'territories_captured', 'territories_lost',
            'battles_won', 'battles_lost', 'total_resources_produced',
            'season_score', 'season_rank', 'tdc_earned_total',
        ]


class PlayerPublicSerializer(serializers.ModelSerializer):
    stats = PlayerStatsSerializer(read_only=True)
    alliance_tag = serializers.SerializerMethodField()

    class Meta:
        model = Player
        fields = [
            'id', 'username', 'display_name', 'commander_rank',
            'spec_path', 'is_online', 'date_joined', 'stats', 'alliance_tag',
        ]

    def get_alliance_tag(self, obj):
        try:
            return obj.alliance_member.alliance.tag
        except Exception:
            return None


class PlayerMeSerializer(serializers.ModelSerializer):
    stats = PlayerStatsSerializer(read_only=True)
    alliance_tag = serializers.SerializerMethodField()

    class Meta:
        model = Player
        fields = [
            'id', 'username', 'display_name', 'email',
            'commander_rank', 'commander_xp', 'spec_path',
            'tdc_in_game', 'total_tdc_purchased', 'total_tdc_earned',
            'is_online', 'date_joined', 'wallet_address',
            'push_token', 'notification_preferences',
            'stats', 'alliance_tag',
        ]
        read_only_fields = [
            'id', 'email', 'commander_rank', 'commander_xp',
            'tdc_in_game', 'total_tdc_purchased', 'total_tdc_earned',
            'date_joined',
        ]

    def get_alliance_tag(self, obj):
        try:
            return obj.alliance_member.alliance.tag
        except Exception:
            return None


class RegisterSerializer(serializers.Serializer):
    email = serializers.EmailField()
    username = serializers.CharField(min_length=3, max_length=30)
    password = serializers.CharField(min_length=8, write_only=True)
    ref_code = serializers.CharField(required=False, allow_blank=True)

    def validate_username(self, value):
        import re
        if not re.match(r'^[a-zA-Z0-9_-]+$', value):
            raise serializers.ValidationError("Username can only contain letters, numbers, _ and -")
        if Player.objects.filter(username__iexact=value).exists():
            raise serializers.ValidationError("Username already taken")
        return value

    def validate_email(self, value):
        if Player.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError("Email already registered")
        return value.lower()


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)
