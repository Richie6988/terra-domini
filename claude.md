# HEXOD — claude.md v5.0

> Single source of truth for all AI agents. Read this FIRST before any work.
> Last updated: 2026-10-17 | Repo: github.com/Richie6988/terra-domini

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

**Without `migrate` (since 2026-10-17): LOGIN itself returns 500** (`no such column: players.email_verification_code`). Migration `accounts/0003` adds the missing Player columns and marks staff as `email_verified` (same as `manage.py verify_admin`). All 2026-10-17 migrations are idempotent (`terra_domini/utils/migration_ops.py`): they skip tables/columns/indexes that already exist, so they are safe on any local DB.

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

### Bug class 9 — `?` placeholders on the Django cursor
**Cause:** `django.db.connection.cursor()` uses `%s` placeholders. `?` only works with raw `sqlite3.connect()`. With params, `?` → `TypeError: not all arguments converted during string formatting` (marketplace 500, daily production silently broken).
**Rule:** Django cursor → `%s`. Raw `sqlite3.connect` → `?` (and it will break on Postgres — prefer the Django cursor).

### Bug class 10 — Model fields without migration
**Detection:** `python manage.py makemigrations --check --dry-run` must print `No changes detected`. Then query every model once (see §11) — `no such table/column` = missing migration.

### Bug class 11 — Celery not loaded / wrong beat task names
`terra_domini/__init__.py` MUST import the Celery app, otherwise `.delay()` targets `amqp://localhost` → 500 (leaderboard). Beat entries in `celery.py` must use the task's registered `name=` (e.g. `combat.resolve_battles`), not the module path.

### Bug class 12 — Unescaped player text in Leaflet HTML
`bindTooltip` / `bindPopup` / `L.divIcon` take raw HTML. Any player-controlled string (custom_name, username, event title/body) must go through `escapeHtml()` (`services/escapeHtml.ts`) — otherwise stored XSS for every player who hovers the hex.

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
- `POST /api/combat/attack/` — `{target_h3, attack_type, units:{infantry:N}}` → 201, battle resolves after a timer (HEX 4h, urban 12h, surprise ÷2). NO instant result.
- `GET /api/combat/active/` · `GET /api/combat/incoming/` · `GET /api/combat/history/` — reading these also resolves expired battles (dev has no Celery beat)
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
- `GET /api/alliances/`, `POST /api/alliances/create/`, `GET /api/alliances/<id>/members/`
- `POST /api/diplomacy/propose/` `{target_alliance_tag, state}` · `POST /api/trade/propose-trade/`
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

> **ART DIRECTION (owner, 2026-10-17): SUPERCELL / CARTOON** (Clash Royale / Brawl Stars), desktop and mobile equal,
> red = enemy hexes. Royal-blue panels, 2–3px dark outlines, 3D bottom shadows (`0 4px 0 <dark>`), saturated colours,
> white Lilita One text with dark drop shadow, NO neon glow, NO scanlines, letter-spacing ≤ 0.5px, body ≥ 11px.
> Fonts are bundled in `src/assets/fonts` (Lilita One + Nunito). 'Orbitron'/'Share Tech Mono' in old inline styles are
> CSS aliases of Lilita One — new code uses `var(--font-heading)` / `var(--font-mono)` / `var(--font-body)`.
> The colour values below that mention dark navy/neon are superseded by the UI kit tokens (`--hx-*`).

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

### UI KIT v2 (2026-10-17) — `index.css` "HEXOD UI KIT v2"
Use these classes instead of re-inventing inline styles:
`hx-card` (+`--interactive` hover lift, `--accent`), `hx-section-title`, `hx-tabs`/`hx-tab` (`aria-selected`),
`hx-stat`/`__label`/`__value`(`--accent`), `hx-stat-grid`, `hx-chip`(`--accent`), `hx-progress`/`__fill`,
`hx-close`, `hx-icon-btn` (40px), `hx-input`, `hx-empty`/`__title`, `hx-skeleton`, `hx-divider`, `hx-rise`.
Accent: `--accent` CSS var (GlassPanel sets it from its `accent` prop; elsewhere `style={{ ['--accent' as any]: '#cc8800' }}`).
Tokens: `--hx-text/-2/-3`, `--hx-line(-strong)`, `--hx-surface(-2)`, `--acc-<panel>`, `--rar-<rarity>`.
GlassPanel: `title, onClose, accent, width, icon?, subtitle?` — × close (aria-label), ESC closes, full-screen on phones.
Minimum font size: 9px.

