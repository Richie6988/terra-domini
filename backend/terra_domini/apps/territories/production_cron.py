"""
production_cron.py — Hexod daily resource production tick.

Rules (CDC §2.4 / §2.5):
  - Runs every 24h (or manually via management command)
  - For each owned territory: biome base × rarity_mult → stockpile
  - HEX Coin credited to player wallet (tdc_in_game)
  - Cluster bonus if territory is part of a kingdom (is_connected)
  - Shiny bonus: ×1.5 on all resources

Called by:
  - Celery beat (daily_hexod_production task)
  - Management command: python manage.py run_production
"""
import logging
from django.db import connection, transaction
from django.utils import timezone

logger = logging.getLogger('terra_domini.production')

# Biome base production per 24h (CDC §2.5)
BIOME_BASE: dict[str, dict[str, float]] = {
    'urban':      {'res_donnees': 12,    'res_influence': 8,    'res_main_oeuvre': 15},
    'rural':      {'res_nourriture': 20, 'res_eau': 15,         'res_main_oeuvre': 10},
    'forest':     {'res_nourriture': 15, 'res_eau': 12,         'res_stabilite': 8},
    'mountain':   {'res_fer': 18,        'res_titanium': 5,     'res_charbon': 10},
    'coastal':    {'res_nourriture': 12, 'res_eau': 20,         'res_gaz': 8},
    'desert':     {'res_petrole': 15,    'res_silicium': 10,    'res_terres_rares': 4},
    'tundra':     {'res_gaz': 12,        'res_uranium': 3,      'res_eau': 8},
    'industrial': {'res_acier': 15,      'res_composants': 8,   'res_petrole': 10},
    'landmark':   {'res_donnees': 10,    'res_influence': 12,   'res_stabilite': 10},
    'grassland':  {'res_nourriture': 18, 'res_main_oeuvre': 8,  'res_stabilite': 6},
}

# Rarity multiplier on all resources (CDC §2.5)
RARITY_MULT: dict[str, float] = {
    'common':    1.0,
    'uncommon':  1.3,
    'rare':      1.7,
    'epic':      2.2,
    'legendary': 3.0,
    'mythic':    5.0,
}

# HEX Coin per day per rarity (CDC §2.4)
RARITY_HEX_COIN: dict[str, float] = {
    'common':    10,
    'uncommon':  30,
    'rare':      80,
    'epic':      200,
    'legendary': 500,
    'mythic':    2000,
}

SHINY_MULT = 1.5
CLUSTER_BONUS = 1.15  # +15% if territory is in a connected cluster


def run_production_tick(batch_size: int = 500) -> dict:
    """
    Main production function. Safe to call multiple times (idempotent per day
    via last_tick_at guard).

    Returns: { processed, hex_coin_total, errors }
    """
    now = timezone.now()
    processed = 0
    hex_coin_total = 0.0
    errors = 0

    # Load all owned territories via raw SQL (ORM sync issues)
    with connection.cursor() as c:
        c.execute("""
            SELECT id, h3_index, owner_id, biome, rarity, is_shiny, is_connected,
                   tdc_per_day, last_tick_at
            FROM territories
            WHERE owner_id IS NOT NULL
            ORDER BY id
        """)
        cols = [d[0] for d in c.description]
        rows = [dict(zip(cols, r)) for r in c.fetchall()]

    # Group by owner for bulk HEX Coin update
    owner_hex: dict[str, float] = {}

    updates = []  # (h3_index, field_updates_dict)

    for row in rows:
        try:
            # 24h guard — skip if already ticked today
            last = row.get('last_tick_at')
            if last:
                from django.utils.dateparse import parse_datetime
                from datetime import timedelta
                lt = parse_datetime(str(last)) if isinstance(last, str) else last
                if lt and (now - lt).total_seconds() < 23 * 3600:
                    continue  # already ticked < 23h ago

            biome   = (row.get('biome') or 'grassland').lower()
            rarity  = (row.get('rarity') or 'common').lower()
            is_shiny = bool(row.get('is_shiny', 0))
            connected = bool(row.get('is_connected', 0))
            owner_id = str(row['owner_id'])

            base = BIOME_BASE.get(biome, BIOME_BASE['grassland'])
            mult = RARITY_MULT.get(rarity, 1.0)
            if is_shiny:
                mult *= SHINY_MULT
            if connected:
                mult *= CLUSTER_BONUS

            # Resource deltas
            res_updates: dict[str, float] = {}
            for res_field, base_val in base.items():
                res_updates[res_field] = round(base_val * mult, 2)

            # HEX Coin
            hex_today = RARITY_HEX_COIN.get(rarity, 10) * (SHINY_MULT if is_shiny else 1.0)
            if connected:
                hex_today *= CLUSTER_BONUS

            owner_hex[owner_id] = owner_hex.get(owner_id, 0.0) + hex_today
            hex_coin_total += hex_today

            updates.append((row['h3_index'], res_updates))
            processed += 1

        except Exception as e:
            logger.error(f"Production error on {row.get('h3_index')}: {e}")
            errors += 1

    # Bulk update territories (res_* fields + last_tick_at)
    with transaction.atomic():
        with connection.cursor() as c:
            for h3_index, res_updates in updates:
                if not res_updates:
                    continue
                set_clauses = ', '.join(
                    f"{k} = COALESCE({k}, 0) + ?" for k in res_updates
                )
                set_clauses += ', last_tick_at = ?'
                vals = list(res_updates.values()) + [now.isoformat(), h3_index]
                c.execute(
                    f"UPDATE territories SET {set_clauses} WHERE h3_index = ?",
                    vals
                )

        # Bulk update player HEX Coin (tdc_in_game)
        with connection.cursor() as c:
            for owner_id, hex_amount in owner_hex.items():
                c.execute(
                    "UPDATE players SET tdc_in_game = COALESCE(tdc_in_game, 0) + ? WHERE id = ?",
                    [hex_amount, owner_id]
                )

    logger.info(
        f"Production tick: {processed} territories, "
        f"{hex_coin_total:.0f} HEX Coin distributed, {errors} errors"
    )
    return {
        'processed': processed,
        'hex_coin_total': round(hex_coin_total, 2),
        'errors': errors,
        'tick_at': now.isoformat(),
    }
