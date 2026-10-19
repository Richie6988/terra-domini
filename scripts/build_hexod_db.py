#!/usr/bin/env python3
"""
Build the single HEXOD game database from the owner's messy extracts.

    python scripts/build_hexod_db.py            # reads data/hexod_db/sources/*.xlsx
    → data/hexod_db/HEXOD_MASTER_DB.xlsx      (human-editable, one sheet per table)
    → data/hexod_db/hexod_db.json             (loaded by `manage.py import_hexod_db`)

Sources (copied in data/hexod_db/sources/):
  HEXOD_TOKENS_DB.xlsx   Token (664 curated POIs) · Category (codex) · Biome · Ressource · Colors   ← backbone
  webtoclean_in.xlsx     same POIs + rare_fact
  wiki_full_extract.xlsx BRUT (2786, 1119 located) — extra located POIs not in Token
  city_full_extract.xlsx · country_full_extract.xlsx · nature_full_extract.xlsx (creatures, no coords)
  ../../backend/terra_domini_pois.csv  legacy seed currently in the game (merged, deduplicated)

Rarity = combined score (visitors + geopolitics + rare fact, or fame proxy) ranked inside each
family, then cut by quotas: legendary 1% · epic 4% · rare 10% · uncommon 25% · common 60%.
Requires: openpyxl, h3>=4, wordninja (glued-words repair).
"""
import ast, csv, hashlib, json, math, os, re, sys, unicodedata
from urllib.parse import unquote
from collections import Counter, defaultdict
from pathlib import Path

import h3
import openpyxl
import wordninja

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'data' / 'hexod_db' / 'sources'
OUT = Path(os.environ.get('HEXOD_DB_OUT') or ROOT / 'data' / 'hexod_db')   # the VPS writes outside the repo (deploy/wiki_refresh.sh)
LEGACY_CSV = ROOT / 'backend' / 'terra_domini_pois.csv'
H3_RES = 8  # the game grid (claude.md: ALWAYS resolution 8)

QUOTAS = [('legendary', 0.01), ('epic', 0.04), ('rare', 0.10), ('uncommon', 0.25), ('common', 1.0)]

# ── Category normalisation ────────────────────────────────────────────────────
# raw POI category (any source) → game slug (UnifiedPOI.POICategory) + codex category (iconBank id)
POI_CAT = {
    'ancient ruins': ('ancient_ruins', 'history'), 'world heritage': ('world_heritage', 'monument'),
    'capital city': ('capital_city', 'capitalCity'), 'nature sanctuary': ('nature_sanctuary', 'forest'),
    'control tower': ('control_tower', 'tower'), 'mountain peak': ('mountain_peak', 'mountain'),
    'religious site': ('religious_site', 'cult'), 'anomaly': ('anomaly', 'mystery'),
    'financial hub': ('financial_hub', 'industry'), 'island': ('island', 'island'),
    'sports arena': ('sports_arena', 'sport'), 'waterfall': ('waterfall', 'waterfall'),
    'chokepoint': ('chokepoint', 'chokepoint'), 'royal palace': ('royal_palace', 'monument'),
    'military base': ('military_base', 'weapon'), 'cave system': ('cave_system', 'cave'),
    'volcano': ('volcano', 'volcano'), 'museum': ('museum', 'museum'), 'canyon': ('canyon', 'mountain'),
    'oil field': ('oil_field', 'mine'), 'conspiracy': ('conspiracy', 'conspiracy'),
    'mega dam': ('mega_dam', 'infrastructure'), 'freshwater': ('freshwater', 'ocean'),
    'secret facility': ('secret_facility', 'conspiracy'), 'mega port': ('mega_port', 'port'),
    'glacier': ('glacier', 'glacier'), 'coral reef': ('coral_reef', 'ocean'),
    'famous event': ('ancient_wonder', 'history'), 'space center': ('space_center', 'space'),
    'naval base': ('naval_base', 'weapon'), 'offshore haven': ('offshore_haven', 'piracy'),
    'ancient forest': ('ancient_forest', 'forest'), 'observatory': ('observatory', 'observatory'),
    'stock exchange': ('stock_exchange', 'industry'), 'research station': ('research_station', 'science'),
    'rare earth': ('rare_earth', 'mine'), 'gas reserve': ('gas_reserve', 'mine'),
    'gold mine': ('gold_mine', 'mine'), 'wildlife species': ('nature_sanctuary', 'animal'),
    'missile site': ('missile_site', 'weapon'), 'casino resort': ('casino_resort', 'entertainment'),
    'tech giant': ('tech_giant', 'tech'), 'agri megafarm': ('agri_megafarm', 'farm'),
    'artwork': ('museum', 'art'), 'rocket launcher': ('missile_site', 'weapon'),
    'intelligence hq': ('intelligence_hq', 'intelligence'), 'particle collider': ('particle_collider', 'science'),
    'internet cable': ('internet_cable', 'infrastructure'), 'uranium mine': ('uranium_mine', 'mine'),
    'nuclear plant': ('nuclear_plant', 'nuclear'), 'copper mine': ('copper_mine', 'mine'),
    'fertile land': ('fertile_land', 'farm'), 'diamond mine': ('diamond_mine', 'mine'),
    'lithium deposit': ('lithium_deposit', 'mine'), 'coal mine': ('coal_mine', 'mine'),
    'iron ore': ('iron_ore', 'mine'), 'data center': ('data_center', 'tech'),
    'ancient wonder': ('ancient_wonder', 'wonder'), 'trade node': ('trade_node', 'port'),
}
GAME_SLUGS = set(v[0] for v in POI_CAT.values())

CREATURE_RULES = [  # (codex category, keywords in the first paragraph) — first match wins
    ('fossil', r'dinosaur|pterosaur|ichthyosaur|plesiosaur|mosasaur|stegosaur|sauropod|theropod'),
    ('microOrganism', r'\bbacteri|\bvirus\b|archaea|protist|microorganism|plankton|amoeba'),
    ('mushroom', r'\bfung(?:us|i)\b|mushroom|lichen|mould|mold\b'),
    ('insect', r'\binsect|beetle|butterfl|\bmoth\b|dragonfl|damselfl|\bants?\b|\bbees?\b|wasp|cricket|katydid|grasshopper|cicada|mantis|termite|\bfly\b|flies\b|aphid|spider|scorpion'),
    ('vegetal', r'\bplant|\btree|shrub|flower|herbaceous|perennial|\bgenus of\b.*\b(?:plants|grasses|trees)|fern|moss|orchid|cactus|seaweed|alga|vine\b|palm\b'),
    ('animal', r'\bspecies of\b|\bgenus of\b|\bfamily\b|native to|predator|herbivor|carnivor|endemic|hippopotam|ungulate|marsupial|scientific name|mammal|\bbird|fish\b|reptile|amphibian|primate|rodent|\bbat\b|snake|lizard|turtle|frog|whale|dolphin|shark|seal\b|deer|antelope|cat\b|dog\b|monkey|ape\b|gibbon|elephant|rhino|bear\b|wolf|fox|eagle|owl|parrot|penguin|crab|octopus|squid|coral\b'),
]

