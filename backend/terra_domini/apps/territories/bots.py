"""
Bot system — automated players that simulate activity at 0.7× player speed.

One bot per macro-region:
  EUROPE      — bot_eu     (Paris, Berlin, London, Madrid, Rome)
  NORTH_AMERICA — bot_na   (New York, Chicago, LA, Toronto)
  EAST_ASIA   — bot_ea     (Tokyo, Seoul, Shanghai, Beijing)
  SOUTH_ASIA  — bot_sa     (Mumbai, Delhi, Bangalore, Dhaka)
  MIDDLE_EAST — bot_me     (Dubai, Riyadh, Tehran, Istanbul)
  AFRICA      — bot_af     (Lagos, Cairo, Johannesburg, Nairobi)
  LATIN_AM    — bot_la     (São Paulo, Buenos Aires, Bogotá, Lima)
  OCEANIA     — bot_oc     (Sydney, Melbourne, Auckland)

Bots:
  - Claim unclaimed territories in their region (rate: 0.7× human)
  - Attack weak adjacent territories occasionally
  - Join/maintain a bot alliance
  - Generate realistic activity patterns (active 8-22h local time)
"""
import random
import logging
import uuid
from datetime import timedelta
from django.utils import timezone

logger = logging.getLogger('terra_domini.bots')

BOT_REGIONS = {
    'bot_eu': {
        'name': 'EU Bot (Europa)', 'tag': 'EURO',
        'lat_range': (35.0, 71.0), 'lon_range': (-10.0, 40.0),
        'timezone_offset': 1, 'emoji': '🇪🇺',
        'bot_email': 'bot_eu@terra-domini.internal',
    },
    'bot_na': {
        'name': 'NA Bot (North America)', 'tag': 'NBOT',
        'lat_range': (25.0, 72.0), 'lon_range': (-140.0, -52.0),
        'timezone_offset': -5, 'emoji': '🌎',
        'bot_email': 'bot_na@terra-domini.internal',
    },
    'bot_ea': {
        'name': 'EA Bot (East Asia)', 'tag': 'EABT',
        'lat_range': (20.0, 55.0), 'lon_range': (100.0, 145.0),
        'timezone_offset': 9, 'emoji': '🌏',
        'bot_email': 'bot_ea@terra-domini.internal',
    },
    'bot_sa': {
        'name': 'SA Bot (South Asia)', 'tag': 'SABT',
        'lat_range': (5.0, 35.0), 'lon_range': (60.0, 100.0),
        'timezone_offset': 5, 'emoji': '🌏',
        'bot_email': 'bot_sa@terra-domini.internal',
    },
    'bot_me': {
        'name': 'ME Bot (Middle East)', 'tag': 'MEBT',
        'lat_range': (15.0, 42.0), 'lon_range': (25.0, 65.0),
        'timezone_offset': 3, 'emoji': '🌍',
        'bot_email': 'bot_me@terra-domini.internal',
    },
    'bot_af': {
        'name': 'AF Bot (Africa)', 'tag': 'AFBT',
        'lat_range': (-35.0, 37.0), 'lon_range': (-18.0, 52.0),
        'timezone_offset': 1, 'emoji': '🌍',
        'bot_email': 'bot_af@terra-domini.internal',
    },
    'bot_la': {
        'name': 'LA Bot (Latin America)', 'tag': 'LABT',
        'lat_range': (-55.0, 32.0), 'lon_range': (-82.0, -34.0),
        'timezone_offset': -3, 'emoji': '🌎',
        'bot_email': 'bot_la@terra-domini.internal',
    },
    'bot_oc': {
        'name': 'OC Bot (Oceania)', 'tag': 'OCBT',
        'lat_range': (-47.0, -10.0), 'lon_range': (110.0, 178.0),
        'timezone_offset': 10, 'emoji': '🌏',
        'bot_email': 'bot_oc@terra-domini.internal',
    },
}

# Bot action speed multiplier vs human player
BOT_SPEED = 0.7
# Probability of action per tick (5 min tick)
BOT_CLAIM_PROB = 0.35 * BOT_SPEED   # 24.5% chance to claim per tick
BOT_ATTACK_PROB = 0.08 * BOT_SPEED  # 5.6% chance to attack per tick


def get_or_create_bot(bot_key: str):
    """Get or create a bot player account."""
    from terra_domini.apps.accounts.models import Player
    cfg = BOT_REGIONS[bot_key]

    player, created = Player.objects.get_or_create(
        email=cfg['bot_email'],
        defaults={
            'username': bot_key,
            'display_name': cfg['name'],
            'is_bot': True,
            'commander_rank': random.randint(5, 15),
            'tdc_in_game': 5000,
        }
    )
    if created:
        player.set_unusable_password()
        player.save()
        logger.info(f"Created bot player: {bot_key}")
    return player


def is_bot_active_hour(timezone_offset: int) -> bool:
    """Bots are active 08:00-22:00 local time (mimics human patterns)."""
    local_hour = (timezone.now().hour + timezone_offset) % 24
    return 8 <= local_hour <= 22


def run_bot_tick(bot_key: str):
    """
    Execute one bot action tick. Called every 5 minutes by Celery.
    Returns dict with action taken.
    """
    from terra_domini.apps.territories.models import Territory

    cfg = BOT_REGIONS[bot_key]

    # Skip if outside active hours
    if not is_bot_active_hour(cfg['timezone_offset']):
        return {'action': 'sleeping', 'bot': bot_key}

    # Add some randomness — bots don't act every tick
    if random.random() > BOT_SPEED:
        return {'action': 'idle', 'bot': bot_key}

    try:
        player = get_or_create_bot(bot_key)
    except Exception as e:
        logger.error(f"Bot {bot_key} failed to get player: {e}")
        return {'action': 'error', 'bot': bot_key, 'error': str(e)}

    lat_min, lat_max = cfg['lat_range']
    lon_min, lon_max = cfg['lon_range']

    action = 'none'

    # Try to claim an unclaimed territory in region
    if random.random() < BOT_CLAIM_PROB:
        unclaimed = Territory.objects.filter(
            owner__isnull=True,
            center_lat__gte=lat_min, center_lat__lte=lat_max,
            center_lon__gte=lon_min, center_lon__lte=lon_max,
        ).order_by('?').first()

        if unclaimed:
            unclaimed.owner = player
            unclaimed.claimed_at = timezone.now()
            unclaimed.save(update_fields=['owner', 'claimed_at'])
            action = f'claimed:{unclaimed.h3_index}'
            logger.debug(f"Bot {bot_key} claimed {unclaimed.h3_index}")

    # Occasionally try to attack a weak human-owned territory
    elif random.random() < BOT_ATTACK_PROB:
        weak_target = Territory.objects.filter(
            owner__isnull=False,
            owner__is_bot=False,
            center_lat__gte=lat_min, center_lat__lte=lat_max,
            center_lon__gte=lon_min, center_lon__lte=lon_max,
        ).order_by('?').first()

        if weak_target:
            # Just log the intent — actual combat would use CombatEngine
            action = f'attack_intent:{weak_target.h3_index}'
            logger.debug(f"Bot {bot_key} targets {weak_target.h3_index}")

    return {'action': action, 'bot': bot_key}
