"""
Terra Domini — NFT Territory Versioning Service

Each territory hex can be minted as successive NFT versions:
- v1 = genesis (world state when first minted)
- v2 = post-event (minted 5+ days after a major real-world event)
- etc.

Key rules:
1. Only ONE active owner per version at any time
2. Previous versions remain owned by their original minters (immutable history)
3. After a major event (threat_level >= high): 5-day cooldown before next mint
4. Each version freezes: snapshot_date, active_events, geo_score, image_url
5. Historically significant versions get permanent rarity boost
"""
from datetime import timedelta
from django.utils import timezone


MINT_COOLDOWN_DAYS = 5          # days before re-mint after major event
MAJOR_EVENT_THRESHOLD = 'high'  # threat_level that triggers cooldown

RARITY_BOOST = {
    # base rarity → boosted rarity for historically significant versions
    'common':    'uncommon',
    'uncommon':  'rare',
    'rare':      'epic',
    'epic':      'legendary',
    'legendary': 'mythic',
    'mythic':    'mythic',
}


def can_mint(territory) -> tuple[bool, str]:
    """
    Check if a territory can be minted right now.
    Returns (can_mint: bool, reason: str)
    """
    now = timezone.now()

    # Cooldown active?
    if territory.mint_cooldown_until and territory.mint_cooldown_until > now:
        delta = territory.mint_cooldown_until - now
        hours = int(delta.total_seconds() / 3600)
        days  = hours // 24
        return False, f"Mint locked for {days}d {hours%24}h — post-event cooldown"

    return True, "Available"


def mint_new_version(territory, player, wallet_address: str = '') -> dict:
    """
    Mint a new version of a territory NFT.
    Freezes current world state into the NFT metadata.
    Returns the NFT metadata dict (ERC-721 compatible).
    """
    can, reason = can_mint(territory)
    if not can:
        raise ValueError(reason)

    now = timezone.now()
    old_version   = territory.nft_version
    new_version   = old_version + 1
    old_token     = territory.token_id

    # Determine if this mint is historically significant
    is_historic = territory.threat_level in ('high', 'critical') or territory.conflict_active
    event_tag   = _build_event_tag(territory)

    # Boost rarity if historic
    new_rarity = territory.rarity
    if is_historic:
        new_rarity = RARITY_BOOST.get(territory.rarity, territory.rarity)

    # Shiny: deterministic but version-influenced (1/64 per version)
    import hashlib
    h = int(hashlib.md5(f"{territory.h3_index}v{new_version}{now.date()}".encode()).hexdigest()[:4], 16)
    is_shiny = (h % 64 == 0)

    # New token ID = base + version offset
    new_token = (territory.token_id or 100_000) + new_version * 1_000

    # Freeze current state
    territory.nft_version                = new_version
    territory.previous_version_token     = old_token
    territory.snapshot_date              = now
    territory.snapshot_events            = list(territory.active_events or [])
    territory.snapshot_geo_score         = territory.geopolitical_score if hasattr(territory, 'geopolitical_score') else 0
    territory.snapshot_image_url         = territory.poi_wiki_url or ''
    territory.is_historically_significant = is_historic
    territory.historical_event_tag       = event_tag
    territory.rarity                     = new_rarity
    territory.is_shiny                   = is_shiny
    territory.token_id                   = new_token
    territory.owner_wallet               = wallet_address
    territory.owner                      = player
    territory.minted_at                  = now
    territory.edition                    = _get_edition(now)

    # Set cooldown if major event ongoing
    if is_historic:
        territory.mint_cooldown_until = now + timedelta(days=MINT_COOLDOWN_DAYS)

    territory.save()

    return territory.get_nft_metadata()


def _build_event_tag(territory) -> str:
    """Build a human-readable event tag for historically significant mints."""
    events = territory.active_events or []
    if events and isinstance(events, list) and len(events) > 0:
        first = events[0]
        if isinstance(first, dict):
            return first.get('title', '')[:100]
    if territory.conflict_active:
        return f"Active conflict · {territory.country_code}"
    if territory.threat_level == 'critical':
        return f"Critical threat · {territory.country_code}"
    return ''


def _get_edition(dt) -> str:
    """Determine edition name by year/period."""
    y = dt.year
    if y <= 2024: return 'genesis'
    if y == 2025: return 'season_1'
    if y == 2026: return 'season_2'
    return f'season_{y - 2024}'


def get_version_history(territory) -> list[dict]:
    """
    Get the full version chain for a territory.
    Returns list of version summaries from v1 to current.
    """
    # In production: query blockchain for token transfer history
    # For now: return current version info
    return [{
        'version':     territory.nft_version,
        'token_id':    territory.token_id,
        'minted_at':   territory.snapshot_date.isoformat() if territory.snapshot_date else None,
        'edition':     territory.edition,
        'rarity':      territory.rarity,
        'is_shiny':    territory.is_shiny,
        'is_historic': territory.is_historically_significant,
        'event_tag':   territory.historical_event_tag,
        'snapshot_events': territory.snapshot_events or [],
        'geo_score':   territory.snapshot_geo_score,
        'owner_wallet': territory.owner_wallet,
        'previous_token': territory.previous_version_token,
    }]
