# HEXOD — claude.md
> Single source of truth for all AI agents. Read this FIRST before any work.
> Last updated: 2026-04-03 | Sessions: 21+ | Repo: github.com/Richie6988/terra-domini

---

## 0. MANDATORY RULES (∞ weight — never break)

**RULE 1 — NEVER LIE.** Never claim work was done if it's a shortcut/fake. If something is a placeholder, say so explicitly. Never say "fixed" if untested. *— Richard, 2026-03-30*

**RULE 2 — BRAIN FIRST.** Read this file at the START of every task. Update it in the SAME commit as code changes. No exceptions.

**RULE 4 — ZERO EMOJI.** Never use emoji characters anywhere in the UI. All icons must be original SVG designs (inline `<svg>` or DockIcon component). Use colored dots, SVG shapes, or text for indicators. *— Richard, 2026-04-03*

**RULE 3 — RICHARD'S WORK = STANDARD.** When Richard creates something (3D viewer, prototype, icon bank), it IS the quality standard. Never replace with an inferior alternative. Always integrate as primary experience.

---

## 1. PROJECT IDENTITY

| Key | Value |
|-----|-------|
| Game | HEXOD — geo-strategic multiplayer browser game |
| Tagline | *Own the World. Hex by Hex.* |
| Concept | Real-world H3 hexagonal territories become blockchain-backed NFTs on Polygon PoS |
| Repo | `github.com/Richie6988/terra-domini` (branch: `main`) |
| Owner | Richard (@Richie6988) — French, AI consulting, builds + pitches |
| Admin login | `admin@td.com` / `admin123` |
| Agent git | `user.email="agent@hexod.dev"`, `user.name="HEXOD Agent"` |

### Git Push (sandbox blocks github.com — workaround)
```bash
GIT_TERMINAL_PROMPT=0 git push origin main
```
PAT is embedded in remote URL. If push fails, check `git remote -v` for token.

### Richard's Local Setup (Windows, no Node.js)
```powershell
cd C:\Users\rgrondin\Desktop\Perso\Hexod\App\terra-domini
cd backend && .\venv\Scripts\Activate.ps1 && python manage.py runserver 0.0.0.0:8000
```
Django serves compiled frontend from `frontend/dist/`. Agent MUST build frontend before pushing.

---

## 2. TECH STACK

| Layer | Technology | Notes |
|-------|-----------|-------|
| Frontend | React 18 + TypeScript + Vite | `frontend/` dir |
| State | Zustand (persisted to localStorage) | `store/index.ts`, `store/kingdomStore.ts` |
| Map | Leaflet + h3-js v4 | ALWAYS resolution 8 |
| 3D | Three.js (via npm, not R3F for Token3D) | OrbitControls from examples/jsm |
| Animation | Framer Motion | Spring animations |
| Backend | Django 5 + DRF | `backend/` dir |
| Database | SQLite (dev) / PostgreSQL (prod) | |
| Auth | JWT (SimpleJWT) | access + refresh tokens |
| Real-time | Django Channels (WebSocket) | `ws/map/`, `ws/auction/<id>/` |
| Blockchain | Polygon PoS — Solidity (planned) | ERC-20 HEX + ERC-721 Territory |
| Email | SMTP (Mailpit dev / any provider prod) | `email_service.py` |
| Icons | 153 SVG icons in `iconBank.tsx` | 256×256 viewBox for POI, 24×24 for skill tree |

---

## 3. GAME MECHANICS — COMPLETE SPEC

### 3.1 Economy
- **Currency:** HEX Coin (◆). 1,000 = €0.99. 25% dev cut.
- **Earn:** Territory income (10-80/day), daily tasks (5-50), safari captures (100-2000), events, referrals, login streak.
- **Spend:** Shop boosters (100-800◆), events, auctions, territory purchase, customization.
- **Blockchain:** HEX = ERC-20 on Polygon. Territories = ERC-721 NFTs. Staking for yield. P2P marketplace.

