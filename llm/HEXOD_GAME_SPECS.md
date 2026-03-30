# HEXOD — Game Mechanics Specification v2.0
> Last updated: 2026-03-30 | Author: Richard + Agent | Status: AUTHORITATIVE

---

## 1. CORE CONCEPT

HEXOD is a **geo-strategic multiplayer browser game** where real-world hexagonal territories (H3 grid) become blockchain-backed NFTs. Players explore, capture, build kingdoms, trade, and compete on a real-world map.

**Tagline:** *Own the World. Hex by Hex.*

---

## 2. ECONOMY

### 2.1 Currency: HEX Coin (◆)
- **Purchase:** 1,000 HEX Coins = €0.99
- **Developer cut:** 25% of all purchases
- **Backing:** Remaining 75% backs 1 HEX token in player's crypto wallet
- **Visual:** CrystalIcon SVG component (hexagonal purple gem)

### 2.2 Earn HEX Coins
| Source | Amount | Frequency |
|--------|--------|-----------|
| Territory income | 10-80/day per territory | Daily auto |
| Daily tasks | 5-50 per task | Daily |
| Safari captures | 100-2000 per capture | On capture |
| Event wins | 25-500 per event | Per event |
| Referrals | 100 per friend at LVL 5 | One-time |
| Login streak | 10 + multiplier | Daily |

### 2.3 Spend HEX Coins
| Use | Cost Range |
|-----|-----------|
| Shop boosters (attack, defense, economy) | 100-800 ◆ |
| Event registration | 0-150 ◆ |
| Auction bidding | Variable |
| Territory purchase (after first free) | 50 ◆ |
| Customization (avatars, flags, colors) | 100-500 ◆ |

### 2.4 Blockchain Layer (Polygon PoS)
- **HEX Token:** ERC-20 on Polygon
- **Territory NFTs:** ERC-721, each territory = unique NFT
- **Staking:** Lock territories for passive HEX yield
- **Marketplace:** P2P territory trading with HEX Coin

---

## 3. THREE DAILY GAME MODES

### 3.1 EVENTS (📡)
News, sport, and world events create **unique special tokens**.

**Flow:**
1. Events appear in Live tab with countdown
2. Player registers (costs HEX Coins)
3. **Luck skill** determines loot tier (base + potion bonus)
4. Event ends → token revealed (rarity based on luck)
5. Won token can be **placed adjacent** to captured territories

**Event Types:**
- 🌋 Natural disasters (volcanic eruption, tsunami, earthquake)
- ⚽ Sports (Champions League, World Cup, Olympics)
- 🚀 Science/Space (launches, eclipses, discoveries)
- 🎭 Culture (festivals, biennales, ceremonies)
- ☢ Historical (memorials, anniversaries)

**Luck System:**
- Base luck: 0-100 (levels up with play)
- Potion de Chance: +15 luck for 48h (buy in Shop)
- Higher luck = higher rarity tier probability

### 3.2 SAFARIS (🎯)
Random fauna/dinosaur missions on tokens **not yet in the Codex**.

**Flow:**
1. Safari spawns random target (fauna, dinosaur, fantastic creature)
2. Hex grid cell **lights up** — visible ONLY to this player
3. Player uses **Radar** + clue hints to track target
4. Radar shows: distance (meters), direction, HOT/WARM/COLD indicator
5. Within 50m → DEEP SCAN available → exact hex revealed
6. Capture → token added to Codex, HEX reward

**Safari Targets (examples):**
- 🦖 Tyrannosaurus Rex (legendary, 1000 ◆)
- 🦅 Giant Golden Eagle (epic, 400 ◆)
- 🍄 Bioluminescent Fungus (rare, 150 ◆)
- 🐋 Blue Whale Migration (legendary, 800 ◆)
- 🔥 Phoenix Egg (mythic, 2000 ◆)

**Daily Challenges:**
- "Capture 5 Fungus species" → 100 ◆ bonus
- "Capture 3 Rare Dinosaurs" → 300 ◆ bonus
- "Track a target within 100m" → 50 ◆ bonus

**Radar Integration:**
- Small radar (100×100) shows safari blip + heat/distance
- Click to expand (280×280) with detailed tracking panel
- Dedicated pulsing gold blip for active safari target

### 3.3 AUCTIONS (🏪)
eBay-style bidding for **rare++ unique edition** tokens.

