/**
 * CombatPanel — Military command center.
 * Train units with real training time progress bars.
 * New units: Spy, Engineer, Medic, Commander.
 */
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { api } from '../../services/api'
import { usePlayer } from '../../store'
import { GlassPanel } from '../shared/GlassPanel'
import { CrystalIcon } from '../shared/CrystalIcon'
import toast from 'react-hot-toast'

const UNITS = [
  { key: 'infantry',   emoji: '⚔️',  name: 'Infantry',   cost: 50,  atk: 10, def: 8,  speed: 'Fast',   trainMins: 5,  desc: 'Basic ground troops. Fast to deploy.' },
  { key: 'cavalry',    emoji: '🐎',  name: 'Cavalry',    cost: 120, atk: 25, def: 12, speed: 'V.Fast', trainMins: 10, desc: 'Mobile strike force. Bonus vs infantry.' },
  { key: 'artillery',  emoji: '💣',  name: 'Artillery',  cost: 200, atk: 45, def: 5,  speed: 'Slow',   trainMins: 20, desc: 'Siege weapon. Destroys fortifications.' },
  { key: 'spy',        emoji: '🕵️',  name: 'Spy',        cost: 150, atk: 15, def: 3,  speed: 'V.Fast', trainMins: 8,  desc: 'Reveals enemy positions. Intel bonus.' },
  { key: 'engineer',   emoji: '🔧',  name: 'Engineer',   cost: 180, atk: 8,  def: 15, speed: 'Medium', trainMins: 8,  desc: 'Builds fortifications. Defense +20%.' },
  { key: 'medic',      emoji: '🏥',  name: 'Medic',      cost: 100, atk: 2,  def: 5,  speed: 'Medium', trainMins: 5,  desc: 'Reduces casualties. Unit recovery.' },
  { key: 'naval',      emoji: '⚓',  name: 'Naval',      cost: 300, atk: 35, def: 30, speed: 'Medium', trainMins: 15, desc: 'Controls coastal territories.' },
  { key: 'commander',  emoji: '🎖️',  name: 'Commander',  cost: 500, atk: 60, def: 40, speed: 'Medium', trainMins: 60, desc: 'Boosts all units +25%. Rare.' },
]

type TrainingOrder = {
  unit_type: string; quantity: number; tdc_spent: number
  train_seconds: number; ready_at: string; started_at: string
}

