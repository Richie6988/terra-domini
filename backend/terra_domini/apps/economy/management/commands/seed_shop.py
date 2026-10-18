"""
manage.py seed_shop — Populate shop with all game items and bonuses.

Usage:
  python manage.py seed_shop
"""
from django.core.management.base import BaseCommand


ITEMS = [
    # Boosters
    {'code': 'booster_standard', 'name': 'Standard Booster', 'category': 'boosters', 'price_tdc': 200, 'description': '3 free territories. Common to Rare (Epic/Legendary rare).', 'rarity': 'common', 'effect_type': 'booster_pack', 'effect_value': 3.0},
    {'code': 'booster_rare', 'name': 'Rare Booster', 'category': 'boosters', 'price_tdc': 500, 'description': '4 free territories. Guaranteed 1 Rare or better.', 'rarity': 'rare', 'effect_type': 'booster_pack', 'effect_value': 4.0},
    {'code': 'booster_legendary', 'name': 'Legendary Booster', 'category': 'boosters', 'price_tdc': 1200, 'description': '5 free territories. Guaranteed 1 Legendary.', 'rarity': 'legendary', 'effect_type': 'booster_pack', 'effect_value': 5.0},

    # Attack bonuses
    {'code': 'atk_2x_army', 'name': '2X Army Power', 'category': 'attack', 'price_tdc': 300, 'description': 'Double army ATK for 24h', 'effect_type': 'atk_multiplier', 'effect_value': 2.0, 'duration': 86400},
    {'code': 'atk_blitz', 'name': 'Blitz Mode', 'category': 'attack', 'price_tdc': 150, 'description': 'Explorations finish in seconds for 1h', 'effect_type': 'claim_instant', 'effect_value': 1.0, 'duration': 3600},
    {'code': 'atk_distant', 'name': 'Distant Strike', 'category': 'attack', 'price_tdc': 200, 'description': 'Attack beyond your 10-hex range for 12h', 'effect_type': 'distant_attack', 'effect_value': 1.0, 'duration': 43200},
    {'code': 'atk_mint_speed', 'name': '2X Explore Speed', 'category': 'attack', 'price_tdc': 250, 'description': 'New explorations take half the time for 24h', 'effect_type': 'explore_speed', 'effect_value': 0.5, 'duration': 86400},
    {'code': 'explore_slot', 'name': 'Extra Explorer', 'category': 'attack', 'price_tdc': 300, 'description': '+1 exploration in parallel for 24h (max 3)', 'effect_type': 'explore_slots', 'effect_value': 1.0, 'duration': 86400},

    # Defense bonuses
    {'code': 'def_shield_72h', 'name': '72H Shield', 'category': 'defense', 'price_tdc': 400, 'description': 'Territory immune to attacks for 72h', 'effect_type': 'shield', 'effect_value': 1.0, 'duration': 259200},
    {'code': 'def_2x_defense', 'name': '2X Defense', 'category': 'defense', 'price_tdc': 300, 'description': 'Double DEF stats for 48h', 'effect_type': 'def_multiplier', 'effect_value': 2.0, 'duration': 172800},
    {'code': 'def_anti_nuke', 'name': 'Anti-Nuke', 'category': 'defense', 'price_tdc': 800, 'description': 'Block 1 incoming nuclear strike', 'effect_type': 'anti_nuke', 'effect_value': 1.0, 'duration': 604800},
    {'code': 'def_influence_resist', 'name': 'Influence Resist', 'category': 'defense', 'price_tdc': 250, 'description': 'Immune to influence takeover for 48h', 'effect_type': 'influence_resist', 'effect_value': 1.0, 'duration': 172800},

    # Economy bonuses
    {'code': 'eco_2x_extraction', 'name': '2X Extraction', 'category': 'economy', 'price_tdc': 350, 'description': 'Double resource production for 24h', 'effect_type': 'resource_multiplier', 'effect_value': 2.0, 'duration': 86400},
    {'code': 'eco_energy', 'name': 'Energy Efficiency', 'category': 'economy', 'price_tdc': 200, 'description': '-50% energy costs for 48h', 'effect_type': 'energy_discount', 'effect_value': 0.5, 'duration': 172800},
    {'code': 'eco_rare_drop', 'name': 'Rare Drop Boost', 'category': 'economy', 'price_tdc': 500, 'description': 'Booster Rare+ odds x1.25 for 24h', 'effect_type': 'rare_chance', 'effect_value': 1.25, 'duration': 86400},
    {'code': 'eco_trade_advantage', 'name': 'Trade Advantage', 'category': 'economy', 'price_tdc': 300, 'description': '-20% marketplace royalty on your purchases for 72h', 'effect_type': 'trade_discount', 'effect_value': 0.8, 'duration': 259200},

    # Collection bonuses
    {'code': 'col_luck', 'name': 'Luck Potion', 'category': 'collection', 'price_tdc': 250, 'description': '2.5x chances to win an event token in the draws for 48h', 'effect_type': 'luck_boost', 'effect_value': 15.0, 'duration': 172800},
    {'code': 'col_rarity', 'name': '+Card Rarity', 'category': 'collection', 'price_tdc': 400, 'description': 'Next 5 safari captures pay the next rarity tier reward', 'effect_type': 'rarity_boost', 'effect_value': 1.0, 'duration': 0},
    {'code': 'col_safari_1h', 'name': '1H Continuous Safari', 'category': 'collection', 'price_tdc': 300, 'description': 'No daily safari hunt limit for 1h', 'effect_type': 'safari_continuous', 'effect_value': 1.0, 'duration': 3600},
    {'code': 'col_safari_hints', 'name': 'Safari Hints', 'category': 'collection', 'price_tdc': 150, 'description': '+2 scans on your next safari hunt', 'effect_type': 'safari_hints', 'effect_value': 1.0, 'duration': 0},

    # Social bonuses
    {'code': 'soc_global_msg', 'name': 'Global Message', 'category': 'social', 'price_tdc': 100, 'description': 'Send 1 message visible to all players', 'effect_type': 'global_message', 'effect_value': 1.0, 'duration': 0},
    {'code': 'soc_extended_vision', 'name': 'Extended Vision', 'category': 'social', 'price_tdc': 200, 'description': 'See all territories in 50km radius for 24h', 'effect_type': 'vision_range', 'effect_value': 50.0, 'duration': 86400},
    {'code': 'soc_brag', 'name': 'Brag Mode', 'category': 'social', 'price_tdc': 50, 'description': 'Animated profile frame for 7 days', 'effect_type': 'cosmetic_brag', 'effect_value': 1.0, 'duration': 604800},
    {'code': 'soc_vip', 'name': 'VIP Access', 'category': 'social', 'price_tdc': 500, 'description': 'VIP badge + priority queue for 30 days', 'effect_type': 'vip_access', 'effect_value': 1.0, 'duration': 2592000},
]


class Command(BaseCommand):
    help = 'Seed the shop with all game items and bonuses'

    def handle(self, *args, **options):
        from terra_domini.apps.economy.models import ShopItem

        created = 0
        updated = 0
        for item_data in ITEMS:
            code = item_data['code']
            defaults = {
                'name': item_data['name'],
                'category': item_data['category'],
                'price_tdc': item_data['price_tdc'],
                'description': item_data['description'],
            }
            if 'effect_type' in item_data:
                defaults['effect_type'] = item_data['effect_type']
                defaults['effect_value'] = item_data['effect_value']
            if 'duration' in item_data:
                defaults['effect_duration_seconds'] = item_data['duration']
            if 'rarity' in item_data:
                defaults['rarity'] = item_data['rarity']

            obj, was_created = ShopItem.objects.update_or_create(
                code=code, defaults=defaults
            )
            if was_created:
                created += 1
            else:
                updated += 1

        self.stdout.write(self.style.SUCCESS(
            f"✅ Shop seeded: {created} created, {updated} updated ({len(ITEMS)} total items)"
        ))
