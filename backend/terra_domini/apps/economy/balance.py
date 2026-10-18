"""
HEXOD game balance — single source of truth for the economy (2026-10-17).

Design (owner): Supercell-style 5-minute sessions, fast progression, FOMO.
- Territories produce HEX into a STOCK capped at STORAGE_CAP_HOURS. Nothing is
  credited automatically: the player must come back and COLLECT, otherwise the
  stock is full and production is lost.
- Target pace: ~1 new territory per day of regular play early on, slowing later.
- Random boosters can only be paid with EARNED HEX (never with purchased HEX):
  see spendable_earned() — HEX bought with money can't buy loot boxes nor be
  withdrawn as crypto.
"""
from decimal import Decimal

# ── Production ────────────────────────────────────────────────────────────────
HEX_PER_DAY = {
    'common': 60, 'uncommon': 110, 'rare': 220,
    'epic': 500, 'legendary': 1200, 'mythic': 3000,
}
SHINY_MULT = 1.5
KINGDOM_MULT = 1.15          # territory connected to a kingdom (cluster ≥ 2)
STORAGE_CAP_HOURS = 8        # stock full after 8h → come back 3x/day for 100%
BEGINNER_DAYS = 3            # new accounts produce faster so the first sessions visibly fill the stock
BEGINNER_MULT = 4            # (time-based, so buying a zone never lowers the rate)

# ── Territory prices ─────────────────────────────────────────────────────────
BUY_BASE = 120
BUY_GROWTH = 1.22            # per territory already owned
NON_ADJACENT_MULT = 2.5
RARITY_PRICE_MULT = {
    'common': 1, 'uncommon': 1.6, 'rare': 3, 'epic': 7, 'legendary': 18, 'mythic': 50,
}

# ── Rarity scarcity (share of all generated territories) ─────────────────────
RARITY_MAX_SHARE = {'legendary': 0.01, 'epic': 0.04, 'rare': 0.10}
RARITY_ORDER = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic']

# ── Combat ───────────────────────────────────────────────────────────────────
REINFORCE_COST = 80          # HEX per reinforcement
REINFORCE_DEFENSE = 60       # defense points added (capped at 2× max)

# ── Army training (fast, Clash-style: minutes, barracks train TRAIN_PARALLEL units at once) ──
TRAIN_SECONDS = {'infantry': 180, 'cavalry': 360, 'spy': 300, 'naval': 480, 'aerial': 600, 'artillery': 720}
TRAIN_PARALLEL = 5


def train_seconds(unit_type: str, quantity: int) -> int:
    import math
    return TRAIN_SECONDS.get(unit_type, 300) * math.ceil(max(1, quantity) / TRAIN_PARALLEL)


# ── Crypto ───────────────────────────────────────────────────────────────────
CONVERT_BURN_PCT = Decimal('0.05')   # 5% of HEX burned when converting to the token
# Fixed peg (owner, 2026-10-18): 1 € = 1000 HEX = 1 HEX Coin (on-chain token). Bought in the shop directly;
# the crypto side follows in the background.
HEX_PER_EUR = 1000
HEX_PER_COIN = 1000
HEX_PACKS = [   # bonus HEX on bigger packs (bonus is purchased HEX too: not withdrawable, no boosters)
    {'id': 'hex_1',  'eur': 1,  'hex': 1000,  'bonus': 0},
    {'id': 'hex_5',  'eur': 5,  'hex': 5000,  'bonus': 250},
    {'id': 'hex_10', 'eur': 10, 'hex': 10000, 'bonus': 1000},
    {'id': 'hex_20', 'eur': 20, 'hex': 20000, 'bonus': 3000},
    {'id': 'hex_50', 'eur': 50, 'hex': 50000, 'bonus': 10000},
]


def territory_hex_per_day(rarity: str, is_shiny: bool = False, connected: bool = False) -> float:
    v = HEX_PER_DAY.get((rarity or 'common').lower(), HEX_PER_DAY['common'])
    if is_shiny:
        v *= SHINY_MULT
    if connected:
        v *= KINGDOM_MULT
    return v


def territory_rates(player) -> dict:
    """HEX/day of each owned territory (h3 → rate), starter boost included.
    The ONLY production formula: harvest, Empire and Ladder all read it."""
    from terra_domini.apps.territories.models import Territory
    from terra_domini.utils.h3_compat import k_ring
    rows = list(Territory.objects.filter(owner=player).values_list('h3_index', 'rarity', 'is_shiny'))
    owned = {h for h, _, _ in rows}
    mult = BEGINNER_MULT if is_beginner(player) else 1
    out = {}
    for h, rarity, shiny in rows:
        try:
            connected = any(n in owned for n in k_ring(h, 1) if n != h)
        except Exception:
            connected = False
        out[h] = territory_hex_per_day(rarity, shiny, connected) * mult
    return out


def player_hex_per_day(player) -> float:
    return round(sum(territory_rates(player).values()), 2)


def is_beginner(player) -> bool:
    from datetime import timedelta
    from django.utils import timezone
    joined = getattr(player, 'date_joined', None)
    return bool(joined) and timezone.now() - joined < timedelta(days=BEGINNER_DAYS)


def buy_cost(owned_count: int, adjacent: bool, rarity: str = 'common') -> int:
    cost = BUY_BASE * (BUY_GROWTH ** max(0, owned_count - 1))
    if not adjacent and owned_count > 0:
        cost *= NON_ADJACENT_MULT
    cost *= RARITY_PRICE_MULT.get((rarity or 'common').lower(), 1)
    return int(round(cost / 5) * 5)


def spendable_earned(player) -> Decimal:
    """HEX that was earned in-game (balance minus what's left of purchased HEX)."""
    bal = Decimal(str(player.tdc_in_game or 0))
    bought = Decimal(str(getattr(player, 'hex_purchased_balance', 0) or 0))
    return max(Decimal('0'), bal - bought)


def consume_purchased_first(player, amount) -> None:
    """For deterministic spends: use purchased HEX first (keeps earned HEX for boosters)."""
    bought = Decimal(str(getattr(player, 'hex_purchased_balance', 0) or 0))
    if bought <= 0:
        return
    use = min(bought, Decimal(str(amount)))
    type(player).objects.filter(pk=player.pk).update(hex_purchased_balance=bought - use)
