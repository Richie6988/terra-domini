# HEXOD token quality review

Generated 2026-10-18T17:22Z by TOKEN REVIEWER. Scope: 1950 POIs in hexod_db.json; curated_tokens.csv (0 rows).

## Summary
- Findings: 94 (P1 63, P2 22, P3 9)
- Rarity: legendary 26, epic 69, rare 130, uncommon 298, common 1427
- Sources: legacy_seed 752, tokens_db 561, wiki_extract 244, city 219, country 153, strategic 21
- Category anomaly 351 (18%), control_tower 43 (many monuments), empty title 1389, no coords 46, no country 616

## Top problems
1. 244 wiki_extract tokens with truncated names
2. World icons rated common/uncommon/rare, categories control_tower
3. Duplicates beyond same-H3 (legacy vs tokens_db, ~80 pairs)
4. Scraped/glued text on 136 tokens_db tokens
5. City rarity broken, cities without coordinates
6. Wrong country/coords/category (Mekong, McArthur, Nile Dam, Hwange)

## Findings (status SENT unless noted)

| Batch | Pri | uid | name | problem | status |
|---|---|---|---|---|---|
| 1 | P1 | poi-100094 | SpaceX Starbase | category missile_site -> space_center; title "Rocket launcher" -> "Starship Launch Site"; description too long, trim to 2 sentences | SENT |
| 1 | P1 | poi-100142 | Berlin Wall | category ancient_wonder is wrong for a 1961-89 barrier; use monument/historic-event slug | SENT |
| 1 | P1 | poi-100300 | Borobudur | description is a restoration sentence, not a description; write "9th-century Mahayana Buddhist temple in Central Java, the largest in the world." | SENT |
| 1 | P1 | poi-100571 | Havana Vieja | description starts with fortress construction detail, rewrite as place description | SENT |
| 1 | P1 | poi-100851 | Loire Valley | description is a UNESCO date sentence with glued "2000,UNESCOadded"; rewrite | SENT |
| 1 | P1 | poi-100870 | Summer Palace | description is about Longevity Hill height, rewrite as imperial garden description; fun_fact_1 glued "1998,UNESCOincluded" | SENT |
| 1 | P1 | poi-100928 | Cusco | description glued "wasconqueredin"; fun_fact_3 glued "Siteby UNESCOwith"; rewrite | SENT |
| 1 | P1 | poi-100940 | Camp Lemonnier | rarity legendary -> rare/uncommon (US base, not world-icon); description is about troop leave rules, rewrite; duplicate of legacy-djibouticamplemonnier (1 km) | SENT |
| 1 | P2 | poi-101282 | Bab-el-Mandeb | description is a sea-level geology sentence; rewrite as chokepoint (Red Sea / Gulf of Aden strait, ~29 km wide); glued "100,000 years,eustatic" | SENT |
| 1 | P1 | legacy-straitofhormuz | Strait of Hormuz | LEGENDARY duplicate of poi-101284 Hormuz Strait (rare) and legacy-hormuzstraitqeshmisland (epic); keep ONE token, merge others as aliases; unify rarity | SENT |
| 1 | P1 | city-ci2 | Kano | LEGENDARY with lat/lon None, empty description: not placeable; set coords (12.0022, 8.5920) and a description or drop rarity | SENT |
| 1 | P1 | city-ci3 | Ibadan | LEGENDARY city; description contains IPA/"Listen" junk; rarity inflated by population score (compare Tokyo/Paris which are uncommon). Recompute city rarity or cap | SENT |
| 1 | P2 | poi-100035 | Notre-Dame Paris | name -> "Notre-Dame de Paris"; drop city suffix; check wiki_url | SENT |
| 1 | P1 | poi-100107 | Louvre Paris | name -> "Louvre Museum"; DUPLICATE of legacy-louvremuseumparis (150 m, uncommon): merge as alias | SENT |
| 1 | P2 | poi-100071 | Pompeii | duplicate of legacy-pompeiiruins (350 m): merge alias | SENT |
| 1 | P3 | poi-100008 | Versailles Palace | name -> "Palace of Versailles"; verify wiki_url target | SENT |
| 1 | P2 | poi-100028 | (country cards) | Country tokens (United States, China, Japan...) carry game_category international_org and are legendary/epic with no hex: acceptable codex-only but category should be "country"; descriptions are raw scrape (IPA, parentheses) | SENT |
| 2 | P1 | poi-100204 | Eiffel Tower | rarity rare is far too low for a world-icon; raise to epic or legendary (suggested: legendary for Eiffel, Taj, Pyramid, Colosseum, Everest, Mecca, Fuji, Great Barrier Reef; epic for the rest) | SENT |
| 2 | P1 | poi-100203 | Taj Mahal | rarity rare is far too low for a world-icon; raise to epic or legendary (suggested: legendary for Eiffel, Taj, Pyramid, Colosseum, Everest, Mecca, Fuji, Great Barrier Reef; epic for the rest) | SENT |
| 2 | P1 | poi-100208 | Great Pyramid | rarity rare is far too low for a world-icon; raise to epic or legendary (suggested: legendary for Eiffel, Taj, Pyramid, Colosseum, Everest, Mecca, Fuji, Great Barrier Reef; epic for the rest) | SENT |
| 2 | P1 | legacy-colosseumrome | Colosseum Rome | rarity rare is far too low for a world-icon; raise to epic or legendary (suggested: legendary for Eiffel, Taj, Pyramid, Colosseum, Everest, Mecca, Fuji, Great Barrier Reef; epic for the rest) | SENT |
| 2 | P1 | legacy-statueofliberty | Statue of Liberty | rarity rare is far too low for a world-icon; raise to epic or legendary (suggested: legendary for Eiffel, Taj, Pyramid, Colosseum, Everest, Mecca, Fuji, Great Barrier Reef; epic for the rest) | SENT |
| 2 | P1 | legacy-meccamasjidalharam | Mecca Masjid al-Haram | rarity uncommon is far too low for a world-icon; raise to epic or legendary (suggested: legendary for Eiffel, Taj, Pyramid, Colosseum, Everest, Mecca, Fuji, Great Barrier Reef; epic for the rest) | SENT |
| 2 | P1 | poi-100187 | Mount Everest | rarity common is far too low for a world-icon; raise to epic or legendary (suggested: legendary for Eiffel, Taj, Pyramid, Colosseum, Everest, Mecca, Fuji, Great Barrier Reef; epic for the rest) | SENT |
| 2 | P1 | poi-102755 | Mount Fuji | rarity common is far too low for a world-icon; raise to epic or legendary (suggested: legendary for Eiffel, Taj, Pyramid, Colosseum, Everest, Mecca, Fuji, Great Barrier Reef; epic for the rest) | SENT |
| 2 | P1 | poi-100919 | Kilimanjaro | rarity common is far too low for a world-icon; raise to epic or legendary (suggested: legendary for Eiffel, Taj, Pyramid, Colosseum, Everest, Mecca, Fuji, Great Barrier Reef; epic for the rest) | SENT |
| 2 | P1 | poi-100221 | Burj Khalifa | rarity uncommon is far too low for a world-icon; raise to epic or legendary (suggested: legendary for Eiffel, Taj, Pyramid, Colosseum, Everest, Mecca, Fuji, Great Barrier Reef; epic for the rest) | SENT |
| 2 | P1 | legacy-greatbarrierreefcoralsea | Great Barrier Reef | rarity common is far too low for a world-icon; raise to epic or legendary (suggested: legendary for Eiffel, Taj, Pyramid, Colosseum, Everest, Mecca, Fuji, Great Barrier Reef; epic for the rest) | SENT |
| 2 | P1 | poi-100161 | Galapagos Islands | rarity uncommon is far too low for a world-icon; raise to epic or legendary (suggested: legendary for Eiffel, Taj, Pyramid, Colosseum, Everest, Mecca, Fuji, Great Barrier Reef; epic for the rest) | SENT |
| 2 | P1 | poi-100080 | Angel Falls | rarity uncommon is far too low for a world-icon; raise to epic or legendary (suggested: legendary for Eiffel, Taj, Pyramid, Colosseum, Everest, Mecca, Fuji, Great Barrier Reef; epic for the rest) | SENT |
| 2 | P1 | poi-100296 | Niagara Falls | rarity common is far too low for a world-icon; raise to epic or legendary (suggested: legendary for Eiffel, Taj, Pyramid, Colosseum, Everest, Mecca, Fuji, Great Barrier Reef; epic for the rest) | SENT |
| 2 | P1 | legacy-serengetinationalpark | Serengeti | rarity common is far too low for a world-icon; raise to epic or legendary (suggested: legendary for Eiffel, Taj, Pyramid, Colosseum, Everest, Mecca, Fuji, Great Barrier Reef; epic for the rest) | SENT |
| 2 | P1 | legacy-alhambragranada | Alhambra Granada | rarity common is far too low for a world-icon; raise to epic or legendary (suggested: legendary for Eiffel, Taj, Pyramid, Colosseum, Everest, Mecca, Fuji, Great Barrier Reef; epic for the rest) | SENT |
| 2 | P1 | legacy-potalapalacelhasa | Potala Palace | rarity common is far too low for a world-icon; raise to epic or legendary (suggested: legendary for Eiffel, Taj, Pyramid, Colosseum, Everest, Mecca, Fuji, Great Barrier Reef; epic for the rest) | SENT |
| 2 | P1 | legacy-buckinghampalace | Buckingham Palace | rarity common is far too low for a world-icon; raise to epic or legendary (suggested: legendary for Eiffel, Taj, Pyramid, Colosseum, Everest, Mecca, Fuji, Great Barrier Reef; epic for the rest) | SENT |
| 2 | P1 | legacy-montsaintmichel | Mont Saint-Michel | rarity uncommon is far too low for a world-icon; raise to epic or legendary (suggested: legendary for Eiffel, Taj, Pyramid, Colosseum, Everest, Mecca, Fuji, Great Barrier Reef; epic for the rest) | SENT |
| 2 | P1 | poi-100795 | Easter Island | rarity uncommon is far too low for a world-icon; raise to epic or legendary (suggested: legendary for Eiffel, Taj, Pyramid, Colosseum, Everest, Mecca, Fuji, Great Barrier Reef; epic for the rest) | SENT |
| 2 | P1 | poi-100203 | Taj Mahal | category control_tower is wrong (title often reads "Control tower"/"Skyline Dominating Icon"); use monument/world_heritage/royal_palace as fits; keep control_tower for real towers (CN Tower, Skytree, Taipei 101) and airports only | SENT |
| 2 | P1 | poi-100208 | Great Pyramid | category control_tower is wrong (title often reads "Control tower"/"Skyline Dominating Icon"); use monument/world_heritage/royal_palace as fits; keep control_tower for real towers (CN Tower, Skytree, Taipei 101) and airports only | SENT |
| 2 | P1 | poi-100212 | Athens acropolis | category control_tower is wrong (title often reads "Control tower"/"Skyline Dominating Icon"); use monument/world_heritage/royal_palace as fits; keep control_tower for real towers (CN Tower, Skytree, Taipei 101) and airports only | SENT |
| 2 | P1 | poi-100215 | Sydney Opera | category control_tower is wrong (title often reads "Control tower"/"Skyline Dominating Icon"); use monument/world_heritage/royal_palace as fits; keep control_tower for real towers (CN Tower, Skytree, Taipei 101) and airports only | SENT |
| 2 | P1 | poi-101087 | White House | category control_tower is wrong (title often reads "Control tower"/"Skyline Dominating Icon"); use monument/world_heritage/royal_palace as fits; keep control_tower for real towers (CN Tower, Skytree, Taipei 101) and airports only | SENT |
| 2 | P1 | poi-100096 | Brandenburg Gate | category control_tower is wrong (title often reads "Control tower"/"Skyline Dominating Icon"); use monument/world_heritage/royal_palace as fits; keep control_tower for real towers (CN Tower, Skytree, Taipei 101) and airports only | SENT |
| 2 | P1 | legacy-colosseumrome | Colosseum Rome | category control_tower is wrong (title often reads "Control tower"/"Skyline Dominating Icon"); use monument/world_heritage/royal_palace as fits; keep control_tower for real towers (CN Tower, Skytree, Taipei 101) and airports only | SENT |
| 2 | P1 | legacy-statueofliberty | Statue of Liberty | category control_tower is wrong (title often reads "Control tower"/"Skyline Dominating Icon"); use monument/world_heritage/royal_palace as fits; keep control_tower for real towers (CN Tower, Skytree, Taipei 101) and airports only | SENT |
| 2 | P1 | legacy-goldengatebridge | Golden Gate Bridge | category control_tower is wrong (title often reads "Control tower"/"Skyline Dominating Icon"); use monument/world_heritage/royal_palace as fits; keep control_tower for real towers (CN Tower, Skytree, Taipei 101) and airports only | SENT |
| 2 | P1 | legacy-christtheredeemerrio | Christ the Redeemer | category control_tower is wrong (title often reads "Control tower"/"Skyline Dominating Icon"); use monument/world_heritage/royal_palace as fits; keep control_tower for real towers (CN Tower, Skytree, Taipei 101) and airports only | SENT |
| 2 | P1 | poi-100208 | Great Pyramid | duplicate of legacy-greatpyramidofgiza (30 m): merge; description is about tallest structure height, glued "Builtc.2600 BCover" | SENT |
| 2 | P1 | poi-100203 | Taj Mahal | description is about first ceremony in 1632, rewrite as mausoleum description; fun_fact_3 glued "whitemarbleinlaid withsemi-precious" | SENT |
| 2 | P1 | poi-100204 | Eiffel Tower | description glued "tall,about ... thetallest"; rewrite | SENT |
| 2 | P1 | poi-100212 | Athens acropolis | name -> "Acropolis of Athens"; description is about Cyclopean wall; remove Greek script from fun_fact_3; dup with wiki-101462 ACROPOLIS | SENT |
| 2 | P2 | poi-100215 | Sydney Opera | name -> "Sydney Opera House"; fun_fact_1 glued "thepremier,Joseph" | SENT |
| 2 | P3 | poi-100094 | Airports | airports (Heathrow, Changi, Dubai, Incheon, Cairo, Denver...) are control_tower: acceptable only if no airport slug exists; if one exists switch; none should exceed rare | SENT |
| 3 | P1 | poi-100064 | Grand Canyon | description starts with Devanagari "विशाल" instead of "Vast"; name duplicates poi? (lowercase duplicate "grand canyon" in names) | SENT |
| 3 | P2 | poi-100188 | Vatican Museums | description is a visitor stat; fun_fact_1 glued "display,and"; coordinates (41.9064,12.4544) ok; dup Sistine Chapel within 370 m is legit but check H3 merge | SENT |
| 3 | P2 | poi-100228 | Toledo Spain | name -> "Toledo"; description is municipality area (232.1 km2) - not descriptive; epic seems high | SENT |
| 3 | P1 | poi-100173 | Yosemite National | name truncated -> "Yosemite National Park"; description glued "Serviceand", "fourcounties" | SENT |
| 3 | P1 | poi-100918 | Borneo | coords 0.0,114.0 are island centroid (OK) but description contains IPA "/ˈbɔːrnioʊ/" and glued "thethird-largestisland"; country MY wrong (shared MY/ID/BN) | SENT |
| 3 | P2 | poi-100223 | Ephesus | description is UNESCO date only; fun_fact_1 glued "Arzawa,by Attican" | SENT |
| 3 | P2 | poi-100240 | Luxor Temple | glued "UNESCOWorld Heritage Listin 1979" | SENT |
| 3 | P2 | poi-100303 | Baalbek | description is "history dates back 11,000 years" - dubious claim, verify; duplicate legacy-baalbektemples (890 m) | SENT |
| 3 | P2 | poi-100304 | Jiuzhaigou | description is an altitude statement, rewrite | SENT |
| 3 | P2 | poi-100377 | Camp Nou | description is about 1954 construction; glued "stadium,Camp de Les Corts" | SENT |
| 3 | P2 | poi-100479 | Old Trafford | description is about Newton Heath; lat/lon have 12 decimals (53.463055555556) round to 5 | SENT |
| 3 | P2 | poi-100581 | San Siro | fun_fact_3 duplicates description ("Stadio Giuseppe Meazza,commonly known"); glued "afootballstadium" | SENT |
| 3 | P2 | poi-100774 | Sarajevo Assassination | category ancient_wonder wrong; glued "Austro-Hungarianthrone" | SENT |
| 3 | P3 | poi-100553 | Woodstock Festival | category ancient_wonder wrong; verify position (41.7,-74.88 is Bethel, correct site)  | SENT |
| 3 | P2 | poi-100360 | Yalta Conference | category ancient_wonder wrong; description is military context; glued "Poland,Romania" | SENT |
| 3 | P2 | poi-101120 | Chernobyl Disaster | category ancient_wonder wrong; lat/lon 51.38972,30.09917 ok; should be nuclear/history | SENT |
| 3 | P1 | poi-101281 | Nile Dam | name -> "Grand Ethiopian Renaissance Dam"; coords 11.21,35.09 ok (Ethiopia) but country_code SD wrong -> ET; category chokepoint wrong -> mega_dam; dup legacy-niledamnegotiationsau (Sudan coords) | SENT |
| 3 | P1 | poi-101285 | Mekong River | country TH but coords (10.19,106.75) are Vietnam delta; category chokepoint wrong -> freshwater; dup legacy-mekongrivergoldentriangle | SENT |
| 3 | P1 | poi-101304 | McArthur River | country CA but coords (-15.9,136.667) are Northern Territory, Australia -> AU; category uranium_mine wrong (zinc-lead mine; the uranium McArthur River is in Saskatchewan 57.77,-105.05) | SENT |
| 3 | P1 | poi-100313 | Vandenberg SFB | description about 5th Armored Division 1942 is irrelevant; title "Starship Launch Frontier" is false (Falcon 9/Vandenberg); rewrite | SENT |
| 3 | P1 | legacy-zimbabwehwangepowerstation | Zimbabwe Hwange Power Station | category nuclear_plant wrong: it is a coal plant (use power_plant/industry); description repeats; rarity rare too high | SENT |
| 3 | P3 | poi-100051 | Diego Garcia | country_code IO unlike others (BIOT); acceptable but confirm field convention; rarity epic ok | SENT |
| 3 | P3 | poi-100091 | Bermuda Triangle | country_code "--" ; rarity rare ok; centre (25,-71) is open sea: fine for anomaly zone but flag | SENT |
| 3 | P1 | legacy-cheyennemountainnorad | Cheyenne Mountain NORAD | duplicate of poi-100557 Cheyenne Mountain (rare, 2 km apart, coords differ): merge, use one rarity (epic) | SENT |
| 3 | P1 | strat-ghawarfield | Ghawar Field | triplicate: strat-ghawarfield (epic), legacy-ghawaroilfield (rare), same field; merge, keep epic | SENT |
| 3 | P2 | strat-tsmcfab12hsinchu | TSMC Fab 12 Hsinchu | duplicate of legacy-tsmchsinchuhq (rare, anomaly, 1.2 km); merge, category tech_giant | SENT |
| 3 | P2 | poi-100863 | Cape Canaveral | overlaps with legacy-kennedyspacecenter (rare, 12 km); description is naming trivia; decide one token or distinct roles | SENT |
| 3 | P3 | poi-100475 | Pergamon Museum | description is construction dates; museum has been closed for renovation: add note; ok rarity | SENT |
| 3 | P2 | legacy-dimonanuclearresearchcenter | Dimona Nuclear Research Center | epic with no wiki_url; add https://en.wikipedia.org/wiki/Negev_Nuclear_Research_Center | SENT |
| 3 | P3 | poi-101301 | Luxembourg City | rarity rare and offshore_haven: city is not an icon; description is Mercer survey trivia | SENT |
| 4 | P1 | wiki_extract(244) | El, Hong, Te, Al, Tate, Li, Mesa, Baja... | 244 wiki_extract tokens have truncated one-word names (first token of the title), all common + anomaly; examples: "Hong" (Hong Kong), "Te" (Te Papa/Wellington), "Alhambra", "Tate", "Euronext". Re-extract full titles or drop; no country, no title, no description | SENT |
| 4 | P1 | legacy_seed(752) | all legacy tokens | 752 legacy tokens have no title; 537 have no wiki_url; many are near-duplicates of tokens_db (list sent: Louvre, Pompeii, Hampi, Byblos, Masai Mara, Table Mountain, Cusco, Wadi Rum, Huang Shan...). Dedup by name+distance<2 km, not only same H3 r8 cell | SENT |
| 4 | P1 | anomaly(351) | category anomaly | 351 tokens (18%) are anomaly: 244 wiki_extract, 82 legacy (TSMC, ASML, Intel, Micron, Samsung chip fabs -> tech_giant), 25 tokens_db (Sahara Desert, Movile Cave -> desert/cave_system, Tunguska). Recategorise | SENT |
| 4 | P1 | tokens_db(136) | glued/scraped text | 136 tokens_db tokens have glued words, IPA, coordinates in fun facts, non-Latin scripts (16 rare, 10 epic, 3 legendary listed in batches 1-3). Run a rewrite pass: description = 1-2 own sentences | SENT |
| 4 | P1 | city(31) | cities without coordinates/with empty description | 31 city tokens have lat/lon None (Kano, Constantine, Davao, Phoenix, San Jose, composite "Guangzhou-Shenzhen"...), 15 empty descriptions; composite regions ("Southeastern Maritime Industrial Region") are not places | SENT |
| 4 | P1 | city(Nigeria) | Nigerian cities epic | Port Harcourt, Benin City, Kaduna, Maiduguri, Zaria, Jos are EPIC and Kano/Ibadan LEGENDARY while Paris/London/Tokyo are uncommon: city ranking is broken (sort/score error); recompute city rarity by population rank globally | SENT |
| 4 | P1 | rarity quotas | rarity scoring | Quota legendary 1% yields 26 tokens but 4 are countries/cities no hex; Taj/Eiffel/Pyramid/Everest/Fuji are below Camp Lemonnier, SpaceX, CIA Langley. Add manual fame override list (curated) | SENT |
| 4 | P2 | rare_fact | boilerplate | Strategic tokens use 5 boilerplate rare_fact templates (46+45+41+32+25) - not true facts. Replace or blank | SENT |
| 4 | P3 | wiki_url | percent-encoding | wiki_url contains %27/%C3%BC (valid) but names "Musee d'Orsay" should be "Musee d'Orsay -> Musee d'Orsay (Musee d Orsay)" ok; real issue: names with city suffix (Notre-Dame Paris, Toledo Spain, Colosseum Rome, Wembley Stadium London) | SENT |
| 4 | P2 | curated_tokens.csv | data governance | curated_tokens.csv has header only (0 rows): no curated_by/curated_at/notes yet. Every fix batch must add rows with curated_by, curated_at, notes; list TO VERIFY items in notes | SENT |
| 4 | P3 | image | image coverage | image is a local filename (no https URLs): 1320 tokens have none. OK if served locally; confirm path convention | SENT |
