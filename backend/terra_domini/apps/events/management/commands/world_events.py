"""manage.py world_events [--no-fetch] — fetch real events (sports, geopolitics) and resolve ended ones. Hourly cron."""
from django.core.management.base import BaseCommand

from terra_domini.apps.events import world_events as W


class Command(BaseCommand):
    help = 'Fetch real-world events onto POI hexes and pay the holders of ended events'

    def add_arguments(self, parser):
        parser.add_argument('--no-fetch', action='store_true', help='only resolve ended events')

    def handle(self, *args, **opts):
        sport = geo = 0
        if not opts['no_fetch']:
            sport = W.fetch_sports()
            geo = W.fetch_geopolitics()
        done = W.resolve()
        self.stdout.write(self.style.SUCCESS(f'world events: +{sport} sport, +{geo} geopolitics, {done} resolved'))
