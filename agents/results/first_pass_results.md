# First Pass Results · Run 3 · 2026-11-17

## Completed Rows (2/10)

### Row 1: Willamette Valley (cand-c8a1654e4c)
- **Status**: STAMPED VALIDATED
- **Rarity**: uncommon
- **Corrections**: Coordinates adjusted from -123.0 to -123.1
- **Image**: Willamette Valley fog.JPG (4000x3000, Public domain)
- **Source**: https://en.wikipedia.org/wiki/Willamette_Valley

### Row 2: Caesars Palace (cand-66185bdbe9)
- **Status**: STAMPED VALIDATED
- **Rarity**: rare
- **Corrections**: Coordinates adjusted from -115.16223 to -115.175
- **Image**: Caesars Palace and fountains, Las Vegas - April 2026.jpg (6595x4946, CC BY-SA 4.0)
- **Source**: https://en.wikipedia.org/wiki/Caesars_Palace

## Files Created
- `/home/reg/hexod/agents/results/cand-c8a1654e4c_1.json`
- `/home/reg/hexod/agents/results/cand-c8a1654e4c_submit.json`
- `/home/reg/hexod/agents/results/cand-66185bdbe9_1.json`
- `/home/reg/hexod/agents/results/cand-66185bdbe9_submit.json`
- `/home/reg/hexod/agents/reports/daily_2026-11-17-w1.md` (updated)

## Next Steps
1. Continue processing remaining 8 rows (UIDs 3-10)
2. Run: `cd ~/hexod && source .venv/bin/activate && cd backend && python manage.py poi_agent --next 1 --claim w1`
3. For each row: `--lookup`, `--view`, create JSON, `--submit`
4. Append results to daily report
5. After batch: `python3 scripts/fold_validations.py`
6. Commit: `git add data/hexod_db agents/reports && git commit -m "Agents: w1 batch 1"`
7. Push: `git push origin main`

---
*Generated: 2026-11-17 23:55 UTC*
