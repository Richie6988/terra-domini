"""
Fold the validation ledgers into the token base (owner 2026-11-16: one base, `tokens`, one row per token).

    python scripts/fold_validations.py      # rewrites data/hexod_db/hexod_db.json in place (idempotent)

Run it after every agent batch, before the commit. The ledgers (poi_validations.jsonl for places,
creature_validations.jsonl for species) stay as the edit history the agents append to.
An old layout file (pois + creatures) is converted to tokens first.
"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DB_DIR = ROOT / 'data' / 'hexod_db'
sys.path.insert(0, str(ROOT / 'backend' / 'terra_domini' / 'apps' / 'events'))
import tokens_format  # noqa: E402


def ledger(path: Path) -> dict:
    """{uid: latest line} (the latest validated_at wins)"""
    out = {}
    if path.exists():
        for line in path.read_text(encoding='utf-8').splitlines():
            try:
                v = json.loads(line)
                if v['uid'] not in out or (v.get('validated_at') or '') >= (out[v['uid']].get('validated_at') or ''):
                    out[v['uid']] = v
            except (ValueError, KeyError):
                continue
    return out


def fold(data: dict, db_dir: Path = DB_DIR) -> dict:
    if 'tokens' not in data:
        data = tokens_format.from_legacy(data)
    print(tokens_format.fold(data, ledger(db_dir / 'poi_validations.jsonl'), ledger(db_dir / 'creature_validations.jsonl')))
    return data


def save(data: dict, path: Path):
    data.pop('pois', None)
    data.pop('creatures', None)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=1), encoding='utf-8')


if __name__ == '__main__':
    path = Path(sys.argv[1]) if len(sys.argv) > 1 else DB_DIR / 'hexod_db.json'
    data = fold(json.loads(path.read_text(encoding='utf-8')))
    save(data, path)
    t = data['tokens']
    print(f"{len(t)} tokens · on map {sum(1 for x in t if x.get('on_map'))} · checked {sum(1 for x in t if x.get('verdict'))}")
