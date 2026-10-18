# HEXOD — Game design north star (owner, 2026-10-18)

**Pitch:** Risk on the real world map × the Panini sticker album × MPG for office leagues.
30 minutes a day, free, no pay-to-win. You conquer real places, you fill an album of real cards,
and you brag at the coffee machine on Monday.

## Who it is for
- Office workers who play MPG / fantasy leagues: short daily sessions, a league with colleagues, weekly bragging.
- Panini album lovers and nostalgics: numbered cards, empty slots that beg to be filled, rare shiny cards, swaps.
- Risk / Clash fans: a world map, borders, attacks with timers, defending your kingdom.

## The daily 30 minutes (3 × 10)
| Moment | What you do | Systems |
|---|---|---|
| Morning (coffee) | COLLECT the stock (HEX + resources), read nudges, reinforce attacked hexes, train troops | harvest (8h cap), nudges, garrisons, training in minutes |
| Lunch | Attack a neighbour, expand (buy adjacent hex), open a booster with earned HEX, Safari hunt | combat timers 4–6h, boosters next to your kingdom, Safari |
| Evening | Live events (match, concert, summit): hold the event's hex until it ends, check the league | events on strategic POIs, ladder/league |
Missing a window costs you (stock full, hex lost, event missed) → FOMO without paying.

## One world, three card families (one database: data/hexod_db)
Every card is real data from HEXOD_MASTER_DB.xlsx and has a number in the album.
1. **Place cards** (1,745 POIs on the map + countries in the codex): landmarks, cities, and every
   **strategic point** of the globe (Pentagon, dams, straits, canals, ports, launch sites, nuclear plants,
   data hubs). Owning the hex = owning the card. Rarity = visitors + geopolitical weight + uniqueness.
2. **Nature cards** (4,401 creatures: animals, dinosaurs/fossils, insects, plants, fungi, microbes):
   caught in the **Safari** near you, rarity-weighted. They fill the album, never the map.
3. **World cards**: 222 **biome regions** (unlocked by owning one hex there) and 34 **resources**
   (produced daily by your territories, collected with the harvest).

## Economy (balance.py is the single source)
- HEX earned by playing: harvest, missions, streak, Safari, events, battles.
- HEX bought in the shop: **1 € = 1,000 HEX = 1 HEX Coin**, straight from the shop (card, Stripe).
  Bought HEX buys deterministic things (territories, troops, boosts). Never random packs, never cash-out.
- Crypto (HEX Coin on Polygon) runs in the background: earned HEX can be cashed out at the same peg (5% burn).
- Paying saves time, never wins: shop boosts are capped at +25%.

## Events = the real world's calendar on the map
Sports (finals, derbies, Grand Prix), music (festivals, stadium tours), geopolitics (summits, crises on
straits/canals), science/space (launches). Each event is pinned to a real POI hex and its category:
- during the event, the hex produces ×3 and is a contested objective (attack timers shortened);
- whoever holds it when the event ends gets the bounty and the event card (album).
No invented news: events come from real sources/calendars only (RULE 1).

## Leagues (MPG-style, next)
Private league with a code (colleagues, friends), weekly season Monday→Sunday: points for hexes held,
events won, album progress. Weekly podium + reset of the league table (not of the empire).

## Album (Panini)
Codex = album: pages per family/category, numbered slots (#001…), empty slots show the silhouette and the
number, shiny variants, completion % per page, page rewards. Duplicates (boosters, Safari) → swaps
between players (marketplace / league).
