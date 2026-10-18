# Token creator log

## 2026-10-18 batches 1-4 (125 rows, all action=update)
- Reviewer P1 items: Starbase, Berlin Wall, Borobudur, Havana, Loire, Summer Palace, Cusco, Camp Lemonnier (->rare), Bab-el-Mandeb, Grand Canyon (moved to Mather Point), Yosemite, Borneo (country ID), GERD (ET, mega_dam), Mekong Delta (VN), McArthur River (Saskatchewan coords), Vandenberg.
- World icons raised: Eiffel, Taj Mahal, Giza, Acropolis, Colosseum, Statue of Liberty, Everest, Fuji, Mecca, Great Barrier Reef, Machu Picchu, Chichen Itza, Petra, Great Wall, Angkor (legendary); Kilimanjaro, Burj Khalifa, Galapagos, Angel Falls, Niagara, Serengeti, Alhambra, Potala, Buckingham, Mont-Saint-Michel, Easter Island (epic). control_tower fixed to world_heritage / royal_palace / religious_site for monuments.
- Chip fabs anomaly -> tech_giant; strategic points got titles and facts.
- Duplicates demoted (cannot merge from CSV): poi-101284, legacy-hormuzstraitqeshmisland (now Qeshm Island), poi-100557, legacy-ghawaroilfield.
- Images: sandbox proxy returns 403 for upload.wikimedia.org and Wikipedia, so every row says IMAGE TO SOURCE (image_url empty).
## TO VERIFY
GERD and McArthur River coordinates; Intel Fab 42 / Samsung Hwaseong / TSMC Phoenix positions; Hwange power station position; Niagara position; Trilithon weight (Baalbek); Strait of Malacca Phillip Channel width; Toledo rename; Starbase incorporation 2025; Ras Tanura/others without facts.
## Not done
Kano/Ibadan city rows, country-token categories, 752 legacy tokens without title, anomaly re-categorisation (wiki_extract).

## 2026-10-18 round 2 (batches 5-7, +148 rows; CSV now has 273 rows for ~225 uids, later rows win)
- Rewrote scraped text (title, 2-sentence description, 3 facts) for ~40 rare/epic landmarks (Knossos, Newgrange, Persepolis, Hampi, Karnak, Babylon, Matterhorn, Mammoth Cave, Chernobyl, ...), 8 legacy intelligence/space tokens, 28 city tokens (Kano coords, Ibadan, Seoul replaces the metro composite, IPA/Cyrillic/Bengali removed), and the 15 top countries (category international_org -> country).
- DUPLICATE OF notes (rarity common): poi-101284, poi-100557, legacy-ghawaroilfield, legacy-niledamnegotiationsau, legacy-straitofhormuzussnavy, poi-102129, legacy-mekongdeltavietnam, legacy-dunhuangsilkroad, legacy-maasaimaranationalreserve, legacy-dolomitesunescoalps, legacy-huangshanyellowmountain, legacy-cuscohistoriccenter, legacy-toledomedievalcity, legacy-grandcanyonarizona, legacy-grandcanyon. The builder has no merge key: it should drop curated rows whose notes start with "DUPLICATE OF".
- Replaced invented boilerplate rare_fact with real facts on 45 tokens. The CSV cannot blank a field (empty = no change), so ~186 other tokens still carry the 8 boilerplate templates: blank them in the builder.
- Because the last row of a uid wins, the 'notes' of a few uids now show only the rare_fact note; earlier TO VERIFY items remain in earlier rows of the CSV.
- Still TO VERIFY: Interpol HQ point, Mossad HQ location, MSS position, Suez Authority position, Ismailia, city facts marked in notes, country wording.
- Not done: anomaly -> real categories for ~260 tokens (needs slugs desert/ocean/infrastructure that do not exist), wiki_extract fragments (builder side), creating new world icons.

## 2026-10-18 round 3 (batches 8-10, +425 rows; CSV 706 rows / ~560 uids, last row of a uid wins)
- DUPLICATE OF rows: ~25 same-place pairs (Jiuzhaigou x2, Bryce Hoodoos, McArthur legacy, Kotor legacy, Cinque Terre/Vernazza, Amalfi/Positano, Yosemite Valley, Dead Sea x2, Sahara x3, Natron, Lena, Chocolate Hills, Mariana x2, Karakum, Zhangjiajie) + 3 composite cities (Guangzhou-Shenzhen, Shanghai-Changzhou, Keihanshin) + 5 wiki duplicates + 96 unrecoverable wiki_extract fragments ("DUPLICATE OF none (fragment)").
- Lahore Fort (poi-102474) and Havana Malecon were left as distinct places (4 km / different site): TO DECIDE.
- wiki_extract fragments restored to full names with category/country/description: 68 (Chartres Cathedral, Kaieteur Falls, Aletsch Glacier, Taroko Gorge, capitals such as Windhoek...).
- Anomaly recategorised using existing slugs: orgs -> international_org, steel -> steel_mill, pharma -> pharma_hq (existing slug, closer than tech_giant), desalination -> desalination, data centre -> data_center, seed vault -> seed_vault, natural sites -> nature_sanctuary/canyon/freshwater/world_heritage, paranormal -> conspiracy. Remaining anomaly: Bermuda Triangle, Tunguska, Romania road moved to world_heritage.
- Events (Yalta, Woodstock, Chernobyl) -> world_heritage; "Toledo Spain" -> "Toledo".
- 100+ city tokens rewritten (IPA/Cyrillic/Arabic removed, plain description, country code); 21 cities got coordinates (Constantine, Davao, Phoenix, San Jose, Austin, Columbus, Charlotte, Memphis, Portland, Mesa, Arlington, Leon, Salvador, Natal, Joao Pessoa, Cordoba, Mendoza, Gold Coast, Newcastle, Darwin, Male, San Juan, Kingston) and 7 composites renamed to the core city (Hangzhou, Shantou, Shenyang, Xiamen, Busan, Islamabad, Kansas City, Ottawa).
- 24 untitled rare+ legacy tokens (capitals, oil fields, ADNOC/Aramco HQ) got titles, descriptions, wiki_url.
- Cities and wiki items have a title and description but not 3 fun facts (no verifiable per-city facts without inventing); fun facts left empty.
- TO VERIFY: country codes of restored wiki places, Jacob's Well country (set PS), Jubail category (oil_field is approximate), Euronext country.
