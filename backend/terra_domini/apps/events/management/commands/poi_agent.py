"""
POI agent (owner 2026-10-19) — a Haiku agent walks the exhaustive POI list one row at a time:
checks the facts, gives the rarity, derives the HEX income, picks a picture it has actually LOOKED at, then stamps the
row (ledger + game DB) and moves to the next one. Run it where Wikipedia is reachable (the VPS).

  python manage.py poi_agent --limit 3              # test: the next 3 unchecked rows
  python manage.py poi_agent --limit 500            # a batch (resumable: stamped rows are skipped)
  python manage.py poi_agent --uid poi-100003       # one given row (re-checked even if already stamped)
  python manage.py poi_agent --kinds landmark,city  # only some kinds (default: landmark, history, city, country)
CLI mode, no API key — the same tools driven by a Claude Code subagent (.claude/agents/poi-validator.md):
  --next 3 · --row UID --lookup "Title" · --row UID --view URL · --row UID --submit result.json

Needs ANTHROPIC_API_KEY (.env.prod). Model: POI_AGENT_MODEL (default claude-haiku-5-5).

The agent's tools:
  web_search, web_fetch     Anthropic server tools: cross-check facts on the web
  wiki_lookup(title)        Wikipedia + Wikidata: coordinates, intro, language count (fame), heritage status,
                            free pictures with size, author and license
  view_image(url)           the picture itself, shown to the model — nothing is stamped on a picture it has not seen
  submit_validation(...)    the result; checked here (rarity value, picture seen + free license, position close to
                            Wikipedia's) and sent back to the agent to fix when it breaks a rule
Income is never chosen by the agent: it follows the rarity (economy.balance.token_hex_per_day).
Stamp = one line in poi_validations.jsonl (verdict, data, sources, confidence, model, date) + UnifiedPOI.validated_at.
Then `manage.py import_hexod_db` keeps the stamped data across rebuilds (rejected rows leave the map).
"""
import base64
import json
import math
import os
import re
import sys
import time
from pathlib import Path
from urllib.error import HTTPError
from urllib.request import Request, urlopen

from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone

from terra_domini.apps.economy.balance import token_hex_per_day
from terra_domini.apps.events import hexod_db, poi_validations

sys.path.insert(0, str(Path(__file__).resolve().parents[6] / 'scripts'))
import wiki_enrich as W  # noqa: E402  (stdlib Wikipedia helpers: pages, Wikidata, free pictures)

API_URL = 'https://api.anthropic.com/v1/messages'
MODEL = os.environ.get('POI_AGENT_MODEL', 'claude-haiku-5-5')
VERSION = 'poi-agent/1'
RARITIES = ('common', 'uncommon', 'rare', 'epic')   # Silver · Gold · Emerald · Diamond (4 rarities only)
DEFAULT_KINDS = ('landmark', 'history', 'city', 'country')


def categories() -> dict:
    """The game's token categories {value: label} (events.unified_poi.POICategory), species excluded."""
    from terra_domini.apps.events.unified_poi import POICategory
    return {v: l for v, l in POICategory.choices if not v.startswith('species_')}       # generated deposits and species copies have no single real place
MAX_TURNS = 14

