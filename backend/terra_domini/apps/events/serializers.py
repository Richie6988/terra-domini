from rest_framework import serializers
from terra_domini.apps.events.models import ControlTowerEvent, WorldEvent


class ControlTowerEventSerializer(serializers.ModelSerializer):
    territory_name         = serializers.CharField(source='territory.place_name', read_only=True)
    territory_lat          = serializers.FloatField(source='territory.center_lat', read_only=True)
    territory_lon          = serializers.FloatField(source='territory.center_lon', read_only=True)
    winning_alliance       = serializers.SerializerMethodField()
    time_until_start_s     = serializers.SerializerMethodField()
    status_display         = serializers.CharField(source='get_status_display', read_only=True)
    registered_count       = serializers.SerializerMethodField()
    my_alliance_registered = serializers.SerializerMethodField()
    my_player_registered   = serializers.SerializerMethodField()

    class Meta:
        model  = ControlTowerEvent
        fields = [
            'id', 'territory_name', 'territory_lat', 'territory_lon',
            'status', 'status_display', 'announced_at', 'starts_at', 'ends_at',
            'min_participants', 'winner_score', 'total_participants',
            'reward_bonus', 'winning_alliance', 'time_until_start_s',
        ]


    def get_registered_count(self, obj):
        try:
            return obj.registered_alliances.count()
        except Exception:
            return 0

    def get_my_alliance_registered(self, obj):
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return False
        try:
            alliance = request.user.alliance_member.alliance
            return obj.registered_alliances.filter(id=alliance.id).exists()
        except Exception:
            return False

    def get_my_player_registered(self, obj):
        """True if player has no alliance but already tried to register (session-based)."""
        return False  # extend with PlayerTowerRegistration model later

    def get_winning_alliance(self, obj):
        if obj.winning_alliance:
            return {'tag': obj.winning_alliance.tag, 'name': obj.winning_alliance.name}
        return None

    def get_time_until_start_s(self, obj):
        return obj.time_until_start()


class WorldEventSerializer(serializers.ModelSerializer):
    type_display = serializers.CharField(source='get_event_type_display', read_only=True)

    class Meta:
        model  = WorldEvent
        fields = [
            'id', 'name', 'description', 'event_type', 'type_display',
            'is_global', 'affected_countries', 'effects',
            'starts_at', 'ends_at', 'is_active',
        ]
