# HEXOD — claude.md v5.0

> Single source of truth for all AI agents. Read this FIRST before any work.
> Last updated: 2026-04-19 | Repo: github.com/Richie6988/terra-domini

---

## 0. MANDATORY RULES (∞ weight — never break)

**RULE 1 — NEVER LIE.** Never claim work was done if it's a shortcut/fake. If something is a placeholder, say so explicitly. Never say "fixed" if untested end-to-end. Never invent API responses or fake backend data to make the frontend look alive. *— Richard, 2026-03-30*

**RULE 2 — BRAIN FIRST.** Read this file at the START of every session. Update it in the SAME commit as code changes when learning something new. No exceptions.

**RULE 3 — RICHARD'S WORK = STANDARD.** When Richard creates something (3D viewer, prototype, icon bank, mockup image), it IS the quality standard. Never replace with an inferior alternative. Reference images in chat = non-negotiable target.

**RULE 4 — ZERO EMOJI IN UI.** Never use emoji characters in React components. Only exception: `iconBank.tsx`, `emojiIcons.tsx`, `hexodTokenFace.ts`, `hexodToken3D.ts` (icon mapping files). All UI indicators must be inline SVG via `<IconSVG id="..."/>` or `<EmojiIcon emoji="..."/>` (which accepts iconBank IDs).

**RULE 5 — PLAY THE GAME BEFORE DECLARING DONE.** Before claiming a feature works, simulate the full user flow: claim a hex → check EmpirePanel updates → check KingdomBorderLayer renders correctly → check Codex reflects new token. If any step breaks, the feature is NOT done.

**RULE 6 — RICHARD RUNS WINDOWS + SQLITE + NO NODE.** He cannot run `npm`, `npx`, or `vite build`. The agent MUST build `frontend/dist/` before every push. Never commit without running `npx vite build`. He runs Django from PowerShell and sees every 500 and 404.

**RULE 7 — EVERY FACTUAL CLAIM MUST BE TRACEABLE.** "Fixed the border bug" → must say WHICH function, WHICH line, WHICH root cause.

---

## 1. PROJECT IDENTITY

| Key | Value |
|-----|-------|
| Game | HEXOD — geo-strategic multiplayer browser game |
| Tagline | *Own the World. Hex by Hex.* |
| Concept | Real-world H3 hex territories → NFTs on Polygon PoS |
| Repo | `github.com/Richie6988/terra-domini` (branch: `main`) |
| Owner | Richard Grondin (@Richie6988) — French, AI consulting, ambitious |
| Admin login | `admin@td.com` / `admin123` (is_staff=True) |
| Agent git identity | `user.email="agent@hexod.dev"`, `user.name="HEXOD Agent"` |

### Git Push from Agent Sandbox
```bash
GIT_TERMINAL_PROMPT=0 git push origin main
```
PAT is embedded in `git remote -v`. If push fails, re-add token.

### Richard's Windows Setup
```powershell
cd C:\Users\rgrondin\Desktop\Perso\Hexod\App\terra-domini
cd backend
.\venv\Scripts\Activate.ps1
python manage.py runserver 0.0.0.0:8000
```
Django serves compiled frontend from `frontend/dist/`. **Agent MUST `npx vite build` before every push.**

---

## 2. CRITICAL SETUP — RUN AFTER EVERY `git pull`

```powershell
python manage.py migrate        # creates training_queue + news_events tables
python manage.py seed_bots --reset --count 20 --claim 5   # 20 bots + 100 territories + Hexod Founders alliance
python manage.py fetch_news --demo   # or --daily --api-key KEY for real news
python manage.py runserver 0.0.0.0:8000
```

**Without `migrate`: `/api/combat/my-army/`, `/api/events/news/`, `/api/marketplace/listings/?type=auction` all return 500.**

**Without `seed_bots`: ladder empty, no alliances visible, map has no enemy hexes.**

---

## 3. TECH STACK

| Layer | Technology | Notes |
|-------|-----------|-------|
| Frontend | React 18 + TypeScript + Vite | `frontend/` |
| State | Zustand (persisted to localStorage) | `store/index.ts`, `store/kingdomStore.ts` |
| Server state | TanStack Query v5 | `['wallet']`, `['kingdoms']`, `['my-army']`, etc. |
| Map | Leaflet + h3-js v4 | ALWAYS resolution 8 |
| 3D | Three.js r128 (raw, not R3F) | `hexodToken3D.ts`, `LoadingGlobe.tsx` |
| Animation | Framer Motion | Panel slide-ins, card fans |
| Icons | 153 SVG icons in `iconBank.tsx` | `<IconSVG id="hex_coin" size={12} />` |
| Backend | Django 5 + DRF | `backend/` |
| DB | SQLite (dev) / PostgreSQL (prod) | |
| Auth | JWT SimpleJWT | access + refresh, 24h/30d lifetimes |
| Real-time | Django Channels | `ws/map/`, `ws/auction/<id>/` |
| Blockchain | Polygon PoS (planned) | HEX ERC-20, Territory ERC-721 |

