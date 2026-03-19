/**
 * AttackPanel — RISK-style dice attack interface.
 * Shows dice rolls, army counts, win probability, territory preview.
 * Appears when player clicks an enemy territory.
 */
import { useState, useCallback } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { api } from '../../services/api'
import { usePlayer } from '../../store'
import toast from 'react-hot-toast'

const UNIT_TYPES = [
  { key: 'infantry',  emoji: '⚔️', atk: 10, cost: 1 },
  { key: 'cavalry',   emoji: '🐎', atk: 20, cost: 2 },
  { key: 'artillery', emoji: '💣', atk: 35, cost: 4 },
]

// Dice animation
function Dice({ value, rolling }: { value: number; rolling: boolean }) {
  const faces = ['', '⚀', '⚁', '⚂', '⚃', '⚄', '⚅']
  return (
    <motion.div
      animate={rolling ? { rotate: [0, 180, 360], scale: [1, 1.2, 1] } : {}}
      transition={{ duration: 0.4, repeat: rolling ? Infinity : 0 }}
      style={{ fontSize: 36, lineHeight: 1, userSelect: 'none' }}
    >
      {faces[value] || '🎲'}
    </motion.div>
  )
}

interface AttackPanelProps {
  target: { h3_index: string; place_name?: string; owner_username?: string; defense_points?: number }
  onClose: () => void
}

