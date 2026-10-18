"""Open today's 10 auctions (rare+ place cards nobody owns) and settle the ended ones. Cron: hourly."""
from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = "Create today's auctions and resolve ended ones"

    def handle(self, *args, **o):
        from terra_domini.apps.economy.auction_views import create_daily, resolve_due
        r = resolve_due()
        c = create_daily()
        self.stdout.write(self.style.SUCCESS(f'auctions: {c} opened · {r} settled'))
