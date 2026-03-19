/**
 * CombatPanel — Military command center.
 * - Active battles avec timer live et probabilité de victoire
 * - Entraînement des troupes avec stats détaillées et coût TDC
 * - Historique des batailles avec résultats
 * - Quick attack depuis la liste des zones ennemies proches
 */
import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { api } from '../../services/api'
import { usePlayer } from '../../store'
import toast from 'react-hot-toast'

// ─── Unit definitions ──────────────────────────────────────────────────────
const UNITS = [
  {
    key: 'infantry',   emoji: '⚔️',  name: 'Infantry',
    cost: 50,   atk: 10, def: 8,  speed: 'Fast',
    desc: 'Basic ground troops. Fast to deploy, low cost. Effective en masse.',
    color: '#10B981',
  },
  {
    key: 'cavalry',    emoji: '🐎',  name: 'Cavalry',
    cost: 120,  atk: 25, def: 12, speed: 'Very Fast',
    desc: 'Mobile strike force. Bonus vs infantry. Weak against artillery.',
    color: '#F59E0B',
  },
  {
    key: 'artillery',  emoji: '💣',  name: 'Artillery',
    cost: 200,  atk: 45, def: 5,  speed: 'Slow',
    desc: 'Siege weapon. Destroys fortifications. Requires infantry escort.',
    color: '#EF4444',
  },
  {
    key: 'naval',      emoji: '⚓',  name: 'Naval',
    cost: 300,  atk: 35, def: 30, speed: 'Medium',
    desc: 'Controls coastal & river territories. Amphibious landing bonus.',
    color: '#6382FF',
  },
]

// ─── Helpers ───────────────────────────────────────────────────────────────
function StatBadge({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div style={{ textAlign: 'center', background: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: '6px 8px', minWidth: 48 }}>
      <div style={{ fontSize: 9, color: '#4B5563', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 700, color, marginTop: 2 }}>{value}</div>
    </div>
  )
}

function BattleTimer({ seconds }: { seconds: number | null }) {
  const [left, setLeft] = useState(seconds ?? 0)
  useEffect(() => {
    if (!seconds) return
    setLeft(seconds)
    const id = setInterval(() => setLeft(s => Math.max(0, s - 1)), 1000)
    return () => clearInterval(id)
  }, [seconds])
  if (!seconds) return null
  const m = Math.floor(left / 60), s = left % 60
  return <span style={{ fontFamily: 'monospace', color: left < 60 ? '#EF4444' : '#FFB800', fontWeight: 700 }}>{m}:{String(s).padStart(2,'0')}</span>
}

// ─── Tabs ──────────────────────────────────────────────────────────────────
const TABS = [
  { id: 'active',   label: '⚔️ Active' },
  { id: 'train',    label: '🪖 Train' },
  { id: 'history',  label: '📋 History' },
]

