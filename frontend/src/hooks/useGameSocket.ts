/**
 * useGameSocket — manages the game WebSocket connection lifecycle.
 * Auto-reconnects, sends viewport on map move, routes incoming messages to store.
 */
import { useEffect, useRef, useCallback } from 'react'
import toast from 'react-hot-toast'
import { useStore } from '../store'
import type { WSMessage, Viewport } from '../types'

const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:8000'
const RECONNECT_DELAY_MS = 3000
const MAX_RECONNECT_ATTEMPTS = 10
const PING_INTERVAL_MS = 30000

export function useGameSocket() {
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectAttempts = useRef(0)
  const reconnectTimer = useRef<ReturnType<typeof setTimeout>>()
  const pingTimer = useRef<ReturnType<typeof setInterval>>()

  const {
    accessToken,
    isAuthenticated,
    setTerritories,
    upsertTerritory,
    setSelectedTerritory,
    addBattle,
    resolveBattle,
    setBalance,
    updateInGameBalance,
    addNotification,
    setWsConnected,
    selectedTerritory,
  } = useStore()

  const handleMessage = useCallback((event: MessageEvent) => {
    let msg: WSMessage
    try {
      msg = JSON.parse(event.data)
    } catch {
      return
    }

    switch (msg.type) {
      case 'connected':
        reconnectAttempts.current = 0
        setWsConnected(true)
        break

      case 'territory_state':
        setTerritories(msg.territories)
        break

      case 'territory_update':
        upsertTerritory(msg.territory)
        // If this is the selected territory, update detail view too
        if (selectedTerritory?.h3 === msg.territory.h3) {
          // Merge light update into detail view
          setSelectedTerritory({ ...selectedTerritory, ...msg.territory })
        }
        break

      case 'territory_detail':
        setSelectedTerritory(msg.territory)
        break

      case 'battle_event':
        addBattle(msg.battle)
        break

      case 'battle_resolved':
        resolveBattle(msg.battle_id)
        // Update territory
        toast[msg.winner === msg.your_side ? 'success' : 'error'](
          msg.winner === msg.your_side
            ? msg.territory_captured
              ? `Territory captured! 🏆`
              : `Defense successful! 🛡️`
            : msg.territory_captured
              ? `Territory lost... ⚔️`
              : `Attack repelled`
        )
        break

      case 'notification':
        addNotification(msg.notification)
        if (msg.notification.type === 'attack_incoming') {
          toast.error(`🚨 Under attack! ${msg.notification.message}`)
        }
        break

      case 'tdc_update':
        updateInGameBalance(msg.balance.purchased || 0)
        toast.success(`+${msg.balance.purchased?.toFixed(0)} TDC received!`)
        break

      case 'attack_incoming':
        addNotification({
          type: 'attack_incoming',
          title: 'Under Attack!',
          message: `${msg.attacker} is attacking your territory`,
          territory_h3: msg.territory_h3,
        })
        toast.error(`🚨 ${msg.attacker} is attacking your territory!`)
        break
    }
  }, [selectedTerritory])

  const connect = useCallback(() => {
    if (!isAuthenticated || !accessToken) return
    if (wsRef.current?.readyState === WebSocket.OPEN) return

    const ws = new WebSocket(`${WS_URL}/ws/map/?token=${accessToken}`)
    wsRef.current = ws

    ws.onopen = () => {
      reconnectAttempts.current = 0
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

      if (event.code === 4001) {
        // Auth failure — don't reconnect
        return
      }

      if (reconnectAttempts.current < MAX_RECONNECT_ATTEMPTS) {
        const delay = Math.min(RECONNECT_DELAY_MS * (2 ** reconnectAttempts.current), 60000)
        reconnectAttempts.current++
        reconnectTimer.current = setTimeout(connect, delay)
      }
    }

    ws.onerror = () => {
      ws.close()
    }

    return ws
  }, [isAuthenticated, accessToken, handleMessage])

  const disconnect = useCallback(() => {
    clearTimeout(reconnectTimer.current)
    clearInterval(pingTimer.current)
    wsRef.current?.close(1000, 'Client disconnect')
    wsRef.current = null
    setWsConnected(false)
  }, [])

  // Send viewport update to server
  const updateViewport = useCallback((viewport: Viewport) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'viewport', ...viewport }))
    }
  }, [])

  // Subscribe to a specific territory for real-time updates
  const subscribeTerritory = useCallback((h3: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'subscribe_territory', h3_index: h3 }))
    }
  }, [])

  const unsubscribeTerritory = useCallback((h3: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'unsubscribe_territory', h3_index: h3 }))
    }
  }, [])

  const clickTerritory = useCallback((h3: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'click_territory', h3_index: h3 }))
    }
  }, [])

  useEffect(() => {
    if (isAuthenticated && accessToken) {
      connect()
    } else {
      disconnect()
    }
    return disconnect
  }, [isAuthenticated, accessToken])

  return { updateViewport, subscribeTerritory, unsubscribeTerritory, clickTerritory }
}