**Flow:**
1. Rare/Legendary/Mythic tokens listed for auction
2. Players bid with HEX Coins
3. Live chat during auction
4. Countdown timer with snipe protection (+30s on last-minute bids)
5. Winner receives unique token (serial #1/1)

**Auction Features:**
- Current bid + bid count + top bidder display
- Quick bid buttons (+10%, +25%, +50%, custom)
- Live chat with emoji reactions
- 3D token preview via Token3DViewer
- Bidding history with timestamps

---

## 4. TERRITORY SYSTEM

### 4.1 H3 Hex Grid
- Resolution 8 (default) — ~461m edge length
- Resolution scales with zoom: z10→res6, z12→res7, z14→res8, z15→res9, z16→res10
- Real-world coordinates via H3 library

### 4.2 Territory Capture
| Method | Condition | Cost |
|--------|-----------|------|
| Free claim | First territory only | 0 ◆ |
| Purchase | Adjacent to owned territory | 50 ◆ |
| Attack | Enemy territory, requires army | Army units |
| Event/Safari placement | Adjacent to owned, from won tokens | 0 ◆ |

### 4.3 Territory Properties
- **Rarity:** Common → Uncommon → Rare → Epic → Legendary → Mythic
- **Biome:** Urban, Rural, Forest, Mountain, Coastal, Desert, Tundra, Industrial, Landmark
- **POI data:** Name, description, visitors/year, geo score, fun fact, category
- **Income:** HEX Coins/day based on rarity + biome + buildings
- **Shiny:** 1/64 chance — sparkle effect, higher value

### 4.4 Rarity Visual System
| Rarity | Color | Map Effect |
|--------|-------|-----------|
| Common | #94a3b8 | Subtle fill |
| Uncommon | #22c55e | Light glow |
| Rare | #3b82f6 | Blue glow |
| Epic | #8b5cf6 | Purple pulse |
| Legendary | #f59e0b | Gold pulse + particles |
| Mythic | #ef4444 | Pink/red aurora + heavy glow |

---

## 5. KINGDOM SYSTEM

### 5.1 Structure
- Group of connected territories = Kingdom
- Each kingdom has: name, color, shield, resource allocation
- 9 biomes × 20 resource types

### 5.2 Skill Tree (6 branches × 7 tiers)
| Branch | Gem | Focus |
|--------|-----|-------|
| Attack | Ruby | Military dominance |
| Defense | Sapphire | Fortification |
| Economy | Topaz | Resource optimization |
| Influence | Emerald | Soft power |
| Technology | Amethyst | Innovation |
| Extraction | Amber | Deep mining |

### 5.3 Conquest Methods
1. **Military:** Army units attack + defend
2. **Influence:** Soft power takeover (slower, cheaper)
3. **Purchase:** Direct HEX Coin payment

---

## 6. MILITARY / COMBAT

### 6.1 Unit Types
| Unit | Cost (◆) | ATK | DEF | Role |
|------|----------|-----|-----|------|
| Infantry | 5 | 10 | 8 | Frontline |
| Naval | 15 | 35 | 30 | Sea control |
| Aerial | 25 | 45 | 15 | Air superiority |
| Engineer | 20 | 8 | 20 | Fortification |
| Medic | 30 | 2 | 5 | Healing |
| Spy | 100 | 15 | 3 | Intelligence |

### 6.2 5-Tab Structure
1. **Recruit** — Purchase units with HEX Coins
2. **Train** — Queue batches (resource cost + time)
3. **Deploy** — Assign units to kingdoms
4. **War Room** — Active battles, defense status, reinforcements
5. **History** — Past battles, stats, win/loss record

---

## 7. SHOP

### 7.1 Categories (7 tabs)
| Category | Items | Color |
|----------|-------|-------|
| 🎁 Boosters | Standard/Rare/Legendary packs | #cc8800 |
| ⚔ Attack | 2X Mint Speed, Distant Territory, 2X Army, Blitz Mode | #dc2626 |
| 🛡 Defense | 72H Shield, 2X Defense, Anti-Nuke, Influence Resist | #3b82f6 |
| ⛏ Economy | 2X Extraction, Energy Efficiency, Rare Drop, Trade Advantage | #cc8800 |
| 🎴 Collection | +Card Rarity, +Event Prob, Safari Hints, Luck Booster | #22c55e |
| 🎭 Social | Global Message, Extended Vision, Brag Mode, VIP Access | #a855f7 |
| 🎨 Customize | Avatar Skins, Flag & Emblem, Kingdom Colors, Media Embed, Live Stream | #ec4899 |

---

## 8. CODEX / COLLECTION

### 8.1 Structure (9 tabs)
The Codex IS the collection panel. Filters are INSIDE the Codex.

| Tab | Content |
|-----|---------|
| Overview | Global progress, category breakdown grid |
| ⭐ Favorites | Top 5 tokens + 3D Museum |
| 🔥 Disasters | Earthquakes, volcanoes, tsunamis, nuclear |
| 🏛 Places | Monuments, cities, temples, bridges |
| 🌲 Nature | Mountains, oceans, forests, lakes |
| ⚔ Conflict | Historic battles, military |
| 🎭 Culture | Festivals, sports, music, food |
| 🔬 Science | Space, tech, labs, energy |
| 🐉 Fantastic | Dragons, mythic, alien, dinosaurs |

### 8.2 Token Interaction
- Click token → 3D view (Token3DViewer)
- Marketplace button → list for sale
- Place button → place adjacent to territory (if from Event/Safari)

---

## 9. TOKEN 3D VIEWER

Richard's holographic 3D token viewer is THE primary territory interaction.

### 9.1 Click Territory Flow
1. Click hex on map → Token3DViewer opens fullscreen (z-index 2000)
2. All other panels auto-close
3. Holographic hexagonal token rotates with drag
4. Bottom info bar: territory name, rarity, income, action button
5. ESC or ✕ to close

### 9.2 Token Face Rendering
- **Front:** Holographic rainbow gradient, metallic shimmer, biome texture,
  SVG icon from icon bank, rarity badge, token name, stats
- **Back:** Carbon fiber pattern, tier metal center, HEXOD branding
- **4 tiers:** Bronze, Silver, Gold, Emerald

### 9.3 Technical
- Three.js r128: CylinderGeometry (hexagonal, 6 sides)
- MeshPhysicalMaterial: clearcoat, metalness, emissive
- Canvas 2D textures: procedural biome + SVG icon overlay
- SVG icons: blob→Image approach (handles all transforms)

---

## 10. UI / UX DESIGN SYSTEM

### 10.1 Theme: Light Tactical Glassmorphism
- Background: `rgba(235, 242, 250, 0.97)` + `blur(30px)`
- Border: `1px solid rgba(0, 60, 100, 0.15)`
- Font: Orbitron (headings), Share Tech Mono (data), system-ui (body)
- Accent: `#0099cc` (cyan), `#cc8800` (gold), `#7950f2` (purple)
- Shadow: `0 20px 60px rgba(0,0,0,0.2)`

### 10.2 Panel System
- Centered on screen, 80% width, max 720px
- Backdrop blur click-to-close + ✕ button
- One panel open at a time
- Spring animation (scale-in from 0.92)

### 10.3 Z-Index Stack
```
Map Leaflet    : z-index 1-700
Shell UI       : z-index 900  (ticker, HUD, dock, radar, sound)
Panels         : z-index 1000 (GlassPanel backdrop)
Panel content  : z-index 1001 (GlassPanel body)
Modals         : z-index 1200 (Modal, SubModal)
Radar expanded : z-index 1500
Token3DViewer  : z-index 2000 (fullscreen)
```

### 10.4 Map
- Default: Paris (48.8566, 2.3522), zoom 13
- Tiles: Carto Voyager (light, default)
- Hex grid: visible from zoom 10, blue tint, resolution adapts
- Controls: light glassmorphism (no dark elements)

---

## 11. DAILY ENGAGEMENT LOOP

### Task Center (📋)
5 daily tasks reset at 00:00 UTC:
1. ✅ Verify Humanity (+5 ◆)
2. 📷 Enrich Territory (+15 ◆)
3. 🔍 Moderation Duty (+25 ◆)
4. ⭐ Content Creator (+50 ◆)
5. 🔥 Login Streak (+10 ◆ × multiplier)

**Referral System:** Share link → both earn 100 ◆ at friend's LVL 5.

---

## 12. ALLIANCE SYSTEM

- Create/join alliances
- Shared territory borders
- Alliance wars
- Resource sharing
- Leaderboard (alliance ranking)

---

## 13. TECH STACK

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + TypeScript + Vite |
| State | Zustand |
| Map | Leaflet + H3 |
| 3D | Three.js r128 |
| Animation | Framer Motion |
| Backend | Django 5 + DRF |
| Database | SQLite (dev) / PostgreSQL (prod) |
| Blockchain | Polygon PoS — Solidity contracts |
| Auth | JWT (SimpleJWT) |
| Real-time | Django Channels (WebSocket) |
