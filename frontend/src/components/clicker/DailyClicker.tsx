/**
 * DailyClicker — Mini-jeu 60s quotidien.
 * Cibles apparaissent aléatoirement sur l'écran.
 * Cliquer = points. Bombes = malus. Multiplicateurs = bonus.
 * Récompenses : HEX Coin + HEX + loot aléatoire.
 */
import { useState, useEffect, useRef, useCallback } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { api } from '../../services/api'
import toast from 'react-hot-toast'

type Target = {
  id: string
  type: 'coin' | 'crate' | 'bomb' | 'multiplier' | 'rare_gem'
  x: number
  y: number
  points: number
  born: number
  ttl: number
}

const TARGET_CFG = {
  coin:       { emoji: '🪙', color: '#FFB800', points: 10, weight: 50, ttl: 1800 },
  crate:      { emoji: '📦', color: '#10B981', points: 25, weight: 20, ttl: 2500 },
  bomb:       { emoji: '💣', color: '#EF4444', points: -30, weight: 12, ttl: 2000 },
  multiplier: { emoji: '⚡', color: '#8B5CF6', points: 50, weight: 8,  ttl: 1500 },
  rare_gem:   { emoji: '💎', color: '#06B6D4', points: 150, weight: 3, ttl: 1200 },
}

function weightedRandom(): keyof typeof TARGET_CFG {
  const entries = Object.entries(TARGET_CFG) as [keyof typeof TARGET_CFG, any][]
  const total = entries.reduce((s, [, v]) => s + v.weight, 0)
  let r = Math.random() * total
  for (const [key, val] of entries) {
    r -= val.weight
    if (r <= 0) return key
  }
  return 'coin'
}

function spawnTarget(): Target {
  const type = weightedRandom()
  return {
    id: Math.random().toString(36).slice(2),
    type,
    x: 8 + Math.random() * 82,
    y: 10 + Math.random() * 72,
    points: TARGET_CFG[type].points,
    born: Date.now(),
    ttl: TARGET_CFG[type].ttl,
  }
}

const LOOT_LABELS: Record<string, string> = {
  resource_food: '🌾 Food', resource_materials: '⚙️ Materials',
  resource_energy: '⚡ Energy', boost_defense_6h: '🛡️ Defense Boost 6h',
  boost_income_24h: '💰 Income Boost 24h', tdc_jackpot: '🎰 HEX Coin Jackpot!',
  nft_territory_skin: '🎨 NFT Skin', tdi_bonus_10: '💎 +10 HEX',
}

type SessionState = { session_id: number; already_done: boolean; tdc_earned?: number; loot_tier?: string; loot_item?: string; loot_qty?: number; streak_mult: number }

