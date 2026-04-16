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

  return (
    <GlassPanel title="MILITARY" onClose={onClose} accent="#dc2626">
      {/* Force summary */}
      <div style={{
        display: 'flex', gap: 12, marginBottom: 12, padding: '10px 14px', borderRadius: 10,
        background: 'rgba(220,38,38,0.04)', border: '1px solid rgba(220,38,38,0.12)',
      }}>
        <div style={{ flex: 1, textAlign: 'center' }}>
          <div style={{ fontSize: 18, fontWeight: 900, color: '#dc2626', fontFamily: "'Share Tech Mono'" }}>{force.attack}</div>
          <div style={{ fontSize: 6, color: 'rgba(255,255,255,0.3)', letterSpacing: 2, ...s }}>ATTACK FORCE</div>
        </div>
        <div style={{ width: 1, background: 'rgba(255,255,255,0.08)' }} />
        <div style={{ flex: 1, textAlign: 'center' }}>
          <div style={{ fontSize: 18, fontWeight: 900, color: '#3b82f6', fontFamily: "'Share Tech Mono'" }}>{force.defense}</div>
          <div style={{ fontSize: 6, color: 'rgba(255,255,255,0.3)', letterSpacing: 2, ...s }}>DEFENSE FORCE</div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 10 }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            flex: 1, padding: '7px', borderRadius: 16, cursor: 'pointer',
            fontSize: 7, fontWeight: tab === t.id ? 700 : 500, letterSpacing: 1,
            background: tab === t.id ? 'rgba(220,38,38,0.08)' : 'rgba(255,255,255,0.04)',
            color: tab === t.id ? '#dc2626' : 'rgba(255,255,255,0.35)',
            border: `1px solid ${tab === t.id ? 'rgba(220,38,38,0.25)' : 'rgba(255,255,255,0.08)'}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, ...s,
          }}><IconSVG id={t.iconId} size={10} /> {t.label}</button>
        ))}
      </div>

      {/* Active training banner */}
      {training.filter(t => !t.done).length > 0 && (
        <div style={{
          marginBottom: 10, padding: '8px 12px', borderRadius: 10,
          background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.2)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div>
            <div style={{ fontSize: 7, color: '#cc8800', fontWeight: 700, letterSpacing: 1, ...s }}>
              <IconSVG id="gear" size={10} /> {training.filter(t=>!t.done).length} TRAINING
            </div>
            {training.filter(t => !t.done).map(t => (
              <div key={t.id} style={{ fontSize: 7, color: 'rgba(255,255,255,0.45)', marginTop: 2, fontFamily: "'Share Tech Mono'" }}>
                {t.quantity}x {units[t.unit_type]?.name || t.unit_type} — {formatTime(Math.max(0, t.remaining_seconds - tick))}
              </div>
            ))}
          </div>
          {training.some(t => t.done) && (
            <button onClick={handleCollect} style={{
              padding: '6px 14px', borderRadius: 10, cursor: 'pointer',
              background: 'linear-gradient(135deg, #22c55e, #16a34a)',
              border: 'none', color: '#fff', fontSize: 8, fontWeight: 900, letterSpacing: 1, ...s,
            }}>COLLECT</button>
          )}
        </div>
      )}

      {/* ═══ RECRUIT TAB ═══ */}
      {tab === 'recruit' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {isLoading && <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.25)', fontSize: 9, padding: 20 }}>Loading army...</div>}
          {Object.entries(units).map(([key, u]) => {
            const color = UNIT_COLORS[key] || '#64748b'
            const qty = recruitQty[key] || 1
            const totalCost = u.cost * qty
            return (
              <div key={key} style={{
                padding: '12px 14px', borderRadius: 12,
                background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: 10,
                    background: `${color}12`, border: `1px solid ${color}25`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <IconSVG id={u.icon} size={22} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 10, fontWeight: 900, color: '#e2e8f0', letterSpacing: 1, ...s }}>{u.name}</div>
                    <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>{u.desc}</div>
                    <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                      <span style={{ fontSize: 7, color: '#dc2626', fontWeight: 700, ...s }}>ATK {u.atk}</span>
                      <span style={{ fontSize: 7, color: '#3b82f6', fontWeight: 700, ...s }}>DEF {u.def}</span>
                      <span style={{ fontSize: 7, color: '#cc8800', fontWeight: 700, ...s }}>{u.cost} HEX</span>
                      <span style={{ fontSize: 7, color: 'rgba(255,255,255,0.3)', ...s }}>{formatDuration(u.effective_train_seconds)}/unit</span>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 14, fontWeight: 900, color, fontFamily: "'Share Tech Mono'" }}>{u.owned}</div>
                    <div style={{ fontSize: 6, color: 'rgba(255,255,255,0.25)', ...s }}>OWNED</div>
                  </div>
                </div>

                {/* Quantity + recruit button */}
                <div style={{ display: 'flex', gap: 6, marginTop: 8, alignItems: 'center' }}>
                  {[1, 5, 10, 25].map(n => (
                    <button key={n} onClick={() => setRecruitQty(prev => ({...prev, [key]: n}))} style={{
                      padding: '4px 8px', borderRadius: 8, cursor: 'pointer', fontSize: 8, fontWeight: 700,
                      background: qty === n ? `${color}15` : 'rgba(255,255,255,0.03)',
                      border: `1px solid ${qty === n ? color+'40' : 'rgba(255,255,255,0.06)'}`,
                      color: qty === n ? color : 'rgba(255,255,255,0.4)', ...s,
                    }}>{n}</button>
                  ))}
                  <div style={{ flex: 1 }} />
                  <button onClick={() => handleRecruit(key)} style={{
                    padding: '6px 16px', borderRadius: 10, cursor: 'pointer',
                    background: `${color}10`, border: `1px solid ${color}30`,
                    color, fontSize: 8, fontWeight: 900, letterSpacing: 1, ...s,
                  }}>
                    RECRUIT {qty} — {totalCost} HEX
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
            <div style={{ textAlign: 'center', padding: 20, color: 'rgba(255,255,255,0.4)', fontSize: 9, ...s }}>
              No active training. Recruit units to start.
            </div>
          )}
          {training.map(t => {
            const u = units[t.unit_type]
            const color = UNIT_COLORS[t.unit_type] || '#64748b'
            const remaining = Math.max(0, t.remaining_seconds - tick)
            const elapsed = (Date.now() - new Date(t.started_at).getTime()) / 1000
            const total = elapsed + t.remaining_seconds
            const pct = total > 0 ? Math.min(100, ((total - remaining) / total) * 100) : 100

            return (
              <div key={t.id} style={{
                padding: '12px 14px', borderRadius: 12,
                background: t.done ? 'rgba(34,197,94,0.04)' : 'rgba(255,255,255,0.04)',
                border: `1px solid ${t.done ? 'rgba(34,197,94,0.2)' : 'rgba(255,255,255,0.06)'}`,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <IconSVG id={u?.icon || 'swords'} size={24} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 9, fontWeight: 900, color: '#e2e8f0', letterSpacing: 1, ...s }}>
                      {t.quantity}x {u?.name || t.unit_type}
                    </div>
                    <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>
                      {t.done ? 'TRAINING COMPLETE' : `${formatTime(remaining)} remaining`}
                    </div>
                  </div>
                  {t.done && (
                    <button onClick={handleCollect} style={{
                      padding: '6px 14px', borderRadius: 10, cursor: 'pointer',
                      background: 'linear-gradient(135deg, #22c55e, #16a34a)',
                      border: 'none', color: '#fff', fontSize: 8, fontWeight: 900, letterSpacing: 1, ...s,
                    }}>COLLECT</button>
                  )}
                </div>
                {/* Progress bar */}
                {!t.done && (
                  <div style={{ marginTop: 8 }}>
                    <div style={{ height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.05)', overflow: 'hidden' }}>
                      <div style={{
                        height: '100%', width: `${pct}%`, borderRadius: 3,
                        background: `linear-gradient(90deg, ${color}, ${color}cc)`,
                        transition: 'width 1s linear',
                      }} />
                    </div>
                    <div style={{ fontSize: 6, color: 'rgba(255,255,255,0.25)', marginTop: 3, textAlign: 'right', ...s }}>
                      {Math.round(pct)}%
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* ═══ HISTORY TAB ═══ */}
      {tab === 'history' && (
        <div style={{ textAlign: 'center', padding: 30, color: 'rgba(255,255,255,0.25)', fontSize: 9, ...s }}>
          Battle history coming soon
        </div>
      )}
    </GlassPanel>
  )
}
