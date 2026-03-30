"""
Management command: python manage.py create_world_events

Auto-creates or updates WorldPOI events based on predefined news triggers.
Run daily via cron or Celery beat.

Usage:
    python manage.py create_world_events
    python manage.py create_world_events --event hormuz_update
    python manage.py create_world_events --dry-run
"""
from django.core.management.base import BaseCommand
from django.utils import timezone
from datetime import timedelta
import logging

logger = logging.getLogger(__name__)


# Event catalog — updated manually when big news breaks
# In production, replace with NewsAPI integration
WORLD_EVENTS_CATALOG = {
    'hormuz_2026': {
        'name': "Strait of Hormuz — Active Blockade",
        'slug': "strait-of-hormuz-2026",
        'category': 'chokepoint',
        'threat_level': 'critical',
        'description': (
            "Iran has effectively closed the Strait of Hormuz since Feb 28, 2026. "
            "20M barrels/day disrupted. Brent crude at $105+. "
            "15 tankers struck. US Navy deployed. China/India/Pakistan granted conditional transit."
        ),
        'lat': 26.5819, 'lon': 56.4242, 'radius_km': 800.0,
        'country_codes': ['IR', 'OM', 'AE', 'QA', 'SA', 'KW'],
        'icon_emoji': '🔥', 'icon_color': '#FF3B30',
        'pulse': True, 'is_featured': True,
        'effects': {
            'resource_multipliers': {
                'energy': 0.40, 'credits': 0.65, 'food': 0.75,
                'materials': 0.55, 'intel': 3.00,
            },
            'military_modifier': 1.8,
            'trade_route_disrupted': True,
            'special_unit_unlock': 'naval',
            'tdc_market_impact_pct': 18,
            'description_ingame': (
                "The Hormuz blockade cuts Gulf energy -60%, Credits -35%, "
                "but boosts Intel ×3 and unlocks naval units. "
                "Control Tower wars in the region award 2× bonuses."
            ),
        },
        'real_world_data': {
            'oil_price_usd': 105.70,
            'oil_price_change_pct': 40,
            'tankers_attacked': 15,
            'us_navy': True,
            'allowed_flags': ['CN', 'IN', 'PK', 'TR'],
            'event_start': '2026-02-28',
        },
        'news_headline': "Iran closes Strait of Hormuz — Brent at $105",
        'news_url': 'https://en.wikipedia.org/wiki/2026_Strait_of_Hormuz_crisis',
    },

    'ukraine_frontline_2026': {
        'name': "Ukraine–Russia Frontline (2026)",
        'slug': "ukraine-russia-2026",
        'category': 'conflict_zone',
        'threat_level': 'high',
        'description': (
            "Active front across Zaporizhzhia–Donetsk–Kharkiv axis. "
            "Grain exports disrupted. European energy rerouting ongoing. "
            "Intel premium for all territories within 500km."
        ),
        'lat': 48.5, 'lon': 37.5, 'radius_km': 500.0,
        'country_codes': ['UA', 'RU'],
        'icon_emoji': '⚔️', 'icon_color': '#EF4444',
        'pulse': True, 'is_featured': True,
        'effects': {
            'resource_multipliers': {
                'food': 0.55, 'energy': 0.70, 'intel': 2.8, 'materials': 0.75,
            },
            'military_modifier': 1.6,
            'trade_route_disrupted': True,
        },
        'real_world_data': {'year_ongoing': 2022, 'black_sea_grain': 'disrupted'},
        'news_headline': "Ukraine front active — food production disrupted across Eastern Europe",
        'news_url': 'https://en.wikipedia.org/wiki/Russian_invasion_of_Ukraine',
    },

    'taiwan_strait_tension': {
        'name': "Taiwan Strait — Elevated Tension",
        'slug': "taiwan-strait-tension-2026",
        'category': 'chokepoint',
        'threat_level': 'high',
        'description': (
            "PLA exercises near Taiwan increase in frequency. "
            "TSMC supply chain risk elevated. US Pacific Fleet repositioned. "
            "APAC materials production affected. Naval units unlocked in region."
        ),
        'lat': 24.2292, 'lon': 120.4167, 'radius_km': 400.0,
        'country_codes': ['TW', 'CN', 'US'],
        'icon_emoji': '⚡', 'icon_color': '#EF4444',
        'pulse': True, 'is_featured': False,
        'effects': {
            'resource_multipliers': {
                'materials': 0.6, 'energy': 0.9, 'intel': 2.5, 'credits': 0.85,
            },
            'military_modifier': 2.0,
            'special_unit_unlock': 'naval',
        },
        'real_world_data': {'tsmc_risk': True, 'pla_exercises': 'ongoing'},
        'news_headline': "PLA exercises near Taiwan — TSMC supply risk elevated",
        'news_url': 'https://en.wikipedia.org/wiki/Taiwan_Strait',
    },

    'oil_price_shock_global': {
        'name': "Global Oil Price Shock",
        'slug': "oil-shock-2026",
        'category': 'economic',
        'threat_level': 'critical',
        'description': (
            "Brent crude above $100 — triggered by Hormuz blockade. "
            "Global energy-dependent territories lose 20% credit production. "
            "Energy infrastructure territories gain 50% premium."
        ),
        'lat': 25.0, 'lon': 55.0, 'radius_km': 25000.0,  # Global
        'country_codes': [],
        'icon_emoji': '📉', 'icon_color': '#FFB800',
        'pulse': False, 'is_featured': True,
        'effects': {
            'resource_multipliers': {'energy': 0.60, 'credits': 0.80},
            'global_effect': True,
            'tdc_market_impact_pct': 20,
        },
        'real_world_data': {
            'brent_usd': 105.70, 'wti_usd': 99.32,
            'cause': 'Hormuz blockade + Iran war',
        },
        'news_headline': "Oil at $105 — global energy prices soaring",
        'news_url': 'https://en.wikipedia.org/wiki/Economic_impact_of_the_2026_Iran_war',
    },

    'bab_el_mandeb_houthi': {
        'name': "Bab-el-Mandeb — Houthi Drone Attacks",
        'slug': "bab-el-mandeb-houthi-2026",
        'category': 'conflict_zone',
        'threat_level': 'high',
        'description': (
            "Houthi forces attacking Red Sea shipping lanes. "
            "30% of Asia→Europe container traffic rerouted via Cape Horn (+2 weeks). "
            "Insurance premiums +400%. Credits disrupted."
        ),
        'lat': 12.6167, 'lon': 43.3500, 'radius_km': 500.0,
        'country_codes': ['YE', 'DJ', 'SO'],
        'icon_emoji': '🚀', 'icon_color': '#F59E0B',
        'pulse': True, 'is_featured': False,
        'effects': {
            'resource_multipliers': {'credits': 0.70, 'materials': 0.75, 'intel': 2.2},
            'trade_route_disrupted': True,
        },
        'real_world_data': {
            'rerouted_ships_pct': 30,
            'insurance_premium_increase_pct': 400,
        },
        'news_headline': "Houthi drones strike Red Sea — 30% of shipping rerouted",
        'news_url': 'https://en.wikipedia.org/wiki/Red_Sea_attacks_(2023–present)',
    },
}


