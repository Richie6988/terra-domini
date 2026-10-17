/**
 * LadderPanel — Player rankings.
 * 3 tabs: Global, Nearby, Alliance. No emojis (RULE 4).
 */
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { GlassPanel } from '../shared/GlassPanel'
import { MiniIcon, StatusDot } from '../shared/MiniIcons'
import { api } from '../../services/api'
import { usePlayer } from '../../store'
import { IconSVG, ICON_BANK } from '../shared/iconBank'


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
const PODIUM = ['#f59e0b', '#cbd5e1', '#cd7f32'] // gold, silver, bronze

function Avatar({ p, size }: { p: any; size: number }) {
  const icon = p.avatar_emoji && ICON_BANK[p.avatar_emoji] ? p.avatar_emoji : null
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0,
      background: p.isYou ? 'linear-gradient(135deg, #8b5cf6, #6d28d9)' : 'linear-gradient(135deg, rgba(255,255,255,0.12), rgba(255,255,255,0.04))',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: Math.round(size * 0.36), fontWeight: 900, color: '#fff',
      border: `2px solid ${p.isYou ? '#a78bfa' : 'rgba(255,255,255,0.14)'}`,
    }}>
      {icon ? <IconSVG id={icon} size={Math.round(size * 0.8)} /> : ((p.username || '').slice(0, 2)).toUpperCase()}
    </div>
  )
}

