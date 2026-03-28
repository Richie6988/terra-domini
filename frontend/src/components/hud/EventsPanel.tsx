/**
 * EventsPanel — Control Tower Wars, World POI events, global leaderboard.
 */
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { api } from '../../services/api'
import { GlassPanel } from '../shared/GlassPanel'
import toast from 'react-hot-toast'

function TimeUntil({ date }: { date: string }) {
  const diff = new Date(date).getTime() - Date.now()
  if (diff <= 0) return <span style={{ color: '#EF4444', fontSize: 12 }}>Active now</span>
  const h = Math.floor(diff / 3600000)
  const m = Math.floor((diff % 3600000) / 60000)
  return <span style={{ color: '#F59E0B', fontSize: 12 }}>{h > 0 ? `${h}h ${m}m` : `${m}m`}</span>
}

function TowerCard({ tower, onRegister }: { tower: any; onRegister: (id: string) => void }) {
  const statusColors: Record<string, string> = { scheduled: '#cc8800', active: '#dc2626', completed: '#00884a' }
  const color = statusColors[tower.status] ?? 'rgba(26,42,58,0.45)'
  return (
    <div style={{ background: 'rgba(255,255,255,0.5)', border: `1px solid ${color}30`, borderRadius: 8, padding: '14px 16px', marginBottom: 10 }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        <div style={{ fontSize: 28, lineHeight: 1 }}>🗼</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#1a2a3a', marginBottom: 4, letterSpacing: 1 }}>{tower.territory_name}</div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 8, padding: '2px 8px', borderRadius: 20, background: `${color}12`, color, fontFamily: "'Share Tech Mono', monospace", letterSpacing: 1 }}>
              {tower.status.toUpperCase()}
            </span>
            {tower.status === 'scheduled' && <TimeUntil date={tower.starts_at} />}
            {tower.status === 'active' && <span style={{ fontSize: 9, color: '#dc2626' }}>ENDS <TimeUntil date={tower.ends_at} /></span>}
            <span style={{ fontSize: 9, color: 'rgba(26,42,58,0.45)' }}>{tower.participant_count ?? 0} participants</span>
          </div>
          {tower.winner && (
            <div style={{ fontSize: 9, color: '#cc8800', letterSpacing: 1 }}>🏆 WON BY [{tower.winner.tag}]</div>
          )}
          {(tower.status === 'scheduled' || tower.status === 'registration_open' || tower.status === 'pending') && !tower.my_alliance_registered && (
            <button onClick={() => onRegister(tower.id)} style={{
              marginTop: 6, padding: '6px 14px', background: 'rgba(0,136,74,0.08)', border: '1px solid rgba(0,136,74,0.2)',
              borderRadius: 20, color: '#00884a', fontSize: 8, cursor: 'pointer', fontWeight: 700, letterSpacing: 1,
              fontFamily: "'Orbitron', system-ui, sans-serif",
            }}>
              REGISTER ALLIANCE
            </button>
          )}
          {tower.my_alliance_registered && (
            <div style={{ fontSize: 9, color: '#00884a', marginTop: 6, letterSpacing: 1 }}>✓ ALLIANCE REGISTERED</div>
          )}
        </div>
      </div>
    </div>
  )
}

function POICard({ poi }: { poi: any }) {
  const threatColors: Record<string, string> = { critical: '#dc2626', high: '#f97316', medium: '#cc8800', low: '#2563eb' }
  const color = threatColors[poi.threat_level] ?? 'rgba(26,42,58,0.45)'
  const effects = poi.effects?.resource_multipliers ?? {}

  return (
    <div style={{ background: 'rgba(255,255,255,0.5)', border: `1px solid ${color}30`, borderRadius: 8, padding: '14px 16px', marginBottom: 10 }}>
      <div style={{ display: 'flex', gap: 10, marginBottom: 8 }}>
        <span style={{ fontSize: 22 }}>{poi.icon_emoji ?? '🔥'}</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#1a2a3a', letterSpacing: 1 }}>{poi.name}</div>
          <span style={{ fontSize: 8, padding: '2px 7px', borderRadius: 20, background: `${color}12`, color, fontFamily: "'Share Tech Mono', monospace", letterSpacing: 1 }}>
            {poi.threat_level?.toUpperCase()}
          </span>
        </div>
      </div>
      <div style={{ fontSize: 9, color: 'rgba(26,42,58,0.6)', lineHeight: 1.6, marginBottom: 8 }}>{poi.description?.slice(0, 120)}…</div>
      {Object.keys(effects).length > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {Object.entries(effects).map(([k, v]: [string, any]) => (
            <span key={k} style={{
              fontSize: 8, padding: '2px 8px', borderRadius: 20,
              background: v < 1 ? 'rgba(220,38,38,0.08)' : 'rgba(0,136,74,0.08)',
              color: v < 1 ? '#dc2626' : '#00884a', fontFamily: "'Share Tech Mono', monospace", letterSpacing: 1,
            }}>
              {k} {v < 1 ? `−${Math.round((1 - v) * 100)}%` : `×${v}`}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

function SectionLabel({ emoji, label, color }: { emoji: string; label: string; color: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 0 4px', marginTop: 4 }}>
      <span style={{ fontSize: 14 }}>{emoji}</span>
      <span style={{ fontSize: 9, fontWeight: 700, color, letterSpacing: 2, fontFamily: "'Orbitron', system-ui, sans-serif" }}>{label}</span>
    </div>
  )
}


export function EventsPanel({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<'towers' | 'world'>('towers')
  const qc = useQueryClient()

  const { data: towersData } = useQuery({
    queryKey: ['control-towers'],
    queryFn: () => api.get('/control-towers/').then(r => r.data?.results ?? r.data ?? []),
    refetchInterval: 30000,
  })

  const { data: pois } = useQuery({
    queryKey: ['world-pois'],
    queryFn: () => api.get('/pois/?status=active').then(r => r.data?.results ?? r.data ?? []),
    staleTime: 60000,
  })

  const registerMut = useMutation({
    mutationFn: (id: string) => api.post(`/control-towers/${id}/register/`),
    onSuccess: () => { toast.success(data?.data?.message || 'Registered for Tower War! ⚔️'); qc.invalidateQueries({ queryKey: ['control-towers'] }) },
    onError: (e: any) => {
      const msg = e.response?.data?.error || 'Registration failed'
      if (msg.includes('alliance')) {
        toast.error('⚔️ ' + msg + ' — or register solo below')
      } else {
        toast.error(msg)
      }
    },
  })

  const towers = Array.isArray(towersData) ? towersData : []
  const active = towers.filter((t: any) => t.status === 'active')
  const scheduled = towers.filter((t: any) => t.status === 'scheduled')
  const completed = (towers ?? []).filter((t: any) => t.status === 'completed').slice(0, 5)

  return (
    <GlassPanel title="EVENTS" onClose={onClose} accent="#f97316">
      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 14 }}>
        {[{ id: 'towers', label: `TOWERS (${towers.length})` }, { id: 'world', label: `WORLD (${(pois as any[])?.length ?? 0})` }].map(t => (
          <button key={t.id} onClick={() => setTab(t.id as any)} style={{
            flex: 1, padding: '7px', borderRadius: 20, border: 'none', cursor: 'pointer',
            fontSize: 8, fontWeight: tab === t.id ? 700 : 500, letterSpacing: 1,
            background: tab === t.id ? 'rgba(249,115,22,0.12)' : 'rgba(255,255,255,0.5)',
            color: tab === t.id ? '#f97316' : 'rgba(26,42,58,0.45)',
            fontFamily: "'Orbitron', system-ui, sans-serif",
            border: `1px solid ${tab === t.id ? 'rgba(249,115,22,0.3)' : 'rgba(0,60,100,0.1)'}`,
          }}>{t.label}</button>
        ))}
      </div>

      {tab === 'towers' && (
        <div>
          {active.length > 0 && (
            <>
              <SectionLabel emoji="⚡" label="Active Now" color="#dc2626" />
              {active.map((t: any) => <TowerCard key={t.id} tower={t} onRegister={id => registerMut.mutate(id)} />)}
            </>
          )}
          {scheduled.length > 0 && (
            <>
              <SectionLabel emoji="⏰" label="Upcoming" color="#cc8800" />
              {scheduled.map((t: any) => <TowerCard key={t.id} tower={t} onRegister={id => registerMut.mutate(id)} />)}
            </>
          )}
          {completed.length > 0 && (
            <>
              <SectionLabel emoji="📜" label="Recent Results" color="rgba(26,42,58,0.45)" />
              {completed.map((t: any) => <TowerCard key={t.id} tower={t} onRegister={() => {}} />)}
            </>
          )}
          {towers.length === 0 && (
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>🗼</div>
              <div style={{ fontSize: 10, color: '#1a2a3a', letterSpacing: 2 }}>NO TOWER EVENTS YET</div>
              <div style={{ fontSize: 9, color: 'rgba(26,42,58,0.45)', marginTop: 6 }}>Events are scheduled 3× daily</div>
            </div>
          )}
        </div>
      )}
      {tab === 'world' && (
        <div>
          {(pois as any[] ?? []).length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>🌍</div>
              <div style={{ fontSize: 10, color: '#1a2a3a', letterSpacing: 2 }}>NO ACTIVE WORLD EVENTS</div>
              <div style={{ fontSize: 9, color: 'rgba(26,42,58,0.45)', marginTop: 6 }}>World events reflect real geopolitical news</div>
            </div>
          ) : (
            (pois as any[]).map((p: any) => <POICard key={p.id} poi={p} />)
          )}
        </div>
      )}
    </GlassPanel>
  )
}