### QA screenshots (dev only)
`/?nointro` skips the 3D globe; `window.__hexod` = Zustand store (`__hexod.getState().setActivePanel('empire')`).
Both are compiled out of production builds (`import.meta.env.DEV`).

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
- `avatar_emoji` (iconBank ID, max 32), `avatar_color` (#hex) — `avatar_color` only became a real column on 2026-10-17 (before: silently dropped)
- `/api/players/me/` now returns `is_staff`, `avatar_emoji`, `avatar_color`, `bio` (God mode + Admin buttons depend on `is_staff`)
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

### Backend checks (2026-10-17)
```bash
cd backend
python manage.py makemigrations --check --dry-run          # "No changes detected"
python manage.py migrate                                   # on a COPY of db.sqlite3 and on a fresh DB
# smoke: log in as admin, GET every api.get('...') path found in frontend/src → no 500
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

## 11b. GAME LOOP & ECONOMY (owner, 2026-10-17) — `economy/balance.py` is the single source of truth

- **5-minute session + FOMO**: territories fill a HEX stock capped at 8h (`STORAGE_CAP_HOURS`). Nothing is credited
  automatically (daily cron no longer credits HEX). `GET /api/loop/status/` (harvest, streak check-in, missions, nudges)
  and `POST /api/loop/collect/`. Overflow is lost and reported (`lost`).
- **Combat (veteran playtest 2026-10-18)**: `GET /api/combat/preview/` gives the exact server win chance; reinforce/incoming
  return `hold_chance`. Bot raids are conquests (a 'raid' never captures). Shop: `IMPLEMENTED_EFFECTS` — purchase refuses
  any effect the code doesn't apply (no HEX taken for nothing); atk/def boosts capped at +25%.
- **Starter boost**: accounts younger than `BEGINNER_DAYS` (3) produce x`BEGINNER_MULT` (4) — time-based so buying a zone never lowers the rate.
- **Pace (fast)**: HEX/day common 60 → mythic 3000; buy cost `120 × 1.22^(owned-1)` (×2.5 non-adjacent, × rarity price).
- **Rarity scarcity**: world share caps (legendary 1%, epic 4%, rare 10%) in `territory_engine._apply_scarcity`.
- **Missions**: templates seeded (progression/0002); `progression/missions.track(player, type, n)` hooks in claim, buy,
  collect, recruit, attack, reinforce, shop.
- **Combat FOMO**: `POST /api/combat/reinforce/` (80 HEX, +60 def, cap 2× max); `combat.bot_raids` every 2h (beat) or
  `python manage.py bot_raids` — bots raid humans with ≥3 hexes, never the capital.
- **Crypto (real, no paid randomness)**: `Player.hex_purchased_balance` tracks purchased HEX. Booster packs (random)
  and `POST /api/wallet/cash-out/` (HEX → token, 5% burn, min 1000) accept EARNED HEX only. Boosters grant real FREE
  territories with the advertised guarantee. Run `python manage.py seed_shop` once (catalog was empty).
- Frontend mirror: `services/balance.ts`; HUD: `components/shared/SessionLoop.tsx` (HarvestButton, NudgeStack,
  opt-in browser notifications).

## 11c. HEXOD MASTER DATABASE (2026-10-18) — one source for POIs, creatures, biomes, resources

- Sources (owner spreadsheets, never edit by hand): `data/hexod_db/sources/*.xlsx` (+ `backend/terra_domini_pois.csv` legacy seed).
- Build: `python scripts/build_hexod_db.py` (needs `openpyxl wordninja`) → `data/hexod_db/HEXOD_MASTER_DB.xlsx`
  (sheets README, POI, CREATURE, CATEGORY, BIOME, BIOME_RESOURCE, RESOURCE, UNLOCATED, MERGED_DUPLICATES, ISSUES)
  and `data/hexod_db/hexod_db.json` (what the game reads).
- Rarity = combined score (visitors + geopolitical + rare fact + premium), then quotas legendary 1% / epic 4% / rare 10% / uncommon 25%.
- POIs are located at **H3 res 8** (the map grid). Duplicates on the same cell are merged (`aliases`, sheet MERGED_DUPLICATES).
  Countries are codex-only (no hex); cities go on the map as `trade_node`.
- Load into the game DB: `manage.py import_hexod_db` (idempotent). Replaces `UnifiedPOI(source='hexod_db')` with bulk_create
  (UnifiedPOI.save() would force res 7 and the category rarity), deactivates other POIs unless `--keep-legacy`,
  upserts res-8 POI territories without touching owners, removes unowned legacy POI territories at res 7/10.
- Creatures: read at runtime by `apps/events/hexod_db.py`; Safari spawns real species (rarity-weighted, `needs_review` excluded)
  and returns `creature_description/category/wiki_url`. Texts are cleaned scrapes: 622 creatures flagged `needs_review`.
- Lesson: wordninja shreds Latin names ("Sagitta ria latif oli a") — only accept splits made of frequent English words,
  never split the first word or the species epithet, glue rare runs back.

## 11d. NORTH STAR + SYSTEMS (2026-10-18) — read docs/GAME_DESIGN.md first
- **Pitch**: Risk on the real map x Panini album x MPG office leagues. 30 min/day, free, no pay-to-win.
- **Album (Codex)**: numbered cards (#001) — Rare places, Biomes (222 regions), Resources (34), Creatures (4,401). `GET /api/codex/cards/`.
- **Resources**: `economy/resources.py` — each territory produces its DB region's resources (+ its POI resource x4) into the harvest stock; `PlayerResource`.
- **Safari**: creature hides in 1 of 19 real hexes around your land, 4 scans (ring distance), 5 hunts/day. `POST /api/safari/probe/`. Never send `target_h3` before the end.
- **Token**: front = DB texts (title/description/fun fact) via `GET /api/codex/territory/<h3>/`; back = sober engraved metal with real deed data. No random hash, no invented serials.
- **Payments**: `economy/payments.py` — Stripe Checkout packs, peg 1 € = 1000 HEX = 1 HEX Coin; far/locked hexes: `claim-options` method `euro` (HEX credited then spent on the hex). Fulfil is idempotent (confirm + webhook). Needs STRIPE_SECRET_KEY / STRIPE_WEBHOOK_SECRET in .env.prod (webhook URL /api/webhooks/stripe/, event checkout.session.completed).
- **Events**: `events/world_events.py` + `manage.py world_events` (hourly cron): TheSportsDB fixtures on stadium/city POIs, GDELT news on strategic points. Live hex x3; holder at the end wins. `fetch_news --demo` is disabled (invented headlines = RULE 1).
- **Strategic points**: `data/hexod_db/sources/strategic_points.csv` (own rarity ladder). **Cities**: `major_cities.csv` + city extract → `cities` in hexod_db.json.
- **Terrain**: `territories/terrain_rules.py` — POI > urban core (3+5·√pop km) > industrial site (6 km) > suburbs > DB region keywords > old lat/lon heuristic. `import_hexod_db` re-classifies all territories.
- **Map**: `PoiOverviewLayer` (POIs readable when zoomed out: legendary from continent view), `ExplorationLayer` (explorations greyed + countdown).
- **Rarity pays**: HEX/day 60/130/360/900/2400/6000, resources x1/1.6/3/6/12/25 (yield grows faster than price). Megacities floored at rare/epic by metro population in the builder.
- **Shop boosts** = `ActiveBoost` rows read by the game via `balance.has_boost / boost_mult / use_charge` (charge boosts: boost_value = uses left). Blitz (explore ~36 s), Distant Strike (attack range 10 hexes otherwise, `combat.can_attack`), 2X Extraction, Rare Drop (booster odds), Trade Advantage (royalty), Safari continuous / hints (+2 scans) / +Card Rarity (next-tier reward). Anything not in `IMPLEMENTED_EFFECTS` shows SOON and cannot be bought.
- **DB builder**: rare_fact repeated on ≥3 tokens = template → blanked. Curated rows with notes `DUPLICATE OF <uid>` are dropped.
- **Battles (war room)**: `GET /api/combat/<id>/faceoff/` (both sides, powers, walls, hold chance, defender actions) → `components/combat/BattleFaceOff.tsx`, opened anywhere with `openBattle(id)`. Defender window: `POST /combat/defend/` (free troops join; survivors return after resolution), `/combat/reinforce/` (walls), 2X Defense via `/shop/purchase/`.
- **Token pipeline (10k goal)**: agents write `data/hexod_db/sources/candidates/*.csv` (format in its README: name, exact en.wikipedia URL, kind landmark|history, slug, rough coords, rarity, event_date). On the VPS `deploy/wiki_refresh.sh [--pull]` runs `scripts/wiki_enrich.py` (stdlib, 1 req/s: article exists?, coordinates, lead picture 800px with author+license — non-free never kept, 3-sentence intro) → `build_hexod_db.py` (candidate live only once its article is confirmed; Wikipedia coords win; distinct things never share a hex: the later one moves to the nearest free hex) → `import_hexod_db`. The VPS writes the DB outside the repo (`HEXOD_DB_JSON` in .env.prod); cache `sources/wiki_enrich.csv` is committed from the VPS only.
- **History tokens**: slug `history_event`, `event_date`; the card shows the date first; Codex tab HISTORY. **News tokens**: the holder of a live world event hex when it ends wins an `EventCard` (Codex tab EVENTS). Picture credit is shown on the 3D token (CC BY-SA requires it).
- **Measured terrain**: `territories/landcover.py` — ESA WorldCover 10 m (Terrascope WMTS, legend colour → class) + AWS Terrain Tiles elevation; 7 samples per hex, majority wins → ocean, lake, ice, mountain (≥2000 m or relief ≥350 m), coastal, forest, desert, farmland, grassland, wetland, tundra, urban. Used live for new hexes, and nightly by `manage.py refine_terrain` (Territory.terrain_source='worldcover'); import_hexod_db never overwrites measured terrain. Sources unreachable → old region/latitude rules. Tiles cached in data/tile_cache (gitignored).
- **Money**: every in-app purchase is in HEX (claim-options `unlock` = locked rare place, buy cost ×1.5). Stripe only sells HEX packs. **Map**: zoom 5-16, ambiances `game` (OSM recoloured, .hx-tiles-game) and `satellite`.
- **Daily auctions**: `economy/auction_views.py` — 10 random rare+ unowned place cards a day (ends staggered 2h→24h, start = 3 days of yield), HEX escrow (outbid = refunded at once, purchased HEX consumed only on win), +5 % min raise, anti-snipe +2 min, winner owns the territory. `GET /api/auctions/`, `POST /api/auctions/<id>/bid/`, cron `daily_auctions` hourly.
- **Token face v4** (owner 2026-10-19): no top pill; frame ENGRAVED on 4 edges: pictos (monochrome silhouettes, up to 4) top-left, category top-right, terrain left, edition · date right; inner line = rarity colour. Title smaller with dark outline; 3 bright lines of story; bottom = +HEX/DAY; (Older notes below about the top pill / 3 stats are superseded.)
- **Token face** (Sorare-grade): full-bleed sharp picture (Wikipedia photo, else `/api/tiles/satcard/<h3>.jpg` = 640px mosaic of z16 satellite tiles), top pill `RARITY · tier letter · No`, big clean name, category · country with 3 pictos (category, terrain, resource), 2 lines of story, 3 quiet stats (HEX/day, terrain, edition + issue date). Tier metal frame (BRONZE/SILVER/GOLD/EMERALD/DIAMOND by rarity). No random stock photos ever: designed plate until the Wikipedia picture exists. Codex album = 2D tokens (TokenFace2D), 3D on click.
- **Open databases**: `scripts/fetch_external.py` (VPS) — Wikidata SPARQL per category (volcanoes, waterfalls, castles, stadiums, World Heritage, battles, earthquakes… only items with coordinates + an English Wikipedia article; rarity = rank by number of Wikipedia editions in the category) → `candidates/wikidata.csv`; iNaturalist CC photos → `creature_photos.csv`; Paleobiology DB fossil sites → `fossil_sites.csv`. `deploy/wiki_refresh.sh --external` runs it first (cron Sundays).
- **Picture choice** (`wiki_enrich.py`, image_v 2): 1280 px thumbnails; Wikidata P18 → article lead picture → best other photo of the article (score = size, landscape bonus); refused: maps, flags, logos, coats of arms, diagrams, SVG, < 800 px wide, ratio outside 0.6-2.4 (fallback: lead picture ≥ 400 px for old events). Bump IMAGE_V to re-pick every picture on the next run. The enriched picture replaces an older Wikimedia one in the build; hand-picked pictures from other hosts are kept. Canvas draws photos with high-quality smoothing + light grade.
- **Card picture rule**: Wikipedia photo, else iNaturalist (creatures), else the satellite view of the hex (`/api/tiles/sat/z/x/y.jpg`, same-origin proxy, cached). Non-POI hexes get a description built from measured data (`_place_description`).
- **Lucky draw**: `economy/lottery_views.py` — tickets 100/500/2000 earned HEX only, ~82 % return + jackpot (10 % of tickets), free bronze ticket daily. **Celebrate**: `celebrate(level, text)` = golden bloom + opening hex rings + big text (no confetti: "looks cheap", owner 2026-10-19).
- **UI**: no top ticker; one alert at a time with a pager; Military has its own dock button (Info left the dock).
- **Land/sea**: `territories/landmask.py` — Natural Earth 1:10m rasterised at 0.02° (`data/landmask/land_0.02.bin.gz`, `scripts/build_landmask.py`), offline: open sea is always `ocean`, shoreline `coastal`, ice sheets `ice`. Hex cards of hexes not in the DB ask `codex/territory` for the terrain (never a client-side 'rural').
- **Map layers**: satellite by default. `CoinPickupLayer` (`/api/pickups/`, zoom 13+: 1 hex in 50 holds a coin each day, 40-120 HEX ×2 >5 km / ×3 >50 km from your land, golden 750, 25/day, 15 shown).
- **Notifications**: bell + inbox in the top bar (`NotificationBell`), urgent alerts as one toast (`NudgeStack`).
- **Forces**: `my-army` returns `available` (free units — only these attack) and `stations` (kingdoms + lone territories with stationed units). `POST /combat/assign/` {kingdom_h3,unit_type,count} / `/combat/unassign/` {h3,...}. Military > FORCES tab.
- **Risk military**: a beaten attacker loses ALL the troops it engaged (`resolve_battle`, rate 1.0). Kingdom upgrades `territories/upgrades.py` (walls +15 % def, barracks +2 draft, science +5 % HEX, education +5 % resources; levels 0-5, cost base × 2^level, stored as a Building on the hex, a kingdom's level = best building inside). Daily draft `POST /api/combat/draft/` (Player.last_draft_at): free infantry = max(3, territories/3) + kingdom size (5+:+2, 10+:+4, 20+:+8) + barracks. `GET /api/kingdom/<h3>/overview/`, `POST /api/kingdom/<h3>/upgrade/` → ARMY tab of OwnedTerritoryHub (`KingdomArmyTab`).
- **World safari** (owner 2026-10-19): the species hides in a real hex of its range — `creatures[].places` = iNaturalist research-grade sightings (`scripts/fetch_external.py places` → `sources/creature_places.csv`, VPS) or PBDB fossil sites. Clue = its region; `POST /api/safari/scan/` {lat,lon} from the map centre → band (freezing >2000 km, cold, warm ≤500, hot ≤100, burning ≤20, here ≤2.5) + bearing, 8 scans; `POST /api/safari/probe/` {lat,lon} catches it within 2.5 km. Falls back to the 19-hex local hunt while no species has places. `RadarWidget` = the real radar (the old one drew random blips).
- **Military = 3 counters** (`combat/forces.py`, owner 2026-10-19, replaces units/training/garrisons/unit levels): attack / defense / spy points stored on hexes (`Territory.atk_pts/def_pts/spy_pts`), a kingdom's counter = sum of its hexes. Bought with HEX (`POST /api/forces/buy/` {h3, kind, qty}: attack 10, defense 10, spy 20 HEX a point). Shown above every kingdom/territory on the map (KingdomBorderLayer) and on the hex card. Attack: N points from the kingdom nearest to the target (`POST /api/combat/attack/` {target_h3, points}); at the timer they meet the target kingdom's defense 1 for 1 (both lose min(N, DEF)); N > DEF → hex captured, leftover attack stays on it. Defender buys defense until the timer (`/combat/reinforce/` {battle_id, points}). Daily supplies (`/combat/draft/`): (territories/3 + kingdom size + regions) × 5 attack AND defense points on the biggest kingdom. Kingdom upgrades left: Influence (+2 hexes attack range), Science, Education.
- **Discovery** (`economy/balance.discovery`): distance in rings to your nearest hex → 1000 HEX or 1 h explore when adjacent, ×2 per extra ring, capped ×16 (explore ≤ 12 h); POIs only from an adjacent hex (no far unlock). Spy points: −5 % price and time each, max 10 (claim {spies}).
- **Safari = radar only** (honeycomb removed): no known sightings → the creature is spotted 5-60 km from your land; catching it gives its card AND its hex (named "<creature> grounds"), however far: a new base.
- **Pictures**: articles in column H ('link') of the owner's 4 extracts keep their lead picture as is (already validated), image_v 3.
- **Regions (Risk continents)**: `territories/regions.py` — natural DB regions (biomes), else province = H3 res-2 cell named after its most notable place. Most territories (≥3, strictly ahead) = control: +3 draft troops and +10 % HEX there. Standings cached 5 min. `GET /api/regions/` → Empire > REGIONS. Kingdoms without a custom name are named after their best place / region (never a hex id).
- **One icon per POI**: the hex draws the POI icon; no second marker at the raw coordinates (resource layer removed). The zoomed-out overview skips POIs whose hex is drawn and sits on the hex centre.
- **Codex** = card families only (rare, biomes, resources, creatures, history, events); the old category Overview/Favorites tabs were removed, icons stay in iconBank.
- **Satellite card** `satcard2`: frame exactly centred on the hex (tiles covering the 640 px frame, then crop); URL `?v=2` busts browser caches.
- **Leaflet**: every window listener added in the map effect must be removed in its cleanup (StrictMode remount left `terra:flyto` on a destroyed map → `_leaflet_pos` crash).
- **Event tokens**: 10 numbered editions per event (`world_events.draw`): #1 to the hex holder at the end, the rest drawn among paid tickets (earned HEX only, weight 1 + luck/10, Luck Potion = +15 → x2.5). `EventCard.serial/max_supply/price_hex`. Market `api/event-cards/market|<id>/sell|delist|buy` (5 % royalty), Marketplace > Event tokens.
- **Profile**: `GET /api/players/me/profile-stats/` (empire, army, battle record from Battle rows, collection, rank by territories, streak, recent battles). Unwired toggles (push, language) were removed — never show a setting that does nothing.
- **God mode (2026-10-19)**: staff GOD MODE switch → client sends `X-Hexod-God: 1` (services/api.ts); `utils/god.py` GodModeMiddleware + `is_god(player)` (header AND is_staff) / `god_cost()`. Discovery free + instant + no POI lock / slot cap, safari no daily cap + unlimited scans, forces / upgrades / shop / shield free. Add `god_cost` to any new HEX sink.
- **Kingdom picture (2026-10-19)**: `POST /api/territories-geo/upload-image/` (multipart `image` ≤ 4 MB → Pillow 640 px JPEG in MEDIA_ROOT/kingdoms/, returns `/media/kingdoms/x.jpg`); customize accepts https:// or that path; shown as avatar on the map kingdom pill + hub header. Needs 3 connected hexes (CLUSTER_TIERS). Dev serves /media via Django + Vite proxy; prod via nginx.
- **Map opening view**: main kingdom centroid (`/territories-geo/kingdoms/`), IP geoloc only for players without land.
- **Kingdom gallery**: `GalleryToken` = TokenFace2D fed by `/codex/territory/<h3>/` (same face as Codex/3D), Token3DViewer gets `h3Index` for the real face/back.
- **Lucky wheel (2026-10-19)**: cartoon SVG wheel (LotteryPanel `Wheel`), server draws. Land prizes: 'territory' 3 % (free land hex 2-4 rings from a random POI — a far base), 'poi' 1/10 000 (a free POI); none free → pays x2. `LotteryTicket.won_h3/won_kind` (migration economy 0006).
- **Safari pool + zone (2026-10-19)**: living nature only — fauna (animal, insect), flora (vegetal, mushroom), microOrganism, fossil (dinosaurs) — `hexod_db.SAFARI_FAMILIES`, needs_review entries never spawn. Creature family = `build_hexod_db.classify_creature` (defining sentence first, vertebrates before insects/plants: the old rule put pangolins in insects and gazelles in plants). Fantastic creatures `SafariTarget.FANTASY` (1 hunt in 15, album family 'fantasy', numbered after the DB). Scans: 8, never above `WORLD_SCANS_MAX` 10 (shop hints); payload `scans_max`, `clue_km`. Map `SafariZoneLayer`: clue region / scan sector (band range, bearing ±) / capture hexes, safari stripes (SVG pattern) — built only from radar answers, never the hidden hex.
- **Climbing daily prices (2026-10-19)**: `economy/balance.ESCALATION` + `escalated_price` / `bump_daily` (`DailyCounter`, migration economy 0007). Safari: 5 free hunts then 300 HEX x1.6 per hunt until tomorrow (`_hunt_price` → `next_hunt_cost` in /safari/active/). Event tickets: unlimited, several per event (`NewsEventRegistration.tickets`, events 0008; draw weight × tickets), price max(ticket, 50) x1.5 per ticket of the day, earned HEX only.
- **God mode prices**: discovery returns the real cost with `god_free` (shown, not charged) — never display 0 as the price.
- **Zone original design is deterministic**: `territory_engine.zone_rng(h3)` (seeded by the H3 index, `ZONE_SALT` must never change) draws rarity + shiny; no live world-count scarcity. Boosters keep the zone's own rarity (no mutation). Legacy `/territories/buy/` and `/mint/` retired (410) — they bypassed discovery pricing.
- **Booster content (2026-10-19)**: only shop boosts (applied at once), HEX and POIs (rarer) — `economy.views.BOOSTER_RULES` (standard 3 cards 62/33/5 %, rare 4 cards 52/30/18 %, legendary 5 cards 40/28/32 % + 1 POI guaranteed; POIs = free landmark/city tokens, never deposits or species). Opening cards use the token face v6 (boost = silver, HEX = bronze/gold, POI = its rarity), unlit material.
- **Token v7 (2026-10-19)**: front = full picture; borders engraved: NAME top-left, HEX value top-right ("1 180 HEX"), CATEGORY left, RARITY + #ID right. Back: hallmark, name, coordinates, region, holder + since, then the DESCRIPTION engraved (4 lines), then SERIES #n (1 until a conquest mints #2) and the unique ID.
- **Kingdom style (2026-10-19)**: `kingdom_engine.recompute_kingdoms` takes the kingdom's main style (most common name / colours / picture among its hexes) and applies it to every hex, so new hexes adopt it. Kingdom background picture (customize, unlocked at 2 connected hexes — CLUSTER_TIERS): drop zone upload; KingdomBorderLayer fills the kingdom's hexes with one SVG pattern spanning the kingdom box (redrawn on zoom). Kingdom gallery lists only hexes with a real token (`has_token`).
- **Booster opening**: one card at a time (tap → suspense 0.45 s + 0.35 s per rarity rank → flip; tap → card to the bottom row), neutral gold hex back (no rarity spoiler), face with the hex satellite picture; SKIP.
- **MAP MODEL (owner 2026-10-19) — layers of one fixed table** (`data/hexod_db/hexod_db.json` → `import_hexod_db` → `UnifiedPOI`, several tokens per hex allowed):
  L0 grid/terrain (H3 res 8, landmask, landcover) · L1 rare geolocated tokens (landmarks, cities, history; world events on top, dynamic) · L2 resource tokens (`add_resource_tokens`: 370 real sites floored rare/epic + deposits placed in the regions the resource DB lists — land regions on land, sea regions offshore — 40 per region, 12 for diamonds / rare earths) · L3 species tokens (`place_species` + `species_tokens`: copies per rarity 3/2/2/2/1/1, region names then continents from the whole article, neighbours' continent when none, marine species at sea; visible on the map; Safari = catch one far from your land).
- **Plain hexes**: no token, no rarity, no shiny (migration territories 0008 resets them). Income = `balance.hex_income`: PLAIN_HEX_PER_DAY 100 (+KINGDOM_BONUS 10 when connected) + each token's HEX_PER_DAY[rarity] (× (1 + RESOURCE_TOKEN_BONUS) for resource tokens). HexCard: plain hex = simple bottom card; token hex = 3D token. Codex 'rare' = landmarks/cities only; a species token on your hex counts as caught.
- **Resources simplified**: no stock, no collecting (harvest = HEX only), `PlayerResource` unused, Education upgrade removed. A resource exists only as a resource token (`economy/resources.RESOURCE_SITES`, `site_resource`).
- **Kingdom upgrades = the 4 multipliers** (+10 %/level, max 5): influence → attack power (+2 range/level), fortification → defense power, education → spy power (discovery), science → HEX. `upgrades.kingdom_mult(hexes, key)`; combat: attack × Influence(source kingdom) vs defense × Fortification; preview `points_needed`, faceoff `missing` use them.
- **4 rarities only (owner 2026-10-20)**: Silver 50 % · Gold 30 % · Emerald 15 % · Diamond 5 % — the name is the metal of the token frame. Keys stay common / uncommon / rare / epic (legendary / mythic = old keys, shown and paid as Diamond). `hexod_db.apply_quotas` cuts each kind of token by these shares (import: ranked by the checked rarity then score; creatures at load; a species token takes its creature's rarity). HEX/day 150 / 400 / 1000 / 2500 (a Silver token already beats a plain hex at 100). No resource bonus (owner 2026-10-20): a resource token is a card with its own rarity (Silver copper, Emerald copper, Diamond copper…) and pays its rarity only; the species family bonus stays (SPECIES_BONUS). Labels `services/balance.rarityLabel`, engraving `hexodTokenFace.RARITY_NAME`, frames `Token3DViewer.RARITY_TIER`, colours silver #cbd5e1 · gold #fbbf24 · emerald #10b981 · diamond #67e8f9. Boosters: Standard / Emerald / Diamond. Never show common, uncommon, legendary, mythic.
- **Species family bonus** (`balance.SPECIES_BONUS`): dinosaur +100 %, marine +80, microbe +70, animal +60, bird +50, fungus +40, insect +30, plant +20. `token_bonus()` feeds the card / kingdom detail.
- **Income shown = server value**: map-view returns `hex_per_day` + `token_count` per hex (tooltip); kingdom overview `income` (zones × 100, kingdom bonus, tokens, multipliers) → OwnedTerritoryHub KINGDOM tab `IncomeBreakdown`.
- **Map**: satellite only (vivid filter `.hx-tiles-sat`), AR layer `MapARHud` (reticle, coordinates, scale, compass; Layers button toggles it). POI counters: one design (dark glass + gold ring). Outposts (≤ 2 hexes) under zoom 11: small emblem, no forces row; forces row hidden when all zero (zoom < 13).
- **Safari end**: after "IT IS HERE", tap a hex of the striped zone (`/safari/probe/ {h3}`, must be within capture range of the 'here' scan): right → `SafariReveal` (golden burst → 3D token → '+1' flies to the Codex dock button), wrong → ring distance, −1 scan.
- **Shop (2026-10-19)**: compact single scroll — balance bar, 3 booster packs, active boosts, boosts grid with a category filter (only implemented items), GET HEX packs at the very bottom. `shop/openShop.ts` `openShop('hex')` opens it on the packs: used when the player is short of HEX (hex claim, auction, paid hunt, forces buy 402, kingdom upgrade).
- **HUD layout**: left column = profile, MISSIONS, HARVEST pill (210 × 52, dark glass, progress ring + amount + time, separate HOME button), all aligned; right edge = compass (map info on) + zoom + Safari radar. Top centre = `MapLayersBar` (mobile: column on the right): token families on the map (`store.tokenFilter` places/resources/species, persisted; `/api/map/pois/?kinds=`; GameMap skips hidden families' free hexes and icons; `poiIcons.tokenKind`) + map info toggle (`store.mapInfo`). God mode = small crown button next to the bell, staff only.
- **Token face v6** (hexodTokenFace): left edge = CATEGORY (species_* → ANIMAL/BIRD/FUNGUS…), right edge = RARITY name + #ID, top-right = terrain, top-left = pictos; bottom = main picto + "184 HEX" (no /day); dark glass panel behind name + story. 3D (hexodToken3D): thinner (cardThickness 0.085), edge decorations by tier — SILVER band, GOLD + rivets, EMERALD + 2 bands, DIAMOND glowing rivets (`buildDeco`).
- **Token face v8 (2026-10-19)**: frame engraving all around, picture fills the centre — top-left NAME, top-right "HEX 460" (word first), left CATEGORY, right RARITY, bottom-left "ID <token id | h3>", bottom-right series "#1" (`series` = back.edition). Text sits at `rt = rb - band*0.18` (the 3D lip hides the outer rim). Back: no ID / series (they are on the front) → the engraved story gets up to 7 lines.
- **Kingdom panel (2026-10-19)**: no more "tier" (legacy CLUSTER_TIERS unlock count, meaningless to players) in the hub header, KINGDOM tab or the map badge. Stats grid = the 4 upgrade multipliers ATTACK / DEFENSE / SPY / HEX HARVEST (overview `upgrades[].mult`, level n/5); income lives only in HEX HARVESTING (no duplicate HEX/24H vs INCOME/DAY).
- **4 kingdom categories (2026-10-19)**: ATTACK, DEFENSE, INFLUENCE, PRODUCTION — invested in directly (upgrades.UPGRADES keys attack/defense/influence/production, +10 %/level, max 5; stored as Building market/fort/academy/lab, storage names never shown). The army buys ARMAMENTS (attack points, × Attack, +2 range/level), FORTIFICATIONS (defense points, × Defense), SPIES (spy points, × Influence → discovery discount). Production × HEX income. No more "influence/fortification/education/science" detour names.
- **POI agent (2026-10-19)**: `manage.py poi_agent --limit N` (VPS only: this cloud container cannot reach Wikipedia/Wikidata/Commons, neither curl nor WebFetch). Haiku (`POI_AGENT_MODEL`, default claude-haiku-5-5, key `ANTHROPIC_API_KEY` in .env.prod) checks one POI at a time with tools web_search/web_fetch (server), `wiki_lookup` (Wikipedia + Wikidata: coords, intro, sitelinks = fame, UNESCO, free pictures), `view_image` (picture shown to the model) and `submit_validation`, which is checked in code (rarity value, picture returned by wiki_lookup AND viewed, coords within 25 km of Wikipedia) and bounced back to fix. Income is never chosen by the agent: `token_hex_per_day(rarity, category)`. Stamp = line in `poi_validations.jsonl` next to the master DB (VPS: /home/hexod/data, outside git) + UnifiedPOI.validated_at; `import_hexod_db` overlays the ledger (validated data kept, rejected rows off the map). Default kinds landmark/history/city/country; generated deposits and species copies are not checked (no single real place).
- **Absolute rule: no double dash in game texts (owner 2026-10-19)**: never "--", em dash or spaced en dash in descriptions / facts. `hexod_db.clean_text` cleans every POI + creature text at load (en dash number ranges → hyphen, others → comma); the POI agent refuses a description with a dash. Applies to anything written for players.
- **AR layer**: no centre reticle; a biome card from `GET /api/map/where/?lat&lon` (DB region or "<nearest city> area", terrain, continent, known for), coordinates, scale.

## 12. KNOWN ISSUES PIPELINE (updated 2026-10-17)

### Fixed 2026-10-17 (10-agent audit)
- LOGIN 500 on any DB: 6 models had no migration (Player columns, SafariTarget columns, AllianceChatMessage, CaughtEmail, TickerMessage, PlayerFeedback) → idempotent migrations
- Admin locked out (`email_verified=0`) → accounts/0003 verifies staff; LoginView now checks the password BEFORE answering "Email not verified" (was an account-probing leak)
- Combat attack never worked: view written for an old Battle model (`attacker`, `territory`, `ends_at`), `is_shielded` used without `()`, missing `can_be_attacked_by`, `TerritoryOwnershipHistory` doesn't exist, AttackPanel posted to `/battles/attack/` and faked VICTORY/DEFEAT client-side. Now: real engine, units leave garrison and survivors return, battles resolve lazily on read
- 7/12 Celery beat entries pointed at unregistered task names; Celery app never loaded in Django
- Marketplace + daily production: `?` on Django cursor; ladder + GM dashboard: `accounts_player` table doesn't exist (it's `players`), `battles_won` lives in `player_stats`
- `/players/me/` missing `is_staff` → God mode / Admin buttons never shown
- Alliance members, diplomacy propose, trade propose, `territoryApi.claim`: wrong URLs (404)
- NewsTicker: mock news shown by default + backend `text` field never displayed
- XSS: HexLayer tooltip + MapOverlay popup interpolated player text; MapOverlay popup printed `$[object Object]`

### Still open (MEDIUM / LOW)
- Raw `sqlite3.connect()` in views (ladder, solana staking, GM logs, attack infiltration) — will break on Postgres prod
- Unit keys differ: recruitment `aerial` vs combat engine `air` → aerial units add 0 attack power
- Dead helpers in `services/api.ts` pointing to non-existent routes: `territoryApi.detail`, `territoryApi.build`, `eventsApi.activeEvents`
- `backend/db.sqlite3` is committed with the admin password hash — fine for dev, never for prod
- Defender units are not modelled in battles (only territory defense points)

### Fixed and shipped (2026-04-19)

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
