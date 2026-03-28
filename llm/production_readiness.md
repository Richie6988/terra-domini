# HEXOD — Production Readiness Review
**Date:** 2026-03-28  
**Session:** 16  
**Reviewer team:** ARIA (Art), CARD (NFT), GAME (Design), INFRA (Tech)

---

## VERDICT: ❌ NOT READY FOR PRODUCTION

### Critical Blockers (must fix before any user sees the game)

| # | Agent | Issue | Status | Priority |
|---|-------|-------|--------|----------|
| B1 | GAME | **Territory claim flow** — 3 methods with cost preview + kingdom integration | ✅ DONE | P0 |
| B2 | GAME | **Kingdom creation wizard** — name, color picker, auto-capital | ✅ DONE | P0 |
| B3 | GAME | **processDay not wired** — crystals never actually generate, skill tree is empty forever | ❌ MISSING | P0 |
| B4 | GAME | **Map has no H3 hex overlay** — territories are invisible, just Leaflet markers | ❌ MISSING | P0 |
| B5 | INFRA | **No WebSocket reconnect** — connection drops silently, no real-time updates | ⚠️ PARTIAL | P0 |
| B6 | GAME | **Shop items not connected to kingdom bonuses** — buying a boost does nothing to skill tree | ❌ MISSING | P1 |
| B7 | CARD | **Token 3D viewer not integrated** — exists as standalone HTML but not in React | ❌ MISSING | P1 |

### Major Issues (blocks engagement loop)

| # | Agent | Issue | Status |
|---|-------|-------|--------|
| M1 | ARIA | **Emoji icons in production** — 20 resource types, 11 dock buttons, all skill icons still use emoji instead of SVG | 🔄 IN PROGRESS (resource SVGs created, dock/skill not yet) |
| M2 | GAME | **Trade panel not connected to kingdom resources** — you produce resources but can't trade them | ❌ MISSING |
| M3 | GAME | **Alliance system shallow** — no shared kingdom, no joint defense, no resource pooling | ⚠️ BASIC |
| M4 | GAME | **Combat system untested** — attack calculations exist in backend but no frontend flow | ⚠️ PARTIAL |
| M5 | GAME | **No daily cycle automation** — "day" concept exists but doesn't auto-trigger resource/crystal generation | ❌ MISSING |
| M6 | ARIA | **Radar not connected to real API** — shows mock blips, no real nearby tokens | ❌ MISSING |
| M7 | GAME | **Codex (M14) missing** — token collection grid using icon bank is not built | ❌ MISSING |
| M8 | GAME | **Daily Hunt (M09) missing** — core engagement loop for token collection | ❌ MISSING |

### Art Direction Review (ARIA)

**What's working:**
- ✅ Light tactical theme is beautiful and consistent
- ✅ Glassmorphism + Orbitron typography is distinctive
- ✅ SVG icon bank has 48 category icons + 25 resource icons = 73 total
- ✅ GlassPanel/Modal system is polished
- ✅ Cross-panel navigation is fluid

**What needs work:**
- ⚠️ Skill tree icons are emoji — need custom SVGs for each of the 42 skills
- ⚠️ Dock icons are emoji — need SVG from icon bank
- ⚠️ Map components still use dark theme in places (intentional for dark map bg, but popups should be glass)
- ⚠️ BoosterOpenAnimation still dark theme
- ❌ No loading states with skeleton patterns
- ❌ No empty state illustrations
- ❌ Kingdom creation wizard has no UI design

**Game DNA consistency check:**
- Theme: "Tactical military glassmorphism" ✅ consistent across panels
- Typography: Orbitron + Share Tech Mono ✅ everywhere
- Colors: Cyan/Amber/Crystal purple ✅ consistent
- Currency: CrystalIcon everywhere, no more 💎 emoji ✅
- Resource display: Mixed (emoji in skill tree, SVG in resource panel) ⚠️

### Game Design Review (GAME)

**Core loop analysis:**
```
MAP → CLAIM → KINGDOM → RESOURCES → CRYSTALS → SKILLS → BONUSES → CONQUER MORE
                                                           ↕
                                                     TRADE/SHOP
```
- Claim → Kingdom: ❌ NOT BUILT
- Kingdom → Resources: ✅ Types + biome tables defined
- Resources → Crystals: ✅ Store + allocation logic
- Crystals → Skills: ✅ Pour mechanic + fork system
- Skills → Bonuses: ❌ Bonuses don't apply to gameplay yet
- Trade integration: ❌ Not connected
- Shop integration: ❌ Not connected

**Skill tree balance:**
- 6 branches × 7 tiers = 42 skills ✅
- Fork system at tier 2: permanent choice ✅
- Cost curve: 0/800/2000/4000/7000/15000 ✅ good exponential
- Cross-branch synergies: defined in types but not implemented in UI ⚠️

**Conquest balance:**
- 3 methods (assault/purchase/infiltration) ✅
- Adjacency bonus (3.5× cheaper) ✅
- Rarity gate (influence requirement) ✅
- Duration scaling by distance ✅
- Actual conquest execution: ❌ NOT BUILT (no buttons in TerritoryPanel)

### Infrastructure Review (INFRA)

- Django 5 backend: ✅ operational
- React 18 + TS frontend: ✅ builds cleanly
- Zustand stores: ✅ auth + game + kingdom with persistence
- API services: ✅ axios with interceptors
- WebSocket: ⚠️ basic, no reconnect
- Build size: ~2.5MB bundle (acceptable for game)
- Git: ✅ clean main branch, 17+ commits this session

---

## PRIORITY ROADMAP TO PRODUCTION

### Sprint 1: Core Loop (BLOCKS EVERYTHING)
- [ ] Territory claim buttons in TerritoryPanel (Purchase/Assault/Infiltrate)
- [ ] Kingdom creation wizard (name, color, capital selection)
- [ ] processDay wiring (auto-trigger every 24h or manual "next day")
- [ ] Map hex overlay (H3 cells visible, kingdom borders with walls)

### Sprint 2: Engagement Loop
- [ ] Codex M14 (token collection grid with SVG icons)
- [ ] Daily Hunt M09 (daily token hunt with radar integration)
- [ ] Shop → Kingdom integration (boosts apply to skill bonuses)
- [ ] Trade → Resources integration (exchange kingdom resources)

### Sprint 3: Polish
- [ ] All emoji → SVG (skills, dock, resource displays)
- [ ] Loading skeletons + empty state illustrations
- [ ] BoosterOpenAnimation light theme migration
- [ ] Sound system integration
- [ ] Tutorial for kingdom mechanics

### Sprint 4: Competitive
- [ ] Alliance shared kingdoms
- [ ] Leaderboard by kingdom power
- [ ] War ticker integration with real battles
- [ ] Cross-branch synergy detection UI
