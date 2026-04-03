# HEXOD — Project Management Dashboard
> Source: Richard's code review (55 items) + agent analysis
> Updated: 2026-04-03 | Sprint planning for next development phases

---

## RICHARD'S DECISIONS (2026-04-03) — All questions answered

| # | Question | Answer | Impact |
|---|----------|--------|--------|
| 1 | Globe view ambition | **Full Three.js sphere** — no workarounds, as sophisticated as possible | Sprint E, XL effort confirmed |
| 2 | Special POI display | **Thousands of POIs**, category color border + POI image as hex background. Viewport-only for perf. Must handle zoom-out gracefully. | Sprint B, L effort |
| 3 | Bottom bar | **10 buttons confirmed**: EMPIRE / ALLIANCE / CODEX / MARKETPLACE / LADDER / EVENTS / SAFARI / AUCTIONS / SHOP / INFO. Custom quality SVG assets. | Sprint C |
| 4 | Empire structure | **1 player = 1 empire = N kingdoms = N×M territories** | Rename KingdomPanel → EmpirePanel |
| 5 | Alliance | **Max members: TBD (follow best practices ~50?)**. WebSocket chat YES. Alliance = global (empires across planet). No shared map border. | Sprint D |
| 6 | Shiny cards | **Rainbow animated border + glitter/sparkle filter on front face** (Pokémon holographic style) | Sprint B |
| 7 | Boosters | **10 items per booster**. Gacha random rarity. Ritual reveal: commons first → bonuses → rare last. Non-tokens = same items as shop (potions, shields, boosters). | Sprint E |
| 8 | Bot players | **Real gameplay bots** — claim territories, build kingdoms, attack. Essential for community launch. | Sprint E, XL |
| 9 | Pin locations | **No max limit**. Server-side. Single pin icon on map → place new OR open dropdown of saved locations for quick teleport. | Sprint B |
| 10 | Preferences | Sound, map colors, notifications + creative game-related settings. Be creative. | Sprint C |
| 11 | Challenges | **Based on game mechanics**: kingdom size (5/10/50/100), wars won, token categories owned (insects 5/10, rare 5/10...), continents visited. Dozens possible from existing categories. | Sprint D |
| 12 | Safari cooldown | **New shop bonus idea**: "1h continuous safari" potion. Otherwise cooldown between captures. | Sprint D + Shop |
| 13 | Contact form | **Follow best practices** — in-game form is fine for now. | Sprint E |

---

## ENRICHED REVIEW TABLE

### Legend
- **Effort**: S (< 2h), M (2-8h), L (8-24h), XL (24h+)
- **Priority**: P0 (blocks launch), P1 (core experience), P2 (polish), P3 (nice-to-have)
- **Sprint**: A (foundation), B (core game), C (social), D (polish), E (advanced)

---

### SPRINT A — Foundation & Auth (P0, ~20h) ✅ COMPLETE