export function CombatPanel({ onClose }: { onClose: () => void }) {
  const [tab, setTab]     = useState('active')
  const [qty, setQty]     = useState<Record<string, number>>({})
  const [selected, setSel] = useState<string | null>(null)
  const player = usePlayer()
  const qc     = useQueryClient()

  const tdc = parseFloat(String(player?.tdc_in_game ?? 0))

  // Active battles
  const { data: battlesData, isLoading: battlesLoading } = useQuery({
    queryKey: ['battles-active'],
    queryFn: () => api.get('/battles/?ordering=-started_at&limit=10').then(r => r.data),
    refetchInterval: 5000,
  })

  // Battle history
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
      for (const [key, n] of entries) {
        await api.post('/shop/purchase/', { item_code: `unit_${key}`, quantity: n })
      }
    },
    onSuccess: () => {
      toast.success(`Training ${totalCost} TDC worth of units!`)
      setQty({})
      qc.invalidateQueries({ queryKey: ['player'] })
    },
    onError: (e: any) => toast.error(e.response?.data?.error || e.message || 'Training failed'),
  })

  const battles   = battlesData?.results ?? []
  const history   = historyData?.results ?? []
  const active    = battles.filter((b: any) => b.status !== 'completed' && b.status !== 'cancelled')
  const completed = (tab === 'history' ? history : battles).filter((b: any) => b.status === 'completed' || b.status === 'cancelled')

  const STATUS_COLOR: Record<string, string> = {
    preparing: '#F59E0B', active: '#EF4444', resolving: '#8B5CF6',
    completed: '#10B981', cancelled: '#4B5563',
  }
  const RESULT_COLOR: Record<string, string> = {
    attacker: '#00FF87', defender: '#EF4444', draw: '#F59E0B',
  }

  return (
    <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: 390, zIndex: 1000,
        display: 'flex', flexDirection: 'column', background: '#0A0A14',
        borderLeft: '1px solid rgba(255,255,255,0.07)' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.07)', flexShrink: 0, background: 'linear-gradient(180deg, rgba(239,68,68,0.06) 0%, transparent 100%)' }}>
        <span style={{ fontSize: 20, marginRight: 10 }}>⚔️</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#fff' }}>Military Command</div>
          <div style={{ fontSize: 11, color: '#4B5563', marginTop: 1 }}>
            Balance: <span style={{ color: '#FFB800', fontFamily: 'monospace' }}>{tdc.toFixed(0)} 🪙</span>
            {active.length > 0 && <span style={{ color: '#EF4444', marginLeft: 10 }}>⚔️ {active.length} active</span>}
          </div>
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#4B5563', cursor: 'pointer', fontSize: 22 }}>×</button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.07)', flexShrink: 0 }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            flex: 1, padding: '10px', border: 'none', background: 'transparent', cursor: 'pointer',
            fontSize: 12, fontWeight: tab === t.id ? 700 : 400,
            borderBottom: tab === t.id ? '2px solid #EF4444' : '2px solid transparent',
            color: tab === t.id ? '#EF4444' : '#6B7280',
          }}>{t.label}</button>
        ))}
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>

        {/* ── ACTIVE BATTLES ── */}
        {tab === 'active' && (
          <div style={{ padding: '12px 16px' }}>
            {battlesLoading && <div style={{ textAlign: 'center', color: '#4B5563', padding: 30 }}>Loading battles…</div>}

            {!battlesLoading && active.length === 0 && (
              <div style={{ textAlign: 'center', padding: '30px 20px' }}>
                <div style={{ fontSize: 40, marginBottom: 10 }}>🕊️</div>
                <div style={{ fontSize: 14, color: '#4B5563' }}>No active battles</div>
                <div style={{ fontSize: 12, color: '#374151', marginTop: 4 }}>Attack enemy territories from the map</div>
              </div>
            )}

            {active.map((b: any) => (
              <div key={b.id} style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)', borderRadius: 12, padding: '12px 14px', marginBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>
                      ⚔️ {b.attacker_username} → {b.territory_name || 'Zone'}
                    </div>
                    <div style={{ fontSize: 10, color: '#6B7280', marginTop: 2 }}>
                      vs {b.defender_username} · {b.type_display ?? b.battle_type}
                    </div>
                  </div>
                  <span style={{ fontSize: 10, fontWeight: 700, color: STATUS_COLOR[b.status] ?? '#fff', background: `${STATUS_COLOR[b.status] ?? '#fff'}15`, padding: '3px 8px', borderRadius: 10 }}>
                    {b.status_display ?? b.status}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ fontSize: 12, color: '#9CA3AF' }}>
                    ⏱ <BattleTimer seconds={b.time_remaining_s} />
                  </div>
                  {b.attacker_win_probability != null && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{ width: 80, height: 4, background: 'rgba(255,255,255,0.1)', borderRadius: 2, overflow: 'hidden' }}>
                        <div style={{ width: `${(b.attacker_win_probability * 100).toFixed(0)}%`, height: '100%', background: b.attacker_win_probability >= 0.5 ? '#00FF87' : '#EF4444', transition: 'width 1s' }} />
                      </div>
                      <span style={{ fontSize: 11, color: b.attacker_win_probability >= 0.5 ? '#00FF87' : '#EF4444', fontFamily: 'monospace', fontWeight: 700 }}>
                        {(b.attacker_win_probability * 100).toFixed(0)}%
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {/* Recent completed */}
            {completed.slice(0, 3).map((b: any) => (
              <div key={b.id} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 10, padding: '10px 14px', marginBottom: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontSize: 12, color: '#9CA3AF' }}>
                    ⚔️ {b.attacker_username} → {b.territory_name}
                  </div>
                  {b.winner && (
                    <span style={{ fontSize: 11, fontWeight: 700, color: RESULT_COLOR[b.winner] ?? '#fff' }}>
                      {b.winner === 'attacker' ? '🏆 Won' : b.winner === 'defender' ? '❌ Lost' : '🤝 Draw'}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── TRAIN UNITS ── */}
        {tab === 'train' && (
          <div style={{ padding: '12px 16px' }}>
            <div style={{ fontSize: 11, color: '#6B7280', marginBottom: 14, lineHeight: 1.6 }}>
              Units are stationed on your territories. More zones = higher deployment capacity.
              Each unit type has different ATK/DEF ratios for tactical variety.
            </div>

            {UNITS.map(u => {
              const q = qty[u.key] ?? 0
              const isSelected = selected === u.key
              const unitCost = u.cost * q
              return (
                <div key={u.key} onClick={() => setSel(isSelected ? null : u.key)}
                  style={{ background: isSelected ? `${u.color}10` : 'rgba(255,255,255,0.02)', border: `1px solid ${isSelected ? u.color + '40' : 'rgba(255,255,255,0.06)'}`, borderRadius: 12, padding: '12px 14px', marginBottom: 10, cursor: 'pointer', transition: 'all 0.15s' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ fontSize: 28, width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', background: `${u.color}15`, borderRadius: 10, flexShrink: 0 }}>{u.emoji}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>{u.name}</span>
                        <span style={{ fontSize: 12, color: '#FFB800', fontFamily: 'monospace', fontWeight: 700 }}>{u.cost} 🪙</span>
                      </div>
                      <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                        <StatBadge label="ATK" value={u.atk} color="#EF4444" />
                        <StatBadge label="DEF" value={u.def} color="#3B82F6" />
                        <StatBadge label="SPD" value={u.speed} color="#10B981" />
                      </div>
                    </div>
                  </div>

                  <AnimatePresence>
                    {isSelected && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                        style={{ overflow: 'hidden' }}>
                        <div style={{ fontSize: 11, color: '#6B7280', marginTop: 10, marginBottom: 10, lineHeight: 1.5 }}>{u.desc}</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <button onClick={e => { e.stopPropagation(); setQty(prev => ({ ...prev, [u.key]: Math.max(0, (prev[u.key] ?? 0) - 1) })) }}
                            style={{ width: 36, height: 36, borderRadius: 8, background: 'rgba(255,255,255,0.08)', border: 'none', color: '#fff', fontSize: 18, cursor: 'pointer' }}>−</button>
                          <input type="number" value={q} min={0}
                            onClick={e => e.stopPropagation()}
                            onChange={e => setQty(prev => ({ ...prev, [u.key]: Math.max(0, parseInt(e.target.value) || 0) }))}
                            style={{ flex: 1, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '8px', color: '#fff', fontSize: 16, fontFamily: 'monospace', textAlign: 'center', outline: 'none' }} />
                          <button onClick={e => { e.stopPropagation(); setQty(prev => ({ ...prev, [u.key]: (prev[u.key] ?? 0) + 1 })) }}
                            style={{ width: 36, height: 36, borderRadius: 8, background: `${u.color}20`, border: `1px solid ${u.color}40`, color: u.color, fontSize: 18, cursor: 'pointer' }}>+</button>
                          {q > 0 && (
                            <span style={{ fontSize: 11, color: '#FFB800', fontFamily: 'monospace', minWidth: 60, textAlign: 'right' }}>
                              {unitCost} 🪙
                            </span>
                          )}
                        </div>
                        {/* Quick qty presets */}
                        <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                          {[5, 10, 25, 50].map(n => (
                            <button key={n} onClick={e => { e.stopPropagation(); setQty(prev => ({ ...prev, [u.key]: n })) }}
                              style={{ flex: 1, padding: '5px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 6, color: '#9CA3AF', cursor: 'pointer', fontSize: 11 }}>
                              ×{n}
                            </button>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )
            })}

            {/* Train button sticky footer */}
            {totalCost > 0 && (
              <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
                style={{ position: 'sticky', bottom: 0, background: '#0A0A14', paddingTop: 12, paddingBottom: 4, borderTop: '1px solid rgba(255,255,255,0.07)', marginTop: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                  <span style={{ fontSize: 13, color: '#9CA3AF' }}>
                    {Object.entries(qty).filter(([,n])=>n>0).map(([k,n]) => {
                      const u = UNITS.find(u=>u.key===k)
                      return `${n}× ${u?.name}`
                    }).join(', ')}
                  </span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: tdc >= totalCost ? '#00FF87' : '#EF4444', fontFamily: 'monospace' }}>
                    {totalCost} 🪙
                  </span>
                </div>
                {tdc < totalCost && (
                  <div style={{ fontSize: 11, color: '#EF4444', marginBottom: 8 }}>
                    ⚠️ Need {(totalCost - tdc).toFixed(0)} more TDC
                  </div>
                )}
                <button onClick={() => trainMut.mutate()} disabled={tdc < totalCost || trainMut.isPending}
                  style={{ width: '100%', padding: '13px', background: tdc >= totalCost ? 'rgba(0,255,135,0.15)' : 'rgba(255,255,255,0.04)', border: `1px solid ${tdc >= totalCost ? 'rgba(0,255,135,0.4)' : 'rgba(255,255,255,0.08)'}`, borderRadius: 12, color: tdc >= totalCost ? '#00FF87' : '#4B5563', fontSize: 14, fontWeight: 800, cursor: tdc >= totalCost ? 'pointer' : 'not-allowed' }}>
                  {trainMut.isPending ? '⏳ Training…' : `🪖 Train Units (−${totalCost} TDC)`}
                </button>
              </motion.div>
            )}
          </div>
        )}

        {/* ── HISTORY ── */}
        {tab === 'history' && (
          <div style={{ padding: '12px 16px' }}>
            {!history.length && (
              <div style={{ textAlign: 'center', color: '#4B5563', padding: '30px 0', fontSize: 13 }}>No battles yet</div>
            )}
            {history.map((b: any) => (
              <div key={b.id} style={{ padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontSize: 13, color: '#fff', fontWeight: 500 }}>
                      {b.attacker_username} vs {b.defender_username}
                    </div>
                    <div style={{ fontSize: 10, color: '#4B5563', marginTop: 2 }}>
                      {b.territory_name} · {b.type_display ?? b.battle_type}
                    </div>
                    <div style={{ fontSize: 10, color: '#374151', marginTop: 1 }}>
                      {b.started_at ? new Date(b.started_at).toLocaleDateString() : ''}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    {b.winner ? (
                      <span style={{ fontSize: 12, fontWeight: 700, color: RESULT_COLOR[b.winner] ?? '#fff' }}>
                        {b.winner === 'attacker' ? '🏆 W' : b.winner === 'defender' ? '❌ L' : '🤝 D'}
                      </span>
                    ) : (
                      <span style={{ fontSize: 11, color: STATUS_COLOR[b.status] ?? '#fff' }}>{b.status}</span>
                    )}
                    {b.resources_looted && Object.keys(b.resources_looted).length > 0 && (
                      <div style={{ fontSize: 10, color: '#10B981', marginTop: 2 }}>
                        +{Object.values(b.resources_looted).reduce((a: any, b: any) => a + b, 0)} resources
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  )
}
