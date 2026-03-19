from rest_framework import serializers
from terra_domini.apps.alliances.models import Alliance, AllianceMember, DiplomaticRelation


class AllianceMemberSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='player.username', read_only=True)
    commander_rank = serializers.IntegerField(source='player.commander_rank', read_only=True)
    is_online = serializers.BooleanField(source='player.is_online', read_only=True)

    class Meta:
        model = AllianceMember
        fields = ['id', 'username', 'commander_rank', 'is_online', 'role', 'joined_at', 'contribution_score']


class AllianceSerializer(serializers.ModelSerializer):
    member_count = serializers.SerializerMethodField()
    leader_username = serializers.CharField(source='leader.username', read_only=True)
    tier_display = serializers.CharField(source='get_tier_display', read_only=True)

    class Meta:
        model = Alliance
        fields = [
            'id', 'name', 'tag', 'description', 'tier', 'tier_display',
            'leader_username', 'member_count', 'banner_color',
            'total_territories', 'war_score', 'season_score',
            'treasury_tdc', 'is_recruiting', 'min_rank_to_join',
            'created_at',
        ]

    def get_member_count(self, obj):
        return obj.members.count()


class DiplomacySerializer(serializers.ModelSerializer):
    alliance_a_tag = serializers.CharField(source='alliance_a.tag', read_only=True)
    alliance_b_tag = serializers.CharField(source='alliance_b.tag', read_only=True)
    state_display = serializers.CharField(source='get_state_display', read_only=True)

    class Meta:
        model = DiplomaticRelation
        fields = ['id', 'alliance_a', 'alliance_a_tag', 'alliance_b', 'alliance_b_tag',
                  'state', 'state_display', 'proposed_at', 'accepted_at', 'expires_at']
        read_only_fields = ['id', 'proposed_at', 'accepted_at']
