"""
python manage.py recalculate_biomes [--dry-run]

Recalcule les biomes planétaires pour tous les territoires.
Met à jour territory_type + ressources cohérentes.
"""
from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = 'Recalculate planetary biomes for all territories'

    def add_arguments(self, parser):
        parser.add_argument('--dry-run', action='store_true', help='Preview only')

    def handle(self, *args, **options):
        if options['dry_run']:
            self._preview()
            return

        self.stdout.write('⚙️  Recalculating planetary biomes...')
        from terra_domini.apps.territories.biome_engine import recalculate_all_biomes
        n = recalculate_all_biomes()
        self.stdout.write(f'✅ Updated {n} territories with correct biomes + resources')

        # Vérif rapide
        from django.db import connection
        with connection.cursor() as c:
            c.execute("SELECT biome, COUNT(*) FROM territories GROUP BY biome ORDER BY COUNT(*) DESC")
            self.stdout.write('\nBiome distribution:')
            for row in c.fetchall():
                bar = '█' * min(40, int(row[1]/10))
                self.stdout.write(f'  {row[0]:15} {row[1]:4}  {bar}')

    def _preview(self):
        from terra_domini.apps.territories.biome_engine import assign_biome
        from django.db import connection
        self.stdout.write('DRY RUN — sample biome assignments:')
        with connection.cursor() as c:
            c.execute('SELECT center_lat, center_lon, territory_type, poi_name FROM territories LIMIT 20')
            for lat, lon, t_type, poi_name in c.fetchall():
                if lat is None: continue
                biome = assign_biome(float(lat), float(lon), '', t_type or '')
                self.stdout.write(f'  ({lat:6.1f},{lon:7.1f}) {t_type:12} → {biome:12}  {poi_name or ""}')
