# HEXOD — Production Specification Document
## From Prototype to Production • React + Django

---

# TABLE OF CONTENTS

1. [Architecture Overview](#1-architecture-overview)
2. [Shared State & API Contract](#2-shared-state--api-contract)
3. [Lead Dev — Global System Prompt](#3-lead-dev--global-system-prompt)
4. [Module Specifications](#4-module-specifications)
   - M01: Core Shell & Navigation
   - M02: Auth & Profile
   - M03: HUD & News Ticker
   - M04: Radar Filters
   - M05: Empire & Kingdoms (Profile tab)
   - M06: Shop & Boosters
   - M07: Military Command
   - M08: Events System
   - M09: Daily Hunts
   - M10: Alliance & Guild
   - M11: Trade & Marketplace
   - M12: Task Center (Gig)
   - M13: Wallet & Crypto
   - M14: Codex (Pokédex)
   - M15: Ladder & Rankings
   - M16: Info & Database
   - M17: Radar Widget
   - M18: Map Engine
5. [Django Backend API Reference](#5-django-backend-api-reference)
6. [WebSocket Events Catalog](#6-websocket-events-catalog)
7. [Database Models Overview](#7-database-models-overview)

---

# 1. ARCHITECTURE OVERVIEW

```
┌──────────────────────────────────────────────────┐
│                    FRONTEND                       │
│  React 18 + TypeScript + Zustand + TailwindCSS   │
│  Modules = independent components with own store  │
│  slices, communicating via shared PlayerContext   │
├──────────────────────────────────────────────────┤
│               TRANSPORT LAYER                     │
│  REST API (axios) + WebSocket (socket.io-client) │
├──────────────────────────────────────────────────┤
│                    BACKEND                         │
│  Django 5 + DRF + Channels (WebSocket)           │
│  PostgreSQL + Redis (cache/pubsub) + Celery      │
├──────────────────────────────────────────────────┤
│                  BLOCKCHAIN                        │
│  Solana (NFT tokens) + HEX ERC-20 (Ethereum L2) │
│  Web3.js / Phantom wallet integration            │
└──────────────────────────────────────────────────┘
```

### Tech Stack Decisions

- **React 18** with TypeScript strict mode
- **Zustand** for state (lightweight, no boilerplate vs Redux)
- **TanStack Query** for server state / API caching
- **Socket.io-client** for real-time events (battles, chat, ticker)
- **Framer Motion** for animations (modals, battles, transitions)
- **Leaflet** or **MapLibre GL** for the hex map
- **Three.js** for Codex 3D museum
- **TailwindCSS** with custom design tokens matching prototype CSS variables
- **Django REST Framework** for API
- **Django Channels** for WebSocket
- **Celery + Redis** for background tasks (event timers, resource extraction, war resolution)
- **PostgreSQL** with PostGIS extension (geo queries for hex territories)

### File Structure

```
hexod/
├── frontend/
│   ├── src/
│   │   ├── app/                    # App shell, routing, providers
│   │   ├── shared/                 # Shared types, hooks, utils
│   │   │   ├── types/              # Global TypeScript interfaces
│   │   │   ├── hooks/              # usePlayer, useSocket, useCrystals
│   │   │   ├── stores/             # Zustand stores
│   │   │   ├── api/                # Axios instance, API helpers
│   │   │   └── components/         # Button, Modal, Toast, CrystalIcon
│   │   ├── modules/
│   │   │   ├── auth/               # M02
│   │   │   ├── hud/                # M03
│   │   │   ├── radar/              # M04
│   │   │   ├── empire/             # M05
│   │   │   ├── shop/               # M06
│   │   │   ├── military/           # M07
│   │   │   ├── events/             # M08
│   │   │   ├── hunts/              # M09
│   │   │   ├── alliance/           # M10
│   │   │   ├── trade/              # M11
│   │   │   ├── gig/                # M12
│   │   │   ├── wallet/             # M13
│   │   │   ├── codex/              # M14
│   │   │   ├── ladder/             # M15
│   │   │   ├── info/               # M16
│   │   │   ├── radar-widget/       # M17
│   │   │   └── map/                # M18
│   │   └── design/                 # Design tokens, theme, fonts
│   └── public/
├── backend/
│   ├── core/                       # User model, auth, middleware
│   ├── game/                       # Kingdoms, resources, units
│   ├── economy/                    # Crystals, HEX, trade, central bank
│   ├── military/                   # Units, wars, battles
│   ├── events/                     # Real-world event system
│   ├── hunts/                      # Daily hunt mechanics
│   ├── alliance/                   # Guilds, chat, defense pool
│   ├── codex/                      # Token collection, codex entries
│   ├── marketplace/                # NFT integration, P2P trades
│   ├── gig/                        # Tasks, moderation, referral
│   ├── ladder/                     # Rankings, leaderboards
│   └── notifications/              # Push, email, in-game
└── blockchain/
    ├── solana/                     # NFT minting, metadata
    └── ethereum/                   # HEX token contract, staking
```

---

# 2. SHARED STATE & API CONTRACT

## 2.1 Core TypeScript Interfaces

Every module MUST import from `shared/types/`. No module defines its own Player or Currency types.

```typescript
// shared/types/player.ts
export interface Player {
  id: string;
  username: string;
  avatar: AvatarConfig;
  level: number;
  xp: number;
  xpToNext: number;
  vipStatus: boolean;
  seasonBadge: string | null;
  createdAt: string;
}

export interface AvatarConfig {
  text: string;           // "C07" or emoji "🐉"
  gradient: [string, string]; // ["#0099cc", "#cc8800"]
  borderStyle: 'solid' | 'double' | 'dashed' | 'ridge';
  frameId: string;        // "default" | "fire" | "mystic" | ...
  isPremium: boolean;
}

// shared/types/economy.ts
export interface PlayerEconomy {
  crystals: number;       // In-game currency (◆)
  hexBalance: number;     // HEX cryptocurrency
  hexStaked: number;
  stakingApy: number;
  walletAddress: string;
  walletNetwork: 'ethereum_l2' | 'solana';
  verified: boolean;
}

export interface Resources {
  wood: number;
  steel: number;
  uranium: number;
  energy: number;
}

export interface ResourceRates {
  wood: number;     // per hour
  steel: number;
  uranium: number;
  energy: number;   // can be negative (unit consumption)
}

// Crystal is the ONLY in-game currency. 
// HEX is the ONLY cryptocurrency used in token marketplace.
// Crystals are earned in-game OR purchased with HEX (1 HEX = 5 ◆).
// There is NO "CX" label — always "◆" or "crystals".

// shared/types/kingdom.ts
export interface Kingdom {
  id: string;
  name: string;
  hexCount: number;
  shieldActive: boolean;
  shieldExpiresAt: string | null;
  warZone: boolean;
  attackerId: string | null;
  crystalOutput: number;   // per hour
  resources: ResourceRates;
  garrison: GarrisonSummary;
  color: string;           // hex color for map display
  capitalHexId: string;
  center: { lat: number; lng: number };
}

export interface GarrisonSummary {
  infantry: number;
  naval: number;
  aerial: number;
  engineer: number;
  medic: number;
  spy: number;
}

// shared/types/military.ts
export type UnitType = 'infantry' | 'naval' | 'aerial' | 'engineer' | 'medic' | 'spy';

export interface UnitConfig {
  type: UnitType;
  crystalCost: number;
  trainResources: { wood?: number; steel?: number; uranium?: number; energy?: number };
  trainTimeSeconds: number;
  power: number;
  icon: string;
  color: string;
}

export const UNIT_CONFIGS: Record<UnitType, UnitConfig> = {
  infantry: { type: 'infantry', crystalCost: 5, trainResources: { wood: 50, energy: 100 }, trainTimeSeconds: 600, power: 10, icon: '⚔', color: '#64748b' },
  naval:    { type: 'naval',    crystalCost: 15, trainResources: { wood: 500, steel: 200, energy: 1000 }, trainTimeSeconds: 1800, power: 30, icon: '🚢', color: '#3b82f6' },
  aerial:   { type: 'aerial',   crystalCost: 25, trainResources: { steel: 300, uranium: 50, energy: 2000 }, trainTimeSeconds: 3600, power: 50, icon: '✈', color: '#8b5cf6' },
  engineer: { type: 'engineer', crystalCost: 20, trainResources: { wood: 200, steel: 300, energy: 800 }, trainTimeSeconds: 1200, power: 15, icon: '🔧', color: '#f59e0b' },
  medic:    { type: 'medic',    crystalCost: 30, trainResources: { wood: 100, energy: 1500 }, trainTimeSeconds: 2400, power: 5, icon: '+', color: '#10b981' },
  spy:      { type: 'spy',      crystalCost: 100, trainResources: { steel: 100, uranium: 20, energy: 5000 }, trainTimeSeconds: 7200, power: 80, icon: '👁', color: '#ec4899' },
};

// shared/types/events.ts
export type EventStatus = 'live' | 'upcoming' | 'ended';
export type TokenRarity = 'common' | 'rare' | 'epic' | 'legendary';

export interface GameEvent {
  id: string;
  title: string;
  emoji: string;
  category: TokenCategory;
  status: EventStatus;
  location: { lat: number; lng: number; label: string };
  participantCount: number;
  maxParticipants: number;
  registrationCost: number; // crystals
  startsAt: string;
  endsAt: string;
  tokenAtStake: { emoji: string; rarity: TokenRarity | 'unknown' };
}

export interface EventResult {
  eventId: string;
  won: boolean;
  revealed: boolean;
  tokenRarity: TokenRarity | null;
  tokenEmoji: string | null;
  tokenCodexId: string | null;
}

// shared/types/codex.ts
export type TokenCategory = 
  'disaster' | 'places' | 'nature' | 'conflict' | 
  'culture' | 'science' | 'fantastic' | 'economy';

export interface CodexEntry {
  id: string;
  category: TokenCategory;
  subcategory: string;
  emoji: string;
  name: string;
  rarity: TokenRarity;
  owned: boolean;
  quantity: number;
  isShiny: boolean;
  isFavorite: boolean;
  favoriteRank: number | null;  // 1-5
  nftMinted: boolean;
  nftAddress: string | null;
}

export interface CodexCategoryProgress {
  category: TokenCategory;
  owned: number;
  total: number;
  percentage: number;
}

// shared/types/alliance.ts
export type GuildRole = 'leader' | 'officer' | 'veteran' | 'member';
export type MemberStatus = 'online' | 'in_combat' | 'offline';

export interface Guild {
  id: string;
  name: string;
  emblem: string;
  rank: number;       // global rank
  memberCount: number;
  maxMembers: number;
  totalPower: number;
  defensePool: number; // crystals
  defenseBonuses: DefenseBonus[];
  isRecruiting: boolean;
  minLevel: number;
  region: string;
  tier: 'local' | 'continental' | 'international' | 'legendary';
}

export interface DefenseBonus {
  id: string;
  name: string;
  description: string;
  unlockThreshold: number; // crystals needed
  unlocked: boolean;
  icon: string;
}

// shared/types/trade.ts
export type TradableResource = 'wood' | 'steel' | 'uranium' | 'energy' | 'crystal';

export interface ExchangeRate {
  resource: TradableResource;
  rateIndex: number;       // base rate
  change24h: number;       // percentage
  trend: 'up' | 'down' | 'stable';
}

// shared/types/hunt.ts
export type HuntMode = 'mystery' | 'continent' | 'region' | 'close' | 'found';

export interface DailyHunt {
  id: string;
  tokenEmoji: string;
  tokenName: string;
  tokenRarity: TokenRarity;
  clues: string[];
  currentClueIndex: number;
  distanceKm: number;
  direction: string;
  heatLevel: number;  // 0-100
  mode: HuntMode;
  resetsAt: string;
  found: boolean;
}

// shared/types/war.ts
export type BattlePhase = 'starting' | 'infantry' | 'naval' | 'aerial' | 'special' | 'final' | 'resolved';

export interface BattleState {
  id: string;
  attackerId: string;
  defenderId: string;
  attackerName: string;
  defenderName: string;
  attackerPower: number;
  defenderPower: number;
  attackerHp: number;     // 0-100
  defenderHp: number;
  troopBars: {
    attackerInfantry: number;
    defenderInfantry: number;
    attackerNaval: number;
    defenderNaval: number;
    attackerAerial: number;
    defenderAerial: number;
  };
  phase: BattlePhase;
  log: BattleLogEntry[];
  result: 'pending' | 'attacker_wins' | 'defender_wins';
  hexGained: number;
  hexLost: number;
}

export interface BattleLogEntry {
  timestamp: string;
  message: string;
  type: 'info' | 'damage' | 'critical' | 'heal';
  damageToAttacker: number;
  damageToDefender: number;
  troopAffected: UnitType | null;
}
```

## 2.2 Zustand Store Slices

Each module has its own Zustand slice. The root store composes them:

```typescript
// shared/stores/index.ts
import { create } from 'zustand';
import { playerSlice, PlayerSlice } from './playerSlice';
import { economySlice, EconomySlice } from './economySlice';
import { militarySlice, MilitarySlice } from './militarySlice';
// ... etc

export type AppStore = PlayerSlice & EconomySlice & MilitarySlice & /* ... */;

export const useStore = create<AppStore>()((...args) => ({
  ...playerSlice(...args),
  ...economySlice(...args),
  ...militarySlice(...args),
  // ... etc
}));
```

## 2.3 Crystal Icon Component (Shared)

```tsx
// shared/components/CrystalIcon.tsx
interface CrystalIconProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const sizes = { sm: 12, md: 16, lg: 22, xl: 28 };

export const CrystalIcon = ({ size = 'md', className }: CrystalIconProps) => (
  <svg viewBox="0 0 256 256" width={sizes[size]} height={sizes[size]} 
       className={`inline-block align-middle ${className || ''}`}>
    <path d="M128 20L70 110L128 230L186 110L128 20Z" fill="#7950f2"/>
    <path d="M128 20L100 120L128 230" stroke="white" strokeWidth="2" opacity="0.3"/>
  </svg>
);

// Usage: <CrystalIcon size="lg" /> or inline with text: {amount} <CrystalIcon />
```

## 2.4 Design Tokens

```typescript
// design/tokens.ts — mirrors prototype CSS variables
export const colors = {
  bgGlass: 'rgba(235, 242, 250, 0.95)',
  bgSecondary: 'rgba(220, 230, 242, 0.95)',
  borderSubtle: 'rgba(0, 60, 100, 0.15)',
  textPrimary: '#1a2a3a',
  textSecondary: '#0077aa',
  textMuted: 'rgba(26, 42, 58, 0.45)',
  hudCyan: '#0099cc',
  hudAmber: '#cc8800',
  hudAmberBright: '#fbbf24',
  stateActive: '#00884a',
  stateScanning: '#00ff55',
  stateAlert: '#dc2626',
  crystal: '#7950f2',
  categories: {
    disaster: '#f97316',
    places: '#6366f1',
    nature: '#7c3aed',
    knowledge: '#2563eb',
    economy: '#64748b',
    culture: '#d946ef',
    conflict: '#dc2626',
    life: '#22c55e',
    fantastic: '#a855f7',
    game: '#0ea5e9',
  }
};

export const fonts = {
  heading: "'Orbitron', system-ui, sans-serif",
  mono: "'Share Tech Mono', monospace",
};
```

---

# 3. LEAD DEV — GLOBAL SYSTEM PROMPT

```
You are the Lead Frontend Developer for HEXOD, a geo-strategic multiplayer browser 
game combining real-world map hexagonal territory control with cryptocurrency economics.

TECH STACK: React 18 + TypeScript (strict) + Zustand + TanStack Query + Framer Motion + 
TailwindCSS + Socket.io-client. Backend: Django 5 + DRF + Channels + PostgreSQL + Redis + Celery.
Blockchain: Solana (NFT) + Ethereum L2 (HEX token).

YOUR ROLE:
- Coordinate 18 module developers, each building one module in isolation
- Enforce shared type contracts (shared/types/*.ts) across ALL modules
- Wire all modules into the Core Shell (M01) via lazy-loaded routes
- Maintain the Zustand root store that composes all module slices
- Ensure WebSocket event bus connects real-time data to all consumers
- Review PRs for type safety, performance, and design token compliance

CRITICAL RULES:
1. NO module may define its own Player, Economy, or Resource types — import from shared/types/
2. ALL currency displays use <CrystalIcon /> component — never emoji or text
3. Crystal is the ONLY in-game currency. HEX is the ONLY crypto. No "CX" label anywhere.
4. Crystal purchases happen ONLY through HEX conversion (1 HEX = 5 ◆)
5. ALL modals use the shared <Modal /> component with glassmorphism styling
6. ALL toasts use the shared toast() hook — max 3 visible, auto-dismiss, click-dismiss
7. Every API call goes through the shared axios instance with auth interceptor
8. WebSocket connections are managed ONLY by the shared useSocket hook
9. Design tokens from design/tokens.ts — no hardcoded colors in modules
10. Animations via Framer Motion — no raw CSS animations except keyframes in Tailwind config
11. Right-click disabled globally via Core Shell
12. User-select disabled globally except on input/textarea

WIRING PATTERN:
- Core Shell renders: HUD (fixed top) + Map (full bg) + Dock (fixed bottom) + ModalProvider + ToastProvider
- Dock buttons call store.openModal('shop') which triggers ModalProvider to lazy-load the module
- Modules communicate via Zustand store actions, never direct imports between modules
- WebSocket events dispatch to store actions via a central event router in shared/hooks/useSocketRouter.ts

DEPLOYMENT:
- Frontend: Vite build → served by Django's whitenoise or CDN
- Backend: Django behind gunicorn + uvicorn (for Channels)
- DB: PostgreSQL + PostGIS 
- Cache: Redis
- Tasks: Celery workers for resource extraction ticks, war resolution, event lifecycle
```

---

# 4. MODULE SPECIFICATIONS

---

## M01: CORE SHELL & NAVIGATION

### Agent System Prompt

```
You build the Core Shell of HEXOD — the app frame that holds everything together.
You render the fixed layout (HUD top, Map background, Dock bottom), manage modal routing,
provide toast notifications, and enforce global protections (right-click disabled, user-select).

You do NOT build any module content — each modal's internals are lazy-loaded from their 
own module. You provide the <Modal /> wrapper, transition animations, overlay, sub-modal 
stack, and keyboard navigation (Escape closes sub first, then modal).

Tech: React 18 + Zustand + Framer Motion + TailwindCSS.
```

### TODO
- [x] App shell layout: fixed HUD top (70px), Map bg (100vh), Dock bottom (110px)
- [x] News ticker banner (28px fixed top, CSS scroll animation, data from API)
- [x] `<Modal />` component: glass overlay, scale-in animation, sticky header, scroll body, close button
- [x] `<SubModal />` component: higher z-index, separate overlay, stacks on top of Modal
- [ ] Modal routing: `useStore.openModal(id)` → lazy-imports module → renders in `<ModalProvider />`
- [x] `<DockButton />` component: hex-shaped icon, label, notification badge (count or text)
- [x] Dock layout: horizontal scroll on mobile, centered on desktop
- [ ] `<Toast />` system: max 3, auto-remove on animationend, click-to-dismiss, types: success/error/info/warning
- [x] Global: `oncontextmenu={e => e.preventDefault()}`, `user-select: none` except inputs
- [x] Keyboard: Escape chain (sub → modal → nothing), 'R' toggles radar panel
- [x] CRT scanline overlay (subtle, pointer-events: none)
- [ ] Responsive breakpoints: mobile (<480), tablet (<768), desktop

### DONE — Essential Code
```tsx
// app/Shell.tsx
const Shell = () => (
  <div onContextMenu={e => e.preventDefault()} className="select-none overflow-hidden h-screen">
    <NewsTicker />
    <HUD />
    <MapContainer />
    <RadarTrigger />
    <RadarWidget />
    <SoundToggle />
    <Dock />
    <ModalProvider />
    <SubModalProvider />
    <ToastProvider />
    <ScanlineOverlay />
  </div>
);
```

### Interfaces Exposed
```typescript
// What M01 provides to other modules:
openModal(id: string): void;
closeModal(): void;
openSubModal(id: string): void;
closeSubModal(): void;
toast(message: string, type: 'success'|'error'|'info'|'warning'): void;
```

---

## M02: AUTH & PROFILE

### Agent System Prompt

```
You build the Profile module of HEXOD. It contains player identity, stats, badges, 
settings, and avatar customization. Since v7, the Empire/Kingdoms section is embedded 
inside Profile Overview as expandable dropdowns (not a separate modal).

The Profile modal has 4 tabs: Overview (with kingdoms), Statistics, Badges, Settings.
Avatar Studio is a sub-modal with live preview, frame selector, border style, icon picker, 
and profile card preview.

Settings sub-modals: Security (2FA, password), Notifications (6 toggles), Privacy (5 toggles), 
Language (6 options), Change Username.

Kingdom dropdowns show: resource rates, troop count, teleport/detail/deploy actions.

You consume: PlayerSlice, EconomySlice, KingdomSlice from the store.
You dispatch: updateAvatar(), updateSettings(), teleportToKingdom().
```

### TODO
- [ ] Profile modal with 4 tabs (Overview, Statistics, Badges, Settings)
- [ ] Overview: avatar + name + level/badges, XP progress bar, active bonuses list
- [ ] **Kingdom accordion list** in Overview: expandable ▾/▴ per kingdom
  - [ ] Collapsed: icon + name + hex count + shield status + crystal rate
  - [ ] Expanded: resource grid (4 stats), troop count, 3 action buttons
  - [ ] War zone visual (red border, battle bar, blinking alert)
- [ ] Statistics tab: 12 stat blocks (wars, cards, gigs, time, etc.)
- [ ] Badges tab: grid of achievements (locked/unlocked with opacity)
- [ ] Settings tab: list items → each opens sub-modal
- [ ] Avatar Studio sub-modal:
  - [ ] Live preview (90px frame, updates in real-time)
  - [ ] 10 frame options (8 free + 2 locked), grid layout
  - [ ] Border style selector (4 options)
  - [ ] Icon input (text + emoji presets)
  - [ ] Profile card preview (what others see)
  - [ ] Save free / Premium save (100 ◆)
- [ ] Settings sub-modals: Security, Notifications, Privacy, Language, Username
- [ ] `toggleKingdomDetail(id)` expand/collapse animation

### DONE — Essential Code
```tsx
// modules/empire/KingdomAccordion.tsx
const KingdomAccordion = ({ kingdom }: { kingdom: Kingdom }) => {
  const [expanded, setExpanded] = useState(false);
  return (
    <>
      <div className="empire-kingdom" onClick={() => setExpanded(!expanded)}>
        <KingdomHexIcon kingdom={kingdom} />
        <KingdomSummary kingdom={kingdom} />
        <span>{expanded ? '▴' : '▾'}</span>
      </div>
      <AnimatePresence>
        {expanded && (
          <motion.div initial={{height:0,opacity:0}} animate={{height:'auto',opacity:1}} exit={{height:0,opacity:0}}>
            <KingdomDetail kingdom={kingdom} />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
```

### Store Slice
```typescript
interface PlayerSlice {
  player: Player | null;
  kingdoms: Kingdom[];
  activeBonuses: ActiveBonus[];
  badges: Badge[];
  updateAvatar: (config: AvatarConfig) => Promise<void>;
  updateSettings: (key: string, value: any) => Promise<void>;
  teleportToKingdom: (kingdomId: string) => void; // dispatches map center event
}
```

---

## M03: HUD & NEWS TICKER

### Agent System Prompt
```
You build the top HUD bar and news ticker for HEXOD.
Left segment: player avatar + commander label + empire size (clickable → opens Profile).
Right segment: crystal icon (SVG diamond #7950f2) + crystal balance (clickable → opens Resources).
News ticker: 28px bar above HUD, horizontal CSS scroll with duplicated items for seamless loop.
News items come from API: patch notes, live events, seasonal themes, maintenance, community.
Each news item has a colored dot + tag (LIVE/UPDATE/EVENT/MAINTENANCE).
```

### TODO
- [x] News ticker banner (28px fixed, horizontal scroll, auto-loop)
- [x] News item component with colored dot + bold title + description
- [x] HUD left: avatar frame + "Commander" label + "EMPIRE: 847 HEX"
- [x] HUD right: crystal SVG icon (28px with drop-shadow) + crystal balance
- [x] Both segments: glassmorphism card, hover lift, clickable
- [x] Slide-in animation on load
- [ ] Responsive: stack or shrink on mobile
- [ ] API: `GET /api/news/ticker/` → `NewsItem[]`

### DONE
```typescript
interface NewsItem {
  id: string;
  type: 'update' | 'event' | 'season' | 'maintenance' | 'community';
  title: string;
  description: string;
  createdAt: string;
}
```

---

## M04: RADAR FILTERS (Left Panel)

### Agent System Prompt
```
You build the Radar Filter Panel — a slide-out panel from the left edge.
Triggered by a circular glyph button on the left edge.
Contains 8 category sections, each with a 4-column grid of filter cells (emoji icons).
Clicking a cell toggles it active (glow + dot indicator). 
Active filter count displayed at bottom. "Reset All" button clears all.
Filter state dispatches to the Map module to show/hide hex token categories.
```

### TODO
- [x] Left trigger button (48px strip, circular glyph with pulse animation)
- [x] Panel: 380px slide-in from left, glassmorphism, scrollable
- [x] 8 category sections: Disasters, Places, Nature, Knowledge, Conflict, Culture, Economy, Fantastic
- [x] 4 filter cells per category (32 total), each with emoji + color
- [x] Toggle active state: border glow, corner dot, color highlight
- [x] Active filter counter: "X/32"
- [x] Reset All button
- [x] Close button inside panel
- [x] Close on outside click
- [ ] Dispatch `setActiveFilters(categories[])` to map store
- [x] Keyboard: 'R' toggles panel

### Store Slice
```typescript
interface RadarSlice {
  radarOpen: boolean;
  activeFilters: Set<string>;  // filter IDs
  toggleRadar: () => void;
  toggleFilter: (id: string) => void;
  clearFilters: () => void;
}
```

---

## M05: EMPIRE & KINGDOMS

**NOTE:** Empire content lives inside Profile Overview tab (M02). This module provides the data layer, kingdom detail sub-modals, and deploy troops sub-modal.

### TODO
- [ ] Kingdom detail sub-modal: stats grid, resources, teleport/shield/deploy
- [ ] Deploy troops sub-modal: per-unit-type input + deploy button
- [ ] Kingdom resource calculation (server-side tick via Celery every 5 min)
- [ ] War zone indicator: red border, animated battle bar, blinking
- [ ] API: `GET /api/kingdoms/`, `POST /api/kingdoms/{id}/deploy/`, `POST /api/kingdoms/{id}/shield/`

---

## M06: SHOP & BOOSTERS

### Agent System Prompt
```
You build the Shop module for HEXOD. 7 tabs: Boosters (flagship), Attack, Defense, 
Resources, Chance, Influence, Customize. Each tab lists purchasable items with crystal costs.

Boosters are the flagship product: 3 tiers (Standard 200◆, Rare 500◆, Legendary 1500◆).
Each contains 10 items (mix of territories, tokens, bonuses). Opening a booster triggers a 
sub-modal with reveal animation.

The "Buy Crystals" CTA at the bottom navigates to: close shop → open wallet → open buy-hex 
sub-modal. Crystal packs are priced in HEX, not fiat.

All purchases call buyItem(name, cost) which checks crystal balance and dispatches to API.
Customize tab items open their own sub-modals (avatar, flag, colors, media, livestream).
```

### TODO
- [ ] 7-tab layout (Boosters default active)
- [ ] Booster cards: 3-column grid, gradient borders, shimmer animation
- [ ] Booster opening sub-modal: animated reveal of 10 items in cascade
- [ ] Attack tab: 4 items (2x Mint, Distant, 2x Army, Blitz)
- [ ] Defense tab: 4 items (Shield, 2x Defense, Anti-Nuke, Influence Resist)
- [ ] Resources tab: 4 items (2x Extract, Energy Eff, Rare Drop, Trade Adv)
- [ ] Chance tab: 4 items (Card Rarity, Event Prob, Hunt Hints, Luck Boost)
- [ ] Influence tab: 4 items (Global Msg, Extended Vision, Brag Mode, Reserved Access)
- [ ] Customize tab: 5 items (Avatar, Flag, Colors, Media, Livestream) → sub-modals
- [ ] Buy Crystals CTA → chain navigation to wallet
- [ ] `buyItem(itemId, cost)` → check balance → API call → update store → toast
- [ ] API: `GET /api/shop/items/`, `POST /api/shop/purchase/`, `POST /api/shop/booster/open/`

### Store Slice
```typescript
interface ShopSlice {
  shopItems: ShopItem[];
  buyItem: (itemId: string) => Promise<{ success: boolean; message: string }>;
  openBooster: (tier: 'standard' | 'rare' | 'legendary') => Promise<BoosterResult>;
}

interface ShopItem {
  id: string;
  tab: string;
  name: string;
  description: string;
  cost: number;        // crystals
  icon: string;
  durationHours: number | null;
}

interface BoosterResult {
  items: Array<{
    type: 'territory' | 'token' | 'bonus';
    emoji: string;
    name: string;
    rarity: TokenRarity;
  }>;
}
```

---

## M07: MILITARY COMMAND

### Agent System Prompt
```
You build the Military module for HEXOD. 5 tabs: Recruit, Train, Deploy, War Room, History.

War Room is the most critical: shows ACTIVE WARS with live HP bars (blinking red alerts), 
nearby threats (intel/recon), and distant warfare matchmaking (±5 level search + attack).

Battle simulation sub-modal shows: main HP bars (YOU vs ENEMY) with percentage,
6 troop-specific bars (Infantry/Naval/Aerial × both sides), battle log with colored 
entries, and explosion effects on critical hits. Battle phases are received via WebSocket.

In production, battles are resolved server-side by Celery. The frontend receives phase 
updates via WebSocket and animates them.
```

### TODO
- [ ] Recruit tab: unit card grid with costs, click → recruit sub-modal (qty + cost calc)
- [ ] Train tab: queue display with progress bars + timer, initiate training
- [ ] Deploy tab: kingdom list with garrison → manage/reinforce buttons → deploy sub-modal
- [ ] War Room tab:
  - [ ] Active wars section (warzone-alert with blinking border, HP bar, reinforce button)
  - [ ] Nearby threats section (intel cards)
  - [ ] Distant warfare: search input + suggested targets (level-matched)
  - [ ] Click target → launch battle
- [ ] History tab: stats grid (30d) + war result list with WIN/LOSS badges
- [ ] Battle sub-modal:
  - [ ] Main HP bars with % (color changes when low)
  - [ ] 6 troop-specific bars (grid 2×3)
  - [ ] Battle log (scrollable, color-coded entries)
  - [ ] Explosion animation on crits
  - [ ] Victory/Defeat result with HEX gained/lost
- [ ] WebSocket: subscribe to `battle:{battleId}` channel for live updates
- [ ] API: `POST /api/military/recruit/`, `POST /api/military/train/`, `POST /api/military/deploy/`, `POST /api/military/attack/`, `GET /api/military/wars/`, `GET /api/military/history/`

### WebSocket Events (consumed)
```typescript
// From server during active battle:
{ event: 'battle_phase', data: { battleId, phase, log, hpAttacker, hpDefender, troopBars } }
{ event: 'battle_result', data: { battleId, result, hexGained, hexLost } }
// Global:
{ event: 'war_started', data: { attackerId, defenderId, kingdomId } }
{ event: 'war_ended', data: { battleId, winnerId } }
```

---

## M08: EVENTS SYSTEM

### Agent System Prompt
```
You build the Events module for HEXOD. 3 tabs: Live, Upcoming, Results.

Events are correlated to real-world news (earthquakes, sports, launches). Each event 
has 1 hexagonal token at stake. Players register (50◆), then come back after the event 
closes to discover if they won — and the token rarity as a surprise reveal.

Live tab: active events with hex token preview, participant count, register button.
Upcoming tab: future events with countdown.
Results tab: past events with tap-to-reveal surprise mechanic (hidden → tap → rarity shown).

NO minigame. NO card series. 1 token per event. Surprise reveal is key UX.
```

### TODO
- [ ] 3-tab layout (Live, Upcoming, Results)
- [ ] Live event card: warzone-style with LIVE badge, hex token preview (clip-path hexagon), participant counter
- [ ] Register sub-modal: cost confirmation + balance display
- [ ] Upcoming events: countdown timer, location label
- [ ] Results tab: tap-to-reveal cards (initial state = gift box, tap = animate reveal of token + rarity)
- [ ] Pending results show ⏳ indicator
- [ ] Event Rules sub-modal (static content)
- [ ] API: `GET /api/events/`, `POST /api/events/{id}/register/`, `GET /api/events/results/`

### Store Slice
```typescript
interface EventsSlice {
  events: GameEvent[];
  results: EventResult[];
  registerForEvent: (eventId: string) => Promise<void>;
  revealResult: (eventId: string) => Promise<EventResult>;
}
```

---

## M09: DAILY HUNTS

### Agent System Prompt
```
You build the Hunts module for HEXOD. One legendary token released daily.

The hunt starts as a mystery (🌍) and progressively reveals: continent → region → close.
The player sees the token to win (hex-shaped preview with emoji + name + rarity).

A "hunting radar" shows hot/cold progress bar (gradient blue→purple→red).
Deep Scan button: animates token rotation, reduces distance, updates heat level.
Buy Hint (25◆): reveals next clue text.
Red blinking alert when within 100m.

The hunt radar widget (M17) on the main map also reflects hunt state.
```

### TODO
- [ ] Hunt modal: token preview (hex clip-path, glow), name, rarity
- [ ] Hunt timer (resets daily)
- [ ] Hunting radar mode: hot/cold progress bar, mode label (mystery/continent/region/close)
- [ ] Clue box: current clue text, distance, direction, temperature
- [ ] Deep Scan button: animate token (rotate), API call, update distance/heat
- [ ] Buy Hint button: 25◆, reveals next clue
- [ ] Red dot alert when <100m (blinking warzone-style)
- [ ] Scan animation: token spins with `scan-rotate` keyframes + glow increase
- [ ] API: `GET /api/hunts/daily/`, `POST /api/hunts/scan/`, `POST /api/hunts/hint/`, `POST /api/hunts/claim/`
- [ ] Hunt state propagates to RadarWidget (M17)

### Store Slice
```typescript
interface HuntsSlice {
  dailyHunt: DailyHunt | null;
  performScan: () => Promise<{ newDistance: number; heatLevel: number; mode: HuntMode }>;
  buyHint: () => Promise<{ clue: string; clueIndex: number }>;
  claimToken: () => Promise<CodexEntry>;
}
```

---

## M10: ALLIANCE & GUILD

### Agent System Prompt
```
You build the Alliance module for HEXOD. 5 tabs: Find, My Guild, Chat, Defense, United Forces.

CRITICAL: By default the player is NOT in a guild. The Find tab is the default landing.
Defense and United Forces tabs show a LOCKED screen ("Join a guild first") if player 
has no guild. The locked screen has a CTA to go back to Find tab.

Find tab: search bar, top ranked guilds (global), local guilds recruiting, 
continental/international guilds, Create Guild button (costs 50 HEX).
Higher-ranked guilds give access to rare influence-locked territories.

My Guild tab: guild banner, stats, member list (online/combat/offline), settings.
Chat tab: real-time guild chat via WebSocket.
Defense Pool: crystals contributed to shared pool, which unlocks progressive defense 
bonuses (Auto-Shield, Reinforcement, Anti-Nuke Umbrella, Territory Regen).
United Forces: assign personal troops to guild army.
```

### TODO
- [ ] 5-tab layout, Find tab default
- [ ] Find tab: search, ranked guilds, local guilds, continental, Create Guild (50 HEX)
- [ ] Guild card component: name, rank, members, tier badge, join/apply button
- [ ] My Guild tab: banner, stats grid, member list, settings button
- [ ] Chat tab: real-time messages via WebSocket, message input, auto-scroll
- [ ] Defense tab: pool total, contribution input, progressive bonus unlock list (threshold + progress bar)
- [ ] United Forces tab: guild army stats + per-unit-type assignment inputs
- [ ] **LOCKED state** for Defense/Forces when `!player.guildId` → locked overlay with CTA
- [ ] Guild Settings sub-modal: name, description, recruitment toggles, min level, auto-defense, disband
- [ ] All Members sub-modal: generated list with status/role/level
- [ ] API: `GET /api/guilds/search/`, `POST /api/guilds/create/`, `POST /api/guilds/{id}/join/`, `GET /api/guilds/{id}/members/`, WebSocket: `guild:{guildId}` channel for chat

### Store Slice
```typescript
interface AllianceSlice {
  guild: Guild | null;
  guildMembers: GuildMember[];
  isInGuild: boolean;  // derived from guild !== null
  searchGuilds: (query: string) => Promise<Guild[]>;
  joinGuild: (guildId: string) => Promise<void>;
  createGuild: (name: string) => Promise<void>; // costs 50 HEX
  sendChatMessage: (message: string) => void;    // via WebSocket
  contributeDefense: (amount: number) => Promise<void>;
  assignTroops: (unitType: UnitType, count: number) => Promise<void>;
}
```

---

## M11: TRADE & MARKETPLACE

### Agent System Prompt
```
You build the Trade module for HEXOD. 2 tabs: Resources, Tokens (NFT).

Resources tab: shows Central Bank exchange rates for wood/steel/uranium/energy.
Click any resource → opens exchange sub-modal PRE-FILTERED on that resource.
Exchange sub-modal has Buy/Sell toggle, resource selector, exchange-for selector,
amount input, and live-calculated result. Any resource can be traded against any other 
resource OR crystals, following dynamic market rates with 2% fee.

Tokens tab: Solana blockchain NFT marketplace. Buy/sell territory NFTs and token NFTs.
NFT cards with hex-shaped or rounded previews, seller name, price in HEX.
Buy NFT → confirm in Phantom wallet. Sell → list from inventory.
```

### TODO
- [ ] 2-tab layout (Resources, Tokens)
- [ ] Resources tab: rate ticker cards (resource icon, name, trend, rate index)
- [ ] Click rate ticker → `openTradeFor(resource)` → pre-select in sub-modal
- [ ] Exchange sub-modal:
  - [ ] Buy/Sell toggle with visual state
  - [ ] Sell resource selector, Buy resource selector
  - [ ] Amount input with live calculation (rate × amount × 0.98 fee)
  - [ ] Result display box
  - [ ] Execute button → API call
- [ ] Tokens tab: Solana NFT marketplace
  - [ ] Trending tokens list (hex-shaped previews)
  - [ ] Territory NFTs
  - [ ] Buy NFT → Phantom wallet confirmation
  - [ ] Sell My Tokens / Sell Territory buttons
- [ ] API: `GET /api/trade/rates/`, `POST /api/trade/exchange/`, `GET /api/marketplace/listings/`, `POST /api/marketplace/buy/`, `POST /api/marketplace/list/`

### Store Slice
```typescript
interface TradeSlice {
  exchangeRates: ExchangeRate[];
  tradeMode: 'buy' | 'sell';
  executeExchange: (sell: TradableResource, buy: TradableResource, amount: number) => Promise<{ received: number }>;
  setTradeMode: (mode: 'buy' | 'sell') => void;
}
```

---

## M12: TASK CENTER (GIG)

### Agent System Prompt
```
You build the Gig/Task Center module for HEXOD. Daily tasks that earn HEX tokens.

Tasks: Verify Humanity (CAPTCHA), Enrich Territory (add photo/info), Moderation Duty
(review 10 reports), Content Creator (write location description), Login Streak.

Each task opens its own sub-modal with the actual task interface.
Moderation: cycles through 10 report cards with approve/dismiss/escalate.
Content Creator: assigned location, title + description (100 char min) + category tags.
Enrich: assigned hex, image URL + quick fact.

Referral system at bottom: shareable link, friend count, HEX earned from referrals.
Daily progress bar updates as tasks are completed.
```

### TODO
- [ ] Daily progress bar (X/5 completed, HEX earned)
- [ ] Task list: completed (greyed, strikethrough), active, premium (gold border)
- [ ] Login Streak claim button with streak counter
- [ ] Enrich sub-modal: assigned hex, image URL input, quick fact input
- [ ] Moderation sub-modal: 10-report cycle, 3 action buttons, progress counter, completion screen
- [ ] Content Creator sub-modal: location card, title input, description textarea (char count), category tags
- [ ] Referral section: shareable link, copy button, stats (invited/converted/earned)
- [ ] API: `GET /api/gig/tasks/`, `POST /api/gig/tasks/{id}/complete/`, `POST /api/gig/referral/`, `POST /api/gig/moderate/`

---

## M13: WALLET & CRYPTO

### Agent System Prompt
```
You build the Wallet module for HEXOD. 3 tabs: Overview, Staking, Transactions.

Overview: total HEX balance (big display), staked/available/monthly/30d change stats,
Buy HEX / Sell / Transfer buttons, wallet address display.

Buy HEX sub-modal: 2 payment methods (Credit Card, MetaMask), amount input with 
HEX preview, and a "Convert HEX → Crystals" section (1 HEX = 5 ◆).

Staking: active positions with progress bars, APY, unlock timer, stake more input.
Transactions: chronological list with type/amount/timestamp.

IMPORTANT: Crystal purchase happens HERE via HEX conversion, not in Shop.
```

### TODO
- [ ] 3-tab layout (Overview, Staking, Transactions)
- [ ] Overview: hero balance display, stats grid, action buttons, wallet address
- [ ] Buy HEX sub-modal: fiat (credit card) + MetaMask, amount input, preview
- [ ] HEX → Crystal converter sub-modal: amount input, rate display, convert button
- [ ] Staking tab: positions with progress bars, APY display, stake more
- [ ] Transactions tab: scrollable list with icons (▲ green / ▼ red), type, amount, time
- [ ] API: `GET /api/wallet/`, `POST /api/wallet/buy/`, `POST /api/wallet/convert/`, `POST /api/wallet/stake/`, `GET /api/wallet/transactions/`

---

## M14: CODEX (Pokédex)

### Agent System Prompt
```
You build the Codex module for HEXOD — a collection tracker for all tokens in the game.
9 tabs: Overview, Favorites, + 7 category tabs (Disasters, Places, Nature, Conflict, Culture, Science, Fantastic).

Overview: total progress (X/1000), 8 category cards with progress bars.
Favorites: top 5 player-ranked tokens (draggable reorder) + 3D Museum mockup (Three.js 
viewport with floating token pedestals, spotlights, perspective).

Category tabs: subcategory sections, each with a grid of token slots.
Owned slots: colored border, emoji, quantity badge, click for details.
Locked slots: grey "?" placeholder with ID number.
Shiny slots: gold border + glow animation.

The codex grid is generated dynamically from API data.
```

### TODO
- [ ] 9-tab layout (Overview, Favorites, 7 categories)
- [ ] Overview: total counter, 8 category progress cards, global progress bar
- [ ] Favorites tab: 5 draggable token cards (drag-to-reorder via @dnd-kit)
- [ ] 3D Museum viewport (Three.js): dark scene, 5 pedestals, floating tokens, spotlights, orbit controls
- [ ] Category tabs: subcategory headers with progress counter
- [ ] Codex grid: auto-fill responsive grid of token slots
- [ ] Slot states: owned (colored, emoji, qty), locked (grey ?), shiny (gold glow)
- [ ] Click owned slot → toast or detail sub-modal
- [ ] API: `GET /api/codex/`, `GET /api/codex/categories/`, `PATCH /api/codex/{id}/favorite/`

---

## M15: LADDER & RANKINGS

### Agent System Prompt
```
You build the Ladder module. 3 tabs: Country, Continent, World.
Each tab shows ranked player list. Top 3 have gold/silver/bronze badges.
Current player highlighted with cyan border and rank change indicator (↑ X).
```

### TODO
- [ ] 3-tab layout (Country with flag, Continent, World)
- [ ] Ranked list: rank badge, player name, HEX count, level, power
- [ ] Top 3: gold/silver/bronze row styling
- [ ] Current player: highlighted row, rank change arrow
- [ ] Separator line between top players and current player position
- [ ] API: `GET /api/ladder/?scope=country|continent|world`

---

## M16: INFO & DATABASE

### TODO
- [ ] 6 clickable sections → each opens sub-modal with rich text content
- [ ] Universe Lore, Game Mechanics, Tokenomics, Legal, FAQ, Changelog
- [ ] Version + build + server status at bottom
- [ ] Content from CMS or markdown files

---

## M17: RADAR WIDGET

### Agent System Prompt
```
You build the Radar Widget — a small fixed SVG element (100×100px) in the bottom-right.
Shows a rotating sweep line and colored blips representing nearby tokens/cards.
Blip colors match token categories. Center dot = player position.
Click → opens Radar Detail sub-modal (larger radar + list of detected tokens with distance).

When hunt is active, blips reflect hunt state (hot/cold, direction).
```

### TODO
- [ ] SVG radar: concentric circles, crosshairs, sweep animation (3s rotation)
- [ ] Blips: positioned based on real nearby token data, colored by category, pulse animation
- [ ] Center dot (cyan, player position)
- [ ] "N" indicator (red)
- [ ] Click → Radar Detail sub-modal: larger radar SVG + token list with distances
- [ ] Hunt mode integration: special blip for daily hunt token
- [ ] Label "CARD RADAR" below
- [ ] API: `GET /api/radar/nearby/?lat=X&lng=Y&radius=15000`

---

## M18: MAP ENGINE

### Agent System Prompt
```
You build the Map Engine — the full-screen background layer showing the hexagonal world.
Uses Leaflet or MapLibre GL with a custom hex tile layer.

Hexagons are colored by ownership (player color, enemy red, neutral grey, nature green).
Tokens appear as floating icons at exact GPS coordinates.
Events appear with animated markers.
Player kingdoms have borders and labels.

Interacts with: RadarSlice (filter visibility), HuntSlice (hunt target marker),
MilitarySlice (war zone indicators), EventSlice (event markers).
```

### TODO
- [ ] Full-screen map with OSM or custom tiles
- [ ] H3 hexagonal grid overlay (resolution 7-9)
- [ ] Hex coloring: owned (player color), enemy (red), unclaimed (grey)
- [ ] Kingdom borders with labels
- [ ] Token markers (emoji icons at GPS coords)
- [ ] Event markers (animated, category-colored)
- [ ] Hunt target marker (appears at zoom 16+)
- [ ] Filter integration: show/hide markers by active radar filters
- [ ] War zone visual: red pulsing border on attacked kingdoms
- [ ] Click hex: show info popup (owner, resources, enrichment)
- [ ] Teleport: `map.flyTo(kingdom.center, zoom)` when dispatched from empire

---

# 5. DJANGO BACKEND API REFERENCE

```
# Auth
POST   /api/auth/register/
POST   /api/auth/login/
POST   /api/auth/refresh/
GET    /api/auth/me/

# Player
GET    /api/player/profile/
PATCH  /api/player/avatar/
PATCH  /api/player/settings/

# Kingdoms
GET    /api/kingdoms/
GET    /api/kingdoms/{id}/
POST   /api/kingdoms/{id}/deploy/
POST   /api/kingdoms/{id}/shield/

# Economy
GET    /api/economy/balance/           # { crystals, resources }
POST   /api/economy/convert/           # HEX → Crystals

# Shop
GET    /api/shop/items/
POST   /api/shop/purchase/
POST   /api/shop/booster/open/

# Military
GET    /api/military/units/
POST   /api/military/recruit/
POST   /api/military/train/
POST   /api/military/deploy/
POST   /api/military/attack/
GET    /api/military/wars/
GET    /api/military/history/

# Events
GET    /api/events/                    # ?status=live|upcoming|ended
POST   /api/events/{id}/register/
GET    /api/events/results/
POST   /api/events/results/{id}/reveal/

# Hunts
GET    /api/hunts/daily/
POST   /api/hunts/scan/
POST   /api/hunts/hint/
POST   /api/hunts/claim/

# Alliance
GET    /api/guilds/search/             # ?q=name&scope=local|continental|global
POST   /api/guilds/create/
POST   /api/guilds/{id}/join/
GET    /api/guilds/{id}/members/
POST   /api/guilds/{id}/defense/contribute/
POST   /api/guilds/{id}/forces/assign/

# Trade
GET    /api/trade/rates/
POST   /api/trade/exchange/

# Marketplace (NFT)
GET    /api/marketplace/listings/      # ?type=token|territory
POST   /api/marketplace/buy/
POST   /api/marketplace/list/

# Gig
GET    /api/gig/tasks/
POST   /api/gig/tasks/{id}/complete/
GET    /api/gig/referral/
POST   /api/gig/moderate/

# Wallet
GET    /api/wallet/
POST   /api/wallet/buy/
POST   /api/wallet/stake/
GET    /api/wallet/transactions/

# Codex
GET    /api/codex/
GET    /api/codex/categories/
PATCH  /api/codex/{id}/favorite/

# Ladder
GET    /api/ladder/                    # ?scope=country|continent|world

# Radar
GET    /api/radar/nearby/              # ?lat=X&lng=Y&radius=15000

# News
GET    /api/news/ticker/

# Info
GET    /api/info/{section}/            # lore|mechanics|tokenomics|legal|faq|changelog
```

---

# 6. WEBSOCKET EVENTS CATALOG

```typescript
// ═══ Client → Server ═══
{ event: 'join_guild_chat', data: { guildId } }
{ event: 'guild_message', data: { guildId, message } }
{ event: 'join_battle', data: { battleId } }
{ event: 'player_position', data: { lat, lng } }  // for radar/hunt proximity

// ═══ Server → Client ═══
// Global (all connected players)
{ event: 'news_ticker', data: NewsItem }
{ event: 'event_started', data: GameEvent }
{ event: 'event_ended', data: { eventId, results: EventResult[] } }
{ event: 'rate_update', data: ExchangeRate[] }
{ event: 'global_message', data: { sender, message } }

// Player-specific
{ event: 'crystal_update', data: { crystals: number } }
{ event: 'resource_tick', data: Resources }           // every 5 min
{ event: 'war_declared', data: { attackerId, kingdomId } }
{ event: 'bonus_expired', data: { bonusId } }
{ event: 'hunt_proximity', data: { distance, heat, mode } }
{ event: 'event_result_ready', data: { eventId } }    // triggers reveal availability

// Battle channel (per battle)
{ event: 'battle_phase', data: BattleLogEntry }
{ event: 'battle_hp_update', data: { attackerHp, defenderHp, troopBars } }
{ event: 'battle_result', data: { result, hexGained, hexLost } }

// Guild channel
{ event: 'guild_chat_message', data: { sender, message, timestamp } }
{ event: 'member_status_change', data: { memberId, status: MemberStatus } }
{ event: 'defense_pool_update', data: { total, bonusesUnlocked } }
```

---

# 7. DATABASE MODELS OVERVIEW

```
User (Django AbstractUser extended)
├── Profile (1:1) — avatar, level, xp, vipStatus
├── Wallet (1:1) — hexBalance, hexStaked, walletAddress
├── GuildMembership (FK) — guild, role, joinedAt
├── Kingdoms (1:N) — name, hexCount, shield, color, center
│   ├── Garrison (1:1) — infantry, naval, aerial, engineer, medic, spy
│   └── ResourceOutput (1:1) — wood/hr, steel/hr, uranium/hr, energy/hr
├── Resources (1:1) — wood, steel, uranium, energy, crystals
├── ActiveBonuses (1:N) — bonusType, expiresAt
├── CodexEntries (M:N via CodexOwnership) — quantity, isShiny, isFavorite, favoriteRank
├── EventRegistrations (1:N) — event, result, revealed, tokenWon
├── WarHistory (1:N) — opponent, result, hexGained/Lost, timestamp
├── GigCompletions (1:N) — taskType, completedAt
├── Referrals (1:N) — referredUser, converted, hexEarned
└── Transactions (1:N) — type, amount, currency, timestamp

Guild
├── Members (1:N via GuildMembership)
├── DefensePool — totalCrystals, bonusesUnlocked[]
├── UnitedForces — infantry, naval, aerial totals
└── ChatMessages (1:N) — sender, message, timestamp

GameEvent
├── location (PostGIS Point)
├── status, startsAt, endsAt
├── tokenAtStake — emoji, category, rarity
└── Registrations (1:N) → results

DailyHunt
├── token — emoji, name, rarity, category
├── location (PostGIS Point)
├── clues[] — text[]
└── Claims (1:N) — player, claimedAt

CentralBankRates (singleton, updated daily by Celery)
├── woodRate, steelRate, uraniumRate, energyRate
└── lastUpdated

CodexToken (master catalog — 1000 entries)
├── category, subcategory, emoji, name, rarity
└── totalInCirculation

MarketplaceListing
├── seller, type (token|territory), price (HEX)
├── nftAddress (Solana)
└── status (active|sold|cancelled)
```

---

# APPENDIX: PRIORITY ORDER

Phase 1 (Core): M01 Shell, M03 HUD, M18 Map, M02 Profile (basic)
Phase 2 (Economy): M13 Wallet, M06 Shop, M11 Trade, M05 Empire
Phase 3 (Gameplay): M07 Military, M08 Events, M09 Hunts, M04 Radar
Phase 4 (Social): M10 Alliance, M15 Ladder, M12 Gig
Phase 5 (Collection): M14 Codex, M17 Radar Widget, M16 Info

Each phase delivers a playable increment. Phase 1 = you can see the map and your profile.
Phase 2 = you can earn and spend. Phase 3 = you can fight and explore. Phase 4 = you can 
collaborate. Phase 5 = you can collect and reference.

---

*Document generated from HEXOD prototype v7 (hexod-v7.html, 2659 lines)*
*Lead dev reference: all 16 modals, 37 sub-modals, 319 interactions mapped*
*Last updated: 2026-03-28*