---

## 4. ARCHITECTURE — KINGDOM BORDERS (MOST-BROKEN FEATURE)

### Two-layer architecture — DO NOT confuse
```
KingdomBorderLayer (outer border only)
    ↓
HexLayer (individual hex fills)
    ↓
Leaflet base map
```

- **HexLayer** draws per-hex FILL. For owned hexes: `stroke: 'transparent', weight: 0` — NEVER per-hex borders on owned territories.
- **KingdomBorderLayer** draws ONE merged outer polyline per kingdom cluster. For kingdoms with 2+ territories: `buildOuterBorder(h3Indexes)` returns chains of `[lat,lng]` segments.
- **Inner hex edges (between two adjacent owned hexes) must NOT be drawn.** If you see per-hex green borders on every owned hex, the bug is in HexLayer `isOwn` branch (line ~176), not KingdomBorderLayer.

### The `buildOuterBorder` algorithm
`gridDisk(hx, 1)` returns neighbors in a ring order that **does NOT match** `cellToBoundary(hx)` edge order. `neighbors[i]` is NOT guaranteed to be the neighbor across edge `i`. DON'T use gridDisk for edge-neighbor mapping.

**Correct approach:** For each hex, for each of 6 edges, compute edge midpoint, nudge it OUTWARD from hex center by 30%, then `latLngToCell(nudgedLat, nudgedLon, res=8)`. If the resulting cell is NOT in cluster → edge is outer.

### Kingdom data flow
```
Backend: recompute_kingdoms(player) → flood-fill owned H3 cells →
         clusters sorted by size → main kingdom = largest
    ↓
GET /api/territories-geo/kingdoms/ →
    { kingdoms: [{ cluster_id, size, is_main, tier, tdc_per_24h,
                   h3_indexes[], centroid_lat, centroid_lon }] }
    ↓
Frontend useQuery(['kingdoms', player.id])
    ↓
KingdomBorderLayer (renders on map) +
KingdomPanel (auto-syncs to local kingdomStore via createKingdom)
```

**Gotcha:** After claim, `invalidateQueries(['kingdoms'])` is MANDATORY or the map won't redraw borders.

---

## 5. COMMON BUG CATALOG (CRITICAL READING)

### Bug class 1 — Invisible text/borders (color `rgba(255,255,255,0.04)`)
**Cause:** Overly-aggressive sweep replaced backgrounds `rgba(255,255,255,0.4)` AND text `color:` properties with `0.04` (4% opacity = invisible).
**Detection:**
```bash
grep -rn "color.*rgba(255,255,255,0.04)" frontend/src/components/ --include="*.tsx"
```
**Fix:** Text colors for muted labels should be `rgba(255,255,255,0.3)` to `rgba(255,255,255,0.5)`. Backgrounds on dark cards can use `rgba(255,255,255,0.03)` to `rgba(255,255,255,0.06)`.

### Bug class 2 — `TypeError: Cannot read properties of undefined (reading 'toUpperCase')`
**Cause:** `thing.name.toUpperCase()` when thing is partially-spread or API returned object missing expected fields.
**Fix:** `(thing.name || '').toUpperCase()` everywhere. Applies to `.name`, `.rarity`, `.category`, `.label`, `.type`.

### Bug class 3 — Double `/api/` prefix
**Cause:** `api` axios instance has `baseURL: '/api'` already. Calling `api.get('/api/solana/staking/')` produces `/api/api/solana/staking/` → 404.
**Detection:**
```bash
grep -rn "api\\.\\(get\\|post\\)(\\'/api/" frontend/src/
```
**Fix:** Always `api.get('/solana/staking/')` — no `/api/` prefix in arg.

### Bug class 4 — 500 errors from missing migrations
**Symptoms:**
- `no such table: training_queue` → `/api/combat/my-army/` 500
- `no such table: news_events` → `/api/events/news/` 500
**Cause:** Models exist but migration files not generated.
**Fix:** Create migration in `backend/terra_domini/apps/<app>/migrations/0002_<n>.py` matching model fields. DB table name from `Meta.db_table`.

### Bug class 5 — Close buttons invisible
**Cause:** Historical sweep set close `color: rgba(255,255,255,0.04)` (invisible) or used light-theme color like `rgba(26,42,58,0.45)` (too dark on dark bg).
**Fix:** Close buttons should be `color: 'rgba(255,255,255,0.6)'` with hover → `#ffffff`. Background NONE. No border. Size 32-36px. Font size 22-28px. Minimal × character.

### Bug class 6 — Local store vs API state out-of-sync
**Cause:** Panel reads from `useStore.getState().territories` (non-reactive, one-shot) OR from local `useKingdomStore` (persisted but not auto-synced from API).
**Fix:**
- For reactive data display: use `useQuery` hooks.
- For local-state panels like KingdomPanel: on mount, useQuery API data + `useEffect` to sync missing entries into local store via `createKingdom()`.

