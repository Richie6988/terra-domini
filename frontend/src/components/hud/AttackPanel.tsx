/**
 * AttackPanel — Combat RISK avancé.
 * Simulation Monte Carlo des probabilités.
 * Sélection tactique : type d'attaque + unités.
 * Dés animés avec résolution réaliste.
 */
import { useState, useCallback, useEffect } from 'react'
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query'
import { StaminaBar } from './StaminaBar'
import { motion, AnimatePresence } from 'framer-motion'
import { api } from '../../services/api'
import { usePlayer } from '../../store'
import { GlassPanel } from '../shared/GlassPanel'
import toast from 'react-hot-toast'
import type { TerritoryLight } from '../../types'
import { EmojiIcon } from '../shared/emojiIcons'

// ─── Monte Carlo combat simulation ────────────────────────────────────────
function rollDie(): number { return Math.floor(Math.random() * 6) + 1 }

function simulateBattle(atkUnits: number, defUnits: number, nSims = 500): number {
  let atkWins = 0
  for (let i = 0; i < nSims; i++) {
    let atk = atkUnits, def = defUnits
    while (atk > 0 && def > 0) {
      const atkDice = Array.from({ length: Math.min(3, atk) }, rollDie).sort((a,b) => b-a)
      const defDice = Array.from({ length: Math.min(2, def) }, rollDie).sort((a,b) => b-a)
      for (let j = 0; j < Math.min(atkDice.length, defDice.length); j++) {
        if (atkDice[j] > defDice[j]) def--; else atk--
      }
    }
    if (atk > 0) atkWins++
  }
  return atkWins / nSims
}

// ─── Die component ─────────────────────────────────────────────────────────
function Die({ value, color, delay = 0 }: { value: number; color: string; delay?: number }) {
  const DOTS: Record<number, [number,number][]> = {
    1: [[50,50]],
    2: [[25,25],[75,75]],
    3: [[25,25],[50,50],[75,75]],
    4: [[25,25],[75,25],[25,75],[75,75]],
    5: [[25,25],[75,25],[50,50],[25,75],[75,75]],
    6: [[25,25],[75,25],[25,50],[75,50],[25,75],[75,75]],
  }
  return (
    <motion.div initial={{ rotateX: 180, opacity: 0 }} animate={{ rotateX: 0, opacity: 1 }}
      transition={{ delay, type: 'spring', stiffness: 200 }}
      style={{ width: 44, height: 44, background: color === 'red' ? 'rgba(239,68,68,0.2)' : 'rgba(59,130,246,0.2)', border: `2px solid ${color === 'red' ? '#EF4444' : '#3B82F6'}`, borderRadius: 8, position: 'relative', boxShadow: `0 0 12px ${color === 'red' ? '#EF444440' : '#3B82F640'}` }}>
      {(DOTS[value] || []).map(([x,y], i) => (
        <div key={i} style={{ position: 'absolute', width: 8, height: 8, borderRadius: '50%', background: color === 'red' ? '#EF4444' : '#3B82F6', left: `${x}%`, top: `${y}%`, transform: 'translate(-50%,-50%)' }} />
      ))}
    </motion.div>
  )
}

// ─── Attack type definitions ───────────────────────────────────────────────
const ATTACK_TYPES = [
  { id: 'conquest',  label: 'Conquest',  iconId: 'swords',  color: '#EF4444', desc: 'Full invasion — captures territory on win. Slow but decisive.',   timer: '4h',  riskMult: 1.0 },
  { id: 'raid',      label: 'Raid',      emoji: 'wind',  color: '#F59E0B', desc: 'Steals resources without capturing. Fast, lower losses.',          timer: '1h',  riskMult: 0.7 },
  { id: 'surprise',  label: 'Surprise',  emoji: 'moon',  color: '#8B5CF6', desc: 'Night strike — ignores some defenses. Higher risk, higher reward.', timer: '30m', riskMult: 1.3 },
  { id: 'siege',     label: 'Siege',     emoji: 'castle',  color: '#6382FF', desc: 'Reduces fortifications without capturing. Weakens for next attack.', timer: '8h', riskMult: 0.5 },
]

interface Props {
  target: TerritoryLight
  onClose: () => void
}