### 3.2 Territory System
- **H3 Grid:** ALWAYS resolution 8 (~461m edge, ~5M cells globally). Never changes with zoom.
- **Grid visible:** zoom 14+ only. Hidden during zoom transitions. Max 500 hexes per render.
- **Hover:** zoom 12+ only.
- **Capture methods:**

| Situation | Options |
|-----------|---------|
| First territory | FREE (no constraints) |
| Unclaimed + adjacent to kingdom | Buy 50◆ OR Explore 1h × 1.2^n |
| Unclaimed + NOT adjacent | Buy 125◆ OR Explore 2h × 1.2^n |
| Enemy territory | Attack (military) |
| Rare POI without adjacency | LOCKED (need adjacent territory OR 50+ influence) |

- **Rarity:** Common → Uncommon → Rare → Epic → Legendary → Mythic
- **Biomes (9):** Urban, Rural, Forest, Mountain, Coastal, Desert, Tundra, Industrial, Landmark
- **Shiny:** 1/64 chance — sparkle effect, higher value

### 3.3 Empire → Kingdom → Territory Hierarchy
- **Empire:** 1 per player. Contains all kingdoms. Panel = EmpirePanel (3 tabs: kingdoms list, military, stats).
- **Kingdom:** Group of connected territories (auto-detected). Merged outer border on map.
- **Territory:** Single H3 res-8 hex. Can be free, owned, or enemy.
- **Skill Tree:** 6 branches × 7 tiers (Attack/Defense/Economy/Influence/Technology/Extraction)
- **Resources:** 20 types across 5 categories (extraction, processed, info, social, currency)
- **Kingdom Detail Overlay:** click badge or fill area → portal at z-1800

### 3.4 Three Daily Modes
1. **Events (📡):** News/sport events → special tokens. Luck skill. Potion de Chance.
2. **Safaris (🎯):** Track fauna/dinosaur via radar. HOT/WARM/COLD. Capture → Codex + HEX reward. **One target at a time.** Cooldown between captures (or buy "1h Continuous Safari" potion in shop).
3. **Auctions (🏪):** eBay-style bidding. Live WebSocket chat. Snipe protection (+30s). 3D preview.

### 3.5 Military (6 unit types)
Infantry (5◆, ATK 10, DEF 8) · Naval (15◆, 35, 30) · Aerial (25◆, 45, 15) · Engineer (20◆, 8, 20) · Medic (30◆, 2, 5) · Spy (100◆, 15, 3)

### 3.6 Shop (7 categories)
Boosters · Attack · Defense · Economy · Collection · Social · Customize

### 3.7 Codex = Collection Panel
9 tabs: Overview, Favorites+Museum, Disasters, Places, Nature, Conflict, Culture, Science, Fantastic. Left trigger (R key) opens.

---

## 4. UI/UX DESIGN SYSTEM

### 4.1 Theme: Light Tactical Glassmorphism
```
Background:  rgba(235, 242, 250, 0.97) + blur(30px) saturate(1.2)
Border:      1px solid rgba(0, 60, 100, 0.15)
Shadow:      0 20px 60px rgba(0,0,0,0.2)
Fonts:       Orbitron (headings), Share Tech Mono (data), system-ui (body)
Accents:     #0099cc (cyan), #cc8800 (gold), #7950f2 (purple)
```
**NO DARK THEME.** All panels use light glassmorphism. Token3DViewer is the only dark fullscreen element.

### 4.2 Z-Index Stack
```
Map Leaflet       : 1-700
Shell UI          : 900    (ticker, HUD, dock, radar)
Panels            : 1000   (GlassPanel backdrop)
Panel content     : 1001
Modals            : 1200
Radar expanded    : 1500
Kingdom overlay   : 1800
Token3DViewer     : 2000   (fullscreen, via createPortal)
```

