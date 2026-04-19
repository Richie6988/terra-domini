// FORCE_REBUILD_TS: 1773933342
/**
 * Zustand global store.
 * Slices: auth, game (territories, battles), ui, tdc
 */
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type {
  Player, TerritoryLight, TerritoryDetail,
  Battle, TDCBalance, GameNotification
} from '../types'

// ─── Auth Slice ───────────────────────────────────────────────────────────────

interface AuthState {
  player: Player | null
  accessToken: string | null
  refreshToken: string | null
  isAuthenticated: boolean
  setAuth: (player: Player, access: string, refresh: string) => void
  updatePlayer: (partial: Partial<Player>) => void
  logout: () => void
}

// ─── Game Slice ───────────────────────────────────────────────────────────────

interface GameState {
  // Territory map state (keyed by h3_index)
  territories: Record<string, TerritoryLight>
  selectedTerritory: TerritoryDetail | null
  hoveredH3: string | null
  myTerritories: Set<string>

  // Viewport
  mapCenter: [number, number]
  mapZoom: number

  // Battles
  activeBattles: Battle[]
  recentBattleResults: Battle[]

  // Territory actions
  setTerritories: (territories: TerritoryLight[]) => void
  upsertTerritory: (territory: TerritoryLight) => void
  setSelectedTerritory: (territory: TerritoryDetail | null) => void
  setHoveredH3: (h3: string | null) => void
  setMapCenter: (center: [number, number], zoom?: number) => void
  addBattle: (battle: Battle) => void
  resolveBattle: (battleId: string, result?: unknown) => void
}

// ─── HEX Coin Slice ───────────────────────────────────────────────────────────────

interface TDCState {
  balance: TDCBalance | null
  recentTransactions: unknown[]
  setBalance: (balance: TDCBalance) => void
  updateInGameBalance: (amount: number) => void
}

// ─── UI Slice ─────────────────────────────────────────────────────────────────

interface UIState {
  sidebarOpen: boolean
  godMode: boolean
  toggleGodMode: () => void
  pickingFavorite: boolean
  setPickingFavorite: (v: boolean) => void
  activePanel: 'territory' | 'combat' | 'alliance' | 'shop' | 'profile' | 'events' | 'trade' | 'crypto' | 'ladder' | 'meta' | 'marketplace' | 'kingdom' | 'codex' | 'hunt' | 'tasks' | 'auction' | 'empire' | 'info' | null
  notifications: GameNotification[]
  wsConnected: boolean
  isMobile: boolean

  setSidebarOpen: (open: boolean) => void
  setActivePanel: (panel: UIState['activePanel']) => void
  addNotification: (n: GameNotification) => void
  dismissNotification: (index: number) => void
  setWsConnected: (connected: boolean) => void
}

// ─── Settings Slice (persisted user preferences that ACTUALLY affect the game) ──

export type MapTheme = 'dark' | 'light' | 'satellite' | 'topo'
export type Language = 'en' | 'fr' | 'es' | 'de'

interface SettingsState {
  // Sound
  masterSound: boolean
  musicEnabled: boolean
  sfxEnabled: boolean
  // Map
  mapTheme: MapTheme
  // Other
  notificationsEnabled: boolean
  language: Language

  setMasterSound: (v: boolean) => void
  setMusicEnabled: (v: boolean) => void
  setSfxEnabled: (v: boolean) => void
  setMapTheme: (t: MapTheme) => void
  setNotificationsEnabled: (v: boolean) => void
  setLanguage: (l: Language) => void
}

// ─── Combined Store ───────────────────────────────────────────────────────────

type Store = AuthState & GameState & TDCState & UIState & SettingsState