SYSTEM = """You are the HEXOD POI agent. HEXOD is a geo-strategy collection game: every real place on Earth is a token on a
hexagon of the world map. You check ONE point of interest at a time and must be right: players trust these cards.

For the POI you are given:
1. Identify it with certainty. Call wiki_lookup with its Wikipedia title (or its name). If the name is ambiguous, wrong
   or the article is missing, use web_search / web_fetch to find the real place. If the place does not exist, is a
   duplicate of a more famous entry, or cannot be located, submit verdict "rejected" with the reason.
   The row's game_category and country_code say WHAT the token is: if the article / coordinates describe another kind
   of thing (category gas_reserve in QA but a granite dome in California), the row was mismatched: find the real place
   of that category and country and use its article. Never turn a token into another kind of thing.
   But a real, famous place whose only fault is a wrong category label (e.g. Woodstock filed as world_heritage) is
   KEPT (verdict corrected, note the label in corrections): reject only places that do not exist, cannot be located,
   or duplicate another entry.
   A famous range, region, archipelago or sea area is kept as itself (coordinates of its article), never swapped for a
   lesser sub-site (Drakensberg stays Drakensberg, Andaman Islands stay the Andaman Islands).
2. Check the facts: exact name (English, as on Wikipedia), coordinates (use Wikipedia's when they exist), ISO 3166-1
   alpha-2 country code. Fix what is wrong (verdict "corrected") or confirm (verdict "validated").
2b. Category: the token category must fit the place, rationally (owner 2026-10-20). The allowed values are checked on submit.
   A stadium is sports_arena, a festival site or a battle is history_event, a museum is museum, a lake or inland sea (salt or fresh) is lake, a mountain range / highlands is mountain_range (a single summit stays mountain_peak), a theatre or opera house is theatre, a ski resort or ski station is ski_resort (not sports_arena), a national capital is capital_city, any other living city or town is trade_node, an airport is
   control_tower (airports)... If the row's game_category is wrong, put the right one in game_category and say why in
   corrections; if it is right, repeat it. game_category is required in every result.
3. Write the card description: 2 short factual sentences, English, max 280 characters, no hype, no emoji, nothing you
   could not verify. Absolute rule: never "--", never an em dash or en dash; commas and full stops only.
4. Give the rarity: only 4 (owner 2026-10-20), shares fixed at import: Silver 50 % · Gold 30 % · Emerald 15 % · Diamond 5 %.
   Submit the key: "epic" = Diamond, "rare" = Emerald, "uncommon" = Gold, "common" = Silver. Your tier ranks the token
   inside its kind; the import then cuts each kind by the shares, so rank honestly (langs = sitelinks):
   - epic (Diamond): universal icons known on every continent, world #1 of their kind (Eiffel Tower, Machu Picchu,
     Great Wall, Everest, Paris, the largest gas field on Earth); landmarks usually langs >= 100.
   - rare (Emerald): world-famous or national icons, UNESCO stars, world top 10 resource sites (langs 50-99).
   - uncommon (Gold): well known in the country and to travellers, top resource site of a country (langs 20-49).
   - common (Silver): regional / local (langs < 20).
   Resource / strategic sites (mine, oil / gas field, port, canal, dam, airport...) rank by world rank, not languages.
   Fame is measured on the article players know the place by: for the headquarters / site of a famous organisation
   (CIA, NASA...), the organisation's article. A control tower token is its airport. When in doubt, the lower tier.
   rarity_reason says which numbers decided (langs, UNESCO, world rank). The HEX income follows automatically.
5. Picture: choose from the free pictures wiki_lookup returned (Wikimedia only). Call view_image on your
   choice and LOOK: it must clearly show THIS place (the building / site / city itself, beautiful, sharp, daylight if
   possible) — no map, flag, logo, plan, diagram, crowd close-up or unrelated detail. If it fails, view the next one.
   If none is right, submit image_url "" — a wrong picture is worse than none.
6. Call submit_validation once with everything. If it answers with errors, fix them and submit again.
Be efficient: usually wiki_lookup + 1-2 view_image + submit is enough; search the web only to settle a doubt."""

TOOLS = [
    {'type': 'web_search_20250305', 'name': 'web_search', 'max_uses': 4},
    {'type': 'web_fetch_20250910', 'name': 'web_fetch', 'max_uses': 3},
    {'name': 'wiki_lookup', 'description': 'English Wikipedia + Wikidata facts for one article: canonical title, coordinates, '
     'intro, number of language editions (sitelinks), heritage designations, and the free pictures (url, size, license, author).',
     'input_schema': {'type': 'object', 'properties': {'title': {'type': 'string', 'description': 'Article title or name'}},
                      'required': ['title']}},
    {'name': 'view_image', 'description': 'Download a picture (Wikimedia, from wiki_lookup) and show it to you.',
     'input_schema': {'type': 'object', 'properties': {'url': {'type': 'string'}}, 'required': ['url']}},
    {'name': 'submit_validation', 'description': 'Final result for this POI.',
     'input_schema': {'type': 'object', 'properties': {
         'verdict': {'type': 'string', 'enum': ['validated', 'corrected', 'rejected']},
         'name': {'type': 'string'}, 'lat': {'type': 'number'}, 'lon': {'type': 'number'},
         'country_code': {'type': 'string', 'description': 'ISO 3166-1 alpha-2'},
         'wiki_title': {'type': 'string'},
         'description': {'type': 'string', 'description': '2 factual sentences, <= 280 chars'},
         'rarity': {'type': 'string', 'enum': list(RARITIES)},
         'game_category': {'type': 'string', 'description': 'The token category that fits the place (one of the game categories)'},
         'rarity_reason': {'type': 'string'},
         'image_url': {'type': 'string', 'description': 'A picture you viewed, or ""'},
         'corrections': {'type': 'array', 'items': {'type': 'string'}, 'description': 'What was wrong in the input row'},
         'sources': {'type': 'array', 'items': {'type': 'string'}},
         'confidence': {'type': 'number', 'description': '0-1: how sure you are of the whole card'},
         'reject_reason': {'type': 'string'}},
         'required': ['verdict', 'name', 'rarity', 'rarity_reason', 'confidence']}},
]
TOOLS[-1]['cache_control'] = {'type': 'ephemeral'}   # tools + system prompt cached across rows


def km(a, b):
    r = math.pi / 180
    h = math.sin((b[0] - a[0]) * r / 2) ** 2 + math.cos(a[0] * r) * math.cos(b[0] * r) * math.sin((b[1] - a[1]) * r / 2) ** 2
    return 12742 * math.asin(math.sqrt(h))


