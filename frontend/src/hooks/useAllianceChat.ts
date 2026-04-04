/**
 * useAllianceChat — WebSocket connection for alliance real-time chat.
 * Connects to ws/alliance/<alliance_id>/
 * Returns messages, sendMessage, online status.
 */
import { useState, useEffect, useRef, useCallback } from 'react'
import { useStore } from '../store'

export interface ChatMessage {
  type: 'chat' | 'system' | 'help_request' | 'attack_plan' | 'emoji'
  user?: string
  role?: string
  text: string
  time: string
  territory?: string
  target?: string
  emoji?: string
}

export function useAllianceChat(allianceId: string | undefined) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [connected, setConnected] = useState(false)
  const wsRef = useRef<WebSocket | null>(null)
  const accessToken = useStore(s => s.accessToken)

  useEffect(() => {
    if (!allianceId || !accessToken) return

    const proto = window.location.protocol === 'https:' ? 'wss' : 'ws'
    const base = `${proto}://${window.location.host}`
    const url = `${base}/ws/alliance/${allianceId}/?token=${accessToken}`

    const ws = new WebSocket(url)
    wsRef.current = ws

    ws.onopen = () => setConnected(true)
    ws.onclose = () => setConnected(false)
    ws.onerror = () => setConnected(false)

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as ChatMessage
        setMessages(prev => [...prev.slice(-99), data])
      } catch {}
    }

    return () => {
      ws.close()
      wsRef.current = null
      setConnected(false)
    }
  }, [allianceId, accessToken])

  const sendMessage = useCallback((text: string) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return
    wsRef.current.send(JSON.stringify({ type: 'chat', text }))
  }, [])

  const sendHelpRequest = useCallback((territory: string, text: string) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return
    wsRef.current.send(JSON.stringify({ type: 'help_request', territory, text }))
  }, [])

  const sendAttackPlan = useCallback((target: string, text: string) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return
    wsRef.current.send(JSON.stringify({ type: 'attack_plan', target, text }))
  }, [])

  const sendEmoji = useCallback((emoji: string) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return
    wsRef.current.send(JSON.stringify({ type: 'emoji', emoji }))
  }, [])

  return { messages, connected, sendMessage, sendHelpRequest, sendAttackPlan, sendEmoji }
}
