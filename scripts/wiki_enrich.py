"""
Wikipedia enrichment for the HEXOD master DB — run where Wikipedia is reachable (the VPS).

  python3 scripts/wiki_enrich.py                 # every token, creature and candidate not fetched yet
  python3 scripts/wiki_enrich.py --only pois     # pois | creatures | candidates
  python3 scripts/wiki_enrich.py --limit 200     # try a few first
  python3 scripts/wiki_enrich.py --refresh 30    # re-fetch rows older than 30 days

For each English Wikipedia article (wiki_url of tokens, creatures, sources/candidates/*.csv) it records:
exists, canonical title, coordinates, the best picture (1280 px) with author + license, 3-sentence intro, Wikidata id.
Picture choice (image_v 3): articles listed in column H of the owner's extracts keep their lead picture as is (already
validated). Others (owner 2026-10-19 "beautiful images for the tokens"): the Wikidata main image (P18), else the
article's lead picture, else its best other photo — maps, flags, logos, coats of arms, diagrams, SVG drawings, small
files and odd shapes are refused. Rows picked with an older rule are re-picked on the next run (pictures only).
Non-free pictures (fair use) are never kept. Output: data/hexod_db/sources/wiki_enrich.csv (resumable cache,
commit it). Then: python3 scripts/build_hexod_db.py && python manage.py import_hexod_db.

Stdlib only. Polite: 1 request/s, maxlag, descriptive User-Agent (Wikimedia API etiquette).
"""
import argparse, csv, glob, html, json, os, re, sys, time
from datetime import date, datetime, timedelta
from pathlib import Path
from urllib.parse import unquote, urlencode
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
DB = Path(os.environ.get('HEXOD_DB_JSON') or ROOT / 'data' / 'hexod_db' / 'hexod_db.json')
SRC = ROOT / 'data' / 'hexod_db' / 'sources'
OUT = SRC / 'wiki_enrich.csv'
API = 'https://en.wikipedia.org/w/api.php'
UA = 'HEXOD-wiki-enrich/1.0 (https://hexod.paintit.click; game token database)'
FIELDS = ['title', 'exists', 'page_title', 'lat', 'lon', 'image_file', 'image_url', 'image_license',
          'image_artist', 'image_license_url', 'extract', 'wikidata', 'fetched_at', 'image_w', 'image_h', 'image_v']
WD_API = 'https://www.wikidata.org/w/api.php'
IMAGE_V = 3            # picture rule version (bump to re-pick every picture)
THUMB_W = 1280         # sharp on a 640 px card at 2x
MIN_W = 800            # smaller originals look blurry on the card
BAD_WORDS = re.compile(r'\b(maps?|karte|carte|mapa|locator|flag|flags|drapeau|coat of arms|blason|wappen|escudo|seal|logo|'
                       r'emblem|insignia|icon|symbol|diagram|chart|graph|plan|schema|sketch|signature|stamp|banknote|'
                       r'coin|poster|cover|screenshot)\b', re.I)


def bad_file(name: str) -> bool:
    return bool(BAD_WORDS.search(re.sub(r'[_\-.]', ' ', name or '')))


def title_of(url: str) -> str:
    """https://en.wikipedia.org/wiki/Notre-Dame_de_Paris_fire → 'Notre-Dame de Paris fire' (cache key)."""
    m = re.search(r'en\.(?:m\.)?wikipedia\.org/wiki/([^?#]+)', url or '')
    return unquote(m.group(1)).replace('_', ' ').strip() if m else ''


def api(params: dict, tries=5, host=API) -> dict:
    params = {**params, 'format': 'json', 'formatversion': 2, 'maxlag': 5}
    for i in range(tries):
        try:
            req = Request(host + '?' + urlencode(params), headers={'User-Agent': UA})
            with urlopen(req, timeout=30) as r:
                d = json.load(r)
            if d.get('error', {}).get('code') == 'maxlag':
                time.sleep(5 * (i + 1)); continue
            return d
        except Exception as e:   # network hiccup → back off (429: as long as the server asks, shared IPs get throttled)
            if i == tries - 1:
                raise
            wait = 3 * (i + 1)
            if getattr(e, 'code', None) == 429:
                wait = min(60, int((e.headers or {}).get('Retry-After') or 0) or 10 * (i + 1))
            print(f'  retry in {wait}s ({e})', file=sys.stderr); time.sleep(wait)
    return {}


