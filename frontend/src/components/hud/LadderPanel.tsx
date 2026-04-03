/**
 * LadderPanel — Player rankings.
 * 3 tabs: Global, Nearby, Alliance. No emojis (RULE 4).
 */
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { GlassPanel } from '../shared/GlassPanel'
import { MiniIcon, StatusDot } from '../shared/MiniIcons'
import { CrystalIcon } from '../shared/CrystalIcon'
import { api } from '../../services/api'
import { usePlayer } from '../../store'

interface Props { onClose: () => void }
type Tab = 'global' | 'nearby' | 'alliance'

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'global', label: 'GLOBAL', icon: 'globe' },
  { id: 'nearby', label: 'NEARBY', icon: 'compass' },
  { id: 'alliance', label: 'ALLIANCE', icon: 'empire' },
]

// Medal SVG for top 3
function Medal({ rank }: { rank: number }) {
  const colors = ['#f59e0b', '#94a3b8', '#b45309'] // gold, silver, bronze
  const c = colors[rank - 1] || '#6b7280'
  return (
    <svg viewBox="0 0 24 24" style={{ width: 20, height: 20 }} fill="none">
      <circle cx="12" cy="10" r="7" stroke={c} strokeWidth="2" />
      <text x="12" y="13" textAnchor="middle" fill={c} fontSize="9" fontWeight="900" fontFamily="'Orbitron',sans-serif">{rank}</text>
      <path d="M8 17l-2 5h2l2-3 2 3h2l-2-5" stroke={c} strokeWidth="1.5" fill={`${c}20`} />
      <path d="M16 17l2 5h-2l-2-3-2 3h-2l2-5" stroke={c} strokeWidth="1.5" fill={`${c}20`} />
    </svg>
  )
}

// Real leaderboard from backend

export function LadderPanel({ onClose }: Props) {
  const [tab, setTab] = useState<Tab>('global')
  const player = usePlayer()

  // Fetch real leaderboard from backend
  const { data: lbData, isLoading } = useQuery({
    queryKey: ['leaderboard', tab],
    queryFn: () => api.get(`/leaderboard/${tab}/`).then(r => r.data).catch(() => null),
    staleTime: 30000,
  })

  const entries = (lbData?.entries || []).map((e: any, i: number) => ({
    rank: e.rank || i + 1,
    username: e.username || e.display_name,
    territories: e.territories || 0,
    hex_per_day: e.hex_per_day || e.score || 0,
    isYou: e.id === String(player?.id),
    avatar_emoji: e.avatar_emoji || '🎖️',
  }))
  const meRank = lbData?.me_rank

  return (
    <GlassPanel title="LADDER" onClose={onClose} accent="#8b5cf6">
      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid rgba(0,60,100,0.08)', marginBottom: 14 }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            flex: 1, padding: '10px 8px', border: 'none', cursor: 'pointer',
            background: tab === t.id ? 'rgba(139,92,246,0.08)' : 'transparent',
            borderBottom: tab === t.id ? '2px solid #8b5cf6' : '2px solid transparent',
            color: tab === t.id ? '#8b5cf6' : 'rgba(26,42,58,0.4)',
            fontSize: 8, fontWeight: 700, letterSpacing: 1, fontFamily: "'Orbitron', sans-serif",
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          }}>
            <MiniIcon id={t.icon} size={12} color={tab === t.id ? '#8b5cf6' : 'rgba(26,42,58,0.3)'} />
            {t.label}
          </button>
        ))}
      </div>

      {/* Column headers */}
      <div style={{ display: 'flex', padding: '0 12px 8px', gap: 8, fontSize: 6, fontWeight: 700, color: 'rgba(26,42,58,0.3)', letterSpacing: 2, fontFamily: "'Orbitron', sans-serif" }}>
        <span style={{ width: 28 }}>#</span>
        <span style={{ flex: 1 }}>PLAYER</span>
        <span style={{ width: 50, textAlign: 'right' }}>TERR</span>
        <span style={{ width: 50, textAlign: 'right' }}>HEX/D</span>
      </div>

      {/* Player rows */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {isLoading && <div style={{ textAlign: 'center', padding: 30, color: 'rgba(26,42,58,0.3)', fontSize: 9 }}>Loading rankings...</div>}
        {!isLoading && entries.length === 0 && <div style={{ textAlign: 'center', padding: 30, color: 'rgba(26,42,58,0.3)', fontSize: 9 }}>No players ranked yet. Claim territories to appear!</div>}
        {entries.map((p: any) => (
          <div key={p.rank} style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 10,
            background: p.isYou ? 'rgba(139,92,246,0.06)' : 'rgba(255,255,255,0.3)',
            border: `1px solid ${p.isYou ? 'rgba(139,92,246,0.2)' : 'rgba(0,60,100,0.04)'}`,
          }}>
            {/* Rank */}
            <div style={{ width: 28, flexShrink: 0 }}>
              {p.rank <= 3 ? <Medal rank={p.rank} /> : (
                <span style={{ fontSize: 11, fontWeight: 900, color: 'rgba(26,42,58,0.3)', fontFamily: "'Share Tech Mono', monospace" }}>{p.rank}</span>
              )}
            </div>

            {/* Avatar circle */}
            <div style={{
              width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
              background: p.isYou ? 'linear-gradient(135deg, #8b5cf6, #6d28d9)' : `linear-gradient(135deg, hsl(${p.rank * 18}, 50%, 60%), hsl(${p.rank * 18 + 30}, 50%, 50%))`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 10, fontWeight: 900, color: '#fff', border: '2px solid rgba(255,255,255,0.8)',
            }}>{p.username.slice(0, 2).toUpperCase()}</div>

            {/* Name */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontSize: 10, fontWeight: p.isYou ? 800 : 600, color: p.isYou ? '#8b5cf6' : '#1a2a3a',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {p.username} {p.isYou && <span style={{ fontSize: 7, color: '#8b5cf6', fontWeight: 700 }}>(YOU)</span>}
              </div>
              <div style={{ fontSize: 7, color: 'rgba(26,42,58,0.3)' }}>{p.kingdoms} kingdoms</div>
            </div>

            {/* Territories */}
            <div style={{ width: 50, textAlign: 'right', fontSize: 11, fontWeight: 900, color: '#0099cc', fontFamily: "'Share Tech Mono', monospace" }}>
              {p.territories}
            </div>

            {/* HEX/day */}
            <div style={{ width: 50, textAlign: 'right', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 3 }}>
              <CrystalIcon size="sm" />
              <span style={{ fontSize: 9, fontWeight: 700, color: '#cc8800', fontFamily: "'Share Tech Mono', monospace" }}>{p.hex_per_day}</span>
            </div>
          </div>
        ))}
      </div>
    </GlassPanel>
  )
}
