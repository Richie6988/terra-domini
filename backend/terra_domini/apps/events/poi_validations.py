"""
POI validation ledger (2026-10-19) — the stamp the POI agent (manage.py poi_agent) leaves on every row it checked.

One JSON object per line, keyed by the master DB uid, in poi_validations.jsonl next to the master DB (on the VPS:
/home/hexod/data, outside the repo, so git pulls and DB rebuilds never lose it), merged with data/hexod_db/
poi_validations.jsonl (stamps made in Claude Code sessions, committed). The last line of a uid wins.
import_hexod_db overlays it on the master DB: a validated row keeps its checked name, position, rarity, description
and picture; a rejected row leaves the map.
"""
import json
import os
from pathlib import Path

from terra_domini.apps.events import hexod_db

LEDGER = Path(os.environ.get('HEXOD_VALIDATIONS') or hexod_db.DB_PATH.parent / 'poi_validations.jsonl')
# stamps made in Claude Code sessions (poi-validator subagent) travel with git, then merge with the VPS ledger
REPO_LEDGER = hexod_db.REPO_DB.parent / 'poi_validations.jsonl'

# fields of a validation that replace the master DB row on import
OVERLAY = ('name', 'lat', 'lon', 'h3_r8', 'country_code', 'description', 'rarity', 'image_url', 'image_credit')


def load() -> dict:
    """{uid: latest validation} over the repo ledger and the local one"""
    out = {}
    for path in dict.fromkeys([REPO_LEDGER, LEDGER]):
        if not path.exists():
            continue
        with open(path, encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if line:
                    try:
                        v = json.loads(line)
                        if v['uid'] not in out or (v.get('validated_at') or '') >= (out[v['uid']].get('validated_at') or ''):
                            out[v['uid']] = v
                    except (ValueError, KeyError):
                        continue
    return out


def append(v: dict):
    LEDGER.parent.mkdir(parents=True, exist_ok=True)
    with open(LEDGER, 'a', encoding='utf-8') as f:
        f.write(json.dumps(v, ensure_ascii=False) + '\n')


def overlay(pois: list) -> tuple:
    """Apply the ledger to master DB rows (in place). Returns (rows kept, number validated, number rejected)."""
    led = load()
    kept, ok, rej = [], 0, 0
    for p in pois:
        v = led.get(p['uid'])
        if not v:
            kept.append(p)
            continue
        if v.get('verdict') == 'rejected':
            rej += 1
            continue
        for k in OVERLAY:
            if v.get(k) not in (None, ''):
                p[k] = v[k]
        p['validated_at'] = v.get('validated_at')
        ok += 1
        kept.append(p)
    return kept, ok, rej