def strip_html(s: str) -> str:
    return re.sub(r'\s+', ' ', html.unescape(re.sub(r'<[^>]+>', '', s or ''))).strip()


def wanted(only):
    titles = []
    db_file = DB if DB.exists() else ROOT / 'data' / 'hexod_db' / 'hexod_db.json'
    db = json.loads(db_file.read_text(encoding='utf-8')) if db_file.exists() else {}
    if only in (None, 'pois'):
        titles += [title_of(p.get('wiki_url')) for p in db.get('pois', [])]
    if only in (None, 'candidates'):
        for f in sorted(glob.glob(str(SRC / 'candidates' / '*.csv'))) + [str(SRC / 'curated_tokens.csv')]:
            if Path(f).exists():
                with open(f, newline='', encoding='utf-8') as fh:
                    titles += [title_of(r.get('wiki_url')) for r in csv.DictReader(fh)]
    if only in (None, 'creatures'):
        titles += [title_of(c.get('wiki_url')) for c in db.get('creatures', [])]
    seen, out = set(), []
    for t in titles:
        if t and t not in seen:
            seen.add(t); out.append(t)
    return out


def fetch_pages(titles):
    """Batch of ≤20 titles → {requested title: row} (extracts are capped at 20 per request)."""
    d = api({'action': 'query', 'redirects': 1, 'titles': '|'.join(titles),
             'prop': 'pageimages|coordinates|extracts|pageprops', 'piprop': 'name', 'pilicense': 'any',
             'exintro': 1, 'explaintext': 1, 'exsentences': 3, 'exlimit': 'max', 'colimit': 'max', 'ppprop': 'wikibase_item'})
    q = d.get('query', {})
    alias = {}
    for k in ('normalized', 'redirects'):
        for m in q.get(k, []):
            alias[m['from']] = m['to']
    pages = {p['title']: p for p in q.get('pages', [])}
    out = {}
    for t in titles:
        final = t
        while final in alias and alias[final] != final:
            final = alias[final]
        p = pages.get(final, {})
        if not p or p.get('missing') or p.get('invalid'):
            out[t] = {'title': t, 'exists': 0}
            continue
        co = (p.get('coordinates') or [{}])[0]
        out[t] = {'title': t, 'exists': 1, 'page_title': p['title'], 'lat': co.get('lat', ''), 'lon': co.get('lon', ''),
                  'image_file': p.get('pageimage', ''), 'extract': (p.get('extract') or '').strip()[:900],
                  'wikidata': (p.get('pageprops') or {}).get('wikibase_item', '')}
    return out


def fetch_images(files):
    """≤50 file names → {file: (thumb url, license, artist, license url, width, height, mime)}; non-free files left out."""
    d = api({'action': 'query', 'titles': '|'.join('File:' + f for f in files), 'prop': 'imageinfo',
             'iiprop': 'url|size|mime|extmetadata', 'iiurlwidth': THUMB_W,
             'iiextmetadatafilter': 'LicenseShortName|Artist|LicenseUrl|NonFree|UsageTerms'})
    out = {}
    for p in d.get('query', {}).get('pages', []):
        ii = (p.get('imageinfo') or [{}])[0]
        md = ii.get('extmetadata') or {}
        lic = strip_html(md.get('LicenseShortName', {}).get('value', ''))
        if md.get('NonFree', {}).get('value') or re.search(r'fair use|non-free', lic + strip_html(md.get('UsageTerms', {}).get('value', '')), re.I):
            continue
        url = ii.get('thumburl') or ii.get('url') or ''
        if url.startswith('https://upload.wikimedia.org/'):
            out[p['title'].removeprefix('File:')] = (url, lic, strip_html(md.get('Artist', {}).get('value', ''))[:200],
                                                     md.get('LicenseUrl', {}).get('value', ''),
                                                     int(ii.get('width') or 0), int(ii.get('height') or 0), ii.get('mime', ''))
    return out


