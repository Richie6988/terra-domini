# HEXOD — 100-Persona Stress Test & Imperative Improvements
> Coordinated audit by 100 simulated players across 10 archetypes
> Generated: 2026-04-04 | Codebase: 84 frontend files (20K lines) + 134 backend files (17.5K lines)

---

## METHODOLOGY

100 personas grouped into 10 archetypes × 10 players each.
Each persona walks through the FULL player journey: register → verify email → first territory → explore → kingdom → alliance → daily loop → endgame.
Issues scored: **CRITICAL** (game-breaking) / **HIGH** (blocks engagement) / **MEDIUM** (friction) / **LOW** (polish)

---

## PERSONA ARCHETYPES

| # | Archetype | Profile | Device | What they test |
|---|-----------|---------|--------|---------------|
| 1-10 | 🆕 **Total Newbie** | Never played strategy games. Found HEXOD on TikTok. | iPhone SE, spotty 4G | Onboarding, tutorial, first 5 minutes |
| 11-20 | 🎮 **Mobile Gamer** | Plays Clash Royale daily. Wants quick dopamine. | Android mid-range | Session length, reward loops, daily tasks |
| 21-30 | 💻 **Desktop Strategist** | EU4/Civ6 player. Wants depth. | 27" monitor, mouse | Map interaction, kingdom management, skill trees |
| 31-40 | 🪙 **Crypto Degen** | Holds MATIC. Wants to flip NFTs. | MacBook + MetaMask | Wallet, marketplace, staking, withdraw |
| 41-50 | 🏆 **Competitive Grinder** | Top 100 in every game. Min-maxes everything. | Gaming PC | Ladder, combat, alliance wars, exploits |
| 51-60 | 🎨 **Collector** | Completes every Pokédex. Wants ALL tokens. | iPad Pro | Codex, safari, events, shiny hunting |
| 61-70 | 👥 **Social Player** | Plays for the community. Runs Discord servers. | Laptop | Alliance chat, trade, diplomacy, help |
| 71-80 | 🌍 **Globe Trotter** | Travels IRL. Wants to claim real locations. | iPhone 15 Pro, roaming | GPS accuracy, globe view, pin system, POI |
| 81-90 | 🤖 **Power User / Hacker** | Tests edge cases. Tries to break everything. | Dev tools open | API abuse, race conditions, XSS, spoofing |
| 91-100 | 👴 **Casual / Low-tech** | 55+, barely uses smartphone. Friend invited them. | Old Android, slow wifi | Accessibility, font sizes, simplicity |

---

## CRITICAL FINDINGS (game-breaking — fix before any launch)

### C01. Codex collection is 100% MOCK DATA
**Personas 51-60 (Collectors):** Open Codex → all tokens are Math.random() generated. Nothing persists. No real connection to owned territories.
- `CodexPanel.tsx:50` — `getMockCollection()` uses `Math.random()` for owned counts
- **Impact:** The CORE collectible loop is fake. Collectors churn immediately.
- **Fix:** Query real owned territories from backend, group by category, compute real stats.

### C02. Combat/Military is entirely mock
**Personas 41-50 (Grinders):** CombatPanel has hardcoded mock battle history. No real attack endpoint resolves battles.
- `CombatPanel.tsx:38` — "Mock battle history"
- No `POST /api/combat/attack/` that resolves attacker vs defender
- **Impact:** PvP — the core competitive loop — doesn't work.
- **Fix:** Backend combat resolution engine (compare ATK vs DEF, RNG, unit types).

### C03. Leaderboard is hardcoded mock
**Personas 41-50:** LadderPanel shows 20 fake players with `Math.random()` stats.
- `LadderPanel.tsx:37` — `MOCK_PLAYERS = Array.from({ length: 20 }...`
- **Impact:** No real competition visible. Grinders have no motivation.
- **Fix:** Wire to `GET /api/leaderboard/` → `LeaderboardSnapshot` (model exists!).

### C04. Events panel — no real event engine
**Personas 51-60:** EventsPanel shows 5 hardcoded events. No backend creates/resolves events.
- Events need: creation scheduler, registration endpoint, luck-based resolution, token minting
- **Impact:** 1 of 3 daily modes is non-functional.
- **Fix:** `Event` model + Celery task to create/resolve events on schedule.

