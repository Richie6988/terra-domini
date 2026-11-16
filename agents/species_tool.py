"""Species validation tool (animals, plants, insects, fungi, fossils, micro-organisms).
Usage (from the repo root: python agents/species_tool.py ...):
  --next N --claim W        reserve and print the next N unchecked species (JSON)
  --commons UID FILE        add a named Commons file (File:Name.jpg) as a viewable picture, then --view it
  --lookup UID TITLE        Wikipedia facts + pictures for that species (English title)
  --view UID URL            download one picture from the lookup, print the local file to look at
  --submit UID FILE.json    stamp the species in the creature ledger
"""
import json, re, sys, time, datetime
from pathlib import Path
from urllib.request import Request, urlopen

REPO = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO / 'scripts'))
import wiki_enrich as W  # noqa: E402

DB = REPO / 'data/hexod_db/hexod_db.json'
LEDGER = REPO / 'data/hexod_db/creature_validations.jsonl'
STATE = REPO / 'agents' / 'state'
STATE.mkdir(parents=True, exist_ok=True)
CLAIMS = STATE / 'claims.json'
RARITIES = ('common', 'uncommon', 'rare', 'epic')
CATS = ('animal', 'insect', 'vegetal', 'mushroom', 'fossil', 'microOrganism')
VERDICTS = ('validated', 'corrected', 'rejected')


def creatures():
    import sys; sys.path.insert(0, str(REPO / 'backend/terra_domini/apps/events')); import tokens_format
    return {c['uid']: c for c in tokens_format.views(json.load(open(DB)))[1]}   # one token base (2026-11-16)


def done():
    out = set()
    if LEDGER.exists():
        for l in open(LEDGER, encoding='utf-8'):
            try:
                out.add(json.loads(l)['uid'])
            except Exception:
                pass
    return out


def cmd_next(n, worker, cat=None):
    cl = json.loads(CLAIMS.read_text()) if CLAIMS.exists() else {}
    now = time.time()
    cl = {u: v for u, v in cl.items() if now - v['t'] < 3 * 3600}
    dn, cr = done(), creatures()
    order = {'legendary': 0, 'epic': 0, 'rare': 1, 'uncommon': 2, 'common': 3}
    import collections
    seen = collections.Counter((c.get('description') or '')[:120] for c in cr.values())
    copied = lambda c: seen[(c.get('description') or '')[:120]] > 1   # generator filler: real species first
    rows = sorted((c for u, c in cr.items() if u not in dn and (not cat or c.get('codex_category') == cat) and (u not in cl or cl[u]['w'] == worker)),
                  key=lambda c: (copied(c), order.get(c.get('rarity'), 4), c['uid']))[:n]
    for c in rows:
        cl[c['uid']] = {'w': worker, 't': now}
    CLAIMS.write_text(json.dumps(cl))
    print(json.dumps([{k: c.get(k) for k in ('uid', 'name', 'codex_category', 'rarity', 'description', 'wiki_url', 'image', 'habitat', 'places')}
                      for c in rows], ensure_ascii=False, indent=1))


def cmd_lookup(uid, title):
    t = W.title_of(title) or title.strip()
    page = W.fetch_pages([t]).get(t) or {}
    if not page.get('exists'):
        print(json.dumps({'found': False, 'title': t}))
        return
    try:
        ll = W.api({'action': 'query', 'titles': page['page_title'], 'prop': 'langlinks', 'lllimit': 'max'})
        langs = 1 + len(((ll.get('query') or {}).get('pages') or [{}])[0].get('langlinks') or [])
    except Exception:
        langs = None
    lead = (page.get('image_file') or '').replace('_', ' ')
    files = [lead] if lead else []
    files += [f for f in W.article_images([page['page_title']]).get(page['page_title'], []) if f not in files]
    info = W.fetch_images(files[:30]) if files else {}
    pics = []
    for f in files:
        im = info.get(f)
        if not im or not (W.good_photo(f, im) or f == lead):
            continue
        pics.append({'url': im[0].split('?')[0], 'file': f, 'license': im[1], 'author': im[2], 'width': im[4], 'height': im[5],
                     'role': 'article lead image' if f == lead else 'article photo'})
        if len(pics) >= 8:
            break
    st = {'title': page['page_title'], 'pictures': {p['url']: p for p in pics}, 'seen': [], 'languages': langs}
    (STATE / f'{uid}.json').write_text(json.dumps(st, ensure_ascii=False))
    print(json.dumps({'found': True, 'title': page['page_title'], 'url': 'https://en.wikipedia.org/wiki/' + page['page_title'].replace(' ', '_'),
                      'intro': page.get('extract', ''), 'languages': langs, 'pictures': pics}, ensure_ascii=False, indent=1))