### Bug class 7 — Mock data default states
**Anti-pattern:** `useState<Auction[]>(MOCK_AUCTIONS)` — panel always shows fake data even if API works.
**Correct:** `useState<Auction[]>([])`, `useQuery` sets real data via `setAuctions(data)` when it arrives.

### Bug class 8 — CrystalIcon lingering references
**Cause:** CrystalIcon component was replaced by IconSVG but old imports never purged.
**Detection:** `grep -rn CrystalIcon frontend/src/` should return 0.
**Replacement:** `<IconSVG id="hex_coin" size={12} />` (small), `size={16}` (medium), `size={20}` (large).

---

## 6. ENDPOINT MAP (VERIFIED WORKING)

### Player / wallet
- `GET /api/players/me/` — current player info
- `GET /api/players/wallet/` — HEX balance breakdown
- `GET /api/wallet/me/` — same as above
- `POST /api/wallet/withdraw/` — withdraw to Polygon
- `POST /api/wallet/convert/` — in-game ↔ crypto

### Territories
- `GET /api/territories/map-view/?lat=&lon=&radius_km=` — map viewport hexes
- `POST /api/territories/claim/` — claim a hex
- `POST /api/territories/customize/` — set name/color/embed
- `GET /api/territories-geo/kingdoms/` — all kingdoms for player
- `GET /api/territories-geo/mine/` — player's owned territories
- `GET /api/territories-geo/overlay/` — active map events

### Combat / Military
- `GET /api/combat/my-army/` — **REQUIRES `training_queue` table**
- `POST /api/combat/recruit/` — train units
- `POST /api/combat/attack/` — launch attack
- `POST /api/combat/collect/` — collect trained units

### Events
- `GET /api/events/active/` — currently live events
- `GET /api/events/news/` — **REQUIRES `news_events` table**

### Safari
- `GET /api/safari/active/` — current target
- `POST /api/safari/spawn/` — request new target
- `POST /api/safari/capture/` — attempt capture

### Shop / Staking
- `GET /api/shop/catalog/`, `POST /api/shop/purchase/`
- `GET /api/solana/staking/` — NOT `/api/api/...` (double prefix bug)

### Alliances / Marketplace / GM
- `GET /api/alliances/`, `POST /api/alliances/create/`
- `GET /api/marketplace/listings/?type=auction`
- `GET /api/gm/dashboard/` (is_staff only)

---

## 7. STORE STRUCTURE

### `store/index.ts` — main Zustand
```typescript
interface AppState {
  isAuthenticated, accessToken, refreshToken
  player: Player | null
  balance: TDCBalance | null      // { in_game, crypto, tdi_usd_value }
  activePanel: PanelId | null
  territories: Record<h3, TerritoryLight>
  myTerritories: Set<h3>
  godMode: boolean
  toggleGodMode()
  pickingFavorite: boolean
  setPickingFavorite(v)
}
```

### `store/kingdomStore.ts` — Kingdom domain
```typescript
interface KingdomStore {
  kingdoms: Kingdom[]
  activeKingdomId: string | null
  createKingdom(name, color, capitalHex, center) → Kingdom
  // ...skill tree state, resource allocations
}
```

**Critical:** `kingdomStore` is LOCAL + PERSISTED. Backend is source of truth via `/api/territories-geo/kingdoms/`. KingdomPanel auto-syncs on mount.

---

## 8. COMPONENT CATALOG

| Component | File | Purpose |
|-----------|------|---------|
| `GameMap` | `components/map/GameMap.tsx` | Leaflet map + hex click handler |
| `HexLayer` | `components/map/HexLayer.tsx` | Renders hex FILLS (not borders) |
| `KingdomBorderLayer` | `components/map/KingdomBorderLayer.tsx` | Merged kingdom OUTER borders |
| `FavoritePins` | `components/map/FavoritePins.tsx` | Saved locations + pick mode |
| `HexodTopHUD` | `components/shared/HexodTopHUD.tsx` | Top bar (avatar + balance + god mode) |
| `HexodDock` | `components/shared/HexodDock.tsx` | Bottom panel launcher |
| `RadarWidget` | `components/shared/RadarWidget.tsx` | Map radar with interactive blips |
| `GlassPanel` | `components/shared/GlassPanel.tsx` | Standard panel wrapper |
| `LoadingGlobe` | `components/shared/LoadingGlobe.tsx` | 3D earth intro (r128) |
| `Token3DViewer` | `components/shared/Token3DViewer.tsx` | NFT 3D card |
| `KingdomPanel` | `components/kingdom/KingdomPanel.tsx` | Kingdom mgmt (Overview + Customization) |
| `EmpirePanel` | `components/kingdom/EmpirePanel.tsx` | High-level empire (Kingdoms/Military/Stats) |
| `CombatPanel` | `components/hud/CombatPanel.tsx` | Full military screen |
| `AuctionPanel` | `components/hud/AuctionPanel.tsx` | Auction house |
| `EventsPanel` | `components/hud/EventsPanel.tsx` | News events |
| `DailyHuntPanel` | `components/hud/DailyHuntPanel.tsx` | Safari mode |
| `CodexPanel` | `components/hud/CodexPanel.tsx` | Token collection (flat 57) |
| `CryptoPanel` | `components/crypto/CryptoPanel.tsx` | Wallet (no staking UI) |
| `ShopPanel` | `components/shop/ShopPanel.tsx` | In-game shop |
| `AdminPanel` | `pages/AdminPanel.tsx` | GM tools at `/gm` route |

