"""
seed_challenge_content — Seed world events, safari creatures, and difficulty modifiers.
Creates engaging content that makes the game challenging and rewarding.

Usage: python manage.py seed_challenge_content
"""
import random
from datetime import timedelta
from django.core.management.base import BaseCommand
from django.utils import timezone


class Command(BaseCommand):
    help = 'Seed world events, difficulty modifiers, and challenge content'

    def handle(self, *args, **options):
        self._seed_world_events()
        self._seed_shop_items()
        self.stdout.write(self.style.SUCCESS('Challenge content seeded!'))

    def _seed_world_events(self):
        from terra_domini.apps.events.models import WorldEvent
        now = timezone.now()

        EVENTS = [
            # Active events — affect all players NOW
            {
                'name': 'VOLCANIC ERUPTION — MT. HEKLA',
                'description': 'Active eruption detected in Iceland. First responders earn 3x HEX. Territories near volcanic zones produce rare resources. Limited 48h window.',
                'event_type': 'natural_disaster',
                'is_global': True,
                'effects': {'hex_multiplier': 3, 'rare_drop_rate': 0.15, 'affected_biome': 'mountain'},
                'starts_at': now - timedelta(hours=6),
                'ends_at': now + timedelta(hours=42),
                'is_active': True,
            },
            {
                'name': 'GLOBAL TRADE DISRUPTION',
                'description': 'Supply chain crisis! Resource production -25% globally, but trade profits +50%. Merchants thrive while producers struggle.',
                'event_type': 'trade_disruption',
                'is_global': True,
                'effects': {'production_modifier': -0.25, 'trade_profit_modifier': 0.50},
                'starts_at': now - timedelta(days=1),
                'ends_at': now + timedelta(days=6),
                'is_active': True,
            },
            {
                'name': 'MILITARY MOBILIZATION — EASTERN FRONT',
                'description': 'Tensions rising! All combat bonuses +20% for 72h. Defense structures cost -30%. Prepare your kingdoms.',
                'event_type': 'military_mobilization',
                'is_global': False,
                'affected_countries': ['DE', 'PL', 'CZ', 'AT', 'HU', 'RO'],
                'effects': {'combat_bonus': 0.20, 'defense_cost_modifier': -0.30},
                'starts_at': now,
                'ends_at': now + timedelta(hours=72),
                'is_active': True,
            },
            {
                'name': 'RESOURCE SURGE — RARE EARTH DISCOVERY',
                'description': 'Massive rare earth deposits found! Mining territories produce 5x materials for 24h. Claim mining hexes NOW.',
                'event_type': 'resource_surge',
                'is_global': True,
                'effects': {'mining_multiplier': 5, 'affected_biome': 'mountain'},
                'starts_at': now + timedelta(hours=12),
                'ends_at': now + timedelta(hours=36),
                'is_active': False,
            },
            # Upcoming events
            {
                'name': 'SOLAR STORM — COMMUNICATION BLACKOUT',
                'description': 'Predicted solar storm will disable all radar for 4h. Safari targets become invisible. Stock up on radar boosters!',
                'event_type': 'natural_disaster',
                'is_global': True,
                'effects': {'radar_disabled': True, 'safari_difficulty': 3},
                'starts_at': now + timedelta(days=2),
                'ends_at': now + timedelta(days=2, hours=4),
                'is_active': False,
            },
            {
                'name': 'ALLIANCE WAR SEASON — BLOOD MOON',
                'description': 'Blood Moon rising. All territory captures cost 0 HEX for 12h. Pure skill determines victory. No shields allowed.',
                'event_type': 'military_mobilization',
                'is_global': True,
                'effects': {'claim_cost': 0, 'shields_disabled': True, 'combat_bonus': 0.5},
                'starts_at': now + timedelta(days=5),
                'ends_at': now + timedelta(days=5, hours=12),
                'is_active': False,
            },
        ]

        created = 0
        for ev in EVENTS:
            _, was_created = WorldEvent.objects.get_or_create(
                name=ev['name'],
                defaults=ev,
            )
            if was_created:
                created += 1

        self.stdout.write(f'  World events: {created} created ({WorldEvent.objects.count()} total)')

    def _seed_shop_items(self):
        from terra_domini.apps.economy.models import ShopItem

        ITEMS = [
            # Challenge-oriented items
            ('radar_boost_1h', 'Radar Amplifier', 'Doubles radar range for 1 hour. Essential during Solar Storms.', 'military', 150, 'radar_boost', 2.0, 3600, 'rare'),
            ('luck_potion', 'Fortune Elixir', '+25% luck for safari captures and event loot for 2 hours.', 'cosmetic', 200, 'luck_boost', 25.0, 7200, 'epic'),
            ('continuous_safari', '1H Continuous Safari', 'No cooldown between safari captures for 1 hour. Hunt relentlessly.', 'military', 500, 'safari_continuous', 1.0, 3600, 'legendary'),
            ('stealth_cloak', 'Stealth Cloak', 'Your territories are invisible to enemies for 6 hours. Cannot be attacked.', 'shield', 400, 'stealth', 1.0, 21600, 'epic'),
            ('xp_doubler', 'Commander XP Doubler', 'Double XP gains for 24 hours. Level up faster.', 'cosmetic', 300, 'xp_boost', 2.0, 86400, 'rare'),
            ('nuclear_strike', 'Nuclear Strike', 'Destroy ALL buildings in target territory. 72h cooldown. Cannot be shielded.', 'military', 2000, 'nuke_strike', 1.0, 0, 'legendary'),
            ('territory_scanner', 'Deep Territory Scanner', 'Reveals hidden resources, rarity, and nearby player activity for 1 territory.', 'military', 100, 'scan_deep', 1.0, 0, 'uncommon'),
            ('alliance_banner', 'War Banner', '+15% ATK for all alliance members in target area for 4h. Coordinate attacks.', 'alliance', 800, 'alliance_atk_boost', 0.15, 14400, 'legendary'),
        ]

        created = 0
        for code, name, desc, cat, price, effect, value, dur, rarity in ITEMS:
            _, was_created = ShopItem.objects.get_or_create(
                code=code,
                defaults={
                    'name': name, 'description': desc, 'category': cat,
                    'price_tdc': price, 'effect_type': effect,
                    'effect_value': value, 'effect_duration_seconds': dur,
                    'rarity': rarity, 'is_active': True,
                }
            )
            if was_created:
                created += 1

        self.stdout.write(f'  Shop items: {created} created ({ShopItem.objects.count()} total)')