def cmd_range(uid, sci):
    """Real GBIF occurrence points (human observations / specimens with coordinates), spread over the range."""
    from urllib.parse import quote
    def get(u):
        with urlopen(Request(u, headers={'User-Agent': W.UA}), timeout=60) as r:
            return json.loads(r.read())
    m = get('https://api.gbif.org/v1/species/match?name=' + quote(sci))
    key = m.get('usageKey')
    if not key or m.get('matchType') == 'HIGHERRANK':
        g = get('https://api.gbif.org/v1/species/search?datasetKey=d7dddbf4-2cf0-4f39-9b2a-bb099caae36c&status=ACCEPTED&q=' + quote(sci))
        hit = next((r for r in g.get('results', []) if (r.get('canonicalName') or '').lower() == sci.strip().lower()), None)
        if hit:
            m, key = {'scientificName': hit.get('scientificName'), 'matchType': 'BACKBONE_SEARCH ' + (hit.get('kingdom') or '')}, hit['key']
    if not key:
        sys.exit(f'GBIF has no match for "{sci}". Give the scientific name.')
    pts, seen = [], set()
    for off in (0, 300, 900):
        d = get(f'https://api.gbif.org/v1/occurrence/search?taxonKey={key}&hasCoordinate=true&hasGeospatialIssue=false'
                f'&occurrenceStatus=PRESENT&limit=300&offset={off}')
        for o in d.get('results', []):
            la, lo = o.get('decimalLatitude'), o.get('decimalLongitude')
            if la is None or lo is None or o.get('basisOfRecord') == 'FOSSIL_SPECIMEN' and not sci:
                continue
            cell = (round(la), round(lo))           # 1-degree cells: keep the spread, drop clusters
            if cell in seen:
                continue
            seen.add(cell)
            pts.append({'lat': round(la, 4), 'lon': round(lo, 4), 'country': o.get('countryCode'), 'locality': (o.get('locality') or '')[:60],
                        'basis': o.get('basisOfRecord'), 'establishment': o.get('establishmentMeans')})
        if len(pts) >= 40 or d.get('endOfRecords'):
            break
    print(json.dumps({'gbif_name': m.get('scientificName'), 'match': m.get('matchType'), 'points': pts[:40],
                      'note': 'Pick 1 to 12 of these real occurrence points for places, spread over the native range; '
                              'skip zoo, captive or introduced records (establishment INTRODUCED/MANAGED) and points that are clearly outliers.'},
                     ensure_ascii=False, indent=1))


def cmd_next_regbif(n, worker):
    """Stamped species whose spawn places do not come from GBIF yet: claim them for a re-check (restamp)."""
    last = {}
    for l in open(LEDGER, encoding='utf-8'):
        try:
            r = json.loads(l); last[r['uid']] = r
        except Exception:
            pass
    cl = json.loads(CLAIMS.read_text()) if CLAIMS.exists() else {}
    now = time.time()
    cl = {u: v for u, v in cl.items() if now - v['t'] < 3 * 3600}
    rows = [r for u, r in sorted(last.items()) if r.get('verdict') != 'rejected' and 'GBIF' not in (r.get('places_reason') or '')
            and (u not in cl or cl[u]['w'] == worker)][:n]
    for r in rows:
        cl[r['uid']] = {'w': worker, 't': now}
    CLAIMS.write_text(json.dumps(cl))
    print(json.dumps(rows, ensure_ascii=False, indent=1))