### C05. Safari — no real target spawning
**Personas 51-60:** DailyHuntPanel shows mock targets. Radar blips are random. No backend assigns/tracks safari targets.
- **Impact:** 1 of 3 daily modes is non-functional.
- **Fix:** `SafariTarget` model + endpoint to assign/track/capture.

### C06. Marketplace listings are not connected
**Personas 31-40 (Crypto):** MarketplacePanel calls `/marketplace/listings/` but no real listings exist.
- No way to LIST a territory for sale from Codex/Token3D
- No buy flow that transfers ownership + deducts HEX
- **Impact:** NFT marketplace — the crypto revenue engine — is broken.
- **Fix:** Wire list/buy/cancel endpoints. Add "SELL" button on Token3DViewer.

---

## HIGH FINDINGS (blocks engagement — fix for beta)

### H01. No real-time map updates
**Personas 21-30:** Claim a territory → other players don't see it until page refresh. WebSocket `ws/map/` exists but GameMap doesn't listen to it for live territory updates.
- **Fix:** Connect `useGameSocket` to update Zustand store on territory_claimed events.

### H02. Explore timer has no server-side completion
**Personas 11-20:** Start exploration → close app → come back → no way to finalize the claim. `PendingClaim` model exists but frontend doesn't poll/auto-complete.
- **Fix:** `usePendingClaims` hook exists but isn't rendered in GameMap or HexCard.

### H03. Alliance chat is placeholder UI
**Personas 61-70:** Alliance overview shows 3 hardcoded chat messages. WebSocket consumer exists but frontend doesn't connect to `ws/alliance/<id>/`.
- **Fix:** Create `useAllianceChat` hook connecting to WS, render real messages.

### H04. No sound at all
**Personas 11-20 (Mobile Gamers):** Preferences has sound toggles but no audio system exists. No claim sound, no battle sound, no notification sound.
- **Fix:** Audio engine with Howler.js or Web Audio API. 5-10 sounds minimum.

### H05. Profile achievements progress all show 0
**Personas all:** AchievementsTab shows 20 badges but `getProgress()` only reads from `player.stats` which has limited fields. Most badges show 0/N.
- **Fix:** Wire to `GET /api/progression/achievements/` → `PlayerAchievement` (model exists).

### H06. MissionTemplate not seeded
**Personas 11-20:** TaskCenter calls `/api/progression/daily-missions/` but if `MissionTemplate` table is empty, it returns empty missions.
- **Fix:** Create `seed_missions` management command with 20+ mission templates.

### H07. Empire resources are mock
**Personas 21-30:** EmpirePanel Stats tab shows hardcoded resource grid (Iron 120, Oil 85...). No real resource production from territories.
- **Fix:** Wire to real kingdom resource aggregation endpoint.

### H08. Token3D category icon often missing
**Personas 71-80:** Click territory → Token3DViewer opens → icon section is empty. `data:URL` SVG rendering fails silently for some icon IDs.
- **Fix:** Add fallback icon. Test all 153 icons. Log failures.

---

## MEDIUM FINDINGS (friction — fix for v1.0)

### M01. No offline/reconnect handling
Close laptop → reopen → stale data. No "reconnecting..." banner. WebSocket doesn't auto-reconnect.

### M02. French/English mixed throughout
"Territoire unique · Hexod Saison 1", "Bienvenue sur Hexod", tooltip text in French. Richard's market is global.
**Fix:** Complete i18n pass. All user-facing text through `i18n.ts`.

### M03. Zero accessibility
Only 1 `aria-` attribute in entire codebase. No keyboard navigation. Screen readers see nothing useful.
**Fix:** Add aria-labels to all interactive elements. Tab order. Focus management.

### M04. No mobile layout optimization
Only 15 references to mobile/responsive. Panels are 960px max but no phone-specific layouts. Dock buttons tiny on iPhone SE.
**Fix:** Responsive breakpoints. Touch-friendly tap targets (44px minimum). Swipe gestures.

### M05. No error recovery for API failures
If backend is down, everything silently fails. No retry logic, no offline banner, no cached state.
**Fix:** React Query retry + offline detection + error boundary per panel.

### M06. Map performance at scale
1000+ owned territories → GameMap redraws all hex polygons on every store change. No virtualization.
**Fix:** Leaflet.markercluster or viewport-only rendering for owned territories.