BIO_WORDS = (r'species|genus|family|subspecies|population|organism|animal|mammal|bird|fish|reptile|insect|plant|'
             r'tree|flower|fung|primate|monkey|ape\b|rodent|squirrel|predator|habitat|native|endemic|wild|extinct|fossil|'
             r'feeds|prey|breed|herbivor|carnivor|cultivat|leaves|seeds|fruit')

# ── helpers ───────────────────────────────────────────────────────────────────
def sheet(path, name=None):
    wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
    ws = wb[name] if name else wb.worksheets[0]
    rows = list(ws.iter_rows(values_only=True))
    hdr = [str(h).strip() if h is not None else f'_c{i}' for i, h in enumerate(rows[0])]
    out = []
    for r in rows[1:]:
        d = {}
        for i, h in enumerate(hdr):
            if h not in d:            # duplicated headers (webtoclean has token_id twice): keep first
                d[h] = r[i] if i < len(r) else None
        out.append(d)
    return out


def clean(v):
    if v is None:
        return ''
    s = str(v).replace('\xa0', ' ').strip()
    # mojibake from the scrapers
    for a, b in (('â€”', '—'), ('â€“', '–'), ('â€™', "'"), ('â€œ', '"'), ('â€\x9d', '"'), ('Ã©', 'é'), ('Ã¨', 'è')):
        s = s.replace(a, b)
    return '' if s.lower() in ('none', 'nan', '[]', '0') else s


def fnum(v):
    try:
        f = float(str(v).strip())
        return f if math.isfinite(f) else None
    except Exception:
        return None


_RANK = None


def _common(word, top=30000):
    """Only accept a split whose pieces are all frequent English words (keeps glued Latin names intact)."""
    global _RANK
    if _RANK is None:
        lm = wordninja.DEFAULT_LANGUAGE_MODEL
        wc = getattr(lm, '_wordcost', {})
        _RANK = {w: i for i, w in enumerate(sorted(wc, key=wc.get))}
    w = word.lower()
    if len(w) == 1:
        return w in ('a', 'i')
    # long pieces are real (often scientific) words; short rare pieces mean a Latin name got shredded
    if len(w) <= 3:
        return _RANK.get(w, 10**9) < 3000          # function words only ("of", "the", "and")
    return len(w) >= 6 or _RANK.get(w, 10**9) < top


def _merge_rare(parts):
    """Glue back the shredded run ('dry','os','au','rid' → 'dryosaurid') and keep the good splits."""
    ok = [_common(x) for x in parts]
    for i, x in enumerate(parts):            # short neighbours of a rare piece belong to it
        if ok[i] and len(x) <= 4 and ((i and not _common(parts[i - 1])) or (i + 1 < len(parts) and not _common(parts[i + 1]))):
            ok[i] = False
    out, run = [], ''
    for x, good in zip(parts, ok):
        if good:
            if run:
                out.append(run); run = ''
            out.append(x)
        else:
            run += x
    if run:
        out.append(run)
    return out


_LATIN_END = re.compile(r'(ae|us|um|is|ii|ensis|ata|oides|idae|inae|ceae|ales)$')


def _split2(word):
    """Two-way split 'Taxaceaenative' / 'Europeanbush' / 'ofmole': right half a common word, left half
    a common word or a Latin-looking stem. Returns [word] when no safe split exists."""
    lw = word.lower()
    best = None
    for i in range(2, len(lw) - 2):
        left, right = lw[:i], lw[i:]
        if len(right) < 3 or _RANK.get(right, 10**9) >= 30000:
            continue
        ok_left = (_RANK.get(left, 10**9) < (3000 if len(left) <= 3 else 30000)) or (len(left) >= 6 and _LATIN_END.search(left))
        if ok_left and (best is None or min(len(left), len(right)) > min(map(len, best))):
            best = (word[:i], word[i:])
    return list(best) if best else [word]


def fix_glued(text, protect=()):
    """'Thebrown hawker(Aeshna grandis) is a species of large Palearcticdragonflybelonging' → readable."""
    text = re.sub(r'\[\s*(?:nb\s*)?\d+\s*\]', '', text)          # [1], [nb 1]
    text = re.sub(r'\s*/[^/\s]*[ˈˌəɒæʊɛɪʃʒθðŋɔː][^/]*/\s*', ' ', text)   # IPA "/mɒnˌtænoʊˈsɛrətɒps/"
    text = re.sub(r'(?<=[a-z])\(', ' (', text)
    text = re.sub(r'([,;])(?=[A-Za-z])', r'\1 ', text)
    text = re.sub(r'\.(?=[A-Z][a-z])', '. ', text)
    text = re.sub(r'^([A-Z][a-z]{3,}?)(is|was|are)\b', r'\1 \2', text)   # "Dunaliellais a…" → "Dunaliella is a…"
    text = re.sub(r'\)(?=[A-Za-z])', ') ', text)
    # "Sagittaria latifoliais a…" → "… latifolia is a" (binomial glued to the verb, first words only)
    text = re.sub(r'^([A-Z][a-z]+ [a-z]{4,}?)(is|was|are) (?=an? |the )', r'\1 \2 ', text)
    _common('a')                                               # loads the word ranks
    out, depth, prev_cap, lead_first = [], 0, False, False
    protect = {x.lower() for x in protect}
    for w in text.split(' '):
        core = re.sub(r'[^A-Za-z]', '', w)
        opened = depth > 0 or w.startswith('(')
        depth += w.count('(') - w.count(')')
        latin_like = bool(re.search(r'(us|is|um|ae|ii|ensis|ata|oides|idae|inae)$', core.lower()))
        # protect Latin binomials ("Choeropsis liberiensis") and the creature's own name
        latin = latin_like and (core[:1].isupper() or prev_cap)
        prev_cap = bool(core[:1].isupper()) and latin_like
        # the very first capitalised word is usually the (Latin) name itself: never shred it
        art = re.match(r'(The|An|A)([a-z]{3,})$', core)
        lead = not out and core[:1].isupper() and not (art and _RANK.get(art.group(2).lower(), 10**9) < 30000)
        # ...and the word right after it is the species epithet ("Neocurtilla hexadactyla")
        lead = lead or (len(out) == 1 and lead_first and core.islower())
        lead_first = lead if not out else lead_first
        known = _RANK.get(core.lower(), 10**9) < 60000 if _RANK else False   # "subspecies", "million"
        if len(core) >= 6 and not opened and not latin and not lead and not known and core.lower() not in protect:
            m = re.match(r'^([^A-Za-z]*)([A-Za-z]+)([^A-Za-z]*)$', w)
            parts = wordninja.split(m.group(2)) if m and len(core) >= 7 else [w]
            if m and len(parts) > 1 and not all(_common(x) for x in parts):
                parts = _merge_rare(parts)
            if m and len(parts) == 1:
                parts = _split2(m.group(2))
            if m and len(parts) > 1:
                if m.group(2)[0].isupper():
                    parts[0] = parts[0][:1].upper() + parts[0][1:]
                out.append(m.group(1) + ' '.join(parts) + m.group(3))
                continue
        out.append(w)
    s = ' '.join(out)
    s = re.sub(r'^(The|An|A)([a-z]{3,})\b', lambda m: f'{m[1]} {m[2]}' if _common(m[2]) else m[0], s)  # "Thebrown" → "The brown"
    return re.sub(r'\s{2,}', ' ', s).strip()


