"""python manage.py bot_raids [--probability 1.0] — run a bot raid wave now (Celery beat runs it every 2h)."""
from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = 'Bots raid human players (FOMO loop)'

    def add_arguments(self, parser):
        parser.add_argument('--probability', type=float, default=0.2)

    def handle(self, *args, **opts):
        from terra_domini.apps.combat.tasks import bot_raids
        self.stdout.write(str(bot_raids(opts['probability'])))
