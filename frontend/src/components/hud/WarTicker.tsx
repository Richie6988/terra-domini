/**
 * WarTicker — scrolling live events feed at the bottom of the map.
 * Shows: battles, tower wars, captures, alliance wars, world events.
 * RISK-style "what's happening on the board right now".
 */
import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useStore } from '../../store'
import { useQuery } from '@tanstack/react-query'
import { api } from '../../services/api'

interface TickerEvent {
  id: string
  icon: string
  text: string
  color: string
  ts: number
}

// Merge live WS events + API data into a unified ticker
export function WarTicker() {
  const [events, setEvents] = useState<TickerEvent[]>([])
  const [current, setCurrent] = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval>>()

  const activeBattles = useStore(s => s.activeBattles ?? [])
  const notifications = useStore(s => s.notifications ?? [])

  // Load tower wars

  // Territory income
  const { data: income } = useQuery({
    queryKey: ['territory-income'],
    queryFn: () => api.get('/territories-geo/income/').then(r => r.data),
    refetchInterval: 60000,
  })
  const { data: towersData } = useQuery({
    queryKey: ['ticker-towers'],
    queryFn: () => api.get('/control-towers/').then(r => r.data?.results ?? []),
    refetchInterval: 60000,
    staleTime: 30000,
  })

  // Load world events
  const { data: worldEvents } = useQuery({
    queryKey: ['ticker-world-events'],
    queryFn: () => api.get('/events/').then(r => r.data?.results ?? r.data ?? []),
    refetchInterval: 120000,
    staleTime: 60000,
  })

  // Build ticker events from all sources
  useEffect(() => {
    const all: TickerEvent[] = []

    // Active battles
    ;(activeBattles ?? []).forEach(b => {
      all.push({
        id: b.id,
        icon: '⚔️',
        text: `Battle in progress at ${b.territory_name || b.territory_h3?.slice(0,8) + '…'}`,
        color: '#EF4444',
        ts: Date.now(),
      })
    })

    // Tower wars
    const towers = Array.isArray(towersData) ? towersData : []
    towers.filter((t: any) => t.status === 'active').forEach((t: any) => {
      all.push({
        id: `tower_${t.id}`,
        icon: '🗼',
        text: `TOWER WAR LIVE: ${t.territory_name} — ${t.participant_count ?? 0} fighters`,
        color: '#FFB800',
        ts: Date.now() - 1000,
      })
    })
    towers.filter((t: any) => t.status === 'scheduled').forEach((t: any) => {
      const diff = new Date(t.starts_at).getTime() - Date.now()
      const mins = Math.max(0, Math.floor(diff / 60000))
      const label = mins < 60 ? `in ${mins}m` : `in ${Math.floor(mins/60)}h`
      all.push({
        id: `sched_${t.id}`,
        icon: '⏰',
        text: `Tower War at ${t.territory_name} starting ${label}`,
        color: '#F59E0B',
        ts: Date.now() - 2000,
      })
    })

    // World events
    const wevtsRaw = worldEvents
    const wevts: any[] = Array.isArray(wevtsRaw) ? wevtsRaw : Array.isArray((wevtsRaw as any)?.results) ? (wevtsRaw as any).results : []
    wevts.slice(0, 3).forEach((e: any) => {
      all.push({
        id: `world_${e.id}`,
        icon: e.name?.slice(0, 2) ?? '🌍',
        text: e.name?.replace(/^[^\s]+\s/, '') + ' — ' + (e.description?.slice(0, 60) ?? ''),
        color: '#8B5CF6',
        ts: Date.now() - 3000,
      })
    })

    // Notifications
    (notifications ?? []).slice(0, 2).forEach((n: any, i) => {
      all.push({
        id: `notif_${i}`,
        icon: n.type === 'attack_incoming' ? '🚨' : '📢',
        text: n.title || n.message || 'Game event',
        color: n.type === 'attack_incoming' ? '#EF4444' : '#6B7280',
        ts: Date.now() - 4000 - i * 100,
      })
    })

    // Static world flavor if nothing else
    if (all.length === 0) {
      all.push(
        { id: 's1', icon: '🌍', text: 'Terra Domini is live — capture territories to build your empire', color: '#10B981', ts: 0 },
        { id: 's2', icon: '🗼', text: 'Control Towers award 2× TDC to the winning alliance', color: '#FFB800', ts: 0 },
        { id: 's3', icon: '⚔️', text: 'Attack adjacent territories by tapping them on the map', color: '#EF4444', ts: 0 },
        { id: 's4', icon: '🏆', text: 'Season 1 — Week 3 of 13 — 50,000 TDC prize pool', color: '#8B5CF6', ts: 0 },
        { id: 's5', icon: '🔥', text: 'Hormuz Crisis: Gulf energy -60% · Intel ×3 · Naval units unlocked', color: '#F97316', ts: 0 },
      )
    }

    setEvents(all.sort((a, b) => b.ts - a.ts))
  }, [(activeBattles ?? []).length, towersData, worldEvents, (notifications ?? []).length])

  // Auto-advance ticker
  useEffect(() => {
    if (events.length <= 1) return
    timerRef.current = setInterval(() => {
      setCurrent(c => (c + 1) % events.length)
    }, 4000)
    return () => clearInterval(timerRef.current)
  }, [events.length])

  if (events.length === 0) return null

  const evt = events[current]

  return (
    <div style={{
      position: 'absolute', bottom: 75, left: '50%', transform: 'translateX(-50%)',
      zIndex: 800, width: 'min(520px, 90vw)',
      background: 'rgba(0,0,0,0.82)', borderRadius: 10,
      border: '1px solid rgba(255,255,255,0.08)',
      backdropFilter: 'blur(8px)', overflow: 'hidden',
    }}>
      <AnimatePresence mode="wait">
        <motion.div
          key={evt.id}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.25 }}
          style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px' }}
        >
          {/* Dot indicator */}
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: evt.color, flexShrink: 0, boxShadow: `0 0 6px ${evt.color}` }} />
          <span style={{ fontSize: 14, flexShrink: 0 }}>{evt.icon}</span>
          <span style={{ fontSize: 12, color: '#E5E7EB', flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {evt.text}
          </span>
          {/* Pagination dots */}
          <div style={{ display: 'flex', gap: 3, flexShrink: 0 }}>
            {(events ?? []).slice(0, 6).map((_, i) => (
              <span key={i} onClick={() => setCurrent(i)} style={{
                width: 5, height: 5, borderRadius: '50%', cursor: 'pointer',
                background: i === current ? evt.color : 'rgba(255,255,255,0.2)',
                transition: 'background 0.3s',
              }} />
            ))}
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