# ── duplicate clean-up of the queue (owner 2026-10-25): a row that repeats another place never reaches a worker ──
DUP_WORDS = re.compile(r'\b(national parks?|mount|mt|islands?|the|of|reserve|world heritage site|site)\b')
TOWN = ('city', 'country')


def _ascii(s):
    import unicodedata
    return unicodedata.normalize('NFKD', s or '').encode('ascii', 'ignore').decode().lower()


def _key(s):
    return re.sub(r'[^a-z0-9]', '', _ascii(s))


def _core(s):
    """name without parentheses and generic words, words sorted (Lake Skadar = Skadar Lake)"""
    s = DUP_WORDS.sub(' ', re.sub(r'\(.*?\)', '', _ascii(s)))
    return ''.join(sorted(re.sub(r'[^a-z0-9 ]', ' ', s).split()))


def _article(r):
    from urllib.parse import unquote
    if r.get('wiki_title'):
        return _key(r['wiki_title'])
    u = r.get('wiki_url') or ''
    return _key(unquote(u.split('/wiki/')[-1]).replace('_', ' ')) if '/wiki/' in u else ''


def duplicates(db, done, kinds=DEFAULT_KINDS):
    """[(drop_row, keep_row, why)]: unchecked rows that repeat a stamped or better row of the same place.
    Same place = same Wikipedia article within 100 km, same name within 50 km, or same core name within 25 km
    (cities and countries only match cities and countries). Kept: stamped, then on the map, then poi- rows."""
    import collections
    rows = []
    for p in db['pois']:
        v = done.get(p['uid'])
        if p['kind'] not in kinds or p.get('lat') is None or (v and v.get('verdict') == 'rejected'):
            continue
        r = dict(p, stamped=bool(v))
        for f in ('name', 'lat', 'lon', 'wiki_title'):
            if v and v.get(f) not in (None, ''):
                r[f] = v[f]
        rows.append(r)
    rank = lambda r: (r['stamped'], bool(r.get('on_map')), r['uid'].startswith('poi-'), bool(r.get('wiki_url')), -len(r['uid']))
    out = {}

    def pair(a, b, why, dist):
        if km((a['lat'], a['lon']), (b['lat'], b['lon'])) >= dist:
            return
        keep, drop = (a, b) if rank(a) >= rank(b) else (b, a)
        if drop['stamped'] or drop['uid'] in out or drop['kind'] == 'country':
            return   # country cards live off the map, never a duplicate of a place
        if drop['kind'] in TOWN and keep['kind'] not in TOWN and not keep['stamped']:
            return   # a city row is never dropped for an unchecked site that only shares its article
        out[drop['uid']] = (drop, keep, why)

    for key, why, dist, same_kind in ((_article, 'same Wikipedia article', 100, False), (lambda r: _key(r['name']), 'same name', 50, False),
                                      (lambda r: _core(r['name']), 'same name', 25, True)):
        groups = collections.defaultdict(list)
        for r in rows:
            k = key(r)
            if len(k) >= 4:
                groups[k].append(r)
        for g in groups.values():
            for i in range(len(g)):
                for j in range(i + 1, len(g)):
                    if not same_kind or (g[i]['kind'] in TOWN) == (g[j]['kind'] in TOWN):
                        pair(g[i], g[j], why, dist)
    # the same edition of an event filed twice ("Qatar 2022 World Cup" / "2022 World Cup final"): same year, two shared
    # words, < 60 km; the precise one (final, opening: a venue) is kept
    year = collections.defaultdict(list)
    for r in rows:
        m = re.search(r'\b(1[5-9]\d\d|20\d\d)\b', r['name'])
        if m and r['kind'] == 'history':
            year[m.group(1)].append(r)
    words = lambda r: set(re.findall(r'[a-z]+', _ascii(r['name']))) - {'the', 'of', 'in', 'and'}
    venue = lambda r: bool(re.search(r'\b(final|opening)\b', r['name'].lower()))
    for g in year.values():
        for i in range(len(g)):
            for j in range(i + 1, len(g)):
                a, b = g[i], g[j]
                if len(words(a) & words(b)) >= 2 and km((a['lat'], a['lon']), (b['lat'], b['lon'])) < 60:
                    keep, drop = (a, b) if (a['stamped'], venue(a)) >= (b['stamped'], venue(b)) else (b, a)
                    if not drop['stamped'] and drop['uid'] not in out:
                        out[drop['uid']] = (drop, keep, 'same event edition')
    return list(out.values())


