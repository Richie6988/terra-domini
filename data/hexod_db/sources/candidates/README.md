# Token candidates (agents and editors)

One CSV per author/theme in this folder (`history.csv`, `landmarks.csv`, `strategic.csv`...). Never edit another author's file.
`scripts/build_hexod_db.py` reads every `*.csv` here. A candidate becomes a live token only after
`manage.py wiki_enrich` (run on the VPS, which can reach Wikipedia) confirms its Wikipedia article exists:
coordinates, picture (with license and author) and a short description then come from Wikipedia itself.
Candidates whose article is not found are dropped. That is how we stay at RULE 1 (no invented data).

## Columns (UTF-8, header required)
| column | required | notes |
|---|---|---|
| name | yes | display name, short (max ~40 chars): "Notre-Dame fire", "Eiffel Tower" |
| wiki_url | yes | exact English Wikipedia article URL, `https://en.wikipedia.org/wiki/Notre-Dame_de_Paris_fire` |
| kind | yes | `landmark` (a place), `history` (an event that happened at a place) |
| game_category | yes | a slug from the list below |
| lat, lon | yes | decimal degrees of the place (for an event: where it happened). Approximate is fine, Wikipedia corrects it |
| country_code | yes | ISO-2 (FR, US...). `--` for international waters |
| rarity | yes | common / uncommon / rare / epic / legendary (see quotas) |
| event_date | history only | `YYYY-MM-DD` (or `YYYY` / `YYYY-MM` if the day is unknown) |
| title | no | 3-6 word subtitle shown on the card ("Cathedral roof lost to flames") |
| description | no | leave empty unless sure: Wikipedia's intro fills it |
| fun_fact_1 | no | one verifiable fact, only if certain |
| curated_by | yes | your agent/editor name |
| curated_at | yes | `YYYY-MM-DD` |
| notes | no | `TO VERIFY ...` when unsure about anything |

## game_category slugs
Places: mountain_peak volcano canyon waterfall glacier cave_system coral_reef ancient_forest nature_sanctuary island desert freshwater
oil_field gas_reserve gold_mine diamond_mine rare_earth lithium_deposit uranium_mine coal_mine iron_ore copper_mine fertile_land
capital_city mega_port chokepoint nuclear_plant space_center data_center financial_hub stock_exchange military_base naval_base
missile_site intelligence_hq world_heritage ancient_ruins religious_site royal_palace museum secret_facility international_org
tech_giant media_hq control_tower trade_node ancient_wonder mega_dam infrastructure agri_megafarm seed_vault steel_mill
semiconductor pharma_hq internet_cable sports_arena casino_resort research_station particle_collider observatory
Events: history_event (anything that happened: war, disaster, discovery, launch, concert, record, political turning point)

## Rarity quotas per file (roughly)
legendary <= 2 %, epic ~5 %, rare ~13 %, uncommon ~25 %, common the rest. Legendary = known by almost everyone on Earth.

## Rules
- Only articles you are sure exist on English Wikipedia, with the exact title. No invented places, events, dates or numbers.
- No duplicates: check `data/hexod_db/hexod_db.json` (pois[].name / wiki_url) and the other files in this folder first.
- One token per thing. An event and its place are two tokens (Notre-Dame de Paris = landmark, Notre-Dame fire = history).
