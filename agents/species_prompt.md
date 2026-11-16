# Species validation task (animals, insects, plants, fungi, fossils, micro-organisms)

Your worker name is given in your task (WORKER). Tool prefix SP is exactly:
python agents/species_tool.py   (run from the repo root, with the project venv active)

Process exactly 10 species:
1. `SP --next 10 --claim WORKER` gives your rows (reserved for you). Do them one at a time, in order. Run every command in the foreground, Bash timeout 600000 ms. Never run anything in the background.
2. For each species:
   a. `SP --lookup UID <English Wikipedia title>` (the row wiki_url gives the title; if not found, try the scientific name). If no article exists, verdict rejected.
   b. Check the row against the intro: name (common English name, else scientific name; NEVER a parenthesis, never both names), codex_category (animal = vertebrates and other non-insect animals incl. marine; insect = insects, spiders and other arthropods; vegetal = plants, trees, algae; mushroom = fungi, lichens; fossil = extinct taxa known from fossils, incl. dinosaurs; microOrganism = bacteria, archaea, protists, yeasts, viruses), habitat (sea for marine species, land for everything else, freshwater included).
   c. Description: 1 to 3 sentences from the intro only, plain text, never "--", en dash or em dash.
   d. Rarity from the languages count: epic >= 80, rare 40-79, uncommon 15-39, common < 15. A world famous icon species (giant panda, tiger, T. rex, sequoia...) may go one tier higher; say why.
   e. Picture: `SP --view UID <url from lookup>` then look at the file with the Read tool. Keep it only if it clearly shows THIS species (the whole animal, plant, mushroom, or a fossil skeleton or a faithful life reconstruction for extinct taxa). Never a map, a range map, a diagram of something else, a stamp, a coin, a logo, a dead or butchered animal, a trophy hunt, a zoo sign. View 1 picture, a 2nd only if the 1st is wrong. Leave image_url empty if none fits. Never reuse a picture used by another stamped species: grep data/hexod_db/creature_validations.jsonl for the file name first.
   e1. Range points: ALWAYS run `SP --range <uid> <Scientific name>`. It returns real GBIF occurrence points. Pick your places from these points (skip introduced, captive or outlier records); only if it returns nothing, fall back to the rule below. Write "GBIF occurrences" in places_reason.
   e2. Spawn zones (places): 1 to 12 [lat, lon] points where this species really lives (from the intro, the range section or a cited source such as IUCN, GBIF or iNaturalist): spread them over its real range, one per distinct region (country, island, park, reef, forest). A rare or endemic species gets 1 to 3 points, a widespread one up to 12. Each point must sit in its habitat: on land for land species (a national park or reserve where it lives is ideal), at sea for marine species (on a known reef or coast), on a lake or river for freshwater ones. Fossils: the real find sites (formation or quarry). Domestic or cultivated species: where they originate. Never invent: if the range is unknown, give the one place named in the intro. Add places_reason: one short sentence naming the regions and the source.
   f. Write agents/results/WORKER-<uid>.json with: verdict (validated if nothing changed, corrected if anything changed, rejected), name, codex_category, habitat (sea or land), description, wiki_url (https://en.wikipedia.org/wiki/...), image_url (exact url from lookup, or ""), rarity (common|uncommon|rare|epic), rarity_reason (short), places (list of [lat, lon]), places_reason, corrections (list of short sentences).
   g. `SP --submit UID <that absolute json path>`. If NOT STAMPED, fix and resubmit (max 3 tries).
3. Do not edit code or other files. Do not run git.

Final report, SHORT (max 14 lines): one line per row "uid · verdict · name · category · rarity · picture yes/no", then blockers.


OWNER DECISIONS (2026-11-12), apply them:
- Generator filler rows (a description copied from another species): decide case by case. If the name is a real species, genus or well known group with its own English Wikipedia article, rewrite everything from that article (best quality possible). If it is not a real living thing, a duplicate, or has no English Wikipedia article, reject it.
- Cultivated plants (vegetables, fruits, crops, herbs, ornamentals): be smart, not mechanical. The language count overstates them. Epic only for world-defining crops (rice, wheat, maize, potato, coffee, cacao, tea, grapevine, sugarcane, cotton, olive, soybean). Other well known crops: rare at most. Minor cultivars and varieties (navy bean, romanesco, kohlrabi...): common or uncommon. For cultivated plants you MAY lower the rarity the row has. Places: the wild ancestor's native range or the centre of origin (GBIF wild records).
- Re-check pass: --next-regbif N --claim W lists stamped species whose places are not from GBIF yet. For each: run --range, replace the places with GBIF points of the native range, re-check the rarity with the rules above (cultivated plants may be lowered), keep the rest unless wrong, and submit with "restamp": true and "places_reason" naming GBIF occurrences.

- When you lower the rarity of a cultivated plant, add "cultivated": true to the result file (the tool refuses any other lowering).

- PICTURES FROM COMMONS (owner tool update 2026-11-15): when the lookup offers no good picture (zoo, skull only, plate, none), find a better file on Wikimedia Commons (web search) and run `--commons UID "File:Name.jpg"`; it adds that file with its real author and license, then `--view` it as usual.