def call_api(messages):
    body = json.dumps({'model': MODEL, 'max_tokens': 2048, 'tools': TOOLS, 'messages': messages,
                       'system': [{'type': 'text', 'text': SYSTEM, 'cache_control': {'type': 'ephemeral'}}]}).encode()
    for i in range(5):
        req = Request(API_URL, data=body, headers={
            'x-api-key': os.environ['ANTHROPIC_API_KEY'], 'anthropic-version': '2023-06-01',
            'anthropic-beta': 'web-fetch-2025-09-10', 'content-type': 'application/json'})
        try:
            with urlopen(req, timeout=180) as r:
                return json.load(r)
        except HTTPError as e:
            msg = e.read().decode(errors='replace')[:400]
            if e.code in (429, 500, 502, 503, 529) and i < 4:
                time.sleep(10 * (i + 1)); continue
            if e.code == 400 and 'web_fetch' in msg and any(t['name'] == 'web_fetch' for t in TOOLS):
                TOOLS[:] = [t for t in TOOLS if t['name'] != 'web_fetch']   # model without web fetch: web search only
                print('  web_fetch not available for this model: continuing with web_search', file=sys.stderr)
                return call_api(messages)
            raise CommandError(f'Anthropic API {e.code}: {msg}')
    raise CommandError('Anthropic API unreachable')


