/**
 * CombatPanel — Military Command Center.
 * Wired to real API: /api/combat/my-army/, recruit, collect, assign.
 * Admin gets fast training (minutes instead of hours).
 */
import { useState, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../../services/api'
import { usePlayer } from '../../store'
import { GlassPanel } from '../shared/GlassPanel'
import { IconSVG } from '../shared/iconBank'
import toast from 'react-hot-toast'
import { Swords, Shield, Users, Hourglass, History, Clock } from 'lucide-react'

interface UnitDef {
  name: string; icon: string; atk: number; def: number; cost: number
  train_seconds: number; admin_train_seconds: number; desc: string
  owned: number; effective_train_seconds: number
}
interface TrainingItem {
  id: string; unit_type: string; quantity: number
  started_at: string; completes_at: string; remaining_seconds: number; done: boolean
}
interface ArmyData {
  units: Record<string, UnitDef>
  training: TrainingItem[]
  force: { attack: number; defense: number }
}

const TABS = [
  { id: 'recruit', label: 'RECRUIT',  iconId: 'swords' },
  { id: 'train',   label: 'TRAINING', iconId: 'gear' },
  { id: 'history', label: 'HISTORY',  iconId: 'chart_bar' },
]

interface Props { onClose: () => void }

function formatTime(s: number): string {
  if (s <= 0) return 'READY'
  const h = Math.floor(s/3600), m = Math.floor((s%3600)/60), sec = s%60
  return `${h.toString().padStart(2,'0')}:${m.toString().padStart(2,'0')}:${sec.toString().padStart(2,'0')}`
}

function formatDuration(s: number): string {
  if (s < 60) return `${s}s`
  if (s < 3600) return `${Math.round(s/60)}min`
  return `${(s/3600).toFixed(1)}h`
}

export function CombatPanel({ onClose }: Props) {
  const [tab, setTab] = useState('recruit')
  const [recruitQty, setRecruitQty] = useState<Record<string,number>>({})
  const [tick, setTick] = useState(0)
  const player = usePlayer()
  const qc = useQueryClient()
  const s = { fontFamily: "'Orbitron', system-ui, sans-serif" } as const

  // Tick for countdown
  useEffect(() => { const iv = setInterval(() => setTick(t=>t+1), 1000); return () => clearInterval(iv) }, [])

  // Real API data
  const { data: army, isLoading } = useQuery<ArmyData>({
    queryKey: ['my-army'],
    queryFn: () => api.get('/combat/my-army/').then(r => r.data),
    staleTime: 10000,
    refetchInterval: 15000,
  })

  const units = army?.units || {}
  const training = army?.training || []
  const force = army?.force || { attack: 0, defense: 0 }

  const handleRecruit = async (unitType: string) => {
    const qty = recruitQty[unitType] || 1
    try {
      const res = await api.post('/combat/recruit/', { unit_type: unitType, quantity: qty })
      toast.success(`Training ${qty} ${units[unitType]?.name || unitType}! Ready in ${formatDuration(res.data.train_seconds)}`)
      qc.invalidateQueries({ queryKey: ['my-army'] })
      qc.invalidateQueries({ queryKey: ['player'] })
    } catch (e: any) {
      toast.error(e?.response?.data?.error || 'Recruitment failed')
    }
  }

  const handleCollect = async () => {
    try {
      const res = await api.post('/combat/collect/')
      if (res.data.total_collected > 0) {
        toast.success(`Collected ${res.data.total_collected} units!`)
        qc.invalidateQueries({ queryKey: ['my-army'] })
      } else {
        toast.error('No training complete yet')
      }
    } catch { toast.error('Collection failed') }
  }

  const UNIT_COLORS: Record<string,string> = {
    infantry: '#64748b', cavalry: '#f59e0b', artillery: '#dc2626',
    aerial: '#8b5cf6', naval: '#3b82f6', spy: '#ec4899',
  }

  const unitList = Object.values(units)
  const maxAtk = Math.max(1, ...unitList.map(u => u.atk))
  const maxDef = Math.max(1, ...unitList.map(u => u.def))
  const totalOwned = unitList.reduce((a, u) => a + (u.owned || 0), 0)
  const activeTraining = training.filter(t => !t.done)
  const mono = "'Share Tech Mono', monospace"
  const label = { fontSize: 9, letterSpacing: 1.5, color: 'var(--hx-text-3)', fontWeight: 700, ...s } as const

  const StatBar = ({ name, value, max, color }: { name: string; value: number; max: number; color: string }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ ...label, width: 28, color }}>{name}</span>
      <div className="hx-progress" style={{ flex: 1, ['--accent' as any]: color }}>
        <div className="hx-progress__fill" style={{ width: `${(value / max) * 100}%` }} />
      </div>
      <span style={{ fontFamily: mono, fontSize: 13, color: '#e2e8f0', width: 26, textAlign: 'right' }}>{value}</span>
    </div>
  )

  return (
    <GlassPanel title="MILITARY" onClose={onClose} accent="#dc2626"
      icon={<IconSVG id="swords" size={24} />} subtitle="Recruit, train and command your army">
      {/* Force summary */}
      <div className="hx-stat-grid" style={{ marginBottom: 14 }}>
        {[
          { l: 'ATTACK FORCE', v: force.attack, c: '#f87171', icon: <Swords size={18} /> },
          { l: 'DEFENSE FORCE', v: force.defense, c: '#60a5fa', icon: <Shield size={18} /> },
          { l: 'UNITS OWNED', v: totalOwned, c: '#e2e8f0', icon: <Users size={18} /> },
        ].map(st => (
          <div key={st.l} className="hx-card" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ color: st.c, width: 36, height: 36, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--hx-line)' }}>{st.icon}</span>
            <div className="hx-stat">
              <span className="hx-stat__label">{st.l}</span>
              <span className="hx-stat__value" style={{ color: st.c }}>{st.v.toLocaleString()}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="hx-tabs" role="tablist">
        {TABS.map(t => (
          <button key={t.id} role="tab" className="hx-tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}>
            {t.id === 'recruit' ? <Swords size={14} /> : t.id === 'train' ? <Hourglass size={14} /> : <History size={14} />}
            {t.label}
            {t.id === 'train' && activeTraining.length > 0 && <span className="hx-chip hx-chip--accent" style={{ padding: '1px 6px' }}>{activeTraining.length}</span>}
          </button>
        ))}
      </div>

      {/* Active training banner */}
      {activeTraining.length > 0 && tab !== 'train' && (
        <div className="hx-card" style={{
          marginBottom: 12, ['--accent' as any]: '#f59e0b',
          borderColor: 'rgba(245,158,11,0.35)', background: 'linear-gradient(180deg, rgba(245,158,11,0.10), rgba(245,158,11,0.03))',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 8 }}>
            <div style={{ ...label, color: '#fbbf24', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Hourglass size={13} /> {activeTraining.length} IN TRAINING
            </div>
            {training.some(t => t.done) && (
              <button onClick={handleCollect} className="btn-game btn-game-green" style={{ padding: '8px 14px', fontSize: 10 }}>COLLECT</button>
            )}
          </div>
          {activeTraining.map(t => (
            <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 11, color: 'var(--hx-text-2)', marginTop: 4 }}>
              <span style={{ flex: 1 }}>{t.quantity}x {units[t.unit_type]?.name || t.unit_type}</span>
              <span style={{ fontFamily: mono, fontSize: 13, color: '#fbbf24', display: 'flex', alignItems: 'center', gap: 4 }}>
                <Clock size={12} /> {formatTime(Math.max(0, t.remaining_seconds - tick))}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* ═══ RECRUIT TAB ═══ */}
      {tab === 'recruit' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 340px), 1fr))', gap: 10 }}>
          {isLoading && [0, 1, 2, 3].map(i => <div key={i} className="hx-skeleton" style={{ height: 180, borderRadius: 12 }} />)}
          {Object.entries(units).map(([key, u], idx) => {
            const color = UNIT_COLORS[key] || '#64748b'
            const qty = recruitQty[key] || 1
            const totalCost = u.cost * qty
            return (
              <div key={key} className="hx-card hx-rise" style={{ animationDelay: `${idx * 40}ms`, display: 'flex', flexDirection: 'column', gap: 12, ['--accent' as any]: color }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  <div style={{
                    width: 56, height: 56, borderRadius: 14, flexShrink: 0,
                    background: `radial-gradient(circle at 50% 35%, ${color}40, ${color}12)`, border: `1px solid ${color}66`,
                    boxShadow: `0 0 16px ${color}22, inset 0 1px 0 rgba(255,255,255,0.12)`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <IconSVG id={u.icon} size={38} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 900, color: '#e2e8f0', letterSpacing: 1.5, ...s }}>{u.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--hx-text-2)', marginTop: 4, lineHeight: 1.4, fontFamily: 'system-ui, sans-serif', textTransform: 'none', letterSpacing: 0 }}>{u.desc}</div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: 24, color, fontFamily: mono, lineHeight: 1 }}>{u.owned}</div>
                    <div style={{ ...label, marginTop: 4 }}>OWNED</div>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <StatBar name="ATK" value={u.atk} max={maxAtk} color="#ef4444" />
                  <StatBar name="DEF" value={u.def} max={maxDef} color="#3b82f6" />
                </div>

                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <span className="hx-chip"><IconSVG id="hex_coin" size={12} /> {u.cost} HEX / UNIT</span>
                  <span className="hx-chip"><Clock size={11} /> {formatDuration(u.effective_train_seconds)} / UNIT</span>
                </div>

                {/* Quantity + recruit button */}
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', gap: 4, padding: 3, borderRadius: 10, background: 'rgba(0,0,0,0.25)', border: '1px solid var(--hx-line)' }}>
                    {[1, 5, 10, 25].map(n => (
                      <button key={n} aria-label={`Quantity ${n}`} onClick={() => setRecruitQty(prev => ({...prev, [key]: n}))} style={{
                        minWidth: 36, height: 34, borderRadius: 8, cursor: 'pointer', fontSize: 12, fontFamily: mono,
                        background: qty === n ? `${color}33` : 'transparent',
                        border: `1px solid ${qty === n ? color + '99' : 'transparent'}`,
                        color: qty === n ? '#fff' : 'var(--hx-text-3)', transition: 'background .15s, color .15s',
                      }}>{n}</button>
                    ))}
                  </div>
                  <div style={{ flex: 1 }} />
                  <button onClick={() => handleRecruit(key)} className="btn-game btn-game-red" style={{
                    fontSize: 10, letterSpacing: 1, padding: '11px 14px', display: 'inline-flex', alignItems: 'center', gap: 6,
                  }}>
                    RECRUIT {qty} · <IconSVG id="hex_coin" size={13} />{totalCost.toLocaleString()}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ═══ TRAINING TAB ═══ */}
      {tab === 'train' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {training.length === 0 && (
            <div className="hx-empty">
              <Hourglass size={36} color="#f87171" />
              <div className="hx-empty__title">NO ACTIVE TRAINING</div>
              <div>Recruit units to start training them.</div>
              <button className="btn-game btn-game-red" onClick={() => setTab('recruit')} style={{ marginTop: 6 }}>RECRUIT UNITS</button>
            </div>
          )}
          {training.some(t => t.done) && (
            <button onClick={handleCollect} className="btn-game btn-game-green" style={{ alignSelf: 'flex-end', fontSize: 10 }}>COLLECT ALL READY</button>
          )}
          {training.map((t, idx) => {
            const u = units[t.unit_type]
            const color = UNIT_COLORS[t.unit_type] || '#64748b'
            const remaining = Math.max(0, t.remaining_seconds - tick)
            const elapsed = (Date.now() - new Date(t.started_at).getTime()) / 1000
            const total = elapsed + t.remaining_seconds
            const pct = total > 0 ? Math.min(100, ((total - remaining) / total) * 100) : 100

            return (
              <div key={t.id} className="hx-card hx-rise" style={{
                animationDelay: `${idx * 40}ms`, ['--accent' as any]: t.done ? '#22c55e' : color,
                borderColor: t.done ? 'rgba(34,197,94,0.4)' : undefined,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <IconSVG id={u?.icon || 'swords'} size={36} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, fontWeight: 900, color: '#e2e8f0', letterSpacing: 1, ...s }}>
                      {t.quantity}x {u?.name || t.unit_type}
                    </div>
                    <div style={{ fontSize: 10, color: t.done ? '#4ade80' : 'var(--hx-text-3)', marginTop: 4, letterSpacing: 1 }}>
                      {t.done ? 'TRAINING COMPLETE' : 'IN TRAINING'}
                    </div>
                  </div>
                  {t.done ? (
                    <button onClick={handleCollect} className="btn-game btn-game-green" style={{ fontSize: 10, letterSpacing: 1 }}>COLLECT</button>
                  ) : (
                    <span className="hx-chip" style={{ fontFamily: mono, fontSize: 12 }}><Clock size={12} /> {formatTime(remaining)}</span>
                  )}
                </div>
                {!t.done && (
                  <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div className="hx-progress" style={{ flex: 1 }}>
                      <div className="hx-progress__fill" style={{ width: `${pct}%`, transition: 'width 1s linear' }} />
                    </div>
                    <span style={{ fontSize: 11, color: 'var(--hx-text-2)', fontFamily: mono, width: 36, textAlign: 'right' }}>{Math.round(pct)}%</span>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* ═══ HISTORY TAB ═══ */}
      {tab === 'history' && (
        <div className="hx-empty">
          <History size={36} color="#f87171" />
          <div className="hx-empty__title">BATTLE HISTORY</div>
          <span className="hx-chip hx-chip--accent">SOON</span>
          <div>Your resolved battles will be listed here.</div>
        </div>
      )}
    </GlassPanel>
  )
}
