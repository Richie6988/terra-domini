# Validation agents: run them locally, then hand over for review

Three workers check the token base (`data/hexod_db/hexod_db.json`) one batch at a time:

| Worker | Prompt | Batch | Tool |
|---|---|---|---|
| w1, places | `agents/run_poi.md` (rules in `agents/poi_prompt.md`) | 10 places | `cd backend && python manage.py poi_agent --skip-checks` |
| s1, species | `agents/run_species.md` (rules in `agents/species_prompt.md`) | 5 new + 5 GBIF re-checks | `python agents/species_tool.py` |
| m1, mushrooms | `agents/run_mushroom.md` | 10 mushrooms | `python agents/species_tool.py --cat mushroom` |

Each batch appends to the ledgers (`poi_validations.jsonl`, `creature_validations.jsonl`) and writes a short report
in `agents/reports/`. Nothing else in the repo is touched by the agents.

## 1. Set up once
```
git checkout main && git pull
python3 -m venv .venv && source .venv/bin/activate
pip install -r backend/requirements.txt
cd backend && python manage.py migrate && cd ..      # local SQLite game DB the POI tool stamps into
```
The agent needs: a shell (Bash), reading files including images (to look at pictures), writing files, and web search.
Internet access to wikipedia.org, wikidata.org, wikimedia.org and api.gbif.org.

## 2. Run
`AGENT_CMD` is your agent command; it receives the prompt file as its last argument. Examples:
```
# Claude Code CLI (one agent at a time, no permission prompts)
AGENT_CMD='bash agents/claude_agent.sh' bash agents/loop.sh
# any other CLI that takes a prompt file
AGENT_CMD='my-agent --prompt-file' bash agents/loop.sh
```
Options: `ONLY=poi` (or `species`, `mushroom`) for one worker, `MAX=20` for 20 cycles. It stops by itself when nothing
is left. After every batch it folds the validations into the token base and makes a local commit: stop it any time
(Ctrl+C) and start it again, unfinished claims expire after 3 hours.

## 3. Hand over
```
git push origin main
```
Then tell Claude Code "go": it reads the new commits and `agents/reports/`, checks every row against the owner rules
(rarity band, never lowered, UNESCO, categories, native range, picture rules, duplicates), appends review lines to the
ledgers where needed, folds, commits and pushes. Then deploy with `deploy/update.sh` on the VPS.

## Rules that never change
- One token base, `data/hexod_db/hexod_db.json`. The ledgers are its check history. Never edit the base by hand.
- No fake data: every fact, point and picture comes from Wikipedia, Wikidata, Commons or GBIF.
- Never "--", en dash or em dash in game texts. No emoji in the UI.