---

## 9. FRONTEND DESIGN RULES

### Colors (ALL dark theme)
- Page bg: `#060e1a` (deep navy)
- Panel bg: `rgba(13,27,42,0.97)` with `backdrop-filter: blur(20px)`
- Card bg on panels: `rgba(255,255,255,0.03)` to `0.06`
- Text primary: `#e2e8f0`
- Text secondary: `rgba(255,255,255,0.4)` to `0.5`
- Text muted: `rgba(255,255,255,0.25)` to `0.3`
- **NEVER use `rgba(255,255,255,0.04)` for text** (invisible)
- **NEVER use `#1a2a3a`, `rgba(0,60,100,...)`, `rgba(235,242,250,...)`** (light theme leaks)

### Accent colors (per panel)
- Empire/Kingdom: `#cc8800` (gold)
- Alliance: `#3b82f6` (blue)
- Codex: `#7950f2` (purple)
- Events/Safari: `#f97316` (orange)
- Auction: `#f59e0b` (amber)
- Shop: `#fbbf24` (yellow)
- Combat/Attack: `#dc2626` (red)
- Wallet: `#a855f7` (violet)
- Ladder: `#8b5cf6` (purple)

### Rarity colors
```typescript
const RARITY_COLORS = {
  common:'#94a3b8', uncommon:'#22c55e', rare:'#3b82f6',
  epic:'#8b5cf6', legendary:'#f59e0b', mythic:'#ef4444',
}
```

### Tier colors (TOKEN 3D)
`BRONZE=#cd7f32`, `SILVER=#c0c0c0`, `GOLD=#ffd700`, `EMERALD=#50c878`, `DIAMOND=#b9f2ff` (shiny)

### Fonts
- Headers / labels: `'Orbitron', system-ui, sans-serif`
- Numbers / stats: `'Share Tech Mono', monospace`
- Body: `system-ui`

### Button classes (`btn-game` CSS)
`btn-game-green` | `btn-game-red` | `btn-game-gold` | `btn-game-blue` | `btn-game-purple` | `btn-game-glass`

### Close buttons (STANDARD)
```tsx
<button onClick={onClose} style={{
  background: 'none', border: 'none',
  width: 32, height: 32,
  color: 'rgba(255,255,255,0.6)',
  fontSize: 22, fontWeight: 400, cursor: 'pointer',
}}>×</button>
```

### Icons — always use iconBank
```tsx
import { IconSVG } from '../shared/iconBank'
<IconSVG id="hex_coin" size={12} />
```

---

## 10. BACKEND MODELS

### `Player` (accounts)
- `tdc_in_game: float` — HEX Coin balance
- `commander_rank: int`
- `avatar_emoji, avatar_color: str` — iconBank ID + hex color
- `is_staff: bool` — god mode + /gm access

### `Territory` (territories)
- `h3_index: str` (unique), `h3_resolution: int` (=8)
- `owner: FK Player (nullable)`
- `center_lat, center_lon: float`
- `territory_type, rarity: str`
- `tdc_per_day: float`, `defense_tier: int`

### `TerritoryCustomization`
- `territory: OneToOne`
- `display_name, flag_emoji, border_color, fill_color: str`
- `embed_type: str` (none|image|video|livestream|chat|metaverse|ad_slot)
- `unlocked_tier: int` (3 hex=tier1, 6=tier2, ...)

### `TrainingQueue` — **NEW in migration 0002**
- `player, unit_type, quantity, started_at, completes_at, collected`
- `db_table = 'training_queue'`

### `NewsEvent` — **NEW in migration 0002**
- `source_url, headline, summary, location_name, lat/lon`
- `hexod_category, rarity, status, hex_reward`
- `db_table = 'news_events'`

### `Alliance`
- `tag, name, leader, tier, banner_color, banner_symbol`
- `treasury_energy, treasury_food, treasury_credits, treasury_materials`
- **DOES NOT HAVE:** `treasury_tdc`, `member_count` (computed via AllianceMember)

---

## 11. TESTING PROTOCOL (MANDATORY BEFORE "DONE")

