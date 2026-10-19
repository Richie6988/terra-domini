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
# Rarity pays much more (owner 2026-10-18): yield grows faster than price (RARITY_PRICE_MULT) → rare cards are worth chasing
HEX_PER_DAY = {
    'common': 60, 'uncommon': 130, 'rare': 360,
    'epic': 900, 'legendary': 2400, 'mythic': 6000,
}
SHINY_MULT = 1.5
KINGDOM_MULT = 1.15          # territory connected to a kingdom (cluster ≥ 2)
STORAGE_CAP_HOURS = 8        # stock full after 8h → come back 3x/day for 100%
BEGINNER_DAYS = 3            # new accounts produce faster so the first sessions visibly fill the stock
BEGINNER_MULT = 4            # (time-based, so buying a zone never lowers the rate)

# ── Territory prices ─────────────────────────────────────────────────────────
BUY_BASE = 1000              # a plain territory costs ~1000 HEX; only special criteria raise it (owner 2026-10-18)
BUY_GROWTH = 1.0             # no exponential growth with the number of zones owned
NON_ADJACENT_MULT = 1.5      # far from your kingdom
UNLOCK_PREMIUM = 1.5         # instant unlock of a locked rare place far from your land (HEX only)
RARITY_PRICE_MULT = {
    'common': 1, 'uncommon': 1.6, 'rare': 3, 'epic': 7, 'legendary': 18, 'mythic': 50,
}

# ── Rarity scarcity (share of all generated territories) ─────────────────────
RARITY_MAX_SHARE = {'legendary': 0.01, 'epic': 0.04, 'rare': 0.10}
RARITY_ORDER = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic']

# ── Combat ───────────────────────────────────────────────────────────────────
REINFORCE_COST = 80          # HEX per reinforcement
REINFORCE_DEFENSE = 60       # defense points added (capped at 2× max)

# ── Army training: base seconds for ONE unit; units train one after another (combat/units.py: levels, rank) ──
TRAIN_SECONDS = {'infantry': 180, 'cavalry': 360, 'spy': 300, 'naval': 480, 'aerial': 600, 'artillery': 720}


# ── Explorations in parallel (shop: 'explore_slots' +1 for 24h, 'explore_speed' halves timers) ──
EXPLORE_SLOTS_BASE = 1
EXPLORE_MAX_HOURS = 12        # a free exploration never takes more than half a day (was exponential: 1700 h at 31 zones)


def explore_hours(owned: int, near: bool) -> float:
    """Free exploration time: 30 min for the first zones, +15 min per zone owned, ×2 far from your land, capped."""
    h = min(EXPLORE_MAX_HOURS / 2, 0.5 + 0.25 * owned)
    return min(EXPLORE_MAX_HOURS, h if near else h * 2)
EXPLORE_SLOTS_MAX = 3


def _boost_values(player, boost_type):
    from django.db.models import Q
    from django.utils import timezone
    from terra_domini.apps.economy.models import ActiveBoost
    return list(ActiveBoost.objects.filter(player=player, boost_type=boost_type)
                .filter(Q(expires_at__isnull=True) | Q(expires_at__gt=timezone.now())).values_list('boost_value', flat=True))


def explore_slots(player) -> int:
    from terra_domini.utils.god import is_god
    if is_god(player):
        return 99
    return min(EXPLORE_SLOTS_MAX, EXPLORE_SLOTS_BASE + int(sum(_boost_values(player, 'explore_slots'))))


def explore_speed_mult(player) -> float:
    vals = _boost_values(player, 'explore_speed')
    return max(0.25, min(vals)) if vals else 1.0


# ── Shop boosts read by the game (ActiveBoost rows created by economy.views._apply_item_effect) ──
ATTACK_RANGE_RINGS = 10      # attack a hex up to 10 rings (~8 km) from one of yours; 'distant_attack' lifts it
BLITZ_EXPLORE_HOURS = 0.01   # 'claim_instant': explorations finish in ~36 s
CHARGE_BOOST_DAYS = 30       # charge boosts (next N uses) stay valid 30 days


def has_boost(player, boost_type) -> bool:
    return bool(_boost_values(player, boost_type))


def boost_mult(player, boost_type) -> float:
    vals = _boost_values(player, boost_type)
    return max(vals) if vals else 1.0


def use_charge(player, boost_type) -> bool:
    """Consume one charge of a 'next N uses' boost (boost_value = charges left). True if one was used."""
    from django.utils import timezone
    from terra_domini.apps.economy.models import ActiveBoost
    b = (ActiveBoost.objects.filter(player=player, boost_type=boost_type, expires_at__gt=timezone.now(), boost_value__gte=1)
         .order_by('activated_at').first())
    if not b:
        return False
    if b.boost_value <= 1:
        b.delete()
    else:
        ActiveBoost.objects.filter(pk=b.pk).update(boost_value=b.boost_value - 1)
    return True


# ── Card editions (a conquered place card is re-issued) ──
def edition_value_mult(version: int) -> float:
    """Value of a place card relative to a single-edition card: 1 / number of editions issued."""
    return round(1 / max(1, int(version or 1)), 3)


def edition_label(version: int) -> str:
    return 'GENESIS' if int(version or 1) <= 1 else f'EDITION {int(version)}'