_POP_RX = [
    re.compile(r'population[^.]{0,60}?(?:of|was|is|at|about|approximately|around|over|nearly|estimated|stand)\D{0,25}?([\d][\d.,]*)\s*(million|billion)?', re.I),
    re.compile(r'([\d][\d.,]*)\s*(million)?\s*(?:inhabitants|residents|people)', re.I),
]


def parse_population(text):
    """First population figure of a city article ('… population of about 8.9 million …') → int, else 0."""
    for rx in _POP_RX:
        for m in rx.finditer(text or ''):
            num = m.group(1).rstrip('.,').replace(',', '')
            try:
                v = float(num)
            except ValueError:
                continue
            if m.group(2):
                v *= 1_000_000 if m.group(2).lower() == 'million' else 1_000_000_000
            if 1_000 <= v <= 60_000_000 and not (1800 <= v <= 2100 and not m.group(2)):   # skip years
                return int(v)
    return 0


def first_paragraph(raw):
    raw = clean(raw)
    if not raw:
        return ''
    try:
        paras = ast.literal_eval(raw) if raw.startswith('[') else [raw]
    except Exception:
        paras = [raw.strip('[]')]
    paras = [str(p).strip() for p in paras]
    for p in paras:                      # the defining sentence ("X is a ..."), not a subspecies list
        if len(p) > 40 and re.search(r'\b(is|are|was|were)\b', p[:300]):
            return p
    for p in paras:
        if len(p) > 40:
            return p
    return paras[0] if paras else ''


def first_sentences(text, n=2, limit=320):
    parts = re.split(r'(?<=[.!?])\s+(?=[A-Z])', text)
    s = ' '.join(parts[:n]).strip()
    return (s[:limit - 1] + '…') if len(s) > limit else s


def images(raw):
    raw = clean(raw)
    try:
        lst = ast.literal_eval(raw) if raw.startswith('[') else []
    except Exception:
        lst = []
    return [Path(str(p).replace('\\', '/')).name for p in lst]


def norm_name(s):
    return re.sub(r'[^a-z0-9]', '', (s or '').lower().replace('_', ' '))


_NAME_STOP = {'the', 'of', 'de', 'la', 'le', 'du', 'des', 'and', 'museum', 'musee', 'paris', 'london', 'city', 'national', 'park'}


def name_words(s):
    return {w for w in re.findall(r'[a-z0-9]+', unicodedata.normalize('NFKD', s or '').encode('ascii', 'ignore').decode().lower())
            if len(w) > 2 and w not in _NAME_STOP}


def km(lat1, lon1, lat2, lon2):
    p = math.pi / 180
    a = 0.5 - math.cos((lat2 - lat1) * p) / 2 + math.cos(lat1 * p) * math.cos(lat2 * p) * (1 - math.cos((lon2 - lon1) * p)) / 2
    return 12742 * math.asin(math.sqrt(max(0.0, a)))


HUB_CATEGORIES = {'trade_node', 'capital_city', 'financial_hub', 'stock_exchange', 'mega_port'}

# Strategic points are few and are the Risk objectives: their own, richer ladder
STRATEGIC_QUOTAS = [('legendary', 0.15), ('epic', 0.40), ('rare', 0.75), ('uncommon', 1.0), ('common', 1.0)]


def assign_rarity(items, key, quotas=None):
    """Rank by key (desc) and cut by QUOTAS. Stable: ties broken by uid hash."""
    ranked = sorted(items, key=lambda x: (-key(x), hashlib.md5(x['uid'].encode()).hexdigest()))
    n = len(ranked)
    i = 0
    for rarity, cum in (quotas or QUOTAS):
        stop = max(i, min(n, round(n * cum))) if rarity != 'common' else n
        for x in ranked[i:stop]:
            x['rarity'] = rarity
        i = stop


RANKS_ALL = ('common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic')


def wiki_title(url):
    """English Wikipedia URL → normalised article title (lowercase, spaces) — the dedup / enrichment key."""
    m = re.search(r'en\.(?:m\.)?wikipedia\.org/wiki/([^?#]+)', url or '')
    return unquote(m.group(1)).replace('_', ' ').strip().lower() if m else ''


def load_wiki_enrich():
    """sources/wiki_enrich.csv (scripts/wiki_enrich.py, run on the VPS) → {title: row}."""
    f = SRC / 'wiki_enrich.csv'
    if not f.exists():
        return {}
    with open(f, newline='', encoding='utf-8') as fh:
        return {r['title'].strip().lower(): r for r in csv.DictReader(fh)}


def h3cell(lat, lon):
    try:
        return h3.latlng_to_cell(lat, lon, H3_RES)
    except Exception:
        return ''


def city_index(pois):
    """Urban areas for terrain rules: cities (population from their article) + capitals / trade nodes of the POI list.
    radius_km = urban core: 3 + 5·√(population in millions), capitals ≥ 10 km, unknown population 6 km."""
    out = []
    for p in pois:
        if p.get('lat') is None or p.get('lon') is None:
            continue
        is_city = p['kind'] == 'city' or p.get('game_category') in ('capital_city', 'trade_node')
        if not is_city:
            continue
        pop = p.get('population') or 0
        capital = p.get('game_category') == 'capital_city'
        r = 3 + 5 * math.sqrt(pop / 1e6) if pop else 6
        if capital:
            r = max(r, 10)
        out.append({'name': p['name'], 'lat': round(p['lat'], 4), 'lon': round(p['lon'], 4), 'population': pop,
                    'capital': capital, 'radius_km': round(min(r, 30), 1)})
    mc = SRC / 'major_cities.csv'   # curated metro areas (the extracts miss Paris, New York, Rome…)
    if mc.exists():
        with open(mc, newline='', encoding='utf-8') as f:
            for r in csv.DictReader(f):
                pop = int(r['metro_population'] or 0)
                rad = 3 + 5 * math.sqrt(pop / 1e6)
                out.append({'name': r['name'], 'lat': float(r['lat']), 'lon': float(r['lon']), 'population': pop,
                            'capital': r['capital'] == '1', 'radius_km': round(min(rad, 30), 1)})
    out.sort(key=lambda c: -c['radius_km'])
    kept = []
    for c in out:   # same agglomeration listed twice → keep the biggest
        if any(abs(c['lat'] - k['lat']) < 0.05 and abs(c['lon'] - k['lon']) < 0.07 for k in kept):
            continue
        kept.append(c)
    return kept