### 4.3 Panel System
- Default: 92vw, max 960px, max 92vh (NO small hardcoded widths)
- Centered via flexbox (`inset:0, display:flex, align/justify:center`)
- One panel at a time. Spring animation (scale from 0.92).

### 4.4 Rarity Colors
Common `#94a3b8` · Uncommon `#22c55e` · Rare `#3b82f6` · Epic `#8b5cf6` · Legendary `#f59e0b` · Mythic `#ef4444`

---

## 5. TOKEN 3D VIEWER — Gold Standard

Richard's holographic 3D token viewer. Reference: `read_only_templates/token_3Dviewer_admin_overlay.html`

### 5.1 Front Face Layout (16 sections, exact from original)
1. Base #080810 + ambient catColor glow
2. Holographic rainbow overlay (6 animated color stops)
3. Metallic shimmer gradient (animated shineOffset)
4. Rarity badge (top-right hex)
5. Category label (Orbitron, metallic gradient)
6. Icon row — hex frame + inner accent ring + SVG icon from bank (data: URL)
7. Biome label
8. Real Unsplash image (9 biome URLs, crossOrigin='anonymous')
9. Title bar with LEFT/RIGHT gradient fades
10. Title text (stroke outline + gradient fill + catColor glow)
11. Side text — TIER (left rotated) + SERIAL (right rotated)
12. Description box (dark fill + metallic outer + accent inner border)
13. Description text (italic Georgia, clipped to box)
14. Vignette (radial gradient)
15. Film grain (800 particles)
16. Outer hex border (tier metal color)

### 5.2 Controls
OrbitControls: enableDamping 0.08, rotateSpeed 0.5, zoomSpeed 0.8, minDistance 4, maxDistance 15, enablePan false. Auto-rotate 0.002 rad/frame after entry.

### 5.3 Entry Animation
Scale 0→1 + rotation -π→0 with cubic easing (`1 - Math.pow(1-t, 3)`).

### 5.4 Rendering
- Texture: 1024px (perf) or 2048px (quality)
- Shimmer: +25px/frame, range -1500→3500
- Canvas redraw every 4th frame
- Image: `cardImg.onload` triggers `drawFront()` redraw
- Icon: `data:image/svg+xml;base64` URL (near-synchronous, no blob)
- Portal: `createPortal(jsx, document.body)` — z-index 2000
- Panels auto-close when Token3D opens

---

## 6. ARCHITECTURE — FILE MAP

### Frontend (`frontend/src/` — ~77 files, ~19K lines)
```
App.tsx                          — Router, auth, panel switching
pages/                           — LoginPage, RegisterPage, ForgotPassword, ResetPassword, AdminPanel
components/
  map/
    GameMap.tsx                   — Leaflet map, click/hover (ALWAYS res 8), hex grid
    HexCard.tsx                  — Territory detail → Token3DViewer (via portal)
    HexLayer.tsx                 — Grid overlay (polygonToCells, zoom 14+)
    KingdomBorderLayer.tsx       — Merged outer borders (buildOuterBorder algorithm)
    AttackAnimationLayer.tsx     — Battle visual effects
  shared/
    Token3DViewer.tsx            — Three.js holographic token (688 lines)
    GlassPanel.tsx               — Base panel container (flexbox centered)
    HexodDock.tsx                — Bottom dock (13 SVG icon buttons)
    DockIcons.tsx                — 14 SVG dock icons
    iconBank.tsx                 — 153 SVG category icons
    ClaimProgressBar.tsx         — Live countdown for explore/attack claims
    NewsTicker.tsx               — Top scrolling news banner
    RadarWidget.tsx / RadarTrigger.tsx — Safari tracking
  hud/                           — EventsPanel, CombatPanel, AuctionPanel, CodexPanel, etc.
  kingdom/
    KingdomPanel.tsx             — From dock (overview, resources, skill tree)
    KingdomDetailOverlay.tsx     — From map click (own: 3 tabs / enemy: spy+attack)
    SkillTreeView.tsx            — 6 branches × 7 tiers
  shop/ShopPanel.tsx             — 7 category tabs, 25+ items
  crypto/                        — CryptoPanel, MarketplacePanel, StakingPanel
  alliance/AlliancePanel.tsx     — Create/join, diplomacy, members
hooks/
  useGameSocket.ts               — WebSocket + REST fallback for territory data
  usePendingClaims.ts            — Polls /api/territories/pending-claims/ every 30s
store/
  index.ts                       — Zustand (player, auth, territories, panels)
  kingdomStore.ts                — Kingdom state, processDay, skill unlocks
types/
  index.ts                       — Territory, Player, WSMessage types
  kingdom.types.ts               — 20 resources, 9 biomes, 6 skill branches
```

