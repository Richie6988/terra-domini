/**
 * Zustand global store.
 * Slices: auth, game (territories, battles), ui, tdc
 */
import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
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
  resolveBattle: (battleId: string) => void
}

// ─── TDC Slice ───────────────────────────────────────────────────────────────

interface TDCState {
  balance: TDCBalance | null
  recentTransactions: unknown[]
  setBalance: (balance: TDCBalance) => void
  updateInGameBalance: (amount: number) => void
}

// ─── UI Slice ─────────────────────────────────────────────────────────────────

interface UIState {
  sidebarOpen: boolean
  activePanel: 'territory' | 'combat' | 'alliance' | 'shop' | 'profile' | 'events' | null
  notifications: GameNotification[]
  wsConnected: boolean
  isMobile: boolean

  setSidebarOpen: (open: boolean) => void
  setActivePanel: (panel: UIState['activePanel']) => void
  addNotification: (n: GameNotification) => void
  dismissNotification: (index: number) => void
  setWsConnected: (connected: boolean) => void
}

// ─── Combined Store ───────────────────────────────────────────────────────────

type Store = AuthState & GameState & TDCState & UIState

export const useStore = create<Store>()(
  persist(
    (set, get) => ({
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
          map[t.h3] = t
          if (player && t.owner_id === player.id) mySet.add(t.h3)
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
          if (player && territory.owner_id === player.id) mySet.add(territory.h3)
          else if (player && territory.owner_id !== player.id) mySet.delete(territory.h3)
          return {
            territories: { ...state.territories, [territory.h3]: territory },
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

      resolveBattle: (battleId) => set((state) => {
        const battle = state.activeBattles.find(b => b.id === battleId)
        return {
          activeBattles: state.activeBattles.filter(b => b.id !== battleId),
          recentBattleResults: battle
            ? [battle, ...state.recentBattleResults.slice(0, 9)]
            : state.recentBattleResults,
        }
      }),

      // ── TDC ─────────────────────────────────────────────────────────────
      balance: null,
      recentTransactions: [],

      setBalance: (balance) => set({ balance }),
      updateInGameBalance: (amount) => set((state) => ({
        balance: state.balance
          ? { ...state.balance, in_game: state.balance.in_game + amount }
          : null,
        player: state.player
          ? { ...state.player, tdc_in_game: state.player.tdc_in_game + amount }
          : null,
      })),

      // ── UI ──────────────────────────────────────────────────────────────
      sidebarOpen: false,
      activePanel: null,
      notifications: [],
      wsConnected: false,
      isMobile: window.innerWidth < 768,

      setSidebarOpen: (open) => set({ sidebarOpen: open }),
      setActivePanel: (panel) => set({ activePanel: panel, sidebarOpen: panel !== null }),
      addNotification: (n) => set((state) => ({
        notifications: [n, ...state.notifications.slice(0, 19)],
      })),
      dismissNotification: (index) => set((state) => ({
        notifications: state.notifications.filter((_, i) => i !== index),
      })),
      setWsConnected: (connected) => set({ wsConnected: connected }),
    }),
    {
      name: 'terra-domini-store',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        // Only persist auth + preferences
        player: state.player,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        isAuthenticated: state.isAuthenticated,
        mapCenter: state.mapCenter,
        mapZoom: state.mapZoom,
      }),
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
export const useNotifications = () => useStore((s) => s.notifications)
export const useWsConnected = () => useStore((s) => s.wsConnected)