# ── build ─────────────────────────────────────────────────────────────────────
def main():
    issues = []
    db = SRC / 'HEXOD_TOKENS_DB.xlsx'

    # Categories (codex) + colours
    cats = []
    colors = {norm_name(r['Category']): r for r in sheet(db, 'Colors') if r.get('Category')}
    color_alias = {'mystery': 'mistery', 'capitalcity': 'capitalcity', 'cult': 'religion', 'monument': 'worldheritage',
                   'wonder': 'worldheritage', 'celebs': 'entertainment', 'music': 'entertainment', 'food': 'farm',
                   'earthquake': 'event', 'tsunami': 'event', 'nuclear': 'nuclearplant', 'treasure': 'collector',
                   'gift': 'event', 'news': 'event', 'sponsored': 'partner', 'war': 'military', 'diplomacy': 'flag',
                   'fossil': 'dinosaur', 'industry': 'finance', 'infrastructure': 'dam', 'microorganism': 'organism',
                   'mine': 'mine', 'ocean': 'freshwater', 'desert': 'land', 'medicine': 'science',
                   'piracy': 'mistery', 'mythology': 'religion', 'intelligence': 'intelligence', 'weapon': 'weapon'}
    for r in sheet(db, 'Category'):
        if not r.get('CATEGORY'):
            continue
        cid = clean(r['CATEGORY'])
        c = colors.get(norm_name(cid)) or colors.get(color_alias.get(norm_name(cid), ''))
        accent = re.match(r'#[0-9A-Fa-f]{6}', clean(c['Fluorescent Accent'])) if c else None
        neutral = re.match(r'#[0-9A-Fa-f]{6}', clean(c['Light Neutral'])) if c else None
        cats.append({'id': cid, 'meta': clean(r['META']), 'label': re.sub(r'(?<!^)(?=[A-Z])', ' ', cid).title(),
                     'accent': accent.group(0) if accent else '', 'neutral': neutral.group(0) if neutral else '',
                     'color_rationale': clean(c['Rationale']) if c else ''})
    cat_ids = {c['id'] for c in cats}

    # Resources + biomes
    resources = []
    for r in sheet(db, 'Ressource'):
        if not r.get('Resource Name'):
            continue
        resources.append({'id': norm_name(r['Resource Name']), 'name': clean(r['Resource Name']),
                          'category': clean(r['Category']), 'strategic_use': clean(r['Strategic Use']),
                          'rarity': clean(r['Rarity']).lower()})
    res_by_norm = {r['id']: r for r in resources}
    res_alias = {'diamond': 'diamonds', 'rareearths': 'rareearthelements', 'rareearth': 'rareearthelements',
                 'water': 'freshwater', 'fish': 'aquaculture', 'fisheries': 'aquaculture', 'grain': 'cereals',
                 'cereal': 'cereals', 'phosphate': 'phosphates', 'aluminum': 'aluminium', 'bauxite': 'aluminium'}
    biomes, biome_res = [], []
    for r in sheet(db, 'Biome'):
        if not r.get('BIOME'):
            continue
        lats = [fnum(r[k]) for k in ('NW Lat', 'NE Lat', 'SE Lat', 'SW Lat')]
        lons = [fnum(r[k]) for k in ('NW Lon', 'NE Lon', 'SE Lon', 'SW Lon')]
        if None in lats or None in lons:
            issues.append(f"biome {r['BIOME']}: incomplete bounding box"); continue
        bid = int(fnum(r['ID']))
        names = [clean(x) for x in re.split(r'[,;/]', clean(r['Primary Resources'])) if clean(x)]
        ids = []
        for nm in names:
            k = norm_name(nm); k = res_alias.get(k, k)
            if k in res_by_norm:
                ids.append(k)
            else:
                issues.append(f"biome {r['BIOME']}: unknown resource '{nm}'")
        biomes.append({'id': bid, 'name': clean(r['BIOME']), 'continent': clean(r['CONTINENT']).title(),
                       'type': clean(r['TYPE']).lower(), 'lat_min': min(lats), 'lat_max': max(lats),
                       'lon_min': min(lons), 'lon_max': max(lons), 'resources': ', '.join(ids)})
        for k in ids:
            biome_res.append({'biome_id': bid, 'resource_id': k})

    # ── POIs: curated tokens (backbone) ──
    rare_facts = {clean(r.get('token_id')): clean(r.get('rare_fact')) for r in sheet(SRC / 'webtoclean_in.xlsx', 'PREMIUM_EXPORT')}
    # The same sentence on many tokens is a generated template, not a fact (RULE 1: no fake data) → blanked
    fact_n = Counter(rare_facts.values())
    rare_facts = {k: ('' if fact_n[v] >= 3 else v) for k, v in rare_facts.items()}
    pois, seen_names, seen_cells, merged = [], {}, {}, []

    def free_cell_near(cell):
        """Nearest hex (rings 1-3) not used by another token — distinct things never share a hex."""
        for k in (1, 2, 3):
            for c in sorted(h3.grid_ring(cell, k)):
                if c not in seen_cells:
                    return c
        return None

    def add_poi(p, displace=False):
        p['name'] = re.sub(r'\s+', ' ', unquote(p['name']).replace('_', ' ')).strip()
        p.setdefault('aliases', '')
        nk, cell = norm_name(p['name']), p['h3_r8']
        if nk in seen_names:
            other = seen_names[nk]
            if not other.get('lat') or (p['lat'] and abs(other['lat'] - p['lat']) < 0.5 and abs(other['lon'] - p['lon']) < 0.5):
                return None  # duplicate (same name, same place)
        seen_names.setdefault(nk, p)
        if not (cell and cell in seen_cells) and p.get('lat') is not None and p.get('kind') == 'landmark':
            # Same place under a slightly different name within 2 km ("Louvre Paris" / "Louvre Museum Paris")
            words = name_words(p['name'])
            for q in pois:
                if q.get('lat') is None or q.get('kind') != 'landmark':
                    continue
                if abs(q['lat'] - p['lat']) > 0.02 or abs(q['lon'] - p['lon']) > 0.03:
                    continue
                qw = name_words(q['name'])
                if words and qw and (words <= qw or qw <= words or len(words & qw) / len(words | qw) >= 0.5) and km(p['lat'], p['lon'], q['lat'], q['lon']) <= 2:
                    cell = q['h3_r8'] or cell   # merge into q below
                    seen_cells.setdefault(cell, q)
                    break
        if displace and cell and cell in seen_cells:
            q = seen_cells[cell]
            words, qw = name_words(p['name']), name_words(q['name'])
            same = words and qw and (words <= qw or qw <= words or len(words & qw) / len(words | qw) >= 0.5)
            if not same:   # a different verified article (an event at a landmark, two museums side by side) → next free hex
                c2 = free_cell_near(cell)
                if c2:
                    p['h3_r8'] = cell = c2
                    p['lat'], p['lon'] = (round(x, 5) for x in h3.cell_to_latlng(c2))
        if cell and cell in seen_cells:
            keep = seen_cells[cell]          # same hex = same place: enrich the kept record, drop the duplicate
            for k, v in p.items():
                if k not in ('uid', 'source', 'name', 'quality', 'kind', 'pending_wiki', 'rarity', 'curation') and v and not keep.get(k):
                    keep[k] = v
            keep['aliases'] = ', '.join(x for x in [keep.get('aliases', ''), p['name']] if x)
            merged.append({'kept': keep['name'], 'merged': p['name'], 'source': p['source'], 'h3_r8': cell})
            return None
        if cell:
            seen_cells[cell] = p
        pois.append(p)
        return p

    for r in sheet(db, 'Token'):
        name = clean(r['name'])
        if not name:
            continue
        raw_cat = clean(r['category']).lower()
        slug, codex = POI_CAT.get(raw_cat, (None, None))
        if not slug:
            issues.append(f"token {name}: unknown category '{raw_cat}' → anomaly"); slug, codex = 'anomaly', 'mystery'
        lat, lon = fnum(r['latitude']), fnum(r['longitude'])
        tid = clean(r['token_id'])
        add_poi({
            'uid': f'poi-{tid}', 'source': 'tokens_db', 'kind': 'landmark', 'quality': 'premium',
            'name': name, 'game_category': slug, 'codex_category': codex, 'lat': lat, 'lon': lon,
            'h3_r8': h3cell(lat, lon) if lat is not None and lon is not None else '',
            'country_code': clean(r['country_code']).upper()[:2], 'title': clean(r['Category']),
            'description': clean(r['Description']), 'fun_fact_1': clean(r['Fun Fact 1']),
            'fun_fact_2': clean(r['Fun Fact 2']), 'fun_fact_3': clean(r['Fun Fact 3']),
            'rare_fact': rare_facts.get(tid, ''),
            'visitors_per_year': int(fnum(r['visitors_per_year']) or 0),
            'visitors_score': fnum(r['visitors_score']) or 0, 'geopolitical_score': fnum(r['geopolitical_score']) or 0,
            'grade': clean(r.get('GRADE')), 'wiki_url': clean(r['link']), 'image': (images(r['images']) or [''])[0],
            'token_id': int(tid) if tid.isdigit() else None,
        })

    # ── legacy game seed (keep what the game already has) ──
    if LEGACY_CSV.exists():
        with open(LEGACY_CSV, newline='', encoding='utf-8') as f:
            for r in csv.DictReader(f):
                lat, lon = fnum(r['lat']), fnum(r['lon'])
                if lat is None or lon is None:
                    continue
                slug = r['category'] if r['category'] in GAME_SLUGS else POI_CAT.get(r['category'].replace('_', ' '), ('anomaly', ''))[0]
                codex = next((v[1] for k, v in POI_CAT.items() if v[0] == slug), 'mystery')
                add_poi({
                    'uid': f"legacy-{norm_name(r['name'])[:40]}", 'source': 'legacy_seed', 'kind': 'landmark', 'quality': 'standard',
                    'name': clean(r['name']), 'game_category': slug, 'codex_category': codex, 'lat': lat, 'lon': lon,
                    'h3_r8': h3cell(lat, lon), 'country_code': clean(r['country_code']).upper()[:2], 'title': '',
                    'description': clean(r['description']), 'fun_fact_1': clean(r['fun_fact']), 'fun_fact_2': '', 'fun_fact_3': '',
                    'rare_fact': '', 'visitors_per_year': int(fnum(r['visitors_per_year']) or 0),
                    'visitors_score': 0, 'geopolitical_score': fnum(r['geopolitical_score']) or 0, 'grade': '',
                    'wiki_url': clean(r['wiki_url']), 'image': '', 'token_id': int(fnum(r['token_id']) or 0) or None,
                })

    # ── extra located POIs from the raw wiki extract ──
    for r in sheet(SRC / 'wiki_full_extract.xlsx', 'BRUT'):
        lat, lon = fnum(r['latitude']), fnum(r['longitude'])
        if lat is None or lon is None:
            continue
        wname = clean(r['name_1']) or clean(r['name'])
        if len(wname) < 5 or (' ' not in wname and len(wname) < 8 and not clean(r['category'])):
            issues.append(f"wiki entry dropped: truncated name '{wname}' (re-extract the full title)")
            continue
        raw_cat = clean(r['category']).lower()
        slug, codex = POI_CAT.get(raw_cat, ('anomaly', 'mystery'))
        para = fix_glued(first_paragraph(r['paragraphs']))
        add_poi({
            'uid': f"wiki-{clean(r['token_id'])}", 'source': 'wiki_extract', 'kind': 'landmark', 'quality': 'standard',
            'name': clean(r['name_1']) or clean(r['name']), 'game_category': slug, 'codex_category': codex,
            'lat': lat, 'lon': lon, 'h3_r8': h3cell(lat, lon), 'country_code': '', 'title': '',
            'description': first_sentences(para), 'fun_fact_1': '', 'fun_fact_2': '', 'fun_fact_3': '', 'rare_fact': '',
            'visitors_per_year': 0, 'visitors_score': 0, 'geopolitical_score': 0, 'grade': '',
            'wiki_url': clean(r['link']), 'image': (images(r['images']) or [''])[0],
            'token_id': int(fnum(r['token_id']) or 0) or None,
        })

    # ── strategic points of the globe (curated, sources/strategic_points.csv) ──
    # Existing record (same name or same hex) → flagged strategic + geopolitical weight raised; else added.
    strat_csv = SRC / 'strategic_points.csv'
    if strat_csv.exists():
        with open(strat_csv, newline='', encoding='utf-8') as f:
            for r in csv.DictReader(f):
                lat, lon = fnum(r['lat']), fnum(r['lon'])
                cell = h3cell(lat, lon)
                slug = r['game_category']
                codex = next((v[1] for k, v in POI_CAT.items() if v[0] == slug), 'chokepoint')
                hit = seen_names.get(norm_name(r['name'])) or seen_cells.get(cell)
                if hit is not None and hit in pois:
                    hit['strategic'] = True
                    hit['geopolitical_score'] = max(hit.get('geopolitical_score') or 0, fnum(r['geopolitical_score']) or 0)
                    hit['description'] = hit.get('description') or r['description']
                    hit['wiki_url'] = hit.get('wiki_url') or r['wiki_url']
                    continue
                p = add_poi({
                    'uid': f"strat-{norm_name(r['name'])[:40]}", 'source': 'strategic', 'kind': 'landmark', 'quality': 'strategic',
                    'name': r['name'], 'game_category': slug, 'codex_category': codex, 'lat': lat, 'lon': lon, 'h3_r8': cell,
                    'country_code': r['country_code'], 'title': '', 'description': r['description'],
                    'fun_fact_1': '', 'fun_fact_2': '', 'fun_fact_3': '', 'rare_fact': '', 'visitors_per_year': 0,
                    'visitors_score': 0, 'geopolitical_score': fnum(r['geopolitical_score']) or 0, 'grade': '',
                    'wiki_url': r['wiki_url'], 'image': '', 'token_id': None,
                })
                if p:
                    p['strategic'] = True

    # ── cities & countries ──
    for fname, kind, prefix in (('city_full_extract.xlsx', 'city', 'city'), ('country_full_extract.xlsx', 'country', 'country')):
        for idx, r in enumerate(sheet(SRC / fname)):
            name = clean(r['category']) or clean(r['name']).replace('_', ' ')
            lat, lon = fnum(r['latitude']), fnum(r['longitude'])
            para = fix_glued(first_paragraph(r['paragraphs']))
            p = {
                'uid': f"{prefix}-{clean(r['card_number']).lower()}", 'source': fname.split('_')[0], 'kind': kind,
                'quality': 'standard', 'name': name,
                'game_category': 'trade_node' if kind == 'city' else 'international_org',
                'codex_category': kind, 'lat': lat, 'lon': lon,
                'h3_r8': h3cell(lat, lon) if (kind == 'city' and lat is not None and lon is not None) else '',  # countries: codex cards, not a hex
                'country_code': '', 'title': '', 'description': first_sentences(para),
                'fun_fact_1': '', 'fun_fact_2': '', 'fun_fact_3': '', 'rare_fact': '',
                'visitors_per_year': 0, 'visitors_score': 0, 'geopolitical_score': 0, 'grade': '',
                'wiki_url': clean(r['link']), 'image': (images(r['images']) or [''])[0], 'token_id': None,
                '_rank': idx,
            }
            if kind == 'city' and (lat is None or lon is None):
                issues.append(f"city {name}: no coordinates (codex only)")
            if kind == 'city':
                p['population'] = parse_population(clean(r['paragraphs']))
            add_poi(p)

    # ── curated tokens (agents + editors): sources/curated_tokens.csv ──
    # action=create adds a token; action=update overwrites the listed non-empty fields of an existing uid.
    # A non-empty 'rarity' is forced (applied after the quotas). Applied last, so curation always wins.
    CURATED_FIELDS = ['name', 'game_category', 'country_code', 'title', 'description', 'fun_fact_1', 'fun_fact_2',
                      'fun_fact_3', 'rare_fact', 'wiki_url', 'image_url', 'visitors_per_year', 'geopolitical_score']
    forced_rarity, curated_n = {}, 0
    cur_csv = SRC / 'curated_tokens.csv'
    if cur_csv.exists():
        by_uid = {p['uid']: p for p in pois}
        with open(cur_csv, newline='', encoding='utf-8') as f:
            for r in csv.DictReader(f):
                act, uid = (r.get('action') or '').strip(), (r.get('uid') or '').strip()
                lat, lon = fnum(r.get('lat')), fnum(r.get('lon'))
                if act == 'update' and uid in by_uid:
                    tgt = by_uid[uid]
                elif act == 'create' and r.get('name') and lat is not None and lon is not None:
                    slug = (r.get('game_category') or 'anomaly').strip()
                    tgt = add_poi({
                        'uid': uid or f"cur-{norm_name(r['name'])[:40]}", 'source': 'curated', 'kind': 'landmark', 'quality': 'curated',
                        'name': r['name'], 'game_category': slug, 'codex_category': next((v[1] for k, v in POI_CAT.items() if v[0] == slug), 'mystery'),
                        'lat': lat, 'lon': lon, 'h3_r8': h3cell(lat, lon), 'country_code': '', 'title': '', 'description': '',
                        'fun_fact_1': '', 'fun_fact_2': '', 'fun_fact_3': '', 'rare_fact': '', 'visitors_per_year': 0,
                        'visitors_score': 0, 'geopolitical_score': 0, 'grade': '', 'wiki_url': '', 'image': '', 'token_id': None,
                    })
                    if tgt is None:
                        issues.append(f"curated create {r['name']}: duplicate of an existing token (same name or hex) — use action=update")
                        continue
                    by_uid[tgt['uid']] = tgt
                else:
                    issues.append(f"curated row skipped: action={act} uid={uid} name={r.get('name')}")
                    continue
                for k in CURATED_FIELDS:
                    v = (r.get(k) or '').strip()
                    if v:
                        tgt[k] = int(float(v)) if k in ('visitors_per_year',) else (float(v) if k == 'geopolitical_score' else v)
                if act == 'update' and lat is not None and lon is not None:
                    tgt['lat'], tgt['lon'], tgt['h3_r8'] = lat, lon, h3cell(lat, lon)
                tgt['curation'] = {'by': (r.get('curated_by') or '').strip(), 'at': (r.get('curated_at') or '').strip(),
                                   'notes': (r.get('notes') or '').strip()}
                if (r.get('rarity') or '').strip() in ('common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic'):
                    forced_rarity[tgt['uid']] = r['rarity'].strip()
                curated_n += 1

    # ── candidates (agents + editors): sources/candidates/*.csv — live only once Wikipedia confirms the article ──
    wiki = load_wiki_enrich()
    known_titles = {wiki_title(p.get('wiki_url')) for p in pois} - {''}
    cand_n = Counter()
    for f in sorted((SRC / 'candidates').glob('*.csv')):
        with open(f, newline='', encoding='utf-8') as fh:
            for r in csv.DictReader(fh):
                name, url = (r.get('name') or '').strip(), (r.get('wiki_url') or '').strip()
                lat, lon, t = fnum(r.get('lat')), fnum(r.get('lon')), wiki_title(r.get('wiki_url'))
                if not name or not t or lat is None or lon is None:
                    cand_n['invalid'] += 1; continue
                if t in known_titles:
                    cand_n['duplicate'] += 1; continue
                w = wiki.get(t)
                if w and str(w.get('exists')) == '0':
                    cand_n['no_article'] += 1; issues.append(f"candidate {name} ({f.name}): no Wikipedia article '{t}' → dropped"); continue
                if w and w.get('lat') and w.get('lon'):   # Wikipedia's coordinates win
                    wl, wo = float(w['lat']), float(w['lon'])
                    if km(lat, lon, wl, wo) > 100:
                        issues.append(f"candidate {name}: agent position {km(lat, lon, wl, wo):.0f} km from Wikipedia's — Wikipedia kept")
                    lat, lon = wl, wo
                slug = (r.get('game_category') or 'anomaly').strip()
                kind = 'history' if (r.get('kind') or '').strip() == 'history' else 'landmark'
                tgt = add_poi({
                    'uid': f"cand-{hashlib.md5(t.encode()).hexdigest()[:10]}", 'source': f'candidate:{f.stem}', 'kind': kind,
                    'quality': 'candidate', 'name': name[:60], 'game_category': slug,
                    'codex_category': 'history' if slug == 'history_event' else next((v[1] for v in POI_CAT.values() if v[0] == slug), 'mystery'),
                    'lat': lat, 'lon': lon, 'h3_r8': h3cell(lat, lon), 'country_code': (r.get('country_code') or '').strip()[:3],
                    'title': (r.get('title') or '').strip(), 'description': (r.get('description') or '').strip(),
                    'fun_fact_1': (r.get('fun_fact_1') or '').strip(), 'fun_fact_2': '', 'fun_fact_3': '', 'rare_fact': '',
                    'visitors_per_year': 0, 'visitors_score': 0, 'geopolitical_score': 0, 'grade': '', 'wiki_url': url,
                    'image': '', 'token_id': None, 'event_date': (r.get('event_date') or '').strip()[:10],
                    'pending_wiki': not w, 'rarity': 'common',
                    'curation': {'by': (r.get('curated_by') or '').strip(), 'at': (r.get('curated_at') or '').strip(),
                                 'notes': (r.get('notes') or '').strip()},
                }, displace=True)
                if tgt is None:
                    cand_n['merged'] += 1; continue
                known_titles.add(t)
                if (r.get('rarity') or '').strip() in RANKS_ALL:
                    forced_rarity[tgt['uid']] = r['rarity'].strip()
                cand_n['pending' if not w else 'verified'] += 1
    if cand_n:
        print('candidates:', dict(cand_n))

    # ── Wikipedia enrichment on every token: picture + credit, intro when the text is missing ──
    for p in pois:
        w = wiki.get(wiki_title(p.get('wiki_url')))
        if not w or str(w.get('exists')) != '1':
            continue
        cur = str(p.get('image_url', ''))
        # the enriched picture wins over an older Wikimedia one; a hand-picked picture (other host) is kept
        if w.get('image_url') and (not cur.startswith('https://') or cur.startswith('https://upload.wikimedia.org/')):
            p['image_url'] = w['image_url']
            p['image_credit'] = ' · '.join(x for x in (w.get('image_artist', '')[:120], w.get('image_license', '')) if x) or 'Wikimedia Commons'
        if w.get('extract') and len(p.get('description') or '') < 40:
            p['description'] = w['extract']
        if w.get('wikidata'):
            p['wikidata'] = w['wikidata']

    # Curated rows whose notes start with 'DUPLICATE OF <uid>' are dropped (the kept token holds the curation)
    dup = {p['uid'] for p in pois if (p.get('curation') or {}).get('notes', '').upper().startswith('DUPLICATE OF')}
    for p in pois:
        if p['uid'] in dup:
            merged.append({'kept': p['curation']['notes'][:80], 'merged': p['name'], 'source': p['source'], 'h3_r8': p['h3_r8']})
    pois[:] = [p for p in pois if p['uid'] not in dup]

    # ── rarity (per family, combined score) ──
    fam = defaultdict(list)
    for p in pois:
        if p['source'].startswith('candidate'):
            continue   # candidates carry their author's rarity (quotas per file), see forced_rarity
        fam['strategic' if p.get('strategic') else p['kind']].append(p)
    def landmark_score(p):
        vs = p['visitors_score'] or (min(100, 12 * math.log10(p['visitors_per_year'] + 1)) if p['visitors_per_year'] else 0)
        if p.get('game_category') in HUB_CATEGORIES or re.search(r'airport|international hub', f"{p.get('title', '')} {p['name']}", re.I) \
                or re.search(r' International$', p['name']) or (p['visitors_per_year'] or 0) > 25_000_000:   # no single monument gets 25M+
            vs *= 0.55   # airports/cities/financial hubs count passengers or residents, not visitors of the landmark
        # landmarks: fame first (visitors), geopolitics second — strategic points have their own ladder
        return (0.7 * vs + 0.3 * (p['geopolitical_score'] or 0) + (4 if p['rare_fact'] else 0)
                + (2 if p['quality'] == 'premium' else 0))
    assign_rarity(fam['landmark'], landmark_score)
    assign_rarity(fam['strategic'], lambda p: (p['geopolitical_score'] or 0) + 0.1 * (p['visitors_score'] or 0), STRATEGIC_QUOTAS)
    # cities: global ranking by population (parsed from their article); no coordinates → stays common (codex only)
    assign_rarity([p for p in fam['city'] if p.get('lat') is not None], lambda p: p.get('population') or 0)
    for p in fam['city']:
        if p.get('lat') is None:
            p['rarity'] = 'common'
    assign_rarity(fam['country'], lambda p: -p.get('_rank', 0))   # source file ordered by importance
    RANKS = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic']
    # Megacities are at least rare wherever they sit (capital landmarks scored on placeholder visitor counts)
    metro = {}
    if (SRC / 'major_cities.csv').exists():
        with open(SRC / 'major_cities.csv', newline='', encoding='utf-8') as f:
            metro = {norm_name(r['name']): int(r['metro_population'] or 0) for r in csv.DictReader(f)}
    for p in pois:
        if p['kind'] == 'city' or p.get('game_category') in ('capital_city', 'financial_hub'):
            pop = max(p.get('population') or 0, metro.get(norm_name(p['name']), 0))
            cap = p.get('game_category') == 'capital_city'
            floor = 'epic' if pop >= 20_000_000 else 'rare' if pop >= (8_000_000 if cap else 10_000_000) else 'uncommon' if pop >= 4_000_000 else None
            if floor and RANKS.index(floor) > RANKS.index(p['rarity']):
                p['rarity'] = floor
    for p in pois:
        if p['uid'] in forced_rarity:
            p['rarity'] = forced_rarity[p['uid']]
    for p in pois:
        p['score'] = round(landmark_score(p), 1) if p['kind'] == 'landmark' and not p['source'].startswith('candidate') else None
        p['on_map'] = bool(p['h3_r8']) and not p.get('pending_wiki')   # candidates wait for the Wikipedia check
        p.pop('_rank', None)

    # ── creatures (Safari / Codex) ──
    creatures = []
    seen_cr = set()
    for r in sheet(SRC / 'nature_full_extract.xlsx'):
        name = clean(r['category']) or clean(r['name']).replace('_', ' ')
        if not name or norm_name(name) in seen_cr:
            continue
        seen_cr.add(norm_name(name))
        para = fix_glued(first_paragraph(r['paragraphs']), protect=re.split(r'[\s_-]+', name))
        low = para.lower()
        codex = next((c for c, rx in CREATURE_RULES if re.search(rx, low)), '')
        review = ''
        if not para:
            review = 'no text'
        elif not re.search(BIO_WORDS, low):
            review = 'text does not describe an organism (scraped wrong article?)'
        creatures.append({'uid': f"cr-{clean(r['card_number']).lower()}", 'name': name, 'codex_category': codex,
                          'description': first_sentences(para), 'wiki_url': clean(r['link']),
                          'image': (images(r['images']) or [''])[0], 'needs_review': review, 'fame': len(para)})
    # The nature extract is ordered in blocks (mammals, plants, dinosaurs, insects…): an unclassified
    # entry takes the majority category of its 30 neighbours.
    for i, c in enumerate(creatures):
        if not c['codex_category']:
            near = Counter(x['codex_category'] for x in creatures[max(0, i - 15):i + 16] if x['codex_category'])
            c['codex_category'] = near.most_common(1)[0][0] if near else 'animal'
    # Open databases (scripts/fetch_external.py, run on the VPS): iNaturalist photo when Wikipedia has none, fossil sites
    photos, fossils = {}, {}
    for fname, store in (('creature_photos.csv', photos), ('fossil_sites.csv', fossils)):
        if (SRC / fname).exists():
            with open(SRC / fname, newline='', encoding='utf-8') as fh:
                store.update({r['uid']: r for r in csv.DictReader(fh)})
    for c in creatures:
        ph, fo = photos.get(c['uid']), fossils.get(c['uid'])
        if ph and ph.get('photo_url'):
            c['image_url'] = ph['photo_url']
            c['image_credit'] = f"{ph.get('attribution', '')} · iNaturalist".strip(' ·')
        if fo and int(fo.get('occurrences') or 0):
            c['fossil_count'] = int(fo['occurrences'])
            c['fossil_sites'] = json.loads(fo.get('sites') or '[]')
    for c in creatures:   # Wikipedia picture for the Safari / Codex card (beats iNaturalist)
        w = wiki.get(wiki_title(c.get('wiki_url')))
        if w and str(w.get('exists')) == '1' and w.get('image_url'):
            c['image_url'] = w['image_url']
            c['image_credit'] = ' · '.join(x for x in (w.get('image_artist', '')[:120], w.get('image_license', '')) if x)
    assign_rarity(creatures, lambda c: c['fame'])
    for c in creatures:
        c.pop('fame')

    # ── unlocated wiki names (backlog to geocode) ──
    backlog = []
    located = {norm_name(p['name']) for p in pois}
    for r in sheet(SRC / 'wiki_full_extract.xlsx', 'BRUT'):
        nm = clean(r['name_1']) or clean(r['category'])
        if fnum(r['latitude']) is None and nm and norm_name(nm) not in located:
            backlog.append({'token_id': clean(r['token_id']), 'name': nm, 'search_hint': clean(r['category']),
                            'wiki_search': clean(r['link'])})

    # sanity: codex ids used must exist in the Category sheet
    for p in pois + creatures:
        if p['codex_category'] and p['codex_category'] not in cat_ids:
            issues.append(f"codex category '{p['codex_category']}' not in Category sheet ({p['name']})")

    write(cats, resources, biomes, biome_res, pois, creatures, backlog, issues, merged)