export const useStore = create<Store>()(
  persist<Store>(
    (set: (fn: Partial<Store> | ((state: Store) => Partial<Store>)) => void, get: () => Store) => ({
      // ── Auth ────────────────────────────────────────────────────────────
      player: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,

      setAuth: (player, access, refresh) => set({
        player,
        accessToken: access,
        refreshToken: refresh,
        isAuthenticated: true,
      }),

      updatePlayer: (partial) => set((state) => ({
        player: state.player ? { ...state.player, ...partial } : null
      })),

      logout: () => set({
        player: null,
        accessToken: null,
        refreshToken: null,
        isAuthenticated: false,
        territories: {},
        selectedTerritory: null,
        activeBattles: [],
        balance: null,
      }),

      // ── Game ────────────────────────────────────────────────────────────
      territories: {},
      selectedTerritory: null,
      hoveredH3: null,
      myTerritories: new Set(),
      mapCenter: [48.8566, 2.3522],  // Default: Paris
      mapZoom: 15,
      activeBattles: [],
      recentBattleResults: [],

      setTerritories: (territories) => {
        const map: Record<string, TerritoryLight> = {}
        const player = get().player
        const mySet = new Set<string>()
        for (const t of territories) {
          map[t.h3_index ?? t.h3] = t
          if (player && t.owner_id === player.id) mySet.add(t.h3_index ?? t.h3)
        }
        set((state) => ({
          territories: { ...state.territories, ...map },
          myTerritories: new Set([...state.myTerritories, ...mySet]),
        }))
      },

      upsertTerritory: (territory) => {
        const player = get().player
        set((state) => {
          const mySet = new Set(state.myTerritories)
          if (player && territory.owner_id === player.id) mySet.add(territory.h3_index ?? territory.h3)
          else if (player && territory.owner_id !== player.id) mySet.delete(territory.h3_index ?? territory.h3)
          return {
            territories: { ...state.territories, [territory.h3_index ?? territory.h3]: territory },
            myTerritories: mySet,
          }
        })
      },

      setSelectedTerritory: (territory) => set({ selectedTerritory: territory }),
      setHoveredH3: (h3) => set({ hoveredH3: h3 }),
      setMapCenter: (center, zoom) => set((state) => ({
        mapCenter: center,
        mapZoom: zoom ?? state.mapZoom,
      })),

      addBattle: (battle) => set((state) => ({
        activeBattles: [battle, ...state.activeBattles.filter(b => b.id !== battle.id)],
      })),

      resolveBattle: (battleId, _result?) => set((state) => {
        const battle = state.activeBattles.find(b => b.id === battleId)
        return {
          activeBattles: state.activeBattles.filter(b => b.id !== battleId),
          recentBattleResults: battle
            ? [battle, ...(state.recentBattleResults ?? []).slice(0, 9)]
            : state.recentBattleResults,
        }
      }),

      // ── HEX Coin ─────────────────────────────────────────────────────────────
      balance: null,
      recentTransactions: [],

      setBalance: (balance) => set({ balance }),
      updateInGameBalance: (amount) => set((state) => ({
        balance: state.balance
          ? { ...state.balance, in_game: state.balance.in_game + amount }
          : null,
        player: state.player
          ? { ...state.player, tdc_in_game: parseFloat(String(state.player.tdc_in_game ?? 0)) + amount }
          : null,
      })),

      // ── UI ──────────────────────────────────────────────────────────────
      sidebarOpen: false,
      godMode: false,
      toggleGodMode: () => set((s) => ({ godMode: !s.godMode })),
      pickingFavorite: false,
      setPickingFavorite: (v) => set({ pickingFavorite: v }),
      activePanel: null,
      notifications: [],
      wsConnected: false,
      isMobile: window.innerWidth < 768,

      setSidebarOpen: (open) => set({ sidebarOpen: open }),
      setActivePanel: (panel) => set({ activePanel: panel, sidebarOpen: panel !== null }),
      addNotification: (n) => set((state) => ({
        notifications: [n, ...(state.notifications ?? []).slice(0, 19)],
      })),
      dismissNotification: (index) => set((state) => ({
        notifications: state.notifications.filter((_, i) => i !== index),
      })),
      setWsConnected: (connected) => set({ wsConnected: connected }),

      // ── Settings (persisted) ──────────────────────────────────────────
      masterSound: true,
      musicEnabled: true,
      sfxEnabled: true,
      mapTheme: 'dark',
      notificationsEnabled: true,
      language: 'en',
      setMasterSound: (v) => set({ masterSound: v }),
      setMusicEnabled: (v) => set({ musicEnabled: v }),
      setSfxEnabled: (v) => set({ sfxEnabled: v }),
      setMapTheme: (t) => set({ mapTheme: t }),
      setNotificationsEnabled: (v) => set({ notificationsEnabled: v }),
      setLanguage: (l) => set({ language: l }),
    }),
    {
      name: 'hexod-store',
      // @ts-ignore — Zustand persist storage adapter
      storage: {
        getItem: (name: string): any => {
          try { return JSON.parse(localStorage.getItem(name) || 'null') } catch { return null }
        },
        setItem: (name: string, value: any) => {
          try { localStorage.setItem(name, JSON.stringify(value)) } catch {}
        },
        removeItem: (name: string) => {
          try { localStorage.removeItem(name) } catch {}
        },
      },
      partialize: (state: Store) => ({
        // Only persist auth + preferences
        player: state.player,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        isAuthenticated: state.isAuthenticated,
        mapCenter: state.mapCenter,
        mapZoom: state.mapZoom,
        // Settings that affect gameplay (survive reloads)
        masterSound: state.masterSound,
        musicEnabled: state.musicEnabled,
        sfxEnabled: state.sfxEnabled,
        mapTheme: state.mapTheme,
        notificationsEnabled: state.notificationsEnabled,
        language: state.language,
      }) as any,
    }
  )
)

// Selectors
export const usePlayer = () => useStore((s) => s.player)
export const useAuth = () => useStore((s) => ({ isAuthenticated: s.isAuthenticated, player: s.player }))
export const useTDCBalance = () => useStore((s) => s.balance)
export const useActiveBattles = () => useStore((s) => s.activeBattles)
export const useSelectedTerritory = () => useStore((s) => s.selectedTerritory)
export const useMyTerritories = () => useStore((s) => s.myTerritories)
export const useGodMode = () => useStore((s) => s.godMode)
export const useNotifications = () => useStore((s) => s.notifications)
export const useWsConnected = () => useStore((s) => s.wsConnected)

// Settings selectors
export const useMasterSound = () => useStore((s) => s.masterSound)
export const useMusicEnabled = () => useStore((s) => s.musicEnabled)
export const useSfxEnabled = () => useStore((s) => s.sfxEnabled)
export const useMapTheme = () => useStore((s) => s.mapTheme)
export const useNotificationsEnabled = () => useStore((s) => s.notificationsEnabled)
export const useLanguage = () => useStore((s) => s.language)
