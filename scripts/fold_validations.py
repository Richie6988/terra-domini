"""
Fold the validation ledgers into hexod_db.json (owner 2026-11-16: one complete database).

    python scripts/fold_validations.py            # rewrites data/hexod_db/hexod_db.json in place

Every checked POI and creature gets its validated fields (name, position, rarity, category, description, picture,
places...) plus `verdict` and `validated_at`; rejected rows are removed. The ledgers (poi_validations.jsonl,
creature_validations.jsonl) stay as the edit history the agents append to; folding is idempotent, so it runs after
every agent batch and at the end of scripts/build_hexod_db.py.
"""
import json
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DB_DIR = ROOT / 'data' / 'hexod_db'

POI_FIELDS = ('name', 'lat', 'lon', 'h3_r8', 'country_code', 'description', 'rarity', 'image_url', 'image_credit',
              'game_category')
CREATURE_FIELDS = ('name', 'description', 'rarity', 'codex_category', 'habitat', 'wiki_url', 'image_url',
                   'image_credit', 'fossil_count', 'fossil_sites', 'period', 'places')


def ledger(name: str, dirs) -> dict:
    """{uid: latest line} over the ledgers in dirs (the latest validated_at wins)"""
    out = {}
    for d in dict.fromkeys(Path(x) for x in dirs):
        path = d / name
        if not path.exists():
            continue
        for line in path.read_text(encoding='utf-8').splitlines():
            try:
                v = json.loads(line)
                if v['uid'] not in out or (v.get('validated_at') or '') >= (out[v['uid']].get('validated_at') or ''):
                    out[v['uid']] = v
            except (ValueError, KeyError):
                continue
    return out


def _apply(rows, led, fields):
    kept, ok, rej = [], 0, 0
    for r in rows:
        v = led.get(r['uid'])
        if v and v.get('verdict') == 'rejected':
            rej += 1
            continue
        if v:
            for f in fields:
                if v.get(f) not in (None, '', []):
                    r[f] = v[f]
            r['verdict'], r['validated_at'] = v.get('verdict'), v.get('validated_at')
            ok += 1
        kept.append(r)
    return kept, ok, rej


def fold(data: dict, dirs=(DB_DIR,)) -> str:
    data['pois'], pv, pr = _apply(data.get('pois', []), ledger('poi_validations.jsonl', dirs), POI_FIELDS)
    cled = ledger('creature_validations.jsonl', dirs)
    data['creatures'], cv, cr = _apply(data.get('creatures', []), cled, CREATURE_FIELDS)
    gone = {u for u, v in cled.items() if v.get('verdict') == 'rejected'}
    data['pois'] = [p for p in data['pois'] if p.get('creature_uid') not in gone]
    return f"POIs: {pv} validated, {pr} rejected removed · creatures: {cv} validated, {cr} rejected removed"


if __name__ == '__main__':
    path = Path(sys.argv[1]) if len(sys.argv) > 1 else DB_DIR / 'hexod_db.json'
    dirs = [DB_DIR, path.parent] + ([Path(os.environ['HEXOD_DATA'])] if os.environ.get('HEXOD_DATA') else [])
    data = json.loads(path.read_text(encoding='utf-8'))
    print(fold(data, dirs))
    path.write_text(json.dumps(data, ensure_ascii=False, indent=1), encoding='utf-8')