export function DailyClicker({ onClose }: { onClose: () => void }) {
  const [phase, setPhase] = useState<'idle' | 'playing' | 'done'>('idle')
  const [targets, setTargets] = useState<Target[]>([])
  const [score, setScore] = useState(0)
  const [clicks, setClicks] = useState(0)
  const [timeLeft, setTimeLeft] = useState(60)
  const [mult, setMult] = useState(1)
  const [floats, setFloats] = useState<{ id: string; x: number; y: number; text: string; color: string }[]>([])
  const [result, setResult] = useState<any>(null)
  const spawnTimer = useRef<number>()
  const tickTimer  = useRef<number>()
  const batchRef   = useRef({ clicks: 0, score: 0 })
  const qc = useQueryClient()

  const { data: session } = useQuery<SessionState>({
    queryKey: ['clicker-today'],
    queryFn: () => api.get('/clicker/today/').then(r => r.data),
  })

  const clickMut = useMutation({
    mutationFn: (data: { clicks: number; score: number }) => api.post('/clicker/click/', data),
  })
  const finishMut = useMutation({
    mutationFn: () => api.post('/clicker/finish/', {}),
    onSuccess: (r) => {
      setResult(r.data)
      setPhase('done')
      qc.invalidateQueries({ queryKey: ['clicker-today'] })
    },
  })

  const startGame = useCallback(() => {
    if (session?.already_done) return
    setPhase('playing')
    setScore(0); setClicks(0); setTimeLeft(60); setMult(1); setTargets([])
  }, [session])

  // Spawn targets
  useEffect(() => {
    if (phase !== 'playing') return
    const spawn = () => {
      setTargets(prev => {
        const alive = prev.filter(t => Date.now() - t.born < t.ttl)
        if (alive.length < 8) return [...alive, spawnTarget()]
        return alive
      })
    }
    spawnTimer.current = window.setInterval(spawn, 600)
    return () => clearInterval(spawnTimer.current)
  }, [phase])

  // Countdown + auto-expire targets
  useEffect(() => {
    if (phase !== 'playing') return
    tickTimer.current = window.setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) { clearInterval(tickTimer.current); finishMut.mutate(); return 0 }
        return t - 1
      })
      setTargets(prev => prev.filter(t => Date.now() - t.born < t.ttl))
    }, 1000)
    return () => clearInterval(tickTimer.current)
  }, [phase])

  // Batch sync to backend every 2s
  useEffect(() => {
    if (phase !== 'playing') return
    const id = setInterval(() => {
      if (batchRef.current.clicks > 0) {
        clickMut.mutate({ ...batchRef.current })
        batchRef.current = { clicks: 0, score: 0 }
      }
    }, 2000)
    return () => clearInterval(id)
  }, [phase])

  const handleClick = useCallback((t: Target, e: React.MouseEvent) => {
    e.stopPropagation()
    const pts = t.points * mult
    setScore(s => s + pts)
    setClicks(c => c + 1)
    batchRef.current.clicks += 1
    batchRef.current.score += pts

    if (t.type === 'multiplier') setMult(m => Math.min(m + 0.5, 4))

    const cfg = TARGET_CFG[t.type]
    setFloats(f => [...f, { id: Math.random().toString(36).slice(2), x: t.x, y: t.y, text: pts > 0 ? `+${pts}` : `${pts}`, color: pts > 0 ? cfg.color : '#EF4444' }])
    setTimeout(() => setFloats(f => f.slice(1)), 800)

    setTargets(prev => prev.filter(x => x.id !== t.id))
  }, [mult])

  const streakMult = session?.streak_mult ?? 1

  const TIER_COLORS: Record<string, string> = { common: '#9CA3AF', rare: '#3B82F6', epic: '#8B5CF6', legendary: '#FFB800' }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.92)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        style={{ width: '100%', maxWidth: 480, maxHeight: '90vh', background: '#0A0A14', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 20, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Header */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
          <span style={{ fontSize: 20, marginRight: 10 }}>🎯</span>
          <span style={{ fontSize: 16, fontWeight: 700, color: '#fff', flex: 1 }}>Daily Clicker</span>
          {streakMult > 1 && <span style={{ fontSize: 11, color: '#FFB800', background: 'rgba(255,184,0,0.12)', padding: '3px 8px', borderRadius: 6, marginRight: 10 }}>🔥 x{streakMult} streak</span>}
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#4B5563', cursor: 'pointer', fontSize: 20 }}>×</button>
        </div>

        {/* IDLE */}
        {phase === 'idle' && !session?.already_done && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 32, gap: 16 }}>
            <div style={{ fontSize: 60 }}>🎯</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#fff' }}>Daily Clicker</div>
            <div style={{ fontSize: 13, color: '#6B7280', textAlign: 'center', lineHeight: 1.7, maxWidth: 300 }}>
              Click targets as fast as you can — 60 seconds.<br />
              🪙 Coins +10 · 📦 Crates +25 · 💣 Bombs -30<br />
              ⚡ Multipliers boost score · 💎 Gems +150<br />
              Earn HEX Coin + HEX + random loot!
            </div>
            {streakMult > 1 && <div style={{ fontSize: 13, color: '#FFB800', fontWeight: 600 }}>🔥 Streak bonus active: x{streakMult}</div>}
            <button onClick={startGame} style={{ padding: '14px 48px', background: 'rgba(0,255,135,0.15)', border: '1px solid rgba(0,255,135,0.4)', borderRadius: 14, color: '#00FF87', fontSize: 16, fontWeight: 800, cursor: 'pointer', letterSpacing: '0.05em' }}>
              START
            </button>
          </div>
        )}

        {/* ALREADY DONE */}
        {phase === 'idle' && session?.already_done && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 }}>
            <div style={{ fontSize: 50 }}>✅</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#fff' }}>Already done today!</div>
            <div style={{ fontSize: 28, color: '#FFB800', fontWeight: 800, fontFamily: 'monospace' }}>🪙 +{parseFloat(String(session.tdc_earned || 0)).toFixed(1)} HEX Coin</div>
            {session.loot_item && (
              <div style={{ fontSize: 14, color: TIER_COLORS[session.loot_tier || 'common'] }}>
                {LOOT_LABELS[session.loot_item] || session.loot_item} ×{session.loot_qty}
              </div>
            )}
            <div style={{ fontSize: 12, color: '#4B5563' }}>Come back tomorrow for more rewards</div>
            <button onClick={onClose} style={{ marginTop: 8, padding: '10px 28px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, color: '#9CA3AF', cursor: 'pointer' }}>Close</button>
          </div>
        )}

        {/* PLAYING */}
        {phase === 'playing' && (
          <div style={{ flex: 1, position: 'relative', overflow: 'hidden', minHeight: 380, background: 'radial-gradient(ellipse at center, rgba(0,255,135,0.03) 0%, transparent 70%)' }}>
            {/* HUD bar */}
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10, display: 'flex', alignItems: 'center', padding: '10px 16px', background: 'rgba(0,0,0,0.6)', gap: 16 }}>
              <div style={{ flex: 1 }}>
                <div style={{ height: 6, background: 'rgba(255,255,255,0.1)', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ height: '100%', background: timeLeft > 20 ? '#00FF87' : '#EF4444', width: `${(timeLeft / 60) * 100}%`, transition: 'width 1s linear, background 0.3s' }} />
                </div>
              </div>
              <div style={{ fontSize: 18, fontWeight: 800, color: timeLeft <= 10 ? '#EF4444' : '#fff', fontFamily: 'monospace', minWidth: 32, textAlign: 'right' }}>{timeLeft}s</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#FFB800', fontFamily: 'monospace' }}>⚡{score}</div>
              {mult > 1 && <div style={{ fontSize: 12, color: '#8B5CF6', fontWeight: 700 }}>x{mult.toFixed(1)}</div>}
            </div>

            {/* Targets */}
            <AnimatePresence>
              {targets.map(t => {
                const cfg = TARGET_CFG[t.type]
                return (
                  <motion.button key={t.id} initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0, opacity: 0 }}
                    onClick={e => handleClick(t, e)}
                    style={{
                      position: 'absolute', left: `${t.x}%`, top: `${t.y}%`,
                      width: 52, height: 52, borderRadius: '50%',
                      background: `radial-gradient(circle, ${cfg.color}40, ${cfg.color}20)`,
                      border: `2px solid ${cfg.color}`,
                      boxShadow: `0 0 16px ${cfg.color}80`,
                      fontSize: 24, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      userSelect: 'none', WebkitUserSelect: 'none',
                      transform: 'translate(-50%, -50%)',
                    }}>
                    {cfg.emoji}
                  </motion.button>
                )
              })}
            </AnimatePresence>

            {/* Float text */}
            <AnimatePresence>
              {floats.map(f => (
                <motion.div key={f.id} initial={{ opacity: 1, y: 0 }} animate={{ opacity: 0, y: -40 }} exit={{}}
                  style={{ position: 'absolute', left: `${f.x}%`, top: `${f.y}%`, pointerEvents: 'none', fontSize: 16, fontWeight: 800, color: f.color, fontFamily: 'monospace', textShadow: `0 0 10px ${f.color}`, zIndex: 20 }}>
                  {f.text}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}

        {/* DONE */}
        {phase === 'done' && result && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 28, gap: 12 }}>
            <div style={{ fontSize: 48 }}>
              {result.loot?.tier === 'legendary' ? '🏆' : result.loot?.tier === 'epic' ? '🎉' : '✨'}
            </div>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#fff' }}>Session Complete!</div>
            <div style={{ fontSize: 13, color: '#6B7280' }}>{result.clicks} clicks · {result.score} points</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 8, width: '100%' }}>
              <div style={{ background: 'rgba(255,184,0,0.08)', border: '1px solid rgba(255,184,0,0.2)', borderRadius: 12, padding: '14px 12px', textAlign: 'center' }}>
                <div style={{ fontSize: 10, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.1em' }}>HEX Coin Earned</div>
                <div style={{ fontSize: 24, fontWeight: 800, color: '#FFB800', fontFamily: 'monospace', marginTop: 4 }}>+{parseFloat(result.tdc_earned).toFixed(1)}</div>
              </div>
              <div style={{ background: 'rgba(0,255,135,0.06)', border: '1px solid rgba(0,255,135,0.15)', borderRadius: 12, padding: '14px 12px', textAlign: 'center' }}>
                <div style={{ fontSize: 10, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.1em' }}>HEX Earned</div>
                <div style={{ fontSize: 24, fontWeight: 800, color: '#00FF87', fontFamily: 'monospace', marginTop: 4 }}>+{parseFloat(result.tdi_earned).toFixed(4)}</div>
              </div>
            </div>
            {result.loot && (
              <div style={{ padding: '12px 20px', background: `rgba(255,255,255,0.04)`, border: `1px solid ${TIER_COLORS[result.loot.tier] ?? '#fff'}40`, borderRadius: 12, textAlign: 'center', width: '100%', boxSizing: 'border-box' }}>
                <div style={{ fontSize: 10, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>Loot Drop</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: TIER_COLORS[result.loot.tier] ?? '#fff' }}>
                  {LOOT_LABELS[result.loot.item] || result.loot.item} ×{result.loot.quantity}
                </div>
                <div style={{ fontSize: 10, color: TIER_COLORS[result.loot.tier], textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 2 }}>{result.loot.tier}</div>
              </div>
            )}
            {result.streak_mult > 1 && <div style={{ fontSize: 12, color: '#FFB800' }}>🔥 Streak x{result.streak_mult} applied</div>}
            <button onClick={onClose} style={{ marginTop: 8, padding: '12px 32px', background: 'rgba(0,255,135,0.12)', border: '1px solid rgba(0,255,135,0.3)', borderRadius: 12, color: '#00FF87', cursor: 'pointer', fontSize: 14, fontWeight: 700 }}>Collect & Close</button>
          </div>
        )}
      </motion.div>
    </div>
  )
}

