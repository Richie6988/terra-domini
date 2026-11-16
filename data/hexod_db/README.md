# HEXOD database

**`hexod_db.json` is the one database of the game.** It holds every POI, species, category, biome and resource,
with the validated values already applied (`verdict` and `validated_at` on each checked row; rejected rows are gone).
`manage.py import_hexod_db` loads it on every deploy.

| File | What it is |
|---|---|
| `hexod_db.json` | The database. Read it, never edit it by hand. |
| `poi_validations.jsonl`, `creature_validations.jsonl` | Edit history: one line per check by the validation agents (sources, corrections, reason). They write here; `python scripts/fold_validations.py` folds it into `hexod_db.json`. |
| `sources/candidates/*.csv` | Where new POIs are proposed: add a row, `build_hexod_db.py` puts it in the database as a candidate (off the map), the POI agent validates it. Rows still without `verdict` are the agents' queue. |
| `sources/` (other files) | Raw inputs (spreadsheets, CSV) used only by `scripts/build_hexod_db.py` to rebuild the database from scratch. |
| `review/` | Old quality review notes, for reference. |

Rebuild from scratch: `python scripts/build_hexod_db.py` (it folds the ledgers in at the end).