### M07. Token3D opens on EVERY territory click
Including empty unclaimed hexes. Should only open for owned or POI territories. Empty hex → just show HexCard claim options.
**Fix:** Conditional: if territory has no rarity/POI, show simple claim card, not Token3D.

### M08. Wallet withdraw/convert not functional
CryptoPanel has Convert/Withdraw modals but they call endpoints that don't process real transactions.
**Fix:** Backend crypto processing or clear "Coming at launch" messaging.

### M09. No data validation on frontend forms
Alliance creation: no tag length validation. Profile: no display name sanitization. Pins: no coordinate bounds check.
**Fix:** Zod or yup validation schemas.

### M10. Shop purchase doesn't update balance in real-time
Buy an item → balance in HUD doesn't change until page refresh.
**Fix:** After purchase, invalidate balance query or update Zustand store.

---

## LOW FINDINGS (polish — nice for launch)

### L01. No page transition animations between routes
Login → Game is instant with no transition. Feels jarring.

### L02. No skeleton loaders for panels
Opening Empire/Codex/Events shows blank then pops content. Should show skeletons.

### L03. Dock labels truncated on narrow screens
"Market" and "Safari" might clip on small phones.

### L04. No favicon or PWA manifest
Browser tab shows default React icon. No "Add to Home Screen" support.

### L05. No analytics/telemetry
No way to know which features are used, where players drop off, session lengths.

### L06. Admin panel is basic
`/gm` exists but can't manage events, approve marketplace listings, or monitor real-time stats.

### L07. No "what's new" changelog
Players returning after update have no idea what changed.

### L08. Globe view Earth texture loads from Wikipedia
External dependency. Should be self-hosted. Also no territory borders visible on globe.

### L09. Booster opening animation doesn't show real tokens
`BoosterOpenAnimation` receives mock card data, not real minted tokens.

### L10. No tutorial for returning players
Tutorial only runs once. No way to replay or get contextual tips.

---

## IMPERATIVE IMPROVEMENTS — PRIORITIZED BACKLOG

### 🔴 PHASE 1: Make It Real (2 weeks, blocks beta launch)

| # | Task | Effort | Impact |
|---|------|--------|--------|
| IMP-01 | **Wire Codex to real owned territories** — replace getMockCollection() with API call | L | CRITICAL — collection loop |
| IMP-02 | **Combat resolution engine** — POST /api/combat/attack/, ATK vs DEF, unit types, RNG | XL | CRITICAL — PvP loop |
| IMP-03 | **Leaderboard from backend** — wire LadderPanel to LeaderboardSnapshot model | M | CRITICAL — competition |
| IMP-04 | **Event engine** — Event model, Celery scheduler, registration, luck resolution, mint | XL | CRITICAL — daily mode 1/3 |
| IMP-05 | **Safari engine** — SafariTarget model, assign/track/capture endpoints, radar wiring | XL | CRITICAL — daily mode 2/3 |
| IMP-06 | **Marketplace buy/sell flow** — list territory, buy with HEX, transfer ownership | L | CRITICAL — crypto revenue |
| IMP-07 | **Seed mission templates** — management command with 20+ templates | S | HIGH — daily tasks need data |
| IMP-08 | **Wire achievements to backend** — ProfilePanel reads from /api/progression/ | M | HIGH — progression loop |

### 🟡 PHASE 2: Make It Solid (2 weeks, blocks public launch)

| # | Task | Effort | Impact |
|---|------|--------|--------|
| IMP-09 | **WebSocket live territory updates** — GameMap listens to ws/map/ for real-time | M | HIGH — multiplayer feel |
| IMP-10 | **Pending claim auto-completion** — render ClaimProgressBar in GameMap + HexCard | M | HIGH — explore mechanic |
| IMP-11 | **Alliance chat WebSocket frontend** — useAllianceChat hook, real messages | M | HIGH — social loop |
| IMP-12 | **Sound engine** — 10 sounds (claim, battle, notification, UI clicks, level up) | L | HIGH — game feel |
| IMP-13 | **Smart Token3D opening** — only for owned/POI territories, simple card for empty | S | MEDIUM — UX |
| IMP-14 | **Empire real resources** — aggregate from kingdom territories, not hardcoded | M | HIGH — strategy depth |
| IMP-15 | **i18n full pass** — extract all strings, EN/FR at minimum | L | MEDIUM — global market |
| IMP-16 | **Balance real-time sync** — invalidate queries after purchase/claim | S | MEDIUM — trust |