# ── Daily missions: all 3 claimed → bonus chest ──
DAILY_ALL_MISSIONS_HEX = 300
DAILY_ALL_MISSIONS_ITEM = 'explore_slot'     # free Extra Explorer for 24h


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
    from terra_domini.apps.economy.resources import hex_yield
    from terra_domini.apps.events.unified_poi import UnifiedPOI
    full = list(Territory.objects.filter(owner=player).values_list('h3_index', 'rarity', 'is_shiny', 'center_lat', 'center_lon'))
    rows = [(h, r, s) for h, r, s, _, _ in full]
    geo = {h: (la, lo) for h, _, _, la, lo in full}
    cats = dict(UnifiedPOI.objects.filter(h3_index__in=list(geo), is_active=True).values_list('h3_index', 'category'))
    owned = {h for h, _, _ in rows}
    mult = BEGINNER_MULT if is_beginner(player) else 1
    try:   # live real-world event on the hex (apps/events/world_events.py) → ×EVENT_MULT
        from terra_domini.apps.events.world_events import live_event_hexes, EVENT_MULT
        hot = live_event_hexes() & owned
    except Exception:
        hot, EVENT_MULT = set(), 1
    from terra_domini.apps.territories.upgrades import hex_multipliers
    sci = hex_multipliers(player.id, 'science')                      # kingdom Science upgrade: +5 % per level
    from terra_domini.apps.territories.regions import controlled, region_at, REGION_HEX_PCT
    mine = controlled(player.id)                                     # regions this player controls (Risk continents)
    reg = {h: 1 + REGION_HEX_PCT / 100 for h, (la, lo) in geo.items() if mine and (region_at(la, lo, h) or (None,))[0] in mine}
    out = {}
    for h, rarity, shiny in rows:
        try:
            connected = any(n in owned for n in k_ring(h, 1) if n != h)
        except Exception:
            connected = False
        y = hex_yield(h, *geo[h], rarity, cats.get(h, ''))['mult']      # resources on the hex (oil, gold…) ± variation
        out[h] = round(territory_hex_per_day(rarity, shiny, connected) * y * mult * (EVENT_MULT if h in hot else 1) * sci.get(h, 1) * reg.get(h, 1), 1)
    return out


def player_hex_per_day(player) -> float:
    return round(sum(territory_rates(player).values()), 2)


def is_beginner(player) -> bool:
    from datetime import timedelta
    from django.utils import timezone
    joined = getattr(player, 'date_joined', None)
    return bool(joined) and timezone.now() - joined < timedelta(days=BEGINNER_DAYS)


# ── Discovery (owner 2026-10-19): 1000 HEX / 1 h for a hex next to your land, ×2 per extra ring of distance,
# capped (DISCOVERY_MAX_FACTOR); points of interest need a hex right next to them. Spy points cut both (combat/forces.py).
DISCOVERY_COST = 1000
DISCOVERY_HOURS = 1.0
DISCOVERY_MAX_FACTOR = 16


def discovery(player, h3_index: str, rarity: str = 'common', is_poi: bool = False, spies: int = 0) -> dict:
    """Price and explore time of a hex for this player: distance in rings to their nearest hex → bounded exponential."""
    from terra_domini.apps.combat import forces as Fz
    near_hex, dist = Fz.nearest_owned(player.id, h3_index)
    first = near_hex is None
    d = 1 if first else max(1, dist)
    factor = min(DISCOVERY_MAX_FACTOR, 2 ** (d - 1))
    disc = Fz.spy_discount(spies)
    cost = int(round(DISCOVERY_COST * factor * RARITY_PRICE_MULT.get((rarity or 'common').lower(), 1) * (1 - disc)))
    hours = round(min(EXPLORE_MAX_HOURS, DISCOVERY_HOURS * factor) * (1 - disc), 2)
    from terra_domini.utils.god import is_god
    if is_god(player):          # god mode: real price shown but not charged, instant, anywhere (POIs included)
        return {'distance': None if first else dist, 'factor': factor, 'cost': cost, 'hours': BLITZ_EXPLORE_HOURS, 'first': first,
                'locked': False, 'spy_discount': disc, 'near_hex': near_hex, 'god_free': True}
    return {'distance': None if first else dist, 'factor': factor, 'cost': cost, 'hours': hours, 'first': first,
            'locked': bool(is_poi and not first and d > 1),     # POIs: be right next to them
            'spy_discount': disc, 'near_hex': near_hex}


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


# ── Prices that climb with each use until the next day (owner 2026-10-19: "allow event and safari as much as the
#    player wants but it costs more and more until next day") ──
ESCALATION = {           # kind: (free uses a day, base HEX, growth per extra use)
    'safari': (5, 300, 1.6),
    'event_ticket': (0, None, 1.5),     # base = the event's ticket price
}


def daily_count(player, kind) -> int:
    from terra_domini.apps.economy.models import DailyCounter
    from django.utils import timezone
    row = DailyCounter.objects.filter(player=player, kind=kind, day=timezone.localdate()).first()
    return row.count if row else 0


def escalated_price(player, kind, base=None, used=None) -> int:
    """HEX price of the next use today: free uses first, then base × growth^(extra uses), rounded to 10."""
    free, b, growth = ESCALATION[kind]
    b = b if base is None else base
    n = daily_count(player, kind) if used is None else used
    if n < free or not b:
        return 0
    return int(round(b * growth ** (n - free) / 10) * 10)


def bump_daily(player, kind) -> int:
    from terra_domini.apps.economy.models import DailyCounter
    from django.db.models import F
    from django.utils import timezone
    row, _ = DailyCounter.objects.get_or_create(player=player, kind=kind, day=timezone.localdate())
    DailyCounter.objects.filter(pk=row.pk).update(count=F('count') + 1)
    return row.count + 1
