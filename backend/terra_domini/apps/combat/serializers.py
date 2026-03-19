from rest_framework import serializers
from terra_domini.apps.combat.engine import Battle, BattleParticipant, MilitaryUnit


class BattleSerializer(serializers.ModelSerializer):
    attacker_username = serializers.SerializerMethodField()
    defender_username = serializers.SerializerMethodField()
    territory_name    = serializers.SerializerMethodField()
    status_display    = serializers.CharField(source='get_status_display', read_only=True)
    type_display      = serializers.CharField(source='get_battle_type_display', read_only=True)
    time_remaining_s  = serializers.SerializerMethodField()

    class Meta:
        model  = Battle
        fields = [
            'id', 'attacker_username', 'defender_username', 'territory_name',
            'status', 'status_display', 'battle_type', 'type_display',
            'started_at', 'resolves_at', 'completed_at',
            'winner', 'resources_looted', 'time_remaining_s',
        ]

    def get_attacker_username(self, obj):
        try:
            p = obj.participants.filter(is_commander=True).first()
            return p.player.username if p else 'Unknown'
        except Exception:
            return 'Unknown'

    def get_defender_username(self, obj):
        if obj.defender:
            return obj.defender.username
        return obj.target_territory.owner.username if obj.target_territory.owner else 'Unclaimed'

    def get_territory_name(self, obj):
        return obj.target_territory.place_name or obj.target_territory.h3_index

    def get_time_remaining_s(self, obj):
        if not obj.resolves_at:
            return None
        from django.utils import timezone
        delta = obj.resolves_at - timezone.now()
        return max(0, int(delta.total_seconds()))


class MilitaryUnitSerializer(serializers.ModelSerializer):
    unit_type_display = serializers.CharField(source='get_unit_type_display', read_only=True)

    class Meta:
        model  = MilitaryUnit
        fields = ['id', 'unit_type', 'unit_type_display', 'quantity', 'attack_power',
                  'defense_power', 'training_cost_tdc', 'maintenance_per_tick']