class Agent:
    """One POI: the tool loop, the facts it was shown (to check its submission against them)."""

    def __init__(self, row):
        self.row = row
        self.pictures = {}     # url → {license, artist, file, w, h}
        self.seen = set()      # urls shown to the model
        self.wiki = {}         # canonical title → facts
        self.usage = {'input': 0, 'output': 0, 'cache_read': 0, 'searches': 0, 'fetches': 0}

    # ── CLI mode (Claude Code subagent drives the tools, no API key): the facts shown persist between calls ──
    @staticmethod
    def state_dir():
        d = poi_validations.LEDGER.parent / 'poi_agent_state'
        d.mkdir(parents=True, exist_ok=True)
        return d

    @classmethod
    def restore(cls, row):
        a = cls(row)
        f = cls.state_dir() / f"{row['uid']}.json"
        if f.exists():
            s = json.loads(f.read_text())
            a.pictures, a.seen, a.wiki = s['pictures'], set(s['seen']), s['wiki']
        return a

    def persist(self):
        (self.state_dir() / f"{self.row['uid']}.json").write_text(json.dumps(
            {'pictures': self.pictures, 'seen': sorted(self.seen), 'wiki': self.wiki}, ensure_ascii=False))

    # ── client tools ──
    def wiki_lookup(self, title):
        t = W.title_of(title) or title.strip()
        page = W.fetch_pages([t]).get(t) or {}
        if not page.get('exists'):
            return {'found': False, 'title': t, 'hint': 'Not on English Wikipedia under this title: try another title or web_search.'}
        qid = page.get('wikidata', '')
        sitelinks, heritage, p18, wd_ok = 0, [], '', False
        # fame = number of Wikipedia languages (langlinks + English), from Wikipedia itself (Wikidata throttles shared IPs)
        try:
            ll = W.api({'action': 'query', 'titles': page['page_title'], 'prop': 'langlinks', 'lllimit': 'max'})
            sitelinks = 1 + len(((ll.get('query') or {}).get('pages') or [{}])[0].get('langlinks') or [])
        except Exception:
            sitelinks = None
        if qid:
            try:
                d = W.api({'action': 'wbgetentities', 'ids': qid, 'props': 'claims'}, tries=1, host=W.WD_API)
            except Exception:      # Wikidata throttled: no P18 / heritage, the article's pictures still come
                d = {}
            e = (d.get('entities') or {}).get(qid, {})
            wd_ok = bool(e)
            if e:
                cl = e.get('claims') or {}
                heritage = [((c.get('mainsnak') or {}).get('datavalue') or {}).get('value', {}).get('id') for c in cl.get('P1435', [])]
                v = ((((cl.get('P18') or [{}])[0]).get('mainsnak') or {}).get('datavalue') or {}).get('value')
                p18 = (v or '').replace('_', ' ')
        lead = (page.get('image_file') or '').replace('_', ' ')    # pageimages gives underscores, imageinfo titles have spaces
        files = [f for f in [p18, lead] if f]
        files += [f for f in W.article_images([page['page_title']]).get(page['page_title'], []) if f not in files]
        info = W.fetch_images(files[:40]) if files else {}
        pics = []
        for f in files:
            im = info.get(f)
            if not im or not (W.good_photo(f, im) or f in (p18, lead)):
                continue
            pics.append({'url': im[0].split('?')[0], 'file': f, 'width': im[4], 'height': im[5], 'license': im[1], 'author': im[2],
                         'role': 'wikidata main image' if f == p18 else 'article lead image' if f == lead else 'article photo'})
            self.pictures[pics[-1]['url']] = pics[-1]
            if len(pics) >= 8:
                break
        self.wiki[page['page_title']] = page
        return {'found': True, 'title': page['page_title'], 'url': 'https://en.wikipedia.org/wiki/' + page['page_title'].replace(' ', '_'),
                'lat': page.get('lat'), 'lon': page.get('lon'), 'intro': page.get('extract', ''), 'wikidata': qid,
                'sitelinks': sitelinks, 'sitelinks_note': 'number of Wikipedia languages' if sitelinks else 'unknown: judge fame from the intro / web',
                'heritage_designations': [h for h in heritage if h],
                'unesco_world_heritage': ('Q9259' in heritage) if wd_ok else 'unknown (Wikidata unreachable): check on the web if it matters', 'pictures': pics}

    def download(self, url):
        """(bytes, mime) of a picture, or (None, error)."""
        if not url.startswith(W.WM_HOSTS):
            return None, 'Only Wikimedia pictures (from wiki_lookup) can be used.'
        req = Request(url, headers={'User-Agent': W.UA})
        with urlopen(req, timeout=60) as r:
            mime = (r.headers.get('Content-Type') or 'image/jpeg').split(';')[0]
            data = r.read(6_000_000)
        if mime not in ('image/jpeg', 'image/png', 'image/webp', 'image/gif'):
            return None, f'Not a picture ({mime}).'
        self.seen.add(url)
        return data, mime

    def view_image(self, url):
        data, mime = self.download(url)
        if data is None:
            return None, mime
        meta = self.pictures.get(url, {})
        return [{'type': 'image', 'source': {'type': 'base64', 'media_type': mime, 'data': base64.b64encode(data).decode()}},
                {'type': 'text', 'text': f"{meta.get('file', url)} · {meta.get('width', '?')}x{meta.get('height', '?')} · "
                                         f"{meta.get('license', 'license unknown')}. Does it clearly show {self.row['name']}?"}], None

    def check(self, s):
        """Rules the submission must follow; [] when it can be stamped."""
        errs = []
        if s.get('verdict') == 'rejected':
            return [] if s.get('reject_reason') else ['reject_reason is required for a rejected row.']
        same = next((u for u, v in poi_validations.load().items() if u != self.row['uid'] and v.get('verdict') != 'rejected'
                     and (v.get('name') or '').strip().lower() == (s.get('name') or '').strip().lower()), None)
        if same:
            errs.append(f'{s.get("name")} is already token {same}: never duplicate a place. Keep this row\'s own subject (an event '
                        'stays an event at its site, e.g. a disaster = history_event), or reject it as a duplicate.')
        cats = categories()
        if s.get('game_category') not in cats:
            errs.append('game_category must be one of the game categories (POI --categories), the one that fits the place: '
                        + ', '.join(sorted(cats)))
        if s.get('rarity') not in RARITIES:
            errs.append(f'rarity must be one of {RARITIES}.')
        cc = s.get('country_code') or ''
        if cc and not re.fullmatch(r'[A-Za-z]{2}', cc):
            errs.append('country_code: 2 letters (ISO 3166-1 alpha-2), or "" for open sea.')
        for k in ('lat', 'lon', 'description'):
            if s.get(k) in (None, ''):
                errs.append(f'{k} is required.')
        if len(s.get('description') or '') > 300:
            errs.append('description: 280 characters max.')
        if any(d in (s.get('description') or '') for d in ('--', '—', '–')):
            errs.append('description: never a double dash, em dash or en dash (absolute rule): use commas or full stops.')
        img = s.get('image_url') or ''
        if img and img not in self.pictures:
            errs.append('image_url must be one of the pictures wiki_lookup returned.')
        elif img and img not in self.seen:
            errs.append('call view_image on image_url before choosing it.')
        page = self.wiki.get(s.get('wiki_title') or '') or next(iter(self.wiki.values()), None)
        if page and page.get('lat') not in (None, '') and s.get('lat') is not None:
            d = km((float(page['lat']), float(page['lon'])), (s['lat'], s.get('lon') or 0))
            if d > 25:
                errs.append(f'coordinates are {d:.0f} km from Wikipedia\'s ({page["lat"]}, {page["lon"]}): use them or explain in corrections.')
        return errs

    # ── loop ──
    def run(self):
        r = self.row
        facts = {k: r.get(k) for k in ('uid', 'kind', 'name', 'game_category', 'lat', 'lon', 'country_code', 'wiki_url', 'title',
                                       'description', 'rarity', 'visitors_per_year', 'fun_fact_1', 'rare_fact') if r.get(k) not in (None, '')}
        messages = [{'role': 'user', 'content': 'Check this POI from the HEXOD database (current values, may be wrong):\n'
                                                + json.dumps(facts, ensure_ascii=False, indent=1)}]
        nudged = rejected_tries = 0
        for _ in range(MAX_TURNS):
            resp = call_api(messages)
            u = resp.get('usage') or {}
            self.usage['input'] += u.get('input_tokens', 0) + u.get('cache_creation_input_tokens', 0)
            self.usage['cache_read'] += u.get('cache_read_input_tokens', 0)
            self.usage['output'] += u.get('output_tokens', 0)
            stu = u.get('server_tool_use') or {}
            self.usage['searches'] += stu.get('web_search_requests', 0)
            self.usage['fetches'] += stu.get('web_fetch_requests', 0)
            content = resp.get('content') or []
            messages.append({'role': 'assistant', 'content': content})
            stop = resp.get('stop_reason')
            if stop == 'pause_turn':
                continue
            calls = [b for b in content if b.get('type') == 'tool_use']
            if not calls:
                if nudged:
                    return None, 'no submission'
                nudged = 1
                messages.append({'role': 'user', 'content': 'Call submit_validation now.'})
                continue
            results = []
            for b in calls:
                name, inp = b['name'], b.get('input') or {}
                try:
                    if name == 'submit_validation':
                        errs = self.check(inp)
                        if not errs:
                            return inp, None
                        rejected_tries += 1
                        if rejected_tries > 3:
                            return None, 'submission still breaks the rules: ' + '; '.join(errs)
                        results.append({'type': 'tool_result', 'tool_use_id': b['id'], 'is_error': True,
                                        'content': 'Fix and submit again: ' + ' '.join(errs)})
                    elif name == 'wiki_lookup':
                        results.append({'type': 'tool_result', 'tool_use_id': b['id'],
                                        'content': json.dumps(self.wiki_lookup(inp.get('title', '')), ensure_ascii=False)})
                    elif name == 'view_image':
                        blocks, err = self.view_image(inp.get('url', ''))
                        results.append({'type': 'tool_result', 'tool_use_id': b['id'], 'is_error': bool(err), 'content': err or blocks})
                    else:
                        results.append({'type': 'tool_result', 'tool_use_id': b['id'], 'is_error': True, 'content': f'unknown tool {name}'})
                except Exception as e:   # network / API hiccup on our side: tell the agent, it can retry or move on
                    results.append({'type': 'tool_result', 'tool_use_id': b['id'], 'is_error': True, 'content': f'{type(e).__name__}: {e}'[:300]})
            messages.append({'role': 'user', 'content': results})
        return None, 'too many turns'


