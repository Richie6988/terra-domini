"""
Token data from open reference databases, category by category — run on the VPS (internet access).

  python3 scripts/fetch_external.py wikidata     # places + history events → sources/candidates/wikidata.csv
  python3 scripts/fetch_external.py inat         # creature photos (iNaturalist, CC licences) → sources/creature_photos.csv
  python3 scripts/fetch_external.py pbdb         # fossil sites of extinct creatures (Paleobiology DB) → sources/fossil_sites.csv
  python3 scripts/fetch_external.py all

- Wikidata: one SPARQL query per category (volcanoes, waterfalls, castles, stadiums, battles, earthquakes…), only
  items with coordinates AND an English Wikipedia article. Rarity = the item's rank by number of Wikipedia language
  editions (sitelinks) inside its category — an objective fame score (top 2 % legendary, 5 % epic, 13 % rare,
  25 % uncommon). The rows go through the same gate as the agents' candidates (wiki_enrich.py → build_hexod_db.py).
- iNaturalist: the species' default photo when its licence is open (CC0 / CC BY / CC BY-SA…), with attribution.
- PBDB: where the genus' fossils were found (modern coordinates) — shown on the creature card.
Stdlib only, polite (1 request/s, descriptive User-Agent), resumable caches.
"""
import csv, json, sys, time
from datetime import date
from pathlib import Path
from urllib.parse import unquote, urlencode
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / 'data' / 'hexod_db' / 'sources'
UA = 'HEXOD-data/1.0 (https://hexod.paintit.click; game token database)'
TODAY = date.today().isoformat()

# (game slug, kind, Wikidata selector, min sitelinks, limit)
CATEGORIES = [
    ('volcano', 'landmark', 'wdt:P31/wdt:P279* wd:Q8072', 12, 400),
    ('waterfall', 'landmark', 'wdt:P31/wdt:P279* wd:Q34038', 8, 300),
    ('glacier', 'landmark', 'wdt:P31 wd:Q35666', 8, 250),
    ('cave_system', 'landmark', 'wdt:P31/wdt:P279* wd:Q35509', 8, 300),
    ('mountain_peak', 'landmark', 'wdt:P31 wd:Q8502', 25, 600),
    ('freshwater', 'landmark', 'wdt:P31 wd:Q23397', 30, 400),
    ('island', 'landmark', 'wdt:P31 wd:Q23442', 35, 400),
    ('desert', 'landmark', 'wdt:P31/wdt:P279* wd:Q8514', 10, 150),
    ('nature_sanctuary', 'landmark', 'wdt:P31/wdt:P279* wd:Q46169', 15, 500),
    ('world_heritage', 'landmark', 'wdt:P1435 wd:Q9259', 10, 1200),
    ('royal_palace', 'landmark', 'wdt:P31/wdt:P279* wd:Q23413', 15, 500),
    ('religious_site', 'landmark', 'wdt:P31 wd:Q2977', 15, 400),       # cathedrals
    ('religious_site', 'landmark', 'wdt:P31 wd:Q32815', 15, 300),      # mosques
    ('religious_site', 'landmark', 'wdt:P31/wdt:P279* wd:Q44539', 15, 300),   # temples
    ('museum', 'landmark', 'wdt:P31/wdt:P279* wd:Q33506', 25, 600),
    ('sports_arena', 'landmark', 'wdt:P31/wdt:P279* wd:Q483110', 20, 500),
    ('infrastructure', 'landmark', 'wdt:P31/wdt:P279* wd:Q12280', 20, 400),   # bridges
    ('infrastructure', 'landmark', 'wdt:P31 wd:Q11303', 20, 300),             # skyscrapers
    ('infrastructure', 'landmark', 'wdt:P31 wd:Q39715', 15, 200),             # lighthouses
    ('mega_dam', 'landmark', 'wdt:P31/wdt:P279* wd:Q12323', 15, 300),
    ('nuclear_plant', 'landmark', 'wdt:P31 wd:Q134447', 10, 250),
    ('control_tower', 'landmark', 'wdt:P31/wdt:P279* wd:Q1248784', 40, 300),  # airports
    ('observatory', 'landmark', 'wdt:P31/wdt:P279* wd:Q62832', 10, 250),
    ('space_center', 'landmark', 'wdt:P31/wdt:P279* wd:Q194188', 5, 100),
    ('ancient_ruins', 'landmark', 'wdt:P31/wdt:P279* wd:Q839954', 15, 600),
    ('history_event', 'history', 'wdt:P31/wdt:P279* wd:Q178561', 15, 1200),  # battles
    ('history_event', 'history', 'wdt:P31/wdt:P279* wd:Q7944', 10, 400),     # earthquakes
    ('history_event', 'history', 'wdt:P31/wdt:P279* wd:Q3839081', 10, 500),  # disasters
    ('history_event', 'history', 'wdt:P31/wdt:P279* wd:Q2627975', 15, 300),  # ceremonies (Olympics openings…)
]
QUOTA = [('legendary', 0.02), ('epic', 0.07), ('rare', 0.20), ('uncommon', 0.45), ('common', 1.0)]