| ID | Page | Feature | Action | Effort | Files Involved | Dependencies | Notes |
|----|------|---------|--------|--------|---------------|-------------|-------|
| 3 | Login | Prevent right-click | Create | S | `App.tsx` (global handler) | None | `document.addEventListener('contextmenu', e => e.preventDefault())` |
| 4 | Login | Readability/contrast | Improve | S | `pages/LoginPage.tsx` L183-190 | None | Fix `inputSt` label colors: `rgba(255,255,255,0.4)` → `rgba(180,220,255,0.7)` |
| 6 | Forgot PW | SMTP actually works | Improve | M | `accounts/email_service.py`, `settings/dev.py` | Mailpit running | Test full flow: request → email sent → link works → password changed |
| 8 | Register | Password eye + validation | Improve | S | `pages/RegisterPage.tsx` | None | Add `type={showPw ? 'text' : 'password'}` toggle + real-time match indicator |
| 9 | Register | Email verification | Create | M | `accounts/views.py` RegisterView, `email_service.py`, new `VerifyEmailPage.tsx` | SMTP working (#6) | Token in URL, verify endpoint, block login until verified |
| 10 | Register | Detect geolocation | Create | S | `accounts/views.py` RegisterView, `accounts/geoip_view.py` (exists) | None | Already have `/api/geoip/` endpoint. Save to player model on register. Frontend reads it. |
| 55 | Tutorial | Fix flow | Improve | M | `components/onboarding/Tutorial.tsx` | Claim working | Tutorial popup must not block map. At step "claim first territory", close tutorial overlay but keep hint arrow. |

### SPRINT B — Map & Territory Core (P0-P1, ~40h)

| ID | Page | Feature | Action | Effort | Files Involved | Dependencies | Notes |
|----|------|---------|--------|--------|---------------|-------------|-------|
| 2 | Login | Remove stats | Discard | S | `pages/LoginPage.tsx` L200-240 | None | Remove animated stat counters section |
| 11 | Map | Custom branded style | Improve | L | `components/map/GameMap.tsx` L397-415 tile switcher | Mapbox/Carto account | Create HEXOD-branded Mapbox style (dark navy + cyan hexes). Keep topo + satellite as options. |
| 13 | Home | Remove map artefacts | Discard | S | `components/map/GameMap.tsx` toggle buttons area | None | Remove hex/zones toggle. Keep only tile switcher. Codex → bottom bar (see #31). |
| 14 | Map | Zoom slider | Improve | M | `components/map/GameMap.tsx` L395-415 | None | Replace +/- buttons with vertical slider. Remove locate button. Position: left side, below tile picker. |
| 15 | Map | Pin locations | Create | M | New `components/map/PlayerPins.tsx`, new API `/api/players/pins/` | Player model | Leaflet markers with custom icons. CRUD stored server-side. Max 50 pins. |
| 16 | Map | Grid follows mouse | Improve | M | `components/map/GameMap.tsx` mousemove handler L139-174 | Grid fix (done) | Always show hover hex + 1 ring around cursor. Same res 8 everywhere. Scales with zoom (Leaflet handles it). |
| 17 | Map | Special territories (POI) | Create | L | `components/map/GameMap.tsx`, `HexLayer.tsx`, backend `seed_landmarks.py` | POI data in DB | Draw POI hexes permanently: thick border in category color + small icon overlay. Query backend for POI hexes in viewport. |
| 46 | 3D Token | Brightness + resolution | Improve | M | `components/shared/Token3DViewer.tsx` | None | Texture 2048px, exposure 2.5+, emissive catColor 0.15. Test with Richard's original side-by-side. |
| 47 | 3D Token | Shiny cards | Create | L | `components/shared/Token3DViewer.tsx` drawFront() | Token3D working | If `is_shiny`: animated rainbow border, sparkle particles (Canvas 2D), special shimmer speed. |

### SPRINT C — Core Panels Rework (P1, ~50h)

| ID | Page | Feature | Action | Effort | Files Involved | Dependencies | Notes |
|----|------|---------|--------|--------|---------------|-------------|-------|
| 31 | Bottom bar | Final 10 buttons | Improve | M | `components/shared/HexodDock.tsx`, `DockIcons.tsx` | None | Reorder: EMPIRE / ALLIANCE / CODEX / MARKETPLACE / LADDER / EVENTS / SAFARI / AUCTIONS / SHOP / INFO |
| 21 | Profile | Top-left access | Improve | M | `components/shared/HexodTopHUD.tsx` | Profile data | Pic + name + alliance tag + territory count. Wire to ProfilePanel data. |
| 22 | Profile | 3 tabs | Improve | L | `components/hud/ProfilePanel.tsx` (809 lines) | None | Refactor: Commander / Achievements / Preferences. Remove current stats tab. |
| 23 | Profile | Preferences tab | Create | M | New section in ProfilePanel | Settings API | Map theme picker, sound on/off, notifications, language |
| 24 | Profile | Commander tab | Improve | M | ProfilePanel Commander section | Email verification (#9) | Edit name/email (with SMTP verify), customize colors/title/avatar, logout, delete account |
| 25 | Profile | Achievements tab | Create | L | New `components/hud/AchievementsTab.tsx` | Backend achievements model | ~30 badges with tiers (5/10/100). Earn HEX on unlock. Progress bars. |
| 26 | Wallet | Top-right minimal | Improve | S | `components/shared/HexodTopHUD.tsx` | None | Only show HEX coin count with CrystalIcon SVG. Remove full wallet access from top. |
| 27 | Wallet | Simplify for non-crypto | Improve | L | `components/crypto/CryptoPanel.tsx` (384 lines) | None | Tab 1: balances + explanation + staking. Tab 2: charts + wallet + withdrawal. |
| 32 | Empire | 3 tabs panel | Improve/Create | XL | `components/kingdom/KingdomPanel.tsx` → rename EmpirePanel | Kingdom backend | Tab 1: kingdoms list (click → sub-panel). Tab 2: military. Tab 3: empire stats. |
| 33 | Empire | Kingdom sub-panel | Create | L | `components/kingdom/KingdomDetailOverlay.tsx` (exists, 528 lines) | #32 | Extend: territory 3D gallery, teleport button, resource management. |
| 38 | Codex | Full gallery | Improve | L | `components/hud/CodexPanel.tsx` (390 lines) | Token3D | 2D token gallery grid. Filter by category/tier/rarity/favorites. Stats. Click → 3D view. Sell → marketplace. |
| 39 | Ladder | Rework | Improve | M | `components/hud/LadderPanel.tsx` (222 lines) | Backend leaderboard | Better visual design. Global / Nearby / Alliance tabs. |

### SPRINT D — Social & Modes (P1-P2, ~60h)

| ID | Page | Feature | Action | Effort | Files Involved | Dependencies | Notes |
|----|------|---------|--------|--------|---------------|-------------|-------|
| 34 | Alliance | Full system | Create | XL | `components/alliance/AlliancePanel.tsx` (311 lines) | Backend alliance | 3 conditional tabs: My Alliance / Search / Create. |
| 35 | Alliance | Create tab | Create | L | AlliancePanel | Backend | Personalization, entry conditions (level, language, resources, age) |
| 36 | Alliance | Search tab | Create | M | AlliancePanel | Backend | Recommended alliances + search with filters + join/request |
| 37 | Alliance | My alliance tab | Create | XL | AlliancePanel | WebSocket chat | Description, bonuses, chat, members, shared assets, trade, coordinated attacks, help requests |
| 40 | Events | Rework panel | Improve | L | `components/hud/EventsPanel.tsx` (368 lines) | Backend events | Event list with 3D token preview. Register with fee. Results tab. Win → mint animation. |
| 41 | Safari | Single target mode | Improve | M | `components/hud/DailyHuntPanel.tsx` (486 lines) | Radar wiring | One target at a time. Radar integration. Capture → mint card. |
| 42 | Auctions | UI overhaul | Improve | L | `components/hud/AuctionPanel.tsx` (445 lines) | WebSocket chat | 2D + 3D token views. Better readability. Wire HEX balance deduction. |
| 28 | Daily tasks | Better placement | Improve | M | `components/hud/TaskCenter.tsx` (238 lines) | Map UI | Not in dock. Floating badge on map that pulses. Click → popup. |
| 29 | Daily tasks | 100 challenges | Create | XL | TaskCenter + new backend model | Achievements (#25) | Categorized challenges: daily (5), weekly (10), permanent (85+). Progress tracking. |
| 30 | Daily tasks | Wire to backend | Create | L | TaskCenter, backend `progression/` app | Player model | Persistent progress. Balance updates. Achievement unlocks. |
| 50 | All panels | Notification system | Create | L | New `hooks/useNotifications.ts`, dock badge component | WebSocket | Red dot + count on dock icons. Types: marketplace, events, kingdom, loot. |

### SPRINT E — Polish & Advanced (P2-P3, ~40h)

| ID | Page | Feature | Action | Effort | Files Involved | Dependencies | Notes |
|----|------|---------|--------|--------|---------------|-------------|-------|
| 12 | Map | Globe zoom-out | Create | XL | New `components/map/GlobeView.tsx` | Three.js | Switch to 3D sphere when zoom < 4. Texture from map tiles. Complex — P3. |
| 18 | Radar | Responsive to map | Improve | M | `components/shared/RadarWidget.tsx` | Map viewport | Sync radar center/range with map viewport. Update on move/zoom. |
| 19 | Radar | Hints on hover | Create | S | RadarWidget blip rendering | None | Tooltip on blip hover showing category name + distance |
| 20 | Radar | Expanded mode | Improve | M | RadarWidget expanded state | Safari mode | Show target details, tracking history, estimated direction |
| 43 | Info | Didactiel/rules | Create | M | New `components/hud/InfoPanel.tsx` | None | Game rules, tips, FAQ. Fun illustrated guide. |
| 44 | Info | Contact form | Create | M | InfoPanel + backend endpoint | Email (#6) | Category selector (bug/suggestion/other) + message. Store in DB + email to dev. |
| 45 | Terms | Legal page | Create | S | New `pages/TermsPage.tsx` | None | Route `/terms`. Standard legal text. Link from register page. |
| 48 | Shop | Booster opening | Create | XL | New `components/shop/BoosterOpening.tsx` | Shop + Token3D | Card-by-card reveal animation. 3D token for rare+. Energy sphere for bonuses. |
| 49 | Home | Maintenance banner | Improve | S | `components/shared/NewsTicker.tsx` | Backend flag | Only show 24h before scheduled maintenance. Backend `/api/system/status/` endpoint. |
| 51 | System | Bot players | Create | XL | New backend management command | Full game loop | Fake player accounts + scheduled territory claims + kingdom building. Celery task. |
| 52 | Marketplace | E-commerce UI | Improve | L | `components/crypto/MarketplacePanel.tsx` (483 lines) | Token3D | 2D card grid. Mint/ownership history. Price chart. Better filters. |
| 53 | Shop | One-pager | Improve | M | `components/shop/ShopPanel.tsx` (344 lines) | None | Remove tabs → single scrollable page. Better card design. |
| 54 | Shop | Bonuses implementation | Create | L | ShopPanel + backend effects | Game balance | Each bonus: duration, effect, stacking rules. Apply to player state. |

---

## SPRINT SUMMARY

| Sprint | Focus | Items | Effort | Priority |
|--------|-------|-------|--------|----------|
| **A** | Foundation & Auth | 7 items | ~20h | P0 |
| **B** | Map & Territory | 9 items | ~40h | P0-P1 |
| **C** | Core Panels | 13 items | ~50h | P1 |
| **D** | Social & Modes | 11 items | ~60h | P1-P2 |
| **E** | Polish & Advanced | 12 items | ~40h | P2-P3 |

**Total: 52 actionable items** (2 Keep, 2 Discard, 22 Create, 27 Improve)
**Estimated total: ~210 hours** of agent work

---

## DISCARDED (confirmed removed)

| ID | Feature | Reason |
|----|---------|--------|
| 2 | Login stats (territories/countries/players) | Useless per Richard — remove animated counters |
| 13 | Map filter buttons (hex/zones toggle) | Artefacts — remove. Codex becomes a dock button. |

## KEPT (no changes needed)

| ID | Feature |
|----|---------|
| 1 | Login top animation |
| 7 | Register UI |

---

## DEPENDENCY GRAPH

```
SMTP working (#6) ──→ Email verification (#9) ──→ Commander tab email edit (#24)
                  └──→ Contact form (#44)
                  └──→ Forgot password fix (#6)

Grid/Hover fix (#16) ──→ Special territories (#17) ──→ Codex gallery (#38)

Token3D fix (#46) ──→ Shiny cards (#47) ──→ Booster opening (#48)
                  └──→ Events 3D preview (#40)
                  └──→ Codex 3D view (#38)

Kingdom backend ──→ Empire panel (#32) ──→ Kingdom sub-panel (#33)
               └──→ Alliance integration (#37)

Achievements model (#25) ──→ Challenges (#29) ──→ Wiring (#30)
                          └──→ Notification system (#50)

WebSocket ──→ Alliance chat (#37)
          └──→ Auction wiring (#42)
          └──→ Notifications (#50)
```

---

*This file is the project management dashboard. Update it as items are completed.*