### Backend (`backend/terra_domini/` — ~141 files)
```
apps/
  accounts/                      — Player, PlayerStats, auth views, email_service.py
  territories/
    views.py                     — claim, claim-options, pending-claims, map-view, generate, shield
    models.py                    — Territory, PendingClaim, TerritoryCluster, KingdomSkill
    cluster_views.py             — /kingdoms/, /kingdom-skill-tree/, /kingdom-unlock-skill/
    territory_engine.py          — generate_territory, rarity calculation
    kingdom_engine.py            — cluster detection, resource calculation
  websocket/
    consumers.py                 — TerritoryMapConsumer
    auction_consumer.py          — AuctionChatConsumer (chat/bid/emoji/system)
    routing.py                   — ws/map/, ws/auction/<id>/
  blockchain/                    — NFT minting, marketplace views
  alliances/                     — Alliance CRUD + diplomacy
urls.py                          — All API routes (/api/auth/*, /api/territories/*, etc.)
settings/dev.py                  — SMTP config (Mailpit/Resend/console fallback)
```

---

## 7. CRITICAL DECISIONS LOG

| Decision | Why | Date |
|----------|-----|------|
| H3 always res 8 | Variable resolution caused territories to change shape at different zoom levels | 2026-03-31 |
| Token3D via portal | Panels (z-1000) covered Token3D (z-2000) when inside GameMap stacking context | 2026-03-31 |
| OrbitControls (not manual drag) | Manual isDragging + rotationTarget had no damping, no inertia | 2026-03-31 |
| Icon via data: URL (not blob) | Blob URL async timing → icon appeared late or not at all | 2026-03-31 |
| Kingdom outer border only | Drawing each hex individually = internal borders visible = not a kingdom | 2026-03-31 |
| Grid hidden during zoom | zoomstart/zoomend: clear grid during transition to prevent wrong-size flash | 2026-03-31 |
| No Tasks in dock | Moved to bonus popup (like most games). 14→13 dock buttons | 2026-03-31 |
| Panel size 92vw/960px | Small hardcoded widths (380-480px) cut off content (especially Shop) | 2026-03-31 |
| Single click → Token3D | Was 2 clicks because hover used wrong resolution, first click didn't match | 2026-03-31 |
| Flexbox panel centering | transform:translate(-50%,-50%) was overridden by Framer Motion | 2026-03-30 |
| Empire > Kingdom > Territory | 1 player = 1 empire = N kingdoms = N×M territories | 2026-04-03 |
| Bottom dock: 10 buttons | EMPIRE/ALLIANCE/CODEX/MARKETPLACE/LADDER/EVENTS/SAFARI/AUCTIONS/SHOP/INFO | 2026-04-03 |
| Shiny = rainbow + glitter | Animated rainbow border + Pokémon holographic sparkle overlay on Token3D | 2026-04-03 |
| Boosters: 10 items, gacha | Ritual reveal: commons→bonuses→rare last. Non-tokens = shop items. | 2026-04-03 |
| Bots play for real | Claim, build kingdoms, attack. Essential for community bootstrap. | 2026-04-03 |
| Special POI on map | Thousands. Category color border + POI image bg. Viewport-only. | 2026-04-03 |
| Safari cooldown + potion | Cooldown between captures. "1h Continuous Safari" = new shop item. | 2026-04-03 |

