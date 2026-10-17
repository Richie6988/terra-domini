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
import { Clock, Minus, Plus, ArrowRight, RotateCcw, Info } from 'lucide-react'
import { IconSVG } from '../shared/iconBank'
import type { TerritoryLight } from '../../types'

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
  { id: 'conquest',  label: 'Conquest',  iconId: 'swords',  color: '#EF4444', desc: 'Full invasion — captures territory on win. Slow but decisive.',   timer: '4h+',  riskMult: 1.0 },
  { id: 'raid',      label: 'Raid',      iconId: 'tornado',  color: '#F59E0B', desc: 'Steals resources without capturing. Fast, lower losses.',          timer: '4h+',  riskMult: 0.7 },
  { id: 'surprise',  label: 'Surprise',  iconId: 'moon',  color: '#8B5CF6', desc: 'Night strike — ignores some defenses. Higher risk, higher reward.', timer: '2h+', riskMult: 1.3 },
  { id: 'siege',     label: 'Siege',     iconId: 'castle',  color: '#6382FF', desc: 'Reduces fortifications without capturing. Weakens for next attack.', timer: '4h+', riskMult: 0.5 },
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
  const [outcome, setOutcome]   = useState<'win' | 'loss' | 'draw' | 'launched' | null>(null)
  const [launchMsg, setLaunchMsg] = useState('')
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
    mutationFn: () => api.post('/combat/attack/', {
      target_h3: target.h3_index,
      attack_type: atkType,
      units,
    }),
    onSuccess: (res) => {
      // Battles resolve server-side after a timer — no instant outcome to show
      setLaunchMsg(res.data?.message || 'Attack launched!')
      setOutcome('launched')
      setPhase('result')
      qc.invalidateQueries({ queryKey: ['battles-active'] })
      qc.invalidateQueries({ queryKey: ['my-army'] })
    },
    onError: (e: any) => {
      const data = e.response?.data
      if (e.response?.status === 429 && data?.next_slot_label) {
        toast.error(`No slots — next in ${data.next_slot_label}`, { duration: 5000 })
      } else {
        toast.error(data?.error || 'Attack failed')
      }
    },
  })

  const probColor = winProb >= 0.65 ? '#22c55e' : winProb >= 0.4 ? '#F59E0B' : '#EF4444'

  return (
    <GlassPanel title="ATTACK" onClose={onClose} accent="#dc2626" width={560}
      icon={<IconSVG id="target" size={24} />} subtitle={target.place_name || 'Enemy zone'}>
      {/* Target info */}
      <div className="hx-card" style={{ marginBottom: 14, display: 'flex', alignItems: 'center', gap: 12 }}>
        <IconSVG id="flag_red" size={40} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, color: '#e2e8f0', fontWeight: 800, letterSpacing: 1.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{target.place_name || 'ENEMY ZONE'}</div>
          <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
            <span className="hx-chip">OWNER <span style={{ color: '#e2e8f0' }}>{target.owner_username ?? 'Unknown'}</span></span>
            {target.defense_tier > 0 && <span className="hx-chip hx-chip--accent">DEFENSE TIER {target.defense_tier}</span>}
          </div>
        </div>
      </div>

      <div>
        <AnimatePresence mode="wait">

          {/* SETUP */}
          {phase === 'setup' && (
            <motion.div key="setup" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>

              {/* Attack type */}
              <div className="hx-section-title">ATTACK TYPE</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 220px), 1fr))', gap: 8, marginBottom: 18 }}>
                {ATTACK_TYPES.map(t => (
                  <button key={t.id} onClick={() => setAtkType(t.id)}
                    aria-pressed={atkType === t.id}
                    className="hx-card hx-card--interactive"
                    style={{ ['--accent' as any]: t.color, padding: 12, borderColor: atkType === t.id ? t.color : undefined, background: atkType === t.id ? `linear-gradient(180deg, ${t.color}26, ${t.color}08)` : undefined, boxShadow: atkType === t.id ? `0 0 16px ${t.color}30` : undefined, textAlign: 'left', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                    <IconSVG id={t.iconId} size={34} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 1.5, color: atkType === t.id ? '#fff' : '#e2e8f0' }}>{t.label}</div>
                      <div style={{ fontSize: 11, color: 'var(--hx-text-2)', marginTop: 4, lineHeight: 1.4, fontFamily: 'system-ui, sans-serif', textTransform: 'none', letterSpacing: 0 }}>{t.desc}</div>
                      <span className="hx-chip" style={{ marginTop: 8, color: t.color }}><Clock size={11} /> {t.timer}</span>
                    </div>
                  </button>
                ))}
              </div>

              {/* Units */}
              <div className="hx-section-title">DEPLOY FORCES</div>
              {[
                { key: 'infantry', emoji: 'swords', name: 'Infantry', max: 999 },
                { key: 'cavalry',  emoji: 'horse', name: 'Cavalry',  max: 999 },
                { key: 'artillery',emoji: 'bomb', name: 'Artillery',max: 999 },
              ].map(u => (
                <div key={u.key} className="hx-card" style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, padding: '8px 12px' }}>
                  <IconSVG id={u.emoji} size={30} />
                  <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: 1.5, color: '#e2e8f0', flex: 1 }}>{u.name}</span>
                  <button onClick={() => setUnits(p => ({ ...p, [u.key]: Math.max(0, (p[u.key as keyof typeof p] ?? 0) - 10) }))}
                    aria-label={`Remove 10 ${u.name}`} className="hx-icon-btn"><Minus size={16} /></button>
                  <span style={{ minWidth: 48, textAlign: 'center', fontFamily: "'Share Tech Mono', monospace", color: '#e2e8f0', fontSize: 18 }}>
                    {units[u.key as keyof typeof units]}
                  </span>
                  <button onClick={() => setUnits(p => ({ ...p, [u.key]: (p[u.key as keyof typeof p] ?? 0) + 10 }))}
                    aria-label={`Add 10 ${u.name}`} className="hx-icon-btn" style={{ color: '#f87171', borderColor: 'rgba(239,68,68,0.4)', background: 'rgba(239,68,68,0.12)' }}><Plus size={16} /></button>
                </div>
              ))}

              {/* Win probability */}
              <div className="hx-card" style={{ marginTop: 14, marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, gap: 8 }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, fontWeight: 700, letterSpacing: 1.5, color: 'var(--hx-text-2)' }}>
                      WIN CHANCE <span className="hx-chip" style={{ color: '#fbbf24', borderColor: 'rgba(251,191,36,0.4)' }}>ESTIMATE</span>
                    </div>
                    <div style={{ fontSize: 9, color: 'var(--hx-text-3)', marginTop: 4 }}>{totalUnits} UNITS DEPLOYED</div>
                  </div>
                  <span style={{ fontSize: 28, color: probColor, fontFamily: "'Share Tech Mono', monospace" }}>~{(winProb * 100).toFixed(0)}%</span>
                </div>
                <div style={{ height: 8, background: 'rgba(255,255,255,0.08)', borderRadius: 4, overflow: 'hidden', marginBottom: 6 }}>
                  <motion.div animate={{ width: `${winProb * 100}%` }} transition={{ type: 'spring' }}
                    style={{ height: '100%', background: `linear-gradient(90deg, ${probColor}, ${probColor}88)`, borderRadius: 4 }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 10, color: probColor }}>Attack {(winProb * 100).toFixed(0)}%</span>
                  <span style={{ fontSize: 10, color: 'var(--hx-text-3)' }}>Defense {((1 - winProb) * 100).toFixed(0)}%</span>
                </div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start', marginTop: 10, fontSize: 11, lineHeight: 1.4, color: 'var(--hx-text-3)', fontFamily: 'system-ui, sans-serif', textTransform: 'none', letterSpacing: 0 }}>
                  <Info size={13} style={{ flexShrink: 0, marginTop: 1 }} />
                  Client-side dice simulation for guidance only. The server resolves the real battle after the timer.
                </div>
              </div>

              <button onClick={() => attackMut.mutate()} disabled={attackMut.isPending || totalUnits === 0}
                className="btn-game btn-game-red"
                style={{ width: '100%', padding: '15px', fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                <IconSVG id={typeConf.iconId} size={20} />
                {attackMut.isPending ? 'Launching…' : `LAUNCH ${(typeConf.label || "").toUpperCase()}`}
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
                <div style={{ fontSize: 11, color: '#EF4444', textAlign: 'center', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Attacker</div>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                  {atkDice.map((v, i) => <Die key={i} value={v} color="red" delay={i * 0.1} />)}
                </div>
              </div>
              <div style={{ fontSize: 20, color: 'rgba(255,255,255,0.3)' }}>vs</div>
              <div>
                <div style={{ fontSize: 11, color: '#3B82F6', textAlign: 'center', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Defender</div>
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
                style={{ marginBottom: 14, display: 'flex', justifyContent: 'center', filter: 'drop-shadow(0 0 18px rgba(220,38,38,0.45))' }}>
                <IconSVG id={outcome === 'launched' ? 'swords' : outcome === 'win' ? 'trophy' : outcome === 'loss' ? 'skull' : 'scales'} size={84} />
              </motion.div>
              <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: 3, color: outcome === 'launched' ? '#f87171' : outcome === 'win' ? '#22c55e' : outcome === 'loss' ? '#EF4444' : '#F59E0B', marginBottom: 8 }}>
                {outcome === 'launched' ? 'ATTACK LAUNCHED' : outcome === 'win' ? 'VICTORY!' : outcome === 'loss' ? 'DEFEATED' : 'STANDOFF'}
              </div>
              <div style={{ fontSize: 13, color: 'var(--hx-text-2)', marginBottom: 24, lineHeight: 1.6, fontFamily: 'system-ui, sans-serif', textTransform: 'none', letterSpacing: 0 }}>
                {outcome === 'launched'
                  ? launchMsg
                  : outcome === 'win'
                  ? atkType === 'conquest'
                    ? `${target.place_name || 'Territory'} is now under your control!`
                    : 'Raid successful — resources plundered!'
                  : outcome === 'loss'
                    ? 'Your forces were repelled. Reinforce and try again.'
                    : 'Both sides withdrew. The territory remains contested.'}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => { setPhase('setup'); setOutcome(null) }}
                  className="btn-game btn-game-glass" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                  <RotateCcw size={14} /> ATTACK AGAIN
                </button>
                <button onClick={onClose}
                  className="btn-game btn-game-green" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                  BACK TO MAP <ArrowRight size={14} />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </GlassPanel>
  )
}
