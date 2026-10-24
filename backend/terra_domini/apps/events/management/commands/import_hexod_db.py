"""
Load the HEXOD master database (data/hexod_db/hexod_db.json) into the game DB.

  python manage.py import_hexod_db            # upsert POIs + POI territories (H3 res 8)
  python manage.py import_hexod_db --dry-run  # counts only
  python manage.py import_hexod_db --keep-legacy

- UnifiedPOI: rows with source='hexod_db' are replaced; other POIs are deactivated
  unless --keep-legacy (one unique database).
- Territory: one res-8 territory per on-map POI. Owners and defenses are never
  touched; only POI/rarity/income fields are refreshed.
- POI agent ledger (poi_validations.jsonl) applied on top: validated rows keep their checked data + validated_at.
- Unowned legacy POI territories at another resolution (res 7/10, not clickable on
  the res-8 grid) are removed.
Idempotent: safe to re-run after every rebuild of the JSON.
"""
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils.dateparse import parse_datetime

from terra_domini.apps.economy.balance import HEX_PER_DAY
from terra_domini.apps.events import hexod_db, image_mirror
from terra_domini.apps.events.unified_poi import POI_VISUAL, RARITY_TDC, UnifiedPOI
from terra_domini.apps.territories.models import Territory
from terra_domini.apps.territories.territory_engine import _biome_from_category

RANK = {'common': 0, 'uncommon': 1, 'rare': 2, 'epic': 3, 'legendary': 4, 'mythic': 5}
BIOME_TO_TYPE = {'urban': 'urban', 'mountain': 'mountain', 'forest': 'forest', 'coastal': 'coastal',
                 'desert': 'desert', 'industrial': 'industrial', 'tundra': 'arctic', 'landmark': 'landmark'}


def _fun_fact(p):
    facts = [p.get(k) for k in ('fun_fact_1', 'fun_fact_2', 'fun_fact_3') if p.get(k)]
    if p.get('rare_fact'):
        facts.append(p['rare_fact'])
    return '\n'.join(facts)


