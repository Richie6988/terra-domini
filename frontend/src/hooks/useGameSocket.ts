/**
 * useGameSocket — manages the game WebSocket connection.
 * Auto-reconnects with exponential backoff.
 * URL derived from window.location — works in Codespace, prod, local.
 */
import { useEffect, useRef, useCallback } from 'react'
import toast from 'react-hot-toast'
import { useStore } from '../store'
import type { WSMessage, Viewport } from '../types'

const RECONNECT_BASE_MS = 3000
const MAX_RECONNECT_ATTEMPTS = 5
const PING_INTERVAL_MS = 25000

function getWsBase(): string {
  if (import.meta.env.VITE_WS_URL) return import.meta.env.VITE_WS_URL
  if (typeof window === 'undefined') return 'ws://localhost:8000'
  const proto = window.location.protocol === 'https:' ? 'wss' : 'ws'
  return `${proto}://${window.location.host}`
}

export function useGameSocket() {
  const wsRef               = useRef<WebSocket | null>(null)
  const attemptsRef         = useRef(0)
  const reconnectTimer      = useRef<ReturnType<typeof setTimeout>>()
  const pingTimer           = useRef<ReturnType<typeof setInterval>>()
  const intentionalClose    = useRef(false)
  const connectRef          = useRef<() => void>()  // stable ref to latest connect fn

  const store = useStore()

  // Extract only what we need — use getState() in callbacks to avoid stale closures
  const { isAuthenticated, accessToken } = store

  const handleMessage = useCallback((event: MessageEvent) => {
    let msg: WSMessage
    try { msg = JSON.parse(event.data) }
    catch { return }

    // Always use getState() to avoid stale closure issues
    const s = useStore.getState()

    switch (msg.type) {
      case 'territory_state':
        if (Array.isArray(msg.territories)) s.setTerritories(msg.territories)
        break
      case 'territory_update':
        if (msg.territory) s.upsertTerritory(msg.territory)
        break
      case 'battle_event':
        if (msg.battle) s.addBattle(msg.battle)
        break
      case 'battle_resolved':
        if (msg.battle_id) s.resolveBattle(msg.battle_id, msg.result)
        break
      case 'balance_update':
        if (typeof msg.tdc_delta === 'number') s.updateInGameBalance(msg.tdc_delta)
        if (msg.new_balance) s.setBalance(msg.new_balance as any)
        break
      case 'notification':
        if ('notification' in msg) s.addNotification((msg as any).notification)
        else s.addNotification(msg as any)
        break
      case 'pong':
      case 'connected':
        break
      default:
        break
    }
  }, []) // No deps — uses getState() directly

  const connect = useCallback(() => {
    const { isAuthenticated: auth, accessToken: token } = useStore.getState()
    if (!auth || !token) return
    if (wsRef.current?.readyState === WebSocket.OPEN) return
    if (wsRef.current?.readyState === WebSocket.CONNECTING) return

    const url = `${getWsBase()}/ws/map/?token=${token}`

    try {
      const ws = new WebSocket(url)
      wsRef.current = ws

      ws.onopen = () => {
        attemptsRef.current = 0
        intentionalClose.current = false
        useStore.getState().setWsConnected(true)
        clearInterval(pingTimer.current)
        pingTimer.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'ping' }))
          }
        }, PING_INTERVAL_MS)
      }

      ws.onmessage = handleMessage

      ws.onclose = (event) => {
        useStore.getState().setWsConnected(false)
        clearInterval(pingTimer.current)
        if (intentionalClose.current) return
        if (event.code === 4001) return // Auth failed — do not retry

        if (attemptsRef.current < MAX_RECONNECT_ATTEMPTS) {
          const delay = RECONNECT_BASE_MS * Math.pow(2, attemptsRef.current)
          attemptsRef.current++
          // Use connectRef.current so we always call the latest version
          reconnectTimer.current = setTimeout(() => connectRef.current?.(), delay)
        } else {
          toast.error('Connection lost. Refresh to reconnect.', { id: 'ws-lost', duration: Infinity })
        }
      }

      ws.onerror = () => {} // onclose handles everything
    } catch (e) {
      console.warn('[WS] Failed to create WebSocket:', e)
    }
  }, [handleMessage])

  // Keep connectRef always pointing to latest connect function
  useEffect(() => { connectRef.current = connect }, [connect])

  useEffect(() => {
    if (isAuthenticated && accessToken) {
      intentionalClose.current = false
      attemptsRef.current = 0
      connect()
    }
    return () => {
      intentionalClose.current = true
      clearTimeout(reconnectTimer.current)
      clearInterval(pingTimer.current)
      const ws = wsRef.current
      if (ws) {
        // If still connecting, wait for open then close — prevents "closed before established"
        if (ws.readyState === WebSocket.CONNECTING) {
          ws.addEventListener('open', () => ws.close(1000, 'component unmounted'), { once: true })
          ws.addEventListener('error', () => {}, { once: true })
        } else {
          ws.close(1000, 'component unmounted')
        }
        wsRef.current = null
      }
      useStore.getState().setWsConnected(false)
    }
  }, [isAuthenticated, accessToken, connect])

  const sendViewport = useCallback((viewport: Viewport) => {
    // Send via WebSocket if connected
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'viewport', ...viewport }))
    }
    // Always also fetch via REST API (reliable fallback for initial load)
    const { lat, lon, radius_km } = viewport
    const currentZoom = useStore.getState().mapZoom ?? 13
    fetch(`/api/territories/map-view/?lat=${lat}&lon=${lon}&radius_km=${radius_km}&zoom=${currentZoom}`, {
      headers: { Authorization: `Bearer ${useStore.getState().accessToken}` },
    })
      .then(r => r.json())
      .then(data => {
        // Backend returns plain array OR {results: [...]}
        const territories = Array.isArray(data) ? data : (data.results ?? [])
        // Keep owned territories AND free POI hexes (they are visible on map)
        const relevantTerritories = territories.filter((t: any) => t.owner_id || t.is_landmark || t.poi_name || (t.rarity && t.rarity !== 'common'))
        if (relevantTerritories.length) {
          useStore.getState().setTerritories(relevantTerritories)
        }
      })
      .catch(() => {})
  }, [])

  const subscribeTerritory = useCallback((h3: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'subscribe_territory', h3_index: h3 }))
    }
  }, [])

  return { sendViewport, subscribeTerritory }
}