def _state(uid):
    f = STATE / f'{uid}.json'
    return json.loads(f.read_text()) if f.exists() else None


def _short_author(a):
    """Commons author fields are sometimes a whole sentence (Mushroom Observer, 'This illustration was made by'): keep the name."""
    a = (a or '').strip()
    m = re.search(r'created by user ([^()]+?)\s*(?:\(|at Mushroom Observer)', a) or re.search(r'made by \(?User:([^)\s]+)', a) or re.search(r'^Photo by ([^.]+)\.', a)
    if m:
        return m.group(1).strip() + (' via Mushroom Observer' if 'Mushroom Observer' in a else '')
    return a if len(a) <= 80 else a[:77].rsplit(' ', 1)[0]


def cmd_commons(uid, fname):
    """Add one named Wikimedia Commons file (File:Name.jpg) to the pictures this uid may view, with its real author and license."""
    st = _state(uid)
    if not st:
        sys.exit('Run --lookup for this uid first.')
    f = fname.strip()
    f = f[5:] if f.lower().startswith('file:') else f
    f = f.replace('_', ' ')
    im = (W.fetch_images([f]) or {}).get(f)
    if not im:
        sys.exit(f'Commons has no file "{f}".')
    p = {'url': im[0].split('?')[0], 'file': f, 'license': im[1], 'author': im[2], 'width': im[4], 'height': im[5], 'role': 'commons file'}
    st['pictures'][p['url']] = p
    (STATE / f'{uid}.json').write_text(json.dumps(st, ensure_ascii=False))
    print(json.dumps(p, ensure_ascii=False, indent=1))


def cmd_view(uid, url):
    st = _state(uid)
    if not st or url not in st['pictures']:
        sys.exit('Only a picture listed by --lookup for this uid can be viewed.')
    last = None
    for u in (url, re.sub(r'^https://upload\.wikimedia\.org/wikipedia/commons/(.)/(..)/(.+)$',
                          r'https://upload.wikimedia.org/wikipedia/commons/thumb/\1/\2/\3/1280px-\3', url)):
        for i in range(3):
            try:
                with urlopen(Request(u, headers={'User-Agent': W.UA}), timeout=60) as r:
                    data = r.read(8_000_000)
                ext = '.png' if u.lower().endswith('.png') else '.jpg'
                out = STATE / f'{uid}_view{ext}'
                out.write_bytes(data)
                st['seen'].append(url)
                (STATE / f'{uid}.json').write_text(json.dumps(st, ensure_ascii=False))
                print(f'Look at this file with the Read tool: {out}')
                return
            except Exception as e:
                last = e
                time.sleep(10 * (i + 1))
    sys.exit(f'Could not download ({last}). Stamp with image_url empty.')