---

## 8. ERROR PATTERNS (learned the hard way)

| ID | Pattern | Fix |
|----|---------|-----|
| EP001 | Variable H3 resolution anywhere | ALWAYS 8. Search ALL files for zoom→res mapping |
| EP002 | Token3D re-mounting (auction) | Remove onClose from useEffect deps, use useRef |
| EP003 | Panels not centered | Use flexbox (inset:0), never transform:translate |
| EP004 | h3 v3 API on v4 library | Use cell_to_latlng, is_valid_cell, grid_disk (not h3_to_geo, k_ring) |
| EP005 | Dark theme remnants | Search: rgba(0,0,0,0.8), #020205, #0f172a, color:'#fff' |
| EP006 | CATEGORIES iteration | It's a Record, not array → Object.values(CATEGORIES) |
| EP007 | Icon not rendering on Token3D | Check iconImage.complete && iconImage.src (not naturalWidth) |
| EP008 | News ticker 404 | /api/news/ticker/ must exist in urls.py |
| EP009 | Duplicate campaign check | Was called 3× in claim endpoint. Keep 1. |

---

## 9. MULTI-AGENT COORDINATION

### Agent Roles
When multiple agents work on HEXOD, each reads this file first, then:

| Role | Scope | Files |
|------|-------|-------|
| **Lead / Coordinator** | Architecture, routing, specs | claude.md, App.tsx, urls.py, store/ |
| **Frontend Agent** | React components, styling | components/*, pages/*, hooks/* |
| **Backend Agent** | Django views, models, API | apps/*, urls.py, settings/ |
| **3D / Visual Agent** | Token3DViewer, map rendering | Token3DViewer.tsx, GameMap.tsx, HexLayer.tsx |
| **Game Design Agent** | Mechanics, balance, economy | claude.md §3, kingdom.types.ts |

### Coordination Protocol
1. **Before starting:** Read claude.md fully. Check git log for recent changes.
2. **Claim scope:** State which files you'll modify. Don't touch files outside scope.
3. **No duplicate work:** Check if another agent already built what you're about to build.
4. **Build before push:** `cd frontend && npx vite build` — must succeed.
5. **Update claude.md:** Add decisions, error patterns, status changes in same commit.
6. **Conflict resolution:** claude.md is canonical. If code contradicts claude.md, fix the code.

### Build & Test Checklist
```bash
# Before every commit:
cd frontend && npx vite build        # Must pass
grep -r "res.*=.*zoom\|resolution.*zoom" src/  # Must be empty (EP001)
grep -r "rgba(0,0,0,0.8" src/        # Dark theme check (EP005)
git diff --stat                       # Review what changed
```

---

## 10. BLOCKCHAIN ARCHITECTURE

### Token: $HEX (ERC-20 on Polygon PoS)
- Hard cap: 4,842,432 HEX (= H3 res7 land cells on Earth)
- Initial supply: 0 (100% mined through gameplay — Proof of Territory)
- Halving: 1.0 → 0.5 → 0.25 → 0.1 HEX per claim

### Territory NFT: $HEXT (ERC-721)
- 1 territory = 1 NFT. tokenId = uint256(h3Index).
- 5% royalty on secondary sales (2% burn, 3% treasury).

### 8 Smart Contracts (planned)
HEXToken.sol · TerritoryNFT.sol · GameEngine.sol · KingdomRegistry.sol · Staking.sol · Marketplace.sol · Treasury.sol · LocationOracle.sol

### 7 Buy Pressure Vectors
1. Proof of Territory mining  2. Skill tree burn  3. Ad revenue buyback  4. Staking lockup  5. NFT royalties  6. LP incentives  7. Territory tax (idle 7d)

### Sell Pressure Controls
3% withdrawal fee (burned) · 24h cooldown · 30-day vesting on >10K HEX · 5% in-game APY

---

## 11. CURRENT STATUS & KNOWN ISSUES

### What Works
- [x] Login / Register / Forgot Password / **Email Verification** (full email flow with 6-digit code)
- [x] **Right-click prevention** (global contextmenu handler)
- [x] **Password eye toggle + real-time validation** (show/hide + match indicator)
- [x] **Login contrast** (all labels brightened for dark background)
- [x] **Geolocation on register** (initial_lat/lon saved from IP)
- [x] **Tutorial non-blocking** (floating pill at bottom during claim step, map fully accessible, skip button)
- [x] Map with H3 grid (always res 8, zoom 14+)
- [x] Territory click → Token3DViewer (single click, portal, fullscreen)
- [x] Claim mechanics (free / buy / explore with timer)
- [x] Kingdom border rendering (merged outer border)
- [x] Kingdom detail overlay (own: 3 tabs, enemy: spy+attack)
- [x] 153 SVG icons (POI, safari, shop, biomes, skill tree)
- [x] **10-button dock** (EMPIRE/ALLIANCE/CODEX/MARKETPLACE/LADDER/EVENTS/SAFARI/AUCTIONS/SHOP/INFO)
- [x] **Server-side favorite pins** (CRUD API, unlimited, teleport dropdown)
- [x] **InfoPanel** (game rules, 7 rule cards, contact, version)
- [x] Auction WebSocket chat (bid/chat/emoji)
- [x] Email system (8 templates, Mailpit dev)
- [x] Claim progress bars with live countdown
- [x] **Notification system** — useNotifications hook, red badges on dock, 8 event types
- [x] **EmpirePanel** — Kingdoms list / Military / Stats (3 tabs)
- [x] **ProfilePanel** — Commander / Achievements (20 badges) / Preferences (3 tabs)
- [x] **10-button dock** — EMPIRE/ALLIANCE/CODEX/MARKETPLACE/LADDER/EVENTS/SAFARI/AUCTIONS/SHOP/INFO
- [x] **Wallet simplified** — 2 tabs: Balance+explanation / Details+history
- [x] **InfoPanel** — Game rules + contact
- [x] **FavoritePins** — Server-side API, light glassmorphism theme
- [x] **Tasks floating badge** — Pulse animation on map
- [x] **Alliance enhanced** — Bonuses, chat UI (placeholder), quick actions (help/trade/attack), create/search/join/leave
- [x] **POI markers on map** — 30+ category→color, DivIcon at hex centers
- [x] **Zoom slider** — Vertical range, no +/- buttons
- [x] **Hover at all zooms** — Hex + 1 ring follows cursor everywhere
- [x] **Shiny cards** — Rainbow border + sparkle glitter on Token3D

### Sprint Progress
```
Sprint A (Auth & Foundation):    7/7   ✅ COMPLETE
Sprint B (Map & Territory):      9/9   ✅ COMPLETE
Sprint C (Core Panels):         13/13  ✅ COMPLETE
Sprint D (Social & Modes):      11/11  ✅ COMPLETE
Sprint E (Polish & Advanced):   12/12  ✅ COMPLETE
Total: 52/52 items (100%)
```

### Known Issues
- [x] ~~#11~~ Custom branded map style — DONE (Carto dark_matter + CSS hue-rotate filter)
- [x] ~~#29~~ 100 challenges — DONE (progression app: Achievement model + seed_achievements command)
- [x] ~~#30~~ Wire tasks to backend — DONE (TaskCenter uses /api/progression/daily-missions/)
- [x] ~~#37~~ Alliance WebSocket chat — DONE (AllianceChatConsumer + AllianceChatMessage model)
- [ ] Token3D icon: data:URL may not render all SVG transforms (needs per-icon testing)
- [ ] Safari/Events: mock data, backend needs real game event triggers
- [ ] Models need migration on Richard's machine (see below)

### Needs Migration + Seeding (Richard's machine)
```powershell
cd backend
.\venv\Scripts\Activate.ps1
python manage.py makemigrations accounts territories alliances progression
python manage.py migrate
python manage.py seed_achievements
python manage.py spawn_bots --count 30 --territories 15
python manage.py runserver 0.0.0.0:8000
```

### Pending Richard Decisions
- [x] ~~Globe view~~ → Full Three.js sphere, maximum quality (2026-04-03)
- [x] ~~Special territories~~ → Thousands of POIs, viewport-only, category color + POI image bg (2026-04-03)
- [x] ~~Bottom bar~~ → 10 buttons: EMPIRE/ALLIANCE/CODEX/MARKETPLACE/LADDER/EVENTS/SAFARI/AUCTIONS/SHOP/INFO (2026-04-03)
- [x] ~~Empire structure~~ → 1 player = 1 empire = N kingdoms = N×M territories (2026-04-03)
- [x] ~~Alliance~~ → ~50 members, WebSocket chat, global (no shared borders) (2026-04-03)
- [x] ~~Shiny~~ → Rainbow animated border + Pokémon-style glitter overlay (2026-04-03)
- [x] ~~Boosters~~ → 10 items, gacha, ritual reveal (common→bonus→rare), non-tokens = shop items (2026-04-03)
- [x] ~~Bots~~ → Real gameplay (claim, build, attack). Essential for launch. (2026-04-03)
- [x] ~~Pins~~ → No limit, server-side, pin icon + dropdown for teleport (2026-04-03)
- [x] ~~Safari~~ → Cooldown between captures + new shop bonus "1h continuous safari" (2026-04-03)
- [ ] Territory image database (replace generic Unsplash per biome)
- [ ] Production deployment strategy (hosting, domain, SSL)

### Project Dashboard
Full sprint plan in `DASHBOARD.md` (55 items, 5 sprints, ~210h).

---

## 12. ICON BANK INVENTORY (153 icons)

| Category | Count | Examples |
|----------|-------|---------|
| POI / Category | ~90 | earthquake, city, monument, volcano, forest, space, war... |
| Resources | 20 | res_fer, res_petrole, res_uranium, res_or, res_eau... |
| Skill Tree | 42 | atk0-5, def0-5, eco0-5, dip0-5, tech0-5, ext0-5 |
| UI | 5 | ui_combat, ui_kingdom, ui_shield, ui_trade, ui_wallet |
| Safari Targets | 11 | trex, raptor, fungus, eagle, whale, phoenix, dragon... |
| Shop/Game UI | 11 | potion, booster, luck, hex_coin, event_ticket, streak... |
| Biomes | 6 | urban, rural, coastal, tundra, industrial, landmark |

Format: 256×256 viewBox with circle bg for POI icons. 24×24 stroke-based for skill tree.

---

## 13. API ENDPOINTS (key routes)

```
POST /api/auth/register/                   — Create account
POST /api/auth/login/                      — JWT login
POST /api/auth/password-reset/             — Send reset email
POST /api/auth/password-reset-confirm/     — Set new password
GET  /api/players/me/                      — Player profile
GET  /api/territories/map-view/            — Viewport territories (always res 8)
POST /api/territories/claim/               — Claim territory (free/buy/explore)
GET  /api/territories/claim-options/       — Available claim methods + costs
GET  /api/territories/pending-claims/      — Active explorations
POST /api/territories/cancel-claim/        — Cancel exploration
POST /api/territories/generate/            — Generate territory on first click
GET  /api/territories-geo/kingdoms/        — Player's kingdoms
GET  /api/news/ticker/                     — Game news feed
WS   ws/map/?token=<jwt>                   — Real-time territory updates
WS   ws/auction/<id>/?token=<jwt>          — Auction chat/bids
```

---

*This file is the single source of truth. All agents read it. All agents update it. Code that contradicts this file is wrong.*