### Pre-commit checklist
```bash
cd frontend
npx tsc --noEmit 2>&1 | grep -v "baseUrl" | grep "error"   # must be empty
npx vite build                                             # must succeed
```

### Metrics to verify
```bash
grep -rn 'CrystalIcon' frontend/src/                                      # 0
grep -rn '#1a2a3a' frontend/src/                                          # 0
grep -rn 'rgba(0,60,100' frontend/src/                                    # 0
grep -rn "background.*rgba(255,255,255,0\\.[4-9])" frontend/src/components/  # 0-1 OK
grep -rn "color.*rgba(255,255,255,0.04)" frontend/src/components/         # 0-6 OK (box-shadow edges)
grep -rn "api\\.\\(get\\|post\\)(\\'/api/" frontend/src/                  # 0 (double prefix)
```

### User flow simulation (AGENT RUNS MENTALLY)
1. **Login** → admin@td.com → TopHUD shows balance + territory count
2. **Claim first hex** → HexCard CLAIM button → territory marked own
3. **Claim 2nd adjacent hex** → Kingdom auto-created → ONE merged outer border, NO internal edge
4. **Open Empire panel** → Kingdom in list, size ≥ 2, tdc_per_24h matches backend
5. **Open Kingdom panel** → CustomizationBlock visible (name/color/embed) → SAVE works
6. **Open Codex** → 57 categories flat grid, no group headers → owned tokens highlighted
7. **Open Safari** → Token face bright → click → 3D viewer → click black edges → closes
8. **Open Combat** (via Empire Military tab) → recruit infantry → training queue visible → no 500
9. **Open Ladder** → bots visible with territory counts
10. **Open Alliance** → "Hexod Founders" visible → searchable
11. **Open Wallet** → no staking UI → just HEX/HEX Crypto
12. **Open Shop** → HEX balance top-right → purchasable
13. **Saved locations** → star → "TAP A TERRITORY TO SAVE IT" → click hex → prompt → saves
14. **Radar** → click blip → map flies
15. **Admin Panel** (is_staff) → /gm from Profile → dashboard loads
16. **God mode** (is_staff) → gold button TopHUD → toggles

---

## 12. KNOWN ISSUES PIPELINE (2026-04-19)

### Fixed and shipped (last 30 commits)
- Kingdom borders: merged outer border via `latLngToCell` edge detection
- Close buttons: clean minimal × (no red circle)
- Token 3D: bright (metalness 0.35, exposure 2.2, emissive 0.3)
- Token 3D: click-outside edges close
- Map zoom: wheelPxPerZoomLevel 10, debounce 5ms
- Globe: camera `lerp + lookAt` marker world position
- Codex: flat 57 categories, Overview + Favorites tabs only
- Shop: real HEX balance from `balance.in_game`
- Safari: no daily limit, 2D token + 3D on click
- Wallet: no staking APY section
- Admin panel: button in ProfilePanel for is_staff
- God mode: store state + TopHUD toggle
- seed_bots: claims 5 territories around 20 cities + Hexod Founders
- Migrations: `training_queue` + `news_events` tables
- Double `/api/` prefix: StakingPanel fixed
- Kingdom auto-sync: KingdomPanel populates local store from API

### Still open
- CustomizationBlock save needs `POST /api/territories/customize/` (currently localStorage)
- Applied `fillColor/borderColor` not reflected in KingdomBorderLayer rendering
- Booster opening animation needs polish
- NewsTicker fallback cleanup

---

## 13. COMMIT CONVENTION

```
<type>: <short summary>

<root cause analysis — what was broken, why>

<fix description — which files, which lines>

<verification — TS errors, build status>
```

Types: `fix:` | `feat:` | `refactor:` | `polish:` | `CRITICAL:` (blocker fixes)

---

## 14. DEBUGGING PLAYBOOK

### Symptom: 500 error on `/api/X/`
1. Check `backend/terra_domini/apps/<X>/migrations/`
2. Match migration fields to model (`grep class <ModelName>`)
3. If missing, CREATE migration matching `Meta.db_table`
4. User runs `python manage.py migrate`

### Symptom: "I can't see [feature] in the UI"
1. Component exists: `grep -rn "function <FeatureName>"`
2. Imported: `grep -rn "import.*<FeatureName>"`
3. Rendered: `grep -rn "<<FeatureName>"`
4. Data source has data: open panel's useQuery endpoint
5. Store populated: `useStore.getState()` in console

### Symptom: "Nothing happens when I click X"
1. onClick handler on button?
2. Wired to real API or `toast.success()` only?
3. Browser console for errors
4. Network tab for failed calls

### Symptom: "Text invisible / layout broken"
1. `grep -rn 'rgba(255,255,255,0.04)' frontend/src/components/<Panel>.tsx`
2. If `color:` property, change to `0.3-0.5`
3. Check light-theme leaks: `#1a2a3a`, `rgba(0,60,100,...)`