class Command(BaseCommand):
    help = 'Create or update world events from the news catalog'

    def add_arguments(self, parser):
        parser.add_argument('--event', type=str, help='Specific event key to create (default: all)')
        parser.add_argument('--dry-run', action='store_true', help='Print what would be done without saving')
        parser.add_argument('--reset', action='store_true', help='Re-create all events from scratch')

    def handle(self, *args, **options):
        from terra_domini.apps.events.poi_models import WorldPOI, POINewsUpdate

        dry_run = options.get('dry_run', False)
        reset = options.get('reset', False)
        specific = options.get('event')

        catalog = WORLD_EVENTS_CATALOG
        if specific:
            if specific not in catalog:
                self.stderr.write(f"Event '{specific}' not found. Available: {', '.join(catalog.keys())}")
                return
            catalog = {specific: catalog[specific]}

        created = updated = 0

        for key, evt in catalog.items():
            slug = evt['slug']
            self.stdout.write(f"Processing: {evt['name']}...")

            if dry_run:
                existing = WorldPOI.objects.filter(slug=slug).first()
                action = 'UPDATE' if existing else 'CREATE'
                self.stdout.write(f"  [DRY RUN] Would {action}: {slug}")
                continue

            try:
                import h3
                h3_idx = h3.latlng_to_cell(evt['lat'], evt['lon'], 10)
            except Exception:
                h3_idx = ''

            defaults = {
                'name': evt['name'],
                'description': evt['description'],
                'category': evt['category'],
                'threat_level': evt['threat_level'],
                'status': WorldPOI.POIStatus.ACTIVE,
                'latitude': evt['lat'],
                'longitude': evt['lon'],
                'radius_km': evt['radius_km'],
                'country_codes': evt.get('country_codes', []),
                'h3_index': h3_idx,
                'icon_emoji': evt['icon_emoji'],
                'icon_color': evt['icon_color'],
                'pulse': evt.get('pulse', False),
                'is_featured': evt.get('is_featured', False),
                'effects': evt.get('effects', {}),
                'real_world_data': evt.get('real_world_data', {}),
                'news_source_url': evt.get('news_url', ''),
                'news_headline': evt.get('news_headline', ''),
                'event_started_at': timezone.now() - timedelta(days=20),
            }

            if reset:
                WorldPOI.objects.filter(slug=slug).delete()

            poi, was_created = WorldPOI.objects.update_or_create(slug=slug, defaults=defaults)

            if was_created:
                created += 1
                self.stdout.write(self.style.SUCCESS(f"  ✅ Created: {poi.name}"))
                # Add initial news update
                POINewsUpdate.objects.create(
                    poi=poi,
                    headline=evt.get('news_headline', 'Event activated'),
                    body=evt['description'][:500],
                    source_url=evt.get('news_url', ''),
                )
            else:
                updated += 1
                self.stdout.write(f"  ↻ Updated: {poi.name}")

        if not dry_run:
            self.stdout.write(
                self.style.SUCCESS(f"\n✅ Done: {created} created, {updated} updated")
            )
        else:
            self.stdout.write("\n[DRY RUN] No changes made.")
