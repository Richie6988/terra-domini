/**
 * EventsPanel — Control Tower Wars, World POI events, global leaderboard.
 */
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { X } from 'lucide-react'
import { api } from '../../services/api'
import toast from 'react-hot-toast'

function TimeUntil({ date }: { date: string }) {
  const diff = new Date(date).getTime() - Date.now()
  if (diff <= 0) return <span style={{ color: '#EF4444', fontSize: 12 }}>Active now</span>
  const h = Math.floor(diff / 3600000)
  const m = Math.floor((diff % 3600000) / 60000)
  return <span style={{ color: '#F59E0B', fontSize: 12 }}>{h > 0 ? `${h}h ${m}m` : `${m}m`}</span>
}

function TowerCard({ tower, onRegister }: { tower: any; onRegister: (id: string) => void }) {
  const statusColors: Record<string, string> = { scheduled: '#F59E0B', active: '#EF4444', completed: '#10B981' }
  const color = statusColors[tower.status] ?? '#6B7280'
  return (
    <div style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${color}25`, borderRadius: 12, padding: '14px 16px', marginBottom: 10 }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        <div style={{ fontSize: 28, lineHeight: 1 }}>🗼</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#fff', marginBottom: 4 }}>{tower.territory_name}</div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 4, background: `${color}15`, color, fontFamily: 'monospace', letterSpacing: '0.06em' }}>
              {tower.status.toUpperCase()}
            </span>
            {tower.status === 'scheduled' && <TimeUntil date={tower.starts_at} />}
            {tower.status === 'active' && <span style={{ fontSize: 12, color: '#EF4444' }}>Ends <TimeUntil date={tower.ends_at} /></span>}
            <span style={{ fontSize: 11, color: '#4B5563' }}>{tower.participant_count ?? 0} participants</span>
          </div>
          {tower.winner && (
            <div style={{ fontSize: 12, color: '#F59E0B' }}>🏆 Won by [{tower.winner.tag}]</div>
          )}
          {(tower.status === 'scheduled' || tower.status === 'registration_open' || tower.status === 'pending') && !tower.my_alliance_registered && (
            <button onClick={() => onRegister(tower.id)} style={{
              marginTop: 6, padding: '6px 14px', background: 'rgba(0,255,135,0.1)', border: '1px solid rgba(0,255,135,0.25)',
              borderRadius: 8, color: '#00FF87', fontSize: 12, cursor: 'pointer', fontWeight: 500,
            }}>
              Register Alliance
            </button>
          )}
          {tower.my_alliance_registered && (
            <div style={{ fontSize: 12, color: '#00FF87', marginTop: 6 }}>✓ Alliance registered</div>
          )}
        </div>
      </div>
    </div>
  )
}

function POICard({ poi }: { poi: any }) {
  const threatColors: Record<string, string> = { critical: '#EF4444', high: '#F97316', medium: '#F59E0B', low: '#3B82F6' }
  const color = threatColors[poi.threat_level] ?? '#6B7280'
  const effects = poi.effects?.resource_multipliers ?? {}

  return (
    <div style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${color}25`, borderRadius: 12, padding: '14px 16px', marginBottom: 10 }}>
      <div style={{ display: 'flex', gap: 10, marginBottom: 8 }}>
        <span style={{ fontSize: 22 }}>{poi.icon_emoji ?? '🔥'}</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>{poi.name}</div>
          <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 3, background: `${color}15`, color, fontFamily: 'monospace', letterSpacing: '0.06em' }}>
            {poi.threat_level?.toUpperCase()}
          </span>
        </div>
      </div>
      <div style={{ fontSize: 12, color: '#9CA3AF', lineHeight: 1.6, marginBottom: 8 }}>{poi.description?.slice(0, 120)}…</div>
      {Object.keys(effects).length > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {Object.entries(effects).map(([k, v]: [string, any]) => (
            <span key={k} style={{
              fontSize: 10, padding: '2px 8px', borderRadius: 4,
              background: v < 1 ? 'rgba(239,68,68,0.12)' : 'rgba(16,185,129,0.12)',
              color: v < 1 ? '#FCA5A5' : '#6EE7B7', fontFamily: 'monospace',
            }}>
              {k} {v < 1 ? `−${Math.round((1 - v) * 100)}%` : `×${v}`}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

function SectionLabel({ emoji, label, color }: { emoji: string; label: string; color: string }

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
  const completed = towers.filter((t: any) => t.status === 'completed').slice(0, 5)

  return (
    <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: 380, zIndex: 1000, display: 'flex', flexDirection: 'column',
        background: '#0A0A14', borderLeft: '1px solid rgba(255,255,255,0.08)' }}>

      <div style={{ display: 'flex', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.07)', flexShrink: 0 }}>
        <span style={{ fontSize: 20, marginRight: 10 }}>🏆</span>
        <span style={{ fontSize: 17, fontWeight: 600, color: '#fff', flex: 1 }}>Events</span>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#4B5563', cursor: 'pointer', padding: 4 }}><X size={18} /></button>
      </div>

      <div style={{ display: 'flex', gap: 4, padding: '12px 20px', borderBottom: '1px solid rgba(255,255,255,0.07)', flexShrink: 0 }}>
        {[{ id: 'towers', label: `Towers (${towers.length})` }, { id: 'world', label: `World Events (${(pois as any[])?.length ?? 0})` }].map(t => (
          <button key={t.id} onClick={() => setTab(t.id as any)} style={{
            flex: 1, padding: '7px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 500,
            background: tab === t.id ? 'rgba(255,255,255,0.1)' : 'transparent',
            color: tab === t.id ? '#fff' : '#6B7280',
          }}>{t.label}</button>
        ))}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
        {tab === 'towers' && (
          <div>
            {active.length > 0 && (
              <>
                <SectionLabel emoji="⚡" label="Active Now" color="#EF4444" />
                {active.map((t: any) => <TowerCard key={t.id} tower={t} onRegister={id => registerMut.mutate(id)} />)}
              </>
            )}
            {scheduled.length > 0 && (
              <>
                <SectionLabel emoji="⏰" label="Upcoming" color="#F59E0B" />
                {scheduled.map((t: any) => <TowerCard key={t.id} tower={t} onRegister={id => registerMut.mutate(id)} />)}
              </>
            )}
            {completed.length > 0 && (
              <>
                <SectionLabel emoji="📜" label="Recent Results" color="#6B7280" />
                {completed.map((t: any) => <TowerCard key={t.id} tower={t} onRegister={() => {}} />)}
              </>
            )}
            {towers.length === 0 && (
              <div style={{ textAlign: 'center', padding: '40px 0' }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>🗼</div>
                <div style={{ fontSize: 14, color: '#9CA3AF' }}>No tower events yet</div>
                <div style={{ fontSize: 12, color: '#4B5563', marginTop: 6 }}>Events are scheduled 3× daily</div>
              </div>
            )}
          </div>
        )}
        {tab === 'world' && (
          <div>
            {(pois as any[] ?? []).length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 0' }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>🌍</div>
                <div style={{ fontSize: 14, color: '#9CA3AF' }}>No active world events</div>
                <div style={{ fontSize: 12, color: '#4B5563', marginTop: 6 }}>World events reflect real geopolitical news</div>
              </div>
            ) : (
              (pois as any[]).map((p: any) => <POICard key={p.id} poi={p} />)
            )}
          </div>
        )}
      </div>
    </motion.div>
  )
}
) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10, marginTop: 4 }}>
      <span style={{ fontSize: 12 }}>{emoji}</span>
      <span style={{ fontSize: 10, fontFamily: 'monospace', letterSpacing: '0.1em', color, fontWeight: 500, textTransform: 'uppercase' }}>{label}</span>
    </div>
  )
}