function TrainingQueue({ orders, onComplete }: { orders: TrainingOrder[]; onComplete: () => void }) {
  if (!orders.length) return null
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 11, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>⏳ Training Queue</div>
      {orders.map((o, i) => {
        const unit = UNITS.find(u => u.key === o.unit_type)
        const total = o.train_seconds * 1000
        const elapsed = Date.now() - new Date(o.started_at).getTime()
        const pct = Math.min(100, (elapsed / total) * 100)
        const remaining = Math.max(0, Math.ceil((total - elapsed) / 1000))
        const mins = Math.floor(remaining / 60), secs = remaining % 60
        const done = pct >= 100

        return (
          <div key={i} style={{ background: done ? 'rgba(0,255,135,0.08)' : 'rgba(255,255,255,0.03)', border: `1px solid ${done ? 'rgba(0,255,135,0.3)' : 'rgba(255,255,255,0.07)'}`, borderRadius: 10, padding: '10px 14px', marginBottom: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <span style={{ fontSize: 13, color: '#fff' }}>{unit?.emoji} {o.quantity}× {unit?.name ?? o.unit_type}</span>
              <span style={{ fontSize: 11, color: done ? '#00FF87' : '#F59E0B', fontFamily: 'monospace' }}>
                {done ? '✅ Ready!' : `${mins}m ${secs}s`}
              </span>
            </div>
            <div style={{ height: 4, background: 'rgba(255,255,255,0.08)', borderRadius: 2, overflow: 'hidden' }}>
              <motion.div animate={{ width: `${pct}%` }} transition={{ duration: 1 }}
                style={{ height: '100%', background: done ? '#00FF87' : 'linear-gradient(90deg, #F59E0B, #EF4444)', borderRadius: 2 }} />
            </div>
            {done && (
              <button onClick={onComplete} style={{ marginTop: 8, width: '100%', padding: '6px', background: 'rgba(0,255,135,0.12)', border: '1px solid rgba(0,255,135,0.3)', borderRadius: 6, color: '#00FF87', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>
                Collect Units
              </button>
            )}
          </div>
        )
      })}
    </div>
  )
}

const TABS = [{ id: 'active', label: '⚔️ Active' }, { id: 'train', label: '🪖 Train' }, { id: 'history', label: '📋 History' }]
const STATUS_COLOR: Record<string, string> = { preparing: '#F59E0B', active: '#EF4444', resolving: '#8B5CF6', completed: '#10B981', cancelled: '#4B5563' }
const RESULT_COLOR: Record<string, string> = { attacker: '#00FF87', defender: '#EF4444', draw: '#F59E0B' }

export function CombatPanel({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState('train')
  const [qty, setQty] = useState<Record<string, number>>({})
  const [selected, setSel] = useState<string | null>(null)
  const [trainingOrders, setTrainingOrders] = useState<TrainingOrder[]>([])
  const player = usePlayer()
  const qc = useQueryClient()
  const tdc = parseFloat(String(player?.tdc_in_game ?? 0))

  const { data: battlesData } = useQuery({
    queryKey: ['battles-active'],
    queryFn: () => api.get('/battles/?ordering=-started_at&limit=10').then(r => r.data),
    refetchInterval: 5000,
  })
  const { data: historyData } = useQuery({
    queryKey: ['battles-history'],
    queryFn: () => api.get('/battles/?ordering=-started_at&limit=30').then(r => r.data),
    enabled: tab === 'history',
  })

  const totalCost = Object.entries(qty).reduce((sum, [k, n]) => {
    const u = UNITS.find(u => u.key === k)
    return sum + (u?.cost ?? 0) * n
  }, 0)

  const trainMut = useMutation({
    mutationFn: async () => {
      const entries = Object.entries(qty).filter(([, n]) => n > 0)
      if (!entries.length) throw new Error('Select units to train')
      const results = []
      for (const [key, n] of entries) {
        const res = await api.post('/shop/purchase/', { item_code: `unit_${key}`, quantity: n })
        results.push(res.data)
      }
      return results
    },
    onSuccess: (results) => {
      const now = new Date().toISOString()
      const newOrders: TrainingOrder[] = results.map(r => ({
        unit_type: r.unit_type,
        quantity: r.quantity,
        tdc_spent: r.tdc_spent,
        train_seconds: r.train_seconds,
        ready_at: r.ready_at,
        started_at: now,
      }))
      setTrainingOrders(prev => [...prev, ...newOrders])
      toast.success(`Training ${Object.entries(qty).filter(([,n])=>n>0).map(([k,n])=>`${n}× ${UNITS.find(u=>u.key===k)?.name}`).join(', ')}!`)
      setQty({})
      setSel(null)
      qc.invalidateQueries({ queryKey: ['player'] })
      qc.invalidateQueries({ queryKey: ['player-live'] })
      setTab('train')
    },
    onError: (e: any) => toast.error(e.response?.data?.error || e.message || 'Training failed'),
  })

  const battles = Array.isArray(battlesData) ? battlesData : (battlesData?.results ?? [])
  const history = Array.isArray(historyData) ? historyData : (historyData?.results ?? [])
  const active = battles.filter((b: any) => b.status !== 'completed' && b.status !== 'cancelled')
  const completed = battles.filter((b: any) => b.status === 'completed' || b.status === 'cancelled')

  return (
    <GlassPanel title="MILITARY COMMAND" onClose={onClose} accent="#dc2626" width={390}>
      {/* Balance bar */}
      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:12,
        padding:'8px 12px', background:'rgba(255,255,255,0.5)', borderRadius:8,
        border:'1px solid rgba(0,60,100,0.1)' }}>
        <CrystalIcon size="md" />
        <span style={{ fontSize:13, fontWeight:900, color:'#7950f2', fontFamily:"'Share Tech Mono', monospace" }}>{tdc.toFixed(0)}</span>
        {active.length > 0 && <span style={{ fontSize:8, color:'#dc2626', marginLeft:8, letterSpacing:1 }}>⚔ {active.length} ACTIVE</span>}
        {trainingOrders.length > 0 && <span style={{ fontSize:8, color:'#cc8800', marginLeft:8, letterSpacing:1 }}>⏳ {trainingOrders.length} TRAINING</span>}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap:4, marginBottom:14 }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            flex: 1, padding: '7px', borderRadius: 20, border: 'none', cursor: 'pointer',
            fontSize: 8, fontWeight: tab === t.id ? 700 : 500, letterSpacing: 1,
            background: tab === t.id ? 'rgba(220,38,38,0.1)' : 'rgba(255,255,255,0.5)',
            color: tab === t.id ? '#dc2626' : 'rgba(26,42,58,0.45)',
            fontFamily: "'Orbitron', system-ui, sans-serif",
            border: `1px solid ${tab === t.id ? 'rgba(220,38,38,0.3)' : 'rgba(0,60,100,0.1)'}`,
          }}>{t.label}{t.id === 'train' && trainingOrders.length > 0 ? ` (${trainingOrders.length})` : ''}</button>
        ))}
      </div>

      <div>
        {/* ACTIVE BATTLES */}
        {tab === 'active' && (
          <div style={{ padding: '12px 16px' }}>
            {!active.length && (
              <div style={{ textAlign: 'center', padding: '30px 20px' }}>
                <div style={{ fontSize: 40, marginBottom: 10 }}>🕊️</div>
                <div style={{ fontSize: 14, color: '#4B5563' }}>No active battles</div>
              </div>
            )}
            {active.map((b: any) => (
              <div key={b.id} style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)', borderRadius: 12, padding: '12px 14px', marginBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>⚔️ vs {b.defender_username}</div>
                    <div style={{ fontSize: 10, color: '#6B7280', marginTop: 2 }}>{b.territory_name} · {b.type_display ?? b.battle_type}</div>
                  </div>
                  <span style={{ fontSize: 10, fontWeight: 700, color: STATUS_COLOR[b.status] ?? '#fff', background: `${STATUS_COLOR[b.status] ?? '#fff'}15`, padding: '3px 8px', borderRadius: 10 }}>
                    {b.status_display ?? b.status}
                  </span>
                </div>
              </div>
            ))}
            {completed.slice(0, 3).map((b: any) => (
              <div key={b.id} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 10, padding: '10px 14px', marginBottom: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontSize: 12, color: '#9CA3AF' }}>vs {b.defender_username} · {b.territory_name}</div>
                  {b.winner && <span style={{ fontSize: 11, fontWeight: 700, color: RESULT_COLOR[b.winner] ?? '#fff' }}>{b.winner === 'attacker' ? '🏆 W' : b.winner === 'defender' ? '❌ L' : '🤝 D'}</span>}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* TRAIN UNITS */}
        {tab === 'train' && (
          <div style={{ padding: '12px 16px' }}>
            <TrainingQueue orders={trainingOrders} onComplete={() => setTrainingOrders([])} />

            <div style={{ fontSize: 11, color: '#6B7280', marginBottom: 12, lineHeight: 1.6 }}>
              Select units to train. Each unit has a training timer before deployment.
            </div>

            {UNITS.map(u => {
              const q = qty[u.key] ?? 0
              const isSelected = selected === u.key
              return (
                <div key={u.key} onClick={() => setSel(isSelected ? null : u.key)}
                  style={{ background: isSelected ? `rgba(239,68,68,0.08)` : 'rgba(255,255,255,0.02)', border: `1px solid ${isSelected ? 'rgba(239,68,68,0.3)' : 'rgba(255,255,255,0.06)'}`, borderRadius: 12, padding: '12px 14px', marginBottom: 8, cursor: 'pointer', transition: 'all 0.15s' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ fontSize: 26, width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.05)', borderRadius: 10, flexShrink: 0 }}>{u.emoji}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>{u.name}</span>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: 12, color: '#FFB800', fontFamily: 'monospace' }}>{u.cost} 🪙</div>
                          <div style={{ fontSize: 9, color: '#4B5563' }}>⏱ {u.trainMins}m</div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                        {[['ATK', u.atk, '#EF4444'], ['DEF', u.def, '#3B82F6'], ['SPD', u.speed, '#10B981']].map(([l, v, c]) => (
                          <span key={String(l)} style={{ fontSize: 9, color: c as string, background: `${c}15`, padding: '2px 6px', borderRadius: 4 }}>{l} {v}</span>
                        ))}
                      </div>
                    </div>
                  </div>

                  <AnimatePresence>
                    {isSelected && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} style={{ overflow: 'hidden' }}>
                        <div style={{ fontSize: 11, color: '#6B7280', marginTop: 8, marginBottom: 10 }}>{u.desc}</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <button onClick={e => { e.stopPropagation(); setQty(p => ({ ...p, [u.key]: Math.max(0, (p[u.key] ?? 0) - 1) })) }}
                            style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(255,255,255,0.08)', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 16 }}>−</button>
                          <input type="number" value={q} min={0} onClick={e => e.stopPropagation()}
                            onChange={e => setQty(p => ({ ...p, [u.key]: Math.max(0, parseInt(e.target.value) || 0) }))}
                            style={{ flex: 1, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '8px', color: '#fff', fontSize: 16, fontFamily: 'monospace', textAlign: 'center', outline: 'none' }} />
                          <button onClick={e => { e.stopPropagation(); setQty(p => ({ ...p, [u.key]: (p[u.key] ?? 0) + 1 })) }}
                            style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', color: '#EF4444', cursor: 'pointer', fontSize: 16 }}>+</button>
                        </div>
                        <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                          {[5, 10, 25, 50].map(n => (
                            <button key={n} onClick={e => { e.stopPropagation(); setQty(p => ({ ...p, [u.key]: n })) }}
                              style={{ flex: 1, padding: '5px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 6, color: '#9CA3AF', cursor: 'pointer', fontSize: 11 }}>×{n}</button>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )
            })}

            {totalCost > 0 && (
              <div style={{ position: 'sticky', bottom: 0, background: '#0A0A14', paddingTop: 12, paddingBottom: 4, borderTop: '1px solid rgba(255,255,255,0.07)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontSize: 12, color: '#9CA3AF' }}>
                    {Object.entries(qty).filter(([,n])=>n>0).map(([k,n]) => `${n}× ${UNITS.find(u=>u.key===k)?.name}`).join(', ')}
                  </span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: tdc >= totalCost ? '#00FF87' : '#EF4444', fontFamily: 'monospace' }}>{totalCost} 🪙</span>
                </div>
                <button onClick={() => trainMut.mutate()} disabled={tdc < totalCost || trainMut.isPending}
                  style={{ width: '100%', padding: '13px', background: tdc >= totalCost ? 'rgba(0,255,135,0.15)' : 'rgba(255,255,255,0.04)', border: `1px solid ${tdc >= totalCost ? 'rgba(0,255,135,0.4)' : 'rgba(255,255,255,0.08)'}`, borderRadius: 12, color: tdc >= totalCost ? '#00FF87' : '#4B5563', fontSize: 14, fontWeight: 800, cursor: tdc >= totalCost ? 'pointer' : 'not-allowed' }}>
                  {trainMut.isPending ? '⏳ Sending to barracks…' : `🪖 Train Units (−${totalCost} HEX Coin)`}
                </button>
              </div>
            )}
          </div>
        )}

        {/* HISTORY */}
        {tab === 'history' && (
          <div style={{ padding: '12px 16px' }}>
            {!history.length && <div style={{ textAlign: 'center', color: '#4B5563', padding: '30px 0', fontSize: 13 }}>No battles yet</div>}
            {history.map((b: any) => (
              <div key={b.id} style={{ padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontSize: 13, color: '#fff', fontWeight: 500 }}>vs {b.defender_username}</div>
                    <div style={{ fontSize: 10, color: '#4B5563', marginTop: 2 }}>{b.territory_name} · {b.started_at ? new Date(b.started_at).toLocaleDateString() : ''}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    {b.winner ? <span style={{ fontSize: 12, fontWeight: 700, color: RESULT_COLOR[b.winner] ?? '#fff' }}>{b.winner === 'attacker' ? '🏆 Win' : b.winner === 'defender' ? '❌ Loss' : '🤝 Draw'}</span>
                      : <span style={{ fontSize: 11, color: STATUS_COLOR[b.status] ?? '#fff' }}>{b.status}</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </GlassPanel>
  )
}
