/**
 * useGameSocket — manages the game WebSocket connection.
 * Auto-reconnects with exponential backoff.
 * URL derived from window.location — works in Codespace, prod, local.
 */
import { useEffect, useRef, useCallback } from 'react'
import toast from 'react-hot-toast'
import { useStore } from '../store'
import type { WSMessage, Viewport } from '../types'

const RECONNECT_BASE_MS = 2000
const MAX_RECONNECT_ATTEMPTS = 5
const PING_INTERVAL_MS = 25000

function getWsBase(): string {
  if (import.meta.env.VITE_WS_URL) return import.meta.env.VITE_WS_URL
  if (typeof window === 'undefined') return 'ws://localhost:8000'
  const proto = window.location.protocol === 'https:' ? 'wss' : 'ws'
  return `${proto}://${window.location.host}`
}

export function useGameSocket() {
  const wsRef = useRef<WebSocket | null>(null)
  const attemptsRef = useRef(0)
  const reconnectTimer = useRef<ReturnType<typeof setTimeout>>()
  const pingTimer = useRef<ReturnType<typeof setInterval>>()
  const intentionalClose = useRef(false)

  const {
    accessToken, isAuthenticated,
    setTerritories, upsertTerritory,
    addBattle, resolveBattle,
    setBalance, updateInGameBalance,
    addNotification, setWsConnected,
  } = useStore()

  const handleMessage = useCallback((event: MessageEvent) => {
    try {
      const msg: WSMessage = JSON.parse(event.data)
      switch (msg.type) {
        case 'territory_state':
          if (msg.territories) setTerritories(msg.territories)
          break
        case 'territory_update':
          if (msg.territory) upsertTerritory(msg.territory)
          break
        case 'battle_event':
          if (msg.battle) addBattle(msg.battle)
          break
        case 'battle_resolved':
          if (msg.battle_id) resolveBattle(msg.battle_id, msg.result)
          break
        case 'balance_update':
          if (msg.tdc_delta) updateInGameBalance(msg.tdc_delta)
          if (msg.balance) setBalance(msg.balance)
          break
        case 'notification':
          addNotification(msg)
          break
        case 'pong':
          break
        default:
          break
      }
    } catch (e) {
      console.warn('[WS] Failed to parse message', e)
    }
  }, [setTerritories, upsertTerritory, addBattle, resolveBattle, setBalance, updateInGameBalance, addNotification])

  const connect = useCallback(() => {
    if (!isAuthenticated || !accessToken) return
    if (wsRef.current?.readyState === WebSocket.OPEN) return

    const url = `${getWsBase()}/ws/map/?token=${accessToken}`
    
    try {
      const ws = new WebSocket(url)
      wsRef.current = ws

      ws.onopen = () => {
        attemptsRef.current = 0
        intentionalClose.current = false
        setWsConnected(true)
        // Start ping
        pingTimer.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'ping' }))
          }
        }, PING_INTERVAL_MS)
      }

      ws.onmessage = handleMessage

      ws.onclose = (event) => {
        setWsConnected(false)
        clearInterval(pingTimer.current)
        
        if (intentionalClose.current) return
        if (event.code === 4001) return // Auth failed — don't retry
        
        if (attemptsRef.current < MAX_RECONNECT_ATTEMPTS) {
          const delay = RECONNECT_BASE_MS * Math.pow(2, attemptsRef.current)
          attemptsRef.current++
          reconnectTimer.current = setTimeout(connect, delay)
        } else {
          toast.error('Connection lost. Refresh the page to reconnect.', { id: 'ws-error' })
        }
      }

      ws.onerror = () => {
        // onclose will handle retry — just suppress the console error
      }
    } catch (e) {
      console.warn('[WS] Connection failed', e)
    }
  }, [isAuthenticated, accessToken, handleMessage, setWsConnected])

  useEffect(() => {
    if (isAuthenticated && accessToken) {
      connect()
    }
    return () => {
      intentionalClose.current = true
      clearTimeout(reconnectTimer.current)
      clearInterval(pingTimer.current)
      wsRef.current?.close()
      setWsConnected(false)
    }
  }, [isAuthenticated, accessToken]) // eslint-disable-line

  const sendViewport = useCallback((viewport: Viewport) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'viewport', ...viewport }))
    }
  }, [])

  const subscribeTerritory = useCallback((h3: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'subscribe_territory', h3_index: h3 }))
    }
  }, [])

  return { sendViewport, subscribeTerritory }
}