### Symptom: TypeError toUpperCase
1. `grep -n "toUpperCase\\|toLowerCase" frontend/src/components/<Panel>.tsx`
2. Wrap: `(thing.field || '').toUpperCase()`

### Symptom: Per-hex borders instead of merged
1. Open `HexLayer.tsx` `isOwn` branch (line ~176)
2. Ensure `stroke: 'transparent'`, `weight: 0`
3. Check `KingdomBorderLayer` mounted on map

---

## 15. 10-AGENT AUDIT METHODOLOGY (Richard's QA framework)

When Richard says "full audit" / "10 agents" / "simulate with agents" — run all 10 critiques. Each agent has a specific role, scope, and detection commands. This is how we caught 5 missing migrations, 10+ unguarded `toUpperCase` crashes, invisible text, French leaks, and toast-only fake buttons in one pass.

### AGENT 1 — GAME DESIGNER
**Scope:** Progression loops, player motivation, first-session experience.
**Asks:** "Does this flow make sense? Are there dead-ends? Is there feedback after every action? Can a new player succeed in the first 60 seconds?"
**Detection:**
```bash
# First thing new player sees
grep -n "Route path\|Navigate to" frontend/src/App.tsx
# Tutorial exists?
ls frontend/src/components/onboarding/
# Free first territory?
grep -rn "free.*claim\|first.*territory" backend/terra_domini/apps/territories/ --include="*.py"
# Feedback loops
grep -rn "play.*claim\|setCelebrating\|toast.success" frontend/src/components/map/HexCard.tsx
```

### AGENT 2 — QA / ERROR HUNTER
**Scope:** Crashes, broken endpoints, fake interactions.
**Asks:** "What crashes? What's fake? What returns 404? Did I test end-to-end?"
**Detection:**
```bash
# TypeScript errors
cd frontend && npx tsc --noEmit 2>&1 | grep -v baseUrl | grep error
# Unguarded toUpperCase (crash when API returns incomplete data)
grep -rn "\.toUpperCase()\|\.toLowerCase()" frontend/src/components/ --include="*.tsx" | grep -v "|| ''" | grep -v "|| \"\""
# Mock data as default state (panel shows fake data)
grep -rn "useState.*MOCK_" frontend/src/components/ --include="*.tsx"
# Double /api/ prefix (produces /api/api/... 404)
grep -rn "api\\.\\(get\\|post\\)('/api/" frontend/src/
# Toast-only pretend buttons (no real API)
grep -rn "onClick.*toast.success" frontend/src/components/ --include="*.tsx"
# CrystalIcon orphans (replaced by IconSVG)
grep -rn "CrystalIcon" frontend/src/
```

### AGENT 3 — GRAPHIC DESIGNER
**Scope:** Visual consistency, readability, dark theme integrity.
**Asks:** "Is everything readable? Contrast issues? Does it match Richard's reference design?"
**Detection:**
```bash
# Invisible text (0.04 opacity on color:)
grep -rn "color.*rgba(255,255,255,0.04)" frontend/src/components/ --include="*.tsx"
# White backgrounds (light theme leak)
grep -rn "background.*rgba(255,255,255,0\\.[4-9])" frontend/src/components/ --include="*.tsx"
# Old light-theme colors
grep -rn "#1a2a3a\|rgba(0,60,100\|rgba(235,242,250" frontend/src/components/ --include="*.tsx"
# Close buttons inconsistency
grep -rn "onClick={onClose}" frontend/src/components/ --include="*.tsx"
# Unreadable fontSize < 7
grep -rn "fontSize: [0-6]," frontend/src/components/ --include="*.tsx"
# Inconsistent fonts
grep -rn "fontFamily" frontend/src/components/ --include="*.tsx" | grep -v "Orbitron\|Share Tech\|monospace\|system-ui\|sans-serif"
```

### AGENT 4 — BACKEND / API INTEGRATOR
**Scope:** Missing migrations, endpoint mismatches, seed scripts.
**Asks:** "Do all models have migrations? Do all frontend API calls hit real endpoints? Does seed_bots actually seed everything?"
**Detection:**
```bash
# Count models vs migrations per app
for app in accounts territories combat events alliances economy progression blockchain; do
  path="backend/terra_domini/apps/$app"
  models=$(grep -rhE "^class \\w+\\(models\\.Model" $path/*.py 2>/dev/null | wc -l)
  migs=$(ls $path/migrations/*.py 2>/dev/null | grep -v __init__ | wc -l)
  echo "$app: $models models, $migs migrations"
done
# Frontend endpoints without backend URL pattern
python3 -c "..."   # compares api.get() strings vs urls.py patterns
```
**Critical output:** Models without migrations = 500 errors. Count must match.

