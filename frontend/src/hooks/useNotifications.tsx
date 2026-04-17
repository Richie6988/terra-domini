/**
 * useNotifications — Real-time notification system for HEXOD.
 * Tracks unread counts per panel (events, marketplace, kingdom, safari, alliance).
 * Polls backend every 60s + listens to WebSocket events.
 */
import { useState, useEffect, useCallback } from 'react'
import { api } from '../services/api'
import { useStore } from '../store'

export interface Notification {
  id: string
  type: 'event_ended' | 'territory_attacked' | 'auction_outbid' | 'alliance_invite' | 'safari_ready' | 'claim_complete' | 'achievement_unlocked' | 'marketplace_sold'
  panel: string  // which dock button to badge
  title: string
  message: string
  read: boolean
  created_at: string
}

// Map notification types to dock panel IDs
const TYPE_TO_PANEL: Record<string, string> = {
  event_ended: 'events',
  territory_attacked: 'empire',
  auction_outbid: 'auction',
  alliance_invite: 'alliance',
  safari_ready: 'hunt',
  claim_complete: 'empire',
  achievement_unlocked: 'profile',
  marketplace_sold: 'marketplace',
}

export function useNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [badgeCounts, setBadgeCounts] = useState<Record<string, number>>({})
  const isAuth = useStore(s => s.isAuthenticated)

  // Compute badge counts from notifications
  const updateBadges = useCallback((notifs: Notification[]) => {
    const counts: Record<string, number> = {}
    notifs.filter(n => !n.read).forEach(n => {
      const panel = n.panel || TYPE_TO_PANEL[n.type] || ''
      if (panel) counts[panel] = (counts[panel] || 0) + 1
    })
    setBadgeCounts(counts)
  }, [])

  // Poll backend
  const refresh = useCallback(async () => {
    if (!isAuth) return
    try {
      const r = await api.get('/notifications/')
      const notifs = Array.isArray(r.data) ? r.data : (r.data?.results || [])
      setNotifications(notifs)
      updateBadges(notifs)
    } catch {
      // Endpoint might not exist yet — use empty
      setNotifications([])
      setBadgeCounts({})
    }
  }, [isAuth, updateBadges])

  // Poll every 60s
  useEffect(() => {
    refresh()
    const id = setInterval(refresh, 60000)
    return () => clearInterval(id)
  }, [refresh])

  // Listen to WebSocket events for instant notifications
  useEffect(() => {
    const handler = (e: CustomEvent) => {
      const notif = e.detail as Notification
      if (notif?.type) {
        setNotifications(prev => [notif, ...prev])
        updateBadges([notif, ...notifications])
      }
    }
    window.addEventListener('hexod:notification' as any, handler)
    return () => window.removeEventListener('hexod:notification' as any, handler)
  }, [notifications, updateBadges])

  const markRead = useCallback(async (panel: string) => {
    // Mark all notifications for this panel as read
    const toMark = notifications.filter(n => (n.panel || TYPE_TO_PANEL[n.type]) === panel && !n.read)
    if (!toMark.length) return
    try {
      await api.post('/notifications/mark-read/', { panel })
    } catch {}
    setNotifications(prev => prev.map(n =>
      (n.panel || TYPE_TO_PANEL[n.type]) === panel ? { ...n, read: true } : n
    ))
    setBadgeCounts(prev => ({ ...prev, [panel]: 0 }))
  }, [notifications])

  return { notifications, badgeCounts, refresh, markRead }
}

/**
 * NotificationBadge — Red dot + count on dock buttons.
 * Usage: <NotificationBadge count={badgeCounts['events']} />
 */
export function NotificationBadge({ count }: { count?: number }) {
  if (!count) return null
  return (
    <div style={{
      position: 'absolute', top: -2, right: -2, zIndex: 10,
      minWidth: 16, height: 16, borderRadius: 8,
      background: '#dc2626', border: '2px solid rgba(13,27,42,0.95)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 8, fontWeight: 900, color: '#fff',
      fontFamily: "'Share Tech Mono', monospace",
      padding: '0 3px',
      boxShadow: '0 1px 4px rgba(220,38,38,0.4)',
    }}>
      {count > 9 ? '9+' : count}
    </div>
  )
}
