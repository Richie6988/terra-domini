"""
Combat System — Battle models and resolution engine.
Automated resolution: strategy > skill, no twitch mechanics.
"""
import uuid
import logging
import math
from decimal import Decimal
from django.db import models
from django.conf import settings
from django.utils import timezone

logger = logging.getLogger('terra_domini.combat')

# Safe fallback — works even without GAME in settings (Codespace dev)
GAME_CFG = getattr(settings, 'GAME', {
    'BATTLE_TIMER': {'HEX': 14400, 'DISTRICT': 21600, 'CITY': 43200, 'CAPITAL': 259200},
    'MAX_MILITARY_BOOST_PCT': 25,
    'SHIELD_MAX_HOURS_PER_DAY': 12,
    'BEGINNER_PROTECTION_DAYS': 7,
    'TERRITORY_TICK_SECONDS': 300,
    'OFFLINE_INCOME_RATE': 0.40,
    'MAX_ALLIANCE_SQUAD': 5,
    'MAX_ALLIANCE_GUILD': 25,
    'MAX_ALLIANCE_FEDERATION': 500,
})


# ─── Models ──────────────────────────────────────────────────────────────────

class Battle(models.Model):
    """An active or completed battle on a territory."""

    class BattleStatus(models.TextChoices):
        PREPARING = 'preparing', 'Preparing'
        ACTIVE = 'active', 'Active'
        RESOLVING = 'resolving', 'Resolving'
        COMPLETED = 'completed', 'Completed'
        CANCELLED = 'cancelled', 'Cancelled'

    class BattleType(models.TextChoices):
        CONQUEST = 'conquest', 'Conquest'
        RAID = 'raid', 'Raid'          # steal resources, no ownership change
        SIEGE = 'siege', 'Siege'       # reduce defense without capturing
        SURPRISE = 'surprise', 'Surprise Attack'  # shorter timer, higher risk

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    target_territory = models.ForeignKey(
        'territories.Territory',
        on_delete=models.CASCADE,
        related_name='battles'
    )
    defender = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True, blank=True,
        on_delete=models.SET_NULL,
        related_name='defensive_battles'
    )

    battle_type = models.CharField(max_length=20, choices=BattleType.choices, default=BattleType.CONQUEST)
    status = models.CharField(max_length=20, choices=BattleStatus.choices, default=BattleStatus.PREPARING)

    # Timing
    started_at = models.DateTimeField(auto_now_add=True)
    resolves_at = models.DateTimeField()  # When battle auto-resolves
    completed_at = models.DateTimeField(null=True, blank=True)

    # Outcome
    winner = models.CharField(max_length=10, blank=True)  # 'attacker', 'defender'
    territory_captured = models.BooleanField(default=False)
    attacker_casualties = models.JSONField(default=dict)  # {unit_type: count}
    defender_casualties = models.JSONField(default=dict)
    resources_looted = models.JSONField(default=dict)

    # Combat log (for replay)
    combat_log = models.JSONField(default=list)

    # Alliance coordination
    alliance_assault = models.ForeignKey(
        'alliances.AllianceOperation',
        null=True, blank=True,
        on_delete=models.SET_NULL
    )

    class Meta:
        db_table = 'battles'
        indexes = [
            models.Index(fields=['status']),
            models.Index(fields=['resolves_at']),
        ]

    def __str__(self):
        return f"Battle on {self.target_territory_id} (status: {self.status})"


class BattleParticipant(models.Model):
    """A player's participation in a battle."""

    class Side(models.TextChoices):
        ATTACKER = 'attacker', 'Attacker'
        DEFENDER = 'defender', 'Defender'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    battle = models.ForeignKey(Battle, on_delete=models.CASCADE, related_name='participants')
    player = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='battle_participations')
    side = models.CharField(max_length=10, choices=Side.choices)

    # Units deployed (committed, locked until battle resolves)
    units_deployed = models.JSONField(default=dict)  # {unit_type: count}
    units_survived = models.JSONField(default=dict)
    units_lost = models.JSONField(default=dict)

    # Resources contributed
    resources_contributed = models.JSONField(default=dict)
    resources_gained = models.JSONField(default=dict)

    # Individual outcome
    xp_earned = models.IntegerField(default=0)
    joined_at = models.DateTimeField(auto_now_add=True)
    is_commander = models.BooleanField(default=False)  # First attacker / territory owner

    class Meta:
        db_table = 'battle_participants'
        unique_together = ['battle', 'player']


