"""
Territory Engine — core game logic for territory operations.
H3 hex grid, resource ticks, capture mechanics, geo queries.
"""
import h3
import logging
from typing import Optional
from decimal import Decimal
from django.conf import settings
from django.utils import timezone
from django.core.cache import caches

logger = logging.getLogger('terra_domini.territories')

GAME_CFG = getattr(settings, 'GAME', {
    'H3_DEFAULT_RESOLUTION': 10,
    'TERRITORY_TICK_SECONDS': 300,
    'OFFLINE_INCOME_RATE': 0.40,
    'MAX_ALLIANCE_SQUAD': 5, 'MAX_ALLIANCE_GUILD': 25, 'MAX_ALLIANCE_FEDERATION': 500,
})
GAME_CACHE = caches['game_state']

# Resource production base rates by territory type (per 5-min tick)
BASE_PRODUCTION = {
    'urban':      {'energy': 20, 'food': 5,  'credits': 30, 'culture': 15, 'materials': 8,  'intel': 5},
    'rural':      {'energy': 5,  'food': 40, 'credits': 5,  'culture': 5,  'materials': 15, 'intel': 2},
    'industrial': {'energy': 30, 'food': 2,  'credits': 20, 'culture': 2,  'materials': 40, 'intel': 5},
    'coastal':    {'energy': 10, 'food': 25, 'credits': 25, 'culture': 10, 'materials': 10, 'intel': 15},
    'landmark':   {'energy': 10, 'food': 5,  'credits': 50, 'culture': 60, 'materials': 5,  'intel': 8},
    'mountain':   {'energy': 15, 'food': 5,  'credits': 8,  'culture': 8,  'materials': 30, 'intel': 20},
    'forest':     {'energy': 5,  'food': 20, 'credits': 5,  'culture': 15, 'materials': 25, 'intel': 10},
}

# Terrain attack/defense modifiers by type
TERRAIN_COMBAT_MODIFIERS = {
    'urban':      {'attack': 0.8, 'defense': 1.3, 'movement': 1.0},
    'rural':      {'attack': 1.0, 'defense': 1.0, 'movement': 1.0},
    'industrial': {'attack': 0.9, 'defense': 1.1, 'movement': 1.0},
    'coastal':    {'attack': 1.1, 'defense': 0.9, 'movement': 1.2},
    'landmark':   {'attack': 0.7, 'defense': 1.5, 'movement': 0.9},
    'mountain':   {'attack': 0.6, 'defense': 1.8, 'movement': 2.0},
    'forest':     {'attack': 0.8, 'defense': 1.4, 'movement': 1.5},
}


