# HEXOD token base

**`hexod_db.json` is the one and only token base of the game.** The server never keeps its own copy:
`deploy/update.sh` pulls this file from git and loads it.

## One list: `tokens`
One row = one token.
- A place (monument, city, lake, castle...) is one token.
- A species is one token per place it lives in (up to 12). Each one carries the full species card (name, rarity,
  picture, description) plus its own point; `species_id` ties them together for the Codex.
  A species with no known place yet has one token without coordinates, off the map.
- `verdict` + `validated_at`: the token was checked by the agents. No `verdict`: still to check.
- `on_map: false`: not on the map (unchecked import, country card, species with no place yet).

The other keys (`categories`, `biomes`, `resources`, `biome_resources`, `cities`) are game settings, not tokens.

## Files
| File | Role |
|---|---|
| `hexod_db.json` | The token base. |
| `poi_validations.jsonl`, `creature_validations.jsonl` | Agents' check history (sources, corrections, reasons). After each batch: `python3 scripts/fold_validations.py` folds them into `hexod_db.json`, then commit. |
| `sources/` | Original spreadsheets, used only by `scripts/build_hexod_db.py` to rebuild the base from zero. |
| `review/` | Old quality review notes. |

## Adding tokens
`python3 scripts/add_tokens.py OTHER_DB.json` adds the places that are new, unchecked and off the map; the POI agent
validates them like every other token.