class MilitaryUnit(models.Model):
    """Player's military units (garrison on a territory or in transit)."""

    class UnitType(models.TextChoices):
        INFANTRY = 'infantry', 'Infantry'
        CAVALRY = 'cavalry', 'Cavalry'
        ARTILLERY = 'artillery', 'Artillery'
        AIR = 'air', 'Air Support'
        NAVAL = 'naval', 'Naval'

    class UnitStatus(models.TextChoices):
        GARRISON = 'garrison', 'Garrisoned'
        MARCHING = 'marching', 'Marching'
        BESIEGING = 'besieging', 'Besieging'
        RECOVERING = 'recovering', 'Recovering'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    player = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='units')
    territory = models.ForeignKey(
        'territories.Territory',
        null=True, blank=True,
        on_delete=models.SET_NULL,
        related_name='garrisoned_units'
    )
    unit_type = models.CharField(max_length=20, choices=UnitType.choices)
    count = models.IntegerField(default=0)
    status = models.CharField(max_length=20, choices=UnitStatus.choices, default=UnitStatus.GARRISON)

    # Morale (0-100, affects combat effectiveness)
    morale = models.FloatField(default=100.0)

    # Boost from P2W items (hard capped at 25%)
    boost_pct = models.FloatField(default=0.0)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'military_units'
        indexes = [
            models.Index(fields=['player', 'unit_type']),
            models.Index(fields=['territory']),
        ]


# ─── Combat Engine ───────────────────────────────────────────────────────────

# Unit stats: [attack_power, defense_power, training_cost (materials), speed_modifier]
UNIT_STATS = {
    'infantry':  {'atk': 10,  'def': 12,  'cost_materials': 50,  'terrain_bonus': {'urban': 1.2, 'forest': 1.1}},
    'cavalry':   {'atk': 18,  'def': 8,   'cost_materials': 120, 'terrain_bonus': {'rural': 1.3, 'coastal': 1.2}},
    'artillery': {'atk': 35,  'def': 4,   'cost_materials': 300, 'terrain_bonus': {}},
    'air':       {'atk': 25,  'def': 6,   'cost_materials': 500, 'terrain_bonus': {'mountain': 0.7}},
    'naval':     {'atk': 20,  'def': 15,  'cost_materials': 400, 'terrain_bonus': {'coastal': 1.5}},
    # recruitment.UNIT_DEFS names these 'aerial' and 'spy' — without them recruited units fought with 0 attack
    'aerial':    {'atk': 25,  'def': 6,   'cost_materials': 250, 'terrain_bonus': {'mountain': 0.7}},
    'spy':       {'atk': 5,   'def': 3,   'cost_materials': 150, 'terrain_bonus': {}},
}

DEFENSE_TIER_MULTIPLIER = {1: 1.0, 2: 1.3, 3: 1.7, 4: 2.2, 5: 3.0}
SURPRISE_ATK_MULT = 0.85  # surprise attack: half timer (less time for the defender to reinforce), -15% attack


def active_boost_pct(player_id, boost_type: str) -> float:
    """Best active shop boost of this type for a player, as a % capped at MAX_MILITARY_BOOST_PCT."""
    if not player_id:
        return 0.0
    from django.db.models import Q
    from terra_domini.apps.economy.models import ActiveBoost
    vals = ActiveBoost.objects.filter(player_id=player_id, boost_type=boost_type).filter(
        Q(expires_at__isnull=True) | Q(expires_at__gt=timezone.now())).values_list('boost_value', flat=True)
    best = max(vals, default=1.0)
    return max(0.0, min((float(best) - 1.0) * 100.0, GAME_CFG['MAX_MILITARY_BOOST_PCT']))