def stamp(row, s, agent, model=MODEL):
    """Ledger line + game DB update. Returns the ledger entry."""
    import h3
    from terra_domini.apps.events.unified_poi import UnifiedPOI
    from terra_domini.apps.territories.models import Territory
    now = timezone.now()
    entry = {'uid': row['uid'], 'verdict': s['verdict'], 'validated_at': now.isoformat(), 'validator': VERSION, 'model': model,
             'confidence': s.get('confidence'), 'sources': s.get('sources') or [], 'corrections': s.get('corrections') or [],
             'usage': agent.usage, 'previous': {k: row.get(k) for k in ('name', 'lat', 'lon', 'rarity', 'country_code')}}
    if s['verdict'] == 'rejected':
        entry['reject_reason'] = s.get('reject_reason', '')
        UnifiedPOI.objects.filter(db_uid=row['uid']).update(is_active=False, validated_at=now)
    else:
        pic = agent.pictures.get(s.get('image_url') or '', {})
        lat, lon = round(float(s['lat']), 6), round(float(s['lon']), 6)
        hexes = h3.latlng_to_cell(lat, lon, 8)
        hpd = round(token_hex_per_day(s['rarity'], row.get('game_category', '')))
        entry.update(name=s['name'][:300], lat=lat, lon=lon, h3_r8=hexes, country_code=(s.get('country_code') or '').upper()[:2],
                     description=s.get('description', '')[:300], rarity=s['rarity'], rarity_reason=s.get('rarity_reason', ''),
                     hex_per_day=hpd, wiki_title=s.get('wiki_title', ''), game_category=s.get('game_category') or row.get('game_category'), image_url=s.get('image_url') or '',
                     image_credit=f"{pic.get('author') or 'Unknown author'} · {pic.get('license', '')} · Wikimedia Commons" if pic else '',
                     image_file=pic.get('file', ''))
        UnifiedPOI.objects.filter(db_uid=row['uid']).update(
            name=entry['name'], latitude=lat, longitude=lon, h3_index=hexes, country_code=entry['country_code'],
            description=entry['description'], rarity=s['rarity'], tdc_per_24h=hpd, category=entry['game_category'][:30],
            image_url=entry['image_url'], image_credit=entry['image_credit'][:300], verified=True, validated_at=now)
        Territory.objects.filter(h3_index=row.get('h3_r8'), poi_name=row['name'][:200]).update(rarity=s['rarity'])
    poi_validations.append(entry)
    return entry


