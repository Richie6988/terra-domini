"""
HEXOD token base (owner 2026-11-16): ONE list, `tokens`, one row per token. No POI / creature split.

A place (monument, city, lake...) is one token. A species is as many tokens as the places it lives in: every one
carries the full species card (name, rarity, picture, description...) plus its own point, and `species_id` ties
them together for the Codex. A species with no known place yet is one token without coordinates (off the map).

Pure Python (no Django): used by the game loader (hexod_db.py), scripts/fold_validations.py and the agents' tools.
"""
SPECIES_FIELDS = ('name', 'description', 'rarity', 'codex_category', 'habitat', 'wiki_url', 'image_url', 'image_credit',
                  'fossil_count', 'fossil_sites', 'period', 'needs_review', 'place_source')
PLACE_FIELDS = ('name', 'lat', 'lon', 'h3_r8', 'country_code', 'description', 'rarity', 'image_url', 'image_credit',
                'game_category')
MAX_PLACES = 12


def _h3(lat, lon):
    import h3
    return h3.latlng_to_cell(lat, lon, 8)


def species_tokens(species: dict, places, template: dict | None = None) -> list:
    """The tokens of one species: one per place (max 12), or one off-map token if no place is known."""
    sid = species['uid']
    base = {k: v for k, v in (template or {}).items() if k not in ('uid', 'lat', 'lon', 'h3_r8', 'country_code')}
    base.update({k: species[k] for k in SPECIES_FIELDS if species.get(k) not in (None, '', [])})
    base.update(kind='species', species_id=sid, game_category='species_' + (species.get('codex_category') or 'animal'))
    for k in ('verdict', 'validated_at'):
        if species.get(k):
            base[k] = species[k]
    base.pop('creature_uid', None)
    pts = [(round(la, 5), round(lo, 5)) for la, lo in (places or [])[:MAX_PLACES]]
    if not pts:
        return [dict(base, uid=f'sp-{sid}-0', lat=None, lon=None, h3_r8='', on_map=False)]
    return [dict(base, uid=f'sp-{sid}-{i}', lat=la, lon=lo, h3_r8=_h3(la, lo), on_map=True) for i, (la, lo) in enumerate(pts, 1)]


def from_legacy(data: dict) -> dict:
    """Old layout (pois + creatures) -> tokens. Species points keep their template POI fields."""
    tokens, by_species = [], {}
    for p in data.get('pois', []):
        if p.get('creature_uid'):
            by_species.setdefault(p['creature_uid'], []).append(p)
        else:
            tokens.append(dict(p))
    for c in data.get('creatures', []):
        pts = by_species.get(c['uid'], [])
        if c.get('verdict') and c.get('places') or not pts:
            tokens += species_tokens(c, c.get('places') if c.get('verdict') else None, pts[0] if pts else None)
            continue
        card = species_tokens(c, None, pts[0])[0]     # unchecked species: keep each point as it is, with the full card
        for p in pts:
            tokens.append(dict(card, uid=p['uid'], lat=p['lat'], lon=p['lon'], h3_r8=p['h3_r8'],
                               country_code=p.get('country_code', ''), on_map=p.get('on_map', True)))
    out = {k: v for k, v in data.items() if k not in ('pois', 'creatures')}
    out['version'] = 2
    out['tokens'] = tokens
    return out


def species_groups(tokens) -> dict:
    out = {}
    for t in tokens:
        if t.get('species_id'):
            out.setdefault(t['species_id'], []).append(t)
    return out


def species_card(group: list) -> dict:
    """One species, read back from its tokens (Codex / Safari view)."""
    t = group[0]
    c = {k: t[k] for k in SPECIES_FIELDS if k in t}
    c['uid'] = t['species_id']
    c['places'] = [(x['lat'], x['lon']) for x in group if x.get('lat') is not None]
    for k in ('verdict', 'validated_at'):
        if t.get(k):
            c[k] = t[k]
    return c


def views(data: dict) -> tuple:
    """(pois, creatures) for the game code: pois = every token (species ones with creature_uid), creatures = one per species."""
    pois = []
    for t in data.get('tokens', []):
        p = dict(t)
        if t.get('species_id'):
            p['creature_uid'] = t['species_id']
        pois.append(p)
    creatures = [species_card(g) for g in species_groups(data.get('tokens', [])).values()]
    return pois, creatures


def fold(data: dict, poi_ledger: dict, species_ledger: dict) -> str:
    """Apply the agents' latest validations to the tokens (idempotent). Rejected tokens / species are removed."""
    tokens, pv, pr = [], 0, 0
    groups = species_groups(data['tokens'])
    for t in data['tokens']:
        if t.get('species_id'):
            continue
        v = poi_ledger.get(t['uid'])
        if v and v.get('verdict') == 'rejected':
            pr += 1
            continue
        if v:
            for f in PLACE_FIELDS:
                if v.get(f) not in (None, '', []):
                    t[f] = v[f]
            t['verdict'], t['validated_at'] = v.get('verdict'), v.get('validated_at')
            pv += 1
        tokens.append(t)
    sv, sr = 0, 0
    for sid, group in groups.items():
        v = species_ledger.get(sid)
        if v and v.get('verdict') == 'rejected':
            sr += 1
            continue
        if not v:
            tokens += group
            continue
        card = species_card(group)
        card.update({k: v[k] for k in SPECIES_FIELDS if v.get(k) not in (None, '', [])})
        card['verdict'], card['validated_at'] = v.get('verdict'), v.get('validated_at')
        tokens += species_tokens(card, v.get('places') or card['places'], group[0])
        sv += 1
    data['tokens'] = tokens
    return f"places: {pv} validated, {pr} rejected removed · species: {sv} validated, {sr} rejected removed"