def good_photo(name, info) -> bool:
    """A real photo worth a premium card: JPEG/PNG/WebP, wide enough, not a map/flag/logo/diagram, sane shape."""
    if not info:
        return False
    w, h, mime = info[4], info[5], info[6]
    if mime not in ('image/jpeg', 'image/webp') and not (mime == 'image/png' and w >= 1200):
        return False
    if w < MIN_W or not h or not 0.6 <= w / h <= 2.4:
        return False
    return not bad_file(name)


def photo_score(info) -> float:
    w, h = info[4], info[5]
    ratio = w / h
    return min(w * h, 4e6) * (1.25 if 1.2 <= ratio <= 1.9 else 1.0) * (1.1 if info[6] == 'image/jpeg' else 1.0)


def fetch_p18(qids):
    """≤50 Wikidata ids → {qid: main image file name (P18)}."""
    d = api({'action': 'wbgetentities', 'ids': '|'.join(qids), 'props': 'claims'}, host=WD_API)
    out = {}
    for q, e in (d.get('entities') or {}).items():
        for c in (e.get('claims') or {}).get('P18', []):
            v = ((c.get('mainsnak') or {}).get('datavalue') or {}).get('value')
            if v:
                out[q] = v.replace('_', ' '); break
    return out


def article_images(titles):
    """≤20 page titles → {page title: [file names]} (the files shown in the article)."""
    d = api({'action': 'query', 'titles': '|'.join(titles), 'prop': 'images', 'imlimit': 'max'})
    out = {}
    for p in d.get('query', {}).get('pages', []):
        out[p['title']] = [i['title'].removeprefix('File:') for i in p.get('images', [])
                           if re.search(r'\.(jpe?g|png|webp)$', i['title'], re.I) and not bad_file(i['title'])][:25]
    return out


_TRUSTED = None


def trusted_titles() -> set:
    """Articles whose pictures the owner already validated: column H ('link') of the source extracts
    (nature / wiki / city / country_full_extract.xlsx). Their lead picture is used as is (owner 2026-10-19)."""
    global _TRUSTED
    if _TRUSTED is None:
        _TRUSTED = set()
        try:
            import openpyxl
            for f in ('nature_full_extract.xlsx', 'wiki_full_extract.xlsx', 'city_full_extract.xlsx', 'country_full_extract.xlsx'):
                if (SRC / f).exists():
                    ws = openpyxl.load_workbook(SRC / f, read_only=True).worksheets[0]
                    rows = ws.iter_rows(values_only=True)
                    head = [str(h or '') for h in next(rows)]
                    k = head.index('link') if 'link' in head else 7
                    _TRUSTED |= {title_of(str(r[k] or '')) for r in rows if len(r) > k and r[k]}
        except Exception as e:      # openpyxl missing: every picture goes through the normal choice
            print(f'  trusted links not loaded ({e})', file=sys.stderr)
        _TRUSTED.discard('')
    return _TRUSTED