export function LadderPanel({ onClose }: Props) {
  const [tab, setTab] = useState<Tab>('global')
  const player = usePlayer()

  // Fetch real leaderboard from backend ('nearby' is served by /leaderboard/regional/; no alliance ladder yet)
  const { data: lbData, isLoading } = useQuery({
    queryKey: ['leaderboard', tab],
    queryFn: () => api.get(`/leaderboard/${tab === 'nearby' ? 'regional' : tab}/`).then(r => r.data).catch(() => null),
    staleTime: 30000,
    enabled: tab !== 'alliance',
  })

  const rawEntries = lbData?.entries || []
  const hasHexPerDay = rawEntries.some((e: any) => e.hex_per_day != null)
  const entries = rawEntries.map((e: any, i: number) => ({
    rank: e.rank || i + 1,
    username: e.username || e.display_name,
    territories: e.territories || 0,
    hex_per_day: e.hex_per_day || e.score || 0,
    isYou: e.is_me || e.id === String(player?.id),
    avatar_emoji: e.avatar_emoji || '',
    alliance: e.alliance || null,
    battles_won: e.battles_won,
  }))
  const meRank = lbData?.me_rank ?? entries.find((p: any) => p.isYou)?.rank
  const me = entries.find((p: any) => p.isYou)
  const valueLabel = hasHexPerDay ? 'HEX/D' : 'SCORE'
  const podium = entries.slice(0, 3)
  const rest = entries.slice(3)
  const mono = "'Share Tech Mono', monospace"

  return (
    <GlassPanel title="LADDER" onClose={onClose} accent="#8b5cf6"
      icon={<IconSVG id="trophy" size={24} />} subtitle="Commander rankings by score">
      {/* Your rank */}
      {tab !== 'alliance' && me && (
        <div className="hx-card hx-card--accent" style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14 }}>
          <div className="hx-stat">
            <span className="hx-stat__label">YOUR RANK</span>
            <span className="hx-stat__value hx-stat__value--accent">#{meRank ?? '-'}</span>
          </div>
          <div style={{ flex: 1, fontSize: 10, color: 'var(--hx-text-3)', letterSpacing: 1 }}>
            OF {entries.length} RANKED PLAYERS
          </div>
          <div className="hx-stat" style={{ textAlign: 'right' }}>
            <span className="hx-stat__label">{valueLabel}</span>
            <span className="hx-stat__value">{Number(me.hex_per_day).toLocaleString()}</span>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="hx-tabs" role="tablist">
        {TABS.map(t => {
          const soon = t.id === 'alliance'
          return (
            <button key={t.id} role="tab" className="hx-tab" aria-selected={tab === t.id}
              disabled={soon} aria-disabled={soon}
              onClick={() => !soon && setTab(t.id)}
              style={soon ? { opacity: 0.5, cursor: 'not-allowed' } : undefined}>
              <MiniIcon id={t.icon} size={13} />
              {t.label}
              {soon && <span className="hx-chip" style={{ padding: '1px 6px' }}>SOON</span>}
            </button>
          )
        })}
      </div>

      {isLoading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {[0, 1, 2, 3, 4].map(i => <div key={i} className="hx-skeleton" style={{ height: 48 }} />)}
        </div>
      )}
      {!isLoading && entries.length === 0 && (
        <div className="hx-empty">
          <IconSVG id="trophy" size={44} />
          <div className="hx-empty__title">NO PLAYERS RANKED YET</div>
          <div>Claim territories to appear on the ladder.</div>
        </div>
      )}

      {/* Podium — top 3 */}
      {podium.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${podium.length}, 1fr)`, gap: 8, alignItems: 'end', marginBottom: 14 }}>
          {[podium[1], podium[0], podium[2]].filter(Boolean).map((p: any, i: number) => {
            const c = PODIUM[p.rank - 1] || '#94a3b8'
            const first = p.rank === 1
            return (
              <div key={p.rank} className="hx-rise" style={{
                animationDelay: `${i * 60}ms`,
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, minWidth: 0,
                padding: first ? '16px 8px 14px' : '12px 8px', borderRadius: 14,
                background: `linear-gradient(180deg, ${c}26 0%, ${c}08 70%, rgba(255,255,255,0.02) 100%)`,
                border: `1px solid ${p.isYou ? '#a78bfa' : c + '66'}`,
                boxShadow: p.isYou ? '0 0 18px rgba(139,92,246,0.35)' : `inset 0 1px 0 rgba(255,255,255,0.08), 0 0 16px ${c}1f`,
              }}>
                <div style={{
                  width: 26, height: 26, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: `linear-gradient(180deg, ${c}, ${c}aa)`, color: '#1a0f00', fontWeight: 900, fontSize: 12,
                  fontFamily: mono, boxShadow: `0 0 12px ${c}88`,
                }}>{p.rank}</div>
                <Avatar p={p} size={first ? 52 : 42} />
                <div style={{ fontSize: first ? 11 : 10, fontWeight: 800, color: p.isYou ? '#c4b5fd' : '#e2e8f0', maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {p.username}
                </div>
                {p.isYou && <span className="hx-chip hx-chip--accent">YOU</span>}
                <div style={{ fontFamily: mono, fontSize: first ? 20 : 16, color: c, lineHeight: 1 }}>
                  {Number(p.hex_per_day).toLocaleString()}
                </div>
                <div style={{ fontSize: 9, color: 'var(--hx-text-3)', letterSpacing: 1 }}>{valueLabel} · {p.territories} TERR</div>
              </div>
            )
          })}
        </div>
      )}

      {/* Column headers */}
      {rest.length > 0 && (
        <div style={{ display: 'flex', padding: '0 12px 8px', gap: 10, fontSize: 9, fontWeight: 700, color: 'var(--hx-text-3)', letterSpacing: 1.5 }}>
          <span style={{ width: 30 }}>#</span>
          <span style={{ flex: 1 }}>PLAYER</span>
          <span style={{ width: 44, textAlign: 'right' }}>TERR</span>
          <span style={{ width: 72, textAlign: 'right' }}>{valueLabel}</span>
        </div>
      )}

      {/* Player rows (rank 4+) */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        {rest.map((p: any, i: number) => (
          <div key={p.rank} className="hx-rise" style={{
            animationDelay: `${Math.min(i, 12) * 25}ms`,
            display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderRadius: 10, minHeight: 48,
            background: p.isYou ? 'linear-gradient(90deg, rgba(139,92,246,0.22), rgba(139,92,246,0.06))' : 'rgba(255,255,255,0.03)',
            border: `1px solid ${p.isYou ? 'rgba(167,139,250,0.6)' : 'var(--hx-line)'}`,
            boxShadow: p.isYou ? '0 0 14px rgba(139,92,246,0.25)' : 'none',
          }}>
            <div style={{ width: 30, flexShrink: 0, fontSize: 13, color: 'var(--hx-text-2)', fontFamily: mono }}>{p.rank}</div>
            <Avatar p={p} size={32} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 700, color: p.isYou ? '#c4b5fd' : '#e2e8f0' }}>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.username}</span>
                {p.isYou && <span className="hx-chip hx-chip--accent" style={{ padding: '1px 6px' }}>YOU</span>}
              </div>
              <div style={{ fontSize: 9, color: 'var(--hx-text-3)', marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {p.alliance || 'NO ALLIANCE'}{p.battles_won != null ? ` · ${p.battles_won} WINS` : ''}
              </div>
            </div>
            <div style={{ width: 44, textAlign: 'right', fontSize: 14, color: '#38bdf8', fontFamily: mono }}>{p.territories}</div>
            <div style={{ width: 72, textAlign: 'right', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4 }}>
              {hasHexPerDay && <IconSVG id="hex_coin" size={12} />}
              <span style={{ fontSize: 14, color: '#fbbf24', fontFamily: mono }}>{Number(p.hex_per_day).toLocaleString()}</span>
            </div>
          </div>
        ))}
      </div>

      {tab === 'alliance' && (
        <div className="hx-empty">
          <MiniIcon id="empire" size={36} />
          <div className="hx-empty__title">ALLIANCE LADDER</div>
          <span className="hx-chip hx-chip--accent">SOON</span>
        </div>
      )}
    </GlassPanel>
  )
}
