"""
Combat models — declared here, CombatEngine logic stays in engine.py.
"""
# Models are defined in engine.py to keep logic colocated.
# This file exists so Django migration framework finds the app correctly.
from terra_domini.apps.combat.engine import Battle, BattleParticipant, MilitaryUnit

__all__ = ['Battle', 'BattleParticipant', 'MilitaryUnit']
