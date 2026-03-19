/**
 * LeaderboardPanel — Classement global + régional + visite de territoires.
 * Design war-room : table de commandement militaire.
 */
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { api } from '../../services/api'
import { useStore } from '../../store'

const MEDAL: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' }

function RankDelta({ delta }: { delta?: number | null }) {
  if (delta == null) return null
  if (delta === 0) return <span style={{ fontSize: 10, color: '#4B5563' }}>—</span>
  return <span style={{ fontSize: 10, color: delta > 0 ? '#10B981' : '#EF4444' }}>{delta > 0 ? `▲${delta}` : `▼${Math.abs(delta)}`}</span>
}

function PlayerRow({ entry, onClick }: { entry: any; onClick: () => void }) {
  const medal = MEDAL[entry.rank]
  return (
    <motion.div whileTap={{ scale: 0.98 }} onClick={onClick}
      style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 14px', borderRadius: 12, background: entry.is_me ? 'rgba(0,255,135,0.06)' : 'rgba(255,255,255,0.02)', border: `1px solid ${entry.is_me ? 'rgba(0,255,135,0.2)' : 'rgba(255,255,255,0.05)'}`, marginBottom: 6, cursor: 'pointer' }}>
      <div style={{ width: 28, textAlign: 'center', fontFamily: 'monospace', fontSize: entry.rank <= 3 ? 18 : 12, color: entry.rank <= 3 ? '#fff' : '#4B5563', flexShrink: 0 }}>
        {medal ?? `#${entry.rank}`}
      </div>
      <div style={{ width: 36, height: 36, borderRadius: '50%', background: entry.is_me ? 'rgba(0,255,135,0.15)' : 'rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>
        {entry.avatar_emoji || '🎖️'}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 13, fontWeight: entry.is_me ? 700 : 500, color: entry.is_me ? '#00FF87' : '#E5E7EB', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {entry.display_name || entry.username}
          </span>
          {entry.is_me && <span style={{ fontSize: 9, color: '#00FF87', background: 'rgba(0,255,135,0.15)', padding: '1px 6px', borderRadius: 4 }}>YOU</span>}
          <RankDelta delta={entry.delta_rank} />
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 2 }}>
          <span style={{ fontSize: 10, color: '#6B7280' }}>⬡ {entry.territories}</span>
          <span style={{ fontSize: 10, color: '#6B7280' }}>⚔️ {entry.battles_won}</span>
          {entry.alliance && <span style={{ fontSize: 10, color: '#6B7280' }}>🤝 {entry.alliance}</span>}
        </div>
      </div>
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#FFB800', fontFamily: 'monospace' }}>{entry.score?.toLocaleString()}</div>
        <div style={{ fontSize: 10, color: '#4B5563' }}>pts</div>
      </div>
    </motion.div>
  )
}

function PlayerProfile({ playerId, onBack }: { playerId: string; onBack: () => void }) {
  const { data } = useQuery({
    queryKey: ['player-territories', playerId],
    queryFn: () => api.get(`/leaderboard/player/${playerId}/territories/`).then(r => r.data),
  })
  const setMapCenter = useStore(s => s.setMapCenter)

  if (!data) return <div style={{ textAlign: 'center', padding: 40, color: '#6B7280' }}>Loading…</div>

  const p = data.player
  return (
    <div>
      <button onClick={onBack} style={{ background: 'none', border: 'none', color: '#6B7280', cursor: 'pointer', fontSize: 13, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 6 }}>
        ← Back
      </button>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
        <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, border: '2px solid rgba(255,255,255,0.12)' }}>
          {p.avatar_emoji || '🎖️'}
        </div>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#fff' }}>{p.display_name || p.username}</div>
          <div style={{ fontSize: 12, color: '#6B7280' }}>Commander Rank {p.commander_rank} · {p.territories_owned} zones</div>
        </div>
      </div>
      <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 10 }}>Their territories (click to navigate)</div>
      <div style={{ maxHeight: 340, overflowY: 'auto' }}>
        {(data.territories as any[]).map((t: any, i: number) => (
          <div key={i} onClick={() => { setMapCenter([t.center_lat, t.center_lon], 15) }}
            style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', background: 'rgba(255,255,255,0.03)', borderRadius: 8, marginBottom: 4, cursor: 'pointer' }}>
            <span style={{ fontSize: 16 }}>{t.is_control_tower ? '🗼' : '⬡'}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, color: '#E5E7EB' }}>{t.place_name || t.h3_index?.slice(0, 10)}</div>
              <div style={{ fontSize: 10, color: '#4B5563' }}>{t.country_code} · Tier {t.defense_tier}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export function LeaderboardPanel({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<'global' | 'regional'>('global')
  const [visiting, setVisiting] = useState<string | null>(null)

  const { data: global_ } = useQuery({
    queryKey: ['lb-global'],
    queryFn: () => api.get('/leaderboard/global/').then(r => r.data),
    refetchInterval: 60000,
  })
  const { data: regional } = useQuery({
    queryKey: ['lb-regional'],
    queryFn: () => api.get('/leaderboard/regional/').then(r => r.data),
    enabled: tab === 'regional',
  })

  const entries: any[] = tab === 'global' ? (global_?.entries ?? []) : (regional?.entries ?? [])
  const meRank = global_?.me_rank

  return (
    <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: 400, zIndex: 1000, display: 'flex', flexDirection: 'column', background: '#0A0A14', borderLeft: '1px solid rgba(255,255,255,0.07)' }}>

      <div style={{ display: 'flex', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.07)', flexShrink: 0 }}>
        <span style={{ fontSize: 20, marginRight: 10 }}>🏆</span>
        <span style={{ fontSize: 17, fontWeight: 600, color: '#fff', flex: 1 }}>Leaderboard</span>
        {meRank && <span style={{ fontSize: 12, color: '#6B7280', marginRight: 12 }}>You: #{meRank}</span>}
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#4B5563', cursor: 'pointer', fontSize: 22 }}>×</button>
      </div>

      <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.07)', flexShrink: 0 }}>
        {([['global', '🌍 Global'], ['regional', '📍 Regional']] as const).map(([id, label]) => (
          <button key={id} onClick={() => { setTab(id); setVisiting(null) }} style={{ flex: 1, padding: '10px', border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 12, borderBottom: tab === id ? '2px solid #00FF87' : '2px solid transparent', color: tab === id ? '#00FF87' : '#6B7280' }}>{label}</button>
        ))}
      </div>

      {tab === 'regional' && regional?.country && (
        <div style={{ padding: '8px 16px', background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: 11, color: '#6B7280' }}>
          📍 Showing leaderboard for: <strong style={{ color: '#9CA3AF' }}>{regional.country}</strong>
        </div>
      )}

      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>
        {visiting ? (
          <PlayerProfile playerId={visiting} onBack={() => setVisiting(null)} />
        ) : entries.map((e: any) => (
          <PlayerRow key={e.id} entry={e} onClick={() => !e.is_me && setVisiting(e.id)} />
        ))}
        {!entries.length && (
          <div style={{ textAlign: 'center', color: '#4B5563', padding: '40px 0', fontSize: 13 }}>Loading rankings…</div>
        )}
      </div>
    </motion.div>
  )
}
