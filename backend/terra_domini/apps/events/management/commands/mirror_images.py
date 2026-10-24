"""
Copy every token picture to our server (see events/image_mirror.py).

  python manage.py mirror_images              # download the missing ones, then point the game DB at the copies
  python manage.py mirror_images --dry-run    # count only

Sources: the master DB + POI ledger (what import_hexod_db will load) and the game DB (admin edits). Idempotent and
resumable: files already mirrored are skipped. Paced at ~1 request/s with back-off on HTTP 429 (Wikimedia limits).
"""
import time
from urllib.error import HTTPError
from urllib.request import Request, urlopen

from django.core.management.base import BaseCommand

from terra_domini.apps.events import hexod_db, image_mirror, poi_validations
from terra_domini.apps.events.unified_poi import UnifiedPOI

UA = 'HEXOD-image-mirror/1.0 (https://hexod.paintit.click; game token database)'


def fetch(url, tries=5):
    for i in range(tries):
        try:
            with urlopen(Request(url, headers={'User-Agent': UA}), timeout=60) as r:
                mime = (r.headers.get('Content-Type') or '').split(';')[0]
                return r.read(15_000_000), mime
        except HTTPError as e:
            if e.code in (429, 503) and i < tries - 1:
                time.sleep(int(e.headers.get('Retry-After') or 0) or 15 * (i + 1))
                continue
            raise


class Command(BaseCommand):
    help = 'Mirror token pictures on our server (MEDIA_ROOT/poi_img)'

    def add_arguments(self, parser):
        parser.add_argument('--dry-run', action='store_true')
        parser.add_argument('--limit', type=int, default=0, help='download at most N (test)')
        parser.add_argument('--pause', type=float, default=1.0, help='seconds between downloads')

    def handle(self, *args, **opts):
        pois, _, _ = poi_validations.overlay([dict(p) for p in hexod_db.load()['pois'] if p.get('on_map') and p.get('h3_r8')])
        urls = {p.get('image_url') or '' for p in pois}
        urls |= set(UnifiedPOI.objects.values_list('image_url', flat=True))
        urls = sorted(u for u in urls if u.startswith('https://'))
        todo = [u for u in urls if not image_mirror.local_file(u)]
        self.stdout.write(f'{len(urls)} pictures, {len(urls) - len(todo)} already mirrored, {len(todo)} to download')
        if opts['limit']:
            todo = todo[:opts['limit']]
        if opts['dry_run']:
            return
        d = image_mirror.mirror_dir()
        d.mkdir(parents=True, exist_ok=True)
        ok = fail = 0
        for n, u in enumerate(todo, 1):
            try:
                data, mime = fetch(u)
                ext = image_mirror.EXTS.get(mime)
                if not ext or not data:
                    raise ValueError(f'not a picture ({mime})')
                tmp = d / (image_mirror.stem(u) + '.part')
                tmp.write_bytes(data)
                tmp.rename(d / (image_mirror.stem(u) + ext))
                ok += 1
            except Exception as e:  # noqa: BLE001  (one bad url never stops the run)
                fail += 1
                self.stderr.write(f'  fail {u[:120]}: {e}')
            if n % 100 == 0:
                self.stdout.write(f'  {n}/{len(todo)}')
            time.sleep(opts['pause'])
        # point the live rows at the copies (import_hexod_db does the same on every rebuild)
        moved = 0
        for p in UnifiedPOI.objects.filter(image_url__startswith='https://').only('id', 'image_url'):
            local = image_mirror.served_url(p.image_url)
            if local != p.image_url:
                UnifiedPOI.objects.filter(id=p.id).update(image_url=local)
                moved += 1
        self.stdout.write(self.style.SUCCESS(f'mirrored {ok}, failed {fail}, {moved} rows now served from our server'))