def pick_pictures(rows):
    """Choose the best picture for each found row (Wikidata P18 → lead picture → best article photo). Mutates rows."""
    found = [r for r in rows if str(r.get('exists')) == '1']
    if not found:
        return
    qids = sorted({r['wikidata'] for r in found if r.get('wikidata')})
    p18 = {}
    for j in range(0, len(qids), 50):
        p18.update(fetch_p18(qids[j:j + 50])); time.sleep(0.5)
    extra = {}
    pages = [r['page_title'] for r in found if r.get('page_title')]
    for j in range(0, len(pages), 20):
        extra.update(article_images(pages[j:j + 20])); time.sleep(0.5)
    files = set()
    for r in found:
        files |= {f for f in (p18.get(r.get('wikidata')), r.get('image_file')) if f} | set(extra.get(r.get('page_title'), []))
    files = sorted(files)
    info = {}
    for j in range(0, len(files), 50):
        info.update(fetch_images(files[j:j + 50])); time.sleep(1)
    trusted = trusted_titles()
    for r in found:
        lead = r.get('image_file')
        if (r.get('title') in trusted or r.get('page_title') in trusted) and lead and info.get(lead):
            choice = lead              # picture already validated by the owner: the article's lead picture, as is
        else:
            choice = next((f for f in (p18.get(r.get('wikidata')), r.get('image_file')) if f and good_photo(f, info.get(f))), None)
        if not choice:
            others = [f for f in extra.get(r.get('page_title'), []) if good_photo(f, info.get(f))]
            choice = max(others, key=lambda f: photo_score(info[f]), default=None)
        if not choice and lead and info.get(lead) and not bad_file(lead) and info[lead][4] >= 400 \
                and info[lead][6] in ('image/jpeg', 'image/png', 'image/webp'):
            choice = lead          # old events: a small archive photo still beats a satellite view
        if choice:
            im = info[choice]
            r.update(image_file=choice, image_url=im[0], image_license=im[1], image_artist=im[2], image_license_url=im[3],
                     image_w=im[4], image_h=im[5])
        else:
            r.update(image_url='', image_license='', image_artist='', image_license_url='', image_w='', image_h='')
        r['image_v'] = IMAGE_V


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--only', choices=['pois', 'creatures', 'candidates'])
    ap.add_argument('--limit', type=int, default=0)
    ap.add_argument('--refresh', type=int, default=0, help='re-fetch rows older than N days')
    a = ap.parse_args()

    cache = {}
    if OUT.exists():
        with open(OUT, newline='', encoding='utf-8') as f:
            cache = {r['title']: r for r in csv.DictReader(f)}
    cutoff = (date.today() - timedelta(days=a.refresh)).isoformat() if a.refresh else None
    want = wanted(a.only)
    todo = [t for t in want if t not in cache or (cutoff and cache[t].get('fetched_at', '') < cutoff)]
    # Rows whose picture was chosen with an older rule: re-pick the picture only (no page re-fetch)
    repick = [t for t in want if t in cache and t not in set(todo) and str(cache[t].get('exists')) == '1'
              and str(cache[t].get('image_v') or '0') != str(IMAGE_V)]
    if a.limit:
        todo, repick = todo[:a.limit], repick[:a.limit]
    print(f'{len(todo)} articles to fetch, {len(repick)} pictures to re-pick ({len(cache)} cached)')

    def save():
        with open(OUT, 'w', newline='', encoding='utf-8') as f:
            w = csv.DictWriter(f, fieldnames=FIELDS); w.writeheader()
            for k in sorted(cache):
                w.writerow({c: cache[k].get(c, '') for c in FIELDS})

    now = datetime.utcnow().strftime('%Y-%m-%d')
    for i in range(0, len(repick), 20):
        pick_pictures([cache[t] for t in repick[i:i + 20]])
        done = min(i + 20, len(repick))
        if done % 200 == 0 or done == len(repick):
            save()
            print(f'  re-picked {done}/{len(repick)} · with picture {sum(1 for t in repick[:done] if cache[t].get("image_url"))}')
        time.sleep(1)
    for i in range(0, len(todo), 20):
        rows = fetch_pages(todo[i:i + 20])
        pick_pictures(list(rows.values()))
        for t, r in rows.items():
            r['fetched_at'] = now
            cache[t] = r
        done = min(i + 20, len(todo))
        if done % 200 == 0 or done == len(todo):
            save()
            ok = sum(1 for t in todo[:done] if cache[t].get('exists') in (1, '1'))
            pics = sum(1 for t in todo[:done] if cache[t].get('image_url'))
            print(f'  {done}/{len(todo)} · found {ok} · pictures {pics}')
        time.sleep(1)
    save()
    rows = list(cache.values())
    print(f"done: {len(rows)} articles · missing {sum(1 for r in rows if str(r.get('exists')) == '0')} · "
          f"with picture {sum(1 for r in rows if r.get('image_url'))} · with coordinates {sum(1 for r in rows if r.get('lat'))} → {OUT}")


if __name__ == '__main__':
    main()
