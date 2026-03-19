from rest_framework import serializers
from terra_domini.apps.combat.engine import Battle, BattleParticipant, MilitaryUnit


class BattleSerializer(serializers.ModelSerializer):
    attacker_username = serializers.CharField(source='attacker.username', read_only=True)
    defender_username = serializers.SerializerMethodField()
    territory_name    = serializers.CharField(source='territory.place_name', read_only=True)
    status_display    = serializers.CharField(source='get_status_display', read_only=True)
    type_display      = serializers.CharField(source='get_battle_type_display', read_only=True)
    time_remaining_s  = serializers.SerializerMethodField()

    class Meta:
        model  = Battle
        fields = [
            'id', 'attacker_username', 'defender_username', 'territory_name',
            'status', 'status_display', 'battle_type', 'type_display',
            'started_at', 'estimated_end', 'resolved_at',
            'attacker_win_probability', 'actual_result',
            'resources_looted', 'time_remaining_s',
        ]

    def get_defender_username(self, obj):
        return obj.territory.owner.username if obj.territory.owner else 'Unclaimed'

    def get_time_remaining_s(self, obj):
        if not obj.estimated_end:
            return None
        from django.utils import timezone
        delta = obj.estimated_end - timezone.now()
        return max(0, int(delta.total_seconds()))


class MilitaryUnitSerializer(serializers.ModelSerializer):
    unit_type_display = serializers.CharField(source='get_unit_type_display', read_only=True)

    class Meta:
        model  = MilitaryUnit
        fields = ['id', 'unit_type', 'unit_type_display', 'quantity', 'attack_power',
                  'defense_power', 'training_cost_tdc', 'maintenance_per_tick']