export function AttackPanel({ target, onClose }: AttackPanelProps) {
  const player = usePlayer()
  const qc = useQueryClient()

  const [units, setUnits] = useState<Record<string, number>>({ infantry: 3 })
  const [phase, setPhase] = useState<'setup' | 'rolling' | 'result'>('setup')
  const [dice, setDice] = useState<{ atk: number[]; def: number[] }>({ atk: [], def: [] })
  const [rollResult, setRollResult] = useState<'win' | 'loss' | 'draw' | null>(null)

  const totalAtk = Object.entries(units).reduce((sum, [k, n]) => {
    const u = UNIT_TYPES.find(u => u.key === k)!
    return sum + n * u.atk
  }, 0)

  const defPoints = target.defense_points ?? 100
  const winProb = Math.min(95, Math.max(5, Math.round((totalAtk / (totalAtk + defPoints)) * 100)))

  const rollDice = useCallback(() => {
    setPhase('rolling')
    // Animate dice for 1.5s
    setTimeout(() => {
      const atkDice = Array.from({ length: Math.min(3, Object.values(units).reduce((a,b) => a+b, 0)) }, () => Math.ceil(Math.random() * 6))
      const defDice = Array.from({ length: 2 }, () => Math.ceil(Math.random() * 6))
      const atkMax = Math.max(...atkDice)
      const defMax = Math.max(...defDice)
      setDice({ atk: atkDice.sort((a,b) => b-a), def: defDice.sort((a,b) => b-a) })
      const result = atkMax > defMax ? 'win' : atkMax === defMax ? 'draw' : 'loss'
      setRollResult(result)
      setPhase('result')
    }, 1500)
  }, [units])

  const attackMut = useMutation({
    mutationFn: () => api.post('/territories/claim/', {
      h3_index: target.h3_index,
      method: 'attack',
      units,
    }),
    onSuccess: () => {
      toast.success(`⚔️ ${target.place_name || 'Territory'} captured!`)
      qc.invalidateQueries({ queryKey: ['player'] })
      onClose()
    },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Attack failed'),
  })

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{ position: 'fixed', inset: 0, zIndex: 3000, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        style={{ width: '100%', maxWidth: 480, background: '#0A0A14', borderRadius: '20px 20px 0 0', border: '1px solid rgba(239,68,68,0.2)', padding: '20px 20px 36px' }}
      >
        <div style={{ width: 40, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.1)', margin: '0 auto 20px' }} />

        {/* Target info */}
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <div style={{ fontSize: 13, color: '#EF4444', fontFamily: 'monospace', letterSpacing: '0.1em', marginBottom: 4 }}>⚔️ ATTACK</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#fff' }}>{target.place_name || target.h3_index.slice(0,10)}</div>
          <div style={{ fontSize: 12, color: '#9CA3AF' }}>Defended by {target.owner_username || 'unknown'} · {defPoints.toFixed(0)} defense</div>
        </div>

        <AnimatePresence mode="wait">
          {/* SETUP PHASE */}
          {phase === 'setup' && (
            <motion.div key="setup" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              {/* Unit selector */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 11, color: '#6B7280', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>Choose your forces</div>
                {UNIT_TYPES.map(u => (
                  <div key={u.key} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <span style={{ fontSize: 20, width: 28 }}>{u.emoji}</span>
                    <div style={{ flex: 1 }}>
                      <span style={{ fontSize: 13, color: '#fff' }}>{u.key.charAt(0).toUpperCase() + u.key.slice(1)}</span>
                      <span style={{ fontSize: 10, color: '#6B7280', marginLeft: 6 }}>ATK {u.atk}</span>
                    </div>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <button onClick={() => setUnits(p => ({ ...p, [u.key]: Math.max(0, (p[u.key]??0)-1) }))}
                        style={{ width: 26, height: 26, borderRadius: 6, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', cursor: 'pointer', fontSize: 14 }}>−</button>
                      <span style={{ fontSize: 14, color: '#fff', minWidth: 20, textAlign: 'center' }}>{units[u.key]??0}</span>
                      <button onClick={() => setUnits(p => ({ ...p, [u.key]: (p[u.key]??0)+1 }))}
                        style={{ width: 26, height: 26, borderRadius: 6, background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', color: '#EF4444', cursor: 'pointer', fontSize: 14 }}>+</button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Win probability bar */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 11, color: '#6B7280' }}>Win probability</span>
                  <span style={{ fontSize: 13, color: winProb > 60 ? '#10B981' : winProb > 40 ? '#F59E0B' : '#EF4444', fontWeight: 600 }}>{winProb}%</span>
                </div>
                <div style={{ height: 6, background: 'rgba(255,255,255,0.06)', borderRadius: 3 }}>
                  <motion.div animate={{ width: `${winProb}%` }} style={{ height: '100%', borderRadius: 3, background: winProb > 60 ? '#10B981' : winProb > 40 ? '#F59E0B' : '#EF4444' }} />
                </div>
              </div>

              {/* Attack button */}
              <button onClick={rollDice}
                disabled={Object.values(units).every(n => n === 0)}
                style={{ width: '100%', padding: '14px', background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.4)', borderRadius: 12, color: '#EF4444', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>
                ⚔️ Roll the Dice! (ATK: {totalAtk})
              </button>
            </motion.div>
          )}

          {/* ROLLING PHASE */}
          {phase === 'rolling' && (
            <motion.div key="rolling" initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ textAlign: 'center', padding: '20px 0' }}>
              <div style={{ fontSize: 13, color: '#9CA3AF', marginBottom: 20 }}>Rolling dice…</div>
              <div style={{ display: 'flex', justifyContent: 'center', gap: 16 }}>
                {[1,2,3].map(i => <Dice key={i} value={Math.ceil(Math.random()*6)} rolling={true} />)}
              </div>
            </motion.div>
          )}

          {/* RESULT PHASE */}
          {phase === 'result' && (
            <motion.div key="result" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} style={{ textAlign: 'center' }}>
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 11, color: '#6B7280', marginBottom: 8 }}>ATTACKER</div>
                <div style={{ display: 'flex', justifyContent: 'center', gap: 12, marginBottom: 12 }}>
                  {dice.atk.map((d, i) => <Dice key={i} value={d} rolling={false} />)}
                </div>
                <div style={{ fontSize: 11, color: '#6B7280', marginBottom: 8 }}>DEFENDER</div>
                <div style={{ display: 'flex', justifyContent: 'center', gap: 12 }}>
                  {dice.def.map((d, i) => <Dice key={i} value={d} rolling={false} />)}
                </div>
              </div>

              {rollResult === 'win' && (
                <div>
                  <div style={{ fontSize: 20, color: '#00FF87', fontWeight: 700, marginBottom: 12 }}>🎉 Victory! You win the roll!</div>
                  <button onClick={() => attackMut.mutate()} disabled={attackMut.isPending}
                    style={{ width: '100%', padding: '14px', background: '#00FF87', border: 'none', borderRadius: 12, color: '#000', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>
                    {attackMut.isPending ? 'Capturing…' : '⚔️ Claim Territory!'}
                  </button>
                </div>
              )}
              {rollResult === 'loss' && (
                <div>
                  <div style={{ fontSize: 18, color: '#EF4444', fontWeight: 700, marginBottom: 12 }}>💀 Defeated! Defender holds.</div>
                  <button onClick={() => { setPhase('setup'); setRollResult(null) }}
                    style={{ width: '100%', padding: '14px', background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 12, color: '#EF4444', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>
                    Try Again
                  </button>
                </div>
              )}
              {rollResult === 'draw' && (
                <div>
                  <div style={{ fontSize: 18, color: '#F59E0B', fontWeight: 700, marginBottom: 12 }}>⚖️ Draw! Both sides take losses.</div>
                  <button onClick={() => { setPhase('setup'); setRollResult(null) }}
                    style={{ width: '100%', padding: '14px', background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 12, color: '#F59E0B', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>
                    Roll Again
                  </button>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        <button onClick={onClose} style={{ width: '100%', marginTop: 10, padding: 8, background: 'transparent', border: 'none', color: '#4B5563', cursor: 'pointer', fontSize: 12 }}>
          Retreat
        </button>
      </motion.div>
    </motion.div>
  )
}
