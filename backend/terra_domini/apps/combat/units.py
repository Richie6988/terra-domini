"""
Units: what each one is for, its level and its training time (owner 2026-10-19: "a dedicated training time per unit
that goes down with player level or unit evolutions; describe what units are and how they work; keep it simple").

- Training is one barracks queue: units come out ONE BY ONE, each with its own time
    time = base × (1 − 10 % per unit level) × (1 − 2 % per commander rank above 1, down to −40 %)
- Unit level 0-5, bought with HEX (cost doubles per level): +10 % attack and defence per level, −10 % training time.
- Spies sabotage: each spy sent in an attack cuts the target's fortifications by 4 % (max −40 %). They barely fight.
"""
from terra_domini.apps.economy.balance import TRAIN_SECONDS

UNIT_LEVEL_MAX = 5
LEVEL_POWER = 0.10          # +10 % atk/def per level
LEVEL_SPEED = 0.10          # −10 % training time per level
RANK_SPEED, RANK_SPEED_MAX = 0.02, 0.40
QUEUE_CAP = 10              # units waiting in the barracks queue
SPY_SABOTAGE, SPY_SABOTAGE_MAX = 0.04, 0.40

# What each unit is for — every line matches the real numbers in combat.engine.UNIT_STATS
ROLES = {
    'infantry':  ('Holds ground', 'Cheap and sturdy: best defender per HEX. +20 % in cities, +10 % in forests.'),
    'cavalry':   ('Fast striker', 'Strong attack, weak defence. +30 % in the countryside, +20 % on coasts.'),
    'artillery': ('Siege breaker', 'The hardest hitter, almost no defence: send it with infantry to break walls.'),
    'aerial':    ('Air strike', 'High attack anywhere, −30 % over mountains. Fragile in defence.'),
    'naval':     ('Coast master', 'Balanced, +50 % on coastal hexes: the unit to take and hold the shore.'),
    'spy':       ('Saboteur', 'Barely fights, but each spy sent cuts the target\'s fortifications by 4 % (max −40 %).'),
}


def levels_of(player) -> dict:
    return dict(getattr(player, 'unit_levels', None) or {})


def level_mult(level) -> float:
    return 1 + LEVEL_POWER * int(level or 0)


def upgrade_cost(unit_type: str, level: int) -> int:
    from terra_domini.apps.combat.recruitment import UNIT_DEFS
    return int(UNIT_DEFS[unit_type]['cost'] * 20 * (2 ** level))


def unit_seconds(player, unit_type: str) -> int:
    """Training time of ONE unit for this player."""
    lvl = int(levels_of(player).get(unit_type, 0))
    rank = int(getattr(player, 'commander_rank', 1) or 1)
    t = TRAIN_SECONDS.get(unit_type, 300) * (1 - LEVEL_SPEED * lvl) * (1 - min(RANK_SPEED_MAX, RANK_SPEED * (rank - 1)))
    if getattr(player, 'is_staff', False):
        t /= 12                     # staff: fast-track QA
    return max(10, int(round(t)))


def sabotage(spies: int) -> float:
    """Fraction of the fortifications removed by the spies sent."""
    return min(SPY_SABOTAGE_MAX, SPY_SABOTAGE * max(0, int(spies or 0)))
