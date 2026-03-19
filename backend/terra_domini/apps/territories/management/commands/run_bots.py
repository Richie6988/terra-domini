"""
Management command: python manage.py run_bots

Creates bot players for all 8 macro-regions and runs one tick.
In production, Celery beat runs this every 5 minutes.
"""
from django.core.management.base import BaseCommand
from terra_domini.apps.territories.bots import BOT_REGIONS, run_bot_tick, get_or_create_bot


class Command(BaseCommand):
    help = 'Run one bot tick for all macro-region bots'

    def add_arguments(self, parser):
        parser.add_argument('--setup', action='store_true', help='Create bot accounts only')
        parser.add_argument('--bot', type=str, help='Run specific bot only')

    def handle(self, *args, **options):
        bots = [options['bot']] if options.get('bot') else list(BOT_REGIONS.keys())

        if options.get('setup'):
            for key in bots:
                player = get_or_create_bot(key)
                self.stdout.write(f"✅ {key}: {player.username} ({BOT_REGIONS[key]['emoji']})")
            return

        results = {}
        for key in bots:
            try:
                result = run_bot_tick(key)
                results[key] = result
                emoji = BOT_REGIONS[key]['emoji']
                self.stdout.write(f"{emoji} {key}: {result['action']}")
            except Exception as e:
                self.stderr.write(f"❌ {key}: {e}")

        claimed = sum(1 for r in results.values() if 'claimed' in r.get('action', ''))
        self.stdout.write(self.style.SUCCESS(f"\n✅ Tick done: {claimed}/{len(bots)} bots claimed territories"))