class Command(BaseCommand):
    help = 'Haiku POI agent: check, rate, price and picture every POI, one row at a time, with a validation stamp'

    def add_arguments(self, parser):
        parser.add_argument('--limit', type=int, default=3)
        parser.add_argument('--uid', action='append', default=[])
        parser.add_argument('--kinds', default=','.join(DEFAULT_KINDS))
        # CLI mode — the same tools for a Claude Code subagent (.claude/agents/poi-validator.md), no API key:
        parser.add_argument('--next', type=int, help='print the next N unchecked rows (JSON)')
        parser.add_argument('--claim', help='worker name: --next reserves its rows for 3 h so parallel agents never share one')
        parser.add_argument('--row', help='uid of the row the tool call is about')
        parser.add_argument('--lookup', help='wiki_lookup(title) for --row (JSON)')
        parser.add_argument('--view', help='download a picture for --row, print the local file to look at')
        parser.add_argument('--submit', help='JSON file with the submit_validation fields for --row')
        parser.add_argument('--model', default='claude-code:haiku', help='model name written in the stamp (CLI mode)')
        parser.add_argument('--categories', action='store_true', help='list the game token categories')
        parser.add_argument('--set-category', help='category audit: re-stamp --row with this category (keeps the rest)')
        parser.add_argument('--reason', default='', help='why the category changes (with --set-category)')
        parser.add_argument('--dedupe', action='store_true', help='list unchecked rows that duplicate another place (--apply rejects them)')
        parser.add_argument('--apply', action='store_true', help='with --dedupe: stamp the duplicates rejected in the ledger')
        parser.add_argument('--stamped', action='store_true', help='with --next: list stamped rows (uid, name, category, description)')

    def cli(self, db, o):
        done = poi_validations.load()
        if o['categories']:
            for v, l in sorted(categories().items()):
                self.stdout.write(f'{v}: {l}')
            return
        if o['dedupe']:
            dups = duplicates(db, done, set(o['kinds'].split(',')))
            now = timezone.now().isoformat()
            for drop, keep, why in dups:
                self.stdout.write(f"{drop['uid']} {drop['name']!r} -> {keep['uid']} {keep['name']!r} ({why})")
                if o['apply']:
                    poi_validations.append({'uid': drop['uid'], 'verdict': 'rejected', 'validated_at': now, 'validator': 'dedupe/1',
                                            'reject_reason': f"duplicate of {keep['uid']} ({keep['name']}): {why}",
                                            'previous': {k: drop.get(k) for k in ('name', 'lat', 'lon', 'rarity', 'country_code')}})
            self.stdout.write(f"{len(dups)} duplicates{' rejected in the ledger' if o['apply'] else ' (dry run: add --apply)'}")
            return
        if o['stamped']:
            rows = [v for v in done.values() if v.get('verdict') != 'rejected'][:o['next'] or 10000]
            self.stdout.write(json.dumps([{'uid': v['uid'], 'name': v.get('name'), 'category': v.get('game_category') or next(
                (p.get('game_category') for p in db['pois'] if p['uid'] == v['uid']), ''), 'description': v.get('description', '')}
                for v in rows], ensure_ascii=False, indent=0))
            return
        if o['set_category']:
            if o['set_category'] not in categories():
                raise CommandError('unknown category: ' + o['set_category'])
            v = dict(done.get(o['row']) or {})
            if not v:
                raise CommandError('row not stamped yet')
            old = v.get('game_category') or next((p.get('game_category') for p in db['pois'] if p['uid'] == o['row']), '')
            v.update(game_category=o['set_category'], validated_at=timezone.now().isoformat(),
                     corrections=(v.get('corrections') or []) + [f"category {old} -> {o['set_category']}: {o['reason']}"])
            poi_validations.append(v)
            from terra_domini.apps.events.unified_poi import UnifiedPOI
            UnifiedPOI.objects.filter(db_uid=o['row']).update(category=o['set_category'][:30])
            self.stdout.write(f"CATEGORY {o['row']}: {old} -> {o['set_category']}")
            return
        if o['next']:
            kinds = set(o['kinds'].split(','))
            rows = sorted((p for p in db['pois'] if p['kind'] in kinds and p['uid'] not in done), key=lambda p: not p.get('on_map'))
            if o['claim']:
                import fcntl
                cf = Agent.state_dir() / 'claims.json'
                with open(Agent.state_dir() / 'claims.lock', 'w') as lk:
                    fcntl.flock(lk, fcntl.LOCK_EX)
                    claims = json.loads(cf.read_text()) if cf.exists() else {}
                    now = time.time()
                    claims = {u: c for u, c in claims.items() if now - c['at'] < 3 * 3600 and u not in done}
                    rows = [p for p in rows if p['uid'] not in claims or claims[p['uid']]['by'] == o['claim']][:o['next']]
                    for p in rows:
                        claims[p['uid']] = {'by': o['claim'], 'at': now}
                    cf.write_text(json.dumps(claims))
            keys = ('uid', 'kind', 'name', 'game_category', 'lat', 'lon', 'country_code', 'wiki_url', 'title', 'description',
                    'rarity', 'visitors_per_year', 'fun_fact_1', 'rare_fact')
            self.stdout.write(json.dumps([{k: p.get(k) for k in keys if p.get(k) not in (None, '')} for p in rows[:o['next']]],
                                         ensure_ascii=False, indent=1))
            return
        row = next((p for p in db['pois'] if p['uid'] == o['row']), None)
        if not row:
            raise CommandError('--row <uid> required (from --next)')
        agent = Agent.restore(row)
        try:
            self._cli_call(agent, row, o)
        except CommandError:
            raise
        except Exception as e:   # network: a clean message the agent can act on (retry later / another tool)
            raise CommandError(f'{type(e).__name__}: {e} — retry in a minute or use web search')
        finally:
            agent.persist()

    def _cli_call(self, agent, row, o):
        if o['lookup']:
            self.stdout.write(json.dumps(agent.wiki_lookup(o['lookup']), ensure_ascii=False, indent=1))
        elif o['view']:
            data, mime = agent.download(o['view'])
            if data is None:
                raise CommandError(mime)
            f = agent.state_dir() / f"{row['uid']}_{len(agent.seen)}.{mime.split('/')[1]}"
            f.write_bytes(data)
            meta = agent.pictures.get(o['view'], {})
            self.stdout.write(f"Look at this file now (Read tool): {f}\n{meta.get('file', '')} · {meta.get('width', '?')}x{meta.get('height', '?')} · "
                              f"{meta.get('license', 'license unknown')}. Does it clearly show {row['name']}?")
        elif o['submit']:
            s = json.loads(Path(o['submit']).read_text())
            errs = agent.check(s)
            if errs:
                raise CommandError('NOT STAMPED — fix and submit again: ' + ' '.join(errs))
            e = stamp(row, s, agent, model=o['model'])
            self.stdout.write(self.style.SUCCESS(f"STAMPED {e['verdict'].upper()} · {e.get('name', row['name'])} · "
                                                 f"{e.get('rarity', '-')} → {e.get('hex_per_day', 0)} HEX/day"))

    def handle(self, *args, **o):
        if o['next'] or o['row'] or o['categories'] or o['stamped'] or o['dedupe']:
            db = hexod_db.load()
            if not db:
                raise CommandError(f'{hexod_db.DB_PATH} not found')
            return self.cli(db, o)
        if not os.environ.get('ANTHROPIC_API_KEY'):
            raise CommandError('ANTHROPIC_API_KEY missing: add it to /home/hexod/terra-domini/.env.prod')
        db = hexod_db.load()
        if not db:
            raise CommandError(f'{hexod_db.DB_PATH} not found')
        done = poi_validations.load()
        if o['uid']:
            queue = [p for p in db['pois'] if p['uid'] in o['uid']]
        else:
            kinds = set(o['kinds'].split(','))
            rows = [p for p in db['pois'] if p['kind'] in kinds and p['uid'] not in done]
            queue = sorted(rows, key=lambda p: not p.get('on_map'))[:o['limit']]   # on-map rows first, master DB order
        self.stdout.write(f'{len(queue)} row(s) to check · {len(done)} already stamped · model {MODEL} · ledger {poi_validations.LEDGER}')
        tot = {'input': 0, 'output': 0, 'cache_read': 0, 'searches': 0, 'fetches': 0}
        for i, row in enumerate(queue, 1):
            t0 = time.time()
            self.stdout.write(f"\n[{i}/{len(queue)}] {row['uid']} · {row['name']} ({row['kind']}, {row.get('rarity')})")
            agent = Agent(row)
            try:
                sub, err = agent.run()
            except CommandError as e:
                self.stderr.write(f'  API error: {e}'); break
            for k in tot:
                tot[k] += agent.usage[k]
            if err:
                self.stdout.write(self.style.WARNING(f'  not stamped: {err}'))
                continue
            e = stamp(row, sub, agent)
            if e['verdict'] == 'rejected':
                self.stdout.write(self.style.WARNING(f"  REJECTED: {e['reject_reason']}"))
            else:
                self.stdout.write(self.style.SUCCESS(f"  {e['verdict'].upper()} · {e['name']} · {e['rarity']} → {e['hex_per_day']} HEX/day · conf {e['confidence']}"))
                self.stdout.write(f"  {e['lat']}, {e['lon']} {e['country_code']} · {e['description']}")
                self.stdout.write(f"  rarity: {e['rarity_reason']}")
                self.stdout.write(f"  picture: {e['image_url'] or 'none'}{' · ' + e['image_credit'] if e['image_credit'] else ''}")
                for c in e['corrections']:
                    self.stdout.write(f'  fixed: {c}')
            self.stdout.write(f"  {time.time() - t0:.0f}s · tokens in {agent.usage['input']} (+{agent.usage['cache_read']} cached) / out "
                              f"{agent.usage['output']} · {agent.usage['searches']} searches, {agent.usage['fetches']} fetches")
        self.stdout.write(f"\nTotal: tokens in {tot['input']} (+{tot['cache_read']} cached) / out {tot['output']} · "
                          f"{tot['searches']} searches · {tot['fetches']} fetches. Then: manage.py import_hexod_db to rebuild the map from the stamps.")
