/**
 * WarTicker — simple live events feed.
 */
import { useState, useEffect, useRef } from 'react'
import { useStore } from '../../store'

const STATIC_EVENTS = [
  { id: 's1', icon: '🌍', text: 'Hexod is live — capture territories to build your empire', color: '#10B981' },
  { id: 's2', icon: '🗼', text: 'Control Towers award 2× HEX Coin to the winning alliance', color: '#FFB800' },
  { id: 's3', icon: '⚔️', text: 'Attack adjacent territories from the map', color: '#EF4444' },
  { id: 's4', icon: '🏆', text: 'Saison 1 — 50,000 HEX Coin prize pool', color: '#8B5CF6' },
  { id: 's5', icon: '💎', text: 'Claim your first territory for free — no HEX Coin needed', color: '#00FF87' },
]

export function WarTicker() {
  const [idx, setIdx] = useState(0)
  const [visible, setVisible] = useState(true)
  const timerRef = useRef<ReturnType<typeof setInterval>>()
  const activeBattles = useStore(s => s.activeBattles ?? [])

  // Build events list safely
  const events = [
    ...activeBattles.map(b => ({
      id: String(b.id),
      icon: '⚔️',
      text: `Battle in progress at ${String(b.territory_name ?? b.territory_h3 ?? 'zone').slice(0, 20)}`,
      color: '#EF4444',
    })),
    ...STATIC_EVENTS,
  ]

  useEffect(() => {
    timerRef.current = setInterval(() => {
      setVisible(false)
      setTimeout(() => {
        setIdx(i => (i + 1) % events.length)
        setVisible(true)
      }, 300)
    }, 4000)
    return () => clearInterval(timerRef.current)
  }, [events.length])

  const ev = events[idx] ?? STATIC_EVENTS[0]

  return (
    <div style={{
      position: 'fixed', bottom: 76, left: 0, right: 0, zIndex: 800,
      display: 'flex', justifyContent: 'center', pointerEvents: 'none',
    }}>
      <div style={{
        background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)',
        border: '1px solid rgba(255,255,255,0.08)', borderRadius: 20,
        padding: '6px 16px', display: 'flex', alignItems: 'center', gap: 8,
        maxWidth: 480, opacity: visible ? 1 : 0, transition: 'opacity 0.3s',
      }}>
        <span style={{ fontSize: 14 }}>{ev.icon}</span>
        <span style={{ fontSize: 12, color: ev.color, fontWeight: 500 }}>{ev.text}</span>
        <div style={{ display: 'flex', gap: 3, marginLeft: 4 }}>
          {events.slice(0, 6).map((_, i) => (
            <div key={i} style={{
              width: i === idx ? 12 : 4, height: 4, borderRadius: 2,
              background: i === idx ? ev.color : 'rgba(255,255,255,0.2)',
              transition: 'all 0.3s',
            }} />
          ))}
        </div>
      </div>
    </div>
  )
}