class CombatEngine:

    @classmethod
    def calculate_attack_power(cls, units: dict, territory_type: str, boost_pct: float = 0.0, levels: dict | None = None) -> float:
        """Total attack power of a unit composition (unit levels: +10 % each, combat/units.py)."""
        from terra_domini.apps.combat.units import level_mult
        levels = levels or {}
        total = 0.0
        for unit_type, count in units.items():
            if unit_type not in UNIT_STATS or count <= 0:
                continue
            stats = UNIT_STATS[unit_type]
            base_atk = stats['atk'] * count * level_mult(levels.get(unit_type))
            terrain_bonus = stats['terrain_bonus'].get(territory_type, 1.0)
            total += base_atk * terrain_bonus

        # Apply P2W boost (hard capped at 25%)
        boost_pct = min(boost_pct, GAME_CFG['MAX_MILITARY_BOOST_PCT']) / 100.0
        return total * (1 + boost_pct)

    @classmethod
    def calculate_defense_power(cls, territory, units: dict, boost_pct: float = 0.0, spies: int = 0) -> float:
        """Total defense power: territory fortifications (cut by the attacker's spies) + garrisoned units
        (owner's unit levels: +10 % each)."""
        from terra_domini.apps.combat.units import level_mult, sabotage
        # Territory base defense
        defense_tier_mult = DEFENSE_TIER_MULTIPLIER.get(territory.defense_tier, 1.0)
        base_defense = territory.defense_points * defense_tier_mult * territory.terrain_defense_modifier * (1 - sabotage(spies))
        levels = {}
        if territory.owner_id:
            from terra_domini.apps.accounts.models import Player
            levels = Player.objects.filter(id=territory.owner_id).values_list('unit_levels', flat=True).first() or {}

        # Unit defense
        unit_defense = 0.0
        for unit_type, count in units.items():
            if unit_type not in UNIT_STATS or count <= 0:
                continue
            stats = UNIT_STATS[unit_type]
            base_def = stats['def'] * count * level_mult(levels.get(unit_type))
            terrain_bonus = stats['terrain_bonus'].get(territory.territory_type, 1.0)
            unit_defense += base_def * terrain_bonus

        # Morale factor on units (average morale of all defenders)
        morale_factor = 1.0  # TODO: pull from actual unit records

        boost_pct = min(boost_pct, GAME_CFG['MAX_MILITARY_BOOST_PCT']) / 100.0
        total = (base_defense + unit_defense * morale_factor) * (1 + boost_pct)
        return total

    @staticmethod
    def kingdom_garrisons(territory):
        """Garrison stacks that defend this hex: units assigned to any hex of the same connected kingdom."""
        if not territory.owner_id:
            return []
        from terra_domini.apps.territories.models import Territory
        from terra_domini.utils.h3_compat import k_ring
        owned = set(Territory.objects.filter(owner_id=territory.owner_id).values_list('h3_index', flat=True))
        kingdom, todo = {territory.h3_index}, [territory.h3_index]
        while todo:
            for n in k_ring(todo.pop(), 1):
                if n in owned and n not in kingdom:
                    kingdom.add(n); todo.append(n)
        return list(MilitaryUnit.objects.filter(
            player_id=territory.owner_id, status=MilitaryUnit.UnitStatus.GARRISON,
            territory__h3_index__in=kingdom, count__gt=0))

    @classmethod
    def garrison_dict(cls, territory) -> dict:
        out = {}
        for g in cls.kingdom_garrisons(territory):
            out[g.unit_type] = out.get(g.unit_type, 0) + g.count
        return out

    @classmethod
    def defender_units(cls, battle, territory) -> dict:
        """Defending forces = reinforcement participants + the kingdom's garrisons."""
        units = cls._aggregate_units(battle.participants.filter(side=BattleParticipant.Side.DEFENDER))
        for g in cls.kingdom_garrisons(territory):
            units[g.unit_type] = units.get(g.unit_type, 0) + g.count
        return units

    @classmethod
    def resolve_battle(cls, battle: Battle) -> dict:
        """Attack points meet the target kingdom's defense points 1 for 1 (combat/forces.py): both lose min(N, DEF).
        N > DEF → the hex is captured and the leftover attack points stay on it."""
        from terra_domini.apps.combat import forces as Fz
        territory = battle.target_territory
        attackers = list(battle.participants.filter(side=BattleParticipant.Side.ATTACKER))
        n = sum(int((p.units_deployed or {}).get('attack', 0)) for p in attackers)
        kingdom = Fz.kingdom_hexes(territory.owner_id, territory.h3_index) if territory.owner_id else [territory.h3_index]
        dfn = Fz.pools(kingdom)['defense']
        # Upgrades: Influence of the attacking kingdom (where the points left from), Fortification of the defender
        from terra_domini.apps.territories import upgrades as U
        src = next((p.resources_contributed or {}).get('from') for p in attackers if (p.resources_contributed or {}).get('from')) if attackers else None
        am = U.kingdom_mult(Fz.kingdom_hexes(attackers[0].player_id, src), 'attack') if src and attackers else 1.0
        dm = U.kingdom_mult(kingdom, 'defense') if territory.owner_id else 1.0
        atk_power, def_power = n * am, dfn * dm
        attacker_wins = atk_power > def_power
        if attacker_wins:      # all the defense falls; the attack loses what it took to break it
            spent, used = dfn, min(n, math.ceil(def_power / am)) if am else n
        else:                  # the attack is absorbed; the defense loses what it took to stop it
            spent, used = min(dfn, math.ceil(atk_power / dm)) if dm else dfn, n
        Fz.take(kingdom, 'defense', spent)
        leftover = n - used if attacker_wins else 0
        winner = 'attacker' if attacker_wins else 'defender'
        outcome = {
            'winner': winner,
            'territory_captured': attacker_wins and battle.battle_type in (Battle.BattleType.CONQUEST, Battle.BattleType.SURPRISE),
            'attacker_casualties': {'attack': n - leftover},
            'defender_casualties': {'defense': spent},
            'resources_looted': {},
            'combat_log': [{'event': 'clash', 'attack': n, 'defense': dfn, 'attack_mult': am, 'defense_mult': dm,
                            'spent': spent, 'leftover': leftover},
                           {'event': 'result', 'winner': winner}],
            'atk_power': round(atk_power), 'def_power': round(def_power), 'leftover': leftover,
        }
        cls._apply_battle_outcome(battle, territory, outcome)
        logger.info(f"Battle {battle.id} resolved. Winner: {winner}. ATK {n} vs DEF {dfn}")
        return outcome

    @classmethod
    def initiate_attack(cls, attacker, target_territory, points: int, battle_type: str = 'conquest') -> tuple[bool, str, 'Battle']:
        """Commit `points` attack points from the kingdom nearest to the target (combat/forces.py)."""
        from terra_domini.apps.combat import forces as Fz
        can_attack, reason = cls.can_attack(attacker, target_territory)
        if not can_attack:
            return False, reason, None
        points = int(points or 0)
        if points < 1:
            return False, "Commit at least 1 attack point", None
        src = Fz.source_kingdom(attacker.id, target_territory.h3_index)
        have = Fz.pools(src)['attack'] if src else 0
        if have < points:
            return False, f"Your nearest kingdom has {have} attack points — buy more on it", None
        Fz.take(src, 'attack', points)
        timer = cls._get_battle_timer(target_territory)
        if battle_type == 'surprise':
            timer = timer // 2
        battle = Battle.objects.create(
            target_territory=target_territory, defender=target_territory.owner, battle_type=battle_type,
            status=Battle.BattleStatus.ACTIVE, resolves_at=timezone.now() + timezone.timedelta(seconds=timer),
        )
        BattleParticipant.objects.create(battle=battle, player=attacker, side=BattleParticipant.Side.ATTACKER,
                                         units_deployed={'attack': points}, resources_contributed={'from': src[0]},
                                         is_commander=True)
        target_territory.is_under_attack = True
        target_territory.current_battle = battle.id
        target_territory.save(update_fields=['is_under_attack', 'current_battle'])
        return True, "Attack initiated", battle

    @classmethod
    def npc_attack(cls, bot, territory, points: int, battle_type: str = 'raid') -> 'Battle':
        """Bot raid: same as initiate_attack but the NPC's attack points come from nowhere."""
        timer = cls._get_battle_timer(territory)
        battle = Battle.objects.create(
            target_territory=territory, defender=territory.owner, battle_type=battle_type,
            status=Battle.BattleStatus.ACTIVE,
            resolves_at=timezone.now() + timezone.timedelta(seconds=timer),
        )
        BattleParticipant.objects.create(battle=battle, player=bot, side=BattleParticipant.Side.ATTACKER,
                                         units_deployed={'attack': int(points)}, is_commander=True)
        territory.is_under_attack = True
        territory.current_battle = battle.id
        territory.save(update_fields=['is_under_attack', 'current_battle'])
        return battle

    @staticmethod
    def can_attack(attacker, territory) -> tuple[bool, str]:
        if not territory.owner_id:
            return False, "Territory not claimed — use /claim instead"
        if territory.owner_id == attacker.id:
            return False, "Cannot attack your own territory"
        if territory.is_shielded():
            return False, "Territory is shielded"
        if territory.owner.is_protected:
            return False, "Owner is under protection"
        if territory.is_under_attack:
            return False, "Territory is already under attack"
        from terra_domini.apps.economy.balance import ATTACK_RANGE_RINGS, has_boost
        if not has_boost(attacker, 'distant_attack'):   # shop 'Distant Strike' lifts the range
            import h3
            from terra_domini.apps.territories.models import Territory
            from terra_domini.apps.territories.upgrades import influence_rings
            rings = ATTACK_RANGE_RINGS + influence_rings(attacker.id)   # kingdom Influence: +2 hexes per level
            try:
                near = list(h3.grid_disk(territory.h3_index, rings))
            except Exception:
                near = []
            if near and not Territory.objects.filter(owner=attacker, h3_index__in=near).exists():
                return False, (f"Out of range — attack within {rings} hexes of your land, "
                               f"or use Distant Strike from the Shop")
        return True, ""

    @classmethod
    def resolve_due(cls, battles) -> int:
        """Resolve expired battles inline — dev runs without Celery beat."""
        resolved = 0
        for battle in battles.filter(status=Battle.BattleStatus.ACTIVE, resolves_at__lte=timezone.now()):
            battle.status = Battle.BattleStatus.RESOLVING
            battle.save(update_fields=['status'])
            try:
                cls.resolve_battle(battle)
                resolved += 1
            except Exception:
                logger.exception(f"Battle {battle.id} resolution failed")
                battle.status = Battle.BattleStatus.ACTIVE
                battle.save(update_fields=['status'])
        return resolved

    # ─── Private ──────────────────────────────────────────────────────────────

    @staticmethod
    def _aggregate_units(participants) -> dict:
        totals = {}
        for p in participants:
            for unit_type, count in p.units_deployed.items():
                totals[unit_type] = totals.get(unit_type, 0) + count
        return totals

    @staticmethod
    def _apply_casualties(units: dict, rate: float) -> dict:
        return {k: max(0, int(v * rate)) for k, v in units.items()}

    @staticmethod
    def _get_battle_timer(territory) -> int:
        """Determine battle duration based on territory size/importance."""
        if getattr(territory, 'is_capital', False):
            return GAME_CFG['BATTLE_TIMER']['CAPITAL']
        if territory.is_control_tower:
            return GAME_CFG['BATTLE_TIMER']['CITY']
        if territory.territory_type == 'urban':
            return GAME_CFG['BATTLE_TIMER']['DISTRICT']
        return GAME_CFG['BATTLE_TIMER']['HEX']

    @classmethod
    def _apply_battle_outcome(cls, battle: Battle, territory, outcome: dict) -> None:
        from terra_domini.apps.territories.engine import TerritoryEngine

        winner = outcome['winner']
        attacker_participant = battle.participants.filter(
            side=BattleParticipant.Side.ATTACKER, is_commander=True
        ).first()

        if outcome['territory_captured'] and attacker_participant:
            prev_owner = territory.owner
            territory.owner = attacker_participant.player
            territory.captured_at = timezone.now()
            territory.previous_owner = prev_owner
            territory.defense_points = int(territory.max_defense_points * 0.3)  # Captured at 30% defense
            fields = ['owner', 'captured_at', 'previous_owner', 'defense_points']
            if territory.poi_name or territory.is_landmark:
                # Conquering a place card issues a new edition: more copies in circulation → each edition is worth less
                territory.nft_version = (territory.nft_version or 1) + 1
                fields.append('nft_version')
            territory.save(update_fields=fields)

            # No ownership-history model exists — Battle (territory_captured) + previous_owner are the record
            logger.info(f"Territory {territory.h3_index} conquered by {attacker_participant.player_id} from {getattr(prev_owner, 'id', None)}")

        # Apply looted resources
        if outcome['resources_looted'] and attacker_participant:
            for resource, amount in outcome['resources_looted'].items():
                stockpile_field = f'stockpile_{resource}'
                setattr(territory, stockpile_field,
                        max(0, getattr(territory, stockpile_field, 0) - amount))
            territory.save(update_fields=[f'stockpile_{r}' for r in outcome['resources_looted']])

        if attacker_participant:
            attacker_participant.units_lost = outcome['attacker_casualties']
            attacker_participant.units_survived = {'attack': outcome.get('leftover', 0)}
            attacker_participant.save(update_fields=['units_survived', 'units_lost'])
        if outcome['territory_captured']:
            # the previous owner's points on that hex are gone; the attack that broke through now holds it
            territory.atk_pts, territory.def_pts, territory.spy_pts = outcome.get('leftover', 0), 0, 0
            territory.save(update_fields=['atk_pts', 'def_pts', 'spy_pts'])

        # Update battle record
        battle.status = Battle.BattleStatus.COMPLETED
        battle.winner = winner
        battle.territory_captured = outcome['territory_captured']
        battle.attacker_casualties = outcome['attacker_casualties']
        battle.defender_casualties = outcome['defender_casualties']
        battle.resources_looted = outcome['resources_looted']
        battle.combat_log = outcome['combat_log']
        battle.completed_at = timezone.now()
        battle.save()

        # Clear attack state
        territory.is_under_attack = False
        territory.current_battle = None
        territory.save(update_fields=['is_under_attack', 'current_battle'])

        # Invalidate cache
        TerritoryEngine._invalidate_territory_cache(territory.h3_index)