def get_json(url, params=None, tries=4, accept='application/json'):
    full = url + ('?' + urlencode(params) if params else '')
    for i in range(tries):
        try:
            with urlopen(Request(full, headers={'User-Agent': UA, 'Accept': accept}), timeout=90) as r:
                return json.load(r)
        except Exception as e:
            if i == tries - 1:
                print(f'  failed: {e}', file=sys.stderr)
                return None
            time.sleep(5 * (i + 1))


def wikidata():
    out, seen = [], set()
    for slug, kind, sel, min_sl, limit in CATEGORIES:
        q = f"""SELECT ?item ?itemLabel ?coord ?article ?sl ?iso ?date WHERE {{
  ?item {sel} ; wdt:P625 ?coord ; wikibase:sitelinks ?sl . FILTER(?sl >= {min_sl})
  ?article schema:about ?item ; schema:isPartOf <https://en.wikipedia.org/> .
  OPTIONAL {{ ?item wdt:P17 ?c . ?c wdt:P297 ?iso . }}
  OPTIONAL {{ ?item wdt:P585|wdt:P580 ?date . }}
  SERVICE wikibase:label {{ bd:serviceParam wikibase:language "en". }}
}} ORDER BY DESC(?sl) LIMIT {limit}"""
        d = get_json('https://query.wikidata.org/sparql', {'query': q, 'format': 'json'}, accept='application/sparql-results+json')
        rows = (d or {}).get('results', {}).get('bindings', [])
        cat = []
        for b in rows:
            url = b['article']['value']
            if url in seen or 'Point(' not in b['coord']['value']:
                continue
            seen.add(url)
            lon, lat = b['coord']['value'].split('Point(')[1].rstrip(')').split()[:2]
            name = b['itemLabel']['value']
            if name.startswith('Q') and name[1:].isdigit():
                continue
            cat.append({'name': name[:60], 'wiki_url': url, 'kind': kind, 'game_category': slug, 'lat': round(float(lat), 5),
                        'lon': round(float(lon), 5), 'country_code': b.get('iso', {}).get('value', ''), 'sl': int(b['sl']['value']),
                        'event_date': b.get('date', {}).get('value', '')[:10] if kind == 'history' else '',
                        'qid': b['item']['value'].rsplit('/', 1)[-1]})
        for i, r in enumerate(cat):   # rank by fame inside the category
            pos = i / max(1, len(cat))
            r['rarity'] = next(name for name, cut in QUOTA if pos < cut)
        out += cat
        print(f'{slug:<16} {len(cat):>5} items ({len(rows)} returned)')
        time.sleep(2)
    f = SRC / 'candidates' / 'wikidata.csv'
    with open(f, 'w', newline='', encoding='utf-8') as fh:
        w = csv.writer(fh)
        w.writerow(['name', 'wiki_url', 'kind', 'game_category', 'lat', 'lon', 'country_code', 'rarity', 'event_date',
                    'title', 'description', 'fun_fact_1', 'curated_by', 'curated_at', 'notes'])
        for r in out:
            w.writerow([r['name'], r['wiki_url'], r['kind'], r['game_category'], r['lat'], r['lon'], r['country_code'] or '--',
                        r['rarity'], r['event_date'], '', '', '', 'wikidata', TODAY, f"{r['qid']} · {r['sl']} Wikipedia editions"])
    print(f'wikidata: {len(out)} candidates → {f}')