export function AttackPanel({ target, onClose }: Props) {
  const player   = usePlayer()
  const qc       = useQueryClient()

  const [atkType, setAtkType]   = useState('conquest')
  const [units, setUnits]       = useState({ infantry: 50, cavalry: 0, artillery: 0, naval: 0 })
  const [phase, setPhase]       = useState<'setup' | 'rolling' | 'result'>('setup')
  const [atkDice, setAtkDice]   = useState<number[]>([])
  const [defDice, setDefDice]   = useState<number[]>([])
  const [outcome, setOutcome]   = useState<'win' | 'loss' | 'draw' | null>(null)
  const [winProb, setWinProb]   = useState(0.5)

  const typeConf  = ATTACK_TYPES.find(t => t.id === atkType)!
  const totalUnits = Object.values(units).reduce((a,b) => a+b, 0)

  // Recalculate win probability when units change
  useEffect(() => {
    const defUnits = Math.max(10, (target.defense_tier ?? 0) * 25 + 20)
    const prob = simulateBattle(totalUnits, defUnits) * typeConf.riskMult
    setWinProb(Math.min(0.95, Math.max(0.05, prob)))
  }, [units, atkType, target.defense_tier])

  const attackMut = useMutation({
    mutationFn: () => api.post('/battles/attack/', {
      target_h3: target.h3_index,
      attack_type: atkType,
      units,
    }),
    onSuccess: (res) => {
      // Animate dice roll
      setPhase('rolling')
      const aD = Array.from({ length: 3 }, rollDie)
      const dD = Array.from({ length: 2 }, rollDie)
      setAtkDice(aD); setDefDice(dD)
      setTimeout(() => {
        const result = res.data?.result ?? (winProb >= 0.5 ? 'attacker' : 'defender')
        setOutcome(result === 'attacker' ? 'win' : result === 'draw' ? 'draw' : 'loss')
        setPhase('result')
        qc.invalidateQueries({ queryKey: ['battles-active'] })
        qc.invalidateQueries({ queryKey: ['territories'] })
      }, 2000)
    },
    onError: (e: any) => {
      const data = e.response?.data
      if (e.response?.status === 429 && data?.next_slot_label) {
        toast.error(`<EmojiIcon emoji="" /> No slots — next in ${data.next_slot_label}`, { duration: 5000 })
      } else {
        toast.error(data?.error || 'Attack failed')
      }
    },
  })

  const probColor = winProb >= 0.65 ? '#00884a' : winProb >= 0.4 ? '#F59E0B' : '#EF4444'

  return (
    <GlassPanel title="ATTACK" onClose={onClose} accent="#dc2626">
      {/* Target info */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 11, color: '#e2e8f0', fontWeight: 700, letterSpacing: 1 }}>{target.place_name || 'ENEMY ZONE'}</div>
        <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>
          OWNED BY: <span style={{ color: '#e2e8f0' }}>{target.owner_username ?? 'Unknown'}</span>
          {target.defense_tier > 0 && <span style={{ marginLeft: 8 }}><EmojiIcon emoji="" /> TIER {target.defense_tier}</span>}
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
        <AnimatePresence mode="wait">

          {/* SETUP */}
          {phase === 'setup' && (
            <motion.div key="setup" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>

              {/* Attack type */}
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>Attack Type</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 20 }}>
                {ATTACK_TYPES.map(t => (
                  <button key={t.id} onClick={() => setAtkType(t.id)}
                    style={{ padding: '10px', borderRadius: 10, border: `1px solid ${atkType === t.id ? t.color : 'rgba(255,255,255,0.08)'}`, background: atkType === t.id ? `${t.color}12` : 'transparent', cursor: 'pointer', textAlign: 'left' }}>
                    <div style={{ fontSize: 18, marginBottom: 4 }}>{t.emoji}</div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: atkType === t.id ? t.color : '#E5E7EB' }}>{t.label}</div>
                    <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', marginTop: 2, lineHeight: 1.4 }}>{t.desc}</div>
                    <div style={{ fontSize: 9, color: t.color, marginTop: 4 }}>⏱ {t.timer}</div>
                  </button>
                ))}
              </div>

              {/* Units */}
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>Deploy Forces</div>
              {[
                { key: 'infantry', emoji: 'swords', name: 'Infantry', max: 999 },
                { key: 'cavalry',  emoji: 'horse', name: 'Cavalry',  max: 999 },
                { key: 'artillery',emoji: 'bomb', name: 'Artillery',max: 999 },
              ].map(u => (
                <div key={u.key} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, background: 'rgba(255,255,255,0.02)', borderRadius: 10, padding: '8px 12px' }}>
                  <span style={{ fontSize: 20, width: 28 }}>{u.emoji}</span>
                  <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.04)', flex: 1 }}>{u.name}</span>
                  <button onClick={() => setUnits(p => ({ ...p, [u.key]: Math.max(0, (p[u.key as keyof typeof p] ?? 0) - 10) }))}
                    style={{ width: 28, height: 28, borderRadius: 6, background: 'rgba(255,255,255,0.08)', border: 'none', color: '#e2e8f0', cursor: 'pointer' }}>−</button>
                  <span style={{ minWidth: 36, textAlign: 'center', fontFamily: 'monospace', color: '#e2e8f0', fontSize: 14, fontWeight: 600 }}>
                    {units[u.key as keyof typeof units]}
                  </span>
                  <button onClick={() => setUnits(p => ({ ...p, [u.key]: (p[u.key as keyof typeof p] ?? 0) + 10 }))}
                    style={{ width: 28, height: 28, borderRadius: 6, background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', color: '#EF4444', cursor: 'pointer' }}>+</button>
                </div>
              ))}

              {/* Win probability */}
              <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '14px', marginTop: 16, marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>Monte Carlo Probability ({totalUnits} units)</span>
                  <span style={{ fontSize: 18, fontWeight: 800, color: probColor, fontFamily: 'monospace' }}>{(winProb * 100).toFixed(0)}%</span>
                </div>
                <div style={{ height: 8, background: 'rgba(255,255,255,0.08)', borderRadius: 4, overflow: 'hidden', marginBottom: 6 }}>
                  <motion.div animate={{ width: `${winProb * 100}%` }} transition={{ type: 'spring' }}
                    style={{ height: '100%', background: `linear-gradient(90deg, ${probColor}, ${probColor}88)`, borderRadius: 4 }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 10, color: probColor }}><EmojiIcon emoji="" /> Attack {(winProb * 100).toFixed(0)}%</span>
                  <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}><EmojiIcon emoji="" /> Defense {((1 - winProb) * 100).toFixed(0)}%</span>
                </div>
              </div>

              <button onClick={() => attackMut.mutate()} disabled={attackMut.isPending || totalUnits === 0}
                style={{ width: '100%', padding: '14px', background: totalUnits > 0 ? 'rgba(239,68,68,0.15)' : 'rgba(255,255,255,0.04)', border: `1px solid ${totalUnits > 0 ? 'rgba(239,68,68,0.5)' : 'rgba(255,255,255,0.08)'}`, borderRadius: 12, color: totalUnits > 0 ? '#EF4444' : '#4B5563', fontSize: 15, fontWeight: 800, cursor: totalUnits > 0 ? 'pointer' : 'not-allowed', letterSpacing: '0.05em' }}>
                {attackMut.isPending ? '⏳ Launching…' : `<EmojiIcon emoji="" /> LAUNCH ${typeConf.label.toUpperCase()}`}
              </button>
              <div style={{ marginTop: 10, display: 'flex', justifyContent: 'center' }}>
                <StaminaBar />
              </div>
            </motion.div>
          )}

          {/* ROLLING DICE */}
          {phase === 'rolling' && (
            <motion.div key="rolling" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 300, gap: 24 }}>
              <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Rolling dice…</div>
              <div>
                <div style={{ fontSize: 11, color: '#EF4444', textAlign: 'center', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.1em' }}><EmojiIcon emoji="" /> Attacker</div>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                  {atkDice.map((v, i) => <Die key={i} value={v} color="red" delay={i * 0.1} />)}
                </div>
              </div>
              <div style={{ fontSize: 20, color: 'rgba(255,255,255,0.3)' }}>vs</div>
              <div>
                <div style={{ fontSize: 11, color: '#3B82F6', textAlign: 'center', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.1em' }}><EmojiIcon emoji="" /> Defender</div>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                  {defDice.map((v, i) => <Die key={i} value={v} color="blue" delay={0.3 + i * 0.1} />)}
                </div>
              </div>
            </motion.div>
          )}

          {/* RESULT */}
          {phase === 'result' && outcome && (
            <motion.div key="result" initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
              style={{ textAlign: 'center', paddingTop: 30 }}>
              <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ duration: 0.6 }}
                style={{ fontSize: 64, marginBottom: 12 }}>
                {outcome === 'win' ? '' : outcome === 'loss' ? '' : ''}
              </motion.div>
              <div style={{ fontSize: 24, fontWeight: 800, color: outcome === 'win' ? '#00884a' : outcome === 'loss' ? '#EF4444' : '#F59E0B', marginBottom: 8 }}>
                {outcome === 'win' ? 'VICTORY!' : outcome === 'loss' ? 'DEFEATED' : 'STANDOFF'}
              </div>
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.35)', marginBottom: 24, lineHeight: 1.6 }}>
                {outcome === 'win'
                  ? atkType === 'conquest'
                    ? `${target.place_name || 'Territory'} is now under your control!`
                    : 'Raid successful — resources plundered!'
                  : outcome === 'loss'
                    ? 'Your forces were repelled. Reinforce and try again.'
                    : 'Both sides withdrew. The territory remains contested.'}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => { setPhase('setup'); setOutcome(null) }}
                  style={{ flex: 1, padding: '12px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, color: 'rgba(255,255,255,0.04)', cursor: 'pointer', fontSize: 13 }}>
                  <EmojiIcon emoji="" /> Attack Again
                </button>
                <button onClick={onClose}
                  style={{ flex: 1, padding: '12px', background: 'rgba(0,136,74,0.1)', border: '1px solid rgba(0,136,74,0.3)', borderRadius: 10, color: '#00884a', cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>
                  Map →
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </GlassPanel>
  )
}