def write(cats, resources, biomes, biome_res, pois, creatures, backlog, issues, merged):
    OUT.mkdir(parents=True, exist_ok=True)
    data = {'version': 1, 'h3_resolution': H3_RES, 'categories': cats, 'resources': resources, 'biomes': biomes,
            'biome_resources': biome_res, 'pois': pois, 'creatures': creatures, 'cities': city_index(pois)}
    (OUT / 'hexod_db.json').write_text(json.dumps(data, ensure_ascii=False, indent=1), encoding='utf-8')

    wb = openpyxl.Workbook()
    ws = wb.active; ws.title = 'README'
    stats = Counter((p['kind'], p['rarity']) for p in pois)
    readme = [
        ['HEXOD MASTER DB', 'single source of truth — generated by scripts/build_hexod_db.py'],
        ['Edit', 'Edit THIS file or the sources, re-run the script, then `python manage.py import_hexod_db`'],
        ['H3 resolution', H3_RES],
        ['Rarity', 'combined score ranked per family; quotas legendary 1% / epic 4% / rare 10% / uncommon 25% / common 60%'],
        ['POI (all)', len(pois)], ['POI on map (hex)', sum(p['on_map'] for p in pois)],
        ['Creatures', len(creatures)], ['Creatures needing review', sum(1 for c in creatures if c['needs_review'])],
        ['Categories', len(cats)], ['Biomes', len(biomes)], ['Resources', len(resources)],
        ['Unlocated backlog', len(backlog)], ['Duplicates merged', len(merged)], ['Data issues', len(issues)], [],
        ['kind / rarity', 'count'], *[[f'{k} / {r}', n] for (k, r), n in sorted(stats.items())],
    ]
    for row in readme:
        ws.append(row)
    for title, rows in (('POI', pois), ('CREATURE', creatures), ('CATEGORY', cats), ('BIOME', biomes),
                        ('BIOME_RESOURCE', biome_res), ('RESOURCE', resources), ('UNLOCATED', backlog),
                        ('MERGED_DUPLICATES', merged),
                        ('ISSUES', [{'issue': i} for i in issues])):
        sh = wb.create_sheet(title)
        if not rows:
            continue
        cols = list(rows[0].keys())
        sh.append(cols)
        for r in rows:
            sh.append([json.dumps(v, ensure_ascii=False) if isinstance(v, (dict, list)) else v for v in (r.get(c) for c in cols)])
        sh.freeze_panes = 'A2'
        sh.auto_filter.ref = sh.dimensions
    wb.save(OUT / 'HEXOD_MASTER_DB.xlsx')
    print(f"POI {len(pois)} (on map {sum(p['on_map'] for p in pois)}) · creatures {len(creatures)} · "
          f"categories {len(cats)} · biomes {len(biomes)} · resources {len(resources)} · backlog {len(backlog)} · issues {len(issues)}")


if __name__ == '__main__':
    sys.exit(main())