### AGENT 5 — UX FLOW / DEAD-END HUNTER
**Scope:** Empty states, loading states, navigation cues.
**Asks:** "What does an empty panel look like? Do loading states exist? Are there dead-end screens with no exit?"
**Detection:**
```bash
# Empty-state messages
grep -rn "NO KINGDOMS\|NO TERRITORIES\|NO ALLIANCE\|empty\|Coming soon" frontend/src/components/ --include="*.tsx"
# Panels without skeleton/loading
grep -L "Skeleton\|Loading\|isLoading" frontend/src/components/hud/*.tsx frontend/src/components/kingdom/*.tsx
# API calls without .catch or onError
grep -rn "\\.catch\|onError" frontend/src/components/ --include="*.tsx" | wc -l
# Missing back/close
grep -L "onClose\|onBack\|goBack" frontend/src/components/hud/*.tsx
```

### AGENT 6 — PERFORMANCE / BUILD
**Scope:** Bundle size, re-renders, unnecessary work.
**Asks:** "How big is the bundle? Are there React.memo opportunities? Any stale closure bugs? Inline style recreations?"
**Detection:**
```bash
# Bundle size
ls -lh frontend/dist/assets/index-*.js
# React.memo usage
grep -rn "React.memo\|memo(" frontend/src/components/ --include="*.tsx" | wc -l
# Inline style object count (re-render cost)
grep -rn "style={{.*" frontend/src/components/ --include="*.tsx" | wc -l
# setInterval/setTimeout leaks
grep -rn "setInterval\|setTimeout" frontend/src/components/ --include="*.tsx"
# Heavy Three.js imports
grep -rn "from 'three'" frontend/src/ --include="*.tsx" --include="*.ts"
```

### AGENT 7 — SECURITY
**Scope:** Exposed secrets, unsafe patterns, auth checks.
**Asks:** "Any secrets in frontend? localStorage storing passwords? eval()? dangerouslySetInnerHTML? Are admin endpoints actually protected?"
**Detection:**
```bash
# Secrets in frontend
grep -rn "sk_live\|pk_live\|api[-_]key" frontend/src/ --include="*.tsx" --include="*.ts"
# Password/token storage
grep -rn "localStorage.*password\|localStorage.*secret" frontend/src/
# eval / Function constructor
grep -rn "eval(\|new Function(" frontend/src/
# dangerouslySetInnerHTML (acceptable only in iconBank)
grep -rn "dangerouslySetInnerHTML" frontend/src/
# Admin endpoint protection
grep -rn "IsAdminUser\|is_staff" backend/terra_domini/apps/admin_gm/
# CORS + DEBUG (must be env-based)
grep -n "CORS\|DEBUG\s*=" backend/terra_domini/settings/base.py
```

### AGENT 8 — MOBILE / RESPONSIVE
**Scope:** Touch targets, viewport handling, responsive layout.
**Asks:** "Are touch targets >= 40px? Is there a viewport meta tag? Are there media queries for mobile?"
**Detection:**
```bash
# Touch targets < 40px (not tappable comfortably)
grep -rn "width: [1-3][0-9]px.*height: [1-3][0-9]px" frontend/src/components/ --include="*.tsx"
# Fixed pixel widths (not responsive)
grep -rn "width: [0-9]\\{3,4\\}px" frontend/src/components/ --include="*.tsx" | grep -v "maxWidth\|minWidth"
# Media queries
grep -rn "@media\|window.innerWidth\|matchMedia" frontend/src/ --include="*.tsx" --include="*.ts" --include="*.css"
# Viewport meta
grep -n "viewport" frontend/index.html
```

### AGENT 9 — ACCESSIBILITY
**Scope:** Screen reader support, keyboard navigation, color contrast.
**Asks:** "Any aria-labels? Are images alt'd? Are buttons keyboard-navigable? Are we relying on color alone?"
**Detection:**
```bash
# aria-label
grep -rn "aria-label" frontend/src/components/ --include="*.tsx" | wc -l
# Images without alt
grep -rn "<img" frontend/src/components/ --include="*.tsx" | grep -v "alt="
# Keyboard handlers
grep -rn "onKeyDown\|onKeyPress\|tabIndex\|role=\"button\"" frontend/src/components/ --include="*.tsx" | wc -l
# Icon-only buttons (no discernible name)
grep -rn "<button[^>]*>\\s*×\\s*</button>" frontend/src/components/ --include="*.tsx"
```

### AGENT 10 — i18n / LOCALIZATION
**Scope:** Language consistency, framework usage, date/number formats.
**Asks:** "French leaking into English UI? Is there an i18n framework? Date formats using user locale?"
**Detection:**
```bash
# French leaks in English UI
grep -rn "Solde\|Montant\|Annuler\|Valider\|Bienvenue\|Retour" frontend/src/components/ --include="*.tsx"
# Framework
grep "react-i18next\|i18next\|react-intl" frontend/package.json
# Date formats
grep -rn "toLocaleDateString\|toLocaleString" frontend/src/ --include="*.tsx" --include="*.ts"
```

