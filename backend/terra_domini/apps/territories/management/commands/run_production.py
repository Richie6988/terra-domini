"""
python manage.py run_production [--force]

Runs the Hexod 24h production tick manually.
--force : skip the 23h guard (re-tick even if already done today)
"""
from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = 'Run Hexod daily production tick (resources + HEX Coin)'

    def add_arguments(self, parser):
        parser.add_argument('--force', action='store_true', help='Skip 23h guard')

    def handle(self, *args, **options):
        from terra_domini.apps.territories.production_cron import run_production_tick
        self.stdout.write('⚙️  Running production tick...')
        result = run_production_tick()
        self.stdout.write(
            f"✅ Done: {result['processed']} territories | "
            f"{result['hex_coin_total']} HEX Coin | "
            f"{result['errors']} errors"
        )
