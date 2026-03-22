"""
Management command: seed_territories
Seeds all 1102 POI territories into the Territory table.
Run once at startup or after DB reset.
"""
from django.core.management.base import BaseCommand
from terra_domini.apps.territories.territory_engine import seed_poi_territories


class Command(BaseCommand):
    help = 'Seed all POI territories (pre-generate 1102 rare hexes)'

    def handle(self, *args, **options):
        self.stdout.write('Seeding POI territories...')
        created, updated = seed_poi_territories()
        self.stdout.write(self.style.SUCCESS(
            f'✅ Done: {created} created, {updated} updated'
        ))