---

### AUDIT RUN PROTOCOL

1. Run agents **1-10 sequentially** in a single session — copy the bash detection commands for each.
2. Categorize findings by severity:
   - **CRITICAL (fix now):** crashes, 500 errors, invisible UI, fake buttons
   - **HIGH:** UX dead-ends, security issues, inconsistent styles
   - **MEDIUM:** perf (memoization, hover handlers), a11y, i18n
   - **LOW:** polish (hover states, skeletons, font sizes)
3. Fix CRITICAL + HIGH in one commit with detailed root-cause description.
4. Create GitHub issues or claude.md entries for MEDIUM + LOW.
5. After fixes: re-run all 10 agents to verify no new issues introduced.

### EXAMPLE — 10-agent session output (2026-04-19 audit)

**Fixed:**
- Agent 2: 10 unguarded `toUpperCase` → guarded with `(x || '')`
- Agent 2: `★` emoji in AdminPanel → replaced with `·`
- Agent 2: 1 toast-only recruit button → wired to `POST /api/combat/recruit/`
- Agent 3: ProfilePanel invisible text (0.03) → fixed to 0.5
- Agent 3: StakingPanel ugly close → minimal × pattern
- Agent 4: 5 missing migrations → created idempotent `RunSQL` with `IF NOT EXISTS`
- Agent 10: `Annuler/Vendre` → `Cancel/Sell`

**Remaining:**
- Agent 3: 66 buttons not using `btn-game` (consistency)
- Agent 5: 5 panels without Skeleton
- Agent 6: 1383 inline styles (memoization opportunity)
- Agent 9: 0 `aria-label` (accessibility)
- Agent 10: No i18n framework (post-launch concern)

---

### MANDATORY 4 PERSONAS BEFORE EACH "DONE"

Even outside a full 10-agent audit, mentally run these 4 before every commit:

**Game Designer:** "Does this flow make sense? Are there dead-ends?"
**Graphic Designer:** "Is it readable? Does it match Richard's reference?"
**QA Tester:** "What crashes? What's fake? What returns 404?"
**Player:** "I just logged in. What am I supposed to do? Is it fun?"

---

## 16. REPO CLEANUP STATUS (2026-04-19)

### DELETED (tier 1, 2, 3, 4, 5 approved by Richard):

**Unused components (6 files):**
- `frontend/src/components/crypto/StakingPanel.tsx`
- `frontend/src/components/hud/CampaignWidget.tsx`
- `frontend/src/components/map/GlobeView.tsx`
- `frontend/src/components/map/MyTerritoriesOverlay.tsx`
- `frontend/src/components/shared/HexCoinIcon.tsx`
- `frontend/src/components/ui/ResourceTooltip.tsx`

**Unused data:**
- `frontend/public/press-kit.html`
- *(KEPT: `backend/terra_domini_pois.csv` — will be used)*

**Superseded scripts (10 files):**
- `scripts/seed_dev.py`, `seed_pois.py`, `seed_events_calendar.py`, `smoke_test.sh`
- `backend/scripts/seed_all_pois_master.py`, `seed_pois_world2.py`, `seed_unified_pois.py`, `seed_resources.py`, `seed_game_world.py`, `harvest_pois_osm.py`
- *(KEPT: `scripts/init_db.sql` for future Postgres prod with many players)*
- *(KEPT: `scripts/geo_pipeline.py` as safety)*

**Emergency patches (3 files):**
- `backend/scripts/emergency_js_patch.py`, `fix_js_crash.sh`, `patch_dist.py`

**Stale docs:**
- `DASHBOARD.md` (172 lines, 16 days stale, superseded by claude.md v5.0)

### RETAINED (verified in use or future prod):
- `claude.md` (v5.0 LIVING doc)
- `README.md` (public-facing)
- `QUICKSTART.md` (setup reference)
- `read_only_templates/` — ALL 4 files referenced as "Source:" in iconBank, Token3DViewer, hexodToken3D, hexodTokenFace
- `contracts/` — Solidity contracts for Polygon blockchain plan
- `frontend/dist/` — REQUIRED for Windows-no-Node setup
- `backend/scripts/ensure_db.py`, `setup_db.sh` — active
- `backend/terra_domini_pois.csv` — reseed data source (per Richard)
- `scripts/init_db.sql` — Postgres prod init
- `docker-compose.yml` + `docker-compose.dev.yml` — future prod
- `nginx/nginx.conf` — future prod
- `start.sh` — active launcher
- All Django management commands (`apps/*/management/commands/`)

---

## 17. REFERENCES

- Full game spec: `llm/HEXOD_GAME_SPECS.md`
- Blockchain plan: `llm/blockchain_architecture.md`
- Tokenomics: `llm/tokenomics.md`
- Quick reference: `QUICKSTART.md`

---

*This file is LIVING. Update it when you learn something new.*