### 🟢 PHASE 3: Make It Shine (2 weeks, for v1.0 polish)

| # | Task | Effort | Impact |
|---|------|--------|--------|
| IMP-17 | **Mobile responsive pass** — phone layouts, touch targets, swipe gestures | L | MEDIUM — 60% of users |
| IMP-18 | **Offline/reconnect handling** — banner, WebSocket reconnect, stale data detection | M | MEDIUM — reliability |
| IMP-19 | **Error boundaries per panel** — graceful failure, retry buttons | M | MEDIUM — stability |
| IMP-20 | **Map performance at scale** — viewport-only rendering, debounced redraws | M | MEDIUM — 1000+ territories |
| IMP-21 | **Frontend form validation** — Zod schemas for all inputs | M | MEDIUM — data quality |
| IMP-22 | **Accessibility pass** — aria-labels, keyboard nav, focus management | L | MEDIUM — inclusivity |
| IMP-23 | **PWA manifest + favicon** — installable, proper branding | S | LOW — professionalism |
| IMP-24 | **Analytics integration** — PostHog or Plausible, key funnel events | M | LOW — growth data |

### 🔵 PHASE 4: Game of the Year (ongoing)

| # | Task | Effort | Impact |
|---|------|--------|--------|
| IMP-25 | **Seasonal events system** — time-limited challenges, rotating content | XL | Retention |
| IMP-26 | **Guild wars** — alliance vs alliance coordinated battles | XL | Endgame |
| IMP-27 | **Territory image database** — real photos per territory, not generic Unsplash | XL | Wow factor |
| IMP-28 | **Push notifications** — FCM/APNs for mobile, streak risk, attack alerts | L | Re-engagement |
| IMP-29 | **Replay/spectate battles** — animated battle resolution, shareable | XL | Viral |
| IMP-30 | **Modding/UGC** — player-created challenges, custom kingdom skins | XL | Community |

---

## SECURITY CONCERNS

| ID | Issue | Severity | Fix |
|----|-------|----------|-----|
| SEC-01 | `dangerouslySetInnerHTML` in iconBank.tsx with SVG data | MEDIUM | Sanitize SVG or use React components |
| SEC-02 | No rate limiting on claim/register endpoints | HIGH | Add DRF throttle classes |
| SEC-03 | Admin credentials in claude.md (`admin@td.com / admin123`) | HIGH | Remove from docs, use env vars |
| SEC-04 | GPS spoofing not verified server-side | HIGH | Cross-check IP geolocation vs claimed GPS |
| SEC-05 | No CAPTCHA on register/login | MEDIUM | Add hCaptcha or Turnstile |
| SEC-06 | JWT refresh token in Zustand (localStorage) | LOW | HttpOnly cookie preferred |
| SEC-07 | `dev-secret-key-not-for-production` in settings | CRITICAL for prod | Must set via env var |

---

## SCALABILITY CONCERNS

| Issue | When it breaks | Fix |
|-------|---------------|-----|
| SQLite database | >100 concurrent users | Switch to PostgreSQL |
| All territories in Zustand store | >10K territories loaded | Viewport-only loading + pagination |
| H3 grid_disk computation on every hover | >zoom 10 with large radius | Debounce + web worker |
| No CDN for static assets | Global users, high latency | CloudFront or Cloudflare |
| Single Django process | >50 req/s | Gunicorn + NGINX + Redis for channels |
| No database indexes on hot queries | >100K territories | Add compound indexes on (owner, h3_index) |

---

## VERDICT

**The SHELL is grade A.** UI design, component architecture, panel system, 3D token viewer, icon bank, kingdom borders — all exceptional quality.

**The ENGINE is grade D.** Core game loops (combat, events, safari, marketplace, leaderboard) are mock/placeholder. A player can register, claim 1 territory, and see a beautiful 3D token — but can't actually PLAY the game beyond that.

**Path to Game of the Year:**
1. Wire the 6 CRITICAL backends (Codex, Combat, Leaderboard, Events, Safari, Marketplace)
2. Connect all frontend panels to real data
3. Mobile responsive pass
4. Sound + polish
5. Beta test with 50 real humans
6. Iterate on feedback

**Estimated effort to production-ready beta: ~6-8 weeks at current velocity.**