class TerritoryEngine:

    @staticmethod
    def get_neighbors(h3_index: str, k: int = 1) -> list[str]:
        """Get k-ring neighbors of a hex cell."""
        return [c for c in h3.k_ring(h3_index, k) if c != h3_index]

    @staticmethod
    def get_h3_from_latlon(lat: float, lon: float, resolution: int = 10) -> str:
        """Convert lat/lon to H3 index."""
        return h3.geo_to_h3(lat, lon, resolution)

    @staticmethod
    def get_hex_boundary(h3_index: str) -> list[tuple]:
        """Get polygon boundary of hex cell as lat/lon pairs."""
        return h3.h3_to_geo_boundary(h3_index)

    @staticmethod
    def hex_distance(h3_a: str, h3_b: str) -> int:
        """Grid distance between two H3 cells."""
        return h3.h3_distance(h3_a, h3_b)

    @staticmethod
    def get_region_hexes(center_h3: str, radius_k: int) -> list[str]:
        """All hexes within radius_k from center."""
        return list(h3.k_ring(center_h3, radius_k))

    @staticmethod
    def get_path(h3_from: str, h3_to: str) -> list[str]:
        """Get the grid path between two hexes."""
        return h3.h3_line(h3_from, h3_to)

    @classmethod
    def compute_base_production(cls, territory_type: str) -> dict:
        """Base resource production rates for a territory type."""
        return dict(BASE_PRODUCTION.get(territory_type, BASE_PRODUCTION['rural']))

    @classmethod
    def apply_production_tick(cls, territory) -> dict:
        """
        Apply one resource production tick to a territory.
        Returns dict of resources added.
        Called every TERRITORY_TICK_SECONDS (300s = 5min).
        """
        from terra_domini.apps.territories.models import Territory

        if not territory.owner:
            return {}

        is_online = TerritoryEngine._is_player_online(territory.owner_id)
        production = territory.get_production_rates()

        # Offline income penalty
        if not is_online:
            production = {k: v * GAME_CFG['OFFLINE_INCOME_RATE'] for k, v in production.items()}

        # Apply building bonuses
        for building in territory.buildings.filter(is_operational=True, under_construction=False):
            if 'resource_bonus' in building.effects:
                for resource, bonus in building.effects['resource_bonus'].items():
                    if resource in production:
                        production[resource] *= (1 + bonus)

        # Apply control tower bonuses
        if territory.is_control_tower and territory.owner:
            production = {k: v * 1.5 for k, v in production.items()}

        # Clamp to stockpile capacity
        added = {}
        for resource, amount in production.items():
            stockpile_field = f'stockpile_{resource}'
            current = getattr(territory, stockpile_field, 0.0)
            space = territory.stockpile_capacity - current
            to_add = min(amount, space)
            if to_add > 0:
                setattr(territory, stockpile_field, current + to_add)
                added[resource] = to_add

        territory.last_tick = timezone.now()
        territory.save(update_fields=[
            'stockpile_energy', 'stockpile_food', 'stockpile_credits',
            'stockpile_culture', 'stockpile_materials', 'stockpile_intel',
            'last_tick'
        ])

        # Update player total resource counts in cache
        cls._update_player_resource_cache(territory.owner_id, added)

        return added

    @classmethod
    def claim_territory(cls, territory, player) -> tuple[bool, str]:
        """
        Claim an unclaimed territory for a player.
        Returns (success, message).
        """
        if territory.owner:
            return False, "Territory already owned"

        if territory.territory_type == 'water':
            return False, "Water territories cannot be claimed"

        territory.owner = player
        territory.captured_at = timezone.now()
        territory.defense_tier = 1
        territory.defense_points = 100
        territory.max_defense_points = 100
        territory.save(update_fields=['owner', 'captured_at', 'defense_tier', 'defense_points', 'max_defense_points'])

        # Log ownership change
        cls._log_ownership_change(territory, None, player, 'claimed')

        # Invalidate cache
        cls._invalidate_territory_cache(territory.h3_index)

        # Update player stats
        cls._increment_player_stat(player.id, 'territories_owned', 1)
        cls._increment_player_stat(player.id, 'territories_captured', 1)

        logger.info(f"Territory {territory.h3_index} claimed by {player.username}")
        return True, "Territory claimed successfully"

    @classmethod
    def get_territory_state_cached(cls, h3_index: str) -> Optional[dict]:
        """Fast cache read for WebSocket broadcasts — skips DB."""
        cache_key = f'territory:{h3_index}'
        return GAME_CACHE.get(cache_key)

    @classmethod
    def set_territory_state_cache(cls, territory) -> None:
        """Write territory state to cache. Called after every state change."""
        cache_key = f'territory:{territory.h3_index}'
        data = {
            'h3': territory.h3_index,
            'owner_id': str(territory.owner_id) if territory.owner_id else None,
            'owner_username': territory.owner.username if territory.owner_id else None,
            'alliance_id': str(territory.alliance_id) if territory.alliance_id else None,
            'type': territory.territory_type,
            'defense_tier': territory.defense_tier,
            'defense_points': territory.defense_points,
            'is_under_attack': territory.is_under_attack,
            'is_control_tower': territory.is_control_tower,
            'production': territory.get_production_rates(),
            'ad_slot_enabled': territory.ad_slot_enabled,
            'updated_at': territory.updated_at.isoformat(),
        }
        GAME_CACHE.set(cache_key, data, timeout=None)

    @classmethod
    def get_map_region(cls, center_lat: float, center_lon: float, radius_km: float, resolution: int = 10) -> list[dict]:
        """
        Get all territory states in a geographic region.
        Used for initial map load and viewport updates.
        """
        from terra_domini.apps.territories.models import Territory

        center_h3 = h3.geo_to_h3(center_lat, center_lon, resolution)
        # Approximate k-ring radius: each hex is ~0.5km at res 10
        k = max(1, int(radius_km / 0.5))
        hex_ids = list(h3.k_ring(center_h3, k))

        # Try cache first (hot path)
        territories = []
        uncached = []
        for h3_idx in hex_ids:
            cached = cls.get_territory_state_cached(h3_idx)
            if cached:
                territories.append(cached)
            else:
                uncached.append(h3_idx)

        if uncached:
            db_territories = Territory.objects.filter(
                h3_index__in=uncached
            ).select_related('owner', 'alliance').only(
                'h3_index', 'owner__username', 'alliance_id',
                'territory_type', 'defense_tier', 'defense_points',
                'is_under_attack', 'is_control_tower', 'ad_slot_enabled',
                'updated_at'
            )
            for t in db_territories:
                cls.set_territory_state_cache(t)
                territories.append(cls.get_territory_state_cached(t.h3_index))

        return territories

    # ─── Private helpers ──────────────────────────────────────────────────────

    @staticmethod
    def _is_player_online(player_id) -> bool:
        return bool(GAME_CACHE.get(f'online:{player_id}'))

    @staticmethod
    def _update_player_resource_cache(player_id, resources: dict) -> None:
        cache_key = f'player_resources:{player_id}'
        existing = GAME_CACHE.get(cache_key) or {}
        for k, v in resources.items():
            existing[k] = existing.get(k, 0) + v
        GAME_CACHE.set(cache_key, existing)

    @staticmethod
    def _invalidate_territory_cache(h3_index: str) -> None:
        GAME_CACHE.delete(f'territory:{h3_index}')

    @staticmethod
    def _log_ownership_change(territory, prev_owner, new_owner, change_type: str) -> None:
        from terra_domini.apps.territories.models import TerritoryOwnershipHistory
        TerritoryOwnershipHistory.objects.create(
            territory=territory,
            previous_owner=prev_owner,
            new_owner=new_owner,
            change_type=change_type,
        )

    @staticmethod
    def _increment_player_stat(player_id, field: str, amount: int) -> None:
        from terra_domini.apps.accounts.models import PlayerStats
        PlayerStats.objects.filter(player_id=player_id).update(**{f'{field}': models.F(field) + amount})
