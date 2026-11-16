"""
Add new place tokens to the token base, unchecked (off the map until the POI agent validates them).

    python3 scripts/add_tokens.py OTHER_DB.json [--dry-run]

OTHER_DB.json is any HEXOD DB file (old layout with `pois` or new with `tokens`), e.g. the old server copy
/home/hexod/data/hexod_db/hexod_db.json. Only places that are new are added: same uid, same Wikipedia article,
same name on the same hex, or a row the agents already rejected are skipped. Species are not imported
(their tokens come from the species validation).
"""
import json
import re
import sys
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DB = ROOT / 'data' / 'hexod_db' / 'hexod_db.json'


def norm(s):
    s = unicodedata.normalize('NFKD', s or '').encode('ascii', 'ignore').decode().lower()
    return re.sub(r'[^a-z0-9]+', ' ', s).strip()


def main(src: Path, dry: bool):
    base = json.loads(DB.read_text(encoding='utf-8'))
    other = json.loads(src.read_text(encoding='utf-8'))
    rejected = set()
    for line in (DB.parent / 'poi_validations.jsonl').read_text(encoding='utf-8').splitlines():
        try:
            v = json.loads(line)
        except ValueError:
            continue
        (rejected.add if v.get('verdict') == 'rejected' else rejected.discard)(v.get('uid'))
    uids = {t['uid'] for t in base['tokens']}
    wikis = {t['wiki_url'].lower() for t in base['tokens'] if t.get('wiki_url')}
    spots = {(norm(t['name']), t.get('h3_r8')) for t in base['tokens']}
    added = []
    for p in other.get('tokens') or other.get('pois', []):
        if p.get('creature_uid') or p.get('species_id') or p.get('kind') in ('species', 'resource'):
            continue
        if p['uid'] in uids or p['uid'] in rejected or (p.get('wiki_url') or '').lower() in wikis \
                or (norm(p.get('name')), p.get('h3_r8')) in spots:
            continue
        t = {k: v for k, v in p.items() if k not in ('verdict', 'validated_at')}
        t.update(on_map=False, source=f"{p.get('source') or 'import'} (imported {src.name}, to check)")
        added.append(t)
        uids.add(t['uid'])
        spots.add((norm(t.get('name')), t.get('h3_r8')))
        if t.get('wiki_url'):
            wikis.add(t['wiki_url'].lower())
    print(f'{len(added)} new place tokens to check (off the map until the POI agent validates them)')
    if not dry and added:
        base['tokens'] += added
        DB.write_text(json.dumps(base, ensure_ascii=False, indent=1), encoding='utf-8')
        print(f'written to {DB}')


if __name__ == '__main__':
    main(Path(sys.argv[1]), '--dry-run' in sys.argv)