class Command(BaseCommand):
    help = 'Import the HEXOD master database (POIs + POI territories at H3 res 8)'

    def add_arguments(self, parser):
        parser.add_argument('--dry-run', action='store_true')
        parser.add_argument('--keep-legacy', action='store_true', help='keep POIs from other sources active')

    def handle(self, *args, **opts):
        db = hexod_db.load()
        if not db:
            raise CommandError(f'{hexod_db.DB_PATH} not found — run scripts/build_hexod_db.py')
        res = db.get('h3_resolution')
        if res != 8:
            raise CommandError(f'expected H3 resolution 8, got {res}')
        pois = [p for p in db['pois'] if p.get('on_map') and p.get('h3_r8')]
        # POI agent stamps (poi_validations.jsonl): checked rows keep their checked data, rejected rows leave the map
        from terra_domini.apps.events import poi_validations
        pois, n_valid, n_rej = poi_validations.overlay([dict(p) for p in pois])
        if n_valid or n_rej:
            self.stdout.write(f'POI agent ledger: {n_valid} validated rows applied, {n_rej} rejected rows left out')
        # 4 rarities, 50 / 30 / 15 / 5 % per kind of token: ranked by the checked rarity, then the master DB score
        species = [p for p in pois if p.get('creature_uid')]
        hexod_db.apply_quotas([p for p in pois if not p.get('creature_uid')], family=lambda p: p.get('kind') or '',
                              score=lambda p: p.get('score') or 0)
        for p in species:                 # a species token has its creature's rarity (creatures are cut by the same shares)
            c = hexod_db.creature(p['creature_uid'])
            p['rarity'] = (c or {}).get('rarity') or 'common'

        # One POI per hex on the map — keep the rarest (admin-edited tokens keep their own territory)
        admin_uids = set(UnifiedPOI.objects.filter(source='admin').exclude(db_uid='').values_list('db_uid', flat=True))
        best = {}
        for p in pois:
            if p['uid'] in admin_uids:
                continue
            cur = best.get(p['h3_r8'])
            if cur is None or RANK.get(p['rarity'], 0) > RANK.get(cur['rarity'], 0):
                best[p['h3_r8']] = p

        if opts['dry_run']:
            self.stdout.write(f"{len(pois)} on-map POIs, {len(best)} territories, "
                              f"{len(db.get('creatures', []))} creatures — dry run, nothing written")
            return

        with transaction.atomic():
            # ── UnifiedPOI (bulk_create bypasses save(), which forces res 7 and category rarity) ──
            # Admin-edited tokens (source='admin', token editor) win over the spreadsheet: never overwritten
            edited = set(UnifiedPOI.objects.filter(source='admin').exclude(db_uid='').values_list('db_uid', flat=True))
            UnifiedPOI.objects.filter(source='hexod_db').delete()
            rows = []
            for p in pois:
                if p['uid'] in edited:
                    continue
                cfg = POI_VISUAL.get(p['game_category'], {})
                rarity = p['rarity']
                rows.append(UnifiedPOI(
                    name=p['name'][:300], category=p['game_category'][:30],
                    latitude=p['lat'], longitude=p['lon'], h3_index=p['h3_r8'],
                    country_code=(p.get('country_code') or '')[:4],
                    emoji=cfg.get('emoji', ''), color=cfg.get('color', '#6B7280'), size=cfg.get('size', 'md'),
                    rarity=rarity, game_resource=cfg.get('game_resource', 'credits'), bonus_pct=cfg.get('bonus', 25),
                    tdc_per_24h=HEX_PER_DAY.get(rarity, RARITY_TDC.get(rarity, 10)),
                    description=p.get('description') or p.get('title') or '',
                    real_output=(p.get('title') or '')[:200],
                    wiki_url=p['wiki_url'] if len(p.get('wiki_url') or '') <= 200 else '', fun_fact=_fun_fact(p),
                    is_active=True, is_featured=p.get('quality') == 'premium', verified=True, source='hexod_db', db_uid=p['uid'][:60],
                    image_url=image_mirror.served_url(p['image_url']) if str(p.get('image_url', '')).startswith('https://') else '',
                    image_credit=(p.get('image_credit') or '')[:300], event_date=(p.get('event_date') or '')[:10],
                    token_id=p.get('token_id') or None, visitors_per_year=int(p.get('visitors_per_year') or 0),
                    geopolitical_score=int(p.get('geopolitical_score') or 0),
                    validated_at=parse_datetime(p['validated_at']) if p.get('validated_at') else None,
                ))
            UnifiedPOI.objects.bulk_create(rows, batch_size=500)
            deactivated = 0
            if not opts['keep_legacy']:
                deactivated = UnifiedPOI.objects.exclude(source__in=['hexod_db', 'admin']).filter(is_active=True).update(is_active=False)

            # ── Territories (res 8) ──
            existing = {t.h3_index: t for t in Territory.objects.filter(h3_index__in=list(best))}
            created = updated = 0
            to_create, to_update = [], []
            import h3
            for hx, p in best.items():
                biome = _biome_from_category(p['game_category'])
                ttype = 'urban' if p['kind'] == 'city' else BIOME_TO_TYPE.get(biome, 'landmark')
                fields = dict(
                    h3_resolution=8, rarity=p['rarity'], biome=biome, territory_type=ttype,
                    tdc_per_day=HEX_PER_DAY.get(p['rarity'], 60), resource_credits=HEX_PER_DAY.get(p['rarity'], 60),
                    poi_name=p['name'][:200], poi_wiki_url=(p.get('wiki_url') or '')[:500],
                    is_landmark=True, landmark_name=p['name'][:200], place_name=p['name'][:200],
                    hex_type='poi', country_code=(p.get('country_code') or '')[:3],
                )
                t = existing.get(hx)
                if t:
                    for k, v in fields.items():
                        setattr(t, k, v)
                    to_update.append(t)
                else:
                    lat, lon = h3.cell_to_latlng(hx)
                    to_create.append(Territory(h3_index=hx, center_lat=lat, center_lon=lon, **fields))
            Territory.objects.bulk_create(to_create, batch_size=500)
            Territory.objects.bulk_update(to_update, list(fields), batch_size=500)
            created, updated = len(to_create), len(to_update)

            # ── Legacy POI territories at another resolution, unowned → unreachable on the map ──
            legacy_ids = [tid for tid, hx in Territory.objects.filter(owner__isnull=True).exclude(poi_name='')
                          .values_list('id', 'h3_index') if h3.get_resolution(hx) != 8]
            removed = len(legacy_ids)
            for i in range(0, removed, 500):
                Territory.objects.filter(id__in=legacy_ids[i:i + 500]).delete()

        # ── Owned hexes at another resolution (old seeds, res 10) → moved to their res-8 cell (the map grid) ──
        moved = 0
        with transaction.atomic():
            for t in list(Territory.objects.filter(owner__isnull=False).only('id', 'h3_index', 'owner_id', 'captured_at')):
                try:
                    res = h3.get_resolution(t.h3_index)
                except Exception:
                    continue
                if res == 8:
                    continue
                parent = h3.cell_to_parent(t.h3_index, 8) if res > 8 else None
                if parent:
                    cell = Territory.objects.filter(h3_index=parent).first()
                    if cell is None:
                        lat, lon = h3.cell_to_latlng(parent)
                        cell = Territory.objects.create(h3_index=parent, h3_resolution=8, center_lat=lat, center_lon=lon)
                    if not cell.owner_id:
                        cell.owner_id, cell.captured_at = t.owner_id, t.captured_at
                        cell.save(update_fields=['owner', 'captured_at'])
                t.delete()
                moved += 1

        # ── Terrain of every territory from the DB rules (cities → urban, regions, industrial sites) ──
        from terra_domini.apps.territories.terrain_rules import terrain, territory_type_for
        poi_cat = dict(UnifiedPOI.objects.filter(is_active=True).exclude(h3_index='').values_list('h3_index', 'category'))
        changed = []
        for t in Territory.objects.exclude(center_lat__isnull=True).only('id', 'h3_index', 'center_lat', 'center_lon', 'biome', 'territory_type', 'terrain_source'):
            cat = poi_cat.get(t.h3_index, '')
            if t.terrain_source and not cat:
                continue   # measured terrain (refine_terrain) beats the coarse rules
            biome = terrain(round(t.center_lat, 4), round(t.center_lon, 4), cat, precise=False)[0]
            ttype = 'landmark' if cat and biome == 'landmark' else territory_type_for(biome)
            if t.biome != biome or t.territory_type != ttype:
                t.biome, t.territory_type = biome, ttype
                changed.append(t)
        Territory.objects.bulk_update(changed, ['biome', 'territory_type'], batch_size=500)

        self.stdout.write(self.style.SUCCESS(f'terrain: {len(changed)} territories re-classified · {moved} owned off-grid hexes moved to res 8'))
        self.stdout.write(self.style.SUCCESS(
            f'HEXOD DB v{db.get("version")}: {len(rows)} POIs imported ({deactivated} legacy deactivated) · '
            f'territories {created} created / {updated} updated · {removed} legacy POI territories removed · '
            f'{len(db.get("creatures", []))} creatures available to Safari'))
