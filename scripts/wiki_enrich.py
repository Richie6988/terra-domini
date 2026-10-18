"""
Wikipedia enrichment for the HEXOD master DB — run where Wikipedia is reachable (the VPS).

  python3 scripts/wiki_enrich.py                 # every token, creature and candidate not fetched yet
  python3 scripts/wiki_enrich.py --only pois     # pois | creatures | candidates
  python3 scripts/wiki_enrich.py --limit 200     # try a few first
  python3 scripts/wiki_enrich.py --refresh 30    # re-fetch rows older than 30 days

For each English Wikipedia article (wiki_url of tokens, creatures, sources/candidates/*.csv) it records:
exists, canonical title, coordinates, lead picture (800 px) with author + license, 3-sentence intro, Wikidata id.
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
          'image_artist', 'image_license_url', 'extract', 'wikidata', 'fetched_at']


def title_of(url: str) -> str:
    """https://en.wikipedia.org/wiki/Notre-Dame_de_Paris_fire → 'Notre-Dame de Paris fire' (cache key)."""
    m = re.search(r'en\.(?:m\.)?wikipedia\.org/wiki/([^?#]+)', url or '')
    return unquote(m.group(1)).replace('_', ' ').strip() if m else ''


def api(params: dict, tries=4) -> dict:
    params = {**params, 'format': 'json', 'formatversion': 2, 'maxlag': 5}
    for i in range(tries):
        try:
            req = Request(API + '?' + urlencode(params), headers={'User-Agent': UA})
            with urlopen(req, timeout=30) as r:
                d = json.load(r)
            if d.get('error', {}).get('code') == 'maxlag':
                time.sleep(5 * (i + 1)); continue
            return d
        except Exception as e:   # network hiccup → back off
            if i == tries - 1:
                raise
            print(f'  retry ({e})', file=sys.stderr); time.sleep(3 * (i + 1))
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
    """≤50 file names → {file: (thumb url, license, artist, license url)}; non-free files are left out."""
    d = api({'action': 'query', 'titles': '|'.join('File:' + f for f in files), 'prop': 'imageinfo',
             'iiprop': 'url|extmetadata', 'iiurlwidth': 800,
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
                                                     md.get('LicenseUrl', {}).get('value', ''))
    return out


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
    todo = [t for t in wanted(a.only) if t not in cache or (cutoff and cache[t].get('fetched_at', '') < cutoff)]
    if a.limit:
        todo = todo[:a.limit]
    print(f'{len(todo)} articles to fetch ({len(cache)} cached)')

    def save():
        with open(OUT, 'w', newline='', encoding='utf-8') as f:
            w = csv.DictWriter(f, fieldnames=FIELDS); w.writeheader()
            for k in sorted(cache):
                w.writerow({c: cache[k].get(c, '') for c in FIELDS})

    now = datetime.utcnow().strftime('%Y-%m-%d')
    for i in range(0, len(todo), 20):
        rows = fetch_pages(todo[i:i + 20])
        files = sorted({r['image_file'] for r in rows.values() if r.get('image_file')})
        imgs = {}
        for j in range(0, len(files), 50):
            imgs.update(fetch_images(files[j:j + 50])); time.sleep(1)
        for t, r in rows.items():
            im = imgs.get(r.get('image_file', ''))
            if im:
                r['image_url'], r['image_license'], r['image_artist'], r['image_license_url'] = im
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