def cmd_submit(uid, path):
    s = json.loads(Path(path).read_text())
    cr = creatures()
    c = cr.get(uid)
    errs = []
    if not c:
        errs.append('unknown uid')
    if uid in done() and not s.get('restamp'):
        errs.append('already stamped: skip it')
    if s.get('verdict') not in VERDICTS:
        errs.append('verdict must be validated, corrected or rejected')
    if s.get('verdict') != 'rejected':
        if s.get('rarity') not in RARITIES:
            errs.append(f'rarity must be one of {RARITIES}')
        if s.get('codex_category') not in CATS:
            errs.append(f'codex_category must be one of {CATS}')
        if not (s.get('description') or '').strip():
            errs.append('description required')
        st = _state(uid) or {'pictures': {}, 'seen': []}
        if s.get('image_url') and s['image_url'] not in st['seen']:
            errs.append('image_url must be a picture you viewed with --view for this uid (or empty)')
        if not str(s.get('wiki_url', '')).startswith('https://en.wikipedia.org/wiki/'):
            errs.append('wiki_url must be the English Wikipedia article')
    _rk = {'common': 0, 'uncommon': 1, 'rare': 2, 'epic': 3, 'legendary': 3, 'mythic': 3}
    prev = None
    if LEDGER.exists():
        for l in open(LEDGER, encoding='utf-8'):
            if f'"{uid}"' in l:
                try:
                    prev = json.loads(l)
                except Exception:
                    pass
    old_r = (prev or {}).get('rarity')
    if not old_r:   # first stamp: the generator rarity is filler, the floor is the language band of the looked-up article
        n = (_state(uid) or {}).get('languages')
        old_r = (None if n is None else 'epic' if n >= 80 else 'rare' if n >= 40 else 'uncommon' if n >= 15 else 'common') \
            or (c or {}).get('rarity')
    if s.get('verdict') != 'rejected' and _rk.get(s.get('rarity'), 0) < _rk.get(old_r, 0) and not s.get('cultivated'):
        errs.append(f'rarity {s.get("rarity")} is below {old_r}: never lower a wild species (set "cultivated": true only for a crop or garden cultivar)')
    pl = s.get('places') or []
    if s.get('verdict') != 'rejected':
        if not isinstance(pl, list) or not (1 <= len(pl) <= 12) or not all(isinstance(x, list) and len(x) == 2 and -90 <= x[0] <= 90 and -180 <= x[1] <= 180 for x in pl):
            errs.append('places: 1 to 12 [lat, lon] points inside the real range of the species (fossil: real find sites)')
    for k in ('name', 'description'):
        if re.search('--|–|—', s.get(k) or ''):
            errs.append(f'{k}: no "--", en dash or em dash')
    if errs:
        sys.exit('NOT STAMPED: ' + '; '.join(errs))
    st = _state(uid) or {'pictures': {}}
    meta = st['pictures'].get(s.get('image_url'), {})
    row = {'uid': uid, 'verdict': s['verdict'], 'validated_at': datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'),
           'validator': 'species-agent/1', 'name': s.get('name') or c['name'], 'codex_category': s.get('codex_category') or c.get('codex_category'),
           'description': s.get('description', ''), 'wiki_url': s.get('wiki_url', ''), 'image_url': s.get('image_url', ''),
           'image_credit': (f"{_short_author(meta.get('author', ''))} · {meta.get('license', '')} · Wikimedia Commons" if s.get('image_url') else ''),
           'rarity': s.get('rarity', ''), 'rarity_reason': s.get('rarity_reason', ''), 'habitat': 'sea' if (s.get('habitat') or c.get('habitat', '')) in ('sea', 'marine') else 'land',
           'places': [[round(a, 4), round(b, 4)] for a, b in (s.get('places') or [])], 'places_reason': s.get('places_reason', ''),
           'sources': s.get('sources') or [s.get('wiki_url', '')], 'corrections': s.get('corrections') or []}
    with open(LEDGER, 'a', encoding='utf-8') as f:
        f.write(json.dumps(row, ensure_ascii=False) + '\n')
    print('STAMPED', row['verdict'], row['name'], row['rarity'])


if __name__ == '__main__':
    a = sys.argv[1:]
    if a[:1] == ['--next']:
        cmd_next(int(a[1]), a[a.index('--claim') + 1], a[a.index('--cat') + 1] if '--cat' in a else None)
    elif a[:1] == ['--lookup']:
        cmd_lookup(a[1], ' '.join(a[2:]))
    elif a[:1] == ['--next-regbif']:
        cmd_next_regbif(int(a[1]), a[a.index('--claim') + 1])
    elif a[:1] == ['--range']:
        cmd_range(a[1], ' '.join(a[2:]))
    elif a[:1] == ['--commons']:
        cmd_commons(a[1], ' '.join(a[2:]))
    elif a[:1] == ['--view']:
        cmd_view(a[1], a[2])
    elif a[:1] == ['--submit']:
        cmd_submit(a[1], a[2])
    else:
        print(__doc__)
