/**
 * API service — axios instance with JWT refresh interceptor.
 *
 * URL strategy:
 *  - In production (served by Django): use relative URLs → same origin, no CORS
 *  - In dev with Vite proxy: use relative URLs → Vite proxies /api to :8000
 *  - VITE_API_URL env var overrides for custom deployments
 *
 * This means the built React app always calls /api/... relative to wherever
 * it's served from — no hardcoded localhost, works in Codespace, Railway, etc.
 */
import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios'
import { useStore } from '../store'

// Relative URL = works everywhere (Codespace, prod, local)
// Only set VITE_API_URL if deploying frontend separately from Django
const BASE_URL = import.meta.env.VITE_API_URL ?? ''

export const api = axios.create({
  baseURL: `${BASE_URL}/api`,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
})

// ─── Request interceptor: attach JWT ─────────────────────────────────────────
api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = useStore.getState().accessToken
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// ─── Response interceptor: refresh token on 401 ──────────────────────────────
let refreshPromise: Promise<string> | null = null

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as InternalAxiosRequestConfig & { _retry?: boolean }

    if (error.response?.status === 401 && !original._retry) {
      original._retry = true

      if (!refreshPromise) {
        const refresh = useStore.getState().refreshToken
        if (!refresh) { useStore.getState().logout(); return Promise.reject(error) }

        refreshPromise = axios.post(`${BASE_URL}/api/auth/refresh/`, { refresh })
          .then((res) => {
            const newAccess = res.data.access
            useStore.setState({ accessToken: newAccess })
            return newAccess
          })
          .catch(() => { useStore.getState().logout(); return Promise.reject(new Error('Session expired')) })
          .finally(() => { refreshPromise = null })
      }

      const newToken = await refreshPromise
      original.headers.Authorization = `Bearer ${newToken}`
      return api(original)
    }

    return Promise.reject(error)
  }
)

// ─── Auth ─────────────────────────────────────────────────────────────────────
export const authApi = {
  login: (email: string, password: string) =>
    api.post('/auth/login/', { email, password }).then(r => r.data),
  register: (data: { email: string; username: string; password: string; display_name?: string }) =>
    api.post('/auth/register/', data).then(r => r.data),
  refreshToken: (refresh: string) =>
    api.post('/auth/refresh/', { refresh }).then(r => r.data),
}

export const playerApi = {
  me: () => api.get('/players/me/').then(r => r.data),
  update: (data: Partial<{ display_name: string }>) => api.patch('/players/me/', data).then(r => r.data),
  linkWallet: (wallet_address: string, signature?: string) =>
    api.post('/players/wallet/', { wallet_address, signature }).then(r => r.data),
  leaderboard: (type: 'territory' | 'season' = 'territory') =>
    api.get(`/leaderboard/?type=${type}`).then(r => r.data),
  search: (q: string) => api.get(`/players/search/?q=${encodeURIComponent(q)}`).then(r => r.data),
}

export const territoryApi = {
  viewport: (lat: number, lon: number, radius_km: number) =>
    api.get(`/territories/viewport/?lat=${lat}&lon=${lon}&radius_km=${radius_km}`).then(r => r.data),
  detail: (h3: string) => api.get(`/territories/${h3}/detail/`).then(r => r.data),
  claim: (h3: string) => api.post(`/territories/${h3}/claim/`).then(r => r.data),
  build: (h3: string, building_type: string) =>
    api.post(`/territories/${h3}/build/`, { building_type }).then(r => r.data),
}

export const combatApi = {
  attack: (target_h3: string, units: Record<string, number>, battle_type?: string) =>
    api.post('/combat/attack/', { target_h3, units, battle_type: battle_type ?? 'conquest' }).then(r => r.data),
  activeBattles: () => api.get('/combat/active/').then(r => r.data),
}

export const tdcApi = {
  balance: () => api.get('/tdc/balance/').then(r => r.data),
  catalog: () => api.get('/shop/catalog/').then(r => r.data),
  purchase: (item_code: string, quantity: number, territory_h3?: string) =>
    api.post('/shop/purchase/', { item_code, quantity, territory_h3 }).then(r => r.data),
}

export const allianceApi = {
  create: (data: { tag: string; name: string; description?: string; banner_color?: string }) =>
    api.post('/alliances/create/', data).then(r => r.data),
  join: (id: string) => api.post(`/alliances/${id}/join/`).then(r => r.data),
  leave: () => api.post('/alliances/leave/').then(r => r.data),
  members: (id: string) => api.get(`/alliances/${id}/members/`).then(r => r.data),
  search: (q: string) => api.get(`/alliances/search/?q=${encodeURIComponent(q)}`).then(r => r.data),
}

export const eventsApi = {
  controlTowers: () => api.get('/control-towers/upcoming/').then(r => r.data),
  activeEvents: () => api.get('/events/active/').then(r => r.data),
  registerForTower: (eventId: string) =>
    api.post(`/control-towers/${eventId}/register/`).then(r => r.data),
}
