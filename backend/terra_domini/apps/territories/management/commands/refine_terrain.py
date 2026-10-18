"""
Measure the real terrain of territories (ESA WorldCover land cover + elevation, territories/landcover.py).

  python manage.py refine_terrain                # territories not measured yet (owned first), up to 3000
  python manage.py refine_terrain --limit 0      # all of them
  python manage.py refine_terrain --redo         # measure again
Resumable and polite (tiles are cached on disk, a source that fails is paused). Run nightly by cron.
"""
from django.core.management.base import BaseCommand
from django.db.models import F

from terra_domini.apps.territories.models import Territory


class Command(BaseCommand):
    help = 'Measure territory terrain from ESA WorldCover + elevation'

    def add_arguments(self, parser):
        parser.add_argument('--limit', type=int, default=3000)
        parser.add_argument('--redo', action='store_true')

    def handle(self, *args, **o):
        from terra_domini.apps.events.unified_poi import UnifiedPOI
        from terra_domini.apps.territories.landcover import classify
        from terra_domini.apps.territories.terrain_rules import terrain, territory_type_for
        qs = Territory.objects.exclude(center_lat__isnull=True)
        if not o['redo']:
            qs = qs.filter(terrain_source='')
        qs = qs.order_by(F('owner').desc(nulls_last=True), 'id').only('id', 'h3_index', 'center_lat', 'center_lon', 'biome', 'territory_type')
        if o['limit']:
            qs = qs[:o['limit']]
        poi_cat = dict(UnifiedPOI.objects.filter(is_active=True).exclude(h3_index='').values_list('h3_index', 'category'))
        done = changed = skipped = 0
        for t in qs.iterator():
            lat, lon = round(t.center_lat, 4), round(t.center_lon, 4)
            m = classify(lat, lon)
            if m is None:
                skipped += 1
                if skipped >= 20 and not done:
                    self.stdout.write(self.style.WARNING('terrain sources unreachable — stopping, try later'))
                    break
                continue
            biome = terrain(lat, lon, poi_cat.get(t.h3_index, ''))[0]
            ttype = 'landmark' if poi_cat.get(t.h3_index) and biome == 'landmark' else territory_type_for(biome)
            changed += (biome != t.biome)
            Territory.objects.filter(id=t.id).update(biome=biome, territory_type=ttype, terrain_source='worldcover',
                                                     elevation_m=m[2].get('elevation_m'))
            done += 1
            if done % 200 == 0:
                self.stdout.write(f'  {done} measured · {changed} changed')
        self.stdout.write(self.style.SUCCESS(f'terrain measured: {done} territories · {changed} changed · {skipped} unreachable'))