def _creatures():
    db = json.loads((ROOT / 'data' / 'hexod_db' / 'hexod_db.json').read_text(encoding='utf-8'))
    return db.get('creatures', [])


def _cache(path, key):
    if not path.exists():
        return {}
    with open(path, newline='', encoding='utf-8') as fh:
        return {r[key]: r for r in csv.DictReader(fh)}


def inat():
    f = SRC / 'creature_photos.csv'
    cache = _cache(f, 'uid')
    fields = ['uid', 'name', 'inat_taxon_id', 'photo_url', 'license', 'attribution', 'fetched_at']
    todo = [c for c in _creatures() if c['uid'] not in cache]
    print(f'iNaturalist: {len(todo)} creatures to look up ({len(cache)} cached)')
    for i, c in enumerate(todo, 1):
        name = (unquote(c.get('wiki_url', '').rsplit('/', 1)[-1]).replace('_', ' ') or c['name']).split('(')[0].strip()
        d = get_json('https://api.inaturalist.org/v1/taxa', {'q': name, 'per_page': 1, 'is_active': 'true'})
        row = {'uid': c['uid'], 'name': c['name'], 'fetched_at': TODAY}
        t = ((d or {}).get('results') or [None])[0]
        if t and t.get('name', '').lower() == name.lower() and (t.get('default_photo') or {}).get('license_code'):
            p = t['default_photo']
            row.update(inat_taxon_id=t['id'], photo_url=p.get('medium_url', ''), license=p['license_code'].upper(),
                       attribution=p.get('attribution', '')[:200])
        cache[c['uid']] = row
        if i % 100 == 0 or i == len(todo):
            with open(f, 'w', newline='', encoding='utf-8') as fh:
                w = csv.DictWriter(fh, fieldnames=fields); w.writeheader()
                for r in cache.values():
                    w.writerow({k: r.get(k, '') for k in fields})
            print(f'  {i}/{len(todo)} · with photo {sum(1 for r in cache.values() if r.get("photo_url"))}')
        time.sleep(1)


def pbdb():
    f = SRC / 'fossil_sites.csv'
    cache = _cache(f, 'uid')
    fields = ['uid', 'name', 'occurrences', 'sites', 'fetched_at']
    todo = [c for c in _creatures() if c.get('codex_category') == 'fossil' and c['uid'] not in cache]
    print(f'PBDB: {len(todo)} extinct creatures to look up ({len(cache)} cached)')
    for i, c in enumerate(todo, 1):
        genus = c['name'].split()[0].split('(')[0].strip()
        d = get_json('https://paleobiodb.org/data1.2/occs/list.json', {'base_name': genus, 'show': 'coords', 'limit': 500})
        occ = (d or {}).get('records') or []
        pts = sorted({(round(float(o['lat']), 1), round(float(o['lng']), 1)) for o in occ if o.get('lat') and o.get('lng')})
        cache[c['uid']] = {'uid': c['uid'], 'name': c['name'], 'occurrences': len(occ),
                           'sites': json.dumps(pts[:12]), 'fetched_at': TODAY}
        if i % 50 == 0 or i == len(todo):
            with open(f, 'w', newline='', encoding='utf-8') as fh:
                w = csv.DictWriter(fh, fieldnames=fields); w.writeheader()
                for r in cache.values():
                    w.writerow({k: r.get(k, '') for k in fields})
            print(f'  {i}/{len(todo)}')
        time.sleep(1)


if __name__ == '__main__':
    what = (sys.argv[1:] or ['all'])[0]
    if what in ('wikidata', 'all'):
        wikidata()
    if what in ('inat', 'all'):
        inat()
    if what in ('pbdb', 'all'):
        pbdb()
